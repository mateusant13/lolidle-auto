
import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from '../tools/testes/dom-stub.mjs';
const KIT = {
  P: { curaBase: 0.05, voracidade: 1.5, voracidadeChefe: 5 },
  Q: { max: 10, base: [80,115,150,185,220,255,290,325,360,395], ratio: [0.45,0.48,0.51,0.54,0.57,0.6,0.63,0.66,0.69,0.72], recarga: [10,9.65,9.3,8.95,8.6,8.25,7.9,7.55,7.2,6.85], adaga: true },
  W: { max: 10, recarga: [14,13.6,13.2,12.8,12.4,12,11.6,11.2,10.8,10.4], adaga: true },
  E: { max: 10, base: [40,60,80,100,120,140,160,180,200,220], ratio: [0.3,0.32,0.34,0.36,0.38,0.4,0.42,0.44,0.46,0.48], adRatio: 0.4, recarga: [10,9.6,9.2,8.8,8.4,8,7.6,7.2,6.8,6.4] },
  R: { max: 5, base: [30,44,58,72,86], ratio: [0.25,0.28,0.31,0.34,0.37], recarga: [75,65,55,48,42], duracao: 2.5, golpes: 15, alvos: 3 },
  G: { max: 10, base: [30,45,60,75,90,105,120,135,150,165], ratio: [0.3,0.315,0.33,0.345,0.36,0.375,0.39,0.405,0.42,0.435], recarga: [20,19.2,18.4,17.6,16.8,16,15.2,14.4,13.6,12.8], curaSede: 0.3, va: [0.2,0.22,0.24,0.26,0.28,0.3,0.32,0.34,0.36,0.38], auto: true },
  A: { max: 10, base: [90,125,160,195,230,265,300,335,370,405], ratio: [0.6,0.635,0.67,0.705,0.74,0.775,0.81,0.845,0.88,0.915], recarga: [12,11.5,11,10.5,10,9.5,9,8.5,8,7.5], adaga: true, atordoa: 1 },
  F: { max: 10, venenoBase: [40,58,76,94,112,130,148,166,184,202], venenoRatio: 0.25, venenoT: 3, recarga: [16,15.5,15,14.5,14,13.5,13,12.5,12,11.5], dot: true },
  T: { max: 10, base: [60,88,116,144,172,200,228,256,284,312], ratio: [0.4,0.43,0.46,0.49,0.52,0.55,0.58,0.61,0.64,0.67], recarga: [24,23.2,22.4,21.6,20.8,20,19.2,18.4,17.6,16.8], adaga: true, adagas: 3 },
  B: { max: 10, recarga: [24,23.2,22.4,21.6,20.8,20,19.2,18.4,17.6,16.8], util: true },
  M: { max: 10, base: [200,280,360,440,520,600,680,760,840,920], ratio: [1.2,1.27,1.34,1.41,1.48,1.55,1.62,1.69,1.76,1.83], recarga: [14,13.5,13,12.5,12,11.5,11,10.5,10,9.5] },
  N: { max: 5, base: [90,130,170,210,250], ratio: [0.45,0.5,0.55,0.6,0.65], recarga: [75,66,58,51,45] },
  D: { max: 10, nivel: 18, passiva: true, curaGiro: [0.08,0.09,0.1,0.11,0.12,0.13,0.14,0.15,0.16,0.17], vaAdaga: [0.08,0.088,0.096,0.104,0.112,0.12,0.128,0.136,0.144,0.152], acumMax: 3, duracaoSinistra: 3 },
};
const m = criarMundo();
const a = carregarAutomation(m);
alimentarCatalogo(m);
definirCampeao(m, 'katarina', { magia: true, semMana: true, adagas: true, adBase: 58, adNivel: 3.4, giroSrc: '(nivel, a) => 30 + 19 * nivel + 1 * apDe(a) + 0.4 * Math.max(0, a.ad - a.baseAd)', kit: KIT });
// ranks da Katarina nv29 lidos do painel: Q10 W1 E3 R3 + D no rank 4
const RANKS = { Q:10, W:1, E:3, R:3, G:0, A:0, F:0, T:0, B:0, M:0, N:0, D:4 };
for (const t of Object.keys(RANKS)) {
  m.montar('#hab-ativas .hab[data-t]', m.montar('#hab-ativas .hab[data-t]', []));
}
// montar arsenal com todos
const els = [];
for (const t of Object.keys(RANKS)) els.push(m.el({ label: t, dataset: { t }, textContent: RANKS[t] + ' / 10' }));
m.montar('#hab-ativas .hab[data-t]', els);
// stats: nv 29, AP 180 (boneco de magia), AD 100
m.montar('#hud-nivel', [m.el({ label: 'nivel', textContent: '29' })]);
m.montar('#hud-vida-txt', [m.el({ label: 'vida', textContent: '2.4k / 2.4k' })]);
m.montar('.st', [
  m.el({ label: 'poder', textContent: 'Poder 180' }),
  m.el({ label: 'dano', textContent: 'Dano 100' }),
  m.el({ label: 'arm', textContent: 'Armadura 60' }),
  m.el({ label: 'rm', textContent: 'Res. mágica 60' }),
]);
const dh = a.dpsPorHabilidade();
console.log('=== giro (Voracidade) ===', dh.giro);
console.log('=== curaGiro ===', JSON.stringify(dh.curaGiro));
console.log('=== habs ===');
for (const h of dh.habs) console.log('  ' + h.t + (h.passiva ? ' (passiva)' : '') + ': dano=' + h.dano + ' cd=' + h.cd + ' dps=' + h.dps + (h.adaga ? ' [adaga]' : ''));
console.log('curaGiroS() =', a.curaGiroS());
