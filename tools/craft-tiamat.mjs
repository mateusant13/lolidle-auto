#!/usr/bin/env bun
/**
 * craft-tiamat.mjs — espera o ouro chegar e MONTA o Tiamat sozinho.
 *
 * Porque existe: o farm corre a ~860 ouro/min e o Tiamat custa ~124.500 (a média que o
 * próprio jogo publica: 83 tentativas x 1.500). Em vez de ficar a sondar em cada turno,
 * este processo espera e monta — e como a protecção de componentes (§9.6v) está activa,
 * o item já NÃO pode ser vendido pelo auto-play.
 *
 * Uso: bun tools/craft-tiamat.mjs [--alvo 125000] [--vezes 100] [--gema arcana]
 */
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ALVO = Number(arg('--alvo', '125000'));
const VEZES = Number(arg('--vezes', '100'));
const GEMA = arg('--gema', 'arcana');
const RECEITA = arg('--receita', '3077');   // Tiamat
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const sh = (cmd) => { const p = Bun.spawnSync(['powershell', '-NoProfile', '-Command', cmd], { stdout: 'pipe', stderr: 'ignore' }); return String(p.stdout).trim(); };

async function ouro() {
  const p = Bun.spawnSync(['bun', 'tools/ll.mjs', 'eval', 'JSON.stringify({g:window.__lolidleAuto.readGold()})', '--conta', 'yasuo'], { cwd: 'I:/!lolidle.com', stdout: 'pipe', stderr: 'ignore' });
  try { const o = JSON.parse(String(p.stdout).trim()); const v = typeof o === 'string' ? JSON.parse(o) : o; return v.g; } catch { return null; }
}

console.log('[' + ts() + '] à espera de ' + ALVO + ' de ouro para montar a receita ' + RECEITA + '...');
for (let i = 0; i < 400; i++) {
  const g = await ouro();
  if (g == null) { console.log('[' + ts() + '] sem leitura de ouro (jogo offline?)'); await sleep(60000); continue; }
  if (g >= ALVO) {
    console.log('[' + ts() + '] ouro=' + g + ' >= ' + ALVO + ' -> a montar');
    // pausa curta e explícita (pausarPor retoma sozinho), viaja para a Fonte, monta
    const expr = "(async function(){var a=window.__lolidleAuto;a.pausarPor(240000);a.viajarPara('fonte');await new Promise(function(r){setTimeout(r,16000);});var res=await a.montarItem('" + RECEITA + "'," + VEZES + ",'" + GEMA + "');a.despausar();return JSON.stringify(res);})()";
    const p = Bun.spawnSync(['bun', 'tools/live-call.mjs', '--conta', 'yasuo', '--expr', expr, '--timeout', '120000'], { cwd: 'I:/!lolidle.com', stdout: 'pipe', stderr: 'ignore' });
    console.log('[' + ts() + '] resultado: ' + String(p.stdout).trim().slice(-400));
    break;
  }
  if (i % 10 === 0) console.log('[' + ts() + '] ouro=' + g + ' (faltam ' + (ALVO - g) + ')');
  await sleep(60000);
}
console.log('[' + ts() + '] fim');
