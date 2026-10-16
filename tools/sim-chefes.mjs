/*
 * Simulador de CHEFES a partir do MOTOR do jogo (motor.js).
 *
 * Modela a luta contra um chefe com as mecânicas REAIS:
 *  - ataque básico a cada 1/as (físico ou mágico);
 *  - rodízio de mecânicas (RODIZIO_CHEFE) a cada `espera` s, cada uma com
 *    `carrega` s de AVISO (o balão no canvas) e um multiplicador de dano.
 *
 * Roda a smart de poção contra cada chefe e diz se sobrevive / quantas poções.
 *
 * Fonte dos números: motor.js (MONSTROS, CURVA, HAB_CHEFE, RODIZIO_CHEFE,
 * mecanicaChefe, inimigoAtaca) e cena.js (textos do balão).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// catálogo REAL de itens (itens.js:3) e a planilha de balanço (balanco.js:2) — dados puros, sem DOM
import { ITENS_DADOS } from '../docs/game-src/itens.js';
import { BALANCO } from '../docs/game-src/balanco.js';
// O MOTOR VIVO (tools/motor-vivo.mjs): todas as tabelas daqui saem LIDAS de
// docs/game-src/motor.js — nenhuma é copiada à mão (REGRA N.o 3 do AGENTS.md).
import { M, MULT_CHEFE, QUEIMA_CHEFE, BALAO_CENA, BASE_CAMPEAO as BASE_CAMPEAO_LIDA, TABELAS } from './motor-vivo.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));

// ---- dados do motor — LIDOS de docs/game-src/motor.js, nunca copiados (REGRA N.o 3) ----
// Antes este bloco tinha cópias à mão de CURVA, MONSTROS, NIVEL_DIF e RODIZIO — e a cópia da
// CURVA nem tinha o `ajuste(n)` da planilha de balanço (motor.js:282): um buff
// na curva passava em claro, que é exactamente o defeito que o AGENTS.md proíbe. Os números
// agora vêm de tools/motor-vivo.mjs, partilhado por todos os simuladores do repo.
const CURVA = M.CURVA;                                    // motor.js:282 (já com ajuste)
export const MONSTROS = M.MONSTROS;                              // motor.js:289
export const NIVEL_DIF = M.NIVEL_DIF;                            // motor.js:1199
export const RODIZIO = M.RODIZIO_CHEFE;                          // motor.js:3103
// carrega/espera vêm de HAB_CHEFE (motor.js:3092); o MULT e a QUEIMA estão
// INLINE em mecanicaChefe (motor.js:3104+) e são LIDOS do texto em
// tools/motor-vivo.mjs — não digitados aqui.
export const HAB = Object.fromEntries(Object.entries(M.HAB_CHEFE).map(([k, v]) => [k, {
  carrega: v.carrega, espera: v.espera, mult: MULT_CHEFE[k] ?? 0, queima: QUEIMA_CHEFE[k] ?? 0,
  magico: /sopro|chuva|rugido|acido/.test(k),
}]));
// textos do balão (cena.js:3435) → mecânica (é o que o inject.js detecta)
export const BALAO = Object.fromEntries(Object.entries(BALAO_CENA).map(([k, v]) => [v, k]));

const mitigar = M.mitigar;
const fatorDif = (pjNivel, mobNivel) => M.fatorDanoMonstro({ nivel: pjNivel }, { nivel: mobNivel });   // motor.js:1201

export function statsBoss(nome, nivel, pjNivel) {
  const m = MONSTROS[nome]; if (!m) return null;
  const fn = fatorDif(pjNivel, nivel);
  return { nome, nivel, hp: CURVA.hp(nivel) * m.hp, ad: CURVA.ad(nivel) * m.ad * fn, as: m.as, armadura: CURVA.armadura(nivel) * m.armadura, magico: m.magico, fn, chefe: true };
}

const POTS = { vida: { heal: 300, cost: 40 }, vidaF: { heal: 900, cost: 110 }, vidaS: { heal: 2200, cost: 260 } };
const CD = 1.0;   // EXAUSTAO (motor)
const malhorUna = (falta) => falta <= 300 ? 'vida' : falta <= 900 ? 'vidaF' : 'vidaS';
/** Mix mais barato de ATÉ n poções que cobre `falta`. */
function mixBarato(falta, n) {
  const P1 = { h: 300, c: 40 }, P2 = { h: 900, c: 110 }, P3 = { h: 2200, c: 260 };
  let best = null;
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n - a; b++) for (let c = 0; c <= n - a - b; c++) {
    const h = a * P1.h + b * P2.h + c * P3.h, cost = a * P1.c + b * P2.c + c * P3.c;
    if (h >= falta && (!best || cost < best.cost)) best = { a, b, c, cost };
  }
  return best;
}

// ---- simulação de uma luta ----
/**
 * @param {object} boss  de statsBoss
 * @param {object} pj    { nivel, vida, armadura, rm }
 * @param {object} opts  { healS, segundos, detetaCarga, pisoPct, margem, fugirFatal }
 * @param {function} estrategia  (S) => potion key | null
 */
export function lutar(boss, pj, estrategia, opts = {}) {
  const healS = opts.healS ?? 0, dur = opts.segundos ?? 120, dt = 0.05;
  const hpMax = pj.vida;
  let hp = hpMax, t = 0, cd = 0, custo = 0, hpMin = hpMax, mortoEm = null;
  const usadas = { vida: 0, vidaF: 0, vidaS: 0 };
  const defMag = (k, mag) => mitigar(boss.ad * k, mag ? pj.rm : pj.armadura);
  const est = { tMec: 5, mecK: 0, carregando: 0, mec: null, furiaT: 0, asMul: 1, cargas: [] };
  // larvas do Barão (invocar) — contribuição grosseira
  let larvas = [];
  let ataqueT = 0;

  const eventos = [];
  while (t < dur && hp > 0) {
    // cura das skills
    hp = Math.min(hpMax, hp + healS * dt);

    // --- chefe: mecânica carregada (o alvo tem aviso = carrega) ---
    let cargaAtiva = null;
    if (est.carregando > 0) {
      est.carregando -= dt;
      cargaAtiva = est.mec;
      if (est.carregando <= 0) {
        const h = HAB[est.mec];
        if (h.mult > 0) {
          const dmg = defMag(h.mult, h.magico);
          hp -= dmg; eventos.push({ t, tipo: 'mec', mec: est.mec, dmg: Math.round(dmg) });
        }
        if (est.mec === 'rugido') { est.asMul = 1.5; est.furiaT = 5; }
        if (est.mec === 'invocar') { }
        est.tMec = h.espera; est.mec = null;
      }
    } else {
      est.tMec -= dt;
      if (est.tMec <= 0) {
        const tipo = RODIZIO[boss.nome][est.mecK++ % RODIZIO[boss.nome].length];
        est.mec = tipo;
        if (tipo === 'invocar') {
          for (let k = 0; k < 2; k++) larvas.push({ ataque: 0.5 + k * 0.3 });
          est.tMec = HAB.invocar.espera; est.mec = null;
        } else {
          est.carregando = HAB[tipo].carrega;
          cargaAtiva = tipo;
        }
      }
    }
    if (est.furiaT > 0) { est.furiaT -= dt; if (est.furiaT <= 0) est.asMul = 1; }

    // --- ataque básico (não ataca carregando) ---
    if (est.carregando <= 0) {
      ataqueT -= dt * est.asMul;
      if (ataqueT <= 0) {
        ataqueT = 1 / boss.as;
        const dmg = defMag(1, boss.magico);
        hp -= dmg; eventos.push({ t, tipo: 'basico', dmg: Math.round(dmg) });
      }
    }
    // larvas (mágicas): atacam a cada 1/as
    for (const l of larvas) {
      l.ataque -= dt;
      if (l.ataque <= 0) { l.ataque = 1 / MONSTROS['Larva do Vazio'].as; const s = statsBoss('Larva do Vazio', boss.nivel - 6, pj.nivel); const dmg = mitigar(s.ad * 0.3, pj.rm); hp -= dmg; }
    }
    if (hp <= 0) { mortoEm = t; break; }

    // --- decisão de poção ---
    cd = Math.max(0, cd - dt);
    const S = { hp, hpMax, t, cd, healS, usadas, boss, carga: cargaAtiva, eventos, larvas: larvas.length, pjRm: pj.rm, pjArm: pj.armadura };
    const k = estrategia(S);
    if (k && k !== 'FUGIR' && cd <= 0) { hp = Math.min(hpMax, hp + POTS[k].heal); usadas[k]++; custo += POTS[k].cost; cd = CD; }
    hpMin = Math.min(hpMin, hp);
    t += dt;
  }
  return { vivo: hp > 0, hpMin, custo, usadas, mortoEm, t: +t.toFixed(1), danoMecMax: Math.max(0, ...eventos.filter((e) => e.tipo === 'mec').map((e) => e.dmg)), piorBasico: Math.max(0, ...eventos.filter((e) => e.tipo === 'basico').map((e) => e.dmg)) };
}

// ---- estratégias ----
/** SMART atual: último golpe + piso (% do máx). */
export function smartPiso({ pisoPct = 0.75, margem = 1.1 } = {}) {
  return (S) => {
    const { hp, hpMax } = S;
    // último golpe observado = a maior queda recente (o sim guarda em eventos)
    const ult = S.eventos.length ? S.eventos[S.eventos.length - 1].dmg : 0;
    const alvo = Math.min(hpMax, Math.max(hpMax * pisoPct, ult * margem));
    if (hp + S.healS * 1.2 >= alvo) return null;
    return malhorUna(alvo - hp);
  };
}
/** SMART com CARGA: prevê o golpe forte da mecânica carregada (aviso = carrega). */
export function smartCarga({ pisoPct = 0.65, margem = 1.15, detetaCarga = true, fugirFatal = false } = {}) {
  return (S) => {
    const { hp, hpMax, boss, carga } = S;
    const ult = S.eventos.length ? S.eventos[S.eventos.length - 1].dmg : 0;
    let alvo = Math.max(hpMax * pisoPct, ult * 1.05);
    if (detetaCarga && carga && HAB[carga].mult > 0) {
      const dmg = mitigar(boss.ad * HAB[carga].mult, HAB[carga].magico ? S.pjRm : S.pjArm);
      if (fugirFatal && dmg >= hpMax) return 'FUGIR';
      alvo = Math.max(alvo, dmg * margem);
    }
    alvo = Math.min(hpMax, alvo);
    if (hp >= alvo) return null;
    const n = 1;   // 1 poção que cubra o buraco (o sim mostrou que picar com 2×P1 é arriscado)
    const mix = mixBarato(alvo - hp, n);
    if (mix) for (const [x, k] of [['vida', 'a'], ['vidaF', 'b'], ['vidaS', 'c']]) if (mix[k] > 0) return x;
    return malhorUna(alvo - hp);
  };
}
/** SMART velho (bugado): média/s. */
export function smartVelho() {
  return (S) => {
    const { hp, hpMax, healS, eventos } = S;
    const jan = eventos.filter((e) => e.t > S.t - 5);
    const dmgS = jan.reduce((s, e) => s + e.dmg, 0) / 5;
    const liquido = dmgS - healS;
    if (liquido <= 0.5 && hp / hpMax > 0.6) return null;
    const falta = Math.max(liquido, dmgS * 0.4) * 1.5;
    return malhorUna(falta);
  };
}

// ---- main ----
const direto = process.argv[1] && /sim-chefes\.mjs$/.test(process.argv[1]);
const SO_ARG = (() => { const i = process.argv.indexOf('--so'); return i >= 0 ? process.argv[i + 1] : null; })();
if (direto && SO_ARG !== 'rv') {
  // Stats do personagem — ANTES hardcoded com os da Katarina (nv 27, 4188 HP, 154 arm, 127 RM),
// o que tornava o simulador inútil para o Yasuo. Agora parametrizável:
//   --pj '{"nivel":13,"vida":2257,"armadura":94,"rm":74}'
//   --snapshot docs/snapshots/yasuo.json     (lê de `player`)
// Sem argumentos mantém o comportamento antigo (compatibilidade).
function carregarPJ() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const cru = arg('--pj');
  if (cru) { try { const o = JSON.parse(cru); if (o && o.vida) return o; } catch (e) { console.error('--pj inválido: ' + e.message); } }
  const snap = arg('--snapshot');
  if (snap) {
    try {
      let d = JSON.parse(fs.readFileSync(snap, 'utf8'));
      if (typeof d === 'string') d = JSON.parse(d);   // snapshots do ll.mjs vêm duplamente codificados
      const p = d.player || {};
      if (p.vida) return { nivel: p.nivel, vida: p.vida, armadura: p.armadura, rm: p.rm };
      console.error('snapshot sem player.vida');
    } catch (e) { console.error('falha a ler o snapshot: ' + e.message); }
  }
  return { nivel: 27, vida: 4188, armadura: 154, rm: 127 };   // fallback (Katarina)
}
const PJ = carregarPJ();
  const CHEFES = [['Arauto do Vale', 35], ['Dragão Infernal', 40], ['Barão Nashor', 50]];
  console.log(`Personagem: nv ${PJ.nivel}, ${PJ.vida} HP, ${PJ.armadura} arm, ${PJ.rm} RM\n`);
  for (const [nome, nivel] of CHEFES) {
    const b = statsBoss(nome, nivel, PJ.nivel);
    console.log(`=== ${nome} (nv ${nivel}) — ad ${Math.round(b.ad)} (fator ${b.fn.toFixed(2)}) ===`);
    console.log(`  básico: ${Math.round(mitigar(b.ad, b.magico ? PJ.rm : PJ.armadura))} | mecânicas: ` +
      RODIZIO[nome].map((m) => `${m} ${Math.round(mitigar(b.ad * HAB[m].mult, HAB[m].magico ? PJ.rm : PJ.armadura))}`).join(', '));
    for (const healS of [0, 100, 200]) {
      const velho = lutar(b, PJ, smartVelho(), { healS, segundos: 120 });
      const piso = lutar(b, PJ, smartPiso(), { healS, segundos: 120 });
      const carga = lutar(b, PJ, smartCarga(), { healS, segundos: 120 });
      const fmt = (r) => r.vivo ? `vivo hpMin ${Math.round(r.hpMin).toString().padStart(4)} (${r.custo}g)` : `MORTO ${r.mortoEm}s`;
      console.log(`  cura ${String(healS).padStart(3)}/s  velho: ${fmt(velho).padEnd(24)} | piso75: ${fmt(piso).padEnd(24)} | carga: ${fmt(carga)}`);
    }
    console.log('');
    // sweep do piso da estratégia com carga (o aviso deixa baixar o piso)
    const linha = [];
    for (const piso of [0.4, 0.5, 0.6, 0.7, 0.75]) {
      const r = lutar(b, PJ, smartCarga({ pisoPct: piso }), { healS: 0, segundos: 120 });
      linha.push(`${piso}: ${r.vivo ? Math.round(r.hpMin) + '/' + r.custo + 'g' : 'MORTO ' + r.mortoEm + 's'}`);
    }
    console.log('  sweep piso (carga, cura 0): ' + linha.join('  '));
    console.log('');
  }

  // Barão: dá pra sobreviver aos Tentáculos (físico) com mais armadura?
  const barao = statsBoss('Barão Nashor', 50, PJ.nivel);
  console.log('=== Barão: armadura mínima p/ sobreviver aos Tentáculos ===');
  for (const arm of [154, 200, 250, 300, 350, 400]) {
    const dmg = mitigar(barao.ad * 2.6, arm);
    console.log(`  armadura ${arm}: tentáculos ${Math.round(dmg)} ${dmg < PJ.vida ? '< HP máx -> sobrevivível' : '>= HP máx -> INSTA-KILL'}`);
  }
}

// =====================================================================================
// PARTE 2 — BUILD + NÍVEL → STATS → DPS → DURAÇÃO DA LUTA (pedido do dono, 2026-10-14)
//
// REGRA DE EVIDÊNCIA: cada número tem file:linha de docs/game-src. O que não existe no
// repositório (dados-yasuo.js / dados-katarina.js — importados em motor.js:4 e motor.js:6
// mas AUSENTES da pasta) fica marcado NAO VERIFICADO e é CALIBRADO contra os snapshots
// medidos (docs/snapshots/yasuo.json, docs/snapshots/katarina.json).
// =====================================================================================

// ---------- catálogo de itens: itens.js:3 + os remendos do motor (motor.js:16-26) ----------
export const ITENS = Object.fromEntries(ITENS_DADOS.map((i) => [String(i.id), i]));
Object.assign(ITENS['2022'], { cdr: 0.05, resumo: 'Reduz a recarga das habilidades' });   // motor.js:16
Object.assign(ITENS['1006'], { regen: 3 });                                               // motor.js:17
Object.assign(ITENS['3057'], { efeito: 'Lamina Encantada: depois de usar uma habilidade, o proximo ataque causa +100% do Dano de Ataque base.' });   // motor.js:18
Object.assign(ITENS['4629'], { cdr: 0.15 });                                              // motor.js:24
Object.assign(ITENS['3108'], { cdr: 0.05 });                                              // motor.js:25
Object.assign(ITENS['3802'], { cdr: 0.05 });                                              // motor.js:26
export const BONUS_REFINO = 0.12;                                                          // motor.js:55
export const QUALIDADES = { C: { mult: 0.9 }, B: { mult: 1 }, A: { mult: 1.15 }, S: { mult: 1.35 }, SS: { mult: 1.7 } };   // motor.js:173-179
export const baseId = (x) => String(x).replace(/[+~].*$/, '');
export const refinoDe = (x) => { const m = String(x).match(/[+]([0-9]+)/); return m ? +m[1] : 0; };
export const qualidadeDe = (x) => { const m = String(x).match(/~([A-Z]{1,2})$/); return m ? m[1] : 'B'; };
/** motor.js:251-255 — o item já com refino e qualidade (é o que o tooltip do jogo mostra). */
export function infoItem(x) {
  const i = ITENS[baseId(x)] || {};
  const m = (1 + BONUS_REFINO * refinoDe(x)) * (QUALIDADES[qualidadeDe(x)] || {}).mult;
  return { ...i, chave: x, ref: refinoDe(x), qual: qualidadeDe(x),
    ad: (i.ad || 0) * m, ap: (i.ap || 0) * m, mana: (i.mana || 0) * m, vida: (i.vida || 0) * m, armadura: (i.armadura || 0) * m,
    rm: (i.rm || 0) * m, va: (i.va || 0) * m, rv: (i.rv || 0) * m, critico: (i.critico || 0) * m,
    regen: (i.regen || 0) * m, cdr: (i.cdr || 0) * m };
}
export const temItem = (itens, id) => itens.some((x) => baseId(x) === id);

// ---------- curvas e factores do motor — LIDOS em tools/motor-vivo.mjs (REGRA N.o 3) ----------
export const CURVA_FIEL = M.CURVA;                                   // motor.js:282 (com ajuste)
/** motor.js — o saque segue a XP: monstro mais de 5 níveis abaixo do jogador rende menos. */
export const fatorSaque = (pjNivel, mobNivel) => { const d = pjNivel - mobNivel; return d > 5 ? Math.max(0.1, 1 - 0.1 * (d - 5)) : 1; };   // motor.js:434-437
/** Ouro por abate de um chefe: motor.js:1084 (CURVA.ouro x m.ouro x (0,5 + rand x 0,5), média 0,75) x fatorSaque. */
export function ouroPorAbate(nome, bossNivel, pjNivel) {
  const m = MONSTROS[nome]; if (!m) return 0;
  return CURVA_FIEL.ouro(bossNivel) * m.ouro * 0.75 * fatorSaque(pjNivel, bossNivel);
}
export const CRESCIMENTO = M.crescimento;                            // motor.js (crescimento)
export const RM_MONSTRO = M.RM_MONSTRO;                              // motor.js:1194
export const TETO_VIDA_ITEM = M.TETO_VIDA_ITEM;                      // motor.js:1205
export const VEL_ATAQUE_MAX = M.VEL_ATAQUE_MAX;                      // motor.js:357
export const EXAUSTAO = 1;                                           // motor.js:48
export const POCOES_MOTOR = Object.fromEntries(Object.entries(M.POCOES)
  .filter(([k]) => k !== 'mana' && k !== 'manaF')
  .map(([k, v]) => [k, { cura: v.cura, preco: v.preco }]));          // motor.js:270
export const FOCO_DANO_HAB = 0.002, FOCO_FLUXO = 0.01;               // motor.js:470
export const vidaRefItem = (vidaAtual, nivel) => M.vidaRefItem({ vida: vidaAtual, hpMax: vidaAtual, nivel });   // motor.js:1206

/** Nível do chefe — REGRA REAL (motor.js:1134). Covil do Barão: nm=[40,48]. */
export function nivelDoChefe(nm, nivelJogador) { return Math.max(nm[0] + 2, Math.min(nm[1] + 2, nivelJogador + 4)); }
/** motor.js:1200 — diferença de nível acima da faixa livre (NIVEL_DIF.livre). */
export const difNivel = (pjNivel, mobNivel) => M.difNivel({ nivel: pjNivel }, { nivel: mobNivel });
/** motor.js:1201 — monstro acima da faixa bate mais forte (teto maxDanoMonstro). */
export const fatorDanoMonstro = (pjNivel, mobNivel) => M.fatorDanoMonstro({ nivel: pjNivel }, { nivel: mobNivel });
/** motor.js:1202 — e o jogador bate mais fraco nele (piso minDanoJogador). */
export const fatorDanoJogador = (pjNivel, mobNivel) => M.fatorDanoJogador({ nivel: pjNivel }, { nivel: mobNivel });

/** Stats do chefe num nível — CURVA do motor × espécie (motor.js:1083). */
export function statsBossFiel(nome, nivel) {
  const m = MONSTROS[nome]; if (!m) return null;
  return { nome, nivel, hpMax: CURVA_FIEL.hp(nivel) * m.hp, ad: CURVA_FIEL.ad(nivel) * m.ad, as: m.as,
    armadura: CURVA_FIEL.armadura(nivel) * m.armadura, magico: !!m.magico, chefe: !!m.chefe };
}

// =====================================================================================
// BASE DOS CAMPEÕES — LIDA de docs/game-src/dados-*.js (motor.js:9-15 importa-os).
// Antes isto era "CALIBRADO NAO VERIFICADO" porque os ficheiros faltavam no repo; desde
// 2026-10-14 existem (dados-katarina.js, lido do jogo vivo) e a base REAL da Katarina é
// hp 672 (+108/nível), armadura 32 (+4,7), RM 32 (+3,5 por nível — o crescimento da RM é
// fixo no motor, motor.js:509, e NÃO vem do ficheiro), VA 0,658 (+2,74%/nível).
// Prova de que a base real é a certa: conferirPainel() da sim-timeline.mjs compara com o
// painel MEDIDO do dono (docs/snapshots/player.json, nv29).
// =====================================================================================
/**
 * A base do KATARINA vem LIDA de docs/game-src/dados-katarina.js (motor.js:13).
 * O crescimento da RM (3,5/nível) é o que motor.js:509 aplica — o campo
 * spellblockperlevel do ficheiro NÃO é lido pelo motor.
 */
export const BASE_CAMPEAO = {
  yasuo: { hp: 590, hpperlevel: 110, armor: 32, armorperlevel: 4.6, spellblock: 32, attackspeed: 0.697, aspdNivel: 3.5,
    fonte: 'CALIBRADO (6 setups medidos) — convenção Data Dragon (dados-yasuo.js ainda ausente)' },
  katarina: (() => { const s = BASE_CAMPEAO_LIDA.katarina;
    return { hp: s.hp, hpperlevel: s.hpperlevel, armor: s.armor, armorperlevel: s.armorperlevel,
      spellblock: s.spellblock, attackspeed: s.attackspeed, aspdNivel: s.attackspeedperlevel,
      spellblockPorNivel: 3.5,
      fonte: 'LIDO de docs/game-src/dados-katarina.js (motor.js:13)' }; })(),
};

/** Atribuição de pontos usada por omissão (o jogo dá 3/nível — motor.js:483). */
export const ATRIB_PADRAO = {
  yasuo: { forca: 10, vitalidade: 7, resistencia: 4, agilidade: 3, foco: 0 },      // = o do snapshot medido (nv12)
  katarina: { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0 },
};
/** KITS — adBase/adNivel/papel de motor.js:881 (yasuo) e motor.js:884 (katarina). */
export const KITS_SIM = {
  yasuo: { id: 'yasuo', adBase: 60, adNivel: 3.9, magia: false, fluxo: true, papel: { dano: 1.15, recebido: 0.85 }, barraFixa: ['R'] },
  katarina: { id: 'katarina', adBase: 58, adNivel: 3.4, magia: true, semMana: true, adagas: true, papel: { dano: 1.2, recebido: 0.75 }, barraFixa: ['R'] },
};
const serie = (ini, passo, n = 10) => Array.from({ length: n }, (_, i) => +(ini + passo * i).toFixed(4));   // motor.js:550
/**
 * HABILIDADES — TODAS inline no motor (é a única fonte verificável; o nome de cada uma vem
 * do ficheiro ausente, por isso fica sem nome aqui).
 * Yasuo: motor.js:696-729. Katarina: motor.js:735-771.
 */
export const HAB_SIM = {
  yasuo: {
    P: { passiva: true, critMult: 2, critDano: 0.8, critBase: (nivel) => Math.min(0.18, 0.1 + 0.0018 * nivel), fluxoSeg: 9, escudoFluxo: (nivel) => 80 + 28 * nivel },
    Q: { nome: 'Tempestade de Aco', nivel: 1, max: 10, recarga: serie(4, -0.15), base: serie(40, 20), ratio: serie(0.55, 0), cargas: 2, recargaVa: true, minima: 1.5, fisico: true, crita: true },
    E: { nome: 'Espada Agil', nivel: 1, max: 10, recarga: serie(3.5, -0.15), base: serie(50, 18), ratio: serie(0.2, 0.01), magico: true, semMitigacao: true, mesmoAlvo: 6 },
    R: { nome: 'Ultimo Suspiro', nivel: 6, max: 5, recarga: [70, 60, 50, 42, 35], base: serie(200, 110, 5), ratio: serie(1, 0.08, 5), penSuspiro: 0.3, duracaoPen: 15, fisico: true },
    G: { nome: 'Respiracao do Vento', nivel: 8, max: 10, recarga: serie(25, -1), duracao: 8, va: serie(0.25, 0.03), util: true },
    A: { nome: 'Investida do Vendaval', nivel: 13, max: 10, recarga: serie(12, -0.5), base: serie(60, 30), ratio: serie(0.8, 0.05), fisico: true },
    D: { nome: 'Lamina Inquieta', nivel: 18, max: 10, passiva: true, inquieta: serie(0.03, 0.004), acumMax: 5, duracaoInquieta: 4 },
    F: { nome: 'Lamina Fantasma', nivel: 23, max: 10, recarga: serie(20, -0.6), duracao: 6, pctCorte: serie(0.4, 0.03), alvosCorte: 2, util: true },
    T: { nome: 'Furacao Cortante', nivel: 28, max: 10, recarga: serie(11, -0.4), base: serie(70, 35), ratio: serie(0.9, 0.04), fisico: true },
    B: { nome: 'Brisa Protetora', nivel: 33, max: 10, recarga: serie(28, -1), escudoPct: serie(0.12, 0.02), util: true },
    M: { nome: 'Lamina do Vendaval', nivel: 38, max: 10, recarga: serie(13, -0.4), base: serie(110, 55), ratio: serie(1, 0.06), fisico: true },
    N: { nome: 'Danca das Mil Laminas', nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], duracao: 2.5, golpes: 10, base: serie(60, 30, 5), ratio: serie(0.5, 0.06, 5), fisico: true },
  },
  katarina: {
    P: { passiva: true, voracidade: 1.5, curaBase: 0.05, pegaCada: 0.35, shunpo: 0.5,
      giro: (nivel, st) => 30 + 19 * nivel + (st.ap || 0) + 0.4 * Math.max(0, st.ad - st.baseAd) },   // motor.js:737
    Q: { nome: 'Lamina Saltitante', nivel: 1, max: 10, recarga: serie(10, -0.35), base: serie(80, 35), ratio: serie(0.45, 0.03), alvos: 3, adaga: true, poder: true },
    W: { nome: 'Preparacao', nivel: 1, max: 10, recarga: serie(14, -0.4), adaga: true, util: true },
    E: { nome: 'Shunpo', nivel: 1, max: 10, recarga: serie(10, -0.4), base: serie(40, 20), ratio: serie(0.3, 0.02), adRatio: 0.4, poder: true },
    R: { nome: 'Lotus da Morte', nivel: 6, max: 5, recarga: [75, 65, 55, 48, 42], duracao: 2.5, golpes: 15, alvos: 3, base: serie(30, 14, 5), ratio: serie(0.25, 0.03, 5), poder: true },
    G: { nome: 'Sede de Sangue', nivel: 8, max: 10, recarga: serie(20, -0.8), duracao: 8, base: serie(30, 15), ratio: serie(0.3, 0.015), curaSede: 0.3, va: serie(0.2, 0.02), noAuto: true, poder: true },
    A: { nome: 'Adaga Certeira', nivel: 13, max: 10, recarga: serie(12, -0.5), base: serie(90, 35), ratio: serie(0.6, 0.035), adaga: true, poder: true },
    D: { nome: 'Lamina Sinistra', nivel: 18, max: 10, passiva: true, vaAdaga: serie(0.08, 0.008), acumMax: 3, duracaoSinistra: 3, curaGiro: serie(0.08, 0.01) },
    F: { nome: 'Lamina Envenenada', nivel: 23, max: 10, recarga: serie(16, -0.5), duracao: 8, venenoBase: serie(40, 18), venenoRatio: 0.25, venenoT: 3, dot: true, poder: true },
    T: { nome: 'Chuva de Adagas', nivel: 28, max: 10, recarga: serie(24, -0.8), base: serie(60, 28), ratio: serie(0.4, 0.03), adagas: 3, poder: true },
    B: { nome: 'Passo das Sombras', nivel: 33, max: 10, recarga: serie(24, -0.8), some: 1.5, bonusSombra: serie(1, 0.08), util: true },
    M: { nome: 'Execucao Noxiana', nivel: 38, max: 10, recarga: serie(14, -0.5), base: serie(200, 80), ratio: serie(1.2, 0.07), poder: true },
    N: { nome: 'Tempestade de Lotus', nivel: 45, max: 5, recarga: [75, 66, 58, 51, 45], duracao: 3, golpes: 12, base: serie(90, 40, 5), ratio: serie(0.45, 0.05, 5), poder: true },
  },
};

/** Ranks permitidos por nível — motor.js:905-912. */
export function rankMaximoNoNivel(campeao, nivel, tecla) {
  const h = HAB_SIM[campeao][tecla];
  if (!h) return 0;
  if (nivel < (h.nivel || 1)) return 0;
  if (tecla === 'R') return [6, 11, 16, 25, 35].filter((n) => nivel >= n).length;   // motor.js:902
  if (tecla === 'N') return [45, 46, 47, 48, 50].filter((n) => nivel >= n).length;  // motor.js:903
  if (tecla === 'Q' || tecla === 'W' || tecla === 'E') return Math.min(h.max, Math.ceil(nivel / 2));
  return Math.min(h.max, 1 + Math.floor((nivel - (h.nivel || 1)) / 2));
}

/** motor.js:492-544 — atributos() com a base calibrada. atrib = {forca,vitalidade,resistencia,agilidade,foco}. */
export function statsJogador(campeao, nivel, itens, atrib) {
  const k = KITS_SIM[campeao], b = BASE_CAMPEAO[campeao], g = CRESCIMENTO(nivel);
  const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...(atrib || {}) };
  let ad = k.adBase + k.adNivel * g, vida = b.hp + b.hpperlevel * g, armadura = b.armor + b.armorperlevel * g, rm = b.spellblock + 3.5 * g, va = 0, rv = 0;
  const baseAd = ad, baseVida = vida, baseArmadura = armadura;
  let critico = 0, danoCritico = 1.75, regenItens = 0, cdrItens = 0, ap = 0, manaItens = 0;
  const pct = { adPct: 0, apPct: 0, vidaPct: 0, armPct: 0, rmPct: 0, esquiva: 0, penMag: 0 };   // motor.js:501
  if (k.magia) ap += 2 * at.forca; else ad += 1.2 * at.forca;                                   // motor.js:503
  vida += 20 * at.vitalidade; armadura += 1.5 * at.resistencia; rm += 1 * at.resistencia; va += 0.008 * at.agilidade;
  for (const id of itens) {
    if (!ITENS[baseId(id)]) continue;
    const i = infoItem(id);
    ad += i.ad; ap += i.ap; manaItens += i.mana; vida += i.vida; armadura += i.armadura; rm += i.rm; va += i.va; rv += i.rv; critico += i.critico;
    regenItens += i.regen; cdrItens += i.cdr;
    for (const p in pct) pct[p] += i[p] || 0;
  }
  vida *= 1 + pct.vidaPct;                                                                       // motor.js:511
  if (temItem(itens, '2501')) ad += 0.02 * (vida - baseVida);                                    // motor.js:514
  if (temItem(itens, '3031')) danoCritico += 0.4;                                                // motor.js:515
  if (temItem(itens, '3089')) ap *= 1.35;                                                        // motor.js:522
  ad *= 1 + pct.adPct; ap *= 1 + pct.apPct; armadura *= 1 + pct.armPct; rm *= 1 + pct.rmPct;     // motor.js:523
  const h = HAB_SIM[campeao];
  return {
    nivel, ad, ap, baseAd, baseVida, baseArmadura, vida, armadura, rm, manaItens, cdrItens,
    velAtaque: Math.min(VEL_ATAQUE_MAX, b.attackspeed * (1 + (b.aspdNivel / 100) * g + va)),      // motor.js:534
    critico: Math.min(1, (critico + (h.P.critBase ? h.P.critBase(nivel) : 0)) * (h.P.critMult || 1)),   // motor.js:541
    danoCritico: danoCritico * (h.P.critDano || 1),
    penArmadura: 1 - (temItem(itens, '3036') ? 0.7 : 1),                                          // motor.js:539
    penMagica: Math.min(0.6, (temItem(itens, '3135') ? 0.4 : 0) + pct.penMag),                    // motor.js:529
    reducaoRecarga: Math.min(0.4, cdrItens),                                                      // motor.js:537
    rouboVida: rv, esquiva: Math.min(0.25, 0.0025 * at.agilidade + pct.esquiva), regenItens,
    danoHab: k.semMana ? FOCO_DANO_HAB * at.foco : 0,                                             // motor.js:531
    fluxoMult: k.fluxo ? 1 + FOCO_FLUXO * at.foco : 1,                                            // motor.js:532
    itens,
  };
}

// ---------- mitigação (motor.js:1167 e motor.js:1202) ----------
export const mit = (dano, def) => dano * (100 / (100 + Math.max(0, def)));
/** motor.js:1202 — a armadura efetiva que o golpear() usa (dano mágico de PODER leva 60% da armadura). */
export function armEfetiva(st, boss, magico, poder) {
  if (magico) return poder ? boss.armadura * RM_MONSTRO * (1 - st.penMagica) : 0;
  return boss.armadura * (1 - st.penArmadura);
}
export const multiplicadorCampeao = (campeao) => KITS_SIM[campeao].papel.dano;   // motor.js:1212

/** DPS de UMA habilidade num rank contra o chefe (motor.js:2124-2137, 1581, 1192-1213). */
export function dpsDaHabilidade(campeao, tecla, rank, st, boss, pjNivel, penExtra) {
  const h = HAB_SIM[campeao][tecla]; if (!h || !(rank > 0)) return { dps: 0, dano: 0, cd: null, util: true };
  const papel = multiplicadorCampeao(campeao), fj = fatorDanoJogador(pjNivel, boss.nivel);
  const escala = KITS_SIM[campeao].magia ? st.ap : st.ad;
  const direto = (h.base ? h.base[rank - 1] : 0) + (h.ratio ? h.ratio[rank - 1] * escala : 0) + (h.adRatio || 0) * st.ad;
  if (!h.recarga) return { dps: 0, dano: direto, cd: null, util: true };
  let cd = h.recarga[rank - 1] * (1 - st.reducaoRecarga);
  if (h.recargaVa) cd = Math.max(h.minima, h.recarga[rank - 1] / Math.max(1, st.velAtaque / 0.697)) * (1 - st.reducaoRecarga);   // motor.js:2056 + motor.js:1581
  const golpes = h.golpes || 1;
  const magico = !!h.magico || !!h.poder;
  const arm = magico ? (h.poder ? boss.armadura * RM_MONSTRO * (1 - st.penMagica) : 0) : boss.armadura * (1 - (penExtra != null ? penExtra : st.penArmadura));
  let bruto = direto * golpes;
  if (h.crita) bruto *= (1 - st.critico) + st.critico * st.danoCritico;      // esperança do crítico (motor.js:1700)
  let dano = mit(bruto, arm) * papel * fj;
  if (h.noAuto) return { dps: 0, dano, cd, util: true };                     // Sede de Sangue entra no DPS do auto
  let taxa = 1 / cd;
  if (h.mesmoAlvo) taxa = Math.min(taxa, 1 / h.mesmoAlvo);                   // Yasuo E: 1x/6 s no MESMO alvo (motor.js:703)
  if (campeao === 'katarina' && h.poder) dano *= 1 + st.danoHab;             // motor.js:1218
  return { dps: dano * taxa, dano, cd, taxa, magico, util: false };
}

/** Barra de 4: ultimate fixa + as melhores por DPS no rank actual (automation.js:5281-5300). */
export function escolherBarra(campeao, nivel, ranks, st, boss) {
  const H = HAB_SIM[campeao];
  const fixas = KITS_SIM[campeao].barraFixa.filter((t) => ranks[t] > 0);
  const cand = Object.keys(H).filter((t) => ranks[t] > 0 && !H[t].passiva && t !== 'D' && t !== 'P');
  const resto = cand.filter((t) => !fixas.includes(t))
    .sort((a, b) => dpsDaHabilidade(campeao, b, ranks[b], st, boss, nivel).dps - dpsDaHabilidade(campeao, a, ranks[a], st, boss, nivel).dps);
  return [...fixas, ...resto].slice(0, 4);
}


/**
 * DPS (auto + skills da barra) para um conjunto de RANKS — já com o buff do Último Suspiro
 * (30% de pen. de armadura por 15 s, motor.js:706) e o da Respiração do Vento (motor.js:709),
 * que é o que o valorDoPonto da extensão faz (automation.js:1313-1330).
 */
export function dpsComRanks(campeao, nivel, st, boss, ranks) {
  const H = HAB_SIM[campeao];
  const papel = multiplicadorCampeao(campeao), fj = fatorDanoJogador(nivel, boss.nivel);
  let penSuspiro = 0, vaExtra = 0;
  if (campeao === 'yasuo' && ranks.R > 0) { const cd = H.R.recarga[ranks.R - 1] * (1 - st.reducaoRecarga); penSuspiro = H.R.penSuspiro * Math.min(1, H.R.duracaoPen / cd); }
  if (campeao === 'yasuo' && ranks.G > 0) { const cd = H.G.recarga[ranks.G - 1] * (1 - st.reducaoRecarga); vaExtra = H.G.va[ranks.G - 1] * Math.min(1, H.G.duracao / cd); }
  const penTotal = 1 - (1 - st.penArmadura) * (1 - penSuspiro);
  const armFis = boss.armadura * (1 - penTotal);
  const esperanca = (1 - st.critico) + st.critico * st.danoCritico;
  const auto = mit(st.ad * esperanca, armFis) * papel * fj * st.velAtaque * (1 + vaExtra);
  const barra = escolherBarra(campeao, nivel, ranks, st, boss);
  const skills = barra.reduce((s, t) => s + dpsDaHabilidade(campeao, t, ranks[t], st, boss, nivel).dps, 0);
  return { auto, skills, penSuspiro, vaExtra, barra, penTotal };
}
/**
 * Gasta os pontos que o NÍVEL dá (motor.js:2824 — 1 por nível a partir do 1; a Q começa
 * aprendida de graça, motor.js:1003) pelo maior ganho, JÁ com os buffs.
 *
 * A PASSIVA D (Lâmina Sinistra, motor.js:768) entra nas candidatas: pontos gastos nela são
 * pontos que o jogo deu. Na Katarina nv29 o dono tem 28 pontos e 24 ranks visíveis no arsenal
 * — os 4 que faltam estão na D (ver sim-timeline.mjs §7). Excluir a D de aqui fazia o modelo
 * deitar fora 4 pontos em todos os níveis.
 */
export function ranksNoNivel(campeao, nivel, st, boss) {
  const H = HAB_SIM[campeao];
  const teclas = Object.keys(H).filter((t) => t !== 'P');
  const ranks = {}; for (const t of teclas) ranks[t] = 0;
  const valor = (r) => { const x = dpsComRanks(campeao, nivel, st, boss, r); return x.auto + x.skills + ganhoPassivas(campeao, nivel, st, boss, r); };
  const pontos = Math.max(0, (Number(nivel) || 1) - 1);      // motor.js:2824 + 1003
  for (let i = 0; i < pontos; i++) {
    let melhor = null; const antes = valor(ranks);
    for (const t of teclas) {
      if (ranks[t] >= rankMaximoNoNivel(campeao, nivel, t)) continue;
      const ganho = valor({ ...ranks, [t]: ranks[t] + 1 }) - antes;
      if (!melhor || ganho > melhor.ganho) melhor = { t, ganho };
    }
    if (!melhor) break;
    ranks[melhor.t]++;
  }
  return ranks;
}

/**
 * Valor das PASSIVAS num conjunto de ranks — o que elas fazem de facto no motor.
 * D (Lâmina Sinistra, motor.js:768): velocidade de ataque por adaga (3 acumps, motor.js:2183)
 * e a cura do giro da Voracidade (motor.js:2192). Contar os dois é o que permite ao gastador
 * de pontos perceber que a D vale pontos — sem isso a passiva nunca era escolhida.
 */
function ganhoPassivas(campeao, nivel, st, boss, ranks) {
  if (campeao !== 'katarina') return 0;
  const H = HAB_SIM.katarina, rD = ranks.D || 0;
  if (rD <= 0) return 0;
  const base = dpsComRanks(campeao, nivel, st, boss, ranks);
  const papel = multiplicadorCampeao(campeao), fj = fatorDanoJogador(nivel, boss.nivel);
  // 1) velocidade de ataque: acumMax adagas, cada uma dando vaAdaga[rank-1] (motor.js:2183)
  const vaGanha = H.D.vaAdaga[rD - 1] * H.D.acumMax;
  const ganhoAuto = base.auto * vaGanha;
  // 2) cura do giro: (curaBase + curaGiro[rank-1]) x dano do giro (motor.js:2192)
  const armMag = boss.armadura * M.RM_MONSTRO * (1 - st.penMagica);
  const brutoGiro = H.P.giro(nivel, st);
  const dagasPorS = base.barra.filter((t) => H[t] && H[t].adaga).reduce((s, t) => {
    const d = dpsDaHabilidade(campeao, t, ranks[t], st, boss, nivel); return s + (d.cd ? 1 / d.cd : 0);
  }, 0);
  const girosPorS = Math.min(dagasPorS, 1 / H.P.pegaCada);      // motor.js:2181
  const danoGiro = mit(brutoGiro, armMag) * papel * fj * (1 + (st.danoHab || 0));
  const ganhoCura = danoGiro * girosPorS * (H.P.curaBase + H.D.curaGiro[rD - 1]);
  return ganhoAuto + ganhoCura;
}

// =====================================================================================
// DPS TEÓRICO contra o chefe (motor.js: golpeBasico 1673-1722, golpear 1192-1233)
// =====================================================================================
/**
 * Decompõe o DPS. Os itens de ÁREA (Runaan 3085, Hidra 3074) NÃO somam num alvo único —
 * só o Quebrapassos (6631) e o Rei Destruído (3153) contam, porque o motor os aplica
 * também no alvo principal (motor.js:1702, motor.js:1719).
 */
export function dpsTeorico(campeao, nivel, itens, boss, opts) {
  opts = opts || {};
  const st = statsJogador(campeao, nivel, itens, opts.atrib);
  const ranks = opts.ranks || ranksNoNivel(campeao, nivel, st, boss);
  const barra = escolherBarra(campeao, nivel, ranks, st, boss);
  const H = HAB_SIM[campeao];
  const papel = multiplicadorCampeao(campeao), fj = fatorDanoJogador(nivel, boss.nivel);
  const hpMedio = boss.hpMax / 2;
  const c = st.critico, dc = st.danoCritico, esperancaCrit = (1 - c) + c * dc;
  const det = { auto: 0, autoCura: 0, skills: 0, itens: 0, giro: 0, porSkill: {}, dpsSede: 0, curaSede: 0 };
  const base = dpsComRanks(campeao, nivel, st, boss, ranks);
  const penTotal = base.penTotal;
  const armFis = boss.armadura * (1 - penTotal);
  const armMag = armEfetiva(st, boss, true, true);
  const taxaSkills = base.barra.reduce((s, t) => { const d = dpsDaHabilidade(campeao, t, ranks[t], st, boss, nivel); return s + (d.cd ? 1 / d.cd : 0); }, 0);
  const autoRate = st.velAtaque;
  // média do Rei Destruído ao longo do combate: a vida do chefe cai de hpMax a 0 e o item tem
  // TETO de 3×CURVA.hp (motor.js:1191) -> média de min(hp, cap) = cap × (1 − cap/(2·hpMax))
  const cap3153 = TETO_VIDA_ITEM * CURVA_FIEL.hp(boss.nivel);
  const fCap = Math.min(1, cap3153 / boss.hpMax);
  const vidaMedia3153 = cap3153 * (1 - fCap / 2);

  // ---- auto-ataque (motor.js:1673-1722) ----
  // O que o motor passa a golpear(..., 'ataque') CURA com roubo de vida (motor.js:1226-1230).
  // O que ele passa como fonte 'item' NÃO cura: o 3748 (motor.js:1721) e o 6631 (motor.js:1719).
  let extra = 0;        // extras DENTRO do golpe básico (fonte 'ataque') -> curam
  let extraItem = 0;    // extras fora do golpe básico (fonte 'item') -> NÃO curam
  const lamina = temItem(itens, '3078') ? 2 : temItem(itens, '3057') ? 1 : 0;                 // motor.js:1672
  if (lamina) extra += lamina * st.baseAd * Math.min(1, taxaSkills / autoRate);                // motor.js:1697
  if (temItem(itens, '3153')) extra += 0.05 * vidaMedia3153;                                   // motor.js:1702 + 1191
  if (temItem(itens, '3748')) extraItem += 0.015 * st.vida;                                    // motor.js:1721 (fonte 'item')
  const autoExtra = mit(extra * esperancaCrit, armFis) * papel * fj * autoRate * (1 + base.vaExtra);
  det.auto = base.auto + autoExtra + mit(extraItem * esperancaCrit, armFis) * papel * fj * autoRate * (1 + base.vaExtra);
  // BASE DE CURA do roubo de vida: só o dano que sai do golpe básico (motor.js:1226: fonte === 'ataque')
  det.autoCura = base.auto + autoExtra;
  if (temItem(itens, '6631')) det.itens += mit(0.8 * st.ad, armFis) * papel * fj / 5;           // motor.js:1719
  if (temItem(itens, '3100')) det.itens += mit(0.75 * st.ap * Math.min(1, taxaSkills / autoRate), armMag) * papel * fj;   // motor.js:1688
  if (temItem(itens, '6653')) det.itens += mit(0.015 * vidaRefItem(hpMedio, boss.nivel), armMag) * papel * fj;            // motor.js:1207

  // ---- habilidades da barra ----
  for (const t of barra) {
    const d = dpsDaHabilidade(campeao, t, ranks[t], st, boss, nivel);
    det.porSkill[t] = Math.round(d.dps);
    det.skills += d.dps;
  }
  // ---- Voracidade (giro da adaga) — motor.js:737 + motor.js:2161-2171 ----
  let curaGiro = 0;
  if (campeao === 'katarina') {
    const brutoGiro = H.P.giro(nivel, st);
    const dagasPorS = barra.filter((t) => H[t].adaga).reduce((s, t) => {
      const d = dpsDaHabilidade(campeao, t, ranks[t], st, boss, nivel); return s + (d.cd ? 1 / d.cd : 0);
    }, 0);
    const girosPorS = Math.min(dagasPorS, 1 / H.P.pegaCada);                                  // motor.js:2181
    const danoGiro = mit(brutoGiro, armMag) * papel * fj * (1 + st.danoHab);                  // motor.js:1201, 1218, 2165
    det.giro = danoGiro * girosPorS;
    curaGiro = (H.P.curaBase + (ranks.D > 0 ? H.D.curaGiro[ranks.D - 1] : 0)) * det.giro;     // motor.js:2169-2170
    det.skills += det.giro;
    if (ranks.F > 0) {                                                                        // veneno (motor.js:2152-2156)
      const ven = H.F.venenoBase[ranks.F - 1] + H.F.venenoRatio * st.ap;
      const up = Math.min(1, (H.F.duracao + H.F.venenoT) / (H.F.recarga[ranks.F - 1] * (1 - st.reducaoRecarga)));
      det.itens += mit(ven, armMag) * papel * up;
    }
    if (ranks.G > 0) {                                                                        // Sede de Sangue no auto (motor.js:1683-1685)
      const danoG = H.G.base[ranks.G - 1] + H.G.ratio[ranks.G - 1] * st.ap;
      const up = Math.min(1, H.G.duracao / (H.G.recarga[ranks.G - 1] * (1 - st.reducaoRecarga)));
      det.dpsSede = mit(danoG, armMag) * papel * fj * autoRate * up;                           // fonte 'G' (motor.js:1684)
      det.curaSede = det.dpsSede * H.G.curaSede;                                               // motor.js:1685: cura = 30% do dano
      det.itens += det.dpsSede;
    }
  }
  const total = (det.auto + det.skills + det.itens) * (opts.multAp || 1);
  return { st, ranks, barra, det, total, curaGiro, vaExtra: base.vaExtra, papel, fj, penTotal };
}

// =====================================================================================
// A LUTA — simulação fiel (motor.js: mecanicaChefe 3081-3125, inimigoAtaca 1725-1737,
// queimadura 1358-1362, receberDano 2693-2734, encherFluxo 2031/1442, poções 261-267)
// =====================================================================================
/**
 * Corre a luta inteira contra um chefe: dano do jogador no chefe (dps constante),
 * mecânicas do chefe, larvas invocadas, queimadura, ataque básico, poção (smart) e morte.
 * Devolve se matou, em quantos segundos, quantas poções gastou e com que margem sobreviveu.
 *
 * ROUBO DE VIDA (motor.js:1226-1230): cura = dano do AUTO-ATAQUE x rouboVida, SO em ataques
 * básicos (fonte === 'ataque'). O simulador recebe o dano de auto por segundo JA MEDIDO pelo
 * dpsTeorico (det.autoCura) e o rouboVida dos stats; a cura entra como fluxo contínuo:
 *     cura/s = dpsAutoCura x rouboVida x (3065 ? 1,25 : 1)      (motor.js:1226 + motor.js:1286)
 * O excesso acima da vida máxima vira ESCUDO até 25% da vida máxima com a 3072 (motor.js:1229).
 * As curas que NAO são roubo de vida (giro da Voracidade, motor.js:2169-2170; Sede de Sangue,
 * motor.js:1685) entram em 'curaKit', separadas — para o relatório poder dizer o que é rv.
 */
export function lutarChefe(o) {
  const dt = 0.05, maxSeg = o.maxSeg || 300;
  const st = o.st, boss = o.boss, nivel = o.nivel, campeao = o.campeao;
  const kit = KITS_SIM[campeao];
  const fM = fatorDanoMonstro(nivel, boss.nivel);                       // motor.js:1186
  const recebido = kit.papel.recebido;                                  // motor.js:2697
  const dps = o.dps || 0;
  const hpMax = st.vida;
  let hp = hpMax, escudo = 0, fluxo = 0, bossHp = boss.hpMax, t = 0, cdPocao = 0, hpMin = hpMax;
  let mortoEm = null, matouEm = null, danoRecebido = 0, bebidas = 0, piorGolpe = 0, piorMec = 0;
  const usadas = { vida: 0, vidaF: 0, vidaS: 0 };
  // ---- roubo de vida + curas do kit (não-rv) ----
  const curaRV = o.curaRV || 0;                    // cura/s do roubo de vida (só autos, motor.js:1226)
  const curaKit = o.curaKit || 0;                  // curas do kit que NÃO são roubo de vida
  const multCura = o.tem3065 ? 1.25 : 1;           // motor.js:1286 (3065 Semblante Espiritual)
  const escudo3072 = !!o.tem3072;                  // motor.js:1229 (3072 Sedenta por Sangue)
  let curaFeita = 0, curaPocoesFeita = 0;
  // poções disponíveis pelo NÍVEL do jogador (motor.js:1294: estado.nivel >= p.nivel; motor.js:262-264)
  const disp = { vida: nivel >= 1, vidaF: nivel >= 15, vidaS: nivel >= 30 };
  const estoque = { vida: disp.vida ? 999 : 0, vidaF: disp.vidaF ? 999 : 0, vidaS: disp.vidaS ? 999 : 0, ...(o.pocoes || {}) };
  const eventos = [];
  const B = { tMec: 5, mecK: 0, carregando: 0, mec: null, asMul: 1, furiaT: 0, ataque: 1 / boss.as };
  let queimando = 0, queimaDano = 0, queimaT = 0;
  const larvas = [];
  const rodizio = RODIZIO[boss.nome];
  const HEAL = POCOES_MOTOR;

  const levar = (dano, doSangramento, magico) => {
    if (dano <= 0 || hp <= 0) return;
    if (!doSangramento) {
      dano *= (1 - st.esquiva);                                          // motor.js:1731 (esquiva pela esperança: o sim fica determinístico)
      dano *= fM;                                                        // motor.js:2696
      dano *= recebido;                                                  // motor.js:2697
      if (kit.fluxo && fluxo >= 99.99) {                                 // motor.js:2713-2717 (Fluxo cheio vira escudo)
        escudo = Math.max(escudo, HAB_SIM[campeao].P.escudoFluxo(nivel)); fluxo = 0;
      }
    }
    if (!doSangramento) piorGolpe = Math.max(piorGolpe, dano);
    if (escudo > 0) { const abs = Math.min(escudo, dano); escudo -= abs; dano -= abs; }   // motor.js:2718
    hp -= dano; danoRecebido += dano;
    if (hp <= 0) { hp = 0; mortoEm = t; }
  };
  const danoDeMecanica = (tipo) => {
    const h = HAB[tipo]; if (!h || !h.mult) return 0;
    const def = h.magico ? st.rm : st.armadura;
    return mit(boss.ad * h.mult, def);                                   // motor.js:3100-3101
  };

  const durPrevista = dps > 0 ? boss.hpMax / dps : Infinity;
  if (durPrevista > maxSeg) return { vivo: true, matou: false, t: maxSeg, hpMin: hpMax, hpMinPct: 100, usadas, totalPocoes: 0, custo: 0,
    danoRecebido: 0, tempoMatar: null, piorGolpe: 0, piorMec: 0, larvas: 0, durPrevista: +durPrevista.toFixed(2), motivo: 'dps baixo: > ' + maxSeg + 's',
    curaRV: Math.round(curaRV), curaKit: Math.round(curaKit), curaFeita: 0, curaPocoesFeita: 0, escudoFinal: 0, curaRVTotal: 0, curaPorSeg: 0 };

  while (t < maxSeg && hp > 0 && bossHp > 0) {
    // 0) ROUBO DE VIDA + curas do kit (motor.js:1226-1230, 1685, 2169-2170) — fluxo contínuo
    if (curaRV + curaKit > 0) {
      const cura = (curaRV + curaKit) * multCura * dt;
      const falta = hpMax - hp;
      hp = Math.min(hpMax, hp + cura);
      curaFeita += Math.min(cura, falta);
      if (escudo3072 && cura > falta) escudo = Math.min(hpMax * 0.25, escudo + (cura - falta));   // motor.js:1229
    }
    // 0b) Fluxo do Yasuo enche lutando (motor.js:1442 + motor.js:2031)
    if (kit.fluxo) fluxo = Math.min(100, fluxo + 9 * st.fluxoMult * dt);
    // 1) queimadura (motor.js:1358-1362) — NÃO leva o fator de nível (doSangramento)
    if (queimando > 0) { queimando = Math.max(0, queimando - dt); levar(queimaDano * dt, true, true); if (hp <= 0) break; }
    // 2) mecânica do chefe (motor.js:3081-3125)
    if (B.furiaT > 0) { B.furiaT -= dt; if (B.furiaT <= 0) B.asMul = 1; }        // motor.js:3085
    if (B.carregando > 0) {
      B.carregando -= dt;
      if (B.carregando <= 0) {
        const tipo = B.mec; B.carregando = 0; B.mec = null;
        const d = danoDeMecanica(tipo);
        if (d > 0) { piorMec = Math.max(piorMec, d); levar(d, false, HAB[tipo].magico); eventos.push({ t, tipo: 'mec', mec: tipo, dmg: Math.round(d) }); }
        if (tipo === 'sopro') { queimando = 4; queimaDano = hpMax * 0.03; }        // motor.js:3105
        else if (tipo === 'chuva') { queimando = Math.max(queimando, 3); queimaDano = hpMax * 0.025; }   // motor.js:3106
        else if (tipo === 'acido') { queimando = 5; queimaDano = hpMax * 0.028; }  // motor.js:3108
        else if (tipo === 'rugido') { B.asMul = 1.5; B.furiaT = 5; }               // motor.js:3107
        B.tMec = HAB[tipo].espera;
      }
    } else {
      B.tMec -= dt;
      if (B.tMec <= 0) {
        const tipo = rodizio[B.mecK++ % rodizio.length];                         // motor.js:3115
        B.mec = tipo;
        if (tipo === 'invocar') {                                                // motor.js:3117-3121
          for (let k = 0; k < 2; k++) {
            const nl = Math.max(1, boss.nivel - 6);
            larvas.push({ ataque: 1 + k * 0.3, ad: CURVA_FIEL.ad(nl) * MONSTROS['Larva do Vazio'].ad, as: MONSTROS['Larva do Vazio'].as, nivel: nl, rm: true });
          }
          B.tMec = HAB.invocar.espera; B.mec = null;
        } else { B.carregando = HAB[tipo].carrega; }
      }
    }
    // 3) ataque básico do chefe (motor.js:1725-1737) — só quando não está a carregar
    if (B.carregando <= 0) {
      B.ataque -= dt * B.asMul;
      if (B.ataque <= 0) {
        B.ataque = 1 / boss.as;
        const d = mit(boss.ad, boss.magico ? st.rm : st.armadura);
        levar(d, false, boss.magico);
        eventos.push({ t, tipo: 'basico', dmg: Math.round(d) });
      }
    }
    // 4) larvas (mágicas, motor.js:3118)
    for (const l of larvas) {
      l.ataque -= dt;
      if (l.ataque <= 0) { l.ataque = 1 / l.as; levar(mit(l.ad, st.rm), false, true); }
    }
    if (hp <= 0) break;
    // 5) dano do jogador no chefe
    bossHp -= dps * dt;
    if (bossHp <= 0) { bossHp = 0; matouEm = t; break; }
    // 6) poção (smart) — 1/s (motor.js:41)
    cdPocao = Math.max(0, cdPocao - dt);
    if (o.estrategia) {
      const S = { hp, hpMax, t, cd: cdPocao, healS: o.healS || 0, usadas, boss, carga: B.carregando > 0 ? B.mec : null, eventos, larvas: larvas.length, pjRm: st.rm, pjArm: st.armadura };
      const k = o.estrategia(S);
      if (k && k !== 'FUGIR' && cdPocao <= 0 && (estoque[k] || 0) > 0 && (o.maxPocoes == null || bebidas < o.maxPocoes)) {
        const antes = hp;
        hp = Math.min(hpMax, hp + HEAL[k].cura); curaPocoesFeita += hp - antes;
        usadas[k]++; estoque[k]--; bebidas++; cdPocao = EXAUSTAO;
      }
    }
    hpMin = Math.min(hpMin, hp);
    t += dt;
  }
  const totalPocoes = usadas.vida + usadas.vidaF + usadas.vidaS;
  const custo = usadas.vida * HEAL.vida.preco + usadas.vidaF * HEAL.vidaF.preco + usadas.vidaS * HEAL.vidaS.preco;
  return { vivo: hp > 0, matou: bossHp <= 0, t: +t.toFixed(2), tempoMatar: matouEm != null ? +matouEm.toFixed(2) : null,
    hpMin: Math.round(hpMin), hpMinPct: +(100 * hpMin / hpMax).toFixed(1), usadas, totalPocoes, custo,
    danoRecebido: Math.round(danoRecebido), durPrevista: +durPrevista.toFixed(2), larvas: larvas.length,
    piorGolpe: Math.round(piorGolpe), piorMec: Math.round(piorMec),
    // --- cura (motor.js:1226-1230): rv = roubo de vida; kit = giro/Sede (NÃO é rv); pocoes = o resto ---
    curaRV: Math.round(curaRV), curaKit: Math.round(curaKit), curaFeita: Math.round(curaFeita),
    curaPocoesFeita: Math.round(curaPocoesFeita), escudoFinal: Math.round(escudo),
    curaRVTotal: Math.round(curaRV * multCura * t), curaPorSeg: +((curaFeita + curaPocoesFeita) / Math.max(0.01, t)).toFixed(1) };
}

// =====================================================================================
// ATRIBUTOS — regra do motor (motor.js:2853-2865) com o modelo por campeão (automation.js:2768-2774)
// =====================================================================================
export const MODELOS = {                                                       // motor.js:484-489
  tanque: { pesos: { vitalidade: 2, resistencia: 2, forca: 1 } },
  equilibrado: { pesos: { forca: 2, vitalidade: 2, resistencia: 1, agilidade: 1, foco: 1 } },
  dano: { pesos: { forca: 3, agilidade: 2, vitalidade: 1 } },
  conjurador: { pesos: { foco: 2, forca: 2, vitalidade: 1 } },
};
export const modeloDe = (campeao) => (KITS_SIM[campeao].magia ? 'conjurador' : 'dano');   // automation.js:2768-2774
/** motor.js:2853-2865 — cada ponto vai ao atributo mais atrasado vs o peso. */
export function distribuirAtributos(modelo, nivel) {
  const m = MODELOS[modelo]; const total = Object.values(m.pesos).reduce((s, p) => s + p, 0);
  const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0 };
  let pontos = 3 * (nivel - 1);                                                // motor.js:483 PONTOS_POR_NIVEL = 3
  while (pontos > 0) {
    const soma = Object.values(at).reduce((s, v) => s + v, 0) + 1;
    const chave = Object.entries(m.pesos).sort((a, b) => ((at[a[0]] || 0) - (soma * a[1]) / total) - ((at[b[0]] || 0) - (soma * b[1]) / total))[0][0];
    at[chave]++; pontos--;
  }
  return at;
}

// =====================================================================================
// BUILD IDEAL DA EXTENSÃO — port de automation.js:4398-4444 (montarBuildDe) + pesosItem
// (automation.js:3578-3584) + valorPassiva (automation.js:3816-3883). Serve para CONFERIR
// o port contra as listas MEDIDAS em docs/drops-e-prioridades.md §3.2.
// =====================================================================================
export function perfilDe(campeao) {                                            // automation.js:3563-3572
  const c = KITS_SIM[campeao], pap = c.papel || {};
  const dano = pap.dano != null ? pap.dano : 1, receb = pap.recebido != null ? pap.recebido : 1;
  if (c.magia) return (dano < 1.0 || receb <= 0.66) ? 'tanque' : 'mago';
  if (receb <= 0.62 && dano < 1.0) return 'tanque';
  return 'dano';
}
export function pesosItem(perfil) {                                            // automation.js:3578-3584
  if (perfil === 'tanque') return { ad: 0.2, ap: 0.3, va: 50, critico: 0, rv: 1, vida: 0.7, armadura: 3, rm: 3, cdr: 200, mana: 0.01, regen: 0.5 };
  if (perfil === 'mago') return { ad: 0, ap: 1.2, va: 80, critico: 0, rv: 1, vida: 0.15, armadura: 0.3, rm: 0.3, cdr: 300, mana: 0.03, regen: 0.6 };
  if (perfil === 'atirador') return { ad: 1.3, ap: 0, va: 400, critico: 500, rv: 3, vida: 0.03, armadura: 0.15, rm: 0.15, cdr: 120, mana: 0.01, regen: 0.2 };
  return { ad: 1.4, ap: 0.9, va: 350, critico: 400, rv: 3, vida: 0.03, armadura: 0.15, rm: 0.15, cdr: 180, mana: 0.01, regen: 0.2 };
}
export function classeItem(id) {                                               // automation.js:3586-3591 = motor.js:22
  const it = ITENS[String(id)]; if (!it) return 'neutro';
  const ad = it.ad || it.critico || it.va || it.rv;
  return it.ap && !ad ? 'ap' : ad && !it.ap ? 'ad' : 'neutro';
}
export function valorPassiva(id, campeao) {                                    // automation.js:3816-3883
  const it = ITENS[String(id)]; const e = String((it && it.efeito) || '');
  if (!e) return 0;
  const c = KITS_SIM[campeao]; const ap = !!c.magia, tank = perfilDe(campeao) === 'tanque';
  const n = (re) => { const m = e.match(re); return m ? parseFloat(String(m[1]).replace(',', '.')) : 0; };
  let v = 0;
  v += n(/Poder de Habilidade total em ([\d,]+)%/i) * 9;
  v += n(/([\d,]+)%\s*de penetração mágica/i) * (ap ? 7 : 1);
  if (/queimam o alvo/i.test(e)) v += ap ? 140 : 20;
  if (/menos de 40% de Vida/i.test(e)) v += ap ? 90 : 15;
  v += n(/próximo ataque causa \+([\d,]+)%/i) * (ap ? 2.2 : 1.2);
  v += n(/Dano de Ataque total em ([\d,]+)%/i) * (ap ? 1 : 9);
  v += n(/([\d,]+)%\s*de roubo de vida/i) * 4;
  v += n(/([\d,]+)%\s*de Velocidade de Ataque/i) * (ap ? 2 : 6);
  if (/quem te ataca recebe/i.test(e)) v += tank ? 70 : 6;
  v += n(/Resistência Mágica total em ([\d,]+)%/i) * (tank ? 3 : 0.5);
  v += n(/Armadura total em ([\d,]+)%/i) * (tank ? 3 : 0.5);
  v += n(/([\d,]+)%\s*de\s*Armadura total/i) * (tank ? 3 : 0.5);
  v += n(/([\d,]+)%\s*de\s*Resist[êe]ncia M[áa]gica total/i) * (tank ? 3 : 0.5);
  v += n(/([\d,]+)%\s*de\s*Poder de Habilidade(?!\s*total em)/i) * 9;
  if (it.cdr == null) v += n(/[\u2212-]([\d,]+)%\s*na recarga/i) * 6;
  v += n(/\+([\d,]+)%\s*de esquiva/i) * 3;
  v += n(/([\d,]+)%\s*de\s*Dano de Ataque total/i) * (ap ? 1 : 9);
  v += n(/\+([\d,]+)%\s*de\s*Vida m[áa]xima/i) * (tank ? 6 : 2);
  v += n(/\+([\d,]+)%\s*em toda cura recebida/i) * 1.5;
  v += n(/acertos cr[íi]ticos causam \+([\d,]+)%/i) * (ap ? 3 : 12);
  v += n(/([\d,]+)%\s*de penetra[çc][ãa]o de armadura/i) * (ap ? 2 : 7);
  v += n(/reduz a Armadura do alvo em ([\d,]+)%/i) * (ap ? 1 : 4);
  v += n(/([\d,]+)%\s*da Vida atual do alvo/i) * (ap ? 3 : 5);
  v += n(/ataques causam ([\d,]+)% do Dano de Ataque/i) * (ap ? 2 : 6);
  v += n(/([\d,]+)%\s*da sua Vida m[áa]xima/i) * (tank ? 5 : 2);
  v += n(/habilidades causam \+([\d,]+)% de dano/i) * (ap ? 6 : 2);
  v += n(/([\d,]+)%\s*da sua Mana m[áa]xima/i) * 3;
  v += n(/([\d,]+)%\s*da Vida b[ôo]nus/i) * (ap ? 1 : 5);
  return v;
}
/** automation.js:4398-4444 — 1 bota + 4 melhores entre épicos e lendários. */
export function buildExtensao(campeao, opts) {
  opts = opts || {};
  const perfil = perfilDe(campeao), classe = KITS_SIM[campeao].magia ? 'ap' : 'ad', w = pesosItem(perfil);
  const poder = (i) => {
    const v = (i.ad || 0) * w.ad + (i.ap || 0) * w.ap + (i.va || 0) * w.va + (i.critico || 0) * w.critico + (i.rv || 0) * w.rv
      + (i.vida || 0) * w.vida + (i.armadura || 0) * w.armadura + (i.rm || 0) * w.rm
      + (i.cdr || 0) * w.cdr + (i.mana || 0) * w.mana + (i.regen || 0) * w.regen + valorPassiva(i.id, campeao);
    const cl = classeItem(i.id);
    const multClasse = cl === 'neutro' ? 1 : (cl === classe ? 1 : 0.12);
    const ofensivo = (i.ad || 0) + (i.ap || 0) + (i.va || 0) + (i.critico || 0) + (i.rv || 0) + (i.cdr || 0);
    const multDef = (perfil !== 'tanque' && ofensivo === 0) ? 0.3 : 1;
    return v * multClasse * multDef * (({ basico: 1, epico: 1.15, lendario: 1.35 })[i.raridade] || 1);
  };
  const todos = Object.values(ITENS).filter((i) => i.raridade === 'lendario' || i.raridade === 'epico');
  const cmp = (a, b) => (poder(b) - poder(a)) || (String(a.id) < String(b.id) ? -1 : 1);
  const botas = todos.filter((i) => i.espaco === 'botas').sort(cmp)[0] || null;
  const usados = new Set(botas ? [String(botas.id)] : []);
  const out = botas ? [String(botas.id)] : [];
  if (opts.objetivoItem) {
    const alvo = String(opts.objetivoItem); const it = todos.find((i) => String(i.id) === alvo); const cl = classeItem(alvo);
    if (it && !usados.has(alvo) && (cl === 'neutro' || cl === classe)) { usados.add(alvo); out.push(alvo); }
  }
  for (const i of todos.slice().sort(cmp)) {
    if (out.length >= 5) break;
    if (usados.has(String(i.id))) continue;
    if (i.espaco === 'botas') continue;
    usados.add(String(i.id)); out.push(String(i.id));
  }
  return out;
}

// =====================================================================================
// BUSCA DA BUILD POR DPS REAL contra o chefe (substitui os pesos heurísticos)
// =====================================================================================
/**
 * 1) shortlist por contribuição individual; 2) exaustivo 4-a-4 na shortlist; 3) melhoria
 * local trocando cada peça por qualquer uma do catálogo. Os ranks são fixados na melhor
 * build da extensão (aproximação documentada: os ranks mudam pouco com a build).
 */
export function melhoresBuilds(campeao, nivel, boss, opts) {
  opts = opts || {};
  const atrib = opts.atrib || distribuirAtributos(modeloDe(campeao), nivel);
  const todos = Object.values(ITENS).filter((i) => i.raridade === 'lendario' || i.raridade === 'epico');
  const botas = todos.filter((i) => i.espaco === 'botas');
  const outros = todos.filter((i) => i.espaco !== 'botas');
  const refSt = statsJogador(campeao, nivel, buildExtensao(campeao), atrib);
  const ranks = opts.ranks || ranksNoNivel(campeao, nivel, refSt, boss);
  // filtro sobre a build completa (ex.: exigir >= 1 item com roubo de vida, ou proibi-lo)
  const filtro = opts.filtro || (() => true);
  const forca = (opts.forcaItens || []).map(String);
  const cache = new Map();
  const dpsDe = (ids) => {
    const k = ids.join(','); if (cache.has(k)) return cache.get(k);
    const v = dpsTeorico(campeao, nivel, ids, boss, { atrib, ranks }).total;
    cache.set(k, v); return v;
  };
  const rankOutros = outros.map((i) => ({ id: String(i.id), s: dpsDe([i.id]) })).sort((a, b) => b.s - a.s).slice(0, opts.shortlist || 24);
  const rankBotas = botas.map((i) => ({ id: String(i.id), s: dpsDe([i.id]) })).sort((a, b) => b.s - a.s).slice(0, 4);
  // os itens obrigatórios (ex.: os de roubo de vida) entram SEMPRE na shortlist, mesmo que o DPS os corte
  const naLista = new Set(rankOutros.map((x) => x.id));
  for (const f of forca) {
    const it = outros.find((i) => String(i.id) === f);
    if (it && !naLista.has(f)) { rankOutros.push({ id: f, s: dpsDe([f]) }); naLista.add(f); }
    const ib = botas.find((i) => String(i.id) === f);
    if (ib && !rankBotas.some((x) => x.id === f)) rankBotas.push({ id: f, s: dpsDe([f]) });
  }
  let lista = [];
  for (const bt of rankBotas) {
    for (let a = 0; a < rankOutros.length; a++) for (let b = a + 1; b < rankOutros.length; b++)
      for (let c = b + 1; c < rankOutros.length; c++) for (let d = c + 1; d < rankOutros.length; d++) {
        const ids = [bt.id, rankOutros[a].id, rankOutros[b].id, rankOutros[c].id, rankOutros[d].id];
        if (!filtro(ids)) continue;
        lista.push({ ids, dps: dpsDe(ids) });
      }
  }
  lista.sort((x, y) => y.dps - x.dps);
  // melhoria local nas 6 melhores (sempre a respeitar o filtro)
  for (let i = 0; i < Math.min(6, lista.length); i++) {
    let cur = lista[i].ids.slice(), curDps = lista[i].dps, mudou = true;
    while (mudou) {
      mudou = false;
      for (let p = 0; p < 5; p++) {
        for (const cand of todos) {
          const id = String(cand.id);
          if (cur.includes(id)) continue;
          if (p === 0 && cand.espaco !== 'botas') continue;
          if (p > 0 && cand.espaco === 'botas') continue;
          const novo = cur.slice(); novo[p] = id;
          if (!filtro(novo)) continue;
          const v = dpsDe(novo);
          if (v > curDps + 1e-9) { cur = novo; curDps = v; mudou = true; }
        }
      }
    }
    lista[i] = { ids: cur, dps: curDps };
  }
  // deduplica e ordena
  const visto = new Set(); const out = [];
  for (const x of lista.slice().sort((a, b) => b.dps - a.dps)) {
    const k = x.ids.slice(1).sort().join(',');
    if (visto.has(k)) continue; visto.add(k); out.push(x);
  }
  return out;
}

// =====================================================================================
// CALIBRAÇÃO contra os snapshots MEDIDOS + varredura de níveis
// =====================================================================================
const SNAPSHOT_ATRIB = {
  yasuo: { forca: 10, vitalidade: 7, resistencia: 4, agilidade: 3, foco: 0 },     // ajuste do nv12 (6 setups)
  katarina: { forca: 84, vitalidade: 0, resistencia: 4, agilidade: 0, foco: 0 },  // ajuste do nv29 (1 setup)
};
/**
 * VALIDAÇÃO contra uma luta REAL medida (docs/snapshots/katarina.json): o Dragão Infernal
 * do snapshot bateu 296 de dano a cada ~1,75 s na Katarina nv29 com RM 134.
 * Modelo: Fosso do Dragão nm=[30,38] (motor.js:369) -> chefe nv max(32, min(40, 29+4)) = 33;
 * ad = CURVA.ad(33) × 3 (motor.js:296) = 927; mitigação por RM (motor.js:1167) e papel 0,75
 * (motor.js:884) -> 296. Serve de prova de que o nível do chefe e a conta do dano estão certos.
 */
export function validarLutaMedida() {
  const f = path.join(__dir, '..', 'docs', 'snapshots', 'katarina.json');
  if (!fs.existsSync(f)) return null;
  let d = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (typeof d === 'string') d = JSON.parse(d);
  const l = (d.lutas || []).find((x) => x.hist && x.hist.length > 10 && /Dragão/.test(x.boss || ''));
  if (!l) return null;
  const hits = l.hist.filter((h) => h.t === 'hit' && h.drop > 200 && h.drop < 450);
  const med = hits.map((h) => h.drop).sort((a, b) => a - b)[Math.floor(hits.length / 2)];
  const dropBoss = l.hist.filter((h) => h.t === 'hit' && h.drop > 500).map((h) => h.drop).sort((a, b) => a - b);
  const nivelJogador = (l.hist[0] && l.hist[0].hp) ? 29 : 29;                    // nível da conta do snapshot
  const bossNivel = nivelDoChefe([30, 38], nivelJogador);                        // motor.js:369
  const b = statsBossFiel('Dragão Infernal', bossNivel);
  const st = statsJogador('katarina', nivelJogador, l.build || [], SNAPSHOT_ATRIB.katarina);
  const previsto = mit(b.ad, st.rm) * fatorDanoMonstro(nivelJogador, bossNivel) * KITS_SIM.katarina.papel.recebido;
  const mec = mit(b.ad * 2.2, st.rm) * fatorDanoMonstro(nivelJogador, bossNivel) * KITS_SIM.katarina.papel.recebido;
  return { boss: l.boss, bossNivel, medido: med, previsto: Math.round(previsto), n: hits.length,
    soproMedido: dropBoss.length ? dropBoss[Math.floor(dropBoss.length / 2)] : null, soproPrevisto: Math.round(mec),
    queimadoPorSegundo: Math.round(0.03 * st.vida), durS: l.durS, potUsadas: l.potUsadas };
}
/** Compara o modelo de stats com os snapshots medidos (docs/snapshots/*.json). */
export function calibrarContraSnapshots() {
  const out = [];
  for (const fich of ['yasuo', 'katarina']) {
    const f = path.join(__dir, '..', 'docs', 'snapshots', fich + '.json');
    if (!fs.existsSync(f)) { out.push({ fich, erro: 'snapshot ausente' }); continue; }
    let d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (typeof d === 'string') d = JSON.parse(d);
    const visto = new Set();
    for (const c of (d.cycles || [])) {
      const s = c.setup || {}, p = s.player || {};
      if (!p.nivel) continue;
      const eq = (s.equip || []).map((e) => e.id);
      const chave = p.nivel + '|' + eq.join(',');
      if (visto.has(chave)) continue; visto.add(chave);
      const st = statsJogador(fich, p.nivel, eq, SNAPSHOT_ATRIB[fich]);
      out.push({ fich, nivel: p.nivel, eq, med: p, calc: st,
        err: { vida: +(st.vida - p.vida).toFixed(1), ad: +(st.ad - p.dano).toFixed(2), armadura: +(st.armadura - p.armadura).toFixed(2),
               rm: +(st.rm - p.rm).toFixed(2), va: p.va != null ? +(st.velAtaque - p.va).toFixed(3) : null, ap: p.poder != null ? +(st.ap - p.poder).toFixed(1) : null } });
    }
  }
  return out;
}

// =====================================================================================
// VARREDURA: com que nível cada build mata o Barão
// =====================================================================================
export const BARAO_NM = [40, 48];        // motor.js:371 (Covil do Barão)
export const BARAO_FAIXA = [40, 50];     // motor.js:371

/**
 * ROUBO DE VIDA DA BUILD (motor.js:1226-1230): cura/s = dano de AUTO-ATAQUE por segundo x rouboVida.
 * O dano de auto por segundo sai do dpsTeorico (det.autoCura = só o que o motor golpeia com
 * fonte 'ataque'); o rouboVida sai dos stats (motor.js:538, soma dos rv dos itens já com
 * qualidade/refino, motor.js:254). A 3065 multiplica a cura por 1,25 (motor.js:1286) e a 3072
 * transforma o excesso em escudo (motor.js:1229). As curas do KIT (giro da Voracidade,
 * motor.js:2169-2170; Sede de Sangue, motor.js:1685) vão separadas em curaKit — NÃO são rv.
 */
export function curaDaBuild(campeao, nivel, itens, boss, opts) {
  opts = opts || {};
  const d = opts.d || dpsTeorico(campeao, nivel, itens, boss, { atrib: opts.atrib, ranks: opts.ranks });
  const st = d.st;
  const rouboVida = st.rouboVida || 0;
  const tem3065 = temItem(itens, '3065');
  const tem3072 = temItem(itens, '3072');
  const multCura = tem3065 ? 1.25 : 1;
  const curaRVBase = d.det.autoCura * rouboVida;                       // motor.js:1226 (só autos)
  const curaRV = opts.semRV ? 0 : curaRVBase * multCura;
  const curaGiro = (d.curaGiro || 0) * multCura;                       // motor.js:2169-2170 (kit da Katarina)
  const curaSede = (d.det.curaSede || 0) * multCura;                   // motor.js:1685 (kit da Katarina)
  return { rouboVida, tem3065, tem3072, multCura, dpsAuto: d.det.auto, dpsAutoCura: d.det.autoCura,
    curaRVBase, curaRV, curaGiro, curaSede, curaKit: curaGiro + curaSede };
}

/** Corre a luta completa contra o Barão num nível/build (JÁ com o roubo de vida, motor.js:1226). */
export function lutarBarao(campeao, nivel, itens, opts) {
  opts = opts || {};
  const bossNivel = nivelDoChefe(BARAO_NM, nivel);
  const boss = statsBossFiel('Barão Nashor', bossNivel);
  const atrib = opts.atrib || distribuirAtributos(modeloDe(campeao), nivel);
  const d = dpsTeorico(campeao, nivel, itens, boss, { atrib, ranks: opts.ranks, multAp: opts.multAp });
  const cura = curaDaBuild(campeao, nivel, itens, boss, { d, semRV: opts.semRV });
  const comum = { campeao, nivel, st: d.st, boss, dps: d.total, maxSeg: opts.maxSeg || 300, maxPocoes: opts.maxPocoes,
    curaRV: cura.curaRV, curaKit: cura.curaKit, tem3065: cura.tem3065, tem3072: cura.tem3072 };
  const r = lutarChefe({ ...comum, estrategia: opts.estrategia || smartCarga({ pisoPct: 0.65 }) });
  const semPocao = lutarChefe({ ...comum, estrategia: () => null });
  return { bossNivel, boss, d, cura, r, semPocao };
}

// =====================================================================================
// O CRITÉRIO: A TUPLA, NÃO O DPS  (regra do dono, 2026-10-14)
//   ( mata? , segundos , ouro gasto em poções , ouro total da luta )
// O "ouro total da luta" é DEFINIDO aqui: poções gastas NA luta + preço de catálogo dos 5
// itens equipados (itens.js 'preco'; o refino NÃO está incluído — motor.js:258 tem
// precoRefino, que é o custo de re-forjar, não o preço do item). Dizer isto é obrigatório
// porque sem definição a 4.ª componente não significa nada.
// =====================================================================================
export const DEFINICAO_TUPLA = '(mata?, segundos, ouro em poções, ouro total = poções + preço de catálogo dos 5 itens)';

export const precoItem = (x) => ((ITENS[baseId(x)] || {}).preco || 0);
export const ouroDoEquipamento = (itens) => itens.reduce((s, x) => s + precoItem(x), 0);

/** Ordena pela TUPLA (não por DPS). Quem mata vem primeiro; entre quem mata, menos segundos;
 *  empate nos segundos -> menos ouro em poções; empate -> menos ouro total. Quem NÃO mata
 *  ordena por tempo aguentado (desc) e depois por ouro em poções (asc). */
export function compararTupla(a, b) {
  if (a.mata !== b.mata) return a.mata ? -1 : 1;
  if (a.mata) {
    if (a.seg !== b.seg) return a.seg - b.seg;
    if (a.custoPocoes !== b.custoPocoes) return a.custoPocoes - b.custoPocoes;
    return a.ouroTotal - b.ouroTotal;
  }
  const ta = a.t || 0, tb = b.t || 0;
  if (ta !== tb) return tb - ta;
  return a.custoPocoes - b.custoPocoes;
}

/** Avalia UMA build contra o Barão e devolve a TUPLA inteira (sem colapsar num escalar). */
export function avaliarLuta(campeao, nivel, itens, opts) {
  opts = opts || {};
  const x = lutarBarao(campeao, nivel, itens, opts);
  const mata = !!(x.r.matou && x.r.vivo);
  const ouroEquip = ouroDoEquipamento(itens);
  return {
    campeao, nivel, itens, bossNivel: x.bossNivel, boss: x.boss,
    mata, seg: mata ? x.r.tempoMatar : null, t: x.r.t, motivo: x.r.motivo || (x.r.vivo ? 'nao matou em ' + x.r.t + 's' : 'morreu'),
    pocoes: x.r.totalPocoes, usadas: x.r.usadas, custoPocoes: x.r.custo,
    ouroEquip, ouroTotal: x.r.custo + ouroEquip,
    dps: x.d.total, hpMin: x.r.hpMin, hpMinPct: x.r.hpMinPct, danoRecebido: x.r.danoRecebido,
    piorGolpe: x.r.piorGolpe, piorMec: x.r.piorMec,
    rouboVida: x.cura.rouboVida, curaRV: x.cura.curaRV, curaKit: x.cura.curaKit, curaTotal: x.r.curaFeita,
    semPocao: { mata: !!(x.semPocao.matou && x.semPocao.vivo), t: x.semPocao.t, hpMin: x.semPocao.hpMin },
    det: x.d.det, st: x.d.st, cura: x.cura, r: x.r, d: x.d,
  };
}

/** Linha legível da tupla. */
export function linhaTupla(a) {
  const seg = a.mata ? a.seg + ' s' : (a.motivo === 'morreu' ? 'MORRE aos ' + a.t + ' s' : 'nao mata (' + a.motivo + ')');
  return (a.mata ? 'MATA ' : 'NAO  ') + String(seg).padEnd(22) + '| pocoes ' + String(a.pocoes).padStart(3)
    + ' = ' + String(a.custoPocoes).padStart(6) + ' g | ouro total ' + String(a.ouroTotal).padStart(7) + ' g'
    + ' | rv ' + (100 * a.rouboVida).toFixed(0) + '% cura ' + Math.round(a.curaRV) + '/s';
}
/** Primeiro nível em que a build SOBREVIVE e MATA (varre nivel de..50). */
export function primeiroNivelQueMata(campeao, itens, opts) {
  opts = opts || {};
  for (let n = (opts.de || 1); n <= 50; n++) {
    const x = lutarBarao(campeao, n, itens, opts);
    if (x.r.matou && x.r.vivo) return { nivel: n, bossNivel: x.bossNivel, boss: x.boss, d: x.d, r: x.r, cura: x.cura, semPocao: x.semPocao };
  }
  return null;
}

// =====================================================================================
// O CRITÉRIO DO DONO (2026-10-14): A TUPLA + O ROUBO DE VIDA NA LUTA
//   "a build nao é só dps nao. é tornar possivel enfrentar um boss ou nao, e em quantos
//    segundos ... com quantas pocoes e quanto custam em ouro ... o roubo de vida substitui
//    pocoes, e a que nivel deixa de compensar"
// Regra de evidência: roubo de vida = motor.js:1226-1230; cura x1,25 do 3065 = motor.js:1286;
// escudo do 3072 = motor.js:1229; poções = motor.js:261-267 + exaustão motor.js:41; ouro do
// abate = motor.js:1071 + motor.js:278 + motor.js:297.
// =====================================================================================

/** Os 7 itens do catálogo com rv > 0 (itens.js; medido: 1053 .07 | 3008 .07 | 3168 .12 |
 *  3172 .06 | 3153 .10 | 3074 .12 | 3072 .15). O motor soma-os em rouboVida (motor.js:538). */
export const ITENS_RV = Object.values(ITENS).filter((i) => (i.rv || 0) > 0).map((i) => String(i.id));
export const ehRV = (id) => ((ITENS[baseId(id)] || {}).rv || 0) > 0;

/**
 * ATRIBUTOS DO DONO — MEDIDOS no painel, NÃO deduzidos de totais: Força 81, Vitalidade 3,
 * resto 0, Foco 0 (o CDR dele vem TODO do Ímpeto, 23,46% = 0,15 x (1+0,12x3) x 1,15).
 * A regra abaixo reproduz exactamente esse painel no nível 29: 3x28-3 = 81 de Força e 3 de
 * Vitalidade. Para outros níveis é a MESMA regra (é a única forma de variar o nível sem
 * inventar): todos os pontos em Força, 3 em Vitalidade, 0 em Foco.
 * NOTA: o atributo 'forca' do Yasuo dá 1,2 de AD/ponto (motor.js:503) e o da Katarina dá
 * 2 de AP/ponto (motor.js:503) — a mesma regra vale para os dois.
 */
export function atribDono(nivel) {
  const pontos = 3 * (nivel - 1);                       // motor.js:483 (3 por nível)
  const vit = Math.min(3, Math.max(0, pontos));
  return { forca: Math.max(0, pontos - vit), vitalidade: vit, resistencia: 0, agilidade: 0, foco: 0 };
}

/** Melhores builds de UMA família (com rv / sem rv), ordenadas pela TUPLA e não pelo DPS. */
export function buildsDaFamilia(campeao, nivel, opts) {
  opts = opts || {};
  const atrib = opts.atrib || atribDono(nivel);
  const boss = opts.boss || statsBossFiel('Barão Nashor', nivelDoChefe(BARAO_NM, nivel));
  const ranks = opts.ranks || ranksNoNivel(campeao, nivel, statsJogador(campeao, nivel, buildExtensao(campeao), atrib), boss);
  const familia = opts.familia || 'todas';       // 'com' | 'sem' | 'todas'
  const filtro = familia === 'com' ? (ids) => ids.some(ehRV) : familia === 'sem' ? (ids) => !ids.some(ehRV) : (() => true);
  const cands = melhoresBuilds(campeao, nivel, boss, { atrib, ranks, shortlist: opts.shortlist || 16, filtro, forcaItens: opts.forcaItens });
  const aval = cands.slice(0, opts.topo || 12).map((x) => avaliarLuta(campeao, nivel, x.ids, { atrib, ranks, estrategia: opts.estrategia, maxPocoes: opts.maxPocoes }));
  aval.sort(compararTupla);
  return aval;
}

/**
 * ECONOMIA DO ROUBO DE VIDA POR NÍVEL — o coração da pergunta 3.
 * Para cada nível devolve, para as duas famílias:
 *   - a TUPLA da luta (mata? / segundos / ouro em poções / ouro total);
 *   - ouro em poções POR HORA DE FARM = custo x (3600/seg)  (é o "uso" que o dono diz que
 *     torna as poções caras);
 *   - o PONTO DE VIRAGEM em ouro de loot por abate:
 *       L* = (abates_sem x custo_sem - abates_rv x custo_rv) / (abates_sem - abates_rv)
 *     rv compensa (em ouro/hora) se o loot por abate L for MENOR que L*.
 *     L* só existe se a build com rv gastar menos ouro/hora que a sem rv.
 */
export function economiaDoRV(campeao, opts) {
  opts = opts || {};
  const de = opts.de || 20, ate = opts.ate || 50;
  const linhas = [];
  for (let n = de; n <= ate; n++) {
    const atrib = atribDono(n);
    const bossNivel = nivelDoChefe(BARAO_NM, n);
    const boss = statsBossFiel('Barão Nashor', bossNivel);
    const ranks = ranksNoNivel(campeao, n, statsJogador(campeao, n, buildExtensao(campeao), atrib), boss);
    const com = buildsDaFamilia(campeao, n, { familia: 'com', atrib, ranks, boss, shortlist: opts.shortlist || 14, topo: 6 });
    const sem = buildsDaFamilia(campeao, n, { familia: 'sem', atrib, ranks, boss, shortlist: opts.shortlist || 14, topo: 6 });
    const A = com[0], B = sem[0];
    const abates = (x) => (x.mata && x.seg > 0 ? 3600 / x.seg : 0);
    const gpH = (x) => abates(x) * x.custoPocoes;                       // ouro em poções por hora
    const aA = abates(A), aB = abates(B);
    const dAbates = aB - aA;
    const L = dAbates > 1e-9 ? (aB * B.custoPocoes - aA * A.custoPocoes) / dAbates : null;
    linhas.push({ nivel: n, bossNivel, boss, com: A, sem: B,
      abatesCom: aA, abatesSem: aB, ouroPocoesHoraCom: gpH(A), ouroPocoesHoraSem: gpH(B),
      lootPorAbate: ouroPorAbate('Barão Nashor', bossNivel, n), LStar: L });
  }
  return linhas;
}

/**
 * CUSTO DE OPORTUNIDADE DO ITEM DE RV — a pergunta 3 do dono: "o dano/segundos que perdes"
 * por levar um item de roubo de vida. Para CADA item com rv da build, substitui-o pelo melhor
 * item SEM rv do MESMO espaço (motor.js:29-33: botas num espaço próprio) e re-corre a luta.
 * Devolve o que se perde/ganha em segundos, poções e ouro.
 */
export function custoDeOportunidadeRV(campeao, nivel, build, opts) {
  opts = opts || {};
  const atrib = opts.atrib || atribDono(nivel);
  const boss = opts.boss || statsBossFiel('Barão Nashor', nivelDoChefe(BARAO_NM, nivel));
  const ranks = opts.ranks || ranksNoNivel(campeao, nivel, statsJogador(campeao, nivel, buildExtensao(campeao), atrib), boss);
  const base = avaliarLuta(campeao, nivel, build, { atrib, ranks });
  const out = [];
  for (let p = 0; p < build.length; p++) {
    if (!ehRV(build[p])) continue;
    const slot = (ITENS[baseId(build[p])] || {}).espaco;
    const cands = Object.values(ITENS).filter((i) => (i.raridade === 'lendario' || i.raridade === 'epico')
      && i.espaco === slot && !((i.rv || 0) > 0) && !build.some((x) => baseId(x) === String(i.id)));
    const aval = cands.map((i) => avaliarLuta(campeao, nivel, build.map((x, k) => (k === p ? String(i.id) : x)), { atrib, ranks }));
    aval.sort(compararTupla);
    out.push({ posicao: p, sai: build[p], nomeSai: (ITENS[baseId(build[p])] || {}).nome, slot, base, melhorSem: aval[0], todos: aval });
  }
  return out;
}

/** Relatório da LUTA (não do DPS) — é o que docs/build-por-luta.md resume. */
export function relatorioPorLuta(opts) {
  opts = opts || {};
  const L = (s) => console.log(s);
  const f = (n) => Number(Math.round(n)).toLocaleString('pt-PT');
  const CAMPEOES = opts.campeoes || ['yasuo', 'katarina'];
  const NIVEIS = opts.niveis || { yasuo: 45, katarina: 35 };
  const resumo = {};

  L('');
  L('################ POR-LUTA — O CRITERIO E A TUPLA (nao o DPS) ################');
  L('');
  L('-- [1] O que se mede (a tupla NAO e um escalar: as 4 componentes sao mostradas sempre) --');
  L('  TUPLA = ' + DEFINICAO_TUPLA);
  L('  1) da para enfrentar o chefe? (MATA e SOBREVIVE)   motor.js:1226-1230 (rv), 2693-2734 (receberDano)');
  L('  2) em quantos segundos?                            hpMax do chefe / dps do campeao (motor.js:274,296)');
  L('  3) com quantas pocoes e quanto custam?             motor.js:261-267 (cura/preco) + motor.js:41 (1/s)');
  L('  4) o roubo de vida substitui pocoes? a que nivel?  cura/s = dps de AUTO x rouboVida (motor.js:1226)');
  L('  Cura modelada: curaRV = dpsAutoCura x rouboVida x (3065?1,25:1) [motor.js:1226,1286];');
  L('  o excesso vira escudo ate 25% da vida com a 3072 [motor.js:1229]; pocoes a 1/s [motor.js:41];');
  L('  as pocoes so existem a partir do nivel delas [motor.js:1294 + 262-264: vida 1, forte 15, suprema 30].');
  L('  Atributos: ' + JSON.stringify(atribDono(29)) + ' no nv29 = o painel MEDIDO do dono (Forca 81, Vit 3, Foco 0).');
  L('  Itens com roubo de vida (rv>0) no catalogo: ' + ITENS_RV.map((id) => id + ' ' + (ITENS[id].nome || '') + ' rv ' + ITENS[id].rv).join(' | '));
  L('  (o 3065 NAO esta no catalogo: nao ha item com id 3065 em itens.js -> x1,25 da cura fica NAO VERIFICADO por build)');

  for (const camp of CAMPEOES) {
    const nivel = NIVEIS[camp] || 35;
    L('');
    L('-- [2] ' + camp.toUpperCase() + ' nv' + nivel + ' (Barao nv' + nivelDoChefe(BARAO_NM, nivel) + ') — builds ordenadas pela TUPLA --');
    const com = buildsDaFamilia(camp, nivel, { familia: 'com', shortlist: 18, topo: 12 });
    const sem = buildsDaFamilia(camp, nivel, { familia: 'sem', shortlist: 18, topo: 12 });
    const todas = [...com, ...sem].sort(compararTupla);
    for (const x of todas.slice(0, 8)) {
      L('   ' + linhaTupla(x));
      L('       itens ' + x.itens.join(',') + '  [dps ' + f(x.dps) + ' | ouro dos itens ' + f(x.ouroEquip) + ' | hpMin ' + x.hpMin + ' (' + x.hpMinPct + '%) | cura do kit ' + f(x.curaKit) + '/s]');
    }
    const melhorCom = com[0], melhorSem = sem[0];
    const matam = todas.filter((x) => x.mata);
    const maisRapido = matam.slice().sort((a, b) => (a.seg - b.seg) || (a.custoPocoes - b.custoPocoes))[0] || null;
    const menorPocoes = matam.slice().sort((a, b) => (a.custoPocoes - b.custoPocoes) || (a.seg - b.seg))[0] || null;
    L('   -> melhor COM rv: ' + melhorCom.itens.join(',') + '  rv ' + (100 * melhorCom.rouboVida).toFixed(0) + '%  cura ' + f(melhorCom.curaRV) + '/s');
    L('   -> melhor SEM rv: ' + melhorSem.itens.join(','));
    L('   -> vencedor da TUPLA: ' + (compararTupla(melhorCom, melhorSem) <= 0 ? 'COM rv' : 'SEM rv'));
    L('   -> (a) MATA mais cedo: ' + (maisRapido ? maisRapido.itens.join(',') + ' em ' + maisRapido.seg + ' s com ' + maisRapido.pocoes + ' pocoes (' + f(maisRapido.custoPocoes) + ' g)' : 'nenhuma build mata'));
    L('   -> (b) MENOR custo de pocoes: ' + (menorPocoes ? menorPocoes.itens.join(',') + ' em ' + menorPocoes.seg + ' s com ' + menorPocoes.pocoes + ' pocoes (' + f(menorPocoes.custoPocoes) + ' g)' : 'nenhuma build mata'));

    // ---- [3] custo de oportunidade do item de rv (dano/segundos que se perdem) ----
    L('');
    L('-- [3] ' + camp.toUpperCase() + ' — CUSTO DE OPORTUNIDADE DE CADA ITEM DE RV (troca pelo melhor SEM rv do mesmo espaco) --');
    for (const oc of custoDeOportunidadeRV(camp, nivel, melhorCom.itens)) {
      const m = oc.melhorSem;
      const itEntra = ITENS[baseId(m.itens[oc.posicao])] || {};
      L('   sai ' + oc.sai + ' (rv ' + (100 * ((ITENS[baseId(oc.sai)] || {}).rv || 0)).toFixed(0) + '%, ' + oc.nomeSai + ') -> entra ' + m.itens[oc.posicao] + ' (rv ' + (100 * (itEntra.rv || 0)).toFixed(0) + '%, ' + itEntra.nome + '); a build fica com rv ' + (100 * m.rouboVida).toFixed(0) + '%');
      L('      build COM ' + oc.sai + ': ' + linhaTupla(oc.base));
      L('      build SEM ' + oc.sai + ': ' + linhaTupla(m));
      L('      custo de levar o item de rv (rv - alternativa): segundos ' + (oc.base.mata && m.mata ? (oc.base.seg - m.seg >= 0 ? '+' : '') + (oc.base.seg - m.seg).toFixed(2) + ' s' : 'n/a')
        + ' | pocoes ' + (oc.base.pocoes - m.pocoes) + ' | ouro em pocoes ' + f(oc.base.custoPocoes - m.custoPocoes) + ' g'
        + ' | DPS ' + f(oc.base.dps - m.dps) + ' (negativo = o rv e mais rapido/mais barato)');
    }
    resumo[camp] = { nivel, com, sem, todas, melhorCom, melhorSem, maisRapido, menorPocoes };
  }

  // ---- [4] ECONOMIA POR NIVEL ----
  L('');
  L('-- [4] ECONOMIA: ouro em pocoes por luta e por HORA DE FARM, e o ponto de viragem do rv --');
  L('  (loot por abate = CURVA.ouro(nivel do chefe) x 20 do Barao x 0,75 medio [motor.js:278,297,1071] x fatorSaque [motor.js:421])');
  L('  L* = ouro de loot por abate em que o rv EMPATA em ouro/hora: rv compensa se o loot for MENOR que L*.');
  const eco = {};
  for (const camp of CAMPEOES) {
    L('');
    L('  === ' + camp.toUpperCase() + ' ===');
    L('   nv | Barao | loot/abate | COM rv: mata/seg/pocoes/ouro/ouro-hora | SEM rv: mata/seg/pocoes/ouro/ouro-hora | L*');
    const linhas = economiaDoRV(camp, { de: opts.de || 22, ate: opts.ate || 50 });
    eco[camp] = linhas;
    const cel = (x, loot) => (x.mata ? 'MATA ' + String(x.seg).padStart(5) + 's' : 'NAO  ' + String(x.t).padStart(5) + 's') + ' ' + String(x.pocoes).padStart(3) + 'p ' + String(x.custoPocoes).padStart(5) + 'g ' + String(Math.round(x.mata ? 3600 / x.seg * x.custoPocoes : 0)).padStart(8) + 'g/h ' + String(Math.round(100 * x.custoPocoes / loot)).padStart(4) + '%loot';
    for (const l of linhas) {
      L('   ' + String(l.nivel).padStart(2) + ' | ' + String(l.bossNivel).padStart(5) + ' | ' + String(Math.round(l.lootPorAbate)).padStart(10) + ' | ' + cel(l.com, l.lootPorAbate).padEnd(54) + ' | ' + cel(l.sem, l.lootPorAbate).padEnd(54) + ' | ' + (l.LStar == null ? 'sem inversao (rv gasta <= por hora)' : f(l.LStar)));
    }
    // cruzamentos
    const nv0com = linhas.find((l) => l.com.mata && l.com.pocoes === 0);
    const nv0sem = linhas.find((l) => l.sem.mata && l.sem.pocoes === 0);
    const nvMatouCom = linhas.find((l) => l.com.mata);
    const nvMatouSem = linhas.find((l) => l.sem.mata);
    L('   -> primeiro nivel em que a build COM rv MATA: ' + (nvMatouCom ? 'nv' + nvMatouCom.nivel : 'nunca') + ' | em que a SEM rv mata: ' + (nvMatouSem ? 'nv' + nvMatouSem.nivel : 'nunca'));
    L('   -> primeiro nivel em que a COM rv precisa de 0 pocoes: ' + (nv0com ? 'nv' + nv0com.nivel : 'nenhum ate ao fim da varredura') + ' | a SEM rv: ' + (nv0sem ? 'nv' + nv0sem.nivel : 'NENHUM (continua a beber)'));
    const ult = linhas[linhas.length - 1];
    L('   -> no nv' + ult.nivel + ' (Barao nv' + ult.bossNivel + '): loot/abate ' + f(ult.lootPorAbate) + ' g | loot/hora da build COM rv ' + f(ult.abatesCom * ult.lootPorAbate) + ' g/h, da SEM rv ' + f(ult.abatesSem * ult.lootPorAbate) + ' g/h');
    L('      COM rv: ' + (ult.com.mata ? 'mata em ' + ult.com.seg + 's, ' + ult.com.pocoes + ' pocoes = ' + f(ult.com.custoPocoes) + ' g/luta (' + f(ult.ouroPocoesHoraCom) + ' g/h = ' + (ult.com.custoPocoes / ult.lootPorAbate * 100).toFixed(0) + '% do loot)' : 'NAO mata'));
    L('      SEM rv: ' + (ult.sem.mata ? 'mata em ' + ult.sem.seg + 's, ' + ult.sem.pocoes + ' pocoes = ' + f(ult.sem.custoPocoes) + ' g/luta (' + f(ult.ouroPocoesHoraSem) + ' g/h = ' + (ult.sem.custoPocoes / ult.lootPorAbate * 100).toFixed(0) + '% do loot)' : 'NAO mata'));
    if (ult.sem.mata) L('      LIQUIDO por hora (loot - pocoes): COM rv ' + f(ult.abatesCom * (ult.lootPorAbate - ult.com.custoPocoes)) + ' g/h | SEM rv ' + f(ult.abatesSem * (ult.lootPorAbate - ult.sem.custoPocoes)) + ' g/h' + (ult.sem.custoPocoes > ult.lootPorAbate ? '  <- a SEM rv PERDE ouro em cada abate' : ''));
    const perdido = linhas.filter((l) => !l.sem.mata && l.sem.custoPocoes > 0).map((l) => l.sem.custoPocoes);
    if (perdido.length) L('      ouro em pocoes da build SEM rv quando NAO mata (desperdicado): ' + f(Math.min(...perdido)) + ' a ' + f(Math.max(...perdido)) + ' g por tentativa');
  }
  // ---- [5] AS RESPOSTAS (a)(b)(c)(d) ----
  L('');
  L('-- [5] RESPOSTAS --');
  for (const camp of CAMPEOES) {
    const r = resumo[camp]; if (!r) continue;
    const A = r.maisRapido, B = r.menorPocoes;
    L('  ' + camp.toUpperCase() + ' nv' + r.nivel + ' vs Barao nv' + nivelDoChefe(BARAO_NM, r.nivel) + ':');
    L('   (a) MATA MAIS CEDO: ' + (A ? A.itens.join(',') + ' -> ' + A.seg + ' s com ' + A.pocoes + ' pocoes = ' + f(A.custoPocoes) + ' g' : 'nenhuma build mata'));
    L('   (b) MENOR CUSTO DE POCOES: ' + (B ? B.itens.join(',') + ' -> ' + B.seg + ' s com ' + B.pocoes + ' pocoes = ' + f(B.custoPocoes) + ' g' : 'nenhuma build mata'));
    const iguais = A && B && A.itens.join(',') === B.itens.join(',');
    L('   (c) ' + (iguais ? 'A MESMA BUILD ganha (a) e (b): nao ha escolha a fazer.'
      : 'SAO DIFERENTES -> escolher pela TUPLA na ordem declarada (mata -> segundos -> ouro em pocoes -> ouro total); o desempate e explicito e nao um numero unico inventado.'));
    const linhas = eco[camp] || [];
    const nv0 = linhas.find((l) => l.com.mata && l.com.pocoes === 0);
    const nv0sem = linhas.find((l) => l.sem.mata && l.sem.pocoes === 0);
    const nvMataCom = linhas.find((l) => l.com.mata);
    const nvMataSem = linhas.find((l) => l.sem.mata);
    const ult = linhas[linhas.length - 1];
    L('   (d) PONTO DE VIRAGEM:');
    L('       - a build COM rv comeca a MATAR em ' + (nvMataCom ? 'nv' + nvMataCom.nivel : 'nunca') + '; a SEM rv em ' + (nvMataSem ? 'nv' + nvMataSem.nivel : 'nunca'));
    L('       - a poupanca de pocoes do rv vai a ZERO em ' + (nv0 ? 'nv' + nv0.nivel + ' (a partir dai a build COM rv mata sem beber)' : 'nenhum nivel testado')
      + '; a build SEM rv ' + (nv0sem ? 'chega a 0 pocoes em nv' + nv0sem.nivel : 'NUNCA chega a 0 pocoes (no nv' + (ult ? ult.nivel : '?') + ' ainda bebe ' + (ult ? ult.sem.pocoes : '?') + ')'));
    if (ult) L('       - "volta a compensar?": no nv' + ult.nivel + ' a SEM rv gasta ' + f(ult.ouroPocoesHoraSem) + ' g/h em pocoes = ' + (100 * ult.sem.custoPocoes / ult.lootPorAbate).toFixed(0) + '% do loot de cada abate'
      + (ult.sem.custoPocoes > ult.lootPorAbate ? ' -> PERDE ouro em cada abate, logo o rv NUNCA deixa de compensar' : ' -> ainda sobra loot, mas o rv continua a ganhar nos segundos'));
    L('       - L* (loot por abate em que o rv empata em ouro/hora): ' + (linhas.some((l) => l.LStar != null) ? 'existe em ' + linhas.filter((l) => l.LStar != null).length + ' nivel(eis)' : 'NAO EXISTE em nenhum nivel: a build com rv e mais rapida E mais barata em todos -> nao ha troca a fazer, o rv domina a tupla'));
  }

  // ---- [6] O PERSONAGEM REAL DO DONO ----
  L('');
  L('-- [6] O PERSONAGEM REAL DO DONO (nao deduzido: painel Forca 81 / Vitalidade 3 / Foco 0; CDR 23,46% do Impeto) --');
  for (const [fich, camp, nivel] of [['katarina', 'katarina', 29], ['yasuo', 'yasuo', 12]]) {
    const f = path.join(__dir, '..', 'docs', 'snapshots', fich + '.json');
    if (!fs.existsSync(f)) { L('   ' + camp + ': snapshot ausente'); continue; }
    let d = JSON.parse(fs.readFileSync(f, 'utf8')); if (typeof d === 'string') d = JSON.parse(d);
    const eq = ((d.cycles || [])[0] || {}).setup?.equip?.map((e) => e.id) || [];
    // distribuição MEDIDA (a que fecha os snapshots): Katarina 84/0/4/0/0 e Yasuo 10/7/4/3/0
    const atMed = SNAPSHOT_ATRIB[fich];
    const st = statsJogador(camp, nivel, eq, atMed);
    const x = avaliarLuta(camp, nivel, eq, { atrib: atMed });
    const xd = avaliarLuta(camp, nivel, eq, { atrib: atribDono(nivel) });
    const med = ((d.cycles || [])[0] || {}).setup?.player || {};
    L('   ' + camp + ' nv' + nivel + ' build ' + eq.join(','));
    L('      atributos MEDIDOS ' + JSON.stringify(atMed) + ' (o painel do dono e 81/3/0/0/0 na Katarina; a regra do painel no nv' + nivel + ' da ' + JSON.stringify(atribDono(nivel)) + ')');
    L('      modelo: hp ' + Math.round(st.vida) + ' ad ' + Math.round(st.ad) + ' ap ' + Math.round(st.ap) + ' arm ' + Math.round(st.armadura) + ' rm ' + Math.round(st.rm) + ' va ' + st.velAtaque.toFixed(2) + ' cdr ' + (100 * st.reducaoRecarga).toFixed(2) + '%'
      + (med.vida ? ' | MEDIDO: hp ' + med.vida + ' ad ' + med.dano + ' arm ' + med.armadura + ' rm ' + med.rm + ' -> erro hp ' + (st.vida - med.vida).toFixed(0) + ' ad ' + (st.ad - med.dano).toFixed(1) + ' arm ' + (st.armadura - med.armadura).toFixed(0) + ' rm ' + (st.rm - med.rm).toFixed(0) + ' (erro do modelo, NAO VERIFICADO)' : ''));
    L('      vs Barao nv' + x.bossNivel + ': ' + linhaTupla(x) + '  (rv ' + (100 * x.rouboVida).toFixed(0) + '% -> cura ' + Math.round(x.curaRV) + '/s)');
    L('      com a regra do painel: ' + linhaTupla(xd));
    L('      sem pocao: ' + (x.semPocao.mata ? 'ainda mata' : 'morre aos ' + x.semPocao.t + ' s'));
  }

  return { resumo, eco };
}

// =====================================================================================
// RELATÓRIO — corre tudo e imprime (é o que docs/sim-baron.md resume)
// =====================================================================================
export function analiseCompleta() {
  const L = (s) => console.log(s);
  L('');
  L('################ PARTE 2 — BUILD x NIVEL -> BARAO ################');
  L('');
  L('-- [0] Calibracao do modelo de stats contra os snapshots MEDIDOS --');
  for (const c of calibrarContraSnapshots()) {
    if (c.erro) { L('  ' + c.fich + ': ' + c.erro); continue; }
    L('  ' + c.fich + ' nv' + c.nivel + '  itens ' + c.eq.join(','));
    L('     medido: hp ' + c.med.vida + '  ad ' + c.med.dano + '  arm ' + c.med.armadura + '  rm ' + c.med.rm + (c.med.va != null ? '  va ' + c.med.va : '') + (c.med.poder != null ? '  ap ' + c.med.poder : ''));
    L('     modelo: hp ' + c.calc.vida.toFixed(1) + '  ad ' + c.calc.ad.toFixed(1) + '  arm ' + c.calc.armadura.toFixed(1) + '  rm ' + c.calc.rm.toFixed(1) + '  va ' + c.calc.velAtaque.toFixed(2) + (c.med.poder != null ? '  ap ' + c.calc.ap.toFixed(0) : ''));
    L('     erro  : ' + JSON.stringify(c.err));
  }
  const val = validarLutaMedida();
  if (val) {
    L('');
    L('-- [0.5] Validacao contra a luta REAL medida (docs/snapshots/katarina.json, Katarina nv29 vs ' + val.boss + ') --');
    L('  chefe nv' + val.bossNivel + ' (nm=[30,38] motor.js:369 + regra motor.js:1121) | basico medido ' + val.medido + ' (n=' + val.n + ' amostras) vs modelo ' + val.previsto);
    L('  sopro medido ' + val.soproMedido + ' vs modelo ' + val.soproPrevisto + ' | queimadura 3%/s = ' + val.queimadoPorSegundo + '/s (motor.js:3105) | luta real durou ' + val.durS + ' s com ' + val.potUsadas + ' pocoes');
  }
  L('');
  L('-- [1] Nivel do Barao (motor.js:1121: max(n0+2, min(n1+2, nivelJogador+4)); nm=[40,48] motor.js:371) --');
  for (const n of [25, 30, 35, 38, 40, 44, 46, 50]) {
    const bn = nivelDoChefe(BARAO_NM, n);
    const b = statsBossFiel('Barão Nashor', bn);
    L('  jogador nv' + String(n).padStart(2) + ' -> Barao nv ' + bn + ' | hp ' + Math.round(b.hpMax) + ' ad ' + Math.round(b.ad) + ' armadura ' + Math.round(b.armadura)
      + ' | fator dano monstro x' + fatorDanoMonstro(n, bn).toFixed(2) + ', fator dano jogador x' + fatorDanoJogador(n, bn).toFixed(2));
  }
  L('');
  L('-- [2] Builds (busca por DPS REAL contra o Barao) --');
  const CAMPEOES = ['yasuo', 'katarina'];
  const info = {};
  for (const camp of CAMPEOES) {
    const nivelRef = camp === 'yasuo' ? 45 : 35;
    const boss = statsBossFiel('Barão Nashor', nivelDoChefe(BARAO_NM, nivelRef));
    const ext = buildExtensao(camp);
    const lista = melhoresBuilds(camp, nivelRef, boss, { shortlist: 24 });
    info[camp] = { nivelRef, boss, ext, lista: lista.slice(0, 4) };
    L('  ' + camp.toUpperCase() + ' (perfil ' + perfilDe(camp) + ', nv' + nivelRef + ' de referencia, Barao nv' + nivelDoChefe(BARAO_NM, nivelRef) + ')');
    L('     extensao buildIdealPara : ' + ext.join(',') + '   dps ' + Math.round(dpsTeorico(camp, nivelRef, ext, boss).total));
    lista.slice(0, 4).forEach((x, i) => L('     busca #' + (i + 1) + '                 : ' + x.ids.join(',') + '   dps ' + Math.round(x.dps)));
  }
  L('');
  L('-- [3] Varredura: primeiro nivel em que a build SOBREVIVE e MATA o Barao --');
  const resultado = {};
  for (const camp of CAMPEOES) {
    const { ext, lista } = info[camp];
    const builds = [
      { nome: 'IDEAL (busca)', ids: lista[0].ids },
      { nome: '2a IDEAL (busca)', ids: lista[1].ids },
      { nome: 'EXTENSAO (bot)', ids: ext },
    ];
    resultado[camp] = [];
    for (const b of builds) {
      const achou = primeiroNivelQueMata(camp, b.ids, { de: 20 });
      if (!achou) { L('  ' + camp + ' | ' + b.nome + ' | ' + b.ids.join(',') + ' -> NAO mata o Barao ate ao nv50'); resultado[camp].push({ ...b, nivel: null }); continue; }
      // pocoes minimas (com o smart a poder beber no maximo N)
      // menor numero de pocoes com que a luta AINDA se ganha (sobrevivencia e monotona no stock)
      let minPoc;
      const zero = lutarBarao(camp, achou.nivel, b.ids, { maxPocoes: 0 });
      if (zero.r.matou && zero.r.vivo) minPoc = 0;
      else {
        let lo = 1, hi = Math.max(1, achou.r.totalPocoes);
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          const x = lutarBarao(camp, achou.nivel, b.ids, { maxPocoes: mid });
          if (x.r.matou && x.r.vivo) hi = mid; else lo = mid + 1;
        }
        minPoc = lo;
      }
      const linha = { ...b, nivel: achou.nivel, bossNivel: achou.bossNivel, dps: achou.d.total, seg: achou.r.tempoMatar,
        pocoesUsadas: achou.r.totalPocoes, pocoesMinimas: minPoc, hpMinPct: achou.r.hpMinPct, hpMin: achou.r.hpMin,
        danoRecebido: achou.r.danoRecebido, custo: achou.r.custo, tSemPocao: achou.semPocao.matou ? null : achou.semPocao.t,
        matouSemPocao: achou.semPocao.matou, st: achou.d.st, det: achou.d.det,
        piorGolpe: achou.r.piorGolpe, piorMec: achou.r.piorMec, usadas: achou.r.usadas };
      resultado[camp].push(linha);
      L('  ' + camp + ' | ' + b.nome.padEnd(16) + ' | ' + b.ids.join(','));
      L('     nv' + linha.nivel + ' (Barao nv' + linha.bossNivel + ') | dps ' + Math.round(linha.dps) + ' | mata em ' + linha.seg + ' s'
        + ' | pocoes usadas ' + linha.pocoesUsadas + ' ' + JSON.stringify(linha.usadas) + ' (minimo ' + linha.pocoesMinimas + ') | hpMin ' + linha.hpMin + ' (' + linha.hpMinPct + '%)'
        + ' | dano recebido ' + linha.danoRecebido + ' | ouro em pocoes ' + linha.custo
        + ' | sem pocao: ' + (linha.matouSemPocao ? 'ainda mata' : 'morre aos ' + linha.tSemPocao + ' s'));
      L('     stats: hp ' + Math.round(linha.st.vida) + ' ad ' + Math.round(linha.st.ad) + ' ap ' + Math.round(linha.st.ap) + ' arm ' + Math.round(linha.st.armadura) + ' rm ' + Math.round(linha.st.rm)
        + ' va ' + linha.st.velAtaque.toFixed(2) + ' crit ' + Math.round(100 * linha.st.critico) + '% | rv ' + Math.round(100 * linha.st.rouboVida) + '% = cura ' + Math.round(achou.cura.curaRV) + '/s (autos; motor.js:1226)'
        + ' | dps auto ' + Math.round(linha.det.auto) + ' skills ' + Math.round(linha.det.skills) + ' itens ' + Math.round(linha.det.itens)
        + ' | ranks ' + JSON.stringify(achou.d.ranks) + ' barra ' + achou.d.barra.join('/'));
    }
  }
  L('');
  L('-- [4] DPS que o boneco TOMA vs o MINIMO para a luta (na primeira luta que ganha) --');
  for (const camp of CAMPEOES) {
    for (const r of resultado[camp]) {
      if (!r.nivel) continue;
      const x = lutarBarao(camp, r.nivel, r.ids);
      const recebido = KITS_SIM[camp].papel.recebido;
      const fM = fatorDanoMonstro(r.nivel, r.bossNivel);
      const dpsBasico = mit(x.boss.ad, x.boss.magico ? r.st.rm : r.st.armadura) * fM * recebido * x.boss.as;
      const dpsMedio = r.danoRecebido / r.seg;
      const curaPocoes = (r.usadas.vida * 300 + r.usadas.vidaF * 900 + r.usadas.vidaS * 2200) / r.seg;
      const golpes = r.piorGolpe > 0 ? Math.floor(r.hpMin / r.piorGolpe) : null;
      L('  ' + camp + ' | ' + r.nome + ' | nv' + r.nivel);
      L('     dano/s do Barao (basico mitigado x papel x fator de nivel): ' + Math.round(dpsBasico) + '/s');
      L('     dano/s MEDIO que o boneco levou (basico + mecanicas + queimadura): ' + Math.round(dpsMedio) + '/s');
      L('     cura/s das pocoes usadas: ' + Math.round(curaPocoes) + '/s | cura/s do ROUBO DE VIDA: ' + Math.round(x.cura.curaRV) + '/s | cura/s do kit (nao-rv): ' + Math.round(x.cura.curaKit) + '/s');
      L('     margem so com pocoes: ' + (curaPocoes - dpsMedio >= 0 ? '+' : '') + Math.round(curaPocoes - dpsMedio) + '/s | margem com pocoes + rv: ' + (curaPocoes + x.cura.curaRV + x.cura.curaKit - dpsMedio >= 0 ? '+' : '') + Math.round(curaPocoes + x.cura.curaRV + x.cura.curaKit - dpsMedio) + '/s');
      L('     pior golpe ' + r.piorGolpe + ' | pior mecanica ' + r.piorMec + ' | hpMin ' + r.hpMin + ' (' + r.hpMinPct + '%) -> ainda cabiam ' + golpes + ' golpes do pior tipo');
      L('     MINIMO p/ a luta: hpMax(' + Math.round(r.st.vida) + ') > pior mecanica(' + r.piorMec + ') e cura de pocoes >= dano/s');
    }
  }
  L('');
  L('-- [6] ATUAL (snapshot medido) vs TEORIA --');
  for (const [fich, camp, nivel] of [['katarina', 'katarina', 29], ['yasuo', 'yasuo', 12]]) {
    const f = path.join(__dir, '..', 'docs', 'snapshots', fich + '.json');
    if (!fs.existsSync(f)) continue;
    let d = JSON.parse(fs.readFileSync(f, 'utf8')); if (typeof d === 'string') d = JSON.parse(d);
    const eq = ((d.cycles || [])[0] || {}).setup?.equip?.map((e) => e.id) || [];
    const bossNivel = nivelDoChefe(BARAO_NM, nivel);
    const boss = statsBossFiel('Barão Nashor', bossNivel);
    const at = distribuirAtributos(modeloDe(camp), nivel);
    const dps = dpsTeorico(camp, nivel, eq, boss, { atrib: at });
    const r = lutarBarao(camp, nivel, eq, { atrib: at });
    L('  ' + camp + ' ATUAL nv' + nivel + ' (build ' + eq.join(',') + ') vs Barao nv' + bossNivel);
    L('     dps ' + Math.round(dps.total) + ' | stats hp ' + Math.round(dps.st.vida) + ' ad ' + Math.round(dps.st.ad) + ' ap ' + Math.round(dps.st.ap) + ' arm ' + Math.round(dps.st.armadura) + ' rm ' + Math.round(dps.st.rm));
    const def = boss.magico ? dps.st.rm : dps.st.armadura;
    const fM = fatorDanoMonstro(nivel, bossNivel);
    const dpsBasico = mit(boss.ad, def) * fM * KITS_SIM[camp].papel.recebido * boss.as;
    const queima = 0.03 * dps.st.vida * (14 / 34.3);   // 5 s de queimadura por ciclo de 34,3 s do Barao
    L('     dano/s que TOMA: ' + Math.round(dpsBasico + queima) + '/s (basico ' + Math.round(dpsBasico) + ' + queimadura media ' + Math.round(queima) + ') | pior golpe ' + r.r.piorGolpe + ' | pior mecanica ' + r.r.piorMec + ' | hp ' + Math.round(dps.st.vida));
    L('     resultado: ' + (r.r.matou && r.r.vivo ? 'MATA em ' + r.r.tempoMatar + ' s com ' + r.r.totalPocoes + ' pocoes' : r.r.vivo ? 'nao mata em ' + r.r.t + ' s (dps insuficiente)' : 'MORRE aos ' + r.r.t + ' s') + ' | sobrevive sem pocao? ' + (r.semPocao.vivo && r.semPocao.matou ? 'sim' : 'nao (' + (r.semPocao.t) + ' s)'));
    const ideal = (resultado[camp] || [])[0];
    if (ideal && ideal.nivel) L('     IDEAL: nv' + ideal.nivel + ' em ' + ideal.seg + ' s | dps ' + Math.round(ideal.dps) + ' (x' + (ideal.dps / Math.max(1, dps.total)).toFixed(1) + ' o dps de agora)');
  }
  L('');
  L('-- [5] VEREDITO da hipotese do dono (a build ideal mata o Barao num nivel MENOR?) --');
  for (const camp of CAMPEOES) {
    const [ideal, seg, ext] = resultado[camp];
    const nivIdeal = ideal && ideal.nivel, nivSeg = seg && seg.nivel;
    if (nivIdeal == null || nivSeg == null) { L('  ' + camp + ': sem resposta (alguma build nao mata ate ao nv50)'); continue; }
    L('  ' + camp + ': IDEAL nv' + nivIdeal + ' (' + ideal.seg + ' s, ' + ideal.pocoesUsadas + ' pocoes) vs 2a IDEAL nv' + nivSeg + ' (' + seg.seg + ' s, ' + seg.pocoesUsadas + ' pocoes) -> ' + (nivIdeal < nivSeg ? 'CONFIRMA (ideal mata ' + (nivSeg - nivIdeal) + ' nivel(es) mais cedo)' : nivIdeal === nivSeg ? 'EMPATE no nivel (diferenca so nos segundos/pocoes)' : 'NAO CONFIRMA (a 2a ideal mata mais cedo)'));
    if (ext && ext.nivel != null) L('     (build do bot/extensao: nv' + ext.nivel + ' em ' + ext.seg + ' s com ' + ext.pocoesUsadas + ' pocoes)');
  }
  L('');
}

// ---- PARTE 2: build + nível -> stats -> DPS -> duração (ver docs/sim-baron.md) ----
// ---- PARTE 3: POR-LUTA — a tupla, o roubo de vida e a economia das poções (docs/build-por-luta.md) ----
// Uso:  node tools/sim-chefes.mjs            (corre as duas partes)
//       node tools/sim-chefes.mjs --rv       (só a parte 3, a do roubo de vida / poções)
//       node tools/sim-chefes.mjs --baron    (só a parte 2)
//       node tools/sim-chefes.mjs --rv --de 22 --ate 50
if (direto) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const so = arg('--so');
  if (so !== 'rv') analiseCompleta();
  if (so !== 'baron') relatorioPorLuta({ de: +(arg('--de') || 22), ate: +(arg('--ate') || 50) });
}
