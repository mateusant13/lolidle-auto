/*
 * Sweet spot: acha o piso de HP que sobrevive ao Dragão em TODOS os cenários
 * de cura (0..200/s), com folga -- sem otimizar custo ao extremo.
 */
import { simular, encontros, reativo, limiar, pvpFaixas, HP_MAX } from './sim-combate.mjs';

const ENCS = encontros();
const DISP = { vida: 9999, vidaF: 9999, vidaS: 9999 };

function rodar(fn, healS) {
  let vivo = true, custo = 0, hpMin = HP_MAX, pior = HP_MAX;
  for (const enc of ENCS) {
    const r = simular(enc, fn, { healS, potions: DISP });
    if (!r.vivo) vivo = false;
    hpMin = Math.min(hpMin, r.hpMin); custo += r.custo;
  }
  return { vivo, custo, hpMin };
}

console.log('Piso híbrido (mantém HP >= max(último golpe, PISO)) — cura 0..200/s\n');
console.log('PISO   cura0            cura50           cura100          cura150          cura200');
for (const piso of [1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3688]) {
  const cols = [0, 50, 100, 150, 200].map((hs) => {
    const r = rodar(reativo({ margem: 1.0, piso }), hs);
    return `${r.vivo ? 'VIVO' : 'MORTE'} ${String(Math.round(r.hpMin)).padStart(4)}/${String(r.custo).padStart(4)}`;
  });
  console.log(`${String(piso).padStart(4)}   ${cols.join('   ')}`);
}
console.log('\n(PvP atual, referência)');
const pp = [0, 50, 100, 150, 200].map((hs) => { const r = rodar(pvpFaixas(), hs); return `${r.vivo ? 'VIVO' : 'MORTE'} ${String(Math.round(r.hpMin)).padStart(4)}/${String(r.custo).padStart(4)}`; });
console.log(`       ${pp.join('   ')}`);
console.log('formato: estado hpMin/custo(gold)');
