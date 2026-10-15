# TK-02-150-EXTRA | P1 | Escudos fora da vida efectiva do `avaliar` (a parte da pen o W9 arrumou)

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

## O que o worker W9 JA fez (dentro do escopo: "pen (penArmadura/penMag)")
- `estimarSet` (automation.js:3310-3315) e `scoreSet` (automation.js:5456-5457): a pen MAGICA so entra no ramo MAGICO; o ramo FISICO passou a usar `S.penArmadura` (motor.js:539) em vez de `S.pen`. Testes `T150a-b`.
- `statsSet` deixou de truncar a pen de armadura em 0,7 (tecto que o motor nunca aplica; motor.js:539 compoe `1-(1-penE)x0,7` -> max 0,835).

## O que FALTA (fora do escopo)
- `avaliar` (a sobrevivencia) usa so `player().vida`: os ESCUDOS ficam de fora da vida efectiva. Escudos que o ticket cita: Fluxo do Yasuo `80 + 28 x nivel` = 1.480 no nv50 (+37% de vida), Taric F 1.200, Zac G 800, 3053 ~1.000, 3157/3026. O `motor.js:1229` soma o escudo a vida efectiva (`(+N)` no `#hud-vida-txt`).
- `avaliar` nao esta no write scope da fila W9.

## Aceitacao
`avaliar` conta os escudos (Fluxo do Yasuo = +1.480 no nv50) e a sobrevivencia muda onde o escudo decide; testes novos. **Ficheiro: `avaliar` — de outro worker.**
