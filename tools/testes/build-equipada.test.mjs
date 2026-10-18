/*
 * build-equipada.test.mjs - A BUILD VENCEDORA TEM DE FICAR EQUIPADA (TK-01-36).
 *
 * Objectivo do dono (parte-01.md:756, verbatim): "melhor build do Yasuo achada por DADO ...,
 * FULL BUILD EQUIPADA e verificada no jogo real". O `autoEquip` está OFF por REGRA DO DONO
 * (regra14, parte-01.md:1561/2791) — este ticket cobre o OUTRO lado: a build ideal tem de ser
 * equipada por acção explícita e MANTIDA, e nenhum item fora dela pode ficar vestido.
 *
 * O que esta suite prova (a leitura ao vivo dos 5 slots é lane do Lead — CDP 9224 serializado,
 * docs/worker-protocolo.md §4 —, pelo que aqui prova-se o CONTRATO que essa leitura confirma):
 *   1. a build ideal do campeão fica equipada e o planeador não mexe mais nela (`mexe=false`);
 *   2. um item FORA da build que esteja vestido é marcado para sair;
 *   3. o valor de cada item da build fica acima de qualquer item fora dela, para o campeão
 *      EM CAMPO — que é o que o `alvoEquip`/`planoEquipar` usam para decidir (`valorDe`).
 *
 * REGRA Nº 1: o catálogo é IMPORTADO de docs/game-src/itens.js (o ficheiro real do jogo).
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarMeta, IMG_HAB_SEL, CATALOGO } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';

/** Kit mínimo com as recargas por rank — o que o inject.js reencaminha (inject.js:120-136). */
const KIT = {
  Q: { nivel: 1, max: 10, recarga: [10, 9, 8], base: [80, 115], ratio: [0.45, 0.48] },
  W: { nivel: 1, max: 10, recarga: [14, 13, 12] },
  E: { nivel: 1, max: 10, recarga: [10, 9, 8], base: [40, 60], ratio: [0.3, 0.32], adRatio: 0.4 },
  R: { nivel: 6, max: 5, recarga: [75, 65, 55], base: [30, 44], ratio: [0.25, 0.28] },
  G: { nivel: 8, max: 10, recarga: [20, 19, 18], base: [30, 45], ratio: [0.3, 0.315] },
  A: { nivel: 13, max: 10, recarga: [12, 11, 10], base: [90, 125], ratio: [0.6, 0.635] },
  F: { nivel: 23, max: 10, recarga: [16, 15, 14] },
  T: { nivel: 28, max: 10, recarga: [24, 23, 22], base: [60, 88], ratio: [0.4, 0.43] },
};

/** Campeões com o papel do motor (motor.js:883/885/894/890/897/901/905). */
const CAMPEOES = {
  yasuo: { magia: false, distancia: false, papel: { dano: 1.15, recebido: 0.85 } },   // motor.js:894
  lux: { magia: true, distancia: true, papel: { dano: 1.59, recebido: 1.05 } },      // motor.js:890
  taric: { magia: true, distancia: false, papel: { dano: 0.9, recebido: 0.75 } },    // motor.js:901
};

/** Põe o campeão EM CAMPO pelo caminho real (ícone da skill no HUD + META.kits). */
function porCampeaoEmCampo(m, id, c) {
  m.montar(IMG_HAB_SEL, [m.el({ tag: 'img', label: 'hud-hab-img', attrs: { src: '/img/habilidades/' + id + '/q.png' } })]);
  return alimentarMeta(m, { kits: { [id]: { kit: KIT, adBase: 60, adNivel: 3, magia: c.magia, distancia: c.distancia, papel: c.papel } } });
}

/** Equipa EXACTAMENTE estas bases (contrato do readEquip, automation.js:954:
 *  '#equip > button.slot[data-id]' com '<base>~<qual>'). */
function montarEquip(m, bases, qual) {
  m.montar('#equip > button.slot[data-id]', bases.map((b) => m.el({
    tag: 'button', label: 'equip:' + b,
    className: 'slot ' + (ITENS_DADOS.find((x) => String(x.id) === b) || {}).raridade,
    attrs: { 'data-id': b + '~' + (qual || 'A'), 'data-dica': '' },
  })));
}

/** A MOCHILA com as bases dadas (contrato do scanBag). */
function montarMochila(m, bases) {
  const slots = bases.map((b) => {
    const it = ITENS_DADOS.find((x) => String(x.id) === b) || {};
    return m.el({ tag: 'button', label: 'mochila:' + b, className: 'slot ' + (it.raridade || 'lendario'), attrs: { 'data-id': b + '~A', 'data-dica': (it.nome || '') } });
  });
  m.montar('#janela-bolsa', [m.el({ label: 'janela-bolsa' })]);
  m.montar('#mochila', [m.el({ label: 'mochila', children: slots })]);
  m.montar('#mochila-qtd', [m.el({ label: 'mochila-qtd', textContent: '(' + bases.length + '/30)' })]);
}

const champ = (id, c) => ({ id, magia: c.magia, distancia: c.distancia, papel: c.papel });

export const suite = {
  nome: 'build-equipada',
  titulo: 'A build vencedora fica equipada e nenhum item fora dela fica vestido (TK-01-36)',

  async run(t) {
    for (const [id, c] of Object.entries(CAMPEOES)) {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarMeta(m, { itens: ITENS_DADOS });
      m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
      m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
      porCampeaoEmCampo(m, id, c);
      const build = auto.buildIdealPara(champ(id, c));

      /* ---- 1. a build vencedora EQUIPADA fica quieta ---- */
      montarEquip(m, build);
      const r1 = auto.planoEquipar(auto.scanBag(true));
      t.check('E1[' + id + ']: com a build [' + build.join(',') + '] vestida, o planeador não mexe',
        r1.mexe === false && (r1.entram || []).length === 0 && (r1.saem || []).length === 0);
      t.check('E1[' + id + ']: e a assinatura lida nos slots é exactamente a build',
        JSON.stringify((r1.atual || []).map((e) => String(e.base)).sort()) === JSON.stringify(build.slice().sort()));

      /* ---- 2. um item FORA da build que esteja vestido tem de sair ---- */
      const fora = (ITENS_DADOS || []).find((x) => x.raridade === 'lendario' && build.indexOf(String(x.id)) < 0);
      montarEquip(m, build.concat([String(fora.id)]));
      montarMochila(m, build.concat([String(fora.id)]));
      const r2 = auto.planoEquipar(auto.scanBag(true));
      t.check('E2[' + id + ']: o item FORA da build (' + fora.id + ' ' + fora.nome + ') vestido é marcado para SAIR',
        (r2.saem || []).some((e) => String(e.base) === String(fora.id)));
      t.check('E2[' + id + ']: e não volta a entrar', !(r2.entram || []).some((e) => String(e.base) === String(fora.id)));

      /* ---- 3. os 4 itens nao-bota da build sao os 4 melhores do catalogo ---- */
      // (a bota e o 5.o slot e e naturalmente mais fraca que uma arma: comparar armas com a
      // bota nao provaria nada. O que garante 'nada fora da build e vestido' e que os QUATRO
      // espacos livres fiquem com os quatro melhores -- exactamente o que o escolherConjunto
      // do alvoEquip/planoEquipar faz, e o valorDe e a bitola dele.)
      const ehBota = (i) => (i.espaco === 'botas');
      const naoBota = (ITENS_DADOS || []).filter((x) => x.raridade === 'lendario' && !ehBota(x));
      const valores = naoBota.map((x) => ({ id: String(x.id), v: auto.valorDe(x.id) })).sort((a, b) => b.v - a.v);
      const top4 = valores.slice(0, 4).map((x) => x.id).sort();
      const buildNaoBota = build.filter((b) => { const it = ITENS_DADOS.find((x) => String(x.id) === b); return it && !ehBota(it); }).sort();
      t.check('E3[' + id + ']: os 4 nao-bota da build sao os 4 melhores do catalogo (' + buildNaoBota.join(',') + ')',
        JSON.stringify(buildNaoBota) === JSON.stringify(top4));
      // e a bota da build e a melhor bota lendaria:
      const botas = (ITENS_DADOS || []).filter((x) => x.raridade === 'lendario' && ehBota(x));
      const botaBuild = build.filter((b) => { const it = ITENS_DADOS.find((x) => String(x.id) === b); return it && ehBota(it); })[0];
      const melhorBota = botas.map((x) => ({ id: String(x.id), v: auto.valorDe(x.id) })).sort((a, b) => b.v - a.v)[0];
      t.check('E3[' + id + ']: e a bota da build (' + botaBuild + ') e a melhor bota do catalogo (' + melhorBota.id + ')',
        botaBuild === melhorBota.id);

      t.check('Z[' + id + ']: nenhum seletor desconhecido foi usado (stub honesto)', m.unstubbed().length === 0);
    }
  },
};
