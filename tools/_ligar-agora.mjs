const v = await (await fetch('http://127.0.0.1:9224/json/version')).json();
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg || !pg.webSocketDebuggerUrl) { console.log('sem aba/ws'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 14000));
console.log('contextos: ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0,26)).join(' | '));
const main = ctxs.find(c => c.origin === 'https://lolidle.com') || ctxs[0];
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
const ev = (expr, ctx) => send('Runtime.evaluate', { contextId: ctx, returnByValue: true, awaitPromise: true, expression: expr });
if (main) { const r = await ev("JSON.stringify({ local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro:(document.querySelector('#hud-ouro')||{}).textContent||null, login:/Bem-vindo de volta|Senha/i.test(document.body?document.body.innerText:''), marcadores: document.querySelectorAll('#marcadores .marcador[data-local]').length })", main.id); console.log('JOGO: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 300))); }
console.log('extensao injectou: ' + (ext ? 'SIM' : 'NAO'));
if (ext) {
  const r2 = await ev("(() => { const A = window.__lolidleAuto; const c = A.getConfig(); return JSON.stringify({ enabled: c.enabled, regiao: c.regionDefault }); })()", ext.id);
  console.log('CONFIG actual: ' + (r2.__t ? 'sem resposta' : String(r2.result?.result?.value)));
  const r3 = await ev("(() => { const A = window.__lolidleAuto; A.setConfig({ enabled: true, regionDefault: 'rota-sup' }); const c = A.getConfig(); return JSON.stringify({ enabled: c.enabled, regiao: c.regionDefault }); })()", ext.id);
  console.log('AUTO-PLAY ligado: ' + (r3.__t ? 'sem resposta' : String(r3.result?.result?.value)));
}
ws.close(); process.exit(0);