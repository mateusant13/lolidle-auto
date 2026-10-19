// _click-test.mjs — attach-only. Estado do guard no MAIN e no EXT, sem contextos fixos.
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.method === 'Runtime.executionContextCreated' && m.params?.context) ctxs.push(m.params.context);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}, sid) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params })); });
const { targetInfos } = await send('Target.getTargets');
const jogos = targetInfos.filter((x) => x.type === 'page' && /(^|\.)lolidle\.com/i.test((x.url || '').replace(/^https?:\/\//, '')));
const { sessionId } = await send('Target.attachToTarget', { targetId: jogos[0].targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await new Promise((r) => setTimeout(r, 500));
const ev = async (expression, contextId) => { const p = { expression, returnByValue: true, awaitPromise: true }; if (contextId) p.contextId = contextId; const r = await send('Runtime.evaluate', p, sessionId); if (r.exceptionDetails) return 'EXC ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r?.result?.value; };
const expr = `(() => {
  let f1=false; document.body.addEventListener('click', () => { f1=true; });
  document.body.click();
  let f2=false; const el = document.querySelector('.abas button'); if (el) { el.addEventListener('click', () => { f2=true; }); el.click(); }
  return JSON.stringify({
    guardHook: window.__lolidleGuardHook === undefined ? 'ausente' : window.__lolidleGuardHook,
    neutralizado: window.__lolidleGuardNeutralizado,
    clickBody: f1, clickAba: f2,
    auto: typeof window.__lolidleAuto,
  });
})()`;
for (const c of ctxs) {
  const t = await ev(`typeof document`, c.id);
  if (t !== 'object') continue;
  const origem = c.origin || '?';
  if (/^https:\/\/lolidle\.com/i.test(origem) || /^chrome-extension:\/\//i.test(origem)) {
    const r = await ev(expr, c.id);
    if (r && (r.includes('"auto":"object"') || r.includes('"neutralizado"') || r.includes('"guardHook"'))) console.log(origem + ' ctx' + c.id + ' => ' + r);
  }
}
process.exit(0);
