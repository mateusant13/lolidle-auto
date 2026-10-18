// tools/_sonda-alvo.mjs — sonda ATTACH-ONLY ao browser do dono (REGRA Nº 12).
//
// Liga-se a um alvo JA EXISTENTE pelo relay do OMP (default ws://127.0.0.1:9224/cdp)
// e NAO cria nem fecha janelas — quem abre e fecha e' o bg-window.py do manager, que
// devolve o foco ao dono e verifica o alpha-0. Aqui so' se LE.
//
// A prova de travamento e' esta: um main thread bloqueado nao responde a
// Runtime.evaluate. CPU alta e' indicio; ausencia de resposta e' prova.
//
// Receita completa (REGRA Nº 12):
//   python I:\!manager\tools\bg-window.py open --url https://lolidle.com/jogar --label sonda
//   node tools\_sonda-alvo.mjs <target_id> 15
//   python I:\!manager\tools\bg-window.py close --target <target_id>
//
// Uso: node tools/_sonda-alvo.mjs <targetId> [segundos=15]

const WS = process.env.CDP_WS || 'ws://127.0.0.1:9224/cdp'
const ALVO = process.argv[2]
const SEGS = Number(process.argv[3] || 15)
if (!ALVO) {
  console.log('uso: node tools/_sonda-alvo.mjs <targetId> [segundos]')
  process.exit(1)
}

const ws = new WebSocket(WS)
let id = 0
const pending = new Map()
const sleep = ms => new Promise(r => setTimeout(r, ms))

function send(method, params = {}, sessionId, timeout = 12000) {
  const i = ++id
  const msg = { id: i, method, params }
  if (sessionId) msg.sessionId = sessionId
  ws.send(JSON.stringify(msg))
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pending.delete(i); rej(new Error('timeout ' + method)) }, timeout)
    pending.set(i, { res: v => { clearTimeout(t); res(v) }, rej: e => { clearTimeout(t); rej(e) } })
  })
}

ws.onmessage = ev => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id)
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m)
  }
}
ws.onerror = e => { console.log('WS ERR', e.message || e); process.exit(1) }

// Marcadores discriminantes (REGRA Nº 4). `pulsoFix` e `painel` so' existem no
// codigo novo: servem para saber QUAL versao/variante esta' a correr.
const MARCAR = `(function(){try{return {
  href: location.href, titulo: document.title, ready: document.readyState,
  escondida: document.hidden, visib: document.visibilityState,
  pulsoFix: window.__lolidlePulsoFix === true ? true : String(window.__lolidlePulsoFix),
  painel: !!document.getElementById('lolidle-ap'),
  fase: (document.getElementById('ap-fase')||{}).textContent || null,
  canvas: !!document.querySelector('canvas'),
}}catch(e){return {erro:String(e)}}})()`

async function marcar(sid, rotulo) {
  try {
    const v = (await send('Runtime.evaluate', { expression: MARCAR, returnByValue: true }, sid, 6000)).result?.result?.value
    console.log(rotulo + ':', JSON.stringify(v))
  } catch {
    console.log(rotulo + ': SEM RESPOSTA (thread bloqueado)')
  }
}

ws.onopen = async () => {
  try {
    const a = await send('Target.attachToTarget', { targetId: ALVO, flatten: true })
    const sid = a.result?.sessionId
    if (!sid) throw new Error('sem sessionId: ' + JSON.stringify(a))
    await send('Runtime.enable', {}, sid)

    for (let i = 0; i < 40; i++) {
      const h = (await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true }, sid, 3000).catch(() => ({}))).result?.result?.value || ''
      if (h && h !== 'about:blank') break
      await sleep(250)
    }
    await sleep(1000)
    await marcar(sid, 'marcadores')

    let bloqueios = 0
    for (let s = 0; s < SEGS; s++) {
      const t0 = Date.now()
      let live = true, err = null
      try { await send('Runtime.evaluate', { expression: '1+1', returnByValue: true }, sid, 2500) }
      catch (e) { live = false; err = e.message }
      const dt = Date.now() - t0
      if (!live) { bloqueios++; console.log(`t=${s}s BLOQUEADO (${dt}ms ${err})`) }
      else if (dt > 400) console.log(`t=${s}s lento ${dt}ms`)
      await sleep(Math.max(0, 900 - dt))
    }
    console.log(`---- ${bloqueios}/${SEGS} bloqueios ----`)
    await marcar(sid, 'marcadores no fim')
  } catch (e) {
    console.log('ERRO:', e.message)
  } finally {
    // NAO se fecha o alvo: a janela e' do bg-window.py. So' se larga a sessao.
    try { ws.close() } catch { /* ignore */ }
    process.exit(0)
  }
}
setTimeout(() => { console.log('watchdog'); process.exit(2) }, (SEGS * 5 + 60) * 1000)
