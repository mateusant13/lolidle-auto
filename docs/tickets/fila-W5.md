# FILA W5 — Mercado, épicos, equipar e Ornn

**WORKTREE**: I:/wt/w5-equipar   **BRANCH**: w5-equipar

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: decisão de guardar/vender épicos, autoEquip, mercado (poll/compra/venda), montarItem/Ornn, refino de essenciais. NÃO mexas em build, região, barra, fuga nem GUI.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w5-equipar -b w5-equipar`
2. `cd I:/wt/w5-equipar` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w5-equipar: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (8)
### TK-02-01 | P0 | Épicos ainda saem GUARDAR por "sem regra" (componente épico preso)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:17-18 e 42-45 — marcador ao vivo `3108~A [epico/A] → GUARDAR ✗ AINDA GUARDADO`; *"a linha 407/411 só mandava épicos ao Lojista se não fossem componentes … caíam no else final e saíam GUARDAR com motivo 'sem regra'"*
- **Fazer**: no ramo de destino de item da manutenção, épicos vão ao Lojista **sem excepção de componente**; remover a condição que exclui componentes (linha ~407/411) para não haver "corrigi metade da regra".
- **Aceitacao**: `node --check extension/automation.js` rc=0 e `bun tools/testes/run.mjs` rc=0 com suite nova/actualizada em tools/testes/regras.test.mjs a cobrir `epico + componente → Lojista`; ao vivo, marcador discriminante no log `3108~A → VENDER` (ou equivalente) em vez de `GUARDAR`, provado depois de `lolidle:reload` + reload da página (REGRA Nº 4).
- **Estado**: codigo CORRIGIDO — evidencia automation.js:96 (epico com regra (nao 'sem regra')). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-01-39 | P1 | montarItem (Ornn) funciona mas NAO esta ligado ao auto-play — build lendaria nao sai do sitio
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3465: "receitasOrnn() -> filter the pode: true recipes serving the decided build -> write montarItem(id)... The reading half is done; execution is the next piece"; L4063-4071 montarItem executou ao vivo (10x, 16.500 ouro, log {type:ornn, acao:montar, ok:true}); L4107 "the complete chain is proven end-to-end... The next step is simply more attempts"
- **Fazer**: ligar a montagem ao auto-play: na visita a base (com pausarPor — TK-01-46) correr receitasOrnn() -> escolher receita pode:true que sirva a build (Tiamat primeiro, L3519-3520) -> montarItem(id, 100, arcana) contando tentativas/sucessos e ouro; respeitar teto de reserva e parar em falha.
- **Aceitacao**: ciclo completo ao vivo sem intervencao: escolha -> montar -> contagem no log ({vezesUsadas, ouroGasto, temAgora}) e >=1 item montado em sessao; regressao POPULATION rc=0.
- **Estado**: codigo presente — evidencia automation.js:5835 (montarItem ligado (receitasOrnn)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-01-40 | P1 | full build lendaria equipada e verificada (entregavel 1b do goal — NAO cumprido)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3386: "your deliverable #1 explicitly requires full build equipada e verificada no jogo real. He is wearing five basic/epic items, not legendaries. That is the gap."; L2606: "Ornn epic crafting (18k-118k gold)... he now has 197.600, so he can start forging"
- **Fazer**: executar a escada lendaria ate os 5 slots da build ideal estarem equipados com itens lendarios (ou a melhor versao encontrada por dado), e verificar ao vivo via ll.mjs (equip + player).
- **Aceitacao**: leitura ao vivo dos 5 slots mostra itens da build final; player stats registadas; nenhum lendario vendido pelo caminho (proteccao componentesDaBuild activa, L4361-4379).
- **Estado**: ABERTO — 'full build lendaria equipada e verificada' e um ENTREGAVEL (precisa de prova AO VIVO, no jogo a correr). Nao verificavel enquanto o jogo nao estiver a jogar (bloqueado nos 2 cliques do dono)

### TK-02-04 | P1 | `3031` Gume do Infinito não tem guarda de "intocável" (o Rabadon tem)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:216 e 294 e 399 — *"Hoje o Rabadon é intocável por uma guarda própria (`RABADON = '3089'`); o Gume do Infinito não tem guarda equivalente"*; **ACTUALIZADO pelo lote 3** (parte-02.md:1357-1358): a guarda já existe no motor como `PRIORIDADE_EXTREMA` (`automation.js:26-58`, com 3031 em 48 e 3089 em 49, ligada em 300/306/424/2029/2572/3441/4279) e foi medida a proteger `3031~C`x2 e `3089~C`x2 em Yasuo (AD), Lux (AP) e Zac. Regra do dono: *"mesmo duplicados, é o jogador que decide com eles"*
- **Fazer**: (a) confirmar ao vivo (com marcador) que a guarda cobre duplicados e que a cobertura é por classe sem excepções; (b) a lacuna real que ficou é a GUI — ver **TK-02-26**; (c) se a lista de prioridade extrema tiver de crescer (outros itens que o dono nomear), acrescentar na mesma tabela `automation.js:26-58`.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com asserção nova (duplicado de `3031` e de `3089` em campeão da outra classe **não** é vendido/limpo; duplicado de item comum continua a sê-lo).
- **Estado**: codigo presente — evidencia automation.js:47 (PRIORIDADE_EXTREMA (intocaveis)). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-07 | P1 | Lendário único da classe tem de ser guardado — critério ainda não é a classe
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:401 e 567 — *"Lendário único da classe → guardar, com o critério a ser a classe"*
- **Fazer**: implementar a guarda de "lendário único da classe do campeão" (usar a classe lida do jogo, não uma tabela fixa), de modo a não vender a única peça lendária que a build da classe pode usar.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com caso "lendário único da classe e duplicado de lendário de outra classe" a dar resultados diferentes.
- **Estado**: codigo presente — evidencia automation.js:349 (lendario unico pela classe). **Grep nao e prova semantica**: falta a verificacao ticket-a-ticket com teste dedicado

### TK-01-26 | P2 | M5: ciclo de mercado por implementar (poll/compra/venda)
- **Ficheiro(s)**: extension/automation.js; tools/ll.mjs
- **Evidencia**: parte-01.md L998: "M5/M6 (market cycle, refine-by-essential-item) haven't been touched"; datas snapshot docs/snapshots/market.json (58 B = vazio)
- **Fazer**: O CICLO JA FUNCIONA (L1748-1749 verificou comprarNoMercado na base lendo precos reais 3172=350.000/3085=180.000; L2076-2077 reserva corrigida para base medida; L2196-2200 o mercado so abre no Mercador da Fonte). Falta: (a) garantir que corre SOZINHO a cada visita a base (throttle 10 min, L1745); (b) registar no log quando nao ha ofertas para os itens da build (L2200) em vez de devolver compras:[] sem explicacao; (c) o produto comprado tem de cair para a build/componentes (proteccao em venderBase — historico L4310-4321, componentesDaBuild()).
- **Aceitacao**: 3 visitas a base consecutivas com o ciclo a correr sem intervencao; log com motivo explicito quando compras:[]; compra real registada quando houver oferta.
- **Estado**: pendente

### TK-01-27 | P2 | M6: refino por item essencial
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L998: "M5/M6 ... haven't been touched"; ordem do dono: "refinar item essencial A+ ate +2/+3" (L10-11)
- **Fazer**: escolher o item essencial da build ativa e refinar primeiro esse (A+ → +2/+3), com a guarda do TK-01-23 e limites de risco definidos.
- **Aceitacao**: teste: com 3 itens refinaveis, o essencial da build e escolhido; refinamento para quando o risco de rebaixar e inaceitavel.
- **Estado**: pendente

### TK-01-45 | P2 | Ornn: receita escolhida por dado (custo esperado + componentes na mochila) e nao ao acaso
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3486-3519: "receitasOrnn() works — 40 recipes read at zero cost... tentativasMedias: 83"; L3523: "Assembly can now be chosen by data: which recipes serve the build, which have components, and what each costs on average"
- **Fazer**: ranking de receitas por (serve a build) x (custo esperado = ouro/tentativa x tentativasMedias) x (tem componentes), com teto de ouro da reserva; escolher a mais barata que sirva a build.
- **Aceitacao**: teste: com 3 receitas serve-build e custos diferentes, a escolhida e a de menor custo esperado com componentes; log mostra o porque.
- **Estado**: pendente


## TICKETS NOVOS (P0, acrescentados pelo Lead às 21:50)
### TK-01-51 | P0 | venderBase/planBag vendem BASICOS que sao componentes de receita (zero Adagas -> nenhuma receita Ornn arranca)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7728-7735: "componentesDaBuild() = [3006, 1001, 1042, 3086, 1018, 3077, 1036, 3044, 1028, 3144, 1038, 1037]... a excepcao componentesDaBuild() so a pus para EPICOS, nao para basicos. Logo ele esta a vender os componentes que a build precisa"; L7828: "a minha regra de venda nao poupa os basicos que sao componente de receita (1042 Adaga...) — e por isso que ele tem zero Adagas"; gargalo confirmado em L6576/L6882/L6938
- **Fazer**: estender a excepcao de venda (componentesDaBuild) aos BASICOS tambem; nenhum item que seja componente de receita da build pode ser vendido. Atencao a nao recriar o ciclo de viagem: o planner tem de concordar com o actor (regra do comentario l.275-282).
- **Aceitacao**: teste no banco: basico 1042 (Adaga) com componentesDaBuild() a contê-lo -> planBag NAO marca VENDER_LOJISTA e venderBase protege; lixo nunca fica preso por isso; mochila do Yasuo passa a acumular Adagas ao vivo.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:514 (componentesDaBuild usada na venda). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-01-68 | P0 | n.equip/n.comprar presos em true para sempre (4.a necessidade que nunca fecha)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L8433-8460: "n.equip e o n.comprar comparam contra o buildIdeal() — a build de fim de jogo [3172,3046,6631,3085,3031]... Ele nao tem NENHUM dos cinco, e nao pode compra-los (sao lendarios de milhoes). Logo comprar = true para sempre / equip = true para sempre... E a terceira vez nesta sessao que aparece a mesma classe de bug"; confirmado pendente em L8990 e L9008
- **Fazer**: n.equip so true se houver na MOCHILA ou no COFRE item melhor que o equipado no slot; n.comprar so true se o item estiver ao alcance do ouro actual E o custo da viagem se pagar. Ambos passam pelo backoff como as outras necessidades.
- **Aceitacao**: teste: sem item melhor disponivel e sem ouro para a build ideal -> n.equip=false e n.comprar=false; com item melhor na mochila -> true; faltandoNaBase() fica [].
- **Estado**: codigo CORRIGIDO — evidencia automation.js:3513 (n.equip/n.comprar comparam com a build). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket
