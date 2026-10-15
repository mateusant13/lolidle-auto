# TK-02-51-EXTRA | P0 | A build ideal continua a escolher ITEM A ITEM, nao a COMBINACAO completa

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

## Evidencia (estado actual, ficheiro:linha)
- `extension/automation.js:4820-4869` (`montarBuildDe`): a bota e escolhida ISOLADA por `poder()` (`const botas = todos.filter(...).sort(cmp)[0]`) e os 4 lugares restantes por ordem gulosa do mesmo `poder()` item a item. Nao ha, em lado nenhum, uma comparacao do CONJUNTO.
- O `poder()` soma stats lineares: `(it.penMag||0)*pesos.penMag` — nao modela o TECTO de pen magica (motor.js:542 `Math.min(0.6, (tem('3135')?0.4:0) + pct.penMag)`) nem o CDR so nas habilidades (motor.js:1398/3236). Dois itens de pen valem, para ele, a soma dos dois — no jogo o 2.o e cortado pelo tecto.
- MEDIDO (sonda com o catalogo REAL de 108 itens, campeao AP, `buildIdeal()`): `["3175","3089","3135","3100","6653"]`. A bota de pen (3175) JA entra (desde que o `pesosItem.penMag` foi acrescentado), mas a escolha do 5.o lugar nao foi comparada como conjunto.
- `tools/sim-build.mjs` (a prova que o ticket pede) **nao corre** contra o motor vivo — ver `extra-W9-87.md`. Sem ele nao ha referencia independente.

## Fazer
Trocar a escolha gulosa por uma comparacao de CONJUNTO: para cada bota candidata, encher os 4 lugares e pontuar o conjunto com um modelo que (a) aplique o tecto de pen (motor.js:542) e de CDR (motor.js:550), (b) aplique o CDR so a parcela das habilidades (`scoreSet` ja o faz, automation.js:5472-5479). Fica no `montarBuildDe`/`buildIdeal*` — **funcoes de outro worker** (a fila W9 proibe-as explicitamente).

## Aceitacao
A build ideal para um campeao AP contem a opcao dominante (bota de pen + Impeto) quando ela domina; o teste compara com os numeros do simulador (depois de `extra-W9-87` estar corrigido); `bun tools/testes/run.mjs` rc=0.
