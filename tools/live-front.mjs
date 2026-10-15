#!/usr/bin/env bun
/** live-front.mjs — traz a aba do jogo para a FRENTE e tira a janela do minimizado.
 *  Porque: uma aba escondida e CONGELADA pelo Chrome; os setInterval da extensao
 *  (e o requestAnimationFrame do proprio jogo) param. O boneco fica parado na base
 *  e parece bug de automacao quando e so a aba estar em segundo plano. */
const CONTA = process.argv.includes('--conta') ? process.argv[process.argv.indexOf('--conta') + 1] : 'yasuo';
const CONTAS = {
  katarina: { list: 'http://127.0.0.1:9224/json/list', cdp: 'ws://127.0.0.1:9224/cdp' },
  yasuo: { list: 'http://127.0.0.1:9233/json/list', port: 9233, cdp: null },
};
const CFG = CONTAS[CONTA];
const list = await (await fetch(CFG.list)).json();
const page = list.find((t) => t.type === 'page' && /lolidle/.test(t.url || ''));
if (!page) { console.error('sem aba do jogo'); process.exit(1); }
const cdpUrl = CFG.cdp || (await (await fetch('http://127.0.0.1:' + CFG.port + '/json/version')).json()).webSocketDebuggerUrl;
const ws = new WebSocket(cdpUrl);
let seq = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const i = ++seq; pend.set(i, res);
  ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, 10000);
});
ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id !== undefined && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m); } });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const sess = (await send('Target.attachToTarget', { targetId: page.id, flatten: true })).result.sessionId;
const r1 = await send('Page.bringToFront', {}, sess);
await new Promise((r) => setTimeout(r, 1200));
const r2 = await send('Runtime.evaluate', { expression: 'JSON.stringify({v:document.visibilityState,h:document.hidden})', returnByValue: true, userGesture: true }, sess);
console.log(JSON.stringify({ bringToFront: !r1.__t, visibilidade: r2.result?.result?.value || null }, null, 2));
ws.close();
