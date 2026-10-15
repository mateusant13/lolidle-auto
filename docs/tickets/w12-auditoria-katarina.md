# W12 — AUDITORIA DA KATARINA (TK-02-130)

> Fonte: **`docs/game-src/motor.js` VIVO (3852 linhas)** e **`docs/game-src/kit-katarina-vivo.json`**
> (812 linhas, lido do jogo a 2026-10-14 via relay 9224). Todo o numero tem `file:linha`.
> Nada foi calibrado a mao. AGENTS.md REGRA N.o 1 e N.o 3.

## 1. As 13 habilidades do kit (motor.js:748-784)

O kit tem **13 chaves**: 11 activas + 2 passivas. A `ordem` oficial (motor.js:897) tem
**11** porque as passivas nao entram na barra:

```
ordem: ['N','R','B','M','E','A','G','F','T','Q','W']   // motor.js:897
```

| # | Tecla | Nome | Nivel | Max | Tipo | Modelada pela extensao? | Onde |
|---|---|---|---|---|---|---|---|
| 1 | **P** | Voracidade | - | - | passiva | **SIM (novo, TK-02-130)** | `automation.js` `voracidadeDe`/`curaGiroDe` |
| 2 | Q | Lamina Saltitante | 1 | 10 | dano + **adaga** | SIM | `dpsPorHabilidade` (base/ratio/rec/mult/adaga) |
| 3 | W | Preparacao | 1 | 10 | **adaga** + vel | SIM | `dpsPorHabilidade` (rec/adaga) |
| 4 | E | Shunpo | 1 | 10 | dano | SIM | `dpsPorHabilidade` (base/ratio/**adRatio**/rec) |
| 5 | R | Lótus da Morte | 6 | 5 | canal 2,5 s | SIM | `dpsPorHabilidade` (mult 15, golpes) |
| 6 | G | Sede de Sangue | 8 | 10 | auto + cura | SIM | `dpsPorHabilidade` (auto, curaSede) |
| 7 | A | Adaga Certeira | 13 | 10 | dano + **adaga** | SIM | `dpsPorHabilidade` (adaga) |
| 8 | **D** | Lamina Sinistra | 18 | 10 | **passiva** | **SIM (novo, TK-02-130)** | `curaGiroDe` (curaGiro/vaAdaga) |
| 9 | F | Lamina Envenenada | 23 | 10 | DOT | SIM | `dpsPorHabilidade` (dot/veneno) |
| 10 | T | Chuva de Adagas | 28 | 10 | **adaga** | SIM | `dpsPorHabilidade` (adaga, adagas 3) |
| 11 | B | Passo das Sombras | 33 | 10 | util | SIM (util) | `dpsPorHabilidade` (util) |
| 12 | M | Execucao Noxiana | 38 | 10 | executa | SIM | `dpsPorHabilidade` (base/ratio) |
| 13 | N | Tempestade de Lótus | 45 | 5 | canal 3 s | SIM | `dpsPorHabilidade` (base/ratio) |

**Nao ha habilidade da Katarina por modelar** depois do TK-02-130. As duas que faltavam (P e D)
sao exactamente as duas PASSIVAS — as unicas que o `serialKit`/`aplicarKit` nao deixava passar.

## 2. O que faltava, com prova

### 2.1 A passiva D (curaGiro) nao entrava na sobrevivencia

O motor cura no giro (motor.js:2188-2193):

```js
// motor.js:2183   const d = c.darius, HP = habDe(estado).P, HD = habDe(estado).D, rD = estado.ranks.D;
// motor.js:2184   const bruto = HP.giro(estado.nivel, adEfetivo);
// motor.js:2192   const cura = (HP.curaBase || 0) + (HD?.curaGiro && rD ? HD.curaGiro[rD - 1] : 0);
// motor.js:2193   if (total > 0 && cura > 0) curar(estado, c, a, total * cura);
```

| numero | valor | fonte |
|---|---|---|
| `curaBase` | **0,05** (5% do dano do giro, sempre) | motor.js:749 (`P.curaBase`) |
| `curaGiro` | **0,08 -> 0,17** (8% no rank 1, 17% no rank 10) | motor.js:768 (`serie(0.08, 0.01)`) |
| acumulos de velocidade | **3** | motor.js:768 (`acumMax: 3`) |
| duracao da Sinistra | **3 s** | motor.js:768 (`duracaoSinistra: 3`) |

**Defeito medido:** o `curaGiroDe` da extensao lia `D_.curaGiro(1)` — rank 1
**hardcoded** — e o `curaBase` **nunca chegava** (o `aplicarKit` nao o copiava do
kit). Pior: a cura era calculada no `dpsPorHabilidade` e **nunca passada a ninguem** —
os 6 chamadores de `avaliar` (que decide morre/nao morre e quantas pocoes) passavam
sempre `cura.giro = undefined`. A cura propria da Katarina valia **0** na sobrevivencia.

### 2.2 A Voracidade nao contava as larvas

```js
// motor.js:1811  if (HPk?.voracidade) for (const t of ['Q','W','E'])
//                   d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));
```

O corte **nao tem guarda `i.invocado`** — ao contrario da tarefa, 7 linhas acima:

```js
// motor.js:1808  if (!i.invocado) contarTarefa(estado, c, i.nome, !!i.furioso);  // as larvas NAO contam aqui
```

E as larvas **nao dao loot** (motor.js:1792 `const itens = i.invocado ? [] : [...sortearLoot(...)]`),
logo nao passam pelo log do jogo — que e a fonte do `killTimes` da extensao. Resultado: a
Voracidade cortava 1,5 s por larva e a extensao **nao as contava como abates**.

O Barao invoca **2 larvas** por invocacao (motor.js:3141 `for (let k = 0; k < 2; k++)`) e o
invocar e **1 de 3** mecanicas do rodizio (motor.js:3089/3099/3103), com
`(0+14)+(1,3+9)+(1+9) = 34,3 s` por volta — **3,5 larvas/min**.

### 2.3 O simulador nunca subia a D

`tools/sim-chefes.mjs` excluia a D do criterio de pontos:

```js
// ANTES:  const teclas = Object.keys(H).filter((t) => !H[t].passiva && t !== 'D' && t !== 'P');
```

E o `dpsComRanks` nao incluia o **giro** — logo subir a Q/A/T (as que deixam adaga) ou a D
tinha ganho 0 e a passiva ficava a 0 em **todas** as lutas do simulador.

## 3. A curaGiro quantificada (medida, nao estimada)

Katarina nv29, build do dono (`3175~A,3089+2~B,3100+3~A,3135~A,4629+3~A`), AP 711:

| rank da D | fracao `curaBase + curaGiro[r]` | dano do giro | **cura do giro** |
|---|---|---|---|
| 0 (nao rankada) | 0,05 | 160,0/s | **8,0/s** |
| 4 | 0,05 + 0,11 = 0,16 | 160,0/s | **25,6/s** |
| 6 | 0,05 + 0,13 = 0,18 | 160,0/s | **28,8/s** |
| 10 | 0,05 + 0,17 = 0,22 | 160,0/s | **35,2/s** |

Contra o Barao nv42 (o relatorio do `sim-chefes` passa a mostra-lo):

```
MATA 35 s | pocoes 12 = 690 g | ouro total 16340 g | rv 16% cura 396/s | kit(giro) 10/s
```

A coluna `kit(giro)` e a cura da passiva D **dentro da luta** (motor.js:2169-2170).
Antes desta correccao era invisivel: o relatorio so mostrava a cura do roubo de vida.

## 4. As contas de pocoes/segundos, refeitas com a cura dentro

O ticket dizia: *"a conta que te dei — 35 s com 12 pocoes com lifesteal, 77 s com 62 sem — pode
estar errada, porque falta uma fonte de cura que a personagem tem por si"*.

**A conta mantem-se** (o `sim-chefes` confirma 35 s / 12 pocoes):

| build | segundos | pocoes | ouro |
|---|---|---|---|
| COM roubo de vida | **35,00 s** | **12** | **690 g** |
| SEM roubo de vida | 77,00 s | 62 | 4 960 g |

Porque e que a curaGiro **nao** muda estes numeros? Porque a cura do giro (10/s naquela build) e
pequena face a cura do roubo de vida (396/s) e as pocoes. Mas **deixa de ser invisivel**: passa a
somar-se ao `curaTotal` do `avaliar` (motor.js:2188-2193 dentro do modelo de
sobrevivencia) e ao relatorio. Numa build sem roubo de vida — onde a cura do kit e a UNICA fonte —
o efeito e maior: e exactamente o cenario que o dono descreveu ("a build ideal muda de novo pra
roubo de vida").

## 5. O que mudou (ficheiros)

| ficheiro | mudanca |
|---|---|
| `extension/automation.js` | `aplicarKit` passa a levar `curaBase`/`curaGiro`/`vaAdaga`/`voracidade`; `curaGiroDe` usa o **rank real** da D (nao rank 1); novo `curaGiroS`; a cura entra nos 4 chamadores de `avaliar` que a nao passavam |
| `extension/inject.js` | ja reencaminhava o `curaBase` (o `serialKit` passou a levar todos os primitivos); `hemorragia` do Darius acrescentada ao kit |
| `tools/sim-chefes.mjs` | a D entra no criterio de pontos; o giro e a cura entram no `dpsComRanks`; o relatorio mostra `kit(giro)` |

## 6. Prova

`tools/testes/hud.test.mjs` bloco **H13** (13 assercoes) e **H14** (15 assercoes).

```
H13: curaBase = 0,05 (motor.js:749 P.curaBase)
H13: com a D no rank 1 a fracao e 0,05 + 0,08 = 0,13
H13: com a D no rank 7 a fracao e 0,05 + 0,14 = 0,19 (antes era 0,13: rank 1 hardcoded)
H13: com a D no rank 10 a fracao e 0,05 + 0,17 = 0,22
H13: com a cura do giro ela entra no curaTotal
H13: e o liquido (dano que passa) desce
H13: o tempo de morte estica-se (mais sobrevivencia)
H14: e com 3 abates o MOTOR da 0,74 s (corte directo: 5,24 - 3x1,5)
H14: o chefeInvoca do motor e RECEBIDO (antes ninguem o consumia)
H14: e registado como 2 larvas por invocacao (motor.js:3141)
H14: as larvas entram na contagem de abates/min (antes nao)
```

## 7. Nao feito / incerto (REGRA N.o 6)

1. **Os numeros do ticket para a Hemorragia do Darius** (DOT 125/s nv30, 161/s nv40, 198/s nv50)
   **nao se reproduzem** com uma configuracao unica: a formula do motor (motor.js:1652+1667) com
   `bonusAd` a variar da 99,3/s (nv30), 116,6/s (nv40) e 133,9/s (nv50) contra o Barao
   (armadura 144, pen do kit rank 10). Os valores do ticket exigiriam `bonusAd` de ~303, ~385 e
   ~473 — inconsistentes entre si. **A formula esta implementada como o motor a escreve**; os
   numeros do ticket ficam por reproduzir e nao foram forcados (TK-02-149).
2. **A `pen` do kit na matematica de build chega ao `estimarSet`, ao `statsSet`, ao `valorBuff` e
   ao `efeitosEquipados`** — mas **NAO ao `scoreSet`**, que esta fora do meu write scope (a fila
   proibe-o explicitamente). O `scoreSet` usa `S.pen` (pen MAGICA) no ramo FISICO; o
   defeito e o mesmo do `estimarSet` (corrigido). Fica ticket novo:
   `docs/tickets/extra-TK-02-114.md`.
3. **A leitura de abates/min com as larvas** usa uma janela deslizante de 90 s (2,6 voltas do
   rodizio do Barao). E uma escolha de engenharia, nao um numero do motor — esta documentada e
   testada, mas o dono pode preferir outra janela.

