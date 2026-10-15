const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
if (!pg) { console.log('DONO: sem aba'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl || 'ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map(); let csp = null;
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Network.responseReceived' && /lolidle\.com\/jogar/.test(m.params.response.url)) { const h = m.params.response.headers || {}; for (const k of Object.keys(h)) if (/content-security-policy/i.test(k)) csp = h[k]; } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Network.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 9000));
console.log('DONO: CSP = ' + (csp ? csp.slice(0, 320) : 'NAO APANHADA (o servidor pode nao mandar CSP)'));
ws.close(); process.exit(0);