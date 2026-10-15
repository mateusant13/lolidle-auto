# INTEGRAÇÃO DO BANCO — o que falta e ONDE está (mapa exacto)

> O merge das 12 frentes foi feito ramo a ramo e o master ficou com **20 asserções vermelhas** em
> 7 suites. Cada peça existe, testada e verde, num ramo — o que falta é transplantá-la para o
> master. Este ficheiro é o mapa (levantado a 2026-10-15, com o banco a correr).
>
> **REGRA APRENDIDA (importante):** ao transplantar, levar SEMPRE as declarações de estado junto
> com as funções (`let _x = ...`, `const X = ...`) e **nunca** cortar um bloco pela "primeira
> linha `  }`" — isso trunca blocos aninhados e desequilibra o ficheiro (aconteceu 2×). Contar
> chavetas, ou transplantar função a função verificando `node --check` depois de cada uma.

## Suites vermelhas e a peça que falta (com o ramo)

| Suite | Asserção (exemplo) | Peça a transplantar | Ramo |
|---|---|---|---|
| `integracao` | `auto.eventosContadores is not a function`; whitelist sem `curvaPorNivel`/`rmMonstro`; `statsMonstro` a ignorar a curva lida | bloco consumidor (`let _estadoVivo` + `estadoVivo/eventosVivos/eventosContadores/consumirEvento`) + `carregarMeta` + `curva()` + exports | **w3-barra** |
| `numeros` | `parseNum("12.3k") === 12300`; `lerVidaHud`; `player().vidaAtual` | `SUFIXO` + `parseNum(raw,suf)` (aceitar sufixo no texto E no 2.º argumento) + `readStats` com sufixo nos grupos + `vidaAtual` no `player()` | **w3-barra** (+ w5-equipar) |
| `barrafase` | `F2: a barra de MOBS difere da de CHEFE` | `barraIdeal` com peso de fase + o campo `alvos` no kit (`aplicarKit`, linha `out[t] = {...}`) | **w3-barra** |
| `score`/`hud` | `statsDePeca`, `infoItem().stats`, rv no `scoreSet`, crit/hemorragia | `statsDePeca`+`pecaConhecida`+`infoItem`+`scoreSet`(rv) — **união** com `statsSet` do w12 (pen do kit, crit, hemorragia, `penArmadura` desestruturado no `estimarSet`) | **w9-score** + **w12-modelo** |
| `w10` | `farmarItem`, `migrarCfg`, `escolherConjunto`, duplicata de lendário com mercado saturado → PROTEGER | `farmarItem*`+`farmarItemIds`+`_farmItem`, `CFG_VER`/`MIGRACOES_CFG`/`migrarCfg`, `escolherConjunto`/`porMelhorBase`, ramo da duplicata com `mercadoSaturado()`, raridade do actor pelo CATÁLOGO, regex do Lojista com sufixo | **w10-config** |
| `w1-regioes` | `nivelMobDe is not a function`; `A4: nivelChefeDe(dragao) sem jogador = 40` | `nivelMobDe`/`nivelChefeDe`+`mediaWaveDe`+`estimarRegiao` fail-closed+`fatorDanoJogador` | **w1-regioes** |
| `fuga` | `W2/W5/W6` (motivo da fuga, `localId` com acento) | `viajarPara`+`proximoGiro`+`localId`+`_giroTent`+`VIAGEM_MAPA_MAX`/`_viagemMapaTent`/`VIAGEM_MAX_TENT` | **w4-fuga** |
| `chefe` | `B1[AD]/B1[AP]: a build IDEAL contem a 3153` | `alvoRef` (fase `null` também promove a peça de chefe) — atenção: é uma **linha dentro de `buildIdealParaFase`**, não uma função | **w11-boss** |

## O que JÁ ficou aterrado e verde nesta sessão
- `tools/sim-chefes.mjs` + `tools/motor-vivo.mjs` do **w7-sims** (lê o motor VIVO; apanhou 3
  divergências reais: CURVA sem o `ajuste`, `NIVEL_DIF` 0,15/3 → 0,35/5, `fatorDanoJogador`
  0,07 → 0,12). Suites `motor-tabelas` (54), `regras-motor` (24) e `snapshots` (18) **verdes**.
- Cofre na Fonte: `COFRE_TILES_ACIMA = 6` (a Tesoureira está em `mundo.js:20` `y: CY - 5`), com
  verificação do `#npcs` a cada tile; suite `cofre` **26/26 verde**.
- 14 suites verdes: regras, ator, barra, objetivo, equip, regioes, pontos, interruptores, cofre,
  planejar, passivas, refinar, atributos, w2-audita*.

## Como fechar (receita)
1. Por cada linha da tabela: `git show <ramo>:extension/automation.js` → extrair a peça **com as
   declarações de estado** → inserir → `node --check` → correr o banco.
2. Uma peça de cada vez. O banco leva ~40 s e diz exactamente qual asserção caiu.
3. Onde duas frentes mexeram na MESMA função (statsSet/scoreSet/estimarSet: w9 × w12), fazer a
   **união** — o w12 traz a pen do kit/crit/hemorragia, o w9 traz o rv e a separação das pens.
