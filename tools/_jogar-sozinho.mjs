const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 18000); });
// 1) uma unica aba nova (nao ha nenhuma minha aberta agora)
const nt = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result?.sessionId;
console.log('aba: ' + (s ? 'ok' : 'FALHOU'));
if (!s) process.exit(0);
await send('Runtime.enable', {}, s); await send('Accessibility.enable', {}, s); await send('DOM.enable', {}, s);
await new Promise(r => setTimeout(r, 16000));
const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }, s);
const r1 = await ev("JSON.stringify({ rs: document.readyState, login: /Bem-vindo de volta|Senha/i.test(document.body ? document.body.innerText : ''), local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, mapa: !!document.querySelector('#janela-mapa'), marcadores: document.querySelectorAll('#marcadores .marcador[data-local]').length })");
console.log('1) ESTADO: ' + (r1.__t ? 'sem resposta' : String(r1.result?.result?.value)));
// 2) abrir o mapa pela arvore de acessibilidade (clicando 'Mapa (M)')
const ax = await send('Accessibility.getFullAXTree', {}, s);
const nos = ax.result ? ax.result.nodes : [];
const mapaBtn = nos.find(n => /^mapa/i.test(((n.name && n.name.value) || '').trim()));
console.log('2) botao Mapa: ' + (mapaBtn ? JSON.stringify(mapaBtn.name.value) + ' backend=' + mapaBtn.backendDOMNodeId : 'nao achei'));
if (mapaBtn && mapaBtn.backendDOMNodeId) {
  const box = await send('DOM.getBoxModel', { backendNodeId: mapaBtn.backendDOMNodeId }, s);
  if (box.result) { const q = box.result.model.content; const x = (q[0]+q[2]+q[4]+q[6])/4, y = (q[1]+q[3]+q[5]+q[7])/4;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, s);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, s);
    console.log('   cliquei Mapa em ' + Math.round(x) + ',' + Math.round(y)); } }
await new Promise(r => setTimeout(r, 4000));
const r2 = await ev("JSON.stringify({ mapa: !!document.querySelector('#janela-mapa'), marcadores: [...document.querySelectorAll('#marcadores .marcador[data-local]')].map(m => m.getAttribute('data-local')).slice(0, 20) })");
console.log('3) MAPA: ' + (r2.__t ? 'sem resposta' : String(r2.result?.result?.value).slice(0, 400)));
ws.close(); process.exit(0);