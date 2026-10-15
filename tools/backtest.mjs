#!/usr/bin/env node
/*
 * tools/backtest.mjs -- backtesting de builds com dado REAL (snapshot do idle).
 *
 * A analise (agrupar, IC95, rankings, DPS real) vive em tools/backtest-lib.mjs, para o banco
 * de testes a poder chama-la sem correr o programa. Este ficheiro e so a CLI.
 *
 * Uso:
 *   node tools/backtest.mjs                       # snapshot default (o dado fresco)
 *   node tools/backtest.mjs caminho.json --json   # saida JSON pura
 *   node tools/backtest.mjs --top 3 --region dragao
 *   node tools/backtest.mjs --min-n 3 --excluir-incompletos
 *   node tools/backtest.mjs --incluir-curtos       # mantem os ciclos com <30 s no ranking
 *
 * Snapshot default: docs/snapshots/katarina.json (era o yasuo.json velho — TK-02-08).
 * Ordem: $SNAP <caminho> --snap <caminho> $SNAP.
 *
 * Honestidade: n < 3 vira amostra 'insuficiente'; combinacao build x regiao sem nenhum ciclo
 * vira 'sem-dados' (nunca um numero inventado). Nada de browser, nada de CDP.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analisar, carregar, SNAP_DEFAULT, N_MIN_OK, N_LIMITADA,
} from './backtest-lib.mjs';

function acharSnapshot(pedido) {
  const tentativas = [];
  const alvo = pedido || process.env.SNAP || SNAP_DEFAULT;
  tentativas.push(resolve(process.cwd(), alvo));
  tentativas.push(resolve(RAIZ, alvo));
  for (const t of [...new Set(tentativas)]) if (existsSync(t)) return t;
  throw new Error('snapshot nao encontrado. Tentei:\n  ' + [...new Set(tentativas)].join('\n  '));
}

const RAIZ = resolve(new URL('.', import.meta.url).pathname, '..');

function parseArgs(argv) {
  const o = { snap: null, json: false, top: 3, region: null, minN: 1, excluirIncompletos: false, incluirCurtos: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--excluir-incompletos') o.excluirIncompletos = true;
    else if (a === '--incluir-curtos') o.incluirCurtos = true;
    else if (a === '--top') o.top = Math.max(1, Number(argv[++i]) || 3);
    else if (a.startsWith('--top=')) o.top = Math.max(1, Number(a.slice(6)) || 3);
    else if (a === '--min-n') o.minN = Math.max(1, Number(argv[++i]) || 1);
    else if (a.startsWith('--min-n=')) o.minN = Math.max(1, Number(a.slice(8)) || 1);
    else if (a === '--region') o.region = String(argv[++i] ?? '');
    else if (a.startsWith('--region=')) o.region = String(a.slice(9));
    else if (a === '--snap') o.snap = String(argv[++i] ?? '');
    else if (a.startsWith('--snap=')) o.snap = String(a.slice(6));
    else if (!a.startsWith('-') && !o.snap) o.snap = a;
  }
  return o;
}

const HELP = [
  'tools/backtest.mjs -- backtesting de builds com dado real',
  '',
  'Uso:',
  '  node tools/backtest.mjs [snapshot.json] [opcoes]',
  '',
  'Opcoes:',
  '  --json                   saida JSON pura (sem texto)',
  '  --top N                  quantas builds mostrar no ranking (default 3)',
  '  --region TEXTO           filtra regioes por substring (case-insensitive)',
  '  --min-n N                esconde do ranking builds com n < N (default 1)',
  '  --excluir-incompletos    ignora ciclos marcados incompleto:true',
  '  --incluir-curtos         mantem no ranking os ciclos com menos de 30s (por omissao saem)',
  '  -h, --help               esta ajuda',
  '',
  'Default do snapshot: ' + SNAP_DEFAULT + ' (ou $SNAP). n < ' + N_MIN_OK + ' = amostra insuficiente,',
  'entre ' + N_MIN_OK + ' e ' + (N_LIMITADA - 1) + ' = limitada.',
].join('\n');

// ---------------------------------------------------------------- saida

const n1 = (v) => (v == null || !Number.isFinite(Number(v)) ? '-' : Number(v).toFixed(1).replace('.', ','));
const pad = (s, n) => String(s).padEnd(n, ' ').slice(0, n);

function icTexto(m) {
  if (!m.ic95) return 'IC95 indisponivel (n<2)';
  return 'IC95 [' + n1(m.ic95[0]) + ' .. ' + n1(m.ic95[1]) + ']';
}

function texto(r, opt) {
  const L = [];
  const m = r.meta;
  // largura das colunas: nunca corta o rotulo da build no meio da palavra
  const rotulos = ['build'].concat(r.builds.map((b) => b.rotulo)).concat(r.lutas.porBuild.map((g) => g.rotulo));
  const W = Math.min(68, Math.max(52, ...rotulos.map((s) => String(s).length)));
  L.push('=====================================================================');
  L.push(' BACKTEST DE BUILDS -- dado real do idle (sem browser, sem jogo)');
  L.push('=====================================================================');
  L.push('fonte      : ' + m.fonte);
  L.push('conta/champ: ' + (m.conta ?? '?') + ' / ' + (m.champ ?? '?'));
  L.push('lido em    : ' + m.geradoEm);
  L.push('ciclos     : ' + m.ciclosUsados + ' usados de ' + m.ciclosNoArquivo + ' no arquivo');
  L.push('regioes    : ' + (m.regioes.length ? m.regioes.join(' | ') : '(nenhuma)'));
  L.push('builds     : ' + m.buildsDistintas + ' assinatura(s) distinta(s)');
  L.push('lutas      : ' + m.lutasNoArquivo + ' | mortes: ' + m.mortesNoArquivo);
  L.push('filtros    : top=' + opt.top + ' min-n=' + opt.minN + ' region=' + (opt.region ?? '-') +
    ' excluir-incompletos=' + (opt.excluirIncompletos ? 'sim' : 'nao'));
  if (m.jsonDuplamenteCodificado) L.push('obs        : snapshot estava com JSON duplamente codificado (lido assim mesmo).');

  if (m.avisos.length) {
    L.push('');
    L.push('--- AVISOS ----------------------------------------------------------');
    for (const a of m.avisos) L.push('  ! ' + a);
  }

  L.push('');
  L.push('--- MATRIZ BUILD x REGIAO (ouro/min) --------------------------------');
  for (const linha of r.matriz) {
    L.push('  ' + linha.build);
    for (const reg of Object.keys(linha.porRegiao)) {
      const v = linha.porRegiao[reg];
      const cel = v === 'sem-dados' ? 'sem-dados' : n1(v.ouroMin) + ' (n=' + v.n + ', ' + v.amostra + ')';
      L.push('      ' + pad(reg, 30) + ' : ' + cel);
    }
  }

  for (const rr of r.rankingRegioes) {
    L.push('');
    L.push('--- RANKING ' + rr.regiao.toUpperCase() + ' (por ouro/min) ----------');
    if (!rr.builds.length) L.push('  sem-dados');
    else {
      L.push('  #  ' + pad('build', W) + ' ouro/min   n  amostra       IC95');
      rr.builds.slice(0, opt.top).forEach((l, i) => {
        L.push('  ' + pad(i + 1, 3) + pad(l.build, W) + ' ' + n1(l.ouroMin).padStart(7) + '  ' +
          String(l.n).padStart(2) + '  ' + pad(l.amostra, 13) + ' ' +
          (l.ouroMinIc95 ? '[' + n1(l.ouroMinIc95[0]) + ' .. ' + n1(l.ouroMinIc95[1]) + ']' : 'indisponivel (n<2)'));
      });
      if (rr.builds.length > opt.top) L.push('  ... ' + (rr.builds.length - opt.top) + ' build(s) fora do top ' + opt.top + ' (use --top)');
    }
    if (rr.semDados.length) L.push('  sem-dados nesta regiao: ' + rr.semDados.join(' ; '));
  }

  L.push('');
  L.push('--- RANKING GLOBAL (todas as regioes somadas) -----------------------');
  if (!r.rankingGlobal.length) L.push('  sem-dados');
  else {
    L.push('  #  ' + pad('build', W) + ' ouro/min  xp/min  abates/min  poc/min   n  amostra');
    r.rankingGlobal.slice(0, opt.top).forEach((b, i) => {
      L.push('  ' + pad(i + 1, 3) + pad(b.build, W) + ' ' + n1(b.ouroMin.media).padStart(7) + ' ' +
        n1(b.xpMin.media).padStart(7) + ' ' + n1(b.abatesMin.media).padStart(10) + ' ' +
        n1(b.pocoesMin.media).padStart(7) + '  ' + String(b.n).padStart(2) + '  ' + b.ouroMin.amostra);
    });
    L.push('  (ouro/min = media simples das taxas por ciclo; no --json cada metrica tem');
    L.push('   media, ic95, desvio, min, max e "agregado" = total/minuto poolado)');
    L.push('');
    L.push('  detalhe por build:');
    for (const b of r.rankingGlobal.slice(0, opt.top)) {
      L.push('   * ' + b.build);
      L.push('       assinatura: ' + b.assinatura);
      L.push('       ouro/min ' + n1(b.ouroMin.media) + ' (' + icTexto(b.ouroMin) + ') | agregado ' +
        n1(b.ouroMin.agregado) + ' | desvio ' + n1(b.ouroMin.desvio) + ' | faixa ' +
        n1(b.ouroMin.min) + '..' + n1(b.ouroMin.max));
      L.push('       xp/min   ' + n1(b.xpMin.media) + ' (' + icTexto(b.xpMin) + ') | abates/min ' +
        n1(b.abatesMin.media) + ' | pocoes/min ' + n1(b.pocoesMin.media) + ' | n=' + b.n +
        ' | regioes: ' + b.regioes.join(', '));
      L.push('       bruto    ' + Math.round(b.ouroTotal) + ' ouro / ' + Math.round(b.xpTotal) + ' xp / ' +
        Math.round(b.abatesTotal) + ' abates em ' + n1(b.minutos) + ' min' +
        '  (agregado = bruto / minutos)');
    }
  }

  L.push('');
  L.push('--- LUTAS: DPS REAL POR BUILD ---------------------------------------');
  if (!r.lutas.disponivel) {
    L.push('  sem-dados -- lutas[] esta vazio no snapshot. Nenhuma conclusao de DPS.');
  } else {
    L.push('  #  ' + pad('build', W) + ' outDps   inDps   durS   n  amostra');
    r.lutas.porBuild.forEach((g, i) => {
      L.push('  ' + pad(i + 1, 3) + pad(g.rotulo, W) + ' ' + n1(g.outDps.media).padStart(7) + ' ' +
        n1(g.inDps.media).padStart(7) + ' ' + n1(g.durS.media).padStart(6) + '  ' +
        String(g.n).padStart(2) + '  ' + g.amostra);
    });
  }

  L.push('');
  L.push('--- O QUE NAO DA PARA CONCLUIR --------------------------------------');
  if (!r.naoConcluido.length) L.push('  nada pendente com os filtros atuais.');
  for (const d of r.naoConcluido) L.push('  - ' + d);

  L.push('');
  L.push('--- LIMITACOES METODOLOGICAS ----------------------------------------');
  for (const d of r.limitacoes) L.push('  - ' + d);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- main

function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) { console.log(HELP); return; }
  let caminho, dados, duplo = false;
  try {
    caminho = acharSnapshot(opt.snap);
    const c = carregar(caminho);
    dados = c.dados; duplo = c.duplo;
  } catch (e) {
    console.error('ERRO: ' + e.message);
    process.exitCode = 2;
    return;
  }
  const optFull = Object.assign({}, opt, { snapResolvido: caminho, duplo: duplo });
  const r = analisar(dados, optFull);
  if (opt.json) console.log(JSON.stringify(r, null, 2));
  else console.log(texto(r, opt));
}

main();
