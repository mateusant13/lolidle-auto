# TROCAR ITENS E HABILIDADES EM COMBATE — DRAGAO INFERNAL

Simulador: `tools/sim-swap.mjs` — importa `tools/sim-chefes.mjs` (NAO edita nada de la).
Corre com: `bun tools/sim-swap.mjs`; a saida completa sai no terminal (stdout).
Este documento resume a SAIDA REAL de uma corrida. Cada numero tem `file:linha`.

---

## 0. A RESPOSTA CURTA

| Pergunta do dono | Resposta |
|---|---|
| Da para trocar item em combate? | **SIM.** `equipar`/`trocarItem`/`desequipar` nao olham para o combate. A unica funcao que trava com `emCombate` e o **recall** (motor.js:3061). |
| Da para trocar habilidade em combate? | **SIM.** `alternarBarra`/`trocarNaBarra` nao olham para o combate nem para as recargas (motor.js:2834-2843). So exigem rank >= 1. |
| O que se perde na troca? | **Nada do estado da habilidade.** As recargas, os buffs e as canalizacoes vivem em `c.darius`, nao na barra (motor.js:1055-1057, 1363, 2186-2208). |
| O que muda? | As estatisticas sao relidas no quadro seguinte (motor.js:1335 + 492-544). E a vida atual e CORTADA se tirares um item de vida (motor.js:2866). |
| Vale a pena contra o Dragao Infernal? | **NAO.** Nenhum gatilho paga o custo: com a melhor build a luta acaba em 24 s e a vida nao desce de 60,2%. Nao ha fase para reagir. |
| Entao para que serve? | Para **corrigir uma build errada antes do primeiro golpe** (t=0). E o unico caso que ganha — e ganha **3,80 s e 2 pocoes** na luta medida. |

**O unico ganho real encontrado**: o dono joga com os **mesmos 4 itens** e so a bota diferente
(motor.js:864-885 + itens.js). Trocar a bota **antes** da luta vale **3,80 s** na simulacao e
confirma-se na medicao real (35,6 s medidos com a bota actual, docs/snapshots/dps.json).

---

## 1. O BOSS — DRAGAO INFERNAL (o 2.o mais forte)

| Numero | Valor | Onde |
|---|---|---|
| hp (multiplicador) | 12 | motor.js:296 |
| Arauto / Barao | 10 / 16 | motor.js:295 / 297 |
| ad, as, armadura | 3, 0,55, 1,6 | motor.js:296 |
| Fosso do Dragao: faixa, nm | [30,40], [30,38] | motor.js:369 |
| Nivel do chefe | max(32, min(40, 29+4)) = **33** | motor.js:1121 |
| hpMax | CURVA.hp(33) x 12 = **54 468** | motor.js:274 + 296 |
| ad | CURVA.ad(33) x 3 = **927** | motor.js:275 + 296 |
| armadura | CURVA.armadura(33) x 1,6 = **87,2** | motor.js:276 + 296 |
| fatorDanoMonstro / Jogador | 1,00 / 1,00 (dif = 0) | motor.js:1184-1187 |
| ataque basico | a cada 1/0,55 = 1,82 s, MAGICO | motor.js:296 + 1725-1737 |

**MECANICAS** (motor.js:3066-3125; RODIZIO motor.js:3080; HAB_CHEFE motor.js:3069-3079):

| Mecanica | Aviso (carrega) | Espera | O que faz | Efeito extra |
|---|---|---|---|---|
| sopro | 1,0 s | 9 s | mag 2,2x do ad | queima 4 s a 3% da vidaMax/s (motor.js:3105) |
| chuva | 1,1 s | 9 s | mag 1,8x do ad | queima 3 s a 2,5%/s (motor.js:3106) |
| rugido | 0,8 s | 7 s | **SEM DANO** | +50% de velocidade de ataque por 5 s (motor.js:3107) |

Notas que importam para a troca:

- A queimadura usa `a.vida` **do momento do golpe** (motor.js:3105-3106) e NAO leva o fator de
  nivel nem a esquiva (motor.js:1360, `receberDano(..., true)`).
- O Rugido e a **unica mecanica sem dano**: e a janela segura de 0,8 s para trocar sem levar dano
  (motor.js:3087-3107). Mas o primeiro Rugido so aparece a t~25 s e a luta acaba aos 24 s — nao chega.
- A mecânica seguinte comeca no fim da anterior + `espera` (motor.js:3110). A primeira comeca a
  t=5 s (motor.js:3084, `i.tMec ??= 5`).

---

## 2. O JOGADOR

| Numero | Valor | Onde |
|---|---|---|
| Nivel | 29 (docs/snapshots/player.json) | — |
| Atributos MEDIDOS | Forca 81, Vitalidade 3, resto 0 | painel do dono |
| Katarina | magia, semMana, adagas | motor.js:884-885 |
| papel | dano 1,2 / recebido 0,75 | motor.js:885 |
| Forca -> AP | 2 por ponto | motor.js:503 |
| Fora de arena | usa `recebido` 0,75, nao `recebidoArena` 1 | motor.js:2697 + 885 |

**RANKS REAIS** (docs/snapshots/skills.json): Q=10, W=1, E=3, R=3, G=1, A=5, F=1; o resto 0.
24 pontos gastados dos 29 (motor.js:1048) — **faltam 5 pontos livres**. Barra actual: `["W","Q","R","A"]`.

> **Isto e importante**: T, B, M e N estao com **rank 0** (nunca aprendidas). Trocar a barra para
> elas **nao e possivel sem 1 ponto** (motor.js:2837/2842 exigem `estado.ranks[tecla]`;
> motor.js:2813 `subirHabilidade` gasta um). O dono tem 5 livres — da para aprender 3.

---

## 3. TROCAR ITENS — O QUE E PRECISO NO JOGO

| Funcao | Onde | Guarda de combate? |
|---|---|---|
| `equipar(estado, k)` | motor.js:2870 | **nao** |
| `trocarItem(estado, k, j)` | motor.js:2883 | **nao** |
| `desequipar(estado, k)` | motor.js:2913 | **nao** |
| `equipamentoValido(e)` | motor.js:2892 | **nao** |
| `emCombate(c)` | motor.js:3056 | usado SO em motor.js:3061 |

**No JOGO (UI)** — janela Bolsa `#janela-bolsa`:

- Clicar no item **equipado** guarda-o: jogo.js:6073 -> `guardarEquipado` (jogo.js:5930) -> `desequipar`.
- Clicar no item da **mochila** equipa-o: jogo.js:6081 -> `equiparDaMochila` (jogo.js:5935) -> `equipar`.
- Se os 4 espacos estao cheios, o mesmo clique faz `trocarItem` (jogo.js:6077).
- **NAO ha animacao, NAO ha cooldown, NAO ha custo**: e um clique por troca.
- O jogo continua a correr: `quadro()` a ~60 quadros/s com a aba visivel (jogo.js:1516-1524).
  O custo real da troca e o **tempo dos teus cliques**.

**O DRAGAO NAO E ARENA**: `LOCAL.dragao` nao tem a flag `arena` (motor.js:369); so `fonte`
(motor.js:355), `arena` (374) e `aram` (377) a tem. Logo `emCombate(c)` devolve `false` sempre que
`c.arena?.mundo` nao existe (motor.js:3056) e motor.js:3061 **nunca dispara** no Fosso do Dragao.

**Restricoes reais (lista completa):**

| Condicao | Onde |
|---|---|
| `equipar`: item sem atributo | motor.js:2872 |
| `equipar`: 4 espacos de item cheios | motor.js:2878 |
| `equipar`: lendario repetido | motor.js:2879 |
| `trocarItem`: bota com nao-bota | motor.js:2885 |
| `trocarItem`: lendario repetido | motor.js:2886 |
| `desequipar`: mochila cheia | motor.js:2915 |
| bota: so uma de cada vez (troca de lugar) | motor.js:2873-2875 |
| `ESPACOS_ITENS = 4` (o 5.o espaco e so de bota) | motor.js:29 |
| **`emCombate`** — so trava recall e viagem | motor.js:3061; jogo.js:467, 826, 3869, 4510, 4634 |

---

## 4. TROCAR HABILIDADES

| Numero | Valor | Onde |
|---|---|---|
| `BARRA` (slots) | **4** | motor.js:900 |
| `alternarBarra` | poe/tira da barra | motor.js:2834 |
| `trocarNaBarra` | poe no lugar de um indice | motor.js:2841 |
| Custo em mana/ouro | **zero** | — |
| Cooldown de troca | **zero** | — |

Regra de uso: `pode(t) = estado.barra.includes(t) && r[t] && d.recargas[t] <= 0 && mana >= custo`
(motor.js:1578). Ou seja: **so o que esta na barra e usado**.

**No JOGO (UI)**: aba Habilidades (jogo.js:5848-5861) e barra de baixo (jogo.js:5862-5868).
Cuidado: o clique na barra de baixo **lanca** a habilidade em Runeterra (jogo.js:5895), por isso a
troca de barra faz-se na aba Habilidades.

---

## 5. O QUE ACONTECE NO MEIO DA TROCA

| Coisa | Sobrevive? | Prova |
|---|---|---|
| Recargas das habilidades | **SIM** | `d.recargas[t]` so e decrementado (motor.js:1363); a barra e uma lista (motor.js:2834-2843) |
| Recarga escrita com o CDR do momento | so no USO seguinte | motor.js:1581: `d.recargas[t] = recarga * (1 - a.reducaoRecarga)` |
| Canalizacao em curso (R Lotus, N Tempestade) | **SIM** | `d.lotus` / `d.tempestade` sao objectos proprios (motor.js:2186-2208) |
| Buffs de habilidade (d.sede, d.veneno...) | **SIM** | vivem em `c.darius` (motor.js:1055-1057) |
| Timers de item (zhonya, sterak, anjo) | **SIM** | motor.js:2722-2731 — mas o item tem de estar la no gatilho (`a.tem`) |
| Escudo acumulado | **SIM** | motor.js:2718; o tecto de 25% passa a ser sobre a vida nova (motor.js:1229) |
| Adagas no chao | **SIM** | `d.adagas` (motor.js:2144-2150, 2176-2183) |
| **Vida atual** | **PODE DESCER** | `limitarVida` corta-a ao novo maximo (motor.js:2866) |
| Estatisticas | recalculadas no quadro seguinte | motor.js:1335 + 492-544 |

Ou seja: **nao ha preco mecanico**. Nao ha buff a reaplicar, nao ha proc a perder, a barra nao
reinicia. O unico risco e a vida (motor.js:2866).

---

## 6. A LUTA SEM TROCAS (baseline)

Tupla do dono = `(mata?, segundos, ouro em pocoes, ouro total = pocoes + preco de catalogo dos 5 itens)`.

| Build | Resultado | dps | vida min |
|---|---|---|---|
| Melhor do catalogo (AD/crit, sem qualidade) | MATA 26,35 s | 2 065 | 80,3% |
| **A que o dono joga** (3175~A + os 4 iguais) | MATA 27,8 s (medido no jogo: **35,6 s**) | 1 956 | 61,2% |
| **A melhor mochila do dono** (so troca a bota) | **MATA 24,0 s** | **2 269** | 60,2% |

O simulador erra para a build do dono em **-11%** (sim 31,6 s vs real 35,6 s com os ranks reais;
com os ranks que o jogo escolheria da 27,8 s). Serve para **comparar builds entre si**, nao para
prometer segundos absolutos.

---

## 7. A RESPOSTA DIRECTA: A MESMA BUILD, SO A BOTA TROCADA

Os 4 itens sao **identicos**; a unica diferenca e a bota:

| Bota | ap | penMag | cdr |
|---|---|---|---|
| Sapatos Enfeiticados `3175~A` (a do dono) | 80,5 | **15%** | 0 |
| Lucidez Escarlate `3171+2~B` (a melhor) | 74,4 | 0% | **18,6%** |

Efeito: AP 1051 -> 1043; reducaoRecarga 23,5% -> **40%** (tecto, motor.js:537); penMagica 55% -> 40%.
DPS 1956 -> 2269. **Luta 27,8 s -> 24,0 s (−3,80 s) e 8 -> 6 pocoes (−2, 80 g).**

Porque e que o CDR ganha a penMag: a Katarina e de MAGIA (motor.js:884), todo o dano dela e forcado
a magico (motor.js:1201) e defende-se com `armadura * 0,6` (motor.js:1202). O CDR encolhe a recarga
do Q (rank 10, motor.js:738) e da A (motor.js:752), que sao a maior parte do DPS. Os 15% de penMag
nao compensam (motor.js:529 soma os dois, com tecto de 60%).

Nota: o penMag **nao e escalado** pela qualidade/refino (motor.js:254-255 escala
ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr — **nao** o penMag): fica 15% seja qual for.

---

## 8. TABELA FINAL — TODOS OS CASOS DE USO

Ordenada por ganho contra a BASE (a melhor mochila do dono). **Nenhum caso tem ganho positivo.**
"nao dispara" = o gatilho nunca aconteceu nesta luta, portanto a troca e literalmente zero.

| # | CASO DE USO | GATILHO | TROCA | GANHO (seg / poc / ouro) | CUSTO | VALE A PENA? |
|---|---|---|---|---|---|---|
| 1 | bota: penMag -> CDR | arranque | Lucidez Escarlate | +0,00 s / 0 / 0 g | 1 s | NAO (nao dispara: ja la esta) |
| 2 | item: dano -> rv quando o chefe passa de 25% | vida do chefe < 25% | Espada do Rei Destruido | −0,45 s / −1 poc / +160 g | 1 s | TALVEZ (poupanca) |
| 3 | item: dano -> rv quando o chefe passa de 50% | vida do chefe < 50% | Espada do Rei Destruido | −0,90 s / −2 poc / +120 g | 1 s | TALVEZ (poupanca) |
| 4 | barra: [W,Q,R,A] -> [Q,F,R,A] | arranque | Q,F,R,A | −0,90 s / +1 poc / +40 g | 1 s | NAO |
| 5 | item: dano -> rv abaixo de 70% | vida < 70% | Espada do Rei Destruido | −1,20 s / −3 poc / +80 g | 1 s | TALVEZ (poupanca) |
| 6 | item: dano -> rv abaixo de 85% | vida < 85% | Espada do Rei Destruido | −1,35 s / −3 poc / +80 g | 1 s | TALVEZ (poupanca) |
| 7 | barra -> [Q,F,R,M] (rank 0) | arranque | M = Execucao Noxiana | −2,75 s / +1 poc / +40 g | 1 s + 1 ponto | NAO |
| 8 | barra -> [Q,F,R,T] (rank 0) | arranque | T = Chuva de Adagas | −2,75 s / +1 poc / +40 g | 1 s + 1 ponto | NAO |
| 9 | bota: dano -> RM na carga da chuva | mecanica (carrega) | Esmagadores Acorrentados | −2,95 s / −1 poc / +30 g | 1 s | TALVEZ (poupanca) |
| 10 | barra -> [W,E,R,A] | arranque | W,E,R,A | −3,00 s / +1 poc / +40 g | 1 s | NAO |
| 11 | barra -> [E,G,R,A] | arranque | E,G,R,A | −3,00 s / +1 poc / +40 g | 1 s | NAO |
| 12 | bota: CDR -> penMag | arranque | Sapatos Enfeiticados | −3,80 s / +2 poc / +180 g | 1 s | NAO |
| 13 | bota: dano -> RM a meio do chefe | vida do chefe < 50% | Esmagadores Acorrentados | −3,95 s / +1 poc / +40 g | 1 s | NAO |
| 14 | item: dano -> RM na carga da chuva | mecanica (carrega) | Esmagadores Acorrentados | −4,10 s / 0 / −200 g | 1 s | TALVEZ (poupanca) |
| 15 | barra -> [G,F,R,A] | arranque | G,F,R,A | −4,15 s / +1 poc / +40 g | 1 s | NAO |
| 16 | item: dano -> penMag a 60% do chefe | vida do chefe < 60% | Cajado do Vazio | −4,45 s / +2 poc / +80 g | 1 s | NAO |
| 17 | bota: dano -> RM na 1.a queimadura | queimadura | Esmagadores Acorrentados | −5,95 s / +1 poc / +40 g | 1 s | NAO |
| 18 | item: dano -> escudo 3072 abaixo de 70% | vida < 70% | Sedenta por Sangue | −6,20 s / +1 poc / +440 g | 1 s | NAO |
| 19 | bota: dano -> RM na carga do sopro | mecanica (carrega) | Esmagadores Acorrentados | −6,25 s / 0 / 0 g | 1 s | NAO |
| 20 | item: dano -> Semblante abaixo de 70% | vida < 70% | Semblante Espiritual | −7,20 s / 0 / −300 g | 1 s | TALVEZ (poupanca) |
| 21 | item: dano -> RM na carga do sopro | mecanica (carrega) | Esmagadores Acorrentados | −8,75 s / 0 / −200 g | 1 s | TALVEZ (poupanca) |
| — | bota: dano -> RM abaixo de 60% / 40% | vida < 60% / 40% | Esmagadores Acorrentados | **nao dispara** (vida min 60,2%) | 0 s | NAO |
| — | item: dano -> Warmog abaixo de 40% | vida < 40% | Armadura de Warmog | **nao dispara** | 0 s | NAO |
| — | item: dano -> Zhonya abaixo de 30% | vida < 30% | Ampulheta de Zhonya | **nao dispara** | 0 s | NAO |
| — | barra -> [Q,F,R,B] abaixo de 55% | vida < 55% | B = Passo das Sombras | **nao dispara** | 0 s | NAO |
| — | bota/item: RM quando o Rugido soa | mecanica (rugido) | — | **nao dispara** (o 1.o Rugido e a t~25 s; a luta acaba aos 24 s) | 0 s | NAO |

Leitura da tabela:

- **Os unicos casos sem prejuizo sao os que nem chegam a acontecer** — porque a build base ja e a
  melhor para este chefe: a vida nao desce de 60,2% e o chefe nunca e mais de um.
- Os casos que "poupam pocoes" (2, 3, 5, 6) pagam 1 s de troca e ficam mais lentos: trocar o dano
  por roubo de vida/escudo tira 700-1 000 de DPS (dps 2269 -> 2106 / 1 623). Nao compensa — poupar
  80-160 g de pocoes custa 0,45-1,35 s de abate.
- **As linhas "nao dispara" sao a prova**: os limiares de vida (60%, 50%, 40%, 30%, 55%) nunca sao
  atingidos. Nao ha gatilho para reagir.

---

## 9. A TROCA EM COMBATE COMPENSA?

**NAO, contra o Dragao Infernal, com a build certa.** A prova:

1. **A melhor build ja mata o chefe em 24 s e a vida minima e 60,2%** — nao ha momento de perigo
   onde trocar para defesa ganhe.
2. **O chefe e UM alvo do primeiro ao ultimo segundo.** Nao ha segundo alvo e o Dragao **nao invoca
   nada** (motor.js:3080: o rodizio dele e so sopro/chuva/rugido). Logo uma barra de area nunca e
   melhor que a de alvo unico.
3. **O custo de qualquer troca e 1 s** (modelado; ver seccao 11) e o ganho maximo encontrado foi 0.
4. Os gatilhos por **mecanica** perdem sempre, porque a RM da bota/item retirada custa mais DPS do
   que a reducao de dano que traz (dps 2269 -> 1703) — e o dano todo do Dragao e magico.

**Onde e que a troca COMPENSA** (e isto e o que o codigo permite):

| Situacao | Numero |
|---|---|
| **Errar a bota antes da luta** | O caso real: 3175~A vs 3171+2~B vale **3,80 s e 80 g** (seccao 7). Faz-se **antes** do primeiro golpe, nao no meio. |
| **Barra cheia com habilidades novas** | motor.js:2826-2827: o jogo aprende o rank 1 das novas MESMO com a barra cheia, "para a habilidade ficar disponivel para troca". E o unico uso que o proprio motor documenta. |
| **Chefe que invoca** | O Barao: motor.js:3117-3120 invoca 2 larvas, mas isso e **1 dos 3** do rodizio (motor.js:3080). O ciclo inteiro e invocar (0+14) + tentaculos (1,3+9) + acido (1,0+9) = **34,3 s** [motor.js:3076-3078 + 3080]. As larvas vem a cada 34,3 s — ai ha mesmo "o que esta em campo" e a barra de area passa a valer. |
| **Segundo alvo a serio** | PvP/Runeterra, ou o chefe com guardioes. No Fosso do Dragao o chefe aparece sozinho (motor.js:1121). |
| **Vida a descer a serio** | So se a build nao matar o chefe. Nesta luta a vida fica acima de 60% sempre. |

**Regra que sai daqui:** a troca em combate so paga quando ha uma build errada para **aquela fase**.
Se a build e boa para o chefe inteiro, a troca so estraga. O dono tem razao no principio
("da para swapar em tempo real") e o codigo confirma — mas o numero diz que **contra o Dragao a
melhor jogada e chegar com a build certa e nao trocar nada.**

---

## 10. DEFEITO ENCONTRADO NO CAMINHO (reportado, nao corrigido)

Ao procurar a melhor build encontrei um defeito em `tools/sim-chefes.mjs` (tem outro escritor, por
isso nao o editei):

`tools/sim-chefes.mjs:570` faz `extra += 0.05 * vidaMedia3153` (o proc do Rei Destruido) e
`tools/sim-chefes.mjs:572` multiplica esse extra por `esperancaCrit` — o critico. O motor faz o
mesmo: motor.js:1702 mete o proc no `bruto` e motor.js:1700 aplica o critico a esse `bruto`.
Ou seja: **se for bug, e bug DO JOGO, nao do simulador.**

Impacto medido (com a build AD/crit):

- auto com o proc x critico = 2 701 dps
- auto com o proc sem critico = 1 647 dps
- total 3 052 -> **1 998 dps** (o proc do 3153 vale 1 054 dos 2 701)

Se o proc levar critico, ha um exploit de AD/crit na Katarina que a poe a matar o Dragao em ~26 s
(contra ~24 s com a build de mago). Se nao levar, motor.js:1700/1702 tem de separar o proc do bruto.
**PRECISA DE REGRA DO DONO.**

Este simulador corre os dois modelos e reporta os dois; os quadros da luta usam o corrigido (sem
critico no proc). Na build do dono nao muda nada — ela nao tem critico.

---

## 11. O QUE NAO CONSEGUI VERIFICAR

| # | O que falta | O que precisava |
|---|---|---|
| 1 | O custo real de uma troca em segundos | Modelado como **1,0 s**. A Bolsa fecha com poucos cliques (jogo.js:6000-6008) e o `quadro` corre a 60/s (jogo.js:1516-1524), mas nao posso medir o tempo de reaccao. **PRECISA DE MEDICAO NO JOGO** (o dono proibiu jogar nesta sessao). Pensa-se que seja 0,5-1,5 s. |
| 2 | Se o proc do 3153 DEVE levar critico | motor.js:1700 vs 1702. **PRECISA DE REGRA DO DONO.** |
| 3 | O erro absoluto do simulador | sim 31,6 s vs real 35,6 s para a build do dono. A ordem das builds e valida; os segundos absolutos nao. |
| 4 | A base da Katarina | `tools/sim-chefes.mjs:352-353` diz "CALIBRADO NAO VERIFICADO (1 ponto medido)". Os ficheiros `dados-katarina.js` nao existem em `docs/game-src/` (motor.js:3-8 importa-os). |
| 5 | A qualidade/refino dos itens que o dono pode vir a ter | Usei a mochila medida em `docs/snapshots/bag.json` mais o catalogo para o que falta. Se o dono comprar ou montar itens melhores, a melhor build muda. |
| 6 | O 5.o slot alternativo que o dono NAO tem | O 3153/3072/3083/3065/3074 nao estao na mochila medida; usei o item do catalogo (sem qualidade). Os numeros com esses itens sao uma aproximacao. |

---

## 12. COMO CORRER

    bun tools/sim-swap.mjs

