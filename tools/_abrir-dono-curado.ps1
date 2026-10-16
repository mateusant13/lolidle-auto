$pidG = 50536
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# fecha o Chrome do dono (limpar renderer/gpu state) mas grava a lista de abas primeiro
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*User Data*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 6
# abrir com --disable-gpu  (a CURA) mas COM --restore-last-session (onde abre as abas do dono na primeira vez)
$args = @('--user-data-dir=C:\Users\Administrador\AppData\Local\Google\Chrome\User Data','--remote-debugging-port=9224','--no-first-run','--disable-gpu','--disable-gpu-compositing','--restore-last-session')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 24
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }