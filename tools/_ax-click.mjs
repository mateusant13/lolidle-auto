const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
if (!pg) { console.log('sem aba'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Accessibility.enable'); await send('DOM.enable');
const ax = await send('Accessibility.getFullAXTree');
if (ax.__t || !ax.result) { console.log('sem AX'); process.exit(0); }
const nos = ax.result.nodes.filter(n => /continuar|jogar aqui|aqui/i.test((n.name && n.name.value) || ''));
console.log('nos com continuar/jogar: ' + nos.length);
for (const n of nos.slice(0, 5)) console.log('  ' + n.role.value + ' :: ' + JSON.stringify((n.name.value||'').slice(0,60)) + ' backend=' + n.backendDOMNodeId);
const alvo = nos.find(n => /continuar aqui|jogar aqui|continuar neste|jogar neste/i.test((n.name && n.name.value) || '')) || nos[0];
if (!alvo || !alvo.backendDOMNodeId) { console.log('sem alvo clicavel'); process.exit(0); }
const box = await send('DOM.getBoxModel', { backendNodeId: alvo.backendDOMNodeId });
if (box.__t || !box.result) { console.log('sem box'); process.exit(0); }
const q = box.result.model.content; const x = (q[0]+q[2]+q[4]+q[6])/4, y = (q[1]+q[3]+q[5]+q[7])/4;
console.log('a clicar em ' + Math.round(x) + ',' + Math.round(y) + ' (alvo: ' + JSON.stringify((alvo.name.value||'').slice(0,40)) + ')');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
await new Promise(r => setTimeout(r, 4000));
const d = await send('Runtime.evaluate', { expression: "JSON.stringify({vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true });
console.log('DEPOIS DO CLIQUE: ' + (d.__t ? 'ainda sem resposta (JS bloqueado)' : String(d.result?.result?.value)));
ws.close(); process.exit(0);