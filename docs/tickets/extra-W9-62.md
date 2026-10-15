# TK-02-62-EXTRA | P1 | O inject.js tem de reencaminhar o RM_MONSTRO (o 0,6 e copia a mao)

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

## Evidencia
- `extension/automation.js:1045`: `const rmMonstro = () => numOr(META.rmMonstro, 0.6);   // motor.js:1179`
- `extension/automation.js:1003` (`carregarMeta`): a whitelist de chaves do META **nao tinha `rmMonstro`** — o worker W9 acrescentou-a, para o valor, quando chegar, ser HONRADO (teste `score`: `T62c`, com `META.rmMonstro = 0.5` o `armMagicaEfetiva(104,0)` passa de 62,4 para 52).
- Mas o `inject.js` (mundo MAIN) **nao le nem envia** `RM_MONSTRO` do motor: `grep -n "rmMonstro\|RM_MONSTRO" extension/inject.js` -> 0 resultados. Logo, hoje, o valor efectivo e sempre o 0,6 do fallback — uma copia congelada (Regra Nº 3: um nerf/buff no jogo passa em claro).

## Fazer
Em `extension/inject.js`, no bloco que monta o `meta` (a seguir ao `import('https://lolidle.com/js/motor.js')`), ler `M.RM_MONSTRO` e incluir `rmMonstro: M.RM_MONSTRO` na mensagem `__lolidleAuto: 'meta'`. O lado que recebe ja esta pronto (W9).

## Aceitacao
`META.rmMonstro` ao vivo = `motor.js:1179` (0,6 hoje); um teste com dois valores diferentes prova que o numero e lido. **Ficheiro: `extension/inject.js` — fora do write scope da fila W9.**
