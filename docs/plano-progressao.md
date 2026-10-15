# Plano de progressão do Yasuo — resolvido no papel

> **Lane:** progressao · 2026-10-14 · **regra da lane:** nenhum browser, nenhum CDP, nenhum
> `bun tools/ll.mjs`, nenhum processo do jogo.
> **Fontes:** `docs/game-src/motor.js`, `docs/game-src/balanco.js`, `docs/game-src/itens.js`,
> `docs/motor-map.md`, `docs/build-yasuo.md`, `extension/automation.js`, `extension/inject.js`, `HANDOFF.md`.
> **Legenda:** `ficheiro:linha` = li a linha · **(derivado)** = reimplementei a fórmula e calculei ·
> **(medido)** = número do `HANDOFF.md`/snapshot · **[INDECIDÍVEL]** = não fecha sem o jogo (com o teste).

## 0. Estado medido e o que o motor confirma

| dado medido | o que o motor diz | fonte |
|---|---|---|
| nível **14**, ouro **64.300** | — | — |
| local **Campo Azul nível 15–25** | `faixa: [15,25]`, `nm: [15,23]`, tier 3 | `motor.js:363` |
| equipado `1001·3044·1018·3133·1036` (todos A) | qualidade A multiplica os atributos por **1,15** | `motor.js:173-179`, `motor.js:252-255` |
| mochila **20/24** | `mochila = 20 + 2×floor(nível/5)` = 20+4 = **24** | `motor.js:35-36` |
| Q7 · E4 · W2 · R1; barra Q,E,W + **slot vazio** | `BARRA = 4`; **só a barra usa habilidades** | `motor.js:900`, `motor.js:1578` |
| **15** pontos de skill livres (HUD) | o nv14 dá **14** ranks (1 ponto/nível + a Q inicial) | `motor.js:2801`, `motor.js:1003` |
| 5 tipos de atributo | **3 pontos por nível** → **39** no nv14 | `motor.js:483`, `motor.js:2802` |
| `buildIdeal()` = 3172,3046,6631,3085,3031 | heurística de pesos, **não** é simulação | `automation.js:2976-3002` |

**Grandezas derivadas (nível 14, equipamento acima)** — todas `(derivado)`:

| grandeza | fórmula | valor |
|---|---|---|
| `g = crescimento(14)` | `(n−1)(0,7025+0,0175(n−1))` | 12,090 `motor.js:434-437` |
| AD | `(60 + 3,9g + Σ item.ad×1,15) × 1,08` | **171,61** `motor.js:881`, `motor.js:495`, `motor.js:252-255`, `motor.js:524` |
| AS | `0,697 × (1 + 0,035g) × 1,08` | **1,071** `motor.js:534`; o `1,08` é a Valsa do Fago `motor.js:1706`+`1666` |
| crítico | `(0,1725 + 0,1252) × 2` | **59,5 %** `motor.js:541`, `motor.js:697` |
| dano de crítico | `1,75 × 0,8` (sem Gume do Infinito) | **1,40** `motor.js:499`, `motor.js:697` |
| escudo do Fluxo | `80 + 28×14` | 472 `motor.js:697` |
| xp para o 15 · custo de uma morte | `xpParaNivel(14)` · `10 %` dele | **213.000** · **21.300** `motor.js:427-430`, `motor.js:2763-2768` |

O `1,08` do AD são as conquistas já cumpridas (Centurião +2 %, Carniceiro +3 %, Carrasco do Barão +3 %,
`motor.js:3480-3487`, aplicadas em `motor.js:524`); calibrei-o contra o HUD medido (nv12 com
3047,1036,3044,1018,3133 → `dano: 162` fecha com `150,15 × 1,08`, `HANDOFF.md` §9.5i).

**Alvo de referência** (Campo Azul, mob nv15): armadura média **38,5** (`CURVA.armadura(15)=27,5` × 1,5/1,2,
`motor.js:276`), mitigação física **0,7220** (`mitigar`, `motor.js:1167`), **mitigação do E = 1,0**
(o E é `magico: true` sem `poder` → `arm = 0`, `motor.js:1202`), HP médio **2.990**.

**DPS de hoje (3 alvos): 647** — auto 189 · Q 350 · E 81 · R+pen 27. É a linha de base de tudo o resto.

---

## 1. Os 15 pontos de habilidade

### 1.1 Só cabem 14 no nível 14

`rankMaximoNoNivel` (`motor.js:905-912`), `nivelMinimoR = [6,11,16,25,35]` (`motor.js:902`):

| tecla | cap no nv14 | rank hoje | pontos que aceita |
|---|---|---|---|
| Q Tempestade de Aço | `min(10, ceil(14/2))` = **7** | 7 | **0** (está no teto) |
| W Parede de Vento | 7 | 2 | 5 |
| E Espada Ágil | 7 | 4 | 3 |
| R Último Suspiro | `#{6,11}≤14` = **2** | 1 | **1** |
| G Respiração do Vento | `1+floor((14−8)/2)` = 4 | 0 | **4** |
| A Investida do Vendaval | `1+floor((14−13)/2)` = 1 | 0 | **1** |
| D/F/T/B/M/N | 0 (níveis 18/23/28/33/38/45) | 0 | 0 |

**Total gastável = 14.** O HUD diz 15: ou há um ponto de migração/reset (`motor.js:1048`, `motor.js:3685`),
ou o nível real é 15 — ver **T0** no §6. O 15.º ponto, no nv15, vai para a **Q (rank 8)**.

### 1.2 O dono tem razão: a ultimate está morta

`pode(t) = estado.barra.includes(t) && r[t] && d.recargas[t] <= 0` (`motor.js:1578`) — **uma habilidade
fora da barra nunca é lançada**. Com o R em rank 1 e `onBar: false`, perde-se:

- **382 de dano aplicado por alvo** (base 200 + 1,0×AD, `motor.js:706-707`) — o maior golpe do kit;
- **30 % de penetração de armadura por 15 s** (`penSuspiro`, `motor.js:706`, aplicado em `efetivo`,
  `motor.js:1330`): a mitigação física sobe de 0,7220 para 0,7877 = **+9,1 % em todo o dano físico**
  (auto, Q, A) durante a janela;
- **+1 s de monstros no ar** (`segura`, `motor.js:708`+`motor.js:2071`).

### 1.3 O erro que produz a ordem errada

`subirHabilidades` (`automation.js:1395-1415`) ordena por `dpsPorHabilidade()` (`automation.js:969-998`),
que calcula `direto = base(rank) + ratio × ap` (`automation.js:983`) com `ap = player().poder` — **0 num
campeão AD**. O kit do Yasuo guarda a escala em `ratio` (**0,55** na Q, AD — `motor.js:699`) e **não tem
`adRatio`** (só a Katarina tem, `motor.js:743`): **todo o escalamento por AD é multiplicado por zero**.

Consequências, com número:

1. A extensão vê **Q 51,6 > E 34,1 > R 2,86 > W = G = A = 0,0** (base ÷ recarga, `ap = 0`).
   Esgotados Q (teto 7), E (7) e R (2), **W/G/A empatam em 0,0** e o `sort` é estável
   (`automation.js:1409`) → o desempate é a ordem do DOM = `ORDEM_HAB` = `Q,W,E,R,G,A,…`
   (`motor.js:899`, escrito em `jogo.js:5846`). **Queima os 5 pontos da Parede de Vento (0 de dano)
   antes dos 4 da Respiração do Vento (+44 dps) e do ponto da Investida do Vendaval (+17).**
2. `rotacaoSkills` (`automation.js:3475-3493`) **exclui a ultimate** fora de chefe/área difícil
   (`usarUlt = fase === 'chefe' || chefeInvencivel`) e ordena por `dps` — com R = 2,86 ele nunca entra
   na barra. É a causa directa do `R naBarra: false` que o dono viu.
3. `meta.ordemHab` — a ordem oficial do kit (`KITS.yasuo.ordem`, `motor.js:882`) é enviada pelo
   `inject.js:154` e **nunca lida** pelo `automation.js`.

É o **mesmo bug já corrigido em `estimarSet`** (`automation.js:2110-2112`: `escala = magia ? ap : adTotal`)
e **não** corrigido em `dpsPorHabilidade`. **Correcção de 1 linha** (fora do write scope desta lane).

### 1.4 Dano por habilidade, com a fórmula do motor

`(derivado)` — AD 171,61, E[crítico] 1,2382, `papel.dano = 1,15` (`motor.js:881`):

| tecla | dano (`motor.js`) | rank | aplicado / alvo | recarga efetiva | alvos | DPS |
|---|---|---|---|---|---|---|
| **Q** | `(40+20(r−1)) + 0,55×AD` ×crit (`698-699`) | 7 | **261,5** | **2,017 s**¹ | 2 (fila) / 5 (tornado) | **350**² |
| **E** | `(50+18(r−1)) + (0,20+0,01(r−1))×AD` ×1,5 (`703-704`, `2090-2091`) | 4 | **247,5** | 3,05 s | 1 | **81** |
| **R** | `(200+110(r−1)) + (1+0,08(r−1))×AD` ×crit (`706-707`) | 1 | **382,1** | 70 s | todos no ar | 16 (+11 de pen) |
| **W** | só `reducao = 0,32` por 4 s (`701-702`) | 2 | — | 23,2 s | — | **0** |
| **G** | `va = 0,25` por 8 s (`709-710`) | 0 | buff | 25 s | — | ver 1.5 |
| **A** | `60 + 0,8×AD` ×crit (`711-712`) | 0 | 202,9 | 12 s | 1 (+levanta 1 s) | 16,9 |
| **auto** | `AS × AD × E[crit] × mit × papel` | — | 176,4 | 1/1,071 s | 1 | 189 |

¹ `recargaQYasuo = max(1,5; recarga[r−1] / max(1, AS/0,697))` (`motor.js:2056`, usado em `motor.js:2124`):
`max(1,5; 3,1/1,536) = 2,017 s`.
² o Q acerta `fila = 2` (`motor.js:698`, `motor.js:2133`), vira tornado a cada 3 acertos (2 cargas,
`motor.js:2125-2131`) e, **depois de um E**, acerta todos os `prontos` (`eqCombo`, `motor.js:2092`+`2133`).
Alvo médio em onda de 3: **2,7** — é o que a tabela usa.

### 1.5 A ordem — ganho marginal por ponto

`(derivado)` — build de hoje, barra **Q,E,R,G**, 1 ponto de cada vez:

| # | ponto | ΔDPS | porquê |
|---|---|---|---|
| 1 | **G 0→1** | **+44,0** | +25 % de AS por 8 s a cada 25 s **e** encurta o Q (`motor.js:2056` lê `d.ventaniaVa`) |
| 2 | **E 4→5** | **+15,9** | +18 de base, +0,01 de ratio, −0,15 s de recarga |
| 3 | **E 5→6** | **+17,7** | idem |
| 4 | **E 6→7** | **+19,7** | idem — e o E é o único golpe que **não paga armadura** |
| 5 | **R 1→2** | **+11,0** | +110 de base, +0,08 de ratio, −10 s (70→60) |
| 6-8 | **G 1→2 · 2→3 · 3→4** | +7,4 · +8,0 · +8,7 | +3 % de AS por rank (rank 4 = +37 %) |
| 9-13 | **W 2→7** | **+0,0** cada | redução 32 %→42 %, uptime 17,2 %→20,8 % — só sobrevivência |
| 14 | **A 0→1** | +0,0 (fora da barra) / +16,9 (na barra) | 60 + 0,8×AD a cada 12 s |
| 15 (nv15) | **Q 7→8** | **+9,6** | +20 de base por rank, no teto do nível |

**Ordem: G1 → E5 → E6 → E7 → R2 → G2 → G3 → G4 → W3…W7 → (guardar 1 para o nv15).**
Com 14 pontos: **647 → 779 DPS (+20,4 %)**.

> **A ordem depende do equipamento** (dizê-lo é importante). Com a build cheia (AS base 2,4, AS efectiva
> 3,1, Q já no mínimo de 1,5 s) o G passa a valer **+238** e o E só +18/+20/+22; e a Agilidade passa a
> valer menos que a Força (§2.2). A ordem acima é a do equipamento de hoje.

### 1.6 A barra: **Q · E · R · G**

`(derivado)` — as 15 combinações, ranks finais (Q7 E7 W2 R2 G4 A1), build de hoje:

| barra | DPS | auto | Q | E | A | R+pen |
|---|---|---|---|---|---|---|
| **Q E R G** | **779** | 189 | 350 | 134 | — | 27 |
| Q E G A | 757 | 189 | 350 | 134 | 17 | — |
| Q E W G | 740 | 189 | 350 | 134 | — | — |
| Q E R A | 729 | 189 | 350 | 134 | 17 | 27 |
| Q E W R (hoje, sem o 4.º) | 711 | 189 | 350 | 134 | — | 27 |

- **O R entra.** É o pedido do dono **e** é óptimo: +22 sobre Q,E,G,A e +68 sobre a barra de hoje.
- **A W sai** — 0 de dano; é a reserva (troca com o A quando `farm.deaths` subir, ou com o G em área de
  chefe, porque a parede bloqueia `GOLPES_DE_LONGE = {sopro, olho, acido}`, `motor.js:2053`, `motor.js:3093`).
- **O A fica de fora** — 16,9 de DPS, o mais fraco dos 4 activos.
- O R precisa de alvos no ar: o **tornado do Q** (a cada 3 acertos, até 5 alvos) levanta-os
  (`motor.js:2127`) e a condição é `noAr ≥ 2 || chefe || vivos ≥ 3` (`motor.js:2069`) — cumpre-se
  numa onda de 2 a 4 (`qtd = 2 + floor(rand×3)`, `motor.js:1124`).

---

## 2. Os atributos

### 2.1 Fórmulas

| atributo | por ponto | `file:linha` |
|---|---|---|
| **Força** | `ad += 1,2` (Yasuo não é mago, não vira Poder) | `motor.js:442-443`, `motor.js:503` |
| **Vitalidade** | `vida += 20`, `regen += 0,1/s` | `motor.js:444-445`, `motor.js:503`, `motor.js:535` |
| **Resistência** | `armadura += 1,5`, `rm += 1` | `motor.js:446-447`, `motor.js:503` |
| **Agilidade** | `va += 0,008` (+0,8 % AS), `esquiva += 0,0025` (cap 25 %) | `motor.js:448-449`, `motor.js:503`, `motor.js:536` |
| **Foco (Yasuo)** | `−0,4 %` recarga (cap 30 %), `fluxoMult += 0,01` | `motor.js:457-467`, `motor.js:532`, `motor.js:537` |

**Vitalidade e Resistência não entram em nenhuma conta de dano** (`motor.js:503` só as usa em
`vida`/`armadura`/`rm`). O total do nível 14 é **39 pontos** (`3 × (nível−1)`).

### 2.2 Ganho marginal de 1 ponto

| atributo | build de hoje (647) | build ideal (5.296) |
|---|---|---|
| **Agilidade** | **+3,09 (+0,47 %)** | +10,57 (+0,20 %) |
| **Força** | **+2,68 (+0,41 %)** | **+18,83 (+0,36 %)** |
| Foco | +1,83 (+0,29 %) | +4,56 (+0,09 %) |
| Vitalidade · Resistência | **0** | **0** |

**Agilidade ganha enquanto a AS não põe o Q no mínimo de 1,5 s** (`motor.js:698`); depois da build a
**Força passa à frente** (AS já perto do teto de 3,0, `motor.js:344`).

### 2.3 A distribuição (39 pontos)

| distribuição | DPS hoje | DPS com a build ideal |
|---|---|---|
| **Força 20 · Agilidade 13 · Vitalidade 6** (= modelo `dano`, `motor.js:487`) | **+90 (14,9 %)** | **+525 (9,9 %)** |
| Força 19 · Agilidade 20 | +110 (18,1 %) | +585 (11,0 %) |
| Força 39 | +97 (16,1 %) | +734 (13,9 %) |
| Agilidade 39 | +112 (18,4 %) | +412 (7,8 %) |

**Recomendação: `Força 20 · Agilidade 13 · Vitalidade 6`** — é o preset `dano` que o
`distribuirAtributos` já sabe aplicar (`automation.js:1821-1843`); basta `cfg.modeloAtrib = 'dano'`
(hoje está `null` → `'equilibrado'`, `automation.js:1825`, cujos pesos são Força 2 · **Vitalidade 2 ·
Resistência 1** · Agilidade 1 · Foco 1, `motor.js:486` — **metade dos pontos em estatísticas de 0 de
dano**, que é a explicação estrutural da queixa `TODO.md:1148`).
Se `farm.deaths` continuar em 0, tirar os 6 de Vitalidade e pôr em Agilidade vale **+20 dps agora** e
**+60 com a build** (Força 19/Agilidade 20).

### 2.4 Vida ou resistência

EHP = `vida × (1 + armadura/100)`. Com vida 2.000 / armadura 90 / RM 72: **+1 Vitalidade = +38 de EHP
físico e +34 mágico** (+0,1 de regen/s); **+1 Resistência = +30 físico e +20 mágico**.
**Vitalidade vale 1,27× a Resistência no físico e 1,72× no mágico** — se for para aguentar, é Vitalidade.

---

## 3. Build

### 3.1 Agora, sem gastar ouro

| passo | entra | sai | DPS | Δ |
|---|---|---|---|---|
| hoje | `1001, 3044, 1018, 3133, 1036` | — | 647 | — |
| **+ grátis** | **`3047` Botas Galvanizadas** (na mochila) | `1001` Botas | 647 | 0 dps · **+25 de armadura, +20 de vida** |
| **+ grátis** | **`3077` Tiamat** (na mochila) | `1036` Espada Longa | **686** | **+39 (+6,0 %)** |
| + os 14 pontos de skill | — | — | **823** | +176 sobre o passo anterior |

O `3077` dá `25×1,15 = 28,75` de AD contra `11,5` da Espada Longa. O `3047` já foi eleito pelo **dado
medido** (885,3 ouro/min e 3.083 xp/min contra 860,6/2.717 das Botas simples, n=8 — `HANDOFF.md` §9.5i).
**Não vender o Tiamat**: é componente do `3074` Hidra Raivosa **e** do `6631` Quebrapassos; já foi
vendido por 600 uma vez (`HANDOFF.md` §9.6v). O `componentesDaBuild` (`automation.js:1489-1508`)
já o protege, e o `planBag` recusa vendê-lo (`automation.js:191-198`).

### 3.2 O gargalo real: **10 Adagas**

Expandindo as receitas de `buildIdeal()` recursivamente (`motor.js:3136`):

| item | receita | básicos que consome |
|---|---|---|
| `3172` Grevas Bélicas | `3006 + 3086` = (1001+1042+1042) + (1018+1042) | 1001, **1042×3**, 1018 |
| `3046` Dançarina | `1042 + 3086 + 1042` | **1042×3**, 1018 |
| `6631` Quebrapassos | `3077 + 3044 + 1042` = (1036+1036)+(1028+1036)+1042 | 1036×3, 1028, **1042** |
| `3085` Runaan | `3086 + 3144` = (1018+1042)+(1042+1042) | **1042×3**, 1018 |
| `3031` Gume do Infinito | `1038 + 1037 + 1018` | 1038, 1037, 1018 |
| **total** | | **1042×10**, 1018×4, 1036×3, 1001, 1028, 1038, 1037 |

O `analisarMontagem` exige **todos** os componentes na mão (`motor.js:3152-3155`) e o
`montarMelhorReceita` só monta receitas com `pode` e `custo ≤ ouro − 20.000`
(`automation.js:2789-2802`). **Com 64.300 de ouro o disponível é 44.300** — o `3006` (49.050) **não
passa**, e sem Adagas nenhuma receita arranca. É por isso que os 64.300 de ouro estão parados.
**Duas Adagas (1042, básico de 250) destrancam `3006`, `3086` e `3144` ao mesmo tempo.**

### 3.3 Ornn: o que custa e o que vale

`custoMontar` = épico `custo×3`; lendário `round(preço×4,8/50)×50` (`motor.js:3131-3135`).
`chanceMontar` = 1 % / 0,1 %, ×1,2 com VIP (`motor.js:3160-3161`). Com a **persistência**
(`motor.js:70`, `motor.js:75-80`) a esperança é **54,5 tentativas (épico)** e **492,7 (lendário)** —
reimplementei a soma de sobrevivência. (O jogo anuncia "em média 83" porque mostra `1/1,2 %`;
`HANDOFF.md` §9.6k mediu `1.500`/tentativa para o Tiamat, que bate com `custo 500 × 3`.)

| peça | ouro/tent. | **esperado** | horas a 855/min | DPS | Δ | **DPS por 1.000 de ouro** |
|---|---|---|---|---|---|---|
| **`3006` Grevas do Berserker** (épico, bota) | 900 | **49.050** | **1,0 h** | **859** | **+173** | **3,53** |
| `3144` Estilingue (épico) | 300 | 16.350 | 0,3 h | 721 | +36 | 2,17 |
| `3051` Machado Termestre (épico) | 750 | 40.875 | 0,8 h | 780 | +95 | 2,31 |
| `3086` Zelo (épico) | 1.050 | 57.225 | 1,1 h | 768 | +83 | 1,45 |
| `6670` Aljava (épico) | 1.050 | 57.225 | 1,1 h | 750 | +64 | 1,12 |
| `1053` Cetro Vampírico (épico) | 1.650 | 89.925 | 1,8 h | 673 | **−13** | negativo |
| qualquer **lendário** | 12.700–16.800 | **6,26 M – 8,28 M** | **122–161 h** | — | — | — |

> **Leitura dura: montar LENDÁRIO no Ornn é caminho morto (122-161 h de ouro).** Lendário vem de
> **drop** (25-50 h por item específico, §3.7) ou do **mercado**. **Épico no Ornn: sim (0,3-1,8 h).
> Lendário no Ornn: nunca.**

O `1053` sozinho **piora** o DPS (tira o Caulfield de 20 de AD e devolve 15 de AD + 7 % de roubo de
vida — e o roubo de vida só cura em `fonte === 'ataque'`, `motor.js:1226`); só faz sentido como
**componente da Hidra Raivosa**, com o Tiamat.

### 3.4 A receita a perseguir a seguir: **`3006` Grevas do Berserker**

1. É a **bota épica**: entra **já** (não depende de nenhum lendário) e dá **+173 dps** — o slot de botas
   hoje não dá AD nem AS. Receita `1001 + 1042 + 1042` (`itens.js`): ele tem a `1001` na mochila,
   faltam **2 Adagas**.
2. É **componente directo das `3172` Grevas Bélicas** — o passo não se perde quando o lendário cair.
3. É o **melhor ouro/dps do jogo** (3,53 dps por 1.000 de ouro).
4. **Nota operacional:** o script só a monta com `ouro − 20.000 ≥ 49.050` → precisa de **~69.100 de
   ouro** (`automation.js:2791-2792`). Com 64.300 ainda não passa: ou farmar ~6 min, ou chamar
   `montarItem('3006', …)` à mão.

Depois: `3144` (16.350) → `3051` (40.875) → `3086` (57.225, o mais reutilizável: componente de
`3172`, `3046` **e** `3085`) → `1053` **só** no caminho do Tiamat.

### 3.5 O Tiamat é um beco — e para onde aponta

| rota do Tiamat | receita | montar no Ornn |
|---|---|---|
| **`3074` Hidra Raivosa** | `3077 + 1053 + 3133` | lendário: 15.850 × 492,7 = **7,81 M (152 h)** |
| `6631` Quebrapassos | `3077 + 3044 + 1042` | lendário: 15.850 × 492,7 = **7,81 M (152 h)** |

**Hidra ganha**: numa base fixa `3172,3031,3046,3085`, a Hidra dá **4.699 dps** e o Quebrapassos fica
abaixo de 4.034 (**−14 %**). E a `3074` cai na **Rota Superior** (`motor.js:385`) — a mesma zona da
`3172` e da `3078`.

### 3.6 A build ideal — e os dois erros do `buildIdeal()`

`(derivado)` — busca exaustiva (4 botas × C(22,4)), mesma barra e ranks:

| conjunto | AD | AS | crítico | **DPS** |
|---|---|---|---|---|
| **`3172, 3031, 3046, 3074, 3085`** | 346 | 2,85 | 100 % | **4.699** |
| `3172, 3085, 3031, 3078, 3074` (= `docs/build-yasuo.md`) | 394 | 1,91 | 100 % | 4.506 |
| **`buildIdeal()` = `3172, 3046, 6631, 3085, 3031`** | 314 | 3,00 | 100 % | **3.969** |
| `buildIdeal()` trocando **6631 → 3074** | 346 | 2,85 | 100 % | **4.626 (+16,6 %)** |
| `buildIdeal()` trocando **6631 → 3078** | 308 | 3,00 | 100 % | 4.024 (+1,4 %) |

1. **O crítico do Yasuo satura cedo.** `critico = min(1; (critItens + critBase) × 2)` com
   `critBase(14) = 0,1252` (`motor.js:541`, `motor.js:697`) → o teto chega com **`critItens ≥ 0,3748`**:
   **dois** itens de 25 % (ou um de 25 % + a Capa da Agilidade) já dão 100 %. O `buildIdeal()` traz
   **três** (3046+3085+3031 = 0,75) → **0,375 de crítico jogados fora**.
2. **O erro que mais custa é o `6631` Quebrapassos**, não o crítico: trocá-lo pela `3074` Hidra Raivosa
   vale **+657 dps (+16,6 %)**. O Quebrapassos (40 AD + 25 % AS + 450 vida; proc de 0,8×AD a cada 5 s,
   `motor.js:1719`) é o slot mais fraco das cinco escolhas.
3. **O `buildIdeal()` também estoura o teto de AS**: `va = 1,75` → AS 2,39, e a Valsa da Dançarina
   (+30 %, `motor.js:1707`+`1666`) leva a **3,11** — acima de `VEL_ATAQUE_MAX = 3` (`motor.js:344`).

**Alvo: `3172, 3031, 3046, 3074, 3085`.** Mas os lendários não se montam (§3.3) — vêm de drop ou mercado.

### 3.7 Onde cada peça cai, e quanto tempo leva

`(derivado)` de `motor.js:383-392` e `chancesDrop` (`motor.js:1143-1149`):

| item | zona (lista lendária) | P(lend. específico)/abate | abates até 1 | horas |
|---|---|---|---|---|
| `3031` Gume do Infinito | **só Covil do Barão** | 0,00613 % | ~16.300 | 27-50 h |
| `3072` Sedenta | Campo Vermelho | 0,00618 % | ~16.200 | 27 h |
| `3085` Runaan · `3153` Rei Destruído | **só Rio** | 0,00538 % | ~18.600 | 31-50 h |
| `3046` Dançarina | Toca dos Lobos | 0,00444 % | ~22.500 | 37 h |
| **`3074` Hidra · `3078` Trindade · `3172` Grevas** | **Rota Superior** (`3172` também no Dragão) | 0,00358 % | ~27.900 | **46-49 h** |
| `6631` Quebrapassos | Rota Inferior | 0,00347 % | ~28.800 | 51 h |

Horas às taxas medidas (9,42 abates/min em Rota Superior, `docs/build-yasuo.md` §5.1; ~14,5 em Campo
Azul, derivado de 1.260 ouro/min ÷ 86,6 ouro/abate). **A Rota Superior é a zona dos 3 itens da build.**

### 3.8 A escada completa

| # | passo | custo | efeito |
|---|---|---|---|
| 1 | equipar `3047` + `3077` (já tem) | 0 | 647 → **686** |
| 2 | gastar os 14 pontos (§1.5) + barra Q,E,R,G | 0 | 686 → **823** |
| 3 | farmar **2 Adagas** (básico, 250) | ~30 min | destranca o Ornn |
| 4 | Ornn **`3006`** + equipar | 49.050 (1,0 h) | **+173** |
| 5 | Ornn **`3144`** (guardar: componente do Runaan) | 16.350 (0,3 h) | +36 |
| 6 | Ornn **`3051`** (componente da Trindade) | 40.875 (0,8 h) | +95 |
| 7 | Ornn **`3086`** (componente de 3172/3046/3085) | 57.225 (1,1 h) | +83 |
| 8 | Ornn **`1053`** → guardar com o Tiamat para a **Hidra** | 89.925 (1,8 h) | −13 agora, +657 com a Hidra |
| 9 | `3172` (drop em **Rota Superior**) | ~46 h de drop | fecha a bota (substitui o `3006`) |
| 10 | `3074` / `3078` (rota-sup) · `3085` (rio) · `3031` (barão) · `3046` (lobos) | 30-50 h cada | +2.000 a +3.000 no conjunto |

Passos 1-7 = **163.200 de ouro ≈ 3,2 h** e levam de 647 para ~1.100 de DPS. Os passos 9-10 são o muro
dos lendários.

---

## 4. Nível e região

### 4.1 A premissa do dono está invertida

> *"está nível 14 na região onde o recomendado é 10, já podia tá na região maior"*

**O Campo Azul recomenda 15–25** (`faixa: [15,25]`, `motor.js:363`; o rótulo do HUD é
"Campo Azul nível 15–25", `automation.js:450-456`). Ele está no **14** — **1 nível ABAIXO do chão da
zona**, não acima. Quem recomenda 10 é a **Toca dos Lobos** (`faixa: [10,20]`, `motor.js:361`).

E estar abaixo do chão **não custa loot**, por causa do clamp do spawn:
`nivel = max(n0, min(n1, nivelJogador − 2 + floor(rand×4)))` (`motor.js:1118-1119`). No nv14 os quatro
sorteios dão 12/13/14/15 → **todos clampados a 15**. O mob é nível 15 quer ele tenha 14, 15 ou 16.

### 4.2 A região que maximiza ouro + xp/min no nível 14

`(derivado)` — mesma fórmula do `estimarRegiao` (`automation.js:773-813`), onda de 3 e respawn 2,7 s:

| região | faixa | mob no nv14 | `fatorXp` | `fatorDanoJogador` | HP médio | abates/min | **ouro/min (teoria)** | **ouro/min (medido)** |
|---|---|---|---|---|---|---|---|---|
| Rota Inferior | 1–10 | 6 | 0,70 | 1,00 | 519 | 53,4 | 1.613 | — |
| **Rota Superior** | 5–15 | 13 | 1,00 | 1,00 | 1.489 | 37,8 | **2.071** | **766** (`HANDOFF` §9.12) |
| Toca dos Lobos | 10–20 | 13,5 | 1,00 | 1,00 | 1.647 | 35,5 | 1.824 | 569 |
| **Campo Azul** | **15–25** | **15** | 1,00 | 1,00 | 2.990 | 23,8 | 1.965 | **1.260** (n=8, §9.5t) |
| Campo Vermelho | 20–30 | 20 | 1,00 | 0,86 | 3.998 | 17,3 | 1.613 | ~600 |
| Rio | 25–35 | 25 | 1,00 | **0,51** | 4.258 | 10,2 | 790 | — |
| Fosso do Dragão | 30–40 | 30 | 1,00 | **0,25** | 5.805 | 4,0 | 446 | — |
| Covil do Barão | 40–50 | 40 | 1,00 | **0,25** | 8.050 | 2,8 | 423 | — |

**[INDECIDÍVEL] — e é o P0 do plano.** As duas leituras contradizem-se:

- a **teoria** (a minha e a do `estimarRegiao`) diz **Rota Superior** (+5 % de ouro sobre o Campo Azul);
- o **medido** do próprio script (n=8) diz **Campo Azul** (**+64 %** de ouro sobre a Rota Superior).

A teoria sobrestima nas duas (Campo Azul: 1.965 teóricos vs 1.260 medidos; Rota Superior: 2.071 vs 766)
— **mas sobrestima a Rota Superior muito mais** (2,7× contra 1,56×). E o próprio `regiaoIdeal()` foi
corrigido para **preferir o medido quando há amostra (n ≥ 3)** (`automation.js:3657-3682`), pelo que
**hoje ele devolve `azul`** (`HANDOFF.md` §9.12: `regiaoIdeal: "azul"`).

**Recomendação: ficar no Campo Azul** (é o que o dado medido diz e é o que o script faz) e **fechar a
contradição com um A/B controlado** (T1, §6) — 30 min em cada zona, mesma build e nível, com o contador
de loot junto (`farm.cycles[].mobFase.perMin`). **Não decidir por teoria**: foi exactamente esse o erro
que o §9.12 do `HANDOFF` corrigiu.

### 4.3 Quanto custa "a região maior" agora

`fatorDanoJogador = max(0,25; 1 − 0,07×dif)` com `dif = max(0; mob − jogador − 4)` (`motor.js:1184-1187`):

| destino | dif | o meu dano | o dano deles | ouro/min (teoria) | vs Campo Azul |
|---|---|---|---|---|---|
| Campo Azul (15–23) | 0 | ×1,00 | ×1,00 | 1.965 | — |
| Campo Vermelho (20–28) | 2 | ×0,86 | ×1,30 | 1.613 | −18 % |
| Rio (25–33) | 7 | **×0,51** | **×2,05** | 790 | **−60 %** |
| Fosso do Dragão (30–38) | 12 | **×0,25** (piso) | **×2,80** | 446 | **−77 %** |
| Covil do Barão (40–48) | 22 | ×0,25 (piso) | ×3,00 (teto) | 423 | **−78 %** |

**Ir para "a região maior" hoje é a decisão mais cara do plano**: no Rio ele perde ~60 % do ouro/min e
passa a levar 2,05× mais dano. Não há trava de nível para viajar (`viajar` não checa nível,
`motor.js:3043-3048`) — a armadilha é o `NIVEL_DIF`, não a porta.

### 4.4 Em que nível devia estar

| nível | o que destrava | mob no Campo Azul | ouro/abate |
|---|---|---|---|
| 14 (hoje) | — | 15/15/15/15 | 80,0 |
| **15** | **Q → rank 8** (+9,6 dps) · A → 2 · +3 pontos de atributo | 15/15/15/16 | 84,6 |
| **16** | **R → rank 3** · E/W → rank 8 · G → 5 | 15/15/16/17 | 85,4 |
| 19 | Q/W/E → rank 10 (tecto) | 17/18/19/20 | 90,0 |
| 25 | R → rank 4 | 23/23/23/23 | — |

`(derivado)` dos caps (`motor.js:905-912`) e do clamp (`motor.js:1118-1119`).

**Resposta: ele não está "atrasado" — está a 1 nível do chão da zona e isso não lhe custa loot.** Os
níveis que interessam são o **15** (destrava o 15.º ponto e o Q rank 8) e o **16** (R rank 3). Ao ritmo
medido (4.719 xp/min, §9.5t) faltam **0,75 h para o 15** e **1,08 h** do 15 para o 16.
Cada morte custa 10 % de `xpParaNivel` (`motor.js:430`) = **21.300 de xp = 4,5 min de farm** — é o
único argumento a favor da Parede de Vento (§1.5) e da Vitalidade (§2.3).

---

## 5. Plano ordenado por custo/benefício

**P0 — agora, custo 0**

| # | acção | ganho | `file:linha` |
|---|---|---|---|
| 1 | **Barra → Q · E · R · G** (tirar a W, pôr o R no slot vazio) | +68 dps; a ultimate deixa de estar morta | `motor.js:1578`, `motor.js:2067-2069` |
| 2 | **Gastar 14 pontos**: G1 → E5 → E6 → E7 → R2 → G2 → G3 → G4 → W3…W7 | **+136 dps** | `motor.js:698-712`, `motor.js:905-912` |
| 3 | Guardar 1 ponto para o nv15 → **Q 7→8** | +9,6 dps | `motor.js:910` |
| 4 | Equipar **`3047`** e **`3077`** (mochila) | +39 dps, +25 arm, +20 vida | `itens.js` |
| 5 | `cfg.modeloAtrib = 'dano'` → **Força 20 · Agilidade 13 · Vitalidade 6** | +90 dps | `motor.js:487`, `automation.js:1821-1843` |
| 6 | Corrigir (fora do write scope): `ratio × (é de AD ? ad : ap)` no `dpsPorHabilidade`; valor para G/A; R na barra em `rotacaoSkills`; ler `meta.ordemHab` | a extensão deixa de queimar 5 pontos na W | `automation.js:983` vs `automation.js:2111-2112` |
| 7 | Trocar o alvo do `buildIdeal()` para **`3172,3031,3046,3074,3085`** | +16,6 % sobre a ideal actual | `automation.js:2976-3002` |

**P1 — 30 a 60 minutos**

8. **Farmar 2 Adagas** (básico, 250) — sem elas nenhuma receita do Ornn arranca (§3.2).
9. **Ornn `3006` Grevas do Berserker** + equipar → **+173 dps**. O script só a monta com ouro ≥ 69.100
   (`automation.js:2791-2792`); com 64.300, farmar ~6 min ou chamar `montarItem('3006', …)` à mão.
10. **A/B de região** (T1) — é o único `[INDECIDÍVEL]` que muda a decisão de rota.

**P2 — horas**

11. Ornn `3144` (16.350) · `3051` (40.875) · `3086` (57.225) — todos componentes de lendários da build.
12. Ornn `1053` (89.925) **só** para completar a Hidra com o Tiamat.
13. Vigiar o **mercado** para `3172`/`3085`/`3031`/`3074`/`3046`: a regra de bolso é **comprar abaixo de
    `horas de drop × 60 × 855`** — 30 h × 60 × 855 = **1,54 M de ouro**. Qualquer preço abaixo disso é
    lucro sobre farmar o drop (`HANDOFF.md` §9.5f; o preço real é o T6).

**P3 — longo**

14. Drops: `3074`/`3078`/`3172` na **Rota Superior**; `3046` nos Lobos; `3085` no Rio; `3031` no Barão.
15. **Nunca** montar lendário no Ornn. Épico, sim.

---

## 6. `indecidivel-sem-jogo` — o que a matemática não fecha

| # | pergunta | por que não fecha | teste que decide |
|---|---|---|---|
| **T0** | 15 ou 14 pontos de habilidade? | o nv14 dá 14 ranks (`motor.js:2801`); o HUD diz 15 | ler `#hab-pontos` (`jogo.js:6608`: "N livres · usados/total ranks") e `#hud-pontos-txt` (`jogo.js:6533`) |
| **T1** | **Qual região ganha medido no nv14** — Rota Superior (teoria) ou Campo Azul (medido)? | a teoria erra o ranking; só há n=8 numa das zonas | 30 min em cada, mesma build/nível, com o contador de loot; comparar `farm.cycles[].mobFase.perMin` |
| **T2** | `attackspeed` e `attackspeedperlevel` do Yasuo | `dados-yasuo.js` **ausente** (`motor.js:4`); uso 0,697 e 3,5 % porque `recargaQYasuo` divide por `0,697` (`motor.js:2056`) | ler `#st-va` (`jogo.js:6461`) sem item de AS e com 1 Adaga (+10 %) |
| **T3** | `vida`, `hpperlevel`, `armor`, `spellblock` do Yasuo | mesma causa do T2; só o AD (`adBase 60`/`adNivel 3,9`) é conhecido | ler `#hud-vida-txt`/`#hud-armadura` e comparar com `atributos()` |
| **T4** | O Q acerta mesmo 2,7 alvos (tornado a cada 3 + `eqCombo`)? | `d.eqCombo` depende do tempo real E→Q (`motor.js:2092`, `motor.js:1384`) | contar eventos `habilidade {tecla:'Q'}` com `giro`/`tornado` (`motor.js:2137`) |
| **T5** | Taxa real de mortes por hora no Campo Azul (dá valor ao W e à Vitalidade) | não há `farm.deaths` na medição dada | `farm.deaths` por hora com W rank 2 vs rank 7 |
| **T6** | Preço real de **compra** no mercado | a fórmula é do servidor; `market.json` são anúncios da própria conta | registar o preço pago em `comprarNoMercado` (`automation.js:3242`) |
| **T7** | O E acumula ×1,5 em alvo único? | `eAcumT = 5` e o lockout por alvo é 6 s (`motor.js:2089-2091`, `motor.js:1393`) | eventos `dano {fonte:'E'}` no mesmo alvo |

---

## 7. Resposta curta

1. **Skills (15 pontos):** cabem **14** no nv14 (a Q está no teto de 7). Ordem:
   **G1 → E5 → E6 → E7 → R2 → G2 → G3 → G4 → W3…W7** = **+136 dps**; o 15.º no nv15 em **Q→8** (+9,6).
   Barra: **Q · E · R · G** (o R volta: 30 % de penetração por 15 s). A W é a reserva.
2. **Atributos (39 pontos):** **Força 20 · Agilidade 13 · Vitalidade 6** (+90 agora, +525 com a build).
   Vitalidade e Resistência valem **0 de dano**; a Agilidade ganha à Força **enquanto a AS for baixa**.
3. **Build:** equipar **Tiamat** e **Botas Galvanizadas** já (+39 dps) e **não vender o Tiamat**;
   **farmar 2 Adagas** (é o que destranca o Ornn); **montar o `3006` Grevas do Berserker** (49.050,
   **+173 dps**, 3,53 dps/1.000 de ouro — o melhor negócio do jogo); épicos no Ornn **sim**, lendários
   no Ornn **nunca** (122-161 h); a build ideal do script tem **um slot errado** (o `6631` → `3074` vale
   +16,6 %).
4. **Nível e região:** ele está no **Campo Azul (recomendado 15–25)**, ou seja **1 nível ABAIXO do chão**
   — não acima de uma zona de nível 10 (essa é a Toca dos Lobos). Estar no 14 não lhe custa loot (o
   spawn clampa em 15). A região que maximiza ouro+xp/min **medido** é o **Campo Azul (1.260 ouro/min,
   n=8)**; a teoria diz Rota Superior — contradição a fechar com o A/B (T1). As zonas "maiores" (Rio,
   Dragão, Barão) custam **60 a 78 %** do ouro/min e levam 2,05× a 3× mais dano. O nível que interessa
   é o **15** (0,75 h) e o **16**.

---

## Progressao — IDEAL vs ATUAL (Katarina nv 29, medido 2026-10-14)

| eixo | IDEAL | ATUAL | accao exacta |
|---|---|---|---|
| itens equipados | 3175, 3089, 3135, 3100, **6653** | 3175, 3089, 3100, **4629**, 3135 | comprar/montar `6653` — nao dropa (0,004%, 0/h) |
| mochila | so o que serve | 18 itens, zero basicos | vender 9 epicos + 4 duplicados no Lojista |
| skills: pontos | 0 | **0** (ranks somam 29 = nivel) | nada |
| skills: barra | `[R,Q,A,W]` | `[Q,A,G,F]` 4/4 | `aplicarBarra()` quando o auto-play correr |
| atributos | 0 | **0** | nada |
| nivel/regiao | maximiza ouro+xp/min | nv 29 em Fosso do Dragao [30,40] | manter (zona acima do nivel) |
| ouro | — | 9.600.000 | sobra para o Rabadon (3500) |

### Ordem de accao (por retorno medido)

1. **Comprar o `6653`** (Liandry) — e o unico slot que difere da build ideal e o drop e ~0.
2. **Nao perseguir o Rabadon como drop** — Covil do Barao [40,50] mata-a (`sobreviveMob=false`,
   `chefeFatal=true`). Comprar (3500) ou montar com 2x `1058` do Fosso do Dragao.
3. **Barra** — a ultimate `R` (rank 3/5) esta fora enquanto `G` e `F` (rank 1/10) ocupam slots.
4. **Regiao** — Fosso do Dragao [30,40] ja e a zona do `1058` e esta acima do nivel dela.

### Armadilhas de medicao (custaram tempo)

- `#hud-pontos` mostra SEMPRE `"+ Pontos para usar "` (rotulo fixo), mesmo com 0 pontos.
  A verdade e `readSkills().pontos`.
- `planejar(ids)` devolve **array** e exige `ids`; sem argumento devolve `[]` (nao e "motor vazio").
- `planoEquipar().ids` e um **Set**, nao array.
- `--context-origin` escolhe o contexto isolado MAIS NOVO e ha varios da mesma extensao sem
  `window.__lolidleAuto` — da falso `noEngine`. Varrer `--list-contexts` e **parsear** o JSON
  (comparar substring `"no":true` falha: as aspas vem escapadas).
- Config: escrever SEMPRE pelo `setConfig()` do motor. `chrome.storage.local.set` cru e desfeito
  porque a copia em MEMORIA do content script repoe-se por cima.
