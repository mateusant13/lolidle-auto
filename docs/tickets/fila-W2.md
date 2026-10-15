# FILA W2 — Build e itens (motor de decisão de build)

**WORKTREE**: I:/wt/w2-build   **BRANCH**: w2-build

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: planejar, buildIdeal, buildIdealPara, valorPassiva, valorDe, refinarMelhores, pesosItem, scoreSet, efeitosEquipados, aplicarKit (stats), objetivoItem. NÃO mexas em região, barra, fuga, mercado nem GUI.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w2-build -b w2-build`
2. `cd I:/wt/w2-build` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w2-build: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (7)
### TK-02-03 | P0 | `planejar()` é class-blind: escolhe a tabela de drops errada (AD recebe tabela AP)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:313-314 e 340-341 — `automation.js:1545  const chance = z.porClasse ? (z.porClasse.ap || z.porClasse.ad || ...) : 0;` *"prefere sempre .ap, seja o campeão AD ou AP"*; contraste parte-02.md:377 `automation.js:4799 comprar-vs-farmar: reg.porClasse[classe] || 0 ← JÁ ESTÁ CERTO`
- **Fazer**: no `planejar`, escolher `z.porClasse[classeDoCampeao]` (classe lida do campeão ao vivo), com fallback só quando a chave não existir. Confirmar no motor que os dois campos vêm separados (docs/game-src/motor.js:383/397/407 — `l.drops` e `l.dropsAp`).
- **Aceitacao**: teste em tools/testes/ a passar: `planejar` com campeão **AP** continua a devolver o Covil do Barão para o `3089` e com campeão **AD** **não** o devolve (devolve a zona da tabela normal, ex. Gume do Infinito `3031`); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente de verificacao (nao encontrei evidencia directa no codigo nesta passada)

### TK-02-24 | P0 | Passivas dos itens não contam na build (só campos estruturados) — dono reclamou “dezenas de vezes”
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1266 — *“tu sabia q os itens tem passivas, que só a passiva da bota de cdr, e só a passiva do impeto, os dois somam 30? ... eu ja falei sobre levar em conta passiva de itens algumas dezenas de vezes. arruma. tudo. pra todos os bonecos. pra todos os itens. agora”*; campo e passiva lado a lado em parte-02.md:1400 — `3171 Lucidez Escarlate : cdr: 0.15   efeito: "Lucidez: −15% na recarga das habilidades."`; matemática do dono em parte-02.md:1040-1066 (30% dos dois itens vs tecto de 40% de `motor.js:529` e `:537`)
- **Fazer**: fazer a avaliação de build somar **campo + passiva** para todos os itens e todos os campeões — a passiva textual tem de entrar no mesmo cômputo de CDR/pen/AP, não só o campo estruturado. Confirmar cada número em `docs/game-src/motor.js` antes de codar (REGRA Nº 1); o dono classificou isto como pendência antiga, tratar como P0.
- **Aceitacao**: caso de teste com `3171` (Lucidez) + `4629` (Ímpeto Cósmico) a dar **30% de CDR** somados (15+15), abaixo do tecto de 40%, sem desperdício; `bun tools/testes/run.mjs` rc=0. Prova ao vivo com marcador discriminante (texto que só existe na build nova).
- **Estado**: pendente de verificacao (nao encontrei evidencia directa no codigo nesta passada)

### TK-02-32 | P0 | `objetivoItem="rabadon"` força item AP na build AD do Yasuo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1686-1692 — `buildIdealPara({magia:false}) → "3172,3089,3046,6631,3031"` com a nota `↑ 3089 = RABADON (AP) numa build AD!`; *“o pin ignora a classe por desenho … agora que vás construir o Yasuo, ele contamina a build dele com um item AP”*; correcção encaminhada em `93b535a6` (parte-02.md:1710-1719): classe oposta → não entra (salvo flag explícita `objetivoItemForcar`), mesma classe → continua a entrar
- **Fazer**: fazer o alvo fixo respeitar a classe do campeão, usando a função de classe que já existe (não inventar critério novo).
- **Aceitacao**: prova obrigatória com as duas listas — `buildIdealPara` de campeão AD **sem** itens AP e de campeão AP **com** o Rabadon; testes com controlo (classe oposta não entra, mesma classe continua a entrar); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente de verificacao (nao encontrei evidencia directa no codigo nesta passada)

### TK-02-25 | P1 | `buildIdealPara(c)` devolve build diferente conforme o campeão actual (`valorPassiva` lê `META.champAtual`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1364 e 1390 — *“`valorPassiva` le `META.champAtual` (`automation.js:3762-3763`) em vez do `c` recebido -> `buildIdealPara(lux)` devolve 3171,3089,4629,3100,4633 com champAtual=yasuo e 3171,3089,3135,3100,6653 com champAtual=lux”*
- **Fazer**: passar o campeão recebido a `valorPassiva`/`perfilCampeao`, para a build ser função só do campeão pedido; a identidade do HUD (`automation.js:1138-1173`, `inject.js:147`) serve só para saber *qual* campeão está em campo.
- **Aceitacao**: teste a chamar `buildIdealPara` com campeões diferentes e a provar que nenhum resultado depende do campeão “actual”; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-06 | P1 | `refinarMelhores` ainda prefere o medido (`n>=3`) ao teórico (muleta)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:231 (objectivo, ponto 6) — *"Tirar a ultima muleta: refinarMelhores ainda prefere o medido (n>=3) ao teorico."*
- **Fazer**: inverter a preferência para o teórico lido do motor, com o medido apenas como desempate/validação; garantir que a fonte é o motor (não uma cópia congelada).
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com asserção nova a cobrir o empate teórico>medido; diff do comportamento antigo nomeado no relatório.
- **Estado**: pendente

### TK-02-35 | P1 | Lich Bane / procs de passiva com multiplicador fixo (× 2,2) em vez da frequência de skills do campeão
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1564 e 1602 — *“O × 2,2 do Lich **é exactamente o teu ponto**: esse número deveria sair da frequência de skills do campeão … Está fixo em 2,2 para qualquer AP”*; *“o × 2,2 do Lich é heurística minha, não matemática do jogo … uma Katarina que usa skill a cada 2 s proca o Lich muito mais que um mago lento, e o número fixo trata os dois igual”*; as recargas das skills estão em `docs/game-src/motor.js` (parte-02.md:1597)
- **Fazer**: derivar o multiplicador de proc da **frequência de skills do campeão** lida do jogo (recargas no motor), em vez do 2,2 fixo; responder com número se o Lich entra na build da Katarina e na de um mago lento.
- **Aceitacao**: dois campeões com frequências de skill diferentes dão multiplicadores diferentes no banco; o valor de cada multiplicador tem `file:linha` nas recargas do motor; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-01-36 | P1 | autoEquip off: itens A na mochila nunca sao equipados (objetivo exige full build equipada)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1264: "autoEquip is still off so the bag's A-quality items aren't being worn"; objetivo do goal (L756): "full build equipada e verificada no jogo real"
- **Fazer**: NOTA: autoEquip=off e regra do dono (regra14) — ver DECISOES DO DONO D-01. Este ticket cobre o OUTRO lado: a build ideal (medida/teorica) tem de ser EQUIPADA por accao explicita e mantida, com verificacao ao vivo dos 5 slots (o agente ja equipou 1001+1036+3044+1018+3133 em L2579; falta manter e avancar para a build lendaria — TK-01-50).
- **Aceitacao**: leitura ao vivo dos equipados = assinatura da build vencedora do momento; nenhum item fora da build equipado; log do jogo confirma.
- **Estado**: pendente


## TICKET NOVO (acrescentado pelo Lead 22:06)
### TK-02-48 | P1 | `planejar()` salta itens sem zona e não agrega por item — a GUI tem de os cruzar com `ondeItem`
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2265 — *“(3) planejar() NAO devolve os itens sem zona (salta-os com ‘if (!o) continue’), por isso a GUI tem de cruzar com getMeta().ondeItem para dizer ‘nao dropa em zona nenhuma’; (4) planejar() nao agrega por item (a melhor zona e calculada na GUI); (5) a chance vem de porClasse (ap/ad) escolhida pelo motor”*
- **Fazer**: fazer o `planejar` devolver todos os itens pedidos (incluindo os sem zona, com marca explícita “sem drop”) e agregar por item (melhor zona, chance por abate, drops/hora), para a GUI não ter de recalcular nada — e para a chance continuar a sair da classe certa (ver TK-02-03).
- **Aceitacao**: teste a chamar `planejar` com um item sem zona e a receber o registo marcado; e com 3 itens a receber 3 linhas agregadas com a melhor zona de cada; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente


## TICKET NOVO (acrescentado pelo Lead 22:40)
### TK-02-101 | P0 | Contradição: `buildPorFase: true` mas as três builds dão o MESMO (e trazem a peça de chefe no farm de mobs)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:6526-6637 — `idealSemFase: "3175,3089,3153,3135,3100"` · `idealMobs: "3175,3089,3153,3135,3100"` ← IDÊNTICO · `idealChefe: "3175,3089,3153,3135,3100"` ← IDÊNTICO · `buildPorFase: true`; *“O motor afirma trocar a build por fase e devolve a mesma nos três casos … Tens o interruptor ligado e ele não faz nada”*; e *“O 3153 está na ideal — e é a PIOR peça para mobs (488 de 11) … O motor está a vestir a peça de chefe no farm de mobs”*; encaminhado em `1be1e7b7` com o pedido das duas listas exactas (mobs e chefe) depois da correcção e a proibição de inventar peso para a Voracidade
- **Fazer**: fazer a fase mudar de facto a build (mobs vs chefe), tirando a peça de chefe da build de mobs, e devolver as duas listas exactas; nenhum peso inventado para a Voracidade (se faltar regra, pedir ao dono).
- **Aceitacao**: `buildIdeal()`, `buildIdeal(mobs)` e `buildIdeal(boss)` dão listas **diferentes** quando devem diferir, com o `3153` fora da de mobs; prova ao vivo das duas builds vestidas em cada fase; `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente de verificacao (nao encontrei evidencia directa no codigo nesta passada)
