$udd = 'C:\Users\Administrador\AppData\Local\Google\Chrome\User Data'
$origem = 'C:\Temp\ll-full'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# fechar o Chrome para poder trocar o leveldb
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 6
# BACKUP do Local Storage do dono (seguranca)
$bk = 'C:\Temp\ls-backup-' + (Get-Date -Format 'HHmmss')
if (Test-Path "$udd\Default\Local Storage") { Copy-Item "$udd\Default\Local Storage" $bk -Recurse -Force -ErrorAction SilentlyContinue; 'backup: ' + $bk }
# copiar o Local Storage da copia LOGADA (a sessao do jogo vive ai)
if (Test-Path "$origem\Default\Local Storage") { Remove-Item "$udd\Default\Local Storage" -Recurse -Force -ErrorAction SilentlyContinue; Copy-Item "$origem\Default\Local Storage" "$udd\Default\Local Storage" -Recurse -Force; 'Local Storage copiado da copia logada' } else { 'a copia nao tem Local Storage' }
# arrancar o Chrome do dono: sem GPU (travamento resolvido) + jogo
$args = @("--user-data-dir=$udd",'--remote-debugging-port=9224','--no-first-run','--disable-gpu','--disable-gpu-compositing','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 26
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }