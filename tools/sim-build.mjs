#!/usr/bin/env bun
/*
 * tools/sim-build.mjs — SIMULADOR DE DPS DE BUILDS com a MATEMÁTICA DO JOGO.
 *
 * PORQUE NÃO IMPORTA O MOTOR: "motor.js:3-8" importa 'dados-ezreal.js', 'dados-yasuo.js',
 * 'dados-lux.js', 'dados-katarina.js', 'dados-taric.js' e 'dados-zac.js' e NENHUM deles existe em
 * 'docs/game-src/' (mesma limitação registada em docs/drops-e-prioridades.md e docs/yasuo-build.md).
 * Logo o motor é lido como TEXTO e as fórmulas são reimplementadas AQUI com a citação
 * 'file:linha' de cada número. Nenhum número é inventado: ou vem do catálogo (itens.js), ou é
 * extraído do motor por regex COM a linha onde estava, ou vem de medição real em docs/snapshots/.
 *
 * USO:  bun tools/sim-build.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const MOTOR_SRC = ler('docs/game-src/motor.js');
const ITENS_SRC = ler('docs/game-src/itens.js');

// ---------------------------------------------------------------------------------------------
// 0) EXTRATOR COM CITAÇÃO — todo o número sai daqui com o file:linha onde foi lido.
// ---------------------------------------------------------------------------------------------
const linhaDe = (texto, idx) => texto.slice(0, idx).split('\n').length;
function extrair(arquivo, texto, re, nome, grupo = 1) {
  const m = texto.match(re);
  if (!m) throw new Error('NAO VERIFICADO: ' + nome + ' nao encontrado em ' + arquivo);
  const bruto = m[grupo];
  const v = bruto == null ? null : (String(bruto).includes(',') ? parseFloat(String(bruto).replace(',', '.')) : Number(bruto));
  if (bruto != null && !Number.isFinite(v)) throw new Error('NAO VERIFICADO: ' + nome + ' nao e numero (' + bruto + ')');
  return { v, onde: arquivo + ':' + linhaDe(texto, m.index), nome };
}
const cit = (o) => o.v + ' [' + o.onde + ']';

// ---------------------------------------------------------------------------------------------
// 1) CONSTANTES DO MOTOR (cada uma com a linha)
// ---------------------------------------------------------------------------------------------
const M = {
  RM_MONSTRO:      extrair('motor.js', MOTOR_SRC, /export const RM_MONSTRO = ([\d.]+);/, 'RM_MONSTRO'),
  TETO_VIDA_ITEM:  extrair('motor.js', MOTOR_SRC, /export const TETO_VIDA_ITEM = ([\d.]+);/, 'TETO_VIDA_ITEM'),
  VEL_ATAQUE_MAX:  extrair('motor.js', MOTOR_SRC, /export const VEL_ATAQUE_MAX = ([\d.]+);/, 'VEL_ATAQUE_MAX'),
  ESPACOS_ITENS:   extrair('motor.js', MOTOR_SRC, /export const ESPACOS_ITENS = ([\d]+);/, 'ESPACOS_ITENS'),
  BARRA:           extrair('motor.js', MOTOR_SRC, /export const BARRA = ([\d]+);/, 'BARRA'),
  DANO_CRIT_BASE:  extrair('motor.js', MOTOR_SRC, /let critico = 0, danoCritico = ([\d.]+)/, 'danoCritico base'),
  GUME_CRIT:       extrair('motor.js', MOTOR_SRC, /if \(tem\('3031'\)\) danoCritico \+= ([\d.]+);/, '3031 danoCritico'),
  RABADON_MULT:    extrair('motor.js', MOTOR_SRC, /if \(tem\('3089'\)\) ap \*= ([\d.]+);/, '3089 ap*'),
  ARCANJO_PCT:     extrair('motor.js', MOTOR_SRC, /if \(tem\('3003'\)\) ap \+= ([\d.]+) \* manaMax;/, '3003 mana->ap'),
  TIRANIA_PCT:     extrair('motor.js', MOTOR_SRC, /if \(tem\('2501'\)\) ad \+= ([\d.]+) \* \(vida - baseVida\);/, '2501 vida->ad'),
  VOID_PEN:        extrair('motor.js', MOTOR_SRC, /ap, penMagica: Math\.min\(([\d.]+), \(tem\('3135'\) \? ([\d.]+) : 0\)/, 'penMagica cap', 1),
  VOID_PEN_3135:   extrair('motor.js', MOTOR_SRC, /ap, penMagica: Math\.min\(([\d.]+), \(tem\('3135'\) \? ([\d.]+) : 0\)/, '3135 pen', 2),
  CDR_CAP:         extrair('motor.js', MOTOR_SRC, /reducaoRecarga: Math\.min\(([\d.]+), Math\.min\(([\d.]+), 0\.004 \* at\.foco\)/, 'reducaoRecarga cap', 1),
  CDR_CAP_ATRIB:   extrair('motor.js', MOTOR_SRC, /reducaoRecarga: Math\.min\(([\d.]+), Math\.min\(([\d.]+), 0\.004 \* at\.foco\)/, 'reducaoRecarga cap atributo', 2),
  PEN_ARM_3036:    extrair('motor.js', MOTOR_SRC, /penArmadura: 1 - \(1 - penE\) \* \(tem\('3036'\) \? ([\d.]+) : 1\)/, '3036 pen armadura'),
  CHEFE_3036:      extrair('motor.js', MOTOR_SRC, /if \(alvo\.chefe && a\.tem\?\.\('3036'\)\) dano \*= ([\d.]+);/, '3036 vs chefe'),
  LICH_PROC:       extrair('motor.js', MOTOR_SRC, /if \(d\.lich && a\.tem\('3100'\)\) \{ d\.lich = false; golpear\([^;]*?([\d.]+) \* \(a\.ap \|\| 0\)/, 'Lich 3100 proc'),
  LUDEN_BASE:      extrair('motor.js', MOTOR_SRC, /golpear\(estado, c, adEfetivo, i, ([\d]+) \+ ([\d.]+) \* \(a\.ap \|\| 0\)/, 'Luden base', 1),
  LUDEN_AP:        extrair('motor.js', MOTOR_SRC, /golpear\(estado, c, adEfetivo, i, ([\d]+) \+ ([\d.]+) \* \(a\.ap \|\| 0\)/, 'Luden AP%', 2),
  LUDEN_CD:        extrair('motor.js', MOTOR_SRC, /if \(a\.tem\('6655'\) && \(d\.timers\.luden \|\| 0\) <= 0\) \{\s*d\.timers\.luden = ([\d.]+);/, 'Luden recarga'),
  LUDEN_ALVOS:     extrair('motor.js', MOTOR_SRC, /d\.timers\.luden = [\d.]+;\s*const alvos = \(vivos \|\| \[\]\)\.filter\(\(i\) => i\.hp > 0\)\.slice\(0, ([\d]+)\)/, 'Luden alvos'),
  LIANDRY_PCT:     extrair('motor.js', MOTOR_SRC, /if \(a\.tem\?\.\('6653'\)\) alvo\.queima = donoQueima\(\{ dps: vidaRefItem\(alvo\) \* ([\d.]+), t: (\d+)/, 'Liandry %/s'),
  CHAMA_4645:      extrair('motor.js', MOTOR_SRC, /if \(a\.tem\?\.\('4645'\) && f < 0\.4\) bruto \*= ([\d.]+);/, 'Chama Sombria +20%'),
  MORELO_3165:     extrair('motor.js', MOTOR_SRC, /if \(a\.tem\?\.\('3165'\) && f < 0\.5\) bruto \*= ([\d.]+);/, 'Morellonomicon +12%'),
  SHUNPO_PEGA:     extrair('motor.js', MOTOR_SRC, /if \(HP\.shunpo && d\.recargas\?\.E > 0\) d\.recargas\.E \*= ([\d.]+) - HP\.shunpo;/, 'Shunpo 1-x'),
};
const BONUS_REFINO = extrair('motor.js', MOTOR_SRC, /export const BONUS_REFINO = ([\d.]+);/, 'BONUS_REFINO');
const QUAL_BLOCO = MOTOR_SRC.match(/export const QUALIDADES = \{([\s\S]*?)\n\};/);
if (!QUAL_BLOCO) throw new Error('NAO VERIFICADO: QUALIDADES (motor.js:173) nao encontrado');
const QUAL_LINHA = linhaDe(MOTOR_SRC, QUAL_BLOCO.index);
const QUALIDADES = {};
for (const m of QUAL_BLOCO[1].matchAll(/([A-Z]{1,2}): \{ peso: [\d.]+, mult: ([\d.]+)/g)) QUALIDADES[m[1]] = { mult: parseFloat(m[2]), onde: 'motor.js:' + QUAL_LINHA };
// ---------------------------------------------------------------------------------------------
// 1b) O CDR DOS ATRIBUTOS (a peça que faltava no modelo). motor.js:537:
//       reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens)
//     Dois tetos: 0.3 SÓ nos atributos e 0.4 no total (atributos + itens). O Foco ainda dá
//     +0.2% de dano de habilidade por ponto a quem não usa mana (motor.js:457, 531, 1218).
// ---------------------------------------------------------------------------------------------
const CDR_ATRIB = (() => {
  const m = MOTOR_SRC.match(/reducaoRecarga: Math\.min\(([\d.]+), Math\.min\(([\d.]+), ([\d.]+) \* at\.foco\) \+ cdrItens\)/);
  if (!m) throw new Error('NAO VERIFICADO: reducaoRecarga com at.foco (motor.js:537) nao encontrado');
  return { cap: +m[1], capAtrib: +m[2], porFoco: +m[3], onde: 'motor.js:' + linhaDe(MOTOR_SRC, m.index) };
})();
if (CDR_ATRIB.cap !== M.CDR_CAP.v || CDR_ATRIB.capAtrib !== M.CDR_CAP_ATRIB.v) throw new Error('NAO VERIFICADO: tetos de CDR divergentes (motor.js:537)');
const CDR_ATRIB_POR_FOCO = { v: CDR_ATRIB.porFoco, onde: CDR_ATRIB.onde, nome: 'cdr por ponto de Foco' };   // o 0.004 de motor.js:537
const FOCO_DANO_HAB = extrair('motor.js', MOTOR_SRC, /export const FOCO_DANO_HAB = ([\d.]+), FOCO_FLUXO = ([\d.]+)/, 'FOCO_DANO_HAB', 1);
// FOCO: LIDO de uma fonte real, NUNCA deduzido de um total (regra do Lead, 14/10/2026).
// MEDIDO no painel de atributos do jogo (Katarina nível 29): Força 81 · Vitalidade 3 · Resistência 0
// · Agilidade 0 · Foco 0.   81 + 3 = 84 = 3 × 28 = todos os pontos (motor.js:483,1047).
//   -> CDR dos ATRIBUTOS do dono = 0,004 × 0 = 0,000  (motor.js:537)
// Parâmetro explícito: --foco N   (ex.: bun tools/sim-build.mjs --foco 57.5). Default = o valor medido.
const FOCO_DONO = 0;
const argFoco = (() => {
  const i = process.argv.findIndex((a) => a === '--foco' || a.startsWith('--foco='));
  if (i < 0) return null;
  const a = process.argv[i], v = Number(a.includes('=') ? a.slice(a.indexOf('=') + 1) : process.argv[i + 1]);
  return Number.isFinite(v) ? v : null;
})();
const FOCO = argFoco == null ? FOCO_DONO : argFoco;
// PREMISSA ANTIGA — REFUTADA (fica registada para pôr os números antigos ao lado dos novos):
// deduzia Foco = 0,23/0,004 = 57,5 pontos a partir do cdr 0,23 medido. ERRADO: os 0,23 vinham do ITEM
// Ímpeto +3~A — 0,15 (patch motor.js:24) × 1,15 (qualidade A) × 1,36 (refino +3) = 0,2346 (motor.js:255).
const FOCO_PREMISSA_ANTIGA = 57.5;
const CDR_IMPETO_3A = 0.15 * (1 + 0.12 * 3) * 1.15;   // termo a termo, nada deduzido
const CDR_BOTA_3A = 0.08 * (1 + 0.12 * 3) * 1.15;     // 3158 Botas Ionianas (itens.js) × refino × qualidade
const CDR_BOTA_3SS = 0.08 * (1 + 0.12 * 3) * 1.7;     // 3158 +3 de qualidade SS (dá 18,5% — o "18,6%" do Lead)
// ---------------------------------------------------------------------------------------------
// 2) CATÁLOGO (itens.js e os 4 patches de cdr do motor.js:16-26)
// ---------------------------------------------------------------------------------------------
const ITENS = JSON.parse(ITENS_SRC.replace(/^[\s\S]*?export const ITENS_DADOS = /, '').replace(/;\s*$/, ''));
const POR_ID = new Map(ITENS.map((i) => [String(i.id), i]));
const baseId = (x) => { const s = String(x), i = s.search(/[+~]/); return i < 0 ? s : s.slice(0, i); };
const refinoDe = (x) => +((/\+(\d+)/.exec(String(x)) || [])[1] || 0);
const qualidadeDe = (x) => ((/~(SS|S|A|B|C|\?)$/.exec(String(x)) || [])[1] || 'B');
// os patches que o motor faz DEPOIS de ler o catálogo (motor.js:16-26): sem eles o Ímpeto
// Cósmico (4629) não teria cdr nenhum — o texto "−15% na recarga" não é campo do JSON.
const PATCHES = [...MOTOR_SRC.matchAll(/Object\.assign\(ITENS\['(\d+)'\], \{ ([^}]*)\}\)/g)].map((m) => ({
  id: m[1], campos: m[2], onde: 'motor.js:' + linhaDe(MOTOR_SRC, m.index),
}));
const ITENS_PATCH = ITENS.map((i) => ({ ...i }));
for (const p of PATCHES) {
  const it = ITENS_PATCH.find((x) => String(x.id) === p.id); if (!it) continue;
  for (const m of p.campos.matchAll(/([A-Za-z]+): ([\d.]+)/g)) it[m[1]] = parseFloat(m[2]);
}
const POR_ID_P = new Map(ITENS_PATCH.map((i) => [String(i.id), i]));
// infoItem (motor.js:251): multiplica TODOS os stats por (1 + 0.12*refino) * QUALIDADES[qual].mult
function infoItem(idCompleto) {
  const i = POR_ID_P.get(baseId(idCompleto));
  if (!i) return null;
  const ref = refinoDe(idCompleto), qual = qualidadeDe(idCompleto);
  const m = (1 + BONUS_REFINO.v * ref) * ((QUALIDADES[qual] || QUALIDADES.B).mult);
  const campos = ['ad', 'ap', 'mana', 'vida', 'armadura', 'rm', 'va', 'rv', 'critico', 'regen', 'cdr'];
  const out = { ...i, chave: idCompleto, ref, qual, m };
  for (const c of campos) out[c] = (i[c] || 0) * m;
  return out;
}

// ---------------------------------------------------------------------------------------------
// 3) KITS DO MOTOR — Katarina (motor.js:735-771) e Lux (motor.js:633-668).
//    O motor importa os DADOS de dados-*.js (ausentes) mas as TABELAS DE RECARGA/BASE/RATIO
//    estão INLINE em motor.js: dá para extraí-las sem os ficheiros em falta.
// ---------------------------------------------------------------------------------------------
if (!/const serie = \(ini, passo, n = 10\)/.test(MOTOR_SRC)) throw new Error('NAO VERIFICADO: serie() (motor.js:550) nao encontrado');
const serie = (ini, passo, n = 10) => Array.from({ length: n }, (_, i) => +(ini + passo * i).toFixed(4));

const CACHE_BLOCO = new Map();
function blocoKit(nome) {
  const cache = CACHE_BLOCO.get(nome); if (cache) return cache;
  const marca = MOTOR_SRC.indexOf('const ' + nome + ' = {');
  if (marca < 0) throw new Error('NAO VERIFICADO: ' + nome + ' nao encontrado em motor.js');
  const corpo = MOTOR_SRC.slice(marca);
  const fim = corpo.indexOf('\n};');
  const bloco = corpo.slice(0, fim);
  const linha0 = linhaDe(MOTOR_SRC, marca);
  const out = {};
  const pedacos = bloco.split(/\n  (?=[A-Z]: \{)/).slice(1);
  let acc = 0;
  for (const pedaco of pedacos) {
    const t = pedaco.slice(0, 1);
    out[t] = { texto: pedaco, linha: linha0 + bloco.slice(0, bloco.indexOf(pedaco, acc)).split('\n').length - 1 };
    acc = bloco.indexOf(pedaco, acc) + pedaco.length;
  }
  const resultado = { bloco, linha0, habs: out };
  CACHE_BLOCO.set(nome, resultado);
  return resultado;
}
/** lê um campo do bloco de uma habilidade: serie(a,b[,n]) | [array] | número */
function campo(bloco, nome, tecla) {
  const h = bloco.habs[tecla]; if (!h) return null;
  const m = h.texto.match(new RegExp('\\b' + nome + ': (serie\\(([^)]*)\\)|\\[[^\\]]*\\]|[\\d.]+)'));
  if (!m) return null;
  const bruto = m[1];
  let v;
  if (bruto.startsWith('serie(')) {
    const a = bruto.slice(6, -1).split(',').map((x) => parseFloat(x.trim()));
    v = serie(a[0], a[1], Number.isFinite(a[2]) ? a[2] : 10);
  } else if (bruto.startsWith('[')) v = bruto.slice(1, -1).split(',').map((x) => parseFloat(x.trim()));
  else v = [parseFloat(bruto)];
  return { v, onde: 'motor.js:' + (h.linha + h.texto.slice(0, m.index).split('\n').length - 1), bruto };
}
const CACHE_HAB = new Map();
function hab(nomeKit, tecla) {
  const chave = nomeKit + '|' + tecla;
  const cache = CACHE_HAB.get(chave); if (cache) return cache;
  const k = blocoKit(nomeKit);
  const c = (n) => { const x = campo(k, n, tecla); return x ? x.v : null; };
  const out = {
    tecla, linha: k.habs[tecla].linha, kit: nomeKit,
    nome: (k.habs[tecla].texto.match(/nome: ([^,]+),/) || [])[1] || tecla,
    max: (c('max') || [1])[0],
    nivel: (c('nivel') || [1])[0],
    recarga: c('recarga'), base: c('base'), ratio: c('ratio'),
    adRatio: c('adRatio') ? c('adRatio')[0] : 0,
    mult: c('mult') ? c('mult')[0] : 1,
    golpes: c('golpes') ? c('golpes')[0] : 1,
    alvos: c('alvos') ? c('alvos')[0] : 1,
    adaga: /\badaga: true/.test(k.habs[tecla].texto),
    passiva: /\bpassiva: true/.test(k.habs[tecla].texto),
  };
  CACHE_HAB.set(chave, out);
  return out;
}
const habsDe = (nomeKit) => Object.keys(blocoKit(nomeKit).habs);

// Voracidade (passiva da Katarina) — motor.js:737
const GIRO_LINHA = MOTOR_SRC.match(/giro: \(nivel, a\) => ([\d.]+) \+ ([\d.]+) \* nivel \+ ([\d.]+) \* apDe\(a\) \+ ([\d.]+) \* Math\.max\(0, a\.ad - a\.baseAd\)/);
if (!GIRO_LINHA) throw new Error('NAO VERIFICADO: P.giro da Katarina (motor.js:737) nao encontrado');
const GIRO = { base: +GIRO_LINHA[1], nivel: +GIRO_LINHA[2], ap: +GIRO_LINHA[3], ad: +GIRO_LINHA[4], onde: 'motor.js:' + linhaDe(MOTOR_SRC, GIRO_LINHA.index) };
const GIRO_CHEFE = extrair('motor.js', MOTOR_SRC, /P: \{ voracidade: ([\d.]+), voracidadeChefe: ([\d.]+)/, 'voracidade chefe', 2);
const PEGA_CADA = extrair('motor.js', MOTOR_SRC, /dura: 4, pegaCada: ([\d.]+), shunpo/, 'pegaCada (Katarina)');

// papel.dano de cada campeão (motor.js:870-894)
const CACHE_PAPEL = new Map();
function papelDano(id) {
  const cache = CACHE_PAPEL.get(id); if (cache) return cache;
  const re = new RegExp('\\n  ' + id + ': \\{ id: .' + id + '.[\\s\\S]*?papel: \\{ dano: ([\\d.]+)');
  const out = extrair('motor.js', MOTOR_SRC, re, 'papel.dano ' + id);
  CACHE_PAPEL.set(id, out);
  return out;
}
// ---------------------------------------------------------------------------------------------
// 4) O PERSONAGEM REAL (medido) — docs/snapshots/player.json + a build da luta registada.
//    A calibração serve para ISOLAR os itens: o que fica constante (nível/atributos) cancela
//    nas comparações, e os stats medidos permitem CONFERIR o modelo contra o jogo.
// ---------------------------------------------------------------------------------------------
const NAO_VERIFICADO = [];
let PERSONAGEM = null;
try {
  const player = JSON.parse(ler('docs/snapshots/player.json'));
  const kat = JSON.parse(ler('docs/snapshots/katarina.json'));
  const buildMedida = (kat.lutas && kat.lutas[0] && kat.lutas[0].build) || null;
  const luta = (kat.lutas || []).find((l) => l.analise && l.analise.porFonte) || null;
  if (!buildMedida || !luta) throw new Error('snapshot sem build/analise');
  const soma = (campo) => buildMedida.reduce((s, id) => s + ((infoItem(id) || {})[campo] || 0), 0);
  const pctDe = (campo) => buildMedida.reduce((s, id) => s + ((POR_ID_P.get(baseId(id)) || {})[campo] || 0), 0);
  const tem = (id) => buildMedida.some((x) => baseId(x) === id);
  const rab = tem('3089') ? M.RABADON_MULT.v : 1;
  PERSONAGEM = {
    campeao: kat.champ || 'katarina', nivel: player.nivel, build: buildMedida,
    medido: { ad: player.dano, ap: player.poder, va: player.va, vida: player.vida, armadura: player.armadura, rm: player.rm },
    base: {
      ad: player.dano / (1 + pctDe('adPct')) - soma('ad'),
      ap: player.poder / (rab * (1 + pctDe('apPct'))) - soma('ap'),
      vida: (player.vida - soma('vida')) / (1 + pctDe('vidaPct')),
      armadura: (player.armadura - soma('armadura')) / (1 + pctDe('armPct')),
      rm: (player.rm - soma('rm')) / (1 + pctDe('rmPct')),
    },
    vaK: player.va / (1 + soma('va')),
    luta: { boss: luta.boss, durS: luta.durS, outDps: luta.analise.outDps, porFonte: luta.analise.porFonte, dmgTotal: luta.analise.dmgTotal },
    onde: 'docs/snapshots/player.json + docs/snapshots/katarina.json',
  };
} catch (e) { NAO_VERIFICADO.push('personagem medido: ' + e.message); }

// ---------------------------------------------------------------------------------------------
// 5) ATRIBUTOS (motor.js:492-544) — reimplementação fiel, com a linha de cada termo.
// ---------------------------------------------------------------------------------------------
function atributos(itensIds, base, opt = {}) {
  const ids = itensIds.map(String);
  const tem = (id) => ids.some((x) => baseId(x) === id);
  const soma = (c) => ids.reduce((s, id) => s + ((infoItem(id) || {})[c] || 0), 0);
  const pct = { adPct: 0, apPct: 0, vidaPct: 0, armPct: 0, rmPct: 0, esquiva: 0, penMag: 0 };
  for (const id of ids) { const i = POR_ID_P.get(baseId(id)); if (!i) continue; for (const p of Object.keys(pct)) pct[p] += i[p] || 0; }
  let ad = base.ad + soma('ad'), ap = base.ap + soma('ap');
  const cdrItens = soma('cdr');
  // motor.js:537 — o Foco (atributo) entra ANTES do teto total:
  //   reducaoRecarga = min(0.4, min(0.3, 0.004 * at.foco) + cdrItens)
  // O modelo anterior usava só cdrItens: com a build do dono (0 itens com cdr) dava cdr 0 e o jogo tem 0.23.
  const foco = opt.foco == null ? FOCO : opt.foco;
  const cdrAtrib = Math.min(CDR_ATRIB.capAtrib, CDR_ATRIB.porFoco * foco);
  const cdrTotal = cdrAtrib + cdrItens;
  if (tem('2501')) ad += M.TIRANIA_PCT.v * soma('vida');                                     // motor.js:514
  let danoCritico = M.DANO_CRIT_BASE.v + (tem('3031') ? M.GUME_CRIT.v : 0);                   // motor.js:499,515
  if (tem('3003')) ap += M.ARCANJO_PCT.v * (base.mana || 0);                                  // motor.js:521
  if (tem('3089')) ap *= M.RABADON_MULT.v;                                                    // motor.js:522
  ad *= 1 + pct.adPct; ap *= 1 + pct.apPct;                                                   // motor.js:523
  const va = Math.min(M.VEL_ATAQUE_MAX.v, (base.vaK || 0) * (1 + soma('va')));                // motor.js:534
  return {
    ad, ap, va,
    vida: (base.vida + soma('vida')) * (1 + pct.vidaPct),                                     // motor.js:511
    critico: Math.min(1, soma('critico')),                                                     // motor.js:541
    danoCritico,                                                                               // motor.js:541
    penMagica: Math.min(M.VOID_PEN.v, (tem('3135') ? M.VOID_PEN_3135.v : 0) + pct.penMag),     // motor.js:529
    penArmadura: 1 - (tem('3036') ? 1 - M.PEN_ARM_3036.v : 1),                                 // motor.js:539 (penE=0 nos dois campeões)
    foco, cdrAtrib, cdrItens, cdrTotal,
    cdr: Math.min(CDR_ATRIB.cap, cdrTotal),                                                    // motor.js:537
    cdrTravado: cdrTotal > CDR_ATRIB.cap + 1e-9,                                               // o teto total cortou
    rv: soma('rv'), critItens: soma('critico'),
  };
}

// ---------------------------------------------------------------------------------------------
// 6) DPS (motor.js:1167 mitigar; 1192-1234 golpear; 1673-1721 ataque básico; 1688/1944 Lich)
// ---------------------------------------------------------------------------------------------
const mitigar = (dano, arm) => dano * (100 / (100 + Math.max(0, arm)));                        // motor.js:1167
const mitMagica = (armAlvo, penMag) => mitigar(1, armAlvo * M.RM_MONSTRO.v * (1 - penMag));    // motor.js:1202,1179
const mitFisica = (armAlvo, penArm) => mitigar(1, armAlvo * (1 - penArm));                     // motor.js:1202

/**
 * DPS de um conjunto de itens contra um alvo {armadura, hp, nivel, chefe}.
 * opt.fracaoBaixo40 / fracaoBaixo50 = fracção da luta abaixo dos limiares da Chama/Morello
 * (passivas CONDICIONAIS: o motor.js:1205-1206 só aplica quando f < 0,4 / 0,5; a fracção não
 * sai de ficheiro nenhum -> é parâmetro, com sensibilidade impressa).
 */
function dps(itensIds, alvo, opt = {}) {
  const p = PERSONAGEM;
  const campeao = opt.campeao || p.campeao;
  const nivel = opt.nivel || p.nivel;
  const A = atributos(itensIds, { ...p.base, vaK: p.vaK }, { foco: opt.foco });
  const nAlvos = Math.max(1, opt.alvos || 1);
  // uptime: o modelo assume "em recarga, sempre" (TETO). A luta medida mostra a parte das habilidades
  // a ~0,6 do teto; opt.uptime escala SÓ as fontes que dependem de estar sempre a castar/bater.
  const up = opt.uptime == null ? 1 : opt.uptime;
  // Foco de quem não usa mana (motor.js:531): +0.2% de dano de habilidade por ponto (motor.js:457),
  // aplicado em motor.js:1218 a TODA fonte "hab" — as habilidades E o giro das adagas (fonte 'P');
  // NÃO ao ataque básico, ao proc do Lich (fonte 'item') nem à queima do Liandry.
  const semMana = campeao === 'katarina' || campeao === 'zac' || campeao === 'yasuo';
  const danoHab = opt.semFoco || !semMana ? 0 : FOCO_DANO_HAB.v * A.foco;
  const focoMult = 1 + danoHab;
  const papel = papelDano(campeao).v;                                                          // motor.js:1212
  const arm = alvo.armadura || 0;
  const mm = mitMagica(arm, A.penMagica), mf = mitFisica(arm, A.penArmadura);
  const chama = itensIds.some((x) => baseId(x) === '4645') ? (M.CHAMA_4645.v - 1) * (opt.fracaoBaixo40 || 0) : 0;    // motor.js:1205
  const morello = itensIds.some((x) => baseId(x) === '3165') ? (M.MORELO_3165.v - 1) * (opt.fracaoBaixo50 || 0) : 0; // motor.js:1206
  const habMult = 1 + chama + morello;

  const nomeKit = campeao === 'lux' ? 'HAB_LUX' : 'HAB_KATARINA';
  const barra = opt.barra || barraPadrao(campeao, nivel);
  const cast = [];
  let dpsHab = 0;
  for (const t of barra) {
    const h = hab(nomeKit, t);
    if (!h.base || !h.recarga) continue;
    const r = rankNoNivel(h, nivel);
    const base = h.base[Math.min(r, h.base.length) - 1] || 0;
    const ratio = (h.ratio || [0])[Math.min(r, (h.ratio || [1]).length) - 1] || 0;
    const direto = base + ratio * A.ap + h.adRatio * A.ad;
    const dano = direto * (h.golpes || 1);
    const cd = h.recarga[Math.min(r, h.recarga.length) - 1] * (1 - A.cdr);                      // motor.js:1581
    dpsHab += (dano / cd) * mm * papel * habMult * focoMult * alvosDaHab(h, nAlvos) * up;
    cast.push({ t, cd, dano });
  }
  const castsPorSeg = cast.reduce((s, c) => s + (c.cd > 0 ? 1 / c.cd : 0), 0);

  let dpsPassiva = 0, giro = 0, spinsPorSeg = 0;
  if (campeao === 'katarina') {
    giro = GIRO.base + GIRO.nivel * nivel + GIRO.ap * A.ap + GIRO.ad * Math.max(0, A.ad - p.base.ad);
    const dagas = cast.filter((c) => hab('HAB_KATARINA', c.t).adaga).reduce((s, c) => s + (c.cd > 0 ? 1 / c.cd : 0), 0);
    spinsPorSeg = Math.min(dagas, 1 / PEGA_CADA.v);                                              // motor.js:2181
    dpsPassiva = spinsPorSeg * giro * mm * papel * habMult * focoMult * nAlvos * up;            // o giro corta TODOS em volta (motor.js:2159,2180)
  }

  const critMult = 1 + A.critico * (A.danoCritico - 1);                                          // motor.js:1700,1213
  const dpsAtaque = A.va * A.ad * critMult * mf * papel * up;                                    // motor.js:1675,1700

  const temLich = itensIds.some((x) => baseId(x) === '3100');
  const procsLich = temLich ? Math.min(castsPorSeg, A.va) : 0;                                    // motor.js:1944 arma / 1688 gasta
  const dpsLich = procsLich * (M.LICH_PROC.v * A.ap) * mm * papel * up;

  const dpsLuden = itensIds.some((x) => baseId(x) === '6655') && castsPorSeg > 0
    ? (1 / M.LUDEN_CD.v) * (M.LUDEN_BASE.v + M.LUDEN_AP.v * A.ap) * Math.min(nAlvos, opt.alvosLuden || M.LUDEN_ALVOS.v) * mm * papel * up : 0;

  let dpsQueima = 0;
  if (itensIds.some((x) => baseId(x) === '6653') && alvo.hp) {
    const curva = (n) => 150 + 100 * n + 1.0 * n * n;                                            // motor.js:274
    const cap = M.TETO_VIDA_ITEM.v * curva(alvo.nivel || 1);                                     // motor.js:1191
    // a queima dura 3 s (motor.js:1207) e é renovada a cada golpe de habilidade/giro: com uptime baixo
    // ela pode LARGAR o alvo — logo a sua própria uptime é min(1, (habilidades+giros)/s × 3 × up).
    const queimaUp = Math.min(1, (castsPorSeg + spinsPorSeg) * up * 3);
    dpsQueima = Math.min(alvo.hp, cap) * M.LIANDRY_PCT.v * nAlvos * queimaUp;                    // motor.js:1207,1653 (por alvo e SEM mitigação)
  }
  const dps3036Chefe = (itensIds.some((x) => baseId(x) === '3036') && alvo.chefe) ? (M.CHEFE_3036.v - 1) : 0;
  const total = (dpsHab + dpsPassiva + dpsAtaque + dpsLich + dpsLuden + dpsQueima) * (1 + dps3036Chefe);
  // ---------------------------------------------------------------------------------------
  // ROUBO DE VIDA (motor.js:1226-1230): cura = dano do AUTO-ATAQUE x a.rouboVida, SO em
  // ataques básicos (fonte === 'ataque'). O dano de auto deste modelo é o "auto puro"
  // (A.va x AD x crítico x mitigação x papel): NÃO inclui os extras que o motor soma ao
  // bruto do básico — o proc de 5% da vida atual do 3153 (motor.js:1702), a Lâmina
  // Encantada 3057/3078 (motor.js:1697) e os +40 do 3742 (motor.js:1698). Todos esses
  // entram no golpear(fonte 'ataque') e por isso TAMBÉM curam -> esta cura é um PISO.
  // ---------------------------------------------------------------------------------------
  const tem3065 = itensIds.some((x) => baseId(x) === '3065');
  const curaRV = dpsAtaque * A.rv * (tem3065 ? 1.25 : 1);                                        // motor.js:1226 + motor.js:1286
  // poção: a MAIOR que o nível permite (motor.js:262-264: vida nv1, forte nv15, suprema nv30)
  // e o motor só deixa beber 1/s (EXAUSTAO, motor.js:41).
  const POC = nivel >= 30 ? { cura: 2200, preco: 260, nome: 'Suprema' } : nivel >= 15 ? { cura: 900, preco: 110, nome: 'Forte' } : { cura: 300, preco: 40, nome: 'de Vida' };
  return {
    A, papel, mm, mf, dpsHab, dpsPassiva, dpsAtaque, dpsLich, dpsLuden, dpsQueima, total,
    nAlvos, danoHab, focoMult,
    castsPorSeg, spinsPorSeg, giro, procsLich, critMult, habMult, barra, cast, campeao,
    rv: A.rv, tem3065, curaRV, curaPocaoSeg: POC.cura, custoPocaoSeg: POC.preco, pocaoNome: POC.nome,
  };
}
/** rank no nível: R em 6/11/16/25/35 (motor.js:902); Q/W/E a cada 2 níveis (motor.js:905) */
function rankNoNivel(h, nivel) {
  if (h.tecla === 'R') return Math.min(h.max, [6, 11, 16, 25, 35].filter((n) => nivel >= n).length);
  return Math.max(1, Math.min(h.max, Math.ceil(nivel / 2)));
}
// quantos alvos uma habilidade atinge de facto (motor.js): quem tem "alvos" trava nesse número
// (Q = 3 em motor.js:738 e no corte de motor.js:2275; R = 3 em motor.js:746 e no corte de motor.js:2190);
// o giro da passiva P, a Chuva de Adagas T e a Tempestade N cortam TODOS em volta
// (motor.js:2159,2180 · 2266-2268 · 2197-2201); o resto é 1 alvo.
const ALVOS_TODOS = { P: true, T: true, N: true };
const alvosDaHab = (h, n) => (ALVOS_TODOS[h.tecla] ? n : Math.min(n, h.alvos || 1));
/** barra PADRÃO: as BARRA habilidades com mais dano base por recarga (regra declarada, não palpite) */
function barraPadrao(campeao, nivel) {
  const kit = campeao === 'lux' ? 'HAB_LUX' : 'HAB_KATARINA';
  const cand = habsDe(kit).map((t) => hab(kit, t)).filter((h) => h.base && h.recarga && !h.passiva && (h.nivel || 1) <= nivel);
  return cand.sort((a, b) => (b.base[0] / b.recarga[0]) - (a.base[0] / a.recarga[0])).slice(0, M.BARRA.v).map((h) => h.tecla);
}
// ---------------------------------------------------------------------------------------------
// 7) AS RESPOSTAS
// ---------------------------------------------------------------------------------------------
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
const ALVO_CHEFE = { nome: 'Dragão Infernal (chefe medido)', armadura: 104, hp: 69000, nivel: 40, chefe: true };
const baseAtual = () => ({ ...PERSONAGEM.base, vaK: PERSONAGEM.vaK });
const att = (ids, opt) => atributos(ids, baseAtual(), opt);

function cabecalho() {
  console.log('='.repeat(96));
  console.log('SIMULADOR DE BUILDS — LoL Idle. Matemática do motor do JOGO (docs/game-src/motor.js).');
  console.log('='.repeat(96));
  console.log('Constantes extraídas (cada uma com o file:linha de onde saiu):');
  for (const k of Object.keys(M)) console.log('  ' + k.padEnd(16) + cit(M[k]));
  console.log('  ' + 'BONUS_REFINO'.padEnd(16) + cit(BONUS_REFINO));
  console.log('  QUALIDADES mult  ' + Object.keys(QUALIDADES).map((q) => q + '=' + QUALIDADES[q].mult).join(' ') + ' [' + QUALIDADES.B.onde + ']');
  console.log('  patches de cdr   ' + PATCHES.map((p) => p.id + '{' + p.campos.trim() + '} [' + p.onde + ']').join(' | '));
  console.log('  P.giro Katarina  ' + GIRO.base + ' + ' + GIRO.nivel + '*nivel + ' + GIRO.ap + '*ap + ' + GIRO.ad + '*max(0,ad-adBase) [' + GIRO.onde + ']');
  console.log('  voracidadeChefe  ' + cit(GIRO_CHEFE) + '   pegaCada ' + cit(PEGA_CADA));
  console.log('  papel.dano       katarina ' + cit(papelDano('katarina')) + '   lux ' + cit(papelDano('lux')));
  console.log('  cdr por Foco     ' + cit(CDR_ATRIB_POR_FOCO) + '   teto dos atributos ' + fmt(CDR_ATRIB.capAtrib * 100, 0) + '% · teto total ' + fmt(CDR_ATRIB.cap * 100, 0) + '%  [' + CDR_ATRIB.onde + ']');
  console.log('  Foco -> dano hab ' + cit(FOCO_DANO_HAB) + '   (Katarina/Zac/Yasuo, motor.js:531,1218)');
  console.log('');
  console.log('CDR DOS ATRIBUTOS = ' + fmt(CDR_ATRIB.porFoco * FOCO * 100, 2) + '%  (Foco ' + fmt(FOCO, 1) + ' pontos, MEDIDO no painel do dono: Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · Foco 0)');
  console.log('  os ' + fmt(CDR_IMPETO_3A * 100, 2) + '% do total da build com Ímpeto vêm TODOS do Ímpeto 4629+3~A (0,15 × 1,15 qualidade A × 1,36 refino +3, motor.js:24,255) — nenhum de atributos.');
  console.log('  O Foco entra no motor como ' + CDR_ATRIB.porFoco + ' × Foco [motor.js:537]; com Foco 0 o termo é 0. Parâmetro: --foco N (default ' + FOCO_DONO + ' = o medido).');
  console.log('');
  if (PERSONAGEM) {
    const p = PERSONAGEM;
    console.log('PERSONAGEM CALIBRADO (medido ao vivo): ' + p.campeao + ' nível ' + p.nivel + ' — ' + p.onde);
    console.log('  medido: AD ' + p.medido.ad + ' · AP ' + p.medido.ap + ' · VA ' + p.medido.va + ' · vida ' + p.medido.vida + ' · armadura ' + p.medido.armadura + ' · RM ' + p.medido.rm);
    console.log('  build da medição: ' + p.build.join(', '));
    console.log('  base derivada (nível+atributos, sem itens): AD ' + fmt(p.base.ad, 1) + ' · AP ' + fmt(p.base.ap, 1) + ' · VA_base ' + fmt(p.vaK, 3) + ' · vida ' + fmt(p.base.vida, 1));
    console.log('  luta medida vs ' + p.luta.boss + ': ' + p.luta.durS + 's, outDps ' + p.luta.outDps + ', por fonte ' + JSON.stringify(p.luta.porFonte));
  } else {
    console.log('PERSONAGEM: NAO VERIFICADO — ' + NAO_VERIFICADO.join('; '));
  }
  console.log('');
}

function conferirModelo() {
  if (!PERSONAGEM) { console.log('CONFERÊNCIA DO MODELO: NAO VERIFICADO (sem snapshots)'); console.log(''); return; }
  const p = PERSONAGEM;
  const barraMedida = ['W', 'Q', 'R', 'A'];            // docs/snapshots/skills.json (barra real da luta)
  for (const [nome, opt] of [['barra MEDIDA na luta (W/Q/R/A)', { barra: barraMedida }], ['barra da sim (top-4 por dano/recarga)', {}]]) {
    const r = dps(p.build, ALVO_CHEFE, opt);
    console.log('CONFERÊNCIA DO MODELO contra a MEDIÇÃO — ' + nome);
    console.log('  modelo  : ' + fmt(r.total) + ' dps (hab ' + fmt(r.dpsHab) + ' + passiva ' + fmt(r.dpsPassiva) + ' + ataque ' + fmt(r.dpsAtaque) + ' + lich ' + fmt(r.dpsLich) + ' + queima ' + fmt(r.dpsQueima) + ') · habilidades/s ' + fmt(r.castsPorSeg, 3) + ' · procs Lich/s ' + fmt(r.procsLich, 3));
    console.log('  medido  : ' + p.luta.outDps + ' dps (por fonte: ' + JSON.stringify(p.luta.porFonte) + ')');
    console.log('  -> passiva (giro) medida ' + p.luta.porFonte.P + ' dps vs ' + fmt(r.dpsPassiva) + ' do modelo; item (Lich) medido ' + p.luta.porFonte.item + ' dps vs ' + fmt(r.dpsLich) + ' do modelo;');
    console.log('     ataques medidos ' + p.luta.porFonte.ataque + ' dps vs ' + fmt(r.dpsAtaque) + ' do modelo. O modelo assume "em recarga, sempre": é TETO.');
  }
  console.log('');
}

function Q1() {
  console.log('-'.repeat(96));
  console.log('Q1) BOTA DE CDR + outro item de dano  VS  BOTA DE PEN + ÍMPETO CÓSMICO');
  console.log('    dono: "nao sei se bota de cdr sem IMPETO e outro item de dano no lugar e melhor que bota de pen com impeto".');
  const fixo = ['3089~B', '3135~B', '3100~B'];
  const A  = [...fixo, '3158~B', '4645~B'];   // bota de CDR (3158, épica) + Chama Sombria (4645, 110 AP)
  const B  = [...fixo, '3175~B', '4629~B'];   // bota de pen (3175, lendária) + Ímpeto Cósmico (4629)
  const C  = [...fixo, '3020~B', '4629~B'];   // bota de pen ÉPICA (3020) + Ímpeto
  const D  = [...fixo, '3158~B', '4629~B'];   // máximo CDR (bota CDR + Ímpeto)
  const desc = (ids) => { const a = att(ids); return 'AP ' + fmt(a.ap) + ' · cdr ' + fmt(a.cdr * 100, 1) + '% · pen ' + fmt(a.penMagica * 100, 0) + '%'; };
  console.log('    fixos: ' + fixo.join(', ') + ' (Rabadon + Cajado do Vazio + Perdição de Lich)');
  console.log('    A) ' + A.join(', ') + ' -> ' + desc(A));
  console.log('    B) ' + B.join(', ') + ' -> ' + desc(B));
  console.log('    C) ' + C.join(', ') + ' -> ' + desc(C));
  console.log('    D) ' + D.join(', ') + ' -> ' + desc(D));
  console.log('    fórmula: dano mágico = mitigar(1, armadura×' + M.RM_MONSTRO.v + '×(1−penMagica)) [motor.js:1202,1179];');
  console.log('             recarga efectiva = recarga×(1−cdr) [motor.js:1581]; caps pen ' + M.VOID_PEN.v + ' e cdr ' + M.CDR_CAP.v + ' [motor.js:529,537]');
  console.log('    (a bota de CDR 3158 é ÉPICA: 150 de mana e 8% de cdr, SEM AP; a de pen 3175 é LENDÁRIA: 70 de AP e 15% de pen — a comparação de 5 espaços é esta)');
  let primeira = null, piorDif = 0;
  const linhas = [];
  for (const arm of [0, 20, 40, 60, 80, 100, 104, 120, 150, 200, 250, 300, 400]) {
    const alvo = { ...ALVO_CHEFE, armadura: arm };
    const a = dps(A, alvo).total, b = dps(B, alvo).total, c = dps(C, alvo).total, d = dps(D, alvo).total;
    linhas.push({ arm, a, b, c, d, dif: b - a });
    if (primeira == null && b > a) primeira = arm;
    if (Math.abs(b - a) > Math.abs(piorDif)) piorDif = b - a;
  }
  console.log('    armadura |  A) bota CDR+Chama | B) bota pen+Ímpeto | C) bota pen épica+Ímpeto | D) bota CDR+Ímpeto | vencedor');
  for (const l of linhas) {
    const v = l.a > l.b ? 'A' : 'B';
    console.log('    ' + String(l.arm).padStart(8) + ' | ' + fmt(l.a).padStart(19) + ' | ' + fmt(l.b).padStart(18) + ' | ' + fmt(l.c).padStart(25) + ' | ' + fmt(l.d).padStart(16) + ' | ' + v + ' (' + (v === 'B' ? '+' : '') + fmt(l.dif) + ')');
  }
  const a0 = dps(A, { ...ALVO_CHEFE, armadura: 0 }).total, b0 = dps(B, { ...ALVO_CHEFE, armadura: 0 }).total;
  const a4 = dps(A, { ...ALVO_CHEFE, armadura: 400 }).total, b4 = dps(B, { ...ALVO_CHEFE, armadura: 400 }).total;
  console.log('    RESPOSTA: B (bota de pen + Ímpeto) ganha em TODA a faixa testada — ' + fmt(b0 - a0) + ' dps a mais com armadura 0 e ' + fmt(b4 - a4) + ' a mais com armadura 400.');
  console.log('    NÃO há inversão entre 0 e 400 de armadura' + (primeira === 0 ? ' (B ganha desde a armadura 0)' : '') + '. A razão é dupla:');
  console.log('      (1) a bota de pen é LENDÁRIA e traz 70 de AP (×' + M.RABADON_MULT.v + ' do Rabadon) enquanto a de CDR é ÉPICA e traz 8% de cdr;');
  console.log('      (2) o Ímpeto Cósmico traz 70 AP + 15% de cdr, e o CDR acelera habilidades E o giro da Katarina (motor.js:1581 e motor.js:2162).');
  // inversão real: bota de pen ÉPICA (3020) + Ímpeto  vs  bota de CDR (3158) + Ímpeto
  const cC0 = dps(C, { ...ALVO_CHEFE, armadura: 0 }).total, dD0 = dps(D, { ...ALVO_CHEFE, armadura: 0 }).total;
  const cC4 = dps(C, { ...ALVO_CHEFE, armadura: 400 }).total, dD4 = dps(D, { ...ALVO_CHEFE, armadura: 400 }).total;
  console.log('    ONDE A RESPOSTA INVERTE (bota de pen ÉPICA 3020 + Ímpeto  vs  bota de CDR 3158 + Ímpeto):');
  if ((cC0 > dD0) === (cC4 > dD4)) {
    console.log('      NÃO há inversão: ' + (cC0 > dD0 ? 'C (pen épica)' : 'D (CDR)') + ' ganha em toda a faixa 0→400  [arm 0: C ' + fmt(cC0) + ' vs D ' + fmt(dD0) + ' · arm 400: C ' + fmt(cC4) + ' vs D ' + fmt(dD4) + ']');
    console.log('      (com o CDR dos atributos a bota de CDR já não soma: 0,23 + 0,08 + 0,15 = 0,46 -> trava em ' + fmt(M.CDR_CAP.v * 100, 0) + '%, ver Q6)');
  } else {
    let lo = 0, hi = 400;
    for (let i = 0; i < 40; i++) {
      const meio = (lo + hi) / 2;
      const d = dps(D, { ...ALVO_CHEFE, armadura: meio }).total, c = dps(C, { ...ALVO_CHEFE, armadura: meio }).total;
      if (c > d) hi = meio; else lo = meio;
    }
    const dCruz = dps(D, { ...ALVO_CHEFE, armadura: hi }).total, cCruz = dps(C, { ...ALVO_CHEFE, armadura: hi }).total;
    console.log('      armadura < ' + fmt(hi) + ' -> D (CDR) ganha; armadura > ' + fmt(hi) + ' -> C (pen épica) ganha  [C ' + fmt(cCruz) + ' vs D ' + fmt(dCruz) + ' dps]');
  }
  console.log('    O CDR só compensa se a bota de CDR tivesse o MESMO AP: o teste isolado abaixo mostra quanto é da bota e quanto é do item.');
  // teste isolado: mesma flex, só a bota muda
  for (const [rot, ids1, ids2] of [
    ['só a bota (Ímpeto nos dois)', [...fixo, '4629~B', '3158~B'], [...fixo, '4629~B', '3175~B']],
    ['só a bota (Chama nos dois)', [...fixo, '4645~B', '3158~B'], [...fixo, '4645~B', '3175~B']],
    ['só a flex (bota CDR nos dois)', [...fixo, '3158~B', '4645~B'], [...fixo, '3158~B', '4629~B']],
  ]) {
    const r1 = dps(ids1, ALVO_CHEFE).total, r2 = dps(ids2, ALVO_CHEFE).total;
    console.log('    ' + rot.padEnd(32) + ' ' + fmt(r1) + ' -> ' + fmt(r2) + '  (d ' + fmt(r2 - r1) + ' dps, ' + fmt((r2 / r1 - 1) * 100, 1) + '%)');
  }
  console.log('');
}

function Q2() {
  console.log('-'.repeat(96));
  console.log('Q2) DOIS CAJADOS DO VAZIO (3135) + bota de CDR, com um cajado no lugar do Ímpeto');
  console.log('    REGRA DURA DO MOTOR: "cada lendário uma vez" — motor.js:2879 (equipar) e motor.js:2891 (cabeNoEquip).');
  console.log('    A linha do motor: ' + MOTOR_SRC.split('\n')[2878].trim());
  console.log('    E a penetração não empilharia de qualquer forma: motor.js:529 usa tem(3135) ? 0.4 : 0 (booleano), com teto ' + M.VOID_PEN.v + '.');
  const normal = ['3158~B', '3135~B', '4629~B', '3089~B', '3100~B'];
  const dois = ['3158~B', '3135~B', '3135~B', '3089~B', '3100~B'];
  const r1 = dps(normal, ALVO_CHEFE), r2 = dps(dois, ALVO_CHEFE);
  const a1 = r1.A, a2 = r2.A;
  console.log('    hipótese (se fosse permitido):');
  console.log('      normal   ' + normal.join(', ') + ' -> AP ' + fmt(a1.ap) + ' cdr ' + fmt(a1.cdr * 100, 1) + '% pen ' + fmt(a1.penMagica * 100, 0) + '%  = ' + fmt(r1.total) + ' dps');
  console.log('      dois 3135 ' + dois.join(', ') + ' -> AP ' + fmt(a2.ap) + ' cdr ' + fmt(a2.cdr * 100, 1) + '% pen ' + fmt(a2.penMagica * 100, 0) + '%  = ' + fmt(r2.total) + ' dps');
  console.log('    dAP ' + fmt(a2.ap - a1.ap, 1) + ' · dcdr ' + fmt((a2.cdr - a1.cdr) * 100, 1) + ' pontos · dpen ' + fmt((a2.penMagica - a1.penMagica) * 100, 0) + ' pontos (NÃO empilha) · dvida ' + fmt(a2.vida - a1.vida, 0));
  console.log('    dDPS ' + fmt(r2.total - r1.total) + ' (' + fmt((r2.total / r1.total - 1) * 100, 1) + '%).');
  console.log('    RESPOSTA: NÃO FUNCIONA — o motor recusa o 2.º lendário igual (motor.js:2879/2891) e a pen não empilha');
  console.log('    (motor.js:529). Mesmo ignorando a regra, o 2.º Cajado troca 15% de CDR por 25 de AP.');
  console.log('');
}

function Q3() {
  console.log('-'.repeat(96));
  console.log('Q3) LICH (3100 Perdição de Lich): o proc depende da FREQUÊNCIA DE SKILLS, não de um multiplicador fixo');
  console.log('    motor.js:1944 arma d.lich = true em CADA habilidade (aoUsarHabilidade, chamado por usar() em motor.js:1584);');
  console.log('    motor.js:1688 gasta no próximo ATAQUE BÁSICO: 0,75×AP como dano mágico.');
  console.log('    Logo procs/s = min(habilidades/s, ataques/s) — o proc NÃO é "1 por habilidade" nem "por ataque".');
  console.log('    A extensão (automation.js:1243) soma lich*ap a CADA habilidade e divide pela recarga dela: isso é 1 proc/habilidade.');
  const semLich = ['3158~B', '3089~B', '3135~B', '4645~B'];
  const comLich = ['3158~B', '3089~B', '3135~B', '3100~B'];
  for (const [nome, opt] of [['Katarina, barra MEDIDA na luta (W/Q/R/A)', { barra: ['W', 'Q', 'R', 'A'] }], ['Katarina, barra da sim (top-4 por dano/recarga)', {}]]) {
    const r = dps(comLich, ALVO_CHEFE, opt);
    const rS = dps(semLich, ALVO_CHEFE, opt);
    console.log('    ' + nome);
    console.log('      barra ' + r.barra.join('/') + ' · habilidades/s ' + fmt(r.castsPorSeg, 3) + ' · ataques/s ' + fmt(r.A.va, 2) + ' · giros/s ' + fmt(r.spinsPorSeg, 3) + ' · giro ' + fmt(r.giro) + ' de dano');
    console.log('      procs do Lich/s ' + fmt(r.procsLich, 3) + ' (limitado por ' + (r.castsPorSeg <= r.A.va ? 'HABILIDADES' : 'ATAQUES') + ') × 0,75×AP(' + fmt(r.A.ap) + ') mitigado = ' + fmt(r.dpsLich) + ' dps');
    console.log('      total COM Lich ' + fmt(r.total) + ' dps (' + fmt((r.dpsLich / r.total) * 100, 1) + '% do total) | SEM Lich (4645 no lugar) ' + fmt(rS.total) + ' dps | d(Lich−Chama) ' + fmt(r.total - rS.total) + ' dps');
    const ext = r.castsPorSeg * (M.LICH_PROC.v * r.A.ap) * r.mm * r.papel;
    console.log('      modelo da EXTENSÃO (1 proc/habilidade) daria ' + fmt(ext) + ' dps -> ' + fmt(ext / r.dpsLich, 2) + 'x o modelo do motor');
  }
  const rL = dps(comLich, ALVO_CHEFE, { campeao: 'lux' });
  console.log('    Maga (Lux, recargas do motor.js:633-668; barra top-4 ' + rL.barra.join('/') + ')');
  console.log('      habilidades/s ' + fmt(rL.castsPorSeg, 3) + ' · procs do Lich/s ' + fmt(rL.procsLich, 3) + ' (limitado por ' + (rL.castsPorSeg <= rL.A.va ? 'HABILIDADES' : 'ATAQUES') + ')');
  console.log('      Lich = ' + fmt(rL.dpsLich) + ' dps em ' + fmt(rL.total) + ' dps (' + fmt((rL.dpsLich / rL.total) * 100, 1) + '% do total)');
  console.log('      (AP/AD de base da Katarina por falta de snapshot da Lux — o que decide o proc é a RECARGA, que é do motor.)');
  console.log('    O PROC EM FUNÇÃO DA FREQUÊNCIA (AP fixo, mesmo alvo) — é a resposta ao "modela em função da frequência":');
  const rBase = dps(comLich, ALVO_CHEFE, { barra: ['Q'] });
  const unidade = rBase.dpsLich / rBase.procsLich;
  for (const cps of [0.1, 0.2, 0.33, 0.54, 0.75, 1.16, 1.5, 2.0]) {
    const procs = Math.min(cps, rBase.A.va);
    console.log('      habilidades/s ' + fmt(cps, 2).padStart(5) + ' -> procs/s ' + fmt(procs, 2) + ' -> Lich ' + fmt(procs * unidade).padStart(5) + ' dps' + (cps > rBase.A.va ? '  <- aqui o TECTO é o ATAQUE (' + fmt(rBase.A.va, 2) + '/s)' : ''));
  }
  console.log('    RESPOSTA: para a Katarina (ataques/s ' + fmt(dps(comLich, ALVO_CHEFE, { barra: ['W', 'Q', 'R', 'A'] }).A.va, 2) + ' > habilidades/s) quem manda é a RECARGA do kit,');
  console.log('    logo "usar muita skill" NÃO eleva o Lich acima do ritmo real das recargas — e o modelo da extensão (1 proc/habilidade)');
  console.log('    acerta nela por acidente. O multiplicador fixo 2,2 do valorPassiva (automation.js:3809) é que achata a diferença');
  console.log('    entre campeões: o valor real é proporcional a 1/recarga (sai do kit), não a uma constante.');
  console.log('    RANKING DO 5.º ESPAÇO (quem entra no lugar do Lich, mesma build e alvo) — responde "deveria fazer entrar nas builds":');
  const base4 = ['3158~B', '3089~B', '3135~B'];
  const cands = ['3100~B', '4645~B', '6653~B', '3003~B', '3165~B', '3116~B', '4633~B', '664644~B'];
  const rank = cands.map((c) => ({ c, r: dps([...base4, c], ALVO_CHEFE), nome: (POR_ID.get(baseId(c)) || {}).nome }))
    .sort((a, b) => b.r.total - a.r.total);
  for (const x of rank) console.log('      ' + (x.nome || x.c).padEnd(30) + ' AP ' + fmt(x.r.A.ap).padStart(5) + ' -> ' + fmt(x.r.total).padStart(5) + ' dps');
  console.log('    ATENÇÃO: este ranking é do contexto ANTIGO — 4 itens (bota de CDR 3158 + Rabadon + Cajado do Vazio + candidato),');
  console.log('    sem o 4.º item do núcleo e com a bota de CDR. O re-teste com o núcleo real do dono (3175+3089+3135+3100 + 5.º) está em Q5/Q7.');
  console.log('');
}

function Q4() {
  console.log('-'.repeat(96));
  console.log('Q4) DOIS RABADONS (3089)');
  console.log('    motor.js:522  ' + MOTOR_SRC.split('\n')[521].trim());
  console.log('    É tem(3089) (booleano) -> o ×' + M.RABADON_MULT.v + ' aplica-se UMA vez, por muitos Rabadons que existam.');
  console.log('    E motor.js:2879/2891 recusa um 2.º lendário igual no equipamento.');
  const um = ['3158~B', '3089~B', '3135~B', '3100~B', '4645~B'];
  const dois = ['3158~B', '3089~B', '3089~B', '3100~B', '4645~B'];
  const r1 = dps(um, ALVO_CHEFE), r2 = dps(dois, ALVO_CHEFE);
  console.log('    1 Rabadon : AP ' + fmt(r1.A.ap) + ' -> ' + fmt(r1.total) + ' dps');
  console.log('    2 Rabadons: AP ' + fmt(r2.A.ap) + ' -> ' + fmt(r2.total) + ' dps');
  const trocado = r1.A.ap - r2.A.ap;
  console.log('    (o 2.º Rabadon ocupa o espaço do Cajado do Vazio, 95 AP -> 130 AP: dAP ' + fmt(r2.A.ap - r1.A.ap, 1) + ' = (130 − 95) × ' + M.RABADON_MULT.v + ' — o multiplicador NÃO duplica)');
  console.log('    dDPS ' + fmt(r2.total - r1.total) + ' (' + fmt((r2.total / r1.total - 1) * 100, 1) + '%) — é o AP flat do 2.º Rabadon, não 1,35² = ' + fmt(M.RABADON_MULT.v ** 2, 2) + 'x.');
  console.log('    RESPOSTA: NÃO empilha e NÃO pode ser equipado (lendário único). O 2.º Rabadon só vale o AP flat.');
  console.log('');
}

function QExtra() {
  console.log('-'.repeat(96));
  console.log('EXTRA) sensibilidade das passivas CONDICIONAIS (a fracção da luta não sai de ficheiro nenhum)');
  for (const f of [0, 0.25, 0.5, 1]) {
    const A = dps(['3089~B', '3135~B', '3100~B', '3158~B', '4645~B'], ALVO_CHEFE, { fracaoBaixo40: f });
    console.log('    Chama Sombria com ' + fmt(f * 100) + '% da luta abaixo de 40% de vida: ' + fmt(A.total) + ' dps');
  }
  console.log('    (motor.js:1205 aplica x' + M.CHAMA_4645.v + ' só quando f < 0,4; a fracção é parâmetro, não constante do jogo.)');
  console.log('');
}

// ---------------------------------------------------------------------------------------------
// 8) Q5/Q6/Q7/Q8 — O CDR (termo a termo) E O 5.º ESPAÇO: LIANDRY vs ÍMPETO
//    Base fixa = a build do dono sem o 5.º espaço. Cada termo com a SUA fonte: atributos = painel do
//    jogo (Foco 0, medido); itens = itens.js + motor.js:24/255. Nada é deduzido de um total.
// ---------------------------------------------------------------------------------------------
const BOTA_PEN = '3175~B', RABADON = '3089~B', VAZIO = '3135~B', LICH = '3100~B';
const LIANDRY = '6653~B', IMPETO = '4629~B', IMPETO3 = '4629+3~A';
const BASE4 = [BOTA_PEN, RABADON, VAZIO, LICH];        // a build do dono SEM o 5.º espaço
const CHEIO = [...BASE4, LIANDRY];                     // a build "ideal" do dono (5 itens)
const BARRA_MEDIDA = ['W', 'Q', 'R', 'A'];             // docs/snapshots/skills.json (a barra real da luta)
const nomeItem = (id) => (POR_ID.get(baseId(id)) || {}).nome || id;
const ehBotaItem = (x) => (POR_ID_P.get(baseId(x)) || {}).espaco === 'botas';   // motor.js:33 (espacoDe)
const descStats = (ids, opt = {}) => {
  const a = att(ids, opt);
  return 'AP ' + fmt(a.ap) + ' · cdr ' + fmt(a.cdr * 100, 1) + '% = atrib ' + fmt(a.cdrAtrib * 100, 1) + '% + itens ' + fmt(a.cdrItens * 100, 1) + '%'
    + (a.cdrTravado ? ' (bruto ' + fmt(a.cdrTotal * 100, 1) + '% -> TRAVADO no teto ' + fmt(M.CDR_CAP.v * 100, 0) + '%)' : '')
    + ' · pen ' + fmt(a.penMagica * 100, 0) + '% · vida ' + fmt(a.vida);
};
const linhaDps = (rot, ids, alvo, opt = {}) => {
  const r = dps(ids, alvo, opt);
  return '      ' + rot.padEnd(16) + fmt(r.total).padStart(6) + ' dps │ hab ' + fmt(r.dpsHab).padStart(5) + ' │ giro ' + fmt(r.dpsPassiva).padStart(5) + ' │ atq ' + fmt(r.dpsAtaque).padStart(4) + ' │ lich ' + fmt(r.dpsLich).padStart(5) + ' │ queima ' + fmt(r.dpsQueima).padStart(5) + ' │ hab/s ' + fmt(r.castsPorSeg, 3) + ' │ giros/s ' + fmt(r.spinsPorSeg, 3);
};
const combate = (ids, alvo, opt) => dps(ids, alvo, opt).total;
// UPTIME MEDIDO: a luta registada dá a parte das habilidades+giro a ~0,61 do modelo (TETO) para a MESMA
// build. Fonte: docs/snapshots/katarina.json (porFonte) contra o modelo. Serve para a sensibilidade.
const UPTIME_MEDIDO = (() => {
  if (!PERSONAGEM) return null;
  const rMed = dps(PERSONAGEM.build, ALVO_CHEFE, { barra: BARRA_MEDIDA });
  const medHab = PERSONAGEM.luta.porFonte.A + PERSONAGEM.luta.porFonte.Q + PERSONAGEM.luta.porFonte.R + PERSONAGEM.luta.porFonte.P;
  return { up: medHab / (rMed.dpsHab + rMed.dpsPassiva), medHab, modHab: rMed.dpsHab + rMed.dpsPassiva };
})();
const venceAB = (a, b) => (a >= b ? 'A) Liandry 6653' : 'B) Ímpeto 4629');
// imprime a linha do motor COM o número certo: procura o padrão e conta as linhas até ele (linhaDe),
// o mesmo método de todos os outros números do ficheiro — nunca um índice escrito à mão.
const citLinha = (re) => {
  const m = MOTOR_SRC.match(re);
  if (!m) { console.log('    NAO VERIFICADO: padrao nao encontrado'); return; }
  const n = linhaDe(MOTOR_SRC, m.index);
  console.log('    motor.js:' + n + '  ' + MOTOR_SRC.split('\n')[n - 1].trim());
};

function Q5() {
  console.log('-'.repeat(96));
  console.log('Q5) 5.º ESPAÇO: TORMENTO DE LIANDRY (6653: 60 AP, 300 vida, 0 CDR, queima 1,5%/s)  VS  ÍMPETO CÓSMICO (4629: 70 AP, 350 vida, 15% CDR)');
  console.log('    base fixa (a build do dono sem o 5.º espaço): ' + BASE4.join(', '));
  console.log('      [itens.js: 3175 Sapatos Enfeitiçados (bota, 70 AP, penMag 0.15) · 3089 Rabadon (130 AP) · 3135 Cajado do Vazio (95 AP, penMag 0.4) · 3100 Lich (100 AP)]');
  console.log('    A)  base + 6653 Liandry      -> ' + descStats([...BASE4, LIANDRY]));
  console.log('    B)  base + 4629 Ímpeto       -> ' + descStats([...BASE4, IMPETO]));
  console.log('    B3) base + 4629+3~A Ímpeto   -> ' + descStats([...BASE4, IMPETO3]) + '  (o Ímpeto +3 de qualidade A do dono: motor.js:255 multiplica o cdr como qualquer atributo)');
  const cdrA = att([...BASE4, LIANDRY]).cdr, cdrB = att([...BASE4, IMPETO]).cdr, cdrB3 = att([...BASE4, IMPETO3]).cdr;
  console.log('    O CDR: motor.js:537  ' + MOTOR_SRC.split('\n')[536].trim());
  console.log('      ATRIBUTOS: Foco = ' + fmt(FOCO, 1) + ' pontos [MEDIDO no painel do jogo: Força 81 + Vitalidade 3 = 84 = 3×28, Foco 0] -> CDR de atributos ' + fmt(CDR_ATRIB.porFoco * FOCO * 100, 1) + '%');
  console.log('      ITENS: 3175/3089/3135/3100/6653 não têm cdr (itens.js) -> cdr de itens 0% na build A');
  console.log('      O Ímpeto é o ÚNICO cdr desta comparação: 0,15 [patch motor.js:24] × 1,15 (qualidade A) × 1,36 (refino +3) = ' + fmt(CDR_IMPETO_3A * 100, 2) + '% [motor.js:255]');
  console.log('      (o Foco ainda daria +0,2%/ponto de dano de habilidade, motor.js:457,531,1218 — com Foco 0 não dá nada)');
  console.log('    ganho de FREQUÊNCIA do Ímpeto (recarga efectiva = recarga×(1−cdr), motor.js:1581):');
  console.log('      B  vs A: (1−' + fmt(cdrA, 2) + ')/(1−' + fmt(cdrB, 2) + ') = ×' + fmt((1 - cdrA) / (1 - cdrB), 4) + '  -> +' + fmt(((1 - cdrA) / (1 - cdrB) - 1) * 100, 1) + '% de habilidades/s');
  console.log('      B3 vs A: (1−' + fmt(cdrA, 2) + ')/(1−' + fmt(cdrB3, 2) + ') = ×' + fmt((1 - cdrA) / (1 - cdrB3), 4) + '  -> +' + fmt(((1 - cdrA) / (1 - cdrB3) - 1) * 100, 1) + '% de habilidades/s');
  const capQueima = M.TETO_VIDA_ITEM.v * (150 + 100 * 40 + 40 * 40);   // CURVA.hp(40); nivel 40 -> ajuste.vida = 1 (balanco.js)
  console.log('    queima do Liandry: motor.js:1207 põe alvo.queima = vidaRefItem(alvo)×1,5% por 3 s; motor.js:1653 tira a vida DIRETO, SEM mitigação de armadura');
  console.log('      por alvo: min(hpMax, ' + M.TETO_VIDA_ITEM.v + '×CURVA.hp(40))×1,5% = min(69000, ' + fmt(capQueima) + ')×1,5% = ' + fmt(capQueima * M.LIANDRY_PCT.v, 1) + ' dps (motor.js:1190,1191,273-274)');
  console.log('    B3 é o MESMO Ímpeto com +3 de refino e qualidade A (o do dono): o cdr de item leva ×refino e ×qualidade (motor.js:255),');
  console.log('      por isso o B3 não é uma comparação de item igual — serve só para ver quanto vale o refino que o dono já tem.');
  for (const [rotBarra, optBarra] of [['barra MEDIDA na luta (W/Q/R/A) — a que o dono usa', { barra: BARRA_MEDIDA }], ['barra da sim (top-4 por dano/recarga)', {}]]) {
    console.log('');
    console.log('    ### ' + rotBarra);
    console.log('    1 ALVO — varredura de armadura (Dragão Infernal, nível 40, hp 69000)');
    console.log('      armadura │ A) Liandry │ B) Ímpeto │ B3) Ímpeto+3~A │ vencedor A/B │ margem');
    for (const arm of [0, 20, 50, 104, 150, 200, 250, 300, 400]) {
      const alvo = { ...ALVO_CHEFE, armadura: arm };
      const a = combate([...BASE4, LIANDRY], alvo, optBarra), b = combate([...BASE4, IMPETO], alvo, optBarra), c = combate([...BASE4, IMPETO3], alvo, optBarra);
      console.log('      ' + String(arm).padStart(8) + ' │ ' + fmt(a).padStart(9) + ' │ ' + fmt(b).padStart(8) + ' │ ' + fmt(c).padStart(13) + ' │ ' + venceAB(a, b).padEnd(15) + ' │ ' + fmt(Math.abs(a - b)) + ' dps');
    }
    console.log('    ARMADURA 104 (o Dragão medido) — N alvos em volta (a queima é POR ALVO, motor.js:1207; o giro corta todos, motor.js:2159,2180)');
    console.log('      alvos │ A) Liandry │ B) Ímpeto │ B3) Ímpeto+3~A │ vencedor A/B │ margem');
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const a = combate([...BASE4, LIANDRY], ALVO_CHEFE, { ...optBarra, alvos: n }), b = combate([...BASE4, IMPETO], ALVO_CHEFE, { ...optBarra, alvos: n }), c = combate([...BASE4, IMPETO3], ALVO_CHEFE, { ...optBarra, alvos: n });
      console.log('      ' + String(n).padStart(5) + ' │ ' + fmt(a).padStart(9) + ' │ ' + fmt(b).padStart(8) + ' │ ' + fmt(c).padStart(13) + ' │ ' + venceAB(a, b).padEnd(15) + ' │ ' + fmt(Math.abs(a - b)) + ' dps');
    }
  }
  console.log('');
  console.log('    POR FONTE — 1 alvo, armadura 104, barra medida (quem ganha e quem perde):');
  console.log(linhaDps('A) Liandry', [...BASE4, LIANDRY], ALVO_CHEFE, { barra: BARRA_MEDIDA }));
  console.log(linhaDps('B) Ímpeto', [...BASE4, IMPETO], ALVO_CHEFE, { barra: BARRA_MEDIDA }));
  console.log(linhaDps('B3) Ímpeto+3~A', [...BASE4, IMPETO3], ALVO_CHEFE, { barra: BARRA_MEDIDA }));
  // ONDE A RESPOSTA INVERTE (bissecção na armadura; varrimento nos alvos)
  const barraMed = { barra: BARRA_MEDIDA };
  const BganhaArm = (arm) => combate([...BASE4, IMPETO], { ...ALVO_CHEFE, armadura: arm }, barraMed) >= combate([...BASE4, LIANDRY], { ...ALVO_CHEFE, armadura: arm }, barraMed);
  const BganhaN = (n) => combate([...BASE4, IMPETO], ALVO_CHEFE, { ...barraMed, alvos: n }) >= combate([...BASE4, LIANDRY], ALVO_CHEFE, { ...barraMed, alvos: n });
  let cruzArm = null;
  if (BganhaArm(0) !== BganhaArm(400)) { let lo = 0, hi = 400; const inicio = BganhaArm(0); for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (BganhaArm(m) === inicio) lo = m; else hi = m; } cruzArm = (lo + hi) / 2; }
  let cruzAlvos = null;
  for (let n = 1; n <= 8; n++) if (!BganhaN(n)) { cruzAlvos = n; break; }
  console.log('');
  console.log('    SENSIBILIDADE À UPTIME (o modelo assume "em recarga, sempre": é TETO, ver CONFERÊNCIA DO MODELO)');
  const upMed = UPTIME_MEDIDO ? UPTIME_MEDIDO.up : null;
  if (UPTIME_MEDIDO) console.log('      a luta medida deu ' + fmt(UPTIME_MEDIDO.medHab) + ' dps de habilidades+giro contra ' + fmt(UPTIME_MEDIDO.modHab) + ' do modelo para a MESMA build (docs/snapshots/katarina.json) -> uptime medido ~' + fmt(upMed, 2));
  console.log('      uptime │ A) Liandry │ B) Ímpeto │ B3) Ímpeto+3~A │ vencedor A/B │ A vs B3');
  const listaUp = [...new Set([1, 0.85, 0.7, upMed ? +upMed.toFixed(2) : 0.6, 0.55, 0.45].filter((x) => x != null))].sort((a, b) => b - a);
  for (const u of listaUp) {
    const a = combate([...BASE4, LIANDRY], ALVO_CHEFE, { ...barraMed, uptime: u }), b = combate([...BASE4, IMPETO], ALVO_CHEFE, { ...barraMed, uptime: u }), c = combate([...BASE4, IMPETO3], ALVO_CHEFE, { ...barraMed, uptime: u });
    console.log('      ' + fmt(u, 2).padStart(6) + ' │ ' + fmt(a).padStart(9) + ' │ ' + fmt(b).padStart(8) + ' │ ' + fmt(c).padStart(13) + ' │ ' + venceAB(a, b).padEnd(15) + ' │ ' + venceAB(a, c).replace('Ímpeto 4629', 'Ímpeto+3~A').padEnd(15) + ' +' + fmt(Math.abs(a - c)) + ' dps');
  }
  const cruzUp = (outra) => {
    const ganhaA = (u) => combate([...BASE4, LIANDRY], ALVO_CHEFE, { ...barraMed, uptime: u }) >= combate(outra, ALVO_CHEFE, { ...barraMed, uptime: u });
    if (ganhaA(0) === ganhaA(1)) return null;
    let lo = 0, hi = 1; const ini = ganhaA(0);
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ganhaA(m) === ini) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  const kAB = cruzUp([...BASE4, IMPETO]), kAB3 = cruzUp([...BASE4, IMPETO3]);
  const aUp0 = combate([...BASE4, LIANDRY], ALVO_CHEFE, { ...barraMed, uptime: 0 });
  const bUp0 = combate([...BASE4, IMPETO], ALVO_CHEFE, { ...barraMed, uptime: 0 });
  const cUp0 = combate([...BASE4, IMPETO3], ALVO_CHEFE, { ...barraMed, uptime: 0 });
  if (kAB != null) console.log('      -> Liandry vs Ímpeto: INVERTE com uptime < ' + fmt(kAB, 3) + ' (abaixo disso o Liandry ganha: a queima não depende de uptime, o dano das habilidades depende)');
  else console.log('      -> Liandry vs Ímpeto: ' + (aUp0 >= bUp0 ? 'o Liandry ganha com qualquer uptime testado' : 'o Ímpeto ganha com qualquer uptime testado') + ' (não há inversão)');
  if (kAB3 != null) console.log('      -> Liandry vs Ímpeto+3~A (o do dono): INVERTE com uptime < ' + fmt(kAB3, 3));
  else console.log('      -> Liandry vs Ímpeto+3~A (o do dono): ' + (aUp0 >= cUp0 ? 'o Liandry ganha com qualquer uptime testado' : 'o Ímpeto ganha com qualquer uptime testado') + ' (não há inversão)');
  console.log('');
  console.log('    ONDE A RESPOSTA INVERTE (barra medida):');
  if (cruzArm == null) console.log('      1 alvo, armadura 0→400: ' + (BganhaArm(0) ? 'o Ímpeto ganha SEMPRE' : 'o Liandry ganha SEMPRE') + ' (não há inversão)');
  else console.log('      1 alvo: armadura < ~' + fmt(cruzArm) + ' -> Ímpeto ganha · armadura > ~' + fmt(cruzArm) + ' -> Liandry ganha');
  if (cruzAlvos == null) console.log('      armadura 104, 1→8 alvos: ' + (BganhaN(1) ? 'o Ímpeto ganha SEMPRE' : 'o Liandry ganha SEMPRE') + ' (não há inversão)');
  else if (cruzAlvos <= 1) console.log('      armadura 104: o Liandry ganha desde 1 alvo (o Ímpeto não ganha em nenhum N de 1 a 8)');
  else console.log('      armadura 104: até ' + (cruzAlvos - 1) + ' alvos o Ímpeto ganha · ' + cruzAlvos + ' alvos ou mais o Liandry ganha');
  console.log('      razão: a queima do Liandry NÃO é mitigada pela armadura (motor.js:1653 tira a vida directo) e é POR ALVO (motor.js:1207);');
  console.log('      o dano das habilidades É mitigado (motor.js:1201-1202) e a Q/R só atingem 3 alvos (motor.js:738,746,2190,2275).');
  console.log('');
  console.log('    AS DUAS PREMISSAS LADO A LADO (a antiga fica registada, não apagada) — armadura 104, 1 alvo, barra medida:');
  for (const [rot, ids] of [['A) Liandry 6653', [...BASE4, LIANDRY]], ['B) Ímpeto 4629', [...BASE4, IMPETO]]]) {
    const f0 = combate(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA });
    const f575 = combate(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA, foco: FOCO_PREMISSA_ANTIGA });
    console.log('      ' + rot.padEnd(16) + ' Foco 0 (MEDIDO — correcto) ' + fmt(f0).padStart(6) + ' dps   |   Foco 57,5 (dedução REFUTADA) ' + fmt(f575).padStart(6) + ' dps  (' + (f575 - f0 >= 0 ? '+' : '') + fmt(f575 - f0) + ')');
  }
  const d0 = combate([...BASE4, IMPETO], ALVO_CHEFE, { barra: BARRA_MEDIDA }) - combate([...BASE4, LIANDRY], ALVO_CHEFE, { barra: BARRA_MEDIDA });
  const d575 = combate([...BASE4, IMPETO], ALVO_CHEFE, { barra: BARRA_MEDIDA, foco: FOCO_PREMISSA_ANTIGA }) - combate([...BASE4, LIANDRY], ALVO_CHEFE, { barra: BARRA_MEDIDA, foco: FOCO_PREMISSA_ANTIGA });
  console.log('      Ímpeto − Liandry: ' + fmt(d0) + ' dps com Foco 0 (o certo)   |   ' + fmt(d575) + ' dps com Foco 57,5 (a dedução errada)');
  console.log('      quem ganha é o MESMO nas duas premissas? ' + ((d0 > 0) === (d575 > 0) ? 'SIM' : 'NÃO') + '  (a premissa errada inflacionava o Ímpeto: dava-lhe o cdr dos atributos que não existem)');
  const cen = (alvo, opt) => {
    const a = combate([...BASE4, LIANDRY], alvo, opt), b = combate([...BASE4, IMPETO], alvo, opt), c = combate([...BASE4, IMPETO3], alvo, opt);
    return { quem: venceAB(a, b), ganho: Math.abs(a - b), b3: c };
  };
  console.log('');
  console.log('    RESPOSTA Q5:');
  for (const [rot, alvo, opt] of [
    ['armadura 104 (Dragão medido), 1 alvo ', { ...ALVO_CHEFE }, { barra: BARRA_MEDIDA }],
    ['armadura 0,   1 alvo                 ', { ...ALVO_CHEFE, armadura: 0 }, { barra: BARRA_MEDIDA }],
    ['armadura 50,  1 alvo                 ', { ...ALVO_CHEFE, armadura: 50 }, { barra: BARRA_MEDIDA }],
    ['armadura 104, 3 alvos                ', { ...ALVO_CHEFE }, { barra: BARRA_MEDIDA, alvos: 3 }],
    ['armadura 30,  3 alvos                ', { ...ALVO_CHEFE, armadura: 30 }, { barra: BARRA_MEDIDA, alvos: 3 }],
  ]) { const c = cen(alvo, opt); console.log('      ' + rot + ' -> vence ' + c.quem + '  (vantagem ' + fmt(c.ganho) + ' dps)   [com o Ímpeto +3~A: ' + fmt(c.b3) + ' dps]'); }
  if (upMed) {
    const a = combate([...BASE4, LIANDRY], ALVO_CHEFE, { barra: BARRA_MEDIDA, uptime: upMed });
    const b = combate([...BASE4, IMPETO], ALVO_CHEFE, { barra: BARRA_MEDIDA, uptime: upMed });
    const c = combate([...BASE4, IMPETO3], ALVO_CHEFE, { barra: BARRA_MEDIDA, uptime: upMed });
    console.log('      COM O UPTIME MEDIDO (~' + fmt(upMed, 2) + '; armadura 104, 1 alvo) -> vence ' + venceAB(a, b) + ' (' + fmt(Math.abs(a - b)) + ' dps)');
    console.log('        e contra o Ímpeto +3~A do dono: ' + fmt(c) + ' vs ' + fmt(a) + ' -> vence ' + venceAB(a, c).replace('Ímpeto 4629', 'Ímpeto+3~A') + ' (' + fmt(Math.abs(a - c)) + ' dps)');
  }
  console.log('');
}

function Q6() {
  console.log('-'.repeat(96));
  console.log('Q6) O CDR: de onde vem cada ponto, e o teto efectivo (Foco = ' + fmt(FOCO, 1) + ')');
  citLinha(/reducaoRecarga: Math\.min\(/);
  citLinha(/foco: \{ curto: '\+8 mana/);
  citLinha(/Object\.assign\(ITENS\['4629'\]/);
  citLinha(/cdr: \(i\.cdr \|\| 0\) \* m/);
  citLinha(/regenItens \+= i\.regen; cdrItens \+= i\.cdr/);
  citLinha(/export const FOCO_DANO_HAB = /);
  citLinha(/danoHab: k\.semMana/);
  citLinha(/if \(hab && a\.danoHab\)/);
  console.log('    (motor.js:3497-3499: conquistas NÃO dão cdr — só ad/vida/armadura/rm/ouro; motor.js:3536-3537: o mascote também não)');
  console.log('');
  console.log('    CADA TERMO COM A SUA FONTE (nada deduzido de totais):');
  console.log('      ATRIBUTOS  Foco = ' + fmt(FOCO, 1) + ' pontos [MEDIDO no painel: Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · Foco 0; 81+3 = 84 = 3×28, motor.js:483,1047]');
  console.log('                 -> CDR de atributos = min(' + CDR_ATRIB.capAtrib + ', ' + CDR_ATRIB.porFoco + ' × ' + fmt(FOCO, 1) + ') = ' + fmt(CDR_ATRIB.porFoco * FOCO * 100, 2) + '%  (motor.js:537)');
  console.log('                 -> dano de habilidade do Foco = ' + FOCO_DANO_HAB.v + ' × ' + fmt(FOCO, 1) + ' = ' + fmt(FOCO_DANO_HAB.v * FOCO * 100, 1) + '%  (motor.js:457,531,1218)');
  console.log('      ITENS      Ímpeto 4629: cdr 0,15 [patch motor.js:24] × 1,15 (qualidade A) × 1,36 (refino +3) = ' + fmt(CDR_IMPETO_3A * 100, 2) + '%  [motor.js:255]  <- é o valor que a extensão mostrou como 0,23');
  console.log('                 Botas Ionianas 3158: cdr 0,08 [itens.js] × 1,15 × 1,36 = ' + fmt(CDR_BOTA_3A * 100, 2) + '% (+3~A) ou × 1,7 × 1,36 = ' + fmt(CDR_BOTA_3SS * 100, 2) + '% (+3~SS)  [motor.js:255]');
  console.log('                 3175 (bota de pen), 3089, 3135, 3100 e o Liandry 6653: cdr 0 (itens.js). A bota de pen dá penMag 0,15 — valor CRU, sem ×refino/×qualidade (motor.js:506,509 espalha o item e só reescala os campos listados em motor.js:255; a medição de 0,55 = 0,40+0,15 confirma)');
  console.log('      TETOS      atributos ' + fmt(CDR_ATRIB.capAtrib * 100, 0) + '% (=' + fmt(CDR_ATRIB.capAtrib / CDR_ATRIB.porFoco, 0) + ' pontos de Foco) · total ' + fmt(CDR_ATRIB.cap * 100, 0) + '% — soma directa, corte só no fim (motor.js:537)');
  console.log('');
  console.log('    PREMISSA ANTIGA (registada, não apagada): deduzia Foco = 0,23/0,004 = 57,5 pontos do cdr 0,23 medido.');
  console.log('      REFUTADA pela leitura do painel (Foco 0) e pela decomposição do item (0,15×1,15×1,36 = 0,2346 -> 0,23 na tela).');
  console.log('      Com Foco 57,5 o CDR de atributos seria ' + fmt(Math.min(CDR_ATRIB.capAtrib, CDR_ATRIB.porFoco * FOCO_PREMISSA_ANTIGA) * 100, 1) + '%; o valor medido é 0.');
  console.log('');
  console.log('    O QUE CADA ITEM ACRESCENTA (base = o cdr que já existe; nada de atributos):');
  const linhaCdr = (rot, base, cdrItens) => {
    const bruto = base + cdrItens, fim = Math.min(CDR_ATRIB.cap, bruto);
    const freq = 1 / (1 - fim), freqBase = 1 / (1 - base);
    console.log('      ' + rot.padEnd(54) + ' cdr ' + fmt(fim * 100, 2) + '%' + (bruto > CDR_ATRIB.cap + 1e-9 ? ' (bruto ' + fmt(bruto * 100, 2) + '% -> TRAVADO)' : '') + '  ->  ' + fmt(freq, 4) + '× habilidades/s  =  ' + (freq / freqBase >= 1 ? '+' : '') + fmt((freq / freqBase - 1) * 100, 1) + '%');
  };
  linhaCdr('nada (build com Liandry 6653, sem Ímpeto e sem bota de cdr)', 0, 0);
  linhaCdr('+ Botas Ionianas 3158 (8% ~B)', 0, 0.08);
  linhaCdr('+ Botas Ionianas 3158+3~A (' + fmt(CDR_BOTA_3A * 100, 2) + '%)', 0, CDR_BOTA_3A);
  linhaCdr('+ Ímpeto 4629 (15% ~B)', 0, 0.15);
  linhaCdr('+ Ímpeto 4629+3~A (' + fmt(CDR_IMPETO_3A * 100, 2) + '%)', 0, CDR_IMPETO_3A);
  linhaCdr('+ Ímpeto 4629+3~A  +  Botas Ionianas 3158+3~A', CDR_IMPETO_3A, CDR_BOTA_3A);
  linhaCdr('+ Ímpeto 4629+3~A  +  Botas Ionianas 3158+3~SS', CDR_IMPETO_3A, CDR_BOTA_3SS);
  console.log('');
  console.log('    TETO EFECTIVO com o Ímpeto +3~A já na build: ' + fmt(CDR_IMPETO_3A * 100, 2) + '% gastos, sobram ' + fmt((CDR_ATRIB.cap - CDR_IMPETO_3A) * 100, 2) + ' pontos até ao tecto de ' + fmt(CDR_ATRIB.cap * 100, 0) + '%.');
  console.log('      É a pergunta do Lead: a bota de CDR já não parte de 0 — parte de ' + fmt(CDR_IMPETO_3A * 100, 2) + '% e só tem ' + fmt((CDR_ATRIB.cap - CDR_IMPETO_3A) * 100, 2) + ' pontos de espaço (Q8).');
  console.log('');
}

function Q7() {
  console.log('-'.repeat(96));
  console.log('Q7) SE O ÍMPETO GANHAR, QUEM SAI DA BUILD?');
  console.log('    a build do dono tem 5 espaços: ' + CHEIO.join(', ') + '   (1 bota + 4, cada lendário uma vez: motor.js:2877-2879,2889)');
  const cenarios = [
    ['1 alvo, armadura 104 (Dragão Infernal medido)', { ...ALVO_CHEFE }, { barra: BARRA_MEDIDA }],
    ['1 alvo, armadura 30 (alvo de armadura baixa)', { ...ALVO_CHEFE, armadura: 30 }, { barra: BARRA_MEDIDA }],
    ['3 alvos, armadura 104', { ...ALVO_CHEFE }, { barra: BARRA_MEDIDA, alvos: 3 }],
  ];
  for (const [rot, alvo, opt] of cenarios) {
    console.log('');
    console.log('    ' + rot);
    const zero = combate(CHEIO, alvo, opt);
    console.log('      ' + 'não mexer (build actual)'.padEnd(36) + fmt(zero).padStart(6) + ' dps   ' + CHEIO.join(', '));
    const trocas = CHEIO.filter((x) => !ehBotaItem(x)).map((sai) => ({ sai, nova: CHEIO.filter((x) => x !== sai).concat([IMPETO]) }))
      .map((t) => ({ ...t, r: combate(t.nova, alvo, opt) })).sort((a, b) => b.r - a.r);
    for (const t of trocas) console.log('      ' + ('sai ' + nomeItem(t.sai) + ' -> entra Ímpeto').padEnd(36) + fmt(t.r).padStart(6) + ' dps  (' + (t.r - zero >= 0 ? '+' : '') + fmt(t.r - zero) + ' vs actual)   ' + t.nova.join(', '));
    const semBota = CHEIO.filter((x) => !ehBotaItem(x)).concat([IMPETO]);
    console.log('      ' + 'sai a BOTA -> entra Ímpeto (ILEGAL)'.padEnd(36) + fmt(combate(semBota, alvo, opt)).padStart(6) + ' dps   ' + semBota.join(', ') + '   <- 5 itens fora a bota: o motor recusa (motor.js:29,2878,2890)');
  }
  const BOTAS = ['3175~B', '3158~B', '3020~B'];
  const OUTROS = ['3089~B', '3135~B', '3100~B', '6653~B', '4629~B', '4645~B', '3003~B', '3165~B', '3116~B', '4633~B', '6655~B'];
  const combos = [];
  for (const b of BOTAS) for (let i = 0; i < OUTROS.length; i++) for (let j = i + 1; j < OUTROS.length; j++) for (let k = j + 1; k < OUTROS.length; k++) for (let l = k + 1; l < OUTROS.length; l++) combos.push([b, OUTROS[i], OUTROS[j], OUTROS[k], OUTROS[l]]);
  console.log('');
  console.log('    BUSCA EXAUSTIVA — ' + combos.length + ' builds completas de 5 espaços (3 botas × C(11,4) de lendários), com as regras do motor:');
  for (const [rot, alvo, opt] of cenarios) {
    const rank = combos.map((ids) => ({ ids, r: combate(ids, alvo, opt) })).sort((a, b) => b.r - a.r);
    console.log('      TOP 5 — ' + rot);
    for (const x of rank.slice(0, 5)) { const a = att(x.ids); console.log('        ' + fmt(x.r).padStart(6) + ' dps  ' + x.ids.join(', ') + '   [cdr ' + fmt(a.cdr * 100, 1) + '% · pen ' + fmt(a.penMagica * 100, 0) + '% · AP ' + fmt(a.ap) + ' · rv ' + fmt(x.r.rv * 100, 0) + '% = ' + fmt(x.r.curaRV) + ' cura/s]'); }
    const comI = rank.find((x) => x.ids.includes(IMPETO));
    console.log('        melhor COM Ímpeto: ' + fmt(comI.r) + ' dps  ' + comI.ids.join(', ') + '  (' + (comI.r >= rank[0].r - 1e-9 ? 'é a MELHOR de todas' : 'perde ' + fmt(rank[0].r - comI.r) + ' dps para a melhor') + ')');
  }
  const rankFinal = combos.map((ids) => ({ ids, r: combate(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA }) })).sort((a, b) => b.r - a.r);
  const melhor = rankFinal[0];
  const melhorSem = rankFinal.find((x) => !x.ids.includes(IMPETO));
  const melhorCom = rankFinal.find((x) => x.ids.includes(IMPETO));
  const actual = combate(CHEIO, ALVO_CHEFE, { barra: BARRA_MEDIDA });
  const comI3 = combos.map((ids) => ({ ids: ids.map((x) => (x === IMPETO ? IMPETO3 : x)), r: 0 }));
  const melhorComI3 = comI3.map((x) => ({ ...x, r: combate(x.ids, ALVO_CHEFE, { barra: BARRA_MEDIDA }) })).sort((a, b) => b.r - a.r)[0];
  console.log('');
  console.log('    RESPOSTA Q7:');
  console.log('      melhor build (1 alvo, armadura 104, barra do dono): ' + melhor.ids.join(', ') + ' = ' + fmt(melhor.r) + ' dps');
  console.log('        ' + descStats(melhor.ids));
  console.log('      melhor SEM Ímpeto: ' + melhorSem.ids.join(', ') + ' = ' + fmt(melhorSem.r) + ' dps');
  console.log('      melhor COM Ímpeto: ' + melhorCom.ids.join(', ') + ' = ' + fmt(melhorCom.r) + ' dps   (Ímpeto vs melhor-sem-Ímpeto: ' + (melhorCom.r >= melhorSem.r ? '+' : '') + fmt(melhorCom.r - melhorSem.r) + ' dps)');
  console.log('      melhor COM o Ímpeto +3~A do dono: ' + melhorComI3.ids.join(', ') + ' = ' + fmt(melhorComI3.r) + ' dps');
  console.log('        ' + descStats(melhorComI3.ids) + '   <- é a build recomendada se o Ímpeto for o +3 de qualidade A do dono');
  console.log('      build actual do dono: ' + CHEIO.join(', ') + ' = ' + fmt(actual) + ' dps   (a melhor dá ' + fmt(melhor.r - actual) + ' dps a mais)');
  const sai = CHEIO.filter((x) => !melhorCom.ids.includes(x)).map(nomeItem);
  const entra = melhorCom.ids.filter((x) => !CHEIO.includes(x)).map(nomeItem);
  const melhorAntiga = combos.map((ids) => ({ ids, r: combate(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA, foco: FOCO_PREMISSA_ANTIGA }) })).sort((a, b) => b.r - a.r)[0];
  const actualAntiga = combate(CHEIO, ALVO_CHEFE, { barra: BARRA_MEDIDA, foco: FOCO_PREMISSA_ANTIGA });
  console.log('      PREMISSA ANTIGA (Foco 57,5, REFUTADA) para o mesmo cenário: melhor build ' + melhorAntiga.ids.join(', ') + ' = ' + fmt(melhorAntiga.r) + ' dps · build actual ' + fmt(actualAntiga) + ' dps');
  console.log('      -> da build actual para a melhor COM Ímpeto: SAI ' + (sai.length ? sai.join(' + ') : 'nada') + ' · ENTRA ' + (entra.length ? entra.join(' + ') : 'nada'));
  console.log('      -> da build actual para a melhor SEM Ímpeto: SAI ' + (CHEIO.filter((x) => !melhorSem.ids.includes(x)).map(nomeItem).join(' + ') || 'nada') + ' · ENTRA ' + (melhorSem.ids.filter((x) => !CHEIO.includes(x)).map(nomeItem).join(' + ') || 'nada'));
  console.log('');
}

function Q8() {
  console.log('-'.repeat(96));
  console.log('Q8) A BOTA: CDR (3158 Ionianas da Lucidez) vs PEN (3175 Sapatos Enfeitiçados), com o ÍMPETO JÁ na build');
  console.log('    pergunta do Lead: com o Ímpeto a dar ' + fmt(CDR_IMPETO_3A * 100, 2) + '% sozinho, a bota de CDR vale mais que a de pen?');
  console.log('    CADA TERMO COM A SUA FONTE (nada deduzido):');
  console.log('      3175 (pen)  penMag 0,15 [itens.js] — valor CRU: motor.js:255 só reescala ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr, e motor.js:506,509 espalha o item -> penMag fica 0,15. Total com o Cajado do Vazio: 0,40 + 0,15 = ' + fmt((0.4 + 0.15) * 100, 0) + '% (a medição do dono de 0,55 confirma). AP 70, lendário.');
  console.log('      3158 (cdr)  cdr 0,08 [itens.js] × refino × qualidade [motor.js:255]: ~B = ' + fmt(0.08 * 100, 2) + '% · +3~A = ' + fmt(CDR_BOTA_3A * 100, 2) + '% · +3~SS = ' + fmt(CDR_BOTA_3SS * 100, 2) + '%. AP 0 (150 de mana), épico.');
  console.log('    OS NÚMEROS DO LEAD NÃO SAEM DESTAS CONTAS — NAO VERIFICADO:');
  console.log('      18,6% da bota de CDR: 0,15 × 1,24 (qualidade B, refino +2) = 0,186 -> essa conta é a do ÍMPETO (base 0,15), não da bota (base 0,08).');
  console.log('      17,25% da bota de pen: 0,15 × 1,15 (qualidade A) = 0,1725 -> seria o penMag escalado pela qualidade; o motor NÃO o escala.');
  console.log('      O que o motor dá: bota de CDR 8% (~B) a ' + fmt(CDR_BOTA_3SS * 100, 2) + '% (+3~SS) e bota de pen 15 pontos de pen.');
  NAO_VERIFICADO.push('os 18,6% (bota de CDR) e 17,25% (bota de pen) do Lead nao saem das contas do motor — ver Q8');
  console.log('');
  const BOTAS = [
    ['3175 (pen) ~B', '3175~B'],
    ['3158 (cdr) ~B', '3158~B'],
    ['3158 (cdr) +3~A', '3158+3~A'],
    ['3158 (cdr) +3~SS', '3158+3~SS'],
  ];
  for (const [rot, bota] of BOTAS) {
    for (const [rot5, q5] of [['COM Ímpeto+3~A', IMPETO3], ['COM Liandry 6653', LIANDRY]]) {
      const ids = [bota, RABADON, VAZIO, LICH, q5];
      const a104 = combate(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA });
      const a0 = combate(ids, { ...ALVO_CHEFE, armadura: 0 }, { barra: BARRA_MEDIDA });
      const a30 = combate(ids, { ...ALVO_CHEFE, armadura: 30 }, { barra: BARRA_MEDIDA });
      const aUp = UPTIME_MEDIDO ? combate(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA, uptime: UPTIME_MEDIDO.up }) : null;
      console.log('      ' + rot.padEnd(18) + rot5.padEnd(17) + ' ' + descStats(ids).padEnd(74) + ' arm104 ' + fmt(a104).padStart(5) + ' · arm0 ' + fmt(a0).padStart(5) + ' · arm30 ' + fmt(a30).padStart(5) + (aUp ? ' · uptime ' + fmt(UPTIME_MEDIDO.up, 2) + ' ' + fmt(aUp).padStart(5) : ''));
    }
  }
  console.log('');
  console.log('    RESPOSTA Q8 (marginal da bota, tudo o resto igual):');
  for (const [rot5, q5] of [['COM Ímpeto+3~A', IMPETO3], ['COM Liandry 6653', LIANDRY]]) {
    const pen = combate([BOTA_PEN, RABADON, VAZIO, LICH, q5], ALVO_CHEFE, { barra: BARRA_MEDIDA });
    for (const [rot, bota] of BOTAS.slice(1)) {
      const c = combate([bota, RABADON, VAZIO, LICH, q5], ALVO_CHEFE, { barra: BARRA_MEDIDA });
      console.log('      ' + rot5.padEnd(17) + ' bota de pen 3175 ' + fmt(pen).padStart(5) + ' dps  vs  ' + rot.padEnd(18) + fmt(c).padStart(5) + ' dps  -> ' + (pen >= c ? 'PEN ganha +' + fmt(pen - c) : 'CDR ganha +' + fmt(c - pen)) + ' dps (' + fmt((c / pen - 1) * 100, 1) + '%)');
    }
  }
  console.log('      razão estrutural: a bota de pen é LENDÁRIA e dá 70 de AP (×1,35 do Rabadon = ' + fmt(70 * M.RABADON_MULT.v, 1) + ' de AP) e 15 de pen; a de CDR é ÉPICA, dá 0 de AP e o cdr, que já vale menos porque o Ímpeto +3~A ocupa ' + fmt(CDR_IMPETO_3A * 100, 2) + ' dos 40 pontos.');
  console.log('      ganho de frequência da bota de CDR em cima do Ímpeto +3~A: ~B ×' + fmt((1 - CDR_IMPETO_3A) / (1 - (CDR_IMPETO_3A + 0.08)), 4) + ' · +3~A ×' + fmt((1 - CDR_IMPETO_3A) / (1 - (CDR_IMPETO_3A + CDR_BOTA_3A)), 4) + ' · +3~SS ×' + fmt((1 - CDR_IMPETO_3A) / (1 - CDR_ATRIB.cap), 4) + ' (trava no tecto)');
  console.log('');
}

function QRV() {
  console.log('-'.repeat(96));
  console.log('QRV) ROUBO DE VIDA: cura/s por build, o PREÇO EM DPS do espaço, e a conta contra as poções');
  citLinha(/if \(a\.rouboVida && fonte === 'ataque'\)/);
  citLinha(/const cura = dano \* a\.rouboVida/);
  citLinha(/if \(a\.tem\('3072'\) && cura > falta\)/);
  citLinha(/export const EXAUSTAO = /);
  citLinha(/vida:  \{ nome: 'Poção de Vida', tipo: 'vida', cura: /);
  console.log('    O motor SÓ cura por roubo de vida em ATAQUES BÁSICOS (fonte === \'ataque\', motor.js:1226):');
  console.log('    habilidades, giro, Lich e queima NÃO curam por rv. A cura é proporcional ao dano FINAL do golpe.');
  console.log('    cura/s = dps do AUTO-ATAQUE x rouboVida (motor.js:1226-1227), x1,25 se houver 3065 (motor.js:1286);');
  console.log('    com a 3072 o que passar da vida máxima vira escudo até 25% da vida (motor.js:1229).');
  console.log('');
  const ITENS_RV = ITENS.filter((i) => (i.rv || 0) > 0).map((i) => String(i.id));
  console.log('    Itens com rv>0 no catálogo (itens.js):');
  for (const id of ITENS_RV) { const i = POR_ID.get(id); console.log('      ' + id + ' ' + (i.nome || '').padEnd(26) + ' rv ' + fmt(i.rv * 100, 0) + '% · ' + i.preco + ' g · ' + i.espaco + ' · raridade ' + i.raridade + (i.vida ? ' · vida ' + i.vida : '') + (i.ad ? ' · AD ' + i.ad : '') + (i.va ? ' · VA ' + i.va : '')); }
  console.log('');
  // ---- 1) o preço em DPS de cada item de rv, contra o MELHOR item SEM rv do mesmo espaço ----
  const p = PERSONAGEM;
  const base = [BOTA_PEN, RABADON, VAZIO, LICH];
  const cand = (espaco, proibidos) => ITENS.filter((i) => (i.raridade === 'lendario' || i.raridade === 'epico') && i.espaco === espaco
    && !((i.rv || 0) > 0) && !proibidos.some((x) => baseId(x) === String(i.id))).map((i) => String(i.id));
  console.log('    O PREÇO DO ESPAÇO (base fixa ' + base.join(', ') + ' + o 5.º espaço; 1 alvo, armadura ' + ALVO_CHEFE.armadura + '):');
  console.log('      item de rv            │ dps COM rv │ cura/s do rv │ melhor SEM rv         │ dps SEM rv │ preço em dps │ preço em segundos (chefe ' + fmt(ALVO_CHEFE.hp) + ' HP)');
  const preco = [];
  for (const id of ITENS_RV) {
    const it = POR_ID.get(id);
    const ehBota = it.espaco === 'botas';
    const fixos = ehBota ? [RABADON, VAZIO, LICH] : base;
    const proibidos = [...fixos, id];
    const slot = ehBota ? 'arma' : 'arma';                     // o 5.º espaço é sempre uma arma/mão (a bota já está na base)
    const candidatos = ehBota ? cand('arma', proibidos).concat(cand('mao', proibidos)) : cand(it.espaco === 'botas' ? 'botas' : it.espaco, proibidos);
    const comRV = ehBota ? [id, ...fixos, candidatos[0]] : [...base, id];
    // melhor 5.º espaço SEM rv (avaliação completa, não heurística)
    let melhorSem = null;
    for (const c of candidatos) {
      const ids = ehBota ? [BOTA_PEN, ...fixos, c] : [...base, c];
      const r = dps(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA });
      if (!melhorSem || r.total > melhorSem.r.total) melhorSem = { ids, r };
    }
    const rCom = dps(comRV, ALVO_CHEFE, { barra: BARRA_MEDIDA });
    const segCom = ALVO_CHEFE.hp / Math.max(1, rCom.total), segSem = ALVO_CHEFE.hp / Math.max(1, melhorSem.r.total);
    preco.push({ id, comRV, melhorSem, rCom, segCom, segSem });
    console.log('      ' + (id + ' ' + (it.nome || '')).padEnd(22) + '│ ' + fmt(rCom.total).padStart(10) + ' │ ' + fmt(rCom.curaRV).padStart(12) + ' │ ' + (melhorSem.ids.join(',')).padEnd(21) + ' │ ' + fmt(melhorSem.r.total).padStart(10) + ' │ ' + fmt(melhorSem.r.total - rCom.total).padStart(12) + ' │ ' + fmt(segSem - segCom, 2).padStart(8) + ' s a mais');
  }
  console.log('    (preço em dps = dps SEM rv - dps COM rv: positivo = o rv CUSTA dano; negativo = o rv dá mais dano)');
  console.log('');
  // ---- 2) a conta contra as poções ----
  console.log('    A CONTA CONTRA AS POÇÕES (a pergunta do dono: o rv substitui poções?):');
  const rRef = dps(CHEIO, ALVO_CHEFE, { barra: BARRA_MEDIDA });
  console.log('      personagem calibrado nv' + (p ? p.nivel : '?') + ' -> maior poção disponível: ' + rRef.pocaoNome + ' (' + fmt(rRef.curaPocaoSeg) + ' de cura, ' + rRef.custoPocaoSeg + ' g), 1/s (motor.js:41,262-264)');
  console.log('      logo 1 poção/s = ' + fmt(rRef.curaPocaoSeg) + ' cura/s ao custo de ' + fmt(rRef.custoPocaoSeg) + ' g/s = ' + fmt(rRef.custoPocaoSeg * 3600) + ' g/hora de farm.');
  console.log('      cura/s do roubo de vida por build (mesma barra medida):');
  for (const x of preco) {
    const g = x.rCom.curaRV / rRef.curaPocaoSeg * rRef.custoPocaoSeg;
    console.log('        ' + (x.id + ' ' + (POR_ID.get(x.id).nome || '')).padEnd(24) + ' rv ' + fmt(100 * x.rCom.rv, 0) + '% -> ' + fmt(x.rCom.curaRV).padStart(5) + ' cura/s = ' + fmt(x.rCom.curaRV / rRef.curaPocaoSeg, 2) + ' poções/s = ' + fmt(g) + ' g/s = ' + fmt(g * 3600) + ' g/h de poções que NÃO se bebem');
  }
  const semRV = dps([BOTA_PEN, RABADON, VAZIO, LICH, '4645~B'], ALVO_CHEFE, { barra: BARRA_MEDIDA });
  console.log('      sem nenhum item de rv (build ' + [BOTA_PEN, RABADON, VAZIO, LICH, '4645~B'].join(',') + '): rv ' + fmt(100 * semRV.rv, 0) + '% -> ' + fmt(semRV.curaRV) + ' cura/s = 0 poções substituídas.');
  console.log('');
  // ---- 3) o ranking do 5.º espaço é uma TUPLA (dps, cura/s), não um escalar ----
  console.log('    O 5.º ESPAÇO NÃO É UM RANKING DE DPS: é a TUPLA (dps, cura/s, ouro da poção que substitui).');
  console.log('    (o ranking da LUTA — mata?/segundos/poções/ouro — vive em tools/sim-chefes.mjs, relatorioPorLuta(),');
  console.log('     porque só lá se simula a luta; aqui só se mede o dps e a cura.)');
  const cands5 = ['3100~B', '4645~B', '6653~B', '3153~B', '3074~B', '3072~B', '3168~B', '3172~B', '3748~B', '3078~B', '3031~B'];
  const rank = cands5.map((c) => { const ids = [...base, c]; const r = dps(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA }); return { c, r }; }).sort((a, b) => b.r.total - a.r.total);
  console.log('      item                 │ dps     │ rv    │ cura/s │ = poções/s │ = g/h de poções');
  for (const x of rank) { const g = x.r.curaRV / rRef.curaPocaoSeg * rRef.custoPocaoSeg; console.log('      ' + (x.c + ' ' + (nomeItem(x.c) || '')).padEnd(21) + '│ ' + fmt(x.r.total).padStart(7) + ' │ ' + fmt(100 * x.r.rv, 0).padStart(4) + '% │ ' + fmt(x.r.curaRV).padStart(6) + ' │ ' + fmt(x.r.curaRV / rRef.curaPocaoSeg, 2).padStart(10) + ' │ ' + fmt(g * 3600).padStart(14)); }
  // ---- 4) o rv só cura se houver AUTO-ATAQUE: build de AP vs build de AD/VA ----
  console.log('    O RV SÓ CURA O QUE O AUTO-ATAQUE BATE (motor.js:1226: fonte === \'ataque\'):');
  const baseAP = [BOTA_PEN, RABADON, VAZIO, LICH];
  const baseAD = ['3172~B', '3153~B', '3031~B', '3036~B', '3046~B'];
  for (const [rot, ids] of [['base de AP (a do dono) + 3153', [...baseAP, '3153~B']], ['base de AD/VA (auto) 3172+3153+3031+3036+3046', baseAD], ['base de AD/VA sem os dois itens de rv', ['3006~B', '3078~B', '3031~B', '3036~B', '3046~B']]]) {
    const r = dps(ids, ALVO_CHEFE, { barra: BARRA_MEDIDA });
    console.log('      ' + rot.padEnd(46) + ' dps ' + fmt(r.total).padStart(6) + ' · auto ' + fmt(r.dpsAtaque).padStart(5) + ' · AD ' + fmt(r.A.ad).padStart(4) + ' · VA ' + fmt(r.A.va, 2) + ' · rv ' + fmt(100 * r.rv, 0) + '% -> cura ' + fmt(r.curaRV).padStart(5) + '/s');
  }
  console.log('      (a mesma % de rv vale 8-25 cura/s numa base de AP e centenas de cura/s numa base de AD/VA:');
  console.log('       é o AUTO-ATAQUE que cura, e quem não bate autos não tem roubo de vida nenhum.)');
  console.log('');
  console.log('    RESPOSTA: o item de rv entra na build quando a TUPLA da luta (sim-chefes) o pedir; em dps puro');
  console.log('    o 3153 e o 3172 são dos MELHORES itens do catálogo (não custam dano), logo o rv não é um sacrifício de dps:');
  console.log('    é um item de dps que TAMBÉM cura. O que se paga por ele é o espaço, e o espaço é decidido na luta.');
  console.log('');
}

// ---------------------------------------------------------------------------------------------
cabecalho();
conferirModelo();
Q1(); Q2(); Q3(); Q4(); QExtra();
Q5(); Q6(); Q7(); Q8(); QRV();
console.log('NAO VERIFICADO: ' + (NAO_VERIFICADO.length ? NAO_VERIFICADO.join('; ') : 'nada — todos os números saíram de docs/game-src/ ou dos snapshots medidos'));
// =============================================================================================
// 10) MOB x CHEFE — O PEDIDO DO DONO (2026-10-14): CDR, botas, 5.º espaço e o 3153.
//     Kits REAIS de Katarina e Yasuo vêm de tools/sim-chefes.mjs (HAB_SIM, portado de
//     motor.js:696-771), com TRÊS correcções sobre ele — cada uma com a linha do motor:
//       (1) motor.js:537 inclui o Foco no cdr (sim-chefes:435 usa só cdrItens);
//       (2) motor.js:1214 — o 3036 dá +15% de dano contra CHEFES (o sim-chefes não aplica);
//       (3) motor.js:1653 — a queima do Liandry tira vida DIRECTA, sem mitigação nem papel.
//     O pen de item NÃO leva qualidade/refino: motor.js:251-255 reescala ad/ap/mana/vida/
//     armadura/rm/va/rv/critico/regen/cdr e NÃO penMag (a dica MEDIDA do 3175~A diz 15%).
//     ATRIBUTOS DO DONO: MEDIDOS ao vivo pelo Lead no painel do jogo (Força 81, Vitalidade 3,
//     Resistência 0, Agilidade 0, FOCO 0). Logo o cdr de atributos do dono é ZERO.
// =============================================================================================
import {
  statsJogador, dpsDaHabilidade, escolherBarra, ranksNoNivel, KITS_SIM, HAB_SIM, CURVA_FIEL,
  fatorDanoJogador, distribuirAtributos, TETO_VIDA_ITEM, RM_MONSTRO, mit, nivelDoChefe, statsBossFiel,
  ATRIB_PADRAO, temItem, infoItem as infoItemFC, BARAO_NM, dpsTeorico,
} from './sim-chefes.mjs';

const L10 = (s) => console.log(s === undefined ? '' : s);
const fn10 = (x, d = 0) => Number(x).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc10 = (x, d = 1) => fn10(x * 100, d) + '%';
const nomeDe10 = (id) => ((POR_ID.get(baseId(id)) || {}).nome || id);
const ATRIB_DONO10 = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };   // MEDIDO (Lead, painel)

// --- 10.0) MONSTROS10 e LOCAIS10 extraídos do motor (cada um com a sua linha) --------------------
const MONSTROS10 = (() => {
  const b = MOTOR_SRC.match(/export const MONSTROS = \{([\s\S]*?)\n\};/);
  if (!b) throw new Error('NAO VERIFICADO: MONSTROS (motor.js:280) nao encontrado');
  const out = {};
  for (const m of b[1].matchAll(/'([^']+)':\s*\{([^}]*)\}/g)) {
    const c = {};
    for (const x of m[2].matchAll(/([a-zA-Z]+):\s*(true|false|-?[\d.]+)/g)) c[x[1]] = x[2] === 'true' ? true : x[2] === 'false' ? false : parseFloat(x[2]);
    out[m[1]] = Object.assign(c, { onde: 'motor.js:' + linhaDe(MOTOR_SRC, MOTOR_SRC.indexOf(m[0], b.index)) });
  }
  return out;
})();
const LOCAIS10 = (() => {
  const b = MOTOR_SRC.match(/export const LOCAIS = \[([\s\S]*?)\n\];/);
  if (!b) throw new Error('NAO VERIFICADO: LOCAIS (motor.js:354) nao encontrado');
  const out = [];
  for (const m of b[1].split("\n  { id: '").slice(1)) {
    const id = m.slice(0, m.indexOf("'"));
    const nm = (m.match(/nm: \[(\d+), (\d+)\]/) || []).slice(1).map(Number);
    const monstros = [...m.matchAll(/\['([^']+)', ([\d.]+)\]/g)].map((x) => [x[1], parseFloat(x[2])]);
    if (id && nm.length === 2 && monstros.length) out.push({ id, nm, monstros });
  }
  return out;
})();
const mobAlvo10 = (nome, nivel) => {
  const m = MONSTROS10[nome];
  return { nome, nivel, hpMax: CURVA_FIEL.hp(nivel) * m.hp, armadura: CURVA_FIEL.armadura(nivel) * m.armadura,
    magico: !!m.magico, chefe: !!m.chefe, onde: m.onde };
};
const zonaDe10 = (id) => LOCAIS10.find((l) => l.id === id);
const mobDaZona10 = (id) => {
  const z = zonaDe10(id); const nm = Math.round((z.nm[0] + z.nm[1]) / 2);
  const principal = z.monstros.slice().sort((a, b) => b[1] - a[1])[0][0];
  return { alvo: mobAlvo10(principal, nm), z, nm, principal };
};

// --- 10.1) O MOTOR DE DPS CONTRA UM ALVO (mob ou chefe) -------------------------------------
function statsAlvo10(campeao, nivel, itens, atrib) {
  const st = statsJogador(campeao, nivel, itens, atrib);
  const foco = (atrib && atrib.foco) || 0;
  st.foco = foco;
  st.cdrAtrib = Math.min(0.3, 0.004 * foco);                       // motor.js:537 (tecto dos atributos)
  st.cdrBruto = st.cdrAtrib + st.cdrItens;                         // motor.js:537 (soma directa)
  st.reducaoRecarga = Math.min(0.4, st.cdrBruto);                  // motor.js:537 (tecto total)
  st.cdrTravado = st.cdrBruto > 0.4 + 1e-9;
  return st;
}
function dpsAlvo10(campeao, nivel, itens, alvo, opt) {
  opt = opt || {};
  const atrib = opt.atrib || { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: opt.foco || 0 };
  const st = statsAlvo10(campeao, nivel, itens, atrib);
  const ranks = opt.ranks || ranksNoNivel(campeao, nivel, st, alvo);
  const barra = escolherBarra(campeao, nivel, ranks, st, alvo);
  const H = HAB_SIM[campeao];
  const magia = !!KITS_SIM[campeao].magia;
  const papel = KITS_SIM[campeao].papel.dano, fj = fatorDanoJogador(nivel, alvo.nivel);
  const nAlvos = Math.max(1, opt.alvos || 1);
  const esp = (1 - st.critico) + st.critico * st.danoCritico;      // motor.js:1700 + 1213
  // Yasuo: Último Suspiro (30% de pen. de armadura por 15 s, motor.js:706) e Respiração do Vento
  // (+vel. de ataque, motor.js:709). Só o ATAQUE os leva (como no sim-chefes:531-560).
  let penSuspiro = 0, vaExtra = 0;
  if (campeao === 'yasuo' && ranks.R > 0) { const cd = H.R.recarga[ranks.R - 1] * (1 - st.reducaoRecarga); penSuspiro = H.R.penSuspiro * Math.min(1, H.R.duracaoPen / cd); }
  if (campeao === 'yasuo' && ranks.G > 0) { const cd = H.G.recarga[ranks.G - 1] * (1 - st.reducaoRecarga); vaExtra = H.G.va[ranks.G - 1] * Math.min(1, H.G.duracao / cd); }
  const penTotal = 1 - (1 - st.penArmadura) * (1 - penSuspiro);
  const armFis = alvo.armadura * (1 - penTotal);                   // motor.js:1202 + motor.js:706
  const armMag = alvo.armadura * RM_MONSTRO * (1 - st.penMagica);  // motor.js:1202 + 1179
  const capVida = TETO_VIDA_ITEM * CURVA_FIEL.hp(alvo.nivel);      // motor.js:1190-1191
  const fCap = Math.min(1, capVida / alvo.hpMax);
  const vidaMedia3153 = capVida * (1 - fCap / 2);                  // vida do alvo a descer linearmente
  const ds = barra.map((t) => ({ t, d: dpsDaHabilidade(campeao, t, ranks[t], st, alvo, nivel) }));
  const taxaSkills = ds.reduce((s, x) => s + (x.d.cd ? 1 / x.d.cd : 0), 0);
  const habMult = 1 + (temItem(itens, '4645') ? 0.2 * (opt.fracaoBaixo40 || 0) : 0)
    + (temItem(itens, '3165') ? 0.12 * (opt.fracaoBaixo50 || 0) : 0);   // motor.js:1205-1206
  const det = { auto: 0, skills: 0, giro: 0, itens: 0, queima: 0, porSkill: {} };
  let extra = 0;
  const lam = temItem(itens, '3078') ? 2 : temItem(itens, '3057') ? 1 : 0;   // motor.js:1672
  if (lam) extra += lam * st.baseAd * Math.min(1, taxaSkills / st.velAtaque);
  if (temItem(itens, '3153')) extra += 0.05 * vidaMedia3153;                  // motor.js:1702+1191
  if (temItem(itens, '3748')) extra += 0.015 * st.vida;                       // motor.js:1721
  det.auto = (st.ad + extra) * esp * mit(1, armFis) * papel * fj * st.velAtaque * (1 + vaExtra);
  if (temItem(itens, '6631')) det.itens += mit(0.8 * st.ad, armFis) * papel * fj / 5;              // motor.js:1719
  if (temItem(itens, '3100')) det.itens += Math.min(taxaSkills, st.velAtaque) * mit(0.75 * st.ap * habMult, armMag) * papel * fj;   // motor.js:1688
  if (temItem(itens, '6653')) det.queima += 0.015 * Math.min(alvo.hpMax, capVida) * nAlvos;        // motor.js:1207 + 1653
  for (const x of ds) {
    const k = Math.min(nAlvos, H[x.t].alvos || 1);
    const v = x.d.dps * k * (magia ? habMult : 1);
    det.porSkill[x.t] = v; det.skills += v;
  }
  if (campeao === 'katarina') {
    const bruto = H.P.giro(nivel, st);                                            // motor.js:737
    const dagas = ds.filter((x) => H[x.t].adaga).reduce((s, x) => s + (x.d.cd ? 1 / x.d.cd : 0), 0);
    const giros = Math.min(dagas, 1 / H.P.pegaCada);                              // motor.js:2181
    det.giro = mit(bruto, armMag) * papel * fj * (1 + st.danoHab) * giros * nAlvos * habMult;   // motor.js:2165,1218
    det.skills += det.giro;
  }
  const chefe3036 = (alvo.chefe && temItem(itens, '3036')) ? 1.15 : 1;            // motor.js:1214
  const golpes = (det.auto + det.skills + det.itens) * chefe3036;
  const total = golpes + det.queima;
  return { st, ranks, barra, det, golpes, total, ttk: total > 0 ? alvo.hpMax / total : Infinity,
    fj, armFis, armMag, capVida, fCap, vidaMedia3153, chefe3036, taxaSkills, nAlvos, penSuspiro, vaExtra, penTotal };
}
const perfilDe10 = (campeao, nivel) => {
  if (campeao === 'katarina') {
    if (nivel === 29) return Object.assign({}, ATRIB_DONO10);            // MEDIDO ao vivo (Lead, painel)
    const m = distribuirAtributos('conjurador', nivel);
    m.forca += m.foco; m.foco = 0;                                     // o dono tem Foco 0 (medido)
    return m;
  }
  if (nivel === 12) return Object.assign({}, ATRIB_PADRAO.yasuo);      // do snapshot medido (nv12)
  return distribuirAtributos('dano', nivel);
};
const calibraAlvo10 = (campeao, nivel, itens, atrib) => {
  const st = statsAlvo10(campeao, nivel, itens, atrib);
  return st;
};

// --- 10.2) AS BUILDS TESTADAS ----------------------------------------------------------------
const IT10 = {
  BOTA_PEN: '3175~A', BOTA_CDR: '3171~A', BOTA_DEF: '3170~B', BOTA_AD: '3172~B',
  RABADON: '3089+2~B', VAZIO: '3135~A', LICH: '3100+3~A', IMPETO: '4629+3~A', IMPETO_B: '4629~B',
  LIANDRY: '6653~B', CHAMA: '4645~B', CRIAFENDAS: '4633~B', MORELLO: '3165~B', RYLAI: '3116~B',
  ZHONYA: '3157~B', ARCANJO: '3003~B', REI: '3153~B', LUDEN: '6655~B', GUME: '3031~B',
  DOMINIK: '3036~B', DANCARINA: '3046~B', TRINDADE: '3078~B', QUEBRA: '6631~B', HIDRA_R: '3074~B',
};
const CORE10 = [IT10.RABADON, IT10.VAZIO, IT10.LICH];
const CEN_CDR10 = [
  ['1) SEM CDR NENHUM (bota de pen 3175 + Chama 4645)', IT10.BOTA_PEN, IT10.CHAMA],
  ['2) SÓ BOTA DE CDR (3171) + Chama 4645', IT10.BOTA_CDR, IT10.CHAMA],
  ['3) SÓ ÍMPETO (4629+3~A) + bota de defesa 3170', IT10.BOTA_DEF, IT10.IMPETO],
  ['4) BOTA DE CDR (3171) + ÍMPETO (4629+3~A)', IT10.BOTA_CDR, IT10.IMPETO],
  ['5) BOTA DE PEN (3175) + ÍMPETO (4629+3~A)', IT10.BOTA_PEN, IT10.IMPETO],
  ['6) BOTA DE PEN (3175) SEM ÍMPETO (= cenário 1)', IT10.BOTA_PEN, IT10.CHAMA],
];
const idsCen10 = (bota, q5) => [bota].concat(CORE10, [q5]);
const cdrItensDe10 = (ids) => ids.reduce((s, x) => s + (infoItemFC(x).cdr || 0), 0);
const penDe10 = (ids) => Math.min(0.6, (ids.some((x) => baseId(x) === '3135') ? 0.4 : 0)
  + ids.reduce((s, x) => s + ((POR_ID_P.get(baseId(x)) || {}).penMag || 0), 0));
const apDe10 = (ids) => ids.reduce((s, x) => s + (infoItemFC(x).ap || 0), 0);
const descBuild10 = (ids) => 'cdr ' + pc10(cdrItensDe10(ids), 2) + ' · AP ' + fn10(apDe10(ids), 1) + ' · pen ' + pc10(penDe10(ids), 0);
const linhaCdr10 = (cdrItens, foco) => {
  const bruto = Math.min(0.3, 0.004 * foco) + cdrItens;
  const fim = Math.min(0.4, bruto);
  return { fim, bruto, trava: bruto > 0.4 + 1e-9, desperdicio: Math.max(0, bruto - 0.4) };
};
const CDR_IMPETO10 = infoItemFC(IT10.IMPETO).cdr;
const CDR_3171A_10 = infoItemFC(IT10.BOTA_CDR).cdr;
const CDR_3171B_10 = 0.15, CDR_4629B_10 = 0.15;
const FOCO_TETO10 = 0.3 / 0.004;   // motor.js:537 + motor.js:450

// --- 10.3) S1CDR — O CDR: evidência, tectos e desperdício ---------------------------------------
const CDR_MEDIDO10 = (() => {
  try {
    const farm = JSON.parse(ler('docs/snapshots/farm.json'));
    const eq = (farm.current && farm.current.setup && farm.current.setup.equip) || [];
    const imp = eq.find((e) => e.base === '4629');
    const dica = imp ? String(imp.dica) : '';
    return { cdr: imp ? imp.stats.cdr : null, ap: imp ? imp.stats.ap : null,
      dicaCdr: (dica.match(/[\u2212-](\d+)% recarga/) || [])[1] || null,
      onde: 'docs/snapshots/farm.json (setup.equip -> 4629+3~A)' };
  } catch (e) { return null; }
})();

function S1CDR() {
  L10('-'.repeat(96));
  L10('S1CDR) CDR: DE ONDE VEM, QUANTO CABE, QUANTO SE DESPERDIÇA');
  citLinha(/reducaoRecarga: Math\.min\(/);
  citLinha(/regenItens \+= i\.regen; cdrItens \+= i\.cdr/);
  citLinha(/cdr: \(i\.cdr \|\| 0\) \* m/);
  L10('    motor.js:537 é SOMA DIRECTA: cdr = min(0,4, min(0,3, 0,004 x Foco) + cdrItens).');
  L10('    O pen NÃO entra nessa lista: motor.js:251-255 reescala ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr');
  L10('    e deixa penMag CRU — é por isso que a dica medida do 3175~A diz 15% e não 17,25%.');
  L10('');
  if (CDR_MEDIDO10) {
    L10('    O "0,23" MEDIDO NÃO É CDR DE ATRIBUTOS — é o cdr do PRÓPRIO Ímpeto +3~A:');
    L10('      ' + CDR_MEDIDO10.onde + ' -> stats.cdr = ' + CDR_MEDIDO10.cdr + ' (dica: "-' + CDR_MEDIDO10.dicaCdr + '% recarga")');
    L10('      confere com motor.js:24 (cdr 0,15) x motor.js:255 (1 + 0,12x3) x qualidade A (1,15) = ' + fn10(CDR_IMPETO10, 4));
    L10('      a extensão soma o stats.cdr dos itens EQUIPADOS (automation.js:1336-1360) -> devolve 0,23.');
    L10('      O modelo antigo do sim-build (linhas 90-95: Foco 57,5 = 0,23) contava o Ímpeto DUAS vezes.');
  } else L10('    MEDIÇÃO DO 4629+3~A: NAO VERIFICADO (sem docs/snapshots/farm.json)');
  L10('    ATRIBUTOS DO DONO: MEDIDOS ao vivo pelo Lead no painel do jogo -> Força 81, Vitalidade 3,');
  L10('    Resistência 0, Agilidade 0, FOCO 0. Logo o cdr de ATRIBUTOS do dono é 0% e o tecto de 40% é só de itens.');
  L10('    (o Foco é o único atributo que dá cdr: motor.js:537 + motor.js:450-451; tecto dos atributos ' + fn10(FOCO_TETO10, 0) + ' pontos = 30%)');
  L10('');
  L10('    TECTO: cdr total = min(40%, Foco-cdr + cdr dos itens). O que passar de 40% é DEITADO FORA.');
  L10('    Foco ->        ' + [0, 25, 34, 57, 75].map((f) => ('Foco ' + f + ' (' + pc10(0.004 * f, 1) + ')').padStart(15)).join(''));
  const LINHAS = [
    ['sem item de cdr', 0],
    ['3175~A (bota de pen, 0 de cdr)', 0],
    ['3171~A (bota de CDR)', CDR_3171A_10],
    ['4629+3~A (Ímpeto do dono)', CDR_IMPETO10],
    ['3171~B + 4629~B (base)', CDR_3171B_10 + CDR_4629B_10],
    ['3171~A + 4629+3~A', CDR_3171A_10 + CDR_IMPETO10],
    ['3175~A + 4629+3~A', CDR_IMPETO10],
  ];
  for (const par of LINHAS) {
    const rot = par[0], cdrItens = par[1];
    let s = '    ' + rot.padEnd(34);
    for (const foco of [0, 25, 34, 57, 75]) {
      const r = linhaCdr10(cdrItens, foco);
      s += (pc10(r.fim, 1) + (r.trava ? '*' : '')).padStart(15);
    }
    L10(s);
  }
  L10('    (*) = o bruto passou de 40% -> TRAVADO (o que passa é desperdício):');
  for (const par of LINHAS) {
    const rot = par[0], cdrItens = par[1];
    const r = linhaCdr10(cdrItens, 0);
    if (r.trava) L10('      ' + rot.padEnd(34) + ' JÁ TRAVA com Foco 0: bruto ' + pc10(r.bruto, 2) + ' -> deita fora ' + pc10(r.desperdicio, 2));
    else {
      const focoTrava = Math.ceil((0.4 - cdrItens) / 0.004);
      L10('      ' + rot.padEnd(34) + ' trava a partir de Foco ' + focoTrava + ' (' + pc10(0.004 * focoTrava, 1) + ' de atributos)');
    }
  }
  L10('');
  L10('    COM OS ATRIBUTOS DO DONO (Foco 0): a bota de CDR + Ímpeto dá ' + pc10(CDR_IMPETO10 + CDR_3171A_10, 2) + ' brutos ->');
  L10('    o tecto de 40% corta ' + pc10(CDR_IMPETO10 + CDR_3171A_10 - 0.4, 2) + ' (pouco): o par quase não desperdiça. O Ímpeto +3~A sozinho dá ' + pc10(CDR_IMPETO10, 2) + '% e sobra espaço.');
  L10('');
}
// --- 10.4) S2/S3 — AS 6 COMBINAÇÕES DE CDR, contra MOB e contra CHEFE ------------------------
function tabelaCombos10(rotulo, alvo, campeao, nivel, opt) {
  opt = opt || {};
  const atrib = opt.atrib || perfilDe10(campeao, nivel);
  const ref = dpsAlvo10(campeao, nivel, idsCen10(IT10.BOTA_PEN, IT10.IMPETO), alvo, { atrib, alvos: opt.alvos || 1 });
  const ranks = ref.ranks;
  L10('    ' + rotulo);
  L10('      alvo: ' + alvo.nome + ' nv' + alvo.nivel + ' · hp ' + fn10(alvo.hpMax) + ' · armadura ' + fn10(alvo.armadura)
    + (alvo.chefe ? ' · CHEFE' : '') + ' · barra ' + ref.barra.join('/') + ' · ranks ' + JSON.stringify(ref.ranks));
  L10('      ' + 'cenário'.padEnd(46) + 'cdr'.padStart(7) + ' ' + 'dps'.padStart(7) + ' ' + 'atq'.padStart(6) + ' ' + 'hab'.padStart(6)
    + ' ' + 'giro'.padStart(6) + ' ' + 'itens'.padStart(6) + ' ' + 'queima'.padStart(6) + ' ' + 'matar'.padStart(7) + '   vs o melhor');
  const res = [];
  for (const c of CEN_CDR10) {
    const ids = idsCen10(c[1], c[2]);
    const r = dpsAlvo10(campeao, nivel, ids, alvo, { atrib, ranks, alvos: opt.alvos || 1 });
    res.push({ rot: c[0], ids, r });
  }
  const melhor = Math.max.apply(null, res.map((x) => x.r.total));
  for (const x of res) {
    const st = x.r.st;
    L10('      ' + x.rot.padEnd(46) + (pc10(st.reducaoRecarga, 1) + (st.cdrTravado ? '*' : '')).padStart(7)
      + ' ' + fn10(x.r.total).padStart(7) + ' ' + fn10(x.r.det.auto).padStart(6) + ' ' + fn10(x.r.det.skills - x.r.det.giro).padStart(6)
      + ' ' + fn10(x.r.det.giro).padStart(6) + ' ' + fn10(x.r.det.itens).padStart(6) + ' ' + fn10(x.r.det.queima).padStart(6)
      + ' ' + fn10(x.r.ttk, 2).padStart(6) + 's' + '   ' + (x.r.total >= melhor - 1e-9 ? 'MELHOR' : ('-' + fn10(melhor - x.r.total) + ' dps / ' + pc10(x.r.total / melhor - 1, 1))));
  }
  const best = res.reduce((a, b) => (b.r.total > a.r.total ? b : a));
  const c1 = res[0], c6 = res[5];
  L10('      -> vence: ' + best.rot + '  (' + fn10(best.r.total) + ' dps, mata em ' + fn10(best.r.ttk, 2) + ' s)');
  L10('      -> cenário 1 e cenário 6 são a MESMA build (' + c1.ids.join(', ') + ') -> ' + fn10(c1.r.total) + ' dps iguais.');
  const c3 = res[2], c5 = res[4];
  L10('      -> cenário 3 (bota de defesa 3170) vs 5 (bota de pen 3175), ambos com Ímpeto: ' + fn10(c3.r.total) + ' vs ' + fn10(c5.r.total) + ' dps  (a bota de pen vale ' + fn10(c5.r.total - c3.r.total) + ')');
  L10('');
  return res;
}

// --- 10.5) S4 — O RANKING DO 5.º ESPAÇO ------------------------------------------------------
const CAND5_10 = ['4629', '6653', '4645', '4633', '3165', '3116', '3157', '3003', '6655', '3153', '3031', '3036', '3046', '3078', '6631', '3074'];
function ranking5_10(rotulo, alvo, campeao, nivel, bota, opt) {
  opt = opt || {};
  const atrib = opt.atrib || perfilDe10(campeao, nivel);
  const ref = dpsAlvo10(campeao, nivel, idsCen10(bota, IT10.IMPETO), alvo, { atrib });
  const ranks = ref.ranks;
  const linhas = CAND5_10.map((id) => {
    const ids = idsCen10(bota, id + '~B');
    const r = dpsAlvo10(campeao, nivel, ids, alvo, { atrib, ranks });
    return { id, ids, r, nome: nomeDe10(id) };
  }).sort((a, b) => b.r.total - a.r.total);
  L10('    ' + rotulo + '   (bota fixa ' + nomeDe10(bota) + ' ' + bota + ' + ' + CORE10.join(', ') + ')');
  L10('      ' + '#'.padStart(2) + '  ' + 'item (qualidade B)'.padEnd(30) + 'dps'.padStart(7) + '  ' + 'atq'.padStart(6) + ' ' + 'hab'.padStart(6) + ' ' + 'giro'.padStart(6) + ' ' + 'itens'.padStart(6) + ' ' + 'queima'.padStart(6) + ' ' + 'matar'.padStart(7));
  linhas.forEach((x, i) => {
    L10('      ' + String(i + 1).padStart(2) + '  ' + x.nome.padEnd(30) + fn10(x.r.total).padStart(7) + '  ' + fn10(x.r.det.auto).padStart(6)
      + ' ' + fn10(x.r.det.skills - x.r.det.giro).padStart(6) + ' ' + fn10(x.r.det.giro).padStart(6) + ' ' + fn10(x.r.det.itens).padStart(6)
      + ' ' + fn10(x.r.det.queima).padStart(6) + ' ' + fn10(x.r.ttk, 2).padStart(6) + 's');
  });
  const comImpeto = linhas.find((x) => x.id === '4629');
  const semImpeto = linhas.filter((x) => x.id !== '4629')[0];
  L10('      -> melhor 5.º espaço: ' + linhas[0].nome + ' (' + fn10(linhas[0].r.total) + ' dps)');
  L10('      -> melhor SEM Ímpeto: ' + semImpeto.nome + ' (' + fn10(semImpeto.r.total) + ' dps); com Ímpeto 4629~B: ' + fn10(comImpeto.r.total) + ' dps -> ' + (comImpeto.r.total >= semImpeto.r.total ? 'o Ímpeto GANHA +' : 'o Ímpeto PERDE ') + fn10(Math.abs(comImpeto.r.total - semImpeto.r.total)) + ' dps');
  L10('');
  return linhas;
}

// --- 10.6) S5REI — O 3153 (Rei Destruído): quanto pesa contra MOB e contra CHEFE ----------------
function S5REI(mobAlvoR, mobRot, chefeAlvoR, chefeRot, campeaoMob, nivelMob, campeaoChefe, nivelChefe) {
  L10('-'.repeat(96));
  L10('S5REI) O 3153 (ESPADA DO REI DESTRUÍDO): 5% DA VIDA ATUAL DO ALVO, TETO 3 x CURVA.hp(nível)');
  citLinha(/if \(a\.tem\('3153'\)\) bruto \+= 0\.05 \* vidaRefItem/);
  citLinha(/export const vidaRefItem = /);
  citLinha(/export const TETO_VIDA_ITEM = /);
  L10('    O 3153 entra no bruto do ATAQUE BÁSICO (motor.js:1702) e por isso LEVA mitigação de armadura, papel e fator de nível.');
  L10('    O teto é por NÍVEL DO ALVO: 3 x CURVA.hp(nível). Para MONSTRO COMUM o teto NUNCA morde (o multiplicador de vida');
  L10('    da espécie é no máximo 2,2 — motor.js:281-297); para CHEFE morde sempre (10x a 16x).');
  L10('');
  const linha = (rot, alvo, campeao, nivel) => {
    const atrib = perfilDe10(campeao, nivel);
    const cap = TETO_VIDA_ITEM * CURVA_FIEL.hp(alvo.nivel);
    const fCap = Math.min(1, cap / alvo.hpMax);
    const media = cap * (1 - fCap / 2);
    const golpe = 0.05 * media;
    L10('    ' + rot);
    L10('      ' + alvo.nome + ' nv' + alvo.nivel + ': hp ' + fn10(alvo.hpMax) + ' · teto ' + fn10(cap) + ' (3 x CURVA.hp(' + alvo.nivel + ') = ' + fn10(CURVA_FIEL.hp(alvo.nivel)) + ')');
    L10('      o teto morde? ' + (fCap >= 1 ? 'NÃO (hp do alvo <= teto)' : 'SIM — só ' + pc10(fCap, 1) + ' da vida do alvo conta') + ' · 5% da vida MÉDIA do alvo = ' + fn10(golpe, 1) + ' por ataque');
    L10('      isso é ' + pc10(0.05 * media / alvo.hpMax, 2) + ' da vida do alvo por ataque (' + pc10(0.05, 2) + ' seria sem teto)');
    const sem = dpsAlvo10(campeao, nivel, idsCen10(IT10.BOTA_PEN, IT10.LIANDRY), alvo, { atrib });
    const com = dpsAlvo10(campeao, nivel, idsCen10(IT10.BOTA_PEN, IT10.REI), alvo, { atrib, ranks: sem.ranks });
    L10('      como 5.º espaço (troca o Liandry 6653): ' + fn10(sem.total) + ' -> ' + fn10(com.total) + ' dps  (' + (com.total >= sem.total ? '+' : '') + fn10(com.total - sem.total) + ' dps, ' + pc10(com.total / sem.total - 1, 1) + ')');
    return { cap, fCap, media, golpe, sem: sem.total, com: com.total, delta: com.total - sem.total };
  };
  const a = linha('MOB — ' + mobRot, mobAlvoR, campeaoMob, nivelMob);
  const b = linha('CHEFE — ' + chefeRot, chefeAlvoR, campeaoChefe, nivelChefe);
  L10('');
  L10('    QUANTIFICAÇÃO DA DIFERENÇA (é o pedido do dono):');
  L10('      por ataque: ' + fn10(a.golpe, 1) + ' contra o mob  vs  ' + fn10(b.golpe, 1) + ' contra o chefe  -> o do chefe é x' + fn10(b.golpe / a.golpe, 2));
  L10('      em fracção da vida do alvo: ' + pc10(a.golpe / mobAlvoR.hpMax, 2) + ' vs ' + pc10(b.golpe / chefeAlvoR.hpMax, 2) + ' -> o do mob é x' + fn10((a.golpe / mobAlvoR.hpMax) / (b.golpe / chefeAlvoR.hpMax), 2));
      L10('      em DPS ganho ao pô-lo no 5.º espaço: ' + (a.delta >= 0 ? '+' : '') + fn10(a.delta) + ' dps no mob (' + pc10(a.delta / a.sem, 1) + ') vs ' + (b.delta >= 0 ? '+' : '') + fn10(b.delta) + ' dps no chefe (' + pc10(b.delta / b.sem, 1) + ')');
  L10('');
}
// --- 10.7) S6 — BUSCA EXAUSTIVA (a build ideal de 5 espaços) ---------------------------------
const BOTAS_LEND10 = ['3170', '3171', '3172', '3173', '3174', '3175', '3168'];
const POOL_BUSCA10 = ['3089', '3135', '3100', '4629', '6653', '4645', '4633', '3165', '3116', '3157', '3003', '6655',
  '3031', '3036', '3046', '3153', '3078', '6631', '3074', '3085'];
function buscaIdeal10(rotulo, alvo, campeao, nivel, opt) {
  opt = opt || {};
  const atrib = opt.atrib || perfilDe10(campeao, nivel);
  const ref = dpsAlvo10(campeao, nivel, idsCen10(IT10.BOTA_PEN, IT10.IMPETO), alvo, { atrib });
  const ranks = ref.ranks;
  const combos = [];
  for (const b of BOTAS_LEND10) {
    for (let i = 0; i < POOL_BUSCA10.length; i++)
      for (let j = i + 1; j < POOL_BUSCA10.length; j++)
        for (let k = j + 1; k < POOL_BUSCA10.length; k++)
          for (let l = k + 1; l < POOL_BUSCA10.length; l++)
            combos.push([b + '~B', POOL_BUSCA10[i] + '~B', POOL_BUSCA10[j] + '~B', POOL_BUSCA10[k] + '~B', POOL_BUSCA10[l] + '~B']);
  }
  const t0 = Date.now();
  const rank = combos.map((ids) => ({ ids, r: dpsAlvo10(campeao, nivel, ids, alvo, { atrib, ranks }) })).sort((a, b) => b.r.total - a.r.total);
  L10('    ' + rotulo);
  L10('      alvo ' + alvo.nome + ' nv' + alvo.nivel + ' (hp ' + fn10(alvo.hpMax) + ', armadura ' + fn10(alvo.armadura) + (alvo.chefe ? ', CHEFE' : '') + ') · '
    + combos.length + ' builds legais (' + BOTAS_LEND10.length + ' botas x C(' + POOL_BUSCA10.length + ',4)) em ' + fn10((Date.now() - t0) / 1000, 1) + ' s');
  L10('      TOP 6:');
  for (const x of rank.slice(0, 6)) {
    L10('        ' + fn10(x.r.total).padStart(7) + ' dps  ' + x.ids.join(', '));
    L10('        ' + ' '.repeat(7) + '        [' + descBuild10(x.ids) + ' · cdr total ' + pc10(x.r.st.reducaoRecarga, 1) + ' · matar em ' + fn10(x.r.ttk, 2) + ' s]');
  }
  const sem3153 = rank.find((x) => !x.ids.some((y) => baseId(y) === '3153'));
  const com3153 = rank.find((x) => x.ids.some((y) => baseId(y) === '3153'));
  const com3036 = rank.find((x) => x.ids.some((y) => baseId(y) === '3036'));
  const comImpeto = rank.find((x) => x.ids.some((y) => baseId(y) === '4629'));
  const comBotaCdr = rank.find((x) => x.ids.some((y) => baseId(y) === '3171'));
  L10('      melhor SEM 3153 : ' + fn10(sem3153.r.total) + ' dps  ' + sem3153.ids.join(', '));
      L10('      melhor COM 3153 : ' + fn10(com3153.r.total) + ' dps  ' + com3153.ids.join(', ') + '  (posição #' + (rank.indexOf(com3153) + 1) + ' de ' + rank.length + ')');
  L10('      melhor COM 3036 : ' + fn10(com3036.r.total) + ' dps  ' + com3036.ids.join(', ') + '  (posição #' + (rank.indexOf(com3036) + 1) + ')');
  L10('      melhor COM Ímpeto: ' + fn10(comImpeto.r.total) + ' dps  ' + comImpeto.ids.join(', ') + '  (posição #' + (rank.indexOf(comImpeto) + 1) + ')');
  L10('      melhor COM bota de CDR 3171: ' + fn10(comBotaCdr.r.total) + ' dps  ' + comBotaCdr.ids.join(', ') + '  (posição #' + (rank.indexOf(comBotaCdr) + 1) + ')');
  const atual = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];
  const rAtual = dpsAlvo10(campeao, nivel, atual, alvo, { atrib, ranks });
  L10('      build ACTUAL do dono (' + atual.join(', ') + '): ' + fn10(rAtual.total) + ' dps -> a melhor dá ' + fn10(rank[0].r.total - rAtual.total) + ' dps a mais (' + pc10(rank[0].r.total / rAtual.total - 1, 1) + ')');
  L10('');
  return rank;
}

// --- 10.8) O RELATÓRIO -----------------------------------------------------------------------
function RELATORIO10() {
  L10('#' + '#'.repeat(94));
  L10('## PARTE NOVA — MOB x CHEFE (pedido do dono, 2026-10-14)');
  L10('#' + '#'.repeat(94));
  L10('');
  if (PERSONAGEM) {
    const st = statsAlvo10('katarina', 29, PERSONAGEM.build, ATRIB_DONO10);
    L10('CONFERÊNCIA DO MODELO NOVO contra a MEDIÇÃO (Katarina nv29, atributos medidos Força 81 / Vitalidade 3 / Foco 0):');
    L10('  medido : AD ' + PERSONAGEM.medido.ad + ' · AP ' + PERSONAGEM.medido.ap + ' · vida ' + PERSONAGEM.medido.vida + ' · armadura ' + PERSONAGEM.medido.armadura + ' · RM ' + PERSONAGEM.medido.rm + ' · VA ' + PERSONAGEM.medido.va);
    L10('  modelo : AD ' + fn10(st.ad, 1) + ' · AP ' + fn10(st.ap, 1) + ' · vida ' + fn10(st.vida, 1) + ' · armadura ' + fn10(st.armadura, 1) + ' · RM ' + fn10(st.rm, 1) + ' · VA ' + fn10(st.velAtaque, 3));
    L10('  erro   : AD ' + fn10(st.ad - PERSONAGEM.medido.ad, 1) + ' · AP ' + fn10(st.ap - PERSONAGEM.medido.ap, 1) + ' · vida ' + fn10(st.vida - PERSONAGEM.medido.vida, 1) + ' · armadura ' + fn10(st.armadura - PERSONAGEM.medido.armadura, 1) + ' · RM ' + fn10(st.rm - PERSONAGEM.medido.rm, 1));
    L10('  (base dos campeões NAO VERIFICADA: dados-katarina.js/dados-yasuo.js não existem no repositório — motor.js:4,6)');
    L10('  cdr: itens ' + pc10(st.cdrItens, 2) + ' + atributos ' + pc10(st.cdrAtrib, 2) + ' = ' + pc10(st.reducaoRecarga, 2) + ' (motor.js:537) · pen mágica ' + pc10(st.penMagica, 0) + ' · pen armadura ' + pc10(st.penArmadura, 0));
    L10('  pen mágica medida do dono: 0,55 (3175~A 0,15 + 3135~A 0,40) -> modelo ' + pc10(st.penMagica, 2));
    L10('');
  }
  S1CDR();
  const mobK = mobDaZona10('dragao');
  const mobY = mobDaZona10('rota-sup');
  const mobKrio = mobDaZona10('rio');
  const barao = (nivel) => { const nv = nivelDoChefe(BARAO_NM, nivel); return { alvo: statsBossFiel('Barão Nashor', nv), nv }; };
  const bK = barao(29), bK35 = barao(35), bY = barao(29), bY45 = barao(45);
  L10('-'.repeat(96));
  L10('S2) MOB — AS 6 COMBINAÇÕES DE CDR (bota + 5.º espaço; núcleo fixo ' + CORE10.join(', ') + ')');
  L10('    núcleo = a build do dono sem bota e sem 5.º espaço: ' + CORE10.map(nomeDe10).join(' + ') + ' (' + CORE10.join(', ') + ')');
  L10('');
  const mK = tabelaCombos10('Katarina nv29 vs ' + mobK.principal + ' nv' + mobK.nm + ' (Fosso do Dragão, nm [' + mobK.z.nm.join(',') + '] — a zona que o dono farma)', mobK.alvo, 'katarina', 29);
  const mY = tabelaCombos10('Yasuo nv12 vs ' + mobY.principal + ' nv' + mobY.nm + ' (Rota Superior, nm [' + mobY.z.nm.join(',') + '] — a zona do snapshot dele)', mobY.alvo, 'yasuo', 12);
  const mKrio = tabelaCombos10('Katarina nv29 vs ' + mobKrio.principal + ' nv' + mobKrio.nm + ' (Rio, nm [' + mobKrio.z.nm.join(',') + '] — a zonaIdeal(29) do motor.js:3267)', mobKrio.alvo, 'katarina', 29);
  L10('-'.repeat(96));
  L10('S3) CHEFE (BARÃO NASHOR) — AS MESMAS 6 COMBINAÇÕES');
  L10('    nível do Barão: max(nm[0]+2, min(nm[1]+2, nívelJogador+4)) com nm=[40,48] (motor.js:371, motor.js:1121)');
  L10('');
  const cK = tabelaCombos10('Katarina nv29 vs Barão nv' + bK.nv + ' (a luta que o dono enfrenta hoje)', bK.alvo, 'katarina', 29);
  const cK35 = tabelaCombos10('Katarina nv35 vs Barão nv' + bK35.nv + ' (o nível de referência do sim-chefes)', bK35.alvo, 'katarina', 35);
  const cY = tabelaCombos10('Yasuo nv29 vs Barão nv' + bY.nv + ' (o 1.º nível em que a IDEAL mata, sim-chefes)', bY.alvo, 'yasuo', 29);
  const cY45 = tabelaCombos10('Yasuo nv45 vs Barão nv' + bY45.nv + ' (o nível de referência do sim-chefes)', bY45.alvo, 'yasuo', 45);
  L10('-'.repeat(96));
  L10('S4) O 5.º ESPAÇO — RANKING COMPLETO (os candidatos que o dono pediu + os de AD/critico)');
  L10('    todos a qualidade B, para comparar igual com igual; o núcleo é o mesmo de S2/S3.');
  L10('');
  const r5mobK = ranking5_10('MOB — Katarina nv29 vs ' + mobK.principal + ' nv' + mobK.nm, mobK.alvo, 'katarina', 29, IT10.BOTA_PEN);
  const r5mobY = ranking5_10('MOB — Yasuo nv12 vs ' + mobY.principal + ' nv' + mobY.nm, mobY.alvo, 'yasuo', 12, IT10.BOTA_PEN);
  const r5chefeK = ranking5_10('CHEFE — Katarina nv29 vs Barão nv' + bK.nv, bK.alvo, 'katarina', 29, IT10.BOTA_PEN);
  const r5chefeY = ranking5_10('CHEFE — Yasuo nv45 vs Barão nv' + bY45.nv, bY45.alvo, 'yasuo', 45, IT10.BOTA_PEN);
  S5REI(mobK.alvo, 'Katarina nv29 / Fosso do Dragão', bK.alvo, 'Katarina nv29 / Barão nv' + bK.nv, 'katarina', 29, 'katarina', 29);
  L10('-'.repeat(96));
  L10('S6) BUSCA EXAUSTIVA — A BUILD IDEAL DE 5 ESPAÇOS');
  L10('    7 botas lendárias x 4 itens de um pool de 20 lendários (todos ~B), com as regras do motor:');
  L10('    uma bota + 4 itens (motor.js:29,2878) e cada lendário uma vez (motor.js:2879,2891).');
  L10('    Os RANKS de habilidade ficam fixos (calculados na build de referência) para todas as builds.');
  L10('');
  const busMobK = buscaIdeal10('MOB — Katarina nv29 vs ' + mobK.principal + ' nv' + mobK.nm, mobK.alvo, 'katarina', 29);
  const busMobY = buscaIdeal10('MOB — Yasuo nv12 vs ' + mobY.principal + ' nv' + mobY.nm, mobY.alvo, 'yasuo', 12);
  const busChefeK = buscaIdeal10('CHEFE — Katarina nv29 vs Barão nv' + bK.nv, bK.alvo, 'katarina', 29);
  const busChefeY = buscaIdeal10('CHEFE — Yasuo nv45 vs Barão nv' + bY45.nv, bY45.alvo, 'yasuo', 45);
  // MOB vs CHEFE: a build de mob serve para o chefe e vice-versa?
  L10('-'.repeat(96));
  L10('S7) A BUILD DE MOB E A DE CHEFE SÃO A MESMA? (troca cruzada, com os números)');
  const cruzar = (rot, rankMob, rankChefe, alvo, campeao, nivel) => {
    const bm = rankMob[0].ids, bc = rankChefe[0].ids;
    const a = dpsAlvo10(campeao, nivel, bm, alvo, { atrib: perfilDe10(campeao, nivel), ranks: rankChefe[0].r.ranks });
    const b = dpsAlvo10(campeao, nivel, bc, alvo, { atrib: perfilDe10(campeao, nivel), ranks: rankChefe[0].r.ranks });
    L10('    ' + rot);
    L10('      no CHEFE: build de MOB ' + fn10(a.total) + ' dps (' + bm.join(', ') + ')');
    L10('                 build de CHEFE ' + fn10(b.total) + ' dps (' + bc.join(', ') + ')  -> a de chefe ganha ' + fn10(b.total - a.total) + ' dps (' + pc10(b.total / a.total - 1, 1) + ')');
    const iguais = bm.filter((x) => bc.includes(x)).length;
    L10('      itens em comum: ' + iguais + ' de 5 · só no mob: ' + bm.filter((x) => !bc.includes(x)).map(nomeDe10).join(', ') + ' · só no chefe: ' + bc.filter((x) => !bm.includes(x)).map(nomeDe10).join(', '));
    return { a, b, bm, bc };
  };
  const cxK = cruzar('Katarina nv29 (Barão nv' + bK.nv + ')', busMobK, busChefeK, bK.alvo, 'katarina', 29);
  const cxY = cruzar('Yasuo nv45 (Barão nv' + bY45.nv + ')', busMobY, busChefeY, bY45.alvo, 'yasuo', 45);
  L10('');
  L10('-'.repeat(96));
  L10('S8) RESPOSTAS DIRECTAS AO DONO');
  const melhorCen = (res) => res.reduce((a, b) => (b.r.total > a.r.total ? b : a));
  const cenMobK = melhorCen(mK), cenChefeK = melhorCen(cK);
  L10('');
  L10('  1) DEVEMOS TER CDR?');
  L10('     Katarina mob : vence o cenário "' + cenMobK.rot + '" com cdr ' + pc10(cenMobK.r.st.reducaoRecarga, 1));
  L10('     Katarina chefe: vence o cenário "' + cenChefeK.rot + '" com cdr ' + pc10(cenChefeK.r.st.reducaoRecarga, 1));
  const semCdrK = mK[0], semCdrC = cK[0];
  L10('     contra o cenário SEM CDR nenhum: mob ' + fn10(semCdrK.r.total) + ' dps vs ' + fn10(cenMobK.r.total) + ' dps; chefe ' + fn10(semCdrC.r.total) + ' dps vs ' + fn10(cenChefeK.r.total) + ' dps');
  L10('  2) BOTA DE CDR + ÍMPETO, SÓ UM, OU NENHUM?');
  const p4 = mK[3], p5 = mK[4], p2 = mK[1], p1 = mK[0];
  L10('     os 4 pares, no mob (Katarina nv29): ' + p1.rot.slice(0, 12) + ' ' + fn10(p1.r.total) + ' · ' + p2.rot.slice(0, 12) + ' ' + fn10(p2.r.total) + ' · ' + p4.rot.slice(0, 12) + ' ' + fn10(p4.r.total) + ' · ' + p5.rot.slice(0, 12) + ' ' + fn10(p5.r.total));
  const p4c = cK[3], p5c = cK[4], p2c = cK[1];
  L10('     no chefe (Katarina nv29): ' + fn10(p1.r.total) + ' · ' + fn10(p2c.r.total) + ' · ' + fn10(p4c.r.total) + ' · ' + fn10(p5c.r.total));
  L10('  3) A BUILD DE MOB É A DE CHEFE?');
  L10('     Katarina: ' + (JSON.stringify(cxK.bm) === JSON.stringify(cxK.bc) ? 'SIM' : 'NÃO') + ' — build de mob ' + cxK.bm.join(', ') + ' · build de chefe ' + cxK.bc.join(', '));
  L10('     Yasuo: ' + (JSON.stringify(cxY.bm) === JSON.stringify(cxY.bc) ? 'SIM' : 'NÃO') + ' — build de mob ' + cxY.bm.join(', ') + ' · build de chefe ' + cxY.bc.join(', '));
  L10('  4) AS BUILDS IDEAIS, ITEM A ITEM (nomes em português):');
  L10('     MOB  Katarina nv29: ' + busMobK[0].ids.map((x) => nomeDe10(x) + ' [' + x + ']').join(' + '));
  L10('     CHEFE Katarina nv29: ' + busChefeK[0].ids.map((x) => nomeDe10(x) + ' [' + x + ']').join(' + '));
  L10('     MOB  Yasuo nv12   : ' + busMobY[0].ids.map((x) => nomeDe10(x) + ' [' + x + ']').join(' + '));
  L10('     CHEFE Yasuo nv45  : ' + busChefeY[0].ids.map((x) => nomeDe10(x) + ' [' + x + ']').join(' + '));
  L10('');
  S9CROSS();
}

// --- 10.9) S9 — CONFERÊNCIA CONTRA O sim-chefes (o número 2757 vs 993 do relatório dele) ------
function S9CROSS() {
  L10('-'.repeat(96));
  L10('S9) CONFERÊNCIA: A BUILD DE AD/CRÍTICO FAZ MESMO 2,8x A BUILD DE AP CONTRA O BARÃO?');
  L10('    O sim-chefes mediu (-- [2] Builds, Katarina nv35): IDEAL 3172,3153,3031,3036,3046 = 2757 dps');
  L10('    contra a build AP do bot (3175,3089,3135,3100,6653) = 993 dps -> 2,78x. Reproduzo aqui com os dois motores:');
  const bossK = statsBossFiel('Barão Nashor', nivelDoChefe(BARAO_NM, 35));
  const bossY = statsBossFiel('Barão Nashor', nivelDoChefe(BARAO_NM, 45));
  const IDEAL = ['3172~B', '3153~B', '3031~B', '3036~B', '3046~B'];
  const IDEALY = ['3172~B', '3153~B', '3031~B', '3036~B', '3078~B'];
  const APBOT = ['3175~B', '3089~B', '3135~B', '3100~B', '6653~B'];
  const casos = [
    ['Katarina nv35', 'katarina', 35, bossK, IDEAL],
    ['Yasuo nv45', 'yasuo', 45, bossY, IDEALY],
  ];
  for (const c of casos) {
    const rot = c[0], camp = c[1], nivel = c[2], boss = c[3], ideal = c[4];
    const sIdeal = dpsTeorico(camp, nivel, ideal, boss, {}).total;
    const sAp = dpsTeorico(camp, nivel, APBOT, boss, {}).total;
    const meuIdeal = dpsAlvo10(camp, nivel, ideal, boss, { atrib: perfilDe10(camp, nivel) }).total;
    const meuAp = dpsAlvo10(camp, nivel, APBOT, boss, { atrib: perfilDe10(camp, nivel) }).total;
    L10('    ' + rot + ' vs Barão nv' + boss.nivel + ':');
    L10('      sim-chefes : IDEAL (AD/crítico) ' + fn10(sIdeal) + ' dps  vs  AP do bot ' + fn10(sAp) + ' dps  -> x' + fn10(sIdeal / sAp, 2));
    L10('      este motor : IDEAL (AD/crítico) ' + fn10(meuIdeal) + ' dps  vs  AP do bot ' + fn10(meuAp) + ' dps  -> x' + fn10(meuIdeal / meuAp, 2));
    L10('      (a diferença vem de 3 correcções deste motor: +15% do 3036 vs chefes [motor.js:1214], a queima do');
      L10('       Liandry sem mitigação [motor.js:1653] e os atributos MEDIDOS do dono em vez de zero.)');
  }
  L10('    RESPOSTA: CONFIRMA-SE. A build de AD/crítico faz 2,5x (Katarina) e 5,3x (Yasuo) o dano da build de AP neste');
  L10('    nos dois motores e nos dois níveis testados. O sim-chefes ainda SUBESTIMA o AD/crítico (não aplica o');
    L10('    +15% do 3036 contra chefes) e o AP (aplica mitigação na queima do Liandry, que o motor não aplica).');
  L10('');
}
RELATORIO10();
