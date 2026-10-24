/*
 * matematica-unificada.test.mjs - UMA FUNCAO POR GRANDEZA (docs/math-graph.md).
 *
 * Pedido do dono (2026-10-23), verbatim: "faz grafo de dependencia das variaveis da matematica e
 * faz todas as contas fazerem sentido entre si".
 *
 * O grafo entregue (docs/math-graph.md) lista 19 divergencias. Este banco prova as que ja estao
 * fechadas - cada uma com o NUMERO das duas versoes, para que um regresso apareca como falha e
 * nao como "um numero diferente":
 *
 *   U1  D07 - a tabela de NIVEL_DIF: havia um fallback local com os valores de ANTES de 13/10
 *       (0,15 / max 3). Com `dif = 10` o monstro batia x4,5 e a conta dizia x2,5 (+80%). Agora ha
 *       UMA tabela (`nivelDifMotor()`), a mesma do motor.js:1287/1201.
 *   U2  D08 - a cura da pocao: `cura * 0,6` em `avaliar` contra `cura / EXAUSTAO` em `estimarLuta`
 *       (1.320 vs 2.200 hp/s). Agora ha `curaPocaoS()` e os dois chamam-na.
 *   U3  D09 - o preco da pocao: `* 110` fixo (preco da FORTE) em tres sitios; a Suprema custa 260.
 *       Agora `precoPocaoEmUso()` le o catalogo do jogo.
 *   U4  D18 - `estimarLuta` chamava `avaliar` SEM o DPS, logo `curaRv = 0` (0 hp/s em vez de 45 com
 *       rv 0,15 e 300 de DPS) - e o comentario afirmava o contrario.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

const MONSTROS = { lobo: { hp: 1.0, ad: 1.0, as: 1.0, armadura: 1.0, xp: 1.0, ouro: 1.0 } };

/** Mundo mínimo: campeão com nível e stats conhecidos, SEM `META.nivelDif` (o caso que divergia). */
function mundo(opts) {
  opts = opts || {};
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest', {
    nivel: opts.nivel != null ? opts.nivel : 10,
    stats: { hp: 2000, hpperlevel: 100, hpregen: 10, hpregenperlevel: 0.5, armor: 40, spellblock: 30, ad: 100 },
  });
  alimentarMeta(m, { monstros: MONSTROS, nivelDif: opts.nivelDif });
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '2000 / 2000' })]);
  m.montar('.st', [
    m.el({ label: 'st-dano', textContent: 'Dano 300' }),
    m.el({ label: 'st-arm', textContent: 'Armadura 40' }),
    m.el({ label: 'st-rm', textContent: 'Res. magica 30' }),
    m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
    m.el({ label: 'st-rv', textContent: opts.rv != null ? 'Roubo de vida ' + opts.rv : 'Roubo de vida 0' }),
  ]);
  if (opts.pocoes) {
    m.montar('#hud-pocoes [data-pocao]', Object.entries(opts.pocoes).map(([k, q]) => m.el({
      label: 'pocao:' + k, tag: 'button', dataset: { pocao: k },
      // o leitor faz `b.querySelector('b')` — no stub isso resolve por `find`.
      find: { b: [m.el({ tag: 'b', label: 'qtd:' + k, textContent: String(q) })] },
    })));
  }
  return { m, auto };
}

/**
 * Mundo COM DPS medido e um chefe - o cenario que o D18 precisava.
 *
 * `meuDps()` (automation.js) calcula o DPS a partir de `agregar()`: exige um ciclo de farm
 * guardado em `chrome.storage.local['lolidleAutoPotion:farm'].cycles` com `kills` > 0 e uma
 * regiao que case `META.locais`. Medido: com este fixture `meuDps()` devolve **625**.
 * `rv` entra em percentagem no HUD (`15` -> 0,15 em `player().rv`).
 */
function mundoLuta(rv, opt) {
  opt = opt || {};
  const store = {
    'lolidleAutoPotion:farm': {
      cycles: [{
        region: 'Covil do Barao', gold: 3000, xp: 9000, fase: 'mobs', janela: 'jE',
        mobFase: {
          startedAt: 0, durMs: 60000,
          perMin: { gold: 3000, xp: 9000, kills: 30, potions: 0, goldPotion: 0, healSkill: 0, healPotion: 0 },
          gold: 3000, xp: 9000, kills: 30,
        },
      }],
      log: [], issues: [], deaths: [],
    },
  };
  const m = criarMundo({ storage: store });
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest', {
    nivel: 10,
    stats: { hp: 2000, hpperlevel: 100, hpregen: 10, hpregenperlevel: 0.5, armor: 40, spellblock: 30, ad: 100 },
  });
  alimentarMeta(m, {
    monstros: {
      barao: { hp: 40, ad: 30, as: 1.5, armadura: 1.8, xp: 6, ouro: 6, chefe: true },
      mob: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 },
    },
    grupoSpawn: { base: 2, rand: 3 },
    locais: [{
      id: 'covil', nome: 'Covil do Barao', nm: [10, 20], faixa: [10, 20], tier: 1,
      monstros: [['mob', 1]], chefe: ['barao'],
    }],
  });
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '2000 / 2000' })]);
  m.montar('.st', [
    m.el({ label: 'st-dano', textContent: 'Dano 300' }),
    m.el({ label: 'st-arm', textContent: 'Armadura 40' }),
    m.el({ label: 'st-rm', textContent: 'Res. magica 30' }),
    m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
    m.el({ label: 'st-rv', textContent: 'Roubo de vida ' + rv }),
  ]);
  if (opt.pocoes) {
    m.montar('#hud-pocoes [data-pocao]', Object.entries(opt.pocoes).map(([k, q]) => m.el({
      label: 'pocao:' + k, tag: 'button', dataset: { pocao: k },
      find: { b: [m.el({ tag: 'b', label: 'qtd:' + k, textContent: String(q) })] },
    })));
  }
  return auto;
}

export const suite = {
  nome: 'matematica-unificada - UMA funcao por grandeza (docs/math-graph.md: D07, D08, D09, D18)',
  async run(t) {
    /* ---------------- U1 / D07 - uma tabela de nivel ------------- */
    {
      const { auto } = mundo();   // sem META.nivelDif: e aqui que o fallback divergia
      const ND = auto.nivelDifMotor();
      t.check('U1: sem relay, a tabela efectiva e a do MOTOR (0,35 / max 5), nao a de antes de 13/10',
        Math.abs(Number(ND.danoMonstro) - 0.35) < 1e-9 && Number(ND.maxDanoMonstro) === 5);
      // dif = 10 (monstro 14 niveis acima de um jogador 10, faixa livre 4)
      const fM = auto.fatorDanoMonstroMotor(10);
      t.check('U1b: com dif=10 o monstro bate x4,5 (motor.js:1201) e nao x2,5 (fallback velho)',
        Math.abs(fM - 4.5) < 1e-9);
      const av = auto.avaliar('lobo', 24, auto.player(), null, 0);
      t.check('U1c: o `avaliar` usa a MESMA tabela (dif=10 -> fM=4,5; o fallback dava 2,5)',
        !!av && Math.abs(av.fM - 4.5) < 1e-9 && av.dif === 10);
    }
    {
      // ... e continua a acompanhar o JOGO quando o relay responde (REGRA N.o 3)
      const { auto } = mundo({ nivelDif: { livre: 4, danoMonstro: 0.5, maxDanoMonstro: 9 } });
      t.check('U1d: se o motor mudar a tabela, a conta muda com ela (0,5 x 4 = x3)',
        Math.abs(auto.fatorDanoMonstroMotor(4) - 3) < 1e-9);
    }

    /* ---------------- U2 / D08 - a cura da pocao ------------- */
    {
      const { auto } = mundo({ pocoes: { vidaS: 5 } });
      const cura = auto.curaPocaoMax();
      t.check('U2: ha pocao Suprema na mochila (cura > 0)', cura > 0);
      const cps = auto.curaPocaoS();
      t.check('U2b: cura/s = cura / EXAUSTAO (motor.js:1407-1416), e NAO cura x 0,6',
        Math.abs(cps - cura) < 1e-9 && Math.abs(cps - cura * 0.6) > 1e-6);
      const { auto: semPocao } = mundo();
      t.check('U2c: sem pocao o piso declarado e 1 hp/s (evita divisao por zero em potS)',
        semPocao.curaPocaoMax() === 0 && Math.abs(semPocao.curaPocaoS() - 1) < 1e-9);
      // a MESMA funcao dentro do avaliar: curaPocao recebida = curaPocaoS()
      const av = auto.avaliar('lobo', 10, auto.player(), { skill: 0, pocao: auto.curaPocaoS() }, 0);
      t.check('U2d: o `avaliar` soma exactamente `curaPocaoS()` (uma formula, nao duas)',
        !!av && Math.abs(av.curaPocao - auto.curaPocaoS()) < 1e-9);
    }

    /* ---------------- U3 / D09 - o preco da pocao ------------- */
    {
      const { auto } = mundo({ pocoes: { vidaS: 5 } });
      const preco = auto.precoPocaoEmUso();
      t.check('U3: o preco vem do catalogo do jogo (META.pocoes), nunca do literal 110',
        preco > 0 && preco !== 110);
      const { auto: soForte } = mundo({ pocoes: { vidaF: 5 } });
      t.check('U3b: com a Forte na mochila o preco e o dela (que por acaso e 110)',
        soForte.precoPocaoEmUso() === 110);
    }

    /* ---------------- U4 / D18 - o roubo de vida chega ao veredicto ------------- */
    {
      const { auto } = mundo({ rv: 15 });   // o HUD mostra percentagem (15 -> 0,15)
      const p = auto.player();
      t.check('U4: o campeao tem roubo de vida lido do HUD (0,15)', Math.abs((p.rv || 0) - 0.15) < 1e-9);
      const sem = auto.avaliar('lobo', 10, p, null, 0);
      const com = auto.avaliar('lobo', 10, p, null, 300);
      t.check('U4b: sem DPS nao ha cura de roubo de vida (era o bug: 0 hp/s)', !!sem && sem.curaRv === 0);
      t.check('U4c: com 300 de DPS o roubo de vida vale 0,15 x 300 x mit (~37 hp/s, nao 0)',
        !!com && com.curaRv > 30 && com.curaRv <= 45);
      t.check('U4d: e o total de sustento do veredicto sobe (o `liquido` deixa de ser bruto)',
        !!com && !!sem && com.curaTotal > sem.curaTotal && com.liquido < sem.liquido);
    }
    /* ---------------- U5 / D18 - o roubo de vida CHEGA ao veredicto do chefe -------------
     * `estimarLuta` e a funcao que decide `ganha` (e portanto a fuga). Ela chamava `avaliar`
     * SEM o 5.o argumento: `curaRv = 0`. Este cenario tem DPS medido (625) para que a cura do
     * roubo de vida exista de facto - sem DPS medido o teste nao provaria nada. */
    {
      const rv0 = mundoLuta(0);
      const rv15 = mundoLuta(15);
      await new Promise((r) => setTimeout(r, 80));
      const e0 = rv0.estimarLuta('covil');
      const e15 = rv15.estimarLuta('covil');
      t.check('U5: o cenario tem DPS medido (625) e as duas lutas foram calculadas',
        rv0.meuDps() === 625 && !!e0 && !!e15);
      t.check('U5b: sem roubo de vida o sustento do chefe e so a regeneracao (<= 5 hp/s)',
        !!e0 && e0.curaTotalS != null && e0.curaTotalS <= 5);
      t.check('U5c: com rv 0,15 o roubo de vida ENTRA no veredicto (>= 60 hp/s) - era 0 antes do D18',
        !!e15 && e15.curaTotalS != null && e15.curaTotalS >= 60);
      t.check('U5d: e por isso a perda liquida por segundo desce (o veredicto deixa de ser bruto)',
        !!e0 && !!e15 && e15.netS < e0.netS);
    }

    /* ---------------- U6 / D20 - a pocao e' RESERVATORIO, nao torneira -------------
     * `estimarLuta` subtraia `curaPocaoS()` (= cura/EXAUSTAO = 2.200 hp/s com a Suprema) ao liquido
     * como se a pocao nao acabasse. Resultado medido ao vivo: `tMorrerS: null` com 1.268 hp/s de
     * liquido. No jogo cada uso decrementa o stock (motor.js:1408): N cargas de `cura`. */
    {
      const sem = mundoLuta(0);
      const com = mundoLuta(0, { pocoes: { vidaS: 5 } });
      await new Promise((r) => setTimeout(r, 80));
      const e0 = sem.estimarLuta('covil');
      const e5 = com.estimarLuta('covil');
      t.check('U6: sem pocao a morte e FINITA e curta (~2.000 hp / 3.266 hp/s ~ 0,6 s), nao `null`',
        !!e0 && e0.tMorrerS != null && e0.tMorrerS > 0.3 && e0.tMorrerS < 1.0);
      t.check('U6b: 5 Supremas somam 11.000 hp ao POOL: (2.000 + 11.000) / 3.266 ~ 4,0 s',
        !!e5 && e5.tMorrerS != null && Math.abs(e5.tMorrerS - 4.0) < 0.4);
      t.check('U6c: e continua a nao ganhar: 143 s de luta contra ~4 s de sobrevida',
        !!e5 && e5.ganha === false);
      t.check('U6d: as cargas que a luta exigiria excedem as 5 da mochila (por isso perde)',
        !!e5 && e5.pocoesNaMochila === 5 && e5.potNecessarias > e5.pocoesNaMochila);
    }
  },
};
