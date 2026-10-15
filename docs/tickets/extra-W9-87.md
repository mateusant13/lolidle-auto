# TK-02-87-EXTRA | P0 | O simulador (a referencia independente) NAO CORRE contra o motor vivo

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

## Evidencia (medida agora)
```
$ cd I:/wt/w9-score && bun tools/sim-build.mjs
error: NAO VERIFICADO: Liandry %/s nao encontrado em motor.js
      at extrair (tools/sim-build.mjs:32:21)
      at tools/sim-build.mjs:65:20
```
- `tools/sim-build.mjs:65` espera `if (a.tem?.`6653`)) alvo.queima = { dps: vidaRefItem(alvo) * ([d.]+)` — mas o motor VIVO escreve `motor.js:1222`: `if (a.tem?.('6653')) alvo.queima = donoQueima({ dps: vidaRefItem(alvo) * 0.015, t: 3 }, c);` (a dungeon passou a embrulhar o objecto em `donoQueima(...)`).
- Logo o extractor lanca e o simulador **morre antes de medir nada**. Isto explica o "conflito entre instrumentos" do TK-02-87: a comparacao registada em `docs/hardcodes-build.md` §5 foi feita contra a COPIA VELHA do motor (60+ linhas atras), e contra um simulador que hoje nao corre.

## Fazer (patch de 1 linha em `tools/sim-build.mjs:65`)
```js
// antes
LIANDRY_PCT: extrair('motor.js', MOTOR_SRC, /if \(a\.tem\?\.\('6653'\)\) alvo\.queima = \{ dps: vidaRefItem\(alvo\) \* ([\d.]+)/, 'Liandry %/s'),
// depois (aceita o embrulho donoQueima)
LIANDRY_PCT: extrair('motor.js', MOTOR_SRC, /if \(a\.tem\?\.\('6653'\)\) alvo\.queima = (?:donoQueima\()?\{ dps: vidaRefItem\(alvo\) \* ([\d.]+)/, 'Liandry %/s'),
```
Depois de correr, reconferir TODOS os extractores (o simulador e a unica referencia independente do `scoreSet`) e comparar de novo a ordem das builds.

## Aceitacao
`bun tools/sim-build.mjs` corre ate ao fim com o motor vivo; a ordem das botas (CDR vs pen) sai do simulador e do `scoreSet` iguais ou com a divergencia explicada por `file:linha`. **Ficheiro: `tools/` — fora do write scope da fila W9.**
