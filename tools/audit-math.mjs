#!/usr/bin/env bun
/*
 * tools/audit-math.mjs - AUDITORIA DA MATEMATICA DA BUILD (pedido do dono, 2026-10-14).
 *
 * SO LE. Nao escreve nada fora de stdout. Nao toca em browser/CDP/jogo.
 * Fontes: docs/game-src/motor.js (TEXTO, com file:linha), docs/game-src/itens.js (import),
 *         extension/automation.js (TEXTO, com file:linha), docs/snapshots/*.json (medicao real),
 *         tools/sim-chefes.mjs (matematica ja validada contra a luta medida).
 *
 * USO: bun tools/audit-math.mjs [inventario|rv|voracidade|estados|divergencia|regioes|niveis|hardcodes|tudo]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from './sim-chefes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const MOTOR = ler('docs/game-src/motor.js');
const MOTOR_L = MOTOR.split('\n');
const AUTO = ler('extension/automation.js');
const AUTO_L = AUTO.split('\n');
const INJECT = ler('extension/inject.js');
const INJECT_L = INJECT.split('\n');
export const AUTO_SHA = crypto.createHash('sha256').update(AUTO).digest('hex');
export const AUTO_N = AUTO_L.length;

// O catalogo e carregado por data-URL a partir do TEXTO de itens.js: o sim-chefes.mjs faz
// Object.assign nos MESMOS objectos (motor.js:16-26) e poluiria esta copia. O catalogo PURO
// e o que inject.js:161 manda para a extensao.
const ITENS_SRC = ler('docs/game-src/itens.js');
const ITENS_DADOS = (await import('data:text/javascript;base64,' + Buffer.from(ITENS_SRC).toString('base64'))).ITENS_DADOS;
export const ITENS = ITENS_DADOS.map((i) => ({ ...i, id: String(i.id) }));
export const ITEM = Object.fromEntries(ITENS.map((i) => [i.id, i]));
export const RAR = (i) => i.raridade || (i.lendario ? 'lendario' : 'basico');
const linhas = (texto, re) => { const out = []; const L = texto.split('\n'); for (let i = 0; i < L.length; i++) if (re.test(L[i])) out.push(i + 1); return out; };
export const linhaMotor = (re) => linhas(MOTOR, re);
export const linhaAuto = (re) => linhas(AUTO, re);
export const linhaInject = (re) => linhas(INJECT, re);

// ---------------------------------------------------------------- 0) CURVA: exportada e chamavel?
export function checarCurvaExportada() {
  const decl = linhaMotor(/export const CURVA = \{/);
  const nivelMax = linhaMotor(/export const NIVEL_MAX = (\d+);/);
  const chaves = ['hp', 'ad', 'armadura', 'xp', 'ouro'].map((k) => ({ k, linha: linhaMotor(new RegExp('^\\s*' + k + ': \\(n\\) =>'))[0] || null }));
  const inj = { curva: linhaInject(/meta\.curva = \{/), grupoSpawn: linhaInject(/meta\.grupoSpawn = \{/), respawn: linhaInject(/meta\.respawn = \{/) };
  const fonteGrupo = linhaMotor(/const qtd = 2 \+ Math\.floor/);
  const fonteRespawn = linhaMotor(/c\.respawn = 1\.5/).concat(linhaMotor(/c\.respawn = 1\.2/));
  return { decl, nivelMax, chaves, inj, fonteGrupo, fonteRespawn };
}

// ---------------------------------------------------------------- 1) passivas do catalogo
export const CAMPOS_PCT = ['adPct', 'apPct', 'vidaPct', 'armPct', 'rmPct', 'esquiva', 'penMag'];
export const CAMPOS_STAT = ['ad', 'ap', 'vida', 'armadura', 'rm', 'va', 'rv', 'critico', 'mana', 'regen', 'cdr'];

export function idsLidosPeloMotor() {
  const mapa = new Map();
  for (let i = 0; i < MOTOR_L.length; i++) {
    const re = /tem\??\s*\.?\s*\(\s*'(\d+)'\s*\)/g; let m;
    while ((m = re.exec(MOTOR_L[i]))) { if (!mapa.has(m[1])) mapa.set(m[1], []); mapa.get(m[1]).push(i + 1); }
  }
  return mapa;
}

export function inventarioPassivas() {
  const lidos = idsLidosPeloMotor();
  return ITENS.map((it) => {
    const ef = String(it.efeito || '');
    const camposPct = CAMPOS_PCT.filter((c) => it[c] != null && it[c] !== 0);
    const camposExtra = ['regen', 'cdr'].filter((c) => it[c]);
    return { id: it.id, nome: it.nome, rar: RAR(it), preco: it.preco, efeito: ef || null, camposPct, camposExtra,
      motor: lidos.get(it.id) || [], temPassiva: !!ef || camposPct.length > 0 || camposExtra.length > 0 };
  });
}

// ---------------------------------------------------------------- 2) port EXACTO do valorPassiva
export function valorPassiva(id, c) {
  const it = ITEM[String(id)];
  const e = String((it && it.efeito) || '');
  if (!e) return { v: 0, termos: [] };
  const ap = !!c.magia, tank = c.perfil === 'tanque';
  const n = (re) => { const m = e.match(re); return m ? parseFloat(String(m[1]).replace(',', '.')) : 0; };
  const termos = [];
  const add = (rot, v) => { if (v) termos.push([rot, v]); };
  add('Rabadon %AP total x9 [auto:4086]', n(/Poder de Habilidade total em ([\d,]+)%/i) * 9);
  add('pen magica x' + (ap ? 7 : 1) + ' [auto:4087]', n(/([\d,]+)%\s*de penetra\u00e7\u00e3o m\u00e1gica/i) * (ap ? 7 : 1));
  if (/queimam o alvo/i.test(e)) add('Liandry fixo [auto:4088]', ap ? 140 : 20);
  if (/menos de 40% de Vida/i.test(e)) add('Chama Sombria fixo [auto:4089]', ap ? 90 : 15);
  add('Lich %AP x' + (ap ? 2.2 : 1.2) + ' [auto:4090]', n(/pr\u00f3ximo ataque causa \+([\d,]+)%/i) * (ap ? 2.2 : 1.2));
  add('AD% total x' + (ap ? 1 : 9) + ' [auto:4091]', n(/Dano de Ataque total em ([\d,]+)%/i) * (ap ? 1 : 9));
  add('RV x4 [auto:4092]', n(/([\d,]+)%\s*de roubo de vida/i) * 4);
  add('VA% x' + (ap ? 2 : 6) + ' [auto:4093]', n(/([\d,]+)%\s*de Velocidade de Ataque/i) * (ap ? 2 : 6));
  if (/quem te ataca recebe/i.test(e)) add('Espinhos fixo [auto:4094]', tank ? 70 : 6);
  add('RM% total x' + (tank ? 3 : 0.5) + ' [auto:4095]', n(/Resist\u00eancia M\u00e1gica total em ([\d,]+)%/i) * (tank ? 3 : 0.5));
  add('Arm% total x' + (tank ? 3 : 0.5) + ' [auto:4096]', n(/Armadura total em ([\d,]+)%/i) * (tank ? 3 : 0.5));
  add('+X% de Armadura total x' + (tank ? 3 : 0.5) + ' [auto:4104]', n(/([\d,]+)%\s*de\s*Armadura total/i) * (tank ? 3 : 0.5));
  add('+X% de RM total x' + (tank ? 3 : 0.5) + ' [auto:4105]', n(/([\d,]+)%\s*de\s*Resist[\u00ea e]ncia M[\u00e1 a]gica total/i) * (tank ? 3 : 0.5));
  add('+X% de AP x9 [auto:4106]', n(/([\d,]+)%\s*de\s*Poder de Habilidade(?!\s*total em)/i) * 9);
  if (it && it.cdr == null) add('CDR texto x6 [auto:4114]', n(/[\u2212-]([\d,]+)%\s*na recarga/i) * 6);
  add('esquiva x3 [auto:4115]', n(/\+([\d,]+)%\s*de esquiva/i) * 3);
  add('+X% de AD total x' + (ap ? 1 : 9) + ' [auto:4121]', n(/([\d,]+)%\s*de\s*Dano de Ataque total/i) * (ap ? 1 : 9));
  add('+X% de Vida maxima x' + (tank ? 6 : 2) + ' [auto:4122]', n(/\+([\d,]+)%\s*de\s*Vida m[\u00e1a]xima/i) * (tank ? 6 : 2));
  add('+X% em toda cura x1.5 [auto:4123]', n(/\+([\d,]+)%\s*em toda cura recebida/i) * 1.5);
  add('Golpe Infinito x' + (ap ? 3 : 12) + ' [auto:4128]', n(/acertos cr[\u00edi]ticos causam \+([\d,]+)%/i) * (ap ? 3 : 12));
  add('pen armadura x' + (ap ? 2 : 7) + ' [auto:4132]', n(/([\d,]+)%\s*de penetra[\u00e7c][\u00e3a]o de armadura/i) * (ap ? 2 : 7));
  add('shred armadura x' + (ap ? 1 : 4) + ' [auto:4133]', n(/reduz a Armadura do alvo em ([\d,]+)%/i) * (ap ? 1 : 4));
  add('Gume da Nevoa x' + (ap ? 3 : 5) + ' [auto:4134]', n(/([\d,]+)%\s*da Vida atual do alvo/i) * (ap ? 3 : 5));
  add('Cleave x' + (ap ? 2 : 6) + ' [auto:4136]', n(/ataques causam ([\d,]+)% do Dano de Ataque/i) * (ap ? 2 : 6));
  add('Cleave Titanico x' + (tank ? 5 : 2) + ' [auto:4137]', n(/([\d,]+)%\s*da sua Vida m[\u00e1a]xima/i) * (tank ? 5 : 2));
  add('Morello x' + (ap ? 6 : 2) + ' [auto:4138]', n(/habilidades causam \+([\d,]+)% de dano/i) * (ap ? 6 : 2));
  add('Pavor mana x3 [auto:4139]', n(/([\d,]+)%\s*da sua Mana m[\u00e1a]xima/i) * 3);
  add('Tirania x' + (ap ? 1 : 5) + ' [auto:4140]', n(/([\d,]+)%\s*da Vida b[\u00f4o]nus/i) * (ap ? 1 : 5));
  return { v: termos.reduce((s, t) => s + t[1], 0), termos };
}

export function pesoFaseItens() {
  const out = { mobs: {}, chefe: {} };
  for (const fase of ['mobs', 'chefe']) {
    const ini = AUTO_L.findIndex((l) => new RegExp('^\\s*' + fase + ': \\{').test(l));
    for (let i = ini; i < AUTO_L.length && i < ini + 40; i++) {
      const m = /'(\d+)':\s*\{\s*mult:\s*([\d.]+)/.exec(AUTO_L[i]);
      if (m) out[fase][m[1]] = +m[2];
      if (/^\s*\},?\s*$/.test(AUTO_L[i]) && i > ini + 2) break;
    }
  }
  return out;
}

export function especiais() {
  const out = [];
  const ini = AUTO_L.findIndex((l) => /const ITENS_ESPECIAIS = \[/.test(l));
  for (let i = ini; i < AUTO_L.length && i < ini + 80; i++) {
    const m = /\{\s*id:\s*'(\d+)',\s*papel:\s*'(\w+)'/.exec(AUTO_L[i]);
    if (m) out.push({ id: m[1], papel: m[2], linha: i + 1 });
    if (/^\s*\];/.test(AUTO_L[i]) && i > ini) break;
  }
  const icm = AUTO_L.findIndex((l) => /const CAMPOS_MULT = \[/.test(l));
  return { lista: out, camposLinha: icm + 1, campos: (AUTO_L[icm] || '').trim() };
}

export function pesosItem() {
  const ini = AUTO_L.findIndex((l) => /function pesosItem\(perfil\)/.test(l));
  const out = {};
  for (let i = ini; i < ini + 10; i++) {
    const l = AUTO_L[i] || '';
    const m = /return \{([^}]*)\};?/.exec(l);
    if (!m) continue;
    const o = {};
    for (const kv of m[1].split(',')) { const j = kv.split(':'); if (j.length === 2) o[j[0].trim()] = +j[1]; }
    const nome = /perfil === '(\w+)'/.exec(l);
    out[nome ? nome[1] : 'dano'] = o;
  }
  return { pesos: out, linha: ini + 1 };
}

export function perfilDe(c) {
  c = c || {}; const pap = c.papel || {};
  const dano = pap.dano != null ? pap.dano : 1, receb = pap.recebido != null ? pap.recebido : 1;
  if (c.magia) return (dano < 1.0 || receb <= 0.66) ? 'tanque' : 'mago';
  if (receb <= 0.62 && dano < 1.0) return 'tanque';
  if (c.distancia) return 'atirador';
  return 'dano';
}
export const classeItem = (id) => {
  const it = ITEM[String(id)]; if (!it) return 'neutro';
  const ad = it.ad || it.critico || it.va || it.rv;
  return it.ap && !ad ? 'ap' : ad && !it.ap ? 'ad' : 'neutro';
};

const L = (s) => console.log(s === undefined ? '' : s);
const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);
export const fmt = (o) => JSON.stringify(o);

export function parteInventario() {
  const inv = inventarioPassivas();
  const { lista, campos } = especiais();
  const esp = new Map(lista.map((e) => [e.id, e]));
  const pf = pesoFaseItens();
  const lidos = idsLidosPeloMotor();
  L('# A) INVENTARIO DAS PASSIVAS - catalogo REAL (' + inv.length + ' itens, itens.js:3)');
  L('revisao auditada de extension/automation.js: ' + AUTO_N + ' linhas, sha256 ' + AUTO_SHA);
  L('');
  L('itens com PASSIVA (texto efeito ou campo de passiva): ' + inv.filter((i) => i.temPassiva).length + ' de ' + inv.length);
  L('  so com texto efeito .............. ' + inv.filter((i) => i.efeito).length);
  L('  so com campo de passiva (sem texto) ' + inv.filter((i) => !i.efeito && i.temPassiva).length);
  L('  sem passiva nenhuma (so stats) ..... ' + inv.filter((i) => !i.temPassiva).length);
  L('itens que o MOTOR le pelo ID (tem(id)): ' + lidos.size);
  L('ITENS_ESPECIAIS a mao: ' + lista.length + ' | CAMPOS_MULT (linha ' + especiais().camposLinha + '): ' + campos);
  L('');
  const K = { magia: true, perfil: 'mago' }, Y = { magia: false, perfil: 'dano' };
  L(pad('id', 7) + pad('nome', 33) + pad('rar', 9) + pad('efeito', 7) + padl('vpK', 6) + padl('vpY', 6) + pad('esp', 5) + padl('fM', 6) + padl('fC', 6) + padl('motor', 12) + 'campos');
  L('-'.repeat(110));
  let ok = 0, zero = 0;
  const semTermo = [];
  for (const i of inv) {
    if (!i.temPassiva) continue;
    const vK = valorPassiva(i.id, K), vY = valorPassiva(i.id, Y);
    const e = esp.get(i.id);
    const modelada = (vK.v > 0 || vY.v > 0) || !!e || !!(pf.mobs[i.id] || pf.chefe[i.id]);
    if (modelada) ok++; else { zero++; semTermo.push(i); }
    L(pad(i.id, 7) + pad(i.nome.slice(0, 32), 33) + pad(i.rar, 9) + pad(i.efeito ? 'sim' : '-', 7) + padl(Math.round(vK.v), 6) + padl(Math.round(vY.v), 6) + pad(e ? e.papel : '-', 5) + padl(pf.mobs[i.id] || '-', 6) + padl(pf.chefe[i.id] || '-', 6) + padl(i.motor.join('/') || '-', 12) + i.camposPct.concat(i.camposExtra).join(','));
  }
  L('');
  L('RESUMO: com termo de passiva (texto/especial/fase) = ' + ok + ' | sem termo de passiva = ' + zero);
  L('');
  L('--- SEM TERMO DE PASSIVA (podem ainda ser pontuados pelo STAT BRUTO do campo) ---');
  for (const i of semTermo) L('  ' + i.id + ' ' + pad(i.nome.slice(0, 30), 31) + ' :: ' + String(i.efeito || '(so campo: ' + i.camposPct.concat(i.camposExtra).join(',') + ')'));
  L('');
  L('--- termos do valorPassiva, Katarina (mago) ---');
  for (const i of inv) {
    const vK = valorPassiva(i.id, K);
    if (!(vK.v > 0)) continue;
    L('  ' + i.id + ' ' + pad(i.nome.slice(0, 29), 30) + ' total ' + padl(Math.round(vK.v), 5) + ' = ' + vK.termos.map((t) => t[0] + '=' + (Math.round(t[1] * 100) / 100)).join(' + '));
  }
  L('');
  L('--- termos do valorPassiva, Yasuo (dano) ---');
  for (const i of inv) {
    const vY = valorPassiva(i.id, Y);
    if (!(vY.v > 0)) continue;
    L('  ' + i.id + ' ' + pad(i.nome.slice(0, 29), 30) + ' total ' + padl(Math.round(vY.v), 5) + ' = ' + vY.termos.map((t) => t[0] + '=' + (Math.round(t[1] * 100) / 100)).join(' + '));
  }
}

export function parteRv() {
  L('# B) ROUBO DE VIDA (rv) - o numero que o dono disse ser essencial');
  L('motor.js:538 rouboVida: rv  |  motor.js:1226-1230 cura = dano x rv, SO em fonte ataque');
  L('motor.js:1286 curar(): x1.25 com 3065, x0.65 em PvP (CURA_PVP motor.js:1284)');
  L('');
  const comRv = ITENS.filter((i) => i.rv > 0);
  L('itens com rv>0 no catalogo: ' + comRv.length);
  for (const i of comRv) {
    const vpK = valorPassiva(i.id, { magia: true, perfil: 'mago' });
    const vpY = valorPassiva(i.id, { magia: false, perfil: 'dano' });
    const wK = pesosItem().pesos.mago.rv, wY = pesosItem().pesos.dano.rv;
    L('  ' + i.id + ' ' + pad(i.nome.slice(0, 30), 31) + ' rv=' + pad(i.rv, 5) + ' campo->valor K ' + (i.rv * wK).toFixed(2) + ' / Y ' + (i.rv * wY).toFixed(2) + ' | texto vpK=' + Math.round(vpK.v) + ' vpY=' + Math.round(vpY.v) + ' | efeito: ' + String(i.efeito || '-').slice(0, 70));
  }
  const K = { magia: true, perfil: 'mago' }, Y = { magia: false, perfil: 'dano' };
  const rabadon = valorPassiva('3089', K).v;
  L('');
  L('COMPARACAO DE ESCALA (Katarina mago): valorPassiva(3089 Rabadon) = ' + Math.round(rabadon));
  L('  o campo rv vale (it.rv x w.rv): w.rv mago=' + pesosItem().pesos.mago.rv + ' dano=' + pesosItem().pesos.dano.rv);
  for (const i of comRv) {
    const pct = (i.rv * pesosItem().pesos.mago.rv) / rabadon * 100;
    L('  ' + i.id + ' rv ' + (i.rv * 100).toFixed(0) + '% -> ' + (i.rv * pesosItem().pesos.mago.rv).toFixed(2) + ' de valor = ' + pct.toFixed(3) + '% do valor do Rabadon');
  }
  L('');
  L('REGEX do texto (automation.js:4092): /([\\d,]+)%\\s*de roubo de vida/i');
  let acertos = 0;
  for (const i of ITENS) { const e = String(i.efeito || ''); if (/([\d,]+)%\s*de roubo de vida/i.test(e)) { acertos++; L('  ACERTO: ' + i.id + ' :: ' + e); } }
  L('  acertos no catalogo REAL de ' + ITENS.length + ' itens: ' + acertos);
  L('  textos que MENCIONAM roubo de vida (sem casar a regex):');
  for (const i of ITENS) { const e = String(i.efeito || ''); if (/roubo de vida/i.test(e) && !/([\d,]+)%\s*de roubo de vida/i.test(e)) L('    ' + i.id + ' :: ' + e); }
  L('');
  L('readStats (automation.js:1202-1210) - o que a extensao LE do painel: /^(Dano|Armadura|Vel. ataque|Res. magica|Poder|Mana|Critico|Esquiva)(.*)$/');
  const temRvNoPainel = /Roubo de vida|Roubo de Vida/.test(AUTO);
  L('  a extensao le roubo de vida do painel? ' + (temRvNoPainel ? 'SIM' : 'NAO - a palavra nao aparece em automation.js'));
  L('  player() (automation.js:1213-1221) devolve: ' + (AUTO.match(/return \{ nivel, vida:[^}]*\}/) || [''])[0]);
  L('');
  L('VALOR REAL no motor (nao no modelo): cura/s = dano do ataque basico x rv x velAtaque');
  const st = S.statsJogador('katarina', 29, ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'], { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 });
  L('  stats do snapshot (Katarina nv29, build medida): hp ' + Math.round(st.vida) + ' ad ' + Math.round(st.ad) + ' ap ' + Math.round(st.ap) + ' va ' + st.velAtaque.toFixed(2));
  const mob = S.statsBossFiel('Barão Nashor', 42);
  const armFis = mob.armadura * (1 - st.penArmadura);
  const autoHit = S.mit(st.ad, armFis) * S.multiplicadorCampeao('katarina') * S.fatorDanoJogador(29, 42);
  L('  ataque basico mitigado vs Barao nv42 (armadura ' + mob.armadura + '): ' + Math.round(autoHit) + ' por golpe [motor.js:1676,1167,1202,1212]');
  for (const rv of [0.06, 0.07, 0.10, 0.12, 0.15]) L('    rv ' + (rv * 100).toFixed(0) + '% -> cura ' + (autoHit * rv * st.velAtaque).toFixed(1) + ' HP/s = ' + (100 * autoHit * rv * st.velAtaque / st.vida).toFixed(2) + '% da vida maxima por segundo');
  L('  comparacao: 1 pocao Forte (900, motor.js:263) por segundo (EXAUSTAO 1, motor.js:41) = 900 HP/s');
}

export function parteVoracidade() {
  L('# C) VORACIDADE DA KATARINA (motor.js:733,736,1789) - a passiva que a extensao NAO modela');
  L('motor.js:736  P: { voracidade: 1.5, voracidadeChefe: 5, ... }');
  L('motor.js:1789 if (HPk?.voracidade) for (const t of [Q,W,E]) d.recargas[t] -= (i.chefe ? voracidadeChefe : voracidade)');
  L('  -> CADA ABATE corta 1,5 s de Q/W/E; CADA ABATE DE CHEFE corta 5 s; o R reinicia em 2 s (texto da passiva).');
  L('');
  const st = S.statsJogador('katarina', 29, ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'], { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 });
  L('CDR EFETIVO por regiao = CDR de item + cortes da Voracidade por abate');
  L('  cdr de item (snapshot): ' + (st.reducaoRecarga * 100).toFixed(2) + '% [motor.js:537]');
  L('');
  L(pad('regiao', 20) + pad('abates', 8) + pad('tipo', 8) + padl('corte/abate', 12) + padl('abates/s', 10) + padl('cdr extra', 10) + padl('cdr total', 10));
  const locais = parseLocais();
  for (const l of locais) {
    const abates = l.qtd;
    const corte = l.chefe ? 5 : 1.5;
    L(pad(l.nome, 20) + padl(abates, 8) + pad(l.chefe ? 'chefe' : 'mobs', 8) + padl(corte + ' s', 12));
  }
  L('');
  L('COMO O CDR DE ITEM MUDA DE VALOR (analitico, com o kit do motor):');
  const H = S.HAB_SIM.katarina;
  const q10 = H.Q.recarga[9], e10 = H.E.recarga[9], w10 = H.W.recarga[9];
  L('  recargas no rank 10 (motor.js:738,741,743): Q ' + q10 + ' s, W ' + w10 + ' s, E ' + e10 + ' s');
  const n = 8;
  L('  cenario MOBS: ' + n + ' abates numa luta de T segundos -> cada uma das 3 recargas cai ' + (n * 1.5) + ' s');
  for (const T of [10, 20, 30]) {
    const cdrItem = st.reducaoRecarga;
    const qSem = q10 * (1 - cdrItem), qCom = Math.max(0, q10 * (1 - cdrItem) - n * 1.5);
    L('    T=' + T + 's: Q efetiva sem Voracidade ' + qSem.toFixed(2) + ' s -> com ' + n + ' abates ' + qCom.toFixed(2) + ' s (x' + (qSem / Math.max(0.01, qCom)).toFixed(2) + ' de taxa de lancamento)');
  }
  { const qSem = q10 * (1 - st.reducaoRecarga), qCom = Math.max(0.01, qSem - 5); L('  cenario CHEFE: 1 abate (5 s) -> Q efetiva ' + qCom.toFixed(2) + ' s (x' + (qSem / qCom).toFixed(2) + ' de taxa de lancamento)'); }
  L('');
  L('DPS DO GIRO (a fonte que a Voracidade acelera) - motor.js:737 giro = 30 + 19*nivel + 1*ap + 0.4*max(0, ad-baseAd)');
  L('  giro no snapshot: ' + H.P.giro(29, st) + ' de dano por adaga apanhada [motor.js:737]');
  L('  motor.js:736 pegaCada 0.35 s -> maximo ' + (1 / H.P.pegaCada).toFixed(2) + ' giros/s [motor.js:2181]');
}

export function parseLocais() {
  const out = [];
  for (let i = 0; i < MOTOR_L.length; i++) {
    const l = MOTOR_L[i];
    const m = /^\s*\{ id: '([\w-]+)', nome: '([^']+)'(.*)$/.exec(l);
    if (!m) continue;
    const resto = m[3] + (MOTOR_L[i + 1] || '');
    const nm = /nm: \[(\d+), (\d+)\]/.exec(resto);
    const faixa = /faixa: \[(\d+), (\d+)\]/.exec(resto);
    const mon = /monstros: \[((?:\[[^\]]*\](?:,\s*)?)+)\]/.exec(resto);
    const chefe = /chefe: \['([^']+)', ([\d.]+)\]/.exec(resto);
    const tier = /tier: (\d+)/.exec(resto);
    if (!nm) continue;
    const monstros = mon ? [...mon[1].matchAll(/\['([^']+)', (\d+)\]/g)].map((x) => ({ nome: x[1], peso: +x[2] })) : [];
    const qtd = monstros.reduce((s, x) => s + x.peso, 0);
    out.push({ id: m[1], nome: m[2], linha: i + 1, nm: [+nm[1], +nm[2]], faixa: faixa ? [+faixa[1], +faixa[2]] : null, tier: tier ? +tier[1] : null, monstros, chefe: chefe ? { nome: chefe[1], chance: +chefe[2] } : null, qtd: 2 + 1 });
  }
  return out;
}

export function relatorio(partes) {
  L('='.repeat(90));
  L('AUDITORIA DA MATEMATICA - LoL Idle (so leitura; sem browser, sem CDP, sem jogo)');
  L('='.repeat(90));
  L('motor.js: ' + MOTOR_L.length + ' linhas | itens.js: ' + ITENS.length + ' itens | automation.js: ' + AUTO_N + ' linhas sha256 ' + AUTO_SHA);
  const cv = checarCurvaExportada();
  L('');
  L('# 0) CURVA / grupoSpawn / respawn - o numero esta no jogo e a extensao copia-o?');
  L('  motor.js exporta CURVA? linhas ' + JSON.stringify(cv.decl) + '  (export const CURVA = { ... })');
  L('  NIVEL_MAX exportado em motor.js:' + JSON.stringify(cv.nivelMax));
  for (const c of cv.chaves) L('    CURVA.' + c.k + ' definida em motor.js:' + c.linha);
  L('  inject.js: curva copiada a mao na linha ' + JSON.stringify(cv.inj.curva) + ' | grupoSpawn ' + JSON.stringify(cv.inj.grupoSpawn) + ' | respawn ' + JSON.stringify(cv.inj.respawn));
  L('  motor.js: grupo ' + JSON.stringify(cv.fonteGrupo) + ' | respawn ' + JSON.stringify(cv.fonteRespawn));
  L('');
  if (partes.includes('inventario')) parteInventario();
  if (partes.includes('rv')) parteRv();
  if (partes.includes('voracidade')) parteVoracidade();
  if (partes.includes('divergencia')) parteDivergencia();
  if (partes.includes('regioes')) parteRegioes();
  if (partes.includes('niveis')) parteNiveis();
  if (partes.includes('rvponto')) parteRouboVida();
  if (partes.includes('estados')) parteEstados();
  if (partes.includes('hardcodes')) parteHardcodes();
  if (partes.includes('curva')) parteCurva();
}


// =====================================================================================
// D) DIVERGENCIA ENTRE OS TRES MODELOS (montarBuildDe x scoreSet x simulador)
// =====================================================================================
const SNAP_KAT = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];
const ATRIB_KAT = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };
const ATRIB_YAS = { forca: 10, vitalidade: 7, resistencia: 4, agilidade: 3, foco: 0 };


/** PESO_FASE.stat lido do automation.js (3852-3880). */
export function pesoFaseStat(fase) {
  const ini = AUTO_L.findIndex((l) => new RegExp('^\\s*' + fase + ': \\{').test(l));
  const m = /stat:\s*\{([^}]*)\}/.exec(AUTO_L[ini + 1] || '');
  const o = {};
  if (m) for (const kv of m[1].split(',')) { const j = kv.split(':'); if (j.length === 2) o[j[0].trim()] = +j[1]; }
  return o;
}
export function pesosItemFase(perfil, fase) {
  const base = pesosItem().pesos[perfil];
  const f = pesoFaseStat(fase);
  const out = {};
  for (const k of Object.keys(base)) out[k] = base[k] * (f[k] != null ? f[k] : 1);
  return out;
}
/** REPLICA de montarBuildDe (automation.js:4740-4798) com a fase. */
export function montarBuildDeReplica(c, fase) {
  const perfil = perfilDe(c);
  const classe = c && c.magia ? 'ap' : 'ad';
  const pesos = fase ? pesosItemFase(perfil, fase) : pesosItem().pesos[perfil];
  const pfI = pesoFaseItens();
  const bonusDe = (id) => (fase && pfI[fase][id] ? pfI[fase][id] : 1);
  const alvoRef = fase === 'chefe' ? { hp: 97824, nivel: 42 } : null;   // Barao nv42 (motor.js:1121 com nm [40,48])
  const poder = (i) => {
    const v = (i.ad || 0) * pesos.ad + (i.ap || 0) * pesos.ap + (i.va || 0) * pesos.va + (i.critico || 0) * pesos.critico + (i.rv || 0) * pesos.rv
      + (i.vida || 0) * pesos.vida + (i.armadura || 0) * pesos.armadura + (i.rm || 0) * pesos.rm
      + (i.cdr || 0) * pesos.cdr + (i.penMag || 0) * pesos.penMag + (i.mana || 0) * pesos.mana + (i.regen || 0) * pesos.regen + valorPassiva(i.id, c).v
      + (i.id === '3153' && alvoRef ? Math.min(0.05 * alvoRef.hp, 3 * S.CURVA_FIEL.hp(alvoRef.nivel)) * ((pesos.ad || 0) > 0 ? pesos.ad : pesos.ap) : 0);
    const cl = classeItem(i.id);
    const multClasse = cl === 'neutro' ? 1 : (cl === classe ? 1 : 0.12);
    const ofensivo = (i.ad || 0) + (i.ap || 0) + (i.va || 0) + (i.critico || 0) + (i.rv || 0) + (i.cdr || 0) + (i.penMag || 0);
    const multDef = (perfil !== 'tanque' && ofensivo === 0) ? 0.3 : 1;
    return v * multClasse * multDef * (({ basico: 1, epico: 1.15, lendario: 1.35 })[i.raridade] || 1) * bonusDe(i.id);
  };
  const todos = ITENS.filter((i) => i.raridade === 'lendario' || i.raridade === 'epico');
  const cmp = (a, b) => (poder(b) - poder(a)) || (String(a.id) < String(b.id) ? -1 : 1);
  const botas = todos.filter((i) => i.espaco === 'botas').sort(cmp)[0] || null;
  const usados = new Set(botas ? [String(botas.id)] : []);
  const out = botas ? [String(botas.id)] : [];
  for (const i of todos.slice().sort(cmp)) {
    if (out.length >= 5) break;
    if (usados.has(String(i.id))) continue;
    if (i.espaco === 'botas') continue;
    usados.add(String(i.id)); out.push(String(i.id));
  }
  return out;
}

export function parteDivergencia() {
  L('# D) OS TRES MODELOS DISCORDAM - montarBuildDe x scoreSet/melhorSet x simulador');
  L('  1) montarBuildDe (automation.js:4740-4798): soma aditiva de pesos + valorPassiva + multClasse/multDef/raridade.');
  L('  2) scoreSet (automation.js:5360-5394) + melhorSet (automation.js:5396-5438): AP x mit(pen) x fatorCdr + Lich + queima.');
  L('  3) simulador (tools/sim-chefes.mjs dpsTeorico/lutarBarao): DPS real contra o alvo com o kit e as recargas.');
  L('');
  const pw = pesosItem();
  L('  pesosItem lidos do automation.js (linha ' + pw.linha + '): ' + fmt(pw.pesos));
  L('  pesosItem do sim-chefes.mjs (mago/dano/tanque/atirador): ' + ['mago','dano','tanque','atirador'].map((k) => k + '=' + JSON.stringify(S.pesosItem(k))).join(' '));
  const ig = ['mago', 'dano', 'tanque', 'atirador'].every((k) => JSON.stringify(pw.pesos[k]) === JSON.stringify(S.pesosItem(k)));
  L('  os dois batem? ' + (ig ? 'SIM - o port do sim-chefes e fiel' : 'NAO - divergem'));
  L('');
  for (const par of [['katarina', 29, ATRIB_KAT], ['yasuo', 45, ATRIB_YAS]]) {
    const camp = par[0], nivel = par[1], atrib = par[2];
    const bossNivel = S.nivelDoChefe([40, 48], nivel);
    const boss = S.statsBossFiel('Barão Nashor', bossNivel);
    const cobj = { magia: camp === 'katarina', papel: camp === 'katarina' ? { dano: 1.2, recebido: 0.75 } : { dano: 1.15, recebido: 0.85 } };
    const ext = montarBuildDeReplica(cobj, null);
    L('  (1b) montarBuildDe fase MOBS  -> ' + montarBuildDeReplica(cobj, 'mobs').join(','));
    L('  (1c) montarBuildDe fase CHEFE -> ' + montarBuildDeReplica(cobj, 'chefe').join(','));
    const sim = S.melhoresBuilds(camp, nivel, boss, { atrib, shortlist: 18 });
    L('--- ' + camp + ' nv' + nivel + ' vs Barao nv' + bossNivel + ' (hp ' + Math.round(boss.hpMax) + ', armadura ' + boss.armadura + ') ---');
    L('  (1) montarBuildDe  -> ' + ext.join(','));
    L('  (3) simulador #1   -> ' + sim[0].ids.join(',') + '  dps ' + Math.round(sim[0].dps));
    const dExt = S.dpsTeorico(camp, nivel, ext, boss, { atrib });
    L('      dps do (1) medido pelo (3): ' + Math.round(dExt.total) + '  (x' + (sim[0].dps / Math.max(1, dExt.total)).toFixed(2) + ' de diferenca)');
    const setA = new Set(ext), setB = new Set(sim[0].ids);
    L('      diferenca: saem [' + ext.filter((x) => !setB.has(x)).join(',') + '] entram [' + sim[0].ids.filter((x) => !setA.has(x)).join(',') + ']');
    const rExt = S.lutarBarao(camp, nivel, ext, { atrib });
    const rSim = S.lutarBarao(camp, nivel, sim[0].ids, { atrib });
    L('      luta com (1): ' + (rExt.r.matou && rExt.r.vivo ? 'MATA em ' + rExt.r.tempoMatar + ' s, ' + rExt.r.totalPocoes + ' pocoes, ' + rExt.r.custo + ' ouro' : 'nao mata/morre'));
    L('      luta com (3): ' + (rSim.r.matou && rSim.r.vivo ? 'MATA em ' + rSim.r.tempoMatar + ' s, ' + rSim.r.totalPocoes + ' pocoes, ' + rSim.r.custo + ' ouro' : 'nao mata/morre'));
    const cf = { magia: camp === 'katarina', perfil: camp === 'katarina' ? 'mago' : 'dano' };
    const ord1 = Object.values(ITEM).filter((i) => ['lendario', 'epico'].includes(RAR(i))).map((i) => ({ id: i.id, v: valorPassiva(i.id, cf).v })).sort((a, b) => b.v - a.v).slice(0, 6);
    L('  (2) top-6 do valorPassiva -> ' + ord1.map((x) => x.id + '=' + Math.round(x.v)).join(', '));
    L('');
  }
}

// =====================================================================================
// E) OS 8 CENARIOS DE REGIAO
// =====================================================================================
const POTS = { vida: { cura: 300, preco: 40, nivel: 1 }, vidaF: { cura: 900, preco: 110, nivel: 15 }, vidaS: { cura: 2200, preco: 260, nivel: 30 } };
const EXAUSTAO = 1;
export const custoDe = (u) => Object.entries(u).reduce((s2, kv) => s2 + kv[1] * POTS[kv[0]].preco, 0);


/** MONSTROS do motor (motor.js:280-298) lidos do TEXTO, nao copiados a mao. */
export function monstrosDoMotor() {
  const out = {};
  const ini = linhaMotor(/^export const MONSTROS = \{/)[0];
  for (let i = ini; i < ini + 25; i++) {
    const l = MOTOR_L[i] || '';
    const m = /^\s*'([^']+)':\s*\{(.*)\},?\s*$/.exec(l);
    if (!m) continue;
    const g = (k) => { const x = new RegExp(k + ':\\s*([\\d.]+)').exec(m[2]); return x ? +x[1] : null; };
    out[m[1]] = { hp: g('hp'), ad: g('ad'), as: g('as'), armadura: g('armadura'), xp: g('xp'), ouro: g('ouro'),
      magico: /magico: true/.test(m[2]), chefe: /chefe: true/.test(m[2]), distancia: g('distancia') };
  }
  return out;
}
export const MONSTROS_MOTOR = monstrosDoMotor();
/** stats de um monstro num nivel (motor.js:1066-1075 criarMonstro + motor.js:273-279 CURVA). */
export function statsMonstro(nome, nivel) {
  const m = MONSTROS_MOTOR[nome]; if (!m) return null;
  return { nome, nivel, hpMax: S.CURVA_FIEL.hp(nivel) * m.hp, ad: S.CURVA_FIEL.ad(nivel) * m.ad, as: m.as,
    armadura: S.CURVA_FIEL.armadura(nivel) * m.armadura, magico: !!m.magico, chefe: !!m.chefe, distancia: m.distancia || 0 };
}

export function grupoDaRegiao(l, nivelJogador) {
  const niveis = [];
  for (let r = 0; r < 4; r++) niveis.push(Math.max(l.nm[0], Math.min(l.nm[1], nivelJogador - 2 + r)));
  const nivel = niveis.reduce((a, b) => a + b, 0) / niveis.length;
  const total = l.monstros.reduce((s2, x) => s2 + x.peso, 0);
  const qtd = 3;
  const grupo = [], resto = [];
  for (const m of l.monstros) { const ex = qtd * m.peso / total; const n = Math.floor(ex); for (let i = 0; i < n; i++) grupo.push(m.nome); resto.push({ nome: m.nome, f: ex - n }); }
  resto.sort((a, b) => b.f - a.f);
  let i = 0;
  while (grupo.length < qtd && resto.length) { grupo.push(resto[i % resto.length].nome); i++; }
  return { nivel, niveis, grupo, qtd };
}

export function dpsGrupo(campeao, nivel, itens, mobs, atrib) {
  const alvo = mobs[0];
  const d = S.dpsTeorico(campeao, nivel, itens, alvo, { atrib });
  const st = d.st, ranks = d.ranks, H = S.HAB_SIM[campeao];
  const N = mobs.length;
  const papel = S.multiplicadorCampeao(campeao), fj = S.fatorDanoJogador(nivel, alvo.nivel);
  const armFis = alvo.armadura * (1 - d.penTotal);
  const esperanca = (1 - st.critico) + st.critico * st.danoCritico;
  const auto = S.mit(st.ad * esperanca, armFis) * papel * fj * st.velAtaque * (1 + d.vaExtra);
  let skills = 0;
  const alvosDe = (t) => (t === 'Q' || t === 'R') ? Math.min(3, N) : (t === 'T' ? N : 1);
  for (const t of d.barra) { const x = S.dpsDaHabilidade(campeao, t, ranks[t], st, alvo, nivel); skills += x.dps * alvosDe(t); }
  let giro = 0;
  if (campeao === 'katarina') {
    const bruto = H.P.giro(nivel, st);
    const dagasPorS = d.barra.filter((t) => H[t].adaga).reduce((s2, t) => { const x = S.dpsDaHabilidade(campeao, t, ranks[t], st, alvo, nivel); return s2 + (x.cd ? 1 / x.cd : 0); }, 0);
    const girosPorS = Math.min(dagasPorS, 1 / H.P.pegaCada);
    const armMag = S.armEfetiva(st, alvo, true, true);
    giro = S.mit(bruto, armMag) * papel * fj * (1 + st.danoHab) * girosPorS * N;
  }
  return { st, ranks, barra: d.barra, auto, skills, giro, itens: d.det.itens, total: auto + skills + giro + d.det.itens, stDps: d.total };
}

export const incDps0 = (mobs, st, nivel, recebido) => mobs.reduce((s2, m) => s2 + S.mit(m.ad, m.magico ? st.rm : st.armadura) * S.fatorDanoMonstro(nivel, m.nivel) * recebido * m.as, 0);

export function lutarRegiao(o) {
  const dt = 0.05, maxSeg = o.maxSeg || 300;
  const mobs = o.mobs.map((m) => Object.assign({}, m, { hp: m.hpMax }));
  const st = o.st, campeao = o.campeao, nivel = o.nivel;
  const recebido = S.KITS_SIM[campeao].papel.recebido;
  const potes = Object.keys(POTS).filter((k) => POTS[k].nivel <= nivel).sort((a, b) => POTS[a].cura - POTS[b].cura);
  const usadas = {}; for (const k of Object.keys(POTS)) usadas[k] = 0;
  let hp = st.vida, hpMin = st.vida, t = 0, cdP = 0, danoRecebido = 0, pior = 0, matouEm = null, incUlt = 0;
  while (t < maxSeg) {
    const vivos = mobs.filter((m) => m.hp > 0);
    if (!vivos.length) { matouEm = t; break; }
    const prontos = vivos.filter((m) => t >= m.chegada);
    let dano = 0;
    for (let i = 0; i < prontos.length; i++) dano += o.dpsPorMob(prontos[i]) * (i === 0 ? 1 : (o.fatorArea || 0.35));
    let sobra = dano * dt;
    for (const m of prontos) { if (sobra <= 0) break; const usa = Math.min(m.hp, sobra); m.hp -= usa; sobra -= usa; }
    let inc = 0;
    for (const m of mobs) if (m.hp > 0 && t >= m.chegada) inc += S.mit(m.ad, m.magico ? st.rm : st.armadura) * S.fatorDanoMonstro(nivel, m.nivel) * recebido * m.as;
    incUlt = inc;
    hp -= inc * dt; danoRecebido += inc * dt; pior = Math.max(pior, inc * dt);
    if (hp <= 0) return { vivo: false, matou: false, t: +t.toFixed(2), hpMin: 0, usadas, custo: custoDe(usadas), danoRecebido: Math.round(danoRecebido), incDps: Math.round(inc), pior: Math.round(pior) };
    cdP = Math.max(0, cdP - dt);
    const alvoP = Math.max(st.vida * 0.75, pior * 1.1);
    if (hp < alvoP && cdP <= 0 && potes.length) {
      const falta = alvoP - hp;
      const kk = potes.find((x) => POTS[x].cura >= falta) || potes[potes.length - 1];
      hp = Math.min(st.vida, hp + POTS[kk].cura); usadas[kk]++; cdP = EXAUSTAO;
    }
    hpMin = Math.min(hpMin, hp);
    t += dt;
  }
  return { vivo: true, matou: !!matouEm, t: matouEm != null ? +matouEm.toFixed(2) : maxSeg, hpMin: Math.round(hpMin), usadas, custo: custoDe(usadas), danoRecebido: Math.round(danoRecebido), incDps: Math.round(incUlt), pior: Math.round(pior) };
}

export function parteRegioes() {
  const locais = parseLocais();
  const nivel = 29, itens = SNAP_KAT;
  const st = S.statsJogador('katarina', nivel, itens, ATRIB_KAT);
  L('# E) OS 8 CENARIOS DE REGIAO - personagem do snapshot');
  L('  docs/snapshots/player.json: nivel 29, vida 4476, armadura 164, rm 134, dano 161, poder 1104, va 1.16');
  L('  docs/snapshots/status.json: pocoes vida 405, vidaF 5328, vidaS 0 (nv 29 < 30 -> a Suprema nao existe)');
  L('  modelo de stats: hp ' + Math.round(st.vida) + ' ad ' + Math.round(st.ad) + ' ap ' + Math.round(st.ap) + ' arm ' + st.armadura.toFixed(0) + ' rm ' + st.rm.toFixed(0) + ' va ' + st.velAtaque.toFixed(2) + ' cdr ' + (st.reducaoRecarga * 100).toFixed(2) + '%');
  L('  build vestida: ' + itens.join(', '));
  L('  pocoes ao nivel 29: ' + Object.keys(POTS).filter((k) => POTS[k].nivel <= nivel).join(', ') + ' (motor.js:261-267)');
  L('  1 pocao por segundo (EXAUSTAO = 1, motor.js:41)');
  L('');
  const linhas = [];
  for (const l of locais) {
    const g = grupoDaRegiao(l, nivel);
    const mobs = g.grupo.map((n, k) => { const b = statsMonstro(n, Math.round(g.nivel)); return Object.assign({}, b, { chegada: 1.2 + k * 0.25 }); });
    const dpsPorMob = (m) => S.dpsTeorico('katarina', nivel, itens, m, { atrib: ATRIB_KAT }).total;
    const dg = dpsGrupo('katarina', nivel, itens, mobs, ATRIB_KAT);
    const r = lutarRegiao({ campeao: 'katarina', nivel, st, mobs, dpsPorMob, fatorArea: 0.35 });
    const hpTotal = mobs.reduce((s2, m) => s2 + m.hpMax, 0);
    const inc = incDps0(mobs, st, nivel, S.KITS_SIM.katarina.papel.recebido);
    L('-- ' + l.nome + ' (' + l.id + ') [motor.js:' + l.linha + '] nm ' + fmt(l.nm) + ' tier ' + l.tier + (l.chefe ? ' | CHEFE ' + l.chefe.nome + ' chance ' + l.chefe.chance : '') + ' --');
    L('   onda esperada (motor.js:1124 qtd = 2+floor(rand*3), media 3): ' + mobs.map((m) => m.nome + ' nv' + m.nivel).join(' + '));
    L('   hp total ' + Math.round(hpTotal) + ' | armadura ' + mobs.map((m) => Math.round(m.armadura)).join('/') + ' | ad ' + mobs.map((m) => Math.round(m.ad)).join('/'));
    L('   dano/s que TOMA com 3 vivos: ' + Math.round(inc) + '/s | vida ' + Math.round(st.vida));
    L('   dps: single-target ' + Math.round(dg.stDps) + ' | no grupo ' + Math.round(dg.total) + ' (auto ' + Math.round(dg.auto) + ' skills ' + Math.round(dg.skills) + ' giro ' + Math.round(dg.giro) + ' itens ' + Math.round(dg.itens) + ')');
    L('   RESULTADO: ' + (r.matou ? 'MATA em ' + r.t + ' s' : 'NAO mata em ' + r.t + ' s') + ' | hpMin ' + r.hpMin + (r.vivo ? '' : ' MORREU') + ' | pocoes ' + r.usadas.vida + 'x300 + ' + r.usadas.vidaF + 'x900 + ' + r.usadas.vidaS + 'x2200 = ' + r.custo + ' ouro | dano recebido ' + r.danoRecebido);
    linhas.push({ nome: l.nome, t: r.t, matou: r.matou, vivo: r.vivo, custo: r.custo, hpMin: r.hpMin, dps: Math.round(dg.total), inc: Math.round(inc) });
    if (l.chefe) {
      const bn = S.nivelDoChefe(l.nm, nivel);
      const boss = statsMonstro(l.chefe.nome, bn);
      const dch = S.dpsTeorico('katarina', nivel, itens, boss, { atrib: ATRIB_KAT });
      const rb = { r: S.lutarChefe({ campeao: 'katarina', nivel, st: dch.st, boss, dps: dch.total, estrategia: S.smartCarga({ pisoPct: 0.65 }), maxSeg: 300 }),
        semPocao: S.lutarChefe({ campeao: 'katarina', nivel, st: dch.st, boss, dps: dch.total, estrategia: () => null, maxSeg: 300 }) };
      L('   CHEFE ' + l.chefe.nome + ' nv' + bn + ' (motor.js:1121): hp ' + Math.round(boss.hpMax) + ' ad ' + Math.round(boss.ad) + ' armadura ' + boss.armadura);
      L('     com a build do snapshot: ' + (rb.r.matou && rb.r.vivo ? 'MATA em ' + rb.r.tempoMatar + ' s com ' + rb.r.totalPocoes + ' pocoes (' + rb.r.custo + ' ouro)' : (rb.r.vivo ? 'nao mata em ' + rb.r.t + ' s' : 'MORRE aos ' + rb.r.t + ' s')) + ' | sem pocao: ' + (rb.semPocao.matou && rb.semPocao.vivo ? 'sobrevive' : 'morre aos ' + rb.semPocao.t + ' s'));
    }
    L('');
  }
  L('--- MELHOR BUILD POR REGIAO (3 candidatas, medida com o mesmo modelo) ---');
  L('  A = build de MOBS do modelo (montarBuildDe mobs) | B = build de CHEFE do modelo | C = a build vestida no snapshot');
  const ck = { magia: true, papel: { dano: 1.2, recebido: 0.75 } };
  const bMobs = montarBuildDeReplica(ck, 'mobs');
  const bChefe = montarBuildDeReplica(ck, 'chefe');
  L('  ' + pad('regiao', 20) + padl('A mobs', 8) + padl('B chefe', 8) + padl('C snap', 8) + padl('D ~B', 8) + '  melhor');
  for (const l of locais) {
    const g = grupoDaRegiao(l, nivel);
    const mobs = g.grupo.map((n, k) => { const b = statsMonstro(n, Math.round(g.nivel)); return Object.assign({}, b, { chegada: 1.2 + k * 0.25 }); });
    const cand = [bMobs, bChefe, itens, ['3175', '3089', '3135', '3100', '4629']];
    const res = cand.map((ids) => {
      const st2 = S.statsJogador('katarina', nivel, ids, ATRIB_KAT);
      const r = lutarRegiao({ campeao: 'katarina', nivel, st: st2, mobs, dpsPorMob: (m) => S.dpsTeorico('katarina', nivel, ids, m, { atrib: ATRIB_KAT }).total, fatorArea: 0.35 });
      return r;
    });
    const melhor = res.map((r, i) => ({ i, r })).sort((a, b) => ((a.r.matou && a.r.vivo) ? 0 : 1e9) - ((b.r.matou && b.r.vivo) ? 0 : 1e9) || a.r.custo - b.r.custo || a.r.t - b.r.t)[0];
    L('  ' + pad(l.nome, 20) + padl(res[0].t + 's/' + res[0].custo + 'g', 8) + padl(res[1].t + 's/' + res[1].custo + 'g', 8) + padl(res[2].t + 's/' + res[2].custo + 'g', 8) + padl(res[3].t + 's/' + res[3].custo + 'g', 8) + '  ' + ['A mobs', 'B chefe', 'C snapshot(+3~A)', 'D = C tudo ~B'][melhor.i]);
  }
  L('  A = ' + bMobs.join(',') + '   B = ' + bChefe.join(','));
  L('');
  L('--- ORDEM por tempo de limpeza da onda (mesma build) ---');
  for (const x of linhas.slice().sort((a, b) => a.t - b.t)) L('  ' + pad(x.nome, 20) + padl(x.t, 8) + ' s | ' + padl(x.dps, 6) + ' dps | ' + padl(x.custo, 6) + ' ouro | hpMin ' + x.hpMin + ' | toma ' + x.inc + '/s');
}

export function parteNiveis() {
  L('# F) BUILD IDEAL POR NIVEL (1 a 50)');
  L('');
  for (const camp of ['katarina', 'yasuo']) {
    const papel = camp === 'katarina' ? { dano: 1.2, recebido: 0.75 } : { dano: 1.15, recebido: 0.85 };
    L('--- ' + camp + ' (perfil ' + perfilDe({ magia: camp === 'katarina', papel }) + ') ---');
    L('  build do modelo (montarBuildDe) em nv1:  ' + S.buildExtensao(camp, {}).join(','));
    L('  build do modelo (montarBuildDe) em nv50: ' + S.buildExtensao(camp, {}).join(',') + '  -> IGUAL (montarBuildDe nao le o nivel)');
    L('');
    L('  o que muda com o nivel e o RESULTADO da luta. Varredura contra o Barao:');
    L('  ' + pad('nv', 5) + pad('Barao nv', 9) + pad('build', 32) + padl('dps', 8) + padl('seg', 8) + padl('pocoes', 8) + padl('ouro', 8) + padl('hpMin', 7));
    for (let n = 25; n <= 50; n++) {
      const at = S.distribuirAtributos(S.modeloDe(camp), n);
      const b = S.buildExtensao(camp, {});
      const r = S.lutarBarao(camp, n, b, { atrib: at, maxSeg: 300 });
      L('  ' + pad(n, 5) + pad(r.bossNivel, 9) + pad(b.join(','), 32) + padl(Math.round(r.d.total), 8) + padl(r.r.matou && r.r.vivo ? r.r.tempoMatar : 'x', 8) + padl(r.r.totalPocoes, 8) + padl(r.r.custo, 8) + padl(r.r.hpMinPct + '%', 7));
    }
    L('');
  }
}



// =====================================================================================
// H) MODELO CONTINUO DA LUTA (para o roubo de vida e para os cenarios)
// =====================================================================================
/** MECANICAS do chefe lidas do TEXTO (motor.js:3102-3109) + HAB_CHEFE (motor.js:3069-3079). */
export function mecanicasDoMotor() {
  const out = {};
  for (let i = 3060; i < 3140 && i < MOTOR_L.length; i++) {
    const m = /else if \(tipo === '(\w+)'\)\s*\{?\s*(fis|mag)\(([\d.]+)\)/.exec(MOTOR_L[i]);
    if (m) out[m[1]] = { magico: m[2] === 'mag', mult: +m[3], linha: i + 1 };
    const m2 = /else if \(tipo === '(\w+)'\) \{ i\.as \*= ([\d.]+)/.exec(MOTOR_L[i]);
    if (m2) out[m2[1]] = { magico: true, mult: 0, linha: i + 1, as: +m2[2] };
  }
  const ini = linhaMotor(/^export const HAB_CHEFE = \{/)[0];
  for (let i = ini; i < ini + 14; i++) {
    const m = /^\s*(\w+): \{ carrega: ([\d.]+), espera: ([\d.]+)/.exec(MOTOR_L[i] || '');
    if (m && out[m[1]]) { out[m[1]].carrega = +m[2]; out[m[1]].espera = +m[3]; }
    if (m && !out[m[1]]) out[m[1]] = { carrega: +m[2], espera: +m[3], mult: 0, linha: i + 1 };
  }
  const rl = linhaMotor(/^export const RODIZIO_CHEFE = \{/)[0];
  out.__rodizio = {};
  for (let i = rl; i < rl + 4; i++) {
    const m = /'([^']+)': \[([^\]]+)\]/.exec(MOTOR_L[i - 1] || '');
    if (m) out.__rodizio[m[1]] = m[2].split(',').map((x) => x.trim().replace(/'/g, ''));
  }
  return out;
}
export const MEC = mecanicasDoMotor();

/** DPS que o chefe faz (basico + mecanicas + queimadura), motor.js:1725-1737 e 3081-3110. */
export function danoDoChefe(boss, st, nivel, recebido) {
  const fM = S.fatorDanoMonstro(nivel, boss.nivel);
  const basico = S.mit(boss.ad, boss.magico ? st.rm : st.armadura) * fM * recebido * boss.as;
  const rod = (MEC.__rodizio[boss.nome] || []);
  let mec = 0, pior = 0, ciclo = 0;
  for (const t of rod) {
    const h = MEC[t]; if (!h || !h.mult) continue;
    const d = S.mit(boss.ad * h.mult, h.magico ? st.rm : st.armadura) * fM * recebido;
    pior = Math.max(pior, d);
    mec += d / (h.carrega + h.espera);
    ciclo += h.carrega + h.espera;
  }
  let queima = 0;
  const sopro = rod.indexOf('sopro') >= 0, acido = rod.indexOf('acido') >= 0, chuva = rod.indexOf('chuva') >= 0;
  if (sopro) queima += st.vida * 0.03 * 4 / (MEC.sopro.carrega + MEC.sopro.espera);
  if (chuva) queima += st.vida * 0.025 * 3 / (MEC.chuva.carrega + MEC.chuva.espera);
  if (acido) queima += st.vida * 0.028 * 5 / (MEC.acido.carrega + MEC.acido.espera);
  pior = Math.max(pior, st.vida * 0.03 * 4 / 4);
  return { basico, mec, queima, total: basico + mec + queima, pior: Math.max(pior, S.mit(boss.ad, boss.magico ? st.rm : st.armadura) * fM * recebido) };
}

/** Cura continua do jogador (motor.js:1226-1230 e 2169-2170). */
export function curaDoJogador(camp, ids, d) {
  const st = d.st;
  const curaRv = (d.det.autoCura || 0) * (st.rouboVida || 0) * (S.temItem(ids, '3065') ? 1.25 : 1);
  const curaGiro = d.curaGiro || 0;
  const curaSede = d.det.curaSede || 0;
  return { curaRv, curaGiro, curaSede, total: curaRv + curaGiro + curaSede };
}

/** Modelo CONTINUO: tempo = hp do chefe / dps; pocoes = max(0, (entra - cura) x tempo) / cura da pocao. */
export function lutaContinua(camp, nivel, ids, boss, atrib, opts) {
  opts = opts || {};
  const d = S.dpsTeorico(camp, nivel, ids, boss, { atrib });
  const recebido = S.KITS_SIM[camp].papel.recebido;
  const dano = danoDoChefe(boss, d.st, nivel, recebido);
  const cura = curaDoJogador(camp, ids, d);
  const T = d.total > 0 ? boss.hpMax / d.total : Infinity;
  const pocoesDisp = Object.keys(POTS).filter((k) => POTS[k].nivel <= nivel).sort((a, b) => POTS[a].cura - POTS[b].cura);
  const curaP = pocoesDisp.length ? POTS[pocoesDisp[pocoesDisp.length - 1]].cura : 0;
  const liquido = dano.total - cura.total;
  const bruto = Math.max(0, liquido) * T;
  let n = curaP ? Math.ceil(bruto / curaP) : 0;
  if (dano.pior >= d.st.vida) n = Infinity;
  const custo = pocoesDisp.length ? n * POTS[pocoesDisp[pocoesDisp.length - 1]].preco : 0;
  const sobrevive = Number.isFinite(T) && dano.pior < d.st.vida && n <= T + 1;
  return { d, dano, cura, T, liquido, pocoes: n, custo, sobrevive, pior: dano.pior, hp: d.st.vida, curaP, potKey: pocoesDisp[pocoesDisp.length - 1] };
}

// =====================================================================================
// G) O PONTO DE VIRAGEM DO ROUBO DE VIDA (rv) POR NIVEL
// =====================================================================================
export function parteRouboVida() {
  L('# G) O PONTO DE VIRAGEM DO ROUBO DE VIDA (modelo continuo)');
  L('  cura por rv (motor.js:1226-1230): SO no auto-ataque; cura = dano do auto x rv.');
  L('  cura do giro da Katarina (motor.js:2169-2170): (curaBase 0.05 + D.curaGiro) x dano do giro.');
  L('  cura da Sede (motor.js:1685): 30% do dano da G.');
  L('  dano do chefe: basico (motor.js:1725-1737) + rodizio (motor.js:3081-3110) + queimadura (motor.js:3105-3108).');
  L('  pocoes: 1/s (motor.js:41), cura/preco motor.js:262-264. O modelo conta ceil(liquido x T / cura).');
  L('  LIMITE DECLARADO: o lutarChefe do tools/sim-chefes.mjs NAO aplica healS ao hp (so o usa na decisao);');
  L('  por isso aqui a conta e continua e nao replica o simulador discreto.');
  L('');
  L('  itens com rv>0: ' + ITENS.filter((i) => i.rv > 0).map((i) => i.id + '(' + (i.rv * 100).toFixed(0) + '%)').join(', '));
  L('');
  for (const camp of ['katarina', 'yasuo']) {
    L('--- ' + camp + ' vs Barao (build do modelo; 1 slot trocado) ---');
    L('  ' + pad('nv', 4) + pad('build base', 26) + padl('dps', 7) + padl('T(s)', 7) + padl('toma/s', 8) + padl('cura/s', 8) + padl('liq/s', 8) + padl('pot', 6) + padl('ouro', 7) + padl('pior', 7) + padl('vida', 7) + ' | troca');
    for (let n = 20; n <= 50; n += 2) {
      const at = S.distribuirAtributos(S.modeloDe(camp), n);
      const base = S.buildExtensao(camp, {});
      const bossNivel = S.nivelDoChefe([40, 48], n);
      const boss = S.statsBossFiel('Barão Nashor', bossNivel);
      const a = lutaContinua(camp, n, base, boss, at);
      let melhor = null;
      for (const cand of ['3168', '3072', '3074', '3153', '3172']) {
        for (let i = 1; i < base.length; i++) {
          const novo = base.slice(); novo[i] = cand;
          const b = lutaContinua(camp, n, novo, boss, at);
          if (!Number.isFinite(b.pocoes)) continue;
          const ganho = -b.custo * 1 - b.T * 10;
          if (!melhor || ganho > melhor.ganho) melhor = Object.assign({ ganho, cand, slot: i }, b);
        }
      }
      const fm = (x) => Number.isFinite(x) ? Math.round(x) : 'inf';
      L('  ' + pad(n, 4) + pad(base.join(','), 26) + padl(Math.round(a.d.total), 7) + padl(fm(a.T), 7) + padl(fm(a.dano.total), 8) + padl(fm(a.cura.total), 8) + padl(fm(a.liquido), 8) + padl(fm(a.pocoes), 6) + padl(fm(a.custo), 7) + padl(fm(a.pior), 7) + padl(fm(a.hp), 7)
        + (melhor ? ' | ' + melhor.cand + '@' + melhor.slot + ' pot ' + fm(melhor.pocoes) + ' (' + (a.pocoes - melhor.pocoes) + ') ouro ' + fm(melhor.custo) + ' (' + (a.custo - melhor.custo) + ') T ' + fm(melhor.T) + ' (' + (melhor.T - a.T).toFixed(1) + ')' : ' | sem troca valida'));
    }
    L('');
  }
  L('  PRECISA DE REGRA DO DONO: a taxa de troca entre SEGUNDOS e OURO. Sem ela o "ponto de viragem" nao tem numero unico.');
}

// =====================================================================================
// I) AS PASSIVAS DE ESTADO (nao resolviveis por texto) e a RE-CLASSIFICACAO DOS HARDCODES
// =====================================================================================
export const ESTADO_13 = ['3057', '3116', '3085', '6655', '3742', '3102', '3083', '6610', '3026', '3157', '6333', '3078', '3072'];

export function parteEstados() {
  const { lista } = especiais();
  const esp = new Map(lista.map((e) => [e.id, e]));
  const pf = pesoFaseItens();
  L('# I) AS 13 PASSIVAS DE ESTADO (o dono: "Stasis, Renascimento, Eco, Furia do Vento, Geada, Rammus...")');
  L('');
  L('  ' + pad('id', 7) + pad('nome', 30) + padl('vpK', 6) + padl('vpY', 6) + pad('papel', 8) + padl('fM', 6) + padl('fC', 6) + padl('motor', 12) + 'o que a extensao faz');
  for (const id of ESTADO_13) {
    const it = ITEM[id];
    const vK = valorPassiva(id, { magia: true, perfil: 'mago' }).v;
    const vY = valorPassiva(id, { magia: false, perfil: 'dano' }).v;
    const e = esp.get(id);
    const mot = idsLidosPeloMotor().get(id) || [];
    const faz = [];
    if (vK > 0 || vY > 0) faz.push('texto=' + Math.round(Math.max(vK, vY)));
    if (e) faz.push('especial(' + e.papel + ')');
    if (pf.mobs[id]) faz.push('faseM ' + pf.mobs[id]);
    if (pf.chefe[id]) faz.push('faseC ' + pf.chefe[id]);
    if (it && it.regen) faz.push('regen ' + it.regen);
    L('  ' + pad(id, 7) + pad(it.nome.slice(0, 29), 30) + padl(Math.round(vK), 6) + padl(Math.round(vY), 6) + pad(e ? e.papel : '-', 8) + padl(pf.mobs[id] || '-', 6) + padl(pf.chefe[id] || '-', 6) + padl(mot.join('/') || '-', 12) + (faz.join(' + ') || 'NADA'));
  }
  L('');
  L('  O QUE FALTA EM CADA UMA (o efeito real, com a linha do motor):');
  const det = {
    '3057': 'Lâmina Encantada: +100% do AD base no ataque depois de uma habilidade (motor.js:18 e motor.js:1672). A extensao so tem o flag x1.25; o AD base do campeao nao entra na conta.',
    '3116': 'Geada: a habilidade deixa o alvo LENTO 1,5 s (motor.js:1208), e a lentidao corta o ataque do monstro para 60% (motor.js:1726). NADA na extensao.',
    '3085': 'Fúria do Vento: +2 inimigos por ataque (55% do dano; 15% a distancia) (motor.js:1718). A extensao tem flag + fase de mobs.',
    '6655': 'Eco: a cada 6 s a proxima habilidade bate em ate 3 por 100 + 10% AP (motor.js:1945-1949). Flag + fase de mobs.',
    '3742': 'Rolo Compressor: +40 de dano no proximo ataque a cada 4 s (motor.js:1698). Flag + fase de mobs.',
    '3102': 'Escudo de Feitiço: bloqueia UM golpe de monstro a cada 40 s (motor.js:2698). Flag so.',
    '3083': 'Coração de Warmog: 15 de vida por segundo (campo regen). O peso do regen e 0.6 -> vale 9 pontos contra 315 do Rabadon.',
    '6610': 'Choque de Luz: o primeiro ataque em cada inimigo e critico e cura 6% da vida perdida (motor.js:1699-1704). Flag + fase de mobs.',
    '3026': 'Renascimento: volta com 50% da vida (motor.js:2729). Flag + fase de chefe. O escudo/reviver nao entra em nenhuma conta de sobrevivencia.',
    '3157': 'Stasis: invulneravel 2,5 s abaixo de 25% de vida (motor.js:2722). Flag + fase de chefe.',
    '6333': 'Ignorar a Dor: 30% do dano vira sangramento e abater cura 15% (motor.js:2701-2704 e 1790). Flag + fase de chefe.',
    '3078': 'Lâmina Encantada x2: +200% do AD base no ataque depois de habilidade (motor.js:1672,1697). Flag so.',
    '3072': 'Escudo Sanguíneo: a cura do rv que passa da vida maxima vira escudo ate 25% (motor.js:1229). Flag so.',
  };
  for (const id of ESTADO_13) L('    ' + id + ' ' + ITEM[id].nome + ': ' + det[id]);
  L('');
  L('  PRECISA DE REGRA DO DONO: o valor de cada uma destas em SEGUNDOS de luta ou em POCOES.');
  L('  Todas tem numero no motor (citado acima), mas nenhuma tem um "peso" que o motor defina - o peso e decisao do dono.');
}

/** Compara as constantes copiadas da extensao com o valor VIVO do motor. */
export function parteHardcodes() {
  L('# J) AS CONSTANTES COPIADAS: qual bate com o motor e qual ja divergiu');
  L('');
  const num = (texto, re, g) => { const m = texto.match(re); return m ? parseFloat(m[g || 1]) : null; };
  const checks = [];
  const add = (nome, autoVal, motVal, ondeAuto, ondeMotor) => checks.push({ nome, autoVal, motVal, ondeAuto, ondeMotor, igual: String(autoVal) === String(motVal) });
  // Q_MULT
  const qm = num(AUTO, /const Q_MULT = \{ C: ([\d.]+), B: ([\d.]+), A: ([\d.]+), S: ([\d.]+), SS: ([\d.]+) \}/);
  const qual = {};
  { const ini = linhaMotor(/^export const QUALIDADES = \{/)[0]; for (let i = ini; i < ini + 8; i++) { const m = /^\s*(\w+): \{ peso: [\d.]+, mult: ([\d.]+)/.exec(MOTOR_L[i - 1] || ''); if (m) qual[m[1]] = +m[2]; } }
  add('Q_MULT.C', qm, qual.C, 'automation.js Q_MULT', 'motor.js:173-179');
  add('Q_MULT.A', num(AUTO, /const Q_MULT = \{ C: [\d.]+, B: [\d.]+, A: ([\d.]+)/), qual.A, 'automation.js Q_MULT', 'motor.js:173-179');
  add('Q_MULT.SS', num(AUTO, /const Q_MULT = \{ C: [\d.]+, B: [\d.]+, A: [\d.]+, S: [\d.]+, SS: ([\d.]+)/), qual.SS, 'automation.js Q_MULT', 'motor.js:173-179');
  add('BONUS_REFINO', num(AUTO, /const BONUS_REFINO = ([\d.]+)/), num(MOTOR, /export const BONUS_REFINO = ([\d.]+)/), 'automation.js BONUS_REFINO', 'motor.js:55');
  add('cap CDR', num(AUTO, /cdr: Math\.min\(([\d.]+), soma\('cdr'\)\)/), num(MOTOR, /reducaoRecarga: Math\.min\(([\d.]+), Math\.min/), 'automation.js:1353', 'motor.js:537');
  add('cap penMag', num(AUTO, /penMag: Math\.min\(([\d.]+), soma\('penMag'\)\)/), num(MOTOR, /ap, penMagica: Math\.min\(([\d.]+), \(tem\('3135'\)/), 'automation.js:1353', 'motor.js:529');
  add('BARRA_SLOTS', num(AUTO, /const BARRA_SLOTS = (\d+)/), num(MOTOR, /export const BARRA = (\d+)/), 'automation.js:64', 'motor.js:900');
  add('RAR_IDX.lendario', num(AUTO, /const RAR_IDX = \{ basico: 0, epico: 1, lendario: (\d+)/), 2, 'automation.js:61', 'motor.js:47');
  add('POCAO_FB.vida.cura', num(AUTO, /const POCAO_FB = \{ vida: \{ cura: (\d+)/), num(MOTOR, /vida:  \{ nome: 'Poção de Vida', tipo: 'vida', cura: (\d+)/), 'automation.js:886', 'motor.js:262');
  add('POCAO_FB.vidaF.cura', num(AUTO, /vidaF: \{ cura: (\d+)/), num(MOTOR, /vidaF: \{ nome: 'Poção de Vida Forte', tipo: 'vida', cura: (\d+)/), 'automation.js:886', 'motor.js:263');
  add('POCAO_FB.vidaS.cura', num(AUTO, /vidaS: \{ cura: (\d+)/), num(MOTOR, /vidaS: \{ nome: 'Poção de Vida Suprema', tipo: 'vida', cura: (\d+)/), 'automation.js:886', 'motor.js:264');
  add('POCAO_FB.vida.preco', num(AUTO, /const POCAO_FB = \{ vida: \{ cura: \d+, preco: (\d+)/), num(MOTOR, /vida:  \{ nome: 'Poção de Vida', tipo: 'vida', cura: \d+, preco: (\d+)/), 'automation.js:886', 'motor.js:262');
  add('MECANICA.investida', num(AUTO, /investida:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'investida'\) fis\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3102');
  add('MECANICA.pancada', num(AUTO, /pancada:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'pancada'\) \{ fis\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3103');
  add('MECANICA.olho', num(AUTO, /olho:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'olho'\) mag\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3104');
  add('MECANICA.sopro', num(AUTO, /sopro:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'sopro'\) \{ mag\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3105');
  add('MECANICA.chuva', num(AUTO, /chuva:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'chuva'\) \{ mag\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3106');
  add('MECANICA.acido', num(AUTO, /acido:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'acido'\) \{ mag\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3108');
  add('MECANICA.tentaculos', num(AUTO, /tentaculos:\s*\{ mult: ([\d.]+)/), num(MOTOR, /if \(tipo === 'tentaculos'\) fis\(([\d.]+)\)/), 'automation.js:1523', 'motor.js:3109');
  add('VA_BASE_MOTOR', num(AUTO, /const VA_BASE_MOTOR = ([\d.]+)/), 0.697, 'automation.js:1457', 'motor.js:2056');
  add('NIVEL_DIF.livre', num(AUTO, /nivelDif \|\| \{ livre: (\d+)/), num(MOTOR, /export const NIVEL_DIF = \{ livre: (\d+)/), 'automation.js fallback', 'motor.js:1184');
  add('NIVEL_DIF.danoMonstro', num(AUTO, /danoMonstro: ([\d.]+)/), num(MOTOR, /danoMonstro: ([\d.]+)/), 'automation.js fallback', 'motor.js:1184');
  add('NIVEL_DIF.maxDanoMonstro', num(AUTO, /maxDanoMonstro: ([\d.]+)/), num(MOTOR, /maxDanoMonstro: ([\d.]+)/), 'automation.js fallback', 'motor.js:1184');
  add('RM_MONSTRO (fallback)', num(AUTO, /numOr\(META\.rmMonstro, ([\d.]+)\)/), num(MOTOR, /export const RM_MONSTRO = ([\d.]+)/), 'automation.js:1019', 'motor.js:1179');
  // KAT_FB vs HAB_KATARINA
  const katQ = { rec0: num(AUTO, /Q: \{ max: 10, rec: \(r\) => ([\d.]+) - 0\.35/), base0: num(AUTO, /Q: \{ max: 10, rec: \(r\) => [\d.]+ - 0\.35 \* \(r - 1\), base: \(r\) => ([\d.]+)/), ratio0: num(AUTO, /base: \(r\) => [\d.]+ \+ 35 \* \(r - 1\), ratio: \(r\) => ([\d.]+)/) };
  add('KAT_FB.Q.rec0', katQ.rec0, 10, 'automation.js:1225', 'motor.js:738 serie(10,-0.35)');
  add('KAT_FB.Q.base0', katQ.base0, 80, 'automation.js:1225', 'motor.js:738 serie(80,35)');
  add('KAT_FB.Q.ratio0', katQ.ratio0, 0.45, 'automation.js:1225', 'motor.js:738 serie(0.45,0.03)');
  const giro = num(AUTO, /let _giro = \{ base: ([\d.]+)/);
  add('_giro.base', giro, 30, 'automation.js:1238', 'motor.js:737');
  add('_giro.nivel', num(AUTO, /let _giro = \{ base: [\d.]+, nivel: ([\d.]+)/), 19, 'automation.js:1238', 'motor.js:737');
  add('_giro.ap', num(AUTO, /let _giro = \{ base: [\d.]+, nivel: [\d.]+, ap: ([\d.]+)/), 1, 'automation.js:1238', 'motor.js:737');
  add('_giro.ad', num(AUTO, /let _giro = \{ base: [\d.]+, nivel: [\d.]+, ap: [\d.]+, ad: ([\d.]+)/), 0.4, 'automation.js:1238', 'motor.js:737');
  // inject.js curva
  add('inject curva.hp[0]', num(INJECT, /meta\.curva = \{ hp: \[([\d.]+)/), num(MOTOR, /hp: \(n\) => \(([\d.]+) \+ 100/), 'inject.js:133', 'motor.js:274');
  add('inject curva.ad[0]', num(INJECT, /ad: \[([\d.]+)/), num(MOTOR, /ad: \(n\) => \(([\d.]+) \+ 4\.8/), 'inject.js:133', 'motor.js:275');
  add('inject curva.armadura[0]', num(INJECT, /armadura: \[([\d.]+)/), num(MOTOR, /armadura: \(n\) => ([\d.]+) \+ 1\.5/), 'inject.js:133', 'motor.js:276');
  add('inject grupoSpawn.base', num(INJECT, /grupoSpawn = \{ base: (\d+)/), num(MOTOR, /const qtd = (\d+) \+ Math\.floor/), 'inject.js:138', 'motor.js:1124');
  add('inject grupoSpawn.rand', num(INJECT, /grupoSpawn = \{ base: \d+, rand: (\d+)/), num(MOTOR, /const qtd = \d+ \+ Math\.floor\(r\(\) \* (\d+)\)/), 'inject.js:138', 'motor.js:1124');
  add('inject respawn.clear', num(INJECT, /respawn = \{ clear: ([\d.]+)/), num(MOTOR, /c\.respawn = ([\d.]+);\s*\}/), 'inject.js:139', 'motor.js:1625');
  add('inject respawn.local', num(INJECT, /respawn = \{ clear: [\d.]+, local: ([\d.]+)/), num(MOTOR, /c\.respawn = ([\d.]+); c\.darius\.recall = 0/), 'inject.js:139', 'motor.js:3046');
  // o motor REMENDA o catalogo em memoria (motor.js:16-26); o inject.js:161 manda o catalogo CRU
  const patch = { '2022': ['cdr', 0.05], '1006': ['regen', 3], '3057': ['efeito', 'x'], '4629': ['cdr', 0.15], '3108': ['cdr', 0.05], '3802': ['cdr', 0.05] };
  L('');
  L('  O CATALOGO QUE A EXTENSAO RECEBE (inject.js:161 manda I.ITENS_DADOS) vs o catalogo do MOTOR (motor.js:16-26):');
  for (const id of Object.keys(patch)) {
    const campo = patch[id][0], val = patch[id][1];
    const cru = ITEM[id][campo];
    L('    ' + id + ' ' + pad(ITEM[id].nome, 28) + campo + ': no catalogo cru = ' + (cru == null ? 'AUSENTE' : cru) + ' | o motor faz Object.assign(' + campo + ' = ' + val + ')');
  }
  let iguais = 0, dif = 0;
  L('  ' + pad('constante', 26) + padl('extensao', 10) + padl('motor', 10) + pad('', 3) + pad('onde (extensao)', 24) + 'onde (motor)');
  for (const c of checks) {
    if (c.igual) iguais++; else dif++;
    L('  ' + pad(c.nome, 26) + padl(c.autoVal == null ? '?' : c.autoVal, 10) + padl(c.motVal == null ? '?' : c.motVal, 10) + pad(c.igual ? ' OK' : ' DIF', 3) + pad(c.ondeAuto, 24) + c.ondeMotor);
  }
  L('');
  L('  RESULTADO: ' + iguais + ' constantes batem com o motor HOJE, ' + dif + ' divergem ou nao foram encontradas.');
  L('  (nenhuma destas ' + checks.length + ' e lida do motor em tempo de execucao: sao copias)');
  L('');
  L('  NAO VERIFICADO: o tierDe (qIdx x 10 + refino) e o multRar 0.30 nao tem equivalente no motor - sao escala nossa.');
}


/** O que acontece se o jogo mexer na CURVA: a extensao nao ve. */
export function parteCurva() {
  L('# K) SE O JOGO BUFFAR A CURVA EM +20% AMANHA');
  L('  inject.js:133 manda os COEFICIENTES copiados: hp [150,100,1], ad [9,4.8,0.13], armadura [5,1.5], xp [30,7], ouro [8,3.5].');
  L('  motor.js:273-279 exporta CURVA com esses mesmos coeficientes HOJE. Um buff muda a funcao, nao a copia.');
  L('  automacao consome esses coeficientes em: automation.js curva() -> statsMonstro() -> avaliar()/estimarRegiao()/planejar().');
  L('');
  const nivel = 29;
  const st = S.statsJogador('katarina', nivel, SNAP_KAT, ATRIB_KAT);
  const linha = (nome, mob) => {
    const real = statsMonstro(mob.nome, mob.nivel);
    const est = Object.assign({}, real, { hpMax: real.hpMax / 1.2, ad: real.ad / 1.2 });
    const incR = S.mit(real.ad, real.magico ? st.rm : st.armadura) * S.fatorDanoMonstro(nivel, real.nivel) * 0.75 * real.as;
    const incE = S.mit(est.ad, real.magico ? st.rm : st.armadura) * S.fatorDanoMonstro(nivel, real.nivel) * 0.75 * real.as;
    L('  ' + pad(nome, 26) + padl(Math.round(real.hpMax), 8) + padl(Math.round(est.hpMax), 8) + padl(Math.round(real.ad), 7) + padl(Math.round(est.ad), 7) + padl(Math.round(incR), 8) + padl(Math.round(incE), 8) + padl((100 * (1 - incE / incR)).toFixed(0) + '%', 7));
  };
  L('  ' + pad('alvo', 26) + padl('hp real', 8) + padl('hp visto', 8) + padl('ad real', 7) + padl('ad visto', 7) + padl('toma/s', 8) + padl('acha/s', 8) + padl('erro', 7));
  for (const l of parseLocais()) {
    const g = grupoDaRegiao(l, nivel);
    linha(l.nome + ' (' + l.monstros[0].nome + ')', { nome: l.monstros[0].nome, nivel: Math.round(g.nivel) });
  }
  for (const nome of ['Arauto do Vale', 'Dragão Infernal', 'Barão Nashor']) {
    const nm = nome === 'Arauto do Vale' ? [25, 33] : nome === 'Dragão Infernal' ? [30, 38] : [40, 48];
    linha(nome, { nome, nivel: S.nivelDoChefe(nm, nivel) });
  }
  L('');
  L('  Com CURVA +20%, a extensao SUBESTIMA a vida e o dano do monstro em 1 - 1/1.2 = 16.7%.');
  L('  Consequencia directa: (a) o tempo de abate previsto fica 16,7% curto; (b) o dano recebido previsto fica 16,7% baixo');
  L('  -> o numero de pocoes que a extensao compra fica 16,7% baixo e a decisao "sobrevive?" pode inverter.');
  L('  O CAMINHO CORRECTO (o inject.js corre no mundo MAIN e PODE chamar as funcoes):');
  L('    meta.curvaPorNivel = {}; for (let n = 1; n <= M.NIVEL_MAX; n++) meta.curvaPorNivel[n] = { hp: M.CURVA.hp(n), ad: M.CURVA.ad(n), armadura: M.CURVA.armadura(n), xp: M.CURVA.xp(n), ouro: M.CURVA.ouro(n) };');
  L('  M.CURVA ESTA exportada (motor.js:273) e M.NIVEL_MAX tambem (motor.js:27) -> o inject.js consegue chamar as duas.');
  L('  CURVA usa ajuste(n) (motor.js:272) que le BALANCO (motor.js:10) - e o BALANCO ja vai no meta.balanco (inject.js:160).');
  L('  grupoSpawn: qtd = 2 + floor(rand*3) e INLINE em motor.js:1124 (nao e constante exportada) -> so sai por leitura de texto ou por uma constante nova no motor.');
  L('  respawn: c.respawn = 1.5 (motor.js:1625) e 1.2 (motor.js:3046) tambem INLINE.');
}

const direto = process.argv[1] && /audit-math\.mjs$/.test(process.argv[1]);
const arg = process.argv[2] || 'tudo';
const partes = arg === 'tudo' ? ['inventario', 'rv', 'voracidade', 'divergencia', 'regioes', 'niveis', 'rvponto', 'estados', 'hardcodes', 'curva'] : [arg];
if (direto) relatorio(partes);
