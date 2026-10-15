
$udd = "C:\Users\Administrador\AppData\Local\Google\Chrome\User Data"
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like "*$udd*" } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 5
$apagados = @()
foreach ($p in @('Default\GPUCache','Default\ShaderCache','Default\DawnGraphiteCache','Default\DawnWebGPUCache','Default\Code Cache','Default\Cache','GrShaderCache','ShaderCache')) {
  $full = Join-Path $udd $p
  if (Test-Path $full) { Remove-Item $full -Recurse -Force -ErrorAction SilentlyContinue; $apagados += $p }
}
'caches apagados: ' + ($apagados -join ', ')
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
Start-Process -FilePath $chrome -ArgumentList @("--user-data-dir=$udd","--remote-debugging-port=9224","--no-first-run","--restore-last-session")
Start-Sleep -Seconds 22
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }
