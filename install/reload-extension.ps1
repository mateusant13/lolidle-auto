# reload-extension.ps1 — recarrega uma extensão unpacked no chrome://extensions
# pelo botão de reload do cartão, via UIA (sem mexer no mouse nem roubar foco
# além do necessário para abrir a aba).
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File install/reload-extension.ps1 `
#     -ExtensionName "LoL Idle"
#
# 1) abre chrome://extensions numa aba nova (manual_extension_manager_tab.ps1);
# 2) acha a janela do Chrome;
# 3) procura o botão de reload (AutomationId = id da extensão, ou o botão
#    "Recarregar"/"Reload" dentro do cartão cujo nome contém ExtensionName);
# 4) invoca por UIA InvokePattern.
#
# Saída: uma linha JSON.
param(
  [Parameter(Mandatory = $true)][string]$ExtensionName,
  [string]$VodRip = "C:\Users\Administrador\Desktop\Nova pasta (3)\TESTE\VOD.RIP"
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$out = [ordered]@{ ok = $false; window = $null; button = $null; method = $null; error = $null }

function Get-ChromeWindow {
  Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static string Title(IntPtr h){ var s=new StringBuilder(300); GetWindowText(h,s,300); return s.ToString(); }
  public static uint Pid(IntPtr h){ uint p; GetWindowThreadProcessId(h, out p); return p; }
}
"@
  $procs = @{}
  Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $procs[[string]$_.Id] = $true }
  $found = @()
  [W]::EnumWindows({ param($h,$l)
    if ([W]::IsWindowVisible($h)) {
      $t = [W]::Title($h)
      if ($t -match 'xtens' -or $t -match 'xtension') {
        if ($procs.ContainsKey([string][W]::Pid($h))) { $script:hit = $h }
      }
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  return $script:hit
}

try {
  # 1) abre a página de extensões numa aba nova (não toca na aba ativa)
  $tab = Join-Path $VodRip 'backend\scripts\manual_extension_manager_tab.ps1'
  if (Test-Path $tab) {
    & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $tab | Out-Null
    Start-Sleep -Seconds 2
  } else {
    $out.error = "manual_extension_manager_tab.ps1 não encontrado em $tab"
  }

  # 2) acha a janela
  $hwnd = [IntPtr]::Zero
  for ($i = 0; $i -lt 20 -and $hwnd -eq [IntPtr]::Zero; $i++) {
    $hwnd = Get-ChromeWindow
    if ($hwnd -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 300 }
  }
  if ($hwnd -eq [IntPtr]::Zero) { throw 'janela do chrome://extensions não encontrada' }
  $out.window = [W]::Title($hwnd)

  $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  $cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button)
  $buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)

  # 3) escolhe o botão: prioridade para o cartão cujo ancestral contém o nome
  $hit = $null
  foreach ($b in $buttons) {
    $name = [string]$b.Current.Name
    if ($name -match 'Recarregar|Reload') {
      # sobe a árvore até achar um ancestral que mencione o nome da extensão
      $p = $b
      $ok = $false
      for ($d = 0; $d -lt 6 -and $p; $d++) {
        if (([string]$p.Current.Name) -like "*$ExtensionName*") { $ok = $true; break }
        try { $p = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($p) } catch { $p = $null }
      }
      if ($ok) { $hit = $b; break }
    }
  }
  if (-not $hit) { throw "botão de reload do cartão '$ExtensionName' não encontrado entre $($buttons.Count) botões" }

  $out.button = $hit.Current.Name
  $pat = $null
  if ($hit.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pat)) {
    $pat.Invoke(); $out.method = 'InvokePattern'
  } else {
    $leg = $null
    if ($hit.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$leg)) {
      $leg.DoDefaultAction(); $out.method = 'LegacyIAccessible'
    } else { throw 'botão sem pattern invocável' }
  }
  $out.ok = $true
} catch { $out.error = $_.Exception.Message }
Write-Output ($out | ConvertTo-Json -Compress)
