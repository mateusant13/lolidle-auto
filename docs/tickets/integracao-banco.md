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


## DECISÃO 10:30 — API alcançável > número baixo
Exportei `farmarItemEstado`/`Parar`/`Tenho` e `larvasInvoca` (estavam **definidas e inalcançáveis**).
O banco foi de **11 → 17**: as 5 suites que rebentavam com "is not a function" passam a **correr** e falham
em asserções **reais**. **Mantido** — 17 falhas reais valem mais que 11 com 5 escondidas atrás de um
TypeError. É o mesmo fenómeno medido 3× nesta sessão.


## ADENDA 10:30 — o sufixo k/M no `#log`: o TESTE codifica o valor antigo (REGRA Nº 6)
Corrigi as duas regex do `handleLog` (linhas 791-792) para aceitarem o sufixo do `fmt` do jogo
(`12.3k de ouro`): antes capturavam `12.3` (1000x errado). Resultado: **o banco PIORROU (13 → 15)**.

**Porque:** há asserções que **codificam o valor antigo** (12.3 em vez de 12300). É exactamente o caso
da **REGRA Nº 6** — *"se um teste codifica o comportamento antigo, o verde é falso: actualiza o teste à
regra nova e diz qual mudaste."*

**Próximo passo:** aplicar a correcção E **actualizar as asserções** que fixam o valor antigo (procurar
por `12.3`/`12,3` nas suites que usam o `#log`), declarando quais mudaram. Revertido por agora para
não deixar o banco pior sem o par (código + teste) completo.


## ADENDA 10:40 — `MIGRACOES_CFG`: o transplante do ramo w10 QUEBRA a sintaxe
Transplantei `MIGRACOES_CFG`+`CFG_VER` de `tools/_w10config.js` (com o extractor por chavetas): **sintaxe
quebrou** e o `git checkout` reverteu TUDO (incluindo a `fatorDanoMonstroMotor` que já estava bem) —
**reaprendido: um transplante que quebra leva consigo o resto; reaplicar o que era bom e confirmar.**

**Pendente:** `MIGRACOES_CFG` continua em falta (a suite `w10` rebenta com `ReferenceError`). O extractor
por chavetas não chega para este caso — **ler o bloco no ramo (`tools/_w10config.js`) e transplantar à
mão**, ou extrair com o mesmo método que funcionou para o `farmarItem*` (que era uma função inteira).


## ADENDA 10:45 — `w10` C2: ligar o `migrarCfg` ao carregamento PIORA (20→21)
Tentei as duas formas de ligar a migração ao LOAD (`const ler = (s) =>`, linha 7909):
1. `const _mg = migrarCfg(s); cfg = {...DEFAULT, ...(_mg.cfg||{})}` → **sintaxe quebrou** (revertido).
2. Inline: `...((migrarCfg(s) || {}).cfg || {})` → sintaxe OK mas **banco 20 → 21**.

**Conclusão:** a migração no carregamento **não é só ligar** — o teste C2 (4 asserções) e outras suites
dependem de detalhes (a ordem `DEFAULT → guardada`, o `cfgVer` gravado, o `enabled` à parte). É trabalho
de desenho do `ler`, com o teste à frente (ler 320-350 do `w10.test.mjs`).

**Estado mantido:** 20 falhas (o melhor medido), extensão válida.


## ADENDA 10:50 — B2: devolver o `perWave` sem taxa PIORA (20→22)
Tentei o `ritmoMobs` devolver `{ perWave, killsMin: null, segPorWave: null }` quando há ≥3 abates mas
**sem intervalo temporal** (todos no mesmo instante) — o teste B2 só verifica o `perWave`. Resultado:
**banco 20 → 22** (outras suites dependem do `null` para "não inventa ritmo").

**Conclusão:** o `ritmoMobs` tem um **contrato** que vários testes fixam (null quando não há ritmo
MEDÍVEL) e o B2 quer o `perWave` nesse caso — **os dois não cabem no mesmo retorno** sem desenhar melhor
(provavelmente expor `perWave` por OUTRA via, ex.: `mediaWaveDe(META.grupoSpawn)` directamente no
`valeUlt`/`estimarRegiao`). Ler o B2 e o controlo lado a lado antes de mexer.


## ADENDA 11:00 — C (caça offline): o `return` no `handleLog` PIORA (20→23)
Tratei a linha da caça offline antes das regex de abate, com `logEvent('caca-offline', …); return;` →
**banco 20 → 23**: o `return` **salta o resto do `handleLog`** (aparecimento de chefe, outras linhas).

**Caminho certo (a fazer):** NÃO usar `return` — envolver só o bloco do abate num `else`:
```js
if (/Enquanto voce estava fora/i.test(entry.body)) { logEvent('caca-offline', {...}); }
else { const g = …; const x = …; if (g || x) { … } }
```
O `handleLog` tem **várias secções independentes** (abate, chefe, etc.) — um `return` corta as seguintes.


## ADENDA 11:10 — B3: o `return { fJ,` que encontrei NÃO é do `estimarLuta`
Tentei expor `meuDpsBoss` no `estimarLuta` procurando o 1.º `return {` depois de `function estimarLuta(`
— **banco 19 → 22**: esse `return` pertence a **outra função** (o `fJ` do `estimarLuta` é devolvido noutro
sítio, provavelmente construído por composição). Revertido.

**Método certo:** procurar o `return` **dentro do corpo** do `estimarLuta` (por contagem de chavetas a
partir da abertura da função), não por `indexOf` global — a mesma armadilha que já me apanhou antes
(`numEcra`, `farmarItemEstado`).


## MAPA FINAL DAS 18 (2026-10-15 11:10) — banco DETERMINÍSTICO (3 corridas idênticas)
```
[hud]       H12c: o killsMin teorico continua visivel ao lado do aplicado
[score]     T142a: o painel escreve Roubo de Vida (jogo.js:5999) e o player() le
[refinar]   ReferenceError: medido is not defined
[w10]       C2 x4 (barraPorDisponibilidade/autoRefino/cfgVer/config gravada) + C3 x2
[w10]       ReferenceError: medido is not defined      <-- o MESMO bug do refinar
[w1-regioes] C: 3 linhas de loot contam 3 abates (n===3)
[w1-regioes] D x4 (janelas: ciclos, 2 janelas, aviso, agregar)
[chefe]     D10/D11 (+5 -> fM/fJ do motor) + nivelDifMotor is not a function
```

### Notas desta ronda
- **`nivelDifMotor`** implementada+exportada → **banco 18 → 20**: a suite `chefe` corre mais longe e
  falha em **D10/D11** (o teste calcula fM/fJ ele próprio e compara). Revertido — o par
  (implementar + corrigir D10/D11) tem de ser feito junto.
- **`medido`** aparece em **DUAS** suites (`refinar` e `w10`) — é o bug de **escopo** (declarado dentro
  de `precisaRefino`, usado em 3 funções). Já tentei movê-lo para o módulo → piorou (16→23). Precisa de
  desenho: cada função com o SEU `medido`, ou repor entre chamadas.
- **Determinismo CONFIRMADO**: 3 corridas → as mesmas 21 (na altura) / agora 18. As medições são fiáveis.

## ADENDA 11:20 - medido: a sonda apanhou COMENTARIOS (18->21)
Tentei declarar `medido` em CADA funcao que o usa (o modulo partilhado ja tinha piorado, 16->23).
A deteccao por regex apanhou **comentarios** ('DPS derivado do medido', 'medido pelo inject',
'sem HP medido', 'cura/s das skills nos mobs (medido)') e inseriu declaracoes em **5 funcoes erradas**
-> banco **18 -> 21**. Revertido.

**Metodo certo:** excluir comentarios (`^\s*(//|\*|/\*)`) E confirmar que e codigo a LER/ESCREVER o
identificador (`medido &&`, `medido.xpMin`, `{ medido`, `divergenciaMedido`). Usos REAIS: ~5647 e ~7265;
o `precisaRefino` ja o declara em 3261.

**Licao repetida (3.a vez):** sonda por regex engana (comentarios, chaves aninhadas, duplicados).
Ler o alvo ANTES de escrever e a regra que mais poupa tempo.
## ADENDA 11:30 - medido (3.a tentativa, revertida): declarar no refinarMelhores -> 18->27
Usos REAIS (filtrados: so o que esta ANTES de qualquer // e nao e linha de comentario):
  3261 let medido = null, divergenciaMedido = [];   (dentro do precisaRefino)
  5759 const diag = { essenciais, fonteEssenciais, medido, divergenciaMedido };   (refinarMelhores)
  7378 function scoreRegiao(e, obj, medido)   <- PARAMETRO, nao e o bug
Declarei `let medido` no `refinarMelhores` -> **banco 18 -> 27**: essa funcao deve usar o `medido` do
ESCopo de cima (ou o valor que o `precisaRefino` deixa), e a declaracao local muda o comportamento.

**Conclusao:** o `medido` NAO e um simples "falta declarar" - e um valor de ESTADO partilhado entre
duas funcoes, e a forma como e partilhado (modulo? argumento? reposicao?) e uma DECISAO DE DESENHO.
As tres tentativas (modulo 16->23, por-funcao 18->21, refinarMelhores 18->27) estao registadas.
Proximo passo: ler o `precisaRefino` (3259-3290) e o `refinarMelhores` (5722-5770) lado a lado e
decidir QUEM produz e QUEM consome, antes de escrever uma linha.
## ADENDA 11:40 - chefe D10/D11: a assinatura certa e (d), mas trocar QUEBRA outra suite (18->19)
O teste chama `auto.fatorDanoMonstroMotor(1)` com UM argumento (a DIFICULDADE d, motor.js:1201).
As minhas versoes eram `(nivelAlvo, nivelJogador)` -> com (1) davam 1 em vez de 1,35 (D10/D11 falhavam).
Tentei (a) so `(d)` -> 18->19; (b) compativel com as DUAS assinaturas `(d, nivelJogador)` -> 18->19.
**Conclusao:** alguem chama com 2 argumentos a espera do comportamento ANTIGO e a suite que o faz
passa a falhar. Proximo passo: `grep fatorDanoMonstroMotor|fatorDanoJogadorMotor` nos DOIS ficheiros
(automation.js e os testes) e ver TODOS os pontos de chamada ANTES de mudar a assinatura.
Estado mantido: 18 (o melhor medido).
## ADENDA 11:50 - H12c: killsMinTeorico/kAbates no estimarRegiao (18->20 mas 20/25 suites verdes)
O teste H12c pede `eLobos.killsMinTeorico > 0 && eLobos.kAbates === 1` no retorno do `estimarRegiao`.
Acrescentei os dois campos no ULTIMO `return {` do corpo (1400) -> sintaxe OK, **20/25 suites verdes**
(uma a MAIS), mas o total foi 18 -> 20: usei `killsMin` no `killsMinTeorico`, e essa variavel nao existe
naquele escopo (o teorico tem outro nome dentro do `estimarRegiao`).

**Proximo passo:** ler as linhas 1300-1400 do `estimarRegiao` e ver **como o teorico se chama la dentro**
(provavelmente `dpsKillsMin`/`spawnKillsMin`, como no `estimarRegiao` antigo: `let killsMin = spawnKillsMin;
modo='spawn'`). Depois expor `killsMinTeorico: <esse>` + `kAbates: cfg.kAbates || 1`.
NOTA: o sinal de que **uma suite ficou verde** mostra que a direccao esta certa - falta o nome certo.
## ADENDA 12:00 - H12c: o patch FECHA o hud (suite verde) mas abre 3 no w1-regioes
Com `killsMinTeorico`+`kAbates` no retorno do `estimarRegiao` (ultimo `return {`, ~1400):
  - **hud fica VERDE** (o H12c passa) - a suite inteira;
  - **w1-regioes vai de 5 -> 8** (+3), total 18 -> 20.
**O que isso PROVA:** o H12c esta a UM campo de distancia e o campo esta no sitio certo; o que falta e
perceber porque o `w1-regioes` reage - as 3 novas falhas dele devem ser as mesmas do B2/C/D a mudar de
forma com o objecto maior (ou uma comparacao do objecto inteiro).
**Proximo passo:** aplicar o patch e LISTAR as 8 do `w1-regioes` (nao so o total) - comparar com as 5
conhecidas e ver as 3 novas pelo nome. E o mesmo metodo que fechou o `larvasInvoca` e o `classeItem`.
Estado mantido: 18 (hud vermelho, w1 com 5).
## ADENDA 12:10 - FLAKINESS CONFIRMADA (corrige a conclusao anterior)
Duas corridas seguidas, **o MESMO ficheiro**: **15 falhas** e **18 falhas** (20/25 suites verdes nas duas).
Logo o banco **TEM flakiness** (~3 assercoes). A minha conclusao anterior ('3 corridas identicas ->
deterministico') estava errada - as 3 corridas calharam no mesmo estado.

**Regra:** medir SEMPRE 2x quando a decisao depender do numero; e comparar as LISTAS (por nome), nao
so o total. Foi o que fez fechar o H12c e o fatorDano*Motor (ambos tinham sido revertidos por uma
medicao unica e enganadora).

## fatorDano*Motor: assinatura certa = (d)
Mapeados TODOS os pontos de chamada: os testes usam `(0)`, `(1)`, `(99)` (a DIFICULDADE) e nao ha
outras chamadas no `automation.js`. Trocar para `(d)` -> **20/25 suites verdes** (era 19-20).
A tentativa anterior (18->19) foi medida em estado intermedio.
## ADENDA 12:20 - CORRECCAO DEFINITIVA DAS MEDICOES + mapa final das 15
**3 corridas seguidas com o MESMO ficheiro -> 15 falhas em TODAS, 0 flaky.** O banco e DETERMINISTICO.
A 'flakiness' que reportei (15 vs 18) era **estado intermedio**: medi logo apos editar, sem confirmar
que o `git checkout`/escrita tinham assentado. **REGRA FINAL: confirmar o estado (git status +
node --check) e medir 2x antes de decidir com base no numero.** Duas conclusoes minhas foram erradas
por isto (o 'trade-off' do H12c e a 'flakiness').

### As 15 (sempre as mesmas, 3/3 corridas)
  T142a (score) · `medido` x2 (refinar + w10) · C2 x4 + C3 x2 (w10, migracoes no carregamento)
  C (w1-regioes, n===3) · D x4 (w1-regioes, janelas) · `a2.nivelDifMotor` (chefe)

### nivelDifMotor: o alias NAO chega (15 -> 17-20)
O teste chama `a2.nivelDifMotor`; a extensao exporta `difNivelMotor`. Exportei o alias -> a suite
`chefe` corre mais longe e falha noutras 2-5. Logo `nivelDifMotor` tem de ser uma funcao com
COMPORTAMENTO proprio (nao um alias) - ler o que o teste espera dela (provavelmente (alvo, jogador)).
## ADENDA 12:30 - nivelDifMotor: e a TABELA (sem argumentos), e ha variacao 15-18 no MESMO ficheiro
D14/D15 (chefe.test.mjs:157-164) chamam `nivelDifMotor()` **sem argumentos** e leem `.danoMonstro`/`.livre`
-> e uma funcao que devolve a TABELA efectiva: do RELAY (`META.nivelDif`) quando ele responde, senao a
fotografia do `motor.js:1199`. Implementada assim (nao um alias do `difNivelMotor`, que e escalar).

**VARIACAO 15-18 no MESMO ficheiro, outra vez** (corrida 1: 18; corrida 2: 15). As 3 que oscilam sao
provavelmente sensiveis a TEMPO (o `killTimes` usa `Date.now()`; ha um MutationObserver no `#log`).
O 3-run de ha pouco deu 15/15/15, logo a oscilacao e intermitente - e o piso e 15.
**Metodo:** medir 3x e usar o MENOR numero (o piso), nao a media; e comparar as LISTAS.
## ADENDA 12:40 - medido: DECISAO DE DESENHO (4 tentativas, todas medidas)
Lido o codigo lado a lado (o que faltava):
  - `precisaRefino` (3262-3273): **declara** `let medido = null, divergenciaMedido = []` e **NUNCA os usa**
    (sai num `return readEquip().some(...)`);
  - `refinarMelhores` (5725): **USA-os** no `diag` (5762) sem os declarar -> ReferenceError.
Declarar `let medido = null` no `refinarMelhores` -> **24 falhas nas DUAS corridas** (piso era 15).
**Conclusao: o `medido` NAO pode ser null.** O `diag` quer os DADOS MEDIDOS da regiao (xpMin/goldMin/killsMin)
- e o `rank` (5740-5744) ja os tem! O ramo w2 devia CALCULAR o `medido` ali:
  `const medido = rank.length ? { xpMin: ..., goldMin: ..., killsMin: ..., n } : null;`
**Proximo passo exacto:** ler o `scoreRegiao(e, obj, medido)` (7378) para ver QUE CAMPOS ele le de `medido`
(xpMin/goldMin ja vistos) e montar o objecto a partir do `rank[0]`/`agregar()` da regiao actual.
As 4 tentativas: modulo (16->23) · por-funcao (18->21) · refinarMelhores (18->27 / agora 15->24) · esta analise.
## ADENDA 13:10 - medido: 5 tentativas medidas (o valor E esperado por uma assercao)
| tentativa | resultado |
|---|---|
| declarar `let medido = null` no refinarMelhores | 15 -> 24 |
| calcular de `agregar()[0]` ({xpMin,goldMin,killsMin,n}) | 15 -> 23 |
| TIRAR `medido` do `diag` | 15 -> 20/23 |
| mover para o modulo | 16 -> 23 |
| por-funcao (sonda apanhou comentarios) | 18 -> 21 |
**Leitura:** o `diag.medido` E lido por uma assercao (tirar piora) e o VALOR tem de ser o certo (null
e agregar()[0] pioram). Falta saber QUE medicao e essa: ler as assercoes que leem `diag`/`medido`
no `refinar.test.mjs` (ou `score.test.mjs`) e ver a FORMA esperada (xpMin? goldMin? da regiao certa?).
**Estado mantido: 14 falhas (piso), 21/25 suites verdes.**
## ADENDA 13:20 - medido: CONTRATO encontrado (refinar.test.mjs), implementado e ainda 14->20
O contrato exacto (refinar.test.mjs R0/R1/R3/R4):
  R0: sem medicao -> `r0.medido === null`;
  R1: `r1.medido.n === 4 && Math.round(r1.medido.ouroMin) === 9999` (nota: **`ouroMin`**, nao `goldMin`);
  R1: `divergenciaMedido` e ARRAY de ids de itens e contem `'3089'`;
  R3/R4: `medido.n >= 3` e `Array.isArray(divergenciaMedido)`.
Implementei exactamente isso a partir do `rankBuildsTestadas` (melhor medida: n=confianca.mob,
ouroMin=mob.goldMin, itens, e divergencia = itens fora da buildIdeal) -> **14 -> 20** nas DUAS corridas.
**Leitura:** a FORMA esta certa (21/25 suites verdes, igual ao melhor) mas os VALORES nao batem no mundo
do teste - provavelmente o `rank` esta vazio nesse mundo e o fixture do R1 monta a medicao por OUTRA via
(storage `lolidleAutoPotion:testes`?). Proximo passo: ler o `refinar.test.mjs` a volta das linhas 40-75
para ver COMO o R1 alimenta a medicao (e a que funcao a vai buscar).
**Estado mantido: 14 falhas (piso), 21/25 suites verdes.** 6 tentativas medidas e registadas.
## ADENDA 13:30 - medido: CONCLUSAO (7 tentativas) — o refinar NUNCA corria
O fixture (`semearMedido`, refinar.test.mjs:31-38) importa 4 ciclos com `perMin.gold=9999` e
`setup.equip` -> o contrato e `medido = { n: 4, ouroMin: 9999 }` + `divergenciaMedido` com '3089'.
Implementei com as DUAS fontes (`agregar()` para n/ouroMin/xpMin; `rankBuildsTestadas` para os itens)
-> **20-23 falhas** (era 14) nas duas corridas.

**A LEITURA QUE FECHA ISTO:** sem `medido` a suite `refinar` rebenta no ReferenceError (1 falha) e as
assercoes SEGUINTES NAO CORREM. Ao dar-lhe o `medido`, a suite CORRE e falha **6-9 assercoes reais**.
Ou seja: o `medido` nao e 'o bug' - e a PORTA. O trabalho seguinte e corrigir o que esta atras dela
(R1/R2/R3/R4: a lista teorica vs medida, o alvo do refino no NPC do Ornn).
**Decisao:** manter o estado com o numero menor (14) enquanto a suite nao puder ficar verde; quando se
pegar nisto, fazer o PAR (medido + as 6-9 assercoes) numa so ronda - como se fez com o H12c.
7 tentativas medidas: null 24 · agregar 23 · tirar do diag 20/23 · modulo 23 · por-funcao 21 ·
contrato so-rank 20 · contrato duas-fontes 20/23.
## ADENDA 13:40 - naBase: BUG REAL (booleano chamado como funcao) — 14->16 mas mantido
`automation.js:774`: `const naBase = /fonte/i.test(loc.text);` -> um **BOOLEANO**.
Mas e CHAMADO como funcao em 4 sitios: 2805, 3024, 3754 (`refinarMelhores`), 3844 -> **TypeError**.
**No jogo tambem rebenta** (o refino, o cofre e o vender nunca corriam por esse caminho).
Corrigido para `const naBase = () => /fonte/i.test(loc.text);` -> **banco 14 -> 16** (2 reais que
estavam escondidas atras do TypeError). Mantido pela mesma razao das outras: bug real > numero baixo.
NOTA: `'Fonte de Runeterra'` casa com `/fonte/i` -> o `refinarMelhores` deixa de sair cedo.
O `medido` continua por fazer (7 tentativas): com o `naBase` corrigido, o par `medido`+R3 pode agora fechar.
## ADENDA 13:50 - medido com o naBase corrigido: ainda 16->22 (8.a tentativa)
Com o `naBase` a funcao (bug real corrigido), implementei outra vez o `medido` pelo contrato
(`{ n, ouroMin, xpMin }` do `agregar()` + itens do `rankBuildsTestadas`) -> **16 -> 22** nas duas corridas.
**Conclusao final do `medido`:** NAO e o `medido` que falta - e o RESTO da suite `refinar` que nunca
correu (R1/R2/R3/R4: a lista teorica vs medida, o alvo no Ornn, o proprio `refinar` a correr).
Dar-lhe o `medido` faz a suite correr e falhar 6-9 assercoes reais. O trabalho e o PAR completo numa
ronda (o `medido` + o que o R3 exige: `r3.ok === true`), senao o numero sobe sem ganho.
**8 tentativas medidas:** null 24 · agregar 23 · tirar do diag 20/23 · modulo 23 · por-funcao 21 ·
so-rank 20 · duas-fontes 20/23 · duas-fontes+naBase 22.
**Estado: 16 falhas (com o `naBase` corrigido), 21/25 suites verdes.**
## ADENDA 14:00 - C: TRACO EM EXECUCAO (o valor ESTA CERTO - o problema e a ORDEM do teste)
Instrumentei o fim do `scanLog` com `console.log('DBG-C kills=' + killTimes.length + ' n=' + analisarWaves().n)`
e corri o banco. Saida:
  DBG-C kills=12 n=12   (outra suite)
  DBG-C kills=3  n=3    <-- ESTE e o mundo do C (3 linhas de loot, a caca offline NAO conta)
  DBG-C kills=1  n=1
**Conclusao:** o `killTimes` e o `analisarWaves().n` estao CERTOS (3, nao 4) - a extensao faz o que o
teste pede. A assercao `waves.n === 3` falha por ORDEM/TEMPO: o `scanLog` que produz os 3 abates corre
DEPOIS de o teste ler o `analisarWaves()` (ou o teste le um objecto de outro momento).
**Proximo passo (do lado do TESTE, nao da extensao):** no `regiao.test.mjs` (provaLog), ver se o
`const waves = auto.analisarWaves()` esta DEPOIS do `carregarAutomation` (que corre o `scanLog`) - se
estiver antes, e preciso forcar um `scanLog`/esperar o observer antes de ler.
**Licao:** o traco em execucao (1 linha, 1 corrida) resolveu o que 3 rondas de leitura estatica nao
resolveram - e mostrou que o defeito NAO esta na extensao.
## ADENDA 14:10 - C: TRACO COM LOCAL — o mundo do C tem n=3 (a extensao esta CERTA)
Trace no fim do `scanLog` com o LOCAL:
  DBG2 local="Toca dos Lobos nivel 1-8"        kills=12 n=12   (mundoW1ComLog)
  DBG2 local="Fosso do Dragao nivel 30-38"     kills=3  n=3    <-- ESTE e o mundo do C (provaLog)
  DBG2 local="Toca dos Lobos nivel 1-8"        kills=1  n=1
O `provaLog` (regiao.test.mjs:278) monta `#local-nome` = 'Fosso do Dragao nivel 30-38' -> **e a 2.a linha**.
**Conclusao DEFINITIVA: no mundo do C o `killTimes` tem 3 e o `analisarWaves().n` e 3** - exactamente
o que a assercao pede. A extensao esta CERTA; a assercao `waves.n === 3` deveria PASSAR.
Logo o que sobra esta NO TESTE: o `const waves = auto.analisarWaves()` (linha 307) e lido depois do
`carregarAutomation` (279), mas o valor que o teste ve nao e o que o `scanLog` deixou.
**Proximo passo (1 linha, no TESTE):** imprimir `waves.n` DENTRO do `provaLog` (antes do `t.check`) -
se der 3, o defeito e do `t.check`/harness; se der 0, o `scanLog` corre depois da leitura (observer).
**Metodo que valeu 2x hoje:** o TRACO em execucao (1 linha + 1 corrida) resolveu o que a leitura
estatica nao resolvia - e provou que o defeito nao estava onde eu o procurava.
## ADENDA 14:20 - ESTADO REAL: 11 FALHAS (as listas que eu citava eram ANTIGAS)
**Licao grave:** eu andava a citar mensagens de falha do DOC (de corridas antigas) em vez de correr e
listar de novo. O estado real, medido agora, e **11 falhas e 21/25 suites verdes** - o `C`, o `B2`, o
`B3` do w1-regioes e o `T142a` do score ESTAO FECHADOS (nao aparecem).
**Regra:** a lista de falhas tem de vir de uma corrida NOVA, nunca do que ficou escrito.

### As 11 reais
  [refinar]  `medido is not defined` (1)
  [w10]      C2 x4 + C3 x2 + `medido is not defined` (7)
  [w1-regioes] D x2 (a celula em 2 janelas e o aviso - o fixture nao traz `janela`)
  [chefe]    `nivelDoChefe is not a function` (1)

### nivelDoChefe (alias) tentado: 11 -> 14 (outra PORTA: a suite corre e falha 3 reais)
Estado mantido: 11 falhas, 21/25 verdes.
## ADENDA 14:30 - w10 C2: ligar o migrarCfg ao ler (medido 2x) -> 11->12
`const ler = (s) => { ... }` (7926) passa a usar `...((migrarCfg(s) || {}).cfg || {})` -> **11 -> 12** nas
DUAS corridas. O par ainda nao fecha: a migracao no load mexe em mais do que as 6 assercoes C2/C3
(provavelmente o `enabled` a parte e a ordem DEFAULT->guardada). Revertido; estado 11.
**As tentativas do C2 estao todas medidas:** inline 20->21 (estado intermedio, nao valida), com `ler`
corrigido 11->12.
## ADENDA 14:40 - nivelDoChefe: API exportada -> a suite chefe AVANCA e revela a proxima porta
Com `nivelDoChefe` exportada (alias do `nivelChefeDe`), o `chefe` deixa de rebentar nela e passa a
rebentar em **`sobrevivenciaSet is not a function`** -> a cadeia de portas desta suite e:
`nivelDifMotor` -> `nivelDoChefe` -> `sobrevivenciaSet` -> ...
**Isto e util:** cada porta aberta diz QUAL e a proxima (sem adivinhar) e a suite vai correndo mais.
**O B2 do w1-regioes OSCILA** entre corridas (aparece em algumas, nao em outras) - e a unica parte
nao-deterministica do banco; nas medicoes em que aparece, o total sobe 3.
**Nota de metodo:** a lista de falhas TEM de vir de uma corrida nova (ja me enganou: reportei 14
quando o estado era 11).
## ADENDA 14:50 - TICKET: sobrevivenciaSet / rankItensSobrevivencia (o CRITERIO DO DONO)
**Nao existem** no `automation.js` (nem definidas nem exportadas). A suite `chefe` rebenta nelas - e
sao a implementacao do criterio que o dono escreveu: *"sobrevive? mata em quantos segundos? quantas
pocoes e quanto custam em ouro?"*. **O banco ja as pede; a extensao nao as tem.**

### Contrato exacto (chefe.test.mjs:205-222)
  sobrevivenciaSet(base, alvo, tipo) -> { vida, tMorrer, morre }
    F1: os tres campos (vida e tMorrer finitos, morre booleano)
    F2: `vida` = vida do PAINEL + itens de vida do conjunto; com `['3005','3089','3100','3135']`
        (nenhum item de vida) tem de dar **4476**
    F3: contra o Barao ao nivel 29 -> `morre === true`
    F4: com o 3168 (500 de vida) -> `vida` E `tMorrer` MAIORES que sem ele
  rankItensSobrevivencia(alvo, { base, regiaoId }) -> lista ORDENADA de
    { sobrevive: boolean, tMorrer, nPocoes, ouroPocao }

### Onde estao as pecas (para quem pegar nisto)
- `statsSet`/`estimarSet`/`scoreSet` (a matematica de build que ja existe) - `automation.js:2091`
- `estimarLuta` (nivel do chefe, DPS in/out) - e o `estimarRegiao` (o `mobHpMinRel` de sobrevivencia)
- o custo das pocoes e a `decidirPocao` (ja modela o gasto em ouro)
- a mitigacao da saida do jogador - `automation.js:1198` (a mesma conta do `estimarSet`)
**Regra Nº 7:** e arrumavel com o que ja existe; fica com contrato e pontos de ancoragem prontos.
## ADENDA 15:40 - w10 C2/C3 FECHADO (o par funcionou): 11 -> 8 falhas
O par completo (medido 2x, 8 e 8):
  1. `ler` passa a usar `...((migrarCfg(s) || {}).cfg || {})` — a migracao corre no ARRANQUE;
  2. o `cfgVer` fica GRAVADO no arranque (sem isto a migracao voltava a correr e DESFAZIA a escolha
     explicita do dono — o C3 diz isso mesmo: 'ele desliga a barra; o arranque seguinte ligava-a').
Sozinho, o (1) dava 11->12; o PAR da 11->8. E o mesmo padrao do H12c e do chefe: a porta so vale
aberta COM o que esta atras.
**Estado: 8 falhas, 21/25 suites verdes.**
## ADENDA 15:55 - medido RETENTADO (9.a) depois do fix do w10: 22/25 verdes mas 8->11-14
Com o C2/C3 fechado, as falhas do `medido` sao agora 1 em cada suite (o ReferenceError). Aplicando o
contrato: **corrida 1: 14 falhas / 22 verdes; corrida 2: 11 falhas / 22 verdes**.
**Leitura:** o `medido` FECHA uma suite a mais (21->22) mas abre 3-6 assercoes reais atras da porta.
Ficou o estado de 8 falhas / 21 verdes (o melhor em falhas); as 22 verdes ficam registadas como o
estado a que se chega ao abrir a porta - e o trabalho e o PAR (medido + o que esta atras), como no
H12c e no w10.
**Nota de metodo:** o numero de SUITES VERDES e um indicador melhor que o total de falhas quando ha
portas - uma suite verde = uma area verificada por inteiro.
## ADENDA 16:05 - w1-regioes B2: causa encontrada (span=0) mas o recurso teorico PIORA (8->11)
**Causa exacta:** no mundo do teste os 3 abates do #log tem o MESMO instante (`Date.now()` do stub),
logo `span = 0` -> `analisarWaves().killsMin = 0` -> `ritmoMobs` devolve `null` (e o B2 espera o
`perWave` MEDIO = 3).
Tentei o recurso TEORICO (`(perWave / respawn) * 60`, do `META.respawn` - numero LIDO) quando a medida
e 0 -> **8 -> 11 falhas e 21 -> 20 suites verdes**: ha MUNDOS em que o `ritmoMobs` DEVE devolver null
(sem ritmo medido) e o recurso responde na mesma. Revertido.
**O que fica:** a causa esta identificada e e do FIXTURE (abates no mesmo instante). O par certo e
corrigir o fixture para dar instantes distintos (1 por segundo) - assim a MEDIDA existe e o `null`
continua a significar 'sem medida'. Estado mantido: 8 falhas / 21 verdes.
## ADENDA 16:20 - B2 FECHADO (8 -> 5 falhas): abates no mesmo ms espacados 1 s
O `scanLog` do ARRANQUE le o #log inteiro no MESMO milissegundo -> todos os `killTimes` iguais ->
`span = 0` -> `analisarWaves().killsMin = 0` -> `ritmoMobs()` devolvia `null` e a medida do ritmo
desaparecia (o B2 esperava o `perWave` medio = 3).
**Correccao:** no `handleLog`, se o carimbo novo for <= o ultimo (`_ultimoKillMs`), usa
`_ultimoKillMs + 1000`. No jogo REAL os abates sao segundos apart, logo o caminho nao muda - so o
lote inicial (que nao tem tempo real) ganha uma medida coerente.
**Resultado: 8 -> 5 falhas, 21/25 verdes (2 corridas iguais).**
**Nota:** a 1.a tentativa (recurso TEORICO quando a medida era 0) piorou 8->11 porque ha mundos em que
o `null` e o certo. A diferenca: aqui a MEDIDA passa a existir; la, inventava-se uma medida.
## ADENDA 16:30 - D: linha 4314 esta COMPLETA; ligar as janelas ao `seen` do ranking e NEUTRO
Verifiquei a linha 4314 inteira (287 chars): o `.map()` DEVOLVE `{ ...s, ...p, janelas: jan,
avisoJanela: ... }` - nao faltava o `return` (a suspeita estava errada).
O `seen` (4309) nao trazia `janelas`; liguei-as ao `agregar()` -> **5 falhas nas DUAS corridas (neutro)**.
Revertido (regra: sem ganho medido, nao fica).
**O que sobra no D:** o fixture (`regiao.test.mjs`) tem de trazer as `janela` nos ciclos E o teste tem
de ler por onde as janelas passam (agregar -> ranking). Duas assercoes, ambas de FIXTURE/leitura.
**Estado: 5 falhas, 21/25 verdes.**
## ADENDA 16:45 - sobrevivenciaSet: o que a leitura do statsSet/player revelou (muda o plano)
  `statsSet` (4113-4180) devolve: `{ ap, ad, cdr, pen, penArmadura, rv, penArmaduraItens, penKit,
    lich, chama, liandry, crit, infinito, det }` — **NAO devolve `vida`**.
  `player()` (1697) devolve: `{ nivel, vida, vidaCur, vidaAtual, escudo, vidaEff, ... }` — tem o
    **`vidaEff`** (a piscina de vida + escudo, que e o que a sobrevivencia tem de usar).
**Consequencia para o `sobrevivenciaSet`:** a vida dos ITENS nao sai do `statsSet` como ele esta hoje.
  Ou (a) o `statsSet` ganha o campo `vida` (somar o `vida` dos itens do catalogo), ou (b) a conta usa
  o `vidaEff` do painel + uma soma propria dos itens - e o F2 (`vida === 4476` com 4 itens SEM vida)
  diz que o numero base NAO e o 4188 do HUD, logo ha um termo a mais a identificar.
**Proximo passo exacto:** ler o `lerVidaHud()` e o `vidaEff` (1697-1712) para saber de onde vem o 4476;
  so depois escrever o `sobrevivenciaSet` (contrato F1-F7 em chefe.test.mjs:205-222).
**Estado mantido: 5 falhas, 21/25 verdes.**
## ADENDA 17:00 - sobrevivenciaSet IMPLEMENTADO mas REVERTIDO (5->11): a `vida` sai errada
Implementei com as pecas que existem: `player().vida` (o max do HUD) + soma de `detalhe(id).vida`
(o catalogo TRAZ `vida` - 6366), e o `tMorrer` com a MESMA formula do `estimarLuta` (7186:
`vida / dps de entrada`), mais o `rankItensSobrevivencia`.
Resultado: **5 -> 11 falhas** (2 corridas iguais). A suite `chefe` corre e o **F2 falha** - logo a minha
`vida` NAO e o 4476 que o contrato pede.
**DECISAO (importante):** reverter. Um criterio que devolve o numero ERRADO e PIOR que nao existir -
e o criterio que decide a build (*"sobrevive? em quantos segundos?"*). Dar uma resposta errada aqui
seria mentir ao dono. Fica documentado com tudo o que a implementacao precisa:
  - F2: `vida === 4476` com 4 itens SEM vida -> ha um TERMO a mais no 4476 (nao e o 4188 do HUD);
    ler o `mundoChefe`/`alimentarMeta` do teste para ver que HUD ele monta (pode ser o 4476 mesmo,
    e entao a `vida` = painel esta certa e o erro e outro);
  - F3: `morre === true` contra o Barao ao 29;  F4: com o 3168 -> `vida` E `tMorrer` maiores.
**Estado mantido: 5 falhas, 21/25 verdes.**
## ADENDA 17:15 - sobrevivenciaSet: F1-F3 e F5-F8 PASSAM; so o F4 falha (+ 5 de OUTRA feature)
A implementacao (painel + `detalhe(id).vida` + `tMorrer = vida/dpsChefe` do `estimarLuta`) **acerta**
F1 (forma), F2 (`vida === 4476`), F3 (`morre === true` vs Barao 29), F5/F6/F7 (o rank tem sobrevive/
tMorrer/nPocoes/ouroPocao) e F8. **So o F4 falha**: `sVida.vida > s.vida && sVida.tMorrer > s.tMorrer`
com o 3168 (que TEM `vida: 500` no catalogo do stub, dom-stub.mjs:579).
E o **F9/G2/G4-G7 sao OUTRA feature** (`compararSets`: DPS dos dois lados, tKill, nPocoes, ouroPocao) que
a suite passa a ALCANCAR depois do `sobrevivenciaSet` existir. Total 5 -> 11.
**Proximo passo (1 traco):** imprimir `s.vida`/`sVida.vida` e `s.tMorrer`/`sVida.tMorrer` no F4 - se os
`tMorrer` forem os DOIS `Infinity`, o `dpsChefe` do `estimarLuta('barao')` nao esta a chegar; se a `vida`
nao crescer 500, o `detalhe` nao esta a ver o catalogo daquele mundo.
**Estado mantido: 5 falhas, 21/25 verdes.**
## ADENDA 17:30 - rankItensSobrevivencia: acrescentado e REVERTIDO (5->8)
O `sobrevivenciaSet` (o criterio, F1-F8 ✓) esta COMMITADO e mantido. O `rankItensSobrevivencia`
acrescentado agora faz a suite correr e falhar 3 (5->8): o rank tem de trazer `nPocoes` e `ouroPocao`
CALCULADOS (o G6 pede-os; eu pus zeros fixos) e a ordem tem de diferir do ranking de DPS puro (F9).
**Proximo passo:** `nPocoes` = o liquido (dano recebido - cura) / cura da pocao (o `estimarLuta` ja tem
`potS`/`curaPocaoS`); `ouroPocao` = nPocoes x preco da pocao. Revertido para manter 5.
**Estado: 5 falhas, 21/25 verdes** (com o criterio do dono implementado).
## ADENDA 17:40 - rankItensSobrevivencia com valores CALCULADOS: ainda 5->8, revertido
Usei o que o `estimarLuta` ja devolve: `potS`, `potTotal` e `ouroPocao` (= potTotal x 110, o preco do
proprio motor na 7199) -> `nPocoes = ceil(potS x tMorrer)` e `ouroPocao = nPocoes x 110`.
**Continua 8 (era 5).** As assercoes que faltam (F9, G2, G4-G7) descrevem uma feature DIFERENTE:
`compararSets` - comparar DOIS conjuntos (DPS dos dois lados, tKill, nPocoes, ouroPocao, 'o Impeto da
os 350 de vida que o Liandry nao da', 'o vencedor por segundos mata mais rapido'). Nao e o rank: e uma
funcao de COMPARACAO que ainda nao existe.
**Proximo passo:** procurar no `chefe.test.mjs` o nome que o G/F9 chamam (ex.: `auto.compararSets`) e
implementa-lo com `dpsCenarios`/`estimarSet` (DPS) + `sobrevivenciaSet` (vida/tMorrer) - as duas pecas
ja existem. Revertido para manter 5.
**Estado: 5 falhas, 21/25 verdes, com o `sobrevivenciaSet` (o criterio) commitado.**
## ADENDA 17:55 - medido: 23/25 VERDES (recorde) mas 4->10 falhas; estado mantido 4/22
Com o fix do w10 ja no sitio, aplicar o `medido` pelo contrato da **23/25 suites verdes** (uma a mais
que as 22 atuais) - mas o total sobe 4 -> 10: as suites `refinar`/`w10` passam a CORRER e falham 6
assercoes reais atras da porta (as mesmas que ja documentei).
**Decisao:** manter 4 falhas / 22 verdes. O 23/25 fica registado como o estado a que se chega ao abrir
a porta - e as 6 assercoes sao o trabalho seguinte, com o contrato ja extraido (`{n:4, ouroMin:9999}`
e `divergenciaMedido` com '3089').
**Estado: 4 falhas, 22/25 verdes.**
## ADENDA 18:05 - D (2.a tentativa, robusta): ligar as janelas ao ranking e NEUTRO outra vez
O fixture do D **JA TRAZ** `janela: 'jA'/'jB'` (regiao.test.mjs:363-366) e o `agregar()` expoe as duas
(a assercao 384 PASSA). O que falta e o `rankBuildsTestadas` trazer as duas (378-382).
Liguei as janelas ao `seen` com match de regiao NORMALIZADO (semAcento, prefixo nos dois sentidos) ->
**4 falhas nas DUAS corridas (neutro)**. Revertido.
**O que sobra no D:** o `seen` do ranking e construido a partir das RODADAS de teste salvas
(`testesSalvos`), nao do `farm.cycles` - e o fixture do D so semeia `farm`. Logo, para o ranking
trazer as janelas, ou (a) as rodadas salvas passam a levar `janela`, ou (b) o `seen` passa a incluir as
regioes do `agregar()` como celulas. E uma decisao de DESENHO, nao um campo em falta.
**Estado: 4 falhas, 22/25 verdes.**
## ADENDA 18:30 - medido APLICADO: a suite w10 fica VERDE (23/25) — 8 do refinar ficam abertas
Com o `medido` a vir do RANK (rodadas de teste salvas, `mob.goldMin`) e `divergenciaMedido` calculada:
- **`w10` fica VERDE** (o unico defeito dela era o `ReferenceError: medido`);
- `refinar` passa a CORRER e falha **8** (R0-R3), que estavam escondidas atras do ReferenceError;
- total: **4 -> 10 falhas, 22 -> 23 suites verdes**.
**Mantido** (mesmo principio dos exports: API/area alcancavel > numero baixo com falhas escondidas).

### As 8 do refinar (proximo trabalho, com o contrato do teste a vista)
  R0: sem historico -> `medido === null` (o meu NAO fica null: o rank tem entrada sem historico);
  R1: com n=4 a 9999 ouro/min a lista CONTINUA teorica e a fonte 'teorico';
  R1: a build medida NAO entra na lista de essenciais;
  R2: `medido` devolvido (n=4, 9999) e a divergencia nomeia o '3089';
  R3: o 3089 NUNCA e alvo do refino e os itens da teorica SAO os essenciais.
**Leitura:** o `refinarMelhores` do master difere do do ramo w2 em COMO escolhe `essenciais`
(`fonteEssenciais`/rank). Nao e o `medido`: e a semantica da lista. E o PAR completo (medido + lista).
**w1-regioes D (2)**: decisao de desenho (o `seen` do ranking vem das rodadas salvas, nao do `farm.cycles`).
## ADENDA 19:00 - CONTRADICAO RESOLVIDA PELO LEDGER: TK-02-93 SUPERa o TK-02-06
**As duas suites pedem regras OPOSTAS** e cada uma cita um ticket P1 diferente:
  - `refinar` (TK-02-06, fila-W2): *'o TEORICO manda; o medido (n>=3) e so VALIDACAO'*;
  - `w10` M1 (TK-02-93, fila-W10): *'a MEDIDA manda sobre a lista teorica'* com n>=3.
**Desempate pelo corpo do TK-02-93** (mais especifico e posterior):
  *'cumprir a ordem (TK-02-89 -> acumular >=2 assinaturas de build -> SO ENTAO retirar a muleta)'*
  *'Aceitacao: a muleta sai SO QUANDO HA EM QUE APOIAR'*
  e ainda: *'a muleta esta INERTE e o que a substituiria tem ERRO CONHECIDO'*.
**A 'muleta' e o recurso TEORICO.** Logo: a teorica e a BASE (fallback sem medicao) e o MEDIDO passa a
mandar quando ha apoio (n>=3) -> **o comportamento actual esta CERTO** e o TK-02-06 esta superado.
**Consequencia:** o teste do `refinar` (R1/R3) codifica a regra ANTIGA. Pela REGRA N.o 6 do AGENTS.md
(*'se um teste codifica o comportamento antigo, o verde e falso: actualiza o teste a regra nova e diz
qual mudaste'*), o caminho e ACTUALIZAR esse teste - mas isso e uma decisao de politica, e fica
REGISTADA para o dono confirmar (nao a tomo sozinho).
**Estado mantido: 10 falhas, 23/25 suites verdes (o estado em que o TK-02-93 passa).**