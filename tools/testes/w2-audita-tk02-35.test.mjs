/* w2-audita-tk02-35.test.mjs - AUDITORIA (W2b) de TK-02-35: multiplicador do proc do
 * Lich derivado da FREQUÊNCIA de skills (recargas do motor), não do ×2,2 fixo.
 * Corre directo: bun tools/testes/w2-audita-tk02-35.test.mjs */
import { criarMundo, carregarAutomation, alimentarMeta } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';
/* Recargas transcritas do kit da Katarina (motor.js M.KITS.katarina, lido do jogo vivo =
 * kit-katarina-vivo.json): Q,E,R,G,A,T com base/ratio (dano). W/F não têm dano (não conjuram). */
const KAT = {
  Q:{nivel:1,max:10,recarga:[10,9.65,9.3,8.95,8.6,8.25,7.9,7.55,7.2,6.85],base:[80,115,150],ratio:[0.45,0.48,0.51]},
  W:{nivel:1,max:10,recarga:[14,13.6,13.2,12.8,12.4,12,11.6,11.2,10.8,10.4]},
  E:{nivel:1,max:10,recarga:[10,9.6,9.2,8.8,8.4,8,7.6,7.2,6.8,6.4],base:[40,60,80],ratio:[0.3,0.32,0.34],adRatio:0.4},
  R:{nivel:6,max:5,recarga:[75,65,55,48,42],base:[30,44,58],ratio:[0.25,0.28,0.31]},
  G:{nivel:8,max:10,recarga:[20,19.2,18.4,17.6,16.8,16,15.2,14.4,13.6,12.8],base:[30,45,60],ratio:[0.3,0.315,0.33]},
  A:{nivel:13,max:10,recarga:[12,11.5,11,10.5,10,9.5,9,8.5,8,7.5],base:[90,125,160],ratio:[0.6,0.635,0.67]},
  T:{nivel:28,max:10,recarga:[24,23.2,22.4,21.6,20.8,20,19.2,18.4,17.6,16.8],base:[60,88,116],ratio:[0.4,0.43,0.46]},
};
/* Taric = "mago" de contraste (motor.js M.KITS.taric): Q é rápido (recarga[0]=6). */
const TAR = {
  Q:{nivel:1,max:10,recarga:[6,5.8,5.6,5.4,5.2,5,4.8,4.6,4.4,4.2],base:[60,86,112],ratio:[0.35,0.37,0.39]},
  W:{nivel:1,max:10,recarga:[15,14.5,14,13.5,13,12.5,12,11.5,11,10.5]},
  E:{nivel:1,max:10,recarga:[13,12.6,12.2,11.8,11.4,11,10.6,10.2,9.8,9.4],base:[110,155,200],ratio:[0.5,0.53,0.56]},
  R:{nivel:6,max:5,recarga:[140,120,100,85,70],base:[320,460,600],ratio:[1.1,1.22,1.34]},
  A:{nivel:13,max:10,recarga:[12,11.5,11,10.5,10,9.5,9,8.5,8,7.5],base:[90,125,160],ratio:[0.6,0.635,0.67]},
  T:{nivel:28,max:10,recarga:[11,10.6,10.2,9.8,9.4,9,8.6,8.2,7.8,7.4],base:[110,158,206],ratio:[0.7,0.74,0.78]},
};
const mk = (kit, papel) => ({ kit, adBase: 58, adNivel: 3.4, magia: true, semMana: true, distancia: false, papel });
let falhas = 0, n = 0;
const ck = (l, c) => { n++; console.log((c === true ? 'ok: ' : 'FALHOU: ') + l); if (c !== true) falhas++; };
const m = criarMundo(); const auto = carregarAutomation(m);
alimentarMeta(m, { itens: ITENS_DADOS, kits: { katarina: mk(KAT, { dano: 1.2 }), taric: mk(TAR, { dano: 0.9 }) } });
const kat = { id: 'katarina', magia: true, papel: { dano: 1.2 } };
const tar = { id: 'taric', magia: true, papel: { dano: 0.9 } };
const setL = (L) => { m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(L) })]); m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(L) })]); };

setL(1);
const vp1 = auto.valorPassiva('3100', kat);
// nível 1: só Q e E destrancadas, ambas rank 1 = recarga[0]=10 (motor). freq=1/10+1/10=0,2. Lich=75 x 9 x 0,2 = 135.
ck('A1 [nível 1, preciso]: só Q+E destrancadas; freq=1/10+1/10=0,2 -> Lich = 75x9x0,2 = 135', Math.abs(vp1 - 135) < 1e-9);
setL(29);
const vpK = auto.valorPassiva('3100', kat), vpT = auto.valorPassiva('3100', tar);
ck('A2: o valor do Lich É específico do campeão (deixou de ser o ×2,2 fixo)', vpK !== vpT);
ck('A3: o valor sobe com o nível (mais skills destrancadas = mais procs): vp(1)=135 < vp(29)', vp1 < vpK);
const vp13 = (setL(13), auto.valorPassiva('3100', kat));
ck('A4: monótono: vp(13) <= vp(29) e vp(29) >= vp(1)', vp13 <= vpK && vpK >= vp1);
setL(29);
const vpSemKit = auto.valorPassiva('3100', { id: 'desconhecido', magia: true });
ck('A5: campeão SEM kit legível -> freq 0 (mudança vs ×2,2; a documentar)', vpSemKit === 0);
console.log('  VALORES medidos: freqSkills(katarina@29)=' + (vpK / 675).toFixed(4) + ', freqSkills(taric@29)=' + (vpT / 675).toFixed(4) + '  => Kat>Taric? ' + (vpK > vpT));
console.log('  NOTA AUDITORIA: "Katarina>Taric" é FALSO com este modelo (Q do Taric = 6..4,2 s < Q da Katarina 10..6,85). O ×2,2 fixo foi removido e o valor passa a sair das recargas do motor — é isso que o ticket pede.');
console.log('AUDITA TK-02-35: ' + (n - falhas) + '/' + n + ' ok');
process.exit(falhas ? 1 : 0);
