# EXTRA-W6-GUI — tickets novos do worker W6 (fora do write scope dele)

> Write scope do W6: **só `extension/gui.js`**. Tudo o que aqui está FORA desse escopo vira ticket,
> não edição (Regra Nº 5). Criado em 2026-10-14 pelo worker da fila W6.

---

## XW6-01 | P0 | `automation.js:201`: `parseNum` apaga o sufixo k/M do `fmt` do jogo
- **Ficheiro(s)**: extension/automation.js (linha 201) — DONO DO FICHEIRO: frente de leituras/autoplay, não a W6.
- **Evidencia**: `automation.js:201` `const parseNum = (s) => { const d = String(s ?? '').replace(/[^\d]/g, ''); return d ? Number(d) : NaN; };`
  O `fmt` do JOGO mete sufixo acima de 10.000/1.000.000: `docs/game-src/cena.js:225`
  `export const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString());`
  e é esse `fmt` que escreve `#hud-vida-txt` (`jogo.js:6203`) e `#st-vida-txt` (`jogo.js:6438`) além de `#st-ouro`.
  Com `replace(/[^\d]/g, '')`: "12.3k" → **123**, "1.2M" → **12** — corrompe `readGold`, `readPotions`, `parseDica` **em silêncio** acima de 10.000.
- **Fazer**: a regra já provada no `content.js` (e agora também na GUI, `extension/gui.js:120-137`):
  `SUFIXO = { k: 1e3, K: 1e3, m: 1e6, M: 1e6 }`; grupo de 3 casas ("4.188") é MILHAR; com sufixo ("12.3k") é decimal;
  o sufixo tem de entrar nos GRUPOS da regex. Com inteiros o comportamento é idêntico (sem regressão).
- **Casos de prova exigidos**: "12.3k / 20.4k" → {cur:12300, max:20400}; "9.876 / 12.3k" → max 12300 (antes 123); "1.2M" → 1200000.
  (O worker W6 já corre estes casos contra a cópia da GUI: 12/12 ok.)
- **Aceitacao**: `bun tools/testes/run.mjs` rc=0 com a regra nova + um teste que fixe os 3 casos acima
  (um teste que codifique o comportamento antigo tem de ser actualizado — Regra Nº 6).
- **Prioridade**: P0 (número lido errado em silêncio).

## XW6-02 | P2 | Documentar o caminho REAL de abertura do painel no README
- **Ficheiro(s)**: README.md (fora do escopo W6).
- **Evidencia**: `docs/historico/parte-02.md:1927` — *"O painel não apareceu na captura. Eu abri-o com classList.add('on'), e isso não é o caminho real de abertura — o painel só renderiza quando o abrir() interno corre (hover no lançador ou F8 pelo handler)."*
  O caminho real já está documentado no topo do `extension/gui.js` (linhas 6-12, pela W6) e exposto em
  `window.__lolidleGui.abrir()` (`gui.js:3348`). Falta o README para quem não lê o fonte.
- **Fazer**: 3 linhas no README: hover no nome do jogador / tecla F8 / botão ⚙, ou `window.__lolidleGui.abrir()`;
  nunca `classList.add('on')` (mostra o painel vazio — quem pinta é o `abrir()`).
- **Aceitacao**: grep pelo caminho no README; captura do painel aberta pelo caminho real.
- **Prioridade**: P2.

## XW6-03 | P2 | Motor não tem modo "farmar até cair" (auto farm pra item fixa a região)
- **Ficheiro(s)**: extension/automation.js (dono da frente de autoplay).
- **Evidencia**: `gui.js:2287` (a própria GUI diz: *"O motor não tem (ainda) um modo 'farmar até cair': a região fica fixa e ele continua lá até você mudar — não para sozinho quando o item cai"*).
  A modalidade compõe `setConfig(regionDefault)` + `viajarPara` — não existe `farmarItem(ids)`.
- **Fazer**: função do motor `farmarItem(ids)` com destino, condição de parada (item na mochila) e regresso ao modo anterior.
- **Aceitacao**: escolher 1 item, ligar, e o motor parar/voltar SOZINHO quando o item cair (medido ao vivo).
- **Prioridade**: P2.

## XW6-04 | P1 | Prova ao vivo pendente (lane do Lead — browser)
- **Ficheiro(s):** nenhum (verificação).
- **O que prova:** (a) cartão "Blindados" mostra o **3031** num campeão AP, igual ao motor
  (`getFarm`/`PRIORIDADE_EXTREMA`); (b) switches: 17 interruptores, cada um com a linha verde/vermelha,
  switch à esquerda; (c) cartões de farm minimizáveis; (d) print de cada aba sem texto cortado;
  (e) plano da mochila com itens reais. Nada disto pode ser provado pelo worker (CDP 9224/9233 é lane serializada do Lead).
- **Aceitacao**: marcadores: `data-blindados="motor"`, `ap-bf-min`, `ap-fm-min-modo`, `ap-fm-min-itens`.
- **Prioridade**: P1 (fecha os tickets da W6 ao vivo).

## XW6-05 | P3 | Índice do worktree `w6-gui` tem ficheiros do master staged
- **Evidencia**: `git status` em `I:/wt/w6-gui` mostra staged: `docs/game-src/motor.js`, `docs/tickets/*.md`,
  `docs/tickets/parte-01.md`, `docs/tickets/parte-02.md` (conteúdo do commit `f3dacf5` do master).
  O worker W6 **não** os staged e **não** os commitou: o commit da W6 leva só `extension/gui.js`.
- **Fazer**: o Lead decide (manter assim, ou `git reset` no índice desse worktree).
- **Prioridade**: P3.

---

## NOTA — decisões D-01/D-09 (correcção do Lead 22:40)
A versão corrigida (`docs/tickets/decisoes-resolvidas.md`) foi lida. **Nenhum ticket da W6 depende dela**:
os textos da GUI não afirmam regra de Lojista/mercado para legendários — o cartão "O que vai acontecer a cada
item" desenha as acções que o MOTOR decide, e o cartão "Blindados" desenha a lista de protecção do motor.
