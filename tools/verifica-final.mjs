// verifica-final.mjs — prova AO VIVO com MARCADOR DISCRIMINANTE (Regra Nº 4).
// 1) recarrega a pagina (ignoreCache) -> reinjecta os content scripts do disco
// 2) pede a meta -> marcador: rmMonstro + curvaPorNivel (so existem no inject.js NOVO)
// 3) escuta 'estado' -> marcador: tipo de mensagem que so o inject.js NOVO publica
// 4) le o log duas vezes -> o auto-play continua a matar
// Uso: bun tools/verifica-final.mjs [--target <id>]
const CDP = 'ws://127.0.0.1:9224/cdp';
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
let ws, id = 0; const pend = new Map();
const send = (method, params, sid) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify(sid ? { id: i, method, params: params || {}, sessionId: sid } : { id: i, method, params: params || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, 15000); });
(async () => {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay offline')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('relay offline')); }, { once: true }); });
  const pages = (await send('Target.getTargets')).result.targetInfos.filter(t => t.type === 'page');
  const alvo = arg('--target') || pages.filter(p => (p.url || '').includes('lolidle')).sort((a, b) => (b.url || '').length - (a.url || '').length)[0]?.targetId;
  if (!alvo) { console.log(JSON.stringify({ ok: false, erro: 'sem aba do jogo' })); process.exit(1); }
  const sess = (await send('Target.attachToTarget', { targetId: alvo, flatten: true })).result.sessionId;
  await send('Runtime.enable', {}, sess);
  const ev = async (e, espera) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: !!espera, userGesture: true }, sess); if (r.result && r.result.exceptionDetails) throw new Error(String(r.result.exceptionDetails.text)); return r.result?.result?.value; };
  const fora = { ok: false, passos: {} };
  fora.passos.recarregar = (await send('Page.reload', { ignoreCache: true }, sess)).result ? 'enviado' : 'FALHOU';
  await new Promise(r => setTimeout(r, 6000));
  fora.passos.pronto = await ev('document.readyState');
  const metaExpr = "(async () => { const vistos = []; const l = (e) => { if (e.data && e.data.__lolidleAuto === 'meta') vistos.push(e.data); }; window.addEventListener('message', l); window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*'); await new Promise(r => setTimeout(r, 1500)); window.removeEventListener('message', l); const m = vistos[0]; return JSON.stringify(m ? { chaves: Object.keys(m).sort(), rmMonstro: m.rmMonstro ?? null, curvaPorNivel29: m.curvaPorNivel ? (m.curvaPorNivel[29] ? m.curvaPorNivel[29].hp : 'sem-29') : null } : null); })()";
  const meta = JSON.parse(await ev(metaExpr, true) || 'null');
  fora.passos.meta = meta;
  fora.MARCADOR_1_rmMonstro = !!(meta && meta.rmMonstro === 0.6);
  fora.MARCADOR_2_curvaPorNivel = !!(meta && meta.curvaPorNivel29 && Number.isFinite(meta.curvaPorNivel29));
  const estExpr = "(async () => { const vistos = []; const l = (e) => { if (e.data && e.data.__lolidleAuto) vistos.push(e.data.__lolidleAuto); }; window.addEventListener('message', l); await new Promise(r => setTimeout(r, 2500)); window.removeEventListener('message', l); return JSON.stringify({ tipos: [...new Set(vistos)], estado: vistos.includes('estado'), combate: vistos.includes('combate') }); })()";
  const est = JSON.parse(await ev(estExpr, true) || '{}');
  fora.passos.mensagens = est;
  fora.MARCADOR_3_estado = !!est.estado;
  const log1 = await ev("(document.querySelector('#log')||{}).textContent||''");
  await new Promise(r => setTimeout(r, 8000));
  const log2 = await ev("(document.querySelector('#log')||{}).textContent||''");
  fora.passos.autoPlayVivo = !!(log2 && log2.length > (log1 || '').length);
  fora.passos.logCauda = String(log2 || '').slice(-160);
  const gui = await ev("JSON.stringify(Object.keys(window).filter(k => /lolidle/i.test(k)).slice(0,5) + '|ids:' + [...document.querySelectorAll('[id^=lolidle],[id^=ap-auto],[id^=auto-]')].map(e => e.id).slice(0,8).join(','))");
  fora.passos.gui = gui;
  fora.ok = fora.MARCADOR_1_rmMonstro && fora.MARCADOR_2_curvaPorNivel && fora.MARCADOR_3_estado && fora.passos.autoPlayVivo;
  console.log(JSON.stringify(fora, null, 1));
  ws.close(); process.exit(fora.ok ? 0 : 2);
})().catch(e => { console.log(JSON.stringify({ ok: false, erro: e.message })); process.exit(1); });