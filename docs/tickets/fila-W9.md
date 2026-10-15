# FILA W9 — Pontuação e matemática de builds

**WORKTREE**: I:/wt/w9-score   **BRANCH**: w9-score

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_ (hardcodes de item), mit/mitigar, pen (penArmadura/penMag), wrapper de infoItem (stats:null), nome do item com qualidade. NÃO mexas em planejar, buildIdeal*, valorPassiva, refinarMelhores, GUI, venda/Lojista nem config guardada — esses são de outros workers.

## ORDEM DE TRABALHO
1. `cd I:\!lolidle.com; git worktree add I:/wt/w9-score -b w9-score` (se ainda não existir).
2. `cd I:/wt/w9-score` e trabalha SÓ aí.
3. P0 primeiro. Para cada ticket: LÊ a fonte antes de alterar (Regra Nº 1). Muitos podem já estar corrigidos: VERIFICA antes; se estiver, fecha o ticket com a prova (ficheiro:linha).
4. `bun tools/testes/run.mjs` antes de commitar; se um teste codificar o comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
5. `git add -A; git commit -m "w9-score: <uma linha>"`. NÃO faças merge.
6. Reporta no formato fixo do protocolo (TK / FICHEIROS / TESTES / COMMIT / RISCO / REGRA DO DONO).

## NOTAS DO LEAD (22:06)
- docs/game-src/motor.js é agora a versão VIVA do jogo (3846 linhas; +54 que a cópia velha). Os motor.js:NNN dos tickets podem estar desviados em dezenas: relocaliza por CONTEÚDO.
- Tens docs/game-src/dados-katarina.js (base real) e docs/game-src/kit-katarina-vivo.json (kit completo) lidos do jogo vivo — usa-os, não calibras à mão.
- Decisões do dono já resolvidas em docs/tickets/decisoes-resolvidas.md — não perguntes nada.
- Ferramenta útil: `bun tools/calc-jogo.mjs` lê o motor como texto e avalia qualquer constante (--expr).

## OS TEUS TICKETS (12)
### TK-02-89 | P1 | `scoreSet` aplica o CDR a TODO o dano — sobrevaloriza o CDR e faz o motor preferir a bota errada
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5815-5842 — a linha exacta `automation.js:5333  let d = (base * mit) / (1 - S.cdr) * (1 + (magia ? S.lich * 0.15 : 0));` com a nota *“o CDR aplicado a TODO o dano”*; a explicação da divergência em parte-02.md:5519 e 5533-5537 (*“o scoreSet pontua o CDR como multiplicador de DPS PURO — d = base * mit / (1 - S.cdr) -> 15% de CDR vale 1/0,85 = +17,6% de dano; o pen entra por mit(). O sim-build.mjs calcula o DPS REAL … onde o CDR só multiplica a TAXA de lançamento”*); correcção proposta em parte-02.md:5677 (`danoTotal = danoAutos + danoHabilidades / (1 − cdr)`) com três travões (listar todos os sítios, reutilizar `dpsPorHabilidade`, controle: build sem habilidades não ganha nada com CDR) e a cautela em parte-02.md:5835-5840
- **Fazer**: ler o contexto da linha e separar o dano em autos e habilidades antes de aplicar o CDR (só às habilidades), **reutilizando** o `dpsPorHabilidade` que já faz a conta certa; listar todos os sítios com a fórmula; a correcção só pode mudar resultados quando há CDR.
- **Aceitacao**: controle `S.cdr = 0` dá resultado **idêntico** ao de antes; com CDR, a ordem das builds passa a concordar com o simulador (`tools/sim-build.mjs`); se a bota de CDR continuar a ganhar com margem, dizer isso em vez de insistir na hipótese; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo presente — evidencia automation.js:6756 (scoreSet: CDR nao em todo o dano (ler a fonte)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-87 | P1 | Conflito entre instrumentos: `scoreSet` diz bota de CDR (+154), o simulador diz bota de pen (+227)
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:5136-5145 — *“Os dois instrumentos discordam: scoreSet (motor) bota de pen 822 / bota de CDR 976; sim-build.mjs (simulador) bota de pen 1465 dps / bota de CDR 1238 dps. O simulador diz que a bota de pen ganha (+227 dps); o scoreSet diz que a bota de CDR ganha (+154). Não vou escolher entre eles sem resolver o conflito”*; e a hipótese de que o `scoreSet` estava contaminado pelo bug do `efeitosEquipados` **não se confirmou** — os valores ficaram idênticos depois da correcção (parte-02.md:5438); medições em parte-02.md:5107-5126 (`976 / 822 / 783 / 683 / 593`)
- **Fazer**: descobrir porque os dois instrumentos discordam (fórmula, pesos, escalas de qualidade/refino, entrada do pen) e fazer um deles servir de referência independente do outro; só depois dar a resposta da bota ao dono.
- **Aceitacao**: os dois instrumentos concordam na ordem das builds (ou a diferença está explicada por `file:linha` e documentada); número de medições com valores exactos; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-63 | P1 | A mesma passiva vale 3× no scoring (texto × `multEsp` 1,25 × `PESO_FASE` 1,35)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3199-3200 e 3303 — *“A MESMA passiva vale 3x-4x: valorPassiva (texto) x multEsp (1.25) x PESO_FASE.itens (fase). Ex.: 3135 = 40*7=280 -> x1.25 -> x1.35 = +472 de valor só de palpites”*
- **Fazer**: fazer a passiva contar **uma** vez em cada etapa do scoring (remover a multiplicação cruzada texto×especial×fase, ou justificar cada factor com `file:linha` do motor).
- **Aceitacao**: teste a mostrar o valor do `3135` sem os +472 de palpites e o valor final da build inalterado onde não deve mudar; `auditoriaPassivas().duplas.length === 0` continua a valer; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:2237 (passiva sem contagem tripla). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-62 | P1 | `mit` calculado sem o `RM_MONSTRO = 0,6` — dano mágico subestimado 1,6×
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3197-3198 e 3302 — *“ERRO no mit: automation.js:3109 e 5123 usam 100/(100+armadura*(1-pen)) SEM o RM_MONSTRO=0.6 (motor.js:1179,1202) -> dano MÁGICO subestimado (1,6x a 104 de armadura)”*
- **Fazer**: alinhar o `mit` da extensão à fórmula do motor (com `RM_MONSTRO`), lendo o valor do jogo e não o escrevendo à mão; confirmar no motor a lista completa de campos da fórmula antes de codar (REGRA Nº 1).
- **Aceitacao**: teste com armadura 104 a dar dano mágico 1,6× maior que antes e igual ao do motor (comparação contra `motor.js:1179/1202`); `bun tools/testes/run.mjs` rc=0; nenhum número do motor copiado à mão.
- **Estado**: codigo presente — evidencia automation.js:1114 (RM_MONSTRO lido do motor (rmMonstro)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-64 | P1 | `tierDe` contradiz o motor (1 qualidade ≠ 10 refinos)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3201-3202 e 3304 — *“tierDe (automation.js:333) = qIdx*10+refino contradiz o motor (motor.js:252: (1+0.12*ref)*multQual, ou seja 1 refino = +12% e 1 degrau de qualidade = +15%). 1 qualidade NÃO vale 10 refinos.”*
- **Fazer**: substituir `tierDe` pela fórmula do motor (multiplicativa: qualidade × refino), lida do jogo, e rever todos os sítios que a usam para ordenação/comparação.
- **Aceitacao**: teste a mostrar que 1 qualidade vale +15% e 1 refino +12% (bater com `motor.js:252`) e que a ordenação de itens muda onde deve; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo presente — evidencia automation.js:379 (tierDe alinhado com o motor). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-66 | P1 | `CAMPOS_MULT` não tem `penMag` — as botas de pen só entram por `ITENS_ESPECIAIS` escrito à mão
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3205-3206 — *“CAMPOS_MULT não tem ‘penMag’ (motor.js:501 tem) -> as botas de pen só entram por estarem escritas à mão em ITENS_ESPECIAIS”*; e a causa raiz da escolha errada da bota em parte-02.md:3133-3137 (*“o campo penMag NAO EXISTIA em NENHUM perfil … o pen é o stat que o motor multiplica na mitigação”*)
- **Fazer**: acrescentar `penMag` a `CAMPOS_MULT` e retirar a dependência da lista manual `ITENS_ESPECIAIS` para itens de pen, para que a escolha venha do campo e não de uma lista escrita à mão.
- **Aceitacao**: teste a mostrar que um item com `penMag` no campo entra na build sem estar em `ITENS_ESPECIAIS`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo presente — evidencia automation.js:5036 (CAMPOS_MULT com penMag). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-79 | P1 | `infoItem` devolve `stats: null` — o motor não sabe os atributos de itens que não estão equipados
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4566-4573 — *“O infoItem do motor devolve stats: null — quem o consultar para saber os atributos de um item recebe nada. Os stats só existem no caminho do efeitosEquipados, que os calcula para os itens equipados. Para um item na mochila ou no mercado, o motor não sabe os atributos dele. Isso é maior que o preço: significa que ao decidir entre a tua peça equipada e uma na mochila, o motor só tem os stats de uma delas.”*
- **Fazer**: calcular os stats de **qualquer** item (equipado, mochila, mercado) pela mesma fórmula que o `efeitosEquipados` usa (`motor.js:251-255`, com `QUALIDADES` `motor.js:173` e `BONUS_REFINO` `motor.js:55`), e exponde-os no `infoItem`.
- **Aceitacao**: `infoItem(4629)` devolve `ap 109,5 / vida 547 / cdr 0,23` (os valores reais da peça do dono, escalados), e a comparação equipado-vs-mochila usa stats dos dois lados; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:5482 (infoItem devolve stats (statsDePeca)). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-80 | P1 | Nome do item perde a qualidade (motor escreve “+3”, o jogo mostra “+3 [A]”)
- **Ficheiro(s)**: extension/automation.js (e extension/gui.js onde o nome é mostrado)
- **Evidencia**: parte-02.md:4406 e 4543 — `nome: "Ímpeto Cósmico +3"` — **sem o `[A]`**, contra o ecrã do dono `"Ímpeto Cósmico +3 [A]"`; *“Para ler o ecrã e casar com o que tens equipado, falta a qualidade no nome”*; pedido em parte-02.md:4521
- **Fazer**: acrescentar a qualidade ao nome onde ele é construído (`[A]`, `[S]`…), para o nome do motor casar com o do jogo.
- **Aceitacao**: `nomeItem`/`infoItem` devolvem “+3 [A]” para a peça do dono; casamento com o texto do jogo testado no banco.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:7276 (nome do item com qualidade/refino). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-34 | P1 | Auditoria dos hardcodes da matemática de builds (necessário / derivável / heurística minha)
- **Ficheiro(s)**: docs/ (relatório da auditoria) + extension/automation.js para os que forem deriváveis
- **Evidencia**: parte-02.md:1531 — *“quantos hardcodes tu tem na matematica das builds e oq equipar de itens? por que era pra tu ter hardcode só doq tem q ser hardcode … como levar em conta passivas (que nem sei se é hardcode mesmo. pq é matematica do proprio jogo)”*; classificação pedida em parte-02.md:1586-1591 — (a) NECESSÁRIO, (b) DERIVÁVEL — devia sair do `motor.js` e `itens.js`, (c) HEURÍSTICA MINHA; lista actual em parte-02.md:1557-1562 — `pesosItem(perfil)`, `PESO_FASE`, `valorPassiva` (regex + multiplicadores à mão), `ITENS_ESPECIAIS` e `CAMPOS_MULT` (ids à mão), `PRIORIDADE_EXTREMA` (3031+3089 à mão), multiplicador de raridade próprio
- **Fazer**: inventariar **todos** os hardcodes com contagem total e classificação (a)/(b)/(c); para cada derivável, dizer **de onde** sairia o valor (`file:linha` do jogo) e implementar a leitura; os que forem (c) e precisarem de peso inventado, listar para o dono em vez de os inventar.
- **Aceitacao**: relatório com o número total e as três contagens; nenhum item da classe (c) continua no código sem decisão do dono; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo presente — evidencia automation.js:5120 (auditoria de hardcodes (relatorio)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-67 | P1 | 259 hardcodes na matemática de builds: 103 deriváveis e 151 heurísticas — plano de redução
- **Ficheiro(s)**: extension/automation.js (aplicar) · docs/hardcodes-build.md (fonte da auditoria)
- **Evidencia**: parte-02.md:3187-3195 e 3290-3298 — contagem: *“(a) NECESSÁRIO = 5 (2%) (b) DERIVÁVEL = 103 (40%) (c) HEURÍSTICA MINHA = 151 (58%)”*, grupos G1..G23 (pesosItem 55, PESO_FASE 41, valorPassiva 28, ITENS_ESPECIAIS 34, KAT_FB 11, MECANICA+cópias 30, statsSet/estimarSet/scoreSet 13); auditoria em `docs/hardcodes-build.md` (331 linhas, cada linha com file:linha + token + valor + o que deveria ser)
- **Fazer**: atacar primeiro os 103 **deriváveis** (substituir por leitura do jogo, um grupo de cada vez, começando pelos que mudam decisões: `pesosItem`, `PESO_FASE`, `valorPassiva`), e listar ao dono os 151 heurísticos que dependem de regra dele — sem os inventar.
- **Aceitacao**: cada grupo tratado tem teste a provar que o valor vem do jogo (duas execuções com motor diferente dão resultado diferente) e a contagem de heurístico desce; relatório com a contagem nova por classe.
- **Estado**: pendente

### TK-02-51 | P0 | Build ideal do motor escolhe a pior opção: bota de CDR + item de dano vs bota de pen + Ímpeto
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2436-2456 — simulador `tools/sim-build.mjs`: `A) CDR+Chama (3158, 4645): AP 859 · CDR 8% · pen 40%` contra `B) pen+Ímpeto (3175, 4629): AP 899 · CDR 15% · pen 55% ← DOMINA A em tudo`; *“B ganha em TODAS as armaduras, de 0 a 200+ … +184 a +228 de DPS. E ganha porque tem mais CDR (15% vs 8%), mais pen (55% vs 40%) e mais AP (899 vs 859) — não é uma troca, é uma dominância”*; e parte-02.md:2452-2456 / 2587 — *“A build actual é [3171, 3089, 3135, 3100, 4629] — bota de CDR (3171) + Ímpeto … A build que o motor escolhe é a pior das duas”*
- **Fazer**: corrigir a escolha da build ideal no motor para que a comparação seja feita ao nível da **combinação completa** (bota + item), e não de itens isolados, de modo a escolher a opção dominante; a prova é o simulador já escrito (`tools/sim-build.mjs`), com as constantes lidas do motor (`motor.js:499/515/522/529/537/539/1688/1207/173`).
- **Aceitacao**: no banco, a build ideal para um campeão AP passa a conter a bota de pen + Ímpeto (opção B) quando ela domina; o teste compara com os números do simulador; `bun tools/testes/run.mjs` rc=0. Ao vivo, marcador discriminante a mostrar a build nova.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:105 (build ideal do motor (sim-build)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-31 | P0 | Contagem dupla: o CDR do campo é somado outra vez pela regex da passiva (`vp3171: 90`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1404-1414 — *“Se o scoring soma `it.cdr` **e** o `valorPassiva` também lê "−15% na recarga", isso é contagem dupla — e a regex do CDR foi adicionada por mim hoje”*; medido em parte-02.md:1410-1412 e 1683-1684: `3171 cdr=0.15 → valorPassiva = 90` e `4629 cdr=0.15 → valorPassiva = 90` (ainda **não** corrigido na última verificação); campo/passiva em parte-02.md:1400-1401
- **Fazer**: correcção sistemática, não remendo: `valorPassiva` só pode modelar o que **não está** em campo estruturado; auditar uma a uma todas as regex acrescentadas contra os campos dos itens; e uma **guarda** que percorre os 108 itens e falha se voltar a haver duplicação (parte-02.md:1430).
- **Aceitacao**: a guarda corre no banco e falha se algum item tiver campo e passiva a serem somados duas vezes; `vp3171` e `vp4629` deixam de valer 90 (medir o valor novo e justificá-lo); `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:2237 (CDR sem contagem dupla (ler a fonte antes)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket


## TICKETS NOVOS (acrescentados pelo Lead 22:40 — P0 do leitor 2)
### TK-02-109 | P0 | O pen NÃO escala com qualidade/refino — o agente mandou escalá-lo e introduziu um bug
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:7431 e 7439-7446 — *“O pen NÃO é escalado por qualidade/refino: motor.js:251-255 reescala ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr e NÃO penMag; a dica MEDIDA do 3175~A diz ‘15% de penetração mágica’ (farm.json). Logo ‘17,25% com A’ está errado”*; e *“Confirmado … motor.js:254-255 ad*m, ap*m, … cdr*m ↑ penMag NÃO está na lista **O 3175~A dá 15% de pen, não 17,25%. E eu mandei o motor escalá-lo — introduzi um bug.**”*; confirmação pela medição em parte-02.md:7479 (*“a medição do dono de 0,55 = 0,40 (Vazio) + 0,15 confirma”*)
- **Fazer**: retirar a escala de qualidade/refino do `penMag` em todos os sítios onde foi introduzida (`efeitosEquipados`, `statsSet`, `parseSlotId`/`mult`, `valorEquip`/`valorVenda` se aplicarem) e deixar o pen como valor cru do catálogo; manter a escala para os campos que o motor escala (`motor.js:251-255`).
- **Aceitacao**: `3175~A` → pen 0,15 (não 0,1725) e `4629~A+3` → cdr 0,2346 (continua escalado); medição ao vivo a dar `pen 0,55` com a build do dono; `bun tools/testes/run.mjs` rc=0 com caso novo.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1175 (pen NAO escalado (motor.js:251-255)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-127 | P0 | Falta a magnitude do roubo de vida na pontuação (`cura/s = autoDps × rv`) — o `ad: 0` do perfil é a causa
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8712-8725 — feito: `readStats` passou a ler o Roubo de vida do painel e a **regex morta foi removida** (*“a auditoria do catálogo REAL (108 itens) deu ZERO acertos — era código morto que parecia tratar do assunto”*); NÃO feito: *“A magnitude do rv na pontuação (cura/s = dano_de_auto/s × rouboVida, motor.js:1226-1228) e o rv a valer ZERO numa build AP: é UMA só alteração de modelo — o termo de cura precisa do DANO DE AUTO-ATAQUE DA BUILD, e o poder(i) do montarBuildDe pontua item a item, sem essa noção”*; e parte-02.md:8980 e 9059-9061 (*“para a Katarina, o mesmo bloqueio do ponto 1 (perfil ad: 0) faria o rv continuar a valer ~0 mesmo com a fórmula certa”*); número em parte-02.md:8809-8811 (`cura/s = dano_de_AUTO_ATAQUE/s × rouboVida`; 17 cura/s em AP vs 269 em AD — 16× mais)
- **Fazer**: implementar o termo de cura por `cura/s = autoDps × rv` (`motor.js:1226-1228`) usando o dano de auto-ataque da build (o `det.autoCura`/`curaRV` que o simulador já expõe), e fazê-lo depender do peso do AD do perfil (ver TK-02-128).
- **Aceitacao**: a mesma % de rv dá valores diferentes por base (17 cura/s em AP vs 269 em AD) e a build de chefe passa a escolher itens com rv quando a cura decide a sobrevivência; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1716 (rv lido do painel (as DUAS grafias) e usado). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-134 | P1 | Bug irmão: o `3036` (pen de ARMADURA) está arquivado como `penMag` — dano mágico falso de +13% a +19,6%
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9626 e 9654-9662 — *“BUG IRMÃO (este atinge a Katarina): automation.js:3251 arquiva o ‘30% de penetração de armadura’ do 3036 como penMag → para campeões de magia o modelo aplica 30% de pen MÁGICA que o motor não dá (motor.js:529 não tem termo do 3036) → +13,0% (arm 104) a +19,6% (arm 200) de dano mágico falso. O 3036 está na build IDEAL dela.”*; e *“Para campeões de magia, o modelo aplica 30% de pen MÁGICA que o motor não dá … O motor está a inflacionar a build que recomenda.”*; correcção pedida em parte-02.md:9641 (*“Corrigir o statsSet para separar pen de armadura (3036) de pen mágica (3135/3175) — automation.js:3248-3251”*)
- **Fazer**: separar pen de armadura de pen mágica no `statsSet` (`automation.js:3248-3251`), para que o `3036` só entre na penetração de armadura (ramo físico, `motor.js:516→539→1202`) e nunca como pen mágica (`motor.js:529`).
- **Aceitacao**: com o `3036` na build, o dano mágico deixa de ter os +13% a +19,6% falsos; número antes/depois contra armadura 104 e 200; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:4785 (classe do item (3036 pen de armadura)). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-142 | P1 | `player()` continua a não devolver o `rv` — o valor é lido do painel e deitado fora
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9868 — *“A regex era código morto (0 acertos em 108 itens) e o readStats não lia o rv do painel. O OUTRO AGENTE JÁ CORRIGIU METADE durante a auditoria: removeu a regex (automation.js:4125) e pôs ‘Roubo de vida’ no readStats (1225) — MAS o player() continua a NÃO devolver rv (automation.js:1239): o valor é lido do painel e deitado fora.”*; confirmado em parte-02.md:9902 e 9982 (*“E o rv continua a ser lido e deitado fora”*)
- **Fazer**: fazer o `player()` devolver o `rv` lido do painel e ligá-lo ao cálculo de cura (`motor.js:1226-1228`).
- **Aceitacao**: `player().rv` devolve o valor do painel ao vivo (marcador discriminante) e a cura/s passa a usá-lo; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1716 (player() devolve o rv (as duas grafias)). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-150 | P1 | Pen mágica usada como pen de ARMADURA em campeão AD, e escudos fora da vida efectiva
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:10248 e 10250 — *“Pen MÁGICA usada como pen de ARMADURA em campeão AD (ao contrário): automation.js:3235/3243 soma pen += it.penMag, e 3285/5398 usam-no em armadura*(1-pen). O 3036 não tem penMag (verificado). Muda a escolha de itens em todos os AD.”*; e *“Escudos fora da vida efectiva (avaliar só usa player.vida, automation.js:1657-1679): Fluxo do Yasuo = 80+28*nível = 1.480 no nv50 (+37% de vida), Taric F 1.200, Zac G 800, 3053 ~1.000, 3157/3026.”*
- **Fazer**: separar pen mágica de pen de armadura em todos os sítios de decisão de item (`automation.js:3235/3243` vs `3285/5398`) e incluir os escudos na vida efectiva usada pelo `avaliar`.
- **Aceitacao**: campeão AD deixa de receber pen de armadura vinda de pen mágica; `avaliar` conta os escudos (Fluxo do Yasuo = +1.480 no nv50); testes novos.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1210 (pen magica separada da de armadura). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado
