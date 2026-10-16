const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
if (!jogos.length) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const s = (await send('Target.attachToTarget', { targetId: jogos[0].id, flatten: true })).result?.sessionId;
console.log('attach: ' + (s ? 'ok' : 'FALHOU'));
if (!s) process.exit(0);
let v = 0, m = 0;
for (let i = 1; i <= 6; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }, s);
  if (r.__t) { m++; console.log('t=' + (i*3) + 's -> SEM RESPOSTA'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(r.result?.result?.value).slice(0, 130)); }
}
console.log('=== DEPOIS DE REINICIAR O GPU + TIRAR OS VIDEOS: ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);