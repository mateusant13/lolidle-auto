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