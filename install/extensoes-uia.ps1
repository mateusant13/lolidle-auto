#requires -Version 5
<#
  extensoes-uia.ps1 — age no chrome://extensions de uma janela JA criada (invisivel) pelo
  bg-window.py do manager. NAO abre janelas nenhumas.

  REGRA 12 (canal sancionado) + REGRA 10.6 (reload da extensao unpacked) + REGRA 11.2.

  O que faz este script para NAO atrapalhar:

    o  GUARDIAO CONTINUO. O `chrome --new-window` ACTIVA a janela, e o Chrome pode activa-la
       outra vez uns instantes DEPOIS do arranque — a janela do bg-window so' devolve o foco
       duas vezes (open/close) e nao apanha isso. Aqui ha' um timer de 20 ms que, ENQUANTO
       trabalhamos, devolve o foco ao dono SEMPRE QUE — e so' quando — o foreground e' a
       NOSSA janela (nunca quando ele mudou de aplicacao de proposito). Mesma regra do
       `bg-window.py guard` (:182-230).
    o  CAMUFLAGEM. alpha-0 (invisivel) + WS_EX_TRANSPARENT (os cliques do dono PASSAM ao
       lado — uma janela alpha-0 sem isto engole cliques) + WS_EX_TOOLWINDOW (fora da barra
       de tarefas e do Alt-Tab).
    o  SEM TECLADO NO FOREGROUND. Navegacao por UIA ValuePattern.SetValue + Enter POSTADO.
       NAO chama SetForegroundWindow. NAO chama SetFocus (activam a janela -> roubam o foco).
       Fonte: VOD.RIP cookie_extension_auto_install.ps1:13-30, :870-935.
    o  CURTO. Polling fino e espera pela LISTA (nao so' pelo loadUnpacked) para nao andar a
       repetir a navegacao 80 s.

  Uso:
    install\extensoes-uia.ps1 -Hwnd 123456 -DonoHwnd 654321 -Acao reload -ExtensionDir "I:\!lolidle.com\extension"
  Saida: UMA linha JSON.
#>
param(
  [Parameter(Mandatory = $true)][int]$Hwnd,
  [int]$DonoHwnd = 0,                       # janela do DONO: a que tem de ficar a frente (guardiao)
  [ValidateSet('reload', 'activar', 'desactivar', 'estado')][string]$Acao = 'reload',
  [string]$ExtensionName = 'LoL Idle',
  [string]$ExtensionDir = 'I:\!lolidle.com\extension',
  [int]$NavEsperaMs = 8000,
  [int]$ListaEsperaMs = 8000,
  [int]$VerifyEsperaMs = 12000,
  [switch]$Dump
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type @"
using System; using System.Text; using System.Threading; using System.Runtime.InteropServices;
public static class UiaWin {
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);
  [DllImport("user32.dll")] public static extern bool GetLayeredWindowAttributes(IntPtr h, out uint key, out byte alpha, out uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();

  const int GWL_EXSTYLE = -20;
  const int WS_EX_LAYERED = 0x00080000, WS_EX_TRANSPARENT = 0x00000020, WS_EX_TOOLWINDOW = 0x00000080;
  const uint SWP_NOSIZE = 0x0001, SWP_NOMOVE = 0x0002, SWP_NOACTIVATE = 0x0010, SWP_FRAMECHANGED = 0x0020;

  public static string T(IntPtr h){ var s = new StringBuilder(400); GetWindowText(h, s, 400); return s.ToString(); }

  public static bool Invisivel(IntPtr h){
    uint k; byte a; uint f;
    if (!GetLayeredWindowAttributes(h, out k, out a, out f)) return false;
    return (f & 0x2) != 0 && a == 0;
  }

  // alpha-0 + click-through + fora do Alt-Tab/taskbar. Sem ACTIVAR (SWP_NOACTIVATE) e sem mexer
  // no tamanho/posicao (o bg-window.py ja a posicionou ON-SCREEN).
  public static void Camuflar(IntPtr h){
    int ex = GetWindowLong(h, GWL_EXSTYLE);
    SetWindowLong(h, GWL_EXSTYLE, ex | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW);
    SetLayeredWindowAttributes(h, 0, 0, 0x0002);
    SetWindowPos(h, IntPtr.Zero, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_FRAMECHANGED);
  }

  public static bool Restaurar(IntPtr alvo){
    if (alvo == IntPtr.Zero) return false;
    uint pid; uint tid = GetWindowThreadProcessId(alvo, out pid);
    uint eu = GetCurrentThreadId();
    if (tid == 0) return false;
    AttachThreadInput(eu, tid, true);
    bool ok = SetForegroundWindow(alvo);
    BringWindowToTop(alvo);
    AttachThreadInput(eu, tid, false);
    return ok;
  }

  // ---- GUARDIAO CONTINUO (a razao de existir deste ficheiro) ----
  static IntPtr _dono = IntPtr.Zero, _nossa = IntPtr.Zero;
  static Timer _timer = null;
  static int _devolvidos = 0;
  public static void GuardarIniciar(IntPtr dono, IntPtr nossa, int ms){
    _dono = dono; _nossa = nossa; _devolvidos = 0;
    _timer = new Timer(_ => {
      try {
        if (_pausado) return;
        // A UNICA condicao: o foreground e' a NOSSA janela. Se o dono mudou de aplicacao de
        // proposito, o foreground e' outra coisa -> NAO se toca (pisar essa escolha e' outro roubo).
        if (_dono != IntPtr.Zero && _nossa != IntPtr.Zero && GetForegroundWindow() == _nossa) {
          if (Restaurar(_dono)) Interlocked.Increment(ref _devolvidos);
        }
      } catch { }
    }, null, 0, ms);
  }
  // PAUSA CURTA. `ValuePattern.SetValue` no omnibox FOGA o controlo -> o Chrome ACTIVA a janela.
  // Se o guardiao devolver o foco ANTES do Enter chegar, o omnibox perde o foco interno e a
  // navegacao e' um no-op (medido: `tentativas:3`, titulo preso em `about:blank`). Pausa-se so'
  // em volta do `SetValue`+`Enter` (~100 ms) e retoma-se a seguir, devolvendo o dono JA'.
  static volatile bool _pausado = false;
  public static void GuardarPausar(){ _pausado = true; }
  public static void GuardarRetomar(){ _pausado = false; if (_dono != IntPtr.Zero) Restaurar(_dono); }
  public static bool GuardarPausado(){ return _pausado; }
  public static void GuardarParar(){ if (_timer != null) { _timer.Dispose(); _timer = null; } }
  public static int Devolvidos { get { return _devolvidos; } }

  // Enter POSTADO: o teclado nunca toca na app do dono.
  public static void Enter(IntPtr h){
    PostMessage(h, 0x0100, (IntPtr)0x0D, (IntPtr)0x001C0001);
    Thread.Sleep(60);
    PostMessage(h, 0x0101, (IntPtr)0x0D, (IntPtr)0xC01C0001);
  }
  public static void Fechar(IntPtr h){ PostMessage(h, 0x0010, IntPtr.Zero, IntPtr.Zero); }
}
"@

$out = [ordered]@{
  ok = $false; hwnd = $Hwnd; dono = $DonoHwnd; acao = $Acao; invisivel = $null; titulo = $null; tentativas = $null
  devmode = $null; cartao = $null; enabled = $null; clicked = $null; foco_roubado_devolvido = $null
  extension_id = $null; disable_reasons = $null; verify = $null; error = $null
}

function Find-ByType($root, $ct) {
  $c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $ct)
  return $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $c)
}
function Find-ById($root, [string]$aid) {
  $c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, $aid)
  return $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $c)
}
function Invoke-Elem($el) {
  $p = $null
  try {
    if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$p)) { $p.Invoke(); return 'InvokePattern' }
    if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$p)) { $p.Toggle(); return 'TogglePattern' }
    # LegacyIAccessible pelo ID (10018): referenciar o TIPO nesta montagem lanca "Nao e possivel
    # localizar o tipo" e matava o fluxo a meio.
    $lg = [System.Windows.Automation.AutomationPattern]::LookupById(10018)
    if ($lg -and $el.TryGetCurrentPattern($lg, [ref]$p)) { $p.DoDefaultAction(); return 'Legacy' }
  } catch { }
  return $null
}
function Find-Cartao($root, [string]$nome) {
  $cands = New-Object System.Collections.ArrayList
  $exato = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,
    (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $nome)))
  foreach ($e in $exato) { [void]$cands.Add($e) }
  if ($cands.Count -eq 0) {
    $tudo = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($e in $tudo) { if (([string]$e.Current.Name) -like "*$nome*") { [void]$cands.Add($e) } }
  }
  foreach ($c in $cands) {
    if ((Find-ById $c 'dev-reload-button').Count -gt 0 -or (Find-ById $c 'enableToggle').Count -gt 0) { return $c }
  }
  return $null
}
function Get-Root($h) { return [System.Windows.Automation.AutomationElement]::FromHandle($h) }
# Despeja a arvore UIA visivel (so' nos com id, ou com nome relevante) — e' o que se le quando algo
# "nao existe" na arvore: prova o que a pagina expoe, em vez de adivinhar o AutomationId.
function Mostrar-Arvore($h) {
  $r = Get-Root $h
  if (-not $r) { Write-Host 'ARVORE: sem root'; return }
  $n = 0
  foreach ($c in $r.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
    $n++
    $id = [string]$c.Current.AutomationId; $nm = [string]$c.Current.Name
    if ($id -ne '' -or $nm -match 'Relay|LoL Idle|Recarreg|Ativad|Ativada|Idle') {
      Write-Host ("ARVORE type={0,-22} id='{1}' name='{2}'" -f $c.Current.ControlType.ProgrammaticName.Replace('ControlType.', ''), $id, $nm)
    }
  }
  Write-Host "ARVORE total_nos=$n"
}
# Esperar pela LISTA renderizada (nao basta o loadUnpacked: os cartoes entram depois, e a lista e
# virtualizada — filtrar antes de haver cartoes dava "toggles=0" e 4 tentativas de navegacao).
function Esperar-Lista($h, [int]$ms) {
  $limite = (Get-Date).AddMilliseconds($ms)
  while ((Get-Date) -lt $limite) {
    $r = Get-Root $h
    if ($r -and (Find-ById $r 'enableToggle').Count -gt 0) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

try {
  $h = [IntPtr]$Hwnd
  [UiaWin]::Camuflar($h)
  $out.invisivel = [UiaWin]::Invisivel($h)

  # Armado ANTES de qualquer outra coisa: a partir daqui o dono recupera o foco em ~20 ms,
  # mesmo que o Chrome active a janela mais tarde.
  if ($DonoHwnd -ne 0) { [UiaWin]::GuardarIniciar([IntPtr]$DonoHwnd, $h, 20) }

  # ---- navegar para chrome://extensions (chrome:// e' DROPPED na linha de comandos) ----
  $pronto = $false
  $tent = 0
  while (-not $pronto -and $tent -lt 3) {
    $tent++
    $root = Get-Root $h
    if (-not $root) { Start-Sleep -Milliseconds 300; continue }
    $edit = (Find-ById $root 'omnibox') | Select-Object -First 1
    if (-not $edit) {
      foreach ($e in (Find-ByType $root ([System.Windows.Automation.ControlType]::Edit))) {
        if (([string]$e.Current.Name) -match 'endere|address|Pesquisar|search|Pesquisa') { $edit = $e; break }
      }
    }
    if (-not $edit) { Start-Sleep -Milliseconds 400; continue }
    # PAUSA o guardiao SO' aqui. O `SetValue` no omnibox FOGA o controlo e o Chrome ACTIVA a
    # janela; o Enter POSTADO tem de chegar ANTES de o foco voltar ao dono — se o guardiao o
    # devolver primeiro, a omnibox perde o foco interno e a navegacao e' um no-op (medido:
    # `tentativas:3` com o titulo preso em `about:blank`). Janela de pausa ~100 ms; retoma-se logo.
    [UiaWin]::GuardarPausar()
    try {
      try { $edit.SetFocus() } catch { }
      try { $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('chrome://extensions') } catch { Start-Sleep -Milliseconds 300; continue }
      Start-Sleep -Milliseconds 80
      [UiaWin]::Enter($h)
      # O WebUI so' expoe a arvore (333 nos) enquanto a janela esta' activa. Se o
      # guardiao devolver o foco 100 ms depois do Enter, a pagina fica inactiva e o
      # UIA ve' apenas o chrome (59 nos, sem enableToggle/loadUnpacked) -> falha
      # com titulo 'Extensoes' e tentativas:3. Manter activa o tempo de render.
      Start-Sleep -Milliseconds 1200
    } finally { [UiaWin]::GuardarRetomar() }
    $limite = (Get-Date).AddMilliseconds($NavEsperaMs)
    while ((Get-Date) -lt $limite -and -not $pronto) {
      Start-Sleep -Milliseconds 250
      $root = Get-Root $h
      if ($root -and (Find-ById $root 'loadUnpacked').Count -gt 0) { $pronto = $true }
      # O WebUI expoe os nos por partes: `devMode`/`enableToggle` podem chegar ANTES do
      # `loadUnpacked`. Aceitar qualquer um deles evita repetir a navegacao (era o que dava
      # `tentativas:3` a repetir Enter numa pagina que ja estava carregada).
      elseif ($root -and ((Find-ById $root 'devMode').Count -gt 0 -or (Find-ById $root 'enableToggle').Count -gt 0)) { $pronto = $true }
    }
    $out.tentativas = $tent
    $out.titulo = [UiaWin]::T($h)
  }
  if (-not $pronto) {
    if ($Dump) { Mostrar-Arvore $h }
    throw "chrome://extensions nao renderizou (titulo='$($out.titulo)')"
  }
  [UiaWin]::Camuflar($h)   # o Chrome pode ter re-composto a janela ao navegar: re-garantir

  if ($Dump) { Mostrar-Arvore $h }

  # ---- devMode ligado (sem ele o cartao nem expoe o dev-reload-button) ----
  $devEl = (Find-ById $root 'devMode') | Select-Object -First 1
  if (-not $devEl) { throw 'sem no devMode em chrome://extensions' }
  $tp = $null
  if ($devEl.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tp)) {
    if ([string]$tp.Current.ToggleState -ne 'On') { $tp.Toggle(); $out.devmode = 'ligado-agora'; Start-Sleep -Seconds 1 } else { $out.devmode = 'ja-ligado' }
  } else { $out.devmode = Invoke-Elem $devEl; Start-Sleep -Seconds 1 }

  # ---- esperar pela LISTA antes de procurar o cartao ----
  [void](Esperar-Lista $h $ListaEsperaMs)

  # ---- encontrar o cartao ----
  $root = Get-Root $h
  $cartao = Find-Cartao $root $ExtensionName
  $tgEl = $null; $rel = $null
  if ($cartao) {
    $out.cartao = ([string]$cartao.Current.Name)
    $tgEl = (Find-ById $cartao 'enableToggle') | Select-Object -First 1
    $rel = (Find-ById $cartao 'dev-reload-button') | Select-Object -First 1
  }
  if (-not $cartao) {
    # Filtro pela pesquisa da propria pagina (a lista e' virtualizada: sem filtro o nosso cartao
    # pode ficar abaixo da dobra e NAO EXISTIR para a arvore). Depois sobra UM cartao.
    $tent = 0
    while (-not $cartao -and $tent -lt 3) {
      $tent++
      foreach ($e in (Find-ByType $root ([System.Windows.Automation.ControlType]::Edit))) {
        if (([string]$e.Current.Name) -match 'extens') {
          try { $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($ExtensionName); break } catch { }
        }
      }
      Start-Sleep -Milliseconds 1000
      $root = Get-Root $h
      [void](Esperar-Lista $h 1500)
      $cartao = Find-Cartao $root $ExtensionName
    }
  }
  if ($cartao) {
    $out.cartao = ([string]$cartao.Current.Name)
    $tgEl = (Find-ById $cartao 'enableToggle') | Select-Object -First 1
    $rel = (Find-ById $cartao 'dev-reload-button') | Select-Object -First 1
  } else {
    $tgs = Find-ById $root 'enableToggle'; $rels = Find-ById $root 'dev-reload-button'
    if ($tgs.Count -eq 1 -and $rels.Count -le 1) {
      $tgEl = $tgs[0]; if ($rels.Count -eq 1) { $rel = $rels[0] }
      $out.cartao = 'por-filtro (1 cartao na pagina)'
    } else {
      throw "cartao de '$ExtensionName' nao encontrado (toggles=$($tgs.Count), reloads=$($rels.Count); usa -Dump)"
    }
  }

  # ---- agir ----
  $toggleState = $null
  if ($tgEl) {
    $tg = $null
    if ($tgEl.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tg)) { $toggleState = [string]$tg.Current.ToggleState }
  }
  $out.enabled = $toggleState

  if ($Acao -eq 'reload') {
    # Cartao desactivado com DISABLE_RELOAD mostra o dev-reload-button: clicar nele E' o que resolve.
    if (-not $rel) { $rel = (Find-ById (Get-Root $h) 'dev-reload-button') | Select-Object -First 1 }
    if (-not $rel) { throw "sem dev-reload-button para '$ExtensionName'" }
    $out.clicked = Invoke-Elem $rel
    Start-Sleep -Seconds 2
    $root = Get-Root $h
    $cartao2 = Find-Cartao $root $ExtensionName
    $tg2 = if ($cartao2) { (Find-ById $cartao2 'enableToggle') | Select-Object -First 1 } else { (Find-ById $root 'enableToggle') | Select-Object -First 1 }
    if ($tg2) {
      $tg = $null
      if ($tg2.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tg) -and [string]$tg.Current.ToggleState -eq 'Off') {
        $tg.Toggle(); $out.enabled = 'ligado-agora'; Start-Sleep -Seconds 2
      } else { $out.enabled = 'on-apos-reload' }
    }
  } elseif ($Acao -eq 'activar' -or $Acao -eq 'desactivar') {
    if (-not $tgEl) { throw "sem enableToggle para '$ExtensionName'" }
    $tg = $null; [void]$tgEl.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tg)
    $quer = if ($Acao -eq 'activar') { 'On' } else { 'Off' }
    if ([string]$tg.Current.ToggleState -ne $quer) { $tg.Toggle(); $out.enabled = "$($Acao)-agora"; Start-Sleep -Seconds 2 }
    else { $out.enabled = "ja-$($Acao)" }
  }

  $out.ok = $true
} catch { $out.error = $_.Exception.Message }
finally {
  [UiaWin]::GuardarRetomar()
  [UiaWin]::GuardarParar()
  $out.foco_roubado_devolvido = [UiaWin]::Devolvidos
}

# ---- verificar pelo PERFIL (casando o PATH real da pasta) ----
try {
  $sp = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Secure Preferences'
  $alvoDir = [System.IO.Path]::GetFullPath($ExtensionDir).TrimEnd('\')
  $limite = (Get-Date).AddMilliseconds($VerifyEsperaMs)
  while ($true) {
    $achou = $false
    try {
      $j = Get-Content $sp -Raw | ConvertFrom-Json
      foreach ($k in $j.extensions.settings.PSObject.Properties.Name) {
        $v = $j.extensions.settings.$k
        $p = "$($v.path)"; if (-not $p) { continue }
        $pNorm = try { [System.IO.Path]::GetFullPath($p).TrimEnd('\') } catch { $p }
        if ($pNorm -ieq $alvoDir) {
          $out['extension_id'] = $k
          $out['disable_reasons'] = (@($v.disable_reasons) -join ',')
          $achou = $true
        }
      }
    } catch { }
    if ($achou) {
      $bom = if ($Acao -eq 'desactivar') { $out['disable_reasons'] -ne '' } else { $out['disable_reasons'] -eq '' }
      if ($bom -or (Get-Date) -gt $limite) { break }
    } elseif ((Get-Date) -gt $limite) { break }
    Start-Sleep -Milliseconds 700
  }
  if (-not $achou) { $out['verify'] = "nenhuma extensao com path=$alvoDir" }
  else { $out['verify'] = if ($out['disable_reasons'] -eq '') { 'ACTIVA (disable_reasons vazio)' } else { "DESACTIVADA (disable_reasons=$($out['disable_reasons']))" } }
} catch { $out['verify_error'] = $_.Exception.Message }

Write-Output ($out | ConvertTo-Json -Compress)
