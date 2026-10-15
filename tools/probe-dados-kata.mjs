// probe-dados-kata.mjs — le a base REAL da Katarina do jogo vivo (import directo do modulo do jogo).
// Uso: bun tools/probe-dados-kata.mjs [--alvo <url-substr>]
const CDP = process.env.RELAY_CDP || 'ws://127.0.0.1:9224/cdp';
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
const match = arg('--alvo') || 'lolidle';
let ws, msgId = 0; const pending = new Map();
const send = (method, params, sid) => { const id = ++msgId; ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params })); return new Promise((res, rej) => { const t = setTimeout(() => { pending.delete(id); rej(new Error('timeout ' + method)); }, 20000); pending.set(id, { resolve: (v) => { clearTimeout(t); res(v); }, reject: (e) => { clearTimeout(t); rej(e); } }); }); };
try {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.code + ' ' + m.error.message)) : p.resolve(m.result); } });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay /cdp timeout')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('relay offline')); }, { once: true }); });
  const pages = (await send('Target.getTargets')).targetInfos.filter(t => t.type === 'page');
  const hit = pages.filter(p => (p.url || '').includes(match)).sort((a, b) => (b.url || '').length - (a.url || '').length)[0];
  if (!hit) { console.log(JSON.stringify({ ok: false, erro: 'sem alvo', paginas: pages.map(p => p.url) })); process.exit(1); }
  const sess = (await send('Target.attachToTarget', { targetId: hit.targetId, flatten: true })).sessionId;
  const ev = async (expression, awaitPromise) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: !!awaitPromise, userGesture: true }, sess); if (r.exceptionDetails) throw new Error('eval: ' + r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '')); return r.result?.value; };
  const expr = `(async () => {
    const out = {};
    try {
      const k = await import('https://lolidle.com/js/dados-katarina.js');
      out.ok = true; out.chaves = Object.keys(k);
      out.dados = k.DADOS_KATARINA;
      try { const m = await import('https://lolidle.com/js/motor.js'); out.motorChaves = Object.keys(m).filter(x => /DADOS|CAMP|KIT|CHAMP/i.test(x)); } catch (e) { out.motorErro = String(e); }
    } catch (e) { out.ok = false; out.erro = String(e); }
    return JSON.stringify(out);
  })()`;
  console.log(await ev(expr, true));
  try { await send('Target.detachFromTarget', { sessionId: sess }); } catch {}
} catch (e) { console.log(JSON.stringify({ ok: false, erro: e.message })); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} }
