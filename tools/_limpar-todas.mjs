const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo agora: ' + jogos.length);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
let fechadas = 0;
for (const t of jogos.slice(1)) { const r = await send('Target.closeTarget', { targetId: t.targetId }); fechadas++; }
console.log('fechei ' + fechadas + ' -> ficou 1');
await new Promise(r => setTimeout(r, 2500));
const l2 = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const j2 = l2.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('confirmado: ' + j2.length + ' aba(s) do jogo | total de abas: ' + l2.filter(t=>t.type==='page').length);
ws.close(); process.exit(0);