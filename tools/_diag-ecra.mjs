const v = await (await fetch('http://127.0.0.1:9224/json/version')).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
const up = await send('Extensions.loadUnpacked', { path: 'I:\\!lolidle.com\\extension' });
console.log('loadUnpacked: ' + JSON.stringify(up.result || up.error).slice(0, 90));
await new Promise(r => setTimeout(r, 4000));
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg || !pg.webSocketDebuggerUrl) { console.log('sem aba do jogo'); process.exit(0); }
const w2 = new WebSocket(pg.webSocketDebuggerUrl);
let id2 = 0; const p2 = new Map(); const ctxs = [];
w2.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && p2.has(m.id)) { p2.get(m.id)(m); p2.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => w2.addEventListener('open', r, { once: true }));
const s2 = (m, p) => new Promise(r => { const i = ++id2; p2.set(i, r); w2.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await s2('Runtime.enable'); await s2('Page.enable');
await s2('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 13000));
console.log('contextos: ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0, 24)).join(' | '));
const main = ctxs.find(c => c.origin === 'https://lolidle.com');
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
if (main) { const r = await s2('Runtime.evaluate', { contextId: main.id, returnByValue: true, expression: "(function(){ const b = document.body ? document.body.innerText : ''; return JSON.stringify({ texto: b.replace(/\\n+/g,' | ').slice(0,240), local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null }); })()" }); console.log('ECRA: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 400))); }
console.log('extensao: ' + (ext ? 'INJECTOU' : 'nao injectou'));
w2.close(); process.exit(0);