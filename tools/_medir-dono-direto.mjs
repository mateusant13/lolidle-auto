const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
console.log('abas: ' + list.filter(t=>t.type==='page').length + ' | aba do jogo: ' + (pg ? pg.url.slice(0, 45) : 'NAO'));
if (!pg) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 9000); });
for (let i = 1; i <= 8; i++) { await new Promise(r => setTimeout(r, 2500)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null, ouro:(document.querySelector('#hud-ouro')||{}).textContent||null})", returnByValue: true }); console.log('t=' + (i*2.5) + 's -> ' + (e.__t ? '*** TRAVADO ***' : String(e.result?.result?.value))); }
ws.close(); process.exit(0);