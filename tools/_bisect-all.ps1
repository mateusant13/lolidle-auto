
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*ll-bisect*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 3
# TODAS as extensoes do dono activas (sem --disable-extensions-except) + a nossa carregada
$args = @("--user-data-dir=C:\Temp\ll-bisect","--remote-debugging-port=9336","--no-first-run","--no-default-browser-check","--load-extension=I:\!lolidle.com\extension","about:blank")
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 16
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9336/json/version' -TimeoutSec 5).StatusCode } catch { 'CDP OFFLINE' }
