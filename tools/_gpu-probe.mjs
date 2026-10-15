const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
console.log('abas abertas: ' + list.filter(t=>t.type==='page').length);
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 9000); });
const info = await send('SystemInfo.getInfo');
if (!info.__t && info.result) {
  const g = info.result.gpu || {};
  const f = info.result.featureStatus || {};
  console.log('GPU: ' + JSON.stringify((g.auxAttributes||{}).glRenderer || (g.devices||[]).map(d=>d.deviceString).slice(0,1)));
  console.log('features: gpu_compositing=' + f.gpu_compositing + ' | canvas=' + f.canvas + ' | webgl=' + f.webgl + ' | rasterization=' + f.rasterization);
} else console.log('SystemInfo indisponivel');
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result.sessionId;
for (let i = 1; i <= 6; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }, s); console.log('t=' + (i*2) + 's -> ' + (e.__t ? 'TRAVADO' : String(e.result?.result?.value))); }
ws.close(); process.exit(0);