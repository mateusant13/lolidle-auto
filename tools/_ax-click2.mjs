const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
if (!pg) { console.log('sem aba no limpo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 15000); });
await send('Accessibility.enable'); await send('DOM.enable');
const ax = await send('Accessibility.getFullAXTree');
const nos = (ax.result ? ax.result.nodes : []).filter(n => /continuar aqui|jogar aqui|continuar neste|jogar neste/i.test((n.name && n.name.value) || ''));
console.log('avisos encontrados no LIMPO: ' + nos.length + (nos.length ? ' -> ' + JSON.stringify(nos[0].name.value).slice(0,50) : ''));
if (nos.length && nos[0].backendDOMNodeId) {
  const box = await send('DOM.getBoxModel', { backendNodeId: nos[0].backendDOMNodeId });
  if (box.result) { const q = box.result.model.content; const x = (q[0]+q[2]+q[4]+q[6])/4, y = (q[1]+q[3]+q[5]+q[7])/4;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    console.log('CLIQUEI no aviso em ' + Math.round(x) + ',' + Math.round(y)); }
}
await new Promise(r => setTimeout(r, 4000));
const d = await send('Runtime.evaluate', { expression: "JSON.stringify({vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null})", returnByValue: true });
console.log('LIMPO agora: ' + (d.__t ? 'sem resposta' : String(d.result?.result?.value)));
ws.close(); process.exit(0);