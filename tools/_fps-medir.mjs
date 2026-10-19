// _fps-medir.mjs — MEDIÇÃO COMPLETA de FPS/quadros na aba lolidle, SEM a trazer para a frente.
//
// ATTACH-ONLY pelo RELAY (9224): nao cria nem fecha alvos; filtra url~lolidle antes de imprimir.
//
// LIMITAÇÕES MEDIDAS (2026-10-18) — PARA NÃO REPETIR:
//   * Uma aba de fundo NÃO produz quadros: `Emulation.setFocusEmulationEnabled(true)` faz
//     `document.hidden=false` (o jogo acha que está visível) mas o rAF fica preso a ~1 Hz.
//   * `Page.setWebLifecycleState('active')` sobe isso para ~23 fps — ainda throttle de fundo.
//   * `Page.startScreencast` é o ÚNICO que força quadros a sério (~224 fps, sem vsync). Como também
//     ignora o vsync, o FPS absoluto NÃO é o real; o que vale é o CUSTO por quadro e a ATRIBUIÇÃO
//     (LoAF) — e a comparação A/B sob as MESMAS condições.
//   * O Chrome de laboratório não ajuda: o 155 IGNORA `--load-extension` (medido: a extensão não fica
//     registada no `Secure Preferences`) — sem extensão, sem medição comparável.
//
// Uso: node tools/_fps-medir.mjs [ms]   (ms por janela; cada par A/B tem de caber nos ~20 s do relay)
const MS = Number(process.argv[2] || 7000);
const RELAY = 'http://127.0.0.1:9224';
const RELAY_EXT_ID = 'pbdlekcgmpippamdkgbaphcppjafobjo';

const v = await (await fetch(RELAY + '/json/version')).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const send = (method, params = {}, sessionId, ms = 30000) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __timeout: true }); } }, ms); });

const r = await send('Target.getTargets');
const page = (r.result.targetInfos || []).filter((t) => t.type === 'page' && /lolidle\.com/i.test(t.url || ''))[0];
if (!page) { console.log('sem aba lolidle'); process.exit(0); }
const att = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
const sess = att.result.sessionId;
await send('Runtime.enable', {}, sess);
await send('Page.enable', {}, sess);
await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sess);
await send('Page.setWebLifecycleState', { state: 'active' }, sess);
await send('Page.startScreencast', { format: 'jpeg', quality: 5, maxWidth: 160, maxHeight: 120, everyNthFrame: 1 }, sess);
await new Promise((r) => setTimeout(r, 2500));   // deixa o jogo acordar (estava hidden)

const sampler = `(async()=>{const out={};const medir=async(rot, ms)=>{const frames=[];let last=performance.now();const loaf=[];const long=[];const po1=new PerformanceObserver(l=>{for(const e of l.getEntries())loaf.push({dur:Math.round(e.duration),blocking:Math.round(e.blockingDuration||0),style:e.style,layout:e.styleAndLayoutDuration||0,raf:e.renderStart?Math.round(e.renderStart-e.startTime):null,scripts:(e.scripts||[]).map(s=>({n:s.name||'',url:s.sourceURL||'',dur:Math.round(s.duration),ssl:Math.round(s.forcedStyleAndLayoutDuration||0),fn:String(s.sourceFunctionName||s.invoker||'').slice(0,50),inv:s.invokerType||'',char:s.characterData?'cd':(s.desiredExecutorType||'')}))});});try{po1.observe({type:'long-animation-frame'});}catch(e){}
const po2=new PerformanceObserver(l=>{for(const e of l.getEntries())long.push(Math.round(e.duration));});try{po2.observe({type:'longtask'});}catch(e){}
const t0=last;let n=0;const lag=[];let ll=last;const lagTick=()=>{const now=performance.now();lag.push(now-ll);ll=now;if(now-t0<ms)setTimeout(lagTick,0);};
await new Promise(res=>{function step(t){frames.push(t-last);last=t;n++;if(t-t0<ms)requestAnimationFrame(step);else res();}requestAnimationFrame(step);});
try{po1.disconnect();po2.disconnect();}catch(e){}
const d=frames.slice(1).sort((a,b)=>a-b);const q=p=>Math.round((d[Math.min(d.length-1,Math.floor(d.length*p))]||0)*100)/100;
const L=lag.slice(1).sort((a,b)=>a-b);const ql=p=>Math.round((L[Math.min(L.length-1,Math.floor(L.length*p))]||0)*100)/100;
out[rot]={frames:d.length,secs:Math.round(ms/10)/100,fps:Math.round(d.length/(ms/1000)*10)/10,med:q(.5),p95:q(.95),p99:q(.99),max:Math.round(d[d.length-1]||0),loaf:loaf.map(x=>x.dur),longtasks:long,lagMed:ql(.5),lagP99:ql(.99),lagMax:Math.round(L[L.length-1]||0),loafDetalhe:loaf};};
await medir('A_sem_tocar', ${MS});
// A/B: desliga (so no CSSOM local) os estilos do Dark Reader + Stylus e mede de novo
const sheets=[...document.querySelectorAll('style.darkreader, style.stylus, [data-darkreader]')];
sheets.forEach(s=>{try{s.disabled=true;}catch(e){}});
document.body.getBoundingClientRect();
await medir('B_sem_darkreader', ${MS});
sheets.forEach(s=>{try{s.disabled=false;}catch(e){}});
out._sheets=sheets.length;
return JSON.stringify(out);})()`;

const rr = await send('Runtime.evaluate', { expression: sampler, returnByValue: true, awaitPromise: true }, sess, MS * 2 + 20000);
await send('Page.stopScreencast', {}, sess);
await send('Emulation.setFocusEmulationEnabled', { enabled: false }, sess);
await send('Target.detachFromTarget', { sessionId: sess });

if (rr.__timeout) { console.log('TIMEOUT'); process.exit(0); }
if (!rr.result || !rr.result.result || rr.result.result.value === undefined) { console.log('SEM VALOR:', JSON.stringify(rr).slice(0, 600)); process.exit(0); }
const o = JSON.parse(rr.result.result.value);
const nome = (u) => {
  if (/^motor|cena|jogo|mundo|arena|pixel|fx|mapa|itens|orbs|runeterra|tempo-real|vilemaw|chefe-global|guilda|balanco|ganhos|i18n|wiki|dados|mapa|pixel/.test(u)) return 'JOGO:' + u;
  if (u.startsWith(RELAY_EXT_ID.slice(0, 8))) return 'NOSSA_EXT';
  return u;
};
for (const k of ['A_sem_tocar', 'B_sem_darkreader']) {
  const x = o[k];
  console.log('== ' + k + ' ==', JSON.stringify({ fps: x.fps, med: x.med, p95: x.p95, p99: x.p99, maxMs: x.max, frames: x.frames, lagMed: x.lagMed, lagP99: x.lagP99, lagMax: x.lagMax, longtasks: x.longtasks.length, loaf: x.loaf.length }));
  for (const e of x.loafDetalhe) {
    const ss = (e.scripts || []).map((s) => ({ fn: s.fn, inv: s.inv, dur: s.dur, ssl: s.ssl, n: String(s.n).split('/').slice(-1)[0].slice(0, 34), url: String(s.url).split('/').slice(-1)[0].slice(0, 34) }));
    console.log('   LoAF', e.dur + 'ms', 'blocking=' + e.blocking, 'raf=' + e.raf, 'scripts=' + JSON.stringify(ss));
  }
}
console.log('sheets (darkreader+stylus):', o._sheets);
process.exit(0);
