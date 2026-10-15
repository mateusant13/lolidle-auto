const list = await (await fetch('http://127.0.0.1:9334/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); setTimeout(() => r({ __t: true }), 6000); });
for (let i = 1; i <= 5; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const e = await send('Runtime.evaluate', { expression: "JSON.stringify({p: document.readyState, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, vis: document.visibilityState})", returnByValue: true });
  console.log('t=' + (i * 2) + 's -> ' + (e.__t ? 'SEM RESPOSTA' : String(e.result && e.result.result && e.result.result.value)));
}
ws.close(); process.exit(0);