/*
 * mercado-watch.test.mjs - WATCH-LIST DO MERCADO (detecao em TEMPO REAL + auto-compra).
 *
 * PEDIDO DO DONO (2026-10-18, verbatim): "faz um subagent fazer auto compra no mercado,
 * detectando em TEMPO REAL o mercado sobre os itens q eu quero dar watch. e por nome de
 * player." O dono testa com o nome 'srdog' (um amigo).
 *
 * FONTE (lida, nao resumida — Regra No 1):
 *   - a oferta tem { id, item, preco, moeda, vendedor }; o ecra desenha o.vendedor em
 *     .mj-vend b (jogo.js:2667), o.preco/o.moeda em .preco (jogo.js:2631,2668) e o botao
 *     [data-comprar="<o.id>"] (jogo.js:2669).
 *   - o.item e "<base>[+refino][~qual]", "gema:<id>:<qtd>" (jogo.js:198) ou
 *     "mascote:<id>" (motor.js:130).
 *   - o mercado COMPLETO vem do servidor por /api/mercado (jogo.js:2513, 3001).
 *   - COMPRAR e clique em [data-comprar] -> operarServidor('comprar',{id}) (jogo.js:2954-2960).
 *
 * O que se protege: a SEMANTICA DE UNIAO (item OU jogador), as exclusoes (minha e
 * reservada a outro), o teto de preco, a reserva de ouro, e que so OURO e auto-comprado
 * (nunca Gemas/diamantes). E o caso explicito do dono: oferta do 'srdog' que casa ->
 * DETETADA; oferta que nao casa -> IGNORADA.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

/* Monta uma #janela-mercado com ofertas de COMPRA, como o jogo as desenha
 * (jogo.js:2665-2670): div.mj-oferta > (.mj-vend b = vendedor) + (.preco = preco/moeda)
 * + button[data-comprar]. */
function montarMercadoCompra(mundo, ofertas) {
  const botoes = ofertas.map((of) => {
    const card = mundo.el({
      tag: 'div', label: 'oferta:' + of.id, className: 'mj-oferta',
      textContent: [of.nome, of.qual ? '[' + of.qual + ']' : '', of.precoTxt, of.vendedor].filter(Boolean).join(' '),
      find: {
        'img': [mundo.el({ tag: 'img', label: 'img:' + of.id, attrs: { src: '/itens/' + of.base + '.png' } })],
        '.mj-vend b': [mundo.el({ tag: 'b', label: 'vend:' + of.id, textContent: of.vendedor || '' })],
        '.preco': [mundo.el({ tag: 'span', label: 'preco:' + of.id, className: 'preco', textContent: of.precoTxt || '' })],
      },
    });
    return mundo.el({
      tag: 'button', label: 'comprar:' + of.id, className: 'botao',
      dataset: { comprar: String(of.id) },
      closest: { '.mj-oferta, article, li, div': card },
    });
  });
  const mercado = mundo.el({
    tag: 'div', label: 'janela-mercado', hidden: false,
    find: { '[data-comprar]': botoes },
  });
  mundo.montar('#janela-mercado', [mercado]);
  return { mercado: mercado, botoes: botoes };
}

/* Oferta do servidor, como /api/mercado as devolve (jogo.js:2513, 3001). */
const OFERTA = (id, item, preco, moeda, vendedor, extra) => Object.assign(
  { id: id, item: item, preco: preco, moeda: moeda, vendedor: vendedor }, extra || {});

export const suite = {
  nome: 'mercado-watch',
  titulo: 'Watch-list do mercado: deteccao em tempo real e auto-compra',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');
    auto.setConfig({ champAlvo: 'adtest' });

    /* W1 - itemNaWatch: casa por id-base, id completo e nome; nao casa o resto. */
    t.check('W1: casa por id-base ("3031" casa "3031~A")', auto.itemNaWatch('3031~A', ['3031']) === true);
    t.check('W1: casa por id completo ("3071+2~S" exato)', auto.itemNaWatch('3071+2~S', ['3071+2~S']) === true);
    t.check('W1: casa por NOME ("Gume do Infinito" casa "3031~A")', auto.itemNaWatch('3031~A', ['Gume do Infinito']) === true);
    t.check('W1: NAO casa item fora da watch', auto.itemNaWatch('3071~A', ['3031', 'Gume do Infinito']) === false);
    t.check('W1: NOME parcial com 3+ letras casa ("Gume")', auto.itemNaWatch('3031~A', ['Gume']) === true);
    t.check('W1: lote de runas casa pelo item inteiro', auto.itemNaWatch('gema:arcana:10', ['gema:arcana:10']) === true);

    /* W2 — O CASO DO DONO (srdog): oferta dele que casa -> DETETADA; a que nao casa -> IGNORADA. */
    const ofertas = [
      OFERTA(11, '3031~A', 150000, 'ouro', 'srdog'),
      OFERTA(12, '3071~A', 90000, 'ouro', 'outro'),
    ];
    const achou = auto.casarOfertas(ofertas, { itens: ['3031'], vendedores: ['srdog'] });
    t.check('W2: a oferta do srdog que casa com a watch e DETETADA', achou.some((o) => o.id === 11 && o.casaVendedor === true));
    t.check('W2: a oferta que nao casa e IGNORADA', achou.some((o) => o.id === 12) === false);
    /* so por nome de jogador: TUDO o que o srdog anuncia casa, seja que item for. */
    const soNome = auto.casarOfertas([OFERTA(13, '9500~C', 10, 'ouro', 'Srdog')], { itens: [], vendedores: ['srdog'] });
    t.check('W2: watch SO por jogador casa qualquer item dele (sem maiusculas)', soNome.length === 1 && soNome[0].casaVendedor === true && soNome[0].casaItem === false);
    const nada = auto.casarOfertas([OFERTA(14, '9500~C', 10, 'ouro', 'outro')], { itens: [], vendedores: ['srdog'] });
    t.check('W2: jogador fora da watch e IGNORADO', nada.length === 0);

    /* W3 - watch SO por item: casa o item de qualquer vendedor; ignora o resto. */
    const porItem = auto.casarOfertas(
      [OFERTA(21, '3031~B', 120000, 'ouro', 'qualquer'), OFERTA(22, '3071~A', 5000, 'ouro', 'qualquer')],
      { itens: ['3031'], vendedores: [] });
    t.check('W3: o item da watch casa vindo de qualquer vendedor', porItem.length === 1 && porItem[0].id === 21);

    /* W4 - exclusoes: nunca a minha, nunca a reservada a outro; reservada PARA MIM casa. */
    const excl = auto.casarOfertas([
      OFERTA(31, '3031~A', 100, 'ouro', 'srdog', { minha: true }),
      OFERTA(32, '3031~A', 100, 'ouro', 'srdog', { para: 'outro' }),
      OFERTA(33, '3031~A', 100, 'ouro', 'srdog', { para: 'eu', paraMim: true }),
    ], { itens: ['3031'], vendedores: ['srdog'] });
    t.check('W4: NUNCA casa oferta minha', excl.some((o) => o.id === 31) === false);
    t.check('W4: NUNCA casa oferta reservada a outro', excl.some((o) => o.id === 32) === false);
    t.check('W4: reservada PARA MIM casa (o.paraMim, jogo.js:2626)', excl.some((o) => o.id === 33) === true);

    /* W5 - sem watch nao ha deteccao (o poller nem corre). */
    t.check('W5: sem listas, nada casa', auto.casarOfertas(ofertas, { itens: [], vendedores: [] }).length === 0);
    t.check('W5: sem watch, nada casa', auto.casarOfertas(ofertas, {}).length === 0);

    /* W6 - podeComprarOfertaWatch: teto, reserva e SO OURO. */
    const OURO_ALTO = 100000000;
    t.check('W6: oferta em ouro dentro do teto pode', auto.podeComprarOfertaWatch(OFERTA(41, '3031~A', 1000, 'ouro', 'srdog'), OURO_ALTO, { precoMax: 5000 }).ok === true);
    t.check('W6: acima do precoMax NAO pode', auto.podeComprarOfertaWatch(OFERTA(42, '3031~A', 999999, 'ouro', 'srdog'), OURO_ALTO, { precoMax: 5000 }).ok === false);
    t.check('W6: SEM teto (null) o preco alto passa na regra do preco', auto.podeComprarOfertaWatch(OFERTA(43, '3031~A', 5000, 'ouro', 'srdog'), OURO_ALTO, { precoMax: null }).ok === true);
    t.check('W6: em Gemas NUNCA auto-compra (dinheiro a serio)', auto.podeComprarOfertaWatch(OFERTA(44, 'gema:arcana:10', 100, 'orbs', 'srdog'), OURO_ALTO, {}).ok === false);
    t.check('W6: sem saldo para a reserva NAO pode', auto.podeComprarOfertaWatch(OFERTA(45, '3031~A', 1000000, 'ouro', 'srdog'), 100, {}).ok === false);
    t.check('W6: acima do teto por passagem NAO pode', auto.podeComprarOfertaWatch(OFERTA(46, '3031~A', 600000, 'ouro', 'srdog'), OURO_ALTO, { tetoCompra: 100000 }).ok === false);

    /* W7 - pelo DOM: o vendedor (.mj-vend b) e a moeda (.preco) sao lidos do ecra. */
    montarMercadoCompra(m, [
      { id: 51, base: '3031', nome: 'Gume do Infinito', qual: 'A', precoTxt: '150.000 ouro', vendedor: 'srdog' },
      { id: 52, base: '3071', nome: 'Cota de Malha', qual: 'B', precoTxt: '90.000 ouro', vendedor: 'outro' },
      { id: 53, base: '3031', nome: 'Gume do Infinito', qual: 'A', precoTxt: '1.250', vendedor: 'gema' },
    ]);
    const lidas = auto.lerOfertasCompra();
    const o51 = lidas.find((o) => o.id === '51');
    const o52 = lidas.find((o) => o.id === '52');
    t.check('W7: le 3 ofertas do DOM', lidas.length === 3);
    t.check('W7: o vendedor do DOM e "srdog"', !!(o51 && o51.vendedor === 'srdog'));
    t.check('W7: a moeda do DOM e ouro', !!(o51 && o51.moeda === 'ouro'));
    t.check('W7: a oferta do outro tem outro vendedor', !!(o52 && o52.vendedor === 'outro'));
    /* e a deteccao casa a do srdog a partir do que o DOM leu: */
    const pDom = lidas.map((o) => ({ id: Number(o.id), item: o.base, preco: o.preco, moeda: o.moeda, vendedor: o.vendedor }));
    const achDom = auto.casarOfertas(pDom, { itens: [], vendedores: ['srdog'] });
    t.check('W7: pelo DOM, a do srdog e DETETADA e as outras IGNORADAS', achDom.length === 1 && achDom[0].id === 51);

    /* W8 - o interruptor e a config persistente. */
    t.check('W8: vigiarMercado pende da manutencao', auto.INTERRUPTORES.vigiarMercado && auto.INTERRUPTORES.vigiarMercado.pai === 'manutencao');
    t.check('W8: vigiarMercado usa a chave autoVigiarMercado', auto.INTERRUPTORES.vigiarMercado.cfg === 'autoVigiarMercado');
    auto.setConfig({ enabled: true });
    t.check('W8: por defeito pode (fail-open, chave ausente = ligada)', auto.podeFazer('vigiarMercado').pode === true);
    auto.setConfig({ autoVigiarMercado: false });
    t.check('W8: desligado, NAO pode', auto.podeFazer('vigiarMercado').pode === false);
    auto.setConfig({ autoVigiarMercado: true, mercadoWatch: { itens: ['3031'], vendedores: ['srdog'], precoMax: 200000, tetoCompra: 500000, cadenciaMs: 5000 } });
    const est = auto.mercadoWatchEstado();
    t.check('W8: a watch persiste e e legivel (itens)', (est.itens || []).join(',') === '3031');
    t.check('W8: a watch persiste e e legivel (vendedores)', (est.vendedores || []).join(',') === 'srdog');
    t.check('W8: a watch persiste e e legivel (precoMax)', est.precoMax === 200000);

    /* W9 - sem rede (o banco nao tem fetch) o passo falha fechado, sem rebentar. */
    const passo = await auto.vigiarMercadoPasso();
    t.check('W9: sem fetch, o passo devolve motivo em vez de rebentar', passo && passo.ok === false && passo.motivo === 'sem fetch');
  },
};
