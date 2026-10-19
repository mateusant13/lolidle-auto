// _relay-reload-jogo.mjs — recarrega SÓ a aba do lolidle pelo relay OMP, sem imprimir /json/list.
// Regra 11.1.5: nunca imprimir as abas do dono. Attach-only + Page.reload(ignoreCache).
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0;
const pend = new Map();
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
const { targetInfos } = await send('Target.getTargets');
const jogos = targetInfos.filter((x) => x.type === 'page' && /(^|\.)lolidle\.com/i.test((x.url || '').replace(/^https?:\/\//, '')));
console.log('ABAS_LOLIDLE=' + jogos.length);
if (!jogos.length) { ws.close(); process.exit(2); }
const alvo = jogos[0];
console.log('ALVO ' + alvo.targetId);
const { sessionId } = await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Page.reload', { ignoreCache: true }, sessionId);
console.log('RELOAD_ENVIADO');
ws.close();
