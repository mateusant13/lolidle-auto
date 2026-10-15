$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# mata APENAS processos da COPIA (nunca o Chrome do dono)
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*ll-full*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 4
$args = @('--user-data-dir=C:\Temp\ll-full','--remote-debugging-port=9340','--no-first-run','--no-default-browser-check','--disable-gpu','--disable-gpu-compositing','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 24
try { 'CDP 9340: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9340/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }