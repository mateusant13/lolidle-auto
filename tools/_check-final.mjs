const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
const total = list.filter(t => t.type === 'page').length;
console.log('abas totais=' + total + ' | abas do jogo=' + jogos.length);
if (jogos.length === 0) { console.log('NAO TEM ABA DO JOGO ABERTA: 'nao consigo verificar o estado (abre pelo dono)'); process.exit(0); }
const pg = jogos[0];
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
const ext = await send('Extensions.loadUnpacked', { path: 'I:\\!lolidle.com\\extension' });
console.log('Extensions.loadUnpacked: ' + (ext.__t ? 'SEM SUPORTE' : JSON.stringify(ext.result || ext.error).slice(0, 80)));
for (let i = 1; i <= 6; i++) {
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({ rs: document.readyState, local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null })", returnByValue: true });
  if (r.__t) { console.log('t=' + (i*4) + 's -> AINDA CONGELADO'); } else console.log('t=' + (i*4) + 's -> ' + JSON.stringify(r.result?.result?.value).slice(0, 140));
}
ws.close(); process.exit(0);