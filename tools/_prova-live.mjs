// _prova-live.mjs — prova ao vivo da extensão pelo relay (CDP em 127.0.0.1:9224/cdp).
// Marcador DISCRIMINANTE: folhasDeReceitaFaltando / clicarIgnorarBasicos só existem no
// código NOVO (port w3-barra). Se aparecerem no mundo da extensão, a versão nova está viva.
const BASE = 'http://127.0.0.1:9224';
const list = await (await fetch(BASE + '/json/list')).json();
const alvo = list.find((t) => t.type === 'page' && /lolidle\.com/.test(t.url || ''));
if (!alvo) { console.log('SEM TAB DO LOLIDLE'); process.exit(2); }
console.log('ALVO:', alvo.title, '|', alvo.url);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map(); const ctxs = []; let session = null;
const send = (method, params, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context);
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const { targetInfos } = await send('Target.getTargets');
const t = targetInfos.find((x) => /lolidle\.com/.test(x.url || ''));
const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
session = att.sessionId;
await send('Runtime.enable', {}, session);
await new Promise((r) => setTimeout(r, 1500));
console.log('CONTEXTOS:', ctxs.length, ctxs.map((c) => ((c.auxData && c.auxData.type) || '?') + '/' + (c.name || '')).join(' | '));
const probe = 'JSON.stringify({' +
  "auto: typeof window.__lolidleAuto," +
  "build: (window.__lolidleAuto && window.__lolidleAuto.BUILD) || null," +
  "folhas: typeof (window.__lolidleAuto && window.__lolidleAuto.folhasDeReceitaFaltando)," +
  "clicar: typeof (window.__lolidleAuto && window.__lolidleAuto.clicarIgnorarBasicos)," +
  "pulsoFix: window.__lolidlePulsoFix," +
  "hp: (window.__lolidleLive && window.__lolidleLive.hp) || null," +
  "painel: !!document.querySelector('[id^=lolidle], [class^=lolidle]')," +
  "titulo: document.title" +
'})';
let achou = false;
for (const c of ctxs) {
  try {
    const r = await send('Runtime.evaluate', { expression: probe, contextId: c.id, returnByValue: true }, session);
    const raw = r.result && r.result.value; if (!raw) continue;
    const v = JSON.parse(raw);
    if (v.auto !== 'undefined' || v.pulsoFix || v.folhas !== 'undefined') {
      console.log('CTX', c.id, (c.auxData && c.auxData.type) || '', JSON.stringify(v));
      if (v.folhas === 'function' && v.clicar === 'function' && v.build === '2026-10-22-luta-final') achou = true;
    }
  } catch (e) { /* contexto morto */ }
}
console.log(achou ? 'PROVA: BUILD 2026-10-22-luta-final VIVO (folhasDeReceitaFaltando + clicarIgnorarBasicos + marcador BUILD)' : 'NAO PROVADO: nenhuma versao nova visivel (pagina pode precisar de reload)');
process.exit(achou ? 0 : 3);