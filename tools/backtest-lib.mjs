/*
 * backtest-lib.mjs — a parte PURA do backtest (sem CLI, sem stdout).
 * Extraido de tools/backtest.mjs para o banco de testes a poder chamar analisar()
 * directamente, sem correr o programa. Regra N.o 6: o que se testa e o que corre.
 */
import { readFileSync, existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { lerSnapshot } from './ler-snapshot.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
// SNAPSHOT DEFAULT: o dado FRESCO. O default era docs/snapshots/yasuo.json (TK-02-08),
// o ficheiro velho da conta do Yasuo: vinha duplamente codificado, nao tinha lutas[] nem
// deaths[] e nao era regenerado desde o ultimo export. O activo e o da conta jogada.
// Ordem: $SNAP > --snap <caminho> > este default.
const SNAP_DEFAULT = process.env.SNAP || 'docs/snapshots/katarina.json';
const N_MIN_OK = 3;   // abaixo disso: amostra insuficiente
const N_LIMITADA = 5; // entre 3 e 4: amostra limitada

// ---------------------------------------------------------------- CLI

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
  '  --incluir-curtos         mantem no ranking os ciclos com menos de 30s (por omissao saem)',
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

function carregar(caminho, consertar) {
  // Leitura robusta: JSON simples, duplamente codificado (TK-01-29) ou com texto de stderr
  // no meio (TK-01-49). Antes o JSON.parse secco morria com "Unexpected token".
  const r = lerSnapshot(caminho);
  // TK-01-29: se o ficheiro estava no formato antigo, reescreve-o como JSON simples para o
  // PROXIMO leitor (e qualquer pessoa que faca JSON.parse directo) receber um objecto.
  // A reescrita so acontece depois de uma leitura com SUCESSO — nunca se perde dado — e o
  // original fica guardado em <ficheiro>.bak-legacy.
  let reescrito = false;
  if (r.formato !== 'simples' && consertar !== false) {
    try {
      const bak = caminho + '.bak-legacy';
      if (!existsSync(bak)) writeFileSync(bak, readFileSync(caminho));
      writeFileSync(caminho, JSON.stringify(r.dados));
      reescrito = true;
    } catch (e) { /* sem permissao de escrita: segue so com a leitura */ }
  }
  return { dados: r.dados, duplo: r.formato !== 'simples', formato: r.formato,
    avisoLeitura: r.aviso, reescrito };
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
  // TK-01-43: ciclos com menos de 30 s de farm ficavam no ranking e a taxa por minuto saia
  // ruidosa (16 dos 30 ciclos medidos eram <30 s). Agora saem do ranking POR OMISSAO e a
  // contagem aparece no topo; --incluir-curtos traz-os de volta (para quem quiser ver).
  const curtos = ciclos.filter((c) => c.minutos < 0.5);
  if (curtos.length) {
    avisos.push(curtos.length + ' ciclo(s) com menos de 30s de farm: taxa por minuto fica ruidosa');
    if (!opt.incluirCurtos) {
      ciclos = ciclos.filter((c) => c.minutos >= 0.5);
      avisos.push('  -> excluidos do ranking por omissao (use --incluir-curtos para os manter).');
    }
  }

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
  // TK-01-28: o DPS real nao estava no topo da luta — vive em luta.analise.outDps/inDps
  // (automation.js:883 monta a analise). O backtest so olhava l.outDps, dava null, e a
  // seccao inteira saida "-" mesmo com 50 lutas no ficheiro.
  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  const dpsDe = (l, campo) => {
    const a = l?.analise || {};
    return num(l?.[campo]) ?? num(a?.[campo]);
  };
  const lutas = [...porBuildLuta.values()].map((g) => {
    const out = g.lutas.map((l) => dpsDe(l, 'outDps')).filter((v) => v != null);
    const inc = g.lutas.map((l) => dpsDe(l, 'inDps')).filter((v) => v != null);
    const dur = g.lutas.map((l) => num(l?.durS) ?? num(l?.analise?.durS)).filter((v) => v != null);
    const matou = g.lutas.filter((l) => l?.morreu === false || l?.mortes === 0).length;
    const mortes = g.lutas.reduce((s, l) => s + (Number(l?.mortes) || 0), 0);
    return {
      assinatura: g.assinatura, rotulo: g.rotulo, n: g.lutas.length,
      abates: matou, mortes,
      outDps: metricas(out, 0, 0), inDps: metricas(inc, 0, 0), durS: metricas(dur, 0, 0),
      amostra: classificarAmostra(g.lutas.length),
    };
  }).sort((a, b) => (b.outDps.media ?? -1) - (a.outDps.media ?? -1));

  const dadosFaltando = [];
  // TK-01-28: deaths[] — o export nao mandava as mortes (docs/snapshots/deaths.json tinha 6 B)
  // e o backtest nao as procurava. Agora le de dados.deaths e conta tambem as mortes por ciclo.
  const deathsBrutas = Array.isArray(dados.deaths) ? dados.deaths : [];
  const mortesPorCiclo = (Array.isArray(dados.cycles) ? dados.cycles : []).reduce((s, c) => s + (Number(c?.deaths) || 0), 0);
  if (!lutasBrutas.length) {
    dadosFaltando.push('DPS real por build: sem-dados (lutas[] vazio no snapshot) -- nenhuma conclusao de dano e possivel.');
  }
  if (!deathsBrutas.length && !mortesPorCiclo) {
    dadosFaltando.push('deaths[] vazio neste snapshot: nenhuma morte registada (nao ha nada para treinar a fuga).');
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


export { analisar, carregar, metricas, classificarAmostra, assinatura, rotuloBuild, itensDe, N_MIN_OK, N_LIMITADA, SNAP_DEFAULT };
