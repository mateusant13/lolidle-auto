const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (method, params, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method, params: params||{}, sessionId: sid } : { id: i, method, params: params||{} })); setTimeout(() => r({ __t: true }), 12000); });
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
console.log('createTarget: ' + JSON.stringify(nt.result || nt).slice(0, 200));
if (!nt.result || !nt.result.targetId) process.exit(0);
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result?.sessionId;
console.log('session: ' + (s ? 'ok' : 'FALHOU'));
if (!s) process.exit(0);
for (let i = 1; i <= 8; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null, ext:!!window.__lolidleAuto})", returnByValue: true }, s);
  console.log('t=' + (i*2) + 's -> ' + (e.__t ? 'SEM RESPOSTA (TRAVADO)' : String(e.result?.result?.value)));
}
ws.close(); process.exit(0);