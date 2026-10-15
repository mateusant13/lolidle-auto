const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
if (!pg) { console.log('sem aba'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const urls = new Map(); const falhas = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url); else if (m.method === 'Network.loadingFailed') falhas.push(m.params); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Network.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 12000));
console.log('pedidos: ' + urls.size + ' | falhados: ' + falhas.length);
const cf = [...urls.values()].filter(u => /cloudflare|challenges|turnstile/i.test(u));
console.log('pedidos a Cloudflare/Turnstile: ' + cf.length);
for (const u of cf.slice(0, 8)) console.log('  ' + u.slice(0, 110));
for (const f of falhas.slice(0, 4)) console.log('  FALHOU: ' + (urls.get(f.requestId) || '?').slice(0, 90) + ' -> ' + f.errorText);
ws.close(); process.exit(0);