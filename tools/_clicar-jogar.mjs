const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg || !pg.webSocketDebuggerUrl) process.exit(0);
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
await send('Accessibility.enable'); await send('DOM.enable');
const ax = await send('Accessibility.getFullAXTree');
const botoes = (ax.result ? ax.result.nodes : []).filter(n => (n.role && (n.role.value === 'button' || n.role.value === 'link')) && n.name && n.name.value);
console.log('botoes/links (' + botoes.length + '):');
for (const b of botoes.slice(0, 22)) console.log('  [' + b.role.value + '] ' + JSON.stringify(b.name.value).slice(0, 55));
const alvo = botoes.find(b => /^(jogar|jogar agora|iniciar|entrar|start|play)$/i.test(b.name.value.trim())) || botoes.find(b => /jogar/i.test(b.name.value) && !/aqui/i.test(b.name.value));
if (!alvo) { console.log('nao achei botao Jogar'); process.exit(0); }
console.log('ALVO: ' + JSON.stringify(alvo.name.value));
const box = await send('DOM.getBoxModel', { backendNodeId: alvo.backendDOMNodeId });
if (!box.result) { console.log('sem box'); process.exit(0); }
const q = box.result.model.content; const x = (q[0]+q[2]+q[4]+q[6])/4, y = (q[1]+q[3]+q[5]+q[7])/4;
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
console.log('CLIQUEI em ' + Math.round(x) + ',' + Math.round(y));
for (let i = 1; i <= 6; i++) { await new Promise(r => setTimeout(r, 5000)); const d = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, local:(document.querySelector('#local-nome')||{}).textContent||null, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, ouro:(document.querySelector('#hud-ouro')||{}).textContent||null})", returnByValue: true }); console.log('t=' + (i*5) + 's -> ' + (d.__t ? 'TRAVADO' : String(d.result?.result?.value))); }
ws.close(); process.exit(0);