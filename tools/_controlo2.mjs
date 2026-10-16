const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pgs = list.filter(t => t.type === 'page');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
console.log('=== CONTROLO: abas NAO-jogo ===');
for (const t of pgs.filter(x => !/lolidle/.test(x.url)).slice(0, 4)) {
  const s = (await send('Target.attachToTarget', { targetId: t.id, flatten: true })).result?.sessionId;
  if (!s) { console.log('  ' + t.url.slice(0,40) + ' -> attach FALHOU'); continue; }
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({rs:document.readyState})', returnByValue: true }, s);
  console.log('  ' + t.url.slice(0, 44) + ' -> ' + (r.__t ? 'SEM RESPOSTA' : String(r.result?.result?.value)));
}
console.log('=== a aba do jogo agora ===');
for (const t of pgs.filter(x => /lolidle/.test(x.url))) {
  const s = (await send('Target.attachToTarget', { targetId: t.id, flatten: true })).result?.sessionId;
  if (!s) { console.log('  attach FALHOU'); continue; }
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({rs:document.readyState, t:document.title})', returnByValue: true }, s);
  console.log('  ' + t.url.slice(0, 30) + ' -> ' + (r.__t ? 'SEM RESPOSTA' : String(r.result?.result?.value)));
}
ws.close(); process.exit(0);