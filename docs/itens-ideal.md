# Itens — regra ideal (dono) × o que o código faz

> **Revisão pinada:** `extension/automation.js` @ sha256 `960d9f7ebcc63813…` · 257619 bytes · 4009 linhas · mtime 2026-10-14T15:22:48.870Z.
> **Estado medido:** nível 14 · 64 300 de ouro · `Campo Azul nível 15–25` · Yasuo.
> **Método:** leitura estática de `extension/automation.js` + `docs/game-src/motor.js` + `docs/game-src/itens.js`, com os números reconstruídos por re-implementação das funções citadas. **Nenhum contacto com browser/jogo/CDP.**
> **Aviso de concorrência:** o ficheiro esteve a ser editado durante esta auditoria (observei 3950 → 3958 → 3986 → 3999 → 4009 linhas). Todas as citações abaixo foram resolvidas **por conteúdo** no momento da escrita, sobre a revisão acima; se o ficheiro mudar, reconferir com o grep de §6.

---

## 0. Sumário executivo

1. **A regra de VENDER está hoje implementada** (nesta revisão): básico → Lojista (`automation.js:302`), épico < S+ → Lojista (`automation.js:306`), duplicado → Lojista (`automation.js:307`), componente da build → guardar (`automation.js:308`), S+ → cofre/proteger (`automation.js:275`, `automation.js:272`), lendário < A → mercado (`automation.js:311`).
2. **A regra de EQUIPAR não está.** `planBag` continua a **não ler** `readEquip()` — não existe acção `EQUIPAR` em nenhum ramo (`automation.js:269`–`automation.js:313`). O equipador (`automation.js:2017`) decide só por `valorDe` (`automation.js:2747`), que **não tem termo de raridade** (`automation.js:2760`).
3. **O bónus de incumbência (+60) foi removido** durante esta auditoria (`automation.js:2722`–`automation.js:2737`): a bota épica `3047` passa a ganhar à básica `1001` (**2,25** vs **0,94**). Mas a troca continua bloqueada pela **histerese de 5%** (`automation.js:2049`) no caso medido — ganho **2.62%**.
4. **O Tiamat continua a nunca ser equipado**, por duas razões independentes: (a) com a mochila medida, entra no alvo mas o ganho (2.62%) fica abaixo dos 5%; (b) se a mochila tiver os básicos que a build pede (`1042`/`1037`), ele empata em **215,00** com eles e **perde no desempate por `base`** (`automation.js:2034`) — o alvo passa a ser `1018 + 1038 + 1037 + 1042`, todos básicos.

---

## 1. Regra ideal formalizada

### 1.1 Definições

| Termo | Definição | Fonte |
|---|---|---|
| raridade | basico / epico / lendario | `automation.js:22` (`RARITY`) |
| tier | qualidade C, B, A, S, SS + refino | `automation.js:23`, `automation.js:203` |
| "tier S ou acima" | S e SS (o dono escreveu "tier s mais") | regra do dono |
| duplicado | 2+ itens com o mesmo `base` | convenção do código (`automation.js:238`) |
| **slot** | **1 espaço de BOTA + 4 espaços livres**; o campo `espaco` é rótulo ("só serve para achar a bota") | `motor.js:29`, `motor.js:30` |
| equipável | pode ocupar slot vago ou deslocar o que lá está | `motor.js:2878`, `motor.js:2890` |

### 1.2 Tabela raridade × tier → acção

| raridade | tier C / B | tier A | tier S / SS |
|---|---|---|---|
| **básico** | VENDER no Lojista | VENDER no Lojista | **NUNCA VENDER** |
| **épico** | VENDER no Lojista *(mas ver §1.3)* | VENDER no Lojista *(mas ver §1.3)* | **NUNCA VENDER** |
| **duplicado** | VENDER no Lojista (fica 1 — o de maior tier) | VENDER no Lojista (fica 1) | **NUNCA VENDER** |
| **lendário** | fora da regra do dono — pergunta aberta (D13) | idem | **NUNCA VENDER** |

### 1.3 Precedência — a cláusula que falta

*"um épico equipável NUNCA pode ficar na mochila com um básico equipado no mesmo slot"* é uma **restrição dura**, não um peso a somar. Ordem correcta:

~~~
1. tier S/SS?                                  -> NUNCA VENDER
2. ÉPICO equipável + BÁSICO equipado no slot?  -> EQUIPAR (o básico volta à mochila)
3. duplicado?                                  -> VENDER (fica 1, o de maior tier)
4. básico ou épico que sobra?                  -> VENDER no Lojista
~~~

### 1.4 Lacunas da regra (inferido — precisa de validação do dono)

| # | Lacuna | Inferência usada aqui |
|---|---|---|
| I1 | "mesmo slot" | 1 bota + 4 livres (`motor.js:29–30`) |
| I2 | épico de tier baixo vs básico de tier alto | raridade primeiro (a regra é categórica), tier depois |
| I3 | lendário < S+ | fora da regra — o próprio código registou a pergunta (`automation.js:311`) |
| I4 | definição de duplicado | mesmo `base` |
| I5 | épicos que sobram para os 5 slots | cláusula 3/4 |

---

## 2. O que o código faz hoje

### 2.1 Predicados e helpers

| Predicado | O que faz | file:linha |
|---|---|---|
| `QUAL` / `qIdx` | escala de qualidade; `-1` = qualidade desconhecida | `automation.js:23`, `automation.js:24` |
| `tierDe` | `qIdx(qual)*10 + refino` | `automation.js:203` |
| `acimaDeA` | `qIdx >= qIdx('A')` — **ainda é o corte usado para LENDÁRIO** | `automation.js:201` |
| `isTrash` | **épico E tier < A** | `automation.js:197` |
| `basicosDaBuild` | expande as receitas até às folhas (`de` vazio) | `automation.js:206`, `automation.js:213` |
| `componentesDaBuild` | fecha transitivo dos `de` da `buildIdeal()`, profundidade ≤ 4 | `automation.js:1537`, `automation.js:1546` |

### 2.2 `planBag` — o PLANEADOR (bloco de decisão `automation.js:269`–`automation.js:313`)

| # | Regra | file:linha |
|---|---|---|
| P1 | lendário da build da classe → PROTEGER | `automation.js:270` |
| P2 | qualidade `?` → PROTEGER | `automation.js:271` |
| P3 | lendário A+ → PROTEGER (corte A, ver D4) | `automation.js:272` |
| P4 | **épico S+ → GUARDAR_COFRE** (corte S) | `automation.js:275` |
| P5 | **básico → VENDER_LOJISTA** (regra do dono) | `automation.js:302` |
| P6 | épico tier < A → VENDER_LOJISTA, **excepto componente da build** | `automation.js:306` |
| P7 | duplicado → VENDER_LOJISTA | `automation.js:307` |
| P8 | **épico componente da build → GUARDAR** | `automation.js:308` |
| P9 | lendário tier < A → mercado/saturado | `automation.js:311` |
| P10 | fallback → GUARDAR "sem regra" | `automation.js:312` |

Dedupe por base (só dentro da mesma raridade): épicos em `automation.js:238` e seguintes; o tecto de básicos por receita (`teto = necBas[base]`, `automation.js:260`) **ficou código morto** — o ramo P5 vende todos os básicos antes de o ler.

### 2.3 `venderBase` — o ATOR

| # | Guarda | file:linha |
|---|---|---|
| V1 | **tier S+ → não mexe** (corte S, alinhado com P4) | `automation.js:1588` |
| V2 | épico componente da build → protegido | `automation.js:1604` |
| V3 | lendário < A só com mercado saturado | `automation.js:1558` (bloco) |
| V4 | clica n vezes (todas as cópias sub-S+) | `automation.js:1607` |

### 2.4 Quem decide EQUIPAR

| Função | Decide | Critério | file:linha |
|---|---|---|---|
| `equiparMelhores` | conjunto = 1 bota + 4 | maior `valorDe`; empate → `base` menor | `automation.js:2017`, `automation.js:2034`, `automation.js:2036`, `automation.js:2039` |
| `equiparMelhores` | instância do mesmo base | `tierDe` | `automation.js:2017` (bloco `porBase`) |
| `equiparMelhores` | quando mexer | histerese 5% | `automation.js:2049` |
| `melhorSlot` | melhor instância de um base | qualidade → refino | `automation.js:1965` |
| `aplicarItens` | conjunto de bases | tira/põe + melhor instância | `automation.js:1991` |
| `melhorSet` / `checarItens` | conjunto por contexto | `scoreSet`; exige `cfg.trocaItens` | `automation.js:3382`, `automation.js:3427` |

**Nenhuma lê raridade.** A raridade existe só em `poderItem` (`automation.js:2771`), que é exibição (`automation.js:3084`), e em `buildIdealPara` (`automation.js:3046`), que monta a receita.

### 2.5 Portões de execução

| Portão | file:linha |
|---|---|
| `cfg.enabled = false` por omissão | `automation.js:28` |
| `cfg.autoEquip = false` por omissão | `automation.js:51` |
| `cfg.trocaItens = false` por omissão | `automation.js:35` |
| `loop()` → `checarEquipMelhor` só se `autoEquip !== false` | `automation.js:1510` (loop em `automation.js:1491`) |
| `checarEquipMelhor` exige `cfg.enabled` e `autoEquip !== false` | `automation.js:2085` (função em `automation.js:2084`) |
| `n.equip = !!cfg.autoEquip` | `automation.js:1681` |
| passo `equip` na base | `automation.js:1732` |
| passo `venda` / `cofre` | `automation.js:1723`, `automation.js:1733` |

---

## 3. Tabela de divergências (estado nesta revisão)

| # | Regra do dono | Código (file:linha) | Estado |
|---|---|---|---|
| **D1** | básico → vender | ramo próprio P5, motivo "regra do dono: básico → Lojista" | ✅ **corrigida** `automation.js:302` |
| **D2** | épico → vender | P6 vende épico < A; P8 guarda o componente da build | ⚠️ **aberta** `automation.js:306`, `automation.js:308` — a excepção "componente da build" não está na regra do dono (a excepção dele é S+) |
| **D3** | duplicado → vender | P7 | ✅ implementada `automation.js:307` |
| **D4** | excepção = tier **S+** | planBag/actor cortam em S (`automation.js:275`, `automation.js:1588`), mas **lendário A+** ainda usa `acimaDeA` | ⚠️ **aberta só para lendário** `automation.js:201`, `automation.js:272` |
| **D5** | duplicado por base, qualquer raridade | dedupe só dentro da mesma raridade | ⚠️ aberta, sem efeito prático (P5/P6 apanham ambos) `automation.js:238` |
| **D6** | "fica 1" | o ator clica todas as cópias sub-S+ | ⚠️ aberta `automation.js:1607` |
| **D7** | **regra 4:** épico equipável × básico equipado | **não implementada** — `planBag` não lê `readEquip()`; não existe acção `EQUIPAR` | ❌ **aberta** `automation.js:269`–`automation.js:313` |
| **D8** | "épico é melhor que básico" | `valorDe` não tem termo de raridade | ❌ **aberta** `automation.js:2760` |
| **D9** | — | bónus +60 de incumbência | ✅ **corrigida durante esta auditoria** `automation.js:2722`–`automation.js:2737` |
| **D10** | — | histerese 5% bloqueia trocas legítimas | ❌ **aberta** `automation.js:2049` (ganho medido 2.62%) |
| **D11** | épico equipável substitui o básico | épico S+ → cofre (já não A) | ✅ **corrigida** `automation.js:275` |
| **D12** | — | nada corre com os defaults | ❌ **aberta** `automation.js:28`, `automation.js:51`, `automation.js:2085` |
| **D13** | (silêncio) lendário < S+ | mercado/saturado, com pergunta aberta escrita no código | ⚠️ **decisão do dono** `automation.js:311` |
| **D14** | épico > básico | desempate por `base`: `1042`/`1037` (básicos) empatam em 215,00 com o Tiamat e ganham | ❌ **aberta** `automation.js:2034` |
| **D15** | (documentação) | comentário cita `motor.js:2874`; o valor real é `motor.js:29` | ⚠️ aberta `automation.js:2035` |
| **D16** | épico componente da build | é protegido da venda (P8/V2) mas **nunca equipado** | ❌ **aberta** `automation.js:308`, `automation.js:1604` |

---

## 4. O caso Tiamat + botas (números desta revisão)

### 4.1 `valorDe` no estado medido (contexto = equipados actuais)

| base | item | raridade | valorDe |
|---|---|---|---|
| `1001` | Botas | basico | **0.94** |
| `3044` | Fago | epico | **207.00** |
| `1018` | Capa da Agilidade | basico | **240.00** |
| `3133` | Martelo de Guerra de Caulfield | epico | **208.00** |
| `1036` | Espada Longa | basico | **194.00** |
| `3077` | Tiamat | epico | **215.00** |
| `3047` | Botas Galvanizadas de Aço | epico | **2.25** |

`pAtual` = 849.94 · limiar (1,05×) = 892.44

### 4.2 Cenário A — mochila medida (`3077~C, 3047~A, 1001~A, 1036~A`)

Alvo calculado pelo próprio código (`automation.js:2036` + `automation.js:2039`, `cmp` em `automation.js:2034`):

~~~
3047 Botas Galvanizadas de Aço (epico) = 2.25 + 1018 Capa da Agilidade (basico) = 240.00 + 3077 Tiamat (epico) = 215.00 + 3133 Martelo de Guerra de Caulfield (epico) = 208.00 + 3044 Fago (epico) = 207.00
pAlvo = 872.25   pAtual = 849.94   ganho = 2.62%   gate de 5% = `automation.js:2049`
=> BLOQUEADO (só troca instância do mesmo base)
~~~

**O Tiamat entra no alvo** (substitui a Espada Longa `1036`) mas **a troca é recusada pela histerese**. A bota épica `3047` já ganha o seu slot (`2,25` vs `0,94`) — mas também não é equipada porque o gate bloqueia o conjunto todo.

### 4.3 Cenário B — mochila com os básicos que a build pede (`1042`×10, `1037`, `1038`, `1028`, `1018`)

~~~
3047 Botas Galvanizadas de Aço (epico) = 2.25 + 1018 Capa da Agilidade (basico) = 240.00 + 1038 Espada G. p. C. (basico) = 236.00 + 1037 Picareta (basico) = 215.00 + 1042 Adaga (basico) = 215.00
pAlvo = 908.25   pAtual = 849.94   ganho = 6.86%   aplica a troca
~~~

**O Tiamat nem entra no alvo**: `1042` Adaga e `1037` Picareta (básicos) valem **215,00**, exactamente o mesmo que ele, e o desempate é a string do `base` (`automation.js:2034`) — `'1042' < '3077'`. Resultado: **três básicos equipados e o épico na mochila** — o oposto da regra do dono. É esta a razão de fundo: sem termo de raridade em `valorDe` (`automation.js:2760`), "épico é melhor que básico" não existe em lado nenhum da decisão de equipar.

### 4.4 Porque o épico não sai da mochila

`planBag` manda-o **GUARDAR** (P8, `automation.js:308`) e `venderBase` protege-o (`automation.js:1604`): planeador e ator concordam — mas nenhum dos dois o **equipa**. Fica preso exactamente como o dono descreveu.

---

## 5. A regra de EQUIPAR (distinta da de vender)

### 5.1 O motor

| Facto | Fonte |
|---|---|
| `ESPACOS = 5`, `ESPACOS_ITENS = 4` | `motor.js:28`, `motor.js:29` |
| "1 espaço só de bota e 4 livres: o tipo só serve para achar a bota" | `motor.js:30` |
| recusa o 5.º não-bota | `motor.js:2878` |
| `cabeNoEquip` | `motor.js:2890` |
| `equipamentoValido` (1 bota, ≤4, 1 lendário por base) | `motor.js:2892` |

Logo **slot = {bota} ∪ {4 livres}**: `espaco` é rótulo, não é restrição.

### 5.2 Regra formalizada

~~~
K(i) = ( raridade(i),       // lendario > epico > basico  (regra do dono; I2)
         tierDe(i),         // qualidade*10 + refino        (automation.js:203)
         valorDe(i.base),   // stats + passiva + sinergia   (automation.js:2747)
         -base(i) )         // desempate determinístico

alvo = [ melhor 'botas' por K ] + [ 4 melhores não-botas por K ]
~~~

1. **E1 (dura):** épico equipável + básico equipado no slot → o épico entra, **independentemente da histerese**.
2. **E2 (instância):** mesmo `base` → maior `tierDe` (`automation.js:1965`).
3. **Histerese:** só entre itens do **mesmo nível de raridade**; nunca bloqueia E1.
4. **Sem incumbência:** nenhum item ganha pontos por já estar equipado (o +60 saiu; verificar que a sinergia de classe não reintroduz assimetria).

### 5.3 Tabela: o que entra em cada slot

| Situação | Regra correcta | Código hoje |
|---|---|---|
| épico na mochila + básico equipado | entra o épico | ❌ fica o básico (D7) |
| épico S+ | nunca vendido; disputa o slot por K | ✅ cofre (P4) |
| dois épicos do mesmo `base` | maior tier entra; o outro vende | ✅ P7 |
| básico vs épico com valor igual | entra o épico | ❌ entra o de `base` menor (D14) |
| slot de botas | só `espaco == 'botas'` | ✅ `automation.js:2036` |
| item já equipado | não ganha bónus | ✅ desde a remoção do +60 |

### 5.4 Ordem de operações

Hoje o `planBag` decide a venda **sem** saber o alvo de equipar, e o equipar corre noutro passo (`automation.js:1732`), desligado por omissão (`automation.js:1681`). Ordem correcta: **1) alvo de equipar (com raridade) → 2) marcar para venda só o que não entra → 3) excepção S+ → 4) vender.**

---

## 6. Como reconferir (à prova de deslocamento de linhas)

As citações deste documento foram resolvidas **por conteúdo**, não por número fixo. Para revalidar noutra revisão:

~~~bash
cd I:/!lolidle.com
sha256sum extension/automation.js
grep -n "regra do dono: básico → Lojista"        extension/automation.js   # P5
grep -n "COMPONENTE da build"                    extension/automation.js   # P8
grep -n "qIdx(qual) >= qIdx('S')"                extension/automation.js   # corte S+ do ator
grep -n "pAlvo <= pAtual \* 1.05"                extension/automation.js   # histerese
grep -n "s += 45"                                extension/automation.js   # sinergia (sem +60)
grep -n "return stats \* multClasse \* multDef" extension/automation.js   # valorDe (sem raridade)
grep -n "const cmp = (a, b)"                     extension/automation.js   # desempate por base
grep -n "n.equip = !!cfg.autoEquip"              extension/automation.js   # portão do equipar
~~~

---

## 7. O que mudou durante esta auditoria

| Observação | Revisão | Efeito |
|---|---|---|
| `+60` de incumbência em `sinergiaDe` | removido | a bota épica `3047` passa a ganhar da básica `1001` (`2,25` vs `0,94`) |
| corte de venda do ator: `A` → `S` | alterado | épico A deixa de ser intocável |
| `planBag`: ramo próprio para básico | adicionado | 16 básicos A deixam de ficar "sem regra" |
| `planBag`: épico S+ → cofre (era A+) | alterado | alinhado com a regra do dono |
| `ANUNCIAR_MERCADO` para básico/épico | removido | o dono nunca autorizou mercado |

**Continua em falta (o essencial da regra do dono):** nenhuma acção de EQUIPAR, nenhum termo de raridade em `valorDe` e a histerese de 5% a bloquear o caso medido.

---

## AUDITORIA — porque o script nao equipava os epicos e vendia o que nao devia

Medido 2026-10-14 no motor a correr. **Todos os sintomas eram a MESMA classe de bug:** uma
necessidade que NUNCA pode ser satisfeita -> ciclo de recall/ping-pong; mais planeador e actor
a discordarem sobre o que a base tem de fazer.

| necessidade | estava | agora | referencia |
|---|---|---|---|
| `n.presente` | `!!q1('#rastreio-login')` — o jogo so ESCONDE o rastreio; `q1` devolve-o sempre -> `true` eterno | exige `getBoundingClientRect().width > 0` | automation.js:2080 |
| `n.tarefa` | `!st.tem` -> `true` eterno quando nao ha tarefa | mesmo throttle de 5 min | automation.js:2090 |
| `n.atrib` | `!!cfg.autoAtrib` -> `true` eterno | `readSkills().pontosAtrib > 0` | automation.js:2099 |
| `n.equip` | `!!cfg.autoEquip` -> `true` eterno | `planoEquipar(bag).mexe` — a MESMA funcao do actor | automation.js:2102 |
| `n.repor` | `minimoPocoes()` incluia a Suprema (nivel 30) ao nivel 15 -> impossivel | `minimoPocoesAgora()` | automation.js:2055 |
| `n.vender` | disparava por 1 item de 21 de ouro | mochila quase cheia OU valor >= 2x custo da viagem | automation.js:2068 |
| `n.comprar` | — | timer de 10 min; DESLIGADO se nenhuma primaria abrir | automation.js:2120/2125 |

### Regras do dono — conformidade medida item a item (Katarina, mochila de 23)

`PLANO: PROTEGER 5 · VENDER_LOJISTA 12 · ANUNCIAR_MERCADO 1`

- **PROTEGER (5)** — todos lendario **A** ("lendario A/S/SS — nunca mexer").
- **VENDER (12)** — epicos A/B/C ("regra do dono: epico -> Lojista") **e** duplicados de `3075`
  (a copia A protegida, as B e C vendidas). **Nenhum S+ vendido.**
- `3171` lendario B -> mercado.
- **Sem accao `EQUIPAR` — e estava CERTO**: a mochila tem **zero basicos** e todos os epicos
  que la estao sao de tier inferior ao lendario A equipado no mesmo slot. Equipar seria downgrade.

### O 2x do componente (o que tornava a build impossivel)

`3089` Rabadon: `de: ["1058","1058"]` + 1100 = **3500**. `basicosDaBuild()` usa CONTADOR
(`nec[id] = (nec[id]||0) + 1`), **nao Set** — as duas copias contam certo. Com um Set, o teto era 1
e o Rabadon nunca podia ser montado. Confirmado no codigo (automation.js:245-257).

## Onde os alvos dropam (motor x stats dela, nivel 29)

| item | zona | chance | drops/h | sobrevive mobs | chefe fatal |
|---|---|---|---|---|---|
| 6653 Liandry | Toca dos Lobos [10,20] | 0,0033% | 0 | sim | - |
| 6653 Liandry | Campo Vermelho [20,30] | 0,0041% | 0 | sim | - |
| 3089 Rabadon | Covil do Barao [40,50] | 0,0061% | 0 | **NAO** | **SIM** |
| 1058 Basto | Fosso do Dragao [30,40] | **0,180%** | **3** | sim | sim |

**Conclusao:** o Rabadon NAO e farmavel (a unica zona que o dropa mata-a). E COMPRAVEL por 3500
e ela tem 9,6M. O componente `1058` dropa exactamente onde ela ja farma (Fosso do Dragao), a
**30x a taxa de qualquer lendario**.

## Objetivo de item (cfg.objetivoItem) — ver docs/objetivo-item.md

A build ideal era 100% emergente de `montarBuildDe()` (stats ponderados x multiplicador de classe).
Num campeao AD o Rabadon (AP) levava 0.12x e era **inalcancavel por construcao**. `cfg.objetivoItem`
fixa o item como ALVO, logo a seguir as botas, sem passar pelo multiplicador.

Prova em campeao AD: sem objetivo `[3172,3046,6631,3085,3031]` (Rabadon FORA); com objetivo
`[3172,3089,3046,6631,3085]` (Rabadon DENTRO, slot 2). Custo: perde o `3031` Gume do Infinito.

---

## AUDITORIA DE PASSIVAS — 41 de 50 estao INVISIVEIS ao motor (medido 2026-10-14)

Medido ao vivo sobre `META.itens` (108 itens, vindos do proprio jogo):

```
total: 108     com efeito/passiva: 50     sem efeito: 58
modelada: 9    NAO modelada: 41
```

Ou seja: **82% das passivas do jogo nao entram em `valorPassiva()`**, logo o `montarBuildDe`
decide a build por STATS BRUTOS para esses itens. Isto e a causa raiz de o "teorico" nao
conseguir ganhar ao medido — a teoria esta cega a 41 passivas. E responde ao pedido do dono:
"e pro script conhecer todos os itens do jogo e passivas ... independente dos dados NOSSOS".

### Exemplos das que ficam de fora (id: efeito)

| id | efeito |
|---|---|
| 3170 | Passo Ligeiro: +5% de esquiva |
| 3174 | Blindagem: +15% de Armadura total |
| 3068 | Fogo Solar: +10% de Armadura total |
| 3143 | Presságio: +10% de Armadura total |
| 3171 | Lucidez: -15% na recarga das habilidades |
| 3173 | Correntes: +15% de Resistencia Magica |
| 3165 | Aflição: habilidades causam +12% de dano |
| 3152 | Explosao Hextec: +5% de Poder de Habilidade |
| 3116 | Geada: habilidades deixam os inimigos lentos |
| 3085 | Furia do Vento: cada ataque dispara ... |
| 6655 | Eco: a cada 6s, a proxima habilidade ... |
| 3003 | Pavor: ganha Poder de Habilidade ... |

### Caminho recomendado (nao feito)

Muitos seguem um padrao textual simples e mecanico — `+N% de <stat> total`, `-N% na recarga`,
`+N% de esquiva` — pelo que um PARSER GENERICO do campo `efeito` cobre uma boa parte sem
escrever 41 casos a mao. Os que exigem estado (Geada, Furia do Vento, Eco, Pavor) precisam de
valor por regra propria. **Nao implementado: fica medido e por fazer.**

> Correccao de metodo: `ITENS_ESPECIAIS[id]` devolveu 0 acertos na mesma sondagem, mas isso NAO
> prova que a tabela esteja vazia — pode ser so a chave/forma de acesso. Nao afirmo o que nao
> medi direito.
