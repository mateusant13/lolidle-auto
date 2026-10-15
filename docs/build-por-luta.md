# Build por LUTA (não por DPS) — roubo de vida, poções e ouro

> **Regra do dono (verbatim):** "é claro que roubo de vida é essencial. coloca na porra da build, e a build
> nao é só dps nao, meu filho. é tornar possivel enfrentar um boss ou nao, e em quantos segundos. se yasuo
> mata boss sem precisar de roubo de vida, e mais rapido, é com aquela build. se nao mata, e precisa de
> roubo de vida, muda a build ideal. se a build ideal, apos o level estar muito avançado e nao precisar de
> mais de roubo de vida, e só se segurar nas pocoes, nao vale a pena por que as pocoes ficam caras por ser
> muito uso, a build ideal muda de novo pra roubo de vida. é tudo levado em conta."
>
> **Ferramentas:** `tools/sim-chefes.mjs` (a luta: sobrevive? segundos? poções? ouro? — parte 3, `relatorioPorLuta()`)
> e `tools/sim-build.mjs` (DPS + cura/s — secção `QRV()`).
> **Fontes do jogo (leitura):** docs/game-src/motor.js, docs/game-src/itens.js, docs/game-src/balanco.js.
> **Regra de evidência:** cada número leva file:linha; o que não existe no repositório fica **NAO VERIFICADO**.
> **Nada aqui foi medido a jogar:** sem browser, sem CDP, sem partidas — só o motor lido como texto.

---

## 1. O critério é uma TUPLA, não um escalar

```
TUPLA = (mata?, segundos, ouro gasto em poções, ouro total da luta)
```

A ordem de ordenação é explícita (sim-chefes.mjs, `compararTupla`): **quem MATA e SOBREVIVE vem primeiro**;
entre esses, **menos segundos**; empate nos segundos → **menos ouro em poções**; empate → **menos ouro total**.
Quem não mata ordena por tempo aguentado (desc) e depois por ouro em poções (asc).

**Definição da 4.ª componente (sem ela a tupla não significa nada):**
`ouro total da luta = ouro em poções + preço de catálogo dos 5 itens equipados` (itens.js `preco`;
o refino NÃO entra — `motor.js:258` tem `precoRefino`, que é custo de re-forjar, não preço do item).
Nada disto é colapsado num número único: o relatório imprime sempre as 4 componentes.

Porque é que o DPS sozinho não serve: o ataque básico do chefe, as mecânicas carregadas
(`motor.js:3081-3125`), a queimadura (`motor.js:1358-1362`) e as larvas invocadas (`motor.js:3118`)
matam o boneco muito antes do DPS acabar — o simulador já mostrava "sem poção morre em 7-10 s".

---

## 2. O roubo de vida na luta (o que foi modelado)

| peça | motor.js | efeito |
|---|---|---|
| cura por ataque básico | `motor.js:1226-1228` | `if (a.rouboVida && fonte === 'ataque') { cura = dano * a.rouboVida; curar(...) }` |
| só AUTOS | `motor.js:1226` | habilidades, giro, Lich, queima **não** curam por rv |
| `curar()` | `motor.js:1285-1290` | `mult = (a.tem('3065') ? 1.25 : 1) * (PvP ? 0.65 : 1)` |
| escudo da 3072 | `motor.js:1229` | o que passar da vida máxima vira escudo, até 25% da vida máxima |
| dano do auto | `motor.js:1673-1722` | `bruto = AD + Lâmina (1697) + 5% da vida atual do 3153 (1702)` → tudo isto CURA; o 3748 (1721) e o 6631 (1719) vão como `'item'` e **não** curam |
| rouboVida nos stats | `motor.js:254` + `motor.js:538` | `rv` do item × (1 + 0,12 × refino) × qualidade (motor.js:255) |
| poções | `motor.js:261-267` + `motor.js:41` + `motor.js:1294` | cura/preço por nível; 1 poção/s (EXAUSTÃO); só a partir do nível da poção (vida 1, forte 15, suprema 30) |

Modelo implementado (fluxo contínuo, `dt = 0,05 s`; é a esperança do processo discreto):

```
curaRV/s = dps do AUTO-ATAQUE × rouboVida × (3065 ? 1,25 : 1)
curaKit/s = giro da Voracidade (motor.js:2169-2170) + Sede de Sangue (motor.js:1685)  [NÃO é rv]
```

A base de cura (`dpsAutoCura`) é **só** o dano que o motor passa a `golpear(..., 'ataque')` — o 3748 e o
6631 ficam de fora de propósito. As poções passaram também a respeitar o **nível mínimo** (`motor.js:1294`),
o que faltava no simulador.

**Itens com rv > 0 no catálogo — 7 de 108** (itens.js):

| id | nome | rv | preço | espaço | raridade | extras |
|---|---|---|---|---|---|---|
| 1053 | Cetro Vampírico | 7% | 900 | arma | épico | AD 15 |
| 3008 | Grevas Vorazes | 7% | 1000 | botas | épico | AD 15 |
| 3168 | Caminho Imortal | 12% | 2900 | botas | lendário | AD 40, vida 250 |
| 3172 | Grevas Bélicas | 6% | 3000 | botas | lendário | AD 30, VA 0,45 |
| 3153 | Espada do Rei Destruído | 10% | 3200 | arma | lendário | AD 40, VA 0,25 |
| 3074 | Hidra Raivosa | 12% | 3300 | arma | lendário | AD 65 |
| 3072 | Sedenta por Sangue | 15% | 3400 | arma | lendário | AD 80 |

O **3065** (Semblante Espiritual, +25% em toda cura recebida — `motor.js:1286`) **não existe** em itens.js:
o ×1,25 está modelado mas nenhuma build o pode ativar → **NAO VERIFICADO** por build.

---

## 3. Resultados reais (saída de `node tools/sim-chefes.mjs`)

Atributos: a regra do painel medido do dono — **Força 81 / Vitalidade 3 / resto 0 / Foco 0 no nv29**
(`atribDono(29)` = `{forca:81, vitalidade:3, resistencia:0, agilidade:0, foco:0}`), extrapolada por nível
(3×nível−1 pontos, 3 em Vitalidade). **NÃO deduzida de totais.** No nv29 o CDR do dono é 23,46%, todo do
Ímpeto +3~A (`0,15 × (1+0,12×3) × 1,15`, motor.js:24,255) — o modelo devolve exactamente 23,46%.

### 3.1 YASUO nv45 (Barão nv49) — ordenado pela tupla

| | build | seg | poções | ouro poções | ouro total | rv / cura | dps |
|---|---|---|---|---|---|---|---|
| 1 | **3172,3153,3078,3031,3036** | **17,45 s** | **0** | **0 g** | 16 333 g | 16% / 1000/s | 6816 |
| 2 | 3171,3153,3078,3031,3046 | 19,60 s | 0 | 0 g | 15 483 g | 10% / 557/s | 6067 |
| 3 | 3172,3153,3078,3031,3085 | 19,60 s | 0 | 0 g | 15 683 g | 16% / 899/s | 6079 |
| … | melhor **SEM** rv: 3171,3078,3031,3036,4629 | 33,50 s | 17 | 1460 g | 17 393 g | 0% / 0/s | 3555 |

### 3.2 KATARINA nv35 (Barão nv42) — ordenado pela tupla

| | build | seg | poções | ouro poções | ouro total | rv / cura | dps |
|---|---|---|---|---|---|---|---|
| 1 | **3172,3153,3031,3036,3046** | **35,15 s** | **12** | **760 g** | 16 410 g | 16% / 396/s | 2781 |
| 2 | 3172,3153,3078,3031,3036 | 41,30 s | 13 | 1160 g | 17 493 g | 16% / 329/s | 2367 |
| … | melhor **SEM** rv: 3171,3135,3089,3100,4629 | 77,05 s | 62 | 6500 g | 21 700 g | 0% / 0/s | 1269 |

**Nas duas, a melhor build da tupla leva roubo de vida** (3153 + 3172 = 16%).

### 3.3 O preço de cada item de rv (troca pelo melhor item SEM rv do mesmo espaço)

| campeão | sai | entra | seg (rv − alternativa) | poções | ouro poções | DPS |
|---|---|---|---|---|---|---|
| Yasuo | 3172 (6%) | 3006 Grevas do Berserker | **−1,20 s** (rv mais rápido) | 0 | 0 g | +439 |
| Yasuo | 3153 (10%) | 3748 Hidra Titânica | **−15,50 s** | −10 | −750 g | +3198 |
| Katarina | 3172 (6%) | 3006 Grevas do Berserker | **−2,70 s** | −7 | −700 g | +198 |
| Katarina | 3153 (10%) | 3078 Força da Trindade | **−44,45 s** | −49 | −5690 g | +1552 |

Leitura: **neste catálogo o item de rv não custa dano — é o contrário.** O 3153 (10% rv) e o 3172 (6% rv)
são dos melhores itens de DPS do jogo (o 3153 tem o proc de 5% da vida atual, motor.js:1702; o 3172 tem
AD 30 + 45% de velocidade de ataque + 6% de AD total). Por isso "levar roubo de vida" não é um sacrifício
a compensar: é levar os melhores itens, que por acaso curam.

### 3.4 O rv só cura o que o AUTO-ATAQUE bate (`sim-build.mjs`, QRV)

| build (base fixa 3175+3089+3135+3100 + o 5.º) | dps | dps auto | AD | VA | rv | cura/s |
|---|---|---|---|---|---|---|
| base de AP (a do dono) + 3153 | 1085 | 171 | 201 | 1,45 | 10% | **17/s** |
| base de AD/VA 3172+3153+3031+3036+3046 | 2306 | 1679 | 361 | 2,73 | 16% | **269/s** |
| base de AD/VA sem os dois itens de rv | 1992 | 1409 | 317 | 2,61 | 0% | 0/s |

Ou seja: a mesma percentagem de roubo de vida vale 8–25 cura/s numa base de AP e centenas de cura/s numa
base de AD/VA. **Quem não bate autos não tem roubo de vida nenhum** — e a build de AP da Katarina é
exactamente isso (auto 171 dps vs 1679 da de AD/VA).

---

## 4. A ECONOMIA: a que nível o rv compensa, e quando volta a compensar

Métricas por nível (varredura nv22→nv50, Barão `nm=[40,48]` motor.js:371 → chefe nv `max(42, min(50, nv+4))`):

- **ouro em poções por luta** (a 3.ª componente da tupla);
- **ouro em poções por HORA DE FARM** = `custo × (3600/segundos)` — é o "uso" que o dono diz que torna as poções caras;
- **loot por abate** = `CURVA.ouro(nv do chefe) × 20 (Barão) × 0,75 médio` (motor.js:278, 297, 1071) × `fatorSaque`
  (motor.js:421) → **2325 g** com o Barão nv42 e **2745 g** com o Barão nv50;
- **L\*** = ouro de loot por abate em que o rv EMPATA em ouro/hora:
  `L* = (abates_sem × custo_sem − abates_rv × custo_rv) / (abates_sem − abates_rv)`; o rv compensa se o loot
  for **menor** que L\*.

### 4.1 Yasuo

| nv | Barão | loot | COM rv (seg/p/ouro/g-h) | SEM rv (seg/p/ouro/g-h) |
|---|---|---|---|---|
| 29 | 42 | 2325 | não mata (9,95 s, 3p, 260 g) | não mata (7,95 s, 1p, 110 g) |
| **30** | 42 | 2325 | **MATA 44,35 s · 30p · 3610 g · 293 033 g/h (155% do loot)** | **NÃO MATA** (morre aos 55 s; 44p = 6910 g desperdiçados) |
| 31 | 42 | 2325 | MATA 37,50 s · 20p · 2320 g · 222 720 g/h (100%) | MATA 79,55 s · 68p · 10 880 g · 492 370 g/h (468%) |
| 33 | 42 | 2325 | MATA 28,25 s · 8p · 680 g · 86 655 g/h (29%) | MATA 54,90 s · 39p · 5130 g · 336 393 g/h (221%) |
| **36** | 42 | 2325 | MATA 20,10 s · **0p · 0 g** | MATA 38,15 s · 27p · 2070 g · 195 334 g/h (89%) |
| 45 | 49 | 2693 | MATA 17,45 s · 0p · 0 g | MATA 33,50 s · 17p · 1460 g · 156 896 g/h (54%) |
| 50 | 50 | 2745 | MATA 16,60 s · 0p · 0 g | MATA 31,40 s · 14p · 1200 g · 137 580 g/h (44%) |

Líquido por hora no nv50: **COM rv 595 301 g/h** vs **SEM rv 177 134 g/h** (3,4× menos).

### 4.2 Katarina

| nv | Barão | loot | COM rv (seg/p/ouro/g-h) | SEM rv (seg/p/ouro/g-h) |
|---|---|---|---|---|
| 29 | 42 | 2325 | não mata (12,5 s, 5p, 480 g) | não mata (8,45 s, 1p, 110 g) |
| **30** | 42 | 2325 | **MATA 67,85 s · 53p · 7360 g · 390 508 g/h (317%)** | **NÃO MATA** (morre aos 124,15 s; 111p = 21 210 g desperdiçados) |
| 31 | 42 | 2325 | MATA 57,60 s · 40p · 5080 g · 317 500 g/h (218%) | MATA 150,40 s · 138p · 26 250 g · 628 324 g/h (**1129%**) |
| 35 | 42 | 2325 | MATA 35,15 s · 12p · 760 g · 77 838 g/h (33%) | MATA 77,05 s · 62p · 6500 g · 303 699 g/h (**280%**) |
| **37** | 42 | 2325 | MATA 29,15 s · **0p · 0 g** | MATA 64,15 s · 47p · 3720 g · 208 761 g/h (160%) |
| 50 | 50 | 2745 | MATA 28,25 s · 0p · 0 g · 349 805 g/h de loot | MATA 77,00 s · 62p · 4960 g · 231 896 g/h (**181% do loot**) |

Líquido por hora no nv50: **COM rv +349 805 g/h** vs **SEM rv −103 558 g/h** — a build sem rv
**perde ouro em cada abate** (as poções custam 4960 g e o Barão só larga 2745 g).

### 4.3 Os cruzamentos, em números

| pergunta | Yasuo | Katarina |
|---|---|---|
| 1.º nível em que a build **COM** rv mata | **nv30** (44,35 s, 30p, 3610 g) | **nv30** (67,85 s, 53p, 7360 g) |
| 1.º nível em que a build **SEM** rv mata | **nv31** (79,55 s, 68p, 10 880 g) | **nv31** (150,40 s, 138p, 26 250 g) |
| nível em que a COM rv deixa de precisar de poções | **nv36** | **nv37** |
| nível em que a SEM rv deixa de precisar de poções | **NENHUM** até nv50 (no nv50 ainda bebe 14) | **NENHUM** até nv50 (no nv50 ainda bebe 62) |
| L\* (loot/abate em que o rv empata) | **não existe em nenhum nível** | **não existe em nenhum nível** |

**Resposta directa ao dono (item 3):**
1. **"A partir de que nível o rv deixa de compensar porque já não precisas de poções?"** — a *poupança de
   poções* do rv vai a zero no **nv36 (Yasuo)** e no **nv37 (Katarina)**: a partir daí a build com rv mata
   **sem beber**. Mas isso **não** faz o rv deixar de compensar, porque o rv também ganha nos segundos
   (nv45 Yasuo: 17,45 s vs 33,50 s; nv50 Katarina: 28,25 s vs 77,00 s) e no ouro total.
2. **"A partir de que nível volta a compensar porque as poções ficaram caras pelo uso?"** — **volta a
   compensar já em todos os níveis em que a alternativa precisa de beber.** A build sem rv nunca chega a
   0 poções: no nv50 ainda gasta 1200 g (Yasuo, 44% do loot) e 4960 g (Katarina, 181% do loot — perde
   ouro). Em g/hora, a sem rv gasta 137 580 g/h (Yasuo) e 231 896 g/h (Katarina) contra 0 g/h das duas
   builds com rv.
3. **Não há ponto de inversão (L\*) porque não há troca a fazer**: a build com rv é mais rápida **e**
   mais barata em todos os níveis testados. A premissa do dono — "o item de rv custa dano/segundos" —
   **não se verifica neste catálogo**: os itens de rv são os melhores itens de DPS. O que o rv custa é
   **espaço**, e o espaço é decidido pela tupla da luta.

---

## 5. As respostas (a)(b)(c)(d)

### YASUO — nv45, Barão nv49

- **(a) mata mais cedo:** `3172,3153,3078,3031,3036` → **17,45 s com 0 poções = 0 g** (rv 16% = 1000 cura/s, hpMin 88,5%).
- **(b) menor custo de poções:** a **mesma build** (0 poções = 0 g). Qualquer outra alternativa bebe ≥ 10 poções.
- **(c) são a mesma → não há escolha a fazer.** Se um dia divergirem, o critério é a ordem declarada da
  tupla (mata → segundos → ouro em poções → ouro total), não um número único.
- **(d) ponto de viragem:** poupança de poções do rv → **zero no nv36**; a alternativa **nunca** chega a 0
  poções (nv50: 14p/1200 g) e nunca é mais rápida (nv45: 33,50 s vs 17,45 s). **O rv compensa em todos os
  níveis em que o Barão é enfrentável.**

### KATARINA — nv35, Barão nv42

- **(a) mata mais cedo:** `3172,3153,3031,3036,3046` → **35,15 s com 12 poções = 760 g** (rv 16% = 396 cura/s, hpMin 53,8%).
- **(b) menor custo de poções:** a **mesma build** (760 g). A melhor sem rv gasta **6500 g** (62 poções) e demora 77,05 s.
- **(c) são a mesma → não há escolha a fazer.**
- **(d) ponto de viragem:** poupança de poções do rv → **zero no nv37**; a alternativa **nunca** chega a 0
  poções (nv50: 62p/4960 g = 181% do loot → **perde ouro em cada abate**, líquido −103 558 g/h). O rv
  compensa em todos os níveis em que o Barão é enfrentável.

### O dono tem as duas respostas, e elas são a MESMA build
Em nenhum dos dois campeões a "build que mata mais cedo" difere da "build que mata com menos poções":
o roubo de vida ganha as duas componentes ao mesmo tempo, porque os itens de rv também são os de maior DPS.

### O que NÃO ganha (para ficar registado, com números)
- **A build de AP da Katarina (a "ideal" da extensão: 3175,3089,3135,3100,6653)** não leva rv, cura 0/s por
  rv, e na varredura de níveis só mata o Barão no **nv31 em 146,4 s com 134 poções = 25 060 g** — contra
  nv30/67,85 s/7360 g da build de AD/VA com rv (mesmo campeão). A melhor build SEM rv que o simulador
  encontra no nv50 continua a beber 62 poções (4960 g), contra 0 poções da build com rv.
- **O 3168 (Caminho Imortal) e o 3072 (Sedenta por Sangue)** nunca entram nas melhores builds: o 3168 é
  bota e perde para a 3172 — medido no sim-build (QRV, mesma base): 3168 = 947 dps, 3172 = 1010 dps, apesar
  de o 3168 ter 12% de rv contra 6%; o 3072 tem o maior rv (15%) mas no 5.º espaço dá 1082 dps contra 1085
  do 3153 (e o 3153 ainda traz o proc de 5% da vida atual). Os itens de rv que ganham são **3153** e
  **3172** — e ganham pelo dano, não pelo rv.

---

## 6. O personagem real do dono (medido, não deduzido)

Painel: **Força 81 / Vitalidade 3 / resto 0 / Foco 0** (nv29) — CDR 23,46% todo do Ímpeto +3~A.
O modelo reproduz: hp 4476 (medido 4476), armadura 164 (164), RM 134 (134), CDR 23,46% (23,46%);
erro de AD −7,8 (153 vs 161) — erro conhecido do modelo, **NAO VERIFICADO** (dados-katarina.js não existe).

| campeão | build actual | vs Barão | resultado |
|---|---|---|---|
| Katarina nv29 | 3175~A,3089+2~B,3100+3~A,3135~A,4629+3~A | nv42 | **NÃO MATA — morre aos 8,45 s** (1 poção, 110 g); sem poção morre aos 7,95 s; rv 0% → cura 0/s |
| Yasuo nv12 | 3047~A,1036~A,3044~A,1018~A,3133~A | nv42 | **NÃO MATA** (dps insuficiente: > 300 s); rv 0% → cura 0/s |

**Leitura prática:** nos níveis reais de hoje (Yasuo nv12, Katarina nv29) o Barão está fora de alcance
para os dois, com ou sem roubo de vida — e as builds actuais **não têm rv nenhum**. O Barão só passa a ser
enfrentável por volta do **nv30**, e é exactamente aí que a build com roubo de vida é a que mata.

---

## 7. Como correr

```
node tools/sim-chefes.mjs              # parte 2 (build x nível) + parte 3 (por-luta, tupla, rv, economia)
node tools/sim-chefes.mjs --so rv      # só a parte 3
node tools/sim-chefes.mjs --so baron   # só a parte 2
node tools/sim-chefes.mjs --so rv --de 22 --ate 50
node tools/sim-build.mjs               # DPS + QRV (cura/s do rv, preço do espaço, AP vs AD/VA)
```

---

## 8. NAO VERIFICADO / limitações (a ler antes de decidir)

1. **Base dos campeões** (hp/hpperlevel/armor/attackspeed): os ficheiros dados-yasuo.js / dados-katarina.js
   são importados em motor.js:4 e motor.js:6 e **não existem** em docs/game-src/. O modelo é calibrado
   contra os snapshots (Yasuo: erro ≤ 0,5; Katarina: 1 ponto medido, erro de AD −7,8).
2. **Habilidades**: as tabelas de recarga/base/ratio estão inline no motor (verificáveis); os NOMES e
   alguns campos vêm dos ficheiros ausentes.
3. **Cura contínua vs discreta**: o motor cura por golpe (`motor.js:1226`); o simulador aplica a esperança
   como fluxo contínuo (`cura/s × dt`). É a média do processo, não a sequência exacta dos críticos.
4. **3065 (Semblante Espiritual)**: não existe no catálogo → o ×1,25 está modelado mas nenhuma build o ativa.
5. **3748 / 6631 / Lich**: não curam por rv (vão como `'item'`) — modelado de propósito (motor.js:1719,1721,1688).
6. **Ouro por abate**: motor.js:1071 usa `(0,5 + rand × 0,5)`; o simulador usa a **média 0,75**. Os itens que
   o Barão larga (DROP_CHEFE) **não** estão contados no loot — o loot real é maior, logo a conclusão
   "as poções custam mais que o abate" é conservadora.
7. **A busca de builds é por DPS** (shortlist) e só depois ordenada pela tupla entre os melhores por DPS:
   uma build de DPS ligeiramente menor mas muito mais barata em poções pode escapar. O topo (12 por
   família) é avaliado com a luta completa.
8. **Nada foi validado a jogar**: sem CDP, sem browser, sem partidas.
