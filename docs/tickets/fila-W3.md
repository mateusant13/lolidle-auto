# FILA W3 — Barra de skills, rotação e combate

**WORKTREE**: I:/wt/w3-barra   **BRANCH**: w3-barra

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: barraIdeal, rotacao/skillsPorFase, escolha de skill no combate, pontos de atributo, filtro de básicos. NÃO mexas em build de itens, região, fuga, mercado nem GUI.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w3-barra -b w3-barra`
2. `cd I:/wt/w3-barra` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w3-barra: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (5)
### TK-02-02 | P0 | Rotação de skills nunca troca a barra (actor pergunta a `cfg.enabled`, mestre errado)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:466-472 — `buildPorFase/skillsPorFase/rotacao: { pai: 'autoplay' }`; *"o autoplay tem excepção de campeão — logo na Katarina fica desligado, e podeFazer('rotacao').pode === false. A barra nunca troca"*; e o portão parte-02.md:479 `if (!cfg.enabled || cfg.rotacaoSkills === false || _rotBusy || pausado) return;`
- **Fazer**: reparentar `rotacao` e `skillsPorFase` para `manutencao` (trocar a barra é recurso base) e trocar o portão directo do actor para `podeFazer('rotacao')`; o actor deixa de perguntar ao mestre errado.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com tools/testes/interruptores.test.mjs actualizado à regra nova (I3 `rotacao.pai === 'manutencao'`, I5 conta da árvore) — e dizer no relatório que asserções mudaram (REGRA Nº 6). Ao vivo: barra converge para `[R,Q,A,W]` com a ultimate dentro, provado por marcador discriminante (texto que só existe na build nova).
- **Estado**: codigo CORRIGIDO — evidencia automation.js:7152 (rotacao pergunta a hierarquia (podeFazer)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-18 | P1 | `barraIdeal` devolve o MESMO conjunto para mobs e chefe (preferência multi-alvo não discrimina)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:923 e 980-987 — `ideal mobs: [R, Q, A, W]` / `ideal chefe: [R, Q, A, W]` ← IDÊNTICOS; *"a preferência por multi-alvo não está a discriminar"*; kit da Katarina tem `alvos: 3` só no Q e no R
- **Fazer**: diagnosticar porque a fase não muda o conjunto (a fase tem de afectar os pesos das skills, não só a ordem) e fazê-lo discriminando de facto — **sem inventar pesos**: os pesos vêm do motor (`file:linha`) ou vão para decisão do dono.
- **Aceitacao**: para um campeão com kit de áreas (Lux/Yasuo/Darius) as barras mob vs chefe diferem no banco (prova já existente: Yasuo troca `3085`→`3036`); para a Katarina, se as barras legítimamente coincidem, dizer isso no relatório com `file:linha` em vez de forçar troca.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:120 (barraIdeal por fase (mob x chefe)). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-05 | P1 | 13 passivas de estado continuam sem regra própria com contexto de combate
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:226 (objectivo, ponto 2) — *"13 passivas de estado (Stasis, Renascimento, Eco, Furia do Vento, Geada, Rammus...): precisam de regra propria com contexto de combate. Se exigirem pesos inventados, pedir a regra ao dono em vez de inventar."*
- **Fazer**: para cada uma das 13, ler a mecânica em docs/game-src/motor.js (REGRA Nº 1: bloco inteiro, valor + lista de campos) e implementar regra própria activada pelo contexto de combate (mob/chefe/fase). Se alguma exigir peso que não existe no jogo, **não inventar**: deixar lista nomeada no relatório para o dono.
- **Aceitacao**: cada passiva com `file:linha` do motor no comentário do código; `bun tools/testes/run.mjs` rc=0; nenhuma constante "inventada" sem origem no motor.
- **Evidencia extra (RESUMO DE COMPACTAÇÃO #3, parte-02.md:3396)**: passivas já modeladas 37 de 50 (74%); as **13 restantes** são exactamente as de estado/combate: `3057 3116 3085 6655 3742 3102 3083 6610 3026 3157 6333 3078 3072`.
- **Estado**: PARCIALMENTE ARRUMADO — o mecanismo existe (`PASSIVA_POR_ALVO` em automation.js:4901 + `valorPassiva`/`sinergiaDe`), mas **a cobertura das 13 passivas NAO foi verificada**: eu nao enumerei as 13 contra o motor. Fica ABERTO com o proximo passo explicito: listar as passivas de estado no motor (`k.hab.*.armPassiva`, `passivaLux`, ...) e confrontar uma a uma com o `PASSIVA_POR_ALVO`

### TK-01-37 | P2 | pontos de atributo: Vitalidade/Resistencia nao dao dano (Forca +2,64%, Agilidade +1,96%)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1076 (D2): "10 pontos em Vitalidade/Resistencia = +0,00% de dano; Forca = +2,64%; Agilidade = +1,96%. ACREDITO NA MATEMATICA (e no dono, TODOS.md:1148)"
- **Fazer**: recomendar/distribuir pontos pelo valor medido de dano por ponto (por classe), com a ressalva de sobrevivencia quando o dono quiser; nao inventar numero — confirmar em motor.js a formula de cada atributo.
- **Aceitacao**: teste: recomendacao de pontos Yasuo prioriza Forca/Agilidade sobre Vitalidade/Resistencia no cenario de dano; fórmula citada com file:line.
- **Estado**: pendente

### TK-02-27 | P2 | Critério do filtro de básicos não está automatizado (nem o clique com `change`)
- **Ficheiro(s)**: extension/automation.js, extension/gui.js
- **Evidencia**: parte-02.md:1298-1305 — *“`#ignorar-basicos` ... arranca desligado ... AÇÃO PRÁTICA PARA A AUTOMAÇÃO: clicar tem de **disparar `change`** (o unico writer e o listener de jogo.js:5883). Escrever `.checked = true` NAO atualiza `estado.ignorarBasicos`”*; critério em parte-02.md:1302-1303 — *“B = folhas das receitas que ainda vais montar; B=0 → clicar. No plano comprar pronto (regra do dono, automation.js:404-408) B=0 desde o abate 1 → clicar já”*
- **Fazer**: implementar o clique em `#ignorar-basicos` quando o critério B (folhas de receita ainda necessárias) der 0, disparando `change` e nunca escrevendo `.checked`; verificar por `document.querySelector("#ignorar-basicos").checked`.
- **Aceitacao**: no banco, um caso com B=0 clica e o estado passa a ligado (evento `change` registado no dom-stub) e um caso com B>0 não clica; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente
