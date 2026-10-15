#!/usr/bin/env bun
/** Diagnostico decisivo: a extensao carregou? injecta numa aba NOVA? */
const PORT = Number(process.env.LL_GUEST_PORT || 9233);
const EXT_ID = process.env.LL_EXT_ID || 'pbdlekcgmpippamdkgbaphcppjafobjo';
const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params, sessionId) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __timeout: true }); } }, 10000);
});
const ctxs = new Map();
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id !== undefined && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m); }
  if (m.method === 'Runtime.executionContextCreated') {
    const c = m.params.context;
    if (c.origin) ctxs.set(c.origin + '#' + c.id, { origin: c.origin, name: c.name, default: !!(c.auxData && c.auxData.isDefault) });
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

console.log('=== TODOS OS TARGETS (inclui service_worker) ===');
const tg = await send('Target.getTargets', {});
for (const t of (tg.result?.targetInfos || [])) {
  console.log('  [' + t.type + '] ' + (t.url || '(vazio)').slice(0, 110));
}

console.log('\n=== ABA NOVA para o jogo ===');
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const newId = nt.result?.targetId;
console.log('  novo target=' + newId + (nt.error ? ' ERRO=' + JSON.stringify(nt.error) : ''));
await new Promise((r) => setTimeout(r, 9000));
const at = await send('Target.attachToTarget', { targetId: newId, flatten: true });
const sess = at.result?.sessionId;
console.log('  sessao=' + (sess || JSON.stringify(at).slice(0, 200)));
if (sess) {
  await send('Runtime.enable', {}, sess);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('  mundos na aba nova:');
  for (const c of ctxs.values()) console.log('    ' + c.origin + ' | name=' + c.name + ' | default=' + c.default);
  const has = [...ctxs.values()].some((c) => c.origin === 'chrome-extension://' + EXT_ID);
  console.log('  >>> EXTENSAO INJECTOU NA ABA NOVA: ' + has);
  const r = await send('Runtime.evaluate', { expression: 'JSON.stringify({auto: typeof window.__lolidleAuto, champ: (document.querySelector("#hud-retrato")||{dataset:{}}).dataset.qual||null, loc: (document.querySelector("#local-nome")||{}).textContent||null, nivel: (document.querySelector("#hud-nivel")||{}).textContent||null})', returnByValue: true, contextId: [...ctxs.values()].find((c) => c.default) ? undefined : undefined }, sess);
  console.log('  page: ' + JSON.stringify(r.result?.value ?? r.error ?? r).slice(0, 400));
  await send('Target.closeTarget', { targetId: newId });
}
ws.close();
