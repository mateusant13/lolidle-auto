# aplicar-variante.ps1 — biseccao do travamento: troca o manifest da extensao por uma variante
# e RECARREGA a extensao no perfil real (via UIA, ver AGENTS.md 10.6).
#
# Variantes (install/variantes/):
#   completo       -> todos os content scripts (estado normal)
#   vazio          -> NENHUM content script. E o CONTROLO: mesmo shell, zero codigo na pagina.
#   sem-inject     -> sem o inject.js (hooks no MAIN world: Worker/pulso, fillText, sincronizar, evento)
#   sem-conteudo   -> sem content.js e sem gui.js (pocao + painel)
#   sem-automation -> sem automation.js (motor de autoplagem/mercado)
#
# Uso:
#   powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File install\aplicar-variante.ps1 `
#     -Variant sem-inject [-NoReload]
#
# IMPORTANTE: cada variante MANTEM o mesmo id (o id de uma unpacked vem do caminho da pasta),
# logo o chrome.storage e a config sao os mesmos. So o codigo carregado muda.

param(
  [ValidateSet('completo', 'vazio', 'sem-inject', 'sem-conteudo', 'sem-automation')]
  [string]$Variant = 'completo',
  [string]$ExtensionName = 'LoL Idle',
  [switch]$NoReload
)

$ErrorActionPreference = 'Stop'
$root = 'I:\!lolidle.com'
$src = Join-Path $root "install\variantes\manifest-$Variant.json"
$dst = Join-Path $root 'extension\manifest.json'

if (-not (Test-Path $src)) { throw "variante inexistente: $src" }
$j = Get-Content $src -Raw | ConvertFrom-Json   # valida o JSON antes de tocar no real
Copy-Item $src $dst -Force

$out = [ordered]@{ ok = $true; variant = $Variant; manifest = $dst; scripts = @($j.content_scripts | ForEach-Object { $_.js -join '+' }); reloaded = $false }

if (-not $NoReload) {
  # -ExtensionDir e OBRIGATORIO na pratica (ver AGENTS.md 10.6): e o que casa o `path` do
  # Secure Preferences e faz a verificacao dizer a verdade. Sem ele, o script ja confirmou o
  # 'LoL Idle' quando se pedia o relay.
  $dir = Join-Path $root 'extension'
  $r = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $root 'install\recarregar-extensao-uia.ps1') -ExtensionName $ExtensionName -ExtensionDir $dir -Invisivel 2>&1 | Select-Object -Last 1
  $out.reload = $r
  $out.reloaded = ("$r" -match '"ok":true')
}

Write-Output ($out | ConvertTo-Json -Compress)
