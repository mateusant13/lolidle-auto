#!/usr/bin/env node
/*
 * _tk02-gui-prova.mjs — PROVA de DOM/browser da TK-02 (extension/gui.js).
 *
 * Corre o ficheiro REAL (extension/gui.js) dentro do Chrome, com o motor (`window.__lolidleAuto`)
 * STUBADO por dois contratos distintos, e afirma o comportamento pelo DOM que a GUI desenha:
 *
 *   CASO A — "motor novo" (contrato do TK-01): todo o nó tem `cfg` própria. Prova:
 *     • `#ap-t-painel.on` desenha DUAS colunas (computed `grid-template-columns`);
 *     • `cfg.autoVender=false` -> o switch `#ap-cfg-autoVender` aparece DESLIGADO;
 *     • o `change` desse switch chama `setConfig({autoVender:true})` (handler genérico `data-cfg`);
 *     • `main.scrollTop` volta a 0 ao abrir o painel E ao trocar de aba (com o `main` rolável);
 *     • não existe a palavra "implícito" em NENHUM texto desenhado;
 *     • o cartão mestre existe (`#ap-mestre`) e mostra LIGADO.
 *   CASO B — "motor antigo": um nó vem com `cfg:null`. Prova:
 *     • a árvore mostra ERRO ("motor antigo: recarregue"), nunca um badge "implícito";
 *     • o cartão "Automatismos do motor" mostra `<div class="erro-motor">` para esse nó.
 *
 * PERFIL DE LABORATÓRIO (dir próprio, porta própria) — o browser do dono NUNCA é tocado
 * (AGENTS.md REGRA Nº 9/11/12). Sem relay, sem `Target.createTarget` no perfil real.
 *
 *   node tools/_tk02-gui-prova.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUI = path.join(RAIZ, 'extension', 'gui.js');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LAB = 'G:\\Temp\\opencode\\tk02-gui-lab';           // perfil PRÓPRIO (nunca o do dono)
const OUT = 'G:\\Temp\\opencode';
const PORT = 9444;

const guiSrc = readFileSync(GUI, 'utf8');

// ---------------------------------------------------------------- páginas
/** Página com o `chrome`/motor stubados ANTES do gui.js. */
function pagina(motorJs, nome) {
  return '<!doctype html><html lang="pt"><head><meta charset="utf-8">'
    + '<title>TK-02 gui prova ' + nome + '</title></head><body>'
    + '<script>\n'
    // --- stub do chrome (storage + runtime): o mínimo que o gui.js usa no arranque
    + 'window.__cfg = ' + JSON.stringify({
      enabled: true, manutencao: true, autoVender: false, autoRepor: true, autoCofre: true,
      autoAnunciar: true, autoHab: true, autoIrBase: true, autoAtrib: false, autoEquip: true,
      autoRefino: true, autoMontar: true, autoComprar: true, autoVigiarMercado: true,
      fugir: true, buildPorFase: false, skillsPorFase: true, rotacaoSkills: true,
      trocaItens: false, barraPorDisponibilidade: true, objetivo: 'xp', regionDefault: null,
    }) + ';\n'
    + 'window.__setConfigLog = [];\n'
    + 'window.chrome = { storage: { local: {'
    + '  get: function (k, cb) { var out = {}; var ks = Array.isArray(k) ? k : [k];'
    + '    for (var i = 0; i < ks.length; i++) out[ks[i]] = (ks[i] === "lolidleAutoPotion") ? window.__cfg : undefined;'
    + '    if (typeof cb === "function") setTimeout(function () { cb(out); }, 0); },'
    + '  set: function (o, cb) { if (typeof cb === "function") setTimeout(cb, 0); } },'
    + '  onChanged: { addListener: function () {} } },'
    + '  runtime: { id: "prova", sendMessage: function () { return Promise.resolve({}); } } };\n'
    // --- stub do MOTOR (o contrato varia por caso)
    + motorJs + '\n'
    + '</script>\n'
    // --- o ficheiro REAL, sem alterações
    + '<script>\n' + guiSrc + '\n</script>\n'
    + '</body></html>';
}

const NOVO = `window.__lolidleAuto = {
  getConfig: function () { return window.__cfg; },
  setConfig: function (patch) {
    window.__setConfigLog.push(JSON.parse(JSON.stringify(patch)));
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) window.__cfg[k] = patch[k];
    return window.__cfg;
  },
  estaPausado: function () { return false; },
  estado: function () { return { regiaoRecomendada: 'cy-3' }; },
  regiaoIdeal: function () { return 'cy-3'; },
  getMeta: function () { return { itens: [], locais: [{ id: 'cy-3', nome: 'CY-3' }] }; },
  rankRegioes: function () { return [{ id: 'cy-3', nome: 'CY-3', xpMin: 100, goldMin: 100 }]; },
  campeoesDoJogo: function () { return []; },
  campeoesAlvo: function () { return []; },
  arvoreInterruptores: function () {
    var N = function (nome, pai, cfg) { return { nome: nome, pai: pai, cfg: cfg, temExcecao: false, excecaoTxt: null, pode: true, porque: null }; };
    return [
      N('manutencao', null, 'manutencao'),
      { nome: 'autoplay', pai: null, cfg: 'enabled', temExcecao: true, excecaoTxt: 'so corre no campeao alvo', pode: true, porque: null },
      N('irBase', 'manutencao', 'autoIrBase'),
      N('vender', 'irBase', 'autoVender'),
      N('repor', 'irBase', 'autoRepor'),
      N('cofre', 'irBase', 'autoCofre'),
      N('anunciar', 'manutencao', 'autoAnunciar'),
      N('hab', 'manutencao', 'autoHab'),
      N('equip', 'manutencao', 'autoEquip'),
      N('atrib', 'manutencao', 'autoAtrib'),
      N('refino', 'irBase', 'autoRefino')
    ];
  }
};`;

const ANTIGO = `window.__lolidleAuto = {
  getConfig: function () { return window.__cfg; },
  setConfig: function (patch) { window.__setConfigLog.push(JSON.parse(JSON.stringify(patch))); return window.__cfg; },
  estaPausado: function () { return false; },
  estado: function () { return {}; },
  regiaoIdeal: function () { return null; },
  getMeta: function () { return { itens: [], locais: [] }; },
  rankRegioes: function () { return []; },
  campeoesDoJogo: function () { return []; },
  campeoesAlvo: function () { return []; },
  arvoreInterruptores: function () {
    return [
      { nome: 'manutencao', pai: null, cfg: 'manutencao', temExcecao: false, excecaoTxt: null, pode: true, porque: null },
      { nome: 'autoplay', pai: null, cfg: 'enabled', temExcecao: true, excecaoTxt: 'so corre no campeao alvo', pode: true, porque: null },
      { nome: 'vender', pai: 'manutencao', cfg: null, temExcecao: false, excecaoTxt: null, pode: true, porque: null },
      { nome: 'repor', pai: 'manutencao', cfg: null, temExcecao: false, excecaoTxt: null, pode: true, porque: null }
    ];
  }
};`;

// ---------------------------------------------------------------- assertivas (correm no browser)
const ASSERT_A = `(function () {
  var out = {};
  var G = window.__lolidleGui;
  if (!G) return JSON.stringify({ erro: 'gui nao carregou' });
  G.setTab('painel'); G.abrir();
  var painel = document.getElementById('lolidle-ap');
  out.aberto = !!(painel && painel.classList.contains('on'));

  // 1) DUAS COLUNAS
  var t = document.getElementById('ap-t-painel');
  var cs = getComputedStyle(t);
  out.display = cs.display;
  out.colunas = cs.gridTemplateColumns;
  out.nColunas = cs.gridTemplateColumns.split(' ').filter(Boolean).length;

  // 2) NADA DE "implícito" desenhado
  out.temImplicito = /impl[íi]cito/i.test(painel.textContent);

  // 3) MESTRE (um só controlo)
  var mestre = document.getElementById('ap-mestre');
  out.mestreExiste = !!mestre;
  out.mestreChecked = mestre ? mestre.checked : null;
  var est = document.querySelector('#ap-painel-estado .mestre-est');
  out.mestreTexto = est ? est.textContent : null;
  out.nMestres = document.querySelectorAll('#lolidle-ap input[type=checkbox][id=ap-mestre]').length;

  // 4) SWITCH REAL do motor: autoVender=false -> desligado; change -> setConfig
  var sw = document.getElementById('ap-cfg-autoVender');
  out.swExiste = !!sw;
  out.swCheckedAntes = sw ? sw.checked : null;
  out.swDataCfg = sw ? sw.dataset.cfg : null;
  window.__setConfigLog.length = 0;
  if (sw) { sw.checked = true; sw.dispatchEvent(new Event('change', { bubbles: true })); }
  out.setConfigLog = JSON.parse(JSON.stringify(window.__setConfigLog));
  out.cfgAutoVenderDepois = window.__cfg.autoVender;

  // 5) SCROLL: ao abrir e ao trocar de aba o main volta ao topo
  var main = painel.querySelector('main');
  main.scrollTop = 500;
  out.scrollAntesAbrir = main.scrollTop;
  G.abrir();
  out.scrollAposAbrir = main.scrollTop;
  main.scrollTop = 500;
  out.scrollAntesSetTab = main.scrollTop;
  G.setTab('itens');
  out.scrollAposSetTab = main.scrollTop;
  out.abaAtiva = (document.querySelector('#lolidle-ap .tab.ativa') || {}).dataset
    ? document.querySelector('#lolidle-ap .tab.ativa').dataset.tab : null;
  G.setTab('painel');
  return JSON.stringify(out);
})()`;

const ASSERT_B = `(function () {
  var out = {};
  var G = window.__lolidleGui;
  if (!G) return JSON.stringify({ erro: 'gui nao carregou' });
  G.setTab('painel'); G.abrir();
  var painel = document.getElementById('lolidle-ap');
  var arv = document.getElementById('ap-auto-arvore');
  var ext = document.getElementById('ap-auto-extras');
  out.arvTexto = arv ? arv.textContent.slice(0, 400) : null;
  out.arvErro = arv ? /motor antigo: recarregue/.test(arv.textContent) : false;
  out.arvImplicito = arv ? /impl[íi]cito/i.test(arv.textContent) : null;
  out.arvErroSpans = document.querySelectorAll('#ap-auto-arvore .arv-erro').length;
  out.extTexto = ext ? ext.textContent.slice(0, 400) : null;
  out.extErro = ext ? /motor antigo: recarregue/.test(ext.textContent) : false;
  out.erroMotorDivs = document.querySelectorAll('#ap-auto-extras .erro-motor').length;
  out.painelImplicito = /impl[íi]cito/i.test(painel.textContent);
  return JSON.stringify(out);
})()`;

// ---------------------------------------------------------------- cliente CDP mínimo
function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0; const pend = new Map();
  const send = (method, params, sid, ms) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, { res, rej });
    ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
    if (ms) setTimeout(() => { if (pend.has(i)) { pend.delete(i); rej(new Error('timeout ' + method)); } }, ms);
  });
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  });
  return { ws, send, aberto: new Promise((r) => ws.addEventListener('open', r, { once: true })) };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarPorta(ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try { const j = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json(); if (j.webSocketDebuggerUrl) return j; } catch { /* ainda não */ }
    await espera(250);
  }
  return null;
}

/** Abre um alvo file://, corre a assertiva e (opcionalmente) tira print. */
async function caso(c, html, nome, assertiva, shot) {
  const f = path.join(OUT, 'tk02-gui-' + nome + '.html');
  writeFileSync(f, html, 'utf8');
  const t = await c.send('Target.createTarget', { url: 'file:///' + f.replace(/\\/g, '/') });
  const att = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  const sess = att.sessionId;
  await c.send('Runtime.enable', {}, sess);
  await c.send('Page.enable', {}, sess);
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 400, deviceScaleFactor: 1, mobile: false }, sess);
  // espera o gui.js arrancar
  let pronto = false;
  for (let i = 0; i < 40 && !pronto; i++) {
    await espera(150);
    try {
      const r = await c.send('Runtime.evaluate', { expression: 'typeof window.__lolidleGui', returnByValue: true }, sess, 4000);
      pronto = r && r.result && r.result.value === 'object';
    } catch { /* ainda não */ }
  }
  const r = await c.send('Runtime.evaluate', { expression: assertiva, returnByValue: true, awaitPromise: false }, sess, 15000);
  const out = JSON.parse(r.result.value);
  if (shot) {
    // print com a janela mais alta: mostra o Painel em 2 colunas a partir do topo
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false }, sess);
    await c.send('Runtime.evaluate', { expression: "window.__lolidleGui.setTab('painel');window.__lolidleGui.abrir();", returnByValue: true }, sess, 8000);
    await espera(400);
    const s = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sess, 20000);
    writeFileSync(path.join(OUT, shot), Buffer.from(s.data, 'base64'));
    out.screenshot = path.join(OUT, shot);
  }
  await c.send('Target.closeTarget', { targetId: t.targetId });
  return out;
}

// ---------------------------------------------------------------- corre
let falhas = 0;
const check = (rot, cond, detalhe) => {
  if (cond) console.log('  OK   ' + rot);
  else { falhas++; console.log('  FALHA ' + rot + (detalhe != null ? '  -> ' + JSON.stringify(detalhe) : '')); }
};

mkdirSync(LAB, { recursive: true });
mkdirSync(OUT, { recursive: true });
const proc = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + LAB,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1400,900',
  'about:blank',
], { stdio: 'ignore' });

try {
  const ver = await esperarPorta(20000);
  if (!ver) { console.log('NAO PROVADO: chrome de laboratorio nao arrancou'); process.exit(3); }
  console.log('chrome lab:', ver.Browser);

  const c = cdp(ver.webSocketDebuggerUrl);
  await c.aberto;

  console.log('\nCASO A - motor NOVO (contrato TK-01)');
  const A = await caso(c, pagina(NOVO, 'novo'), 'novo', ASSERT_A, 'tk02-gui-painel-2col.png');
  console.log('  ' + JSON.stringify(A));
  check('painel abriu', A.aberto === true, A.aberto);
  check('Painel em DUAS colunas (grid)', A.display === 'grid' && A.nColunas === 2, { display: A.display, colunas: A.colunas });
  check('sem a palavra "implícito" desenhada', A.temImplicito === false, A.temImplicito);
  check('um só interruptor mestre (#ap-mestre)', A.mestreExiste === true && A.nMestres === 1, { existe: A.mestreExiste, n: A.nMestres });
  check('mestre mostra LIGADO', A.mestreTexto === 'LIGADO', A.mestreTexto);
  check('switch autoVender existe e aparece DESLIGADO', A.swExiste === true && A.swCheckedAntes === false, { existe: A.swExiste, checked: A.swCheckedAntes });
  check('switch autoVender lê a chave do motor (data-cfg)', A.swDataCfg === 'autoVender', A.swDataCfg);
  check('change do switch escreve pelo motor setConfig({autoVender:true})',
    Array.isArray(A.setConfigLog) && A.setConfigLog.length === 1 && A.setConfigLog[0].autoVender === true, A.setConfigLog);
  check('main rolável antes do reset (a prova não é vazia)', A.scrollAntesAbrir > 0, A.scrollAntesAbrir);
  check('scroll volta ao topo ao ABRIR', A.scrollAposAbrir === 0, A.scrollAposAbrir);
  check('scroll volta ao topo ao TROCAR DE ABA', A.scrollAposSetTab === 0, A.scrollAposSetTab);
  check('trocou mesmo de aba (itens)', A.abaAtiva === 'itens', A.abaAtiva);
  check('screenshot do Painel em 2 colunas', !!A.screenshot, A.screenshot);

  console.log('\nCASO B - motor ANTIGO (nó sem chave)');
  const B = await caso(c, pagina(ANTIGO, 'antigo'), 'antigo', ASSERT_B, null);
  console.log('  ' + JSON.stringify(B));
  check('árvore mostra ERRO "motor antigo: recarregue"', B.arvErro === true, B.arvTexto);
  check('árvore NÃO mostra "implícito"', B.arvImplicito === false, B.arvImplicito);
  check('árvore usa o marcador .arv-erro', B.arvErroSpans >= 1, B.arvErroSpans);
  check('cartão Automatismos mostra .erro-motor', B.erroMotorDivs >= 1, B.erroMotorDivs);
  check('cartão Automatismos diz "motor antigo: recarregue"', B.extErro === true, B.extTexto);
  check('nenhum "implícito" em todo o painel', B.painelImplicito === false, B.painelImplicito);
} finally {
  try { proc.kill(); } catch { /* ignore */ }
  await espera(600);
  try { rmSync(LAB, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log('\n' + (falhas ? 'RESULTADO: ' + falhas + ' FALHA(S)' : 'RESULTADO: TODAS AS PROVAS PASSARAM'));
process.exit(falhas ? 1 : 0);
