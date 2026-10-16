const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('DONO: sem aba do jogo'); process.exit(0); }
console.log('DONO: aba encontrada, ws=' + (pg.webSocketDebuggerUrl ? 'ok' : 'AUSENTE'));
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({ local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null, marcadores: document.querySelectorAll('#marcadores .marcador[data-local]').length })", returnByValue: true });
console.log('DONO ESTADO: ' + (r.__t ? 'SEM RESPOSTA (congelou)' : String(r.result?.result?.value)));
ws.close(); process.exit(0);