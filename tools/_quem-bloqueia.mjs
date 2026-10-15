const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map(); const falhas = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Network.loadingFailed') falhas.push(m.params); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 10000); });
const nt = await send('Target.createTarget', { url: 'about:blank' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result.sessionId;
await send('Network.enable', {}, s);
await send('Page.enable', {}, s);
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s);
await new Promise(r => setTimeout(r, 12000));
console.log('pedidos FALHADOS: ' + falhas.length);
const porErro = {};
for (const f of falhas) { const k = (f.errorText || '?') + (f.blockedReason ? ' [blocked:' + f.blockedReason + ']' : ''); porErro[k] = (porErro[k] || 0) + 1; }
for (const [k, v] of Object.entries(porErro).sort((a,b)=>b[1]-a[1]).slice(0, 8)) console.log('  ' + v + 'x  ' + k);
const urls = falhas.map(f => f.requestId).length;
ws.close(); process.exit(0);