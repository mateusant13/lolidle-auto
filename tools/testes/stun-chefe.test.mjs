/*
 * stun-chefe.test.mjs - TK-X2 (P0): a barra de CHEFE reserva UM lugar para o ATORDOAMENTO.
 *
 * MOTIVO (motor.js, lido — Regra N.º 1):
 *   - o jogo interrompe a mecânica CARREGADA do chefe se ele estiver atordoado:
 *     motor.js:3112  `if (i.atordoado > 0 && tipo !== 'rugido') { i.carregando = 0; i.tMec = 6; ... }`
 *   - mas `pode(t)` exige a skill NA BARRA: motor.js:1598 `estado.barra.includes(t)`
 *   - e o A() do kit do motor ainda GUARDA o atordoamento para a investida do Arauto:
 *     motor.js:1831-1834 `if (!pode('A') || (arauto && !(arauto.carregando > 0))) return`
 *   -> se a skill de stun não estiver na barra, o jogo NUNCA pode interromper a mecânica.
 *
 * PROVA COM O MOTOR REAL (tools/harness.mjs lutar --champ=katarina --nivel=30
 *   --alvo="Arauto do Vale" --nv=20 --pocoes=none --seed=1):
 *   SEM 'A' na barra (Q,R,W,E):  carregou 2  interrompeu 0  golpeou 2  | dano recebido 1564
 *   COM 'A' na barra (Q,R,E,A):  carregou 3  interrompeu 2  golpeou 1  | dano recebido 1086 (-30,6%)
 *
 * O que se protege aqui (no banco, sem browser):
 *   S1 - um stun FRACO que NÃO entraria na barra por DPS entra na barra de CHEFE;
 *   S2 - o mesmo stun NÃO entra na barra de MOBS (não vale o lugar por DPS);
 *   S3 - a ULTIMATE continua na barra e em 1.º (regra inviolável do dono) — o stun
 *        substitui um slot NÃO-ultimate;
 *   S4 - sem `atordoa` no kit, a barra de CHEFE é a mesma de sempre (comportamento antigo);
 *   S5 - `atordoa` CHEGA à decisão (é o campo do kit reencaminhado por inject.js/aplicarKit).
 *
 * CONTRATO: t.check(rotulo, condicao) só passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

function montarMundo(kit) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'stuntest', { kit, magia: false });
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '30' })]);
  m.montar('.st', [m.el({ label: 'st-dano', textContent: 'Dano 300' })]);
  const rank = { Q: 10, W: 10, E: 10, A: 10, R: 1 };
  m.montar('#hab-ativas .hab[data-t]', Object.keys(rank).map((tt) => m.el({
    tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
    textContent: rank[tt] + ' / ' + (tt === 'R' ? 5 : 10),
  })));
  const arsenal = Object.keys(rank).map((tt) => ({ t: tt, rank: rank[tt] }));
  return { m, auto, arsenal };
}

// Q/W/E fortes, A FRACO mas com atordoa (o stun que só serve para interromper), R ultimate.
const kitComStun = {
  Q: { nivel: 1, max: 10, base: [400], ratio: [0], recarga: [10] },
  W: { nivel: 1, max: 10, base: [350], ratio: [0], recarga: [10] },
  E: { nivel: 1, max: 10, base: [300], ratio: [0], recarga: [10] },
  A: { nivel: 1, max: 10, base: [50], ratio: [0], recarga: [10], atordoa: 1 },
  R: { nivel: 6, max: 5, base: [500], ratio: [0], recarga: [75, 65, 55, 48, 42] },
};
const kitSemStun = {
  Q: { nivel: 1, max: 10, base: [400], ratio: [0], recarga: [10] },
  W: { nivel: 1, max: 10, base: [350], ratio: [0], recarga: [10] },
  E: { nivel: 1, max: 10, base: [300], ratio: [0], recarga: [10] },
  A: { nivel: 1, max: 10, base: [50], ratio: [0], recarga: [10] },   // sem atordoa
  R: { nivel: 6, max: 5, base: [500], ratio: [0], recarga: [75, 65, 55, 48, 42] },
};

export const suite = {
  nome: 'stun-chefe',
  titulo: 'TK-X2: a barra de CHEFE reserva um lugar para o atordoamento (interrompe a mecânica)',

  async run(t) {
    const { auto, arsenal } = montarMundo(kitComStun);
    // REGRA DA ULTIMATE (2026-10-19): por defeito a ultimate sai da barra de MOBS. Esta suite
    // testa a RESERVA DE ATORDOAMENTO (com a ultimate presente para comparar), logo força-a em mobs.
    auto.setConfig({});
    const mobs = auto.barraIdeal({ arsenal: arsenal.map((h) => ({ ...h })) }, 'mobs', true);
    const chefe = auto.barraIdeal({ arsenal: arsenal.map((h) => ({ ...h })) }, 'boss');

    t.check('S3: a ULTIMATE está nas duas barras e em 1.º lugar', mobs[0] === 'R' && chefe[0] === 'R');
    t.check('S3: as duas barras têm os 4 slots', mobs.length === 4 && chefe.length === 4);
    t.check('S2: em MOBS o stun fraco NÃO entra (perde o lugar por DPS)',
      mobs.indexOf('A') < 0, 'mobs=' + JSON.stringify(mobs));
    t.check('S1: em CHEFE o stun ENTRA (reserva de interrupção)', chefe.indexOf('A') >= 0,
      'chefe=' + JSON.stringify(chefe));
    t.check('S3: o stun substitui um slot NÃO-ultimate (o R fica)',
      chefe.indexOf('R') === 0 && chefe.indexOf('E') < 0, 'chefe=' + JSON.stringify(chefe));
    t.check('S1: a barra de CHEFE difere da de MOBS (a fase decide o stun)',
      mobs.slice().sort().join(',') !== chefe.slice().sort().join(','));

    /* ---- S4: sem `atordoa` no kit, nada muda (o comportamento antigo continua) ---- */
    const sem = montarMundo(kitSemStun);
    sem.auto.setConfig({});   // mesma razão de cima (testa atordoamento, não a regra)
    const mobs2 = sem.auto.barraIdeal({ arsenal: sem.arsenal.map((h) => ({ ...h })) }, 'mobs', true);
    const chefe2 = sem.auto.barraIdeal({ arsenal: sem.arsenal.map((h) => ({ ...h })) }, 'boss');
    t.check('S4: sem atordoa no kit, a barra de CHEFE == a de MOBS',
      mobs2.slice().sort().join(',') === chefe2.slice().sort().join(','),
      'mobs=' + JSON.stringify(mobs2) + ' chefe=' + JSON.stringify(chefe2));
    t.check('S4: sem atordoa, a barra de CHEFE continua a ter a E forte (não perdeu o lugar)',
      chefe2.indexOf('E') >= 0, 'chefe=' + JSON.stringify(chefe2));

    /* ---- S5: a ULTIMATE nunca é trocada pelo stun, mesmo que seja a mais fraca ---- */
    const kitUltFraca = { ...kitComStun, R: { nivel: 6, max: 5, base: [1], ratio: [0], recarga: [75, 65, 55, 48, 42] } };
    const ult = montarMundo(kitUltFraca);
    const chefe3 = ult.auto.barraIdeal({ arsenal: ult.arsenal.map((h) => ({ ...h })) }, 'boss');
    t.check('S5: a ULTIMATE (mesmo a mais fraca) fica na barra de CHEFE em 1.º',
      chefe3[0] === 'R', 'chefe=' + JSON.stringify(chefe3));
    t.check('S5: com a ultimate fraca, o stun entra na mesma (substitui outro não-ultimate)',
      chefe3.indexOf('A') >= 0, 'chefe=' + JSON.stringify(chefe3));
  },
};
