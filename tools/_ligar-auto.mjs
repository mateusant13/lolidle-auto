const v = await (await fetch('http://127.0.0.1:9224/json/version')).json();
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('aba: ' + (pg ? pg.url.slice(0, 40) : 'NAO') + ' | abas: ' + list.filter(t=>t.type==='page').length);
if (!pg || !pg.webSocketDebuggerUrl) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 12000));
console.log('contextos: ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0,24)).join(' | '));
let alvo = null;
for (const c of ctxs) { const r = await send('Runtime.evaluate', { contextId: c.id, returnByValue: true, expression: "typeof window.__lolidleAuto" }); const val = r.__t ? '?' : String(r.result?.result?.value); console.log('  ctx ' + c.id + ' -> ' + val); if (val === 'object') alvo = c.id; }
if (alvo == null) { console.log('>>> EXTENSAO NAO INJECTOU — precisa do toggle em chrome://extensions'); process.exit(0); }
const r1 = await send('Runtime.evaluate', { contextId: alvo, returnByValue: true, awaitPromise: true, expression: "(async () => { const A = window.__lolidleAuto; const cfg = A.getConfig(); const rank = (() => { try { return A.rankRegioes(); } catch (e) { return []; } })(); const bons = rank.filter(x => x.sobrevive).slice(0, 4).map(x => ({ id: x.id, nome: x.nome, score: x.score })); return JSON.stringify({ enabled: cfg.enabled, regiao: cfg.regionDefault, ideal: (() => { try { return A.regiaoIdeal(); } catch (e) { return 'erro:' + e; } })(), sobrevive: bons }); })()" });
console.log('ESTADO: ' + (r1.__t ? 'sem resposta' : String(r1.result?.result?.value).slice(0, 600)));
ws.close(); process.exit(0);