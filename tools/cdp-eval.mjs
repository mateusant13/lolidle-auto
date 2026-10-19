#!/usr/bin/env node
/*
 * cdp-eval.mjs — avalia JS numa página do Chrome do dono, sem reiniciar nada.
 *
 * Uso:
 *   node tools/cdp-eval.mjs --list
 *   node tools/cdp-eval.mjs --match lolidle --expr "document.title"
 *   node tools/cdp-eval.mjs --match lolidle --expr "..." --origin chrome-extension://<id>
 *   node tools/cdp-eval.mjs --create https://lolidle.com/ --expr "location.href"
 *
 * --origin escolhe o EXECUTION CONTEXT (mundo isolado do content script) em vez do mundo MAIN.
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

let BROWSER_WS = arg('--browser-ws', null);
function ler(dir) {
  try { const t = readFileSync(dir + '\\DevToolsActivePort', 'utf8').trim().split(/\r?\n/); if (t.length >= 2) return 'ws://127.0.0.1:' + t[0] + t[1]; } catch {}
  return null;
}
if (!BROWSER_WS) {
  const p = arg('--port', null);
  if (p) {
    try { const j = await (await fetch('http://127.0.0.1:' + p + '/json/version')).json(); if (j.webSocketDebuggerUrl) BROWSER_WS = j.webSocketDebuggerUrl; } catch {}
    if (!BROWSER_WS) BROWSER_WS = ler('I:\\!lolidle.com\\.lab\\chrome-profile');
  } else BROWSER_WS = ler(process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data');
}
if (!BROWSER_WS) { console.error('sem browser ws'); process.exit(2); }

class CLI {
  constructor(ws) { this.ws = ws; this.id = 0; this.pend = new Map(); this.ev = []; }
  static async abrir(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ws')), 8000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('erro ws')); }, { once: true }); });
    const c = new CLI(ws); c.ouvir(); return c;
  }
  ouvir() { this.ws.addEventListener('message', (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.id !== undefined && this.pend.has(m.id)) { const p = this.pend.get(m.id); this.pend.delete(m.id); p.res(m); return; } if (m.method) { this.ev.push(m); if (this.ev.length > 3000) this.ev.splice(0, 1000); } }); }
  send(method, params = {}, sessionId, ms = 8000) { const id = ++this.id; this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })); return new Promise((res) => { this.pend.set(id, { res }); if (ms) setTimeout(() => { if (this.pend.has(id)) { this.pend.delete(id); res({ __timeout: true }); } }, ms); }); }
}

const c = await CLI.abrir(BROWSER_WS);

if (flag('--list')) {
  const r = await c.send('Target.getTargets');
  for (const t of (r.result.targetInfos || [])) if (t.type === 'page') console.log(t.targetId, '|', t.title, '|', t.url);
  process.exit(0);
}

const match = arg('--match', null);
const createUrl = arg('--create', null);
let alvo = null;
{
  const r = await c.send('Target.getTargets');
  const pages = (r.result.targetInfos || []).filter(t => t.type === 'page');
  if (match) alvo = pages.find(p => new RegExp(match, 'i').test(p.url || '')) || null;
  else if (!createUrl) alvo = pages.find(p => /lolidle/i.test(p.url || '')) || pages[0] || null;
}
if (!alvo && createUrl) {
  const r = await c.send('Target.createTarget', { url: createUrl, background: false }, undefined, 10000);
  alvo = { targetId: r.result.targetId, url: createUrl };
}
if (!alvo) { console.error('sem alvo'); process.exit(3); }

const att = await c.send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true });
const sess = att.result.sessionId;
await c.send('Runtime.enable', {}, sess, 6000);

// esperar pelo contexto pedido (o mundo isolado nasce depois do attach)
const origin = arg('--origin', null);
let contextId = null;
if (origin) {
  for (let i = 0; i < 40 && contextId === null; i++) {
    const ctxs = c.ev.filter(m => m.method === 'Runtime.executionContextCreated').map(m => m.params.context);
    const hit = ctxs.find(x => (x.origin || '') === origin || (x.auxData && x.auxData.origin === origin));
    if (hit) contextId = hit.id; else await new Promise(r => setTimeout(r, 150));
  }
  if (contextId === null) { const ctxs = c.ev.filter(m => m.method === 'Runtime.executionContextCreated').map(m => m.params.context); console.log(JSON.stringify({ ok: false, erro: 'contexto nao encontrado: ' + origin, contextos: ctxs.map(x => x.origin) }, null, 1)); process.exit(4); }
}

const expr = arg('--expr', null);
if (!expr) { console.log(JSON.stringify({ ok: true, targetId: alvo.targetId, url: alvo.url, sess })); process.exit(0); }

const params = { expression: expr, returnByValue: true, awaitPromise: flag('--await'), userGesture: true };
if (contextId !== null) params.contextId = contextId;
const r = await c.send('Runtime.evaluate', params, sess, Number(arg('--timeout', '15000')));
if (r.__timeout) { console.log(JSON.stringify({ ok: false, erro: 'TIMEOUT — main thread bloqueada', sess })); process.exit(5); }
if (r.result && r.result.exceptionDetails) { console.log(JSON.stringify({ ok: false, excecao: r.result.exceptionDetails.text, detalhe: String(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || '').slice(0, 1200) }, null, 1)); process.exit(6); }
const v = r.result && r.result.result && r.result.result.value;
console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
process.exit(0);
