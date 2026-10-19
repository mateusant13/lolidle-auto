// Prova AO VIVO (Regra 4): recarrega a pagina lolidle e le MARCADORES DISCRIMINANTES do codigo novo.
const BASE = 'http://127.0.0.1:9224';
const list = await (await fetch(BASE + '/json/list')).json();
const alvo = list.find((t) => t.type === 'page' && /lolidle\.com/.test(t.url || ''));
if (!alvo) { console.log(JSON.stringify({ ok: false, motivo: 'sem aba lolidle' })); process.exit(2); }
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map(); let ctxs = [];
const send = (m, p, s) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify(s ? { id: i, method: m, params: p, sessionId: s } : { id: i, method: m, params: p })); });
ws.addEventListener('message', (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const { targetInfos } = await send('Target.getTargets');
const t = targetInfos.find((x) => /lolidle\.com/.test(x.url || ''));
const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
const s = att.sessionId;
await send('Page.enable', {}, s);
await send('Runtime.enable', {}, s);
await send('Page.reload', { ignoreCache: true }, s);
await new Promise((r) => setTimeout(r, 6000));
let cid = null; const t0 = Date.now();
while (Date.now() - t0 < 20000 && !cid) {
  for (const c of ctxs.slice()) {
    try { const r = await send('Runtime.evaluate', { expression: 'typeof window.__lolidleAuto', contextId: c.id, returnByValue: true }, s); if (r && r.result && r.result.value === 'object') { cid = c.id; break; } } catch { /* */ }
  }
  if (!cid) await new Promise((r) => setTimeout(r, 500));
}
if (!cid) { console.log(JSON.stringify({ ok: false, motivo: 'sem contexto do motor' })); process.exit(3); }
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, contextId: cid, returnByValue: true, awaitPromise: true }, s); if (r && r.exceptionDetails) return { erro: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'erro' }; return r && r.result ? r.result.value : undefined; };
const out = await ev(`JSON.stringify((function(){
  var m = window.__lolidleAuto;
  var cfg = m.getConfig ? m.getConfig() : {};
  // marcadores DISCRIMINANTES: so existem no codigo novo
  var temMercadoPre = typeof m.mercadoTemDaBuild === 'function' && typeof m.atualizarMercadoServidor === 'function';
  var build = {}; try { build.mobs = m.buildIdeal('mobs'); } catch(e){ build.mobs = String(e); }
  var barra = null; try { barra = m.barraIdeal(null, 'mobs', false); } catch(e){ barra = String(e); }
  var barraDificil = null; try { barraDificil = m.barraIdeal(null, 'mobs', true); } catch(e){ barraDificil = String(e); }
  var pode = {}; try { pode.comprar = m.podeFazer('comprar'); } catch(e){ pode.comprar = String(e); }
  var temArv = false; try { temArv = m.arvoreInterruptores().some(function(x){ return x.nome==='comprar' && x.temExcecao; }); } catch(e){}
  return { ok: true, campo: cfg.champAlvo, enabled: cfg.enabled, ultEmMobs: cfg.ultEmMobs, barraPorDisponibilidade: cfg.barraPorDisponibilidade,
    marcador_mercadoPre: temMercadoPre, marcador_comprarExcecao: temArv, buildMobs: build.mobs,
    barraMobsFacil: barra, barraMobsDificil: barraDificil, podeComprar: pode.comprar };
})())`);
const r = JSON.parse(out);
// Julga os marcadores (o 1.o objeto `valor` do err do Page.reload foi ignorado de propósito)
const ok = r.marcador_mercadoPre === true && r.marcador_comprarExcecao === true
  && Array.isArray(r.barraMobsFacil) && r.barraMobsFacil.indexOf('R') < 0
  && Array.isArray(r.barraMobsDificil) && r.barraMobsDificil.indexOf('R') >= 0;
console.log(JSON.stringify({ prova: ok ? 'OK' : 'FALHOU', ...r }));
process.exit(ok ? 0 : 1);
