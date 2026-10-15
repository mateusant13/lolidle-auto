# TICKET EXTRA (W11) — `tools/calc-jogo.mjs` esta QUEBRADO: nao corre ha varios dias

**Prioridade**: P1 (a ferramenta que o proprio Lead recomenda no `fila-W11.md` nao funciona)
**Ficheiro**: tools/calc-jogo.mjs (FORA do write scope do W11 - dono: W7)
**Quem encontrou**: worker W11, ao tentar usar a ferramenta para verificar as constantes do motor.

## Evidencia

```
$ bun tools/calc-jogo.mjs --expr "CURVA.hp(30)"
error: "exprPen" has already been declared
    at I:\wt\w11-boss\tools\calc-jogo.mjs:489:13
488 |       const exprPen = L529.slice(...)...
489 |       const exprPen = exprLinha(C, 529, 'penMagica:');
```

Duas declaracoes `const exprPen` no MESMO escopo (linhas 488 e 489 do ficheiro). A linha 488 e
codigo MORTO: o valor que ela calcula nunca e usado (a 489 sobrescreve-o). Qualquer invocacao
do programa - com ou sem `--expr` - morre no arranque com SyntaxError.

## Fazer

Apagar a linha 488 (ou renomear uma das duas). Nada mais: a 489 e a que alimenta o
`penMagica usado na conta da `Q rank 10 da Katarina` (linha 495).

## Aceitacao

`bun tools/calc-jogo.mjs --expr "CURVA.hp(30)"` imprime 489 com o file:linha
(motor.js:283), e `bun tools/calc-jogo.mjs` (relatorio completo) corre sem SyntaxError.

## Nota do W11

O worker W11 contornou o problema escrevendo `tools/testes/motor-fonte.mjs` (le o motor como
texto e extrai `NIVEL_DIF`, `MONSTROS`, `LOCAIS`, `CURVA`, `TETO_VIDA_ITEM`, `RM_MONSTRO`) -
as assercoes da fila W11 dependem de la. Se o W7 quiser, o `motor-fonte.mjs` ja serve de base
para arranjar o `calc-jogo.mjs` sem duplicar o parser.
