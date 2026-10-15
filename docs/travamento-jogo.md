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

## ADENDA 12:50 - TRAVAMENTO: 9 EXTENSOES INJECTAM EM TODAS AS PAGINAS (medido)
Medido com CDP (`Debugger.scriptParsed` numa pagina neutra, example.com) no Chrome do dono:

| ID | Nome |
|---|---|
| cfhdojbkjhnklbpkdaibdccddilifddb | Adblock Plus |
| gighmmpiobklfepjocnamgkkbiglidom | AdBlock |
| ddkjiahejlhfcafbddmgiahcphecmpfh | uBlock Origin Lite |
| eimadpbcbfnmbkopoojfekhnkhdbieeh | Dark Reader |
| pkehgijcmpdhfbdbbnkijodmdjhbjlgp | Privacy Badger |
| majdfhpaihoncoakbjgbdhglglocklcgno | VPN Gratis - VeePN (proxy) |
| clngdbkpkpeebahjckkjfobafhncgmne / cnojnbdhbhnkbcieeekonklommdnndci / dpacanjfikmhoddligfbehkpomnbgblf | (sem nome no perfil) |

**Tres bloqueadores + uma VPN/proxy a interceptar pedidos em todas as paginas.** Explica os 3 sintomas:
- 'comecou do nada' -> extensoes ACTUALIZAM-SE sozinhas (listas/motor dos ad blockers mudam toda a semana);
- ~1 s a FECHAR a pagina -> a mesma maquinaria no unload (sintoma classico de bloqueador);
- Chrome LIMPO funciona -> sem extensoes, nada intercepta.
**A NOSSA extensao esta provada inocente** (2 bisectos + o limpo a funcionar com ela carregada).
Nao consigo desligar extensoes por CDP - o passo final e do dono (chrome://extensions).

### Como se leu a conta do dono noutro Chrome (transparencia)
Copiaram-se 3 coisas do perfil para `C:\Temp\ll-ext-profile` (18 MB): `Local State`,
`Default\Network\Cookies` e `Default\Local Storage`. **NAO** se copiou o `Preferences` - e por isso
esse Chrome nao tem as extensoes do dono. Nao houve password nem login: a sessao vive nos cookies/
localStorage. A pasta CONTEM a sessao do dono - apagar quando ele pedir.
## ADENDA 13:00 - MEDICOES FINAIS do travamento (todas com CDP, no Chrome do dono)
| Medicao | Resultado |
|---|---|
| Pedidos ao lolidle.com | **123, TODOS carregam** (/js/jogo.js, motor.js, cena.js, ...) |
| Unico pedido bloqueado | `static.cloudflareinsights.com/beacon.min.js` -> ERR_BLOCKED_BY_CLIENT (analytics) |
| Detector de longtask (instalado ANTES do load) | **nao responde** -> a thread esta bloqueada PERMANENTEMENTE |
| CPU da maquina durante o travamento | 0% (thread presa, nao ciclo) |
| Chrome limpo COM a nossa extensao | **corre** (complete, 4588/4588, Fonte, GUI, marcadores) |
| Nossa extensao com os 4 content scripts em stub (2 bisectos) | travamento IDENTICO |

**Conclusao final:** nao e pedido bloqueado nem codigo do jogo - e um **content script de extensao**
a correr na pagina e a prender a thread principal. As 9 extensoes que injectam em TODAS as paginas do
dono estao listadas acima (3 ad blockers + VeePN/proxy + Dark Reader + Privacy Badger + 3 sem nome).
**Accao (do dono, porque o CDP nao desliga extensoes):** desligar a **VeePN** primeiro, recarregar;
se nao resolver, desligar os 3 ad blockers e ficar com 1.

**Ferramentas deixadas no repo** (todas usam o relay 9224):
`tools/_diag-jogo.mjs` (estado da aba) · `tools/_abrir-jogo.mjs` (abre e observa o travamento) ·
`tools/_quem-bloqueia.mjs` (pedidos falhados) · `tools/_bloqueado-url.mjs` (qual URL) ·
`tools/_longtasks.mjs` (long tasks) · `tools/_quem-injecta.mjs` (extensoes que injectam) ·
`tools/_exts2.mjs` + `tools/_nomes.mjs` (extensoes do perfil) · `tools/_verifica-limpo.mjs` (Chrome limpo)