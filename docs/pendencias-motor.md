# Pendências do motor — as 5 lacunas do dono, medidas

> **Tarefa:** confirmar cada uma das 5 lacunas, quantificá-la e dizer o que fazer — sem inventar pesos.
> **Fontes (só leitura):** `docs/game-src/motor.js`, `docs/game-src/itens.js`, `docs/game-src/jogo.js`,
> `extension/automation.js`, `extension/inject.js`, `tools/sim-build.mjs`, `tools/sim-chefes.mjs`,
> `docs/snapshots/*.json`.
> **Regra de evidência:** cada número tem `file:linha` ou a medição de onde saiu. Nenhum peso foi inventado.
> Onde falta uma decisão do dono está escrito **PRECISA DE REGRA DO DONO**.

> **Revisão das linhas:** os números de `automation.js` foram conferidos depois de o ficheiro ter sido
> editado por outro agente durante esta análise — estão na revisão com SHA-256
> `E20DC878642719B0D161B8A147D792FA6429B707F4168B5FB22365E5C5DEBC6F`.
> `motor.js` = `2418F4A2…A95A2` · `tools/sim-chefes.mjs` = `D2F54FE1…75ABE` · `tools/sim-build.mjs` = `5283E8EA…D5BC82`.
> **Não se jogou nada:** sem CDP, sem browser, sem partidas. **Nada foi escrito em `extension/`.**

---

## Veredicto em 30 segundos — as 5 lacunas ordenadas por IMPACTO na decisão de build

| # | Lacuna | O que o dono disse | O que o código diz | O número que decide | Impacto |
|---|---|---|---|---|---|
| **1** | **3 — roubo de vida na luta** | "o simulador corre a luta sem lifesteal" | **O código actual JÁ modela** (`sim-chefes.mjs:642-692`), mas **os números publicados em `docs/sim-baron.md` são SEM rv** (56 poções = a corrida sem rv; com rv dá 52) **e usam outra atribuição** que não o painel do dono | Com o painel MEDIDO do dono, a build IDEAL nv30 **morre aos 54,7 s sem rv e mata em 67,85 s com rv** | **Decide mata/morre** — é binário |
| **2** | **5 — barra fixa vs rotação** | "a matemática de build leva em conta a rotação?" | `estimarSet`/`dpsPorHabilidade` somam o **arsenal inteiro** (`automation.js:3273,1386`); o motor só lança o que está na barra de 4 (`motor.js:900,1578`); os dois simuladores usam barra **fixa** (`sim-build.mjs:408`, `sim-chefes.mjs:485`) | Arsenal vs barra real medida: **+2,8%** hoje; a barra que o **simulador** escolhe está **15,2% abaixo** da barra real; tecto aos nv40-50: **+19,7% a +27,5%** | Muda os números que ordenam builds |
| **3** | **2 — voracidade** | "fechar exige um peso meu? já era pra tá fazendo" | **Tem razão**: está no motor (`motor.js:736,1789`) e o modelo de build ignora-o | Contra mobs dá **33,7%-45,5% de CDR efectivo em Q/W/E**; contra o Barão dá **0%** (o −5 s só dispara no golpe que mata) | Muda o peso relativo de CDR/AP contra mobs |
| **4** | **1 — penetração do kit** | "a Katarina já penetra 20% pela E" | **Não é a Katarina** (é o **Darius**, `motor.js:560`) e **o motor JÁ usa** (`motor.js:516→539→1202`); quem ignora é a matemática de build. **Bug irmão que ESSE atinge a Katarina:** o 3036 entra como `penMag` (`automation.js:3251`) | penE do Darius: **+12,3% a +32,9%** de dano físico (arm 122). 3036 mal-lido: **+13,0% a +19,6%** de dano mágico falso na Katarina | Baixo para o Darius (1 de 7); **médio para o 3036** |
| **5** | **4 — roubo de vida inato dos kits** | "que tipo de rv cada boneco tem nas skills?" | **Nenhum tem rv nas skills**: o único caminho genérico de rv de skill do motor é **código morto** (`motor.js:1823-1827` vs 7 `acoes*`); as curas dos kits são % de vida máxima/falta | Na build do dono o **auto-ataque é 6,1% do dano** (36 de 588 dps) → 15% de rv vira **0,9% do dano em cura** | Explica a #1; não é número de build |

---

## 1.º (MAIOR IMPACTO) — LACUNA 3: o roubo de vida na luta

### O que o dono disse
> "um barão que quase te mata COM roubo de vida, não te mataria SEM roubo de vida?"
> "O simulador de chefes NÃO modela isso — corre a luta sem lifesteal."

### O que o código diz — o simulador JÁ modela (e já modelava quando o doc foi escrito?)
**O simulador modela o rv, com o file:linha:**
- `motor.js:1226-1230` — `if (a.rouboVida && fonte === 'ataque') { const cura = dano * a.rouboVida; ... }` (**só ataques básicos**).
- `motor.js:538` — `rouboVida: rv` (soma dos `rv` dos itens, `motor.js:507`).
- `motor.js:1286` — a 3065 multiplica a cura por 1,25 (**e o 3065 NÃO existe no catálogo**: `tools/sim-chefes.mjs:1252`).
- `tools/sim-chefes.mjs:642-692` — `lutarChefe` aplica `curaRV + curaKit` a cada `dt`, com o escudo do 3072 (`motor.js:1229`) e o tecto da vida máxima.
- `tools/sim-chefes.mjs:1031-1044` — `curaDaBuild`: `curaRV = det.autoCura × rouboVida × (3065?1,25:1)`, e `opts.semRV` desliga-a.
- `tools/sim-chefes.mjs:1053` — `lutarBarao` passa `curaRV` à luta; `1102` — `avaliarLuta` devolve `rouboVida/curaRV/curaKit/curaTotal`.
- `tools/sim-chefes.mjs:1138` — `ITENS_RV` = os **7** itens com `rv > 0`: `1053` .07 · `3008` .07 · `3168` .12 · `3172` .06 · `3153` .10 · `3074` .12 · `3072` .15 (`itens.js`).

### Onde o dono TEM razão — o doc publicado é SEM rv
`docs/sim-baron.md` §5/§7 diz, para a **Katarina IDEAL nv30** (build `3172,3153,3031,3036,3046`):
**"mata em 68,4 s | 56 (54) poções"** e §7 **"56 (14 · 16 · 26)"**.

Correndo o simulador de hoje com a atribuição que o doc usa (`distribuirAtributos(modeloDe('katarina'),30)`):

| corrida | resultado | poções | custo |
|---|---|---|---|
| **COM rv** (16%) | MATA 68,35 s | **52** | 7 390 g |
| **SEM rv** (`semRV: true`) | MATA 68,35 s | **56** | 9 000 g |

→ **As 56 poções do doc são a corrida SEM rv.** A prova decisiva é a coluna *"sem poção: morre aos 8,0 s"* do §5: o simulador de hoje dá **morre aos 7,95 s SEM rv** e **9,95 s COM rv**. As 56 poções (doc) = 56 (sem rv) vs 52 (com rv). O dono está certo sobre o doc: os números publicados não têm o lifesteal.

### Onde está o erro que realmente decide a build — a ATRIBUIÇÃO
`tools/sim-chefes.mjs:1051` usa `opts.atrib || distribuirAtributos(modeloDe(campeao), nivel)` =
**Força 35 · Vitalidade 17 · Foco 35** (vida máx **4 377**, `sim-chefes.mjs:782`).
O painel MEDIDO do dono (`tools/sim-chefes.mjs:1150 atribDono`) é **Força 81-84 · Vitalidade 3 · Foco 0** (vida máx **4 097**).

A MESMA build, no MESMO nível, só muda a atribuição:

| cenário | (a) SEM rv | (b) COM rv (16%) |
|---|---|---|
| atribuição do doc (Vit 17) | MATA 68,35 s · 56 poções · 9 000 g | MATA 68,35 s · 52 poções · 7 390 g |
| **painel do dono (Vit 3)** | **MORRE aos 54,7 s** · 43 poções · 6 440 g · hpMin 312 (7,6%) | **MATA em 67,85 s** · 53 poções · 7 360 g · hpMin 883 (21,5%) |

→ **RESPOSTA À PERGUNTA DO DONO: SIM.** Na atribuição real dele, a build com 16% de rv mata em 67,85 s e **sem rv morre aos 54,7 s**. Δ = **+571 de hp mínimo, +10 poções, +920 g** — mas o que decide é o binário *mata/morre*.

### (c) A melhor build de rv disponível, e o que o rv vale em cada nível
A melhor build COM rv da família (nv30) é exactamente a IDEAL: **3172 · 3153 · 3031 · 3036 · 3046 = 16% de rv** (`3172` 6% + `3153` 10%). No nv35:

| cenário (nv35) | resultado | poções | custo |
|---|---|---|---|
| (a) SEM rv | MATA 35,15 s | 25 | 2 350 g |
| (b) COM rv 16% | MATA 35,15 s | **12** | **760 g** |

→ No nv35 o rv não muda os segundos (a luta é limitada por DPS, não por sobrevivência): **poupa 13 poções = 1 590 g por luta**.

### E a build do dono?
A build que ele tem equipada (`docs/snapshots/katarina.json`, `cycles[0].setup.equip`) é
**`3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A`** → **rv = 0 em todos os 5 itens** (`itens.js`).
Logo, para ELE, **(a) == (b) exactamente**: nv29 MORRE aos 8,45 s nas duas corridas. A pergunta só passa a ter
efeito se ele trocar um item por um dos 7 com `rv > 0`.

Varredura da build dele (rv 0), nv29→36:

| nv | resultado | poções | ouro |
|---|---|---|---|
| 29 | MORRE 8,45 s | 1 | 110 g |
| 30 | MORRE 54,7 s | 42 | 6 320 g |
| 31 | MORRE 89,75 s | 77 | 11 820 g |
| **32** | **MATA 98,45 s** | 83 | 12 540 g |
| 33 | MATA 86,1 s | 72 | 9 400 g |
| 34 | MATA 76,1 s | 65 | 7 030 g |
| 35 | MATA 67,1 s | 53 | 5 420 g |
| 36 | MATA 61,1 s | 44 | 4 040 g |

(Confirma a intuição do dono "level 32 mata o barão" — com a build que ele tem.)

### O QUE FAZER
1. **Nada no motor nem no simulador**: o rv já está modelado (`sim-chefes.mjs:642-692,1031-1044`).
2. **Regenerar `docs/sim-baron.md` §5-§7** com o simulador de hoje (as 56 poções viram 52) e **declarar no doc** que os números incluem a cura do rv.
3. **Trocar a atribuição por omissão das tabelas** de `distribuirAtributos` para o painel medido — ver **PRECISA DE REGRA DO DONO** abaixo.
4. **A atribuição do doc contradiz-se a si própria** (§1 diz Força 84 do painel medido; §5 corre com Força 35 · Vit 17 · Foco 35 do modelo). **PRECISA DE REGRA DO DONO** (esta sim): as tabelas descrevem o **personagem do dono** (painel medido) ou um **personagem-modelo**? A resposta muda o resultado de "mata" para "morre" — é a única escolha que sobra aqui.

---

## 2.º — LACUNA 5: a barra fixa vs a rotação na matemática de build

### O que o motor faz
- `motor.js:900` — `export const BARRA = 4;` (a barra tem 4 espaços).
- `motor.js:1578` — `const pode = (t) => estado.barra.includes(t) && r[t] && d.recargas[t] <= 0 && ...` → **só se lança o que está na barra**.
- `motor.js:1593` — `for (const t of K.ordem) acoes[t]?.()` → o motor percorre a ordem do kit e lança o que estiver na barra e pronto.
- `motor.js:1363` — as recargas de TODAS as habilidades andam com o tempo (mesmo fora da barra).

### O que a extensão assume
- `automation.js:64` — `const BARRA_SLOTS = 4;`
- `automation.js:922` — o **arsenal** = todos os `#hab-ativas .hab[data-t]` (todas as habilidades desbloqueadas).
- `automation.js:3273-3295` (`estimarSet`) e `automation.js:1386-1420` (`dpsPorHabilidade`) — **somam o arsenal INTEIRO**, cada habilidade dividida pela sua própria recarga.
- `automation.js:127` — `barraPorDisponibilidade: true` (a barra RODA); `automation.js:128` — `barraCadenciaMs: 2000` (**a barra é reavaliada a cada 2 s**).
- `automation.js:5636-5682` (`barraIdeal`) + `5673` (`aplicarBarra`).

→ **RESPOSTA: não.** A matemática de build da extensão **não assume barra fixa** — assume o **arsenal inteiro a ser lançado em recarga** (o que é a barra a rodar sem limite de espaços). Quem assume barra FIXA são os dois simuladores:
- `tools/sim-build.mjs:408-412` — `barraPadrao`: 4 habilidades fixas por `base[0]/recarga[0]` do rank 1, calculadas uma vez.
- `tools/sim-chefes.mjs:485-492` — `escolherBarra`: R fixa + as 3 melhores por DPS, calculadas uma vez.

### O número (medido, com o arsenal REAL de `docs/snapshots/skills.json`)
O arsenal medido do dono: **11 habilidades, 7 com rank > 0** — `Q10 W1 E3 R3 G1 A5 F1`; a **barra real é `W/Q/R/A`**.
`estimarSet`/`dpsPorHabilidade` contam 7 (`automation.js:3298` salta `!h.rank`); a barra real só pode lançar 4.

| modelo | dps de habilidade | erro |
|---|---|---|
| barra REAL medida `W/Q/R/A` | **840** | — |
| arsenal inteiro (o que a extensão vê) | **864** | **+2,8%** |
| barra que o **simulador** escolhe (`R/Q/A/E`) | **712** | **−15,2%** |

O **simulador** erra 15,2% para baixo por uma razão concreta: `sim-chefes.mjs:490` ordena por `dpsDaHabilidade`, que **não inclui o giro da Voracidade** (o giro só é somado em `sim-chefes.mjs:597`, no `dpsTeorico`). As habilidades de adaga (Q/W/A) têm `base` pequena e o **W fica com 0 de dps directo** → o simulador deita fora o W (152 dps reais) e mete o E (24 dps).

Tecto do erro (ranks optimizados pelo simulador, build IDEAL, Barão do nível do jogador):

| nv | desbloqueadas | barra do sim | arsenal | modelo da extensão vê | barra com giro vs barra do sim |
|---|---|---|---|---|---|
| 29-35 | 4 | 280-428 | 280-428 | **0,0%** | 0,0% |
| 40 | 5 | 498 | 596 | **+19,7%** | +13,9% |
| 45 | 6 | 546 | 685 | **+25,5%** | +13,9% |
| 50 | 6 | 633 | 807 | **+27,5%** | +8,4% |

**Limite honesto:** o modelo do arsenal é um **tecto**, não a verdade — a barra só é reavaliada a cada 2 s (`automation.js:128`), logo uma habilidade tirada da barra fica fora até 2 s. O valor real está entre a barra fixa e o arsenal.

### O QUE FAZER
1. **Corrigir `sim-chefes.mjs:485-492`** para ordenar a barra incluindo o giro da Voracidade (a regra que a extensão já usa em `automation.js:1410`): recupera os 15,2% que o simulador perde hoje.
2. **Declarar em `docs/sim-baron.md`** que o DPS de habilidade é o de uma barra FIXA de 4 (e qual), não o do arsenal.
3. **Qual modelo usar também NÃO é regra do dono — está tudo escrito:** o jogo fixa **4 espaços** (`motor.js:900` + `motor.js:1578`) e a rotação é regra que o dono **já deu** (`automation.js:116-128`: `barraPorDisponibilidade: true`, `barraCadenciaMs: 2000`). O modelo correcto é portanto **4 espaços a rodar à cadência do dono**, e não o arsenal inteiro. A única decisão de âmbito que sobra é se o simulador deve simular a rotação (com o `barraIdeal` de `automation.js:5636-5682`) ou apenas declarar que o número é o de uma barra fixa.

---

## 3.º — LACUNA 2: a voracidade (a passiva da Katarina)

### O que o motor faz (o dono tem razão: está no motor, não é política)
- `motor.js:733` — o comentário: *"Cada abate reduz a recarga da Q, W e E."*
- `motor.js:736` — `P: { voracidade: 1.5, voracidadeChefe: 5, ... }`
- `motor.js:1789` — `if (HPk?.voracidade) for (const t of ['Q','W','E']) d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));` (dentro do `processarAbates`, por cada monstro morto).
- `motor.js:1581` — `d.recargas[t] = recarga * (1 - a.reducaoRecarga)` (o CDR de item é o que a matemática de build modela).
- `motor.js:1363` — a recarga anda com o tempo.
- `motor.js:1853` — `usar('R', {}, 2)` (só o R do **Darius**, dentro do `acoesDarius.R`, e só quando o R executa).

### O número: CDR efectivo contra MOBS
Com abates a cada `T` segundos e −1,5 s por abate, a recarga efectiva é `cd / (1 + 1,5/T)`, logo
**CDR efectivo da passiva = 1,5 / (T + 1,5)**, por habilidade, só em Q/W/E.

**N abates/min MEDIDO:**
- `docs/snapshots/farm.json` → `cycles[].mobFase.perMin.kills` = **29,44 · 29,46 · 29,56 · 29,99 · 30,16 · 33,40** (6 ciclos).
- `docs/snapshots/ciclos.json` → `ritmo.killsMin` = **20,3 · 21,2** (com `medGapMs` 1 458-1 481 e `n: 200`).

| N abates/min | T (s) | **CDR efectivo da voracidade** | recarga × |
|---|---|---|---|
| 20,3 | 2,96 | **33,7%** | 0,663 |
| 21,2 | 2,83 | **34,6%** | 0,654 |
| 29,4 | 2,04 | **42,4%** | 0,576 |
| 33,4 | 1,80 | **45,5%** | 0,545 |

Aplicado à Katarina (build do dono, nv29, CDR de item = **23,5%** pelo `4629+3~A`):

| habilidade | recarga base | com CDR de item | com a voracidade (N=21,2) | casts/s |
|---|---|---|---|---|
| Q rank 10 | 6,85 s | 5,24 s | **3,43 s** | 0,191 → **0,292 (+53,0%)** |
| E rank 6 | 8,00 s | 6,12 s | **4,00 s** | 0,163 → **0,250 (+53,0%)** |
| Q rank 10 (N=29,4) | 6,85 s | 5,24 s | **3,02 s** | 0,191 → **0,331 (+73,5%)** |

Quanto isto vale no DPS (o modelo actual NÃO o conta — `automation.js:3292`/`1402` usam `cdBase × (1-cdr)`):

| cenário | dps actual do modelo | com a voracidade (N=21,2) | com a voracidade (N=29,4) |
|---|---|---|---|
| build do DONO nv29 (mobs) | 588 (auto 36 + skills 429 + itens 123) | **983 (+67,2%)** | **1 045 (+77,7%)** |
| build IDEAL nv30 (mobs) | 1 442 (auto 1 302 + skills 140) | **1 569 (+8,8%)** | **1 591 (+10,3%)** |

O efeito passa pelo **giro da adaga**: o motor pega **uma adaga de cada vez**, com `pegaCada = 0,35 s` (`motor.js:736`, aplicado em `motor.js:2181` `d.pegaCd = HK.P.pegaCada`) → no máximo **2,857 giros/s**; o `dagasPorS` é a soma de `1/recarga` das habilidades com adaga, e o modelo é `min(dagasPorS, 1/pegaCada)` (`tools/sim-chefes.mjs:593`). **Nota:** a `dpsPorHabilidade` da extensão **não aplica esse tecto** (`automation.js:1418` soma `giro/cd` sem limite) — só é um erro quando `dagasPorS > 2,857/s`, o que não acontece com a build do dono (`dagasPorS` medido = 0,354/s), logo a voracidade acelera **também** o giro. A fracção do dps de habilidade que está em Q/W/E é **45,4%** (build do dono nv29) e **54,2%** (IDEAL nv30).

### O número: CDR efectivo contra o CHEFE — é ~0
- `motor.js:1121` — a onda do chefe tem **1 monstro só**: `return [criarMonstro(local.chefe[0], ...)]`.
- `motor.js:1789` corre dentro do `processarAbates` → o `-5 s` do `voracidadeChefe` dispara **no golpe que MATA o Barão**, ou seja, no fim da luta. **Não encurta nenhuma recarga que se use dentro da luta.**
- `motor.js:1853` — o `usar('R', {}, 2)` do Darius é igual: só quando o R executa (mata).
- A **única** voracidade dentro da luta do Barão são as **larvas** (`i.chefe = false` → −1,5 s): `motor.js:3080` rodízio `invocar → tentaculos → acido`; `motor.js:3076` espera 14 + `motor.js:3077-3078` 9 + 9 = **32 s por volta**; `motor.js:3118` **2 larvas** por invocação → 2/32 = **3,75 larvas/min** → **5,63 s/min** tirados de cada uma de Q/W/E → **9,4% de CDR equivalente**.

### RESPOSTA À HIPÓTESE DO DONO
> "o CDR de ITEM vale menos contra mobs e mais contra o chefe"

**Não — a fórmula do motor não diz isso.** A voracidade **multiplica** a recarga (`cd_eff = cd_base × (1 − cdr) / (1 + 1,5/T)`), logo o ganho RELATIVO do CDR de item continua a ser `1/(1 − cdr)` nos dois cenários. O que é verdade:
1. Contra **mobs** a passiva dá **33,7%-45,5%** de graça em Q/W/E e **a matemática de build não o conta** → o dps de habilidade contra mobs está subestimado (até **+67,2%** na build do dono) e os itens de **AP** ficam subvalorizados no contexto de farm.
2. Contra o **chefe** a passiva vale **0%** (o `voracidadeChefe: 5` só age no abate final; sobram as larvas, **9,4%**) → o CDR de item **não** vale mais contra o chefe; é o contrário do que a intuição diz, e o número está no motor.

### O QUE FAZER
1. **O `N` NÃO é regra do dono — a extensão já o mede ao vivo.** `ritmoMobs()` devolve `killsMin` (`automation.js:637` e `641-648`), está exposto no `__lolidleAuto` (`automation.js:5754`) e fica gravado em cada rotação nos ciclos (`docs/snapshots/ciclos.json` → `ritmo.killsMin`). **Modela-se lendo esse número** (REGRA Nº 3: números lidos, nunca copiados). Medição actual: **20,3 a 33,4 abates/min**; a fórmula é `CDR = 1,5/(60/N + 1,5)`.
2. Com o `N` fixado, o sítio da correcção é o mesmo de sempre: onde hoje se faz `cdBase × (1 - cdr)` (`automation.js:1415,3268`; `sim-build.mjs:341`; `sim-chefes.mjs:469`), passar a `cdBase × (1 - cdr) / (1 + 1,5/(60/N))` **só para Q/W/E e só no contexto de mobs** — no chefe o factor é 1.
3. **Não inventar peso:** é a fórmula do motor (`motor.js:1789`), com o `1,5` de `motor.js:736`.

---

## 4.º — LACUNA 1: a penetração do kit

### O que o dono disse
> "`motor.js:560` Katarina E: `{ ..., pen: [...] }`" e "`automation.js:1491` lê a pen do TEXTO DO ITEM, não do KIT".

### Correcção de leitura: são três erros de atribuição
1. **`motor.js:560` NÃO é a Katarina.** É o **Darius**: `const HAB_DARIUS = {` abre em `motor.js:553`, o `E` com `pen` está em `motor.js:560` (desc: *"Dá penetração de armadura (passiva)"*). O E da Katarina é `motor.js:743` e **não tem `pen`**. Confirmado por varrimento: há **um único `pen:`** em todo o `docs/game-src/` (`motor.js:560`).
2. **`automation.js:1491` não lê o texto do ITEM**: `const pen = k.penSuspiro != null ? k.penSuspiro : txt.penArmadura;` — o `txt` vem de `buffDoTexto(dica)` (`automation.js:1463-1471`) e a `dica` é a **descrição da HABILIDADE** (`automation.js:2004`, `data-dica` da habilidade).
3. **O motor JÁ usa a penetração do kit.** Não é uma lacuna do motor:

```
motor.js:516   const penE = k.hab.E.pen && estado.ranks.E ? k.hab.E.pen[estado.ranks.E - 1] : 0;
motor.js:539   penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1),
motor.js:1202  ... : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura)
motor.js:529   penMagica: Math.min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag)   // o 3036 NÃO entra aqui
```

O kit do Darius que o motor usa é o `HAB_DARIUS_KIT` (`motor.js:870`), que faz `...HAB_DARIUS` (`motor.js:673-674`) e **não sobrepõe o E** → o `pen` do E viaja. O motor mostra-o no ecrã (`motor.js:928`).

### Quantos campeões têm pen de kit, e quanto
**1 de 7** (Darius, de `darius/ezreal/lux/yasuo/katarina/taric/zac`, `motor.js:864-895`). Valores por rank (`motor.js:560`):
**20% · 23% · 26% · 29% · 32% · 35% · 38% · 41% · 43% · 45%**.
Ganho de dano **físico** só com a penE (`motor.js:539→1202`), alvo com armadura 122 (Barão nv42):

| rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| penE | 20% | 23% | 26% | 29% | 32% | 35% | 38% | 41% | 43% | 45% |
| ganho | +12,3% | +14,5% | +16,7% | +19,0% | +21,3% | +23,8% | +26,4% | +29,1% | +30,9% | **+32,9%** |
| ganho EXTRA já com 3036 | +10,1% | +11,8% | +13,6% | +15,4% | +17,3% | +19,2% | +21,2% | +23,3% | +24,7% | +26,1% |

(Armadura 104: +11,4% a +29,8%; com 3036, +9,2% a +23,4%. A penE é **multiplicativa** com o 3036, nunca somada.)

### Onde a lacuna É real: a matemática de build
- `automation.js:3235-3263` (`statsSet`) — o `pen` que sai daqui é só `it.penMag` (e o texto); **nunca** `k.pen`.
- `automation.js:3298` (`estimarSet`) e `automation.js:5423` (`scoreSet`) — usam esse `pen` na mitigação.
- `automation.js:1491` (`valorBuff`) — lê `k.penSuspiro` (o R do **Yasuo**, `motor.js:706`), nunca `k.pen`; e `buffDoTexto` (`automation.js:1467`) só apanha `"ignoram X% da armadura"`. O E do Darius diz *"Dá penetração de armadura (passiva)"* — **sem número** → o E do Darius vale **0** em `valorDoPonto` (`automation.js:1504-1510`) → o `subirHabilidades` (`automation.js:2008`) só lhe dá o rank 1 do desbloqueio e nunca mais.
- `inject.js:113-115` (`serialKit`) — a lista de campos não inclui `pen` nem `penSuspiro` → **a extensão não consegue sequer ver o campo** hoje.
- `tools/sim-build.mjs:286` e `tools/sim-chefes.mjs:443` — `penArmadura: 1 - (tem('3036') ? 0.7 : 1)`, com o comentário explícito *"penE=0 nos dois campeões"*. Está **certo para Katarina e Yasuo** (os dois simulados) e **errado para o Darius**.

### O bug irmão — ESTE atinge a Katarina
`automation.js:3251` faz, quando o item não traz `penMag`:
```js
if (!pm) { const mm2 = ef.match(/(\d+)\s*%\s*de\s*penetra/i); if (mm2) pm = +mm2[1] / 100; }
```
O texto do **3036** é *"Mata-Gigantes: 30% de penetração **de armadura** e +15% de dano contra chefes."* → o regex apanha-o e arquiva-o como **`penMag` = 0,30**. Para um campeão de **magia** (Katarina, Lux, Taric, Zac), `estimarSet:3298`/`scoreSet:5423` passam a aplicar 30% de penetração **mágica** que o motor **não dá** (`motor.js:529` não tem termo do 3036).

| armadura do alvo | mit. mágica real (sem 3036) | mit. que o `statsSet` usa COM 3036 | sobrevalorização |
|---|---|---|---|
| 60 | 0,7353 | 0,7987 | **+8,6%** |
| 104 (Dragão medido) | 0,6158 | 0,6960 | **+13,0%** |
| 122 (Barão nv42) | 0,5774 | 0,6612 | **+14,5%** |
| 200 | 0,4545 | 0,5435 | **+19,6%** |

E o 3036 está na build IDEAL da Katarina (`3172,3153,3031,3036,3046`, `docs/sim-baron.md` §4) — logo o modelo **recomenda-o por um motivo que não existe**.

### O QUE FAZER
1. **Não tocar no motor**: `motor.js:516/539/1202` já está certo e é a referência.
2. **Corrigir o `statsSet`** (`automation.js:3238-3262`) para separar **pen de armadura** (`3036`) de **pen mágica** (`3135`/`3175`) — hoje o 3036 cai no ramo errado para campeões de magia.
3. **Só depois** decidir se vale modelar a penE do Darius (`inject.js:113-115` teria de a passar). **PRECISA DE REGRA DO DONO:** o Darius é 1 de 7 campeões e o dono joga Katarina — vale o esforço, ou fica declarado como limitação?

---

## 5.º — LACUNA 4: a cura inata dos kits (e porque é que o rv de item parece mau)

### O que existe HOJE nos kits (com file:linha e número)
| campeão | onde | tipo | número |
|---|---|---|---|
| **Darius** | `motor.js:1866` | **% da vida que FALTA**, por inimigo atingido (até 3) | **13%/inimigo → até 39% da vida que falta por Q** |
| **Darius** | `motor.js:677, 1681` | **% da vida MÁXIMA** por auto, se o alvo sangra (6 s) | 1,0% → 1,9%/auto |
| **Darius** | `motor.js:685, 1483` | **% da vida que falta** por abate dentro do Domínio | 4%/abate |
| **Katarina** | `motor.js:736, 755, 2169-2170` | **% do dano do GIRO** (habilidade, não auto) | `curaBase 0,05` + `curaGiro` 8%→17% = **13%→22% do giro** |
| **Katarina** | `motor.js:749, 1685` | **% do dano da Sede de Sangue** (fonte 'G', no auto) | **30%** |
| **Taric** | `motor.js:781-783` | fixo + %AP + **% da vida máxima** | `64+29/rank + 0,48×AP + 1,8% da vida` |
| **Taric** | `motor.js:806` | **% da vida máxima/s**, 10 s | 1,2% → 2,55%/s |
| **Taric** | `motor.js:811, 2332` | **% do dano causado** | **25%** |
| **Taric** | `motor.js:799-800, 2291-2298` | pulso de dano igual a parte da cura | 30% da cura |
| **Zac** | `motor.js:828, 2414` | **% da vida máxima + % da que falta**, por gosma | 5%→4,7% + 12%→10,6% |
| **Zac** | `motor.js:850, 2512` | **% da vida máxima** ao longo de 5 s | 15% → 28,5% |
| **Zac** | `motor.js:854, 2501` | **% da vida máxima por alvo** (até 5) | 4%/alvo → 20% |
| **Lux** | `motor.js:655, 1989` | **% da vida máxima + %AP**, instantâneo | 8% → 15,2% + 40% do AP |
| **Yasuo** | — | **não cura**: só escudos (`motor.js:697` escudoFluxo, `motor.js:721` escudoPct) | — |
| **Ezreal** | — | **não cura**: só devolve mana (`motor.js:592`) | — |

### O achado que responde à pergunta do dono
> "que tipo de roubo de vida cada boneco tem por padrão nas skills, que torna roubo de vida em itens tão merda assim?"

**Nenhum kit tem "roubo de vida" nas skills.** E o motor tem o caminho genérico de rv de habilidade **morto**:
- `motor.js:1231` — `if (d.furiaS > 0) curar(estado, c, a, dano * d.furiaRoubo);` (cura em **todo** o dano, não só no auto).
- `motor.js:1823-1827` (`acoesComuns.F`) é o **único** sítio que faz `d.furiaRoubo = HK.F.roubo[r.F - 1]`.
- Mas `motor.js:1589` espalha `...acoesComuns(ctx)` e **os 7 campeões sobrepõem o F** no seu próprio `acoes*`: Darius `motor.js:1870`, Lux `1987`, Yasuo `2109`, Katarina `2265`, Taric `2334`, Zac `2551`, Ezreal `2608`.
- Logo `d.furiaRoubo` só é escrito a **0** (`motor.js:1057` estado inicial, `motor.js:1873` o F do Darius) → o `roubo: serie(0.12, 0.03)` de `motor.js:572` **nunca dispara**.

**A razão verdadeira de o rv de item parecer mau é outra, e é aritmética:**
- `motor.js:1226` — o rv do item cura **só o ataque básico** (`fonte === 'ataque'`).
- Na build do dono (nv29) o **auto-ataque é 6,1% do dano**: 36 de 588 dps (auto 36 · skills 429 · itens 123).
- → **15% de rv valem 15% × 6,1% = 0,9% do dano em cura.** Com a build IDEAL (de auto-ataque) o auto é **90,3%** do dano (1 302 de 1 442) → os mesmos 16% de rv curam **208/s** (nv30) a **396/s** (nv35).
- Números do simulador para a Katarina (`sim-chefes.mjs:1031-1044`): cura do **KIT** = **10/s** (build do dono nv29) e **21/s** (build AP nv35); cura do **RV** = 0/s com a build dele e 208-396/s com a build de auto-ataque.

Ou seja: **o rv de item não é mau por os kits curarem — é mau porque o dano da Katarina é de habilidade e o rv só toca no auto-ataque.** As curas dos kits são quase todas **% da vida máxima / % da vida que falta** (escalam com a luta, não com o teu dano) — nenhuma delas é o que o item vende.

### O QUE FAZER
1. **Nada a corrigir no motor** — está tudo no sítio, e o `motor.js:1231` morto deve ser **declarado morto** (ou removido) para ninguém o tomar por mecânica viva.
2. **Declarar na UI/relatórios** que o `rv` do item só vale para ataques básicos (`motor.js:1226`) — é o que explica a build ao dono.
3. O simulador de chefes **só modela a cura do kit da Katarina** (`sim-chefes.mjs:596,606`); Darius/Taric/Zac/Lux não estão lá. **PRECISA DE REGRA DO DONO:** alargar o simulador aos outros kits ou assumir a limitação por escrito?

---

## PRECISA DE REGRA DO DONO (lista fechada)

**Só três — e depois de verificar se a regra já estava escrita no jogo/código (REGRA Nº 2 do AGENTS.md):**

1. **Lacuna 3 — a única escolha de fundo:** as tabelas do `docs/sim-baron.md` descrevem o **personagem do dono** (painel medido: Força 81-84 · Vit 3 · Foco 0) ou um **personagem-modelo** (`distribuirAtributos`, Força 35 · Vit 17 · Foco 35)? O doc contradiz-se hoje (§1 medido, §5 modelo) e a resposta muda "mata" para "morre".
2. **Lacuna 1 — âmbito:** modelar a penE do **Darius** (exige passar `pen` no `inject.js:113-115`) ou declarar a limitação (1 campeão de 7, e não é o que o dono joga)?
3. **Lacuna 4 — âmbito:** alargar o simulador de chefes às curas dos kits do Darius/Taric/Zac/Lux, ou assumir por escrito que só a Katarina está modelada?

**Reclassificados como "modela-se, não se pergunta" (estavam aqui e saíram):**
- **Lacuna 2 — o `N`:** a extensão **já mede** o `killsMin` ao vivo (`automation.js:637,641-648`, exposto em `5754`, gravado nos ciclos). Lê-se, não se pergunta (REGRA Nº 3).
- **Lacuna 5 — a barra:** o jogo fixa 4 espaços (`motor.js:900,1578`) e a rotação é regra já dada pelo dono (`automation.js:116-128`). Modela-se com esses números; só fica a decisão de âmbito de simular ou não a rotação.

## Limites deste relatório
- Não se jogou: sem CDP, sem browser, sem partidas. Tudo vem de `motor.js`, `itens.js`, `automation.js`, dos simuladores e de `docs/snapshots/`.
- A cura do rv no simulador entra como **fluxo contínuo** (`sim-chefes.mjs:686-692`), não por golpe; o motor cura **por golpe** (`motor.js:1226-1228`). A diferença é de granularidade, não de sinal.
- O `3065` (x1,25 na cura) **não existe no catálogo** `itens.js` → esse factor fica **NÃO VERIFICADO** por build (`sim-chefes.mjs:1252`).
- `docs/snapshots/skills.json` é UM ponto de medição (nv29) para a Lacuna 5; o tecto aos nv40-50 usa os ranks que o próprio simulador optimiza, não medições.

## Como reproduzir (sem escrever nada no repositório)
```
bun tools/sim-chefes.mjs --rv --de 26 --ate 34      # parte 3: a tupla, o rv e a economia das poções
bun tools/sim-chefes.mjs                            # parte 2: build x nível -> Barão
```
As medições específicas deste relatório saíram de `bun` a chamar as funções exportadas de
`tools/sim-chefes.mjs` (`avaliarLuta`, `curaDaBuild`, `dpsTeorico`, `dpsDaHabilidade`, `escolherBarra`,
`buildsDaFamilia`, `atribDono`, `ITENS_RV`) com `semRV: true|false` e com `atrib` explícito
(`atribDono(nivel)` vs `distribuirAtributos(modeloDe('katarina'), nivel)`) — o mesmo `opts.atrib` que
`lutarBarao` aceita (`sim-chefes.mjs:1051`).