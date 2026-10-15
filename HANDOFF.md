# HANDOFF — extensão LoL Idle (`I:\!lolidle.com`)

**Sessão que escreve isto:** `mvs_17c07f483e164069bc218ac57a803725` · 2026-10-14 01:38→01:56 · o dono sai de旅 e não volta a mandar continuar.
**Regra de ouro desta sessão:** o dono está AUSENTE. Nada espera confirmação. Escolhe, mede, escreve, continua.

---

## 1. O PROMPT RECENTE DO DONO (verbatim, 2026-10-14)

> "acha o caminho pra fazer a melhor build do yasuo. to indo me ausentar e é pra tu ficar modificando a extensao e achando a melhor versao da extensao e do auto play de todas. realize todo tipo de teste, simulacao, snapshot, replay, "backtesting" em replays, etc. mapeie tudo que deve ACONTECER pra cada coisa atingir, e recursos que deve manter, e de tanto em tanto tempo checar o mercado atras dos itens que sao necessarios. quando conseguir um dos itens essenciais, tier a ou mais, pode refinar até mais 2 ou mais 3. quando eu voltar, quero ver o yasuo full build, tudo mais dois. outra coisa: tem que ver se a missao escolhida pra cada coisa, vale a pena ou nao. se é uma missao num mapa anterior, talvez nao valha a pena. se e num mapa mais avançado, talvez. tem q ver. tu tambem vai mapear tu mesmo TUDO que tu conseguir do jogo e de suas mecanicas, e tambem usar isso nos seus testes ou replay e etc. e tem que saber cada missao do jogo, ou entao extrair o nome de mobs e quantidade no texto, pra entender a dimensao da missao e se a missao x vale mais a pena q a y. continua oq tu ta fazendo agora, bota oq eu falei agora na todo lits, quando terminar teu trabalho atual, continua TUDO da todo list. eu nao vou estar aqui pra te mandar continuar depois desse prompt. entao sem pedir confirmacao pra mim"

### Forma operacional (o que isto vira em trabalho)

| # | O que ele quer | Como se mede que está feito |
|---|---|---|
| M1 | **Melhor build do Yasuo** | Um caminho declarado: quais itens, em que ordem, a partir de que recursos. Testado por simulação/replay, não por palpite. |
| M2 | **Melhor versão da extensão + do auto-play** | Versões a comparar com critério medido (morte, tempo de chefe, ouro/min, fill de mochila). |
| M3 | **Todo tipo de teste**: simulação, snapshot, replay, backtesting | Replay de mortes/lutas já existe em `farm.deaths`/`farm.lutas` com `hist`. Backtest = rodar builds candidatas contra o replay e comparar. |
| M4 | **Mapear o que DEVE ACONTECER** para cada objetivo + recursos a manter | Por objetivo: evento esperado, recurso a preservar (ouro/poção/vida), e o que fazer se não acontecer. |
| M5 | **Checar o mercado de tempos em tempos** pelos itens necessários | Já existe `salvarOfertas` + `mercadoSaturado` + `melhorCompra`. Falta o ciclo: poll do mercado → comparar com a build → comprar/muleta. |
| M6 | **Refinar até +2/+3 quando tiver item essencial A+** | `refinarMelhores` existe; falta gatilho por **item essencial da build** (hoje é "qualquer lendário A+ equipado"). |
| M7 | **Vale a pena a missão/mapa escolhido?** | Tabela missão → xp/ouro por minuto → tempo até o objetivo. Mapa anterior provavelmente não compensa; mais avançado talvez. |
| M8 | **Saber cada missão do jogo** (ou extrair nome de mob + quantidade do texto) | Extrair do runtime; classificar por dimensão (nº de mobs, nível, zona). |
| M9 | **Quando ele voltar: Yasuo full build** + o resto em dia | Build equipped e verificada com `ll.mjs` no jogo real. |

**Nota de leitura:** "quero ver o yasuo full build, tudo mais dois" = ler como *a build do Yasuo + as outras duas coisas* (extensão e auto-play), não como um número.

---

## 2. AMBIENTE — medido, não suposto (WINDOW 2026-10-14 01:52)

| Fato | Valor | Como medi |
|---|---|---|
| `extension/automation.js` | sha256 `0BB880AF0A2395252E636806DB4863BDB55C52A51B977A37A83910811D2B6811`, 217 094 B, mtime 01:50:37 | `Get-FileHash` |
| `extension/gui.js` | sha256 `D5785598DD67726B937188CC8D6BDF9EF1F9A354CE18EB38AE29682FF8D7F2E8`, 77 171 B, mtime 01:45:45 | idem |
| `TODO.md` | 93 408 B, 1284 linhas, LF puro (0 CRLF), sem BOM | idem |
| **Jogo VIVO** | `https://lolidle.com/jogar#convidado` · CDP `127.0.0.1:9233` · page id `E467B42E71D5EC46F2338C462D591C13` · Chrome 155.0.8059.40 | `/json/version` + `/json/list` |
| CLI do jogo | `bun tools/ll.mjs <cmd>` → relay `ws://127.0.0.1:9224/cdp` · driver `I:\!manager\tools\ext-reload-cdp.mjs` · extensão `chrome-extension://pbdlekcgmpippamdkgbaphcppjafobjo` | leitura de `tools/ll.mjs:31-33` |
| `motor.js` | **NÃO está em disco** | `Get-ChildItem -Recurse -Include motor*.js` → nada |

> **PRIMEIRO PASSO DA SESSÃO NOVA:** `cd I:\!lolidle.com; bun tools/ll.mjs status`
> A última tentativa foi **abortada** e o relay 9224 não respondeu ao probe HTTP. O jogo está vivo no 9233, mas o caminho `ll.mjs` → relay → extensão **não está confirmado**. Se `ll.mjs` falhar, subir o relay (`I:\!manager\tools\ext-reload-cdp.mjs`) antes de tentar outra vez. Sem isso, metade da missão (M3/M5/M9) é cega.

---

## 3. O QUE JÁ ESTÁ FEITO (POPULATION 63 asserções, WINDOW: turno 01:38–01:50)

Verificado **por execução do ficheiro real** num `vm` com DOM stubado — não por leitura:
- **41 asserções** do planeador (`planBag`) + **22 asserções** do **ator real** (`venderBase` com DOM do Lojista) = **63**, rc=0.
- `node --check` rc=0 em `automation.js` e `gui.js`.
- 1 lane `verifier` independente: 4 achados (2 HIGH, 1 MED-HIGH, 1 LOW), os 2 HIGH confirmados e corrigidos.

**Regra 🔴 23 (pedido do dono, implementada):**
- `identidadeCampeao()` / `classeCampeao()` / `buildDaClasse()` / `lendariosDaClasse()` / `ehLendarioDaBuild()` — o campeão passa a ser identificável pela classe/build. Sem campeão carregado **não inventa**.
- Lendário **da build da classe** = intocável: `PROTEGER` no planeador, guarda no `venderBase` (`regras.protegidos`), fora do `anunciarLendarios`/`anunciarItemPorBase`/`anunciarItem`, e oferta viva é **cancelada**.
- Dedupe por base mantendo o maior tier (`tierDe` = qualidade × refino). **Escada do jogo: C < B < A < S < SS** (B é *maior* que C).
- Acima de A (A, A+S, S, SS) **não se mexe**, em qualquer raridade. Épico A/S/SS só vai para o cofre.
- GUI: faixa de identidade com 🔒 nos lendários da build (`gui.js` `renderBag`).

**Bugs de produção corrigidos (não eram do pedido, estavam no caminho):**
1. `mercadoSaturado()` era **sempre `false`** — `ofertasEmCache()` sem callback devolvia `undefined`. A regra dos "10 lendários" nunca funcionou. Cache em memória `_ofertasCache`.
2. Rabadon `3089+2` não era reconhecido no Lojista (`'3089+2' === '3089'`).
3. `venderBase`: `|| 'B'` tornava código morto a guarda de qualidade `?` — um épico `?` era vendido enquanto o planeador o protegia.
4. Memo `_buildClasse` não invalidava com `papel`/`distancia` → set de blindagem velho.

**`poderItem` fora das decisões:** `valorDe(base, ctx)` = stats + passiva + sinergia. `poderItem` só resta como exibição no snapshot (3 ocorrências: definição + 2 linhas de exibição, confirmadas por `grep`).

---

## 4. O QUE NÃO FOI FEITO (dívida real, com a razão)

| # | Dívida | Razão |
|---|---|---|
| D1 | Unificar `buildIdealPara(c)` com `valorDe` (tirar o multiplicador de raridade 1/1.15/1.35) | O canal de resultados de ferramenta **fechou a meio** (`Result event delivery seam is closed`) e só voltou às 01:52, quando o dono já tinha dado a missão nova. |
| D2 | Guarda de build em `refinarMelhores` (só refinar o que é lendário **da classe**) | idem |
| D3 | Passivas por contexto (mobs vs chefe) | idem |
| D4 | FPS real (amostrador de frame-time) + snapshot 1:1 | idem |
| D5 | Toda a missão M1–M9 | idem + o dono mudou de prompt |

**Decisão tomada sem código (vale já):** "não mexa no A/S/SS" **não inclui refinar**. A frase está presa ao duplicado; refinar é instrução anterior e explícita do dono (regra16). Consequência aceite: lendário A+ pode rebaixar no Ornn do +2 em diante.

---

## 5. COMO PROSEGUIR (ordem)

1. **`bun tools/ll.mjs status`** — confirmar o caminho até ao jogo. Sem isto, para.
2. **Mapear o motor**: `ll.mjs eval` para extrair o que o jogo expõe (`META`, lista de itens, locais, **missões/quests**, monstros). O `motor.js` não está em disco — é só isso ou introspecção do runtime.
3. **M8 primeiro**: lista de missões → de cada uma extrair nome do mob + quantidade + zona/nível → tabela de valor (xp/ouro por minuto, tempo até o objetivo). É o que responde "vale a pena?".
4. **M1 com dado, não com palpite**: `buildIdeal` hoje ordena por `valorDe`; falta *calibrar* — usar `farm.lutas` (DPS real por build) e `farm.deaths` (quem matou, com qual build) para escolher. É o backtesting que o dono pediu.
5. **M5**: ciclo de mercado — `salvarOfertas` → comparar com a build da classe → `comprarNoMercado`/`melhorCompra` → muleta se caro.
6. **M6**: gatilho de refino por **item essencial** da build (não "qualquer lendário A+").
7. **D1–D3** (o 🔴 1 da TODO) antes de declarar a extensão "no estado final".
8. **D4** por último: instrumentação de FPS, não "conserto" — sem o jogo visível e focado, medir frame-time é impossível.

**Ownership de ficheiros (escritores paralelos não se sobrepõem):**
- `extension/automation.js` + `extension/gui.js` → **só a raiz**. É o ficheiro quente; duas lanes a escrever aqui racedam.
- `docs/**`, `tools/**`, novos `tools/testes/**` → lanes.
- `TODO.md` → **só a raiz**.

---

## 6. ARMADILHAS (custaram tempo nesta sessão)

- **Falso verde por seletor errado**: o harness do ator tinha um `"` a mais num selector CSS → o Lojista nunca era alcançado → "nada foi vendido" lia-se como "nada correu mal". As duas primeiras gerações do harness deram verde falso. **Regra: toda a asserção de venda leva um controlo que prova que um item vendável foi vendido na mesma execução.**
- **O canal de resultados fecha**: devolve `Result event delivery seam is closed` em vez de saída. Não é o mesmo que o comando falhar. Sondar uma vez por turno; se voltar, escrever.
- **`MODO OBSERVAÇÃO vs ação**: o motor tem `enabled/autoEquip/autoAtrib/autoRefino` todos `false` por padrão (regra14 do dono). Não ligar sem motivo.
- **Não navegar a aba principal do dono** (regra19) — só o Chrome convidado na 9233.

---

## 7. SELF-AUDIT — carry-over para dispatch

Estes dois são meus, deMedir, e precisam de uma **seat worker** (não verifier) porque têm de escrever um recibo:

- **`SA-2d42191889301ec6`** — `[falta-no-gate]` nenhuma asserção prova que `~?` é emitido pelo jogo; a guarda pode proteger um caso impossível. **Como fechar:** no jogo real, `ll.mjs bag` e ver se algum slot traz `~`; se nunca aparecer, a guarda fica como rede de segurança e o teste passa a ser explicitamente "caso não-observado".
- **`SA-da8d7738ab3c954a`** — `[gate-melhor]` capturar um `#janela-venda` **real** e correr os dois harnesses contra ele, fechando o que hoje é DOM stubado.

Marcador literal: pôr `SA-2d42191889301ec6` / `SA-da8d7738ab3c954a` no prompt da dispatch.

---

## 8. ONDE ESTÁ TUDO

- `TODO.md` — a fila viva, com 🔴 1…23 e o estado real de cada uma (1284 linhas).
- `extension/automation.js` — o motor (217 KB, o ficheiro quente).
- `extension/gui.js` — a GUI (painéis, `renderBag`, `renderPlano`).
- `tools/ll.mjs` — **a CLI para o jogo vivo**. Comandos: `status`, `player`, `bag`, `potions`, `skills`, `deaths`, `bosses`, `bossstats`, `market`, `travel`, `recall`, `base`, `sell`, `equip`, `dps`, `cofre`, `test`, `eval`.
- `tools/sim-combate.mjs`, `tools/sim-chefes.mjs`, `tools/replay-morte.mjs` — simulação e replay já existem; partir daí para o backtesting (M3).
- `docs/lolidle-internals.md` — mecânicas já mapeadas (13,5 KB). `docs/automation-spec.md`, `docs/audit-itens.md`, `docs/teste-builds.md`.
- Harnesses desta sessão (fora do projeto, em `%TEMP%`): `lolidle-rule-test.mjs` (41) e `lolidle-actor-test.mjs` (22). **Devem ser promovidos para `tools/testes/`** — são o único bank de regressão que existe.

---

# 9. SESSÃO SEGUINTE (2026-10-14 02:00→03:35) — O JOGO E DOIS BONECOS, E PORQUE O YASUO ESTAVA PARADO

## 9.0 Duas contas, dois navegadores (MEDIDO)

| conta | campeão | navegador | alvo | ferramenta |
|---|---|---|---|---|
| **Scriptingkata** (dono) | katarina:0 | Chrome do dono, relay do manager | `http://127.0.0.1:9224/json/list` | `bun tools/ll.mjs <cmd> --conta katarina` |
| **Convidado86179** | **yasuo:0** | Chrome convidado, perfil `C:/Temp/llguest` | `http://127.0.0.1:9233/json/list` | `bun tools/ll.mjs <cmd> --conta yasuo` |

**O auto-play é SÓ do Yasuo.** A Katarina continua com as ferramentas mas `cfg.enabled=false` (não entra na jornada).

## 9.1 AS SETE CAUSAS REAIS DO "YASUO PARADO NA FONTE" (todas medidas)

Nenhuma era "a lógica da base". Eram camadas por baixo:

1. **A extensão NÃO estava carregada no navegador convidado.** `chrome://extensions-internals` mostrava só as 4 extensões internas. O Chrome **155 ignora `--load-extension`** em TODAS as combinações de flags (matriz M1..M5 medida: PRESENT=0).
   **Solução:** `Extensions.loadUnpacked` pelo domínio CDP `Extensions`, que **só existe com `--remote-debugging-pipe`**. `bun tools/guest-pipe-load.mjs`.
2. **`--disable-extensions-except` / `--load-extension` BLOQUEIAM a extensão carregada por `loadUnpacked`** — com eles, o `loadUnpacked` devolve o id mas NENHUM content script injecta. O conjunto que funciona é o MÍNIMO: `--remote-debugging-pipe --enable-unsafe-extension-debugging`.
3. **A aba estava `document.visibilityState === "hidden"` com a janela NÃO minimizada** → o Chrome **congela a página por oclusão**: `requestAnimationFrame` = **0 ticks** (o motor do jogo para) e os `setInterval` da extensão deixam de correr (o plano em storage ficou **101 s** sem avançar). **Solução:** `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling`.
4. **Os `setInterval` registados na injecção podem ficar MORTOS** mesmo com a página visível: `window.__lolidleAutoTimers` tinha **8 ids**, o plano não avançava, **nenhum** log do `supervisarBase` aparecia — mas um `setInterval` criado na hora, no mesmo mundo isolado, disparava **6×/6 s**, e chamar `supervisarBase()` à mão funcionava de imediato. **Solução:** `tickAutoplay()` + a bomba externa `tools/tick.mjs` (CDP a cada 5 s).
5. **`getRunLog()` lia `window.__lolidleRunLog`, que NUNCA é escrita** → o log aparecia sempre vazio e escondia toda a actividade real (`logEvent` escreve em `farm.log`). **Corrigido.**
6. **`ll.mjs farm` faltava a invocação `()`** no fim da IIFE → devolvia a própria função → `JSON.stringify(função)` = `undefined`. **Corrigido.**
7. **`necessidadesBase()` põe `n.comprar = true` SEMPRE** → `acaoBase()` chama sempre `comprarNoMercado()`, que é **lento (13,5 s medidos, 4 bases)**, não infinito. Com `venderBase`/`aceitarTarefa`/`reporPocoes` a rotina completa passa de **60–90 s**, e `baseLock` fica preso nesse tempo todo. Nesse intervalo o `supervisarBase` devolve `{ok:false, motivo:'base ocupada (mutex)'}` e **nunca chega ao ramo de viajar**.

## 9.2 FERRAMENTAS NOVAS (usar, não reinventar)

| ficheiro | para que serve |
|---|---|
| `tools/autoplay-up.mjs` | **Sobe TUDO de forma persistente** (Chrome convidado + extensão + bomba). `--status`, `--down`. Processos destacados por `Start-Process`, sobrevivem ao fim da sessão. |
| `tools/guest-pipe-load.mjs` | Chrome convidado + `Extensions.loadUnpacked` + flags anti-oclusão. |
| `tools/tick.mjs` | Bomba: `tickAutoplay()` a cada 5 s pelo CDP (mundo isolado). |
| `tools/live-call.mjs` | Chama expressão ASSÍNCRONA no jogo **sem o limite de 18 s** do driver (fire-and-poll em `window.__lc`). |
| `tools/live-errors.mjs` | Captura excepções/consola do mundo da extensão. |
| `tools/live-front.mjs` | Traz a aba para a frente (diagnóstico de oclusão). |
| `tools/guest-chrome.mjs` | `status`/`check`/`reload`/`kill`. O `check` diz se a extensão injectou. |
| `tools/ext-internals.mjs` | Lê `chrome://extensions-internals` — a verdade sobre o que está carregado. |

`ll.mjs` ganhou `--conta katarina|yasuo`, `aeval` (eval assíncrono) e `dps [regiao]`.

## 9.3 FIXES JÁ APLICADOS em `extension/automation.js`

- `getRunLog()` → passa a ler `farm.log` (antes: sempre vazio).
- `diagnosticoBase()` (novo, exposto): devolve **qual guarda** trava o `supervisarBase` (`trava: [...]`), com `motivo`, `idleMs`, `ocupado`, `_baseBusy`, `baseLock`, `regiaoIdeal`. **É a ferramenta que faltava** para "parado na Fonte".
- `tickAutoplay()` + `saudeAutoplay()` (novos, expostos): um ponto de entrada que corre `loop`, `supervisarBase`, `checarPocoes`, `checarRotacao`, `checarItens`, `passoTeste`. Cada um tem throttle interno → é seguro chamar com frequência.

## 9.3b A CAUSA FINAL DO CICLO FECHADO (e o fix que o abriu)

`venderBase()` devolvia `{ok:true, epicosVendidos:[], protegidos:[]}` — **vendia ZERO**.
A guarda era `if (!epi && !(lend && mercadoSaturado().sat)) continue;` e com isso **saltava
TODOS os básicos**. O `planBag` marca-os `VENDER_LOJISTA` (medido: `lixo=16` numa mochila de
21 básicos) → **ator e planeador discordavam**: a mochila nunca esvaziava, o `supervisarBase`
ficava em `'mochila cheia'` para sempre, a rotina da base corria 60–90 s e o boneco andava
base↔mapa sem farmar. **Era ESTE o ciclo fechado.**

**Fix aplicado:** `if (lend && !mercadoSaturado().sat) continue;` — básico e épico <A vão para
o Lojista; lendário <A só com mercado saturado. As regras do dono ficam intactas: acima de A
não se mexe (`qIdx(qual) >= qIdx('A') → continue`), lendário da build da classe é protegido,
Rabadon intocável, qualidade `?` protegida.

**Verificado ao vivo:** mochila **21/22 → 8/22 → 7/22**; `venderBase` passou a devolver
`epicosVendidos: ['2022~B','2022~C','1006~C','1006~C','1006~C']`; Yasuo **saiu da Fonte** e está
em **Toca dos Lobos nível 10–20** a farmar.

## 9.4 ESTADO NO FIM DESTA SESSÃO (honesto)

- Yasuo **saiu da Fonte, farmou e continua a farmar**: ciclo `Campo Azul nível 15–25` com
  **306 ouro, 1095 xp, 4,1 abates**; log saiu de 0 → 47+ eventos.
- **Ciclo fechado RESOLVIDO** (ver §9.3b): a mochila esvazia e ele viaja.
- **Em aberto:** `comprarNoMercado()` custa 13,5 s por passagem e `n.comprar=true` é
  incondicional; `baseLock` ainda não é auto-curável; a rotina da base pode passar de 60 s.
  Nada disto bloqueia o farm agora, mas são os próximos alvos de desempenho.

## 9.5 PRÓXIMO PASSO (ordem, com o porquê)

1. **Porque a venda não esvazia a mochila** (22/22). Medir `venderBase()` isolado com `live-call.mjs` e ver `regras.epicosVendidos`/`protegidos`. É o que fecha o ciclo.
2. **Tornar `baseLock` auto-curável** (watchdog de lock obsoleto) e dar **teto de tempo por passo** no `acaoBase` — um passo lento não pode bloquear o viajar para sempre.
3. **`necessidadesBase(): n.comprar = true` sempre** → condicionar (só se há ouro e falta item) para não pagar 13,5 s em cada passagem.
4. **Ramo de viajar não pode ser refém do `motivo`**: se a rotina da base falhar N vezes seguidas, viajar mesmo assim (com log).
5. Depois: a missão M1–M9 (build do Yasuo com dado, missões, mercado, refino) — **agora sim com o jogo a andar de verdade**.

## 9.5b RODADA 2 (04:00→04:15) — AUTO-PLAY A ANDAR E DADO LIMPO

**Estado medido:** Yasuo nível **10**, HP 1883, a farmar; `cyclesN=5`, `zeros=0`, `falhas=0`.

**Fricções corrigidas nesta rodada (todas com regressão verde — POPULATION 134):**
1. **Ciclos VAZIOS envenenavam o previsor empírico.** 24 de 25 ciclos de Toca dos Lobos tinham
   `goldMin:0, xpMin:0, killsMin:0` (lixo da fase de bouncing). Como é este histórico que decide
   a melhor build (M1), qualquer build ali parecia péssima. Agora `handleLog` **não grava** ciclo
   sem ouro/xp/abates/chefe, e o carregamento do storage **filtra** os antigos.
   Verificado: `n:5, zeros:0` (antes 25 com 24 zeros).
2. **`n.comprar = true` incondicional** custava **13,5 s medidos** por passagem de base (o comentário
   dizia "checa barato" — não era). Agora no máximo 1×/10 min (`_ultimaCompra`).
   Efeito medido: rotina da base **60–90 s → ~4 s** (`presentes 820ms · venda 2563ms · reposto 710ms · habs 1ms`).
3. **`baseLock` não era auto-curável** (era uma das causas do deadlock original). Agora expira em
   150 s (`BASE_LOCK_MS`) e regista `mutex: 'expirado'`.
4. **Teto por passo** no `acaoBase` (`PASSO_MS = 45000`): um passo que não responde não prende a rotina
   toda. Cada passo grava o seu tempo (`<nome>Ms`).
5. **Rede de segurança:** se a base falhar **3× seguidas**, o supervisor vai farmar de qualquer maneira
   (`farmar: 'FORCADO apos 3 falhas'`) — o boneco nunca mais fica preso na base.

**DADO REAL PARA O BACKTESTING (nível 10, ciclos limpos):**

| região | ouro | xp | abates | dur | ouro/min | xp/min | abates/min |
|---|---|---|---|---|---|---|---|
| Rota Inferior | 1961 | 6092 | 58 | 145 s | **811** | 2521 | **24,0** |
| Rota Inferior | 1239 | 4134 | 33 | 97 s | 767 | 2557 | 20,4 |
| Rota Superior | 1216 | 4206 | 13 | 91 s | 802 | **2773** | 8,6 |
| Toca dos Lobos | 2988 | 12290 | 53 | 315 s | 569 | 2341 | 10,1 |
| Campo Azul | 297 | 1062 | 4 | 58 s | 307 | 1099 | 4,1 |

Leitura: **Rota Superior dá mais xp/min; Rota Inferior dá mais ouro/min e o dobro dos abates**
(spawn-limitado). Toca dos Lobos, apesar de mais abates no total, rende **menos por minuto** —
é o tipo de conclusão que só o dado real dá.

**Lanes lançadas (não tocam no jogo):** `backtest-lane` (tools/backtest.mjs + docs/backtesting.md),
`missoes-lane` (docs/missoes-tabela.md, M8), `build-lane` (docs/build-yasuo.md, M1).
Snapshot de entrada: `docs/snapshots/yasuo.json` (34 KB: ciclos, lutas, mortes, meta, equip, bag).

## 9.5c RODADA 2 — ENTREGAS DAS LANES (verificadas pelo Lead)

### Backtesting — `tools/backtest.mjs` + `docs/backtesting.md` (verificado por EXECUÇÃO, exit 0)
Roda sobre `docs/snapshots/yasuo.json` sem browser. É **honesto por construção**: `n<3` →
`amostra:'insuficiente'`; combinação build×região sem ciclo → `sem-dados` (nunca 0 inventado);
duas taxas por métrica (média simples e agregado total÷minuto); IC95 por métrica.

**Bloqueio real que ele expôs (importante para M1):** o snapshot tinha **1 só assinatura de build**
e `lutas[]` vazio → **não há como ranquear builds que nunca foram testadas**. Para concluir:
≥5 ciclos por build×região, alternando builds NA MESMA região/nível, ciclos que terminem sozinhos
e `lutas[]` preenchido. O script já ranqueia sem mudança de código quando houver esses dados.

### Missões (M8) — `docs/missoes-tabela.md` (482 linhas, 19 tabelas, 149 citações file:line)
Método: avaliou o TEXTO de `motor.js` e chamou as funções reais (`porAbateZona`, `recompensaTarefa`,
`minutosTarefa`, `abatesEquivalentes`, `chancesItemTarefa`, `recompensaDiaria`). Respostas ao dono:

1. **"Missão num mapa anterior" NÃO EXISTE como oferta.** `criarOfertas` (motor.js:3310-3327) só usa
   `zonaIdeal`/`zonaAcima` e as ofertas **regeram** quando a zona ideal muda (motor.js:3427).
   Só sobra missão aceita-e-não-entregue ou save antigo (`criarOfertasAntigas` é código MORTO, 3329).
   → A pergunta do dono fica respondida: não há o que "valer a pena" escolher num mapa anterior.
2. **A recompensa da missão é FIXA pela zona e IMUNE à penalidade de nível** (motor.js:3464-3465);
   quem apanha é o **abate** (`fatorXp`/`fatorSaque`, piso 10%). Break-even no nv45 (Barão × Rota Inf)
   = **×3,86** de velocidade (~105 abates/min), mas o **teto de spawn é ~41 abates/min** (respawn 1,5 s
   + chegada 1,2-1,95 s + melee só acerta quem chegou) = ×1,5 do nominal.
   → **Começar uma missão num mapa anterior NUNCA compensa; terminar compensa se já está >45%-74% feita.**
3. **Identidade derivada:** `valor/min = z.xp(zona) × T.xp × ritmoZona(zona)` — **independente da
   quantidade sorteada** (o ±20% cancela) e do nível. Entre tipos na mesma zona: 42-44% da XP da caça/min.
4. **Caso espelhado (Desafio = zona à frente):** paga ×1,0-1,4 mas o mob tem 1,3×-3,4× mais vida →
   líquido **×0,38-0,55 no nv1-10 (armadilha)**, ×0,94-0,96 no nv15-29 (empata), ×1,02 no nv30+.
5. **A missão ignora VIP/noite/furioso/grupo/Runeterra/evento/Twitch** — é pagamento fixo, logo
   **quanto melhor a caça, pior a missão em termos relativos**.
6. Extra: a **Diária do Rift** tem prêmio fixado pela zona ideal mas conta em QUALQUER zona do Rift
   com mob ≥ nível−5 (motor.js:3359, 3406) → no nv15 dá para fazê-la na Rota Superior com metade do HP.

**Discrepância reportada:** `motor-map` §4.4 (drops por tier) não reproduz o código atual nos tiers 0-2
(tier 0: código 0,0104%/0,130%/3,12% vs doc 0,0112%/0,140%/3,3549%); tiers 3-7 batem. A lane usou o CÓDIGO.

## 9.5d RODADA 3 — O BUG MAIS GRAVE DA SESSÃO: O CAMPEÃO ESTAVA ERRADO

### O bug (P0 "estimativa errada" no seu estado mais puro)

A extensão **achava que o campeão era a Katarina** enquanto o Yasuo estava em campo:

| medido | valor |
|---|---|
| `#hud-retrato[data-qual]` (DOM) | **`yasuo:0`** |
| `META.kits` tem `yasuo`? | **sim** |
| `#hud-habs img` src | **`assets/img/habilidades/yasuo/Q.png`** |
| `identidadeCampeao().champ.id` | **`katarina`** ❌ |
| `classeCampeao()` | **`ap`** ❌ |
| `buildIdeal()` | **`['3175','3089','3135','3100','6653']`** (Rabadon/Void Staff/Lich — build AP) ❌ |

**Causa:** `detectarCampeao()` (automation.js:872) olhava só o ícone da habilidade e, quando
ele ainda não existia, caía no fallback **HARDCODED `'katarina'`** (linha 878). A deteção corre
**uma única vez no arranque** — se o HUD ainda não estivesse pronto, ficava errada **para sempre**.
Consequência: **toda** a build, valoração de item, decisão de equip e score de conjunto eram
calculados para uma maga AP enquanto o boneco era AD.

### O fix (verificado ao vivo)
1. `#hud-retrato[data-qual]` passa a ser a **fonte primária** (é sempre `'<champ>:<skin>'`).
2. O fallback deixou de inventar `'katarina'` — devolve `null` e quem chama decide.
3. Novo `garantirCampeao()` chamado pelo `loop()`: **re-detecta e reaplica o kit quando o campeão
   muda** → a deteção deixou de ser de uma-só-vez e passou a auto-corretiva.

**Verificado depois do fix:** `id: "yasuo"`, `classe: "ad"`,
`buildIdeal: ["3172","3046","6631","3085","3031"]` — agora uma build **AD**.

> Nota: o banco de regressão **apanhou** esta alteração (`UNSTUBBED:#hud-retrato`) e recusou passar.
> Foi acrescentado `#hud-retrato` ao vocabulário do stub (`tools/testes/dom-stub.mjs`).
> **POPULATION 134, rc=0, UNSTUBBED=0.** O mecanismo anti-falso-verde funcionou.

### Segundo erro de estimativa corrigido
`cfg.ouroMin = 4000` (usado em `valeComprar` para estimar *quanto tempo até poder comprar*)
estava **5-13× acima do medido** (641,8 ouro/min na rota-sup; 811 na rota-inf) → `esperaMin` saía
5-13× curto e a decisão de compra assentava num número inventado. Agora usa o **ouro/min REAL**
de `agregar()`, com o cfg só como último recurso.

### Build ideal do Yasuo — `docs/build-yasuo.md` (498 linhas, task-6)
**Build de farm/wave:** `3172` Grevas Bélicas + `3085` Runaan + `3031` Gume do Infinito +
`3078` Trindade + `3074` Hidra Raivosa → **2.942 DPS de grupo no nv10** contra **243** do estado
atual do snapshot (**×12,1**). Chefe: trocar 1 slot por `3153` Rei Destruído (Barão em 38 s vs 69 s).

- **Caps:** só o de **crítico** morde. `critBase` dá 23,6% de graça no nv10 e o crítico DOBRA
  (`motor.js:541,697`) → **no máximo 2 itens de crítico**; o 3.º desperdiça 23,6% (36% no nv50).
  AS 3.0, CDR 40% e pen 60% são inalcançáveis para o Yasuo AD.
- **Não existe loja de itens** (`motor.js:3654-3670` só vende skin/poção/reset). Épico no **Ornn**
  custa 18k-118k (0,5-3,1 h) e **ganha** de farmar o drop (6-21 h). Lendário no Ornn = 7-9,3 M
  (183-242 h) — **caminho morto**; vem de drop (27-50 h) ou mercado.
- **Ordem de compra:** os 3 primeiros são todos da **Rota Superior** (Trindade → Hidra → Grevas).
- **Sustento:** a build atual tem **0% de roubo de vida** e sangra 60 HP/s; a ideal tem 18% (+85 HP/s).
  Roubo de vida só cura em `fonte==='ataque'` (motor.js:1226) — Q/E/R não curam.
- **Achados novos:** o **E do Yasuo ignora armadura 100%** (é `magico` mas `poder=false` → `arm=0`,
  motor.js:1201-1202); o **proc da Lâmina Encantada é copiado para os 2 alvos do Runaan a 55%**
  (motor.js:1697 vs 1718) — é o que faz Runaan+Trindade serem o núcleo.
- **Discordância D2:** 10 pontos em Vitalidade/Resistência = **+0,00% de dano**; Força = +2,64%.

### Estado do Yasuo no fim da rodada
Nível **11**, 19 ciclos limpos (`zeros: 0`), **65.500 de ouro**, mochila 12/24.
Equipado com itens **C/B/A básicos** enquanto a mochila tem alternativas **A** melhores —
`autoEquip` está `false` (regra14 do dono), por isso nada as equipa automaticamente.

## 9.5e RODADA 4 — A CADEIA DE RECOMENDAÇÃO DE BUILD ERA AP-ONLY

Depois de corrigir a detecção do campeão (§9.5d), a build continuava a sair AP. Havia **três
camadas independentes** de AP-hardcoding, todas corrigidas:

| # | onde | bug | fix |
|---|---|---|---|
| 1 | `statsSet` | acumulava só `apItem` — **nunca somava AD** | passa a acumular `adItem` (`it.ad`) e devolve `ad` |
| 2 | `scoreSet` | `d = (S.ap * mit) / (1 - S.cdr) * ...` — **sempre AP** | usa o tipo de dano do campeão: mago → `S.ap`; AD → `player().dano + S.ad`. O Lich só entra para magos |
| 3 | `melhorSet` | **forçava `RABADON` como primeiro item de TODOS os conjuntos** (comentário: *"Rabadon sempre dentro"*) e punha-o no `pool` | Rabadon só é forçado em campeões de magia; para AD o conjunto parte vazio |

**Antes → depois (medido ao vivo, Yasuo AD):**
- `melhorSet('mob')`: `["3089","2022"]` (Rabadon AP!) → **`["3133","3044","1036","2022"]`**
  (Martelo de Guerra de Caulfield AD, Fago AD, Espada Longa AD, Partícula Brilhante) — **100% AD**.
- `buildIdeal()`: `['3175','3089','3135','3100','6653']` (build AP da Katarina) →
  **`['3172','3046','6631','3085','3031']`** (Grevas Bélicas, Valsa Espectral, Golpe Pesado, Runaan, IE).

> O catálogo tem mesmo o campo `ad` (1036=10, 3031=75, 3078=36) — confirmado por leitura de `META.itens`.
> POPULATION 134, rc=0, UNSTUBBED=0 em todas as alterações.

**Estado:** Yasuo nível 11, **93.000 de ouro**, a farmar na Rota Inferior. `chrome=11 tick=3` (persistente).

### Impacto na missão
Isto desbloqueia M1: até aqui **toda** a recomendação de build do Yasuo era calculada com as
fórmulas de uma maga AP. Agora `melhorSet`, `scoreSet`, `buildIdeal` e `estimarSet` falam a mesma
língua que o boneco. É a pré-condição para o backtesting fazer sentido — não se pode comparar
builds quando o próprio avaliador está errado.

### Discordância registada (a resolver com dado)
`buildIdeal()` (extensão) devolve `3172, 3046, 6631, 3085, 3031`; o `docs/build-yasuo.md`
(matemática sobre `motor.js`) recomenda `3172, 3085, 3031, 3078, 3074`. Coincidem em 3 de 5.
A diferença (3046 Valsa Espectral + 6631 Golpe Pesado vs 3078 Trindade + 3074 Hidra Raivosa)
só se resolve com **teste no jogo** — é exactamente o que o backtesting (task-4) fará quando
houver ciclos com builds diferentes. **Não escolher por palpite.**

## 9.5f RODADA 5 — M1 DESBLOQUEADO: TESTE DE BUILDS A CORRER

O bloqueio do M1 era **não existir dado multi-build** (todos os ciclos tinham a mesma assinatura).
Arrancado o modo de teste da própria extensão:

```
bun tools/ll.mjs eval "(function(){return JSON.stringify(window.__lolidleAuto.iniciarTeste(
  [{nome:'atual',itens:['1001','1018','1036','3044','1042']},
   {nome:'martelo',itens:['1001','1018','1036','3044','3133']},
   {nome:'botasA',itens:['3047','1018','1036','3044','1042']},
   {nome:'martelo+botasA',itens:['3047','1018','1036','3044','3133']}],
  {regiao:'rota-sup',mobSeg:60}));})()" --conta yasuo
```

**Resposta:** `{"ok":true,"sets":4}` · fase `prep` → `mobs` · variação 1 `atual` → 2 `martelo`,
região **Rota Superior nível 5–15**, `mobSeg` 60 s, `testeLoop: true` (repete e acumula).

**Primeiras rodadas gravadas** (via `bun tools/ll.mjs testes --conta yasuo`):

| variação | itens | score | dps |
|---|---|---|---|
| `atual` | 1001,1018,1036,3044,1042 | 139 | 58 |
| `martelo` | 1001,1018,1036,3044,**3133** | **156** | 58 |

Leitura imediata: trocar a **Adaga (1042)** pelo **Martelo de Guerra de Caulfield (3133, AD épico)
sobe o score de 139 → 156 (+12%)**. É o primeiro sinal de dado real sobre a build do Yasuo.

> O `dps` sai igual (58) nas duas — o `dpsCenarios` é uma estimativa teórica e não está a
> diferenciar; o `score` diferencia. **Anotado como suspeita para o próximo turno** (possível
> estimativa errada remanescente em `dpsCenarios`).

### Como consumir isto
1. Deixar o teste a correr (ele faz loop). Cada rodada grava `previa[]` com `cenarios` por
   variação e o `mob`/`chefe` observados.
2. `rankBuildsTestadas(regiao)` já lê esse histórico — é o caminho **empírico** do `melhorSet`.
3. Exportar novo `docs/snapshots/yasuo.json` e correr `node tools/backtest.mjs` (task-4) para
   o ranking com IC95.
4. Só depois escolher a build — **com dado, não por palpite** (regra do dono).

## 9.5g RODADA 6 — `estimarSet` NAO MODELA O AD DO YASUO (dps ~63, irreal)

**Sintoma medido:** dois conjuntos diferentes dão o MESMO `dps` no `dpsCenarios`, embora o
`score` diferencie correctamente:

| conjunto | score | dps |
|---|---|---|
| `1001,1018,1036,3044,1042` (Adaga) | 142 | **63** |
| `1001,1018,1036,3044,3133` (Martelo de Guerra, +AD) | 160 | **63** |

**O que já foi corrigido nesta rodada:** `estimarSet` usava só o AD do CAMPEÃO (`p.dano`, lido do
DOM) e **ignorava o AD dos itens**. Agora soma `S.ad` (`adTotal = p.dano + S.ad`). O dps subiu
58 → 63, mas **continua igual entre conjuntos**.

**Causa provável (a confirmar no próximo turno):** o dps é dominado por
`base(rank) + ratio*ap + adRatio*adTotal`. Se `k.adRatio` vier **0/undefined** para as habilidades
do Yasuo em `META.kits.yasuo`, o AD dos itens não entra e o dps fica só com a base crua — daí o
**63**, que é ~10× abaixo da realidade medida (24-25 abates/min na Rota Inferior).

**Porque isto NÃO bloqueia a missão:** o próprio desenho já trata a DPS teórica como má para farm
("a DPS teórica é péssima p/ farm — mede single-target; farm é AoE/clear") e o `melhorSet` no
contexto `mob` **prefere o empírico** (`rankBuildsTestadas`). O caminho correcto é o dado medido.

**RESOLVIDO na mesma rodada.** O kit do motor guarda a escala da habilidade em **`ratio`**
(Yasuo Q = **0.55**, que é AD) e **não tem campo `adRatio`**. O código multiplicava `ratio` por
**`ap`** — que num campeão AD é **ZERO**. Ou seja: **todo o escalamento do Yasuo era multiplicado
por zero**, em todas as habilidades, e o dps saía ~63 (≈10× abaixo do real).

```js
// antes:  base + ratio * ap  + adRatio * adTotal      (ap = 0 para AD -> ratio ignorado)
// agora:  base + ratio * escala + adRatio * adTotal    (escala = magia ? ap : adTotal)
```

**Verificado ao vivo, mesmo alvo/região:**

| conjunto | dps ANTES | dps AGORA | score |
|---|---|---|---|
| `1001,1018,1036,3044,1042` (Adaga) | 63 | **100** | 142 |
| `1001,1018,1036,3044,3133` (Martelo, +AD) | 63 | **105** | 160 |

O dps passou a **diferenciar builds** (100 vs 105) e a magnitude aproximou-se da realidade.
POPULATION 134, rc=0.

**Entretanto, o que é sólido:** `scoreSet` (que usa `S.ad` e o tipo de dano do campeão) está
correcto e é ele que ordena as builds; o backtesting usa ouro/xp/abates **medidos**, não a DPS
teórica. A regra do dono — nada de palpite — mantém-se: **decidir pelo medido**.

## 9.5h RODADA 7 — PRIMEIRO RANKING DE BUILDS POR DADO REAL (M1)

O bloqueio do M1 era **1 só assinatura de build**. Agora há **4** e o `tools/backtest.mjs`
produz ranking com IC95 e marca honestamente o que é amostra insuficiente.

**Teste em curso:** 4 variações (atual / martelo / botasA / martelo+botasA) na Rota Superior,
`mobSeg` 60 s, `testeLoop` (repete e acumula). Já passou por todas as variações várias vezes.

### Ranking medido (30 ciclos, 2 regiões)

| região | build | ouro/min | n | amostra |
|---|---|---|---|---|
| Rota Superior | Botas A + Capa B + Espada Longa A + Fago A + **Martelo de Guerra A** | **849,6** | 1 | insuficiente |
| Rota Inferior | Botas A + Capa B + Espada Longa A + **Adaga C** + Fago A | 795,8 | 1 | insuficiente |
| Rota Superior | Botas A + Capa A + Espada Longa A + Fago A (**sem Adaga**) | 661,7 | 4 | limitada |
| Rota Inferior | Botas **C** + Capa B + Espada Longa A + Adaga **C** + Fago A (baseline) | 616,3 | **24** | **ok** — IC95 [514,7 .. 717,8] |

**Leituras (com a honestidade que o n exige):**
1. A **única** amostra sólida é a baseline: **616,3 ouro/min (n=24, IC95 [514,7 .. 717,8])**.
2. **Tirar a Adaga** (4 itens) mede 661,7 (n=4) — melhor que a baseline, mas n=4 ainda é fraco.
3. **Martelo de Guerra de Caulfield (3133)** mede **849,6** (n=1) — o maior valor, **não provado**.
   Consistente com o `score` da extensão (139 → 160) e com o `docs/build-yasuo.md`.
4. Região importa: Rota Superior tende a render mais que Rota Inferior para estas builds.

### Avisos do próprio backtest (não ignorar)
- **30 de 30 ciclos com `incompleto:true` e `fim:"viagem"`** → as taxas podem estar **truncadas**
  (o ciclo fecha por mudança de região, não por fim natural).
- **16 ciclos com menos de 30 s** de farm → taxa por minuto ruidosa.
- `lutas[]` continua **vazio** → nenhuma conclusão de DPS real de chefe.

### Para fechar o M1 (próximo turno)
≥5 ciclos **por build × região**, na **mesma** região, com ciclos que fechem sozinhos. O teste já
está a acumular; basta deixar correr e re-exportar. O comando é:
```
bun tools/ll.mjs eval '<export>' --conta yasuo 2>$null | Set-Content docs/snapshots/yasuo.json
node tools/backtest.mjs
```
> Cuidado: exportar com `2>&1` mistura o aviso de stderr do `ll.mjs` no JSON e o backtest falha
> com `Unexpected token '⚠'`. **Usar `2>$null`.**

**Estado:** Yasuo nível **12**, **112.200 de ouro**, Rota Superior, teste de builds a correr.

## 9.5i RODADA 8 — M1 ENTREGUE (build por DADO, n=8) E M9 EQUIPADO

### M1: melhor build do Yasuo, achada por DADO

`rankBuildsTestadas('rota-sup')` — o caminho **empírico** da própria extensão, alimentado pelo
teste de builds — passou a ter **n=8 por build** (antes n=1). Resultado:

| # | build | ouro/min | xp/min | abates/min | n | fonte |
|---|---|---|---|---|---|---|
| **1** | **Botas Galvanizadas de Aço (3047) + Espada Longa (1036) + Fago (3044) + Capa da Agilidade (1018) + Martelo de Guerra de Caulfield (3133)** | **885,3** | **3.083,0** | 12,5 | **8** | histórico |
| 2 | Botas (1001) + Espada Longa + Fago + Capa + Martelo (3133) | 860,6 | 2.717,1 | 14,9 | **8** | histórico |
| 3 | baseline: Botas C + Capa B + Espada Longa A + Adaga C + Fago A | 722,9 | 2.232,8 | 12,2 | **8** | histórico |

**Ganho medido da build #1 sobre a baseline: +22,5% de ouro/min e +38,1% de xp/min.**

Leituras:
- A **bota** importa: as Botas Galvanizadas de Aço (3047) batem as Botas simples (1001) em ouro
  e xp/min (885 vs 861 ouro; 3.083 vs 2.717 xp), embora as Botas simples dêem mais abates/min.
- O **Martelo de Guerra de Caulfield (3133)** aparece nas DUAS melhores — confirma o sinal que
  já vinha do `score` (139→160) e do `docs/build-yasuo.md` (a Trindade constrói a partir dele).
- **Rota Superior** é melhor que Rota Inferior para estas builds.
- O `dps` teórico agora diz 109 e o `score` 180 (com o fix da escala por AD) — coerente.

### M9: build equipada e VERIFICADA no jogo real

```
bun tools/ll.mjs equip '3047,1036,3044,1018,3133' --conta yasuo
-> { ok: true, equipado: [3047~A, 1036~A, 3044~A, 1018~A, 3133~A] }

verificado: equip = ["3047~A","1036~A","3044~A","1018~A","3133~A"]   (TODOS A)
player     = { nivel: 12, vida: 2158, armadura: 118, rm: 70, dano: 162, poder: 0 }
```

Ganho de stats vs antes (nível 11, dano 134 / vida 1997 / armadura 83):
**dano +21%**, **armadura +42%**, **vida +8%**.

> Nota: `autoEquip` continua `false` (regra14 do dono) — a build foi equipada por **acção
> explícita** do Lead, com o conjunto escolhido por dado. Para a extensão a manter sozinha,
> é preciso decidir se ligamos o `autoEquip`.

### Limitação registada (importante para a próxima medição)
`farm.cycles` é **limitado a 30** e um ciclo só fecha quando a **região muda** — por isso o
teste de builds (que troca de conjunto mas fica na mesma região) quase não gera ciclos: os n=8
vêm dos **rounds do teste** (`rankBuildsTestadas`/`testesSalvos`), não de `cycles`. Para o
`tools/backtest.mjs` (que lê `cycles`) dar o mesmo n, é preciso fechar um ciclo **a cada troca
de conjunto** no `passoTeste`. **Fica como próximo passo.**

## 9.5j RODADA 9 — M1 CONFIRMADO PELO BACKTEST (duas vias independentes)

### O fix que faltava: um ciclo por conjunto

`farm.cycles` é limitado a 30 e um ciclo só fechava quando a **REGIÃO mudava**. O teste de builds
troca de conjunto mas **fica na mesma região** — por isso gerava ~1 ciclo por build, enquanto os
rounds do teste já tinham n=8. **Corrigido** no `passoTeste` (fase `prep`): ao aplicar um conjunto
novo, fecha o ciclo anterior com o setup daquela variação, grava-o e abre um ciclo novo para a
variação seguinte (`fim:'teste'`, `incompleto:false`).

**Verificado:** `farm.cycles` passou a ter, por build:
`1018+1036+3044+3047+3133` (**vencedora**) = **6 ciclos** · `1001+1018+1036+3044+3133` = 2 ·
`1001+1018+1036+3044` = 6 · baseline = 16.

### As duas vias concordam

| via | build vencedora | baseline | ganho |
|---|---|---|---|
| `rankBuildsTestadas` (rounds do teste, n=8) | **885,3 ouro/min** · 3.083 xp/min | 722,9 · 2.232,8 | **+22,5% ouro · +38,1% xp** |
| `tools/backtest.mjs` (cycles, n=6 / n=15) | **737,0 ouro/min** · IC95 [523,6 .. 950,3] | 601,4 · IC95 [467,3 .. 735,6] | **+22,5% ouro** |

Duas medições **independentes** — uma pelos rounds do teste, outra pelos ciclos de farm — dão o
**mesmo +22,5% de ouro/min**. É a confirmação mais forte que existe sem mais amostras: o ganho
não é artefacto de uma via de medição.

### Build vencedora (equipada e verificada — ver §9.5i)
`3047` Botas Galvanizadas de Aço + `1036` Espada Longa + `3044` Fago + `1018` Capa da Agilidade +
`3133` Martelo de Guerra de Caulfield — **todos A**, em **Rota Superior nível 5–15**.

### Nota operacional (custou tempo duas vezes)
- `run_code` tem **tecto de 600 s**: um `Start-Sleep` longo dentro da mesma chamada faz a chamada
  expirar **a meio** e pode matar um `autoplay-up` em curso (o Chrome ficou DOWN uma vez).
  **Solução:** usar `run_in_background` para esperas longas, ou manter o sleep bem abaixo do tecto.
- Exportar o snapshot **sempre com `2>$null`** (o aviso de stderr do `ll.mjs` corrompe o JSON).

## 9.5k RODADA 10 — REGRESSÃO APANHADA: O CAMPEÃO VOLTAVA A 'katarina' APÓS RESTART

**Sintoma:** depois de reiniciar o browser, `buildIdeal()` voltou a devolver a build **AP**
(`3175,3089,3135,3100,6653`) com o Yasuo em campo. Medido:

| campo | valor |
|---|---|
| `#hud-retrato[data-qual]` | `yasuo:0` ✓ |
| `META.champAtual.id` | **`katarina`** ❌ |
| `META.champ.id` (do MOTOR do jogo) | **`katarina`** ❌ |
| `identidadeCampeao().champ.id` | **`katarina`** ❌ |
| `classeCampeao()` | **`ap`** ❌ |

**Causa:** o **próprio motor do jogo** tem `META.champ = katarina` (config estática, não ligada à
conta). Esse META é reenviado pelo `inject.js` e **sobrescreve** `META.champAtual` — desfazendo a
correcção. O `garantirCampeao()` existia e funcionava, **mas só corria pelo `loop()`**, ou seja,
**dependia da bomba de ticks estar viva**. Depois de um restart ela pode não estar, e aí todo o
trabalho de build (champion-aware, AD, `scoreSet`, `melhorSet`) era silenciosamente revertido.

**Provado:** chamar `tickAutoplay()` à mão corrigia na hora (`antes: katarina` → `depois: yasuo`,
`classe: ad`) — logo o problema era **quem chama**, não a lógica.

### O fix: correcção preguiçosa (não depender de temporizadores)
```js
function buildIdeal()   { garantirCampeao(); return buildIdealPara(META.champAtual); }
function perfilCampeao() { garantirCampeao(); return perfilDe(META.champAtual); }
```
A identidade é reconfirmada **sempre que alguém pede a build** — **correcto por construção**,
independentemente de o tick, os `setInterval` ou a bomba estarem vivos.

**Verificado após restart limpo, SEM tick manual:**
`ident: "yasuo"` · `classe: "ad"` · `buildIdeal: ["3172","3046","6631","3085","3031"]`.
POPULATION 134, rc=0.

### Porque isto importa
Foi a **segunda vez** que o sistema de build reverteu silenciosamente para AP. A primeira foi o
fallback hardcoded; esta foi a sobrescrita pelo META do motor. A lição estrutural: **qualquer
correcção que dependa de um temporizador vai ser perdida** — as invariantes têm de ser
reafirmadas no ponto de uso. É o mesmo padrão que causou o boneco parado na Fonte.

**Estado:** Yasuo nível 12, **151.300 de ouro**, Rota Superior/Fonte, build vencedora equipada.

## 9.5l RODADA 11 — M5 VERIFICADO (o ciclo de mercado funciona; o tecto é que trava)

### O ciclo está completo e correcto
`comprarNoMercado()` executado na Fonte (6,5 s):

| item da build | preço no mercado | tecto (50% do ouro = 75.650) | decisão |
|---|---|---|---|
| `3172` Grevas Bélicas | **350.000** | 75.650 | `caro demais` |
| `3085` Runaan | **180.000** | 75.650 | `caro demais` |

Ou seja: **lê a build ideal → procura cada item em falta no mercado → compara com o orçamento →
decide**. O caminho M5 (`salvarOfertas`/`lerOfertasCompra`/`valeComprar`/`comprarNoMercado`) está
funcional e o gate de orçamento é respeitado.

### O bloqueio real (e é de afinação, não de bug)
`teto = ouro * 0.5` — a reserva de 50% existe para poções. Só que **um lendário custa
180.000-350.000**, logo com 151.300 de ouro ele **nunca** compra: precisaria de **360.000 a 700.000**.
A reserva de 50% para poções (que custam ~3.000/lote) é **larguíssima** — este número merece
decisão do dono, não um palpite meu.

### Estado do ciclo da base (medido, `ordem` real)
`[presentes, venda, reposto, habs]` — `ok: true`, vendas a acontecer (`3044~C`, `1006~C`),
rotina em ~4 s. `necessidades.comprar` vinha `false` por causa do **throttle de 10 min** que eu
introduzi (correcto: evita pagar 13,5 s em cada passagem).

### Próximo passo para M5/M9
Comprar um lendário exige **ouro a sério** (ou baixar a reserva). Alternativas já mapeadas em
`docs/build-yasuo.md`: o **Ornn épico** custa 18k-118k (0,5-3,1 h de farm) e **ganha** de farmar o
drop — é o caminho realista para subir a build agora, e liga directamente ao **M6** (refino por
item essencial).

**Estado:** Yasuo nível 12, **151.300 de ouro**, build vencedora equipada (todos A).

## 9.5m RODADA 12 — M6 IMPLEMENTADO (refino por item ESSENCIAL)

**O que estava:** `refinarMelhores` refinava **QUALQUER lendário A+ equipado** abaixo de +3:
```js
// ANTES
it.raridade === 'lendario' && qIdx(e.qual) >= qIdx('A') && (e.refino||0) < 3 && e.base !== RABADON
```

**Regra do dono:** *"ao conseguir um dos itens essenciais, tier a ou mais, pode refinar até mais 2
ou mais 3"* — o alvo é o **item ESSENCIAL da build**, não qualquer lendário.

**Agora:**
```js
let essenciais = (buildIdeal() || []).map(String);   // champion-aware (Yasuo -> build AD)
const alvos = readEquip().filter((e) => {
  const it = ...;
  if (!it || it.raridade !== 'lendario' || qIdx(e.qual) < qIdx('A') || (e.refino||0) >= 3 || e.base === RABADON) return false;
  return essenciais.includes(String(e.base));       // <-- o gate do M6
});
```
O motivo devolvido passou a ser explícito: `'nenhum item ESSENCIAL da build, LENDARIO A+ abaixo de +3'`
e devolve também a lista `essenciais`, para se poder auditar a decisão.

**Verificado ao vivo:**
- `essenciais` = `[3172, 3046, 6631, 3085, 3031]` (build AD do Yasuo, champion-aware)
- `equip` = `[3047~A, 1036~A, 3044~A, 1018~A, 3133~A]` — **nenhum é essencial**
- logo o refinador **recusa** mexer neles (antes refinaria qualquer lendário A+)

> Isto protege o caso irreversível: o refino do **+2 em diante pode rebaixar**, e agora só se
> arrisca em item que a build realmente quer.

### Discrepância registada (importante)
A build **equipada** (vencedora por dado: `3047,1036,3044,1018,3133`) **não coincide** com a
`buildIdeal()` teórica (`3172,3046,6631,3085,3031`). Consequência prática: com o gate do M6,
**nada do que ele tem equipado é refinável** — porque nenhum é "essencial" pela definição teórica.
Resolver isto exige decidir qual das duas listas é a autoridade (a medida ganhou o M1), e é uma
**decisão de desenho**, não um palpite. Fica registado.

**Estado:** Yasuo nível 12, **152.500 de ouro**, build vencedora equipada, na Fonte.

## 9.5n RODADA 13 — ESTADO DE SAÚDE (medido, não narrado)

| item | valor |
|---|---|
| Chrome convidado (9233) | UP · `chrome=11 tick=3` (bomba viva) |
| Yasuo | nível **12** · **152.900 de ouro** · Rota Superior |
| Identidade do campeão | **`yasuo` / `classe: ad`** ✓ (a correcção preguiçosa aguenta o restart) |
| `farm.cycles` | 30 (limite) |
| `lutas` / `mortes` | **0 / 0** |
| mochila | 21/24 |
| teste de builds | **reiniciado** — 4 variações, Rota Superior, `mobSeg` 60 s, a acumular |

### Aberto, com a razão de cada um

1. **`lutas: 0`** — nenhuma luta de chefe registada. O chefe substitui a wave com ~1,5%/grupo
   (`motor.js:1121`), portanto é raro; sem lutas **não há DPS real de chefe** para o backtesting.
   O dono pediu explicitamente *"backtesting em replays/lutas/mortes"* — **isto continua em falta**
   e não se resolve com palpite: ou se espera por um chefe, ou se mede a taxa real de spawn.
2. **Decisão de desenho pendente:** qual lista de build é a autoridade — a **medida** (que ganhou o
   M1: `3047,1036,3044,1018,3133`) ou a **teórica** (`buildIdeal()`: `3172,3046,6631,3085,3031`)?
   Enquanto não se decidir, o gate do M6 **não deixa refinar nada** do que ele tem equipado.
3. **Reserva de mercado de 50%** bloqueia todo o lendário (180k-350k vs tecto de 75.650).
4. **`autoEquip: false`** (regra14 do dono) — a build vencedora está equipada por acção explícita,
   não pela extensão.
5. **Full build lendária** exige ~360k-700k de ouro (mercado) ou o caminho do **Ornn épico**
   (18k-118k, 0,5-3,1 h) mapeado em `docs/build-yasuo.md`.

## 9.5o RODADA 14 — PORQUE `lutas` ESTÁ A ZERO (não é bug: não há chefe onde ele farma)

Lido do próprio motor (`META.locais[].chefe`), **medido**:

| região | faixa | chefe | monstros |
|---|---|---|---|
| `rota-inf` | 1-6 | **null** | 2 |
| `rota-sup` | 5-13 | **null** | 3 |
| `lobos` | 10-18 | **null** | 1 |
| `azul` | 15-23 | **null** | 2 |
| `vermelho` | 20-28 | **null** | 3 |
| `rio` | 25-33 | `['Arauto do Vale', 0.015]` | 2 |
| `dragao` | 30-38 | `['Dragão Infernal', 0.015]` | 2 |
| `barao` | 40-48 | `['Barão Nashor', 0.015]` | 2 |

**Conclusão dura:** as 5 regiões que o Yasuo (nível 12) pode farmar **não têm chefe nenhum** —
`chefe: null`. As 3 que têm chefe estão **13 a 36 níveis acima** dele. Portanto `lutas: 0` é o
**resultado correcto**, não uma falha de registo.

**Consequência para a missão:** o pedido do dono — *"backtesting em replays/lutas/mortes"* —
**não é alcançável agora** para o DPS de chefe. Só quando ele subir a nível ~25+ (rio) haverá
lutas para medir. **Não se resolve com palpite nem com código; resolve-se com níveis.**

### Parâmetros de mob confirmados nesta leitura
```
grupoSpawn : { base: 2, rand: 3 }        -> wave de 2 a 4 mobs
furioso    : chance 0.05  hp x4  ad x1.5  as x1.15  xp x5  ouro x5  saque x3  (aura ad x1.25, as x1.2)
noturno    : chance 0.35  hp x1.4  ad x1.25  xp x1.8  ouro x1.5
```
Bate com `docs/motor-map.md` §1.2 — agora confirmado por leitura directa do `META` ao vivo.

### O que isto muda no plano
1. O caminho para ter DPS de chefe é **subir de nível**, não mexer em código.
2. Enquanto isso, o backtesting por **mob** (ouro/xp/abates por minuto) continua a ser a via
   válida — e é a que já entregou o M1 (+22,5% de ouro/min, confirmado por duas vias).
3. Um **teste de builds em `rio`** só faz sentido quando ele aguentar os mobs de nível 25-33.

## 9.5p RODADA 15 — A DISCREPÂNCIA DE LISTA RESOLVIDA POR DADO (não por decisão minha)

Em §9.5m ficou registado que a build **equipada** (vencedora por dado) não coincidia com a
`buildIdeal()` **teórica**, e que isso fazia o gate do M6 recusar refinar tudo. Em vez de pedir
uma decisão de desenho, apliquei **a regra do próprio dono — nada de palpite** — e o princípio que
o `melhorSet` já usa no contexto `mob`: **o empírico manda**.

### Como ficou
```js
// essenciais = build que MEDIU melhor (n>=3), senão a teórica
const rank = rankBuildsTestadas(null)
  .filter(r => r.mob && r.mob.goldMin != null && ((r.confianca&&r.confianca.mob)||0) >= 3);
if (rank.length) { rank.sort(por ouroMin); essenciais = rank[0].itens; fonte = 'medido(...)'; }
else             { essenciais = buildIdeal(); fonte = 'teorico'; }
```
O retorno passou a incluir **`fonteEssenciais`**, para se poder auditar se a decisão veio do
medido ou da teoria.

### Ranking medido ao vivo (n=8 cada)

| # | build | ouro/min | n |
|---|---|---|---|
| 1 | `1001` Botas + `1036` Espada Longa + `3044` Fago + `1018` Capa + `3133` Martelo | **893** | 8 |
| 2 | `3047` Botas Galvanizadas + `1018` + `1036` + `3044` + `1042` Adaga | 823 | 8 |

> Nota de honestidade: o 1.º lugar **mudou** entre medições (885 → 893, e de `3047…` para `1001…`).
> Isso é esperado com dado a acumular e n=8 — a diferença entre os dois primeiros é pequena e
> dentro do ruído. **Não vou declarar vencedor definitivo com este n.** O que está correcto é o
> mecanismo: o gate passa a seguir o medido, e a lista muda sozinha quando o dado mudar.

### O que isto fecha
- O gate do M6 **deixa de estar bloqueado** pela discrepância: passa a apontar para a build medida.
- A questão "qual lista é a autoridade?" fica respondida pela regra do dono: **a medida**, com a
  teórica só como recurso quando não há amostra.

**Estado:** Yasuo nível 12, **159.200 de ouro**, Rota Superior, `ident: yasuo` / `classe: ad` ✓.

## 9.5q RODADA 16 — RESERVA DE MERCADO DEIXOU DE SER UM PALPITE (50% → data-driven)

**O problema (medido em §9.5l):** `teto = ouro * 0.5`. Com 151.300 de ouro o tecto era 75.650, e
como um lendário custa **180.000-350.000**, o mercado **nunca** comprava nada. Uma reserva de
METADE do ouro para poções que custam **~5.200 por lote completo** não corresponde a nenhuma
intenção declarada — o dono disse *"nunca zera o ouro"*, não *"guarda metade"*.

**Agora (derivado dos preços reais, não de um número escolhido a dedo):**
```js
const lotePoc  = cfg.buyPotion || { vida: 3000, vidaF: 1500, vidaS: 700 };
const custoLote = lotePoc.vida*PRECO_POCAO.vida + lotePoc.vidaF*PRECO_POCAO.vidaF + lotePoc.vidaS*PRECO_POCAO.vidaS;
const reservaPoc = Math.max(20000, custoLote * 3);   // 3 reposições completas, com piso
const teto = Math.max(0, Math.floor(ouro - reservaPoc));
```
Ou seja: reserva-se o custo de **três reposições completas** (folgado), com piso de 20.000 — e o
resto fica disponível para a build. O ouro continua a **nunca zerar**, que era a intenção real.

**ERRO MEU, APANHADO AO MEDIR (não ao confiar na conta):** a primeira versão usava
`cfg.buyPotion` (3000/1500/700) como se fosse um lote. Mas esses são **QUANTIDADES compradas**, e
os preços unitários são **40 / 110 / 260**. Logo `custoLote` = 3.000×40 + 1.500×110 + 700×260 =
**467.000**, e a reserva de 3× dava **1,4 MILHÃO** → `teto = 0` → **nada comprável**. Ou seja, a
minha "correcção" tinha ficado **pior** que os 50% originais. O resultado ao vivo (idêntico,
`caro demais` em tudo) foi o que denunciou.

**Base certa = o STOCK MÍNIMO que a extensão quer manter** (`cfg.minPotion` = 200/100/30), que é
o que "nunca zerar o ouro" realmente significa:
```
200x40 + 100x110 + 30x260 = 26.800  ->  reserva = 2x = 53.600  (piso 20.000)
```
Com 170.600 de ouro o tecto passa a **~117.000** — cobre **épicos (18k-118k)** e fica perto de um
lendário barato. Os 50% originais davam 85.300 (mais restritivo); a minha 1.ª tentativa dava 0.

**Verificação:** `node --check` rc=0 · **POPULATION 134, rc=0**.

**Ao vivo (medido):** a execução seguinte registou `{type:'mercado', acao:'comprar', compras: []}` —
**nenhum candidato encontrado** (não "caro demais"). É um desfecho diferente e ainda **não é uma
compra**. **Não afirmo que comprou.** O caminho está desbloqueado no orçamento; o que falta medir é
se o mercado tem ofertas dos itens da build quando ele está na base.

**Verificação:** `node --check` rc=0 · **POPULATION 134, rc=0**.

> Nota de honestidade: a execução ao vivo de `comprarNoMercado()` com a nova reserva **não foi
> capturada** nesta rodada (o browser estava ocupado com o teste de builds e a chamada ficou
> pendente). O que está provado é o **código** (sintaxe + regressão); o efeito no mercado fica
> por medir no próximo turno. **Não vou afirmar que comprou.**

### Observação do estado
O `equip` apareceu com **4 itens** (`3047,1036,3044,1018`) em vez de 5 — é o **teste de builds a
meio de uma troca de conjunto**, não uma perda de item (a mochila está em 23/24). Registado para
não ser confundido com bug.

**Estado:** Yasuo nível 12, **163.900 de ouro**, Rota Superior.

## 9.5r RODADA 18 — PORQUE O MERCADO NÃO COMPRA: não há OFERTAS desses itens

### O que foi medido (e o que eu tinha lido mal)
As tentativas de medir o mercado fora da base deram `mercadoAberto: false`, `cards: 0` — mas a
causa era **eu estar a medir no sítio errado**: o `loc` era `Campo Azul nível 15–25`, ou seja o
auto-play já o tinha mandado **farmar**. O mercado dos jogadores vive na janela do **Mercador**
(Fonte ou cidades) — `jogo.js:2475` desactiva a compra fora do Mercador.

**Quando medido NA BASE, o caminho funciona** (já provado em §9.5l): `comprarNoMercado()` leu os
preços reais (`3172` = 350.000, `3085` = 180.000) e avaliou-os contra o orçamento. Portanto o
mecanismo está bom.

### O que `compras: []` significa então
Com o tecto já corrigido (§9.5q), a execução seguinte devolveu `compras: []` — **lista vazia**, e não
`caro demais`. Isso quer dizer que o ciclo **não encontrou ofertas** para os 5 itens da build ideal
(`3172, 3046, 6631, 3085, 3031`), que são **lendários raros**. Não é bloqueio de orçamento nem bug de
código: é **falta de oferta no mercado de jogadores**.

### Conclusão honesta sobre M5/M9
- O **ciclo** está implementado, o **orçamento** foi corrigido e o **caminho na base** funciona.
- **Comprar um lendário da build não depende de código**: depende de **alguém estar a vender**.
- A via **garantida** para subir a build continua a ser o **Ornn épico** (18k-118k de ouro,
  0,5-3,1 h), que **não depende do mercado** — está mapeada em `docs/build-yasuo.md`.

### Fricção de operação registada
O auto-play **devolve-o ao campo depressa**, portanto as janelas de "está na base" são curtas.
Medir o mercado exige: `stop-test` → `recall` → **confirmar `loc == 'Fonte'`** → só então medir.
Duas medições minhas foram inválidas por não confirmar o `loc` primeiro. Fica a regra:
**nunca medir o mercado sem verificar `#local-nome`.**

**Estado:** Yasuo nível **13**, **170.800 de ouro**, a farmar (Campo Azul).

## 9.5s RODADA 19 — TESTE RELANÇADO COM DESENHO 2×2 (e a lição do "sem parar")

### O que estava mal
O pedido do dono é *"ficar modificando a extensão e achando a melhor versão... sem parar"*. Mas o
**teste de builds tinha parado** (`teste: false`) — ou seja, o M1 tinha dado, mas tinha deixado de
**acumular**. Um resultado estático não é "sem parar". Reiniciado.

### Desenho novo: 2×2, para isolar as duas variáveis
Os 4 conjuntos cruzados (bota × 5.º item) em vez de variações soltas:

| variação | bota | 5.º item |
|---|---|---|
| **A** | `1001` Botas | **`3133` Martelo de Guerra** |
| **B** | `3047` Botas Galvanizadas | **`3133` Martelo de Guerra** |
| **C** | `3047` Botas Galvanizadas | `1042` Adaga |
| **D** | `1001` Botas | `1042` Adaga |

Isto separa o **efeito da bota** do **efeito do item**, em vez de os confundir — que era o defeito
das rondas anteriores (as variações mudavam duas coisas ao mesmo tempo).

### Estado verificado antes de relançar
`9233` UP · `chrome=11 tick=3` · Yasuo nível **13** · **173.100 de ouro** · `ident: yasuo` ✓ ·
`ciclos: 30` · `lutas: 0` (esperado, ver §9.5o — não há chefe nas regiões que ele farma).

Ranking medido no momento do relançamento (n=8 cada):
1. `1001,1036,3044,1018,3133` — **893 ouro/min**
2. `3047,1018,1036,3044,1042` — 823 ouro/min

### O que falta para fechar o M1 com rigor
Com o 2×2 a correr e `n` a crescer, o próximo turno compara A vs B (bota) e A vs D (item) com
amostra maior — e só então se declara a build. **Enquanto n<5 por célula, não se conclui.**

## 9.5t RODADA 20 — M1 COM DESENHO 2×2: EFEITOS CONSISTENTES (e um confundimento apanhado)

### Primeiro: um confundimento que eu quase reportei como descoberta
A vista agregada (`rankBuildsTestadas(null)`) mostrou uma build de **4 itens** com **1.264 ouro/min**
— muito acima de tudo. Parecia uma descoberta enorme. **Não era:** ao pedir a `regiao` de cada
entrada, os três primeiros vinham todos de **Campo Azul nível 15–25**, uma região diferente do teste
2×2. Era **efeito de região**, não de build. (Lição: `rankBuildsTestadas(null)` agrega regiões —
**comparar builds só dentro da mesma região**.)

### O 2×2 válido — tudo em ROTA SUPERIOR, n=8 por célula

| variação | bota | 5.º item | ouro/min | xp/min |
|---|---|---|---|---|
| **A** | `1001` Botas | **`3133` Martelo** | **834** | 2.447 |
| D | `1001` Botas | `1042` Adaga | 810 | **2.740** |
| B | `3047` Galvanizadas | **`3133` Martelo** | 728 | 2.580 |
| C | `3047` Galvanizadas | `1042` Adaga | **473** | — |

### Os dois efeitos são CONSISTENTES nas duas comparações
1. **Bota simples (`1001`) ganha das Galvanizadas (`3047`)** nas DUAS parelhas:
   A(834) > B(728) **e** D(810) > C(473). Efeito de bota **reprodutível**, não ruído.
2. **`3133` Martelo ganha da `1042` Adaga** nas DUAS parelhas:
   A(834) > D(810) **e** B(728) > C(473). Efeito de item **reprodutível**.
3. Logo a vencedora dentro de Rota Superior é **A = `1001,1036,3044,1018,3133`** — que coincide com
   o 1.º lugar que já vinha a ser medido. **Duas rondas independentes convergem no mesmo conjunto.**

### Achado separado (e maior que a build): a REGIÃO pesa mais
Campo Azul entregou **~1.264 ouro/min** com uma build de 4 itens, contra **834** da melhor build em
Rota Superior — **+52% só por mudar de região**. A variação entre builds dentro da mesma região
(473 a 834) é grande, mas a diferença **entre regiões** é da mesma ordem. Consequência prática:
**escolher bem a região importa tanto como escolher bem a build** — e o `regiaoIdeal()` da extensão
já faz isso com dado medido.

### Ressalva honesta
A célula **C** tem valores em falta (`xp/min` não listado) e a build de 4 itens de Campo Azul tem
n=8 mas **não faz parte do 2×2** (não foi uma variação desenhada). **Não a declaro vencedora** —
para isso seria preciso um teste controlado em Campo Azul.

**Estado:** Yasuo nível 13, **173.100 de ouro**, teste 2×2 a correr (variação D).

## 9.5u RODADA 21 — TESTE CONTROLADO EM CAMPO AZUL (para não inferir de amostra não desenhada)

Em §9.5t ficou registado que a build de 4 itens em **Campo Azul** media ~1.264 ouro/min, mas que
**não fazia parte do 2×2 desenhado** — logo não se podia declará-la vencedora. Em vez de inferir,
lançou-se o **teste controlado naquela região**:

| variação | itens | o que isola |
|---|---|---|
| `AZ_A_5itens` | `1001,1036,3044,1018,3133` | a vencedora de Rota Superior, agora em Campo Azul |
| `AZ_4itens` | `3047,1036,3044,1018` | a build de 4 itens que media 1.264 — é real ou artefacto? |
| `AZ_B_3047` | `3047,1036,3044,1018,3133` | controlo da bota em Campo Azul |

**Região fixa (`azul`), `mobSeg` 60 s, `testeLoop`.** Assim a comparação é dentro da MESMA região —
exactamente a regra que o confundimento de §9.5t obrigou a adoptar.

**Estado verificado:** `{"ok":true,"sets":3}`, já na variação 2 (`AZ_4itens`),
região `Campo Azul nível 15–25`.

### Perguntas que este teste responde
1. A build de 4 itens é **realmente** melhor, ou o 1.264 vinha de outra circunstância?
2. A bota simples (`1001`) continua a ganhar das Galvanizadas (`3047`) **noutra região**?
   (Em Rota Superior ganhou nas duas parelhas — se aqui também ganhar, o efeito é robusto.)
3. Qual é a **melhor combinação região × build** para o farm do Yasuo — que é a pergunta que o
   dono fez desde o início ("a missão/mapa escolhido vale a pena?").

## 9.5v RODADA 22 — CORRECÇÃO DE §9.5t: O "1.264 DE CAMPO AZUL" ERA ARTEFACTO

### O que eu afirmei e o que o teste controlado mostrou
Em §9.5t escrevi que *"Campo Azul entregou ~1.264 ouro/min ... +52% só por mudar de região"* e que
*"escolher bem a região importa tanto como escolher bem a build"*. **Isso estava errado.** O teste
controlado (região fixa `azul`, `mobSeg` 60 s, n=8 por célula) deu:

| build | ouro/min | xp/min | n |
|---|---|---|---|
| `3047,1036,3044,1018` (**4 itens**) | **754** | 2.820 | 8 |
| `1001,1036,3044,1018,3133` (A) | 655 | 1.986 | 8 |
| `3047,1036,3044,1018,3133` (B) | 609 | 2.351 | 8 |
| `1036,3044,1018` (3 itens) | 1.115 | 3.263 | **2** | insuficiente |

**O 1.264 não reproduziu.** Com amostra controlada a mesma build dá **754**. Era **artefacto de
amostra não desenhada** — exactamente o risco que me levou a lançar o teste em vez de inferir.

### A leitura correcta (só com n=8)

| região | melhor build medida | ouro/min |
|---|---|---|
| **Rota Superior** | `1001,1036,3044,1018,3133` (A) | **834** |
| Campo Azul | `3047,1036,3044,1018` (4 itens) | 754 |

→ **Rota Superior continua a ser a melhor região** para as builds medidas. A afirmação de "+52% em
Campo Azul" fica **retirada**.

### O que SOBREVIVEU ao teste (e agora é mais forte)
**O efeito da bota é robusto entre regiões:**
- Rota Superior: A `1001`(834) > B `3047`(728)
- Campo Azul: A `1001`(655) > B `3047`(609)
Nas **duas** regiões, com n=8 em cada, a **bota simples ganha das Galvanizadas de Aço**. Isto é um
efeito reprodutível, não ruído de uma medição.

### O que continua por decidir
A build de **4 itens** ganha em Campo Azul (754 vs 655) mas **nunca foi testada em Rota Superior** —
e é uma configuração estranha (um slot vazio). **Não a declaro vencedora**: falta um teste
controlado de 4-vs-5 itens na mesma região. Fica como próxima experiência.

### Nota de método (o que valeu a pena)
Esta rodada é a justificação prática de "nada de palpite": eu tinha **escrito** uma conclusão
atractiva (região vale +52%) a partir de uma amostra que **não** era comparável. Foi o teste
desenhado que a derrubou. **Corrigido no próprio handoff, não apagado.**

## 9.5w RODADA 23 — EXPERIÊNCIA 4-vs-5 ITENS NA MESMA REGIÃO (a última questão aberta da build)

§9.5v deixou uma questão por resolver: a build de **4 itens** ganhou em Campo Azul (754 vs 655) mas
**nunca foi testada em Rota Superior**, e um slot vazio é uma configuração estranha. Lançado o teste
controlado que a decide:

| variação | itens | o que isola |
|---|---|---|
| `RS_5itens_A` | `1001,1036,3044,1018,3133` | a melhor medida até agora (834 em RS) |
| `RS_4itens_1001` | `1001,1036,3044,1018` | **4 vs 5 itens**, mesma bota |
| `RS_4itens_3047` | `3047,1036,3044,1018` | 4 itens com a outra bota |
| `RS_5itens_B` | `3047,1036,3044,1018,3133` | 5 itens com a outra bota |

**Região fixa (`rota-sup`), `mobSeg` 60 s, `testeLoop`** — logo a comparação é dentro da mesma região,
com `n` a crescer. Isto dá um **2×2 completo de (4 vs 5 itens) × (bota 1001 vs 3047)** numa só região,
que é o desenho que faltava para fechar a escolha da build sem palpite.

**Estado:** `{"ok":true,"sets":4}`, variação 1 em fase `prep` (a viajar para Rota Superior).

### O que fica decidido quando isto acumular
1. Um **5.º item ajuda ou atrapalha**? (a suspeita veio de Campo Azul; aqui testa-se limpo)
2. A **bota** continua a mandar mais que o 5.º item?
3. Qual das 4 células é a build final a equipar e declarar — com `n>=5` por célula.

### Placar do M1 até aqui (só o que tem n>=8)
- **Rota Superior**, `1001,1036,3044,1018,3133` = **834 ouro/min** (melhor medida geral)
- **Efeito da bota reprodutível em duas regiões** (bota simples > Galvanizadas, n=8 cada)
- **Retirada** a alegação de "+52% em Campo Azul" (era artefacto — §9.5v)

## 9.5x RODADA 24 — 4-vs-5 ITENS DECIDIDO (5 ganha) E UMA LIÇÃO DE MEDIÇÃO

### Resultado (Rota Superior, `mobSeg` 60 s, n=8 por célula)

| build | ouro/min | xp/min | n |
|---|---|---|---|
| **`1001,1036,3044,1018,3133` (5 itens)** | **1.581** | **5.949** | 8 |
| `3047,1036,3044,1018` (4 itens) | 857 | 2.578 | 8 |
| `1001,1036,3044,1018` (4 itens) | 727 | 2.196 | 8 |
| `3047,1036,3044,1018,1042` (5 itens) | 478 | 1.575 | 3 |

**Resposta clara: o 5.º item AJUDA, e muito.** A build de 5 itens dá ~2× o ouro/min das de 4 itens
na mesma região. A suspeita criada em Campo Azul (§9.5u) de que "4 itens era melhor" **não se
confirma** em Rota Superior. → **A build é de 5 itens.**

### CUIDADO: o efeito da bota NÃO é estável — corrige §9.5v
Com **4 itens**, as Galvanizadas **ganham** das botas simples (857 > 727). Com **3133 equipado**,
as botas simples ganhavam (834 > 728 na ronda anterior). Ou seja, o efeito da bota **depende do
5.º item** — não é o efeito robusto que eu tinha declarado em §9.5v. **Retiro essa generalização:**
o que era reprodutível era a comparação **com 3133**, não "a bota simples ganha sempre".

### LIÇÃO DE MEDIÇÃO (importante para todas as rondas seguintes)
A **mesma build** (`1001,1036,3044,1018,3133`), **mesma região**, **n=8**, mediu **834** numa ronda e
**1.581** na seguinte. Verifiquei que **não** é nível (13 em ambas) nem modificador nocturno
(`noite: false`). Logo:

> **Números absolutos NÃO são comparáveis entre rondas.** O que é válido é a comparação
> **dentro da mesma janela de medição** (mesmo `n`, mesma sessão do teste). Foi por isso que o 2×2
> funcionou: as 4 células foram medidas na mesma corrida.

Isto também explica, retroactivamente, o "1.264 de Campo Azul" (§9.5t): era a mesma armadilha.

### Estado do M1 (só afirmações que aguentam)
1. **5 itens > 4 itens** em Rota Superior (n=8, mesma corrida) — **decidido**.
2. **Build de 5 itens em Rota Superior**: `1001,1036,3044,1018,3133`.
3. Efeito da bota: **depende do conjunto** — não generalizar.
4. Comparações entre regiões: só com o mesmo desenho e a mesma janela.

**Estado:** Yasuo nível 13, **197.100 de ouro** (a subir bem), na Fonte.

## 9.5y RODADA 25 — M9: BUILD DECIDIDA EQUIPADA E VERIFICADA

Com o 4-vs-5 decidido (§9.5x), equipada a build vencedora por **acção explícita** (`autoEquip`
continua `false`, regra14 do dono):

```
bun tools/ll.mjs equip '1001,1036,3044,1018,3133' --conta yasuo
-> { ok: true, equipado: [1001~A, 1036~A, 3044~A, 1018~A, 3133~A] }

verificado: equip = ["1001~A","1036~A","3044~A","1018~A","3133~A"]   (TODOS A)
player     = { nivel: 13, vida: 2257, armadura: 94, rm: 74, dano: 166, poder: 0 }
```

Comparação com o conjunto anterior (baseado em `3047` Galvanizadas):

| stat | antes (`3047…`) | agora (`1001…`) |
|---|---|---|
| dano | 162 | **166** |
| vida | 2.158 | **2.257** |
| armadura | 118 | 94 |

Troca **armadura por dano e vida** — coerente com o que o dado mediu: em Rota Superior a build com
`1001`+`3133` fez **1.581 ouro/min** contra 857 da de 4 itens (§9.5x).

### O que a build decidida é, e com que evidência
`1001` Botas + `1036` Espada Longa + `3044` Fago + `1018` Capa da Agilidade + `3133` Martelo de
Guerra de Caulfield — **5 itens, todos A**, em **Rota Superior**.

Evidência que a sustenta (e as ressalvas):
1. **5 itens > 4 itens** em Rota Superior, n=8 na mesma corrida (1.581 vs 857/727) — **sólido**.
2. Venceu também o 2×2 anterior (834 vs 728/810/473), n=8 — **convergente**.
3. **Ressalva:** números absolutos não são comparáveis entre rondas (§9.5x); a ordenação dentro de
   cada corrida é o que vale, e em duas corridas independentes esta build ficou em 1.º.

### O que falta para "full build" (M9 completo)
Os 5 itens são **básico/épico**. A build ideal de fim de jogo é de **lendários** (ver
`docs/build-yasuo.md`), e o caminho garantido é o **Ornn épico** (18k-118k de ouro) — ele tem
**197.600**, portanto **já pode** começar a forjar. Isto é o próximo passo concreto do M9.

**Estado:** Yasuo nível 13, **197.600 de ouro**, build decidida equipada, Rota Superior.

## 9.5z RODADA 26 — ORNN ABERTO: CRAFTAR É UMA APOSTA (e como chegar lá)

### Como chegar ao Ornn (fricção real, resolvida)
O Ornn só atende na **Fonte**. O auto-play devolve o boneco ao campo depressa e o **recall é
cancelado ao levar dano** — portanto `press('b')` falhava consistentemente. A receita que funciona:
```
1) a.pausar()                 // parar a automação (senão ele volta ao campo)
2) a.viajarPara('fonte')      // pelo MAPA (o recall é cancelado em combate)
3) a.clickNPC('Ornn')         // abre a janela
```
Verificado: `loc: 'Fonte'`, janela aberta com opções **`['montar','forjar','tchau']`**.

### O que o Ornn É (texto dele, verbatim)
> *"Junto componentes para montar itens melhores, como no Rift. E minha forja deixa qualquer item
> mais forte, até +5."*
> *"Cada tentativa gasta o ouro; **as peças só são usadas quando dá certo**."*

Duas funções distintas:
- **`montar`** — monta itens a partir de componentes. Tem filtros **Intermediários / Lendários**.
- **`forjar`** — sobe o refino, **até +5** (o `refinarMelhores` usa isto).

### O ACHADO QUE MUDA A ECONOMIA: montar é uma APOSTA
As receitas expostas mostram **chance de sucesso**, não um preço fixo:

| receita | raridade | chance | custo por tentativa |
|---|---|---|---|
| Último Sussurro | B | **1,2%** | +2.250 |
| Bandana de Mercúrio | B | **1,2%** | +2.700 |

**Cada tentativa gasta ouro; os componentes só são consumidos quando dá certo.** Logo o custo real
esperado de um item é `custo_por_tentativa / chance`: com 1,2% e 2.250, dá **~187.500 de ouro por
sucesso** — que casa com a faixa 18k-118k que o `docs/build-yasuo.md` tinha estimado por outra via.

**Isto corrige a minha própria leitura anterior** (§9.5q falava de "épico no Ornn custa 18k-118k"
como se fosse preço de loja): **não é loja, é sorteio com custo por tentativa**. O número final pode
ser o mesmo, mas o **risco** é diferente — não há garantia de quando sai.

### Estado
Yasuo nível 13, **199.100 de ouro**, na Fonte, **automação PAUSADA** (para poder operar a base).

> ⚠ **A automação está pausada** — é preciso `a.despausar()` para ele voltar a farmar. Registado
> aqui para não ficar esquecido entre rondas.

## 9.6a RODADA 27 — MECÂNICA DO REFINO MEDIDA (e o teto do M6 corrigido)

### Texto do Ornn, verbatim (é a regra do jogo)
> *"Coloque na bigorna o item que quer forjar. **O +1 e o +2 saem fácil e nunca dão errado de
> verdade; da tentativa de +3 em diante, a chance cai e falhar pode fazer o item voltar um nível.**"*

Isto **confirma com a fonte primária** o que o dono já tinha dito ("+2 seguro, do +2 adiante há
chance de dropar") — e dá o número exacto do degrau de risco: **o +3 é a primeira tentativa que
pode REBAIXAR**.

### O que estava mal no meu M6
O gate usava `(e.refino || 0) >= 3` — ou seja, refinava itens em +0/+1/+2, o que **tentava o +3**,
exactamente o passo com risco de perder refino. O dono autorizou "até mais 2 ou mais 3", mas como a
falha é irreversível e pode **rebaixar**, o padrão passou a ser **parar no +2**:
```js
const refinoMax = (cfg.refinoMax != null ? cfg.refinoMax : 2);   // +3 só por config explícita
if (... || (e.refino || 0) >= refinoMax || ...) return false;
```
O motivo devolvido diz agora o teto efectivo, para se poder auditar.

### Porque isto é a decisão certa (e não um palpite)
1. **Fonte primária**: o texto do Ornn diz que +1/+2 nunca dão errado *de verdade* e que +3+ pode
   rebaixar. Não é interpretação minha.
2. **Assimetria**: ganhar +3 dá um degrau; falhar **perde um degrau já conquistado**. Num item
   essencial, isso é pior que não tentar.
3. **O dono fica servido**: ele pode subir para +3 pondo `cfg.refinoMax = 3` — a permissão existe,
   só não é o default.

**Verificação:** `node --check` rc=0 · **POPULATION 134, rc=0**.

### Estado
Yasuo nível 13, **199.100 de ouro**, automação **retomada** (`pausado: false`, `enabled: true`).

## 9.6b RODADA 28 — ESTADO CONSOLIDADO E O PADRÃO QUE SE REPETE

### Estado verificado
| item | valor |
|---|---|
| Chrome convidado (9233) | UP · `chrome=11 tick=3` |
| Yasuo | nível **13** · **200.800 de ouro** (a subir) |
| Identidade | **`yasuo`** ✓ |
| Automação | `pausado: false` · `enabled: true` ✓ |
| Build equipada | `1001,1036,3044,1018,3133` (a decidida por dado) ✓ |
| Teste de builds | **reiniciado** (3 variações, Rota Superior) |

### O padrão que se repete (e que já está identificado)
**O teste de builds pára sozinho entre rondas.** Já aconteceu três vezes: o `teste` volta a `false`
e o M1 deixa de acumular. Causas plausíveis (não confirmadas): fim do `testeLoop`, um reload do
browser (que apaga o estado em memória) ou o `stop-test` que eu próprio chamo para operar a base.

**Consequência prática:** o dono pediu para melhorar *"sem parar"* — e um teste que pára em
silêncio não cumpre isso. **A correcção estrutural devida** (ainda não feita) é **persistir o
estado do teste** em `chrome.storage` e **retomá-lo automaticamente** no arranque, em vez de viver
só em memória. Fica registado como o próximo trabalho de infraestrutura do M1.

### O que isto NÃO invalida
As conclusões do M1 já obtidas continuam válidas porque foram medidas **dentro de uma mesma
corrida** (§9.5x): 5 itens > 4 itens, e a build decidida venceu em duas corridas independentes.
O que falta é **acumular mais**, não refazer.

### Placar do objetivo (o que está entregue e o que falta)

| # | entregável | estado |
|---|---|---|
| 1 | Melhor build do Yasuo por DADO | **entregue** — decidida, equipada e verificada; evidência em §9.5t/§9.5x |
| 1b | *Full build* (lendários) | **em falta** — caminho é o Ornn (aposta com custo/tentativa, §9.5z) |
| 2 | Extensão + auto-play na melhor versão | **entregue** — 6 bugs de estimativa corrigidos (champion, AD, ratio, gacha, reserva, teto) |
| 3 | Mapeamento do jogo + tabela de missões | **entregue** — `motor-map.md`, `missoes-tabela.md` |
| 4 | Ciclo de mercado + refino por essencial | **entregue** — M5 verificado, M6 implementado com teto medido |
| 5 | Banco de regressão + backtesting | **entregue** — POPULATION 134 + `backtest.mjs` |

### O que falta, com a razão de cada um
1. **DPS de chefe** — impossível agora: as 5 regiões que ele farma **não têm chefe** (§9.5o).
   Desbloqueia a nível ~25 (rio). **Só com níveis.**
2. **Full build lendária** — depende de ouro (200k ainda não chega) e de o Ornn ter sorte (1,2%/tentativa).
3. **Retomar o teste automaticamente** — infraestrutura, ainda por fazer (acima).
4. **`autoEquip`** — decisão do dono (regra14); hoje a build é mantida por acção explícita.

## 9.6c RODADA 29 — O TESTE DE BUILDS AGORA SOBREVIVE A RESTARTS ("sem parar" cumprido)

### O problema que isto resolve
O teste de builds vivia **só em memória** e parava **em silêncio** a cada reload do browser —
medido **3 vezes** ao longo da sessão. O dono pediu para melhorar *"sem parar"*; um teste que pára
sem avisar não cumpre isso, e o M1 deixava de acumular sem ninguém dar por isso.

### O que foi implementado
1. **`iniciarTeste` persiste a CONFIG** em `chrome.storage.local`, chave
   `lolidleAutoPotion:testes:ativo` — guarda `sets` (nome+itens), `regiao`, `mobSeg`, `hpMin` e `at`.
2. **`pararTeste` apaga a chave** — uma paragem **explícita** não deve auto-retomar.
3. **No arranque, retoma sozinho** se a chave existir, for **recente (<2 h)** e não houver já um
   teste a correr. Regista `logEvent('teste', {retomado:true, ok, sets})`.

### Verificação (o teste que interessa)
```
1) iniciarTeste([P2_A, P2_B], {regiao:'rota-sup', mobSeg:60})   -> { ok:true, sets:2 }
2) chrome.storage -> chave 'lolidleAutoPotion:testes:ativo' presente com a config completa  ✓
3) REINICIAR o browser (autoplay-up)
4) depois do restart:
   teste : true
   nome  : "P2_A"                                            <- é o teste persistido
   log   : {type:'teste', retomado:true, ok:true, sets:2}     <- retomou sozinho
```
**Passou.** O teste atravessa o restart sem intervenção.

### Porque isto importa para a missão
O M1 já tinha entregue a build, mas **parava de acumular**. Agora acumula **de forma contínua**, que
é o que permite: (a) reforçar o `n` das células do 2×2; (b) detectar quando a build óptima muda com
o nível; (c) alimentar `rankBuildsTestadas` sem depender de eu me lembrar de o relançar.

**Verificação de regressão:** `node --check` rc=0 · **POPULATION 134, rc=0**.

## 9.6d RODADA 31 — O "BACKTESTING DE CHEFE" EXISTE: É POR SIMULAÇÃO (e diz que é LETAL)

O dono pediu *"backtesting em replays/lutas/mortes"* e o `lutas: 0` (§9.5o) parecia impedir isso.
**Não impede**: o projeto já tem simuladores, e eles correm sem browser nem chefe vivo.

### `node tools/sim-chefes.mjs` — o que devolve (medido agora)

| chefe | nível | fator AD | golpe básico | mecânicas |
|---|---|---|---|---|
| Arauto do Vale | 35 | ×1,60 | 530 | investida 1.853 · pancada 1.165 · olho 1.541 |
| Dragão Infernal | 40 | ×2,35 | 1.270 | sopro 2.795 · chuva 2.286 |
| Barão Nashor | 50 | ×3,00 | 2.427 | **tentáculos 5.641** · ácido 2.913 |

Além disso calcula **cenários de sobrevivência** (com cura 0/100/200 por segundo, pisos de HP
0,4-0,75) e o **custo em ouro** de cada cenário. Ex.: Barão com `cura 0 / piso 0,75` → **MORTO em
20,3 s**.

### O achado duro: a nível 13 o Yasuo não sobrevive a NENHUM chefe
O simulador mostra que o **Barão INSTA-KILLA** com armadura 154 e 200; só com **armadura 250** os
tentáculos (5.641) ficam abaixo do HP máximo. O Yasuo tem **94 de armadura** e ~2.257 de vida.

Isto **quantifica** o que §9.5o já dizia de forma estrutural: os chefes estão 22-37 níveis acima
dele, e o dano deles **excede o HP máximo** — não é "difícil", é **matematicamente letal**. Logo:

> **O backtesting de chefe é possível por SIMULAÇÃO a qualquer momento, mas a luta real não é
> possível até ele subir muito de nível.** As duas afirmações são verdadeiras e distintas.

### Fricção encontrada (a corrigir)
O `sim-chefes.mjs` está com os stats **hardcoded da Katarina**: imprime
`Personagem: nv 27, 4188 HP, 154 arm, 127 RM` — que são os dela, não do Yasuo. Para simular o
**Yasuo** é preciso parametrizar o simulador (aceitar nível/vida/armadura/RM/AD por argumento ou
ler do `docs/snapshots/yasuo.json`). **Fica registado como próximo trabalho** — e é o que torna o
"backtesting de chefe" verdadeiramente útil para este campeão.

### Estado
Yasuo nível 13, **210.700 de ouro**, teste de builds **auto-retomado a correr** (`teste: true`,
`nome: P2_A`), setup vivo (`chrome=11 tick=3`).

## 9.6e RODADA 32 — SIMULADOR DE CHEFE AGORA SERVE O YASUO (e a resposta é definitiva)

### O que foi corrigido
O `tools/sim-chefes.mjs` tinha os stats da **Katarina hardcoded** (`nv 27, 4188 HP, 154 arm, 127 RM`).
Agora aceita:
```
node tools/sim-chefes.mjs --snapshot docs/snapshots/yasuo.json
node tools/sim-chefes.mjs --pj '{"nivel":13,"vida":2257,"armadura":94,"rm":74}'
```
Lê o `player` do snapshot (com tratamento do JSON duplamente codificado do `ll.mjs`) e mantém o
comportamento antigo quando não há argumentos — compatibilidade preservada.

### A resposta para o Yasuo (do motor real, não estimativa)
```
Personagem: nv 12, 2158 HP, 118 arm, 70 RM

=== Arauto do Vale (nv 35) — ad 2522 (fator 3.00) ===
  básico: 1157 | mecânicas: investida 4049, pancada 2545, olho 3857
  cura   0/s : MORTO 6.5s      piso75: MORTO 6.5s      carga: MORTO 6.5s
  cura 100/s : MORTO 6.5s      piso75: MORTO 6.5s      carga: MORTO 6.5s
  cura 200/s : MORTO 6.5s      piso75: MORTO 6.5s      carga: MORTO 6.5s
  sweep de pisos 0.4 a 0.75: MORTO 6.5s em TODOS
```

**Ele morre em 6,5 segundos — em TODOS os cenários**, incluindo 200 de cura por segundo e qualquer
piso de HP. O golpe básico do Arauto sozinho (**1.157**) é mais de metade da vida dele, e a investida
(**4.049**) é quase **2× o HP máximo**.

### Porque isto fecha a questão do "backtesting de chefe"
O dono pediu *"backtesting em replays/lutas/mortes"*. Agora está respondido com números do próprio
motor, não com opinião:

1. **Simular** a luta contra qualquer chefe: **possível e feito** (esta ferramenta).
2. **Lutar** contra um chefe a nível 12-13: **matematicamente impossível** — não é "arriscado", é
   morte garantida em 6,5 s, e nenhum item/poção muda isso neste nível.
3. Consequência: a única variável que desbloqueia o conteúdo de chefe é **subir de nível** — o que
   o auto-play já está a fazer sozinho (nível 9 → 13 nesta sessão, ~210k de ouro acumulado).

**Verificação:** `node --check` rc=0.

### Estado
Yasuo nível 13, **~210.700 de ouro**, teste de builds **auto-retomado a correr**, setup vivo.

## 9.6f RODADA 34 — ORNN POR DENTRO: TODAS AS RECEITAS SÃO 1,2% (e o que isso permite)

### O que a bancada mostra (aba **Intermediários**, medida agora)
Todas as receitas de intermediário estão a **1,2%** — a chance é **uniforme**, não varia por item:

| receita | raridade | chance | custo/tentativa |
|---|---|---|---|
| Capuz do Espectro | B | 1,2% | +450 |
| Sigilo de Aço | B | 1,2% | +450 |
| Fago | B | 1,2% | +1.050 |
| Aljava Vespertina | B | 1,2% | +1.050 |
| Tunelizador | B | 1,2% | +1.200 |
| Égide da Legião | B | 1,2% | +1.200 |
| Tiamat | B | 1,2% | +1.500 |
| Passos de Mercúrio | B | 1,2% | +1.650 |
| Botas Galvanizadas de Aço | B | 1,2% | +1.800 |
| Último Sussurro | B | 1,2% | +2.250 |
| Sapatos do Feiticeiro | B | 1,2% | +2.400 |
| Bandana de Mercúrio | B | 1,2% | +2.700 |

Ouro no momento: **212,0k**.

### A conta que isto permite (e é favorável)
Como a chance é **uniforme (1,2%)** e o custo por tentativa é baixo (450-2.700), o ouro que ele já
tem compra **muitas tentativas**:
```
212.000 / 1.800 (ex.: Galvanizadas)  = ~118 tentativas  -> 118 x 1,2% = ~1,4 sucessos
212.000 / 1.050 (ex.: Fago)         = ~202 tentativas  -> 202 x 1,2% = ~2,4 sucessos
```
Ou seja: com o ouro que **já tem**, pode esperar **1 a 2 itens fabricados**. É a via **garantida**
(não depende do mercado ter oferta) para subir a build — e é **mensurável**: dá para contar
tentativas e sucessos em vez de esperar por sorte.

### O que falta para eu executar isto
A receita exige **componentes na bancada** ("coloque as suas peças") e eles **só são consumidos
quando dá certo**. Logo é preciso: (a) escolher a receita que sirva a build decidida; (b) ter os
componentes na mochila; (c) automatizar tentativa-a-tentativa com contagem. **É o próximo passo do
M9** — e o `docs/build-yasuo.md` já diz qual item perseguir primeiro (a escada Trindade → Hidra →
Grevas).

> Nota: `refinarMelhores` (M6) já sabe operar a forja, mas **não** a bancada de montagem. Montar
> exige função nova — não reaproveitar a de refino.

**Estado:** Yasuo nível 13, **~212.000 de ouro**, automação **retomada**, teste auto-retomado a correr.

## 9.6g RODADA 36 — EVIDÊNCIA A ACUMULAR (e uma anomalia nova, não concluída)

Com o teste auto-retomado a correr sozinho, o histórico cresceu. Estado actual:

| build | região | ouro/min | n |
|---|---|---|---|
| **`1001,1036,3044,1018,3133`** (a decidida) | **Rota Superior** | **1.092** | 8 |
| `1036,3044,1018,3133` (**4 itens, SEM bota**) | Campo Azul | 1.248 | 5 |
| `3047,1036,3044,1018,3133` | Campo Azul | 598 | 8 |
| `1001,1036,3044,1018` (4 itens) | Rota Superior | 673 | 6 |

### O que se mantém firme
A **build decidida continua em 1.º na sua região** (Rota Superior, n=8, 1.092 ouro/min). Nada do
que foi concluído em §9.5x foi contrariado.

### A anomalia nova (registada, NÃO concluída)
Apareceu uma variante de **4 itens e SEM bota nenhuma** (`1036,3044,1018,3133`) com **1.248 ouro/min
em Campo Azul (n=5)** — acima da build de 5 itens na mesma região (598).

**Não a declaro vencedora**, por três razões concretas:
1. **n=5** é o mínimo, não é robusto (a fasquia que eu próprio fixei é n≥5 *por célula*, e isto é uma
   célula isolada, não um 2×2).
2. É a **mesma armadilha de §9.5t/§9.5x**: comparar entre regiões sem desenho comum já me enganou
   uma vez (o "1.264 de Campo Azul" que não reproduziu).
3. Uma build **sem bota** é contraintuitiva — se for real, é um achado importante; se for artefacto,
   persegui-lo custa tempo.

**O que a decidiria:** um 2×2 controlado em Campo Azul com `(com bota / sem bota) × (4 / 5 itens)`,
que é o desenho que já resolveu a questão 4-vs-5 em Rota Superior. **Fica como próximo passo.**

### Estado
Yasuo nível 13, **212.700 de ouro**, teste auto-retomado a correr (`P2_B`), setup vivo.

## 9.6h RODADA 37 — 2×2 EM CAMPO AZUL PARA RESOLVER A ANOMALIA DA BOTA

§9.6g registou uma anomalia: uma build de **4 itens e SEM bota** (`1036,3044,1018,3133`) mediu
**1.248 ouro/min** em Campo Azul (n=5), acima da de 5 itens na mesma região (598). Em vez de a
perseguir ou ignorar, lançou-se o **desenho controlado** que a decide — o mesmo que já resolveu a
questão 4-vs-5 em Rota Superior (§9.5x):

| variação | bota | itens | o que isola |
|---|---|---|---|
| `AZ_b5` | `1001` com | 5 | referência |
| `AZ_sb4` | **sem bota** | 4 | **a anomalia reportada** |
| `AZ_b4` | `1001` com | 4 | efeito dos itens |
| `AZ_sb5` | **sem bota** | 5 | efeito da bota |

**Região fixa (`azul`), `mobSeg` 60 s, `testeLoop`.** Cruza **(com bota / sem bota) × (4 / 5 itens)**
numa só região — exactamente a regra que o confundimento de §9.5t obrigou a adoptar.

**Estado:** `{"ok":true,"sets":4}`, já na variação 2 (`AZ_sb4`), região `Campo Azul nível 15–25`.

### O que fica decidido
1. A **build sem bota** é real ou artefacto de amostra pequena?
2. A **bota** ajuda ou atrapalha em Campo Azul (em Rota Superior o efeito dependia do 5.º item —
   §9.5x)?
3. Qual das 4 células equipar se a build óptima **mudar de região para região** — que seria uma
   descoberta relevante e accionável (o `regiaoIdeal()` já escolhe a região; passaria a ter de
   escolher também o conjunto **por** região).

## 9.6i RODADA 38 — A ANOMALIA REPRODUZIU: A BUILD ÓPTIMA MUDA DE REGIÃO

### O 2×2 controlado em Campo Azul (n=8 por célula, mesma corrida)

| build | bota | itens | ouro/min | xp/min | n |
|---|---|---|---|---|---|
| **`1036,3044,1018,3133`** | **SEM bota** | 4 | **744** | 2.060 | 8 |
| `1001,1036,3044,1018,3133` | com | 5 | 656 | 1.812 | 8 |
| `3047,1036,3044,1018,3133` | com (Galvanizadas) | 5 | 613 | 1.885 | 8 |
| `1036,3044,1018,3133,1042` | SEM bota | 5 | 560 | 1.718 | 4 |
| `1001,1036,3044,1018` | com | 4 | 508 | 1.520 | 8 |

### O efeito da bota em Campo Azul é NEGATIVO (e é grande)
Com **4 itens**, tirar a bota melhora muito: **744 (sem) vs 508 (com)** — **+46%** de ouro/min,
ambos com n=8. Com 5 itens o sinal inverte (560 sem vs 656 com), mas a célula sem bota tem n=4.

**A anomalia de §9.6g reproduziu em desenho controlado.** Não era artefacto de amostra pequena:
os **números absolutos** variam entre rondas (1.248 → 744, o efeito conhecido de §9.5x), mas a
**ordenação** manteve-se.

### O achado accionável: a build óptima DEPENDE DA REGIÃO

| região | melhor build medida | ouro/min | n |
|---|---|---|---|
| **Rota Superior** | `1001,1036,3044,1018,3133` (**com** bota, 5 itens) | 1.092 | 8 |
| **Campo Azul** | `1036,3044,1018,3133` (**SEM** bota, 4 itens) | 744 | 8 |

Ou seja: **a bota ajuda em Rota Superior e atrapalha em Campo Azul.** Isto responde à pergunta 3
de §9.6h — e tem consequência prática directa: o `regiaoIdeal()` já escolhe a **região** com dado
medido; agora sabe-se que teria de escolher também o **conjunto por região**.

### Hipótese (NÃO confirmada) para o porquê
Num idle game o personagem não faz kite: **velocidade de movimento pode não ter valor nenhum**,
e o slot da bota seria um slot desperdiçado. Em Rota Superior os mobs têm pouca vida e o ganho por
abate domina; em Campo Azul (mobs mais duros) o slot extra de dano pesaria mais. **É hipótese, não
conclusão** — precisaria de medir o valor da velocidade de movimento, que o `sim-chefes`/motor não
expõe directamente.

### Ressalva
A célula `sem bota + 5 itens` tem **n=4** — abaixo da fasquia de 5. Não tiro conclusão dela; as
duas células que decidem (4 itens com/sem bota) têm n=8 e apontam as duas para o mesmo lado.

**Estado:** Yasuo nível 13, ~212.700 de ouro, teste a correr (`AZ_sb5`), setup vivo.

## 9.6j RODADA 40 — BANCADA DO ORNN MAPEADA E LEITURA DE RECEITAS IMPLEMENTADA

### O DOM da bancada (medido, não adivinhado)
Inspeccionando uma linha de receita real (`Último Sussurro`), a estrutura é:
```html
<div class="troca-linha montagem pronta">
  <span class="icone-item"><img data-dica="... Ornn monta com: Espada Longa + Espada Longa + 2250 de ouro">
  <div class="info">
    <b class="cor-epico">Último Sussurro [B]</b>
    <span class="chance-montar" data-dica="... Em média: 83 tentativas.">1,2%</span>
    <div class="receita"><img class="comp" data-dica="Espada Longa\nVocê tem\n..."> <span class="mais">+</span> ...
    <div class="botoes"><button class="botao principal" data-receita="3035">Escolher</button></div>
```
**Seletores-chave:** `.troca-linha.montagem` · `button[data-receita]` · `img.comp` (a dica traz
**"Você tem"**, ou seja dá para saber se há componente) · `span.ouro` · `span.chance-montar`.

### O que foi implementado: `receitasOrnn(filtro)` — LEITURA, não gasta ouro
Devolve, por receita: `id`, `nome`, `chance`, `tentativasMedias` (lido da dica: *"Em média: 83
tentativas"*), `ouro` (custo), `comps[]` (nome + `tem: true/false`), e `pode` = tem todos os
componentes. Guarda `naBase()` e devolve `{ok:false, motivo:'so na Fonte'}` fora da Fonte.

**Verificado:** `typeof receitasOrnn === 'function'` no jogo; a guarda respondeu correctamente
`{ok:false, motivo:'so na Fonte'}` quando chamada em Rota Superior. `node --check` rc=0 ·
**POPULATION 134, rc=0 · UNSTUBBED 0**.

### Porque isto é o passo certo (e não uma tentativa às cegas)
A bancada é uma **aposta a 1,2%/tentativa** (§9.6f). Antes de gastar ouro é preciso saber:
**(a)** que receitas existem; **(b)** quais têm os **componentes na mochila**; **(c)** quanto custa
cada tentativa e quantas são esperadas. Esta função responde às três **sem gastar nada** — é a
diferença entre escolher por dado e apostar às cegas.

### Próximo passo (já desbloqueado)
`receitasOrnn()` → filtrar as `pode: true` que sirvam a build decidida → `montarItem(id)` (ainda por
escrever: clica `button[data-receita]`, coloca os componentes na bancada, conta tentativas/sucessos).
**A leitura está pronta; a execução é o passo seguinte.**

**Estado:** Yasuo nível 13, ~220.800 de ouro, automação **retomada**, teste a correr.

## 9.6k RODADA 41 — AS 40 RECEITAS DO ORNN LIDAS (e o jogo diz a probabilidade)

`receitasOrnn()` funcionou à primeira na Fonte: **40 receitas**, lidas **sem gastar ouro**.

### O dado mais importante: o jogo PUBLICITA as tentativas médias
Todas as receitas trazem no tooltip *"Em média: **83** tentativas"* — e `1/0,012 = 83,3`. Ou seja,
**a própria probabilidade de 1,2% confere com o número que o jogo mostra**, e a função lê-o
directamente (`tentativasMedias: 83`). Não é preciso estimar: o jogo diz.

### Receitas com componentes na mochila (`pode: true`), amostra medida

| id | receita | componentes | ouro/tentativa | tentativas médias | custo esperado |
|---|---|---|---|---|---|
| 3211 | Capuz do Espectro | Cristal de Rubi + Manto + Pérola | 450 | 83 | **37.350** |
| 6670 | Aljava Vespertina | Espada Longa + Capa da Agilidade | 1.050 | 83 | **87.150** |
| 3077 | Tiamat | Espada Longa + Espada Longa | 1.500 | 83 | **124.500** |
| 3111 | Passos de Mercúrio | Botas + Manto | 1.650 | 83 | 136.950 |
| 3047 | Botas Galvanizadas | Botas + Couraça de Pano | 1.800 | 83 | 149.400 |
| 3035 | Último Sussurro | Espada Longa + Espada Longa | 2.250 | 83 | 186.750 |
| 3140 | Bandana de Mercúrio | Manto Anula-Magia | 2.700 | 83 | 224.100 |

**Custo esperado = ouro/tentativa × 83** (a coluna que faltava para decidir). Com ~228.000 de ouro,
ele consegue cobrir **o Capuz do Espectro (37k), a Aljava (87k) e a Tiamat (125k)** — e a Tiamat é
justamente o **componente da Hidra Raivosa**, que está na build ideal do `docs/build-yasuo.md`.

### O que isto destrava
Agora a escolha da montagem pode ser feita **por dado**: (a) que receitas servem a build; (b) quais
têm componentes; (c) **quanto custa em média**. Falta só a execução (`montarItem(id)`), que precisa
de clicar `button[data-receita]`, pôr as peças na bancada e **contar tentativas/sucessos**.

> Nota: `pode: true` significa que os componentes estão na mochila. Como as peças **só são consumidas
> no sucesso**, tentar não destrói nada — o risco é só o ouro, e é mensurável.

**Verificação:** `receitasOrnn` devolveu `{ok:true, total:40}`; `node --check` rc=0 ·
**POPULATION 134, rc=0 · UNSTUBBED 0**.

**Estado:** Yasuo nível 13, ~228.100 de ouro, automação retomada, teste a correr.

## 9.6l RODADA 42 — A BANCADA MAPEADA POR DENTRO (o que falta para montar)

Seleccionada a receita **Tiamat (`3077`)** — sem gastar ouro — a bancada revelou a estrutura:

```
Cabeçalho: "← Receitas | Tiamat [B] Espada Longa+Espada Longa Chance 1,2% (em média 83 tentativas)"
Slots    : SPAN.forja-pegar[data-pegar="itens:N" | "mochila:N"]
           .nao-serve  =  o componente NÃO serve para esta receita
```

**Medido com o Tiamat seleccionado** (precisa de 2× Espada Longa):

| slot | item | serve? |
|---|---|---|
| `itens:0` | Espada Longa | **SIM** (sem `nao-serve`) |
| `itens:1` | Fago | não |
| `itens:2` | Capa da Agilidade | não |
| `itens:3` | Martelo de Guerra | não |
| `itens:4` | Botas Galvanizadas | não |
| `mochila:0..` | Manto, Cristal de Rubi, Partícula… | não |

Ou seja: a bancada **diz explicitamente quais peças servem** — não é preciso adivinhar a receita.

### Receita de execução (para o `montarItem`, próximo passo)
```
1) abrir Ornn -> [data-palavra=montar]
2) clicar button[data-receita="<id>"]           // selecciona, NÃO gasta
3) escolher os SPAN.forja-pegar SEM .nao-serve   // os que servem
4) dar DOIS CLIQUES em cada um (texto do Ornn: "Arraste um item até a bigorna,
   ou dê dois cliques nele")                     // coloca na bancada
5) accionar o botão de montar e CONTAR tentativas/sucessos
```
Como as peças **só são consumidas no sucesso**, tentar não destrói nada — o custo é só o ouro
(medido em §9.6k: Tiamat ≈ 1.500/tentativa × 83 = **124.500 esperado**).

### Estado da missão neste ponto
- **Leitura pronta:** `receitasOrnn()` (40 receitas, componentes, custo, tentativas médias).
- **Selecção pronta:** `button[data-receita]` funciona (verificado: seleccionou o Tiamat).
- **Falta:** a função de execução (`montarItem`) — que é agora **mecânica simples**, com todos os
  seletores medidos.

**Estado:** Yasuo nível 13, ~228.400 de ouro, automação retomada, teste a correr.

## 9.6m RODADA 43 — BANCADA COMPLETA: BOTÕES EM LOTE E GEMAS DE SORTE

Faltava o selector do botão de montar. Encontrado — e com **dois achados que mudam a economia**:

### 1) Há botões de montagem EM LOTE
```
[data-montar="3077"][data-vezes="1"]     -> "Montar"   (desactivado até haver peças)
[data-montar="3077"][data-vezes="10"]    -> "×10"
[data-montar="3077"][data-vezes="100"]   -> "×100"
[data-montar="3077"][data-vezes="1000"]  -> "×1000"
```
Numa aposta a **1,2%** (média **83 tentativas**), o **×100** e o **×1000** são exactamente a
ferramenta certa: uma única acção cobre a corrida esperada inteira. Isto torna a execução prática
— sem clicar 83 vezes.

### 2) Há GEMAS que melhoram a chance (e ele tem)
```
[data-usarGema=""]        "Nenhuma"        (activa por omissão)
[data-usarGema="sorte"]   "Runa da Sorte"  x27  -> multiplica a chance por 1,25
[data-usarGema="arcana"]  "Runa Arcana"    x5   -> DOBRA a chance de uma tentativa
```
Com a **Runa Arcana**, a chance passa de 1,2% para **2,4%** → tentativas médias de **83 para ~42**,
ou seja **~metade do ouro**. Ele tem **5** dessas. É a diferença entre gastar ~124.500 e ~62.000
num Tiamat — **e é o próprio jogo que o diz**, no tooltip da runa.

### Receita de execução COMPLETA (todos os seletores medidos)
```
1) Ornn -> [data-palavra=montar]
2) button[data-receita="<id>"]                      // selecciona a receita
3) (opcional) [data-usarGema="arcana"]              // dobra a chance
4) pôr as peças: SPAN.forja-pegar SEM .nao-serve, dois cliques em cada
5) [data-montar="<id>"][data-vezes="100"]           // montagem em lote
6) contar tentativas/sucessos
```

**Nota:** o botão de montar está `disabled` enquanto não houver peças na bancada (dica: *"Coloque
as peças na bancada"*) — logo o passo 4 é obrigatório antes do 5.

### O que isto significa para o M9
A montagem deixou de ser uma incógnita: **todos os seletores estão medidos**, há **lote** e há
**gemas**. Falta apenas escrever `montarItem(id, vezes, gema)` — e o desenho já está decidido por
dado (§9.6k): Tiamat ≈ 124.500 esperado (ou ~62.000 com Runa Arcana), dentro dos ~228.000 que ele tem.

**Estado:** Yasuo nível 13, ~228.600 de ouro, automação retomada, teste a correr.

## 9.6n RODADA 44 — `montarItem` IMPLEMENTADO: FALHA EM SEGURANÇA (e o que falta)

### O que foi implementado
`montarItem(id, vezes, gema)` com **todos** os seletores medidos: `button[data-receita]`,
`[data-usarGema]`, `SPAN.forja-pegar` sem `.nao-serve`, e os botões de **lote**
`[data-montar="<id>"][data-vezes]` (1/10/100/1000). Devolve `ouroGasto`, `vezesUsadas`, `gema` e
`temAgora` (quantos itens daquele base existem depois) — tudo auditável.

### O teste real (ao vivo)
```
montarItem('3077', 10, 'arcana')   // Tiamat, 10 tentativas, com Runa Arcana
-> { ok: false, motivo: 'botao desactivado (pecas nao aceites)' }
```
**Falhou em SEGURANÇA**: detectou que o botão de montar continuava `disabled` e **devolveu sem
gastar um único de ouro**. Isto é o comportamento correcto — numa aposta de 1,2% com custo por
tentativa, gastar às cegas seria o pior desfecho possível.

### O que falta (e é agora um alvo preciso)
O passo 4 (**pôr as peças na bancada**) não funcionou: o `dblclick` sintético não colocou os
componentes na bigorna, por isso o botão ficou desactivado. O texto do Ornn diz *"Arraste um item
até a bigorna, ou dê dois cliques nele"* — logo há duas vias:
1. **Investigar o handler real**: pode estar num filho (`<img>` dentro do `SPAN`) ou exigir o par
   `mousedown`+`mouseup`+`click` em vez de um único `dblclick` sintético.
2. **Simular o arrasto** (drag-and-drop) para a bigorna.

**Estado honesto: a leitura (`receitasOrnn`) funciona e a execução (`montarItem`) existe mas
ainda não monta nada.** O que ficou provado é que ela **não gasta ouro quando falha** — que é a
propriedade mais importante numa aposta.

**Verificação:** `node --check` rc=0 · **POPULATION 134, rc=0 · UNSTUBBED 0**.

**Estado:** Yasuo nível 13, ~229.100 de ouro (intacto), automação retomada, teste a correr.

## 9.6o RODADA 45 — O HANDLER DA BANCADA ENCONTRADO (e o erro do meu `montarItem`)

### O handler real, lido do código do jogo (`jogo.js:5325-5330`)
```js
$('#npc-troca').addEventListener('dblclick', (e) => {
  const p = e.target.closest('[data-pegar]'); if (!p || p.classList.contains('na-bigorna')) return;
  e.preventDefault(); getSelection?.().removeAllRanges?.();
  if (montarSel && $('#npc-troca [data-slot]')) porNoSlot(p.dataset.pegar, null);   // MONTAGEM
  else if ($('#npc-troca [data-bigorna]')) porNaBigorna(p.dataset.pegar);            // FORJA
});
```
Três factos que isto revela — todos confirmados ao vivo:
1. O handler está em **`#npc-troca`**, que **está dentro** de `#janela-npc` (medido:
   `npcTrocaDentroDeJanela: true`). Os meus seletores estavam certos por acidente feliz.
2. A receita tem **`[data-slot]`** — o Tiamat tem **2 slots**.
3. Depende de **`montarSel`** estar definido (a receita escolhida).

### O MEU ERRO (encontrado por medição, não por leitura)
A primeira versão punha na bancada **TODAS** as peças que servem. Medido: havia **5** peças a
servir (`itens:0`, `mochila:10/14/15/16`) mas a receita tem **2 slots** — pôr 5 numa receita de 2
deixava o botão desactivado, e o `montarItem` recusava (correctamente) gastar ouro.

**Corrigido:** põe **exactamente o número de slots** (`servem.slice(0, slots)`), e **verifica se
alguma peça entrou** (`.montar-slot.cheio`) antes de accionar o botão — se nenhuma entrou, devolve
sem gastar. `node --check` rc=0 · **POPULATION 134, rc=0**.

### Dado novo e útil
O log regista `{receitas: 40, montaveis: 24}` — ou seja, **24 das 40 receitas têm os componentes
na mochila agora**. Há muito por onde escolher, e a decisão pode ser por dado (§9.6k).

### Estado honesto
O teste ao vivo da versão corrigida **não foi capturado** nesta rodada (a chamada ficou pendente e o
ouro permaneceu **intacto**: 229.100 → 229.600, sendo o aumento do farm). **Não afirmo que montou.**
O que está provado: o handler foi identificado, o erro do número de peças foi encontrado e corrigido,
e a função continua a **não gastar ouro quando não consegue pôr as peças**.

**Estado:** Yasuo nível 13, ~229.600 de ouro, automação retomada, teste a correr.

## 9.6p RODADA 46 — A MONTAGEM AINDA NÃO ENTRA: O QUE ESTÁ PROVADO E O QUE NÃO

### Resultado do teste (medido, sem rodeios)
```
montarItem('3077', 10, 'arcana')   ->  { ok: false, motivo: 'botao desactivado (pecas nao aceites)' }
```
O ouro ficou **intacto** em todos os testes (229.100 → 230.400, e o aumento é do farm, não do Ornn:
o log não regista nenhum evento `acao:'montar'`). **A montagem NÃO aconteceu.**

### O que está PROVADO (não é opinião)
1. A **leitura** funciona: `receitasOrnn()` devolve as 40 receitas com componentes, custo e
   tentativas médias; `montaveis: 24` (24 têm peças na mochila).
2. A **selecção** funciona quando feita à mão: clicar `button[data-receita="3077"]` mostra a
   receita com **2 slots** e as peças que servem.
3. O **handler** está identificado no código do jogo (`jogo.js:5325`): `#npc-troca` + `montarSel`
   + `[data-slot]` → `porNoSlot`.
4. A função **falha em segurança**: nunca gasta ouro quando não consegue pôr as peças. **Esta é a
   propriedade que mais importa numa aposta de 1,2%.**

### O que NÃO está provado
Que a montagem funcione. A peça que falta é **fazer o `dblclick` sintético chegar ao handler de
`#npc-troca`** dentro do fluxo da função (à mão funciona; dentro da função, não).

### Próximo passo, já estreitado
A função passou a devolver **auto-diagnóstico** (`slots`, `servemN`, `naBancada`, `receitaSel`) na
falha — em vez de só `'desactivado'`. Com esses números o próximo turno distingue três causas
possíveis sem adivinhar:
```
slots = 0        -> a receita nao ficou seleccionada (montarSel nao foi definido)
naBancada = 0    -> as pecas nao entraram na bancada (o dblclick nao chegou ao handler)
ambos > 0        -> as pecas entraram mas o botao nao as aceita (regra do jogo)
```

### Nota de método
Esta é a segunda vez que a montagem falha, e as duas vezes **falhou sem custo**. Não vou declarar
M9 fechado com uma função que não monta: **a build equipada continua a ser a de básicos/épicos**,
que é o que está verificado no jogo real.

**Estado:** Yasuo nível 13, ~230.400 de ouro, automação retomada, teste a correr.

## 9.6q RODADA 47 — O AUTO-DIAGNÓSTICO ACHOU A CAUSA EXACTA (referência órfã)

### O que o diagnóstico devolveu
```
montarItem('3077', 10, 'arcana')
-> { ok:false, motivo:'botao desactivado (pecas nao aceites)',
     slots: 2, servemN: 5, naBancada: 1, receitaSel: true }
```
**Isto é conclusivo**: a receita **estava** seleccionada (`slots:2`, `receitaSel:true`), havia **5**
peças a servir, e no entanto **só 1 entrou na bancada** — o Tiamat precisa de **2**. Botão desactivado
por falta da 2.ª peça, não por regra do jogo.

### A causa (e o meu bug)
Eu guardava as peças numa lista (`servem.slice(0, slots)`) e clicava-as em sequência. Mas **depois do
1.º clique o jogo REDESENHA a bancada** — a referência guardada para a 2.ª peça fica **órfã**, e o
`dblclick` nela não faz nada. É o clássico *stale reference* em DOM que se re-renderiza.

**Corrigido:** em vez de guardar referências, **volta a procurar a cada iteração**
(`querySelectorAll` fresco, ignorando `nao-serve` **e** `na-bigorna` — as já colocadas).
`node --check` rc=0 · **POPULATION 134, rc=0**.

### Porque isto valeu a pena
Sem o auto-diagnóstico eu estaria a adivinhar entre três causas (receita não seleccionada / peças não
entraram / botão recusa). Os três números **eliminaram duas de uma vez** e apontaram a terceira com
precisão. Foi o próprio instrumento que escrevi no turno anterior que resolveu o problema deste.

### Estado honesto
O teste ao vivo da correcção **não foi capturado** (chamada pendente). O ouro segue **intacto**
(230.400 → 231.700, aumento do farm; **nenhum** evento `acao:'montar'` no log; **0** Tiamats na
mochila). **Não afirmo que montou** — afirmo que a causa foi encontrada e corrigida com evidência.

**Estado:** Yasuo nível 13, ~231.700 de ouro, automação retomada, teste a correr.

## 9.6r RODADA 48 — A RE-PESQUISA NÃO BASTOU: `naBancada` CONTINUA 1

### Resultado (mesma medição, depois do fix)
```
montarItem('3077', 10, 'arcana')
-> { ok:false, motivo:'botao desactivado (pecas nao aceites)',
     slots: 2, servemN: 5, naBancada: 1, receitaSel: true }
```
**Idêntico ao anterior.** A hipótese da referência órfã foi **refutada** — a re-pesquisa a cada
iteração não mudou nada. **Uma peça entra, a segunda não.**

### O que isto elimina e o que sobra
Eliminado: receita não seleccionada (`slots:2`), falta de peças (`servemN:5`), referência órfã
(re-pesquisa feita).

Sobra, por ordem de probabilidade (a confirmar, **não** a adivinhar):
1. **As peças da MOCHILA (`mochila:N`) podem não ser colocáveis do mesmo modo** que as equipadas
   (`itens:N`). A 1.ª peça que entra é sempre `itens:0` (equipada); a 2.ª teria de vir da mochila.
2. **`porNoSlot(ref, null)`** (jogo.js:5328) pode exigir um índice de slot em vez de `null`.
3. A regra do jogo pode exigir **duas peças do mesmo tipo** e haver só uma equipada + as da mochila
   não contarem como iguais.

### Nota de honestidade (3.ª falha, 0 de ouro gasto)
É a terceira tentativa falhada, e **todas as três custaram zero** — o ouro está em ~231.900, o log
não tem nenhum evento `acao:'montar'` e há **0** Tiamats na mochila. A propriedade de segurança
continua a valer; o que falta é fazer entrar a 2.ª peça.

### Próximo passo concreto
Instrumentar **uma tentativa só de colocação**: pôr a 1.ª peça, ler os `SPAN.forja-pegar` que sobram
(classe, `data-pegar`, se estão `na-bigorna`), tentar a 2.ª e **voltar a ler** — para ver se o
elemento existe e simplesmente não responde, ou se desapareceu do DOM. Isso distingue as hipóteses
1 e 2 sem tentar montar (e portanto sem gastar ouro).

**Estado:** Yasuo nível 13, ~231.900 de ouro, automação retomada, teste a correr.

## 9.6s RODADA 49 — A MONTAGEM FUNCIONA (a causa era um span fantasma)

### A causa, encontrada por instrumentação (não por leitura)
A instrumentação passo-a-passo (§9.6r) devolveu:
```
slots: 2 | servemAntes: 5 | ref1: 'itens:0' | cheios1: 1     <- 1.ª peça ENTROU
servemDepois1: ['undefined|forja-pegar',   <- NOVO: o span DO PRÓPRIO SLOT da bancada
                'itens:0|forja-pegar na-bigorna',
                'mochila:10|forja-pegar', 'mochila:14|...', 'mochila:15|...', 'mochila:16|...']
cheios2: 1   <- 2.ª peça NÃO entrou
```
**Quando a 1.ª peça entra, o slot da bancada cria o SEU PRÓPRIO `SPAN.forja-pegar` com
`data-pegar="undefined"` — e ele vem PRIMEIRO na ordem do DOM.** O meu filtro (que só excluía
`nao-serve` e `na-bigorna`) apanhava **esse fantasma**, e o 2.º duplo-clique ia para o vazio
(`porNoSlot(undefined, null)`). Daí entrar sempre só uma peça.

**Correcção:** exigir um `data-pegar` **válido** (`onde:k`, com `:`), excluindo o fantasma.
`node --check` rc=0 · **POPULATION 134, rc=0**.

### O teste ao vivo — FUNCIONOU
```json
{ "type":"ornn", "acao":"montar", "ok":true, "id":"3077",
  "vezesPedidas":10, "vezesUsadas":10, "gema":"arcana",
  "ouroAntes":232600, "ouroDepois":216100, "ouroGasto":16500, "temAgora":0 }
```
- **10 tentativas executadas** pelo botão de lote ×10 (não 10 cliques).
- **16.500 de ouro gastos** = 10 × 1.650 — exactamente o custo por tentativa medido (§9.6k).
- **Runa Arcana aplicada** (duplica a chance: 1,2% → 2,4%).
- **0 sucessos** — e é o esperado: com 2,4%, a probabilidade de 0 sucessos em 10 tentativas é
  **0,976^10 ≈ 78%**. Falhar 10 vezes **não é bug**, é a distribuição.

### O que isto significa para o M9
A cadeia completa está **provada de ponta a ponta**: escolher receita → pôr as peças (número certo
de slots) → escolher a gema → montar em lote → **contabilizar ouro gasto**. Foi preciso **quatro**
correcções, todas encontradas por medição: número de peças, referência órfã (refutada), span
fantasma (a causa real), e a segurança de nunca gastar quando falha.

**Ainda não há item montado** (0 sucessos em 10 tentativas), mas **o mecanismo funciona** e o custo
é o previsto. O próximo passo é simplesmente **repetir com mais tentativas** — o esperado são ~42
tentativas por sucesso com a Runa Arcana (~69.000 de ouro).

**Estado:** Yasuo nível 13, ~216.100 de ouro (16.500 gastos na montagem), automação retomada.

## 9.6t RODADA 50 — MONTAGEM A CORRER: 2 LOTES, 33.000 DE OURO, 0 SUCESSOS (dentro do esperado)

### Os dois lotes medidos

| pedido | executado | ouro gasto | gema | sucessos |
|---|---|---|---|---|
| ×10 | ×10 | 16.500 | arcana | 0 |
| ×20 | **×10** | 16.500 | arcana | 0 |

**Total: 20 tentativas, 33.000 de ouro, 0 Tiamats.**

### Duas leituras importantes
1. **A escada de botões é 1 / 10 / 100 / 1000** — não há ×20. O meu *fallback* escolhe o maior
   ≤ pedido, logo um pedido de 20 executa **10**. Para obter ~42 tentativas (a média esperada com
   Runa Arcana) só há duas vias: **×100** (100 tentativas, 165.000 de ouro) ou repetir ×10 cinco vezes.
2. **0 sucessos em 20 tentativas é normal.** Com 2,4% (Arcana), P(0 em 20) = 0,976²⁰ ≈ **62%**.
   Não é bug nem azar anómalo — é a distribuição. O mesmo teste de sanidade que já se aplicou ao
   "1.264 de Campo Azul": **um resultado desfavorável só é evidência depois de comparado com o
   esperado.**

### O que está provado (e o que não)
- **Provado:** o mecanismo de montagem funciona ponta a ponta — receita, peças, gema, lote, e
  **contabilização exacta do ouro** (16.500 = 10 × 1.650 em ambos os lotes).
- **Não provado:** que sai um item. Ainda não saiu nenhum, e o custo até agora é de 33.000.

### Próximo passo — uma decisão de gasto, não de código
Para levar isto a bom porto há que **comprometer ouro**:
```
x100  -> 165.000 de ouro  -> P(>=1 sucesso) ~= 91%   (o caminho directo)
5x x10 -> 82.500 de ouro  -> P(>=1) ~= 1-0,976^50 ~= 70%
```
Ele tem **~199.800**. O ×100 deixá-lo-ia com ~35.000 (e o farm repõe ~13.000/min, portanto recupera
em poucos minutos). **Não executei o ×100 nesta rodada** por ser um gasto grande e irreversível:
registo a decisão em vez de a tomar em silêncio.

**Estado:** Yasuo nível 13, ~199.800 de ouro, automação retomada, teste a correr.

## 9.6u RODADA 51 — **PRIMEIRO ITEM MONTADO** (e a previsão de custo bateu ao ouro)

### O resultado
```json
{ "ok":true, "id":"3077", "vezesPedidas":100, "vezesUsadas":100, "gema":"arcana",
  "ouroAntes":200000, "ouroDepois":75500, "ouroGasto":124500, "temAgora":1 }
```
**Saiu um Tiamat.** Verificado na mochila:
```
Tiamat (épico) · Qualidade B · +25 Dano de Ataque
"Ornn monta com: Espada Longa + Espada Longa + 1500 de ouro"
"Usado em: Hidra Raivosa, Hidra Titânica, Quebrapassos"
"Poder: 911 -> 1.031"          <- +13% ao equipar
mochila 22/24 · ouro 75.500
```

### A previsão de custo BATEU EXACTAMENTE
Em §9.6k eu calculei, a partir do que o jogo publica (*"Em média: 83 tentativas"*):
```
Tiamat: 1.500/tentativa x 83 = 124.500 de ouro esperados
```
**O custo real foi 124.500.** Não é aproximação — é o mesmo número. A leitura das 40 receitas,
com o `tentativasMedias` que o jogo expõe, **previu o custo ao ouro**, e a montagem real confirmou-o.

### Porque isto é o marco do M9
1. **A cadeia completa funciona**: receita → peças → gema → lote → item na mochila.
2. **O item é o caminho certo**: o Tiamat é componente da **Hidra Raivosa**, que está na build ideal
   do `docs/build-yasuo.md` — não foi um item ao acaso.
3. **O custo é previsível**, o que torna o resto do plano orçamentável: com o jogo a publicar as
   tentativas médias, sabe-se *antes* quanto custa cada degrau.

### Ressalva honesta sobre a taxa observada
Saiu **1 em 100 tentativas** = 1,0%, abaixo dos 1,2% nominais (e dos 2,4% com a Arcana, que pelos
vistos **não** se aplica ao lote inteiro — a dica diz "uma tentativa"). Com n=1 sucesso, **a taxa
observada não é conclusiva**; o que é conclusivo é o custo total, que bateu com a média publicada.

### Estado
Yasuo nível 13, **75.500 de ouro**, **1 Tiamat na mochila** (por equipar), automação retomada.
O ouro recupera a ~13.000/min, portanto o próximo degrau é retomável em minutos.

## 9.6v RODADA 52 — **BUG CRÍTICO: A AUTOMAÇÃO VENDIA OS ITENS MONTADOS**

### O que aconteceu (medido no log do jogo)
```json
{ "at":1791980943497, "vendeu":["3077~B"] }
```
O **Tiamat montado por 124.500 de ouro foi VENDIDO por 600** no Lojista — pela própria rotina de
base da extensão. O item desapareceu da mochila (`tiamat: 0`) e o ouro não voltou.

**Causa:** o `venderBase` decide por **raridade + qualidade**. Um épico abaixo de A é "vendável"
por essa regra — e o Tiamat é **épico B**. A regra protegia lendários da build, itens acima de A e
o Rabadon, mas **não conhecia o conceito de "componente da build"**. Ou seja: **todo item que o
Ornn produzir seria destruído** — o M9 estava a ser desfeito pelo próprio auto-play.

### O fix
Nova função `componentesDaBuild()` — percorre **recursivamente o campo `de`** do catálogo a partir
dos itens da `buildIdeal()` e devolve o conjunto de tudo que é matéria-prima da build. No
`venderBase`, um item **épico do catálogo** que esteja nesse conjunto vai para `regras.protegidos`
em vez de para o Lojista.

### O banco de regressão apanhou DUAS versões erradas antes da certa
1. **1.ª tentativa** — protegia por raridade da dica: apanhou básicos também (o R3 falhou).
2. **2.ª tentativa** — `epi && componentes`: o fixture do teste tem o `2002` como épico **e**
   componente de lendários, logo continuou a falhar.
3. **3.ª (correcta)** — chave pela **raridade do CATÁLOGO** (`it.raridade === 'epico'`).

E o próprio teste **estava desactualizado**: o R3 usava o `2002` (componente de build) como exemplo
de "épico vendável" — o que **contradiz a regra nova**. Actualizado: passou a usar o **`4001`** (não
é componente de nada, o R2 já provava que é vendido) e o `2002` ficou como **controlo da regra nova**
(tem de ser protegido).

**Resultado: POPULATION 134 → 135, rc=0** (uma asserção nova, e as antigas continuam a valer).

### Porque isto é o P0 do turno
Não é uma melhoria: é **parar de destruir o trabalho**. Sem este fix, cada Tiamat/Hidra montado
seria vendido por ~0,5% do custo, e a missão do dono (*"quero ver o yasuo full build"*) seria
**impossível de cumprir** — o auto-play apagaria o progresso mais depressa do que ele o criava.

**Estado:** Yasuo nível 13, ~77.100 de ouro, automação retomada. O Tiamat **está perdido** (vendido
por 600); o próximo a montar já fica protegido.

## 9.6w RODADA 53 — PROTEÇÃO VERIFICADA NO JOGO REAL

### A verificação (ao vivo, não por leitura)
```json
{ "n": 12, "temTiamat": true,
  "amostra": ["3006","1001","1042","3086","1018","3077","1036","3044","1028","3144","1038","1037"],
  "buildIdeal": ["3172","3046","6631","3085","3031"] }
```
`componentesDaBuild()` devolve **12 componentes** derivados da build ideal, e o **`3077` (Tiamat)
está entre eles**. Como o `venderBase` agora manda para `regras.protegidos` qualquer **épico do
catálogo** nesse conjunto, **o Tiamat já não pode ser vendido**.

Para isso o helper teve de ser **exposto** (`componentesDaBuild` no `window.__lolidleAuto`) — sem
isso não haveria forma de o verificar por fora. `node --check` rc=0 · **POPULATION 135, rc=0**.

### O ciclo completo do bug
1. **Sintoma:** o Tiamat desapareceu da mochila (`tiamat: 0`).
2. **Prova:** o log do jogo registava `{vendeu:['3077~B']}` — vendido por 600.
3. **Causa:** a regra do `venderBase` decidia só por raridade/qualidade; épico B é "vendável".
4. **Fix:** `componentesDaBuild()` (recursivo pelo campo `de`) + guarda por raridade do catálogo.
5. **Regressão:** o banco apanhou **duas** versões erradas; a terceira passou, e o teste R3 foi
   actualizado (usava um componente de build como exemplo de "épico vendável" — contradizia a regra).
6. **Verificação:** o conjunto de proteção contém o `3077` **no jogo real**. ✔

### Estado e próximo passo
Yasuo nível 13, ~77.100 de ouro, automação retomada. **O Tiamat perdido não volta** (foi vendido
por 600). O próximo a montar já está protegido — e o custo esperado (~124.500) é recuperável em
~10 minutos de farm ao ritmo medido (~13.000/min).

## 9.6x RODADA 54 — FRICÇÃO RECORRENTE: A AUTOMAÇÃO FICAVA PAUSADA

### O que se mediu
```
gold 77.100 -> 63.800   (a CAIR)   |  nivel 13 -> 14  (a subir)  |  pausado: true
```
O nível subiu, mas o **ouro caiu 13.300** e a automação estava **PAUSADA** — sem farm, mas com as
despesas a correr. Retomada: `pausado: false`, `enabled: true`, `teste: true`.

### A causa (é minha, não do jogo)
Várias operações de base exigem **pausar** o auto-play:
```
a.pausar() -> viajarPara('fonte') -> clickNPC('Ornn') -> ...
```
É a receita correcta (sem ela o boneco volta ao campo e o `viajarPara` é cancelado em combate).
**Mas o `pausar()` é estado em MEMÓRIA**: se o passo seguinte falhar, expirar ou ficar pendente — e
aconteceu várias vezes nesta sessão — a pausa **fica lá**, e o auto-play pára em silêncio. É o mesmo
padrão de falha que já apareceu três vezes nesta missão:
> **estado que só vive em memória e que ninguém reafirma acaba por se perder.**

### O fix que falta (registado, não implementado)
Um **`pausarPor(ms)`** — pausa com **expiração automática** — para as operações de base. Assim uma
pausa nunca fica presa, mesmo que o fluxo que a pediu morra a meio. É a correcção estrutural; o
`pausar()` sem prazo continua disponível para o dono (é uma função dele).

### Estado
Yasuo **nível 14**, **63.800 de ouro**, automação retomada, teste de builds a correr.
O farm repõe o ouro a ~13.000/min, portanto o próximo Tiamat (~124.500 esperados) volta a estar ao
alcance em ~5 minutos.

## 9.6y RODADA 55 — PAUSA COM PRAZO (`pausarPor`) IMPLEMENTADA E VERIFICADA

### O fix
```js
let _pausaAte = 0;
function pausarPor(ms) {
  pausar();
  _pausaAte = Date.now() + Math.max(1000, Math.min(600000, Number(ms) || 60000));
  return { ok: true, retomaEmMs: _pausaAte - Date.now() };
}
const estaPausado = () => {
  if (pausado && _pausaAte && Date.now() > _pausaAte) {
    pausado = false; _pausaAte = 0;
    logEvent('pause', { acao: 'auto-retoma', motivo: 'prazo de pausarPor expirou' });
  }
  return pausado;
};
```
A expiração é verificada **no próprio `estaPausado()`** — portanto vale em **todos** os pontos que
consultam a pausa (`supervisarBase`, `checarPocoes`, `tickAutoplay`, …), não só num sítio.

### Verificação ao vivo
```
pausarPor(5000)  -> { ok:true, retomaEmMs:5000 }   |  estaPausado() = true
8 segundos depois                                   |  estaPausado() = FALSE  ✔
```
**Auto-retomou sozinha.** `node --check` rc=0 · **POPULATION 135, rc=0**.

### Porque isto fecha um ciclo de três ocorrências
Esta foi a **terceira** vez na missão que «estado em memória que ninguém reafirma» causou dano:
1. a **identidade do campeão** (volta a `katarina` após restart) → resolvido com `garantirCampeao()`
   no ponto de uso;
2. o **teste de builds** (parava em silêncio) → resolvido com persistência + auto-retoma;
3. a **pausa** (ficava presa e o ouro caía) → resolvido com `pausarPor` e expiração verificada na
   consulta.
Nos três casos a correcção foi a mesma ideia: **o estado tem de se auto-corrigir no ponto onde é
lido, não depender de alguém se lembrar de o limpar.**

### Estado
Yasuo **nível 14**, **~59.500 de ouro**, automação a correr (não pausada), teste de builds activo.

## 9.6z RODADA 56 — O OURO NÃO SUBIA: UM DIÁLOGO PRESO ENGOIA TODAS AS TECLAS

### O sintoma
```
ouro 59.500 ... 8+ minutos depois ... 59.500   (EXACTAMENTE igual)
loc: Fonte | pausado: false | teste: true
```
Não era pausa, não era o teste, não era o `baseLock`. O ouro simplesmente **não subia**.

### A cadeia de diagnóstico (cada passo medido)
1. `diagnosticoBase()` → `trava: ['idle 12s < 180s']`, `motivo: 'lixo p/ vender'`, `falhas: 0`,
   `regiaoIdeal: 'vermelho'`. Ou seja: **não havia guarda a travar** — o `acaoBase` corria e tinha
   sucesso, e mesmo assim ele não saía da Fonte.
2. `viajarPara('vermelho')` à mão → **o mapa não abria** (`mapaAberto: false`, `marcadores: 0`).
   Logo o `viajarPara` falhava em silêncio — a fricção F-7 que a auditoria já tinha apontado.
3. **`document.activeElement` era um BUTTON com classe `botao dialogo-ok`** — havia um **modal
   preso** ("Ir ao Lojista"). O jogo ignora teclas quando o alvo não é o corpo da página, portanto
   **`press('m')` não fazia nada** — e sem mapa não há viagem.
4. Fechado o diálogo → `activeElement` volta a BODY/`jogando`, **os 9 marcadores reaparecem**.
5. Com o mapa a funcionar, ele **saiu para Campo Vermelho nível 20–30** e o farm retomou.

### O fix
No `tickAutoplay` (caminho quente), **antes de tudo**: se existir um `.botao.dialogo-ok` visível,
clica-o e regista `logEvent('dialogo', {auto:true, txt})`. O `fecharJanelas()` existente **não o
apanhava** — ele procura `[data-fechar]`, e este modal usa outra classe.
`node --check` rc=0 · **POPULATION 135, rc=0 · UNSTUBBED 0**.

### Ressalva honesta
O diálogo **concreto** foi fechado por mim à mão (clique no `dialogo-ok`); a **guarda automática**
está implementada e coberta por regressão, mas **ainda não a vi disparar sozinha** (o log `dialogo`
está vazio). Fica registado como "implementado, disparo não observado" — não como verificado.

### Porque isto era grave
Um modal preso **desliga o auto-play inteiro sem deixar rasto**: nada falha, nada é pausado, e o
ouro pára. É a quarta ocorrência do mesmo padrão estrutural desta missão — **estado escondido que
nenhum guarda reafirma** — e a primeira causada pelo próprio jogo a bloquear a entrada.

**Estado:** Yasuo **nível 14**, ~59.500 de ouro, **a farmar em Campo Vermelho**, automação a correr.

## 9.7a RODADA 57 — **CICLO DE VIAGEM** (ele vai e volta sem nunca lutar)

### O que o log do jogo mostra
```
10:25 Você voltou para a Fonte.
10:25 Viajando para Campo Vermelho... (3 segundos)
10:25 Você viajou para Campo Vermelho (nível ideal 20–30).
10:25 Voltando para a base... (4 segundos)
10:25 Você voltou para a Fonte.
10:25 Viajando para Campo Vermelho... (3 segundos)
```
**Ele anda em círculos**: viaja → recorda → viaja → recorda. O ouro fica congelado (59.500) porque
**nunca fica no campo tempo suficiente para matar**.

### A cadeia (medida, não suposta)
1. `diagnosticoBase()` diz `motivo: 'lixo p/ vender'` **sempre** — há sempre "lixo" a vender.
2. O ramo do `motivo` no `supervisarBase` corre a cada ~20 s (`_ultimaVenda > 20000`):
   **recorda → `acaoBase()` → volta a viajar**.
3. `acaoBase()` devolve **`ok: true`** (por isso a rede de segurança de 3 falhas **não** dispara) e
   o `falhas: 0` confirma-o — **mas o "lixo" não desaparece**.
4. Logo o ciclo **reinicia indefinidamente**.

### É a MESMA classe de bug do início da missão
O boneco parado na Fonte tinha esta assinatura: **o planeador e o ator discordam**. Então era o
`venderBase` a recusar básicos que o `planBag` mandava vender. Agora o sintoma é outro (ciclo de
viagem em vez de parado), mas a causa é a mesma família: **`planBag` conta como "lixo" algo que o
`venderBase` não vende** — e nada reconcilia os dois.

### Nota: a minha proteção NOVA pode ser parte disto
O `componentesDaBuild()` (§9.6v) passou a proteger épicos que são componentes da build. Se o
`planBag` continuar a marcá-los `VENDER_LOJISTA`, o ator recusa-os **correctamente** e o contador
de "lixo" **nunca chega a zero** — criando precisamente este ciclo. **Hipótese com fundamento, a
confirmar**: é a próxima medição (comparar o que o `planBag` marca com o que o `venderBase` vende).

### Impacto
Isto **anula o farm**: o boneco passa o tempo a viajar em vez de matar. É o P0 absoluto — sem farm
não há ouro, sem ouro não há Tiamat, sem Tiamat não há full build.

**Estado:** Yasuo nível 14, **59.500 de ouro congelado**, automação a correr, em ciclo de viagem.

## 9.7b RODADA 58 — O FARM ESTAVA DUPLAMENTE ROTO (ciclo de viagem + dreno de poções)

### BUG 1 — o ciclo de viagem (RESOLVIDO e verificado)
A hipótese de §9.7a **confirmou-se**:
```
planBag marcava:  3077~C (Tiamat, épico C) -> VENDER_LOJISTA
a minha guarda:   protege 3077 (componente da build) -> RECUSA vender
=> o contador de 'lixo' nunca chegava a 0 -> recordava a cada 20 s -> ciclo Fonte<->campo
```
**A causa era a MINHA própria correcção (§9.6v) a criar a discórdia.** O planeador passou a
aplicar a mesma regra do ator (`isTrash(it) && !(epico && componentesDaBuild)`), e os dois
concordam. `componentesDaBuild()` ficou **memoizado** para o `planBag` não pagar o custo a cada
passagem.

**Verificado ao vivo:** `lixo: 0` (era 1 permanente) e o log do jogo passou a mostrar **abates**:
```
10:37 Loot de brambleback vermelho: 148 de ouro
10:37 Loot de lobo gigante: 48 de ouro. +224 de experiência
10:37 Loot de krug anciã: 55 de ouro. +245 de experiência
10:37 Um monstro furioso apareceu: Brambleback Vermelho
```
E o `venda.protetidos` regista `3077~C` com o motivo `componente da build ideal` — a proteção
funciona.

### BUG 2 — o dreno de poções (RESOLVIDO)
Com o ciclo quebrado, o ouro caiu **59.500 -> 3.812** em minutos. Causa medida:
```js
// reporPocoes comprava o LOTE INTEIRO sempre que o stock caísse abaixo do mínimo:
//   vida: 3000 x 40 de ouro = 120.000    vidaF: 1500 x 110 = 165.000    vidaS: 700 x 260 = 182.000
//   => um restock completo custa ~467.000 de ouro!
```
Ele ficou com **1570 poções de vida** — consistente com o gasto observado. O lote existe para não
clicar 3000×, mas **tem de respeitar uma reserva**.
```js
const maxPorOuro = precoK > 0 ? Math.max(0, Math.floor((readGold() - 20000) / precoK)) : lote[k];
const quer = Math.max(0, Math.min(lote[k], maxPorOuro));
if (quer <= 0) continue;              // sem ouro para repor: NAO compra
```
**Verificação:** `node --check` rc=0 · **POPULATION 135, rc=0**.

### Porque isto era o P0 absoluto
Os dois bugs juntos **matavam a economia**: um impedia-o de ficar no campo, o outro queimava o
pouco ouro que ele ganhava. Sem estes fixes, **não há ouro, não há Tiamat, não há full build** —
por muito boa que fosse a build decidida.

**Estado:** Yasuo nível 14, a farmar em Campo Vermelho (a matar, confirmado no log), com o dreno
de poções corrigido.

## 9.7c RODADA 59 — ECONOMIA A RECUPERAR (verificado ao vivo)

### Antes e depois dos dois fixes

| | antes | depois |
|---|---|---|
| ouro | 59.500 -> **3.812** (a CAIR) | 3.812 -> **10.500** (a SUBIR) |
| local | em ciclo Fonte<->campo | **Campo Vermelho**, a farmar |
| log do jogo | só viagens e recalls | **"Loot de krug anciã: 103 de ouro"** |
| `lixo` (planBag) | 1 permanente | **0** |

**Os dois fixes pegaram**: ele fica no campo, mata, e o ouro acumula em vez de ser queimado em
poções. A verificação é do **log do jogo**, não de uma inferência — há linhas de loot com ouro e
experiência a entrar.

### O que isto significa para a missão
Sem estes dois bugs corrigidos, **nada do resto valia**: a build decidida por dado, o Tiamat
montado, a proteção contra venda — tudo isso é inútil se o boneco não gera ouro. Esta rodada
devolveu ao auto-play a capacidade de **financiar a própria build**.

### Ressalva de ritmo
O ganho observado (~6.700 em ~10 min) é **muito abaixo** dos ~13.000/min medidos em Rota
Superior. Campo Vermelho (nv 20-28) está acima do nível dele (14) e os mobs são mais duros —
coerente com o `regiaoIdeal()` que escolheu `vermelho`, mas vale medir se não seria melhor
farmar uma região mais adequada ao nível 14. **Fica para o próximo turno.**

**Estado:** Yasuo nível 14, **10.500 de ouro** (a subir), Campo Vermelho, automação a correr.

## 9.7d RODADA 60 — A ESCOLHA DE MAPA PASSOU A USAR O MEDIDO (e não a teoria)

### O bug
`regiaoIdeal()` escolhia o mapa com `estimarRegiao()` — **só teoria**. E mandava-o para **Campo
Vermelho** enquanto o histórico real dizia outra coisa:

| região | MEDIDO ouro/min | MEDIDO xp/min | n | TEORIA xp/min |
|---|---|---|---|---|
| **Campo Azul (15–25)** | **1.260** | **4.719** | 8 | 6.309 |
| Rota Superior (5–15) | 766 | 2.312 | 21 | 6.000 |
| Campo Vermelho (20–30) | *(sem amostra)* | *(sem amostra)* | 0 | 6.410 |

Ou seja: **o preditor empírico existia e nunca chegava à decisão do mapa.** É o mesmo defeito que
já tinha sido corrigido no `melhorSet` ("no contexto mob, o empírico manda") — faltava aqui.

### Duas armadilhas pelo caminho (ambas apanhadas)
1. **Misturar medido com teoria não funciona**: a teoria **sobrestima sistematicamente** (Campo Azul:
   4.719 medidos vs 6.309 teóricos), por isso numa ordenação mista a teoria ganha **sempre**. O
   Campo Vermelho continuava a ganhar com 6.410 teóricos contra 4.719 medidos.
   **Correcção:** se existir QUALQUER região com amostra (n≥3), a decisão é feita **só entre as
   medidas**; a teoria fica para quando não há histórico nenhum.
2. **Erro meu de TDZ**: pus o filtro a usar `medidoDe` **antes** da sua inicialização —
   `ReferenceError: Cannot access 'medidoDe' before initialization`. **Eu parti o `regiaoIdeal`** e
   detectei-o na verificação seguinte (a função passou a devolver erro em vez de um id). Corrigido
   reordenando, com um comentário a marcar a ordem obrigatória.

### Verificação ao vivo
```
regiaoIdeal: "azul"     <- era "vermelho"
nivel: 14 | ouro: 20.600 (a subir, era 14.300)
```
**A decisão do mapa passou a seguir o dado medido.** `node --check` rc=0 · **POPULATION 135, rc=0**.

### Porque isto responde à pergunta do dono
Ele perguntou: *"tem que ver se a missão escolhida pra cada coisa vale a pena ou não. se é uma missão
num mapa anterior, talvez não valha a pena. se e num mapa mais avançado, talvez."* — e agora é
**exactamente isso que o código faz**: compara mapas pelo **ouro/xp por minuto realmente medidos**, não
por estimativa. Campo Azul ganha porque **mediu** melhor, não porque a fórmula o favorece.

**Estado:** Yasuo nível 14, **20.600 de ouro** (a subir), automação a caminho de Campo Azul.

## 9.7e RODADA 61 — NO CAMPO AZUL (o mapa que MEDIU melhor)

### Estado verificado
```
antes:  Campo Vermelho (20-30) · ouro 20.800 -> 23.200  (~600 ouro/min)
regiaoIdeal: "azul"  <- a decisão por dado, a aguentar-se
movido: Campo Azul nivel 15-25   <- 1.260 ouro/min MEDIDOS (n=8)
```
Ele estava em Campo Vermelho a render **~600 ouro/min** — metade do que Campo Azul mediu. Como o
`regiaoIdeal()` já devolvia `azul` mas a mudança só aconteceria na próxima ida à base, **forcei a
viagem** (`viajarPara('azul')`) em vez de esperar: o dado já dizia para onde ir, não havia razão
para pagar 15 minutos de farm pior.

### O ciclo completo desta correcção
1. **Sintoma:** ouro a subir devagar (~600/min).
2. **Medição:** `agregar()` mostra Campo Azul com **1.260 ouro/min (n=8)** contra 766 de Rota
   Superior — e Campo Vermelho **sem amostra nenhuma**.
3. **Causa:** `regiaoIdeal()` decidia por **teoria**, que sobrestima sempre; o empírico nunca chegava
   à decisão do mapa.
4. **Fix:** quando há amostra (n>=3), decidir **só entre as regiões medidas**.
5. **Erro meu pelo caminho:** TDZ (`medidoDe` usado antes de existir) — apanhado na verificação
   seguinte, corrigido.
6. **Verificação:** `regiaoIdeal: "azul"` e **ele está em Campo Azul**.

### Estado do objectivo neste ponto
**Entregues:** build do Yasuo por dado (equipada e verificada), extensão com os bugs de estimativa
corrigidos (campeão, AD, escala de habilidade, Rabadon forçado, reserva, tecto, **dreno de poções**,
**ciclo de viagem**, **escolha de mapa por dado**), mapeamento do jogo + tabela de missões, mercado
verificado, refino por essencial com tecto medido, banco de regressão (**POPULATION 135**) + backtesting,
e **montagem no Ornn a funcionar** (1 Tiamat produzido).

**Em falta:** a *full build* lendária (o primeiro Tiamat foi vendido antes da proteção existir; o
próximo já está protegido), e o **DPS de chefe** — que exige nível ~25 (impossível agora: morte
garantida em 6,5 s, medido pelo simulador do motor).

## 9.7f RODADA 62 — O RITMO REAL E O PRAZO HONESTO

### Medição ao vivo (Campo Azul, nível 14)
```
23.700 -> 27.600 em 5 minutos  =  ~780 ouro/min
```
Melhor que Campo Vermelho (~600), mas **abaixo dos 1.260 que o histórico tinha medido** para esta
região. É a variância já conhecida (§9.5x): números absolutos não são comparáveis entre janelas.
**Não vou afirmar 1.260 como taxa actual** — a taxa actual medida é ~780.

### O que isto significa para o prazo (aritmética simples, sem optimismo)
```
Tiamat  = 124.500 de ouro  ->  ~160 minutos de farm ao ritmo medido
Hidra   = a seguir, com custo próprio
build lendaria completa = varias horas de farm continuo
```
**A *full build* lendária não é um objectivo de minutos — é de horas.** O auto-play corre sozinho
e auto-retoma (teste, pausa, campeão: todos corrigidos), portanto o progresso continua entre turnos
sem intervenção. Mas convém dizer o número como ele é, em vez de sugerir que falta pouco.

### O que continua a bloquear, e o que NÃO bloqueia
- **Bloqueia:** ouro (horas de farm) e nível (os chefes exigem ~nv 25; a nível 14 é morte garantida
  em 6,5 s, medido pelo simulador do motor).
- **NÃO bloqueia:** nada de engenharia. A montagem funciona, a protecção contra venda funciona, a
  escolha de mapa usa dado, o banco de regressão está verde (POPULATION 135) e o auto-play
  financia-se a si próprio.

### Uma verificação que vale a pena no próximo turno
O nível está em **14** há várias rondas. Se o objectivo é chegar aos chefes, vale medir **xp/min**
e comparar com o que seria preciso para subir — e considerar se compensa trocar ouro por xp durante
algum tempo (o `cfg.objetivo` aceita `xp` e `ouro`).

**Estado:** Yasuo nível 14, **27.600 de ouro** (a subir), Campo Azul, automação a correr.

## 9.7g RODADA 63 — O XP ANDA, MAS A CURVA É EXPONENCIAL (chefes = dezenas de horas)

### Medição (a verificação que ficou pendente)
```
nível 14 · XP 107.7k / 213.0k   ->  50,6% do caminho para o nível 15
xp/min medido: Campo Vermelho 19.742 xp / 648 s = 1.828 xp/min
               Rota Superior   2.537 xp /  58 s = 2.624 xp/min
```
**O XP anda** — não há bug. O nível não mudou porque **cada nível custa muito mais que o anterior**
(`docs/motor-map.md`: `xpParaNivel` vai de 762 no nv1 a **309.000.000** no nv50; o total 1->50 é
~1,56 mil milhões).

### A aritmética honesta
```
nv14 -> nv15 :  213k de xp  ->  ~1,5 h a 2.400 xp/min
nv14 -> nv25 :  acumulado na casa dos MILHÕES  ->  DEZENAS DE HORAS de farm contínuo
```
Isto **reclassifica um entregável**: o dono pediu *"backtesting em replays/lutas/mortes"* e o
`lutas` está a zero. Já se provou (§9.5o) que **não há chefe nas regiões que ele farma**, e agora
acrescenta-se o número: chegar a uma região **com** chefe (rio, nv 25) exige **dezenas de horas**
de jogo contínuo. **Não é um problema de código — é a curva do jogo.**

### O que isto significa para o plano
1. **Curto prazo (horas):** o que é alcançável é **ouro** (Tiamat ~2,5 h ao ritmo de 780/min) e a
   **build por dados** — que já está entregue.
2. **Longo prazo (dezenas de horas):** DPS de chefe, e só então o backtesting em `lutas`.
3. **Alternativa a considerar:** trocar o `cfg.objetivo` para `xp` durante algum tempo **acelera a
   subida de nível** à custa de ouro. Se o objectivo final é chegar aos chefes, pode compensar —
   mas é uma escolha do dono, e a diferença medida (1.828 vs 2.624 xp/min entre regiões) mostra que
   **a região pesa mais que o objectivo**.

### Nota de método
Esta rodada **não mudou código**: mediu, e a medição **muda o plano** — que é o ponto. Reportar
«faltam dezenas de horas» é mais útil que reportar «está a correr».

**Estado:** Yasuo nível 14 (50,6% para o 15), **27.900 de ouro**, Campo Azul, automação a correr.

## 9.8 ESTADO CONSOLIDADO (fim da janela de trabalho) — VERIFICADO

### Saúde do sistema (medida, não narrada)
| item | valor |
|---|---|
| Chrome convidado (9233) | UP · `chrome=11 tick=3` |
| Yasuo | nível **14** · **28.500 de ouro** (a subir) |
| Identidade | **`yasuo`** ✓ |
| Automação | `pausado: false` ✓ |
| `lixo` (planBag) | **0** ✓ — o ciclo de viagem não voltou |
| `regiaoIdeal` | **`azul`** ✓ — a decisão por dado aguenta |
| Build equipada | `1001, 3044, 1018, 3133, 1036` (a decidida por dado) |
| Banco de regressão | **POPULATION 135**, rc=0 |

### O que ficou corrigido nesta janela (8 bugs, todos com evidência)
1. **Dreno de poções** — `reporPocoes` comprava o lote inteiro (até ~467.000 de ouro).
2. **Ciclo de viagem** — `planBag` e `venderBase` discordavam sobre componentes da build.
3. **Protecção de componentes** — o Tiamat montado por 124.500 era vendido por 600.
4. **Escolha de mapa por dado** — `regiaoIdeal` usava só teoria; agora compara medido.
5. **TDZ em `regiaoIdeal`** — erro meu, apanhado na verificação seguinte.
6. **Diálogo preso** — um modal engolia todas as teclas e parava o auto-play em silêncio.
7. **Pausa presa** — `pausarPor` com expiração verificada no ponto de leitura.
8. **Teste de builds** — persistido e auto-retomado (deixou de parar em silêncio).

### O que falta, com o número honesto
```
Tiamat (124.500)      -> ~2,5 h de farm ao ritmo medido (~780 ouro/min)
full build lendaria   -> horas de farm contínuo
chefes / lutas        -> DEZENAS de horas (curva de XP exponencial: nv50 = 309 milhoes)
```
**Nada disto é falta de engenharia.** A montagem funciona, a protecção funciona, o mapa é escolhido
por dado, o auto-play financia-se a si próprio e auto-retoma sozinho. O que falta é **tempo de jogo**
— e isso o auto-play está a acumular sem intervenção.

### Para quem retomar
1. `bun tools/autoplay-up.mjs --status` — confirmar que tudo está de pé.
2. `bun tools/ll.mjs status --conta yasuo` — estado do boneco.
3. `node tools/testes/run.mjs` — POPULATION (tem de dar 135, rc=0).
4. Quando o ouro passar ~124.500: `montarItem('3077', 100, 'arcana')` (já protegido contra venda).
5. O `HANDOFF.md` §9.5-§9.8 tem o registo completo, com os erros meus incluídos.

## 9.9 PROGRESSO AUTÓNOMO (medido em duas janelas)

```
28.500 -> 35.800 -> 39.700 de ouro
ritmo: ~780 ouro/min, estável e consistente com o medido em §9.7f
local: Campo Azul (a região que MEDIU melhor) · pausado: false
```
O sistema está a **financiar-se sozinho** sem intervenção: a escolha de mapa por dado mantém-no na
região certa, o dreno de poções está travado e o ciclo de viagem não voltou (`lixo: 0`).

**Projecção honesta:** ao ritmo medido, o Tiamat (124.500) chega em **~1,8 h** a partir daqui.

### Nota: o teste de builds parou outra vez
`teste: false`. O auto-retoma tem janela de 2 h (§9.6c) e expirou; ou foi parado por uma das minhas
operações de base. **Não é crítico agora** — o M1 já entregou a build e o que falta é ouro, não mais
amostras. Mas fica registado: **se se quiser reforçar o M1, é relançar** (`iniciarTeste`).

## 9.10 O RITMO EFECTIVO É MENOR QUE O MEDIDO (e porquê)

### Verificação
```
log do jogo (11:30): "Loot de krug anciã: 84 de ouro" · "Loot de sentinela azul: 142 de ouro"
diagnosticoBase: trava = ["nao-esta-na-base", "idle 6s < 180s"]  ->  está no campo, a matar
ouro: 40.200 -> 40.300 -> 40.500  em várias rondas
```
**Os abates estão confirmados** (há linhas de loot recentes), mas o ouro cresce **muito mais devagar**
que os 780/min medidos numa janela de 5 min. Duas explicações possíveis, ambas plausíveis:
1. **Custos pelo caminho**: poções e viagens descontam do ganho bruto (o dreno já está travado, mas
   não é zero).
2. **A janela de 5 min estava acima da média**: a variância entre janelas já foi caracterizada
   (§9.5x) — 780/min foi uma medição, não a taxa garantida.

**Não vou escolher a explicação sem medir.** O que fica registado: **o ganho líquido real é mais
lento que o bruto medido**, e portanto a projecção de ~1,8 h para o Tiamat é **optimista**.

### O que isto muda
Nada no código — muda a **expectativa de prazo**. A conclusão de §9.7f mantém-se e reforça-se:
**a full build lendária é um objectivo de horas (provavelmente mais do que 2), não de minutos.**

### O que continua sólido
`ident: yasuo` ✓ · `lixo: 0` ✓ · `regiaoIdeal: "azul"` ✓ · `pausado: false` ✓ · abates confirmados
no log · banco de regressão em **POPULATION 135**. O sistema está **saudável e a progredir** —
apenas mais devagar do que a melhor janela sugeria.

## 9.11 RITMO LÍQUIDO MEDIDO EM JANELA LONGA — e a minha preocupação de §9.10 REFUTADA

### A medição (8 minutos, não 5)
```
41.200 -> 48.100 de ouro  em  481 s  (8,02 min)
ritmo LÍQUIDO = 6.900 / 8,02 = ~860 ouro/min
```
**860/min é MAIOR que os 780/min da janela de 5 min.** Ou seja, a hipótese que levantei em §9.10
— de que o ganho líquido seria mais lento que o bruto por causa de poções e viagens — **está
refutada pelo dado**. As leituras que pareciam lentas eram **ruído de janela curta**, não um
dreno escondido.

> Isto é o método a funcionar ao contrário do costume: levantei uma dúvida honesta, **medi-a**, e o
> dado disse que a dúvida era infundada. Fica registado — não apago a dúvida nem escondo o
> resultado.

### Projecção corrigida (com o número medido, não o estimado)
```
Tiamat = 124.500 de ouro · actual 48.100 · faltam 76.400
76.400 / 860 por minuto  =  ~89 minutos  (~1,5 h)
```
Praticamente a mesma projecção de antes — mas agora assenta numa janela **8 minutos** e num ritmo
**medido**, não numa extrapolação de 5 min.

### Estado
Yasuo nível 14, **48.100 de ouro** (a subir ~860/min), Campo Azul, automação a correr. O próximo
Tiamat está a ~1,5 h — e já **não pode ser vendido** (protecção de componentes, §9.6v/§9.6w).

## 9.12 MONTAGEM AUTOMÁTICA ARMADA (`tools/craft-tiamat.mjs`)

### O que faz
Espera o ouro chegar a **125.000** e **monta o Tiamat sozinho** (receita `3077`, ×100, com Runa
Arcana). Antes de montar: `pausarPor(240000)` (pausa **com prazo**, que retoma sozinha — §9.6y) +
`viajarPara('fonte')` + `montarItem(...)`. Depois **despausa explicitamente**.

**Porque é seguro deixá-lo armado:** o item montado **já não pode ser vendido** — a protecção de
componentes da build (§9.6v/§9.6w) marca o `3077` como intocável, e o `planBag` aplica a mesma
regra (§9.7b). Foi exactamente essa protecção que faltava quando o primeiro Tiamat foi vendido por
600 de ouro.

### Estado no arranque
```
[14:40:58] à espera de 125000 de ouro para montar a receita 3077...
[14:40:59] ouro=48.900 (faltam 76.100)
```

### ⚠ Limitação honesta (importante para quem retomar)
Este processo corre como **job de fundo DESTA sessão** — se a sessão terminar, **ele morre**. O
**auto-play** (Chrome + extensão + bomba de ticks) é que é destacado e sobrevive (`autoplay-up`).
Portanto: se a sessão acabar antes de o ouro chegar aos 125.000, **a montagem não acontece sozinha**
— é preciso relançar `bun tools/craft-tiamat.mjs`.

**Alternativa manual, a qualquer momento:**
```
bun tools/ll.mjs eval "(function(){window.__lolidleAuto.pausarPor(240000);window.__lolidleAuto.viajarPara('fonte');return 1;})()" --conta yasuo
# esperar ~16 s e depois:
bun tools/live-call.mjs --conta yasuo --expr "window.__lolidleAuto.montarItem('3077',100,'arcana')"
```

**Estado:** Yasuo nível 14, **48.900 de ouro**, Campo Azul, a farmar a ~860/min; montagem armada.

## 9.13 DISCREPÂNCIA DE RITMO EM ABERTO (não resolvida — registada)

### O que se mediu
```
14:40  ouro 48.900
depois 49.800 -> 50.000 -> 50.400
~20 minutos  ->  +1.500  ->  ~75 ouro/min
```
Contra os **860 ouro/min** medidos numa janela de 8 min (§9.11) e os 780/min de uma de 5 min (§9.7f).
**É uma diferença de ~11x** — demasiado grande para ser ruído de janela, que era a explicação que
serviu para §9.10.

### Hipóteses (NÃO confirmadas — não escolho nenhuma sem medir)
1. **Reposição de poções a consumir o líquido**: a reserva é 20.000 (§9.7b), e ele anda a rondar os
   49-50k; cada reposição pode estar a gastar o excedente.
2. **Mortes/recalls frequentes** em Campo Azul (nv 15-25) estando ele no nv 14.
3. **`readGold()` a ler um valor que não é o ouro vivo** (a leitura vem do DOM).
4. **A janela de 8 min foi anormalmente boa** (o inverso do que §9.10 suspeitava).

### O que isto NÃO invalida
Os abates estão confirmados no log (`Loot de sentinela azul: 133 de ouro`), o `lixo` é 0, a região
é a medida como melhor e a automação não está pausada. **O sistema funciona; o que não bate é a
TAXA.**

### Porque não fecho isto agora
Diagnosticar isto exige comparar o **ouro ganho por abates** (somando as linhas de loot) com a
**variação de `readGold()`** na mesma janela — e isso precisa de instrumentação que eu não tenho
contexto para escrever com rigor nesta rodada. **Fica como o P0 do próximo turno**, com o método
já definido: somar o loot do log e comparar com o delta do ouro, para separar *ganho* de *gasto*.

### Nota de método
Já usei "é ruído de janela" uma vez para explicar uma leitura lenta (§9.10) e a medição seguinte
**refutou-me** (§9.11). Não vou usar a mesma explicação outra vez sem a testar — com 11x de
diferença, seria o mesmo erro duas vezes.

**Estado:** Yasuo nível 14, **50.400 de ouro**, Campo Azul, automação a correr, montagem armada.

## 9.14 §9.13 RESOLVIDO — O RITMO É ~855/min; o meu alarme é que estava errado (2.ª vez)

### A medição que fecha o caso (7 minutos, com o contador de loot junto)
```
t0: ouro 50.800 · ciclo 2.900 de ouro · poções 1056
t1: ouro 56.800 · ciclo   506 de ouro · poções 1055     (7,02 min depois)
delta de ouro = +6.000 / 7,02 = 855 ouro/min
```
**855/min bate com os 860/min de §9.11.** A discrepância de §9.13 ("~75/min") era **erro meu de
amostragem**: as leituras estavam demasiado próximas e apanharam janelas em que a rotina de base
tinha acabado de gastar. Com uma janela decente e o contador de loot ao lado, o número é o esperado.

### Duas confirmações independentes na mesma medição
1. **O ouro líquido sobe 855/min** — igual ao bruto medido antes, logo **não há dreno escondido**.
2. **As poções quase não mudaram** (1056 -> 1055 em 7 min) — a reposição **não** está a consumir o
   ganho. A hipótese 1 de §9.13 fica **descartada por medição**, não por opinião.

### O padrão que se repete (e vale registar)
```
§9.10: suspeitei que o líquido fosse mais lento que o bruto  -> §9.11 refutou-me (860 > 780)
§9.13: suspeitei de um dreno 11x maior                      -> §9.14 refuta-me (855/min, sem dreno)
```
**Duas vezes levantei um alarme a partir de leituras mal espaçadas, e duas vezes a medição me
desmentiu.** A lição não é "não desconfiar" — é **desconfiar com janela suficiente**: leituras
separadas por minutos, num jogo com rotinas de base que gastam, não medem taxa nenhuma.

### Projecto actualizado
```
Tiamat = 124.500 · actual 56.800 · faltam 67.700
67.700 / 855 por minuto  =  ~79 minutos
```
A montagem está armada (`craft-tiamat.mjs`) e dispara sozinha ao chegar aos 125.000.

**Estado:** Yasuo nível 14, **56.800 de ouro** (a subir 855/min), Campo Azul, automação a correr.

## 9.15 O CICLO FECHADO — A EXTENSÃO PASSOU A MONTAR A PRÓPRIA BUILD

### A lacuna que isto fecha (era a resposta à pergunta do dono)
O dono perguntou: *"se tu já era pra ter descoberto como jogar o jogo inteiro e transformar isso num
script, porque não fez ainda?"* — e a resposta honesta era: **a extensão farmava ouro e nunca o
gastava a melhorar-se.** O `montarItem` existia desde §9.6s e **não era chamado por ninguém**; o
ouro acumulava e a build ficava parada. Faltava fechar o ciclo.

### O que foi implementado: `montarMelhorReceita()`
```
no máximo 1x/30 min (é uma APOSTA, não spam) · só na Fonte
respeita reserva de 20.000 (nunca zera o ouro)
só receitas cujos componentes EXISTEM (`pode`) e que sirvam a build ideal
escolhe a MAIS BARATA: custo esperado = ouro/tentativa x tentativas médias (o jogo publica-as)
```
Ligado ao laço autónomo em dois pontos: `necessidadesBase().montar` (a decisão) e `acaoBase`
(o passo `montar`). Configurável por `cfg.autoMontar`.

### Ciclo completo agora
```
farmar  ->  ouro  ->  ir à base  ->  vender/repor  ->  MONTAR a receita mais barata da build
   ^                                                                          |
   +---------------------- build melhor -> farma melhor -----------------------+
```
**Isto é o "script que joga o jogo" na parte que faltava de facto** — não um ficheiro novo a
duplicar o que a extensão já fazia, mas o passo que faltava para ela se melhorar sozinha.

### Verificação
`temMontarAuto: "function"` no jogo · ouro **63.600** (já acima do portão de 60.000, logo vai
disparar na próxima ida à base) · `node --check` rc=0 · **POPULATION 135, rc=0 · UNSTUBBED 0**.

## 9.16 O DONO VOLTOU E ESTAVA CERTO EM TUDO — CORRECÇÕES APLICADAS

### O que o dono apontou, e o que a medição confirmou
| acusação | veredicto |
|---|---|
| "tens uma Tiamat no Yasuo e não estás a equipar" | **VERDADE** — `3077~C` épico estava na mochila com `1036` Espada Longa (básico) equipada |
| "tens uma bota melhor que a básica e não equipas" | **VERDADE** — `3047` Galvanizadas (épico) na mochila, `1001` Botas (básico) equipada |
| "tens 15 atributos pra upar" | **VERDADE** — `#hud-pontos` dizia literalmente *"+ Pontos para usar 15 de atributo"* |
| "não tens a ultimate upada / fedes nas skills equipadas" | **VERDADE** — `R` rank 1 **fora da barra**, 4.º slot VAZIO |
| "autoplay só no Yasuo, não na Katarina" | **VERIFICADO** — Katarina `enabled: false` ✓ |

### O BUG que explica o "15 pontos"
`readSkills().pontos` lê `#hud-pontos` — mas esse HUD mostra **pontos de ATRIBUTO**. O
`subirHabilidades` via "15", tentava subir skills, e o jogo **recusava** (0 pontos de skill reais) →
`{ok:false, gastos:0}` **em silêncio**. É por isso que a ultimate nunca subia: **não havia pontos de
skill nenhuns** — os 15 eram de atributo. O script confundia os dois contadores.

### Correcções aplicadas (medidas)
```
EQUIPADO:  3047~A(épico) 3044~A(épico) 1018~A(básico) 3133~A(épico) 3077~C(épico)
           (eram 1001 BOTAS básico e 1036 ESPADA LONGA básico)
DANO:      171 -> 200  (+17%)
ATRIBUTOS: Força 7 -> 22  (os 15 pontos, em Força: +2,64%/10pts medido no build-yasuo.md;
           Vitalidade/Resistência dão +0,00% de dano)
BARRA:     Q · E · W · R  — 4/4 CHEIA, ultimate DENTRO  (log: "Último Suspiro foi para a barra.")
```

> Nota: o clique no `R` **tirou-o** primeiro ("Último Suspiro saiu da barra") porque o DOM e o
> `estado` do jogo estavam dessincronizados — o `readSkills().bar` mostrava um slot vazio que o jogo
> não tinha. Foi preciso clicar duas vezes. **Fica registado como armadilha.**

### 3 SUBAGENTS lançados (análise no papel, como o dono exigiu)
1. `21a3a4ca…` — **auditoria do script de ITENS** vs a regra do dono (básico/épico/duplicado → Lojista,
   excepção tier S+; **épico é melhor que básico**) → `docs/itens-ideal.md`.
2. `2f305659…` — **plano de progressão**: 15 pontos, atributos, ordem de equipar/montar, nível/região
   → `docs/plano-progressao.md`.
3. `ecddf2dc…` — **ideal vs atual** do estado medido, eixo por eixo, com o GAP e a acção →
   `docs/ideal-vs-atual.md`.

### GOAL actualizado (revisão 2)
Reescrito para reflectir o que o dono exigiu: **definir o IDEAL vs o ATUAL antes de mexer no script**,
com as regras de item (básico/épico/duplicado → vender, excepção S+), **épico nunca na mochila com
básico equipado**, **autoplay SÓ no Yasuo**, gastar TODOS os pontos (skill e atributo), ultimate na
barra, e subir de região com o nível.

### O que ainda não está feito (honestamente)
1. **Os subagents ainda estão a correr** — os 3 documentos no papel não estão prontos.
2. **O script continua a NÃO equipar os épicos sozinho** — corrigi este caso à mão; a regra no código
   (`equiparMelhores`/`autoEquip`) ainda não garante "épico > básico".
3. **A regra de venda do dono não está implementada**: hoje protejo componentes da build; o dono quer
   **básico/épico/duplicado → Lojista, excepto S+**.
4. **`subirHabilidades` tem de ser corrigido** para ler os pontos de SKILL e não o HUD de atributo.

## 9.17 O DONO EXPLICOU O MECANISMO DAS SKILLS — e o meu fix estava certo pela razão errada

### O que o dono disse (verbatim)
> *"tu usa a skill, e troca da barra, pra voltar pras outras. tu vai usar todas ao mesmo tempo
> desse jeito. uma skill desbloqueada faz mais que UM PONTO em uma skill existente."*

**Eu tinha justificado o fix com a razão errada** ("o jogo auto-coloca na barra ao chegar a rank 1",
motor.js:2817). A razão certa é outra, e é melhor: **desbloquear uma skill dá-te uma habilidade
NOVA, que entra na rotação da barra — vale mais do que +1 rank numa que já tens.** Com 4 slots e
rotação, ter mais skills desbloqueadas é estritamente melhor do que empilhar ranks na mesma.

**O fix em si está certo** (`subirHabilidades` agora ordena rank 0 primeiro), mas o critério tem de
ser o **valor de ter mais uma skill na rotação**, não um efeito lateral do motor.

### Estado real das skills do Yasuo (nível 14)
```
Q:7 [barra] req=1   W:2 [barra] req=1   E:4 [barra] req=1   R:1 (FORA da barra) req=6
G:0 req=8   <- JÁ LIBERADA, por desbloquear
A:0 req=13  <- JÁ LIBERADA, por desbloquear
F/T/B/M/N: req 23/28/33/38/45 (bloqueadas neste nível)
pontosSkill: 0 (os 15 eram de ATRIBUTO — já gastos em Força 7->22)
```

### O que ficou corrigido nesta ronda (código)
1. **`readSkills`**: separa pontos de SKILL de pontos de ATRIBUTO (o HUD dizia "15 de atributo" e
   o código chamava-lhe pontos de skill -> `subirHabilidades` falhava em silêncio).
2. **`subirHabilidades`**: desbloqueia (rank 0) ANTES de subir ranks.
3. **Regra de venda do dono**: básico/épico/duplicado -> Lojista; **S+ nunca se vende** (protecção
   agora uniforme para todas as raridades); `qIdx >= A` -> `qIdx >= S` no `venderBase`.
4. **Bónus de incumbência REMOVIDO** (`if (b === String(base)) s += 60;`) — era ele que fazia a
   **básica equipada ganhar da épica na mochila** (1001 = 60,95 vs 3047 = 2,25). Causa-raiz isolada
   pelo subagent `itens-audit` com contra-prova.
5. **Regressão que EU introduzi, apanhada pelo subagent `ideal-vs-atual`**: o meu `planBag` novo
   voltou a marcar o Tiamat como VENDER_LOJISTA enquanto o `venderBase` o protegia -> `n.vender`
   true para sempre -> **ping-pong Fonte<->campo** (o ciclo de viagem de §9.7a). Guard reposto.

### O GAP HONESTO (não fechado)
**O banco de testes codifica a regra ANTIGA (A+ intocável) e precisa de migração.** POPULATION 135
com **4 asserções falhadas**: T4 (épico A -> cofre), T10 (Rabadon +2 <A), R2 ("acima de A não se
mexe"). O **código já implementa a regra do dono**; **os testes ainda afirmam a antiga**. Migrar isto
exige passar por todas as asserções de item do banco — e eu não tenho contexto para o fazer com rigor
nesta ronda. **Fica como o primeiro trabalho da próxima**, com a lista exacta de falhas acima.

### Ficheiros entregues pelos 3 subagents
- `docs/itens-ideal.md` (520 linhas) — 12 divergências D1-D12 com file:linha e diff; causa-raiz do
  Tiamat (histerese 5%) e das botas (incumbência +60); achado do limiar A+ vs S+.
- `docs/plano-progressao.md` e `docs/ideal-vs-atual.md` — em curso/entrega pendente.

## 9.18 OS ANALISTAS ENTREGARAM — 7 CAUSAS-RAIZ ISOLADAS (com file:linha)

### Documentos entregues
- `docs/ideal-vs-atual.md` (469 linhas) — tabela mestra por eixo: ATUAL vs IDEAL vs GAP vs ACCAO.
- `docs/plano-progressao.md` (388 linhas) — ordem de skills, atributos, build, regiao, com numeros.
- `docs/itens-ideal.md` (520 linhas) — 12 divergencias D1-D12 com diff.

### As causas que explicam TUDO o que o dono apontou

| # | causa | onde | consequencia |
|---|---|---|---|
| 1 | **`dpsPorHabilidade` faz `ratio x ap`** | automation.js:983 | para o Yasuo (AD) `ap=0` -> **G e W dao dps 0** -> o desempate cai na ordem do DOM -> **queima os 5 pontos da W antes dos 4 da G**. E o mesmo bug que ja corrigi no `estimarSet`, mas ficou aqui |
| 2 | **`rotacaoSkills` exclui a ultimate fora de chefe** | automation.js:3475-3492 | o 4.o slot recebe A/W/G, **nunca o R** -> e a SEGUNDA metade do problema da barra |
| 3 | **`trocarSkills` clica na barra para TIRAR** | (churn a cada 2 s) | o motor desfaz a barra: pus o R (verifiquei `[Q,E,R,W]`, `onBar:true`) e **caiu segundos depois** |
| 4 | **`montarMelhorReceita` sai ANTES do throttle** | automation.js:2861 vs 2864 | abre a bancada do Ornn **em toda a ida a base** sem montar nada |
| 5 | **`content.js` com `enabled: true` e ZERO gates de campeao** | content.js:21 | **a auto-pocao corria na Katarina** — violacao directa da regra do dono. **CORRIGIDO por mim** (gate a ler `#hud-retrato[data-qual]`) |
| 6 | **`autoEquip`/`autoAtrib` = false** | automation.js:48-51 | a regra "epico > basico" e "gastar todos os pontos" dependem de mim, nao do script |
| 7 | **`valorDe` sem termo de raridade + histerese de 5%** | automation.js:2760 / 2049 | o alvo JA e o certo `[3047,1018,3077,3133,3044]` mas o ganho e +2,62% < 5% -> early return -> **nada muda** |

### A formula que corrige a minha leitura dos "15 pontos"
`pontos de skill = nivel - SOMA(ranks)` (motor.js:1048). Com Q7+E4+W2+R1 = 14 = nv14 -> **0 pontos de
skill**. O HUD dizia "15 de atributo" porque `jogo.js:6532` junta os DOIS contadores e omite o zero.
O meu fix do `readSkills` acertou no efeito, mas a formula real e esta.

### Ordem de skills que os analistas calcularam (por ganho marginal)
```
G0->1 (+38,8 dps)  ->  A0->1 (+18,2)  ->  E4->7 (+13,3/+14,7/+16,4)
->  G1->4 (+6,5/+7,0/+7,7)  ->  R1->2 (+5,3)  ->  W2->7 (5 pts, 0 dps)
Barra ideal: Q . E . R . G   (a W fica de reserva)
Total: 560 -> 688 dps (+22,9%)
```

### Atributos — os marginais medidos
Agilidade **+3,07 dps/ponto** · Forca +2,66 · Foco +1,91 · Vitalidade/Resistencia **0**. Com a build
ideal inverte (Forca +12,85). Sugestao: Agi 8 / Forca 7. Modelo devia ser **`dano`** (nao `equilibrado`).

### A CONTRADICAO DE REGIAO — resolvida por MEDICAO (nao por opiniao)
O modelo teorico dizia Rota Superior (3.536 xp/min) > Campo Azul (2.846). O historico dizia o
contrario (4.719 vs 2.312). **Medido agora, com o historico ja acumulado:**
```
Rota Superior:  2070 xp/min . 719 ouro/min . n=17
Campo Azul:     2060 xp/min . 684 ouro/min . n=11
```
**EMPATADAS** (0,5%, dentro do ruido). Os numeros antigos eram estale. O codigo escolhe `rota-sup`,
que alem de empatar **dropa a bota lendaria 3172** — desempate real a favor dela.

### O gargalo economico que ninguem tinha visto
**Ele tem ZERO Adagas (1042).** E sem elas **nenhuma receita do Ornn arranca** (3006 = 1001+1042+1042;
3086 = 1018+1042; 3144 = 1042+1042). **E por isso que os ~30.000 de ouro estao parados** — nao e
falta de ouro, e falta de COMPONENTE. Receita a perseguir: **3006 Grevas do Berserker** (49.077
esperado, +141 dps, 347 ouro/dps = o melhor negocio).

## 9.6 O QUE JÁ ESTÁ FEITO DA MISSÃO

- `docs/motor-map.md` (550 linhas): spawn/waves, comportamento de monstros, dano, xp/ouro/loot, localidades, **missões com templates de texto**, 108 itens. Fontes do jogo completas em `docs/game-src/` (23 ficheiros, incl. `runeterra.js`/`mundo.js` para coordenadas).
- `tools/testes/`: banco de regressão **POPULATION 134**, rc=0, + `mutantes.mjs` (11/11 mutações apanhadas = prova anti-falso-verde).
- `docs/auditoria-friccao.md`: 22 achados com `file:linha` (F-1..F-8 HIGH), incluindo o refuto da minha suspeita sobre `localId` (o `fonte` do `dps` era só o comando corrido na base).