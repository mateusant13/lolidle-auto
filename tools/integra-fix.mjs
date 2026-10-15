// integra-fix.mjs — aplica grupos A+D e corrige automaticamente os símbolos indefinidos
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const RAIZ = 'I:\\!lolidle.com', AUTO = RAIZ + '\\extension\\automation.js', LOG = RAIZ + '\\docs\\tickets\\integra-fix.md';
const sh = (c) => execSync(c, { cwd: RAIZ, encoding: 'utf8', stdio: 'pipe' });
function ex(L, nome) { const i = L.findIndex(l => new RegExp('^\\s*(async function|function|const|let|var) ' + nome + '\\b').test(l)); if (i < 0) return null; let p = 0, c = false, f = i; for (let k = i; k < L.length; k++) { for (const ch of L[k]) { if (ch === '{') { p++; c = true; } else if (ch === '}') p--; } if (c && p <= 0) { f = k; break; } if (!c && k > i + 3) { f = k; break; } } return { ini: i, fim: f, txt: L.slice(i, f + 1).join('\n') }; }
const R = {};
for (const r of ['_w1','_w3','_w4','_w9score','_w10config','_w11boss','_w12']) { try { R[r] = readFileSync(RAIZ + '\\tools\\' + r + '.js','utf8').replace(/\\r/g,'').split('\n'); } catch { R[r] = null; } }
const banco = () => { let o = ''; try { o = sh('H:\\bun\\bin\\bun.exe tools/testes/run.mjs 2>&1'); } catch (e) { o = String(e.stdout||'')+String(e.stderr||''); } return { f: (o.match(/FALHOU:/g)||[]).length, und: [...new Set((o.match(/ReferenceError: (\w+) is not defined/g)||[]).map(m=>m.replace(/.*ReferenceError: /,'').replace(/ is not defined/,'')))] }; };
const valido = (t) => { try { writeFileSync(AUTO, t); sh('node --check extension/automation.js'); return true; } catch { return false; } };
const aplica = (txt, nome, ramo) => { const L = txt.split('\n'); const bM = ex(L, nome), bR = R[ramo] ? ex(R[ramo], nome) : null; if (!bR) return null; if (bM) { L.splice(bM.ini, bM.fim - bM.ini + 1, ...bR.txt.split('\n')); return L.join('\n'); } const i = L.findIndex(l => /^\s*async function refinarMelhores\b/.test(l)); if (i < 0) return null; L.splice(i, 0, ...bR.txt.split('\n'), ''); return L.join('\n'); };
let base = readFileSync(AUTO,'utf8').replace(/\\r/g,'');
let m = banco();
appendFileSync(LOG, '\n# integra-fix — ' + new Date().toISOString() + '\nBASE: ' + m.f + ' | indefinidos: ' + (m.und.join(',')||'-') + '\n');
console.log('BASE ' + m.f + ' | und: ' + m.und.join(','));
const GRUPO = [['carregarMeta','_w3'],['curva','_w3'],['barraIdeal','_w3'],['readStats','_w3'],['parseBig','_w3'],['consumirEvento','_w3'],['estadoVivo','_w3'],['eventosVivos','_w3'],['eventosContadores','_w3'],['nivelAlvo','_w1'],['nivelMobDe','_w1'],['mediaWaveDe','_w1'],['estimarRegiao','_w1']];
for (const [nome, ramo] of GRUPO) { const t = aplica(base, nome, ramo); if (!t) continue; if (valido(t)) base = t; else { writeFileSync(AUTO, base); appendFileSync(LOG, '- ' + nome + ': sintaxe, revertido\n'); } }
writeFileSync(AUTO, base);
m = banco();
appendFileSync(LOG, 'apos grupo: ' + m.f + ' | indefinidos: ' + (m.und.join(',')||'-') + '\n');
console.log('apos grupo ' + m.f + ' | und: ' + m.und.join(','));
// corrector: por cada indefinido, buscar a declaração nos ramos e inserir
for (let volta = 1; volta <= 3 && m.und.length; volta++) {
  let t = base;
  for (const nome of m.und) {
    if (new RegExp('(function|const|let|var) ' + nome + '\\b').test(t)) continue;
    for (const r of Object.keys(R)) { const b = R[r] ? ex(R[r], nome) : null; if (b) { const L = t.split('\n'); const i = L.findIndex(l => /^\s*async function refinarMelhores\b/.test(l)); if (i < 0) break; L.splice(i, 0, ...b.txt.split('\n'), ''); t = L.join('\n'); appendFileSync(LOG, '+ ' + nome + ' de ' + r + '\n'); break; } }
  }
  if (!valido(t)) { writeFileSync(AUTO, base); break; }
  base = t; m = banco();
  appendFileSync(LOG, 'volta ' + volta + ': ' + m.f + ' | indefinidos: ' + (m.und.join(',')||'-') + '\n');
  console.log('volta ' + volta + ' ' + m.f + ' | und: ' + m.und.join(','));
}
writeFileSync(AUTO, base);
appendFileSync(LOG, 'FINAL: ' + banco().f + ' falhas\n');
console.log('FINAL ' + banco().f);
