/*
 * bateria.mjs - A BATERIA COM VEREDICTO E CACHE POR CONTEUDO.
 *
 * Origem: os protocolos de observabilidade do Sotto (2026-10-23), §9 e §10 - "cache incremental por
 * CONTEUDO, com o que corre e o que nao corre declarado" e "vocabulario do veredicto (jidoka:
 * desconhecido != verde)".
 *
 * O problema que isto resolve, medido neste repo: `mutantes.mjs` corre a bateria inteira uma vez por
 * mutacao (24 mutacoes x ~40 s = ~18 min) e o resultado so aparece no fim. Numa sessao inteira eu
 * matei essa corrida por a achar parada e fiquei sem saber se os mutantes sobreviveram. Um
 * instrumento cujo resultado eu nao consigo esperar nao e' um instrumento.
 *
 * Duas regras, copiadas do Sotto porque sao as que faltavam:
 *
 *   1. CACHE POR CONTEUDO (nao por mtime). O fingerprint de um passo e' o sha256 do CONTEUDO de
 *      todas as suas dependencias. Se o conteudo nao mudou, o resultado anterior e' reutilizado e o
 *      passo aparece como `cached` - nunca como `gate` silencioso.
 *   2. VOCABULARIO DO VEREDICTO. Cada passo tem UM estado:
 *        gate      - correu e passou
 *        fail      - correu e falhou
 *        cached    - nao correu; resultado anterior com o MESMO conteudo
 *        skipped   - nao correu (passo pesado sem LOLIDLE_BATERIA_HEAVY=1)
 *        missing   - a dependencia nao existe no disco
 *      `skipped` NAO e' portao que passou. O veredicto conta os saltados um a um.
 *
 * Uso:
 *   node tools/testes/bateria.mjs                 # sintaxe + suites (rapido)
 *   node tools/testes/bateria.mjs --heavy         # inclui os mutantes (~18 min)
 *   node tools/testes/bateria.mjs --refresh       # ignora a cache
 *   node tools/testes/bateria.mjs --estado        # mostra a cache e sai
 *
 * Saida: uma linha por passo + `BATTERY-VERDICT`. rc=0 so' com fail=0 E missing=0.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const TESTES = path.join(RAIZ, 'tools', 'testes');
const CACHE = path.join(TESTES, '.bateria-cache.json');
const LOGS = path.join(TESTES, '.bateria');

const arg = (n) => process.argv.slice(2).includes(n);
const AUTO = path.join(RAIZ, 'extension', 'automation.js');
const GUI = path.join(RAIZ, 'extension', 'gui.js');

/* ---------------------------------------------------------------------------------------------
 * PASSOs. `classe` decide o que corre por omissao:
 *   normal - corre sempre que o conteudo muda
 *   heavy  - abre trabalho pesado (aqui: 18 min de mutacoes); so' corre com --heavy, e quando nao
 *            corre o veredicto diz `skipped` (nunca `gate`)
 * ------------------------------------------------------------------------------------------- */
const PASSOS = [
  {
    id: 'sintaxe',
    classe: 'normal',
    o_que: 'node --check em automation.js e gui.js (um ficheiro que nao compila nao precisa de banco)',
    deps: [AUTO, GUI],
    cmd: [process.execPath, '-e', ''],
    custom: () => {
      const r1 = spawnSync(process.execPath, ['--check', AUTO], { encoding: 'utf8' });
      const r2 = spawnSync(process.execPath, ['--check', GUI], { encoding: 'utf8' });
      const err = String(r1.stderr || '') + String(r2.stderr || '');
      return { rc: r1.status === 0 && r2.status === 0 ? 0 : 1, out: err };
    },
  },
  {
    id: 'suites',
    classe: 'normal',
    o_que: 'o banco de regressao completo (tools/testes/run.mjs)',
    deps: [AUTO, GUI, path.join(TESTES, 'run.mjs'), path.join(TESTES, 'dom-stub.mjs'), path.join(TESTES, 'motor-fonte.mjs')],
    dirs: [TESTES],
    cmd: [process.execPath, 'tools/testes/run.mjs'],
  },
  {
    id: 'saude',
    classe: 'normal',
    o_que: 'a catraca de saude do codigo (ficheiros de produto so podem encolher)',
    deps: [path.join(TESTES, 'saude.mjs'), path.join(TESTES, 'saude-baseline.json')],
    dirs: [path.join(RAIZ, 'extension')],
    cmd: [process.execPath, 'tools/testes/saude.mjs'],
  },
  {
    id: 'mutantes',
    classe: 'heavy',
    o_que: 'o braco negativo: 24 mutacoes contra a bateria (sobrevivente = buraco)',
    deps: [AUTO, path.join(TESTES, 'mutantes.mjs'), path.join(TESTES, 'run.mjs')],
    dirs: [TESTES],
    cmd: [process.execPath, 'tools/testes/mutantes.mjs'],
  },
];

/* ---------------------------------------------------------------------------------------------
 * Fingerprint por CONTEUDO. Um passo cujo conteudo de dependencias nao mudou nao precisa de correr.
 * `dirs` e' a populacao inteira (todos os ficheiros do diretorio): uma lista de dependencias nunca
 * estaria completa, logo hashear o diretorio e' a unica forma de o cache nao dar falso verde.
 * ------------------------------------------------------------------------------------------- */
function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fingerprint(passo) {
  const partes = [];
  for (const p of passo.deps) {
    if (!fs.existsSync(p)) return { fp: null, falta: p };
    partes.push('f:' + path.relative(RAIZ, p) + '=' + sha(fs.readFileSync(p)));
  }
  for (const d of passo.dirs || []) {
    if (!fs.existsSync(d)) return { fp: null, falta: d };
    const nomes = fs.readdirSync(d).filter((n) => !n.startsWith('.')).sort();
    for (const n of nomes) {
      const f = path.join(d, n);
      // A populacao do diretorio NAO repete o que ja' e' dependencia declarada (nem o proprio
      // instrumento): mudar uma mutacao nao invalida a cache das suites, e mudar este ficheiro
      // nao invalida cache nenhuma.
      if (passo.deps.includes(f) || n === 'bateria.mjs') continue;
      if (!fs.statSync(f).isFile()) continue;
      partes.push('d:' + n + '=' + sha(fs.readFileSync(f)));
    }
  }
  return { fp: sha(partes.join('\n')), falta: null };
}

function lerCache() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return { passos: {} }; }
}

function gravarCache(c) {
  try { fs.mkdirSync(TESTES, { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c, null, 2), 'utf8'); } catch { /* cache e' acessorio */ }
}

/* ---------------------------------------------------------------------------------------------
 * Corrida.
 * ------------------------------------------------------------------------------------------- */
const cache = lerCache();
const heavy = arg('--heavy') || process.env.LOLIDLE_BATERIA_HEAVY === '1';
const refresh = arg('--refresh');

if (arg('--estado')) {
  for (const p of PASSOS) {
    const c = cache.passos[p.id];
    const f = fingerprint(p);
    const igual = c && f.fp && c.fp === f.fp;
    console.log(
      p.id.padEnd(10) + (p.classe === 'heavy' ? ' [heavy] ' : '') +
      (c ? 'ultimo_rc=' + c.rc + ' em ' + c.quando : 'nunca correu') +
      (c ? (igual ? '  CONTEUDO IGUAL (seria cached)' : '  CONTEUDO MUDOU') : '')
    );
  }
  process.exit(0);
}

fs.mkdirSync(LOGS, { recursive: true });
const antes = Date.now();
const resultados = [];

for (const p of PASSOS) {
  const { fp, falta } = fingerprint(p);
  if (falta) {
    resultados.push({ id: p.id, estado: 'missing', nota: 'nao existe: ' + path.relative(RAIZ, falta) });
    continue;
  }
  const anterior = cache.passos[p.id];
  if (!refresh && anterior && anterior.fp === fp) {
    resultados.push({
      id: p.id, estado: 'cached', rc: anterior.rc,
      nota: 'mesmo conteudo de ' + anterior.quando + ' (use --refresh para forcar)',
    });
    continue;
  }
  if (p.classe === 'heavy' && !heavy) {
    // Um passo que NAO corre nao e' um portao que passou.
    resultados.push({ id: p.id, estado: 'skipped', nota: 'heavy: nao corre sem --heavy (ou LOLIDLE_BATERIA_HEAVY=1)' });
    continue;
  }
  const t0 = Date.now();
  let rc, out;
  if (p.custom) {
    const r = p.custom();
    rc = r.rc; out = r.out;
  } else {
    const r = spawnSync(p.cmd[0], p.cmd.slice(1), { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    rc = r.status; out = String(r.stdout || '') + String(r.stderr || '');
  }
  const s = (Date.now() - t0) / 1000;
  const log = path.join(LOGS, p.id + '.log');
  try { fs.writeFileSync(log, out || '', 'utf8'); } catch { /* log e' acessorio */ }
  resultados.push({ id: p.id, estado: rc === 0 ? 'gate' : 'fail', rc, s, log });
  cache.passos[p.id] = { fp, rc, s, quando: new Date().toISOString(), log: path.relative(RAIZ, log) };
  gravarCache(cache);
}

/* ---------------------------------------------------------------------------------------------
 * Veredicto: um estado por passo, contado e nomeado. Nada de "passou" para o que nao correu.
 * ------------------------------------------------------------------------------------------- */
let gate = 0, fail = 0, cached = 0, skipped = 0, missing = 0;
for (const r of resultados) {
  if (r.estado === 'gate') gate++;
  if (r.estado === 'fail') fail++;
  if (r.estado === 'cached') cached++;
  if (r.estado === 'skipped') skipped++;
  if (r.estado === 'missing') missing++;
  const dur = r.s != null ? r.s.toFixed(1) + 's' : '-';
  console.log('PASSO ' + r.id.padEnd(10) + r.estado.padEnd(9) + 'rc=' + String(r.rc != null ? r.rc : '-').padEnd(4) + dur.padEnd(8) + (r.nota || ''));
  if (r.estado === 'fail') console.log('  log: ' + path.relative(RAIZ, r.log));
}
console.log('');
if (skipped) console.log('SALTADOS (nao contam como portao): ' + resultados.filter((r) => r.estado === 'skipped').map((r) => r.id).join(', '));
if (missing) console.log('EM FALTA: ' + resultados.filter((r) => r.estado === 'missing').map((r) => r.id + ' (' + r.nota + ')').join('; '));
console.log('BATTERY-VERDICT gate=' + gate + ' fail=' + fail + ' cached=' + cached + ' skipped=' + skipped + ' missing=' + missing + ' em ' + ((Date.now() - antes) / 1000).toFixed(1) + 's');
const rc = fail === 0 && missing === 0 ? 0 : 1;
console.log('rc=' + rc);
process.exit(rc);
