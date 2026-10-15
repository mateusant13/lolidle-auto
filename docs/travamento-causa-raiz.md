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