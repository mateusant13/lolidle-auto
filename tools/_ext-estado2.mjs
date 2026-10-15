const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 12000));
console.log('contextos: ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0,26)).join(' | '));
let achou = null;
for (const c of ctxs) { const r = await send('Runtime.evaluate', { contextId: c.id, returnByValue: true, expression: "typeof window.__lolidleAuto" }); const v = r.__t ? '?' : String(r.result?.result?.value); console.log('  ctx ' + c.id + ' -> ' + v); if (v === 'object') achou = c.id; }
if (achou == null) { console.log('EXTENSAO AINDA NAO INJECTOU'); process.exit(0); }
const est = await send('Runtime.evaluate', { contextId: achou, returnByValue: true, awaitPromise: true, expression: "(async () => { const A = window.__lolidleAuto; const cfg = A.getConfig(); const rank = (() => { try { return A.rankRegioes(); } catch (e) { return []; } })(); const bons = rank.filter(r => r.sobrevive).slice(0, 5).map(r => ({ id: r.id, nome: r.nome, score: r.score, xp: Math.round(r.xpMin||0), ouro: Math.round(r.goldMin||0) })); return JSON.stringify({ enabled: cfg.enabled, regiaoAtual: cfg.regionDefault, ideal: (() => { try { return A.regiaoIdeal(); } catch (e) { return null; } })(), melhores: bons }); })()" });
console.log('ESTADO: ' + (est.__t ? 'sem resposta' : String(est.result?.result?.value).slice(0, 700)));
ws.close(); process.exit(0);