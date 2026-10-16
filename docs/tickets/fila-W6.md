# FILA W6 — GUI (extension/gui.js)

**WORKTREE**: I:/wt/w6-gui   **BRANCH**: w6-gui

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em extension/gui.js. NÃO mexas em automation.js, inject.js, content.js nem tools/.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w6-gui -b w6-gui`
2. `cd I:/wt/w6-gui` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w6-gui: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (10)
### TK-02-16 | P1 | GUI do chefe mostra `perMin` (taxa) em vez de `perKill` — artefacto de denominador
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:860-877 — `bossFase: { durMs: 35616, gold: 1526, xp: 3654, kills: 1, perMin: {...}, perKill: {...} }`; *"O motor já tem o dado certo — perKill existe na estrutura. É a tabela que mostra perMin, que para uma janela de um só chefe é enganador"*; encaminhado como `3c578d07` em parte-02.md:1002
- **Fazer**: na tabela/aba do chefe, mostrar **loot por abate** (ouro e xp `perKill`) e o **tempo do chefe** ao lado como custo; deixar de mostrar `perMin` como número de decisão (ou mostrá-lo só como rótulo secundário).
- **Aceitacao**: ao vivo, números iguais a `bossFase.perKill` do motor (prova: ler `getFarm().cycles[].bossFase.perKill` e comparar com a célula da GUI); marcador discriminante no id/célula nova.
- **Estado**: codigo presente — evidencia gui.js:2012 (GUI do chefe (perKill vs perMin)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-17 | P1 | Erro visível ao dono: "Não foi possível calcular o plano da mochila (o motor não respondeu)"
- **Ficheiro(s)**: extension/gui.js (e extension/automation.js só se o `planBag` precisar de assinatura nova)
- **Evidencia**: parte-02.md:1007-1012 — texto exacto do erro na GUI; *"suspeito que a GUI chame o `planBag` sem lhe passar a mochila"*
- **Fazer**: corrigir a chamada — `planBag(A.scanBag(true))` em vez de `planBag()` sem argumentos (medido em parte-02.md:1086-1090 e 1123-1126: `planBag()` → LANCOU "Cannot read properties of undefined (reading 'items')"; `planBag(scanBag(true))` → ok, 12 acções), com estado vazio honesto se a leitura falhar; **nunca apresentar um erro nosso como falha do motor** (parte-02.md:1130).
- **Aceitacao**: bloco "O que vai acontecer a cada item" mostra o plano com itens reais (sem a mensagem "o motor não respondeu"), provado ao vivo com marcador discriminante; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo presente — evidencia gui.js:162 (GUI: erro do plano da mochila). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-26 | P1 | GUI não conhece a `PRIORIDADE_EXTREMA` — painel “Blindados” esconde o `3031`
- **Ficheiro(s)**: extension/gui.js (+ expor a tabela em extension/automation.js)
- **Evidencia**: parte-02.md:1358-1359 — *“Grep em `gui.js`: **0 referencias** a PRIORIDADE_EXTREMA. `gui.js:1521-1531` (`protegidos()`, cartao “Blindados” em `gui.js:1555-1557`) so tem RABADON (`gui.js:1523`, `gui.js:48`) + lendarios da build da classe ... num campeao AP o motor protege o 3031 mas o painel nao o mostra”*; a tabela já existe no motor em `automation.js:26-58` (3031 em 48, 3089 em 49), ligada em 300, 306, 424, 2029, 2572, 3441, 4279
- **Fazer**: expor `PRIORIDADE_EXTREMA` em `window.__lolidleAuto` (junto de `automation.js:5978`) e consumir em `gui.js:1521`, para o cartão “Blindados” mostrar todos os protegidos com o mesmo critério do motor.
- **Aceitacao**: ao vivo, num campeão AP o painel mostra o `3031` marcado como protegido, igual ao que o motor faz; marcador discriminante no cartão; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo presente — evidencia gui.js:1730 (GUI conhece PRIORIDADE_EXTREMA). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-28 | P1 | Painel de controlo sem switches (mestre “Tudo” + filhos independentes + indicador vermelho/verde)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:1206 — *“painel de controle tem q ter switch de cada coisa que consegue fazer sozinho pelo jogador. o switch primeiro é chamado de tudo (auto play), e o resto dos switches sao dentro desse auto play, mas ativar um deles nao ativa o auto play ... pra cada switch ativado, tem q ter uma checkbox q nao e box, e texto vermelho ou verde dizendo oq cada coisa cobre/e oq vai acontecer e oq deixa de acontecer com um switch desativado”*; spec encaminhada em `0b09e91d` (parte-02.md:1212-1219), com os 15 interruptores lidos de `arvoreInterruptores()`
- **Fazer**: gerar os switches a partir da árvore real do motor (`arvoreInterruptores()` — nunca escrita à mão); mestre “Tudo (auto-play)” no topo; filhos que não ligam o mestre; distinguir *“o dono desligou”* de *“está bloqueado pelo pai”* usando o `porque` do `podeFazer`; indicador de texto **verde** (o que cobre, ligado) e **vermelho** (o que deixa de acontecer, desligado), escrito como efeito no jogo e não como nome técnico.
- **Aceitacao**: os switches renderizados vêm da árvore (prova: mudar a árvore muda o número de switches); ligar um filho não liga o mestre (medido por `podeFazer` ao vivo); cada switch tem a linha verde/vermelha; marcador discriminante no painel novo.
- **Estado**: codigo presente — evidencia gui.js:340 (GUI com switches (mestre + filhos)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-10 | P2 | GUI sem secções de farm (auto farm sozinho vs auto farm por item, com escolha dos itens)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:178 — *"quero auto farm sozinho, auto farm pra item onde escolho todos os itens que quero dropar"*; distribuido em parte-02.md:208
- **Fazer**: duas secções de farm na GUI — "auto farm sozinho" e "auto farm por item" com multi-selecção de itens — ligadas ao `planejar(ids)` (depois de TK-02-03, para não prometer regiões que não dropam).
- **Aceitacao**: render sem erro no smoke test da GUI e secções minimizáveis; seleccionar um item mostra a região/drops-hora coerentes com a classe do campeão ao vivo.
- **Estado**: codigo presente — evidencia gui.js:38 (GUI seccoes de farm). **Grep nao e prova semantica**: a suite que cobre esta area esta verde no banco 25/25; falta o teste dedicado

### TK-02-11 | P2 | Bloco "Build por fase" no topo da GUI não minimiza em aba nenhuma
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:8 e 617 — *"o bloco do topo (`ap-build-fase`, 5 referências) está lá — é o mesmo de que o dono se queixou"*; encaminhado ao `0066c422` em parte-02.md:627
- **Fazer**: tornar o bloco minimizável e/ou movê-lo para dentro do sistema de abas (merge de abas por assunto), sem o deixar fora do contentor.
- **Aceitacao**: marcador discriminante na GUI (id/classe do bloco novo) + interacção real a minimizar; GUI só desenha a aba activa — clicar na aba antes de verificar (REGRA Nº 4).
- **Estado**: codigo presente — evidencia gui.js:42 (GUI: bloco build por fase minimizavel). **Grep nao e prova semantica**: falta teste dedicado

### TK-02-19 | P2 | Texto da GUI em pt-PT e a citar o histórico do projecto em vez de ser genérico
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:911 e 1000 — *"para de usar pt pt no gui. usa pt br. e para de explicar coisas que sao historico nosso. ta explicando de 'ainda usa a bota quando chega uma melhor' só pq é um incidente que aconteceu com a gente"*; encaminhado como `fcb162ff`
- **Fazer**: varrer todos os textos visíveis da GUI e passar a pt-BR, removendo referências a incidentes da sessão ("ainda usa a bota quando chega uma melhor", etc.); cada mensagem passa a descrever a regra geral do jogo/motor.
- **Aceitacao**: zero ocorrências de pt-PT (lista de verificação: "acções", "objecto", "defeito", "diagnóstico"...) no fonte da GUI; zero ocorrências de frases do histórico; prova por `grep` no relatório.
- **Estado**: pendente

### TK-02-20 | P2 | "Desligado" e "Retomar tudo" parecem a mesma função — design de estado não existe
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:926-967 — semântica lida em `automation.js:5363-5391`: *"PAUSAR congela as ACÇÕES, continua a OBSERVAR; DESLIGAR para TUDO e LIMPA o estado activo; KILL igual a desligar, mas PERSISTIDO"*; tabela dos 4 estados em parte-02.md:944-948 e o design proposto em 958-965; encaminhado como `b1ea8ce6`
- **Fazer**: implementar um indicador de estado + **um** botão cujo rótulo depende do estado (Observação/Ligado/Pausado/Desligado → "Ligar auto-play"/"Desligar"/"Retomar"/"Religar"), com Pausar e Parar-tudo como acções secundárias distintas; nunca os três ao mesmo tempo sem dizer o que diferem.
- **Aceitacao**: cada um dos 4 estados tem rótulo e acção distintos e verificáveis ao vivo (clicar em cada transição muda o rótulo como na tabela); marcador discriminante no botão novo.
- **Estado**: codigo presente — evidencia automation.js:7358 (estados distintos desligar/religar). **Grep nao e prova semantica**: a suite que cobre esta area esta verde no banco 25/25; falta o teste dedicado

### TK-02-45 | P2 | UX da GUI: switch à direita, do tamanho da janela inteira, texto truncado/ilegível
- **Ficheiro(s)**: extension/gui.js, extension/popup.css
- **Evidencia**: parte-02.md:1877 — *“a user experience da gui ta uma merda. tira print voce mesmo e arruma cada aba. e tem coisa que nao ta legivel ou truncada”*; e parte-02.md:1880 — *“faz o switch de habilitar coisas do painel na esquerda, nao na direita. e é completamente ESTUPIDO que o switch seja do tamanho da gui inteira”*
- **Fazer**: passar os interruptores do painel para a **esquerda**, com tamanho de interruptor (não full-width); varrer cada aba atrás de texto truncado ou ilegível (medir no DOM, não a olho) e corrigir; rever uma aba de cada vez com print real.
- **Aceitacao**: print de cada aba (aberta pelo caminho real de abertura — ver TK-02-46) sem texto cortado; interruptores à esquerda e com largura de interruptor; marcador discriminante nas classes novas.
- **Estado**: codigo presente — evidencia gui.js:67 (GUI switch/UX). **Grep nao e prova semantica**: a suite que cobre esta area esta verde no banco 25/25; falta o teste dedicado

### TK-02-46 | P2 | Painel da GUI não abre por `classList.add(on)` — caminho real é o `abrir()` interno
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:1927 — *“O painel não apareceu na captura. Eu abri-o com classList.add(on), e isso não é o caminho real de abertura — o painel só renderiza quando o abrir() interno corre (hover no lançador ou F8 pelo handler). A captura mostra o jogo, não a GUI. Não consigo fazer a revisão visual que pediste até acertar no caminho de abertura.”*
- **Fazer**: usar o caminho real de abertura (hover no lançador ou F8 pelo handler) nas ferramentas de print/verificação; se o painel não depender de JS para renderizar, garantir que o render não dependa de interacção escondida.
- **Aceitacao**: print do painel com conteúdo real (painelLen > 1.000 caracteres medido no DOM) pelo caminho real; marcador discriminante; documentar o caminho de abertura no README/docs para os próximos agentes.
- **Estado**: codigo presente — evidencia gui.js:8 (GUI caminho real de abrir). **Grep nao e prova semantica**: a suite que cobre esta area esta verde no banco 25/25; falta o teste dedicado

---
