const nt = await (await fetch('http://127.0.0.1:9420/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(nt.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'https://lolidle.com/' });
await new Promise(r => setTimeout(r, 9000));
const antes = await send('Runtime.evaluate', { expression: "JSON.stringify({n:localStorage.length, token:(localStorage.getItem('lol-idle-token')||'').slice(0,8)})", returnByValue: true });
console.log('ANTES: ' + (antes.__t ? 'sem resposta' : String(antes.result?.result?.value)));
const rm = await send('Runtime.evaluate', { expression: "(function(){ var t=localStorage.getItem('lol-idle-token'); localStorage.removeItem('lol-idle-token'); return JSON.stringify({tinha:!!t, n:localStorage.length}); })()", returnByValue: true });
console.log('removido: ' + (rm.__t ? 'sem resposta' : String(rm.result?.result?.value)));
await send('Page.navigate', { url: 'https://lolidle.com/jogar' });
await new Promise(r => setTimeout(r, 15000));
let v = 0, m = 0;
for (let i = 1; i <= 8; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, txt:(document.body?document.body.innerText.slice(0,40):null)})", returnByValue: true });
  if (r.__t) { m++; console.log('t=' + (i*3) + 's -> SEM RESPOSTA'); } else { v++; console.log('t=' + (i*3) + 's -> ' + String(r.result?.result?.value).slice(0, 130)); }
}
console.log('=== SEM token, SEM VPN: ' + v + ' vivas / ' + m + ' mudas ===');
ws.close(); process.exit(0);