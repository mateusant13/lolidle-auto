/*
 * barrafase.test.mjs - BARRA POR FASE: a fase tem de mudar o CONJUNTO (TK-02-18).
 *
 * MOTIVO: a \`barraIdeal\` tinha a preferência por multi-alvo MORTA — o \`aplicarKit\` não
 * carregava o campo \`alvos\` do kit (o inject.js reencaminha, inject.js:126) e o bloco
 * \`if (porFase)\` vinha DEPOIS do bloco de disponibilidade, que sempre saía antes.
 * MEDIDO antes desta correcção: \`ideal mobs\` == \`ideal chefe\` para a Katarina — a fase
 * não mudava nada. Agora o peso da fase (dano x alvos em mobs; dano só no chefe) decide
 * QUAIS skills merecem os 4 lugares, e a disponibilidade continua a mandar na ORDEM.
 *
 * O que se protege:
 *   F1 - o \`alvos\` do kit do motor chega à decisão (Katarina Q/R = 3, motor.js:751/759);
 *   F2 - num kit de área a barra de MOBS difere da de CHEFE (multi-alvo entra/sai);
 *   F3 - a ULTIMATE continua sempre dentro e em 1.o (regra inviolável do dono);
 *   F4 - com \`skillsPorFase=false\` volta a uma barra só (desligável, pedido do dono);
 *   F5 - a KATARINA real (kit vivo do repo): as barras coincidem LEGITIMAMENTE — as
 *        únicas skills de área dela (Q e R) já estão dentro nas duas fases.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import fs from 'node:fs';
import path from 'node:path';
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao, RAIZ } from './dom-stub.mjs';

export const suite = {
  nome: 'barrafase',
  titulo: 'Barra por fase: o conjunto muda com a fase (alvos do kit do motor)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    // REGRA DA ULTIMATE (dono, 2026-10-19): por defeito a ultimate SAI da barra de MOBS (recarga
    // BASE > 35 s). Esta suite testa o PESO DA FASE (multi-alvo vs alvo único), não a regra nova;
    // força "sempre ultimate em mobs" para comparar as barras com o mesmo conjunto. A regra em si
    // é provada em `ult-fase.test.mjs`.
    auto.setConfig({ ultEmMobs: true });

    /* ---- kit de áreas de teste: Q com alvos 3 e 3 skills de alvo único mais fortes ---- */
    // Os números (base/ratio/recarga) são de TESTE; o que tem de ser real é o campo
    // \`alvos\` — o mesmo campo que o motor declara (motor.js:751/759 Katarina, :736 Yasuo M).
    const kitArea = {
      Q: { nivel: 1, max: 10, base: [90], ratio: [0.1], recarga: [10], alvos: 3 },
      A: { nivel: 1, max: 10, base: [300], ratio: [0], recarga: [10] },
      B: { nivel: 1, max: 10, base: [250], ratio: [0], recarga: [10] },
      C: { nivel: 1, max: 10, base: [200], ratio: [0], recarga: [10] },
      R: { nivel: 6, max: 5, base: [500], ratio: [0.5], recarga: [75, 65, 55, 48, 42] },
    };
    definirCampeao(m, 'aptest', { kit: kitArea, magia: false });
    // stats: dano 300 -> Q dps = (90+30)/10 = 12 (x3 = 36 em mobs) | A = 30 | B = 25 | C = 20.
    // O arsenal tem de estar NO DOM: o `dpsPorHabilidade` lê `#hab-ativas .hab[data-t]`
    // (readSkills), não o arsenal passado à barraIdeal — sem ele o dpsDe fica vazio e a
    // decisão cai no desempate (foi assim que o teste antigo passou pela razão errada).
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
    m.montar('.st', [m.el({ label: 'st-dano', textContent: 'Dano 300' })]);
    const montarArsenal = () => m.montar('#hab-ativas .hab[data-t]', ['Q', 'A', 'B', 'C', 'R'].map((tt) => m.el({
      tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
      textContent: (tt === 'R' ? 1 : 10) + ' / ' + (tt === 'R' ? 5 : 10),
    })));
    montarArsenal();
    const ars = [
      { t: 'Q', rank: 10 }, { t: 'A', rank: 10 }, { t: 'B', rank: 10 }, { t: 'C', rank: 10 }, { t: 'R', rank: 1 },
    ];
    const clon = () => ars.map((h) => ({ t: h.t, rank: h.rank }));

    const mobs = auto.barraIdeal({ arsenal: clon() }, 'mobs');
    const chefe = auto.barraIdeal({ arsenal: clon() }, 'boss');
    const igual = (a, b) => a.length === b.length && a.slice().sort().join(',') === b.slice().sort().join(',');

    t.check('F1: a barra de MOBS tem a skill de área (Q, alvos 3) dentro', mobs.indexOf('Q') >= 0);
    t.check('F2: a barra de MOBS difere da de CHEFE (a fase muda o CONJUNTO)', !igual(mobs, chefe));
    t.check('F2: no CHEFE a skill de área fraca (Q) sai e entra a de alvo único (C)',
      chefe.indexOf('Q') < 0 && chefe.indexOf('C') >= 0);
    t.check('F2: em MOBS a de área (Q) está e a mais fraca (C) fica de fora',
      mobs.indexOf('Q') >= 0 && mobs.indexOf('C') < 0);
    t.check('F3: a ULTIMATE está nas duas barras e em 1.o lugar', mobs[0] === 'R' && chefe[0] === 'R');
    t.check('F3: as duas barras têm 4 slots', mobs.length === 4 && chefe.length === 4);

    /* ---- F4 - desligável (cfg.skillsPorFase === false volta a uma barra só) ---- */
    auto.setConfig({ skillsPorFase: false });
    const off = auto.barraIdeal({ arsenal: clon() }, 'mobs');
    const offB = auto.barraIdeal({ arsenal: clon() }, 'boss');
    t.check('F4: DESLIGADO, mobs e chefe voltam a dar o MESMO conjunto', igual(off, offB));
    t.check('F4: desligado, a barra enche na mesma os 4 slots', off.length === 4);
    auto.setConfig({ skillsPorFase: true });
    t.check('F4: o config volta a ficar ligado por defeito', auto.skillsPorFase() === true);

    /* ---- F5 - a KATARINA REAL (kit vivo lido do repo, nunca editado à mão) ---- */
    // docs/game-src/kit-katarina-vivo.json — LIDO do jogo vivo (tools/probe-kits.mjs).
    // As únicas skills de área dela são Q e R (\`alvos: 3\`, motor.js:751/759); como o Q já
    // é a 2.a melhor skill a DANO também no chefe, as duas fases querem as MESMAS 4 —
    // coincidir é o resultado CORRETO (não há troca para forçar).
    let kitVivo = null;
    try {
      const vivo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/game-src/kit-katarina-vivo.json'), 'utf8').replace(/^\/\/.*$/gm, ''));
      kitVivo = vivo && vivo.kit && vivo.kit.hab ? vivo.kit.hab : null;
    } catch { kitVivo = null; }
    if (kitVivo) {
      definirCampeao(m, 'katarina', { kit: kitVivo, magia: true });
      m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
      // arsenal real da Katarina ao nível 29 (Q10 W6 E6 R3 G4 A2 F1 T1) e o resto do painel
      const kRanks = { Q: 10, W: 6, E: 6, R: 3, G: 4, A: 2, F: 1, T: 1 };
      m.montar('#hab-ativas .hab[data-t]', Object.keys(kRanks).map((tt) => m.el({
        tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt }, textContent: kRanks[tt] + ' / 10',
      })));
      const kArs = Object.keys(kRanks).map((tt) => ({ t: tt, rank: kRanks[tt] }));
      const kMobs = auto.barraIdeal({ arsenal: kArs, bar: [] }, 'mobs');
      const kChefe = auto.barraIdeal({ arsenal: kArs, bar: [] }, 'boss');
      t.check('F5: KATARINA real — a barra de MOBS tem a ultimate em 1.o', kMobs[0] === 'R');
      t.check('F5: KATARINA real — a barra de CHEFE tem a ultimate em 1.o', kChefe[0] === 'R');
      t.check('F5: KATARINA real — as duas fases querem as MESMAS 4 (coincidem legitimamente)',
        igual(kMobs, kChefe));
      t.check('F5: KATARINA real — a barra traz Q e R (as duas de área, motor.js:751/759)',
        kMobs.indexOf('Q') >= 0 && kMobs.indexOf('R') >= 0);
    } else {
      t.check('F5: kit vivo da Katarina encontrado no repo (docs/game-src/kit-katarina-vivo.json)', false,
        'ficheiro ausente ou sem .kit.hab');
    }
  },
};
