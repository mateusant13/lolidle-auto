#!/usr/bin/env bun
/**
 * guest-chrome.mjs — ciclo de vida do Chrome CONVIDADO (Yasuo) na porta 9233.
 *
 * Porque existe: o Chrome convidado corre num perfil temporario
 * (C:/Temp/llguest) com a extensao carregada por --load-extension.
 *
 * ARMADILHA 1 (custou horas): o Chrome 137+ ignora --load-extension por defeito
 * (feature DisableLoadExtensionCommandLineSwitch). Sem
 * --disable-features=DisableLoadExtensionCommandLineSwitch a extensao NAO carrega:
 * o perfil fica so com as extensoes internas do Chrome e NENHUM content script e
 * injectado. Resultado: o boneco fica parado na Fonte e parece um bug da automacao
 * quando na verdade nao ha automacao nenhuma a correr. Verificacao decisiva:
 * Secure Preferences -> extensions.settings['<id>'] com location=4 (unpacked).
 *
 * ARMADILHA 2: Browser.close deixa orfaos que seguram o SingletonLock; o arranque
 * seguinte aborta com "Failed to create a ProcessSingleton". Por isso o close/kill
 * mata a ARVORE por --user-data-dir e limpa os Singleton*.
 *
 * Uso:
 *   bun tools/guest-chrome.mjs status|check|kill|launch|restart|reload
 */
import { rmSync } from 'node:fs';

const PORT = Number(process.env.LL_GUEST_PORT || 9233);
const UDD = process.env.LL_GUEST_UDD || 'C:/Temp/llguest';
const EXT = process.env.LL_EXT_DIR || 'I:/!lolidle.com/extension';
const GURL = process.env.LL_GUEST_URL || 'https://lolidle.com/jogar';
const CHROME = process.env.LL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EXT_ID = process.env.LL_EXT_ID || 'pbdlekcgmpippamdkgbaphcppjafobjo';
const EXT_ORIGIN = 'chrome-extension://' + EXT_ID;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = (o) => console.log(JSON.stringify(o, null, 2));

async function version() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(3000) }); return await r.json(); }
  catch { return null; }
}
async function list() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(3000) }); return await r.json(); }
  catch { return []; }
}
const gameTargets = async () => (await list()).filter((t) => t.type === 'page' && /lolidle\.com/.test(t.url || ''));

/** Mata a ARVORE de processos do perfil convidado (nao deixa orfaos com o lock). */
function killTree() {
  const ps = 'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | ' +
    "Where-Object { $_.CommandLine -like '*llguest*' } | " +
    'ForEach-Object { taskkill /PID $($_.ProcessId) /T /F 2>&1 | Out-Null }';
  try { Bun.spawnSync(['powershell', '-NoProfile', '-Command', ps], { stdout: 'ignore', stderr: 'ignore' }); } catch {}
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try { rmSync(`${UDD}/${f}`, { force: true }); } catch {}
  }
}
async function alive() {
  try {
    const ps = 'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | ' +
      "Where-Object { $_.CommandLine -like '*llguest*' } | Measure-Object | Select-Object -ExpandProperty Count";
    const p = Bun.spawnSync(['powershell', '-NoProfile', '-Command', ps], { stdout: 'pipe', stderr: 'ignore' });
    return Number(String(p.stdout).trim()) || 0;
  } catch { return -1; }
}

/** Mundos de execucao da aba do jogo: prova se a extensao injectou. */
async function contexts(timeoutMs = 3000) {
  const v = await version();
  if (!v?.webSocketDebuggerUrl) return { ok: false, error: 'sem CDP em ' + PORT };
  const targets = await gameTargets();
  if (!targets.length) return { ok: false, error: 'sem aba do jogo' };
  const target = targets[0];
  return await new Promise((resolve) => {
    const found = new Map();
    let ws, done = false, sess = null, msgId = 0;
    const fin = (extra) => { if (done) return; done = true; try { ws && ws.close(); } catch {} resolve({ ok: true, targetId: target.id, origins: [...found.keys()], hasExt: found.has(EXT_ORIGIN), contexts: [...found.values()], ...extra }); };
    const send = (method, params, sessionId) => ws.send(JSON.stringify(sessionId ? { id: ++msgId, method, params, sessionId } : { id: ++msgId, method, params }));
    setTimeout(() => fin({ timeout: true }), timeoutMs);
    try { ws = new WebSocket(v.webSocketDebuggerUrl); } catch (e) { return resolve({ ok: false, error: String(e) }); }
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.method === 'Runtime.executionContextCreated') {
        const c = m.params.context;
        if (c.origin && !found.has(c.origin)) found.set(c.origin, { id: c.id, origin: c.origin, name: c.name, isDefault: !!(c.auxData && c.auxData.isDefault) });
      }
      if (m.id !== undefined && m.result && m.result.sessionId && !sess) { sess = m.result.sessionId; send('Runtime.enable', {}, sess); }
    });
    ws.addEventListener('open', () => { send('Target.attachToTarget', { targetId: target.id, flatten: true }); });
    ws.addEventListener('error', () => fin({ error: 'ws error' }));
  });
}

/** Prova no ficheiro: a extensao esta registada como unpacked (location=4)? */
function registeredInProfile() {
  try {
    const p = Bun.spawnSync(['powershell', '-NoProfile', '-Command',
      `(Get-Content -Raw '${UDD}/Default/Secure Preferences' | ConvertFrom-Json).extensions.settings.'${EXT_ID}' | ConvertTo-Json -Compress`],
      { stdout: 'pipe', stderr: 'ignore' });
    const s = String(p.stdout).trim();
    if (!s) return { registered: false };
    const j = JSON.parse(s);
    return { registered: true, location: j.location, path: j.path, state: j.state, disable_reasons: j.disable_reasons };
  } catch (e) { return { registered: false, error: String(e) }; }
}

function launch() {
  const args = [
    `--user-data-dir=${UDD}`,
    `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check',
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Chrome 137+ ignora --load-extension sem isto (ver ARMADILHA 1 no topo).
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--enable-unsafe-extension-debugging',
    GURL,
  ];
  const p = Bun.spawn([CHROME, ...args], { stdout: 'ignore', stderr: 'ignore', stdin: 'ignore', detached: true });
  p.unref();
  return { ok: true, pid: p.pid, args };
}

async function waitUp(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await version()) return Date.now() - t0; await sleep(400); }
  return null;
}

/** Recarrega a aba do jogo (fecha a corrida: aba aberta antes da extensao carregar). */
async function reload() {
  const v = await version();
  if (!v?.webSocketDebuggerUrl) return { ok: false, error: 'sem CDP' };
  const targets = await gameTargets();
  if (!targets.length) return { ok: false, error: 'sem aba do jogo' };
  return await new Promise((resolve) => {
    let ws, done = false, msgId = 0, sess = null;
    const fin = (o) => { if (done) return; done = true; try { ws && ws.close(); } catch {} resolve(o); };
    const send = (method, params, sessionId) => ws.send(JSON.stringify(sessionId ? { id: ++msgId, method, params, sessionId } : { id: ++msgId, method, params }));
    setTimeout(() => fin({ ok: false, error: 'timeout reload' }), 12000);
    try { ws = new WebSocket(v.webSocketDebuggerUrl); } catch (e) { return fin({ ok: false, error: String(e) }); }
    ws.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id !== undefined && m.result && m.result.sessionId && !sess) {
        sess = m.result.sessionId;
        send('Page.enable', {}, sess);
        send('Page.reload', { ignoreCache: true }, sess);
        setTimeout(() => fin({ ok: true, reloaded: targets[0].id }), 1500);
      }
    });
    ws.addEventListener('open', () => send('Target.attachToTarget', { targetId: targets[0].id, flatten: true }));
    ws.addEventListener('error', () => fin({ ok: false, error: 'ws error' }));
  });
}

const cmd = process.argv[2] || 'status';

if (cmd === 'status') {
  const v = await version();
  out({ port: PORT, up: !!v, browser: v?.Browser || null, userDataDir: UDD, extDir: EXT, procs: await alive(), profile: registeredInProfile(), targets: (await list()).map((t) => ({ type: t.type, id: t.id, url: (t.url || '').slice(0, 80) })) });
} else if (cmd === 'check') {
  const c = await contexts();
  out({ ...c, profile: registeredInProfile() });
  if (!c.hasExt) process.exit(3);
} else if (cmd === 'kill') {
  killTree();
  await sleep(2500);
  out({ ok: true, procs: await alive(), up: !!(await version()) });
} else if (cmd === 'launch') {
  const L = launch();
  const up = await waitUp();
  out({ ...L, msToUp: up, ok: !!up });
  if (!up) process.exit(1);
} else if (cmd === 'reload') {
  out(await reload());
} else if (cmd === 'restart') {
  killTree();
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) { if (!(await version())) break; await sleep(400); }
  if (await version()) { out({ ok: false, error: 'porta ainda viva apos kill' }); process.exit(1); }
  const L = launch();
  const up = await waitUp();
  if (!up) { out({ ok: false, step: 'launch', ...L, error: 'nao subiu' }); process.exit(1); }
  await sleep(3000);
  let ck = await contexts();
  if (!ck.hasExt) { await reload(); await sleep(9000); ck = await contexts(); }
  out({ ok: true, msToUp: up, pid: L.pid, profile: registeredInProfile(), ...ck });
  if (!ck.hasExt) process.exit(3);
} else { console.error('comandos: status | check | kill | launch | restart | reload'); process.exit(2); }
