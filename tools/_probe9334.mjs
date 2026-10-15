const CDP = process.env.P || 'ws://127.0.0.1:9334/cdp';
let ws, id = 0; const pend = new Map();
const send = (m, pr, s, ms) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(s ? { id: i, method: m, params: pr || {}, sessionId: s } : { id: i, method: m, params: pr || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); r({ __t: true }); } }, ms || 5000); });
ws = new WebSocket(CDP);
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { const f = pend.get(m.id); pend.delete(m.id); f(m); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const tg = await send('Target.getTargets');
const alvo = (tg.result.targetInfos || []).filter(t => t.type === 'page' && /lolidle/.test(t.url))[0];
if (!alvo) { console.log('sem aba do jogo; alvos:', (tg.result.targetInfos||[]).map(t=>t.url).slice(0,5).join(' | ')); process.exit(0); }
console.log('alvo:', alvo.url);
const s = (await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true })).result.sessionId;
for (let i = 1; i <= 12; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const e = await send('Runtime.evaluate', { expression: "document.readyState + '|' + ((document.querySelector('#hud-vida-txt')||{}).textContent||'') + '|' + (typeof requestAnimationFrame)", returnByValue: true }, s, 4000);
  console.log('t=' + (i * 2) + 's -> ' + (e.__t ? 'SEM RESPOSTA (travado)' : String(e.result && e.result.result && e.result.result.value).slice(0, 70)));
}
ws.close(); process.exit(0);