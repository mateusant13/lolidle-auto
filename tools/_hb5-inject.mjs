const hb = await (await import('node:fs')).readFileSync('I:/!lolidle.com/tools/_hb5.js', 'utf8');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const nt = await send('Target.createTarget', { url: 'about:blank' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result?.sessionId;
if (!s) { console.log('sem sessao'); process.exit(0); }
await send('Page.enable', {}, s);
const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: hb }, s);
console.log('batimento registado: ' + (r.result ? 'ok' : 'falhou'));
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s);
console.log('naveguei; a desligar a sessao JÁ (sem ler nada)');
ws.close();
process.exit(0);