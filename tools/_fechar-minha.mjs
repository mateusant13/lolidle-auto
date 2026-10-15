const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo a fechar: ' + jogos.length);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
for (const t of jogos) { const r = await send('Target.closeTarget', { targetId: t.id }); console.log('  fechei ' + t.id.slice(0, 20) + ' -> ' + JSON.stringify(r.result || r.error).slice(0, 30)); }
await new Promise(r => setTimeout(r, 2500));
const l2 = await (await fetch('http://127.0.0.1:9224/json/list')).json();
console.log('FINAL: ' + l2.filter(t => t.type === 'page' && /lolidle/.test(t.url)).length + ' abas do jogo | ' + l2.filter(t=>t.type==='page').length + ' abas no total (so as tuas)');
ws.close(); process.exit(0);