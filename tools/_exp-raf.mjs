const fs = await import('node:fs');
const g = fs.readFileSync('I:/!lolidle.com/tools/_graf.js', 'utf8');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const nt = await send('Target.createTarget', { url: 'about:blank' });
const tid = nt.result && nt.result.targetId;
const s1 = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
if (!s1) { console.log('sem sessao'); process.exit(0); }
await send('Page.enable', {}, s1);
await send('Page.addScriptToEvaluateOnNewDocument', { source: g }, s1);
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s1);
console.log('sem rAF + batimento injectados; a desligar');
ws.close();
await new Promise(r => setTimeout(r, 45000));
const ws2 = new WebSocket('ws://127.0.0.1:9224/cdp');
let i2 = 0; const p2 = new Map();
ws2.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && p2.has(m.id)) { p2.get(m.id)(m); p2.delete(m.id); } });
await new Promise(r => ws2.addEventListener('open', r, { once: true }));
const send2 = (m, a, sid) => new Promise(r => { const i = ++i2; p2.set(i, r); ws2.send(JSON.stringify(sid ? { id: i, method: m, params: a||{}, sessionId: sid } : { id: i, method: m, params: a||{} })); setTimeout(() => r({ __t: true }), 15000); });
const s2 = (await send2('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
if (!s2) { console.log('attach falhou'); process.exit(0); }
const r = await send2('Runtime.evaluate', { expression: "localStorage.getItem('__beat2')", returnByValue: true }, s2);
console.log('SEM rAF -> contador: ' + (r.__t ? 'SEM RESPOSTA (congelou na mesma)' : String(r.result?.result?.value)));
ws2.close();
process.exit(0);