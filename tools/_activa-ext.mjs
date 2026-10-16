const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
console.log('abas totais: ' + list.filter(t=>t.type==='page').length);
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
console.log('nova aba: ' + (nt.result ? 'criada' : 'FALHOU ' + JSON.stringify(nt.error).slice(0, 40)));
if (!nt.result || !nt.result.targetId) process.exit(0);
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result?.sessionId;
console.log('attach: ' + (s ? 'ok' : 'FALHOU'));
if (!s) { ws.close(); process.exit(0); }
await send('Runtime.enable', {}, s); await send('Accessibility.enable', {}, s);
await send('Page.enable', {}, s); await send('Page.reload', { ignoreCache: true }, s);
await new Promise(r => setTimeout(r, 14000));
const ex = await send('Extensions.loadUnpacked', { path: 'I:\\!lolidle.com\\extension' });
console.log('loadUnpacked: ' + JSON.stringify(ex.result || ex.error).slice(0, 90));
await new Promise(r => setTimeout(r, 8000));
const list2 = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const ext = list2.filter(t => /chrome-extension/.test(t.url));
console.log('contextos da extensao presentes: ' + ext.length);
// open chrome://extensions em vez de tentar injectar
const nt2 = await send('Target.createTarget', { url: 'chrome://extensions/' });
const s2 = (await send('Target.attachToTarget', { targetId: nt2.result.targetId, flatten: true })).result?.sessionId;
console.log('aba chrome://extensions: ' + (s2 ? 'ok - sem attach' : 'FALHOU'));
ws.close(); process.exit(0);