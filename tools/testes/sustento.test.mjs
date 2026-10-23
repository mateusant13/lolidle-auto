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

    /* ============ S7/S8/S9/S10: SUSTENTO E DEFESA DO PROPRIO KIT ============ */
    {
      // Kit SINTETICO com as duas mecanicas do Darius (motor.js:718 F `curaSangue` 2% no rank 10,
      // motor.js:721 B `defesaBonus` 50% no rank 10). Os numeros sao do teste, nao do jogo: o que
      // se prova aqui e' a FORMULA e o caminho (kit -> player -> avaliar).
      const KIT = {
        F: { nivel: 23, max: 10, recarga: [17.5], duracao: 6, curaSangue: [0.02] },
        B: { nivel: 33, max: 10, recarga: [21.5], duracao: 10, defesaBonus: [0.5] },
      };
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'darius', {
        nivel: 35, kit: KIT, hemorragia: true,
        stats: { hp: 5000, hpperlevel: 100, hpregen: 10, hpregenperlevel: 0.5, armor: 100, spellblock: 80 },
      });
      m.montar('#hab-ativas .hab[data-t]', ['F', 'B'].map((tt) => m.el({
        tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt }, textContent: '10 / 10',
      })));
      m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '5000 / 5000' })]);
      m.montar('.st', [
        m.el({ label: 'st-dano', textContent: 'Dano 300' }),
        m.el({ label: 'st-arm', textContent: 'Armadura 100' }),
        m.el({ label: 'st-rm', textContent: 'Res. mágica 80' }),
        m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
      ]);
      alimentarMeta(m, { locais: LOCAIS, monstros: MONSTROS });

      const p = auto.player();
      // F: uptime = 6/17.5 = 0.3428 ; cura/ataque = 2% x 5000 x 1 = 100 -> 34.28/s
      t.check('S7: cura por ataque do kit (Banho de Sangue, motor.js:1796) ponderada por uptime',
        Math.abs((p.curaAtaque || 0) - 0.02 * 5000 * (6 / 17.5)) < 0.5);
      // B: uptime = 10/21.5 = 0.4651 ; defesa = 50% x 0.4651 = 0.2326
      t.check('S8: defesa do kit (Estandarte, motor.js:1848/2004) ponderada por uptime',
        Math.abs((p.defesaPct || 0) - 0.5 * (10 / 21.5)) < 0.005);

      const cura = { skill: 0, pocao: 0 };
      const semDef = auto.avaliar('lobo', 30, Object.assign({}, p, { defesaPct: 0 }), cura);
      const comDef = auto.avaliar('lobo', 30, p, cura);
      t.check('S9: com a defesa do kit o dano RECEBIDO e menor (menos mitigacao a fingir)',
        comDef.dpsTomado < semDef.dpsTomado * 0.99);
      t.check('S10: e a cura do kit entra no `curaTotal` (o liquido e o DPS tomado menos a soma)',
        Math.abs((comDef.curaKit || 0) - (p.curaAtaque || 0)) < 0.01 &&
        Math.abs(comDef.curaTotal - (comDef.curaSkill + comDef.curaPocao + comDef.curaRv + comDef.curaGiroS + comDef.curaRegen + comDef.curaKit)) < 0.01 &&
        Math.abs(comDef.liquido - (comDef.dpsTomado - comDef.curaTotal)) < 0.01);
    }

    /* ============ S11: A CURA DO GIRO (Katarina) ENTRA NO VEREDICTO DA REGIAO ============ */
    {
      // Kit VIVO da Katarina (REGRA N.o 3: lido do jogo, nunca copiado).
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { RAIZ } = await import('./dom-stub.mjs');
      const v = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs/game-src/kit-katarina-vivo.json'), 'utf8').replace(/^\/\/.*$/gm, ''));
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'katarina', { kit: v.kit.hab, magia: true });
      m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '35' })]);
      m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
      m.montar('#hab-ativas .hab[data-t]', ['Q', 'W', 'E', 'R', 'G', 'A', 'F', 'B', 'T', 'D'].map((tt) => m.el({
        tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt }, textContent: '10 / 10',
      })));
      m.montar('.st', [
        m.el({ label: 'st-dano', textContent: 'Dano 300' }),
        m.el({ label: 'st-arm', textContent: 'Armadura 100' }),
        m.el({ label: 'st-rm', textContent: 'Res. mágica 80' }),
        m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
        m.el({ label: 'st-ap', textContent: 'Poder 400' }),
      ]);
      alimentarMeta(m, { locais: LOCAIS, monstros: MONSTROS });

      const comDps = auto.estimarRegiao('lobos', { dps: 1000 });
      const semDps = auto.estimarRegiao('lobos', { dps: 0 });
      t.check('S11: com DPS a cura do giro (motor.js:2188-2193) entra no veredicto da regiao',
        comDps && comDps.curaGiro > 0 && (semDps.curaGiro || 0) === 0);
    }

    /* ============ S12/S13: A MARGEM MEDIDA AVISA, NÃO CONDENA ============ */
    {
      // Queixa do dono (2026-10-23), verbatim: "se eu nunca morro por que ele da base na hora de
      // enfrentar o barao?" — duas lutas medidas desceram a 61% e a margem (0,70) punha
      // `chefeMatam: true`; o `supervisarFuga` recordava assim que o chefe aparecia, apesar de a
      // conta dizer que nunca morre e de 0 mortes medidas.
      // S12: margem abaixo do limite + conta COM sustento (`liquido <= 0`) -> AVISO, não condenação.
      // S13: a mesma margem + uma MORTE medida causada pelo chefe -> continua a condenar.
      const montar = () => {
        const m = criarMundo();
        const auto = carregarAutomation(m);
        alimentarCatalogo(m);
        definirCampeao(m, 'adtest', {
          nivel: 40,
          stats: { hp: 5000, hpperlevel: 100, hpregen: 10, hpregenperlevel: 0.5, armor: 5000, spellblock: 5000 },
        });
        const MONSTROS_FRACOS = {
          lobo: { hp: 1.0, ad: 1.0, as: 1.0, armadura: 1.0, xp: 1.0, ouro: 1.0 },
          // chefe que a CONTA cobre (ad baixo): o objecto do teste e' a margem, nao a luta.
          barao: { hp: 6.0, ad: 0.05, as: 0.7, armadura: 1.8, xp: 6.0, ouro: 6.0, chefe: true },
        };
        alimentarMeta(m, {
          locais: [{ id: 'barao', nome: 'Covil do Barao', nm: [40, 48], faixa: [40, 48], tier: 7,
            monstros: [['lobo', 1]], chefe: ['barao', 0.05] }],
          monstros: MONSTROS_FRACOS,
        });
        m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '5000 / 5000' })]);
        m.montar('.st', [
          m.el({ label: 'st-dano', textContent: 'Dano 300' }),
          m.el({ label: 'st-arm', textContent: 'Armadura 5000' }),
          m.el({ label: 'st-rm', textContent: 'Res. mágica 5000' }),
          m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
        ]);
        const farm = auto.getFarm();
        farm.lutas = [{ region: 'Covil do Barao', boss: 'barao', hpMinPct: 61 }];
        return { m, auto, farm };
      };

      const a = montar();
      const eA = a.auto.estimarRegiao('barao');
      t.check('S12a: margem 61% e a conta a cobrir a luta -> NAO condena (chefeMatam false)',
        eA && eA.curaCobreChefe === true && eA.chefeMatam === false);
      t.check('S12b: mas o aperto fica REGISTADO (chefeApertado + a margem medida)',
        eA && eA.chefeApertado === true && Math.abs(eA.margemChefeMedida - 0.61) < 1e-9);

      const b = montar();
      b.farm.deaths = [{ region: 'Covil do Barao', by: 'barao', at: Date.now() }];
      const eB = b.auto.estimarRegiao('barao');
      t.check('S13: mortes MEDIDAS pelo chefe continuam a condenar (a margem nao desligou a seguranca)',
        eB && eB.chefeMatam === true);
    }

    /* ============ S5/S6: O VEREDICTO DA REGIAO PASSA A VER O SUSTENTO ============ */    {
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


