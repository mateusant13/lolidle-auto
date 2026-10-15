/*
 * Verifica a estratégia IMPLEMENTADA (smartNovo) contra a sequência real do Dragão.
 */
import { simular, encontros, smartNovo, smartMedia, pvpFaixas, oraculo, HP_MAX } from './sim-combate.mjs';

const ENCS = encontros();
const fmt = (r) => `${r.vivo ? 'VIVO ' : 'MORTO'} hpMin ${String(Math.round(r.hpMin)).padStart(4)}  custo ${String(r.custo).padStart(5)}  P1 ${String(r.usadas.vida).padStart(3)} P2 ${String(r.usadas.vidaF).padStart(3)} P3 ${String(r.usadas.vidaS).padStart(3)}`;

function rodar(fn, healS, disp) {
  let vivo = true, custo = 0, hpMin = HP_MAX;
  const u = { vida: 0, vidaF: 0, vidaS: 0 };
  for (const enc of ENCS) {
    const r = simular(enc, fn, { healS, potions: disp });
    if (!r.vivo) vivo = false;
    hpMin = Math.min(hpMin, r.hpMin); custo += r.custo;
    u.vida += r.usadas.vida; u.vidaF += r.usadas.vidaF; u.vidaS += r.usadas.vidaS;
  }
  return { vivo, hpMin, custo, usadas: u };
}

const COM_P3 = { vida: 9999, vidaF: 9999, vidaS: 9999 };
const SEM_P3 = { vida: 9999, vidaF: 9999, vidaS: 0 };

console.log('=== smartNovo (implementado) — piso 75%, margem 1.1 ===');
for (const healS of [0, 50, 100, 150, 200, 300]) {
  console.log(`cura ${String(healS).padStart(3)}/s  com P3: ${fmt(rodar(smartNovo(), healS, COM_P3))}`);
}
console.log('\n=== estoque REAL (P3=0) ===');
for (const healS of [0, 50, 100, 150, 200, 300]) {
  console.log(`cura ${String(healS).padStart(3)}/s  sem P3: ${fmt(rodar(smartNovo(), healS, SEM_P3))}`);
}
console.log('\n=== comparação (cura 100/s, com P3) ===');
console.log('SMART antigo (bugado):', fmt(rodar(smartMedia(), 100, COM_P3)));
console.log('PvP faixas:          ', fmt(rodar(pvpFaixas(), 100, COM_P3)));
console.log('smartNovo:           ', fmt(rodar(smartNovo(), 100, COM_P3)));
const orac = ENCS.reduce((s, e) => s + (oraculo(e, { healS: 100 }) ?? 0), 0);
console.log('oráculo (futuro):    custo', orac);
