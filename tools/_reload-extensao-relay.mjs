// _reload-extensao-relay.mjs — pede o reload ao background da extensão pelo relay.
// Attach-only; nunca imprime /json/list. Depois é preciso recarregar a página para
// os content scripts novos correrem.
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
if (!jogos.length) { console.log('SEM JOGO'); process.exit(2); }
const { sessionId } = await send('Target.attachToTarget', { targetId: jogos[0].targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await new Promise((r) => setTimeout(r, 400));
const ev = async (expression, contextId) => { const p = { expression, returnByValue: true, awaitPromise: true }; if (contextId) p.contextId = contextId; const r = await send('Runtime.evaluate', p, sessionId); if (r.exceptionDetails) return 'EXC ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r?.result?.value; };
let ctx = null;
for (const c of ctxs) if (/^chrome-extension:\/\//i.test(c.origin || '')) if ((await ev('typeof window.__lolidleAuto', c.id)) === 'object') { ctx = c.id; break; }
if (!ctx) { console.log('SEM MUNDO DA EXTENSAO'); process.exit(3); }
console.log('CTX=' + ctx);
console.log('RELOAD=' + await ev(`(async () => { try { const r = await chrome.runtime.sendMessage({ type: 'lolidle:reload' }); return 'ok ' + JSON.stringify(r); } catch (e) { return 'erro: ' + e; } })()`, ctx));
process.exit(0);
