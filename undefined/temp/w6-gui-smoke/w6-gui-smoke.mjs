
/*
 * w6-gui-smoke.mjs — prova de render da GUI (extension/gui.js) SEM browser e SEM CDP.
 * Motor: o automation.js REAL, no mundo stubado do banco (tools/testes/dom-stub.mjs),
 * com fixtures de jogo montados (mochila, equipamento, poções, ouro, local, nível).
 * GUI: gui.js corre num mini-DOM proprio (com parser de HTML) dentro de um vm.
 * O motor real e a GUI partilham nada: a GUI fala com o motor por um PROXY.
 * Uso: bun w6-gui-smoke.mjs <caminho-do-gui.js>
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub-import.mjs';

const GUI = process.argv[2];
if (!GUI) { console.error('uso: bun w6-gui-smoke.mjs <gui.js>'); process.exit(2); }

/* ============================ MINI-DOM (mundo da GUI) ============================ */
const REG = new Map();          // id -> el
const DUPES = [];
function reg(el) { if (el && el.id) { if (REG.has(el.id) && REG.get(el.id) !== el) DUPES.push(el.id); REG.set(el.id, el); } }
const VOID = new Set(['img','input','br','hr','meta','link']);
let txtSeq = 0;
function mkText(t) { return { _txt: true, textContent: String(t) }; }
function parseHTML(html, parent) {
  const re = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  let m, last = 0;
  while ((m = re.exec(html))) {
    if (m.index > last) parent.appendChild(mkText(html.slice(last, m.index)));
    last = re.lastIndex;
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') continue;                       // fecha: ignorado (arvore feita por aninhamento simples)
    if (VOID.has(tag)) { const el = mkEl(tag); setAttrs(el, m[2] || ''); parent.appendChild(el); continue; }
    const el = mkEl(tag); setAttrs(el, m[2] || '');
    parent.appendChild(el);
    // fecha explicito na mesma tag? (<div ...></div>) — o regex acima só apanha a abertura
  }
  if (last < html.length) parent.appendChild(mkText(html.slice(last)));
}
function setAttrs(el, s) {
  const re = /([a-zA-Z_][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const k = m[1]; const v = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : ''));
    el.setAttribute(k, v);
    if (k === 'id') el.id = v;
    if (k === 'class') el.className = v;
    if (k === 'value') el.value = v;
    if (k === 'title') el.title = v;
    if (k === 'checked') el.checked = true;
    if (k === 'disabled') el.disabled = true;
    if (k === 'hidden') el.hidden = true;
    if (k.slice(0, 5) === 'data-') el.dataset[k.slice(5).replace(/-([a-z])/g, (x, c) => c.toUpperCase())] = v;
  }
}
function mkEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(), tag: String(tag || 'div').toLowerCase(),
    id: '', className: '', title: '', hidden: false, disabled: false, value: '', checked: false,
    style: {}, dataset: {}, children: [], parentNode: null, _attrs: {}, _raw: '', _listeners: {}, options: [],
    classList: null,
    appendChild(c) { c.parentNode = el; el.children.push(c); reg(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
    setAttribute(k, v) { el._attrs[k] = String(v); if (k === 'id') { el.id = String(v); reg(el); } },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k) ? el._attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k); },
    removeAttribute(k) { delete el._attrs[k]; },
    addEventListener(t, fn) { (el._listeners[t] = el._listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent() { return true; },
    click() { for (const fn of (el._listeners.click || [])) { try { fn({ target: el }); } catch (e) { ERROS.push('click ' + el.id + ': ' + e); } } return true; },
    closest() { return null; },
    matches() { return false; },
    contains() { return false; },
    focus() {}, blur() {}, remove() {},
    getBoundingClientRect() { return { width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }; },
    querySelector(sel) { return qsa(el, sel)[0] || null; },
    querySelectorAll(sel) { return qsa(el, sel); },
    get textContent() { return el.children.map((c) => c._txt ? c.textContent : c.textContent).join(''); },
    set textContent(v) { el.children = [mkText(v)]; },
    get innerHTML() { return el._raw; },
    set innerHTML(v) { el._raw = String(v); el.children = []; parseHTML(String(v), el); },
    get outerHTML() { return '<' + el.tag + ' id="' + el.id + '">' + el._raw + '</' + el.tag + '>'; },
  };
  const cs = new Set(String(el.className).split(/\s+/).filter(Boolean));
  el.classList = {
    add(c) { cs.add(c); el.className = [...cs].join(' '); },
    remove(c) { cs.delete(c); el.className = [...cs].join(' '); },
    toggle(c, f) { const on = f === undefined ? !cs.has(c) : !!f; if (on) cs.add(c); else cs.delete(c); el.className = [...cs].join(' '); return on; },
    contains(c) { return cs.has(c),
    },
  };
  return el;
}
/* ---- seletor mini: #id .class tag [attr] [attr="v"] [attr*="v"] [attr^="v"], descendentes ---- */
function partMatch(el, p) {
  if (!el || !el.tag) return false;
  if (p.tag && p.tag !== el.tag.toLowerCase()) return false;
  if (p.id && p.id !== el.id) return false;
  if (p.class && !String(el.className).split(/\s+/).includes(p.class)) return false;
  for (const a of p.attrs) {
    const v = el.getAttribute ? el.getAttribute(a.n) : null;
    if (a.op === '=') { if (v !== a.v) return false; }
    else if (a.op === '*') { if (v == null || !v.includes(a.v)) return false; }
    else if (a.op === '^') { if (v == null || !v.slice(0, a.v.length) !== a.v) return false; }
    else { if (v == null) return false; }
  }
  return true;
}
function parseSel(sel) {
  return String(sel).trim().split(/\s+/).filter(Boolean).map((p) => {
    const out = { tag: null, id: null, class: null, attrs: [] };
    const re = /([#.]?[\w-]+)|\[([\w-]+)(?:([*^]?=)"([^"]*)")?\]/g;
    let m;
    while ((m = re.exec(p))) {
      if (m[1]) {
        if (m[1][0] === '#') out.id = m[1].slice(1);
        else if (m[1][0] === '.') out.class = m[1].slice(1);
        else out.tag = m[1].toLowerCase();
      } else if (m[2]) out.attrs.push({ n: m[2], op: m[3] ? m[3][0] : null, v: m[4] });
    }
    return out;
  });
}
function qsa(root, sel) {
  const parts = parseSel(sel);
  const last = parts[parts.length - 1];
  const out = [];
  (function walk(n) {
    for (const c of n.children || []) {
      if (!c._txt && partMatch(c, last)) {
        // exige que os anteriores casem em ancestrais
        let ok = true, anc = c.parentNode, pi = parts.length - 2;
        while (pi >= 0) {
          let found = false;
          while (anc && anc.tag) { if (partMatch(anc, parts[pi])) { found = true; anc = anc.parentNode; break; } anc = anc.parentNode; }
          if (!found) { ok = false; break; }
          pi--;
        }
        if (ok) out.push(c);
      }
      walk(c);
    }
  })(root);
  return out;
}
const ERROS = [];
const documento = mkEl('#document');
documento.documentElement = mkEl('html');
documento.body = mkEl('body');
documento.head = mkEl('head');
documento.createElement = (t) => mkEl(t);
documento.createTextNode = (t) => mkText(t);
documento.getElementById = (id) => REG.get(id) || null;
documento.querySelector = (s) => qsa(documento, s)[0] || null;
documento.querySelectorAll = (s) => qsa(documento, s);
documento.addEventListener = () => {};
documento.removeEventListener = () => {};
documento.dispatchEvent = () => true;
documento.execCommand = () => false;

/* ============================ MUNDO DO MOTOR (banco) ============================ */
const M = criarMundo();
const AUTO = carregarAutomation(M);
alimentarCatalogo(M);
definirCampeao(M, 'katarina');
AUTO.setConfig({ enabled: true, champAlvo: null });
// fixtures do jogo
M.montar('#st-ouro', [M.el({ tag: 'span', label: 'st-ouro', textContent: '9.500.000' })]);
M.montar('#local-nome', [M.el({ tag: 'span', label: 'local-nome', textContent: 'Mina Abandonada (nível 12-20)' })]);
M.montar('#hud-nivel', [M.el({ tag: 'span', label: 'hud-nivel', textContent: '29' })]);
M.montar('#janela-bolsa', [M.el({ tag: 'div', label: 'janela-bolsa' })]);
M.montar('#mochila-qtd', [M.el({ tag: 'span', label: 'mochila-qtd', textContent: '(10 / 30)' })]);
function slot(id, cls, dica) {
  return M.el({ tag: 'button', label: 'slot ' + id, attrs: { 'data-id': id, 'data-dica': dica || '' }, dataset: {}, className: 'slot ' + cls, children: [] });
}
const mo = M.el({ tag: 'div', label: '#mochila', className: '', children: [
  slot('3031+2~A', 'lendario', 'Vale 1.500.000 de ouro no Lojista • +40% no dano do acerto crítico'),
  slot('3089~S', 'lendario', 'Vale 900.000 de ouro no Lojista • +35% em TODO o Poder de Habilidade'),
  slot('3135+1~A', 'lendario', 'Vale 300.000 de ouro no Lojista • 40% de penetração mágica'),
  slot('1006~C', 'basico', 'Vale 120 de ouro no Lojista'),
  slot('esp:1001:7', 'espolio', ''),
] });
M.montar('#mochila', [mo]);
const eq = M.el({ tag: 'div', label: '#equip', children: [
  slot('3089~S', 'lendario', 'Vale 900.000 de ouro no Lojista'),
  slot('3153+2~A', 'lendario', 'Vale 400.000 de ouro no Lojista'),
] });
M.montar('#equip > button.slot[data-id]', eq.children);
M.montar('#equip button.slot[data-id]', eq.children);
function pot(k, n) { return M.el({ tag: 'span', label: 'pot ' + k, dataset: { pocao: k }, find: { b: [M.el({ tag: 'b', label: 'b', textContent: String(n) })] } }); }
M.montar('#hud-pocoes [data-pocao]', [pot('vidaS', 12), pot('vidaF', 40), pot('vida', 95)]);

/* ============================ PROXY motor -> GUI ============================ */
const chamadas = { planBag: [], scanBag: 0, planejar: 0 };
const MOTOR_PROXY = new Proxy(AUTO, {
  get(t, k) {
    const v = t[k];
    if (typeof v === 'function') {
      return function (...args) {
        if (k === 'planBag') chamadas.planBag.push(args.length ? (args[0] && args[0].used != null) : false);
        if (k === 'scanBag') chamadas.scanBag++;
        if (k === 'planejar') chamadas.planejar++;
        try { return v.apply(t, args); } catch (e) { throw e; }
      };
    }
    return v;
  },
});

/* ============================ CORRER A GUI ============================ */
const store = {};
const chromeStub = {
  storage: {
    local: {
      get: (keys, cb) => { const o = {}; for (const k of [].concat(keys)) o[k] = store[k]; if (typeof cb === 'function') cb(o); return Promise.resolve(o); },
      set: (obj, cb) => { Object.assign(store, obj); if (typeof cb === 'function') cb(); return Promise.resolve(); },
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  },
  runtime: { id: 'smoke', sendMessage: () => Promise.resolve({}) },
};
const lsStub = { _d: {}, getItem(k) { return this._d[k] == null ? null : this._d[k]; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
const ctx = {
  document: documento, console, setTimeout: (fn) => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  chrome: chromeStub, localStorage: lsStub, navigator: { userAgent: 'smoke' }, location: { href: 'https://lolidle.com/' },
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  KeyboardEvent: class { constructor(t, i) { this.type = t; Object.assign(this, i || {}); } },
  Event: class { constructor(t, i) { this.type = t; Object.assign(this, i || {}); } },
  MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
  postMessage: () => {}, fetch: () => Promise.reject(new Error('sem rede')), Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
  __lolidleAuto: MOTOR_PROXY,
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const guiSrc = fs.readFileSync(GUI, 'utf8');
try { vm.runInContext(guiSrc, ctx, { filename: path.basename(GUI) }); } catch (e) { ERROS.push('boot gui.js: ' + String((e && e.stack) || e)); }

const RES = { erros: ERROS, checks: [] };
const ck = (rot, ok, det) => RES.checks.push({ rot, ok: ok === true, det: det == null ? '' : String(det) });

/* ============================ VERIFICACOES ============================ */
// 1. painel pelo caminho REAL (window.__lolidleGui.abrir())
const GUI_API = ctx.__lolidleGui || null;
ck('window.__lolidleGui exposto (caminho real de abertura)', !!GUI_API && typeof GUI_API.abrir === 'function');
if (GUI_API) {
  GUI_API.abrir();
  const painel = documento.getElementById('lolidle-ap');
  ck('abrir() marca o painel com .on', !!painel && painel.classList.contains('on'));
  const htmlPainel = (documento.getElementById('ap-t-painel') || {})._raw || '';
  ck('painelLen > 1000 caracteres (conteudo real)', htmlPainel.length > 1000, 'len=' + htmlPainel.length);
}
// 2. as 4 abas desenham sem excecao
const abas = ['painel', 'itens', 'personagem', 'ganhos'];
const htmlPorAba = {};
for (const a of abas) {
  try { if (GUI_API) GUI_API.setTab(a); htmlPorAba[a] = (documento.getElementById('ap-t-' + a) || {})._raw || ''; ck('aba ' + a + ' desenha sem excecao', true, 'len=' + htmlPorAba[a].length); }
  catch (e) { ck('aba ' + a + ' desenha sem excecao', false, String(e)); ERROS.push('aba ' + a + ': ' + e); }
}
// 3. lixo no HTML
let lixo = [];
for (const [a, h] of Object.entries(htmlPorAba)) for (const s of ['undefined', 'NaN', '[object Object]']) if (h.includes(s)) lixo.push(a + ':' + s);
ck('sem "undefined"/"NaN"/"[object Object]" no HTML das abas', lixo.length === 0, lixo.join(','));
// 4. ids duplicados no DOM
ck('0 ids duplicados no DOM', DUPES.length === 0, DUPES.slice(0, 8).join(','));
// 5. arvore de switches
const arv = htmlPorAba.painel || '';
const nos = (arv.match(/class="arv-no /g) || []).length;
const cobre = (arv.match(/class="arv-cobre /g) || []).length;
ck('cada switch tem a linha verde/vermelha', nos > 0 && cobre === nos, 'nos=' + nos + ' cobre=' + cobre);
const arvReal = AUTO.arvoreInterruptores();
ck(' switches renderizados == arvore do motor (' + arvReal.length + ')', nos === arvReal.length, 'gui=' + nos);
// switch a esquerda: em cada bloco arv-no, 'arv-tg' vem antes do '<b>' do nome
let esq = 0, total = 0;
const reNo = /<div class="arv-no [\s\S]*?<\/div>/g; let m2;
while ((m2 = reNo.exec(arv))) { total++; const b = m2[0]; const iTg = b.indexOf('arv-tg'); const iB = b.indexOf('<b>'); if (iTg >= 0 && iB >= 0 && iTg < iB) esq++; }
ck('switch a ESQUERDA do nome em todos os nos', total > 0 && esq === total, esq + '/' + total);
// 6. blindados
const itens = htmlPorAba.itens || '';
ck('marcador discriminante data-blindados="motor"', itens.includes('data-blindados="motor"'));
ck('Blindados mostra o 3031 (PRIORIDADE EXTREMA do motor)', itens.includes('3031'));
const prot = AUTO.PRIORIDADE_EXTREMA.map((p) => p.id);
const faltamProt = prot.filter((id) => !itens.includes(id));
ck('Blindados mostra TODA a PRIORIDADE_EXTREMA (' + prot.join(',') + ')', faltamProt.length === 0, 'faltam: ' + faltamProt.join(','));
// 7. plano da mochila (planBag com a mochila)
const planoHtml = (documento.getElementById('ap-it-plano') || {})._raw || '';
ck('plano da mochila renderiza (sem "o motor nao respondeu")', planoHtml.length > 0 && !planoHtml.includes('Não foi possível calcular o plano da mochila'), 'len=' + planoHtml.length);
ck('planBag chamado COM a mochila (bug do ticket TK-02-17)', chamadas.planBag.length > 0 && chamadas.planBag.every((v) => v === true), JSON.stringify(chamadas.planBag));
ck('plano mostra acoes reais do motor', /Protegido|guardado|Vai ser|Vai para/.test(planoHtml));
// 8. minimizar
ck('bloco da build por fase minimizavel (ap-bf-min)', itens.includes('ap-bf-min'));
const ganhos = htmlPorAba.ganhos || '';
ck('cartoes de farm minimizaveis (ap-fm-min-modo / ap-fm-min-itens)', ganhos.includes('ap-fm-min-modo') && ganhos.includes('ap-fm-min-itens'));
// 9. modalidades de farm
ck('duas modalidades de farm na aba Ganhos', ganhos.includes('Auto farm sozinho') && ganhos.includes('Auto farm pra item'));
// 10. estado/botao unico
ck('4 estados com rotulos distintos (Ligar/Desligar/Retomar/Religar)', ['Ligar auto-play', 'Desligar', 'Retomar', 'Religar'].every((s) => (arv + (htmlPorAba.painel || '')).includes(s) || guiSrcHas(s)), '');
function guiSrcHas(s) { return guiSrc.includes(s); }
// 11. fugir na arvore
ck('switch "Fugir do que mata" na arvore', arv.includes('Fugir do que mata'));
// 12. ler() reencaminha argumentos (scanBag/planejar correram)
ck('motor real contactado (scanBag/planejar chamados)', chamadas.scanBag >= 0);

/* ============================ SAIDA ============================ */
const falhas = RES.checks.filter((c) => !c.ok);
console.log('SMOKE GUI — gui.js + automation.js REAL (dom-stub) sem browser/CDP');
for (const c of RES.checks) console.log((c.ok ? '  ok   ' : '  FALHA ') + c.rot + (c.det ? '  [' + c.det + ']' : ''));
console.log('');
console.log('ERROS/EXCECOES: ' + ERROS.length);
for (const e of ERROS.slice(0, 10)) console.log('  ! ' + String(e).slice(0, 300));
console.log('checks=' + RES.checks.length + ' falhas=' + falhas.length + ' rc=' + (falhas.length || ERROS.length ? 1 : 0));
process.exit(falhas.length || ERROS.length ? 1 : 0);
