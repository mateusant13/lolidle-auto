#!/usr/bin/env node
/*
 * tools/backtest.mjs -- backtesting de builds com dado REAL (snapshot do idle).
 *
 * Le docs/snapshots/yasuo.json (exportado por outra lane), agrupa os ciclos de
 * farm por ASSINATURA DE BUILD e por REGIAO, e ranqueia ouro/xp/abates por
 * minuto com n e intervalo de confianca. Nao abre browser, nao toca no jogo:
 * so le o JSON.
 *
 * Uso:
 *   node tools/backtest.mjs                       # snapshot default, saida legivel
 *   node tools/backtest.mjs caminho.json --json   # saida JSON pura
 *   node tools/backtest.mjs --top 3 --region lobos
 *   node tools/backtest.mjs --min-n 3 --excluir-incompletos
 *
 * Honestidade: n < 3 vira amostra 'insuficiente'; combinacao build x regiao
 * sem nenhum ciclo vira 'sem-dados' (nunca um numero inventado).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const SNAP_DEFAULT = 'docs/snapshots/yasuo.json';
const N_MIN_OK = 3;   // abaixo disso: amostra insuficiente
const N_LIMITADA = 5; // entre 3 e 4: amostra limitada

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const o = { snap: null, json: false, top: 3, region: null, minN: 1, excluirIncompletos: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--excluir-incompletos') o.excluirIncompletos = true;
    else if (a === '--top') o.top = Math.max(1, Number(argv[++i]) || 3);
    else if (a.startsWith('--top=')) o.top = Math.max(1, Number(a.slice(6)) || 3);
    else if (a === '--min-n') o.minN = Math.max(1, Number(argv[++i]) || 1);
    else if (a.startsWith('--min-n=')) o.minN = Math.max(1, Number(a.slice(8)) || 1);
    else if (a === '--region') o.region = String(argv[++i] ?? '');
    else if (a.startsWith('--region=')) o.region = a.slice(9);
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
  '  -h, --help               esta ajuda',
  '',
  'Default do snapshot: ' + SNAP_DEFAULT + ' (relativo ao cwd; se nao existir,',
  'tenta relativo a raiz do repo).',
].join('\n');

// ---------------------------------------------------------------- carregar

function acharSnapshot(pedido) {
  const tentativas = [];
  if (pedido) {
    tentativas.push(resolve(process.cwd(), pedido));
    tentativas.push(resolve(RAIZ, pedido));
  } else {
    tentativas.push(resolve(process.cwd(), SNAP_DEFAULT));
    tentativas.push(resolve(RAIZ, SNAP_DEFAULT));
  }
  for (const t of tentativas) if (existsSync(t)) return t;
  throw new Error('snapshot nao encontrado. Tentei:\n  ' + [...new Set(tentativas)].join('\n  '));
}

function carregar(caminho) {
  const bruto = readFileSync(caminho, 'utf8');
  let dados = JSON.parse(bruto);
  // O export atual vem com JSON DUPLAMENTE codificado (string contendo JSON).
  // Aceitamos os dois formatos para nao quebrar quando o export for corrigido.
  let duplo = false;
  if (typeof dados === 'string') { dados = JSON.parse(dados); duplo = true; }
  if (!dados || typeof dados !== 'object') throw new Error('snapshot invalido (nao e objeto)');
  return { dados, duplo };
}

// ---------------------------------------------------------------- estatistica

const T95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042 };

function media(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function desvio(xs) {
  if (xs.length < 2) return null;
  const m = media(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
function ic95(xs) {
  if (xs.length < 2) return null;
  const m = media(xs), s = desvio(xs), df = xs.length - 1;
  const t = T95[df] ?? 1.96;
  const meia = t * s / Math.sqrt(xs.length);
  return [m - meia, m + meia];
}
function classificarAmostra(n) {
  if (n < N_MIN_OK) return 'insuficiente';
  if (n < N_LIMITADA) return 'limitada';
  return 'ok';
}

// ---------------------------------------------------------------- builds

function sigDoItem(e) {
  const id = String(e?.id ?? e?.base ?? '?');
  const ref = Number(e?.refino ?? 0) > 0 ? '#r' + e.refino : '';
  return id + ref;
}

// Aceita setup.equip (ciclos) ou build (lutas) em varios formatos.
function itensDe(bruto) {
  if (!bruto) return [];
  if (Array.isArray(bruto)) {
    return bruto.map((e) => (typeof e === 'string' ? { id: e, nome: null, qual: null, refino: 0 } : {
      id: String(e?.id ?? e?.base ?? '?'),
      base: e?.base != null ? String(e.base) : null,
      nome: e?.nome ?? null,
      qual: e?.qual ?? null,
      refino: Number(e?.refino ?? 0),
    }));
  }
  if (typeof bruto === 'object') {
    if (Array.isArray(bruto.equip)) return itensDe(bruto.equip);
    if (Array.isArray(bruto.itens)) return itensDe(bruto.itens);
    if (bruto.id != null || bruto.base != null) return itensDe([bruto]);
  }
  if (typeof bruto === 'string') {
    return bruto.split(/\s*\+\s*/).filter(Boolean).map((id) => ({ id, nome: null, qual: null, refino: 0 }));
  }
  return [];
}

function assinatura(itens) {
  if (!itens.length) return 'sem-itens';
  return itens.map(sigDoItem).slice().sort().join('+');
}

function rotuloBuild(itens) {
  if (!itens.length) return 'sem-itens';
  return itens.slice().sort((a, b) => sigDoItem(a).localeCompare(sigDoItem(b)))
    .map((e) => (e.nome ? e.nome + (e.qual ? ' ' + e.qual : '') : String(e.id))).join(' + ');
}

// ---------------------------------------------------------------- metricas

function metricas(vals, minutosTotais, total) {
  const n = vals.length;
  return {
    n,
    media: media(vals),
    ic95: ic95(vals),
    desvio: desvio(vals),
    min: n ? Math.min(...vals) : null,
    max: n ? Math.max(...vals) : null,
    agregado: minutosTotais > 0 ? total / minutosTotais : null,
    amostra: classificarAmostra(n),
  };
}

function minutoDoCiclo(c) {
  const mf = c?.mobFase ?? null;
  const durMs = Number(mf?.durMs ?? c?.durMs ?? 0);
  if (!(durMs > 0)) return null;
  const pm = mf?.perMin ?? null;
  const de = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  // usa perMin quando existe; senao deriva da contagem bruta (mesma conta, sem inventar)
  const valor = (campo, bruto) => {
    const p = de(pm?.[campo]);
    if (p != null) return p;
    const b = de(mf?.[bruto]);
    return b != null ? (b * 60000) / durMs : null;
  };
  const bruto = (campo) => de(mf?.[campo]);
  return {
    minutos: durMs / 60000,
    ouro: valor('gold', 'gold'),
    xp: valor('xp', 'xp'),
    abates: valor('kills', 'kills'),
    pocoes: valor('potions', 'potions') ?? 0,
    ouroPocao: valor('goldPotion', 'goldPotion') ?? 0,
    // totais brutos: necessarios para a taxa "agregada" (total/minuto poolado)
    ouroBruto: bruto('gold'),
    xpBruto: bruto('xp'),
    abatesBruto: bruto('kills'),
    pocoesBruto: bruto('potions'),
    ouroPocaoBruto: bruto('goldPotion'),
    regiao: c?.region ?? '(sem regiao)',
    fim: c?.fim ?? null,
    incompleto: c?.incompleto === true,
    durMs,
    itens: itensDe(c?.setup?.equip),
  };
}

// ---------------------------------------------------------------- analise

function analisar(dados, opt) {
  const ciclosBrutos = Array.isArray(dados.cycles) ? dados.cycles : [];
  const lutasBrutas = Array.isArray(dados.lutas) ? dados.lutas : [];
  const avisos = [];

  let ciclos = ciclosBrutos.map(minutoDoCiclo).filter(Boolean);
  const semDuracao = ciclosBrutos.length - ciclos.length;
  if (semDuracao > 0) avisos.push(semDuracao + ' ciclo(s) ignorado(s) por falta de duracao (mobFase.durMs).');

  if (opt.excluirIncompletos) {
    const antes = ciclos.length;
    ciclos = ciclos.filter((c) => !c.incompleto);
    if (antes !== ciclos.length) avisos.push((antes - ciclos.length) + ' ciclo(s) incompleto(s) excluido(s) por --excluir-incompletos.');
  }

  if (opt.region) {
    const alvo = opt.region.toLowerCase();
    const antes = ciclos.length;
    ciclos = ciclos.filter((c) => c.regiao.toLowerCase().includes(alvo));
    if (!ciclos.length) avisos.push('nenhum ciclo bate com --region "' + opt.region + '".');
    else if (antes !== ciclos.length) avisos.push('--region "' + opt.region + '": ' + ciclos.length + ' de ' + antes + ' ciclo(s).');
  }

  const incompletos = ciclos.filter((c) => c.incompleto).length;
  if (incompletos > 0) {
    avisos.push(incompletos + ' de ' + ciclos.length + ' ciclo(s) usados estao marcados incompleto:true (fim="' +
      (ciclos[0]?.fim ?? '?') + '"); as taxas podem estar truncadas.');
  }
  const curto = ciclos.filter((c) => c.minutos < 0.5).length;
  if (curto > 0) avisos.push(curto + ' ciclo(s) com menos de 30s de farm: taxa por minuto fica ruidosa.');

  const regioes = [...new Set(ciclos.map((c) => c.regiao))].sort();

  // ---- agrupa por assinatura de build
  const porBuild = new Map();
  for (const c of ciclos) {
    const sig = assinatura(c.itens);
    if (!porBuild.has(sig)) porBuild.set(sig, { assinatura: sig, itens: c.itens, rotulo: rotuloBuild(c.itens), ciclos: [] });
    porBuild.get(sig).ciclos.push(c);
  }

  const builds = [];
  for (const b of porBuild.values()) {
    const minutos = b.ciclos.reduce((a, c) => a + c.minutos, 0);
    const soma = (campo) => b.ciclos.reduce((a, c) => a + (c[campo] ?? 0), 0);
    const somaBruto = (campo) => b.ciclos.reduce((a, c) => a + (c[campo] ?? 0), 0);
    const col = (campo) => b.ciclos.map((c) => c[campo]).filter((v) => v != null);
    const porRegiao = {};
    for (const reg of regioes) {
      const cs = b.ciclos.filter((c) => c.regiao === reg);
      if (!cs.length) { porRegiao[reg] = { n: 0, ouroMin: null, amostra: 'sem-dados' }; continue; }
      const mm = cs.reduce((a, c) => a + c.minutos, 0);
      const ouro = cs.reduce((a, c) => a + (c.ouroBruto ?? 0), 0);
      const xs = cs.map((c) => c.ouro).filter((v) => v != null);
      porRegiao[reg] = {
        n: cs.length,
        minutos: mm,
        ouroMin: media(xs),
        ouroMinAgregado: mm > 0 ? ouro / mm : null,
        ouroMinIc95: ic95(xs),
        amostra: classificarAmostra(cs.length),
      };
    }
    builds.push({
      assinatura: b.assinatura,
      rotulo: b.rotulo,
      itens: b.itens,
      n: b.ciclos.length,
      regioes: [...new Set(b.ciclos.map((c) => c.regiao))].sort(),
      minutos: minutos,
      ouroTotal: somaBruto('ouroBruto'),
      xpTotal: somaBruto('xpBruto'),
      abatesTotal: somaBruto('abatesBruto'),
      pocoesTotal: somaBruto('pocoesBruto'),
      ouroPocaoTotal: somaBruto('ouroPocaoBruto'),
      ouroMin: metricas(col('ouro'), minutos, somaBruto('ouroBruto')),
      xpMin: metricas(col('xp'), minutos, somaBruto('xpBruto')),
      abatesMin: metricas(col('abates'), minutos, somaBruto('abatesBruto')),
      pocoesMin: metricas(col('pocoes'), minutos, somaBruto('pocoesBruto')),
      ouroPocaoMin: metricas(col('ouroPocao'), minutos, somaBruto('ouroPocaoBruto')),
      porRegiao,
      incompletos: b.ciclos.filter((c) => c.incompleto).length,
    });
  }
  builds.sort((a, b) => (b.ouroMin.media ?? -1) - (a.ouroMin.media ?? -1));

  // ---- ranking por regiao
  const rankingRegioes = regioes.map((reg) => {
    const linhas = builds
      .filter((b) => b.porRegiao[reg]?.n > 0 && b.porRegiao[reg].n >= opt.minN)
      .map((b) => Object.assign({ build: b.rotulo, assinatura: b.assinatura }, b.porRegiao[reg]))
      .sort((a, b) => (b.ouroMin ?? -1) - (a.ouroMin ?? -1));
    const semDados = builds.filter((b) => !(b.porRegiao[reg]?.n > 0)).map((b) => b.rotulo);
    return { regiao: reg, n: linhas.reduce((a, l) => a + l.n, 0), builds: linhas, semDados };
  });

  const rankingGlobal = builds
    .filter((b) => b.n >= opt.minN)
    .map((b) => ({
      build: b.rotulo, assinatura: b.assinatura, n: b.n, regioes: b.regioes,
      minutos: b.minutos, ouroTotal: b.ouroTotal, xpTotal: b.xpTotal, abatesTotal: b.abatesTotal,
      ouroMin: b.ouroMin, xpMin: b.xpMin, abatesMin: b.abatesMin, pocoesMin: b.pocoesMin,
    }));

  // ---- lutas / DPS
  const porBuildLuta = new Map();
  for (const l of lutasBrutas) {
    const itens = itensDe(l?.build ?? l?.setup?.equip ?? null);
    const sig = assinatura(itens);
    if (!porBuildLuta.has(sig)) porBuildLuta.set(sig, { assinatura: sig, rotulo: rotuloBuild(itens), lutas: [] });
    porBuildLuta.get(sig).lutas.push(l);
  }
  const lutas = [...porBuildLuta.values()].map((g) => {
    const out = g.lutas.map((l) => Number(l?.outDps)).filter((v) => Number.isFinite(v));
    const inc = g.lutas.map((l) => Number(l?.inDps)).filter((v) => Number.isFinite(v));
    const dur = g.lutas.map((l) => Number(l?.durS)).filter((v) => Number.isFinite(v));
    return {
      assinatura: g.assinatura, rotulo: g.rotulo, n: g.lutas.length,
      outDps: metricas(out, 0, 0), inDps: metricas(inc, 0, 0), durS: metricas(dur, 0, 0),
      amostra: classificarAmostra(g.lutas.length),
    };
  }).sort((a, b) => (b.outDps.media ?? -1) - (a.outDps.media ?? -1));

  const dadosFaltando = [];
  if (!lutasBrutas.length) {
    dadosFaltando.push('DPS real por build: sem-dados (lutas[] vazio no snapshot) -- nenhuma conclusao de dano e possivel.');
  }
  for (const b of builds) {
    const faltam = regioes.filter((r) => !(b.porRegiao[r]?.n > 0));
    if (faltam.length) dadosFaltando.push('Build "' + b.rotulo + '": sem-dados em ' + faltam.join(', ') + '.');
  }
  const insuficientes = builds.filter((b) => b.ouroMin.amostra === 'insuficiente');
  if (insuficientes.length) {
    dadosFaltando.push(insuficientes.length + ' de ' + builds.length + ' build(s) tem n < ' + N_MIN_OK +
      ': ouro/min NAO e conclusivo (IC largo ou inexistente).');
  }
  if (builds.length === 1) dadosFaltando.push('So existe 1 assinatura de build nos ciclos: nao ha como ranquear builds alternativas.');

  return {
    meta: {
      fonte: opt.snapResolvido,
      geradoEm: new Date().toISOString(),
      conta: dados.conta ?? null,
      champ: dados.champ ?? null,
      loc: dados.loc ?? null,
      jsonDuplamenteCodificado: opt.duplo === true,
      ciclosNoArquivo: ciclosBrutos.length,
      ciclosUsados: ciclos.length,
      regioes,
      buildsDistintas: builds.length,
      lutasNoArquivo: lutasBrutas.length,
      mortesNoArquivo: Array.isArray(dados.deaths) ? dados.deaths.length : 0,
      filtros: { top: opt.top, region: opt.region, minN: opt.minN, excluirIncompletos: opt.excluirIncompletos },
      avisos,
    },
    builds,
    rankingGlobal,
    rankingRegioes,
    matriz: builds.map((b) => ({
      build: b.rotulo,
      porRegiao: Object.fromEntries(regioes.map((r) => [r, b.porRegiao[r]?.n > 0
        ? { n: b.porRegiao[r].n, ouroMin: b.porRegiao[r].ouroMin, amostra: b.porRegiao[r].amostra }
        : 'sem-dados'])),
    })),
    lutas: { disponivel: lutas.length > 0, porBuild: lutas },
    naoConcluido: dadosFaltando,
    limitacoes: [
      'Amostra minuscula (n=1 a 2 por regiao): o IC95 e o ruido dominam qualquer diferenca entre builds.',
      'Ciclos marcados incompleto:true (fim="viagem") podem ter taxa truncada.',
      'Regiao e nivel mudam junto com o farm: comparar regioes diferentes nao isola o efeito da build.',
      'lutas[] vazio => nenhuma medida de DPS real neste snapshot.',
      'perMin vem do proprio export; quando ausente o script deriva de gold/durMs (mesma formula, sem inventar).',
      'n < 3 e marcado como amostra insuficiente e build x regiao sem ciclo vira sem-dados.',
    ],
  };
}

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
