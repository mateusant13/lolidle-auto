const v = await (await fetch('http://127.0.0.1:9340/json/version')).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
const r = await send('Extensions.loadUnpacked', { path: 'I:\\!lolidle.com\\extension' });
console.log('loadUnpacked: ' + JSON.stringify(r.result || r.error).slice(0, 90));
await new Promise(x => setTimeout(x, 9000));
const tg = await send('Target.getTargets');
const alvos = (tg.result ? tg.result.targetInfos : []).map(t => t.type + ':' + (t.url || '').slice(0, 45));
console.log('alvos (' + alvos.length + '): ' + alvos.filter(a => /extension|service_worker|worker/i.test(a)).join(' | ').slice(0, 300));
const list = await (await fetch('http://127.0.0.1:9340/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg || !pg.webSocketDebuggerUrl) { console.log('sem aba do jogo'); process.exit(0); }
const w2 = new WebSocket(pg.webSocketDebuggerUrl);
let id2 = 0; const p2 = new Map(); const ctxs = [];
w2.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && p2.has(m.id)) { p2.get(m.id)(m); p2.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r2 => w2.addEventListener('open', r2, { once: true }));
const s2 = (m, p) => new Promise(r => { const i = ++id2; p2.set(i, r); w2.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await s2('Runtime.enable'); await s2('Page.enable');
await s2('Page.reload', { ignoreCache: true });
await new Promise(x => setTimeout(x, 14000));
console.log('ctxs (' + ctxs.length + '): ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0,26)).join(' | '));
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
console.log('EXTENSAO INJECTOU: ' + (ext ? 'SIM' : 'NAO'));
if (ext) { const rr = await s2('Runtime.evaluate', { contextId: ext.id, returnByValue: true, expression: "typeof window.__lolidleAuto" }); console.log('__lolidleAuto: ' + String(rr.result?.result?.value)); }
w2.close(); process.exit(0);