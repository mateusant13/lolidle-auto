
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from '../tools/testes/dom-stub.mjs';
const m = criarMundo();
const auto = carregarAutomation(m);
alimentarCatalogo(m);
definirCampeao(m, 'darius', { magia: false, kit: {
  E: { max: 10, recarga: [26,24,22,20.5,19,17.5,16,15,14,13], pen: [0.2,0.23,0.26,0.29,0.32,0.35,0.38,0.41,0.43,0.45] },
  Q: { max: 10, base: [50,70], ratio: [1,1.05], recarga: [9,8.5] },
} });
m.montar('#hab-ativas .hab[data-t]', [
  m.el({ label: 'E', dataset: { t: 'E' }, textContent: '4 / 10' }),
  m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
]);
console.log('penKitDe(E,4) =', auto.penKitDe('E', 4));
console.log('penKitCampeao(E) =', auto.penKitCampeao('E'));
console.log('rankKitDe(E) =', auto.rankKitDe('E'));
const S = auto.statsSet([]);
console.log('statsSet([]) penArmadura =', S.penArmadura, ' penKit =', S.penKit);
const S2 = auto.statsSet(['3036']);
console.log('statsSet([3036]) penArmadura =', S2.penArmadura);
const alvo = { armadura: 144, nivel: 44 };
console.log('estimarSet([], alvo).dps =', auto.estimarSet([], alvo).dps);
console.log('estimarSet([3036], alvo).dps =', auto.estimarSet(['3036'], alvo).dps);
const m2 = criarMundo();
const a2 = carregarAutomation(m2);
alimentarCatalogo(m2);
definirCampeao(m2, 'katarina', { magia: true, kit: { Q: { max: 10, base: [80,115], ratio: [0.45,0.48], recarga: [10,9.65] }, D: { passiva: true, curaGiro: [0.08,0.09,0.1,0.11,0.12,0.13,0.14,0.15,0.16,0.17] }, P: { curaBase: 0.05 } } });
m2.montar('#hab-ativas .hab[data-t]', [ m2.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }) ]);
console.log('KATARINA penKitCampeao =', a2.penKitCampeao('E'));
console.log('KATARINA statsSet([]).penArmadura =', a2.statsSet([]).penArmadura);
