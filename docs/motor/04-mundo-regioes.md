
# 04 — O MUNDO, AS REGIÕES E O SPAWN

> **Fonte:** `docs/game-src/motor.js`, lido **por inteiro** (3791 linhas) antes de escrever este documento.
> Todos os números abaixo foram lidos no ficheiro. Cada afirmação traz `ficheiro:linha`.
> Quando uma linha é de outro ficheiro, o nome do ficheiro vem no texto (por exemplo `arena.js:231`).
> **Regra de leitura:** `motor.js:NNNN` sozinho = `docs/game-src/motor.js:NNNN`.
> Documento escrito a 14/10/2026. É a peça do "mundo" da função de decisão
> `(campeão, nível, inventário, região) -> (build, barra, poções, resultado esperado)`.

## 0. Como usar este documento

Para **recalcular o jogo** sobre uma região precisas de 5 coisas, todas aqui:

1. **A CURVA** (`3): vida, dano, armadura, XP e ouro base de um monstro pelo nível.
2. **Os coeficientes da espécie** (`4): `MONSTROS` — o multiplicador de cada monstro sobre a curva.
3. **As faixas de nível** (`2, `6): a `faixa` do jogador e o `nm` dos monstros, de onde sai o nível de cada monstro e o do chefe.
4. **O saque da região** (`10): `BRUTO(tier)` + `DROPS`/`DROPS_AP`.
5. **Os factores de tolerância/castigo** (`9): `NIVEL_DIF`, `fatorXp`/`fatorSaque`.

Tudo o que é **variável** (passível de buff ou nerf no jogo) está marcado **VARIA** e tem de ser lido do
jogo, nunca copiado à mão (é a regra de arquitectura do dono).

---

## 1. O relógio do mundo (dia e noite)

A noite é **do mundo**, igual para todos os jogadores (motor.js:1094). **Não é um ciclo de 16 minutos**:
o comentário de motor.js:1078-1080 ainda diz *"ciclo de 16 min: 9 de dia, 1 de anoitecer, 5 de noite, 1 de
amanhecer"* — **está desactualizado**. O código usa o relógio **real de 24 h** (`CICLO = 86400`,
motor.js:1081) no **horário de Brasília** (`FUSO = -3`, motor.js:1090).

### 1.1 As constantes (motor.js:1081-1090)

| Nome | Valor | Linha |
|---|---|---|
| `CICLO` | 86 400 s (24 h) | motor.js:1081 |
| `HORA` | 3 600 s | motor.js:1082 |
| `FUSO` | −3 (Brasília, sem horário de verão) | motor.js:1090 |

### 1.2 As fórmulas

``
relogio           = segundos desde a meia-noite de Brasília
relogioMundial(ms) = ((ms/1000 + FUSO*3600) mod 86400 + 86400) mod 86400        motor.js:1095

luzDoDia(t):                                                                    motor.js:1083-1089
  t = (relogio mod 86400 + 86400) mod 86400
  se 6,5 h  <= t < 17,5 h  -> 1
  se 17,5 h <= t < 18,5 h  -> 1 - ((t - 63000)/3600) * 0,72
  se 5,5 h  <= t < 6,5 h   -> 0,28 + ((t - 19800)/3600) * 0,72
  senão (18,5 h <= t < 5,5 h) -> 0,28

ehNoite(estado) = luzDoDia(estado.relogio) < 0,6                                  motor.js:1093
``

De onde vem o relógio: o jogo escreve `estado.relogio = relogioMundial(agoraMundo())` (jogo.js:93 e
jogo.js:1559, com o comentário *"dia e noite iguais para todos"*), e
`agoraMundo() = Date.now() + desvioRelogio` (jogo.js:91-92), com
`desvioRelogio = (sessao.agora || Date.now()) - Date.now()` (jogo.js:91) — ou seja, **o relógio do
servidor**, não o do computador do jogador.

### 1.3 A janela exacta da noite (recalculada)

A noite é `luzDoDia < 0,6`:

- começa quando `1 - ((t - 63000)/3600) * 0,72 < 0,6` → `t > 65 000 s` → **depois das 18:03:20**;
- acaba quando `0,28 + ((t - 19800)/3600) * 0,72` deixa de ser < 0,6 → `t < 21 400 s` →
  **antes das 05:56:40**.

| | Intervalo (hora de Brasília) | Duração |
|---|---|---|
| **Noite** (`ehNoite` verdadeiro) | 18:03:20 → 24:00 e 00:00 → 05:56:40 | **11 h 53 min 20 s** (42 800 s) |
| Dia | 05:56:40 → 18:03:20 | 12 h 06 min 40 s (43 600 s) |

Valores da rampagem, para conferir: 6:00 → 0,64 · 6:30 → 1,00 · 12:00 → 1,00 · 17:30 → 1,00 ·
18:00 → 0,64 · 18:30 → 0,28 · 00:00 → 0,28. (`luzDoDia(0) = 0,28` porque a meia-noite cai no
"senão" — motor.js:1088.)

### 1.4 Onde a noite muda o jogo

- **Summoner's Rift:** cada monstro do grupo que **não** seja o furioso tem `35 %` de chance de nascer
  **noturno** (motor.js:1128, com `NOTURNO.chance` de motor.js:1096).
- **Runeterra:** cada monstro que não seja chefe tem `35 %` (`M.ehNoite(estado) && r() < M.NOTURNO.chance`,
  arena.js:247).

---

## 2. `LOCAIS` — os locais do mapa (motor.js:354-379)

`LOCAIS` é uma **lista** de 11 entradas (motor.js:354-379); `LOCAL` é o dicionário por `id` (motor.js:380).
Há **10 locais de caça**: a **Fonte** (base), **8 regiões de caça** e 2 arenas (`arena` = Runeterra e
`aram` = Arena PvP).

| id | Nome | `faixa` (nível ideal do jogador) | `nm` (nível dos monstros) | `tier` | `bioma` | `semente` | `pos` | Chefe (chance) |
|---|---|---|---|---|---|---|---|---|
| `fonte` | Fonte | — (base) | — | — | `base` | — | [0,09; 0,91] | — |
| `rota-inf` | Rota Inferior | [1; 10] | [1; 6] | 0 | `rota` | 1 | [0,52; 0,93] | — |
| `rota-sup` | Rota Superior | [5; 15] | [5; 13] | 1 | `rota` | 2 | [0,07; 0,45] | — |
| `lobos` | Toca dos Lobos | [10; 20] | [10; 18] | 2 | `selva` | 1 | [0,27; 0,56] | — |
| `azul` | Campo Azul | [15; 25] | [15; 23] | 3 | `selva` | 2 | [0,24; 0,42] | — |
| `vermelho` | Campo Vermelho | [20; 30] | [20; 28] | 4 | `selva` | 3 | [0,53; 0,74] | — |
| `rio` | Rio | [25; 35] | [25; 33] | 5 | `rio` | 1 | [0,45; 0,45] | `Arauto do Vale` 1,5 % |
| `dragao` | Fosso do Dragão | [30; 40] | [30; 38] | 6 | `rio` | 2 | [0,67; 0,70] | `Dragão Infernal` 1,5 % |
| `barao` | Covil do Barão | [40; 50] | [40; 48] | 7 | `barao` | 1 | [0,33; 0,29] | `Barão Nashor` 1,5 % |
| `arena` | Runeterra | — | — | — | `mundo` | 1 | [0,77; 0,42] | — |
| `aram` | Arena (PvP 1v1) | — | — | — | `abismo` | 1 | — | — |

**Os três campos que interessam:**

- `faixa` = a faixa de nível **do jogador** para a qual a zona foi feita. Serve para: escolher a zona
  ideal (`zonaIdeal`, motor.js:3267), o `tier` de drop (via `NIVEL_DO_TIER`, motor.js:1138), as tarefas
  (motor.js:3244-3327), o prémio diário (motor.js:3376) e a diária (motor.js:3389-3393).
  **NÃO trava a entrada:** `viajar` (motor.js:3043-3048) só exige que o local exista, que o campeão não
  esteja morto e que seja outro local. Um nível 5 pode ir ao Covil do Barão — e leva o castigo de `9.
- `nm` = a faixa de nível **dos monstros** que nascem lá (motor.js:1117-1119).
- `tier` = 0 a 7, o multiplicador de saque (motor.js:1142-1143).

As "8 regiões" são os 8 locais com `faixa`. Os que têm `arena: true` (`arena` e `aram`) ficam de fora de
tudo o que depende de `faixa` — é por isso que não têm `tier` nem `nm`.

### 2.1 Monstros de cada região (motor.js:357-372)

`monstros` é uma lista de pares `[nome, peso]`; o sorteio é proporcional à soma dos pesos
(motor.js:1122-1123):

| Região | Monstros (peso → fracção do grupo) |
|---|---|
| rota-inf | Tropa Corpo a Corpo (3/5 = 60 %), Tropa Mago (2/5 = 40 %) |
| rota-sup | Tropa Corpo a Corpo (3/6 = 50 %), Tropa Mago (2/6 = 33,33 %), Tropa de Cerco (1/6 = 16,67 %) |
| lobos | Lobo Gigante (100 %) |
| azul | Krug Anciã (2/3 = 66,67 %), Sentinela Azul (1/3 = 33,33 %) |
| vermelho | Brambleback Vermelho (1/3), Lobo Gigante (1/3), Krug Anciã (1/3) |
| rio | Arraía do Rio (50 %), Larva do Vazio (50 %) |
| dragao | Dragão Ancião (filhote) (2/3 = 66,67 %), Larva do Vazio (1/3 = 33,33 %) |
| barao | Criatura do Vazio (2/3 = 66,67 %), Dragão Ancião (filhote) (1/3 = 33,33 %) |

Fórmula do sorteio (motor.js:1122-1123):

``
total = soma dos pesos da região
x = rand() * total
para cada [nome, peso] da lista:  x -= peso ; se x < 0 -> escolhe esse nome
(se nenhum bater, escolhe o primeiro da lista)
``

---

## 3. A CURVA e o AJUSTE — os números base por nível **VARIA**

### 3.1 `ajuste(n)` — a planilha de balanço (motor.js:272, balanco.js:2)

``
ajuste(n) = primeira faixa da BALANCO em que n >= "de" e n <= "ate"
            (se nenhuma bater, a última faixa da lista)
``

A tabela `BALANCO` (gerada de `balanco.csv`, balanco.js:2) — **VARIA**, é planilha:

| de | ate | vida | dano | xp | ouro | drop | xpUpar |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 0,70 | 0,65 | 1 | 1,50 | 3,0 | 0,04 |
| 3 | 4 | 0,72 | 0,68 | 1 | 1,45 | 2,8 | 0,05 |
| 5 | 6 | 0,75 | 0,72 | 1 | 1,40 | 2,6 | 0,08 |
| 7 | 8 | 0,79 | 0,76 | 1 | 1,35 | 2,4 | 0,15 |
| 9 | 10 | 0,83 | 0,80 | 1 | 1,30 | 2,2 | 0,30 |
| 11 | 12 | 0,86 | 0,84 | 1 | 1,25 | 2,0 | 0,50 |
| 13 | 14 | 0,89 | 0,88 | 1 | 1,20 | 1,8 | 0,60 |
| 15 | 16 | 0,92 | 0,91 | 1 | 1,15 | 1,6 | 0,70 |
| 17 | 18 | 0,95 | 0,94 | 1 | 1,10 | 1,4 | 0,80 |
| 19 | 20 | 0,98 | 0,97 | 1 | 1,05 | 1,2 | 0,90 |
| 21 | 60 | 1,00 | 1,00 | 1 | 1,00 | 1,0 | 1,00 |

Notas: **a partir do nível 21 nada muda** (faixa 21-60). Acima do 60 a última faixa continua a valer.
`drop` só entra no saque (`10); `xpUpar` só no XP para subir de nível (motor.js:429).

### 3.2 `CURVA` (motor.js:273-279) **VARIA**

``
CURVA.hp(n)       = (150 + 100*n + 1,0*n^2) * ajuste(n).vida
CURVA.ad(n)       = (  9 + 4,8*n + 0,13*n^2) * ajuste(n).dano
CURVA.armadura(n) = 5 + 1,5*n                    (sem ajuste da planilha)
CURVA.xp(n)       = ( 30 + 7*n)          * ajuste(n).xp
CURVA.ouro(n)     = (  8 + 3,5*n)        * ajuste(n).ouro
``

Valores já calculados com a `BALANCO` actual:

| n | hp | ad | armadura | xp | ouro |
|---|---|---|---|---|---|
| 1 | 175,7 | 9,1 | 6,5 | 37,0 | 17,3 |
| 2 | 247,8 | 12,4 | 8,0 | 44,0 | 22,5 |
| 5 | 506,3 | 26,1 | 12,5 | 65,0 | 35,7 |
| 6 | 589,5 | 30,6 | 14,0 | 72,0 | 40,6 |
| 10 | 1037,5 | 56,0 | 20,0 | 100,0 | 55,9 |
| 13 | 1440,9 | 82,2 | 24,5 | 121,0 | 64,2 |
| 15 | 1725,0 | 100,3 | 27,5 | 135,0 | 69,6 |
| 18 | 2160,3 | 129,3 | 32,0 | 156,0 | 78,1 |
| 20 | 2499,0 | 152,3 | 35,0 | 170,0 | 81,9 |
| 23 | 2979,0 | 188,2 | 39,5 | 191,0 | 88,5 |
| 25 | 3275,0 | 210,3 | 42,5 | 205,0 | 95,5 |
| 28 | 3734,0 | 245,3 | 47,0 | 226,0 | 106,0 |
| 30 | 4050,0 | 270,0 | 50,0 | 240,0 | 113,0 |
| 33 | 4539,0 | 309,0 | 54,5 | 261,0 | 123,5 |
| 35 | 4875,0 | 336,3 | 57,5 | 275,0 | 130,5 |
| 38 | 5394,0 | 379,1 | 62,0 | 296,0 | 141,0 |
| 40 | 5750,0 | 409,0 | 65,0 | 310,0 | 148,0 |
| 45 | 6675,0 | 488,3 | 72,5 | 345,0 | 165,5 |
| 48 | 7254,0 | 538,9 | 77,0 | 366,0 | 176,0 |
| 50 | 7650,0 | 574,0 | 80,0 | 380,0 | 183,0 |

---

## 4. `MONSTROS` — os coeficientes por espécie (motor.js:280-298) **VARIA (coeficientes)**

Todo monstro é `CURVA(nível) x coeficiente` (motor.js:1070-1072). Os campos:

| Espécie | hp | ad | as | armadura | xp | ouro | mágico | distância | chefe |
|---|---|---|---|---|---|---|---|---|---|
| Tropa Corpo a Corpo | 1 | 0,9 | 0,8 | 0,6 | 1 | 1 | não | — | não |
| Tropa Mago | 0,7 | 1,15 | 0,65 | 0,3 | 0,9 | 0,9 | **sim** | 3 | não |
| Tropa de Cerco | 1,8 | 1,5 | 0,5 | 1,2 | 1,6 | 1,8 | não | 4 | não |
| Lobo Gigante | 1,1 | 1,1 | 0,8 | 0,8 | 1,1 | 1 | não | — | não |
| Krug Anciã | 1,5 | 0,8 | 0,6 | 1,5 | 1,2 | 1,2 | não | — | não |
| Sentinela Azul | 2,2 | 1,05 | 0,55 | 1,2 | 2 | 2,2 | **sim** | — | não |
| Brambleback Vermelho | 2,2 | 1,5 | 0,55 | 1,2 | 2 | 2,2 | não | — | não |
| Arraía do Rio | 1,5 | 0,8 | 0,5 | 1,6 | 1,2 | 1,1 | não | — | não |
| Larva do Vazio | 1,1 | 1,05 | 0,8 | 1 | 1,1 | 1 | **sim** | — | não |
| Cria de Vilemaw | 0,6 | 0,8 | 1 | 0,7 | 0,3 | 0,2 | não | — | não |
| Dragão Ancião (filhote) | 1,6 | 1,3 | 0,6 | 1,2 | 1,5 | 1,4 | não | — | não |
| Criatura do Vazio | 1,3 | 1,3 | 0,7 | 1 | 1,4 | 1,3 | **sim** | — | não |
| **Arauto do Vale** | 10 | 2,5 | 0,6 | 1,5 | 12 | 12 | não | — | **chefe** |
| **Dragão Infernal** | 12 | 3 | 0,55 | 1,6 | 14 | 14 | **sim** | — | **chefe** |
| **Barão Nashor** | 16 | 3,2 | 0,5 | 1,8 | 20 | 20 | **sim** | — | **chefe** |

- `as` é a velocidade de ataque **em ataques por segundo**, já em valor final (não é multiplicada pela
  curva): um monstro com `as 0,8` ataca a cada `1/0,8 = 1,25 s` (motor.js:1072 e motor.js:1730).
- `distancia` (motor.js:282-284) é a distância **em tiles** a que o monstro de longe pára: só existe na
  Tropa Mago (3) e na Tropa de Cerco (4). No Rift só é usada pela Parede de Vento (motor.js:2706); em
  Runeterra passa a `distancia + 0,5` (arena.js:246).
- `magico: true` = o dano do monstro é **mágico** (reduzido pela resistência mágica do campeão e não pela
  armadura — motor.js:1733).
- `chefe: true` marca as 3 espécies de chefe (motor.js:295-297). Chefes nunca nascem noturnos nem
  furiosos (`7.3 e `8).

---

## 5. `criarMonstro(nome, n, extra)` — o monstro, campo a campo (motor.js:1065-1075)

``
criarMonstro(nome, n, extra = {}):
  m = MONSTROS[nome]
  devolve {
    nome, nivel: n,
    chefe:   !!m.chefe,
    magico:  !!m.magico,
    hpMax:   CURVA.hp(n) * m.hp,
    hp:      CURVA.hp(n) * m.hp,
    ad:      CURVA.ad(n) * m.ad,
    as:      m.as,
    armadura:CURVA.armadura(n) * m.armadura,
    ouro:    CURVA.ouro(n) * m.ouro * (0,5 + rand()*0,5),      -> sorteio uniforme em [0,5; 1] x a media
    xp:      CURVA.xp(n) * m.xp,
    acumulos: 0, tSangue: 0, reducaoArmadura: 0, lento: 0, chegada: 1,2,
    ataque:  rand()/m.as,                                        -> relogio inicial do ataque
    tocado: false, id: 'm' + (proximoId++), distancia: m.distancia ou 0,
    ...extra                                                     -> extra sobrescreve o que quiser
  }
``

Onde cada campo é usado depois:

| Campo | Para que serve | Linha |
|---|---|---|
| `hpMax`/`hp` | vida total e vida actual | motor.js:1070 |
| `ad` | dano **bruto** por golpe (antes da armadura) | motor.js:1070 |
| `as` | ataques por segundo; o relógio do ataque é `1/as` (mais lento 40 % se estiver lento: `i.ataque -= dt * (lento>0 ? 0,6 : 1)`) | motor.js:1070, 1726-1730 |
| `armadura` | defesa física: `dano * 100/(100 + armadura)` | motor.js:1167, 1202 |
| `ouro` | ouro que dá ao morrer (com sorteio 0,5-1) | motor.js:1071 |
| `xp` | XP que dá ao morrer | motor.js:1072 |
| `chegada` | segundos até o monstro chegar ao campeão (enquanto > 0 não ataca e não é alvo de corpo a corpo) | motor.js:1444-1446, 1619 |
| `ataque` | primeira batida sai num instante aleatório em `[0; 1/as)` | motor.js:1072 |
| `acumulos`/`tSangue` | acúmulos de Hemorragia (até 5) e o tempo dela | motor.js:1274-1282, 1643-1650 |
| `distancia` | alcance do monstro de longe | motor.js:1073 |

**A resistência mágica do monstro** não é um campo próprio: vale `RM_MONSTRO = 0,6` da armadura e só
entra no dano mágico com Poder de Habilidade (motor.js:1179 e motor.js:1202):

``
armadura efectiva do monstro =
   dano fisico :  armadura * (1 - reducaoArmadura) * (1 - penArmadura_do_campeao)
   dano magico com Poder : armadura * 0,6 * (1 - penMagica_do_campeao)
   dano magico sem Poder : 0   (passa inteiro)
``

### 5.1 `statsMonstro` — **não existe no motor**

O nome `statsMonstro` aparece em dois sítios, e **nenhum deles é o motor**:

- `docs/game-src/wiki-dados.js:26-34` — uma reconstrução para a wiki, que importa `M.CURVA` e `M.MONSTROS`
  do motor e devolve `{ hp, ad, arm, xp, ouro, as }`.
- `extension/automation.js:1014` — outra reconstrução, dentro da extensão (não mexi lá: fora do meu bloco).

**A especificação é `criarMonstro` (motor.js:1066-1075).** A reconstrução da wiki é fiel nas contas —
confirma-se linha a linha: `hp = CURVA.hp(n) * m.hp` (wiki-dados.js:28 = motor.js:1070), `ad =
CURVA.ad(n) * m.ad` (motor.js:1070), `arm = CURVA.armadura(n) * m.armadura` (motor.js:1070),
`xp = CURVA.xp(n) * m.xp` (motor.js:1072), `as = m.as` (motor.js:1074) — com uma única diferença, que é
**de conveniente e não de valor**: a wiki escreve o ouro como `CURVA.ouro(n) * m.ouro * 0,75`, que é a
**média** do sorteio do motor `(0,5 + rand()*0,5)` (motor.js:1071). Para simular usa a média; para
reproduzir um abate exacto usa o sorteio.

O `statsMonstro` da wiki ainda aceita três flags que o motor trata noutras funções:

| Flag | Onde o motor aplica | Efeito |
|---|---|---|
| `noturno: true` | motor.js:1097-1101 (`tornarNoturno`) | hp e hpMax x 1,4; ad x 1,25; xp x 1,8; ouro x 1,5 |
| `furioso: true` | motor.js:1107-1110 (`tornarFurioso`) | hp e hpMax x 4; ad x 1,5; as x 1,15; xp x 5; ouro x 5 |
| `guardiao: 'elite' / 'chefe'` | arena.js:252-253 | elite: hp x 15, ad x 1,7, armadura x 1,6; chefe: hp x 3, ad x 1,1, armadura x 1,3 |

---

## 6. O GRUPO e o SPAWN — `gerarGrupo(local, noite, nivelJogador)` (motor.js:1116-1130)

No Summoner's Rift o jogo cria grupos: quando o jogador está num local de caça e não há inimigos vivos,
passado o tempo de respawn nasce um grupo novo (motor.js:1418-1425).

### 6.1 O nível dos monstros (motor.js:1117-1119)

``
[n0, n1] = local.nm                                   // a faixa de nivel dos monstros da regiao

se nivelJogador == null:                              // ninguem passou o nivel (testes, arena)
    nivel = n0 + floor(rand() * (n1 - n0 + 1))        // uniforme na faixa inteira

se nao (o jogo passa estado.nivel, motor.js:1421):
    nivel = max(n0, min(n1, nivelJogador - 2 + floor(rand()*4)))
    // floor(rand()*4) da 0, 1, 2 ou 3, cada um com 25 %
    // -> o monstro nasce 2 abaixo, 1 abaixo, igual ou 1 acima do jogador
    // -> e nunca fora de [n0, n1]
``

Exemplos (jogador dentro da faixa ideal):

| Região | Jogador nível | Nível possível de cada monstro (4 valores, 25 % cada) |
|---|---|---|
| rota-inf | 1 | 1, 1, 1, 2 (preso em [1; 6]) |
| rota-inf | 10 | 6, 6, 6, 6 (preso em [1; 6]) |
| rota-sup | 5 | 5, 5, 5, 6 |
| lobos | 10 | 10, 10, 10, 11 |
| lobos | 20 | 18, 18, 18, 18 |
| azul | 25 | 23, 23, 23, 23 |
| vermelho | 20 | 20, 20, 20, 21 |
| rio | 25 | 25, 25, 25, 26 |
| dragao | 30 | 30, 30, 30, 31 |
| barao | 40 | 40, 40, 40, 41 |
| barao | 50 | 48, 48, 48, 48 |

**Consequência para a função de decisão:** dentro da faixa ideal o monstro está **no máximo 1 nível
acima** do jogador, e por isso `NIVEL_DIF` (`9) nunca morde. Fora da faixa, o nível é **preso** em `n0`
ou `n1` — é aí que o castigo aparece.

### 6.2 O tamanho do grupo (motor.js:1124)

``
qtd      = 2 + floor(rand()*3)        // 2, 3 ou 4, cada um com 1/3 -> media 3 monstros
furioso  = (rand() < 0,05) ? floor(rand()*qtd) : -1     //   indice do furioso, ou nenhum
``

O número `2 + ...` e o `3` estão **inline** em motor.js:1124 — não existe nenhuma constante
`grupoSpawn` no motor (a extensão guarda uma cópia manual: `inject.js:138`
`meta.grupoSpawn = { base: 2, rand: 3 }`, com o comentário "inline no motor"). Se a extensão precisar do
número, tem de o ler do motor; o valor de hoje é **2 e 3**.

O `chegada` de cada monstro do grupo (`1,2 + k * 0,25`, motor.js:1126) é o segundo em que ele chega:
o 1.º em 1,2 s, o 2.º em 1,45 s, o 3.º em 1,7 s, o 4.º em 1,95 s. A isso soma-se o bónus do campeão:
`chegadaExtra` (motor.js:872, 877 — 1,2 s para o Ezreal e para a Lux) aplicado em motor.js:1423.
Ou seja, com um atirador os monstros demoram **1,2 s mais** a chegar.

### 6.3 A ordem das decisões dentro do grupo (motor.js:1124-1129)

Para cada posição `k` do grupo, por ordem:

1. `criarMonstro(sortear(), nivel(), { chegada: 1,2 + k*0,25 })` (motor.js:1126).
2. se `k === furioso` → `tornarFurioso(m)` e **acaba aí** (motor.js:1127).
3. senão, se `noite` e `rand() < 0,35` → `tornarNoturno(m)` (motor.js:1128).

Ou seja: **furioso e noturno nunca coexistem** no mesmo monstro (o furioso é decidido primeiro e a
função sai com `return`).

### 6.4 O CHEFE no Rift (motor.js:1120-1121)

A **primeira** coisa que `gerarGrupo` faz é o sorteio do chefe:

``
se local.chefe e rand() < local.chefe[1]:            // local.chefe = [nome, chance]
    devolve [criarMonstro(local.chefe[0],
             nivelJogador == null ? n1 + 2
                                  : max(n0 + 2, min(n1 + 2, nivelJogador + 4)),
             { chegada: 1,8 })]
``

- **Chance:** só o Rio, o Dragão e o Barão têm chefe, e a chance é **1,5 % = 0,015** por grupo
  (motor.js:368, 370, 372).
- **Um grupo de chefe tem 1 monstro só** (não há grupo + chefe ao mesmo tempo).
- **Nível do chefe** (`max(n0+2; min(n1+2; nivelJogador+4))`):
  - se o jogador está **na ou abaixo** da faixa ideal, o `+4` manda e o chefe nasce a
    `nivelJogador + 4`, mas preso em `[n0+2; n1+2]`;
  - se o jogador está **acima** da faixa, o `n1+2` manda e o chefe nasce no topo da zona + 2.
- O `chegada` do chefe é **1,8 s** (motor.js:1121), contra 1,2 s dos comuns.
- O chefe **nunca** é noturno nem furioso (as duas decisões estão dentro do bloco que `return` antes —
  motor.js:1121-1129).

Exemplos de nível do chefe:

| Região | Jogador | Nível do chefe | `NIVEL_DIF` resultante (`9) |
|---|---|---|---|
| rio | 25 | 29 (= 25+4) | d = 0 |
| rio | 35 | 35 (= n1+2) | d = 0 |
| rio | 50 | 35 | d = 0 (jogador acima → sem castigo) |
| barao | 23 | 42 (= n0+2, preso) | **d = 15** → chefe bate 3x, jogador dá 25 % |
| barao | 50 | 50 (= 50+4) | d = 0 |

O caso do nível 23 no Barão é exactamente o que o dono reportou e que motivou `NIVEL_DIF`
(motor.js:1180: *"um nível 23 com lendários matava o Barão em 15 s"*).

---

## 7. A NOITE e o FURIOSO

### 7.1 `NOTURNO` (motor.js:1096) **VARIA**

| Campo | Valor | Efeito no monstro |
|---|---|---|
| `chance` | 0,35 | 35 % por monstro (de noite, e só se não for o furioso) |
| `hp` | 1,4 | hp e hpMax × 1,4 |
| `ad` | 1,25 | dano por golpe × 1,25 |
| `xp` | 1,8 | XP × 1,8 |
| `ouro` | 1,5 | ouro × 1,5 |

``
tornarNoturno(m):                                    motor.js:1097-1101
  m.noturno = true
  m.hp *= 1,4 ; m.hpMax *= 1,4 ; m.ad *= 1,25 ; m.xp *= 1,8 ; m.ouro *= 1,5
``

Notar que `hp` e `hpMax` são multiplicados **os dois** — o monstro noturno não aparece ferido.

### 7.2 `FURIOSO` (motor.js:1106) **VARIA** — só no Summoner's Rift

| Campo | Valor | Efeito |
|---|---|---|
| `chance` | 0,05 | 5 % por **grupo** (não por monstro): um dos monstros do grupo nasce furioso |
| `hp` | 4 | hp e hpMax × 4 |
| `ad` | 1,5 | dano por golpe × 1,5 |
| `as` | 1,15 | velocidade de ataque × 1,15 (bate mais rápido) |
| `xp` | 5 | XP × 5 |
| `ouro` | 5 | ouro × 5 |
| `saque` | 3 | o saque (itens) é sorteado 3 vezes |
| `extras` | 2 | as runas e os espólios são sorteados 2 vezes |
| `aura: { ad: 1,25, as: 1,2 }` | — | enquanto o furioso está vivo, os **outros** do grupo batem 25 % mais forte e 20 % mais rápido |

``
tornarFurioso(m):                                    motor.js:1107-1110
  m.furioso = true
  m.hp *= 4 ; m.hpMax *= 4 ; m.ad *= 1,5 ; m.as *= 1,15 ; m.xp *= 5 ; m.ouro *= 5
``

A aura (motor.js:1729-1730 e motor.js:1734):

``
aura = (m não é furioso) e (existe outro furioso vivo no grupo) ? FURIOSO.aura : null
relogio do ataque do monstro : 1 / (as * (aura ? aura.as : 1))       // 1,2x mais rapido
dano do golpe do monstro     : mitigar(ad * (aura ? aura.ad : 1), defesa)   // 1,25x mais forte
``

**A probabilidade real de encontrar furiosos** (para contar XP/hora e ouro/hora):

- por grupo: `P(grupo tem furioso) = 0,05`;
- por monstro: `0,05 / qtd` (com qtd médio 3) ≈ **1,67 %**;
- comentário do motor (motor.js:1102-1105): *"no Summoner's Rift, em FURIOSO.chance dos grupos (sem
  chefe) um dos monstros nasce furioso"* — e `fúria e noturno nunca ao mesmo tempo`.

**O furioso NÃO existe em Runeterra:** não há nenhuma referência a `FURIOSO` em `arena.js` (verificado
por pesquisa no ficheiro inteiro).

### 7.3 As repetições do saque (`aMais`, motor.js:1113)

A mesma função conta as repetições extras do saque, das runas e dos espólios:

``
aMais(i, n, f) = Array.from({ length: i.furioso ? n - 1 : i.noturno ? 1 : 0 }, f).flat()

// saque de itens  : aMais(i, FURIOSO.saque = 3, ...)   -> furioso: 2 extra (3 voltas); noturno: 1 extra (2 voltas)
// espolios e runas: aMais(i, FURIOSO.extras = 2, ...)  -> furioso: 1 extra (2 voltas); noturno: 1 extra (2 voltas)
// normal          : 0 extra
``

Uso em motor.js:1770 (itens), motor.js:1776 (espólios) e motor.js:1781 (runas). Atenção: nas voltas
extra o sorteio de itens é feito com `chefe: false` (motor.js:1770) — o bónus de chefe não se repete.

---

## 8. O RESPAWN (quanto tempo demora o grupo seguinte)

| Situação | Valor | Linha |
|---|---|---|
| Início de um combate novo (`criarCombate`) | `respawn: 1` s | motor.js:1061 |
| Depois de o grupo ser todo morto | `respawn = 1,5` s | motor.js:1625 |
| Depois de viajar para outro local (`viajar`) | `respawn = 1,2` s | motor.js:3046 |
| Morrer | volta para a Fonte e esvazia os inimigos | motor.js:1346 |

``
// motor.js:1418-1425, dentro do passo
se nao ha inimigos:
    respawn -= dt
    se respawn > 0 -> sai (ainda nao nasce nada)
    inimigos = gerarGrupo(local, ehNoite(estado), estado.nivel)
    para cada i: i.chegada += kit(estado).chegadaExtra ou 0
// motor.js:1625, no fim do passo
se todos os inimigos estao mortos: { inimigos = [] ; respawn = 1,5 }
``

Duas coisas que vale a pena reparar:

- O relógio do respawn **só corre enquanto não há inimigos** (motor.js:1418-1420). Se sobrar um monstro
  vivo, não há contagem.
- **Na Fonte não há combate**: o passo sai antes (`if (local.base) return`, motor.js:1403) — o campeão
  fica parado até o jogador mandar caçar.
- Em Runeterra o respawn é outro, por ponto de nascimento: `MUNDO.respawn = [20, 35]` s (arena.js:26) e
  os monstros comuns voltam **assim que o campeão se afasta** (arena.js:273).

### 8.1 Viajar (motor.js:3042-3048)

``
viajar(estado, c, id):
  exige LOCAL[id] existir, c.darius.morto <= 0 e id != estado.local
  se LOCAL[id].base -> c.darius.disciplina = 0        // voltar a base zera a Disciplina da Legiao
  estado.local = id ; c.inimigos = [] ; c.respawn = 1,2 ; c.darius.recall = 0
``

---

## 9. `NIVEL_DIF` — a tolerância e o castigo (motor.js:1180-1187)

### 9.1 As constantes (motor.js:1184) **VARIA**

| Campo | Valor | Significado |
|---|---|---|
| `livre` | 4 | quantos níveis de diferença são de graça |
| `danoMonstro` | 0,15 | +15 % do dano do monstro **por nível** acima do jogador |
| `maxDanoMonstro` | 3 | **tecto**: o monstro nunca bate mais de 3x |
| `danoJogador` | 0,07 | −7 % do dano do jogador **por nível** de diferença |
| `minDanoJogador` | 0,25 | **piso**: o jogador nunca dá menos de 25 % |

### 9.2 As três fórmulas (motor.js:1185-1187)

``
difNivel(estado, m)          = max(0, m.nivel - estado.nivel - 4)
fatorDanoMonstro(estado, m)  = d ? min(3, 1 + 0,15*d) : 1        // multiplica o dano que o monstro da
fatorDanoJogador(estado, m)  = d ? max(0,25, 1 - 0,07*d) : 1     // multiplica o dano que o jogador da
   em que d = difNivel(estado, m)
``

Tabela completa (recalculada):

| d (níveis acima, já com os 4 de graça) | dano do monstro | dano do jogador |
|---|---|---|
| 0 (até 4 níveis acima) | 1,00× | 1,00× |
| 1 | 1,15× | 0,93× |
| 2 | 1,30× | 0,86× |
| 3 | 1,45× | 0,79× |
| 4 | 1,60× | 0,72× |
| 5 | 1,75× | 0,65× |
| 6 | 1,90× | 0,58× |
| 7 | 2,05× | 0,51× |
| 8 | 2,20× | 0,44× |
| 9 | 2,35× | 0,37× |
| 10 | 2,50× | 0,30× |
| 11 | 2,65× | 0,25× (piso) |
| 12 | 2,80× | 0,25× |
| 13 | 2,95× | 0,25× |
| 14 ou mais | **3,00×** (tecto) | **0,25×** (piso) |

### 9.3 Onde é aplicado

- **Dano que o jogador dá:** `dano *= fatorDanoJogador(estado, alvo)` dentro de `golpear`
  (motor.js:1221) — vale para **todos** os golpes (ataque básico, habilidades e itens).
- **Dano que o monstro dá:** `if (!doSangramento && origem?.nivel) dano *= fatorDanoMonstro(...)` em
  `receberDano` (motor.js:2696).
- **Golpes dos chefes:** a mecânica do chefe passa o mesmo factor às fórmulas `fis(k)` e `mag(k)`
  (motor.js:3099-3101).

### 9.4 Onde NÃO é aplicado

- **Sangramento (Hemorragia) e queimas:** passam com `doSangramento = true` e safam
  (motor.js:2696, 1631-1648).
- **PvP:** o dano entre jogadores vem do servidor (`danoPvp`, motor.js:3723-3740) e não usa estes
  factores.
- **Vilemaw:** confirmado — o golpe dela chama `receberDano(..., false, magico, ORIGEM_VM)`
  (arena.js:1750) e `ORIGEM_VM = { nome: 'Vilemaw', id: 'vilemaw' }` **não tem campo `nivel`**
  (arena.js:1746), portanto `origem?.nivel` é falso em motor.js:2696 e o factor não entra.
- O próprio comentário de motor.js:1182 diz: *"Vale no Rift e em Runeterra (chefes e guardiões também);
  a Vilemaw e o PvP, não."* — **confirmei as duas excepções no código.**

### 9.5 O outro castigo: caçar abaixo do nível (`fatorXp`/`fatorSaque`, motor.js:420-424)

Este é o castigo para o lado oposto —Monstro **abaixo** do jogador:

``
fatorXp(nivelJogador, nivelMonstro):
   dif = nivelJogador - nivelMonstro
   se dif > 5 -> max(0,1, 1 - 0,1*(dif - 5))
   senao     -> 1

fatorSaque = fatorXp        (alias, motor.js:424) — multiplica ouro, chance de drop, espolios e runas
``

| dif (jogador − monstro) | 0-5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `fatorXp`/`fatorSaque` | 1,00 | 0,90 | 0,80 | 0,70 | 0,60 | 0,50 | 0,40 | 0,30 | 0,20 | 0,10 | **0,10** (piso) |

Aplicado em: XP do abate (motor.js:1765), ouro do abate (motor.js:1758) e em `mult`/`multEsp` do saque
(motor.js:1764). Por isso um nível 50 a caçar na Rota Inferior recebe **10 %** de tudo
(motor.js:423: *"um nível 45 farmava lendário e ouro na Rota Inferior, 10x mais rápido que no Barão"*).

### 9.6 O terceiro ajuste: o tecto dos itens de % de vida (motor.js:1188-1191)

Precisas disto para calcular o dano de itens tipo Liandry, Rei Destruído ou Matéria Instável do Zac
contra chefes:

``
TETO_VIDA_ITEM = 3
vidaRefItem(alvo, vida = alvo.hpMax) = min(vida, 3 * CURVA.hp(alvo.nivel ou 1))
``

Ou seja: a porcentagem de vida dos itens nunca conta sobre mais de **3 curvas de vida** do nível do alvo
(motor.js:1188-1189: *"senão, quanto mais vida o monstro (chefe, guardião, furioso), mais o item rendia"*).

---

## 10. O SAQUE DE ITENS — o que cai em cada região

### 10.1 `DROPS` e `DROPS_AP` (motor.js:383-406) **VARIA**

São duas listas de 8 regiões, cada uma com 3 raridades (`basico` = componente, `epico` = intermediário,
`lendario` = item final). `DROPS` é o saque dos campeões de **ataque** (Darius, Ezreal, Yasuo) e
`DROPS_AP` o dos campeões de **magia** (Lux, Katarina, Taric, Zac) — motor.js:393-396 explica a escolha:
*"o Campo Azul, o Dragão e o Barão (e o Vermelho para mago) ganharam uma bota lendária no saque"*, e
motor.js:396: *"Lobos, Selva Rubra e Rio ganharam um lendário de tanque (Solari, Randuin, Máscara
Abissal) para o Zac e o Taric"*.

As duas listas são coladas nos objectos de `LOCAIS` no fim (motor.js:407-408):

``
para cada local l de LOCAIS:
   se DROPS[l.id]    existir -> l.drops   = DROPS[l.id]
   se DROPS_AP[l.id] existir -> l.dropsAp = DROPS_AP[l.id]
``

E a escolha da lista é pela classe do campeão (motor.js:1150-1152):

``
classeDe(estado) = kit(estado).magia ? 'ap' : 'ad'
itensPorRaridade(rar, local, classe) =
   classe == 'ap' ? (local.dropsAp[rar] ou POR_CLASSE.ap[rar])
                  : (local.drops[rar]   ou POR_CLASSE.ad[rar])
``

`POR_CLASSE` (motor.js:52 e motor.js:408) é a lista **geral** de todos os itens da classe/raridade — só
entra se a região não tiver aquele nível de raridade na sua lista (por exemplo, se uma região não tiver
`lendario` definido).

**A tabela completa** (coluna `ad` = `DROPS`, coluna `ap` = `DROPS_AP`).

| Região | Raridade | Saque `ad` (campeão de ataque) | Saque `ap` (campeão de magia) |
|---|---|---|---|
| `rota-inf` | `1036` Espada Longa<br>`1028` Cristal de Rubi<br>`1042` Adaga<br>`1029` Couraça de Pano<br>`2022` Partícula Brilhante<br>`1001` Botas<br>`1054` Escudo de Doran | `1052` Tomo Amplificador<br>`1027` Cristal de Safira<br>`1028` Cristal de Rubi<br>`1029` Couraça de Pano<br>`2022` Partícula Brilhante<br>`1001` Botas<br>`1056` Anel de Doran |
| | `3077` Tiamat<br>`3144` Estilingue do Patrulheiro<br>`3047` Botas Galvanizadas de Aço<br>`3140` Bandana de Mercúrio | `3916` Orbe do Oblívio<br>`3108` Códex Demoníaco<br>`3020` Sapatos do Feiticeiro<br>`3140` Bandana de Mercúrio |
| | `6631` **Quebrapassos**<br>`3078` **Força da Trindade**<br>`3174` **Mobilização Blindada** | `6655` **Eco de Luden**<br>`3116` **Cetro de Cristal de Rylai**<br>`3174` **Mobilização Blindada** |
| `rota-sup` | `1036` Espada Longa<br>`1028` Cristal de Rubi<br>`1033` Manto Anula-Magia<br>`1006` Pérola do Rejuvenescimento<br>`1018` Capa da Agilidade<br>`1120` Elmo de Doran | `1052` Tomo Amplificador<br>`1027` Cristal de Safira<br>`1028` Cristal de Rubi<br>`1033` Manto Anula-Magia<br>`1006` Pérola do Rejuvenescimento<br>`1120` Elmo de Doran<br>`1054` Escudo de Doran |
| | `3044` Fago<br>`3057` Fulgor<br>`1053` Cetro Vampírico<br>`3133` Martelo de Guerra de Caulfield<br>`3006` Grevas do Berserker | `3802` Capítulo Perdido<br>`3113` Cintilação Etérea<br>`3145` Alternador Hextec<br>`3158` Botas Ionianas da Lucidez |
| | `3078` **Força da Trindade**<br>`3074` **Hidra Raivosa**<br>`3172` **Grevas Bélicas** | `3116` **Cetro de Cristal de Rylai**<br>`3003` **Cajado do Arcanjo**<br>`3171` **Lucidez Escarlate** |
| `lobos` | `1042` Adaga<br>`1037` Picareta<br>`1018` Capa da Agilidade<br>`1029` Couraça de Pano<br>`1001` Botas | `1052` Tomo Amplificador<br>`3070` Lágrima da Deusa<br>`1029` Couraça de Pano<br>`1028` Cristal de Rubi<br>`1001` Botas |
| | `3051` Machado Termestre<br>`3086` Zelo<br>`1043` Arco Recurvo<br>`2019` Sigilo de Aço<br>`3009` Botas da Rapidez<br>`3105` Égide da Legião | `3108` Códex Demoníaco<br>`4630` Joia da Ruína<br>`3147` Máscara Assustadora<br>`2508` Cinzas do Destino<br>`3009` Botas da Rapidez<br>`3105` Égide da Legião |
| | `3046` **Dançarina Fantasma**<br>`6333` **Dança da Morte**<br>`3170` **Marcha Célere** | `3100` **Perdição de Lich**<br>`6653` **Tormento de Liandry**<br>`3170` **Marcha Célere**<br>`3190` **Medalhão dos Solari de Ferro** |
| `azul` | `1033` Manto Anula-Magia<br>`1006` Pérola do Rejuvenescimento<br>`2022` Partícula Brilhante<br>`1028` Cristal de Rubi<br>`1120` Elmo de Doran | `1033` Manto Anula-Magia<br>`1006` Pérola do Rejuvenescimento<br>`2022` Partícula Brilhante<br>`1028` Cristal de Rubi<br>`1027` Cristal de Safira<br>`1056` Anel de Doran |
| | `3067` Gema Ardente<br>`3211` Capuz do Espectro<br>`3066` Couraça Lunar Alada<br>`1011` Cinto do Gigante<br>`3111` Passos de Mercúrio<br>`3801` Braçadeira Cristalina | `3802` Capítulo Perdido<br>`3067` Gema Ardente<br>`3113` Cintilação Etérea<br>`1011` Cinto do Gigante<br>`3111` Passos de Mercúrio<br>`3801` Braçadeira Cristalina |
| | `3065` **Semblante Espiritual**<br>`3071` **Cutelo Negro**<br>`8020` **Máscara Abissal**<br>`3190` **Medalhão dos Solari de Ferro**<br>`3174` **Mobilização Blindada** | `3003` **Cajado do Arcanjo**<br>`3165` **Morellonomicon**<br>`3065` **Semblante Espiritual**<br>`8020` **Máscara Abissal**<br>`3190` **Medalhão dos Solari de Ferro**<br>`3171` **Lucidez Escarlate** |
| `vermelho` | `1036` Espada Longa<br>`1037` Picareta<br>`1038` Espada G. p. C.<br>`1028` Cristal de Rubi<br>`1054` Escudo de Doran | `1026` Varinha Explosiva<br>`1052` Tomo Amplificador<br>`1028` Cristal de Rubi<br>`1120` Elmo de Doran |
| | `2021` Tunelizador<br>`3077` Tiamat<br>`3035` Último Sussurro<br>`6670` Aljava Vespertina<br>`3008` Grevas Vorazes | `2508` Cinzas do Destino<br>`3145` Alternador Hextec<br>`2420` Armaguarda da Caçadora<br>`3147` Máscara Assustadora<br>`3020` Sapatos do Feiticeiro |
| | `3748` **Hidra Titânica**<br>`2501` **Armadura Sangrenta do Suserano**<br>`3072` **Sedenta por Sangue**<br>`3168` **Caminho Imortal** | `4645` **Chama Sombria**<br>`6653` **Tormento de Liandry**<br>`3102` **Véu da Banshee**<br>`3152` **Explocinturão Hextec**<br>`3175` **Sapatos Enfeitiçados**<br>`3143` **Presságio de Randuin** |
| `rio` | `1042` Adaga<br>`1018` Capa da Agilidade<br>`1038` Espada G. p. C.<br>`1001` Botas | `1026` Varinha Explosiva<br>`1052` Tomo Amplificador<br>`3070` Lágrima da Deusa<br>`1001` Botas |
| | `3086` Zelo<br>`6670` Aljava Vespertina<br>`3144` Estilingue do Patrulheiro<br>`1043` Arco Recurvo<br>`3158` Botas Ionianas da Lucidez<br>`3024` Broquel Glacial | `4630` Joia da Ruína<br>`3916` Orbe do Oblívio<br>`4632` Barreira Verdejante<br>`3113` Cintilação Etérea<br>`3158` Botas Ionianas da Lucidez<br>`3024` Broquel Glacial |
| | `3085` **Furacão de Runaan**<br>`3153` **Espada do Rei Destruído**<br>`3036` **Lembranças do Lorde Dominik**<br>`3156` **Mandíbula de Malmortius**<br>`3173` **Esmagadores Acorrentados** | `3135` **Cajado do Vazio**<br>`4629` **Ímpeto Cósmico**<br>`3157` **Ampulheta de Zhonya**<br>`3175` **Sapatos Enfeitiçados**<br>`3173` **Esmagadores Acorrentados**<br>`8020` **Máscara Abissal** |
| `dragao` | `1037` Picareta<br>`1038` Espada G. p. C.<br>`1029` Couraça de Pano<br>`1028` Cristal de Rubi<br>`1120` Elmo de Doran | `1026` Varinha Explosiva<br>`1058` Bastão Desnecessariamente Grande<br>`1029` Couraça de Pano<br>`1028` Cristal de Rubi<br>`1120` Elmo de Doran |
| | `1031` Cota de Malha<br>`3076` Colete Espinhoso<br>`2019` Sigilo de Aço<br>`3133` Martelo de Guerra de Caulfield<br>`3047` Botas Galvanizadas de Aço<br>`3140` Bandana de Mercúrio | `2420` Armaguarda da Caçadora<br>`3145` Alternador Hextec<br>`4632` Barreira Verdejante<br>`3108` Códex Demoníaco<br>`3047` Botas Galvanizadas de Aço<br>`3140` Bandana de Mercúrio |
| | `3075` **Armadura de Espinhos**<br>`3742` **Couraça do Defunto**<br>`6610` **Céu Dividido**<br>`3068` **Égide de Fogo Solar**<br>`3143` **Presságio de Randuin**<br>`663056` **Coroa do Rei Demoníaco**<br>`3172` **Grevas Bélicas** | `3157` **Ampulheta de Zhonya**<br>`4645` **Chama Sombria**<br>`3075` **Armadura de Espinhos**<br>`3068` **Égide de Fogo Solar**<br>`664644` **Coroa da Rainha Despedaçada**<br>`3175` **Sapatos Enfeitiçados** |
| `barao` | `1038` Espada G. p. C.<br>`1037` Picareta<br>`1018` Capa da Agilidade<br>`1054` Escudo de Doran | `1058` Bastão Desnecessariamente Grande<br>`1026` Varinha Explosiva<br>`1052` Tomo Amplificador<br>`1054` Escudo de Doran |
| | `3035` Último Sussurro<br>`6670` Aljava Vespertina<br>`3133` Martelo de Guerra de Caulfield<br>`1011` Cinto do Gigante<br>`3006` Grevas do Berserker<br>`3111` Passos de Mercúrio | `4630` Joia da Ruína<br>`3802` Capítulo Perdido<br>`2420` Armaguarda da Caçadora<br>`1011` Cinto do Gigante<br>`3020` Sapatos do Feiticeiro<br>`3111` Passos de Mercúrio |
| | `3031` **Gume do Infinito**<br>`3026` **Anjo Guardião**<br>`3053` **Sinal de Sterak**<br>`6673` **Arco-escudo Imortal**<br>`3083` **Armadura de Warmog**<br>`3168` **Caminho Imortal** | `3089` **Capuz da Morte de Rabadon**<br>`3135` **Cajado do Vazio**<br>`3157` **Ampulheta de Zhonya**<br>`4633` **Criafendas**<br>`3083` **Armadura de Warmog**<br>`3171` **Lucidez Escarlate** |

### 10.2 A chance de cada raridade — `BRUTO(tier)` e `chancesDrop` (motor.js:1138-1149) **VARIA**

A chance não depende da lista de itens: depende do `tier` (0 a 7) e da planilha.

Passo 1 — o nível de referência de cada tier (motor.js:1138):

``
NIVEL_DO_TIER = { 0: 5, 1: 10, 2: 15, 3: 20, 4: 25, 5: 30, 6: 35, 7: 45 }
   // = meio da faixa ideal de cada regiao, arredondado para baixo:
   //   rota-inf [1;10]->5  rota-sup [5;15]->10  lobos [10;20]->15  azul [15;25]->20
   //   vermelho [20;30]->25  rio [25;35]->30  dragao [30;40]->35  barao [40;50]->45
``

Passo 2 — o multiplicador da planilha (motor.js:1143, chamado `k`):

| Região | tier | nível de referência | `ajuste(n).drop` (`k`) |
|---|---|---|---|
| rota-inf | 0 | 5 | **2,6** |
| rota-sup | 1 | 10 | **2,2** |
| lobos | 2 | 15 | **1,6** |
| azul | 3 | 20 | **1,2** |
| vermelho | 4 | 25 | **1,0** |
| rio | 5 | 30 | **1,0** |
| dragao | 6 | 35 | **1,0** |
| barao | 7 | 45 | **1,0** |

Passo 3 — a chance bruta (motor.js:1143) e o coeficiente por tier (motor.js:1142):

``
LENDARIO_TIER = [1, 1, 1,4, 2,7, 2,8, 2,5, 2,5, 2,3]      // por tier 0..7

BRUTO(tier):
   k = ajuste(NIVEL_DO_TIER[tier]).drop
   lendario = 4e-5 * 4^(tier/7) * k * LENDARIO_TIER[tier]
   epico    = (0,0005 + 0,00015*tier) * k
   basico   = (0,012 - 0,0005*tier) * k
``

Passo 4 — as chances finais, já com a exclusão em cadeia (motor.js:1146-1149):

``
chancesDrop(local, mult = 1):
   c = BRUTO(local.tier)
   l = min(1, c.lendario * mult)
   e = min(1, c.epico    * mult)
   b = min(1, c.basico   * mult)
   devolve {
     lendario: l,
     epico:    (1 - l) * e,
     basico:   (1 - l) * (1 - e) * b
   }
``

Os valores **recalculados** (sem `mult`, monstro comum, sem VIP):

| Região | tier | lendário | épico | básico | 1 em quantos abates cai um lendário |
|---|---|---|---|---|---|
| rota-inf | 0 | **0,010400 %** | 0,129986 % | 3,115620 % | 1 em ~9 615 |
| rota-sup | 1 | **0,010727 %** | 0,142985 % | 2,526111 % | 1 em ~9 322 |
| lobos | 2 | **0,013315 %** | 0,127983 % | 1,757513 % | 1 em ~7 511 |
| azul | 3 | **0,023476 %** | 0,113973 % | 1,258268 % | 1 em ~4 260 |
| vermelho | 4 | **0,024732 %** | 0,109973 % | 0,998653 % | 1 em ~4 043 |
| rio | 5 | **0,026918 %** | 0,124966 % | 0,948557 % | 1 em ~3 715 |
| dragao | 6 | **0,032813 %** | 0,139954 % | 0,898445 % | 1 em ~3 048 |
| barao | 7 | **0,036800 %** | 0,154943 % | 0,848370 % | 1 em ~2 717 |

Chance de sair **qualquer** item num abate comum (`lendário + épico + básico`): de **3,25 %** na Rota
Inferior a **1,04 %** no Covil do Barão.

> **Armadilha de leitura:** o comentário de motor.js:1134-1136 diz *"lendário de 0,004 % a 0,016 % ...
> épico de 0,05 % a 0,155 %, básico (componente) de 1,2 % a 0,85 %"*. Esses são os **coeficientes antes
> da planilha e antes do `LENDARIO_TIER`** — não é o que o jogo aplica. O que o jogo aplica é a tabela
> de cima. A diferença é grande no lendário (0,0368 % contra 0,016 %) e vem do `k` do Barão (2,6 na Rota!)
> e do bónus de `LENDARIO_TIER`. **Confirmação independente:** 1 lendário a cada ~9 615 abates na Rota
> Inferior bate com o comentário de motor.js:1136 (*"~1 a cada 10 mil abates"*).

### 10.3 O sorteio em si — `sortearLoot` (motor.js:1153-1165)

``
sortearLoot(local, chefe, mult = 1, classe = 'ad'):

se chefe:
   para cada rar de ['lendario','epico','basico']:
       se rand() < DROP_CHEFE[rar] * mult -> sorteia 1 item daquela raridade
   // ATENCAO: as tres rodadas sao independentes -> o chefe pode dar 3 itens (um de cada raridade)

se nao (monstro comum):
   c = BRUTO(tier)
   se rand() < c.lendario*mult -> 1 lendario
   senao se rand() < c.epico*mult -> 1 epico
   senao se rand() < c.basico*mult -> 1 basico
   // no maximo 1 item por abate
``

O item dentro da raridade é **uniforme** (motor.js:1132 e motor.js:1155-1165) e a classe escolhida é a do
campeão.

### 10.4 `DROP_CHEFE` — o saque do chefe (motor.js:1144-1145) **VARIA**

| Raridade | Chance |
|---|---|
| lendário | **0,1 %** (0,001) |
| épico | **5 %** (0,05) |
| básico | **40 %** (0,4) |

O comentário de motor.js:1144 diz *"0,1 % de lendário (10x um monstro comum)"*: confere — no Barão o
monstro comum dá 0,0368 %, e o chefe dá 0,1 %.

### 10.5 A cadeia completa de multiplicadores do saque (motor.js:1758-1783)

``
mult    = (VIP ? 1,2 : 1) * bonus * fatorSaque(nivelJogador, nivelMonstro)     // itens
multEsp = (VIP ? 1,2 : 1) * fatorSaque(...)                                     // espolios e runas
multIt  = mult * (1 + bonusMascote(itens))                                      // Aranhinha: +0,25 % por nivel

ouro do abate = i.ouro * a.ouroMult * fatorSaque(...)
xp do abate   = i.xp * fatorXp(...) * (VIP ? 1,2 : 1) * bonus * bonusXp
                * bonusTwitchXp * bonusEventoXp
``

- `VIP.drop = 1,2` e `VIP.xp = 1,2` (motor.js:145).
- `bonus` e `bonusXp` são 1 no Rift (motor.js:1624 chama `processarAbates(estado, c, a, local)` sem eles).
  Em Runeterra valem 1,3 e o bónus de grupo/PK (`14).
- No Rift, para um monstro **do teu nível**, `fatorSaque = 1` (`9.5) — o multiplicador é 1 (ou 1,2 com VIP).
- A **Aranhinha** dá `itens: 0,0025 * nivel` (motor.js:3525) — até +5 % de chance de item no nível 20.

### 10.6 `fatorSaque` e a mochila (motor.js:1770-1779)

Cada item sorteado tenta entrar na mochila. Se não houver espaço livre, o item é **perdido** e aparece no
evento com `perdidos` (motor.js:1773-1774). `estado.ignorarBasicos` descarta os componentes sem os
contar (motor.js:1772). Os itens entram com a qualidade ainda por sortear: `comItem(id, 0, '?')`
(motor.js:1773) — quem sorteia a qualidade é o servidor (`QUALIDADES`, motor.js:173-179).

---

## 11. ESPÓLIOS — as partes dos monstros (motor.js:300-350)

Não são itens: ficam numa bolsa à parte (`estado.espolios`) e só servem para vender no Lojista
(motor.js:301-303). O valor acompanha o ouro dos monstros do lugar (motor.js:302-303).

``
valorEsp(nivelRef, mult = 1) = round(0,6 * CURVA.ouro(nivelRef) * mult)        motor.js:304
sortearEspolios(nome, mult = 1):                                                motor.js:334-338
   para cada [id, chance] de ESPOLIO_MONSTRO[nome]:
       se rand() < min(1, chance * mult) -> sai esse espolio
``

Tabela completa (motor.js:305-325), com o valor de venda já calculado:

| Espólio | Valor | De que monstro (chance) | Linha |
|---|---|---|---|
| `escudo-quebrado` Escudo Quebrado | 21 | Tropa Corpo a Corpo (30 %) | motor.js:306, 328 |
| `po-arcano` Pó Arcano | 21 | Tropa Mago (30 %) | motor.js:307, 328 |
| `engrenagem` Engrenagem de Cerco | 31 | Tropa de Cerco (35 %) | motor.js:308, 328 |
| `pele-lobo` Pele de Lobo | 41 | Lobo Gigante (30 %) | motor.js:309, 329 |
| `presa-lobo` Presa de Lobo | 123 | Lobo Gigante (6 %) | motor.js:310, 329 |
| `pedra-krug` Pedra de Krug | 47 | Krug Anciã (30 %) | motor.js:311, 329 |
| `cristal-azul` Cristal Azul | 61 | Sentinela Azul (35 %) | motor.js:312, 329 |
| `espinho` Espinho de Brambleback | 72 | Brambleback Vermelho (35 %) | motor.js:313, 329 |
| `escama-arraia` Escama de Arraía | 66 | Arraía do Rio (30 %) | motor.js:314, 330 |
| `quitina` Quitina do Vazio | 66 | Larva do Vazio (30 %) | motor.js:315, 330 |
| `escama-dragao` Escama de Dragão | 76 | Dragão Ancião (filhote) (30 %) | motor.js:316, 331 |
| `garra-dragao` Garra de Dragão | 229 | Dragão Ancião (filhote) (6 %) | motor.js:317, 331 |
| `olho-vazio` Olho do Vazio | 97 | Criatura do Vazio (30 %) | motor.js:318, 331 |
| `chifre-arauto` Chifre do Arauto | 1 958 | Arauto do Vale (**100 %**) | motor.js:319, 332 |
| `coracao-dragao` Coração de Dragão | 2 220 | Dragão Infernal (**100 %**) | motor.js:320, 332 |
| `presa-barao` Presa do Barão | 2 745 | Barão Nashor (**100 %**) | motor.js:321, 332 |
| `seda-vilemaw` Seda de Vilemaw | 397 | só do Baú da Vilemaw | motor.js:323 |
| `presa-vilemaw` Presa de Vilemaw | 3 294 | só do Baú da Vilemaw | motor.js:324 |

Notas:

- `Cria de Vilemaw` e os monstros invocados **não têm** espólio (não estão em `ESPOLIO_MONSTRO`).
- Os chefes dão o seu espólio **sempre** (chance 1).
- `PILHA = 1000` por pilha (motor.js:341); cada pilha gasta um espaço da mochila
  (`espacosEspolios`, motor.js:345).
- O comentário de motor.js:302-303 diz que os espólios rendem *"uns 30 % a mais de ouro por abate"* — na
  média: 0,3 × 0,6 × ouro = 18 % do ouro-base da região, contra ~75 % do ouro-base por abate de ouro. O
  número do comentário é a conta do dono; **o que o motor aplica é a tabela acima**.
- O valor é fixo, calculado **uma vez** quando o motor carrega (motor.js:304). Se a planilha mudar, os
  valores só mudam no reload.

---

## 12. RUNAS (gemas) — motor.js:103-133 **VARIA**

Caem dos monstros, numa bolsa à parte (não ocupam a mochila), e servem para a forja e a montagem do Ornn.

``
chancesGema(local, mult = 1):                                    motor.js:123-126
   k = 1 + (local.tier ou 0) * 0,1
   para cada gema: chance = min(1, GEMAS[gema].chance * k * mult)

sortearGemas(local, chefe, mult = 1):                            motor.js:127-133
   se chefe: para cada gema: se rand() < GEMAS[gema].chefe * mult -> cai
   senao:    para cada gema: se rand() < chancesGema(local, mult)[gema] -> cai
``

| Gema | Monstro comum | Chefe | O que faz |
|---|---|---|---|
| `sorte` Runa da Sorte | 0,53 % × k | **30 %** | multiplica a chance da tentativa por 1,25 |
| `arcana` Runa Arcana | 0,063 % × k | **8 %** | dobra a chance da tentativa |
| `protecao` Runa de Proteção | 0,063 % × k | **8 %** | se a forja falhar, o item não desce de nível |

`k = 1 + 0,1 × tier`: 1,0 na Rota Inferior até 1,7 no Barão. A chance do chefe é **fixa** (não depende do
tier).

---

## 13. OS CHEFES DO RIFT E AS SUAS MECÂNICAS (motor.js:3065-3125)

### 13.1 As constantes (motor.js:3066-3080) **VARIA**

``
MECANICAS      = { 'Arauto do Vale': 'investida', 'Dragão Infernal': 'sopro', 'Barão Nashor': 'invocar' }   motor.js:3066
BARAO          = { duracao: 180, dano: 0,25, regen: 0,5, recall: 2 }                                        motor.js:3067

HAB_CHEFE (carrega = segundos de aviso; espera = segundos ate a proxima vez que ele arma):                  motor.js:3069-3079
   investida : carrega 1,5 · espera 8
   pancada   : carrega 1,2 · espera 7
   olho      : carrega 1,3 · espera 8
   sopro     : carrega 1,0 · espera 9
   chuva     : carrega 1,1 · espera 9
   rugido    : carrega 0,8 · espera 7
   invocar   : carrega 0,0 · espera 14
   acido     : carrega 1,0 · espera 9
   tentaculos: carrega 1,3 · espera 9

RODIZIO_CHEFE = { 'Arauto do Vale':  ['investida', 'pancada', 'olho'],                                        motor.js:3080
                  'Dragão Infernal': ['sopro', 'chuva', 'rugido'],
                  'Barão Nashor':    ['invocar', 'tentaculos', 'acido'] }
``

### 13.2 O funcionamento (`mecanicaChefe`, motor.js:3081-3125)

``
ao nascer: i.tMec = 5 ; i.mecK = 0                       // a primeira mecanica sai 5 s depois de o chefe chegar

se i.furiaT > 0:  i.furiaT -= dt ; quando acabar: i.as /= 1,5      // desfaz o Rugido

se i.carregando > 0:                                          // esta a preparar um golpe
    se i.atordoado > 0 e o golpe nao for 'rugido':
        i.carregando = 0 ; i.tMec = 6 ; emite 'chefeInterrompido'   // atordoar corta a preparacao
    i.carregando -= dt
    quando chegar a 0:
        se o golpe for de longe (sopro, olho, acido) e a Parede de Vento segurar -> nao faz nada
        senao: aplica o golpe (tabela abaixo)
        i.tMec = HAB_CHEFE[tipo].espera

se i.tMec <= 0:
    tipo = rodizio[i.mecK++ % rodizio.length]
    se tipo == 'invocar':
        cria 2 x 'Larva do Vazio' no nivel max(1, i.nivel - 6), com { chegada: 1 + k*0,3, invocado: true }
        i.tMec = 14
    senao:
        i.carregando = HAB_CHEFE[tipo].carrega ; emite 'chefeCarrega'    // o aviso na tela
``

O dano de cada golpe (motor.js:3100-3109), com `fn = fatorDanoMonestro(estado, i)` — ou seja, com
`NIVEL_DIF` (`9) já aplicado:

| Golpe | Física ou mágica | Multiplicador do `ad` do chefe | Efeito extra |
|---|---|---|---|
| `investida` | física | 3,5× | — |
| `pancada` | física | 2,2× | põe o `chegada` dos outros a `max(chegada, 0)` — **não muda nada** (`Math.max(x, 0) = x`) |
| `olho` | mágica (usa a RM do campeão) | 2,6× | — |
| `sopro` | mágica | 2,2× | queima 4 s a 3 % da vida máxima por segundo |
| `chuva` | mágica | 1,8× | queima 3 s a 2,5 %/s |
| `rugido` | — | — | o chefe ataca 1,5× mais rápido durante 5 s |
| `acido` | mágica | 1,2× | queima 5 s a 2,8 %/s |
| `tentaculos` | física | 2,6× | — |
| `invocar` | — | — | 2 larvas (ver acima) |

``
fis(k) = receberDano( mitigar(i.ad * k, a.armadura) * fn, false )            // fisico
mag(k) = receberDano( mitigar(i.ad * k, a.rm)        * fn, false, true )     // magico
mitigar(dano, arm) = dano * 100 / (100 + max(0, arm))                        motor.js:1167
``

A queima corre dentro do passo: `receberDano(estado, c, a, d.queimaDano * dt, true)` (motor.js:1358-1361)
— com `doSangramento = true`, portanto **sem** `fatorDanoMonstro` e **sem** o multiplicador do papel do
campeão (motor.js:2696-2697).

Os golpes de longe (`GOLPES_DE_LONGE = { sopro, olho, acido }`, motor.js:2053) podem ser travados pela
Parede de Vento do Yasuo (motor.js:3093-3097).

### 13.3 O bônus do Barão (motor.js:1784, 3067)

Quando o Barão Nashor morre, o jogador ganha `estado.buffBarao = 180` s. Durante esses 180 s:

- dano causado +25 % (motor.js:1211: `estado.buffBarao > 0 ? BARAO.dano : 0`);
- regeneração de vida e mana × 1,5 (motor.js:1355-1357);
- o recall dura 2 s em vez de 4 s (motor.js:3062, `BARAO.recall = 2` contra `RECALL = 4`, motor.js:40).

O bónus é perdido ao morrer (motor.js:2780).

---

## 14. RUNETERRA (local `arena`) E A ARENA (local `aram`)

### 14.1 `ARENA` (motor.js:412) **VARIA**

``
ARENA = { bonus: 1,3, ocioso: 30 }        // +30 % de XP e de chance de drop; 30 s parado e o campeao para
``

``
localDaArena(nivel) = o ultimo local com 'faixa' em que nivel >= faixa[0]
                      (se nenhum, o primeiro com 'faixa', que e a Rota Inferior)          motor.js:414
``

Esta é a região que fornece o saque e o bónus de XP/drop quando o monstro não tem zona própria
(arena.js:1650). Exemplos: nível 1-9 → rota-inf · 10-14 → rota-sup · 15-19 → lobos · 20-24 → azul ·
25-29 → vermelho · 30-34 → rio · 35-39 → dragao · 40+ → barao.

### 14.2 O spawn no mundo aberto (`nascerNoPonto`, arena.js:231-258)

Cada ponto de nascimento guarda um monstro (arena.js:230). Quando um ponto fica activo
(`MUNDO`, arena.js:26: `ativo: 15` tiles em volta do campeão, e a mais de 3,5 tiles de distância — os
guardiões podem nascer a 1,2), o monstro nasce assim:

``
// arena.js:231-242
se p.guardiao:  nome = p.guardiao
                nivel = clamp(max(nivelJogador + 3, nm[1]), nm[0], nm[1] + 4)     // sempre no topo da zona
senao se l.chefe e rand() < l.chefe[1] / 3:                                       // 1,5 % / 3 = 0,5 % por ponto
                nome = l.chefe[0] ; nivel = clamp(nivelJogador + 2, nm[0], nm[1] + 2)
senao:         nome = sorteado pelos pesos de l.monstros
                nivel = clamp(nivelJogador - 1 + floor(rand()*4), nm[0], nm[1])
``

Depois (arena.js:243-256):

- `criarMonstro(nome, nivel, { chegada: 0, x: p.x, y: p.y })` — em Runeterra o monstro já está no chão,
  não caminha até ti.
- **Tecto de XP/ouro:** se o nível do monstro for maior que `nivelJogador + 2`, o XP e o ouro são
  limitados aos de um monstro de `nivelJogador + 2` (arena.js:244-245).
- `distancia = MONSTROS[nome].distancia + 0,5` (arena.js:246).
- 35 % de noturno, se não for chefe (arena.js:247).
- **Guardião de fortaleza** (arena.js:252-254): se o monstro não for chefe, elite — `hp × 15, ad × 1,7,
  armadura × 1,6`; se for chefe (Arauto, Dragão, Barão) — `hp × 3, ad × 1,1, armadura × 1,3`.
- Não existe furioso em Runeterra.

**Os guardiões** (runeterra.js:124-125): rota-inf → Tropa Corpo a Corpo, rota-sup → Tropa de Cerco,
lobos → Lobo Gigante, azul → Sentinela Azul, vermelho → Brambleback Vermelho, rio → Arauto do Vale,
dragao → Dragão Infernal, barao → Barão Nashor. Os 3 últimos são chefes de verdade (3× a vida); os outros
são a versão elite do monstro mais forte da zona (15× a vida). O nível é sempre o topo da zona
(`max(nivelJogador + 3; nm[1])`, preso em `nm[1] + 4`).

**Respawn em Runeterra** (arena.js:259-287): `MUNDO.respawn = [20, 35]` s para o ponto voltar a encher;
monstro comum, assim que o campeão se afasta, o ponto é libertado (arena.js:273); monstros a mais de
`MUNDO.some = 20` tiles desaparecem (arena.js:276); o guardião morto só volta quando o baú encher de novo
(arena.js:268-272, 281). O monstro persegue dentro de `MUNDO.leash = 12` tiles de casa (arena.js:26).

**As zonas de caça de Runeterra** (runeterra.js:40) são exactamente as 8 regiões do Rift:
`ZONAS = ['rota-inf', 'rota-sup', 'lobos', 'azul', 'vermelho', 'rio', 'dragao', 'barao']` — mesmos
monstros, mesmo saque, mesma faixa de nível (runeterra.js:39-40).

### 14.3 O multiplicador do saque em Runeterra (arena.js:1650)

``
processarAbates(estado, c, a,
   local = A.mundo ? (i) => LOCAL[i.zona] ou base : base,     // base = localDaArena(nivel)
   bonus  = ARENA.bonus = 1,3,
   bonusXp = min(1 + 0,15 * (4 - 1), A.bonusGrupo ou 1) * (A.zonaPk ? 1 + 0,4 : 1))
// GRUPO = { max: 4, raio: 15, porMembro: 0,15 }                                   motor.js:143
// PK_BONUS = 0,4                                                                   runeterra.js:21
``

Ou seja, em Runeterra, para um monstro do teu nível (`fatorSaque = 1`):

- chance de item: × 1,3 (o bónus de região);
- XP do abate: × 1,3 × 1 (grupo) = 1,3, e no máximo × 1,45 com grupo cheio (3 outros membros a até
  15 tiles) e × 1,4 por estar numa Zona de Guerra — os dois podem acumular (1,3 × 1,45 × 1,4 = **2,64**).
- Com VIP, mais × 1,2 em cada.

### 14.4 As cidades (runeterra.js:11-16)

``
CIDADES = { demacia: [1; 15] · piltover: [15; 30] · noxus: [30; 50] }
``

Nas cidades não entra monstro e não vale PvP (arena.js:8, 78; runeterra.js:11). Lá dentro a vida e a mana
voltam a 5 % por segundo (`MUNDO.regenCidade = 0,05`, arena.js:26) e há Soraka, Lojista, Burrinho de
Carga e Mercador (runeterra.js:198-208). `naCidade`/`atendeAqui` (motor.js:2921-2924) é o que deixa curar,
vender, comprar poções e usar o cofre fora da Fonte.

### 14.5 As Zonas de Guerra (runeterra.rs:21-34)

12 zonas onde o PvP fica **sempre ligado** e a experiência vale +40 % (`PK_BONUS = 0,4`, runeterra.js:21).
Entrar liga o PvP à força (arena.js:1451-1453).

### 14.6 A Arena 1v1 (local `aram`, motor.js:377-378)

- `aram: true` marca o local da ponte; a descrição é *"a ponte da Arena, onde os jogadores se enfrentam
  1 contra 1. Morrer aqui não custa XP nem itens."* (motor.js:377-378).
- **Morte é de graça:** `perda = 0` (motor.js:2782) e `d.morto = 1e9` — o campeão fica caído até à próxima
  rodada (motor.js:2779, e o passo sai sem fazer nada, motor.js:1343).
- A rodada é marcada pelo servidor (`renascerArena`, motor.js:2788-2793): vida, mana e recargas cheias.
- Configuração da partida (arena-pvp.js:7-11): melhor de 3 (2 vitórias), até 5 rodadas, 120 s por rodada,
  3 s de contagem antes de cada rodada e 4 s entre rodadas.
- Em Runeterra e na Arena o motor **não** cria grupos de monstros: quem manda é o motor de arena
  (motor.js:1415-1416, `motorArena?.()`). Na ponte da Arena não há monstros.

---

## 15. O PvP (motor.js:41-43, 1284, 2737-2770, 3049-3062, 3722-3786)

### 15.1 As constantes **VARIA**

| Nome | Valor | Onde |
|---|---|---|
| `POCAO_PVP.cura` | 0,3 | a poção cura 30 % em luta contra jogador | motor.js:43 |
| `POCAO_PVP.exaustao` | 6 s | intervalo mínimo entre poções em PvP | motor.js:43 |
| `CURA_PVP` | 0,65 | todas as outras curas (habilidades, roubo de vida, Sede) valem 65 % em PvP | motor.js:1284 |
| `EXAUSTAO` | 1 s | o intervalo normal entre poções | motor.js:41 |
| `EM_COMBATE_MUNDO` | 6 s | tempo "em combate" depois de levar dano no mundo | motor.js:3051 |
| `CHANCE_PERDER_ITEM` | 0,1 | por item equipado, ao morrer em Runeterra | motor.js:2739 |
| `CHANCE_PERDER_PVP` | 0,3 | um item sorteado, ao morrer **para um jogador** | motor.js:2742 |
| `CAVEIRA_VERMELHA.limites` | 3 mortes (frags) em 14 h → 14 h de Caveira | 504e5 ms = 14 h | motor.js:2746 |
| `CAVEIRA_VERMELHA.perde` | 0,5 | com Caveira, cai metade de tudo (equipado + mochila) | motor.js:2746, 2757-2761 |

O combate PvP dura 6 s e é renovado a cada golpe (arena.js:186-188; motor.js:3733), e serve para a poção
fraca. `emCombate` (motor.js:3056) é o que **impede fugir**: com `combatePvp > 0`, com `apanhou > 0` ou com
um monstro agressivo em cima, não dá para voltar à base nem viajar (motor.js:3061).

### 15.2 Como o dano do PvP chega (motor.js:3722-3740)

O servidor calcula o dano e manda; o motor só desconta:

``
danoPvp(estado, c, valor, por):
   exige LOCAL[estado.local].arena
   se o Fluxo do Yasuo estiver cheio -> vira escudo (o servidor conta o mesmo)
   se houver escudo -> absorve primeiro
   vida -= valor
   apanhouNoMundo(c) ; combatePvp = max(combatePvp, 6) ; agressores[por] = tempo + 60   // legitima defesa
   se a vida zerar:
       Zac -> Divisao Celular (o servidor decide)
       Anjo Guardiao -> o servidor manda { t: 'anjo' }
       senao -> morrerPvp(estado, c, por) -> morrer(estado, c, por)
``

Quem se pode atacar (arena.js:183): com o teu PvP ligado, quem tem Caveira Vermelha, ou quem te bateu nos
últimos 60 s (legítima defesa, `agressores`, motor.js:3733).

### 15.3 O papel do campeão no PvP (motor.js:865-894)

Cada campeão tem `papel.pvp` (dano contra jogadores) e `papel.pvpRecebido` (dano que leva de jogadores),
que são a **metade** do papel contra monstros:

| Campeão | dano (monstro) | recebido (monstro) | arena (Runeterra) | pvp | pvpRecebido |
|---|---|---|---|---|---|
| darius | 1,10 | 0,55 | 1,075 | 0,95 | 0,85 |
| ezreal | 1,12 | 1,05 | 1,10 | 1,08 | 1,03 |
| lux | 1,59 | 1,05 | 1,00 | 1,20 | 1,05 |
| yasuo | 1,15 | 0,85 | 1,50 | 1,00 | 0,92 |
| katarina | 1,20 | 0,75 | 1,75 | 1,15 | 1,00 |
| taric | 0,90 | 0,75 | 0,78 | 0,88 | 0,85 |
| zac | 1,425 | 0,66 | 0,70 | 0,50 | 0,69 |

Notas: `recebidoArena` (katarina 1,00, zac 0,70) substitui `recebido` só em Runeterra (motor.js:2697).
`NIVEL_DIF` **não** se aplica no PvP (`9.4).

### 15.4 Morrer fora da Arena (motor.js:2763-2768, 2737-2762)

- A morte custa **10 % do XP do nível** (`perdaPorMorte = round(xpParaNivel(nivel) * 0,1)`,
  motor.js:430), aplicado em `penalidadeMorte` (motor.js:2763-2768).
- Em Runeterra cada item equipado tem 10 % de chance de cair (motor.js:2739-2740); a morrer para um
  jogador, 30 % de chance de cair **um** item sorteado (motor.js:2742-2743). Com Caveira Vermelha cai
  metade de tudo, equipado e mochila (motor.js:2746, 2757-2761).
- No Summoner's Rift não cai nada (motor.js:2737-2738).
- Renascer: vida a 10 % do máximo, mana 0, de volta à Fonte (motor.js:1342-1350), 3 s caído
  (motor.js:2779).

---

## 16. EXEMPLOS DE RECÁLCULO

### 16.1 Os números médios de cada região (monstro comum, nível do meio da faixa `nm`)

Calculados com a `CURVA` de `3 e os coeficientes de `4 (XP e ouro por abate **sem** multiplicadores):

| Região | `nm` médio | hp médio | ad médio | armadura média | XP/abate | ouro/abate | XP/h | ouro/h | abates/min |
|---|---|---|---|---|---|---|---|---|---|
| rota-inf | 3,5 | 325 | 19 | 5 | 52,3 | 21,1 | 1 413 | 571 | 27 |
| rota-sup | 9 | 970 | 54 | 11 | 99,2 | 42,4 | 1 934 | 826 | 19,5 |
| lobos | 14 | 1 709 | 98 | 21 | 140,8 | 51,3 | 2 323 | 846 | 16,5 |
| azul | 19 | 4 095 | 126 | 47 | 239,1 | 90,0 | 2 331 | 877 | 9,75 |
| vermelho | 24 | 5 002 | 226 | 48 | 283,8 | 101,2 | 2 980 | 1 063 | 10,5 |
| rio | 29 | 5 058 | 238 | 63 | 268,0 | 86,2 | 3 014 | 970 | 11,25 |
| dragao | 34 | 6 745 | 392 | 63 | 366,3 | 120,7 | 3 846 | 1 267 | 10,5 |
| barao | 44 | 9 080 | 613 | 76 | 484,5 | 162,0 | 5 450 | 1 823 | 11,25 |

O ouro por abate já usa a **média** do sorteio (0,75). O ritmo (`abates/min`) é
`ABATES_MIN_ZONA × RITMO_REAL = ABATES_MIN_ZONA × 1,5` (motor.js:3266 e motor.js:3253), que é o ritmo
medido dos bots × 1,5 (motor.js:3252-3253).

Os chefes, no nível do topo da zona + 2 (`6.4):

| Chefe | Região | Nível | hp | ad | armadura | as | XP | ouro |
|---|---|---|---|---|---|---|---|---|
| Arauto do Vale | rio | 35 | 48 750 | 841 | 86 | 0,60 | 3 300 | 1 566 |
| Dragão Infernal | dragao | 40 | 69 000 | 1 227 | 104 | 0,55 | 4 340 | 2 072 |
| Barão Nashor | barao | 50 | 122 400 | 1 837 | 144 | 0,50 | 7 600 | 3 660 |

A larva que o Barão invoca (`13.2), com o Barão a 50, nasce a 44: hp 7 135, ad 496.

### 16.2 O exemplo do dono: nível 23 no Covil do Barão

1. O jogador entra no `barao` (`nm = [40; 48]`, `tier 7`) — pode, `viajar` não olha para o nível
   (motor.js:3043-3048).
2. Os monstros nascem presos em `[40; 48]`: `clamp(23 - 2 + {0,1,2,3}, 40, 48) = 40` sempre.
3. `difNivel = max(0, 40 - 23 - 4) = 13`.
4. O monstro bate `min(3, 1 + 0,15 × 13) = 2,95×` e o jogador dá `max(0,25, 1 - 0,07 × 13) = 0,25×`
   — ou seja, **quatro vezes menos dano** do que na tua própria zona.
5. Se o chefe aparecer: `max(40+2; min(48+2; 23+4)) = 42` → `difNivel = 42 - 23 - 4 = 15` →
   `min(3, 3,25) = 3×` e `0,25×`. É exactamente o cenário que motivou a regra (motor.js:1180).

### 16.3 Quanto tempo até um lendário, por região

`1 / chance do lendário`, monstro comum, sem VIP, no teu nível: Rota Inferior ~9 615 abates ·
Rota Superior ~9 322 · Lobos ~7 511 · Azul ~4 260 · Vermelho ~4 043 · Rio ~3 715 · Dragão ~3 048 ·
Barão ~2 717. Em horas: divide pelo ritmo da tabela de `16.1 (por exemplo, no Barão,
2 717 / 11,25 = **~242 h** de caça; no Rio, 3 715 / 11,25 = **~330 h**).

---

## 17. O QUE NÃO CONSEGUI VERIFICAR (NAO VERIFICADO)

1. **A contagem de espólios do comentário.** O comentário de motor.js:302-302 diz *"na média, os
   espólios rendem uns 30 % a mais de ouro por abate"*. A tabela de `11 dá, na média, 0,6 × ouro-base ×
   chance por espólio ≈ 18 % do ouro-base por abate. **O número do comentário não fecha com a tabela** —
   NAO VERIFICADO de onde vem o 30 %. O que o motor aplica é a tabela.
2. **Os 16 minutos do ciclo dia/noite** (motor.js:1078-1080) contradizem o código (24 h reais).
   NAO VERIFICADO se é resquício de uma versão antiga ou engano do comentário. **Usei o código.**
3. **A chance de chefe em Runeterra.** O cálculo `l.chefe[1] / 3` está em arena.js:236 mas o
   `CHEFE_RUNETERRA = 1/3` de wiki-dados.js:11 é uma **reconstrução** (não é constante do motor). O
   divisor 3 aparece literalmente no código — confirmei o valor, não a intenção.
4. **Arena (aram):** o motor não cria monstros lá (motor.js:1415-1416) e a partida é do servidor. O que
   se passa dentro da rodada (dano, itens, poções) está em código que não li — `arena-pvp.js` tem só a
   configuração (82 linhas) e o resto é do servidor. **NAO VERIFICADO.**
5. **A média exata de itens por grupo com furioso/noturno:** derivei-a de `aMais` (motor.js:1113) e das
   constantes; a simulação com sorteios pode divergir por variação estatística. A fórmula é a de `7.3.

---

## 18. PRECISA DE REGRA DO DONO (política, não dado do jogo)

1. **Sair da Fonte e onde caçar** — o jogo deixa ir a qualquer região em qualquer nível (`2). Qual o
   "limite de segurança" que a função de decisão deve usar (nível mínimo por região) é escolha vossa.
2. **Quanto vale a vida** — quantas poções e quanto ouro uma morte autoriza (`15.4). O jogo dá o custo;
   a política de risco é vossa.
3. **Prioridade entre XP e ouro** quando duas zonas dão ritmos diferentes (`16.1) — o jogo dá os dois
   números; a função objectivo é vossa.

---

## 19. ARMADILHAS DE LEITURA (resumo para quem vai ler o motor)

1. **O ciclo de 16 min** (motor.js:1078-1080) é comentário velho: o dia/noite é o relógio real (`1).
2. **As percentagens de drop do comentário** (motor.js:1134-1136) são os coeficientes **antes** da
   planilha e do `LENDARIO_TIER` (`10.2). O que o jogo aplica é a tabela recalculada.
3. **`statsMonstro` não existe no motor** (`5.1): a especificação é `criarMonstro` (motor.js:1066-1075).
4. **`grupoSpawn` não existe no motor**: os números 2 e 3 estão inline em motor.js:1124 (`6.2). A cópia
   manual vive em `inject.js:138` — **tema de arquitectura, não meu bloco** (não escrevi lá).
5. **A armadura do monstro** não é `CURVA.armadura` directamente: é `CURVA.armadura(n) × m.armadura`
   (motor.js:1070), e contra dano com Poder de Habilidade ainda leva × 0,6 (`5).
6. **O ouro do monstro tem sorteio** 0,5 a 1 (motor.js:1071): a média é 0,75, não 1.
7. **O chefe não é "grupo + chefe"**: quando o chefe sai, o grupo tem 1 monstro só (`6.4).
8. **Noturno e furioso nunca no mesmo monstro** (`6.3), e nenhum dos dois em chefes.
9. **`NIVEL_DIF` só pune para cima**; caçar abaixo pune por `fatorSaque`, que é outra fórmula (`9.5).
10. **A `faixa` é informativa**: não impede entrar na região (`2). Quem prende o nível dos monstros é
    `nm`.

---

## 20. ÍNDICE RÁPIDO (motor.js)

| Assunto | Linhas |
|---|---|
| `GRUPO` (grupo de Runeterra) | 143 |
| `LOCAIS` / `LOCAL` | 354-380 |
| `DROPS` / `DROPS_AP` | 383-406 |
| `ARENA` / `localDaArena` | 411-414 |
| `fatorXp` / `fatorSaque` | 420-424 |
| `CURVA` / `ajuste` | 272-279 |
| `MONSTROS` | 280-298 |
| Espólios | 300-350 |
| Gemas | 107-133 |
| `criarMonstro` | 1065-1075 |
| relógio / `luzDoDia` / `ehNoite` | 1077-1095 |
| `NOTURNO` / `tornarNoturno` | 1096-1101 |
| `FURIOSO` / `tornarFurioso` / `aMais` | 1102-1113 |
| `gerarGrupo` (nível, grupo, chefe) | 1116-1130 |
| `NIVEL_DO_TIER` / `LENDARIO_TIER` / `BRUTO` | 1138-1143 |
| `DROP_CHEFE` / `chancesDrop` / `sortearLoot` | 1144-1165 |
| `mitigar` / `RM_MONSTRO` | 1167, 1179 |
| `NIVEL_DIF` / `difNivel` / factores | 1184-1187 |
| `TETO_VIDA_ITEM` / `vidaRefItem` | 1188-1191 |
| `golpear` (dano do jogador) | 1192-1234 |
| abates e saque (`processarAbates`) | 1749-1794 |
| spawn e respawn no passo | 1418-1425, 1625 |
| `viajar` | 3042-3048 |
| chefes: `MECANICAS`/`HAB_CHEFE`/`RODIZIO_CHEFE` | 3065-3080 |
| `mecanicaChefe` | 3081-3125 |
| `morrer` / `penalidadeMorte` / perda de itens | 2737-2786 |
| `emCombate` / `voltarBase` | 3049-3063 |
| PvP (`danoPvp` e companhia) | 3722-3786 |
