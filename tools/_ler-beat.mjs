const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + jogos.length);
for (const j of jogos) console.log('   ' + j.id.slice(0, 24) + ' ' + (j.title || '').slice(0, 30));
if (!jogos.length) process.exit(0);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
for (const j of jogos) {
  const s = (await send('Target.attachToTarget', { targetId: j.id, flatten: true })).result?.sessionId;
  if (!s) { console.log('  ' + j.id.slice(0,20) + ' attach falhou'); continue; }
  const r = await send('Runtime.evaluate', { expression: "(function(){ try { return localStorage.getItem('__beat'); } catch(e) { return 'erro:' + e; } })()", returnByValue: true }, s);
  console.log('  ' + j.id.slice(0, 20) + ' -> __beat = ' + (r.__t ? 'SEM RESPOSTA (congelada)' : String(r.result?.result?.value)));
}
ws.close(); process.exit(0);