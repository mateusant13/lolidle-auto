
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from '../tools/testes/dom-stub.mjs';
const m = criarMundo();
const a = carregarAutomation(m);
alimentarCatalogo(m);
definirCampeao(m, 'darius', { magia: false, kit: {
  E: { max: 10, recarga: [26,24,22,20.5,19,17.5,16,15,14,13], pen: [0.2,0.23,0.26,0.29,0.32,0.35,0.38,0.41,0.43,0.45] },
  Q: { max: 10, base: [500,700], ratio: [1,1.05], recarga: [9,8.5] },
} });
m.montar('#hab-ativas .hab[data-t]', [
  m.el({ label: 'E', dataset: { t: 'E' }, textContent: '10 / 10' }),
  m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
]);
const alvo = { armadura: 144, nivel: 44, hp: 1000 };
const s1 = a.estimarSet(['2001'], alvo);      // Lendario AD 1 (ad 400)
const s2 = a.estimarSet(['2001','3036'], alvo);
console.log('com 2001        : dps =', s1.dps, ' penArmadura =', a.statsSet(['2001']).penArmadura);
console.log('com 2001 + 3036 : dps =', s2.dps, ' penArmadura =', a.statsSet(['2001','3036']).penArmadura);
console.log('razao =', (s2.dps/s1.dps).toFixed(4));
const esperado = (100/(100+144*(1-0.615))) / (100/(100+144*(1-0.45)));
console.log('razao esperada (mit) =', esperado.toFixed(4));
