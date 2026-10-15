#!/usr/bin/env node
/*
 * run.mjs - RUNNER do banco de regressao do LoL Idle.
 *
 *   node tools/testes/run.mjs [--verbose] [--filter <nome>]
 *
 * Executa o extension/automation.js REAL dentro de um vm com DOM stubado (dom-stub.mjs),
 * corre as suites (regras.test.mjs, ator.test.mjs) e:
 *   - imprime POPULATION <n> (total de assercoes)
 *   - imprime o resumo por suite (checks/falhas)
 *   - reporta UNSTUBBED:<selector> para qualquer seletor que o stub nao conheca
 *     (cada buraco vira uma FALHA: o banco nunca da verde com buraco)
 *   - reporta INTERVALS (setInterval registados mas nao disparados: limitacao declarada)
 *   - rc=0 SOMENTE se tudo passar
 *
 * Sem browser, sem CDP, sem jogo. So le o automation.js e corre-o isolado.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import process from 'node:process';
import { AUTOMATION_PATH, AUTOMATION_REL, RAIZ, criarMundo, carregarAutomation, mundosCriados } from './dom-stub.mjs';
import { suite as suiteRegras } from './regras.test.mjs';
import { suite as suiteAtor } from './ator.test.mjs';
import { suite as suiteBarra } from './barra.test.mjs';
import { suite as suiteObjetivo } from './objetivo.test.mjs';
import { suite as suiteEquip } from './equip.test.mjs';
import { suite as suiteRegiao } from './regiao.test.mjs';
import { suite as suitePontos } from './pontos.test.mjs';
import { suite as suiteInterruptores } from './interruptores.test.mjs';
import { suite as suiteCofre } from './cofre.test.mjs';
// W3 (w3-barra) — integração com o inject.js (TK-INT-01).
import { suite as suiteIntegracao } from './integracao.test.mjs';
// W3 (w3-barra) — leitura de números do jogo (sufixo k/M do fmt).
import { suite as suiteNumeros } from './numeros.test.mjs';

const argv = process.argv.slice(2);
if (argv.indexOf('--help') >= 0 || argv.indexOf('-h') >= 0) {
  console.log('uso: node tools/testes/run.mjs [--verbose] [--filter <nome>]');
  console.log('  --verbose       imprime todas as assercoes (ok/FALHOU)');
  console.log('  --filter <nome> so CONTABILIZA/reporta assercoes cujo "suite/rotulo" contenha <nome>.');
  console.log('  env LOLIDLE_AUTOMATION=<path>  aponta o banco para uma COPIA (mutation testing);');
  console.log('                                o default e o extension/automation.js real.');
  console.log('                  (as suites continuam a correr inteiras, para o UNSTUBBED nao mentir)');
  process.exit(0);
}
const verbose = argv.indexOf('--verbose') >= 0;
let filtro = null;
const iF = argv.indexOf('--filter');
if (iF >= 0) filtro = String(argv[iF + 1] || '').toLowerCase();

const SUITES = [suiteRegras, suiteAtor, suiteBarra, suiteObjetivo, suiteEquip, suiteRegiao, suitePontos, suiteInterruptores, suiteCofre,
  suiteIntegracao, suiteNumeros];
const checks = [];
const notas = [];
let populacaoExecutada = 0;

function criarT(nome) {
  return {
    nome: nome,
    check: (rotulo, cond, detalhe) => {
      const ok = cond === true;
      populacaoExecutada++;
      checks.push({
        suite: nome,
        rotulo: String(rotulo),
        ok: ok,
        origem: 'suite',
        detalhe: detalhe != null ? String(detalhe) : (ok ? '' : 'valor=' + String(cond)),
      });
      return ok;
    },
    nota: (s) => notas.push('[' + nome + '] ' + String(s)),
  };
}

/* ------------------------------- execucao ------------------------------- */
const porSuite = [];
for (const s of SUITES) {
  const antes = mundosCriados().length;
  const t = criarT(s.nome);
  const t0 = Date.now();
  try {
    await s.run(t);
  } catch (e) {
    t.check('suite ' + s.nome + ': executou sem excecao', false, String((e && e.stack) || e));
  }
  const mundos = mundosCriados().slice(antes);
  porSuite.push({ suite: s, mundos: mundos, ms: Date.now() - t0 });
}

/* ----------- auditoria do stub: UNSTUBBED e erros async viram FALHA ----------- */
for (const ps of porSuite) {
  const nome = ps.suite.nome;
  const buracos = new Map();
  let erros = [];
  let intervals = 0;
  for (const m of ps.mundos) {
    for (const u of m.unstubbed()) {
      const cur = buracos.get(u.sel) || { sel: u.sel, escopos: new Set(), n: 0 };
      cur.n += u.n;
      for (const e of u.escopos) cur.escopos.add(e);
      buracos.set(u.sel, cur);
    }
    erros = erros.concat(m.estado.erros);
    intervals += m.estado.intervals.length;
  }
  for (const u of buracos.values()) {
    checks.push({
      suite: nome,
      rotulo: 'UNSTUBBED:' + u.sel,
      ok: false,
      origem: 'harness',
      detalhe: 'o codigo procurou um seletor que o stub nao conhece (escopo: ' + [...u.escopos].join(',') + ', n=' + u.n + ')',
    });
  }
  checks.push({
    suite: nome,
    rotulo: 'sem erros em callbacks async (setTimeout/storage/listeners)',
    ok: erros.length === 0,
    origem: 'harness',
    detalhe: erros.slice(0, 3).join(' | '),
  });
  ps.buracos = buracos.size;
  ps.erros = erros.length;
  ps.intervals = intervals;
  ps.mundosN = ps.mundos.length;
}

/* ------------------------------- filtro ------------------------------- */
function incluido(c) {
  if (c.rotulo.indexOf('UNSTUBBED:') === 0) return true;          // buraco nunca se esconde
  if (!filtro) return true;
  return (c.suite + '/' + c.rotulo).toLowerCase().indexOf(filtro) >= 0;
}
const visiveis = checks.filter(incluido);
const falhas = visiveis.filter((c) => !c.ok);

/* ------------------------------- saida ------------------------------- */
const bytes = fs.statSync(AUTOMATION_PATH).size;
const sha = crypto.createHash('sha256').update(fs.readFileSync(AUTOMATION_PATH)).digest('hex');
const rc = falhas.length ? 1 : 0;

console.log('LoL Idle - banco de regressao: automation.js REAL em vm com DOM stubado (sem browser/CDP)');
console.log('FONTE ' + AUTOMATION_REL + '  bytes=' + bytes + '  sha256=' + sha);
const nSuites = visiveis.filter((c) => c.origem === 'suite').length;
const nHarness = visiveis.length - nSuites;
console.log('POPULATION ' + visiveis.length + '  (assercoes das suites=' + nSuites + ' + ' + nHarness + ' checagens de integridade do harness)');
if (!visiveis.length) console.log('AVISO: nenhuma assercao corresponde ao filtro "' + filtro + '"');
console.log('');

for (const ps of porSuite) {
  const meus = visiveis.filter((c) => c.suite === ps.suite.nome);
  if (!meus.length) continue;
  const f = meus.filter((c) => !c.ok).length;
  console.log('SUITE ' + ps.suite.nome + ' - ' + ps.suite.titulo);
  console.log('  checks=' + meus.length + ' falhas=' + f + '  mundos=' + ps.mundosN + '  ms=' + ps.ms
    + '  UNSTUBBED=' + ps.buracos + '  errosAsync=' + ps.erros + '  intervals=' + ps.intervals);
  for (const c of meus) {
    if (c.ok) { if (verbose) console.log('  ok: ' + c.rotulo); }
    else console.log('  FALHOU: ' + c.rotulo + (c.detalhe ? ' -> ' + c.detalhe : ''));
  }
  console.log('');
}

const totalUnstubbed = porSuite.reduce((s, p) => s + p.buracos, 0);
const totalIntervals = porSuite.reduce((s, p) => s + p.intervals, 0);
console.log('UNSTUBBED ' + totalUnstubbed + (totalUnstubbed ? '  (cada buraco acima e uma FALHA: o stub nao conhece o seletor)' : '  (nenhum buraco: todos os seletores procurados estao no vocabulario do stub)'));
console.log('INTERVALS ' + totalIntervals + ' registados e NAO disparados (limitacao declarada: o loop de fundo do jogo fica fora do banco)');
if (filtro) console.log('FILTRO "' + filtro + '" aplicado na contagem (as suites correram inteiras para o UNSTUBBED nao mentir)');
if (notas.length) for (const n of notas) console.log('NOTA ' + n);
console.log('rc=' + rc);
process.exit(rc);
