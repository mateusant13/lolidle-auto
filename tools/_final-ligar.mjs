const v = await (await fetch('http://127.0.0.1:9224/json/version')).json();
const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 14000); });
await send('Runtime.enable');
await new Promise(r => setTimeout(r, 3000));
const main = ctxs.find(c => c.origin === 'https://lolidle.com');
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
console.log('ctx main=' + (main ? main.id : '-') + ' ext=' + (ext ? ext.id : '-') );
if (main) {
  const r = await send('Runtime.evaluate', { contextId: main.id, returnByValue: true, expression: "(function(){ var b = document.body ? document.body.innerText : ''; return JSON.stringify({ local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null, temLogin: /Bem-vindo de volta|Senha|Esqueci/i.test(b), inicio: b.replace(/\\s+/g,' ').slice(0,200) }); })()" });
  console.log('JOGO: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 420)));
}
if (ext) {
  const r2 = await send('Runtime.evaluate', { contextId: ext.id, returnByValue: true, awaitPromise: true, expression: "(function(){ var A = window.__lolidleAuto; if (!A) return 'sem motor'; var c = A.getConfig(); var out = { enabled: c.enabled, regiao: c.regionDefault }; try { out.regioes = (A.rankRegioes()||[]).filter(function(x){return x.sobrevive;}).slice(0,3).map(function(x){return x.id+':'+x.score;}); } catch(e){ out.erro = String(e); } A.setConfig({ enabled: true, regionDefault: 'rota-sup' }); out.depois = A.getConfig().enabled; return JSON.stringify(out); })()" });
  console.log('AUTO-PLAY: ' + (r2.__t ? 'sem resposta' : String(r2.result?.result?.value).slice(0, 420)));
}
ws.close(); process.exit(0);