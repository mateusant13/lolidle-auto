# COMO USAR O BROWSER (dirigir o Chrome do dono) — verificado 2026-10-16

## 1. Arrancar o relay (a "porta")
```powershell
omp browser-relay serve -p 9224 --no-group
```
- Corre em **background** (não fechar enquanto se trabalha).
- Confirmar: `(Invoke-WebRequest http://127.0.0.1:9224/json/version).StatusCode` -> **200**
- No log aparece: *"Extension connected. The omp browser prelude can now drive your tabs."*
- **Não precisa de reiniciar o Chrome** e **não toca nas abas do dono**.

## 2. Listar as abas
```powershell
(Invoke-WebRequest http://127.0.0.1:9224/json/list).Content | ConvertFrom-Json |
  Where-Object { $_.type -eq 'page' } | Select-Object id, title, url, discarded, active
```
Campos: `id` (usar como targetId), `url`, `title`, `discarded`, `active`.

## 3. Falar CDP (o que funciona)
Ligar a `ws://127.0.0.1:9224/cdp` e usar:

| Comando | Para quê |
|---|---|
| `Target.getTargets` | listar alvos (inclui `attached`) |
| `Target.createTarget {url}` | **abrir aba** (o relay fica "dono" dela) |
| `Target.attachToTarget {targetId, flatten:true}` | obter `sessionId` |
| `Runtime.evaluate {expression, returnByValue:true}` + sessionId | **correr JS e ler o resultado** |
| `Page.navigate {url}` / `Page.reload {ignoreCache:true}` | navegar/recarregar |
| `Target.activateTarget {targetId}` | trazer a aba para a frente |
| `Target.closeTarget {targetId}` | **fechar a aba** (fechar SEMPRE as que abrimos) |

Ferramenta pronta: `bun tools/usar-browser.mjs <abas|criar|avaliar|fechar|batimento>`

## 4. Limitações MEDIDAS (não perder tempo com elas)
1. **Páginas `chrome://`**: `Target.attachToTarget` **FALHA**. Logo **não se consegue** mexer em
   `chrome://extensions` nem `chrome://settings` por aqui.
2. **Abas que o relay não criou**: se o relay for reiniciado, as abas criadas na sessão anterior
   deixam de poder ser anexadas.
3. `Extensions.loadUnpacked` e outras do domínio `Extensions`: **não existem** no CDP do relay
   (`-32601 wasn't found`). Só existem no CDP **do próprio Chrome** (`--remote-debugging-port`).
4. **Segurança**: fechar `bun` mata o relay. Reiniciar o relay **não** afeta o Chrome.

## 5. Observar uma página SEM lhe tocar (técnica do batimento)
Serve para saber se uma página está **viva** sem a anexar (anexar pode perturbar a medição):
1. Antes de navegar: `Page.addScriptToEvaluateOnNewDocument` com
   `(function(){var n=0;setInterval(function(){n++;try{localStorage.setItem('__beat',JSON.stringify({n:n,t:Date.now()}))}catch(e){}},1000)})();`
2. `Page.navigate` para a página e **fechar a ligação** (o batimento continua sozinho).
3. Passado o tempo, **ler o LevelDB do disco** (não precisa de anexar):
   `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Storage\leveldb\*.log`
   e procurar `__beat` — o `n` diz **quantos segundos a página viveu**.
   `n=3` = congelou ao 3.º segundo (foi o que medi no jogo).
> Nota: não usar `fetch()` para fora — o **CSP do jogo bloqueia** (`connect-src 'self' wss://lolidle...`).
> O `document.title` também não serve: **o jogo escreve lá** (`<conta> · LoL Idle`).

## 6. Regras de ouro (aprendidas à força)
- **Fechar sempre as abas que abrimos**, antes de abrir a seguinte.
- **Nunca** fechar, reiniciar ou matar o Chrome do dono sem autorização explícita.
- Antes de afirmar "está travado", confirmar com o **controlo**: sondar **outra aba** do dono
  (YouTube) pelo mesmo caminho — se ela responde, o relay está bom e a aba é que está bloqueada.
