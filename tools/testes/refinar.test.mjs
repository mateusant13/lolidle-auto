/*
 * refinar.test.mjs - AUTO-REFINO (Ornn): a lista de essenciais é a TEÓRICA, não a medida.
 *
 * TK-02-06 (P1). Objectivo do dono, ponto 6 (verbatim): "Tirar a ultima muleta: refinarMelhores
 * ainda prefere o medido (n>=3) ao teorico." ANTES a lista de essenciais era SUBSTITUÍDA pela
 * build que MEDIU melhor (n>=3) sempre que houvesse amostra. Refinar é IRREVERSÍVEL e um
 * conjunto que mediu melhor numa região e num nível não é necessariamente a build certa para o
 * campeão — a muleta punha o ouro do dono na peça errada.
 *
 * AGORA: a lista é a `buildIdeal()` (catálogo do MOTOR + pesos do perfil — a MESMA build que a
 * extensão recomenda em todo o lado). O medido (n>=3) fica como VALIDAÇÃO: é devolvido no
 * resultado (`medido`/`divergenciaMedido`) para se ver a diferença, sem mudar a decisão.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

/** Fixture do readEquip (automation.js:954): '#equip > button.slot[data-id]' com '<base>~<qual>'. */
function montarEquip(m, slots) {
  m.montar('#equip > button.slot[data-id]', slots.map((s) => m.el({
    tag: 'button', label: 'equip:' + s.id,
    className: 'slot ' + (s.raridade || 'basico'),
    attrs: { 'data-id': s.id, 'data-dica': s.dica || '' },
  })));
}
const sl = (id, raridade) => ({ id, raridade });

/** Ciclos medidos de uma build DIFERENTE da teórica e com 9999 ouro/min (a muleta antiga
 *  punha esta lista à frente da build ideal exactamente por ser "a que mediu melhor"). */
function semearMedido(auto, bases) {
  auto.importar({ farm: { cycles: [1, 2, 3, 4].map((i) => ({
    region: 'Covil do Barão 40–48', endedAt: i, deaths: 0, boss: 'Barão Nashor',
    mobFase: { perMin: { gold: 9999, xp: 3000, kills: 12, potions: 1 }, hpMin: 3000, hpMax: 4000 },
    bossFase: { durMs: 60000 },
    setup: { equip: bases.map((b) => ({ base: b })) },
  })), log: [], issues: [] } });
}

export const suite = {
  nome: 'refinar',
  titulo: 'refinarMelhores: o teórico manda; o medido (n>=3) é só validação (TK-02-06)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: 'Fonte de Runeterra' })]);
    definirCampeao(m, 'adtest');

    /* ----R0: sem histórico, a lista é a teórica ---- */
    const teorica = (auto.buildIdeal() || []).map(String);
    const r0 = await auto.refinarMelhores();
    t.check('R0: sem histórico, essenciais = buildIdeal() teórica',
      JSON.stringify(r0.essenciais) === JSON.stringify(teorica));
    t.check('R0: e a fonte é "teorico"', r0.fonteEssenciais === 'teorico');
    t.check('R0: e não há medição a validar', r0.medido === null);

    /* ----R1: com histórico medido (n>=3) a muleta já não substitui a lista ---- */
    semearMedido(auto, ['3089', '3001', '3002', '3003', '3004']);
    const r1 = await auto.refinarMelhores();
    t.check('R1: com n=4 medido a 9999 ouro/min, a lista CONTINUA teórica',
      JSON.stringify(r1.essenciais) === JSON.stringify(teorica));
    t.check('R1: e a fonte continua "teorico"', r1.fonteEssenciais === 'teorico');
    t.check('R1: a build medida (9999 ouro/min) NÃO entrou na lista',
      (r1.essenciais || []).indexOf('3089') < 0 && (r1.essenciais || []).indexOf('3001') < 0);

    /* ----R2: o medido é devolvido como VALIDAÇÃO, não aplicado ---- */
    t.check('R2: o medido é devolvido (n=4, 9999 ouro/min)',
      !!r1.medido && r1.medido.n === 4 && Math.round(r1.medido.ouroMin) === 9999);
    t.check('R2: e a divergência está nomeada (o 3089 medido está fora da teórica)',
      Array.isArray(r1.divergenciaMedido) && r1.divergenciaMedido.indexOf('3089') >= 0);

    /* ----R3: o ALVO do refino segue a lista teórica ---- */
<<<<<<< HEAD
    //Fixture que faltava: o refino corre no NPC do Ornn, que existe na Fonte.
    m.montar('#npcs button[data-npc="Ornn"]', [m.el({ tag: 'button', label: 'npc-ornn' })]);
    m.montar('#janela-npc [data-palavra="forjar"]', [m.el({ tag: 'button', label: 'forjar' })]);
=======
>>>>>>> w4-fuga
    montarEquip(m, [sl('2001~A', 'lendario'), sl('3089~A', 'lendario'), sl('2004~A', 'lendario')]);
    const r3 = await auto.refinarMelhores();
    // 2001 e 2004 são da build teórica do AD (buildIdeal = 2007,2001,2004,2005,2006); o 3089 não é.
    t.check('R3: o 3089 (medido, fora da build) NUNCA é alvo do refino',
      (r3.essenciais || []).indexOf('3089') < 0);
    t.check('R3: e os itens da build teórica são os essenciais',
      ['2001', '2004'].every((b) => (r3.essenciais || []).indexOf(b) >= 0));
    t.check('R3: o refino corre na Fonte e devolve o que fez', r3.ok === true && Array.isArray(r3.refinados));

    t.check('Z: nenhum seletor desconhecido foi usado (stub honesto)', m.unstubbed().length === 0);
  },
};
