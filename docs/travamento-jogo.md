# O TRAVAMENTO DO JOGO — CAUSA ENCONTRADA (2026-10-15)

## Resposta em uma linha
**É uma EXTENSÃO do Chrome do dono** (não a nossa, não o jogo). Provado por exclusão:

| Experimento | Resultado |
|---|---|
| Aba nova do jogo, **Chrome do dono** (com todas as extensões) | responde a t=1s/t=2s e **fica muda de t=3s em diante**, sempre; CPU da máquina **0%** (thread bloqueada) |
| **Bisect 1 e 2** — os 4 content scripts DA NOSSA extensão substituídos por stubs | travamento **IDÊNTICO** → a nossa extensão está inocente |
| **Chrome LIMPO** (cópia do perfil do dono, `--disable-extensions`) | o jogo **corre**: responde a t=2/4/6/8/10s com `4588 / 4588`, `visibilityState: visible`, e os processos do renderer a **60–110% de CPU** (a renderizar, não bloqueado) |
| Servidor do jogo (curl) | `/jogar` 200 em 0,14s · `/js/motor.js` 200 em 0,17s · `/js/pulso.js` 200 em 0,12s |
| Diálogo JS / crash de renderer | nenhum (`Page.handleJavaScriptDialog`: "No dialog is showing") |

**Conclusão:** alguma extensão do perfil do dono bloqueia a thread principal do jogo. A nossa está
provada inocente (2 bisectos). Suspeito observado no tráfego da página:
`chrome-extension://majdfhpaihoncoakbjgbdhglocklcgno/assets/offer-trigger…js` (uma extensão de
"ofertas" a injectar scripts na página do jogo).

## Como o dono resolve (1 minuto)
1. `chrome://extensions` → desligar as extensões que **não** são a "LoL Idle — Auto Poção".
2. Recarregar `lolidle.com/jogar` → o jogo volta a andar.
3. Se quiser confirmar qual delas: ligar uma a uma e recarregar.

## Como eu reproduzi o Chrome limpo (sem tocar no Chrome do dono)
```powershell
$orig = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$dest = "C:\Temp\ll-clean-profile"
New-Item -ItemType Directory -Force -Path "$dest\Default\Network" | Out-Null
Copy-Item "$orig\Local State" "$dest\Local State" -Force
Copy-Item "$orig\Default\Preferences" "$dest\Default\Preferences" -Force
Copy-Item "$orig\Default\Network\Cookies" "$dest\Default\Network\Cookies" -Force
Copy-Item "$orig\Default\Local Storage" "$dest\Default\Local Storage" -Recurse -Force
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --user-data-dir=$dest --disable-extensions --remote-debugging-port=9334 `
  --no-first-run --no-default-browser-check `
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding `
  --disable-background-timer-throttling `
  --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling `
  https://lolidle.com/jogar
```
Depois: `bun tools/_probe9334b.mjs` (sonda CDP ao 9334; usa o `webSocketDebuggerUrl` de
`http://127.0.0.1:9334/json/list` — um Chrome normal NÃO tem o endpoint `/cdp` do relay).

**Nota de ambiente:** o relay do omp (`omp browser-relay serve -p 9224`) é o que dá o `/cdp`; se ele
cair, `relay offline`/`timeout` em tudo. Religa-se com `omp browser-relay serve -p 9224 --no-group`.
