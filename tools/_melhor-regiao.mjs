const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 9000); });
await send('Runtime.enable');
await new Promise(r => setTimeout(r, 2500));
console.log('contextos: ' + ctxs.map(c => (c.origin || '?').slice(0, 45)).join(' | ').slice(0, 250));
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
if (!ext) { console.log('SEM contexto da extensao'); process.exit(0); }
console.log('contexto da extensao: ' + ext.origin + ' id=' + ext.id);
const r = await send('Runtime.evaluate', { contextId: ext.id, returnByValue: true, awaitPromise: true, expression: `(async () => {
  const A = window.__lolidleAuto; if (!A) return JSON.stringify({ erro: 'sem __lolidleAuto' });
  const locais = (A.META && A.META.locais) || [];
  const out = [];
  for (const l of locais) {
    try {
      const e = A.estimarRegiao(l.id); if (!e) continue;
      const s = A.sobrevivenciaSet(null, null, l.id);
      out.push({ id: l.id, nome: String(l.nome||l.id).slice(0,20), ouro: Math.round(e.goldMin||0), xp: Math.round(e.xpMin||0), morre: s ? s.morre : null, tMorrer: s ? (s.tMorrer === null || s.tMorrer === undefined ? null : Math.round(s.tMorrer)) : null });
    } catch (err) { /* ignore */ }
  }
  return JSON.stringify({ regioes: out.length, cfg: { enabled: A.getConfig().enabled, regiao: A.getConfig().regionDefault }, out: out.slice(0, 30) });
})()` });
console.log('ESTADO: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 1800)));
ws.close(); process.exit(0);