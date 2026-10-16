const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const vivo = list.find(t => t.type === 'page' && /animesdigital|youtube/.test(t.url));
console.log('aba viva escolhida: ' + (vivo ? vivo.url.slice(0, 45) : 'nenhuma'));
if (!vivo) process.exit(0);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
const s = (await send('Target.attachToTarget', { targetId: vivo.id, flatten: true })).result?.sessionId;
if (!s) { console.log('nao anexei'); process.exit(0); }
const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }, s);
const r1 = await ev("(() => { const c = document.createElement('canvas'); const g = c.getContext('2d'); let attrs = null; try { attrs = g.getContextAttributes ? g.getContextAttributes() : null; } catch(e){} return JSON.stringify(attrs); })()");
console.log('2d contextAttributes: ' + (r1.__t ? 'sem resposta' : String(r1.result?.result?.value)));
const r2 = await ev("(() => { try { const g = document.createElement('canvas').getContext('webgl'); if (!g) return 'sem webgl'; const d = g.getExtension('WEBGL_debug_renderer_info'); return JSON.stringify({ vendor: d ? g.getParameter(d.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR), renderer: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) }); } catch(e) { return 'erro: ' + e; } })()");
console.log('WebGL renderer: ' + (r2.__t ? 'sem resposta' : String(r2.result?.result?.value).slice(0, 300)));
ws.close(); process.exit(0);