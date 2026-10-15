#!/usr/bin/env bun
/** Le chrome://extensions-internals (JSON do proprio Chrome) para saber o estado REAL da extensao. */
const PORT = Number(process.env.LL_GUEST_PORT || 9233);
const EXT_ID = process.env.LL_EXT_ID || 'pbdlekcgmpippamdkgbaphcppjafobjo';
const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params, sessionId) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __timeout: true }); } }, 12000);
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id !== undefined && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m); }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

const nt = await send('Target.createTarget', { url: 'chrome://extensions-internals/' });
const tid = nt.result?.targetId;
await new Promise((r) => setTimeout(r, 3500));
const at = await send('Target.attachToTarget', { targetId: tid, flatten: true });
const sess = at.result?.sessionId;
const r = await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true }, sess);
const txt = r.result?.result?.value || JSON.stringify(r).slice(0, 300);
let data = null;
try { data = JSON.parse(txt); } catch {}
if (data) {
  const list = Array.isArray(data) ? data : (data.extensions || []);
  console.log('total extensoes: ' + list.length);
  for (const e of list) {
    const isOurs = e.id === EXT_ID;
    console.log((isOurs ? '>>> ' : '    ') + e.id + ' | ' + (e.name || e.manifest?.name) + ' | location=' + e.location + ' | state=' + e.state + ' | disable_reasons=' + JSON.stringify(e.disable_reasons));
    if (isOurs) {
      console.log('    path=' + e.path);
      console.log('    manifest.name=' + (e.manifest && e.manifest.name));
      console.log('    content_scripts=' + JSON.stringify((e.manifest && e.manifest.content_scripts || []).map((c) => c.js)));
      console.log('    install_time=' + e.install_time + ' last_update=' + e.last_update_time);
      console.log('    runtime_errors=' + JSON.stringify(e.runtime_errors || e.manifest_errors || null).slice(0, 600));
    }
  }
  const ours = list.find((e) => e.id === EXT_ID);
  if (process.argv.includes('--quiet')) {
    console.log('PRESENT=' + (ours ? 1 : 0) + ' LOCATION=' + (ours ? ours.location : '-') + ' TOTAL=' + list.length);
  } else {
    console.log('\n>>> NOSSA EXTENSAO PRESENTE: ' + !!ours);
  }
} else {
  console.log('(nao e JSON) primeiros 1500 chars:\n' + txt.slice(0, 1500));
}
await send('Target.closeTarget', { targetId: tid });
ws.close();
