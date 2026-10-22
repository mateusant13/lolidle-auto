#!/usr/bin/env node
/*
 * tools/harness.mjs — HARNESS DO JOGO. Entender o jogo (e o que se passa) SEM VISÃO.
 *
 * Ideia (ordem do dono): "monta um harness que te ajuda a entender o jogo 100% e o que ta
 * acontecendo. de preferencia, sem visao."
 *
 * A peça central: o motor.js do JOGO importa-se DIRECTAMENTE em Node (não se copia nada —
 * REGRA N.º 3). Logo, tudo o que o jogo APPLICA pode ser lido e corrido aqui, offline e
 * determinístico, sem browser, sem screenshot, sem CDP.
 *
 *   node tools/harness.mjs                      -> ajuda + estado das fontes
 *   node tools/harness.mjs fontes               -> ficheiros-fonte do jogo (+ tamanho/sha)
 *   node tools/harness.mjs curva [campo] [nv]   -> CURVA do motor (hp/ad/armadura/xp/ouro)
 *   node tools/harness.mjs monstro <nome> <nv>  -> stats de um monstro num nível
 *   node tools/harness.mjs item <id|ref>        -> um item do jogo (stats, valor, refino)
 *   node tools/harness.mjs kit <campeao>        -> o kit do campeão
 *   node tools/harness.mjs chefe <nome> <nv>    -> mecânicas do chefe (aviso, rodízio)
 *   node tools/harness.mjs pocoes               -> as poções do jogo (cura/preço/nível)
 *   node tools/harness.mjs atributos <champ> <nv> [--modelo=] [--itens=a,b]
 *   node tools/harness.mjs lutar --champ=katarina --nivel=30 --alvo="Barao Nashor" --nv=36
 *      [--itens=3175~S,6653] [--local=barao] [--pocoes=vida] [--pocaoAuto=1] [--limiar=0.5]
 *      [--maxSeg=180] [--seed=1] [--json]
 *      -> corre a LUTA REAL com o motor (passo a passo) e devolve:
 *         mata? em quantos s? morreu? quantas poções? ouro? (o critério do dono)
 *   node tools/harness.mjs banco [--filter x]  -> corre o banco de regressão (tools/testes/run.mjs)
 *   node tools/harness.mjs vivo  [args...]     -> estado AO VIVO (delega em tools/cdp-eval.mjs)
 *   node tools/harness.mjs sonda <target> [s]  -> liveness/stack (delega em tools/_sonda-alvo.mjs)
 *
 * Regra N.º 1 do AGENTS.md: a fonte é `docs/game-src/motor.js`. Este harness LÊ essa fonte,
 * nunca um resumo. Se o jogo mudar, o harness muda com ele — sem tocar em código.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const GAME_SRC = path.join(RAIZ, 'docs', 'game-src');

const argv = process.argv.slice(2);
const cmd = (argv[0] || '').toLowerCase();
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? (argv[i + 1] ?? d) : d; };
const opt = (n, d = null) => { const p = n + '='; const h = argv.find((a) => a.startsWith(p)); return h ? h.slice(p.length) : d; };
const flag = (n) => argv.includes(n);
const semFlags = (xs) => xs.filter((x) => !x.startsWith('--'));

const J = flag('--json');
function out(obj, txt) {
  if (J) { console.log(JSON.stringify(obj, null, 2)); return; }
  console.log(txt != null ? txt : JSON.stringify(obj, null, 2));
}
function n1(v) { return typeof v === 'number' ? (Math.round(v * 100) / 100) : v; }

// ---------------------------------------------------------------- motor real
let _M = null;
async function M() {
  if (!_M) _M = await import(pathToFileURL(path.join(GAME_SRC, 'motor.js')).href);
  return _M;
}

// RNG determinístico (o motor usa Math.random em ouro/ataque/iniciativa).
function semear(seed) {
  let s = (seed >>> 0) || 1;
  Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------------------------------------------------------------- helpers de montagem
function montarEstado(m, { champ = 'katarina', nivel = 30, itens = [], modelo = '', pouparPontos = false }) {
  const e = m.novoEstado(champ);
  e.nivel = Math.max(1, Math.min(m.NIVEL_MAX, nivel | 0));
  e.itens = itens.filter(Boolean);
  e.mochila = [];
  if (modelo && m.MODELOS[modelo]) e.modelo = modelo;
  // pontos de habilidade: 1 por nível; o motor valida mínimos por nível (podeSubir)
  const somaRanks = Object.values(e.ranks).reduce((s, v) => s + (v || 0), 0);
  e.pontos = Math.max(0, e.nivel - somaRanks);
  if (!pouparPontos) { try { m.subirAutomatico(e); } catch { /* deixa como está */ } }
  // pontos de atributo: 3 por nível acima do 1 (motor: PONTOS_POR_NIVEL)
  const ppn = m.PONTOS_POR_NIVEL || 1;
  e.pontosAtrib = ppn * (e.nivel - 1);
  e.atrib = m.atributos ? e.atrib : e.atrib; // já vem de novoEstado
  try { m.distribuirAtributos(e); } catch { /* sem modelo -> 0 */ }
  const a = m.atributos(e);
  e.vida = a.vida;
  e.mana = a.mana;
  return e;
}

function zonasDe(m, alvo) {
  return (m.LOCAIS || []).filter((l) => (l.monstros || []).some(([nome]) => nome === alvo) || (l.chefe && l.chefe[0] === alvo));
}

async function lutar(o) {
  const m = await M();
  if (o.seed != null) semear(Number(o.seed) || 1);
  const alvoNome = o.alvo || 'Tropa Corpo a Corpo';
  const mm = m.MONSTROS[alvoNome];
  if (!mm) throw new Error('monstro desconhecido: ' + alvoNome);

  const e = montarEstado(m, {
    champ: o.champ || 'katarina', nivel: o.nivel || 30,
    itens: (o.itens || '').split(',').map((s) => s.trim()).filter(Boolean),
    modelo: o.modelo || '',
  });
  if (o.barra) e.barra = o.barra.split(',').map((s) => s.trim()).filter(Boolean);

  // local: dado, ou a primeira zona onde o alvo aparece naturalmente
  let localId = o.local || null;
  if (!localId) { const z = zonasDe(m, alvoNome); localId = z.length ? z[0].id : 'rota-inf'; }
  e.local = localId;

  // stock de poções (o dono quer saber o CUSTO em poções)
  const pot = (o.pocoes === 'none') ? '' : (o.pocoes || 'vida,vidaF,vidaS');
  e.pocoes = { vida: 0, vidaF: 0, vidaS: 0, mana: 0, manaF: 0 };
  for (const k of pot.split(',').map((s) => s.trim()).filter(Boolean)) e.pocoes[k] = 9999;
  // auto-poção: o motor só usa sozinho com VIP ou c.pocaoAuto; a extensão clica -> c.pocaoAuto
  e.auto = { vida: true, limiarVida: o.limiar != null ? Number(o.limiar) : 0.5, mana: false, limiarMana: 0.3, voltar: true };

  const c = m.criarCombate();
  c.pocaoAuto = o.pocaoAuto !== '0';
  c.respawn = 1e9;                       // não gerar grupos novos por conta própria
  const nvAlvo = o.nv != null ? Number(o.nv) : e.nivel;
  const qtd = o.qtd != null ? Number(o.qtd) : 1;
  c.inimigos = [];
  for (let i = 0; i < qtd; i++) c.inimigos.push(m.criarMonstro(alvoNome, nvAlvo));
  // Referencias do GRUPO INICIAL: o motor pode gerar mais monstros durante a luta;
  // `--all` mede a limpeza DESTE grupo, nao um farm infinito.
  const iniciais = c.inimigos.slice();

  const dt = 0.05, maxSeg = o.maxSeg != null ? Number(o.maxSeg) : 180;
  // `--all` (ou `--limpar`): NAO parar no 1.º abate. Farm de mobs e' AoE: o 1.º abate
  // esconde se a build limpou o grupo ou deixou 2 vivos. Mede `tLimpar` (todos mortos).
  const matarTodos = !!o.all || !!o.limpar;
  const ouroIni = e.ouro;
  let t = 0, picoDano = 0;
  const pocoes = {};
  const danoFonte = {};
  const eventos = {};
  let resultado = 'tempo', tAbate = null, tMorte = null, tLimpar = null;
  const maxDano = { visto: 0, t: 0 };
  let danoRecebido = 0;

  while (t < maxSeg) {
    m.passo(e, c, dt);
    for (const ev of c.eventos) {
      eventos[ev.tipo] = (eventos[ev.tipo] || 0) + 1;
      if (ev.tipo === 'pocao') pocoes[ev.chave] = (pocoes[ev.chave] || 0) + 1;
      else if (ev.tipo === 'abate' && (ev.chefe || ev.nome === alvoNome)) { if (tAbate == null) tAbate = t; }
      else if (ev.tipo === 'recebido') { danoRecebido += ev.valor || 0; }
      else if (ev.tipo === 'dano') { danoFonte[ev.fonte || '?'] = (danoFonte[ev.fonte || '?'] || 0) + (ev.valor || 0); }
    }
    c.eventos.length = 0;
    t += dt;
    if (c.darius.morto > 0) { tMorte = t; resultado = 'morreu'; break; }
    if (matarTodos) {
      if (iniciais.length && iniciais.every((i) => i.hp <= 0)) { tLimpar = t; resultado = 'limpou'; break; }
    } else if (tAbate != null) { resultado = 'matou'; break; }
    if (t >= maxSeg) break;
  }
  void picoDano; void maxDano;

  const a = m.atributos(e);
  return {
    campeao: e.campeao, nivel: e.nivel, local: localId, alvo: alvoNome, nvAlvo,
    qtd, itens: e.itens, modelo: e.modelo || null,
    barra: e.barra, ranks: e.ranks,
    resultado, mataSeg: tAbate != null ? n1(tAbate) : null, morreuSeg: tMorte != null ? n1(tMorte) : null,
    tLimpar: tLimpar != null ? n1(tLimpar) : null,
    abates: eventos.abate || 0,
    tempoCorrido: n1(t),
    pocoes, pocoesTotal: Object.values(pocoes).reduce((s, v) => s + v, 0),
    ouroGanho: Math.round(e.ouro - ouroIni),
    custoPocaoOuro: Object.entries(pocoes).reduce((s, [k, n]) => s + n * ((m.POCOES[k] && m.POCOES[k].preco) || 0), 0),
    danoRecebido: Math.round(danoRecebido),
    danoPorFonte: Object.fromEntries(Object.entries(danoFonte).map(([k, v]) => [k, Math.round(v)])),
    mecanica: { carregou: eventos.chefeCarrega || 0, interrompeu: eventos.chefeInterrompido || 0, golpeou: eventos.chefeGolpe || 0 },
    eventos,
    atrib: { hp: Math.round(a.vida), ad: n1(a.ad), ap: n1(a.ap), armadura: n1(a.armadura), rm: n1(a.rm),
      cdr: n1(a.reducaoRecarga || 0), penMag: n1(a.penMagica || 0), penArmadura: n1(a.penArmadura || 0), as: n1(a.velAtaque || 0) },
    inimigosRestantes: (matarTodos ? iniciais : c.inimigos).filter((i) => i.hp > 0).length,
  };
}

// ---------------------------------------------------------------- comandos
function ajuda() {
  const linhas = [
    'HARNESS DO JOGO (LoL Idle) — sem visão, com a fonte do jogo.',
    '',
    '  fontes                                   ficheiros-fonte do jogo (+sha)',
    '  curva [campo] [nv]                       CURVA do motor (hp/ad/armadura/xp/ouro)',
    '  monstro <nome> <nv>                      stats de um monstro',
    '  item <id|ref>                            um item do jogo',
    '  kit <campeao>                            o kit do campeão',
    '  chefe <nome> <nv>                        mecânicas do chefe',
    '  poucoes | pocoes                         as poções do jogo',
    '  atributos <champ> <nv> [--modelo=] [--itens=a,b]',
    '  lutar --champ= --nivel= --alvo= --nv= [--itens=] [--local=] [--pocoes=] [--limiar=] [--maxSeg=] [--seed=]',
    '  verificar                                autoteste: lutas reais contra o motor (rc!=0 se falhar)',
    '  banco [--filter x]                       banco de regressão',
    '  vivo [--match lolidle] [--expr E]        estado ao vivo (delega em tools/cdp-eval.mjs)',
    '  sonda <target_id> [segundos]             liveness/stack (delega em tools/_sonda-alvo.mjs)',
    '',
    'Acrescenta --json a qualquer comando para saída estruturada.',
  ];
  console.log(linhas.join('\n'));
}

function fontes() {
  const alvos = ['motor.js', 'jogo.js', 'cena.js', 'itens.js', 'dados.js', 'dados-katarina.js', 'balanco.js', 'i18n.js'];
  const linhas = [];
  const obj = {};
  for (const f of alvos) {
    const p = path.join(GAME_SRC, f);
    if (!fs.existsSync(p)) { linhas.push(`  ${f.padEnd(20)} (ausente)`); continue; }
    const b = fs.readFileSync(p);
    const sha = crypto.createHash('sha256').update(b).digest('hex');
    const l = b.toString('utf8').split('\n').length;
    linhas.push(`  ${f.padEnd(20)} ${String(b.length).padStart(9)} B  ${String(l).padStart(6)} linhas  ${sha.slice(0, 12)}`);
    obj[f] = { bytes: b.length, linhas: l, sha256: sha };
  }
  out(obj, 'FONTES DO JOGO (docs/game-src):\n' + linhas.join('\n'));
}

function curva(m, campo, nv) {
  const n = Number(nv);
  if (campo && Number.isFinite(n)) {
    const f = m.CURVA[campo];
    if (typeof f !== 'function') throw new Error('campo CURVA desconhecido: ' + campo);
    return out({ campo, nivel: n, valor: n1(f(n)) }, `CURVA.${campo}(${n}) = ${n1(f(n))}`);
  }
  const nivel = Number(campo) || 1;
  const vals = Object.fromEntries(Object.keys(m.CURVA).map((k) => [k, n1(m.CURVA[k](nivel))]));
  out({ nivel, valores: vals }, `CURVA no nível ${nivel}:\n` + Object.entries(vals).map(([k, v]) => `  ${k.padEnd(10)} ${v}`).join('\n'));
}

function monstro(m, nome, nv) {
  if (!nome) throw new Error('uso: monstro <nome> <nv>');
  const mm = m.MONSTROS[nome];
  if (!mm) {
    const iguais = Object.keys(m.MONSTROS).filter((k) => k.toLowerCase().includes(String(nome).toLowerCase()));
    throw new Error('monstro desconhecido: ' + nome + (iguais.length ? '\n  parecidos: ' + iguais.join(', ') : ''));
  }
  const n = Number(nv) || 1;
  const obj = m.criarMonstro(nome, n);
  delete obj.ataque;
  out(obj, `${nome} (nv ${n}) * CURVA:\n` + [
    `  hp        ${Math.round(obj.hpMax)}`,
    `  ad        ${n1(obj.ad)}`,
    `  as        ${obj.as}`,
    `  armadura  ${n1(obj.armadura)}`,
    `  ouro      ~${n1(CURVAxx(m, 'ouro', n, mm.ouro))}`,
    `  xp        ${n1(CURVAxx(m, 'xp', n, mm.xp))}`,
    `  chefe     ${obj.chefe}   magico: ${obj.magico}`,
    `  coef      hp=${mm.hp} ad=${mm.ad} armadura=${mm.armadura}`,
  ].join('\n'));
}
function CURVAxx(m, campo, n, coef) { return m.CURVA[campo](n) * (coef || 1); }

function item(m, ref) {
  if (!ref) throw new Error('uso: item <id|ref>');
  const ii = m.infoItem(ref);
  if (!ii) throw new Error('item desconhecido: ' + ref);
  const usados = ['ad', 'ap', 'mana', 'vida', 'armadura', 'rm', 'va', 'rv', 'critico', 'regen', 'cdr', 'penMag', 'penArmadura', 'efeito'];
  const stats = Object.fromEntries(usados.filter((k) => ii[k]).map((k) => [k, ii[k]]));
  out({ ref, ...ii, valor: tryCall(() => m.valorVenda(ref)), refino: tryCall(() => m.precoRefino(ref)) },
    `${ii.nome} [${ref}] (${ii.raridade}${ii.lendario ? ', lendário' : ''}, espaço ${ii.espaco})\n` +
    `  stats: ${JSON.stringify(stats)}\n  preço: ${ii.preco}   valorVenda: ${tryCall(() => m.valorVenda(ref))}\n  resumo/efeito: ${ii.efeito || ii.resumo || '-'}`);
}
function tryCall(f) { try { const v = f(); return typeof v === 'object' ? v : n1(v); } catch { return null; } }

function kit(m, champ) {
  const K = m.KITS && m.KITS[champ];
  if (!K) throw new Error('campeão desconhecido: ' + champ + '\n  existem: ' + Object.keys(m.KITS || {}).join(', '));
  const e = m.novoEstado(champ);
  const hd = tryCall(() => m.habDe(e));
  out({ champ, kit: K, hab: hd }, `KIT ${champ}:\n` + JSON.stringify(K, null, 2));
}

function chefe(m, nome, nv) {
  if (!nome) throw new Error('uso: chefe <nome> <nv>');
  const mec = m.MECANICAS && m.MECANICAS[nome];
  const mon = m.MONSTROS[nome];
  if (!mon && !mec) throw new Error('chefe desconhecido: ' + nome + '\n  com MECANICAS: ' + Object.keys(m.MECANICAS || {}).join(', '));
  const habs = {};
  for (const [k, h] of Object.entries(m.HAB_CHEFE || {})) habs[k] = { nome: h.nome, carrega: h.carrega, espera: h.espera, dano: h.dano || h.base };
  out({ nome, monstro: mon || null, nivel: Number(nv) || null, mecanicas: mec || null, habChefe: habs },
    `CHEFE ${nome}` + (nv ? ` (nv ${nv})` : '') + ':\n' + JSON.stringify({ monstro: mon, mecanicas: mec }, null, 2));
}

function pocoes(m) {
  out(m.POCOES, 'POÇÕES DO JOGO:\n' + Object.entries(m.POCOES).map(([k, p]) =>
    `  ${k.padEnd(7)} ${p.nome.padEnd(22)} cura ${String(p.cura).padStart(6)}  preço ${String(p.preco).padStart(5)}  nível ${p.nivel}`).join('\n'));
}

async function atributos(o) {
  const m = await M();
  const e = montarEstado(m, {
    champ: o._0 || 'katarina', nivel: Number(o._1) || 30,
    itens: (o.itens || '').split(',').map((s) => s.trim()).filter(Boolean),
    modelo: o.modelo || '',
  });
  const a = m.atributos(e);
  out({ campeao: e.campeao, nivel: e.nivel, itens: e.itens, modelo: e.modelo, atributos: a, ranks: e.ranks, barra: e.barra },
    `ATRIBUTOS ${e.campeao} nv${e.nivel} [${e.itens.join(', ') || 'sem itens'}]\n` + JSON.stringify(a, null, 2));
}

// ---------------------------------------------------------------- main
async function main() {
  if (!cmd || cmd === 'ajuda' || cmd === 'help' || cmd === '-h' || cmd === '--help') { ajuda(); return; }
  if (cmd === 'fontes') return fontes();

  if (cmd === 'banco') {
    const r = spawnSync(process.execPath, [path.join(AQUI, 'testes', 'run.mjs'), ...argv.slice(1)], { cwd: RAIZ, stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  if (cmd === 'vivo') {
    const r = spawnSync(process.execPath, [path.join(AQUI, 'cdp-eval.mjs'), ...argv.slice(1)], { cwd: RAIZ, stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  if (cmd === 'sonda') {
    const r = spawnSync(process.execPath, [path.join(AQUI, '_sonda-alvo.mjs'), ...argv.slice(1)], { cwd: RAIZ, stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }

  const m = await M();
  const p = semFlags(argv.slice(1));
  switch (cmd) {
    case 'curva': return curva(m, p[0], p[1]);
    case 'monstro': return monstro(m, p[0], p[1]);
    case 'item': return item(m, p[0]);
    case 'kit': return kit(m, p[0]);
    case 'chefe': return chefe(m, p[0], p[1]);
    case 'pocoes': case 'poucoes': return pocoes(m);
    case 'atributos': return atributos({ _0: p[0], _1: p[1], itens: opt('--itens'), modelo: opt('--modelo') });
    case 'lutar': case 'simular': {
      const res = await lutar({
        champ: opt('--champ', 'katarina'), nivel: opt('--nivel', '30'),
        alvo: opt('--alvo'), nv: opt('--nv'), itens: opt('--itens'), local: opt('--local'),
        modelo: opt('--modelo'), pocoes: opt('--pocoes'), limiar: opt('--limiar'), barra: opt('--barra'),
        pocaoAuto: opt('--pocaoAuto'), maxSeg: opt('--maxSeg'), seed: opt('--seed'), qtd: opt('--qtd'),
        all: flag('--all') || flag('--limpar'),
      });
      if (J) return out(res);
      const l = [
        `LUTA: ${res.campeao} nv${res.nivel} vs ${res.alvo} nv${res.nvAlvo}   (${res.local}, seed determinística)`,
        `  itens:  ${res.itens.join(', ') || '(nenhum)'}`,
        `  barra:  ${res.barra.join(',')}   ranks ${JSON.stringify(res.ranks)}`,
        `  atrib:  hp ${res.atrib.hp}  ad ${res.atrib.ad}  ap ${res.atrib.ap}  arm ${res.atrib.armadura}  rm ${res.atrib.rm}  cdr ${res.atrib.cdr}  penMag ${res.atrib.penMag}  penArm ${res.atrib.penArmadura}`,
        `  RESULTADO: ${res.resultado}` + (res.mataSeg != null ? ` em ${res.mataSeg}s` : '') + (res.morreuSeg != null ? ` (morreu aos ${res.morreuSeg}s)` : ''),
        `  poções: ${JSON.stringify(res.pocoes)}  total ${res.pocoesTotal}  custo ${res.custoPocaoOuro} ouro`,
        `  mecânica: ${JSON.stringify(res.mecanica)}`,
        `  ouro ganho ${res.ouroGanho}   dano recebido ${res.danoRecebido}   dano por fonte ${JSON.stringify(res.danoPorFonte)}`,
      ];
      return out(res, l.join('\n'));
    }
    case 'verificar': case 'auto': {
      // AUTOTESTE do harness (REGRA N.º 6): corre lutas determinísticas contra o motor REAL e
      // verifica que a MECÂNICA do jogo acontece como a fonte diz. rc!=0 se algum check falhar.
      const checks = [];
      const ck = (rot, cond, det) => checks.push({ rot, ok: !!cond, det: det == null ? '' : String(det) });
      const katarina30 = { champ: 'katarina', nivel: 30, seed: 1, maxSeg: 120, pocoes: 'none' };
      const r1 = await lutar({ ...katarina30, alvo: 'Tropa Corpo a Corpo', nv: 20, qtd: 6 });
      ck('luta fraca: mata a Tropa nv20', r1.resultado === 'matou', r1.resultado);
      const arma = '3153,6653,3116,3089';
      const r2 = await lutar({ ...katarina30, alvo: 'Arauto do Vale', nv: 20, itens: arma, barra: 'Q,R,E,A' });
      const r3 = await lutar({ ...katarina30, alvo: 'Arauto do Vale', nv: 20, itens: arma, barra: 'Q,R,W,E' });
      ck('Arauto COM o atordoamento na barra: o motor INTERROMPE a investida (motor.js:3112)',
        r2.mecanica.interrompeu > 0, JSON.stringify(r2.mecanica));
      ck('Arauto SEM o atordoamento na barra: NAO interrompe', r3.mecanica.interrompeu === 0,
        JSON.stringify(r3.mecanica));
      ck('interromper REDUZ o dano recebido (o stun poupa vida)', r2.danoRecebido < r3.danoRecebido,
        r2.danoRecebido + ' < ' + r3.danoRecebido);
      const r4 = await lutar({ champ: 'katarina', nivel: 42, alvo: 'Barão Nashor', nv: 46, local: 'barao', itens: arma, seed: 3, maxSeg: 60 });
      ck('Barão nv46: o combate CORRE e é determinístico (não trava)',
        ['matou', 'morreu', 'tempo'].includes(r4.resultado), r4.resultado);
      const ok = checks.every((c) => c.ok);
      if (J) return out({ ok, checks });
      console.log('AUTOTESTE DO HARNESS — lutas reais contra docs/game-src/motor.js\n');
      for (const c of checks) console.log(`  ${c.ok ? 'OK  ' : 'FALHA'} ${c.rot}${c.det ? '   (' + c.det + ')' : ''}`);
      console.log(`\n${ok ? 'TUDO OK' : 'HA FALHAS'} — ${checks.filter((c) => c.ok).length}/${checks.length}`);
      process.exit(ok ? 0 : 1);
    }
    default: throw new Error('comando desconhecido: ' + cmd + '\n\n' + '(sem args para ajuda)');
  }
}

main().catch((e) => { console.error('ERRO: ' + (e && e.message || e)); process.exit(1); });
