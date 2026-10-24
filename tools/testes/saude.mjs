/*
 * saude.mjs - RATCHET DE SAUDE DO CODIGO (catraca: so' aperta).
 *
 * Origem: protocolo do Sotto (2026-10-23), §6 - "code-health-oracle.py + baseline (43 ficheiros de
 * produto, 3 mutantes + controlo positivo). Mede por ficheiro: bytes, linhas, defs, funcao mais
 * longa, except-pass. Qualquer aumento e' vermelho; reduzir e' sempre verde."
 *
 * Porque isto existe neste repo: `extension/automation.js` passou de 700 KB para ~1 MB em poucos
 * dias, sem ninguem a olhar. Um ficheiro assim nao e' um problema estetico - e' o motivo de um
 * agente nao conseguir ler a fonte inteira (Regra No 1) e de as ancoras `file:linha` apodrecerem.
 * A catraca nao obriga a extrair hoje; obriga a que CRESCER seja um acto declarado.
 *
 * Medido por ficheiro (`extension/*.js`):
 *   bytes         tamanho no disco
 *   linhas        linhas de texto
 *   defs          funcoes declaradas (`function x`, `const x = ... =>`)
 *   funcaoMaisLonga  nome + numero de linhas da maior funcao (o que ninguem revê)
 *   catchVazios   `catch { }` sem instrucoes (um silencio que esconde bug - Regra No 15)
 *
 * Regras:
 *   - qualquer metrica que AUMENTE e' vermelho (rc=1) e diz quanto e onde;
 *   - qualquer metrica que DIMINUA e' verde e a base desce sozinha (a catraca aperta);
 *   - aumentar exige `--baseline`: um acto explicito, impresso como BUDGET APROVADO com o delta.
 *
 * Limites declarados (o que este instrumento NAO ve):
 *   - e' contagem lexical, nao AST: chaves dentro de strings/regex sao removidas por um limpador
 *     conservador (comentarios e literais de uma linha), mas um literal multi-linha pode enganar
 *     a contagem de UMA funcao. A metrica e' comparativa, nao absoluta.
 *   - nao mede complexidade nem divida semantica: `defs` e `catchVazios` sao proxies.
 *
 * Uso:
 *   node tools/testes/saude.mjs              # compara com a base (rc=1 se algo cresceu)
 *   node tools/testes/saude.mjs --baseline   # aprova o estado actual como nova base
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(RAIZ, 'extension');
const BASE = path.join(import.meta.dirname, 'saude-baseline.json');

/** Remove comentarios e literais de UMA linha. Chaves dentro de strings deixam de contar. */
function limpar(linha) {
  return String(linha)
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

const RE_FN = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
const RE_ARR = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\s*\(|\([^)]*\)\s*=>)/;

function metricas(src) {
  const cruas = src.split(/\r?\n/);
  const limpas = cruas.map(limpar);
  let defs = 0;
  let maior = { nome: '-', linhas: 0 };

  for (let i = 0; i < limpas.length; i++) {
    const m = RE_FN.exec(limpas[i]) || RE_ARR.exec(limpas[i]);
    if (!m) continue;
    defs++;
    // extent por balanco de chaves; se nunca fechar, para no fim do ficheiro
    let prof = 0, aberto = false, fim = limpas.length - 1;
    for (let j = i; j < limpas.length; j++) {
      for (const ch of limpas[j]) {
        if (ch === '{') { prof++; aberto = true; } else if (ch === '}') prof--;
      }
      if (aberto && prof <= 0) { fim = j; break; }
    }
    const n = fim - i + 1;
    if (n > maior.linhas) maior = { nome: m[1], linhas: n };
    i = fim;                       // nao conta funcoes aninhadas como se fossem de topo
  }

  let catchVazios = 0;
  for (let i = 0; i < limpas.length; i++) {
    const k = limpas[i].indexOf('catch');
    if (k < 0) continue;
    const resto = limpas.slice(i).join('\n');
    const idx = resto.indexOf('{');
    if (idx < 0) continue;
    let prof = 0, corpo = '', fim = 0;
    for (let j = idx; j < resto.length; j++) {
      const ch = resto[j];
      if (ch === '{') prof++;
      else if (ch === '}') { prof--; if (prof === 0) { fim = j; break; } }
      else if (prof >= 1) corpo += ch;
    }
    if (!corpo.replace(/\s/g, '')) catchVazios++;
    i += (resto.slice(0, fim).match(/\n/g) || []).length;
  }

  return {
    bytes: Buffer.byteLength(src, 'utf8'),
    linhas: cruas.length,
    defs,
    funcaoMaisLonga: maior,
    catchVazios,
  };
}

const ficheiros = fs.readdirSync(DIR).filter((n) => n.endsWith('.js')).sort();
const actual = {};
for (const n of ficheiros) {
  actual[n] = metricas(fs.readFileSync(path.join(DIR, n), 'utf8'));
}

const aprovar = process.argv.slice(2).includes('--baseline');
let base = {};
try { base = JSON.parse(fs.readFileSync(BASE, 'utf8')); } catch { base = {}; }

const METRICAS = [
  ['bytes', 'bytes'],
  ['linhas', 'linhas'],
  ['defs', 'defs'],
  ['catchVazios', 'catch vazios'],
  ['funcaoMaisLonga', 'maior funcao (linhas)'],
];

if (aprovar) {
  const antes = base;
  fs.writeFileSync(BASE, JSON.stringify(actual, null, 2), 'utf8');
  console.log('BUDGET APROVADO - nova base escrita em tools/testes/saude-baseline.json');
  for (const n of ficheiros) {
    const a = antes[n], b = actual[n];
    if (!a) { console.log('  NOVO    ' + n + '  ' + b.bytes + ' B / ' + b.linhas + ' linhas'); continue; }
    const d = b.bytes - a.bytes;
    if (d !== 0) console.log('  ' + (d > 0 ? '+' : '') + d + ' B  ' + n + '  ' + a.bytes + ' -> ' + b.bytes);
  }
  console.log('rc=0');
  process.exit(0);
}

const vermelhos = [];
const ratchet = [];

for (const n of ficheiros) {
  const b = actual[n];
  const a = base[n];
  if (!a) {
    vermelhos.push({ n, m: 'novo ficheiro', antes: '(nao existia)', agora: b.bytes + ' B' });
    continue;
  }
  for (const [k, rotulo] of METRICAS) {
    const va = k === 'funcaoMaisLonga' ? a.funcaoMaisLonga.linhas : a[k];
    const vb = k === 'funcaoMaisLonga' ? b.funcaoMaisLonga.linhas : b[k];
    if (!(Number.isFinite(va) && Number.isFinite(vb))) continue;
    if (vb > va) vermelhos.push({ n, m: rotulo, antes: va, agora: vb });
    else if (vb < va) ratchet.push({ n, m: rotulo, antes: va, agora: vb });
  }
  // funcao mais longa mudou de dono (nome diferente): tambem conta como mudanca a rever
  if (b.funcaoMaisLonga.nome !== a.funcaoMaisLonga.nome) {
    ratchet.push({ n, m: 'maior funcao (nome)', antes: a.funcaoMaisLonga.nome, agora: b.funcaoMaisLonga.nome });
  }
}

for (const n of Object.keys(base)) {
  if (!actual[n]) ratchet.push({ n, m: 'ficheiro removido', antes: base[n].bytes + ' B', agora: '-' });
}

for (const r of ratchet) console.log('APERTOU ' + r.n + '  ' + r.m + ': ' + r.antes + ' -> ' + r.agora);
for (const v of vermelhos) console.log('CRESCEU ' + v.n + '  ' + v.m + ': ' + v.antes + ' -> ' + v.agora);

// O aperto desce a base sozinho (uma reducao nao pode voltar a crescer depois).
if (ratchet.length && !vermelhos.length) {
  const nova = {};
  for (const n of ficheiros) nova[n] = actual[n];
  for (const n of Object.keys(base)) if (!nova[n]) delete nova[n];
  fs.writeFileSync(BASE, JSON.stringify(nova, null, 2), 'utf8');
  console.log('(base apertada: ' + ratchet.length + ' metrica(s) desceram)');
}

const totalB = ficheiros.reduce((s, n) => s + actual[n].bytes, 0);
const maiorF = ficheiros.map((n) => ({ n, b: actual[n].bytes })).sort((x, y) => y.b - x.b)[0];
console.log('');
console.log('SAUDE ' + ficheiros.length + ' ficheiros  ' + (totalB / 1024).toFixed(0) + ' KB  maior=' + maiorF.n + ' (' + (maiorF.b / 1024).toFixed(0) + ' KB)');
console.log('SAUDE-VERDICT crescimento=' + vermelhos.length + ' aperto=' + ratchet.length);
if (vermelhos.length) console.log('Para aprovar um crescimento deliberado: node tools/testes/saude.mjs --baseline');
const rc = vermelhos.length ? 1 : 0;
console.log('rc=' + rc);
process.exit(rc);
