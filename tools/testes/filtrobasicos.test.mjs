/*
 * filtrobasicos.test.mjs - FILTRO DE BÁSICOS do jogo (TK-02-27).
 *
 * MOTIVO: o botão EXISTE no jogo (#ignorar-basicos, jogo.js:5882-5886) e arranca DESLIGADO.
 * O dono quer saber QUANDO clicar: "é pra saber QUANDO clicar no botao do proprio jogo pra
 * começar a filtrar item basico". O critério (parte-02.md:1302-1303): B = folhas das receitas
 * que ainda vou montar; B=0 -> clicar.
 *
 * ARMADILHA MEDIDA (parte-02.md:1300): o único writer do estado é o listener de CHANGE do
 * jogo — escrever .checked = true NÃO actualiza estado.ignorarBasicos. Logo a automação
 * CLICA (e verifica por .checked), nunca escreve a propriedade.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

const CATALOGO_RECEITA = [
  { id: '1001', nome: 'Espada Longa', raridade: 'basico', espaco: 'arma', ad: 10, preco: 350, de: [] },
  { id: '2002', nome: 'Lamina Epica', raridade: 'epico', espaco: 'arma', ad: 30, preco: 1200, de: ['1001'] },
];

export const suite = {
  nome: 'filtrobasicos',
  titulo: 'Filtro de básicos: clica quando B=0 (com change, nunca .checked)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    // catálogo com uma receita: 2002 (épico) <- 1001 (básico/folha). A build do campeão de
    // teste pede o 2002, logo B = 1 enquanto não tiver a folha na mochila.
    alimentarMeta(m, { itens: CATALOGO_RECEITA });
    definirCampeao(m, 'adtest', { magia: false });
    m.montar('#ignorar-basicos', [m.el({ tag: 'input', label: 'ignorar-basicos', checkbox: true, checked: false })]);
    m.montar('#janela-bolsa', [m.el({ label: 'janela-bolsa', hidden: true })]);
    m.montar('#mochila', [m.el({ label: 'mochila', children: [] })]);

    /* ---- F1 - com a folha a FALTAR (B=1) NÃO clica ---- */
    let r = await auto.clicarIgnorarBasicos();
    t.check('F1: com folhas a faltar (B=1) não clica', r.ok === false && r.B === 1);
    t.check('F1: sem clique, o checkbox continua DESLIGADO', caixaLigada(m) === false && m.cliqueDe('ignorar-basicos') === false);

    /* ---- F2 - com a folha na mochila (B=0) CLICA e liga ---- */
    m.montar('#mochila', [m.el({ label: 'mochila', children: [
      m.el({ tag: 'button', label: 'mochila:1001', className: 'slot basico', attrs: { 'data-id': '1001', 'data-dica': '' } }),
    ] })]);
    r = await auto.clicarIgnorarBasicos();
    t.check('F2: com B=0 clica', r.ok === true && r.B === 0);
    t.check('F2: o clique passa o checkbox a LIGADO (.checked = true)', caixaLigada(m) === true && m.cliqueDe('ignorar-basicos') === true);
    t.check('F2: o clique DISPAROU o change (é o que o jogo ouve, jogo.js:5883)',
      m.eventosDe('ignorar-basicos').some((e) => e.tipo === 'change'));

    /* ---- F3 - já ligado: não clica de novo (idempotente) ---- */
    const antes = m.estado.clicks.length;
    r = await auto.clicarIgnorarBasicos();
    t.check('F3: já ligado não volta a clicar', r.ok === false && /ja ligado/.test(r.motivo));
    t.check('F3: nenhum clique novo', m.estado.clicks.length === antes);

    /* ---- F4 - no plano COMPRAR PRONTO (cfg.autoComprar) B=0 desde o abate 1 ---- */
    const m2 = criarMundo();
    const auto2 = carregarAutomation(m2);
    alimentarCatalogo(m2);
    alimentarMeta(m2, { itens: CATALOGO_RECEITA });
    definirCampeao(m2, 'adtest', { magia: false });
    auto2.setConfig({ autoComprar: true });
    m2.montar('#ignorar-basicos', [m2.el({ tag: 'input', label: 'ignorar-basicos', checkbox: true, checked: false })]);
    m2.montar('#janela-bolsa', [m2.el({ label: 'janela-bolsa', hidden: true })]);
    m2.montar('#mochila', [m2.el({ label: 'mochila', children: [] })]);
    t.check('F4: no plano comprar pronto as folhas faltantes são 0', auto2.folhasDeReceitaFaltando() === 0);
    const r2 = await auto2.clicarIgnorarBasicos();
    t.check('F4: no plano comprar pronto clica já (B=0)', r2.ok === true);
  },
};

function caixaLigada(m) {
  const els = m.estado.montados.get('#ignorar-basicos') || [];
  return !!(els[0] && els[0].checked);
}
