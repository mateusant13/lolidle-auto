/*
 * POR QUE O BONECO MORREU — arqueologia da lógica velha (smart por média/s).
 *
 * Replica a sequência REAL de golpes do Dragão e mostra, golpe a golpe, o que a
 * lógica VELHA decidia:
 *   dmgS   = dano somado numa janela de 5 s / 5      <-- MÉDIA (o erro)
 *   healS  = cura/s
 *   liquido= dmgS - healS
 *   se liquido <= 0.5 && HP > 60% -> NÃO usa poção
 *   faltando = max(liquido, dmgS*0.4) * 1.5
 *   poção = 300 se faltando<=300; 900 se <=900; senão 2200
 *
 * Compara a poção escolhida com o PRÓXIMO golpe real: quando o heal da poção
 * < golpe, o HP cai; quando não usa poção e o golpe > HP, morre.
 */
import { encontros, HP_MAX, POTS, COOLDOWN } from './sim-combate.mjs';

const healS = Number(process.argv[2] ?? 100);
const temP3 = !process.argv.includes('--sem-p3');

function escolhaVelha(faltando, pot) {
  const c = faltando <= 300 ? 'vida' : faltando <= 900 ? 'vidaF' : 'vidaS';
  if (pot[c] > 0) return c;
  for (const k of ['vidaS', 'vidaF', 'vida']) if (pot[k] > 0) return k;
  return null;
}

for (const enc of encontros()) {
  let hp = HP_MAX, cd = 0, t = 0;
  const pot = { vida: 9999, vidaF: 9999, vidaS: temP3 ? 9999 : 0 };
  const hist = [];   // {at, drop}
  const potHist = []; // {at, heal} — curas de poção vistas nos números verdes (CONTAMINAÇÃO)
  const linhas = [];
  let morreu = false;

  for (let i = 0; i < enc.length; i++) {
    const hit = enc[i];
    // avança o tempo (a cura das skills é contínua; a decisão é no polling)
    for (let tt = i === 0 ? 0 : enc[i - 1].at; tt < hit.at; tt += 100) {
      hp = Math.min(HP_MAX, hp + (healS * 100) / 1000);
      cd = Math.max(0, cd - 100);
      // janela de 5s
      const w = hist.filter((h) => h.at > tt - 5000);
      const dmgS = w.reduce((s, h) => s + h.drop, 0) / 5;
      // CONTAMINAÇÃO: a cura das poções também aparece como número verde → entra no healS
      const healPoc = potHist.filter((h) => h.at > tt - 5000).reduce((s, h) => s + h.heal, 0) / 5;
      const healEff = healS + healPoc;
      const liquido = dmgS - healEff;
      const pct = hp / HP_MAX;
      let k = null, faltando = null;
      if (!(liquido <= 0.5 && pct > 0.6)) {
        faltando = Math.max(liquido, dmgS * 0.4) * 1.5;
        k = escolhaVelha(faltando, pot);
      }
      if (k && cd <= 0 && pot[k] > 0) {
        const g = POTS[k].heal;
        linhas.push({ t: tt, ev: 'POC', k, heal: g, hp: Math.round(hp), dmgS: Math.round(dmgS), liquido: Math.round(liquido), faltando: faltando == null ? null : Math.round(faltando), pct: Math.round(pct * 100) });
        hp = Math.min(HP_MAX, hp + g); pot[k]--; cd = COOLDOWN; potHist.push({ at: tt, heal: g });
      }
    }
    const antes = hp;
    hp -= hit.drop; hist.push({ at: hit.at, drop: hit.drop });
    linhas.push({ t: hit.at, ev: 'HIT', drop: hit.drop, gap: hit.gap, hpAntes: Math.round(antes), hpDepois: Math.round(hp), abaixoDePct6: antes < HP_MAX * 0.6 });
    if (hp <= 0) { morreu = true; break; }
  }

  if (morreu) {
    console.log(`\n######## MORREU com healS=${healS} ${temP3 ? '(com P3)' : '(SEM P3)'} — últimos 24 eventos ########`);
    console.log('tempo  evento  golpe/poção   HPantes HPdepois | dmgS(5s) líquido faltando  HP%');
    for (const l of linhas.slice(-24)) {
      if (l.ev === 'HIT') console.log(`${String(Math.round(l.t / 1000)).padStart(4)}s  GOLPE  ${String(l.drop).padStart(6)}                 ${String(l.hpAntes).padStart(6)} ${String(l.hpDepois).padStart(7)} |`);
      else console.log(`${String(Math.round(l.t / 1000)).padStart(4)}s  POÇÃO  ${(l.k + ' +' + l.heal).padEnd(12)} ${String(l.hp).padStart(6)}          | ${String(l.dmgS).padStart(6)} ${String(l.liquido).padStart(7)} ${String(l.faltando).padStart(8)}  ${String(l.pct).padStart(3)}%`);
    }
  }
}
console.log('\n(use: node tools/porque-morreu.mjs 100   |   ... 0 --sem-p3)');
