import fs from 'node:fs';
const g = fs.readFileSync('I:/!lolidle.com/tools/_guardab.js', 'utf8');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 18000); });
const l0 = await (await fetch('http://127.0.0.1:9224/json/list')).json();
for (const t of l0.filter(x => x.type === 'page' && /lolidle/.test(x.url))) { await send('Target.closeTarget', { targetId: t.id }); }
const nt = await send('Target.createTarget', { url: 'about:blank' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result?.sessionId;
if (!s) { console.log('sem sessao'); process.exit(0); }
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
await send('Page.addScriptToEvaluateOnNewDocument', { source: g }, s);
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s);
let v=0,m=0;
for (let i=1;i<=14;i++){ await new Promise(r=>setTimeout(r,2500));
  const e = await send('Runtime.evaluate',{expression:"JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null,vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})",returnByValue:true},s);
  if (e.__t) { m++; console.log('t='+(i*2.5)+'s -> MUDA'); } else { v++; console.log('t='+(i*2.5)+'s -> '+String(e.result?.result?.value).slice(0,120)); }
}
console.log('=== guarda total: '+v+' vivas / '+m+' mudas (35s) ===');
ws.close(); process.exit(0);