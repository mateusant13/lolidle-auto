# Build ideal do Yasuo — derivada das fórmulas do motor

> **Lane:** build-lane (M1) · **task-6** · 2026-10-14
> **Regra desta lane:** nenhum browser/jogo/CDP. Tudo abaixo sai de leitura estática +
> reimplementação aritmética das fórmulas de `docs/game-src/*.js`.
> **Fonte de verdade do Yasuo:** `motor.js` (fórmulas e passivas hardcoded por id) e `itens.js`
> (catálogo). `balanco.js` só entra nas curvas de monstro.
> **Estado medido usado como âncora:** `docs/snapshots/yasuo.json` (nv10, equipado
> `1001~C, 1018~B, 1036~A, 3044~A, 1042~C`).

---

## 0. O que é prova, o que é derivado, o que é incógnita

| tipo | significado | como está marcado |
|---|---|---|
| **CÓDIGO** | li a linha e ela diz literalmente aquilo | `arquivo:linha` |
| **DERIVADO** | reimplementei a fórmula do código e calculei | `(derivado)` + a fórmula citada |
| **MEDIDO** | veio do `docs/snapshots/yasuo.json` (jogo real, capturado antes) | `(medido)` |
| **INDECIDÍVEL** | não sai da matemática — precisa de teste no jogo | `indecidivel-sem-jogo` |

### A incógnita que sobra: `dados-yasuo.js` não está no repositório

`motor.js:4` importa `./dados-yasuo.js`, mas o ficheiro **não existe** em `docs/game-src/`
(confirmado por `motor-map.md` §9.4). Dele viriam `hp, hpperlevel, armor, armorperlevel,
spellblock, attackspeed, attackspeedperlevel`. Sem ele:

- **AD base é conhecido**: `adBase: 60, adNivel: 3.9` estão no motor (`motor.js:881`) e o
  crescimento é `(n−1)(0.7025+0.0175(n−1)) + max(0,n−18)` (`motor.js:434-437`).
- **AS base é quase conhecido**: `recargaQYasuo` divide por `0.697` (`motor.js:2056`) — esse
  literal é a AS base do Yasuo. O **crescimento por nível é desconhecido**.
- Vida/armadura/RM: calibrei contra o snapshot (§0.1).

### 0.1 Calibração contra o snapshot (medido)

`g = crescimento(10) = 7.74` (`motor.js:434`). Itens equipados (`infoItem`, `motor.js:251-255`):
`1001~C` → 72 vida, 4.5 armadura · `1018~B` → 15% crit · `1036~A` → 11.5 AD ·
`3044~A` → 17.25 AD, 230 vida · `1042~C` → 9% AS.

| grandeza | conta | resultado | medido |
|---|---|---|---|
| vida | 590 + 128×7.74 + 302 (itens) + 20×V | 1882.7 + 20V | **1883** → V = 0 |
| AD | 60 + 3.9×7.74 + 28.75 + 1.2×F | 118.9 + 1.2F | **127** → F ≈ 7 |
| armadura | 32 + 4.6×7.74 + 4.5 + 1.5×R | 72.1 + 1.5R | **78** → R ≈ 4 |
| RM | 32 + 3.5×7.74 + R | 59.1 + R | **63** → R ≈ 4 |

As quatro linhas fecham com **hp 590 / hpperlevel 128 / armor 32 (+4.6) / spellblock 32** e
**11 pontos de atributo gastos (7 Força, 4 Resistência)**. Isso é hipótese calibrada, não leitura
— mas fecha os 4 números medidos com erro ≤ 0.1, então uso como base. **Nada nesta build depende
disso**: o que decide item é o AD base (conhecido) e a AS base (0.697), não a vida.

---

## 1. As cinco regras do Yasuo que decidem a build

**(1) O crítico dobra e chega fácil no teto.**
`critico = min(1, (critItens + critBase) × 2)` e `critBase = min(0.18, 0.1 + 0.0018×nv)`
(`motor.js:541` + `motor.js:697`). No nv10 o Yasuo já tem **23.6% de crítico sem item nenhum**.
Dano do crítico: `(1.75 + 0.4 se 3031) × 0.8` (`motor.js:499`, `515`, `541`) = **1.40 sem IE,
1.72 com IE** — ou seja, o IE é **+22.9% de dano em cima de todo acerto crítico**.

**(2) O Q escala com velocidade de ataque e crítico.**
`recargaQYasuo = max(1.5, recarga[r−1] / max(1, AS/0.697))` (`motor.js:2056`, usada em `motor.js:2124`),
e o resultado **ainda** leva `×(1−CDR)` (`motor.js:1581`). O Q pode critar (`motor.js:2127`, `2134`).
Com AS ≥ **1.580** o Q bate no mínimo de 1.5 s (sem CDR) — acima disso, AS só serve para o auto.

**(3) O E ignora armadura por completo.**
O E é `magico: true` (`motor.js:703`) mas o Yasuo **não** é campeão de magia, então em
`golpear` o `poder` fica `false` e `arm = 0` (`motor.js:1201-1202`): **dano cheio, sem mitigação**.
Contra a Tropa de Cerco (24 de armadura no nv10) o auto perde 19% e o E perde 0%.
O E acumula `×(1+0.25×acum)`, até ×1.5 (`motor.js:703`, `2090-2091`), e trava 6 s por alvo
(`mesmoAlvo: 6`, `motor.js:2089`) — **em grupo ele encadeia em alvos diferentes, em alvo único não**.

**(4) A Lâmina Encantada re-arma a cada habilidade e é copiada pelo Runaan.**
`usar()` faz `d.trindade = lamina(a)` a cada habilidade (`motor.js:1583`); `lamina` = **2** com
Força da Trindade (3078), **1** com Fulgor (3057), 0 sem nenhum (`motor.js:1672`). O próximo auto
soma `lamina × AD base` (`motor.js:1697`) — no nv10 isso é **+180 de dano** com Trindade.
E como o Runaan usa o `bruto` **depois** do proc (`motor.js:1697` vs `1718`), esses +180 são
copiados para os 2 alvos extras a 55%.

**(5) O papel do Yasuo.** `papel: { dano: 1.15, recebido: 0.85 }` (`motor.js:881`): +15% de dano
e −15% de dano recebido contra monstros.

### Composição do dano no nv10 (build atual do snapshot, Rota Superior)
`(derivado)`

| fonte | DPS | fatia |
|---|---|---|
| auto-ataque | 122 | 54% |
| Q (Tempestade de Aço) | 81 | 35% |
| E (Espada Ágil, ignora armadura) | 25 | 11% |
| **total (1 alvo)** | **229** | |

O **auto manda**, o Q é quase tão importante, o E é coadjuvante em alvo único.

---

## 2. Os CAPS, um por um — e qual deles morde de verdade

| cap | valor | fonte | morde no Yasuo? |
|---|---|---|---|
| chance de crítico | 1.0 (100%) | `motor.js:541` | **SIM, e é o mais importante.** Com 2 itens de 25% o Yasuo já passa de 100% |
| velocidade de ataque | 3.0 | `motor.js:344`, aplicado em `534` | só no nv20+ com AS/lvl 3.5%; no nv10 não é alcançável |
| redução de recarga | 40% (Foco contribui no máx 30%) | `motor.js:537` | **NÃO** — o Yasuo AD só tem 5% disponível (Partícula Brilhante) |
| penetração mágica | 60% | `motor.js:529` | **NÃO** — nenhum item AD dá pen. mágica |
| esquiva | 25% | `motor.js:536` | só com ~80+ pontos de Agilidade |
| penetração de armadura | multiplicativa, sem cap | `motor.js:539` | não é cap, é 30% do 3036 |
| Q: recarga mínima | 1.5 s | `motor.js:698` (`minima`) | **SIM** — AS ≥ 1.580 estoura o mínimo |

### 2.1 Cap do crítico (o único que desperdiça stat na prática)

`(derivado)` — precisa-se de `0.5 − critBase` de crítico **de itens** para capar:

| nv | critBase | crítico "de graça" | crítico de itens p/ capar | 2 itens de 25% dão | desperdício |
|---|---|---|---|---|---|
| 10 | 11.8% | 23.6% | 38.2% | 123.6% | **23.6%** |
| 20 | 13.6% | 27.2% | 36.4% | 127.2% | **27.2%** |
| 30 | 15.4% | 30.8% | 34.6% | 130.8% | **30.8%** |
| 40 | 17.2% | 34.4% | 32.8% | 134.4% | **34.4%** |
| 50 | 18.0% | 36.0% | 32.0% | 136.0% | **36.0%** |

**Regra prática: no máximo 2 itens de crítico (ou 1 de 25% + 1 de 15%).** O 3º item de crítico
já entra no lixo. Foi exatamente isso que a busca numérica mostrou: a build ótima tem
**exatamente 2** itens de crítico (Runaan 25% + IE 25%) e os outros dois slots são AD puro
(Trindade, Hidra) — nenhum dos dois tem crítico.

### 2.2 Cap da velocidade de ataque

`AS = min(3, 0.697 × (1 + (asLvl/100)×g + va))` (`motor.js:534`). `(derivado)`

| nv | AS base (AS/lvl 3.5%) | `va` necessário p/ capar | máximo com 4 itens de AS |
|---|---|---|---|
| 10 | 0.886 | +239% | 2.48 (não capa) |
| 20 | 1.161 | +159% | 3.25 (**capa**) |
| 30 | 1.404 | +114% | 3.93 (**capa**) |
| 50 | 1.892 | +59% | 5.30 (**capa**) |

O `asLvl` é a incógnita do `dados-yasuo.js`. **A conclusão não muda** entre 1% e 3.5%: no nv10 o
cap de 3.0 não é alcançável, e a partir do nv20 ele pode ser alcançado **se você empilhar AS**.
Nesse caso o excedente é 100% desperdiçado — **nunca empilhe mais de 2 itens de AS a partir do nv20**.

### 2.3 O teto real de AS é o Q, não o cap

`(derivado)` — `AS = 2.2667 × 0.697 = 1.580` faz o Q bater no mínimo de 1.5 s.
A build ideal (Grevas Bélicas + Runaan + Trindade) já chega a **AS 1.69 no nv10** → **o Q já está
no mínimo**. AS adicional só aumenta o auto (54% do dano), então continua valendo, mas com
retorno decrescente para o Q.

---

## 3. A build ideal (matemática pura, sem restrição de disponibilidade)

Método: reimplementei `atributos()` (`motor.js:492-544`) + a rotação sustentada
(auto a `a.velAtaque` Hz, Q a `1/recargaQYasuo`, E a 6 s por alvo, R quando há alvos no ar) e
busquei o melhor conjunto de **1 bota + 4** por *hill-climbing* sobre os 108 itens.
Cenário "grupo" = 3 monstros em alcance (a wave do Rift é 2–4, média 3 — `motor.js:1124`).

### 3.1 Farm / wave (2–4 monstros) — a build principal

**`3172` Grevas Bélicas · `3085` Furacão de Runaan · `3031` Gume do Infinito · `3078` Força da Trindade · `3074` Hidra Raivosa**

| nv | zona | DPS (3 alvos) |
|---|---|---|
| 10 | Rota Superior | **2942** |
| 20 | Campo Vermelho | **3222** |
| 30 | Rio | **3447** |
| 45 | Barão | **4188** |

Contribuição marginal de cada peça (`(derivado)`, nv20, grupo 3) — tirar o item e ver o que cai:

| item | tirar custa | leitura |
|---|---|---|
| 3085 Runaan | **−1564 dps (−94%)** | é o coração da build de grupo |
| 3031 Gume do Infinito | −1082 dps (−51%) | +75 AD, +25% crit e +0.4 no multiplicador |
| 3078 Trindade | −1041 dps (−48%) | +36 AD, +30% AS e +180 por auto armado |
| 3074 Hidra Raivosa | −787 dps (−32%) | +65 AD e 40% do AD em todos os outros |
| 3172 Grevas Bélicas | −643 dps (−25%) | +30 AD, +45% AS, +6% AD total, +6% roubo de vida |

A soma dá 250% — ou seja, **a build é sinérgica**: nenhum item sozinho chega perto.

### 3.2 Alvo único / chefe

`(derivado)` A build de grupo perde o Runaan (não há "outros"). A ótima muda:

| nv | build de alvo único | DPS 1 alvo |
|---|---|---|
| 10 | Grevas Bélicas · IE · Trindade · Dançarina Fantasma · Sedenta | 1526 |
| 20 | Grevas Bélicas · IE · Trindade · Dominik · Cutelo Negro | 1690 |
| 45 | idem nv20 | 2322 |

A diferença é pequena no mob (**+10%**), então **não vale manter dois conjuntos** para mob.

### 3.3 Chefe de zona — aí sim muda tudo

Contra o Barão (nv49, 119.216 de vida, 141 de armadura) `(derivado)`:

| build | DPS | tempo p/ matar |
|---|---|---|
| grupo (Runaan+IE+Trindade+Hidra+Grevas) | 1728 | 69 s |
| alvo único com pen (Grevas+IE+Trindade+Dominik+Cutelo) | 2526 | 47 s |
| **Grevas + IE + Trindade + Sedenta + `3153` Rei Destruído** | **3116** | **38 s** |

O **`3153` Espada do Rei Destruído** vale um slot de chefe por causa do on-hit de 5% da vida
**atual** (`motor.js:1702`) com teto `vidaRefItem = min(vida, 3×CURVA.hp(nv))`
(`motor.js:1190-1191`). No Barão nv49 o teto é 3 × 7.451 = 22.353 → **1.117 de dano por auto,
sem crítico, sem armadura**. Com AS 1.65 isso é ~1.845 DPS só do item.
O **`3036` Dominik** (30% de pen. + 15% vs chefe, `motor.js:539`, `1214`) rende **menos** que o
Rei Destruído mesmo contra 141 de armadura — a penetração é multiplicativa e o alvo já tem
mitigação de 50%.

> **Nota de honestidade:** a penetração de armadura rende pouco neste jogo porque a armadura dos
> monstros é baixa. No nv10 a Tropa Corpo a Corpo tem 12 de armadura → mitigação 0.893. Os 30% do
> Dominik levariam a 8.4 → 0.923, ou seja **+3.4% de dano**. É por isso que o Dominik não entra na
> build principal.

---

## 4. A conta de cada item: por que entra ou fica de fora

Todos os números abaixo são `(derivado)` sobre o núcleo ideal no nv20 / Campo Vermelho / 3 alvos
(3222 DPS). "g/dps" = preço de tabela ÷ dano marginal (menor é melhor).

### 4.1 ENTRAM

| id | item | linha | por que entra | marginal |
|---|---|---|---|---|
| `3172` | Grevas Bélicas | `itens.js:1963` | +30 AD, **+45% AS**, +6% roubo de vida, **+6% de AD total** (`adPct`, `motor.js:523`). É a única bota com AS + AD + lifesteal ao mesmo tempo | −25% se sair |
| `3085` | Furacão de Runaan | `itens.js:1440` | corpo a corpo = **55% do bruto em 2 alvos extras E pode critar** (`motor.js:1718`); o bruto inclui o proc da Trindade | −94% |
| `3031` | Gume do Infinito | `itens.js:2534` | +75 AD, +25% crit e `danoCritico += 0.4` (`motor.js:515`) → 1.40 → **1.72** | −51% |
| `3078` | Força da Trindade | `itens.js:2484` | `lamina` = **2** (`motor.js:1672`) → +2×AD base por auto armado; +36 AD +30% AS | −48% |
| `3074` | Hidra Raivosa | `itens.js:2384` | +65 AD, +12% roubo de vida e 40% do AD em todos os outros (`motor.js:1720`) | −32% |
| `3153` | Rei Destruído | `itens.js:2263` | **slot de chefe**: 5% da vida atual por auto com teto (`motor.js:1702`) | +23% vs Barão |
| `3072` | Sedenta por Sangue | `itens.js:2509` | +80 AD (o maior AD do jogo) + 15% de roubo de vida; o excedente vira escudo (`motor.js:1229`) | −9.7% se entrar no lugar da Hidra |

### 4.2 FICAM DE FORA (e por quê)

| id | item | por que fica de fora |
|---|---|---|
| `3046` | Dançarina Fantasma | **+65% AS +25% crit** é bom, mas o 3º item de crítico estoura o cap (§2.1) e o Runaan dá mais dano em grupo (−35% ao trocar). **É a muleta nº1 quando não há Runaan** |
| `3036` | Dominik | 30% de pen. é pouco contra armadura baixa (+3.4% no nv10) e o item perde 40 AD para o IE |
| `3071` | Cutelo Negro | −30% de armadura do alvo (`motor.js:1705`) sofre do mesmo problema do Dominik; entra na build de alvo único por falta de coisa melhor |
| `6673` | Arco-escudo Imortal | +55 AD +25% crit +6% vida: o 3º crítico estoura o cap; −19.6% |
| `3086` | Zelo | épico honesto (+15% AS +15% crit) mas −29% no lugar da Trindade |
| `3057` | Fulgor | proc de **1×** AD base (`motor.js:1672`) = metade da Trindade; −23.4%. **É a muleta nº1 da Trindade** |
| `6631` | Quebrapassos | +80% do AD em área a cada 5 s (`motor.js:1719`) é bom, mas −37.7% vs Runaan |
| `3748` | Hidra Titânica | 1.5% da vida máxima em área (`motor.js:1721`) — no nv20 dá menos que a Hidra Raivosa |
| `6333` | Dança da Morte | +60 AD mas os +50 de armadura são stat morto para farm (o dano recebido é só 61/s, §6) |
| `2501` | Suserano | `ad += 0.02 × vida bônus` (`motor.js:514`) — escala com vida, e o Yasuo não constrói vida |
| `3003`, `3089`, `3135`, `3175`… | itens de mago | `poder` só é ligado para campeões `magia` (`motor.js:1201`) — **o Yasuo não usa AP nem pen. mágica** |
| `3170` | Marcha Célere | +5% esquiva (`itens.js:1512`) mas zero dano; o cap de esquiva é 25% e o Yasuo não investe Agilidade |
| `3168` | Caminho Imortal | +40 AD, +12% roubo de vida, +5% vida (`itens.js:1764`): é bota e perde para as Grevas Bélicas (−12.9%) |

### 4.3 Stats que são **desperdício puro** no Yasuo

| stat | item que dá | por que é lixo |
|---|---|---|
| **mana** | `1027`, `3070`, `3802`… | o Yasuo usa **Fluxo**, `manaMax = FLUXO_MAX = 100` fixo (`motor.js:520`); mana de item é ignorada |
| **AP / pen. mágica** | todos os itens de mago | `poder` nunca liga para o Yasuo (`motor.js:1201`) |
| **crítico além de ~38% de itens** | 3º item de crítico | cap de 100% (§2.1) |
| **AS além de 3.0** | empilhar 3–4 itens de AS no nv20+ | cap (`motor.js:344`, `534`) |
| **RM** | `1033`, `1120`, `3211`… | os monstros só têm dano mágico em 3 espécies (`Tropa Mago`, `Sentinela Azul`, `Dragão Infernal` — `motor.js:283`, `287`, `296`) |

---

## 5. Ordem de compra / escada de aquisição

### 5.0 Antes de tudo: **não existe loja de itens**

`LOJA` (`motor.js:3654-3670`) só vende skin, poção, reset e bênção. Itens só vêm de
**3 caminhos**: (a) drop de monstro (`motor.js:1153-1165`), (b) **Ornn** (`motor.js:3135-3162`),
(c) **mercado entre jogadores** (`motor.js:106`). Logo "custo acumulado" tem três leituras:
preço de tabela, ouro de Ornn e horas de farm — dou as três.

### 5.1 O custo de cada caminho (`(derivado)` de `motor.js:1143-1163` e `3131-3162`)

Chance de **um lendário específico** por abate = `chance da raridade ÷ nº de itens da lista`.
Taxas medidas no snapshot: Rota Superior 9,42 abates/min e 641,8 ouro/min.

| zona | lendário específico | épico específico | básico específico |
|---|---|---|---|
| Rota Inferior | 8.929 abates ≈ 14,9 h | 1.786 ≈ 3,0 h | 121 ≈ 0,2 h |
| **Rota Superior** | **27.966 abates ≈ 49,5 h** | **3.497 ≈ 6,2 h** | **237 ≈ 0,4 h** |
| Lobos | 22.532 ≈ 37,2 h | 4.688 ≈ 7,7 h | 284 ≈ 0,5 h |
| Campo Azul | 21.298 ≈ **86,2 h** | 5.263 ≈ 21,3 h | 397 ≈ 1,6 h |
| Campo Vermelho | 16.174 ≈ 27,0 h | 4.545 ≈ 7,6 h | 500 ≈ 0,8 h |
| Rio | 18.575 ≈ 31,0 h | 4.800 ≈ 8,0 h | 421 ≈ 0,7 h |
| Dragão | 21.333 ≈ 35,6 h | 4.286 ≈ 7,1 h | 556 ≈ 0,9 h |
| Barão | 16.304 ≈ 27,2 h | 3.871 ≈ 6,5 h | 471 ≈ 0,8 h |

*(as horas de Rota Superior/Lobos/Azul usam o kills/min medido; as outras usam 10 abates/min por
extrapolação — ver §10.)*

**Ornn** (`custoMontar`, `motor.js:3135`; tentativas médias 60,6 para épico e 554,6 para lendário,
calculadas da persistência de `motor.js:68-79` — bate com o comentário do código, `motor.js:3158-3159`):

| item | ouro esperado no Ornn | horas de ouro a 642/min |
|---|---|---|
| `3133` Caulfield (épico) | 18.182 | 0,5 h |
| `3006` Grevas do Berserker (épico) | 54.545 | 1,4 h |
| `3086` Zelo (épico) | 63.636 | 1,7 h |
| `3044` Fago (épico) | 63.636 | 1,7 h |
| `3057` Fulgor (épico) | 118.181 | 3,1 h |
| qualquer **lendário** | **7,0 M – 9,3 M** | **183 – 242 h** |

> **Conclusão dura:** montar lendário no Ornn custa ~200 h de ouro. **É um caminho morto.**
> Lendário vem de drop (27–50 h) ou do mercado. Épico no Ornn (0,5–3,1 h) é **mais barato que
> farmar o drop do épico** (6–21 h) — para épico, Ornn ganha.

### 5.2 A escada (build atual → ideal), com custo acumulado

Partindo do que ele **já tem** (`1001~C, 1018~B, 1036~A, 3044~A, 1042~C` = **243 DPS** de grupo).
`(derivado)`, nv10, Rota Superior, 3 alvos. Cada passo é "troca o pior slot por este item":

| # | item | região do drop | preço tabela | acumulado | DPS | ganho |
|---|---|---|---|---|---|---|
| 0 | *estado atual do snapshot* | — | — | — | 243 | — |
| 1 | `3078` Força da Trindade | rota-inf **ou** rota-sup (lendário) | 3.333 | 3.333 | 457 | +214 |
| 2 | `3074` Hidra Raivosa | **rota-sup** (lendário) | 3.300 | 6.633 | 700 | +243 |
| 3 | `3172` Grevas Bélicas | **rota-sup** (lendário) / dragão | 3.000 | 9.633 | 1.010 | +310 |
| 4 | `3046` Dançarina Fantasma | **lobos** (lendário) | 2.650 | 12.283 | 1.309 | +299 |
| 5 | `3072` Sedenta por Sangue | **vermelho** (lendário) | 3.400 | 15.683 | 1.575 | +266 |
| 6 | `3085` Furacão de Runaan (troca a Dançarina) | **rio** (lendário) | 2.650 | 18.333 | 2.350 | +775 |
| 7 | `3031` Gume do Infinito (troca a Sedenta) | **barão** (lendário) | 3.500 | 21.833 | **2.942** | +592 (×12,1 vs atual) |

**Os 3 primeiros são todos da Rota Superior** — é onde o Yasuo deve viver até o nv20. A escada
chega a **1.575 DPS (×6,5)** sem sair de rota-sup + lobos + vermelho.

### 5.3 O que fazer com o ouro (a decisão que a matemática **não** fecha)

O tempo de farmar um lendário específico (27–50 h) é **10–20× maior** que o tempo de farmar o
ouro para comprá-lo no mercado, *se* o preço for o que os anúncios sugerem
(`docs/snapshots/market.json` mostra lendários anunciados de 18.000 a 288.900 — mas **são os
anúncios da própria conta**, com botão "Cancelar"; é preço pedido, não preço de compra).

> `indecidivel-sem-jogo`: **preço real de compra no mercado.** O `motor.js` não tem a fórmula
> (o mercado é do servidor). O teste que decide: `comprarNoMercado` (TODO §12) já lê
> `[data-comprar]` e escolhe o mais barato da build ideal — basta registrar o preço pago.
> Enquanto isso, a regra de bolso é: **se o lendário aparecer por menos que
> (horas de drop × 60 × 642) de ouro, comprar; senão, farmar.** Para a Rota Superior isso é
> 49,5 h × 60 × 642 = **1,9 M de ouro** — qualquer preço abaixo disso é lucro.

---

## 6. Sustento — o que muda no farm longo

`(derivado)`, nv10, Rota Superior, 3 monstros. Recebido = `Σ mitigar(ad_monstro, defesa) ×
fatorDanoMonstro × 0.85` (`motor.js:1733-1734`, `2697`, `1186`). Cura = `regen` (`motor.js:535`)
+ `roubo de vida × DPS de auto` — **roubo de vida só cura em `fonte === 'ataque'`**
(`motor.js:1226`): **Q, E e R não curam**.

| build | vida | roubo de vida | cura/s | recebido/s | saldo |
|---|---|---|---|---|---|
| atual do snapshot | 1883 | **0%** | 0 | 60 | **−60/s** |
| ideal de grupo (Hidra 12% + Grevas 6%) | 1914 | 18% | 146 | 61 | **+85/s** |
| ideal com Sedenta no lugar da Hidra | 1914 | 21% | 179 | 61 | +118/s |
| Hidra + Sedenta (sustento máximo) | 1581 | **33%** | 269 | 61 | +209/s |

A build atual **não tem lifesteal nenhum** e sangra 60 HP/s — vive de poção. A build ideal se
sustenta sozinha. Isso conversa directamente com o que o dono pediu
(TODO.md:1148: *"temos que farmar mais, então tem que focar no máximo de dano/roubo de vida"*).

---

## 7. Substitutos (muletas) quando o ideal não está disponível ou está caro

Regra: **nunca troque bota por não-bota** (`ESPACOS_ITENS = 4` + 1 bota, `motor.js:28-29`), e
**nunca empilhe o mesmo base** (`cabeNoEquip` só bloqueia bota repetida, `motor.js:2890` — a
unicidade é regra do script, não do motor).

| ideal | muleta | onde a muleta cai | perda |
|---|---|---|---|
| `3031` Gume do Infinito (barão) | `3036` Dominik (rio) | 25–35 | −16,3% |
| | `6673` Arco-escudo (barão) | 40–50 | −19,6% |
| | `3072` Sedenta (vermelho) | 20–30 | −19,4% |
| `3085` Runaan (rio) | `3046` Dançarina Fantasma (lobos) | 10–20 | −35,4% (grupo) / **0% em alvo único** |
| | `6631` Quebrapassos (rota-inf) | 1–10 | −37,7% |
| `3078` Trindade (rota-sup) | `3057` Fulgor (rota-sup, **épico**) | 5–15 | −23,4% |
| | `3051` Machado Termestre (lobos, épico) | 10–20 | intermediário |
| `3172` Grevas Bélicas (rota-sup) | `3006` Grevas do Berserker (rota-sup, **épico**) | 5–15 | **−11,7%** ← a melhor muleta do jogo |
| | `3168` Caminho Imortal (vermelho) | 20–30 | −12,9% |
| `3074` Hidra Raivosa (rota-sup) | `3072` Sedenta (vermelho) | 20–30 | −9,7% |
| `3153` Rei Destruído (rio) | — | — | **não tem substituto** para chefe (é o único on-hit de % de vida AD) |

**Muletas baratas de início (é onde o ouro rende mais por dano):**

| item | preço | g/dps | onde |
|---|---|---|---|
| `1018` Capa da Agilidade (+15% crit) | 600 | **6** | rota-inf, rota-sup, lobos |
| `1037` Picareta (+25 AD) | 875 | 7 | lobos, vermelho, dragão |
| `1038` Espada Grande (+40 AD) | 1.300 | 7 | vermelho, rio, dragão, barão |
| `6670` Aljava Vespertina (+15 AD +20% crit) | 1.300 | 7 | vermelho, rio, dragão, barão |
| `3051` Machado Termestre (+20 AD +20% AS) | 1.200 | 7 | lobos |
| `3086` Zelo (+15% AS +15% crit) | 1.200 | 8 | lobos, rio |
| `3006` Grevas do Berserker (+10 AD +30% AS) | 1.100 | **18** | rota-sup, barão |

---

## 8. O que medir no jogo para confirmar cada escolha (para o Lead)

Cada teste abaixo fecha uma hipótese específica. **Nenhum foi executado nesta lane.**

| # | teste | o que confirma | como |
|---|---|---|---|
| **T1** | Ler `#st-va` (`jogo.js:6461` imprime `a.velAtaque.toFixed(2)`) **sem item de AS** e **com 1 Adaga (+10%)** | resolve `attackspeed` e `attackspeedperlevel` — a única incógnita que muda o veredito de AS (§2.2) | equipar/desequipar Adaga e ler o HUD |
| **T2** | No **Campo Vermelho** (mesmo nível, armaduras diferentes): comparar o dano do **E** no **Krug Anciã** (63,8 arm. no nv25 → mit. 0.611) e no **Lobo Gigante** (34,0 arm. → mit. 0.746). O auto deve diferir ~22%; o **E deve dar o MESMO número** | confirma que o E ignora armadura (`motor.js:1202`) | números de dano por alvo: evento `dano` com `fonte:'E'` vs `fonte:'ataque'` (`motor.js:1224`) |
| **T3** | Com **Trindade + Runaan** vs **só Runaan**, medir o dano nos 2 alvos secundários | confirma que o proc de +2×AD base é copiado a 55% (`motor.js:1697` vs `1718`) | comparar dano total por wave nas duas configurações |
| **T4** | Equipar 2 itens de 25% de crítico e ler o % de crítico no HUD | deve mostrar **100%**, não 123,6% → confirma o cap (`motor.js:541`) | HUD de atributos |
| **T5** | Contar Q/min com a build atual no nv10 | previsão: **24 Q/min** (1/2,5 s) — se der menos, o `procArmed` e o `recargaQYasuo` estão mal modelados | eventos `habilidade` com `tecla: 'Q'` (`motor.js:1582`) |
| **T6** | Medir **abates/min e ouro/min** reais em Rota Superior com a build atual | valida as 49,5 h/lendário da tabela §5.1 — a previsão usa os 9,42 abates/min medidos | `farm.cycles[].mobFase.perMin` |
| **T7** | Medir o **tempo real até cair 1 lendário específico** na Rota Superior | previsão: 27.966 abates ≈ 49,5 h | `farm.cycles` + contagem de drops |
| **T8** | Registrar o **preço pago** em `comprarNoMercado` para o 1º lendário | fecha o `indecidivel-sem-jogo` do §5.3 (farm vs compra) | log do script |
| **T9** | Medir **poções gastas por hora** com a build atual (0% lifesteal) vs com `3072` Sedenta (15%) | previsão: saldo −61/s → +118/s (§6) | `farm.cycles[].mobFase.potions` / `healPotion` |
| **T10** | Medir o **escudo do Fluxo** no nv10 | previsão: `80 + 28×10 = 360` (`motor.js:697`, `2713-2717`) | evento `fluxo` (`motor.js:2716`) |
| **T11** | Trocar 1 slot por vez (matriz de 1 variável) e medir DPS de mob **e** de chefe | valida as tabelas §3.1/§3.3 — em particular que o **Rei Destruído** ganha do Dominik no chefe | `farm.lutas` + `analisarLutaBoss` |
| **T12** | Medir dano com **R na barra vs fora** | o `R` exige alvos no ar (`motor.js:2068-2069`) e dá 30% de pen por 15 s (`motor.js:706`); no snapshot ele está **fora da barra** (`onBar: false`) | comparar `farm.lutas` |

---

## 9. Discordâncias entre a matemática e o que já foi medido

### D1 — `cfg.ouroMin = 4000` está 5–13× acima do real (**acredito no medido**)
`TODO.md:996` usa `piso cfg.ouroMin=4000` como custo de oportunidade do farm.
O snapshot mede **641,8 ouro/min na Rota Superior**, 568,8 nos Lobos e 306,2 no Campo Azul
(`yasuo.json → agregado[].goldMin`). Com 4000, o script acha que 1 h de farm vale 240.000 de ouro
quando vale ~38.500 → **ele compra no mercado cedo demais**. Correção proposta: usar o `goldMin`
do próprio ciclo (já está no snapshot) em vez da constante.

### D2 — O script preferiu vida a dano/AS (**acredito na matemática + no dono**)
`TODO.md:1148`: *"eu vi que tu preferiu item de hp invés de item de dano/atk speed"*.
Medido (`(derivado)`, nv20, build ideal): **10 pontos em Vitalidade = +0,00% de dano**;
10 em Resistência = **+0,00%**; 10 em Força = **+2,64%**; 10 em Agilidade = **+1,96%**.
Para um campeão cujo sustento vem de lifesteal (§6), vida é stat morto até você estar morrendo.
Ordem certa: **Força > Agilidade > Vitalidade**, e Vitalidade só se `farm.deaths` subir.

### D3 — `TODO.md:1100`: "prioridade por DPS (Yasuo Q28 > E20 > R3)" (**nuance, não contradição**)
A matemática diz que no nv10 o **auto é 54% do dano**, o Q 35% e o E 11%. Subir Q continua certo
(é a única habilidade que crita e escala com AS), mas **o E vale mais em grupo do que o número de
alvo único sugere**: ele ignora armadura (`motor.js:1202`) e acumula ×1,5 encadeando alvos
(`motor.js:2090`). Contra a Tropa de Cerco (24 de armadura) o E é o golpe mais eficiente do kit.
Nada aqui justifica inverter a ordem Q > E; só não trate o E como inútil.

### D4 — `docs/motor-map.md` §7.3 e o campo `efeito` (**confirmo o mapa**)
O mapa diz que o `efeito` textual de `itens.js` não é lido para mecânica. Confirmei por leitura:
a mecânica está hardcoded por id (`motor.js:1672`, `1697-1721`, `514-541`). **Mas atenção a uma
exceção que o mapa não destaca:** `temAtributo` (`motor.js:20`) **usa `i.efeito`** para decidir se
o item pode ser equipado. Um item sem stats e sem efeito nunca entra. Não muda nenhuma conclusão
de build, mas muda o `valorDe()` do script.

### D5 — O snapshot diz `player.poder = 0`; o motor diz 679 (**acredito no motor**)
`poder(estado) = nivel×40 + Σ preço×refino×qualidade/10` (`motor.js:246-250`). Para o equipamento
do snapshot: 400 + (300 + 600 + 402,5 + 1.265 + 225)/10 = **679**. O snapshot traz `poder: 0`.
Ou o campo não foi lido, ou é de outro sítio. **Não use `player.poder` como sinal de nada.**
Os outros 5 campos (`nivel/vida/armadura/rm/dano`) fecham com o motor (§0.1), esses sim.

### D6 — `market.json` são anúncios da própria conta (**não são preços de mercado**)
As 6 entradas têm "Cancelar" no texto → são ofertas **ativas da conta**, não compras.
Servem como evidência do *preço pedido* (18.000 a 288.900 por lendário), não do preço de compra.
O `TODO.md:996` cita "Liandry: 160k" como preço de compra — é a única evidência real de compra
que encontrei, e é de um item AP. **Para o Yasuo, preço de compra é `indecidivel-sem-jogo`** (T8).

### D7 — `VEL_ATAQUE_MAX = 3` não é o cap do LoL (**confirmo o motor, e isso importa**)
`motor.js:342-344` diz explicitamente "era 2,5, o do LoL" e subiu para 3,0 em 10/10/2026.
Consequência para a build: a partir do nv20, empilhar AS **estoura** o cap. Se o `asLvl` for
3,5% (LoL), no nv20 a AS base já é 1.161 e 4 itens de AS levam a 3,25 → 8% do AS é jogado fora.
Isso reforça a regra "no máximo 2 itens de AS".

---

## 10. `indecidivel-sem-jogo` — o que a matemática não fecha

| # | pergunta | por que não fecha | teste |
|---|---|---|---|
| I1 | AS base e AS/nível do Yasuo | `dados-yasuo.js` ausente (`motor.js:4`) | **T1** |
| I2 | Preço de compra no mercado | fórmula é do servidor | **T8** |
| I3 | O `R` entra na rotação real? | o snapshot mostra `onBar: false` e a barra tem 4 slots (`motor.js:900`); depende da escolha do jogador | **T12** |
| I4 | Abates/min em Rota Inferior, Campo Vermelho, Rio, Dragão e Barão | só há medição de rota-sup, lobos e azul no snapshot; as outras horas da tabela §5.1 usam 10 abates/min por extrapolação | **T6** |
| I5 | Qualidade/refino dos itens que vão cair | sorteio é do servidor (`motor.js:170-171`, `195-243`) | medir `farm.cycles` |
| I6 | O `E` acumula ×1,5 em alvo único? | `eAcumT = 5` (`motor.js:2091`) expira antes do lockout de 6 s (`motor.js:2089`) → teoricamente não acumula, mas depende do tempo real entre usos | **T2/T5** |

---

## 11. Resposta curta

1. **Build ideal (farm/wave):** Grevas Bélicas · Furacão de Runaan · Gume do Infinito ·
   Força da Trindade · Hidra Raivosa — **2.942 DPS no nv10** contra os 243 de hoje (×12,1).
2. **Ordem:** os 3 primeiros são todos da **Rota Superior** (Trindade → Hidra → Grevas Bélicas),
   depois Dançarina (Lobos) → Sedenta (Vermelho) → Runaan (Rio) → IE (Barão).
   Chega a **1.575 DPS (×6,5)** sem sair de rota-sup/lobos/vermelho.
3. **Ouro:** **não existe loja de itens**. Épico no Ornn (0,5–3,1 h de ouro) é mais barato que
   farmar o drop (6–21 h). **Lendário no Ornn é morto** (183–242 h) — vem de drop (27–50 h) ou
   do mercado.
4. **Cap que morde:** só o de **crítico**. Máximo **2 itens de crítico**; o 3º é lixo.
5. **Chefe:** troque 1 slot por **Espada do Rei Destruído** (rio) — 38 s no Barão contra 69 s da
   build de grupo.
6. **Sustento:** a build atual tem **0% de roubo de vida** e sangra 61 HP/s; a ideal tem 18% e
   fecha **+85 HP/s**.
7. **Atributos:** Força > Agilidade >> Vitalidade/Resistência (**0% de dano**).
