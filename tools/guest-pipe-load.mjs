#!/usr/bin/env bun
/**
 * guest-pipe-load.mjs — ARRANCA o Chrome convidado (Yasuo) e CARREGA a extensao
 * unpacked pela via oficial do Chrome 137+.
 *
 * PORQUE ISTO EXISTE (medido, nao suposto):
 *  - O Chrome 155 IGNORA --load-extension em TODAS as combinacoes de flags
 *    (matriz M1..M5: extensao AUSENTE do chrome://extensions-internals).
 *  - O dominio CDP Extensions (Extensions.loadUnpacked) so existe quando o
 *    cliente liga por --remote-debugging-pipe.
 *  - Com o pipe: Extensions.loadUnpacked devolve o id -> extensao carregada.
 *  - A extensao so injecta content script em documentos carregados DEPOIS de
 *    estar carregada => e preciso recarregar a aba.
 *
 * Este processo TEM de ficar vivo: o pipe e a ligacao CDP. Corre como job de
 * fundo gerido. A porta 9233 serve todas as outras ferramentas (ll.mjs etc).
 */
import { spawn } from 'node:child_process';

const CHROME = process.env.LL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const UDD = process.env.LL_GUEST_UDD || 'C:/Temp/llguest';
const EXT = process.env.LL_EXT_DIR || 'I:/!lolidle.com/extension';
const PORT = process.env.LL_GUEST_PORT || '9233';
const URL_ = process.env.LL_GUEST_URL || 'https://lolidle.com/jogar';
const KEEP_MS = Number(process.env.LL_KEEP_MS || 0); // 0 = fica vivo indefinidamente
const WITH_PORT = process.env.LL_PIPE_ONLY !== '1';

// ARMADILHA MEDIDA (nao repetir): --disable-extensions-except / --load-extension
// BLOQUEIAM a extensao carregada por Extensions.loadUnpacked — com eles o
// loadUnpacked devolve o id mas NENHUM content script injecta. O conjunto que
// funciona e o MINIMO: pipe + --enable-unsafe-extension-debugging.
// (LL_LEGACY=1 repoe as flags antigas, so para diagnostico.)
const LEGACY = process.env.LL_LEGACY === '1';
const args = [
  `--user-data-dir=${UDD}`,
  ...(WITH_PORT ? [`--remote-debugging-port=${PORT}`] : []),
  '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check',
  '--enable-unsafe-extension-debugging',
  // ARMADILHA 3 (a que fazia o boneco ficar parado na Fonte): com o desktop
  // sem render (sessao remota / janela oculta), o Chrome marca a aba como
  // 'hidden' por OCLUSAO e CONGELA a pagina. Efeito medido: requestAnimationFrame
  // = 0 ticks (o motor do jogo para) e os setInterval da extensao deixam de correr
  // (o plano em storage ficou 101 s sem avancar). O jogo fica parado e parece
  // bug de automacao. Estas flags sao o padrao de automacao para isso:
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-background-timer-throttling',
  '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling',
  ...(LEGACY ? [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
  ] : []),
  URL_,
];
console.log('[launcher] chrome: pipe' + (WITH_PORT ? ' + porta ' + PORT : ' so'));
const child = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
child.stdio[2].on('data', (d) => { const s = String(d).trim(); if (s && !/TensorFlow|XNNPACK/.test(s)) console.log('[stderr] ' + s.split('\n').slice(0, 4).join(' | ')); });
child.on('exit', (c) => { console.log('[launcher] chrome SAIU code=' + c); process.exit(0); });

const toChrome = child.stdio[3];
const fromChrome = child.stdio[4];
let buf = Buffer.alloc(0);
const pending = new Map();
const ctxSink = new Set();
fromChrome.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  let i;
  while ((i = buf.indexOf(0)) >= 0) {
    const raw = buf.subarray(0, i).toString('utf8');
    buf = buf.subarray(i + 1);
    let m; try { m = JSON.parse(raw); } catch { continue; }
    if (m.method === 'Runtime.executionContextCreated' && m.params?.context?.origin) ctxSink.add(m.params.context.origin);
    if (m.id !== undefined && pending.has(m.id)) { const r = pending.get(m.id); pending.delete(m.id); r(m); }
  }
});
let msgSeq = 0;
const send = (method, params = {}, sessionId) => new Promise((res) => {
  const i = ++msgSeq;
  pending.set(i, res);
  toChrome.write(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params }) + '\0');
  setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ __timeout: true, method }); } }, 15000);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await sleep(2500);
const lu = await send('Extensions.loadUnpacked', { path: EXT });
const extId = lu.result?.id || null;
console.log('[launcher] loadUnpacked -> ' + JSON.stringify(lu).slice(0, 200));

const tg = await send('Target.getTargets', {});
const pages = (tg.result?.targetInfos || []).filter((t) => t.type === 'page' && /lolidle/.test(t.url || ''));
console.log('[launcher] abas do jogo: ' + pages.length);
if (pages.length) {
  const at = await send('Target.attachToTarget', { targetId: pages[0].targetId, flatten: true });
  const sess = at.result?.sessionId;
  if (sess) {
    await send('Page.enable', {}, sess);
    await send('Runtime.enable', {}, sess);
    ctxSink.clear();
    console.log('[launcher] a recarregar a aba para os content scripts injectarem...');
    await send('Page.reload', { ignoreCache: false }, sess);
    await sleep(10000);
    const origins = [...ctxSink];
    const hasExt = origins.some((o) => o.startsWith('chrome-extension://'));
    console.log('[launcher] mundos: ' + JSON.stringify(origins));
    console.log('[launcher] >>> EXTENSAO INJECTOU: ' + hasExt);
  }
}
console.log('[launcher] PRONTO extId=' + extId + ' porta=' + (WITH_PORT ? PORT : 'nenhuma'));
if (KEEP_MS > 0) { await sleep(KEEP_MS); console.log('[launcher] a sair por KEEP_MS'); process.exit(0); }
console.log('[launcher] vivo (pipe aberto). Ctrl-C/job_kill para terminar.');
await new Promise(() => {});
