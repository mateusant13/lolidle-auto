#!/usr/bin/env bun
// relay-eval.mjs — lane unica para o Chrome REAL do dono via omp relay (9224).
// Cria a aba se preciso, acha pelo padrao de URL, avalia e imprime JSON.
// Uso: bun tools/relay-eval.mjs --expr '<js>' [--match lolidle] [--url <url>] [--keep]
//      bun tools/relay-eval.mjs --targets
const CDP = process.env.RELAY_CDP || 'ws://127.0.0.1:9224/cdp';
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const has = (n) => argv.includes(n);

let ws, msgId = 0;
const pending = new Map();
const out = (o) => console.log(JSON.stringify(o));

function send(method, params, sid) {
  const id = ++msgId;
  ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout ' + method)); }, 20000);
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
  });
}

try {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id !== undefined && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.code + ' ' + m.error.message)) : p.resolve(m.result); }
  });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('relay /cdp timeout')), 6000);
    ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('relay offline')); }, { once: true });
  });

  const listTargets = async () => (await send('Target.getTargets')).targetInfos.filter(t => t.type === 'page');

  if (has('--targets')) { out({ ok: true, targets: (await listTargets()).map(t => ({ id: t.targetId, url: t.url, title: t.title })) }); process.exit(0); }

  const match = arg('--match') || 'lolidle';
  const url = arg('--url');
  let tid = arg('--target');
  if (!tid) {
    let pages = await listTargets();
    let hit = pages.filter(p => (p.url || '').includes(match)).sort((a, b) => (b.url || '').length - (a.url || '').length)[0];
    if (!hit && url) { const r = await send('Target.createTarget', { url }); tid = r.targetId; await new Promise(r2 => setTimeout(r2, 2500)); }
    else if (hit) tid = hit.targetId;
    if (!tid) { out({ ok: false, error: 'no-target', pages: pages.map(p => p.url) }); process.exit(1); }
  }

  const sess = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).sessionId;
  const ev = async (expression, awaitPromise) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: !!awaitPromise, userGesture: true }, sess);
    if (r.exceptionDetails) throw new Error('eval: ' + r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result?.value;
  };
  await send('Runtime.enable', {}, sess).catch(() => {});

  const expr = arg('--expr');
  const waitHref = arg('--wait-href');
  if (waitHref) {
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) { try { const h = await ev('location.href'); if (String(h).includes(waitHref)) break; } catch {} await new Promise(r => setTimeout(r, 400)); }
  }
  if (expr === null) { out({ ok: true, target: tid, href: await ev('location.href') }); }
  else out({ ok: true, target: tid, value: await ev(expr, has('--await')) });
  try { await send('Target.detachFromTarget', { sessionId: sess }); } catch {}
} catch (e) { out({ ok: false, error: e.message }); process.exitCode = 1; }
finally { try { ws?.close(); } catch {} }
