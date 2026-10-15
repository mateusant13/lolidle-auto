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
- **Evidencia**: parte-02.md:216 e 294 e 399 — *"Hoje o Rabadon é intocável por uma guarda própria (`RABADON = '3089'`); o Gume do Infinito não tem guarda equivalente"*; regra do dono: *"mesmo duplicados, é o jogador que decide com eles"*
- **Fazer**: criar guarda equivalente à do Rabadon para o `3031` (intocável no auto-clean/venda mesmo duplicado), por classe, com a mesma mecânica da guarda existente; listar no mesmo bloco os outros itens de prioridade extrema que o dono nomear.
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com asserção nova (duplicado de `3031` em campeão AD **não** é vendido/limpo; duplicado de item comum continua a sê-lo).
- **Estado**: pendente

### TK-02-05 | P1 | 13 passivas de estado continuam sem regra própria com contexto de combate
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:226 (objectivo, ponto 2) — *"13 passivas de estado (Stasis, Renascimento, Eco, Furia do Vento, Geada, Rammus...): precisam de regra propria com contexto de combate. Se exigirem pesos inventados, pedir a regra ao dono em vez de inventar."*
- **Fazer**: para cada uma das 13, ler a mecânica em docs/game-src/motor.js (REGRA Nº 1: bloco inteiro, valor + lista de campos) e implementar regra própria activada pelo contexto de combate (mob/chefe/fase). Se alguma exigir peso que não existe no jogo, **não inventar**: deixar lista nomeada no relatório para o dono.
- **Aceitacao**: cada passiva com `file:linha` do motor no comentário do código; `bun tools/testes/run.mjs` rc=0; nenhuma constante "inventada" sem origem no motor.
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
- **Fazer**: fazer o backtest consumir os ficheiros regenerados (`ciclos`/`dps`/`bag`) ou gerar o `yasuo.json` a partir deles; objectivo: a pergunta *"a build nova é melhor que a antiga?"* passa a ter resposta.
- **Aceitacao**: `node tools/backtest.mjs` corre sem ler `docs/snapshots/yasuo.json` como fonte e imprime uma comparação de builds com números reais; dizer no relatório qual comparação respondeu e qual não.
- **Estado**: pendente

### TK-02-09 | P1 | `inject.js` congela a CURVA à mão (números copiados, não lidos)
- **Ficheiro(s)**: extension/inject.js
- **Evidencia**: AGENTS.md REGRA Nº 3 — `inject.js:133 meta.curva = { hp: [150,100,1], ... }`, `inject.js:138 meta.grupoSpawn = { base: 2, rand: 3 }`, `inject.js:139 meta.respawn = { clear: 1.5, local: 1.2 }` — *"cópia à mão, congelada"*; AGENTS.md: *"a região do Barão foi buffada, o script não soube, e o dono morreu"*
- **Fazer**: avaliar a `CURVA` do jogo por nível dentro do mundo MAIN e mandar os números por `postMessage`, em vez de os copiar; manter as chaves actuais como fallback só quando a avaliação falhar, com motivo no log.
- **Aceitacao**: teste/Hook a mostrar que um buff na CURVA aparece no `meta` sem mexer no código (duas execuções com curvas diferentes dão `meta.curva` diferentes); `bun tools/testes/run.mjs` rc=0.
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
