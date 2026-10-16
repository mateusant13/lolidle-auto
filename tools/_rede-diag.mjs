const list = await (await fetch('http://127.0.0.1:9410/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const reqs = new Map(); const done = new Set(); const falhas = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') { const r = m.params.request; reqs.set(m.params.requestId, { url: r.url, tipo: m.params.type, t: Date.now() }); }
  if (m.method === 'Network.loadingFinished') done.add(m.params.requestId);
  if (m.method === 'Network.loadingFailed') { falhas.push({ id: m.params.requestId, erro: m.params.errorText }); done.add(m.params.requestId); }
});
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Network.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 30000));
console.log('pedidos capturados: ' + reqs.size + ' | concluidos: ' + done.size + ' | falhados: ' + falhas.length);
const pendentes = [...reqs.entries()].filter(([k]) => !done.has(k));
console.log('=== PENDENTES (nunca concluiram) ===');
for (const [k, v] of pendentes.slice(0, 15)) console.log('  [' + v.tipo + '] ' + v.url.slice(0, 105));
console.log('=== ULTIMOS CONCLUIDOS ===');
const concl = [...reqs.entries()].filter(([k]) => done.has(k)).slice(-12);
for (const [k, v] of concl) console.log('  [' + v.tipo + '] ' + v.url.slice(0, 105));
console.log('=== FALHAS ===');
for (const f of falhas.slice(0, 8)) console.log('  ' + (reqs.get(f.id)?.url || '?').slice(0, 90) + ' -> ' + f.erro);
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true });
console.log('estado final da pagina: ' + (r.__t ? 'SEM RESPOSTA (congelada)' : String(r.result?.result?.value)));
ws.close(); process.exit(0);