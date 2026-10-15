# TK-02-63-EXTRA | P1 | A mesma passiva vale 3x: texto x multEsp(1,25) x PESO_FASE.itens(1,35)

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

## Evidencia (estado actual, ficheiro:linha)
- `extension/automation.js:4302` (`valorDeFase`): `const v = (stats*multDef + valorPassiva(base) + sinergiaDe(base,ctx)) * multClasse * multRar * multEsp;`
- `extension/automation.js:4305`: `const bonus = fase ? bonusItemFase(base, fase) : 1; return bonus === 1 ? v : v * bonus;`
- MEDIDO (sonda, catalogo real, campeao AP, fase 'chefe'): `valorPassiva('3135')` = 280 (40% x 7) e `valorDeFase('3135', null, 'chefe')` = 280 x 1,25 (multEsp) x 1,35 (PESO_FASE.itens['3135']) x 1,6 (multRar) + stats = 1061. Os 472 de "palpites" do ticket sao 280 x 1,25 x 1,35 = 472,5.
- O motor NAO tem nenhum destes factores: `multEsp` (1,25) e invencao assumida (docs/hardcodes-build.md G4), `PESO_FASE.itens` e calibracao assumida (G5). Multiplicar os tres amplifica o erro de cada um.

## Fazer (2 linhas, nao tocar no `valorPassiva` em si)
Em `valorDeFase`/`montarBuildDe`: a PASSIVA entra como termo ADITIVO, coberto so pelo gate de CLASSE (obrigatorio — foi bug medido o Rabadon contar num Yasuo), e NAO por `multEsp` nem por `bonusItemFase`. Ex.:
```js
const vPassiva = valorPassiva(base) * (fase ? bonusItemFase(base, fase) : 1);   // a fase e a UNICA opiniao extra sobre a passiva
const v = ((stats * multDef + sinergiaDe(base, ctx)) * multEsp + vPassiva) * multClasse * multRar;
```
(fase 'mobs' sem entrada na tabela -> a passiva fica so com o texto; o valor do 3135 passa de 1061 para ~677.)

## Aceitacao
Teste a mostrar o valor do 3135 sem os +472 de palpites; `auditoriaPassivas().duplas.length === 0` continua a valer; `bun tools/testes/run.mjs` rc=0. **Ficheiros: `valorDeFase`/`montarBuildDe` — de outro worker.**
