const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
let pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 9000); });
if (!pg) { const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' }); pg = { targetId: nt.result.targetId, url: 'nova' }; console.log('criei 1 aba (nao havia nenhuma do jogo)'); }
const s = (await send('Target.attachToTarget', { targetId: pg.targetId, flatten: true })).result?.sessionId;
if (!s) { console.log('sem session'); process.exit(0); }
let trav = 0;
for (let i = 1; i <= 8; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true }, s); if (e.__t) { trav++; console.log('t=' + (i*2) + 's -> TRAVADO'); } else console.log('t=' + (i*2) + 's -> ' + String(e.result?.result?.value)); }
console.log('=> ' + (trav === 0 ? '*** NAO TRAVA — ARRUMADO ***' : 'ainda trava (' + trav + 'x)'));
ws.close(); process.exit(0);