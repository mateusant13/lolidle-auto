const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page');
console.log('aba: ' + (pg ? pg.url.slice(0, 40) : 'nenhuma'));
if (!pg) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 8000); });
await send('Page.enable');
console.log('Debugger.enable -> ' + JSON.stringify((await send('Debugger.enable')).result || {}).slice(0, 40));
await send('Page.navigate', { url: 'https://lolidle.com/jogar' });
let trav = 0;
for (let i = 1; i <= 6; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }); if (e.__t) { trav++; console.log('t=' + (i*2) + 's -> TRAVADO'); } else console.log('t=' + (i*2) + 's -> ' + String(e.result?.result?.value)); }
console.log('=> com Debugger ligado: ' + (trav === 0 ? 'NAO TRAVA' : 'TRAVA (' + trav + 'x)'));
ws.close(); process.exit(0);