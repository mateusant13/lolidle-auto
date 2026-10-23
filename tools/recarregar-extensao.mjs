// tools/recarregar-extensao.mjs — recarrega/activa/desactiva a extensao no perfil REAL
// sem abrir janela visivel e sem roubar foco. REGRA 12 + REGRA 13.
//
//   1) le a TUA janela em foreground (bg-window.py fg)  -> e' o alvo do guardiao
//   2) bg-window.py open  -> janela alpha-0 ON-SCREEN, SWP_NOACTIVATE, alpha verificado
//   3) install/extensoes-uia.ps1 -DonoHwnd <tua> -> age em chrome://extensions e corre
//      um GUARDIAO de 20 ms que te devolve o foco sempre que o foreground for a NOSSA janela
//      (o `chrome --new-window` activa a janela, e o Chrome pode activa-la outra vez depois)
//   4) bg-window.py restore --foreground <tua>  -> uma devolucao final, sem laco
//   5) bg-window.py close -> fecha a janela
//
// Uso:
//   node tools/recarregar-extensao.mjs reload      (por omissao: reload)
//   node tools/recarregar-extensao.mjs reload --sem-janela   (nem tenta a janela)
//   node tools/recarregar-extensao.mjs activar | desactivar | estado
//
// CAMINHO SEM JANELA (2026-10-23, REGRA 11.3). Com o Chrome do dono ABERTO nao ha janela nova
// para o UIA: `chrome --new-window --user-data-dir=<perfil>` sai com 21 (PROCESS_NOTIFIED) e a
// instancia viva NAO cria janela nenhuma (medido, AGENTS.md §13.4). Nesse caso o `reload` cai
// sozinho no canal do proprio service worker:
//
//   relay 9224 (attach-only) -> mundo isolado -> chrome.runtime.sendMessage({type:'lolidle:reload'})
//   -> background.js chama chrome.runtime.reload() -> Page.reload -> BUILD do disco == BUILD vivo
//
// E a VERIFICACAO e' o que conta (REGRA Nº 4): o comando so' diz `ok:true` se o `BUILD` do
// `automation.js` em disco aparecer no mundo isolado da extensao. `activar`/`desactivar` continuam
// a precisar de janela (nao ha caminho sem UI para ligar/desligar uma extensao).
//
// Env: BG_WINDOW (default I:\!manager\tools\bg-window.py), EXT_DIR, EXT_NOME, RELAY_HTTP.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirJogo, estadoRelay } from './_relay.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// 2026-10-22: o bg-window.py abre `chrome --new-window` SEM --user-data-dir.
// No PC do dono o Chrome real corre com --user-data-dir="C:\ChromeDebugProfile";
// sem a flag o Chrome abre uma SEGUNDA instancia no perfil padrao e a extensao
// fica instalada no browser errado (o dono viu e reclamou). O wrapper local
// injecta a flag e deixa o bg-window.py intacto.
const BG = process.env.BG_WINDOW || path.join(RAIZ, 'tools', 'bg-window-udd.py')
const BG_PY = process.env.BG_WINDOW_PY || 'I:\\!manager\\tools\\bg-window.py'
const PY = process.env.PYTHON || 'python'
const PS = path.join(RAIZ, 'install', 'extensoes-uia.ps1')
const DIR = process.env.EXT_DIR || path.join(RAIZ, 'extension')
const NOME = process.env.EXT_NOME || 'LoL Idle'

// Le o --user-data-dir da instancia VIVA, preferindo a que tem porta de debug
// (a mesma regra do VOD.RIP, cookie_extension_auto_install.ps1:240-260). Sem
// isto, `chrome --new-window` cai no perfil padrao. So devolve o caminho; nunca
// imprime linhas de comando (privacidade, REGRA 11.1.5).
function uddDoDono() {
  if (process.env.EXT_UDD) return process.env.EXT_UDD
  const ps = [
    "$procs=@(Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" -ErrorAction SilentlyContinue);",
    "$fallback='';",
    "foreach($p in $procs){",
    "  $cl=[string]$p.CommandLine;",
    "  if($cl -notmatch '--user-data-dir='){continue}",
    "  $d='';",
    "  if($cl -match '--user-data-dir=\"([^\"]+)\"'){$d=$Matches[1]}",
    "  elseif($cl -match '--user-data-dir=([^\\s\"]+)'){$d=$Matches[1]}",
    "  if(-not $d){continue}",
    "  if($cl -match '--remote-debugging-port'){Write-Output $d; exit 0}",
    "  if(-not $fallback){$fallback=$d}",
    "}",
    "if($fallback){Write-Output $fallback}",
  ].join('\n')
  try {
    return execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' }).trim()
  } catch { return '' }
}

const UDD = uddDoDono()
if (!UDD) {
  console.log(JSON.stringify({ ok: false, fase: 'detectar-perfil', detalhe: 'Chrome real sem --user-data-dir; recusado para nao instalar no perfil padrao' }))
  process.exit(1)
}
process.env.BG_UDD = UDD
process.env.BG_WINDOW_PY = BG_PY

const acao = (process.argv[2] || 'reload').toLowerCase()
if (!['reload', 'activar', 'desactivar', 'estado'].includes(acao)) {
  console.log(`acao invalida: ${acao}`)
  process.exit(2)
}

const run = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
function ultimoJson(txt) {
  const linhas = String(txt).trim().split(/\r?\n/).filter(Boolean)
  for (let i = linhas.length - 1; i >= 0; i--) {
    try { return JSON.parse(linhas[i]) } catch { /* segue */ }
  }
  throw new Error('sem JSON na saida (fim): ' + String(txt).slice(-500))
}
const suave = (bin, args) => { try { return ultimoJson(run(bin, args)) } catch { return {} } }

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
const BUILD_LOCAL = (() => {
  try {
    const m = /const BUILD = '([^']+)'/.exec(fs.readFileSync(path.join(DIR, 'automation.js'), 'utf8'))
    return m ? m[1] : null
  } catch { return null }
})()

/** O relay e' infra local: se estiver em baixo, sobe-se (REGRA 16). Nunca se pede ao dono. */
async function garantirRelay() {
  let est = await estadoRelay()
  if (est.ok) return est
  try {
    spawn('omp', ['browser-relay', 'serve', '-p', '9224', '-v'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } catch { /* sem `omp` no PATH: reporta-se abaixo */ }
  for (let i = 0; i < 12; i++) {
    await dorme(700)
    est = await estadoRelay()
    if (est.ok) return { ...est, subido_agora: true }
  }
  return est
}

/** Reload sem janela, pelo service worker, com prova no fim (BUILD do disco == BUILD vivo). */
async function recarregarSemJanela() {
  const relay = await garantirRelay()
  if (!relay.ok) {
    return { ok: false, via: 'sem-janela', fase: 'relay', detalhe: relay, dica: 'prelude do relay desligado ou servidor em baixo (REGRA 16)' }
  }
  let s
  try { s = await abrirJogo() } catch (e) { return { ok: false, via: 'sem-janela', fase: 'alvo', detalhe: String(e.message || e) } }
  try {
    const ctx = await s.contextoDaExtensao()
    if (!ctx) return { ok: false, via: 'sem-janela', fase: 'mundo-da-extensao', detalhe: 'sem contexto isolado (extensao desligada, ou pagina sem o content script)' }
    const pedido = await s.avaliar(
      `(async () => { try { const r = await chrome.runtime.sendMessage({ type: 'lolidle:reload' }); return 'ok'; } catch (e) { return 'erro: ' + e; } })()`,
      ctx)
    // `chrome.runtime.reload()` mata o canal ANTES de a resposta chegar: o sendMessage rejeita com
    // "message channel closed before a response was received" (ou "Extension context invalidated").
    // Isso NAO e' falha — e' a prova de que o worker reiniciou. Quem decide e' o BUILD no fim.
    const pedidoOk = pedido === 'ok'
      || /channel closed|port closed|context invalidated|receiving end does not exist|worker/i.test(String(pedido))
    if (!pedidoOk) return { ok: false, via: 'sem-janela', fase: 'pedir-reload', detalhe: String(pedido) }
    // o content script novo so' entra numa NAVEGACAO: o reload da extensao nao reinjeta no documento vivo
    await s.dorme(2500)
    await s.send('Page.reload', { ignoreCache: true }, s.sessionId)
    await s.dorme(6000)
    const ctx2 = await s.contextoDaExtensao(20, 900)
    const vivo = ctx2 ? await s.avaliar('(window.__lolidleAuto && window.__lolidleAuto.BUILD) || null', ctx2) : null
    const ok = !!vivo && !!BUILD_LOCAL && vivo === BUILD_LOCAL
    return {
      ok,
      via: 'sem-janela',
      acao: 'reload',
      relay: { browser: relay.browser || null, subido_agora: !!relay.subido_agora },
      pagina_recarregada: true,
      mundo_da_extensao: !!ctx2,
      build_disco: BUILD_LOCAL,
      build_vivo: vivo,
      janela_aberta: false,
      foco_roubado: 0,
    }
  } finally { s.fechar() }
}

const semJanela = process.argv.slice(3).some((a) => /^--sem-janela$/i.test(a))
if (acao === 'reload' && semJanela) {
  const r = await recarregarSemJanela()
  console.log(JSON.stringify(r))
  process.exit(r.ok ? 0 : 1)
}

// 1) A TUA janela, antes de tudo (e' o que o guardiao ha-de repor).
const fg = suave(PY, [BG, 'fg'])
const dono = Number(fg.foreground || 0)
if (!dono) { console.log(JSON.stringify({ ok: false, fase: 'ler-foreground', detalhe: fg })); process.exit(1) }

// 2) janela invisivel
const aberta = suave(PY, [BG, 'open', '--url', 'about:blank', '--label', 'ext-' + acao, '--uia'])
if (!aberta.ok) {
  // Com o browser do dono aberto isto e' o normal (AGENTS.md §13.4). O reload tem caminho
  // sem janela; activar/desactivar nao tem (precisa do cartao da extensao).
  if (acao === 'reload') {
    const r = await recarregarSemJanela()
    console.log(JSON.stringify({ ...r, janela: { aberta: false, motivo: aberta.err || aberta } }))
    process.exit(r.ok ? 0 : 1)
  }
  console.log(JSON.stringify({ ok: false, fase: 'abrir-janela', detalhe: aberta, dica: 'activar/desactivar precisam do cartao da extensao; nao ha caminho sem janela' }))
  process.exit(1)
}

let res = { ok: false, error: 'nao correu' }
try {
  // 3) UIA + guardiao continuo
  const txt = run('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', PS, '-Hwnd', String(aberta.hwnd), '-DonoHwnd', String(dono), '-Acao', acao,
    '-ExtensionDir', DIR, '-ExtensionName', NOME])
  res = ultimoJson(txt)
} catch (e) {
  res = { ok: false, error: 'powershell: ' + (e.stdout ? String(e.stdout).slice(-600) : e.message) }
} finally {
  // 4) devolucao final (o guardiao ja parou; cobre o intervalo ate' fechar)
  const rest = suave(PY, [BG, 'restore', '--foreground', String(dono)])
  // 5) fechar
  const fech = suave(PY, [BG, 'close', '--target', aberta.target_id])
  res.foco = {
    dono_lido: dono,
    devolvido_no_fim: !!rest.ok,
    janela_fechada: !!fech.ok,
    foco_devolvido_no_close: !!fech.foco_devolvido,
    devolucoes_do_guardiao: res.foco_roubado_devolvido ?? null,
  }
}

// Se o UIA correu mas nao conseguiu, o reload ainda pode acontecer sem janela. A prova (BUILD)
// e' a mesma, portanto o resultado honesto e' o do caminho que verificou.
if (!res.ok && acao === 'reload') {
  const r = await recarregarSemJanela()
  if (r.ok) {
    res = { ...r, uia: { ok: false, erro: res.error || null } }
  } else {
    res.fallback_sem_janela = r
  }
}

console.log(JSON.stringify(res))
process.exit(res.ok ? 0 : 1)

