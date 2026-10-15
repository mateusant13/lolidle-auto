# Drops por região × classe, e prioridade extrema de itens (Gume do Infinito / Rabadon)

Documento de **leitura** (nenhum código da extensão foi alterado). Responde ao pedido do dono:

> "parece que, com base na classe do meu boneco, outros itens nao aparecem pra drop, mesmo na mesma
> regiao. o baron que devia ter o gume do infinito, tem o rabaddon, inves disso. e todos os bonecos
> tem que saber a build ideal deles, e quais itens sao de extrema prioridade e que nao devem ser
> tocados pelas nossas regras de auto clean, tipo gume do infinito e rabaddon. mesmo duplicados, e o
> jogador que decide com eles."

**Regra de evidência deste documento:** cada afirmação tem `file:linha`. Onde não houve prova
executada, está escrito **NAO VERIFICADO**.

## 0. Fontes, hashes e método (para o documento não envelhecer em silêncio)

| ficheiro | sha256 | linhas citadas medidas nesta revisão |
|---|---|---|
| `docs/game-src/motor.js` | `2418f4a2a3a9736a703a7eef0aab59f315bf4102d7e8777b24a5e91cc68a95a2` | §1 |
| `docs/game-src/itens.js` | `902757451ffd515718916198fa8dd76932666f04791622bbd31c6f186a8a2494` | §1, §3 |
| `extension/automation.js` | `622c562c9d802ceed8743eb83b9e7bede9b83dc4c54af158675b7884bcab700d` (394.985 bytes) | §2, §3 |
| `extension/gui.js` | `ad7fb237daac62f13dc6a8a65ffe01b1230a16993dd1a425d2241bd3b2528b4d` | §2.3 |
| `extension/inject.js` | `0af1be3a2fccf6b4402f79945bef4ddca5a005c3e8f9090fab10c2fe73e4ed8c` | §2, §3 |

> **AVISO de concorrência:** durante este trabalho o `extension/automation.js` **mudou** na árvore
> (387.883 → 394.985 bytes; sha `ec9a665e…` → `622c562c…`). Todas as linhas de `automation.js`/`gui.js`
> deste documento são do sha acima. Se o ficheiro voltar a mudar, o **sha é a âncora** e os números de
> linha podem deslocar-se.

**O que foi executado** (não é leitura):

1. O texto exacto de `motor.js:383-406` foi extraído e avaliado, para enumerar as 16 tabelas e a
   região de cada lendário (não é uma cópia: é o texto do ficheiro).
2. `classeItem` (`motor.js:22`) + `baseId` (`motor.js:159`) + `ITENS` (`motor.js:13`) foram
   extraídos e corridos sobre os 108 itens de `itens.js`, para contar a classe de cada item.
3. A extensão REAL foi corrida no banco de regressão (`tools/testes/dom-stub.mjs`, sem browser/CDP)
   com o catálogo REAL (108 itens) e os 7 kits reais: `buildIdealPara`/`buildIdeal`, `identidadeCampeao`,
   `planBag` com mochilas montadas no DOM.
4. `bun tools/testes/run.mjs` na raiz → **rc=0, UNSTUBBED 0** (ver §4).

**O que NÃO foi executado:** o motor do JOGO. `docs/game-src/motor.js` não é importável neste
workspace porque faltam ficheiros que ele importa — o erro real é
`Cannot find module 'I:\!lolidle.com\docs\game-src\dados-ezreal.js' imported from docs/game-src/motor.js`
(`motor.js:3`, e o mesmo para `dados-yasuo/lux/katarina/taric/zac.js` em `motor.js:4-8`; `i18n.js`
também falha por `./i18n/en.js`). Logo: **o sorteio de drop é verificado por LEITURA (file:linha), não
por execução.** A cadeia de decisão está transcrita abaixo linha a linha para poder ser conferida.

---

## 1. TABELAS DE DROP — como o jogo decide o que dropa

### 1.1 Onde estão

- `motor.js:383` — `const DROPS = {` (tabela **AD**, "padrão"): 8 regiões em `motor.js:384-391`.
- `motor.js:397` — `const DROPS_AP = {` (tabela **AP**): 8 regiões em `motor.js:398-405`.
- `motor.js:407` — as tabelas passam a viver nos próprios locais:
  `for (const l of LOCAIS) { if (DROPS[l.id]) l.drops = DROPS[l.id]; if (DROPS_AP[l.id]) l.dropsAp = DROPS_AP[l.id]; }`
- Os locais são `LOCAIS` (`motor.js:354-379`): `fonte, rota-inf, rota-sup, lobos, azul, vermelho, rio,
  dragao, barao, arena, aram`. **Só 8 têm tabela** (`fonte` é base, `arena`/Runeterra e `aram`/Arena não
  têm `drops` — ver §1.3.1).
- Comentários de desenho: `motor.js:381-382` ("o que cai em cada lugar… o resto dos lendários se
  monta no Ornn juntando os componentes"), `motor.js:393-396` (histórico: bota lendária no Campo Azul/
  Dragão/Barão; lendário de tanque nos Lobos/Vermelho/Rio em 13/10/2026).

### 1.2 TODAS as tabelas (região → básico / épico / lendário)

**AD** (`DROPS`, `motor.js:384-391`):

| região | linha | básico | épico | lendário |
|---|---|---|---|---|
| rota-inf | 384 | 1036,1028,1042,1029,2022,1001,1054 | 3077,3144,3047,3140 | 6631,3078,3174 |
| rota-sup | 385 | 1036,1028,1033,1006,1018,1120 | 3044,3057,1053,3133,3006 | 3078,3074,3172 |
| lobos | 386 | 1042,1037,1018,1029,1001 | 3051,3086,1043,2019,3009,3105 | 3046,6333,3170 |
| azul | 387 | 1033,1006,2022,1028,1120 | 3067,3211,3066,1011,3111,3801 | 3065,3071,8020,3190,3174 |
| vermelho | 388 | 1036,1037,1038,1028,1054 | 2021,3077,3035,6670,3008 | 3748,2501,3072,3168 |
| rio | 389 | 1042,1018,1038,1001 | 3086,6670,3144,1043,3158,3024 | 3085,3153,3036,3156,3173 |
| dragao | 390 | 1037,1038,1029,1028,1120 | 1031,3076,2019,3133,3047,3140 | 3075,3742,6610,3068,3143,663056,3172 |
| barao | 391 | 1038,1037,1018,1054 | 3035,6670,3133,1011,3006,3111 | **3031**,3026,3053,6673,3083,3168 |

**AP** (`DROPS_AP`, `motor.js:398-405`):

| região | linha | básico | épico | lendário |
|---|---|---|---|---|
| rota-inf | 398 | 1052,1027,1028,1029,2022,1001,1056 | 3916,3108,3020,3140 | 6655,3116,3174 |
| rota-sup | 399 | 1052,1027,1028,1033,1006,1120,1054 | 3802,3113,3145,3158 | 3116,3003,3171 |
| lobos | 400 | 1052,3070,1029,1028,1001 | 3108,4630,3147,2508,3009,3105 | 3100,6653,3170,3190 |
| azul | 401 | 1033,1006,2022,1028,1027,1056 | 3802,3067,3113,1011,3111,3801 | 3003,3165,3065,8020,3190,3171 |
| vermelho | 402 | 1026,1052,1028,1120 | 2508,3145,2420,3147,3020 | 4645,6653,3102,3152,3175,3143 |
| rio | 403 | 1026,1052,3070,1001 | 4630,3916,4632,3113,3158,3024 | 3135,4629,3157,3175,3173,8020 |
| dragao | 404 | 1026,1058,1029,1028,1120 | 2420,3145,4632,3108,3047,3140 | 3157,4645,3075,3068,664644,3175 |
| barao | 405 | 1058,1026,1052,1054 | 4630,3802,2420,1011,3020,3111 | **3089**,3135,3157,4633,3083,3171 |

**Confirmação textual das duas linhas que o dono citou:**

- `motor.js:391` = `barao: { basico: ['1038','1037','1018','1054'], epico: ['3035','6670','3133','1011','3006','3111'], lendario: ['3031','3026','3053','6673','3083','3168'] },`
- `motor.js:405` = `barao: { basico: ['1058','1026','1052','1054'], epico: ['4630','3802','2420','1011','3020','3111'], lendario: ['3089','3135','3157','4633','3083','3171'] },`

### 1.3 A tabela MUDA com a CLASSE do campeão — **SIM** (o dono suspeitou certo)

**A cadeia completa (motor):**

1. `motor.js:1152` — `export const classeDe = (estado) => (kit(estado).magia ? 'ap' : 'ad');`
2. `motor.js:896` — `export const kit = (estado) => KITS[estado?.campeao] || KITS.darius;`
   (`estado.campeao` é o id do boneco).
3. `KITS` (`motor.js:864-895`) marca `magia: true` em: `lux` (`877`), `katarina` (`884`),
   `taric` (`888`), `zac` (`892`). **AD (sem `magia`):** `darius` (`870`), `ezreal` (`872`),
   `yasuo` (`881`). São os 7 campeões do jogo (`campeoes.js:7-41`, todos `disponivel: true`).
4. `motor.js:1151` — a escolha da tabela:
   `itensPorRaridade = (r, local, classe = 'ad') => (classe === 'ap' ? local?.dropsAp?.[r] || POR_CLASSE.ap[r] : local?.drops?.[r] || POR_CLASSE.ad[r]);`
5. `motor.js:1153-1165` — `sortearLoot(local, chefe, mult, classe)`; `motor.js:1155`
   `const pool = (rar) => itensPorRaridade(rar, local, classe);`; `motor.js:1132` `escolher` =
   sorteio **uniforme** dentro da lista.

**Onde a classe entra em jogo (call sites):**

- Abate normal: `motor.js:1770` — `const cl = classeDe(estado), itens = … sortearLoot(lugar, i.chefe, mult * petIt, cl) …`.
- Chefe: `motor.js:1156-1158` — o chefe usa o **mesmo pool da região**
  (`DROP_CHEFE` = `motor.js:1145`: lendário 0,1%, épico 5%, básico 40%).
- Painel "O que cai aqui" no jogo: `jogo.js:3810-3818` (a linha decisiva é `jogo.js:3813`:
  `const itens = M.itensPorRaridade(r, l, M.classeDe(estado));`).
- Tarefas (item de tarefa): `motor.js:3415` e `motor.js:3462` usam só `POR_CLASSE` (sem região).
- Runeterra: `arena.js:1649-1650` passa `M.LOCAL[i.zona] || base` — **as mesmas tabelas por zona**;
  `base` é `M.localDaArena(estado.nivel)` (`arena.js:1649`, `motor.js:414`).

**1.3.1 Há ainda um segundo filtro, por ITEM, que fecha a porta à classe errada** —
`motor.js:52` (`const POR_CLASSE = { ad: {...}, ap: {...} }`) e `motor.js:408`:

```js
for (const i of ITENS_DADOS) { const cl = classeItem(i.id); if (cl !== 'ap') POR_CLASSE.ad[raridade(i)].push(i.id); if (cl !== 'ad') POR_CLASSE.ap[raridade(i)].push(i.id); }
```

com `classeItem` = `motor.js:22` e `baseId` = `motor.js:159`. Medido sobre os 108 itens de `itens.js`:
**39 AD, 32 AP, 37 neutros**. Logo: o pool AD = 76 itens (39 ad + 37 neutros) e o pool AP = 69 (32 ap +
37 neutros); a **interseção é só os 37 neutros**. Um campeão AD **nunca** vê os 32 itens AP; um AP
**nunca** vê os 39 itens AD. `POR_CLASSE` só é usado como *fallback* (`motor.js:1151`), quando a
região não tem tabela (ex.: `fonte`, `arena`, `aram`).

> **Resposta directa à 1.ª queixa do dono:** "outros itens não aparecem pra drop, mesmo na mesma
> região" — **confirmado e é por desenho**: `motor.js:1151` + `motor.js:1152` + `motor.js:408`.
> Não é bug de sorteio; é a tabela da classe a ser escolhida.

### 1.4 Barão: tem o 3031 (Gume do Infinito)? Tem o 3089 (Rabadon)?

| pergunta | resposta | linha exacta |
|---|---|---|
| O Barão (AD) tem o **3031 Gume do Infinito**? | **SIM** | `motor.js:391` — `lendario: ['3031', '3026', '3053', '6673', '3083', '3168']` |
| O Barão (AD) tem o **3089 Rabadon**? | **NÃO** | `motor.js:391` (não está na lista) |
| O Barão (AP) tem o **3089 Rabadon**? | **SIM** | `motor.js:405` — `lendario: ['3089', '3135', '3157', '4633', '3083', '3171']` |
| O Barão (AP) tem o **3031**? | **NÃO** | `motor.js:405` |

E, no jogo inteiro (as 16 listas de lendários de `motor.js:384-391` e `398-405`):

- `3031` aparece em **1** lista: `barao`/**AD** (`motor.js:391`).
- `3089` aparece em **1** lista: `barao`/**AP** (`motor.js:405`).

**Portanto o AD NÃO está sem lendários AD na tabela do Barão** — tem `3031` (Gume do Infinito),
`3026` (Anjo Guardião), `3053` (Sinal de Sterak), `6673`, `3168` e o neutro `3083`. O que produz o
sintoma que o dono viu é a **classe do boneco**: o **Barão Nashor não tem tabela própria** — o chefe
usa o pool da região (`motor.js:1156-1158` com `pool(rar) = itensPorRaridade(rar, local, classe)`,
`motor.js:1155`). Se o boneco em campo for **AP** (lux/katarina/taric/zac — `motor.js:877,884,888,892`),
o abate no Barão (chefe ou criaturas) sorteia da lista AP e o `3031` **é inalcançável por construção**;
e é de lá que sai o `3089` que ele viu. Com um boneco AD é o contrário: sai `3031` e o `3089` é
inalcançável.

> **Qual foi o caso concreto do dono (qual boneco, qual abate): NAO VERIFICADO** — não há aqui registo
> da sessão dele. O que está provado é o mecanismo que produz exactamente esse sintoma.

### 1.5 Que região dropa cada lendário AD relevante

(calculado das listas de `motor.js:384-391`)

| item | nome | região (AD) |
|---|---|---|
| `3031` | Gume do Infinito | **barao** |
| `3074` | Hidra Raivosa | rota-sup |
| `3078` | Força da Trindade | rota-inf, rota-sup |
| `3085` | Furacão de Runaan | rio |
| `3153` | Espada do Rei Destruído | rio |
| `3036` | Lembranças do Lorde Dominik | rio |
| `3046` | Dançarina Fantasma | lobos |
| `6333` | Dança da Morte | lobos |
| `3170` | Marcha Célere | lobos |
| `3072` | Sedenta por Sangue | vermelho |
| `3168` | Caminho Imortal | vermelho, barao |
| `3748` | Hidra Titânica | vermelho |
| `2501` | Armadura Sangrenta do Suserano | vermelho |
| `6631` | Quebrapassos | rota-inf |
| `3174` | Mobilização Blindada | rota-inf, azul |
| `3065` | Semblante Espiritual | azul |
| `3071` | Cutelo Negro | azul |
| `8020` | Máscara Abissal | azul |
| `3190` | Medalhão dos Solari de Ferro | azul |
| `3075` | Armadura de Espinhos | dragao |
| `3742` | Couraça do Defunto | dragao |
| `6610` | Céu Dividido | dragao |
| `3068` | Égide de Fogo Solar | dragao |
| `3143` | Presságio de Randuin | dragao |
| `663056` | Coroa do Rei Demoníaco | dragao |
| `3172` | Grevas Bélicas | rota-sup, dragao |
| `3026` | Anjo Guardião | barao |
| `3053` | Sinal de Sterak | barao |
| `6673` | Arco-escudo Imortal | barao |
| `3083` | Armadura de Warmog | barao (neutro: também no AP) |

**Espelho AP** (para não repetir a análise quando o boneco for de magia; `motor.js:398-405`):
`3089` barao; `3135` rio,barao; `3157` rio,dragao,barao; `4633` barao; `3171` rota-sup,azul,barao;
`3116` rota-inf,rota-sup; `3003` rota-sup,azul; `6655` rota-inf; `3100` lobos; `6653` lobos,vermelho;
`4629` rio; `3152` vermelho; `3102` vermelho; `4645` vermelho,dragao; `3175` vermelho,rio,dragao;
`664644` dragao; `3165` azul; `3190` lobos,azul; `8020` azul,rio; `3173` rio (neutro: também no AD).

### 1.6 Outras razões para "não apareceu" (nenhuma delas é a classe)

- **Saco cheio → o item é PERDIDO:** `motor.js:1773` guarda se `espacosLivres(estado) > 0`, senão
  `motor.js:1774` `else perdidos.push(id);` (vai no evento `motor.js:1785` como `perdidos`).
- **Interruptor do jogador:** `estado.ignorarBasicos` descarta os básicos antes de entrarem
  (`motor.js:1772`; ligado/desligado na UI em `jogo.js:5882-5884`).
- **A qualidade é do servidor:** o item entra na mochila como `'?'` (`motor.js:1773`
  `comItem(id, 0, '?')`) e o servidor revela (`motor.js:206-243`, `revelarPendentes`). Enquanto isso,
  no jogo ele aparece sem qualidade — não é um drop diferente.
- **A chance (não a tabela) depende da zona:** `motor.js:1143` `BRUTO`, `motor.js:1142`
  `LENDARIO_TIER`, `motor.js:1146-1149` `chancesDrop`, e o multiplicador de saque
  (`motor.js:1758,1764`: VIP ×1,2, Runeterra ×1,3 em `motor.js:412`, `fatorSaque` = `fatorXp`
  `motor.js:421,424`).

---

## 2. PRIORIDADE EXTREMA POR CAMPEÃO

### 2.1 O motor do JOGO tem isso? — **NÃO** existe lista de "nunca vender" no jogo

- `ITENS_ESPECIAIS` **não existe no jogo** (é nome da extensão: `automation.js:3678`; nenhum ficheiro
  de `docs/game-src/` o contém).
- A única guarda de venda do jogo é a **qualidade/refino** na janela do Lojista:
  `jogo.js:5515` — `const protegidoVenda = (id) => ['S','SS'].includes(M.qualidadeDe(id)) || M.refinoDe(id) > 0;`
- E o motor recusa vender só o que ainda está a ser avaliado: `motor.js:2930-2935` —
  `venderItem` … `if (!atendeAqui(estado) || !id || pendente(id)) return 0;` (`motor.js:2932`).
- **O que o jogo tem, sim, é o conjunto de itens que o motor LÊ PELO ID para mudar a REGRA** —
  `tem('<id>')`. São 28 ids distintos (medido; primeiro `tem()` de cada um):
  `2501`:`motor.js:514`, `3031`:`515`, `3003`:`521`, `3089`:`522`, `3135`:`529`, `3036`:`539`,
  `3072`:`1229`, `3065`:`1286`, `3078`:`1672` (e `3057` na mesma linha), `3100`:`1688`, `3742`:`1698`,
  `6610`:`1699`, `3153`:`1702`, `3071`:`1705`, `3044`:`1706`, `3046`:`1707`, `3085`:`1718`,
  `6631`:`1719`, `3074`:`1720`, `3748`:`1721`, `3075`:`1735`, `6333`:`1790`, `6655`:`1945`,
  `3102`:`2698`, `3157`:`2722`, `3053`:`2725`, `3026`:`2729`.
- Destes, **só DOIS são multiplicadores do stat central da classe** (mudam a RÉGUA, não somam):
  `3031` → `motor.js:515` `if (tem('3031')) danoCritico += 0.4;   // Gume do Infinito`
  `3089` → `motor.js:522` `if (tem('3089')) ap *= 1.35;          // Rabadon: +35% do poder total`

### 2.2 O que a extensão JÁ tem (estado actual, medido)

`automation.js:26-58` — **`PRIORIDADE_EXTREMA`** (tabela com 2 entradas, derivadas do motor):

- `automation.js:47-50`:
  `{ id: '3031', classe: 'ad', tipo: 'critico', motivo: '+40% no dano do acerto crítico (o multiplicador do AD)', fonte: 'motor.js:515' }`
  `{ id: '3089', classe: 'ap', tipo: 'multiplicador', motivo: '+35% em TODO o Poder de Habilidade (o multiplicador do AP)', fonte: 'motor.js:522' }`
- `automation.js:55` `ehPrioridadeExtrema(base)`, `automation.js:58` `prioExtremaDe(base)`
  (aceitam `'3031+2~A'` — normalização em `automation.js:53`).
- O comentário `automation.js:26-46` cita o pedido do dono **verbatim** e a regra:
  "um item desta lista NUNCA é vendido nem anunciado — NEM DUPLICADO (o duplicado fica na mochila e a
  decisão é do jogador)" (`automation.js:40-41`).

**Pontos onde a regra está ligada** (todos verificados por leitura):

| onde | linha | efeito |
|---|---|---|
| `isProtected` | `automation.js:300` | blindado no plano (`planBag`) |
| `isMarketable` | `automation.js:306` | nunca anunciável |
| `planBag` (ramo próprio) | `automation.js:424` | `PROTEGER` **antes** de todos os ramos de venda, incl. a duplicata (`automation.js:472`) |
| venda no Lojista (`venderBase`) | `automation.js:2029` | `continue` — não vai à cesta |
| mercado por índice | `automation.js:2572` | recusa anunciar |
| mercado por base | `automation.js:3441` | recusa anunciar |
| varrimento `anunciarLendarios` | `automation.js:4279` | filtra os candidatos |

**MEDIÇÕES (extensão real, catálogo real, mochila montada no DOM, `planBag`)**:

| campeão | mochila | acção | motivo |
|---|---|---|---|
| yasuo (AD) | `3031~C` ×2, `3089~C` ×2 | PROTEGER ×4 | 3031: "LENDÁRIO DA BUILD DA CLASSE (dano/ad)"; 3089: "PRIORIDADE EXTREMA (ap/multiplicador) … [motor.js:522]" |
| lux (AP) | `3031~C` ×2, `3089~C` ×2 | PROTEGER ×4 | 3031: "PRIORIDADE EXTREMA (ad/critico) … [motor.js:515]"; 3089: "LENDÁRIO DA BUILD DA CLASSE (mago/ap)" |
| zac (AP) | `3031~C`, `3089~C` | PROTEGER ×2 | ambos "PRIORIDADE EXTREMA" |
| lux (AP) | `3031~A`, `3031~S` | PROTEGER ×2 | "lendário A/S/SS — nunca mexer" (regra de qualidade, `automation.js:299`) |

Ou seja: **hoje o Gume do Infinito e o Rabadon são intocáveis para QUALQUER campeão, duplicados
incluídos** — a classe já não decide a protecção destes dois. Isto responde ao pedido central do dono
e **já está implementado** em `automation.js@622c562c`.

**O que continua a ser POR CLASSE (e é assim que deve ser):** `ITENS_ESPECIAIS` (`automation.js:3678-3716`)
+ `CAMPOS_MULT` (`automation.js:3720`) + `mapaEspecial` (`automation.js:3725-3747`) +
`ehEspecialMeu` (`automation.js:3751`) / `ehEspecialErrado` (`automation.js:3753`). A regra `meu` está em
`automation.js:3737`: `const meu = papel === 'neutro' || papel === minha || (perfil === 'tanque' && papel === 'tanque');`.
Medido: **cobertura completa** — os 28 `tem()` distintos do motor têm todos entrada em `ITENS_ESPECIAIS`
(nenhum em falta), e há **6 entradas a mais** derivadas dos campos multiplicativos do catálogo
(`3068 armPct`, `3143 armPct`, `8020 vidaPct`, `6673 vidaPct`, `3170 esquiva`, `3172 adPct`) — 34 entradas no total.

**Consequência medida dessa fronteira** (é uma escolha, não um bug — mas vale saber):

| campeão | mochila | acção |
|---|---|---|
| darius (AD, perfil **dano**) | `3068~C`, `3083~C` | ANUNCIAR_MERCADO ("lendário < A → mercado") |
| zac (AP, perfil **tanque**) | `3068~C`, `3083~C` | PROTEGER ("LENDÁRIO DA BUILD DA CLASSE (tanque/ap)") |

`darius` é descrito como tanque no kit, mas `perfilDe` dá-lhe **`dano`**: `automation.js:3514-3516`
exige `receb <= 0.62 && dano < 1.0` para `tanque` e o kit do darius tem `dano: 1.1`
(`motor.js:870`) → falha. (O comentário `// darius` na linha do ramo `tanque` está, por isso,
desactualizado face ao motor.)

**Contagem de "intocáveis" por campeão (medido: os 49 lendários do catálogo, qualidade C, na mochila):**

- yasuo (AD/dano): **22 de 49** protegidos — 5 da build (`3046,3172,3036,3074,3031`) + 16 de tratamento
  especial AD + o `3089` (prioridade extrema). Não protegidos: 27 (ex.: `3135,3157,6653,3003,3100…`).
- lux (AP/mago): **15 de 49** — 5 da build (`3171,3100,3135,6653,3089`) + 9 de tratamento especial AP +
  o `3031` (prioridade extrema).
- zac (AP/tanque): **24 de 49** — 5 da build (`3170,3068,3143,8020,3083`) + 17 de tratamento
  especial tanque/AP + `3031` e `3089`.

### 2.3 A regra do dono traduzida para regra implementável

> "Gume do Infinito e Rabadon são intocáveis; duplicados são decisão do jogador."

Tradução (3 cláusulas, todas já satisfeitas pelo motor da extensão — falta a GUI, ver abaixo):

1. **R1 — Conjunto ABSOLUTO (não depende do campeão):** os itens que o motor lê para **multiplicar** o
   stat central da classe — `3031` (`motor.js:515`) e `3089` (`motor.js:522`). Nunca vendidos, nunca
   anunciados, nunca deduplicados, em qualquer campeão, qualidade e refino. → `PRIORIDADE_EXTREMA`
   (`automation.js:47-50`), aplicada em `automation.js:300,306,424,2029,2572,3441,4279`.
2. **R2 — Conjunto POR CAMPEÃO (derivado, não escrito à mão):** os itens que o motor lê pelo ID para
   mudar a regra *daquele* boneco — `ITENS_ESPECIAIS`/`mapaEspecial` com `papel == minha classe` (ou
   `neutro`, ou `tanque` num perfil tanque) — `automation.js:3737`, `3751`. Mais os **lendários da
   própria build ideal** (`automation.js:265-294`, `ehLendarioDaBuild`).
3. **R3 — Duplicado:** para os itens de R1/R2, o ramo de duplicata (`automation.js:472-474`) **não se
   aplica**: o item fica na mochila e o jogador decide. Medido acima (`3031~C` ×2 → PROTEGER ×2 em AD
   e em AP).

**O que FALTA (lacuna concreta, medida por grep):** a **GUI** não conhece a `PRIORIDADE_EXTREMA`.
`gui.js` não tem uma única referência a `PRIORIDADE_EXTREMA`/`ehPrioridadeExtrema` (grep: 0 resultados);
a lista "Blindados — nunca são vendidos" (`gui.js:1521-1531` `protegidos()`, cartão em `gui.js:1555-1557`)
contém apenas: `RABADON` (`gui.js:1523`, `gui.js:48`), os lendários da build da classe
(`gui.js:1524-1525`, via `lendariosDaClasse`) e os equipados S/SS (`gui.js:1526-1528`).
Efeito: **no campeão AP o motor protege o `3031` mas o painel não o mostra como 🔒**; e o inverso no AD
em relação ao `3089` (esse aparece por causa da entrada fixa `RABADON`). Para o pedido "todos os
bonecos têm que saber quais itens são de extrema prioridade", falta a GUI ler o mesmo conjunto que o
motor usa (expor `PRIORIDADE_EXTREMA` no `window.__lolidleAuto` — `automation.js:5978` — e consumi-lo
em `gui.js:1521`).

### 2.4 Yasuo (exemplo) e como derivar para QUALQUER campeão

Para o **Yasuo** (AD, perfil `dano`, kit `motor.js:881`), derivado hoje:

- **Build ideal:** `["3172","3031","3046","3036","3074"]` (medido, §3.2).
- **Extrema prioridade (R1):** `3031` Gume do Infinito, `3089` Rabadon.
- **Tratamento especial da classe AD (R2):** `3031,3036,3071,3072,3078,3057,3742,6610,3153,3044,3046,
  3085,6631,3074,6333,3026,3053` + os derivados por campo multiplicativo
  (`3156,3168,3190,663056,6673` — medido no varrimento: 22 protegidos no total, listados em §2.2).
- **Lendários da build (R2):** os 5 da build.

**Como derivar para qualquer campeão** (é o que o motor já faz, sem números inventados):

1. **Classe** = `kit(estado).magia ? 'ap' : 'ad'` (`motor.js:1152`; o dado chega à extensão por
   `inject.js:147` `magia: !!K.magia` e fica em `META.champAtual.magia` — `automation.js:1168`).
2. **Perfil** = `perfilDe(c)` (`automation.js:3508-3517`) a partir de `papel.dano`/`papel.recebido`/
   `distancia` do kit (mesma fonte, `inject.js:147`).
3. **Itens de regra** = `ITENS_ESPECIAIS` (do `grep tem('id')` do motor) filtrados por
   `papel === classe` (ou `neutro`, ou `tanque` se o perfil for tanque) — `automation.js:3737`.
4. **Build** = `buildIdealPara(c)` (§3).
5. **Absolutos** = `PRIORIDADE_EXTREMA` (`automation.js:47-50`), independentes de 1-4.

---

## 3. BUILD IDEAL POR CAMPEÃO

### 3.1 Como é derivada hoje

- `automation.js:4332-4335`: `buildIdeal()` (chama `garantirCampeao()`, `automation.js:4332`) e
  `buildIdealPara(c) { return montarBuildDe(c, null); }` (`automation.js:4335`).
- `automation.js:4352-4391` `montarBuildDe(c, fase)`: **1 bota + 4 melhores** entre épicos e lendários
  do catálogo (`automation.js:4367`), com
  `poder(i)` = soma ponderada dos stats (`automation.js:4357-4360`) + `valorPassiva(i.id)`
  (`automation.js:4360`), multiplicador de classe (`4361-4362`), penalização de item defensivo em
  campeão ofensivo (`4364`) e **multiplicador de raridade** `{basico:1, epico:1.15, lendario:1.35}`
  (`automation.js:4365`).
- Pesos por perfil: `automation.js:3520-3526` `pesosItem`; `automation.js:3508-3517` `perfilDe`;
  `automation.js:3528-3533` `classeItem`; `automation.js:3758+` `valorPassiva` (lê o texto `efeito` do
  catálogo por regex).
- Fontes de dados: `META.itens` (o catálogo do jogo, 108 itens — `itens.js:3`, carregado por
  `inject.js`) e `META.champAtual` (kit do boneco: `inject.js:147`, `automation.js:1168`).

### 3.2 MEDIÇÃO — 5 itens para os 7 campeões: **CONFIRMADO**

(extensão real + catálogo real de 108 itens + kits reais; `buildIdeal()` com o campeão carregado)

| campeão | classe | perfil | build ideal | n |
|---|---|---|---|---|
| darius | ad | dano | `3172,3031,3046,3036,3074` | 5 |
| ezreal | ad | atirador | `3172,3031,3046,3036,3074` | 5 |
| yasuo | ad | dano | `3172,3031,3046,3036,3074` | 5 |
| lux | ap | mago | `3171,3089,3135,3100,6653` | 5 |
| katarina | ap | mago | `3171,3089,3135,3100,6653` | 5 |
| taric | ap | tanque | `3170,3083,8020,3143,3068` | 5 |
| zac | ap | tanque | `3170,3083,8020,3143,3068` | 5 |

Notas do que a medição revela:

- São **5 itens para os 7** — mas apenas **4 builds distintas**: darius = ezreal = yasuo,
  lux = katarina, taric = zac. A "build por campeão" é hoje, na prática, **por perfil**.
- O perfil `suporte` de `pesosItem` (`automation.js:3523`) é **inalcançável**: `perfilDe`
  (`automation.js:3508-3517`) nunca devolve `'suporte'` (devolve `tanque|mago|atirador|dano`).
  O Taric — que no roster do jogo é `funcao: 'Suporte'` (`campeoes.js:32`) — cai em `tanque`.
- O `3031` **já entra na build AD** (por isso o Yasuo/Darius/Ezreal o protegem por dois caminhos) e o
  `3089` entra na AP.

### 3.3 O que FALTA para a build ser derivável SOZINHA

**(a) A contaminação pelo campeão actual — MEDIDA (é o defeito mais sério).**
`buildIdealPara(c)` **não é independente de `c`**: `valorPassiva` lê `META.champAtual`
(`automation.js:3762-3763`: `const c = META.champAtual || {}; const ap = !!c.magia, tank = perfilCampeao() === 'tanque';`)
em vez do argumento `c` de `montarBuildDe`. Medição:

| chamada | champAtual | resultado |
|---|---|---|
| `buildIdealPara(lux)` | yasuo (AD) | `3171,3089,4629,3100,4633` |
| `buildIdealPara(lux)` | lux (AP) | `3171,3089,3135,3100,6653` |
| `buildIdealPara(katarina)` | yasuo (AD) | `3171,3089,4629,3100,4633` |
| `buildIdealPara(katarina)` | katarina (AP) | `3171,3089,3135,3100,6653` |

Ou seja: pedir a build de um campeão que **não** é o actual devolve uma lista diferente (e pior) da
dele. Correção necessária: **passar o campeão por parâmetro a `valorPassiva`** (e a `perfilCampeao`
dentro dela) — hoje só `perfilDe`/`classeItem`/`multClasse` usam o `c` recebido
(`automation.js:4353-4362`).

**(b) A identidade do campeão tem de existir.** `META.champAtual` só é preenchido por
`garantirCampeao()` → `detectarCampeao()` (ícone do HUD) → `aplicarKit()` (`automation.js:1138-1149`,
`1151-1173`; `inject.js:147`). Sem isso, `buildDaClasse` devolve `[]` por decisão explícita
(`automation.js:267`) e a GUI diz "o motor ainda não sabe qual é o teu campeão"
(`gui.js`, cartão `ap-it-build`). Para "todos os bonecos" isto é suficiente **desde que o HUD carregue**;
para derivar um boneco que não está em campo, tem de se passar `c` (e corrigir (a)).

**(c) É uma heurística, não uma medição.** Os pesos de `pesosItem` são constantes por perfil
(`automation.js:3520-3526`) e `valorPassiva` é uma soma de regex sobre o texto `efeito`
(`automation.js:3758-3802`); a auditoria do próprio projecto mede que **82% das passivas do jogo não
entravam** (`docs/itens-ideal.md:343`) — daí as 3 vagas de correcção documentadas em
`automation.js:3777-3802`. E a build ainda tem o seu **multiplicador de raridade próprio**
(`automation.js:4365`), que o `HANDOFF.md:74` e `TODO.md:1035` marcam como dívida (D1: unificar
`buildIdealPara` com `valorDe`, sem multiplicador de raridade).

**(d) Campos do catálogo que a build usa:** `espaco` (para achar as botas — 15 itens têm
`espaco: 'botas'`, 14 deles épico/lendário), `raridade`, `ad/ap/va/critico/rv/vida/armadura/rm` e
`efeito`. Tudo isto existe em `itens.js` (ex.: `itens.js:4-24`). **`cdr` e `regen` existem em poucos
itens**: `cdr` em 3 (`3158,3024,3171`) e `regen` em 4 (`1054,3801,3009,3083`) — o motor acrescenta-os a
5 itens à mão (`motor.js:16,17,24,25,26`: `2022,1006,4629,3108,3802`). Como `pesosItem` dá peso alto a
`cdr`/regen (`automation.js:3520-3526`), esses pesos só actuam em ~10 dos 108 itens.

**(e) O que NÃO falta:** o roster. O jogo tem **7 campeões** (`campeoes.js:7-41`; `KITS` em
`motor.js:864-895`) e a extensão deriva os 7. Um campeão novo exige kit no motor (`campeoes.js:2-3`)
e chega à extensão sozinho por `inject.js:147` — a derivação é geral.

---

## 4. VERIFICAÇÃO (comandos e resultados, nesta árvore)

- `node --check` (Node v24.8.0) nos ficheiros da extensão:
  `content.js` **rc=0**, `gui.js` **rc=0**, `automation.js` **rc=0**, `inject.js` **rc=0**,
  `background.js` **rc=0**. `manifest.json` dá rc=1 — **é JSON, não JavaScript**;
  `node --check` não é a ferramenta aplicável (o erro é `Unexpected token ':'` no campo
  `"manifest_version": 3`). `manifest.json` foi validado como JSON na instalação da extensão, não aqui.
- `bun tools/testes/run.mjs` (Bun 1.4.2, raiz `I:\!lolidle.com`): **rc=0**, **UNSTUBBED 0**,
  POPULATION 260 (251 asserções + 9 de integridade), 9 suites com **0 falhas**, INTERVALS 333
  (limitação declarada). Nota: numa execução anterior (com o `automation.js` anterior,
  sha `ec9a665e…`) esta mesma suite dava **rc=1** com 2 falhas em `interruptores` (I3:
  `rotacao.pai`; I5: contagem de filhos na árvore). O sha actual passa — **o resultado verde é do
  `automation.js@622c562c`, não meu** (este documento não alterou código).
- **NAO VERIFICADO por execução:** o sorteio de drop do jogo (§1) — o motor do jogo não é importável
  neste workspace (faltam `docs/game-src/dados-ezreal.js` & cia, `motor.js:3-8`, e `i18n/en.js`).
  Verificação feita por leitura das linhas citadas + avaliação do texto exacto de `motor.js:383-406`.
- **NAO VERIFICADO:** qual era o campeão/abate concreto do dono quando viu o Rabadon no Barão; e o
  comportamento ao vivo do Lojista/Mercado (as medições de §2.2 são do `planBag`/actores da extensão
  dentro do banco de regressão, com o DOM stubado — sem browser e sem jogo, como manda o protocolo).

### Resumo executivo (3 frases)

1. **A tabela muda com a classe, e só com a classe**: `motor.js:1151-1152` escolhe `drops` (AD) ou
   `dropsAp` (AP) conforme `kit(estado).magia`; o `3031` Gume do Infinito existe **só** no Barão AD
   (`motor.js:391`) e o `3089` Rabadon **só** no Barão AP (`motor.js:405`) — é exactamente o sintoma
   que o dono descreveu.
2. **A prioridade extrema já está implementada** (`PRIORIDADE_EXTREMA`, `automation.js:47-50`, ligada
   em `300/306/424/2029/2572/3441/4279`) e medida: `3031` e `3089` são intocáveis em qualquer
   campeão, duplicados incluídos; o que falta é a **GUI** mostrá-los (`gui.js:1521-1531` não conhece
   a tabela).
3. **A build ideal sai para os 7 campeões (5 itens cada, medido)**, mas `buildIdealPara(c)` **não é
   independente do campeão actual** — `valorPassiva` lê `META.champAtual` (`automation.js:3762-3763`)
   — e as builds colapsam em 4 perfis (o perfil `suporte` é inalcançável, `automation.js:3523`).
