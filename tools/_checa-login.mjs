const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
console.log('relay ve ' + list.filter(t=>t.type==='page').length + ' abas');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/' });
const tid = nt.result.targetId;
await new Promise(r => setTimeout(r, 12000));
const s = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
if (!s) { console.log('attach falhou'); process.exit(0); }
const r = await send('Runtime.evaluate', { expression: "(function(){ var o={}; for (var i=0;i<localStorage.length;i++){var k=localStorage.key(i); o[k]=(localStorage.getItem(k)||'').length;} return JSON.stringify({n:localStorage.length, chaves:o, token:(localStorage.getItem('lol-idle-token')||'').slice(0,10)}); })()", returnByValue: true }, s);
console.log('localStorage: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value)));
await send('Target.closeTarget', { targetId: tid });
console.log('(aba de teste fechada)');
ws.close(); process.exit(0);