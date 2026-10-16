const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const tgame = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo actuais: ' + tgame.length);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
for (const t of tgame) { const r = await send('Target.closeTarget', { targetId: t.id }); console.log('fechei ' + t.id.slice(0, 22) + ' -> ' + JSON.stringify(r.result || r.error).slice(0, 30)); }
const temJogo = await (await fetch('http://127.0.0.1:9224/json/list')).json().then(l => l.filter(t => t.type === 'page' && /lolidle/.test(t.url)).length);
console.log('abas do jogo depois: ' + temJogo);
ws.close(); process.exit(0);