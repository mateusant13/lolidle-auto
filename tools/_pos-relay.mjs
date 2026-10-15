const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('aba do jogo: ' + (pg ? pg.url.slice(0, 45) : 'nenhuma'));
if (!pg) process.exit(0);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 8000); });
const s = (await send('Target.attachToTarget', { targetId: pg.targetId, flatten: true })).result?.sessionId;
if (!s) { console.log('sem session'); process.exit(0); }
for (let i = 1; i <= 4; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }, s); console.log('t=' + (i*2) + 's -> ' + (e.__t ? 'TRAVADO' : String(e.result?.result?.value))); }
ws.close(); process.exit(0);