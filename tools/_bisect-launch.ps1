
$chrome = @("C:\Program Files\Google\Chrome\Application\chrome.exe","C:\Program Files (x86)\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$nossa = "pbdlekcgmpippamdkgbaphcppjafobjo"
$suspeito = $env:SUSPEITO
$permitidas = "$nossa,$suspeito"
"chrome: $chrome | permitidas: $permitidas"
$args = @("--user-data-dir=C:\Temp\ll-bisect","--remote-debugging-port=9336","--no-first-run","--no-default-browser-check","--disable-extensions-except=$permitidas","--load-extension=I:\!lolidle.com\extension","about:blank")
Start-Process -FilePath $chrome -ArgumentList $args
Start-Sleep -Seconds 14
try { 'CDP: ' + (Invoke-WebRequest -Uri 'http://127.0.0.1:9336/json/version' -TimeoutSec 5).StatusCode } catch { 'CDP OFFLINE' }
