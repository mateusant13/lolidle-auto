// _fps-probe.mjs — mede FPS e atribui o custo (LoAF) na aba lolidle do Chrome do dono, pelo RELAY (9224).
//
// ATTACH-ONLY: nao cria nem fecha alvos; filtra por url~lolidle ANTES de imprimir (REGRA 11.1.5).
// Restaura o estado (focusEmulationEnabled=false) e larga a sessao no fim.
//
// LIMITACAO MEDIDA (2026-10-18) — PARA NÃO REPETIR:
//   * Uma aba EM SEGUNDO PLANO nao produz quadros: o rAF fica preso a ~1 Hz. `setFocusEmulationEnabled`
//     faz `document.hidden=false` (o jogo acha que esta visivel), MAS o compositor continua a nao
//     desenhar a ~60 Hz -> o FPS medido e ~1. NÃO serve para medir FPS real de uma aba de fundo.
//   * O Unico caminho honesto para medir FPS real e a aba estar A MOSTRA. Se estiver, este probe da o
//     FPS e a ATRIBUICAO por script (LoAF `scripts[].name`: jogo / extensao / Dark Reader / Stylus).
//   * O Chrome de laboratorio nao ajuda: o 155 IGNORA `--load-extension` (mesmo com
//     `--disable-features=DisableLoadExtensionCommandLineSwitch`, medido: extensao nao registada em
//     Secure Preferences) — e a janela offscreen nao renderiza a 60 Hz de qualquer forma.
//
// Uso: node tools/_fps-probe.mjs [ms]
const MS = Number(process.argv[2] || 8000);
const RELAY = 'http://127.0.0.1:9224';

const v = await (await fetch(RELAY + '/json/version')).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params = {}, sessionId, ms = 20000) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __timeout: true }); } }, ms);
});

const r0 = await send('Target.getTargets');
const pages = (r0.result ? r0.result.targetInfos : []).filter((t) => t.type === 'page' && /lolidle\.com/i.test(t.url || ''));
console.log('abas lolidle encontradas:', pages.length);

const expr = `new Promise((resolve)=>{
  const frames=[]; let last=performance.now();
  const loaf=[], long=[];
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()){ loaf.push({dur:Math.round(e.duration),blocking:Math.round(e.blockingDuration||0),style:e.style,scripts:(e.scripts||[]).map(s=>({u:(s.name||'').split('/').slice(-1)[0].slice(0,42), dur:Math.round(s.duration), ssl:Math.round(s.forcedStyleAndLayoutDuration||0), fn:(s.sourceFunctionName||s.invoker||'').slice(0,40)})) }); } }).observe({type:'long-animation-frame'}); }catch(e){}
  try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) long.push({dur:Math.round(e.duration), at:Math.round(e.startTime)}); }).observe({type:'longtask'}); }catch(e){}
  let n=0; const t0=last;
  function step(t){ const dt=t-last; last=t; frames.push(dt); n++;
    if(t-t0<${MS}) requestAnimationFrame(step);
    else { const d=frames.slice(1).sort((a,b)=>a-b); const q=(p)=>d[Math.min(d.length-1,Math.floor(d.length*p))]||0;
      resolve(JSON.stringify({ hidden:document.hidden, vis:document.visibilityState, modoLeve:document.body.classList.contains('modo-leve'), frames:d.length, secs:Math.round((t-t0)/10)/100, fps:Math.round(d.length/((t-t0)/1000)*10)/10, ms_med:q(0.5), ms_p95:q(0.95), ms_p99:q(0.99), ms_max:Math.round(d[d.length-1]||0), loaf, long })); }
  }
  requestAnimationFrame(step);
})`;

for (const t of pages) {
  const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sess = att.result && att.result.sessionId;
  if (!sess) { console.log('alvo', t.targetId.slice(0, 8), 'sem sessao'); continue; }
  await send('Runtime.enable', {}, sess);
  await send('Page.enable', {}, sess);
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sess);
  const rr = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sess, MS + 15000);
  await send('Emulation.setFocusEmulationEnabled', { enabled: false }, sess);   // RESTAURA
  if (rr.__timeout) { console.log('alvo', t.targetId.slice(0, 8), 'TIMEOUT'); await send('Target.detachFromTarget', { sessionId: sess }); continue; }
  const val = rr.result && rr.result.result && rr.result.result.value;
  try {
    const o = JSON.parse(val);
    o.attribution = { total: o.loaf.length };
    const who = {};
    for (const e of o.loaf) for (const s of (e.scripts || [])) { const k = /^motor|cena|jogo|mundo|arena|pixel/.test(s.u) ? 'JOGO' : (s.u && s.u.length === 32 && /^[a-z]{32}$/.test(s.u) ? s.u.slice(0, 8) : s.u); who[k] = (who[k] || 0) + s.dur; }
    o.porScript = who;
    console.log('alvo', t.targetId.slice(0, 8), JSON.stringify(o, null, 1));
  } catch { console.log('alvo', t.targetId.slice(0, 8), val || JSON.stringify(rr.result).slice(0, 300)); }
  await send('Target.detachFromTarget', { sessionId: sess });
}
process.exit(0);
