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
import { suite as suiteregras } from './regras.test.mjs';
import { suite as suiteator } from './ator.test.mjs';
import { suite as suitebarra } from './barra.test.mjs';
import { suite as suitebarrafase } from './barrafase.test.mjs';
import { suite as suiteobjetivo } from './objetivo.test.mjs';
import { suite as suiteequip } from './equip.test.mjs';
import { suite as suiteregiao } from './regiao.test.mjs';
import { suite as suitepontos } from './pontos.test.mjs';
import { suite as suiteinterruptores } from './interruptores.test.mjs';
import { suite as suitecofre } from './cofre.test.mjs';
import { suite as suitehud } from './hud.test.mjs';
import { suite as suiteintegracao } from './integracao.test.mjs';
import { suite as suitenumeros } from './numeros.test.mjs';
import { suite as suitescore } from './score.test.mjs';
import { suite as suiteplanejar } from './planejar.test.mjs';
import { suite as suiterefinar } from './refinar.test.mjs';
import { suite as suitew10 } from './w10.test.mjs';
// W3 (w3-barra) — integração com o inject.js (TK-INT-01).
// W3 (w3-barra) — leitura de números do jogo (sufixo k/M do fmt).
// W3 (w3-barra) — barra por fase (TK-02-18).
// W3 (w3-barra) — passivas de estado com contexto de combate (TK-02-05).
// W3 (w3-barra) — recomendação de pontos de atributo (TK-01-37).
import { suite as suiteAtributos } from './atributos.test.mjs';
import { suite as suiteRegiao, suiteW1, suiteE } from './regiao.test.mjs';
import { suite as suiteMotorTabelas } from './motor-tabelas.test.mjs';
import { suite as suiteRegrasMotor } from './regras-motor.test.mjs';
import { suite as suiteSnapshots } from './snapshots.test.mjs'
import { suite as suiteFuga } from './fuga.test.mjs';
// W3 (w3-barra) — integração com o inject.js (TK-INT-01).
import { suite as suiteChefe } from './chefe.test.mjs';
// W3 (w3-barra) — filtro de básicos (TK-02-27).
import { suite as suiteFiltroBasicos } from './filtrobasicos.test.mjs';
// W2 (w2-build) — prova de que a build vencedora fica equipada (TK-01-36).
import { suite as suiteBuildEquipada } from './build-equipada.test.mjs';
// WATCH DO MERCADO (2026-10-18): deteccao em tempo real por itens e por NOME DE JOGADOR + auto-compra.
import { suite as suiteMercadoWatch } from './mercado-watch.test.mjs';
// ALVOS DO AUTO-PLAY / BARRA POR DISPONIBILIDADE / TAREFAS POR VALOR-s / ESTADO COMPLETO (2026-10-18).
import { suite as suiteAlvosEstado } from './alvos-estado.test.mjs';
// TK-X2 (P0): a barra de CHEFE reserva um lugar para o atordoamento (interrompe a mecanica).
import { suite as suiteStunChefe } from './stun-chefe.test.mjs';
// REGRA DA ULTIMATE POR FASE + PORTAO DO MERCADO (2026-10-19): a ultimate so entra em fase dificil
// ou no chefe; comprar a build e auto-play (nao manutencao).
import { suite as suiteUltFase } from './ult-fase.test.mjs';
// DIAGNOSTICO DE FPS (2026-10-18): observer de novidades barato (body+childList) e sem empilhar na reinjecao.
import { suite as suiteObservers } from './observers.test.mjs';
// TK-01: MERCADO SO-LEITURA — o servidor decide, a UI so para acoes concretas.
import { suite as suiteMercadoServidor } from './mercado-servidor.test.mjs';
// TK-01: BANNER `#rastreio-tarefa.pronta` — so clica pronto E na Fonte.
import { suite as suiteTarefaBanner } from './tarefa-banner.test.mjs';
// TK-06: BUILD POR BEAM SEARCH + CACHE + ORÇAMENTO (pedido do Lead 2026-10-19).
import { suite as suiteBuildBeam } from './build-beam.test.mjs';
import { suite as suiteMotorMatematica } from './motor-matematica.test.mjs';
// QUEIXAS DE 2026-10-21: diaria pronta recebida em qualquer lugar, escala real das cartas,
// switches opt-in + migracao ver:3, factor de anuncio 0.90 e piso de compra tier A.
import { suite as suiteFix20261021 } from './fix-2026-10-21.test.mjs';
// PREÇO DO MERCADO + RARIDADE NOVA (dono, 2026-10-22): 1,5M só tier A, tier superior é tecto,
// Rabadon/Gume por excepção, e `mitica` nunca é vendida/movida.
import { suite as suiteMercadoPreco } from './mercado-preco.test.mjs';
// GUI (dono, 2026-10-21): texto auto-explicativo fora, contraste e popup da macro.
import { suite as suiteGuiTexto } from './gui-texto.test.mjs';
// ORDENS DE 2026-10-22 (dono): sempre em missão, skills que o PvE não ativa fora da rotação e
// chefe-fatal sem inviabilizar o farm (fuga na deteção).
import { suite as suitePveSempre } from './pve-sempre.test.mjs';
import { suite as suiteAbandono } from './abandono.test.mjs';
// SUSTENTO (dono, 2026-10-23): "que variaveis tu deixou de fora da luta do chefe onde a tua
// matematica diz que eu morro mas na realidade eu ganho" — regeneracao (motor.js:576/1464),
// roubo de vida no veredicto da regiao e vidas extra dos itens (motor.js:2999-3004).
import { suite as suiteSustento } from './sustento.test.mjs';

const argv = process.argv.slice(2);if (argv.indexOf('--help') >= 0 || argv.indexOf('-h') >= 0) {
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

// Lista de suites: usa APENAS os nomes importados acima (o merger paralelo juntou duas listas
// e deixou referencias a variaveis que nao existem — daqui o banco nao arrancar).
const SUITES = [
  suiteregras, suiteator, suitebarra, suitebarrafase, suiteobjetivo, suiteequip, suiteregiao,
  suitepontos, suiteinterruptores, suitecofre, suitehud, suiteintegracao, suitenumeros, suitescore, suiteplanejar, suiterefinar, suitew10, suiteAtributos,
  suiteRegiao, suiteW1, suiteE, suiteMotorTabelas, suiteRegrasMotor, suiteSnapshots, suiteFuga, suiteChefe, suiteFiltroBasicos, suiteBuildEquipada,
  suiteMercadoWatch,
  suiteStunChefe,
  suiteUltFase,
  suiteObservers,
  suiteAlvosEstado,
  suiteMercadoServidor,
  suiteTarefaBanner,
  suiteBuildBeam,
  suiteMotorMatematica,
  suiteFix20261021,
  suiteMercadoPreco,
  suiteGuiTexto,
  suitePveSempre,
  suiteAbandono,
  suiteSustento,
];
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
  fs.appendFileSync('tools/_suites.log', 'SUITE-INICIO ' + s.nome + '\n');
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
// HONESTIDADE (2026-10-18): imprime o caminho REALMENTE carregado, nao o rotulo fixo. Com
// LOLIDLE_AUTOMATION=<copia mutada> a linha dizia sempre 'extension/automation.js' e so a sha256
// provava qual ficheiro correu (um mutante chegou a passar por 'real' a primeira vista).
console.log('FONTE ' + AUTOMATION_PATH + '  bytes=' + bytes + '  sha256=' + sha);
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
