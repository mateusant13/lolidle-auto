const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + jogos.length);
if (!jogos.length) process.exit(0);
const pg = jogos[0];
const ws = new WebSocket(pg.webSocketDebuggerUrl || 'ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 15000); });
let s = null;
if (!pg.webSocketDebuggerUrl) { s = (await send('Target.attachToTarget', { targetId: pg.id, flatten: true })).result?.sessionId; console.log('attach: ' + (s ? 'ok' : 'FALHOU')); }
if (!s) { console.log('sem sessao — nao consigo injectar'); process.exit(0); }
const hb = "(function(){ var n=0; setInterval(function(){ n++; var v = (document.querySelector('#hud-vida-txt')||{}).textContent||'-'; try { fetch('http://127.0.0.1:8899/beat?t='+Date.now()+'&v='+encodeURIComponent(v), {mode:'no-cors'}); } catch(e){} }, 1000); window.__hb = true; })();";
const r1 = await send('Page.addScriptToEvaluateOnNewDocument', { source: hb }, s);
console.log('addScript: ' + (r1.result ? 'ok' : JSON.stringify(r1.error).slice(0,60)));
const r2 = await send('Runtime.evaluate', { expression: hb, returnByValue: true }, s);
console.log('eval do batimento: ' + (r2.__t ? 'SEM RESPOSTA (a pagina ja esta bloqueada ao eval)' : 'ok'));
ws.close(); process.exit(0);