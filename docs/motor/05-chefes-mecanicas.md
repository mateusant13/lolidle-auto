# 05 — OS CHEFES E AS SUAS MECÂNICAS

> **Fonte:** `docs/game-src/motor.js`, lido **por inteiro** antes de escrever este documento.
> Todos os números abaixo foram lidos no ficheiro. Cada afirmação traz `ficheiro:linha`.
> Quando uma linha é de outro ficheiro, o nome do ficheiro vem no texto (por exemplo `arena.js:1687`).
> **Regra de leitura:** `motor.js:NNNN` sozinho = `docs/game-src/motor.js:NNNN`.
> Documento escrito a 14/10/2026. É a peça dos "chefes" da função de decisão
> `(campeão, nível, inventário, região) -> (build, barra, poções, resultado esperado)`.
>
> **AVISO — o ficheiro está a ser editado em paralelo.** Enquanto este documento era escrito, o
> `motor.js` **cresceu de 3791 para 3852 linhas** e o `NIVEL_DIF` foi rebalanceado (ver `2.3`).
> Todos os números de linha abaixo foram **re-verificados** na versão de **3852 linhas** (14/10/2026).
> Se o ficheiro voltar a crescer, os números deslocam-se: **confirmar pela âncora de código citada**,
> não só pelo número. O bloco dos chefes (`MECANICAS` … `mecanicaChefe`) está em **3089-3148**.
>
> **Âmbito:** os **3 chefes do Summoner's Rift** (Arauto do Vale, Dragão Infernal, Barão Nashor) e o
> código `MECANICAS` / `BARAO` / `HAB_CHEFE` / `RODIZIO_CHEFE` / `mecanicaChefe`.
> Os **guardiões de Runeterra** usam *outros* números (`11`), ditos aqui só como aviso.

---

## 0. Como usar este documento

Para **simular uma luta contra um chefe** precisas de 6 coisas, todas aqui:

1. **Onde e quando nasce o chefe** (`1`): a zona, o sorteio, o nível e as stats dele.
2. **As fórmulas por onde o dano do chefe passa** (`2`): `mitigar`, `fatorDanoMonstro`, `receberDano`,
   o papel de cada campeão e **o que protege e o que não protege**.
3. **O relógio da mecânica** (`4`): `tMec`, `carregando`, `espera`, `mecK` — a máquina de estados.
4. **O que cada golpe faz** (`5`) e a queima (`6`).
5. **A sequência completa de cada chefe** (`8`): tempos, dano de cada golpe, dano/s recebido.
6. **O que o jogador pode fazer para mudar isto** (`10`): interrupções, parede de vento, invulnerabilidade.

**Regra de ouro deste bloco (lida no código, não assumida):** o dano de uma **mecânica** do chefe usa
`mitigar(dano, a.armadura)` ou `mitigar(dano, a.rm)` **só** (motor.js:3123-3124) — ou seja, **não**
entra a *Disciplina da Legião*, o *Estandarte de Noxus*, a *Pele de Diamante* nem a *Membrana Reforçada*
(esses só protegem contra os ataques **automáticos** do chefe, motor.js:1755). Detalhes em `2.5`.

---

## 1. Onde e quando nasce um chefe

### 1.1 As três zonas (motor.js:381, 383, 385)

| Zona | `faixa` do jogador | `nm` dos monstros | `chefe` | Chance |
|---|---|---|---|---|
| Rio | 25–35 | 25–33 | `['Arauto do Vale', 0.015]` | 1,5 % |
| Fosso do Dragão | 30–40 | 30–38 | `['Dragão Infernal', 0.015]` | 1,5 % |
| Covil do Barão | 40–50 | 40–48 | `['Barão Nashor', 0.015]` | 1,5 % |

### 1.2 O sorteio do grupo (motor.js:1129-1141)

```
gerarGrupo(local, noite, nivelJogador):
  se local.chefe existir E random() < local.chefe[1]:        # 0.015
      devolve [ criarMonstro(local.chefe[0], nívelDoChefe, { chegada: 1.8 }) ]   # motor.js:1134
      #  --> o chefe nasce SOZINHO: o grupo é um array de UM elemento
  senão:
      grupo comum de 2 a 4 monstros (motor.js:1137-1141)
```

Depois de nascer, cada monstro do grupo leva `+kit(estado).chegadaExtra` em `chegada`
(motor.js:1443) — **Ezreal e Lux têm `chegadaExtra: 1.2`** (motor.js:885, 890), por isso o chefe só
começa a **atacar e a usar mecânicas** ao fim de `1,8 + 1,2 = 3,0 s` para eles, contra `1,8 s`
para os restantes.

### 1.3 O nível do chefe (motor.js:1134) e o que isso faz ao dano dos dois lados

```
nívelDoChefe = max( nm[0] + 2 ,  min( nm[1] + 2 , nívelJogador + 4 ) )
```

- Rio: `max(27, min(35, L+4))` → **27 a 35**
- Dragão: `max(32, min(40, L+4))` → **32 a 40**
- Barão: `max(42, min(50, L+4))` → **42 a 50**

**Esta fórmula é o que decide o factor de diferença de nível** (`2.3`):
`d = max(0, nívelDoChefe − nívelJogador − 4)`. Como o chefe **nunca nasce acima de `L+4`**, `d` é
**0** sempre que `L ≥ nm[0] − 2`:

| Chefe | `nm[0]` | `d = 0` quando o jogador tem |
|---|---|---|
| Arauto do Vale | 25 | **≥ 23** |
| Dragão Infernal | 30 | **≥ 28** |
| Barão Nashor | 40 | **≥ 38** |

Se o jogador entrar numa zona muito acima do seu nível, `d` cresce e **os dois lados mudam**
(`2.3`): o chefe bate mais forte (até **×5**) e o jogador bate mais fraco (até **×0,25**).

### 1.4 Os números do chefe, por nível

O chefe é um `criarMonstro` normal (motor.js:1079-1088): `hp = CURVA.hp(n) × hp`,
`ad = CURVA.ad(n) × ad`, `armadura = CURVA.armadura(n) × armadura`, `as = MONSTROS[chefe].as`.
Como **todo** `ajuste` da planilha é **1,00 para níveis 21-60** (balanco.js:2), os valores abaixo já são
finais (sem ajuste).

| Chefe | hp | ad | as | armadura | xp | ouro | `magico` |
|---|---|---|---|---|---|---|---|
| Arauto do Vale | 10 | 2,5 | 0,6 | 1,5 | 12 | 12 | não |
| Dragão Infernal | 12 | 3,0 | 0,55 | 1,6 | 14 | 14 | **sim** |
| Barão Nashor | 16 | 3,2 | 0,5 | 1,8 | 20 | 20 | **sim** |

(motor.js:305-307; `as` é **ataques por segundo** — o intervalo entre ataques automáticos é `1/as`,
motor.js:1752; `magico: true` = o dano automático é **mágico**, motor.js:1755-1756.)

`AD do chefe = (9 + 4,8n + 0,13n²) × coef` (motor.js:284):

| nível | Arauto (×2,5) | Dragão (×3) | Barão (×3,2) |
|---|---|---|---|
| 27 / 32 / 42 | 583,42 | 887,16 | 1407,74 |
| 28 / 33 / 43 | 613,30 | 926,91 | 1458,46 |
| 29 / 34 / 44 | 643,82 | 967,44 | 1510,02 |
| 30 / 35 / 45 | 675,00 | 1008,75 | 1562,40 |
| 31 / 36 / 46 | 706,83 | 1050,84 | 1615,62 |
| 32 / 37 / 47 | 739,30 | 1093,71 | 1669,66 |
| 33 / 38 / 48 | 772,43 | 1137,36 | 1724,54 |
| 34 / 39 / 49 | 806,20 | 1181,79 | 1780,26 |
| **35 / 40 / 50** | **840,63** | **1227,00** | **1836,80** |

Vida, armadura, XP e ouro, já multiplicados:

| nível | Arauto: HP · arm · xp · ouro | Dragão: HP · arm · xp · ouro | Barão: HP · arm · xp · ouro |
|---|---|---|---|
| 27 / 32 / 42 | 35 790 · 68,25 · 2628 · 1230 | 52 488 · 84,8 · 3556 · 1680 | 97 824 · 122,4 · 6480 · 3100 |
| 30 / 35 / 45 | 40 500 · 75 · 2880 · 1356 | 58 500 · 92 · 3850 · 1827 | 106 800 · 130,5 · 6900 · 3310 |
| **35 / 40 / 50** | **48 750 · 86,25 · 3300 · 1566** | **69 000 · 104 · 4340 · 2072** | **122 400 · 144 · 7600 · 3660** |

### 1.5 O que o chefe dá quando morre (motor.js:1158, 345, 140-146, 1806)

- **Saque:** `DROP_CHEFE = { lendario: 0,001, epico: 0,05, basico: 0,4 }` (motor.js:1158) — **0,1 %
  de lendário, 5 % de épico, 40 % de básico** (três sorteios independentes, motor.js:1169-1171).
- **Espólio:** 100 % de um espólio específico (`chifre-arauto`, `coracao-dragao`,
  `presa-barao`, motor.js:345).
- **Gemas:** `sortearGemas(local, chefe)` usa os valores de **chefe** (motor.js:140-146): sorte 30 %,
  arcana 8 %, protecção 8 %.
- **XP e ouro:** `CURVA.xp(n) × xp` e `CURVA.ouro(n) × ouro`, reduzidos pelo `fatorSaque` se o
  chefe estiver mais de 5 níveis **acima** do jogador (motor.js:1780, 434-437).
- **Só o Barão:** `estado.buffBarao = BARAO.duracao` (motor.js:1806) — ver `3.2`.
- Depois de morto, o grupo é limpo e nasce outro ao fim de **1,5 s** (motor.js:1646).

---

## 2. As fórmulas por onde o dano do chefe passa

### 2.1 `mitigar` (motor.js:1180)

```
mitigar(dano, armadura) = dano × 100 / (100 + max(0, armadura))
```

Serve tanto para a armadura (dano físico) como para a resistência mágica `a.rm` (dano mágico).

### 2.2 O caminho completo de um golpe de MECÂNICA (motor.js:3121-3133)

```
# dentro de mecanicaChefe, fn = fatorDanoMonstro(estado, i)   (motor.js:3122)
fis(k) = receberDano(estado, c, a, mitigar(i.ad × k, a.armadura) × fn, false)       # motor.js:3123
mag(k) = receberDano(estado, c, a, mitigar(i.ad × k, a.rm)        × fn, false, true) # motor.js:3124
```

`receberDano(estado, c, a, dano, doSangramento=false, magico=false, origem=null)`
(motor.js:2716-2758) aplica **por esta ordem**:

| # | passo | linha | efeito |
|---|---|---|---|
| 1 | `d.invulneravel > 0` | 2718 | **desvia tudo** (nenhum dano) |
| 2 | `origem?.nivel` e `!c.dg` | 2719 | `dano ×= fatorDanoMonstro` — **não se aplica** às mecânicas (origem é `null`) |
| 3 | `papel` do campeão | 2720 | `dano ×= (arena ? recebidoArena : recebido)` — **aplica-se** às mecânicas |
| 4 | Banshee's Veil (`3102`) | 2721-2723 | bloqueia o golpe inteiro; **40 s** de recarga |
| 5 | Death's Dance (`6333`) | 2724-2727 | 30 % do dano fica guardado como sangramento |
| 6 | Parede de Vento (`d.vento > 0`) | 2728-2732 | se `origem` tiver `distancia` e a parede segurar → bloqueia; senão `dano ×= 1 − ventoRed` |
| 7 | Zac `quique` / `mitose` | 2733-2734 | `dano ×= 1 − reduz` |
| 8 | Pele de Diamante (Taric `G`) | 2735 | reflete — **só se `origem` tiver `hp`**, logo **não** funciona nas mecânicas |
| 9 | Fluxo cheio (Yasuo) | 2736-2740 | o golpe vira escudo (`escudoFluxo`) — **só em `!doSangramento`** |
| 10 | `d.escudo` | 2741 | absorve `min(escudo, dano)` |
| 11 | `estado.vida −= dano` | 2742 | e a morte/salvamentos abaixo |
| 12 | Zhonya (`3157`, <25 % vida), Sterak (`3053`, <30 %), Anjo (`3026`), Zac divide | 2745-2756 |  |

**Resumo para as mecânicas** (origem = `null`, doSangramento = `false`):

```
dano = mitigar( i.ad × k , defesa ) × fn × papelRecebido × (1 − ventoRed se parede activa)
       × (1 − quiqueRed) × (1 − mitoseRed)      [− escudo]
```

onde `defesa = a.armadura` (investida/pancada/tentáculos) ou `a.rm` (olho/sopro/chuva/ácido).

### 2.3 O factor de diferença de nível (motor.js:1199-1202) **VARIA**

```
NIVEL_DIF = { livre: 4, danoMonstro: 0.35, maxDanoMonstro: 5, danoJogador: 0.12, minDanoJogador: 0.25 }
                                                                        # motor.js:1199 (lido 14/10/2026)
d   = max(0, nívelDoChefe − nívelJogador − NIVEL_DIF.livre)             # motor.js:1200
fatorDanoMonstro = min(5,   1 + 0,35 × d)                               # motor.js:1201
fatorDanoJogador = max(0,25, 1 − 0,12 × d)                              # motor.js:1202
```

> **VARIA e mudou hoje:** o comentário na própria linha diz *"0,15 / 3 / 0,07 até 13/10/2026 (p647: o
> Yasuo 30 solava o Vazio)"*. Quem simular tem de **ler estes 5 números do ficheiro**, nunca copiá-los.

- Nos golpes de **mecânica**, `fatorDanoMonstro` é aplicado **uma vez**, no `fis`/`mag`
  (motor.js:3122) — e **não** volta a aplicar dentro de `receberDano`, porque `origem` é `null`.
- Nos **ataques automáticos**, `fatorDanoMonstro` é aplicado dentro de `receberDano`
  (motor.js:2719), porque `origem = i` (motor.js:1756).
- Nos ataques automáticos a defesa ainda leva mais `1 + 0,01×disciplina + estandarteDef + diamanteDef +
  membranaDef` (motor.js:1755) — **esse multiplicador extra não existe nas mecânicas**.
- **Na dungeon** (`c.dg`) o factor de diferença **não se aplica** (motor.js:2719) — a dungeon não é
  o Rift nem Runeterra, e não é coberta por este documento.

Exemplo com os valores de hoje (`d` = níveis acima de `L+4`):

| situação | `d` | dano que o chefe faz | dano que o jogador faz |
|---|---|---|---|
| jogador 23 no Rio (Arauto nv27) | 0 | ×1 | ×1 |
| jogador 23 no Fosso (Dragão nv32) | 5 | ×2,75 | ×0,40 |
| jogador 30 no Covil (Barão nv42) | 8 | ×3,80 | ×0,25 (piso) |
| jogador 35 no Covil (Barão nv42) | 3 | ×2,05 | ×0,64 |
| jogador 38 no Covil (Barão nv42) | 0 | ×1 | ×1 |
| jogador 23 no Covil (Barão nv42) | 15 | ×5 (tecto) | ×0,25 (piso) |

### 2.4 O papel de cada campeão (motor.js:883-906) **VARIA (balanceamento)**

| campeão | `recebido` (Rift) | `recebidoArena` (Runeterra) |
|---|---|---|
| Darius | **0,55** | 0,55 (não tem `recebidoArena`) |
| Ezreal | **1,05** | 1,05 |
| Lux | **1,05** | 1,05 |
| Yasuo | **0,85** | 0,85 |
| Katarina | **0,75** | **1,00** |
| Taric | **0,75** | 0,75 |
| Zac | **0,66** | **0,70** |

`recebido` multiplica **todo** o dano que o jogador recebe (ataques automáticos e mecânicas).

### 2.5 As defesas do jogador — e o que **NÃO** protege contra as mecânicas

`a.armadura` e `a.rm` vêm de `atributos(estado)`: base do campeão + itens (`infoItem`, que
escala com refino × qualidade) + atributos + conquistas + mascote. **Nas mecânicas só entra esse valor**
(motor.js:3123-3124).

**Não protege contra as mecânicas** (protegem só contra ataques automáticos):

- `Disciplina da Legião` (Darius `D`, motor.js:583): `+1 %` de armadura e dano por abate, até ao
  limite do rank (`acumulos: serie(2, 2)` → +2 % a +20 %) — aplicada em `inimigoAtaca`
  (motor.js:1755) e acumulada em motor.js:1813.
- `Estandarte de Noxus` (Darius `B`, motor.js:693): `defesaBonus: serie(0,2, 0,04)` →
  **+20 % a +56 %** de armadura/RM — aplicado em `inimigoAtaca` (motor.js:1755), armado em
  motor.js:1906.
- `Pele de Diamante` (Taric `G`) e `Membrana Reforçada` (Zac `G`): o mesmo (motor.js:1755).

**Também não existe esquiva contra mecânicas**: `a.esquiva` só é testada em `inimigoAtaca`
(motor.js:1753). Uma mecânica **sempre** chega ao jogador, salvo se for bloqueada/interrompida.

---

## 3. `MECANICAS`, `BARAO`, `HAB_CHEFE`, `RODIZIO_CHEFE`

### 3.1 `MECANICAS` (motor.js:3089)

```
MECANICAS = { 'Arauto do Vale': 'investida', 'Dragão Infernal': 'sopro', 'Barão Nashor': 'invocar' }
```

Mapeia cada chefe à mecânica que **abre** o rodízio — e é sempre o primeiro elemento de
`RODIZIO_CHEFE` (motor.js:3103). O mapa é lido pelas habilidades `A` para encontrar o **Arauto**
e interromper a investida (motor.js:1832, 2278, 2405, 2553, 2618).

### 3.2 `BARAO` (motor.js:3090) **VARIA**

```
BARAO = { duracao: 180, dano: 0.25, regen: 0.5, recall: 2 }
```

- `duracao` = **180 s** de buff depois de matar o Barão (motor.js:1806);
- `dano` = **+25 %** de dano causado enquanto o buff durar (motor.js:1224);
- `regen` = regeneração **×1,5** (motor.js:1374-1376);
- `recall` = voltar à Fonte em **2 s** em vez de `RECALL = 4` (motor.js:3085, 47);
- o buff é limpo ao morrer (motor.js:2792-2793) e desce 1 por segundo (motor.js:1372).

### 3.3 `HAB_CHEFE` (motor.js:3092-3102) — **VARIA (é aqui que se mexe num nerf/buff)**

| mecânica | `carrega` (aviso) | `espera` (intervalo) | `nome` | linha |
|---|---|---|---|---|
| `investida` | **1,5 s** | **8 s** | Investida | 3093 |
| `pancada` | **1,2 s** | **7 s** | Pancada Sísmica | 3094 |
| `olho` | **1,3 s** | **8 s** | Olho do Arauto | 3095 |
| `sopro` | **1,0 s** | **9 s** | Sopro de Fogo | 3096 |
| `chuva` | **1,1 s** | **9 s** | Chuva de Fogo | 3097 |
| `rugido` | **0,8 s** | **7 s** | Rugido do Dragão | 3098 |
| `invocar` | **0 s** (sem aviso) | **14 s** | Invocar Larvas | 3099 |
| `acido` | **1,0 s** | **9 s** | Ácido Corrosivo | 3100 |
| `tentaculos` | **1,3 s** | **9 s** | Tentáculos do Vazio | 3101 |

- `carrega` = tempo entre o **aviso** (`chefeCarrega`, motor.js:3147) e o **golpe**.
- `espera` = tempo entre o **fim do golpe** e a escolha da **próxima** mecânica.
- `invocar` não tem `carregando`: o ramo `if (tipo === 'invocar')` (motor.js:3140-3145)
  **devolve antes** de `i.carregando = HAB_CHEFE[tipo].carrega` (motor.js:3146) — por isso
  `carrega: 0` e **não há aviso**.

### 3.4 `RODIZIO_CHEFE` (motor.js:3103) **VARIA**

```
RODIZIO_CHEFE = {
  'Arauto do Vale': ['investida', 'pancada', 'olho'],
  'Dragão Infernal': ['sopro', 'chuva', 'rugido'],
  'Barão Nashor': ['invocar', 'tentaculos', 'acido']
}
```

Repete-se em ciclo, com `i.mecK++ % 3` (motor.js:3138). Como são 3 mecânicas, **cada mecânica sai uma
vez a cada ciclo completo**.

### 3.5 `GOLPES_DE_LONGE` (motor.js:2076)

```
GOLPES_DE_LONGE = new Set(['sopro', 'olho', 'acido'])
```

São as mecânicas que a **Parede de Vento** consegue bloquear por inteiro (motor.js:3116). As outras
(`investida`, `pancada`, `tentaculos`, `rugido`) não são bloqueáveis — só levam a redução do
muro (`10.2`).

---

## 4. A máquina de estados do chefe (`mecanicaChefe`, motor.js:3104-3148)

### 4.1 Quando é que corre

Dentro de `passo` (motor.js:1353), **depois** do jogador atacar e **antes** dos ataques automáticos dos
monstros (motor.js:1639):

```
motor.js:1632   if (!c.dg) for (const i of prontos) if (i.chefe && i.hp > 0 && d.morto <= 0) mecanicaChefe(...)
```

- `prontos = vivos.filter(i => i.chegada <= 0)` (motor.js:1464) → **o relógio do chefe só arranca
  quando ele chega ao jogador**. Enquanto `chegada > 0` ele **não ataca** (motor.js:1639) e **não usa
  mecânicas**.
- O jogador morto pára tudo (motor.js:1632, `d.morto <= 0`).
- Na Fonte, `passo` devolve antes de tudo isto.

### 4.2 As variáveis de estado (criadas no primeiro `mecanicaChefe`, motor.js:3107)

| variável | défaut | significado |
|---|---|---|
| `i.tMec` | **5 s** | contagem decrescente até escolher a próxima mecânica |
| `i.mecK` | **0** | índice dentro do rodízio |
| `i.mecAtual` | `null` | a mecânica que está a carregar |
| `i.carregando` | **0** | tempo que falta para o golpe |
| `i.furiaT` | **0** | segundos que faltam do Rugido (AS ×1,5) |
| `i.as` | do `MONSTROS` | velocidade de ataque do chefe (×1,5 durante o Rugido) |

### 4.3 O pseudocódigo (transcrição de motor.js:3104-3148)

```
mecanicaChefe(estado, c, a, i, dt):
  rodizio = RODIZIO_CHEFE[i.nome];  se !rodizio: devolve            # 3105-3106
  i.tMec   ??= 5 ;  i.mecK ??= 0                                    # 3107

  # 0) o Rugido do Dragão acaba (3108)
  se i.furiaT > 0: i.furiaT -= dt
                   se i.furiaT <= 0: i.as /= 1.5

  # 1) está a carregar um golpe? (3109)
  se i.carregando > 0:
      tipo = i.mecAtual
      # 1a) atordoamento interrompe (MENOS o rugido) (3112)
      se i.atordoado > 0 && tipo !== 'rugido':
          i.carregando = 0 ; i.tMec = 6
          emitir('chefeInterrompido', {alvo})
          devolve
      i.carregando -= dt
      se i.carregando > 0: devolve
      i.carregando = 0
      # 1b) Parede de Vento segura o golpe de longe (3116-3120)
      se GOLPES_DE_LONGE.has(tipo) && ventoSegura(c, i):
          emitir('chefeGolpe', {alvo, mec: tipo, bloqueado: true})
          i.tMec = HAB_CHEFE[tipo].espera          # o ciclo continua na mesma cadência
          devolve
      # 1c) o golpe bate (3121-3133)
      emitir('chefeGolpe', {alvo, mec: tipo})
      fn = fatorDanoMonstro(estado, i)
      fis(k) = receberDano(..., mitigar(i.ad × k, a.armadura) × fn, false)        # físico
      mag(k) = receberDano(..., mitigar(i.ad × k, a.rm)        × fn, false, true) # mágico
      se   tipo === 'investida' : fis(3,5)                                      # 3125
      senão se tipo === 'pancada' : { fis(2,2); "puxa" os outros p/ chegada 0 }  # 3126
      senão se tipo === 'olho'     : mag(2,6)                                   # 3127
      senão se tipo === 'sopro'    : { mag(2,2); queimando 4 s a 3,0 %/s }      # 3128
      senão se tipo === 'chuva'    : { mag(1,8); queimando max(actual,3) s a 2,5 %/s } # 3129
      senão se tipo === 'rugido'   : { i.as ×= 1,5 ; i.furiaT = 5 }             # 3130
      senão se tipo === 'acido'    : { mag(1,2); queimando 5 s a 2,8 %/s }      # 3131
      senão se tipo === 'tentaculos': fis(2,6)                                  # 3132
      i.tMec = HAB_CHEFE[tipo].espera                                           # 3133
      devolve

  # 2) não está a carregar: anda o relógio e escolhe a próxima (3136)
  i.tMec -= dt
  se i.tMec > 0: devolve
  tipo = rodizio[i.mecK++ % rodizio.length]                                    # 3138
  i.mecAtual = tipo
  se tipo === 'invocar':                                                       # 3140-3145
      para k em 0..1: c.inimigos.push( criarMonstro('Larva do Vazio',
                                  max(1, i.nivel − 6), { chegada: 1 + k × 0,3, invocado: true }) )
      emitir('chefeInvoca', {alvo})
      i.tMec = HAB_CHEFE.invocar.espera          # 14 s — MAS a próxima é 'tentaculos' (ver 7.2)
      devolve
  i.carregando = HAB_CHEFE[tipo].carrega                                       # 3146
  emitir('chefeCarrega', {alvo, mec: tipo, dur: i.carregando})                 # 3147
```

**Regras que se tiram disto:**

1. **A primeira mecânica é sempre a do mapa `MECANICAS`** (investida / sopro / invocar) e sai **5 s
   depois** de o chefe chegar (motor.js:3107).
2. O intervalo entre o **início** de duas mecânicas consecutivas = `espera da anterior + carrega da
   seguinte` (motor.js:3133 + 3146).
3. **Interromper uma mecânica fazê-la perder-se** (o índice `i.mecK` já avançou na escolha,
   motor.js:3138) e mete `tMec = 6` (motor.js:3112) — ou seja, a próxima escolha vem **6 s** depois, e
   não `7-9 s`.
4. **Bloquear** (parede de vento) **não** perde a mecânica nem o ritmo: `tMec = espera` (motor.js:3118).
5. O **Rugido** não pode ser interrompido por atordoamento (motor.js:3112).
6. `i.lento` **não** abranda o relógio `tMec` — só abranda o relógio do ataque automático
   (motor.js:1748).

### 4.4 Os eventos que o motor emite (para reproduzir no simulador)

| evento | dados | linha |
|---|---|---|
| `chefeCarrega` | `{ alvo, mec, dur }` | motor.js:3147 |
| `chefeGolpe` | `{ alvo, mec, bloqueado: true }` (bloqueado) ou `{ alvo, mec }` (golpe) | motor.js:3117, 3121 |
| `chefeInterrompido` | `{ alvo }` | motor.js:3112 |
| `chefeInvoca` | `{ alvo }` — **sem `dur`** | motor.js:3142 |

---

## 5. O que cada mecânica faz (motor.js:3125-3132)

| mecânica | chefe | multiplicador | tipo | dano bruto | efeito extra |
|---|---|---|---|---|---|
| `investida` | Arauto | **3,5 × AD** | **físico** | 3,5 · `i.ad` | — |
| `pancada` | Arauto | **2,2 × AD** | **físico** | 2,2 · `i.ad` | "puxa" os outros monstros para `chegada 0` |
| `olho` | Arauto | **2,6 × AD** | **mágico** | 2,6 · `i.ad` | — |
| `sopro` | Dragão | **2,2 × AD** | **mágico** | 2,2 · `i.ad` | **queima 4 s a 3,0 %/s** da vida máx |
| `chuva` | Dragão | **1,8 × AD** | **mágico** | 1,8 · `i.ad` | **queima 3 s a 2,5 %/s** da vida máx |
| `rugido` | Dragão | **0 × AD** | — | 0 | **AS ×1,5 durante 5 s** |
| `invocar` | Barão | — | — | 0 | **invoca 2 larvas** (ver `7`) |
| `acido` | Barão | **1,2 × AD** | **mágico** | 1,2 · `i.ad` | **queima 5 s a 2,8 %/s** da vida máx |
| `tentaculos` | Barão | **2,6 × AD** | **físico** | 2,6 · `i.ad` | — |

Sobre o `pancada` (motor.js:3126): `o.chegada = Math.max(o.chegada, 0)` para todos os outros
inimigos vivos. Como `chegada` **nunca é negativa** (é limitada a `≥ 0` em motor.js:1463), **esta
linha não tem efeito no motor actual** — anota-se aqui para quem simular: **não é um "pull" real**.

---

## 6. A queima dos chefes (motor.js:3128-3131 + 1377-1380)

Três mecânicas põem o jogador a arder: `sopro`, `chuva` (Dragão) e `acido` (Barão).

### 6.1 A tabela

| fonte | `queimando` (s) | `queimaDano` | dano total | linha |
|---|---|---|---|---|
| `sopro` | **4** | **3,0 %** da `a.vida` por segundo | **12 %** da vida máx | motor.js:3128 |
| `chuva` | **max(actual, 3)** | **2,5 %** da `a.vida` por segundo | **7,5 %** da vida máx | motor.js:3129 |
| `acido` | **5** | **2,8 %** da `a.vida` por segundo | **14 %** da vida máx | motor.js:3131 |

`queimaDano = a.vida × pct`, onde `a.vida` é a **vida máxima do jogador** (com itens e atributos), e
o dano é aplicado **a cada passo** de `passo` (motor.js:1377-1380):

```
motor.js:1377-1380
  se d.queimando > 0:
      d.queimando = max(0, d.queimando − dt)
      receberDano(estado, c, a, d.queimaDano × dt, true)     # doSangramento = TRUE
      se d.morto > 0: devolve
```

### 6.2 O que a queima **ignora** (porque é passada com `doSangramento = true`)

- **não** leva `fatorDanoMonstro` (motor.js:2719);
- **não** leva o `papel.recebido` do campeão (motor.js:2720) — **atinge Darius como atinge Lux**;
- **não** é bloqueada pelo Banshee's Veil (`3102`), **não** é guardada pelo Death's Dance (`6333`),
  **não** é reduzida pela Parede de Vento (`d.vento`, motor.js:2728), **não** é reduzida pelo
  `quique`/`mitose` do Zac (motor.js:2733-2734), **não** dispara o escudo do Fluxo (motor.js:2736);
- **não** emite o evento `recebido` (motor.js:2744).

**Mas** ainda: é bloqueada pela **invulnerabilidade** (motor.js:2718), é absorvida pelo **escudo**
`d.escudo` (motor.js:2741), e pode **matar** (vai ao `morrer`, motor.js:2751-2756).

### 6.3 Três pormenores que importam para simular

1. **É um valor único, não uma lista:** a mecânica seguinte **sobrescreve** `queimando` e
   `queimaDano`. Como as queimas duram 3-5 s e as mecânicas chegam a cada 7-10 s, **na prática nunca
   se sobrepõem** — mas o `chuva` usa `Math.max(actual, 3)` na **duração** e mesmo assim
   **sobrescreve o `queimaDano`** (motor.js:3129). Se estivesse uma queima mais forte a decorrer
   (ex.: sopro 3,0 %/s com 4 s), o `chuva` trocava-lhe a **potência** para 2,5 %/s mantendo a
   **duração mais longa**.
2. **Banshee's Veil bloqueia o golpe mas não a queima:** `receberDano` devolve no passo 4
   (motor.js:2721-2723), mas o `queimando`/`queimaDano` são escritos **depois** do `mag(2,2)`
   (motor.js:3128-3131) — logo a queima fica armada e vai fazer dano (durante a invulnerabilidade do
   Zhonya também é bloqueada, sendo retomada quando esta acabar).
3. **Morrer limpa a queima:** `zerarEfeitos` põe `d.queimando = 0` (motor.js:2792-2793).

---

## 7. O `invocar` do Barão — completo (motor.js:3099, 3140-3145)

### 7.1 Quantas, quando, de que nível

| pergunta | resposta | linha |
|---|---|---|
| **quantas** | **2** (`k = 0` e `k = 1`) | motor.js:3141 |
| **nível** | `max(1, nívelDoBarão − 6)` | motor.js:3141 |
| **quando** | **imediatamente** ao ser escolhida (não tem `carregando`, por isso `carrega: 0` e **sem aviso**) | motor.js:3099, 3140-3145 |
| **intervalo real** | **34,3 s** entre duas invocações (ver `7.2`) | motor.js:3103, 3138 |
| **chegada** | 1.ª larva `1,0 s`, 2.ª `1,3 s` (`1 + k × 0,3`) | motor.js:3141 |

### 7.2 Por que é 34,3 s e não 14 s

O `espera` do `invocar` é 14 s (motor.js:3099), mas o **rodízio** é
`['invocar', 'tentaculos', 'acido']` e o índice `i.mecK++` **já avançou** na escolha
(motor.js:3138) — ou seja, depois do `invocar` vem o `tentaculos`, depois o `acido`, e só aí o
`invocar` de novo:

```
ciclo do Barão = (0 + 14) + (1,3 + 9) + (1 + 9) = 34,3 s        # motor.js:3099-3101 + 3103
→ 2 larvas por cada 34,3 s  ≈  0,0583 larvas/s  ≈  3,5 larvas/min
```

(Confirmado por outro trabalho deste repo, que simulou a passo de 1/60 s e obteve invocações em
`t = 6,82 / 41,12 / 75,42 / 109,72 s` — 34,3 s de intervalo — ver a adenda da prova nº3 do AGENTS.md
e `docs/troca-em-combate.md`.)

### 7.3 As stats da larva

`MONSTROS['Larva do Vazio'] = { hp: 1,1, ad: 1,05, as: 0,8, armadura: 1, xp: 1,1, ouro: 1, magico: true }`
(motor.js:303). `criarMonstro` (motor.js:1079-1088) aplica a CURVA à parte do nível. `magico: true`
(motor.js:1082) → o dano automático da larva é **mágico** (reduzido pela `a.rm` do jogador,
motor.js:1755).

| nível do Barão | nível da larva | AD da larva | HP da larva | armadura | xp | ouro (médio) |
|---|---|---|---|---|---|---|
| 42 | 36 | 367,8 | 5551 | 59,0 | 310 | ~101 |
| 45 | 39 | 413,6 | 6131 | 63,5 | 329 | ~108 |
| 46 | 40 | 429,5 | 6325 | 65,0 | 341 | ~111 |
| 49 | 43 | 477,1 | 6932 | 69,5 | 366 | ~119 |
| 50 | 44 | 495,5 | 7135 | 71,0 | 372 | ~122 |

(auto a cada `1/0,8 = 1,25 s`; o dano de cada auto =
`mitigar(AD, a.rm) × fatorDanoMonstro × papelRecebido`, motor.js:1747-1756.)

### 7.4 O que as larvas fazem (e o que não fazem)

**Fazem:** chegam ao jogador (`chegada` 1,0/1,3 s), **atacam** (mágico), dão **XP** e **ouro** ao morrer
(motor.js:1780-1787 — **não** estão no ramo que depende de `invocado`), contam para
`processarAbates` normal, e **prendem o grupo**: o grupo só é limpo quando **todos** morrem
(motor.js:1646).

**Não fazem:**
- **não dão itens** (`i.invocado ? []` no loot, motor.js:1792);
- **não dão espólios** (motor.js:1798) nem **gemas** (motor.js:1803);
- **não contam para as tarefas** (`if (!i.invocado) contarTarefa`, motor.js:1808) **nem para as
  diárias** (`contarDiaria` devolve logo se `i.invocado`, motor.js:3425-3426);
- **não contam para a conquista** de chefe (só o `i.chefe` faz `chefes++`);
- **não** se confundem com as larvas **selvagens** do Rio/Fosso pelo nome: o discriminante é o campo
  `invocado` (motor.js:3141).

**Não roubam o alvo:** são empurradas para o fim de `c.inimigos` (motor.js:3141) e têm
`chegada ≥ 1,0` enquanto o Barão tem `chegada = 0` → o `alvo` do jogador continua a ser o Barão
(motor.js:1464-1466), salvo se o jogador **kitar** o Barão (o `kitar` põe `chegada > 0` no chefe,
motor.js:2711).

### 7.5 Pressão acumulada

| tempo de luta | larvas invocadas (média) |
|---|---|
| 60 s | ~3,5 |
| 120 s | ~7 |
| 200 s | ~11,7 |
| 300 s | ~17,5 |

---

## 8. A sequência completa de cada chefe

Tempo medido **a partir do momento em que o chefe chega ao jogador** (`chegada ≤ 0` → `prontos`,
motor.js:1464). O 0 é "o chefe chegou". Para Ezreal e Lux, somar **+1,2 s** (motor.js:1443).

### 8.1 Arauto do Vale — rodízio `investida → pancada → olho` (motor.js:3103)

| t | evento | detalhe |
|---|---|---|
| 0,00 s | `tMec = 5` começa | motor.js:3107 |
| **5,00 s** | `chefeCarrega` **investida** (1,5 s) | motor.js:3146-3147 |
| **6,50 s** | **GOLPE investida** — `3,5 × AD` **físico** | motor.js:3125 |
| 6,50 s | `tMec = 8` | motor.js:3133 |
| **14,50 s** | `chefeCarrega` **pancada** (1,2 s) | |
| **15,70 s** | **GOLPE pancada** — `2,2 × AD` **físico** | motor.js:3126 |
| 15,70 s | `tMec = 7` | |
| **22,70 s** | `chefeCarrega` **olho** (1,3 s) | |
| **24,00 s** | **GOLPE olho** — `2,6 × AD` **mágico** | motor.js:3127 |
| 24,00 s | `tMec = 8` | |
| **32,00 s** | `chefeCarrega` **investida** → recomeça o ciclo | |

**Ciclo = 27,0 s** (8 + 1,5 + 7 + 1,2 + 8 + 1,3). **Dano de mecânicas por ciclo = 8,3 × AD** (físico 5,70 +
mágico 2,60). **Sem queima.**

### 8.2 Dragão Infernal — rodízio `sopro → chuva → rugido` (motor.js:3103)

| t | evento | detalhe |
|---|---|---|
| 0,00 s | `tMec = 5` | |
| **5,00 s** | `chefeCarrega` **sopro** (1,0 s) | |
| **6,00 s** | **GOLPE sopro** — `2,2 × AD` **mágico** + **queima 4 s a 3,0 %/s** | motor.js:3128 |
| 6,00 s | `tMec = 9` | |
| **15,00 s** | `chefeCarrega` **chuva** (1,1 s) | |
| **16,10 s** | **GOLPE chuva** — `1,8 × AD` **mágico** + **queima 3 s a 2,5 %/s** | motor.js:3129 |
| 16,10 s | `tMec = 9` | |
| **25,10 s** | `chefeCarrega` **rugido** (0,8 s) | |
| **25,90 s** | **GOLPE rugido** — **0 de dano**; **AS ×1,5 durante 5 s** | motor.js:3130 |
| 25,90 s | `tMec = 7` | |
| **32,90 s** | `chefeCarrega` **sopro** → recomeça | |

**Ciclo = 27,9 s** (9 + 1 + 9 + 1,1 + 7 + 0,8). **Dano de mecânicas por ciclo = 4,0 × AD** (tudo mágico).
**Queima = 12 % + 7,5 % = 19,5 % da vida máx por ciclo.** O Rugido soma ainda os ataques automáticos
extra: durante os 5 s de `furiaT` o Dragão ataca a `0,55 × 1,5 = 0,825` ataques/s, ou seja
**+1,375 ataques por ciclo** (+1,375 × AD); `i.as` volta a 0,55 ao fim dos 5 s (motor.js:3108).

### 8.3 Barão Nashor — rodízio `invocar → tentáculos → ácido` (motor.js:3103)

| t | evento | detalhe |
|---|---|---|
| 0,00 s | `tMec = 5` | |
| **5,00 s** | **INVOCA 2 larvas** (imediatamente, sem aviso) | motor.js:3140-3145 |
| 5,00 s | `tMec = 14` | motor.js:3143 |
| **19,00 s** | `chefeCarrega` **tentáculos** (1,3 s) | |
| **20,30 s** | **GOLPE tentáculos** — `2,6 × AD` **físico** | motor.js:3132 |
| 20,30 s | `tMec = 9` | |
| **29,30 s** | `chefeCarrega` **acido** (1,0 s) | |
| **30,30 s** | **GOLPE acido** — `1,2 × AD` **mágico** + **queima 5 s a 2,8 %/s** | motor.js:3131 |
| 30,30 s | `tMec = 9` | |
| **39,30 s** | **INVOCA 2 larvas** → recomeça o ciclo | |

**Ciclo = 34,3 s** (14 + 1,3 + 9 + 1 + 9). **Dano de mecânicas por ciclo = 3,8 × AD** (físico 2,60 +
mágico 1,20). **Queima = 14 % da vida máx por ciclo.**

---

## 9. O dano por segundo que o jogador recebe

### 9.1 A fórmula

```
DPS = DPS_auto + DPS_mec + DPS_queima

DPS_auto   = as_efectivo × AD_chefe × 100/(100+def) × fatorDanoMonstro × papelRecebido
DPS_mec    = (Σ multiplicadores do rodízio / ciclo) × AD_chefe × 100/(100+def) × fatorDanoMonstro × papelRecebido
DPS_queima = (% da vida máx por segundo) × vidaMáxima
```

onde `def = a.armadura` (golpe físico) ou `a.rm` (golpe mágico), e `papelRecebido` vem da tabela
`2.4`. O `fatorDanoMonstro` vale **1** quando `L ≥ nm[0] − 2` (ver `1.3`).

| Chefe | `ciclo` | `as_efectivo` | auto (AD/s) | mecânicas (AD/s) | **total AD/s** | queima |
|---|---|---|---|---|---|---|
| Arauto do Vale | 27,0 s | 0,5111/s | 0,5111 | 0,3074 | **0,8185** | 0 %/s |
| Dragão Infernal | 27,9 s | 0,5412/s | 0,5412 | 0,1434 | **0,6846** | **0,6999 %/s da vida máx** |
| Barão Nashor | 34,3 s | 0,4665/s | 0,4665 | 0,1108 | **0,5773** | **0,4082 %/s da vida máx** |

`as_efectivo` já desconta o tempo que o chefe passa a **carregar** (e, no Dragão, já inclui o bónus do
Rugido): Arauto `0,6 × (1 − 4,0/27,0)`; Barão `0,5 × (1 − 2,3/34,3)`; Dragão `15,10 autos / 27,9 s`.
(Contagens por ciclo: autos 13,80 / 15,10 / 16,00; tempo a carregar 4,01 / 2,91 / 2,31 s.)

**Por cada 1000 pontos de AD do chefe** (antes da mitigação e do papel):

| Chefe | dano/s |
|---|---|
| Arauto | **818,5** |
| Dragão | **684,6** + 0,6999 %/s da vida máx |
| Barão | **577,3** + 0,4082 %/s da vida máx |

### 9.2 Tabela concreta — Darius (`papel recebido = 0,55`, vida máxima 3000)

**Arauto do Vale, nível 35 (AD 840,63):**

| armadura/RM | cada auto | DPS auto | DPS mec | DPS queima | **DPS total** | dano/ciclo |
|---|---|---|---|---|---|---|
| 0 | 462,3 | 236,3 | 142,1 | 0 | **378,4** | 10 218 |
| 50 | 308,2 | 157,5 | 94,7 | 0 | **252,3** | 6812 |
| 100 | 231,2 | 118,2 | 71,1 | 0 | **189,2** | 5109 |
| 150 | 184,9 | 94,5 | 56,8 | 0 | **151,4** | 4087 |
| 200 | 154,1 | 78,8 | 47,4 | 0 | **126,1** | 3406 |
| 250 | 132,1 | 67,5 | 40,6 | 0 | **108,1** | 2919 |
| 300 | 115,6 | 59,1 | 35,5 | 0 | **94,6** | 2554 |

**Dragão Infernal, nível 40 (AD 1227,00):**

| armadura/RM | cada auto | DPS auto | DPS mec | DPS queima | **DPS total** | dano/ciclo |
|---|---|---|---|---|---|---|
| 0 | 674,9 | 365,2 | 96,8 | 21,0 | **483,0** | 13 476 |
| 50 | 449,9 | 243,5 | 64,5 | 21,0 | **329,0** | 9179 |
| 100 | 337,4 | 182,6 | 48,4 | 21,0 | **252,0** | 7031 |
| 150 | 269,9 | 146,1 | 38,7 | 21,0 | **205,8** | 5742 |
| 200 | 225,0 | 121,7 | 32,3 | 21,0 | **175,0** | 4882 |
| 250 | 192,8 | 104,4 | 27,6 | 21,0 | **153,0** | 4269 |
| 300 | 168,7 | 91,3 | 24,2 | 21,0 | **136,5** | 3808 |

**Barão Nashor, nível 50 (AD 1836,80):**

| armadura/RM | cada auto | DPS auto | DPS mec | DPS queima | **DPS total** | dano/ciclo |
|---|---|---|---|---|---|---|
| 0 | 1010,2 | 471,3 | 111,9 | 12,2 | **595,5** | 20 424 |
| 50 | 673,5 | 314,2 | 74,6 | 12,2 | **401,1** | 13 756 |
| 100 | 505,1 | 235,6 | 56,0 | 12,2 | **303,9** | 10 422 |
| 150 | 404,1 | 188,5 | 44,8 | 12,2 | **245,5** | 8422 |
| 200 | 336,7 | 157,1 | 37,3 | 12,2 | **206,6** | 7088 |
| 250 | 288,6 | 134,7 | 32,0 | 12,2 | **178,9** | 6136 |
| 300 | 252,6 | 117,8 | 28,0 | 12,2 | **158,0** | 5421 |

Para outra vida máxima, soma apenas `(0,6999 %/s × vidaMáxima)` (Dragão) ou
`(0,4082 %/s × vidaMáxima)` (Barão) à coluna **DPS queima** — a queima **não** escala nem com a
armadura nem com o `papel`.

### 9.3 Dano bruto de cada golpe (antes da mitigação e do papel)

| Chefe (nível) | AD | golpe 1 | golpe 2 | golpe 3 |
|---|---|---|---|---|
| Arauto (35) | 840,63 | investida **2942** fís | pancada **1849** fís | olho **2186** mág |
| Dragão (40) | 1227,00 | sopro **2699** mág | chuva **2209** mág | rugido **0** |
| Barão (50) | 1836,80 | invocar **0** (2 larvas) | tentáculos **4776** fís | acido **2204** mág |

---

## 10. O jogador pode reagir: o que muda na luta

### 10.1 Interromper uma mecânica (atordoamento)

`if (i.atordoado > 0 && tipo !== 'rugido')` → `carregando = 0`, `tMec = 6` (motor.js:3112). A
mecânica **perde-se** (o índice do rodízio já avançou), o chefe fica **1 s** sem atacar (motor.js:1639) e a
próxima escolha vem **6 s** depois.

**Onde vem o `atordoado`** (o `levantar` de Yasuo também o põe, motor.js:2077):

| campeão | habilidade | `atordoado` | linha |
|---|---|---|---|
| Darius / Ezreal / Lux / Taric | `A` (via `acoesComuns.A`) | 1,0 s | motor.js:1836 |
| Darius | `M` (Ruptura Noxiana) | 1,0 s | motor.js:1915 |
| Ezreal | `A` (Tiro de Precisão) | 1,0 s | motor.js:2624 |
| Lux | `Q` (prende 2) | 1,5 s | motor.js:2046 |
| Lux | `T` (Convergência, a explosão) | 1,2 s | motor.js:1526 |
| Taric | `E` (Deslumbrar, a explosão) | 1,25 s | motor.js:2332 |
| Taric | `M` (Martelo Celestial) | 1,0 s | motor.js:2395 |
| Katarina | `A` (Adaga Certeira) | 1,0 s | motor.js:2282 |
| Zac | `A` (Gancho Viscoso) | 1,0 s | motor.js:2557 |
| Zac | `E` (`levantar(i, 1)`) | 1,0 s | motor.js:2549 |
| Zac | `T` (`levantar(i, 0,75)`) | 0,75 s | motor.js:2566 |
| Yasuo | `Q` tornado / `A` / `T` / `M` (via `levantar`) | 0,75-1,0 s | motor.js:2150, 2122, 2136, 2142 |

**As habilidades `A` de Darius, Ezreal, Lux, Katarina, Taric e Zac guardam-se para a Investida do
Arauto** (motor.js:1831-1833, 2278-2280, 2405-2407, 2553-2555, 2618-2620): só disparam se o Arauto
estiver a carregar. Yasuo não tem essa espera (motor.js:2095-2102) — a `A` dele (Investida do Vendaval)
usa-se sempre que está pronta.

### 10.2 A Parede de Vento (Yasuo `W`)

- Duração **4 s**; redução **30 % + 2 % por rank** (`reducao: serie(0,3, 0,02)`, motor.js:714).
- **Bloqueia por inteiro** `sopro`, `olho` e `acido` (motor.js:3116, `GOLPES_DE_LONGE`
  motor.js:2076). No Rift, `ventoSegura` devolve `{}` sempre que a parede está de pé
  (motor.js:2070-2072).
- Sobre as **outras** mecânicas (investida/pancada/tentáculos) **não** bloqueia: só reduz `ventoRed`
  (motor.js:2731).
- Sobre os **ataques automáticos** do chefe **não** bloqueia (o chefe não tem `distancia`,
  motor.js:2729) — só reduz `ventoRed`.
- Sobre a **queima** não tem qualquer efeito (motor.js:2728 exige `!doSangramento`).
- **Quando é erguida** (motor.js:2098-2106): o Yasuo espera um golpe de longe do chefe
  (`carregando > 0 && carregando < 0.9 && GOLPES_DE_LONGE.has(mecAtual)`, motor.js:2102) **ou** a vida
  baixar (contra chefe: abaixo de 50 %, motor.js:2103).

### 10.3 Invulnerabilidades e reduções

| fonte | efeito | condição | linha |
|---|---|---|---|
| Zhonya (`3157`) | 2,5 s sem levar nada | abaixo de 25 % da vida, 120 s de recarga | motor.js:2745-2746 |
| Taric `R` | 2,5 s | depois de 2,5 s de espera | motor.js:2335-2337 |
| Yasuo `N` | 2,5 s | — | motor.js:2087 |
| Katarina `B` | 1,5 s | — | motor.js:2253 |
| Zac `R` / `M` | reduz o dano recebido | durante o salto / as cópias | motor.js:2733-2734 |
| Banshee's Veil (`3102`) | bloqueia **um** golpe | 40 s de recarga | motor.js:2721-2723 |

### 10.4 Fugir ao relógio (kiting) e empurrar o chefe

- **Só os atiradores** (`K.distancia`) recuam: Ezreal `kite = {recarga: 1,6, recuo: 0,6, gasto: 0,25,
  recupera: 0,15, pausa: 0,2}` (motor.js:885-887), Lux `{recarga: 1,8, recuo: 0,55, ...}`
  (motor.js:890-892). O recuo no chefe é **metade** (`i.chefe ? 0,5 : 1`, motor.js:2711) e `×1,5` se
  ele estiver lento (motor.js:2711).
- Enquanto `chegada > 0` o chefe **não ataca nem usa mecânicas** (motor.js:1639 e `prontos`
  motor.js:1464) — logo o kiting "paga" a média de `9`.
- `i.lento` (muitas habilidades do jogador) põe o relógio do auto do chefe a **60 %** (motor.js:1748)
  mas **não** toca em `tMec`.
- Ezreal `E` e a `B` do portal empurram o chefe se `chegada ≤ 0` (metade do empurrão).

---

## 11. Não verificado / fora do âmbito

1. **Guardiões de Runeterra (`arena.js`).** Os mesmos três nomes aparecem como *guardiões* em Runeterra,
   mas com **outros** números: `GOLPES_GUARDIAO` (arena.js:1659-1663) é
   `['pisao','investida','anel']`, `['pisao','sopro','chuva']`, `['pisao','tentaculos','acido']`,
   e os multiplicadores são `pisao 2,0` / `anel 2,2` / `investida 3,0` / `sopro 2,4` /
   `chuva 1,6` / `tentaculos 2,4` / `acido 1,0` (arena.js:1682-1710) — **diferentes** dos do Rift.
   Abaixo de 30 % da vida o guardião enfurece: `i.as ×= 1,6`, `i.ad ×= 1,1` e o rodízio acelera para
   `2,4 + random` s (era `4,5 + random × 2`) (arena.js:1668-1669, 1716). **Este documento não cobre
   os guardiões de Runeterra** — os números acima foram lidos em `arena.js:1657-1737` só para marcar a
   diferença.
2. `mecanicaChefe` **não** é chamado em `arena.js` (as únicas referências no repositório são a
   exportação `interno.mecanicaChefe`, motor.js:3851, e os simuladores em `tools/`). Runeterra usa
   `pisaoGuardiao` (arena.js:1667).
3. **Vilemaw** (chefe global, `arena.js:1747-1785`) tem golpes próprios (`GOLPES_VILEMAW`), não
   cobertos aqui.
4. A **posição** do chefe em Runeterra, o raio exacto de cada golpe e o desenho do aviso no ecrã
   (`cena.js`) não foram auditados.
5. Não se simulou a luta completa com o jogador (vida, curas, poções, itens, cooldowns). Os números desta
   peça são a **saída** do chefe e a **pipeline** do dano — o resto pertence às outras peças da função de
   decisão.
6. **A dungeon** (`c.dg`, motor.js:1632, 1639, 2719) tem regras próprias (o nível dos monstros é o do
   grupo, o factor de diferença não se aplica, cada monstro bate em quem escolheu) — fora do âmbito.

---

## 12. Referência rápida de todos os números

| constante / valor | número | linha |
|---|---|---|
| `MECANICAS` | Arauto→investida · Dragão→sopro · Barão→invocar | motor.js:3089 |
| `BARAO` | duracao 180 · dano 0,25 · regen 0,5 · recall 2 | motor.js:3090 |
| `tMec` inicial | 5 s | motor.js:3107 |
| `tMec` após interrupção | 6 s | motor.js:3112 |
| `investida` | 1,5 s / 8 s · **3,5 × AD** físico | motor.js:3093, 3125 |
| `pancada` | 1,2 s / 7 s · **2,2 × AD** físico | motor.js:3094, 3126 |
| `olho` | 1,3 s / 8 s · **2,6 × AD** mágico | motor.js:3095, 3127 |
| `sopro` | 1,0 s / 9 s · **2,2 × AD** mágico + queima 4 s @ 3,0 %/s | motor.js:3096, 3128 |
| `chuva` | 1,1 s / 9 s · **1,8 × AD** mágico + queima 3 s @ 2,5 %/s | motor.js:3097, 3129 |
| `rugido` | 0,8 s / 7 s · **0 dano**, AS ×1,5 por 5 s | motor.js:3098, 3130 |
| `invocar` | 0 s / 14 s · **2 larvas** nível `max(1, nv−6)`, `chegada 1,0/1,3 s` | motor.js:3099, 3141 |
| `acido` | 1,0 s / 9 s · **1,2 × AD** mágico + queima 5 s @ 2,8 %/s | motor.js:3100, 3131 |
| `tentaculos` | 1,3 s / 9 s · **2,6 × AD** físico | motor.js:3101, 3132 |
| `GOLPES_DE_LONGE` | {sopro, olho, acido} | motor.js:2076 |
| ciclo Arauto / Dragão / Barão | **27,0 s / 27,9 s / 34,3 s** | motor.js:3092-3103 |
| dano de mecânicas por ciclo | **8,30 / 4,00 / 3,80 × AD** | motor.js:3125-3132 |
| queima por ciclo | **0 % / 19,5 % / 14,0 %** da vida máx | motor.js:3128-3131 |
| `as` Arauto / Dragão / Barão | 0,6 / 0,55 / 0,5 ataques por s | motor.js:305-307 |
| `as` efectivo | 0,5111 / 0,5412 / 0,4665 ataques por s | calculado (`9.1`) |
| chance de chefe por grupo | 1,5 % | motor.js:381, 383, 385, 1134 |
| chegada inicial do chefe | 1,8 s (+1,2 para Ezreal/Lux) | motor.js:1134, 1443 |
| nível do chefe | `max(nm[0]+2, min(nm[1]+2, L+4))` | motor.js:1134 |
| `NIVEL_DIF` (lido 14/10/2026) | livre 4 · +35 %/nv (teto ×5) · −12 %/nv (piso ×0,25) | motor.js:1199 |
| `DROP_CHEFE` | 0,1 % lendário · 5 % épico · 40 % básico | motor.js:1158 |
| larvas | 2 por 34,3 s · sem loot/gemas · contam XP/ouro | motor.js:3141, 1792-1808 |
| protecção contra mecânicas | **só `a.armadura` / `a.rm`** (disciplina/estandarte/diamante/membrana **não** contam) | motor.js:3123-3124 vs 1755 |
