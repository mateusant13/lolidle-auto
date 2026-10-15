// stack-travado.mjs — apanha a stack JS do renderer travado (Debugger.pause).
// Uso: bun tools/stack-travado.mjs [--target <id>]
const CDP = 'ws://127.0.0.1:9224/cdp';
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
let ws, id = 0; const pend = new Map(); const eventos = [];
const send = (method, params, sid) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify(sid ? { id: i, method, params: params || {}, sessionId: sid } : { id: i, method, params: params || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, 15000); });
(async () => {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); }
    else if (m.method) eventos.push(m);
  });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay offline')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); });
  const pages = (await send('Target.getTargets')).result.targetInfos.filter(t => t.type === 'page');
  const alvo = arg('--target') || pages.filter(p => (p.url || '').includes('lolidle')).sort((a, b) => (b.url || '').length - (a.url || '').length)[0]?.targetId;
  if (!alvo) { console.log(JSON.stringify({ erro: 'sem alvo' })); process.exit(1); }
  const sess = (await send('Target.attachToTarget', { targetId: alvo, flatten: true })).result.sessionId;
  await send('Debugger.enable', {}, sess);
  await send('Debugger.pause', {}, sess);
  await new Promise(r => setTimeout(r, 2500));
  const pausado = eventos.filter(e => e.method === 'Debugger.paused').pop();
  const out = { alvo, pausou: !!pausado, razao: pausado?.params?.reason || null, frames: [] };
  if (pausado) {
    for (const f of (pausado.params.callFrames || []).slice(0, 18)) {
      out.frames.push({ fn: f.functionName || '(anon)', url: (f.url || '').split('/').slice(-1)[0], linha: (f.location?.lineNumber ?? -1) + 1 });
    }
  }
  console.log(JSON.stringify(out, null, 1));
  await send('Debugger.resume', {}, sess);
  try { await send('Target.detachFromTarget', { sessionId: sess }); } catch {}
  ws.close(); process.exit(0);
})().catch(e => { console.log(JSON.stringify({ erro: e.message })); process.exit(1); });