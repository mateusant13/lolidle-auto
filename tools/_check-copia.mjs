const v = await (await fetch('http://127.0.0.1:9340/json/version')).json();
const list = await (await fetch('http://127.0.0.1:9340/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('aba do jogo: ' + (pg ? pg.url.slice(0,40) : 'NAO'))
if (!pg || !pg.webSocketDebuggerUrl) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({ login: /Bem-vindo de volta|Senha/i.test(document.body ? document.body.innerText : ''), local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null })", returnByValue: true });
console.log('ESTADO (sem login forçado): ' + (r.__t ? 'congelado' : String(r.result?.result?.value).slice(0, 200)));
ws.close(); process.exit(0);