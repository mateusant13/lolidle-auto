// observa-ciclo.mjs — janela de observacao ao vivo (TK-01-52): ouro a subir? recalls?
// Amostragem por relay CDP 9224 (mundo MAIN). Uso: bun tools/observa-ciclo.mjs [minutos] [intervaloS]
const MIN = Number(process.argv[2] || 10), INT = Number(process.argv[3] || 45);
const CDP = 'ws://127.0.0.1:9224/cdp';
let ws, msgId = 0; const pending = new Map();
const send = (m, p, sid) => { const id = ++msgId; ws.send(JSON.stringify(sid ? { id, method: m, params: p, sessionId: sid } : { id, method: m, params: p })); return new Promise((res, rej) => { const t = setTimeout(() => { pending.delete(id); rej(new Error('timeout ' + m)); }, 15000); pending.set(id, { resolve: (v) => { clearTimeout(t); res(v); }, reject: (e) => { clearTimeout(t); rej(e); } }); }); };
const amostrar = [];
(async () => {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay offline')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('relay offline')); }, { once: true }); });
  const pages = (await send('Target.getTargets', {})).targetInfos.filter(t => t.type === 'page');
  const alvo = pages.filter(p => (p.url || '').includes('lolidle')).sort((a, b) => (b.url || '').length - (a.url || '').length)[0];
  if (!alvo) { console.log(JSON.stringify({ ok: false, erro: 'sem aba do jogo' })); process.exit(1); }
  const sess = (await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true })).sessionId;
  await send('Runtime.enable', {}, sess).catch(() => {});
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, userGesture: true }, sess); return r.result?.value; };
  const EXPR = "(() => { const g = (s) => (document.querySelector(s)||{}).textContent||''; return JSON.stringify({ t: new Date().toISOString(), ouro: g('#st-ouro')||g('#hud-ouro')||null, vida: g('#hud-vida-txt')||null, nivel: g('#st-nivel')||g('#hud-nivel')||null, local: g('#st-local')||g('#hud-local')||null, log: (document.querySelector('#log')||{}).textContent ? document.querySelector('#log').textContent.slice(-220) : null }); })()";
  const fim = Date.now() + MIN * 60000;
  let primeiroOuro = null, n = 0;
  while (Date.now() < fim) {
    try {
      const v = await ev(EXPR);
      if (v) { const o = JSON.parse(v); amostrar.push(o); if (primeiroOuro === null) primeiroOuro = o.ouro; n++; console.log(JSON.stringify(o)); }
    } catch (e) { console.log(JSON.stringify({ erro: e.message })); }
    await new Promise(r => setTimeout(r, INT * 1000));
  }
  const ouros = amostrar.map(a => parseFloat(String(a.ouro).replace(/[^\d.]/g, ''))).filter(x => Number.isFinite(x));
  const delta = ouros.length > 1 ? ouros[ouros.length - 1] - ouros[0] : 0;
  const recalls = amostrar.filter(a => a.log && /base|recall|volt/i.test(a.log)).length;
  console.log(JSON.stringify({ ok: true, amostras: n, ouroInicial: ouros[0] ?? null, ouroFinal: ouros[ouros.length - 1] ?? null, deltaOuro: delta, janelaMin: MIN, possiveisRecalls: recalls }));
})().catch(e => { console.log(JSON.stringify({ ok: false, erro: e.message })); process.exitCode = 1; }).finally(() => { try { ws && ws.close(); } catch {} process.exit(process.exitCode || 0); });
