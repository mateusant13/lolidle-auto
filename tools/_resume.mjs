const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
console.log('aba: ' + pg.url.slice(0, 50));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 9000); });
const s = (await send('Target.attachToTarget', { targetId: pg.targetId, flatten: true })).result?.sessionId;
console.log('session: ' + (s ? 'ok' : 'FALHOU'));
if (!s) process.exit(0);
console.log('Debugger.enable: ' + JSON.stringify((await send('Debugger.enable', {}, s)).result || {}).slice(0, 60));
console.log('Debugger.resume: ' + JSON.stringify((await send('Debugger.resume', {}, s)).result || {}).slice(0, 60));
console.log('Debugger.disable: ' + JSON.stringify((await send('Debugger.disable', {}, s)).result || {}).slice(0, 60));
await new Promise(r => setTimeout(r, 1500));
const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true }, s);
console.log('DEPOIS DO RESUME -> ' + (e.__t ? 'AINDA TRAVADO' : String(e.result?.result?.value)));
ws.close(); process.exit(0);