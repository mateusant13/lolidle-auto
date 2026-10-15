let list = [];
try { list = await (await fetch('http://127.0.0.1:9224/json/list')).json(); } catch { console.log('relay ja esta off'); process.exit(0); }
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo que eu abri: ' + jogos.length);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 8000); });
for (const t of jogos) { await send('Target.closeTarget', { targetId: t.targetId }); }
console.log('fechei TODAS as do jogo (eu abro outra ja sem relay)');
ws.close(); process.exit(0);