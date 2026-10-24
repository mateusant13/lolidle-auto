#!/usr/bin/env node
/*
 * mutantes.mjs - MUTATION TESTING do banco de regressao (prova anti-falso-verde).
 *
 *   node tools/testes/mutantes.mjs
 *
 * Para cada mutacao: copia o extension/automation.js REAL para uma pasta temporaria,
 * aplica UMA alteracao cirurgica no texto-fonte (nunca no ficheiro real), corre o banco
 * contra a copia via LOLIDLE_AUTOMATION e exige que:
 *   (a) o runner saia com rc != 0, e
 *   (b) a assercao esperada apareca como FALHOU.
 *
 * Se alguma mutacao passar em verde, o banco TEM UM BURACO e este script falha.
 * O automation.js real nunca e escrito.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { RAIZ, AUTOMATION_PATH, AUTOMATION_REL } from './dom-stub.mjs';

const TMP = path.join(RAIZ, 'tools', 'testes', '.mutantes');

const MUTACOES = [
  {
    id: 'M1-protecao-build-desligada',
    o_que: 'ehLendarioDaBuild() sempre false (lendario da build deixa de ser blindado)',
    old: '    return lendariosDaClasse().has(b);',
    new: '    return false;',
    esperado: 'T2: fixture: 2001 e lendario da build do AD',
  },
  {
    id: 'M2-rabadon-vira-vendavel',
    o_que: 'ehPrioridadeExtrema() sempre false (Rabadon/Gume passam a ir ao mercado)',
    old: 'const ehPrioridadeExtrema = (base) => _PRIO_IDS.has(basePura(base));',
    new: 'const ehPrioridadeExtrema = (base) => false;',
    esperado: 'T10: Rabadon +2 abaixo de A nunca e anunciado',
  },
  {
    id: 'M3-base-com-refino-nao-parseada',
    o_que: "scanBag() deixa de tirar o '+refino' do id (3089+2 vira base '3089+2')",
    old: "        const base = String(baseRaw || '').replace(/#.*$/, '').replace(/\\+.*$/, '');",
    new: "        const base = String(baseRaw || '').replace(/#.*$/, '');",
    esperado: "T10: scanBag reconhece '3089+2~C' como base 3089",
  },
  {
    id: 'M4-mercado-saturado-sempre-falso',
    o_que: 'mercadoSaturado() volta a ser sempre false (o bug historico)',
    old: '      return { sat: lend >= 10, lend, total: of.length };',
    new: '      return { sat: false, lend, total: of.length };',
    esperado: 'T11: mercadoSaturado() com 10 ofertas lendarias -> sat = true',
  },
  {
    id: 'M5-ator-vende-tier-S',
    o_que: 'venderBase() deixa de travar S/SS (o tier intocavel)',
    old: "if (qIdx(qual) >= qIdx('S')) continue;",
    new: 'if (false) continue;',
    esperado: 'R2: nenhum item S+ foi vendido (S/SS, qualquer raridade)',
  },
  {
    id: 'M6-ator-vende-lendario-da-build',
    o_que: 'venderBase() esquece a protecao do lendario da build da classe',
    old: 'if (lend && lendaBuild.has(String(puro))) {',
    new: 'if (false && lend && lendaBuild.has(String(puro))) {',
    esperado: 'R1: o lendario DA BUILD esta em regras.protegidos com o motivo certo',
  },
  {
    id: 'M7-qualidade-ilegivel-vira-vendavel',
    o_que: "venderBase() deixa de proteger a qualidade '?'/ilegivel",
    old: 'if (!mq || !QUAL.includes(mq[1].toUpperCase())) {',
    new: 'if (!mq) {',
    esperado: 'R5: qualidade ilegivel vai para regras.protegidos com motivo de qualidade',
  },
  {
    id: 'M8-dedupe-fica-com-o-MENOR-tier',
    o_que: 'dedupe lendario ordena ao contrario (fica o MENOR tier: C em vez de B)',
    old: '      const arr = lendPorBase[base].slice().sort((a, b) => tierDe(b) - tierDe(a));',
    new: '      const arr = lendPorBase[base].slice().sort((a, b) => tierDe(a) - tierDe(b));',
    esperado: 'T3: a duplicata sai com motivo de duplicata',
  },
  {
    id: 'M9-perfil-ignora-papel',
    o_que: 'perfilDe ignora papel.recebido (o papel deixa de mudar o perfil)',
    old: 'const receb = pap.recebido != null ? pap.recebido : 1;',
    new: 'const receb = 1;',
    esperado: 'T7: papel muda o perfil (dano -> tanque)',
  },
  {
    id: 'M11-seletor-desconhecido-no-codigo',
    o_que: 'o codigo passa a procurar um seletor FORA do vocabulario do stub (buraco tem de aparecer)',
    old: "const t = document.querySelector('#st-ouro')?.textContent || '';",
    new: "const t = document.querySelector('#st-ouro')?.textContent || document.querySelector('#st-ouro-v2')?.textContent || '';",
    esperado: 'UNSTUBBED:#st-ouro-v2',
  },
  {
    id: 'M12-venda-exige-mochila-cheia-outra-vez',
    o_que: 'n.vender volta a exigir `mochilaQuaseCheia` (o bug de 2026-10-20: epicos/espolios nao sao vendidos na Fonte)',
    old: "      n.vender = podeFazer('vender').pode && (prioridade || (temEspolio && (naBase() || mochilaQuaseCheia)));",
    new: "      n.vender = podeFazer('vender').pode && prioridade && mochilaQuaseCheia;",
    esperado: 'V1: mochila NAO cheia + itens marcados -> n.vender VERDADEIRO',
  },
  {
    id: 'M13-naBase-sempre-verdadeiro',
    o_que: 'handleLog trata tudo como se estivesse na Fonte (naBase sempre true): nunca abre ciclo',
    old: 'const naBase = () => /fonte/i.test(loc.text);',
    new: 'const naBase = () => true;',
    esperado: 'U7: a frase de abate CRIA o ciclo da regiao',
  },
  {
    id: 'M14-faseAtual-sempre-mobs',
    o_que: "faseAtual() ignora `farm.current.fase === 'boss'` e devolve sempre mobs",
    old: "function faseAtual() { return farm.current?.fase === 'boss' ? 'chefe' : 'mobs'; }",
    new: "function faseAtual() { return 'mobs'; }",
    esperado: 'U9: rotacaoSkills na fase de chefe medida inclui a ULTIMATE',
  },
  {
    id: 'M15-anti-oscilacao-sempre-falso',
    o_que: 'barraIdeal deixa de bloquear uma skill que acabou de sair (volta a oscilar a cada ciclo)',
    old: "    const saidaRecente = (t) => barraCheia && _barraSaidas.has(t)",
    new: "    const saidaRecente = (t) => false && barraCheia && _barraSaidas.has(t)",
    esperado: 'B5: skill que acabou de sair NAO volta com a barra cheia',
  },
  {
    id: 'M16-trava-com-vaga-tambem',
    o_que: 'a trava de saida passa a aplicar-se mesmo com uma vaga (a barra fica em 3 slots)',
    old: 'const barraCheia = (s.bar || []).length >= BARRA_SLOTS;',
    new: 'const barraCheia = true;',
    esperado: 'B5: com uma VAGA a trava NAO se aplica e a barra enche',
  },
  {
    id: 'M17-dialogo-clica-o-primeiro-comprar',
    o_que: 'clicarDialogo volta a procurar em TODA a pagina antes do modal (clica o "Comprar" da lista e nao confirma a compra)',
    old: '    const b = noModal || [...document.querySelectorAll(\'button, .botao\')]',
    new: '    const b = [...document.querySelectorAll(\'button, .botao\')]',
    esperado: 'W10: clicarDialogo prefere o botao do MODAL ao "Comprar" da lista',
  },
  {
    id: 'M18-filtros-do-mercado-nao-limpos',
    o_que: 'prepararFiltrosMercado fica no-op (um filtro antigo esconde a ficha da oferta)',
    old: `    try { m.querySelector('[data-cat=""]')?.click(); } catch { /* ignore */ }`,
    new: `    try { /* mutado: nao limpa a categoria */ } catch { /* ignore */ }`,
    esperado: 'W11: categoria Todos e clicada',
  },
  {
    id: 'M10-perfil-ignora-distancia',
    o_que: 'perfilDe ignora distancia (atirador vira dano)',
    old: "if (c.distancia) return 'atirador';",
    new: "if (false && c.distancia) return 'atirador';",
    esperado: 'T8: distancia muda o perfil (dano -> atirador)',
  },
  {
    id: 'M13-sem-piso-do-lojista',
    o_que: 'os dois pisos (Lojista e minimo do jogo) desaparecem -> uma oferta de 64 volta a ser referencia e um lendario cai para 58',
    // NOTA (2026-10-23): a ancora antiga (`const pisoLoj = Math.max(0, ... valorVenda(..., refinoIt))`)
    // deixou de existir quando o preco passou a ler `pisosDoItem` (Lojista + minimo do JOGO). A
    // mutacao foi re-apontada para a linha que devolve os DOIS pisos — zerar so' o do Lojista nao
    // reproduz o defeito, porque o minimo do jogo (7999 em 3190~B) continuaria a segurar o preco.
    old: '    return { loj, jogo: pisoJogoDe(base, qual), total: Math.max(0, loj, pisoJogoDe(base, qual)) };',
    new: '    return { loj: 0, jogo: 0, total: 0 };   // mutado: sem piso nenhum',
    esperado: 'P9: oferta de 64 (abaixo do Lojista) NAO e referencia -> sem preco (nunca 58)',
  },
  {
    id: 'M14-compra-sem-olhar-se-ja-tenho',
    o_que: 'mercadoTemDaBuild deixa de verificar se o campeao ja tem o item (volta o ciclo de voltar a base de 20 em 20 s)',
    old: '        if (casa.has(String(base))) continue;                   // JÁ TENHO em casa (equipado/mochila)',
    new: '        if (false) continue;',
    esperado: 'M9b: ... mas JA A TENHO equipada -> false (era o ciclo de 20 em 20 s)',
  },
  /* ---------------- D07/D08/D09/D18 (docs/math-graph.md) - a matematica voltar a divergir ---------------- */
  {
    id: 'M19-d07-tabela-de-nivel-congelada',
    o_que: 'fatorDanoMonstroMotor volta a usar a fotografia (0,35 / max 5) em vez da tabela do motor - o buff/nerf do jogo nunca chega a conta',
    old: '    return Math.min(Number(ND.maxDanoMonstro) || 5, 1 + (Number(ND.danoMonstro) || 0) * d);',
    new: '    return Math.min(5, 1 + 0.35 * d);   // mutado: tabela congelada',
    esperado: 'U1d: se o motor mudar a tabela, a conta muda com ela (0,5 x 4 = x3)',
  },
  {
    id: 'M20-d08-cura-da-pocao-vezes-0,6',
    o_que: 'curaPocaoS() volta a `cura * 0,6` (1.320 hp/s em vez de 2.200) - a divergencia que o D08 fechou',
    old: '    return (c > 0 ? c : 1) / (Number.isFinite(ex) && ex > 0 ? ex : 1);',
    new: '    return (c > 0 ? c : 1) * 0.6;   // mutado: D08',
    esperado: 'U2b: cura/s = cura / EXAUSTAO (motor.js:1407-1416), e NAO cura x 0,6',
  },
  {
    id: 'M21-d09-preco-da-pocao-110',
    o_que: 'precoPocaoEmUso() volta ao literal 110 (preco da FORTE) mesmo com a Suprema na mochila (260)',
    old: '    const c = Number((pocaoInfo(k) || {}).preco);',
    new: '    const c = 110;   // mutado: D09',
    esperado: 'U3: o preco vem do catalogo do jogo (META.pocoes), nunca do literal 110',
  },
  {
    id: 'M22-d18-estimar-luta-sem-dps',
    o_que: 'estimarLuta volta a chamar avaliar SEM o DPS medido -> curaRv = 0 no veredicto do chefe',
    old: '    const av = avaliar(boss, nivel, p, { skill: curaSkill, pocao: 0 }, meuDps() || 0);',
    new: '    const av = avaliar(boss, nivel, p, { skill: curaSkill, pocao: 0 });',
    esperado: 'U5c: com rv 0,15 o roubo de vida ENTRA no veredicto (>= 60 hp/s) - era 0 antes do D18',
  },
  {
    id: 'M23-d20-pocao-como-torneira',
    o_que: 'estimarLuta volta a tratar a pocao como TAXA continua (`net - curaPocaoS()`) - o Anciao devolvia "nunca morre"',
    old: '    const tMorrer = net > 0 ? (vidaPool + pm.reserva) / net : Infinity;',
    new: '    const tMorrer = (net > 0 && net - curaPocaoS() > 0) ? vidaPool / (net - curaPocaoS()) : Infinity;   // mutado: D20',
    esperado: 'U6b: 5 Supremas somam 11.000 hp ao POOL: (2.000 + 11.000) / 3.266 ~ 4,0 s',
  },
];

/* ---------------------------------------------------------------------------------------------
 * O RUNNER. Porque isto nao pode demorar 17 minutos a dizer "falhou" (dono, 2026-10-23).
 *
 * A primeira versao corria as N mutacoes EM SERIE e so' no fim imprimia o veredicto. Medido: 1026 s
 * para falhar, e a falha era UMA ancora podre (M13) — que se sabe em 0,05 s sem correr banco
 * nenhum. Quatro correcoes, por ordem de poupanca:
 *
 *   1. PRE-VOO. A ancora de cada mutacao (`old`) tem de existir EXACTAMENTE uma vez na fonte. Se
 *      alguma nao existir, imprime as podres e SAI antes de correr o banco. Ancora podre custa 0 s.
 *   2. CACHE POR CONTEUDO. A chave e' o sha256 da fonte JA' MUTADA + o da populacao de testes. Se
 *      esse par nao mudou desde a ultima vez que a mutacao foi PEGA, o resultado vale (`cached`).
 *      Nao se cacheia SOBREVIVENTE: um buraco tem de voltar a doer em cada corrida.
 *   3. PARALELO. Cada mutacao e' um processo independente sobre o seu proprio ficheiro temporario.
 *      Corre em `--jobs N` de cada vez (por omissao nucleos-1, maximo 8).
 *   4. PARAGEM CEDO. O `run.mjs` sai mal a assercao esperada falha (`LOLIDLE_ESPERADO`), em vez de
 *      correr todas as suites so' para imprimir a mesma linha no fim.
 *
 * Uso:
 *   node tools/testes/mutantes.mjs                # tudo, paralelo, com cache
 *   node tools/testes/mutantes.mjs --refresh      # ignora a cache (corre todas)
 *   node tools/testes/mutantes.mjs --jobs 4       # menos paralelismo (maquina ocupada)
 *   node tools/testes/mutantes.mjs --fail-fast    # para no primeiro sobrevivente
 * ------------------------------------------------------------------------------------------- */

const original = fs.readFileSync(AUTOMATION_PATH, 'utf8');
const TES = path.join(RAIZ, 'tools', 'testes');
const CACHE = path.join(TES, '.mutantes-cache.json');
const arg = (n) => process.argv.slice(2).includes(n);
const refresh = arg('--refresh');
const failFast = arg('--fail-fast');
const verbose = arg('--verbose');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* Populacao de testes: tudo o que pode mudar o veredicto. `mutantes.mjs` sai de proposito — mudar
 * uma mutacao nao invalida o resultado das OUTRAS (o `new` faz parte da chave de cada uma). */
function shaPopulacao() {
  const h = crypto.createHash('sha256');
  const nomes = fs.readdirSync(TES)
    .filter((n) => !n.startsWith('.') && (n.endsWith('.mjs') || n.endsWith('.js')))
    .filter((n) => n !== 'mutantes.mjs' && n !== 'bateria.mjs' && n !== 'saude.mjs')
    .sort();
  for (const n of nomes) h.update(n + '=' + sha(fs.readFileSync(path.join(TES, n), 'utf8')) + '\n');
  return h.digest('hex');
}

console.log('Mutation testing do banco de regressao');
console.log('ALVO ' + AUTOMATION_REL + '  bytes=' + original.length);

/* ---- 1. PRE-VOO: ancora tem de existir exactamente uma vez ---- */
const podres = [];
for (const m of MUTACOES) {
  const n = original.split(m.old).length - 1;
  if (n !== 1) podres.push({ m, n });
}
if (podres.length) {
  console.log('');
  for (const { m, n } of podres) {
    console.log('ANCORA-PODRE ' + m.id + ': ' + n + ' ocorrencias do trecho (esperado 1)');
    console.log('  old: ' + JSON.stringify(m.old.slice(0, 110)));
    console.log('  a fonte mudou. Re-aponta a mutacao em tools/testes/mutantes.mjs (REGRA No 7).');
  }
  console.log('');
  console.log('MUTACOES ' + MUTACOES.length + '  ANCORAS-QUEBRADAS ' + podres.length + '  (nada foi executado)');
  console.log('rc=1');
  process.exit(1);
}

/* ---- 2. cache ---- */
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { cache = {}; }
const gravarCache = () => { try { fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1), 'utf8'); } catch { /* cache e' acessorio */ } };

const pop = shaPopulacao();
const argv = process.argv.slice(2);
const nJobs = (() => {
  const i = argv.findIndex((a) => a === '--jobs' || a.startsWith('--jobs='));
  if (i < 0) return null;
  const v = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  return Number(v) || null;
})();
const jobs = Math.max(1, nJobs || Math.min(8, Math.max(1, (os.cpus().length || 4) - 1)));

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
console.log('PARALELO ' + jobs + ' processos  populacao=' + pop.slice(0, 12) + '  cache=' + Object.keys(cache).length);
console.log('');

const resultados = [];
let pegos = 0, saltados = 0, sobreviventes = 0, parar = false;
const t0 = Date.now();

function correr(m) {
  return new Promise((resolver) => {
    const mutado = original.replace(m.old, m.new);
    const chave = sha(mutado + '|' + pop);
    const c = cache[chave];
    if (!refresh && c) { resolver({ m, estado: 'cached', nota: 'mesmo conteudo de ' + c.quando, ms: 0, chave }); return; }
    const ficheiro = path.join(TMP, m.id + '.js');
    fs.writeFileSync(ficheiro, mutado, 'utf8');
    const t = Date.now();
    const p = spawn(process.execPath, [path.join('tools', 'testes', 'run.mjs')], {
      cwd: RAIZ,
      env: Object.assign({}, process.env, { LOLIDLE_AUTOMATION: ficheiro, LOLIDLE_ESPERADO: m.esperado }),
    });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      try { fs.rmSync(ficheiro, { force: true }); } catch { /* ignore */ }
      const vermelho = code !== 0;
      const pego = out.includes('FALHOU: ' + m.esperado);
      const ok = vermelho && pego;
      const ms = Date.now() - t;
      const nota = 'rc=' + code + ' assercaoEsperadaFalhou=' + pego
        + (vermelho ? '' : ' <-- BURACO: mutacao sobreviveu em verde!');
      resolver({ m, estado: ok ? 'pego' : 'sobrevivente', nota, ms, chave, ok, cedo: out.includes('PARAGEM-CEDO') });
    });
  });
}

function anunciar(r) {
  const s = (r.ms / 1000).toFixed(1) + 's';
  if (r.estado === 'pego') { pegos++; console.log('PEGO    ' + r.m.id + '  (' + s + (r.cedo ? ', paragem cedo' : '') + ')'); }
  else if (r.estado === 'cached') { saltados++; console.log('CACHED  ' + r.m.id); }
  else { sobreviventes++; console.log('SOBREVIVEU ' + r.m.id + '  (' + s + ')  <-- BURACO NO BANCO'); }
  if (verbose) console.log('  ' + r.m.o_que);
}

async function trabalhador(fila) {
  while (fila.length && !parar) {
    const m = fila.shift();
    const r = await correr(m);
    if (r.ok) { cache[r.chave] = { quando: new Date().toISOString().slice(0, 19), id: r.m.id }; gravarCache(); }
    resultados.push(r);
    anunciar(r);
    if (r.estado === 'sobrevivente' && failFast) parar = true;
  }
}

const fila = MUTACOES.slice();
await Promise.all(Array.from({ length: Math.min(jobs, fila.length) }, () => trabalhador(fila)));
fs.rmSync(TMP, { recursive: true, force: true });

/* ---- 3. detalhe so' do que interessa ---- */
const problemas = resultados.filter((r) => r.estado === 'sobrevivente');
if (problemas.length) {
  console.log('');
  for (const r of problemas) {
    console.log('SOBREVIVENTE ' + r.m.id);
    console.log('  mutacao: ' + r.m.o_que);
    console.log('  esperado: FALHOU: ' + r.m.esperado);
    console.log('  ' + r.nota);
  }
}
const naoCorridos = MUTACOES.length - resultados.length;
if (naoCorridos) console.log('NAO CORRIDOS (paragem cedo pedida): ' + naoCorridos);

console.log('');
console.log('MUTACOES ' + MUTACOES.length + '  PEGAS ' + pegos + '  CACHED ' + saltados + '  SOBREVIVENTES ' + sobreviventes
  + (naoCorridos ? '  NAO-CORRIDOS ' + naoCorridos : '') + '  em ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
const rc = sobreviventes === 0 ? 0 : 1;
console.log('rc=' + rc);
process.exit(rc);
