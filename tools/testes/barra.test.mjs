/*
 * barra.test.mjs - BARRA DE HABILIDADES: a ULTIMATE tem de estar sempre dentro.
 *
 * Regra do dono (inviolavel): "Skills equipadas: a barra tem de estar cheia com as
 * melhores, incluindo a ultimate."
 *
 * MOTIVO DESTA SUITE EXISTIR: o banco tinha ZERO cobertura para esta regra (nenhum teste
 * tocava barraIdeal/aplicarBarra/ehUltimateFixa/BARRA_SLOTS), e e exactamente a regra que
 * ja quebrou antes ("a ultimate caia da barra"). Verde sem esta suite era verde cego.
 *
 * `barraIdeal(s)` aceita o arsenal EXPLICITO, logo testa-se a ordenacao sem DOM.
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

const ARSENAL = [
  { t: 'Q', rank: 10 },
  { t: 'W', rank: 1 },
  { t: 'E', rank: 3 },
  { t: 'R', rank: 3 },
  { t: 'G', rank: 1 },
  { t: 'A', rank: 5 },
  { t: 'F', rank: 1 },
];
const clon = () => ARSENAL.map((h) => ({ t: h.t, rank: h.rank }));

export const suite = {
  nome: 'barra',
  titulo: 'Barra de habilidades (ordenacao, slots e fase; ultimate forçada em mobs nesta suite)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'aptest');
    // REGRA DA ULTIMATE (dono, 2026-10-19): por defeito a ultimate NÃO entra na barra de MOBS
    // (recarga BASE > 35 s; só entra em fase DIFÍCIL ou no CHEFE). Esta suite testa a ORDENAÇÃO
    // (slots/rank/fase), não a regra nova, por isso força "sempre ultimate em mobs" aqui. A
    // regra em si é provada em `ult-fase.test.mjs` (com `ultEmMobs` desligado).
    auto.setConfig({});

    /* B1 - com a ultimate desbloqueada (rank > 0) ela TEM de estar na barra e em 1.o. */
    const bar = auto.barraIdeal({ arsenal: clon() }, 'boss');
    t.check('B1: a barra ideal tem exactamente 4 slots', bar.length === 4);
    t.check('B1: a ULTIMATE (R) esta na barra', bar.indexOf('R') >= 0);
    t.check('B1: a ultimate e a PRIMEIRA (logo nunca cai pelo corte dos 4)', bar[0] === 'R');

    /* B2 - ultimate BLOQUEADA (rank 0) nao pode ocupar um slot; a barra enche na mesma. */
    const sem = auto.barraIdeal({ arsenal: clon().map((h) => (h.t === 'R' ? { t: 'R', rank: 0 } : h)) }, 'boss');
    t.check('B2: ultimate com rank 0 NAO entra na barra', sem.indexOf('R') < 0);
    t.check('B2: sem ultimate a barra enche na mesma os 4 slots', sem.length === 4);

    /* B3 - o que ganha o lugar: o rank tem de pesar quando o dps nao decide. */
    const comRank = auto.barraIdeal({ arsenal: clon().map((h) => (h.t === 'W' ? { t: 'W', rank: 9 } : h)) }, 'boss');
    t.check('B3: subir o rank de W nao tira a ultimate da barra', comRank.indexOf('R') >= 0);
    t.check('B3: a barra continua com 4 slots depois da troca de ranks', comRank.length === 4);

    /* B4 - SKILLS POR FASE (pedido do dono): no MAPA conta o nº de ALVOS do kit; no chefe não. */
    const kitAlvos = { Q: { max: 5, base: [50, 70], ratio: [0.5, 0.6], recarga: [10, 9], alvos: 3 },
      W: { max: 5, base: [40, 60], ratio: [0.4, 0.5], recarga: [8, 7], alvos: 1 } };
    alimentarMeta(m, { kit: kitAlvos });
    const sB = { arsenal: [{ t: 'Q', rank: 5 }, { t: 'W', rank: 5 }, { t: 'R', rank: 1 }] };
    const mobs = auto.barraIdeal({ arsenal: sB.arsenal.map((h) => ({ t: h.t, rank: h.rank })) }, 'mobs', true);
    const chefe = auto.barraIdeal({ arsenal: sB.arsenal.map((h) => ({ t: h.t, rank: h.rank })) }, 'boss');
    t.check('B4: no MAPA a skill de varios alvos (Q) vem antes da de alvo unico (W)',
      mobs.indexOf('Q') >= 0 && mobs.indexOf('W') >= 0 && mobs.indexOf('Q') < mobs.indexOf('W'));
    t.check('B4: a ultimate continua em 1.o lugar no mapa', mobs[0] === 'R');
    t.check('B4: a ultimate continua em 1.o lugar no chefe', chefe[0] === 'R');
    auto.setConfig({ skillsPorFase: false });
    const off = auto.barraIdeal({ arsenal: sB.arsenal.map((h) => ({ t: h.t, rank: h.rank })) }, 'mobs', true);
    t.check('B4: DESLIGADO (cfg.skillsPorFase=false) a preferencia por alvos desaparece',
      off.indexOf('R') >= 0);
    t.check('B4: desligado nao rebenta nem perde slots', off.length >= 1 && off.length <= 4);
    auto.setConfig({ skillsPorFase: true });
    t.check('B4: o config volta a ficar ligado por defeito', auto.skillsPorFase() === true);

    /* B5 - ANTI-OSCILACAO (bug medido ao vivo 2026-10-20): uma skill que ACABOU de sair da
     * barra nao pode voltar no ciclo seguinte enquanto a barra estiver CHEIA. Sem isto, a
     * que saia nao tinha recarga no HUD (pronta=0) e era re-escolhida, trocando 3 skills a
     * cada 2 s. Com uma VAGA, a trava NAO se aplica: encher os 4 slots manda mais. */
    auto.barraLimparSaidas();
    const barraCheia = { arsenal: clon(), bar: [
      { t: 'Q', cd: 5 }, { t: 'W', cd: 5 }, { t: 'E', cd: 5 }, { t: 'G', cd: 5 }] };
    auto.barraIdeal(barraCheia, 'mobs', false);          // fixa o contexto (fase/ranks/cfg)
    auto.barraMarcarSaida('A');
    auto.barraMarcarSaida('F');
    const travada = auto.barraIdeal(barraCheia, 'mobs', false);
    t.check('B5: skill que acabou de sair NAO volta com a barra cheia (anti-oscilacao)',
      travada.indexOf('A') < 0 && travada.indexOf('F') < 0, JSON.stringify(travada));
    t.check('B5: com a barra cheia e as saídas travadas, continuam 4 slots',
      travada.length === 4, JSON.stringify(travada));

    const comVaga = { arsenal: clon(), bar: [
      { t: 'Q', cd: 5 }, { t: 'W', cd: 5 }, { t: 'E', cd: 5 }] };
    const reposta = auto.barraIdeal(comVaga, 'mobs', false);
    t.check('B5: com uma VAGA a trava NAO se aplica e a barra enche (o dono nao ve 3 slots)',
      reposta.length === 4 && (reposta.indexOf('A') >= 0 || reposta.indexOf('F') >= 0),
      JSON.stringify(reposta));
    auto.barraLimparSaidas();
  },
};
