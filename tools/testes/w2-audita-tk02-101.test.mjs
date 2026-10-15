/* w2-audita-tk02-101.test.mjs - AUDITORIA (W2b) de TK-02-101 (P0):
 * buildPorFase:true mas as três builds davam o MESMO + peça de chefe no farm de mobs.
 * Corre directo: bun tools/testes/w2-audita-tk02-101.test.mjs */
import { criarMundo, carregarAutomation, alimentarMeta, definirCampeao } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';
let falhas = 0, n = 0;
const ck = (l, c) => { n++; console.log((c === true ? 'ok: ' : 'FALHOU: ') + l); if (c !== true) falhas++; };
const m = criarMundo(); const auto = carregarAutomation(m);
m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]); m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
definirCampeao(m, 'katarina', { magia: true, distancia: false, papel: { dano: 1.2, recebido: 0.75 }, kit: { Q: { max: 5, base: [50, 70], ratio: [0.5, 0.6], recarga: [10, 9] } } });
alimentarMeta(m, { itens: ITENS_DADOS });
const C = { id: 'katarina', magia: true, distancia: false, papel: { dano: 1.2, recebido: 0.75 } };
const mobs = auto.buildIdealParaFase(C, 'mobs').map(String);
const chefe = auto.buildIdealParaFase(C, 'chefe').map(String);
const nullo = auto.buildIdeal().map(String);
ck('T1: as build POR FASE são DIFERENTES (antes os 3 casos davam o MESMO)', JSON.stringify(mobs) !== JSON.stringify(chefe));
ck('T2: a peça de CHEFE 3153 (Gume da Nevoa: 5% da vida do alvo) NAO está na build de MOBS', mobs.indexOf('3153') < 0);
ck('T3: cada build tem 5 itens (1 bota + 4)', mobs.length === 5 && chefe.length === 5);
ck('T4: buildIdeal("boss")===buildIdeal("chefe") (normalizaFase na rota buildIdeal)', JSON.stringify(auto.buildIdeal('boss')) === JSON.stringify(auto.buildIdeal('chefe')));
console.log('  mobs =', mobs.join(','), '| chefe =', chefe.join(','), '| ideal(null) =', nullo.join(','));
console.log('  NOTA (finding da auditoria): buildIdealParaFase(c,"boss") NAO passa por normalizaFase (diverge de "chefe"); buildIdeal/buildDaFase normalizam. A confirmar pelo escritor.');
console.log('AUDITA TK-02-101: ' + (n - falhas) + '/' + n + ' ok');
process.exit(falhas ? 1 : 0);
