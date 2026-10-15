# FILA W12 — A matemática do campeão contra o motor vivo

**WORKTREE**: I:/wt/w12-modelo   **BRANCH**: w12-modelo

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: aplicação do KIT do campeão (jogarKit/aplicarKit e companhia), Voracidade (redução de recarga), cura do giro (curaGiro), Hemorragia do Darius, leitura de campos do jogador (player(): rv, critico, pen), premissas de atributos (Foco e amigos) e os números derivados do campeão. NÃO mexas em scoreSet, pesosItem, planejar, buildIdeal*, venda/Lojista, config guardada, GUI nem barra — esses são de outros workers.

## ORDEM DE TRABALHO
1. `cd I:\!lolidle.com; git worktree add I:/wt/w12-modelo -b w12-modelo`
2. `cd I:/wt/w12-modelo` e trabalha SÓ aí. P0 primeiro.
3. Para cada ticket: LÊ o motor.js (versão viva, 3846 linhas) e o ficheiro da extensão ANTES de alterar. Muitos tickets podem já estar corrigidos: VERIFICA; se estiver, fecha com a prova (ficheiro:linha).
4. `bun tools/testes/run.mjs` antes de commitar; teste que codifique comportamento antigo actualiza-se e diz-se qual (Regra Nº 6).
5. `git add -A; git commit -m "w12-modelo: <uma linha>"`. NÃO faças merge.
6. Reporta no formato fixo do protocolo.

## NOTAS DO LEAD (22:40)
- docs/game-src/motor.js é a versão VIVA (3846 linhas; +54 vs a cópia velha). Os motor.js:NNN dos tickets podem estar desviados: relocaliza por CONTEÚDO.
- Tens docs/game-src/dados-katarina.js (base real), docs/game-src/kit-katarina-vivo.json (kit completo com ranks), docs/game-src/dados-yasuo.js e os outros 5 dados-*.js — todos lidos do jogo vivo. Usa-os, não calibras à mão.
- `bun tools/calc-jogo.mjs --expr "..."` avalia qualquer constante do motor a partir do texto.
- Decisões do dono: docs/tickets/decisoes-resolvidas.md — não perguntes nada.
- docs/motor/02-combate-dano.md e docs/motor/03-campeoes-kits.md são a especificação já escrita por outros agentes: usa-a como mapa, mas confirma no motor.

## OS TEUS TICKETS (6)
### TK-02-114 | P0 | A penetração do KIT não entra na matemática de build (a E da Katarina penetra 20–44%)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:7856-7870 — `motor.js:560  Katarina E: { ..., pen: [0.2, 0.23, 0.26, 0.29, 0.32, 0.35, 0.38, 0.41, ...] }` (a E dela penetra 20% da armadura no rank 1, até ~44% no rank 10); e o motor da extensão lê a pen só dos itens: `automation.js:1472  const pen = k.penSuspiro != null ? k.penSuspiro : txt.penArmadura;` com a nota “do TEXTO DO ITEM”; *“A pen do KIT não é usada em lado nenhum … a matemática de build ignora que a tua E já penetra 20% — e por isso sobrevaloriza o Cajado do Vazio e todos os itens de pen”*; e *“afecta toda a decisão de build que envolva penetração — em qualquer campeão que tenha pen no kit”* (parte-02.md:7870)
- **Fazer**: incluir a penetração do kit (por rank, lida de `motor.js`) na matemática de build/DPS, somada à pen dos itens e limitada pelo tecto do jogo (`motor.js:529`); varrer todos os campeões com `pen` no kit.
- **CORRECÇÃO (parte-02.md:9625 e 9646-9652 e 9999)**: a pen citada é do **Darius** (`motor.js:560`); o E da Katarina (`motor.js:743`) **não** tem `pen` — há **um único** `pen:` em todo o game-src. **O motor já usa** a pen do kit do Darius (`motor.js:516 → 539 → 1202`): **não havia bug ali**. Quem ignora é a matemática de build (`statsSet`, `estimarSet`, `scoreSet`, `valorBuff`) e o `inject.js:113-115` não serializa o campo. Impacto: 1 de 7 campeões, 20%→45% = **+12,3% a +32,9%** de dano físico.
- **Aceitacao**: para a Katarina, o valor do Cajado do Vazio e dos itens de pen desce depois de a pen do kit entrar; número medido antes/depois; `bun tools/testes/run.mjs` rc=0 com caso novo por campeão com pen no kit.
- **Estado**: pendente

### TK-02-130 | P0 | Full audit da Katarina NÃO feito — a passiva D (`curaGiro`) não está modelada e muda a sobrevivência
- **Ficheiro(s)**: extension/automation.js, tools/sim-chefes.mjs, tools/sim-build.mjs
- **Evidencia**: parte-02.md:8893-8952 — *“O que já está auditado dela: cooldowns por rank · a E com pen: [0.2, 0.23, …] · a Voracidade (1,5 s/abate, 5 s/chefe) · o giro (30 + 19×nivel + 1×ap + 0,4×max(0, ad−adBase)) · os ranks (Q10+W1+E3+R3) · os atributos”*; e o que NÃO está: `P: {}` (passiva vazia no kit serializado) · `D: { vaAdaga, acumMax, duracaoSinistra, curaGiro, passiva }` (NÃO MODELADA) · `E: { ..., adRatio }` · `adagas: true` · `ordem: [N, R, B, M, E, A, G, F, T, Q, W]` (13 habilidades); *“A D é a passiva dela — Lâmina Sinistra … e tem curaGiro. Se ela cura enquanto gira, isso entra directamente na sobrevivência e no gasto de poções. E não está modelado”*; e *“a conta que te dei — 35 s com 12 poções com lifesteal, 77 s com 62 sem — pode estar errada, porque falta uma fonte de cura que a personagem tem por si”*; audit lançado em `0952eed4` com 6 pontos (13 habilidades uma a uma; P e D com a curaGiro quantificada; adagas; tabela de modelagem; efeito no combate; quais das 13 ela usa)
- **Fazer**: fazer o audit completo da Katarina e modelar a passiva D (`curaGiro`: quanto cura por giro, quantos giros por luta), a `P`, o `adRatio` da E e a mecânica das adagas; recalcular a luta contra o Barão com a cura do kit dentro.
- **Aceitacao**: tabela habilidade-a-habilidade (a extensão modela? onde? impacto? o que deve mudar), a curaGiro quantificada e dentro da luta, e as contas de poções/segundos refeitas com ela.
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

### TK-02-147 | P1 | Oito números já errados: 6 itens do catálogo remendado + o `tierDe` 10× errado
- **Ficheiro(s)**: extension/automation.js, extension/inject.js
- **Evidencia**: parte-02.md:9861 e 9896 — *“JÁ ERRADAS HOJE (classe c): 6 itens do catálogo remendado (inject.js:161 manda I.ITENS_DADOS cru; o motor remenda 2022/1006/3057/3108/3802/4629 em motor.js:16-26 — a extensão recebe cdr/regen/efeito AUSENTES) + o tierDe (qIdx×10+refino diz que 1 qualidade = 10 refinos; motor.js:252 diz 1 degrau B→A ≈ 1,25 refinos — está 10× maior).”*
- **Fazer**: passar a usar o catálogo já remendado pelo motor (em vez de `I.ITENS_DADOS` cru) e corrigir o `tierDe` para a fórmula do motor (`motor.js:252`).
- **Aceitacao**: os 6 itens vêm com cdr/regen/efeito do motor, e o `tierDe` dá 1 qualidade ≈ 1,25 refinos; testes a cobrir os dois.
- **Estado**: pendente

### TK-02-102 | P0 | Premissa falsa no simulador: `Foco = 57,5` deduzido dos 23% de CDR — o Foco é 0 e os 23% são 100% do Ímpeto
- **Ficheiro(s)**: tools/sim-build.mjs (recalcular) + extension/automation.js se depender do mesmo dado
- **Evidencia**: parte-02.md:6668-6698 — atributos lidos no jogo: `Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · Foco 0` com `81 + 3 = 84 = 3 × 28` (todos os pontos gastos ao nível 29); *“MAS ENTÃO OS 23% DE CDR NÃO VÊM DOS ATRIBUTOS … = min(0,4, 0 + 0,2346) → os 23% são 100% do ÍMPETO”*; e *“O subagent do simulador deduziu ‘Foco = 57,5 pontos’ a partir dos 23% — assumiu que o CDR vinha dos atributos … O +227 dps do Ímpeto foi calculado com foco = 57,5 — e tem de ser recalculado com foco = 0”*
- **Fazer**: recalcular as conclusões que dependiam do `foco = 57,5` (o ganho do Ímpeto, o valor do CDR de item, a comparação Ímpeto vs Liandry) com `foco = 0` e dizer quais números mudam; manter a distribuição de atributos correcta (Força/Vitalidade) verificada ao vivo.
- **Aceitacao**: o simulador corre com `foco = 0` (lido do painel) e imprime as conclusões novas; cada número que mudou é nomeado; `bun tools/sim-build.mjs` exit 0.
- **Estado**: pendente
