// resolve-merge.mjs — resolve os conflitos repetitivos do pipeline leitor->worker.
// 1) docs/tickets/* -> fica SEMPRE a versao do master (a mais nova; os workers levaram copias velhas
//    por causa do checkout de ficheiros de contexto nos worktrees).
// 2) tools/testes/run.mjs -> UNIAO dos dois lados (cada worker acrescenta a sua suite).
// Uso: node tools/resolve-merge.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const emConflito = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const fora = { resolvidos: [], runUnido: false };
for (const f of emConflito) {
  if (f.startsWith('docs/tickets/')) { execSync('git checkout --ours -- "' + f + '"'); execSync('git add -- "' + f + '"'); fora.resolvidos.push(f + ' (ours)'); }
}
const runPath = 'tools/testes/run.mjs';
if (emConflito.includes(runPath)) {
  let s = readFileSync(runPath, 'utf8').replace(/\r/g, '');
  s = s.replace(/<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> [^\n]*\n/g, (m, ours, theirs) => {
    const lo = ours.trim().split('\n').map(x => x.trim()).filter(Boolean);
    const lt = theirs.trim().split('\n').map(x => x.trim()).filter(Boolean);
    if (lo.length === 1 && lt.length === 1 && /^import/.test(lo[0]) && /^import/.test(lt[0])) return lo[0] + '\n' + lt[0];
    if (lo.length === 1 && lt.length === 1 && /^const SUITES/.test(lo[0])) {
      const extraT = lt[0].replace(/^const SUITES = \[/, '').replace(/\];?$/, '').split(',').map(x => x.trim()).filter(Boolean);
      const base = lo[0].replace(/\];?$/, '').replace(/^const SUITES = \[/, '').split(',').map(x => x.trim()).filter(Boolean);
      const todos = [...new Set([...base, ...extraT])];
      return 'const SUITES = [' + todos.join(', ') + '];';
    }
    return ours.trim() + '\n' + theirs.trim();
  });
  writeFileSync(runPath, s);
  execSync('git add -- ' + runPath);
  fora.runUnido = true;
  fora.resolvidos.push(runPath + ' (uniao)');
}
console.log(JSON.stringify(fora, null, 1));
