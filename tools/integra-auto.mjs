// integra-auto.mjs — integração com hill-climbing: aplica peça a peça e só mantém o que não piora.
// Uso: bun tools/integra-auto.mjs   (escreve o log em docs/tickets/integracao-auto.md)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const RAIZ = 'I:\\!lolidle.com';
const AUTO = RAIZ + '\\extension\\automation.js';
const LOG = RAIZ + '\\docs\\tickets\\integracoes-auto.md';
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
const ramos = {};
for (const r of ['_w1','_w3','_w4','_w9score','_w10config','_w11boss','_w12','_w2build','_w5equipar']) {
  try { ramos[r] = readFileSync(RAIZ + '\\tools\\' + r + '.js', 'utf8').replace(/\\r/g,'').split('\n'); } catch { ramos[r] = null; }
}
const medir = () => { try { const o = sh('H:\\bun\\bin\\bun.exe tools/testes/run.mjs 2>&1'); const f = (o.match(/FALHOU:/g) || []).length; const u = (o.match(/is not defined/g) || []).length; return { f, u, o }; } catch (e) { const o = String(e.stdout || '') + String(e.stderr || ''); const f = (o.match(/FALHOU:/g) || []).length; return { f, u: 99, o }; } };
const valido = (txt) => { try { writeFileSync(AUTO, txt); sh('node --check extension/automation.js'); return true; } catch { return false; } };
const pecas = [
  ['carregarMeta','_w3'],['curva','_w3'],['barraIdeal','_w3'],['readStats','_w3'],['parseBig','_w3'],
  ['infoItem','_w9score'],['valorPassiva','_w9score'],['scoreSet','_w9score'],['estimarSet','_w9score'],['statsSet','_w12'],
  ['statsDePeca','_w9score'],['pecaConhecida','_w9score'],['farmarItem','_w10config'],['farmarItemPasso','_w10config'],
  ['escolherConjunto','_w10config'],['porMelhorBase','_w10config'],['nivelMobDe','_w1'],['mediaWaveDe','_w1'],['estimarRegiao','_w1'],
  ['viajarPara','_w4'],['proximoGiro','_w4'],['localId','_w4'],['consumirEvento','_w3'],['estadoVivo','_w3'],
  ['eventosVivos','_w3'],['eventosContadores','_w3'],['recomendarAtributos','_w3'],['checarChefeFatal','_w4'],['nivelAlvo','_w1'],
];
let base = readFileSync(AUTO, 'utf8').replace(/\\r/g,'');
writeFileSync(AUTO, base);
let melhor = medir();
appendFileSync(LOG, '\n# Integração automática (hill-climbing) — ' + new Date().toISOString() + '\n\nBASE: ' + melhor.f + ' falhas\n\n');
console.log('BASE: ' + melhor.f + ' falhas');
for (const [nome, ramo] of pecas) {
  if (!ramos[ramo]) { appendFileSync(LOG, '- ' + nome + ': ramo ausente\n'); continue; }
  const L = base.split('\n');
  const bM = ex(L, nome), bR = ex(ramos[ramo], nome);
  if (!bR) { appendFileSync(LOG, '- ' + nome + ': fonte ausente\n'); continue; }
  let tentativa;
  if (bM) { const L2 = [...L]; L2.splice(bM.ini, bM.fim - bM.ini + 1, ...bR.txt.split('\n')); tentativa = L2.join('\n'); }
  else { const i = L.findIndex(l => /^\s*async function refinarMelhores\b/.test(l)); if (i < 0) continue; const L2 = [...L]; L2.splice(i, 0, ...bR.txt.split('\n'), ''); tentativa = L2.join('\n'); }
  if (!valido(tentativa)) { writeFileSync(AUTO, base); appendFileSync(LOG, '- ' + nome + ' (' + ramo + '): SINTAXE quebrou, revertido\n'); console.log(nome + ': sintaxe'); continue; }
  const r = medir();
  const ganho = melhor.f - r.f;
  if (r.f <= melhor.f && r.u === 0) { base = tentativa; appendFileSync(LOG, '- ' + nome + ' (' + ramo + '): MANTIDO (' + melhor.f + ' -> ' + r.f + ' falhas)\n'); melhor = r; console.log(nome + ': ' + melhor.f); }
  else { writeFileSync(AUTO, base); appendFileSync(LOG, '- ' + nome + ' (' + ramo + '): revertido (' + melhor.f + ' -> ' + r.f + ')\n'); console.log(nome + ': revertido'); }
}
writeFileSync(AUTO, base);
const fin = medir();
appendFileSync(LOG, '\nFINAL: ' + fin.f + ' falhas (base ' + (melhor.f + 0) + ')\n');
console.log('FINAL: ' + fin.f + ' falhas');
