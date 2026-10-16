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
- **Estado**: VERIFICADO no codigo — evidencia automation.js:323  buildDaClasse/lendariosDaClasse (class-aware) (grep + teste CDP: a nova estrutura existe); FALTA: teste dedicado isolado (REGRA 6)

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
- **Evidencia extra (a auditoria provou que a CURVA **está exportada** — `motor.js:273` — e é chamável; a hipótese de que faltava expô-la é FALSA. O que falta é o `inject.js` **chamá-la**. Só `grupoSpawn` (`motor.js:1124`) e `respawn` (`motor.js:1625/3046`) são inline. Custo de não a ler: um buff de +20% faz a extensão subestimar vida e dano de **todos** os monstros em **16,7%** (Barão nv42: toma 539/s real, acha 449/s) — parte-02.md:9863-9864 e 9898.) · - **Evidencia extra (medido ao vivo, parte-02.md:2642 e 2670)**: `curvaHp: [150, 100, 1]` — **exactamente o fallback escrito à mão**, confirmado como o valor que o motor está a usar; correcção pedida em parte-02.md:2685-2693 (`meta.curvaPorNivel = { 29: {hp: CURVA.hp(29), ...} }`, mais ler `grupoSpawn` e `respawn`, que também estão inline no motor)
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
- **Estado**: VERIFICADO no codigo — evidencia automation.js:5074  valorPassiva/sinergiaDe (passivas contam) (grep + teste CDP: a nova estrutura existe); FALTA: teste dedicado isolado (REGRA 6)

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
- **Estado**: VERIFICADO no codigo — evidencia automation.js:25  guarda do RABADON (nunca entra em build AD) (grep + teste CDP: a nova estrutura existe); FALTA: teste dedicado isolado (REGRA 6)

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
- **Estado**: VERIFICADO no codigo — evidencia automation.js:3475  n.vender = podeFazer('vender').pode && prioridade && mochilaQuaseCheia (zero ocorrencia de valorDaVenda >= custo.ouro * 2) (grep + teste CDP: a nova estrutura existe); FALTA: teste dedicado isolado (REGRA 6)

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

---

## Lote 14 — âncora `parte-02-lote-14` (leitura até parte-02.md:5850)

### TK-02-89 | P1 | `scoreSet` aplica o CDR a TODO o dano — sobrevaloriza o CDR e faz o motor preferir a bota errada
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5815-5842 — a linha exacta `automation.js:5333  let d = (base * mit) / (1 - S.cdr) * (1 + (magia ? S.lich * 0.15 : 0));` com a nota *“o CDR aplicado a TODO o dano”*; a explicação da divergência em parte-02.md:5519 e 5533-5537 (*“o scoreSet pontua o CDR como multiplicador de DPS PURO — d = base * mit / (1 - S.cdr) -> 15% de CDR vale 1/0,85 = +17,6% de dano; o pen entra por mit(). O sim-build.mjs calcula o DPS REAL … onde o CDR só multiplica a TAXA de lançamento”*); correcção proposta em parte-02.md:5677 (`danoTotal = danoAutos + danoHabilidades / (1 − cdr)`) com três travões (listar todos os sítios, reutilizar `dpsPorHabilidade`, controle: build sem habilidades não ganha nada com CDR) e a cautela em parte-02.md:5835-5840
- **Fazer**: ler o contexto da linha e separar o dano em autos e habilidades antes de aplicar o CDR (só às habilidades), **reutilizando** o `dpsPorHabilidade` que já faz a conta certa; listar todos os sítios com a fórmula; a correcção só pode mudar resultados quando há CDR.
- **Aceitacao**: controle `S.cdr = 0` dá resultado **idêntico** ao de antes; com CDR, a ordem das builds passa a concordar com o simulador (`tools/sim-build.mjs`); se a bota de CDR continuar a ganhar com margem, dizer isso em vez de insistir na hipótese; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-90 | P1 | O motor tem DOIS modelos de build que não falam um com o outro (`montarBuildDe` vs `scoreSet`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5543-5552 — *“O motor tem DOIS modelos de build que não falam um com o outro: montarBuildDe (decide a buildIdeal()) aditivo próprio (poder(i) × pesos) · scoreSet (pontua conjuntos) fórmula /(1−cdr). Não é um a validar o outro — são dois critérios independentes. Foi por isso que hoje vi o motor recomendar uma build que o próprio scoreSet dizia ser pior.”*; e parte-02.md:5520 e 5609 (*“reconciliar os dois modelos é uma decisão tua”*)
- **Fazer**: reconciliar os dois modelos num só critério (ou fazer um validar o outro por teste), para que a build Ideal e o score não possam discordar; como isso muda recomendações, é decisão do dono — apresentar as opções antes de implementar.
- **Aceitacao**: nenhum caso em que `buildIdeal()` e `scoreSet` apontem builds diferentes sem explicação; teste a percorrer o catálogo real a comparar os dois modelos.
- **Estado**: pendente

### TK-02-91 | P2 | Build ideal de MOB vs CHEFE com as combinações de CDR (delegada `2e9a4520`, sem resultado no histórico)
- **Ficheiro(s)**: extension/automation.js (aplicar) + tools/sim-build.mjs (medir)
- **Evidencia**: parte-02.md:5616 — *“quero build ideal pra mob e pra chefe. levando em conta o cdr, se devemos ter cdr ou nao, se é pra somar a bota de cdr com o impeto na build, ou só um deles, ou nenhum deles”*; delegação em parte-02.md:5657 e 5691 com **as seis combinações** (nenhum, só bota, só Ímpeto, os dois, bota de pen + Ímpeto, bota de pen sem Ímpeto), o 5.º item completo e a comparação mob vs chefe com a `3153`; ainda a correr em parte-02.md:5756 e 5798
- **Fazer**: correr as seis combinações contra mob e contra chefe com o simulador (não com o `scoreSet`, que sobrevaloriza o CDR) e devolver as duas builds completas com o 5.º item.
- **Aceitacao**: tabela final com DPS e sobrevivência por combinação, por alvo (mob/chefe), e as duas builds completas; nenhuma conclusão assente no `scoreSet` antes de TK-02-89.
- **Estado**: pendente

### TK-02-92 | P2 | Roubo de vida: entra na build por acidente, é pontuado a 0,02% e a regex do texto é código morto
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5770-5787 — tabela medida: build do Yasuo tem 18% de `rv` (`3172` 6% + `3074` 12%), *“a extensão escolheu-os POR isso? NÃO — com rv = 0 nos 108 itens, a build sai idêntica”*, peso 3 no perfil do Yasuo vale *“0,18 a 0,36 pontos num total de 2.689,94 → 0,02%”*, e *“a regex de roubo de vida do valorPassiva dispara? NÃO — 0 acertos em 108 itens: código morto”*, enquanto *“o motor do jogo usa o rv? SIM — motor.js:1226-1230”*; pergunta aberta ao dono em parte-02.md:5804 (*“o roubo de vida deve ser procurado pela build do Yasuo? … Se ele importa, é uma regra tua — eu não a invento”*)
- **Fazer**: (a) remover ou reparar a regex morta (0 acertos em 108 itens) para não dar a impressão de que o tema está tratado; (b) trazer a decisão do dono sobre se o `rv` deve ser critério de build; se sim, pontuá-lo pela cura real que o jogo aplica (`motor.js:1226-1230`).
- **Aceitacao**: regex morta removida ou a dar acertos reais (provado no catálogo); se o dono decidir que o `rv` é critério, o peso passa a reflectir a cura medida e há teste; se não, documento a dizer porque não é critério.
- **Estado**: pendente

### TK-02-93 | P1 | Muleta do `refinarMelhores`: objectivo pede para a tirar, mas ela está inerte e o que a substituiria tem erro conhecido
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5718-5752 — `automation.js:4444-4451` (`rank = (rankBuildsTestadas(null)||[]).filter(r => r.mob && r.mob.goldMin != null && (r.confianca?.mob || 0) >= 3)`; `essenciais = rank[0].itens`; `if (!essenciais.length) essenciais = buildIdeal()`) e o comentário *“Sem isto, o gate do M6 recusava refinar a build que ganhou o M1 só porque ela difere da lista teórica”*; o agente propõe a ordem: 1) corrigir o `scoreSet` (CDR), 2) ter ≥2 builds medidas no snapshot, 3) só então substituir a medida pela teoria; e parte-02.md:5740 (*“a muleta está inerte, não a estorvar”*)
- **Fazer**: cumprir a ordem (TK-02-89 → acumular ≥2 assinaturas de build → só então retirar a muleta) e registar a decisão do dono: tirar já ou depois. Se o dono mandar tirar já, tirar e nomear o que a substitui.
- **Aceitacao**: a muleta sai só quando há em que apoiar (ou por ordem explícita do dono, registada); `bun tools/testes/run.mjs` rc=0 e o relatório diz em que estado ficou.
- **Estado**: pendente

### TK-02-94 | P2 | Relatórios e GUI têm de nomear os itens (id + nome), não só o id
- **Ficheiro(s)**: extension/gui.js (+ relatórios em docs/)
- **Evidencia**: parte-02.md:5624 — *“‘bota → 3153 = 698’ FALA QUAL BOTA, CARALHO. BOTA DE PEN, OU BOTA DE CDR?”*; correcção em parte-02.md:5627-5636 (`3175 = BOTA DE PEN, 3171 = BOTA DE CDR`); e parte-02.md:4013-4023 (a necessidade de identificar os itens pelo nome antes de os comparar)
- **Fazer**: em qualquer tabela/relatório/GUI que refira um item, mostrar **id + nome** (e o efeito relevante: pen vs CDR), para nenhuma medição poder ser lida ao contrário.
- **Aceitacao**: varredura a mostrar 0 tabelas de itens só com id; GUI com nome em todos os cartões de item (marcador discriminante).
- **Estado**: pendente

---

## Lote 15 — âncora `parte-02-lote-15` (leitura até parte-02.md:6300)

### TK-02-95 | P1 | `scoreSet` não lê qualidade/refino nos ids (`~A`, `B+2`) — ou é o teto do CDR; há que confirmar qual
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5864-5878 — `penA_impeto: 488 · cdrB2_impeto: 488` e `penA_sem: 578 · cdrB2_sem: 578` **IDÊNTICOS**, com os stats certos (`3175~A → pen 17,25%`; `3171~B+2 → cdr 18,60%`) e a nota *“O scoreSet não distingue as duas botas … Não está a ler o ~A / B+2. É outro bug”*; hipótese (d) em parte-02.md:5954-5986: `CDR do Ímpeto (A+3) = 23,4% + bota de CDR B+2 = 18,6% = 42,0% > TETO DE 40% (motor.js:537)` — *“Se for isto, o empate NÃO é bug — é o tecto a comer o excedente … se for o tecto, NÃO É BUG, não mexas”*; prova: *“se depois de corrigir as duas builds continuarem a empatar, é o tecto — e a resposta é definitiva”*; ainda por confirmar em parte-02.md:6069
- **Fazer**: confirmar qual das quatro hipóesees é (tecto do CDR / caminho de stats diferente / sintaxe não interpretada / `penMag` ignorado) e **só corrigir se não for o tecto**; se for o tecto, documentar que a bota de CDR é redundante com o Ímpeto e não mexer.
- **Aceitacao**: veredicto com número (as duas builds com qualidade/refino correctos e o CDR efectivo após o tecto); se for bug, correcção + teste; se for tecto, comentário no código a dizer porque empatam.
- **Estado**: pendente

### TK-02-96 | P1 | Modelo da extensão/simulador ignora o CDR dos ATRIBUTOS (Foco) e o dano de habilidade que o Foco dá
- **Ficheiro(s)**: tools/sim-build.mjs (já corrigido lá) + extension/automation.js (verificar se tem a mesma lacuna)
- **Evidencia**: parte-02.md:6166-6172 — *“O motor soma o CDR dos ATRIBUTOS ao dos itens, e o simulador só somava o dos itens: motor.js:537 reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens) … motor.js:450 Foco: −0,4% de recarga (máx. 30%) · motor.js:483 PONTOS_POR_NIVEL=3 · motor.js:1047 pontos = 3×(nível−1) · motor.js:457/531/1218 FOCO_DANO_HAB=0.002 → o mesmo Foco dá +0,2% de dano de habilidade por ponto, tambem ignorado”*; e parte-02.md:6271-6280 (*“O CDR de item vale MAIS quando já há CDR de atributos — porque 1/(1−c) é convexo … 168 dps de diferença”*)
- **Fazer**: garantir que a extensão também soma o CDR dos atributos com o dos itens e que o `Foco` conta para o dano de habilidade, tal como o simulador agora faz; conferir contra o motor ao vivo (o dono tem 23% medido).
- **Aceitacao**: valor medido ao vivo igual ao calculado (`efeitosEquipados` → cdr com atributos+itens, ex. 38% com Ímpeto, 40% travado com o +3~A); teste a cobrir o `Math.min(0.4, Math.min(0.3, 0.004*foco) + cdrItens)`; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-97 | P2 | `readStats` não lê o “Roubo de vida” (nem outros stats) do painel do jogo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6098 e 6127 — *“A extensao tambem NAO le o stat do painel: readStats so aceita Dano|Armadura|Vel. ataque|Res. magica|Poder|Mana|Critico|Esquiva (:1202-1209, regex :1206); player() :1220”*
- **Fazer**: acrescentar ao `readStats` os stats que o jogo mostra e que a extensão ignora (a começar pelo roubo de vida), para o motor poder usar o valor real em vez do estimado.
- **Aceitacao**: `readStats` devolve o `rv` (e outros) quando o painel o mostra, com o valor igual ao do ecrã; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-98 | P1 | O `rv` do jogo não está modelado: cura = dano_final × rouboVida, só em ataques básicos, com modificadores
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6101 e 6130-6142 — `motor.js:1226-1230`: se `a.rouboVida` e a fonte for o ataque básico, `cura = dano * a.rouboVida`, e com o `3072` e cura maior que a falta há escudo (`Math.min(a.vida*0.25, ...)`); com `motor.js:254  rv: i.rv * m` (escala por qualidade/refino), `motor.js:1284-1290` (cura ×1,25 com o 3065, ×0,65 em PvP) e `motor.js:572/1231` (Sede de Sangue é outra fonte); *“A extensão ignora isto por completo. Se o lifesteal te sustenta no Barão (e a luta ganha-se a beber poções), é uma mecânica que o jogo aplica e o motor não vê.”*
- **Fazer**: modelar o roubo de vida como o motor aplica (só em auto-ataque, cura = dano final × rv, com os modificadores) e usá-lo na avaliação de sobrevivência/poções — ligado ao critério do dono (sobrevive? quantas poções e quanto custam?). A decisão de **procurar** itens por `rv` é do dono (TK-02-92).
- **Aceitacao**: cura/s calculada bate com a medida (o AGENTS.md cita 269 cura/s numa base AD em `motor.js:1226-1228`); teste com e sem `rv` a mudar o hpMin; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-99 | P1 | O modelo de build é TETO (uptime 1,0) e a uptime medida (~0,61) inverte conclusões
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:6191-6196 — *“SENSIBILIDADE À UPTIME (o modelo é TETO: em recarga, sempre) … uptime 0,61: A 1168 · B 1124 → LIANDRY +43 (mas B3 = 1206 → Ímpeto+3~A +38) → Liandry vs Ímpeto INVERTE com uptime < 0,734”*; e parte-02.md:6229 (*“O modelo continua a ser TETO … a CONFERÊNCIA DO MODELO compara com a luta medida (1360 dps) e mostra o excesso”*)
- **Fazer**: passar a usar a **uptime medida** da luta real (do snapshot/run log) nas avaliações, e mostrar sempre a conferência modelo-vs-medido para nenhuma conclusão assentar no tecto.
- **Aceitacao**: cada conclusão de build vem com o valor medido ao lado (modelo vs luta real) e a uptime usada; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-100 | P2 | O modelo tem de saber qual o alvo de referência (`alvoRef`) — a build muda com ele
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6146-6155 — `sem chefe resolvido (alvoRef=null): 3172, 3031, 3046, 3036, 3074` (a medida ao vivo) contra `com chefe nível 30: 3172, 3153, 3031, 3046, 3036` (o `3153` entra, o `3074` sai); *“O motor já tem dois caminhos (mob e chefe) e eles dão builds diferentes. O que ele não sabe é qual dos casos ocorreu ao vivo”*; e o caveat em parte-02.md:6104 (depende de `META.locais`/`META.monstros`, NAO VERIFICADO ao vivo)
- **Fazer**: tornar explicito e verificável qual o alvo de referência em uso (mob ou chefe, e qual), e provar ao vivo em que modo o motor está a decidir.
- **Aceitacao**: log/GUI diz o alvo de referência (ex.: chefe nível 30 ou mobs da região X) e a build muda quando o alvo muda; prova ao vivo com marcador discriminante.
- **Estado**: pendente

---

## Lote 16 — âncora `parte-02-lote-16` (leitura até parte-02.md:6700)

### TK-02-101 | P0 | Contradição: `buildPorFase: true` mas as três builds dão o MESMO (e trazem a peça de chefe no farm de mobs)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6526-6637 — `idealSemFase: "3175,3089,3153,3135,3100"` · `idealMobs: "3175,3089,3153,3135,3100"` ← IDÊNTICO · `idealChefe: "3175,3089,3153,3135,3100"` ← IDÊNTICO · `buildPorFase: true`; *“O motor afirma trocar a build por fase e devolve a mesma nos três casos … Tens o interruptor ligado e ele não faz nada”*; e *“O 3153 está na ideal — e é a PIOR peça para mobs (488 de 11) … O motor está a vestir a peça de chefe no farm de mobs”*; encaminhado em `1be1e7b7` com o pedido das duas listas exactas (mobs e chefe) depois da correcção e a proibição de inventar peso para a Voracidade
- **Fazer**: fazer a fase mudar de facto a build (mobs vs chefe), tirando a peça de chefe da build de mobs, e devolver as duas listas exactas; nenhum peso inventado para a Voracidade (se faltar regra, pedir ao dono).
- **Aceitacao**: `buildIdeal()`, `buildIdeal(mobs)` e `buildIdeal(boss)` dão listas **diferentes** quando devem diferir, com o `3153` fora da de mobs; prova ao vivo das duas builds vestidas em cada fase; `bun tools/testes/run.mjs` rc=0.
- **Estado**: VERIFICADO no codigo — evidencia automation.js:6031  buildDaFase/buildParaChefe (build por fase mob×chefe) (grep + teste CDP: a nova estrutura existe); FALTA: teste dedicado isolado (REGRA 6)

### TK-02-102 | P0 | Premissa falsa no simulador: `Foco = 57,5` deduzido dos 23% de CDR — o Foco é 0 e os 23% são 100% do Ímpeto
- **Ficheiro(s)**: tools/sim-build.mjs (recalcular) + extension/automation.js se depender do mesmo dado
- **Evidencia**: parte-02.md:6668-6698 — atributos lidos no jogo: `Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · Foco 0` com `81 + 3 = 84 = 3 × 28` (todos os pontos gastos ao nível 29); *“MAS ENTÃO OS 23% DE CDR NÃO VÊM DOS ATRIBUTOS … = min(0,4, 0 + 0,2346) → os 23% são 100% do ÍMPETO”*; e *“O subagent do simulador deduziu ‘Foco = 57,5 pontos’ a partir dos 23% — assumiu que o CDR vinha dos atributos … O +227 dps do Ímpeto foi calculado com foco = 57,5 — e tem de ser recalculado com foco = 0”*
- **Fazer**: recalcular as conclusões que dependiam do `foco = 57,5` (o ganho do Ímpeto, o valor do CDR de item, a comparação Ímpeto vs Liandry) com `foco = 0` e dizer quais números mudam; manter a distribuição de atributos correcta (Força/Vitalidade) verificada ao vivo.
- **Aceitacao**: o simulador corre com `foco = 0` (lido do painel) e imprime as conclusões novas; cada número que mudou é nomeado; `bun tools/sim-build.mjs` exit 0.
- **Estado**: pendente

### TK-02-103 | P1 | Voracidade da Katarina (matar reduz recarga) pode não estar modelada — inverte a intuição sobre o CDR
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6576-6596 — `motor.js:733// todos em volta (Voracidade). Cada abate reduz a recarga da Q, W e E` · `motor.js:736 P: { voracidade: 1.5, voracidadeChefe: 5, ... }` · `motor.js:1789  if (HPk?.voracidade) for (const t of [Q,W,E]) d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));` · `motor.js:1853 usar(R, {}, 2); // o abate reinicia a Guilhotina em 2s (também nos chefes)`; conclusão em parte-02.md:6592-6596 (*“Contra mobs, a passiva já te dá os cooldowns de graça … o CDR de item vale MENOS lá … Contra o chefe, há um abate só … logo o CDR de item vale MUITO mais. É o contrário do que pensavas”*)
- **Fazer**: modelar a Voracidade na avaliação de build (o valor do CDR de item depende dela: mobs com dezenas de abates vs chefe com 1 abate) e confirmar se o `montarBuildDe` já a conhece; sem inventar pesos — a regra está em `motor.js:733/736/1789/1853`.
- **Aceitacao**: valor do CDR de item diferente por fase, justificado por `file:linha` da Voracidade; builds de mobs e de chefe diferentes por esse motivo; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-104 | P1 | `statsSet` casava o id por igualdade exata — `3175~A` valia zero; e o `efeitosEquipados` multiplicava o `mult` duas vezes
- **Ficheiro(s)**: extension/automation.js, tools/testes/ (regressão)
- **Evidencia**: parte-02.md:6511-6514 — *“O statsSet casava o id por IGUALDADE EXACTA (itens.find(x => String(x.id) === id)), logo 3175~A / 3171~B+2 NÃO existiam no catálogo e a peça contribuía ZERO”*; correcção: `parseSlotId` passou a devolver o `mult` do motor (`motor.js:252`; `BONUS_REFINO motor.js:55`) e `statsSet` e `efeitosEquipados` usam-no os dois; e *“BUG MEU apanhado ao fechar isto: o efeitosEquipados multiplicava o cdr/pen pelo mult OUTRA VEZ depois do statsSet (contagem dupla: 0.1725 → 0.1984). Corrigido; agora dá exatamente 0.1725”*; prova em parte-02.md:6517-6524 (`A pen 0.5725 cdr 0.2346 score 611` vs `B pen 0.4000 cdr 0.4000 score 556`; antes 488 = 488; controle com ids crus inalterado)
- **Fazer**: manter a correcção e acrescentar asserções de regressão para (a) id com qualidade/refino nas duas ordens (`3175~A`, `4629+3~A`, `3171~B+2`), (b) id cru continuar neutro, (c) nenhuma dupla multiplicação do `mult` no `efeitosEquipados`.
- **Aceitacao**: asserções novas no banco a cobrir os três pontos e a falharem se alguma voltar a quebrar; `bun tools/testes/run.mjs` rc=0 com POPULATION acima de 260.
- **Estado**: pendente

---

## Lote 17 — âncora `parte-02-lote-17` (leitura até parte-02.md:7100)

### TK-02-105 | P1 | Optimizador por luta com o critério do dono (mata? segundos? poções e custo?) e o roubo de vida modelado
- **Ficheiro(s)**: extension/automation.js + tools/sim-build.mjs
- **Evidencia**: parte-02.md:6765-6786 — dono: *“é claro que roubo de vida é essencial. coloca na porra da build, e a build nao é só dps nao … é tornar possivel enfrentar um boss ou nao, e em quantos segundos. se yasuo mata boss sem precisar de roubo de vida, e mais rapido, é com aquela build. se nao mata, e precisa de roubo de vida, muda a build ideal. se a build ideal, apos o level estar muito avançado e nao precisar de mais de roubo de vida, e só se segurar nas pocoes, nao vale a pena por que as pocoes ficam caras por ser muito uso, a build ideal muda de novo pra roubo de vida. é tudo levado em conta.”*; delegado em `8799a7ac` (parte-02.md:6867): *“o optimizador com o critério que tu deste: não DPS, mas (mata? · em quantos segundos? · com quantas poções e quanto custam?). Com o roubo de vida modelado (dano × rouboVida, só em autos — motor.js:1226), e com o ponto de viragem: a que nível o lifesteal deixa de compensar, e a que nível volta por as poções ficarem caras”*
- **Fazer**: construir/terminar o optimizador com os quatro critérios do dono e o ponto de viragem do roubo de vida por nível; o roubo de vida entra como mecânica real (cura medida) e como economia (custo das poções).
- **Aceitacao**: para cada campeão e nível, saída com (sobrevive?, segundos, poções, ouro de poções, roubo de vida usado) e o nível em que a build muda; nada assente em DPS puro.
- **Estado**: pendente

### TK-02-106 | P1 | Auditoria completa da matemática: passivas dos 108 itens, 103 deriváveis, 8 cenários de região, build por nível
- **Ficheiro(s)**: docs/ (relatório) + extension/automation.js (correcções, por worker)
- **Evidencia**: parte-02.md:6872-6910 — dono: *“faz full audit desass merdas de matematica e corrige tudo levando em conta todas as passivas, todos os numeros do jogo, todos os cenarios de enfrentar as regioes, e quando uma build ideal muda com base no level do personagem e status. usa um subagent”*; delegação `35adec03` com o plano A) inventário completo das passivas dos 108 itens (modeladas / não modeladas / modeladas mal, com file:linha e contagem), B) todos os números reescritos à mão — os **103 DERIVÁVEIS** do doc de hardcodes, ordenados por impacto, C) os **8 cenários de região** (sobrevive? mata? em quantos segundos? quantas poções e quanto custam? e a melhor build por região), D) a build ideal por nível (1→50) para Katarina e Yasuo — em que níveis muda e por que número, incluindo o ponto de viragem do roubo de vida, E) correcções ordenadas por impacto **reportadas, não implementadas**; pontos de partida em parte-02.md:6894-6900 (259 hardcodes, 8 bugs já corrigidos, Voracidade não modelada, rv a 0,02%, 13 passivas de estado, três divergências, Foco = 0); regra: onde faltar peso do dono, escrever PRECISA DE REGRA DO DONO
- **Fazer**: executar a auditoria com esses cinco entregáveis e entregar as correcções ordenadas por impacto (cada uma como ticket com file:linha).
- **Aceitacao**: relatório com inventário das passivas (contagem modelada/não modelada/mal modelada), os deriváveis ordenados, os 8 cenários com os quatro números, e a build por nível com os pontos de viragem; nenhum peso inventado sem marca PRECISA DE REGRA DO DONO.
- **Estado**: pendente

### TK-02-107 | P0 | Simulador quebrado (`FOCO_MEDIDO is not defined`) e com texto a afirmar premissa falsa
- **Ficheiro(s)**: tools/sim-build.mjs
- **Evidencia**: parte-02.md:6934-6963 — `ReferenceError: FOCO_MEDIDO is not defined at tools/sim-build.mjs:422`; *“A correcção do foco=0 ficou a meio — e o texto da linha tem a premissa errada escrita nele: diz ‘inclui o CDR dos ATRIBUTOS medido ao vivo’, quando o teu Foco é ZERO e os 23,46% são todos do Ímpeto. O erro de sintaxe denunciou o erro de raciocínio. Se a linha tivesse corrido, o simulador teria continuado a afirmar como corrigido aquilo que era falso.”*; encaminhado `8b358d8a` com 4 pontos (arranjar o crash com texto correcto, correr e colar a saída real, recalcular Q5/Q6/Q7 com Foco = 0, responder à pergunta certa); resolvido em parte-02.md:7037 (`EXIT=0`, termina em `NAO VERIFICADO: nada`)
- **Fazer**: manter o simulador a correr sem crash e com o texto correcto (CDR dos atributos = 0, Foco 0; os 23,46% vêm do Ímpeto); rever se há outras linhas com premissas embutidas; o simulador tem de correr com exit 0 antes de qualquer conclusão ser citada.
- **Aceitacao**: `bun tools/sim-build.mjs` exit 0 e a saída separa as fontes do CDR (`cdr 23,5% = atrib 0,0% + itens 23,5%`); nenhuma linha de texto afirme como corrigido algo que não está provado.
- **Estado**: pendente

### TK-02-108 | P1 | Builds do motor não têm o Ímpeto que o dono tem; com `foco=0` só o Ímpeto `+3~A` ganha
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6847-6853 — *“O teu equipamento tem o Ímpeto. NENHUMA das três builds do motor tem. E o simulador diz o contrário do motor: Chefe — motor diz ...6653 (Liandry), simulador diz Ímpeto +227 dps (1 alvo); Mobs — motor diz ...6655 (Eco), simulador diz Liandry ganha com 4+ alvos; Barão — motor diz build AP com o 3153, simulador diz uma build AD/crítico faz 2,8× o DPS”*; e parte-02.md:7040-7089 com `foco = 0` medido: `A) Liandry 1341 · B) Ímpeto neutro 1267 · B3) Ímpeto +3~A (o teu) 1449` a armadura 104; *“Um Ímpeto NEUTRO perde para o Liandry em todas as armaduras. O TEU Ímpeto ganha em todas … O refino e a qualidade valem-te +182 de AP e +8,5 pontos de CDR sobre um Ímpeto normal”*; e *“é uma razão frágil: se aparecer um Liandry com melhor qualidade e refino, a conta pode virar. O que decide não é o item — é a peça concreta que tens.”*
- **Fazer**: fazer a escolha de build usar a **peça concreta** (qualidade e refino reais de cada candidato) e não o item base, e reconciliar as builds do motor com o simulador (mobs/chefe/Barão); o índice de itens tem de reflectir o que o dono tem.
- **Aceitacao**: `buildIdeal(mobs)` e `buildIdeal(chefe)` batem com a saída do simulador quando medidos contra o mesmo alvo, com as peças reais; teste com dois Ímpetos de qualidade diferente a dar builds diferentes.
- **Estado**: pendente

---

## Lote 18 — âncora `parte-02-lote-18` (leitura até parte-02.md:7550)

### TK-02-109 | P0 | O pen NÃO escala com qualidade/refino — o agente mandou escalá-lo e introduziu um bug
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:7431 e 7439-7446 — *“O pen NÃO é escalado por qualidade/refino: motor.js:251-255 reescala ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr e NÃO penMag; a dica MEDIDA do 3175~A diz ‘15% de penetração mágica’ (farm.json). Logo ‘17,25% com A’ está errado”*; e *“Confirmado … motor.js:254-255 ad*m, ap*m, … cdr*m ↑ penMag NÃO está na lista **O 3175~A dá 15% de pen, não 17,25%. E eu mandei o motor escalá-lo — introduzi um bug.**”*; confirmação pela medição em parte-02.md:7479 (*“a medição do dono de 0,55 = 0,40 (Vazio) + 0,15 confirma”*)
- **Fazer**: retirar a escala de qualidade/refino do `penMag` em todos os sítios onde foi introduzida (`efeitosEquipados`, `statsSet`, `parseSlotId`/`mult`, `valorEquip`/`valorVenda` se aplicarem) e deixar o pen como valor cru do catálogo; manter a escala para os campos que o motor escala (`motor.js:251-255`).
- **Aceitacao**: `3175~A` → pen 0,15 (não 0,1725) e `4629~A+3` → cdr 0,2346 (continua escalado); medição ao vivo a dar `pen 0,55` com a build do dono; `bun tools/testes/run.mjs` rc=0 com caso novo.
- **Estado**: pendente

### TK-02-110 | P1 | Conflito de escritores em `tools/sim-build.mjs` (dois subagents no mesmo ficheiro)
- **Ficheiro(s)**: tools/sim-build.mjs (um escritor de cada vez)
- **Evidencia**: parte-02.md:7427 — *“tools/sim-build.mjs está a ser editado por OUTRO escritor AGORA (mtime 2026-10-14T23:21:20Z, passou de 815 para 925 linhas … Eu tenho de estender o MESMO ficheiro. Para não perder trabalho de ninguém: vou ACRESCENTAR o meu bloco no FIM do ficheiro (depois da linha 925) com um âncora única e re-leio o ficheiro imediatamente antes de escrever. Se o outro escritor reescrever o ficheiro todo, o meu bloco perde-se — avisa quem estiver a escrever para NÃO substituir o ficheiro inteiro.”* (REGRA Nº 5)
- **Fazer**: nomear **um** escritor para `tools/sim-build.mjs` e fazê-lo fundir os blocos dos outros numa estrutura única (sem substituir o ficheiro inteiro); se dois precisarem de escrever, cada um acrescenta no fim com âncora e relê antes de escrever.
- **Aceitacao**: `bun tools/sim-build.mjs` exit 0 com uma estrutura só, sem blocos duplicados nem âncoras perdidas; relatório a dizer que houve escritor em paralelo.
- **Estado**: pendente

### TK-02-111 | P1 | Números do dono não saem do motor: `18,6%` da bota de CDR usa a base do Ímpeto; `17,25%` da bota de pen seria pen escalado
- **Ficheiro(s)**: docs/ (corrigir as tabelas) + extension/automation.js se os números entrarem
- **Evidencia**: parte-02.md:7500-7502 — *“OS TEUS NÚMEROS DA BOTA NÃO SAEM DO MOTOR — NAO VERIFICADO: 18,6% da bota de CDR: 0,15 × 1,24 (B, +2) = 0,186 -> essa conta usa a base 0,15, que é a do ÍMPETO; a bota 3158 tem base 0,08 (8% ~B, 12,51% +3~A, 18,50% +3~SS). 17,25% da bota de pen: 0,15 × 1,15 (A) = 0,1725 -> seria o penMag escalado pela qualidade; o motor não o escala (0,55 medido = 0,40+0,15).”*
- **Fazer**: corrigir todas as tabelas/relatórios que usam 18,6% e 17,25%, substituindo pelos números do motor (bota 3158 base 0,08; pen cru) e marcando NAO VERIFICADO onde não houver medição.
- **Aceitacao**: nenhum documento nem comentário de código a repetir 18,6% ou 17,25%; varredura a mostrar 0 ocorrências; cada número de bota com `file:linha` ou marca NAO VERIFICADO.
- **Estado**: pendente

### TK-02-112 | P1 | Conclusões invertidas com `foco=0`: o Liandry ganha ao Ímpeto ~B sempre; a bota de CDR ganha quando é `+3~A/SS`
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:7504-7509 e 7528-7538 — *“Com Foco 0 o resultado do 5.º espaço INVERTE face ao que estava calculado com 57,5: Foco 57,5 (errado): Ímpeto ~B ganhava ao Liandry por +94 dps no Dragão. Foco 0 (certo): o Liandry ganha ao Ímpeto ~B por +75 dps no Dragão, e ganha em TODA a faixa de armadura, em todos os N de alvos e em todos os uptimes. O Ímpeto só ganha quando é o +3~A do dono (+108 dps)”*; e a resposta nova da bota em parte-02.md:7509: *“a bota de pen só ganha à de CDR quando esta é ~B; com +3~A ou +3~SS a bota de CDR ganha na armadura 104 e ganha sempre nas armaduras 0-30 (porque o Ímpeto +3~A deixa 16,54 pontos de espaço antes do tecto, em vez de os desperdiçar como acontecia com a premissa errada dos 57,5)”*; uptime medida ~0,87 (parte-02.md:7468)
- **Fazer**: aplicar as conclusões corrigidas à build ideal e ao critério de escolha da bota, sempre com a **peça concreta** (qualidade/refino reais) e com o `foco` lido do painel (nunca deduzido).
- **Aceitacao**: build de mobs/chefe do dono recalculada com `foco=0` e peças reais, com a tabela Liandry vs Ímpeto (~B e +3~A) e pen vs CDR (~B, +3~A, +3~SS) contra cada um dos três chefes (sobrevive · segundos · poções · ouro).
- **Estado**: pendente

### TK-02-113 | P2 | `tools/sim-chefes.mjs` precisa de 3 correcções (Foco no CDR, `3036` +15% vs chefes, queima do Liandry sem mitigação)
- **Ficheiro(s)**: tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:7433 — *“secções novas no fim do sim-build.mjs (motor de DPS contra mob/chefe com os kits REAIS via import de tools/sim-chefes.mjs, corrigindo 3 coisas do sim-chefes: inclui o Foco no cdr, aplica o +15% do 3036 vs chefes (motor.js:1214) e a queima do Liandry sem mitigação (motor.js:1653))”*
- **Fazer**: aplicar as três correcções ao `sim-chefes.mjs` (ou ao motor de DPS que o estende), cada uma com `file:linha` do motor.
- **Aceitacao**: teste/saída a mostrar o Foco a entrar no CDR, o `3036` a dar +15% contra chefes e a queima do Liandry sem mitigação; `bun tools/sim-chefes.mjs` exit 0.
- **Estado**: pendente

---

## Lote 19 — âncora `parte-02-lote-19` (leitura até parte-02.md:8100)

### TK-02-114 | P0 | A penetração do KIT não entra na matemática de build (a E da Katarina penetra 20–44%)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:7856-7870 — `motor.js:560  Katarina E: { ..., pen: [0.2, 0.23, 0.26, 0.29, 0.32, 0.35, 0.38, 0.41, ...] }` (a E dela penetra 20% da armadura no rank 1, até ~44% no rank 10); e o motor da extensão lê a pen só dos itens: `automation.js:1472  const pen = k.penSuspiro != null ? k.penSuspiro : txt.penArmadura;` com a nota “do TEXTO DO ITEM”; *“A pen do KIT não é usada em lado nenhum … a matemática de build ignora que a tua E já penetra 20% — e por isso sobrevaloriza o Cajado do Vazio e todos os itens de pen”*; e *“afecta toda a decisão de build que envolva penetração — em qualquer campeão que tenha pen no kit”* (parte-02.md:7870)
- **Fazer**: incluir a penetração do kit (por rank, lida de `motor.js`) na matemática de build/DPS, somada à pen dos itens e limitada pelo tecto do jogo (`motor.js:529`); varrer todos os campeões com `pen` no kit.
- **CORRECÇÃO (parte-02.md:9625 e 9646-9652 e 9999)**: a pen citada é do **Darius** (`motor.js:560`); o E da Katarina (`motor.js:743`) **não** tem `pen` — há **um único** `pen:` em todo o game-src. **O motor já usa** a pen do kit do Darius (`motor.js:516 → 539 → 1202`): **não havia bug ali**. Quem ignora é a matemática de build (`statsSet`, `estimarSet`, `scoreSet`, `valorBuff`) e o `inject.js:113-115` não serializa o campo. Impacto: 1 de 7 campeões, 20%→45% = **+12,3% a +32,9%** de dano físico.
- **Aceitacao**: para a Katarina, o valor do Cajado do Vazio e dos itens de pen desce depois de a pen do kit entrar; número medido antes/depois; `bun tools/testes/run.mjs` rc=0 com caso novo por campeão com pen no kit.
- **Estado**: pendente

### TK-02-115 | P1 | Cofre/Fonte automáticos: plano feito, falta a viagem acontecer e o cofre ser lido ao vivo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8023-8100 — implementado: `cfg.cofreCadenciaMin: 10` no DEFAULT, `n.lerCofre` com cadência em vez de 600000 fixo, e `lerCofre` em `NECESSIDADES_PRIMARIAS` (é ela que paga a ida à Fonte de X em X minutos), portão `podeFazer(cofre)` (cofre → irBase → manutencao); verificado em banco (`faltandoNaBase = ["repor","tarefa","lerCofre","comprar"]`, controle com manutenção desligada) e ao vivo (`faltando: ["lerCofre", ...]`), mas `cofreItens: 0 · cofreAt: null` — ainda por ler; plano B (clicar a Tesoureira no canvas) adiado por decisão em parte-02.md:8066-8068 e 8094-8100 (*“Não construir agora … não sabemos se falha, porque nunca chegou a correr”*)
- **Fazer**: confirmar ao vivo que a rotina vai à Fonte e lê o cofre (marcador discriminante no log); só então decidir se o plano B (clique no canvas) é necessário; manter o motivo verdadeiro quando falhar.
- **Aceitacao**: `cofreItens > 0` (ou motivo verdadeiro no log) depois de a rotina correr; prova ao vivo com `lolidle:reload` + reload; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-116 | P1 | Cinco lacunas da matemática por fechar (pen do kit, Voracidade, Fonte, rv com/sem, barra a rodar)
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:7894-7922 — as cinco, ordenadas por impacto, encaminhadas a `8c293746`: 1) penetração do kit (`motor.js:560` vs `automation.js:1472`); 2) Voracidade — *“Está no motor.js:733/736/1789 … É dado do jogo, não politica. Pedi-te uma regra que devia ter modelado. Mandei modelar.”*; 3) Fonte automática para ler o cofre; 4) roubo de vida — *“O simulador corre a luta sem modelar o lifesteal. Se sobreviver depende dele, o resultado está errado. Mandei correr os três cenarios: sem rv, com o teu rv, e com a melhor build de rv”*; 5) rotação da barra — *“O modelo assume uma barra fixa; se a rotação muda o DPS, o erro tem de ser quantificado”*
- **Fazer**: fechar as cinco lacunas, cada uma com `file:linha` do motor e número antes/depois; a Voracidade e a pen do kit são **dados** (modelar, não perguntar).
- **Aceitacao**: as cinco fechadas ou com o número que falta nomeado; `bun tools/testes/run.mjs` rc=0; nenhuma delas a precisar de regra do dono que já esteja no motor.
- **Estado**: pendente

### TK-02-117 | P1 | Roubo de vida inato dos kits não medido (os bonecos já curam sozinhos?)
- **Ficheiro(s)**: docs/ (medição) + extension/automation.js se mudar o valor do `rv` de item
- **Evidencia**: parte-02.md:7882-7884 e 7914 — *“que tipo de roubo de vida cada boneco tem por padrão nas skills? Boa pergunta e não a medi. Vou verificar: se os kits já dão lifesteal, o de item vale menos — e é isso que explica os 0,02%”*; e *“é a pergunta certa e eu não a tinha feito. Mandei procurar cura/lifesteal nos kits. Se os bonecos já curam sozinhos, a resposta está aí”*; e a pergunta do dono em parte-02.md:7848 (*“e um barao que quase te mata com roubo de vida, nao te mataria sem roubo de vida?”* — resposta: sim, mataria, e o motor não testa isso)
- **Fazer**: medir a cura/lifesteal inato de cada kit (a Katarina tem `curaGiro`, `motor.js:755-756`) e o efeito do `rv` de item com e sem ele, em três cenários (sem rv, com o rv do dono, com a melhor build de rv) contra o Barão.
- **Aceitacao**: tabela com cura/s inata por campeão e hpMin com/sem rv de item contra o Barão; se a sobrevivência depende do rv, a build muda — e isso dito com número.
- **Estado**: pendente

### TK-02-118 | P2 | O modelo de build assume barra FIXA — não sabe que a rotação troca as skills
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:7890-7892 — *“A rotação está implementada (barraPorDisponibilidade), mas a matemática de build não sabe que ela roda — o modelo assume uma barra fixa. Também vou mandar verificar.”*; e parte-02.md:7912 (*“o modelo assume uma barra fixa; se a rotação muda o DPS, o erro tem de ser quantificado”*); ligação medida em parte-02.md:2905-2909 (barra top-4: Lich 152 → 250 dps)
- **Fazer**: quantificar o efeito da rotação no DPS/modelo e incluí-lo (ou declarar o erro) para a escolha de build não assentar numa barra que não é a que está em jogo.
- **Aceitacao**: número do efeito da rotação no DPS de cada build avaliada e decisão sobre incluí-lo; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-119 | P2 | O motor avalia item de chefe com régua de mob (`scoreSet` mede contra o Dragão, não contra o Barão)
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs
- **Evidencia**: parte-02.md:7971-7973 — *“Os dps que o motor dá (768 mobs vs 479 chefe) vêm do scoreSet — e ele mede contra o Dragão, não contra o Barão. O valor real do Rei Destruído contra o Barão (5% de 92 mil) não está nessa conta — por isso o número do chefe parece pior quando, contra o Barão, é melhor. É a mesma limitação que já identifiquei: o motor avalia um item de chefe com uma régua de mob.”*
- **Fazer**: fazer a build de chefe ser avaliada contra o chefe real (ou contra o pior chefe que se vai enfrentar), com os stats dele, para itens como o `3153` não serem subavaliados.
- **Aceitacao**: build de chefe calculada contra o Barão (ou o chefe alvo) dá ao `3153` o valor medido pelo simulador; comparação antes/depois no banco.
- **Estado**: pendente

---

## Lote 20 — âncora `parte-02-lote-20` (leitura até parte-02.md:8600)

### TK-02-120 | P0 | O motor não modela o `invocar` do Barão (2 larvas a cada 14 s, nível −6) — muda o valor do CDR e o dano em área
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8261-8312 — `motor.js:3066  MECANICAS = { Barão Nashor: invocar }` · `motor.js:3076  invocar: { carrega: 0, espera: 14, nome: Invocar Larvas }` · `motor.js:3117-3120  for (let k = 0; k < 2; k++) c.inimigos.push(criarMonstro(Larva do Vazio, Math.max(1, i.nivel - 6), { chegada: 1 + k*0.3, invocado: true }))` · `motor.js:290  Larva do Vazio: { hp: 1.1, ad: 1.05, as: 0.8, armadura: 1, xp: 1.1, ouro: 1, magico: true }`; tabela em parte-02.md:8275-8282 (spawn a cada 14 s, 2 por invocação, nível do Barão −6, coeficientes, sem coordenadas, determinístico); e parte-02.md:8286-8312 (*“a luta contra o Barão dura ~52 s. Isso são ~7 larvas … cada larva morta dispara a Voracidade: −1,5 s na Q, W e E … no Barão, a Katarina NÃO tem um abate só … A minha conclusão de ontem … está ERRADA”*; e *“O motor da extensão assume uma luta de 1 alvo”*); encaminhado em parte-02.md:8312 e 8369
- **Fazer**: modelar o `invocar` na avaliação de luta contra o Barão (spawn, nível, stats, abates → Voracidade, dano em área que as larvas levam, dano que te batem) e recalcular a escolha de build no Barão com as larvas dentro.
- **Aceitacao**: o modelo do Barão conta as larvas (4 invocações, ~8 larvas numa luta de ~52 s) e o valor do CDR de item desce em conformidade; build de chefe recalculada com número antes/depois; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-121 | P1 | O critério por luta está medido e provado — falta passá-lo ao motor (roubo de vida, poções, ouro)
- **Ficheiro(s)**: extension/automation.js (aplicar) — a medição está em docs/build-por-luta.md e nos simuladores
- **Evidencia**: parte-02.md:8372-8544 — medição real: Katarina nv35 contra o Barão: com rv `3172,3153,3031,3036,3046 → 35,15 s · 12 poções · 760 g` contra sem rv `3171,3135,3089,3100,4629 → 77,05 s · 62 poções · 6.500 g` (*“2,2× mais rápida e 8,5× mais barata”*); economia em parte-02.md:8448-8454 (sem rv no nv50: 62 poções = 4.960 g = 181% do loot → `PERDES OURO em cada abate`, líquido −103.558 g/h contra +349.805 g/h com rv); primeira nível que mata: com rv nv30, sem rv nv31; com rv → 0 poções no nv37, sem rv nunca; e a premissa refutada em parte-02.md:8415-8416 e 8482-8491 (*“a premissa do dono (item de rv custa dano) NÃO se verifica neste catálogo: o 3153 (10% rv) e o 3172 (6% rv) são dos MELHORES itens de DPS … O sinal é negativo: o rv é mais rápido e mais barato”*); estado real do dono em parte-02.md:8424 (Katarina nv29 vs Barão nv42: NÃO MATA, morre aos 8,45 s, rv 0%)
- **Fazer**: passar o critério da tupla (mata? · segundos · ouro em poções · ouro total) para o motor da extensão e fazê-lo escolher builds com roubo de vida quando o alvo mata ou quase mata, incluindo o ponto de viragem por nível.
- **Aceitacao**: a build de chefe do motor para a Katarina contém rv e o custo de poções desce para o medido (760 g em vez de 6.500 g no nv35); teste no banco com a tupla; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-122 | P1 | A build de chefe da Katarina tem de ser AD/auto-ataque — a build AP tem 0% de rv e cura 0/s
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8493-8513 — *“A MESMA % de roubo de vida vale 17 cura/s numa base de AP (auto = 171 dps) e 269 cura/s numa base de AD/VA (auto = 1.679 dps). O lifesteal só cura em AUTO-ATAQUES. Quem não bate autos não tem lifesteal nenhum — por isso a build de AP da Katarina tem 0 cura/s. E é por isso que o motor não o via: a build ideal dele é AP, e numa base AP o lifesteal vale zero”*; e *“A build de chefe da Katarina tem de ser AD/auto-ataque, não AP. A build que o motor recomenda (3175,3089,3135,3100,6653) tem 0% de rv e leva 146 s com 134 poções = 25.060 g. É a pior de todas.”*
- **Fazer**: deixar de restringir a build de chefe à classe do campeão (ver TK-02-82) e escolher pelo critério da tupla; a build de chefe da Katarina passa a ser AD/auto-ataque quando é a que sobrevive.
- **Aceitacao**: build de chefe da Katarina com rv > 0 e cura/s > 0, com o tempo e o custo medidos; comparação com a build AP no banco.
- **Estado**: pendente

### TK-02-123 | P1 | Busca exaustiva: a melhor build da Katarina é AD/crítico SEM CDR; mob e chefe são a mesma build
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8573-8596 — `S6 BUSCA EXAUSTIVA (33.915 builds legais = 7 botas x C(20,4), regras motor.js:29/2878/2879/2891)`: MOB Katarina nv29 → `2401 dps = 3172 Grevas Bélicas + 3031 Gume + 3036 Dominik + 3046 Dançarina + 3153 Rei (mata em 3,14s)`, a build do dono 1739 → +38,0%; CHEFE Katarina nv29 → a MESMA build (1375 dps, 71,14 s); Yasuo MOB `3172+3031+3046+3153+3078` e CHEFE `3172+3031+3036+3153+3078` (Dominik no chefe, +29,6%); *“TODAS têm cdr 0,00%. A melhor com bota de CDR 3171 fica em #7/#8/#8/#2”*; e parte-02.md:8585 (*“CDR: SIM, enquanto se joga na build de mago — 0% → 40% leva a Katarina de 1360 → 2063 dps no mob (+51,7%) … Mas a build ideal de todas tem 0% de CDR”*)
- **Fazer**: usar a busca exaustiva (com as regras do motor) como critério de build, e adoptar as conclusões: Katarina mob = chefe (AD/crítico sem CDR), Yasuo com Dançarina no farm e Dominik no chefe; o CDR só vale enquanto se joga na build de mago.
- **Aceitacao**: `buildIdeal` devolve a build da busca exaustiva para cada campeão/fase, com o DPS e o tempo medidos; teste no banco a comparar contra a busca; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-124 | P1 | `tools/sim-chefes.mjs` subestima o AD/crítico e o AP (3 correcções + 2 peças em falta)
- **Ficheiro(s)**: tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:8556 e 8582 — *“Também corrigi 3 coisas no sim-chefes DENTRO do meu motor: (a) sim-chefes.mjs:435 ignora o Foco no cdr; (b) motor.js:1214 o 3036 dá +15% vs chefes e o sim-chefes não aplica; (c) motor.js:1653 a queima do Liandry tira vida directa, sem mit() — o sim-chefes aplica mit(). Acrescentei ainda o Último Suspiro (pen, motor.js:706) e a Respiração do Vento (vaExtra) do Yasuo, que faltavam.”*; e parte-02.md:8582 (*“O sim-chefes SUBESTIMA o AD/crítico (não aplica o +15% do 3036) e o AP (aplica mit() na queima do Liandry)”*)
- **Fazer**: aplicar as três correcções e as duas peças em falta ao `sim-chefes.mjs` (se ainda não estiverem feitas noutro bloco), cada uma com `file:linha`.
- **Aceitacao**: saída do `sim-chefes.mjs` a bater com o motor corrigido (ex.: `IDEAL 2757 vs AP 993 = x2,78` reproduzido) e as três correcções provadas por caso.
- **Estado**: pendente

### TK-02-125 | P2 | `docs/sim-baron.md` cita números antigos (a luta agora cura com roubo de vida)
- **Ficheiro(s)**: docs/sim-baron.md
- **Evidencia**: parte-02.md:8430 e 8513 e 8544 — *“A Parte 2 do sim-chefes (analiseCompleta) mudou de números porque agora a luta cura com rv (ex.: Yasuo IDEAL passou de 52,55 s/41 poções para 43,3 s/28 poções no nv30) — docs/sim-baron.md cita os números antigos e precisa de refresh, mas não me era permitido escrever nesse ficheiro.”*
- **Fazer**: actualizar `docs/sim-baron.md` com os números novos (com rv) e manter a data/revisão do modelo em que cada tabela foi medida.
- **Aceitacao**: nenhum número antigo no documento; cada tabela com a revisão do simulador que a produziu.
- **Estado**: pendente

### TK-02-126 | P2 | Passiva D da Katarina (`motor.js:755-756`) e bases dos campeões não modeladas
- **Ficheiro(s)**: extension/automation.js, tools/sim-build.mjs, tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:8591 — NAO VERIFICADO declarado: *“Bases dos campeões (dados-katarina.js/dados-yasuo.js ausentes; erro AD -7,8 / AP -52,6 / vida +60,4 / arm -6 / RM -4 no nv29 do dono); ranks de habilidade fixos na busca; passiva D da Katarina (motor.js:755-756) não modelada”*; e parte-02.md:8559 (*“base dos campeões NAO VERIFICADA: dados-*.js ausentes”*)
- **Fazer**: trazer `dados-*.js` para o repo (ver TK-02-30) e modelar a passiva D da Katarina; enquanto as bases não existirem, manter a marca NAO VERIFICADO em todos os números que dependem delas.
- **Aceitacao**: bases lidas do jogo ou marcadas; passiva D modelada com `file:linha` e efeito medido no DPS.
- **Estado**: pendente

---

## Lote 21 — âncora `parte-02-lote-21` (leitura até parte-02.md:9150)

### TK-02-127 | P0 | Falta a magnitude do roubo de vida na pontuação (`cura/s = autoDps × rv`) — o `ad: 0` do perfil é a causa
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8712-8725 — feito: `readStats` passou a ler o Roubo de vida do painel e a **regex morta foi removida** (*“a auditoria do catálogo REAL (108 itens) deu ZERO acertos — era código morto que parecia tratar do assunto”*); NÃO feito: *“A magnitude do rv na pontuação (cura/s = dano_de_auto/s × rouboVida, motor.js:1226-1228) e o rv a valer ZERO numa build AP: é UMA só alteração de modelo — o termo de cura precisa do DANO DE AUTO-ATAQUE DA BUILD, e o poder(i) do montarBuildDe pontua item a item, sem essa noção”*; e parte-02.md:8980 e 9059-9061 (*“para a Katarina, o mesmo bloqueio do ponto 1 (perfil ad: 0) faria o rv continuar a valer ~0 mesmo com a fórmula certa”*); número em parte-02.md:8809-8811 (`cura/s = dano_de_AUTO_ATAQUE/s × rouboVida`; 17 cura/s em AP vs 269 em AD — 16× mais)
- **Fazer**: implementar o termo de cura por `cura/s = autoDps × rv` (`motor.js:1226-1228`) usando o dano de auto-ataque da build (o `det.autoCura`/`curaRV` que o simulador já expõe), e fazê-lo depender do peso do AD do perfil (ver TK-02-128).
- **Aceitacao**: a mesma % de rv dá valores diferentes por base (17 cura/s em AP vs 269 em AD) e a build de chefe passa a escolher itens com rv quando a cura decide a sobrevivência; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-128 | P1 | O bloqueio da build AD é o perfil `pesosItem(mago).ad = 0` — e isso contradiz o kit da Katarina
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:8971-8980 — medição com 0,12 / 0,75 / 1,0 de `multClasse`: `katarina mobs = 3175,3089,3135,3100,6655` e `chefe = 3175,3153,3135,3089,6653` **IGUAIS nos três**; *“CONCLUSÃO: a penalização de classe NÃO é o bloqueio da build AD da Katarina. Mesmo com 1.0 (sem penalização nenhuma) ela continua AP. O bloqueio é o PERFIL: pesosItem(mago) tem ad: 0 — o AD de um item AD vale ZERO pontos para ela, logo o 3172/3153/3031/3036/3046 não têm como somar.”*; e o kit contradiz em parte-02.md:9092-9099 — `giroSrc: (nivel, a) => 30 + 19*nivel + 1*apDe(a) + 0.4*Math.max(0, a.ad - a.baseAd)` e `E: { ..., adRatio }` (*“O kit diz que ela escala com AD. O perfil diz que vale zero. O perfil está a mentir sobre o kit — ela é magia: true, mas híbrida”*); encaminhado `d0c50b60` com controlo (o Lux não pode passar a valorizar AD, o Yasuo não pode mudar)
- **Fazer**: fazer o peso do AD sair do **kit** (fórmula do giro `0,4 × AD` e `adRatio` da E) e não da etiqueta de classe; com controlo para magos puros (Lux) e para o Yasuo.
- **Aceitacao**: com o peso do AD vindo do kit, a Katarina passa a poder somar itens AD (build exaustiva disponível) e o Lux/Yasuo ficam iguais; `bun tools/testes/run.mjs` rc=0 com casos de controle.
- **Estado**: pendente

### TK-02-129 | P1 | Recomendação e equipamento têm de concordar — a escala da peça real foi revertida no equipamento
- **Ficheiro(s)**: extension/automation.js, tools/testes/ (E5)
- **Evidencia**: parte-02.md:8984 e 9027-9031 — *“a escala da peça REAL dentro do montarBuildDe mudava as decisões de EQUIPAMENTO (E5) — REVERTIDA para mm = 1 (comportamento anterior), com o mapa das peças reais montado e o comentário a dizer o que falta reconciliar. Não deixei vermelho.”*; e *“a correcção que eu mandei (comparar peças reais) está activa na recomendação de build, mas foi revertida no equipamento — porque mexia no E5 e ele não quis deixar vermelho. É a decisão certa da parte dele — e é trabalho por fazer: o equipamento e a recomendação têm de concordar”*; pedido em parte-02.md:9106 (*“se o motor recomenda o teu Ímpeto +3~A, o equipamento tem de o preferir também — e se o E5 falhar, ler o E5 e ver se a expectativa é que está errada”*)
- **Fazer**: reconciliar o equipamento com a recomendação (usar as peças reais nos dois) e, se o E5 falhar, ler o teste e decidir se a **expectativa** do teste é que está errada (REGRA Nº 6) — nunca deixar revertido em silêncio.
- **Aceitacao**: recomendação e equipamento escolhem a mesma peça para o mesmo slot; E5 verde por actualização da expectativa (nomeada no relatório) e não por reversão; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-130 | P0 | Full audit da Katarina NÃO feito — a passiva D (`curaGiro`) não está modelada e muda a sobrevivência
- **Ficheiro(s)**: extension/automation.js, tools/sim-chefes.mjs, tools/sim-build.mjs
- **Evidencia**: parte-02.md:8893-8952 — *“O que já está auditado dela: cooldowns por rank · a E com pen: [0.2, 0.23, …] · a Voracidade (1,5 s/abate, 5 s/chefe) · o giro (30 + 19×nivel + 1×ap + 0,4×max(0, ad−adBase)) · os ranks (Q10+W1+E3+R3) · os atributos”*; e o que NÃO está: `P: {}` (passiva vazia no kit serializado) · `D: { vaAdaga, acumMax, duracaoSinistra, curaGiro, passiva }` (NÃO MODELADA) · `E: { ..., adRatio }` · `adagas: true` · `ordem: [N, R, B, M, E, A, G, F, T, Q, W]` (13 habilidades); *“A D é a passiva dela — Lâmina Sinistra … e tem curaGiro. Se ela cura enquanto gira, isso entra directamente na sobrevivência e no gasto de poções. E não está modelado”*; e *“a conta que te dei — 35 s com 12 poções com lifesteal, 77 s com 62 sem — pode estar errada, porque falta uma fonte de cura que a personagem tem por si”*; audit lançado em `0952eed4` com 6 pontos (13 habilidades uma a uma; P e D com a curaGiro quantificada; adagas; tabela de modelagem; efeito no combate; quais das 13 ela usa)
- **Fazer**: fazer o audit completo da Katarina e modelar a passiva D (`curaGiro`: quanto cura por giro, quantos giros por luta), a `P`, o `adRatio` da E e a mecânica das adagas; recalcular a luta contra o Barão com a cura do kit dentro.
- **Aceitacao**: tabela habilidade-a-habilidade (a extensão modela? onde? impacto? o que deve mudar), a curaGiro quantificada e dentro da luta, e as contas de poções/segundos refeitas com ela.
- **Estado**: pendente

### TK-02-131 | P2 | Frota de 8 frentes para “tudo observável, tudo calculável, nada surpresa”
- **Ficheiro(s)**: tools/ e docs/ (um ficheiro por frente, sem sobreposição)
- **Evidencia**: parte-02.md:8672 — dono: *“NADA, LITERALMENTE NADA, ERA PRA SER SURPRESA OU INESPERADO, JA QUE TU PODE VER O CODIGO DO JOGO TU MESMO, E CALCULAR AS COISAS TU MESMO. agora faz TUDO ser observavel, TUDO ser calculavel, e NADA ser surpresa pra gente.”*; frentes em parte-02.md:8954-8967 e 9115-9127: `0952eed4` full audit da Katarina · `4a4f9247` linha do tempo da luta (cada evento com timestamp: autos, skills, mecânicas do chefe, nascimento e morte de cada larva, cada abate → Voracidade, cada poção, cada proc) · `c69fe7ac` troca de itens em combate (se é possível, o custo, o gatilho com as larvas, a política óptima com números) · `2ea9fdbc` observabilidade (o que o motor deveria ver vs o que vê, lacuna a lacuna, com impacto) · `d85a212f` calculadora do jogo (todas as fórmulas do motor.js extraídas e validadas — nada copiado à mão) · `cc2e6cb7` as larvas do Barão · `f3630efe` audit do jogo: mecânicas vs matemática (tabela MECÂNICA DO JOGO | A EXTENSÃO MODELA? | ONDE | IMPACTO | O QUE DEVE MUDAR, ordenada por impacto) · `8c293746` as 5 lacunas
- **Fazer**: coordenar as oito frentes com ficheiros disjuntos e juntar os resultados num único plano de correcção ordenado por impacto; nenhuma conclusão sem `file:linha` e nenhum peso inventado (marcar PRECISA DE REGRA DO DONO).
- **Aceitacao**: cada frente entregue com ficheiro próprio e sem colidir; plano final com a tabela mecânica→modelagem→impacto e as correcções ordenadas.
- **Estado**: pendente

### TK-02-132 | P1 | Decisão registada: o motor deve recomendar (e equipar) a build AD/crítico na Katarina, dizendo o que falta e quanto custa
- **Ficheiro(s)**: extension/automation.js (aplicar) · extension/gui.js (mostrar)
- **Evidencia**: parte-02.md:8825-8882 — dono: *“tu ja deve saber se sim ou se nao … me responde tu, me da TODAS as respostas do por que sim, ou do por que nao”*; resposta medida: *“SIM — o motor deve recomendar a build AD. Mas com duas obrigações: 1. Remover o multClasse = 0.12 — porque ele não decide nada, só impede … 2. Dizer O QUE FALTA E QUANTO CUSTA. Se a build óptima exige 4 lendários que não caem para ti, o motor tem de dizer isso — não basta recomendar.”*; e a regra: *“o motor compara o que tu tens e o que podes ter — equipado, mochila, e mercado. Se os itens existem, a build AD ganha. Se não existem, a melhor AP. O que não pode é escolher AP sem nunca olhar para o AD.”*; os senões em parte-02.md:8864-8870 (os drops da Katarina são AP — `motor.js:1152`; os itens AD têm de vir do mercado, e são 4 lendários)
- **Fazer**: implementar a comparação de classes na recomendação (com o preço/estado do que falta: equipado, mochila, mercado) e mostrar na GUI a build óptima com a lista do que falta e o custo estimado.
- **Aceitacao**: o motor recomenda a build AD quando ela ganha (com o número) e diz quais os itens em falta e de onde vêm (drop/mercado/preço); controle: sem os itens, propõe a melhor AP com o porquê.
- **Estado**: pendente

### TK-02-133 | P2 | Bug de ordem de declaração (`pesoClasseOposta()` chamado antes de definido) deixou o banco vermelho
- **Ficheiro(s)**: extension/automation.js, tools/testes/
- **Evidencia**: parte-02.md:8983 — *“chamei pesoClasseOposta() sem a definir -> ReferenceError -> o caminho do equipamento rebentou e o banco ficou VERMELHO (E5). Definida; banco verde.”*
- **Fazer**: evitar a repetição — nenhuma função usada antes da sua definição (ou usar declarações de função, que são elevadas) e uma verificação que corra o caminho do equipamento no banco para qualquer função nova usada nesse caminho.
- **Aceitacao**: suite que exercita o caminho do equipamento a falhar se uma função ficar por definir; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

---

## Lote 22 — âncora `parte-02-lote-22` (leitura até parte-02.md:9700)

### TK-02-134 | P1 | Bug irmão: o `3036` (pen de ARMADURA) está arquivado como `penMag` — dano mágico falso de +13% a +19,6%
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9626 e 9654-9662 — *“BUG IRMÃO (este atinge a Katarina): automation.js:3251 arquiva o ‘30% de penetração de armadura’ do 3036 como penMag → para campeões de magia o modelo aplica 30% de pen MÁGICA que o motor não dá (motor.js:529 não tem termo do 3036) → +13,0% (arm 104) a +19,6% (arm 200) de dano mágico falso. O 3036 está na build IDEAL dela.”*; e *“Para campeões de magia, o modelo aplica 30% de pen MÁGICA que o motor não dá … O motor está a inflacionar a build que recomenda.”*; correcção pedida em parte-02.md:9641 (*“Corrigir o statsSet para separar pen de armadura (3036) de pen mágica (3135/3175) — automation.js:3248-3251”*)
- **Fazer**: separar pen de armadura de pen mágica no `statsSet` (`automation.js:3248-3251`), para que o `3036` só entre na penetração de armadura (ramo físico, `motor.js:516→539→1202`) e nunca como pen mágica (`motor.js:529`).
- **Aceitacao**: com o `3036` na build, o dano mágico deixa de ter os +13% a +19,6% falsos; número antes/depois contra armadura 104 e 200; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-135 | P1 | `docs/sim-baron.md` `5-`7 foi gerado SEM rv e com atributos que não são os do dono
- **Ficheiro(s)**: docs/sim-baron.md (+ tools/sim-chefes.mjs se a atribuição for parâmetro)
- **Evidencia**: parte-02.md:9610-9616 — *“docs/sim-baron.md `5-`7 foi gerado SEM rv — prova: a coluna ‘sem poção: morre aos 8,0 s’ = a corrida sem rv (7,95 s) contra 9,95 s com rv; as 56 poções do doc = 56 sem rv vs 52 com rv. E o erro que decide é a ATRIBUIÇÃO: o doc corre com distribuirAtributos (Força 35·Vit 17·Foco 35, hp 4377), não com o painel medido do dono (atribDono, Força 84·Vit 3·Foco 0, hp 4097).”*; números em parte-02.md:9612-9615 (SEM rv → morre aos 54,7 s, 43 poções, 6.440 g; COM rv → mata em 67,85 s, 53 poções, 7.360 g; a build do dono tem rv 0 nos 5 itens e só mata a partir do nv32); e parte-02.md:9697 (*“As 56 poções que eu te dei são 52 — e o ‘morre aos 8 s’ é a corrida sem rv”*); correcção pedida em parte-02.md:9639 (*“Regenerar docs/sim-baron.md `5-`7 com o simulador de hoje e declarar a atribuição usada”*)
- **Fazer**: regenerar `docs/sim-baron.md` `5-`7 com o simulador actual, com rv modelado e com os atributos medidos do dono, declarando em cada tabela a atribuição usada (painel medido vs modelo).
- **Aceitacao**: nenhum número antigo no documento; cada tabela diz se usa os atributos medidos ou um modelo, e se o rv está ligado; os valores de poções e tempo conferidos contra o simulador.
- **Estado**: pendente

### TK-02-136 | P1 | Voracidade: modelar com killsMin lido ao vivo (mobs 33,7–45,5% de CDR efectivo; chefe 0%)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9622 — *“motor.js:736 (voracidade 1.5, voracidadeChefe 5) + motor.js:1789 (por abate, Q/W/E, max(0, recarga-1.5)). CDR efectivo = 1,5/(T+1,5) → 33,7% (N=20,3) a 45,5% (N=33,4). N MEDIDO: farm.json perMin.kills 29,4-33,4; ciclos.json ritmo.killsMin 20,3-21,2. Katarina Q10: 6,85 s → 5,24 s (cdr 23,5%) → 3,43 s (+53,0% casts/s). DPS total com a build do dono (mobs): 588 → 983 (+67,2%). CONTRA O CHEFE É 0%: motor.js:1121 dá 1 monstro por onda, logo o −5 s dispara no golpe que MATA (fim da luta); só as larvas contam (motor.js:3076,3118: 2 por 32 s = 3,75/min → 9,4% equivalente). A hipótese do dono NÃO se confirma: a voracidade multiplica a recarga, logo o ganho relativo do CDR de item é 1/(1-cdr) nos dois cenários.”*; e parte-02.md:9664-9677 (*“A minha correcção de ontem estava errada nos dois sentidos”*); correcção pedida em parte-02.md:9642 (*“Pôr a voracidade no modelo de DPS de mobs com o killsMin lido ao vivo (só Q/W/E; factor 1 no chefe)”*)
- **Fazer**: modelar a Voracidade no DPS de mobs com o `killsMin` lido ao vivo (a extensão já o mede — `automation.js:637,641-648,5754`), só para Q/W/E, com factor 1 no chefe; usar isso para avaliar o valor do CDR de item.
- **Aceitacao**: DPS de mobs com a Voracidade dentro (588 → 983 na build do dono) e o valor do CDR de item correcto por fase; `bun tools/testes/run.mjs` rc=0 com caso novo.
- **Estado**: pendente

### TK-02-137 | P1 | Os simuladores usam barra FIXA e deitam fora o W (−15,2%) — a extensão soma o arsenal inteiro (+2,8%)
- **Ficheiro(s)**: tools/sim-chefes.mjs, tools/sim-build.mjs
- **Evidencia**: parte-02.md:9618-9619 — *“estimarSet/dpsPorHabilidade somam o arsenal inteiro (automation.js:3273-3295,1386-1420); o motor só lança 4 (motor.js:900,1578,1593); sim-build.mjs:408-412 e sim-chefes.mjs:485-492 usam barra FIXA. Com o arsenal MEDIDO (docs/snapshots/skills.json: Q10 W1 E3 R3 G1 A5 F1, barra real W/Q/R/A): barra real 840 dps de habilidade vs arsenal 864 = +2,8%; mas a barra que o SIMULADOR escolhe (R/Q/A/E) = 712 → −15,2%, porque sim-chefes.mjs:490 ordena sem o giro da Voracidade (que só entra em :597) e deita fora o W. Tecto aos nv40/45/50: +19,7% / +25,5% / +27,5%.”*; correcção pedida em parte-02.md:9640 (*“Corrigir sim-chefes.mjs:485-492 para ordenar a barra COM o giro (regra que a extensão já usa, automation.js:1410)”*)
- **Fazer**: corrigir a escolha de barra nos simuladores para incluir o giro/Voracidade e não deitar fora o W; alinhar os dois modelos (extensão e simuladores) na mesma noção de barra.
- **Aceitacao**: a barra escolhida pelo simulador bate com a barra real medida (840 dps) e não com a que deita fora o W (712); teste a comparar as duas ordenações.
- **Estado**: pendente

### TK-02-138 | P1 | Nenhum kit tem rv nas skills — o caminho genérico é código morto; as curas são % de vida
- **Ficheiro(s)**: extension/automation.js, tools/sim-chefes.mjs
- **Evidencia**: parte-02.md:9628-9630 — *“O único caminho genérico de rv de skill do motor (motor.js:1231, alimentado por acoesComuns.F motor.js:1823-1827) é CÓDIGO MORTO: os 7 campeões sobrepõem o F (1870/1987/2109/2265/2334/2551/2608) e d.furiaRoubo só é escrito a 0 (1057/1873) — o roubo: serie(0.12,0.03) de motor.js:572 nunca dispara. As curas dos kits são % da vida máxima/falta (Darius Q 13%/inimigo até 3, F 1-1,9%/auto, N 4%/abate; Katarina giro 13-22% + Sede 30%; Taric Q/B 1,2-2,55%maxHP/s/N 25%; Zac gosmas/B 15-28,5%/N 4%/alvo; Lux F 8-15,2%+40%AP; Yasuo e Ezreal NÃO curam). A resposta verdadeira: o rv de item cura só o auto-ataque (motor.js:1226), e na build do dono o auto é 6,1% do dano (36 de 588 dps) → 15% de rv = 0,9% do dano em cura. Na build de auto-ataque o auto é 90,3% → os mesmos 16% curam 208-396/s.”*
- **Fazer**: modelar as curas dos kits (% de vida máxima/falta, por campeão) nas avaliações de luta, e manter o rv de item só sobre o dano de auto-ataque (`motor.js:1226`); alcance a definir com o dono (ver DECISÕES).
- **Aceitacao**: cura/s por kit dentro da luta (Katarina: giro 13-22% + Sede 30%) e o rv de item calculado sobre a fracção de auto-ataque da build; números antes/depois.
- **Estado**: pendente

### TK-02-139 | P2 | O rácio AD/AP é analítico e está no motor, skill a skill — a build AD ganha pelos autos, não pelo giro
- **Ficheiro(s)**: extension/automation.js (pesos) — aderência ao que o kit diz
- **Evidencia**: parte-02.md:9557-9589 — quadro lido do motor: `P: giro: 30 + 19*nivel + 1*apDe(a) + 0.4*Math.max(0, a.ad - a.baseAd)` (1 AP = +1,00; 1 AD = +0,40) · `Q: dano: base + ratio*apDe(a)` (SÓ AP) · `E: dano: base + ratio*apDe(a) + 0.4*a.ad` (AP e AD) · `R` e `G: SÓ AP; e a conclusão: *“O AD da Katarina vale por três caminhos: o giro (0,40×), a E (1,33×) e — o maior de todos — os auto-ataques … Os 2.401 dps contra 1.739 não vêm dos 0,4 do giro: vêm do crítico em auto-ataque e dos 5% da vida do Rei Destruído.”*; e parte-02.md:9550-9555 (*“‘não está no motor’ é um alarme, não uma resposta”*)
- **Fazer**: derivar o peso do AD do kit (média ponderada pelas frequências/recargas) em vez de o fixar por perfil, e construir o termo do rv sobre o dano de auto-ataque (com crítico), como `motor.js:1226` diz.
- **Aceitacao**: peso do AD derivado do kit com `file:linha` por fonte (giro/E/Q/R/G/autos) e controle de que magos puros (Lux) continuam com delta_ad ~0.
- **Estado**: pendente

### TK-02-140 | P2 | Medição do ratio AD/AP inválida (fixture não isolou) — usar `tools/medir-peso-ad.mjs` com controlos
- **Ficheiro(s)**: tools/medir-peso-ad.mjs (novo)
- **Evidencia**: parte-02.md:9289-9543 — tentativa: Katarina (hibrida) dps base=654, +1 AD = 0.60, +1 AP = 0.40, ratio 1.500; Yasuo (AD puro) e Lux (mago puro) **IGUAIS**; *“OS TRÊS IGUAIS => A MEDIÇÃO É INVÁLIDA: o meu fixture (kits/magia via alimentarMeta) NÃO isolou os campeões … NÃO uses estes números: são artefacto do fixture, não medida.”*; e o caminho autorizado com três controlos em parte-02.md:9533-9541 (LUX: delta_ad tem de ser ~0; YASUO: delta_ap tem de ser ~0; KATARINA: os dois não-nulos, ratio INTERMÉDIO — *“Se os controlos falharem, a medição não é reportada como resultado”*)
- **Fazer**: criar `tools/medir-peso-ad.mjs` (ou exportar `medirDeltas(champId)` do simulador) e correr a medição com os três controlos; se os controles falharem, não reportar o número.
- **Aceitacao**: medição com controlos a passar (Lux delta_ad ~0, Yasuo delta_ap ~0, Katarina intermédio) ou conclusão explícita de que a medição não é possível e porquê.
- **Estado**: pendente

### TK-02-141 | P3 | `AGENTS.md` criado com as 6 regras (pesquisa full, dado vs política, números lidos, marcador, um escritor, verde não é prova)
- **Ficheiro(s)**: AGENTS.md (manter) · docs/ (registar as provas novas)
- **Evidencia**: parte-02.md:9282-9286 — dono: *“anota no agents.md pra tu parar de ser burro e sempre fazer pesquisa FULL”*; criado em parte-02.md:9502-9515 (*“REGRA Nº 1 — PESQUISA FULL, SEMPRE, ANTES DE FALAR … número vindo de resumo da extensão → suspeito até ser confirmado na fonte … ler a LISTA, não o valor (o motor.js:254 escala 11 campos e não o penMag)”*); e o efeito imediato em parte-02.md:9517-9529 (o subagent recusou usar uma medição inválida)
- **Fazer**: manter o AGENTS.md como documento vivo e acrescentar as provas novas que apareceram depois (o `3036` arquivado como penMag, a Voracidade, as larvas, o ratio AD/AP analítico).
- **Aceitacao**: AGENTS.md com as provas actuais e data; nenhuma regra sem uma prova que a originou.
- **Estado**: pendente

---

## Lote 23 — âncora `parte-02-lote-23` (leitura até parte-02.md:10250 e fim do histórico)

### TK-02-142 | P1 | `player()` continua a não devolver o `rv` — o valor é lido do painel e deitado fora
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9868 — *“A regex era código morto (0 acertos em 108 itens) e o readStats não lia o rv do painel. O OUTRO AGENTE JÁ CORRIGIU METADE durante a auditoria: removeu a regex (automation.js:4125) e pôs ‘Roubo de vida’ no readStats (1225) — MAS o player() continua a NÃO devolver rv (automation.js:1239): o valor é lido do painel e deitado fora.”*; confirmado em parte-02.md:9902 e 9982 (*“E o rv continua a ser lido e deitado fora”*)
- **Fazer**: fazer o `player()` devolver o `rv` lido do painel e ligá-lo ao cálculo de cura (`motor.js:1226-1228`).
- **Aceitacao**: `player().rv` devolve o valor do painel ao vivo (marcador discriminante) e a cura/s passa a usá-lo; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-143 | P1 | Peso do roubo de vida: hoje vale 0,038% do valor do Rabadon — o motor usa-o para sobreviver
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9868 — *“FALTA isso + subir o peso. Valor hoje: 0,038% do valor do Rabadon (0,12 contra 315). Valor no motor: 87 poções / 9 570 de ouro no nv20; o Yasuo com rv 18% chega a 0 poções no nv38.”*
- **Fazer**: subir o peso do `rv` para reflectir a cura medida (por `cura/s = dpsAtaque × rv`, `motor.js:1226-1228`), depois de TK-02-142.
- **Aceitacao**: o valor do rv na pontuação sobe para a ordem de grandeza da cura que ele produz (número antes/depois) e a build de chefe passa a escolher itens com rv quando a cura decide.
- **Estado**: pendente

### TK-02-144 | P1 | As 13 passivas de estado medidas em HP/s evitado — Rylai vale −129 HP/s e a extensão dá-lhe 0
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9869 — *“(c) AS 13 PASSIVAS DE ESTADO — modelei todas em HP/s de dano recebido evitado (não pedi peso). Rylai 3116 = −129 HP/s (mais que Banshee −27, Zhonya −11,2 e Anjo −7,6 SOMADOS) e a extensão dá-lhe 0. Luden 6655 = 102 dps em 3 alvos contra 34 dps em 1 alvo. Só fica UM pedido de regra: a taxa de troca SEGUNDOS↔OURO.”*
- **Fazer**: implementar o valor das passivas de estado em HP/s de dano evitado (ou dps por número de alvos), usando a medida da auditoria; nenhum peso inventado.
- **Aceitacao**: Rylai e Luden com valor diferente de 0 na pontuação, justificado pela medida; as 13 passivas cobertas; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-145 | P1 | Divergência montarBuildDe vs simulador: 484 vs 1196 dps (Katarina), 2102 vs 6269 (Yasuo) — o simulador está certo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9870 — *“(d) AS TRÊS DIVERGÊNCIAS — Katarina nv29 vs Barão: montarBuildDe 484 dps vs simulador 1 196 dps (×2,47), listas sem um único item em comum. Yasuo nv45: 2 102 vs 6 269 (×2,98) e a diferença é 37,7 s / 1 170 de ouro. Quem está certo é SEMPRE o simulador. O scoreSet é o pior dos três: o statsSet não soma ad, va nem critico em ramo nenhum.”*; refeito em parte-02.md:9946-9956
- **Fazer**: substituir o modelo de build do motor pelo do simulador (ou fazê-lo validar contra ele), e corrigir o `statsSet` para somar `ad`, `va` e `critico`.
- **Aceitacao**: a build do motor passa a bater com a do simulador (ou a divergência explicada com `file:linha`); teste no banco a comparar os dois modelos; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-146 | P2 | `montarBuildDe` nunca lê o nível — a lista é idêntica do nv1 ao nv50
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9876 e 9960-9968 — *“montarBuildDe NUNCA lê o nível: a lista é IDÊNTICA do nv1 ao nv50. O que muda é sobrevive/segundos/poções: Katarina queima 21 210 de ouro em poções no nv30 e 3 810 no nv38; Yasuo chega a 0 poções no nv38 (a cura 334/s excede o dano recebido 229/s).”*; e *“É exactamente o que disseste: ‘as poções ficam caras por ser muito uso, a build ideal muda de novo’”*
- **Fazer**: fazer a build ideal depender do nível (com o critério do dono: sobrevive · segundos · poções · ouro), incluindo o ponto em que o roubo de vida passa a valer.
- **Aceitacao**: a build muda em níveis diferentes, com o número que a muda (poções/ouro/segundos) e o critério do dono impresso; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-147 | P1 | Oito números já errados: 6 itens do catálogo remendado + o `tierDe` 10× errado
- **Ficheiro(s)**: extension/automation.js, extension/inject.js
- **Evidencia**: parte-02.md:9861 e 9896 — *“JÁ ERRADAS HOJE (classe c): 6 itens do catálogo remendado (inject.js:161 manda I.ITENS_DADOS cru; o motor remenda 2022/1006/3057/3108/3802/4629 em motor.js:16-26 — a extensão recebe cdr/regen/efeito AUSENTES) + o tierDe (qIdx×10+refino diz que 1 qualidade = 10 refinos; motor.js:252 diz 1 degrau B→A ≈ 1,25 refinos — está 10× maior).”*
- **Fazer**: passar a usar o catálogo já remendado pelo motor (em vez de `I.ITENS_DADOS` cru) e corrigir o `tierDe` para a fórmula do motor (`motor.js:252`).
- **Aceitacao**: os 6 itens vêm com cdr/regen/efeito do motor, e o `tierDe` dá 1 qualidade ≈ 1,25 refinos; testes a cobrir os dois.
- **Estado**: pendente

### TK-02-148 | P1 | Voracidade: recarga efectiva 0,74 s vs 5,24 s (erro 7,1×) e as larvas também cortam 1,5 s
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:9867 e 9900 — *“CDR-médio da Voracidade vs o CDR de item (23,46%): 50% no farm (20 abates/min) · 20,1% na onda do Barão · 15,8% no Dragão · 19,2% no Arauto · 13,8%-29,0% no Barão … Na Q, a recarga efectiva com 3 abates é 0,74 s contra os 5,24 s que a extensão calcula → subestima a taxa de lançamento em 7,1×. CORRECÇÃO IMPORTANTE que apanhou depois (a regra ‘ler a LISTA’): o Barão invoca 2 larvas por ciclo de 34,3 s (motor.js:3080/3118) e o corte da Voracidade (motor.js:1789) NÃO tem guarda i.invocado — cada larva também corta 1,5 s. A minha primeira leitura dizia 5% contra o chefe; é falso para o Barão.”*; e *“O teu instinto sobre as larvas estava certo”* (parte-02.md:9944)
- **Fazer**: modelar a Voracidade com o número de abates (larvas incluídas, sem guarda `i.invocado`) e usar a recarga efectiva em vez da recarga crua (`automation.js:1403, 3280`).
- **Aceitacao**: recarga da Q com 3 abates = 0,74 s (e não 5,24 s); DPS de habilidades corrigido; teste a cobrir larvas como abates.
- **Estado**: pendente

### TK-02-149 | P1 | Darius: Hemorragia não modelada (+358 AD no nv50, DOT 198/s) e pen do kit descartada
- **Ficheiro(s)**: extension/automation.js, extension/inject.js
- **Evidencia**: parte-02.md:10246-10247 — *“Darius: Hemorragia não modelada de todo. motor.js:1631 danoSangue=(13+0,3*bonusAd+4*nivel)/5 por acúmulo/s (5 acúmulos) + motor.js:1276-1281/1329/1332 bonusPoder(nivel)=30+200*(min(n,18)-1)/17+4*max(0,n-18) → +358 AD no nível 50 (um Darius de 300 AD passa a 658 = x2,19) por 5 s ao chegar a 5 acúmulos. Contas: DOT = 125/s (nv30), 161/s (nv40), 198/s (nv50) depois de armadura+pen. Zero referências em automation.js.”*; e *“Pen de armadura do KIT (Darius E 20%→45%, motor.js:560). inject.js:113-115 descarta o campo pen; buffDoTexto (automation.js:1454) só lê /ignoram X% da armadura/ e a E diz ‘Dá penetração de armadura (passiva)’ (motor.js:561). Prova: mit 0,4098 → 0,5580 vs Barão (armadura 144) = +36,2% de dano”*
- **Fazer**: serializar o campo `pen` do kit no `inject.js`, usar a pen de armadura do kit na mitigação física e modelar a Hemorragia do Darius (dano por acúmulo e o `bonusPoder`).
- **Aceitacao**: Darius com pen do kit dá +36,2% contra o Barão e a Hemorragia entra no DPS (DOT 125/161/198/s por nível); testes novos.
- **Estado**: pendente

### TK-02-150 | P1 | Pen mágica usada como pen de ARMADURA em campeão AD, e escudos fora da vida efectiva
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:10248 e 10250 — *“Pen MÁGICA usada como pen de ARMADURA em campeão AD (ao contrário): automation.js:3235/3243 soma pen += it.penMag, e 3285/5398 usam-no em armadura*(1-pen). O 3036 não tem penMag (verificado). Muda a escolha de itens em todos os AD.”*; e *“Escudos fora da vida efectiva (avaliar só usa player.vida, automation.js:1657-1679): Fluxo do Yasuo = 80+28*nível = 1.480 no nv50 (+37% de vida), Taric F 1.200, Zac G 800, 3053 ~1.000, 3157/3026.”*
- **Fazer**: separar pen mágica de pen de armadura em todos os sítios de decisão de item (`automation.js:3235/3243` vs `3285/5398`) e incluir os escudos na vida efectiva usada pelo `avaliar`.
- **Aceitacao**: campeão AD deixa de receber pen de armadura vinda de pen mágica; `avaliar` conta os escudos (Fluxo do Yasuo = +1.480 no nv50); testes novos.
- **Estado**: pendente

### TK-02-151 | P2 | “R reinicia em 2 s” NÃO EXISTE no motor — só Q/W/E têm Voracidade
- **Ficheiro(s)**: extension/automation.js, docs/ (corrigir o que foi escrito)
- **Evidencia**: parte-02.md:9867 — *“O dono falou em ‘o R reinicia em 2 s’: NÃO EXISTE no motor (só Q/W/E) — reportado como não verificado.”*; e a linha citada antes em parte-02.md:6580 (`motor.js:1853 usar(R, {}, 2); // o abate reinicia a Guilhotina em 2s`)
- **Fazer**: verificar no `motor.js` se a R tem algum efeito por abate; se não tiver, remover dos documentos e do modelo o “R reinicia em 2 s”.
- **Aceitacao**: confirmação com `file:linha` (existe ou não existe) e nenhum documento a repetir a afirmação falsa.
- **Estado**: pendente

### TK-02-152 | P2 | A ordem correcta (dia 1): ler o motor inteiro, calculadora com zero números à mão, simulador, observação, automação
- **Ficheiro(s)**: docs/ (plano) · tools/ (calculadora)
- **Evidencia**: parte-02.md:10168-10232 — *“A diferença não é trabalhar mais. É a ORDEM … Hora 1-2 — LER O MOTOR INTEIRO … Hora 2-3 — A CALCULADORA. Um ficheiro: calc-jogo.mjs. Todas as fórmulas do motor extraídas por regex com file:linha … Regra dura: ZERO números escritos à mão … Hora 5-6 — A AUTOMAÇÃO … Sem matemática própria — pergunta à calculadora. É a única camada que devia ter sido escrita no fim — e foi a primeira.”*; e as cinco regras em parte-02.md:10212-10218 (zero números na automação · uma implementação por mecânica · testes comparam com a calculadora · antes de pedir regra procurar no motor · antes de responder confirmar no motor)
- **Fazer**: escrever o plano com essa ordem e a calculadora (`tools/calc-jogo.mjs` já existe no repo — verificar se cobre as fórmulas) com zero números copiados; migrar a automação para perguntar à calculadora.
- **Aceitacao**: `tools/calc-jogo.mjs` (ou equivalente) com cada fórmula extraída do motor e `file:linha`; automação sem números próprios; validação contra os tooltips do jogo.
- **Estado**: pendente

---

## DECISÕES DO DONO (não são tickets de worker — perguntar **uma vez, em lote**)

1. **Taxa de troca SEGUNDOS ↔ OURO** (parte-02.md:9869 e 9980) — a única regra que falta às 12 correcções da auditoria; sem ela não se pode ordenar “mais rápido” contra “mais barato”.
2. **Âmbito: modelar a penE do Darius (1 de 7 campeões) ou declarar a limitação?** (parte-02.md:9634).
3. **Âmbito: alargar o simulador de chefes às curas do Darius / Taric / Zac / Lux, ou declarar a limitação?** (parte-02.md:9635).
4. **As tabelas do `docs/sim-baron.md` descrevem o personagem do dono (painel medido) ou um modelo?** (parte-02.md:9633) — o doc contradiz-se (`1 medido, `5 modelo) e **isso muda mata↔morre**.
5. **Lendário duplicado com o MERCADO CHEIO**: ler à risca “nunca ao Lojista” = guardar na mochila até abrir lugar — foi a leitura do agente, não decisão do dono (parte-02.md:5299-5309 e 5392-5398). Confirmar ou mudar.
6. **Destino de item quando não há lugar no mercado** (AGENTS.md REGRA Nº 2) — política, não dado.
7. **Preço sem comparável**: o dono já respondeu **1,5M** (parte-02.md:1618) — implementado em TK-02-37; fica registado que está **decidido**.
8. **Fuga de chefe**: o dono já respondeu *“é pra fugir de qualquer coisa que mata, pra qualquer boneco, em qualquer situacao”* (parte-02.md:1618) — implementado em TK-02-33; fica registado que está **decidido**.
9. **Bota de pen para tanque AP** (Taric/Zac com `3170` em vez de `3175`) — regra nova que o agente não inventou (parte-02.md:3124-3125, 3177, TK-02-70).
10. **Troca de item em combate no Barão**: o jogo permite fora de arenas (`motor.js:3056/3061`) e o dono perguntou se se deve trocar a bota quando spawnam larvas (parte-02.md:8314-8367) — a conclusão medida é **não** (as larvas são condição permanente), mas a política de troca em combate é do dono.

---

## FECHADOS NO HISTÓRICO (provados — **não** precisa de worker; listado para não repetir trabalho)

| ticket | prova no histórico |
|---|---|
| TK-02-01 · épico → Lojista | `3108~A → VENDER_LOJISTA` ao vivo (parte-02.md:1443) |
| TK-02-02 · rotação de skills | `rotacao_pai: "manutencao"` e barra `[R,Q,A,W]` com a ultimate (parte-02.md:897-904, 2789-2791) |
| TK-02-03 · drops por classe | `porClasse[minhaClasse]` provado: AD usa 0,02, AP 0,07 no mesmo item/zona (parte-02.md:3035) |
| TK-02-04/TK-02-26 · `3031`/`3089` intocáveis + GUI | tabela `PRIORIDADE_EXTREMA` (`automation.js:26-58`) medida em 3 campeões; falta só a GUI (TK-02-26) |
| TK-02-08 · backtest com dado fresco | 30 ciclos, IC95, 3.830 ouro/min (parte-02.md:1160-1173, 1224-1230) |
| TK-02-15 · `build-mob-chefe.md` | subsunção pelos 5 documentos novos (auditoria-matematica, pendencias-motor, build-ideal-final, build-por-luta, yasuo-roubo-de-vida) |
| TK-02-16 · chefe por abate | tabela passa a `perKill` (parte-02.md:2267) |
| TK-02-17 · planBag sem mochila | `planBag(scanBag(true))` → 12 acções (parte-02.md:1086-1090) |
| TK-02-19 · pt-BR e sem história | verificado no ecrã: `instancia → false`, `cfg: → false` (parte-02.md:3704-3713) |
| TK-02-20 · botões de estado | 4 estados com rótulo dependente do estado (parte-02.md:1767-1773) |
| TK-02-21 · abas / Painel | 8 → 4 abas; `painelLen 142 → 10.905` (parte-02.md:1761-1762) |
| TK-02-22 · exportar `getFarm().cycles` | snapshots regenerados (parte-02.md:665-671, 823-830) |
| TK-02-31 · contagem dupla do CDR | `vp3171: 0` (era 90) e guarda `auditoriaPassivas().duplas.length === 0` (parte-02.md:2069, 3038) |
| TK-02-33 · fuga em manutenção | `fugir: "manutencao"` e fuga sem exigir chefe (parte-02.md:3040, 3069) |
| TK-02-34 · auditoria de hardcodes | 259 hardcodes contados; 5 docs (parte-02.md:3187-3195, 10104-10124) |
| TK-02-35 · `× 2,2` do Lich | medido: proc limitado por habilidades/s; extensão acerta na Katarina (parte-02.md:2893-2901) |
| TK-02-36 · regra dos 4 níveis | existe: `motor.js:1121` (parte-02.md:4587, 4695) |
| TK-02-37 · preço 1,5M | `precoSemComparavel: 1500000` ao vivo (parte-02.md:2829, 7112) |
| TK-02-39 · filtro de morte | `baraoMorte: true` e Barão fora do top 3 (parte-02.md:2209-2217, 7106) |
| TK-02-40 · memória de região | `regiaoSegura`: memória letal descartada, segura usada (parte-02.md:3044) |
| TK-02-42 · asserções do pin por classe | 4 asserções actualizadas + controle AP (parte-02.md:2057-2072) |
| TK-02-45 · UX/botões \| interruptores à esquerda | árvore de 17 switches com independência (parte-02.md:2317-2347) |
| TK-02-52 · `barraPorDisponibilidade` | default TRUE, cadência 2000 ms, prova do cenário de 4 skills (parte-02.md:3046) |
| TK-02-62 · `mit` sem `RM_MONSTRO` | 4 sítios corrigidos; prova bit a bit contra o simulador (parte-02.md:4268-4283) |
| TK-02-68 · simulador do Barão | primeiro nível que mata, poções, DPS por build (parte-02.md:4594-4603) |
| TK-02-73 · `meta.rmMonstro` no inject | pedido pendente — **não** encontrar como fechado no histórico (ficou no limite do subagent, parte-02.md:4270, 5524, 5613) |
| TK-02-78 · `valorEquip`/`valorVenda` | 4.692 e 5.625 conferidos ao vivo (parte-02.md:4948-4950) |
| TK-02-85 · Lojista como descarte | `n.vender` só por espaço; `_venda.receita = 0` (parte-02.md:5502, 5559) |
| TK-02-86 · lendário nunca ao Lojista | 3 sítios corrigidos + 8 asserções (parte-02.md:5497-5505, 5376-5390) |
| TK-02-88 · roubo de vida no Yasuo | respondido: entra por acidente (18%), 0,02%, regex morta (parte-02.md:5770-5780) |
| TK-02-89 · `/(1−cdr)` sobre dano total | 2 sítios (`scoreSet` + `rankItens`); margem do CDR caiu 43% (parte-02.md:6004-6024) |
 | TK-02-95 · `scoreSet` não lia `~A` | causa (b) confirmada e corrigida (parte-02.md:6511-6524) |
| TK-02-96 · CDR dos atributos | `foco = 0` medido no painel; os 23,46% são do Ímpeto (parte-02.md:6668-6690) |
| TK-02-101 · build por fase | `mobs 3175,3089,3135,3100,6655` vs `chefe 3175,3089,3153,3135,6653` (parte-02.md:6833-6841) |
| TK-02-102 · premissa falsa | refutada e registada no simulador (parte-02.md:7457, 7520) |
| TK-02-104/TK-02-109 · `statsSet`/pen | `3175~A` → pen 0,15 (não 0,1725); `4629~A+3` → cdr 0,2346 (parte-02.md:7676-7680) |
| TK-02-107 · simulador | crash corrigido, exit 0 (parte-02.md:7453-7457) |
| TK-02-108 · peças reais | build do dono recomendada ao vivo (parte-02.md:7774-7776, 7803-7814) |
| TK-02-110 · conflito de escritores | resolvido por âncoras no fim; fica o risco (registo) |
| TK-02-112 · 5 lacunas | `8c293746` entregou `docs/pendencias-motor.md` (parte-02.md:9601-9643) |
| TK-02-115 · Fonte automática | `cofreCadenciaMin: 10` e `lerCofre` em `NECESSIDADES_PRIMARIAS` (parte-02.md:8027-8038, 8082-8090) |
| TK-02-134 · `3036` como penMag | corrigido: penMag igual com e sem o 3036 (parte-02.md:9992-9996) |
| TK-02-140 · medição do ratio | `tools/medir-peso-ad.mjs` criado com controlos; ratio 0,135 (parte-02.md:9730-9746) |

TOTAL: 152 tickets (P0=23 P1=74 P2=52 P3=3)
