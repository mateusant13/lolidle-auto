/*
 * passivas.test.mjs - PASSIVAS DE ESTADO com contexto de combate (TK-02-05).
 *
 * MOTIVO: 13 passivas de estado ficaram SEM regra propria durante varias rondas — o scoring
 * so olhava para texto e stats, e itens como o Fulgor (3057), o Anjo Guardiao (3026), a
 * Danca da Morte (6333) e a Sedenta (3072) valiam 0 em TODAS as fases. Evidencia:
 * parte-02.md:226 (objectivo do dono, ponto 2) e parte-02.md:3396 (as 13 restantes).
 *
 * O que se protege:
 *   P1 - cada uma das 13 tem regra propria declarada (PASSIVAS_ESTADO ou PESO_FASE);
 *   P2 - cada regra cita o motor VIVO (file:linha no comentario) — nenhuma constante solta;
 *   P3 - a Lamina Encantada (3057/3078) vale lamina x baseAd x lançamentos/s (motor.js:1694);
 *   P4 - a Geada (3116) vale 0,6 s de ataques do alvo evitados (motor.js:1223 + 1748);
 *   P5 - a fase ACTIVA e DESACTIVA: Anjo/Zhonya/Danca so no chefe; valor 0 na fase errada;
 *   P6 - Warmog (3083) está coberto pelo campo regen do próprio item (motor.js:548/1375);
 *   P7 - os itens que eram INVISÍVEIS (0 em tudo) deixam de ser.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

const OS_13 = ['3057', '3116', '3085', '6655', '3742', '3102', '3083', '6610', '3026', '3157', '6333', '3078', '3072'];

export const suite = {
  nome: 'passivas',
  titulo: 'Passivas de estado com contexto de combate (as 13)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    // catálogo REAL do jogo (docs/game-src/itens.js) — mesma fonte que o meta leva ao jogo
    let itens = [];
    try {
      const mod = await import('../../docs/game-src/itens.js');
      itens = mod.ITENS_DADOS || [];
    } catch { itens = []; }
    t.check('P0: catálogo real do jogo carregado (docs/game-src/itens.js)', itens.length >= 100);
    if (itens.length) alimentarMeta(m, { itens });

    /* ---- P1/P2 - cada uma das 13 tem regra e citação do motor ---- */
    const decl = auto.PASSIVAS_ESTADO || [];
    for (const id of OS_13) {
      const pe = decl.find((x) => x.id === id);
      const naTabela = !!(auto.PESO_FASE && (auto.PESO_FASE.mobs.itens[id] || auto.PESO_FASE.chefe.itens[id]));
      const it = itens.find((x) => x.id === id) || {};
      const estrutural = id === '3083' && (it.regen || 0) > 0;   // Warmog: campo regen do item
      t.check('P1: ' + id + ' (' + (it.nome || '?') + ') tem regra própria',
        !!pe || naTabela || estrutural);
      if (pe) {
        t.check('P2: ' + id + ' cita o motor vivo no comentário (file:linha)',
          typeof pe.motor === 'string' && /motor\.js:\d+/.test(pe.motor));
      }
      if (naTabela) {
        const ent = (auto.PESO_FASE.mobs.itens[id]) || (auto.PESO_FASE.chefe.itens[id]);
        t.check('P2: ' + id + ' tem o why com file:linha do motor',
          typeof ent.why === 'string' && /motor\.js:\d+/.test(ent.why));
      }
    }

    /* ---- cálculo: kit de teste com 2 habilidades de dano (cadência medida) ---- */
    // Q: base 100, ratio 0, recarga 10 s -> dps 10, 0,1 lançamentos/s
    // A: base 200, ratio 0, recarga 5 s  -> dps 40, 0,2 lançamentos/s  => 0,3 lançamentos/s
    const kit = {
      Q: { nivel: 1, max: 10, base: [100], ratio: [0], recarga: [10] },
      A: { nivel: 1, max: 10, base: [200], ratio: [0], recarga: [5] },
      R: { nivel: 6, max: 5, base: [300], ratio: [0], recarga: [75, 65, 55, 48, 42] },
    };
    definirCampeao(m, 'adtest', { kit, magia: false, adBase: 60 });
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
    m.montar('.st', [m.el({ label: 'st-dano', textContent: 'Dano 300' })]);
    m.montar('#hab-ativas .hab[data-t]', ['Q', 'A', 'R'].map((tt) => m.el({
      tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
      textContent: (tt === 'R' ? 1 : 10) + ' / ' + (tt === 'R' ? 5 : 10),
    })));

    // ---- P3 - Lamina Encantada: 1x baseAd (Fulgor) e 2x (Trindade) por conjuração ----
    // A cadência é a SOMA das três: Q 0,1 + A 0,2 + R 0,0133 = 0,3133 lançamentos/s.
    // baseAd 60 (lido do kit) x 0,3133 = 18,8 de dano extra/s; o peso w.ad do perfil
    // 'dano' (1,4) converte para os pontos do sistema: 1x = 26,32, 2x = 52,64.
    const ctx = auto.ctxEstadoComba();
    t.check('P3: a cadência das habilidades é medida do kit (0,3133 lançamentos/s)',
      Math.abs(ctx.castsPorSeg - 0.31333) < 0.001);
    t.check('P3: o baseAd vem do kit do motor (60)', ctx.baseAd === 60);
    const fulgor = auto.valorPassivaEstado('3057', { magia: false }, 'mobs');
    const trindade = auto.valorPassivaEstado('3078', { magia: false }, 'mobs');
    t.check('P3: Fulgor (1x baseAd) = 1 x 60 x 0,3133 x 1,4 = 26,32', Math.abs(fulgor - 26.32) < 0.1);
    t.check('P3: Trindade (2x baseAd) vale o DOBRO do Fulgor', Math.abs(trindade - 2 * fulgor) < 0.01);

    // ---- P4 - Geada: 0,6 s de ataques do alvo evitados por conjuração ----
    // O alvo de referência de mobs precisa de META.locais/monstros: sem eles o valor é 0 e o
    // teste fica honesto (a fase não inventa alvo).
    alimentarMeta(m, {
      monstros: { 'Tropa Corpo a Corpo': { hp: 1, ad: 0.9, as: 0.8, armadura: 0.6, xp: 1, ouro: 1 } },
      locais: [{ id: 'floresta', nome: 'Floresta', faixa: [25, 30], monstros: [['Tropa Corpo a Corpo', 1]], chefe: null }],
    });
    const geadaMobs = auto.valorPassivaEstado('3116', { magia: true }, 'mobs');
    t.check('P4: Geada em mobs vale 0,6 x dps do mob x lançamentos/s x peso (motor.js:1223+1748)',
      geadaMobs > 0);
    // mago: w.vida = 0,15; mob nv25: ad = (9+4,8*25+0,13*625) = 239,05; as 0,8 -> 191,2 dps;
    // 0,6 x 191,2 x 0,3 x 0,15 = 5,2
    t.check('P4: o valor da Geada bate com a fórmula do motor (~5,2)', Math.abs(geadaMobs - 5.2) < 1.5);

    /* ---- P5 - a fase activa e desactiva ---- */
    t.check('P5: Anjo Guardião NÃO se valoriza em mobs (só o chefe o promove)',
      auto.valorPassivaEstado('3026', { magia: true }, 'mobs') === 0);
    t.check('P5: Zhonya NÃO se valoriza em mobs (stasis é do chefe)',
      auto.valorPassivaEstado('3157', { magia: true }, 'mobs') === 0);
    t.check('P5: Dança da Morte NÃO se valoriza em mobs',
      auto.valorPassivaEstado('6333', { magia: true }, 'mobs') === 0);
    t.check('P5: a Trindade valoriza-se nas DUAS fases (proc por conjuração)',
      auto.valorPassivaEstado('3078', { magia: false }, 'chefe') > 0);
    t.check('P5: item sem passiva de estado devolve 0', auto.valorPassivaEstado('1001', {}, 'mobs') === 0);

    /* ---- P6 - Warmog: campo regen do item, já pontuado (motor.js:548/1375) ---- */
    const warmog = (itens.find((x) => x.id === '3083') || {});
    t.check('P6: Warmog tem o campo regen=15 do catálogo do motor', (warmog.regen || 0) === 15);
    if (itens.length) {
      const vMobs = auto.valorDeFase('3083', {}, 'mobs');
      const vChefe = auto.valorDeFase('3083', {}, 'chefe');
      t.check('P6: Warmog pontua pelas stats (regen incluído), não é invisível', vMobs > 0 && vChefe > 0);
      t.check('P6: no chefe o peso do regen sobe (1,1) — Warmog vale mais lá', vChefe > vMobs);
    }

    /* ---- P7 - os itens que eram INVISÍVEIS (0 em tudo) deixam de ser ---- */
    for (const id of ['3057', '3026', '6333', '3072']) {
      const vMobs = auto.valorDeFase(id, { magia: false }, 'mobs');
      const vChefe = auto.valorDeFase(id, { magia: false }, 'chefe');
      const nome = ((itens.find((x) => x.id === id) || {}).nome || '?');
      const visivel = vChefe > 0 || vMobs > 0;
      t.check('P7: ' + id + ' (' + nome + ') já não é invisível ao scoring', visivel);
    }
  },
};