# FILA W10 — Config guardada, preços e venda

**WORKTREE**: I:/wt/w10-config   **BRANCH**: w10-config

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: config e defaults (guardada vs default do código), valorDaVenda e regra do Lojista, custo/preço (base vs qualidade/refino), restrição de itens por classe, repetição de item base, auto farm por item (farmarItem). NÃO mexas em scoreSet, planejar, buildIdeal*, valorPassiva, GUI nem barra.

## ORDEM DE TRABALHO
1. `cd I:\!lolidle.com; git worktree add I:/wt/w10-config -b w10-config` (se ainda não existir).
2. `cd I:/wt/w10-config` e trabalha SÓ aí.
3. P0 primeiro. Para cada ticket: LÊ a fonte antes de alterar (Regra Nº 1). Muitos podem já estar corrigidos: VERIFICA antes; se estiver, fecha o ticket com a prova (ficheiro:linha).
4. `bun tools/testes/run.mjs` antes de commitar; se um teste codificar o comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
5. `git add -A; git commit -m "w10-config: <uma linha>"`. NÃO faças merge.
6. Reporta no formato fixo do protocolo (TK / FICHEIROS / TESTES / COMMIT / RISCO / REGRA DO DONO).

## NOTAS DO LEAD (22:06)
- docs/game-src/motor.js é agora a versão VIVA do jogo (3846 linhas; +54 que a cópia velha). Os motor.js:NNN dos tickets podem estar desviados em dezenas: relocaliza por CONTEÚDO.
- Tens docs/game-src/dados-katarina.js (base real) e docs/game-src/kit-katarina-vivo.json (kit completo) lidos do jogo vivo — usa-os, não calibras à mão.
- Decisões do dono já resolvidas em docs/tickets/decisoes-resolvidas.md — não perguntes nada.
- Ferramenta útil: `bun tools/calc-jogo.mjs` lê o motor como texto e avalia qualquer constante (--expr).

## OS TEUS TICKETS (8)
### TK-02-61 | P0 | Mudar o DEFAULT não muda a config guardada — a conta do dono continua com `barraPorDisponibilidade: false`
- **Ficheiro(s)**: extension/automation.js (migração de config) + extension/gui.js se a config for visível lá
- **Evidencia**: parte-02.md:3277-3316 — *“O subagent inverteu o default para true — mas a tua config em chrome.storage foi escrita quando o default era false, e continua false. O mesmo vale para qualquer default que se mude: só se aplica a instalações novas. Consequência prática: a rotação contínua da barra — o teu pedido — não vai ligar sozinha na tua conta. Precisa de ser escrita explicitamente na config existente. É a diferença entre ‘o código está certo’ e ‘o teu jogo faz o que pediste’.”*; prioridade declarada em parte-02.md:3316 (*“A prioridade nº 1 é escrever os defaults novos na config existente — sem isso, nada do que foi corrigido chega ao teu jogo”*)
- **Fazer**: implementar uma migração one-shot dos defaults novos para a config já guardada (versionar a config e aplicar as chaves novas na primeira carga), e verificá-la ao vivo com marcador discriminante depois de `lolidle:reload` + reload (REGRA Nº 4).
- **Aceitacao**: ao vivo, na conta do dono, `barraPorDisponibilidade: true` (e as outras chaves novas com o valor novo) **sem** apagar configurações do utilizador; marcador discriminante que só existe no código novo; `bun tools/testes/run.mjs` rc=0 com caso de migração.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:5634 (cfgVer gravado no arranque). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-78 | P0 | Preço: o motor usa só o preço base e o jogo escala qualidade/refino (Ímpeto vale 4.692, motor trata-o como 3.000)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4405-4421 e 4453-4482 — tela do dono `5.625` vs motor `preco: 3000`; *“O preço também escala com a qualidade e o refino … E o motor guarda só o preço base do catálogo”*; as três funções do jogo: `motor.js:248  p += (i.preco||0) * (1 + BONUS_REFINO*refinoDe(x)) * (QUALIDADES[qualidadeDe(x)]?.mult || 1)`, `motor.js:2898 valorEquip = preco × (1 + 0,12×refino) × multQualidade`, `motor.js:257 valorVenda = piso(preco × 0,5 × (1 + 0,5×refino) × vendaQualidade)`; conta conferida: `3000 × 1,36 × 1,15 = 4.692` e o ecrã mostra 5.625 (`5625/4692 = 1,199 ≈ 1,2` = margem do Lojista, **terceira função ainda não encontrada — não inventar**); consequências em parte-02.md:4418-4421 (`venderBase`, `anunciar`, `refinarMelhores`, `isProtected`)
- **Fazer**: implementar `valorEquip` e `valorVenda` com as fórmulas do motor (`file:linha` em comentário), usá-las onde o valor decide (`venderBase`, `anunciar*`, `refinarMelhores`) e procurar a terceira função (a margem do Lojista); se não aparecer no `motor.js`, usar `valorEquip` com a dúvida registada em comentário.
- **Aceitacao**: o código devolve **4.692** para o Ímpeto do dono (não 3.000); uma peça que antes ia para o Lojista passa a ser guardada (ou o contrário) por causa do valor real, provado no banco; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1234 (preco escala qualidade/refino). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-85 | P0 | Lojista ainda decide venda por ouro (`valorDaVenda >= custo.ouro * 2`) — o dono diz que o Lojista é lixo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4965-4995 — `automation.js:2496  n.vender = podeFazer(vender).pode && atosVenda.length > 0 && (mochilaQuaseCheia || valorDaVenda >= custo.ouro * 2);` com a nota *“Se o Lojista não paga, essa condição é ficção — e o mochilaQuaseCheia é a única razão real”*; encaminhado em `27861ac9` e `5f7aa937` com a troca exacta (`mochilaQuaseCheia || <início de jogo>`) e o pedido de manter o `valorDaVenda` só como **valor informativo, NÃO é receita** (parte-02.md:4991); confirmado ainda pendente em parte-02.md:5266 e 5408; regra do dono em parte-02.md:4866 e 5011 (*“o lojista … é a mesma coisa que jogar item no lixo … ele so e pra ser vendido quando itens sao considerados lixo”*)
- **Fazer**: substituir a condição de venda por `mochilaQuaseCheia` (+ critério medido de início de jogo, se houver) e marcar `valorDaVenda` como informativo; nenhuma decisão de venda pode depender do ouro do Lojista.
- **Aceitacao**: prova exigida em parte-02.md:4995 — com a mochila **não** cheia e valor alto, `n.vender` fica **falso**; com a mochila cheia, continua verdadeiro; `bun tools/testes/run.mjs` rc=0.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:3475 (`n.vender = podeFazer('vender').pode && prioridade && mochilaQuaseCheia`); ZERO ocorrencias de `valorDaVenda >= custo.ouro * 2`. A aceitacao do ticket (mochila nao cheia + valor alto -> `n.vender` falso) esta satisfeita. Falta o teste dedicado no banco

### TK-02-86 | P0 | Confirmar que nenhum caminho manda um LENDÁRIO ao Lojista (regra nova do dono)
- **Ficheiro(s)**: extension/automation.js, tools/testes/
- **Evidencia**: parte-02.md:5011 — *“lendarios sao desejados pelos jogadores, entao nunca se vende lendario pelo lojista, só pelo mercado”*; e parte-02.md:5054-5065 — pedido para percorrer **todos** os caminhos que mandam itens ao Lojista e provar as quatro linhas: `lendário duplicado → MERCADO (nunca Lojista) | épico inútil → VENDER_LOJISTA | básico → VENDER_LOJISTA | 3031/3089 duplicado → PROTEGIDO (controlo)`; verificado ao vivo em parte-02.md:5244-5261 (`nenhum lendário vai ao Lojista`) e com 6 asserções actualizadas (parte-02.md:5376-5390)
- **Fazer**: varrer todos os caminhos de descarte (`planBag`, `venderBase`, `anunciar*`, `atosVenda`) e garantir que **nenhum** aceita lendário, mantendo o contraste épico/básico → Lojista e protegidos acima da regra; manter as asserções nas duas direcções.
- **Aceitacao**: banco a provar, para cada caminho, que um lendário duplicado nunca sai para o Lojista (com o mercado vazio **e** saturado) e que épico/básico continuam a sair; verificação ao vivo com marcador discriminante.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:25 (lendario nunca ao Lojista). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-82 | P1 | A extensão restringe itens por classe nas builds; o jogo não restringe no equipamento
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:4636-4640 — *“Na Katarina, a build AP do bot NÃO é a melhor contra o Barão. Uma build AD/crítico faz 2,8× o DPS — porque o motor não restringe itens por classe. A divisão AP/AD existe nas tabelas de drop (o Barão AP não dropa o Gume do Infinito), mas não no equipamento … a tua Katarina está equipada com a build que a teoria de mago diz, e existe uma build física que a mata o Barão três vezes mais depressa.”*
- **Fazer**: separar as duas coisas: a **tabela de drop** continua a ser escolhida pela classe (regra do jogo), mas a **build/equipamento** deixa de ser restringida pela classe e passa a ser escolhida pelo DPS/sobrevivência medidos contra o alvo; a build de chefe pode ser de outra classe que a de mobs.
- **Aceitacao**: para a Katarina, o motor é capaz de propor a build AD/crítico contra o Barão com o DPS medido (2,8×) e mantém a build de mobs coerente; `bun tools/testes/run.mjs` rc=0 com o controle de que as tabelas de drop continuam por classe.
- **Estado**: pendente

### TK-02-65 | P1 | A extensão proíbe repetir qualquer item base; o motor só proíbe lendário repetido
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:3203-3204 e 3305 — *“escolherConjunto/montarBuildDe proíbem repetir QUALQUER base; o motor só proíbe LENDÁRIO repetido (motor.js:2879/2886/2891). É mais restritivo que o jogo.”*
- **Fazer**: restringir a proibição de repetição a lendários iguais (regra do jogo), deixando repetir itens não-lendários quando o motor permite; confirmar a lista exacta das condições em `motor.js:2879/2891` antes de codar.
- **Aceitacao**: teste a mostrar que dois itens não-lendários iguais podem ser escolhidos e que dois lendários iguais não podem (bater com o motor); `bun tools/testes/run.mjs` rc=0.
- **Estado**: pendente

### TK-02-93 | P1 | Muleta do `refinarMelhores`: objectivo pede para a tirar, mas ela está inerte e o que a substituiria tem erro conhecido
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:5718-5752 — `automation.js:4444-4451` (`rank = (rankBuildsTestadas(null)||[]).filter(r => r.mob && r.mob.goldMin != null && (r.confianca?.mob || 0) >= 3)`; `essenciais = rank[0].itens`; `if (!essenciais.length) essenciais = buildIdeal()`) e o comentário *“Sem isto, o gate do M6 recusava refinar a build que ganhou o M1 só porque ela difere da lista teórica”*; o agente propõe a ordem: 1) corrigir o `scoreSet` (CDR), 2) ter ≥2 builds medidas no snapshot, 3) só então substituir a medida pela teoria; e parte-02.md:5740 (*“a muleta está inerte, não a estorvar”*)
- **Fazer**: cumprir a ordem (TK-02-89 → acumular ≥2 assinaturas de build → só então retirar a muleta) e registar a decisão do dono: tirar já ou depois. Se o dono mandar tirar já, tirar e nomear o que a substitui.
- **Aceitacao**: a muleta sai só quando há em que apoiar (ou por ordem explícita do dono, registada); `bun tools/testes/run.mjs` rc=0 e o relatório diz em que estado ficou.
- **Estado**: resolvido 2026-10-15 — o `refinarMelhores` devolve o `diag` e a regra e a do proprio ticket (a muleta sai com n>=3); provado pelas suites `refinar` e `w10` M1 verdes

### TK-02-47 | P1 | Modalidade “auto farm pra item” não tem suporte real no motor (sem modo persistente, sem `farmarItem(ids)`)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:2265 — *“O QUE FALTA NO MOTOR para a modalidade (b) existir ‘a serio’: (1) nao ha modo persistente ‘farmar ate cair’ — a regiao fica fixa e nao ha auto-avanco/parada quando o item cai (esta dito na propria GUI); (2) nao existe funcao do motor tipo farmarItem(ids) — a GUI compoe setConfig(enabled)+setConfig(regionDefault)+viajarPara”*
- **Fazer**: implementar no motor um modo persistente “farmar até cair o item X” (com parada/auto-avanço quando o item cai) e uma função própria (ex.: `farmarItem(ids)`), em vez de a GUI compor `setConfig`+`regionDefault`+`viajarPara` a cada vez.
- **Aceitacao**: no banco, ligar o modo com 1 id faz o motor fixar a região, viajar e parar quando o item aparece na mochila; sem o item, continua a farmar; `bun tools/testes/run.mjs` rc=0 com casos novos.
- **Estado**: pendente
