const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 10000));
console.log('contextos: ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0,28) + (c.auxData && c.auxData.isDefault === false ? '(isolado)' : '')).join(' | ').slice(0, 250));
for (const c of ctxs) { const r = await send('Runtime.evaluate', { contextId: c.id, returnByValue: true, expression: "typeof window.__lolidleAuto" }); console.log('  ctx ' + c.id + ' -> __lolidleAuto = ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value))); }
ws.close(); process.exit(0);