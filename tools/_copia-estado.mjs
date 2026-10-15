const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable'); await new Promise(r => setTimeout(r, 6000));
const main = ctxs.find(c => c.origin === 'https://lolidle.com') || ctxs[0];
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
const ev = (expr, ctx) => send('Runtime.evaluate', { contextId: ctx, returnByValue: true, awaitPromise: true, expression: expr });
const r1 = await ev("JSON.stringify({ local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, login: /Bem-vindo de volta|Senha/i.test(document.body ? document.body.innerText : ''), marcadores: document.querySelectorAll('#marcadores .marcador[data-local]').length })", main.id);
console.log('JOGO: ' + (r1.__t ? 'sem resposta' : String(r1.result?.result?.value)));
console.log('extensao injectou: ' + (ext ? 'SIM (' + ext.origin.slice(0, 40) + ')' : 'NAO'));
ws.close(); process.exit(0);