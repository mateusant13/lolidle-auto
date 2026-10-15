# derrubar o relay (atrapalha a porta 9224)
Get-Process bun,omp -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*browser-relay*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 3
$udd = 'C:\Users\Administrador\AppData\Local\Google\Chrome\User Data'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 6
$args = @("--user-data-dir=$udd",'--remote-debugging-port=9224','--no-first-run','--load-extension=I:\!lolidle.com\extension','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 22
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }