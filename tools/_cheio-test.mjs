const list = await (await fetch('http://127.0.0.1:9351/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas: ' + list.filter(t=>t.type==='page').length + ' | aba do jogo: ' + (pg ? 'SIM' : 'NAO'));
if (!pg || !pg.webSocketDebuggerUrl) { console.log('sem aba/ws'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 12000));
let v = 0, m = 0;
for (let i = 1; i <= 10; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const e = await send('Runtime.evaluate', { expression: "JSON.stringify({ local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null })", returnByValue: true });
  if (e.__t) { m++; console.log('t=' + (i*3) + 's -> *** TRAVADO ***'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(e.result?.result?.value).slice(0, 130)); }
}
console.log('=== PERFIL COMPLETO COPIADO: ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);