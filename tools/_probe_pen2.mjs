
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from '../tools/testes/dom-stub.mjs';
function mkDarius(rankE) {
  const m = criarMundo();
  const a = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'darius', { magia: false, kit: {
    E: { max: 10, recarga: [26,24,22,20.5,19,17.5,16,15,14,13], pen: [0.2,0.23,0.26,0.29,0.32,0.35,0.38,0.41,0.43,0.45] },
    Q: { max: 10, base: [50,70], ratio: [1,1.05], recarga: [9,8.5] },
  } });
  m.montar('#hab-ativas .hab[data-t]', [
    m.el({ label: 'E', dataset: { t: 'E' }, textContent: rankE + ' / 10' }),
    m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
  ]);
  return { m, a };
}
const ARM = 144;
for (const rk of [1, 4, 10]) {
  const { a } = mkDarius(rk);
  const pen = a.penKitCampeao('E');
  const mitCom = 100 / (100 + ARM * (1 - pen));
  const mitSem = 100 / (100 + ARM);
  console.log('rankE=' + rk + ' penKit=' + pen.toFixed(4) + ' mitCom=' + mitCom.toFixed(4) + ' mitSem=' + mitSem.toFixed(4) + ' ganho=' + (mitCom/mitSem).toFixed(4) + 'x (' + ((mitCom/mitSem-1)*100).toFixed(1) + '%)');
}
