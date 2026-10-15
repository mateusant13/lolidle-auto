const list = await (await fetch('http://127.0.0.1:9335/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('sem aba do jogo'); process.exit(0); }
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const eventos = [];
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) eventos.push(m); });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); setTimeout(() => r({ __t: true }), 15000); });
const EXPR = `(async () => {
  const vistos = [];
  const l = (e) => { if (e.data && e.data.__lolidleAuto) vistos.push(e.data.__lolidleAuto); };
  window.addEventListener('message', l);
  window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*');
  await new Promise(r => setTimeout(r, 2500));
  window.removeEventListener('message', l);
  const metas = [];
  const l2 = (e) => { if (e.data && e.data.__lolidleAuto === 'meta') metas.push(e.data); };
  window.addEventListener('message', l2); window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*');
  await new Promise(r => setTimeout(r, 1500)); window.removeEventListener('message', l2);
  const m = metas[0];
  return JSON.stringify({
    tipos: [...new Set(vistos)],
    temEstado: vistos.includes('estado'),
    rmMonstro: m ? (m.rmMonstro != null ? m.rmMonstro : 'AUSENTE') : null,
    curvaPorNivel29: m && m.curvaPorNivel ? (m.curvaPorNivel[29] ? m.curvaPorNivel[29].hp : 'sem29') : 'AUSENTE',
    vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null,
    local: (document.querySelector('#local-nome')||{}).textContent||null,
    guiIds: [...document.querySelectorAll('[id^=lolidle],[id^=ap-auto],[id^=auto-]')].map(e=>e.id).slice(0,6),
    log: ((document.querySelector('#log')||{}).textContent||'').slice(-120)
  });
})()`;
const e = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true, awaitPromise: true });
console.log('=== PROVA AO VIVO (Chrome limpo + nossa extensão) ===');
console.log(e.__t ? 'SEM RESPOSTA' : String(e.result && e.result.result && e.result.result.value));
ws.close(); process.exit(0);