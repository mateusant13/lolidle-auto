const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
console.log('abas totais: ' + list.filter(t=>t.type==='page').length + ' | jogo: ' + list.filter(t => t.type==='page' && /lolidle/.test(t.url)).length);
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
if (!jogos.length) { console.log('sem aba do jogo aberta pelo dono'); process.exit(0); }
const pg = jogos[0];
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({ local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null })", returnByValue: true });
console.log('JOGO: ' + (r.__t ? 'TRAVOU (sem resposta)' : String(r.result?.result?.value)))
ws.close(); process.exit(0);