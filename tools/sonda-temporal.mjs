// sonda-temporal.mjs — avalia a pagina do jogo a cada 2 s e diz QUANDO deixa de responder
const CDP = 'ws://127.0.0.1:9224/cdp';
let ws, id = 0; const pend = new Map();
const send = (method, params, sid, ms) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify(sid ? { id: i, method, params: params || {}, sessionId: sid } : { id: i, method, params: params || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, ms || 8000); });
(async () => {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay offline')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); });
  const tg = await send('Target.getTargets');
  const alvo = (tg.result.targetInfos || []).filter(t => t.type === 'page' && /lolidle/.test(t.url))[0];
  if (!alvo) { console.log('sem aba do jogo'); process.exit(1); }
  const sess = (await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true })).result.sessionId;
  await send('Runtime.enable', {}, sess).catch(() => {});
  const EXPR = "JSON.stringify({p: document.readyState, v: (document.querySelector('#hud-vida-txt')||{}).textContent||null, l: (document.querySelector('#local-nome')||{}).textContent||null})";
  for (let i = 1; i <= 10; i++) {
    const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true }, sess, 6000);
    if (r.__t) { console.log('t=' + (i * 2) + 's -> TIMEOUT (main thread ocupada)'); }
    else if (r.result && r.result.exceptionDetails) { console.log('t=' + (i * 2) + 's -> EXCECAO ' + String(r.result.exceptionDetails.text).slice(0, 80)); }
    else { console.log('t=' + (i * 2) + 's -> ' + String(r.result && r.result.result && r.result.result.value).slice(0, 140)); }
    await new Promise(x => setTimeout(x, 2000));
  }
  ws.close(); process.exit(0);
})().catch(e => { console.log('erro: ' + e.message); process.exit(1); });