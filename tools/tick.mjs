#!/usr/bin/env bun
/**
 * tick.mjs — BOMBA do auto-play: chama window.__lolidleAuto.tickAutoplay() a cada
 * N segundos pelo CDP, no mundo ISOLADO da extensao.
 *
 * PORQUE ISTO E NECESSARIO (medido, nao suposto):
 *  Os setInterval registados na injecao do content script podem ficar MORTOS.
 *  Evidencia: window.__lolidleAutoTimers tinha 8 ids, o plano em storage ficou
 *  101 s sem avancar, NENHUM log do supervisarBase aparecia — e no entanto um
 *  setInterval criado na hora, no mesmo mundo isolado, disparava 6x em 6 s, e
 *  chamar supervisarBase() a mao funcionava de imediato. Ou seja: o codigo esta
 *  bom, os temporizadores e que nao correm.
 *
 *  Com esta bomba o auto-play deixa de depender de temporizadores da pagina.
 *
 * Uso:  bun tools/tick.mjs [--conta yasuo] [--ms 5000]
 * Corre como job de fundo gerido (ver README/OWNERSHIP).
 */
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const CONTA = arg('--conta', 'yasuo');
const MS = Number(arg('--ms', '5000'));
const CONTAS = {
  katarina: { list: 'http://127.0.0.1:9224/json/list', cdp: 'ws://127.0.0.1:9224/cdp' },
  yasuo: { list: 'http://127.0.0.1:9233/json/list', port: 9233, cdp: null },
};
const CFG = CONTAS[CONTA];
if (!CFG) { console.error('conta desconhecida: ' + CONTA); process.exit(2); }
const EXT_ORIGIN = 'chrome-extension://' + (process.env.LL_EXT_ID || 'pbdlekcgmpippamdkgbaphcppjafobjo');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);

/** Um ciclo: liga, escolhe o mundo da extensao, chama tickAutoplay(), desliga. */
async function umTick() {
  const list = await (await fetch(CFG.list)).json();
  const page = list.find((t) => t.type === 'page' && /lolidle/.test(t.url || ''));
  if (!page) return { ok: false, motivo: 'sem aba do jogo' };
  const cdpUrl = CFG.cdp || (await (await fetch('http://127.0.0.1:' + CFG.port + '/json/version')).json()).webSocketDebuggerUrl;
  const ws = new WebSocket(cdpUrl);
  let seq = 0; const pend = new Map(); const ctxs = [];
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const i = ++seq; pend.set(i, res);
    ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }));
    setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, 12000);
  });
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id !== undefined && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m); }
    if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context);
  });
  try {
    await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', () => j(new Error('ws')), { once: true }); });
    const at = await send('Target.attachToTarget', { targetId: page.id, flatten: true });
    const sess = at.result && at.result.sessionId;
    if (!sess) return { ok: false, motivo: 'sem sessao' };
    await send('Runtime.enable', {}, sess);
    await sleep(700);
    const ctx = ctxs.find((c) => c.origin === EXT_ORIGIN && c.name === '') || ctxs.find((c) => c.origin === EXT_ORIGIN);
    if (!ctx) return { ok: false, motivo: 'sem mundo da extensao', origens: ctxs.map((c) => c.origin) };
    const r = await send('Runtime.evaluate', {
      expression: '(function(){var a=window.__lolidleAuto;if(!a||!a.tickAutoplay)return JSON.stringify({erro:"tickAutoplay ausente"});var t=a.tickAutoplay();var d=a.diagnosticoBase?a.diagnosticoBase():null;return JSON.stringify({tick:t.feito,loc:a.readLocation().text,motivo:d&&d.motivo,trava:d&&d.trava,logN:(a.getFarm().log||[]).length,ultimo:(a.getFarm().log||[])[0]||null});})()',
      returnByValue: true, userGesture: true, contextId: ctx.id,
    }, sess);
    const v = r.result && r.result.result && r.result.result.value;
    return v ? { ok: true, ...JSON.parse(v) } : { ok: false, motivo: 'sem valor', raw: JSON.stringify(r).slice(0, 200) };
  } finally { try { ws.close(); } catch { /* ignore */ } }
}

console.log('[' + ts() + '] bomba do auto-play: conta=' + CONTA + ' cada ' + MS + 'ms');
let n = 0, erros = 0;
for (;;) {
  try {
    const r = await umTick();
    n++;
    if (!r.ok) { erros++; if (erros <= 3 || erros % 20 === 0) console.log('[' + ts() + '] FALHA: ' + JSON.stringify(r).slice(0, 300)); }
    else {
      erros = 0;
      if (n % 12 === 1 || (r.ultimo && /farmar|afk|giro|chefe/.test(r.ultimo.type || ''))) {
        console.log('[' + ts() + '] #' + n + ' loc=' + r.loc + ' motivo=' + r.motivo + ' trava=' + JSON.stringify(r.trava) + ' logN=' + r.logN + (r.ultimo ? ' ult=' + JSON.stringify(r.ultimo).slice(0, 160) : ''));
      }
    }
  } catch (e) { erros++; if (erros <= 3 || erros % 20 === 0) console.log('[' + ts() + '] ERRO: ' + String(e).slice(0, 200)); }
  await sleep(MS);
}
