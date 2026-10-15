$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$tab = "C:\Users\Administrador\Desktop\Nova pasta (3)\TESTE\VOD.RIP\backend\scripts\manual_extension_manager_tab.ps1"
& powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $tab | Out-Null
Start-Sleep -Seconds 3
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class W2 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static string Title(IntPtr h){ var s=new StringBuilder(300); GetWindowText(h,s,300); return s.ToString(); }
  public static uint Pid(IntPtr h){ uint p; GetWindowThreadProcessId(h, out p); return p; }
}
"@
$procs=@{}; Get-Process chrome -ErrorAction SilentlyContinue | %{ $procs[[string]$_.Id]=$true }
$script:hit=[IntPtr]::Zero
[W2]::EnumWindows({ param($h,$l) if([W2]::IsWindowVisible($h)){ $t=[W2]::Title($h); if(($t -match 'xtens') -and $procs.ContainsKey([string][W2]::Pid($h))){ $script:hit=$h } } return $true },[IntPtr]::Zero)|Out-Null
Write-Output ("WINDOW=" + $script:hit + " TITLE=" + [W2]::Title($script:hit))
if($script:hit -eq [IntPtr]::Zero){ exit 1 }
$root=[System.Windows.Automation.AutomationElement]::FromHandle($script:hit)
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)
$bs=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond)
Write-Output "TOTAL=$($bs.Count)"
foreach($b in $bs){ $n=[string]$b.Current.Name; if($n -match 'ecarregar|eload|Atualizar|Update|Remover|Remove'){ Write-Output ("name='$n' id='"+$b.Current.AutomationId+"'") } }
