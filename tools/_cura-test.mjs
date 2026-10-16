const fs = await import('node:fs');
const g = fs.readFileSync('I:/!lolidle.com/tools/_gb3.js', 'utf8');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
for (const t of list.filter(x => x.type === 'page' && /lolidle/.test(x.url))) { await send('Target.closeTarget', { targetId: t.id }); }
await new Promise(r => setTimeout(r, 2000));
const nt = await send('Target.createTarget', { url: 'about:blank' });
const tid = nt.result && nt.result.targetId;
const s = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
if (!s) { console.log('sem sessao'); process.exit(0); }
await send('Page.enable', {}, s);
await send('Page.addScriptToEvaluateOnNewDocument', { source: g }, s);
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s);
console.log('tid=' + tid + ' | batimento injectado; a desligar-me ja');
ws.close();
process.exit(0);