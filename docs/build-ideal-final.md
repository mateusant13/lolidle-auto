# Build ideal — MOB e CHEFE (Katarina e Yasuo)

> **Pedido do dono (verbatim):** "me da a resposta da build ideal. quero build ideal pra mob e pra chefe.
> levando em conta o cdr, se devemos ter cdr ou nao, se e pra somar a bota de cdr com o impeto na build,
> ou so um deles, ou nenhum deles, e etc."
>
> **Como estes números foram obtidos.** Correu-se `bun tools/sim-build.mjs` (secções S1–S9, escritas
> para esta resposta) e `bun tools/sim-chefes.mjs`. A matemática é a do motor do jogo
> (`docs/game-src/motor.js`) e **cada número tem `file:linha`**. Onde o repositório não permite
> provar, está escrito **NAO VERIFICADO**.
>
> **Regra de evidência:** nada aqui é estimativa. Os únicos parâmetros que não saem de ficheiro são
> os que estão declarados como tal na §10.

---

## 0. Duas correcções de partida (e uma medição que resolve a dúvida do CDR)

### 0.1 O "cdr 0,23" NÃO é cdr de atributos — é o cdr do próprio Ímpeto Cósmico

O ficheiro `tools/sim-build.mjs` trazia (linhas 90-95) a hipótese de que os 23% de CDR medidos ao
vivo eram **atributos** (Foco 57,5 pontos). **Isso está errado** e fazia o simulador contar o Ímpeto
duas vezes. A prova:

| Evidência | O que diz |
|---|---|
| `docs/snapshots/farm.json`, `current.setup.equip`, entrada `4629+3~A` | `stats.cdr = 0.23` e a dica: *"+109.5 poder de habilidade, +547 vida, **−23% recarga**"* |
| `motor.js:24` (patch do motor) | `Object.assign(ITENS['4629'], { cdr: 0.15 })` |
| `motor.js:255` | o `cdr` do item leva o multiplicador de refino/qualidade: `cdr: (i.cdr \|\| 0) * m` |
| `motor.js:55` | `BONUS_REFINO = 0.12` |
| `motor.js:173-179` | qualidade A = ×1,15 |
| conta | 0,15 × (1 + 0,12×3) × 1,15 = **0,2346** → o jogo mostra 0,23 |
| `extension/automation.js:1336-1360` | `efeitosEquipados()` **soma o `stats.cdr` dos itens equipados** e devolve 0,23 — não lê atributos |

**Conclusão:** o `cdr 0,23` é 100% do Ímpeto +3~A. O CDR de atributos é outra coisa (ver 0.3).

### 0.2 O pen NÃO é escalado por qualidade: 3175~A = 15%, não 17,25%

`motor.js:251-255` reescala `ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr` — e **não**
`penMag` (que fica no valor cru do catálogo, vindo do `...i`). A dica **medida** do `3175~A` em
`docs/snapshots/farm.json` diz exatamente *"Feitiço Penetrante: 15% de penetração mágica"*, e o
`stats.penMag` da entrada é `0.15`. Logo a bota de pen dá **15 pontos**, não 17,25.

### 0.3 Atributos do dono: MEDIDOS, e o Foco é 0

Medição ao vivo no painel de Atributos do jogo (Lead, 2026-10-14):
**Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · Foco 0.**

`motor.js:537` é a única porta do CDR de atributos: `0,004 × Foco`, tecto 0,30
(`motor.js:450-451`: "−0,4% de recarga (máx. 30%)"). Com **Foco 0, o CDR de atributos do dono é
ZERO** — os 23,46% da build atual são todos do Ímpeto.

> Isto fecha a pergunta "de onde vinham os 23%": vinham do item, e agora está medido.

---

## 1. O CDR: quanto cabe e quanto se desperdiça

`motor.js:537`:

```js
reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens),
```

Soma **directa** dos dois pedaços, com **dois** tectos: 30% só para os atributos e **40% para o
total** (`motor.js:537`). O que passar de 40% é **deitado fora** — não vale nada.

| CDR de item na build | Foco 0 (o dono) | Foco 25 | Foco 34 | Foco 57 | Foco 75 (máx.) |
|---|---|---|---|---|---|
| nenhum item de cdr | 0,0% | 10,0% | 13,6% | 22,8% | 30,0% |
| 3175~A (bota de pen) | 0,0% | 10,0% | 13,6% | 22,8% | 30,0% |
| 3171~A (bota de CDR) | 17,3% | 27,2% | 30,9% | 40,0%\* | 40,0%\* |
| 4629+3~A (Ímpeto do dono) | 23,5% | 33,5% | 37,1% | 40,0%\* | 40,0%\* |
| 3171~B + 4629~B (base) | 30,0% | 40,0%\* | 40,0%\* | 40,0%\* | 40,0%\* |
| **3171~A + 4629+3~A** | **40,0%\*** | 40,0%\* | 40,0%\* | 40,0%\* | 40,0%\* |
| 3175~A + 4629+3~A | 23,5% | 33,5% | 37,1% | 40,0%\* | 40,0%\* |

\* = o bruto passou de 40% → **TRAVADO**.
Números: 3171~A = 0,15×1,15 = **0,1725**; 4629+3~A = **0,2346**; a soma dos dois = **0,4071** →
o tecto corta **0,0071 (0,71 pontos)**. Com Foco 0 o par **quase não desperdiça**.

A partir de que Foco cada combinação trava (com Foco 0, que é o caso do dono, nenhuma trava além do par):

| CDR de item | trava a partir de |
|---|---|
| 3171~A (bota de CDR) | Foco 57 (22,8%) |
| 4629+3~A (Ímpeto do dono) | Foco 42 (16,8%) |
| 3171~B + 4629~B (base) | Foco 26 (10,4%) |
| 3171~A + 4629+3~A | **já trava com Foco 0** (bruto 40,71%) |

> **Isto responde ao "se é para somar a bota de CDR com o Ímpeto":** somar **não** desperdiça
> (40,71% → 40%, deita fora 0,71 pontos). O problema não é o tecto — é se o CDR compensa ou não
> em dano (ver §2 a §7).

---

## 2. MOB — as 6 combinações de CDR

**Alvo (a zona que o dono farma, `docs/snapshots/farm.json`: "Fosso do Dragão nível 30–40"):**
`Dragão Ancião (filhote)` ×2 e `Larva do Vazio` ×1, nível do meio **34** (`motor.js:370`,
`motor.js:3271`). HP = `CURVA.hp(34) × 1,6` = **7 530** (`motor.js:274`, `motor.js:292`),
armadura = `CURVA.armadura(34) × 1,2` = **67** (`motor.js:276`, `motor.js:292`).
Núcleo fixo em todas: **3089+2~B (Rabadon) + 3135~A (Vazio) + 3100+3~A (Lich)**.

**Katarina nv29** (atributos medidos; barra R/Q/A/E):

| cenário | cdr | dps | matar | vs o melhor |
|---|---|---|---|---|
| 1) SEM CDR (bota de pen 3175 + Chama 4645) | 0,0% | 1 360 | 5,54 s | −34,1% |
| 2) SÓ BOTA DE CDR (3171) + Chama | 17,3% | 1 529 | 4,92 s | −25,9% |
| 3) SÓ ÍMPETO (4629+3~A) + bota de defesa 3170 | 23,5% | 1 539 | 4,89 s | −25,4% |
| **4) BOTA DE CDR (3171) + ÍMPETO (4629+3~A)** | **40,0%\*** | **2 063** | **3,65 s** | **MELHOR** |
| 5) BOTA DE PEN (3175) + ÍMPETO (4629+3~A) | 23,5% | 1 739 | 4,33 s | −15,7% |
| 6) BOTA DE PEN (3175) SEM ÍMPETO | 0,0% | 1 360 | 5,54 s | −34,1% |

- **1 e 6 são a MESMA build** (a bota de pen é a bota "sem CDR") — o dono listou-as duas vezes.
- **3 vs 5** só diferem na bota: a bota de pen vale **+201 dps** sobre a bota de defesa.
- **A bota de CDR vale +324 dps** sobre a bota de pen (2 063 vs 1 739 = **+18,6%**).

**Yasuo nv12** (a zona do snapshot dele, Rota Superior nm [5,13]; alvo `Tropa Corpo a Corpo` nv9,
HP 939, armadura 11):

| cenário | cdr | dps | matar |
|---|---|---|---|
| 1) SEM CDR | 0,0% | 806 | 1,16 s |
| 2) SÓ BOTA DE CDR (3171) | 17,3% | 926 | 1,01 s |
| 3) SÓ ÍMPETO + bota de defesa | 23,5% | 862 | 1,09 s |
| **4) BOTA DE CDR + ÍMPETO** | **40,0%\*** | **977** | **0,96 s** |
| 5) BOTA DE PEN + ÍMPETO | 23,5% | 955 | 0,98 s |
| 6) BOTA DE PEN SEM ÍMPETO | 0,0% | 806 | 1,16 s |

**Katarina nv29 na zonaIdeal(29) = Rio** (`motor.js:3267`; `Arraia do Rio` nv29, HP 5 837,
armadura 78): 1 424 · 1 593 · 1 602 · **2 150** · 1 822 · 1 424 → a mesma ordem, +18,0% da bota de CDR.

> **Leitura:** *enquanto se joga na build de mago*, o CDR é o maior ganho disponível e **quer-se a
> bota de CDR COM o Ímpeto** (não um só). Mas ver §7: há uma build sem CDR nenhum que ganha destas.

---

## 3. MOB — ranking completo do 5.º espaço

Bota fixa `3175~A` + núcleo (3089+2~B, 3135~A, 3100+3~A); o 5.º item varia. Todos a qualidade B
(igual para igual). **Katarina nv29 vs Dragão Ancião (filhote) nv34:**

| # | item | dps | # | item | dps |
|---|---|---|---|---|---|
| 1 | **Espada do Rei Destruído (3153)** | **1 597** | 9 | Gume do Infinito (3031) | 1 346 |
| 2 | Ímpeto Cósmico (4629) | 1 522 | 10 | Morellonomicon (3165) | 1 317 |
| 3 | Tormento de Liandry (6653) | 1 412 | 11 | Cajado do Arcanjo (3003) | 1 311 |
| 4 | Força da Trindade (3078) | 1 369 | 12 | Lembranças do Lorde Dominik (3036) | 1 310 |
| 5 | Criafendas (4633) | 1 369 | 13 | Cetro de Rylai (3116) | 1 305 |
| 6 | Chama Sombria (4645) | 1 360 | 14 | Quebrapassos (6631) | 1 305 |
| 7 | Ampulheta de Zhonya (3157) | 1 354 | 15 | Dançarina Fantasma (3046) | 1 300 |
| 8 | Eco de Luden (6655) | 1 348 | 16 | Hidra Raivosa (3074) | 1 286 |

- **Melhor: a 3153 (Rei Destruído)**, +75 dps sobre o Ímpeto ~B.
- **Criafendas (4633) bate a Chama (4645)**: 1 369 vs 1 360 dps, e o AP final explica: **1 062,2 vs
  1 052,1**. A Criafendas dá 80 AP **+5% de AP total** (`itens.js:4633`, aplicado em `motor.js:523`
  sobre o total, atributos incluídos) e a Chama dá 110 AP planos (`itens.js:4645`).
- **Morellonomicon, Rylai e Zhonya são os piores de mago** (não dão dano).

**Yasuo nv12 vs Tropa Corpo a Corpo nv9** (mesmo núcleo de mago, para comparação):
1) Força da Trindade 1 091 · 2) Dançarina Fantasma 991 · 3) Rei Destruído 962 · 4) Gume do Infinito 954 ·
5) Quebrapassos 889 · 6) Ímpeto 882 · 7) Dominik 821 · 8) Chama 806 · … · 13) Liandry 776.
*(nota: o núcleo de mago é artificial para o Yasuo — a build dele é a de §7.)*

---

## 4. CHEFE (Barão Nashor) — as mesmas 6 combinações

Nível do Barão = `max(nm[0]+2, min(nm[1]+2, nívelJogador+4))` com nm=[40,48]
(`motor.js:371` + `motor.js:1121`) → **nv42** para o dono (nv29). HP = `CURVA.hp(42) × 16` =
**97 824**, armadura = `CURVA.armadura(42) × 1,8` = **122** (`motor.js:297`).

**Katarina nv29 vs Barão nv42:**

| cenário | cdr | dps | matar |
|---|---|---|---|
| 1) SEM CDR (bota de pen + Chama) | 0,0% | 474 | 206,39 s |
| 2) SÓ BOTA DE CDR (3171) | 17,3% | 519 | 188,36 s |
| 3) SÓ ÍMPETO + bota de defesa | 23,5% | 523 | 187,22 s |
| **4) BOTA DE CDR + ÍMPETO** | **40,0%\*** | **702** | **139,27 s** |
| 5) BOTA DE PEN + ÍMPETO | 23,5% | 608 | 160,88 s |
| 6) = cenário 1 | 0,0% | 474 | 206,39 s |

**Katarina nv35** (o nível de referência do `sim-chefes`): 1 161 · 1 272 · 1 282 · **1 718** ·
1 488 · 1 161 — a mesma ordem.

**Yasuo nv29 vs Barão nv42:** 398 · 434 · 413 · 465 · **473** · 398 → aqui vence o **5) bota de PEN +
Ímpeto** (por pouco: 473 vs 465 = +1,7%). É o único caso em que a bota de CDR+Ímpeto não ganha.

**Yasuo nv45 vs Barão nv49:** 1 241 · 1 336 · 1 323 · **1 647** · 1 499 · 1 241 → volta a vencer a
bota de CDR + Ímpeto.

> **Leitura:** contra o Barão o CDR vale ainda mais do que contra mobs (Katarina: 474 → 702 dps =
> **+48,1%** com o par bota de CDR + Ímpeto; no mob era +51,7% do mesmo par sobre o cenário 1).
> **O CDR acelera as habilidades E o giro das adagas**: a recarga efectiva é `recarga × (1 − cdr)`
> (`motor.js:1581`), as adagas nascem da Q/W/A/T, e o giro só dispara quando uma adaga é apanhada
> (`motor.js:2181`, `pegaCada = 0,35 s` em `motor.js:736`).

---

## 5. CHEFE — ranking do 5.º espaço

**Katarina nv29 vs Barão nv42** (bota 3175~A + núcleo):

| # | item | dps | | # | item | dps |
|---|---|---|---|---|---|---|
| 1 | **Tormento de Liandry (6653)** | **728** | 9 | Eco de Luden (6655) | 470 |
| 2 | Espada do Rei Destruído (3153) | 665 | 10 | Gume do Infinito (3031) | 463 |
| 3 | Ímpeto Cósmico (4629) | 531 | 11 | Morellonomicon (3165) | 459 |
| 4 | Lembranças do Lorde Dominik (3036) | 523 | 12 | Cajado do Arcanjo (3003) | 457 |
| 5 | Criafendas (4633) | 477 | 13 | Cetro de Rylai (3116) | 455 |
| 6 | Chama Sombria (4645) | 474 | 14 | Quebrapassos (6631) | 451 |
| 7 | Ampulheta de Zhonya (3157) | 472 | 15 | Dançarina Fantasma (3046) | 449 |
| 8 | Força da Trindade (3078) | 470 | 16 | Hidra Raivosa (3074) | 445 |

**O ranking do mob e o do chefe são DIFERENTES** nesta base de mago: no mob ganha a 3153 (1 597) e o
Liandry é o 3.º (1 412); no chefe ganha o **Liandry** (728) e a 3153 cai para 2.º (665). Razão: a
queima do Liandry **não leva mitigação nem papel** (`motor.js:1653`: `i.hp -= q`) e é **por alvo**
(`motor.js:1207`), e num alvo de 97 824 de vida ela rende durante toda a luta (275 dps), enquanto num
mob de 7 530 que morre em 4 s ela rende pouco.

**Yasuo nv45 vs Barão nv49** (mesma base de mago): 1) Rei Destruído **3 014** · 2) Dominik 1 835 ·
3) Trindade 1 803 · 4) Gume 1 690 · 5) Liandry 1 647 · 6) Ímpeto 1 487.

---

## 6. O 3153 (Espada do Rei Destruído): quanto pesa contra mob e contra chefe

`motor.js:1702`:
```js
if (a.tem('3153')) bruto += 0.05 * vidaRefItem(alvo, alvo.hp);   // 5% da vida ATUAL
```
`motor.js:1191`: `vidaRefItem = (alvo, vida = alvo.hpMax) => Math.min(vida, TETO_VIDA_ITEM * CURVA.hp(alvo.nivel))`
· `motor.js:1190`: `TETO_VIDA_ITEM = 3`.

O 3153 entra no **bruto do ataque básico**, logo **leva mitigação de armadura, papel e fator de nível**
(`motor.js:1702` → `motor.js:1202/1212/1221`). O tecto é por **nível do alvo**:

| | MOB — Dragão Ancião (filhote) nv34 | CHEFE — Barão Nashor nv42 |
|---|---|---|
| vida do alvo | 7 530 | 97 824 |
| tecto = 3 × `CURVA.hp(nível)` | 14 118 (3 × 4 706) | 18 342 (3 × 6 114) |
| **o tecto morde?** | **NÃO** (o multiplicador de vida da espécie é no máximo 2,2 — `motor.js:281-297`) | **SIM: só 18,8% da vida do alvo conta** |
| 5% da vida **média** do alvo, por ataque | **353,0** | **831,1** |
| isso é, por ataque | **4,69%** da vida do alvo | **0,85%** da vida do alvo |
| trocando o Liandry 6653 por ele (5.º espaço) | 1 412 → 1 597 = **+185 dps (+13,1%)** | 728 → 665 = **−63 dps (−8,7%)** |

**Quantificação da diferença (o pedido do dono):**

- **Em dano absoluto por ataque, o chefe é 2,35× o mob** (831,1 vs 353,0) — porque o tecto, apesar de
  morder, é um número grande.
- **Em fracção da vida do alvo, o mob é 5,52× o chefe** (4,69% vs 0,85%) — o 3153 é um item de
  **% da vida** e contra o Barão só 18,8% da vida dele é que conta.
- **No 5.º espaço da base de mago o sinal até troca**: +13,1% no mob, −8,7% no chefe (contra o Liandry,
  que é o melhor item de chefe dessa base).

**Mas nas builds ideais de §7 o 3153 está nas DUAS** (mob e chefe) e é o **item n.º 1** em ambas — porque
nesses builds ele multiplica por **crítico** (`motor.js:1703` passa `{critico}` → `motor.js:1213`
multiplica o dano todo, e o bónus do 3153 já está dentro do bruto) e por **velocidade de ataque**
(1,7 a 3,0 ataques/s), o que o transforma em `831 × 2,15 (crítico) × 3 ataques/s`.

---

## 7. Busca exaustiva: a build ideal de 5 espaços

7 botas lendárias × C(20,4) itens = **33 915 builds legais** por cenário (regras: 1 bota + 4 itens,
`motor.js:29` + `motor.js:2878`; cada lendário uma vez, `motor.js:2879` e `motor.js:2891`),
todos a ~B.

| cenário | build ideal (5 itens) | dps | mata em | build atual do dono | ganho |
|---|---|---|---|---|---|
| **MOB Katarina nv29** | 3172 Grevas Bélicas + 3031 Gume do Infinito + 3036 Lembranças do Lorde Dominik + 3046 Dançarina Fantasma + 3153 Espada do Rei Destruído | **2 401** | 3,14 s | 1 739 | **+662 (+38,0%)** |
| **MOB Yasuo nv12** | 3172 + 3031 + 3046 Dançarina Fantasma + 3153 + 3078 Força da Trindade | **2 349** | 0,40 s | 955 | **+1 394 (+146,0%)** |
| **CHEFE Katarina nv29** | 3172 + 3031 + 3036 + 3046 + 3153 (**a MESMA do mob**) | **1 375** | 71,14 s | 608 | **+767 (+126,1%)** |
| **CHEFE Yasuo nv45** | 3172 + 3031 + 3036 + 3153 + 3078 | **8 030** | 14,85 s | 1 665 | **+6 365 (+382,4%)** |

**O CDR nestas builds ideais:** todas têm **cdr 0,00%**. A melhor build que usa a **bota de CDR 3171**
fica em: Katarina mob 2 073 (#7 de 33 915), Yasuo mob 2 074 (#8), Katarina chefe 1 184 (#8), Yasuo
chefe 7 572 (#2 — aqui a bota de CDR é quase tão boa como a de AD). A melhor com **Ímpeto**: Katarina
mob 1 895 (#35), Yasuo mob 1 948 (#18), Katarina chefe 1 039 (#59), Yasuo chefe 6 824 (#12).

> **O que isto quer dizer:** o CDR é o melhor *dentro da build de mago* (§2/§4), mas a build de
> **AD/crítico não usa CDR nenhum** e ganha-lhe por muito: 2 401 vs 2 063 no mob (**+16,4%**) e
> 1 375 vs 702 no chefe (**+95,9%**).
> Os itens que **saem** da build atual do dono: 3175, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A (os cinco).

---

## 8. A build de mob é a de chefe?

| campeão | mob | chefe | iguais? |
|---|---|---|---|
| **Katarina nv29** | 3172, 3031, 3036, 3046, 3153 | 3172, 3031, 3036, 3046, 3153 | **SIM — 5 de 5 itens** |
| **Yasuo** | 3172, 3031, **3046**, 3153, 3078 | 3172, 3031, **3036**, 3153, 3078 | **NÃO — troca 1 item** |

Para o Yasuo a troca é **Dançarina Fantasma (3046) → Lembranças do Lorde Dominik (3036)**, e vale
**+29,6%** contra o Barão (6 198 → 8 030 dps, à mesma build e nível). Não é efeito do nível: à mesma
comparação contra um **mob** de nv44, a Dançarina ganha (5 522 vs 5 452 no `sim-chefes`). É o alvo:
o 3036 dá **+15% de dano contra chefes** (`motor.js:1214`) e **30% de penetração de armadura**
(`motor.js:539`), e é o único item do jogo com essa linha.

> **Resposta:** para a **Katarina** a build ideal é a **mesma** para mob e para chefe.
> Para o **Yasuo** não: **Dançarina Fantasma** no farm, **Lembranças do Lorde Dominik** no chefe.

---

## 9. Confirmação: o AD/crítico faz 2,8× a build de AP contra o Barão?

O `sim-chefes` mediu (`bun tools/sim-chefes.mjs`, secção `-- [2] Builds`, Katarina nv35 vs Barão nv42):
**IDEAL 3172,3153,3031,3036,3046 = 2 757 dps** contra a **build AP do bot 3175,3089,3135,3100,6653 =
993 dps** → **2,78×**.

**CONFIRMA-SE**, e por dois motores independentes:

| motor | Katarina nv35 (IDEAL vs AP) | Yasuo nv45 (IDEAL vs AP) |
|---|---|---|
| `sim-chefes` (`dpsTeorico`) | 2 704 vs 993 = **×2,72** | 6 187 vs 1 073 = **×5,76** |
| este motor (S9, com as 3 correcções) | 3 183 vs 1 271 = **×2,50** | 8 078 vs 1 527 = **×5,29** |

**Ressalvas (as 3 correcções deste motor, todas com linha do motor):**
1. `motor.js:1214` — o 3036 dá **+15% contra chefes**; o `sim-chefes` **não aplica** (subestima o AD/crítico).
2. `motor.js:1653` — a queima do Liandry tira vida **directa, sem mitigação**; o `sim-chefes` aplica
   `mit()` (subestima o AP).
3. `sim-chefes.mjs:435` — `reducaoRecarga: Math.min(0.4, cdrItens)` **ignora o Foco**; neste motor é
   `motor.js:537` completo (com Foco 0 do dono é neutro, mas a fórmula fica certa).

Também se confirma a ordem de grandeza do que o `sim-chefes` diz da luta real: com a build atual a
Katarina **morre** contra o Barão nv42 (`-- [6] ATUAL`: `MORRE aos 9.95 s`), e com a build ideal
mata em `68.35 s` a nv30.

---

## 10. O que NÃO está verificado

1. **Estatísticas base dos campeões** — `motor.js:4` e `motor.js:6` importam `dados-katarina.js` e
   `dados-yasuo.js`, que **não existem** em `docs/game-src/`. As bases usadas estão calibradas contra
   os snapshots medidos. Erro do modelo para o dono (Katarina nv29, atributos medidos):
   AD **−7,8** (153,2 vs 161), AP **−52,6** (1 051,4 vs 1 104), vida **+60,4** (4 536,4 vs 4 476),
   armadura **−6** (158 vs 164), RM **−4** (130 vs 134). O VA bate (1,163 vs 1,16). Como o erro é
   **igual em todas as builds comparadas**, ele não muda o ranking — mas o AP real é ~5% maior do que
   o modelo diz, o que **favorece ligeiramente as builds de mago** face ao que aqui está.
2. **Ranks de habilidade fixos** na busca exaustiva (calculados na build de referência, não re-optimizados
   por build). Pode subestimar ligeiramente as builds de AD/crítico.
3. **Não modelado** (nem aqui nem no `sim-chefes`): a passiva D da Katarina (`Lâmina Sinistra`,
   +vel. de ataque por adaga, `motor.js:755-756`); o Último Suspiro do Yasuo aplica-se **só ao
   ataque básico** neste modelo, não às habilidades.
4. **Passivas condicionais** (Chama Sombria `motor.js:1205`, Morellonomicon `motor.js:1206`) foram
   medidas com fracção **0** da luta abaixo do limiar — são um **piso**. Com luta a 40%/50% abaixo do
   limiar elas sobem.
5. **Foco do dono** = 0 é medição ao vivo do Lead; se o dono puser pontos em Foco, tudo o que é CDR
   degrada-se segundo a §1 (trava em Foco 42 com o Ímpeto +3~A).

---

## 11. RESPOSTA DIRETA (4 linhas)

1. **CDR: SIM — mas só enquanto se joga na build de mago.** Com Foco 0, ir de 0% a 40% de CDR leva a Katarina de 1 360 → 2 063 dps no mob (**+51,7%**) e de 474 → 702 dps no Barão (**+48,1%**). A build ideal de todas, porém, tem **0% de CDR** (§7).
2. **Bota de CDR + Ímpeto: os DOIS juntos — não desperdiça.** 23,46% (Ímpeto +3~A) + 17,25% (3171~A; o CDR **é** escalado pela qualidade — `motor.js:255`) = 40,71% → o tecto de 40% corta só 0,71 pontos (`motor.js:537`). Os dois juntos dão 2 063 dps no mob contra 1 739 (só Ímpeto, com bota de pen), 1 529 (só bota de CDR) e 1 360 (nenhum). **Mas atenção:** o pen do 3175~A é **15%**, não 17,25% (`motor.js:251-255`), e a partir de Foco 42 o Ímpeto +3~A sozinho já trava no tecto.
3. **A build de mob e a de chefe: IGUAIS para a Katarina, DIFERENTES para o Yasuo.** Katarina: Grevas Bélicas + Gume do Infinito + Lorde Dominik + Dançarina Fantasma + Rei Destruído (a mesma nos dois). Yasuo: no farm troca o **Lorde Dominik** pela **Dançarina Fantasma** (+29,6% no chefe com o Dominik).
4. **As builds ideais, item a item:**
   - **MOB/CHEFE Katarina nv29:** Grevas Bélicas [3172] + Gume do Infinito [3031] + Lembranças do Lorde Dominik [3036] + Dançarina Fantasma [3046] + Espada do Rei Destruído [3153] → **2 401 dps no mob (mata em 3,14 s) e 1 375 dps no Barão (71,14 s)**, contra 1 739 / 608 da build atual (**+38,0%** e **+126,1%**).
   - **MOB Yasuo nv12:** Grevas Bélicas [3172] + Gume do Infinito [3031] + Dançarina Fantasma [3046] + Espada do Rei Destruído [3153] + Força da Trindade [3078] → **2 349 dps (0,40 s)**.
   - **CHEFE Yasuo nv45:** Grevas Bélicas [3172] + Gume do Infinito [3031] + Lembranças do Lorde Dominik [3036] + Espada do Rei Destruído [3153] + Força da Trindade [3078] → **8 030 dps (14,85 s)**, contra 1 665 da build atual (**+382,4%**).

---

### Como reproduzir

```
bun tools/sim-build.mjs      # secções S1–S9 (a Parte Nova é esta resposta)
bun tools/sim-chefes.mjs     # busca de builds + lutas contra o Barão
```

Secções novas em `tools/sim-build.mjs`: `statsAlvo10` / `dpsAlvo10` (l. 1091 / 1101), `IT10` / `CEN_CDR10`
(l. 1171 / 1179), `S1CDR` (l. 1216), `tabelaCombos10` (l. 1273), `ranking5_10` (l. 1309), `S5REI`
(l. 1335), `buscaIdeal10` (l. 1373), `RELATORIO10` (l. 1414), `S9CROSS` (l. 1515).
