/*
 * LoL Idle - banco de regressao: stub HONESTO de DOM/chrome + loader do automation.js REAL.
 *
 * PORQUE ESTE FICHEIRO EXISTE
 *   Os harnesses antigos (41+22 assercoes) perderam-se e o unico registo sobrevivente sao
 *   os ficheiros G:\Temp\lolidle-*-out*.txt. Este modulo reconstroi a BASE deles: executa o
 *   extension/automation.js REAL (o content script MV3, 200KB+) dentro de um vm de Node/Bun
 *   com um DOM stubado. NAO ha browser, NAO ha CDP, NAO ha copia do automation.js.
 *
 * HONESTIDADE DO STUB (regra dura: buraco visivel, nunca silencioso)
 *   - Toda a query (documento OU elemento) passa por resolve().
 *   - Seletor no vocabulario CONHECIDO (extraido do proprio automation.js por grep em
 *     querySelector/querySelectorAll/getElementById) mas nao montado pelo fixture ->
 *     devolve [] / null e NAO e buraco: ausencia declarada.
 *   - Seletor DESCONHECIDO -> registado e reportado como UNSTUBBED:<selector>. O runner
 *     transforma cada UNSTUBBED numa FALHA: o banco nunca pode dar verde com um buraco.
 *   - setInterval e registado mas NAO disparado (o banco e deterministico e nao corre o
 *     loop de fundo do jogo). O runner reporta quantos intervalos ficaram de fora.
 *
 * NAO toca no browser, no jogo, no CDP. Le o automation.js em modo leitura.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');
export const AUTOMATION_REL = 'extension/automation.js';
/* Hook de MUTATION TESTING (opcional): aponte LOLIDLE_AUTOMATION para uma copia mutada
 * do automation.js e confirme que o banco fica VERMELHO. O default e SEMPRE o ficheiro real,
 * e o runner imprime caminho+bytes+sha256 para que uma execucao contra copia seja visivel. */
export const AUTOMATION_PATH = process.env.LOLIDLE_AUTOMATION
  ? path.resolve(process.env.LOLIDLE_AUTOMATION)
  : path.join(RAIZ, AUTOMATION_REL);

/* ------------------------------------------------------------------ *
 * 1. VOCABULARIO DE SELETORES CONHECIDO
 *    Proveniencia: grep de querySelector/querySelectorAll/getElementById
 *    em extension/automation.js (fonte unica). Nada aqui foi inventado.
 * ------------------------------------------------------------------ */
export const SELETORES_CONHECIDOS = [
  // leitura de estado
  '#st-ouro',
  '#local-nome',
  '#hud-pocoes [data-pocao]',
  '#hud-nivel',
  '#st-nivel',
  '#hud-vida-txt',
  '#hud-pontos',
  // retrato do HUD: "<champ>:<skin>" (fonte PRIMARIA de deteccao do campeao)
  '#hud-retrato',
  '#hud-habs .hud-hab',
  '#hab-ativas .hab[data-t]',
  '#equip > button.slot[data-id]',
  '#equip button.slot[data-id]',
  '#barra .hab[data-t]',
  '.st',
  '#log',
  // bolsa
  '#janela-bolsa',
  '#mochila',
  '#mochila-qtd',
  '#mochila button.slot[data-id]',
  // mapa
  '#janela-mapa',
  '#marcadores .marcador[data-local]',
  // NPC / lojista / base
  '#npcs',
  '#janela-npc [data-palavra="vender"]',
  '#janela-npc [data-palavra="comprar"]',
  '#janela-npc [data-palavra="sim"]',
  '#janela-npc [data-abrir-venda]',
  '#janela-npc [data-fechar]',
  '#janela-npc [data-comprar]',
  '#janela-venda .cofre-slot[data-separar]',
  '#janela-venda [data-separar-tipo="espolio"]',
  '#janela-venda [data-vender-cesta]',
  '[data-fechar]',
  // cofre
  '.cofre-slot[data-k]',
  '[data-pegar^="itens:"]',
  // mercado
  '#janela-mercado',
  '[data-aba="minhas"]',
  '[data-aba="vender"]',
  '[data-aba="comprar"]',
  // BURACO FECHADO 2026-10-14: o motor usa CINCO data-aba e o stub so conhecia tres.
  // 'atributos' apareceu como UNSTUBBED (falha, por desenho) ao testar distribuirAtributos();
  // 'habilidades' estava tapado apenas porque subirHabilidades() sai cedo com 0 pontos -
  // bastaria haver um ponto para o buraco aparecer. Ambos passam a estar no vocabulario.
  '[data-aba="atributos"]',
  '[data-aba="habilidades"]',
  '[data-cancelar]',
  '[data-escolher]',
  '[data-anunciar]',
  '[data-comprar]',
  // WATCH DO MERCADO (2026-10-18): o vendedor (.mj-vend b, jogo.js:2667) e o preco/moeda
  // (.preco, jogo.js:2631,2668) das ofertas de compra, lidos por lerOfertasCompra() e
  // ofertasWatchDoDom() para a watch por nome de jogador (caso 'srdog').
  '.mj-oferta',
  '.mj-vend b',
  '.preco',
  '[data-aceitar-diaria]',
  '.mj-card[data-grupo]',
  '#mj-minimo',
  '#vender-preco',
  // tarefas / atributos / presentes / tutorial / novidades
  '#rastreio-tarefa',
  '#rastreio-login',
  '.presente-pegar',
  '#atributos [data-atrib]',
  'button, a, .botao, [data-pular-tutorial]',
  'button, .botao',          // clicarDialogo (automation.js): confirma num dialogo qualquer
  '[data-pular-tutorial]',
  '.novidades-fundo',
  // deteccao do campeao (icone da habilidade)
  '#hud-habs img, #hud-habs .hud-hab img, [src*="/habilidades/"]',
  // ANDAR NO CHAO (2026-10-14): o canvas do jogo, onde o botao direito faz o boneco andar
  // (jogo.js:1449 -> cena.andarPara/arena.mandarAndar). Usado por andarParaCima()/subirNaFonte()
  // em automation.js para subir ate a Tesoureira na Fonte. Sem ele aqui, seria UNSTUBBED.
  '#tela',
  // w3-barra (TK-02-27): o filtro de básicos do jogo (checkbox do HUD, jogo.js:5882-5886)
  '#ignorar-basicos',
  // ---- HUD lido pela extensao (2026-10-14, frente OBSERVABILIDADE) ----
  // stats que o painel do jogo escreve POR ID (jogo.js:6463-6465): chance de critico,
  // multiplicador de critico e reducao de recarga. A regex por rotulo ('.st') nao os apanha.
  '#st-cdr',
  '#st-crit',
  '#st-critx',
  // vida/escudo: o HUD ('12.3k / 20.4k (+1.2k)', jogo.js:6203) e a ficha (jogo.js:6438).
  '#st-vida-txt',
  // efeitos activos com tempo e acumulos (jogo.js:6164-6177) e recarga de item (jogo.js:6181-6193).
  '#hud-buffs',
  '#hud-buffs .hud-buff',
  '#hud-equip',
  '#hud-equip > i',
  // mana (jogo.js:6201, 6209) — a Katarina nao tem, o Yasuo tem Fluxo.
  '#hud-mana',
  '#hud-mana-txt',
  // O MEDIDOR DO JOGO: 'analise' (jogo.js:523-542) desenhado em #janela-analise (jogo.js:544-560)
  // e na linha sempre visivel #rastreio-analise (jogo.js:6250-6255).
  '#rastreio-analise',
  '#janela-analise',
  '#analise-corpo',
  '#hud-hora',
  '#hud-local',
  '#buff-barao',
  '#buff-barao-t',
  '#hud-xpb-txt',
  '#hud-bolsa-n',
];

export const PADROES_CONHECIDOS = [
  /^#npcs button\[data-npc="[^"]+"\]$/,
  /^#marcadores \.marcador\[data-local="[^"]+"\]$/,
  /^#mapa-info \[data-ir="[^"]+"\]$/,
  /^\[data-valor="[^"]+"\]$/,
  /^\[data-forjar="[^"]+"\](\[data-vezes="1"\])?$/,
  /^#janela-npc \[data-qtd="[^"]+"\]$/,
  /^#janela-npc \[data-comprar="[^"]+"\]$/,
  /^#janela-mercado \[data-cancelar="[^"]+"]$/,
  // WATCH DO MERCADO (2026-10-18): comprarOfertaWatch() compra pelo id exacto da oferta
  // ([data-comprar="<o.id>"], jogo.js:2669).
  /^#janela-mercado \[data-comprar="[^"]+"]$/,
  // bancada do Ornn (montarItem/receitasOrnn) — seletores dinamicos por id de receita
  /^#janela-npc button\[data-receita="[^"]+"\]$/,
  /^#janela-npc \[data-montar="[^"]+"\]$/,
  /^#janela-npc \[data-usarGema="[^"]+"\]$/,
];

/* seletores consultados DENTRO de um elemento (el.querySelector) */
const ESCOPADOS_CONHECIDOS = [
  /^b$/, /^em$/, /^img$/, /^p$/, /^small$/, /^span$/, /^i$/, /^\.hud-cd$/, /^\.an-cartao$/, /^\.an-linha$/, /^\.an-tempo$/,
  // `:scope >` e a query que O PROPRIO JOGO usa em jogo.js:6187 (`:scope > .hud-cd`): o stub
  // tem de a conhecer para a leitura da recarga de item nao contar como buraco.
  /^:scope > \.hud-cd$/, /^:scope > em$/,
  /^\.mais$/, /^\.mk-nome$/,
  /^header \.fechar$/, /^\.fechar$/, /^\.novidades-ok$/, /^article,li,div$/,
  // WATCH DO MERCADO (2026-10-18): queries escopadas ao cartao da oferta (jogo.js:2665-2670).
  /^\.mj-oferta$/, /^\.mj-vend b$/, /^\.preco$/,
  /^\.mj-oferta, article, li, div$/,
];


export function seletorConhecido(sel) {
  const s = String(sel);
  if (SELETORES_CONHECIDOS.indexOf(s) >= 0) return true;
  return PADROES_CONHECIDOS.some((re) => re.test(s));
}

/* ------------------------------------------------------------------ *
 * 2. MUNDO STUBADO
 * ------------------------------------------------------------------ */
const REGISTRO_DE_MUNDOS = [];
export function mundosCriados() { return REGISTRO_DE_MUNDOS.slice(); }

export function criarMundo(opts) {
  opts = opts || {};
  const estado = {
    montados: new Map(),        // selector -> [elementos]
    unstubbed: new Map(),       // selector -> { sel, escopos:Set, n }
    queries: [],                // { sel, escopo, n }  (auditoria completa)
    clicks: [],                 // labels clicados, por ordem
    eventos: [],                // eventos DISPARADOS em elementos ({label,tipo,button,clientX,clientY})
    erros: [],                  // erros em callbacks de timer (nao silenciosos)
    intervals: [],              // { id, ms, fn } registados mas NAO disparados
    posted: [],                 // window.postMessage
    storage: Object.assign({}, opts.storage || {}),
    mensagens: [],
    storageListeners: [],
    domListeners: new Map(),
    windowListeners: new Map(),
  };

  function registrarUnstubbed(sel, escopo) {
    const cur = estado.unstubbed.get(sel) || { sel: sel, escopos: new Set(), n: 0 };
    cur.n++;
    cur.escopos.add(escopo);
    estado.unstubbed.set(sel, cur);
  }

  function resolve(raiz, sel) {
    const s = String(sel);
    if (raiz && raiz !== documento) {
      if (raiz._find && Object.prototype.hasOwnProperty.call(raiz._find, s)) {
        const arr = raiz._find[s];
        estado.queries.push({ sel: s, escopo: 'el:' + raiz.label, n: arr.length });
        return arr;
      }
      if (ESCOPADOS_CONHECIDOS.some((re) => re.test(s))) {
        estado.queries.push({ sel: s, escopo: 'el:' + raiz.label, n: 0 });
        return [];
      }
      registrarUnstubbed(s, 'el:' + raiz.label);
      return [];
    }
    if (estado.montados.has(s)) {
      const arr = estado.montados.get(s);
      estado.queries.push({ sel: s, escopo: 'document', n: arr.length });
      return arr;
    }
    if (seletorConhecido(s)) {
      estado.queries.push({ sel: s, escopo: 'document', n: 0 });
      return [];
    }
    registrarUnstubbed(s, 'document');
    return [];
  }

  function criarEl(spec) {
    spec = spec || {};
    const el = {
      tag: spec.tag || 'div',
      label: spec.label || (spec.tag || 'el'),
      _find: spec.find || {},
      _closest: spec.closest || {},
      _attrs: Object.assign({}, spec.attrs || {}),
      dataset: Object.assign({}, spec.dataset || {}),
      className: spec.className || '',
      textContent: spec.textContent != null ? String(spec.textContent) : '',
      title: spec.title || '',
      hidden: !!spec.hidden,
      disabled: !!spec.disabled,
      // CAIXA de seleção (w3-barra, TK-02-27): `spec.checkbox: true` dá ao elemento um
      // `.checked` real e o `click()` passa a alterná-lo e a registar o evento `change` —
      // que é como o jogo funciona (jogo.js:5883) e como a automação tem de clicar.
      checked: !!spec.checkbox ? !!spec.checked : undefined,
      _checkbox: !!spec.checkbox,
      value: spec.value != null ? String(spec.value) : '',
      children: spec.children || [],
      parentNode: null,
      _rect: spec.rect || null,
    };
    el.classList = {
      contains: (c) => String(el.className).split(/\s+/).indexOf(c) >= 0,
      add: (c) => { if (!el.classList.contains(c)) el.className = (String(el.className) + ' ' + c).trim(); },
      remove: (c) => { el.className = String(el.className).split(/\s+/).filter((x) => x !== c).join(' '); },
      toggle: () => false,
    };
    // ESTILO INLINE (2026-10-14, frente OBSERVABILIDADE): o jogo escreve a fraccao EXACTA da
    // recarga numa variavel CSS inline — jogo.js:6228 (habilidades), 6172 (buffs), 6190 (itens).
    // A extensao le `el.style.getPropertyValue('--cd')`; sem isto o leitor rebentava e o valor
    // era inventado. O fixture passa `style: { '--cd': '0.420' }`.
    const _props = Object.assign({}, spec.style || {});
    el.style = {
      _props: _props,
      getPropertyValue: (n) => (Object.prototype.hasOwnProperty.call(_props, n) ? _props[n] : ''),
      setProperty: (n, v) => { _props[n] = String(v); },
      removeProperty: (n) => { const v = _props[n] || ''; delete _props[n]; return v; },
    };
    el.getAttribute = (n) => (Object.prototype.hasOwnProperty.call(el._attrs, n) ? el._attrs[n] : null);
    el.setAttribute = (n, v) => { el._attrs[n] = String(v); };
    el.removeAttribute = (n) => { delete el._attrs[n]; };
    el.hasAttribute = (n) => Object.prototype.hasOwnProperty.call(el._attrs, n);
    el.querySelector = (s) => resolve(el, s)[0] || null;
    el.querySelectorAll = (s) => resolve(el, s);
    el.closest = (s) => {
      if (Object.prototype.hasOwnProperty.call(el._closest, s)) return el._closest[s];
      if (ESCOPADOS_CONHECIDOS.some((re) => re.test(String(s)))) return null;
      registrarUnstubbed(String(s), 'closest:' + el.label);
      return null;
    };
    el.matches = () => false;
    el.contains = () => false;
    el.click = () => {
      estado.clicks.push(el.label);
      if (el._checkbox) {
        el.checked = !el.checked;                       // o browser alterna a caixa...
        estado.eventos.push({ label: el.label, tipo: 'change', button: 0, clientX: 0, clientY: 0 });   // ...e dispara o change
      }
      return true;
    };
    // EVENTOS registados (2026-10-14): antes eram descartados e nao havia como provar ONDE o
    // automation.js clicou no canvas #tela (andarParaCima/subirNaFonte). Registar nao muda nada
    // para quem so quer o "true" de volta.
    el.dispatchEvent = (ev) => {
      estado.eventos.push({ label: el.label, tipo: (ev && ev.type) || '', button: ev && ev.button, clientX: ev && ev.clientX, clientY: ev && ev.clientY });
      return true;
    };
    el.addEventListener = () => {};
    el.removeEventListener = () => {};
    el.focus = () => {};
    el.append = (c) => { el.children.push(c); return el; };
    el.remove = () => {};
    el.getBoundingClientRect = () => ({
      width: el._rect && el._rect.width != null ? el._rect.width : 0,
      height: el._rect && el._rect.height != null ? el._rect.height : 0,
      top: 0, left: 0, right: 0, bottom: 0,
    });
    return el;
  }

  const documento = {
    _isDoc: true,
    label: 'document',
    hidden: false,
    documentElement: criarEl({ tag: 'html', label: 'documentElement' }),
    body: criarEl({ tag: 'body', label: 'body' }),
    querySelector: (s) => resolve(documento, s)[0] || null,
    querySelectorAll: (s) => resolve(documento, s),
    getElementById: (id) => resolve(documento, '#' + id)[0] || null,
    createElement: (t) => criarEl({ tag: t, label: 'novo:' + t }),
    createTextNode: (t) => ({ textContent: String(t) }),
    addEventListener: (t, fn) => {
      const arr = estado.domListeners.get(t) || [];
      if (arr.indexOf(fn) < 0) arr.push(fn);
      estado.domListeners.set(t, arr);
    },
    removeEventListener: (t, fn) => {
      const arr = estado.domListeners.get(t);
      if (!arr) return;
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent: (ev) => {
      const arr = estado.domListeners.get(ev && ev.type) || [];
      for (const fn of arr) { try { fn(ev); } catch (e) { estado.erros.push('listener ' + (ev && ev.type) + ': ' + String(e)); } }
      return true;
    },
    execCommand: () => false,
  };

  /* ---- chrome.storage.local: callbacks ASSINCRONOS (como no MV3 real) ---- */
  function clone(v) {
    if (v === undefined) return undefined;
    try { return structuredClone(v); } catch (e) { try { return JSON.parse(JSON.stringify(v)); } catch (e2) { return v; } }
  }
  function lerChave(key) {
    const s = estado.storage;
    if (key == null) return clone(s);
    if (typeof key === 'string') return Object.prototype.hasOwnProperty.call(s, key) ? { [key]: clone(s[key]) } : {};
    if (Array.isArray(key)) { const o = {}; for (const k of key) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = clone(s[k]); return o; }
    if (typeof key === 'object') { const o = {}; for (const k of Object.keys(key)) o[k] = Object.prototype.hasOwnProperty.call(s, k) ? clone(s[k]) : clone(key[k]); return o; }
    return {};
  }
  const local = {
    get: (key, cb) => {
      const res = lerChave(key);
      if (typeof cb === 'function') queueMicrotask(() => { try { cb(clone(res)); } catch (e) { estado.erros.push('storage.get cb: ' + String(e)); } });
      return Promise.resolve(clone(res));
    },
    set: (obj, cb) => {
      const velho = clone(estado.storage);
      if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) estado.storage[k] = clone(obj[k]);
      queueMicrotask(() => {
        try { if (typeof cb === 'function') cb(); } catch (e) { estado.erros.push('storage.set cb: ' + String(e)); }
        const ch = {};
        for (const k of Object.keys(obj || {})) ch[k] = { oldValue: velho[k], newValue: clone(obj[k]) };
        for (const fn of estado.storageListeners) { try { fn(ch, 'local'); } catch (e) { estado.erros.push('onChanged: ' + String(e)); } }
      });
      return Promise.resolve();
    },
    remove: (key, cb) => {
      const ks = Array.isArray(key) ? key : [key];
      for (const k of ks) delete estado.storage[k];
      if (typeof cb === 'function') queueMicrotask(() => cb());
      return Promise.resolve();
    },
    clear: (cb) => { estado.storage = {}; if (typeof cb === 'function') queueMicrotask(() => cb()); return Promise.resolve(); },
  };
  const chrome = {
    storage: {
      local: local,
      onChanged: {
        addListener: (fn) => { if (typeof fn === 'function') estado.storageListeners.push(fn); },
        removeListener: (fn) => { const i = estado.storageListeners.indexOf(fn); if (i >= 0) estado.storageListeners.splice(i, 1); },
      },
    },
    runtime: { id: 'banco-de-testes', getURL: (p) => String(p), sendMessage: async () => ({}) },
  };

  /* ---- timers: setTimeout resolve em microtask; setInterval NAO dispara ---- */
  let seq = 0;
  const pendentes = new Map();
let __TO_N = 0;
const __TO_MSG = (fn, ms, n) => { const st = String(new Error().stack).split(String.fromCharCode(10)).slice(1, 16).join(' >> '); return 'STUB GUARD n=' + n + ' ms=' + ms + ' FN=' + String(fn).slice(0, 300) + ' STACK ' + st; };
  const setTimeoutStub = (fn, ms) => { if (++__TO_N > 3000) { throw new Error(__TO_MSG(fn, ms, __TO_N)); }
    const id = ++seq;
    if (typeof fn !== 'function') return id;
    pendentes.set(id, true);
    queueMicrotask(() => {
      if (!pendentes.has(id)) return;
      pendentes.delete(id);
      try { fn(); } catch (e) { estado.erros.push('setTimeout: ' + String((e && e.stack) || e)); }
    });
    return id;
  };
  const clearTimeoutStub = (id) => { pendentes.delete(id); };
  const setIntervalStub = (fn, ms) => {
    const id = ++seq;
    estado.intervals.push({ id: id, ms: ms, fn: String(fn).slice(0, 80) });
    return id;
  };
  const clearIntervalStub = (id) => {
    const i = estado.intervals.findIndex((x) => x.id === id);
    if (i >= 0) estado.intervals.splice(i, 1);
  };

  class KeyboardEventStub {
    constructor(type, init) { this.type = type; Object.assign(this, init || {}); }
  }
  class EventStub {
    constructor(type, init) { this.type = type; Object.assign(this, init || {}); }
  }
  class MessageEventStub {
    constructor(type, init) { this.type = type; Object.assign(this, init || {}); }
  }
  class MutationObserverStub {
    constructor(cb) { this._cb = cb; this._alvos = []; }
    observe(alvo, cfg) { this._alvos.push({ alvo: alvo, cfg: cfg }); }
    disconnect() { this._alvos = []; }
    takeRecords() { return []; }
  }

  /** MouseEvent stubado (W5, TK-01-39): o `montarItem`/disparar cliques usa
   *  `new MouseEvent('dblclick', { bubbles: true })`. Sem isto no sandbox, testar a cadeia
   *  da bancada do Ornn rebentava com "MouseEvent is not defined" — buraco do HARNESS,
   *  nao do automation.js. */
  const MouseEventStub = class MouseEvent {
    constructor(tipo, opts) { this.type = String(tipo || ''); Object.assign(this, opts || {}); }
  };

  const sandbox = {
    document: documento,
    chrome: chrome,
    console: console,
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    setInterval: setIntervalStub,
    clearInterval: clearIntervalStub,
    MutationObserver: MutationObserverStub,
    KeyboardEvent: KeyboardEventStub,
    Event: EventStub,
    MessageEvent: MessageEventStub,
    MouseEvent: MouseEventStub,
    structuredClone: structuredClone,
    queueMicrotask: queueMicrotask,
    JSON: JSON,
    Math: Math,
    Date: Date,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.postMessage = (data) => { estado.posted.push(data); return true; };
  sandbox.addEventListener = (t, fn) => {
    const arr = estado.windowListeners.get(t) || [];
    arr.push(fn);
    estado.windowListeners.set(t, arr);
  };
  sandbox.removeEventListener = () => {};
  sandbox.dispatchEvent = () => true;

  let contexto = null;
  let fallback = false;
  try { contexto = vm.createContext(sandbox); } catch (e) { fallback = true; }

  const mundo = {
    sandbox: sandbox,
    contexto: contexto,
    fallback: fallback,
    documento: documento,
    chrome: chrome,
    estado: estado,
    el: criarEl,
    montar: (sel, els) => { estado.montados.set(String(sel), els || []); return els || []; },
    resolve: resolve,
    /** alimenta um evento 'message' em window (e o caminho REAL do inject.js -> automation.js) */
    dispatchMessage: (data) => {
      estado.mensagens.push(data);
      const arr = estado.windowListeners.get('message') || [];
      for (const fn of arr) { try { fn({ data: data }); } catch (e) { estado.erros.push('message listener: ' + String(e)); } }
      return arr.length;
    },
    cliqueDe: (label) => estado.clicks.indexOf(label) >= 0,
    eventosDe: (label) => estado.eventos.filter((e) => e.label === label),
    clicksDePrefixo: (p) => estado.clicks.filter((c) => String(c).indexOf(p) === 0).map((c) => String(c).slice(p.length)),
    unstubbed: () => [...estado.unstubbed.values()],
    proveniencia: null,
  };
  REGISTRO_DE_MUNDOS.push(mundo);
  return mundo;
}

/* ------------------------------------------------------------------ *
 * 3. LOADER DO automation.js REAL
 * ------------------------------------------------------------------ */
export function carregarAutomation(mundo, caminho) {
  const alvo = caminho || AUTOMATION_PATH;
  const codigo = fs.readFileSync(alvo, 'utf8');
  if (codigo.length < 150000) throw new Error('automation.js suspeito (bytes=' + codigo.length + '): o banco tem de executar o ficheiro REAL');
  if (codigo.indexOf('window.__lolidleAuto =') < 0) throw new Error('automation.js nao expoe window.__lolidleAuto: ficheiro errado?');
  mundo.proveniencia = {
    caminho: alvo,
    rel: path.relative(RAIZ, alvo).split(path.sep).join('/'),
    bytes: codigo.length,
    sha256: crypto.createHash('sha256').update(codigo).digest('hex'),
  };
  if (mundo.contexto) {
    new vm.Script(codigo, { filename: AUTOMATION_REL }).runInContext(mundo.contexto);
  } else {
    const nomes = ['window', 'document', 'chrome', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'MutationObserver', 'KeyboardEvent', 'Event', 'MessageEvent', 'MouseEvent', 'CustomEvent',
      'structuredClone', 'queueMicrotask'];
    const valores = nomes.map((n) => mundo.sandbox[n]);
    const fn = new Function(nomes.join(','), codigo);
    fn.apply(null, valores);
  }
  const auto = mundo.sandbox.window.__lolidleAuto;
  if (!auto) throw new Error('automation.js nao expos window.__lolidleAuto');
  return auto;
}

/* ------------------------------------------------------------------ *
 * 4. FIXTURES DO JOGO (catalogo, campeoes, lojista, mercado, mochila)
 * ------------------------------------------------------------------ */
export const IMG_HAB_SEL = '#hud-habs img, #hud-habs .hud-hab img, [src*="/habilidades/"]';

/* Catalogo controlado. As potencias foram escolhidas para que a build ideal
 * do campeao AD e do AP sejam deterministas e diferentes (ver regras.test.mjs). */
export const CATALOGO = [
  // basics (folhas)
  { id: '1001', nome: 'Espada Longa', raridade: 'basico', espaco: 'arma', ad: 10, preco: 350 },
  { id: '1002', nome: 'Cajado Simples', raridade: 'basico', espaco: 'arma', ap: 20, preco: 400 },
  { id: '1005', nome: 'Adaga Inutil', raridade: 'basico', espaco: 'arma', ad: 1, preco: 100 },
  // epicos
  { id: '2002', nome: 'Lamina Epica', raridade: 'epico', espaco: 'arma', ad: 30, preco: 1200, de: ['1001'] },
  { id: '2003', nome: 'Tomo Epico', raridade: 'epico', espaco: 'arma', ap: 60, preco: 1200, de: ['1002'] },
  { id: '4001', nome: 'Refugo Epico', raridade: 'epico', espaco: 'arma', ad: 5, preco: 900, de: ['1001'] },
  { id: '4002', nome: 'Couraca Epica', raridade: 'epico', espaco: 'arma', vida: 300, armadura: 50, preco: 1100, de: ['1001'] },
  // lendarios AD
  { id: '2007', nome: 'Botas AD', raridade: 'lendario', espaco: 'botas', va: 0.3, preco: 1100, de: ['1001'] },
  { id: '2001', nome: 'Lendario AD 1', raridade: 'lendario', espaco: 'arma', ad: 400, preco: 3000, de: ['2002'] },
  { id: '2004', nome: 'Lendario AD 2', raridade: 'lendario', espaco: 'arma', ad: 380, preco: 3000, de: ['2002'] },
  { id: '2005', nome: 'Lendario AD 3', raridade: 'lendario', espaco: 'arma', ad: 360, preco: 3000, de: ['2002'] },
  { id: '2006', nome: 'Lendario AD 4', raridade: 'lendario', espaco: 'arma', ad: 320, preco: 3000, de: ['2002'] },
  { id: '2008', nome: 'Lendario Critico', raridade: 'lendario', espaco: 'arma', critico: 1, preco: 3000, de: ['2002'] },
  // lendarios AP
  { id: '3005', nome: 'Botas AP', raridade: 'lendario', espaco: 'botas', ap: 30, va: 0.2, preco: 1100, de: ['1002'] },
  { id: '3001', nome: 'Lendario AP 1', raridade: 'lendario', espaco: 'arma', ap: 100, preco: 3000, de: ['2003'] },
  { id: '3002', nome: 'Lendario AP 2', raridade: 'lendario', espaco: 'arma', ap: 90, preco: 3000, de: ['2003'] },
  { id: '3003', nome: 'Lendario AP 3', raridade: 'lendario', espaco: 'arma', ap: 80, preco: 3000, de: ['2003'] },
  { id: '3004', nome: 'Lendario AP 4', raridade: 'lendario', espaco: 'arma', ap: 70, preco: 3000, de: ['2003'] },
  { id: '3089', nome: 'Rabadon', raridade: 'lendario', espaco: 'arma', ap: 120, efeito: 'Poder de Habilidade total em 35%.', preco: 3600, de: ['1002'] },
  // lendario fraco (nunca entra em build nenhuma) - o "fora da build" dos testes
  { id: '9500', nome: 'Lendario Fraco', raridade: 'lendario', espaco: 'arma', vida: 10, armadura: 5, preco: 3000, de: ['1001'] },
  // ---- ITENS REAIS DO JOGO (W11 / TK-02-81, TK-02-74, TK-02-75) ---------------------------
  // A 3153 Espada do Rei Destruido e a peca que DECIDE a luta contra o Barao
  // (motor.js:1702 `bruto += 0.05 * vidaRefItem(alvo, alvo.hp)`, com tecto motor.js:1191). Sem
  // ela no catalogo controlado, o banco nao tem como provar que a build de chefe a inclui -
  // o ticket P0 da fila W11 ficaria sem assercao nenhuma.
  // Os numeros (ad/ap/vida/cdr/pen) sao os do catalogo do jogo (docs/game-src/itens.js); o
  // catalogo do banco e CONTROLADO, e estes ids mantem as propriedades que os tickets medem.
  { id: '3153', nome: 'Espada do Rei Destruido', raridade: 'lendario', espaco: 'arma', ad: 40, va: 0.25, rv: 0.1, preco: 3200, de: ['2002'],
    efeito: 'Gume da Nevoa: ataques causam 5% da Vida atual do alvo como dano extra. Em chefes e monstros de muita vida, a porcentagem tem um teto.' },
  { id: '3036', nome: 'Lembrancas do Lorde Dominik', raridade: 'lendario', espaco: 'arma', ad: 35, critico: 0.25, penArmadura: 0.3, preco: 3400, de: ['2002'],
    efeito: '30% de penetracao de armadura.' },
  { id: '3031', nome: 'Gume do Infinito', raridade: 'lendario', espaco: 'arma', ad: 70, critico: 0.25, preco: 3400, de: ['2002'],
    efeito: 'Acertos criticos causam +40% de dano.' },
  { id: '6653', nome: 'Tormento de Liandry', raridade: 'lendario', espaco: 'arma', ap: 80, preco: 3200, de: ['2003'],
    efeito: 'Queimam o alvo, causando dano por segundo.' },
  { id: '3171', nome: 'Impeto Cosmico', raridade: 'lendario', espaco: 'arma', cdr: 0.15, vida: 350, preco: 3200, de: ['2003'],
    efeito: 'Reduz o tempo de recarga das habilidades.' },
  { id: '3100', nome: 'Perdicao de Lich', raridade: 'lendario', espaco: 'arma', ap: 80, preco: 3200, de: ['2003'],
    efeito: 'Depois de usar uma habilidade, o proximo ataque causa +75% do Poder de Habilidade.' },
  { id: '3135', nome: 'Cajado do Vazio', raridade: 'lendario', espaco: 'arma', ap: 70, penMag: 0.4, preco: 3200, de: ['2003'],
    efeito: '40% de penetracao magica.' },
  { id: '3168', nome: ' Couraca do Espirito', raridade: 'lendario', espaco: 'arma', vida: 500, rm: 40, preco: 3200, de: ['2002'] },
];

export const CHAMPS = {
  adtest: { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } },
  aptest: { magia: true, distancia: false, papel: { dano: 1, recebido: 1 } },
};

export const KIT_MINIMO = { Q: { max: 5, base: [50, 70], ratio: [0.5, 0.6], recarga: [10, 9] } };

export function alimentarMeta(mundo, patch) {
  return mundo.dispatchMessage(Object.assign({ __lolidleAuto: 'meta' }, patch || {}));
}

/** Carrega o catalogo no META pelo caminho REAL (message -> carregarMeta). */
export function alimentarCatalogo(mundo, itens) {
  return alimentarMeta(mundo, { itens: itens || CATALOGO });
}

/**
 * Define o campeao atual pelo caminho REAL: icone em #hud-habs + META.kits[id],
 * que e o que detectarCampeao()/aplicarKit() leem no jogo.
 */
export function definirCampeao(mundo, id, over) {
  over = over || {};
  const base = CHAMPS[id] || { magia: false, distancia: false, papel: { dano: 1, recebido: 1 } };
  const fonte = {
    kit: over.kit || KIT_MINIMO,
    adBase: over.adBase != null ? over.adBase : 60, adNivel: over.adNivel != null ? over.adNivel : 3,
    magia: over.magia != null ? !!over.magia : !!base.magia,
    distancia: over.distancia != null ? !!over.distancia : !!base.distancia,
    papel: over.papel || base.papel,
    semMana: false, adagas: false, hemorragia: !!over.hemorragia,
  };
  mundo.montar(IMG_HAB_SEL, [mundo.el({ tag: 'img', label: 'hud-hab-img', attrs: { src: '/img/habilidades/' + id + '/q.png' } })]);
  const kits = {};
  kits[id] = fonte;
  return alimentarMeta(mundo, { kits: kits });
}

/** Monta a mochila (o MESMO caminho do jogo: #mochila > children[data-id]). */
export function montarMochila(mundo, slots, cap) {
  cap = cap || 30;
  const filhos = slots.map((s) => mundo.el({
    tag: 'button',
    label: 'mochila:' + s.id,
    className: 'slot ' + (s.raridade || 'basico'),
    attrs: { 'data-id': s.id, 'data-dica': s.dica || '' },
  }));
  mundo.montar('#janela-bolsa', [mundo.el({ label: 'janela-bolsa', hidden: true })]);
  mundo.montar('#mochila', [mundo.el({ label: 'mochila', children: filhos })]);
  mundo.montar('#mochila-qtd', [mundo.el({ label: 'mochila-qtd', textContent: '(' + slots.length + '/' + cap + ')' })]);
  return filhos;
}

/** Monta o Lojista inteiro (NPC -> palavra vender -> abrir-venda -> janela-venda). */
export function montarLojista(mundo, slots) {
  mundo.montar('#npcs button[data-npc="Lojista"]', [mundo.el({ tag: 'button', label: 'npc-lojista' })]);
  mundo.montar('#janela-npc [data-palavra="vender"]', [mundo.el({ tag: 'button', label: 'palavra-vender' })]);
  mundo.montar('#janela-npc [data-abrir-venda]', [mundo.el({ tag: 'button', label: 'abrir-venda' })]);
  mundo.montar('#janela-venda [data-separar-tipo="espolio"]', [mundo.el({ tag: 'button', label: 'separar-espolio' })]);
  mundo.montar('#janela-venda .cofre-slot[data-separar]', slots.map((s) => mundo.el({
    tag: 'div',
    label: 'slot:' + s.id,
    className: 'cofre-slot',
    dataset: { separar: s.id, dica: s.dica || '' },
  })));
  mundo.montar('#janela-venda [data-vender-cesta]', [mundo.el({ tag: 'button', label: 'vender-cesta' })]);
  mundo.montar('[data-fechar]', []);          // ausencia declarada: sem botoes de fechar neste fixture
  mundo.montar('#janela-npc [data-fechar]', []);
  return slots;
}

/** Monta a janela do mercado com N ofertas (texto real: "lendario"/"epico" + [qual] + preco). */
export function montarMercado(mundo, ofertas) {
  const botoes = [];
  for (let i = 0; i < ofertas.length; i++) {
    const o = ofertas[i];
    const card = mundo.el({ tag: 'article', label: 'card:' + o.id, textContent: o.txt });
    const btn = mundo.el({
      tag: 'button', label: 'cancelar:' + o.id,
      dataset: { cancelar: o.id },
      closest: { 'article,li,div': card },
    });
    botoes.push(btn);
  }
  const aba = mundo.el({ tag: 'button', label: 'aba-minhas' });
  mundo.montar('#janela-mercado', [mundo.el({
    label: 'janela-mercado',
    hidden: false,
    find: { '[data-aba="minhas"]': [aba], '[data-cancelar]': botoes },
  })]);
  return botoes;
}

export function ofertasLendarias(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'of:' + i, txt: 'anel lendario ' + i + ' [S] 5k ouro' });
  return out;
}

export function ofertasEpicas(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'of:' + i, txt: 'espada epica ' + i + ' [C] 1k ouro' });
  return out;
}

/** Injects a `fetch` stub that returns the given DOM-format offers in SERVER format.
 *  TK-01: `salvarOfertas` le do SERVIDOR (GET /api/mercado), por isso os testes que montam o
 *  mercado precisam de um fetch que devolva essas ofertas — senao `salvarOfertas` devolve null
 *  ("nao sabe") e a cache fica vazia. Sem isto, o mercado NUNCA abre (P0 do dono). */
export function stubFetchMercado(mundo, ofertas) {
  const baseLend = '9500';   // lendario no catalogo
  const baseEpic = '2002';   // epico no catalogo
  const srv = (ofertas || []).map((o) => {
    const lend = /lend/i.test(o.txt);
    return { id: o.id, item: (lend ? baseLend : baseEpic) + '~S', preco: 5000, minha: true };
  });
  mundo.sandbox.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ofertas: srv }) });
  return srv;
}

/** Deixa o mercado SATURADO (10 lendarias) pelo caminho REAL: salvarOfertas -> _ofertasCache.
 *  TK-01: a leitura e do SERVIDOR, por isso o fetch e stubado a devolver as ofertas montadas. */
export async function saturarMercado(auto, mundo) {
  const ofertas = ofertasLendarias(10);
  montarMercado(mundo, ofertas);
  stubFetchMercado(mundo, ofertas);
  const o = await auto.salvarOfertas();
  return o;
}

/* ===================== BANCADA DO ORNN (acrescentado pelo worker W5, TK-01-39) =====================
 * Fixture da bancada de MONTAGEM do Ornn, com os MESMOS seletores que o automation.js procura
 * (medidos na bancada real, ver o comentario de `receitasOrnn`):
 *   #npcs button[data-npc="Ornn"] · #janela-npc [data-palavra="montar"]
 *   .troca-linha.montagem · button[data-receita] · img.comp (dica traz "Voce tem")
 *   span.ouro (custo) · span.chance-montar (chance + "Em media: N tentativas")
 *   #npc-troca [data-slot] · SPAN.forja-pegar · [data-usarGema] · [data-montar][data-vezes]
 * Serve para provar no banco (sem browser, sem CDP) que a cadeia
 *   receitasOrnn() -> escolherReceitaOrnn() -> montarItem() -> contabilidade
 * corre de ponta a ponta.
 *
 * ASSINATURA: montarOrnn(mundo, receitas, slots)
 *   receitas: [{ id, nome, ouro, chance, tentativasMedias, comps: [{ nome, tem }] }]
 *   slots:    quantos [data-slot] a receita tem (Tiamat = 2). Default 2. */
export function montarOrnn(mundo, receitas, slots) {
  const nSlots = slots == null ? 2 : slots;
  const linhas = (receitas || []).map((r) => {
    const comps = (r.comps || []).map((c) => mundo.el({
      tag: 'img', label: 'comp:' + c.nome, className: 'comp',
      dataset: { dica: String(c.nome) + '\n' + (c.tem ? 'Você tem' : 'Você não tem') },
    }));
    const sel = mundo.el({ tag: 'button', label: 'receita:' + r.id, dataset: { receita: String(r.id) } });
    return mundo.el({
      tag: 'div', label: 'linha:' + r.id, className: 'troca-linha montagem',
      find: {
        'button[data-receita]': [sel],
        'img.comp': comps,
        '.info b': [mundo.el({ tag: 'b', label: 'nome:' + r.id, textContent: r.nome || String(r.id) })],
        '.chance-montar': [mundo.el({
          tag: 'span', label: 'chance:' + r.id, textContent: r.chance || '1,2%',
          dataset: { dica: (r.chance || '1,2%') + (r.tentativasMedias ? ' | Em média: ' + r.tentativasMedias + ' tentativas' : '') },
        })],
        'span.ouro': [mundo.el({ tag: 'span', label: 'ouro:' + r.id, textContent: r.ouro || '0' })],
      },
    });
  });
  const slotEls = Array.from({ length: nSlots }, (_, i) =>
    mundo.el({ tag: 'div', label: 'slot:' + i, className: 'montar-slot', dataset: { slot: 'itens:' + i } }));
  // Os botoes de LOTE ([data-montar="<id>"][data-vezes="N"]). O `montarItem` procura-os por
  // selector EXACTO com o id da receita, logo cada um e montado no seu proprio selector.
  // Os botoes de LOTE ([data-montar="<id>"][data-vezes="N"]). O `montarItem` procura-os pelo
  // selector `#janela-npc [data-montar="<id>"]` e escolhe o lote por `data-vezes`, logo a lista
  // INTEIRA (1/10/100/1000) tem de estar montada sob esse MESMO selector.
  const botoesMontar = (receitas || []).map((r) => {
    const lista = [1, 10, 100, 1000].map((v) => mundo.el({
      tag: 'button', label: 'montar:' + r.id + ':' + v,
      dataset: { montar: String(r.id), vezes: String(v) },
    }));
    mundo.montar('#janela-npc [data-montar="' + r.id + '"]', lista);
    return lista;
  }).flat();
  const gemas = ['sorte', 'arcana', 'protecao'].map((g) => mundo.el({ tag: 'button', label: 'gema:' + g, dataset: { usarGema: g } }));
  // As pecas da bancada. No jogo, o duplo clique corre o handler de #npc-troca
  // (jogo.js:5325 `porNoSlot(p.dataset.pegar, null)`) que ENCHE o slot — o fixture replica isso:
  // ao receber o dblclick, o primeiro slot vazio passa a .montar-slot.cheio. Sem esta
  // replicacao o `montarItem` pararia sempre em "nenhuma peca entrou na bancada".
  const pegar = Array.from({ length: 6 }, (_, i) => {
    const el = mundo.el({
      tag: 'span', label: 'pegar:' + i, className: 'forja-pegar', dataset: { pegar: 'itens:' + i },
    });
    const dispatch = el.dispatchEvent;
    el.dispatchEvent = (ev) => {
      const r = dispatch(ev);
      if (ev && ev.type === 'dblclick') {
        const vazio = slotEls.find((s) => !s.classList.contains('cheio'));
        if (vazio) {
          vazio.classList.add('cheio');
          // o documento consulta `#npc-troca .montar-slot.cheio` por selector EXACTO (o stub
          // nao avalia classes): o slot cheio entra tambem nessa montagem para a leitura ver.
          const cheios = mundo.estado.montados.get('#npc-troca .montar-slot.cheio') || [];
          if (cheios.indexOf(vazio) < 0) { cheios.push(vazio); mundo.estado.montados.set('#npc-troca .montar-slot.cheio', cheios); }
        }
      }
      return r;
    };
    return el;
  });
  mundo.montar('#npcs button[data-npc="Ornn"]', [mundo.el({ tag: 'button', label: 'npc-ornn' })]);
  mundo.montar('#janela-npc [data-palavra="montar"]', [mundo.el({ tag: 'button', label: 'palavra-montar' })]);
  mundo.montar('#janela-npc .troca-linha.montagem', linhas);
  // o `montarItem` procura a receita por SELETOR EXACTO
  // (`#janela-npc button[data-receita="<id>"]`); o stub resolve selector exacto no documento,
  // logo cada botao e montado no seu proprio selector.
  for (const r of (receitas || [])) {
    mundo.montar('#janela-npc button[data-receita="' + r.id + '"]',
      [mundo.el({ tag: 'button', label: 'receita:' + r.id, dataset: { receita: String(r.id) } })]);
  }
  mundo.montar('#janela-npc [data-usarGema]', gemas);
  mundo.montar('#npc-troca [data-slot]', slotEls);
  mundo.montar('#janela-npc [data-montar]', botoesMontar);
  mundo.montar('#janela-npc SPAN.forja-pegar', pegar);
  mundo.montar('#npc-troca .montar-slot.cheio', []);
  return linhas;
}
