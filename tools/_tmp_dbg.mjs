
import { ITENS, baseId, infoItem, statsJogador, statsBossFiel, nivelDoChefe, dpsTeorico, ranksNoNivel, buildExtensao, melhoresBuilds, lutarChefe, curaDaBuild, fatorDanoJogador, mit, KITS_SIM, HAB_SIM } from './sim-chefes.mjs';
const ATRIB = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };
const NIVEL = 29;
const BOSS = statsBossFiel('Drag\u00e3o Infernal', nivelDoChefe([30,38], NIVEL));
const RANKS = ranksNoNivel('katarina', NIVEL, statsJogador('katarina', NIVEL, buildExtensao('katarina'), ATRIB), BOSS);
// teste: a build AD/crit e' real ou e' o extra do 3153 a critar?
function autoPorSeg(itens) {
  const d = dpsTeorico('katarina', NIVEL, itens, BOSS, { atrib: ATRIB, ranks: RANKS });
  const st = d.st;
  const fj = fatorDanoJogador(NIVEL, BOSS.nivel);
  const papel = KITS_SIM.katarina.papel.dano;
  const arm = BOSS.armadura * (1 - st.penArmadura);
  const esperanca = (1 - st.critico) + st.critico * st.danoCritico;
  const autoPuro = mit(st.ad * esperanca, arm) * papel * fj * st.velAtaque;
  const extra3153 = d.det.auto - autoPuro;
  return { itens: itens.join(','), ad: Math.round(st.ad), ap: Math.round(st.ap), va: +st.velAtaque.toFixed(2), crit: st.critico, dc: st.danoCritico,
    auto: Math.round(d.det.auto), autoPuro: Math.round(autoPuro), extra3153: Math.round(extra3153), skills: Math.round(d.skills), giro: Math.round(d.giro), itens_d: Math.round(d.itens), total: Math.round(d.total) };
}
const AD = ['3172','3153','3031','3036','3085'];
const ADsem3153 = ['3172','3031','3036','3085','3031'];
const DONO = ['3175~A','3089+2~B','3100+3~A','3135~A','4629+3~A'];
const AP2 = ['3175~A','3089+2~B','3100+3~A','3135~A','4645+2~A'];
for (const b of [AD, DONO, AP2]) console.log(JSON.stringify(autoPorSeg(b)));
// familia AP: forcar itens de mago e ver a melhor
const apCands = melhoresBuilds('katarina', NIVEL, BOSS, { atrib: ATRIB, ranks: RANKS, shortlist: 20,
  filtro: (ids) => { const semBota = ids.slice(1); const ap = semBota.filter(x => (ITENS[baseId(x)].ap||0) > 0).length; return ap >= 3; } });
console.log('\nAP-family top 6:');
for (const b of apCands.slice(0,6)) {
  const d = dpsTeorico('katarina', NIVEL, b.ids, BOSS, { atrib: ATRIB, ranks: RANKS });
  console.log('  ' + Math.round(d.total) + ' dps | ' + b.ids.map(x=>ITENS[baseId(x)].nome).join(' + '));
}
console.log('\nAD-family (sem filtro) top 3 nomes:');
for (const b of melhoresBuilds('katarina', NIVEL, BOSS, { atrib: ATRIB, ranks: RANKS, shortlist: 20 }).slice(0,3))
  console.log('  ' + b.ids.map(x=>x+':'+ITENS[baseId(x)].nome).join(' + '));
