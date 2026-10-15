# Troca de itens em combate — bota de CDR (3171) x bota de pen (3175)

> Frente: **troca de itens em combate**. Pergunta do dono (2026-10-14): *"começar com bota de cdr, trocar
> pra pen com larva spawnando"*. Este documento responde com números lidos do código, cada um com `file:linha`.
> Reproduz tudo com: `bun tools/sim-troca.mjs` (ou `node tools/sim-troca.mjs`).

**Fonte de todos os números:** `docs/game-src/motor.js`, `docs/game-src/jogo.js`, `docs/game-src/itens.js` e o
motor de simulação já estabelecido `tools/sim-chefes.mjs` + o modelo de DPS de `tools/sim-build.mjs` §10.1
(linhas 1090-1154). O `motor.js` não é importável (`motor.js:3-8` importa `dados-ezreal/yasuo/lux/katarina/
taric/zac.js`, ausentes do repositório) — é por isso que o `tools/sim-troca.mjs` reproduz o modelo termo a termo,
com a linha do motor ao lado de cada termo.

---

## 1) A troca é possível durante a luta? SIM — e o caminho não tem uma única condição de combate

### 1.1 O que decide o clique de equipar

| função | onde | condição de combate? |
|---|---|---|
| `equipar(estado, k)` | `motor.js:2870-2881` | **NENHUMA** |
| `trocarItem(estado, k, j)` | `motor.js:2883-2888` | **NENHUMA** |
| `desequipar(estado, k)` | `motor.js:2913-2917` | **NENHUMA** |

O `tools/sim-troca.mjs` (T0) extrai o **corpo** destas três funções por regex e faz uma asserção: se alguma
delas passar a conter `emCombate`, `combate`, `arena`, `recall` ou `viajar`, o script **falha**. Hoje: nenhuma.

> Confirmação independente: `tools/sim-swap.mjs` (frente do **Dragão Infernal**, escrita em paralelo por outro
> agente) diz o mesmo no cabeçalho, linhas 9-12, e acrescenta que `motor.js:2834 alternarBarra` e
> `motor.js:2841 trocarNaBarra` também não olham para o combate — a troca de **habilidades** na barra é livre.

O corpo de `equipar` (`motor.js:2870-2881`) é só isto, para bota:

```js
if (ehBota(id)) {
  const j = estado.itens.findIndex(ehBota);
  if (j >= 0) { estado.mochila[k] = estado.itens[j]; estado.itens[j] = id; limitarVida(estado); return true; }
  estado.mochila.splice(k, 1); estado.itens.push(id); return true;
}
```

### 1.2 O caminho do clique (o que a extensão tem de fazer)

| ação | onde |
|---|---|
| abrir a bolsa (tecla `I`) | `jogo.js:1645` |
| `#hud-bolsa` / `#hud-equip` -> `abrirBolsa()` | `jogo.js:6085-6086`, função em `jogo.js:6011` |
| clicar no slot da mochila da bolsa -> `equiparDaMochila(k)` | `jogo.js:6070-6084` (o `else` da linha 6081) |
| clicar no slot de `#mochila` (aba Itens) -> `equiparDaMochila(k)` | `jogo.js:5925-5928` |
| `abrirAba('itens')` — a aba Itens, sem travão de combate | `jogo.js:5046-5051` |
| clicar num equipado -> `guardarEquipado` -> `desequipar` | `jogo.js:5919-5923`, `jogo.js:5930-5934` |

Um detalhe que poupa trabalho à extensão: `preencherSlots` só reescreve `innerHTML` quando o `dataset.id` muda
(`jogo.js:5969-5973`) e os `<button class="slot">` são criados uma única vez (`jogo.js:6016-6017`) — a referência
ao elemento do slot **não** é invalidada pelo `atualizarUI()` de 0,2 em 0,2 s (`jogo.js:1570`).

### 1.3 As portas que existem (nenhuma delas no caminho do equipamento)

| travão | onde | o que trava |
|---|---|---|
| `emCombate(c)` | `motor.js:3056` | `!!c.arena?.mundo && (combatePvp > 0 \|\| apanhou > 0 \|\| inimigo com aggro vivo)` |
| `voltarBase` | `motor.js:3061` | `if (LOCAL[estado.local]?.arena && emCombate(c)) return false;` — o recall |
| `emCombateAqui()` | `jogo.js:462` | `localAtual().arena && M.emCombate(combate)` |
| viagem | `jogo.js:467` | `comecarViagem`: em combate nem começa |
| viagem a cidade | `jogo.js:826` | `viajarCidade` |
| mapa | `jogo.js:3869` | `#mapa-info` -> viajar |
| voltar à base | `jogo.js:4510` | `#voltar-base` |
| arena | `jogo.js:4634` | `podeIrParaArena` |

Como o dono já tinha verificado: `rio` (`motor.js:367-368`), `dragao` (`motor.js:369-370`) e `barao` (`motor.js:371-372`)
**não** têm o campo `arena` no `LOCAIS`; só `arena` (Runeterra, `motor.js:374`) e `aram` (Arena, `motor.js:377`) o têm.
Logo `emCombateAqui()` é `false` nessas três regiões e nenhum destes travões se aplica. **Confirmado por leitura.**

### 1.4 Quanto custa o clique

* **Animação/cooldown: nenhum.** `equipar`/`trocarItem`/`desequipar` são síncronos e não têm campo de tempo; o
  `cena.js` não tem **nenhuma** referência a equipar (grep a `equip` em `docs/game-src/cena.js`: 0 resultados) —
  não há animação de equipamento na cena.
* **O jogo não pausa.** `quadro()` chama `avancar(true)` a cada 1/60 s (`jogo.js:1516-1525`) e `avancar()` corre
  `while (acum >= DT) M.passo(estado, combate, DT)` (`jogo.js:1564`) — com janelas abertas ou fechadas. A bolsa
  aberta **não** interrompe a luta.
* **A mochila cheia não impede.** Para bota, `equipar` troca de lugar com a equipada, sem `splice` e sem precisar de
  espaço (`motor.js:2873-2875`).
* **Não custa vida.** `limitarVida` (`motor.js:2866`, chamado em `2875` e `2887`) só corta a vida se a vida máxima
  descer; as duas botas dão `vida: 0` (`itens.js:1537` e `itens.js:1789`) — a troca não tira um único ponto de vida.
* **Custo em tempo de jogo: 0 s.** O custo real é o DPS que se perde (secção 6).

---

## 2) As duas botas

| | **3171 Lucidez Escarlate** (`itens.js:1537`) | **3175 Sapatos Enfeitiçados** (`itens.js:1789`) |
|---|---|---|
| preço | 2800 | 2900 |
| AP | 60 | 70 |
| cdr | 0,15 | 0 |
| penMag | 0 | 0,15 |
| mana | 400 | 0 |
| vida | 0 | 0 |
| com qualidade A | AP 69,0 · cdr **17,25%** | AP 80,5 · penMag **15,00%** |

`infoItem` (`motor.js:251-255`) multiplica por `(1 + 0.12*refino) * mult_qualidade` **estes** campos:
`ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr` — e **não** o `penMag`. Ou seja: a bota de CDR
**ganha** com qualidade/refino (17,25% em A), a de pen **não** (fica nos 15% em qualquer qualidade).

A mana da 3171 é **inútil para a Katarina**: `KITS_SIM.katarina.semMana` (`tools/sim-chefes.mjs:363`) e `motor.js:520`
(`manaMax = k.semMana ? 0 : ...`) — 400 de mana não viram nada.

O Ímpeto Cósmico (4629) tem `cdr: 0,15` por `motor.js:24` (o JSON de `itens.js` não traz o campo). Com `+3~A`
(`motor.js:255` + `motor.js:55`): `0,15 x 1,36 x 1,15 = 23,46%`.

---

## 3) O relógio das larvas: **34,3 s, não 14 s** (correcção)

O `motor.js:3076` diz `invocar: { carrega: 0, espera: 14, nome: 'Invocar Larvas' }`. O 14 é a **espera do invocar**, não
o período das larvas. O invocar é **1 de 3** mecânicas do rodízio do Barão (`motor.js:3080`):

```
RODIZIO_CHEFE['Barão Nashor'] = ['invocar', 'tentaculos', 'acido']   // motor.js:3080
  invocar     carrega 0   s · espera 14 s   (motor.js:3076)
  tentaculos  carrega 1,3 s · espera 9  s   (motor.js:3078)
  acido       carrega 1   s · espera 9  s   (motor.js:3077)
```

O ciclo é a soma de `(carrega + espera)` das três: `0+14 + 1,3+9 + 1+9 = ` **34,3 s**. Simulado passo a passo
(`tools/sim-troca.mjs` T2, reproduzindo `motor.js:3081-3125`):

```
INVOCAÇÕES (2 larvas cada, motor.js:3118): t = 6,82 s · 41,12 s · 75,42 s · 109,72 s · 144,02 s · ...
período medido: 34,3 · 34,3 · 34,3 · 34,3 s
golpes no meio: tentaculos @ 22,1 s · acido @ 32,1 s · tentaculos @ 56,4 s · acido @ 66,4 s
```

O relógio só arranca quando o chefe **chega**: `motor.js:1612` corre `mecanicaChefe` sobre `prontos`
(`chegada <= 0`, `motor.js:1444`) e o chefe nasce com `chegada: 1,8` (`motor.js:1121`); o `tMec ??= 5` (`motor.js:3084`)
conta a partir daí -> primeira invocação em `1,8 + 5 = 6,8 s`.

> **Nota (REGRA Nº 7):** a tabela do `AGENTS.md` (prova #3) diz *"o Barão invoca 2 larvas a cada 14s"*. Está errada
> pelo motivo acima — é o mesmo tipo de erro que a própria tabela denuncia (responder a partir do campo em vez de
> ler o bloco inteiro). **Não corrigi o `AGENTS.md`** porque o meu âmbito de escrita é só este documento e o
> `tools/sim-troca.mjs`. Fica sinalizado para quem tem o ficheiro.

---

## 4) O DPS com cada bota (o alvo é o Barão)

Katarina nv29, atributos **medidos** (Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · **Foco 0** —
`tools/sim-build.mjs:1052`). Barão nv42 (regra de nível em `motor.js:1121` + `nm:[40,48]` de `motor.js:371`):
**97 824 de vida** (`CURVA.hp(42) x 16`, `motor.js:274` + `motor.js:297`), armadura 122,4 (`CURVA.armadura(42) x 1,8`,
`motor.js:276` + `motor.js:297`) -> armadura mágica 73,44 (`x RM_MONSTRO 0,6`, `motor.js:1179`).
Núcleo fixo (a build do dono sem a bota): `3089+2~B, 3135~A, 3100+3~A`; 5.º espaço `4629+3~A`.

| bota | cdr total | travado? | penMag | AP | **DPS no Barão** | mata em | auto/skills/giro/itens |
|---|---|---|---|---|---|---|---|
| **3171~A** (CDR) | 40,00% | SIM | 40,0% | 1035,9 | **702,4** | **139,3 s** | 35,6 / 275,5 / 225,1 / 166,3 |
| **3175~A** (pen) | 23,46% | — | 55,0% | 1051,4 | **608,1** | **160,9 s** | 35,6 / 236,3 / 192,9 / 143,3 |
| 3171~B | 38,46% | — | 40,0% | 1023,7 | 679,9 | 143,9 s | 35,6 / 266,3 / 217,8 / 160,3 |
| 3175~B | 23,46% | — | 55,0% | 1037,2 | 602,2 | 162,5 s | 35,6 / 234,0 / 191,2 / 141,4 |

* Com a qualidade da bota do dono (`~A`): **CDR 702,4 vs pen 608,1 dps -> +94,4 dps (+15,52%)** e o Barão morre
  **21,6 s mais cedo**.
* Com `~B`: +77,8 dps (+12,91%).
* De onde vem: o cdr acelera **todas** as habilidades (`motor.js:1581` faz `d.recargas[t] = recarga * (1 - reducaoRecarga)`
  em cada lançamento); o pen de 15% só vale **+8,28%** no dano mágico (armadura mágica 73,44 -> 33,05, mitigação
  69,41% -> 75,16%). E o tecto de 40% (`motor.js:537`) corta pouco: o Ímpeto sozinho dá 23,46%, a bota vale 16,54%
  efectivos e deita fora 0,71%.

Barra escolhida pelo motor de simulação (`escolherBarra`, `tools/sim-chefes.mjs:485`): **R/Q/A/E**, ranks
`{Q:10, W:0, E:6, R:4, A:9}` — a **W tem rank 0**, o que vai importar na secção 5.3.

---

## 5) A janela das larvas — quantificada

### 5.1 O DPS no Barão **não** depende do número de larvas

Lido no motor:

* o alvo do campeão é `prontos[0]` (`motor.js:1446`) e o Barão é `c.inimigos[0]` — o chefe nasce **sozinho**
  (`motor.js:1121`) e as larvas são **empurradas no fim da lista** (`motor.js:3118`). O Barão nunca sai de alvo.
* as habilidades de área incluem sempre o alvo: a Q da Katarina monta a lista `[alvo, ...]` (`motor.js:2275`);
  o Lótus corta os 3 mais perto **por `chegada`** (`motor.js:2190`) e o Barão tem `chegada 0` desde que chega;
  o giro da adaga corta todos os que têm `chegada <= 0,5` (`motor.js:2179`).
* cada golpe é aplicado **uma vez por alvo** (`motor.js:2165`, `motor.js:2191`): mais larvas = mais dano **total**,
  não mais dano **no Barão**.

Confirmado pelo modelo (o `alvos` do modelo multiplica cada habilidade por `min(alvos, alvosDaHabilidade)`):

```
3171~A: DPS no Barão = 702,4  ·  somando 3 alvos = 1459,8  -> o extra (757,4) vai todo para as 2 larvas = 378,7 dps por larva
3175~A: DPS no Barão = 608,1  ·  somando 3 alvos = 1257,5  -> o extra (649,4) vai todo para as 2 larvas = 324,7 dps por larva
```

### 5.2 O pen vale **menos** contra as larvas do que contra o Barão

| | armadura mágica com a bota de pen | com a bota de CDR | ganho do pen |
|---|---|---|---|
| Barão (armadura 122,4) | 33,05 | 44,06 | **+8,28%** |
| Larva do Vazio (nv36 = nível do Barão − 6, armadura 59,0 = `CURVA.armadura(36) x 1,0` · `motor.js:276` + `motor.js:290`) | 15,93 | 21,24 | **+4,58%** |

Ou seja: **na janela das larvas o dano é diluído para alvos onde o pen vale menos**. Se alguma coisa, a janela
favorece a bota de CDR, não a de pen.

### 5.3 A Voracidade (a única força que puxa para o pen) — e é minúscula

`motor.js:1789`: cada abate tira `1,5 s` das recargas de **Q/W/E** (`P.voracidade`, `motor.js:736`; 5 s se o morto for
chefe). Duas larvas por invocação -> **3 s devolvidos em Q/W/E a cada 34,3 s**.
O refund só aproveita o que **falta** da recarga (`Math.max(0, d.recargas[t] - 1.5)`): com a recarga a correr, o que
falta é uniforme em `[0, C]` -> refund médio `1,5 - 1,125/C` (fórmula, não número do jogo).

| bota | Q (C=4,11 s / 5,24 s) | E (C=4,80 s / 6,12 s) | Voracidade soma | em % do DPS |
|---|---|---|---|---|
| 3171~A (CDR) | refund 1,23 s -> +6,12 dps | refund 1,27 s -> +2,92 dps | **+9,03 dps** | 1,29% |
| 3175~A (pen) | refund 1,29 s -> +5,50 dps | refund 1,32 s -> +2,60 dps | **+8,10 dps** | 1,33% |

Em dps **absoluto** quem ganha mais com o refund é a bota de CDR; em termos **relativos** a de pen ganha 1,33%
contra 1,29% — **0,05%** de diferença. Contra os **15,52%** de vantagem da bota de CDR, isto é ruído.
(A W não conta: tem rank 0 nesta build — o refund na W é deitado fora.)

### 5.4 O cdr fica preso nas recargas já em curso (crédito único da troca)

`motor.js:1581` escreve a recarga **no momento do lançamento** (`d.recargas[t] = recarga * (1 - a.reducaoRecarga)`) e o
`passo` só a decrementa (`motor.js:1363`). Trocar de bota **não** reescreve o que já está a correr: as habilidades
lançadas com a bota de CDR voltam no tempo antigo. É um crédito de uma vez, limitado por `(C_pen - C_cdr)` por
habilidade (o que falta da recarga é, no máximo, `C`):

```
Q (1,13 s x 85,5 dps = 97) + E (1,32 s x 39,5 dps = 52)  ->  credito maximo da troca CDR -> PEN = 149 de dano
contra os 12 667 que a mesma troca perde (seccao 6).
```

### 5.5 Tempo de vida das larvas

2 larvas x 5551 de vida (`CURVA.hp(36) x 1,1`, `motor.js:274` + `motor.js:290`) = 11 101 de vida:

* com a bota de CDR: 378,7 dps por larva -> as 2 caem em **14,7 s**
* com a bota de pen: 324,7 dps por larva -> as 2 caem em **17,1 s**
* as larvas vivem **2,4 s mais** com a bota de pen (e o ciclo é de 34,3 s — as duas botas limpam antes da próxima).

### 5.6 Resposta à pergunta 3

**Não há janela.** O que decide a luta (o DPS no Barão) é **o mesmo com 0 ou com 2 larvas vivas** (5.1); o pen fica
mais fraco na janela (5.2); a Voracidade dá **0,05%** à bota de pen (5.3) e o cdr já preso nas recargas vale **149 de
dano uma vez** (5.4) — contra **15,52%** de vantagem da bota de CDR. Nada disto chega perto de inverter a conta.

---

## 6) O custo da troca

O clique custa **0 s de jogo** (secção 1.4). O custo é o DPS que se perde. Com o Barão a chegar a t = 1,8 s
(`motor.js:1121`) e o campeão a só bater depois disso (`motor.js:1575`: o bloco de ataque/habilidades só corre se
`alvo` existir, e `alvo = prontos[0]`, `motor.js:1446`):

| política | fim da luta | vs SEMPRE CDR |
|---|---|---|
| **SEMPRE CDR 3171~A** | **141,1 s** | +0,0 s |
| SEMPRE pen 3175~A | 162,7 s | +21,6 s |
| CDR até t=6,8 s (1.ª invocação) e pen depois | 161,9 s | +20,8 s |
| CDR até t=41,1 s (2.ª invocação) e pen depois | 156,6 s | +15,5 s |
| CDR até t=75,4 s (3.ª invocação) e pen depois | 151,3 s | +10,2 s |
| CDR até t=109,7 s (4.ª invocação) e pen depois | 145,9 s | +4,9 s |

Trocar para a de pen no 1.º invocar (t = 6,8 s) perde **12 667 de dano = 12,9% da vida do Barão**.
Quanto mais tarde a troca, menos se perde — e **nunca** trocar é o ótimo. A troca ao contrário
(pen -> CDR) feita no 1.º instante vale **21,6 s de luta** e 15 180 de dano a mais.

---

## 7) A política ótima, com números

**A bota de CDR (3171) ganha em todas as fases da luta, com ou sem larvas.** Política: **começar com a 3171 e
não trocar**. Se começar com a de pen, trocar para a de CDR no primeiro instante.

O único caminho para a de pen ganhar é o cdr da bota **deixar de valer** — quando o Ímpeto sozinho chega perto do
tecto de 40% (`motor.js:537`). Varredura do Ímpeto (`refino 0..5` x qualidade `C..SS`; `motor.js:24` + `motor.js:173-179`
+ `motor.js:55`), com o resto da build fixo:

| Ímpeto | cdr do Ímpeto | cdr com a bota | DPS CDR | DPS pen | ganha |
|---|---|---|---|---|---|
| 4629+3~A (**hoje**) | 23,46% | 40,00% | **702,4** | 608,1 | CDR +94,4 |
| 4629+5~S | 32,40% | 40,00% | 730,1 | 710,3 | CDR +19,7 |
| 4629+3~SS | **34,68%** | 40,00% | 737,1 | **740,9** | **pen +3,8** |
| 4629+5~SS | 40,80% | 40,00% | 756,0 | 823,9 | pen +67,9 |

**Ponto de viragem: entre 32,40% e 34,68% de cdr no Ímpeto.** Abaixo disso a bota de CDR ganha sempre;
acima, o cdr já bate no tecto e a bota vira desperdício.

---

## 8) O que a extensão teria de fazer (se o dono quiser a troca automática)

1. abrir a bolsa: tecla `I` (`jogo.js:1645`) ou `document.querySelector('#hud-bolsa').click()` (`jogo.js:6086`);
2. clicar no slot `k` da mochila dentro de `#bolsa-mochila` (`jogo.js:6072-6081`) — o índice `k` é a posição do
   elemento dentro do contentor (`jogo.js:6072`);
3. verificar que a bota entrou: `estado.itens.find(ehBota)` (`motor.js:2874`) ou o `dataset.id` do slot
   (`jogo.js:5973`).

**Gatilho observável (em vez de relógio):** o motor emite `chefeInvoca` (`motor.js:3119`) e `chefeCarrega`
(`motor.js:3124`) — são eventos do motor (`emitir`, `motor.js:1169`), não um temporizador a adivinhar. O relógio
equivalente é de **34,3 s** (não 14 s).

---

## 9) PRECISA DE REGRA DO DONO

* **Se a extensão deve trocar de bota sozinha em combate** e com que gatilho (`chefeInvoca` ou relógio). Os números
  dizem **não trocar** (custa 94,4 dps e 21,6 s de luta); a decisão de automatizar é política.
* **O que fazer quando o Ímpeto passar de ~34,7% de cdr** (aí a 3171 passa a ser desperdício e a de pen ganha):
  a extensão deve passar a preferir a de pen na pontuação de itens?
* **Troca defensiva** (trocar para a 3170/3173 quando a vida está baixa) não foi pedida e não está quantificada
  aqui — é outra política, com o critério do dono (sobrevive? quantas poções?).

---

## 10) Limitações honestas

* A base dos campeões (`BASE_CAMPEAO.katarina`) é **CALIBRADA NÃO VERIFICADA** — 1 ponto medido (nv29),
  `tools/sim-chefes.mjs:352-353`. `dados-katarina.js` não existe no repositório (`motor.js:6`).
* O `refund médio = 1,5 - 1,125/C` da secção 5.3 é uma **fórmula minha** (uniformidade do que falta da recarga),
  não um número do jogo — está identificada como tal no relatório.
* O modelo de DPS é o de `tools/sim-build.mjs` §10.1 (estado estacionário, sem simular a luta golpe a golpe):
  é o mesmo modelo das secções S1-S3 que o dono já usa, o que mantém os números comparáveis.
* As larvas também **batem** (o dono leva dano delas), o que pesa no critério "sobrevive?/poções" — não é o tema
  desta frente e não está quantificado aqui.

---

## 11) Reproduzir

```
bun tools/sim-troca.mjs        # ou: node tools/sim-troca.mjs
```

Secções do relatório: **T0** o caminho da troca (com asserção anti-travão) · **T1** as duas botas · **T2** o relógio
do Barão · **T3** DPS por bota · **T4** a janela das larvas · **T5** o custo da troca · **T6** a política e a
varredura do Ímpeto · **T7** as respostas.
