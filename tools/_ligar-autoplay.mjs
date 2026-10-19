// _ligar-autoplay.mjs — liga o AUTO-PLAY e prova, ao vivo, que a versão NOVA está a correr.
// Pelo relay OMP (CDP em 127.0.0.1:9224/cdp), SEM tocar no perfil/abas do dono (attach-only +
// Page.reload da PRÓPRIA aba do jogo). Marcador DISCRIMINANTE (REGRA N.º 4): as funções
// `campeoesDoJogo`/`campeoesAlvo`/`estadoCompleto` só existem no código NOVO.
//
//   node tools/_ligar-autoplay.mjs [--reload] [--off]
const BASE = 'http://127.0.0.1:9224';
const argv = process.argv.slice(2);
const RELOAD = argv.includes('--reload');
const OFF = argv.includes('--off');

const list = await (await fetch(BASE + '/json/list')).json();
const alvo = list.find((t) => t.type === 'page' && /lolidle\.com/.test(t.url || ''));
if (!alvo) { console.log('SEM TAB DO LOLIDLE'); process.exit(2); }
console.log('ALVO:', alvo.title, '|', alvo.url);

const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map(); let ctxs = []; let session = null;
const send = (method, params, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context);
  if (m.method === 'Runtime.executionContextsCleared') ctxs = [];
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

const { targetInfos } = await send('Target.getTargets');
const t = targetInfos.find((x) => /lolidle\.com/.test(x.url || ''));
const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
session = att.sessionId;
await send('Runtime.enable', {}, session);
await send('Page.enable', {}, session);

async function ctxAuto(timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    for (const c of ctxs.slice()) {
      try {
        const r = await send('Runtime.evaluate', { expression: 'typeof window.__lolidleAuto', contextId: c.id, returnByValue: true }, session);
        if (r && r.result && r.result.value === 'object') return c.id;
      } catch { /* contexto morto */ }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

async function evalIn(cid, expr) {
  const r = await send('Runtime.evaluate', { expression: expr, contextId: cid, returnByValue: true, awaitPromise: true }, session);
  if (r && r.exceptionDetails) return { erro: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || JSON.stringify(r.exceptionDetails) };
  return r && r.result ? r.result.value : undefined;
}

if (RELOAD) {
  console.log('A recarregar a aba do jogo...');
  await send('Page.reload', { ignoreCache: true }, session);
  await new Promise((r) => setTimeout(r, 2500));
  ctxs = ctxs.slice();               // contextsCleared ja limpou
  await send('Runtime.enable', {}, session);
}

const cid = await ctxAuto(20000);
if (!cid) { console.log('SEM CONTEXTO DA EXTENSAO (page pode precisar de reload manual)'); process.exit(3); }
console.log('CTX ext:', cid);

// MARCADOR DISCRIMINANTE: as funcoes novas do codigo desta sessao.
const marcador = await evalIn(cid, 'JSON.stringify({' +
  'campeoesDoJogo: typeof (window.__lolidleAuto && window.__lolidleAuto.campeoesDoJogo),' +
  'campeoesAlvo: typeof (window.__lolidleAuto && window.__lolidleAuto.campeoesAlvo),' +
  'estadoCompleto: typeof (window.__lolidleAuto && window.__lolidleAuto.estadoCompleto),' +
  'CFG_VER: window.__lolidleAuto && window.__lolidleAuto.CFG_VER' +
  '})');
console.log('MARCADOR:', marcador);

// Liga (ou desliga) o auto-play pelo MOTOR (persiste no chrome.storage).
const patch = OFF ? '{enabled:false}' : '{enabled:true}';
const res = await evalIn(cid, '(function(){ try { var m=window.__lolidleAuto; m.setConfig(' + patch + '); return JSON.stringify({ok:true, enabled:m.getConfig().enabled, alvo:m.campeoesAlvo(), jogadores:(m.campeoesDoJogo()||[]).map(function(c){return c.id;})}); } catch(e){ return JSON.stringify({ok:false, erro:String(e&&e.message||e)}); } })()');
console.log('SETCONFIG:', res);

// Deixa o motor correr e verifica o estado vivo (tick + estado completo gravado).
await new Promise((r) => setTimeout(r, 4000));
const saude = await evalIn(cid, 'JSON.stringify((function(){ try { var m=window.__lolidleAuto; var s=m.saudeAutoplay?m.saudeAutoplay():null; return { podeAgir:m.podeAgir?m.podeAgir():null, saude:s, alvo:m.campeoesAlvo(), ehAlvo:m.ehCampeaoAlvo?m.ehCampeaoAlvo():null }; } catch(e){ return {erro:String(e&&e.message||e)}; } })())');
console.log('SAUDE:', saude);
try {
  const est = await evalIn(cid, 'JSON.stringify((function(){ try { var e=window.__lolidleAuto.estadoCompleto(); return { at:e.at, campeao:e.campeao, alvo:e.alvo, nivel:e.nivel, ouro:e.ouro, local:e.local, inv:!!e.inventario, hab:!!e.habilidades, prox:e.proximoPasso && e.proximoPasso.regiao }; } catch(err){ return {erro:String(err&&err.message||err)}; } })())');
  console.log('ESTADO COMPLETO:', est);
} catch (e) { console.log('ESTADO COMPLETO: erro', e); }

const ok = /"campeoesDoJogo":"function"/.test(String(marcador)) && /"estadoCompleto":"function"/.test(String(marcador));

// GUI: os contentores do markup NOVO existem? (o markup e construido no arranque do gui.js,
// sem abrir o painel — logo da para provar sem mexer no ecra do dono.)
const gui = await evalIn(cid, 'JSON.stringify({' +
  'versao: (window.__lolidleGui && window.__lolidleGui.versao) || null,' +
  'champ: !!document.getElementById("ap-auto-champ"),' +
  'jogo: !!document.getElementById("ap-now-jogo"),' +
  'watch: !!document.getElementById("ap-mk-watch")' +
  '})');
console.log('GUI:', gui);

console.log(ok ? 'PROVA: codigo NOVO vivo (campeoesDoJogo + estadoCompleto sao function)' : 'NAO PROVADO: codigo novo ausente (reload necessario)');
process.exit(ok ? 0 : 3);
