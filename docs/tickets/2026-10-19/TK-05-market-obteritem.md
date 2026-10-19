# TK-05 — `obterItem`: não dizer "mercado" quando não cancelou nada

**Prioridade:** P1 (número/política falsa: o auto-play acredita que o item voltou à mochila quando
não voltou).

**Write scope:** `extension/automation.js` (`obterItem`, `cancelarOferta`, `mercadoEl`) e
`tools/testes/mercado-servidor.test.mjs`. Um escritor por ficheiro.

## Evidência (ler a fonte antes de mexer — AGENTS.md REGRA Nº 1)

- `automation.js:5119-5132` — `obterItem()` lê a oferta do servidor e, se houver, faz:
  ```js
  const m = mercadoEl(true);          // abre a UI se estiver escondida
  if (m) { try { cancelarOferta(o.id); await humano(500); } finally { ...fechar... } }
  return { ok: true, de: 'mercado', nome: ... };
  ```
  Dois defeitos:
  1. Se `m` for `null` (janela não montada), **não cancela nada** e devolve `ok:true, de:'mercado'`.
  2. `cancelarOferta(o.id)` devolve `false` quando não há botão `[data-cancelar="<id>"]`
     (`automation.js:4071`) e o resultado é **ignorado**.
- `automation.js:4001` — `mercadoEl(abrir)` faz `press('j')` quando a janela está escondida; abrir
  para **cancelar** é permitido (é uma acção concreta), mas a leitura nunca o pode fazer.
- `tools/testes/mercado-servidor.test.mjs:35-44` (M1) é uma **prova falsa**: não monta
  `#janela-mercado`, logo `mercadoEl(true)` devolve `null` e o teste passa mesmo sem cancelamento.
  O `de:'mercado'` é a mentira que o teste devia apanhar.

## Acção

1. `obterItem()`:
   - Se existe oferta minha mas `mercadoEl(true)` devolve `null` → **não** devolver `ok:true`.
     Devolver `{ ok:false, de:'mercado', motivo:'mercado-nao-montado', tentou: o.id }` (ou nome
     equivalente, declarado no teste).
   - Chamar `cancelarOferta(o.id)` e **guardar o booleano**. Só devolver
     `{ ok:true, de:'mercado', ... }` se `cancelou === true`. Caso contrário
     `{ ok:false, de:'mercado', motivo:'cancelamento-nao-confirmado', tentou: o.id }`.
   - Manter o `finally` que fecha a janela; manter `await humano(500)`.
2. `cancelarOferta` pode continuar síncrona; não inventar `await` sobre um booleano.
3. Testes (`mercado-servidor.test.mjs`):
   - M1a: oferta no servidor, **sem** `#janela-mercado` → `ok:false` e `de:'mercado'`; zero keydown
     (não abre UI que não existe).
   - M1b: `#janela-mercado` montada e escondida + botão `[data-cancelar="77"]` que regista o clique;
     `obterItem('2001')` → `ok:true, de:'mercado'`, clique registado **uma** vez, janela fechada
     (`[data-fechar]` clicado), e o keydown de abrir (`j`) é permitido.
   - M1c: janela montada mas **sem** botão de cancelar → `ok:false` e `motivo` de cancelamento não
     confirmado; o clique de fechar continua a acontecer.
   - M3/M7/M8 (leituras) mantêm zero keydown com a janela montada e escondida.
4. Mutação obrigatória: apagar a condição `if (!cancelou) return ...` deve fazer M1b/M1c falharem.
   Dizer no relatório que a mutação foi corrida.

## Critério de aceitação

- `node --check extension/automation.js` limpo.
- `node tools/testes/run.mjs` rc=0, suite `mercado-servidor` com os novos checks.
- Nenhuma leitura abre `#janela-mercado`; abrir só acontece no ramo de cancelamento.
- Relatório com `file:linha` do código novo e o resultado da mutação.
