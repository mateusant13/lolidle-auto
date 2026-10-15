const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + pg.length);
if (!pg.length) { console.log('URLS:', list.filter(t=>t.type==='page').map(t=>t.url.slice(0,60)).join(' | ').slice(0,400)); process.exit(0); }
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (method, params, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method, params: params||{}, sessionId: sid } : { id: i, method, params: params||{} })); setTimeout(() => r({ __t: true }), 6000); });
for (const p of pg.slice(0, 2)) {
  const s = (await send('Target.attachToTarget', { targetId: p.targetId, flatten: true })).result?.sessionId;
  console.log('\naba: ' + p.url.slice(0, 60) + ' | session ' + (s ? 'ok' : 'FALHOU'));
  if (!s) continue;
  for (let i = 1; i <= 3; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, vis:document.visibilityState, t:Date.now()%100000})", returnByValue: true }, s);
    console.log('  t=' + (i*1.5) + 's -> ' + (e.__t ? 'SEM RESPOSTA (travado)' : String(e.result?.result?.value)));
  }
}
ws.close(); process.exit(0);