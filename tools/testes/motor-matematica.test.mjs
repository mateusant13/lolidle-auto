/*
 * motor-matematica.test.mjs — CHECKLIST DE EDGE CASES DO MOTOR DE ESCOLHA DE ITENS.
 *
 * O dono pediu (2026-10-20): "no motor da matematica ai, tu vai separar as coisas por
 * comentarios e secoes. pra cada secao, tu vai resolver uma 'checklist' de edge case."
 *
 * As secções A..G estão comentadas no `extension/automation.js` (MAPA DAS SECÇÕES, antes de
 * `perfilDe`) e cada item desta suite tem o mesmo ID. Um item sem teste não conta como
 * resolvido; um teste que codifique comportamento antigo tem de ser actualizado (REGRA 6).
 *
 * CONTRATO: t.check(rotulo, condicao) só passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao, montarMochila, CATALOGO } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';

const sl = (id, raridade) => ({ id: id, raridade: raridade });
const basesDe = (arr) => (arr || []).map((i) => String(i.base || i.id));

function montarEquip(m, slots) {
  const filhos = slots.map((s) => m.el({
    tag: 'button', label: 'equip:' + s.id,
    className: 'slot ' + (s.raridade || 'basico'),
    attrs: { 'data-id': s.id, 'data-dica': s.dica || '' },
  }));
  m.montar('#equip > button.slot[data-id]', filhos);
}
function mundo(itens) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m, itens || ITENS_DADOS);
  return { m, auto };
}
const quase = (a, b, eps) => Math.abs(Number(a) - Number(b)) <= (eps == null ? 1e-6 : eps);

export const suite = {
  nome: 'motor-matematica',
  titulo: 'Motor de escolha: peça concreta, recurso, valor, conjunto, decisão, score e fontes',

  async run(t) {
    /* =================================================================================
     * A — PEÇA CONCRETA (parseSlotId / statsDePeca / tierDe)
     * =============================================================================== */
    {
      const { auto } = mundo();
      const p1 = auto.parseSlotId('4629+3~A');
      const p2 = auto.parseSlotId('4629~A+3');
      t.check('A1: aceita base+ref~qual', p1.base === '4629' && p1.refino === 3 && p1.qual === 'A');
      t.check('A1: aceita base~qual+ref (mesma peça, outra ordem)',
        p2.base === p1.base && p2.refino === p1.refino && p2.qual === p1.qual && quase(p2.mult, p1.mult));
      t.check('A1: mult = (1+0,12*3)*1,15 = 1,564 (motor.js:252)',
        quase(p1.mult, 1.564, 1e-4));

      const cru = auto.parseSlotId('4629');
      t.check('A2: id cru -> B, refino 0, mult 1', cru.qual === 'B' && cru.refino === 0 && quase(cru.mult, 1));

      const pend = auto.statsDePeca('4629', '?', 0);
      t.check('A3: qualidade pendente ? -> stats de B (mult 1)', !!pend && pend.qual === 'B' && quase(pend.mult, 1));

      const s = auto.statsDePeca('4629', 'A', 3);
      t.check('A4: 4629 A+3 = 109,48 AP', !!s && quase(s.ap, 109.48, 1e-2));
      t.check('A4: 4629 A+3 = 547,4 vida', !!s && quase(s.vida, 547.4, 1e-1));
      t.check('A4: 4629 A+3 = 23,46% CDR (texto escalado)', !!s && quase(s.cdr, 0.2346, 1e-4));

      const bota = auto.statsDePeca('3175', 'A', 4);
      t.check('A5: penMag NÃO escala (3175 A+4 continua 15%)', !!bota && quase(bota.penMag, 0.15));
      t.check('A5: ...mas o AP da mesma bota escala', !!bota && bota.ap > 100);

      t.check('A6: CDR que já é campo não entra outra vez pela passiva (valorPassiva 3171 = 0)',
        auto.valorPassiva('3171') === 0);

      t.check('A7: base fora do catálogo -> statsDePeca null', auto.statsDePeca('999999', 'A', 3) === null);
      t.check('A7: base fora do catálogo -> valorDe 0, sem rebentar', auto.valorDe('999999') === 0);

      t.check('A8: tierDe A+3 = 1,564', quase(auto.tierDe({ qual: 'A', refino: 3 }), 1.564, 1e-4));
      t.check('A8: tierDe C+0 = 0,9', quase(auto.tierDe({ qual: 'C', refino: 0 }), 0.9, 1e-6));
    }

    /* =================================================================================
     * B — RECURSO E PERFIL DO CAMPEÃO
     * =============================================================================== */
    {
      const { m, auto } = mundo();
      definirCampeao(m, 'katarina', { magia: true, distancia: false, papel: { dano: 1.3, recebido: 1 }, semMana: true });
      auto.perfilCampeao();
      t.check('B1: Katarina sem mana -> mana de item vale 0 (1027)', auto.valorDe('1027') === 0);
      t.check('B1: ...e o AP do mesmo inventário continua a valer', auto.valorDe('3089') > 0);

      definirCampeao(m, 'yasuo', { magia: false, distancia: false, papel: { dano: 1.1, recebido: 0.9 }, fluxo: true });
      auto.perfilCampeao();
      t.check('B2: Yasuo com fluxo -> mana de item vale 0 (1027)', auto.valorDe('1027') === 0);
      t.check('B2: ...e um item sem mana continua a valer', auto.valorDe('3031') > 0);

      definirCampeao(m, 'mago', { magia: true, distancia: false, papel: { dano: 1.1, recebido: 1 } });
      auto.perfilCampeao();
      t.check('B3: campeão com mana -> mana de item vale > 0 (1027)', auto.valorDe('1027') > 0);

      definirCampeao(m, 'adtest', { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } });
      auto.perfilCampeao();
      const adAp = auto.valorDe('3089');
      definirCampeao(m, 'mago', { magia: true, distancia: false, papel: { dano: 1.1, recebido: 1 } });
      auto.perfilCampeao();
      const apAp = auto.valorDe('3089');
      t.check('B4: item AP vale mais no campeão AP do que no AD (multClasse)', apAp > adAp);
      t.check('B4: ...e no AD não é zero acidental (penalização, não proibição)', adAp > 0);

      definirCampeao(m, 'tanque', { magia: false, distancia: false, papel: { dano: 0.9, recebido: 0.6 } });
      t.check('B5: papel dano/recebido de tanque -> perfil tanque', auto.perfilCampeao() === 'tanque');
      const tanqueDef = auto.valorDe('3024');
      t.check('B5: item defensivo vale > 0 no tanque', tanqueDef > 0);

      definirCampeao(m, 'adtest', { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } });
      auto.perfilCampeao();
      t.check('B6: item só-defensivo num perfil ofensivo leva 0,3 (não zero)',
        auto.valorDe('3024') > 0 && auto.valorDe('3024') < auto.valorDe('3031'));

      /* ---- B7..B13: mana = PRESSÃO calculada do kit, não booleano nem peso fixo ---------- */
      const STATS_EZ = { mp: 375, mpperlevel: 70, mpregen: 8.5, mpregenperlevel: 1, attackspeed: 0.625 };
      const KIT_EZ = {
        Q: { nivel: 1, max: 10, recarga: [3.6, 3.4, 3.2, 3, 2.8, 2.6, 2.4, 2.2, 2, 1.8],
          custo: [22, 23.5, 25, 26.5, 28, 29.5, 31, 32.5, 34, 35.5], base: [40], ratio: [1.3] },
        W: { nivel: 1, max: 10, recarga: [8, 7.7, 7.4, 7.1, 6.8, 6.5, 6.2, 5.9, 5.6, 5.3],
          custo: [50, 52, 54, 56, 58, 60, 62, 64, 66, 68],
          devolveMana: [40, 46, 52, 58, 64, 70, 76, 82, 88, 94] },
        E: { nivel: 1, max: 10, recarga: [26, 24, 22, 20, 18.5, 17, 15.5, 14.5, 13.5, 12.5],
          custo: [70, 70, 70, 70, 70, 70, 70, 70, 70, 70] },
        R: { nivel: 6, max: 5, recarga: [120, 105, 90, 75, 60], custo: [100, 100, 100, 100, 100] },
      };
      // Ezreal nv32: a W devolve mana (motor.js:633) e a regen é 3x (motor.js:574) -> a mana
      // de item não é dano. Isto é o caso medido pelo dono, calculado — não uma lista de nomes.
      definirCampeao(m, 'ezreal', { magia: false, distancia: true, papel: { dano: 1.1, recebido: 1 },
        stats: STATS_EZ, nivel: 32, kit: KIT_EZ, ordem: ['Q', 'W', 'E', 'R'] });
      auto.perfilCampeao();
      const infoEz = auto.manaInfoDe(auto.getMeta().champAtual);
      t.check('B7: Ezreal nv32 (regen + W devolve mana) -> mana de item vale 0', auto.valorDe('1027') === 0);
      t.check('B7: ...e o fator de pressão calculado é 0 (não é flag de campeão)', infoEz.fator === 0);
      t.check('B7: ...com o gasto/regen/retorno visíveis no diagnóstico',
        Number.isFinite(infoEz.gasto) && Number.isFinite(infoEz.regen) && Number.isFinite(infoEz.retorno));

      // O contrário: gasto alto e regen baixa -> o mesmo item tem de valer > 0.
      const STATS_FOME = { mp: 300, mpperlevel: 0, mpregen: 1, mpregenperlevel: 0, attackspeed: 0.6 };
      const KIT_FOME = { Q: { nivel: 1, max: 10, recarga: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        custo: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100], base: [10], ratio: [0.1] } };
      definirCampeao(m, 'fome', { magia: true, papel: { dano: 1, recebido: 1 },
        stats: STATS_FOME, nivel: 1, kit: KIT_FOME, ordem: ['Q'] });
      auto.perfilCampeao();
      t.check('B8: gasto 100/2s vs regen 0,6/s -> mana de item vale > 0', auto.valorDe('1027') > 0);
      t.check('B8: ...e o fator de pressão é > 0', auto.manaInfoDe(auto.getMeta().champAtual).fator > 0);

      // Ryze: `P.maestria` (motor.js:556-560) transforma mana em AP; a mana vale MESMO saturada.
      definirCampeao(m, 'ryze', { magia: true, papel: { dano: 1.1, recebido: 0.9 },
        stats: STATS_EZ, nivel: 32, ordem: ['Q'],
        kit: { P: { maestria: { poder: 0.06, manaPor100: 0.1, manaMax: 0.5 } },
          Q: { nivel: 1, max: 10, recarga: [4, 3.8, 3.6, 3.4, 3.2, 3, 2.8, 2.6, 2.4, 2.2],
            custo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], base: [60], ratio: [0.4] } } });
      auto.perfilCampeao();
      t.check('B9: Ryze (P.maestria) -> mana de item continua > 0', auto.valorDe('1027') > 0);

      // Cajado do Arcanjo (motor.js:562): 3% da mana máxima em AP. Também conta para OUTROS
      // itens de mana, não só para o próprio 3003. Num campeão AD o AP tem peso 0 (`perfilDe`),
      // por isso o teste é num mago: é o AP que a mana vira, não um "valor universal".
      definirCampeao(m, 'mago', { magia: true, papel: { dano: 1.1, recebido: 1 },
        stats: STATS_EZ, nivel: 32, kit: KIT_EZ, ordem: ['Q', 'W', 'E', 'R'] });
      auto.perfilCampeao();
      montarEquip(m, [sl('3003~B', 'lendario')]);
      t.check('B10: 3003 equipado -> efeitos leem 3% mana->AP (motor.js:562)',
        quase(auto.efeitosEquipados().manaToAp, 0.03, 1e-9));
      t.check('B10: ...e a mana de outro item passa a valer o AP que ela dá',
        auto.valorDe('1027') > 0);
      montarEquip(m, []);

      // Nível entra na conta pelos stats do motor; não há tabela por campeão.
      const STATS_NIVEL = { mp: 300, mpperlevel: 10, mpregen: 1, mpregenperlevel: 2, attackspeed: 0.6 };
      definirCampeao(m, 'nivel', { magia: true, papel: { dano: 1, recebido: 1 },
        stats: STATS_NIVEL, nivel: 1, kit: KIT_FOME, ordem: ['Q'] });
      auto.perfilCampeao();
      const manaNv1 = auto.valorDe('1027');
      definirCampeao(m, 'nivel', { magia: true, papel: { dano: 1, recebido: 1 },
        stats: STATS_NIVEL, nivel: 30, kit: KIT_FOME, ordem: ['Q'] });
      auto.perfilCampeao();
      const manaNv30 = auto.valorDe('1027');
      t.check('B11: a mesma fórmula baixa o valor da mana com a regen do nível 30',
        manaNv1 > 0 && manaNv30 > 0 && manaNv30 < manaNv1);

      // Sem stats do jogo o fallback é DECLARADO: mantém o peso do perfil (B3). Nunca inventa 0.
      definirCampeao(m, 'mago', { magia: true, papel: { dano: 1.1, recebido: 1 } });
      auto.perfilCampeao();
      t.check('B12: sem stats do jogo -> fallback mantém o peso antigo (> 0)', auto.valorDe('1027') > 0);

      // B1/B2 continuam a mandar: o flag do motor vence qualquer conta de pressão.
      definirCampeao(m, 'katarina', { magia: true, papel: { dano: 1.3, recebido: 1 }, semMana: true,
        stats: STATS_EZ, nivel: 32, kit: KIT_EZ, ordem: ['Q', 'W', 'E', 'R'] });
      auto.perfilCampeao();
      t.check('B13: semMana com stats completos -> mana de item continua 0', auto.valorDe('1027') === 0);
    }

    /* =================================================================================
     * C — VALOR INTRÍNSECO (stats + passiva + fase)
     * =============================================================================== */
    {
      const { m, auto } = mundo();
      definirCampeao(m, 'katarina', { magia: true, distancia: false, papel: { dano: 1.3, recebido: 1 }, semMana: true });
      auto.perfilCampeao();
      const base = auto.valorDe('4629');
      const real = auto.valorDe('4629', undefined, { qual: 'A', refino: 3 });
      t.check('C1: a peça concreta A+3 vale mais que a ficha base', real > base);

      t.check('C2: passiva de um item com campo cdr não conta o CDR duas vezes',
        auto.valorPassiva('3171') === 0);

      const baixo = auto.valorPctVida('3153', { hp: 1000, nivel: 1 }, auto.getMeta().champAtual);
      const alto = auto.valorPctVida('3153', { hp: 8000, nivel: 1 }, auto.getMeta().champAtual);
      t.check('C3: passiva de %vida cresce com a vida do alvo (3153)', alto > baixo);

      const ctx = { equipados: [] };
      definirCampeao(m, 'adtest', { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } });
      auto.perfilCampeao();
      const faseMob = auto.valorDeFase('3036', ctx, 'mobs');
      const faseChefe = auto.valorDeFase('3036', ctx, 'chefe');
      t.check('C4: bónus de fase do 3036 é maior contra chefe', faseChefe > faseMob);

      t.check('C5: item sem efeito -> valorPassiva 0', auto.valorPassiva('1001') === 0);

      definirCampeao(m, 'mago', { magia: true, distancia: false, papel: { dano: 1.1, recebido: 1 } });
      auto.perfilCampeao();
      t.check('C6: Rabadon é especial DA MINHA classe no mago', auto.ehEspecialMeu('3089') === true);
      definirCampeao(m, 'adtest', { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } });
      auto.perfilCampeao();
      t.check('C6: ...e NÃO é especial meu no AD', auto.ehEspecialMeu('3089') === false);

      t.check('C7: item AP da classe certa vale mais que o mesmo item na classe errada',
        auto.valorDe('3089') < (() => {
          definirCampeao(m, 'mago', { magia: true, distancia: false, papel: { dano: 1.1, recebido: 1 } });
          auto.perfilCampeao();
          return auto.valorDe('3089');
        })());
    }

    /* =================================================================================
     * D — CONJUNTO E RESTRIÇÕES DE SLOT
     * =============================================================================== */
    {
      const { m, auto } = mundo(CATALOGO);
      definirCampeao(m, 'adtest');

      const pool = [
        { base: '2007' }, { base: '2001' }, { base: '2004' },
        { base: '2005' }, { base: '2006' }, { base: '2002' },
      ];
      const valor = (i) => (i.base === '2007' ? 10 : 100);
      const cmp = (a, b) => valor(b) - valor(a) || (String(a.base) < String(b.base) ? -1 : 1);
      const semBota = auto.escolherConjunto(pool, cmp, valor);
      t.check('D1: 5 não-botas ganham de 1 bota + 4 quando valem mais', semBota.length === 5 && !semBota.some((i) => i.base === '2007'));
      const comBota = auto.escolherConjunto(pool, cmp);
      t.check('D1: CONTROLO - sem valorFn mantém a bota (comportamento histórico)', comBota.some((i) => i.base === '2007'));

      const doisLend = [{ base: '2001' }, { base: '2001' }];
      t.check('D2: lendário repetido entra UMA vez', auto.escolherConjunto(doisLend, cmp, valor).filter((i) => i.base === '2001').length === 1);
      const doisBas = [{ base: '1001' }, { base: '1001' }];
      t.check('D2: não-lendário repetido entra DUAS vezes', auto.escolherConjunto(doisBas, cmp, valor).length === 2);

      t.check('D3: pool vazio -> []', auto.escolherConjunto([], cmp, valor).length === 0);
      t.check('D3: pool com menos de 5 devolve o que há', auto.escolherConjunto([{ base: '2001' }], cmp, valor).length === 1);

      const iguais = [{ base: '2006' }, { base: '2004' }];
      const cmpBase = (a, b) => (String(a.base) < String(b.base) ? -1 : 1);
      t.check('D4: empate é determinístico por base', auto.escolherConjunto(iguais, cmpBase, () => 1).map((i) => i.base).join(',') === '2004,2006');

      const melhorLend = auto.porMelhorBase([{ base: '2001', qual: 'C' }, { base: '2001', qual: 'A' }]);
      t.check('D5: porMelhorBase guarda a melhor instância do lendário (A)', melhorLend.length === 1 && melhorLend[0].qual === 'A');

      const fontes = auto.fontesDeItens({ items: [
        { kind: 'item', base: '1001', qual: 'C', refino: 0, id: '1001~C' },
        { kind: 'item', base: '1001', qual: 'B', refino: 0, id: '1001~B' },
      ] });
      t.check('D6: fontes.todas preserva 2 cópias não-lendárias', (fontes.todas || []).filter((i) => i.base === '1001').length === 2);
      t.check('D6: ...e a melhor por base é a B', fontes.get('1001') && fontes.get('1001').qual === 'B');

      t.check('D7: base fora do catálogo não ocupa slot', auto.escolherConjunto([{ base: '999999' }], cmp, () => 1).length === 0);
    }

    /* =================================================================================
     * E — DECISÃO DE EQUIPAMENTO
     * =============================================================================== */
    {
      /* E1/E2 — a peça real A+3 sobre a Coroa C (o defeito do dono, 2026-10-20). */
      const { m, auto } = mundo();
      definirCampeao(m, 'katarina', { magia: true, distancia: false, papel: { dano: 1.3, recebido: 1 }, semMana: true });
      montarEquip(m, [
        sl('3175+4~A', 'lendario'), sl('3089+2~B', 'lendario'), sl('3100~C', 'lendario'),
        sl('3135+4~A', 'lendario'), sl('664644~C', 'lendario'),
      ]);
      montarMochila(m, [sl('4629+3~A', 'lendario')]);
      const pe = auto.planoEquipar(auto.scanBag(true));
      t.check('E1: Ímpeto A+3 entra sobre a Coroa C', basesDe(pe.entram).indexOf('4629') >= 0);
      t.check('E1: a Coroa C sai', basesDe(pe.saem).indexOf('664644') >= 0);
      t.check('E1: o ganho POR SLOT passou a histerese (não foi diluído pelos 5)', pe.ganhoSlot >= pe.histerese);
      t.check('E1: o conjunto não piorou (pAlvo >= pAtual)', pe.pAlvo >= pe.pAtual);
      t.check('E2: score medido é nulo ou favorece o alvo (rede de segurança não contradiz)',
        pe.scoreGanho == null || pe.scoreGanho >= 1);

      /* E2b — MESMA BASE, qualidade diferente: `4629~C` equipado + `4629+3~A` na mochila.
       * Comparar por base (o código antigo) dizia "não há troca"; por instância, entra/sai. */
      const wSame = mundo();
      definirCampeao(wSame.m, 'katarina', { magia: true, distancia: false, papel: { dano: 1.3, recebido: 1 }, semMana: true });
      montarEquip(wSame.m, [
        sl('3175+4~A', 'lendario'), sl('3089+2~B', 'lendario'), sl('3100~C', 'lendario'),
        sl('3135+4~A', 'lendario'), sl('4629~C', 'lendario'),
      ]);
      montarMochila(wSame.m, [sl('4629+3~A', 'lendario')]);
      const peSame = wSame.auto.planoEquipar(wSame.auto.scanBag(true));
      t.check('E2b: upgrade da MESMA base entra (A+3 sobre C)',
        peSame.entram.some((i) => String(i.id).indexOf('4629+3~A') === 0));
      t.check('E2b: ...e a instância C antiga sai',
        peSame.saem.some((i) => String(i.id).indexOf('4629~C') === 0));
      t.check('E2b: ...e o plano mexe', peSame.mexe === true);

      /* E3/E4 — sem downgrade, especial não desfaz tier; já coberto em equip.test E3/E5.
       * Aqui reforça-se a regra dura de raridade no caminho novo. */
      montarEquip(m, [
        sl('3175+4~A', 'lendario'), sl('3089+2~B', 'lendario'), sl('3100~C', 'lendario'),
        sl('3135+4~A', 'lendario'), sl('4629+3~A', 'lendario'),
      ]);
      montarMochila(m, [sl('1001~C', 'basico')]);
      const peDowngrade = auto.planoEquipar(auto.scanBag(true));
      t.check('E3: básico fraco não desloca lendário', basesDe(peDowngrade.entram).indexOf('1001') < 0);

      /* E5 — sem equipamento lido, o plano não inventa troca (só o actor enche slots vazios). */
      montarEquip(m, []);
      montarMochila(m, [sl('4629+3~A', 'lendario')]);
      const peVazio = auto.planoEquipar(auto.scanBag(true));
      t.check('E5: sem equipamento, planoEquipar não inventa troca', peVazio.mexe === false && peVazio.entram.length === 0);

      /* E6 — bota OPCIONAL: 5 não-botas melhores que a bota. Catálogo mínimo controlado. */
      const CAT = [
        { id: '9001', nome: 'Bota Fraca', raridade: 'lendario', lendario: true, espaco: 'botas', ad: 1, preco: 100 },
        { id: '9002', nome: 'Arma 1', raridade: 'lendario', lendario: true, espaco: 'arma', ad: 100, preco: 1000 },
        { id: '9003', nome: 'Arma 2', raridade: 'lendario', lendario: true, espaco: 'arma', ad: 100, preco: 1000 },
        { id: '9004', nome: 'Arma 3', raridade: 'lendario', lendario: true, espaco: 'arma', ad: 100, preco: 1000 },
        { id: '9005', nome: 'Arma 4', raridade: 'lendario', lendario: true, espaco: 'arma', ad: 100, preco: 1000 },
        { id: '9006', nome: 'Arma 5', raridade: 'lendario', lendario: true, espaco: 'arma', ad: 100, preco: 1000 },
      ];
      const wBota = mundo(CAT);
      definirCampeao(wBota.m, 'adtest', { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } });
      montarEquip(wBota.m, [sl('9001~B', 'lendario'), sl('9002~B', 'lendario'), sl('9003~B', 'lendario'), sl('9004~B', 'lendario'), sl('9005~B', 'lendario')]);
      montarMochila(wBota.m, [sl('9006~B', 'lendario')]);
      const alvoBota = wBota.auto.alvoEquip(wBota.auto.scanBag(true));
      t.check('E6: o alvo pode ser 5 não-botas (bota é opcional)', alvoBota.alvo.length === 5 && !alvoBota.alvo.some((i) => String(i.base) === '9001'));
      t.check('E6: ...e a 5.ª arma da mochila entra', alvoBota.alvo.some((i) => String(i.base) === '9006'));
      t.check('E6: ...e a bota fraca sai', basesDe(alvoBota.saem).indexOf('9001') >= 0);
    }

    /* =================================================================================
     * F — SCORE MEDIDO
     * =============================================================================== */
    {
      const { m, auto } = mundo();
      definirCampeao(m, 'katarina', { magia: true, distancia: false, papel: { dano: 1.3, recebido: 1 }, semMana: true });
      auto.perfilCampeao();
      const alvo = { hp: 10000, armadura: 50, nivel: 30, chefe: true, magico: false };
      const scoreBase = auto.scoreSet(['4629'], alvo);
      const scoreReal = auto.scoreSet(['4629+3~A'], alvo);
      t.check('F1: scoreSet usa a peça concreta A+3 (> base)', scoreReal > scoreBase);

      const st = auto.statsSet(['3175~A']);
      t.check('F2: statsSet lê a qualidade e mantém penMag 15%', quase(st.pen, 0.15));
      t.check('F2: ...e escala o AP da bota', st.ap > 70);

      const caps = auto.capsMotor();
      t.check('F3: CDR é limitado ao tecto do motor', auto.statsSet(['3171+5~SS']).cdr <= caps.cdr + 1e-9);

      t.check('F4: scoreSet com alvo null é finito (fallback declarado)',
        Number.isFinite(auto.scoreSet(['4629'], null)));

      t.check('F5: a build TEÓRICA devolve bases (sem ~/+); a decisão de equipar é que usa a peça',
        auto.buildIdealPara(auto.getMeta().champAtual).every((id) => /^\d+$/.test(String(id))));
    }

    /* =================================================================================
     * G — FONTES E FALLBACKS
     * =============================================================================== */
    {
      const { auto } = mundo();
      const f = auto.fontesDeItens({ items: [{ kind: 'item', base: '1001', qual: undefined, refino: 0, id: '1001' }] });
      t.check('G1: qualidade ausente = B (nunca C)', f.get('1001') && f.get('1001').qual === 'B');
      const fp = auto.fontesDeItens({ items: [{ kind: 'item', base: '1001', qual: '?', refino: 0, id: '1001~?' }] });
      t.check('G1: qualidade pendente ? = B (não perde para uma C real)', fp.get('1001') && fp.get('1001').qual === 'B');

      const vazio = auto.alvoQuatroFontes(null);
      t.check('G2: sem DOM/mercado/cofre, alvoQuatroFontes devolve estrutura vazia sem crash',
        !!vazio && Array.isArray(vazio.buscar) && Array.isArray(vazio.faltamTotal));

      t.check('G3: base fora do catálogo não entra no conjunto', auto.escolherConjunto([{ base: '999999' }], () => -1, () => 1).length === 0);

      t.check('G4: valorDe de base desconhecida é 0 (fallback declarado)', auto.valorDe('999999') === 0);
      t.check('G5: infoItem de base desconhecida não rebenta', auto.infoItem('999999') == null || typeof auto.infoItem('999999') === 'object');
    }
  },
};
