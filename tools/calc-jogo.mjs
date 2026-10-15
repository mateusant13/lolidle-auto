#!/usr/bin/env bun
/*
 * tools/calc-jogo.mjs - A CALCULADORA DO JOGO (frente "tudo calculavel a partir do motor").
 *
 * O QUE E: le docs/game-src/motor.js como TEXTO, extrai TODAS as declaracoes de topo
 * (funcoes e constantes) e avalia-as num sandbox com as dependencias reais (itens.js,
 * balanco.js, dados.js). Cada valor que sai daqui carrega o file:linha de onde veio.
 *
 * PORQUE ASSIM: motor.js NAO e importavel (motor.js:2-11 importa dados-ezreal/yasuo/lux/
 * katarina/taric/zac.js, que nao existem em docs/game-src). Ler o texto e a unica forma de
 * acompanhar o jogo "hoje ou daqui a 10 anos" sem copiar numeros a mao (AGENTS.md regra 3).
 *
 * NAO ESCREVE NADA. Nao toca em browser/CDP/jogo. So le ficheiros e imprime.
 *
 * USO:
 *   bun tools/calc-jogo.mjs              relatorio de validacao completo
 *   bun tools/calc-jogo.mjs --json       o mesmo, em JSON (para outras ferramentas)
 *   bun tools/calc-jogo.mjs --api        so o indice anotado (nome -> motor.js:linha)
 *   bun tools/calc-jogo.mjs --expr "infoItem('4629+3~A')"   calcula uma expressao
 *
 * COMO OUTRA FERRAMENTA USA ISTO:
 *   import { carregar } from './calc-jogo.mjs';
 *   const C = carregar();
 *   C.valor('CURVA').hp(30);            // 4050   (motor.js:274)
 *   C.linhaDeChave('CURVA', 'hp');      // 274
 *   C.info('infoItem');                 // { nome, tipo, ini, fim, fonte, texto, estado }
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const lerRel = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

// =====================================================================================
// 1) VARREDOR: acha o fim de uma declaracao e os nomes que ela declara
// =====================================================================================
// Um '/' e inicio de regex se o caracter significativo anterior for um destes
// (motor.js tem regex em search(), exec() e test(); sem isto o scanner confundiria
//  /\+(\d+)/ com uma divisao e perderia a contagem de profundidade).
const ANTES_DE_REGEX = '([{,;:=!&|?+-*%~^<>';

function fimDaDeclaracao(L, inicio) {
  let depth = 0, viuChave = false, str = null, bloco = false, regex = false, classe = false;
  for (let i = inicio; i < L.length; i++) {
    const linha = L[i];
    for (let j = 0; j < linha.length; j++) {
      const c = linha[j], n = linha[j + 1];
      if (bloco) { if (c === '*' && n === '/') { bloco = false; j++; } continue; }
      if (str) { if (c === '\\') { j++; continue; } if (c === str) str = null; continue; }
      if (regex) { if (c === '\\') { j++; continue; } if (c === '[') classe = true; else if (c === ']') classe = false; else if (c === '/' && !classe) regex = false; continue; }
      if (c === '/' && n === '/') break;
      if (c === '/' && n === '*') { bloco = true; j++; continue; }
      if (c === '"' || c === "'" || c === '`') { str = c; continue; }
      if (c === '/') { const ant = linha.slice(0, j).trimEnd().slice(-1); if (!ant || ANTES_DE_REGEX.includes(ant)) { regex = true; continue; } }
      if (c === '{' || c === '(' || c === '[') { depth++; if (c === '{' && depth === 1) viuChave = true; }
      else if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0 && viuChave) return i; }
      else if (c === ';' && depth === 0) return i;
    }
    if (!viuChave && depth === 0 && i > inicio) return i - 1;
  }
  return L.length - 1;
}

// Nomes declarados por um "const/let A = ..., B = ..." no NIVEL 0. Parametros de funcao
// (ex.: "(ini, passo, n = 10) =>") estao a profundidade 1 e NAO contam.
function nomesDeclarados(texto, primeiro) {
  const nomes = [primeiro];
  let depth = 0, str = null, regex = false, classe = false;
  for (let j = 0; j < texto.length; j++) {
    const c = texto[j], n = texto[j + 1];
    if (str) { if (c === '\\') { j++; continue; } if (c === str) str = null; continue; }
    if (regex) { if (c === '\\') { j++; continue; } if (c === '[') classe = true; else if (c === ']') classe = false; else if (c === '/' && !classe) regex = false; continue; }
    if (c === '/' && n === '/') break;
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; continue; }
    if (c === ',' && depth === 0) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(texto.slice(j + 1));
      if (m) nomes.push(m[1]);
    }
  }
  return [...new Set(nomes)];
}

// =====================================================================================
// 2) SANDBOX: o motor a correr com as dependencias reais
// =====================================================================================
// dados-ezreal/yasuo/lux/katarina/taric/zac.js nao existem. Para os objetos literais
// (nomes, descricoes) nao rebentarem, injecta-se um proxy inerte: qualquer propriedade
// devolve-se a si mesmo e qualquer uso aritmetico LANCA (nunca devolve NaN calado).
function inerte() {
  const p = new Proxy(function () {}, {
    get(t, k) { if (typeof k === 'symbol') return undefined; return p; },
    has() { return true; },
    ownKeys() { return []; },
    getOwnPropertyDescriptor() { return undefined; },
    apply() { return p; },
  });
  return p;
}

// Math com random deterministico (mulberry32): permite AMOSTRAR as formulas aleatorias
// (gerarGrupo, sortearQualidade, sortearLoot) e comparar com as medicoes, sem inventar.
export function mathSemente(semente = 1) {
  let a = semente >>> 0;
  const M = Object.create(Math);
  M.random = () => { a = (a + 0x6D2B79F5) >>> 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  return M;
}

export function carregarMotor(opcoes = {}) {
  const relMotor = opcoes.motor || 'docs/game-src/motor.js';
  const relItens = opcoes.itens || 'docs/game-src/itens.js';
  const relBalanco = opcoes.balanco || 'docs/game-src/balanco.js';
  const relDados = opcoes.dados || 'docs/game-src/dados.js';

  const textoMotor = opcoes.texto != null ? opcoes.texto : lerRel(relMotor);
  const L = textoMotor.split(/\r?\n/);
  const textoItens = lerRel(relItens);
  const textoBalanco = lerRel(relBalanco);

  // itens.js e balanco.js sao dados puros: extrai-se o literal e faz-se JSON.parse
  // (importar itens.js daria o catalogo ja poluido pelos Object.assign de motor.js:16-26).
  const ITENS_DADOS = JSON.parse(textoItens.slice(textoItens.indexOf('['), textoItens.lastIndexOf(']') + 1));
  const BALANCO = JSON.parse(textoBalanco.slice(textoBalanco.indexOf('['), textoBalanco.lastIndexOf(']') + 1));
  // dados.js (Darius) tambem e JSON puro gerado: le-se como texto, sem import
  let DADOS = null, erroDados = null;
  try {
    const txtDados = lerRel(relDados);
    DADOS = JSON.parse(txtDados.slice(txtDados.indexOf('{'), txtDados.lastIndexOf('}') + 1));
  } catch (e) { erroDados = String(e.message || e); }

  // ---- indice de declaracoes de topo ----
  const decls = [];
  L.forEach((linha, i) => {
    const m = /^(?:export\s+)?(?:async\s+)?(function|const|let)\s+([A-Za-z_$][\w$]*)/.exec(linha);
    if (!m) return;
    decls.push({ nome: m[2], tipo: m[1], ini: i, exportada: linha.startsWith('export') });
  });
  for (const d of decls) {
    d.fim = fimDaDeclaracao(L, d.ini);
    d.texto = L.slice(d.ini, d.fim + 1).join('\n').replace(/^export\s+/, '');
    d.nomes = d.tipo === 'function' ? [d.nome] : nomesDeclarados(d.texto, d.nome);
  }

  // ---- registo + proxy (with) ----
  const reg = new Map();
  reg.set('ITENS_DADOS', ITENS_DADOS);
  reg.set('BALANCO', BALANCO);
  reg.set('DADOS', opcoes.DADOS ?? DADOS);
  if (opcoes.seed != null) reg.set('Math', mathSemente(opcoes.seed));
  reg.set('DADOS_EZREAL', inerte());
  reg.set('DADOS_YASUO', inerte());
  reg.set('DADOS_LUX', inerte());
  reg.set('DADOS_KATARINA', inerte());
  reg.set('DADOS_TARIC', inerte());
  reg.set('DADOS_ZAC', inerte());
  reg.set('t', (x) => x);
  reg.set('ingles', false);

  const escopo = new Proxy({}, {
    has: (t, k) => typeof k === 'string' && reg.has(k),
    get: (t, k) => (typeof k === 'symbol' ? undefined : reg.get(k)),
    set: (t, k, v) => { reg.set(k, v); return true; },
  });

  const aval = (d) => {
    const corpo = d.tipo === 'function'
      ? 'with(__s){ return (' + d.texto + '); }'
      : 'with(__s){ return (()=>{ ' + d.texto + '\n; return { ' + d.nomes.map((n) => n + ': ' + n).join(', ') + ' }; })(); }';
    return new Function('__s', corpo)(escopo);
  };

  // ---- UNIDADES: declaracoes E statements de topo, ambos, por ordem do ficheiro ----
  // Sem os statements de topo o motor fica mentiroso: POR_CLASSE/POR_RARIDADE (motor.js:50 e
  // motor.js:408) alimentam os pools de loot, e motor.js:407 e que prende os drops em cada local.
  const cobertas = new Array(L.length).fill(false);
  for (const d of decls) for (let k = d.ini; k <= d.fim; k++) cobertas[k] = true;
  const unidades = decls.map((d) => ({ ...d, unidade: 'declaracao', nomeU: d.nome }));
  const imports = [];
  let pos = 0;
  while (pos < L.length) {
    if (cobertas[pos]) { pos++; continue; }
    const txt = L[pos].trim();
    if (!txt || txt.startsWith('//') || txt.startsWith('*') || txt.startsWith('/*')) { pos++; continue; }
    const f = fimDaDeclaracao(L, pos);
    const trecho = L.slice(pos, f + 1).join('\n');
    if (txt.startsWith('import ')) {
      const m = /from\s+'([^']+)'/.exec(trecho) || /from\s+"([^"]+)"/.exec(trecho);
      imports.push({ ini: pos + 1, fim: f + 1, texto: trecho, de: m ? m[1] : null });
    } else {
      unidades.push({ nome: 'statement@' + (pos + 1), nomeU: 'statement@' + (pos + 1), tipo: 'statement', ini: pos, fim: f,
        exportada: false, texto: trecho, nomes: [], unidade: 'statement' });
    }
    pos = f + 1;
  }
  unidades.sort((a, b) => a.ini - b.ini);
  for (const imp of imports) {
    const rel = (imp.de || '').replace(/^\.\//, '');
    imp.ficheiro = rel ? 'docs/game-src/' + rel : null;
    imp.existe = imp.ficheiro ? fs.existsSync(path.join(RAIZ, imp.ficheiro)) : false;
  }

  // ---- fixpoint: cada unidade em isolamento; o que falha fica registado com o erro ----
  const avalStatement = (u) => new Function('__s', 'with(__s){ ' + u.texto + '\n}')(escopo);
  let pendentes = [...unidades], passos = 0;
  const erros = new Map();
  while (pendentes.length && passos < 8) {
    passos++;
    const proximos = [];
    for (const u of pendentes) {
      try {
        if (u.unidade === 'declaracao') {
          const v = aval(u);
          if (u.tipo === 'function') reg.set(u.nome, v);
          else for (const n of u.nomes) reg.set(n, v[n]);
        } else avalStatement(u);
        erros.delete(u.nomeU);
      } catch (e) { proximos.push(u); erros.set(u.nomeU, String((e && e.message) || e)); }
    }
    if (proximos.length === pendentes.length) break;
    pendentes = proximos;
  }

  // os Object.assign de motor.js:16-26 ficam como remendos do catalogo, para constar no relatorio
  const remendos = unidades.filter((u) => u.unidade === 'statement' && /^Object\.assign\(ITENS\[/.test(u.texto))
    .map((u) => ({ ini: u.ini + 1, fim: u.fim + 1, texto: u.texto, id: (/'([\w]+)'/.exec(u.texto) || [])[1] || null, ok: !erros.has(u.nomeU), erro: erros.get(u.nomeU) || null }));

  const info = new Map(decls.map((d) => [d.nome, {
    nome: d.nome, tipo: d.tipo, exportada: d.exportada,
    ini: d.ini + 1, fim: d.fim + 1, nomes: d.nomes,
    fonte: relMotor + ':' + (d.ini + 1) + (d.fim > d.ini ? '-' + (d.fim + 1) : ''),
    texto: d.texto, estado: erros.has(d.nome) ? 'falha' : 'ok', erro: erros.get(d.nome) || null,
  }]));

  // linha de uma CHAVE dentro do objeto extraido (ex.: CURVA.hp -> motor.js:274)
  const linhaDeChave = (nomeDecl, chave) => {
    const d = info.get(nomeDecl); if (!d) return null;
    const esc = String(chave).replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
    const re = new RegExp('(^|[\\s{,])[\'"]?' + esc + '[\'"]?\\s*:');
    for (let i = d.ini - 1; i <= d.fim - 1; i++) if (re.test(L[i])) return i + 1;
    return null;
  };
  const valor = (nome) => reg.get(nome);
  const fonte = (nome) => (info.get(nome) ? info.get(nome).fonte : null);
  const textoDe = (nome) => (info.get(nome) ? info.get(nome).texto : null);
  const call = (nome) => { const f = valor(nome); if (typeof f !== 'function') throw new Error(nome + ' nao e funcao'); return f; };

  return {
    fonteMotor: relMotor, linhasMotor: L.length, shaMotor: sha256(textoMotor),
    fonteItens: relItens, nItens: ITENS_DADOS.length, shaItens: sha256(textoItens),
    fonteBalanco: relBalanco, nBalanco: BALANCO.length, fonteDados: relDados, erroDados,
    decls: [...info.values()], falhas: [...info.values()].filter((d) => d.estado === 'falha'),
    statements: unidades.filter((u) => u.unidade === 'statement').map((u) => ({ nome: u.nomeU, ini: u.ini + 1, fim: u.fim + 1, fonte: relMotor + ':' + (u.ini + 1) + (u.fim > u.ini ? '-' + (u.fim + 1) : ''), texto: u.texto, estado: erros.has(u.nomeU) ? 'falha' : 'ok', erro: erros.get(u.nomeU) || null })),
    imports,
    remendos, ITENS_DADOS, BALANCO, passos,
    valor, fonte, texto: textoDe, info: (n) => info.get(n) || null, linhaDeChave, L, call,
    // avalia uma expressao com TODAS as formulas do motor no escopo (modo --expr)
    avaliar: (expr) => new Function('__s', 'with(__s){ return (' + expr + '); }')(escopo),
    // compila um TRECHO literal do motor (ex.: o lado direito da linha 529) com nomes ligados:
    //   C.trecho(expr, ['tem','pct'])({ tem, pct })  -> valor da expressao, tal como esta no ficheiro
    trecho: (expr, nomes = []) => (ligacoes = {}) =>
      new Function('__s', '__b', 'with(__s){ const { ' + nomes.join(', ') + ' } = __b; return (' + expr + ');\n}')(escopo, ligacoes),
    // texto de uma linha do motor (1-based)
    linhaTexto: (n) => L[n - 1],
  };
}

export const carregar = carregarMotor;
export default carregarMotor;

// =====================================================================================
// 3) MEDICOES (docs/snapshots) - so leitura
// =====================================================================================
export function lerSnapshots(dirRel = 'docs/snapshots') {
  const dir = path.join(RAIZ, dirRel);
  const out = { dir: dirRel, avisos: [], ficheiros: {} };
  const quer = ['player', 'status', 'bag', 'bosses', 'potions', 'katarina', 'farm', 'dps', 'ciclos', 'skills', 'market'];
  for (const nome of quer) {
    const f = path.join(dir, nome + '.json');
    if (!fs.existsSync(f)) { out.avisos.push('ausente: ' + dirRel + '/' + nome + '.json'); continue; }
    try {
      let d = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (typeof d === 'string') d = JSON.parse(d);
      out[nome] = d; out.ficheiros[nome] = dirRel + '/' + nome + '.json';
    } catch (e) { out.avisos.push('ilegivel: ' + nome + '.json (' + e.message + ')'); }
  }
  return out;
}

// =====================================================================================
// 4) COMPARADORES
// =====================================================================================
const casasDe = (v) => { const s = String(v); const i = s.indexOf('.'); return i < 0 ? 0 : Math.min(6, s.length - i - 1); };
const arred = (v, c) => Number(Math.round(v * 10 ** c) / 10 ** c);
const igual = (a, b) => arred(a, casasDe(b)) === b;
const numPt = (s) => {
  const x = String(s).trim();
  if (x.includes(',')) return Number(x.replace(/\./g, '').replace(',', '.'));   // 1.234,5 -> 1234.5
  const m = /^(\d+)\.(\d{1,2})$/.exec(x);                                       // 67.5 -> 67.5
  if (m) return Number(x);
  return Number(x.replace(/\./g, ''));                                           // 3.195 -> 3195
};
const P = (v, casas = 3) => {
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  let s = v.toFixed(casas);
  if (/^-/.test(s)) s = '-' + s.slice(1);
  return String(+s);
};
const lista = (o) => Object.entries(o).map(([k, v]) => k + '=' + P(v)).join(' ');

// ---- 4.1 MONSTROS / LOCAIS contra bosses.json (capturado do jogo) ----
export function conferirMonstros(C, S) {
  const med = S.bosses && S.bosses.monstros;
  const calc = C.valor('MONSTROS');
  const divs = []; let campos = 0;
  if (!med) return { id: 'monstros', titulo: 'MONSTROS x bosses.json', fonte: C.fonte('MONSTROS'), ok: false, resumo: 'sem medicao', divs: [{ onde: '-', campo: '-', medido: 'sem bosses.json', calculado: '-', fonte: C.fonte('MONSTROS') }] };
  for (const nome of Object.keys(med)) {
    const m = med[nome], c = calc[nome];
    if (!c) { divs.push({ onde: nome, campo: '*', medido: 'existe', calculado: 'AUSENTE', fonte: C.fonte('MONSTROS') }); continue; }
    for (const k of new Set([...Object.keys(m), ...Object.keys(c)])) {
      campos++;
      if (JSON.stringify(m[k]) !== JSON.stringify(c[k])) divs.push({ onde: nome, campo: k, medido: m[k], calculado: c[k], fonte: C.linhaDeChave('MONSTROS', nome) });
    }
  }
  for (const nome of Object.keys(calc)) if (!(nome in med)) divs.push({ onde: nome, campo: '*', medido: 'AUSENTE', calculado: 'existe', fonte: C.linhaDeChave('MONSTROS', nome) });
  return { id: 'monstros', titulo: 'MONSTROS x bosses.json (medido)', fonte: C.fonte('MONSTROS'), ok: divs.length === 0, campos, n: Object.keys(med).length, divs };
}

export function conferirLocais(C, S) {
  const med = S.bosses && S.bosses.locais;
  const calc = C.valor('LOCAIS');
  const divs = []; let campos = 0;
  if (!med) return { id: 'locais', titulo: 'LOCAIS x bosses.json', fonte: C.fonte('LOCAIS'), ok: false, resumo: 'sem medicao', divs: [] };
  for (const l of med) {
    const c = calc.find((x) => x.id === l.id);
    if (!c) { divs.push({ onde: l.id, campo: '*', medido: 'existe', calculado: 'AUSENTE', fonte: C.fonte('LOCAIS') }); continue; }
    for (const k of Object.keys(l)) {
      campos++;
      if (JSON.stringify(l[k]) !== JSON.stringify(c[k])) divs.push({ onde: l.id, campo: k, medido: l[k], calculado: c[k], fonte: C.linhaDeChave('LOCAIS', l.id) });
    }
  }
  return { id: 'locais', titulo: 'LOCAIS x bosses.json (medido)', fonte: C.fonte('LOCAIS'), ok: divs.length === 0, campos, n: med.length, divs };
}

// ---- 4.2 itens: infoItem + valorVenda + dica ----
function daDica(dica) {
  const g = (re) => { const m = re.exec(dica || ''); return m ? numPt(m[1]) : null; };
  const pm = /Poder: ([\d.,]+) [^0-9]*([\d.,]+)/.exec(dica || '');
  return {
    ap: g(/\+([\d.,]+) poder de habilidade/), vida: g(/\+([\d.,]+) vida/),
    armadura: g(/\+([\d.,]+) armadura/), rm: g(/\+([\d.,]+) res\. mágica/),
    recarga: g(/[−-]([\d.,]+)% recarga/), pen: g(/([\d.,]+)% de penetração mágica/),
    venda: g(/Vale ([\d.,]+) de ouro/), poder: pm ? [numPt(pm[1]), numPt(pm[2])] : null,
  };
}
export function conferirItens(C, S) {
  const infoItem = C.call('infoItem'), valorVenda = C.call('valorVenda');
  const fontes = [];
  if (S.bag && Array.isArray(S.bag.items)) for (const it of S.bag.items) if (it.kind === 'item') fontes.push({ origem: 'bag.json', ...it, venda: it.vendaLojista });
  if (S.farm && S.farm.current && S.farm.current.setup && Array.isArray(S.farm.current.setup.equip)) for (const it of S.farm.current.setup.equip) fontes.push({ origem: 'farm.json (equipado)', ...it, venda: null });
  const divs = [], vistos = new Set(), notas = [], linhas = []; let campos = 0, itens = 0;
  const dicas = {};
  const exemplos = [];
  for (const it of fontes) {
    itens++;
    const calc = infoItem(it.id), d = daDica(it.dica);
    const par = (campo, medido, calculado, extra = {}) => {
      campos++;
      if (!igual(calculado, medido)) divs.push({ onde: it.id, campo, medido, calculado: arred(calculado, casasDe(medido)), fonte: C.fonte('infoItem'), dicaTxt: it.dica, ...extra });
    };
    if (it.stats) for (const k of ['ad', 'ap', 'mana', 'vida', 'armadura', 'rm', 'cdr', 'penMag']) {
      if (it.stats[k] === undefined) continue;
      par('stats.' + k, it.stats[k], calc[k] ?? 0);
    }
    if (it.venda != null) par('vendaLojista', it.venda, valorVenda(it.id), { fonte: C.fonte('valorVenda') });
    if (d.venda != null) par('dica.venda', d.venda, valorVenda(it.id), { fonte: C.fonte('valorVenda') });
    if (d.vida != null) par('dica.vida', d.vida, calc.vida);
    if (d.ap != null) par('dica.poder de habilidade', d.ap, calc.ap);
    if (d.armadura != null) par('dica.armadura', d.armadura, calc.armadura);
    if (d.rm != null) par('dica.res. magica', d.rm, calc.rm);
    if (d.recarga != null) par('dica.recarga %', d.recarga, calc.cdr * 100);
    if (d.pen != null) {
      const penCat = (C.valor('ITENS')[it.base] || {}).penMag;
      if (penCat != null) par('dica.penetracao magica %', d.pen, penCat * 100, { fonte: C.fonteItens + ' (campo penMag)' });
      else notas.push(it.id + ': a dica diz ' + d.pen + '% de penetracao magica mas o catalogo nao tem penMag (efeito estatico). O motor aplica o pen magico do item em motor.js:529, e o de um item especifico tambem la.');
    }
    if (it.origem === 'farm.json (equipado)' && !vistos.has(it.id)) {
      vistos.add(it.id);
      exemplos.push({ id: it.id, ap: calc.ap, vida: calc.vida, cdr: calc.cdr, penMag: calc.penMag, venda: valorVenda(it.id), dica: it.dica, stats: it.stats, fonte: C.fonte('infoItem') });
    }
  }
  linhas.push('restam ' + divs.length + ' diferencas, em duas familias, ambas explicadas:');
  const famArm = divs.filter((d) => d.campo === 'stats.armadura');
  if (famArm.length) {
    const id0 = famArm[0].onde, base0 = famArm[0].onde.split('~')[0];
    const motor0 = C.call('infoItem')(id0).armadura;
    const dica0 = daDica(famArm[0].dicaTxt || '').armadura;
    linhas.push('  (1) ' + famArm.length + ' em stats.armadura: o bag.json grava 10x o valor do motor (' + famArm.map((d) => d.onde + ' ' + d.medido + ' vs ' + arred(d.calculado, 2)).join('; ') + ').');
    linhas.push('      o motor da ' + P(motor0, 2) + ' para ' + id0 + ' (' + C.fonte('infoItem') + '; preco/armadura base em ' + C.fonteItens + ') e a DICA do MESMO item tambem diz ' + (dica0 == null ? '?' : P(dica0, 2)) + ' armadura -> quem escreveu o snapshot e que multiplicou por 10.');
  }
  const famPen = divs.filter((d) => d.campo === 'stats.penMag');
  if (famPen.length) linhas.push('  (2) ' + famPen.length + ' em stats.penMag: o farm.json grava o pen magico que vem do caso especial do item (' + famPen.map((d) => d.onde + ' ' + d.medido).join('; ') + '). No motor esse valor NAO vem do catalogo: entra em motor.js:529 (tem(3135) ? 0.4 : 0) somado a pct.penMag. Unico sitio em que a extensao mostra um numero que o motor so calcula em combate.');
  linhas.push('fora isso: ' + (itens - (famArm.length ? 1 : 0)) + ' itens x stats x dicas x valorVenda coincidem campo a campo.');
  return { id: 'itens', titulo: 'infoItem/valorVenda x bag.json + farm.json (dicas e stats)', fonte: C.fonte('infoItem'), ok: divs.length === 0, itens, campos, divs, exemplos, notas, linhas };
}

// ---- 4.3 poder() contra a dica "Poder: A -> B" ----
export function conferirPoder(C, S) {
  const poder = C.call('poder'), espacoDe = C.call('espacoDe');
  const eq = (S.farm && S.farm.current && S.farm.current.setup && S.farm.current.setup.equip) ? S.farm.current.setup.equip.map((e) => e.id) : null;
  const nivel = (S.farm && S.farm.current && S.farm.current.setup && S.farm.current.setup.player && S.farm.current.setup.player.nivel) || (S.player && S.player.nivel) || null;
  const divs = [], linhas = [];
  if (!eq || nivel == null) return { id: 'poder', titulo: 'poder() x dica', fonte: C.fonte('poder'), ok: false, resumo: 'sem farm.json com equip/nivel', divs: [] };
  const calcEq = poder({ nivel, itens: eq });
  linhas.push('poder(' + nivel + ', [' + eq.join(', ') + ']) = ' + P(calcEq) + '   ' + C.fonte('poder') + ' (precos/itens: ' + C.fonte('valorVenda') + ')');
  const bag = (S.bag && Array.isArray(S.bag.items)) ? S.bag.items.filter((i) => i.kind === 'item') : [];
  const ITENS = C.valor('ITENS'), comItem = C.call('comItem'), baseId = C.call('baseId');
  for (const it of bag) {
    const d = daDica(it.dica);
    if (!d.poder) continue;
    if (!igual(calcEq, d.poder[0])) divs.push({ onde: it.id, campo: 'Poder atual', medido: d.poder[0], calculado: arred(calcEq, casasDe(d.poder[0])), fonte: C.fonte('poder') });
    const comp = /Comparado com o equipado: (.+?) \[(.+?)\]/.exec(it.dica || '');
    let velho = null;
    if (comp) {
      const alvo = Object.entries(ITENS).find(([, v]) => v.nome === comp[1]);
      const noEq = alvo ? eq.find((x) => baseId(x) === alvo[0]) : null;
      const ref = noEq ? C.call('refinoDe')(noEq) : 0;
      velho = alvo ? comItem(alvo[0], ref, comp[2].toUpperCase()) : null;
      if (velho && !eq.some((x) => baseId(x) === baseId(velho) && C.call('refinoDe')(x) === ref)) velho = eq.find((x) => baseId(x) === alvo[0]) || null;
    }
    if (!velho) { linhas.push('  ' + it.id + ': dica nao diz com que comparou (nao comparado)'); continue; }
    const trocado = eq.map((x) => (x === velho ? it.id : x));
    const calcTroca = poder({ nivel, itens: trocado });
    linhas.push('  ' + it.id + ' no lugar de ' + velho + ' (' + (comp ? comp[1] : '?') + ') -> poder ' + P(calcTroca) + ' (dica: ' + P(d.poder[1]) + ')');
    if (!igual(calcTroca, d.poder[1])) divs.push({ onde: it.id, campo: 'Poder apos troca', medido: d.poder[1], calculado: arred(calcTroca, casasDe(d.poder[1])), fonte: C.fonte('poder') });
  }
  return { id: 'poder', titulo: 'poder() x dicas do bag.json', fonte: C.fonte('poder'), ok: divs.length === 0, divs, linhas };
}

// ---- 4.4 pocoes contra status/potions ----
export function conferirPocoes(C, S) {
  const POCOES = C.valor('POCOES');
  const divs = [], linhas = [];
  const nivel = (S.status && S.status.nivel) || (S.player && S.player.nivel) || null;
  linhas.push('POCOES: ' + Object.entries(POCOES).map(([k, p]) => k + '(' + p.tipo + ', cura ' + p.cura + ', ' + p.preco + ' ouro, nv ' + p.nivel + ')').join(' | ') + '   ' + C.fonte('POCOES'));
  linhas.push('EXAUSTAO = ' + C.valor('EXAUSTAO') + ' (' + C.fonte('EXAUSTAO') + ')   POCAO_PVP = ' + JSON.stringify(C.valor('POCAO_PVP')) + ' (' + C.fonte('POCAO_PVP') + ')');
  const med = S.potions || (S.status && S.status.pocoes);
  if (med && nivel != null) {
    for (const k of Object.keys(POCOES)) {
      const p = POCOES[k];
      const bloqueada = nivel < p.nivel;
      if (bloqueada && med[k] > 0) divs.push({ onde: k, campo: 'quantidade', medido: med[k], calculado: 'nivel ' + nivel + ' < ' + p.nivel + ' (motor.js:' + C.linhaDeChave('POCOES', k) + ')', fonte: C.fonte('POCOES') });
    }
    linhas.push('medido (potions.json): ' + lista(med) + ' | nivel ' + nivel + ' -> bloqueadas por nivel: ' + Object.keys(POCOES).filter((k) => nivel < POCOES[k].nivel).join(', '));
    const escolher = C.info('escolherPocao');
    linhas.push('escolherPocao esta em ' + (escolher ? escolher.fonte : '?') + ' (nao exportada; extraida e chamavel via C.call)');
  }
  return { id: 'pocoes', titulo: 'POCOES x potions.json/status.json', fonte: C.fonte('POCOES'), ok: divs.length === 0, divs, linhas };
}

// ---- 4.5 o chefe: nivel/folha de stats/dano, tudo chamado no motor ----
function combateVazio() {
  return {
    darius: { escudo: 0, recargas: {}, ataque: 0, wPronto: false, trindade: false, poder: 0, sangramentoRecebido: [], timers: {},
      furia: 0, morto: 0, recall: 0, grito: 0, gritoBonus: 0, furiaS: 0, furiaRoubo: 0, estandarte: 0, estandarteCura: 0,
      disciplina: 0, machados: [], meteoros: [], prismaCont: 0, vento: 0, quique: null, mitose: null, diamante: 0, invulneravel: 0 },
    inimigos: [], eventos: [], tempo: 0, respawn: 1, arena: {},
  };
}
function atributosMedidos(C, S) {
  const p = (S.farm && S.farm.current && S.farm.current.setup && S.farm.current.setup.player) || S.player;
  if (!p) return null;
  const itens = (S.farm && S.farm.current && S.farm.current.setup && S.farm.current.setup.equip) ? S.farm.current.setup.equip.map((e) => e.id) : [];
  const baseId = C.call('baseId');
  return {
    ad: p.dano, ap: p.poder, baseAd: null, bonusAd: null, vida: p.vida, bonusVida: 0, armadura: p.armadura, bonusArmadura: 0,
    rm: p.rm, mana: 0, velAtaque: p.va, critico: 0, danoCritico: 1.75, esquiva: 0, rouboVida: 0, regen: 0, danoHab: 0,
    penArmadura: 0, penMagica: 0, reducaoRecarga: 0, ouroMult: 1, fluxoMult: 1,
    tem: (id) => itens.some((x) => baseId(x) === id), _itens: itens, _medido: true,
  };
}
export function amostrarGrupos(C, idLocal, nivelJogador, n = 3000) {
  const loc = C.valor('LOCAL')[idLocal], gerar = C.call('gerarGrupo');
  const niveis = {}, especies = {}, qtds = {}; let chefes = 0, furiosos = 0, noturnos = 0, total = 0;
  for (let k = 0; k < n; k++) {
    const g = gerar(loc, false, nivelJogador);
    qtds[g.length] = (qtds[g.length] || 0) + 1;
    if (g[0].chefe) chefes++;
    for (const m of g) { niveis[m.nivel] = (niveis[m.nivel] || 0) + 1; especies[m.nome] = (especies[m.nome] || 0) + 1; if (m.furioso) furiosos++; if (m.noturno) noturnos++; total++; }
  }
  return { n, total, niveis, especies, qtds, chefes, furiosos, noturnos, loc };
}
export function conferirChefe(C, S, opts = {}) {
  const divs = [], linhas = [];
  const nomeChefe = opts.chefe || 'Dragão Infernal', idLocal = opts.local || 'dragao';
  const nivelJogador = (S.player && S.player.nivel) || 29;
  const amostra = amostrarGrupos(C, idLocal, nivelJogador, 4000);
  const niveisChefe = Object.keys(amostra.niveis).length;
  const nivelBoss = (() => { const c = C.call('criarMonstro'); for (let k = 0; k < 200; k++) { const g = C.call('gerarGrupo')(amostra.loc, false, nivelJogador); if (g[0].chefe) return g[0].nivel; } return null; })();
  const i = C.call('criarMonstro')(nomeChefe, nivelBoss);
  linhas.push('zona ' + idLocal + ' nm=' + JSON.stringify(amostra.loc.nm) + ' (' + C.linhaDeChave('LOCAIS', idLocal) + '), nivel do jogador ' + nivelJogador);
  linhas.push('4000 grupos amostrados (' + C.fonte('gerarGrupo') + '): niveis dos mobs = ' + lista(amostra.niveis) + ' | qtd = ' + lista(amostra.qtds));
  linhas.push('chefe em ' + amostra.chefes + '/' + amostra.n + ' grupos (' + P(100 * amostra.chefes / amostra.n, 2) + '%; chance em ' + C.linhaDeChave('LOCAIS', idLocal) + '), sempre nivel ' + nivelBoss + ' (' + C.info('gerarGrupo').fonte + ')');
  linhas.push('folha do ' + nomeChefe + ' nv' + nivelBoss + ' (' + C.fonte('criarMonstro') + ' + ' + C.fonte('MONSTROS') + ' + ' + C.fonte('CURVA') + '): hpMax=' + P(i.hpMax) + ' ad=' + P(i.ad) + ' armadura=' + P(i.armadura) + ' as=' + i.as + ' xp=' + P(i.xp) + ' ouro=' + P(i.ouro));
  const a = atributosMedidos(C, S);
  if (a) {
    const c = combateVazio(); c.inimigos = [i];
    const monstro = C.call('criarMonstro')(nomeChefe, nivelBoss);
    const antes = a.vida; monstro.ataque = 0;
    C.call('inimigoAtaca')({ campeao: 'katarina', nivel: nivelJogador, local: idLocal, itens: a._itens, vida: a.vida, mana: 0, atrib: {}, ranks: {} }, c, a, monstro, 0.01);
    const recebido = c.eventos.filter((e) => e.tipo === 'recebido');
    const auto = recebido.length ? recebido[recebido.length - 1].valor : null;
    linhas.push('ataque basico do ' + nomeChefe + ' medido pelo motor (inimigoAtaca ' + C.info('inimigoAtaca').fonte + ' -> receberDano ' + C.info('receberDano').fonte + ') = ' + P(auto) + ' (jogador medido: vida ' + a.vida + ', armadura ' + a.armadura + ', rm ' + a.rm + ')');
    // mecanica: rodizio completo, um golpe de cada
    const golpes = {};
    const c2 = combateVazio();
    const i2 = C.call('criarMonstro')(nomeChefe, nivelBoss);
    const mecanicaChefe = C.call('mecanicaChefe');
    i2.tMec = 0; i2.mecK = 0;
    const est = { campeao: 'katarina', nivel: nivelJogador, local: idLocal, itens: a._itens, vida: a.vida, mana: 0, atrib: {}, ranks: {} };
    for (let passo = 0; passo < 6000; passo++) {
      est.vida = a.vida;                       // vida cheia: mede-se o GOLPE, nao a morte
      const n0 = c2.eventos.length;
      mecanicaChefe(est, c2, a, i2, 0.01);
      for (let k = n0; k < c2.eventos.length; k++) {
        const ev = c2.eventos[k];
        if (ev.tipo === 'chefeGolpe') golpes[ev.mec] = golpes[ev.mec] || { mecanica: ev.mec, golpes: 0 };
        if (ev.tipo === 'recebido' && i2.mecAtual) { const g = (golpes[i2.mecAtual] = golpes[i2.mecAtual] || { mecanica: i2.mecAtual, golpes: 0 }); g.golpes++; g.valor = ev.valor; g.magico = ev.magico; }
      }
      if (c2.eventos.length > 4000) c2.eventos.length = 0;
    }
    linhas.push('mecanicas do rodizio (' + C.fonte('HAB_CHEFE') + ' + ' + C.info('mecanicaChefe').fonte + '), 40 s de luta:');
    for (const [mec, g] of Object.entries(golpes)) {
      const linhaMec = (() => { const L = C.L; for (let k = 3101; k < 3125; k++) if (new RegExp("tipo === '" + mec + "'").test(L[k])) return k + 1; return null; })();
      linhas.push('  ' + mec.padEnd(11) + ' ' + (g.magico ? 'magico' : 'fisico') + ' ' + P(g.valor, 2).padStart(9) + '   motor.js:' + linhaMec + '  (' + g.golpes + ' golpes)');
    }
    // a queima: um % da vida maxima por segundo, lido das linhas do proprio motor
    const Lq = C.L;
    const pctQueima = {};
    for (let k = 3104; k <= 3110; k++) { const m = Lq[k]; if (!m) continue; const mm = /queimaDano = a\.vida \* ([\d.]+)/.exec(m); if (mm) pctQueima[(/'([a-z]+)'/.exec(m) || [])[1] || ('motor.js:' + (k+1))] = +mm[1]; }
    if (Object.keys(pctQueima).length) linhas.push('queimadura por golpe (% da vida maxima por segundo, lido de motor.js:3105-3108): ' + Object.entries(pctQueima).map(([q, v]) => q + ' ' + P(v*100, 1) + '% = ' + P(a.vida * v, 1) + '/s').join(' | ') + ' (vida medida ' + a.vida + ')');

    // cadencia REAL do rodizio: o periodo de cada mecanica (carrega + espera), somado ao ciclo completo
    const c4 = combateVazio();
    const i4 = C.call('criarMonstro')(nomeChefe, nivelBoss);
    let t4 = 0;
    i4.tMec = 0; i4.mecK = 0;
    const ultimo = {}, intervalo = {}, ordem = [];
    for (let passo = 0; passo < 12000; passo++) {
      est.vida = a.vida;
      const n0 = c4.eventos.length;
      mecanicaChefe(est, c4, a, i4, 0.01);
      for (let k = n0; k < c4.eventos.length; k++) {
        const ev = c4.eventos[k];
        if (ev.tipo === 'chefeGolpe' && ultimo[ev.mec] != null) intervalo[ev.mec] = P((t4 - ultimo[ev.mec]), 1);
        if (ev.tipo === 'chefeGolpe') { ultimo[ev.mec] = t4; if (!ordem.includes(ev.mec)) ordem.push(ev.mec); }
        if (ev.tipo === 'chefeInvoca') { if (ultimo.invocar != null) intervalo.invocar = P(t4 - ultimo.invocar, 1); ultimo.invocar = t4; if (!ordem.includes('invocar')) ordem.push('invocar'); }
      }
      t4 += 0.01;
      if (c4.eventos.length > 4000) c4.eventos.length = 0;
    }
    linhas.push('rodizio em ordem real: ' + ordem.join(' -> ') + '  (intervalo por mecanica: ' + Object.entries(intervalo).map(([k, v]) => k + ' ' + v + 's').join(' | ') + ')  <- ' + C.fonte('HAB_CHEFE') + ' + ' + C.info('mecanicaChefe').fonte + ' (o campo espera NAO e o intervalo do rodizio)');
    // dano do jogador: a Q da Katarina, pelo golpear real
    const HK = C.valor('HAB_KATARINA');
    if (HK && HK.Q && a) {
      const exprPen = exprLinha(C, 529, 'penMagica:');   // lado direito da motor.js:529, tal como esta
      const penMagica = C.trecho(exprPen, ['tem', 'pct'])({ tem: a.tem, pct: { penMag: C.call('infoItem')('3175~A').penMag } });
      a.penMagica = penMagica;
      const c3 = combateVazio();
      const alvo = C.call('criarMonstro')(nomeChefe, nivelBoss);
      const bruto = HK.Q.dano(10, a);
      const dano = C.call('golpear')({ campeao: 'katarina', nivel: nivelJogador, local: idLocal, itens: a._itens, vida: a.vida, mana: 0, atrib: {}, ranks: {} }, c3, a, alvo, bruto, 'Q', {});
      linhas.push('Q rank 10 da Katarina: base+ratio = ' + P(bruto, 1) + ' (' + C.info('HAB_KATARINA').fonte + ') | penMagica = ' + P(penMagica) + ' (' + 'motor.js:529' + ', cap 0,6) | armadura do alvo = ' + P(alvo.armadura, 1) + ' | dano final = ' + P(dano, 1) + ' (' + C.info('golpear').fonte + ')');
    }
  }
  return { id: 'chefe', titulo: 'chefe: nivel, folha de stats e dano (motor chamado a serio)', fonte: C.fonte('gerarGrupo'), ok: true, divs, linhas };
}

// ---- 4.6 ouro/xp por abate contra farm.json ----
export function conferirAbate(C, S) {
  const divs = [], linhas = [];
  const nivel = (S.player && S.player.nivel) || null;
  const farm = S.farm && S.farm.current;
  if (!farm || !farm.mobFase || nivel == null) return { id: 'abate', titulo: 'ouro/xp por abate x farm.json', fonte: C.fonte('gerarGrupo'), ok: false, resumo: 'sem farm.json current.mobFase', divs, linhas };
  const amostra = amostrarGrupos(C, 'dragao', nivel, 4000);
  const CURVA = C.valor('CURVA'), fatorXp = C.call('fatorXp'), fatorSaque = C.call('fatorSaque');
  let somaXp = 0, somaOuro = 0, tot = 0;
  for (let k = 0; k < 4000; k++) {
    for (const m of C.call('gerarGrupo')(amostra.loc, false, nivel)) {
      somaXp += m.xp * fatorXp(nivel, m.nivel);
      somaOuro += m.ouro * fatorSaque(nivel, m.nivel);
      tot++;
    }
  }
  const xpCalc = somaXp / tot, ouroCalc = somaOuro / tot;
  const ciclos = Array.isArray(S.farm.cycles) ? S.farm.cycles : [];
  let gGold = 0, gXp = 0, gKills = 0;
  for (const c of ciclos) { const mf = c && c.mobFase; if (!mf) continue; gGold += mf.gold || 0; gXp += mf.xp || 0; gKills += mf.kills || 0; }
  const med = gKills ? { gold: gGold / gKills, xp: gXp / gKills } : {};
  linhas.push('zona ' + farm.region + ', nivel ' + nivel + ' (' + C.fonte('gerarGrupo') + ' para nascer; ' + C.fonte('CURVA') + ' para xp/ouro)');
  linhas.push('modelo: xp/abate = ' + P(xpCalc, 1) + ' | ouro/abate = ' + P(ouroCalc, 1) + '   (4000 grupos, sem VIP/conquistas/mascote/evento)');
  linhas.push('medido (farm.json current.mobFase.perKill): xp ' + P(med.xp, 1) + ' | ouro ' + P(med.gold, 1) + '  -> razao ' + P(med.xp / xpCalc, 3) + 'x / ' + P(med.gold / ouroCalc, 3) + 'x');
  linhas.push('multiplicadores de ESTADO que faltam no modelo: VIP.xp ' + C.valor('VIP').xp + ' e VIP.drop ' + C.valor('VIP').drop + ' (' + C.fonte('VIP') + '), FURIOSO ' + JSON.stringify(C.valor('FURIOSO')) + ' (' + C.fonte('FURIOSO') + '), NOTURNO (' + C.fonte('NOTURNO') + '), bonusConquistas (' + C.info('bonusConquistas').fonte + '), bonusMascote (' + C.info('bonusMascote').fonte + '), bonusTwitchXp (' + C.info('bonusTwitchXp').fonte + '), bonusEventoXp (' + C.info('bonusEventoXp').fonte + ')');
  return { id: 'abate', titulo: 'ouro/xp por abate x farm.json', fonte: C.fonte('CURVA'), ok: true, divs, linhas };
}

// ---- 4.7 consistencia interna (tabelas que se referenciam) ----
export function conferirConsistencia(C) {
  const divs = [], linhas = [];
  const MONSTROS = C.valor('MONSTROS'), LOCAIS = C.valor('LOCAIS'), HAB_CHEFE = C.valor('HAB_CHEFE'), RODIZIO = C.valor('RODIZIO_CHEFE');
  const ITENS = C.valor('ITENS'), ESPOLIOS = C.valor('ESPOLIOS');
  for (const l of LOCAIS) {
    for (const [nome] of l.monstros || []) if (!MONSTROS[nome]) divs.push({ onde: l.id, campo: 'monstros', medido: '-', calculado: nome + ' NAO existe em MONSTROS', fonte: C.fonte('LOCAIS') });
    if (l.chefe && !MONSTROS[l.chefe[0]]) divs.push({ onde: l.id, campo: 'chefe', medido: '-', calculado: l.chefe[0] + ' NAO existe em MONSTROS', fonte: C.fonte('LOCAIS') });
  }
  for (const [chefe, rodizio] of Object.entries(RODIZIO)) {
    if (!MONSTROS[chefe]) divs.push({ onde: chefe, campo: 'RODIZIO_CHEFE', medido: '-', calculado: 'chefe ausente de MONSTROS', fonte: C.fonte('RODIZIO_CHEFE') });
    for (const mec of rodizio) if (!HAB_CHEFE[mec]) divs.push({ onde: chefe, campo: 'RODIZIO_CHEFE', medido: '-', calculado: mec + ' ausente de HAB_CHEFE', fonte: C.fonte('RODIZIO_CHEFE') });
  }
  for (const [id, i] of Object.entries(ITENS)) for (const c of i.de || []) if (!ITENS[c]) divs.push({ onde: id, campo: 'de', medido: '-', calculado: c + ' nao existe no catalogo', fonte: C.fonteItens });
  for (const [nome, esp] of Object.entries(C.valor('ESPOLIO_MONSTRO'))) if (!MONSTROS[nome]) divs.push({ onde: nome, campo: 'ESPOLIO_MONSTRO', medido: '-', calculado: 'especie ausente de MONSTROS', fonte: C.fonte('ESPOLIO_MONSTRO') });
  for (const [id, e] of Object.entries(ESPOLIOS)) if (e.valor == null) divs.push({ onde: id, campo: 'valor', medido: '-', calculado: 'ausente', fonte: C.fonte('ESPOLIOS') });
  const REF = C.valor('REFINO_MAX'), CH = C.valor('CHANCE_REFINO'), RE = C.valor('REGRESSAO_REFINO'), PE = C.valor('PERSISTENCIA');
  linhas.push('REFINO_MAX=' + REF + ' (' + C.fonte('REFINO_MAX') + ') | CHANCE_REFINO.len=' + CH.length + ' (' + C.fonte('CHANCE_REFINO') + ') | REGRESSAO_REFINO.len=' + RE.length + ' (' + C.fonte('REGRESSAO_REFINO') + ') | PERSISTENCIA.forja chaves=' + Object.keys(PE.forja).join(',') + ' (' + C.fonte('PERSISTENCIA') + ')');
  if (CH.length !== REF || RE.length !== REF) divs.push({ onde: 'refino', campo: 'comprimento', medido: REF, calculado: 'chances ' + CH.length + ' / regressao ' + RE.length, fonte: C.fonte('CHANCE_REFINO') });
  const Q = C.valor('QUALIDADES'); const soma = Object.values(Q).reduce((s, q) => s + q.peso, 0);
  linhas.push('QUALIDADES pesos somam ' + P(soma, 4) + '% (' + C.fonte('QUALIDADES') + ') | multiplicadores ' + Object.entries(Q).map(([k, q]) => k + ' x' + q.mult + '/venda x' + q.venda).join(' '));
  if (Math.abs(soma - 100) > 1e-6) divs.push({ onde: 'QUALIDADES', campo: 'soma dos pesos', medido: 100, calculado: soma, fonte: C.fonte('QUALIDADES') });
  linhas.push('MONSTROS: ' + Object.keys(MONSTROS).length + ' especies (' + C.fonte('MONSTROS') + ') | LOCAIS: ' + LOCAIS.length + ' (' + C.fonte('LOCAIS') + ') | ITENS: ' + Object.keys(ITENS).length + ' (' + C.fonteItens + ')');
  return { id: 'consistencia', titulo: 'consistencia interna das tabelas', fonte: C.fonte('MONSTROS'), ok: divs.length === 0, divs, linhas };
}

// ---- 4.8 aleatoriedade: o que era "sorte" passa a distribuicao ----
export function conferirAleatorio(C, S) {
  const linhas = [], divs = [];
  const Q = C.valor('QUALIDADES');
  const cont = {}; const N = 200000;
  for (let k = 0; k < N; k++) { const q = C.call('sortearQualidade')(0); cont[q] = (cont[q] || 0) + 1; }
  linhas.push('sortearQualidade(0) em ' + N + ' sorteios (' + C.info('sortearQualidade').fonte + '): ' + Object.entries(cont).map(([q, n]) => q + ' ' + P(100 * n / N, 3) + '%').join(' | '));
  linhas.push('pesos declarados (' + C.fonte('QUALIDADES') + '): ' + Object.entries(Q).map(([q, v]) => q + ' ' + v.peso + '%').join(' | '));
  const bonus = C.call('chancesQualidade')(4);
  linhas.push('chancesQualidade(4) (montagem com pecas SS): ' + Object.entries(bonus).map(([q, p]) => q + ' ' + P(100 * p, 3) + '%').join(' | ') + ' (' + C.info('chancesQualidade').fonte + ')');
  const MULT = C.valor('MONSTROS');
  for (const id of ['rota-inf', 'dragao', 'barao']) {
    const loc = C.valor('LOCAL')[id];
    linhas.push('chancesDrop(' + id + ') = ' + Object.entries(C.call('chancesDrop')(loc)).map(([k, v]) => k + ' ' + P(v * 100, 4) + '%').join(' | ') + '  (' + C.info('chancesDrop').fonte + '; tier ' + loc.tier + ' em ' + C.linhaDeChave('LOCAIS', id) + ')');
  }
  linhas.push('DROP_CHEFE = ' + JSON.stringify(C.valor('DROP_CHEFE')) + ' (' + C.fonte('DROP_CHEFE') + ')  -> por abate de chefe');
  const g = amostrarGrupos(C, 'dragao', 29, 2000);
  linhas.push('grupos em dragao (nivel 29): qtd ' + lista(g.qtds) + ' | furiosos ' + P(100 * g.furiosos / g.total, 3) + '% dos monstros (FURIOSO.chance ' + C.valor('FURIOSO').chance + ' por grupo, ' + C.fonte('FURIOSO') + ')');
  return { id: 'aleatorio', titulo: 'aleatoriedade amostrada (distribuicoes)', fonte: C.fonte('QUALIDADES'), ok: true, divs, linhas };
}

// =====================================================================================
// 5) RELATORIO
// =====================================================================================
function exprLinha(C, n, marcador) {
  const txt = C.linhaTexto(n);
  const i = txt.indexOf(marcador);
  if (i < 0) return null;
  let e = txt.slice(i + marcador.length);
  const c = e.indexOf('//'); if (c >= 0) e = e.slice(0, c);   // comentario de linha
  e = e.trim().replace(/[;,]\s*$/, '').trim();               // ';' ou ',' final
  return e;
}

// O que o enunciado pediu -> onde esta -> quanto da
export function secaoPedidos(C) {
  const CURVA = C.valor('CURVA'), MONSTROS = C.valor('MONSTROS'), ITENS = C.valor('ITENS');
  const linhas = [];
  const add = (pedido, onde, valor) => linhas.push('  ' + pedido.padEnd(46) + onde.padEnd(26) + ' ' + valor);
  add('CURVA', C.fonte('CURVA'), 'hp/ad/armadura/xp/ouro em funcoes de n (com ' + C.fonte('ajuste') + ' da planilha)');
  add('  CURVA.hp(n)', C.fonte('CURVA'), [1, 10, 29, 33, 40, 50].map((n) => n + ':' + P(CURVA.hp(n), 1)).join(' '));
  add('  CURVA.ad(n)', C.fonte('CURVA'), [1, 10, 29, 33, 40, 50].map((n) => n + ':' + P(CURVA.ad(n), 1)).join(' '));
  add('  CURVA.armadura(n)', C.fonte('CURVA'), [1, 29, 33, 40].map((n) => n + ':' + P(CURVA.armadura(n), 2)).join(' '));
  add('  CURVA.xp / ouro(n)', C.fonte('CURVA'), [1, 29, 33, 40].map((n) => n + ':' + P(CURVA.xp(n), 1) + '/' + P(CURVA.ouro(n), 1)).join(' '));
  add('MONSTROS', C.fonte('MONSTROS'), Object.keys(MONSTROS).length + ' especies x ' + Object.keys(MONSTROS['Dragão Infernal']).length + ' campos');
  add('criarMonstro', C.fonte('criarMonstro'), (() => { const m = C.call('criarMonstro')('Dragão Infernal', 40); return 'nv40: hp ' + P(m.hpMax) + ', ad ' + P(m.ad) + ', armadura ' + P(m.armadura) + ', ouro ' + P(m.ouro, 1); })());
  add('mitigar (pedido 1167)', C.fonte('mitigar'), 'mitigar(1000,100)=' + P(C.call('mitigar')(1000, 100)) + '  mitigar(1000,0)=' + P(C.call('mitigar')(1000, 0)) + '  (armadura negativa nao soma)');
  add('RM_MONSTRO (pedido 1179)', C.fonte('RM_MONSTRO'), 'RM_MONSTRO=' + C.valor('RM_MONSTRO') + ' -> dano magico de habilidade usa armadura*0.6*(1-penMag)');
  add('pen do golpe (pedido 1202)', 'motor.js:1202', (() => {
    const expr = exprLinha(C, 1202, 'const arm =');
    const f = C.trecho(expr, ['magico', 'poder', 'alvo', 'a']);
    return 'fisico pen0.3: arm=' + f({ magico: false, poder: false, alvo: { armadura: 100, reducaoArmadura: 0 }, a: { penArmadura: 0.3 } }) +
      ' | magico pen0.55: arm=' + f({ magico: true, poder: true, alvo: { armadura: 100, reducaoArmadura: 0 }, a: { penMagica: 0.55 } });
  })());
  const DC = (() => { const m = /danoCritico = ([\d.]+)/.exec(C.linhaTexto(499)); return m ? m[1] : '?'; })();
  add('critico (pedido 499/515)', C.fonte('atributos') + ' :499/:515/:541', 'danoCritico=' + DC + ' (motor.js:499) | Gume do Infinito (3031) soma 0.4 em motor.js:515 | cap e k.hab.P.critMult em motor.js:541');
  add('  critico multiplica o dano', 'motor.js:1213', 'if (critico) dano *= a.danoCritico || 1.75  (fallback 1.75 lido da propria linha)');
  add("tem('id') (pedido 501-540)", C.fonte('atributos') + ' :513-540', 'tem = (id) => estado.itens.some(x => baseId(x) === id) em motor.js:513; usado em 514 (2501), 515 (3031), 521 (3003), 522 (3089), 529 (3135), 539 (3036)');
  add('TETO_VIDA_ITEM (pedido 1190)', C.fonte('TETO_VIDA_ITEM'), 'TETO_VIDA_ITEM=' + C.valor('TETO_VIDA_ITEM'));
  add('vidaRefItem (pedido 1191)', C.fonte('vidaRefItem'), 'Dragão nv33: hpMax=' + P(C.call('criarMonstro')('Dragão Infernal', 33).hpMax) + ' -> vidaRefItem=' + P(C.call('vidaRefItem')(C.call('criarMonstro')('Dragão Infernal', 33))) + ' (o teto morde quando hpMax > 3*CURVA.hp(n))');
  add('Voracidade (pedido 736/1789)', C.fonte('HAB_KATARINA'), 'voracidade=' + C.valor('HAB_KATARINA').P.voracidade + 's | voracidadeChefe=' + C.valor('HAB_KATARINA').P.voracidadeChefe + 's | curaBase=' + C.valor('HAB_KATARINA').P.curaBase + ' | abate tira ' + C.valor('HAB_KATARINA').P.voracidade + 's da recarga de Q/W/E (motor.js:1789)');
  add('mecanicas de chefe (pedido 3066-3125)', C.fonte('HAB_CHEFE'), 'MECANICAS=' + Object.entries(C.valor('MECANICAS')).map(([k, v]) => k + ':' + v).join(' ') + ' | rodizio=' + Object.entries(C.valor('RODIZIO_CHEFE')).map(([k, v]) => k + ':[' + v.join(',') + ']').join(' '));
  add('respawn/grupo', C.fonte('gerarGrupo'), 'qtd = 2 + floor(random()*3) (2..4) | respawn 1s (' + C.fonte('criarCombate') + ', 2x no texto: motor.js:1625 e motor.js:3046)');
  add('GRUPO (Runeterra)', C.fonte('GRUPO'), 'max ' + C.valor('GRUPO').max + ' membros, raio ' + C.valor('GRUPO').raio + ' tiles, +' + C.valor('GRUPO').porMembro * 100 + '% de xp por membro');
  add('pocoes (pedido 41/262-264/1294)', C.fonte('POCOES'), Object.entries(C.valor('POCOES')).map(([k, p]) => k + '=' + p.cura + '/' + p.preco + '/' + p.nivel).join(' ') + ' | EXAUSTAO=' + C.valor('EXAUSTAO') + ' | escolherPocao em ' + C.info('escolherPocao').fonte);
  add('refino (pedido 55/258)', C.fonte('BONUS_REFINO'), 'BONUS_REFINO=' + C.valor('BONUS_REFINO') + ' | REFINO_MAX=' + C.valor('REFINO_MAX') + ' | CHANCE_REFINO=' + JSON.stringify(C.valor('CHANCE_REFINO')) + ' | REGRESSAO=' + JSON.stringify(C.valor('REGRESSAO_REFINO')) + ' | precoRefino(' + C.fonte('precoRefino') + ')');
  add('qualidade (pedido 173-179)', C.fonte('QUALIDADES'), Object.entries(C.valor('QUALIDADES')).map(([k, q]) => k + ':' + q.peso + '%/' + q.mult + '/' + q.venda).join(' '));
  add('infoItem (pedido 251-255)', C.fonte('infoItem'), 'escala ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr por (1+0.12*refino)*mult  --  NAO escala penMag/apPct/efeito');
  add('  infoItem("4629+3~A").cdr', 'motor.js:252-255', P(C.call('infoItem')('4629+3~A').cdr * 100, 2) + '%  = 0.15 x (1+0.12*3) x 1.15 (A)');
  add('  infoItem("3175~A").penMag', 'motor.js:254', C.call('infoItem')('3175~A').penMag + '  (cru: penMag NAO leva refino/qualidade)');
  add('valorEquip (pedido 2898)', C.fonte('valorEquip'), 'preco*(1+0.12*refino)*mult  (para decidir o que fica no equipamento)');
  add('valorVenda (pedido 257)', C.fonte('valorVenda'), 'floor(preco*0.5*(1+0.5*refino)*venda)  ex.: 4629+3~A -> ' + C.call('valorVenda')('4629+3~A'));
  return linhas;
}

export function relatorio(C, S, opts = {}) {
  const out = [];
  const bar = (t) => { out.push(''); out.push('=== ' + t + ' ' + '='.repeat(Math.max(0, 74 - t.length))); };
  out.push('================================================================================');
  out.push(' CALCULADORA DO JOGO - relatorio de validacao   (bun tools/calc-jogo.mjs)');
  out.push('================================================================================');
  out.push('fonte      ' + C.fonteMotor.padEnd(30) + String(C.linhasMotor).padStart(6) + ' linhas   sha256 ' + C.shaMotor.slice(0, 16));
  out.push('           ' + C.fonteItens.padEnd(30) + String(C.nItens).padStart(6) + ' itens    sha256 ' + C.shaItens.slice(0, 16));
  out.push('           ' + C.fonteBalanco.padEnd(30) + String(C.nBalanco).padStart(6) + ' faixas');
  out.push('medicoes   ' + Object.values(S.ficheiros || {}).join(', '));
  if (S.avisos && S.avisos.length) out.push('faltam    ' + S.avisos.join(' | '));
  out.push('nota       semente da aleatoriedade: ' + (opts.seed == null ? 'nenhuma (valores variam)' : 'fixa ' + opts.seed + ' (relatorio reprodutivel)'));

  // [1]
  bar('[1] INVENTARIO EXTRAIDO DO MOTOR (por texto, com file:linha)');
  const ok = C.decls.filter((d) => d.estado === 'ok').length;
  out.push('  declaracoes de topo ....... ' + C.decls.length);
  out.push('  avaliadas ................ ' + ok);
  out.push('  falhas ................... ' + C.falhas.length + (C.falhas.length ? '  (ver [4])' : ''));
  out.push('  exportadas ............... ' + C.decls.filter((d) => d.exportada).length + '   privadas: ' + C.decls.filter((d) => !d.exportada).length);
  out.push('  remendos do catalogo ..... ' + C.remendos.length + ' -> ' + C.remendos.map((r) => 'motor.js:' + r.ini + ' (item ' + r.id + ')' + (r.ok ? '' : ' FALHOU')).join(', '));
  out.push('  passos do fixpoint ....... ' + (opts.passos || 2));
  const porTipo = {};
  for (const d of C.decls) porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1;
  out.push('  por tipo ................. ' + Object.entries(porTipo).map(([k, v]) => k + ' ' + v).join(' | '));

  // [2]
  bar('[2] O QUE FOI PEDIDO -> ONDE ESTA -> QUANTO DA');
  for (const l of secaoPedidos(C)) out.push(l);

  // [3]
  bar('[3] VALIDACAO CONTRA AS MEDICOES (docs/snapshots)');
  const checks = [
    conferirMonstros(C, S), conferirLocais(C, S), conferirItens(C, S), conferirPoder(C, S),
    conferirPocoes(C, S), conferirChefe(C, S), conferirChefe(C, S, { chefe: 'Bar' + String.fromCharCode(227) + 'o Nashor', local: 'barao' }), conferirAbate(C, S), conferirConsistencia(C), conferirAleatorio(C, S),
  ];
  let iDiv = 0;
  for (const c of checks) {
    const marca = c.ok ? 'OK' : 'DIVERGENCIA';
    out.push('  3.' + (checks.indexOf(c) + 1) + ' ' + c.titulo.padEnd(58) + (c.ok ? 'OK' : marca) + (c.divs.length ? ' (' + c.divs.length + ' dif.)' : ''));
    for (const l of c.linhas || []) out.push('      ' + l);
    for (const n of c.notas || []) out.push('      nota: ' + n);
    if (c.campos) out.push('      campos comparados: ' + c.campos + (c.n ? ' sobre ' + c.n + ' alvos' : ''));
    iDiv += c.divs.length;
    c._divs = c.divs;
  }
  out.push('  TOTAL de divergencias: ' + iDiv);

  // [4]
  bar('[4] O QUE NAO E EXTRAIVEL / NAO E AVALIAVEL (nao reescrito a mao)');
  const causas = new Map();
  for (const f of C.falhas) {
    const cau = /DADOS_/.test(f.erro || '') ? 'depende de dados-<campeao>.js (ausente em docs/game-src)'
      : /is not defined/.test(f.erro || '') ? 'falta uma declaracao que o motor nao expoe ou que vem de ficheiro ausente'
        : /is not a function|undefined/.test(f.erro || '') ? 'depende de dados-<campeao>.js (ausente em docs/game-src)'
          : f.erro;
    if (!causas.has(cau)) causas.set(cau, []);
    causas.get(cau).push(f);
  }
  if (!C.falhas.length) out.push('  nenhuma: as ' + C.decls.length + ' declaracoes de topo do motor foram extraidas e avaliadas.');
  else for (const [cau, fs2] of causas) {
    out.push('  ' + fs2.length + ' declaracoes: ' + cau);
    out.push('      ' + fs2.slice(0, 14).map((f) => f.nome + ' (' + f.fonte + ')').join(', ') + (fs2.length > 14 ? ', ...' : ''));
  }
  out.push('  Mais 3 coisas fora do alcance, ditas a sério:');
  out.push('    a) atributos()/novoEstado() de ezreal, lux, yasuo, katarina, taric e zac: motor.js:2-11 importa dados-<campeao>.js, que nao estao em docs/game-src.');
  out.push('       Os coeficientes de jogador (hp/armadura/mp por nivel) vem de la. O motor EXPOE a funcao (motor.js:492) e o catalogo fica pronto; chamar com esses campeoes lanca erro explicito.');
  out.push('       PARA MEDIR O JOGO DE VERDADE faltam esses 6 ficheiros: docs/game-src/dados-{ezreal,yasuo,lux,katarina,taric,zac}.js.');
  out.push('    b) passos do combate (passo, acoesComuns, acoesDoKit...) sao funcoes de estado completo: estao extraidas e chamaveis, mas precisam de um estado/cena montados (criarCombate + cena).');
  out.push('    c) numeros decididos no servidor (qualidade ~?, mercado, VIP, premios) nao estao no motor: o motor so os consome.');

  // [5]
  bar('[5] DIVERGENCIAS, UMA A UMA');
  let n = 0;
  for (const c of checks) for (const d of c.divs) {
    n++;
    out.push('  ' + n + ') [' + c.id + '] ' + d.onde + ' . ' + d.campo + ': medido ' + P(d.medido, 6) + ' | motor ' + P(d.calculado, 6) + '   ' + d.fonte);
  }
  if (!n) out.push('  nenhuma.');
  return { texto: out.join('\n'), checks, totalDivergencias: n };
}

// =====================================================================================
// 6) CLI
// =====================================================================================
function uso() {
  return [
    'bun tools/calc-jogo.mjs                    relatorio completo (inventario, valores, validacao, divergencias)',
    'bun tools/calc-jogo.mjs --json             o mesmo em JSON (para outras ferramentas)',
    'bun tools/calc-jogo.mjs --api              indice anotado: nome -> motor.js:linha',
    'bun tools/calc-jogo.mjs --expr "expr"      avalia uma expressao com TODAS as formulas no escopo',
    'bun tools/calc-jogo.mjs --testes           corre as auto-verificacoes da biblioteca',
    '   ex.: bun tools/calc-jogo.mjs --expr ' + String.fromCharCode(34) + 'infoItem(' + String.fromCharCode(39) + '4629+3~A)' + String.fromCharCode(34),
    "        bun tools/calc-jogo.mjs --expr \"CURVA.hp(40) * MONSTROS['Dragão Infernal'].hp\"",
  ].join('\n');
}

// auto-verificacoes: cada uma diz o que TEM de acontecer; se o motor mudar, aqui muda
export function autoVerificacoes() {
  const C = carregarMotor({ seed: 20261014 });
  const res = [];
  const t = (nome, fn) => { try { const v = fn(); res.push({ nome, ok: !!v, detalhe: v }); } catch (e) { res.push({ nome, ok: false, detalhe: 'ERRO ' + e.message }); } };
  const CURVA = C.valor('CURVA'), ITENS = C.valor('ITENS');
  t('infoItem escala cdr com refino e qualidade', () => {
    const a = C.call('infoItem')('3171+2~B').cdr, b = C.call('infoItem')('3171~B').cdr;
    return '0.15 -> ' + b + ' -> ' + a + ' (x' + P(a / b, 4) + '; esperado x' + (1 + 0.12 * 2) + ') | ' + C.fonte('infoItem');
  });
  t('infoItem NAO escala penMag', () => {
    const cru = ITENS['3175'].penMag, comRef = C.call('infoItem')('3175+5~SS').penMag;
    return 'itens.js ' + cru + ' -> infoItem(3175+5~SS) ' + comRef + ' | ' + C.fonte('infoItem');
  });
  t('remendos do catalogo aplicados (motor.js:16-26)', () => {
    const cdr = [C.call('infoItem')('2022~B').cdr, C.call('infoItem')('4629~B').cdr, C.call('infoItem')('3108~B').cdr, C.call('infoItem')('3802~B').cdr];
    return '2022=' + cdr[0] + ' 4629=' + cdr[1] + ' 3108=' + cdr[2] + ' 3802=' + cdr[3] + ' (regen 1006=' + C.call('infoItem')('1006~B').regen + ')';
  });
  t('mitigar e simetrica em armadura 0', () => C.call('mitigar')(1000, 0) === 1000 && C.call('mitigar')(1000, 100) === 500);
  t('vidaRefItem aplica o teto', () => {
    const fraco = C.call('criarMonstro')('Tropa Corpo a Corpo', 50), forte = C.call('criarMonstro')('Bar' + String.fromCharCode(227) + 'o Nashor', 50);
    return 'mob nv50 hpMax ' + P(fraco.hpMax) + ' -> ' + P(C.call('vidaRefItem')(fraco)) + ' (sem teto) | chefe nv50 hpMax ' + P(forte.hpMax) + ' -> ' + P(C.call('vidaRefItem')(forte)) + ' (teto ' + C.valor('TETO_VIDA_ITEM') + 'x CURVA.hp = ' + P(C.valor('TETO_VIDA_ITEM') * CURVA.hp(50)) + ') | ' + C.fonte('vidaRefItem');
  });
  t('difnivel livre', () => {
    const m = C.call('criarMonstro')('Drag' + String.fromCharCode(227) + 'o Infernal', 33);
    return 'jogador 29 x dragão 33: difNivel=' + C.call('difNivel')({ nivel: 29 }, m) + ' fatorDanoMonstro=' + C.call('fatorDanoMonstro')({ nivel: 29 }, m) + ' fatorDanoJogador=' + C.call('fatorDanoJogador')({ nivel: 29 }, m) + ' | ' + C.fonte('NIVEL_DIF');
  });
  t('qualidades somam 100%', () => {
    const s = Object.values(C.valor('QUALIDADES')).reduce((a, q) => a + q.peso, 0);
    return Math.abs(s - 100) < 1e-6;
  });
  t('monstros batem com bosses.json', () => {
    const S = lerSnapshots(); const med = S.bosses && S.bosses.monstros; if (!med) return 'sem medicão';
    const calc = C.valor('MONSTROS');
    return Object.keys(med).every((k) => JSON.stringify(med[k]) === JSON.stringify(calc[k])) ? Object.keys(med).length + '/' + Object.keys(med).length + ' iguais' : 'DIVERGE';
  });
  t('infoItem de 4629+3~A (dica medida)', () => {
    const i = C.call('infoItem')('4629+3~A');
    return 'ap=' + P(i.ap) + ' vida=' + P(i.vida) + ' cdr=' + P(i.cdr, 4) + ' -> dica: +109.5, +547, -23%';
  });
  t('valorVenda de 3173~A (medido 2100)', () => P(C.call('valorVenda')('3173~A')));
  t('poder do equipamento medido', () => {
    const eq = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];
    return P(C.call('poder')({ nivel: 29, itens: eq })) + ' (dica: 3.195)';
  });
  t('mecanica do chefe corre de verdade', () => {
    const itens = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];
    const a = { ad: 161, ap: 1104, vida: 4476, armadura: 164, rm: 134, baseAd: null, bonusAd: null, bonusVida: 0, bonusArmadura: 0, mana: 0, velAtaque: 1.16, critico: 0, danoCritico: 1.75, esquiva: 0, rouboVida: 0, regen: 0, danoHab: 0, penArmadura: 0, penMagica: 0, reducaoRecarga: 0, ouroMult: 1, fluxoMult: 1, _itens: itens, baseCritico: 0 };
    const baseId = C.call('baseId'); a.tem = (id) => itens.some((x) => baseId(x) === id);
    const c = combateVazio();
    const i = C.call('criarMonstro')('Drag' + String.fromCharCode(227) + 'o Infernal', 33);
    const est = { campeao: 'katarina', nivel: 29, local: 'dragao', itens, vida: 4476, mana: 0, atrib: {}, ranks: {} };
    i.ataque = 0;
    C.call('inimigoAtaca')(est, c, a, i, 0.01);
    const v = c.eventos.filter((e) => e.tipo === 'recebido').map((e) => e.valor);
    return v.length ? 'ataque basico = ' + P(v[0], 1) + ' (medido 296-297)' : 'sem evento';
  });
  t('Q da Katarina pelo golpear do motor', () => {
    const itens = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];
    const baseId = C.call('baseId');
    const a = { ad: 161, ap: 1104, baseAd: null, bonusAd: null, vida: 4476, armadura: 164, rm: 134, bonusVida: 0, bonusArmadura: 0, mana: 0, velAtaque: 1.16, critico: 0, danoCritico: 1.75, esquiva: 0, rouboVida: 0, regen: 0, danoHab: 0, penArmadura: 0, penMagica: 0, reducaoRecarga: 0, ouroMult: 1, fluxoMult: 1, _itens: itens };
    a.tem = (id) => itens.some((x) => baseId(x) === id);
    const expr = exprLinha(C, 529, 'penMagica:');
    a.penMagica = C.trecho(expr, ['tem', 'pct'])({ tem: a.tem, pct: { penMag: C.call('infoItem')('3175~A').penMag } });
    const est = { campeao: 'katarina', nivel: 29, local: 'dragao', itens, vida: 4476, mana: 0, atrib: {}, ranks: {} };
    const c = combateVazio();
    const alvo = C.call('criarMonstro')('Drag' + String.fromCharCode(227) + 'o Infernal', 33);
    const bruto = C.valor('HAB_KATARINA').Q.dano(10, a);
    const dano = C.call('golpear')(est, c, a, alvo, bruto, 'Q', {});
    return 'penMagica=' + P(a.penMagica) + ' bruto=' + P(bruto, 1) + ' dano=' + P(dano, 1) + ' (medido 1156)';
  });
  t('xpParaNivel cresce', () => {
    const v = [1, 2, 10, 29, 50].map((n) => n + ':' + C.call('xpParaNivel')(n));
    return v.join(' ');
  });
  t('gerarGrupo em dragao (nivel 29)', () => {
    const g = amostrarGrupos(C, 'dragao', 29, 500);
    return 'niveis=' + lista(g.niveis) + ' qtd=' + lista(g.qtds) + ' chefes=' + g.chefes;
  });
  return res;
}

// Prova de que os numeros sao LIDOS do motor e nao copiados: muda-se o TEXTO do motor
// (em memoria, sem escrever ficheiro nenhum) e a calculadora muda com ele.
export function provaDeLeitura() {
  const src = lerRel('docs/game-src/motor.js');
  const base = carregarMotor({ seed: 20261014 });
  const DRAG = 'Drag' + String.fromCharCode(227) + 'o Infernal', BARAO = 'Bar' + String.fromCharCode(227) + 'o Nashor';
  const mutacoes = [
    ['CURVA.hp     motor.js:274   150 + 100*n -> 250 + 100*n', '150 + 100 * n + 1.0 * n * n', '250 + 100 * n + 1.0 * n * n', (C) => C.valor('CURVA').hp(30)],
    ['CURVA.ad     motor.js:275   0.13*n^2 -> 0.26*n^2', '0.13 * n * n', '0.26 * n * n', (C) => C.valor('CURVA').ad(30)],
    ['BONUS_REFINO motor.js:55    0.12 -> 0.20', 'export const BONUS_REFINO = 0.12', 'export const BONUS_REFINO = 0.20', (C) => C.call('infoItem')('4629+3~A').cdr],
    ['CHANCE_REFINO motor.js:60   0.30 -> 0.60', 'export const CHANCE_REFINO = [0.30,', 'export const CHANCE_REFINO = [0.60,', (C) => C.valor('CHANCE_REFINO')[0]],
    ['MONSTROS     motor.js:298   Dragao Infernal hp 12 -> 20', DRAG + "':         { hp: 12,", DRAG + "':         { hp: 20,", (C) => C.valor('MONSTROS')[DRAG].hp],
    ['DROP_CHEFE   motor.js:1145  lendario 0.001 -> 0.05', 'export const DROP_CHEFE = { lendario: 0.001,', 'export const DROP_CHEFE = { lendario: 0.05,', (C) => C.valor('DROP_CHEFE').lendario],
    ['PERSISTENCIA motor.js:69    max do +3 120 -> 20', '3: { subir: 80, max: 120 }', '3: { subir: 80, max: 20 }', (C) => C.valor('PERSISTENCIA').forja['3'].max],
    ['TETO_VIDA    motor.js:1190  3 -> 1', 'export const TETO_VIDA_ITEM = 3', 'export const TETO_VIDA_ITEM = 1', (C) => C.valor('TETO_VIDA_ITEM')],
    ['QUALIDADES   motor.js:177   peso do S 0.05 -> 5', 'S: { peso: 0.05,', 'S: { peso: 5,', (C) => C.valor('QUALIDADES').S.peso],
  ];
  const linhas = [], casos = [];
  for (const [nome, de, para, get] of mutacoes) {
    const antesV = get(base);
    if (!src.includes(de)) { const msg = 'TEXTO NAO ENCONTRADO NO MOTOR'; linhas.push('  ???? ' + nome + ': ' + msg + ' (' + de.slice(0, 48) + ')'); casos.push({ nome, ok: false, msg }); continue; }
    const C1 = carregarMotor({ seed: 20261014, texto: src.split(de).join(para) });
    const depoisV = get(C1);
    const ok = antesV !== depoisV;
    linhas.push('  ' + (ok ? 'MUDOU' : 'FIXOU') + ' ' + nome + ': ' + antesV + ' -> ' + depoisV);
    casos.push({ nome, ok, antesV, depoisV });
  }
  linhas.push('');
  linhas.push('  ' + casos.filter((c) => c.ok).length + '/' + casos.length + ' mutacoes no TEXTO do motor mudaram a calculadora.');
  linhas.push('  Ou seja: nenhum numero deste ficheiro e copia. Se o jogo buffar ou nerfar, a saida muda no mesmo dia.');
  return { linhas, casos };
}

function await_import_rel(rel) { return lerRel(rel); }

async function main() {
  const a = process.argv.slice(2);
  const flag = (n) => a.includes(n);
  const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  if (flag('-h') || flag('--ajuda') || flag('--help')) { console.log(uso()); return; }

  if (flag('--expr')) {
    const e = opt('--expr') || a[a.indexOf('--expr') + 1];
    const C = carregarMotor({ seed: opt('--seed') != null ? +opt('--seed') : null });
    console.log(JSON.stringify(C.avaliar(e)) ?? String(C.avaliar(e)));
    return;
  }
  if (flag('--testes')) {
    const r = autoVerificacoes();
    for (const x of r) console.log((x.ok ? '  OK  ' : ' FALHA ') + x.nome + '\n         ' + x.detalhe);
    console.log('\n' + r.filter((x) => x.ok).length + '/' + r.length + ' verificacoes passaram');
    return;
  }
  if (flag('--prova')) {
    const R = provaDeLeitura();
    console.log('PROVA DE QUE E LIDO, NAO COPIADO: muda-se o TEXTO do motor em memoria (nada e escrito)');
    for (const l of R.linhas) console.log(l);

    return;
  }
  if (flag('--api')) {
    const C = carregarMotor();
    for (const d of C.decls) console.log(d.nome.padEnd(24) + d.fonte.padEnd(30) + (d.exportada ? 'export' : '-') + (String(d.ini) === String(d.fim) ? '    1 linha' : '  ' + String(d.fim - d.ini + 1) + ' linhas') + '  ' + d.texto.split('\n')[0].slice(0, 80));
    console.log('# ' + C.decls.length + ' declaracoes, motor.js sha256 ' + C.shaMotor.slice(0, 16));
    return;
  }

  const seed = opt('--seed') != null ? +opt('--seed') : 20261014;
  const C = carregarMotor({ seed, motor: opt('--motor') || 'docs/game-src/motor.js' });
  const S = lerSnapshots(opt('--snapshots') || 'docs/snapshots');
  const R = relatorio(C, S, { seed });
  if (flag('--json')) {
    const j = { fonte: { motor: C.fonteMotor, linhas: C.linhasMotor, sha256: C.shaMotor, itens: C.nItens, balanco: C.nBalanco }, resumo: { declaracoes: C.decls.length, ok: C.decls.filter((d) => d.estado === 'ok').length, falhas: C.falhas.map((f) => ({ nome: f.nome, fonte: f.fonte, erro: f.erro })), remendos: C.remendos, divergencias: R.totalDivergencias }, secoes: R.checks.map((c) => ({ id: c.id, titulo: c.titulo, ok: !!c.ok, campos: c.campos, divergencias: c.divs, linhas: c.linhas })) };
    console.log(JSON.stringify(j, null, 2));
  } else {
    console.log(R.texto);
  }
}

if (import.meta.main) await main();
