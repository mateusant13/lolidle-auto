# Plano Mestre — ITENS · SKILLS · BARRA · ATRIBUTOS · FARM · ROTINA DE BASE

> **Revisão medida:** `extension/automation.js` @ sha256 `d510610c053b756c055e64ae841e28b807cfacc3408844397902558086f3eb0a`
> · 324.983 bytes · 4.916 linhas.
> **Método:** leitura estática de `docs/game-src/motor.js`, `docs/game-src/itens.js`, `docs/game-src/jogo.js`
> e do próprio `extension/automation.js`, **mais** execução do `automation.js` REAL contra o stub de DOM
> do banco (`tools/testes/dom-stub.mjs`) com o **catálogo real** (`ITENS_DADOS`) e a tabela real de
> `LOCAIS`/`MONSTROS`/`POCOES` do motor. **Zero contacto com browser, jogo, CDP ou portas.**
> **Regra do dono que governa tudo:** *"resolva o jogo. faça o melhor auto play possivel."*

---

## 0. Sumário executivo

| Eixo | O que estava | O que está agora | Onde |
|---|---|---|---|
| **A. Itens especiais por campeão** | Uma guarda SOLTA (`RABADON = '3089'`) e mais nada | `ITENS_ESPECIAIS` (29 linhas com `file:linha`) + auto-derivação dos campos multiplicativos do catálogo | `automation.js:3111`, `automation.js:3158` |
| **B. Equipar** | Não existia: `planBag` não lia `readEquip()`, sem acção `EQUIPAR`, sem termo de raridade | `alvoEquip()` (fonte única) + `cmpEquip` com raridade dura + acção `EQUIPAR` + histerese só lateral | `automation.js:3300`, `automation.js:3324`, `automation.js:340` |
| **C. Skills** | Ordenava por DPS do rank **actual**; `gastos` contado por clique | Desbloquear primeiro (x1,5), depois ganho **marginal** do próximo rank | `automation.js:1195`, `automation.js:1619` |
| **D. Barra** | `rotacaoSkills` ordenava por **recarga** e **excluía a ultimate** fora de chefe | `barraIdeal` determinística com a ultimate FIXA; `aplicarBarra` converge e para | `automation.js:4167`, `automation.js:4195` |
| **E. Atributos** | `'equilibrado'` por omissão (Força = Vitalidade) | `modeloAtribDe` derivado do motor; Yasuo = `'dano'` (Força 3) | `automation.js:2265` |
| **F. Farm** | Objectivo `'xp'` só; podia ficar em região abaixo do nível | `'ouro+xp'` com a taxa do PRÓPRIO motor + trava de região abaixo do nível | `automation.js:4421`, `automation.js:4434` |
| **G. Rotina de base** | `ok:true` eterno, 1 passagem, saía a meio, voltava 20 s depois | Repete (máx 3), `ok` por RE-LEITURA, backoff de 45 min, tecto de recalls → modo farm | `automation.js:2082`, `automation.js:4533` |
| **H. Ciclo de recall** (P0 ao vivo) | `n.vender` por 1 item; `n.repor` pela Poção Suprema (nível 30); `n.presente`/`n.tarefa` PERMANENTES | Custo da viagem em ouro-equivalente; vender só com a mochila quase cheia; repor no piso; presente exige VISIBILIDADE e a tarefa tem throttle | `automation.js:1938`, `automation.js:2044`, `automation.js:2052` |

**Verificação:** `node --check extension/automation.js` → **rc=0**;
`node tools/testes/run.mjs` → **rc=0**, POPULATION **134**, **0 falhas**, **UNSTUBBED=0**.

---

## A. ITENS — tratamento especial POR CAMPEÃO

### A.1 O IDEAL (pedido do dono, verbatim)

> *"ele deve saber que tipo de itens devem receber tratamento especial pra cada campeao, igual o
> rabadon tambem"*

Um item merece tratamento especial quando o motor **muda a REGRA** por causa dele — não quando ele
só soma stats. O Rabadon é o exemplo: `motor.js:522` faz `ap *= 1.35` (multiplica o TOTAL), não
`ap += 130`. O equivalente AD existe e é o **Gume do Infinito**: `motor.js:515`
`danoCritico += 0.4`.

### A.2 O ATUAL antes (o GAP)

| # | Problema | file:linha (antes) |
|---|---|---|
| A1 | A **única** protecção "especial" era uma constante solta: `const RABADON = '3089'` | `automation.js:25` |
| A2 | O equivalente AD (Gume do Infinito, `motor.js:515`) não existia em lado nenhum | — |
| A3 | `valorPassiva` pontuava a passiva **fora** do multiplicador de classe: o Rabadon valia **317** num Yasuo AD e **entrava** no conjunto-alvo (medido) | `valorDe` |
| A4 | Um lendário da **classe errada** ganhava de um básico da classe certa pela regra dura de raridade | — |

### A.3 Como o MAPA foi DERIVADO (não é hardcode solto)

```
(a) grep "tem('[0-9]+')" docs/game-src/motor.js   -> TODOS os pontos onde o motor lê um item pelo ID
    para mudar a REGRA dele. Cada linha da tabela cita o file:linha dessa leitura.
(b) o catálogo pode declarar campos MULTIPLICATIVOS (adPct/apPct/vidaPct/armPct/rmPct/esquiva)
    que o motor soma em pct (motor.js:501) e aplica ao TOTAL (motor.js:511, motor.js:523).
    CAMPOS_MULT (automation.js:3153) acrescenta esses itens SOZINHO, sem ninguém os escrever.
(c) cada entrada só EXISTE se o item estiver no catálogo real (mapaEspecial, automation.js:3158):
    item fora do catálogo -> a entrada não é criada (derivado, não inventado).
```

### A.4 O mapa (extracto — as 29 entradas estão em `automation.js:3111`)

| id | item | papel | tipo | PORQUÊ (número do motor) | fonte |
|---|---|---|---|---|---|
| `3089` | Capuz da Morte de Rabadon | ap | multiplicador | `ap *= 1.35` — +35% de TODO o Poder de Habilidade | `motor.js:522` |
| `3003` | Cajado do Arcanjo | ap | multiplicador | `ap += 0.03 * manaMax` | `motor.js:521` |
| `3135` | Cajado do Vazio | ap | penetração | 40% de penetração mágica | `motor.js:529` |
| `3100` | Perdição de Lich | ap | proc | +75% do AP no ataque depois de uma habilidade | `motor.js:1688`, `motor.js:1944` |
| `3157` | Ampulheta de Zhonya | ap | anti-morte | invulnerável 2,5 s abaixo de 25% de vida | `motor.js:2722` |
| `3031` | **Gume do Infinito** | ad | crítico | `danoCritico += 0.4` — **o equivalente AD do Rabadon** | `motor.js:515` |
| `3036` | Lembranças do Lorde Dominik | ad | penetração | 30% de penetração de armadura | `motor.js:539` |
| `3071` | Cutelo Negro | ad | penetração | −6% de armadura por ataque, até −30% | `motor.js:1705` |
| `3072` | Sedenta por Sangue | ad | sustento | a cura acima da vida máxima vira escudo (25%) | `motor.js:1229` |
| `3078`/`3057` | Força da Trindade / Fulgor | ad | proc | 2 / 1 cargas de Lâmina Encantada | `motor.js:1672` |
| `6610` | Céu Dividido | ad | crítico | o 1.º ataque em cada inimigo é crítico | `motor.js:1699` |
| `3153` | Espada do Rei Destruído | ad | %vida | 5% da vida ATUAL do alvo | `motor.js:1702` |
| `3046` | Dançarina Fantasma | ad | velocidade | +6% de vel. de ataque por ataque (5 acum.) | `motor.js:1707` |
| `3085`/`6631`/`3074` | Runaan / Quebrapassos / Hidra Raivosa | ad | área | projéteis extra / +80% AD em área / 40% do AD nos outros | `motor.js:1718`-`motor.js:1720` |
| `6333`/`3026`/`3053` | Dança da Morte / Anjo Guardião / Sterak | ad | anti-morte | sangramento+abate cura / renasce / escudo <30% | `motor.js:1790`, `motor.js:2729`, `motor.js:2725` |
| `2501` | Armadura Sangrenta do Suserano | tanque | multiplicador | AD = 2% da vida bónus | `motor.js:514` |
| `3065`/`3075`/`3748` | Semblante / Espinhos / Hidra Titânica | tanque | cura/defesa/área | +25% cura / reflecte / +1,5% da vida máxima | `motor.js:1286`, `motor.js:1735`, `motor.js:1721` |
| `3068`/`3143`/`8020`/`6673`/`3170`/`3172` | Égide / Randuin / Máscara / Arco-escudo / Marcha / Grevas | vários | multiplicador | campos `armPct`/`vidaPct`/`esquiva`/`adPct` do catálogo | `motor.js:501-523` |

### A.5 O que mudou no código

| # | Mudança | file:linha |
|---|---|---|
| A5 | `ITENS_ESPECIAIS` + `CAMPOS_MULT` + `mapaEspecial()` (memoizado por classe/perfil/tamanho do catálogo) | `automation.js:3111`, `automation.js:3153`, `automation.js:3158` |
| A6 | `especialDe` / `ehEspecialMeu` / `ehEspecialErrado` | `automation.js:3182`-`automation.js:3185` |
| A7 | `isProtected` passa a incluir `ehEspecialMeu` (um especial da MINHA classe nunca se vende) | `automation.js:194` |
| A8 | `valorDe` ganha `multEsp` (1,25 meu / 0,10 classe errada) e o multiplicador de classe passa a cobrir **stats + passiva + sinergia** (A3) | `automation.js:3240` |
| A9 | `planBag` marca `PROTEGER` com o motivo E o file:linha do mapa | `automation.js:325` |
| A10 | `venderBase` protege o especial com o motivo do mapa | `automation.js:1791` |

---

## B. EQUIPAR — a regra que faltava (docs/itens-ideal.md D7/D8/D10/D14/D16)

### B.1 O IDEAL (regras do dono, invioláveis)

1. *"Equipar SEMPRE o melhor item disponivel em cada slot."*
2. *"EPICO e MELHOR que BASICO -> um epico equipavel NUNCA pode ficar na mochila com um basico
   equipado."*

### B.2 O ATUAL antes (o GAP)

| # | Problema | file:linha (antes) |
|---|---|---|
| B1 | `planBag` **nunca lia `readEquip()`** — nenhuma acção `EQUIPAR` existia | bloco de decisão do `planBag` |
| B2 | `valorDe` **sem termo de raridade** → "épico > básico" não existia na decisão | `valorDe` |
| B3 | **Histerese de 5%** recusava a troca do Tiamat (ganho medido 2,62%) | `equiparMelhores` |
| B4 | Desempate por `base` fazia o épico empatar (215,00) e PERDER para a Adaga/Picareta | `cmp` do `equiparMelhores` |
| B5 | Épico componente da build era protegido da venda mas NUNCA equipado (preso na mochila) | `planBag`/`venderBase` |

### B.3 O que está agora

| # | Regra | file:linha |
|---|---|---|
| B6 | `alvoEquip()` — **fonte única** (1 BOTA + 4 livres: `motor.js:29 ESPACOS_ITENS=4`, `motor.js:30` "o tipo só serve para achar a bota"). Pool = mochila + equipados; por base fica a melhor instância (qualidade→refino: `motor.js:252`/`motor.js:2898`) | `automation.js:3324` |
| B7 | `cmpEquip()` — **RESTRIÇÃO DURA**: básico nunca ganha de épico/lendário **utilizável**; dentro do degrau (e entre épico e lendário) manda o `valorDe`; empate determinístico por `base` | `automation.js:3300` |
| B8 | `ehUsavelPeloCampeao()` — a regra dura só vale entre itens que ele PODE usar (senão um Rabadon lendário ganhava de uma Capa básica) | `automation.js:3294` |
| B9 | `valorDe` x `(1 + 0,30·degrau)` — termo de raridade, com a escala do motor (`QUALIDADES.mult` `motor.js:173`, `BONUS_REFINO` `motor.js:55`) | `automation.js:3240` |
| B10 | `mexe` = falta slot **OU** troca de raridade **OU** item especial **OU** ganho >= `cfg.equipHisterese` (1,05). **Trocas de raridade e itens especiais ignoram a histerese** | `automation.js:3324` |
| B11 | Acção `EQUIPAR` no `planBag`, **antes** de qualquer ramo de venda | `automation.js:340` |
| B12 | `equiparMelhores` deixou de ter a sua própria cópia da regra e passou a usar `alvoEquip()` | `automation.js:2433` |
| B13 | `venderBase` nunca vende o que vai ser equipado | `automation.js:1792` |
| B14 | `n.equip` = `planoEquipar().mexe` (necessidade REAL, não `!!cfg.autoEquip`) | `automation.js:2018` |
| B15 | `autoEquip` por omissão **true** (regra inviolável nº 3) | `automation.js:57` |

### B.4 Medições (stub do banco + catálogo REAL + estado medido do Yasuo)

```
EQUIPADO: 3047(epico A) 3044(epico A) 1018(basico A) 3133(epico A)   MOCHILA: 3077 Tiamat(epico C)

A) Tiamat épico vs Capa básica equipada   -> alvo: 3047+3044+3077+3133+1018
                                             entram: [3077]  mexe: true  trocaRaridade: true  ganho: +32,8%
                                             planBag -> EQUIPAR 3077~C   <<<<< a queixa do dono
B) Bota épica 3047 vs bota básica 1001    -> entram: [3047]  saem: [1001]  trocaRaridade: true  ganho: +0,3%
                                             (a histerese de 5% teria RECUSADO: era o D10)
E) 6 candidatos não-bota (com Rabadon AP) -> alvo: 3047+3044+3077+3133+1018  (Rabadon FORA)
H) Eco de Luden (AP) numa mochila AD      -> entra só porque sobrava um slot vazio; nunca desloca
```

### B.6 BÁSICOS QUE SÃO COMPONENTES DA BUILD (P0-1 — a mochila ficou vazia)

**O que estava errado:** a excepção `componentesDaBuild()` só estava nos ÉPICOS. Para os BÁSICOS a
regra do dono ("basico, epico, duplicado -> Lojista") era aplicada SEM excepção, e o campeão ficou
com **ZERO Adagas** e nenhuma receita do Ornn a arrancar. O `basExcesso` (o tecto por receita) já
existia mas era **código morto** — o ramo "básico -> Lojista" vinha antes dele (docs/itens-ideal.md `2.2).

| # | Regra agora | file:linha |
|---|---|---|
| B16 | BÁSICO que NÃO serve a build -> `VENDER_LOJISTA` (regra do dono mantida) | `automation.js:349` |
| B17 | BÁSICO COMPONENTE -> `GUARDAR` até ao tecto da RECEITA (`basicosDaBuild` expande os `de` do motor até às folhas) | `automation.js:351` |
| B18 | ...e só o EXCEDENTE vai ao Lojista | `automation.js:350` |
| B19 | `basExcesso` passou a cortar em **S+** (antes cortava em A, e o excesso de qualidade A de um componente nunca era vendido) | `automation.js:286` |
| B20 | TRANSBORDO: com a mochila acima da capacidade o material básico em excesso passa a `VENDER_LOJISTA` — sem isto uma mochila cheia de componentes protegidos deixava o `n.vender` falso para sempre e o LOOT PARAVA | `automation.js:369` |
| B21 | `venderBase` usa a MESMA regra, com o tecto a descer pelo tamanho do transbordo — reconciliação planeador<->actor | `automation.js:1855` |

**Tectos medidos (Yasuo, build `[3172,3046,6631,3085,3031]`):**
```
basicosDaBuild() = { 1001: 1, 1018: 4, 1028: 1, 1036: 3, 1037: 1, 1038: 1, 1042: 10 }

mochila 1042x15 1018x6 1036x3 1006x2 1029x1  ->
  1042 Adaga      GUARDAR 10  +  VENDER_LOJISTA 5    (tecto 10)
  1018 Capa       GUARDAR  4  +  VENDER_LOJISTA 2    (tecto 4)
  1036 Esp. Longa GUARDAR  3                         (tecto 3, sem excesso)
  1006 Pérola     VENDER_LOJISTA 2                   (não serve a build)
  1029 Couraça    VENDER_LOJISTA 1                   (não serve a build)

venderBase com 1 Adaga + 1 Pérola ->
  vendidos: [1006~A]
  protegidos: [1042~A "básico componente da build (1/10)"]
```

### B.5 O que ficou deliberadamente FORA

* **Lendário < S+ vai ao mercado ou ao Lojista?** — o dono só falou em "básico, épico, duplicado".
  Continua a via antiga (mercado; Lojista só com o mercado saturado). **Pergunta aberta ao dono**
  (já estava escrita no código antes de mim).
* **Rabadon de classe errada** continua `PROTEGER` (a guarda histórica do dono). É protegido da
  venda, mas **não é equipado** se houver alternativa da classe certa (ver E).

---

## C. SKILLS — ordem de desbloqueio e de subida

### C.1 O IDEAL (dono, verbatim)

> *"uma skill desbloqueada faz mais que UM PONTO em uma skill existente."*

O motor concorda: ao chegar a rank 1 a skill **entra sozinha na barra** (`motor.js:2817`) — ganha-se
uma habilidade INTEIRA, não um incremento.

### C.2 O ATUAL antes (o GAP)

| # | Problema | file:linha (antes) |
|---|---|---|
| C1 | Ordenava por `dps` do rank **ACTUAL** — uma skill rank 0 tem DPS baixo e nunca era escolhida | `subirHabilidades` |
| C3 | `gastos++` contava **cliques**, não ranks ganhos: com o rank no tecto do nível (`motor.js:905 rankMaximoNoNivel`) repetia o mesmo clique até 400 e dizia `gastos:400` | `subirHabilidades` |
| C4 | **BUG DE ESCALA**: `ratio` era multiplicado por `ap` — que num campeão AD é ZERO. Todo o escalamento do Yasuo era multiplicado por zero (~10x abaixo do real). O motor diz qual é a escala: `motor.js:923` (`h.escalaPoder ? 'do Poder de Habilidade' : 'do dano'`), e `escalaPoder` só é posto nos magos (`motor.js:670`, `motor.js:772`, `motor.js:815`, `motor.js:857`) | `dpsPorHabilidade` |

### C.3 O que está agora

| # | Regra | file:linha |
|---|---|---|
| C5 | `dpsPorHabilidade(ranksOverride)` + `ctxDano()` + `dpsRank(ctx,t,r)` — DPS de QUALQUER rank, com a escala correcta (`magia ? ap : ad`) | `automation.js:1077`, `automation.js:1122`, `automation.js:1134` |
| C6 | `valorBuff()` — valor de um rank que não é dano directo, com derivação: penetração de armadura por N s vale `pen x (N/recarga) x meuDps`; velocidade de ataque vale `(va / 0,697) x (N/recarga) x meuDps` — **0,697 é a constante do motor** (`motor.js:2056 recargaQYasuo`) | `automation.js:1173` |
| C7 | `buffDoTexto()` — quando o `serialKit` do `inject.js` não reencaminha o campo, lê-se o NÚMERO do texto do jogo (`jogo.js:5833 descricaoHab`), a mesma técnica que `valorPassiva` já usava nos itens | `automation.js:1154` |
| C8 | `valorDoPonto()` = `[dps(r+1)−dps(r)] + [buff(r+1)−buff(r)]`, com `MULT_DESBLOQUEIO = 1,5` quando `r === 0` | `automation.js:1195`, `automation.js:37` |
| C9 | Ordem: **1)** rank 0 primeiro (desbloquear); **2)** maior ganho marginal; **3)** maior rank; **4)** ordem do motor (`motor.js:899 ORDEM_HAB`) | `automation.js:1619` |
| C10 | Anti-loop: cada clique é conferido contra a SOMA DE RANKS lida do DOM; a skill que não sobe fica bloqueada nessa passagem | `automation.js:1619` |

### C.4 A ordem concreta do Yasuo (números do motor)

Kit em `motor.js:696-728`. Com o AD medido (209):

| skill | base | ratio | recarga | rank actual | ganho marginal |
|---|---|---|---|---|---|
| Q Tempestade de Aço | `serie(40,20)` `motor.js:698` | 0,55 | `serie(4,−0,15)` | 7 | `(180+0,55x209)/2,95 − (160+0,55x209)/3,10 = +11,3` |
| E Espada Ágil | `serie(50,18)` `motor.js:703` | `serie(0,2,0,01)` | `serie(3,5,−0,15)` | 4 | `+9,5` |
| W Parede de Vento | — `motor.js:701` | — | `serie(24,−0,8)` | 2 | 0 (sem dano) |
| R Último Suspiro | `serie(200,110,5)` `motor.js:706` | `serie(1,0,08,5)` | `[70,60,50,42,35]` | 1 (fora da barra) | `310/60 − 200/70 = +2,3` + buff |
| G Respiração do Vento | — `motor.js:709` | — | `serie(25,−1)` | 0 | **desbloqueio** `+43` (buff de vel. de ataque) |
| A Investida do Vendaval | `serie(60,30)` `motor.js:711` | `serie(0,8,0,05)` | `serie(12,−0,5)` | 0 | **desbloqueio** `+28` |

**Ordem final:** desbloquear **G → R → A** (rank 0 vale x1,5), depois subir **Q → E → R → W**.
O R só pode ir a rank 2 no nível 14 (`motor.js:902 nivelMinimoR = [6,11,16,25,35]`, `motor.js:908`).

---

## D. BARRA — as 4 melhores, INCLUINDO a ultimate

### D.1 O IDEAL (dono, verbatim)

> *"A barra tem de estar cheia com as melhores, INCLUINDO a ultimate."*
> *"Gastar TODOS os pontos: skill points (com a ULTIMATE na barra)."*

### D.2 O ATUAL antes (o GAP) — P0 medido ao vivo pelo Lead

| # | Problema | file:linha (antes) |
|---|---|---|
| D1 | `rotacaoSkills` ordenava por `pronto` (recarga) — as recargas mudam SEMPRE, logo o alvo mudava a cada 2 s e a barra **oscilava** | `rotacaoSkills` |
| D2 | `usarUlt = fase === 'chefe' || chefeInvencivel` — fora de chefe o **R era filtrado** do alvo e o `aplicarBarra` tirava-o | `rotacaoSkills` |
| D3 | `trocarSkills` clicava na barra para tirar a skill em cooldown — e a ultimate, com recarga longa, está quase sempre em cooldown | `trocarSkills` |
| D4 | `aplicarBarra` fazia **tirar-depois-pôr** sem re-ler o DOM nem confirmar; sem tratar a armadilha do estado cheio | `aplicarBarra` |

**Mecânica REAL do jogo** (lida, não adivinhada):
`#barra` tem SEMPRE 4 filhos (`jogo.js:6124-6129`): `div class="hab" data-t="X"` ou `div class="vaga"`.
`#habilidades` (delegado, `jogo.js:5848`) → `alternarBarra` (`motor.js:2834`) = **TOGGLE**; com a barra
do ESTADO cheia devolve `false` e o jogo entra em modo TROCA (`trocando`, `jogo.js:5857`), marcado com
`.escolhida` (`jogo.js:6604`). O clique SEGUINTE num `#barra .hab` chama `trocarNaBarra`
(`motor.js:2841`) e troca ATÓMICO (`jogo.js:5862-5868`).

### D.3 O que está agora

| # | Regra | file:linha |
|---|---|---|
| D5 | `barraIdeal()` — **determinística**: 1) a ULTIMATE primeiro (fixa); 2) as restantes por DPS do rank actual; 3) empate por rank e pela ordem do motor. **NÃO olha para a recarga** | `automation.js:4167` |
| D6 | `lerBarra()` — lê `#barra .hab[data-t]` e conta as vagas por diferença (4 − nº de `.hab`), sem selectores novos | `automation.js:4148` |
| D7 | `mesmaBarra()` compara por CONJUNTO: se o alvo já lá está, **não se clica em nada** (fim da oscilação) | `automation.js:4154` |
| D8 | `aplicarBarra()` — converge em <=3 passagens: **cancela `trocando`** no topo, **TIRA primeiro** (liberta o ESTADO), depois PÔE; confirma o conjunto final e loga `barra:nao-converge` se falhar | `automation.js:4195` |
| D9 | `skillsDisponiveis` e `trocarSkills` excluem a ULTIMATE (`ehUltimateFixa`) — nunca sai da barra | `automation.js:4089`, `automation.js:4098` |
| D10 | Nunca fica um espaço vazio se houver skill desbloqueada fora da barra: o alvo é `min(4, desbloqueadas)` e a rotação re-aplica | `automation.js:4167`, `automation.js:4240` |

**Medido** (arsenal Q7 W2 E4 R1 fora + G0 A0; barra do HUD Q,E,W):
`barraIdeal() = ["R","Q","E","W"]` — a ultimate entra e mantém-se.
O Lead confirmou ao vivo: `barraDOM: ["Q","E","W","R"]`, `R_onBar: true`, após reload.

---

## E. ATRIBUTOS — modelo por campeão

### E.1 O IDEAL

Regra do dono: *"Gastar TODOS os pontos: skill points ... e attribute points."* Para o Yasuo:
*"Yasuo AD: Força primeiro."*

### E.2 O ATUAL antes (o GAP)

| # | Problema | file:linha (antes) |
|---|---|---|
| E1 | `chave = modelo || cfg.modeloAtrib || 'equilibrado'` — o modelo `'equilibrado'` tem `forca:2` e `vitalidade:2` (peso IGUAL): não é "Força primeiro" | `distribuirAtributos` |
| E2 | `autoAtrib` por omissão **false** → os pontos ficavam parados (o dono já viu 15 pontos presos) | `DEFAULT.autoAtrib` |
| E3 | O laço clicava até 600 vezes SEM confirmar que o valor mudou | `distribuirAtributos` |

### E.3 O que está agora

| # | Regra | file:linha |
|---|---|---|
| E4 | `modeloAtribDe()` — derivado de `DICA_ATRIBUTOS` (`motor.js:474-482`) x classe x perfil: tanque→`'tanque'` (`motor.js:485`), magia→`'conjurador'` (`motor.js:488`), resto→`'dano'` (`motor.js:487`) | `automation.js:2265` |
| E5 | Yasuo (`dano`, sem mana) → `'dano'` = `{forca:3, agilidade:2, vitalidade:1}` → **Força primeiro**. A dica do motor diz o mesmo (`motor.js:481`): "Força e Agilidade dão dano e velocidade de ataque (que também acelera a Tempestade de Aço)" | `automation.js:2265` |
| E6 | `autoAtrib` por omissão **true**; `n.atrib` só quando o HUD diz que há pontos DE ATRIBUTO (`readSkills().pontosAtrib > 0`) | `automation.js:55`, `automation.js:2017` |
| E7 | Fórmula do motor mantida (`motor.js:2853-2865`, incluindo o `+1` da soma em `motor.js:2859`) + anti-loop por soma de valores lida do DOM | `automation.js:2278` |

**Estado medido:** Força=22, Vitalidade=7, Resistência=4, Agilidade=3, Foco=3 (39 pontos = 3x13 do
nível 14, `motor.js:483 PONTOS_POR_NIVEL = 3`). O modelo antigo explica exactamente esta distribuição;
o novo (Força 3 : Agi 2 : Vit 1) concentra em Força.

---

## F. FARM — região e objectivo

### F.1 O IDEAL (dono, verbatim)

> *"Nivel/regiao: nao ficar em regiao abaixo do nivel; usar a que maximiza ouro+xp/min."*

### F.2 O ATUAL antes (o GAP)

| # | Problema | file:linha (antes) |
|---|---|---|
| F1 | Objectivo por omissão `'xp'` — um eixo só, e o dono pediu **ouro + xp** | `DEFAULT.objetivo` |
| F2 | Não havia trava de "região abaixo do nível": só `l.nm[0] <= nivel+6` (um LIMITE SUPERIOR, para não ir para monstros altos) | `regiaoIdeal` |
| F3 | `rankRegioes` tinha o seu próprio critério, separado do `regiaoIdeal` | `rankRegioes` |

### F.3 O que está agora

| # | Regra | file:linha |
|---|---|---|
| F4 | `'ouro+xp'` é o DEFAULT; qualquer valor desconhecido cai nele (a GUI ainda só oferece xp/ouro/runas — fora do meu scope) | `automation.js:4410` |
| F5 | **A taxa de troca vem do MOTOR**: `CURVA.xp(n) = (30+7n)·ajuste.xp` e `CURVA.ouro(n) = (8+3,5n)·ajuste.ouro` (`motor.js:277-278`) → `xp(n)/ouro(n)` é quanto 1 de ouro vale em xp àquele nível. `score = xp/min + ouro/min x taxa`. No nível 15 ≈ **2,2 xp por 1 de ouro** | `automation.js:4417`, `automation.js:4421` |
| F6 | **TRAVA de região abaixo do nível**: `abaixoDoNivel(l, p) = p.nivel > l.faixa[1]`; excluída como PREFERÊNCIA (se todas estiverem abaixo, usa-se o conjunto inteiro). Coerente com `fatorXp` (`motor.js:421`: monstro >5 níveis abaixo rende −10%/nível, mínimo 10%) | `automation.js:4434`, `automation.js:4439` |
| F7 | O MEDIDO continua a mandar quando há amostra (n>=3) — não se mistura medido com teoria | `automation.js:4439` |
| F8 | `rankRegioes` usa a MESMA `scoreRegiao` e devolve `score`, `mobLevel` e `abaixoDoNivel` | `automation.js:4484` |

**Medido** (Yasuo nível 15, Rota Superior, `estimarRegiao` com a tabela real de `LOCAIS`):
`xpMin 11 014 · goldMin 3 139 · mobLevel 13` → `custoIdaBase = {ouro: 2 269, seg: 17, porSeg: 133}`.

---

## G. ROTINA DE BASE — quando é que se considera COMPLETA

### G.1 O IDEAL (dono, verbatim — P0)

> *"a porra da base ainda nao RESPEITA as tarefas q tem q acontecer na base, e o boneco ja sai dela
> pra farmar. e ele ainda volta segundos depois pra fazer mais coisa."*

### G.2 O ATUAL antes (o GAP) — as 3 causas lidas no código

| # | Causa | file:linha (antes) |
|---|---|---|
| G1 | `necessidadesBase()` calculada **UMA vez**, no início: uma necessidade que APARECIA durante a rotina nunca era tratada nessa passagem | `acaoBase` |
| G2 | `res = { ok: true, ... }` — `ok` nascia `true` e **NUNCA** era posto a `false`, mesmo com passos falhados/timeout | `acaoBase` |
| G3 | O `finally` do `supervisarBase` viajava com `res.ok` **sem re-verificar** as necessidades | `supervisarBase` |
| G4 | `n.equip`, `n.atrib`, `n.refino` eram `!!cfg.autoEquip` / `!!cfg.autoAtrib` / `!!cfg.autoRefino` — **`true` ETERNO**, nunca satisfeitos | `necessidadesBase` |
| G5 | Throttles de 20 s (`_ultimaVenda`, `_ultimaBase`) permitiam voltar à base 20 s depois | `supervisarBase` |

### G.3 O que está agora

| # | Regra | file:linha |
|---|---|---|
| G6 | `acaoBase` **REPETE** até `BASE_MAX_PASSAGENS = 3`, re-avaliando `necessidadesBase()` a cada passagem | `automation.js:2082` |
| G7 | Cada passo regista `erro`/`timeout` e entra em `res.falhas` (`passoFalhou`) | `automation.js:1911`, `automation.js:2082` |
| G8 | `res.ok = (res.restou.length === 0) && (res.falhas.length === 0)` — decidido por **RE-LEITURA FINAL**, não por optimismo. `res.restou` diz exactamente o que faltou; `res.fechou` diz quantas fecharam | `automation.js:2082` |
| G9 | `PASSOS_BASE` é a **única** definição da ordem; `faltandoNaBase` é a **única** resposta a "a base está completa?" | `automation.js:2030`, `automation.js:2057` |
| G10 | Necessidades reais: `n.equip = planoEquipar().mexe`, `n.atrib = pontosAtrib > 0`, `n.refino = throttle + precisaRefino()` | `automation.js:2018`, `automation.js:2017`, `automation.js:1920` |
| G11 | `supervisarBase` RE-VERIFICA `faltandoNaBase()` antes de `viajarPara`; se ainda faltar, **NÃO viaja** e liberta o throttle (`_ultimaBase = 0`) para a base rodar já | `automation.js:4533` |
| G12 | O `motivo` do supervisor passou a ser a MESMA lista de necessidades (fim do critério paralelo) | `automation.js:4533` |
| G13 | `diagnosticoBase()` usa a mesma fonte e mostra `venda`, `custoIda`, `pocoes` e `indisponivel` | `automation.js:4678` |

### G.4 BACKOFF — uma necessidade que FALHA deixa de ser pedida

| # | Regra | file:linha |
|---|---|---|
| G14 | `INDISPONIVEL_MS = 45 min`: o que o `acaoBase` não conseguiu fechar fica SILENCIOSO (`marcarIndisponivel`), com log `indisponivel:'repor'`. O que FECHOU volta a ser pedível | `automation.js:1899`, `automation.js:2082` |
| G15 | O motivo vai para o LOG — o dono vê *"não consigo comprar X"* em vez de ping-pong silencioso | `automation.js:1899` |

---

## H. O CICLO DE RECALL (P0 medido ao vivo)

### H.1 O sintoma (log do dono, verbatim)

```
13:03 Viajando para Rota Superior... -> Você viajou para Rota Superior (nível ideal 5-15).
13:03 Voltando para a base... (4 segundos) -> Você voltou para a Fonte.
13:08 ... Você vendeu 1 itens por 21 de ouro.
13:10 Viajando... -> Voltando
```
**Ouro congelado em 52 300.** Ele viaja, mata ~1 mob, apanha 1 item, volta, vende 1 item, repete.

### H.2 As causas (confirmadas no código)

| # | Causa | Antes | Agora |
|---|---|---|---|
| H1 | `necessidadesBase().repor` usava `minimoPocoes()`, que inclui a **Poção Suprema** — e a loja só a vende no **nível 30** (`motor.js:264`). Com `vidaS: 0` e mínimo 8, ficava `true` **para sempre** | `necessidadesBase` | mede contra `minimoPocoesAgora()` → `automation.js:383`, `automation.js:1966` |
| H2 | `reporPocoes` devolvia `ok:true` mesmo sem comprar nada (o botão da Suprema vem `disabled`) | `reporPocoes` | devolve `ok:false` + `faltou` + `semBotao` + `motivo` → `automation.js:1837` |
| H3 | `n.vender` era verdadeiro por **UM** item vendável; o throttle de 20 s dava exactamente a cadência observada | `necessidadesBase` | vender só com a mochila **quase cheia** (`cap − 2`) OU valor >= 2x o custo da viagem → `automation.js:1966` |
| H4 | Cada `press('b')` do `checarPocoes`/supervisor fechava o ciclo | `checarPocoes` | guarda de modo farm + mínimo que conta → `automation.js:4498` |
| H5 | `n.comprar`/`n.montar`/`n.refino`/`n.mercado` são OPORTUNIDADES e forçavam uma viagem sozinhas | `necessidadesBase` | só se aproveitam se ele JÁ tiver de ir à base por uma necessidade PRIMÁRIA → `automation.js:1955`, `automation.js:1966` |
| **H12** | **A CAUSA QUE RESTAVA**: `n.presente` era `!!q1(.presente-pegar) || !!q1(#rastreio-login)` — o `#rastreio-login` está **SEMPRE no DOM** (é um rastreador do HUD) e o jogo só o ESCONDE quando não há nada a pegar (`jogo.js:6257`: `bl.hidden = !pl || pl.pegouHoje`). O `q1()` devolve o elemento **mesmo escondido** → `n.presente` era um **`true` ETERNO**, e `presente` é uma necessidade PRIMÁRIA: o `falta` nunca fechava e ele voltava à base a cada 20 s — e era NESSA ida que o `venderBase` da rotina vendia 1 item de 21 de ouro | `necessidadesBase` | exige **VISIBILIDADE** (`hidden !== true` e `getBoundingClientRect().width > 0`) → `automation.js:2044`; `pegarPresentes` também deixou de clicar no rastreador escondido → `automation.js:1672` |
| **H13** | `n.tarefa` era `!!st.pronta || !st.tem` — o `!st.tem` (sem tarefa) era um **`true` ETERNO**: o `_ultimaTarefa` de 5 min só travava o LOG do `supervisarBase`, não a necessidade | `necessidadesBase` | a necessidade tem o MESMO throttle de 5 min → `automation.js:2052` |

### H.3 A REGRA DE OURO — a viagem tem de se pagar

| # | Regra | file:linha |
|---|---|---|
| H6 | `custoIdaBase()` = (recall do motor + ~8 s da volta) x (score da região ÷ taxa do motor ÷ 60), em **ouro-equivalente**. Medido: **2 269 de ouro / 17 s** (133/s) | `automation.js:1938` |
| H7 | `NECESSIDADES_PRIMARIAS` = as que sozinhas pagam a viagem; as outras desligam-se se não houver nenhuma | `automation.js:1955` |
| H8 | `n.repor` dispara a **metade** do mínimo (banda de histerese), não por margem | `automation.js:1966` |
| H9 | `cfg.venderFolga` (default 2) controla "mochila quase cheia" | `automation.js:56` |
| H10 | **TECTO DE RECALLS**: 3 visitas seguidas com `res.fechou <= 0` → `_farmForcadoAte` = agora + 10 min, log `farmar FORCADO (3 visitas sem fechar nada — modo farm)`; durante esse período nem o supervisor nem o `checarPocoes` recordam | `automation.js:4530`, `automation.js:4533` |
| H11 | **MOTIVO COM VALOR** no log: `ir: base: vender` + `venda:{itens,valor}` + `custoIda:{ouro,seg}` + `falta:[...]` | `automation.js:4533` |
| H12 | Uma necessidade só conta se o ELEMENTO QUE A REPRESENTA estiver VISÍVEL — o `q1()` devolve elementos escondidos, e um rastreador permanente do HUD (ou uma tarefa inexistente) transformava a necessidade num `true` eterno | `automation.js:2044`, `automation.js:2052` |

### H.4 Medições (estado medido: nível 15, 52 300 de ouro, cap 26, item de 350)

```
custo da ida à base: { ouro: 2269, seg: 17, porSeg: 133 }

mochila  1/26 -> n.vender = false   (itens=1  valor=175)     <<<<< o ciclo que o dono viu
mochila  5/26 -> n.vender = false   (itens=5  valor=875)
mochila 20/26 -> n.vender = false   (itens=20 valor=3500)    (3500 < 2x2269)
mochila 23/26 -> n.vender = false
mochila 24/26 -> n.vender = true    (quase cheia: cap-2)     <<<<< agora só aqui
mochila 26/26 -> n.vender = true

stock {vida:1052, vidaF:570, vidaS:0} -> n.repor = false     <<<<< era true para sempre
stock {vida:40,   vidaF:20,  vidaS:0} -> n.repor = false
stock {vida:24,   vidaF:12,  vidaS:0} -> n.repor = true      (metade de 50/25)
stock {vida:10,   vidaF:0,   vidaS:0} -> n.repor = true
com backoff ligado                    -> n.repor = false
```

---

## I. `indecidivel-sem-jogo` — o que NÃO consegui decidir no papel

| # | Questão | Porque não decidi | O TESTE que decide |
|---|---|---|---|
| I1 | **Peso relativo de ouro vs xp** no objectivo combinado | Usei a taxa do PRÓPRIO motor (`CURVA.xp/CURVA.ouro`, `motor.js:277-278`), que é o que o motor considera equivalente. Se o dono preferir mais ouro, é um número de gosto, não de motor | Correr 30 min em duas regiões com `objetivo:'ouro+xp'` e comparar o ouro/h real com `objetivo:'ouro'`; se o combinado render menos ouro, subir o peso do ouro |
| I2 | **`penSuspiro`/`duracaoPen`/`va`/`bonus` do kit** | O `serialKit` (`inject.js:107-123`) NÃO reencaminha estes campos, e o `inject.js` está fora do meu scope. Uso o TEXTO da habilidade como fallback (`buffDoTexto`) | Acrescentar `'penSuspiro','duracaoPen','va','bonus','bonusHab'` à lista do `serialKit` e comparar `valorBuff` campo-a-campo com o valor lido do texto |
| I3 | **Ordem exacta G vs R no desbloqueio** | Depende de `dpsTotal` (o `meuDps()` medido). Sem histórico, uso o piso `dano x vel. ataque`. Os dois ficam desbloqueados de qualquer forma | Medir o DPS real (`meuDps()` com n>=3) e re-correr `valorDoPonto`; se o G deixar de compensar, a ordem inverte sozinha |
| I4 | **Lendário < S+: mercado ou Lojista?** | O dono só falou em "básico, épico, duplicado". Já era pergunta aberta antes de mim | Perguntar ao dono |
| I5 | **`n.cura` nunca é verdadeiro** | `player().vida` lê o valor MÁXIMO do HUD (`hp[2]`), e compara-o com `pl.vidaMax` que não existe → 0. Não é do meu scope (é leitura de estado), mas fica registado | Montar o HUD com vida parcial e verificar `player().vida`; corrigir `player()` para ler `hp[1]` (actual) |
| I6 | **Histerese de equipamento em regime** | O Lead baixou `equipHisterese` para 0,005 AO VIVO (pela API) para forçar a troca. O ficheiro mantém 1,05. Com o equipamento já no alvo, `alvoEquip().mexe` é false de qualquer forma | Repor 1,05 e confirmar que `equiparMelhores()` devolve `trocas:[]` com o equipamento medido |

---

## J. Verificação

```
$ node --check extension/automation.js
rc=0

$ node tools/testes/run.mjs
FONTE extension/automation.js  bytes=324983  sha256=d510610c053b756c055e64ae841e28b807cfacc3408844397902558086f3eb0a
POPULATION 134  (assercoes das suites=132 + 2 checagens de integridade do harness)
SUITE regras ... checks=90 falhas=0  UNSTUBBED=0  errosAsync=0
SUITE ator   ... checks=44 falhas=0  UNSTUBBED=0  errosAsync=0
UNSTUBBED 0
rc=0
```

**Contrato respeitado:** nenhum selector novo (o banco só conhece um vocabulário fixo — qualquer
`querySelector` fora dele vira `UNSTUBBED` = FALHA). Todos os seletores usados por `planBag`,
`alvoEquip`, `planoEquipar`, `venderBase` e `lerBarra` já estavam no vocabulário.

**Fora do scope (não tocado):** `tools/`, `tools/testes/`, `TODO.md`, `HANDOFF.md`, `extension/inject.js`,
`extension/gui.js`, `docs/game-src/*`. O select de objectivo da GUI (`gui.js:512`) ainda só oferece
`xp/ouro/runas` — o default `'ouro+xp'` funciona na mesma porque `objDe` aceita-o e a GUI não o
sobrescreve enquanto o utilizador não mexer no select.
