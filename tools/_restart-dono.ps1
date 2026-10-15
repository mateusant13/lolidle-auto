
$udd = "C:\Users\Administrador\AppData\Local\Google\Chrome\User Data"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like "*$udd*" } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 5
$args = @("--user-data-dir=$udd","--remote-debugging-port=9224","--no-first-run","--restore-last-session")
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 22
try { 'CDP 9224: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'CDP OFFLINE' }
