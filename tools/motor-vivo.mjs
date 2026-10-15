#!/usr/bin/env bun
/*
 * tools/motor-vivo.mjs — O MOTOR DO JOGO, LIDO (nunca copiado). REGRA N.o 3 do AGENTS.md.
 *
 * Um único sítio onde docs/game-src/motor.js é lido como TEXTO e avaliado, para que
 * TODOS os simuladores (sim-chefes.mjs, sim-build.mjs, sim-timeline.mjs, backtest.mjs)
 * partilhem os MESMOS números. Antes cada ficheiro tinha a sua cópia à mão — e as cópias
 * já estavam divergidas do motor (ver tools/testes/motor-tabelas.test.mjs).
 *
 * O que daqui sai:
 *   M.CURVA / M.MONSTROS / M.NIVEL_DIF / M.HAB_CHEFE / M.RODIZIO_CHEFE / ...
 *     -> as tabelas do motor, com o `ajuste(n)` da planilha balanco.js INCLUÍDO
 *        (motor.js:281-288). A cópia à mão da sim-chefes.mjs não tinha o ajuste: um buff
 *        na CURVA passava em claro — exactamente o defeito que o AGENTS.md proíbe.
 *   M.MULT_CHEFE / M.QUEIMA_CHEFE
 *     -> os multiplicadores que o motor aplica INLINE em mecanicaChefe (motor.js:3125-3132)
 *        e que portanto não estão em nenhuma tabela exportável. Em vez de os copiar à mão,
 *        são LIDOS do texto: se o jogo os mudar, a leitura muda com ele.
 *   M.BASE_CAMPEAO
 *     -> a base REAL dos campeões, de docs/game-src/dados-*.js (motor.js:9-15 importa-os).
 *        Antes isto era "CALIBRADO NAO VERIFICADO" porque os ficheiros faltavam; agora existem.
 *
 * Uso:
 *   import { M, linhaDe, TABELAS } from './motor-vivo.mjs';
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITENS_DADOS } from '../docs/game-src/itens.js';
import { BALANCO } from '../docs/game-src/balanco.js';
import { DADOS_KATARINA } from '../docs/game-src/dados-katarina.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dir, '..');

const MOTOR = fs.readFileSync(path.join(RAIZ, 'docs', 'game-src', 'motor.js'), 'utf8');
const LINHAS = MOTOR.split('\n');

/** Linha (1-based) da primeira ocorrência de um padrão — serve para citar file:linha. */
export const linhaDe = (re) => {
  const i = LINHAS.findIndex((l) => re.test(l));
  if (i < 0) throw new Error('ancora ausente em motor.js: ' + re);
  return i + 1;
};
/** Texto entre a linha que casa 'de' e a primeira que casa 'ate' (inclusive), a partir de 'de'. */
export function trecho(de, ate) {
  const i = LINHAS.findIndex((l) => de.test(l));
  if (i < 0) throw new Error('ancora inicial ausente: ' + de);
  let j = i;
  if (ate) {
    j = -1;
    for (let k = i; k < LINHAS.length; k++) if (ate.test(LINHAS[k])) { j = k; break; }
    if (j < 0) throw new Error('ancora final ausente: ' + ate);
  }
  return LINHAS.slice(i, j + 1).join('\n');
}

// =============================================================================================
// 1) O TRECHO DO MOTOR QUE NOS INTERESSA — lido, não copiado
// =============================================================================================
const FONTE = [
  trecho(/^export const VEL_ATAQUE_MAX/),
  trecho(/^export const PONTOS_POR_NIVEL/),
  trecho(/^export const REFINO_MAX/),
  trecho(/^export const BONUS_REFINO/),
  trecho(/^export const QUALIDADES = \{/, /^\};/),
  trecho(/^export function baseId/),
  trecho(/^export const refinoDe/),
  trecho(/^const sufixoQual/),
  trecho(/^export const qualidadeDe/),
  trecho(/^export function infoItem/, /^\}/),
  trecho(/^export const POCOES = \{/, /^\};/),
  trecho(/^export const ajuste = /),
  trecho(/^export const CURVA = \{/, /^\};/),
  trecho(/^export const MONSTROS = \{/, /^\};/),
  trecho(/^export const LOCAIS = \[/, /^\];/),
  trecho(/^export const LOCAL = Object\.fromEntries/),
  trecho(/^const crescimento = /, /^\};/),
  trecho(/^const apDe = /),
  trecho(/^const serie = /),
  trecho(/^const semCusto = /),
  trecho(/^const HKT = /),
  trecho(/^const HAB_KATARINA = \{/, /^\};/),
  trecho(/^for \(const t of \['Q', 'E', 'R', 'G', 'A', 'T', 'M', 'N'\]\)/),
  trecho(/^const mitigar = /),
  trecho(/^export const RM_MONSTRO/),
  trecho(/^export const NIVEL_DIF/),
  trecho(/^export const difNivel/),
  trecho(/^export const fatorDanoMonstro/),
  trecho(/^export const fatorDanoJogador/),
  trecho(/^export const TETO_VIDA_ITEM/),
  trecho(/^export const vidaRefItem/),
  trecho(/^export const MECANICAS/),
  trecho(/^export const BARAO/),
  trecho(/^export const HAB_CHEFE = \{/, /^\};/),
  trecho(/^export const RODIZIO_CHEFE/),
].join('\n').replace(/^export /gm, '');

// os remendos que o próprio motor faz no catálogo de itens (motor.js:22-31)
const REMENDOS = [
  trecho(/^Object\.assign\(ITENS\['2022'\]/),
  trecho(/^Object\.assign\(ITENS\['1006'\]/),
  trecho(/^Object\.assign\(ITENS\['3057'\]/),
  trecho(/^Object\.assign\(ITENS\['4629'\]/),
  trecho(/^Object\.assign\(ITENS\['3108'\]/),
  trecho(/^Object\.assign\(ITENS\['3802'\]/),
].join('\n');

// HKT (DADOS_KATARINA.habilidades) só serve para o NOME de cada habilidade
export const HKT = DADOS_KATARINA.habilidades;
export const ITENS = Object.fromEntries(ITENS_DADOS.map((i) => [String(i.id), i]));

export const M = new Function('ITENS', 'DADOS_KATARINA', 'BALANCO', REMENDOS + '\n' + FONTE + [
  '; return { VEL_ATAQUE_MAX, PONTOS_POR_NIVEL, BONUS_REFINO, QUALIDADES, baseId, refinoDe, qualidadeDe, infoItem,',
  '  POCOES, ajuste, CURVA, MONSTROS, LOCAIS, LOCAL, crescimento, apDe, serie, HAB_KATARINA,',
  '  mitigar, RM_MONSTRO, NIVEL_DIF, difNivel, fatorDanoMonstro, fatorDanoJogador, TETO_VIDA_ITEM,',
  '  vidaRefItem, MECANICAS, BARAO, HAB_CHEFE, RODIZIO_CHEFE };',
].join('\n'))(ITENS, DADOS_KATARINA, BALANCO);

// =============================================================================================
// 2) O QUE O MOTOR APLICA INLINE — lido do texto de mecanicaChefe, nunca copiado
// =============================================================================================
export const LINHA_MECANICA_CHEFE = linhaDe(/^function mecanicaChefe/);
const blocoMecanica = [];
for (let i = LINHA_MECANICA_CHEFE - 1; i < LINHAS.length; i++) {
  blocoMecanica.push(LINHAS[i]);
  if (i > LINHA_MECANICA_CHEFE && /^\}$/.test(LINHAS[i])) break;
}

/** Multiplicador de dano de cada mecânica do chefe — motor.js:3125-3132 (inline, não exportado). */
export const MULT_CHEFE = {};
/** Percentual da vida máxima queimado por segundo — motor.js:3128-3131 (inline). */
export const QUEIMA_CHEFE = {};
for (const l of blocoMecanica) {
  const mMec = /tipo === '([a-z]+)'/.exec(l);
  if (!mMec) continue;
  const mMult = /(?:fis|mag)\(([0-9]*\.?[0-9]+)\)/.exec(l);
  if (mMult) MULT_CHEFE[mMec[1]] = Number(mMult[1]);
  const mQueima = /queimaDano = a\.vida \* ([0-9]*\.?[0-9]+)/.exec(l);
  if (mQueima) QUEIMA_CHEFE[mMec[1]] = Number(mQueima[1]);
}

// =============================================================================================
// 3) A BASE REAL DOS CAMPEÕES — motor.js:9-15 importa dados-*.js; motor.js:508-509 aplica.
//    NOTA: o motor usa `rm = spellblock + 3.5 * crescimento` — o `spellblockperlevel`
//    do dados-katarina.js NÃO é lido pelo motor; por isso o 3.5 vem daqui.
// =============================================================================================
const _stats = (d) => (d && d.campeao && d.campeao.stats) || {};
export const BASE_CAMPEAO = {
  katarina: {
    hp: _stats(DADOS_KATARINA).hp,
    hpperlevel: _stats(DADOS_KATARINA).hpperlevel,
    armor: _stats(DADOS_KATARINA).armor,
    armorperlevel: _stats(DADOS_KATARINA).armorperlevel,
    spellblock: _stats(DADOS_KATARINA).spellblock,
    spellblockPorNivel: 3.5,
    attackspeed: _stats(DADOS_KATARINA).attackspeed,
    attackspeedperlevel: _stats(DADOS_KATARINA).attackspeedperlevel,
    fonte: 'LIDO de docs/game-src/dados-katarina.js (motor.js:13) — versao ' + (DADOS_KATARINA.versao || '?'),
  },
};

/** O crescimento do motor por nível. */
export const CRESCIMENTO = M.crescimento;

/** Atributos base de um campeão num nível, com os pontos distribuídos — motor.js:505-557. */
export function atributosBase(campeao, nivel, pontos) {
  const b = BASE_CAMPEAO[campeao];
  if (!b) throw new Error('campeao sem base lida: ' + campeao);
  const g = M.crescimento(nivel);
  const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...(pontos || {}) };
  const magia = campeao === 'katarina';
  const adBase = 58 + 3.4 * g;                                                    // motor.js:897 (katarina)
  const ad = adBase + (magia ? 0 : 1.2 * at.forca);                              // motor.js:508 + 516
  const ap = magia ? 2 * at.forca : 0;                                           // motor.js:516
  return {
    nivel, g, ad, baseAd: ad, ap,
    vida: b.hp + b.hpperlevel * g + (magia ? 0 : 20 * at.vitalidade),             // motor.js:508 + 516
    armadura: b.armor + b.armorperlevel * g + 1.5 * at.resistencia,              // motor.js:508 + 516
    rm: b.spellblock + b.spellblockPorNivel * g + 1 * at.resistencia,            // motor.js:509 + 516
    velAtaque: Math.min(M.VEL_ATAQUE_MAX, b.attackspeed * (1 + (b.attackspeedperlevel / 100) * g + 0.008 * at.agilidade)),   // motor.js:547
    at,
  };
}

// =============================================================================================
// 4) AS TABELAS, numa só caixa — é o que os testes de divergência conferem
// =============================================================================================
export const TABELAS = {
  CURVA: { hp: M.CURVA.hp, ad: M.CURVA.ad, armadura: M.CURVA.armadura, xp: M.CURVA.xp, ouro: M.CURVA.ouro, linha: linhaDe(/^export const CURVA = \{/) },
  AJUSTE: { linha: linhaDe(/^export const ajuste = /) },
  MONSTROS: { dados: M.MONSTROS, linha: linhaDe(/^export const MONSTROS = \{/) },
  NIVEL_DIF: { dados: M.NIVEL_DIF, linha: linhaDe(/^export const NIVEL_DIF/) },
  DIF_NIVEL: { linha: linhaDe(/^export const difNivel/) },
  FATOR_DANO_MONSTRO: { linha: linhaDe(/^export const fatorDanoMonstro/) },
  FATOR_DANO_JOGADOR: { linha: linhaDe(/^export const fatorDanoJogador/) },
  HAB_CHEFE: { dados: M.HAB_CHEFE, linha: linhaDe(/^export const HAB_CHEFE = \{/) },
  RODIZIO_CHEFE: { dados: M.RODIZIO_CHEFE, linha: linhaDe(/^export const RODIZIO_CHEFE/) },
  MULT_CHEFE: { dados: MULT_CHEFE, linha: LINHA_MECANICA_CHEFE },
  QUEIMA_CHEFE: { dados: QUEIMA_CHEFE, linha: LINHA_MECANICA_CHEFE },
  POCOES: { dados: M.POCOES, linha: linhaDe(/^export const POCOES = \{/) },
  RM_MONSTRO: { valor: M.RM_MONSTRO, linha: linhaDe(/^export const RM_MONSTRO/) },
  TETO_VIDA_ITEM: { valor: M.TETO_VIDA_ITEM, linha: linhaDe(/^export const TETO_VIDA_ITEM/) },
  VEL_ATAQUE_MAX: { valor: M.VEL_ATAQUE_MAX, linha: linhaDe(/^export const VEL_ATAQUE_MAX/) },
  BONUS_REFINO: { valor: M.BONUS_REFINO, linha: linhaDe(/^export const BONUS_REFINO/) },
  QUALIDADES: { dados: M.QUALIDADES, linha: linhaDe(/^export const QUALIDADES = \{/) },
  BASE_CAMPEAO: { dados: BASE_CAMPEAO },
  HAB_KATARINA: { dados: M.HAB_KATARINA, linha: linhaDe(/^const HAB_KATARINA = \{/) },
};

// =============================================================================================
// 5) OS TEXTOS DO BALÃO — cena.js (é o que o inject.js detecta na página)
// =============================================================================================
const CENA = fs.readFileSync(path.join(RAIZ, 'docs', 'game-src', 'cena.js'), 'utf8');
const CLINHAS = CENA.split('\n');
/** Linha do `const BAL = {...}` em cena.js. */
export const LINHA_CENA_BALAO = CLINHAS.findIndex((l) => /^\s*const BAL = \{/.test(l)) + 1;
// o literal tem 2 linhas: da que abre até à que fecha. Cada par `chave: 'texto'` é LIDO,
// nunca digitado — se o jogo mudar o texto do balão, a leitura muda com ele.
const _balBloco = CLINHAS.slice(LINHA_CENA_BALAO - 1, LINHA_CENA_BALAO + 1).join('\n');
export const BALAO_CENA = Object.fromEntries(
  [..._balBloco.matchAll(/([a-z]+):\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2]])
);

export default M;
