const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
// fechar as MINHAS (manter a do #entrar, que e a tua)
for (const t of jogos.filter(x => !/#entrar/.test(x.url))) { const r = await send('Target.closeTarget', { targetId: t.id }); console.log('fechei minha ' + t.id.slice(0, 20) + ' -> ' + JSON.stringify(r.result || r.error).slice(0, 30)); }
await new Promise(r => setTimeout(r, 2500));
const l2 = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const j2 = l2.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + j2.length);
if (!j2.length) { console.log('sem aba do jogo'); process.exit(0); }
const pg = j2[0];
const s = (await send('Target.attachToTarget', { targetId: pg.id, flatten: true })).result?.sessionId;
console.log('attach na tua aba: ' + (s ? 'ok' : 'FALHOU (o relay so anexa abas que ele criou)'));
if (!s) process.exit(0);
const r = await send('Runtime.evaluate', { expression: "JSON.stringify({ local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null, mapa: !!document.querySelector('#janela-mapa'), marcadores: document.querySelectorAll('#marcadores .marcador[data-local]').length })", returnByValue: true }, s);
console.log('ESTADO DA TUA ABA: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value)));
ws.close(); process.exit(0);