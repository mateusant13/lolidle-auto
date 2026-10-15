// integra-grupos.mjs — integração por GRUPOS coerentes, medida pelo banco (hill-climbing).
// Uso: bun tools/integra-grupos.mjs   -> log em docs/tickets/integra-grupos.md
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const RAIZ = 'I:\\!lolidle.com';
const AUTO = RAIZ + '\\extension\\automation.js';
const LOG = RAIZ + '\\docs\\tickets\\integra-grupos.md';
const sh = (cmd) => execSync(cmd, { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' });
function ex(linhas, nome) {
  const i = linhas.findIndex(l => new RegExp('^\\s*(async function|function|const|let|var) ' + nome + '\\b').test(l));
  if (i < 0) return null;
  let prof = 0, com = false, fim = i;
  for (let k = i; k < linhas.length; k++) {
    for (const ch of linhas[k]) { if (ch === '{') { prof++; com = true; } else if (ch === '}') prof--; }
    if (com && prof <= 0) { fim = k; break; }
    if (!com && k > i + 3) { fim = k; break; }
  }
  return { ini: i, fim, txt: linhas.slice(i, fim + 1).join('\n') };
}
const R = {};
for (const r of ['_w1','_w3','_w4','_w9score','_w10config','_w11boss','_w12']) {
  try { R[r] = readFileSync(RAIZ + '\\tools\\' + r + '.js','utf8').replace(/\\r/g,'').split('\n'); } catch { R[r] = null; }
}
const medir = () => { let o = ''; try { o = sh('H:\\bun\\bin\\bun.exe tools/testes/run.mjs 2>&1'); } catch (e) { o = String(e.stdout||'') + String(e.stderr||''); } return { f: (o.match(/FALHOU:/g)||[]).length, u: (o.match(/is not defined/g)||[]).length }; };
const valido = (t) => { try { writeFileSync(AUTO, t); sh('node --check extension/automation.js'); return true; } catch { return false; } };
const aplica = (txt, nome, ramo) => {
  const L = txt.split('\n'); const bM = ex(L, nome); const bR = R[ramo] ? ex(R[ramo], nome) : null;
  if (!bR) return null;
  if (bM) { L.splice(bM.ini, bM.fim - bM.ini + 1, ...bR.txt.split('\n')); return L.join('\n'); }
  const i = L.findIndex(l => /^\s*async function refinarMelhores\b/.test(l)); if (i < 0) return null;
  L.splice(i, 0, ...bR.txt.split('\n'), ''); return L.join('\n');
};
const patche = (txt, fn) => { const t = fn(txt); return t === txt ? null : t; };
const GRUPOS = [
  { nome: 'A w3 (observabilidade+barra+parsers)', pecas: [['carregarMeta','_w3'],['curva','_w3'],['barraIdeal','_w3'],['readStats','_w3'],['parseBig','_w3'],['consumirEvento','_w3'],['estadoVivo','_w3'],['eventosVivos','_w3'],['eventosContadores','_w3']],
    patches: [
      (t) => t.replace("  let _estadoVivo = null;", "  let _estadoVivo = null;\n  let _eventosVivos = [];\n  let _eventosCont = {};"),
      (t) => t.replace("if (d.__lolidleAuto === 'evento') { consumirEvento(d); return; }", "if (d.__lolidleAuto === 'evento') { try { if (d && d.tipo === 'chefeInvoca') { larvasInvoca.push({ at: d.at || Date.now(), n: 2 }); } } catch {} consumirEvento(d); return; }"),
      (t) => t.replace(/let ultimoFurioso = 0;/, "  const larvasInvoca = [];\n  const LARVAS_JANELA_MS = 90000;\n  let ultimoFurioso = 0;"),
      (t) => t.replace("const { cdr, pen, lich, chama, liandry, det } = S;", "const { cdr, pen, penArmadura, lich, chama, liandry, det } = S;"),
      (t) => { const L = t.split('\n'); const i = L.findIndex(l => /^\s+out\[t\] = \{ max: h\.max/.test(l)); if (i < 0 || L[i].includes('alvos:')) return t; L[i] = L[i].replace('out[t] = { max: h.max, mult: h.mult,', 'out[t] = { max: h.max, mult: h.mult, alvos: h.alvos != null ? h.alvos : null,'); return L.join('\n'); },
    ] },
  { nome: 'B w9+w12 (score/build/stats)', pecas: [['statsSet','_w12'],['statsDePeca','_w9score'],['pecaConhecida','_w9score'],['infoItem','_w9score'],['valorPassiva','_w9score'],['scoreSet','_w9score'],['estimarSet','_w9score']],
    patches: [
      (t) => t.replace(/(let apItem = 0, adItem = 0, apPct = 0, cdr = 0, pen = 0, penArmadura = 0,)/, "$1 rvItens = 0,").replace(/(penArmadura \+= pa;)/, "$1 rvItens += (it.rv || 0) * m;").replace(/(return \{ ap: apItem \* \(1 \+ apPct\), ad: adItem, cdr, pen, penArmadura,)/, "$1 rv: rvItens,"),
      (t) => { const L = t.split('\n'); const i = L.findIndex(l => /^\s*const CAMPOS_MULT = \[/.test(l)); if (i < 0 || L[i].includes('penMag')) return t; const l9 = R['_w9score'].find(x => /^\s*const CAMPOS_MULT = \[/.test(x)); L[i] = l9; return L.join('\n'); },
    ] },
  { nome: 'C w10 (config/mercado/farm-item)', pecas: [['farmarItem','_w10config'],['farmarItemPasso','_w10config'],['escolherConjunto','_w10config'],['porMelhorBase','_w10config'],['valorEquip','_w10config'],['valorVenda','_w10config'],['migrarCfg','_w10config']],
    patches: [ (t) => { const b = R['_w10config'].find(l => /let _farmItem/.test(l)); return b && !/let _farmItem/.test(t) ? t.replace("  let _estadoVivo = null;", "  " + b.trim() + "\n  let _estadoVivo = null;") : t; } ] },
  { nome: 'D w1 (regiões)', pecas: [['nivelAlvo','_w1'],['nivelMobDe','_w1'],['mediaWaveDe','_w1'],['estimarRegiao','_w1'],['nivelChefeDe','_w1']], patches: [] },
  { nome: 'E w4 (fuga/viagem)', pecas: [['viajarPara','_w4'],['proximoGiro','_w4'],['localId','_w4'],['checarChefeFatal','_w4']],
    patches: [ (t) => { let s = t; for (const n of ['_giroTent','VIAGEM_MAPA_MAX','VIAGEM_MAX_TENT','_viagemMapaTent']) { if (!new RegExp('(function|const|let|var) ' + n + '\\b').test(s)) { const b = R['_w4'].find(l => new RegExp('(const|let|var) ' + n + '\\b').test(l)); if (b) s = s.replace("  let _estadoVivo = null;", "  " + b.trim() + "\n  let _estadoVivo = null;"); } } return s; } ] },
  { nome: 'F w11 (build de chefe)', pecas: [['NIVEL_DIF_FB','_w11boss']], patches: [] },
];
let base = readFileSync(AUTO,'utf8').replace(/\\r/g,'');
writeFileSync(AUTO, base);
let melhor = medir();
appendFileSync(LOG, '\n# Integração por GRUPOS — ' + new Date().toISOString() + '\n\nBASE: ' + melhor.f + ' falhas\n\n');
console.log('BASE ' + melhor.f);
for (const g of GRUPOS) {
  let tent = base;
  for (const [nome, ramo] of g.pecas) { const r = aplica(tent, nome, ramo); if (r) tent = r; }
  for (const p of g.patches) { const r = patche(tent, p); if (r) tent = r; }
  if (!valido(tent)) { writeFileSync(AUTO, base); appendFileSync(LOG, '- ' + g.nome + ': SINTAXE quebrou\n'); console.log(g.nome + ' sintaxe'); continue; }
  const r = medir();
  if (r.f < melhor.f) { base = tent; appendFileSync(LOG, '- ' + g.nome + ': MANTIDO (' + melhor.f + ' -> ' + r.f + ')\n'); melhor = r; console.log(g.nome + ' -> ' + r.f); }
  else { writeFileSync(AUTO, base); appendFileSync(LOG, '- ' + g.nome + ': revertido (' + melhor.f + ' -> ' + r.f + ')\n'); console.log(g.nome + ' revertido'); }
}
writeFileSync(AUTO, base);
appendFileSync(LOG, '\nFINAL: ' + medir().f + ' falhas\n');
console.log('FINAL ' + medir().f);
