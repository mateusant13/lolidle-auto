const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba'); process.exit(0); }
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const s = (await send('Target.attachToTarget', { targetId: pg.targetId, flatten: true })).result?.sessionId;
if (!s) { console.log('sem session'); process.exit(0); }
const r = await send('Runtime.evaluate', { expression: "(() => { const b = document.body ? document.body.innerText : ''; const conv = /convidado|guest/i.test(b); const btns = [...document.querySelectorAll('button, a, .botao, [role=button]')].map(x => (x.textContent||'').trim()).filter(Boolean).slice(0, 30); return JSON.stringify({ temConvidado: conv, texto: b.replace(/\\n+/g,' | ').slice(0, 400), botoes: btns }); })()", returnByValue: true }, s);
console.log((r.__t ? 'sem resposta' : String(r.result?.result?.value)).slice(0, 1000));
ws.close(); process.exit(0);