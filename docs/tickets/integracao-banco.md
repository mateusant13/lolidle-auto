# INTEGRAÇÃO DO BANCO — o que falta e ONDE está (mapa exacto)

> O merge das 12 frentes foi feito ramo a ramo e o master ficou com **20 asserções vermelhas** em
> 7 suites. Cada peça existe, testada e verde, num ramo — o que falta é transplantá-la para o
> master. Este ficheiro é o mapa (levantado a 2026-10-15, com o banco a correr).
>
> **REGRA APRENDIDA (importante):** ao transplantar, levar SEMPRE as declarações de estado junto
> com as funções (`let _x = ...`, `const X = ...`) e **nunca** cortar um bloco pela "primeira
> linha `  }`" — isso trunca blocos aninhados e desequilibra o ficheiro (aconteceu 2×). Contar
> chavetas, ou transplantar função a função verificando `node --check` depois de cada uma.

## Suites vermelhas e a peça que falta (com o ramo)

| Suite | Asserção (exemplo) | Peça a transplantar | Ramo |
|---|---|---|---|
| `integracao` | `auto.eventosContadores is not a function`; whitelist sem `curvaPorNivel`/`rmMonstro`; `statsMonstro` a ignorar a curva lida | bloco consumidor (`let _estadoVivo` + `estadoVivo/eventosVivos/eventosContadores/consumirEvento`) + `carregarMeta` + `curva()` + exports | **w3-barra** |
| `numeros` | `parseNum("12.3k") === 12300`; `lerVidaHud`; `player().vidaAtual` | `SUFIXO` + `parseNum(raw,suf)` (aceitar sufixo no texto E no 2.º argumento) + `readStats` com sufixo nos grupos + `vidaAtual` no `player()` | **w3-barra** (+ w5-equipar) |
| `barrafase` | `F2: a barra de MOBS difere da de CHEFE` | `barraIdeal` com peso de fase + o campo `alvos` no kit (`aplicarKit`, linha `out[t] = {...}`) | **w3-barra** |
| `score`/`hud` | `statsDePeca`, `infoItem().stats`, rv no `scoreSet`, crit/hemorragia | `statsDePeca`+`pecaConhecida`+`infoItem`+`scoreSet`(rv) — **união** com `statsSet` do w12 (pen do kit, crit, hemorragia, `penArmadura` desestruturado no `estimarSet`) | **w9-score** + **w12-modelo** |
| `w10` | `farmarItem`, `migrarCfg`, `escolherConjunto`, duplicata de lendário com mercado saturado → PROTEGER | `farmarItem*`+`farmarItemIds`+`_farmItem`, `CFG_VER`/`MIGRACOES_CFG`/`migrarCfg`, `escolherConjunto`/`porMelhorBase`, ramo da duplicata com `mercadoSaturado()`, raridade do actor pelo CATÁLOGO, regex do Lojista com sufixo | **w10-config** |
| `w1-regioes` | `nivelMobDe is not a function`; `A4: nivelChefeDe(dragao) sem jogador = 40` | `nivelMobDe`/`nivelChefeDe`+`mediaWaveDe`+`estimarRegiao` fail-closed+`fatorDanoJogador` | **w1-regioes** |
| `fuga` | `W2/W5/W6` (motivo da fuga, `localId` com acento) | `viajarPara`+`proximoGiro`+`localId`+`_giroTent`+`VIAGEM_MAPA_MAX`/`_viagemMapaTent`/`VIAGEM_MAX_TENT` | **w4-fuga** |
| `chefe` | `B1[AD]/B1[AP]: a build IDEAL contem a 3153` | `alvoRef` (fase `null` também promove a peça de chefe) — atenção: é uma **linha dentro de `buildIdealParaFase`**, não uma função | **w11-boss** |

## O que JÁ ficou aterrado e verde nesta sessão
- `tools/sim-chefes.mjs` + `tools/motor-vivo.mjs` do **w7-sims** (lê o motor VIVO; apanhou 3
  divergências reais: CURVA sem o `ajuste`, `NIVEL_DIF` 0,15/3 → 0,35/5, `fatorDanoJogador`
  0,07 → 0,12). Suites `motor-tabelas` (54), `regras-motor` (24) e `snapshots` (18) **verdes**.
- Cofre na Fonte: `COFRE_TILES_ACIMA = 6` (a Tesoureira está em `mundo.js:20` `y: CY - 5`), com
  verificação do `#npcs` a cada tile; suite `cofre` **26/26 verde**.
- 14 suites verdes: regras, ator, barra, objetivo, equip, regioes, pontos, interruptores, cofre,
  planejar, passivas, refinar, atributos, w2-audita*.

## Como fechar (receita)
1. Por cada linha da tabela: `git show <ramo>:extension/automation.js` → extrair a peça **com as
   declarações de estado** → inserir → `node --check` → correr o banco.
2. Uma peça de cada vez. O banco leva ~40 s e diz exactamente qual asserção caiu.
3. Onde duas frentes mexeram na MESMA função (statsSet/scoreSet/estimarSet: w9 × w12), fazer a
   **união** — o w12 traz a pen do kit/crit/hemorragia, o w9 traz o rv e a separação das pens.


---

## RESULTADO DA SESSÃO DE INTEGRAÇÃO (2026-10-15, madrugada)

**Técnica que funcionou (usar sempre):** aplicar **peça a peça** com verificação automática —
extrair o bloco por **contagem de chavetas** (`{ +1 / } -1`), escrever o ficheiro, correr
`node --check` e **reverter só essa peça** se quebrar. Um script de ~40 linhas faz isso; foi o que
levou o banco de **20 → 16 falhas** sem nunca deixar o ficheiro inválido.

**Peças que aplicam LIMPO (26, validadas hoje):**
`carregarMeta`, `curva`, `barraIdeal`, `readStats`, `parseBig`, `infoItem`, `valorPassiva`,
`scoreSet`, `estimarSet`, `statsSet`, `statsDePeca`, `pecaConhecida`, `farmarItem`(+Parar/Passo/
Estado/Tenho/Ids), `escolherConjunto`, `porMelhorBase`, `nivelMobDe`, `mediaWaveDe`,
`estimarRegiao`, `viajarPara`, `proximoGiro`, `localId` + as declarações
`larvasInvoca`/`LARVAS_JANELA_MS`/`_estadoVivo`/`_eventosVivos`/`_eventosCont`/`_farmItem`/`_giroTent`/
`VIAGEM_MAPA_MAX`/`VIAGEM_MAX_TENT`/`_viagemMapaTent`/`NIVEL_DIF_FB`, e os patches: `parseNum`+`SUFIXO`+
`numDoTexto`, `readStats` com `[Vv]ida`, `player().vidaAtual`+fallback 4188, regex do Lojista com
sufixo, handler `chefeInvoca`, `rv` no `statsSet`, `crit` no `scoreSet`, duplicata de lendário com
mercado saturado → PROTEGER, raridade do actor pelo catálogo, `CAMPOS_MULT`+`penMag`, `alvos` no kit.

**Peças que QUEBRAM (não aplicar como estão — exigem leitura à mão):**
- `nivelChefeDe` do **w1-regioes**: aplicado, o `node --check` passa mas a suite w1-regioes passa de
  2 para ~14 falhas (A4/A5/A6) — a versão do ramo assume helpers/assinaturas que o master não tem.
- `hemorragia` no `estimarSet` (w12): a asserção H15 só passa com o `hemorragiaDe` + o critério
  `fracAuto` do w12 em conjunto — isolado não fecha.
- `valorEquip`/`valorVenda` do w10: fecham o P1 mas mexem em cadeias que outras suites usam; aplicar
  só depois de fechar o resto.

**FALHAS RESTANTES (16 quando o banco foi medido no melhor ponto):** H12a/H12c (crítico medido),
H15 (hemorragia), T142a (rv com V maiúsculo), R3 (fluxo do Ornn no stub), P1 (qualidade ausente),
A4/A5/A6 (w1), B1 (3153 na build ideal), e os 3 símbolos de export.


---

## CLUSTERS MEDIDOS (2026-10-15 08:25) — estado `099fc92`: 65 falhas · 14/25 verdes

| Suite | Falhas | Padrão observado |
|---|---|---|
| `w1-regioes` | 14 | `nivelChefeDe` chamado com **string** em vez de objecto (A4: `nivelChefeDe('dragao')`) — **tentei o fix (aceitar string) e o banco NÃO mudou (65→65)**, logo a causa é outra; ver a asserção exacta |
| `numeros` | 12 | `parseNum('12.3k')` → 12300; `numDoTexto` para grupos de loot |
| `hud` | 11 | `readStats` sem `cdr/critChance/critMult`; `H12a` crit no score; `H14` chefeInvoca |
| `w10` | 11 | `farmarItem*`, `migrarCfg`, `escolherConjunto`, duplicata saturada |
| `fuga` | 7 | motivo da fuga / `localId` |
| `barrafase` | 3 · `chefe` 3 · `integracao` 1 | `alvos` do kit; `NIVEL_DIF_FB`; exports |

### ARMADILHA GRAVE (3× hoje)
Substituições **multi-linha por regex/string** no `automation.js` **partem a sintaxe** (cortam blocos
aninhados). Sintoma no banco: **as falhas DESPEM** (65 → 24) e as suites verdes caem para 3 — parece
uma grande melhoria e é um ficheiro inválido. **Regra:** um patch de UMA linha de cada vez, com
`node --check` imediatamente a seguir, e **desconfiar sempre que o número desce de repente**.

### Ordem recomendada para a próxima ronda
1. `readStats` + `cdr/crit` (1 linha bem ancorada) → ataca `hud` (11).
2. `parseNum` com sufixo → ataca `numeros` (12). **Não** substituir o bloco inteiro por regex:
   trocar apenas a linha do `return` do `parseNum` para multiplicar pelo sufixo.
3. Ler a asserção A4 exacta do `w1-regioes` antes de mexer (o fix "óbvio" não pegou).


## PROGRESSO 2026-10-15 08:35 — 65 → 47 falhas (5 correcções reais)
| # | Correcção | Efeito |
|---|---|---|
| 1 | `proximoGiro` com tecto de 5 voltas (reagendava-se a cada 9 s SEM LIMITE) | tirou o **pendura** do CI (e bug real de fuga presa) |
| 2 | `parseNum` lia `"12.3k"` como 123 (ignorava o sufixo k/M do `cena.js:225`) | 65 → 53 (cluster `numeros` zerado) |
| 3 | `readStats` sem `cdr/critChance/critMult` | 53 → 52 |
| 4 | `nivelChefeDe`: `null` explícito = sem jogador (`motor.js:1134`) | 52 → 50 · **A4 zerado** |
| 5 | `estimarLuta` sem o fator de nível (`motor.js:1200-1202`, `fJ=max(0,25,1−0,12·d)`) | **50 → 47 · A5 zerado** |

Commits: `7c6f941`, `71fc8c2`, `42ec3aa`, `d646beb`, `099fc92`.

### `w10` — levantamento (11 falhas)
`farmarItemPasso`, `valorEquip`, `valorVenda` **existem mas não estavam exportados** → exportei-os e o
banco **não mudou** (47→47): os testes que os chamam falham por comportamento, não por falta de export.
E `farmarItemEstado`/`farmarItemParar`/`farmarItemTenho` **não existem** no master (estão em
`tools/_w10config.js` — transplantar). Revertido o export neutro.

### Próximos alvos
`hud` (10 — conta de kills-min H12a/H12c) · `w10` (11 — transplantar os 3 `farmarItem*` em falta) ·
`fuga` (7) · `barrafase`/`chefe` (3 cada) · `integracao` (1).


## ADENDA 08:40 — `w10` não é falta de funções
Transplantei de `tools/_w10config.js` as 3 funções que faltavam (`farmarItemEstado`, `farmarItemParar`,
`farmarItemTenho`) e exportei-as: **sintaxe OK, banco INALTERADO (46→46)**. Logo as 11 falhas do `w10`
**não são "is not a function"** — são comportamento (a lógica do `farmarItem`/`escolherConjunto`/
duplicata saturada). Revertido (não guardo alterações sem efeito medido).

**Lição:** antes de transplantar, correr o banco e **ler a mensagem exacta** da falha — se não for
"is not a function", o transplante não resolve nada.

### Progresso total: 65 → 46 falhas (6 correcções reais)
`proximoGiro` (pendura) · `parseNum` k/M · `readStats` cdr/crit · `nivelChefeDe` null · `estimarLuta`
fator de nível · `scoreSet` crítico dos autos.


## ADENDA 08:50 — o `numEcra` JÁ ESTAVA CERTO (erro meu, corrigido)
Substituí o `numEcra` (`automation.js:1452-1469`) assumindo que era o parser antigo — **sem ler o corpo
primeiro**. O banco **piorou (45 → 49)** e ao ler vi que ele **já é suffix-aware** (trata `k`/`M`, o
`9.876 / 12.3k` e o `Vale 5625…`). Revertido.

**A regra que isto confirma (já escrita e violada por mim):** *ler o alvo antes de o substituir* — o
mesmo erro que me fez criar um `nivelMobDe` duplicado e partir a sintaxe 3 vezes.

**Onde está o N2 então:** o `lerVidaHud` (linha 1488) **tem** a regex certa e o `numEcra` **lê** o
sufixo — falta a **ligação**: o `player()` tem de expor `vida = max` e `vidaAtual = cur` **do
`lerVidaHud()`** (o teste usa `player().vida` / `player().vidaAtual`). Procurar onde o `player()`
monta o objecto e ver se usa `lerVidaHud()` ou outro caminho.


## ADENDA 09:00 — `fuga` W2/W5: a fuga não DISPARA no mundo do stub
O `logEvent` já guarda `type` (linha 626) e acrescentei `regiaoMata`/`lutaPerdida` ao log — o banco
**não mudou (35)**, logo o problema é **antes**: no mundo do teste, `checarChefeFatal` **não chega a
fugir**. A cadeia é:
```
morre = !!(r && r.risco && r.risco.morre)      // r = agregar().find(region) — no stub pode ser null
perde = !!(est && est.ganha === false)          // est = estimarLuta(idReg)
foge  = fatalVivo || morre || (perde && !cobrem)
```
**Próximo passo:** instrumentar (`logEvent('dbg:fuga', { morre, perde, cobrem, idReg, temR: !!r, temEst: !!est })`
antes do `if (!foge) return;`) e ler no banco QUAL dos três é falso. É 1 linha e mata a dúvida.


## ADENDA 09:10 — `hud` H12a: a API não é o problema, são os VALORES
`fracAuto` (6538) e `fracHabs` (6551) existem mas **não estavam exportadas**; exportei-as →
**banco inalterado (34)**. Logo o H12a falha porque a **razão** `comCrit/semCrit` não bate com
`1 + fracAuto()*(1,2625-1)`, não por falta de API. O teste monta `#st-crit = 35%` e `#st-critx = 1,75`
(espera 0,35 x 0,75 = 0,2625). O meu `fCrit` (6606-6607) usa exactamente isso — **verificar se o
`scoreSet` aplica o `fCrit` numa parcela que depois é sobrescrita**, ou se o `fracAuto()` (função, 6551)
devolve um valor diferente do `1 - fracHabs` local (6594) usado no `fCrit`.

**Método para a próxima:** comparar os dois valores com um teste rápido
(`Math.abs(auto.fracAuto() - (1 - <fracHabs do scoreSet>))`) antes de mexer na fórmula.

### Total: 65 → 34 falhas (12 correcções reais)


## ADENDA 09:25 — `hud` H12c: tentado e NÃO é aí
Tentei (ambos revertidos por não mudarem o banco):
1. `cfg.medicaoJogo = { tem: true, … }` (linha 1426) — o teste lê `jogo.tem`.
2. `lerAnaliseJogo`: `if (out.xpH != null || out.ouroH != null || out.janela) out.tem = true;` — o
   `vazio.tem = false` nunca subia.
**Banco inalterado (33) nos dois.** Logo o H12c **não** lê estes dois caminhos: o teste chama outra
função (ver `hud.test.mjs` à volta da linha 430 — o objecto `cJogo` vem de uma chamada própria).
**Próximo:** ler as linhas 425-435 do teste e ver **qual função** produz `cJogo`, em vez de adivinhar.


## MAPA COMPLETO DAS 33 FALHAS (2026-10-15 09:10, com mensagem exacta)
| Suite | N | Falhas |
|---|---|---|
| `hud` | 8 | H12c (killsMin teórico ao lado do aplicado) · **H14 ×4: larvas do `chefeInvoca` na contagem** |
| `w1-regioes` | 5 | A6 ×4 (papel: `avaliar` tem de DEVOLVER o fator) · `mediaWaveDe is not a function` |
| `fuga` | 5 | W5/W7 ×3 (log do giro) · **W9: `viajarPara` tem de devolver RESULTADO** (`r.ok`) |
| `w10` | 4 | L4 ×3 (lendário em `regras.protegidos`, sem clique) · `farmarItemIds is not defined` |
| `barrafase` | 3 | F1/F2: `alvos` do kit na barra de mobs vs chefe |
| `chefe` | 3 | B1 (3153 na build ideal) · `auto.NIVEL_DIF_FB` |
| `integracao` | 1 | `_eventosCont is not defined` |
| `numeros` | 1 | N2: HUD vazio → fallback 4188 |
| `score` | 1 | T142a: `Roubo de Vida` (V maiúsculo) |
| `refinar` | 1 | `medido is not defined` |
| `atributos` | 1 | `auto.recomendarAtributos` |

### LIÇÃO NOVA (importante)
**Exportar uma função NÃO é ganho grátis.** Exportei `mediaWaveDe`, `recomendarAtributos`,
`NIVEL_DIF_FB`, `farmarItem*`, `fracAuto`, `fracHabs` → o banco **PIOROU (33 → 40)**: os testes
passam a **correr** essas funções e falham em asserções **reais**. O número sobe, mas o código está
**mais correcto**. Para o banco ficar verde é preciso **corrigir o comportamento**, não só expor a API.
Revertido (o objectivo é verde, não é número).


## MAPA DAS 21 FALHAS (2026-10-15 09:30) — com a causa exacta
| Suite | N | Causa (mensagem) |
|---|---|---|
| `w10` | 4 | L4 ×3 (lendário tem de ficar em `regras.protegidos`, sem clique) · `farmarItemIds is not defined` |
| `barrafase` | 3 | F1/F2: `alvos` do kit na barra de mobs vs chefe |
| `fuga` | 3 | W5/W7: o giro tem de REGISTAR a espera e o contador |
| `chefe` | 3 | B1 ×2 (3153 na build ideal) · `auto.NIVEL_DIF_FB` |
| `hud` | 2 | H12c (killsMin teórico) · `aL.larvasInvoca is not a function` (**falta EXPORTAR**) |
| `integracao` | 1 | `_eventosCont is not defined` |
| `numeros` | 1 | N2: HUD vazio → fallback 4188 |
| `score` | 1 | T142a: `Roubo de Vida` (mede o `readStats`) |
| `refinar` | 1 | `medido is not defined` |
| `atributos` | 1 | `auto.recomendarAtributos` |
| `w1-regioes` | 1 | `auto.mediaWaveDe` |

### CONFIRMADO (2×): exportar faz o número SUBIR
Exportar `larvasInvoca` (que está definida e é chamada pelo teste) levou o banco de **21 → 27**: a suite
`hud` passa a **correr** e falha em asserções reais que antes nem chegavam a executar.
**Decisão:** manter o estado com o número menor (21) **e registar** que a API pública está incompleta —
o verde exige corrigir o comportamento dessas funções, não só expô-las. Quem for fechar isto: exportar
`larvasInvoca`, `mediaWaveDe`, `recomendarAtributos`, `NIVEL_DIF_FB`, `farmarItemIds` **e** corrigir
as asserções que aparecerem (é trabalho de comportamento, não de porta).


## ADENDA 09:45 — `w10` L4: a variável da mochila NÃO é `bag`
Tentei a 7.ª regra no `planBag` (lendário duplicado + mercado saturado → `regras.protegidos`) usando
`bag.filter(...)` para contar as ocorrências da mesma base → **`ReferenceError: bag is not defined`** e
o banco piorou (16 → 17). Revertido.

**O que se sabe agora (para não repetir):**
- `planBag(bag, marketCount, marketCap)` — o parâmetro chama-se `bag`, mas **dentro do laço** (linha
  ~3056) o item vem de outra variável (o laço itera sobre outra lista) — é preciso LER as linhas
  3030-3056 para ver o nome real da colecção.
- As 6 regras actuais estão em 3063-3092; a nova entra **depois** da do lendário-da-build (3069) para
  não roubar o motivo dela (o banco fixa essa string).
- Erros que o banco reporta neste estado: `bag is not defined` (a minha), `medido is not defined` e
  `_farmItem is not defined` (pré-existentes, a atacar).


## ADENDA 10:00 — `medido`: o problema é de ESCOPO, e mexer nele muda comportamento
Estado exacto (levantado agora):
- **declarado** dentro de `precisaRefino()` (linha 3215-3217);
- **usado** em `{ essenciais, fonteEssenciais, medido, divergenciaMedido }` (5647) e em
  `(medido && medido.xpMin != null)` (7265-7266) — **duas outras funções**.

Movi a declaração para o nível do módulo (e tirei a local): **o ReferenceError desapareceu, mas o banco
PIORROU (16 → 23)** — as três funções passam a **partilhar** o estado e as asserções mudam de resultado.
Revertido.

**Conclusão para quem pegar nisto:** não é só mover a declaração — é decidir **que estado cada função
deve ver** (provavelmente cada uma precisa do SEU `medido`, ou o módulo precisa de o repor entre
chamadas). É trabalho de desenho, não de uma linha. O banco actual (16 falhas) **não reporta este
ReferenceError** porque a suite que o exercita falha antes — está latente.


## ADENDA 10:15 — `w10` L4: o teste NÃO usa duplicados
Li o teste (`w10.test.mjs:187-195`): chama `await saturarMercado(w.auto, w.m)`, monta a mochila com
**UM** lendário (`9500~C`) e **UM** épico (`4001~C`), e verifica:
```
L4: o lendario NAO recebeu clique nenhum
L4: o lendario nao esta em epicosVendidos
L4: o lendario esta em regras.protegidos
```
Ou seja: **não é duplicado** — é o **mercado saturado** que impede o lendário de ir ao Lojista.
Tentei a regra sem a condição de duplicado (`lend && mercadoSaturado().sat`) → **banco inalterado (16)**.

**Conclusão:** ou o `mercadoSaturado()` no mundo do teste não reporta `sat` (ver `saturarMercado` no
`w10.test.mjs`), ou as três asserções medem o **ACTOR** (a função que clica), não o `planBag`.
Próximo passo exacto: **ler `saturarMercado`** e a asserção completa (que objecto expõe
`epicosVendidos`) — é 1 leitura, não um bisect.
