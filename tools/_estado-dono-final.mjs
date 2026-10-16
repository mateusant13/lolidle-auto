const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas lolidle: ' + list.filter(t => t.type === 'page' && /lolidle/.test(t.url)).length + ' (pg=' + (pg ? 'sim' : 'nao') + ')');
if (!pg) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Runtime.enable'); await new Promise(r => setTimeout(r, 3000));
console.log('ctxs: ' + ctxs.map(c => c.id + ':' + (c.origin||'?').slice(0, 30)).join(' | '));
const main = ctxs.find(c => c.origin === 'https://lolidle.com');
const ext = ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
if (main) { const r = await send('Runtime.evaluate', { contextId: main.id, returnByValue: true, expression: "JSON.stringify({ login: /Bem-vindo de volta|Senha/i.test(document.body ? document.body.innerText : ''), local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro: (document.querySelector('#hud-ouro')||{}).textContent||null })" }); console.log('JOGO: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 300))); }
console.log('EXTENSAO: ' + (ext ? 'INJECTOU' : 'nao injectou'));
ws.close(); process.exit(0);