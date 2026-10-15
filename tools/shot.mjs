#!/usr/bin/env bun
// shot.mjs - captura um screenshot da aba do jogo pelo relay e grava em disco.
import fs from 'node:fs';
const CDP = process.env.RELAY_CDP || 'ws://127.0.0.1:9224/cdp';
const TARGET = process.argv[2];
const OUT = process.argv[3] || 'I:/!lolidle.com/docs/shots/jogo.png';
let ws, id = 0; const pend = new Map();
function send(method, params, sid) {
  const i = ++id;
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
  return new Promise((res, rej) => { const t = setTimeout(() => { pend.delete(i); rej(new Error('timeout ' + method)); }, 30000); pend.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } }); });
}
ws = new WebSocket(CDP);
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay timeout')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('relay offline')); }, { once: true }); });
const sess = (await send('Target.attachToTarget', { targetId: TARGET, flatten: true })).sessionId;
try { await send('Page.enable', {}, sess); } catch {}
const r = await send('Page.captureScreenshot', { format: 'png' }, sess);
fs.mkdirSync(OUT.substring(0, OUT.lastIndexOf('/')), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(r.data, 'base64'));
console.log(JSON.stringify({ ok: true, out: OUT, bytes: fs.statSync(OUT).size }));
try { await send('Target.detachFromTarget', { sessionId: sess }); } catch {}
ws.close();
