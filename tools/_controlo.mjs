const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pgs = list.filter(t => t.type === 'page');
console.log('abas: ' + pgs.length);
const alvos = pgs.filter(t => !/lolidle/.test(t.url)).slice(0, 3);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
for (const t of alvos) {
  const s = (await send('Target.attachToTarget', { targetId: t.id, flatten: true })).result?.sessionId;
  if (!s) { console.log('  ' + t.url.slice(0, 40) + ' -> attach FALHOU'); continue; }
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({t: document.title ? document.title.slice(0,40) : null, rs: document.readyState})", returnByValue: true }, s);
  console.log('  ' + t.url.slice(0, 42) + ' -> ' + (r.__t ? 'SEM RESPOSTA' : String(r.result?.result?.value).slice(0, 100)));
}
ws.close(); process.exit(0);