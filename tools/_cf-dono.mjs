const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('DONO: sem aba do jogo'); process.exit(0); }
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map(); const urls = new Map(); const falhas = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url); else if (m.method === 'Network.loadingFailed') falhas.push(m.params); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Network.enable'); await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 12000));
console.log('pedidos: ' + urls.size + ' | falhados: ' + falhas.length);
for (const f of falhas) console.log('  BLOQUEADO: ' + (urls.get(f.requestId) || '?').slice(0, 95) + ' -> ' + f.errorText);
const cf = [...urls.values()].filter(u => /cloudflare|challenges/i.test(u));
console.log('pedidos a Cloudflare: ' + cf.length);
for (const u of cf.slice(0, 6)) console.log('  ' + u.slice(0, 100));
ws.close(); process.exit(0);