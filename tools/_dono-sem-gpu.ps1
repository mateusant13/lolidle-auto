$udd = 'C:\Users\Administrador\AppData\Local\Google\Chrome\User Data'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 6
# --disable-gpu: tira o GPU da equacao (H1). Se deixar de travar, esta provado.
$args = @("--user-data-dir=$udd",'--remote-debugging-port=9224','--no-first-run','--disable-gpu','--disable-gpu-compositing','--disable-software-rasterizer','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 26
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }