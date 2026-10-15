const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg || !pg.webSocketDebuggerUrl) { console.log('sem aba/ws'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Runtime.enable'); await new Promise(r => setTimeout(r, 2500));
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
const ev = (expr, ctx) => send('Runtime.evaluate', { contextId: ctx, returnByValue: true, awaitPromise: true, expression: expr });
const main = ctxs.find(c => c.id === 1);
const r1 = await ev("JSON.stringify({ local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro:(document.querySelector('#hud-ouro')||{}).textContent||null, npcs: !!document.querySelector('#npcs'), mapa: !!document.querySelector('#janela-mapa') })", main && main.id);
console.log('JOGO: ' + (r1.__t ? 'sem resposta' : String(r1.result?.result?.value)));
if (!ext) { console.log('extensao nao injectou'); process.exit(0); }
const r2 = await ev("(() => { const A = window.__lolidleAuto; const f = A.getFarm(); const c = f && f.current; return JSON.stringify({ enabled: A.getConfig().enabled, regiaoAlvo: A.getConfig().regionDefault, emCiclo: c ? { regiao: c.region, fase: c.fase, mortes: c.deaths } : null, pausado: A.estaPausado(), saude: A.saudeAutoplay() }); })()", ext.id);
console.log('EXTENSAO: ' + (r2.__t ? 'sem resposta' : String(r2.result?.result?.value).slice(0, 400)));
const r3 = await ev("(() => { try { const A = window.__lolidleAuto; const viajou = A.viajarPara('rota-sup'); return JSON.stringify(viajou); } catch (e) { return 'erro:' + e; } })()", ext.id);
console.log('VIAJAR rota-sup: ' + (r3.__t ? 'sem resposta' : String(r3.result?.result?.value).slice(0, 200)));
ws.close(); process.exit(0);