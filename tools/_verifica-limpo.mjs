const list = await (await fetch('http://127.0.0.1:9335/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo; alvos:', list.filter(t=>t.type==='page').map(t=>t.url.slice(0,50)).join(' | ')); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 8000); });
console.log('aba: ' + pg.url.slice(0, 55));
for (let i = 1; i <= 6; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null, local:(document.querySelector('#local-nome')||{}).textContent||null, gui:!!document.querySelector('#lolidle-ap-style')})", returnByValue: true });
  console.log('t=' + (i*2) + 's -> ' + (e.__t ? 'SEM RESPOSTA' : String(e.result?.result?.value)));
}
const ev = await send('Runtime.evaluate', { expression: `(async () => { const vistos = []; const l = (e) => { if (e.data && e.data.__lolidleAuto) vistos.push(e.data.__lolidleAuto); }; window.addEventListener('message', l); window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*'); await new Promise(r => setTimeout(r, 2500)); window.removeEventListener('message', l); return JSON.stringify({ tipos: [...new Set(vistos)] }); })()`, returnByValue: true, awaitPromise: true });
console.log('MARCADORES: ' + (ev.__t ? 'sem resposta' : String(ev.result?.result?.value)));
ws.close(); process.exit(0);