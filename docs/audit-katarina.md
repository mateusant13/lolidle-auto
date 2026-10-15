
# FULL AUDIT — KATARINA (tudo o que ela faz, e se a extensão modela)

> **Resposta curta à pergunta do dono ("já fizeste full audit de tudo da Katarina?"): NÃO — até agora. Este ficheiro fecha isso.**
> Escrito em 2026-10-14. Método: ler o `motor.js` **inteiro** no bloco dela (REGRA Nº1 do AGENTS.md), cruzar com o
> tooltip **ao vivo** (`docs/snapshots/katarina.json`) e com os simuladores. Cada número tem `file:linha`.

---

## 0. FONTES, E UMA VERIFICAÇÃO QUE FECHA A QUESTÃO

| Fonte | O que é | Estado |
|---|---|---|
| `docs/game-src/motor.js` (3791 linhas) | o motor do jogo — **é o jogo** | lido por inteiro no bloco dela (`motor.js:731-772`, `motor.js:2142-2287`) |
| `docs/game-src/arena.js` (1789 linhas) | Runeterra / mundo aberto (2.ª cópia das habilidades) | lido (`arena.js:921-1081`, `arena.js:1583-1587`) |
| `docs/snapshots/katarina.json` | medição **AO VIVO** (30 ciclos, 50 lutas, nv 29) | lido e analisado |
| `docs/game-src/dados-katarina.js` | **NÃO EXISTE** | `motor.js:6` importa-o — ver §6 |

### 0.1 A PROVA de que o `motor.js` é a fonte viva (não um resumo)

O jogo **escreve o tooltip a partir do próprio kit** (`motor.js:918-994 efeitosRank`). Comparei os 11 números
que o tooltip ao vivo mostra (`docs/snapshots/katarina.json`) com as séries do `motor.js` — **11 de 11 batem ao
decimal**:

| Skill | Tooltip AO VIVO | `motor.js` | Bate? |
|---|---|---|---|
| Q r10 | `395 + 72%` · recarga `6.85s` | `serie(80,35)[9]=395` · `serie(0.45,0.03)[9]=0.72` · `serie(10,-0.35)[9]=6.85` (`motor.js:738`) | SIM |
| A r5 | `230 + 74%` · `10s` | `serie(90,35)[4]=230` · `serie(0.6,0.035)[4]=0.74` · `serie(12,-0.5)[4]=10` (`motor.js:752`) | SIM |
| E r3 | `80 + 34%` · `+40% do dano de ataque` · `9.2s` | `serie(40,20)[2]=80` · `serie(0.3,0.02)[2]=0.34` · `adRatio:0.4` · `serie(10,-0.4)[2]=9.2` (`motor.js:743`) | SIM |
| R r3 | `58 + 31%` · `15 cortes` · `55s` | `serie(30,14,5)[2]=58` · `serie(0.25,0.03,5)[2]=0.31` · `golpes:15` · `[75,65,55,48,42][2]=55` (`motor.js:746`) | SIM |
| G r1 | `30 + 30%` · `+20% vel. ataque` · `30% de volta` · `20s` | `serie(30,15)[0]=30` · `serie(0.3,0.015)[0]=0.3` · `va serie(0.2,0.02)[0]=0.2` · `curaSede:0.3` · `serie(20,-0.8)[0]=20` (`motor.js:749`) | SIM |
| F r1 | `40 + 25%` (veneno/s) · `16s` | `serie(40,18)[0]=40` · `venenoRatio:0.25` · `serie(16,-0.5)[0]=16` (`motor.js:757`) | SIM |
| W r1 | `+50%` (velocidade) · `14s` | `serie(0.5,0.03)[0]=0.5` · `serie(14,-0.4)[0]=14` (`motor.js:741`) | SIM |
| T r1 | `60 + 40%` · `3 adagas` · `24s` | `serie(60,28)[0]=60` · `serie(0.4,0.03)[0]=0.4` · `adagas:3` · `serie(24,-0.8)[0]=24` (`motor.js:760`) | SIM |
| B r1 | `+100%` próximo golpe · `24s` | `serie(1,0.08)[0]=1` · `serie(24,-0.8)[0]=24` (`motor.js:763`) | SIM |
| M r1 | `200 + 120%` · executa `20%` · `14s` | `serie(200,80)[0]=200` · `serie(1.2,0.07)[0]=1.2` · `serie(0.2,0.01)[0]=0.2` · `serie(14,-0.5)[0]=14` (`motor.js:765`) | SIM |
| N r1 | `90 + 45%` · `12 cortes` · `3s` · `2 adagas` · `75s` | `serie(90,40,5)[0]=90` · `serie(0.45,0.05,5)[0]=0.45` · `golpes:12` · `adagasFim:2` · `[75,66,58,51,45][0]=75` (`motor.js:768`) | SIM |

**Conclusão: o `motor.js` no repositório É o motor que corre no site.** Não é preciso adivinhar nada.

---

## 1. AS 13 HABILIDADES — uma a uma

**Estrutura**: `motor.js:734` `const HKT = DADOS_KATARINA.habilidades;` e `motor.js:735` `const HAB_KATARINA = {...}`.
O `nome` de cada uma vem de `DADOS_KATARINA` (ficheiro ausente, §6); **todos os números** (base/ratio/recarga/
alvos/duração/golpes) são literais no `motor.js`.

**Escala**: `motor.js:772` marca `escalaPoder = true` em `Q,E,R,G,A,T,M,N` — e `motor.js:1201` faz
`if (kit(estado).magia && fonte !== 'ataque' ...) { magico = true; poder = true; }`. Ou seja: **tudo o que ela
faz é dano MÁGICO**, mitigado por `alvo.armadura * RM_MONSTRO * (1 - penMagica)` (`motor.js:1202`; `RM_MONSTRO`
em `motor.js:1179`). Só o **ataque básico** é físico (`fonte === 'ataque'`).

### 1.1 Tabela-mãe (todos os ranks)

| # | Tecla | Nome | Nível | Max | Base por rank | Ratio (×AP) | AD? | Recarga por rank | Custo | Alvos/Golpes/Duração | file:linha |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **P** | Voracidade (passiva) | — | — | `giro = 30 + 19·nível + 1·AP + 0.4·(AD−ADbase)` | 1.0 × AP **e** 0.4 × AD bónus | **SIM (0.4)** | — | 0 | pegaCada 0.35s | `motor.js:736-737` |
| 2 | **Q** | Lâmina Saltitante | 1 | 10 | 80→395 (`serie(80,35)`) | 0.45→0.72 (`serie(0.45,0.03)`) | não | 10→6.85s (`serie(10,-0.35)`) | 0 (sem mana) | **3 alvos** (`alvos:3`) · deixa adaga | `motor.js:738-740` |
| 3 | **W** | Preparação | 1 | 10 | — (**sem dano**) | — | não | 14→10.4s (`serie(14,-0.4)`) | 0 | velocidade 0.5→0.77 (`serie(0.5,0.03)`) por 1.25s · deixa adaga | `motor.js:741-742` |
| 4 | **E** | Shunpo | 1 | 10 | 40→220 (`serie(40,20)`) | 0.30→0.48 (`serie(0.3,0.02)`) | **SIM: `adRatio:0.4`** | 10→6.4s (`serie(10,-0.4)`) | 0 | teleporta; se for a uma adaga, **pega e gira** | `motor.js:743-745` |
| 5 | **R** | Lótus da Morte | 6 | 5 | 30→86 (`serie(30,14,5)`) | 0.25→0.37 (`serie(0.25,0.03,5)`) | não | 75/65/55/48/42 | 0 | **15 golpes**, **3 alvos**, 2.5s | `motor.js:746-748` |
| 6 | **G** | Sede de Sangue | 8 | 10 | 30→165 (`serie(30,15)`) | 0.30→0.435 (`serie(0.3,0.015)`) | não | 20→12.8s (`serie(20,-0.8)`) | 0 | 8s · **vel. ataque +20%→38%** (`va serie(0.2,0.02)`) · **cura 30%** (`curaSede:0.3`) | `motor.js:749-751` |
| 7 | **A** | Adaga Certeira | 13 | 10 | 90→405 (`serie(90,35)`) | 0.60→0.915 (`serie(0.6,0.035)`) | não | 12→7.5s (`serie(12,-0.5)`) | 0 | atordoa 1s · deixa adaga | `motor.js:752-754` |
| 8 | **D** | Lâmina Sinistra (passiva) | 18 | 10 | — | — | não | — | 0 | **vaAdaga** 8%→15.2% ×3 · **curaGiro** 8%→17% · dura 3s | `motor.js:755-756` |
| 9 | **F** | Lâmina Envenenada | 23 | 10 | **veneno/s** 40→202 (`serie(40,18)`) | **veneno 0.25 × AP** (`venenoRatio`) | não | 16→11.5s (`serie(16,-0.5)`) | 0 | 8s de veneno · `venenoT:3` | `motor.js:757-759` |
| 10 | **T** | Chuva de Adagas | 28 | 10 | 60→312 (`serie(60,28)`) | 0.40→0.67 (`serie(0.4,0.03)`) | não | 24→16.8s (`serie(24,-0.8)`) | 0 | **3 adagas** (`adagas:3`) · raio 2.4 | `motor.js:760-762` |
| 11 | **B** | Passo das Sombras | 33 | 10 | — | — | não | 24→16.8s (`serie(24,-0.8)`) | 0 | some 1.5s · **+100%→172%** no próximo golpe (`serie(1,0.08)`) · janela 5s | `motor.js:763-764` |
| 12 | **M** | Execução Noxiana | 38 | 10 | 200→920 (`serie(200,80)`) | 1.20→1.83 (`serie(1.2,0.07)`) | não | 14→9.5s (`serie(14,-0.5)`) | 0 | executa <20%→29% (`serie(0.2,0.01)`) · devolve 50% da recarga (`reembolso:0.5`) | `motor.js:765-767` |
| 13 | **N** | Tempestade de Lótus | 45 | 5 | 90→250 (`serie(90,40,5)`) | 0.45→0.65 (`serie(0.45,0.05,5)`) | não | 75/66/58/51/45 | 0 | **12 golpes**, 3s, **2 adagas no fim** (`adagasFim:2`) | `motor.js:768-770` |

**Custo**: `semCusto()` = `serie(0,0,n)` (`motor.js:695`) — **todas as 13 custam 0**. Ela não tem mana
(`motor.js:884` `semMana: true`; `motor.js:520` `manaMax = ... k.semMana ? 0 : ...`).

### 1.2 Cada uma em português simples + o que faz de facto no combate

**P — Voracidade (passiva).** `motor.js:736-737`. Não se carrega em tecla. **É o coração do DPS dela.** Cada
adaga que ela apanha do chão faz um **giro** que corta **todos** os monstros em volta. O dano do giro é
`30 + 19·nível + 1·AP + 0.4·(AD − ADbase)` — **escala com AP E com AD bónus**. Além disso: cada **abate** corta
1.5s das recargas de Q/W/E, e **5s** se for um chefe (`motor.js:1789`); cada adaga apanhada corta **metade** do
que falta para o Shunpo (E) voltar (`motor.js:2162`, `shunpo:0.5`); e **o giro cura 5% do dano causado**
(`curaBase: 0.05`, aplicado em `motor.js:2169-2170`).

**Q — Lâmina Saltitante.** `motor.js:738-740`, executada em `motor.js:2273-2280`. Arremessa uma adaga que
salta em **até 3** monstros (`alvos: 3`), e **depois cai no chão** atrás do primeiro
(`soltarAdaga(estado,c,'Q',...)`, `motor.js:2278`). Escala **só com AP**.

**W — Preparação.** `motor.js:741-742`, executada em `motor.js:2281-2285`. **Não causa dano nenhum.** Joga uma
adaga para o alto que cai ao lado dela e dá velocidade por 1.25s. **É uma FÁBRICA de adagas** — o valor dela é
o giro que a adaga vai disparar. (O motor só a usa se houver monstro perto, `motor.js:2282`, "para dar tempo de
pegar".) A velocidade (`vel`) **só vale em Runeterra** (`arena.js:951` `A.rapida`), não no Rift.

**E — Shunpo.** `motor.js:743-745`, executada em `motor.js:2244-2253`. Aparece ao lado de um monstro e corta —
**e é a ÚNICA habilidade dela que escala com AP E AD ao mesmo tempo**: `base + ratio·AP + 0.4·AD`
(`motor.js:744`, o campo `adRatio: 0.4`). Se for até uma adaga no chão, **pega a adaga e já gira** — e corta o
Shunpo pela metade (`motor.js:2252`).

**R — Lótus da Morte.** `motor.js:746-748`, executada em `motor.js:2222-2226` + `motor.js:2186-2195`. Canal de
2.5s que atira **15 levas** nos **3** mais perto. **Um atordoamento interrompe** (`motor.js:2211`
`interromperLotus`; `arena.js:199` `pararLotus`). Escala só com AP.

**G — Sede de Sangue.** `motor.js:749-751`, executada em `motor.js:2264` e aplicada em `motor.js:1683-1686`.
Por 8s, **cada ataque básico corta de novo** com dano mágico (`base + ratio·AP`) e **30% desse dano volta como
vida** (`curaSede: 0.3`). Também dá **velocidade de ataque** (`va: 0.2→0.38`). Escala com AP. **Não está
modelada na extensão** (ver §4).

**A — Adaga Certeira.** `motor.js:752-754`, executada em `motor.js:2254-2263`. Atira no monstro mais distante,
**atordoa 1s** (`atordoa: 1`) e **deixa uma adaga ao lado dele** (`motor.js:2261`). Escala só com AP.

**D — Lâmina Sinistra (passiva).** `motor.js:755-756`. **Não se carrega em tecla, não está na barra.** Dois
efeitos: (a) cada adaga apanhada dá **velocidade de ataque** por 3s, até 3 acumulações
(`vaAdaga: serie(0.08,0.008)`, `acumMax: 3`, `duracaoSinistra: 3`) — aplicado em `motor.js:2166-2168` e
consumido em `motor.js:1667`; (b) **o giro cura** `curaGiro: serie(0.08,0.01)` do dano — aplicado em
`motor.js:2169-2170`. **É a cura que o dono perguntou. SIM, ELA CURA. Quantificado em §2.2.**

**F — Lâmina Envenenada.** `motor.js:757-759`, executada em `motor.js:2265`, aplicada em `motor.js:2152-2156`.
Por 8s, ataques básicos **e giros** envenenam: o monstro perde `venenoBase + 0.25·AP` **por segundo** durante
3s (`venenoT: 3`). O veneno **re-aplica e renova** a cada golpe (`motor.js:2156`), e a queima é somada em
`motor.js:1652-1655`. **Isto é dano real e NÃO está modelado na extensão** (§4).

**T — Chuva de Adagas.** `motor.js:760-762`, executada em `motor.js:2266-2272`. Corta todos em volta (raio 2.4)
e **deixa 3 adagas no chão** (`motor.js:2270`). **ATENÇÃO: a T deixa adagas mas o kit NÃO tem `adaga: true`** — ver §4.

**B — Passo das Sombras.** `motor.js:763-764`, executada em `motor.js:2227-2233`. Fica **invulnerável 1.5s**
(`some: 1.5`) e o **próximo golpe de habilidade** (ou giro) causa **+100%→+172%**
(`bonusSombra: serie(1,0.08)`, consumido em `motor.js:1220`, `fonte !== 'B'`).

**M — Execução Noxiana.** `motor.js:765-767`, executada em `motor.js:2234-2243`. Golpe no mais ferido; se ficar
abaixo de 20%→29% da vida, **morre na hora** (`motor.js:2239-2240`) e devolve 50% da recarga
(`motor.js:2242`). **Chefes não são executados** (`!ferido.chefe`, `motor.js:2239`).

**N — Tempestade de Lótus.** `motor.js:768-770`, executada em `motor.js:2216-2221` + `motor.js:2196-2208`.
3s de 12 cortes em **todos** em volta, **puxa quem está a chegar** (`i.chegada = 0`, `motor.js:2201`), **nada a
interrompe** (`d.inabalavel = true`, `motor.js:2219`), e **2 adagas ficam no chão** no fim (`motor.js:2205`).

---

## 2. AS PASSIVAS — P e D (o que são, o que fazem, e a CURA quantificada)

### 2.1 Os campos, um a um

| Campo | Onde está | Valor | Onde é APLICADO no motor |
|---|---|---|---|
| `P.giro` | `motor.js:737` | `(nível,a) => 30 + 19·nível + 1·apDe(a) + 0.4·max(0, a.ad − a.baseAd)` | `motor.js:2161` (`giroAdaga`) |
| `P.curaBase` | `motor.js:736` | **0.05** | `motor.js:2169` |
| `P.voracidade` | `motor.js:736` | **1.5** s | `motor.js:1789` |
| `P.voracidadeChefe` | `motor.js:736` | **5** s | `motor.js:1789` |
| `P.queda` | `motor.js:736` | `{Q:1.1, W:1.25, A:1, T:0.8}` s | `motor.js:2147` |
| `P.dura` | `motor.js:736` | **4** s (a adaga vive `queda+dura`) | `motor.js:2147` |
| `P.pegaCada` | `motor.js:736` | **0.35** s (cadência mínima entre giros) | `motor.js:2181`, `motor.js:2252` |
| `P.shunpo` | `motor.js:736` | **0.5** (metade da recarga do E) | `motor.js:2162` |
| `D.vaAdaga` | `motor.js:755` | `serie(0.08,0.008)` → 8%…15.2% | `motor.js:2167` (grava) + `motor.js:1667` (usa) |
| `D.acumMax` | `motor.js:755` | **3** | `motor.js:2167` |
| `D.duracaoSinistra` | `motor.js:755` | **3** s | `motor.js:2167` + `motor.js:1385` (expira) |
| `D.curaGiro` | `motor.js:755` | `serie(0.08,0.01)` → 8%…17% | `motor.js:2169` |
| `D.passiva` | `motor.js:755` | `true` | `jogo.js:5840` (não entra na barra) |

### 2.2 A CURA — SIM, ELA CURA NO GIRO. QUANTIFICADO.

**A linha exata** (`motor.js:2169-2170`):

```js
const cura = (HP.curaBase || 0) + (HD?.curaGiro && rD ? HD.curaGiro[rD - 1] : 0);
if (total > 0 && cura > 0) curar(estado, c, a, total * cura);
```

`total` é a **soma do dano do giro em TODOS os alvos em volta** (`motor.js:2165` `total += golpear(...)` dentro do
`for (const i of alvos)`). Logo: **quanto mais monstros em volta, mais cura.** `curar` está em `motor.js:1285-1290`
e ainda multiplica por 1.25 se tiver o item `3065` (`motor.js:1286`).

**Quanto por giro** — com os stats medidos ao vivo (`docs/snapshots/player.json`: nv 29, AP 1104, AD 161, ADbase 58):

- `giro = 30 + 19·29 + 1104 + 0.4·(161−58) = 1726` de dano bruto por alvo.
- cura = `curaBase` + `curaGiro[rD−1]`:

| Rank do D | `curaGiro` | cura total | **cura por giro (1 alvo)** | **cura por giro (3 alvos)** |
|---|---|---|---|---|
| **0 (não subida)** | — | **0.05** | **86** | **259** |
| 1 | 0.08 | 0.13 | 224 | 673 |
| 3 | 0.10 | 0.15 | 259 | 777 |
| 5 | 0.12 | 0.17 | 293 | 880 |
| 10 | 0.17 | 0.22 | 380 | 1139 |

**Nota crítica: a cura existe MESMO COM O D A RANK 0** — `curaBase = 0.05` está na P (`motor.js:736`) e é somado
sempre (`motor.js:2169`). A extensão nem sequer transmite o `curaBase` (§4).

**Quantos giros por luta.** O teto é `1 / pegaCada = 1/0.35 = 2.86 giros/s` (`motor.js:2181`), mas na prática é
limitado pelas adagas que caem. `sim-chefes.mjs:593` calcula `girosPorS = min(dagasPorS, 1/H.P.pegaCada)`.

**Confirmação ao vivo.** Os eventos de cura medidos nas lutas (`docs/snapshots/katarina.json`, campo `hist`)
têm valores `77, 78, 80, 82, 105, 139, 184, 209, 211, 227, 228, 246, 276, 277, 279, 282, 284, 296, 382, 384, 489,
557…` (mediana ≈ 230). Isto é a **mesma ordem de grandeza** que a tabela acima prevê (86 a 1139) — a cura é
real e mensurável. Os valores `300` e `900` que aparecem na mesma lista são **poções** (`POCOES`, `motor.js:262-264`),
não cura de kit.

---

## 3. AS ADAGAS (`adagas: true`, `motor.js:884`) — como funcionam

**Como nascem.** `motor.js:2144-2150` `soltarAdaga(estado, c, tecla, alvo)`:
```js
const ad = { id:'k'+proximoId++, t: HP.queda[tecla] ?? 1, resto: (HP.queda[tecla] ?? 1) + HP.dura, de: tecla, alvo: alvo?.id };
```
Ou seja: a adaga **cai depois de `queda[tecla]` segundos** e **desaparece depois de `queda + dura`** (4s mais).

**Quantas e onde caem** (Rift — `motor.js`):

| Skill | Quantas | Onde cai | `queda` | file:linha |
|---|---|---|---|---|
| Q | 1 | **atrás do primeiro alvo**, do lado oposto ao dela | 1.1s | `motor.js:2278`, `motor.js:736` |
| W | 1 | **ao lado dela** | 1.25s | `motor.js:2283`, `motor.js:736` |
| A | 1 | **ao lado do monstro mais distante** | 1.0s | `motor.js:2261`, `motor.js:736` |
| **T** | **3** | em volta (em Runeterra: círculo de raio 1.6, `arena.js:1023`) | 0.8s | `motor.js:2270`, `motor.js:760` |
| **N** | **2** | em volta, **no fim** da tempestade | 0.8s (usa `queda.T`) | `motor.js:2205`, `motor.js:768` |

**O que fazem ao serem apanhadas.** `katarinaPasso` (`motor.js:2173-2184`):
```js
const perto = vivos.filter(i => i.hp > 0 && i.chegada <= 0.5), ad = d.adagas.find(x => x.t <= 0);
if (ad && perto.length && !(d.pegaCd > 0) && !d.tempestade && d.morto <= 0) {
  d.adagas.splice(...); d.pegaCd = HK.P.pegaCada;
  giroAdaga(estado, c, a, adEfetivo, perto, ad);   // O GIRO
}
```
Regras: só apanha **a primeira que já caiu** (`t <= 0`); só se **houver monstro perto** (`chegada <= 0.5`);
**não durante a Tempestade** (`!d.tempestade`); e respeita o `pegaCd` de **0.35s**.

**O E também apanha** (`motor.js:2246-2252`): teleporta para a adaga, remove-a e gira.

**Isto muda o DPS? MUITO — é o DPS principal.** O giro é `1726` de dano bruto **por alvo, a cada adaga** (com os
stats dela). O `giroSrc` **depende inteiramente das adagas**: sem adaga apanhada não há giro nenhum
(`motor.js:2176-2184`). O `sim-chefes.mjs:595` mede `det.giro` e o `sim-build.mjs:352` chama-lhe `dpsPassiva`.

**ATENÇÃO — inconsistência do próprio motor:** `Q`, `W` e `A` têm `adaga: true` (`motor.js:738`, `741`, `752`) mas
`T` (`motor.js:760`) e `N` (`motor.js:768`) **deixam adagas e NÃO têm o campo** — têm `adagas: 3` /
`adagasFim: 2`, que são o número de adagas da própria habilidade. **Quem se guia por `h.adaga` para somar o
giro perde o T e o N.** A extensão e os dois simuladores guiam-se por `h.adaga` → **perdem-no** (§4).

---

## 4. A TABELA — HABILIDADE | A EXTENSÃO MODELA? | ONDE | IMPACTO | O QUE DEVE MUDAR

**Ordenada por impacto (maior primeiro).**
Legenda: **NÃO** = o motor aplica e a extensão ignora · **SIM** = modelado e correto · **AO CONTRÁRIO** = modela
o que não acontece, ou ignora o que acontece.

| # | Habilidade / mecânica | A extensão modela? | ONDE (motor → extensão) | IMPACTO | O QUE DEVE MUDAR |
|---|---|---|---|---|---|
| 1 | **`curaGiro` (D) + `curaBase` (P)** — a cura do giro | **NÃO** | motor `motor.js:2169-2170` → `inject.js:114` transmite `curaGiro` mas **`automation.js:1307` não o copia**; `automation.js:1398` `if (k.passiva) continue` salta o D | **O maior.** No sim do Barão vale **8.8→38.5 HP/s** (`sim-chefes.mjs:596`); só com o `curaBase` já são **8.8 HP/s** | Copiar `curaGiro`/`curaBase` no `aplicarKit` e somar a cura à sobrevivência. **É a prova #7 do AGENTS.md** |
| 2 | **`curaSede` (G) — 30% do dano volta como vida** | **NÃO** | motor `motor.js:1683-1685` → **nem está na lista do `serialKit`** (`inject.js:113-115`) | **21.0 HP/s** no sim do Barão — **a MAIOR parcela da cura de kit ao rank D=0** | Acrescentar `curaSede` ao `serialKit` e modelá-lo |
| 3 | **R: `golpes: 15`** (15 levas) | **NÃO** | motor `motor.js:746` (`golpes: 15`) → `automation.js:1411` `const mult = k.mult || 1` e **o kit do motor NÃO tem `mult`** (só o Darius W o tem, `motor.js:557`) | **R subestimada 15×** no painel `ap-sk-dps` (`gui.js:1846`) | Mapear `golpes`→`mult` no `aplicarKit` (o fallback `KAT_FB` já tem `R.mult: 15`, `automation.js:1248` — a regressão veio do caminho do motor) |
| 4 | **F: o veneno** (`venenoBase`+`venenoRatio`) | **NÃO — e mostra ZERO** | motor `motor.js:757-758`, aplicado `motor.js:2152-2156` → F **não tem `base`/`ratio`**, logo `automation.js:1409` dá `direto = 0`; e `gui.js:1847` `filter(h => h.dano || h.passiva)` **esconde-a da tabela** | **316/s de veneno ao rank 1** (`40 + 0.25·1104`), 3s por aplicação, renovado por autos **e giros** (`motor.js:2165`) | Modelar o `dot` (o campo `dot:true` já é lido em `automation.js:1307`) com `venenoBase`/`venenoRatio`/`venenoT` |
| 5 | **`alvos` (Q 3 · R 3 · T 3)** | **AO CONTRÁRIO — está morto** | motor `motor.js:738` `alvos: 3` → `automation.js:1307` escreve `alvo: h.alvo` (**singular**) mas `automation.js:5645` lê `k.alvos` (**plural**) | `alvosDe()` devolve **sempre 1** (`automation.js:5645`); a barra "por fase" nunca prefere as AoE | Corrigir `alvo: h.alvo` → `alvos: h.alvos`. **E notar que o ramo `porFase` (`automation.js:5675`) é inalcançável com `barraPorDisponibilidade` no default `true` (`automation.js:5654`)** |
| 6 | **T e N deixam adagas mas não têm `adaga:true`** | **AO CONTRÁRIO (o motor é que está torto)** | motor `motor.js:2270` (T deixa 3) e `motor.js:2205` (N deixa 2) vs `motor.js:760`/`768` **sem `adaga`** | A extensão (`automation.js:1399` `temAdaga = !!k.adaga`) e os 2 sims (`sim-chefes.mjs:590`, `sim-build.mjs:350`) **não creditam o giro ao T nem ao N** | Marcar `adaga: true` no T e no N **no motor** — ou (do lado da extensão) somar as adagas de `adagas`/`adagasFim` |
| 7 | **`vaAdaga` (D) — vel. de ataque por adaga, ×3** | **NÃO** | motor `motor.js:2166-2168` + `motor.js:1667` → `inject.js:114` transmite, `automation.js:1307` **não copia** | `+8%…+15.2%` de vel. de ataque, **até 3×** (`motor.js:755`), em cima dos `1.16` do HUD | Copiar `vaAdaga`/`acumMax`/`duracaoSinistra` e somar à velocidade de ataque |
| 8 | **`voracidade` — cada abate corta 1.5s de Q/W/E (5s no chefe)** | **NÃO** | motor `motor.js:1789` → não é transmitido; **`voracidade` tem 0 ocorrências na extensão** | Em farm de grupo as recargas andam muito mais depressa do que o modelo diz | Transmitir `voracidade`/`voracidadeChefe` e descontar nos abates |
| 9 | **`pegaCada: 0.35` — teto de giros/s** | **NÃO** | motor `motor.js:2181` → **0 ocorrências na extensão**; o sim já o faz (`sim-chefes.mjs:593`) | Com 4 skills de adaga na barra o modelo somaria mais giros do que o jogo permite (teto **2.86/s**) | Aplicar `min(Σ 1/recarga, 1/0.35)` |
| 10 | **`queda` / `dura` — a adaga cai e expira** | **NÃO** | motor `motor.js:2147` (`queda` Q 1.1 / W 1.25 / A 1 / T 0.8; `dura` 4s) → não transmitido | O modelo assume o giro **no instante do cast**; no jogo ele só acontece **1 a 1.25s depois** | Modelar o atraso (a extensão conta o giro no mesmo `cd` da skill) |
| 11 | **`shunpo: 0.5` — cada adaga corta o E pela metade** | **NÃO** | motor `motor.js:2162` → **0 ocorrências na extensão** | O E fica pronto muito mais vezes do que o modelo calcula | Descontar `d.recargas.E *= 0.5` por adaga |
| 12 | **`va` do G (+20%…+38% vel. ataque)** | **NÃO** | motor `motor.js:749` → transmitido (`inject.js:113` `va`) e copiado (`automation.js:1310`) mas **nunca usado** para a Katarina (só itens, `automation.js:4829`) | O G é uma skill de **velocidade de ataque**, não só de dano | Usar `KAT.G.va` na velocidade de ataque durante os 8s |
| 13 | **E: `adRatio: 0.4`** | **SIM** | motor `motor.js:744` → `automation.js:1409` `+ (k.adRatio || 0) * ad` | Correto — é a **única** skill dela que usa AD | — |
| 14 | **`giro` (a fórmula da P)** | **SIM** | motor `motor.js:737` → `inject.js:147` `giroSrc` → `automation.js:1315-1317` faz o parsing dos 4 coeficientes | Verifiquei o parsing: dá `{base:30, nivel:19, ap:1, ad:0.4}` — **exato** | — (mas ver #5: o `mult` que multiplica o giro é sempre 1) |
| 15 | **T · B · M · N (níveis 28/33/38/45)** | **AO CONTRÁRIO** | motor `motor.js:760-770` → extensão modela-os com números completos | **Ela NUNCA os usa: rank 0 em 30/30 ciclos** (`docs/snapshots/katarina.json`). O motor também não: `motor.js:1578` `pode(t) = estado.barra.includes(t) && r[t] && ...` | Não é bug — é **ruído**. A barra só tem 4 lugares (`motor.js:900` `BARRA = 4`) |

### 4.1 A barra NÃO tem 5 skills — tem 4

A nota do dono diz "a extensão usa 5 skills na barra". **A premissa está errada**: `motor.js:900`
`export const BARRA = 4; // a barra de combate: 4 habilidades`, e `automation.js:64` `const BARRA_SLOTS = 4;`.
E `motor.js:1578` **só deixa usar o que está na barra**:
```js
const pode = (t) => estado.barra.includes(t) && r[t] && d.recargas[t] <= 0 && estado.mana >= HK[t].custo[r[t] - 1];
```

### 4.2 Quais ela REALMENTE usa em combate (medido, não suposto)

Medido em `docs/snapshots/katarina.json` (30 ciclos) e `docs/snapshots/skills.json`:

| Skill | Rank medido | Está na barra? | Veredicto |
|---|---|---|---|
| **Q** | **10** | **30/30 ciclos** | **USA — o motor de DPS dela** |
| **A** | **5** | **30/30** | **USA** |
| **G** | **1** | **30/30** | **USA** (dano no auto + **30% de cura**) |
| **F** | **1** | **30/30** | **USA** (veneno — que a extensão mostra a zero) |
| **R** | **3** | barra rotativa (`docs/snapshots/skills.json` e `lutas[0].skills`) | **USA** — e é o que a extensão subestima 15× |
| **W** | **1** | aparece na barra em `skills.json` e `lutas[0]` | **USA** — mas só pelo **giro** que a adaga dispara (não tem dano) |
| **E** | **3** | não aparece | **Usável, não equipada** — dá dano (80+34%AP+0.4·AD) e corta o próprio CD |
| **D** (passiva) | não visível | **nunca** (`jogo.js:5840` passiva) | **USA SEMPRE** — é passiva, não precisa de barra |
| **P** (passiva) | não visível | **nunca** | **USA SEMPRE** |
| **T** | **0** | não | **NÃO USA** (rank 0) |
| **B** | **0** | não | **NÃO USA** |
| **M** | **0** | não | **NÃO USA** |
| **N** | **0** | não | **NÃO USA** |

**E a extensão não carrega em tecla nenhuma** — verificado: `automation.js:5780-5781`
*"Isto decide QUAIS skills ficam equipadas; NÃO clica em skills (o farm usa-as sozinho, é coisa do jogo)."*
O que a extensão faz é **escolher as 4 da barra** (`barraIdeal`, `automation.js:5636-5682`).

---

## 5. O EFEITO NO COMBATE — a luta contra o Barão, com e sem a cura

**Corri os simuladores** (`tools/sim-chefes.mjs`: `lutarBarao` `sim-chefes.mjs:1048`, `lutarChefe`
`sim-chefes.mjs:632`, `curaDaBuild` `sim-chefes.mjs:1031`), com a build medida
(`["3175`A","3089+2`B","3100+3`A","3135`A","4629+3`A"]`, de `docs/snapshots/katarina.json`), nv 29,
atributos do dono (`sim-chefes.mjs:1150 atribDono`), e os ranks medidos (`Q10 W1 E3 R3 G1 A5 F1`).

**Alvo**: Barão Nashor nv 42, `hpMax = 97824`, `ad = 1408` (`statsBossFiel`, `sim-chefes.mjs:331`).
**Personagem no sim**: vida 4536, AD 153, AP 1051, arm 158, RM 130 (o erro conhecido do modelo: a medição ao
vivo diz 4476 / 161 / 1104 / 164 / 134 — `docs/snapshots/player.json`).
**DPS total modelado**: `823` → tempo para matar `97824/823 ≈ 119s`.

| Cenário | Cura de kit | Sobrevive? | Mata? | Morre em | Poções | Ouro em poções | Pior golpe |
|---|---|---|---|---|---|---|---|
| **Sem cura de kit nenhuma** | 0 HP/s | NÃO | NÃO | **7.95s** | 1 | 110 | 1079 |
| **Com a cura real, D=0** (só `curaBase` 5% + Sede) | **29.8 HP/s** | NÃO | NÃO | **8.45s** | 1 | 110 | 1079 |
| **Com a cura real, D=5** | **50.8 HP/s** | NÃO | NÃO | **9.95s** | 3 | 260 | 1079 |
| **Com a cura real, D=10** | **59.5 HP/s** | NÃO | NÃO | **9.95s** | 3 | 260 | 1079 |

**Decomposição da cura de kit** (`sim-chefes.mjs:596` e `:607`):

| Componente | D=0 | D=5 | D=10 |
|---|---|---|---|
| `curaGiro` (giro da Voracidade) | **8.8 HP/s** | 29.8 HP/s | 38.5 HP/s |
| `curaSede` (G, 30% do dano) | **21.0 HP/s** | 21.0 | 21.0 |
| **Total** | **29.8** | **50.8** | **59.5** |

### O que isto quer dizer, na régua do dono

1. **Sobrevive?** — **NÃO, ao Barão.** A cura de kit **não vira o jogo**: adia a morte de **7.95s para
   9.95s** (+25% de tempo de vida) mas o Barão tem 97824 de vida e o DPS modelado é 823 → **119s para o
   matar**. Não fecha. (Também já era sabido por outro caminho: `tools/sim-chefes.mjs` imprime
   *"Barão: armadura mínima p/ sobreviver aos Tentáculos — armadura 154: tentáculos 5641 >= HP máx -> INSTA-KILL"*
   e só a partir de **armadura 250** é que sobrevive. Ela tem 158-164.)
2. **Quantos segundos?** — o Barão mata-a em **`8-10s**; ela precisaria de **119s**. Não é uma luta ganha.
3. **Quantas poções e quanto custam?** — o sim diz **1 a 3 poções (110 a 260 de ouro)**; **mais cura fez usar
   MAIS poções**, porque vive mais tempo e tem mais janelas para beber. Isto é o oposto do que a intuição diz —
   **a cura de kit não poupa poções no Barão, ela compra tempo.**

### E contra o chefe que ela REALMENTE faz (Dragão Infernal)

Aqui os dados são **medidos**, não simulados (`docs/snapshots/dps.json`, 29 lutas):

| | Estimado pela extensão | Real medido |
|---|---|---|
| Tempo da luta | **28.8s** | **28.9s** (excelente) |
| Poções | **2.14** | **0.00** (sobre-prevê) |
| Cura de skills | **23.0 HP/s** | **10.9 HP/s** (26 de 29 lutas com erro > 50%) |
| Mortes | — | **0 em 29 lutas** |

**A extensão acerta o TEMPO e erra a CURA.** E a cura que ela reporta como "real" está **contaminada**:
`registrarLuta` (`automation.js:855-872`) soma **todos** os eventos de cura do `hist` e só desconta
`c.bossFase.potions × curaPocaoMax()`. Na 1.ª luta do snapshot os eventos de cura são `279, 300, 900`
(soma 1479), `bossFase.potions = 0` → `healSkillS = round(1479/35.6) = 42` — **exatamente o 42 gravado**.
Mas `300` e `900` são **poções** (`motor.js:262-264`), e o mesmo `hist` tem **6 eventos `pot`**. Ou seja: o
`realHealS = 42` é **quase todo poção**, e o único evento de cura de kit da luta foi **279**. O valor correto
seria `round(279/35.6) ≈ 8`.

**Portanto: nem o modelo teórico nem a medição empírica da extensão representam a cura real da Katarina.**

---

## 6. O QUE NÃO CONSEGUI VERIFICAR (explicitamente)

1. **`dados-katarina.js` NÃO EXISTE no repositório.** `motor.js:6` `import { DADOS_KATARINA } from './dados-katarina.js';`
   e o ficheiro não está em `docs/game-src/` (23 ficheiros, verificado). Consequência: os **nomes** das skills
   (`HKT.Q.nome` etc., `motor.js:738-770`) e os **stats base do campeão** (`DADOS_KATARINA.campeao.stats`,
   usado em `motor.js:884`) **não são verificáveis** a partir das fontes do repositório. Os números de dano
   **são** (estão literais no `motor.js` e batem 11/11 com o tooltip ao vivo — §0.1). Os stats base não:
   `hp/hpperlevel/armor/attackspell` vêm de um ficheiro ausente.
2. **O rank do D (Lâmina Sinistra) não é observável.** `jogo.js:5846-5847` põe as passivas em `#hab-passivas`
   (`['P', ...M.ORDEM_HAB.filter(hk => passiva(hk))]`) e a extensão lê **só** `#hab-ativas`
   (`automation.js:922` `document.querySelectorAll('#hab-ativas .hab[data-t]')`). Logo: **nem eu nem a
   extensão conseguimos saber o rank do D pela página.** O snapshot não o traz. Os cenários D=0/5/10 em §5
   são **hipóteses**, não medições. **PRECISA DE REGRA DO DONO** apenas se quiser fixar um valor — de resto,
   basta ler `#hab-passivas`.
3. **`DADOS_KATARINA.campeao.stats`** (hp, hpperlevel, armor, attackspeed) — mesma razão do ponto 1. Os
   `adBase: 58` e `adNivel: 3.4` **são** verificáveis: estão literais em `motor.js:884`.
4. **O número real de giros por luta de chefe.** Os eventos de cura do snapshot dão uma pista (mediana ≈ 230 por
   evento, consistente com a tabela de §2.2), mas o `hist` é do canvas, com dedup e substituição de valores
   capados (`automation.js:862-869`). Não consegui isolar "quantos giros" com rigor.
5. **Runeterra (arena.js) não foi auditado ao mesmo nível.** A 2.ª implementação (`arena.js:928-1071`) tem
   números **diferentes** — ex.: `KAT.lotusOndas = 15` (`arena.js:168`) contra `golpes: 15` do motor, e
   `KAT.giro = 2` / `pega = 0.9` / `shunpo = 7` (`arena.js:168`) que **não existem no Rift**. O dono joga
   **Rift** (as lutas do snapshot são todas de `Fosso do Dragão`/`Covil do Barão`, `LOCAL.arena = false`), por
   isso não persegui as divergências de lá.
6. **Não corri o jogo nem o browser** (proibido nesta tarefa). Tudo o que digo do comportamento ao vivo vem do
   `motor.js` + dos snapshots já gravados + dos simuladores em `tools/`.
7. **A extensão não foi executada.** As conclusões sobre ela são leitura de código (`inject.js`,
   `automation.js`, `gui.js`), não observação em runtime.

---

## 7. RESUMO EM 6 LINHAS

1. **Ela cura no giro — SIM.** `curaGiro` (D, `motor.js:755`) + `curaBase` 5% (P, `motor.js:736`), aplicados em
   `motor.js:2169-2170`. Vale **86 a 1139 de vida por giro** (1 a 3 alvos, D=0 a D=10) com os stats dela.
2. **A extensão NÃO modela essa cura.** Recebe `curaGiro` (`inject.js:114`) e **deita-o fora** em
   `automation.js:1307`; o D é saltado em `automation.js:1398`.
3. **Também não modela a cura do G** (`curaSede` 30%, `motor.js:1683-1685`) — que é **a maior parcela** ao rank D=0
   (**21 de 29.8 HP/s**).
4. **O R está 15× subestimado** (o `golpes: 15` do `motor.js:746` não chega ao `mult`, `automation.js:1411`).
5. **O F aparece com dano ZERO** e é escondido da tabela (`automation.js:1409` + `gui.js:1847`), apesar de
   **316/s de veneno** ao rank 1.
6. **No Barão isto não vira o jogo** (morre em `8-10s, precisava de 119s) — mas contra o **Dragão** (a luta que
   ela faz) a extensão **sobre-prevê poções (2.14 contra 0 reais)** porque não vê a cura. É aí que o erro custa ouro.

---

## 8. PATCHES PRONTOS — o que falta para FECHAR (bloqueado nesta tarefa)

**Nesta tarefa estou PROIBIDO de escrever em `extension/` e em `tools/testes/`** (restrição explícita do
pedido). A REGRA Nº 7 do AGENTS.md manda arrumar o que se encontra — como não posso, deixo aqui o **patch
exato**, linha a linha, para quem tem acesso de escrita. Nada disto é especulativo: cada número vem do
`motor.js` e cada linha de destino foi lida.

### P1 — `inject.js:113-115` — transmitir os campos que faltam

```js
// ANTES (inject.js:113-115)
for (const c of ['nivel', 'max', 'base', 'ratio', 'recarga', 'adRatio', 'mult', 'alvos', 'duracao', 'golpes',
  'venenoBase', 'venenoRatio', 'venenoT', 'vaAdaga', 'acumMax', 'duracaoSinistra', 'curaGiro',
  'adaga', 'auto', 'dot', 'passiva', 'util']) {

// DEPOIS — acrescentar (todos existem em motor.js:736-770 e NÃO são funções):
//   'curaBase'          motor.js:736   (P — a cura de 5% que vale SEMPRE)
//   'curaSede'          motor.js:749   (G — 30% do dano volta como vida)
//   'voracidade'        motor.js:736   (1.5s por abate)
//   'voracidadeChefe'   motor.js:736   (5s por abate de chefe)
//   'pegaCada'          motor.js:736   (0.35s — TETO de giros/s)
//   'queda'             motor.js:736   ({Q:1.1,W:1.25,A:1,T:0.8})
//   'dura'              motor.js:736   (4s de vida da adaga)
//   'shunpo'            motor.js:736   (0.5 — corta o E)
//   'adagas'            motor.js:760   (T deixa 3)
//   'adagasFim'         motor.js:768   (N deixa 2)
//   'some'              motor.js:763   (B)
//   'bonusSombra'       motor.js:763   (B)
//   'executa'           motor.js:765   (M)
//   'reembolso'         motor.js:765   (M)
//   'regen' 'pctAlvo'   (outros campeões)
```
Nota: `queda` é um **objeto** — o `serialKit` já o deixa passar (`Array.isArray(v) ? v.slice() : v`,
`inject.js:118`) e o `postMessage` clona-o.

### P2 — `automation.js:1307` — o `aplicarKit` deita fora metade do kit (a causa-raiz)

```js
// ANTES (automation.js:1307-1310) — repare em `alvo: h.alvo` (SINGULAR) e nos campos ausentes:
out[t] = { max: h.max, mult: h.mult, alvo: h.alvo, adaga: !!h.adaga, auto: !!h.auto, dot: !!h.dot, passiva: !!h.passiva, util: !!h.util, adRatio: h.adRatio,
  base: serie(h.base), ratio: serie(h.ratio), rec: serie(h.recarga), nivel: h.nivel,
  duracao: h.duracao, duracaoPen: h.duracaoPen, penSuspiro: h.penSuspiro,
  va: serie(h.va), bonus: serie(h.bonus), bonusHab: serie(h.bonusHab) };

// DEPOIS — corrigir o plural e acrescentar os campos da Katarina:
out[t] = { max: h.max, mult: h.mult, golpes: h.golpes, alvos: h.alvos, adaga: !!h.adaga, auto: !!h.auto, dot: !!h.dot, passiva: !!h.passiva, util: !!h.util, adRatio: h.adRatio,
  base: serie(h.base), ratio: serie(h.ratio), rec: serie(h.recarga), nivel: h.nivel,
  duracao: h.duracao, duracaoPen: h.duracaoPen, penSuspiro: h.penSuspiro,
  va: serie(h.va), bonus: serie(h.bonus), bonusHab: serie(h.bonusHab),
  // --- Katarina (motor.js:736-770) ---
  curaBase: h.curaBase, curaSede: h.curaSede, vaAdaga: serie(h.vaAdaga), acumMax: h.acumMax,
  duracaoSinistra: h.duracaoSinistra, curaGiro: serie(h.curaGiro),
  venenoBase: serie(h.venenoBase), venenoRatio: h.venenoRatio, venenoT: h.venenoT,
  voracidade: h.voracidade, voracidadeChefe: h.voracidadeChefe, pegaCada: h.pegaCada,
  queda: h.queda, dura: h.dura, shunpo: h.shunpo, adagas: h.adagas, adagasFim: h.adagasFim,
  some: h.some, bonusSombra: serie(h.bonusSombra), executa: serie(h.executa), reembolso: h.reembolso };
```
**Isto sozinho conserta o `alvosDe` (P5) e põe o `curaGiro` dentro do `KAT`.**

### P3 — `automation.js:1411` e `1449` — o R está 15× baixo

```js
// ANTES
const mult = k.mult || 1;                       // automation.js:1411 e :1449
// DEPOIS — o motor diz o número de LEVAS em `golpes` (motor.js:746 R=15, :768 N=12):
const mult = k.mult || k.golpes || 1;
const alvos = k.alvos || 1;                     // alvos distintos (Q 3, R 3)
const total = direto * mult * alvos + (temAdaga ? giro * alvos : 0) + procLich;
```
Nota: `KAT_FB` (`automation.js:1244-1254`) já tinha `R.mult: 15` — a regressão nasceu quando o kit passou a
vir do motor (`aplicarKit`), que **não tem `mult`**. Isto repõe o valor e ainda o **lê do motor**.

### P4 — `automation.js:1398` — a cura do giro e a vel. de ataque por adaga

```js
// ANTES
if (k.passiva) continue;                        // automation.js:1398 — salta o D inteiro

// DEPOIS — não saltar o D: publicá-lo como a passiva que ele é (o painel já sabe desenhar `passiva`):
if (k.passiva) {
  const rD = (h.rank || 0);
  if (h.t === 'D' && rD > 0) {
    const giro = /* a mesma conta de automation.js:1393 */;
    out.push({ t: 'D', nome: h.name, passiva: true, dano: 0,
      curaGiro: +(k.curaGiro(rD) * giro).toFixed(0),      // motor.js:2169-2170
      vaAdaga: k.vaAdaga(rD) * (k.acumMax || 1),          // motor.js:2167 + :1667
      nota: 'cura por giro (motor.js:2169) e +' + Math.round(100 * k.vaAdaga(rD) * (k.acumMax || 1)) + '% vel. ataque' });
  }
  continue;
}
```
**Mas o rank do D não é visível** — ver P6.

### P5 — `automation.js:5645` — `alvosDe` está morto (duas razões independentes)

```js
// ANTES (automation.js:5645)
const alvosDe = (t) => { const k = KAT[t] || {}; return k.alvos != null ? k.alvos : 1; };
```
Fica correto **depois do P2** (que passa a escrever `alvos`). E o ramo que o usa
(`automation.js:5675-5678`) só corre com `cfg.barraPorDisponibilidade === false` (`automation.js:5654` e
`:5664`) — com o default `true` é **inalcançável**. Decidir se é para lá chegar.

### P6 — LER `#hab-passivas` — o rank do D (e da P)

```js
// automation.js:922 — ANTES (só as ativas; as passivas ficam em #hab-passivas, jogo.js:5847)
const arsenal = [...document.querySelectorAll('#hab-ativas .hab[data-t]')].map(...)

// DEPOIS — juntar as duas, marcando as passivas (jogo.js:5840-5847):
const cartao = (h, passiva) => ({ /* ...o mesmo de hoje... */ passiva });
const ativas   = [...document.querySelectorAll('#hab-ativas   .hab[data-t]')].map((h) => cartao(h, false));
const passivas = [...document.querySelectorAll('#hab-passivas .hab[data-t]')].map((h) => cartao(h, true));
const arsenal = [...ativas, ...passivas];
```
`jogo.js:5847` escreve `['P', ...M.ORDEM_HAB.filter(hk => passiva(hk))]` em `#hab-passivas` — logo o `D`
(`motor.js:755` `passiva: true`) está lá, com o rank no texto (`jogo.js:5818` `rank {r}/{max}`).
**Isto é o que desbloqueia o P4.**

### P7 — a sobrevivência: somar as curas de kit

O sítio é `estimarLuta` (`automation.js:5782-5820`), onde hoje `curaSkill` é **só empírico**:
```js
// ANTES (automation.js:5792-5794)
const healChefe = reg?.healSkillChefeS || 0, healMob = reg?.healSkillS || 0, healLive = live?.rates?.healRate || 0;
const curaSkill = healChefe > 1 ? healChefe : (healLive > 1 ? healLive : healMob * 0.5);

// DEPOIS — o TEÓRICO do motor como PISO (o empírico é medido e pode vir 0, ver §5):
const K = META.champAtual && META.champAtual.id === 'katarina';
const girosPorS = K ? Math.min(adagaPorS(sk), 1 / (KAT.P.pegaCada || 0.35)) : 0;   // motor.js:2181
const rD = (rankDe('D') || 0);
const curaTeorica = K ? girosPorS * giro * ((KAT.P.curaBase || 0) + (rD ? KAT.D.curaGiro(rD) : 0))
                          + curaSedeTeorica()                                      // motor.js:1685
                      : 0;
const curaSkill = Math.max(curaTeorica, healChefe > 1 ? healChefe : (healLive > 1 ? healLive : healMob * 0.5));
```

### P8 — o veneno do F (mostra ZERO e é escondido)

```js
// automation.js:1409 — o F não tem `base`/`ratio` no motor (motor.js:757): só veneno. Modelar o dot:
if (k.dot && k.venenoBase) {
  const dpsVeneno = k.venenoBase(rr) + (k.venenoRatio || 0) * escala;     // motor.js:758
  out.push({ t: h.t, nome: h.name, dot: true, dano: Math.round(dpsVeneno),
    dps: Math.round(dpsVeneno), nota: 'veneno/s por ' + (k.venenoT || 3) + 's (motor.js:2152-2156)' });
  continue;
}
```
E `gui.js:1847` `filter((h) => h.dano || h.passiva)` passa a mostrar o F sozinho, porque o `dano` deixa de ser 0.

### P9 — `T` e `N` deixam adagas mas não têm `adaga: true`

**Não é para corrigir no `docs/game-src/motor.js`** — esse ficheiro é a **cópia** do motor do site; editá-lo
não muda o jogo. Corrigir **na extensão**, derivando o campo:
```js
// automation.js:1399 — ANTES
const temAdaga = !!k.adaga;
// DEPOIS (motor.js:2270 T deixa 3, motor.js:2205 N deixa 2):
const temAdaga = !!(k.adaga || k.adagas || k.adagasFim);
```
E o mesmo nos simuladores (`sim-chefes.mjs:590` `H[t].adaga`, `sim-build.mjs:350` `.adaga`) — mas esses estão
em `tools/`, também fora do meu alcance de escrita nesta tarefa.

### Ordem de aplicação (por retorno)

1. **P2** (aplicarKit) — é a causa-raiz de 6 dos 15 itens da tabela.
2. **P6 + P4** — a cura do giro (o maior impacto).
3. **P1** — os campos que faltam no `postMessage` (sem isto o P2 não tem de onde ler).
4. **P3** — o R 15×.
5. **P8** — o veneno do F.
6. **P7** — a sobrevivência/poções.
7. **P5, P9** — as adagas do T/N e o `alvosDe`.

