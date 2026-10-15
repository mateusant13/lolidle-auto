# TK-02-127-EXTRA | P1 | A magnitude do rv fora do scoreSet: montarBuildDe e o ad:0 do perfil mago

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

## O que o worker W9 JA fez (dentro do escopo)
- `scoreSet` (automation.js:5514-5529): `cura/s = dano de AUTO-ATAQUE/s x rv` (motor.js:1226-1228), com `dpsAuto = player().dano x player().va` e `rv` somado no `statsSet` (automation.js:3247/3267/3284). Testes `T127a-d` na suite `score`.
- `player().rv` passou a devolver o valor do painel em fraccao (TK-02-142).

## O que FALTA (fora do escopo)
1. `montarBuildDe`/`valorDeFase`/`pesosItem` **nao** tem o termo de cura: a build IDEAL continua a ser escolhida sem ele. O ticket pede-o la tambem.
2. `pesosItem('mago')` tem `ad: 0` (automation.js:3825) — para a Katarina o AD dos itens vale 0 no perfil, logo o termo de cura (que depende do dano de auto) continua a valer ~0 numa build AP. O ticket aponta isto como a causa raiz e manda "faze-lo depender do peso do AD do perfil (ver TK-02-128)".
3. O PESO 1 cura/s = 1 dano/s (usado no `scoreSet`) e uma heuristica DECLARADA (classe (c)) — se o dono quiser outro peso (a cura vale mais ou menos que o dano), e decisao dele.

## Aceitacao
A mesma % de rv da valores diferentes por base (17 cura/s em AP vs 269 em AD) **e a build de chefe passa a escolher itens com rv quando a cura decide a sobrevivencia**; `bun tools/testes/run.mjs` rc=0. **Ficheiros: `montarBuildDe`/`valorDeFase`/`pesosItem` — de outro worker.**
