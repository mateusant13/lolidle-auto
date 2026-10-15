import fs from 'node:fs';
const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
if (!pg) { console.log('sem aba'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
const shot = await send('Page.captureScreenshot', { format: 'png' });
if (shot.__t || !shot.result) { console.log('sem captura'); process.exit(0); }
fs.writeFileSync('I:/!lolidle.com/tools/_tela-limpo.png', Buffer.from(shot.result.data, 'base64'));
console.log('captura ok: ' + Math.round(shot.result.data.length / 1024) + ' KB');
const v = await send('Page.getLayoutMetrics');
if (v.result && v.result.cssLayoutViewport) console.log('viewport: ' + JSON.stringify(v.result.cssLayoutViewport).slice(0, 140));
ws.close(); process.exit(0);