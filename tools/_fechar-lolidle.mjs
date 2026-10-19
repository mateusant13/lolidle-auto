// _fechar-lolidle.mjs — fecha abas do lolidle pelo relay. Robusto a renderer bloqueado:
// Target.closeTarget e tratado pelo processo do browser, por isso repete algumas vezes.
// Uso: node tools/_fechar-lolidle.mjs
const BASE = 'http://127.0.0.1:9224';

const l = await (await fetch(BASE + '/json/list')).json();
const alvos = l.filter((t) => /lolidle/i.test(t.url || ''));
console.log('abas lolidle:', alvos.length, alvos.map((t) => t.url).join(' ; '));
if (!alvos.length) process.exit(0);

const ws = new WebSocket(BASE.replace('http', 'ws') + '/cdp');
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}, ms = 10000) => new Promise((res, rej) => {
  const i = ++id; const t = setTimeout(() => { pend.delete(i); rej(new Error('timeout')); }, ms);
  pend.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
  ws.send(JSON.stringify({ id: i, method, params }));
});

const tg = ((await send('Target.getTargets').catch(() => ({ targetInfos: [] }))).targetInfos) || [];
const ids = [...new Set(alvos.map((a) => (tg.find((x) => x.url === a.url) || {}).targetId).filter(Boolean))];
console.log('targetIds a fechar:', ids.length);

for (const targetId of ids) {
  let feito = false;
  for (let tent = 1; tent <= 3 && !feito; tent++) {
    try { await send('Target.closeTarget', { targetId }); console.log('FECHADA', targetId, '(tentativa', tent + ')'); feito = true; }
    catch (e) { console.log('tentativa', tent, 'falhou:', e.message); }
  }
  if (!feito) console.log('NAO FECHOU', targetId);
}
ws.close();
