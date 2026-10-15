/*
 * medir-peso-ad.mjs — MEDE o peso do AD (e do AP) a partir do KIT REAL, não de uma etiqueta.
 *
 * PEDIDO DO LEAD (2026-10-14): o perfil 'mago' do automation.js tem `ad: 0`, o que AFIRMA que o AD
 * vale nada para a Katarina — mas o kit dela diz o contrário (`giroSrc` com `0.4 * max(0, ad-baseAd)`,
 * motor.js:737, e a E com `adRatio`). O peso não se inventa: MEDE-SE.
 *
 * PROCEDIMENTO (o do Lead): D0 = dps com a build do dono; +10 AD -> delta_ad; +10 AP -> delta_ap;
 * ratio = delta_ad/delta_ap. O peso do AD = peso_do_AP x ratio.
 *
 * FONTE: `tools/sim-chefes.mjs` (kits portados de motor.js, com `statsJogador`/`dpsDaHabilidade`/
 * `escolherBarra`/`ranksNoNivel`). Este ficheiro NÃO altera nada lá — só importa e usa.
 *
 * LIMITE DECLARADO: a injecção de +10 AD/+10 AP é feita sobre o `st` devolvido pelo `statsJogador` e
 * o DPS medido é o das HABILIDADES (`dpsDaHabilidade`). O total do `dpsTeorico` (com autos e itens)
 * é impresso à parte como referência, mas não é injectável sem mexer no sim-chefes.mjs (que tem
 * outros escritores). O ratio medido aqui é o das HABILIDADES — está dito.
 */
import {
  statsJogador, dpsDaHabilidade, escolherBarra, ranksNoNivel, KITS_SIM, HAB_SIM,
  dpsTeorico, ATRIB_PADRAO,
} from './sim-chefes.mjs';

// KITS DISPONÍVEIS: o `sim-chefes.mjs` só tem `yasuo` e `katarina` (verificado: Object.keys(KITS_SIM)).
// O LUX não existe lá — o controlo do 'mago puro' NÃO é medível por este caminho (o sim-build.mjs
// tem Lux, mas é um SCRIPT sem exports e não pode ser importado). Fica declarado, não inventado.
const NOMES = ['katarina', 'yasuo'];
const SEM_KIT = ['lux'];
const NIVEL = 29;                                   // MEDIDO (docs/snapshots/player.json)
const ATRIB_DONO = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };
const BOSS = { nome: 'Barão Nashor', nivel: 42, hpMax: 122400, armadura: 0, rm: 0 };

// ---- 0) ISOLAMENTO DOS KITS (o erro da primeira medição: os três davam o mesmo) ---------------
console.log('== 0. ISOLAMENTO DOS KITS ==');
const assinatura = (c) => {
  const k = KITS_SIM[c] || {}, H = HAB_SIM[c] || {};
  const giro = H.P && H.P.giro ? String(H.P.giro).slice(0, 60) : null;
  const adRatio = Object.keys(H).filter((t) => H[t] && H[t].adRatio).map((t) => t + '=' + H[t].adRatio).join(',');
  return { campeao: c, magia: !!k.magia, escalaPoder: Object.keys(H).some((t) => H[t] && H[t].escalaPoder), giro, adRatio, habs: Object.keys(H).length };
};
const assinaturas = NOMES.map(assinatura);
for (const a of assinaturas) console.log('  ' + JSON.stringify(a));
const distintas = new Set(assinaturas.map((a) => JSON.stringify([a.magia, a.giro, a.adRatio]))).size;
if (distintas < NOMES.length) {
  console.log('ABORTA: os kits NÃO estão isolados (' + distintas + ' assinaturas distintas para ' + NOMES.length + ' campeões) — a medição seria inválida, como na primeira tentativa.');
  process.exit(2);
}
console.log('  OK: ' + distintas + ' assinaturas distintas.');

// ---- 1) MEDIÇÃO ------------------------------------------------------------------------------
const medirHabs = (campeao, st) => {
  const ranks = ranksNoNivel(campeao, NIVEL, st, BOSS);
  const barra = escolherBarra(campeao, NIVEL, ranks, st, BOSS);
  const ds = barra.map((t) => dpsDaHabilidade(campeao, t, ranks[t], st, BOSS, NIVEL));
  return { dps: ds.reduce((s, x) => s + (x.dps || 0), 0), barra: barra.join('/') };
};
console.log('');
console.log('== 1. MEDIÇÃO (habilidades; build do dono por omissão, nível ' + NIVEL + ') ==');
const linhas = [];
for (const c of NOMES) {
  const st = statsJogador(c, NIVEL, [], ATRIB_DONO);
  const D0 = medirHabs(c, st).dps;
  const D_ad = medirHabs(c, { ...st, ad: (st.ad || 0) + 10 }).dps;
  const D_ap = medirHabs(c, { ...st, ap: (st.ap || 0) + 10 }).dps;
  const delta_ad = (D_ad - D0) / 10, delta_ap = (D_ap - D0) / 10;
  const ratio = delta_ap > 1e-9 ? delta_ad / delta_ap : (delta_ad > 1e-9 ? Infinity : NaN);
  linhas.push({ campeao: c, D0: +D0.toFixed(2), delta_ad: +delta_ad.toFixed(4), delta_ap: +delta_ap.toFixed(4), ratio: Number.isFinite(ratio) ? +ratio.toFixed(3) : String(ratio) });
  console.log('  ' + c.padEnd(9) + ' D0=' + D0.toFixed(1).padStart(7) + '  +1 AD = ' + delta_ad.toFixed(4).padStart(9) + '  +1 AP = ' + delta_ap.toFixed(4).padStart(9) + '  ratio AD/AP = ' + (Number.isFinite(ratio) ? ratio.toFixed(3) : ratio));
}
// ---- 2) CONTROLOS OBRIGATÓRIOS ---------------------------------------------------------------
console.log('');
console.log('== 2. CONTROLOS ==');
const por = Object.fromEntries(linhas.map((x) => [x.campeao, x]));
const okLux = null;   // INDISPONÍVEL: o kit do Lux não está no sim-chefes.mjs (declarado, não inventado)
const okYasuo = !(por.yasuo.delta_ap > por.yasuo.delta_ad * 0.5);  // AD puro: o AP não pode render como o AD
const okKat = por.katarina.delta_ad > 0 && por.katarina.delta_ap > 0;
console.log('  LUX (mago puro)      INDISPONÍVEL: o KITS_SIM/HAB_SIM do sim-chefes.mjs só tem yasuo e katarina');
console.log('  YASUO (AD puro)      delta_ad=' + por.yasuo.delta_ad + ' vs delta_ap=' + por.yasuo.delta_ap + '  -> ' + (okYasuo ? 'OK' : 'FALHOU (o AP rende como o AD: fixture errado)'));
console.log('  KATARINA (hibrida)   delta_ad=' + por.katarina.delta_ad + ' e delta_ap=' + por.katarina.delta_ap + '  -> ' + (okKat ? 'ambos não-nulos' : 'FALHOU (um dos lados é zero)'));
console.log('');
console.log('  RATIO da Katarina = ' + por.katarina.ratio + '  (peso do AD = peso do AP x ratio; o peso do AP no perfil mago é 1.2)');
console.log('  => peso do AD sugerido para o perfil dela = ' + (typeof por.katarina.ratio === 'number' ? (1.2 * por.katarina.ratio).toFixed(3) : 'n/a'));
console.log('');
console.log('== 3. REFERENCIA (dpsTeorico total, com autos e itens — não injectável) ==');
for (const c of NOMES) { try { const r = dpsTeorico(c, NIVEL, [], BOSS, { atrib: ATRIB_DONO }); console.log('  ' + c.padEnd(9) + ' total=' + JSON.stringify(r && r.total != null ? +Number(r.total).toFixed(1) : r && Object.keys(r).slice(0, 6))); } catch (e) { console.log('  ' + c + ' dpsTeorico falhou: ' + String(e).slice(0, 120)); } }
