const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
for (let volta = 1; volta <= 4; volta++) {
  const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
  const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
  console.log('volta ' + volta + ': ' + jogos.length + ' aba(s) do jogo');
  if (jogos.length <= 1) break;
  for (const t of jogos.slice(1)) { const r = await send('Target.closeTarget', { targetId: t.targetId }); console.log('  fechei ' + t.targetId.slice(0, 18) + ' -> ' + JSON.stringify(r.result || r.error).slice(0, 50)); }
  await new Promise(r => setTimeout(r, 3000));
}
const lf = await (await fetch('http://127.0.0.1:9224/json/list')).json();
console.log('FINAL: ' + lf.filter(t => t.type === 'page' && /lolidle/.test(t.url)).length + ' aba(s) do jogo, ' + lf.filter(t=>t.type==='page').length + ' abas no total');
ws.close(); process.exit(0);