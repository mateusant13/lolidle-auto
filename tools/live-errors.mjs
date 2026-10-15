#!/usr/bin/env bun
/** live-errors.mjs — captura excepcoes/consola do mundo da extensao durante N segundos. */
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const CONTA = arg('--conta', 'yasuo');
const SECS = Number(arg('--secs', '20'));
const CONTAS = {
  katarina: { list: 'http://127.0.0.1:9224/json/list', cdp: 'ws://127.0.0.1:9224/cdp' },
  yasuo: { list: 'http://127.0.0.1:9233/json/list', port: 9233, cdp: null },
};
const CFG = CONTAS[CONTA];
const list = await (await fetch(CFG.list)).json();
const page = list.find((t) => t.type === 'page' && /lolidle/.test(t.url || ''));
const cdpUrl = CFG.cdp || (await (await fetch('http://127.0.0.1:' + CFG.port + '/json/version')).json()).webSocketDebuggerUrl;
const ws = new WebSocket(cdpUrl);
let seq = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const i = ++seq; pend.set(i, res);
  ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, 15000);
});
const events = [];
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id !== undefined && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    events.push({ kind: 'exception', text: d.text, desc: (d.exception && d.exception.description || '').slice(0, 700) });
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    events.push({ kind: m.params.type, text: (m.params.args || []).map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 400) });
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const sess = (await send('Target.attachToTarget', { targetId: page.id, flatten: true })).result.sessionId;
await send('Runtime.enable', {}, sess);
console.log('a observar ' + SECS + 's ...');
await new Promise((r) => setTimeout(r, SECS * 1000));
console.log('eventos: ' + events.length);
const seen = new Set();
for (const e of events) {
  const k = e.kind + '|' + (e.desc || e.text).slice(0, 120);
  if (seen.has(k)) continue; seen.add(k);
  console.log('--- [' + e.kind + '] ' + e.text);
  if (e.desc) console.log('    ' + e.desc.replace(/\n/g, '\n    ').slice(0, 700));
}
ws.close();
