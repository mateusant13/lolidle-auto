const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
for (let volta = 1; volta <= 5; volta++) {
  const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
  const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
  if (jogos.length <= 1) { console.log('OK: ficou ' + jogos.length); break; }
  // manter a do #entrar (a TUA); fechar as outras (as minhas)
  const minha = jogos.find(t => !/#entrar/.test(t.url)) || jogos[1];
  const r = await send('Target.closeTarget', { targetId: minha.id });
  console.log('volta ' + volta + ': ' + jogos.length + ' abas | fechei ' + minha.id.slice(0, 20) + ' -> ' + JSON.stringify(r.result || r.error).slice(0, 45));
  await new Promise(r2 => setTimeout(r2, 2500));
}
const lf = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const fj = lf.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('FINAL: ' + fj.length + ' aba(s) do jogo | a tua: ' + (fj[0] ? fj[0].url.slice(0, 40) : 'nenhuma'));
ws.close(); process.exit(0);