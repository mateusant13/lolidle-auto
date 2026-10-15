/*
 * planejar.test.mjs - PLANEJADOR DE FARM: a tabela de drops depende da CLASSE do campeão.
 *
 * TK-02-03 (P0). ANTES: `planejar()` era class-blind — lia `z.porClasse.ap || z.porClasse.ad`
 * e portanto preferia SEMPRE a tabela AP, mesmo num campeão AD (parte-02.md:313-314/340-341).
 * MEDIDO: respondia "onde dropa o item X" com zonas por drops que o campeão nunca recebe.
 *
 * FONTE (REGRA Nº 1 — lido em docs/game-src/motor.js, não copiado):
 *   motor.js:383  const DROPS      = { ... }   -> l.drops    (tabela AD)
 *   motor.js:397  const DROPS_AP   = { ... }   -> l.dropsAp  (tabela AP)
 *   motor.js:407  `for (const l of LOCAIS) { if (DROPS[l.id]) l.drops = ...; if (DROPS_AP[l.id]) l.dropsAp = ...; }`
 *   motor.js:391  barao/DROPS    lendario: ['3031', ...]   <- Gume do Infinito (AD), SEM o 3089
 *   motor.js:405  barao/DROPS_AP lendario: ['3089', ...]   <- Rabadon (AP), SEM o 3031
 *   wiki-dados.js:48-58  `ONDE_ITEM[id][z.id] = { zona, porClasse: { ad|ap } }`
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarMeta, definirCampeao, CATALOGO } from './dom-stub.mjs';

/** Zonas no formato que o inject.js reencaminha (motor.js LOCAIS + wiki-dados.js ONDE_ITEM). */
const ZONA_BARAO = { id: 'barao', nome: 'Covil do Barão', nm: [40, 48], monstros: [['Larva do Vazio', 1]], chefe: ['Barão Nashor', 1] };

/** ONDE_ITEM real: 3089 SÓ na tabela AP do Barão; 3031 SÓ na tabela AD (motor.js:391 vs :405). */
const ONDE_ITEM = {
  '3089': { barao: { zona: ZONA_BARAO, porClasse: { ap: 0.02 } } },
  '3031': { barao: { zona: ZONA_BARAO, porClasse: { ad: 0.02 } } },
};

/** Monstros do Barão (motor.js:290/297). */
const MONSTROS = {
  'Larva do Vazio': { hp: 1.1, ad: 1.05, as: 0.8, armadura: 1, xp: 1.1, ouro: 1, magico: true },
  'Barão Nashor': { hp: 16, ad: 3.2, as: 0.5, armadura: 1.8, xp: 20, ouro: 20, chefe: true, magico: true },
};

/** Ciclos medidos na região do Barão: 12 abates/min -> killsH = 720/h (motor: chance por abate). */
const CYCLES = [
  { region: 'Covil do Barão 40–48', endedAt: 2, deaths: 0, boss: 'Barão Nashor',
    mobFase: { perMin: { gold: 5000, xp: 3000, kills: 12, potions: 1 }, hpMin: 3000, hpMax: 4000 },
    bossFase: { durMs: 60000 } },
];

/** Catálogo do banco + o 3031 real (itens.js:2534) — o 3089 já está no CATALOGO do stub. */
const ITENS = CATALOGO.concat([
  { id: '3031', nome: 'Gume do Infinito', raridade: 'lendario', espaco: 'arma', ad: 75, critico: 0.25, preco: 3500, de: ['1001'] },
]);

export const suite = {
  nome: 'planejar',
  titulo: 'Planejador class-aware: a tabela de drops segue a classe do campeão (motor.js:383/397/407)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarMeta(m, { itens: ITENS, monstros: MONSTROS, ondeItem: ONDE_ITEM });
    auto.importar({ farm: { cycles: CYCLES, log: [], issues: [] } });

    const plano = (champ, ids) => { definirCampeao(m, champ); return auto.planejar(ids); };
    const chanceDe = (r, item) => { const x = (r || []).find((y) => y.item === item); return x ? x.chance : 0; };
    const dropsHDe = (r, item) => { const x = (r || []).find((y) => y.item === item); return x ? x.dropsH : null; };

    /* ---- AP: o Barão continua a ser a resposta para o 3089 ---- */
    const ap = plano('aptest', ['3089']);
    t.check('P1: campeão AP -> o Barão devolve o 3089 (chance > 0)', chanceDe(ap, '3089') > 0);
    t.check('P1: a chance AP é a da tabela DROPS_AP (motor.js:405)', Math.abs(chanceDe(ap, '3089') - 0.02) < 1e-9);
    t.check('P1: com kills medidas, o drops/h é finito (720/h x 0,02)', dropsHDe(ap, '3089') > 0);

    /* ---- AD: o 3089 NÃO é respondido com a zona do Barão ---- */
    const ad = plano('adtest', ['3089']);
    t.check('P2: campeão AD -> o 3089 tem chance 0 (a tabela AD não o tem, motor.js:391)', chanceDe(ad, '3089') === 0);
    t.check('P2: e portanto não há drops/h a prometer', dropsHDe(ad, '3089') === null);

    /* ---- controlo: o Barão responde ao 3031 num campeão AD ---- */
    const ad3031 = plano('adtest', ['3031']);
    t.check('P3: campeão AD -> o 3031 (Gume do Infinito) cai no Barão (motor.js:391)', chanceDe(ad3031, '3031') > 0);
    t.check('P3: e num campeão AP o 3031 não cai lá (motor.js:405 não o lista)', chanceDe(plano('aptest', ['3031']), '3031') === 0);

    /* ---- o plano é uma FUNÇÃO do campeão pedido: mesma entrada, saídas distintas ---- */
    t.check('P4: AP->3089 chance ' + chanceDe(plano('aptest', ['3089']), '3089') + ' e AD->3089 chance ' + chanceDe(plano('adtest', ['3089']), '3089'),
      chanceDe(plano('aptest', ['3089']), '3089') > 0 && chanceDe(plano('adtest', ['3089']), '3089') === 0);
    t.check('P5: nenhum seletor desconhecido foi usado (stub honesto)', m.unstubbed().length === 0);
  },
};
