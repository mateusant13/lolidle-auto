
/* Smoke harness (descartavel): corre extension/gui.js num DOM universal falso. */
import fs from 'node:fs';
import vm from 'node:vm';

const GUI = fs.readFileSync('I:/!lolidle.com/extension/gui.js', 'utf8');
const registos = { html: new Map(), erros: [], acoes: [], miss: [] };

function el(id) {
  const o = {
    id: id || '',
    _html: '', _txt: '', className: '', title: '', value: '', checked: false, disabled: false, hidden: false,
    dataset: {}, style: {}, options: [], children: [], _listeners: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = String(v);
      registos.html.set(this.id, String(v));
      for (const m of this._html.matchAll(/id="([^"]+)"/g)) if (!porId.has(m[1])) porId.set(m[1], el(m[1]));
    },
    get textContent() { return this._txt; },
    set textContent(v) { this._txt = String(v); },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector() { return el(this.id + '::q'); },
    querySelectorAll() { return []; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    removeEventListener() {},
    closest() { return null; },
    contains() { return true; },
    getBoundingClientRect() { return { width: 10, height: 10 }; },
    dispatchEvent() { return true; },
    focus() {}, click() {}, remove() {},
  };
  return o;
}
const porId = new Map();
const doc = {
  readyState: 'complete',
  body: (() => {
    const b = el('body');
    b.appendChild = (c) => {
      porId.set(c.id, c);
      const html = String(c._html || '');
      for (const m of html.matchAll(/id="([^"]+)"/g)) if (!porId.has(m[1])) porId.set(m[1], el(m[1]));
      b.children.push(c);
      return c;
    };
    return b;
  })(), head: el('head'), documentElement: el('html'),
  getElementById(id) { if (!porId.has(id)) { registos.miss.push(id); return null; } return porId.get(id); },
  querySelector(sel) { return el('sel:' + sel); },
  querySelectorAll(sel) {
    if (sel === '#atributos .atrib') return [0,1,2,3,4].map((i) => {
      const e = el('atrib' + i);
      e.querySelector = (q) => (q === '.atrib-nome' ? { textContent: ['Força','Vitalidade','Resistência','Agilidade','Foco'][i] }
        : q === '[data-valor]' ? { textContent: String(10 + i) }
        : q === '[data-total]' ? { textContent: String(30 + i) }
        : { dataset: { atrib: ['forca','vitalidade','resistencia','agilidade','foco'][i] }, disabled: false });
      return e;
    });
    if (sel === '#lolidle-ap .tab') return [];
    if (sel === '#lolidle-ap .pane') return [];
    return [];
  },
  createElement() { return el('novo'); },
  addEventListener() {}, removeEventListener() {},
};
const storage = { lolidleAutoPotion: { enabled: true, automation: { objetivo: 'xp', minPotion: { vida: 200, vidaF: 100, vidaS: 30 } }, potions: { vidaS: { enabled: true, mode: 'pct', value: 60 }, vidaF: { enabled: true, mode: 'pct', value: 43 }, vida: { enabled: true, mode: 'pct', value: 21 } } },
  'lolidleAutoPotion:status': { at: Date.now(), hp: { cur: 3000, max: 4188, pct: 0.7 }, rates: { dmgRate: 120, healRate: 80, healSkillRate: 60, potionRate: 2, myDps: 900 }, dps: { out: 900, in: 120, porFonte: { Q: 400, ataque: 300 } }, target: { name: 'Lobo', level: 12 }, boss: true, bossHp: { nome: 'Dragão', pct: 42 }, carga: { mec: 'Fogo' }, furia: false, potions: { vidaS: { count: 12 }, vidaF: { count: 40 }, vida: { count: 300 } }, lastAction: { k: 'vidaF', reason: 'golpe 900' } },
  'lolidleAutoPotion:farm': { current: { region: 'Campo Azul nível 8–12', fase: 'mobs', startedAt: Date.now() - 120000, mobFase: { startedAt: Date.now() - 120000, gold: 2400, xp: 9000, potions: 6, kills: 40, dmg: 100000, heal: 5000, ctx: { mob3: { t: 60, heal: 3000, potion: 600 } } }, setup: { player: { nivel: 14 } } },
    cycles: [{ region: 'Campo Azul', boss: 'Dragão', fim: 'chefe', startedAt: Date.now() - 600000, endedAt: Date.now() - 300000, bossDurMs: 45000, mobFase: { perMin: { gold: 1200, xp: 4500, potions: 3 } }, bossFase: { perMin: { gold: 200 } } }],
    deaths: [{ at: Date.now() - 90000, by: 'Dragão', xpLost: 5000, region: 'Campo Azul', recursos: { ouro: 1000, nivel: 14, pocoes: { vida: 100, vidaF: 20, vidaS: 3 }, local: 'Campo Azul' } }],
    lutas: [{ at: Date.now() - 200000, boss: 'Dragão', mortes: 0, potUsadas: 12, durS: 45, build: ['3089'], analise: { outDps: 900, inDps: 120 }, est: { potTotal: 10, tKillS: 40 } }],
    log: [{ at: Date.now() - 5000, type: 'pause', acao: 'pausar' }, { at: Date.now() - 9000, type: 'base', ordem: ['cura'] }],
    issues: [{ at: Date.now() - 8000, type: 'base:venda', erro: 'timeout' }] },
  'lolidleAutoPotion:agregado': [{ region: 'Campo Azul', n: 5, deaths: 1, boss: 'Dragão', goldMin: 1200, xpMin: 4500, killsMin: 20, goldPotionMin: 60, risco: { morre: false, tMorrer: 40, dps: 300, danoGolpe: 900, intervalo: 1.5, mixTxt: 'N+F', custoPocaoS: 40, morte: false } }],
  'lolidleAutoPotion:plan': { at: Date.now(), gold: 250000, location: { text: 'Fonte' }, potions: { vida: 300, vidaF: 40, vidaS: 12 }, potionPlan: { faltas: ['vidaS'], comprar: { vidaS: 18, vidaF: 0, vida: 0 } }, region: 'Campo Azul' },
  'lolidleAutoPotion:meta': { at: Date.now(), locais: [{ id: 'campo-azul', nome: 'Campo Azul nível 8–12', chefe: ['Dragão'] }], itens: [{ id: '3089', nome: 'Rabadon', raridade: 'lendario' }, { id: '3100', nome: 'Lich Bane', raridade: 'lendario' }, { id: '6653', nome: 'Liandry', raridade: 'lendario' }], modelos: { equilibrado: { nome: 'Equilibrado', pesos: { forca: 2 } } }, dicaAtributos: 'Sobe Força.' } };

const chromeStub = {
  storage: {
    local: {
      get(keys, cb) { const out = {}; const ks = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {})); for (const k of ks) if (k in storage) out[k] = storage[k]; if (typeof cb === 'function') cb(out); return Promise.resolve(out); },
      set(obj, cb) { Object.assign(storage, obj); if (typeof cb === 'function') cb(); return Promise.resolve(); },
      remove(k, cb) { delete storage[k]; if (cb) cb(); return Promise.resolve(); },
    },
    onChanged: { addListener() {} },
  },
  runtime: { sendMessage() {}, reload() {} },
};

// ---- motor falso: TODAS as funcoes usadas, com formas REAIS de retorno
const S = () => ({ nome: 'Yasuo', classe: 'ad', perfil: 'assassino', id: 'yasuo' });
const AUTO = {
  getConfig: () => ({ enabled: true, objetivo: 'xp', regionDefault: null, autoEquip: true, autoAtrib: false, autoRefino: false, trocaItens: false, minPotion: { vida: 200, vidaF: 100, vidaS: 30 }, modeloAtrib: null }),
  setConfig: (p) => Object.assign(storage.lolidleAutoPotion.automation, p),
  getMeta: () => storage['lolidleAutoPotion:meta'],
  getFarm: () => storage['lolidleAutoPotion:farm'],
  readLocation: () => ({ text: 'Fonte', range: [8, 12] }),
  readGold: () => 250000,
  readPotions: () => ({ vida: 300, vidaF: 40, vidaS: 12 }),
  readSkills: () => ({ bar: [{ t: 'Q', nome: 'Tempestade', cd: 0, ready: true }, { t: 'E', nome: 'Vento', cd: 3, ready: false }], arsenal: [{ t: 'Q', name: 'Tempestade', rank: 5, maxRank: 10, onBar: true, max: false }, { t: 'R', name: 'Último Suspiro', rank: 0, maxRank: 5, onBar: false, max: false }], pontos: 3, pontosAtrib: 6, hudTexto: '3 de habilidade · 6 de atributo' }),
  readEquip: () => [{ base: '3089', qual: 'A', refino: 1, raridade: 'lendario', nome: 'Rabadon' }, { base: '3100', qual: 'B', refino: 0, raridade: 'lendario', nome: 'Lich Bane' }],
  readStats: () => ({ Dano: 120, Armadura: 60, 'Res. mágica': 40, Poder: 0, Mana: 400 }),
  player: () => ({ nivel: 14, vida: 4188, armadura: 60, rm: 40, dano: 120, poder: 0 }),
  identidadeCampeao: S, classeCampeao: () => 'ad', buildDaClasse: () => ['3089', '3100'], lendariosDaClasse: () => new Set(['3089', '3100']),
  buildIdeal: () => ['3089', '3100', '6653'],
  estado: () => ({ conta: { nivel: 14, ouro: 250000, local: 'Fonte' }, itens: [{ kind: 'item', base: '3100', nome: 'Lich Bane', qual: 'B', refino: 0, raridade: 'lendario' }], equipado: [{ base: '3089', nome: 'Rabadon', qual: 'A' }] }),
  scanBag: () => ({ cap: 20, used: 5, espacosEspolio: 1, items: [{ kind: 'item', base: '3100', qual: 'B', refino: 0, raridade: 'lendario' }, { kind: 'espolio', id: 'x', qty: 3 }] }),
  planBag: () => ({ acts: [{ action: 'VENDER_LOJISTA', it: { base: '3100', qual: 'B' }, why: 'lendário abaixo de A' }, { action: 'PROTEGER', it: { base: '3089', qual: 'A' }, why: 'Rabadon' }], espolios: [] }),
  dpsItens: () => ({ mob: { total: 900, porItem: [{ nome: 'Rabadon', dps: 300 }] }, chefe: { total: 700, porItem: [{ nome: 'Rabadon', dps: 200 }] } }),
  dpsPorHabilidade: () => ({ ap: 0, ad: 120, nivel: 14, habs: [{ t: 'Q', nome: 'Tempestade', rank: 5, dps: 300, cd: 3, naBarra: true }, { t: 'R', nome: 'Último Suspiro', rank: 0, dps: 0, cd: 60, naBarra: false }] }),
  ehUltimate: (t) => t === 'R',
  preverBuild: () => ({ assinatura: '3089,3100', mob: { goldMin: 1200, xpMin: 4500, fonte: 'historico', n: 5 }, chefe: { dps: 900, fonte: 'historico', n: 3 }, teorico: { mob: { dps: 800 }, chefe: { dps: 700 } }, confianca: { mob: 5, chefe: 3 } }),
  agregar: () => storage['lolidleAutoPotion:agregado'],
  recomendar: () => ({ regiao: 'Campo Azul nível 8–12', ouroLiquidoMin: 1140, xpMin: 4500, chefe: 'Dragão', sobrevive: true, mix: 'N+F', sinalUlt: false, ritmo: { seg3: 10 } }),
  rankRegioes: () => [{ id: 'campo-azul', nome: 'Campo Azul', xpMin: 4500, goldMin: 1200, runasH: 30, chefe: 'Dragão' }],
  regiaoIdeal: () => 'campo-azul', localId: (t) => 'campo-azul', viajarPara: () => {},
  diagnosticoBase: () => ({ enabled: true, pausado: false, naBase: true, motivo: 'mochila cheia', info: { used: 20, cap: 20, lixo: 2 }, idleMs: 200000, idleBaseMs: 180000, regiaoIdeal: 'campo-azul', trava: ['idle 200s < 180s'], ocupado: false, _baseBusy: false, baseLock: false }),
  saudeAutoplay: () => ({ ultimoTickHaMs: 1500, timers: 7, enabled: true, pausado: false }),
  estaPausado: () => false, pausar: () => ({ local: 'Fonte', ouro: 1, hp: { cur: 1, max: 2 } }), despausar: () => ({ diff: { ouro: 100, segundos: 20 } }),
  tarefaEstado: () => ({ tem: true, pronta: false, texto: 'Matar 20 lobos' }),
  planPotions: () => ({ faltas: ['vidaS'], comprar: { vidaS: 18, vidaF: 0, vida: 0 }, min: { vida: 200, vidaF: 100, vidaS: 30 } }),
  mercadoSaturado: () => false,
  testeEstado: () => ({ fase: 'mobs', i: 0, total: 2, nome: 'conjunto 1', regiao: 'campo-azul', mobSeg: 10, mobAlvo: 20, matandoChefe: false }),
  giroAtivo: () => false, iniciarGiro: () => ({ ok: true, lista: ['a', 'b'] }), pararGiro: () => ({ ok: true }),
  calibrar: () => ({ kXp: 1.05, kOuro: 0.98, n: 4 }),
  exportar: () => ({ ok: 1 }),
  // assincronas
  acaoBase: async () => ({ ok: true, ordem: ['cura', 'venda'], curaMs: 300, vendaMs: 900 }),
  curarBase: async () => true,
  reporPocoes: async () => ({ ok: true, feitos: { vida: 3000, vidaF: 0, vidaS: 0 } }),
  venderBase: async () => ({ ok: true, epicosVendidos: [1, 2], protegidos: [] }),
  guardarNoCofre: async () => ({ ok: true, base: '3100' }),
  abrirCofreTesoureira: async () => ({ ok: true, slots: 3 }),
  lerCofreSlots: () => [{ nome: 'Lich Bane', base: '3100', qual: 'B', refino: 0, qtd: 1 }],
  retirarDoCofre: async () => ({ ok: true, nome: 'Lich Bane', qual: 'B' }),
  anunciarLendarios: async () => ({ ok: true, anunciados: [{ base: '3100', qual: 'B' }, { base: '6653', qual: 'C', pulado: 'sem referência' }], cancelados: 1 }),
  comprarNoMercado: async () => ({ ok: true, compras: [{ base: '6653', nome: 'Liandry', preco: 180000, comprou: true }] }),
  refinarMelhores: async () => ({ ok: true, refinados: [{ base: '3089' }], fonteEssenciais: 'teorico' }),
  montarMelhorReceita: async () => ({ ok: true, alvo: '6653', nome: 'Liandry', vezes: 100, custoPrevisto: 120000 }),
  aceitarTarefa: async () => ({ ok: true, tipo: 'matar', min: 5, xp: 5000, ouro: 1000 }),
  entregarTarefa: async () => ({ ok: true, entregou: true }),
  aceitarDiarias: async () => ({ ok: true, aceitou: ['d1', 'd2'], quantas: 2 }),
  subirHabilidades: async () => ({ ok: true, gastos: 3 }),
  distribuirAtributos: async () => ({ ok: true, modelo: 'equilibrado', gastos: 6 }),
  rotacaoSkills: async () => ({ mudou: true, vagas: 1 }),
  trocarSkills: async () => ({ ok: true }),
  pegarPresentes: async () => ({ ok: true, pegos: ['premio-diario'] }),
  pularTutorial: () => true,
  lerMinhasOfertas: async () => [{ id: 1, nome: 'Lich Bane', raridade: 'lendario', qual: 'B', preco: 90000 }],
  planejarMercado: async () => ({ mercado: 5, minhas: 2, saturado: false, acoes: [{ acao: 'reanunciar', nome: 'Lich Bane', de: 90000, para: 81000 }] }),
  executarMercado: async () => ({ reajustados: 1, exec: [{ feito: true, nome: 'Lich Bane' }] }),
  receitasOrnn: async () => ({ ok: true, total: 2, receitas: [{ id: '6653', nome: 'Liandry', chance: '1,2%', tentativasMedias: 83, ouro: '1.200', comps: [{ nome: 'x', tem: true }], pode: true }] }),
  melhorCompra: async () => ({ ok: true, ouro: 250000, decisao: [{ item: 'Liandry', id: '6653', ofertaIdeal: { menor: 180000 }, esperaMin: 0, acao: 'COMPRAR O IDEAL agora' }], resumo: 'COMPRAR O IDEAL agora: Liandry' }),
  iniciarTeste: () => ({ ok: true, sets: 2 }),
  pararTeste: () => ({ ok: true }),
  necessidadesBase: () => ({ presente: false, cura: true, vender: true, repor: false, tarefa: true, hab: false, atrib: true, equip: false, cofre: true, mercado: false, comprar: false, refino: false, montar: false }),
  faltandoNaBase: (n) => Object.keys(n || {}).filter((k) => n[k] === true && ['presente','cura','vender','repor','tarefa','hab','atrib','equip','cofre','mercado','comprar','refino','montar'].indexOf(k) >= 0),
  barraIdeal: () => ['Q', 'W', 'E', 'R'],
  modeloAtribDe: () => 'dano',
  planejar: () => [{ item: '6653', nome: 'Liandry', zona: 'campo-azul', zonaNome: 'Campo Azul', chance: 0.0002, dropsH: 0.4, sobreviveMob: true, chefeFatal: false }],
  fecharMercado: () => {},
};

const contexto = vm.createContext({ window: null, document: doc, chrome: chromeStub, console, setTimeout: (f, t) => setTimeout(f, t), clearTimeout, setInterval: () => 0, clearInterval: () => {}, Blob: class { constructor() {} }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Promise, Object, Array, JSON, Number, String, Math, Date, isFinite, parseInt, parseFloat, RegExp, Error, Set, Map });
contexto.window = { __lolidleAuto: AUTO, __lolidleLive: { hp: { cur: 3000, max: 4188 }, dps: { out: 900, in: 120, porFonte: { Q: 400 } }, rates: { dmgRate: 120, healRate: 80, healSkillRate: 60, potionRate: 2, myDps: 900 }, target: { name: 'Lobo', level: 12 }, boss: true, bossHp: { nome: 'Dragão', pct: 42 }, carga: { mec: 'Fogo' }, furia: false }, __lolidleGuiTimers: [] };
contexto.window.document = doc;
contexto.window.chrome = chromeStub;

try {
  vm.runInContext(GUI, contexto, { filename: 'gui.js' });
} catch (e) {
  registos.erros.push('BOOT: ' + (e && e.stack || e));
}

const g = contexto.window.__lolidleGui;
if (!g) registos.erros.push('window.__lolidleGui nao foi exposto (boot falhou?)');
else {
  try { g.abrir(); } catch (e) { registos.erros.push('abrir: ' + (e && e.stack || e)); }
  for (const tab of ['agora', 'auto', 'itens', 'skills', 'atrib', 'farm', 'mercado', 'hist']) {
    try { g.setTab(tab); } catch (e) { registos.erros.push('tab ' + tab + ': ' + (e && e.stack || e)); }
  }
}

// exercitar TODAS as acoes pelo caminho real (listener de clique do painel)
const painel = porId.get('lolidle-ap');
const idsAcoes = ['ap-pin','ap-help','ap-aj-x','ap-auto-ligar','ap-auto-desligar','ap-farm-go','ap-cal','ap-giro','ap-testes','ap-export','ap-scan','ap-curar','ap-repor','ap-vender','ap-cofre-guardar','ap-anunciar','ap-comprar','ap-refinar','ap-montar','ap-tarefa','ap-entregar','ap-diaria','ap-pular-tutorial','ap-presentes','ap-reload','ap-ir-agora','ap-subir-habs','ap-rotacao','ap-trocar-skills','ap-distribuir','ap-pick','ap-modal-limpar','ap-modal-ok','ap-modal-x','ap-mk-ler','ap-mkt-plan','ap-mkt-go','ap-ornn-ler','ap-melhor-compra','ap-tx-add','ap-tx-base','ap-tx-run','ap-tx-stop','ap-tx-x','ap-cofre-ler','ap-cofre-melhor','ap-retomar','ap-panic2'];
const listener = (painel._listeners.click || [])[0];
if (!listener) registos.erros.push('sem listener de clique no painel');
else {
  for (const id of idsAcoes) {
    const alvo = { id, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, disabled: false, textContent: '', closest: (sel) => (sel === 'button[id]' ? alvo : null) };
    try { listener({ target: alvo, stopPropagation() {}, preventDefault() {} }); }
    catch (e) { registos.erros.push('acao ' + id + ': ' + (e && e.stack || e)); }
  }
}

// exercitar TODOS os controlos de mudanca (selects/checkboxes/numeros)
const listenerChange = (painel._listeners.change || [])[0];
const idsMudanca = ['ap-on','ap-obj','ap-reg-modo','ap-reg-id','ap-cfg-autoEquip','ap-cfg-trocaItens','ap-cfg-autoAtrib','ap-cfg-autoRefino','ap-at-modelo-sel','ap-pc-on-vidaS','ap-pc-v-vidaS','ap-pc-m-vidaS','ap-pc-combine','ap-pc-strongest','ap-pc-smart','ap-min-vida','ap-min-vidaF','ap-min-vidaS'];
if (!listenerChange) registos.erros.push('sem listener de mudanca no painel');
else for (const id of idsMudanca) {
  for (const valor of ['auto', 'fixa', 'ouro', 'xp', 'pct', 'lost', '100', 0]) {
    const alvo = { id, value: valor, checked: true, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, closest: () => null };
    try { listenerChange({ target: alvo, stopPropagation() {}, preventDefault() {} }); }
    catch (e) { registos.erros.push('mudanca ' + id + '=' + valor + ': ' + (e && e.message || e)); }
  }
}

// testar a remocao de um chip de item escolhido (delegacao no painel)
try {
  const alvo = { dataset: { rem: '6653' }, closest: (s2) => (s2 === '[data-rem]' ? alvo : null) };
  listener({ target: alvo, stopPropagation() {}, preventDefault() {} });
  registos.erros.push('REMOVIDO-CHIP-OK');
} catch (e) { registos.erros.push('remover chip: ' + e); }

// esperar promessas das acoes assincronas
await new Promise((r) => setTimeout(r, 400));

// verificacoes de conteudo
const problemas = [];
for (const [id, html] of registos.html) {
  if (/undefined|NaN|\[object Object\]|null%/.test(html)) problemas.push(id + ' -> ' + html.match(/.{0,60}(undefined|NaN|\[object Object\]|null%).{0,40}/)[0]);
}
const fb = porId.get('ap-fb');
console.log('=== ERROS ===');
console.log(registos.erros.length ? registos.erros.join('\n') : '(nenhum)');
console.log('=== IDS PEDIDOS MAS INEXISTENTES NO HTML ===');
console.log([...new Set(registos.miss)].filter((x) => x.indexOf('ap-') === 0 || x.indexOf('lolidle') === 0).join(' ') || '(nenhum)');
console.log('=== HTML SUSPEITO ===');
console.log(problemas.length ? problemas.slice(0, 20).join('\n') : '(nenhum)');
console.log('=== FEEDBACK FINAL ===');
console.log(fb ? fb.innerHTML : '(sem rodape)');
console.log('=== ELEMENTOS COM HTML (amostra) ===');
console.log([...registos.html.keys()].slice(0, 60).join(' '));
console.log('total de elementos desenhados:', registos.html.size);
if (process.env.DUMP) {
  for (const id of process.env.DUMP.split(',')) {
    console.log('\n===== ' + id + ' =====');
    const el2 = porId.get(id);
    console.log((el2 && (el2._html || el2._txt)) || '(vazio)');
  }
}
