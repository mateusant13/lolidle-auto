// tools/_sonda-stack.mjs — sonda ATTACH-ONLY que apanha a STACK no momento do bloqueio (REGRA Nº 12).
//
// Faz 4 coisas que a `_sonda-alvo.mjs` nao faz:
//   1. Liga `Debugger` e, quando a thread deixa de responder, manda `Debugger.pause` — se for um
//      loop apertado, o V8 interrompe-o no back-edge e devolve `Debugger.paused` com a PILHA.
//   2. Escuta `Page.javascriptDialogOpening` (dialogo modal bloqueia a thread SEM queimar CPU).
//   3. Escuta `Runtime.exceptionThrown` e `Inspector.targetCrashed`.
//   4. Le `SystemInfo.getProcessInfo` (nivel browser, nao precisa da thread) para ver se o
//      renderer esta' a queimar CPU (loop) ou parado (deadlock/dialogo/frozen).
//
// NAO cria nem fecha janelas: quem abre/fecha e' o bg-window.py do manager.
// Uso: node tools/_sonda-stack.mjs <targetId> [segundos=12]

const WS = process.env.CDP_WS || 'ws://127.0.0.1:9224/cdp'
const ALVO = process.argv[2]
const SEGS = Number(process.argv[3] || 12)
if (!ALVO) { console.log('uso: node tools/_sonda-stack.mjs <targetId> [segundos]'); process.exit(1) }

const ws = new WebSocket(WS)
let id = 0
const pending = new Map()
const sleep = ms => new Promise(r => setTimeout(r, ms))
let sid = null
const eventos = []

function send(method, params = {}, s = sid, timeout = 5000, raw = false) {
  const i = ++id
  const msg = { id: i, method, params }
  if (s) msg.sessionId = s
  ws.send(JSON.stringify(msg))
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pending.delete(i); rej(new Error('timeout ' + method)) }, timeout)
    pending.set(i, { res: v => { clearTimeout(t); res(v) }, rej: e => { clearTimeout(t); rej(e) }, raw })
  })
}

ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id)
    if (m.error) p.rej(new Error(m.error.message)); else p.res(p.raw ? m : m.result)
    return
  }
  if (m.method) {
    const destaque = ['Page.javascriptDialogOpening', 'Runtime.exceptionThrown', 'Inspector.targetCrashed',
      'Page.frameNavigated', 'Debugger.paused', 'Debugger.scriptFailedToParse']
    if (destaque.includes(m.method)) eventos.push({ t: new Date().toISOString(), m: m.method, p: m.params })
  }
}
ws.onerror = e => { console.log('WS ERR', e.message || e); process.exit(1) }

function resumoPilha(cf) {
  return (cf || []).map(f => {
    const u = (f.url || '').split('/').pop() || f.url
    return `${f.functionName || '(anon)'} @ ${u}:${(f.location && f.location.lineNumber) || 0}`
  })
}

async function processos() {
  try {
    const p = await send('SystemInfo.getProcessInfo', {}, null, 4000)
    const ps = (p && p.processInfo) || []
    // So' os que mexem: CPU > 0.5% ou do tipo renderer
    return ps.map(x => ({ tipo: x.type, cpu: Math.round((x.cpuTime || 0)) })).filter(x => x.cpu > 0)
  } catch (e) { return 'SystemInfo indisponivel: ' + e.message }
}

ws.onopen = async () => {
  try {
    const a = await send('Target.attachToTarget', { targetId: ALVO, flatten: true }, null, 8000)
    sid = a.sessionId
    if (!sid) throw new Error('sem sessionId: ' + JSON.stringify(a))
    await send('Runtime.enable').catch(() => {})
    await send('Page.enable').catch(() => {})
    await send('Log.enable').catch(() => {})
    await send('Debugger.enable').catch(e => console.log('Debugger.enable falhou:', e.message))

    for (let i = 0; i < 40; i++) {
      const h = (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true }, sid, 3000).catch(() => ({})).result?.value) || ''
      if (h && h !== 'about:blank') { console.log('href:', h); break }
      await sleep(200)
    }

    let bloqueado = 0
    for (let s = 0; s < SEGS; s++) {
      let live = true
      try { await send('Runtime.evaluate', { expression: '1+1', returnByValue: true }, sid, 2000) }
      catch { live = false; bloqueado++ }
      if (!live) {
        console.log(`t=${s}s BLOQUEADO -> a fechar a sonda e a pedir a pilha`)
        break
      }
      await sleep(600)
    }
    console.log(`bloqueios antes de parar: ${bloqueado}`)

    if (bloqueado > 0) {
      // 1) CPU por processo (nivel browser) — loop queima, deadlock nao.
      console.log('CPU dos processos (browser-level):', JSON.stringify(await processos()))

      // 2) Tentar interromper a thread e ler a PILHA.
      for (let t = 0; t < 3; t++) {
        await send('Debugger.pause', {}, sid, 3000).catch(e => console.log('pause err', e.message))
        await sleep(1500)
        const pausa = eventos.filter(e => e.m === 'Debugger.paused').pop()
        if (pausa) {
          console.log('==== PILHA NO BLOQUEIO ====')
          for (const l of resumoPilha(pausa.p.callFrames)) console.log('  ' + l)
          break
        }
      }
    }

    console.log('==== EVENTOS ====')
    for (const e of eventos) {
      if (e.m === 'Page.frameNavigated') continue
      console.log(e.t, e.m, JSON.stringify(e.p).slice(0, 400))
    }
    if (!eventos.some(e => e.m !== 'Page.frameNavigated')) console.log('(nenhum evento de destaque)')
  } catch (e) {
    console.log('ERRO:', e.message)
  } finally {
    try { ws.close() } catch {}
    process.exit(0)
  }
}
setTimeout(() => { console.log('watchdog'); process.exit(2) }, (SEGS * 5 + 90) * 1000)
