# TICKETS EXTRA — fila W4 (w4-fuga), 2026-10-14 ~23:30

> Formato igual ao das filas. Cada um traz evidencia `file:linha`, accao concreta, criterio de
> aceitacao e prioridade. **Nenhum destes estava na fila W4 original** — apareceram no caminho.

---

### TK-W4-01 | P0 | `parseNum` apagava o sufixo k/M do `fmt` do jogo — leituras erradas EM SILENCIO acima de 10 000

- **Ficheiro(s)**: `extension/automation.js`
- **Evidencia**: `docs/game-src/cena.js:225` — `fmt = (n) => (n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e4 ? (n/1e3).toFixed(1)+'k' : Math.round(n))`.
  O MESMO `fmt` escreve `#hud-vida-txt` (`${fmt(vida)} / ${fmt(a.vida)}`, `docs/game-src/jogo.js:6203`),
  os textos de loot ("Loot de X: 12.3k de ouro") e o painel de stats. O parser antigo
  (`String(s).replace(/[^\d]/g,'')`) **apagava o sufixo**: "12.3k" virava 123 e "1.2M" virava 12 —
  e a regex do par de vida `(\d+)\s*/\s*(\d+)` não casava nada (a vida caía num 4188 escrito à
  mão) ou cortava o MÁXIMO para 12 ("9.876 / 12.3k"). Ou seja: ouro, poções, vida, Dano e XP lidos
  errados sem uma única linha de log — e eram esses números que mandavam na poção, na fuga e na build.
- **Achado por**: o Lead (mensagem das 22:01, "ACHADO DO ESCRITOR DO content.js"), aplicado aqui
  porque **todos** os trabalhadores que mexem em `extension/automation.js` tinham de o provar.
- **Fazer**: `parseNum` com sufixo ({k:1e3, m:1e6}); grupo de 3 casas ("4.188") = MILHAR em pt-BR,
  com sufixo ("12.3k") = decimal; o sufixo entra nos GRUPOS das regexes que o alimentam (par de vida,
  textos de loot, painel de stats). Com inteiros o comportamento é idêntico (sem regressão).
- **Aceitacao**: `node tools/testes/run.mjs` rc=0 com a suíte `numeros`;
  `"12.3k / 20.4k" -> {cur:12300, max:20400}`; `"9.876 / 12.3k" -> max 12300 (antes 123)`;
  `"1.2M" -> 1200000`.
- **Estado**: **fechado** — provado em `tools/testes/numeros.test.mjs` (29 assercoes) e, por
  mutação, o banco fica VERMELHO contra o parser antigo (12 falhas).

---

### TK-W4-02 | P1 | `#local-nome` na base: a fonte do jogo escreve "Zona segura", não "Fonte" — a confirmar ao vivo

- **Ficheiro(s)**: `extension/automation.js` (leitura de local), `docs/game-src/jogo.js`
- **Evidencia**: `docs/game-src/jogo.js:6489` —
  `nomeLocal = l.faixa ? `${l.nome} <small>nível {min}–{max}</small>` : t('Zona segura')`, e o
  `#local-nome` recebe esse texto em `jogo.js:6509`. A entrada `fonte` em `LOCAIS`
  (`docs/game-src/motor.js`, `{ id: 'fonte', nome: 'Fonte', base: true }`) **não tem `faixa`**, logo
  pelo fonte lido o HUD mostraria "Zona segura" — e o `naBase()` da extensão
  (`/fonte/i.test(readLocation().text)`) daria FALSO na base.
  **CONTRA-EVIDENCIA (ao vivo)**: `docs/historico/parte-01.md:2658` — "Verified: `loc: 'Fonte'`" e
  `parte-01.md:2210` — "confirm `loc == 'Fonte'`". A observação ao vivo contradiz o fonte lido, e a
  regra Nº 1 diz que a observação do que o jogo FAZ manda.
- **Fazer**: confirmar AO VIVO (lane do Lead) o texto de `#local-nome` com o boneco PARADO na base.
  Se for "Zona segura", o `naBase()` tem de aceitar os DOIS ("fonte" OU "zona segura") — e isso
  mexe em `viajarPara`, `acaoBase`, `checarPocoes` e `proximoGiro` (todos dependem dele).
- **Aceitacao**: leitura ao vivo do `#local-nome` na base + `naBase()` verdadeiro lá.
- **Estado**: **pendente — REGRA DO DONO / Lead**: não mexe no browser (lane CDP serializada).
  O que fiz entretanto, sem depender da dúvida: `localId` passou a comparar
  **normalizado** (sem acento, sem caixa) — `tools/testes/fuga.test.mjs` W6.

---

### TK-W4-03 | P2 | `agregar()` só calcula `risco` para regiões COM CHEFE — fugir de mob que mata não contava

- **Ficheiro(s)**: `extension/automation.js`
- **Evidencia**: `agregar()` — `const risco = r.boss && nivelChefe ? avaliar(...) : null;`. Sem
  `r.boss`, `risco` fica `null` e o `checarChefeFatal` via `morre = !!(r && r.risco && r.risco.morre)`
  = FALTO sempre. A `estimarRegiao`, essa sim, avalia **monstro a monstro** e declara `morte === true`
  basta um que mate.
- **Fazer**: o `checarChefeFatal` consulta também a `estimarRegiao` da região (`regiaoMata`) e foge
  quando ela PROVA que um mob mata; a excepção "se as poções cobrem a luta, termina o chefe" passa a
  valer SÓ para a luta do chefe (nunca para o que mata); e a fuga deixa de voltar a uma região que mata.
- **Aceitacao**: `tools/testes/fuga.test.mjs` W2/W3 — região de mobs que mata → fuga registada com
  `regiaoMata: true`; com `fugir` desligado → nenhuma fuga. Por mutação, contra o código antigo o
  W2 falha.
- **Estado**: **fechado**.

---

### TK-W4-04 | P2 | `reporAte` (trava de 15 min da poção) era armado ANTES de o recall dar certo

- **Ficheiro(s)**: `extension/automation.js`
- **Evidencia**: `checarPocoes` — `reporAte = Date.now() + 15 * 60000;` vinha ANTES do `press('b')`
  e do `acaoBase()`. Se a viagem falhasse — e a VIAGEM é cancelada por dano
  (`docs/game-src/jogo.js:492` "Viagem cancelada: você levou dano"; o recall por Esc, `jogo.js:1635`) —
  a trava ficava 15 min a bloquear QUALQUER reposição sem nada ter sido reposto.
- **Fazer**: a trava só é armada quando a BASE está confirmada (`naBase()`); recall falhado
  **desarma** a trava e regista-o no log.
- **Aceitacao**: teste com recall falhado → nenhuma trava Activa; recall com êxito → trava com o ts do êxito.
- **Estado**: **fechado** (código); **o teste ao vivo é do Lead** (lane CDP).
