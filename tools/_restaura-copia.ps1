$dono = 'C:\Users\Administrador\AppData\Local\Google\Chrome\User Data'
$copia = 'C:\Temp\ll-full'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# fechar APENAS a copia (nunca o Chrome do dono)
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*ll-full*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 5
# restaurar o Secure Preferences da copia a partir do perfil do dono (desfaz a minha alteracao)
Copy-Item "$dono\Default\Secure Preferences" "$copia\Default\Secure Preferences" -Force -ErrorAction SilentlyContinue
Copy-Item "$dono\Local State" "$copia\Local State" -Force -ErrorAction SilentlyContinue
'perfil da copia restaurado'
$args = @("--user-data-dir=$copia",'--remote-debugging-port=9340','--no-first-run','--disable-gpu','https://lolidle.com/jogar')
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 26
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9340/json/version' -TimeoutSec 6).StatusCode } catch { 'OFFLINE' }