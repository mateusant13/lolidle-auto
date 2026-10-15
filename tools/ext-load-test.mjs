#!/usr/bin/env bun
/** Testa as vias de carregar a extensao unpacked no Chrome 155 (que removeu --load-extension). */
const PORT = Number(process.env.LL_GUEST_PORT || 9233);
const EXT = process.env.LL_EXT_DIR || 'I:/!lolidle.com/extension';
const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
console.log('browser:', v.Browser);
console.log('targets:');
for (const t of list) console.log('  [' + t.type + '] ' + (t.url || '(sem url)').slice(0, 100));

const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __timeout: true }); } }, 8000);
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id !== undefined && pend.has(m.id)) { pend.delete(m.id); pend.get && null; }
  if (m.id !== undefined) { const r = pend.get(m.id); if (r) { pend.delete(m.id); r(m); } }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

console.log('\n--- Extensions.loadUnpacked ---');
const r1 = await send('Extensions.loadUnpacked', { path: EXT });
console.log(JSON.stringify(r1).slice(0, 600));

console.log('\n--- Extensions.getExtensionsState ---');
const r2 = await send('Extensions.getExtensionsState', {});
console.log(JSON.stringify(r2).slice(0, 900));

console.log('\n--- Targets depois (procura chrome-extension) ---');
const list2 = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
for (const t of list2) console.log('  [' + t.type + '] ' + (t.url || '(sem url)').slice(0, 110));
ws.close();
