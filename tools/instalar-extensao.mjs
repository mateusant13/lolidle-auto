#!/usr/bin/env bun
// instalar-extensao.mjs — carrega/verifica a extensao no Chrome do dono.
//
// Uso:
//   bun tools/instalar-extensao.mjs              # carrega + liga o auto-play
//   bun tools/instalar-extensao.mjs --verificar  # so verifica o estado
//
// REQUISITO: o Chrome tem de ter --remote-debugging-port=9224 (CDP do PROPRIO Chrome).
//   O CDP do relay NAO tem o dominio Extensions (devolve -32601).
//   O relay usa-se para outra coisa: ver docs/COMO-USAR-O-BROWSER.md

import fs from 'node:fs';

const PORTA = process.env.LL_PORTA || '9224';
const EXT = process.env.LL_EXT || 'I:\\!lolidle.com\\extension';
const ID = 'pbdlekcgmpippamdkgbaphcppjafobjo';
const soVerificar = process.argv.includes('--verificar');

function falar(ms) { return new Promise(r => setTimeout(r, ms)); }

async function versao() {
  try {
    const r = await fetch('http://127.0.0.1:' + PORTA + '/json/version');
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

function ligar(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0; const pend = new Map();
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    });
    ws.addEventListener('open', () => res({
      ws,
      send: (method, params, sessionId) => new Promise(r => {
        const i = ++id; pend.set(i, r);
        ws.send(JSON.stringify(sessionId ? { id: i, method, params: params || {}, sessionId } : { id: i, method, params: params || {} }));
        setTimeout(() => r({ __t: true }), 15000);
      }),
    }));
    ws.addEventListener('error', () => rej(new Error('nao liguei a ' + url)));
  });
}

const v = await versao();
if (!v) {
  console.log('CDP do Chrome OFFLINE em ' + PORTA);
  console.log('O Chrome tem de ser arrancado com --remote-debugging-port=' + PORTA);
  console.log('(o CDP do relay nao serve: nao tem o dominio Extensions)');
  process.exit(1);
}
console.log('Chrome: ' + v.Browser);
if (!v.webSocketDebuggerUrl) { console.log('sem webSocketDebuggerUrl'); process.exit(1); }

const cdp = await ligar(v.webSocketDebuggerUrl);
console.log('ligado ao CDP do Chrome');

if (!soVerificar) {
  const r = await cdp.send('Extensions.loadUnpacked', { path: EXT });
  const id = r.result && r.result.id;
  console.log('Extensions.loadUnpacked -> ' + (id ? id : JSON.stringify(r.error || r).slice(0, 120)));
  if (id && id !== ID) console.log('ATENCAO: id diferente do esperado (' + ID + ')');
  await falar(3000);
} else {
  console.log('(--verificar: nao carrego nada)');
}

// procurar a aba do jogo (ou abrir uma)
let list = await (await fetch('http://127.0.0.1:' + PORTA + '/json/list')).json();
let pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) {
  console.log('sem aba do jogo; a abrir uma...');
  const nt = await cdp.send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
  const tid = nt.result && nt.result.targetId;
  await falar(15000);
  list = await (await fetch('http://127.0.0.1:' + PORTA + '/json/list')).json();
  pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || (tid ? { targetId: tid, url: 'nova' } : null);
}
if (!pg) { console.log('nao consegui obter a aba do jogo'); process.exit(1); }

const sess = await cdp.send('Target.attachToTarget', { targetId: pg.targetId || pg.id, flatten: true });
const s = sess.result && sess.result.sessionId;
if (!s) { console.log('attach falhou'); process.exit(1); }
await cdp.send('Runtime.enable', {}, s);

// recarregar para os content scripts injectarem (loadUnpacked so age em paginas novas)
if (!soVerificar) { await cdp.send('Page.enable', {}, s); await cdp.send('Page.reload', { ignoreCache: true }, s); await falar(14000); }

// procurar o contexto da extensao
const ctxs = [];
cdp.ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context);
});
await cdp.send('Runtime.enable', {}, s);
await falar(2500);

const ext = ctxs.find(c => new RegExp('^chrome-extension://' + ID).test(c.origin || '')) ||
            ctxs.find(c => /^chrome-extension:/.test(c.origin || ''));
console.log('contextos: ' + ctxs.map(c => (c.origin || '?').slice(0, 34)).join(' | ').slice(0, 200));
if (!ext) {
  console.log('EXTENSAO NAO INJECTADA. Causa mais provavel: Modo de programador DESLIGADO.');
  console.log('Solucao: chrome://extensions -> Modo de programador -> ligar "' + 'LoL Idle' + '" -> F5');
  process.exit(2);
}
console.log('EXTENSAO INJECTADA: ' + ext.origin);

const st = await cdp.send('Runtime.evaluate', {
  contextId: ext.id, returnByValue: true, awaitPromise: true,
  expression: "(function(){ var A = window.__lolidleAuto; if (!A) return JSON.stringify({erro:'sem motor'}); var c = A.getConfig(); var rank=[]; try { rank = (A.rankRegioes()||[]).filter(function(x){return x.sobrevive;}).slice(0,3).map(function(x){return x.id+':'+x.score;}); } catch(e){} return JSON.stringify({ enabled: c.enabled, regiao: c.regionDefault, objetivo: c.objetivo, sobrevive: rank }); })()"
});
console.log('ESTADO: ' + (st.__t ? 'sem resposta' : String(st.result && st.result.result && st.result.result.value)));

if (!soVerificar) {
  const set = await cdp.send('Runtime.evaluate', {
    contextId: ext.id, returnByValue: true, awaitPromise: true,
    expression: "(function(){ var A = window.__lolidleAuto; A.setConfig({ enabled: true, regionDefault: 'rota-sup' }); var c = A.getConfig(); return JSON.stringify({ enabled: c.enabled, regiao: c.regionDefault }); })()"
  });
  console.log('AUTO-PLAY LIGADO: ' + (set.__t ? 'sem resposta' : String(set.result && set.result.result && set.result.result.value)));
}

cdp.ws.close();
console.log('feito.');
process.exit(0);
