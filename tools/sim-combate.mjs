/*
 * Simulador de combate LOCAL — LoL Idle
 *
 * Replica EXATAMENTE a sequência de golpes do Dragão Infernal gravada em
 * `dragao-hits.json` (cada golpe = dano + intervalo real desde o anterior).
 * No jogo isso é aleatório; aqui a gente reproduz o que aconteceu pra poder
 * comparar estratégias de poção de forma justa.
 *
 * Modelo de vida:
 *   - HP máx = 4188 (medido no jogo).
 *   - Cura das SKILLS (sem poção) = healS por segundo, contínua.
 *   - Golpes: hp -= drop no instante do golpe (exatos do log).
 *   - Poções: cura instantânea; P1=300/40g, P2=900/110g, P3=2200/260g;
 *     cooldown global de 1s (o jogo).
 *
 * Uso:
 *   node tools/sim-combate.mjs [--healS 100] [--margin 1.5] [--sweep]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const HITS = JSON.parse(fs.readFileSync(path.join(__dir, 'dragao-hits.json'), 'utf8')).all;

export const HP_MAX = 4188;
export const POTS = {
  vida:  { heal: 300,  cost: 40,  label: 'P1 normal' },
  vidaF: { heal: 900,  cost: 110, label: 'P2 forte' },
  vidaS: { heal: 2200, cost: 260, label: 'P3 suprema' },
};
export const COOLDOWN = 1000; // ms
const STEP = 25;              // ms de resolução da simulação

// ---------------------------------------------------------------- encontros
// Um "encontro" = luta contínua com o chefe. Quebra em gaps enormes (>30s),
// que são transições/revirada de ciclo (o boneco toma heal cheio no caminho).
export function encontros(hits = HITS) {
  const out = []; let cur = [];
  for (const h of hits) {
    if (h.gapMs != null && h.gapMs > 30000 && cur.length) { out.push(cur); cur = []; }
    cur.push(h);
  }
  if (cur.length) out.push(cur);
  return out.map((enc) => {
    let t = 0;
    return enc.map((h, i) => {
      if (i > 0) t += h.gapMs;
      return { at: t, drop: h.drop, gap: i > 0 ? h.gapMs : 0 };
    });
  });
}

// ---------------------------------------------------------------- simulação
/**
 * @param {Array<{at,drop,gap}>} enc  encontro (golpes com tempo)
 * @param {(S)=>string|null} strategy  devolve 'vida'|'vidaF'|'vidaS'|null
 * @param {object} opts  {hpMax, healS, potions}
 * @returns {{vivo:boolean, hpMin:number, usadas:{}, custo:number, mortoEm:number|null, timeline:[]}}
 */
export function simular(enc, strategy, opts = {}) {
  const hpMax = opts.hpMax ?? HP_MAX;
  const healS = opts.healS ?? 0;
  const disp = opts.potions ?? { vida: Infinity, vidaF: Infinity, vidaS: Infinity };
  let hp = hpMax, cd = 0, custo = 0;
  const usadas = { vida: 0, vidaF: 0, vidaS: 0 };
  let hpMin = hpMax, mortoEm = null;
  let lastHit = null, lastGap = null;
  const timeline = [];

  for (let i = 0; i < enc.length; i++) {
    const hit = enc[i];
    // avança do tempo atual até o golpe, curando e decidindo poção
    for (let t = (i === 0 ? 0 : enc[i - 1].at); t < hit.at; t += STEP) {
      hp = Math.min(hpMax, hp + (healS * STEP) / 1000);
      cd = Math.max(0, cd - STEP);
      const k = strategy({ hp, hpMax, t, cd, lastHit, lastGap, healS, usadas, disp, proximo: hit });
      if (k && cd <= 0 && disp[k] > usadas[k]) {
        hp = Math.min(hpMax, hp + POTS[k].heal);
        usadas[k]++; custo += POTS[k].cost; cd = COOLDOWN;
        timeline.push({ t, ev: 'POC', k, hp: Math.round(hp), lastHit, lastGap });
      }
      hpMin = Math.min(hpMin, hp);
    }
    // aplica o golpe
    const antes = hp;
    hp -= hit.drop;
    lastHit = hit.drop; lastGap = hit.gap;
    hpMin = Math.min(hpMin, hp);
    timeline.push({ t: hit.at, ev: 'HIT', drop: hit.drop, gap: hit.gap, hpAntes: Math.round(antes), hpDepois: Math.round(hp), cd: Math.round(cd) });
    if (hp <= 0) { mortoEm = hit.at; return { vivo: false, hpMin: 0, usadas, custo, mortoEm, timeline }; }
  }
  return { vivo: true, hpMin, usadas, custo, mortoEm: null, timeline };
}

// ---------------------------------------------------------------- estratégias
const ORDEM = ['vidaS', 'vidaF', 'vida'];
/** Poção única mais barata que cobre `falta`; se faltar estoque, cai pra mais forte disponível. */
function pocaoPara(falta, usadas, disp) {
  if (falta <= 0) return null;
  const cand = falta <= 300 ? 'vida' : falta <= 900 ? 'vidaF' : 'vidaS';
  if (disp[cand] > usadas[cand]) return cand;
  for (const x of ORDEM) if (disp[x] > usadas[x]) return x;
  return null;
}
/** Acha a poção única mais barata que cobre `falta` (prefere a menor que sobra menos). */
function melhorUna(falta) {
  if (falta <= 0) return null;
  if (falta <= 300) return 'vida';
  if (falta <= 900) return 'vidaF';
  return 'vidaS';
}

/** Estratégia IMPLEMENTADA na extensão (decidirPocao): último golpe real + piso de
 *  segurança (% do HP máx), contando a cura das SKILLS (sem poção) até o próximo golpe. */
export function smartNovo({ pisoPct = 0.75, margem = 1.1, hpMax = HP_MAX } = {}) {
  return (S) => {
    const { hp, lastHit, lastGap, healS, usadas, disp } = S;
    const gapS = Math.min(Math.max(lastGap || 1000, 250), 3000) / 1000;
    const alvo = Math.min(hpMax, Math.max(hpMax * pisoPct, (lastHit || 0) * margem));
    const proj = Math.min(hpMax, hp + healS * gapS);
    if (proj >= alvo) return null;
    return pocaoPara(alvo - proj, usadas, disp);
  };
}

/** Regra do dono: manter HP >= alvo do golpe iminente (o que ACABOU de acontecer). */export function heuristica({ margin = 1.0, flat = 0, usarGap = false } = {}) {
  return (S) => {
    const { hp, hpMax, lastHit, lastGap, healS, usadas, disp } = S;
    if (!lastHit) return null;
    const g = Math.min(lastGap || 1500, 3000) / 1000;
    const alvo = Math.min(hpMax, lastHit * margin + flat + (usarGap ? healS * g : 0));
    // HP previsto no próximo golpe (se não pocionar agora)
    const proj = Math.min(hpMax, hp + healS * g);
    if (proj >= alvo) return null;               // heal das skills já segura
    const falta = alvo - proj;
    const k = melhorUna(falta);
    if (k && disp[k] > usadas[k]) return k;
    // não tem a poção exata: usa a mais forte disponível
    for (const x of ORDEM) if (disp[x] > usadas[x]) return x;
    return null;
  };
}

/** Limiar fixo: mantém HP >= T usando a poção mais barata que cobre o buraco. */
export function limiar(T) {
  return (S) => {
    const { hp, usadas, disp } = S;
    if (hp >= T) return null;
    return pocaoPara(T - hp, usadas, disp);
  };
}

/** Reativo POR GOLPE (regra do dono): após cada golpe, garante HP >= dano do golpe
 *  que ACABOU de acontecer + margem (só cura das skills, sem contar poção). */
export function reativo({ margem = 1.0, piso = 0, usarGap = false, gapConservador = 0 } = {}) {
  return (S) => {
    const { hp, hpMax, lastHit, lastGap, healS, usadas, disp } = S;
    if (!lastHit) return null;
    const g = usarGap ? Math.min(lastGap || gapConservador || 1000, 3000) / 1000 : 0;
    const alvo = Math.min(hpMax, Math.max(piso, lastHit * margem + healS * g));
    if (hp >= alvo) return null;
    return pocaoPara(alvo - hp, usadas, disp);
  };
}

/** SMART atual (bugado): média por segundo (dmgRate − healRate). */
export function smartMedia({ janelaS = 5 } = {}) {
  return (S) => {
    const { hp, hpMax, healS, usadas, disp } = S;
    // o simulador não guarda histórico; aproxima a "média" pelo último hit:
    // dano/s médio = lastHit / (lastGap/1000) — é o que a média de 5s fazia.
    const { lastHit, lastGap } = S;
    if (!lastHit) return null;
    const dmgS = lastHit / Math.max(0.5, (lastGap || 1500) / 1000);
    const liquido = dmgS - healS;
    const pct = hp / hpMax;
    if (liquido <= 0.5 && pct > 0.6) return null;
    const falta = Math.max(liquido, dmgS * 0.4) * 1.5;
    const k = melhorUna(falta);
    if (k && disp[k] > usadas[k]) return k;
    for (const x of ORDEM) if (disp[x] > usadas[x]) return x;
    return null;
  };
}

/** PvP atual (faixas por HP perdido): P1 ≤ 500 perdido, P2 ≤ 1000, P3 ≤ 2513. */
export function pvpFaixas() {
  return (S) => {
    const { hp, hpMax, usadas, disp } = S;
    const lost = hpMax - hp;
    const escolha = lost >= 2513 ? 'vidaS' : lost >= 1000 ? 'vidaF' : lost >= 500 ? 'vida' : null;
    if (!escolha) return null;
    if (disp[escolha] > usadas[escolha]) return escolha;
    for (const x of ORDEM) if (disp[x] > usadas[x]) return x;
    return null;
  };
}

// ---------------------------------------------------------------- oráculo
/**
 * Custo MÍNIMO teórico pra sobreviver ao encontro (DP sobre os golpes).
 * Considera: cura das skills entre golpes, poções instantâneas com cooldown
 * de 1s (até floor(gap/1s)+1 usos por intervalo), HP teto.
 * Estado = (i, hp discretizado). Ação = quantas P1/P2/P3 usar no intervalo.
 */
export function oraculo(enc, { hpMax = HP_MAX, healS = 0, bucket = 25 } = {}) {
  const B = Math.round(hpMax / bucket);
  const b = (hp) => Math.max(0, Math.min(B, Math.round(hp / bucket)));
  const hpOf = (bi) => bi * bucket;
  const INF = Infinity;
  // custo mínimo acumulado: dp[bi] = custo pra chegar ao início do golpe i com HP bi
  // Processa golpe a golpe; antes do golpe i, cura por (at_i - at_{i-1}).
  let dp = new Array(B + 1).fill(INF);
  dp[b(hpMax)] = 0;
  for (let i = 0; i < enc.length; i++) {
    const gap = i === 0 ? 0 : enc[i].gap;
    const slots = Math.floor(gap / COOLDOWN) + 1;   // poções usáveis antes deste golpe
    const heal = (healS * gap) / 1000;
    // 1) aplica cura do gap e poções; para cada estado de chegada (antes do hit i)
    const nd = new Array(B + 1).fill(INF);
    for (let bi = 0; bi <= B; bi++) {
      if (dp[bi] === INF) continue;
      let h0 = Math.min(hpMax, hpOf(bi) + heal);
      // escolhe o mix mais barato com até `slots` poções e HP final >= 0 após o golpe
      for (let a = 0; a <= slots; a++) for (let c = 0; c <= slots - a; c++) for (let d = 0; d <= slots - a - c; d++) {
        const custo = a * POTS.vida.cost + c * POTS.vidaF.cost + d * POTS.vidaS.cost;
        const hh = Math.min(hpMax, h0 + a * 300 + c * 900 + d * 2200);
        if (hh - enc[i].drop <= 0) continue;                // morreria
        const bj = b(hh - enc[i].drop);
        if (dp[bi] + custo < nd[bj]) nd[bj] = dp[bi] + custo;
      }
    }
    dp = nd;
  }
  const best = Math.min(...dp);
  return best === INF ? null : best;
}

// ---------------------------------------------------------------- relatório
function linha(nome, r) {
  const u = r.usadas;
  const estado = r.vivo ? 'VIVO ' : 'MORTO';
  return `${nome.padEnd(26)} ${estado} hpMin ${String(Math.round(r.hpMin)).padStart(4)}  ` +
    `P1 ${String(u.vida).padStart(3)}  P2 ${String(u.vidaF).padStart(3)}  P3 ${String(u.vidaS).padStart(3)}  ` +
    `custo ${String(r.custo).padStart(4)}`;
}

function benchmark(healS, opts = {}) {
  const encs = encontros();
  const disp = { vida: 999, vidaF: 999, vidaS: 999 };
  console.log(`\n================= cura das skills = ${healS}/s =================`);
  const testes = [
    ['PvP faixas (atual)', pvpFaixas()],
    ['SMART média (bugado)', smartMedia()],
    ['heurística margem 1.0', heuristica({ margin: 1.0 })],
    ['heurística margem 1.3', heuristica({ margin: 1.3 })],
    ['heurística margem 1.5', heuristica({ margin: 1.5 })],
    ['heurística margem 2.0', heuristica({ margin: 2.0 })],
    ['heur 1.0 + heal×gap', heuristica({ margin: 1.0, usarGap: true })],
    ['heur 1.3 + heal×gap', heuristica({ margin: 1.3, usarGap: true })],
  ];
  let orac = 0;
  const linhas = [];
  for (const [nome, fn] of testes) {
    let vivo = true, hpMin = HP_MAX, custo = 0;
    const u = { vida: 0, vidaF: 0, vidaS: 0 };
    for (const enc of encs) {
      const r = simular(enc, fn, { healS, potions: disp });
      if (!r.vivo) vivo = false;
      hpMin = Math.min(hpMin, r.hpMin); custo += r.custo;
      u.vida += r.usadas.vida; u.vidaF += r.usadas.vidaF; u.vidaS += r.usadas.vidaS;
    }
    linhas.push(linha(nome, { vivo, hpMin, custo, usadas: u }));
  }
  for (const enc of encs) { const o = oraculo(enc, { healS }); if (o != null) orac += o; }
  linhas.push(`--- oráculo (custo mínimo) --- custo ${orac} (${orac === 0 ? 'nem precisa de poção' : 'sobrevive com o mínimo'})`);
  console.log(linhas.join('\n'));
}

// ---------------------------------------------------------------- main
// Só roda o CLI quando executado direto (import não dispara nada).
const direto = process.argv[1] && /sim-combate\.mjs$/.test(process.argv[1]);
const args = direto ? process.argv.slice(2) : [];
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };

/** Roda uma estratégia em todos os encontros e devolve o total. */
function rodarTudo(fn, healS) {
  let vivo = true, custo = 0, hpMin = HP_MAX;
  const u = { vida: 0, vidaF: 0, vidaS: 0 };
  for (const enc of encontros()) {
    const r = simular(enc, fn, { healS, potions: { vida: 999, vidaF: 999, vidaS: 999 } });
    if (!r.vivo) vivo = false;
    hpMin = Math.min(hpMin, r.hpMin); custo += r.custo;
    u.vida += r.usadas.vida; u.vidaF += r.usadas.vidaF; u.vidaS += r.usadas.vidaS;
  }
  return { vivo, custo, hpMin, usadas: u };
}

if (direto) {
if (args.includes('--busca')) {
  const disp = { vida: 999, vidaF: 999, vidaS: 999 };
  const cart = [];
  for (let m = 1.0; m <= 2.51; m += 0.1) cart.push([`reativo margem ${m.toFixed(1)}`, reativo({ margem: m, piso: 1000 })]);
  for (let T = 1000; T <= 4200; T += 100) cart.push([`limiar ${T}`, limiar(T)]);
  for (const hs of [0, 50, 100, 150, 200, 300, 450]) {
    let melhor = null;
    for (const [nome, fn] of cart) {
      let vivo = true, custo = 0;
      for (const enc of encontros()) { const r = simular(enc, fn, { healS: hs, potions: disp }); if (!r.vivo) { vivo = false; break; } custo += r.custo; }
      if (vivo && (!melhor || custo < melhor.custo)) melhor = { nome, custo };
    }
    let orac = 0; for (const enc of encontros()) { const o = oraculo(enc, { healS: hs }); if (o != null) orac += o; }
    console.log(`healS=${String(hs).padStart(3)}/s  melhor causal: ${(melhor ? melhor.nome : 'NENHUMA').padEnd(22)} custo ${melhor ? String(melhor.custo).padStart(4) : '----'}   | oráculo (futuro conhecido) ${orac}`);
  }
} else if (args.includes('--trace')) {
  const healS = getArg('--healS', 100);
  const margin = getArg('--margin', 1.0);
  for (const enc of encontros()) {
    const r = simular(enc, heuristica({ margin }), { healS, potions: { vida: 999, vidaF: 999, vidaS: 999 } });
    if (!r.vivo) {
      console.log(`\n### MORREU (healS=${healS}, margem=${margin}) — últimos eventos:`);
      console.log(r.timeline.slice(-26).map((l) => JSON.stringify(l)).join('\n'));
    }
  }
} else if (args.includes('--sweep')) {
  for (const hs of [0, 50, 100, 150, 200, 300, 450]) benchmark(hs);
} else {
  benchmark(getArg('--healS', 100));
}
}

