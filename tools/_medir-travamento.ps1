# _medir-travamento.ps1 -- mede se a pagina do lolidle CONGELA, sem CDP e sem relay.
#
# Duas medidas, ambas de fora do browser:
#   1) BATIMENTO NO DISCO: automation.js (timer de 15 s, automation.js:8365) escreve
#      `lolidleAutoPotion:agregado` no chrome.storage.local -> o LevelDB cresce.
#      Se o main thread congelar, o setInterval NAO dispara -> o ficheiro para de crescer.
#   2) CPU do renderer: queimar um core e a assinatura do travamento.
#
# Nao toca em dados do perfil: so abre uma janela invisivel (alpha 0, click-through) e fecha-a.
#
# Uso:
#   powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tools\_medir-travamento.ps1 `
#     -Seconds 90 -Url https://lolidle.com/jogar

param(
  [int]$Seconds = 90,
  [int]$Interval = 5,
  [string]$Url = 'https://lolidle.com/jogar',
  [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
  [string]$Profile = 'C:\Users\Administrador\AppData\Local\Google\Chrome\User Data',
  [string]$ExtId = 'pbdlekcgmpippamdkgbaphcppjafobjo'
)

Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class WM {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte a, uint f);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
  public static string T(IntPtr h){ var s=new StringBuilder(400); GetWindowText(h,s,400); return s.ToString(); }
  public static uint P(IntPtr h){ uint p; GetWindowThreadProcessId(h,out p); return p; }
}
"@

function Get-ChromeWindows {
  $script:acc = New-Object System.Collections.ArrayList
  $ids = @{}; (Get-Process chrome -ErrorAction SilentlyContinue).Id | ForEach-Object { $ids[[int]$_] = $true }
  [WM]::EnumWindows({ param($h, $l)
      if ([WM]::IsWindowVisible($h)) { $q = [int][WM]::P($h); if ($ids.ContainsKey($q)) { [void]$script:acc.Add([pscustomobject]@{ H = [int64]$h; T = [WM]::T($h); Pid = $q }) } }
      return $true }, [IntPtr]::Zero) | Out-Null
  return $script:acc
}

function Get-StoreFile([string]$dir) {
  if (-not (Test-Path $dir)) { return $null }
  return Get-ChildItem $dir -Filter '*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$store = Join-Path $Profile "Default\Local Extension Settings\$ExtId"

$antes = Get-ChromeWindows
$pidsAntes = @{}; (Get-Process chrome -ErrorAction SilentlyContinue).Id | ForEach-Object { $pidsAntes[[int]$_] = $true }

Start-Process -FilePath $Chrome -ArgumentList '--new-window', $Url | Out-Null

$win = $null
for ($i = 0; $i -lt 50 -and -not $win; $i++) {
  Start-Sleep -Milliseconds 300
  $win = Get-ChromeWindows | Where-Object { $antes.H -notcontains $_.H } | Select-Object -First 1
}
if (-not $win) { Write-Output (@{ ok = $false; erro = 'janela nao apareceu' } | ConvertTo-Json -Compress); exit 1 }

$h = [IntPtr]$win.H
# invisivel + click-through + por cima (por cima para nao ficar ocluida e ser throttled)
[void][WM]::SetWindowPos($h, [IntPtr]::Zero, 0, 0, 900, 700, 0x0040 -bor 0x0004)
$ex = [WM]::GetWindowLong($h, -20)
[void][WM]::SetWindowLong($h, -20, ($ex -bor 0x00080000 -bor 0x00000020))   # LAYERED | TRANSPARENT
[void][WM]::SetLayeredWindowAttributes($h, 0, 0, 0x2)

Start-Sleep -Seconds 4
$pidsNovos = @((Get-Process chrome -ErrorAction SilentlyContinue).Id | Where-Object { -not $pidsAntes.ContainsKey([int]$_) })

$samples = New-Object System.Collections.ArrayList
$t0 = Get-Date
$prevCpu = @{}
$lastGrow = 0
$lastLen = -1
for ($k = 0; $k -le $Seconds; $k += $Interval) {
  $f = Get-StoreFile $store
  $len = if ($f) { $f.Length } else { -1 }
  $mtime = if ($f) { $f.LastWriteTime.ToString('HH:mm:ss') } else { '-' }

  $cpu = 0.0
  foreach ($p in $pidsNovos) {
    try { $pr = Get-Process -Id $p -ErrorAction Stop; $c = $pr.CPU } catch { continue }
    if ($prevCpu.ContainsKey($p)) { $d = $c - $prevCpu[$p] } else { $d = 0.0 }
    $prevCpu[$p] = $c
    if ($d -gt $cpu) { $cpu = $d }
  }

  if ($len -gt $lastLen) { $lastGrow = [int]((Get-Date) - $t0).TotalSeconds }
  [void]$samples.Add([pscustomobject]@{ t = [int]((Get-Date) - $t0).TotalSeconds; cpuMax = [math]::Round($cpu, 2); logLen = $len; logMtime = $mtime; cresceu = ($len -gt $lastLen) })
  $lastLen = $len

  if ($k -lt $Seconds) { Start-Sleep -Seconds $Interval }
}

[void][WM]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)

$cresceuUltimo = ($samples | Where-Object { $_.cresceu }).Count
$ultimoCrescimento = ($samples | Where-Object { $_.cresceu } | Select-Object -Last 1).t
$cpuTotal = ($samples | Measure-Object cpuMax -Sum).Sum

Write-Output (@{
    ok              = $true
    url             = $Url
    segundos        = $Seconds
    janela          = $win.T
    pidsNovos       = $pidsNovos
    nAmostras       = $samples.Count
    amostrasQueCresceram = $cresceuUltimo
    ultimoCrescimentoSeg = $ultimoCrescimento
    cpuSomaSeg      = [math]::Round($cpuTotal, 2)
    cpuMediaPorAmostra = [math]::Round($cpuTotal / [math]::Max(1, $samples.Count), 2)
    amostras        = $samples
  } | ConvertTo-Json -Depth 4 -Compress)
