# _bisect-travamento.ps1 — corre a BISECCAO do travamento sozinho.
#
# Para cada variante: troca o manifest + recarrega a extensao (UIA) e mede a pagina do jogo
# pelo relay (tools\_travamento-cdp.mjs), que sonda a pagina 1x/s. Se a pagina parar de
# responder, esta CONGELADA — e o stall mede isso em ms, sem inferencia.
#
# Uso:
#   powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tools\_bisect-travamento.ps1 `
#     -Variantes vazio,sem-inject,sem-conteudo,completo -Segundos 30

param(
  # A lista vem como UMA string ("vazio,sem-inject,..."): com -File o PowerShell NAO parte
  # uma lista separada por virgulas em varios elementos. Parte-se aqui.
  [string]$Variantes = 'vazio,sem-inject,sem-conteudo,completo',
  [int]$Segundos = 30,
  [string]$Url = 'https://lolidle.com/jogar'
)

$lista = @($Variantes -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$ErrorActionPreference = 'Continue'
$root = 'I:\!lolidle.com'
$resultados = @()

foreach ($v in $lista) {
  Write-Host "`n===== VARIANTE: $v =====" -ForegroundColor Cyan

  $ap = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $root 'install\aplicar-variante.ps1') -Variant $v 2>&1 | Select-Object -Last 1
  Write-Host "aplicar: $ap"

  $saida = (& node (Join-Path $root 'tools\_travamento-cdp.mjs') $Url $Segundos '--abrir' '--fechar' 2>&1 | Out-String)

  $marca = if ($saida -match '"marcaPotion":\s*(?:"([^"]*)"|(null))') { if ($matches[1]) { $matches[1] } else { 'null' } } else { '?' }
  # O marcador DECISIVO: o stub do pulso (inject.js:71) esta instalado? Sem ele o jogo trava sozinho.
  $pulsoFix = if ($saida -match '"pulsoFix":\s*"([^"]*)"') { $matches[1] } else { '?' }
  $bloqueadas = if ($saida -match '"bloqueadas":\s*(\d+)') { $matches[1] } else { '?' }
  $amostras = if ($saida -match '"amostras":\s*(\d+)') { $matches[1] } else { '?' }
  $task = if ($saida -match '"taskFracMedio":\s*([\d.]+)') { $matches[1] } else { '?' }
  $veredicto = if ($saida -match '"veredicto":\s*"([^"]+)"') { $matches[1] } else { '?' }

  $resultados += [pscustomobject]@{
    variante = $v
    scripts = if ($ap -match '"scripts":\[([^\]]*)\]') { ($matches[1] -replace '"', '') } else { '?' }
    marca = $marca
    amostras = $amostras
    bloqueadas = $bloqueadas
    taskFrac = $task
    veredicto = $veredicto
  }

  & node (Join-Path $root 'tools\_fechar-lolidle.mjs') 2>&1 | Out-Null
}

Write-Host "`n===== RESULTADO DA BISECCAO =====" -ForegroundColor Green
$resultados | Format-Table -AutoSize | Out-String | Write-Host
$resultados | ConvertTo-Json -Compress
