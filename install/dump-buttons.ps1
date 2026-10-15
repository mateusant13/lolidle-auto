$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
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
$procs=@{}; Get-Process chrome -ErrorAction SilentlyContinue | %{ $procs[[string]$_.Id]=$true }
$script:hit=[IntPtr]::Zero
[W]::EnumWindows({ param($h,$l) if([W]::IsWindowVisible($h)){ $t=[W]::Title($h); if(($t -match 'xtens') -and $procs.ContainsKey([string][W]::Pid($h))){ $script:hit=$h } } return $true },[IntPtr]::Zero)|Out-Null
if($script:hit -eq [IntPtr]::Zero){ Write-Output "NOHIT"; exit 1 }
$root=[System.Windows.Automation.AutomationElement]::FromHandle($script:hit)
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)
$bs=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$cond)
foreach($b in $bs){ $n=[string]$b.Current.Name; if($n -match 'ecarregar|eload|Atualizar|Update'){ Write-Output ("name='$n' id='"+$b.Current.AutomationId+"'") } }
Write-Output "TOTAL=$($bs.Count)"
