# 02 — Combate e dano (especificação do motor)

> **Fonte única**: `docs/game-src/motor.js` (3792 linhas, incluindo a última em branco), lido
> **por inteiro** nesta sessão (1→3792), mais `docs/game-src/itens.js` (catálogo), `docs/game-src/balanco.js`
> (planilha) e `docs/game-src/dados.js` (stats do Darius). Nenhum browser, nenhum CDP, nenhum jogo a correr.
> Toda a afirmação tem `ficheiro:linha`. O que não deu para verificar está marcado **NAO VERIFICADO**.
>
> **Objectivo deste documento**: quem o ler tem de conseguir **recalcular** o dano de qualquer golpe,
> a cura de qualquer fonte e o ritmo de ataque, sem voltar a ler o motor. Todas as fórmulas estão escritas
> na íntegra; todos os números, limiares e tectos estão escritos.
>
> **Aviso de numeração**: o pedido citava "o ataque básico (1725-1737)". Neste ficheiro, `1725-1737` é
> `inimigoAtaca` — **o ataque do monstro contra o jogador**. O ataque básico **do jogador** é
> `golpeBasico`, em `motor.js:1673-1722`. Os dois estão documentados (secções 9 e 10).

---

## 0. Índice

1. [Notação e unidades](#1-notação-e-unidades)
2. [A função `mitigar`](#2-a-função-mitigar)
3. [A armadura efectiva — os 4 casos](#3-a-armadura-efectiva--os-4-casos)
4. [A fórmula completa de um golpe (`golpear`)](#4-a-fórmula-completa-de-um-golpe-golpear)
5. [De onde vêm os números: `atributos(estado)`](#5-de-onde-vêm-os-números-atributosestado)
6. [Crítico](#6-crítico)
7. [`efetivo` e `bonusPoder`](#7-efetivo-e-bonuspoder)
8. [`tem('id')` — TODOS os itens especiais, um a um](#8-temid--todos-os-itens-especiais-um-a-um)
9. [O ataque básico do jogador (`golpeBasico`)](#9-o-ataque-básico-do-jogador-golpebasico)
10. [O ataque do monstro e `receberDano`](#10-o-ataque-do-monstro-e-receberdano)
11. [Cura: `curar`, CURA_PVP, roubo de vida](#11-cura-curar-cura_pvp-roubo-de-vida)
12. [Dano ao longo do tempo: hemorragia, queima, veneno, Solar, sangramento](#12-dano-ao-longo-do-tempo-hemorragia-queima-veneno-solar-sangramento)
13. [Dano verdadeiro (execuções)](#13-dano-verdadeiro-execuções)
14. [O monstro: curvas, multiplicadores e diferença de nível](#14-o-monstro-curvas-multiplicadores-e-diferença-de-nível)
15. [DPS: o que existe no motor (e o que não existe)](#15-dps-o-que-existe-no-motor-e-o-que-não-existe)
16. [Fórmulas de dano das habilidades (apêndice)](#16-fórmulas-de-dano-das-habilidades-apêndice)
17. [Exemplos numéricos derivados](#17-exemplos-numéricos-derivados)
18. [O que NÃO foi possível verificar](#18-o-que-não-foi-possível-verificar)
19. [Pontos que precisam de regra do dono](#19-pontos-que-precisam-de-regra-do-dono)

---

## 1. Notação e unidades

| Símbolo | Significado | Onde nasce |
|---|---|---|
| `bruto` | dano **antes** de qualquer defesa (o número que a habilidade/item entrega) | parâmetro de `golpear`, `motor.js:1192` |
| `arm` | armadura/resistência efectiva do alvo (ver §3) | `motor.js:1202` |
| `mitigar(x, arm)` | redução por defesa (ver §2) | `motor.js:1167` |
| `a` | o objecto de atributos do jogador (`atributos(estado)`, `motor.js:492-544`) | `passo`, `motor.js:1335` |
| `adEfetivo` | `a` com o AD e o AP "da hora" (Vontade do General, Foco do poder, Sede) | `efetivo`, `motor.js:1326-1331` |
| `M` (ou `alvo`) | o monstro (objecto criado por `criarMonstro`, `motor.js:1066-1075`) | — |
| `d` | `c.darius`: o estado de combate (recargas, buffs, escudos, timers) | `criarCombate`, `motor.js:1053-1063` |
| `papel` | multiplicadores do campeão: `dano`, `recebido`, `arena`, `recebidoArena`, `pvp`, `pvpRecebido` | `KITS`, `motor.js:870-894` |
| `fonte` | de onde vem o golpe: `'ataque'`, `'Q'`…`'N'`, `'item'`, `'pet'`, `'sangue'` | parâmetro de `golpear` |
| `hab` | `true` se a fonte **não** é `ataque`, `item`, `pet` nem `sangue` | `motor.js:1216` |

**Unidades**: tempo em segundos; dano em pontos de vida; `armadura`/`rm` são números absolutos
(a fórmula de mitigação converte-os); percentagens são fracções (0,15 = 15%) excepto quando dito.

**Duas moedas de dano** (importante para a decisão de build):
- `dano` **físico** → reduzido pela **armadura** do alvo;
- `dano` **mágico** → reduzido pela **resistência mágica** do alvo; os monstros **não têm RM própria**:
  a RM deles é `armadura × RM_MONSTRO`, e só conta quando o dano é "de Poder de Habilidade" (`poder`).

---

## 2. A função `mitigar`

```js
// motor.js:1167
const mitigar = (dano, armadura) => dano * (100 / (100 + Math.max(0, armadura)));
```

- `Math.max(0, armadura)`: armadura negativa nunca aumenta o dano (fica no máximo ×1).
- Armadura **0** → o dano passa inteiro (×1).
- Armadura **100** → metade do dano.
- Armadura **200** → um terço do dano.
- A mesma função serve nos dois sentidos (jogador→monstro e monstro→jogador).

**Consequência para a build**: cada 100 de armadura vale sempre a mesma fracção *do dano que chega*,
e o valor de cada ponto adicional cai (retornos decrescentes) — não há tecto nem "penetração mínima".

---

## 3. A armadura efectiva — os 4 casos

`motor.js:1202`, uma só linha, quatro casos:

```js
const arm = magico
  ? (poder ? alvo.armadura * RM_MONSTRO * (1 - (a.penMagica || 0)) : 0)
  : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura);
```

| Caso | Quando | `arm` |
|---|---|---|
| **Físico** | `magico = false` (é o caso de todo o dano de Darius, Ezreal, Yasuo — excepto o E do Yasuo — e dos itens de AD) | `alvo.armadura × (1 − alvo.reducaoArmadura) × (1 − a.penArmadura)` |
| **Mágico com `poder`** | dano de habilidade de campeão de magia (Lux, Katarina, Taric, Zac), Lich (`3100`), Luden (`6655`) | `alvo.armadura × 0,6 × (1 − a.penMagica)` |
| **Mágico sem `poder`** | Égide de Fogo Solar (`3068`, `motor.js:1638`) e o E do Yasuo (`motor.js:2090`) | `0` → **o dano passa inteiro, sem mitigação nenhuma** |
| **Verdadeiro** | execuções (§13) | não passa por `golpear` — tira vida directamente |

### 3.1 `RM_MONSTRO`

```js
// motor.js:1179
export const RM_MONSTRO = 0.6;
```

A resistência mágica dos monstros é **60% da armadura deles**. Comentário do próprio motor
(`motor.js:1177-1178`): *"dano mágico ignora a armadura: os monstros não têm resistência mágica"* — ou seja,
só o dano mágico **de Poder de Habilidade** toca nessa RM; o dano mágico "solto" (Solar, E do Yasuo)
não toca em nada.

### 3.2 Quem dá cada parcela

- `alvo.armadura` — do monstro: `CURVA.armadura(n) × MONSTROS[nome].armadura` (`motor.js:1070`),
  com `CURVA.armadura = (n) => 5 + 1.5 * n` (`motor.js:276`). Não é multiplicada por NOTURNO nem por FURIOSO.
- `alvo.reducaoArmadura` — **só** o Cutelo Negro (`3071`) a mexe: `+0,06 por ataque, tecto 0,30`
  (`motor.js:1705`). **Não decai** (nenhum timer a repõe; `criarMonstro` nasce com 0, `motor.js:1072`).
  É por monstro (cada instância tem a sua).
- `a.penArmadura` — nasce em `atributos`: `1 − (1 − penE) × (tem('3036') ? 0,7 : 1)` (`motor.js:539`),
  com `penE = habDe(estado).E.pen[rankE−1]` (`motor.js:516`). **Só o E do Darius tem `pen`**
  (`motor.js:560`: 0,20 → 0,45 por rank); nenhum outro kit tem o campo (confirmado por leitura de
  `HAB_EZREAL`, `HAB_LUX`, `HAB_YASUO`, `HAB_KATARINA`, `HAB_TARIC`, `HAB_ZAC`).
  Lembranças do Lorde Dominik (`3036`) → 30% de penetração de armadura.
- `a.penMagica` — `min(0,6, (tem('3135') ? 0,4 : 0) + pct.penMag)` (`motor.js:529`).
  Cajado do Vazio (`3135`) = 0,40 fixo; `pct.penMag` soma o que os itens tragam no campo `penMag`:
  Sapatos Enfeitiçados (`3175`) 0,15 e Sapatos do Feiticeiro (`3020`) 0,08. **Tecto global: 0,60.**
  > **Nota da Regra Nº 1**: o refino e a qualidade **não escalam** o `penMag` — `infoItem`
  > (`motor.js:251-256`) escala `ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr` e **não**
  > o `penMag`. O valor é lido cru do item (`motor.js:509`).

### 3.3 O `penSuspiro` do Yasuo (R)

O R do Yasuo (Último Suspiro) não muda o `arm` de cada golpe: muda o **`a.penArmadura`** do objecto
efémero devolvido por `efetivo`:

```js
// motor.js:1330
penArmadura: d.suspiro > 0 ? 1 - (1 - a.penArmadura) * (1 - (d.suspiroPen || 0)) : a.penArmadura
```

`d.suspiroPen = 0,3` e `d.suspiro = 15` s (`motor.js:706`, `2072`). Combinado com a penetração que já
exista, as duas multiplicam-se (nunca somam): `pen_total = 1 − (1 − pen1)(1 − pen2)`.

---

## 4. A fórmula completa de um golpe (`golpear`)

Assinatura: `motor.js:1192`

```js
function golpear(estado, c, a, alvo, bruto, fonte,
  { acumula = true, critico = false, magico = false, poder = false, frac = 1 } = {})
```

### 4.0 Guardas (o golpe pode simplesmente não acontecer)

| # | Condição | Efeito | Linha |
|---|---|---|---|
| 0.1 | `alvo.hp <= 0` | devolve `0`; nada acontece (nem cura, nem hemorragia) | `motor.js:1193` |
| 0.2 | `alvo.surgindo > 0` | devolve `0` (em Runeterra o monstro ainda está a surgir) | `motor.js:1194` |
| 0.3 | `alvo.externo` (monstro de outro jogador) | **não calcula dano**: emite `acertoMonstro` (se a fonte não for `item`/`pet`/`sangue`) e devolve `0`. Quem calcula é o servidor; `frac` é a fracção do golpe (ex.: 0,2 das bolinhas) | `motor.js:1197-1200` |

### 4.1 Promoção automática a mágico (campeões de magia)

```js
// motor.js:1201
if (kit(estado).magia && fonte !== 'ataque' && fonte !== 'item' && fonte !== 'pet' && fonte !== 'sangue') { magico = true; poder = true; }
```

Para **Lux, Katarina, Taric e Zac** (`KITS`, `motor.js:877, 884, 888, 892`), **toda** a habilidade vira
dano mágico com `poder = true` automaticamente. Para Darius, Ezreal e Yasuo (`magia` ausente), a
habilidade é **física**, salvo quando o próprio call-site passa `magico: true` (o E do Yasuo, `motor.js:2090`).
**O ataque básico nunca é promovido** (é sempre físico). **O dano de item também não** (Lich/Luden
passam o `magico`/`poder` explicitamente).

### 4.2 Efeitos de itens de mago — antes da mitigação

Só quando `poder === true` **e** a fonte não é `'ataque'` (`motor.js:1203`). `f = alvo.hp / alvo.hpMax`
calculado **antes** deste golpe (`motor.js:1204`):

```js
if (a.tem?.('4645') && f < 0.4) bruto *= 1.2;      // Chama Sombria  → +20% abaixo de 40% de vida
if (a.tem?.('3165') && f < 0.5) bruto *= 1.12;     // Morellonomicon → +12% abaixo de 50% de vida
if (a.tem?.('6653')) alvo.queima = { dps: vidaRefItem(alvo) * 0.015, t: 3 };   // Liandry (ver §12)
if (a.tem?.('3116')) alvo.lento = Math.max(alvo.lento || 0, 1.5);              // Rylai: lentidão 1,5 s
```

- Os dois multiplicadores **aplicam-se ao `bruto`** e portanto passam por toda a cadeia (crítico incluído).
- A condição é `fonte !== 'ataque'` — **não** é "só habilidades": o Lich (`3100`) e o Luden (`6655`)
  são fonte `'item'` com `poder: true` e portanto **também re-aplicam** a queima do Liandry e a lentidão
  do Rylai. (O Liandry *sobrescreve* `alvo.queima`, não acumula.)
- `vidaRefItem` = `min(vida, 3 × CURVA.hp(nivel))` — ver §12.1.

### 4.3 A cadeia de multiplicadores (a fórmula)

Escrevendo por passos, com a ordem exacta do motor (`motor.js:1210-1222`):

```
D0 = mitigar(bruto, arm)                                        // §2 e §3
D1 = D0 × (1 + G + 0,01×D + B)                                  // 1211
D2 = D1 × papel.dano × (arena ? papel.arena : 1)                // 1212
D3 = critico ? D2 × danoCritico : D2                            // 1213
D4 = (M.chefe && tem('3036')) ? D3 × 1,15 : D3                  // 1214
D5 = M.dominioAmp ? D4 × (1 + M.dominioAmp) : D4                // 1215
D6 = (ezreal && hab) ? D5 × bonusEzreal : D5                    // 1216-1217
D7 = (hab && danoHab > 0) ? D6 × (1 + danoHab) : D6             // 1218
D8 = (hab && absorcao > 0) ? D7 × (1 + absorcaoBonus×absorcaoAcum) : D7   // 1219
D9 = (sombraPronta > 0 && hab && fonte !== 'B') ? D8 × (1 + sombraBonus) : D8   // 1220
DANO = D9 × fatorDanoJogador(estado, M)                         // 1221
M.hp -= DANO                                                    // 1222
```

com:

| Termo | Valor | Linha |
|---|---|---|
| `G` | `d.gritoBonus` enquanto `d.grito > 0` (Grito de Guerra do Darius: 0,15 + 0,03 por rank, 8 s) | `motor.js:1211`, `565-566`, `1819` |
| `D` | `d.disciplina` (Disciplina da Legião: +1 por abate sem voltar à base, tecto `acumulos[rank]` = 2×rank) | `motor.js:1211`, `570-571`, `1791` |
| `B` | `BARAO.dano = 0,25` enquanto `estado.buffBarao > 0` (180 s depois de matar o Barão) | `motor.js:1211`, `3067`, `1784` |
| `papel.dano` / `papel.arena` | ver tabela §5.6 | `motor.js:870-894` |
| `danoCritico` | 1,75 base, +0,4 com `3031`, × `critDano` do kit (Yasuo 0,8) | `motor.js:499`, `515`, `541` |
| `M.dominioAmp` | 0 → `ampMax` (0,30) conforme o tempo dentro do Domínio de Noxus | `motor.js:1480` |
| `bonusEzreal` | ver §7.2 | `motor.js:1237-1248` |
| `danoHab` | `FOCO_DANO_HAB (0,002) × foco` para quem tem `semMana` (Katarina **e** Zac) | `motor.js:531`, `457`, `884`, `892` |
| `absorcaoBonus`, `absorcaoAcum` | Absorção do Zac: `danoGosma[rank]` (0,03+0,003/rank) por gosma, até 3 | `motor.js:844`, `1219`, `2417-2419` |
| `sombraBonus` | Passo das Sombras da Katarina: 1,0 + 0,08/rank; **consome-se** no golpe (`sombraPronta = 0`) | `motor.js:763`, `1220`, `2231` |
| `fatorDanoJogador` | §14.3 | `motor.js:1187`, `1221` |

### 4.4 Depois do dano (efeitos que o golpe dispara)

`motor.js:1223-1233`, por ordem:

1. `alvo.golpeOutro = null` — o último golpe passou a ser seu (`motor.js:1223`).
2. Emite o evento `'dano'` com `{alvo, valor, fonte, critico, magico}` (`motor.js:1224`).
3. Se for Ezreal: `marcasEzreal` (§16.2) (`motor.js:1225`).
4. **Roubo de vida** — só se `a.rouboVida > 0` **e** `fonte === 'ataque'` (`motor.js:1226-1230`):
   ```js
   const cura = dano * a.rouboVida, falta = a.vida - estado.vida;
   curar(estado, c, a, cura);
   if (a.tem('3072') && cura > falta)
     d.escudo = Math.min(a.vida * 0.25, (d.escudo || 0) + (cura - falta));
   ```
   - `dano` é o dano **calculado**, não limitado à vida que sobrava: **overkill também cura**.
   - O excedente vira escudo **só com a Sedenta por Sangue (`3072`)**, e o escudo total fica limitado a
     **25% da vida máxima**.
5. `if (d.furiaS > 0) curar(estado, c, a, dano * d.furiaRoubo)` (`motor.js:1231`) — Fúria Sanguinária
   (Darius `F`) / Banho de Sangue: cura **em qualquer fonte de dano**, não só no ataque. Para o Banho de
   Sangue o `furiaRoubo` é 0 (`motor.js:1873`), logo não cura por esta via.
6. `if (acumula && kit(estado).hemorragia) aplicarHemorragia(c, alvo)` (`motor.js:1232`) — só o Darius
   (`hemorragia: true`, `motor.js:870`); `acumula` é `false` em todos os golpes "extra" (procs de item,
   spins, DoTs).
7. `return dano` — é este valor que os call-sites usam para curas ligadas ao dano (ex.: `curaSede`,
   `curaGiro`, `curaDano` do Taric).

### 4.5 Fontes que **não** passam por `golpear` (e o que isso lhes tira)

Estas fontes **não** levam: crítico, `papel.dano`, `papel.arena`, Grito, Disciplina, buff do Barão,
`fatorDanoJogador`, roubo de vida nem hemorragia:

| Fonte | O que faz | Linha |
|---|---|---|
| Hemorragia (DoT) | `i.hp -= mitigar(danoSangue × acumulos × dt, i.armadura × (1 − a.penArmadura))` | `motor.js:1643-1649` |
| Queima do Liandry / veneno | `i.hp -= min(i.hp, dps × dt)` | `motor.js:1652-1655` |
| Execuções (Darius R/N, Katarina M) | `alvo.hp -= golpe` (ou `= 0`) | `motor.js:1805-1806`, `1851`, `2240` |
| Espinhos (`3075`) | `i.hp -= 10 + 0,1 × a.bonusArmadura` | `motor.js:1735` |
| Dano de PvP | `estado.vida -= valor` (valor vem do servidor) | `motor.js:3732` |

> **Consequência prática**: a hemorragia do Darius **ignora o Cutelo Negro** (não usa
> `alvo.reducaoArmadura`), mas **usa** a penetração do E e do `3036`. Já o dano do ataque e das
> habilidades usa os dois.

---

## 5. De onde vêm os números: `atributos(estado)`

Função completa em `motor.js:492-544`. Esta é a **única** fonte dos atributos usados no combate.

### 5.1 Crescimento por nível

```js
// motor.js:434-437
const crescimento = (nivel) => {
  const n = Math.min(nivel, 18);
  return (n - 1) * (0.7025 + 0.0175 * (n - 1)) + Math.max(0, nivel - 18);
};
```

| Nível | `g` |
|---|---|
| 1 | 0 |
| 18 | 17 |
| 50 | 49 (= 17 + 32) |

### 5.2 Base do campeão

```js
// motor.js:495-497
let ad = k.adBase + k.adNivel * g;
let vida = b.hp + b.hpperlevel * g;
let armadura = b.armor + b.armorperlevel * g;
let rm = b.spellblock + 3.5 * g;        // ← 3,5 FIXO por unidade de crescimento
const baseAd = ad, baseVida = vida, baseArmadura = armadura;
```

- `k.adBase`/`k.adNivel` são do motor (`KITS`): Darius 64 / 3,9 (`motor.js:870`),
  Ezreal 66 / 4,2 (`872`), Lux 54 / 3,3 (`877`), Yasuo 60 / 3,9 (`881`), Katarina 58 / 3,4 (`884`),
  Taric 55 / 3,3 (`888`), Zac 60 / 3,3 (`892`).
- `b` = `kit(estado).stats` = `DADOS.campeao.stats` dos ficheiros de dados, importados em
  `motor.js:3-8`. **Estado do repositório** (verificado com `fs.existsSync` nesta sessão):

  | Ficheiro | Existe? | Onde estão os números |
  |---|---|---|
  | `dados.js` (Darius) | **sim** | `docs/game-src/dados.js:8-29` |
  | `dados-katarina.js` (Katarina) | **sim** — acrescentado por outro agente **durante** esta sessão, lido do jogo vivo | `docs/game-src/dados-katarina.js:11-32` |
  | `dados-ezreal.js` | **não** | **NAO VERIFICADO** |
  | `dados-yasuo.js` | **não** | **NAO VERIFICADO** |
  | `dados-lux.js` | **não** | **NAO VERIFICADO** |
  | `dados-taric.js` | **não** | **NAO VERIFICADO** |
  | `dados-zac.js` | **não** | **NAO VERIFICADO** |

  **Darius** (`dados.js:8-29`): `hp 652, hpperlevel 114, mp 263, mpperlevel 58, armor 37,
  armorperlevel 5,2, spellblock 32, spellblockperlevel 2,05, hpregen 10, hpregenperlevel 0,95,
  mpregen 6,6, mpregenperlevel 0,35, attackspeed 0,625, attackspeedperlevel 1`.

  **Katarina** (`dados-katarina.js:11-32`): `hp 672, hpperlevel 108, mp 0, mpperlevel 0, armor 32,
  armorperlevel 4,7, spellblock 32, spellblockperlevel 2,05, hpregen 7,5, hpregenperlevel 0,7,
  mpregen 0, mpregenperlevel 0, attackspeed 0,658, attackspeedperlevel 2,74`.
  O `mp 0`/`mpregen 0` confirma o `semMana` do kit (`motor.js:884`).
- **Atenção**: a RM **não** usa `b.spellblockperlevel` — usa **3,5 por `g`** (fixo no motor).

### 5.3 Pontos de atributo

```js
// motor.js:503
if (k.magia) ap += 2 * at.forca; else ad += 1.2 * at.forca;
vida += 20 * at.vitalidade;
armadura += 1.5 * at.resistencia;
rm += 1 * at.resistencia;
va += 0.008 * at.agilidade;
```

| Ponto | Efeito exacto |
|---|---|
| Força | **+1,2 de AD** (Darius, Ezreal, Yasuo) **ou +2 de AP** (Lux, Katarina, Taric, Zac) |
| Vitalidade | +20 de vida máxima |
| Resistência | +1,5 de armadura e +1 de RM |
| Agilidade | +0,8% de velocidade de ataque (0,008) |
| Foco | +8 de mana máxima (`motor.js:520`), +0,06 de regeneração de mana/s (`533`), −0,4% de recarga (`537`); para quem não usa mana (Katarina/Zac) → +0,2% de dano de habilidade (`531`); para o Yasuo → +1% de Fluxo ganho (`532`) |

O Foco **não** entra na vida nem na armadura. Não há pontos de penetração nem de crítico.

### 5.4 Itens: o que escala e o que não

```js
// motor.js:504-510
for (const id of estado.itens) {
  if (!ITENS[baseId(id)]) continue;
  const i = infoItem(id);
  ad += i.ad; ap += i.ap; manaItens += i.mana; vida += i.vida; armadura += i.armadura; rm += i.rm;
  va += i.va; rv += i.rv; critico += i.critico;
  regenItens += i.regen; cdrItens += i.cdr;
  for (const p in pct) pct[p] += i[p] || 0;
}
```

`infoItem` (`motor.js:251-256`):

```js
m = (1 + 0.12 × refino) × QUALIDADES[qualidade].mult
// e escala: ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr
// e NÃO escala: penMag, adPct, apPct, vidaPct, armPct, rmPct, esquiva
```

- `BONUS_REFINO = 0,12` por nível de refino (`motor.js:55`), `REFINO_MAX = 5` (`motor.js:54`).
- `QUALIDADES` (`motor.js:173-179`): C 0,9 · B 1,0 · A 1,15 · S 1,35 · SS 1,7.
- Logo o multiplicador de um item é `(1 + 0,12 × refino) × mult_qualidade` — **refino e qualidade
  multiplicam-se**. Um `+5~S` vale `1,6 × 1,35 = 2,16×` os atributos base.

### 5.5 Percentagens de item (os campos `pct`)

```js
// motor.js:501
const pct = { adPct: 0, apPct: 0, vidaPct: 0, armPct: 0, rmPct: 0, esquiva: 0, penMag: 0 };
```

Aplicação e ordem (`motor.js:511`, `523-524`):

```js
vida *= 1 + pct.vidaPct;                       // 511 — ANTES do bónus do 2501
// ... 2501, 3003, 3089 ...
ad *= 1 + pct.adPct;  ap *= 1 + pct.apPct;
armadura *= 1 + pct.armPct + wArm;  rm *= 1 + pct.rmPct;     // 523
ad *= 1 + bc.ad; ap *= 1 + bc.ad; vida *= 1 + bc.vida;
armadura *= 1 + bc.armadura + bm.armadura; rm *= 1 + bc.rm + bm.rm;   // 524 (conquistas e mascote)
```

Itens com estes campos (lidos de `docs/game-src/itens.js`):

| Item | Campo |
|---|---|
| Marcha Célere (`3170`) | `esquiva 0,05` |
| Esmagadores Acorrentados (`3173`) | `rmPct 0,15` |
| Mobilização Blindada (`3174`) | `armPct 0,15` |
| Égide de Fogo Solar (`3068`) | `armPct 0,10` |
| Presságio de Randuin (`3143`) | `armPct 0,10` |
| Explocinturão Hextec (`3152`) | `apPct 0,05` |
| Caminho Imortal (`3168`) | `vidaPct 0,05` |
| Medalhão dos Solari de Ferro (`3190`) | `vidaPct 0,06` |
| Máscara Abissal (`8020`) | `vidaPct 0,08` |
| Grevas Bélicas (`3172`) | `adPct 0,06` |
| Mandíbula de Malmortius (`3156`) | `adPct 0,05` |
| Criafendas (`4633`) | `apPct 0,05` |
| Arco-escudo Imortal (`6673`) | `vidaPct 0,06` |
| Coroa do Rei Demoníaco (`663056`) | `adPct 0,04` |
| Coroa da Rainha Despedaçada (`664644`) | `apPct 0,06` |
| Sapatos Enfeitiçados (`3175`) | `penMag 0,15` |
| Sapatos do Feiticeiro (`3020`) | `penMag 0,08` |

Todos estes são aplicados sobre o **total já somado** (base + atributos + itens planos), não sobre o base.
O `armPct` do `3068`/`3143`/`3174` **multiplica-se** entre si e com `wArm` (a passiva do W do Taric)
porque são somados dentro do mesmo parêntese — `armadura × (1 + armPct₁ + armPct₂ + wArm)`.

### 5.6 O objecto devolvido (o que o combate lê)

```js
// motor.js:525-543
{
  ouroMult, ad, baseAd, bonusAd, vida, bonusVida, armadura, bonusArmadura, rm, ap,
  penMagica: min(0,6, (tem('3135') ? 0,4 : 0) + pct.penMag),
  mana,
  danoHab: k.semMana ? 0,002 × foco : 0,
  fluxoMult: k.fluxo ? 1 + 0,01 × foco : 1,
  regenMana: (k.fluxo || k.semMana) ? 0 : ((mpregen + mpregenperlevel×g)/5) × 3 + 0,06 × foco,
  velAtaque: min(3, attackspeed × (1 + (attackspeedperlevel/100)×g + va)),
  regen: (hpregen + hpregenperlevel×g)/5 + 0,1 × vitalidade + regenItens,
  esquiva: min(0,25, 0,0025 × agilidade + pct.esquiva),
  reducaoRecarga: min(0,4, min(0,3, 0,004 × foco) + cdrItens),
  rouboVida: rv,
  penArmadura: 1 - (1 - penE) × (tem('3036') ? 0,7 : 1),
  critico: min(1, (critico + critBase(nivel)) × critMult),
  danoCritico: danoCritico × critDano,
  tem,   // a função de §8
}
```

E ainda, antes: `vida += 20 × vitalidade`, `armadura += 1,5 × resistencia`, `rm += 1 × resistencia`,
`va += 0,008 × agilidade` (§5.3).

**Tectos, todos juntos**: velocidade de ataque **3,0** (`VEL_ATAQUE_MAX`, `motor.js:344`);
esquiva **25%**; redução de recarga **40%** total (sendo **30%** o máximo vindo do Foco);
penetração mágica **60%**; crítico **100%**; escudo da Sedenta **25%** da vida máxima.

### 5.7 Os `papel` de cada campeão (multiplicadores de dano)

`motor.js:870-894`:

| Campeão | `dano` | `arena` (Runeterra) | `recebido` | `recebidoArena` | `pvp` | `pvpRecebido` |
|---|---|---|---|---|---|---|
| Darius | 1,10 | 1,075 | 0,55 | — | 0,95 | 0,85 |
| Ezreal | 1,12 | 1,10 | 1,05 | — | 1,08 | 1,03 |
| Lux | 1,59 | 1,00 | 1,05 | — | 1,20 | 1,05 |
| Yasuo | 1,15 | 1,50 | 0,85 | — | 1,00 | 0,92 |
| Katarina | 1,20 | 1,75 | 0,75 | **1,00** | 1,15 | 1,00 |
| Taric | 0,90 | 0,78 | 0,75 | — | 0,88 | 0,85 |
| Zac | 1,425 | 0,70 | 0,66 | **0,70** | 0,50 | 0,69 |

- `papel.dano` multiplica **todo** o dano que passa por `golpear` (`motor.js:1212`).
- `papel.arena` substitui/acresce em Runeterra (é multiplicado junto, `motor.js:1212`).
- `papel.recebido` (ou `recebidoArena` quando existe) multiplica o dano **recebido** (`motor.js:2697`).
- `pvp` e `pvpRecebido` **não são lidos em nenhum ponto do motor** (grep exaustivo: só aparecem nas
  declarações de `KITS`). O dano de PvP é calculado no **servidor** — ver §18/§19.

---

## 6. Crítico

### 6.1 Chance

```js
// motor.js:499
let critico = 0, danoCritico = 1.75;
// motor.js:507 — itens: critico += i.critico (escalado por refino × qualidade)
// motor.js:541
critico: Math.min(1, (critico + (k.hab.P?.critBase?.(estado.nivel) || 0)) * (k.hab.P?.critMult || 1))
```

- Chance base **0**; vem toda dos itens (campo `critico`, escalado por refino/qualidade).
- **Yasuo** (`motor.js:697`): `critMult: 2` → a chance **dobra**; `critBase(nivel) = min(0,18, 0,1 + 0,0018 × nivel)`
  → +10% no nível 1, +18% a partir do nível 45 (o `min` trava em 0,18).
- Tecto final: **100%**.

### 6.2 Dano do crítico

```js
// motor.js:499 e 515
danoCritico = 1.75;
if (tem('3031')) danoCritico += 0.4;        // Gume do Infinito → 2,15
// motor.js:541
danoCritico: danoCritico * (k.hab.P?.critDano || 1)
```

- Base **1,75** (i.e., +75%).
- Gume do Infinito (`3031`) → **2,15** (+40% somado ao multiplicador, não ao dano final).
- **Yasuo**: `critDano: 0,8` (`motor.js:697`) → `2,15 × 0,8 = 1,72` com Gume, `1,75 × 0,8 = 1,40` sem.
- O crítico multiplica **o golpe inteiro** (`motor.js:1213`), incluindo os extras somados ao `bruto`
  (Rei Destruído, Trindade, Couraça, Quebrapassos no ataque principal, W do Darius).

### 6.3 Quem pode dar crítico

| Fonte | Como | Linha |
|---|---|---|
| Ataque básico (todos) | `critico = ceu || Math.random() < a.critico` | `motor.js:1700` |
| Céu Dividido (`6610`) | **o primeiro ataque em cada inimigo é crítico garantido** | `motor.js:1699` |
| Q do Yasuo (tornado e estocada) | `crit()` | `motor.js:2127`, `2134` |
| R do Yasuo | `crit()` | `motor.js:2071` |
| A / T / M do Yasuo | `crit()` | `motor.js:2100`, `2113`, `2119` |
| Dança das Mil Lâminas (N do Yasuo) | `Math.random() < a.critico` | `motor.js:1493` |
| Corte Fantasma (F do Yasuo) | `Math.random() < a.critico` | `motor.js:1714` |
| Furacão de Runaan (`3085`) | só **corpo a corpo** (`!longe`); à distância é 15% e **sem** crítico | `motor.js:1718` |

**Nunca dão crítico**: todo o resto — habilidades de Darius/Ezreal/Lux/Katarina/Taric/Zac, procs de
item (Luden, Lich, Solar, Hidras, Quebrapassos como golpe separado), DoTs, cura, execuções.

---

## 7. `efetivo` e `bonusPoder`

### 7.1 `efetivo(estado, d, a)` — o AD/AP "da hora"

```js
// motor.js:1326-1331
function efetivo(estado, d, a) {
  const HD = habDe(estado).D, rD = estado.ranks.D;
  const vontade = HD?.vontade && rD ? HD.vontade[rD - 1] * Math.max(0, 1 - estado.vida / a.vida) : 0;
  return { ...a,
    ad: (a.ad + (d.poder > 0 ? bonusPoder(estado.nivel) : 0)) * (1 + vontade),
    ap: (a.ap || 0) * (1 + (d.farol > 0 ? d.farolPoder || 0 : 0)),
    penArmadura: d.suspiro > 0 ? 1 - (1 - a.penArmadura) * (1 - (d.suspiroPen || 0)) : a.penArmadura };
}
```

- **Vontade do General** (passiva D do Darius, `motor.js:675`): `vontade[rank] = 0,15 + 0,03 × (rank−1)`
  (0,15 → 0,42 no rank 10), multiplicada pela **fracção de vida que falta** `(1 − vida/vidaMax)`.
  Com a vida cheia → 0; com 1 de vida → o valor do rank. Aplica-se ao **AD inteiro** (não só ao bónus).
- **`d.poder`** — 5 s de "poder" quando a Hemorragia chega a 5 acúmulos (`motor.js:1278-1280`):
  soma `bonusPoder(nivel)` ao AD (só o Darius; o campo `poder` nasce no combate do Darius).
- **Farol de Demacia** (B da Lux, `motor.js:660`, `1999-2000`): `d.farolPoder = 0,10 + 0,02 × (rank−1)`,
  por 10 s → multiplica o **AP total**.
- **Último Suspiro** (R do Yasuo): ver §3.3.
- Nota: `efetivo` **não** recalcula os atributos dos itens; é uma camada por cima de `a`.
- Os call-sites completam `adEfetivo.bonusAd = adEfetivo.ad − a.baseAd` (`motor.js:1428`, `arena.js:1472`).

### 7.2 `bonusEzreal` (Arrogância + Mira do Explorador)

```js
// motor.js:1237-1248
function bonusEzreal(estado, c, alvo) {
  const d = c.darius, HD = habDe(estado).D, rD = estado.ranks.D;
  let k = 1 + (d.arrogancia > 0 ? d.arrogBonus || 0 : 0);
  if (HD?.longe && rD) {
    const A = LOCAL[estado.local]?.arena ? c.arena : null;
    const f = A && alvo.x != null
      ? Math.min(1, Math.max(0, (Math.hypot(alvo.x - A.x, alvo.y - A.y) - 2) / 5))
      : Math.min(1, Math.max(0, alvo.chegada || 0));
    k *= 1 + HD.longe[rD - 1] * f;
    if (f >= 0.9 && !(d.pressa > 0)) { d.pressa = 2; d.folego = Math.min(FOLEGO_MAX, (d.folego ?? FOLEGO_MAX) + 0.25); }
  }
  return k;
}
```

- `d.arrogancia`/`d.arrogBonus` = Arrogância do Explorador (G do Ezreal): `bonusHab[rank] = 0,20 + 0,025 × (rank−1)`,
  8 s (`motor.js:602`, `2591`).
- `HD.longe[rank] = 0,12 + 0,02 × (rank−1)` (0,12 → 0,30) (`motor.js:607`).
- `f` = distância normalizada: **em Runeterra**, de 2 a 7 tiles → 0 a 1; **no Rift**, usa `alvo.chegada`
  (quanto o monstro ainda leva para chegar) como 0 a 1.
- Só se aplica a **habilidades** (`hab`, `motor.js:1216-1217`) — o ataque básico **não** leva o bónus de longe.

### 7.3 `bonusPoder`

```js
// motor.js:1332
export const bonusPoder = (nivel) => 30 + (200 * (Math.min(nivel, 18) - 1)) / 17 + 4 * Math.max(0, nivel - 18);
```

| Nível | `bonusPoder` |
|---|---|
| 1 | 30 |
| 18 | 230 |
| 50 | 230 + 4 × 32 = **358** |

É somado ao AD enquanto `d.poder > 0` (5 s depois de 5 acúmulos de Hemorragia, `motor.js:1278-1280`).

---

## 8. `tem('id')` — TODOS os itens especiais, um a um

```js
// motor.js:513
const tem = (id) => estado.itens.some((x) => baseId(x) === id);
```

- Olha **só para os itens equipados** (`estado.itens`), nunca para a mochila nem para o cofre.
- Compara com `baseId` → **refino e qualidade não importam** para o efeito especial (só para os
  atributos que `infoItem` escala). Um `"3071+3~SS"` conta como `"3071"`.
- Devolve-se dentro do objecto de atributos (`motor.js:542`), por isso o combate chama `a.tem(...)`.
- Um item lendário **não pode ser equipado duas vezes** (`motor.js:2879`, `2886`, `2891`) → os
  efeitos abaixo nunca se acumulam por duplicação.

### 8.1 Itens lidos **dentro** de `atributos` (mudam os números do campeão)

| ID | Nome | Efeito no motor | Linha |
|---|---|---|---|
| `2501` | Armadura Sangrenta do Suserano | `ad += 0,02 × (vida − baseVida)` — 2% da **vida bónus** (já com `vidaPct` aplicado, sem conquistas/mascote) | `motor.js:514` |
| `3031` | Gume do Infinito | `danoCritico += 0,40` → 2,15 | `motor.js:515` |
| `3003` | Cajado do Arcanjo | `ap += 0,03 × manaMax` | `motor.js:521` |
| `3089` | Capuz da Morte de Rabadon | `ap *= 1,35` (sobre o AP total até aqui) | `motor.js:522` |
| `3135` | Cajado do Vazio | `penMagica += 0,40` (entra no `min(0,6, …)`) | `motor.js:529` |
| `3036` | Lembranças do Lorde Dominik | `penArmadura = 1 − (1 − penE) × 0,7` → 30% de penetração de armadura | `motor.js:539` |

### 8.2 Itens lidos **dentro** de `golpear` (efeitos de combate)

| ID | Nome | Condição | Efeito | Linha |
|---|---|---|---|---|
| `4645` | Chama Sombria | `poder && fonte !== 'ataque' && alvo.hp/alvo.hpMax < 0,40` | `bruto *= 1,20` | `motor.js:1205` |
| `3165` | Morellonomicon | `poder && fonte !== 'ataque' && f < 0,50` | `bruto *= 1,12` | `motor.js:1206` |
| `6653` | Tormento de Liandry | `poder && fonte !== 'ataque'` | `alvo.queima = { dps: vidaRefItem(alvo) × 0,015, t: 3 }` | `motor.js:1207` |
| `3116` | Cetro de Cristal de Rylai | `poder && fonte !== 'ataque'` | `alvo.lento = max(lento, 1,5)` | `motor.js:1208` |
| `3036` | Lembranças do Lorde Dominik | `alvo.chefe` | `dano *= 1,15` (depois do crítico) | `motor.js:1214` |
| `3072` | Sedenta por Sangue | `fonte === 'ataque'` e cura > vida que falta | excedente vira `d.escudo`, tecto **25% da vida máxima** | `motor.js:1229` |

### 8.3 Itens lidos **fora** de `golpear` (por evento)

| ID | Nome | Onde | Efeito exacto | Linha |
|---|---|---|---|---|
| `3065` | Semblante Espiritual | `curar` | `× 1,25` em **toda** a cura recebida | `motor.js:1286` |
| `3068` | Égide de Fogo Solar | `tickInimigos` | a cada 1 s: `3 + 0,5 × nível + 0,003 × vida` de dano mágico **sem mitigação** nos monstros encostados (Rift: `chegada ≤ 0`; Runeterra: ≤ 2,2 tiles) | `motor.js:1629`, `1633-1639` |
| `3100` | Perdição de Lich | `aoUsarHabilidade` arma `d.lich`; `golpeBasico` consome | o ataque depois de uma habilidade causa `0,75 × AP` de dano mágico (com `poder` → mitiga por `armadura × 0,6 × (1 − penMag)`) | `motor.js:1944`, `1688` |
| `6655` | Eco de Luden | `aoUsarHabilidade` | a cada 6 s: `100 + 0,1 × AP` de dano mágico em **até 3** inimigos | `motor.js:1945-1950` |
| `3742` | Couraça do Defunto | `golpeBasico` | a cada 4 s: `bruto += 40` | `motor.js:1698` |
| `6610` | Céu Dividido | `golpeBasico` | o 1.º ataque em cada inimigo é **crítico garantido** e cura **6% da vida que falta** | `motor.js:1699`, `1704` |
| `3153` | Espada do Rei Destruído | `golpeBasico` | `bruto += 0,05 × min(vida atual, 3 × CURVA.hp(nível))` — **com tecto** | `motor.js:1702`, `1190-1191` |
| `3071` | Cutelo Negro | `golpeBasico` | `alvo.reducaoArmadura = min(0,30, +0,06)` por ataque | `motor.js:1705` |
| `3044` | Fago | `golpeBasico` | `d.furia = 2` s → +8% de velocidade de ataque (`avancarAtaque`) | `motor.js:1706`, `1666` |
| `3046` | Dançarina Fantasma | `golpeBasico` | `d.valsaAcum = min(5, +1)`, `d.valsa = 3` s → +6% de VA por acúmulo | `motor.js:1707`, `1667` |
| `3085` | Furacão de Runaan | `golpeBasico` | +2 inimigos com `0,15 × bruto` (atiradores, **sem crítico**) ou `0,55 × bruto` (corpo a corpo, **com** crítico) | `motor.js:1718` |
| `6631` | Quebrapassos | `golpeBasico` | a cada 5 s: `0,80 × AD` a **todos** os alcançáveis (sem crítico) | `motor.js:1719` |
| `3074` | Hidra Raivosa | `golpeBasico` | `0,40 × AD` aos outros alcançáveis (sem crítico) | `motor.js:1720` |
| `3748` | Hidra Titânica | `golpeBasico` | `0,015 × vida máxima` a todos os alcançáveis (sem crítico) | `motor.js:1721` |
| `3075` | Armadura de Espinhos | `inimigoAtaca` | quem te acerta leva `10 + 0,10 × armadura bónus` (dano cru, sem mitigação) | `motor.js:1735` |
| `6333` | Dança da Morte | `receberDano` | 30% do dano recebido vira sangramento em 3 s | `motor.js:2701-2704`, `1431-1438` |
| `6333` | Dança da Morte | `processarAbates` | ao abater: limpa o sangramento e cura `15% da vida que falta` | `motor.js:1790` |
| `3102` | Véu da Banshee | `receberDano` | bloqueia **1 golpe de monstro** a cada 40 s (não gasta com sangramento) | `motor.js:2698-2700` |
| `3157` | Ampulheta de Zhonya | `receberDano` | abaixo de 25% de vida: 2,5 s invulnerável, recarga 120 s | `motor.js:2722-2724` |
| `3053` | Sinal de Sterak | `receberDano` | abaixo de 30% de vida: escudo = `0,60 × vida bónus`, recarga 90 s | `motor.js:2725-2727` |
| `3026` | Anjo Guardião | `receberDano` | ao morrer: volta com **50% da vida**, recarga 300 s | `motor.js:2729-2731` |
| `3026` | Anjo Guardião | `danoPvp` | no PvP: vida = 1 e o servidor decide (`anjoPvp`) | `motor.js:3737`, `3781-3786` |
| `3078` / `3057` | Força da Trindade / Fulgor | `lamina(a)` | próximo ataque após habilidade: `+2 × baseAd` / `+1 × baseAd` | `motor.js:1672`, `1697` |
| `2022` | Partícula Brilhante | `Object.assign` | `cdr: 0,05` | `motor.js:16` |
| `1006` | Pérola do Rejuvenescimento | `Object.assign` | `regen: 3` (vida/s) | `motor.js:17` |
| `3057` | Fulgor | `Object.assign` | texto de efeito (o efeito real é o `lamina`) | `motor.js:18` |
| `4629` | Ímpeto Cósmico | `Object.assign` | `cdr: 0,15` | `motor.js:24` |
| `3108` | Códex Demoníaco | `Object.assign` | `cdr: 0,05` | `motor.js:25` |
| `3802` | Capítulo Perdido | `Object.assign` | `cdr: 0,05` | `motor.js:26` |

### 8.4 Lista completa dos IDs que o motor testa com `tem`

```
2501 3003 3020* 3031 3036 3044 3046 3053 3057 3065 3068 3071 3072 3074 3075 3078
3085 3089 3100 3102 3116 3135 3153 3157 3165 3170* 3174* 3175* 3742 3748 4645 6333
6610 6631 6653 6655 8020* 3143* 3152* 3168* 3172* 3173* 3190* 4633* 6673* 663056* 664644*
```

(`*` = lidos pelos campos `pct` em `atributos`, não por `tem()`.)

**Todos os outros itens do catálogo só dão atributos planos** (ad, ap, vida, armadura, rm, va, rv,
critico, mana, regen, cdr) — não têm lógica própria no motor.

---

## 9. O ataque básico do jogador (`golpeBasico`)

`motor.js:1673-1722`. É chamado quando `d.ataque <= 0` e o alvo está vivo e o jogador não está
canalizando/em estado especial (`motor.js:1608`).

### 9.1 Ritmo (quando o ataque acontece)

```js
// motor.js:1675
d.ataque = 1 / a.velAtaque;
// motor.js:1666-1667 — a cada passo:
d.ataque -= dt * M
```

com `M = 1`
`+ 0,08` se `d.furia > 0` (Fago)
`+ 0,10 × d.forcaAcum` (passiva do Ezreal, até 5)
`+ 0,06 × d.valsaAcum` (Dançarina, até 5)
`+ d.ventaniaVa` se `d.ventania > 0` (Respiração do Vento, Yasuo)
`+ d.sinistraAcum × d.sinistraVa` se `d.sinistra > 0` (Lâmina Sinistra, Katarina)
`+ d.sedeVa` se `d.sede > 0` (Sede de Sangue, Katarina)
`+ d.inquietaAcum × d.inquietaVa` se `d.inquieta > 0` (Lâmina Inquieta, Yasuo)
`+ d.bravataVa` se `d.bravata > 0` (Bravata, Taric)

Logo o **intervalo real entre ataques** é `(1 / velAtaque) / M` e a **cadência real** é
`velAtaque × M` ataques por segundo. **Os bónus de VA de efeitos multiplicam a cadência por cima do
tecto de 3,0** (o tecto só limita o `velAtaque` de `atributos`).

### 9.2 Ordem exacta do ataque

1. `d.ataque = 1 / a.velAtaque` (`1675`).
2. `bruto = adEfetivo.ad`, `fonte = 'ataque'` (`1676`).
3. Se o alvo tem `marca > 0` → `detonarOrbe` (Lux/Iluminação ou Ezreal/W) (`1677`, §16.2).
4. **Banho de Sangue** (Darius F): se `d.banho > 0`:
   `bruto += min(1,5 × ad, vidaPerdida[rank] × (hpMax − hp))`; se o alvo tem Hemorragia,
   cura `vida × curaSangue[rank]` (`1678-1682`; `vidaPerdida = 0,03 + 0,004/rank`,
   `curaSangue = 0,01 + 0,001/rank`, `motor.js:677`).
5. **Sede de Sangue** (Katarina G): se `d.sede > 0`, um golpe separado com `HK.G.dano(rank, adEfetivo)`
   (dano mágico de habilidade, porque a Katarina é `magia`), e cura `30%` desse dano (`1683-1686`).
6. Se `d.veneno > 0` → `envenenar` (DoT; §12.3) (`1687`).
7. **Lich** (`3100`): se `d.lich`, um golpe de `0,75 × AP` mágico com `poder`, e desarma a flag (`1688`).
8. Se `d.wPronto` (W do Darius): o **ataque inteiro vira o W**: `bruto = HK.W.dano(rank, adEfetivo)`
   (`1,4 + 0,05/rank` × AD), `fonte = 'W'`, alvo lento 2 s, e o próximo ataque ganha a Lâmina Encantada
   (`1689`).
9. **Bravata** (Taric): se `d.bravata > 0`, `d.bravata--`, golpe mágico extra
   `HK.P.dano(nivel, adEfetivo) × (arena ? 0,8 : 1)` = `30 + 12 × nível + 0,15 × AP + 0,4 × armadura bónus`,
   todas as recargas andam `1 s` (`0,75 s` na Q), e devolve `1,5%` da mana (`1690-1696`, `779-780`).
10. **Lâmina Encantada** (Trindade/Fulgor): `bruto += d.trindade × baseAd` e zera a flag (`1697`).
    `d.trindade` é armado por `usar` de qualquer habilidade (`1583`) ou pelo W (`1689`).
11. **Couraça do Defunto** (`3742`): se `d.timers.couraca <= 0` → `bruto += 40`, timer 4 s (`1698`).
12. **Céu Dividido** (`6610`): `ceu = tem('6610') && !alvo.tocado`; o crítico é
    `ceu || Math.random() < a.critico`; marca `alvo.tocado = true` (`1699-1701`).
13. **Rei Destruído** (`3153`): `bruto += 0,05 × min(hp atual, 3 × CURVA.hp(nível))` (`1702`).
14. `golpear(estado, c, adEfetivo, alvo, bruto, fonte, { critico })` (`1703`) — **este é o golpe que
    conta para o roubo de vida**, para a Hemorragia e para o evento de dano.
15. Céu Dividido cura `6%` da vida que falta (`1704`).
16. Cutelo Negro (`3071`), Fago (`3044`), Dançarina (`3046`) — §8.3 (`1705-1707`).
17. Lâmina Inquieta (Yasuo D): se o ataque foi crítico → `+1` acúmulo (tecto 5) por 4 s (`1711`).
18. Corte Fantasma (Yasuo F): se `d.fantasma > 0`, até **2** outros alvos levam `bruto × pctCorte[rank]`
    (`0,40 + 0,03/rank`), cada um com o seu sorteio de crítico (`1712-1716`).
19. Runaan (`3085`): até 2 outros, 15%/55% (`1718`).
20. Quebrapassos (`6631`): todos os alcançáveis, `0,8 × AD`, a cada 5 s (`1719`).
21. Hidra Raivosa (`3074`): outros, `0,4 × AD` (`1720`).
22. Hidra Titânica (`3748`): todos os alcançáveis, `1,5% da vida máxima` (`1721`).

### 9.3 Alcance (`ctx.alcancaveis`)

- `alcance = ctx.alcancaveis.filter(i => i.hp > 0)`; `outros = alcance.filter(i => i !== alvo)` (`1709`).
- `alcancaveis = K.distancia ? vivos : prontos` (`1587`): para atiradores (Ezreal, Lux) são **todos os
  vivos**; para corpo a corpo (Darius, Yasuo, Katarina, Taric, Zac) só os que **já chegaram** (`chegada ≤ 0`).
- O ataque principal (`alvo`) é `prontos[0]` para corpo a corpo ou o mais próximo para atiradores (`1446`).

---

## 10. O ataque do monstro e `receberDano`

### 10.1 `inimigoAtaca` (`motor.js:1725-1737`)

```js
i.ataque -= dt * (i.lento > 0 ? 0.6 : 1);
if (i.ataque > 0) return false;
const aura = !i.furioso && c.inimigos.some((o) => o.furioso && o.hp > 0) ? FURIOSO.aura : null;
i.ataque = 1 / (i.as * (aura ? aura.as : 1));
if (Math.random() < a.esquiva) { emitir(c, 'esquiva', {}); return true; }
const defesa = (i.magico ? a.rm : a.armadura)
  * (1 + 0.01 * c.darius.disciplina
     + (c.darius.estandarte > 0 ? c.darius.estandarteDef || 0 : 0)
     + (c.darius.diamante > 0 ? c.darius.diamanteDef || 0 : 0)
     + (c.darius.membrana > 0 ? c.darius.membranaDef || 0 : 0));
receberDano(estado, c, a, mitigar(i.ad * (aura ? aura.ad : 1), defesa), false, i.magico, i);
if (a.tem('3075')) i.hp -= 10 + 0.1 * a.bonusArmadura;
return true;
```

- **Lentidão** (`i.lento`) atrasa a cadência em ×0,6 (ou seja, o monstro ataca mais devagar).
- **Aura do furioso**: se *outro* monstro do grupo está furioso e vivo, todos ganham `ad ×1,25` e
  `as ×1,2` (`FURIOSO.aura`, `motor.js:1106`). O próprio furioso não recebe a aura.
- **Esquiva**: cancelar o golpe **não** cancela o "relógio" (o ataque foi gasto) e não dá dano nenhum.
- **Defesa**: a armadura ou a RM do jogador, multiplicada por
  `(1 + 0,01 × disciplina + estandarteDef + diamanteDef + membranaDef)`.
  - `d.estandarteDef` — B do Darius: `0,20 + 0,04/rank` (`motor.js:680`, `1884`).
  - `d.diamanteDef` — G do Taric: `0,30 + 0,03/rank` (`motor.js:794`, `2366`).
  - `d.membranaDef` — G do Zac: `0,20 + 0,025/rank` (`motor.js:840`, `2518`).
  - Note que é **soma** dentro do parêntese e multiplica a defesa inteira.
- **Espinhos** (`3075`): dano cru, fora de `receberDano` — logo **não** é reduzido pelo papel do
  campeão, não gasta escudo, e acontece **mesmo se o golpe foi absorvido por escudo/invulnerabilidade**.

### 10.2 `receberDano(estado, c, a, dano, doSangramento, magico, origem)` (`motor.js:2693-2735`)

Ordem exacta:

| # | Condição | Efeito | Linha |
|---|---|---|---|
| 1 | `d.invulneravel > 0` | `return` — nada acerta (Zhonya, R do Taric, N do Yasuo, Divisão do Zac) | `2695` |
| 2 | `!doSangramento && origem?.nivel` | `dano *= fatorDanoMonstro(estado, origem)` (§14.3) | `2696` |
| 3 | `!doSangramento` | `dano *= (arena && papel.recebidoArena != null) ? recebidoArena : papel.recebido` | `2697` |
| 4 | `!doSangramento && tem('3102') && timers.banshee <= 0` | `timers.banshee = 40`; emite `item`; **`return`** (golpe todo anulado) | `2698-2700` |
| 5 | `!doSangramento && tem('6333')` | guarda `30%` do dano em `d.sangramentoRecebido` (paga em 3 s; ver §12.5) | `2701-2704` |
| 6 | `!doSangramento && d.vento > 0` | Parede de Vento: se o atacante é de longe e a parede está no caminho → `return`; senão `dano *= 1 − d.ventoRed` (0,30 + 0,02/rank) | `2705-2709` |
| 7 | `!doSangramento && d.quique` | `dano *= 1 − d.quique.reduz` (R do Zac: 0,15 + 0,05/rank) | `2710` |
| 8 | `!doSangramento && d.mitose` | `dano *= 1 − d.mitose.reduz` (M do Zac: 0,35) | `2711` |
| 9 | `!doSangramento && d.diamante > 0 && d.diamanteReflete && origem.hp > 0 && dano > 0` | devolve `dano × d.diamanteReflete` (0,20 + 0,025/rank) ao atacante, como golpe `'G'` | `2712` |
| 10 | `!doSangramento && dano > 0 && kit.fluxo && estado.mana >= a.mana − 0,01` | Fluxo cheio do Yasuo: `d.escudo = max(escudo, escudoFluxo(nivel))` = `80 + 28 × nível`, mana = 0 | `2713-2717`, `697` |
| 11 | `d.escudo > 0` | absorve `min(escudo, dano)`; o resto passa | `2718` |
| 12 | — | `estado.vida -= dano`; emite `'recebido'` (com `frac = dano / vida máx`) | `2719-2721` |
| 13 | `tem('3157') && vida < 25%` | Zhonya: `invulneravel = 2,5`, `timers.zhonya = 120` | `2722-2724` |
| 14 | `tem('3053') && vida < 30%` | Sterak: `escudo = 0,60 × vida bónus`, `timers.sterak = 90` | `2725-2727` |
| 15 | `vida <= 0` | Anjo Guardião (`3026`): vida = 50%, timer 300 s, `return`; senão Divisão do Zac; senão `morrer` | `2728-2734` |

**O que `doSangramento = true` desliga**: os passos 2, 3, 4, 5, 6, 7, 8, 9, 10 — ou seja, sangramento
(Dança da Morte) e queimadura de chefe **não** levam o factor de nível do monstro, **não** levam o
`papel.recebido`, **não** gastam Banshee e **não** são reduzidos por Vento/Quique/Mitose. Continuam a
gastar escudo (11) e a matar (15).

---

## 11. Cura: `curar`, CURA_PVP, roubo de vida

### 11.1 `curar` (`motor.js:1285-1290`)

```js
// motor.js:1284
export const CURA_PVP = 0.65;      // curas em luta contra jogador (habilidades, roubo de vida, Sede)
function curar(estado, c, a, valor) {
  const mult = (a.tem('3065') ? 1.25 : 1) * (c.arena?.combatePvp > 0 ? CURA_PVP : 1);
  const antes = estado.vida;
  estado.vida = Math.min(a.vida, estado.vida + valor * mult);
  if (estado.vida - antes > 1) emitir(c, 'cura', { valor: estado.vida - antes });
}
```

- **Fórmula**: `vida = min(vidaMax, vida + valor × 1,25 [se 3065] × 0,65 [se em combate PvP])`.
- Os dois multiplicadores **multiplicam-se**: com Semblante em PvP → `1,25 × 0,65 = 0,8125`.
- A cura **não passa** pelo `papel` do campeão.
- O `if (> 1)` só evita o evento: a cura em si já foi aplicada.
- `combatePvp` só existe em Runeterra/Arena (`c.arena`), é posto a **6 s** ao acertar/ser acertado por
  jogador (`motor.js:3733`, `arena.js:188`, `195`) e decresce em `arena.js:1483`. **No Rift não há
  redução de cura.**

### 11.2 As fontes de cura (todas passam por `curar`)

| Fonte | Fórmula | Linha |
|---|---|---|
| Roubo de vida (itens) | `dano_do_ataque × a.rouboVida`, **só no ataque básico** | `1226-1228` |
| Sedenta (`3072`) | o excedente vira escudo até 25% da vida máxima | `1229` |
| Fúria Sanguinária (Darius F) | `dano × d.furiaRoubo` (0,12 + 0,03/rank), em qualquer fonte | `1231`, `572`, `1826` |
| Banho de Sangue (Darius F do kit) | `vida × curaSangue[rank]` por ataque em alvo com Hemorragia | `1681`, `677` |
| Sede de Sangue (Katarina G) | `dano_do_golpe_G × 0,30` | `1685` |
| Giro da adaga (Katarina P/D) | `dano_total_do_giro × (0,05 + curaGiro[rank])` | `2169-2170`, `736`, `755` |
| Q do Darius | `(vida que falta) × 0,13 × min(3, inimigos atingidos)` | `1866` |
| Q do Taric | `curaBase[rank] + 0,48 × AP + 0,018 × vida` | `783`, `2345` |
| N do Taric | `25%` do dano causado | `2332`, `811` |
| Pulso do Taric (D) | a cura solta um pulso de dano `cura × pulso[rank]` (0,40 + 0,04/rank) | `2291-2299` |
| F do Lux | `vida × curaPct[rank] + 0,40 × AP` | `655`, `1989` |
| Gosma do Zac | `vida × curaGosma(nivel) + (vida que falta) × curaFalta(nivel)` | `828`, `2414` |
| B do Zac | `vida × curaTotal[rank]` ao longo de 5 s | `850`, `2512` |
| N do Zac | `vida × 0,04 × min(5, inimigos atingidos)` | `854`, `2501` |
| Dança da Morte (`6333`) | `15%` da vida que falta, ao abater | `1790` |
| Céu Dividido (`6610`) | `6%` da vida que falta, no 1.º ataque a cada inimigo | `1704` |
| B do Darius | `vida × cura[rank]` por segundo (0,01 + 0,0015/rank) | `577`, `1380` |
| Fluxo do Yasuo | não é cura: vira escudo (`80 + 28 × nível`) | `697`, `2713-2717` |
| Regeneração natural | `a.regen` por segundo (`motor.js:1356`), ×1,5 com o buff do Barão | `535`, `1355` |

### 11.3 PvP: `aoAcertarJogador` e `danoPvp`

- No PvP o **dano** é calculado pelo servidor; o motor só aplica e cura:
  ```js
  // motor.js:3769-3776
  if (tecla === 'ataque' && a.rouboVida) cura += valor * a.rouboVida;
  if (tecla === 'G' && HK.G?.curaSede) cura += valor * HK.G.curaSede;
  if (cura > 0) curar(estado, c, a, cura);       // ← passa pelo CURA_PVP (0,65)
  ```
- `danoPvp` (`motor.js:3723-3740`): Fluxo cheio vira escudo → escudo absorve → `vida -= valor` →
  Anjo/Zac decidem no servidor → `morrer`.
- **Poção em PvP**: `POCAO_PVP = { cura: 0,30, exaustao: 6 }` (`motor.js:43`) — cura 30% do normal e
  exaustão de 6 s (contra 1 s no Rift, `EXAUSTAO`, `motor.js:41`). Aplicado em `usarPocao`,
  `motor.js:1304-1305`.

---

## 12. Dano ao longo do tempo: hemorragia, queima, veneno, Solar, sangramento

### 12.1 O tecto dos itens de % de vida

```js
// motor.js:1188-1191
export const TETO_VIDA_ITEM = 3;
export const vidaRefItem = (alvo, vida = alvo.hpMax) =>
  Math.min(vida, TETO_VIDA_ITEM * CURVA.hp(alvo.nivel || 1));
```

- A percentagem nunca conta sobre mais de **3 × CURVA.hp(nível do monstro)**.
- `CURVA.hp(n) = (150 + 100n + 1,0n²) × ajuste(n).vida` (`motor.js:274`) — **sem** os multiplicadores
  do monstro (`MONSTROS`, noturno, furioso, chefe). É a vida de um monstro comum daquele nível.
- Usado por: Liandry (`6653`, 1,5%/s), Rei Destruído (`3153`, 5% da vida **atual**), Matéria Instável
  do Zac (W, `pctAlvo`), `motor.js:859`.
- **Porque é que o tecto morde**: um chefe tem `hpMax = 16 × CURVA.hp` (Barão) — o tecto é 3/16 = 18,75%
  da vida do chefe. Ver exemplo §17.2.

### 12.2 Hemorragia (Darius, passiva)

Aplicação (`aplicarHemorragia`, `motor.js:1274-1282`):

```js
alvo.acumulos = c.darius.poder > 0 ? 5 : Math.min(5, alvo.acumulos + 1);
alvo.tSangue = 5;
if (alvo.acumulos === 5 && antes < 5 && c.darius.poder <= 0) { c.darius.poder = 5; emitir(c, 'poder', {}); }
```

- Máximo **5 acúmulos**; cada golpe que acumula repõe `tSangue = 5` s.
- Ao chegar a 5 pela primeira vez → `d.poder = 5` s → `bonusPoder(nivel)` de AD (§7.3).
- Só o Darius tem `hemorragia: true` (`motor.js:870`).

Dano por tick (`motor.js:1631`, `1643-1650`):

```
danoSangue = (13 + 0,3 × bonusAd + 4 × nível) / 5        // por acúmulo, POR SEGUNDO
dano       = mitigar(danoSangue × acumulos × dt, i.armadura × (1 − a.penArmadura))
i.hp -= dano
```

- `bonusAd` é o `adEfetivo.bonusAd` (AD total − AD base), calculado em `motor.js:1428`.
- **Não** usa `reducaoArmadura` (Cutelo Negro) — só a penetração (§4.5).
- **Não** passa por `golpear`: sem crítico, sem `papel.dano`, sem `fatorDanoJogador`, sem roubo de vida.
- O ecrã só mostra o número quando acumula > 25 de dano (`motor.js:1648`).
- Quando `tSangue` chega a 0, `acumulos = 0` (`motor.js:1649`).

### 12.3 Queima (Liandry) e veneno (Katarina F)

Ambos partilham **o mesmo campo** `alvo.queima` (`{dps, t}`):

```js
// Liandry (motor.js:1207): dps = vidaRefItem(alvo) × 0,015; t = 3
// Veneno (motor.js:2155-2156):
dps = mitigar(HF.veneno(rank, a), alvo.armadura × RM_MONSTRO × (1 − penMagica)) × papel.dano;
alvo.queima = { dps: Math.max(alvo.queima?.t > 0 ? alvo.queima.dps : 0, dps), t: HF.venenoT };
```

- **Fica o maior dps** entre os dois, com `t = 3` s (veneno) ou 3 s (Liandry) — não somam.
- O veneno é pré-mitigado (a `mitigar` é aplicada na criação) e **leva `papel.dano`**, mas **não** leva
  `fatorDanoJogador`.
- A queima do Liandry é aplicada **crua** sobre o tecto (sem mitigação nenhuma) — o comentário do item
  diz 1,5% da vida máxima, e é isso mesmo (limitado ao tecto).
- Tick (`motor.js:1652-1655`): `q = min(i.hp, dps × dt)`; `t -= dt`; acumula e mostra um número a cada
  0,5 s ou no fim.

### 12.4 Égide de Fogo Solar (`3068`)

```js
// motor.js:1629, 1633-1639
SOLAR = { base: 3, porNivel: 0.5, vida: 0.003, raio: 2.2 };
dano = 3 + 0,5 × nível + 0,003 × vidaMaxima      // a cada 1 s, por inimigo encostado
golpear(..., dano, 'item', { acumula: false, magico: true })   // poder = false → arm = 0
```

- Alcance: no Rift, quem já chegou (`chegada ≤ 0`); em Runeterra, até **2,2 tiles**.
- Como `poder = false`, a mitigação é **zero** — mas leva `papel.dano`, Grito/Disciplina/Barão e
  `fatorDanoJogador` (passa por `golpear`).
- Não acumula hemorragia (`acumula: false`).

### 12.5 Sangramento da Dança da Morte (`6333`)

- Ao receber dano (`receberDano`, `2701-2704`): `guardado = dano × 0,30`; `dano -= guardado`;
  `d.sangramentoRecebido.push({ total: guardado, resto: guardado })`.
- Pagamento (`motor.js:1431-1438`, em cada passo): cada entrada perde `(total/3) × dt` por segundo,
  somando tudo e chamando `receberDano(..., total, true)` (doSangramento → sem papel/nível/Banshee).
- Ao abater um monstro: limpa a lista e cura 15% da vida que falta (`1790`).

### 12.6 Queimadura dos chefes (sopro, chuva, ácido)

`mecanicaChefe` (`motor.js:3105-3108`):

| Golpe | Dano imediato | Queimadura |
|---|---|---|
| Sopro de Fogo | `mitigar(i.ad × 2,2, a.rm) × fator` (mágico) | `queimando = 4 s`, `queimaDano = 3% da vida máxima/s` |
| Chuva de Fogo | `mitigar(i.ad × 1,8, a.rm) × fator` (mágico) | `queimando = max(3 s)`, `2,5% da vida máxima/s` |
| Ácido Corrosivo | `mitigar(i.ad × 1,2, a.rm) × fator` (mágico) | `queimando = 5 s`, `2,8% da vida máxima/s` |

A queimadura é aplicada em `passo` (`motor.js:1358-1362`): `receberDano(..., d.queimaDano × dt, true)`
— `doSangramento = true`, logo ignora papel e factor de nível.

---

## 13. Dano verdadeiro (execuções)

Dano **verdadeiro** = tira vida directamente, sem `mitigar`, sem `papel.dano`, sem `fatorDanoJogador`,
sem crítico, sem roubo de vida. É sinalizado no evento como `verdadeiro: true`.

| Fonte | Condição | Valor | Linha |
|---|---|---|---|
| **R do Darius** (Guilhotina) | só dispara se `golpe >= alvo.hp`; `golpe = (base[rank] + 0,75 × bonusAd) × (1 + 0,20 × acumulos)`, `base = 125 + 125/rank` | `alvo.hp -= golpe` | `motor.js:562-564`, `1847-1854` |
| **N do Darius** (Mão de Noxus), monstros comuns | `hp < hpMax × limiar[rank]` (`0,20 + 0,03/rank`), e pelo menos 2 alvos (ou chefe presente) | `i.hp = 0` | `motor.js:582`, `1800-1807` |
| **N do Darius**, chefe | sempre que a habilidade é usada | `alvo.hp -= chefe[rank] + bonusAd` (`chefe = 300 + 200/rank`) | `motor.js:582-583`, `1806` |
| **M da Katarina**, execução | `hp < hpMax × executa[rank]` (`0,20 + 0,01/rank`), nunca em chefe | `ferido.hp = 0` (o dano normal do golpe já foi aplicado antes) | `motor.js:765`, `2238-2242` |

> **Atenção à decisão de build**: como o R do Darius não passa por `golpear`, ele **não recebe**
> `papel.dano` (1,10 do Darius) nem o buff do Barão nem o Grito. O número que a UI mostra
> (`HK.R.dano`) é o número que sai.

---

## 14. O monstro: curvas, multiplicadores e diferença de nível

### 14.1 `criarMonstro` (`motor.js:1066-1075`)

```js
hpMax = CURVA.hp(n) × MONSTROS[nome].hp
ad    = CURVA.ad(n) × MONSTROS[nome].ad
as    = MONSTROS[nome].as
armadura = CURVA.armadura(n) × MONSTROS[nome].armadura
ouro  = CURVA.ouro(n) × MONSTROS[nome].ouro × (0,5 + Math.random() × 0,5)
xp    = CURVA.xp(n) × MONSTROS[nome].xp
```

### 14.2 `CURVA` (`motor.js:273-279`) e `ajuste` (`balanco.js`)

```js
ajuste(n) = BALANCO.find(f => n >= f.de && n <= f.ate) || BALANCO[último]
CURVA.hp(n)       = (150 + 100n + 1,0n²) × ajuste(n).vida
CURVA.ad(n)       = (9 + 4,8n + 0,13n²) × ajuste(n).dano
CURVA.armadura(n) = 5 + 1,5n
CURVA.xp(n)       = (30 + 7n) × ajuste(n).xp
CURVA.ouro(n)     = (8 + 3,5n) × ajuste(n).ouro
```

`ajuste` vem de `docs/game-src/balanco.js` (uma linha): faixas de 1-2, 3-4, … 21-60, com `vida` de
0,70 a 1,00 e `dano` de 0,65 a 1,00 (a partir do 21, tudo 1).

### 14.3 Diferença de nível (`NIVEL_DIF`, `motor.js:1180-1187`)

```js
export const NIVEL_DIF = { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3, danoJogador: 0.07, minDanoJogador: 0.25 };
difNivel(estado, m)        = max(0, m.nivel − estado.nivel − 4)
fatorDanoMonstro(estado,m) = dif ? min(3, 1 + 0,15 × dif) : 1        // o monstro bate MAIS
fatorDanoJogador(estado,m) = dif ? max(0,25, 1 − 0,07 × dif) : 1     // o jogador bate MENOS
```

| Níveis acima (além dos 4 livres) | `fatorDanoMonstro` | `fatorDanoJogador` |
|---|---|---|
| 0-4 | 1,00 | 1,00 |
| 5 | 1,15 | 0,93 |
| 10 | 1,50 | 0,30 (piso) |
| 14+ | 3,00 (tecto) | 0,25 (piso) |

- Vale no Rift e em Runeterra, chefes e guardiões incluídos. **Não vale** na Vilemaw nem no PvP
  (`motor.js:1182`).
- `fatorDanoMonstro` é aplicado dentro de `receberDano` (passo 2, `motor.js:2696`) e nas mecânicas de
  chefe (`motor.js:3099-3101`).
- `fatorDanoJogador` é aplicado no fim de `golpear` (`motor.js:1221`) — **todas** as fontes que passam
  por `golpear` o levam (ataques, habilidades, itens, Solar); as que não passam (hemorragia, queima,
  execuções, espinhos) **não**.

### 14.4 Monstros: multiplicadores por espécie (`motor.js:280-298`)

| Monstro | hp | ad | as | armadura | xp | ouro | mágico | distância | chefe |
|---|---|---|---|---|---|---|---|---|---|
| Tropa Corpo a Corpo | 1,0 | 0,90 | 0,80 | 0,6 | 1,0 | 1,0 | — | — | — |
| Tropa Mago | 0,7 | 1,15 | 0,65 | 0,3 | 0,9 | 0,9 | ✔ | 3 | — |
| Tropa de Cerco | 1,8 | 1,50 | 0,50 | 1,2 | 1,6 | 1,8 | — | 4 | — |
| Lobo Gigante | 1,1 | 1,10 | 0,80 | 0,8 | 1,1 | 1,0 | — | — | — |
| Krug Anciã | 1,5 | 0,80 | 0,60 | 1,5 | 1,2 | 1,2 | — | — | — |
| Sentinela Azul | 2,2 | 1,05 | 0,55 | 1,2 | 2,0 | 2,2 | ✔ | — | — |
| Brambleback Vermelho | 2,2 | 1,50 | 0,55 | 1,2 | 2,0 | 2,2 | — | — | — |
| Arraia do Rio | 1,5 | 0,80 | 0,50 | 1,6 | 1,2 | 1,1 | — | — | — |
| Larva do Vazio | 1,1 | 1,05 | 0,80 | 1,0 | 1,1 | 1,0 | ✔ | — | — |
| Cria de Vilemaw | 0,6 | 0,80 | 1,00 | 0,7 | 0,3 | 0,2 | — | — | — |
| Dragão Ancião (filhote) | 1,6 | 1,30 | 0,60 | 1,2 | 1,5 | 1,4 | — | — | — |
| Criatura do Vazio | 1,3 | 1,30 | 0,70 | 1,0 | 1,4 | 1,3 | ✔ | — | — |
| Arauto do Vale | 10 | 2,50 | 0,60 | 1,5 | 12 | 12 | — | — | ✔ |
| Dragão Infernal | 12 | 3,00 | 0,55 | 1,6 | 14 | 14 | ✔ | — | ✔ |
| Barão Nashor | 16 | 3,20 | 0,50 | 1,8 | 20 | 20 | ✔ | — | ✔ |

- `as` = ataques por segundo do monstro → o intervalo entre ataques é `1/as` (com a aura do furioso ×1,2
  e a lentidão ×0,6, §10.1).
- O **primeiro** ataque de cada monstro sai depois de `Math.random() / as` segundos (`motor.js:1072`).
- Monstro `mágico`: ataca com dano mágico → o jogador defende com a **RM** (`motor.js:1733`).

### 14.5 Noturno e Furioso

```js
// motor.js:1096-1101
NOTURNO = { chance: 0.35, hp: 1.4, ad: 1.25, xp: 1.8, ouro: 1.5 };
// motor.js:1106-1111
FURIOSO = { chance: 0.05, hp: 4, ad: 1.5, as: 1.15, xp: 5, ouro: 5, saque: 3, extras: 2,
            aura: { ad: 1.25, as: 1.2 } };
```

- Noturno: `hp ×1,4`, `ad ×1,25`, `xp ×1,8`, `ouro ×1,5` — **a armadura não muda**.
- Furioso: `hp ×4`, `ad ×1,5`, `as ×1,15`, `xp ×5`, `ouro ×5` — **a armadura não muda**.
- Aura do furioso (enquanto vivo): os **outros** do grupo ganham `ad ×1,25` e `as ×1,2` (`motor.js:1729-1730`).
- Nenhum dos dois é chefe; um monstro não é noturno e furioso ao mesmo tempo (`motor.js:1127-1128`).

### 14.6 O buff do Barão

```js
// motor.js:3067
export const BARAO = { duracao: 180, dano: 0.25, regen: 0.5, recall: 2 };
```

- Ao matar o Barão: `estado.buffBarao = 180` s (`motor.js:1784`).
- Durante o buff: **+25% de dano** em tudo o que passa por `golpear` (`motor.js:1211`),
  regeneração natural ×1,5 (`motor.js:1355`) e recall em 2 s (`motor.js:3062`).

---

## 15. DPS: o que existe no motor (e o que não existe)

### 15.1 `dpsTeorico` **não existe no motor**

Procura exaustiva por `dpsTeorico` em todo o repositório: aparece **apenas** em
`docs/build-ideal-final.md`, `docs/pendencias-motor.md` e em ferramentas:
`tools/audit-math.mjs`, `tools/medir-peso-ad.mjs`, `tools/sim-build.mjs`, `tools/sim-chefes.mjs`
(definição em `tools/sim-chefes.mjs:541`).

**O motor não tem nenhuma função de DPS.** O que o jogo mede é o **DPS do último minuto** na aba de
análise (`jogo.js:523-542`), que é uma média do que aconteceu, não uma projecção.

> **NAO VERIFICADO**: não li `jogo.js` nem `tools/sim-chefes.mjs` por inteiro (o meu bloco é o
> `motor.js`); a definição de `dpsTeorico` acima é apenas a localização, não a fórmula. Quem precisar
> da fórmula do `dpsTeorico` tem de ler `tools/sim-chefes.mjs:541-613` — e notar que ela **cita** o
> motor mas é uma reimplementação de ferramenta, não o jogo.

### 15.2 Como calcular o DPS a partir do motor (a conta que o motor faz, por segundo)

```
DPS = Σ_fontes ( dano_médio_por_golpe × golpes_por_segundo )

dano_médio_por_golpe = dano_sem_critico × [ (1 − c) + c × danoCritico ]
                        (c = a.critico, danoCritico = a.danoCritico)
golpes_por_segundo (ataque básico) = velAtaque × M          // §9.1
golpes_por_segundo (habilidade T)  = 1 / (recarga[rank] × (1 − reducaoRecarga))   // motor.js:1581
golpes_por_segundo (DoT)           = dps declarado em §12
```

Cada fonte tem de ser somada com os seus próprios multiplicadores (umas passam por `golpear` e levam
`papel.dano` + `fatorDanoJogador` + Grito/Disciplina/Barão; outras não — §4.5).

**Cadência das habilidades**: `d.recargas[t] = recarga[rank] × (1 − a.reducaoRecarga)` (`motor.js:1581`).
`reducaoRecarga` é `min(0,40, min(0,30, 0,004 × foco) + cdrItens)` (`motor.js:537`).
Só as habilidades **na barra** e com rank são usadas (`motor.js:1578`), e cada uma tem condições de uso
(`motor.js:1798-2660`) — o DPS real depende de a condição se verificar.

### 15.3 O que muda o DPS de um alvo para outro

| Factor | Efeito | Onde |
|---|---|---|
| Armadura do alvo | `mitigar` | §2 |
| `alvo.reducaoArmadura` | Cutelo Negro até 30% | `1705` |
| `a.penArmadura` / `a.penMagica` | penetração | §3.2 |
| Nível do monstro vs jogador | `fatorDanoJogador` (piso ×0,25) | §14.3 |
| Chefe + `3036` | ×1,15 | `1214` |
| `alvo.dominioAmp` | até ×1,30 | `1480` |
| Papel do campeão + Runeterra | ×`papel.dano` ×`papel.arena` | §5.7 |
| Crítico | `c × (danoCritico − 1)` de ganho esperado | §6 |
| Queima/hemorragia | somam por segundo, com os seus próprios tectos | §12 |

---

## 16. Fórmulas de dano das habilidades (apêndice)

Todas as habilidades usam `adEfetivo` (`efetivo`, §7.1). `r` = rank (1 a 10; R/N até 5).
`serie(ini, passo, n=10)` = `ini + passo × i` (`motor.js:550`).
Para os campeões de magia, o resultado vira dano **mágico** automaticamente (`motor.js:1201`).

### 16.1 Darius (`HAB_DARIUS_KIT`, `motor.js:673-688`)

| Tecla | Dano | Notas |
|---|---|---|
| Q | `base[r] + ratio[r] × AD`, base `50 + 30/rank`, ratio `1,00 + 0,05/rank` | cura 13% da vida que falta por inimigo (até 3) |
| W | `mult[r] × AD`, mult `1,40 + 0,05/rank` | vira o ataque básico; lento 2 s |
| R | `(125 + 125/rank + 0,75 × bonusAd) × (1 + 0,20 × acumulos)` | **verdadeiro**, só se mata |
| A | `base[r] + ratio[r] × AD`, base `60 + 30/rank`, ratio `0,80 + 0,05/rank` | atordoa 1 s |
| T | `base[r] + ratio[r] × AD`, base `70 + 35/rank`, ratio `0,90 + 0,04/rank` | área, lento 2 s |
| M | `base[r] + ratio[r] × AD`, base `110 + 55/rank`, ratio `1,00 + 0,06/rank` | ×1,35 se o alvo sangra |
| N | `base[r] + ratio[r] × AD` (área, a cada 0,5 s), base `70 + 35/rank`, ratio `0,35 + 0,05/rank`; chefe: `chefe[r] + bonusAd`, `300 + 200/rank` | executa comuns abaixo de `0,20 + 0,03/rank` |

### 16.2 Ezreal (`HAB_EZREAL`, `motor.js:588-627`)

| Tecla | Dano |
|---|---|
| Q | `40 + 32/rank + (1,30 + 0,06/rank) × AD` |
| W (orbe) | `80 + 35/rank + (0,60 + 0,05/rank) × AD`; devolve `40 + 6/rank` de mana |
| E | `80 + 30/rank + (0,50 + 0,05/rank) × AD` |
| R | `300 + 150/rank + (1,00 + 0,10/rank) × AD` |
| A | `60 + 30/rank + (0,80 + 0,05/rank) × AD`; o 1.º leva +30% |
| F (marca) | `40 + 22/rank + (0,40 + 0,04/rank) × AD` |
| T | `45 + 24/rank + (0,55 + 0,035/rank) × AD`; +6 bolinhas de 20% |
| B (portal/isca) | `60 + 22/rank + (0,45 + 0,03/rank) × AD`; isca: 5 tiros de `0,30 + 0,02/rank × AD` |
| M (ricochete) | `30 + 15/rank + (0,35 + 0,025/rank) × AD`, cada salto ×`(1,15)^k` |
| N (Apogeu) | `300 + 150/rank + (1,20 + 0,15/rank) × AD`; impacto `220 + 110/rank + (0,90 + 0,10/rank) × AD`; chefe: +`(0,03 + 0,01/rank) × vida máxima` |
| D (passiva) | `bonusEzreal` (§7.2) |

### 16.3 Lux (`HAB_LUX`, `motor.js:633-668`) — tudo escala com AP (`apDe`)

| Tecla | Dano |
|---|---|
| P (Iluminação) | `20 + 10 × nível + 0,20 × AP` (explode no próximo ataque) |
| Q | `115 + 45/rank + (0,65 + 0,04/rank) × AP` |
| E | `115 + 45/rank + (0,65 + 0,04/rank) × AP` |
| R | `300 + 150/rank + (1,00 + 0,10/rank) × AP` |
| A | `100 + 38/rank + (0,75 + 0,04/rank) × AP` |
| D (prisma) | `70 + 35/rank + (0,40 + 0,03/rank) × AP`, 3 raios a cada 3 habilidades |
| T | `130 + 55/rank + (0,85 + 0,04/rank) × AP` |
| M | `140 + 55/rank + (0,90 + 0,05/rank) × AP`, 3 meteoros, respingo 45% |
| N | `260 + 115/rank + (0,95 + 0,11/rank) × AP`, 3 s, um golpe a cada 0,5 s |

### 16.4 Yasuo (`HAB_YASUO`, `motor.js:696-729`)

| Tecla | Dano |
|---|---|
| Q | `40 + 20/rank + 0,55 × AD`; recarga `max(1,5, recarga / max(1, (velAtaque × (1+ventania)) / 0,697))` |
| E | `50 + 18/rank + (0,20 + 0,01/rank) × AD`, ×`(1 + 0,25 × acúmulos)` (até 2) — **mágico sem mitigação** |
| R | `200 + 110/rank + (1,00 + 0,08/rank) × AD` |
| A | `60 + 30/rank + (0,80 + 0,05/rank) × AD` |
| T | `70 + 35/rank + (0,90 + 0,04/rank) × AD` |
| M | `110 + 55/rank + (1,00 + 0,06/rank) × AD` |
| N | `60 + 30/rank + (0,50 + 0,06/rank) × AD`, 10 cortes em 2,5 s |
| F (corte) | `bruto × (0,40 + 0,03/rank)` em até 2 alvos |

### 16.5 Katarina (`HAB_KATARINA`, `motor.js:735-771`) — AP

| Tecla | Dano |
|---|---|
| P (Voracidade/giro) | `30 + 19 × nível + 1,00 × AP + 0,40 × max(0, AD − AD base)` |
| Q | `80 + 35/rank + (0,45 + 0,03/rank) × AP` |
| E | `40 + 20/rank + (0,30 + 0,02/rank) × AP + 0,40 × AD` |
| R | `30 + 14/rank + (0,25 + 0,03/rank) × AP`, 15 golpes em 2,5 s |
| G (Sede) | `30 + 15/rank + (0,30 + 0,015/rank) × AP`, cura 30% |
| A | `90 + 35/rank + (0,60 + 0,035/rank) × AP` |
| F (veneno) | `40 + 18/rank + 0,25 × AP` por segundo, 3 s |
| T | `60 + 28/rank + (0,40 + 0,03/rank) × AP`, 3 adagas |
| M | `200 + 80/rank + (1,20 + 0,07/rank) × AP`; executa abaixo de `0,20 + 0,01/rank` |
| N | `90 + 40/rank + (0,45 + 0,05/rank) × AP`, 12 golpes em 3 s |

### 16.6 Taric (`HAB_TARIC`, `motor.js:778-814`) — AP

| Tecla | Dano |
|---|---|
| P (Bravata) | `30 + 12 × nível + 0,15 × AP + 0,40 × armadura bónus` |
| Q | `60 + 26/rank + (0,35 + 0,02/rank) × AP`; cura `64 + 29/rank + 0,48 × AP + 0,018 × vida` |
| W | `70 + 28/rank + (0,40 + 0,02/rank) × AP` |
| E | `110 + 45/rank + (0,50 + 0,03/rank) × AP` |
| A | `90 + 35/rank + (0,60 + 0,035/rank) × AP` |
| T | `110 + 48/rank + (0,70 + 0,04/rank) × AP` |
| M | `130 + 55/rank + (0,85 + 0,05/rank) × AP` |
| N | `320 + 140/rank + (1,10 + 0,12/rank) × AP`; cura 25% do dano |

### 16.7 Zac (`HAB_ZAC`, `motor.js:826-856`) — AP **e** vida máxima (`ratioVida`)

| Tecla | Dano |
|---|---|
| Q | `30 + 66/rank + (0,40 + 0,03/rank) × AP + 0,025 × vida`; com 1 alvo ×`solo[rank]` (1,5 → 2,2) |
| W | `90 + 4/rank + 0,35 × AP + (0,02) × vidaRefItem(alvo)` |
| E | `100 + 56/rank + (0,75 + 0,04/rank) × AP + 0,02 × vida` |
| R | `200 + 80/rank + (0,45 + 0,05/rank) × AP + 0,015 × vida` |
| A | `80 + 32/rank + (0,50 + 0,03/rank) × AP + 0,015 × vida` |
| F | `22 + 10/rank + (0,10 + 0,008/rank) × AP + 0,003 × vida` a cada 0,5 s |
| T | `245 + 57/rank + (1,38 + 0,05/rank) × AP + 0,03 × vida` |
| M | `30 + 14/rank + (0,15 + 0,01/rank) × AP + 0,004 × vida` |
| N | `1000 + 300/rank + (2,60 + 0,20/rank) × AP + 0,10 × vida` |

### 16.8 Mascotes (`motor.js:3517-3532`)

```js
basePet = a.ad + (kit(estado).magia ? 0,5 × AP : 0)          // 3532
Dragãozinho: dano = basePet × (0,25 + 0,03 × nível do mascote), a cada 2,5 s
Aranhinha:   dano = basePet × (0,22 + 0,025 × nível), a cada 3 s
```

Fonte `'pet'` → **nunca é promovida a mágica** (`motor.js:1201` exclui `'pet'`) → mesmo num campeão de
magia o mascote bate **físico** (mitigado pela armadura do alvo).

---

## 17. Exemplos numéricos derivados

> Aritmética derivada das fórmulas acima (não lida de nenhum save nem do jogo). Serve para conferir
> quem recalcular.

### 17.1 Um ataque básico de Darius, nível 1, sem itens

- `g(1) = 0` → `ad = 64` (`motor.js:870`), `baseAd = 64`.
- `arm = armadura do alvo × 1 × 1`; contra uma Tropa Corpo a Corpo nível 1:
  `armadura = (5 + 1,5) × 0,6 = 3,9` (`motor.js:276`, `281`).
- `D0 = 64 × 100/103,9 = 61,60`.
- `D1 = 61,60 × 1 = 61,60` (sem Grito, sem Disciplina, sem Barão).
- `D2 = 61,60 × 1,10 = 67,76` (papel.dano do Darius; no Rift `papel.arena` não entra).
- `DANO = 67,76 × fatorDanoJogador` (nível 1 vs nível 1 → 1) = **67,76 por auto**.
- Cadência: `velAtaque = 0,625 × (1 + 0,01 × 0) = 0,625/s` → **42,3 DPS** de auto (sem crítico).

### 17.2 O tecto do Rei Destruído num Barão nível 40

- `CURVA.hp(40) = (150 + 4000 + 1600) × 1 = 5750` (`ajuste(40).vida = 1`, `balanco.js`).
- Tecto: `3 × 5750 = 17250` (`motor.js:1190-1191`).
- Barão: `hpMax = 5750 × 16 = 92000` (`motor.js:297`).
- 5% do tecto: `0,05 × 17250 = **862,5**` por auto — e não 5% de 92000 = 4600.
- Com crítico (×1,75) esse extra passa a 1509 — o crítico multiplica **todo** o bruto (`motor.js:1703`, `1213`).

### 17.3 Roubo de vida: quanto cura por segundo

- `cura_por_auto = DANO_do_auto × rouboVida` (`motor.js:1226-1228`), só no ataque básico.
- Com a Sedenta por Sangue (`3072`, 15% base × refino/qualidade) num auto de 1000 de dano:
  `1000 × 0,15 = 150` de cura por auto.
- Com 1 ataque por segundo → **150 cura/s**; com 2/s → 300/s.
- O que passar da vida máxima vira escudo, tecto **25% da vida máxima** (`motor.js:1229`).

### 17.4 Hemorragia do Darius: dano por segundo no pico

- Fórmula (`motor.js:1631`): `(13 + 0,3 × bonusAd + 4 × nível)/5` **por acúmulo**.
- Nível 50 com 300 de AD total e 255 de base → `bonusAd = 45`:
  `(13 + 13,5 + 200)/5 = 45,3` por acúmulo por segundo.
- 5 acúmulos → `226,5` de dano bruto por segundo, depois `mitigar` pela armadura × (1 − pen).

### 17.5 A queimadura do Liandry num Barão nível 40

- `dps = vidaRefItem(alvo) × 0,015 = 17250 × 0,015 = 258,75` por segundo durante 3 s (`motor.js:1207`).
- Sem mitigação (aplicado directo a `i.hp`, `motor.js:1653`) e sem `fatorDanoJogador`.
- Contra um monstro comum nível 40 (hpMax 5750): o tecto não morde e o dps seria `5750 × 0,015 = 86,25`.

---

## 18. O que NÃO foi possível verificar

1. **Stats base de 5 campeões** — `motor.js:3-8` importa `dados-ezreal.js`, `dados-yasuo.js`,
   `dados-lux.js`, `dados-katarina.js`, `dados-taric.js`, `dados-zac.js`. **Existem** `dados.js`
   (Darius) e `dados-katarina.js` (Katarina — este último foi acrescentado por outro agente
   **durante** esta sessão; o documento foi corrigido depois de escrito, porque a lista de ficheiros
   do repositório mudou a meio). **Não existem**: `dados-ezreal.js`, `dados-yasuo.js`,
   `dados-lux.js`, `dados-taric.js`, `dados-zac.js`. Para Ezreal, Lux, Yasuo, Taric e Zac, os campos
   `hp, hpperlevel, mp, mpperlevel, armor, armorperlevel, spellblock, hpregen, mpregen, attackspeed`
   estão **NAO VERIFICADO**. O que **está** verificado para eles é o `adBase`/`adNivel` e o `papel`
   (`KITS`, `motor.js:870-894`) e todas as fórmulas de habilidade.
2. **Dano de PvP** — o motor diz explicitamente *"o servidor calcula o dano"* (`motor.js:1195`, `3722`).
   As funções `danoPvp`/`aoAcertarJogador` só **aplicam** o valor que chega. A fórmula do servidor não
   está neste repositório (não há pasta `servidor/` nem `js/`). Os campos `papel.pvp` e
   `papel.pvpRecebido` existem nos `KITS` mas **não são lidos por nenhuma linha do motor** — quem os
   deve ler é o servidor: **NAO VERIFICADO** onde.
3. **`dpsTeorico`** — não existe no motor (§15.1). Existe em ferramentas (`tools/sim-chefes.mjs:541`),
   que não li por inteiro (fora do meu bloco).
4. **`arena.js`** — li apenas os excertos necessários para confirmar `combatePvp` (`arena.js:186-200`,
   `1483`) e o fluxo de PvP (`arena.js:1590-1610`). As fórmulas de Runeterra (guardiões, Vilemaw) estão
   fora do meu bloco.
5. **`i18n.js`, `balanco.js`, `itens.js`** — li o que é necessário; `balanco.js` foi lido por inteiro
   (uma linha de dados).

---

## 19. Pontos que precisam de regra do dono

Nada nesta secção é uma mecânica que o motor já decida — são escolhas que o motor deixa em aberto ou
que dependem de código fora deste repositório:

1. **PvP (fórmula do servidor)** — o motor aplica, não calcula. Para a função de decisão
   `(campeão, nível, inventário, região) → (build, barra, poções, resultado esperado)` cobrir PvP, é
   preciso o código do servidor (ou uma regra do dono que diga como o dano de PvP é calculado).
   **PRECISA DE REGRA DO DONO** (ou do ficheiro do servidor).
2. **Ordem de prioridade quando duas fontes de cura/dano competem** — o motor decide por código
   (ex.: `queima` fica com o **maior dps**, não soma). Não é política; fica modelado.
3. **Os 6 ficheiros de dados em falta** — se a decisão de build tiver de usar vida/armadura base reais
   desses campeões, é preciso que os ficheiros existam no repositório. **PRECISA DE REGRA DO DONO**
   (onde os obter) ou de leitura do sítio onde o jogo corre.

---

*Documento escrito a partir de `docs/game-src/motor.js` (leitura integral, 1-3792),
`docs/game-src/itens.js`, `docs/game-src/balanco.js` e `docs/game-src/dados.js`.
Nenhuma afirmação sem `ficheiro:linha`. Sem browser, sem CDP, sem jogo a correr.*
