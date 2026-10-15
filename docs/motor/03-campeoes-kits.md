# 03 — OS CAMPEÕES E OS KITS

> **Fonte única:** `docs/game-src/motor.js` (3.791 linhas), lido por inteiro neste bloco.
> Todos os números têm `motor.js:NNN`. O que não está no motor está marcado **NAO VERIFICADO**.
> Este documento existe para se poder **RECALCULAR o jogo sem voltar a abrir o motor**.

## 0. Como ler as séries

Quase todos os números das habilidades são séries por rank. No motor:

```js
const serie = (ini, passo, n = 10) => Array.from({ length: n }, (_, i) => +(ini + passo * i).toFixed(4));
```
motor.js:550

Ou seja: **valor no rank r = ini + passo × (r − 1)**, arredondado a 4 casas decimais.
Neste documento escrevo `9 s → 4,5 s (−0,5/rank)` para `serie(9,-0.5)`, e copio a lista quando o motor
usa uma lista à mão. Todas as habilidades que não são ultimate têm **max = 10 ranks**; a **R** tem
max = 5; a **N** (a final, liberada ao 45) tem max = 5.

---

## 1. O que é um kit (onde vivem os campeões)

```js
export const KITS = { darius: {...}, ezreal: {...}, lux: {...}, yasuo: {...},
                     katarina: {...}, taric: {...}, zac: {...} };
```
motor.js:864-895 — **os 7 campeões são um objeto `KITS`**. Cada kit tem:

| campo | o que é | onde |
|---|---|---|
| `id` | nome interno | motor.js:870-893 |
| `dados` | o `dados-<campeao>.js` (nome do campeão, nomes das habilidades Q/W/E/R, skins) | motor.js:870-893 |
| `stats` | `dados.campeao.stats` → vida, armadura, mana, velocidade de ataque do campeão | motor.js:870-893 |
| `adBase`, `adNivel` | dano de ataque do campeão por nível | motor.js:870-893 |
| `hab` | o objeto com todas as habilidades (P, Q, W, E, R, G, A, D, F, T, B, M, N) | motor.js:670-856 |
| `distancia` | true = atirador (atinge monstros que ainda estão andando) | motor.js:870-893 |
| `magia` | true = as habilidades causam dano MÁGICO e escalam com Poder de Habilidade | motor.js:870-893 |
| `semMana` | true = não usa mana (mana máxima 0) | motor.js:884, 892 |
| `fluxo` | true = a "mana" é o Fluxo (sempre 100) | motor.js:881 |
| `hemorragia` | true = os golpes aplicam Hemorragia (só o Darius) | motor.js:870 |
| `adagas` | true = solta adagas no chão (só a Katarina) | motor.js:884 |
| `gosmas` | true = solta gosmas no chão (só o Zac) | motor.js:892 |
| `chegadaExtra` | segundos a mais que os monstros levam a chegar (1,2 para os atiradores) | motor.js:872, 877 |
| `kite` | números do recuo-atirando (atiradores) | motor.js:874, 878 |
| `papel` | multiplicadores de dano causado/recebido | motor.js:870-893 |
| `ordem` | a ordem em que o jogo tenta usar as habilidades | motor.js:871-894 |
| `skins` | `dados.skins` (só desenho) | motor.js:3586-3589 |

Funções de leitura: `kit(estado)` (motor.js:896), `habDe(estado)` (motor.js:897).
Constantes: `HAB = HAB_DARIUS_KIT` (motor.js:898), `ORDEM_HAB = ['Q','W','E','R','G','A','D','F','T','B','M','N']`
(motor.js:899), `BARRA = 4` (motor.js:900), `RANKS_TOTAIS = 110` (motor.js:901).

**Regras de nível (iguais para os 7):**

```
ranks em Q/W/E   = min(max, ceil(nível / 2))                                  motor.js:910
ranks nas outras = min(max, 1 + floor((nível − h.nivel) / 2))                motor.js:911
ranks em R       = quantos de [6, 11, 16, 25, 35] o nível já passou           motor.js:902, 908
ranks em N       = quantos de [45, 46, 47, 48, 50] o nível já passou          motor.js:903, 909
```
Pontos: 1 ponto de habilidade por nível, 3 de atributo por nível (motor.js:483, 800). **50 pontos de
habilidade no total para 110 ranks** — a build é escolha, não acumulação.

Só as habilidades que estão **na barra** são usadas (motor.js:1578: `estado.barra.includes(t)`).
Passivas e a P nunca entram na barra (motor.js:2817). A barra começa com `['Q']` (motor.js:1003).

---

## 2. FÓRMULAS COMUNS AOS 7 CAMPEÕES

### 2.1 A curva de nível `g(n)`

```js
const crescimento = (nivel) => {
  const n = Math.min(nivel, 18);
  return (n - 1) * (0.7025 + 0.0175 * (n - 1)) + Math.max(0, nivel - 18);
};
```
motor.js:434-437

```
g(1) = 0        g(18) = 17       g(50) = 49
para n ≤ 18:   (n−1) × (0,7025 + 0,0175 × (n−1))
a partir do 18: 17 + (n − 18)
```
Tudo o que vem abaixo é multiplicado por `g(n)`. **Primeiro passo de qualquer cálculo.**

### 2.2 Dano de ataque (AD)

```
ad = adBase + adNivel × g(nível)                              motor.js:495
```
**Atenção:** o motor usa `adBase`/`adNivel` do kit (motor.js:870-893) e **não** o `attackdamage`
do ficheiro de dados (o Darius lá tem `attackdamage: 64` e `attackdamageperlevel: 0` —
docs/game-src/dados.js:25-26 — que o motor ignora).

### 2.3 Vida, armadura, resistência mágica, mana, velocidade de ataque, regeneração

```
vida      = stats.hp      + stats.hpperlevel    × g                 motor.js:495
armadura  = stats.armor   + stats.armorperlevel × g                 motor.js:495
rm        = stats.spellblock + 3,5 × g                            motor.js:496   ← 3,5 FIXO, ignora spellblockperlevel
mana      = fluxo ? 100 : semMana ? 0
            : stats.mp + stats.mpperlevel × g + 8×foco + mana dos itens            motor.js:520
velAtaque = min(3, stats.attackspeed × (1 + (stats.attackspeedperlevel/100) × g + va))   motor.js:344, 534
regenVida = (stats.hpregen + stats.hpregenperlevel × g)/5 + 0,1×vitalidade + regen dos itens   motor.js:535
regenMana = (fluxo || semMana) ? 0
            : ((stats.mpregen + stats.mpregenperlevel × g)/5) × 3 + 0,06×foco     motor.js:533
esquiva   = min(0,25, 0,0025×agilidade + esquiva dos itens)                       motor.js:536
```
Os `stats` de cada campeão vêm do `dados-<campeao>.js` (motor.js:870-893). **Só o do Darius está no
repo** (docs/game-src/dados.js:8-29); os outros 6 estão em falta — ver §7.

**Darius (único verificável):** hp 652 (+114/nível), mp 263 (+58), armor 37 (+5,2), spellblock 32,
attackrange 175, hpregen 10 (+0,95), mpregen 6,6 (+0,35), attackspeed 0,625 (+1%/nível) —
docs/game-src/dados.js:8-28.

### 2.4 Pontos de atributo (3 por nível)

```
força       → magia ? +2 Poder de Habilidade : +1,2 AD                     motor.js:503, 442-443
vitalidade  → +20 vida máxima e +0,1 de regeneração por segundo              motor.js:503, 444-445
resistência → +1,5 armadura e +1 de resistência mágica                      motor.js:503, 446-447
agilidade   → +0,8% velocidade de ataque e +0,25% de esquiva (máx. 25%)     motor.js:503, 448-449
foco        → +8 mana, +0,06 de regeneração de mana, −0,4% de recarga (máx. 30%)   motor.js:450-451, 537
```
Para quem **não usa mana**, a parte da mana do Foco vira outra coisa (motor.js:457-468):

```
Katarina: −0,4% de recarga e +0,2% de dano nas habilidades (FOCO_DANO_HAB = 0,002)   motor.js:457, 458-461
Zac:      −0,4% de recarga e +0,2% de dano nas habilidades                          motor.js:462-463
Yasuo:    −0,4% de recarga e +1% de Fluxo ganho (FOCO_FLUXO = 0,01)                 motor.js:465-467
```
O ganho do Foco na Katarina e no Zac é aplicado a **todas as habilidades** (motor.js:531, 1218:
`if (hab && a.danoHab) dano *= 1 + a.danoHab`).

### 2.5 O que entra dos itens (resumo)

```
ad += item.ad · ap += item.ap · vida += item.vida · armadura += item.armadura · rm += item.rm
va += item.va · rv += item.rv · critico += item.critico · regen += item.regen · cdr += item.cdr   motor.js:507-508
vida ×= 1 + vidaPct (soma dos itens)                                              motor.js:511
ap   ×= 1 + apPct;  se item 3089 (Rabadon): ap ×= 1,35                            motor.js:521-523
ap   += 0,03 × manaMáxima se item 3003 (Cajado do Arcanjo)                        motor.js:521
ad   += 0,02 × (vida − vidaBase) se item 2501 (Quebra-Cascos)                     motor.js:514
reducaoRecarga = min(0,40, min(0,30, 0,004×foco) + cdr dos itens)                 motor.js:537
penMagica   = min(0,60, (item 3135 ? 0,40 : 0) + penMag dos itens)                motor.js:529
penArmadura = 1 − (1 − penE) × (item 3036 ? 0,70 : 1)   ← penE = penetração passiva do E   motor.js:516, 539
critico    = min(1, (critico + critBase(n)) × critMult)                           motor.js:541
danoCritico = 1,75 (+0,40 se item 3031) × critDano                                motor.js:515, 541
```
O item **3044 (Fúria de Randuin)** dá 2 s de velocidade de ataque +8% por ataque básico
(motor.js:1706, 1666). Se o campeão for de magia, o dano base do mascote é `a.ad + 0,5×ap`
(motor.js:3532).

### 2.6 O AD/AP "do momento": `efetivo()`

O motor recalcula o dano de ataque e o poder a cada passo, com os bônus temporários ligados:

```js
const vontade = HD?.vontade && rD ? HD.vontade[rD-1] * Math.max(0, 1 - estado.vida / a.vida) : 0;
return { ...a,
  ad: (a.ad + (d.poder > 0 ? bonusPoder(estado.nivel) : 0)) * (1 + vontade),
  ap: (a.ap || 0) * (1 + (d.farol > 0 ? d.farolPoder || 0 : 0)),
  penArmadura: d.suspiro > 0 ? 1 - (1 - a.penArmadura) * (1 - (d.suspiroPen || 0)) : a.penArmadura };
```
motor.js:1326-1331

```
bonusPoder(n) = 30 + 200×(min(n,18)−1)/17 + 4×max(0, n−18)        motor.js:1332
bonusAd       = adEfetivo.ad − a.baseAd                            motor.js:1428
```
Ou seja: quando o Darius tem 5 acúmulos de Hemorragia (`d.poder`), o AD sobe `bonusPoder(n)`;
quando o R do Yasuo está ativo, a penetração de armadura soma 30%; quando o Farol da Lux está
ligado, o Poder de Habilidade sobe.

### 2.7 O GOLPE — `golpear()` (a fórmula por que passa qualquer dano)

```js
function golpear(estado, c, a, alvo, bruto, fonte, { acumula = true, critico = false, magico = false, poder = false, frac = 1 } = {}) {
  const arm = magico ? (poder ? alvo.armadura * RM_MONSTRO * (1 - (a.penMagica || 0)) : 0)
                     : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura);
  let dano = mitigar(bruto, arm) * (1 + (d.grito > 0 ? d.gritoBonus : 0) + 0.01*d.disciplina + (estado.buffBarao > 0 ? BARAO.dano : 0));
  dano *= (kit(estado).papel?.dano ?? 1) * (LOCAL[estado.local]?.arena ? kit(estado).papel?.arena ?? 1 : 1);
  if (critico) dano *= a.danoCritico || 1.75;
  if (alvo.chefe && a.tem?.('3036')) dano *= 1.15;
  if (alvo.dominioAmp) dano *= 1 + alvo.dominioAmp;
  if (ezreal && hab) dano *= bonusEzreal(estado, c, alvo);
  if (hab && a.danoHab) dano *= 1 + a.danoHab;
  if (hab && d.absorcao > 0) dano *= 1 + (d.absorcaoBonus || 0) * (d.absorcaoAcum || 0);
  if (d.sombraPronta > 0 && hab && fonte !== 'B') { dano *= 1 + (d.sombraBonus || 0); d.sombraPronta = 0; }
  dano *= fatorDanoJogador(estado, alvo);
  alvo.hp -= dano;
```
motor.js:1192-1234

Escrito por miúdos, **o dano final de um golpe é `dano = mitigar(bruto, resistência) × multiplicadores`**:

1. **mitigação** (motor.js:1167, 1202): `mitigar(d, arm) = d × 100 / (100 + max(0, arm))`
   - físico: `armaduraMonstro × (1 − reducaoArmadura) × (1 − penArmadura)`
   - mágico com poder: `armaduraMonstro × 0,6 × (1 − penMagica)` (RM_MONSTRO = 0,6, motor.js:1179)
   - mágico **sem** poder (só o E do Yasuo): **resistência 0 — dano inteiro** (motor.js:2090, 1202)
2. `× (1 + gritoBonus + 0,01×disciplina + 0,25 se o buff do Barão estiver ligado)` (motor.js:1211, 3067)
3. `× papel.dano × (em Runeterra ? papel.arena : 1)` (motor.js:1212)
4. `× danoCritico` se for crítico (motor.js:1213)
5. `× 1,15` se for chefe e o jogador tiver o item 3036 (motor.js:1214)
6. `× (1 + dominioAmp)` — Domínio de Noxus do Darius (motor.js:1215, 1480)
7. `× bônus do Ezreal` (Arrogância + Mira) (motor.js:1217, 1237-1248)
8. `× (1 + danoHab)` — Foco da Katarina/Zac, em habilidades (motor.js:1218)
9. `× (1 + absorcaoBonus × absorcaoAcum)` — Absorção do Zac (motor.js:1219, 2418)
10. `× (1 + sombraBonus)` uma vez — Passo das Sombras da Katarina (motor.js:1220)
11. `× fatorDanoJogador` (monstro acima do nível) (motor.js:1221, 1187)

**Antes** disso, se o campeão for de magia e a habilidade não for ataque/item/mascote/sangue, o golpe
passa a mágico (motor.js:1201) e, sendo `poder`, os itens de mago reagem ao dano (motor.js:1203-1209):
4645 (Chama Sombria) ×1,2 abaixo de 40% da vida; 3165 (Morellonomicon) ×1,12 abaixo de 50%;
6653 (Liandry) queima 1,5% da vida de referência por 3 s; 3116 (Rylai) deixa lento 1,5 s.

**E depois:** se `acumula`, o golpe aplica a mecânica do campeão — Hemorragia do Darius
(motor.js:1232, 1274-1282). Se `fonte === 'ataque'`, o roubo de vida cura `dano × rv`
(motor.js:1226-1228). Se `d.furiaS > 0` (Fúria Sanguinária / Banho de Sangue), cura
`dano × furiaRoubo` (motor.js:1231).

### 2.8 CURAR e ESCUDO

```
curar(v): v × 1,25 se item 3065;  v × 0,65 se estiver em luta contra jogador   motor.js:1284-1289
          nunca passa da vida máxima
escudo d.escudo absorve o dano antes da vida, e não se regenera              motor.js:2718
escudos a mais por item: 3053 (Pele de Aço) → 0,6 × vidaBônus quando a vida < 30%, recarga 90 s   motor.js:2725-2727
                          3072 (Sanguessuga) → escudo até 25% da vida máxima quando a cura passa do que falta  motor.js:1229
```

### 2.9 RECARGA, USO e ENTRADA DE HABILIDADE

```
pode(t): t está na barra && ranks[t] > 0 && recarga 0 && mana >= custo     motor.js:1578
usar(t): gasta o custo; recargas[t] = recargaDoRank × (1 − reducaoRecarga) motor.js:1579-1581
```
O Zac paga com vida em vez de mana: `pagarVida` (motor.js:2493, 2395-2398) — tira a percentagem
**da vida atual** e **nunca deixa passar de 1** (motor.js:2397). O Darius subtrai sem esse mínimo
(motor.js:1872).

### 2.10 DIFERENÇA DE NÍVEL (chefe / monstro acima do nível)

```
NIVEL_DIF = { livre: 4, danoMonstro: 0,15, maxDanoMonstro: 3, danoJogador: 0,07, minDanoJogador: 0,25 }   motor.js:1184
d = nível do monstro − nível do jogador − 4                                  motor.js:1185
se d > 0:  dano do monstro  ×= min(3, 1 + 0,15d)                              motor.js:1186
           dano do jogador  ×= max(0,25, 1 − 0,07d)                           motor.js:1187
```

### 2.11 Poções (as mesmas para todos)

| poção | cura | preço | nível mín. |
|---|---|---|---|
| Poção de Vida | 300 | 40 | 1 |
| Poção de Vida Forte | 900 | 110 | 15 |
| Poção de Vida Suprema | 2200 | 260 | 30 |
| Poção de Mana | 100 | 30 | 1 |
| Poção de Mana Forte | 280 | 80 | 15 |

motor.js:261-267

```
intervalo mínimo entre poções: EXAUSTAO = 1 s                                     motor.js:41
em luta contra jogador: cura × 0,30 e 6 s de intervalo (POCAO_PVP)               motor.js:43
automático (VIP): vida quando < 50% da vida; mana quando < 30% da mana           motor.js:1315-1322
escolha da poção: a mais forte que cure no máximo 1,2× o que falta               motor.js:1293-1298
curas em luta contra jogador (habilidades, roubo de vida, Sede) × 0,65           motor.js:1284
```

---

## 3. TABELA-RESUMO DOS 7 CAMPEÕES

| campeão | adBase / adNivel | magia | recurso | distância | papel.dano | papel.recebido | papel.arena | papel.arenaRecebido | ordem de uso |
|---|---|---|---|---|---|---|---|---|---|
| **Darius** | 64 / 3,9 | não | mana 263+58g | corpo | **1,1** | **0,55** | **1,075** | 0,55 | N R E A G B F T Q M W |
| **Ezreal** | 66 / 4,2 | não | mana | à distância | **1,12** | **1,05** | **1,1** | 1,05 | N G F R E B T A M W Q |
| **Lux** | 54 / 3,3 | **sim** | mana | à distância | **1,59** | **1,05** | **1,0** | 1,05 | N R W E A G B F T Q M |
| **Yasuo** | 60 / 3,9 | não | Fluxo (100) | corpo | **1,15** | **0,85** | **1,5** | 0,85 | N R W E A G B F T M Q |
| **Katarina** | 58 / 3,4 | **sim** | sem mana | corpo | **1,2** | **0,75** | **1,75** | **1,0** | N R B M E A G F T Q W |
| **Taric** | 55 / 3,3 | **sim** | mana | corpo | **0,9** | **0,75** | **0,78** | 0,75 | R N F Q W E B G M T A |
| **Zac** | 60 / 3,3 | **sim** | sem mana | corpo | **1,425** | **0,66** | **0,7** | **0,7** | N R B G E A T M F W Q |

Números: motor.js:870-893 (adBase/adNivel/papel), motor.js:871-894 (ordem).

Como se leem os papéis (motor.js:1212, 2697):

```
dano do jogador contra monstros = … × papel.dano × (em Runeterra ? papel.arena : 1)
dano que o jogador leva        = … × (em Runeterra e papel.recebidoArena definido ? papel.recebidoArena : papel.recebido)
```
Os valores `papel.pvp` e `papel.pvpRecebido` também existem (motor.js:868-893) — **mas não são
aplicados em nenhum ficheiro deste repo** (ver §7).

Segundos até o monstro encostar: cada um entra com `chegada` (motor.js:1072, 1126) e o atirador
recebe `+chegadaExtra` (1,2 s) (motor.js:1423). Corpo a corpo luta com quem já chegou; o atirador
acerta o que vai chegar primeiro (motor.js:1446).
---

# 4. CAMPEÃO A CAMPEÃO

---

## 4.1 DARIUS — o Lutador de Noxus

**Kit:** `darius: { id:'darius', dados: DADOS, stats: DADOS.campeao.stats, adBase: 64, adNivel: 3,9,
hab: HAB_DARIUS_KIT, distancia: false, hemorragia: true, papel: { dano: 1,1, recebido: 0,55, arena: 1,075,
pvp: 0,95, pvpRecebido: 0,85 }, ordem: ['N','R','E','A','G','B','F','T','Q','M','W'] }` — motor.js:870-871
Habilidades: `HAB_DARIUS_KIT` (motor.js:673-688) por cima de `HAB_DARIUS` (motor.js:553-585).

**Atributos-base verificáveis** (docs/game-src/dados.js:8-28):
vida 652 + 114×g · armadura 37 + 5,2×g · RM 32 + 3,5×g · mana 263 + 58×g · velocidade de ataque
0,625 (1% por nível) · regeneração de vida (10 + 0,95×g)/5 por segundo · regeneração de mana
((6,6 + 0,35×g)/5)×3 por segundo · crítico 0.

| tecla | nome | nível | recarga | custo | base → rank 10 | ratio | escala com | efeitos |
|---|---|---|---|---|---|---|---|---|
| Q | Dizimar | 1 | 9 → 4,5 s (−0,5) | 20 → 38 mana | 50 → 320 (+30) | 100% → 145% do AD | **AD** | Área em quem está encostado. **Cura 13% da vida que falta por inimigo atingido, até 3 inimigos** (motor.js:1866). Só entra com 2+ monstros, chefe, furioso ou vida < 80% (motor.js:1862) |
| W | Ataque Mutilador | 1 | 5 → 3,4 s (lista) | 20 → 30 mana | — | 140% → 185% do AD | **AD** | O próximo ataque básico faz esse dano e deixa lento 2 s (motor.js:1689). Só com mana > 40% (motor.js:1869) |
| E | Apreender | 1 | 26 → 13 s (lista) | 45 mana | — | — | — | **Penetração de armadura passiva 20% → 45%** (motor.js:560, lida em motor.js:516). Puxa quem está chegando e deixa lento 2 s (motor.js:1858) |
| R | Guilhotina de Noxus | 6, max 5 | 120/100/80/65/50 s | 100/50/0/0/0 | 125 → 625 (+125 por rank) | (base + 0,75×AdBônus) × (1 + 0,2×acúmulos) | **AD bônus** e **acúmulos** | Dano verdadeiro; só dispara se o dano dá para matar (motor.js:1850). Ao matar volta em **2 s** (motor.js:1853) |
| G | Grito de Guerra | 8 | 25 → 16 s (−1) | 40 → 58 mana | — | +15% → +42% | **todo o dano** por 8 s | motor.js:565, 1211 |
| A | Avanço Noxiano | 13 | 12 → 7,5 s (−0,5) | 35 → 53 mana | 60 → 330 (+30) | 80% → 125% do AD | **AD** | Atordoa 1 s o alvo mais distante e o traz para junto (motor.js:1813-1814) |
| D | Vontade do General (passiva) | 18 | — | — | — | +15% → +42% do AD, proporcional à vida que falta | **AD** | fator = vontade × (1 − vida/vidaMáx) (motor.js:675, 1328). `tenacidade` 30% → 46% abaixo de 35% da vida só aparece no texto do rank — **não é aplicado no motor** (motor.js:675, 936) |
| F | Banho de Sangue | 23 | 22 → 13,5 s (−0,5) | 0 mana, **8% da vida atual** | — | vida que falta do alvo: 3% → 3,6%, com teto de 1,5×AD | **AD** (teto) e **vida do alvo** | 6 s. Cura 1% → 1,9% da vida máxima por ataque em alvo com Hemorragia (motor.js:677-678, 1678-1681). Não usa abaixo de 40% de vida (motor.js:1871) |
| T | Pisotear | 28 | 10 → 6,4 s (−0,4) | 40 → 76 mana | 70 → 385 (+35) | 90% → 135% do AD | **AD** | Área grande (quem falta ≤ 1,5 s para chegar), lentidão 2 s (motor.js:1877-1880) |
| B | Estandarte de Noxus | 33 | 35 → 21,5 s (−1,5) | 60 → 78 mana | — | +20% → +56% de armadura e RM | — | 10 s; a defesa extra multiplica armadura e RM (motor.js:680, 1733, 1884). Não cura vida no kit atual (motor.js:1884) |
| M | Ruptura Noxiana | 38 | 13 → 7,8 s (−0,4) | 40 → 67 mana | 110 → 605 (+55) | 100% → 154% do AD | **AD** | Linha de até 4 monstros; +35% se o alvo já estiver sangrando (`bonusSangue`); atordoa 1 s (motor.js:682, 1887-1895) |
| N | Domínio de Noxus | 45, max 5 | 90/80/70/62/55 s | 100 mana | 70 → 210 (+35) | 35% → 55% do AD | **AD** | 10 s de território. Dano a cada 0,5 s em quem está dentro, com amplificação que sobe até **ampMax = 30%** (motor.js:685, 1478-1483). **Cura 4% da vida que falta por monstro morto dentro** (motor.js:1483). Não pode ser atordoado lá dentro (motor.js:1899) |

**Passiva P — Hemorragia** (nome em docs/game-src/dados.js:33-34; mecânica motor.js:1274-1282):
todo golpe que conta (`acumula`, motor.js:1232) põe `acumulos = min(5, +1)` e `tSangue = 5 s`.
Aos 5 acúmulos a primeira vez, `d.poder = 5` durante 5 s (motor.js:1278-1281).

```
dano de sangramento por segundo e por acúmulo = (13 + 0,3×AdBônus + 4×nível) / 5        motor.js:1631
aplicado a cada inimigo, já mitigado pela armadura (com penArmadura)                     motor.js:1645
o R do Darius multiplica por (1 + 0,2×acúmulos)                                           motor.js:563
```

**(a) O que escala com Poder de Habilidade:** nada. O Darius não é `magia` (motor.js:870) — a Força
dele dá +1,2 AD por ponto, não AP.
**(b) O que escala com AD:** tudo — Q, W, R (via AdBônus), A, T, M, N, o Banho de Sangue (teto de
1,5×AD), a Vontade (proporção do AD) e a Hemorragia (0,3×AdBônus).
**(c) Curas:** Q (13% da vida que falta por inimigo, até 3 — motor.js:1866), Banho de Sangue
(1% → 1,9% da vida máxima por ataque em alvo sangrando — motor.js:1681), Domínio de Noxus (4% da
vida que falta por abate na área — motor.js:1483). Mais os itens de roubo de vida (motor.js:1226-1228).
**(d) Escudos:** nenhum no kit.
**(e) Penetração de armadura:** E — 20% → 45%, sempre ligada enquanto o E tiver rank
(motor.js:560, 516, 539).
**(f) Mecânicas especiais:** Hemorragia (5 acúmulos, 5 s, dano por acúmulo, Poder aos 5 acúmulos,
R a multiplicar pelos acúmulos); R verdadeiro que só dispara quando mata e volta em 2 s;
Domínio com amplificação até 30% e cura por abate. **A "Disciplina da Legião" (passiva D antiga)
está morta neste kit** — ver §6.

---

## 4.2 EZREAL — o Explorador Pródigo

**Kit:** `ezreal: { … adBase: 66, adNivel: 4,2, hab: HAB_EZREAL, distancia: true, hemorragia: false,
chegadaExtra: 1,2, papel: { dano: 1,12, recebido: 1,05, arena: 1,1, pvp: 1,08, pvpRecebido: 1,03, vel: 1,08 },
kite: { recarga: 1,6, recuo: 0,6, gasto: 0,25, recupera: 0,15, pausa: 0,2 },
ordem: ['N','G','F','R','E','B','T','A','M','W','Q'] }` — motor.js:872-875
Habilidades: `HAB_EZREAL` (motor.js:588-627). **Atributos-base: NAO VERIFICADO** (docs/game-src/dados-ezreal.js ausente).

| tecla | nome | nível | recarga | custo | base → rank 10 | ratio | escala com | efeitos |
|---|---|---|---|---|---|---|---|---|
| Q | Disparo Místico | 1 | 3,6 → 1,8 s (−0,2) | 22 → 35,5 mana | 40 → 328 (+32) | 130% → 184% do AD | **AD** | Se acertar, tira **1,5 s** da recarga de todas as outras (motor.js:590, 2670). Leva também o bônus da Lâmina Encantada da habilidade anterior (motor.js:2666) |
| W | Fluxo Essencial | 1 | 8 → 5,3 s (−0,3) | 50 → 68 mana | 80 → 395 (+35) | 60% → 105% do AD | **AD** | Prende um orbe por 4 s; o próximo acerto detona com o dano do W **e devolve 40 → 94 de mana** (motor.js:592-593, 1922-1923) |
| E | Salto Arcano | 1 | 26 → 12,5 s (lista) | 70 mana | 80 → 350 (+30) | 50% → 95% do AD | **AD** | Teleporta para longe: os monstros voltam a andar **1,6 → 2,32 s** (motor.js:595, 2651) |
| R | Barragem Incendiária | 6, max 5 | 120/105/90/75/60 s | 100 mana | 300 → 900 (+150) | 100% → 140% do AD | **AD** | Canal de **1 s parado e sem atacar** (`CANAL_R`, motor.js:2575, 1590-1592); atravessa o grupo todo, perto ou longe (motor.js:2581-2582) |
| G | Arrogância do Explorador | 8 | 25 → 16 s (−1) | 40 → 58 mana | — | +20% → +42,5% no dano das habilidades | **habilidades** | 8 s; cada habilidade que acerta estende +0,5 s, até +4 s (motor.js:602, 1910) |
| A | Tiro de Precisão | 13 | 12 → 7,5 s (−0,5) | 35 → 53 mana | 60 → 330 (+30) | 80% → 125% do AD | **AD** | Atravessa 2 (até 3 monstros); o primeiro leva +30% e atordoa 1 s (motor.js:604, 2599-2602) |
| D | Mira do Explorador (passiva) | 18 | — | — | — | +12% → +30% de dano por distância | **habilidades** | fator de 0 a 1 com a distância/tempo de chegada (motor.js:607, 1243-1244). O `pressa` (+20% de velocidade por 2 s) **não é aplicado no motor** — só recarrega 0,25 de fôlego quando acerta de longe (motor.js:1245) — ver §6 |
| F | Sobrecarga Arcana | 23 | 18 → 11,5 s (−0,5) | 40 → 67 mana | 40 → 238 (+22) | 40% → 76% do AD | **AD** | Marca por 4 s; no acerto seguinte explode com esse dano **e devolve 2% da mana** (motor.js:609, 1253-1259) |
| T | Descarga Shurimane | 28 | 12 → 6,4 s (−0,4) | 45 → 81 mana | 45 → 239 (+24) | 55% → 86,5% do AD | **AD** | Dano em área no meio do grupo **mais 6 bolinhas × 20% do dano** (motor.js:612, 2617-2620) |
| B | Passagem Shurimane | 33 | 22 → 8,6 s (−0,8) | 60 → 78 mana | 60 → 252 (+22) | 45% → 72% do AD | **AD** | Abre o portal quando alguém está a ≤ 0,6 s; ao atravessar, empurra (1,6 → 2,5 s + 1 s da cópia) e dispara. A cópia fica 2,5 s atirando a cada 0,5 s com **30% → 44% do AD** do Ezreal (motor.js:615-617, 1519-1539) |
| M | Tiro do Explorador | 38 | 12 → 6,4 s (−0,4) | 45 → 72 mana | 30 → 165 (+15) | 35% → 57,5% do AD | **AD** | Ricocheteia até **5 vezes, cada salto +15%**; se o último for num chefe, explode em área (motor.js:619, 1552-1561) |
| N | Apogeu da Manopla | 45, max 5 | 90/80/70/62/55 s | 100 mana | 300 → 900 (+150) | 120% → 180% do AD | **AD** | Onda da queda: base 220 → 660, 90% → 130% do AD (motor.js:623-625, 2640-2641). 10 s de Apogeu: devolve 20% → 40% da mana; cada habilidade deixa um rastro no monstro e **3 habilidades diferentes no mesmo monstro explodem** com dano N, mais (em chefe) `min(4×AD, 3% → 7% da vida máxima)` (motor.js:1261-1271) |

**Passiva (sem entrada P no kit — está no código):** cada habilidade que acerta dá **+10% de
velocidade de ataque, até 5 acúmulos, por 6 s** (motor.js:1906-1911, aplicada em motor.js:1666).
O nome vem do ficheiro de dados em falta — NAO VERIFICADO.

**(a) Poder de Habilidade:** nada. **(b) AD:** tudo — Q, W, E, R, A, F, T, B, M, N.
**(c) Curas:** nenhuma no kit. **(d) Escudos:** nenhum no kit. **(e) Penetração de armadura:** nenhuma.
**(f) Mecânicas especiais:** passiva de velocidade de ataque (5×10%, 6 s); Arrogância (+dano de
habilidade, com extensão); Mira (dano que cresce com a distância, até +30%); três tipos de marca
(orbe do W, Marca Arcana do F, rastros do N com 3 diferentes); portal com cópia que atira; ricochetes
crescentes; **kiting com fôlego**: recuo de 0,6 s a cada 1,6 s, gastando 0,25 de fôlego (máximo 1),
que só volta quando ninguém está colado (0,15/s); com 3 colados o recuo é metade (motor.js:2679-2691);
chefes recuperam ao dobro da velocidade (o recuo para eles vale metade, motor.js:2688).
O atirador também começa a acertar com `+1,2 s` de avanço dos monstros (motor.js:1423).

---

## 4.3 LUX — a Dama da Luz

**Kit:** `lux: { … adBase: 54, adNivel: 3,3, hab: HAB_LUX, distancia: true, magia: true,
hemorragia: false, chegadaExtra: 1,2, papel: { dano: 1,59, recebido: 1,05, arena: 1,0, pvp: 1,2,
pvpRecebido: 1,05 }, kite: { … }, ordem: ['N','R','W','E','A','G','B','F','T','Q','M'] }` — motor.js:877-879
Habilidades: `HAB_LUX` (motor.js:633-670). **Atributos-base: NAO VERIFICADO** (docs/game-src/dados-lux.js ausente).

| tecla | nome | nível | recarga | custo | base → rank 10 | ratio | escala com | efeitos |
|---|---|---|---|---|---|---|---|---|
| P | Iluminação (passiva) | — | — | — | 20 + 10×nível | 20% do AP | **AP** | Marca por 6 s quem as habilidades acertam; o próximo ataque básico (ou uma habilidade) detona a marca (motor.js:634, 1916-1920) |
| Q | Ligação da Luz | 1 | 7 → 4,3 s (−0,3) | 50 → 68 mana | 115 → 520 (+45) | 65% → 101% do AP | **AP** | Prende 1,5 s os 2 primeiros monstros e marca (motor.js:635, 2023-2025) |
| W | Barreira Prismática | 1 | 12 → 7,6 s (−0,4) | 60 → 78 mana | 60 → 285 (+25) | 35% → 53% do AP | **AP** | **Escudo** na Lux e no grupo na ida **e outra vez quando a varinha volta, 0,9 s depois** — o escudo total não passa de 2× o valor (motor.js:638, 1970-1975, 1510-1512). Só com vida < 85% ou 2+ monstros |
| E | Singularidade Lucente | 1 | 8 → 5,3 s (−0,3) | 60 → 87 mana | 115 → 520 (+45) | 65% → 101% do AP | **AP** | Área em todos, deixa lento 2 s e marca (motor.js:641-643, 2018) |
| R | Centelha Final | 6, max 5 | 70/60/50/42/35 s | 100 mana | 300 → 900 (+150) | 100% → 140% do AP | **AP** | Canal de **0,6 s** (`CANAL_LUX`, motor.js:2576); atravessa o grupo todo e marca quem sobreviver (motor.js:644, 1955-1961) |
| G | Luz Inspiradora | 8 | 25 → 16 s (−1) | 40 → 58 mana | — | +15% → +42% | **todo o dano** | 8 s (motor.js:647, 1211) |
| A | Lança de Luz | 13 | 12 → 7,5 s (−0,5) | 35 → 53 mana | 100 → 437 (+38) | 75% → 111% do AP | **AP** | Linha que atravessa até **5 monstros** e marca (motor.js:649, 1979-1984) |
| D | Faísca Prismática (passiva) | 18 | — | — | 70 → 385 (+35) | 40% → 67% do AP | **AP** | A cada **3 habilidades** usadas, 3 raios em 3 monstros diferentes (motor.js:652, 1932-1943) |
| F | Prisma Regenerador | 23 | 24 → 15,2 s (−0,8) | 60 → 97 mana | — | 8% → 13,2% da vida máxima **+ 0,4×AP** | **AP** | Cura na hora, só quando a vida está abaixo de 60% (motor.js:655, 1988-1989) |
| T | Convergência Radiante | 28 | 11 → 5,6 s (−0,4) | 45 → 81 mana | 130 → 639 (+55) | 85% → 121% do AP | **AP** | Explode **0,6 s** depois de lançada, em quem está encostado, e **prende 1,2 s** (motor.js:657, 1497-1508) |
| B | Farol de Demacia | 33 | 35 → 21,5 s (−1,5) | 60 → 78 mana | — | **+10% → +28% de Poder de Habilidade** | — | 10 s, e regenera **3% da mana por segundo** (motor.js:660, 1997-2001; o efeito no AP está em motor.js:1329) |
| M | Chuva de Luz | 38 | 18 → 12,4 s (−0,6) | 70 → 106 mana | 140 → 689 (+55) | 90% → 135% do AP | **AP** | **3 meteoros** (0,45/0,75/1,05 s) e cada um atinge **até 2 vizinhos com 45% do dano** (motor.js:662, 2003-2008, 1462-1471) |
| N | Furacão de Luz | 45, max 5 | 75/66/58/51/45 s | 100 mana | 260 → 720 (+115) | 95% → 139% do AP | **AP** | 3 s atravessando o grupo, dano a cada 0,5 s e lentidão 0,6 s (motor.js:665, 2010-2013, 1454-1461) |

**(a) Poder de Habilidade:** tudo no kit — P, Q, W (escudo), E, R, A, D, F (cura), T, M, N.
**(b) AD:** nada no kit. O ataque básico usa o AD, mas nenhuma habilidade escala com AD.
**(c) Curas:** F Prisma Regenerador (8% → 13,2% da vida máxima + 0,4×AP, motor.js:1989).
**(d) Escudos:** W — base + ratio do AP, aplicado **duas vezes** (ida e volta) com teto de 2× o valor.
**(e) Penetração de armadura:** nenhuma (o dano dela é mágico; o que existe é penetração mágica de itens, motor.js:529).
**(f) Mecânicas especiais:** Iluminação (marca + detonação); Prisma a cada 3 habilidades;
canal de 0,6 s no R; varinha que volta (escudo duplo); Farol (+AP e mana); N e M com dano em ticks.

---

## 4.4 YASUO — o Imperdoável

**Kit:** `yasuo: { … adBase: 60, adNivel: 3,9, hab: HAB_YASUO, distancia: false, hemorragia: false,
fluxo: true, papel: { dano: 1,15, recebido: 0,85, arena: 1,5, pvp: 1, pvpRecebido: 0,92, vel: 1,04 },
ordem: ['N','R','W','E','A','G','B','F','T','M','Q'] }` — motor.js:881-882
Habilidades: `HAB_YASUO` (motor.js:696-729). **Atributos-base e nomes das habilidades: NAO VERIFICADO**
(docs/game-src/dados-yasuo.js ausente; nomes observados em docs/snapshots/yasuo.json — não é o motor).

| tecla | nome (não verificado) | nível | recarga | custo | base → rank 10 | ratio | escala com | efeitos |
|---|---|---|---|---|---|---|---|---|
| P | passiva | — | — | **sem mana** | — | — | — | **Chance de crítico dobrada** (`critBase(n) = min(18%, 10% + 0,18%×nível)`, ×2) e **dano crítico ×0,8** (1,4 em vez de 1,75; 1,72 com Gume do Infinito) — motor.js:697, 541, 515. O **Fluxo** (máximo 100, motor.js:693, 520) enche a 9/s lutando e, cheio, o próximo golpe que ele levar vira **escudo de 80 + 28×nível** (motor.js:697, 1442, 2713-2717) |
| Q | Tempestade de Aço | 1 | **depende da velocidade de ataque** | 0 | 40 → 240 (+20) | 55% do AD (fixo) | **AD** | Acerta crítico. 2 cargas viram **tornado**: atravessa até 5 e **joga para o alto 1 s** (motor.js:698, 2125-2130). A recarga: `max(1,5 s, recarga / max(1, (velAtaque × (1+ventania))/0,697))` (motor.js:2056) — quanto mais rápido ataca, mais rápido volta. Depois do E, acerta **todos em volta** (motor.js:2132-2133) |
| W | Parede de Vento | 1 | 24 → 12,8 s (−0,8) | 0 | — | bloqueia tiros, reduz 30% → 48% | — | 4 s: **tiros de fora (incluindo sopro, olho e ácido dos chefes) são totalmente bloqueados**; o resto do dano de longe é reduzido (motor.js:701, 2705-2709, 2053) |
| E | Espada Ágil | 1 | 3,5 → 2,15 s (−0,15) | 0 | 50 → 218 (+18) | 20% → 29% do AD | **AD** | **Dano MÁGICO sem resistência nenhuma** (`magico: true` sem `poder`, motor.js:2090, 1202). Cada avanço seguido dá **+25%, até +50%**; o mesmo monstro só é válido de 6 em 6 s (motor.js:703, 2091) |
| R | Último Suspiro | 6, max 5 | 70/60/50/42/35 s | 0 | 200 → 640 (+110) | 100% → 132% do AD | **AD** | **Só funciona com monstros no ar.** Segura todos lá em cima mais 1 s e, por 15 s, **ignora 30% da armadura** (motor.js:706, 2068-2073, 1330). Pode criticar |
| G | Respiração do Vento | 8 | 25 → 16 s (−1) | 0 | — | +25% → +52% de velocidade de ataque | — | 8 s, e a Q volta mais rápido por causa disso (motor.js:709, 2056) |
| A | Investida do Vendaval | 13 | 12 → 7,5 s (−0,5) | 0 | 60 → 330 (+30) | 80% → 125% do AD | **AD** | Corre até ao mais distante, dano e **joga para o alto 1 s** (motor.js:711) |
| D | Lâmina Inquieta (passiva) | 18 | — | — | — | +3% → +6% de velocidade de ataque por crítico | — | Acumula até **5 vezes** por 4 s (motor.js:714, 1711) |
| F | Lâmina Fantasma | 23 | 20 → 12,4 s (−0,6) | 0 | — | 40% → 67% do dano do ataque | **dano do ataque** | 6 s: cada ataque básico sai um corte que acerta até **2 outros monstros** por perto (motor.js:716, 1712-1716) |
| T | Furacão Cortante | 28 | 11 → 5,6 s (−0,4) | 0 | 70 → 385 (+35) | 90% → 135% do AD | **AD** | Área em volta, todos sobem **0,75 s** (motor.js:718) |
| B | Brisa Protetora | 33 | 28 → 17 s (−1) | 0 | — | 12% → 30% da vida máxima | — | **Escudo** da vida máxima (motor.js:721, 2106) |
| M | Lâmina do Vendaval | 38 | 13 → 7,8 s (−0,4) | 0 | 110 → 605 (+55) | 100% → 154% do AD | **AD** | Linha de até **4 monstros**, todos sobem 0,75 s (motor.js:723) |
| N | Dança das Mil Lâminas | 45, max 5 | 90/80/70/62/55 s | 0 | 60 → 180 (+30) | 50% → 74% do AD | **AD** | 2,5 s, **10 cortes** (um a cada 0,25 s) em quem está por perto, cada um pode criticar, e **nada o acerta** enquanto dura (motor.js:726, 2063-2064, 1488-1496) |

**(a) Poder de Habilidade:** nada. **(b) AD:** Q, E, R, A, T, M, N (todos com ratio de AD) e F
(fração do ataque básico).
**(c) Curas:** nenhuma no kit. O escudo do Fluxo não é cura.
**(d) Escudos:** passiva do Fluxo (80 + 28×nível no próximo golpe quando o Fluxo está cheio) e B
(12% → 30% da vida máxima).
**(e) Penetração de armadura:** R — 30% durante 15 s (motor.js:706, 1330).
**(f) Mecânicas especiais:** Fluxo (0–100, enche 9/s lutando, 6 por tile andando em Runeterra);
crítico dobrado; Q com cargas → tornado e recarga que cai com a velocidade de ataque (mínimo 1,5 s);
noAr (o monstro no ar fica atordoado, motor.js:1657, 2054) e R só em quem está no ar; E com acúmulo
(+25% até +50%) e recarga de 6 s por alvo; parede de vento. **O E dele não sofre resistência nenhuma**
(arm = 0) — ver §6.

