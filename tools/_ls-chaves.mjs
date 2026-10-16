const list = await (await fetch('http://127.0.0.1:9400/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba'); process.exit(0); }
console.log('aba: ' + pg.url);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 20000); });
await send('Runtime.enable');
const r = await send('Runtime.evaluate', { expression: "(function(){ var out=[]; var tot=0; for (var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); var v=localStorage.getItem(k)||''; tot+=k.length+v.length; out.push({k:k, tam:v.length}); } out.sort(function(a,b){return b.tam-a.tam;}); return JSON.stringify({n:out.length, total:tot, top:out.slice(0,18)}); })()", returnByValue: true });
console.log(r.__t ? 'SEM RESPOSTA' : String(r.result?.result?.value));
ws.close(); process.exit(0);