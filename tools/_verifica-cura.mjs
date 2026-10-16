const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogo = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
let tid;
if (jogo) { tid = jogo.id; console.log('aba do jogo ja existe'); }
else { const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' }); tid = nt.result.targetId; console.log('abri aba do jogo'); await new Promise(r => setTimeout(r, 15000)); }
const s = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
if (!s) { console.log('attach FALHOU'); process.exit(0); }
await send('Page.enable', {}, s);
await send('Page.reload', { ignoreCache: true }, s);
await new Promise(r => setTimeout(r, 16000));
let v = 0, m = 0;
for (let i = 1; i <= 9; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, corpo:(document.body?document.body.innerText.slice(0,60):null)})", returnByValue: true }, s);
  if (r.__t) { m++; console.log('t=' + (i*3) + 's -> SEM RESPOSTA'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(r.result?.result?.value).slice(0, 150)); }
}
console.log('=== NO CHROME DO DONO, DEPOIS DA CURA: ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);