// _travamento-cdp.mjs — mede TRAVAMENTO a sério, pelo relay OMP (CDP em 127.0.0.1:9224/cdp).
//
// Porque isto é melhor que CPU: um main thread bloqueado NÃO RESPONDE a Runtime.evaluate.
// Logo a medida directa é "a página responde em X ms?" — e o valor X é o stall.
//
// Mede por amostra:
//   - live: bool — Runtime.evaluate respondeu dentro do timeout
//   - stallMs: quanto demorou a responder (0 = instantâneo; >=timeout = bloqueado)
//   - taskFrac: fracção do intervalo em que o main thread esteve ocupado
//               (Performance.getMetrics TaskDuration, delta / intervalo)
//   - longaTarefa: nº de Long Tasks (>50 ms) no intervalo (PerformanceObserver dentro da página)
//
// Uso:
//   node tools/_travamento-cdp.mjs [url] [segundos] [--abrir] [--fechar]
//   node tools/_travamento-cdp.mjs https://lolidle.com/jogar 90 --abrir --fechar

const BASE = process.env.RELAY_BASE || 'http://127.0.0.1:9224';
const url = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'https://lolidle.com/jogar';
const segs = Number(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 60);
const ABRIR = process.argv.includes('--abrir');
const FECHAR = process.argv.includes('--fechar');
const TIMEOUT_PROBE = 3000;

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

async function lista() {
  const r = await fetch(BASE + '/json/list');
  if (!r.ok) throw new Error('relay /json/list -> HTTP ' + r.status);
  return r.json();
}

async function ligar() {
  const ws = new WebSocket(BASE.replace('http', 'ws') + '/cdp');
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('websocket do relay recusado')), { once: true });
  });
  let id = 0;
  const pend = new Map();
  const eventos = [];
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      return;
    }
    if (m.method) eventos.push(m);
  });
  const send = (method, params = {}, sid) => new Promise((res, rej) => {
    const i = ++id;
    const timer = setTimeout(() => { pend.delete(i); rej(new Error('timeout CDP ' + method)); }, TIMEOUT_PROBE * 4);
    pend.set(i, {
      res: (v) => { clearTimeout(timer); res(v); },
      rej: (e) => { clearTimeout(timer); rej(e); },
    });
    ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
  });
  return { ws, send, eventos };
}

const { ws, send, eventos } = await ligar();

let alvo;
if (ABRIR) {
  const c = await send('Target.createTarget', { url, background: false });
  alvo = c.targetId;
  log('aba criada:', alvo);
} else {
  const { targetInfos } = await send('Target.getTargets');
  const t = targetInfos.find((x) => x.type === 'page' && new RegExp(url.split('#')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(x.url || ''));
  if (!t) { log('SEM ABA PARA', url, '— usa --abrir'); process.exit(2); }
  alvo = t.targetId;
  log('aba existente:', t.title, '|', t.url);
}

const { sessionId: sid } = await send('Target.attachToTarget', { targetId: alvo, flatten: true });
await send('Runtime.enable', {}, sid);
await send('Log.enable', {}, sid);
await send('Page.enable', {}, sid);
await send('Performance.enable', {}, sid);

// Long Tasks dentro da página (PerformanceObserver) — mostra trabalho que bloqueia o main thread.
try {
  await send('Runtime.evaluate', {
    expression: `(() => { window.__trav = window.__trav || { longas: [], totalMs: 0 };
      if (!window.__travObs) { try { window.__travObs = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) { window.__trav.longas.push(Math.round(e.duration)); window.__trav.totalMs += e.duration; }
      }); window.__travObs.observe({ entryTypes: ['longtask'] }); } catch (e) { window.__trav.semObs = String(e); } }
      return 'ok'; })()`,
    returnByValue: true,
  }, sid);
} catch (e) { log('longtask observer falhou:', e.message); }

// O `createTarget` devolve ANTES de a página navegar: sem esperar, o marcador lia-se em
// about:blank e o teste ficava sem valor. Esperar a saída de about:blank.
for (let i = 0; i < 30; i++) {
  const r = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true }, sid).catch(() => null);
  const u = r && r.result ? r.result.value : null;
  if (u && !/^about:blank/.test(u)) { log('navegou para', u); break; }
  await new Promise((r2) => setTimeout(r2, 500));
}
// Ler os marcadores ANTES de a pagina poder congelar (~2-4 s). O inject.js corre no
// document_start (mundo MAIN); o content.js no document_idle.
await new Promise((r2) => setTimeout(r2, 1200));

const ambiente = await send('Runtime.evaluate', {
  expression: `JSON.stringify({ url: location.href, titulo: document.title, hidden: document.hidden,
    auto: typeof window.__lolidleAuto, live: !!(window.__lolidleLive),
    ext: typeof window.__lolidleAutoPotion,
    // MARCADOR entre mundos: content.js:618 escreve este atributo no DOM (visivel de qualquer mundo).
    // Sem ele, a extensao NAO injectou nada -> o teste nao conta.
    marcaPotion: document.documentElement.getAttribute('data-lolidle-auto-potion'),
    marcaAuto: document.documentElement.getAttribute('data-lolidle-auto'),
    // MARCADOR do inject.js (mundo MAIN): inject.js:71 poe isto no document_start.
    //  -> true  = o stub do pulso esta instalado (a correccao do travamento DE 2026-10-16 esta a correr)
    //  -> ausente/erro = o inject.js NAO correu ou falhou
    pulsoFix: String(window.__lolidlePulsoFix),
    // MARCADOR do hook do canvas (inject.js:166) — so existe no codigo que hooka fillText
    hookFillText: !!(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype.fillText && CanvasRenderingContext2D.prototype.fillText.__lolidle),
    workerNome: window.Worker ? window.Worker.name : null })`,
  returnByValue: true,
}, sid).then((r) => { try { return JSON.parse(r.result.value); } catch { return null; } }).catch(() => null);
log('ambiente:', JSON.stringify(ambiente));

const amostras = [];
let prevTask = null;
let ultimaResposta = 0;
const inicio = Date.now();

while (Date.now() - inicio < segs * 1000) {
  const a = Date.now();
  let live = false, erro = null;
  try {
    const r = await send('Runtime.evaluate', { expression: '1+1', returnByValue: true }, sid);
    live = r && r.result && r.result.value === 2;
  } catch (e) { erro = e.message; }
  const stallMs = Date.now() - a;
  if (live) ultimaResposta = Date.now();

  let taskFrac = null, longas = null;
  try {
    const m = await send('Performance.getMetrics', {}, sid);
    const map = Object.fromEntries((m.metrics || []).map((x) => [x.name, x.value]));
    if (prevTask !== null) taskFrac = +((map.TaskDuration - prevTask) / (a - (amostras.length ? amostras[amostras.length - 1].at : a))).toFixed(3);
    prevTask = map.TaskDuration;
    const lt = await send('Runtime.evaluate', { expression: 'JSON.stringify({n: (window.__trav&&window.__trav.longas||[]).length, ms: Math.round(window.__trav&&window.__trav.totalMs||0)})', returnByValue: true }, sid);
    longas = JSON.parse(lt.result.value);
  } catch { /* página bloqueada: as métricas também não respondem */ }

  amostras.push({ at: a, live, stallMs, taskFrac, longas });
  log(`t=${((a - inicio) / 1000).toFixed(0)}s live=${live} stall=${stallMs}ms taskFrac=${taskFrac} longas=${longas ? longas.n + '/' + longas.ms + 'ms' : '?'}`);

  const espera = 1000 - (Date.now() - a);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
}

// --- erros de consola / excepções ---
const excecoes = eventos.filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => {
  const d = e.params.exceptionDetails;
  return { texto: (d.exception && d.exception.description || d.text || '').split('\n')[0], url: d.url, linha: d.lineNumber };
});
const consola = eventos.filter((e) => e.method === 'Runtime.consoleAPICalled').map((e) => ({
  tipo: e.params.type,
  texto: (e.params.args || []).map((x) => x.value ?? x.description ?? '').join(' ').slice(0, 300),
}));
const logEntradas = eventos.filter((e) => e.method === 'Log.entryAdded').map((e) => ({
  nivel: e.params.entry.level, fonte: e.params.entry.source, texto: (e.params.entry.text || '').slice(0, 300), url: e.params.entry.url,
}));

const total = amostras.length;
const bloqueadas = amostras.filter((s) => !s.live).length;
const stalls = amostras.filter((s) => s.live).map((s) => s.stallMs).sort((a, b) => a - b);
const p95 = stalls.length ? stalls[Math.floor(stalls.length * 0.95)] : null;
const task = amostras.filter((s) => s.taskFrac !== null).map((s) => s.taskFrac);
const taskMedio = task.length ? +(task.reduce((a, b) => a + b, 0) / task.length).toFixed(3) : null;
const ultima = amostras.length ? amostras[amostras.length - 1] : null;

const resumo = {
  url, segundosPedidos: segs, amostras: total,
  bloqueadas, bloqueadasPct: total ? +(100 * bloqueadas / total).toFixed(1) : null,
  stallP95ms: p95, stallMaxMs: stalls.length ? stalls[stalls.length - 1] : null,
  taskFracMedio: taskMedio,
  longasTotal: ultima && ultima.longas ? ultima.longas.n : null,
  longasMs: ultima && ultima.longas ? ultima.longas.ms : null,
  segundosSemRespostaNoFim: ultima ? +((Date.now() - ultimaResposta) / 1000).toFixed(1) : null,
  excecoes: excecoes.length, consolaErros: consola.filter((c) => c.tipo === 'error').length,
  logErros: logEntradas.filter((l) => l.nivel === 'error').length,
  exemplosExcecoes: excecoes.slice(0, 5),
  exemplosConsola: consola.filter((c) => c.tipo === 'error').slice(0, 5),
  exemplosLog: logEntradas.filter((l) => l.nivel === 'error').slice(0, 5),
  ambiente,
  veredicto: bloqueadas === 0 && (taskMedio ?? 0) < 0.5 ? 'VIVO' : (bloqueadas > total / 2 ? 'CONGELADO' : 'INSTAVEL'),
};

console.log('\n=== RESUMO ===');
console.log(JSON.stringify(resumo, null, 2));

if (FECHAR) { try { await send('Target.closeTarget', { targetId: alvo }); log('aba fechada'); } catch (e) { log('nao fechou:', e.message); } }
ws.close();
process.exit(0);
