/*
 * equip.test.mjs - REGRAS DE EQUIPAMENTO (as duas regras explicitas do dono).
 *
 *   "EPICO e MELHOR que BASICO -> um epico equipavel NUNCA pode ficar na mochila com um
 *    basico equipado no mesmo slot."
 *   "Equipar SEMPRE o melhor item disponivel em cada slot."
 *
 * PORQUE ESTA SUITE EXISTE: o banco tinha ZERO cobertura para equipar - nenhum teste tocava
 * EQUIPAR / equiparMelhores / planoEquipar / alvoEquip / item equipado. Era o ponto cego
 * exactamente na regra que o dono mais se queixou ("porque e que ele nao equipa os epicos").
 *
 * O fixture respeita o contrato REAL de readEquip (automation.js:808):
 *   '#equip > button.slot[data-id]', data-id = '<base>+<ref>~<qual>', raridade vem da className.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao, montarMochila } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';

function montarEquip(m, slots) {
  const filhos = slots.map((s) => m.el({
    tag: 'button', label: 'equip:' + s.id,
    className: 'slot ' + (s.raridade || 'basico'),
    attrs: { 'data-id': s.id, 'data-dica': s.dica || '' },
  }));
  // O stub monta pelo SELECTOR COMPLETO (como montarLojista faz com
  // '#janela-venda .cofre-slot[data-separar]'), nao pelo no. Montar em '#equip' deixava
  // readEquip() a devolver [] e planoEquipar() a sair pelo 'if (!eq.length) return vazio'.
  m.montar('#equip > button.slot[data-id]', filhos);
}
const sl = (id, raridade) => ({ id: id, raridade: raridade });
const basesDe = (arr) => (arr || []).map((i) => String(i.base || i.id));

export const suite = {
  nome: 'equip',
  titulo: 'Equipamento (epico vence basico; o melhor do slot; sem downgrade)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');

    /* E1 - A REGRA EXPLICITA: basico equipado + epico na mochila -> o epico ENTRA. */
    montarEquip(m, [sl('1001~C', 'basico')]);
    let bag = montarMochila(m, [sl('2002~C', 'epico')]);
    let pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E1: com basico equipado, o EPICO da mochila e equipado', basesDe(pe.entram).indexOf('2002') >= 0);
    t.check('E1: o plano marca que ha troca a fazer', pe.mexe === true);

    /* E2 - EQUIPAR O MELHOR: epico equipado + lendario melhor na mochila -> o lendario ENTRA. */
    montarEquip(m, [sl('2002~C', 'epico')]);
    montarMochila(m, [sl('2001~C', 'lendario')]);
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E2: o lendario melhor da mochila e equipado sobre o epico', basesDe(pe.entram).indexOf('2001') >= 0);

    /* NOTA DE FIXTURE (medida): com slots VAZIOS o escolherConjunto PREENCHE ate 5, logo
     * nada 'sai' e `entram` recebe os basics - que e o comportamento CERTO (melhor um basico
     * que um slot vazio). Para testar SUBSTITUICAO o conjunto tem de estar CHEIO: 1 bota + 4. */
    const CHEIO = [sl('2007~C', 'lendario'), sl('2001~C', 'lendario'), sl('2004~C', 'lendario'),
      sl('2005~C', 'lendario'), sl('2006~C', 'lendario')];

    /* E3 - SEM DOWNGRADE: conjunto cheio de lendarios + basico fraco na mochila. */
    montarEquip(m, CHEIO);
    montarMochila(m, [sl('1001~C', 'basico'), sl('1005~C', 'basico')]);
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E3: um basico fraco NUNCA substitui um lendario forte', basesDe(pe.entram).indexOf('1001') < 0);
    t.check('E3: o lendario equipado nao sai por causa de um basico', basesDe(pe.saem).indexOf('2001') < 0);

    /* E4 - NADA A FAZER: conjunto cheio e so ha pior na mochila -> mexe=false. */
    montarEquip(m, CHEIO);
    montarMochila(m, [sl('9500~C', 'lendario')]);
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E4: sem troca melhor, o plano nao mexe (n.equip fecha)', pe.mexe === false);

    /* E5 - SEM OBJETIVO POR DECRETO (TK-01): o `cfg.objetivoItem` foi REMOVIDO. Um Rabadon
     * (3089, AP) equipado num campeao AD e o MAIS FRACO do conjunto — sai, e mexer no campo
     * removido NAO o segura (nao ha alvo por decreto). O resultado nao pode depender do campo. */
    const comRabadon = [sl('2007~C', 'lendario'), sl('2001~C', 'lendario'), sl('2004~C', 'lendario'),
      sl('2005~C', 'lendario'), sl('3089~C', 'lendario')];
    montarEquip(m, comRabadon);
    montarMochila(m, [sl('2006~C', 'lendario')]);
    auto.setConfig({ objetivoItem: 'rabadon' });
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E5: o campo removido `objetivoItem` NAO segura um Rabadon fraco na build AD',
      basesDe(pe.saem).indexOf('3089') >= 0);
    auto.setConfig({ objetivoItem: null });
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E5: CONTROLO - sem o campo, o Rabadon fraco tambem SAI (o resultado nao depende dele)',
      basesDe(pe.saem).indexOf('3089') >= 0);

    /* E6 - PEÇA REAL: O REFINO/CONCRETO MANDA (defeito medido pelo dono, 2026-10-20).
     * "me explica por que essa combinacao e melhor que encaixar o meu outro item tier A com
     * refino mais 3" — a Coroa C estava equipada e o Ímpeto Cósmico A+3 na mochila. O
     * `valorDeFase` comparava o CATÁLOGO BASE (70 AP / 15% CDR) e ignorava o +3/qualidade A:
     * o Ímpeto REAL é 109,5 AP / 23,46% CDR / 547 de vida (motor.js:252; QUALIDADES e
     * BONUS_REFINO). O planeador TEM de vestir a peça real, não a ficha base.
     * A Katarina é sem mana (motor.js:470-474): os 600 de mana da Coroa não valem nada. */
    const m2 = criarMundo();
    const auto2 = carregarAutomation(m2);
    alimentarCatalogo(m2, ITENS_DADOS);
    definirCampeao(m2, 'katarina', { magia: true, distancia: false, papel: { dano: 1.3, recebido: 1 }, semMana: true });
    montarEquip(m2, [
      sl('3175+4~A', 'lendario'), sl('3089+2~B', 'lendario'), sl('3100~C', 'lendario'),
      sl('3135+4~A', 'lendario'), sl('664644~C', 'lendario'),
    ]);
    montarMochila(m2, [sl('4629+3~A', 'lendario')]);
    const pe6 = auto2.planoEquipar(auto2.scanBag(true));
    t.check('E6: o Ímpeto A+3 da mochila ENTRA sobre a Coroa C', basesDe(pe6.entram).indexOf('4629') >= 0);
    t.check('E6: a Coroa C SAI (peça real A+3 não é bloqueada pela histerese do conjunto)',
      basesDe(pe6.saem).indexOf('664644') >= 0);
    t.check('E6: o plano marca que há troca a fazer', pe6.mexe === true);
    /* E7 - TROCA DE FASE: o ALVO CONCRETO manda, nao a lista de bases teoricas (2026-10-20).
     * DEFEITO MEDIDO AO VIVO: `trocarBuildDaFase` usava `montarBuildDe()` (bases do catalogo) e
     * vestia `6655~C`/`3171+2~B` por cima de `3175+4~A`/`3135+4~A`; `equiparMelhores` desfazia
     * no tick seguinte = oscilacao. O alvo tem de sair de `alvoEquip`, que compara a peca REAL
     * (qualidade+refino) e respeita a histerese (`mexe`). */
    montarEquip(m2, [
      sl('3175+4~A', 'lendario'), sl('3089+2~B', 'lendario'), sl('3100~C', 'lendario'),
      sl('3135+4~A', 'lendario'), sl('4629+3~A', 'lendario'),
    ]);
    montarMochila(m2, [sl('6655~C', 'epico'), sl('3171+2~B', 'lendario')]);
    auto2.setConfig({ faseEstavelSeg: 0, trocaBuildCooldownMs: 0, buildPorFase: true });
    auto2.getFarm().current = { fase: 'mobs' };
    const antes7 = basesDe(auto2.readEquip()).join(',');
    const r7 = await auto2.trocarBuildDaFase();
    const depois7 = basesDe(auto2.readEquip()).join(',');
    t.check('E7: a troca de fase NAO despe 3175+4/3135+4 por bases teoricas 6655/3171',
      r7.feito === false && depois7 === antes7);
    t.check('E7: ...e o motivo diz que o alvo concreto nao supera a histerese',
      /build de mobs|supera a histerese/.test(String(r7.motivo || '')));
  },
};
