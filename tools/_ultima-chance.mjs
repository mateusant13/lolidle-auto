const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
console.log('abas totais: ' + list.filter(t=>t.type==='page').length);
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + jogos.length);
if (jogos.length === 0) {
  console.log('O DONO NAO TEM ABA DO JOGO ABERTA (fechou-a ou o Chrome fechou)');
  for (const t of list.filter(t=>t.type==='page')) console.log('  ' + t.url.slice(0, 70));
  console.log('Por isso eu abro uma CDP probe para tentar acordar a thread:');
  const nt = await (await fetch('http://127.0.0.1:9224/cdp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 1, method: 'Target.createTarget', params: { url: 'https://lolidle.com/jogar' } }) })).json();
  console.log('resposta do cdp: ' + JSON.stringify(nt).slice(0, 80));
  process.exit(0);
}
const pg = jogos[0];
console.log('ws ausente: ' + (pg.webSocketDebuggerUrl ? 'nao' : 'SIM (tab travada/compositor blocked)'));
const ws = pg.webSocketDebuggerUrl ? new WebSocket(pg.webSocketDebuggerUrl) : new WebSocket('ws://127.0.0.1:9224/cdp?from=' + encodeURIComponent(pg.id));
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
let s = null;
if (!pg.webSocketDebuggerUrl) { s = (await send('Target.attachToTarget', { targetId: pg.id, flatten: true })).result?.sessionId; console.log('attach: ' + (s ? 'ok' : 'FALHOU')); }
if (!s) { console.log('aba travada ate ao nivel do CDP: nao consigo diagnosticar mais (normal quando o thread esta morto)'); process.exit(0); }
const ev = (exp) => send('Runtime.evaluate', { expression: exp, returnByValue: true }, s);
const r = await ev("JSON.stringify({ local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null })");
console.log('JOGO: ' + (r.__t ? 'SEM RESPOSTA (congelado)' : String(r.result?.result?.value)));
ws.close(); process.exit(0);