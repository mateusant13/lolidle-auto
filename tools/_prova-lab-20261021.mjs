// _prova-lab-20261021.mjs - prova AO VIVO num perfil de LABORATORIO (nunca o do dono) das
// correccoes de 2026-10-21. Marcadores DISCRIMINANTES (Regra 4): so existem neste build.
const PORT = 9333;
const EXT = 'I:\\!lolidle.com\\extension';
const v = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json();
console.log('chrome lab:', v.Browser);
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
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
const loaded = await send('Extensions.loadUnpacked', { path: EXT });
console.log('loadUnpacked:', JSON.stringify(loaded));
const t = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
await send('Runtime.enable', {}, att.sessionId);
await new Promise((r) => setTimeout(r, 15000));
console.log('contextos:', ctxs.length);
const probe = `JSON.stringify({
  auto: typeof window.__lolidleAuto,
  BUILD: window.__lolidleAuto && window.__lolidleAuto.BUILD,
  diariaEstado: typeof (window.__lolidleAuto && window.__lolidleAuto.diariaEstado),
  receberDiariasProntas: typeof (window.__lolidleAuto && window.__lolidleAuto.receberDiariasProntas),
  itensParaCarta: typeof (window.__lolidleAuto && window.__lolidleAuto.itensParaCarta),
  fator: window.__lolidleAuto && window.__lolidleAuto.fatorAnuncio && window.__lolidleAuto.fatorAnuncio(),
  pct: window.__lolidleAuto && window.__lolidleAuto.PCT_CARTA,
  cfg: window.__lolidleAuto && window.__lolidleAuto.getConfig && (function(){var c=window.__lolidleAuto.getConfig();return {cartasAbrir:c.cartasAbrir,cartasEncaixar:c.cartasEncaixar,compraMinTier:c.compraMinTier,cartaMinRaridade:c.cartaMinRaridade};})(),
  pulsoFix: window.__lolidlePulsoFix,
  painel: !!(document.querySelector('#lolidle-ap') || document.querySelector('#lolidle-painel')),
  titulo: document.title
})`;
let prova = null;
for (const c of ctxs) {
  try {
    const r = await send('Runtime.evaluate', { expression: probe, contextId: c.id, returnByValue: true }, att.sessionId);
    const raw = r.result && r.result.value; if (!raw) continue;
    const o = JSON.parse(raw);
    if (o.auto !== 'undefined' || o.pulsoFix) { console.log('CTX', c.id, JSON.stringify(o)); if (o.BUILD === '2026-10-21g') prova = o; }
  } catch (e) { /* contexto morto */ }
}
console.log(prova ? 'PROVA AO VIVO: BUILD 2026-10-21g no mundo da extensao' : 'NAO PROVADO');
await send('Target.closeTarget', { targetId: t.targetId });
process.exit(prova ? 0 : 3);
