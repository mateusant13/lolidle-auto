const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const vids = list.filter(t => t.type === 'page' && /youtube|animesdigital|twitch/i.test(t.url));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
let n = 0;
for (const v of vids) {
  const s = (await send('Target.attachToTarget', { targetId: v.id, flatten: true })).result?.sessionId;
  if (!s) continue;
  await send('Runtime.evaluate', { expression: "(function(){ var m=[...document.querySelectorAll('video')]; m.forEach(function(x){ try{x.pause(); x.autoplay=false; x.removeAttribute('src'); x.load(); }catch(e){} }); return m.length; })()", returnByValue: true }, s);
  n++;
}
console.log('abas de video tratadas: ' + n + ' de ' + vids.length);
ws.close(); process.exit(0);