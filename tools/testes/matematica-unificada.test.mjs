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

import fs from 'node:fs';
import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao, AUTOMATION_PATH } from './dom-stub.mjs';

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
  alimentarMeta(m, Object.assign({ monstros: MONSTROS, nivelDif: opts.nivelDif }, opts.meta || {}));
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
      cycles: [Object.assign({
        region: 'Covil do Barao', gold: 3000, xp: 9000, fase: 'mobs', janela: 'jE',
        mobFase: {
          startedAt: 0, durMs: 60000,
          perMin: { gold: 3000, xp: 9000, kills: 30, potions: 0, goldPotion: 0, healSkill: 0, healPotion: 0 },
          gold: 3000, xp: 9000, kills: 30,
        },
      }, opt.ciclo || {})],
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
  // `opt.meta` sobrepoe o meta do cenario (o D19 precisa de um VIP com numeros proprios: se o
  // teste usasse 1,2 igual ao literal, um vipFx() que copiasse o numero passaria na mesma).
  alimentarMeta(m, Object.assign({
    monstros: {
      barao: { hp: 40, ad: 30, as: 1.5, armadura: 1.8, xp: 6, ouro: 6, chefe: true },
      mob: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 },
    },
    grupoSpawn: { base: 2, rand: 3 },
    locais: [{
      id: 'covil', nome: 'Covil do Barao', nm: [10, 20], faixa: [10, 20], tier: 1,
      monstros: [['mob', 1]], chefe: ['barao'],
    }],
  }, (opt && opt.meta) || {}));
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

    /* ---------------- U7 / D19 - o bonus de VIP e' LIDO, nao copiado ----------------
     * O inject ja' mandava `meta.vip = M.VIP` (motor.js:152) e o `carregarMeta` deitava o campo
     * fora; o `1.2` estava escrito a mao em tres sitios. O fixture poe VIP.xp = 1.5: um vipFx()
     * que devolvesse o literal 1.2 passaria despercebido se o teste usasse 1.2. */
    {
      const semVip = mundo({ meta: { locais: [{ id: 'campo', nome: 'Campo', nm: [10, 12], faixa: [10, 12], tier: 0, monstros: [['lobo', 1]] }] } });
      const base = semVip.auto.estimarRegiao('campo', { mobLevel: 10, mobsPerWave: 2, dps: 0, vip: false });
      const comVip = semVip.auto.estimarRegiao('campo', { mobLevel: 10, mobsPerWave: 2, dps: 0, vip: true });
      t.check('U7: sem motor lido o fallback DECLARADO e 1.2 (nao um null silencioso)',
        !!base && !!comVip && base.xpMin > 0 && Math.abs((comVip.xpMin / base.xpMin) - 1.2) < 1e-3);

      const comMotor = mundoLuta(0, { meta: {
        monstros: {
          barao: { hp: 40, ad: 30, as: 1.5, armadura: 1.8, xp: 6, ouro: 6, chefe: true },
          mob: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 },
        },
        vip: { xp: 1.5, drop: 1.5 },
      } });
      await new Promise((r) => setTimeout(r, 80));
      const s1 = comMotor.estimarRegiao('covil', { mobLevel: 10, mobsPerWave: 2, dps: 0, vip: false });
      const s2 = comMotor.estimarRegiao('covil', { mobLevel: 10, mobsPerWave: 2, dps: 0, vip: true });
      t.check('U7b: o factor e LIDO do motor (VIP.xp=1.5 no fixture), nao copiado como 1.2',
        !!s1 && !!s2 && Math.abs((s2.xpMin / s1.xpMin) - 1.5) < 1e-3);

      // A escolha do DONO (ligar/desligar) e' `cfg.vipAtivo`; o NUMERO continua a vir do motor.
      comMotor.setConfig({ vipAtivo: false });
      const desligado = comMotor.estimarRegiao('covil', { mobLevel: 10, mobsPerWave: 2, dps: 0 });
      comMotor.setConfig({ vipAtivo: true });
      const ligado = comMotor.estimarRegiao('covil', { mobLevel: 10, mobsPerWave: 2, dps: 0 });
      t.check('U7c: `cfg.vipAtivo` desliga o bonus sem mexer no factor lido (motor: x1.5)',
        !!desligado && !!ligado && Math.abs(desligado.xpMin - s1.xpMin) < 1e-6
        && Math.abs((ligado.xpMin / desligado.xpMin) - 1.5) < 1e-3);

      // O defeito real: o `carregarMeta` tinha uma lista de campos permitidos e `vip` nao estava
      // nela (o inject mandava, a extensao deitava fora). Prova na fonte, porque o sintoma e' a
      // AUSENCIA de um campo quando o relay responde.
      const fonte = fs.readFileSync(AUTOMATION_PATH, 'utf8');
      // A lista e' o `for (const k of [...])` do `carregarMeta` (a que comeca em 'pocoes').
      const lista = (fonte.match(/for \(const k of \[([^\]]*'pocoes'[^\]]*)\]\)/) || [])[1] || '';
      t.check('U7d: `vip` esta na lista de campos que o `carregarMeta` aceita',
        /['\"]vip['\"]/.test(lista));
    }

    /* ---------------- U8 / D12 - a BUILD medida com a regua do `estimarLuta` ----------------
     * `sobrevivenciaSet` era a unica das oito definicoes de sobrevivencia que media
     * `vida / dpsChefe` BRUTO: sem roubo de vida, giro, regeneracao, kit nem reserva de pocoes.
     * E' a funcao que escolhe a build final (`alvoEquip`), logo escolhia por outra conta. */
    {
      // CHEFE MODERADO (ad 3): com o chefe do U5 (ad 30, dpsChefe 3.268) o roubo de vida valia
      // 64 hp/s em 3.268 - arredondado a 1 decimal dava o MESMO tMorrer (0,6) e o teste passava
      // sem distinguir a regua velha da nova. Aqui o sustento e' 35% do dano tomado.
      const MODERADO = { monstros: {
        barao: { hp: 4, ad: 3, as: 1, armadura: 1, xp: 6, ouro: 6, chefe: true },
        mob: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 },
      } };
      const rv0 = mundoLuta(0, { meta: MODERADO });
      const rv15 = mundoLuta(15, { meta: MODERADO });
      const comPocao = mundoLuta(15, { meta: MODERADO, pocoes: { vidaS: 5 } });
      await new Promise((r) => setTimeout(r, 120));
      const e0 = rv0.estimarLuta('covil');
      const e15 = rv15.estimarLuta('covil');
      const eP = comPocao.estimarLuta('covil');
      const s0 = rv0.sobrevivenciaSet([], 'covil', 'covil', { luta: e0 });
      const s15 = rv15.sobrevivenciaSet([], 'covil', 'covil', { luta: e15 });
      const sP = comPocao.sobrevivenciaSet([], 'covil', 'covil', { luta: eP });
      const bruto = s15.vida / e15.dpsChefe;
      t.check('U8: o liquido da BUILD e dpsChefe - cura fixa - cura do roubo (nada bruto)',
        !!s15 && Math.abs(s15.net - (e15.dpsChefe - s15.curaFixa - s15.curaRv)) < 0.2 && s15.curaFixa > 0);
      t.check('U8b: com roubo de vida o tMorrer da BUILD e maior que vida/dpsBruto (sustento entra)',
        !!s15 && isFinite(s15.tMorrer) && s15.tMorrer > bruto * 1.05);
      t.check('U8c: sem roubo de vida o sustento e so a parte fixa (curaRv = 0)',
        !!s0 && s0.curaRv === 0 && s0.net > s15.net);
      t.check('U8d: 5 Supremas somam RESERVA ao pool (sem pocao reserva = 0)',
        s0.reserva === 0 && sP.reserva > 0 && sP.tMorrer > s0.tMorrer);
      t.check('U8e: `morre` sai do conjunto (tMorrer < tKill | mortal | semPocao), nunca de um literal',
        !!sP && sP.morre === (sP.tMorrer < sP.tKill || sP.mortal === true || sP.semPocao === true));
    }

    /* ---------------- U11 / D11 - um respawn por wave, nao dois ----------------
     * 1,5 s e' o respawn DEPOIS DE LIMPAR A WAVE (motor.js:1739); 1,2 s e' o da CHEGADA
     * (motor.js:3321). Somados davam 2,7 s -> tecto de 66,7 abates/min em vez de 120. */
    {
      const { auto } = mundo({ meta: { locais: [{ id: 'campo', nome: 'Campo', nm: [10, 12], faixa: [10, 12], tier: 0, monstros: [['lobo', 1]] }] } });
      const r = auto.estimarRegiao('campo', { mobLevel: 10, mobsPerWave: 3, dps: 0, vip: false });
      t.check('U11: com 3 mobs/wave e respawn de 1,5 s o tecto e 120 abates/min (nao 66,7)',
        !!r && Math.abs(r.killsMin - 120) < 1);
    }

    /* ---------------- U12 / D13 - uma definicao por funcao ---------------- */
    {
      const fonte = fs.readFileSync(AUTOMATION_PATH, 'utf8');
      const defs = (fonte.match(/function statsMonstro\s*\(/g) || []).length;
      t.check('U12: `statsMonstro` tem UMA definicao (havia duas; a de baixo vencia por hoisting)',
        defs === 1);
      const { auto } = mundo();
      const loc = { id: 'x', nome: 'X', nm: [10, 20], faixa: [10, 20], tier: 1, monstros: [['lobo', 1]], chefe: ['lobo'] };
      t.check('U12b: `nivelChefeDe` delega no `nivelAlvo` (uma conta, nao duas)',
        auto.nivelChefeDe(loc, 10) === auto.nivelAlvo(loc, 'chefe', 10));
    }

    /* ---------------- U13 / D02+D16 - o que o `recomendar` diz tem de ser o que se mediu ------
     * `sobrevive` era o LITERAL `true` nos dois ramos e o `ouroLiquidoMin` era "medido" num e
     * "teorico real" no outro, impressos como a mesma grandeza. */
    {
      const campo = [{ id: 'campo', nome: 'Campo', nm: [10, 12], faixa: [10, 12], tier: 0, monstros: [['lobo', 1]] }];
      const teorico = mundo({ meta: { locais: campo } });
      const rt = teorico.auto.recomendar();
      t.check('U13: sem ciclos medidos o `recomendar` diz `base: teorico` (e nao finge medicao)',
        !!rt && rt.base === 'teorico' && rt.mortesMedidas === null);
      t.check('U13b: o ouro liquido e SEMPRE goldMin - goldPotionMin (uma conta, dois ramos)',
        !!rt && rt.goldMin > 0 && Math.abs(rt.ouroLiquidoMin - (rt.goldMin - rt.goldPotionMin)) < 1e-9);

      // Com ciclos medidos numa regiao cujo chefe NAO mata: o ramo `medido`, com veredicto calculado.
      // O chefe tem de ser INOFENSIVO para o veredicto ser `sobrevive` (ad 0.2 < sustento com
      // pocoes); e `region` com a faixa "10-20" porque e' o TEXTO da regiao que da o nivel do
      // chefe (automation.js:`nivelChefeDe({nm:[n0,n1]})`) - sem a faixa nao ha risco nenhum.
      const medido = mundoLuta(0, { pocoes: { vidaS: 5 }, meta: {
        monstros: {
          barao: { hp: 2, ad: 0.2, as: 1, armadura: 1, xp: 6, ouro: 6, chefe: true },
          mob: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 },
        },
      }, ciclo: { boss: 'barao', region: 'Covil do Barao 10-20' } });
      await new Promise((r) => setTimeout(r, 120));
      const rm = medido.recomendar();
      t.check('U13c: com ciclos medidos `base: medido`, veredicto calculado e mortes contadas',
        !!rm && rm.base === 'medido' && rm.sobrevive === (rm.chefeFatal !== true)
        && rm.mortesMedidas != null && Math.abs(rm.ouroLiquidoMin - (rm.goldMin - rm.goldPotionMin)) < 1e-9);
    }

    /* ---------------- U14 / D01 - UM adjudicador de morte ----------------
     * `avaliar.morre` era `liquido > 0` (dano liquido), nao "morre antes de matar": com o Barao a
     * 28 s de tMorrer e 165 s de tMatar dizia MORTE - a mesma resposta que a 0,6 s. A regra e' a do
     * dono: sobrevive? mata em quantos segundos? Agora `morre` = tMorrer < tMatar (ou mecanica
     * fatal, ou nenhuma pocao cobre a janela); sem DPS de saida fica conservador. */
    {
      const meta = { monstros: {
        fraco: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 },
        brutamontes: { hp: 1, ad: 3000, as: 1, armadura: 1, xp: 1, ouro: 1 },
      } };
      // SEM stock de pocao: o termo da pocao fica a 0 e o liquido volta a ser positivo. Com stock
      // o reservatorio mudava `liquido` e este teste deixava de medir o adjudicador de morte (D01).
      const w = mundoLuta(0, { meta });
      await new Promise((r) => setTimeout(r, 120));
      const pj = { nivel: 10, vida: 2000, armadura: 40, rm: 30, regen: 0 };
      const avFraco = w.avaliar('fraco', 10, pj, { skill: 0, pocao: 0 }, 500);
      const avBruto = w.avaliar('brutamontes', 10, pj, { skill: 0, pocao: 0 }, 500);
      t.check('U14: `avaliar` expoe tMatar (hp do alvo / dps de saida) quando ha DPS',
        !!avFraco && avFraco.tMatar > 0 && Math.abs(avFraco.tMatar - (avFraco.hp / 500)) < 1e-6);
      t.check('U14b: chefe que NAO te mata antes de morrer -> `morre` falso (dano liquido nao e morte)',
        !!avFraco && avFraco.liquido > 0 && avFraco.tMorrer > avFraco.tMatar && avFraco.morre === false);
      t.check('U14c: quem te mata antes de morrer -> `morre` verdadeiro',
        !!avBruto && avBruto.tMorrer < avBruto.tMatar && avBruto.morre === true);
      const semDps = w.avaliar('fraco', 10, pj, { skill: 0, pocao: 0 });
      t.check('U14d: SEM dps de saida nao se inventa sobrevivencia (criterio conservador de antes)',
        !!semDps && semDps.tMatar === null && semDps.liquido > 0 && semDps.morre === true);
    }

    /* ---------------- U15 / D01b - a pocao e' RESERVATORIO, nao torneira ----------------
     * O fallback era `curaMax * 0,6` = 1.320 hp/s com stock INFINITO (medido: `curaTotal` do risco
     * do Barao dava 1.322 hp/s). Agora, sem medida, a taxa e' min(N*cura/tMatar, cura/EXAUSTAO):
     * o stock limita o total e o cooldown limita o pico. */
    {
      const meta = { monstros: { fraco: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 } } };
      const w = mundoLuta(0, { pocoes: { vidaS: 5 }, meta });
      await new Promise((r) => setTimeout(r, 120));
      const pj = { nivel: 10, vida: 2000, armadura: 40, rm: 30, regen: 0 };
      const longo = w.avaliar('fraco', 10, pj, { skill: 0 }, 10);
      const medio = w.avaliar('fraco', 10, pj, { skill: 0 }, 100);
      // Stock limitado nos dois: o PRODUTO taxa x tMatar e' o stock (N*cura) e nao muda com o DPS.
      const stockLongo = longo.curaPocao * longo.tMatar;
      const stockMedio = medio.curaPocao * medio.tMatar;
      t.check('U15: a cura da pocao escala com 1/tMatar (e um RESERVATORIO, nao uma taxa fixa)',
        longo.curaPocao > 0 && longo.curaPocao < 100
        && Math.abs(stockLongo - stockMedio) / Math.max(1, stockLongo) < 1e-6);
      const semPocao = mundoLuta(0, { meta });
      await new Promise((r) => setTimeout(r, 80));
      const vazio = semPocao.avaliar('fraco', 10, pj, { skill: 0 }, 10);
      t.check('U15b: sem pocao na mao a cura da pocao e ZERO (nunca um fallback inventado)',
        !!vazio && vazio.curaPocao === 0);
      const medido = w.avaliar('fraco', 10, pj, { skill: 0, pocao: 3.5 }, 100);
      t.check('U15c: uma MEDIDA de cura/pocao manda sobre o modelo (medicao > teoria)',
        !!medido && medido.curaPocao === 3.5);
    }
  },
};
