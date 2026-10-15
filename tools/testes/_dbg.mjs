import { criarMundo, carregarAutomation } from './tools/testes/dom-stub.mjs';
const m = criarMundo();
const auto = carregarAutomation(m);
const eq = m.exports;
// mundo minimo: campeao AD + equipados
console.log(JSON.stringify({ buildIdeal: (typeof auto.buildIdeal === 'function' ? auto.buildIdeal() : 'n/d'), champ: (auto.getMeta && auto.getMeta().champAtual) || null }, null, 1));