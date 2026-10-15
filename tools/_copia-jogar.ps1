$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*ll-full*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 3
$args = @('--user-data-dir=C:\Temp\ll-full','--remote-debugging-port=9337','--no-first-run','--no-default-browser-check','--disable-gpu','--load-extension=I:\!lolidle.com\extension','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 22
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9337/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }