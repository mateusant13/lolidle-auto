# FILA W11 — Build contra o Barão e decisão de chefe

**WORKTREE**: I:/wt/w11-boss   **BRANCH**: w11-boss

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: decisão de enfrentar chefes (limiares, tolerância de nível), critério de sobrevivência no ranking de itens para o 5.º espaço, banco de testes (tools/testes/) para as correcções novas. NÃO mexas em scoreSet, planejar, venda nem config.

## ORDEM DE TRABALHO
1. `cd I:\!lolidle.com; git worktree add I:/wt/w11-boss -b w11-boss` (se ainda não existir).
2. `cd I:/wt/w11-boss` e trabalha SÓ aí.
3. P0 primeiro. Para cada ticket: LÊ a fonte antes de alterar (Regra Nº 1). Muitos podem já estar corrigidos: VERIFICA antes; se estiver, fecha o ticket com a prova (ficheiro:linha).
4. `bun tools/testes/run.mjs` antes de commitar; se um teste codificar o comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
5. `git add -A; git commit -m "w11-boss: <uma linha>"`. NÃO faças merge.
6. Reporta no formato fixo do protocolo (TK / FICHEIROS / TESTES / COMMIT / RISCO / REGRA DO DONO).

## NOTAS DO LEAD (22:06)
- docs/game-src/motor.js é agora a versão VIVA do jogo (3846 linhas; +54 que a cópia velha). Os motor.js:NNN dos tickets podem estar desviados em dezenas: relocaliza por CONTEÚDO.
- Tens docs/game-src/dados-katarina.js (base real) e docs/game-src/kit-katarina-vivo.json (kit completo) lidos do jogo vivo — usa-os, não calibras à mão.
- Decisões do dono já resolvidas em docs/tickets/decisoes-resolvidas.md — não perguntes nada.
- Ferramenta útil: `bun tools/calc-jogo.mjs` lê o motor como texto e avalia qualquer constante (--expr).

## OS TEUS TICKETS (6)
### TK-02-81 | P0 | A build do bot contra o Barão é 2,8–3,4× pior que a ideal e não tem a `3153` Rei Destruído
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4605 e 4625-4634 — *“ACHADO QUE MUDA DECISÕES: (1) a 3153 Espada do Rei Destruído é a peça que decide a luta (5% da vida ATUAL do alvo por auto, teto 3×CURVA.hp, motor.js:1702+1191) e NENHUMA build do bot a tem”*; medições: `Yasuo IDEAL 7025 DPS · bot 2041 DPS → 3,4×`, `Katarina IDEAL 2757 DPS · bot 993 DPS → 2,8×`; e o nível mínimo que mata o Barão: Yasuo IDEAL nv29 (52,6 s, 41 poções, hpMin 108), Katarina IDEAL nv30 (68,4 s, 56 poções) contra nv32 da build do bot; detalhe em `docs/sim-baron.md`
- **Fazer**: fazer a build de chefe incluir a peça que decide a luta (Rei Destruído) quando o alvo tem muita vida, e passar a escolher pelo DPS/sobrevivência medidos contra o chefe (não só pela build de mobs com troca de 2 peças).
- **Aceitacao**: `buildIdealPara`/build de chefe para o Yasuo e a Katarina contém a `3153` contra chefes de vida alta, e o DPS contra o Barão deixa de ser 2,8–3,4× menor que o ideal; valores conferidos contra `tools/sim-chefes.mjs`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-83 | P1 | Implementar a tolerância de nível (monstro até +4 não penaliza; acima: +15%/nível até ×3 e −7%/nível com piso ×0,25)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4587 e 4644-4651 — *“O 4 de NIVEL_DIF (motor.js:1184) é OUTRA coisa: é a faixa de tolerância (monstro até +4 níveis não sofre nada; acima disso +15% dano monstro até ×3 e −7% dano jogador piso ×0,25 — motor.js:1185-1187, aplicados em 2696/3099 e 1221). Abaixo do nv38 o Barão fica preso no 42 e o jogador apanha ×2,2-2,35.”*; e parte-02.md:4651 (*“não é o Barão que sobe, é a tolerância que se esgota”*)
- **Fazer**: implementar a tolerância de nível na avaliação de luta (dano do monstro e dano do jogador) com `file:linha` do motor, e usá-la no critério de `morte`/fuga — é ela que explica porque o nível 29 é o limite no Barão.
- **Aceitacao**: teste a mostrar que um monstro +3 níveis não penaliza, +5 penaliza conforme `motor.js:1185-1187`; e o `morte` do Barão ao nível 29 continuar `true`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-74 | P1 | Testar Liandry vs Ímpeto no 5.º espaço **com sobrevivência** (350 de vida = 7,8%)
- **Ficheiro(s)**: extension/automation.js (critério) e/ou tools/sim-build.mjs (medição)
- **Evidencia**: parte-02.md:4103-4105 — *“Com o Ímpeto Cósmico (15% CDR) no lugar do Liandry, o total iria a 38% — ainda dentro do tecto dos 40%. E o simulador não testou essa troca: o ranking do 5.º espaço foi Lich > Liandry > Chama > Criafendas… com o Ímpeto já assumido como parceiro da bota. Quando o motor tirou o Ímpeto, ninguém voltou a comparar. É uma pergunta em aberto, não uma resposta.”*; encaminhado em `b0c34013` (parte-02.md:4134); e parte-02.md:4231 (*“esse teste também tem de incluir a sobrevivência, senão repete o mesmo erro numa escala maior — compara DPS e ignora os 350 de vida”*)
- **Fazer**: comparar as duas builds completas (com Liandry e com Ímpeto) com (a) DPS, (b) CDR total dos dois lados contra o tecto de 40%, e (c) sobrevivência — vida efectiva, hp mínimo e `morte` contra o alvo. Dizer qual item sai e qual é a build completa se ganhar o Ímpeto.
- **Aceitacao**: saída com os dois cenários lado a lado e um vencedor justificado por número (não só DPS); se a decisão depender de peso inventado, fica lista para o dono em vez de ser decidida.
- **Estado**: pendente

### TK-02-75 | P1 | O ranking de itens é só DPS — precisa de um critério de sobrevivência (o mesmo do cálculo de `morte`)
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:4215-4227 — *“Mas o ranking do 5.º espaço é só DPS … É uma comparação de DPS puro — e a vida não entra nela. Correcto para o que ela mede, mas não responde à pergunta que interessa: qual item te mantém vivo … O Ímpeto dá 350 de vida = 7,8% dos teus 4.476. E tu morres no Barão. Num sítio onde o que decide é sobreviver, 350 de vida pode valer mais que 200 de DPS — e o ranking, por construção, nunca o verá … Se o cálculo de sobrevivência tiver a vida como entrada, então a escolha de item devia usar o mesmo critério — não um ranking de DPS à parte.”*
- **Fazer**: fazer a escolha de item/build usar o mesmo critério de sobrevivência que o filtro de `morte` (vida efectiva, dano recebido por segundo, tempo que aguenta), e não apenas DPS; o critério do dono é *(sobrevive?, mata em quantos segundos?, quantas poções e quanto custam?)* — AGENTS.md.
- **Aceitacao**: para um alvo que mata o boneco, a build escolhida é a que sobrevive (mesmo com menos DPS), provado por número; `bun tools/testes/run.mjs` rc=0 com caso novo.
- **Estado**: pendente

### TK-02-55 | P1 | Faltam as asserções do banco para as correcções novas do motor (provas feitas só por script efémero)
- **Ficheiro(s)**: tools/testes/ (novas/actualizadas suites)
- **Evidencia**: parte-02.md:3049 — *“NAO escrevi nem alterei NENHUMA assercao do banco (o meu escopo e automation.js). As assercoes novas que pediste (3031/3089, rotacao, fuga, regiao memorizada, barra, auditoria de passivas) ficam do teu lado; deixei-as provadas por script efemero e expus no window.__lolidleAuto o que o banco precisa: auditoriaPassivas, regiaoSegura, primeiaVez, primeiraVezPasso, PRIORIDADE_EXTREMA, ehPrioridadeExtrema”*
- **Fazer**: escrever as asserções para: (a) protecção `3031`/`3089` (duplicados incluídos) com controlo de item comum a ir ao mercado; (b) `rotacao` sob manutenção a mexer a barra com auto-play desligado; (c) `fugir` em manutenção, sem exigir chefe, com controlo `fugir=false`; (d) `regiaoSegura` a descartar memória letal e a aceitar memória segura; (e) `barraPorDisponibilidade` (cenário de 2 prontas + 2 em recarga, empate sem oscilação, ultimate sempre em 1.º); (f) `auditoriaPassivas().duplas.length === 0`.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com as suites novas e POPULATION acima de 260; relatório nomeia cada asserção acrescentada e qual comportamento antigo deixa de ser aceite.
- **Estado**: pendente

### TK-02-52 | P1 | Rotação da barra: comportamento “usar tudo disponível” está desligado — dono quer ligado por defeito
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2696 — *“tu entende que antes funcionava de forma perfeita, onde usava tudo disponivel (sem clicar nas skills, ja que o farm usa skill automatico, é coisa do jogo, por isso idle) e ai removia dos slots pra colocar nos slots as que tavam mais proximas de serem usadas, e assim em loop, o tempo inteiro?”*; o que o código dizia em parte-02.md:2608-2610 (*“a versão antiga ordenava por pronto (recarga) e por isso a barra mudava a cada 2 s”* — tratado como defeito); correcção encaminhada em `6139633e` (parte-02.md:2734-2751): ligado por defeito, **ultimate sempre dentro**, prontas primeiro e em recarga pela recarga restante, **reavaliação contínua a cada 2 s** (loop), **sem clicar skills**, anti-oscilação em empates
- **Fazer**: repor o comportamento por defeito descrito pelo dono, com as 5 condições da correcção encaminhada, e com prova num cenário de 4 skills (2 prontas, 2 em recarga) mostrando as duas barras exactas.
- **Aceitacao**: ao vivo, a barra da Katarina troca sozinha ao longo do combate (marcador discriminante no log a cada reavaliação) com a ultimate sempre dentro; o cenário de 4 skills passa no banco com as barras exactas; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente
