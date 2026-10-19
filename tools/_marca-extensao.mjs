// _marca-extensao.mjs — prova se os content scripts da extensao correm numa pagina do lolidle
// (e em que MUNDO), pelo relay. Marcadores DISCRIMINANTES (AGENTS.md REGRA Nº 4):
//   window.__lolidlePulsoFix   -> inject.js (mundo MAIN) correu  [inject.js:71]
//   ...fillText.__lolidle      -> o hook do canvas esta instalado [inject.js:166]
//   data-lolidle-auto-potion   -> content.js (mundo ISOLADO) correu, via DOM [content.js:618]
//   data-lolidle-auto          -> o publishStatus do content.js ja correu       [content.js:~467]
//   isolaMundo                 -> le a MESMA marca do mundo ISOLADO (se existir contexto)
//
// Uso: node tools/_marca-extensao.mjs [url] [segundos]
// Por omissao usa a pagina inicial (nao arranca o jogo -> nao pode congelar).
const BASE = 'http://127.0.0.1:9224';
const url = process.argv[2] || 'https://lolidle.com/';
const segundos = Number(process.argv[3] || 6);

const EXPR = `JSON.stringify({
  url: location.href, titulo: document.title,
  pulsoFix: String(window.__lolidlePulsoFix),
  hookFillText: !!(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype.fillText && CanvasRenderingContext2D.prototype.fillText.__lolidle),
  hookOffscreen: !!(window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype.fillText && OffscreenCanvasRenderingContext2D.prototype.fillText.__lolidle),
  marcaPotion: document.documentElement.getAttribute('data-lolidle-auto-potion'),
  marcaAuto: document.documentElement.getAttribute('data-lolidle-auto'),
  workerNome: window.Worker ? window.Worker.name : null
})`;

const ws = new WebSocket(BASE.replace('http', 'ws') + '/cdp');
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pend = new Map();
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}, ms = 15000) => new Promise((res, rej) => {
  const i = ++id; const t = setTimeout(() => { pend.delete(i); rej(new Error('timeout ' + method)); }, ms);
  pend.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
  ws.send(JSON.stringify({ id: i, method, params }));
});

const ct = await send('Target.createTarget', { url, background: false }).catch((e) => { console.log('createTarget:', e.message); return null; });
if (!ct) { ws.close(); process.exit(1); }
console.log('alvo criado:', ct.targetId, '| url pedida:', url);
const at = await send('Target.attachToTarget', { targetId: ct.targetId, flatten: true });
const sid = at.sessionId;
// O relay so expoe os dominios depois de os "enable" (sem isto: -32601 'Runtime.evaluate' wasn't found)
await send('Runtime.enable', {}, sid).catch(() => {});
await send('Page.enable', {}, sid).catch(() => {});

const fim = Date.now() + segundos * 1000;
let ultimo = null;
while (Date.now() < fim) {
  const r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true }, sid).catch((e) => ({ __erro: e.message }));
  ultimo = r.__erro ? { __erro: r.__erro } : JSON.parse(r.result.value);
  console.log('  ', JSON.stringify(ultimo));
  if (ultimo && (ultimo.marcaPotion || ultimo.pulsoFix === 'true')) break;
  await new Promise((r2) => setTimeout(r2, 1000));
}
await send('Target.closeTarget', { targetId: ct.targetId }).then(() => console.log('fechada')).catch((e) => console.log('nao fechou:', e.message));
ws.close();
