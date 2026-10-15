/*
 * motor-fonte.mjs - le DOCS/GAME-SRC/MOTOR.JS como TEXTO e extrai as tabelas que o
 * banco precisa (Regra N.o 3: numero LIDO, nunca copiado a mao).
 *
 * Se o jogo buffar/nerfar amanha, as suites que usam isto passam a falhar SOZINHAS -
 * que e exactamente o que se quer: o banco tem de saber que o motor mudou ANTES de a
 * extensao mentir ao dono.
 *
 * NAO executa o motor (motor.js importa dados-*.js que nao existem em docs/game-src):
 * le o TEXTO e avalia so os literais de topo.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, '..', '..');
const MOTOR = path.join(RAIZ, 'docs', 'game-src', 'motor.js');

let _cache = null;
function textoMotor() {
  if (!_cache) {
    if (!fs.existsSync(MOTOR)) throw new Error('motor.js nao encontrado em ' + MOTOR);
    _cache = fs.readFileSync(MOTOR, 'utf8');
  }
  return _cache;
}
export function linhas() { return textoMotor().split('\n'); }
export function linha(n) { return linhas()[n - 1]; }

/** Tira comentarios de linha (motor.js:1199 tem o valor novo e o antigo no MESMO
 *  comentario; um comentario no meio do literal quebraria o parser). */
function semComentarios(txt) {
  return txt.split('\n').map((l) => { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; }).join('\n');
}

/** Fim de uma declaracao `export const NOME = <literal>`.
 *  Conta chaves E parenteses rectos, ignorando strings e comentarios: o motor tem
 *  objectos (MONSTROS), arrays de objectos (LOCAIS) e arrays simples. */
function blocoLiteral(nome) {
  const L = linhas();
  const re = new RegExp('export\\s+const\\s+' + nome + '\\s*=');
  const i = L.findIndex((l) => re.test(l));
  if (i < 0) throw new Error('motor.js: declaracao nao encontrada: ' + nome);
  let chaves = 0, rectos = 0, viu = false, str = null, bloco = false;
  for (let k = i; k < L.length; k++) {
    const txt = L[k];
    for (let q = 0; q < txt.length; q++) {
      const c = txt[q], n = txt[q + 1];
      if (bloco) { if (c === '*' && n === '/') { bloco = false; q++; } continue; }
      if (str) { if (c === '\\') { q++; continue; } if (c === str) str = null; continue; }
      if (c === '/' && n === '/') break;
      if (c === '/' && n === '*') { bloco = true; q++; continue; }
      if (c === '"' || c === "'" || c === '`') { str = c; continue; }
      if (c === '{') { chaves++; viu = true; }
      else if (c === '}') chaves--;
      else if (c === '[') { rectos++; viu = true; }
      else if (c === ']') rectos--;
      if (viu && chaves === 0 && rectos === 0) {
        const resto = txt.slice(q + 1).replace(/[\s;,]/g, '');
        if (!resto) return { ini: i + 1, fim: k + 1, texto: L.slice(i, k + 1).join('\n') };
      }
    }
  }
  throw new Error('motor.js: bloco sem fim: ' + nome);
}

/** Avalia um literal de topo do motor (objecto ou array). */
export function literal(nome) {
  // 1) tira os comentarios; 2) corta o "export const NOME ="; 3) corta o ";" final;
  // 4) nada depois do ultimo contentor.
  let corpo = semComentarios(blocoLiteral(nome).texto);
  const reCorte = new RegExp("^\\s*export\\s+const\\s+" + nome + "\\s*=");
  corpo = corpo.replace(reCorte, "").trim();
  if (corpo.endsWith(";")) corpo = corpo.slice(0, -1).trim();
  const ultimo = Math.max(corpo.lastIndexOf("}"), corpo.lastIndexOf("]"));
  if (ultimo >= 0 && ultimo < corpo.length - 1) corpo = corpo.slice(0, ultimo + 1);
  return Function('"use strict"; return (' + corpo + ');')();
}

/** Coeficientes da CURVA (motor.js: `hp: (n) => (A + B*n + C*n*n) * ajuste(n).vida`). */
export function curvaCoef(campo) {
  const L = linhas();
  const i = L.findIndex((l) => new RegExp('\\b' + campo + '\\s*:').test(l) && /=>/.test(l));
  if (i < 0) throw new Error('motor.js: campo da CURVA nao encontrado: ' + campo);
  // aceita as duas formas do motor: "(n) => (A + B*n + C*n*n)" e "(n) => A + B*n"
  const m = L[i].match(/=>\s*\(?\s*([\d.]+)\s*\+\s*([\d.]+)\s*\*\s*n\s*(?:\+\s*([\d.]+)\s*\*\s*n\s*\*\s*n)?/);
  if (!m) throw new Error('motor.js: coeficientes nao parserizados (' + campo + '): ' + L[i]);
  return { a: +m[1], b: +m[2], c: m[3] != null ? +m[3] : 0, fonte: i + 1 };
}

/** Valor escalar de topo (`export const X = 3;`). */
export function escalar(nome) {
  const L = linhas();
  const re = new RegExp('export\\s+const\\s+' + nome + '\\s*=\\s*([^;]+);');
  const l = L.find((x) => re.test(x));
  if (!l) throw new Error('motor.js: escalar nao encontrado: ' + nome);
  return Function('"use strict"; return (' + l.match(re)[1].trim() + ');')();
}

/** hp de um monstro pela CURVA do motor (motor.js:282-288) x o coeficiente do monstro. */
export function hpMonstro(coefHp, nivel) {
  const c = curvaCoef('hp');
  return (c.a + c.b * nivel + c.c * nivel * nivel) * coefHp;
}
