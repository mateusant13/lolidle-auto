# Tickets — parte-02 do histórico (fonte: docs/historico/parte-02.md)

> Âncora de escrita: `parte-02-lote-1` (agente leitor, 2026-10-14). Gerado por leitura do histórico;
> NÃO é trabalho feito. Cada ticket tem write-scope fechado: um worker, um ficheiro.
> Regra: um ficheiro, um escritor (AGENTS.md REGRA Nº 5). O worker confirma os números em
> docs/game-src/motor.js antes de codar (REGRA Nº 1) e nunca copia número do resumo da extensão.


### TK-02-01 | P0 | Épicos ainda saem GUARDAR por "sem regra" (componente épico preso)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:17-18 e 42-45 — marcador ao vivo `3108~A [epico/A] → GUARDAR ✗ AINDA GUARDADO`; *"a linha 407/411 só mandava épicos ao Lojista se não fossem componentes … caíam no else final e saíam GUARDAR com motivo 'sem regra'"*
- **Fazer**: no ramo de destino de item da manutenção, épicos vão ao Lojista **sem excepção de componente**; remover a condição que exclui componentes (linha ~407/411) para não haver "corrigi metade da regra".
- **Aceitacao**: `node --check extension/automation.js` rc=0 e `bun tools/testes/run.mjs` rc=0 com suite nova/actualizada em tools/testes/regras.test.mjs a cobrir `epico + componente → Lojista`; ao vivo, marcador discriminante no log `3108~A → VENDER` (ou equivalente) em vez de `GUARDAR`, provado depois de `lolidle:reload` + reload da página (REGRA Nº 4).
- **Estado**: pendente

### TK-02-02 | P0 | Rotação de skills nunca troca a barra (actor pergunta a `cfg.enabled`, mestre errado)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:466-472 — `buildPorFase/skillsPorFase/rotacao: { pai: 'autoplay' }`; *"o autoplay tem excepção de campeão — logo na Katarina fica desligado, e podeFazer('rotacao').pode === false. A barra nunca troca"*; e o portão parte-02.md:479 `if (!cfg.enabled || cfg.rotacaoSkills === false || _rotBusy || pausado) return;`
- **Fazer**: reparentar `rotacao` e `skillsPorFase` para `manutencao` (trocar a barra é recurso base) e trocar o portão directo do actor para `podeFazer('rotacao')`; o actor deixa de perguntar ao mestre errado.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com tools/testes/interruptores.test.mjs actualizado à regra nova (I3 `rotacao.pai === 'manutencao'`, I5 conta da árvore) — e dizer no relatório que asserções mudaram (REGRA Nº 6). Ao vivo: barra converge para `[R,Q,A,W]` com a ultimate dentro, provado por marcador discriminante (texto que só existe na build nova).
- **Estado**: pendente

### TK-02-03 | P0 | `planejar()` é class-blind: escolhe a tabela de drops errada (AD recebe tabela AP)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:313-314 e 340-341 — `automation.js:1545  const chance = z.porClasse ? (z.porClasse.ap || z.porClasse.ad || ...) : 0;` *"prefere sempre .ap, seja o campeão AD ou AP"*; contraste parte-02.md:377 `automation.js:4799 comprar-vs-farmar: reg.porClasse[classe] || 0 ← JÁ ESTÁ CERTO`
- **Fazer**: no `planejar`, escolher `z.porClasse[classeDoCampeao]` (classe lida do campeão ao vivo), com fallback só quando a chave não existir. Confirmar no motor que os dois campos vêm separados (docs/game-src/motor.js:383/397/407 — `l.drops` e `l.dropsAp`).
- **Aceitacao**: teste em tools/testes/ a passar: `planejar` com campeão **AP** continua a devolver o Covil do Barão para o `3089` e com campeão **AD** **não** o devolve (devolve a zona da tabela normal, ex. Gume do Infinito `3031`); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-04 | P1 | `3031` Gume do Infinito não tem guarda de "intocável" (o Rabadon tem)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:216 e 294 e 399 — *"Hoje o Rabadon é intocável por uma guarda própria (`RABADON = '3089'`); o Gume do Infinito não tem guarda equivalente"*; **ACTUALIZADO pelo lote 3** (parte-02.md:1357-1358): a guarda já existe no motor como `PRIORIDADE_EXTREMA` (`automation.js:26-58`, com 3031 em 48 e 3089 em 49, ligada em 300/306/424/2029/2572/3441/4279) e foi medida a proteger `3031~C`x2 e `3089~C`x2 em Yasuo (AD), Lux (AP) e Zac. Regra do dono: *"mesmo duplicados, é o jogador que decide com eles"*
- **Fazer**: (a) confirmar ao vivo (com marcador) que a guarda cobre duplicados e que a cobertura é por classe sem excepções; (b) a lacuna real que ficou é a GUI — ver **TK-02-26**; (c) se a lista de prioridade extrema tiver de crescer (outros itens que o dono nomear), acrescentar na mesma tabela `automation.js:26-58`.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com asserção nova (duplicado de `3031` e de `3089` em campeão da outra classe **não** é vendido/limpo; duplicado de item comum continua a sê-lo).
- **Estado**: pendente

### TK-02-05 | P1 | 13 passivas de estado continuam sem regra própria com contexto de combate
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:226 (objectivo, ponto 2) — *"13 passivas de estado (Stasis, Renascimento, Eco, Furia do Vento, Geada, Rammus...): precisam de regra propria com contexto de combate. Se exigirem pesos inventados, pedir a regra ao dono em vez de inventar."*
- **Fazer**: para cada uma das 13, ler a mecânica em docs/game-src/motor.js (REGRA Nº 1: bloco inteiro, valor + lista de campos) e implementar regra própria activada pelo contexto de combate (mob/chefe/fase). Se alguma exigir peso que não existe no jogo, **não inventar**: deixar lista nomeada no relatório para o dono.
- **Aceitacao**: cada passiva com `file:linha` do motor no comentário do código; `bun tools/testes/run.mjs` rc=0; nenhuma constante "inventada" sem origem no motor.
- **Evidencia extra (RESUMO DE COMPACTAÇÃO #3, parte-02.md:3396)**: passivas já modeladas 37 de 50 (74%); as **13 restantes** são exactamente as de estado/combate: `3057 3116 3085 6655 3742 3102 3083 6610 3026 3157 6333 3078 3072`.
- **Estado**: pendente

### TK-02-06 | P1 | `refinarMelhores` ainda prefere o medido (`n>=3`) ao teórico (muleta)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:231 (objectivo, ponto 6) — *"Tirar a ultima muleta: refinarMelhores ainda prefere o medido (n>=3) ao teorico."*
- **Fazer**: inverter a preferência para o teórico lido do motor, com o medido apenas como desempate/validação; garantir que a fonte é o motor (não uma cópia congelada).
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com asserção nova a cobrir o empate teórico>medido; diff do comportamento antigo nomeado no relatório.
- **Estado**: pendente

### TK-02-07 | P1 | Lendário único da classe tem de ser guardado — critério ainda não é a classe
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:401 e 567 — *"Lendário único da classe → guardar, com o critério a ser a classe"*
- **Fazer**: implementar a guarda de "lendário único da classe do campeão" (usar a classe lida do jogo, não uma tabela fixa), de modo a não vender a única peça lendária que a build da classe pode usar.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com caso "lendário único da classe e duplicado de lendário de outra classe" a dar resultados diferentes.
- **Estado**: pendente

### TK-02-08 | P1 | `backtest.mjs` ainda lê o `yasuo.json` antigo; o ciclo do dado fresco não fecha
- **Ficheiro(s)**: tools/backtest.mjs, tools/snap-export.mjs, docs/snapshots/
- **Evidencia**: parte-02.md:681-686 — *"O backtest (tools/backtest.mjs) ainda lê docs/snapshots/yasuo.json — o ficheiro antigo de 169 KB que não regenerei … Falta gerar o yasuo.json no formato que o backtest espera … ou adaptar o backtest para ler os ficheiros novos."*
- **Fazer**: (a) o backtest passou a correr com o dado fresco exportado de `getFarm().cycles` (medido em parte-02.md:1160-1168: `fonte: docs/snapshots/katarina.json · ciclos: 30 de 30 · Fosso do Dragão 3798,1 ouro/min n=29 IC95 [3498,6 .. 4097,5] · Rio 2553,4 n=1 insuficiente · GLOBAL 3756,6 ouro/min`); (b) falta a comparação **entre builds**: `builds: 1 assinatura distinta` nos 30 ciclos (parte-02.md:1180-1183) — ligar a **TK-02-23** (persistir assinatura de build por ciclo) para a amostra acumular sozinha.
- **Aceitacao**: `node tools/backtest.mjs` corre com o snapshot fresco e imprime, por build, ouro/xp por minuto com IC95 e n; dizer no relatório qual comparação já responde e qual continua sem amostra.
- **Estado**: pendente

### TK-02-09 | P1 | `inject.js` congela a CURVA à mão (números copiados, não lidos)
- **Ficheiro(s)**: extension/inject.js
- **Evidencia**: AGENTS.md REGRA Nº 3 — `inject.js:133 meta.curva = { hp: [150,100,1], ... }`, `inject.js:138 meta.grupoSpawn = { base: 2, rand: 3 }`, `inject.js:139 meta.respawn = { clear: 1.5, local: 1.2 }` — *"cópia à mão, congelada"*; AGENTS.md: *"a região do Barão foi buffada, o script não soube, e o dono morreu"*
- **Fazer**: avaliar a `CURVA` do jogo por nível dentro do mundo MAIN e mandar os números por `postMessage`, em vez de os copiar; manter as chaves actuais como fallback só quando a avaliação falhar, com motivo no log.
- **Aceitacao**: teste/Hook a mostrar que um buff na CURVA aparece no `meta` sem mexer no código (duas execuções com curvas diferentes dão `meta.curva` diferentes); `bun tools/testes/run.mjs` rc=0.
- **Evidencia extra (medido ao vivo, parte-02.md:2642 e 2670)**: `curvaHp: [150, 100, 1]` — **exactamente o fallback escrito à mão**, confirmado como o valor que o motor está a usar; correcção pedida em parte-02.md:2685-2693 (`meta.curvaPorNivel = { 29: {hp: CURVA.hp(29), ...} }`, mais ler `grupoSpawn` e `respawn`, que também estão inline no motor)
- **Estado**: pendente

### TK-02-10 | P2 | GUI sem secções de farm (auto farm sozinho vs auto farm por item, com escolha dos itens)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:178 — *"quero auto farm sozinho, auto farm pra item onde escolho todos os itens que quero dropar"*; distribuido em parte-02.md:208
- **Fazer**: duas secções de farm na GUI — "auto farm sozinho" e "auto farm por item" com multi-selecção de itens — ligadas ao `planejar(ids)` (depois de TK-02-03, para não prometer regiões que não dropam).
- **Aceitacao**: render sem erro no smoke test da GUI e secções minimizáveis; seleccionar um item mostra a região/drops-hora coerentes com a classe do campeão ao vivo.
- **Estado**: pendente

### TK-02-11 | P2 | Bloco "Build por fase" no topo da GUI não minimiza em aba nenhuma
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:8 e 617 — *"o bloco do topo (`ap-build-fase`, 5 referências) está lá — é o mesmo de que o dono se queixou"*; encaminhado ao `0066c422` em parte-02.md:627
- **Fazer**: tornar o bloco minimizável e/ou movê-lo para dentro do sistema de abas (merge de abas por assunto), sem o deixar fora do contentor.
- **Aceitacao**: marcador discriminante na GUI (id/classe do bloco novo) + interacção real a minimizar; GUI só desenha a aba activa — clicar na aba antes de verificar (REGRA Nº 4).
- **Estado**: pendente

### TK-02-12 | P2 | Cofre na Fonte: `#npcs` pode não refrescar e `COFRE_TILES_ACIMA` pode ser 2 em vez de 5
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:88, 126, 157-161, 175 — *"no fonte do jogo NADA escreve em #npcs (a lista parece ser renderizada no servidor; o cliente só a esconde, jogo.js:6513)"*; Tesoureira em `mundo.js:19-21` (`NPCS_FONTE`) em `(CX-1, CY-5)` = 5 tiles acima; o código sobe 2 (+2 = 4)
- **Fazer**: (a) se `#npcs` não refrescar, passar a clicar na Tesoureira no canvas (`jogo.js:401-406` → `cena.clicar` → `falarCom`) usando a conversão tile→ecrã já escrita; (b) acertar `COFRE_TILES_ACIMA` (5) ou provar ao vivo quantos cliques chegam. Manter o motivo verdadeiro no log quando falhar.
- **Aceitacao**: log do cofre com `cofreItens > 0` e sem o motivo "a Tesoureira nao apareceu em #npcs"; se falhar ao vivo, motivo verdadeiro nomeado (nunca mensagem genérica). Prova ao vivo exige marcador discriminante após `lolidle:reload` + reload.
- **Estado**: pendente

### TK-02-13 | P2 | Falta build ideal por campeão + lista de itens de prioridade extrema por classe
- **Ficheiro(s)**: docs/ (novos ficheiros) + extension/automation.js se os dados passarem a ser lidos
- **Evidencia**: parte-02.md:178 — *"todos os bonecos tem que saber a build ideal deles, e quais itens sao de extrema prioridade e que nao devem ser tocados pelas nossas regras de auto clean"*; parte-02.md:290-294
- **Fazer**: documento por campeão (build ideal, itens intocáveis, fonte da tabela de drops `DROPS` vs `DROPS_AP` pela classe) com `file:linha` do motor; a extensão lê a lista do jogo em vez de a ter copiada (REGRA Nº 3).
- **Aceitacao**: cada item do documento com `file:linha`; nenhum número copiado para extension/ sem leitura; `bun tools/testes/run.mjs` rc=0 se mexer no motor.
- **Estado**: pendente

### TK-02-14 | P2 | Extensão re-estima ouro/xp/abates em vez de ler a análise que o jogo já publica
- **Ficheiro(s)**: extension/automation.js, extension/gui.js
- **Evidencia**: AGENTS.md REGRA Nº 7 — jogo já mede em `jogo.js:523` (`analise`), `525-537` (`contarAnalise`), `538-542` (`contasAnalise`), render em `#janela-analise` (`546-560`) e `#rastreio-analise` sempre visível (`6250-6255`); a extensão re-estima em `automation.js:1195-1204` (`kXp`/`kOuro`) e não lê nenhum dos dois
- **Fazer**: ler `#janela-analise`/`#rastreio-analise` (ou a função `analise`) como fonte primária e usar `kXp`/`kOuro` só como fallback; mostrar na GUI o número do jogo, não o estimado.
- **Aceitacao**: número igual ao do `#rastreio-analise` ao vivo, provado por marcador discriminante; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-15 | P3 | `docs/build-mob-chefe.md` nunca foi escrito
- **Ficheiro(s)**: docs/build-mob-chefe.md
- **Evidencia**: parte-02.md:582 e 629 — *"docs/build-mob-chefe.md: AINDA NAO ESCREVI"*; o agente principal recusou autorizar o autor a fechar o relatório enquanto o código ia mudar (parte-02.md:627-629)
- **Fazer**: escrever o documento **depois** de o bloco da GUI e o motor estabilizarem (senão nasce velho), descrevendo `buildParaMob`/`buildParaChefe`, `faseAtual()`, peças reservadas e as quatro fontes de itens, com `file:linha`.
- **Aceitacao**: ficheiro existe, cada afirmação tem `file:linha`, e nenhuma linha descreve comportamento que o código já não tem.
- **Estado**: pendente

## DECISÕES DO DONO (não são tickets de worker)
- **Fuga de chefe fatal passa para `manutencao`?** Hoje, na Katarina, o motor **não foge** de um chefe que a mata porque a fuga está no ramo do auto-play (parte-02.md:1651, 531-533, 569, 639). O dono tem de dizer sim ou não — é uma acção no jogo dele.
- **Preço sem comparável**: 1,5M configurável, mas o dono tem de escolher **1,5M ou 2M** (parte-02.md:400, 438, 566).
- **Destino de item quando o mercado está cheio / lendário duplicado** (AGENTS.md REGRA Nº 2) — política, não dado do jogo.

---

## Lote 2 — âncora `parte-02-lote-2` (leitura até parte-02.md:1080)

### TK-02-16 | P1 | GUI do chefe mostra `perMin` (taxa) em vez de `perKill` — artefacto de denominador
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:860-877 — `bossFase: { durMs: 35616, gold: 1526, xp: 3654, kills: 1, perMin: {...}, perKill: {...} }`; *"O motor já tem o dado certo — perKill existe na estrutura. É a tabela que mostra perMin, que para uma janela de um só chefe é enganador"*; encaminhado como `3c578d07` em parte-02.md:1002
- **Fazer**: na tabela/aba do chefe, mostrar **loot por abate** (ouro e xp `perKill`) e o **tempo do chefe** ao lado como custo; deixar de mostrar `perMin` como número de decisão (ou mostrá-lo só como rótulo secundário).
- **Aceitacao**: ao vivo, números iguais a `bossFase.perKill` do motor (prova: ler `getFarm().cycles[].bossFase.perKill` e comparar com a célula da GUI); marcador discriminante no id/célula nova.
- **Estado**: pendente

### TK-02-17 | P1 | Erro visível ao dono: "Não foi possível calcular o plano da mochila (o motor não respondeu)"
- **Ficheiro(s)**: extension/gui.js (e extension/automation.js só se o `planBag` precisar de assinatura nova)
- **Evidencia**: parte-02.md:1007-1012 — texto exacto do erro na GUI; *"suspeito que a GUI chame o `planBag` sem lhe passar a mochila"*
- **Fazer**: corrigir a chamada — `planBag(A.scanBag(true))` em vez de `planBag()` sem argumentos (medido em parte-02.md:1086-1090 e 1123-1126: `planBag()` → LANCOU "Cannot read properties of undefined (reading 'items')"; `planBag(scanBag(true))` → ok, 12 acções), com estado vazio honesto se a leitura falhar; **nunca apresentar um erro nosso como falha do motor** (parte-02.md:1130).
- **Aceitacao**: bloco "O que vai acontecer a cada item" mostra o plano com itens reais (sem a mensagem "o motor não respondeu"), provado ao vivo com marcador discriminante; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-18 | P1 | `barraIdeal` devolve o MESMO conjunto para mobs e chefe (preferência multi-alvo não discrimina)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:923 e 980-987 — `ideal mobs: [R, Q, A, W]` / `ideal chefe: [R, Q, A, W]` ← IDÊNTICOS; *"a preferência por multi-alvo não está a discriminar"*; kit da Katarina tem `alvos: 3` só no Q e no R
- **Fazer**: diagnosticar porque a fase não muda o conjunto (a fase tem de afectar os pesos das skills, não só a ordem) e fazê-lo discriminando de facto — **sem inventar pesos**: os pesos vêm do motor (`file:linha`) ou vão para decisão do dono.
- **Aceitacao**: para um campeão com kit de áreas (Lux/Yasuo/Darius) as barras mob vs chefe diferem no banco (prova já existente: Yasuo troca `3085`→`3036`); para a Katarina, se as barras legítimamente coincidem, dizer isso no relatório com `file:linha` em vez de forçar troca.
- **Estado**: pendente

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
- **Estado**: pendente

### TK-02-21 | P2 | Abas da GUI vazias (ex.: painel de controle)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:1080 — *"e tem abas da gui que tao vazias. tipo o painel de controle."*; **medido depois** (parte-02.md:1098-1117): o merge das abas aterrou — `abas: Painel | Itens | Personagem | Ganhos` (8 → 4 ✓) — mas o conteúdo não foi escrito: `ap-t-painel: 142 caracteres` (praticamente vazio); visíveis: `ap-fase(69) · ap-tabs(33) · ap-fb(57) · ap-hint(50)`
- **Fazer**: escrever o conteúdo do painel de controlo (estado + botão principal, números do momento, árvore de interruptores, "o que está a acontecer agora") — a especificação detalhada dos switches está em **TK-02-28**.
- **Aceitacao**: nenhuma aba devolve vazio ao ser clicada (a GUI só desenha a aba activa — clicar na aba antes de verificar, REGRA Nº 4); marcador discriminante no conteúdo novo.
- **Estado**: pendente

### TK-02-22 | P2 | Snapshot exportado do motor ao vivo usa o campo errado (`getRunLog` em vez de `getFarm().cycles`)
- **Ficheiro(s)**: tools/snap-export.mjs
- **Evidencia**: parte-02.md:773-830 — `getRunLog()` dá 200 ciclos de poção (`at·boss·build·erroPot·estHealS...`); `getFarm().cycles` tem **30 ciclos** com `region · startedAt · fase · mobFase · bossFase · gold · xp · boss · setup · fim · durMs` e `mobFase.perMin` já calculado — *"O dado sempre existiu — eu é que exportei o campo errado"*
- **Fazer**: exportar/derivar de `getFarm().cycles` e verificar se guarda histórico ou só o corrente; se só o corrente, persistir a cada mudança de região/fase (ver TK-02-23).
- **Aceitacao**: ficheiro em docs/snapshots/ com ciclos de farm reais (região + ouro/xp por minuto) e comparação com `getFarm().cycles` ao vivo a bater certo.
- **Estado**: pendente

### TK-02-23 | P2 | Ciclos de farm não são persistidos — a pergunta "a build nova é melhor?" nunca terá resposta
- **Ficheiro(s)**: extension/automation.js (persistência) e/ou tools/snap-export.mjs
- **Evidencia**: parte-02.md:795-806 — *"Se só guardar o corrente, não há como reconstruir 30 ciclos passados: o histórico teria de passar a ser persistido a partir de agora"*; *"os ciclos que a respondem não estão a ser guardados. Isso é um defeito de desenho, não falta de dados."*
- **Fazer**: persistir um registo de ciclo de farm (região, fase, setup/equip, ouro, xp, duração) a cada mudança de região/fase, com limite de tamanho, para que o backtest tenha amostra.
- **Aceitacao**: depois de N mudanças de região, o registo tem N entradas novas e o backtest consegue correr com elas; prova pelo ficheiro/estado persistido, não por memória.
- **Estado**: pendente

---

## Lote 3 — âncora `parte-02-lote-3` (leitura até parte-02.md:1400)

### TK-02-24 | P0 | Passivas dos itens não contam na build (só campos estruturados) — dono reclamou “dezenas de vezes”
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1266 — *“tu sabia q os itens tem passivas, que só a passiva da bota de cdr, e só a passiva do impeto, os dois somam 30? ... eu ja falei sobre levar em conta passiva de itens algumas dezenas de vezes. arruma. tudo. pra todos os bonecos. pra todos os itens. agora”*; campo e passiva lado a lado em parte-02.md:1400 — `3171 Lucidez Escarlate : cdr: 0.15   efeito: "Lucidez: −15% na recarga das habilidades."`; matemática do dono em parte-02.md:1040-1066 (30% dos dois itens vs tecto de 40% de `motor.js:529` e `:537`)
- **Fazer**: fazer a avaliação de build somar **campo + passiva** para todos os itens e todos os campeões — a passiva textual tem de entrar no mesmo cômputo de CDR/pen/AP, não só o campo estruturado. Confirmar cada número em `docs/game-src/motor.js` antes de codar (REGRA Nº 1); o dono classificou isto como pendência antiga, tratar como P0.
- **Aceitacao**: caso de teste com `3171` (Lucidez) + `4629` (Ímpeto Cósmico) a dar **30% de CDR** somados (15+15), abaixo do tecto de 40%, sem desperdício; `bun tools/testes/run.mjs` rc=0. Prova ao vivo com marcador discriminante (texto que só existe na build nova).
- **Estado**: pendente

### TK-02-25 | P1 | `buildIdealPara(c)` devolve build diferente conforme o campeão actual (`valorPassiva` lê `META.champAtual`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1364 e 1390 — *“`valorPassiva` le `META.champAtual` (`automation.js:3762-3763`) em vez do `c` recebido -> `buildIdealPara(lux)` devolve 3171,3089,4629,3100,4633 com champAtual=yasuo e 3171,3089,3135,3100,6653 com champAtual=lux”*
- **Fazer**: passar o campeão recebido a `valorPassiva`/`perfilCampeao`, para a build ser função só do campeão pedido; a identidade do HUD (`automation.js:1138-1173`, `inject.js:147`) serve só para saber *qual* campeão está em campo.
- **Aceitacao**: teste a chamar `buildIdealPara` com campeões diferentes e a provar que nenhum resultado depende do campeão “actual”; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-26 | P1 | GUI não conhece a `PRIORIDADE_EXTREMA` — painel “Blindados” esconde o `3031`
- **Ficheiro(s)**: extension/gui.js (+ expor a tabela em extension/automation.js)
- **Evidencia**: parte-02.md:1358-1359 — *“Grep em `gui.js`: **0 referencias** a PRIORIDADE_EXTREMA. `gui.js:1521-1531` (`protegidos()`, cartao “Blindados” em `gui.js:1555-1557`) so tem RABADON (`gui.js:1523`, `gui.js:48`) + lendarios da build da classe ... num campeao AP o motor protege o 3031 mas o painel nao o mostra”*; a tabela já existe no motor em `automation.js:26-58` (3031 em 48, 3089 em 49), ligada em 300, 306, 424, 2029, 2572, 3441, 4279
- **Fazer**: expor `PRIORIDADE_EXTREMA` em `window.__lolidleAuto` (junto de `automation.js:5978`) e consumir em `gui.js:1521`, para o cartão “Blindados” mostrar todos os protegidos com o mesmo critério do motor.
- **Aceitacao**: ao vivo, num campeão AP o painel mostra o `3031` marcado como protegido, igual ao que o motor faz; marcador discriminante no cartão; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-27 | P2 | Critério do filtro de básicos não está automatizado (nem o clique com `change`)
- **Ficheiro(s)**: extension/automation.js, extension/gui.js
- **Evidencia**: parte-02.md:1298-1305 — *“`#ignorar-basicos` ... arranca desligado ... AÇÃO PRÁTICA PARA A AUTOMAÇÃO: clicar tem de **disparar `change`** (o unico writer e o listener de jogo.js:5883). Escrever `.checked = true` NAO atualiza `estado.ignorarBasicos`”*; critério em parte-02.md:1302-1303 — *“B = folhas das receitas que ainda vais montar; B=0 → clicar. No plano comprar pronto (regra do dono, automation.js:404-408) B=0 desde o abate 1 → clicar já”*
- **Fazer**: implementar o clique em `#ignorar-basicos` quando o critério B (folhas de receita ainda necessárias) der 0, disparando `change` e nunca escrevendo `.checked`; verificar por `document.querySelector("#ignorar-basicos").checked`.
- **Aceitacao**: no banco, um caso com B=0 clica e o estado passa a ligado (evento `change` registado no dom-stub) e um caso com B>0 não clica; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-28 | P1 | Painel de controlo sem switches (mestre “Tudo” + filhos independentes + indicador vermelho/verde)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:1206 — *“painel de controle tem q ter switch de cada coisa que consegue fazer sozinho pelo jogador. o switch primeiro é chamado de tudo (auto play), e o resto dos switches sao dentro desse auto play, mas ativar um deles nao ativa o auto play ... pra cada switch ativado, tem q ter uma checkbox q nao e box, e texto vermelho ou verde dizendo oq cada coisa cobre/e oq vai acontecer e oq deixa de acontecer com um switch desativado”*; spec encaminhada em `0b09e91d` (parte-02.md:1212-1219), com os 15 interruptores lidos de `arvoreInterruptores()`
- **Fazer**: gerar os switches a partir da árvore real do motor (`arvoreInterruptores()` — nunca escrita à mão); mestre “Tudo (auto-play)” no topo; filhos que não ligam o mestre; distinguir *“o dono desligou”* de *“está bloqueado pelo pai”* usando o `porque` do `podeFazer`; indicador de texto **verde** (o que cobre, ligado) e **vermelho** (o que deixa de acontecer, desligado), escrito como efeito no jogo e não como nome técnico.
- **Aceitacao**: os switches renderizados vêm da árvore (prova: mudar a árvore muda o número de switches); ligar um filho não liga o mestre (medido por `podeFazer` ao vivo); cada switch tem a linha verde/vermelha; marcador discriminante no painel novo.
- **Estado**: pendente

### TK-02-29 | P2 | Perfil `suporte` é inalcançável (`perfilDe` nunca o devolve) — Taric cai em tanque
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1363 — *“o perfil `suporte` de `automation.js:3523` e INALCANCAVEL (`perfilDe` `3508-3517` nunca o devolve; o Taric, “Suporte” no roster `campeoes.js:32`, cai em tanque)”*
- **Fazer**: decidir com fonte no jogo (`docs/game-src/campeoes.js`) o que caracteriza suporte e fazer `perfilDe` devolvê-lo, ou documentar porque não existe. Não inventar pesos sem `file:linha`.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com caso novo a cobrir o perfil do Taric, e o resultado nomeado no relatório.
- **Estado**: pendente

### TK-02-30 | P2 | Documentos entregues com marcas NAO VERIFICADO por falta de dados do jogo no repo
- **Ficheiro(s)**: docs/game-src/ (adicionar o que falta) e docs/drops-e-prioridades.md, docs/yasuo-build.md, docs/filtro-basicos.md
- **Evidencia**: parte-02.md:1307-1308 e 1369 — *“NAO VERIFICADO: dados-yasuo.js ausente (hp/armadura/RM/AS por nível); texto visível do checkbox e painel onde vive; se o servidor persiste `ignorarBasicos`; preços do mercado de jogadores”*; *“o motor do jogo não é importável aqui (faltam `docs/game-src/dados-ezreal.js` & cia, `motor.js:3-8`, e `i18n/en.js`)”*
- **Fazer**: trazer para `docs/game-src/` os ficheiros de dados que faltam (dados-<campeao>.js, i18n) a partir do fonte do jogo, para que o motor seja importável e as marcas NAO VERIFICADO possam ser verificadas; as que ficarem impossíveis no repo ficam explicitamente marcadas.
- **Aceitacao**: `docs/game-src/` passa a conter os ficheiros referenciados por `motor.js:3-8`; cada marca NAO VERIFICADO passa a verificada com `file:linha` ou fica marcada como impossível no repo.
- **Evidencia extra (parte-02.md:4583 e 4696)**: `dados-yasuo.js`/`dados-katarina.js` não existem (`motor.js:4,6`) → hp/hpperlevel/armor/AS foram **CALIBRADOS** contra os snapshots (Yasuo fecha 6 setups com erro ≤1,2; Katarina erra ≤4,8% AD / ≤4,0% AP) e marcados NAO VERIFICADO.
- **Estado**: pendente

---

## Lote 4 — âncora `parte-02-lote-4` (leitura até parte-02.md:1720)

### TK-02-31 | P0 | Contagem dupla: o CDR do campo é somado outra vez pela regex da passiva (`vp3171: 90`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1404-1414 — *“Se o scoring soma `it.cdr` **e** o `valorPassiva` também lê "−15% na recarga", isso é contagem dupla — e a regex do CDR foi adicionada por mim hoje”*; medido em parte-02.md:1410-1412 e 1683-1684: `3171 cdr=0.15 → valorPassiva = 90` e `4629 cdr=0.15 → valorPassiva = 90` (ainda **não** corrigido na última verificação); campo/passiva em parte-02.md:1400-1401
- **Fazer**: correcção sistemática, não remendo: `valorPassiva` só pode modelar o que **não está** em campo estruturado; auditar uma a uma todas as regex acrescentadas contra os campos dos itens; e uma **guarda** que percorre os 108 itens e falha se voltar a haver duplicação (parte-02.md:1430).
- **Aceitacao**: a guarda corre no banco e falha se algum item tiver campo e passiva a serem somados duas vezes; `vp3171` e `vp4629` deixam de valer 90 (medir o valor novo e justificá-lo); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-32 | P0 | `objetivoItem="rabadon"` força item AP na build AD do Yasuo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1686-1692 — `buildIdealPara({magia:false}) → "3172,3089,3046,6631,3031"` com a nota `↑ 3089 = RABADON (AP) numa build AD!`; *“o pin ignora a classe por desenho … agora que vás construir o Yasuo, ele contamina a build dele com um item AP”*; correcção encaminhada em `93b535a6` (parte-02.md:1710-1719): classe oposta → não entra (salvo flag explícita `objetivoItemForcar`), mesma classe → continua a entrar
- **Fazer**: fazer o alvo fixo respeitar a classe do campeão, usando a função de classe que já existe (não inventar critério novo).
- **Aceitacao**: prova obrigatória com as duas listas — `buildIdealPara` de campeão AD **sem** itens AP e de campeão AP **com** o Rabadon; testes com controlo (classe oposta não entra, mesma classe continua a entrar); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-33 | P0 | Fuga: hoje não foge de mob que mata e está no ramo do auto-play (dono: “NÃO É PRA MORRER, NUNCA”)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1618 — *“1,5. e é pra fugir de qualquer coisa que mata, pra qualquer boneco, em qualquer situacao … ARRUMA ESSA PORRA de fugir de chefe que mata, por que NAO É PRA MORRER, NUNCA, COM ESSE SCRIPT”*; e parte-02.md:1660-1668 — *“A fuga passa para `manutencao` … interruptor próprio `fugir` (default ligado) … hoje a função sai cedo com `if (!c || !c.boss) return;`, logo morrer para um mob não conta. Isso sai … Mantém-se a tua regra: se as poções cobrem a luta, não foge — termina o chefe”*
- **Fazer**: mover a fuga para o ramo `manutencao` (sobrevivência, não farmar), criar interruptor próprio `fugir` ligado por defeito, remover o `if (!c || !c.boss) return;` para fugir de **qualquer coisa que mata** (mob incluído), em qualquer campeão e qualquer situação, mantendo a excepção do dono (se as poções cobrem a luta, termina o chefe).
- **Aceitacao**: ao vivo, na Katarina com o auto-play desligado, o motor foge de um mob/chefe que a mata (marcador discriminante no log); com `fugir` desligado, não foge; `bun tools/testes/run.mjs` rc=0 com casos novos (mob que mata foge; luta coberta por poções não foge).
- **Estado**: pendente

### TK-02-34 | P1 | Auditoria dos hardcodes da matemática de builds (necessário / derivável / heurística minha)
- **Ficheiro(s)**: docs/ (relatório da auditoria) + extension/automation.js para os que forem deriváveis
- **Evidencia**: parte-02.md:1531 — *“quantos hardcodes tu tem na matematica das builds e oq equipar de itens? por que era pra tu ter hardcode só doq tem q ser hardcode … como levar em conta passivas (que nem sei se é hardcode mesmo. pq é matematica do proprio jogo)”*; classificação pedida em parte-02.md:1586-1591 — (a) NECESSÁRIO, (b) DERIVÁVEL — devia sair do `motor.js` e `itens.js`, (c) HEURÍSTICA MINHA; lista actual em parte-02.md:1557-1562 — `pesosItem(perfil)`, `PESO_FASE`, `valorPassiva` (regex + multiplicadores à mão), `ITENS_ESPECIAIS` e `CAMPOS_MULT` (ids à mão), `PRIORIDADE_EXTREMA` (3031+3089 à mão), multiplicador de raridade próprio
- **Fazer**: inventariar **todos** os hardcodes com contagem total e classificação (a)/(b)/(c); para cada derivável, dizer **de onde** sairia o valor (`file:linha` do jogo) e implementar a leitura; os que forem (c) e precisarem de peso inventado, listar para o dono em vez de os inventar.
- **Aceitacao**: relatório com o número total e as três contagens; nenhum item da classe (c) continua no código sem decisão do dono; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-35 | P1 | Lich Bane / procs de passiva com multiplicador fixo (× 2,2) em vez da frequência de skills do campeão
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1564 e 1602 — *“O × 2,2 do Lich **é exactamente o teu ponto**: esse número deveria sair da frequência de skills do campeão … Está fixo em 2,2 para qualquer AP”*; *“o × 2,2 do Lich é heurística minha, não matemática do jogo … uma Katarina que usa skill a cada 2 s proca o Lich muito mais que um mago lento, e o número fixo trata os dois igual”*; as recargas das skills estão em `docs/game-src/motor.js` (parte-02.md:1597)
- **Fazer**: derivar o multiplicador de proc da **frequência de skills do campeão** lida do jogo (recargas no motor), em vez do 2,2 fixo; responder com número se o Lich entra na build da Katarina e na de um mago lento.
- **Aceitacao**: dois campeões com frequências de skill diferentes dão multiplicadores diferentes no banco; o valor de cada multiplicador tem `file:linha` nas recargas do motor; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-36 | P1 | Cópia do jogo em `docs/game-src/` pode estar desactualizada (regra dos “4 níveis” do chefe não existe lá)
- **Ficheiro(s)**: docs/game-src/ (re-exportar) — sem escrever em extension/
- **Evidencia**: parte-02.md:1618 — *“é pra levar em conta a nova atualizacao do jogo sobre chefes serem no maximo 4 leveis acima de voce … nao sei o limite disso e nao sei as condicoes”*; e parte-02.md:1643-1654 e 1670-1678 — a única regra encontrada é `motor.js:1121  Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador))` (Baron 40–50 com boneco nível 1 → chefe 42); *“a regra dos 4 níveis acima não aparece em lado nenhum … a cópia do jogo que temos pode estar desactualizada. Não vou inventar o limite; fica registado como lacuna a re-exportar.”*
- **Fazer**: re-exportar `docs/game-src/` a partir do jogo actual e procurar a regra dos 4 níveis (limite e condições); se existir, modelá-la com `file:linha`; se não existir no código, dizer que é regra do servidor e registar a lacuna.
- **RESOLVIDO no histórico (parte-02.md:4587 e 4644-4651, 4695)**: a regra existe e é `motor.js:1121  nivelChefe = max(n0+2, min(n1+2, pj+4))` com `nm=[40,48]` (`motor.js:371`) → Barão em `max(42, min(50, pj+4))`. O `4` de `NIVEL_DIF` (`motor.js:1184`) é outra coisa: é a faixa de tolerância (`motor.js:1185-1187`). A modelação da tolerância ficou em **TK-02-83**. Resta confirmar a idade da cópia de `docs/game-src/` (hash/data de exportação).
- **Aceitacao**: `docs/game-src/` com data/hash de exportação no relatório; a regra dos 4 níveis encontrada com `file:linha` ou declarada como não existente no código — nunca inventada.
- **Estado**: pendente

### TK-02-37 | P2 | Preço sem comparável (decisão do dono = 1,5M) não está implementado
- **Ficheiro(s)**: extension/automation.js, extension/gui.js
- **Evidencia**: parte-02.md:1618 — dono respondeu *“1,5.”* à pergunta “preço sem comparável (1,5M ou 2M)”; pedido original em parte-02.md:400 e 438 (“1,5M configurável”); registado em parte-02.md:1668 (*“Preço sem comparável = 1,5M, configurável”*)
- **Fazer**: implementar o preço de fallback para item sem comparável, com **1,5M** por defeito e configurável na GUI (constante lida de config, não número espalhado).
- **Aceitacao**: item sem comparável recebe exactamente 1,5M por defeito e o valor muda quando a config muda (provado no banco e na GUI); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-38 | P2 | Verificar ao vivo a distribuição de atributos e o refino dos essenciais tier A (item 5 do objectivo)
- **Ficheiro(s)**: extension/automation.js (se a distribuição/refino estiverem errados) — leitura da mecânica em docs/game-src/motor.js
- **Evidencia**: parte-02.md:230 (objectivo, ponto 5) — *“Verificar ao vivo a distribuicao de atributos e o refino dos essenciais tier A”*; ainda por verificar em parte-02.md:1525 (*“5 | atributos e refino ao vivo | por verificar”*); retomado em parte-02.md:4004 (*“Vou usar a ronda no item #5 do objectivo, que ainda não verifiquei: atributos e refino”*) e ainda por verificar em parte-02.md:3889 (*“5 | atributos/refino ao vivo | por verificar”*)
- **Fazer**: medir ao vivo quantos pontos de atributo e de skill são gastos por nível e comparar com o que o motor do jogo permite; verificar o refino dos essenciais tier A (quando refinar, com que materiais, em que condições) e corrigir a extensão se divergir. Nada de palpite: número com `file:linha`.
- **Aceitacao**: medição ao vivo com marcador discriminante mostra 0 pontos por gastar e o refino a acontecer nas condições certas; ou o desvio está nomeado com `file:linha` e corrigido. `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

---

## Lote 5 — âncora `parte-02-lote-5` (leitura até parte-02.md:2050)

### TK-02-39 | P0 | Filtro de morte em `regiaoIdeal` é no-op: região sem `morte` passa como segura (dono MORREU no Barão)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1977-1988 e 2003-2008 — `estimarRegiao(barao) → { goldMin: 5428, xpMin: 15765 }` **sem** `morte` e sem `dps`; `.filter((x) => x.e && !x.e.morte)` — se `morte` não vem, `!undefined === true` e a região passa como segura; `aggBarao: []` (zero dados medidos); medido em parte-02.md:2015: `rankRegioes() → Covil do Barão 15765 (#1) > Fosso do Dragão 13641`, com o boneco a nível 29 (parte-02.md:1898-1906)
- **Fazer**: 1) `estimarRegiao` passa a devolver o risco (`morte`, dps tomado) para **todas** as regiões, usando a avaliação de luta que já existe e os stats dos monstros do META; 2) o filtro passa a **fail-closed**: `morte` ausente = **NÃO segura**; 3) o ranking não pode apresentar taxa teórica de região onde o boneco morre.
- **Aceitacao**: com o boneco a nível 29, `estimarRegiao(barao).morte === true` e o Barão **sai do #1** do ranking (prova pedida em parte-02.md:2032); região sem dados dá `morte: true` (fail-closed), nunca `undefined`; `bun tools/testes/run.mjs` rc=0 com caso novo.
- **Estado**: pendente

### TK-02-40 | P0 | “Voltar para onde estava” (`_regiaoAntesDaBase`) não valida segurança nem tem gate de `cfg.enabled` — manda-a de volta ao Barão
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1956-1963 — `const reg = _regiaoAntesDaBase || regiaoIdeal(); if (reg) { logEvent(base, { voltarPara: reg, ... }); viajarPara(reg); }` (linha ~5731); *“A lógica ‘voltar para onde estava’ … não valida a segurança da região. Se ela passou pelo Covil do Barão, _regiaoAntesDaBase = barao e a rotina da base manda-a de volta para lá. E essa linha não tem gate de cfg.enabled, logo corre com a manutenção ligada”*; confirmado em parte-02.md:2037 (*“O meu: a regra ‘voltar para onde estava’ … sem validação de segurança e sem gate de cfg.enabled”*)
- **Fazer**: validar a região de retorno pelo mesmo critério de segurança (fail-closed, ver TK-02-39) antes de `viajarPara`, e respeitar a hierarquia de interruptores em vez de perguntar directamente a `cfg.enabled` (o padrão que já apareceu 3 vezes — parte-02.md:489-491).
- **Aceitacao**: no banco, um caso com `_regiaoAntesDaBase` = região insegura **não** viaja (e diz porque); um caso com região segura viaja; auto-play desligado não dispara a viagem; `bun tools/testes/run.mjs` rc=0.
- **Código da correcção (encaminhada em `eda6303f`, parte-02.md:2559-2565)**: `const mem = _regiaoAntesDaBase; const memOk = mem && (function(){ try { const e = estimarRegiao(mem); return !!(e && e.morte === false); } catch { return false; } })(); const reg = memOk ? mem : regiaoIdeal();` — fail-closed (`morte` ausente ou `true` → descarta a memória), **não gravar** regiões letais na memória e pôr o `viajarPara` da base sob a hierarquia.
- **Prova exigida (parte-02.md:2567-2570)**: memória em `barao` com nível 29 → escolher `dragao`; **controlo**: memória em `dragao` (segura) → usar `dragao` (a regra "voltar para onde estava" tem de continuar a funcionar quando é segura).
- **Estado**: pendente

### TK-02-41 | P1 | `estimarRegiao` calcula taxa teórica e não avalia a luta (não cruza os stats da wiki com a sobrevivência)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1968 — *“por que o script nao ta cruzando com a wiki o status de TUDO, e da regiao, pra calcular tudo?”*; resposta em parte-02.md:1992-1994 — *“O estimarRegiao calcula as taxas pelas curvas teóricas e não avalia a luta. O agregar() (dados medidos) está vazio para o Barão — logo não há nada a corrigir a teoria”*; e parte-02.md:2025 (*“a wiki (o META, que está fresco — 3 minutos) tem os stats dos monstros; o que falta é usá-los para avaliar a sobrevivência”*)
- **Fazer**: usar os stats dos monstros da região (META/wiki) para avaliar a luta — dps recebido, hp mínimo, sobrevive ou não — e incorporar isso na decisão de região e no ranking, em vez de só curvas de ouro/xp.
- **Aceitacao**: `estimarRegiao` devolve, por região, ouro/xp por minuto **e** risco avaliado (morte/dps) com `file:linha` da mecânica de dano do motor; ao vivo, nível 29 no Barão dá morte e o Fosso do Dragão fica à frente.
- **Estado**: pendente

### TK-02-42 | P2 | Banco de testes codifica o comportamento antigo do pin do Rabadon (4 asserções vermelhas de propósito)
- **Ficheiro(s)**: tools/testes/ (o ficheiro que contém as asserções do pin/objetivoItem)
- **Evidencia**: parte-02.md:2050 — *“O banco está vermelho — e está certo que esteja. O motor aterrou o pin por classe, e 4 asserções minhas ainda codificam o comportamento antigo (Rabadon a entrar na build AD). Vou corrigi-las para a regra nova.”*; regra nova em parte-02.md:1710-1719
- **Fazer**: substituir as 4 asserções pelas da regra nova (classe oposta não entra na build; mesma classe continua a entrar) e nomear no relatório quais asserções mudaram — **não** reverter o motor para o banco ficar verde (REGRA Nº 6).
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 e nenhuma asserção a exigir Rabadon em build AD; relatório nomeia as 4 asserções alteradas.
- **Estado**: pendente

### TK-02-43 | P2 | Simulador de chefes com boneco fixo à mão e tabelas copiadas — não responde “com que build e nível mato o Barão, em quantos segundos”
- **Ficheiro(s)**: tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:1814-1830 — o boneco está fixo à mão (`Personagem: nv 27, 4188 HP, 154 arm, 127 RM`); *“O que falta … o personagem está fixo à mão (nv 27, 4188 HP, 154 arm) — não vem de uma build. Logo não sabe responder ‘com QUE build’ nem ‘em quantos segundos’”*; pedido do dono em parte-02.md:1794 (*“qual a melhor build pra matar o baron, e que level, e que status … qual vai ser o dps que o boneco vai tomar … quantas pots deveriam ser usadas na luta e a margem de erro de pots … com QUAIS BUILDS e QUAIS LEVEIS eles ja começam a matar o baron, e em quantos segundos”*); delegação em `e3814a7a` (parte-02.md:1834-1853)
- **Fazer**: 1) receber build + nível e derivar os stats da build; 2) duração da luta em segundos (DPS × HP do chefe, com armadura/pen e multiplicadores de chefe); 3) dps que tomas vs o mínimo (hpMin e margem); 4) poções e margem de erro com o `sweep` que já existe; 5) iterar sobre as builds do Yasuo e da Katarina — build ideal vs segunda — com o nível mínimo em que cada uma começa a matar o Barão, em quantos segundos e com quantas poções; 6) testar a hipótese do dono (“a build ideal mata num nível menor que a segunda”) e dizer com números se não for verdade.
- **Aceitacao**: saída do simulador com, por build e por nível: sobrevive?, segundos, poções e ouro de poção, e o nível mínimo em que cada build mata o Barão — e a hipótese do dono confirmada ou refutada com número.
- **Estado**: pendente

### TK-02-44 | P1 | Simulador copia tabelas do jogo à mão (`CURVA`, `MONSTROS`, `HAB`, `RODIZIO`, `NIVEL_DIF`)
- **Ficheiro(s)**: tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:1863 — *“O simulador copia à mão as tabelas do jogo (CURVA, MONSTROS, HAB, RODIZIO, NIVEL_DIF) — com um comentário a admitir que os multiplicadores ‘vão inline no motor’ e não são exportáveis. É exactamente o problema dos hardcodes … enquanto estas tabelas forem cópias, o simulador pode divergir do jogo sem ninguém dar por isso”*; e o valor à mão em `tools/sim-chefes.mjs:28  const NIVEL_DIF = { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3 }` (parte-02.md:1805, 1838)
- **Fazer**: derivar estas tabelas do jogo (avaliar as funções do motor no mundo isolado e exportar os números, como em TK-02-09) ou, se forem mesmo inline e não exportáveis, marcar cada cópia com `file:linha` de onde veio e um teste que falha quando o motor muda.
- **Aceitacao**: cada tabela do simulador tem `file:linha` de origem e/ou é gerada; há uma verificação automática que acusa divergência entre a cópia e o motor.
- **Estado**: pendente

### TK-02-45 | P2 | UX da GUI: switch à direita, do tamanho da janela inteira, texto truncado/ilegível
- **Ficheiro(s)**: extension/gui.js, extension/popup.css
- **Evidencia**: parte-02.md:1877 — *“a user experience da gui ta uma merda. tira print voce mesmo e arruma cada aba. e tem coisa que nao ta legivel ou truncada”*; e parte-02.md:1880 — *“faz o switch de habilitar coisas do painel na esquerda, nao na direita. e é completamente ESTUPIDO que o switch seja do tamanho da gui inteira”*
- **Fazer**: passar os interruptores do painel para a **esquerda**, com tamanho de interruptor (não full-width); varrer cada aba atrás de texto truncado ou ilegível (medir no DOM, não a olho) e corrigir; rever uma aba de cada vez com print real.
- **Aceitacao**: print de cada aba (aberta pelo caminho real de abertura — ver TK-02-46) sem texto cortado; interruptores à esquerda e com largura de interruptor; marcador discriminante nas classes novas.
- **Estado**: pendente

### TK-02-46 | P2 | Painel da GUI não abre por `classList.add(on)` — caminho real é o `abrir()` interno
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:1927 — *“O painel não apareceu na captura. Eu abri-o com classList.add(on), e isso não é o caminho real de abertura — o painel só renderiza quando o abrir() interno corre (hover no lançador ou F8 pelo handler). A captura mostra o jogo, não a GUI. Não consigo fazer a revisão visual que pediste até acertar no caminho de abertura.”*
- **Fazer**: usar o caminho real de abertura (hover no lançador ou F8 pelo handler) nas ferramentas de print/verificação; se o painel não depender de JS para renderizar, garantir que o render não dependa de interacção escondida.
- **Aceitacao**: print do painel com conteúdo real (painelLen > 1.000 caracteres medido no DOM) pelo caminho real; marcador discriminante; documentar o caminho de abertura no README/docs para os próximos agentes.
- **Estado**: pendente

---

## Lote 6 — âncora `parte-02-lote-6` (leitura até parte-02.md:2400)

### TK-02-47 | P1 | Modalidade “auto farm pra item” não tem suporte real no motor (sem modo persistente, sem `farmarItem(ids)`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2265 — *“O QUE FALTA NO MOTOR para a modalidade (b) existir ‘a serio’: (1) nao ha modo persistente ‘farmar ate cair’ — a regiao fica fixa e nao ha auto-avanco/parada quando o item cai (esta dito na propria GUI); (2) nao existe funcao do motor tipo farmarItem(ids) — a GUI compoe setConfig(enabled)+setConfig(regionDefault)+viajarPara”*
- **Fazer**: implementar no motor um modo persistente “farmar até cair o item X” (com parada/auto-avanço quando o item cai) e uma função própria (ex.: `farmarItem(ids)`), em vez de a GUI compor `setConfig`+`regionDefault`+`viajarPara` a cada vez.
- **Aceitacao**: no banco, ligar o modo com 1 id faz o motor fixar a região, viajar e parar quando o item aparece na mochila; sem o item, continua a farmar; `bun tools/testes/run.mjs` rc=0 com casos novos.
- **Estado**: pendente

### TK-02-48 | P1 | `planejar()` salta itens sem zona e não agrega por item — a GUI tem de os cruzar com `ondeItem`
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2265 — *“(3) planejar() NAO devolve os itens sem zona (salta-os com ‘if (!o) continue’), por isso a GUI tem de cruzar com getMeta().ondeItem para dizer ‘nao dropa em zona nenhuma’; (4) planejar() nao agrega por item (a melhor zona e calculada na GUI); (5) a chance vem de porClasse (ap/ad) escolhida pelo motor”*
- **Fazer**: fazer o `planejar` devolver todos os itens pedidos (incluindo os sem zona, com marca explícita “sem drop”) e agregar por item (melhor zona, chance por abate, drops/hora), para a GUI não ter de recalcular nada — e para a chance continuar a sair da classe certa (ver TK-02-03).
- **Aceitacao**: teste a chamar `planejar` com um item sem zona e a receber o registo marcado; e com 3 itens a receber 3 linhas agregadas com a melhor zona de cada; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-49 | P2 | Verificação visual da GUI nunca foi feita (espaçamento, scroll, grelha do modal, minimizar no ecrã real)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:2273 — *“O QUE NAO CONSEGUI VERIFICAR (sem browser, sem CDP, sem jogar): (a) nada visual — espacamento/scroll dos cartoes novos, a grelha agrupada do modal e o comportamento do minimizar no ecra real; a prova e nao-visual: smoke do GUI …”*; pedido do dono em parte-02.md:1877 (*“tira print voce mesmo e arruma cada aba. e tem coisa que nao ta legivel ou truncada”*)
- **Fazer**: abrir a GUI pelo caminho real (TK-02-46) e tirar print de **cada aba**; medir no DOM texto cortado/ilegível (largura vs conteúdo, overflow escondido) e corrigir o que aparecer; revisar espaçamento/scroll dos cartões novos e a grelha do modal de itens.
- **Aceitacao**: print de cada uma das 4 abas anexado ao relatório, sem texto truncado (medição no DOM: nenhum elemento com `scrollWidth > clientWidth` sem indicação de scroll) e com o minimizar a funcionar no ecrã real.
- **Estado**: pendente

### TK-02-50 | P2 | GUI depende de dados que ninguém confirmou na página real (`ondeItem` vazio, persistência em `chrome.storage.local`)
- **Ficheiro(s)**: extension/gui.js, extension/automation.js
- **Evidencia**: parte-02.md:2273 — *“(b) nao confirmei na pagina real que getMeta().ondeItem vem preenchido — se vier vazio, o plano diz ‘o motor ainda nao leu o catalogo’ e a lista nao marca ‘sem drop’; (c) a persistencia do minimizar/da modalidade depende de chrome.storage.local (no harness e stub); (d) a lista de switches foi exercitada com um stub de 3-6 switches”*
- **Fazer**: confirmar ao vivo (a) que `getMeta().ondeItem` vem preenchido e (b) que o minimizar e a modalidade de farm sobrevivem a F5 e à troca de aba; se o `ondeItem` vier vazio, descobrir porque (o motor tem de o encher) e corrigir.
- **Aceitacao**: medição ao vivo com marcador discriminante: `ondeItem` com N itens (N > 0), minimizar a sobreviver a F5, modalidade de farm a manter-se após troca de aba.
- **Estado**: pendente

---

## Lote 7 — âncora `parte-02-lote-7` (leitura até parte-02.md:2760)

### TK-02-51 | P0 | Build ideal do motor escolhe a pior opção: bota de CDR + item de dano vs bota de pen + Ímpeto
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2436-2456 — simulador `tools/sim-build.mjs`: `A) CDR+Chama (3158, 4645): AP 859 · CDR 8% · pen 40%` contra `B) pen+Ímpeto (3175, 4629): AP 899 · CDR 15% · pen 55% ← DOMINA A em tudo`; *“B ganha em TODAS as armaduras, de 0 a 200+ … +184 a +228 de DPS. E ganha porque tem mais CDR (15% vs 8%), mais pen (55% vs 40%) e mais AP (899 vs 859) — não é uma troca, é uma dominância”*; e parte-02.md:2452-2456 / 2587 — *“A build actual é [3171, 3089, 3135, 3100, 4629] — bota de CDR (3171) + Ímpeto … A build que o motor escolhe é a pior das duas”*
- **Fazer**: corrigir a escolha da build ideal no motor para que a comparação seja feita ao nível da **combinação completa** (bota + item), e não de itens isolados, de modo a escolher a opção dominante; a prova é o simulador já escrito (`tools/sim-build.mjs`), com as constantes lidas do motor (`motor.js:499/515/522/529/537/539/1688/1207/173`).
- **Aceitacao**: no banco, a build ideal para um campeão AP passa a conter a bota de pen + Ímpeto (opção B) quando ela domina; o teste compara com os números do simulador; `bun tools/testes/run.mjs` rc=0. Ao vivo, marcador discriminante a mostrar a build nova.
- **Estado**: pendente

### TK-02-52 | P1 | Rotação da barra: comportamento “usar tudo disponível” está desligado — dono quer ligado por defeito
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2696 — *“tu entende que antes funcionava de forma perfeita, onde usava tudo disponivel (sem clicar nas skills, ja que o farm usa skill automatico, é coisa do jogo, por isso idle) e ai removia dos slots pra colocar nos slots as que tavam mais proximas de serem usadas, e assim em loop, o tempo inteiro?”*; o que o código dizia em parte-02.md:2608-2610 (*“a versão antiga ordenava por pronto (recarga) e por isso a barra mudava a cada 2 s”* — tratado como defeito); correcção encaminhada em `6139633e` (parte-02.md:2734-2751): ligado por defeito, **ultimate sempre dentro**, prontas primeiro e em recarga pela recarga restante, **reavaliação contínua a cada 2 s** (loop), **sem clicar skills**, anti-oscilação em empates
- **Fazer**: repor o comportamento por defeito descrito pelo dono, com as 5 condições da correcção encaminhada, e com prova num cenário de 4 skills (2 prontas, 2 em recarga) mostrando as duas barras exactas.
- **Aceitacao**: ao vivo, a barra da Katarina troca sozinha ao longo do combate (marcador discriminante no log a cada reavaliação) com a ultimate sempre dentro; o cenário de 4 skills passa no banco com as barras exactas; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-53 | P2 | Secção “Ações” da GUI faz o que o dono faz no jogo — GUI deve ser só de coisas automáticas
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:2597 — *“‘açoes’ é ridiculo. se eu quero açao, eu faço na merda do jogo, nao na gui. oq eu quero na gui sao coisas automaticas.”*; resposta em parte-02.md:2602-2604 (*“Vou encaminhar: a GUI é para o que é automático, não para botões que fazem o que tu fazes no jogo”*)
- **Fazer**: remover da GUI (ou esconder atrás de um separador de diagnóstico) os botões que executam acções manuais do jogo; manter na GUI só interruptores/estado/visualização do que é automático.
- **Aceitacao**: a aba/section de Ações deixa de ter botões de acção no jogo (medido no DOM: 0 botões que chamem acções do motor fora do diagnóstico) e o painel continua funcional; marcador discriminante.
- **Estado**: pendente

### TK-02-54 | P2 | Faltam correr Q2, Q3 e Q4 do simulador (dois Cajados, Lich na Katarina, dois Rabadons)
- **Ficheiro(s)**: tools/sim-build.mjs
- **Evidencia**: parte-02.md:2486 e 2593 — *“Falta-me correr as Q2, Q3 e Q4 (dois Cajados, o Lich na Katarina, dois Rabadons) — o simulador já as calcula, e é o próximo passo”*; perguntas originais em parte-02.md:1593-1598 e a resposta já sabida de `tem()` booleano em `motor.js:522` e `:529` (parte-02.md:1573-1582)
- **Fazer**: correr as três simulações e registar os números: perda de dois Cajados do Vazio, se o Lich entra na build da Katarina e na de um mago lento (com o multiplicador derivado da frequência de skills — TK-02-35), e o valor de dois Rabadons.
- **Aceitacao**: saída do simulador com os três números e a conclusão (“entra na build” / “não entra”) para cada um, com as constantes citadas por `file:linha`.
- **Estado**: pendente

---

## Lote 8 — âncora `parte-02-lote-8` (leitura até parte-02.md:3120)

### TK-02-55 | P1 | Faltam as asserções do banco para as correcções novas do motor (provas feitas só por script efémero)
- **Ficheiro(s)**: tools/testes/ (novas/actualizadas suites)
- **Evidencia**: parte-02.md:3049 — *“NAO escrevi nem alterei NENHUMA assercao do banco (o meu escopo e automation.js). As assercoes novas que pediste (3031/3089, rotacao, fuga, regiao memorizada, barra, auditoria de passivas) ficam do teu lado; deixei-as provadas por script efemero e expus no window.__lolidleAuto o que o banco precisa: auditoriaPassivas, regiaoSegura, primeiaVez, primeiraVezPasso, PRIORIDADE_EXTREMA, ehPrioridadeExtrema”*
- **Fazer**: escrever as asserções para: (a) protecção `3031`/`3089` (duplicados incluídos) com controlo de item comum a ir ao mercado; (b) `rotacao` sob manutenção a mexer a barra com auto-play desligado; (c) `fugir` em manutenção, sem exigir chefe, com controlo `fugir=false`; (d) `regiaoSegura` a descartar memória letal e a aceitar memória segura; (e) `barraPorDisponibilidade` (cenário de 2 prontas + 2 em recarga, empate sem oscilação, ultimate sempre em 1.º); (f) `auditoriaPassivas().duplas.length === 0`.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com as suites novas e POPULATION acima de 260; relatório nomeia cada asserção acrescentada e qual comportamento antigo deixa de ser aceite.
- **Estado**: pendente

### TK-02-56 | P2 | `supervisarBase` / `viajarPara` da rotina da base nunca foi conduzido ponta-a-ponta no banco
- **Ficheiro(s)**: tools/testes/ (fixture da base) e extension/automation.js se o teste revelar defeito
- **Evidencia**: parte-02.md:3050 — *“A rotina da base (supervisarBase) NAO foi conduzida ponta-a-ponta no banco: provar o viajarPara exige o fixture inteiro da base + acaoBase() resolvido. Provei a EXPRESSAO da decisao e os dois argumentos (regiaoSegura + regiaoIdeal), e li a linha alterada.”*; e a nota de que o caminho AFK→farm **não tinha portão nenhum** — “era o buraco real” (parte-02.md:3045)
- **Fazer**: construir o fixture da base no banco e conduzir os três caminhos de `viajarPara` (volta da base, farm forçado, AFK→farm) com auto-play ligado/desligado e manutenção ligada/desligada, provando que nenhum viaja quando não pode.
- **Aceitacao**: no banco, auto-play desligado + manutenção desligada → nenhuma viagem nos três caminhos; manutenção ligada + região segura → viagem; região letal → sem viagem; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-57 | P2 | `precoSemComparavel` implementado mas o caminho nunca foi exercitado ponta-a-ponta
- **Ficheiro(s)**: extension/automation.js, tools/testes/
- **Evidencia**: parte-02.md:3051 — *“precoSemComparavel: implementado, mas o caminho nao foi exercitado ponta-a-ponta (precisa do DOM do mercado + oferta sem comparavel). E substituicao de constante; o piso do jogo (minimoMercado) continua a ser respeitado.”*
- **Fazer**: exercitar o anúncio de um item sem comparável no banco (DOM do mercado + oferta sem comparável) e confirmar o preço 1.500.000 e que o `minimoMercado` do jogo continua a ser respeitado.
- **Aceitacao**: asserção a mostrar o preço do anúncio sem comparável = 1.500.000 (e a mudar quando a config muda) e o piso do jogo respeitado; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-58 | P1 | Discrepância entre o que o subagent reporta e o que a extensão a correr mostra (código novo, runtime velho)
- **Ficheiro(s)**: extension/ (recarregar) — verificação ao vivo, sem escrever código
- **Evidencia**: parte-02.md:3069-3079 — `campo4629: 0.15` (o subagent disse “4629 NAO tem campo cdr” — **tem**), `barraPorDisponibilidade: false` (o subagent diz que inverteu para TRUE), `ideal: "dragao"` (o subagent diz que agora é “vermelho”); *“O ficheiro tem 428.844 bytes — exactamente o que ele reporta. Logo o código está lá; a extensão a correr é que pode estar velha. Vou forçar o reload e reconfirmar.”*
- **Fazer**: forçar `lolidle:reload` + reload da página (ignoreCache) e reconfirmar os três pontos com **marcador discriminante** (texto que só existe no código novo), antes de afirmar anything sobre o estado ao vivo (REGRA Nº 4).
- **Aceitacao**: after reload, `barraPorDisponibilidade: true`, `campo4629: 0.15` confirmado, e `regiaoIdeal()` igual ao que o banco prevê — cada um provado por marcador discriminante; se divergir, o relatório diz qual dos três ficou velho.
- **Estado**: pendente

### TK-02-59 | P2 | Conta renomeada conta como “primeira vez” e o auto-play liga sozinho ao fim de 3 min
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3053 — *“CAVEAT da regra ‘conta nova’: se o dono RENOMEAR a conta, o nome novo nao esta em contas e conta como primeira vez (liga sozinho apos 3 min). Esta documentado no codigo; se preferires, endureco com o ultimo nome visto.”*
- **Fazer**: endurecer a detecção de primeira vez com o **último nome visto** (guardado em storage), para renomear a conta não fazer o motor ligar sozinho.
- **Aceitacao**: no banco, renomear a conta não liga o auto-play ao fim dos 3 min; conta genuinamente nova continua a ligar; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-60 | P3 | Regressão de acentuação nas regex de erro do motor (corrigida, mas pode repetir-se)
- **Ficheiro(s)**: tools/testes/ + extension/automation.js
- **Evidencia**: parte-02.md:3101 — *“uma REGRESSAO MINHA corrigida: o sweep anterior tinha acentuado o regex /slot nao achado/i (o motor escreve ‘slot nao achado’, sem acento) — a traducao do erro do cofre ia deixar de casar. Revertido (idem /^nao-esta-na-base$/).”*
- **Fazer**: acrescentar uma verificação que garanta que cada regex de tradução de erro casa com o texto **exacto** que o motor produz (fixture com os textos reais), para que um sweep de acentuação não parta a tradução.
- **Aceitacao**: suite nova com os textos exactos do motor a passar; qualquer regex que deixe de casar falha o banco; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

---

## Lote 9 — âncora `parte-02-lote-9` (leitura até parte-02.md:3500, inclui RESUMO DE COMPACTAÇÃO #3)

### TK-02-61 | P0 | Mudar o DEFAULT não muda a config guardada — a conta do dono continua com `barraPorDisponibilidade: false`
- **Ficheiro(s)**: extension/automation.js (migração de config) + extension/gui.js se a config for visível lá
- **Evidencia**: parte-02.md:3277-3316 — *“O subagent inverteu o default para true — mas a tua config em chrome.storage foi escrita quando o default era false, e continua false. O mesmo vale para qualquer default que se mude: só se aplica a instalações novas. Consequência prática: a rotação contínua da barra — o teu pedido — não vai ligar sozinha na tua conta. Precisa de ser escrita explicitamente na config existente. É a diferença entre ‘o código está certo’ e ‘o teu jogo faz o que pediste’.”*; prioridade declarada em parte-02.md:3316 (*“A prioridade nº 1 é escrever os defaults novos na config existente — sem isso, nada do que foi corrigido chega ao teu jogo”*)
- **Fazer**: implementar uma migração one-shot dos defaults novos para a config já guardada (versionar a config e aplicar as chaves novas na primeira carga), e verificá-la ao vivo com marcador discriminante depois de `lolidle:reload` + reload (REGRA Nº 4).
- **Aceitacao**: ao vivo, na conta do dono, `barraPorDisponibilidade: true` (e as outras chaves novas com o valor novo) **sem** apagar configurações do utilizador; marcador discriminante que só existe no código novo; `bun tools/testes/run.mjs` rc=0 com caso de migração.
- **Estado**: pendente

### TK-02-62 | P1 | `mit` calculado sem o `RM_MONSTRO = 0,6` — dano mágico subestimado 1,6×
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3197-3198 e 3302 — *“ERRO no mit: automation.js:3109 e 5123 usam 100/(100+armadura*(1-pen)) SEM o RM_MONSTRO=0.6 (motor.js:1179,1202) -> dano MÁGICO subestimado (1,6x a 104 de armadura)”*
- **Fazer**: alinhar o `mit` da extensão à fórmula do motor (com `RM_MONSTRO`), lendo o valor do jogo e não o escrevendo à mão; confirmar no motor a lista completa de campos da fórmula antes de codar (REGRA Nº 1).
- **Aceitacao**: teste com armadura 104 a dar dano mágico 1,6× maior que antes e igual ao do motor (comparação contra `motor.js:1179/1202`); `bun tools/testes/run.mjs` rc=0; nenhum número do motor copiado à mão.
- **Estado**: pendente

### TK-02-63 | P1 | A mesma passiva vale 3× no scoring (texto × `multEsp` 1,25 × `PESO_FASE` 1,35)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3199-3200 e 3303 — *“A MESMA passiva vale 3x-4x: valorPassiva (texto) x multEsp (1.25) x PESO_FASE.itens (fase). Ex.: 3135 = 40*7=280 -> x1.25 -> x1.35 = +472 de valor só de palpites”*
- **Fazer**: fazer a passiva contar **uma** vez em cada etapa do scoring (remover a multiplicação cruzada texto×especial×fase, ou justificar cada factor com `file:linha` do motor).
- **Aceitacao**: teste a mostrar o valor do `3135` sem os +472 de palpites e o valor final da build inalterado onde não deve mudar; `auditoriaPassivas().duplas.length === 0` continua a valer; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-64 | P1 | `tierDe` contradiz o motor (1 qualidade ≠ 10 refinos)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3201-3202 e 3304 — *“tierDe (automation.js:333) = qIdx*10+refino contradiz o motor (motor.js:252: (1+0.12*ref)*multQual, ou seja 1 refino = +12% e 1 degrau de qualidade = +15%). 1 qualidade NÃO vale 10 refinos.”*
- **Fazer**: substituir `tierDe` pela fórmula do motor (multiplicativa: qualidade × refino), lida do jogo, e rever todos os sítios que a usam para ordenação/comparação.
- **Aceitacao**: teste a mostrar que 1 qualidade vale +15% e 1 refino +12% (bater com `motor.js:252`) e que a ordenação de itens muda onde deve; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-65 | P1 | A extensão proíbe repetir qualquer item base; o motor só proíbe lendário repetido
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3203-3204 e 3305 — *“escolherConjunto/montarBuildDe proíbem repetir QUALQUER base; o motor só proíbe LENDÁRIO repetido (motor.js:2879/2886/2891). É mais restritivo que o jogo.”*
- **Fazer**: restringir a proibição de repetição a lendários iguais (regra do jogo), deixando repetir itens não-lendários quando o motor permite; confirmar a lista exacta das condições em `motor.js:2879/2891` antes de codar.
- **Aceitacao**: teste a mostrar que dois itens não-lendários iguais podem ser escolhidos e que dois lendários iguais não podem (bater com o motor); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-66 | P1 | `CAMPOS_MULT` não tem `penMag` — as botas de pen só entram por `ITENS_ESPECIAIS` escrito à mão
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3205-3206 — *“CAMPOS_MULT não tem ‘penMag’ (motor.js:501 tem) -> as botas de pen só entram por estarem escritas à mão em ITENS_ESPECIAIS”*; e a causa raiz da escolha errada da bota em parte-02.md:3133-3137 (*“o campo penMag NAO EXISTIA em NENHUM perfil … o pen é o stat que o motor multiplica na mitigação”*)
- **Fazer**: acrescentar `penMag` a `CAMPOS_MULT` e retirar a dependência da lista manual `ITENS_ESPECIAIS` para itens de pen, para que a escolha venha do campo e não de uma lista escrita à mão.
- **Aceitacao**: teste a mostrar que um item com `penMag` no campo entra na build sem estar em `ITENS_ESPECIAIS`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-67 | P1 | 259 hardcodes na matemática de builds: 103 deriváveis e 151 heurísticas — plano de redução
- **Ficheiro(s)**: extension/automation.js (aplicar) · docs/hardcodes-build.md (fonte da auditoria)
- **Evidencia**: parte-02.md:3187-3195 e 3290-3298 — contagem: *“(a) NECESSÁRIO = 5 (2%) (b) DERIVÁVEL = 103 (40%) (c) HEURÍSTICA MINHA = 151 (58%)”*, grupos G1..G23 (pesosItem 55, PESO_FASE 41, valorPassiva 28, ITENS_ESPECIAIS 34, KAT_FB 11, MECANICA+cópias 30, statsSet/estimarSet/scoreSet 13); auditoria em `docs/hardcodes-build.md` (331 linhas, cada linha com file:linha + token + valor + o que deveria ser)
- **Fazer**: atacar primeiro os 103 **deriváveis** (substituir por leitura do jogo, um grupo de cada vez, começando pelos que mudam decisões: `pesosItem`, `PESO_FASE`, `valorPassiva`), e listar ao dono os 151 heurísticos que dependem de regra dele — sem os inventar.
- **Aceitacao**: cada grupo tratado tem teste a provar que o valor vem do jogo (duas execuções com motor diferente dão resultado diferente) e a contagem de heurístico desce; relatório com a contagem nova por classe.
- **Estado**: pendente

### TK-02-68 | P2 | Escolha da build ideal precisa de considerar o limiar de armadura do alvo (inversão noutro par de botas)
- **Ficheiro(s)**: extension/automation.js (build de chefe)
- **Evidencia**: parte-02.md:3215-3217 e 3309 — *“A INVERSÃO existe noutro par: bota de pen ÉPICA (3020)+Ímpeto vs bota de CDR (3158)+Ímpeto -> CDR ganha até armadura ~206, pen épica ganha acima disso”*; *“A inversão que procuras existe noutro par: bota de pen épica (3020) vs bota de CDR — o CDR ganha até armadura ≈206, o pen épica acima”*
- **Fazer**: fazer a build de chefe escolher as botas pela armadura do alvo (usando a armadura real do chefe, não uma armadura média), porque acima/abaixo do limiar o vencedor troca.
- **Aceitacao**: teste a mostrar que com armadura 100 escolhe uma bota e com armadura 300 escolhe a outra, batendo com o simulador `tools/sim-build.mjs`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-69 | P2 | Lich Bane deve entrar na build (1.º no ranking do 5.º espaço) e rende mais com a barra top-4
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3226-3227 e 3311 — *“RANKING do 5º espaço na Katarina: Lich 1099 > Liandry 1075 > Chama 856 -> SIM, o Lich deve entrar”*; e parte-02.md:2905-2909 (*“O item vale 15,9% ou 22,8% do DPS conforme as skills que estão na barra — e a barra com recargas mais curtas aumenta o proc em 65%”*)
- **Fazer**: garantir que a build ideal da Katarina (e de magos com frequência de skills alta) inclui o Lich quando o ranking do motor o põe em 1.º, e que a avaliação do proc usa a frequência real das skills da barra (ver TK-02-52).
- **Aceitacao**: `buildIdealPara` da Katarina contém o Lich quando o cálculo do ranking o favorece; `bun tools/testes/run.mjs` rc=0 com o ranking citado.
- **Estado**: pendente

### TK-02-70 | P2 | Conta do dono: perfis de tanque AP ficam com `3170` em vez de `3175` — regra nova por decidir
- **Ficheiro(s)**: extension/automation.js (só depois da decisão)
- **Evidencia**: parte-02.md:3124-3125 e 3177 — *“O Taric e o Zac (magia:true, mas perfil TANQUE) ficam com 3170 (Marcha Celere, bota de esquiva) e nao com o 3175 — no perfil tanque o pen vale 100/unidade e a esquiva/botas defensivas ganham. Se quiseres o 3175 TAMBEM nos tanques, e uma regra nova (bota de pen para tanque AP) e digo-te: nao a inventei.”*
- **Fazer**: **não implementar sem decisão do dono** — levar a pergunta: bota de pen (3175) também para campeões AP de perfil tanque? Se sim, definir onde o critério vive (perfil ou classe).
- **Aceitacao**: decisão do dono registada; se sim, implementada com `file:linha` do critério e teste; se não, documento a dizer porque o tanque fica com a `3170`.
- **Estado**: pendente

---

## Lote 10 — âncora `parte-02-lote-10` (leitura até parte-02.md:3900)

### TK-02-71 | P2 | Regressão: `acaoD()` com 4 args desactivou 12 botões; e o `||` na mochila engulia o cartão
- **Ficheiro(s)**: extension/gui.js, tools/testes/ (smoke do GUI)
- **Evidencia**: parte-02.md:3522 — *“o acao() tinha 5 argumentos (id, texto, ajuda, cls, off) e o acaoD() tem 4 (id, texto, ajuda, off) — a classe ‘sec’ caiu no lugar do off, o que DESACTIVAVA o botao (11 deles)”*; e parte-02.md:3523 — *“DEFEITO PRE-EXISTENTE na mochila … a linha do bloco de chips: string + (b.items||[]).map(...).join(‘’) ou ‘<span class=vazio>mochila vazia</span>’ — o || tem precedencia menor que o +, por isso engulia TUDO o que vinha depois: o fecho do bloco de chips e o botao de leitura nunca apareciam quando a mochila tinha itens”*
- **Fazer**: acrescentar asserções ao smoke do GUI que (a) percorram todos os botões e falhem se algum estiver `disabled` sem motivo declarado, e (b) renderizem a mochila com itens e verifiquem que o bloco de diagnóstico e o botão de leitura aparecem (regressão do `||`).
- **Aceitacao**: smoke a falhar se um botão voltar a ficar desactivado por aridade errada e se o cartão da mochila voltar a ser engolido; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-72 | P2 | Integrar no smoke a varredura de jargão, pt-PT e JSON cru (hoje foi feita à mão e apanhou 3 fugas)
- **Ficheiro(s)**: tools/testes/ ou o harness de smoke do GUI
- **Evidencia**: parte-02.md:3810 — *“Varredura final por instancia/payload/handler/callback/closure/namespace/schema/token/flag/boolean/array/string/null/undefined/NaN/object DENTRO de strings visiveis: 0 ocorrencias. O painel de problemas (Historico) tambem deixou de imprimir JSON cru: agora e ‘campo: valor · campo: valor’”*; e as fugas apanhadas à mão em parte-02.md:3527 (regex acentuadas), 3808-3809 (frases partidas: “Não você está na Fonte”, “Muda para Fixa para usando”) e 3865-3879
- **Fazer**: transformar essa varredura em verificação automática do smoke: nenhuma palavra técnica em texto visível, nenhum pt-PT, nenhum JSON cru, nenhuma frase visível que não case com as mensagens do motor (ver TK-02-60), e falhar o smoke se aparecer.
- **Aceitacao**: `smoke` falha quando se introduz uma string visível com jargão, com pt-PT ou com JSON cru; relatório com a lista de termos varridos.
- **Estado**: pendente

---

## Lote 11 — âncora `parte-02-lote-11` (leitura até parte-02.md:4300)

### TK-02-73 | P1 | `inject.js` não expõe `meta.rmMonstro` — o valor do motor fica com fallback escrito à mão
- **Ficheiro(s)**: extension/inject.js
- **Evidencia**: parte-02.md:4270 — *“RM_MONSTRO NO META: NAO esta exposto (grep em extension/ -> so aparece agora no automation.js). Como o meu ficheiro de escrita e so automation.js, leio META.rmMonstro com fallback 0.6 citando motor.js:1179. PEDIDO: acrescenta em inject.js (junto aos outros, ~linha 130) meta.rmMonstro = M.RM_MONSTRO; — fica a acompanhar o jogo automaticamente.”*
- **Fazer**: acrescentar `meta.rmMonstro = M.RM_MONSTRO` no `inject.js` (junto aos outros metas, ~linha 130), para que o valor venha do jogo e não do fallback; manter o fallback só quando a leitura falhar, com motivo no log.
- **Aceitacao**: ao vivo, `META.rmMonstro` igual ao do motor (`motor.js:1179`) e a mudar se o jogo mudar; `bun tools/testes/run.mjs` rc=0; sem 0,6 escrito à mão no código novo.
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

### TK-02-76 | P2 | Confirmar se a GUI mostra Chama Sombria onde a build ideal tem Liandry (defeito de apresentação)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-02.md:4050-4052 — *“Não tem Chama Sombria nem Ímpeto. Se estás a ver Chama Sombria no ecrã, é outra coisa — provavelmente a build equipada (a que tens) e não a ideal, ou o bloco da GUI a mostrar outro conjunto. Diz-me onde estás a ver isso (aba, cartão) e eu verifico o que o motor está a mandar para lá — porque se a GUI mostra Chama Sombria onde a ideal tem Liandry, é um defeito de apresentação que quero apanhar.”*
- **Fazer**: localizar ao vivo (aba + cartão) onde a Chama Sombria aparece e provar se é a build **equipada** ou a **ideal**; se for a ideal a mostrar o item errado, corrigir a renderização; se for a equipada, rotular explicitamente (“a tua build” vs “a build ideal”) para o dono não confundir.
- **Aceitacao**: cada bloco de build diz de que build fala (equipada/ideal/por fase) e os itens batem com o motor; marcador discriminante; verificação com a aba certa activa (REGRA Nº 4).
- **Estado**: pendente

### TK-02-77 | P2 | Inventariar todos os campos dos itens usados nas análises (o Ímpeto tem 350 de vida e nunca foi mencionado)
- **Ficheiro(s)**: docs/ (inventário) + tools/sim-build.mjs se faltar campo
- **Evidencia**: parte-02.md:4186-4190 — *“O Ímpeto dá 350 de VIDA. Em todas as análises de hoje — na Q1 do simulador, no ranking do 5.º espaço — eu falei do Ímpeto como ‘70 AP + 15% CDR’ e nunca mencionei os 350 de vida. Para uma personagem com 4.476 de vida, isso é 7,8% … Se o simulador também ignorou os 350 de vida, o ranking está errado”*; verificado em parte-02.md:4206-4213 (o simulador conta a vida: `sim-build.mjs:101` e `:229`)
- **Fazer**: inventariar, por item relevante, **todos** os campos do catálogo (`docs/game-src/itens.js`) e garantir que cada análise/simulador os usa; documentar o inventário para que nenhuma análise volte a omitir um stat.
- **Aceitacao**: inventário com cada campo por item e confirmação de que o simulador os inclui (prova: correr com e sem um campo e ver o resultado mudar).
- **Estado**: pendente

---

## Lote 12 — âncora `parte-02-lote-12` (leitura até parte-02.md:4700)

### TK-02-78 | P0 | Preço: o motor usa só o preço base e o jogo escala qualidade/refino (Ímpeto vale 4.692, motor trata-o como 3.000)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4405-4421 e 4453-4482 — tela do dono `5.625` vs motor `preco: 3000`; *“O preço também escala com a qualidade e o refino … E o motor guarda só o preço base do catálogo”*; as três funções do jogo: `motor.js:248  p += (i.preco||0) * (1 + BONUS_REFINO*refinoDe(x)) * (QUALIDADES[qualidadeDe(x)]?.mult || 1)`, `motor.js:2898 valorEquip = preco × (1 + 0,12×refino) × multQualidade`, `motor.js:257 valorVenda = piso(preco × 0,5 × (1 + 0,5×refino) × vendaQualidade)`; conta conferida: `3000 × 1,36 × 1,15 = 4.692` e o ecrã mostra 5.625 (`5625/4692 = 1,199 ≈ 1,2` = margem do Lojista, **terceira função ainda não encontrada — não inventar**); consequências em parte-02.md:4418-4421 (`venderBase`, `anunciar`, `refinarMelhores`, `isProtected`)
- **Fazer**: implementar `valorEquip` e `valorVenda` com as fórmulas do motor (`file:linha` em comentário), usá-las onde o valor decide (`venderBase`, `anunciar*`, `refinarMelhores`) e procurar a terceira função (a margem do Lojista); se não aparecer no `motor.js`, usar `valorEquip` com a dúvida registada em comentário.
- **Aceitacao**: o código devolve **4.692** para o Ímpeto do dono (não 3.000); uma peça que antes ia para o Lojista passa a ser guardada (ou o contrário) por causa do valor real, provado no banco; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-79 | P1 | `infoItem` devolve `stats: null` — o motor não sabe os atributos de itens que não estão equipados
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4566-4573 — *“O infoItem do motor devolve stats: null — quem o consultar para saber os atributos de um item recebe nada. Os stats só existem no caminho do efeitosEquipados, que os calcula para os itens equipados. Para um item na mochila ou no mercado, o motor não sabe os atributos dele. Isso é maior que o preço: significa que ao decidir entre a tua peça equipada e uma na mochila, o motor só tem os stats de uma delas.”*
- **Fazer**: calcular os stats de **qualquer** item (equipado, mochila, mercado) pela mesma fórmula que o `efeitosEquipados` usa (`motor.js:251-255`, com `QUALIDADES` `motor.js:173` e `BONUS_REFINO` `motor.js:55`), e exponde-os no `infoItem`.
- **Aceitacao**: `infoItem(4629)` devolve `ap 109,5 / vida 547 / cdr 0,23` (os valores reais da peça do dono, escalados), e a comparação equipado-vs-mochila usa stats dos dois lados; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-80 | P1 | Nome do item perde a qualidade (motor escreve “+3”, o jogo mostra “+3 [A]”)
- **Ficheiro(s)**: extension/automation.js (e extension/gui.js onde o nome é mostrado)
- **Evidencia**: parte-02.md:4406 e 4543 — `nome: "Ímpeto Cósmico +3"` — **sem o `[A]`**, contra o ecrã do dono `"Ímpeto Cósmico +3 [A]"`; *“Para ler o ecrã e casar com o que tens equipado, falta a qualidade no nome”*; pedido em parte-02.md:4521
- **Fazer**: acrescentar a qualidade ao nome onde ele é construído (`[A]`, `[S]`…), para o nome do motor casar com o do jogo.
- **Aceitacao**: `nomeItem`/`infoItem` devolvem “+3 [A]” para a peça do dono; casamento com o texto do jogo testado no banco.
- **Estado**: pendente

### TK-02-81 | P0 | A build do bot contra o Barão é 2,8–3,4× pior que a ideal e não tem a `3153` Rei Destruído
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4605 e 4625-4634 — *“ACHADO QUE MUDA DECISÕES: (1) a 3153 Espada do Rei Destruído é a peça que decide a luta (5% da vida ATUAL do alvo por auto, teto 3×CURVA.hp, motor.js:1702+1191) e NENHUMA build do bot a tem”*; medições: `Yasuo IDEAL 7025 DPS · bot 2041 DPS → 3,4×`, `Katarina IDEAL 2757 DPS · bot 993 DPS → 2,8×`; e o nível mínimo que mata o Barão: Yasuo IDEAL nv29 (52,6 s, 41 poções, hpMin 108), Katarina IDEAL nv30 (68,4 s, 56 poções) contra nv32 da build do bot; detalhe em `docs/sim-baron.md`
- **Fazer**: fazer a build de chefe incluir a peça que decide a luta (Rei Destruído) quando o alvo tem muita vida, e passar a escolher pelo DPS/sobrevivência medidos contra o chefe (não só pela build de mobs com troca de 2 peças).
- **Aceitacao**: `buildIdealPara`/build de chefe para o Yasuo e a Katarina contém a `3153` contra chefes de vida alta, e o DPS contra o Barão deixa de ser 2,8–3,4× menor que o ideal; valores conferidos contra `tools/sim-chefes.mjs`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-82 | P1 | A extensão restringe itens por classe nas builds; o jogo não restringe no equipamento
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4636-4640 — *“Na Katarina, a build AP do bot NÃO é a melhor contra o Barão. Uma build AD/crítico faz 2,8× o DPS — porque o motor não restringe itens por classe. A divisão AP/AD existe nas tabelas de drop (o Barão AP não dropa o Gume do Infinito), mas não no equipamento … a tua Katarina está equipada com a build que a teoria de mago diz, e existe uma build física que a mata o Barão três vezes mais depressa.”*
- **Fazer**: separar as duas coisas: a **tabela de drop** continua a ser escolhida pela classe (regra do jogo), mas a **build/equipamento** deixa de ser restringida pela classe e passa a ser escolhida pelo DPS/sobrevivência medidos contra o alvo; a build de chefe pode ser de outra classe que a de mobs.
- **Aceitacao**: para a Katarina, o motor é capaz de propor a build AD/crítico contra o Barão com o DPS medido (2,8×) e mantém a build de mobs coerente; `bun tools/testes/run.mjs` rc=0 com o controle de que as tabelas de drop continuam por classe.
- **Estado**: pendente

### TK-02-83 | P1 | Implementar a tolerância de nível (monstro até +4 não penaliza; acima: +15%/nível até ×3 e −7%/nível com piso ×0,25)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4587 e 4644-4651 — *“O 4 de NIVEL_DIF (motor.js:1184) é OUTRA coisa: é a faixa de tolerância (monstro até +4 níveis não sofre nada; acima disso +15% dano monstro até ×3 e −7% dano jogador piso ×0,25 — motor.js:1185-1187, aplicados em 2696/3099 e 1221). Abaixo do nv38 o Barão fica preso no 42 e o jogador apanha ×2,2-2,35.”*; e parte-02.md:4651 (*“não é o Barão que sobe, é a tolerância que se esgota”*)
- **Fazer**: implementar a tolerância de nível na avaliação de luta (dano do monstro e dano do jogador) com `file:linha` do motor, e usá-la no critério de `morte`/fuga — é ela que explica porque o nível 29 é o limite no Barão.
- **Aceitacao**: teste a mostrar que um monstro +3 níveis não penaliza, +5 penaliza conforme `motor.js:1185-1187`; e o `morte` do Barão ao nível 29 continuar `true`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-84 | P2 | Smart de poção: a luta ganha-se a beber 1/s e a margem de erro é 0–2 poções
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4598 e 4656-4661 — *“dano/s médio levado 976-1257/s (básico do Barão + tentáculos 2,6× ~1400 + queimadura 3%/s) contra cura/s das poções 911-1239/s → margem −9 a −65/s … A luta ganha-se a beber 1 poção/s (cooldown motor.js:41), não a aguentar golpes. Sem poção morre em 7-10 s. Margem de erro de poções ≈ 0-2 (a smart já bebe no limite) → o seguro é mínimo+2.”*
- **Fazer**: ajustar a smart de poção para beber no limite (1/s) com reserva de **mínimo + 2** e reportar o custo em ouro por luta (é um dos três critérios do dono: quantas poções e quanto custam).
- **Aceitacao**: medição ao vivo de uma luta de chefe com poções usadas e ouro gasto dentro da margem (mínimo+2) e hpMin > 0; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

---

## Lote 13 — âncora `parte-02-lote-13` (leitura até parte-02.md:5450)

### TK-02-85 | P0 | Lojista ainda decide venda por ouro (`valorDaVenda >= custo.ouro * 2`) — o dono diz que o Lojista é lixo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4965-4995 — `automation.js:2496  n.vender = podeFazer(vender).pode && atosVenda.length > 0 && (mochilaQuaseCheia || valorDaVenda >= custo.ouro * 2);` com a nota *“Se o Lojista não paga, essa condição é ficção — e o mochilaQuaseCheia é a única razão real”*; encaminhado em `27861ac9` e `5f7aa937` com a troca exacta (`mochilaQuaseCheia || <início de jogo>`) e o pedido de manter o `valorDaVenda` só como **valor informativo, NÃO é receita** (parte-02.md:4991); confirmado ainda pendente em parte-02.md:5266 e 5408; regra do dono em parte-02.md:4866 e 5011 (*“o lojista … é a mesma coisa que jogar item no lixo … ele so e pra ser vendido quando itens sao considerados lixo”*)
- **Fazer**: substituir a condição de venda por `mochilaQuaseCheia` (+ critério medido de início de jogo, se houver) e marcar `valorDaVenda` como informativo; nenhuma decisão de venda pode depender do ouro do Lojista.
- **Aceitacao**: prova exigida em parte-02.md:4995 — com a mochila **não** cheia e valor alto, `n.vender` fica **falso**; com a mochila cheia, continua verdadeiro; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-86 | P0 | Confirmar que nenhum caminho manda um LENDÁRIO ao Lojista (regra nova do dono)
- **Ficheiro(s)**: extension/automation.js, tools/testes/
- **Evidencia**: parte-02.md:5011 — *“lendarios sao desejados pelos jogadores, entao nunca se vende lendario pelo lojista, só pelo mercado”*; e parte-02.md:5054-5065 — pedido para percorrer **todos** os caminhos que mandam itens ao Lojista e provar as quatro linhas: `lendário duplicado → MERCADO (nunca Lojista) | épico inútil → VENDER_LOJISTA | básico → VENDER_LOJISTA | 3031/3089 duplicado → PROTEGIDO (controlo)`; verificado ao vivo em parte-02.md:5244-5261 (`nenhum lendário vai ao Lojista`) e com 6 asserções actualizadas (parte-02.md:5376-5390)
- **Fazer**: varrer todos os caminhos de descarte (`planBag`, `venderBase`, `anunciar*`, `atosVenda`) e garantir que **nenhum** aceita lendário, mantendo o contraste épico/básico → Lojista e protegidos acima da regra; manter as asserções nas duas direcções.
- **Aceitacao**: banco a provar, para cada caminho, que um lendário duplicado nunca sai para o Lojista (com o mercado vazio **e** saturado) e que épico/básico continuam a sair; verificação ao vivo com marcador discriminante.
- **Estado**: pendente

### TK-02-87 | P1 | Conflito entre instrumentos: `scoreSet` diz bota de CDR (+154), o simulador diz bota de pen (+227)
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:5136-5145 — *“Os dois instrumentos discordam: scoreSet (motor) bota de pen 822 / bota de CDR 976; sim-build.mjs (simulador) bota de pen 1465 dps / bota de CDR 1238 dps. O simulador diz que a bota de pen ganha (+227 dps); o scoreSet diz que a bota de CDR ganha (+154). Não vou escolher entre eles sem resolver o conflito”*; e a hipótese de que o `scoreSet` estava contaminado pelo bug do `efeitosEquipados` **não se confirmou** — os valores ficaram idênticos depois da correcção (parte-02.md:5438); medições em parte-02.md:5107-5126 (`976 / 822 / 783 / 683 / 593`)
- **Fazer**: descobrir porque os dois instrumentos discordam (fórmula, pesos, escalas de qualidade/refino, entrada do pen) e fazer um deles servir de referência independente do outro; só depois dar a resposta da bota ao dono.
- **Aceitacao**: os dois instrumentos concordam na ordem das builds (ou a diferença está explicada por `file:linha` e documentada); número de medições com valores exactos; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-88 | P2 | Roubo de vida na build do Yasuo — investigação delegada (`9ec1b9fa`) sem resultado no histórico
- **Ficheiro(s)**: docs/ (relatório) + extension/automation.js se o scoring não pontuar o `rv`
- **Evidencia**: parte-02.md:4785 — *“a build do yasuo ta levando em conta itens com roubo de vida?”*; delegado em parte-02.md:4843 (*“quais itens têm rv, se algum dos 5 da build dele tem, se o scoring da extensão pontua o rv, e se o motor do jogo o usa na cura. Com file:linha em tudo e proibido de escrever na extensão”*); ainda pendente em parte-02.md:5267 e 5407
- **Fazer**: concluir a investigação: itens com `rv`, se a build do Yasuo tem algum, se o `scoreSet`/`pesosItem` pontua `rv` (o audit diz que `rv→nenhum`, parte-02.md:3038) e como o motor do jogo o aplica na cura (`motor.js:1226-1228` — cura `dano × rv`).
- **Aceitacao**: relatório com `file:linha` e resposta sim/não para cada uma das três perguntas; se o scoring não pontua `rv` e o jogo cura com ele, ticket de correcção aberto com número.
- **Estado**: pendente
