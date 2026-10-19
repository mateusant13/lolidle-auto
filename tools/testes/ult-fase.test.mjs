/*
 * ult-fase.test.mjs - A REGRA DA ULTIMATE POR FASE (pedido do dono, 2026-10-19) e o PORTÃO DO
 * MERCADO (comprar a build e auto-play, não manutenção).
 *
 * DONO, verbatim:
 *   "as skills tem uma regra: caso a fase esteja facil de fazer/nao demorada, nao use ultimates.
 *    ultimates tem 35 plus seconds. BASE. nao apos cdr e etc. caso a fase seja dificil, sendo
 *    boss OU NAO, ai pode usar. ja, sendo boss, tem que usar de certeza todas as skills."
 *   "auto play desligado nao devia abrir o mercado por mim pra pesquisar items a comprar. isso
 *    e autoplay."
 *
 * O que se protege (cada check falha na versão ERRADA — REGRA N.º 6, verde sem discriminação nao
 * e prova):
 *   U1 - em MOBS FÁCIL (dificuldade medida = false) a ultimate SAI da barra;
 *   U2 - em MOBS DIFÍCIL (dificuldade = true) a ultimate ENTRA e fica em 1.º;
 *   U3 - no CHEFE a ultimate ENTRA sempre (mesmo com dificuldade = false);
 *   U4 - o override `cfg.ultEmMobs=true` força a ultimate em mobs (reversível pelo dono);
 *   U5 - `mercadoTemDaBuild()` e fail-open: sem leitura (desconhecido) devolve null, nunca false;
 *   U6 - `podeFazer('comprar')` herda o auto-play: desligado (ou fora do alvo) NAO abre o mercado.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

/** Mundo com 4 skills de alvo único (Q>A>B>C) + a ultimate (R). O DOM tem de ter o arsenal
 *  porque o `dpsPorHabilidade` lê `#hab-ativas .hab[data-t]` (readSkills). */
function mundo() {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  const kit = {
    Q: { nivel: 1, max: 10, base: [300], ratio: [0], recarga: [10] },
    A: { nivel: 1, max: 10, base: [250], ratio: [0], recarga: [10] },
    B: { nivel: 1, max: 10, base: [200], ratio: [0], recarga: [10] },
    C: { nivel: 1, max: 10, base: [150], ratio: [0], recarga: [10] },
    R: { nivel: 6, max: 5, base: [500], ratio: [0], recarga: [75, 65, 55, 48, 42] },   // CD BASE 42 s
  };
  definirCampeao(m, 'aptest', { kit, magia: false });
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
  m.montar('.st', [m.el({ label: 'st-dano', textContent: 'Dano 300' })]);
  m.montar('#hab-ativas .hab[data-t]', ['Q', 'A', 'B', 'C', 'R'].map((tt) => m.el({
    tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
    textContent: (tt === 'R' ? 1 : 10) + ' / ' + (tt === 'R' ? 5 : 10),
  })));
  alimentarMeta(m, {});
  const ars = () => [{ t: 'Q', rank: 10 }, { t: 'A', rank: 10 }, { t: 'B', rank: 10 }, { t: 'C', rank: 10 }, { t: 'R', rank: 1 }];
  return { m, auto, ars };
}

function provaUltimate(t) {
  const { auto, ars } = mundo();
  auto.setConfig({ ultEmMobs: false });   // regra em vigor (default)

  /* U1 - MOBS FÁCIL: a ultimate SAI (recarga BASE ~42 s; não se gasta numa fase curta) */
  const facil = auto.barraIdeal({ arsenal: ars() }, 'mobs', false);
  t.check('U1: mobs FÁCIL -> a ULTIMATE NAO entra na barra', facil.indexOf('R') < 0, JSON.stringify(facil));
  t.check('U1: mobs FÁCIL -> a barra nao fica vazia (enche com as 4 melhores nao-ultimate)',
    facil.length === 4 && facil.indexOf('Q') >= 0, JSON.stringify(facil));

  /* U2 - MOBS DIFÍCIL: a ultimate ENTRA, em 1.º */
  const dificil = auto.barraIdeal({ arsenal: ars() }, 'mobs', true);
  t.check('U2: mobs DIFÍCIL -> a ULTIMATE ENTRA na barra', dificil.indexOf('R') >= 0, JSON.stringify(dificil));
  t.check('U2: mobs DIFÍCIL -> a ultimate fica em 1.º (nunca cai pelo corte dos 4)', dificil[0] === 'R', JSON.stringify(dificil));

  /* U3 - CHEFE: a ultimate ENTRA SEMPRE (usar "todas as skills"), mesmo com dificuldade false */
  const chefe = auto.barraIdeal({ arsenal: ars() }, 'boss', false);
  t.check('U3: CHEFE -> a ULTIMATE ENTRA sempre', chefe.indexOf('R') >= 0, JSON.stringify(chefe));
  t.check('U3: CHEFE -> a ultimate em 1.º', chefe[0] === 'R', JSON.stringify(chefe));

  /* U4 - OVERRIDE do dono: `ultEmMobs=true` volta a forçar a ultimate em mobs (reversível) */
  auto.setConfig({ ultEmMobs: true });
  const forcado = auto.barraIdeal({ arsenal: ars() }, 'mobs', false);
  t.check('U4: com ultEmMobs=true a ultimate volta a mobs (a regra é desligável)', forcado.indexOf('R') >= 0, JSON.stringify(forcado));
  auto.setConfig({ ultEmMobs: false });

  /* U5 - PRE-CHECAGEM do mercado: fail-open (desconhecido -> null, nunca false) */
  t.check('U5: mercadoTemDaBuild() é fail-open sem leitura (null, nao false)',
    auto.mercadoTemDaBuild() === null);

  /* U6 - COMPRAR a build e AUTO-PLAY: o portão herda o auto-play (candeeiro da queixa do dono) */
  auto.setConfig({ champAlvo: ['aptest'], enabled: true });
  t.check('U6: campeao no alvo + auto-play ligado -> pode comprar', auto.podeFazer('comprar').pode === true);
  auto.setConfig({ enabled: false });
  t.check('U6: AUTO-PLAY DESLIGADO -> NAO pode abrir o mercado para comprar', auto.podeFazer('comprar').pode === false);
  auto.setConfig({ enabled: true, champAlvo: ['outro'] });
  t.check('U6: campeao FORA do alvo (Katarina) -> NAO pode comprar (era o defeito ao vivo)',
    auto.podeFazer('comprar').pode === false);
}

export const suite = {
  nome: 'ult-fase',
  titulo: 'Regra da ultimate por fase (facil/dificil/chefe) e portao do mercado (auto-play)',
  async run(t) {
    provaUltimate(t);
  },
};
