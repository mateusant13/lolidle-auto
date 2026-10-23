// tools/_relay.mjs — CDP pelo relay OMP (ws://127.0.0.1:9224/cdp), ATTACH-ONLY.
//
// Porque existe: cada sonda deste repo repetia o mesmo bloco de WebSocket + mapa de promessas +
// recolha de contextos (o `_prova-live`, o `_prova-gui-abas`, o `_reload-extensao-relay`). Repetir
// isso 4x e' como os bugs de CDP se multiplicam. Aqui esta' a unica copia.
//
// Regras que este modulo ja' cumpre e que quem o usa herda:
//   - NUNCA cria alvos: so' `Target.attachToTarget` num alvo que JA existe (REGRA 12.2);
//   - NUNCA imprime `/json/list` nem titulos/URLs de abas que nao sejam o jogo (REGRA 11.1.5);
//   - o erro do socket rejeita as promessas pendentes (um reload mata o mundo, nao deixa o script pendurado).
//
// Uso:
//   import { estadoRelay, abrirJogo } from './_relay.mjs';
//   const est = await estadoRelay();                  // { ok, browser } sem abrir nada
//   const s = await abrirJogo();                      // { send, sessionId, contextos, fechar }
//   const v = await s.avaliar('1+1', s.contextoDaExtensao());

export const HTTP = process.env.RELAY_HTTP || 'http://127.0.0.1:9224';
export const WS = process.env.RELAY_WS || 'ws://127.0.0.1:9224/cdp';

/** true/false sem tocar em abas: /json/version devolve 200 com `ompRelayVersion` quando o prelude
 *  esta' ligado. 503 = prelude desligado; 404/timeout = servidor em baixo (REGRA 16). */
export async function estadoRelay() {
  try {
    const r = await fetch(HTTP + '/json/version', { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false, http: r.status };
    const j = await r.json();
    return { ok: true, browser: j.Browser || null, relay: j.ompRelayVersion || null };
  } catch (e) {
    return { ok: false, erro: String((e && e.message) || e) };
  }
}

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

/** Abre a sessao CDP e liga-se ao alvo do jogo que JA existe.
 *  Devolve tambem helpers: `avaliar(expr[, contextId])`, `contextoDaExtensao()`, `fechar()`. */
export async function abrirJogo({ esperaContextos = 1200 } = {}) {
  const ws = new WebSocket(WS);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('relay em baixo (' + WS + ')')), { once: true });
  });

  let seq = 0;
  const pend = new Map();
  const contextos = new Set();
  const send = (method, params = {}, sid) => new Promise((res, rej) => {
    const i = ++seq;
    pend.set(i, { res, rej });
    ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
  });
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id && pend.has(m.id)) {
      const p = pend.get(m.id); pend.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      return;
    }
    if (m.method === 'Runtime.executionContextCreated' && m.params && m.params.context) contextos.add(m.params.context);
    if (m.method === 'Runtime.executionContextDestroyed' && m.params) contextos.delete(m.params.executionContextId);
  });
  ws.addEventListener('close', () => {
    for (const [, p] of pend) p.rej(new Error('socket do relay fechou'));
    pend.clear();
  });

  const { targetInfos } = await send('Target.getTargets');
  const jogo = (targetInfos || []).find((x) => x.type === 'page' && /(^|\.)lolidle\.com/i.test(String(x.url || '').replace(/^https?:\/\//, '')));
  if (!jogo) { ws.close(); throw new Error('sem aba do jogo aberta (nada foi criado)'); }
  const { sessionId } = await send('Target.attachToTarget', { targetId: jogo.targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await dorme(esperaContextos);

  const avaliar = async (expression, contextId) => {
    const p = { expression, returnByValue: true, awaitPromise: true };
    if (contextId) p.contextId = contextId;
    try {
      const r = await send('Runtime.evaluate', p, sessionId);
      if (r && r.exceptionDetails) {
        const d = r.exceptionDetails;
        return { __erro: (d.exception && (d.exception.description || d.exception.value)) || d.text };
      }
      return r && r.result ? r.result.value : undefined;
    } catch (e) {
      // contexto destruido (navegacao/reload da extensao) ou sessao caida: e' um resultado, nao
      // uma excepcao que mata o processo.
      return { __erro: String((e && e.message) || e) };
    }
  };

  /** O mundo ISOLADO da nossa extensao: origem chrome-extension:// e `__lolidleAuto` objecto. */
  const contextoDaExtensao = async (tentativas = 12, pausa = 700) => {
    for (let i = 0; i < tentativas; i++) {
      for (const c of contextos) {
        if (!/^chrome-extension:\/\//i.test(c.origin || '')) continue;
        const t = await avaliar('typeof window.__lolidleAuto', c.id);
        if (t === 'object') return c.id;
      }
      await dorme(pausa);
    }
    return null;
  };

  return { ws, send, sessionId, targetId: jogo.targetId, contextos, avaliar, contextoDaExtensao, fechar: () => { try { ws.close(); } catch { /* ja' fechou */ } }, dorme };
}
