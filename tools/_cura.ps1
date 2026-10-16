$ErrorActionPreference = 'Continue'
# derrubar o relay actual (se estiver vivo)
Get-Process bun,omp -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*browser-relay*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 2
$udd = 'C:\Users\Administrador\AppData\Local\Google\Chrome\User Data'
# REMOVER a vulnerabilidade: apagar a pasta .cache da GPU e a do Code Cache que ja sabe estar stale
foreach ($p in @('Default\GPUCache','Default\Code Cache','Default\Cache')) {
  $full = Join-Path $udd $p; if (Test-Path $full) { Remove-Item $full -Recurse -Force -ErrorAction SilentlyContinue; Write-Output ('limpo: ' + $p) }
}
# arrancar Chrome DO DONO com o GPU desligado (a cura provada 3x com --disable-gpu) + extensao
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 5
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$args = @("--user-data-dir=$udd",'--remote-debugging-port=9224','--no-first-run','--disable-gpu','--disable-gpu-compositing','--load-extension=I:\!lolidle.com\extension','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 30
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }