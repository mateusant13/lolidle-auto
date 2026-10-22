// tools/_prova-gui.mjs — prova ATTACH-ONLY do painel: abre-o e percorre as 9 abas (REGRA Nº 12).
//
// O `_sonda-alvo.mjs` prova que a CASCA nova esta no browser; este prova que os DESENHADORES
// correm em todas as abas (o revamp reescreveu a casca — um contentor perdido deixaria a aba
// vazia em silencio, porque `setHtml` nao rebenta quando o elemento nao existe).
//
// Nao cria nem fecha alvos: quem abre/fecha e' o bg-window.py do manager.
//
// Uso: node tools/_prova-gui.mjs <targetId>

const WS = process.env.CDP_WS || 'ws://127.0.0.1:9224/cdp'
const ALVO = process.argv[2]
if (!ALVO) { console.log('uso: node tools/_prova-gui.mjs <targetId>'); process.exit(1) }

const ws = new WebSocket(WS)
let id = 0
const pending = new Map()
const excecoes = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function send(method, params = {}, sessionId, timeout = 12000) {
  const i = ++id
  const msg = { id: i, method, params }
  if (sessionId) msg.sessionId = sessionId
  ws.send(JSON.stringify(msg))
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pending.delete(i); rej(new Error('timeout ' + method)) }, timeout)
    pending.set(i, { res: (v) => { clearTimeout(t); res(v) }, rej: (e) => { clearTimeout(t); rej(e) } })
  })
}

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params && m.params.exceptionDetails
    excecoes.push(String((d && (d.exception && d.exception.description || d.text)) || '?').slice(0, 240))
  }
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id)
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m)
  }
}
ws.onerror = (e) => { console.log('WS ERR', e.message || e); process.exit(1) }

const ABAS = ['painel', 'itens', 'mercado', 'macro', 'personagem', 'ganhos', 'historico', 'pocao', 'manual']

async function evalJs(sid, expression, timeout = 8000) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid, timeout)
  const res = r.result || {}
  if (res.exceptionDetails) throw new Error(String((res.exceptionDetails.exception && res.exceptionDetails.exception.description) || res.exceptionDetails.text))
  return res.result && res.result.value
}

ws.onopen = async () => {
  try {
    const a = await send('Target.attachToTarget', { targetId: ALVO, flatten: true })
    const sid = a.result && a.result.sessionId
    if (!sid) throw new Error('sem sessionId')
    await send('Runtime.enable', {}, sid)
    // espera a pagina estar pronta e o painel construido (o boot do gui.js corre no DOMContentLoaded)
    for (let i = 0; i < 40; i++) {
      const ok = await evalJs(sid, "document.readyState==='complete' && !!document.getElementById('lolidle-ap')").catch(() => false)
      if (ok) break
      await sleep(250)
    }
    const abriu = await evalJs(sid, "(function(){var p=document.getElementById('lolidle-ap');if(!p)return null;p.classList.add('on');return {abas:p.querySelectorAll('.tab').length,navSecs:p.querySelectorAll('.nav-sec').length};})()")
    console.log('painel:', JSON.stringify(abriu))
    const out = []
    for (const nome of ABAS) {
      const clicou = await evalJs(sid, "(function(){var b=document.querySelector('#lolidle-ap .tab[data-tab=\"" + nome + "\"]');if(!b)return false;b.click();return true;})()").catch(() => false)
      await sleep(400)
      const v = await evalJs(sid, "(function(){var p=document.querySelector('#lolidle-ap .pane.on');if(!p)return null;return {id:p.id,cards:p.querySelectorAll('.card').length,linhas:p.querySelectorAll('.ln,.tbl tr,.acoes .btn,.btn').length};})()").catch((e) => ({ erro: e.message }))
      out.push({ aba: nome, clicou, ...(v || {}) })
      console.log('aba ' + nome + ':', JSON.stringify(out[out.length - 1]))
    }
    console.log('excecoes=' + excecoes.length + (excecoes.length ? ' :: ' + excecoes.join(' | ') : ''))
    // MARCADOR DISCRIMINANTE da politica do cofre (ordem do dono, 2026-10-22): so existe no
    // codigo novo. O cartao da aba Itens continua no DOM depois de trocar de aba.
    const pol = await evalJs(sid, "(function(){var e=document.getElementById('ap-it-cofre');return !!(e&&String(e.textContent).indexOf('vai para o cofre')>=0&&String(e.textContent).indexOf('dar lugar a um A')>=0);})()").catch(() => false)
    console.log('politicaCofre:', pol)
    const vazias = out.filter((x) => !x || x.id !== 'ap-t-' + x.aba || !(x.cards > 0))
    console.log(vazias.length ? 'FALHA: aba(s) sem cartao: ' + vazias.map((x) => x.aba).join(',') : 'PROVA: as 9 abas desenharam pelo menos 1 cartao');
    process.exit(vazias.length || excecoes.length || !pol ? 3 : 0)
  } catch (e) {
    console.log('ERRO:', e.message)
    process.exit(2)
  } finally {
    try { ws.close() } catch { /* ignore */ }
  }
}
setTimeout(() => { console.log('watchdog'); process.exit(2) }, 120000)
