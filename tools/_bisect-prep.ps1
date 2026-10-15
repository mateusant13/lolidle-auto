
$orig = "$env:LOCALAPPDATA\Google\Chrome\User Data"; $dest = "C:\Temp\ll-bisect"
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like '*ll-bisect*' } | ForEach-Object { $_.Kill() }
Start-Sleep -Seconds 2
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path "$dest\Default\Network" | Out-Null
Copy-Item "$orig\Local State" "$dest\Local State" -Force -ErrorAction SilentlyContinue
Copy-Item "$orig\Default\Preferences" "$dest\Default\Preferences" -Force -ErrorAction SilentlyContinue
Copy-Item "$orig\Default\Secure Preferences" "$dest\Default\Secure Preferences" -Force -ErrorAction SilentlyContinue
Copy-Item "$orig\Default\Network\Cookies" "$dest\Default\Network\Cookies" -Force -ErrorAction SilentlyContinue
Copy-Item "$orig\Default\Local Storage" "$dest\Default\Local Storage" -Recurse -Force -ErrorAction SilentlyContinue
'perfil com extensoes pronto: ' + ((Get-ChildItem $dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB).ToString('0.0') + ' MB'
