# Caminho da build do Yasuo — do nível 1 ao 50, em papel

> **Método:** leitura estática de `docs/game-src/` + reimplementação aritmética das fórmulas do motor.
> Nenhum browser, nenhum CDP, nenhum jogo. Tudo o que está aqui sai de `motor.js` e `itens.js`
> (e de `balanco.js` só para as curvas de monstro).
> **Regra:** cada número tem `file:linha`. Onde não se consegue provar, está escrito **NAO VERIFICADO**.

## 0. Como ler (e o que é incógnita)

| marca | significado |
|---|---|
| **CÓDIGO** | a linha diz literalmente aquilo — `arquivo:linha` |
| **DERIVADO** | reimplementei a fórmula citada e calculei |
| **INFERIDO** | não está escrito, mas só há uma leitura possível do código — digo qual |
| **NAO VERIFICADO** | não sai de `docs/game-src/` |

### 0.1 As incógnitas (e porque não estragam a conclusão)

`motor.js:11` importa `./dados-yasuo.js`, e desde 2026-10-14 **esse ficheiro existe** em
`docs/game-src/dados-yasuo.js` (lido do jogo vivo, Data Dragon 16.19.1). Dele vêm
`hp, hpperlevel, armor, armorperlevel, spellblock, attackspeed, attackspeedperlevel`
(aplicados em `motor.js:508`, `motor.js:509` e `motor.js:547`).

O que **é** conhecido:

- **AD base 60 e +3,9 por nível** — `motor.js:894` (`adBase: 60, adNivel: 3.9`), aplicados sobre a curva
  de crescimento `g(n) = (n−1)(0,7025+0,0175(n−1)) + max(0, n−18)` (`motor.js:447-450`).
  → AD base: nv10 **90,2** · nv20 **134,1** · nv30 **173,1** · nv45 **231,6** · nv50 **251,1** (DERIVADO).
- **AS base 0,697** — INFERIDO de `motor.js:2056`: `recargaQYasuo` divide a recarga por
  `max(1, velAtaque/0.697)`, ou seja, 0,697 é a velocidade de ataque de referência (100%).
- **AS por nível: 3,5% — LIDO.** `dados-yasuo.js` (vivo, 16.19.1) traz `attackspeedperlevel: 3.5`
  e o motor aplica-o: `motor.js:547` — `velAtaque = min(MAX, attackspeed × (1 + (attackspeedperlevel/100) × g + va))`.
  Era exactamente o valor testado no sensitivity de §4.3 (1%/2%/3,5%/5%: o conjunto óptimo é o
  mesmo em todos os casos; só o DPS absoluto muda).
- Vida/armadura: **LIDO** — `hp 590 + 110/nível` e `armadura 32 + 4,6/nível` (`motor.js:508`).
- RM: `spellblock 32` de base, mas **o motor usa 3,5 fixos por nível** (`motor.js:509`,
  `rm = b.spellblock + 3.5 * g`) — o `spellblockperlevel: 2.05` do ficheiro **não é usado pelo jogo**.
  Nenhum dos três entra em decisão de build — o que decide item é AD, crítico, AS e os efeitos de item.

**Consequência prática:** os DPS absolutos das tabelas são "de papel" (ordem de grandeza, com AS/lvl 3,5%);
as **comparações entre itens** (quem entra, quem fica de fora, em que ordem) são robustas porque
todas as peças passam pelo mesmo fator de AS.

---

## 1. A TEORIA DO JOGO — as sete leis que decidem QUALQUER build

Todas as contas de dano do jogo passam por `golpear` (`motor.js:1192-1234`):

```
dano = mitigar(bruto, arm) × (1 + grito + 0,01×disciplina + buffBarao)   motor.js:1211
     × papel.dano (× papel.arena em Runeterra)                          motor.js:1212
     × (crítico ? danoCritico : 1)                                      motor.js:1213
     × (+15% se o alvo é chefe e tens 3036)                             motor.js:1214
     × fatorDanoJogador (monstro acima do teu nível)                    motor.js:1221
```

`mitigar(dano, arm) = dano × 100/(100+arm)` (`motor.js:1167`). **Isto é tudo.**

| # | lei | valor | fonte |
|---|---|---|---|
| L1 | chance de crítico | `min(1, (critItens + critBase) × critMult)` — **teto 100%** | `motor.js:541` |
| L2 | dano do crítico | `1,75` (+0,4 com 3031) × `critDano` do campeão | `motor.js:499,515,541` |
| L3 | velocidade de ataque | `min(3, ASbase × (1 + asLvl×g + va))` — **teto 3,0** | `motor.js:344,534` |
| L4 | redução de recarga | `min(0,4, min(0,3, 0,004×foco) + cdrItens)` — **teto 40%** | `motor.js:537` |
| L5 | penetração mágica | `min(0,6, 0,4 se 3135 + pct.penMag)` — **teto 60%** | `motor.js:529` |
| L6 | esquiva | `min(0,25, 0,0025×agilidade + pct.esquiva)` — **teto 25%** | `motor.js:536` |
| L7 | penetração de armadura | **sem teto**, multiplicativa: `1−(1−penE)×(0,7 se 3036)` | `motor.js:516,539` |

E o que **multiplica** o dano de verdade (tudo verificado item a item em §6):

- **efeitos "on-attack" que copiam o golpe para outros alvos** — Runaan 55% em 2 alvos
  (`motor.js:1718`), Hidra Raivosa 40% do AD em todos os outros (`motor.js:1720`);
- **efeitos que escalam com a vida DO MONSTRO** — Rei Destruído, 5% da vida atual com teto
  `3×CURVA.hp(nível do monstro)` (`motor.js:1702` + `1190-1191`);
- **procs por habilidade que escalam com o AD BASE (nível, não ouro)** — Força da Trindade,
  `+2×AD base` por ataque armado (`motor.js:1672,1697`);
- **multiplicadores de item no total** — `adPct` (Grevas Bélicas +6%, `itens.js:1963`, aplicado em
  `motor.js:523`), `vidaPct`, `armPct`.

### 1.1 O "Poder" do jogo **não** mede dano

`poder(estado)` (`motor.js:246-249`) = `nível×40 + Σ preço×refino×qualidade/10`. É um score de
**preço**. Exemplo que se vê na prática: o Gume do Infinito (3500) dá **350** de Poder e o Furacão de
Runaan (2650) dá **265** — mas em DPS de grupo o Runaan vale **−47,5%** e o IE **−29,7%** (§4.2).
Quem escolhe item pelo Poder escolhe errado.

---

## 2. A SUA TEORIA — o que o kit do Yasuo pede

O kit está em `motor.js:696-729` (P, Q, W, E, R, G, A, D, F, T, B, M, N) e a passiva decide tudo:

| peça do kit | o que faz | fonte |
|---|---|---|
| **P — Estilo do Errante** | `critMult: 2` (**dobra** o crítico), `critDano: 0,8` (**−20%** no dano do crítico), `critBase(n) = min(0,18, 0,1+0,0018n)` (crítico de graça por nível), `escudoFluxo(n) = 80+28n` | `motor.js:697` |
| **Q — Tempestade de Aço** | base `40+20r` + `0,55×AD`; **pode critar**; 2 cargas viram tornado (levanta até 5); recarga **cai com a AS** | `motor.js:698, 2124, 2127, 2134` |
| **E — Espada Ágil** | `50+18r` + `(0,2+0,01r)×AD`, **dano mágico**; acumula +25% até +50%; 6 s por monstro | `motor.js:703, 2089-2091` |
| **R — Último Suspiro** | `200+110r` + `(1+0,08r)×AD` em quem está no ar; **−30% de armadura por 15 s** | `motor.js:706, 2071-2072` |
| **D — Lâmina Inquieta** (nv18) | cada **crítico** dá AS por 4 s, até 5 acúmulos | `motor.js:714, 1711` |
| **papel do campeão** | `dano: 1,15` (+15% em tudo), `recebido: 0,85` | `motor.js:881` |

**A leitura "de kit" é, então:** crítico (dobrado), velocidade de ataque (o Q volta mais rápido e a
passiva D empilha com críticos) e AD. É a leitura correta de LoL — e é **parcialmente** a leitura do
motor. Onde divergem está em §3.

### 2.1 O Q e a AS: o número exato (não o "de LoL")

`recargaQYasuo = max(1,5 ; recarga[r] / max(1, AS/0,697))` e **depois** `×(1−reduçãoRecarga)`
(`motor.js:2056` e `motor.js:1581`). (DERIVADO)

| rank do Q | recarga base (`serie(4, −0,15)`) | AS para bater no piso de 1,5 s |
|---|---|---|
| 1 | 4,00 s | **AS ≥ 1,859** |
| 5 | 3,40 s | AS ≥ 1,580 |
| 10 | 2,65 s | **AS ≥ 1,231** |

Com a build de §4 o Yasuo tem AS **1,69 (nv10) → 2,57 (nv45)**: o Q está no piso desde o nível ~10.
Acima disso, AS só serve ao ataque básico (e à passiva D).

---

## 3. SUA TEORIA × TEORIA DO JOGO — onde divergem (com números)

### D1 — O crítico do Yasuo vale **menos** que no LoL, mas capa **mais depressa**

- Chance: `min(1, (critItens + critBase)×2)` (`motor.js:541`). No nv50 o `critBase` = 18%
  (`motor.js:697`) → **36% de crítico de graça**, sem um único item.
- Dano: `(1,75 + 0,4)` × **0,8** = **1,40 sem IE, 1,72 com IE** (`motor.js:499, 515, 541`) — DERIVADO.
  O IE é, portanto, **+22,9% em cima de cada acerto crítico** (1,72/1,40 − 1), e não os +40% que o
  texto do item sugere (`itens.js:2556`).
- Teto: precisa de `0,5 − critBase` de crítico **de itens** para capar. (DERIVADO)

| nv | critBase | crítico "de graça" | crítico de itens p/ capar | 2 itens de 25% dão | desperdício |
|---|---|---|---|---|---|
| 10 | 11,8% | 23,6% | 38,2% | 100,0% | **23,6%** |
| 20 | 13,6% | 27,2% | 36,4% | 100,0% | **27,2%** |
| 30 | 15,4% | 30,8% | 34,6% | 100,0% | **30,8%** |
| 40 | 17,2% | 34,4% | 32,8% | 100,0% | **34,4%** |
| 50 | 18,0% | 36,0% | 32,0% | 100,0% | **36,0%** |

**Regra dura: no máximo 2 itens de crítico.** O terceiro entra no lixo — e é por isso que a build
final tem exatamente 2 (Runaan 25% + IE 25%) e nenhum dos outros três tem crítico.

### D2 — O maior multiplicador da build **não é** AD nem crítico: é o Runaan

`motor.js:1718`: corpo a corpo = **55% do `bruto` em 2 alvos extra E esses acertos podem critar**
(só quem ataca de longe leva os 15% sem crítico). O `bruto` já inclui o proc da Trindade
(`motor.js:1697` vem antes do 1718). Numa wave de 3 monstros (a wave é 2–4, `motor.js:1124`):

| alvos | Runaan dá | Hidra Raivosa dá |
|---|---|---|
| 2 | +55% do bruto | +40% do AD |
| 3 | **+110% do bruto** | +80% do AD |
| 4 | +110% (máx. 2 cópias) | +120% do AD |

Um item de "atirador" é o **coração** de uma build de espadachim. Nenhuma leitura de kit prevê isto.

### D3 — A Trindade escala com o **nível**, não com o ouro

`lamina(a) = 2` com a Força da Trindade (`motor.js:1672`); `d.trindade` é armado a **cada
habilidade usada** (`motor.js:1583`) e consumido no próximo ataque: `bruto += 2 × AD base`
(`motor.js:1697`). O AD base **não inclui itens nem pontos de atributo** (`motor.js:495,497`).
(DERIVADO)

| nv | AD base | proc da Trindade por ataque armado |
|---|---|---|
| 1 | 60,0 | +120 |
| 10 | 90,2 | +180 |
| 20 | 134,1 | +268 |
| 30 | 173,1 | +346 |
| 45 | 231,6 | +463 |
| 50 | 251,1 | +502 |

Com Q a 1,5 s e E a 2,15 s (rank 10), a fração de autos armados é ~30–50% (§4.4): na prática é
**quase um segundo ataque por auto**, e é o que faz da Trindade a 2.ª peça mais importante da build.

### D4 — A penetração de armadura rende **pouco** até ao Barão

`mitigar` é `100/(100+arm)` (`motor.js:1167`) e a armadura dos monstros é `5+1,5×nível` × o
multiplicador da espécie (`motor.js:276`, `281-297`). Os 30% do Dominik (`motor.js:539`) valem:
(DERIVADO)

| zona | armadura efetiva | mitigação sem pen. | com 3036 | ganho |
|---|---|---|---|---|
| Rota Inferior | 4,9 | 95,3% | 96,7% | **+1,4%** |
| Rota Superior | 11,1 | 90,0% | 92,8% | +3,1% |
| Lobos | 20,8 | 82,8% | 87,3% | +5,4% |
| Campo Azul | 46,9 | 68,1% | 75,3% | +10,6% |
| Rio | 63,1 | 61,3% | 69,4% | +13,1% |
| Barão | 75,7 | 56,9% | 65,4% | **+14,8%** |

Contra o Barão ainda soma `×1,15` (`motor.js:1214`) → **+32%**. Antes do nível 25, o Dominik é
quase inútil.

### D5 — O melhor item de chefe é o que escala com a vida **do monstro**

`motor.js:1702`: `bruto += 0,05 × vidaRefItem(alvo, alvo.hp)`, com
`vidaRefItem = min(vida, 3×CURVA.hp(nível do monstro))` (`motor.js:1190-1191`). (DERIVADO)

| zona (nível do monstro) | teto do item | dano por auto |
|---|---|---|
| Rota Superior (nv9) | 3.393 | +170 |
| Rio (nv29) | 11.673 | +584 |
| Barão (nv44) | 19.458 | **+973** |

No Barão, um auto "vale" ~600 (AD + proc) e o Rei Destruído acrescenta **~973 por auto** — mais do
que o resto da build junta. Nada no kit do Yasuo pede este item.

### D6 — A passiva D (crítico → AS) só acende com crítico **de verdade**

`motor.js:1711`: o acúmulo só sobe quando o `critico` do ataque é `true`. Com 100% de crítico
(2 itens), ela fica sempre a 5 acúmulos: `5 × 0,066 = +33%` de velocidade de ataque no rank 10
(`serie(0,03; 0,004)`, `motor.js:714`; aplicado em `motor.js:1667`) — +15% no rank 1.
Com 50% de crítico, metade dos autos não empilha. **A passiva D é um argumento a mais para capar o
crítico depressa** — e um argumento **contra** o 3.º item de crítico (já está capado).

---

## 4. A BUILD — matemática

Modelo (DERIVADO, reimplementação de `motor.js:492-544` + `1673-1722` + `2057-2137`):
auto a `velAtaque` Hz; Q a `1/recargaQ`; E a `1/2,15` mas no máximo 1×/6 s no mesmo alvo
(`motor.js:2089`); Trindade armada na fração `(1/recargaQ + 1/6)/AS` dos autos; crítico pela
esperança `(1−c) + c×danoCritico`; Runaan e Hidra como em D2; E sem mitigação (§4.1).
Ranks de Q e E = 10.

### 4.1 A build alvo (1 bota + 4)

**FARM / WAVE (a build principal):**

> **`3172` Grevas Bélicas · `3085` Furacão de Runaan · `3031` Gume do Infinito · `3078` Força da Trindade · `3074` Hidra Raivosa**

**CHEFE / ALVO ÚNICO (troca 2 peças):**

> **`3172` Grevas Bélicas · `3153` Espada do Rei Destruído · `3031` Gume do Infinito · `3078` Força da Trindade · `3036` Lembranças do Lorde Dominik**

| nv / zona | AD | AS | crítico | dano do crítico | DPS (3 alvos) |
|---|---|---|---|---|---|
| 10 · Rota Superior | 314 | 1,69 | 100% | 1,40 | **3.547** |
| 20 · Campo Vermelho | 361 | 1,96 | 100% | 1,40 | **4.028** |
| 30 · Rio | 402 | 2,21 | 100% | 1,40 | **4.225** |
| 45 · Barão | 464 | 2,57 | 100% | 1,40 | **4.828** |
| 50 · Barão | 485 | 2,69 | 100% | 1,40 | **5.240** |

Composição do dano no nv45 (3 alvos): auto 1.778 + Runaan 1.955 + Hidra 625 + Q 357 + E 114.
**O Runaan sozinho é 40% do dano.** (DERIVADO)

### 4.2 Contribuição marginal de cada peça (nv45, Barão, 3 alvos, base 4.828)

| tira | DPS fica | custa |
|---|---|---|
| `3085` Runaan | 2.537 | **−47,5%** |
| `3078` Trindade | 3.356 | −30,5% |
| `3031` IE | 3.393 | −29,7% |
| `3074` Hidra Raivosa | 3.750 | −22,3% |
| `3172` Grevas Bélicas | 4.013 | −16,9% |

Soma 147% — a build é **sinérgica**: nenhuma peça sozinha chega perto.

### 4.3 Robustez (a incógnita do AS não muda o veredito)

Busca sobre os 108 itens (hill-climbing com 400 reinícios, restrições: 1 bota + 4, cada lendário uma vez
— `motor.js:2869-2891`): (DERIVADO)

| AS por nível | conjunto ótimo (nv45, grupo) | conjunto ótimo (nv20, grupo) |
|---|---|---|
| 1,0% | 3085+3078+3031+3074+3172 | 3085+3078+3172+3031+3074 |
| 2,0% | 3085+3078+3031+3074+3172 | 3085+3031+3078+3074+3172 |
| 3,5% | 3085+3172+3078+3031+3074 | 3085+3031+3078+3074+3172 |
| 5,0% | 3085+3031+3172+3078+3074 | 3078+3085+3074+3172+3031 |

**O mesmo conjunto, quatro vezes.** O que muda é só o DPS absoluto (3.802 → 5.402 no nv45).

---

## 5. O CAMINHO — nível 1 ao 50

### 5.0 Primeiro: onde cada peça da build **pode** aparecer

Tabela `DROPS` do motor (`motor.js:383-392`), classe `ad` (o Yasuo não é campeão de magia:
`motor.js:881` não tem `magia: true`, e é isso que escolhe o pool em `motor.js:408,1151-1152`):

| zona (tier) | faixa ideal | lendários que interessam | básicos que interessam |
|---|---|---|---|
| Rota Inferior (0) | 1–10 | **3078 Trindade**, 6631 Quebrapassos | 1036, 1042, 1001, 1028, 2022, 1029, 1054 |
| Rota Superior (1) | 5–15 | **3172 Grevas Bélicas**, **3074 Hidra Raivosa**, 3078 | **1018 Capa da Agilidade**, 1036, 1028, 1120, 1033, 1006 |
| Lobos (2) | 10–20 | 3046 Dançarina Fantasma, 6333 Dança da Morte | **1037 Picareta**, 1018, 1042, 1001, 1029 |
| Campo Azul (3) | 15–25 | 3071 Cutelo Negro | 1033, 1006, 2022, 1028, 1120 |
| Campo Vermelho (4) | 20–30 | **3072 Sedenta por Sangue**, 3168, 3748, 2501 | **1038 Espada G. p. C.**, 1037, 1036, 1028, 1054 |
| **Rio (5)** | 25–35 | **3085 Runaan**, **3153 Rei Destruído**, **3036 Dominik** | 1042, 1018, 1038, 1001 |
| Dragão (6) | 30–40 | 6610 Céu Dividido, 3742 Couraça do Defunto, 3172 | 1037, 1038, 1029, 1028, 1120 |
| **Barão (7)** | 40–50 | **3031 Gume do Infinito**, 3026, 3053, 6673 | 1038, 1037, 1018, 1054 |

**Leitura:** 3 das 5 peças da build caem na Rota Superior e no Rio — as duas zonas mais baratas de
farmar. O IE só existe no Barão.

### 5.1 Estágio a estágio (o que vestir, em ordem)

O motor **não deixa comprar item**: o Lojista só compra o saque e vende poções (`jogo.js:6645, 6945`)
e o Ornn só monta receita (`motor.js:3136, 3175`). Logo o começo é **100% drop** (ou mercado de
jogadores, cujo preço vem do servidor — NAO VERIFICADO). A coluna "melhor conjunto" é a busca de §4.3
restrita ao que **já pode ter caído** até aquele nível (zonas com `faixa[0] ≤ nv`), 3 alvos: (DERIVADO)

| nv | zona alvo | melhor conjunto | AD | AS | crítico | DPS |
|---|---|---|---|---|---|---|
| 3 | Rota Inferior | 3078 Trindade + 6631 Quebrapassos + 3077 Tiamat + 3144 Estilingue | 167 | 1,26 | 21% | 680 |
| 8 | Rota Superior | 3074 Hidra + 3078 + 6631 + 1018 + 3172 | 269 | 1,53 | 53% | 1.406 |
| 12 | Rota Superior | 3078 + 3074 + 3046 Dançarina + 3172 + 6631 | 286 | 2,09 | 74% | 1.925 |
| 18 | Lobos | 3074 + 3078 + 3172 + 3046 + 6631 | 315 | 2,26 | 76% | 2.093 |
| 22 | Campo Vermelho | 3078 + 3074 + 3172 + 3046 + 3072 Sedenta | 374 | 2,19 | 78% | 1.954 |
| 28 | Rio | **3085 Runaan** + 3172 + 3078 + 3074 + 3036 Dominik | 351 | 2,16 | **100%** | 3.299 |
| 33 | Dragão | 3085 + 3172 + 3078 + 3074 + 3036 | 372 | 2,28 | 100% | 3.646 |
| 45 | Barão | **3031 IE** + 3085 + 3078 + 3172 + 3074 | 464 | 2,57 | 100% | **4.828** |
| 50 | Barão | 3085 + 3031 + 3172 + 3078 + 3074 | 485 | 2,69 | 100% | 5.239 |

O salto grande é o **nível 28** (o Rio): entra o Runaan e o crítico capa (2 itens de 25% + 1018).
O segundo salto é o **nível 45** (o Barão): entra o IE.

### 5.2 A ordem de prioridade (o que procurar primeiro)

Ordenada pelo que a matemática diz (marginal de §4.2 e disponibilidade de §5.0):

1. **`3078` Força da Trindade** — cai já na **Rota Inferior** (tier 0) e é a 2.ª peça mais valiosa
   (−30,5%). É a primeira coisa a guardar/equipar.
2. **`3172` Grevas Bélicas** e **`3074` Hidra Raivosa** — caem na **Rota Superior** (tier 1, nv 5–15).
   Valem −16,9% e −22,3%. São golpes **separados** (o Runaan copia o `bruto` do auto, `motor.js:1718`;
   a Hidra é um `golpear` à parte, `motor.js:1720`) — somam-se, não se multiplicam.
3. **`1018` Capa da Agilidade** (básico, 600 de preço, **+15% de crítico** — `itens.js:300`) — duas
   delas são 30% de crítico de itens, que a passiva dobra para **+60%** (mais os ~24–36% que vêm do
   nível, `motor.js:697,541`). É o melhor básico do jogo para ele e cai na Rota Superior, nos Lobos,
   no Rio e no Barão.
4. **`3085` Furacão de Runaan** — só no **Rio** (nv 25–35). É a peça mais valiosa da build (−47,5%):
   vale a pena farmar o Rio só por ela.
5. **`3031` Gume do Infinito** — só no **Barão** (nv 40–50). Último a entrar, fecha a build.
6. **`3153` Rei Destruído** / **`3036` Dominik** — peças de **chefe** (Rio, nv 25–35): são o que troca
   a Hidra/Runaan quando o alvo é o Barão ou o Dragão.

### 5.3 O que **não** vale a pena (nesta build)

| item | por que fica de fora |
|---|---|
| `3046` Dançarina Fantasma | +65% AS e +25% crit: o **3.º crítico** estoura o teto (§3-D1). É a melhor muleta enquanto não há Runaan (aparece no estágio do nv12) |
| `6673` Arco-escudo Imortal | +55 AD e +25% crit — outro 3.º crítico |
| `3057` Fulgor | `lamina = 1` (`motor.js:1672`): metade do proc da Trindade. Muleta, não destino |
| `6631` Quebrapassos | +80% do AD em área a cada 5 s (`motor.js:1719`) — bom no início (nv3), perdido no meio da build |
| `3071` Cutelo Negro | −30% de armadura no alvo (`motor.js:1705`) sofre do mesmo mal do Dominik (§3-D4) e dá menos AD |
| `3003/3089/3135/...` | itens de mago: o Yasuo **não** é `magia` (`motor.js:881`), logo `poder` nunca liga (`motor.js:1201`) e o AP não faz nada |
| `2501` Suserano | `ad += 0,02×vida bônus` (`motor.js:514`): escala com vida, e o Yasuo não compra vida |
| `6333` Dança da Morte | +60 AD mas os +50 de armadura são stat morto para farm |

---

## 6. A conta de cada item que entra (verificação item a item)

| id | item | linha | o que o motor faz com ele |
|---|---|---|---|
| `3172` | Grevas Bélicas | `itens.js:1963` | +30 AD, **+45% AS**, +6% roubo de vida e **+6% de AD total** (`adPct`, aplicado em `motor.js:509-510,523`) |
| `3085` | Furacão de Runaan | `itens.js:1440` | `motor.js:1718`: 55% do bruto em 2 alvos extra, **com crítico** para corpo a corpo |
| `3031` | Gume do Infinito | `itens.js:2534` | +75 AD, +25% crit e `danoCritico += 0,4` (`motor.js:515`) → 1,40 → 1,72 |
| `3078` | Força da Trindade | `itens.js:2484` | `lamina = 2` (`motor.js:1672`) → `+2×AD base` por auto armado (`motor.js:1697`) |
| `3074` | Hidra Raivosa | `itens.js:2384` | `motor.js:1720`: 40% do AD em **todos** os outros; +65 AD e +12% de roubo de vida |
| `3153` | Rei Destruído | `itens.js:2263` | `motor.js:1702`: 5% da vida atual, com teto `3×CURVA.hp` (`motor.js:1190-1191`) |
| `3036` | Dominik | `itens.js:2360` | `motor.js:539` (30% de pen. multiplicativa) + `motor.js:1214` (+15% contra chefe) |
| `1018` | Capa da Agilidade | `itens.js:300` | básico, +15% de crítico → ×2 da passiva = **+30%** |

---

## 7. O MÉTODO — para QUALQUER campeão (é isto que se traduz)

Não são os valores; é a receita. Dada a **classe**, o **kit** e a **tabela de itens**:

**Passo 1 — colher o kit em números.** No motor, o kit é um objeto (`motor.js:864-895`):
`adBase/adNivel`, `magia`, `semMana`, `fluxo`, `distancia`, `papel`, e o `hab` com `ratio`,
`base`, `recarga`, `critMult/critDano/critBase`, `magico`, `pen`.
→ **De cada kit saem 3 perguntas:** (a) o dano escala com AD ou com AP? (b) o dano sai de **auto**
(crit/AS) ou de **habilidade** (recarga/AP)? (c) o campeão tem multiplicador próprio (critMult,
ratio de AD base, dano mágico que ignora armadura)?

**Passo 2 — achar a CLASSE do pool.** `classeItem` (`motor.js:22`) e `classeDe` (`motor.js:1152`)
decidem o que **pode** cair: `magia: true` no kit → pool `ap`; senão → pool `ad`
(`motor.js:408, 1151`). Um item da classe errada é zero.

**Passo 3 — escrever a função de dano do campeão.** Copiar `golpear` (`motor.js:1192-1234`) e
`golpeBasico` (`motor.js:1673-1722`) e somar, para **um ciclo sustentado**:
`DPS = AS × (auto + cópias de item) + (1/recargaQ)×Q + (1/recargaE)×E + ...`, com o crítico pela
esperança `(1−c) + c×danoCritico`, cada fonte a passar pelo seu `mitigar` (**habilidade `magico` de
campeão não-mago não sofre mitigação nenhuma** — `motor.js:1201-1202`).

**Passo 4 — listar os TETOS.** Só existem estes: crítico 1,0 (`541`), AS 3,0 (`344`),
redução de recarga 0,4 (`537`), pen. mágica 0,6 (`529`), esquiva 0,25 (`536`). Para cada um:
"com quantos itens eu chego lá?" → **o item que passa do teto é dinheiro queimado**. No Yasuo é o
crítico; num campeão de recarga é a CDR; num mago é a pen. mágica.

**Passo 5 — ordenar as peças por marginal, não por preço.** Tirar cada peça do conjunto e medir o que
cai (§4.2). É a única medida honesta — o `Poder` do jogo mede preço (`motor.js:246-249`) e mente.

**Passo 6 — cruzar com o DROPS.** A tabela `DROPS`/`DROPS_AP` (`motor.js:383-406`) diz **onde** cada
peça existe. A ordem de procura é: `marginal × 1/raridade da zona`, restrita às zonas cuja
`faixa[0] ≤ nível` (`motor.js:354-379`). Não vale teorizar uma peça que só cai no Barão se o
campeão está no nível 12.

**Passo 7 — separar as duas builds.** Contar alvos: itens que **copiam golpe** (Runaan `1718`,
Hidra `1720`, Quebrapassos `1719`, Hidra Titânica `1721`) valem por `nAlvos−1`; itens de
**% da vida do monstro** (Rei Destruído `1702`, Liandry `1207`) valem contra **chefe** e valem zero
contra monstro fraco. Todo campeão tem, no mínimo, uma build de wave e uma de chefe.

**Passo 8 — validar com a incógnita.** Repetir a busca com o parâmetro desconhecido (aqui, AS por
nível) em 1%–5%: se o conjunto não muda, a conclusão é robusta; se muda, é preciso medi-lo no jogo
(`#st-va` no HUD, `jogo.js:6461`).

---

## 8. Confronto com `docs/build-yasuo.md` (documento irmão, mesma lane)

Concorda no essencial: **o conjunto ótimo é o mesmo** (Grevas + Runaan + IE + Trindade + Hidra) e a
leitura do Runaan como coração da build é a mesma. Divergências de número:

| ponto | `build-yasuo.md` | aqui | porquê |
|---|---|---|---|
| AS que satura o Q | 1,580 | **1,231 no rank 10** (1,859 no rank 1) | aquele valor corresponde ao rank 5 (`motor.js:698` + `2056`) |
| DPS nv45 Barão | 4.188 (3 alvos) | 4.828 (3 alvos) | modelo diferente para a fração de autos armados pela Trindade |
| AS/lvl usado | 3,5% (**LIDO**: `dados-yasuo.js` + `motor.js:547`) | 1%–5% (testado) | §4.3 mostra que o conjunto não muda |

## 9. O que ficou NAO VERIFICADO

1. ~~`hp, hpperlevel, armor, armorperlevel, spellblock, attackspeed, attackspeedperlevel` do Yasuo~~ —
   **RESOLVIDO 2026-10-14**: `docs/game-src/dados-yasuo.js` (vivo) + onde o motor os aplica
   (`motor.js:508`, `:509`, `:547`). Nota: o RM por nível do jogo é 3,5 fixo (motor.js:509),
   não o 2,05 do ficheiro.
2. ~~O crescimento de AS por nível~~ — **RESOLVIDO**: 3,5%/nível, lido de `dados-yasuo.js`
   (`attackspeedperlevel: 3.5`) e aplicado em `motor.js:547`.
3. Os preços do **mercado de jogadores** — vêm do servidor (`jogo.js:2580-2587`), não do cliente.
4. Se o servidor **aceita e persiste** o campo `ignorarBasicos` no save (ver `docs/filtro-basicos.md`).
5. Nada foi medido em execução: todos os números são leitura estática + aritmética.
