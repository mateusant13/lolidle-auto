const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + jogos.length + (jogos[0] ? ' | campos: ' + Object.keys(jogos[0]).join(',') : ''));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
const tg = await send('Target.getTargets');
if (tg.result) { for (const t of tg.result.targetInfos.filter(x => x.type === 'page')) console.log('  ' + (t.attached ? 'ATTACHED ' : 'livre    ') + (t.url || '').slice(0, 45)); }
if (jogos.length) {
  const s = (await send('Target.attachToTarget', { targetId: jogos[0].id, flatten: true })).result?.sessionId;
  const r = await send('Runtime.evaluate', { expression: "JSON.stringify({local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true }, s);
  console.log('PROBE na aba do jogo: ' + (r.__t ? 'SEM RESPOSTA (ainda bloqueada)' : String(r.result?.result?.value)));
}
ws.close(); process.exit(0);