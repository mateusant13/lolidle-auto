#!/usr/bin/env node
/*
 * prova-content-tempo-real.mjs - PROVA dos defeitos do TEMPO REAL do extension/content.js.
 *
 * Corre o ficheiro REAL (extension/content.js) dentro de um vm com DOM/chrome stubados
 * (sem browser, sem CDP, sem jogo) e afirma o comportamento pelos caminhos que o jogo
 * escreve no DOM:
 *   #hud-vida-txt / #st-vida-txt  ->  `${fmt(vida)} / ${fmt(a.vida)}`  (jogo.js:6203, :6438)
 *   #hud-vida (style.width)      ->  `${fv*100}%`                      (jogo.js:6201)
 *   #hud-alvo (b / small)        ->  `nv {n}`                          (jogo.js:6552)
 *   #hud-pocoes [data-pocao] > b ->  `String(estado.pocoes[k])`        (jogo.js:6241)
 * e pelo canal REAL do inject.js -> window.postMessage (inject.js:175, :187, :202).
 *
 * Nada aqui copia logica de producao: o parseNum/readHP testados sao os do ficheiro.
 *
 *   node tools/prova-content-tempo-real.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(RAIZ, 'extension', 'content.js');

/* ------------------------------------------------------------------ *
 * DOM minimo, honesto: so o que o content.js de facto percorre.
 * ------------------------------------------------------------------ */
class El {
  constructor(tag, opts) {
    opts = opts || {};
    this.tag = tag;
    this.textContent = opts.textContent != null ? String(opts.textContent) : '';
    this.style = opts.style || {};
    this.dataset = Object.assign({}, opts.dataset || {});
    this.attrs = Object.assign({}, opts.attrs || {});
    this.hidden = !!opts.hidden;
    this.classes = new Set((opts.className || '').split(/\s+/).filter(Boolean));
    this.children = (opts.children || []).slice();
    for (const c of this.children) c.parentNode = this;
    this.parentNode = opts.parentNode || null;
    this.clicked = 0;
  }
  get classList() {
    const s = this.classes;
    return { contains: (c) => s.has(c), add: (c) => s.add(c), remove: (c) => s.delete(c) };
  }
  querySelector(sel) { return q(this, sel)[0] || null; }
  querySelectorAll(sel) { return q(this, sel); }
  click() { this.clicked++; return true; }
}
const desc = (el) => el.children.flatMap((c) => [c, ...desc(c)]);

// valor de um atributo: dataset['data-pocao'] para data-pocao, attrs para o resto
const pegaAttr = (el, nome) => {
  if (nome.slice(0, 5) === 'data-') { const k = nome.slice(5).replace(/-(\w)/g, (m, c) => c.toUpperCase()); return el.dataset[k]; }
  return el.attrs[nome] != null ? el.attrs[nome] : el.dataset[nome];
};
function casa(el, parte) {
  const m = parte.match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)((?:\[[^\]]+\])*)$/);
  if (!m) return false;
  if (m[1] && el.tag.toLowerCase() !== m[1].toLowerCase()) return false;
  for (const t of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (t[0] === '#') { if (String(el.attrs.id || el.dataset.id) !== t.slice(1)) return false; }
    else if (!el.classes.has(t.slice(1))) return false;
  }
  for (const a of (m[3] || '').match(/\[[^\]]+\]/g) || []) {
    const am = a.slice(1, -1).match(/^([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/);
    if (!am) return false;
    const v = am[2] != null ? am[2] : (am[3] != null ? am[3] : am[4]);
    const real = pegaAttr(el, am[1]);
    if (v === undefined) { if (real == null) return false; }
    else if (String(real) !== v) return false;
  }
  return true;
}
function q(raiz, sel) {
  const partes = String(sel).trim().split(/\s+/).filter(Boolean);
  let actuais = [raiz];
  for (let i = 0; i < partes.length; i++) {
    const ultima = i === partes.length - 1;
    const out = [];
    for (const pai of actuais) {
      for (const f of pai.children) {
        if (casa(f, partes[i])) { if (ultima) out.push(f); else out.push(f, ...desc(f)); }
      }
    }
    actuais = ultima ? out : [...new Set(out)];
  }
  return actuais;
}

class FakeDate extends Date { static now() { return clock.t; } }
let clock = { t: 0 };

function criarMundo(content, opts) {
  opts = opts || {};
  clock.t += 100000;            // cada mundo comeca num instante diferente
  const els = new Map();
  const timers = [];
  const storage = Object.assign({}, opts.storage || {});
  const raiz = new El('div');
  const documento = {
    documentElement: new El('html'),
    body: new El('body'),
    querySelector: (s) => q(raiz, s)[0] || null,
    querySelectorAll: (s) => q(raiz, s),
    getElementById: (id) => els.get(id) || null,
    createElement: (t) => new El(t),
    addEventListener: () => {},
  };
  const win = {
    document: documento, console, structuredClone, queueMicrotask,
    setTimeout, clearTimeout,
    setInterval: (fn, ms) => { timers.push({ ms, fn }); return timers.length; },
    clearInterval: () => {},
    MutationObserver: class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} takeRecords() { return []; } },
    postMessage: () => true,
    addEventListener: (t, fn) => { (win._l = win._l || {})[t] = fn; },
    removeEventListener: () => {},
  };
  win.window = win; win.self = win; win.globalThis = win;
  const chrome = {
    storage: {
      local: {
        get: (k, cb) => { const v = storage[k]; if (typeof cb === 'function') queueMicrotask(() => cb(v === undefined ? {} : { [k]: v })); return Promise.resolve({ [k]: v }); },
        set: (o, cb) => { Object.assign(storage, o); if (typeof cb === 'function') queueMicrotask(cb); return Promise.resolve(); },
      },
      onChanged: { addListener: () => {} },
    },
    runtime: { id: 'prova', sendMessage: async () => ({}) },
  };
  const sandbox = { window: win, self: win, globalThis: win, document: documento, chrome, console, structuredClone, queueMicrotask, setTimeout, clearTimeout, setInterval: win.setInterval, clearInterval: win.clearInterval, MutationObserver: win.MutationObserver, Date: FakeDate, Math, JSON, Number, String, RegExp, Object, Array, isFinite, parseInt, parseFloat };
  vm.createContext(sandbox);
  new vm.Script(content, { filename: 'extension/content.js' }).runInContext(sandbox);
  return {
    sandbox, win, documento, els, raiz,
    el: (tag, o) => new El(tag, o),
    montar: (id, el) => { els.set(id, el); el.attrs.id = id; raiz.children.push(el); el.parentNode = raiz; return el; },
    mensagem: (data) => win._l && win._l.message && win._l.message({ source: win, data }),
    /**
     * Deterministico: avanca o relogio controlado e dispara os intervalos.
     * publishStatus tem throttle de 800 ms (content.js:332), por isso o passo e de 1000 ms.
     */
    passo: async (ms, avancar) => {
      clock.t += avancar == null ? 1000 : avancar;
      for (const t of timers) if (t.ms === ms) t.fn();
      for (const t of timers) if (t.ms === 1000) t.fn();
    },
    live: () => win.__lolidleLive || null,
  };
}

/* ------------------------------------------------------------------ *
 * provas
 * ------------------------------------------------------------------ */
const content = fs.readFileSync(CONTENT, 'utf8');
let falhas = 0, total = 0;
const ok = (rot, cond, detalhe) => {
  total++;
  if (cond === true) console.log('  ok   ' + rot);
  else { falhas++; console.log('  FALHOU ' + rot + ' -> ' + (detalhe === undefined ? '' : String(detalhe))); }
};

// expressoes da versao ANTERIOR (transcricao fiel do que estava em content.js:74 e :82),
// so para registar o comportamento antigo - nao sao usadas pelo codigo de producao.

const pocPadrao = { vidaS: 3, vidaF: 5, vida: 40 };

function mundoHp(txt, largura, pocoes) {
  const m = criarMundo(content, {});
  m.montar('hud-vida-txt', m.el('span', { textContent: txt }));
  if (largura != null) m.montar('hud-vida', m.el('i', { style: { width: largura } }));
  for (const k of ['vidaS', 'vidaF', 'vida']) {
    const b = m.el('b', { textContent: String(pocoes[k] == null ? 0 : pocoes[k]) });
    const btn = m.el('button', { dataset: { pocao: k }, children: [b] });
    m.montar('hud-pocoes', m.el('div', { children: [btn] }));
  }
  m.montar('log', m.el('div', { children: [] }));
  m.montar('hud-alvo', m.el('div', { textContent: '' }));
  return m;
}

/** le o status pelo caminho REAL: tick() -> tentarPocao()/publishStatus() */
async function mundo(txt, largura, pocoes) {
  const m = mundoHp(txt, largura == null ? null : largura, pocoes || pocPadrao);
  await m.passo(300);
  return m;
}
const clicados = (m) => desc(m.raiz).filter((e) => e.tag === 'button' && e.clicked > 0).map((e) => String(e.dataset.pocao));

/* ============ 1) parseNum: o sufixo k/M tem de sobreviver ============ */
// expressoes da versao ANTERIOR (transcricao fiel do que estava em content.js:74 e :82),
// so para registar o comportamento antigo - nao sao usadas pelo codigo de producao.
const ANTES_parseNum = (s) => { const d = String(s == null ? '' : s).replace(/[^\d]/g, ''); return d ? Number(d) : NaN; };
const ANTES_re = /([\d.,]+)\s*\/\s*([\d.,]+)/;

(async () => {
  /* assercoes principais */
  console.log('\n== 1) parseNum com sufixo (defeito: content.js:74 apagava o k/M) ==');
  for (const caso of [
    ['12.3k / 20.4k', '60.29%', { cur: 12300, max: 20400 }],
    ['9.876 / 12.3k', '80.13%', { cur: 9876, max: 12300 }],
    ['4.188 / 4.476', '93.55%', { cur: 4188, max: 4476 }],
    ['3.000 / 4.188', '71.63%', { cur: 3000, max: 4188 }],
    ['4112 / 4188', '98.19%', { cur: 4112, max: 4188 }],
    ['900k / 1.2M', '75%', { cur: 900000, max: 1200000 }],
    ['12.3k / 20.4k (+1.2k)', '60.29%', { cur: 12300, max: 20400 }],
    ['12.3k / 20.4k', null, { cur: 12300, max: 20400 }],
    ['1.2M / 1.2M', null, { cur: 1200000, max: 1200000 }],
  ]) {
    const m = await mundo(caso[0], caso[1]);
    const hp = (m.live() || {}).hp;
    ok('readHP("' + caso[0] + '") -> ' + JSON.stringify(caso[2]),
      !!hp && hp.cur === caso[2].cur && hp.max === caso[2].max, 'veio ' + JSON.stringify(hp));
  }

  console.log('\n  -- o que a versao ANTERIOR fazia com os mesmos textos --');
  for (const txt of ['12.3k / 20.4k', '9.876 / 12.3k', '900k / 1.2M']) {
    const m = txt.match(ANTES_re);
    const antes = m ? { cur: ANTES_parseNum(m[1]), max: ANTES_parseNum(m[2]) } : null;
    console.log('     "' + txt + '"  ->  ' + (m ? 'cur=' + antes.cur + ' max=' + antes.max : 'regex NAO casava (cur/max = NaN -> gatilho morto)'));
  }
  {
    const m = '12.3k / 20.4k'.match(ANTES_re);
    ok('ANTES: "12.3k / 20.4k" nao casava a regex antiga (content.js:82) -> gatilho morto', m === null, 'match=' + JSON.stringify(m));
    const m2 = '9.876 / 12.3k'.match(ANTES_re);
    ok('ANTES: "9.876 / 12.3k" dava max=123 (content.js:74 apagava o k)',
      !!m2 && ANTES_parseNum(m2[2]) === 123, 'match=' + JSON.stringify(m2 && m2.slice(1)));
  }

  /* ============ 2) o gatilho em tempo real usa o valor CORRECTO ============ */
  console.log('\n== 2) gatilho da pocao (content.js:467-478 / choosePotion :266-319) ==');
  {
    const m = await mundo('12.3k / 20.4k', '60.29%');
    ok('12.3k/20.4k (39,7% perdido) bebe a Normal e decide com HP=12300',
      JSON.stringify(clicados(m)) === '["vida"]' && m.live().lastAction.hpBefore === 12300 && m.live().hp.cur === 12300,
      JSON.stringify({ clicou: clicados(m), last: m.live().lastAction, hp: m.live().hp }));
  }
  {
    const m = await mundo('7.5k / 20.4k', '36.76%');
    ok('7.5k/20.4k (63,2% perdido) bebe a Suprema', JSON.stringify(clicados(m)) === '["vidaS"]', JSON.stringify(clicados(m)));
  }
  {
    const m = await mundo('2.1k / 20.4k', '10.29%');
    ok('2.1k/20.4k (panico <15%) bebe a mais forte (Suprema)', JSON.stringify(clicados(m)) === '["vidaS"]', JSON.stringify(clicados(m)));
  }
  {
    const m = await mundo('7.5k / 20.4k', '36.76%', { vidaS: 0, vidaF: 2, vida: 9 });
    ok('7.5k/20.4k sem Suprema disponivel cai para a mais forte que ha (Forte)',
      JSON.stringify(clicados(m)) === '["vidaF"]', JSON.stringify(clicados(m)));
  }
  {
    const m = await mundo('3.000 / 4.188', '71.63%');
    ok('3.000/4.188 (inteiros, sem sufixo) continua a dar a Normal - sem regressao',
      JSON.stringify(clicados(m)) === '["vida"]' && m.live().hp.cur === 3000,
      JSON.stringify({ clicou: clicados(m), hp: m.live().hp }));
  }
  {
    const m = await mundo('4.150 / 4.188', '99.09%');
    ok('4.150/4.188 (99% cheio) nao bebe nada', clicados(m).length === 0, JSON.stringify(clicados(m)));
  }

  /* ============ 3) Rugido do Dragao: estado real em vez de palpite ============ */
  console.log('\n== 3) Rugido: motor.js:3107 (i.furiaT = 5) / motor.js:3085 (acaba) ==');
  {
    const m = await mundo('12.3k / 20.4k', '60.29%');
    ok('sem rugido: furia = false', m.live().furia === false, JSON.stringify(m.live().furia));
    m.mensagem({ __lolidleAuto: 'golpe', mec: 'rugido' });
    await m.passo(1000);
    ok('golpe rugido -> furia = true (fallback de 5 s, motor.js:3107)',
      m.live().furia === true, JSON.stringify(m.live().furia));
    m.mensagem({ __lolidleAuto: 'chefe-estado', furiaT: 0 });      // o motor desligou (motor.js:3085)
    await m.passo(1000);
    ok('chefe-estado furiaT=0 -> furia = false (o palpite de 5 s DEIXA de valer)',
      m.live().furia === false && m.live().furiaT <= 0,
      JSON.stringify({ furia: m.live().furia, furiaT: m.live().furiaT }));
    m.mensagem({ __lolidleAuto: 'chefe-estado', furiaT: 2.4 });
    await m.passo(1000);
    const rt = m.live().furiaT;
    ok('chefe-estado furiaT=2.4 -> furia = true e furiaT decai do valor do motor',
      m.live().furia === true && rt > 0 && rt <= 2.4, JSON.stringify({ furia: m.live().furia, furiaT: rt }));
    m.mensagem({ __lolidleAuto: 'chefe-estado', furiaT: 0 });
    await m.passo(1000);
    ok('furiaT=0 outra vez -> furia = false', m.live().furia === false, JSON.stringify(m.live().furia));
    m.mensagem({ __lolidleAuto: 'combate', furiaT: 4, out: { Q: 100 }, tomou: 5 });
    await m.passo(1000);
    ok('furiaT colado na mensagem combate tambem e lido', m.live().furia === true, JSON.stringify(m.live().furia));
    ok('...e o dano dessa mesma mensagem continua a ser contado (Q 100 nao se perde)',
      m.live().danoTotal.out === 100, JSON.stringify(m.live().danoTotal));
    m.mensagem({ __lolidleAuto: 'carga', mec: 'sopro', dur: 1 });
    await m.passo(1000);
    ok('carga de outra mecanica nao mexe no rugido', m.live().furia === true, JSON.stringify(m.live().furia));
  }
  {
    const m = await mundo('12.3k / 20.4k', '60.29%');
    m.mensagem({ __lolidleAuto: 'golpe', mec: 'rugido' });
    await m.passo(1000);
    ok('sem estado publicado, o golpe rugido continua a marcar 5 s (fallback)',
      m.live().furia === true, String(m.live().furia));
  }
  {
    const m = await mundo('12.3k / 20.4k', '60.29%');
    m.mensagem({ __lolidleAuto: 'chefe-estado', furia: true });
    await m.passo(1000);
    ok('chefe-estado com booleano furia=true -> fallback (furiaT continua null)',
      m.live().furia === true && m.live().furiaT === null,
      JSON.stringify({ furia: m.live().furia, furiaT: m.live().furiaT }));
  }
  {
    // CONTRATO REAL do inject.js:379/435 - snapshot do combate, com i.furiaT por inimigo
    const m = await mundo('12.3k / 20.4k', '60.29%');
    m.mensagem({ __lolidleAuto: 'golpe', mec: 'rugido' });
    await m.passo(1000);
    ok('golpe rugido (fallback) -> furia = true', m.live().furia === true, JSON.stringify(m.live().furia));
    // snapshot sem nenhum inimigo com furiaT > 0: o Rugido ja acabou no motor (motor.js:3085)
    m.mensagem({ __lolidleAuto: 'estado', v: 1, inimigos: [ { id: 1, nome: 'Lobo', furiaT: 0 }, { id: 2, nome: 'Dragao Infernal', chefe: true, mec: 'rugido', furiaT: 0 } ] });
    await m.passo(1000);
    ok('estado com todos os furiaT=0 -> furia = false (o palpite de 5 s deixa de valer)',
      m.live().furia === false && m.live().furiaT <= 0,
      JSON.stringify({ furia: m.live().furia, furiaT: m.live().furiaT }));
    // snapshot com o chefe em furia: le-se o campo do monstro
    m.mensagem({ __lolidleAuto: 'estado', v: 1, inimigos: [ { id: 2, nome: 'Dragao Infernal', chefe: true, mec: 'rugido', furiaT: 3.1 } ] });
    await m.passo(1000);
    ok('estado com inimigos[].furiaT=3.1 -> furia = true e furiaT decai',
      m.live().furia === true && m.live().furiaT > 1 && m.live().furiaT <= 3.1,
      JSON.stringify({ furia: m.live().furia, furiaT: m.live().furiaT }));
    // snapshot sem inimigos (todos mortos / fora de combate): mantem o ultimo valor lido (decai)
    m.mensagem({ __lolidleAuto: 'estado', v: 1, inimigos: [] });
    await m.passo(1000);
    ok('estado com lista vazia: 0 em Todos = Rugido acabou -> furia = false',
      m.live().furia === false && m.live().furiaT <= 0,
      JSON.stringify({ furia: m.live().furia, furiaT: m.live().furiaT }));
    // quem escolhe o maior: um inimigo em furia entre varios
    m.mensagem({ __lolidleAuto: 'estado', v: 1, inimigos: [ { id: 3, nome: 'Larva', invocado: true, furiaT: 0 }, { id: 4, nome: 'Tropa', furiaT: 1.4 } ] });
    await m.passo(1000);
    ok('estado com varios inimigos: le-se o MAIOR furiaT (1.4)',
      m.live().furia === true && m.live().furiaT > 0.3 && m.live().furiaT <= 1.4,
      JSON.stringify({ furia: m.live().furia, furiaT: m.live().furiaT }));
  }

  /* ============ 4) regressao do canal de eventos (refactor do listener) ============ */
  console.log('\n== 4) o listener de mensagens continua a contar combate/canvas ==');
  {
    const m = await mundo('12.3k / 20.4k', '60.29%');
    m.mensagem({ __lolidleAuto: 'combate', out: { Q: 400, ataque: 300 }, tomou: 900 });
    m.mensagem({ __lolidle: 'dmg', value: 512, color: '#ff6a3a', x: 10, y: 20 });
    m.mensagem({ __lolidle: 'heal', value: 300 });
    await m.passo(1000);
    const l = m.live();
    ok('eventos de combate continuam a somar (Q 400 + ataque 300 = 700)',
      l.danoTotal.out === 700 && l.dps.porSkill.Q === 400 && l.dps.porSkill.ataque === 300,
      JSON.stringify(l.danoTotal) + ' ' + JSON.stringify(l.dps.porSkill));
    ok('dano recebido continua a ser medido (900)', l.danoTotal.in === 900, String(l.danoTotal.in));
    ok('canvas dmg/heal continua a ser registado no historico',
      l.hist.some((e) => e.t === 'dmg' && e.v === 512 && e.dir === 'in') && l.hist.some((e) => e.t === 'heal' && e.v === 300),
      JSON.stringify(l.hist.filter((e) => e.t === 'dmg' || e.t === 'heal')));
  }

  console.log('\nPOPULATION ' + total + '  falhas=' + falhas);
  console.log(falhas ? 'rc=1' : 'rc=0');
  process.exit(falhas ? 1 : 0);
})();
