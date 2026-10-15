# Tickets EXTRA — W10 (defeitos encontrados NO CAMINHO e ARRUMADOS)

> Regra Nº 7 do AGENTS.md: encontrar -> ARRUMAR -> provar -> dizer. Estes três defeitos apareceram
> enquanto se fechavam os tickets da fila W10 (docs/tickets/fila-W10.md) e foram corrigidos no
> mesmo ramo (`w10-config`), com asserção no banco. Não são trabalho pendente: são registo do que
> foi encontrado e do que ficou provado.

## EX-W10-01 | P0 | `parseNum` apagava o sufixo k/M do `fmt` do jogo — ouro, poções e preços lidos errados EM SILÊNCIO

- **Directiva do Lead (2026-10-14 22:01)**, o mesmo bug que o `content.js` tinha.
- **Evidência (fonte):** `cena.js:225` `fmt(n) = n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e4 ? (n/1e3).toFixed(1)+'k' : Math.round(n)`;
  escrito em `#st-ouro` (`jogo.js:6398`), `#hud-vida-txt` (`jogo.js:6203`), no log do farm (`cena.js`, `Loot de {nome}: {ouro} de ouro`)
  e no tooltip do espólio (`jogo.js:3759/3769`).
- **Defeito medido:** `parseNum('12.3k')` = **123** (100x menos) e `parseNum('1.2M')` = 12. O `readGold` tinha a sua
  própria conta do sufixo, mas o `vendaLojista` do tooltip, o ouro/xp do log, as poções e a vida do HUD passavam por ele.
  O `parseBig` (preços do mercado) fazia o inverso: `parseFloat('4.188')` = 4,188 -> **4 de ouro**.
- **Correcção:** um parser só (`numEcra`/`numDe`, `NUM_SUFIXO {k:1e3, m:1e6}`), com o sufixo NOS GRUPOS da regex,
  grupo de 3 casas = MILHAR e grupo com sufixo = decimal. Os grupos de captura das regexes do log e do tooltip
  passaram a apanhar o sufixo. `parseNum` e `parseBig` delegam no mesmo parser.
- **Prova:** `tools/testes/w10.test.mjs` blocos N1/N2/N3 (21 asserções): `'12.3k'`->12300, `'1.2M'`->1200000,
  `'4.188'`->4188, `'9.876 / 12.3k'`->12300, `readGold`/`readPotions`/`player().vida` ponta a ponta, e o escudo
  `'4188 / 5200 (+300)'` -> vida 5200 (o escudo não é a vida máxima).
- **Ficheiros:** `extension/automation.js`, `tools/testes/w10.test.mjs`.

## EX-W10-02 | P0 | O actor do Lojista decidia "lendário" pelo TEXTO da dica — sem acento, um lendário era VENDIDO

- **Evidência:** `automation.js` (`venderBase`): `const lend = /lendário/i.test(dica)`. O texto do slot vem do
  jogo (`jogo.js:192`, `M.NOME_RARIDADE` = 'lendário', com acento), mas a guarda dependia do acento.
- **Defeito medido no banco:** com a dica `'Item Lendario do teste'` (sem acento) o ator **CLICAVA** o lendário
  e mandava-o para o Lojista — contra a regra do dono ("nunca se vende lendario pelo lojista, so pelo mercado").
- **Correcção:** a raridade passa a vir do CATÁLOGO (`catItA.raridade`), com a dica só como fallback (e o fallback
  aceita as duas grafias). O `catIt` que já existia para o componente épico passou a ser a mesma busca.
- **Prova:** bloco L4 de `tools/testes/w10.test.mjs` (4 asserções, com controlo: o épico é clicado na mesma execução).

## EX-W10-03 | P1 | Duplicata de lendário com o mercado SATURADO planeava ANUNCIAR (o plano mentia)

- **Evidência:** decisão do dono corrigida às 22:40 — "lendario repetido -> MERCADO (anunciar). **Sem lugar no
  mercado -> guardar na mochila ate abrir lugar**". O ramo da duplicata (`planBag`) mandava `ANUNCIAR_MERCADO`
  sem olhar à saturação (o ramo do lendário NÃO-duplicado já a olhava).
- **Consequência:** com 10 ofertas vivas o actor tentava anunciar, falhava, e o item ficava na mochila à mesma —
  mas o `n.anunciar` abria uma necessidade que nunca fechava (a mesma classe de defeito dos `n.presente`/`n.tarefa`
  eternos já corrigidos no ficheiro).
- **Correcção:** o ramo da duplicata de lendário consulta `mercadoSaturado()`: saturado -> `PROTEGER` com o motivo
  explícito; com lugar -> `ANUNCIAR_MERCADO` (como antes).
- **Prova:** bloco L2 de `tools/testes/w10.test.mjs` (5 asserções, com o controlo do épico a ir ao Lojista).

---

## Dependência declarada (NÃO é defeito meu — é write scope)

**TK-02-82** (restrição de itens por classe) ficou PROVADO mas não fechado: o bloqueio da build AD/crítico num
campeão AP é `pesosItem('mago').ad = 0` — um perfil de pesos que OUTRO worker está a editar (aparece modificado
no working tree do `master`). O `multClasse` (0,12) e os gates `ehUsavelPeloCampeao` NÃO são o bloqueio:
com o peso 0, o item AD pontua 0 independentemente do multiplicador. O banco prova-o (bloco B1 de
`tools/testes/w10.test.mjs`). Fechar o TK-02-82 exige mexer em `pesosItem` (perfil) ou escolher a build por
DPS medido dentro de `buildIdeal*` — ambos fora do write scope desta fila.
