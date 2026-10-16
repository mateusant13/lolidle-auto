const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogo = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!jogo) { console.log('sem aba do jogo'); process.exit(0); }
console.log('aba do jogo: ' + jogo.id + ' | discarded=' + jogo.discarded + ' | active=' + jogo.active);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 20000); });
const a = await send('Target.activateTarget', { targetId: jogo.id });
console.log('activateTarget: ' + (a.__t ? 'sem resposta' : JSON.stringify(a.result || a.error).slice(0, 80)));
await new Promise(r => setTimeout(r, 15000));
const list2 = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const j2 = list2.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('depois de activar: discarded=' + (j2 ? j2.discarded : '?') + ' active=' + (j2 ? j2.active : '?'));
const s = (await send('Target.attachToTarget', { targetId: jogo.id, flatten: true })).result?.sessionId;
if (!s) { console.log('attach falhou'); process.exit(0); }
let v = 0, m = 0;
for (let i = 1; i <= 5; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }, s);
  if (r.__t) { m++; console.log('t=' + (i*3) + 's -> SEM RESPOSTA'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(r.result?.result?.value).slice(0, 140)); }
}
console.log('=== DEPOIS DE ACTIVAR: ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);