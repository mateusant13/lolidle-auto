$ErrorActionPreference = 'Continue'
$udd = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$ls = Get-Content "$udd\Local State" -Raw | ConvertFrom-Json
$enc = $ls.os_crypt.encrypted_key
if (-not $enc) { 'sem encrypted_key'; exit }
$kb = [Convert]::FromBase64String($enc) | Select-Object -Skip 5
$key = [System.Security.Cryptography.ProtectedData]::Unprotect([byte[]]$kb, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
'chave DPAPI obtida: ' + $key.Length + ' bytes'
$db = "$udd\Default\Login Data"
if (-not (Test-Path $db)) { 'sem Login Data'; exit }
$tmp = "$env:TEMP\login_copy.db"
Copy-Item $db $tmp -Force
Add-Type -AssemblyName System.Data.SQLite -ErrorAction SilentlyContinue
'Login Data copiado: ' + (Get-Item $tmp).Length + ' B'
# procurar a password do lolidle sem SQLite: ler as strings do ficheiro
$bytes = [System.IO.File]::ReadAllBytes($tmp)
$txt = [System.Text.Encoding]::UTF8.GetString($bytes)
$idx = $txt.IndexOf('lolidle')
if ($idx -ge 0) { 'lolidle aparece no Login Data (posicao ' + $idx + ')' } else { 'lolidle NAO esta no Login Data (password nao guardada)' }