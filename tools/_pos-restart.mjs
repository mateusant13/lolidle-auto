const list = await (await fetch('http://127.0.0.1:9225/json/list')).json();
const pgs = list.filter(t => t.type === 'page');
console.log('ABAS RESTAURADAS: ' + pgs.length);
for (const t of pgs) console.log('  ' + (t.url||'').slice(0, 72));
const jogo = pgs.find(t => /lolidle/.test(t.url));
let ws;
if (jogo) { ws = new WebSocket(jogo.webSocketDebuggerUrl); console.log('aba do jogo ja existe'); }
else {
  const nt = await (await fetch('http://127.0.0.1:9225/json/new?https://lolidle.com/jogar', { method: 'PUT' })).json();
  console.log('abri a aba do jogo');
  await new Promise(r => setTimeout(r, 14000));
  const l2 = await (await fetch('http://127.0.0.1:9225/json/list')).json();
  const j2 = l2.find(t => t.type === 'page' && /lolidle/.test(t.url));
  if (!j2) { console.log('nao consegui a aba'); process.exit(0); }
  ws = new WebSocket(j2.webSocketDebuggerUrl);
}
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 14000));
let v = 0, m = 0;
for (let i = 1; i <= 8; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true });
  if (r.__t) { m++; console.log('t=' + (i*3) + 's -> SEM RESPOSTA'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(r.result?.result?.value).slice(0, 110)); }
}
console.log('=== DEPOIS DO REINICIO (GPU fresco): ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);