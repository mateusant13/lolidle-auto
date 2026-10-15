#!/usr/bin/env bun
/**
 * autoplay-up.mjs — SOBE o auto-play do Yasuo de forma PERSISTENTE.
 *
 * Sobe dois processos DESTACADOS (sobrevivem ao fim da sessao do agente):
 *   1. guest-pipe-load.mjs  -> Chrome convidado (perfil C:/Temp/llguest) +
 *      extensao carregada por Extensions.loadUnpacked (o Chrome 155 ignora
 *      --load-extension) + flags anti-oclusao (sem elas a pagina congela).
 *   2. tick.mjs             -> bomba que chama tickAutoplay() a cada 5 s pelo CDP
 *      (os setInterval da extensao podem ficar mortos; ver cabecalho do tick.mjs).
 *
 * Uso:  bun tools/autoplay-up.mjs            # sobe tudo
 *       bun tools/autoplay-up.mjs --status   # so mostra o estado
 *       bun tools/autoplay-up.mjs --down     # derruba tudo
 */
import { spawn } from 'node:child_process';

const UDD = 'C:/Temp/llguest';
const LOG_DAEMON = 'C:/Temp/lolidle-guest.log';
const LOG_TICK = 'C:/Temp/lolidle-tick.log';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);

function ps(cmd) {
  const p = Bun.spawnSync(['powershell', '-NoProfile', '-Command', cmd], { stdout: 'pipe', stderr: 'ignore' });
  return String(p.stdout).trim();
}
// ATENCAO ao quoting: estas strings JS viram comandos PowerShell. Em string JS
// simples, \' e uma aspa simples literal — que e o delimitador certo do PowerShell.
// (A versao anterior usava \\' e o comando saiu malformado: nao matava nada e o
// SingletonLock ficava preso, fazendo o arranque abortar com 'code=21'.)
const PS_KILL_GUEST = 'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | Where-Object { $_.CommandLine -like \'*llguest*\' } | ForEach-Object { taskkill /PID $($_.ProcessId) /T /F 2>&1 | Out-Null }';
const PS_KILL_TICK = 'Get-CimInstance Win32_Process -Filter "Name=\'bun.exe\'" | Where-Object { $_.CommandLine -like \'*tick.mjs*\' } | ForEach-Object { taskkill /PID $($_.ProcessId) /T /F 2>&1 | Out-Null }';
function killGuest() {
  ps(PS_KILL_GUEST);
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) { try { require('node:fs').rmSync(`${UDD}/${f}`, { force: true }); } catch { /* ignore */ } }
}
function killTick() { ps(PS_KILL_TICK); }
async function status() {
  let up = false, browser = null;
  try { const v = await (await fetch('http://127.0.0.1:9233/json/version', { signal: AbortSignal.timeout(3000) })).json(); up = true; browser = v.Browser; } catch { /* ignore */ }
  const chrome = ps('(Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | Where-Object { $_.CommandLine -like \'*llguest*\' } | Measure-Object).Count');
  const tick = ps('(Get-CimInstance Win32_Process -Filter "Name=\'bun.exe\'" | Where-Object { $_.CommandLine -like \'*tick.mjs*\' } | Measure-Object).Count');
  return { porta9233: up, browser, procsChrome: Number(chrome) || 0, procsTick: Number(tick) || 0 };
}

const cmd = process.argv[2] || 'up';

if (cmd === '--status') { console.log(JSON.stringify(await status(), null, 2)); process.exit(0); }

if (cmd === '--down') {
  killTick(); killGuest(); await sleep(2500);
  console.log(JSON.stringify({ down: true, ...(await status()) }, null, 2)); process.exit(0);
}

// ---- UP ----
console.log('[' + ts() + '] a derrubar instancias antigas...');
killTick(); killGuest();
for (let i = 0; i < 15; i++) {
  const n = Number(ps('(Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | Where-Object { $_.CommandLine -like \'*llguest*\' } | Measure-Object).Count')) || 0;
  if (n === 0) break;
  ps(PS_KILL_GUEST); await sleep(2000);
}
await sleep(3000);

console.log('[' + ts() + '] a subir Chrome convidado + extensao...');
// Start-Process do PowerShell: e o que realmente DESTACA no Windows.
// (Bun.spawn com detached:true nao sobreviveu ao fim do processo pai.)
const envPrefix = '$env:LL_PIPE_ONLY=\'0\'; ';
ps(envPrefix + "Start-Process -FilePath 'bun' -ArgumentList 'tools/guest-pipe-load.mjs' -WorkingDirectory 'I:/!lolidle.com' -RedirectStandardOutput '" + LOG_DAEMON + "' -RedirectStandardError '" + LOG_DAEMON.replace('.log', '.err.log') + "' -WindowStyle Hidden");

// espera a extensao injectar
let pronto = false;
for (let i = 0; i < 40; i++) {
  await sleep(2000);
  try {
    const list = await (await fetch('http://127.0.0.1:9233/json/list', { signal: AbortSignal.timeout(2000) })).json();
    if (list.some((t) => t.type === 'page' && /lolidle/.test(t.url || ''))) { pronto = true; break; }
  } catch { /* ignore */ }
}
console.log('[' + ts() + '] aba do jogo: ' + (pronto ? 'OK' : 'NAO SUBIU'));
if (!pronto) { console.log('falhou a subir; ver ' + LOG_DAEMON); process.exit(1); }

console.log('[' + ts() + '] a subir a bomba do auto-play...');
ps("Start-Process -FilePath 'bun' -ArgumentList 'tools/tick.mjs','--conta','yasuo','--ms','5000' -WorkingDirectory 'I:/!lolidle.com' -RedirectStandardOutput '" + LOG_TICK + "' -RedirectStandardError '" + LOG_TICK.replace('.log', '.err.log') + "' -WindowStyle Hidden");

await sleep(12000);
console.log('[' + ts() + '] estado final:');
console.log(JSON.stringify(await status(), null, 2));
console.log('\nKatarina (relay 9224) NAO entra neste auto-play: use --conta katarina nas ferramentas.');
