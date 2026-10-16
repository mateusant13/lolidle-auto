const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
console.log('aba do jogo encontrada: ' + pg.id);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
const mod = {
  root: {}
};
const start = Date.now();
const s = { frames: 0, lastT: start };
const probe = async (sid, ms) => {
  for (let i = 0; i < ms / 1000; i++) {
    const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }, sid);
    if (!r.__t && r.result) s.frames++;
  }
};
const t1 = await send('Target.attachToTarget', { targetId: pg.id, flatten: true });
if (!t1.result) process.exit(0);
const sid = t1.result.sessionId;
await probe(sid, 30000);
console.log('frames com resposta em 30 s (sem readback bloq): ' + s.frames + ' (esperado ~15 se nao travar)');
ws.close(); process.exit(0);