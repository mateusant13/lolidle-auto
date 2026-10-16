const nt = await (await fetch('http://127.0.0.1:9430/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(nt.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const reqs = new Map(); const done = new Set();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, { url: m.params.request.url, tipo: m.params.type });
  if (m.method === 'Network.loadingFinished') done.add(m.params.requestId);
  if (m.method === 'Network.loadingFailed') done.add(m.params.requestId);
});
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable');
// 1) DESLOGADO: ir a raiz, tirar o token, navegar para o jogo
await send('Page.navigate', { url: 'https://lolidle.com/' });
await new Promise(r => setTimeout(r, 9000));
const rm = await send('Runtime.evaluate', { expression: "(function(){ var t=localStorage.getItem('lol-idle-token'); localStorage.removeItem('lol-idle-token'); return !!t; })()", returnByValue: true });
console.log('token removido: ' + (rm.__t ? '?' : String(rm.result?.result?.value)));
reqs.clear(); done.clear();
await send('Page.navigate', { url: 'https://lolidle.com/jogar' });
await new Promise(r => setTimeout(r, 26000));
const p1 = [...reqs.entries()].filter(([k,v]) => /pulso/.test(v.url));
console.log('=== DESLOGADO ===');
console.log('  pedidos: ' + reqs.size + ' | concluidos: ' + done.size);
for (const [k,v] of p1) console.log('  pulso.js -> ' + (done.has(k) ? 'CONCLUIU' : 'PENDENTE'));
const r1 = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true });
console.log('  pagina: ' + (r1.__t ? 'SEM RESPOSTA (congelada)' : String(r1.result?.result?.value)));
ws.close(); process.exit(0);