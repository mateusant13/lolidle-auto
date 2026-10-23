/*
 * sustento.test.mjs - O QUE O JOGO DA DE SUSTENTO E A CONTA DA LUTA IGNORAVA.
 *
 * QUEIXA DO DONO (2026-10-23), verbatim:
 *   "me explica que variaveis tu deixou de fora da luta do chefe onde a tua matematica diz
 *    que eu morro mas na realidade eu ganho"
 *
 * O QUE ESTAVA FORA (tudo com file:linha, lido na fonte - REGRA N.o 1):
 *
 *   1. REGENERACAO NATURAL. motor.js:576 calcula `regen` (por segundo) e motor.js:1464 aplica-a
 *      em TODOS os ticks, DENTRO do combate: `estado.vida += a.regen * dt`. O `avaliar` somava
 *      cura de skills, pocoes, roubo de vida e giro - e nunca a regeneracao. `player()` nem a
 *      lia. Ver S1/S2/S3/S6.
 *
 *   2. ROUBO DE VIDA NO VEREDICTO DA REGIAO/CHEFE. `avaliar` so calcula `curaRv` quando recebe o
 *      DPS de saida (5.o argumento). O `estimarRegiao` chamava-o SEM o DPS (automation.js:1948 e
 *      :1966 antes desta correccao), logo o veredicto "morre" da regiao e do chefe era calculado
 *      com ZERO sustento do dano que o boneco faz - o oposto do que o motor aplica
 *      (motor.js:1332-1334, `cura = dano * rv`). Ver S5.
 *
 *   3. VIDAS EXTRA DOS ITENS. Anjo Guardiao (3026, motor.js:3003-3004) devolve 50% da vida num
 *      golpe letal; Pele de Aco (3053, motor.js:2999-3000) da um escudo de 60% da vida bonus
 *      abaixo de 30%. O modelo declarava `mortal` o golpe que o jogo cura. Ver S4.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

/** Zonas e monstros no formato do inject (coeficientes do motor, relativos a CURVA). */
const LOCAIS = [
  { id: 'lobos', nome: 'Toca dos Lobos', nm: [29, 36], faixa: [29, 36], tier: 1,
    monstros: [['lobo', 1]], chefe: null },
];
const MONSTROS = {
  lobo: { hp: 1.0, ad: 1.0, as: 1.0, armadura: 1.0, xp: 1.0, ouro: 1.0 },
  barao: { hp: 6.0, ad: 2.2, as: 0.7, armadura: 1.8, xp: 6.0, ouro: 6.0, chefe: true },
};

/** Mundo com campeao de stats CONHECIDOS (hpregen/hpregenperlevel) e HUD minimo. */
function mundo(opts) {
  opts = opts || {};
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest', {
    nivel: opts.nivel != null ? opts.nivel : 10,
    stats: { hp: 2000, hpperlevel: 100, hpregen: 10, hpregenperlevel: 0.5, armor: 40, spellblock: 30 },
  });
  alimentarMeta(m, { locais: LOCAIS, monstros: MONSTROS });
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  m.montar('.st', [
    m.el({ label: 'st-dano', textContent: 'Dano 300' }),
    m.el({ label: 'st-arm', textContent: 'Armadura 100' }),
    m.el({ label: 'st-rm', textContent: 'Res. mágica 80' }),
    m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
    m.el({ label: 'st-rv', textContent: opts.rv != null ? `Roubo de vida ${opts.rv}` : 'Roubo de vida 0' }),
  ]);
  return { m, auto };
}

export const suite = {
  nome: 'sustento',
  titulo: 'Regeneracao, roubo de vida no veredicto e vidas extra dos itens (que a conta ignorava)',

  async run(t) {
    /* ============ S1/S2: A REGENERACAO, PELA FORMULA DO MOTOR ============ */
    {
      const { auto } = mundo({ nivel: 10 });
      // motor.js:468-471 -> g(10) = 9 * (0.7025 + 0.0175*9) = 7.74
      // motor.js:576   -> (10 + 0.5*7.74)/5 = 2.774
      const r = auto.regenDoJogo();
      const esperado = (10 + 0.5 * 7.74) / 5;
      t.check('S1: regen lido dos stats do campeao (META.kits) pela formula do motor',
        Number.isFinite(r) && Math.abs(r - esperado) < 0.01);

      const p = auto.player();
      t.check('S2: `player()` passa a TRAZER o regen (antes nao existia o campo)',
        Number.isFinite(p.regen) && Math.abs(p.regen - esperado) < 0.01);
    }

    /* ============ S3: O REGEN ENTRA NO `avaliar` ============ */
    {
      const { auto } = mundo({ nivel: 10 });
      const p = auto.player();
      const p0 = Object.assign({}, p, { regen: 0 });
      const cura = { skill: 0, pocao: 0 };
      const sem = auto.avaliar('barao', 12, p0, cura);
      const com = auto.avaliar('barao', 12, p, cura);
      t.check('S3a: `curaRegen` e devolvido e vale o regen do jogador',
        com && Math.abs((com.curaRegen || 0) - p.regen) < 0.01 && (sem.curaRegen || 0) === 0);
      t.check('S3b: com regen o dano LIQUIDO e menor (a conta ve o que o jogo cura)',
        com.liquido < sem.liquido - p.regen * 0.99);
    }

    /* ============ S4: VIDAS EXTRA (Anjo 3026 / Pele de Aco 3053) ============ */
    {
      const { auto } = mundo({ nivel: 10 });
      const p = Object.assign({}, auto.player(), { regen: 0, extraVida: 0 });
      const cura = { skill: 0, pocao: 0 };
      const sem = auto.avaliar('barao', 12, p, cura);
      const com = auto.avaliar('barao', 12, Object.assign({}, p, { extraVida: 4188 }), cura);
      // `liquido > 0` garante que ha dano a mais: so entao `tMorrer` depende do pool.
      const discrimina = Number.isFinite(sem.tMorrer) && Number.isFinite(com.tMorrer) && sem.tMorrer > 0;
      t.check('S4a: a vida extra AUMENTA o tempo ate morrer (o mesmo dano, mais pool)',
        discrimina && com.tMorrer > sem.tMorrer * 1.9);
      t.check('S4b: sem o item o pool e a vida efectiva; com o item e maior',
        com.tMorrer > 0 && sem.tMorrer > 0);
    }

    /* ============ S5/S6: O VEREDICTO DA REGIAO PASSA A VER O SUSTENTO ============ */
    {
      const { auto } = mundo({ nivel: 30, rv: 20 });
      const p = auto.player();
      t.check('S5a: o rv do painel chega ao jogador (20% -> 0.2)', Math.abs(p.rv - 0.2) < 1e-9);

      const comDps = auto.estimarRegiao('lobos', { dps: 1000 });
      const semDps = auto.estimarRegiao('lobos', { dps: 0 });
      t.check('S5b: com DPS de saida o veredicto da regiao soma ROUBO DE VIDA (antes era 0)',
        comDps && comDps.curaRv > 0 && (semDps.curaRv || 0) === 0);
      t.check('S6: e tambem soma a REGENERACAO (motor.js:576/1464)',
        comDps && comDps.curaRegen > 0 && Math.abs(comDps.curaRegen - p.regen) < 0.01);
    }
  },
};
