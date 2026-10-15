# extra-TK-02-114 — o `scoreSet` usa a pen MAGICA no ramo FISICO

**Origem**: encontrado no caminho do TK-02-114 (worker W12). **Fora do write scope** do W12 —
a fila `docs/tickets/fila-W12.md` proibe explicitamente mexer no `scoreSet`.

**Ficheiro**: `extension/automation.js` — `scoreSet` (uma linha).

**Prioridade**: P1 (numero falso na decisao de build).

## Evidencia

`statsSet` devolve DOIS campos diferentes:

```js
// automation.js  statsSet():
return { ..., pen, penArmadura, ... };
//   pen          = pen MAGICA     (motor.js:542 `penMagica: Math.min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag)`)
//   penArmadura  = pen de ARMADURA (motor.js:552 `penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1)`)
```

O motor usa-as em ramos DIFERENTES (motor.js:1202):

```js
// motor.js:1202  arm = magico ? (poder ? alvo.armadura * RM_MONSTRO * (1 - (a.penMagica || 0)) : 0)
//                          : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura);
```

O `scoreSet` usa `S.pen` **nos dois ramos**:

```js
// automation.js  scoreSet():
const mit = 100 / (100 + ((META.champAtual && META.champAtual.magia) ? armMagicaEfetiva(alvo?.armadura, S.pen) : (alvo?.armadura || 0) * (1 - S.pen)));
//                                                                                                            ^^^^^^^^^^^^ o ramo FISICO devia ser S.penArmadura
```

Para um campeao AD, `S.pen` e a pen MAGICA — que num conjunto de itens AD e **0** (os itens
AD nao tem `penMag`). Logo o ramo fisico do `scoreSet` aplica **penetracao de
armadura ZERO**, mesmo com o 3036 (Apreender) ou com a E do Darius equipados.

## Correccao (identica a que ja foi feita no `estimarSet` no TK-02-114)

```js
const mit = 100 / (100 + ((META.champAtual && META.champAtual.magia)
  ? armMagicaEfetiva(alvo?.armadura, S.pen)
  : (alvo?.armadura || 0) * (1 - S.penArmadura)));   // <-- pen de ARMADURA (motor.js:552)
```

## Impacto medido (TK-02-114, contra o Barao armadura 144)

| caso | mit |
|---|---|
| sem pen (o que o `scoreSet` faz hoje num AD) | 0,4098 |
| com o 3036 (pen 0,30) | 0,5030 |
| com a E do Darius a rank 10 (pen 0,45) | 0,5580 |
| com a E a rank 10 e o 3036 | 0,6150 |

Ou seja: o `scoreSet` subestima o dano fisico em **+22,7% a +50,0%** conforme os itens.

## Aceitacao

- O ramo fisico do `scoreSet` passa a usar `S.penArmadura`;
- um conjunto com o 3036 da um score MAIOR que o mesmo conjunto sem ele (hoje da igual);
- `bun tools/testes/run.mjs` rc=0 com caso novo.

## Nota

O `estimarSet` (que alimenta o `previaSet` e o `dpsItens`) **ja foi
corrigido** no TK-02-114 pelo W12. O `scoreSet` (que alimenta o `melhorSet` e o
`montarBuildDe`) continua com o defeito — e por isso a build ideal e a previsao de DPS
divergem num campeao AD com pen.

