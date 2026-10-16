const nt = await (await fetch('http://127.0.0.1:9410/json/new?about:blank', { method: 'PUT' })).json();
console.log('aba nova: ' + (nt.id || '?'));
const ws = new WebSocket(nt.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const reqs = new Map(); const done = new Set(); const falhas = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, { url: m.params.request.url, tipo: m.params.type, t: Date.now() });
  if (m.method === 'Network.loadingFinished') done.add(m.params.requestId);
  if (m.method === 'Network.loadingFailed') { falhas.push({ id: m.params.requestId, erro: m.params.errorText }); done.add(m.params.requestId); }
});
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Network.enable'); await send('Page.enable');
const t0 = Date.now();
await send('Page.navigate', { url: 'https://lolidle.com/jogar' });
await new Promise(r => setTimeout(r, 32000));
console.log('pedidos: ' + reqs.size + ' | concluidos: ' + done.size + ' | falhados: ' + falhas.length);
const pendentes = [...reqs.entries()].filter(([k]) => !done.has(k));
console.log('=== PENDENTES ===');
for (const [k, v] of pendentes.slice(0, 10)) console.log('  +' + ((v.t - t0)/1000).toFixed(1) + 's [' + v.tipo + '] ' + v.url.slice(0, 100));
console.log('=== ultimos 16 por ordem ===');
for (const [k, v] of [...reqs.entries()].sort((a,b)=>a[1].t-b[1].t).slice(-16)) console.log('  +' + ((v.t - t0)/1000).toFixed(1) + 's [' + v.tipo + '] ' + (done.has(k) ? 'ok  ' : 'PEND') + ' ' + v.url.slice(0, 90));
console.log('=== falhas ===');
for (const f of falhas.slice(0, 6)) console.log('  ' + (reqs.get(f.id)?.url || '?').slice(0, 80) + ' -> ' + f.erro);
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true });
console.log('estado final: ' + (r.__t ? 'SEM RESPOSTA (congelada)' : String(r.result?.result?.value)));
ws.close(); process.exit(0);