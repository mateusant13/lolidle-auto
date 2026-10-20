# Detectabilidade — o que está humanizado e o que continua detectável

> Data: 2026-10-20. Pedido do dono: *"ta usando valor fixo, e nao random. faz variacao. e isso é em
> tudo. (...) Report whether everything detectable has been humanized."*
>
> Resposta curta: **não, nem tudo está humanizado.** As pausas, cadências, preços de anúncio, lote do
> cofre e a caminhada passaram a variar. Mas há **três sinais estruturais** que uma página pode ler e
> que nenhuma variação de tempo esconde: `isTrusted=false`, o guard anti-bot neutralizado e o painel
> `#lolidle-ap` no DOM. Isto é humanização, **não invisibilidade**.

## 1. O que passou a variar (e onde)

| Comportamento | Antes | Agora | Fonte |
|---|---|---|---|
| Espera entre acções | valor cravado | ±20 % em qualquer espera ≥ 40 ms | `extension/automation.js:3251-3255` |
| Espera "humana" | base + jitter | 0,55×–1,50× da base | `extension/automation.js:3257` |
| Cadência de tarefa/refino/montar/comprar | 5/30/30/10 min cravados | ±18 % | `automation.js:3259`, `:3942`, `:3956`, `:3999`, `:4009`, `:9329` |
| Cadência do cofre (ler + vender lixo) | 10 min cravados | ±15 % | `automation.js:3984`, `:3993` |
| Preço de anúncio | sempre 90 % do menor | 88 %–92 % | `automation.js:3261`, `:5765`, `:7131` |
| Lote de lixo do cofre | sempre 8 | 5–8 por passagem | `automation.js:4624-4625` |
| Caminhada na Fonte | linha recta | x aleatório no tile, lado alternado, y ±0,12 tile | `automation.js:3305-3308`, `:3376-3386`, `:3427-3429` |
| Clique no canvas | só `mousedown` | `mousemove → mousedown → mouseup`, jitter sub-pixel | `automation.js:3313-3343` |
| Soltar tecla | 60 ms fixos | 60–150 ms | `automation.js:248-252` |
| Regresso/giro | 8 s / 9 s / duração fixa | 6,5–10 s / ±18 % / ±18 % | `automation.js:3076`, `:8478`, `:8486` |
| Polling de diálogo (`waitFor`) | 120 ms fixos | herda o jitter global | `automation.js:3264` |

**O que NÃO se randomiza de propósito:** números do motor (dano, cura, preço de venda, limiar de
poção, mínimo de mercado). Randomizar mecânica seria inventar regra que o jogo não tem — proibido pela
REGRA Nº 1/3. A variação é de **comportamento**, não de matemática.

## 2. O que continua detectável (sem eufemismo)

| # | Sinal | Onde | Porque não está resolvido |
|---|---|---|---|
| 1 | `event.isTrusted === false` em todos os cliques/teclas | `automation.js:3313-3343` (`new MouseEvent`), `:248-252` (`new KeyboardEvent`) | O DOM não permite a uma extensão forjar eventos confiáveis. É o sinal mais forte e **não tem solução dentro da extensão**. |
| 2 | Guard anti-bot do jogo **neutralizado** | `inject.js:63-83` | O listener que conta `cliquesFalsos` deixa de ser registado. A página pode detectar que o guard não corre (ou que `EventTarget.prototype.addEventListener` foi substituído). |
| 3 | Globais do MAIN world | `inject.js:65-66` (`__lolidleGuardHook`, `__lolidleGuardNeutralizado`), `:120` (`__lolidlePulsoFix`) | São propriedades de `window` visíveis a qualquer script da página. |
| 4 | `window.Worker` substituído | `inject.js:103-119` | `Worker.toString()` devolve a função de substituição; o construtor nativo não é o mesmo. |
| 5 | Painel `#lolidle-ap` no DOM | `gui.js:682-685` | O content script injecta o painel no documento da página; um script do jogo vê o nó, o CSS e os `id`s. |
| 6 | Mensagens `postMessage` com prefixo `__lolidle` | `inject.js:199`, `:428`, `:528`, `:542` | Qualquer listener de `message` na página vê o tráfego. |
| 7 | Loops internos com intervalo fixo | `automation.js:9546` (`setInterval(tentar, 1500)`), `:9825` (`every`) | São polling de controlo, não "pausas humanas"; variar cada tick não muda a assinatura e complica o determinismo. |
| 8 | Extensão e origem `chrome-extension://` | Manifesto/content script | A página pode ver que está a correr numa extensão (CSP, `chrome-extension://` em recursos, etc.). |

## 3. O que foi corrigido nesta passagem (não é detectabilidade, é defeito)

- **NPCs na Fonte**: o botão estático de `#npcs` está oculto (`jogo.js:7025`). `curarBase`,
  `aceitarTarefa`, `entregarTarefa`, `aceitarDiarias` e as três funções do Ornn só chamavam
  `clickNPC(...)`; na Fonte isso não abria nada. Passaram a usar `abrirNpc(...)`
  (`automation.js:3270-3275`), que só aceita o caminho estático **se a opção aparecer** e, caso
  contrário, clica no NPC pela posição real (canvas). `curarBase` ainda clica `[data-palavra="curar"]`
  (`automation.js:3440-3446`) — antes só abria a conversa e dizia `true`.
- **Pausa a sério**: `comprarNoMercado` e `vigiarMercadoPasso` passaram a consultar `pausado` antes de
  clicar em comprar (`automation.js:7944`, `:7996-7998`, `:8208`). O Eco de Luden de 100.000 comprado
  ~2,5 s depois de `pausar()` foi uma compra **já em voo**; agora a confirmação é abortada se a pausa
  chegar antes do clique.

## 4. Veredicto

- **Tempo/posição/preço/lote:** humanizados e variáveis.
- **Eventos sintéticos:** continuam `isTrusted=false`. **Não é humanizável** por uma extensão.
- **Guard/Worker/globais/painel:** continuam detectáveis por desenho. Esconder isso exigiria sair da
  extensão e entrar em território de cheat/IK — que o dono proibiu.

**Portanto:** a extensão está mais parecida com um humano no *ritmo*, mas **não é indistinguível** de
automação para quem inspeccione o DOM, os eventos ou o `window`. Se o jogo passar a validar
`isTrusted`/integridade do `Worker`/ausência do guard no servidor, a extensão será detectada — e a
resposta certa será dizê-lo, não vender "invisibilidade".
