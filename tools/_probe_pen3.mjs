
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from '../tools/testes/dom-stub.mjs';
const m = criarMundo();
const a = carregarAutomation(m);
alimentarCatalogo(m);
definirCampeao(m, 'darius', { magia: false, kit: {
  E: { max: 10, recarga: [26,24,22,20.5,19,17.5,16,15,14,13], pen: [0.2,0.23,0.26,0.29,0.32,0.35,0.38,0.41,0.43,0.45] },
  Q: { max: 10, base: [50,70], ratio: [1,1.05], recarga: [9,8.5] },
} });
m.montar('#hab-ativas .hab[data-t]', [
  m.el({ label: 'E', dataset: { t: 'E' }, textContent: '10 / 10' }),
  m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
]);
console.log('statsSet([])      =', JSON.stringify(a.statsSet([])));
console.log('statsSet([3036])  =', JSON.stringify(a.statsSet(['3036'])));
const alvo = { armadura: 144, nivel: 44, hp: 1000 };
console.log('estimarSet([])    =', JSON.stringify(a.estimarSet([], alvo)));
console.log('estimarSet([3036])=', JSON.stringify(a.estimarSet(['3036'], alvo)));
