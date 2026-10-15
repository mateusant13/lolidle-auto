# FILA W7 — Simuladores, backtest e banco de testes

**WORKTREE**: I:/wt/w7-sims   **BRANCH**: w7-sims

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em tools/ (sims, backtest, testes, snap-export). NÃO mexas em extension/.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w7-sims -b w7-sims`
2. `cd I:/wt/w7-sims` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w7-sims: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (10)
### TK-X3 | P1 | Rank da passiva D (Lâmina Sinistra) = 4 — faltam 4 pontos em todo o lado
- **Ficheiro(s)**: docs/snapshots/skills.json (dado medido) + automation.js + tools/sim-build.mjs + tools/sim-timeline.mjs
- **Evidencia**: motor.js:2798-2801 dá 28 pontos no nv29; arsenal medido tem 24 ranks e 0 pontos. motor.js:2169: cura do giro = 0,05 + curaGiro[rank]; snapshot {t:heal, v:279} com giro 1640-1760 -> 0,16x1760 = 282 (-1%). Com D=0 seria 88. Efeito medido: Barão 146 -> 125 poções; Arauto 5 -> 2.
- **Fazer**: adoptar rankD=4 em TODO o lado (snapshot + sim + extensão), ou justificar com evidência diferente.
- **Aceitacao**: mesma cura medida (279±5%) reproduzida pelo modelo com rankD=4.
- **Estado**: pendente

### TK-X1 | P1 | A R da Katarina não reinicia por abate — o modelo/extensão acha que sim?
- **Ficheiro(s)**: extension/automation.js (barra/ordem de skills) + tools/sim-build.mjs
- **Evidencia**: motor.js:1789 só corta recarga de Q/W/E (voracidade). O reset lido em motor.js:1853 é do DARIOS (usar(R,{},2)). Na luta simulada a R espera sempre 42,10 s (55 x (1-0,2346)).
- **Fazer**: procurar em automation.js/sim-build onde a R é tratada como "reinicia no abate" e corrigir o modelo; se não houver, ticket fecha como "confirmado: extensão certa".
- **Aceitacao**: teste que mostre que abate NÃO muda a recarga da R; doc com motor.js:1789 citado.
- **Estado**: pendente

### TK-02-44 | P1 | Simulador copia tabelas do jogo à mão (`CURVA`, `MONSTROS`, `HAB`, `RODIZIO`, `NIVEL_DIF`)
- **Ficheiro(s)**: tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:1863 — *“O simulador copia à mão as tabelas do jogo (CURVA, MONSTROS, HAB, RODIZIO, NIVEL_DIF) — com um comentário a admitir que os multiplicadores ‘vão inline no motor’ e não são exportáveis. É exactamente o problema dos hardcodes … enquanto estas tabelas forem cópias, o simulador pode divergir do jogo sem ninguém dar por isso”*; e o valor à mão em `tools/sim-chefes.mjs:28  const NIVEL_DIF = { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3 }` (parte-02.md:1805, 1838)
- **Fazer**: derivar estas tabelas do jogo (avaliar as funções do motor no mundo isolado e exportar os números, como em TK-02-09) ou, se forem mesmo inline e não exportáveis, marcar cada cópia com `file:linha` de onde veio e um teste que falha quando o motor muda.
- **Aceitacao**: cada tabela do simulador tem `file:linha` de origem e/ou é gerada; há uma verificação automática que acusa divergência entre a cópia e o motor.
- **Estado**: pendente

### TK-02-08 | P1 | `backtest.mjs` ainda lê o `yasuo.json` antigo; o ciclo do dado fresco não fecha
- **Ficheiro(s)**: tools/backtest.mjs, tools/snap-export.mjs, docs/snapshots/
- **Evidencia**: parte-02.md:681-686 — *"O backtest (tools/backtest.mjs) ainda lê docs/snapshots/yasuo.json — o ficheiro antigo de 169 KB que não regenerei … Falta gerar o yasuo.json no formato que o backtest espera … ou adaptar o backtest para ler os ficheiros novos."*
- **Fazer**: (a) o backtest passou a correr com o dado fresco exportado de `getFarm().cycles` (medido em parte-02.md:1160-1168: `fonte: docs/snapshots/katarina.json · ciclos: 30 de 30 · Fosso do Dragão 3798,1 ouro/min n=29 IC95 [3498,6 .. 4097,5] · Rio 2553,4 n=1 insuficiente · GLOBAL 3756,6 ouro/min`); (b) falta a comparação **entre builds**: `builds: 1 assinatura distinta` nos 30 ciclos (parte-02.md:1180-1183) — ligar a **TK-02-23** (persistir assinatura de build por ciclo) para a amostra acumular sozinha.
- **Aceitacao**: `node tools/backtest.mjs` corre com o snapshot fresco e imprime, por build, ouro/xp por minuto com IC95 e n; dizer no relatório qual comparação já responde e qual continua sem amostra.
- **Estado**: pendente

### TK-01-28 | P1 | M1: lutas[] e deaths[] vazios — sem DPS real, sem mortes para backtest
- **Ficheiro(s)**: tools/snap-export.mjs; extension/automation.js; tools/backtest.mjs
- **Evidencia**: parte-01.md L855-858: "DPS real: lutas[] esta VAZIO (0 lutas) -> 'sem-dados'... deaths[] vazio"; L1171: "lutas[] is still empty so no real DPS"
- **Fazer**: NOTA do historico (L1917-1942): as 5 regioes que o Yasuo (nv 12-14) pode farmar NAO tem chefe (chefe so em rio/dragao/barao, nv+13..+36) — lutas:0 de chefe e o resultado CORRETO, nao bug. Entao: (a) gravar lutas de MOB (dano por golpe, curas) e deaths no export; (b) manter tools/sim-chefes.mjs como via de backtesting de chefe (ja parametrizado em L3015-3022) e confronta-lo com a realidade quando o nivel chegar a rio (~25+).
- **Aceitacao**: lutas[] com >=1 luta de mob apos N minutos de farm; deaths[] com registo quando houver morte (docs/snapshots/deaths.json hoje tem 6 B = vazio); `node tools/backtest.mjs` deixa de mostrar 'sem-dados' para pelo menos 1 regiao.
- **Estado**: pendente

### TK-01-29 | P2 | export do snapshot em JSON duplamente codificado
- **Ficheiro(s)**: tools/snap-export.mjs
- **Evidencia**: parte-01.md L861: "O export esta com JSON DUPLAMENTE codificado (string contendo JSON). O script le os dois formatos e avisa na saida; se alguem for consumir o arquivo direto, precisa de 2x JSON.parse"
- **Fazer**: gravar o snapshot como JSON unico (objeto, nao string) e manter compatibilidade de leitura com os ficheiros antigos.
- **Aceitacao**: `node -e "JSON.parse(require('fs').readFileSync('docs/snapshots/yasuo.json','utf8'))` devolve objeto com cycles/lutas; backtest.mjs corre sem aviso de dupla codificacao.
- **Estado**: pendente

### TK-01-49 | P2 | export do snapshot corrompido quando se corre com 2>&1 (stderr do ll.mjs entra no JSON)
- **Ficheiro(s)**: tools/snap-export.mjs; tools/ll.mjs
- **Evidencia**: parte-01.md L1490: "Exporting the snapshot with 2>&1 mixes ll.mjs stderr warning into the JSON, and the backtest then dies with Unexpected token. Use 2>$null. Recorded in the handoff"; L1661: "Always export the snapshot with 2>$null"
- **Fazer**: tornar o export imune (descartar stderr no proprio exportador ou le-lo de forma segura) e documentar; ou mudar o aviso do ll.mjs para nao corromper.
- **Aceitacao**: export com stdout+stderr misturados produz JSON valido (JSON.parse passa); backtest.mjs corre sem erro de parse.
- **Estado**: pendente

### TK-01-43 | P2 | Ciclos de farm: cap 30, fecho so por mudanca de regiao, ciclos <30s — taxas truncadas/ruidosas
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1486: "30/30 cycles carry incompleto:true / fim:viagem (cycles close on region change, not naturally -> rates may be truncated), 16 cycles are under 30s (noisy per-minute rates)"; L1565: cap 30
- **Fazer**: aumentar/gerir o cap (ou arquivar em ficheiro), fechar ciclo tambem por tempo/slot cheio e marcar explicitamente taxa truncada; filtrar do ranking ciclos <30s.
- **Aceitacao**: snapshot novo mostra taxa com marcador de truncada quando fim=viagem; ciclos <30s excluidos do ranking por predefinicao.
- **Estado**: pendente

### TK-02-42 | P2 | Banco de testes codifica o comportamento antigo do pin do Rabadon (4 asserções vermelhas de propósito)
- **Ficheiro(s)**: tools/testes/ (o ficheiro que contém as asserções do pin/objetivoItem)
- **Evidencia**: parte-02.md:2050 — *“O banco está vermelho — e está certo que esteja. O motor aterrou o pin por classe, e 4 asserções minhas ainda codificam o comportamento antigo (Rabadon a entrar na build AD). Vou corrigi-las para a regra nova.”*; regra nova em parte-02.md:1710-1719
- **Fazer**: substituir as 4 asserções pelas da regra nova (classe oposta não entra na build; mesma classe continua a entrar) e nomear no relatório quais asserções mudaram — **não** reverter o motor para o banco ficar verde (REGRA Nº 6).
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 e nenhuma asserção a exigir Rabadon em build AD; relatório nomeia as 4 asserções alteradas.
- **Estado**: pendente

### TK-02-14 | P2 | Extensão re-estima ouro/xp/abates em vez de ler a análise que o jogo já publica
- **Ficheiro(s)**: extension/automation.js, extension/gui.js
- **Evidencia**: AGENTS.md REGRA Nº 7 — jogo já mede em `jogo.js:523` (`analise`), `525-537` (`contarAnalise`), `538-542` (`contasAnalise`), render em `#janela-analise` (`546-560`) e `#rastreio-analise` sempre visível (`6250-6255`); a extensão re-estima em `automation.js:1195-1204` (`kXp`/`kOuro`) e não lê nenhum dos dois
- **Fazer**: ler `#janela-analise`/`#rastreio-analise` (ou a função `analise`) como fonte primária e usar `kXp`/`kOuro` só como fallback; mostrar na GUI o número do jogo, não o estimado.
- **Aceitacao**: número igual ao do `#rastreio-analise` ao vivo, provado por marcador discriminante; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente


## TICKETS NOVOS (acrescentados pelo Lead 22:06)
### TK-02-55 | P1 | Faltam as asserções do banco para as correcções novas do motor (provas feitas só por script efémero)
- **Ficheiro(s)**: tools/testes/ (novas/actualizadas suites)
- **Evidencia**: parte-02.md:3049 — *“NAO escrevi nem alterei NENHUMA assercao do banco (o meu escopo e automation.js). As assercoes novas que pediste (3031/3089, rotacao, fuga, regiao memorizada, barra, auditoria de passivas) ficam do teu lado; deixei-as provadas por script efemero e expus no window.__lolidleAuto o que o banco precisa: auditoriaPassivas, regiaoSegura, primeiaVez, primeiraVezPasso, PRIORIDADE_EXTREMA, ehPrioridadeExtrema”*
- **Fazer**: escrever as asserções para: (a) protecção `3031`/`3089` (duplicados incluídos) com controlo de item comum a ir ao mercado; (b) `rotacao` sob manutenção a mexer a barra com auto-play desligado; (c) `fugir` em manutenção, sem exigir chefe, com controlo `fugir=false`; (d) `regiaoSegura` a descartar memória letal e a aceitar memória segura; (e) `barraPorDisponibilidade` (cenário de 2 prontas + 2 em recarga, empate sem oscilação, ultimate sempre em 1.º); (f) `auditoriaPassivas().duplas.length === 0`.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com as suites novas e POPULATION acima de 260; relatório nomeia cada asserção acrescentada e qual comportamento antigo deixa de ser aceite.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:7230 (assercoes novas no banco (25/25 verdes)). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-58 | P1 | Discrepância entre o que o subagent reporta e o que a extensão a correr mostra (código novo, runtime velho)
- **Ficheiro(s)**: extension/ (recarregar) — verificação ao vivo, sem escrever código
- **Evidencia**: parte-02.md:3069-3079 — `campo4629: 0.15` (o subagent disse “4629 NAO tem campo cdr” — **tem**), `barraPorDisponibilidade: false` (o subagent diz que inverteu para TRUE), `ideal: "dragao"` (o subagent diz que agora é “vermelho”); *“O ficheiro tem 428.844 bytes — exactamente o que ele reporta. Logo o código está lá; a extensão a correr é que pode estar velha. Vou forçar o reload e reconfirmar.”*
- **Fazer**: forçar `lolidle:reload` + reload da página (ignoreCache) e reconfirmar os três pontos com **marcador discriminante** (texto que só existe no código novo), antes de afirmar anything sobre o estado ao vivo (REGRA Nº 4).
- **Aceitacao**: after reload, `barraPorDisponibilidade: true`, `campo4629: 0.15` confirmado, e `regiaoIdeal()` igual ao que o banco prevê — cada um provado por marcador discriminante; se divergir, o relatório diz qual dos três ficou velho.
- **Estado**: pendente
