
$udd = "C:\Users\Administrador\AppData\Local\Google\Chrome\User Data"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
# 1) fechar TUDO o que e chrome (o dono autorizou reiniciar o chrome "do jeito certo")
Get-Process chrome -ErrorAction SilentlyContinue | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 6
# 2) abrir UM chrome, perfil do dono, porta de debug SEM relay, com a extensao e o jogo
$args = @("--user-data-dir=$udd","--remote-debugging-port=9224","--no-first-run","--load-extension=I:\!lolidle.com\extension","https://lolidle.com/jogar")
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 22
try { 'CDP 9224 (Chrome direto, sem relay): ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }
