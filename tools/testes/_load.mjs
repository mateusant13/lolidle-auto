import { criarMundo, carregarAutomation } from './dom-stub.mjs';
console.log('a criar mundo...');
const m = criarMundo();
console.log('a carregar automation...');
const auto = carregarAutomation(m);
console.log('carregado. funcoes:', typeof auto.buildIdeal, typeof auto.player);
console.log('buildIdeal:', JSON.stringify((auto.buildIdeal() || []).slice(0, 5)));
