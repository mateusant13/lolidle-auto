const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas totais: ' + list.filter(t=>t.type==='page').length + ' | jogo: ' + jogos.length);
if (!jogos.length) { console.log('o dono nao tem aba do jogo aberta'); process.exit(0); }
const pg = jogos[0];
const url = pg.webSocketDebuggerUrl || 'ws://127.0.0.1:9224/cdp';
const ws = new WebSocket(url);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
let s = null;
if (!pg.webSocketDebuggerUrl) { s = (await send('Target.attachToTarget', { targetId: pg.id, flatten: true })).result?.sessionId; }
const ev = (e) => send('Runtime.evaluate', { expression: e, returnByValue: true }, s);
for (let i = 1; i <= 5; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await ev("JSON.stringify({ local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null })");
  console.log('t=' + (i*3) + 's -> ' + (r.__t ? 'SEM RESPOSTA (congelado)' : String(r.result?.result?.value).slice(0, 130)));
}
ws.close(); process.exit(0);