# Simulação do Barão — build × nível → stats → DPS → duração, poções e margem

> **Fonte:** tools/sim-chefes.mjs (estendido nesta tarefa) · **Correr:** bun tools/sim-chefes.mjs
> **Fontes do jogo (leitura):** docs/game-src/motor.js, docs/game-src/itens.js, docs/game-src/balanco.js.
> **Regra de evidência:** todo o número leva file:linha. O que não existe no repositório está marcado
> **NAO VERIFICADO** e, quando possível, é *calibrado* contra os snapshots medidos em docs/snapshots/.
> **Nada aqui foi medido a jogar:** não houve browser, CDP, nem partidas.

---

## 0. O que o simulador passou a fazer

O tools/sim-chefes.mjs (antes: personagem fixo nv 27, 4188 HP, 154 arm, 127 RM; sem dano do jogador e sem
duração) passou a:

1. **Derivar os stats do campeão a partir da BUILD + NÍVEL** — port fiel de atributos() (motor.js:492-544),
   crescimento() (motor.js:434-437), infoItem() (motor.js:251-255), QUALIDADES (motor.js:173-179) e
   BONUS_REFINO (motor.js:55), com o catálogo REAL de 108 itens (itens.js:3).
2. **Calcular a DURAÇÃO da luta** — DPS do campeão (auto + habilidades + passivas de item) contra o HP do
   chefe, com armadura/penetração (motor.js:1202), papel do campeão (motor.js:1212) e o fator de diferença
   de nível (motor.js:1221).
3. **Simular a luta inteira** com as mecânicas reais: rodízio do chefe (motor.js:3080-3125), queimadura
   (motor.js:3105-3108 + motor.js:1358-1362), ataque básico (motor.js:1725-1737), larvas invocadas
   (motor.js:3118), Fluxo do Yasuo (motor.js:2713-2717 + motor.js:2031), poção a 1/s (motor.js:41) e a
   smart de poção que já existia.
4. **Varrer níveis** para responder: com que nível cada build começa a matar o Barão, em quantos segundos,
   com quantas poções e com que margem.

---

## 1. Stats do campeão: o que é dado e o que é calibrado

O AD base/crescimento está no motor: **Yasuo adBase 60 / adNivel 3,9** (motor.js:881), **Katarina adBase 58 /
adNivel 3,4** (motor.js:884). **As habilidades estão TODAS inline no motor** (Yasuo motor.js:696-729,
Katarina motor.js:735-771), incluindo o giro da Voracidade (motor.js:737) — portanto o dano das habilidades
é 100% verificável.

O que **não existe** no repositório é hp / hpperlevel / armor / armorperlevel / spellblock / attackspeed /
attackspeedperlevel: motor.js:4 e motor.js:6 importam dados-yasuo.js e dados-katarina.js e **esses ficheiros
não estão em docs/game-src/**. Daí a calibração contra os snapshots medidos:

| campeão | hp | hpperlevel | armor | armor/lvl | spellblock | AS | AS/lvl | fonte |
|---|---|---|---|---|---|---|---|---|
| Yasuo | 590 | 110 | 32 | 4,6 | 32 | 0,697 | 3,5% | **CALIBRADO-CONFIRMADO** — 6 setups de docs/snapshots/yasuo.json |
| Katarina | 905 | 108 | 32 | 4,5 | 32 | 0,658 | 2,74% | **CALIBRADO NAO VERIFICADO** — 1 ponto medido (nv29) |

**Erro do modelo contra o que foi medido** (saída real de calibrarContraSnapshots()):

| campeão | setup | erro hp | erro AD | erro armadura | erro RM |
|---|---|---|---|---|---|
| Yasuo | nv12 3047~A,1036~A,3044~A,1018~A,3133~A | −0,1 | +0,15 | −0,21 | +0,46 |
| Yasuo | nv12 1001~A,1036~A,3044~A,1018~A | −0,1 | +1,15 | +0,04 | +0,46 |
| Yasuo | nv11 1001~A,1018~B,1036~A,3044~A,3133~A | +0,3 | +0,97 | +0,12 | −0,29 |
| Yasuo | nv11 1001~C,1018~B,1036~A,3044~A,1042~C | +0,3 | +0,97 | −0,13 | −0,29 |
| Katarina | nv29 3175~A,3089+2~B,3100+3~A,3135~A,4629+3~A | +0,4 | **−7,8** | 0,0 | 0,0 |

Os atributos usados são os que fecham o snapshot: Yasuo **Força 10 · Vitalidade 7 · Resistência 4 ·
Agilidade 3** (24 dos 33 pontos do nv12); Katarina **Força 84 · Resistência 4** (os 84 pontos do nv29).

**Os dois erros da Katarina que ficam por explicar (NAO VERIFICADO):** o AD medido é 161 e o modelo dá 153,2
(−4,8%); o Poder medido é 1104 e o modelo dá 1060 (−4,0%). Nenhuma combinação de atributos fecha os dois (o
AD de uma campeã de magia não recebe Força — motor.js:503). Para o resto do relatório isto significa que a
Katarina **real** é ~4% mais forte do que a simulada: onde se lê "nv30", o jogo real pode dar nv29-30.

---

## 2. Prova de que a conta do dano e o nível do chefe estão certos

docs/snapshots/katarina.json tem uma luta REAL gravada: Katarina **nv29** (RM 134, papel recebido 0,75)
contra o **Dragão Infernal**, 35,6 s, 0 poções. O histórico mostra golpes de **296** a cada ~1,75 s, mecânica
de **673** e quedas de **32 a cada 0,25 s**.

| grandeza | medido no snapshot | modelo | conta |
|---|---|---|---|
| nível do Dragão | (deduzido) **33** | 33 | nm=[30,38] (motor.js:369) → max(32, min(40, 29+4)) (motor.js:1121) |
| ataque básico | **296** | **297** | CURVA.ad(33)×3 (motor.js:296) × mitigação por RM (motor.js:1167) × papel 0,75 (motor.js:884) |
| sopro (2,2×) | **673** | **654** | motor.js:3105 |
| queimadura | 32 / 0,25 s = **128/s** | **134/s** | 3% da vida máxima/s (motor.js:3105 + motor.js:1360) |

Isto valida, ao mesmo tempo, a curva dos monstros, a regra do nível do chefe, a mitigação e o papel do campeão.

---

## 3. Nível do chefe — a regra REAL e o que o "4" faz

    // motor.js:1121
    if (local.chefe && r() < local.chefe[1])
      return [criarMonstro(local.chefe[0], nivelJogador == null ? n1 + 2
        : Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4)), { chegada: 1.8 })];

Covil do Barão: faixa [40,50], **nm [40,48]** (motor.js:371) → o Barão nasce em
max(42, min(50, nível do jogador + 4)):

| jogador | Barão | hp | ad | armadura | fator dano do monstro | fator dano do jogador |
|---|---|---|---|---|---|---|
| nv25 | 42 | 97 824 | 1 408 | 122 | **×2,95** | **×0,25** |
| nv30 | 42 | 97 824 | 1 408 | 122 | ×2,20 | ×0,44 |
| nv35 | 42 | 97 824 | 1 408 | 122 | ×1,45 | ×0,79 |
| nv38 | 42 | 97 824 | 1 408 | 122 | ×1,00 | ×1,00 |
| nv40 | 44 | 103 776 | 1 510 | 128 | ×1,00 | ×1,00 |
| nv44 | 48 | 116 064 | 1 725 | 139 | ×1,00 | ×1,00 |
| nv46+ | 50 | 122 400 | 1 837 | 144 | ×1,00 | ×1,00 |

**O que o 4 de NIVEL_DIF faz (a pergunta do dono), com file:linha:**

    // motor.js:1184
    export const NIVEL_DIF = { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3, danoJogador: 0.07, minDanoJogador: 0.25 };
    // motor.js:1185-1187
    difNivel         = max(0, nivelMonstro − nivelJogador − 4)
    fatorDanoMonstro = min(3, 1 + 0,15 × dif)     // aplicado a TODO o dano de monstro (motor.js:2696 e motor.js:3099)
    fatorDanoJogador = max(0,25, 1 − 0,07 × dif)  // aplicado ao dano do jogador (motor.js:1221)

Ou seja, **livre: 4 é uma faixa de tolerância, não o nível do chefe**: um monstro até 4 níveis acima do
jogador não sofre nada; a partir daí, cada nível extra dá **+15% de dano ao monstro (até ×3)** e **−7% de
dano ao jogador (piso ×0,25)**. O + 4 do motor.js:1121 é **outra coisa** (o chefe nasce 4 níveis acima) — o
comentário do próprio motor diz isso em motor.js:1120: *"o chefe nasce no nível do jogador + 4, entre o
começo da zona + 2 e o topo + 2"*.

**Consequência prática no Barão:** a partir do **nv38** o Barão está sempre exactamente +4 → dif = 0 → sem
penalidade. Abaixo do nv38 o Barão fica **preso no nv42** (o chão da zona, n0+2) e a diferença cresce: aos
nv29-32 o jogador enfrenta um chefe 10-13 níveis acima, com **×2,2 a ×2,35 de dano recebido** e **×0,25 a
×0,44 de dano causado**. É esta a parede que decide "com que nível se mata o Barão".

---

## 4. Builds

A **build ideal do bot** (buildIdealPara / montarBuildDe, automation.js:4398-4444) foi portada para o
simulador (pesos automation.js:3578-3584, valorPassiva automation.js:3816-3883) para servir de **controlo**:
o port devolve **3172,3031,3046,3036,3074** para o Yasuo — **exactamente a lista medida** em
docs/drops-e-prioridades.md §3.2 — e **3175,3089,3135,3100,6653** para a Katarina (a lista medida é
3171,…,6653: **4 de 5 iguais**, muda só a bota; o port prefere a 3175 porque o texto "15% de penetração
mágica" entra no valorPassiva — e é a bota que a Katarina real do snapshot usa).

A **build ideal por DPS** é uma busca nova: shortlist por contribuição individual, exaustivo 4-a-4 e melhoria
local, com o DPS real contra o Barão (nível de referência nv45 para o Yasuo, nv35 para a Katarina).

| campeão | # | itens | DPS no Barão |
|---|---|---|---|
| **Yasuo** | extensão (bot) | 3172 Grevas Bélicas · 3031 Gume do Infinito · 3046 Dançarina Fantasma · 3036 Lembranças do Lorde Dominik · 3074 Hidra Raivosa | 2 041 |
| | **IDEAL (busca)** | 3172 · 3153 Espada do Rei Destruído · 3078 Força da Trindade · 3031 · 3036 | **7 025** |
| | **2ª IDEAL** | 3172 · 3153 · 3031 · 3036 · 6631 Quebrapassos | 6 226 |
| | #3 | 3171 Lucidez Escarlate · 3153 · 3078 · 3031 · 3046 | 6 221 |
| **Katarina** | extensão (bot) | 3175 Sapatos Enfeitiçados · 3089 Rabadon · 3135 Cajado do Vazio · 3100 Perdição de Lich · 6653 Liandry | 993 |
| | **IDEAL (busca)** | 3172 · 3153 · 3031 · 3036 · 3046 | **2 757** |
| | **2ª IDEAL** | 3172 · 3153 · 3031 · 6673 Arco-escudo Imortal · 3046 | 2 387 |
| | #3 | 3172 · 3153 · 3031 · 3036 · 6673 | 2 369 |

**Duas conclusões que contrariam a intuição (e saem das contas do motor):**

1. **A peça que decide a luta contra o Barão é a 3153 Espada do Rei Destruído.** O motor aplica "+5% da vida
   ATUAL do alvo" em **cada ataque básico** (motor.js:1702), com teto de 3×CURVA.hp (motor.js:1191) — contra
   um chefe de 97 824 a 122 400 de vida isso são ~800-900 de dano **por auto**, e ainda leva crítico (o bónus
   entra no bruto antes do critico, motor.js:1703). Nenhuma das duas builds do bot a tem.
2. **Para a Katarina, a build AP não é a melhor contra o Barão.** Com 3172+3153+3031+3036+3046 ela faz
   **2,8× o DPS** da build AP do bot (2 757 vs 993). O motor não proíbe itens AD a uma campeã de magia e o
   ataque básico dela escala com AD/crítico/AS como o de qualquer um (motor.js:1673-1703); o giro da
   Voracidade (motor.js:737) continua a somar por cima. É uma build de **ataque básico**, não de habilidades
   — mas é a que mata o Barão mais depressa.

---

## 5. O quadro principal — campeão × build × nível

Primeiro nível em que a build **sobrevive E mata** o Barão (varredura nv20→50; o Barão fica no nv42 até ao
nv38, como na tabela §3). "mínimo" = menor número de poções com que a luta ainda se ganha.

| campeão | build | nível | Barão | DPS | mata em | poções (min) | ouro | hpMin | dano tomado | sem poção |
|---|---|---|---|---|---|---|---|---|---|---|
| **Yasuo** | IDEAL (busca) | **29** | 42 | 1 860 | **52,6 s** | 41 (40) | 6 590 g | 108 (2,5%) | 57 952 | morre aos 7,2 s |
| | 2ª IDEAL | 30 | 42 | 2 016 | 48,5 s | 34 (33) | 5 300 g | 397 (8,8%) | 47 330 | morre aos 8,0 s |
| | (2ª IDEAL no nv29) | 29 | 42 | 1 664 | **não mata — morre aos 54,7 s** | — | — | — | — | — |
| | EXTENSÃO (bot) | 32 | 42 | 1 172 | 83,4 s | 65 (64) | 9 740 g | 281 (6,5%) | 81 850 | morre aos 8,0 s |
| **Katarina** | IDEAL (busca) | **30** | 42 | 1 431 | **68,4 s** | 56 (54) | 9 080 g | 65 (1,5%) | 76 832 | morre aos 8,0 s |
| | 2ª IDEAL | 30 | 42 | 1 236 | 79,1 s | 67 (67) | 10 970 g | 50 (1,1%) | 94 228 | morre aos 8,0 s |
| | EXTENSÃO (bot) | 32 | 42 | 772 | 126,7 s | 113 (112) | 18 780 g | 368 (7,5%) | 159 186 | morre aos 10,0 s |

**Stats em que cada build mata** (é o "que status devemos ter"):

| campeão | build | hp | AD | AP | armadura | RM | vel. ataque | crítico | ranks / barra |
|---|---|---|---|---|---|---|---|---|---|
| Yasuo | IDEAL nv29 | 4 283 | 462 | 0 | 161 | 130 | 2,23 | 100% | Q10 E4 R4 G10 T1 · barra **R/Q/E/T** |
| Yasuo | 2ª IDEAL nv30 | 4 510 | 473 | 0 | 165 | 134 | 2,23 | 100% | Q10 E5 R4 G10 T1 · R/Q/E/T |
| Yasuo | EXTENSÃO nv32 | 4 300 | 469 | 0 | 175 | 141 | 2,39 | 100% | Q10 E7 R4 G10 T1 · R/Q/E/T |
| Katarina | IDEAL nv30 | 4 377 | 357 | 70 | 163 | 134 | 2,07 | 75% | Q10 E7 R4 A9 · barra **R/Q/A/E** |
| Katarina | 2ª IDEAL nv30 | 4 640 | 378 | 70 | 163 | 134 | 2,07 | 75% | Q10 E7 R4 A9 · R/Q/A/E |
| Katarina | EXTENSÃO nv32 | 4 933 | 163 | **714** | 172 | 141 | 1,22 | 0% | Q10 E8 R4 A10 · barra R/A/Q/E |

Nota de repartição do dano (Yasuo IDEAL nv29): **auto 1 705** + habilidades 156, de 1 860 de DPS — é uma
build de auto-ataque. Na Katarina IDEAL: **auto 1 302** + habilidades 129. Na Katarina do bot: auto **62** +
habilidades 465 (o contrário).

---

## 6. DPS que o boneco toma × o mínimo para a luta

| campeão | build | nível | dano/s do Barão (básico mitigado × papel × nível) | dano/s médio levado (com mecânicas e queimadura) | cura/s das poções usadas | margem | pior golpe | pior mecânica | hpMin |
|---|---|---|---|---|---|---|---|---|---|
| Yasuo | IDEAL | 29 | 611 | **1 103** | 1 047 | **−56/s** | 2 607 | 1 403 | 108 |
| Yasuo | 2ª IDEAL | 30 | 564 | 976 | 911 | −65/s | 2 392 | 1 379 | 397 |
| Yasuo | EXTENSÃO | 32 | 473 | 981 | 972 | −9/s | 1 986 | 1 333 | 281 |
| Katarina | IDEAL | 30 | 497 | 1 124 | 1 109 | −15/s | 2 301 | 1 394 | 65 |
| Katarina | 2ª IDEAL | 30 | 497 | 1 191 | 1 158 | −33/s | 2 301 | 1 394 | 50 |
| Katarina | EXTENSÃO | 32 | 417 | 1 257 | 1 239 | −18/s | 1 921 | 1 348 | 368 |

**Como ler isto.** O "dano/s do Barão" é só o ataque básico: CURVA.ad(42)×3,2 × fator de nível ×
papel.recebido × as — 611/s para o Yasuo no nv29. O valor **real** é quase o dobro (1 103/s) porque entram
as mecânicas (tentáculos 2,6× = ~1 400 por golpe; ácido 1,2× + 5 s de queimadura a 3%/s) e a queimadura.
**O mínimo para a luta não é um valor de DPS: é sustain.** Em todos os casos que ganham, a cura das poções
fica **dentro de ~60/s do dano recebido** (margem negativa, coberta pelo HP inicial) e o hpMin termina em
**1% a 9%** da vida. Traduzindo: **a luta do Barão ganha-se a beber poção a cada segundo**, não a aguentar
golpes. O único mínimo "de stats" que existe é **não ser one-shot pela pior mecânica**: hpMax > piorMec
(4 283 > 1 403 no Yasuo IDEAL; 4 377 > 1 394 na Katarina IDEAL) — folgado em todas as builds, porque o pior
golpe (o tentáculo) bate nos ~2 600 e a vida anda nos ~4 300-4 900.

---

## 7. Poções e margem de erro

| campeão | build | nível | poções usadas (tipo) | mínimo | margem | ouro | sem poção |
|---|---|---|---|---|---|---|---|
| Yasuo | IDEAL | 29 | 41 (11 vida · 11 vidaF · 19 vidaS) | 40 | **1** | 6 590 g | morre aos 7,2 s |
| Yasuo | 2ª IDEAL | 30 | 34 (12 · 6 · 16) | 33 | **1** | 5 300 g | morre aos 8,0 s |
| Yasuo | EXTENSÃO | 32 | 65 (23 · 14 · 28) | 64 | **1** | 9 740 g | morre aos 8,0 s |
| Katarina | IDEAL | 30 | 56 (14 · 16 · 26) | 54 | **2** | 9 080 g | morre aos 8,0 s |
| Katarina | 2ª IDEAL | 30 | 67 (15 · 21 · 31) | 67 | **0** | 10 970 g | morre aos 8,0 s |
| Katarina | EXTENSÃO | 32 | 113 (25 · 34 · 54) | 112 | **1** | 18 780 g | morre aos 10,0 s |

**A margem de erro de poções é praticamente ZERO.** A smart (a que já existia: piso 65% da vida + previsão da
mecânica carregada) usa 1 poção a mais do que o mínimo em quase todos os casos — está a beber no limite do
cooldown de 1 s (motor.js:41). Consequências práticas:

- **Levar o mínimo não chega:** com o mínimo exacto a luta fecha por uma unha. O número seguro é
  **mínimo + 2** (margem para latência/erro).
- **Sem poção a luta acaba em 7-10 s.** Todo o combate é sustentado por poção: 41 poções = 41 s de vida.
- Custo: **5 300 a 18 780 de ouro por luta**. A build IDEAL da Katarina (9 080 g) é ~10 000 g mais barata
  que a build do bot (18 780 g) e ainda mata mais depressa.

---

## 8. ATUAL vs TEORIA (o pedido "o dps que o boneco vai tomar atualmente vs o mínimo")

| | Katarina ATUAL (nv29, snapshot) | Yasuo ATUAL (nv12, snapshot) | Katarina IDEAL | Yasuo IDEAL |
|---|---|---|---|---|
| build | 3175~A,3089+2~B,3100+3~A,3135~A,4629+3~A | 3047~A,1036~A,3044~A,1018~A,3133~A | 3172,3153,3031,3036,3046 | 3172,3153,3078,3031,3036 |
| DPS no Barão (nv42) | **563** | **54** | 1 431 (**×2,5**) | 1 860 (**×34**) |
| stats | hp 4 816 · AP 922 · arm 158 · RM 130 | hp 2 118 · AD 171 · arm 112 · RM 66 | hp 4 377 · AD 357 | hp 4 283 · AD 462 |
| dano/s que TOMA | 598/s (básico 539 + queimadura 59) | 1 104/s (básico 1 078 + queimadura 26) | 497/s | 611/s |
| resultado | **morre aos 55,4 s** (precisaria de ~174 s) | **não mata em 300 s** | mata em 68,4 s (nv30) | mata em 52,6 s (nv29) |

O "mínimo para a luta" teórico, para comparação directa: **DPS ≥ hp do Barão ÷ duração aceitável**
(97 824 ÷ 60 s = **1 631/s** para uma luta de 1 minuto) e **hpMax > pior mecânica** (~1 400). O Yasuo IDEAL
nv29 faz 1 860/s e passa; a Katarina actual faz 563/s e fica a 1/3 do necessário.

---

## 9. A hipótese do dono — resposta explícita

> *"katarina e yasuo com a build ideal mataria mais cedo o baron do que a segunda build ideal. e ate com
> level menor. talvez level 32 com a build ideal mate o baron, e 33 com a segunda build ideal"*

**Yasuo — CONFIRMA-SE (com números):** a build IDEAL mata no **nv29** e a 2ª IDEAL só no **nv30**. Um nível
mais cedo, e é tudo: no nv29 a 2ª IDEAL **morre aos 54,7 s** quando o Barão só cairia aos ~58,8 s — faltaram
4 segundos. Ao mesmo nível, a IDEAL ganha sempre:

| nível | IDEAL | 2ª IDEAL |
|---|---|---|
| nv28 | morre aos 20,3 s (dps 1 479) | morre aos 20,3 s (dps 1 326) |
| nv29 | **mata em 52,6 s, 41 poções** (hpMin 108) | morre aos 54,7 s (dps 1 664) |
| nv30 | mata em **43,3 s**, 29 poções (hpMin 1 087) | mata em 48,5 s, 34 poções (hpMin 397) |
| nv31 | mata em **36,7 s**, 25 poções | mata em 41,1 s, 29 poções |

O que separa as duas é a 3078 Força da Trindade (333 de vida + 30% de AS + a Lâmina Encantada) contra o 6631
Quebrapassos: no nv29 é a vida/AS que decide se o boneco sobrevive aos 55 s de luta.

**Katarina — EMPATE no nível (30 = 30); a IDEAL ganha em tempo e custo:** 68,4 s vs 79,1 s e 56 vs 67 poções.
Ou seja, a parte da hipótese que diz "a ideal mata mais cedo" **é verdadeira em tempo, não em nível**.

**"Level 32 com a build ideal":** o **nv32 é exactamente o nível da build que o bot equipa hoje** — tanto para
o Yasuo como para a Katarina (buildIdealPara). Com uma build melhor (a busca por DPS), o Barão cai **2 a 3
níveis mais cedo** (nv29-30). Portanto:

- Se "build ideal" = a que o script monta: **o dono acertou no 32**.
- Se "build ideal" = a melhor matematicamente: **29 (Yasuo) e 30 (Katarina)** — e a "segunda" faz 30 (Yasuo)
  e 30 (Katarina).
- A hipótese "a ideal mata num nível menor que a segunda" é **verdadeira para o Yasuo** e **empatada para a
  Katarina** (mesmo nível, menos 10,7 s e menos 11 poções).

---

## 10. NAO VERIFICADO / limites desta simulação

1. **dados-yasuo.js e dados-katarina.js não existem** no repositório (motor.js:4, motor.js:6). Tudo o que vem
   deles é **NAO VERIFICADO**: hp, hpperlevel, armor, armorperlevel, spellblock, attackspeed,
   attackspeedperlevel e os nomes das habilidades. A base usada foi calibrada (§1) — o Yasuo fecha com erro
   ≤ 1,2 em 6 setups; a Katarina tem 1 ponto e erra ≤ 4,8% no AD e ≤ 4,0% no AP.
2. **Regeneração de vida não entra** (hpregen/hpregenperlevel vêm do ficheiro ausente): o modelo é
   conservador (o boneco real cura um pouco por segundo, motor.js:1356).
3. **Itens de área não somam num alvo único:** o Runaan 3085 e a Hidra 3074 batem nos *outros* inimigos
   (motor.js:1718, motor.js:1720) — por isso não aparecem como DPS de chefe. O Quebrapassos 6631
   (motor.js:1719) e o Rei Destruído 3153 (motor.js:1702) **contam**, porque o motor os aplica também no
   alvo principal.
4. **Esquiva usada pela esperança** (1 − esquiva, motor.js:1731) e **crítico pela esperança**
   ((1−c) + c×danoCrítico): a simulação é determinística, não sorteia.
5. **Ranks fixados** na build de referência durante a busca de builds (aproximação; a alocação final é
   recalculada por nível na varredura). A alocação gasta **todos** os pontos (motor.js:1048) pelo maior ganho
   de DPS, já contando o buff do Último Suspiro (motor.js:706) e da Respiração do Vento (motor.js:709).
6. **Tecto de 300 s por luta** no simulador (o jogo não tem tecto; sem tecto, "não mata" seria "mata em horas").
7. **O Barão aparece em 1,5% dos grupos da zona** (motor.js:372): tudo isto assume que o chefe está lá.
8. O **buildIdealPara portado** não é o da extensão a correr: é uma reimplementação das mesmas fórmulas
   (automation.js:4398-4444). Fecha o Yasuo exactamente e a Katarina em 4 de 5 itens (§4).

---

## 11. Reproduzir

    bun tools/sim-chefes.mjs

A Parte 1 (comportamento antigo, personagem fixo) continua a correr igual. A Parte 2 imprime, por esta ordem:
[0] calibração contra os snapshots · [0.5] validação contra a luta real medida · [1] níveis do Barão ·
[2] builds · [3] varredura de níveis · [4] DPS tomado vs mínimo · [6] actual vs teoria · [5] veredito da
hipótese.
