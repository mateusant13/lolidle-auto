const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const c = await send('Storage.clearDataForOrigin', { origin: 'https://lolidle.com', storageTypes: 'indexeddb,cache_storage,service_workers,shader_cache' });
console.log('limpeza (sem tocar em cookies/localStorage): ' + JSON.stringify(c.result || c).slice(0, 80));
await new Promise(r => setTimeout(r, 2500));
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result.sessionId;
for (let i = 1; i <= 8; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true }, s); console.log('t=' + (i*2) + 's -> ' + (e.__t ? 'TRAVADO' : String(e.result?.result?.value))); }
ws.close(); process.exit(0);