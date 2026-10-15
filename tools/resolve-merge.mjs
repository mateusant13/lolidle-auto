// resolve-merge.mjs — conflitos repetitivos do pipeline leitor->worker.
// docs/tickets/* -> ours (master é o mais novo). tools/testes/run.mjs -> UNIAO com newline.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const emConflito = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const fora = { resolvidos: [], runUnido: false };
for (const f of emConflito) {
  if (f.startsWith('docs/tickets/') || f.startsWith('docs/historico/')) {
    execSync('git checkout --ours -- "' + f + '"'); execSync('git add -- "' + f + '"');
    fora.resolvidos.push(f + ' (ours)');
  }
}
const runPath = 'tools/testes/run.mjs';
if (emConflito.includes(runPath)) {
  let s = readFileSync(runPath, 'utf8').replace(/\r/g, '');
  s = s.replace(/<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> [^\n]*\n/g, (m, ours, theirs) => {
    const juntar = (a, b) => {
      const A = a.trim(), B = b.trim();
      if (!A) return B; if (!B) return A;
      return A + '\n' + B;
    };
    const linhasO = ours.split('\n').map(x => x.trim()).filter(Boolean);
    const linhasT = theirs.split('\n').map(x => x.trim()).filter(Boolean);
    if (linhasO.length === 1 && linhasT.length === 1) {
      if (/^import/.test(linhasO[0]) && /^import/.test(linhasT[0])) return linhasO[0] + '\n' + linhasT[0];
      if (/^const SUITES/.test(linhasO[0]) && /^const SUITES/.test(linhasT[0])) {
        const num = t => t.replace(/^const SUITES = \[/, '').replace(/\];?\s*$/, '').split(',').map(x => x.trim()).filter(Boolean);
        return 'const SUITES = [' + [...new Set([...num(linhasO[0]), ...num(linhasT[0])])].join(', ') + '];';
      }
    }
    return juntar(ours, theirs);
  });
  // saneamento final: newline entre declaracoes coladas e imports unicas
  s = s.replace(/(\.test\.mjs'|\.mjs');(import |const |if \(|let )/g, "$1\n$2");
  const vistas = new Set();
  s = s.split('\n').filter(l => { const m = l.match(/^import \{ suite as \w+ \} from '\.\/([\w.-]+)'/); if (m) { if (vistas.has(m[1])) return false; vistas.add(m[1]); } return true; }).join('\n');
  const su = s.split('\n').map((l, i) => [i, l]).filter(([i, l]) => /^const SUITES = /.test(l));
  if (su.length > 1) {
    const nomes = new Set();
    for (const [i, l] of su) l.replace(/^const SUITES = \[/, '').replace(/\];?\s*$/, '').split(',').map(x => x.trim()).filter(Boolean).forEach(n => nomes.add(n));
    s.split('\n');
    const arr = s.split('\n'); arr[su[0][0]] = 'const SUITES = [' + [...nomes].join(', ') + '];';
    for (let k = su.length - 1; k >= 1; k--) arr.splice(su[k][0], 1);
    s = arr.join('\n');
  }
  writeFileSync(runPath, s);
  execSync('git add -- ' + runPath);
  fora.runUnido = true; fora.resolvidos.push(runPath + ' (uniao+saneamento)');
}
console.log(JSON.stringify(fora, null, 1));