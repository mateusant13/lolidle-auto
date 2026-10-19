// _relay-prova.mjs — prova que o relay OMP DIRIGE o Chrome real, sem tocar em nada.
// Liga a uma aba existente, corre Runtime.evaluate e mostra o que a pagina responde.
// Nao navega, nao clica, nao fecha nada.
//
// Uso: node tools/_relay-prova.mjs [regex-do-url]
const BASE = 'http://127.0.0.1:9224';
const filtro = process.argv[2] || '.';

const list = await (await fetch(BASE + '/json/list')).json();
const t = list.find((x) => x.type === 'page' && new RegExp(filtro).test(x.url || ''));
if (!t) { console.log('sem aba que case com', filtro); process.exit(2); }
console.log('alvo:', (t.title || '').slice(0, 60), '|', t.url);

const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});

const { targetInfos } = await send('Target.getTargets');
const alvo = targetInfos.find((x) => x.url === t.url) || targetInfos[0];
const { sessionId } = await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
const r = await send('Runtime.evaluate', {
  expression: 'JSON.stringify({titulo: document.title, url: location.href, ecra: document.documentElement.clientWidth + "x" + document.documentElement.clientHeight, visivel: !document.hidden})',
  returnByValue: true,
}, sessionId);
console.log('RESPOSTA DA PAGINA:', r.result.value);
ws.close();
