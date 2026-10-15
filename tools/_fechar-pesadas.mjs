const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pesadas = list.filter(t => t.type === 'page' && /twitch\.tv|youtube\.com|animesdigital/.test(t.url));
console.log('abas pesadas a fechar: ' + pesadas.length + ' -> ' + pesadas.map(t=>t.url.split('/')[2]).join(', '));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 9000); });
for (const p of pesadas) { await send('Target.closeTarget', { targetId: p.targetId }); }
console.log('fechadas. a aguardar 4s...');
await new Promise(r => setTimeout(r, 4000));
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result.sessionId;
for (let i = 1; i <= 7; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true }, s); console.log('t=' + (i*2) + 's -> ' + (e.__t ? 'TRAVADO' : String(e.result?.result?.value))); }
ws.close(); process.exit(0);