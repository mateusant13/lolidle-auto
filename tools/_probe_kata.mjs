
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from '../tools/testes/dom-stub.mjs';
const m = criarMundo();
const a = carregarAutomation(m);
alimentarCatalogo(m);
// kit REAL da Katarina lido do jogo vivo (kit-katarina-vivo.json + motor.js:748-784)
definirCampeao(m, 'katarina', { magia: true, semMana: true, adagas: true, adBase: 58, adNivel: 3.4, giroSrc: '(nivel, a) => 30 + 19 * nivel + 1 * apDe(a) + 0.4 * Math.max(0, a.ad - a.baseAd)', kit: {
  P: { curaBase: 0.05, voracidade: 1.5, voracidadeChefe: 5 },
  Q: { max: 10, nivel: 1, base: [80,115,150,185,220,255,290,325,360,395], ratio: [0.45,0.48,0.51,0.54,0.57,0.6,0.63,0.66,0.69,0.72], recarga: [10,9.65,9.3,8.95,8.6,8.25,7.9,7.55,7.2,6.85], adaga: true },
  W: { max: 10, nivel: 1, recarga: [14,13.6,13.2,12.8,12.4,12,11.6,11.2,10.8,10.4], adaga: true },
  E: { max: 10, nivel: 1, base: [40,60,80,100,120,140,160,180,200,220], ratio: [0.3,0.32,0.34,0.36,0.38,0.4,0.42,0.44,0.46,0.48], adRatio: 0.4, recarga: [10,9.6,9.2,8.8,8.4,8,7.6,7.2,6.8,6.4] },
  D: { max: 10, nivel: 18, passiva: true, curaGiro: [0.08,0.09,0.1,0.11,0.12,0.13,0.14,0.15,0.16,0.17], vaAdaga: [0.08,0.088,0.096,0.104,0.112,0.12,0.128,0.136,0.144,0.152], acumMax: 3, duracaoSinistra: 3 },
} });
m.montar('#hab-ativas .hab[data-t]', [
  m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
  m.el({ label: 'W', dataset: { t: 'W' }, textContent: '1 / 10' }),
  m.el({ label: 'E', dataset: { t: 'E' }, textContent: '3 / 10' }),
  m.el({ label: 'D', dataset: { t: 'D' }, textContent: '1 / 10' }),
]);
console.log('KAT.D.curaGiro =', typeof a.KAT_D_curaGiro);
const vor = a.voracidadeDe();
console.log('voracidadeDe =', JSON.stringify(vor));
console.log('curaGiroDe   =', JSON.stringify(a.curaGiroDe ? 'n/a' : 'n/a'));
// exponho via dpsPorHabilidade
const dh = a.dpsPorHabilidade();
console.log('giro (dano)  =', dh.giro);
console.log('curaGiro     =', JSON.stringify(dh.curaGiro));
console.log('habs:', dh.habs.map(h => h.t + ':' + h.dps).join(' '));
