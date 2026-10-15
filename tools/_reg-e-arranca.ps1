$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*ll-full*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 5
& 'H:\bun\bin\bun.exe' 'I:\!lolidle.com\tools\_registar-ext.mjs'
Start-Sleep -Seconds 2
$args = @('--user-data-dir=C:\Temp\ll-full','--remote-debugging-port=9340','--no-first-run','--disable-gpu','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 26
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9340/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }