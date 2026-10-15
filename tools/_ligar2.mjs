const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg || !pg.webSocketDebuggerUrl) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Runtime.enable'); await new Promise(r => setTimeout(r, 2500));
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
if (!ext) { console.log('sem contexto da extensao'); process.exit(0); }
const ev = (expr) => send('Runtime.evaluate', { contextId: ext.id, returnByValue: true, awaitPromise: true, expression: expr });
const r1 = await ev("(() => { const A = window.__lolidleAuto; A.setConfig({ enabled: true, regionDefault: 'rota-sup' }); return JSON.stringify(A.getConfig()); })()");
console.log('CONFIG: ' + (r1.__t ? 'sem resposta' : String(r1.result?.result?.value).slice(0, 260)));
const r2 = await ev("(() => { try { const p = window.__lolidleAuto; const viajou = p.viajarPara ? p.viajarPara('rota-sup') : null; return JSON.stringify({ viajou }); } catch (e) { return 'erro: ' + e; } })()");
console.log('VIAJAR: ' + (r2.__t ? 'sem resposta' : String(r2.result?.result?.value).slice(0, 200)));
for (let i = 1; i <= 6; i++) { await new Promise(r => setTimeout(r, 5000)); const r3 = await ev("JSON.stringify({ enabled: window.__lolidleAuto.getConfig().enabled, local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null, log: (window.__lolidleAuto.getFarm && window.__lolidleAuto.getFarm().current ? window.__lolidleAuto.getFarm().current.region : null) })"); console.log('t=' + (i*5) + 's -> ' + (r3.__t ? 'sem resposta' : String(r3.result?.result?.value).slice(0, 200))); }
ws.close(); process.exit(0);