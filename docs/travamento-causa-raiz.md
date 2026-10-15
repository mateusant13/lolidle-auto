# TRAVAMENTO DO JOGO — CAUSA-RAIZ (2026-10-15)

## A CAUSA: a CSP da página está a ser REESCRITA por uma extensão

### Prova directa (header Content-Security-Policy, capturado com Network.enable)

**Servidor** (Chrome de teste, porta 9337, `C:\Temp\ll-full`):
```
default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: blob: https:; media-src 'self' blob: data:; connect-src 'self' wss://lolidle...
```

**Chrome do dono** — política DIFERENTE (do console dele, em https://lolidle.com/jogar):
```
script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*
  chrome-extension://d167b952-4eba-45b1-b43d-8a556a0db156/
```
e uma variante com `chrome-extension://09bc4ccc-08d8-4dc3-8393-4e427e8cdb7a/`.
**Nenhuma das duas IDs está no perfil do dono** — a política foi IMPOSTA por outra extensão.

### O erro no console (repetido)
```
Evaluating a string as JavaScript violates the following Content Security Policy directive because
'unsafe-eval' is not an allowed source of script: ... The action has been blocked.
Contexto: https://lolidle.com/jogar
Rastreamento de pilha: automation.js:7534 (every) -> 7549 -> 7581 -> ...
```
A política reescrita **não tem `'unsafe-eval'`** -> **bloqueia `eval`**.

### A CADEIA CAUSAL
1. uma extensão reescreve a CSP do `lolidle.com` (webRequest `onHeadersReceived` ou
   declarativeNetRequest `modifyHeaders`);
2. a política nova **proíbe `eval`**;
3. **o próprio jogo usa `eval`/`new Function`** no arranque -> **bloqueado** -> o arranque não termina;
4. a aba fica **muda a t~4s**: 0% de CPU, sem crash, sem diálogo, servidor a responder —
   **exactamente os sintomas medidos**.

### Porque isto explica TUDO o que ficou por explicar
| Observação | Explicação |
|---|---|
| A nossa extensão parecia inocente | **É inocente**: varridos os 5 ficheiros, ZERO `eval`,
  `new Function`, `Function()`, `import()` dinâmico ou `setTimeout/setInterval` com string. O
  `inject.js:119` já documenta que a CSP o proíbe. O `automation.js:7534` aparece na pilha só
  porque era a tarefa em curso. |
| O perfil COPIADO não travava | a extensão reescritora não veio na cópia (estado/worker) |
| Limpar caches de GPU não resolveu | não é GPU |
| O debugger CDP não era a causa | confirmado |
| As abas pesadas não eram a causa | confirmado |
| 'Começou do nada' | uma extensão **actualizou** e passou a reescrever a CSP |
| Os meus `Runtime.evaluate` devolviam `undefined` | **o `eval` do próprio CDP é bloqueado pela CSP** |

### Extensões do dono com PODER de reescrever headers (`<all_urls>`)
```
VPN Gratis para Chrome — VPN Proxy VeePN   [majdfhpaihoncoakbjgbdhglglocklcgno]   webRequest
Privacy Badger                             [pkehgijcmpdhfbdbbnkijodmdjhbjlgp]   declarativeNetRequest + webRequest
Wayback Machine                            [fpnmgdkabnmadcjpehmlllkndpkmiak]     webRequest
```
**Acção:** desligar a **VeePN** primeiro; se não destravar, **Privacy Badger** e **Wayback Machine**.

### Método que provou (reutilizável)
`Network.enable` + `Page.reload` + ler `Network.responseReceived.response.headers['content-security-policy']`
— **não usa `eval`**, logo funciona mesmo com a CSP bloqueada. Foi isto que separou
«servidor» de «reescrita por extensão». Ferramenta: `tools/_csp-dono.mjs` / `tools/_csp-teste.mjs`.
## CORRECÇÃO (2026-10-15, tarde) — A HIPÓTESE DA CSP FOI REFUTADA POR EXPERIMENTO

Eu tinha proposto: «a CSP reescrita bloqueia algo que o jogo precisa (a Cloudflare) -> o jogo não
arranca». **Testei e está ERRADO.** Duas medições derrubam-no:

1. **O jogo NÃO carrega o desafio da Cloudflare.** No Chrome onde ele funciona (9337):
   `pedidos: 163 | falhados: 0`, e o ÚNICO pedido Cloudflare é o *beacon* de analytics
   (`static.cloudflareinsights.com/beacon.min.js`). Não há `challenges.cloudflare.com`. Logo
   retirar a permissão da Cloudflare da CSP não pode travar o arranque.

2. **O EXPERIMENTO DECISIVO:** interceptei o documento com `Fetch.enable` + `Fetch.fulfillRequest`
   e servi o `https://lolidle.com/jogar` com a CSP **exactamente igual à do dono**
   (`script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*
   chrome-extension://d167b952-.../`). Resultado: **o jogo NÃO travou** — `complete`, `4588 / 4588`
   durante 17,5 s. Ferramenta: `tools/_teste-csp.mjs`.

**Portanto: a CSP reescrita é um FACTO (a política do dono difere da do servidor) mas NÃO é a causa
do travamento.** Fica registado para ninguém repetir este caminho.

### O que continua eliminado (com medição)
| Hipótese | Como foi eliminada |
|---|---|
| A extensão do projeto | 0 `eval`/`Function`/timers-string nos 5 ficheiros; 2 bisectos com stubs; corre em 3 Chromes meus |
| As 58 extensões do dono | perfil copiado com TODAS activas -> não trava |
| Abas pesadas | fechadas 15 -> continua a travar |
| Caches de GPU/shader | apagados 8 -> continua |
| Debugger CDP | ligado num Chrome que funciona -> não trava |
| Relay | derrubado -> continua (e a CSP reescrita também não é) |
| Perfil (IndexedDB/SW, 682 MB) | cópia completa -> não trava |
| **CSP reescrita** | **reescrita por mim, igual à do dono -> não trava** (esta correcção) |

### O que sobra, honestamente
O que distingue o Chrome VIVO do dono das 5 cópias que testei ainda **não está isolado**. O próximo
passo é o que o subagente `fef32ba9` leva: tracing a sério (chrome://tracing / Perfetto / ETW-WPA) no
Chrome do dono, a apanhar o que a thread principal está à espera — em vez de mais uma hipótese.

---
---

# MEDIÇÕES DA SESSÃO 2 — 2026-10-15 14:20 → 15:12 (subagente do fef32ba9)

Tudo o que está abaixo foi **medido nesta sessão**, no Chrome vivo do dono (relay 9224) e no
Chrome de teste (9337, cópia em C:\Temp\ll-full). Nenhuma aba do dono foi fechada, o Chrome do
dono não foi reiniciado e nada do perfil foi apagado. As abas que abri para medir
(?diagD=3, ?diagE=1, ?expx=1) já não existem.

## 1. O bloqueio é REAL e não é do relay nem do debugger

| Medição | Resultado |
|---|---|
| Sonda à aba lolidle.com/jogar?expx=1 — aba criada **sem nunca ligar o debugger** | **5/5 sondas sem resposta** (Runtime.evaluate esgota 4,2 s) |
| Controle: mesma sonda, mesmo relay, aba YouTube do dono | **4/4 vivas** (o relay entrega na mesma) |
| diag-trav.mjs na aba ?diagE=1 (criada por mim) | viva até t=3,1 s (complete, HUD 4588 / 4588, heartbeat a contar), **BLOQUEADA a partir de t=8,8 s**; 153 respostas de rede, **nenhum pedido pendente** |
| diag-trav.mjs na aba ?diagD=3 | **11/11 sondas bloqueadas** (≈4 min depois de carregada) |
| tools/stack-travado.mjs (Debugger.enable + Debugger.pause) sobre a aba travada | pausou: false → o bloqueio está **abaixo do motor de JS** |

**Conclusão:** a thread principal do renderer fica bloqueada a ≈4–9 s depois do complete.
Não é laço de JS, não é excepção, não é o relay, não é o chrome.debugger.

## 2. A CSP NÃO é a causa — três provas independentes

1. **A página não recebe CSP por header.** diag-trav.mjs liga Network.enable e lê
   Network.responseReceived.response.headers: do documento https://lolidle.com/jogar no
   **Chrome do dono** vem `content-security-policy = (nenhum)`. O servidor só manda
   `content-security-policy-report-only` (política *report-only* da Cloudflare, que não bloqueia).
   O mesmo vale no Chrome de teste.
2. **A CSP violada é a do mundo da própria extensão, não a da página.** O evento capturado é
   `[log.error] fonte=security url=chrome-extension://pbdlekcgmpippamdkgbaphcppjafobjo/automation.js:8020`
   — ou seja, dentro do mundo isolado/da extensão. Nada no jogo.js.
3. **O jogo não usa eval.** https://lolidle.com/js/jogo.js (618 752 bytes): **0** ocorrências de
   eval, new Function ou Function(. js/pulso.js (329 bytes) é só
   `setInterval(() => postMessage(0), 250)` (relógio do worker).

O `automation.js:8020` que aparece na stack é `_T.length = 0` (limpeza de timers) — a tarefa
em curso no momento em que a violação foi reportada, não o culpado. Isto fecha a suspeita #1 e #2 do
pedido: **a CSP não é a causa-raiz** (como a secção CORRECÇÃO acima já tinha mostrado).

## 3. As duas "extensões" da CSP NÃO EXISTEM

- `d167b952-4eba-45b1-b43d-8a556a0db156` e `09bc4ccc-08d8-4dc3-8393-4e427e8cdb7a` são **UUIDs**
  (36 caracteres, com dígitos). Um **ID válido de extensão Chrome usa só a–p e nunca tem dígitos**
  (Extension::GenerateId: primeiros 16 bytes do SHA-256 do caminho, mapeados hex → a–p). Os 58 IDs
  do perfil confirmam-no: nenhum tem dígito.
- **Nenhum dos dois está instalado**: não há pasta com esse nome na pasta Extensions do User Data/Default
  do dono nem em C:\Temp\ll-full (procura recursiva no disco), e não surgem em Secure Preferences a não
  ser na lista que o nosso tools/_ids.mjs foi verificar.
- `d167b952-…` é **exactamente** a constante `CSP_DONO` de tools/_teste-csp.mjs — a experiência do
  agente anterior com Fetch.enable + Fetch.fulfillRequest. **Fomos nós que a pusemos lá.**
- Nenhuma extensão do dono pode reescrever a CSP: com webRequest/declarativeNetRequest só há
  VeePN, Privacy Badger, Wayback Machine (+3 com dNR sem tocar em headers) — e a **cópia do perfil com
  as 58 activas não trava**.

**Resposta ao pedido:** não há extensão do dono a reescrever CSP; as duas "extensões" dessa CSP são
UUIDs injectados pelas nossas próprias experiências.

## 4. A extensão do projecto está inocente (verificado por mim, não por resumo)

- automation.js, inject.js, background.js, content.js, gui.js, popup.js:
  **0** ocorrências de eval(, new Function, Function(; a palavra Function tem **0** ocorrências em
  toda a extensão. As 5 ocorrências de "eval" são comentários (automation.js:1089, automation.js:2026,
  inject.js:28, inject.js:119) e o filtro automation.js:8051 que **descarta** esses erros do log.
- Nenhum setTimeout/setInterval com string, nenhum import() dinâmico com string.

## 5. O que distingue os dois Chromes (medido)

- **Linha de comando dos renderers é idêntica** a menos de `--user-data-dir` e
  `--remote-debugging-port` (lido de Win32_Process.CommandLine): ambos com
  `--num-raster-threads=4 --enable-main-frame-before-activation --video-capture-use-gpu-memory-buffer
  --origin-trial-disabled-features=CanvasTextNg|WebAssemblyCustomDescriptors`. Não há flag diferente
  que explique o travamento.
- O relay omp **só se liga a uma aba quando o cliente pede** (background.js:138, op attach); a
  aba criada sem ele também trava → **não é o relay nem o debugger**.
- Diferença real que fica: o **processo GPU do dono** vive desde as 04:08 (PID 36476, 3 208 s de CPU
  acumulada, 65 threads) enquanto o da cópia nasceu às 13:46 — e o dono tem ~15 abas com vídeo
  (Twitch/YouTube/anime) a passar pelo mesmo processo GPU.

## 6. Hipóteses para o bloqueio, ordenadas por probabilidade (com o mecanismo)

**H1 — Bloqueio síncrono do renderer no GPU (a mais provável).**
O jogo é um jogo de canvas 2D e o próprio Chrome regista no Log
`js/pixel.js:105 Canvas2D: Multiple readback operations using getImageData are faster with the
willReadFrequently attribute set to true` — há **readback** de pixels. getImageData num canvas com
backend GPU obriga a uma **sincronização com o GPU**: se o GPU (ou o compositor) não responde, a
thread principal fica em espera, **0 % CPU**, sem crash, sem diálogo, e tanto Runtime.evaluate como
Debugger.pause deixam de responder — exactamente os sintomas medidos. O relógio do jogo é
pulso.js num **worker**, que continua a bater: o servidor responde 0,12–0,17 s e a página fica
complete — daí o "morreu aos 4 s com o HUD cheio".

**H2 — Deadlock de IPC síncrono renderer ↔ GPU/navegador.**
Mesmos sintomas; a stack nativa fica dentro de chrome.dll à espera de uma resposta de
pipe/mojo. Distingue-se de H1 pela stack com símbolos.

**H3 — Estado do perfil/dados do dono.** A cópia é das 12:50 e tem IndexedDB+SW+cookies, mas o
**estado do jogo do dono evoluiu** desde essa hora. A service worker de lolidle pode servir o
documento com um estado que rebenta o arranque. Testa-se carregando o jogo na cópia com a sessão do
dono (a cópia já a tem) vs. com sessão anónima.

**H4 — Estado do processo do navegador vivo há 10 h** (sessões de chrome.debugger órfãs, handles,
fragmentação). Só se vê com ETW + WPA.

## 7. Plano de medição — comandos exactos para a próxima sessão

~~~text
(a) Reproduzir e cronometrar o bloqueio, com o CSP e os erros do documento. Cria uma aba nova,
    não mexe nas existentes. 10 s chegam (bloqueia a ~8 s).
node C:/Temp/ll-full/probe/diag-trav.mjs http://127.0.0.1:9224 "https://lolidle.com/jogar?t1" 10

(b) Confirmar que é o renderer e não o relay: a MESMA sonda noutra aba do dono.
node C:/Temp/ll-full/probe/probe-alvo.mjs http://127.0.0.1:9224 youtube.com 8

(c) Stack nativa de cada thread do renderer travado (sem precisar de WinDbg).
    1) abrir uma aba do jogo e deixá-la bloquear;
    2) descobrir o PID do renderer novo:
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.WorkingSetSize/1MB -gt 60 -and $_.CreationDate -gt (Get-Date).AddMinutes(-2) } |
  Select-Object ProcessId, ThreadCount
    3) correr (dá o módulo de cada quadro de cada thread):
$env:WALK_PIDS = "<pid do renderer>"; & 'C:/Temp/ll-full/probe/stack.ps1'
    Se a stack do fio principal tiver 8+ quadros dentro de chrome.dll = IPC síncrono (H2).
    Se aparecer módulo de GPU/driver (nvgpucomp / d3d11 / nvidia / amd) = H1.
    Se a stack principal tiver só 2-3 quadros = H3/H4.

(d) ETW: gravar o perfil GPU durante a instalação do bloqueio. Precisa do WPA para se ler.
wpr -start GPU -filemode
node C:/Temp/ll-full/probe/diag-trav.mjs http://127.0.0.1:9224 "https://lolidle.com/jogar?t2" 12
wpr -stop C:/Temp/ll-full/probe/gpu.etl

(e) Instalar o Windows Performance Analyzer para ler (d):
winget install -e --id Microsoft.WindowsPerformanceToolkit
    Depois:  wpa C:/Temp/ll-full/probe/gpu.etl   (ver a thread principal do renderer e o que a prende)

(f) Separar H1 de H2/H3 com UM comando sem risco, na cópia (destrutivo é lá):
"C:/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir=C:/Temp/ll-full \
  --remote-debugging-port=9337 --no-first-run --load-extension=I:/!lolidle.com/extension \
  --disable-gpu --disable-gpu-compositing "https://lolidle.com/jogar"
    Se assim NÃO travar (e travar sem estas flags), H1 fica provado.

(g) Separar H3: estado do jogo. Na CÓPIA, apagar o IndexedDB/Service Worker do lolidle e recarregar.
    Se passar a travar, era o estado do dono. (Nunca no perfil do dono.)

(h) Sonda genérica, em qualquer Chrome com CDP:
node C:/Temp/ll-full/probe/probe-alvo.mjs <http-da-cdp> <substring-da-url> <segundos>
~~~

## 8. Ferramentas desta área — o que existe, o que dá e o estado nesta máquina

| Ferramenta | Como se usa | O que mostra | Aqui |
|---|---|---|---|
| CDP pelo relay | node C:/Temp/ll-full/probe/probe-alvo.mjs http://127.0.0.1:9224 <url> <s> | sonda de vida da thread principal; consola; excepções | **funciona** |
| CDP directo (cópia) | probe-alvo.mjs http://127.0.0.1:9337 … | o mesmo, sem relay | **funciona** |
| Diagnóstico completo | diag-trav.mjs http://127.0.0.1:9224 <url> <s> | CSP do documento, excepções, consola, rede, CPU por processo | **funciona** |
| chrome://tracing | abrir chrome://tracing e gravar com as categorias toplevel,v8,ipc,cc,gpu; ou lançar com --trace-startup --trace-startup-file=out.json --trace-startup-duration=12 | fatias por thread de todos os processos; onde o tempo é gasto | precisa de reiniciar o Chrome — **não usar no do dono** |
| Perfetto (ui.perfetto.dev) | arrastar para lá o ficheiro do chrome://tracing | a mesma coisa, com queries SQL e zoom | serve-se do ficheiro acima |
| Categorias de trace do Chrome | --trace-startup --trace-startup-file=… --trace-startup-duration=…; úteis: toplevel, v8, ipc, cc (compositor), gpu, renderer.scheduler, disabled-by-default-devtools.timeline | onde bloqua e em que thread | idem |
| WPR (ETW) | wpr -start GPU -filemode … wpr -stop out.etl (perfis: GPU, CPU, DesktopComposition, GeneralProfile) | actividade do GPU, compositor DesktopWindowManager, amostragem de CPU com stacks | wpr **existe**; o ETL grava-se |
| WPA (ler o ETL) | wpa out.etl | a stack da thread principal com símbolos + linha do tempo do GPU | **NÃO instalado** → instalar (7e) |
| about:gpu | abrir about:gpu | se o processo GPU está vivo, o driver, se houve contexto perdido | legível em qualquer aba |
| chrome://histograms | abrir e procurar GPU, Renderer, Hang | contadores internos (ex. GPU.Renderer.Hang) | legível |
| chrome://crashes | abrir chrome://crashes | se o watchdog do renderer matou algum processo | — |
| Stack nativa sem debugger | C:/Temp/ll-full/probe/stack.ps1 (feito nesta sessão) | stack de cada thread + módulos, via dbghelp | **funciona**, mas sem PDBs do Chrome só dá módulos |
| tools/stack-travado.mjs | node tools/stack-travado.mjs | tenta Debugger.pause | responde pausou:false (o bloqueio é abaixo do JS) |
| Tracing por CDP | Tracing.start / Tracing.end | como chrome://tracing sem reiniciar | **o relay não suporta** (Tracing.end wasn't found) |

## 9. O que eu NÃO consegui fazer (para não passar por feito)

- **Não capturei a stack nativa da thread principal do renderer travado.** Os renderers do dono estão
  constantemente a ser reciclados (o dono abre/fecha abas) e não consegui fixar o PID do renderer da
  aba do jogo durante a janela em que ela fica bloqueada. O stack.ps1 funciona (testado contra um
  processo de teste e contra renderers do dono), mas **sem os PDBs do Chrome** só dá nomes de módulo —
  chega para distinguir GPU vs IPC, não dá a função exacta.
- **Não consegui usar Tracing** pelo relay (não implementado) e **não reiniciei** o Chrome do dono
  para usar --trace-startup (proibido pelas regras).
- **O ETW/WPA** é o caminho que falta: o wpr grava, mas sem WPA instalado não é legível.
- A **stack simbólica** (função dentro de chrome.dll) precisa do WPA + os símbolos do Chrome.

## 10. TL;DR para o dono

1. A página do dono **bloqueia mesmo**, abaixo do motor de JS — provado 21 vezes em 3 abas diferentes.
2. **A CSP é um beco sem saída**: a página não recebe CSP por header; a CSP que aparece é a da própria
   extensão; e as duas "extensões" dessa CSP são **UUIDs que nós injectámos** nas nossas experiências —
   não existem no perfil.
3. **A extensão do projecto está inocente**, verificado directamente no código (0 eval, 0 Function).
4. A causa-raiz está no **renderer bloqueado à espera de algo nativo** — a hipótese nº1 é
   **o GPU (getImageData do canvas + o processo GPU do dono com 10 h e vídeo a passar)**. Prova-se
   com o plano 7f (correr a cópia com --disable-gpu) e 7e (WPA a ler o ETL).
