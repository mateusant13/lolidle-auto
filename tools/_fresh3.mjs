const v = await (await fetch('http://127.0.0.1:9224/json/version')).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 18000); });
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pgs = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
for (const t of pgs) { const r = await send('Target.closeTarget', { targetId: t.id }); console.log('fechei ' + t.id.slice(0, 20)); }
await new Promise(r => setTimeout(r, 3000));
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result?.sessionId;
console.log('aba nova: ' + (s ? 'ok' : 'FALHOU'));
if (!s) process.exit(0);
await send('Runtime.enable', {}, s); await send('Page.enable', {}, s);
await new Promise(r => setTimeout(r, 14000));
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({ rs: document.readyState, local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null })", returnByValue: true }, s);
console.log('JOGO: ' + (r.__t ? 'AINDA congelado' : String(r.result?.result?.value)));
ws.close(); process.exit(0);