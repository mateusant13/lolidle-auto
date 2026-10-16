import fs from 'node:fs';
const hb = fs.readFileSync('I:/!lolidle.com/tools/_hb.js', 'utf8');
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
if (!jogos.length) { console.log('sem aba'); process.exit(0); }
const pg = jogos[0];
const ws = new WebSocket(pg.webSocketDebuggerUrl || 'ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
let s = null;
if (!pg.webSocketDebuggerUrl) { s = (await send('Target.attachToTarget', { targetId: pg.id, flatten: true })).result?.sessionId; }
if (!s) { console.log('sem sessao'); process.exit(0); }
const r = await send('Runtime.evaluate', { expression: hb, returnByValue: true }, s);
console.log('eval do batimento: ' + (r.__t ? 'SEM RESPOSTA (bloqueada)' : 'OK - a pagina executa JS'));
ws.close(); process.exit(0);