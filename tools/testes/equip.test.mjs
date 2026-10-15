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

    /* E5 - OBJETIVO PINADO: conjunto cheio onde o Rabadon e o mais fraco para AD; ha um
     * lendario AD melhor na mochila. COM objetivo o Rabadon fica; SEM objetivo ele sai. */
    const comRabadon = [sl('2007~C', 'lendario'), sl('2001~C', 'lendario'), sl('2004~C', 'lendario'),
      sl('2005~C', 'lendario'), sl('3089~C', 'lendario')];
    montarEquip(m, comRabadon);
    montarMochila(m, [sl('2006~C', 'lendario')]);
    auto.setConfig({ objetivoItem: 'rabadon' });
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E5: o Rabadon equipado NAO sai com o objetivo pinado', basesDe(pe.saem).indexOf('3089') < 0);
    auto.setConfig({ objetivoItem: null });
    pe = auto.planoEquipar(auto.scanBag(true));
    t.check('E5: CONTROLO - sem objetivo o Rabadon fraco SAI (a guarda e que o segura)',
      basesDe(pe.saem).indexOf('3089') >= 0);
  },
};
