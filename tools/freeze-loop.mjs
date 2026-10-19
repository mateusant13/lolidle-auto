#!/usr/bin/env node
/*
 * freeze-loop.mjs — SONDA DE CONGELAMENTO (LoL Idle)
 *
 * Responde a UMA pergunta com número, não com opinião:
 *   "a página do jogo ainda responde? se deixou de responder, QUANDO, e o que está a fazer?"
 *
 * O QUE MEDE (tudo por CDP, na instância REAL do Chrome do dono — sem a reiniciar):
 *   1. ROUND-TRIP ao main thread   — Runtime.evaluate com prazo; sem resposta = bloqueada.
 *   2. CPU do processo             — SystemInfo.getProcessInfo (nível browser, responde
 *                                    mesmo com o renderer bloqueado) → distingue
 *                                    "bloqueada a espera" (CPU ~0) de "a girar" (CPU alta).
 *   3. Carga do renderer           — Performance.getMetrics (TaskDuration, ScriptDuration,
 *                                    JSHeapUsedSize, Nodes) quando responde.
 *   4. Rede                        — pedidos que NUNCA terminam (o suspeito do pulso.js).
 *   5. Erros                       — excepções + consola error/warning.
 *   6. Crash                       — Inspector.targetCrashed / detach inesperado.
 *   7. STACK no bloqueio           — Debugger.pause quando congela: diz ONDE está preso.
 *
 * USO:
 *   node tools/freeze-loop.mjs [--secs 60] [--url https://lolidle.com/]
 *                              [--port 9222] [--mode new|existing] [--sample-ms 200]
 *                              [--out tools/_freeze-timeline.json] [--close]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const SECS      = Number(arg('--secs', '60'));
const WANT_URL  = arg('--url', 'https://lolidle.com/');
const PORT      = arg('--port', null);
const MODE      = arg('--mode', 'auto');       // new | existing | auto
const SAMPLE_MS = Number(arg('--sample-ms', '200'));
const OUT       = arg('--out', 'tools/_freeze-timeline.json');
const TIMEOUT   = Number(arg('--timeout-ms', '1200'));
let   BROWSER_WS = arg('--browser-ws', null);

// ---------------------------------------------------------------- descoberta do WS
function lerDevToolsActivePort(dir) {
  try {
    const txt = readFileSync(dir + '\\DevToolsActivePort', 'utf8').trim().split(/\r?\n/);
    if (txt.length >= 2 && /^\d+$/.test(txt[0])) return { port: Number(txt[0]), path: txt[1] };
  } catch { /* sem ficheiro */ }
  return null;
}
function descobrirBrowserWs() {
  if (BROWSER_WS) return BROWSER_WS;
  const candidatos = [];
  if (PORT) candidatos.push({ port: Number(PORT), path: null });
  if (process.env.LOCALAPPDATA) {
    candidatos.push(lerDevToolsActivePort(process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data'));
    candidatos.push(lerDevToolsActivePort(process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data\\Profile 1'));
  }
  for (const c of candidatos) {
    if (!c) continue;
    if (c.path) return 'ws://127.0.0.1:' + c.port + c.path;
    return 'ws://127.0.0.1:' + c.port + '/devtools/browser';
  }
  throw new Error('sem DevToolsActivePort — passe --browser-ws ou --port');
}

// ---------------------------------------------------------------- cliente CDP
class CDP {
  constructor(ws, rotulo) { this.ws = ws; this.rotulo = rotulo; this.id = 0; this.pend = new Map(); this.eventos = []; this.ouvintes = []; }
  static async abrir(url, rotulo) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout a abrir ' + url)), 8000);
      ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('erro a abrir ' + url)); }, { once: true });
    });
    return new CDP(ws, rotulo);
  }
  ligar() {
    this.ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id !== undefined && this.pend.has(m.id)) {
        const p = this.pend.get(m.id); this.pend.delete(m.id); p.res(m); return;
      }
      if (m.method) {
        this.eventos.push({ t: Date.now(), m });
        if (this.eventos.length > 5000) this.eventos.splice(0, 1000);
        for (const f of this.ouvintes) { try { f(m); } catch {} }
      }
    });
  }
  on(f) { this.ouvintes.push(f); }
  send(method, params = {}, sessionId = undefined, ms = 0) {
    const id = ++this.id;
    const msg = sessionId ? { id, method, params, sessionId } : { id, method, params };
    this.ws.send(JSON.stringify(msg));
    return new Promise((res) => {
      this.pend.set(id, { res });
      if (ms > 0) setTimeout(() => { if (this.pend.has(id)) { this.pend.delete(id); res({ __timeout: true, method }); } }, ms);
    });
  }
  fechar() { try { this.ws.close(); } catch {} }
}

// ---------------------------------------------------------------- util
const dormir = (ms) => new Promise(r => setTimeout(r, ms));
const agora = () => new Date().toISOString();

// ---------------------------------------------------------------- principal
const relatorio = {
  inicio: agora(),
  browserWs: null,
  url: WANT_URL,
  modo: MODE,
  // estado por amostra
  amostras: [],
  // rede
  pedidos: new Map(),         // requestId -> {url, t0}
  pendentesFim: [],
  pedidosTerminados: 0,
  pedidosFalhados: [],
  // erros
  excecoes: [],
  consola: [],
  // marco
  primeiroBloqueio: null,
  bloqueioMs: 0,
  amostrasBloqueadas: 0,
  totalAmostras: 0,
  crash: null,
  stack: null,
  metricasFim: null,
  cpuPorProcesso: {},
};

const wsUrl = descobrirBrowserWs();
relatorio.browserWs = wsUrl;
const br = await CDP.abrir(wsUrl, 'browser');
br.ligar();

// --- escolher/criar alvo ---
const alvoExistente = async () => {
  const r = await br.send('Target.getTargets', {}, undefined, 8000);
  const pages = ((r.result && r.result.targetInfos) || []).filter(t => t.type === 'page');
  return pages.find(p => /lolidle/i.test(p.url || '')) || null;
};
let alvo = (MODE === 'new') ? null : await alvoExistente();
let criadoPorMim = false;
if (!alvo) {
  const r = await br.send('Target.createTarget', { url: WANT_URL, background: false }, undefined, 10000);
  if (r.result && r.result.targetId) { criadoPorMim = true; alvo = { targetId: r.result.targetId, url: WANT_URL }; }
}
if (!alvo) { console.log(JSON.stringify({ ok: false, erro: 'nao consegui alvo' })); process.exit(1); }
relatorio.targetId = alvo.targetId;

const att = await br.send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true }, undefined, 8000);
const sess = att.result && att.result.sessionId;
if (!sess) { console.log(JSON.stringify({ ok: false, erro: 'attach falhou', att })); process.exit(1); }
relatorio.sessionId = sess;

// --- activar domínios ---
for (const d of ['Runtime.enable', 'Log.enable', 'Page.enable', 'Network.enable', 'Performance.enable']) {
  await br.send(d, {}, sess, 6000);
}

// --- captura de eventos ---
const t0 = Date.now();
let detached = false;
br.on((m) => {
  if (m.method === 'Network.requestWillBeSent') {
    relatorio.pedidos.set(m.params.requestId, { url: m.params.request.url, t0: Date.now(), type: m.params.type });
  } else if (m.method === 'Network.loadingFinished' || m.method === 'Network.loadingFailed') {
    const p = relatorio.pedidos.get(m.params.requestId);
    if (p) { p.fim = Date.now(); p.falhou = m.method === 'Network.loadingFailed'; if (p.falhou) relatorio.pedidosFalhados.push({ url: p.url, erro: m.params.errorText }); relatorio.pedidos.delete(m.params.requestId); relatorio.pedidosTerminados++; }
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    relatorio.excecoes.push({ t: Date.now() - t0, text: d.text, desc: String(d.exception && d.exception.description || '').slice(0, 600) });
  } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    relatorio.consola.push({ t: Date.now() - t0, tipo: m.params.type, texto: (m.params.args || []).map(a => String(a.value ?? a.description ?? '')).join(' ').slice(0, 400) });
  } else if (m.method === 'Inspector.targetCrashed' || m.method === 'Target.targetCrashed') {
    relatorio.crash = { t: Date.now() - t0, method: m.method };
  } else if (m.method === 'Inspector.detached') {
    detached = true;
  }
});

// --- CPU por processo, ao nível do browser (responde mesmo com a página bloqueada) ---
let cpuAnterior = null;
async function amostrarCPU() {
  const r = await br.send('SystemInfo.getProcessInfo', {}, undefined, 3000);
  const ps = (r.result && r.result.processInfo) || [];
  const linha = { t: Date.now() - t0, procs: {} };
  for (const p of ps) {
    const cpu = Number(p.cpuTime || 0);
    linha.procs[p.id] = { tipo: p.type, cpu };
  }
  if (cpuAnterior) {
    let deltaRenderer = 0;
    for (const [pid, v] of Object.entries(linha.procs)) {
      if (v.tipo === 'renderer') {
        const antes = cpuAnterior[pid] ? cpuAnterior[pid].cpu : v.cpu;
        deltaRenderer += Math.max(0, v.cpu - antes);
      }
    }
    linha.deltaCPUrenderers = Number(deltaRenderer.toFixed(3));
  }
  cpuAnterior = linha.procs;
  return linha;
}

// --- métricas do renderer (só quando responde) ---
async function metricas() {
  const r = await br.send('Performance.getMetrics', {}, sess, 2500);
  if (r.__timeout || !r.result) return null;
  const o = {};
  for (const m of r.result.metrics) if (['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'ProcessTime'].includes(m.name)) o[m.name] = m.value;
  return o;
}

// --- laço de amostragem ---
console.log('a amostrar ' + SECS + 's (passo ' + SAMPLE_MS + 'ms) em ' + wsUrl);
const fim = Date.now() + SECS * 1000;
let proximaCPU = 0, proximaMetrica = 0, ultimaMetrica = null, metricasSerie = [];
let bloqueioCorrenteInicio = null;

while (Date.now() < fim && !relatorio.crash) {
  const tAmostra = Date.now() - t0;
  const r = await br.send('Runtime.evaluate', { expression: 'performance.now()', returnByValue: true }, sess, TIMEOUT);
  const bloqueou = !!r.__timeout;
  relatorio.totalAmostras++;
  if (bloqueou) {
    relatorio.amostrasBloqueadas++;
    if (!bloqueioCorrenteInicio) bloqueioCorrenteInicio = tAmostra;
    relatorio.bloqueioMs = (Date.now() - t0) - (relatorio.primeiroBloqueio ?? tAmostra);
  } else if (bloqueioCorrenteInicio !== null) {
    bloqueioCorrenteInicio = null;
  }
  if (bloqueou && relatorio.primeiroBloqueio === null) relatorio.primeiroBloqueio = tAmostra;

  relatorio.amostras.push({ t: tAmostra, bloqueou });

  if (Date.now() >= proximaCPU) {
    proximaCPU = Date.now() + 2000;
    const c = await amostrarCPU();
    relatorio.cpuPorProcesso[tAmostra] = c;
  }
  if (Date.now() >= proximaMetrica) {
    proximaMetrica = Date.now() + 2000;
    if (!bloqueou) { const m = await metricas(); if (m) { ultimaMetrica = m; metricasSerie.push({ t: tAmostra, ...m }); } }
  }
  await dormir(SAMPLE_MS);
}

relatorio.metricasFim = ultimaMetrica;
relatorio.metricasSerie = metricasSerie;

// --- se congelou: apanhar a STACK ---
const congelou = relatorio.amostrasBloqueadas >= 3;
if (congelou && !relatorio.crash) {
  console.log('CONGELOU — a tentar apanhar a stack (Debugger.pause)...');
  await br.send('Debugger.enable', {}, sess, 6000);
  await br.send('Debugger.pause', {}, sess, 6000);
  await dormir(2500);
  const pausado = br.eventos.filter(e => e.m.method === 'Debugger.paused').pop();
  relatorio.stack = { pausou: !!pausado, razao: pausado && pausado.m.params.reason, frames: [] };
  if (pausado) {
    for (const f of (pausado.m.params.callFrames || []).slice(0, 20)) {
      relatorio.stack.frames.push({ fn: f.functionName || '(anon)', url: (f.url || '').split('/').slice(-1)[0], linha: ((f.location && f.location.lineNumber) ?? -1) + 1 });
    }
  }
  try { await br.send('Debugger.resume', {}, sess, 4000); } catch {}
}

relatorio.pendentesFim = [...relatorio.pedidos.values()].map(p => ({ url: p.url, ms: Date.now() - p.t0, type: p.type }));
relatorio.fim = agora();
relatorio.veredicto = relatorio.crash ? 'CRASH' : (congelou ? 'CONGELOU' : 'VIVO');
relatorio.detached = detached;
relatorio.criadoPorMim = criadoPorMim;

if (flag('--close') && criadoPorMim) { await br.send('Target.closeTarget', { targetId: alvo.targetId }, undefined, 5000); }

writeFileSync(OUT, JSON.stringify(relatorio, null, 1));

// --- sumário humano ---
console.log('');
console.log('================= VEREDICTO: ' + relatorio.veredicto + ' =================');
console.log('amostras: ' + relatorio.totalAmostras + ' | bloqueadas: ' + relatorio.amostrasBloqueadas +
  ' | 1º bloqueio: ' + (relatorio.primeiroBloqueio === null ? 'nunca' : relatorio.primeiroBloqueio + 'ms') +
  ' | amostras >' + TIMEOUT + 'ms');
if (relatorio.crash) console.log('CRASH detectado a ' + relatorio.crash.t + 'ms (' + relatorio.crash.method + ')');
console.log('excepcoes: ' + relatorio.excecoes.length + ' | consola err/warn: ' + relatorio.consola.length +
  ' | pedidos terminados: ' + relatorio.pedidosTerminados + ' | PENDENTES no fim: ' + relatorio.pendentesFim.length);
for (const c of relatorio.consola.slice(0, 8)) console.log('  [console.' + c.tipo + '] t+' + c.t + 'ms ' + c.texto.slice(0, 200));
for (const e of relatorio.excecoes.slice(0, 8)) console.log('  [excepcao] t+' + e.t + 'ms ' + e.text + ' :: ' + e.desc.split('\n')[0].slice(0, 200));
for (const p of relatorio.pendentesFim.slice(0, 12)) console.log('  [PENDENTE ' + p.ms + 'ms] ' + p.url.slice(0, 160));
if (relatorio.stack) { console.log('stack (pausou=' + relatorio.stack.pausou + ', razao=' + relatorio.stack.razao + '):'); for (const f of relatorio.stack.frames) console.log('   ' + f.fn + ' @ ' + f.url + ':' + f.linha); }
if (ultimaMetrica) console.log('metricas finais: ' + JSON.stringify(ultimaMetrica));
console.log('CPU renderers (delta por 2s): ' + Object.values(relatorio.cpuPorProcesso).map(c => c.deltaCPUrenderers).filter(x => x !== undefined).join(', '));
console.log('timeline: ' + OUT);
br.fechar();
process.exit(0);
