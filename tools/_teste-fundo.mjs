const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 9000); });
// sonda 1: aba ACTIVA
console.log('--- ANTES (aba activa) ---');
for (let i = 1; i <= 3; i++) { await new Promise(r => setTimeout(r, 2000)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({vis:document.visibilityState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }); console.log('  t=' + (i*2) + 's -> ' + (e.__t ? 'SEM RESPOSTA' : String(e.result?.result?.value))); }
// criar OUTRA aba e activa-la -> o jogo passa a SEGUNDO PLANO
const nt = await send('Target.createTarget', { url: 'about:blank', background: false });
console.log('--- nova aba criada (o jogo passa a segundo plano) ---');
for (let i = 1; i <= 5; i++) { await new Promise(r => setTimeout(r, 2500)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({vis:document.visibilityState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }); console.log('  t=' + (i*2.5) + 's -> ' + (e.__t ? 'SEM RESPOSTA (TRAVOU)' : String(e.result?.result?.value))); }
ws.close(); process.exit(0);