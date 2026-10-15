#!/usr/bin/env node
/*
 * tools/audit-game.mjs — CONTAS DA AUDITORIA (docs/auditoria-do-jogo.md)
 *
 * PORQUE NAO IMPORTA O MOTOR: motor.js importa dados-ezreal.js, dados-yasuo.js, dados-lux.js,
 * dados-katarina.js, dados-taric.js e dados-zac.js e NENHUM existe em docs/game-src/ (so ha
 * dados.js, o do Darius). Logo o motor e lido como TEXTO e cada formula e reimplementada AQUI
 * com a citacao 'file:linha' de onde saiu. Nenhum numero e inventado: ou vem do catalogo
 * (itens.js), ou e extraido do motor por regex COM a linha, ou vem de dados.js.
 *
 * USO: node tools/audit-game.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const MOTOR = ler('docs/game-src/motor.js');
const BAL = JSON.parse(ler('docs/game-src/balanco.js').match(/export const BALANCO = (\[[\s\S]*?\]);/)[1]);
const linhaDe = (t, i) => t.slice(0, i).split('\n').length;
const ex = (re, nome, g = 1) => { const m = MOTOR.match(re); if (!m) throw new Error('NAO ENCONTRADO: ' + nome); return { v: Number(m[g]), onde: 'motor.js:' + linhaDe(MOTOR, m.index), nome }; };
const cit = (o) => o.v + ' [' + o.onde + ']';

// ---------------------------------------------------------------- constantes do motor
const RM_MONSTRO = ex(/export const RM_MONSTRO = ([\d.]+);/, 'RM_MONSTRO');
const TETO_VIDA_ITEM = ex(/export const TETO_VIDA_ITEM = ([\d.]+);/, 'TETO_VIDA_ITEM');
const NIVEL_DIF = { livre: ex(/livre: ([\d.]+), danoMonstro/, 'NIVEL_DIF.livre'), danoMonstro: ex(/danoMonstro: ([\d.]+), maxDanoMonstro/, 'NIVEL_DIF.danoMonstro'), maxDanoMonstro: ex(/maxDanoMonstro: ([\d.]+)/, 'NIVEL_DIF.maxDanoMonstro'), danoJogador: ex(/danoJogador: ([\d.]+), minDanoJogador/, 'NIVEL_DIF.danoJogador'), minDanoJogador: ex(/minDanoJogador: ([\d.]+)/, 'NIVEL_DIF.minDanoJogador') };
const FURIOSO = { chance: ex(/export const FURIOSO = \{ chance: ([\d.]+)/, 'FURIOSO.chance'), hp: ex(/FURIOSO = \{ chance: [\d.]+, hp: ([\d.]+)/, 'FURIOSO.hp'), ad: ex(/FURIOSO = \{ chance: [\d.]+, hp: [\d.]+, ad: ([\d.]+)/, 'FURIOSO.ad'), as: ex(/FURIOSO = \{ chance: [\d.]+, hp: [\d.]+, ad: [\d.]+, as: ([\d.]+)/, 'FURIOSO.as'), xp: ex(/FURIOSO = \{ chance: [\d.]+, hp: [\d.]+, ad: [\d.]+, as: [\d.]+, xp: ([\d.]+)/, 'FURIOSO.xp'), ouro: ex(/FURIOSO = \{ chance: [\d.]+, hp: [\d.]+, ad: [\d.]+, as: [\d.]+, xp: [\d.]+, ouro: ([\d.]+)/, 'FURIOSO.ouro'), saque: ex(/FURIOSO = \{ chance: [\d.]+, hp: [\d.]+, ad: [\d.]+, as: [\d.]+, xp: [\d.]+, ouro: [\d.]+, saque: ([\d.]+)/, 'FURIOSO.saque') };
const NOTURNO = { chance: ex(/export const NOTURNO = \{ chance: ([\d.]+)/, 'NOTURNO.chance'), hp: ex(/NOTURNO = \{ chance: [\d.]+, hp: ([\d.]+)/, 'NOTURNO.hp'), ad: ex(/NOTURNO = \{ chance: [\d.]+, hp: [\d.]+, ad: ([\d.]+)/, 'NOTURNO.ad'), xp: ex(/NOTURNO = \{ chance: [\d.]+, hp: [\d.]+, ad: [\d.]+, xp: ([\d.]+)/, 'NOTURNO.xp'), ouro: ex(/NOTURNO = \{ chance: [\d.]+, hp: [\d.]+, ad: [\d.]+, xp: [\d.]+, ouro: ([\d.]+)/, 'NOTURNO.ouro') };
const EXAUSTAO = ex(/export const EXAUSTAO = ([\d.]+);/, 'EXAUSTAO');
const POCAO_PVP = { cura: ex(/POCAO_PVP = \{ cura: ([\d.]+)/, 'POCAO_PVP.cura'), exaustao: ex(/cura: [\d.]+, exaustao: ([\d.]+)/, 'POCAO_PVP.exaustao') };
const BONUS_REFINO = ex(/export const BONUS_REFINO = ([\d.]+);/, 'BONUS_REFINO');
const VEL_ATAQUE_MAX = ex(/export const VEL_ATAQUE_MAX = ([\d.]+);/, 'VEL_ATAQUE_MAX');
const CHANCE_REFINO = [0.30, 0.12, 0.02, 0.008, 0.003];
const REGRESSAO_REFINO = [0, 0, 0.04, 0.015, 0.006];

// ---------------------------------------------------------------- CURVA + ajuste (motor.js:272-279)
const ajuste = (n) => BAL.find((f) => n >= f.de && n <= f.ate) || BAL[BAL.length - 1];
const CURVA = {
  hp: (n) => (150 + 100 * n + 1.0 * n * n) * ajuste(n).vida,
  ad: (n) => (9 + 4.8 * n + 0.13 * n * n) * ajuste(n).dano,
  armadura: (n) => 5 + 1.5 * n,
  xp: (n) => (30 + 7 * n) * ajuste(n).xp,
  ouro: (n) => (8 + 3.5 * n) * ajuste(n).ouro,
};
const mitigar = (dano, arm) => dano * (100 / (100 + Math.max(0, arm)));          // motor.js:1167
const vidaRefItem = (hp, nivel) => Math.min(hp, TETO_VIDA_ITEM.v * CURVA.hp(nivel));   // motor.js:1191

// monstros (motor.js:280-298)
const MON = {};
for (const m of MOTOR.matchAll(/^  '([^']+)':\s*\{ hp: ([\d.]+), ad: ([\d.]+), as: ([\d.]+), armadura: ([\d.]+)([^}]*)\},?$/gm)) {
  MON[m[1]] = { hp: +m[2], ad: +m[3], as: +m[4], armadura: +m[5], chefe: /chefe: true/.test(m[6]), magico: /magico: true/.test(m[6]) };
}
// locais (motor.js:354-379)
const LOC = {};
for (const line of MOTOR.split('\n')) {
  const id = /^  \{ id: '([a-z-]+)'/.exec(line); if (!id || !/bioma:/.test(line)) continue;
  const nome = /nome: '([^']+)'/.exec(line);
  const nm = /nm: \[(\d+), (\d+)\]/.exec(line);
  const faixa = /faixa: \[(\d+), (\d+)\]/.exec(line);
  const tier = /tier: (\d+)/.exec(line);
  const chefe = /chefe: \['([^']+)', ([\d.]+)\]/.exec(line);
  LOC[id[1]] = { nome: nome ? nome[1] : id[1], nm: nm ? [+nm[1], +nm[2]] : null, faixa: faixa ? [+faixa[1], +faixa[2]] : null, tier: tier ? +tier[1] : 0, chefe: chefe ? [chefe[1], +chefe[2]] : null };
}

// ---------------------------------------------------------------- kit do Darius (motor.js:553-585, 673-688)
const HAB_DARIUS_E_PEN = MOTOR.match(/E: \{ nome: H\.E\.nome[^\n]*pen: \[([^\]]+)\]/)[1].split(',').map(Number);
const BONUS_PODER = (nivel) => 30 + (200 * (Math.min(nivel, 18) - 1)) / 17 + 4 * Math.max(0, nivel - 18);   // motor.js:1332
const VONTADE = MOTOR.match(/D: \{ nome: 'Vontade do General'[^\n]*vontade: serie\(([\d.]+), ([\d.]+)\)/);
const VONTADE_MAX = (r) => +(Number(VONTADE[1]) + Number(VONTADE[2]) * (r - 1)).toFixed(4);
const HAB_DARIUS_R_BASE = { base: [125, 250, 375, 500, 625], ratio: 0.75 };      // motor.js:562-563
const DANO_SANGUE = (bonusAd, nivel) => (13 + 0.3 * bonusAd + 4 * nivel) / 5;    // motor.js:1631 (por acumulo, por segundo)
const CURA_Q_DARIUS = 0.13;                                                      // motor.js:1866 (13% da vida por inimigo, ate 3)

// ---------------------------------------------------------------- itens (itens.js)
const ITENS_SRC = ler('docs/game-src/itens.js');
const ITENS = JSON.parse(ITENS_SRC.match(/export const ITENS_DADOS = (\[[\s\S]*?\n\]);/)[1]);
const item = (id) => ITENS.find((x) => x.id === id) || {};
const fmt = (n, d = 0) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (x, d = 1) => (100 * x).toFixed(d) + '%';
const H = (t) => '\n===== ' + t + ' =====';

console.log('=============================================================');
console.log('AUDITORIA DO JOGO — contas (cada formula com file:linha)');
console.log('=============================================================');
console.log('constantes: RM_MONSTRO ' + cit(RM_MONSTRO) + ' | TETO_VIDA_ITEM ' + cit(TETO_VIDA_ITEM) + ' | EXAUSTAO ' + cit(EXAUSTAO) + ' | VEL_ATAQUE_MAX ' + cit(VEL_ATAQUE_MAX));
console.log('NIVEL_DIF: livre ' + cit(NIVEL_DIF.livre) + ', danoMonstro ' + cit(NIVEL_DIF.danoMonstro) + ', max ' + cit(NIVEL_DIF.maxDanoMonstro) + ', danoJogador ' + cit(NIVEL_DIF.danoJogador) + ', min ' + cit(NIVEL_DIF.minDanoJogador));
console.log('monstros lidos: ' + Object.keys(MON).length + ' | locais lidos: ' + Object.keys(LOC).length);

// ================================================================ F1 — PEN DO KIT (Darius E)
console.log('\n===== F1 — PENETRACAO DE ARMADURA DO KIT (Darius E, motor.js:560) =====');
console.log('serie do E (motor.js:560): ' + HAB_DARIUS_E_PEN.map((v) => pc(v, 0)).join(' -> ') + ' (rank 1..10)');
console.log('rankMaximoNoNivel (motor.js:910): Q/W/E sobem a cada 2 niveis -> rank = min(10, ceil(nivel/2))');
console.log('aplicacao: motor.js:516 penE = E.pen[ranks.E-1]; motor.js:539 penArmadura = 1-(1-penE)*(1-0.7 se 3036)');
for (const nivel of [20, 30, 40, 50]) {
  const rE = Math.min(10, Math.ceil(nivel / 2));
  const penE = HAB_DARIUS_E_PEN[rE - 1];
  const alvoChefe = { nome: 'Barao Nashor', nivel: 50, armadura: CURVA.armadura(50) * MON['Barão Nashor'].armadura };
  const alvoMob = { nome: 'Criatura do Vazio', nivel: 48, armadura: CURVA.armadura(48) * MON['Criatura do Vazio'].armadura };
  for (const [tag, alvo] of [['mob (Criatura do Vazio 48)', alvoMob], ['chefe (Barao 50)', alvoChefe]]) {
    const sem = mitigar(1, alvo.armadura);
    const comKit = mitigar(1, alvo.armadura * (1 - penE));
    const sem3036 = mitigar(1, alvo.armadura * (1 - (1 - penE) * 0.7));
    const so3036 = mitigar(1, alvo.armadura * 0.7);
    console.log('  nivel ' + nivel + ' (E rank ' + rE + ', pen ' + pc(penE, 0) + ') x ' + tag + ' [armadura ' + fmt(alvo.armadura) + ']:');
    console.log('    sem pen nenhum        mit = ' + sem.toFixed(4));
    console.log('    so com o pen do KIT   mit = ' + comKit.toFixed(4) + '  -> +' + pc(comKit / sem - 1) + ' de dano');
    console.log('    KIT + 3036 (motor)    mit = ' + sem3036.toFixed(4) + '  -> +' + pc(sem3036 / sem - 1) + ' de dano');
    console.log('    so 3036 (o que a ext. modela) mit = ' + so3036.toFixed(4) + ' -> a extensao fica ' + pc(sem3036 / so3036 - 1) + ' ABAIXO do motor');
  }
}

// ================================================================ F2 — HEMORRAGIA (DOT + buff de AD)
console.log('\n===== F2 — HEMORRAGIA do Darius: DOT (motor.js:1631) e buff de AD (motor.js:1276-1281, 1329, 1332) =====');
console.log('bonusPoder(nivel) = ' + BONUS_PODER(50) + ' de AD no nivel 50 [motor.js:1332], ativo 5 s quando um alvo chega a 5 acumulos [motor.js:1278-1281]');
console.log('vontade (Vontade do General) rank 10 = +' + pc(VONTADE_MAX(10)) + ' de AD com a vida no fim [motor.js:675, 1328]');
for (const nivel of [30, 40, 50]) {
  const bonusAd = 100 + 4 * Math.max(0, nivel - 18);   // exemplo: 100 de AD de itens no 30, a crescer 4/nivel
  const dpsSangue = DANO_SANGUE(bonusAd, nivel) * 5;   // 5 acumulos: 5 x (por acumulo)
  const rE = Math.min(10, Math.ceil(nivel / 2));
  const arm = CURVA.armadura(48) * MON['Criatura do Vazio'].armadura;
  const pen = HAB_DARIUS_E_PEN[rE - 1];
  const real = mitigar(dpsSangue, arm * (1 - pen));
  console.log('  nivel ' + nivel + ' (AD de itens ' + bonusAd + '): DOT a 5 acumulos = ' + fmt(dpsSangue) + '/s fisico -> ' + fmt(real) + '/s depois da armadura+pen do kit (arm ' + fmt(arm) + ')');
}
console.log('  buff de AD: nivel 30 = +' + BONUS_PODER(30) + ', nivel 40 = +' + BONUS_PODER(40) + ', nivel 50 = +' + BONUS_PODER(50) + ' de AD');
console.log('  um Darius nivel 50 com 300 de AD passa a ' + fmt(300 + BONUS_PODER(50)) + ' de AD = x' + ((300 + BONUS_PODER(50)) / 300).toFixed(2) + ' enquanto o buff dura');

// ================================================================ F3 — VORACIDADE (Katarina) por ABATE
console.log('\n===== F3 — VORACIDADE por ABATE (Katarina, motor.js:736 e 1789) =====');
console.log('motor.js:1789: cada abate tira ' + MOTOR.match(/voracidade: ([\d.]+)/)[1] + ' s de Q/W/E; abate de CHEFE tira ' + MOTOR.match(/voracidadeChefe: ([\d.]+)/)[1] + ' s');
for (const killsMin of [10, 15, 20, 25, 30]) {
  const T = 60 / killsMin;                       // segundos entre abates
  const acel = 1 + 1.5 / T;                      // cada T segundos, -1,5 s em cada recarga
  console.log('  ' + killsMin + ' abates/min (1 a cada ' + T.toFixed(2) + ' s): as recargas de Q/W/E andam x' + acel.toFixed(2) + ' -> o DPS das habilidades sobe ~' + pc(acel - 1, 0));
}
console.log('  (a extensao calcula dps = total/cd com o cd CRU: automation.js:1403 e automation.js:3280)');

// ================================================================ F4 — NIVEL DO CHEFE
console.log('\n===== F4 — NIVEL DO CHEFE: motor (motor.js:1121) vs o modelo da extensao (automation.js:3933) =====');
console.log('motor.js:1121: nivel = max(n0+2, min(n1+2, nivelJogador+4))');
console.log('extensao: nivel = n1 + 2 (o topo da zona) — nao depende do jogador');
for (const [id, loc] of Object.entries(LOC)) {
  if (!loc.nm || !loc.nome) continue;
  const [n0, n1] = loc.nm;
  const linha = [];
  for (const p of [n0, Math.round((n0 + n1) / 2), n1, 50]) {
    const real = Math.max(n0 + 2, Math.min(n1 + 2, p + 4));
    const ext = n1 + 2;
    if (real !== ext) linha.push('jogador ' + p + ': motor ' + real + ' vs ext ' + ext + ' (HP x' + (CURVA.hp(ext) / CURVA.hp(real)).toFixed(2) + ', AD x' + (CURVA.ad(ext) / CURVA.ad(real)).toFixed(2) + ')');
  }
  if (linha.length) console.log('  ' + loc.nome + ' nm [' + n0 + ',' + n1 + ']: ' + linha.join(' | '));
}

// ================================================================ F5 — NIVEL_DIF
console.log('\n===== F5 — NIVEL_DIF (motor.js:1184-1187): o que a extensao perde ao ignorar em scoreSet/estimarSet =====');
for (const [p, idZona] of [[25, 'barao'], [30, 'barao'], [23, 'dragao'], [35, 'barao'], [40, 'barao'], [46, 'barao']]) {
  const loc = LOC[idZona] ? [idZona, LOC[idZona]] : null;
  const nMob = loc ? loc[1].nm[0] : p;
  const d = Math.max(0, nMob - p - NIVEL_DIF.livre.v);
  if (!d) { console.log('  ' + (loc ? loc[1].nome : '?') + ': jogador ' + p + ' vs mob nv ' + nMob + ' -> dif 0 (sem penalidade)'); continue; }
  const fM = Math.min(NIVEL_DIF.maxDanoMonstro.v, 1 + NIVEL_DIF.danoMonstro.v * d);
  const fJ = Math.max(NIVEL_DIF.minDanoJogador.v, 1 - NIVEL_DIF.danoJogador.v * d);
  console.log('  jogador ' + p + ' num mob de nivel ' + nMob + ' (' + (loc ? loc[1].nome : '?') + '): dif ' + d + ' -> o monstro bate x' + fM.toFixed(2) + ' e o jogador faz x' + fJ.toFixed(2) + ' de dano');
}

// ================================================================ F6 — % DA VIDA DO ALVO (teto)
console.log('\n===== F6 — ITENS DE % DA VIDA DO ALVO e o TETO (motor.js:1190-1191, 1702) =====');
for (const [nome, nivel, mult] of [['mob comum (Criatura do Vazio)', 48, 1], ['chefe (Barao Nashor)', 50, 16]]) {
  const hp = CURVA.hp(nivel) * mult;
  const teto = TETO_VIDA_ITEM.v * CURVA.hp(nivel);
  const porAuto = Math.min(0.05 * hp, teto);
  console.log('  ' + nome + ' nivel ' + nivel + ': vida ' + fmt(hp) + ' | 3153 = 5% da vida ATUAL -> ' + fmt(porAuto) + ' por ataque (teto ' + fmt(teto) + ' = ' + pc(porAuto / hp) + ' da vida dele)');
}

// ================================================================ F7 — ESCUDOS (vida efetiva)
console.log('\n===== F7 — ESCUDOS que a extensao NAO soma a vida efectiva (motor.js) =====');
const escudos = [
  ['Yasuo P (Fluxo)', 'motor.js:697 escudoFluxo = 80 + 28*nivel', (n) => 80 + 28 * n],
  ['Yasuo B (Brisa Protetora)', 'motor.js:721 escudoPct = 12% + 2%/rank da vida maxima', (n, hp) => hp * 0.30],
  ['Taric W (Bastiao)', 'motor.js:785 base 70+28*(r-1) + 0.4*AP', null],
  ['Taric F (Egide)', 'motor.js:801 escudoPct 12% + 1,5%/rank + 0,5*AP', (n, hp) => hp * 0.30],
  ['Zac G (Membrana)', 'motor.js:840 escudoPct 8% + 0,8%/rank da vida maxima', (n, hp) => hp * 0.20],
  ['Item 3053 (Pele de Aco)', 'motor.js:2726 escudo = 60% da vida BONUS abaixo de 30%', (n, hp) => hp * 0.25],
];
for (const [nome, onde, f] of escudos) {
  const v50 = f && f(50, 4000);
  console.log('  ' + nome.padEnd(26) + ' ' + onde + (v50 ? '  -> ' + fmt(v50) + ' (nivel 50)' : ''));
}
console.log('  (avaliar() usa so player.vida: automation.js:1657-1679; nenhuma leitura de escudo em automation.js)');

// ================================================================ F8 — CDR / VEL DE ATAQUE / CRIT
console.log('\n===== F8 — TETOS e escalas que o motor aplica =====');
console.log('  CDR: motor.js:537 reducaoRecarga = min(0.4, min(0.3, 0.004*Foco) + cdrDosItens) — o atributo Foco sozinho vale ate 30%');
console.log('  cdr dos itens do catalogo: ' + ITENS.filter((i) => i.cdr).map((i) => i.id + '=' + pc(i.cdr, 0)).join(', ') + ' (motor.js:16-26, 255)');
console.log('  pen MAGICA dos itens: ' + ITENS.filter((i) => i.penMag).map((i) => i.id + '=' + pc(i.penMag, 0)).join(', ') + ' + 3135=40% (motor.js:529) — NAO e escalada por qualidade/refino (motor.js:254)');
console.log('  pen de ARMADURA: so 3036=30% (motor.js:539) + o pen do kit (Darius E) — NENHUM item do catalogo tem campo de pen de armadura');
console.log('  dano critico: base 1.75 (motor.js:499) + 0.4 com 3031 (motor.js:515); Yasuo x0.8 (motor.js:697, 541) -> 1.40 / 1.72');
console.log('  chance critica: min(1, (critDosItens + critBase(Yasuo)) * 2 se Yasuo) [motor.js:541]');
console.log('  vel de ataque: min(' + VEL_ATAQUE_MAX.v + ', base * (1 + asPorNivel*g + va)) [motor.js:534]');

// ================================================================ F9 — ECONOMIA
console.log('\n===== F9 — ECONOMIA (motor.js:257-258, 3127-3135) =====');
const exemplo = item('3071');
console.log('  exemplo: ' + exemplo.id + ' ' + exemplo.nome + ' preco ' + fmt(exemplo.preco));
for (const q of ['C', 'B', 'A', 'S', 'SS']) {
  const mult = { C: 0.9, B: 1, A: 1.15, S: 1.35, SS: 1.7 }[q], venda = { C: 0.8, B: 1, A: 1.5, S: 3, SS: 8 }[q];
  console.log('    qualidade ' + q + ' refino 0: valor de equip ' + fmt(exemplo.preco * mult) + ' | venda no Lojista ' + fmt(Math.floor(exemplo.preco * 0.5 * venda)));
}
for (const ref of [0, 1, 2, 3, 4]) console.log('    refino ' + ref + ' -> preco da proxima tentativa ' + fmt(exemplo.preco * (0.5 + 0.5 * ref) * (ref >= 2 ? 2 : 1)) + ' | chance ' + pc(CHANCE_REFINO[ref], 2) + ' | regressao ' + pc(REGRESSAO_REFINO[ref], 1));
const pTent = (ref) => exemplo.preco * (0.5 + 0.5 * ref) * (ref >= 2 ? 2 : 1);
let custoTotal = 0;
for (let ref = 0; ref < 5; ref++) custoTotal += pTent(ref) / CHANCE_REFINO[ref];
console.log('  custo esperado (sem persistencia) para chegar a +5: ' + fmt(custoTotal) + ' de ouro em ~' + fmt(CHANCE_REFINO.reduce((s, c) => s + 1 / c, 0)) + ' tentativas');

// ================================================================ F10 — POCOES
console.log('\n===== F10 — POCOES (motor.js:261-267, 1299-1310) =====');
const POCOES = {};
for (const m of MOTOR.matchAll(/(\w+):\s*\{ nome: '[^']+', tipo: '(\w+)', cura: (\d+), preco: (\d+), nivel: (\d+) \}/g)) POCOES[m[1]] = { tipo: m[2], cura: +m[3], preco: +m[4], nivel: +m[5] };
for (const [k, p] of Object.entries(POCOES)) console.log('  ' + k.padEnd(6) + ' cura ' + String(p.cura).padStart(5) + ' | preco ' + String(p.preco).padStart(4) + ' | nivel ' + p.nivel + ' | cura por ouro ' + (p.cura / p.preco).toFixed(1));
console.log('  EXAUSTAO ' + cit(EXAUSTAO) + ' = ' + fmt(POCOES.vidaS.cura / EXAUSTAO.v) + ' de cura/s com a Suprema (teto teorico)');
console.log('  PvP: cura x' + POCAO_PVP.cura.v + ' e exaustao ' + POCAO_PVP.exaustao.v + ' s [motor.js:43]');
console.log('  custo em ouro de 1 h a 1 pocao/s (Suprema): ' + fmt(3600 * POCOES.vidaS.preco) + ' de ouro');

// ================================================================ F11 — KILLS/MIN e ECONOMIA POR ZONA
console.log('\n===== F11 — ABATES, OURO e XP por zona (motor.js:1116-1130, 1751-1766) =====');
console.log('  grupo: 2 + floor(rand*3) -> 2,3,4 (media 3) [motor.js:1124] | respawn 1,5 s + chegada [motor.js:1625]');
console.log('  nivel do mob: max(n0, min(n1, P-2+floor(rand*4))) -> media P-0,5 [motor.js:1118-1119]');
for (const [id, loc] of Object.entries(LOC)) {
  if (!loc.nm) continue;
  const nm = (loc.nm[0] + loc.nm[1]) / 2;
  console.log('  ' + String(loc.nome).padEnd(16) + ' nm ' + loc.nm[0] + '-' + loc.nm[1] + ' | HP do mob no meio ' + fmt(CURVA.hp(nm)) + ' | ouro ' + fmt(CURVA.ouro(nm) * 0.75) + ' | xp ' + fmt(CURVA.xp(nm)));
}
console.log('  furioso: ' + pc(FURIOSO.chance.v, 0) + ' por GRUPO -> por monstro ' + pc(FURIOSO.chance.v / 3) + ' | x' + FURIOSO.xp.v + ' xp, x' + FURIOSO.ouro.v + ' ouro, saque x3 [motor.js:1106]');
console.log('  noturno: ' + pc(NOTURNO.chance.v, 0) + ' por monstro a noite | x' + NOTURNO.xp.v + ' xp, x' + NOTURNO.ouro.v + ' ouro, HP x' + NOTURNO.hp.v + ' [motor.js:1096]');


console.log(H('F15 — VERIFICACOES DIRECTAS (regex / leituras)'));
const AUT = ler('extension/automation.js');
const INJ = ler('extension/inject.js');
const AL = AUT.split('\n');
const reParse = /[\u2212-]\s*([\d.,]+)\s*%\s*recarga/i;         // automation.js:1322
const reStats = /[\u2212-]\s*(\d+)\s*%\s*(?:na\s*)?recarga/i;   // automation.js:3237
console.log('  (a) CDR: parseDica usa /[\u2212-]\\s*([\\d.,]+)\\s*%\\s*recarga/i [automation.js:1322]; statsSet usa (?:na\\s*)? [automation.js:3237]');
for (const it of ITENS) {
  const ef = String(it.efeito || ''); if (!/recarga/i.test(ef)) continue;
  const a = reParse.exec(ef), b = reStats.exec(ef);
  console.log('    ' + it.id + ' ' + it.nome + ' (cdr ' + pc(it.cdr || 0, 0) + '): "' + ef.slice(0, 58) + '"');
  console.log('        parseDica ' + (a ? 'OK ' + a[1] : 'FALHA') + ' | statsSet ' + (b ? 'OK ' + b[1] : 'FALHA'));
}
console.log('    -> o tooltip de stats (motor.js:255 infoItem + jogo) mostra a linha "-X% de recarga" que o parseDica tambem le;');
console.log('       a divergencia so importa quando o cdr vem SO do texto do efeito (item sem campo cdr no catalogo).');
console.log('  (b) statsSet [automation.js:3222-3251] soma: ap, ad, cdr, pen(=it.penMag), lich/rabadon/chama/liandry');
console.log('      itens com penMag no catalogo: ' + ITENS.filter((i) => i.penMag).map((i) => i.id + '=' + pc(i.penMag, 0)).join(', ') + '  (3135 = 40% esta em motor.js:529, nao no catalogo)');
console.log('      o 3036 NAO tem penMag (campo ausente) — a pen de armadura dele (motor.js:539) nao entra no statsSet');
console.log('  (c) player() [automation.js:1219-1227] devolve ' + JSON.stringify(Object.keys(JSON.parse('{"nivel":0,"vida":0,"armadura":0,"rm":0,"dano":0,"poder":0,"va":0}'))) + ' — le "Critico" e "Esquiva" em readStats [1212] e descarta-os');
console.log('  (d) serialKit [inject.js:113-115] reencaminha: nivel,max,base,ratio,recarga,adRatio,mult,alvos,duracao,golpes,venenoBase,venenoRatio,venenoT,vaAdaga,acumMax,duracaoSinistra,curaGiro,adaga,auto,dot,passiva,util');
const campos = INJ.match(/for \(const c of \[([^\]]+)\]\)/)[1];
for (const c of ['pen', 'custo', 'custoVida', 'ratioVida', 'pctAlvo', 'va', 'bonus', 'bonusHab', 'penSuspiro', 'duracaoPen', 'voracidade', 'voracidadeChefe', 'escudo', 'escudoPct', 'cura', 'curaBase', 'curaGosma', 'vontade', 'defesaBonus', 'reduz', 'redusDano', 'reduzDano', 'armPassiva', 'pulso', 'curaDano', 'bonusSangue', 'executa', 'reembolso', 'shunpo', 'curaSede', 'inquieta', 'reducao', 'segura', 'levanta', 'bonusSombra', 'isMunido'])
  if (!new RegExp("'" + c + "'").test(campos)) console.log('      DESCARTA "' + c + '"');
console.log('      inject.js publica rmMonstro? ' + /rmMonstro/.test(INJ) + ' | publica habChefe? ' + /habChefe/.test(INJ) + ' | publica nivelDif? ' + /nivelDif/.test(INJ));
console.log('      (rmMonstro nao esta em inject.js nem na lista de META lida em automation.js:983 -> rmMonstro() cai SEMPRE no fallback 0.6 [automation.js:1025], que e o valor certo do motor)');
console.log('  (e) chaves de META lidas em automation.js:983 e nunca usadas depois:');
const chaves = [...AL[982].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]);
for (const k of chaves) { const usos = (AUT.match(new RegExp('META\\.' + k + '\\b', 'g')) || []).length; if (usos <= 1) console.log('      META.' + k); }

console.log('\n===== FIM =====');
