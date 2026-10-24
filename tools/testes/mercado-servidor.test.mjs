/*
 * mercado-servidor.test.mjs - MERCADO SO-LEITURA (TK-01): o servidor manda, a UI so abre para
 * ACCOES CONCRETAS (criar/cancelar/comprar) — nunca para VER.
 *
 * O BUG que isto fecha: `obterItem()` chamava `lerOfertas()` (DOM), que fazia
 * `mercadoEl(true)` + `press('j')` INCONDICIONALMENTE — o jogo abria #janela-mercado so para
 * VER o que estava anunciado. O TK-01 troca a LEITURA para `lerMercadoServidor()` (GET
 * /api/mercado, sem UI).
 *
 * COMO SE PROVA "nao abriu": `press()` faz `document.dispatchEvent(new KeyboardEvent('keydown'))`.
 * Regista-se um listener em `document` e conta-se as teclas. ZERO keydown = o mercado nao abriu.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation } from './dom-stub.mjs';

/** Liga um `fetch` de stub ao contexto (lerMercadoServidor usa o `fetch` global). */
function stubFetch(m, ofertas) {
  m.sandbox.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ofertas }) });
}

/** Contador de `press()`: regista as teclas que `document.dispatchEvent` recebeu. */
function contadorDeTeclas(m) {
  const teclas = [];
  m.documento.addEventListener('keydown', (e) => { teclas.push(e && e.key); });
  return teclas;
}

export const suite = {
  nome: 'mercado-servidor',
  titulo: 'Mercado so-leitura: servidor decide, a UI so para acoes (TK-01)',

  async run(t) {
    /* ---- M1a - oferta no servidor, SEM #janela-mercado: nao abre UI e nao finge cancelamento
     * (TK-05: antes devolvia ok:true, de:"mercado" sem cancelar nada) ---- */
    {
      const m = criarMundo();
      stubFetch(m, [{ id: '77', item: '2001~A', preco: 3000, minha: true }]);
      const auto = carregarAutomation(m);
      const teclas = contadorDeTeclas(m);
      const r = await auto.obterItem('2001');
      t.check('M1a: sem #janela-mercado -> ok:false e de:"mercado" (nao finge cancelamento)',
        r.ok === false && r.de === 'mercado');
      t.check('M1a: motivo declarado = mercado-nao-montado', r.motivo === 'mercado-nao-montado');
      t.check('M1a: press("j") NAO foi chamado (zero keydown)', teclas.length === 0);
    }

    /* ---- M1b - janela montada e escondida + botao [data-cancelar]: cancela e fecha ---- */
    {
      const m = criarMundo();
      stubFetch(m, [{ id: '77', item: '2001~A', preco: 3000, minha: true }]);
      const auto = carregarAutomation(m);
      m.montar('#janela-mercado', [m.el({ label: 'janela-mercado', hidden: true })]);
      const cancelados = [];
      const btn = m.el({ tag: 'button', label: 'cancelar:77', dataset: { cancelar: '77' } });
      btn.click = () => { cancelados.push('77'); m.estado.clicks.push(btn.label); };
      m.montar('#janela-mercado [data-cancelar="77"]', [btn]);
      const fechamentos = [];
      const fechar = m.el({ tag: 'button', label: 'fechar:mercado' });
      fechar.click = () => { fechamentos.push('fechar'); m.estado.clicks.push(fechar.label); };
      m.montar('#janela-mercado [data-fechar]', [fechar]);
      const teclas = contadorDeTeclas(m);
      const r = await auto.obterItem('2001');
      t.check('M1b: a oferta vem do SERVIDOR e cancela (de:"mercado")', r.ok === true && r.de === 'mercado');
      t.check('M1b: o botao [data-cancelar="77"] foi clicado UMA vez', cancelados.length === 1);
      t.check('M1b: a janela foi fechada ([data-fechar] clicado)', fechamentos.length === 1);
      t.check('M1b: o keydown de abrir (j) e permitido', teclas.length === 1);
    }

    /* ---- M1c - janela montada mas SEM botao de cancelar: nao confirma, mas fecha ---- */
    {
      const m = criarMundo();
      stubFetch(m, [{ id: '77', item: '2001~A', preco: 3000, minha: true }]);
      const auto = carregarAutomation(m);
      m.montar('#janela-mercado', [m.el({ label: 'janela-mercado', hidden: true })]);
      const fechamentos = [];
      const fechar = m.el({ tag: 'button', label: 'fechar:mercado' });
      fechar.click = () => { fechamentos.push('fechar'); m.estado.clicks.push(fechar.label); };
      m.montar('#janela-mercado [data-fechar]', [fechar]);
      const teclas = contadorDeTeclas(m);
      const r = await auto.obterItem('2001');
      t.check('M1c: sem botao de cancelar -> ok:false', r.ok === false);
      t.check('M1c: motivo = cancelamento-nao-confirmado', r.motivo === 'cancelamento-nao-confirmado');
      t.check('M1c: o clique de fechar continua a acontecer', fechamentos.length === 1);
      t.check('M1c: o keydown de abrir (j) e permitido', teclas.length === 1);
    }

    /* ---- M2 - SEM oferta minha: ok:false e tambem NAO abre o mercado ---- */
    {
      const m = criarMundo();
      stubFetch(m, []);
      const auto = carregarAutomation(m);
      const teclas = contadorDeTeclas(m);
      const r = await auto.obterItem('2001');
      t.check('M2: sem oferta minha -> ok:false', r.ok === false);
      t.check('M2: sem oferta minha -> tambem NAO abre o mercado', teclas.length === 0);
    }

    /* ---- M3 - as LEITURAS nunca tocam na UI, mesmo com o mercado montado e escondido ---- */
    {
      const m = criarMundo();
      stubFetch(m, [{ id: '1', item: '2001~A', preco: 3000, minha: true }]);
      const auto = carregarAutomation(m);
      m.montar('#janela-mercado', [m.el({ label: 'janela-mercado', hidden: true })]);
      const teclas = contadorDeTeclas(m);
      const minhas = await auto.lerMinhasOfertasServidor();
      const mercado = await auto.mercadoDoServidor();
      t.check('M3: `lerMinhasOfertasServidor` le do servidor (base 2001)',
        Array.isArray(minhas) && minhas.length === 1 && String(minhas[0].base) === '2001');
      t.check('M3: `mercadoDoServidor` le do servidor',
        !!mercado && Array.isArray(mercado.minhas) && mercado.minhas.length === 1);
      t.check('M3: nenhuma das leituras abriu o mercado (zero keydown)', teclas.length === 0);
    }

    /* ---- M4 - `planejarMercado` decide do servidor, sem UI ---- */
    {
      const m = criarMundo();
      stubFetch(m, [{ id: '1', item: '2001~A', preco: 3000, minha: true }]);
      const auto = carregarAutomation(m);
      m.montar('#janela-mercado', [m.el({ label: 'janela-mercado', hidden: true })]);
      const teclas = contadorDeTeclas(m);
      try { await auto.planejarMercado(); } catch (e) { /* pode falhar sem estado de jogo */ }
      t.check('M4: `planejarMercado` NAO abre o mercado para decidir', teclas.length === 0);
    }

    /* ---- M5 - fetch ausente: as leituras devolvem null (fallback declarado, sem rebentar) ---- */
    {
      const m = criarMundo();
      delete m.sandbox.fetch;
      const auto = carregarAutomation(m);
      const a = await auto.lerMinhasOfertasServidor();
      const b = await auto.mercadoDoServidor();
      const c = await auto.obterItem('2001');
      t.check('M5: sem fetch, `lerMinhasOfertasServidor` devolve null', a === null);
      t.check('M5: sem fetch, `mercadoDoServidor` devolve null', b === null);
      t.check('M5: sem fetch, `obterItem` devolve ok:false (sem rebentar)', c.ok === false);
    }

    /* ---- M6 - so a MINHA oferta e cancelada: oferta de OUTRO nao cancela nada ---- */
    {
      const m = criarMundo();
      stubFetch(m, [{ id: '5', item: '2001~A', preco: 3000, minha: false }]);
      const auto = carregarAutomation(m);
      const teclas = contadorDeTeclas(m);
      const r = await auto.obterItem('2001');
      t.check('M6: oferta que NAO e minha nao basta para o servidor resolver', r.ok === false);
      t.check('M6: e nao abre o mercado a procurar', teclas.length === 0);
    }

    /* ---- M7 - P0: SEM fetch, `salvarOfertas` devolve null e NAO abre o mercado ---- */
    {
      const m = criarMundo();
      delete m.sandbox.fetch;
      const auto = carregarAutomation(m);
      // Monta o mercado no DOM (como os testes de regras fazem) — mas SEM fetch.
      m.montar('#janela-mercado', [m.el({ label: 'janela-mercado', hidden: false })]);
      const teclas = contadorDeTeclas(m);
      const o = await auto.salvarOfertas();
      t.check('M7: sem fetch, salvarOfertas devolve null (UNKNOWN — nao "abre para ver")', o === null);
      t.check('M7: sem fetch, press("j") NAO foi chamado — o mercado nao abriu para LER', teclas.length === 0);
    }

    /* ---- M8 - P0: `obterItem` com fetch a falhar NAO abre o mercado (janela montada) ---- */
    {
      const m = criarMundo();
      m.sandbox.fetch = async () => { throw new Error('cookie expirado'); };
      const auto = carregarAutomation(m);
      // janela montada e escondida: mesmo assim a leitura falha ANTES de abrir — zero keydown
      m.montar('#janela-mercado', [m.el({ label: 'janela-mercado', hidden: true })]);
      const teclas = contadorDeTeclas(m);
      const r = await auto.obterItem('2001');
      t.check('M8: fetch a falhar -> obterItem devolve ok:false (sem rebentar)', r.ok === false);
      t.check('M8: fetch a falhar -> NAO abre o mercado (zero keydown)', teclas.length === 0);
    }

    /* ---- M9 - P0 MEDIDO AO VIVO (2026-10-23): "ele ta voltando pra base de forma seguida. nao
     * deu 10 segundos e voltou pra base de novo". Causa: `mercadoTemDaBuild()` respondia TRUE
     * enquanto houvesse QUALQUER peca da build no mercado — mesmo que o campeao JA a tivesse em
     * casa (havia uma Rabadon ~A a 148 e a Rabadon equipada) ou que o preco estourasse o tecto.
     * A necessidade `comprar` nunca fechava: ia a Fonte, nao comprava nada, voltava em 20 s. ---- */
    const cen = async (nome, montar, ofertas) => {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      const { alimentarCatalogo, definirCampeao } = await import('./dom-stub.mjs');
      alimentarCatalogo(m); definirCampeao(m, 'aptest');
      auto.setConfig({ enabled: true });
      const base = String((auto.buildIdeal() || [])[0] || '');
      m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '1M' })]);
      if (montar) montar(m, base);
      stubFetch(m, ofertas(base));
      auto.atualizarMercadoServidor();
      await new Promise((r) => setTimeout(r, 0));
      return { v: auto.mercadoTemDaBuild(), base };
    };
    const r9a = await cen('pode comprar', null, (b) => [{ id: '1', item: b + '~A', preco: 1000, minha: false }]);
    t.check('M9a: peca da build a venda, sem a ter, ouro chega -> true', r9a.v === true);
    const r9b = await cen('ja tenho', (m, b) => {
      m.montar('#equip > button.slot[data-id]', [m.el({
        tag: 'button', label: 'equip:' + b, className: 'slot lendario',
        attrs: { 'data-id': b + '~C', 'data-dica': '' },
      })]);
    }, (b) => [{ id: '1', item: b + '~A', preco: 1000, minha: false }]);
    t.check('M9b: ... mas JA A TENHO equipada -> false (era o ciclo de 20 em 20 s)', r9b.v === false);
    const r9c = await cen('caro demais', null, (b) => [{ id: '1', item: b + '~A', preco: 9000000, minha: false }]);
    t.check('M9c: preco acima do tecto (nunca zera o ouro das pocoes) -> false', r9c.v === false);
  },
};
