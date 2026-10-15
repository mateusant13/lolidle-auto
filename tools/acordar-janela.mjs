// acordar-janela.mjs — restaura a janela do Chrome (Browser.setWindowBounds) e testa a pagina
const CDP = 'ws://127.0.0.1:9224/cdp';
let ws, id = 0; const pend = new Map();
const send = (method, params, sid, ms) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify(sid ? { id: i, method, params: params || {}, sessionId: sid } : { id: i, method, params: params || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, ms || 12000); });
(async () => {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('offline')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); });
  const tg = await send('Target.getTargets');
  const alvo = (tg.result.targetInfos || []).filter(t => t.type === 'page' && /lolidle/.test(t.url))[0];
  if (!alvo) { console.log('sem aba do jogo'); process.exit(1); }
  const w = await send('Browser.getWindowForTarget', { targetId: alvo.targetId });
  const winId = w.result && w.result.windowId;
  const antes = w.result && w.result.bounds;
  console.log('janela ' + winId + ' estado=' + (antes && antes.windowState) + ' bounds=' + JSON.stringify(antes));
  const set = await send('Browser.setWindowBounds', { windowId: winId, bounds: { windowState: 'normal' } });
  console.log('setWindowBounds -> ' + (set.__t ? 'timeout' : JSON.stringify(set.result || set.error || 'ok')));
  const w2 = await send('Browser.getWindowForTarget', { targetId: alvo.targetId });
  console.log('depois: ' + JSON.stringify(w2.result && w2.result.bounds));
  const sess = (await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true })).result.sessionId;
  await send('Page.bringToFront', {}, sess, 8000);
  await new Promise(r => setTimeout(r, 2500));
  const ev = await send('Runtime.evaluate', { expression: "JSON.stringify({vis:document.visibilityState, hid:document.hidden, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true }, sess, 12000);
  console.log('EVAL: ' + (ev.__t ? 'TIMEOUT' : JSON.stringify(ev.result && ev.result.result && ev.result.result.value)));
  ws.close(); process.exit(0);
})().catch(e => { console.log('erro ' + e.message); process.exit(1); });