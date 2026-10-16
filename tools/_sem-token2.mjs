const list = await (await fetch('http://127.0.0.1:9400/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo na copia'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable');
const rm = await send('Runtime.evaluate', { expression: "(function(){ var t=localStorage.getItem('lol-idle-token'); localStorage.removeItem('lol-idle-token'); return JSON.stringify({tinha: !!t, agora: localStorage.getItem('lol-idle-token'), n: localStorage.length}); })()", returnByValue: true });
console.log('token: ' + (rm.__t ? 'sem resposta' : String(rm.result?.result?.value)));
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 16000));
let v = 0, m = 0;
for (let i = 1; i <= 7; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, txt:(document.body?document.body.innerText.slice(0,45):null)})", returnByValue: true });
  if (r.__t) { m++; console.log('t=' + (i*3) + 's -> SEM RESPOSTA'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(r.result?.result?.value).slice(0, 150)); }
}
console.log('=== SEM o token (deslogado): ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);