const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('aba do jogo: ' + (pg ? 'sim' : 'nao'));
// dar voz a uma pagina qualquer para consultar o estado do GPU no seu contexto
const alvo = pg || list.find(t => t.type === 'page');
if (!alvo) process.exit(0);
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
const s = (await send('Target.attachToTarget', { targetId: alvo.id, flatten: true })).result?.sessionId;
if (!s) { console.log('nao anexei'); process.exit(0); }
const r = await send('Runtime.evaluate', { expression: "(() => { const c = document.createElement('canvas'); const g = c.getContext('2d'); const info = { tipo: '2d', atributos: (() => { try { const a = g.getContextAttributes ? g.getContextAttributes() : null; return a; } catch(e){ return String(e); } })(), temWebgl: (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch(e){ return 'erro'; } })() }; return JSON.stringify(info); })()", returnByValue: true }, s);
console.log('CANVAS/GPU na pagina: ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 400)));
ws.close(); process.exit(0);