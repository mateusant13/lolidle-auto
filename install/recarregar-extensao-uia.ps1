# recarregar-extensao-uia.ps1 — [ULTRAPASSADO 2026-10-18 -> REGRA Nº 13]
#
# APOSENTADO: este script FORCAVA o foco (`SetForegroundWindow` + `SetFocus`) para o Enter do
# omnibox pegar. Isso e' falso e e' o que roubava o foco ao dono. Usa:
#
#     node tools\recarregar-extensao.mjs reload      (tambem: activar | desactivar | estado)
#
# que faz o mesmo por janela invisivel do bg-window.py + install\extensoes-uia.ps1, SEM foco.
# Fica aqui so' como referencia do fluxo UIA. NAO usar em trabalho novo.
#
# --- (original) ---
# recarrega E/OU activa uma extensao unpacked no perfil REAL, SEM porta de debug.
# Receita da REGRA 10.1/10.6 do AGENTS.md.
#
#   Chrome NAO rele uma pasta unpacked quando os ficheiros mudam -> e preciso clicar Recarregar
#   no CARTAO (AutomationId = dev-reload-button), nunca o Recarregar da barra (view_1003).
#
# Fluxo:
#   1) abre chrome --new-window about:blank (reutiliza a instancia a correr, nunca mata nada);
#      chrome:// na linha de comandos e DROPPED pelo singleton -> navegacao por omnibox.
#   2) poe a janela ON-SCREEN (off-screen = ocluida = WebUI throttled, sem nos UIA) + alpha 0 + click-through.
#   3) omnibox: ValuePattern.SetValue('chrome://extensions') + Enter POSTADO.
#   4) liga o devMode; encontra o CARTAO pelo nome e, DENTRO dele, o enableToggle e o dev-reload-button.
#   5) verifica pelo PERFIL (Secure Preferences), casando o PATH da pasta — nunca por 'lolidle' a mao.
#   6) fecha SO a janela que abriu.
#
# Uso:
#   ... -File install/recarregar-extensao-uia.ps1 -ExtensionName "LoL Idle" -ExtensionDir "I:\!lolidle.com\extension"
# Saida: uma linha JSON.

param(
  [string]$ExtensionName = 'LoL Idle',
  [string]$ExtensionDir = 'I:\!lolidle.com\extension',
  [switch]$KeepWindow,
  [switch]$Dump,
  # Por omissao a janela e NORMAL: visivel e ACTIVADA. Uma janela invisivel e nao-activada nao
  # recebe foco, e o Enter no omnibox passa a falhar de forma intermitente (loadUnpacked nao
  # aparece). -Invisivel so quando o dono estiver a usar o PC e nao quiser ver a janela.
  [switch]$Invisivel,
  [switch]$Desativar,
  [int]$JamaisFechar = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class UiaWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public static string T(IntPtr h){ var s=new StringBuilder(400); GetWindowText(h,s,400); return s.ToString(); }
  public static uint P(IntPtr h){ uint p; GetWindowThreadProcessId(h,out p); return p; }
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  // REGRA 11.2 - focus-bounce. Nunca keybd_event/SetFocus. Devolve o foreground ao dono.
  public static bool RestaurarFg(IntPtr alvo){
    if (alvo == IntPtr.Zero) return false;
    uint pid; uint tidAlvo = GetWindowThreadProcessId(alvo, out pid);
    uint tidEu = GetCurrentThreadId();
    if (tidAlvo == 0) return false;
    AttachThreadInput(tidEu, tidAlvo, true);
    bool ok = SetForegroundWindow(alvo);
    AttachThreadInput(tidEu, tidAlvo, false);
    return ok;
  }
}
"@

$out = [ordered]@{ ok=$false; window=$null; enabled=$null; clicked=$null; devmode=$null; closed=$false; error=$null }

function Get-ChromeWindows {
  $script:wl = New-Object System.Collections.ArrayList
  $pids = @{}; (Get-Process chrome -ErrorAction SilentlyContinue).Id | ForEach-Object { $pids[[int]$_] = $true }
  [UiaWin]::EnumWindows({ param($h,$l)
    if ([UiaWin]::IsWindowVisible($h)) {
      $q = [int][UiaWin]::P($h)
      if ($pids.ContainsKey($q)) { [void]$script:wl.Add([pscustomobject]@{ H=[int64]$h; PID=$q; T=[UiaWin]::T($h) }) }
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  return $script:wl
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
    # LegacyIAccessible: usar pelo ID (10018). O TIPO nao existe nesta montagem e referencia-lo
    # lancava "Nao e possivel localizar o tipo" e matava o fluxo a meio.
    $lg = [System.Windows.Automation.AutomationPattern]::LookupById(10018)
    if ($lg -and $el.TryGetCurrentPattern($lg, [ref]$p)) { $p.DoDefaultAction(); return 'Legacy' }
  } catch { /* cai no null */ }
  return $null
}

# O cartao e o no cujo NOME casa com o da extensao E que TEM o botao/toggle dentro.
# (associar subindo a arvore falha: a UIA nao expoe o nome no ancestral do cartao)
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

# A WebUI so expoe ao UIA os nos VISIVEIS (a lista e longa -> cartoes abaixo da dobra nao existem
# para a arvore). Filtrar pela caixa de pesquisa da propria pagina traz o cartao para o topo.
# ATENCAO: o omnibox tambem e um Edit e o nome dele diz "Pesquisar..." -> casar por 'extens'.
function Set-PesquisaExtensoes($root, [string]$texto) {
  foreach ($e in (Find-ByType $root ([System.Windows.Automation.ControlType]::Edit))) {
    if (([string]$e.Current.Name) -match 'extens') {
      try {
        $vp = $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $vp.SetValue($texto)
        return $true
      } catch { }
    }
  }
  return $false
}

$janela = $null

try {
  $antes = Get-ChromeWindows
  # REGRA 11.2: capturar o foreground do dono ANTES do spawn — e devolver depois.
$prevFg = [UiaWin]::GetForegroundWindow()
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--new-window','about:blank' | Out-Null
  $novo = $null
  for ($i = 0; $i -lt 40 -and -not $novo; $i++) {
    Start-Sleep -Milliseconds 300
    $ag = Get-ChromeWindows
    # NAO apanhar o dialogo "Restaurar paginas?" (e uma janela top-level a parte, sem omnibox)
    $novos = @($ag | Where-Object { $antes.H -notcontains $_.H -and $_.T -match 'Google Chrome' -and $_.T -notmatch 'Restaurar|Restore' })
    $novo = @($novos | Where-Object { $_.T -like 'about:blank*' }) | Select-Object -First 1
    if (-not $novo) { $novo = $novos | Select-Object -First 1 }
  }
  if (-not $novo) { throw 'a janela nova --new-window nao apareceu' }
  $h = [IntPtr]$novo.H
  $janela = $h
  $out.window = $novo.T

  # Janela invisivel (alpha 0) mas ACTIVADA: e assim que funcionava. O que a partiu foi eu ter-lhe
  # tirado o foco (SWP_NOACTIVATE + click-through): sem foco o Enter do omnibox falha de forma
  # intermitente. Invisivel != inactiva.
  if ($Invisivel) {
    [void][UiaWin]::SetWindowPos($h, [IntPtr]::Zero, 60, 60, 1280, 900, 0x0040)
    $ex = [UiaWin]::GetWindowLong($h, -20)
    [void][UiaWin]::SetWindowLong($h, -20, ($ex -bor 0x00080000))
    [void][UiaWin]::SetLayeredWindowAttributes($h, 0, 0, 0x2)
    [void][UiaWin]::SetForegroundWindow($h)
  } else {
    [void][UiaWin]::SetWindowPos($h, [IntPtr]::Zero, 80, 80, 1280, 900, 0x0040)
    [void][UiaWin]::SetForegroundWindow($h)
  }
  Start-Sleep -Milliseconds 800

  $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)

  # navegar por omnibox
  $edit = $null
  $edits = Find-ByType $root ([System.Windows.Automation.ControlType]::Edit)
  foreach ($e in $edits) { if (([string]$e.Current.Name) -match 'endere|address|Pesquisar|search') { $edit = $e; break } }
  if (-not $edit -and $edits.Count -gt 0) { $edit = $edits[0] }
  if (-not $edit) { throw 'omnibox nao encontrado' }
  $edit.SetFocus()
  $vp = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  # 3 tentativas: com a janela ACTIVADA o Enter pega, mas a WebUI por vezes ainda nao esta pronta.
  $pronto = $false
  for ($tent = 1; $tent -le 3 -and -not $pronto; $tent++) {
    $edit.SetFocus()
    $vp.SetValue('chrome://extensions')
    Start-Sleep -Milliseconds 500
    [void][UiaWin]::PostMessage($h, 0x0100, [IntPtr]0x0D, [IntPtr]0x001C0001)
    Start-Sleep -Milliseconds 60
    [void][UiaWin]::PostMessage($h, 0x0101, [IntPtr]0x0D, [IntPtr]0xC01C0001)
    for ($i = 0; $i -lt 30 -and -not $pronto; $i++) {
      Start-Sleep -Milliseconds 500
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
      if ((Find-ById $root 'loadUnpacked').Count -gt 0) { $pronto = $true }
    }
    $out.tentativas = $tent
    $out.titulo = [UiaWin]::T($h)
  }
  if (-not $pronto) { throw "chrome://extensions nao renderizou (titulo='$($out.titulo)', sem no loadUnpacked) - ver -Dump" }
  # Ja navegou: a WebUI so precisa de UIA (Invoke/ValuePattern), nao de foreground.
  # Devolver o foco AO DONO imediatamente.
  $out.focoDevolvido = [UiaWin]::RestaurarFg($prevFg)

  if ($Dump) {
    $chk = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($c in $chk) {
      $id = [string]$c.Current.AutomationId; $nm = [string]$c.Current.Name
      if ($id -ne '' -or $nm -match 'programador|developer|Relay|LoL Idle|Recarreg|Ativad') {
        Write-Host ("NODE type={0,-22} id='{1}' name='{2}'" -f $c.Current.ControlType.ProgrammaticName.Replace('ControlType.',''), $id, $nm)
      }
    }
  }

  # 1) garantir devMode LIGADO
  $devEl = (Find-ById $root 'devMode') | Select-Object -First 1
  if (-not $devEl) { throw 'no devMode encontrado em chrome://extensions' }
  $tp = $null
  if ($devEl.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tp)) {
    if ([string]$tp.Current.ToggleState -ne 'On') { $tp.Toggle(); $out.devmode = 'ligado-agora'; Start-Sleep -Seconds 2 }
    else { $out.devmode = 'ja-ligado' }
  } else {
    $out.devmode = Invoke-Elem $devEl
    Start-Sleep -Seconds 2
  }

  # 2) encontrar o CARTAO (e filtra-lo pela pesquisa da pagina, senao fica abaixo da dobra e a
  #    WebUI nem o expoe ao UIA — a lista e longa e virtualizada)
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
  $cartao = Find-Cartao $root $ExtensionName
  # A WebUI re-renderiza a lista: a pesquisa por vezes não pega à primeira. Tentar algumas vezes.
  for ($tent = 1; $tent -le 4 -and -not $cartao; $tent++) {
    if (-not (Set-PesquisaExtensoes $root $ExtensionName)) { break }
    $out.filtrado = $true
    Start-Sleep -Milliseconds 1200
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
    $cartao = Find-Cartao $root $ExtensionName
    $out.tentativasCartao = $tent
  }
  if ($cartao) { $out.cartao = ([string]$cartao.Current.Name).Substring(0, [Math]::Min(60, ([string]$cartao.Current.Name).Length)) }

  # Com o filtro aplicado a pagina mostra UM cartao. Se sobrou exactamente um enableToggle e um
  # dev-reload-button, sao necessariamente os DESTA extensao — nao e preciso adivinhar pelo nome.
  $tgEl = $null; $rel = $null
  if ($cartao) {
    $tgEl = (Find-ById $cartao 'enableToggle') | Select-Object -First 1
    $rel  = (Find-ById $cartao 'dev-reload-button') | Select-Object -First 1
  } else {
    $tgs = Find-ById $root 'enableToggle'; $rels = Find-ById $root 'dev-reload-button'
    if ($tgs.Count -eq 1 -and $rels.Count -le 1) {
      $tgEl = $tgs[0]
      if ($rels.Count -eq 1) { $rel = $rels[0] }
      $out.cartao = 'por-filtro (1 cartao na pagina)'
    } else {
      throw "cartao de '$ExtensionName' nao encontrado (toggles=$($tgs.Count), reloads=$($rels.Count); usa -Dump)"
    }
  }

  # 3) ligar/desligar conforme pedido (-Desativar serve para o CONTROLo da bisectação)
  if ($tgEl) {
    $tg = $null
    if ($tgEl.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tg)) {
      $out.enabled = [string]$tg.Current.ToggleState
      $quer = if ($Desativar) { 'Off' } else { 'On' }
      if ([string]$tg.Current.ToggleState -ne $quer) {
        $tg.Toggle()
        $out.enabled = if ($Desativar) { 'desligado-agora' } else { 'ligado-agora' }
        Start-Sleep -Seconds 3
      }
    }
  }

  # 4) o botao CERTO: dev-reload-button do cartao (re-le a arvore: o cartao muda ao activar)
  # Com -Desativar nao ha nada a recarregar: o objectivo era so desligar.
  if ($Desativar) { $out.clicked = 'nao-aplica (Desativar)' }
  else {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
  if (-not $rel -or $out.enabled -eq 'ligado-agora') {
    $cartao2 = Find-Cartao $root $ExtensionName
    if ($cartao2) { $rel = (Find-ById $cartao2 'dev-reload-button') | Select-Object -First 1 }
    if (-not $rel) {
      $rels2 = Find-ById $root 'dev-reload-button'
      if ($rels2.Count -eq 1) { $rel = $rels2[0] }
    }
  }
  if (-not $rel) { throw "sem dev-reload-button para '$ExtensionName'" }
  $out.clicked = Invoke-Elem $rel
  Start-Sleep -Seconds 2
  # O clique ja foi postado; nao precisamos de foreground para verificar o Secure Preferences.
  $out.focoDevolvido2 = [UiaWin]::RestaurarFg($prevFg)
  }

  $out.ok = $true
} catch { $out.error = $_.Exception.Message }

# --- verificar pelo PERFIL, casando o PATH real da pasta (nunca por nome escrito a mao) ---
# ATENCAO: o Chrome escreve o Secure Preferences com ATRASO. Ler uma vez logo apos o clique da
# 'enabled: null' ou um disable_reasons antigo (ja enganou este script). Polling curto resolve.
try {
  $sp = "C:\Users\Administrador\AppData\Local\Google\Chrome\User Data\Default\Secure Preferences"
  $alvoDir = [System.IO.Path]::GetFullPath($ExtensionDir).TrimEnd('\')
  for ($t = 0; $t -lt 12; $t++) {
    $achou = $false
    try {
      $j = Get-Content $sp -Raw | ConvertFrom-Json
      foreach ($k in $j.extensions.settings.PSObject.Properties.Name) {
        $v = $j.extensions.settings.$k
        $p = "$($v.path)"
        if (-not $p) { continue }
        $pNorm = try { [System.IO.Path]::GetFullPath($p).TrimEnd('\') } catch { $p }
        if ($pNorm -ieq $alvoDir) {
          $out['extension_id'] = $k
          $out['disable_reasons'] = ($v.disable_reasons -join ',')
          $out['path'] = $pNorm
          $achou = $true
        }
      }
    } catch { }
    if ($achou) {
      $mexeu = ($out.enabled -eq 'ligado-agora' -or $out.enabled -eq 'desligado-agora')
      if ($Desativar) { if ($out['disable_reasons'] -ne '') { break } }
      else { if ($out['disable_reasons'] -eq '') { break } }
      if (-not $mexeu) { break }   # nao mexemos em nada: o que esta lido ja e o estado real
    }
    Start-Sleep -Milliseconds 900
  }
  if (-not $achou) { $out['verify'] = "nenhuma extensao com path=$alvoDir" }
} catch { $out['verify_error'] = $_.Exception.Message }

# --- fechar SO a janela que abrimos ---
if (-not $KeepWindow -and $janela) {
  [void][UiaWin]::PostMessage($janela, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
  $out.closed = $true
}

Write-Output ($out | ConvertTo-Json -Compress)
