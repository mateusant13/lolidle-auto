#!/usr/bin/env node
/*
 * botas-cdr-vs-pen.mjs - A PERGUNTA DO DONO, MEDIDA NO MOTOR DO JOGO.
 *
 * Pedido (2026-10-23): "prove CDR boots beat penetration boots" e a troca de item por fase
 * (mobs vs chefe), bota incluida.
 *
 * Nada aqui e' copiado: cada luta e' corrida pelo `tools/harness.mjs`, que importa o
 * `docs/game-src/motor.js` REAL e corre a luta passo a passo (REGRA No 3). Se o jogo buffar
 * ou nerfar uma bota, este script muda de resposta sozinho.
 *
 * USO
 *   node tools/botas-cdr-vs-pen.mjs                       # Katarina nv 36 vs Barao nv 36
 *   node tools/botas-cdr-vs-pen.mjs --champ=katarina --nivel=36 --nv=36
 *
 * O QUE COMPARA
 *   Epico      : 3158 (Lucidez, cdr 0.08)      vs 3020 (Feiticeiro, ap 35 + penMag 0.08)
 *   Lendario   : 3171 (Lucidez Escarlate, ap 60 + cdr 0.15) vs 3175 (Enfeiticados, ap 70 + penMag 0.15)
 *   Fases      : mob (Tropa de Cerco no nivel do chefe) e chefe (Barao Nashor).
 *
 * A REGUA E' A DO DONO: sobrevive? mata em quantos segundos? quantas pocoes e quanto ouro?
 * DPS sozinho nao decide.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const HARNESS = path.join(RAIZ, 'tools', 'harness.mjs');

const arg = (nome, omissao) => {
  const a = process.argv.slice(2).find((x) => x.startsWith('--' + nome + '='));
  return a ? a.split('=').slice(1).join('=') : omissao;
};

const CHAMP = arg('champ', 'katarina');
const NIVEL = arg('nivel', '36');
const NV = arg('nv', '36');
const BASE = (arg('base', '3115,3089,3168,3031')).split(',').map((x) => x.trim()).filter(Boolean);

/* As botas vem do CATALOGO do jogo (docs/game-src/itens.js), filtradas por `espaco: 'botas'`.
 * Nenhum id e' inventado aqui: escolhe-se a de MAIOR cdr e a de MAIOR penMag por raridade. */
const { ITENS_DADOS } = await import(pathToFileUrl(path.join(RAIZ, 'docs', 'game-src', 'itens.js')));
function pathToFileUrl(p) { return 'file:///' + p.replace(/\\/g, '/'); }

const botas = ITENS_DADOS.filter((i) => i && i.espaco === 'botas');
const porRaridade = (rar) => {
  const lista = botas.filter((b) => b.raridade === rar);
  const cdr = lista.slice().sort((a, b) => (b.cdr || 0) - (a.cdr || 0))[0];
  const pen = lista.slice().sort((a, b) => (b.penMag || 0) - (a.penMag || 0))[0];
  return { cdr, pen };
};

function lutar(itens, alvo, nv, extra) {
  const args = [HARNESS, 'lutar', '--champ=' + CHAMP, '--nivel=' + NIVEL,
    '--alvo=' + alvo, '--nv=' + nv, '--itens=' + itens.join(','), '--pocoes=vida', '--maxSeg=180'];
  if (extra) args.push(extra);
  const r = spawnSync(process.execPath, args, { cwd: RAIZ, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const matou = /RESULTADO:\s*matou em ([\d.]+)s/.exec(out);
  const morreu = /RESULTADO:\s*morreu \(morreu aos ([\d.]+)s\)/.exec(out);
  const total = /po[çc][õo]es:[^\n]*total (\d+)\s+custo (\d+)/i.exec(out);
  return {
    seg: matou ? Number(matou[1]) : (morreu ? Number(morreu[1]) : null),
    venceu: !!matou,
    pocoes: total ? Number(total[1]) : 0,
    ouroPocao: total ? Number(total[2]) : 0,
    bruto: out,
  };
}

function veredicto(a, b, rotulo) {
  // A regua do dono: (1) sobrevive/ganha? (2) em quantos segundos? (3) quantas pocoes/ouro?
  const melhor = (() => {
    if (a.venceu !== b.venceu) return a.venceu ? 'cdr' : 'pen';
    if (!a.venceu && !b.venceu) return Math.abs(a.seg - b.seg) < 0.5 ? 'empate' : (a.seg > b.seg ? 'cdr' : 'pen');
    if (Math.abs(a.seg - b.seg) < 0.5) {
      if (a.ouroPocao !== b.ouroPocao) return a.ouroPocao < b.ouroPocao ? 'cdr' : 'pen';
      return 'empate';
    }
    return a.seg < b.seg ? 'cdr' : 'pen';
  })();
  const linha = (n, x) => '  ' + n.padEnd(4) + ' ' + (x.venceu ? 'matou em ' + x.seg + 's' : 'MORREU aos ' + x.seg + 's')
    + '  pocoes ' + x.pocoes + ' (' + x.ouroPocao + ' ouro)';
  console.log(rotulo);
  console.log(linha('CDR', a));
  console.log(linha('PEN', b));
  console.log('  -> vence: ' + melhor.toUpperCase() + (melhor === 'empate' ? ' (dentro da margem de 0,5 s)' : ''));
  return melhor;
}

console.log('BOTAS: CDR vs PENETRACAO (motor do jogo, seed deterministica)');
console.log('campeao ' + CHAMP + ' nv ' + NIVEL + '  base: ' + BASE.join(',') + '\n');

const resultados = {};
for (const rar of ['epico', 'lendario']) {
  const { cdr, pen } = porRaridade(rar);
  if (!cdr || !pen || cdr.id === pen.id) { console.log('(' + rar + ': sem par cdr/pen no catalogo, saltado)'); continue; }
  const setCdr = [cdr.id].concat(BASE);
  const setPen = [pen.id].concat(BASE);
  console.log('=== ' + rar.toUpperCase() + ': CDR ' + cdr.id + ' (' + cdr.nome + ') vs PEN ' + pen.id + ' (' + pen.nome + ')');
  const mobC = lutar(setCdr, 'Tropa de Cerco', NV);
  const mobP = lutar(setPen, 'Tropa de Cerco', NV);
  const chefeC = lutar(setCdr, 'Barão Nashor', NV, '--local=barao');
  const chefeP = lutar(setPen, 'Barão Nashor', NV, '--local=barao');
  resultados[rar] = {
    mob: veredicto(mobC, mobP, ' MOB (Tropa de Cerco nv ' + NV + ')'),
    chefe: veredicto(chefeC, chefeP, ' CHEFE (Barao Nashor nv ' + NV + ')'),
  };
  console.log('');
}

console.log('RESUMO (a mesma conta que decide a troca por fase)');
for (const [rar, r] of Object.entries(resultados)) {
  console.log('  ' + rar.padEnd(9) + ' mobs: ' + r.mob + '   chefe: ' + r.chefe);
}
const algumCdr = Object.values(resultados).some((r) => r.chefe === 'cdr');
console.log('');
console.log(algumCdr
  ? 'VEREDITO: a bota de CDR ganha a de penetracao na fase de CHEFE pelo menos num tier - e a escolha'
    + ' tem de ser POR FASE e POR TIER (nao um id fixo no codigo).'
  : 'VEREDITO: com este campeao/build a bota de penetracao ganha nas duas fases - a afirmacao "CDR ganha" NAO se sustenta aqui.');
