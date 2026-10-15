#!/usr/bin/env bun
/**
 * live-call.mjs — chama uma expressao ASSINCRONA no jogo e espera o resultado
 * SEM o limite de 18 s do driver CDP.
 *
 * Porque existe: Runtime.evaluate do driver tem timeout de 18 s; qualquer rotina
 * da base (acaoBase, comprarNoMercado, venderBase) demora mais e devolvia
 * "timeout Runtime.evaluate" em vez de resultado. Aqui a promessa e guardada em
 * window.__lc e vamos fazendo poll — o resultado real aparece sempre.
 *
 * Uso:
 *   bun tools/live-call.mjs --conta yasuo --expr "a.acaoBase()" [--timeout 90000] [--verbose]
 *   bun tools/live-call.mjs --conta yasuo --expr "a.getFarm().log" --sync
 */
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const CONTA = arg('--conta', process.env.LL_CONTA || 'katarina');
const EXPR = arg('--expr');
const TIMEOUT = Number(arg('--timeout', '90000'));
const SYNC = argv.includes('--sync');
const VERBOSE = argv.includes('--verbose');
if (!EXPR) { console.error('uso: --expr "<js>" [--conta yasuo] [--timeout ms] [--sync]'); process.exit(2); }

const CONTAS = {
  katarina: { list: 'http://127.0.0.1:9224/json/list', cdp: 'ws://127.0.0.1:9224/cdp' },
  yasuo: { list: 'http://127.0.0.1:9233/json/list', port: 9233, cdp: null },
};
const CFG = CONTAS[CONTA];
if (!CFG) { console.error('conta desconhecida: ' + CONTA); process.exit(2); }

const list = await (await fetch(CFG.list)).json();
const page = list.find((t) => t.type === 'page' && /lolidle/.test(t.url || ''));
if (!page) { console.error('sem aba do jogo na conta ' + CONTA); process.exit(1); }
const cdpUrl = CFG.cdp || (await (await fetch('http://127.0.0.1:' + CFG.port + '/json/version')).json()).webSocketDebuggerUrl;

const ws = new WebSocket(cdpUrl);
let seq = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++seq; pend.set(i, res);
  ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
  setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('cdp timeout ' + method)); } }, 20000);
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id !== undefined && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m); }
});
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', () => j(new Error('ws error')), { once: true }); });
const sess = (await send('Target.attachToTarget', { targetId: page.id, flatten: true })).result.sessionId;

// O __lolidleAuto vive no mundo ISOLADO do content script (origem
// chrome-extension://<id>), NAO no mundo principal da pagina. Sem escolher o
// contextId certo, 'window.__lolidleAuto' e undefined.
const EXT_ORIGIN = 'chrome-extension://' + (process.env.LL_EXT_ID || 'pbdlekcgmpippamdkgbaphcppjafobjo');
const ctxs = [];
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context);
});
await send('Runtime.enable', {}, sess);
await new Promise((r) => setTimeout(r, 1500));
const ctx = ctxs.find((c) => c.origin === EXT_ORIGIN && c.name === '') || ctxs.find((c) => c.origin === EXT_ORIGIN);
if (!ctx) { console.error('mundo da extensao nao encontrado; contextos: ' + JSON.stringify(ctxs.map((c) => c.origin))); process.exit(4); }
const evalIn = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false, userGesture: true, contextId: ctx.id }, sess);
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception?.description || ''));
  return r.result?.result?.value;
};

if (SYNC) {
  const v = await evalIn(EXPR);
  console.log(JSON.stringify(v, null, 2));
  ws.close(); process.exit(0);
}

// dispara e guarda o resultado em window.__lc
await evalIn('(function(){window.__lc={t0:Date.now(),done:false,err:null,res:null};try{Promise.resolve(' + EXPR + ').then(function(r){window.__lc.done=true;window.__lc.ms=Date.now()-window.__lc.t0;window.__lc.res=r;},function(e){window.__lc.done=true;window.__lc.err=String(e&&e.stack||e);});}catch(e){window.__lc.done=true;window.__lc.err="throw:"+String(e);}return 1;})()');
const t0 = Date.now();
let last = null;
while (Date.now() - t0 < TIMEOUT) {
  await new Promise((r) => setTimeout(r, 1000));
  const raw = await evalIn('JSON.stringify({done:window.__lc.done,ms:window.__lc.ms||null,err:window.__lc.err,res:window.__lc.res})');
  last = JSON.parse(raw);
  if (VERBOSE) console.log('[t+' + Math.round((Date.now() - t0) / 1000) + 's] done=' + last.done);
  if (last.done) break;
}
console.log(JSON.stringify({ conta: CONTA, expr: EXPR, elapsedMs: Date.now() - t0, ...last }, null, 2));
ws.close();
process.exit(last && last.done ? 0 : 3);
