// _reload-lolidle.mjs — recarrega a aba do lolidle pelo relay (necessário: os content
// scripts só injectam no LOAD; a extensão foi instalada depois de a página estar aberta).
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const alvo = list.find((t) => t.type === 'page' && /lolidle\.com/.test(t.url || ''));
if (!alvo) { console.log('SEM TAB DO LOLIDLE'); process.exit(2); }
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
const send = (method, params, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const { targetInfos } = await send('Target.getTargets');
const t = targetInfos.find((x) => /lolidle\.com/.test(x.url || ''));
const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
await send('Page.enable', {}, att.sessionId);
const r = await send('Page.reload', { ignoreCache: true }, att.sessionId);
console.log('RELOAD pedido ok:', JSON.stringify(r));
await new Promise((x) => setTimeout(x, 14000));
try { const v = await send('Runtime.evaluate', { expression: 'document.title + " | hp=" + JSON.stringify((window.__lolidleLive||{}).hp) + " | pulsoFix=" + window.__lolidlePulsoFix', returnByValue: true }, att.sessionId); console.log('DEPOIS:', v.result && v.result.value); } catch (e) { console.log('DEPOIS: erro', String(e).slice(0,120)); }
process.exit(0);