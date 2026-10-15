# 01 — Constantes, curvas e itens (motor.js)

> **Fonte única:** `docs/game-src/motor.js` (3791 linhas) + `docs/game-src/itens.js` (2583 linhas, 108 itens) + `docs/game-src/balanco.js` (BALANCO, 11 faixas).
> Lido de fio a pavio. Nada aqui vem de outro documento, da extensão ou de memória.
> Projecto: **I:\\!lolidle.com** — jogo em https://lolidle.com/jogar. Bloco 1 de N: constantes, curvas e itens.
>
> **Como usar:** quem ler este documento tem de conseguir **recalcular o jogo sem voltar a ler o motor**.
> Todas as fórmulas estão escritas com números e limites. Onde uma conta depende de dados que não
> estão em motor.js (estatísticas-base de cada campeão, tabelas do servidor), está marcado
> **NAO VERIFICADO** ou remetido para outro bloco.
>
> **Notação:** `file:linha` aponta para a linha exacta do ficheiro com o número. Ex.: `motor.js:274`.

---

## 0. Índice

1. Constantes globais (topo do ficheiro)
2. A CURVA — hp, ad, armadura, xp, ouro por nível
3. MONSTROS — catálogo e coeficientes
4. Drops: chances e saque por zona
5. POÇÕES e rotinas
6. ITENS — catálogo completo dos 108
7. Qualidade, refino e os remendos do motor (linhas 16-26)
8. `infoItem` campo a campo (251-255)
9. Preços: `precoRefino`, `valorVenda`, `valorEquip`, `poder`
10. Espaços, mochila e regras de equipamento
11. Onde cada item é usado no motor (os casos `tem('id')`)
12. Tabela de todos os números (índice rápido)
13. O que NÃO foi verificado e o que fica para outro bloco

---

## 1. Constantes globais (motor.js:13-165)

| Nome | Valor | Linha | Para que serve |
|---|---|---|---|
| `NIVEL_MAX` | 50 | 27 | nível máximo do campeão |
| `ESPAÇOS` | 5 | 28 | itens equipados no total (1 bota + 4 outros) |
| `ESPAÇOS_ITENS` | 4 | 29 | espaços para itens que **não** são bota |
| `ESPAÇOS_EQUIP` | arma, armadura, cabeca, mao, botas, acessorio | 31 | tipos possíveis (ordem) |
| `NOME_ESPACO` | Arma / Armadura / Cabeça / Mão esquerda / Botas / Acessório | 32 | nomes na tela |
| `espacoDe(x)` | `ITENS[baseId(x)]?.espaco` | 33 | tipo de um item |
| `MOCHILA_INICIO` | 20 | 35 | espaços da mochila no nível 1 |
| `MOCHILA_GANHO` | { niveis: 5, espacos: 2 } | 35 | +2 espaços a cada 5 níveis |
| `MOCHILA` | 40 | 37 | máximo (no nível 50) |
| `RECALL` | 4 s | 40 | tempo de voltar à base |
| `EXAUSTAO` | 1 s | 41 | espera mínima entre poções (contra monstros) |
| `POCAO_PVP` | { cura: 0.3, exaustao: 6 } | 43 | poção cura 30% e espera 6 s em luta PvP |
| `PILHA` | 1000 | 341 | espólios por pilha (1 espaço cada 1000) |
| `VEL_ATAQUE_MAX` | 3,0 | 344 | tecto de velocidade de ataque |
| `REFINO_MAX` | 5 | 54 | refino máximo (+5) |
| `BONUS_REFINO` | 0,12 | 55 | +12% em todos os bónus por nível de refino |
| `ARENA.bonus` | 1,3 | 412 | +30% de XP e de chance de drop em Runeterra |
| `GRUPO` | { max: 4, raio: 15, porMembro: 0,15 } | 143 | grupo: até 4, cada membro vivo a 15 tiles dá +15% de XP |
| `VIP` | { boasVindas: 2, xp: 1,2, drop: 1,2, refino: 1,2, refinoMax: 0,5, preco: 200, dias: 30 } | 145 | +20% de XP, de drop e de chance de refino; 2 dias de boas-vindas |

**Fórmulas da mochila** (motor.js:36 e 39):

```
mochilaDe(nivel)      = 20 + 2 × floor(min(max(nivel,1),50) / 5)      → 20 a 40
nivelDoEspaco(k)      = 1                                se k < 20
                       5 × ceil((k + 1 − 20) / 2)         caso contrário
espacosEspolios(e)    = Σ ceil(quantidade / 1000)
espacosLivres(e)      = mochilaDe(e.nivel) − e.mochila.length − espacosEspolios(e)
mochilaCheia(e)       = espacosLivres(e) <= 0
```

---

## 2. A CURVA (motor.js:273-279) — a fórmula EXACTA

Todo monstro segue a mesma curva; cada espécie multiplica-a (ver §3). Primeiro o **ajuste por faixa de
nível**, que vem da planilha `balanco.csv` (`balanco.js`): uma faixa por par de níveis até ao 20;
do 21 ao 60 tudo 1.

```js
ajuste(n) = BALANCO.find(f => n >= f.de && n <= f.ate) || BALANCO[BALANCO.length − 1]   // motor.js:272
```

A curva (motor.js:273-279), **n = nível**:

```js
hp       (n) = (150 + 100×n + 1.0×n²) × ajuste(n).vida
ad       (n) = ( 9  + 4.8×n + 0.13×n²) × ajuste(n).dano
armadura (n) = 5 + 1.5×n                       ← NÃO tem ajuste
xp       (n) = (30 + 7×n)            × ajuste(n).xp
ouro     (n) = ( 8 + 3.5×n)          × ajuste(n).ouro
```

A tabela de ajuste completa (de `balanco.js`, todos os campos):

| níveis (de–ate) | vida | dano | xp | ouro | xpUpar | drop |
|---|---|---|---|---|---|---|
| 1–2 | 0,7 | 0,65 | 1 | 1,5 | 0,04 | 3 |
| 3–4 | 0,72 | 0,68 | 1 | 1,45 | 0,05 | 2,8 |
| 5–6 | 0,75 | 0,72 | 1 | 1,4 | 0,08 | 2,6 |
| 7–8 | 0,79 | 0,76 | 1 | 1,35 | 0,15 | 2,4 |
| 9–10 | 0,83 | 0,8 | 1 | 1,3 | 0,3 | 2,2 |
| 11–12 | 0,86 | 0,84 | 1 | 1,25 | 0,5 | 2 |
| 13–14 | 0,89 | 0,88 | 1 | 1,2 | 0,6 | 1,8 |
| 15–16 | 0,92 | 0,91 | 1 | 1,15 | 0,7 | 1,6 |
| 17–18 | 0,95 | 0,94 | 1 | 1,1 | 0,8 | 1,4 |
| 19–20 | 0,98 | 0,97 | 1 | 1,05 | 0,9 | 1,2 |
| 21–60 | 1 | 1 | 1 | 1 | 1 | 1 |

### 2.1 A curva já calculada, nível a nível (1 a 50)

Valores **com** o ajuste aplicado. É esta a tabela a usar no simulador.

| n | hp | ad | armadura | xp | ouro | xp para subir |
|---|---|---|---|---|---|---|
| 1 | 175,7 | 9,05 | 6,5 | 37 | 17,25 | 762 |
| 2 | 247,8 | 12,43 | 8 | 44 | 22,5 | 984 |
| 3 | 330,48 | 16,71 | 9,5 | 51 | 26,83 | 1570 |
| 4 | 407,52 | 20,59 | 11 | 58 | 31,9 | 2000 |
| 5 | 506,25 | 26,1 | 12,5 | 65 | 35,7 | 4050 |
| 6 | 589,5 | 30,59 | 14 | 72 | 40,6 | 5100 |
| 7 | 710,21 | 37,22 | 15,5 | 79 | 43,88 | 12000 |
| 8 | 801,06 | 42,35 | 17 | 86 | 48,6 | 15000 |
| 9 | 938,73 | 50,18 | 18,5 | 93 | 51,35 | 37200 |
| 10 | 1037,5 | 56 | 20 | 100 | 55,9 | 46200 |
| 11 | 1179,06 | 65,13 | 21,5 | 107 | 58,13 | 95200 |
| 12 | 1284,84 | 71,67 | 23 | 114 | 62,5 | 118000 |
| 13 | 1440,91 | 82,17 | 24,5 | 121 | 64,2 | 174000 |
| 14 | 1553,94 | 89,48 | 26 | 128 | 68,4 | 213000 |
| 15 | 1725 | 100,33 | 27,5 | 135 | 69,57 | 305000 |
| 16 | 1845,52 | 108,36 | 29 | 142 | 73,6 | 374000 |
| 17 | 2032,05 | 120,48 | 30,5 | 149 | 74,25 | 523000 |
| 18 | 2160,3 | 129,27 | 32 | 156 | 78,1 | 638000 |
| 19 | 2362,78 | 142,72 | 33,5 | 163 | 78,23 | 875000 |
| 20 | 2499 | 152,29 | 35 | 170 | 81,9 | 1070000 |
| 21 | 2691 | 167,13 | 36,5 | 177 | 81,5 | 1440000 |
| 22 | 2834 | 177,52 | 38 | 184 | 85 | 1750000 |
| 23 | 2979 | 188,17 | 39,5 | 191 | 88,5 | 2120000 |
| 24 | 3126 | 199,08 | 41 | 198 | 92 | 2570000 |
| 25 | 3275 | 210,25 | 42,5 | 205 | 95,5 | 3120000 |
| 26 | 3426 | 221,68 | 44 | 212 | 99 | 3780000 |
| 27 | 3579 | 233,37 | 45,5 | 219 | 102,5 | 4570000 |
| 28 | 3734 | 245,32 | 47 | 226 | 106 | 5520000 |
| 29 | 3891 | 257,53 | 48,5 | 233 | 109,5 | 6660000 |
| 30 | 4050 | 270 | 50 | 240 | 113 | 8040000 |
| 31 | 4211 | 282,73 | 51,5 | 247 | 116,5 | 9690000 |
| 32 | 4374 | 295,72 | 53 | 254 | 120 | 11700000 |
| 33 | 4539 | 308,97 | 54,5 | 261 | 123,5 | 14100000 |
| 34 | 4706 | 322,48 | 56 | 268 | 127 | 16900000 |
| 35 | 4875 | 336,25 | 57,5 | 275 | 130,5 | 20400000 |
| 36 | 5046 | 350,28 | 59 | 282 | 134 | 24500000 |
| 37 | 5219 | 364,57 | 60,5 | 289 | 137,5 | 29400000 |
| 38 | 5394 | 379,12 | 62 | 296 | 141 | 35400000 |
| 39 | 5571 | 393,93 | 63,5 | 303 | 144,5 | 42500000 |
| 40 | 5750 | 409 | 65 | 310 | 148 | 51000000 |
| 41 | 5931 | 424,33 | 66,5 | 317 | 151,5 | 61100000 |
| 42 | 6114 | 439,92 | 68 | 324 | 155 | 73300000 |
| 43 | 6299 | 455,77 | 69,5 | 331 | 158,5 | 87900000 |
| 44 | 6486 | 471,88 | 71 | 338 | 162 | 105000000 |
| 45 | 6675 | 488,25 | 72,5 | 345 | 165,5 | 126000000 |
| 46 | 6866 | 504,88 | 74 | 352 | 169 | 151000000 |
| 47 | 7059 | 521,77 | 75,5 | 359 | 172,5 | 181000000 |
| 48 | 7254 | 538,92 | 77 | 366 | 176 | 216000000 |
| 49 | 7451 | 556,33 | 78,5 | 373 | 179,5 | 259000000 |
| 50 | 7650 | 574 | 80 | 380 | 183 | 309000000 |

**Exemplo de leitura:** um monstro de nível 48 tem `hp` base 7254,00 e `ad` base 538,92. Uma
"Tropa Corpo a Corpo" (coeficiente hp 1) nesse nível tem 7254,00 de vida; o Barão (hp 16) tem 116.064,00.

**XP para subir de nível** (motor.js:427-429) — usada por `ganharXp` (2795-2810) e `perdaPorMorte` (430):

```
RITMO_XP(n)  = 43000 + 4345×(n−1) + 17.9×(n−1)²
tres(v)      = round(v / 10^max(0, floor(log10(v)) − 2)) × 10^…     ← arredonda a 3 algarismos
xpParaNivel(n) = tres(RITMO_XP(n) × 0.4433 × 1.1715^(n−1) × ajuste(n).xpUpar)
```

Consequências úteis:

- Subir um nível dá **1 ponto** de habilidade e **3 pontos** de atributo (`PONTOS_POR_NIVEL = 3`, 483; 2801-2802).
- Morrer custa 10% da XP do nível actual: `perdaPorMorte(e) = round(xpParaNivel(e.nivel) × 0.1)` (430).
- A XP acumulada do nível 1 ao 50 soma ≈ **1,55997×10⁹** (verificado somando `xpParaNivel(1..49)` com a fórmula acima).

### 2.2 Factores de XP e de saque (motor.js:421-424)

```js
fatorXp(nivelJogador, nivelMonstro):
    dif = nivelJogador − nivelMonstro
    if (dif > 5) return max(0.1, 1 − 0.1×(dif − 5))     // −10% por nível abaixo, piso 10%
    return 1
fatorSaque = fatorXp                                       // mesma regra para itens, ouro, espólios, gemas
```

### 2.3 Diferença de nível (motor.js:1180-1191)

```js
NIVEL_DIF = { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3, danoJogador: 0.07, minDanoJogador: 0.25 }

difNivel(e, m)         = max(0, m.nivel − e.nivel − 4)              // 4 níveis acima é "livre"
fatorDanoMonstro(e, m) = dif ? min(3, 1 + 0.15×dif) : 1            // monstro forte bate até 3×
fatorDanoJogador(e, m) = dif ? max(0.25, 1 − 0.07×dif) : 1         // o jogador faz menos dano (piso 25%)

TETO_VIDA_ITEM = 3
vidaRefItem(alvo, vida = alvo.hpMax) = min(vida, 3 × CURVA.hp(alvo.nivel || 1))
```

`fatorDanoJogador` multiplica o dano do jogador (1221); `fatorDanoMonstro` multiplica o dano que o
monstro faz (2696 e 3099). Conta no Rift e em Runeterra, chefes e guardiões; **não** conta na Vilemaw
nem no PvP (1182).

---

## 3. MONSTROS (motor.js:280-298) — catálogo e coeficientes

Cada monstro é criado por `criarMonstro(nome, n)` (1066-1075) com:

```js
hpMax    = CURVA.hp(n)      × m.hp
hp       = hpMax
ad       = CURVA.ad(n)      × m.ad
as       = m.as                                   ← velocidade de ataque NÃO vem da curva
armadura = CURVA.armadura(n) × m.armadura
ouro     = CURVA.ouro(n) × m.ouro × (0.5 + Math.random()×0.5)     // 50% a 100% do valor
xp       = CURVA.xp(n)   × m.xp
ataque   = Math.random() / m.as                  // relógio inicial do primeiro golpe
```

### 3.1 Tabela de coeficientes

| Monstro | hp | ad | as | armadura | xp | ouro | mágico | distância | chefe |
|---|---|---|---|---|---|---|---|---|---|| Tropa Corpo a Corpo | 1 | 0,9 | 0,8 | 0,6 | 1 | 1 | — | — | — |
| Tropa Mago | 0,7 | 1,15 | 0,65 | 0,3 | 0,9 | 0,9 | sim (magico) | 3 | — |
| Tropa de Cerco | 1,8 | 1,5 | 0,5 | 1,2 | 1,6 | 1,8 | — | 4 | — |
| Lobo Gigante | 1,1 | 1,1 | 0,8 | 0,8 | 1,1 | 1 | — | — | — |
| Krug Anciã | 1,5 | 0,8 | 0,6 | 1,5 | 1,2 | 1,2 | — | — | — |
| Sentinela Azul | 2,2 | 1,05 | 0,55 | 1,2 | 2 | 2,2 | sim (magico) | — | — |
| Brambleback Vermelho | 2,2 | 1,5 | 0,55 | 1,2 | 2 | 2,2 | — | — | — |
| Arraía do Rio | 1,5 | 0,8 | 0,5 | 1,6 | 1,2 | 1,1 | — | — | — |
| Larva do Vazio | 1,1 | 1,05 | 0,8 | 1 | 1,1 | 1 | sim (magico) | — | — |
| Cria de Vilemaw | 0,6 | 0,8 | 1 | 0,7 | 0,3 | 0,2 | — | — | — |
| Dragão Ancião (filhote) | 1,6 | 1,3 | 0,6 | 1,2 | 1,5 | 1,4 | — | — | — |
| Criatura do Vazio | 1,3 | 1,3 | 0,7 | 1 | 1,4 | 1,3 | sim (magico) | — | — |
| Arauto do Vale | 10 | 2,5 | 0,6 | 1,5 | 12 | 12 | — | — | sim |
| Dragão Infernal | 12 | 3 | 0,55 | 1,6 | 14 | 14 | sim (magico) | — | sim |
| Barão Nashor | 16 | 3,2 | 0,5 | 1,8 | 20 | 20 | sim (magico) | — | sim |

Leitura: `as` é a velocidade de ataque em golpes por segundo (0,8 = 1 golpe a cada 1,25 s).
`distancia` só aparece nos que atacam de longe: param a essa distância e atiram (283).

### 3.2 Arredondamentos e detalhes

- O **ouro** tem sorteio 0,5–1,0 (1071). Para a média use **0,75×** o valor da tabela.
- `as` não é multiplicado pela curva: é o valor puro da tabela (1070).
- A `armadura` do monstro usa a curva **sem ajuste** (1070).
- **Noturno** (1096-1101): hp ×1,40, ad ×1,25, xp ×1,80, ouro ×1,50; nasce em 35% dos grupos à noite (1128).
- **Furioso** (1106-1111): hp ×4, ad ×1,50, as ×1,15, xp ×5, ouro ×5; saque sorteado 3×, espólios 2× (1113); nasce em 5% dos grupos (1124). Aura nos outros: ad ×1,25, as ×1,20 enquanto vivo (1106, 1729).
- **Chefe**: nasce ao nível do jogador +4 (limitado ao topo da zona +2), 1,5% de chance por grupo, `chegada = 1.8` (1121).
- **Invocado** (larva do Barão): não dá loot, nem XP, nem conta em tarefas (1770, 1786, 3403).
- Grupo: 2 a 4 monstros (`2 + floor(random()×3)`, 1124), com `chegada = 1,2 + k×0,25` s (1126).
- **Respawn**: 1,5 s depois do grupo limpo (1625); ao viajar, 1,2 s (3046).

### 3.3 O que o monstro faz quando acerta

```js
i.ataque −= dt × (lento > 0 ? 0.6 : 1)          // lentidão = 40% mais lento (1726)
defesa   = (i.magico ? a.rm : a.armadura) × (1 + disciplina + estandarte + diamante + membrana)
dano     = mitigar(i.ad × (aura ? 1.25 : 1), defesa)

mitigar(dano, armadura) = dano × 100 / (100 + max(0, armadura))     // motor.js:1167
```

`RM_MONSTRO = 0.6` (1179): a resistência mágica de um monstro é **60% da armadura** dele. O dano
mágico do jogador é mitigado por `alvo.armadura × 0.6 × (1 − penMagica)` (1202).

### 3.4 Espólios (motor.js:304-338)

O valor de cada espólio segue o ouro da zona: `valorEsp(nivelRef, mult) = round(0.6 × CURVA.ouro(nivelRef) × mult)` (304).
Tabela em §4.5.

---

## 4. Drops: chances e saque (motor.js:1133-1165)

### 4.1 As tabelas brutas

```js
NIVEL_DO_TIER = { 0:5, 1:10, 2:15, 3:20, 4:25, 5:30, 6:35, 7:45 }   // nível de referência de cada tier (1138)

K             = ajuste(nivelDoTier).drop                            // factor da planilha
LENDARIO_TIER = [1, 1, 1.4, 2.7, 2.8, 2.5, 2.5, 2.3]                 // Rota-Inf … Barão (1142)

BRUTO(tier):
  lendario = 4×10⁻⁵ × 4^(tier/7) × K × LENDARIO_TIER[tier]
  epico    = (0.0005 + 0.00015×tier) × K
  basico   = (0.012  − 0.0005×tier)  × K

DROP_CHEFE = { lendario: 0.001, epico: 0.05, basico: 0.4 }           // 0,1% / 5% / 40% (1145)
```

E `chancesDrop(local, mult)` (1146-1149) transforma em probabilidades exclusivas:

```js
l = min(1, lendario × mult)
e = min(1, epico    × mult)
b = min(1, basico   × mult)
return { lendario: l, epico: (1−l)×e, basico: (1−l)×(1−e)×b }
```

Nota: `sortearLoot` (1153-1165) **não** usa `chancesDrop`: sorteia `lendario`; se falhar, `epico`;
se falhar, `basico` (1161-1163). `chancesDrop` é o que as **tarefas** e as **diárias** usam para
estimar (3296-3297, 3390-3392).

### 4.2 Chances por zona, já calculadas

Percentagem de item por abate (K incluído, tier = índice do local):

| tier | Local | nv ref | K | lendário | épico | básico |
|---|---|---|---|---|---|---|
| 0 | Rota Inferior | 5 | 2,6 | 0,0104% | 0,1300% | 3,120% |
| 1 | Rota Superior | 10 | 2,2 | 0,0107% | 0,1430% | 2,530% |
| 2 | Lobos | 15 | 1,6 | 0,0133% | 0,1280% | 1,760% |
| 3 | Campo Azul | 20 | 1,2 | 0,0235% | 0,1140% | 1,260% |
| 4 | Campo Vermelho | 25 | 1 | 0,0247% | 0,1100% | 1,000% |
| 5 | Rio | 30 | 1 | 0,0269% | 0,1250% | 0,950% |
| 6 | Dragão | 35 | 1 | 0,0328% | 0,1400% | 0,900% |
| 7 | Barão | 45 | 1 | 0,0368% | 0,1550% | 0,850% |

Fonte: `4×10⁻⁵ × 4^(t/7) × K × LENDARIO_TIER[t]` (motor.js:1143) com `ajuste(n).drop` de `balanco.js`.

### 4.3 O saque de cada local (motor.js:383-407)

Versão **AD** (padrão):

| local | básicos | épicos | lendários |
|---|---|---|---|
| rota-inf | 1036 1028 1042 1029 2022 1001 1054 | 3077 3144 3047 3140 | 6631 3078 3174 |
| rota-sup | 1036 1028 1033 1006 1018 1120 | 3044 3057 1053 3133 3006 | 3078 3074 3172 |
| lobos | 1042 1037 1018 1029 1001 | 3051 3086 1043 2019 3009 3105 | 3046 6333 3170 |
| azul | 1033 1006 2022 1028 1120 | 3067 3211 3066 1011 3111 3801 | 3065 3071 8020 3190 3174 |
| vermelho | 1036 1037 1038 1028 1054 | 2021 3077 3035 6670 3008 | 3748 2501 3072 3168 |
| rio | 1042 1018 1038 1001 | 3086 6670 3144 1043 3158 3024 | 3085 3153 3036 3156 3173 |
| dragao | 1037 1038 1029 1028 1120 | 1031 3076 2019 3133 3047 3140 | 3075 3742 6610 3068 3143 663056 3172 |
| barao | 1038 1037 1018 1054 | 3035 6670 3133 1011 3006 3111 | 3031 3026 3053 6673 3083 3168 |

Versão **AP** (magos — motor.js:397-405):

| local | básicos | épicos | lendários |
|---|---|---|---|
| rota-inf | 1052 1027 1028 1029 2022 1001 1056 | 3916 3108 3020 3140 | 6655 3116 3174 |
| rota-sup | 1052 1027 1028 1033 1006 1120 1054 | 3802 3113 3145 3158 | 3116 3003 3171 |
| lobos | 1052 3070 1029 1028 1001 | 3108 4630 3147 2508 3009 3105 | 3100 6653 3170 3190 |
| azul | 1033 1006 2022 1028 1027 1056 | 3802 3067 3113 1011 3111 3801 | 3003 3165 3065 8020 3190 3171 |
| vermelho | 1026 1052 1028 1120 | 2508 3145 2420 3147 3020 | 4645 6653 3102 3152 3175 3143 |
| rio | 1026 1052 3070 1001 | 4630 3916 4632 3113 3158 3024 | 3135 4629 3157 3175 3173 8020 |
| dragao | 1026 1058 1029 1028 1120 | 2420 3145 4632 3108 3047 3140 | 3157 4645 3075 3068 664644 3175 |
| barao | 1058 1026 1052 1054 | 4630 3802 2420 1011 3020 3111 | 3089 3135 3157 4633 3083 3171 |

Como o motor escolhe (1150-1152):

```js
itensPorRaridade(rar, local, classe):
   classe === 'ap' → local.dropsAp?.[rar] || POR_CLASSE.ap[rar]
   classe === 'ad' → local.drops [rar]      || POR_CLASSE.ad[rar]
classeDe(estado) = kit(estado).magia ? 'ap' : 'ad'
```

**Verificado:** todos os ids destas 16 listas existem em `itens.js` e a raridade anunciada bate com a
`raridade` do item. **NAO VERIFICADO:** se há ids repetidos entre básico/épico/lendário da mesma zona.

### 4.4 Como o abate distribui o saque (motor.js:1751-1793)

```js
fs      = fatorSaque(nivel, nivelMonstro)
ouro    = i.ouro × a.ouroMult × fs                  // ouroMult = 1 + conquistas + mascote (526)
vip     = ehVip(estado)
mult    = (vip ? VIP.drop : 1) × bonus × fs         // bonus: bónus de Runeterra (412)
multEsp = (vip ? VIP.drop : 1) × fs
xp      = i.xp × fatorXp(...) × (vip ? VIP.xp : 1) × bonus × bonusXp × bonusTwitch × bonusEvento

itens   = sortearLoot(lugar, i.chefe, mult × petIt, classe)
          + [furioso: (n−1) sorteios extra]
espólios= sortearEspolios(nome, multEsp) + [noturno: 1 extra, furioso: (n−1) extra]
gemas   = sortearGemas(lugar, i.chefe, multEsp)  + [noturno/furioso: extra]
```

Um item só entra na mochila se houver espaço; se não, é perdido (1773-1774). Básicos são ignorados se
`estado.ignorarBasicos` (1772). Cada abate conta tarefa, diária e conquistas; o Barão dá o buff
`BARAO` (1784, 3067-3076).

### 4.5 Espólios (motor.js:305-338)

O valor: `round(0.6 × CURVA.ouro(nv) × mult)`. Já calculado:

| espólio | valor | espólio | valor |
|---|---|---|---|
| escudo-quebrado | 21 | escama-dragao | 76 |
| po-arcano | 21 | garra-dragao | 229 |
| engrenagem | 31 | olho-vazio | 97 |
| pele-lobo | 41 | chifre-arauto | 1958 |
| presa-lobo | 123 | coracao-dragao | 2220 |
| pedra-krug | 47 | presa-barao | 2745 |
| cristal-azul | 61 | seda-vilemaw | 397 |
| espinho | 72 | presa-vilemaw | 3294 |
| escama-arraia | 66 | quitina | 66 |

Chances por monstro (327-333):

| monstro | espólios e chance |
|---|---|
| Tropa Corpo a Corpo | escudo-quebrado 30% |
| Tropa Mago | po-arcano 30% |
| Tropa de Cerco | engrenagem 35% |
| Lobo Gigante | pele-lobo 30%; presa-lobo 6% |
| Krug Anciã | pedra-krug 30% |
| Sentinela Azul | cristal-azul 35% |
| Brambleback Vermelho | espinho 35% |
| Arraía do Rio | escama-arraia 30% |
| Larva do Vazio | quitina 30% |
| Dragão Ancião (filhote) | escama-dragao 30%; garra-dragao 6% |
| Criatura do Vazio | olho-vazio 30% |
| Arauto do Vale | chifre-arauto 100% |
| Dragão Infernal | coracao-dragao 100% |
| Barão Nashor | presa-barao 100% |
| Cria de Vilemaw | não tem |
| (baú da Vilemaw) | seda-vilemaw, presa-vilemaw |

Cada espólio é sorteado à parte (334-338); o noturno repete o sorteio uma vez, o furioso (n−1) vezes (1113).

### 4.6 Gemas (motor.js:107-133)

| gema | mult chance | protege | monstro comum | chefe |
|---|---|---|---|---|
| sorte (Runa da Sorte) | ×1,25 | — | 0,53% | 30% |
| arcana (Runa Arcana) | ×2 | — | 0,063% | 8% |
| proteção (Runa de Proteção) | — | sim | 0,063% | 8% |

```js
chancesGema(local, mult = 1):
   k = 1 + (local.tier || 0) × 0.1
   para cada gema: min(1, gema.chance × k × mult)     // Campo Vermelho dá ~40% mais que a Rota; o Barão ~70%
```

---

## 5. Poções (motor.js:261-267, 1292-1310)

| poção | tipo | cura | preço | nível mínimo |
|---|---|---|---|---|
| vida | vida | 300 | 40 | 1 |
| vidaF | vida | 900 | 110 | 15 |
| vidaS | vida | 2200 | 260 | 30 |
| mana | mana | 100 | 30 | 1 |
| manaF | mana | 280 | 80 | 15 |

Regras:

- Entre poções: `EXAUSTAO = 1` s (41). Em luta contra jogador: `POCAO_PVP = { cura: 0.3, exaustao: 6 }` (43).
- A poção cura até ao máximo e nunca passa (1305-1306).
- Automático (`usarPocoesAuto`, 1311-1323) só com VIP (1312): usa quando a vida < `auto.limiarVida` (0,5 por omissão, 1013) e a mana < `auto.limiarMana` (0,3, 1013). Escolhe a **maior** poção que caiba em 120% do que falta (1293-1298).
- Outras curas em PvP valem 65%: `CURA_PVP = 0.65` (1284).
- `temPocao(estado, tipo)` (1310) diz se há alguma poção utilizável do tipo.
- A rotina VIP volta à base quando acaba a poção de vida ou quando a mochila enche (1407-1413).
---

## 6. ITENS — catálogo completo (motor.js:13-408, itens.js)

### 6.1 O que é um item, no motor

- `ITENS_DADOS` (itens.js) tem **108** objectos (contado).
- `ITENS = Object.fromEntries(ITENS_DADOS.map(i => [i.id, i]))` (13) — a tabela com que se procura.
- Um item no save é um **texto**: `"id+N~Q"`, ex. `"3071+2~S"` (157). Sem `~Q` vale como
  qualidade B (163); `"~?"` é o que acabou de cair e o servidor ainda vai sortear (158, 164).
- `baseId(x)` tira o `+N` e o `~Q` e devolve o id (159).
- `refinoDe(x)` lê o `+N` (160). `qualidadeDe(x)` lê o `~Q`, com B por omissão (163).
- `comItem(base, ref, qual)` volta a montar o texto (166).

### 6.2 Os três campos de `itens.js` que o motor usa

| Campo | Para que serve |
|---|---|
| `raridade` | 'basico' / 'epico' / 'lendario' (47). Todos os 108 têm o campo preenchido |
| `lendario` | regra de equipamento (2879, 2886, 2891) e `raridade` se `raridade` faltasse (47) |
| `espaco` | arma / armadura / cabeca / mao / botas / acessorio (31-33). **O equipamento só o usa para achar a bota** (2869) |

**Contagem por raridade/espaço** (verificado, soma 108):

| raridade | arma | armadura | cabeca | mao | botas | acessorio | total |
|---|---|---|---|---|---|---|---|
| básico | 5 | 3 | 1 | 3 | 1 | 6 | **19** |
| épico | 11 | 5 | 3 | 8 | 7 | 6 | **40** |
| lendário | 19 | 7 | 6 | 5 | 7 | 5 | **49** |
| **total** | 35 | 15 | 10 | 16 | 15 | 17 | **108** |

### 6.3 `temAtributo` e `classeItem` (motor.js:20 e 22)

```js
temAtributo(x) = !!(ITENS[baseId(x)] && (
     i.ad || i.ap || i.mana || i.vida || i.armadura || i.rm || i.va || i.rv
  || i.critico || i.regen || i.cdr || i.efeito))                 // motor.js:20

classeItem(x):
   ad = i.ad || i.critico || i.va || i.rv
   if (i.ap && !ad) return 'ap'      // item de mago
   if (ad && !i.ap) return 'ad'      // item de ataque
   return 'neutro'                  // vida, armadura, mana…                             (22)
```

Duas coisas importantes:

1. `temAtributo` **não** conta `penMag`, `esquiva` nem os campos `*Pct` (`vidaPct`, `armPct`,
   `rmPct`, `adPct`, `apPct`). Um item que só tivesse esses campos **não entraria no
   equipamento**. Verificado: nenhum dos 108 está nesse caso — todos têm pelo menos um dos 11 campos
   (ou `efeito`). Os 3 itens sem atributo nenhum em `itens.js` (2022, 1006, 3057) tornam-se
   equipáveis pelos remendos do motor (16-18).
2. `classeItem` separa itens de mago de itens de ataque. Os neutros entram nos dois grupos.
   `POR_CLASSE` (52, 408): **AD** = 15 básicos + 29 épicos + 32 lendários = 76 itens;
   **AP** = 14 básicos + 26 épicos + 29 lendários = 69 itens. Há **37 itens neutros**, que contam
   nas duas listas.

`POR_CLASSE` é o que o motor usa quando o local não tem lista daquela raridade (1151) e é de onde
saem os itens de **tarefa** (3462) e de **diária** (3415).

### 6.4 Catálogo completo — os 108, um por um

Valores base de `itens.js` (antes de refino e qualidade). "Especiais" são os campos que não são
ad/ap/mana/vida/armadura/rm. "Efeito" = o item tem o campo `efeito` preenchido em `itens.js`
(ver 6.5). Os 3 marcados com `*` só têm efeito por causa dos remendos do motor (16-18).

| id | nome | raridade | espaço | preço | custo | receita | ad | ap | mana | vida | armadura | rm | especiais | efeito |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2022 | Partícula Brilhante | básico | acessorio | 250 | 250 | — | — | — | — | — | — | — | cdr 0,05 | — |
| 1042 | Adaga | básico | mao | 250 | 250 | — | — | — | — | — | — | — | va 0,1 | — |
| 1027 | Cristal de Safira | básico | acessorio | 300 | 300 | — | — | — | 300 | — | — | — | — | — |
| 1029 | Couraça de Pano | básico | armadura | 300 | 300 | — | — | — | — | — | 15 | — | — | — |
| 1006 | Pérola do Rejuvenescimento | básico | acessorio | 300 | 300 | — | — | — | — | — | — | — | regen 3 | — |
| 1001 | Botas | básico | botas | 300 | 300 | — | — | — | — | 80 | 5 | — | — | — |
| 1036 | Espada Longa | básico | arma | 350 | 350 | — | 10 | — | — | — | — | — | — | — |
| 1028 | Cristal de Rubi | básico | acessorio | 400 | 400 | — | — | — | — | 150 | — | — | — | — |
| 3070 | Lágrima da Deusa | básico | acessorio | 400 | 400 | — | — | — | 240 | — | — | — | — | — |
| 1052 | Tomo Amplificador | básico | mao | 400 | 400 | — | — | 20 | — | — | — | — | — | — |
| 1033 | Manto Anula-Magia | básico | armadura | 400 | 400 | — | — | — | — | — | — | 20 | — | — |
| 1056 | Anel de Doran | básico | acessorio | 400 | 400 | — | — | 18 | — | 90 | — | — | — | — |
| 1120 | Elmo de Doran | básico | cabeca | 450 | 450 | — | — | — | — | 150 | 8 | 8 | — | — |
| 1054 | Escudo de Doran | básico | mao | 450 | 450 | — | — | — | — | 110 | — | — | regen 1 | — |
| 1018 | Capa da Agilidade | básico | armadura | 600 | 600 | — | — | — | — | — | — | — | crit 0,15 | — |
| 1026 | Varinha Explosiva | básico | arma | 850 | 850 | — | — | 45 | — | — | — | — | — | — |
| 1037 | Picareta | básico | arma | 875 | 875 | — | 25 | — | — | — | — | — | — | — |
| 1058 | Bastão Desnecessariamente Grande | básico | arma | 1200 | 1200 | — | — | 65 | — | — | — | — | — | — |
| 1038 | Espada G. p. C. | básico | arma | 1300 | 1300 | — | 40 | — | — | — | — | — | — | — |
| 3144 | Estilingue do Patrulheiro | épico | arma | 600 | 100 | 1042 + 1042 | — | — | — | — | — | — | va 0,2 | — |
| 1043 | Arco Recurvo | épico | arma | 700 | 450 | 1042 | — | — | — | — | — | — | va 0,15 | — |
| 3067 | Gema Ardente | épico | acessorio | 800 | 150 | 1028 + 2022 | — | — | — | 200 | — | — | — | — |
| 1031 | Cota de Malha | épico | armadura | 800 | 500 | 1029 | — | — | — | — | 40 | — | — | — |
| 3076 | Colete Espinhoso | épico | armadura | 800 | 200 | 1029 + 1029 | — | — | — | — | 30 | — | — | — |
| 3801 | Braçadeira Cristalina | épico | acessorio | 800 | 100 | 1028 + 1006 | — | — | — | 200 | — | — | regen 2 | — |
| 3916 | Orbe do Oblívio | épico | mao | 800 | 400 | 1052 | — | 25 | — | — | — | — | — | — |
| 3066 | Couraça Lunar Alada | épico | armadura | 800 | 400 | 1028 | — | — | — | 200 | — | — | — | — |
| 3108 | Códex Demoníaco | épico | mao | 850 | 200 | 1052 + 2022 | — | 25 | — | — | — | — | cdr 0,05 | — |
| 1053 | Cetro Vampírico | épico | arma | 900 | 550 | 1036 | 15 | — | — | — | — | — | rv 0,07 | — |
| 3057 | Fulgor | épico | acessorio | 900 | 650 | 2022 | — | — | — | — | — | — | — | sim* |
| 1011 | Cinto do Gigante | épico | armadura | 900 | 500 | 1028 | — | — | — | 350 | — | — | — | — |
| 3113 | Cintilação Etérea | épico | acessorio | 900 | 500 | 1052 | — | 30 | — | — | — | — | — | — |
| 3158 | Botas Ionianas da Lucidez | épico | botas | 900 | 350 | 1001 + 2022 | — | — | 150 | — | — | — | cdr 0,08 | — |
| 2508 | Cinzas do Destino | épico | arma | 900 | 500 | 1052 | — | 30 | — | — | — | — | — | — |
| 3024 | Broquel Glacial | épico | mao | 900 | 50 | 1029 + 1027 + 2022 | — | — | 300 | — | 25 | — | cdr 0,05 | — |
| 3008 | Grevas Vorazes | épico | botas | 1000 | 700 | 1001 | 15 | — | — | — | — | — | rv 0,07 | — |
| 3009 | Botas da Rapidez | épico | botas | 1000 | 700 | 1001 | — | — | — | 200 | — | — | regen 2 | — |
| 3133 | Martelo de Guerra de Caulfield | épico | arma | 1050 | 100 | 1036 + 2022 + 1036 | 20 | — | — | — | — | — | — | — |
| 2019 | Sigilo de Aço | épico | mao | 1100 | 150 | 1029 + 1036 + 1029 | 15 | — | — | — | 30 | — | — | — |
| 3105 | Égide da Legião | épico | mao | 1100 | 400 | 1033 + 1029 | — | — | — | — | 25 | 25 | — | — |
| 3044 | Fago | épico | arma | 1100 | 350 | 1028 + 1036 | 15 | — | — | 200 | — | — | — | — |
| 4630 | Joia da Ruína | épico | acessorio | 1100 | 700 | 1052 | — | 25 | — | — | — | — | — | — |
| 3145 | Alternador Hextec | épico | arma | 1100 | 300 | 1052 + 1052 | — | 45 | — | — | — | — | — | — |
| 3006 | Grevas do Berserker | épico | botas | 1100 | 300 | 1001 + 1042 + 1042 | 10 | — | — | — | — | — | va 0,3 | — |
| 3020 | Sapatos do Feiticeiro | épico | botas | 1100 | 800 | 1001 | — | 35 | — | — | — | — | penMag 0,08 | — |
| 2021 | Tunelizador | épico | arma | 1150 | 400 | 1036 + 1028 | 15 | — | — | 250 | — | — | — | — |
| 3802 | Capítulo Perdido | épico | mao | 1200 | 250 | 1052 + 1027 + 2022 | — | 40 | 300 | — | — | — | cdr 0,05 | — |
| 3086 | Zelo | épico | acessorio | 1200 | 350 | 1018 + 1042 | — | — | — | — | — | — | va 0,15<br>crit 0,15 | — |
| 3077 | Tiamat | épico | arma | 1200 | 500 | 1036 + 1036 | 25 | — | — | — | — | — | — | — |
| 3051 | Machado Termestre | épico | arma | 1200 | 250 | 1036 + 1042 + 1036 | 20 | — | — | — | — | — | va 0,2 | — |
| 3047 | Botas Galvanizadas de Aço | épico | botas | 1200 | 600 | 1001 + 1029 | — | — | — | 100 | 30 | — | — | — |
| 3211 | Capuz do Espectro | épico | cabeca | 1250 | 150 | 1028 + 1033 + 1006 | — | — | — | 200 | — | 35 | — | — |
| 3111 | Passos de Mercúrio | épico | botas | 1250 | 550 | 1001 + 1033 | — | — | — | 100 | — | 30 | — | — |
| 6670 | Aljava Vespertina | épico | mao | 1300 | 350 | 1036 + 1018 | 15 | — | — | — | — | — | crit 0,2 | — |
| 3140 | Bandana de Mercúrio | épico | cabeca | 1300 | 900 | 1033 | — | — | — | 120 | — | 30 | — | — |
| 3147 | Máscara Assustadora | épico | cabeca | 1300 | 500 | 1052 + 1028 | — | 30 | — | 200 | — | — | — | — |
| 3035 | Último Sussurro | épico | arma | 1450 | 750 | 1036 + 1036 | 20 | — | — | — | — | — | — | — |
| 4632 | Barreira Verdejante | épico | mao | 1600 | 400 | 1052 + 1033 + 1052 | — | 40 | — | — | — | 25 | — | — |
| 2420 | Armaguarda da Caçadora | épico | armadura | 1600 | 500 | 1052 + 1029 + 1052 | — | 40 | — | — | 25 | — | — | — |
| 3075 | Armadura de Espinhos | lendário | armadura | 2450 | 450 | 3076 + 1031 + 1028 | — | — | — | 150 | 75 | — | — | sim |
| 3116 | Cetro de Cristal de Rylai | lendário | arma | 2600 | 450 | 1026 + 1011 + 1052 | — | 65 | — | 400 | — | — | — | sim |
| 3046 | Dançarina Fantasma | lendário | arma | 2650 | 950 | 1042 + 3086 + 1042 | — | — | — | — | — | — | va 0,65<br>crit 0,25 | sim |
| 3085 | Furacão de Runaan | lendário | arma | 2650 | 850 | 3086 + 3144 | — | — | — | — | — | — | va 0,4<br>crit 0,25 | sim |
| 3065 | Semblante Espiritual | lendário | cabeca | 2700 | 650 | 3211 + 3067 | — | — | — | 400 | — | 50 | — | sim |
| 6655 | Eco de Luden | lendário | arma | 2750 | 450 | 3802 + 3145 | — | 100 | 600 | — | — | — | — | sim |
| 3170 | Marcha Célere | lendário | botas | 2800 | 0 | 3009 + 1031 | — | — | — | 350 | 35 | 35 | esquiva 0,05 | sim |
| 3171 | Lucidez Escarlate | lendário | botas | 2800 | 0 | 3158 + 3802 | — | 60 | 400 | — | — | — | cdr 0,15 | sim |
| 3173 | Esmagadores Acorrentados | lendário | botas | 2800 | 0 | 3111 + 3211 | — | — | — | 350 | — | 60 | rmPct 0,15 | sim |
| 3174 | Mobilização Blindada | lendário | botas | 2800 | 0 | 3047 + 3076 | — | — | — | 350 | 60 | — | armPct 0,15 | sim |
| 3165 | Morellonomicon | lendário | mao | 2850 | 400 | 3916 + 1026 + 3067 | — | 75 | — | 350 | — | — | — | sim |
| 3003 | Cajado do Arcanjo | lendário | arma | 2900 | 450 | 3070 + 3802 + 3108 | — | 70 | 600 | — | — | — | — | sim |
| 3068 | Égide de Fogo Solar | lendário | mao | 2900 | 700 | 3105 + 1031 + 1028 | — | — | — | 450 | 50 | — | armPct 0,1 | sim |
| 3100 | Perdição de Lich | lendário | arma | 2900 | 250 | 3057 + 3113 + 1026 | — | 100 | — | — | — | — | — | sim |
| 3143 | Presságio de Randuin | lendário | armadura | 2900 | 800 | 1031 + 1011 | — | — | — | 350 | 75 | — | armPct 0,1 | sim |
| 3152 | Explocinturão Hextec | lendário | armadura | 2900 | 350 | 3145 + 3067 + 1028 | — | 70 | — | 350 | — | — | apPct 0,05 | sim |
| 3168 | Caminho Imortal | lendário | botas | 2900 | 0 | 3008 + 1053 | 40 | — | — | 250 | — | — | rv 0,12<br>vidaPct 0,05 | sim |
| 3175 | Sapatos Enfeitiçados | lendário | botas | 2900 | 0 | 3020 + 4630 | — | 70 | — | — | — | — | penMag 0,15 | sim |
| 3190 | Medalhão dos Solari de Ferro | lendário | acessorio | 2900 | 700 | 3067 + 1029 + 1033 | — | — | — | 300 | 35 | 35 | vidaPct 0,06 | sim |
| 3742 | Couraça do Defunto | lendário | armadura | 2900 | 900 | 3066 + 1028 + 1031 | — | — | — | 350 | 55 | — | — | sim |
| 8020 | Máscara Abissal | lendário | cabeca | 2900 | 1000 | 3140 + 3067 | — | — | — | 450 | — | 55 | vidaPct 0,08 | sim |
| 3071 | Cutelo Negro | lendário | arma | 3000 | 225 | 3044 + 3067 + 1037 | 45 | — | — | 400 | — | — | — | sim |
| 3102 | Véu da Banshee | lendário | mao | 3000 | 200 | 1058 + 4632 | — | 105 | — | — | — | 40 | — | sim |
| 3135 | Cajado do Vazio | lendário | arma | 3000 | 1050 | 4630 + 1026 | — | 95 | — | — | — | — | — | sim |
| 3172 | Grevas Bélicas | lendário | botas | 3000 | 0 | 3006 + 3086 | 30 | — | — | — | — | — | va 0,45<br>rv 0,06<br>adPct 0,06 | sim |
| 4629 | Ímpeto Cósmico | lendário | acessorio | 3000 | 450 | 3067 + 3113 + 3108 | — | 70 | — | 350 | — | — | cdr 0,15 | sim |
| 6653 | Tormento de Liandry | lendário | cabeca | 3000 | 800 | 3147 + 2508 | — | 60 | — | 300 | — | — | — | sim |
| 3083 | Armadura de Warmog | lendário | armadura | 3100 | 500 | 1011 + 1011 + 3801 | — | — | — | 1000 | — | — | regen 15 | sim |
| 3156 | Mandíbula de Malmortius | lendário | acessorio | 3100 | 750 | 3140 + 3133 | 60 | — | — | — | — | 40 | adPct 0,05 | sim |
| 4633 | Criafendas | lendário | armadura | 3100 | 950 | 3147 + 3108 | — | 80 | — | 350 | — | — | apPct 0,05 | sim |
| 6610 | Céu Dividido | lendário | arma | 3100 | 900 | 2021 + 3133 | 40 | — | — | 400 | — | — | — | sim |
| 6673 | Arco-escudo Imortal | lendário | mao | 3100 | 825 | 1037 + 6670 | 55 | — | — | — | — | — | crit 0,25<br>vidaPct 0,06 | sim |
| 663056 | Coroa do Rei Demoníaco | lendário | cabeca | 3100 | 2500 | 1120 + 3133 + 1028 | 40 | — | — | 350 | 25 | — | adPct 0,04 | sim |
| 664644 | Coroa da Rainha Despedaçada | lendário | cabeca | 3100 | 2500 | 1120 + 3802 + 1026 | — | 70 | 600 | 250 | — | — | apPct 0,06 | sim |
| 3026 | Anjo Guardião | lendário | acessorio | 3200 | 800 | 2019 + 1038 | 55 | — | — | — | 45 | — | — | sim |
| 3053 | Sinal de Sterak | lendário | mao | 3200 | 775 | 1037 + 2021 + 1028 | — | — | — | 400 | — | — | — | sim |
| 3153 | Espada do Rei Destruído | lendário | arma | 3200 | 725 | 1053 + 1043 + 1037 | 40 | — | — | — | — | — | va 0,25<br>rv 0,1 | sim |
| 4645 | Chama Sombria | lendário | arma | 3200 | 900 | 3145 + 1058 | — | 110 | — | — | — | — | — | sim |
| 3157 | Ampulheta de Zhonya | lendário | acessorio | 3250 | 450 | 1058 + 2420 | — | 105 | — | — | 50 | — | — | sim |
| 2501 | Armadura Sangrenta do Suserano | lendário | armadura | 3300 | 1000 | 2021 + 2021 | 30 | — | — | 550 | — | — | — | sim |
| 3036 | Lembranças do Lorde Dominik | lendário | arma | 3300 | 550 | 3035 + 6670 | 35 | — | — | — | — | — | crit 0,25 | sim |
| 3074 | Hidra Raivosa | lendário | arma | 3300 | 150 | 3077 + 1053 + 3133 | 65 | — | — | — | — | — | rv 0,12 | sim |
| 3748 | Hidra Titânica | lendário | arma | 3300 | 50 | 3077 + 2021 + 1011 | 40 | — | — | 600 | — | — | — | sim |
| 6333 | Dança da Morte | lendário | arma | 3300 | 275 | 2019 + 1037 + 3133 | 60 | — | — | — | 50 | — | — | sim |
| 6631 | Quebrapassos | lendário | arma | 3300 | 750 | 3077 + 3044 + 1042 | 40 | — | — | 450 | — | — | va 0,25 | sim |
| 3078 | Força da Trindade | lendário | arma | 3333 | 133 | 3057 + 3044 + 3051 | 36 | — | — | 333 | — | — | va 0,3 | sim |
| 3072 | Sedenta por Sangue | lendário | arma | 3400 | 325 | 1038 + 1037 + 1053 | 80 | — | — | — | — | — | rv 0,15 | sim |
| 3031 | Gume do Infinito | lendário | arma | 3500 | 725 | 1038 + 1037 + 1018 | 75 | — | — | — | — | — | crit 0,25 | sim |
| 3089 | Capuz da Morte de Rabadon | lendário | cabeca | 3500 | 1100 | 1058 + 1058 | — | 130 | — | — | — | — | — | sim |

### 6.5 Os itens com efeito especial e onde o motor os usa

Ordenado por id. Esta é a tabela que amarra cada item ao código que o aplica.

| id | nome | efeito | onde no motor |
|---|---|---|---|| 2022 | Partícula Brilhante | Reduz a recarga das habilidades. | remendo 16 + campo cdr |
| 2501 | Armadura Sangrenta do Suserano | Tirania: ganha Dano de Ataque igual a 2% da Vida bônus. | motor.js:514 |
| 3003 | Cajado do Arcanjo | Pavor: ganha Poder de Habilidade igual a 3% da sua Mana máxima. | motor.js:521 |
| 3026 | Anjo Guardião | Renascimento: ao morrer, volta com 50% da Vida (a cada 300s). | motor.js:2729, 3737 |
| 3031 | Gume do Infinito | Golpe Infinito: seus acertos críticos causam +40% de dano. | motor.js:515 |
| 3036 | Lembranças do Lorde Dominik | Mata-Gigantes: 30% de penetração de armadura e +15% de dano contra chefes. | motor.js:539, 1214 |
| 3044 | Fago | Causa Fúria por 2s (+8% de velocidade de ataque) a cada ataque. | motor.js:1706 |
| 3046 | Dançarina Fantasma | Valsa Espectral: cada ataque dá +6% de Velocidade de Ataque por 3s, acumulando até 5 vezes. | motor.js:1707 |
| 3053 | Sinal de Sterak | Pele de Aço: com menos de 30% de Vida, ganha um escudo de 60% da Vida bônus (a cada 90s). | motor.js:2725 |
| 3057 | Fulgor | Lâmina Encantada: depois de usar uma habilidade, o próximo ataque (ou o Disparo Místico do Ezreal) causa +100% do Dano de Ataque base. | motor.js:1672 (lamina=1); remendo 18 |
| 3065 | Semblante Espiritual | Vitalidade Ilimitada: +25% em toda cura recebida. | motor.js:1286 |
| 3068 | Égide de Fogo Solar | Fogo Solar: +10% de Armadura total. A cada segundo, queima os monstros encostados (3 + 0,5 × nível + 0,3% da sua vida máxima). | motor.js:1629 (SOLAR), 1633-1638 |
| 3071 | Cutelo Negro | Talhar: cada ataque reduz a Armadura do alvo em 6%, acumulando até 30%. | motor.js:1705 |
| 3072 | Sedenta por Sangue | Escudo Sanguíneo: a cura do roubo de vida que passar da Vida máxima vira escudo (até 25% da Vida máxima). | motor.js:1229 |
| 3074 | Hidra Raivosa | Cleave: ataques causam 40% do Dano de Ataque nos outros inimigos que você alcança. Roubo de vida de 12%. | motor.js:1720 |
| 3075 | Armadura de Espinhos | Espinhos: quem te ataca recebe 10 + 10% da sua Armadura bônus como dano. | motor.js:1735 |
| 3078 | Força da Trindade | Lâmina Encantada: depois de usar uma habilidade, o próximo ataque (ou o Disparo Místico do Ezreal) causa +200% do Dano de Ataque base. | motor.js:1672 (lamina=2) |
| 3083 | Armadura de Warmog | Coração de Warmog: recupera 15 de Vida por segundo. | campo regen |
| 3085 | Furacão de Runaan | Fúria do Vento: cada ataque dispara em mais 2 inimigos que você alcança, com 55% do dano (campeões que atacam de longe: 15%, sem crítico). | motor.js:1718 |
| 3089 | Capuz da Morte de Rabadon | Obra-Prima Mágica: aumenta seu Poder de Habilidade total em 35%. | motor.js:522 |
| 3100 | Perdição de Lich | Lâmina Encantada: depois de usar uma habilidade, o próximo ataque causa +75% do Poder de Habilidade como dano mágico. | motor.js:1688 (com tem 1944) |
| 3102 | Véu da Banshee | Escudo de Feitiço: bloqueia o próximo golpe de monstro (a cada 40s). | motor.js:2698 |
| 3108 | Códex Demoníaco | Reduz a recarga das habilidades. | remendo 25 + campo cdr |
| 3116 | Cetro de Cristal de Rylai | Geada: habilidades deixam os inimigos lentos por 1,5s. | motor.js:1208 |
| 3135 | Cajado do Vazio | Dissolver: 40% de penetração mágica. | motor.js:529 |
| 3143 | Presságio de Randuin | Presságio: +10% de Armadura total. | campo armPct |
| 3152 | Explocinturão Hextec | Explosão Hextec: +5% de Poder de Habilidade total. | campo apPct |
| 3153 | Espada do Rei Destruído | Gume da Névoa: ataques causam 5% da Vida atual do alvo como dano extra (com teto em monstro de muita vida). | motor.js:1702 |
| 3156 | Mandíbula de Malmortius | Linha da Vida: +5% de Dano de Ataque total. | campo adPct |
| 3157 | Ampulheta de Zhonya | Stasis: com menos de 25% de Vida, fica invulnerável por 2,5s (a cada 120s). | motor.js:2722 |
| 3165 | Morellonomicon | Aflição: habilidades causam +12% de dano em inimigos com menos de 50% de Vida. | motor.js:1206 |
| 3168 | Caminho Imortal | Caminho Imortal: +5% de Vida máxima. | campo vidaPct |
| 3170 | Marcha Célere | Passo Ligeiro: +5% de esquiva. | campo esquiva |
| 3171 | Lucidez Escarlate | Lucidez: −15% na recarga das habilidades. | campo cdr |
| 3172 | Grevas Bélicas | Ritmo de Guerra: +6% de Dano de Ataque total. | campo adPct |
| 3173 | Esmagadores Acorrentados | Correntes: +15% de Resistência Mágica total. | campo rmPct |
| 3174 | Mobilização Blindada | Blindagem: +15% de Armadura total. | campo armPct |
| 3175 | Sapatos Enfeitiçados | Feitiço Penetrante: 15% de penetração mágica. | campo penMag |
| 3190 | Medalhão dos Solari de Ferro | Medalhão: +6% de Vida máxima. | campo vidaPct |
| 3742 | Couraça do Defunto | Rolo Compressor: a cada 4s, o próximo ataque causa +40 de dano. | motor.js:1698 |
| 3748 | Hidra Titânica | Cleave Titânico: ataques causam +1,5% da sua Vida máxima em todos os inimigos que você alcança. | motor.js:1721 |
| 3802 | Capítulo Perdido | Reduz a recarga das habilidades. | remendo 26 + campo cdr |
| 4629 | Ímpeto Cósmico | Ímpeto: −15% na recarga das habilidades. | remendo 24 + campo cdr |
| 4633 | Criafendas | Fenda: +5% de Poder de Habilidade total. | campo apPct |
| 4645 | Chama Sombria | Chama Feroz: o dano mágico causa +20% em inimigos com menos de 40% de Vida. | motor.js:1205 |
| 6333 | Dança da Morte | Ignorar a Dor: 30% do dano recebido vira sangramento ao longo de 3s. Ao abater, limpa o sangramento e cura 15% da Vida perdida. | motor.js:2701, 1790 |
| 6610 | Céu Dividido | Choque de Luz: o primeiro ataque em cada inimigo é crítico e cura 6% da Vida perdida. | motor.js:1699-1704 |
| 6631 | Quebrapassos | Golpe Pesado: a cada 5s, o próximo ataque causa +80% do Dano de Ataque em todos os inimigos que você alcança. | motor.js:1719 |
| 663056 | Coroa do Rei Demoníaco | Coroa Demoníaca: +4% de Dano de Ataque total. | campo adPct |
| 664644 | Coroa da Rainha Despedaçada | Coroa Despedaçada: +6% de Poder de Habilidade total. | campo apPct |
| 6653 | Tormento de Liandry | Tormento: habilidades queimam o alvo, causando 1,5% da Vida máxima dele por segundo durante 3s (com teto em monstro de muita vida). | motor.js:1207 |
| 6655 | Eco de Luden | Eco: a cada 6s, a próxima habilidade causa mais 100 + 10% do Poder de Habilidade em até 3 inimigos. | motor.js:1945 |
| 6673 | Arco-escudo Imortal | Salva-vidas: +6% de Vida máxima. | campo vidaPct |
| 8020 | Máscara Abissal | Abismo: +8% de Vida máxima. | campo vidaPct |

### 6.6 Itens com campos especiais (cdr, rv, penMag, critico, regen, apPct, …)

Cada entrada é "id nome (valor)". É a lista a consultar quando a função de decisão quiser optimizar
um atributo específico.

**cdr — redução de recarga (escala com refino e qualidade):** 2022 Partícula Brilhante (0.05); 3108 Códex Demoníaco (0.05); 3158 Botas Ionianas da Lucidez (0.08); 3024 Broquel Glacial (0.05); 3802 Capítulo Perdido (0.05); 3171 Lucidez Escarlate (0.15); 4629 Ímpeto Cósmico (0.15)

**rv — roubo de vida (escala):** 1053 Cetro Vampírico (0.07); 3008 Grevas Vorazes (0.07); 3168 Caminho Imortal (0.12); 3172 Grevas Bélicas (0.06); 3153 Espada do Rei Destruído (0.1); 3074 Hidra Raivosa (0.12); 3072 Sedenta por Sangue (0.15)

**penMag — penetração mágica (NÃO escala, motor.js:254-255):** 3020 Sapatos do Feiticeiro (0.08); 3175 Sapatos Enfeitiçados (0.15)

**critico — chance de crítico (escala):** 1018 Capa da Agilidade (0.15); 3086 Zelo (0.15); 6670 Aljava Vespertina (0.2); 3046 Dançarina Fantasma (0.25); 3085 Furacão de Runaan (0.25); 6673 Arco-escudo Imortal (0.25); 3036 Lembranças do Lorde Dominik (0.25); 3031 Gume do Infinito (0.25)

**regen — vida por segundo (escala):** 1006 Pérola do Rejuvenescimento (3); 1054 Escudo de Doran (1); 3801 Braçadeira Cristalina (2); 3009 Botas da Rapidez (2); 3083 Armadura de Warmog (15)

**apPct — % do Poder de Habilidade (NÃO escala):** 3152 Explocinturão Hextec (0.05); 4633 Criafendas (0.05); 664644 Coroa da Rainha Despedaçada (0.06)

**adPct — % do Dano de Ataque (NÃO escala):** 3172 Grevas Bélicas (0.06); 3156 Mandíbula de Malmortius (0.05); 663056 Coroa do Rei Demoníaco (0.04)

**vidaPct — % de vida máxima (NÃO escala):** 3168 Caminho Imortal (0.05); 3190 Medalhão dos Solari de Ferro (0.06); 8020 Máscara Abissal (0.08); 6673 Arco-escudo Imortal (0.06)

**armPct — % de armadura (NÃO escala):** 3174 Mobilização Blindada (0.15); 3068 Égide de Fogo Solar (0.1); 3143 Presságio de Randuin (0.1)

**rmPct — % de resistência mágica (NÃO escala):** 3173 Esmagadores Acorrentados (0.15)

**esquiva — % de esquiva (NÃO escala):** 3170 Marcha Célere (0.05)

**va — velocidade de ataque (escala):** 1042 Adaga (0.1); 3144 Estilingue do Patrulheiro (0.2); 1043 Arco Recurvo (0.15); 3006 Grevas do Berserker (0.3); 3086 Zelo (0.15); 3051 Machado Termestre (0.2); 3046 Dançarina Fantasma (0.65); 3085 Furacão de Runaan (0.4); 3172 Grevas Bélicas (0.45); 3153 Espada do Rei Destruído (0.25); 6631 Quebrapassos (0.25); 3078 Força da Trindade (0.3)

---

## 7. Qualidade, refino e os remendos do motor (motor.js:16-26, 169-258)

### 7.1 Os remendos de topo (motor.js:16-26) — lê-los primeiro

O motor **corrige o gerador**: itens que no LoL dão atributos que o gerador não trouxe. São 6
`Object.assign` sobre `ITENS`:

| linha | id | item | o que acrescenta |
|---|---|---|---|
| 16 | 2022 | Partícula Brilhante | `cdr: 0.05` + `resumo: 'Reduz a recarga das habilidades'` |
| 17 | 1006 | Pérola do Rejuvenescimento | `regen: 3` |
| 18 | 3057 | Fulgor | `efeito: 'Lâmina Encantada: … +100% do Dano de Ataque base.'` |
| 24 | 4629 | Ímpeto Cósmico | `cdr: 0.15` (aceleração de habilidade) |
| 25 | 3108 | Códex Demoníaco | `cdr: 0.05` |
| 26 | 3802 | Capítulo Perdido | `cdr: 0.05` |

### 7.2 Qualidades (motor.js:173-179)

| qualidade | peso (%) | mult (atributos) | venda (preço) |
|---|---|---|---|
| C | 49,9495 | 0,90 | 0,80 |
| B | 35 | 1,00 | 1,00 |
| A | 15 | 1,15 | 1,50 |
| S | 0,05 | 1,35 | 3,00 |
| SS | 0,0005 | 1,70 | 8,00 |

Sorteio (182-192):

```js
chancesQualidade(bonus = 0):
   b = max(0, bonus)
   p.C = peso(C);  p.B = peso(B)
   p.A = peso(A) × (1 + 0.5×b)
   p.S = peso(S) × (1 + 0.6×b)
   p.SS= peso(SS)× (1 + 0.8×b)
   devolve cada um ÷ total
sortearQualidade(bonus, rng): percorre C, B, A, S, SS e devolve o primeiro em que x < chance
```

Bónus da montagem (194): `max(0, média do índice(C=0, B=1, A=2, S=3, SS=4) das peças − 1)`.

### 7.3 Refino + qualidade = `m`

`BONUS_REFINO = 0.12` por nível de refino (55); `REFINO_MAX = 5` (54).

```
m = (1 + 0.12 × refinoDe(item)) × QUALIDADES[qualidadeDe(item)].mult
```

Valores de `m`:

| qualidade | +0 | +1 | +2 | +3 | +4 | +5 |
|---|---|---|---|---|---|---|
| C (0,90) | 0,900 | 1,008 | 1,116 | 1,224 | 1,332 | 1,440 |
| B (1,00) | 1,000 | 1,120 | 1,240 | 1,360 | 1,480 | 1,600 |
| A (1,15) | 1,150 | 1,288 | 1,426 | 1,564 | 1,702 | 1,840 |
| S (1,35) | 1,350 | 1,512 | 1,674 | 1,836 | 1,998 | 2,160 |
| SS (1,70) | 1,700 | 1,904 | 2,108 | 2,312 | 2,516 | 2,720 |

### 7.4 Forja: chances, regressão e persistência (motor.js:56-80, 153, 136)

```js
CHANCE_REFINO     = [0.30, 0.12, 0.02, 0.008, 0.003]     // índice = refino actual (60)
PRECO_REFINO_ALTO = 2                                     // dobra o custo da tentativa +3 em diante (61)
REGRESSAO_REFINO  = [0, 0, 0.04, 0.015, 0.006]            // chance de PERDER um nível ao falhar (62)

chanceRefino(estado, ref) = ehVip ? min(0.5, CHANCE_REFINO[ref] × 1.2) : CHANCE_REFINO[ref]   (153)

PERSISTENCIA.forja  = { 1:{}, 2:{}, 3:{subir:80,max:120}, 4:{subir:200,max:300}, 5:{subir:530,max:800} }   (69)
PERSISTENCIA.montar = { epico:{subir:108,max:150}, lendario:{subir:1125,max:1500} }                          (70)
PERSISTENCIA_PASSO  = 0.01 ;  PERSISTENCIA_TETO = 0.5                                                          (72)

bonusFalhas(falhas) = min(0.5, 0.01 × falhas)
comPersistencia(base, falhas, regra):
   b = min(1, base × (1 + bonusFalhas(falhas)))
   if (!regra.subir || falhas < regra.subir) return b
   return min(1, b + ((1 − b) × (falhas − regra.subir + 1)) / (regra.max − regra.subir))
```

A persistência conta por **alvo + raridade** — chave `"{alvo}:{raridade}"`, ex. `"3:lendario"`
(83). Só existe para os alvos 3, 4 e 5: +1 e +2 nunca regridem e não têm contagem (69).

### 7.5 Gemas na forja (motor.js:107-136, 3200-3223)

```js
podeUsarGema(e, gema, 'forja') = gema && GEMAS[gema].forja && (e.gemas?.[gema] || 0) > 0     (118)
chanceForjaAgora(e, ref, x) = comPersistencia(chanceRefino(e, ref), falhasForja(e, ref+1, x), PERSISTENCIA.forja[ref+1])   (136)

forjar(estado, onde, k, gema):
   ref = refinoDe(x)
   se ref >= REFINO_MAX → { maximo: true }
   preco = precoRefino(x); se ouro < preco → { semOuro: true, preco }
   gasta ouro; gasta 1 gema se servir
   sucesso = Math.random() < min(1, chanceForjaAgora(...) × (g?.mult || 1))
   conta a falha na faixa (3212)
   se sucesso:           lista[k] = "+(ref+1)"
   senão se random() < REGRESSAO_REFINO[ref]:
        se a gema for de proteção → protegeu (o item fica no nível)
        senão                    → lista[k] = "−(ref−1)"   (regrediu)
```

---

## 8. `infoItem` campo a campo (motor.js:251-255)

```js
infoItem(x):
   i    = ITENS[baseId(x)]              // o item base
   ref  = refinoDe(x)                    // 0 a 5
   qual = qualidadeDe(x)                 // C, B, A, S, SS (sem ~ = B)
   m    = (1 + 0.12 × ref) × (QUALIDADES[qual]?.mult || 1)

   return { ...i, chave: x, ref, qual,
            nomeRef: ref ? i.nome + ' +' + ref : i.nome,
            ad:       i.ad      × m
            ap:      (i.ap   || 0) × m
            mana:    (i.mana || 0) × m
            vida:     i.vida    × m
            armadura: i.armadura × m
            rm:       i.rm      × m
            va:       i.va      × m
            rv:       i.rv      × m
            critico: (i.critico || 0) × m
            regen:   (i.regen  || 0) × m
            cdr:     (i.cdr    || 0) × m }
```

**Os 11 campos que `infoItem` escala — lista exacta** (motor.js:254-255):
`ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr`.

**Os campos que `infoItem` NÃO escala** (entram pelo `...i` e são lidos como valores crus em
`atributos()`, 509): `penMag, esquiva, adPct, apPct, vidaPct, armPct, rmPct`. O mesmo acontece com
`efeito`, `preco`, `custo`, `de`, `espaco`, `raridade`, `resumo`.

> **Armadilha #1 (a prova nº 2 do AGENTS.md):** o `penMag` **não** escala. A "Sapatos
> Enfeitiçados" (penMag 0,15) dá 15% de penetração mágica a +0 B **e** a +5 SS. `atributos()` lê o
> campo cru em `pct.penMag += i[p] || 0` (509). O mesmo vale para `esquiva` e para os `*Pct`.

> **Armadilha #2:** `regen` e `cdr` **escalam**. O Ímpeto Cósmico (0,15) a +3 com qualidade A dá
> `0,15 × 1,564 = 0,2346` — 23,46% de redução de recarga (a prova nº 1 do AGENTS.md).

---

## 9. Preços: `precoRefino`, `valorVenda`, `valorEquip`, `poder`

### 9.1 `precoRefino` — ouro para forjar (motor.js:258)

```js
precoRefino(x) = round(preco × (0.5 + 0.5 × refinoDe(x)) × (refinoDe(x) >= 2 ? 2 : 1))
```

| refino actual | factor bruto | factor final (com o ×2) |
|---|---|---|
| +0 → +1 | 0,5 | 0,5 |
| +1 → +2 | 1,0 | 2,0 |
| +2 → +3 | 1,5 | 3,0 |
| +3 → +4 | 2,0 | 4,0 |
| +4 → +5 | 2,5 | 5,0 |

Custo total de um item básico até +5: 0,5 + 2 + 3 + 4 + 5 = **14,5 × o preço base** (sem falhas e sem
regressões).

### 9.2 `valorVenda` — ouro no Lojista (motor.js:257)

```js
valorVenda(x) = floor(preco × 0.5 × (1 + 0.5 × refinoDe(x)) × QUALIDADES[qualidadeDe(x)].venda)
```

A qualidade entra pelo `venda` (0,8 / 1 / 1,5 / 3 / 8) e o refino por `(1 + 0,5 × ref)`.
Exemplos (3071 Cutelo Negro, preço 3000): +0 B = 1500; +0 SS = 12000; +5 B = 5250; +5 SS = 42000.
Vender só na Fonte ou nas cidades de Runeterra, e nunca um item ainda em avaliação (2930-2935).

### 9.3 `valorEquip` — quanto um item vale no equipamento (motor.js:2898)

```js
valorEquip(x) = preco × (1 + 0.12 × refinoDe(x)) × QUALIDADES[qualidadeDe(x)].mult
```

É o `m` de `infoItem` aplicado ao **preço**. Usado por `arrumarEquipamento` (2904) para decidir o
que fica equipado quando o equipamento está fora da regra. **Não é exportado** — é uma `const`
interna do módulo.

### 9.4 `poder` — o número que o jogo mostra (motor.js:246-249)

```js
poder(estado) = round(nivel × 40 + Σ sobre os equipados de
                        (preco × (1 + 0.12 × refino) × mult da qualidade) / 10)
```

### 9.5 Custos de montagem no Ornn (motor.js:3131-3136, 3160-3162)

```js
MULT_CUSTO_MONTAR       = { epico: 3, lendario: 45 }     // o 45 nunca é usado: o lendário usa o preço
CUSTO_LENDARIO_POR_PRECO = 4.8
custoMontar(i) = raridade === 'lendario'
                ? round(preco × 4.8 / 50) × 50
                : (i.custo || 0) × MULT_CUSTO_MONTAR[raridade]
CHANCE_MONTAR = { epico: 0.01, lendario: 0.001 }
chanceMontar(estado, id) = min(0.5, CHANCE_MONTAR[raridade] × (vip ? 1.2 : 1))
```

Custos por lendário, já calculados (os 49 lendários):

| custo/tentativa | itens |
|---|---|
| 11.750 | 3075 |
| 12.500 | 3116 |
| 12.700 | 3046, 3085 |
| 12.950 | 3065 |
| 13.200 | 6655 |
| 13.450 | 3170, 3171, 3173, 3174 |
| 13.700 | 3165 |
| 13.900 | 3003, 3068, 3100, 3143, 3152, 3168, 3175, 3190, 3742, 8020 |
| 14.400 | 3071, 3102, 3135, 3172, 4629, 6653 |
| 14.900 | 3083, 3156, 4633, 6610, 6673, 663056, 664644 |
| 15.350 | 3026, 3053, 3153, 4645 |
| 15.600 | 3157 |
| 15.850 | 2501, 3036, 3074, 3748, 6333, 6631 |
| 16.000 | 3078 |
| 16.300 | 3072 |
| 16.800 | 3031, 3089 |

Para os épicos, `custo × 3`. Distribuição (40 épicos):

| custo/tentativa | quantos épicos |
|---|---|
| 150 | 1 |
| 300 | 3 |
| 450 | 3 |
| 600 | 2 |
| 750 | 2 |
| 900 | 2 |
| 1.050 | 4 |
| 1.200 | 5 |
| 1.350 | 1 |
| 1.500 | 7 |
| 1.650 | 2 |
| 1.800 | 1 |
| 1.950 | 1 |
| 2.100 | 3 |
| 2.250 | 1 |
| 2.400 | 1 |
| 2.700 | 1 |

---

## 10. Espaços, mochila e regras de equipamento (motor.js:28-37, 2866-2917)

### 10.1 As regras

```js
ESPAÇOS       = 5                    // 1 bota + 4 outros (28)
ESPAÇOS_ITENS = 4                    // espaços para o que não é bota (29)
ehBota(x)     = espacoDe(x) === 'botas'                                         (2869)

cabeNoEquip(lista, x):
   se ehBota(x):  !lista.some(ehBota)
   senão:         lista.filter(y => !ehBota(y)).length < ESPAÇOS_ITENS
   e ainda:       !(ITENS[baseId(x)]?.lendario
                     && lista.some(y => baseId(y) === baseId(x)))             // lendário 1× (2891)

equipamentoValido(e) = percorre os itens e devolve false no primeiro que não caiba (2892-2896)
```

`equipar` (2870-2881):

- Só itens com `temAtributo` (2872).
- Bota nova **troca** pela bota equipada (2873-2877) — nunca fica sem bota nem com duas.
- Os outros precisam de um dos 4 espaços livres (2878).
- Um lendário repetido não entra (2879).
- `limitarVida` (2866) corta a vida/mana actuais para o novo máximo.

`trocarItem` (2883-2888): troca o item da mochila k pelo equipado j. Os dois têm de ser do mesmo
tipo (bota com bota, resto com resto, 2885) e não pode haver lendário repetido (2886).

`arrumarEquipamento` (2901-2912): com o equipamento inválido (mais de 4 fora a bota, duas botas,
lendário repetido), ordena por `valorEquip` decrescente, fica com o que cabe e manda o resto para a
mochila ou, sem lugar, para o cofre da Tesoureira (2908-2910). **Feito no servidor.**

`desequipar` (2913-2917): tira do equipamento e põe na mochila, se houver espaço.

### 10.2 Os tipos de espaço (motor.js:31-33)

`ESPAÇOS_EQUIP = ['arma','armadura','cabeca','mao','botas','acessorio']`
`NOME_ESPACO` = Arma / Armadura / Cabeça / Mão esquerda / Botas / Acessório.

**As 15 botas do jogo** (verificado, `espaco === 'botas'`): 1001 (básico); 3158, 3008, 3009, 3006,
3020, 3047, 3111 (épicos); 3170, 3171, 3173, 3174, 3168, 3175, 3172 (lendários).

**Nota:** o tipo do espaço (arma/cabeça/…) **só** serve para achar a bota. Fora a bota, qualquer item
cabe em qualquer um dos 4 espaços — o motor não impede "duas armas" ou "três capacetes".
---

## 11. Onde cada item é usado no motor — os casos `tem('id')`

`atributos()` devolve `tem` (motor.js:513: `const tem = (id) => estado.itens.some(x => baseId(x) === id)`),
que é como o resto do motor pergunta "está equipado?". A seguir, **todos** os `tem('…')` e
`a.tem?.('…')` do ficheiro, encontrados lendo as 3791 linhas. Os 6 do bloco 501-540 do pedido são
os seis primeiros (motor.js:514, 515, 521, 522, 529 e 539) — os que correm dentro de `atributos()`.

| id | item | linha | o que faz | quando |
|---|---|---|---|---|
| 2501 | Armadura Sangrenta do Suserano | motor.js:514 | `ad += 0.02 × (vida − baseVida)` — 2% da vida **bônus** vira Dano de Ataque | calc de atributos |
| 3031 | Gume do Infinito | motor.js:515 | `danoCritico += 0.4` — o crítico passa de 175% para 215% (Yasuo: de 140% para 180%) | calc de atributos |
| 3003 | Cajado do Arcanjo | motor.js:521 | `ap += 0.03 × manaMax` — 3% da mana máxima vira Poder de Habilidade | calc de atributos |
| 3089 | Capuz da Morte de Rabadon | motor.js:522 | `ap *= 1.35` — +35% no Poder total | calc de atributos |
| 3135 | Cajado do Vazio | motor.js:529 | `penMagica += 0.40` — 40% de penetração mágica, somado ao `penMag` dos itens e limitado a 0,6 | calc de atributos |
| 3036 | Lembranças do Lorde Dominik | motor.js:539 | `penArmadura ×= 0.7` — ignora 30% da armadura do alvo (além da penetração da habilidade E) | calc de atributos |
| 3036 | Lembranças do Lorde Dominik | motor.js:1214 | `dano *= 1.15` contra chefes — +15% | golpe |
| 4645 | Chama Sombria | motor.js:1205 | se `alvo.hp / alvo.hpMax < 0.4`: `bruto *= 1.2` — +20% de dano mágico | golpe mágico |
| 3165 | Morellonomicon | motor.js:1206 | se `alvo.hp / alvo.hpMax < 0.5`: `bruto *= 1.12` — +12% | golpe mágico |
| 6653 | Tormento de Liandry | motor.js:1207 | `alvo.queima = { dps: vidaRefItem(alvo) × 0.015, t: 3 }` — queima por 3 s (com teto) | golpe mágico |
| 3116 | Cetro de Cristal de Rylai | motor.js:1208 | `alvo.lento = max(alvo.lento, 1.5)` — 1,5 s de lentidão | golpe mágico |
| 3072 | Sedenta por Sangue | motor.js:1229 | a cura do roubo de vida que passar do máximo vira escudo, até `vida × 0.25` | roubo de vida |
| 3065 | Semblante Espiritual | motor.js:1286 | `curar(...) × 1.25` — +25% em toda cura | cura |
| 3068 | Égide de Fogo Solar | motor.js:1629, 1633-1638 | a cada 1 s queima os encostados: `3 + 0,5 × nível + 0,003 × vida máxima` (dano mágico) | passiva de tick |
| 3078 / 3057 | Força da Trindade / Fulgor | motor.js:1672 | `lamina(a)`: Trindade → 2, Fulgor → 1. O ataque depois de uma habilidade ganha esse múltiplo do **Dano de Ataque base** | ataque básico |
| 3100 | Perdição de Lich | motor.js:1688, 1944 | depois de usar habilidade: `d.lich = true`; no ataque seguinte, `+0,75 × Poder de Habilidade` como dano mágico | ataque básico |
| 3742 | Couraça do Defunto | motor.js:1698 | a cada 4 s (`timers.couraca`): `bruto += 40` — +40 de dano fixo | ataque básico |
| 6610 | Céu Dividido | motor.js:1699-1704 | primeiro ataque em cada inimigo é sempre crítico (`alvo.tocado` controla) e cura 6% da vida perdida | ataque básico |
| 3153 | Espada do Rei Destruído | motor.js:1702 | `bruto += 0.05 × vidaRefItem(alvo, alvo.hp)` — 5% da vida **actual**, com tecto de 3× a curva do nível | ataque básico |
| 3071 | Cutelo Negro | motor.js:1705 | `alvo.reducaoArmadura += 0.06`, tecto 0,30 — reduz a armadura do alvo | ataque básico |
| 3044 | Fago | motor.js:1706 | `d.furia = 2` — 2 s de Fúria = +8% de velocidade de ataque (`avancarAtaque`, 1666) | ataque básico |
| 3046 | Dançarina Fantasma | motor.js:1707 | `d.valsaAcum` até 5, `d.valsa = 3` — +6% de velocidade de ataque por acúmulo (até 30%) | ataque básico |
| 3085 | Furacão de Runaan | motor.js:1718 | acerta mais 2 inimigos com 55% do dano (ou 15% e sem crítico para quem ataca de longe) | ataque básico |
| 6631 | Quebrapassos | motor.js:1719 | a cada 5 s: `0.8 × Dano de Ataque` em **todos** os que o campeão alcança | ataque básico |
| 3074 | Hidra Raivosa | motor.js:1720 | `0.4 × Dano de Ataque` nos outros alcançados | ataque básico |
| 3748 | Hidra Titânica | motor.js:1721 | `0.015 × vida máxima` em todos os alcançados | ataque básico |
| 3075 | Armadura de Espinhos | motor.js:1735 | quem ataca leva `10 + 0.1 × armadura bônus` (aplicado em `inimigoAtaca`) | defesa |
| 6333 | Dança da Morte | motor.js:2701, 1790 | 30% do dano recebido vira sangramento em 3 s (2701); ao abater limpa o sangramento e cura 15% da vida perdida (1790) | defesa |
| 6655 | Eco de Luden | motor.js:1945 | a cada 6 s (`timers.luden`), a próxima habilidade dá `100 + 0.1 × Poder de Habilidade` em até 3 inimigos | habilidade |
| 3102 | Véu da Banshee | motor.js:2698 | bloqueia um golpe de monstro; `timers.banshee = 40` s | defesa |
| 3157 | Ampulheta de Zhonya | motor.js:2722 | vida < 25% do máximo: invulnerável 2,5 s, `timers.zhonya = 120` s | defesa |
| 3053 | Sinal de Sterak | motor.js:2725 | vida < 30%: escudo de `0.6 × vida bônus`, `timers.sterak = 90` s | defesa |
| 3026 | Anjo Guardião | motor.js:2729, 3737 | ao morrer: volta com 50% da vida, `timers.anjo = 300` s (em PvP o servidor decide, 3737) | defesa |

Além destes, há itens que agem sem `tem()`, lendo campos directamente em `atributos()`:

| como age | itens |
|---|---|
| `pct.adPct` (509) | 3172, 3156, 663056 |
| `pct.apPct` (509) | 3152, 4633, 664644 |
| `pct.vidaPct` (509) | 3168, 3190, 8020, 6673 |
| `pct.armPct` (509) | 3174, 3068, 3143 |
| `pct.rmPct` (509) | 3173 |
| `pct.esquiva` (509) | 3170 |
| `pct.penMag` (509) | 3020, 3175 |
| `regenItens` (508, 535) | 1054, 1006, 3801, 3009, 3083 |
| `cdrItens` (508, 537) | 2022, 4629, 3108, 3802, 3158, 3024, 3171 |

Notas de leitura:

- `pct.penMag`, `pct.esquiva` e os `*Pct` entram **crus** — ver a armadilha #1 da §8.
- O `danoCritico` começa em 1,75 (499) e o multiplicador de crítico do campeão pode mudar
  (Yasuo: `critMult 2` e `critDano 0.8`, motor.js:697) — o resultado final está em 541.
- `esquiva` tem tecto de 25% (536); `reducaoRecarga` tecto de 40% (537); `penMagica` tecto de
  60% (529); `velAtaque` tecto de 3,0 (534).

---

## 12. Índice rápido de todos os números

| número | significado | linha |
|---|---|---|
| 0,12 | `BONUS_REFINO` — +12% por nível de refino | 55 |
| 0,12 | apreensão de armadura por ataque (Cutelo Negro) | 1705 |
| 0,15 | bónus de XP por membro do grupo | 143 |
| 0,15 | dano a mais do furioso (aura) | 1106 |
| 0,20 | velocidade a mais do furioso (aura) | 1106 |
| 0,3 / 6 | `POCAO_PVP` — cura e espera em PvP | 43 |
| 0,5 | tecto da persistência (`PERSISTENCIA_TETO`) | 72 |
| 0,65 | `CURA_PVP` — curas em PvP | 1284 |
| 0,05 / 0,025 / 0,006 / 0,015 / 0,04 | `REGRESSAO_REFINO` (+3 em diante) | 62 |
| 0,30 / 0,12 / 0,02 / 0,008 / 0,003 | `CHANCE_REFINO` | 60 |
| 0,01 | `PERSISTENCIA_PASSO` — +1% de chance por falha | 72 |
| 0,01 / 0,001 | `CHANCE_MONTAR` (épico / lendário) | 3160 |
| 3 / 45 | `MULT_CUSTO_MONTAR` | 3131 |
| 4,8 | `CUSTO_LENDARIO_POR_PRECO` | 3134 |
| 1,2 | `VIP.xp`, `VIP.drop`, `VIP.refino` | 145 |
| 1,3 | `ARENA.bonus` — XP e drop em Runeterra | 412 |
| 1,5 / 1,2 | respawn depois do grupo / ao viajar | 1625 / 3046 |
| 2 / 3 / 4 | `gerarGrupo` — tamanho do grupo (2 a 4) | 1124 |
| 0,35 | `NOTURNO.chance` | 1096 |
| 1,4 / 1,25 / 1,8 / 1,5 | noturno: hp / ad / xp / ouro | 1096 |
| 0,05 | `FURIOSO.chance` | 1106 |
| 4 / 1,5 / 1,15 / 5 / 5 / 3 / 2 | furioso: hp / ad / as / xp / ouro / saque / espólios | 1106 |
| 0,015 | chance de chefe por grupo (Rio, Dragão, Barão) | 368, 370, 372 |
| 3 | `TETO_VIDA_ITEM` | 1190 |
| 0,6 | `RM_MONSTRO` | 1179 |
| 4 / 0,15 / 3 / 0,07 / 0,25 | `NIVEL_DIF` | 1184 |
| 100 / (100 + armadura) | mitigação de dano | 1167 |
| 4×10⁻⁵, 0,0005 + 0,00015×t, 0,012 − 0,0005×t | `BRUTO` — chances de drop | 1143 |
| 0,001 / 0,05 / 0,4 | `DROP_CHEFE` | 1145 |
| 150 + 100n + n² | curva de vida | 274 |
| 9 + 4,8n + 0,13n² | curva de dano | 275 |
| 5 + 1,5n | curva de armadura | 276 |
| 30 + 7n | curva de xp | 277 |
| 8 + 3,5n | curva de ouro | 278 |
| 0,4433 × 1,1715^(n−1) | ritmo de XP para subir | 429 |
| 43000 + 4345(n−1) + 17,9(n−1)² | `RITMO_XP` | 427 |
| 0,1 | perda de XP ao morrer | 430 |
| 300 / 900 / 2200 | cura das poções de vida | 262-264 |
| 100 / 280 | cura das poções de mana | 265-266 |
| 40 / 110 / 260 / 30 / 80 | preço das poções | 262-266 |
| 20 / 5 / 2 | mochila: início / níveis / espaços | 35 |
| 1000 | `PILHA` — espólios por espaço | 341 |
| 5 / 4 | espaços equipados / fora a bota | 28 / 29 |
| 3,0 | `VEL_ATAQUE_MAX` | 344 |
| 50 | `NIVEL_MAX` | 27 |
| 0,1 | `CHANCE_PERDER_ITEM` — item que cai ao morrer em Runeterra | 2739 |
| 0,3 | `CHANCE_PERDER_PVP` | 2742 |

---

## 13. O que NÃO foi verificado e o que fica para outro bloco

**NAO VERIFICADO neste documento** (precisaria de outra fonte):

- **As estatísticas-base de cada campeão** — `k.stats`, `adBase`, `adNivel` (motor.js:870-893) vêm de
  `dados.js`, `dados-ezreal.js`, `dados-yasuo.js`, `dados-lux.js`, `dados-katarina.js`,
  `dados-taric.js` e `dados-zac.js`. Só `docs/game-src/dados.js` existe na cópia; os outros 6
  **não estão em `docs/game-src/`**. Sem eles não dá para calcular a vida, o dano, a armadura, a
  mana nem a velocidade de ataque iniciais de um campeão. Fica para o bloco dos campeões.
- As 110 ranks de habilidades (valores por rank de cada campeão) — mesmo problema de ficheiros.
- O que o **servidor** faz (sorteio da qualidade, mercado entre jogadores, cofre, Vilemaw, PvP,
  anti-cheat). O motor roda no navegador; o servidor reconfere. Não li o servidor.
- Os números que aparecem **comentados** no motor mas cuja fonte é um `<scratch>` que não existe na
  cópia (ex. `<scratch>/hud/sim-as.mjs`, `<scratch>/hud/drop-zonas.mjs`, `_raw/sustento.mjs`).

**Fora do meu bloco, mas com ponte para aqui:**

- Combate passo a passo (`passo`, `golpear`, `receberDano`, habilidades) — bloco de combate.
- Chefes e mecânicas (`mecanicaChefe`, `RODIZIO_CHEFE`, `BARAO`) — bloco de combate/chefes.
- Tarefas, diárias, conquistas, mascotes, montaria, cofre, loja — blocos de progressão e economia.
- A função de decisão `(campeão, nível, inventário, região) → (build, barra, poções, resultado
  esperado)` usa este documento como base de dados: curva (§2), coeficientes dos monstros (§3),
  catálogo e preços (§6-§9) e regras de equipamento (§10).

**Divergências encontradas entre o que o motor comenta e o que o motor faz** (documentadas porque
quem confia no comentário erra):

1. `motor.js:1136` diz que o lendário cai "0,004% a 0,016%" e "~1 a cada 10 mil abates". Com o
   `K` do `balanco.js` e o `LENDARIO_TIER` a conta dá **0,0104% a 0,0368%** — ou seja, ~1 em 9600
   na Rota Inferior e ~1 em 2700 no Barão. O código é o que vale.
2. `LENDARIO_TIER = [1, 1, 1.4, 2.7, 2.8, 2.5, 2.5, 2.3]` (1142) não é crescente: o Vermelho
   (tier 4) tem 2,8 e o Rio (tier 5) tem 2,5. A chance de lendário **cai** do Vermelho para o Rio.
4. (Adenda de 2026-10-14 21:15 no AGENTS.md, a reter para o bloco dos chefes) O rodízio do
   Barão dá uma invocação **a cada ~34,3 s**, não a cada 14 s: 14 é o campo `espera` do `invocar`
   (motor.js:3076) e o invocar é 1 de 3 mecânicas — `(0+14)+(1,3+9)+(1+9) = 34,3 s`
   (motor.js:3080, `RODIZIO_CHEFE`).
3. `motor.js:3130` comenta "cada tentativa de montagem custa o ouro da receita multiplicado (intermediário x3, lendário x45)", mas `custoMontar` (3135) usa o
   preço ×4.8 para os lendários e ignora o 45. O 45 só vale se algum dia o lendário não tiver preço.

---

*Documento escrito no dia 1 do projecto, a partir da leitura integral de `docs/game-src/motor.js`
(3791 linhas), `docs/game-src/itens.js` (2583 linhas) e `docs/game-src/balanco.js` (3 linhas).
Não foi usado CDP, browser ou jogo ao vivo. Nada foi escrito em `extension/` nem em `tools/`.*
