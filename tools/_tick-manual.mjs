const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable'); await new Promise(r => setTimeout(r, 2500));
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
if (!ext) { console.log('sem contexto da extensao'); process.exit(0); }
const ev = (expr) => send('Runtime.evaluate', { contextId: ext.id, returnByValue: true, awaitPromise: true, expression: expr });
const t1 = await ev("(() => { const A = window.__lolidleAuto; const r = A.tickAutoplay(); return JSON.stringify({ feito: r.feito, at: r.at, saude: A.saudeAutoplay() }); })()");
console.log('TICK: ' + (t1.__t ? 'sem resposta' : String(t1.result?.result?.value).slice(0, 300)));
const t2 = await ev("(() => { const A = window.__lolidleAuto; try { const d = A.diagnosticoBase(); return JSON.stringify({ naBase: d.naBase, trava: d.trava, regiaoIdeal: d.regiaoIdeal, motivo: d.motivo }); } catch (e) { return 'erro: ' + e; } })()");
console.log('DIAGNOSTICO: ' + (t2.__t ? 'sem resposta' : String(t2.result?.result?.value).slice(0, 400)));
for (let i = 1; i <= 5; i++) { await new Promise(r => setTimeout(r, 4000)); const d = await ev("(() => { const A = window.__lolidleAuto; return JSON.stringify({ local: (document.querySelector('#local-nome')||{}).textContent||null, tick: A.saudeAutoplay().ultimoTickHaMs, ciclo: (A.getFarm().current||{}).region || null }); })()"); console.log('t=' + (i*4) + 's -> ' + (d.__t ? 'sem resposta' : String(d.result?.result?.value).slice(0, 200))); }
ws.close(); process.exit(0);