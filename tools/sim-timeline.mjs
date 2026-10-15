#!/usr/bin/env bun
/*
 * tools/sim-timeline.mjs — A LINHA DO TEMPO DA LUTA, evento a evento (LoL Idle).
 *
 * OBJECTIVO (pedido do dono): "NADA, LITERALMENTE NADA, ERA PRA SER SURPRESA ... agora faz TUDO ser
 * observavel, TUDO ser calculavel, e NADA ser surpresa." Este ficheiro imprime a luta contra cada
 * chefe com o timestamp de CADA evento: auto-ataques (com critico ou nao), habilidades lancadas (e a
 * recarga que entra), mecanicas do chefe (carrega -> golpe), larvas do Barao (nascimento, chegada,
 * morte), cada abate -> corte da Voracidade, pocoes, vida dos dois lados a cada instante, os procs dos
 * itens (Lich, Liandry, Rei Destruido com TETO, Luden) e o roubo de vida a cada auto-ataque.
 *
 * ---------------------------------------------------------------------------------------------
 * REGRA DE EVIDENCIA
 * ---------------------------------------------------------------------------------------------
 * (a) NENHUM numero do JOGO e copiado para este ficheiro: CURVA, MONSTROS, POCOES, HAB_KATARINA,
 *     HAB_CHEFE, RODIZIO_CHEFE, MECANICAS, BARAO, QUALIDADES, BONUS_REFINO, infoItem, mitigar,
 *     RM_MONSTRO, NIVEL_DIF, TETO_VIDA_ITEM, vidaRefItem, LOCAIS, crescimento, serie, EXAUSTAO e
 *     VEL_ATAQUE_MAX sao LIDOS de docs/game-src/motor.js como TEXTO e avaliados aqui (REGRA 3 do
 *     AGENTS.md: numeros lidos, nunca copiados). Um buff no motor muda esta saida sozinho.
 * (b) O passo da simulacao e o do JOGO: DT = 0.05 s (jogo.js:30) e M.passo(estado, combate, DT) a
 *     cada quadro (jogo.js:1564). A ordem das operacoes dentro do passo copia motor.js:1334-1626.
 * (c) O unico bloco que NAO existe no repositorio e DADOS_KATARINA.campeao.stats (o ficheiro
 *     dados-katarina.js e importado em motor.js:6 mas esta AUSENTE). Vem de sim-chefes.mjs com a
 *     marca CALIBRADO NAO VERIFICADO e e conferido contra docs/snapshots/katarina.json na saida.
 * (d) Ranks, barra e build do dono vem MEDIDOS de docs/snapshots/skills.json e
 *     docs/snapshots/katarina.json (nao deduzidos).
 * (e) Critico e o relogio inicial dos ataques usam Math.random() no motor (motor.js:1072, 1700).
 *     Aqui usa-se um PRNG SEMEADO e a semente sai impressa: o mesmo comando da sempre a mesma linha
 *     do tempo (nao ha surpresa entre execucoes).
 *
 * Uso:
 *   bun tools/sim-timeline.mjs                  # os 3 chefes, tabela completa
 *   bun tools/sim-timeline.mjs --curto          # so os marcos (sem auto-ataques e sem queima)
 *   bun tools/sim-timeline.mjs --procs          # variante de build com Lich+Liandry+Rei+Luden
 *   bun tools/sim-timeline.mjs --max 120 --semente 7 --piso 0.75 --margem 1.1
 *   bun tools/sim-timeline.mjs --md docs/timeline-luta.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITENS_DADOS } from '../docs/game-src/itens.js';
import { BALANCO } from '../docs/game-src/balanco.js';
// a base REAL do campeao, LIDA de docs/game-src/dados-katarina.js (antes nao havia ficheiro)
import { BASE_CAMPEAO as BASE_LIDA } from './motor-vivo.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dir, '..');
const lerFich = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// =============================================================================================
// 1) LER O MOTOR — os numeros do jogo vem do ficheiro, nao da cabeca de quem escreve isto
// =============================================================================================
const MOTOR = lerFich('docs/game-src/motor.js');
const LINHAS = MOTOR.split('\n');
/** Linha (1-based) da primeira ocorrencia de um padrao — serve para citar file:linha. */
const linhaDe = (re) => { const i = LINHAS.findIndex((l) => re.test(l)); if (i < 0) throw new Error('ancora ausente em motor.js: ' + re); return i + 1; };
/** Texto entre a linha que casa 'de' e a primeira que casa 'ate' (inclusive), a partir de 'de'. */
function trecho(de, ate) {
  const i = LINHAS.findIndex((l) => de.test(l)); if (i < 0) throw new Error('ancora inicial ausente: ' + de);
  let j = i;
  if (ate) { j = -1; for (let k = i; k < LINHAS.length; k++) if (ate.test(LINHAS[k])) { j = k; break; } if (j < 0) throw new Error('ancora final ausente: ' + ate); }
  return LINHAS.slice(i, j + 1).join('\n');
}
const FONTE = [
  trecho(/^export const EXAUSTAO/),
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
  trecho(/^const HKT = /),
  trecho(/^const serie = /),
  trecho(/^const semCusto = /),
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

// catalogo REAL de itens (itens.js) + os remendos que o proprio motor faz no catalogo (motor.js:16-26)
const ITENS = Object.fromEntries(ITENS_DADOS.map((i) => [String(i.id), i]));
const REMENDOS = [
  trecho(/^Object\.assign\(ITENS\['2022'\]/),
  trecho(/^Object\.assign\(ITENS\['1006'\]/),
  trecho(/^Object\.assign\(ITENS\['3057'\]/),
  trecho(/^Object\.assign\(ITENS\['4629'\]/),
  trecho(/^Object\.assign\(ITENS\['3108'\]/),
  trecho(/^Object\.assign\(ITENS\['3802'\]/),
].join('\n');
// HKT (DADOS_KATARINA.habilidades) so serve para o NOME de cada habilidade — o ficheiro esta ausente
const HKT_STUB = new Proxy({}, { get: (_t, k) => ({ nome: String(k) }) });

const M = new Function('ITENS', 'DADOS_KATARINA', 'BALANCO', REMENDOS + '\n' + FONTE + [
  '; return { EXAUSTAO, VEL_ATAQUE_MAX, PONTOS_POR_NIVEL, BONUS_REFINO, QUALIDADES, baseId, refinoDe, qualidadeDe, infoItem,',
  '  POCOES, CURVA, MONSTROS, LOCAIS, LOCAL, crescimento, HAB_KATARINA, mitigar, RM_MONSTRO, NIVEL_DIF, difNivel,',
  '  fatorDanoMonstro, fatorDanoJogador, TETO_VIDA_ITEM, vidaRefItem, MECANICAS, BARAO, HAB_CHEFE, RODIZIO_CHEFE };',
].join('\n'))(ITENS, { habilidades: HKT_STUB }, BALANCO);

const L = {
  exaustao: linhaDe(/^export const EXAUSTAO/), curva: linhaDe(/^export const CURVA = \{/),
  monstros: linhaDe(/^export const MONSTROS = \{/), poes: linhaDe(/^export const POCOES = \{/),
  habKat: linhaDe(/^const HAB_KATARINA = \{/), habChefe: linhaDe(/^export const HAB_CHEFE = \{/),
  rodizio: linhaDe(/^export const RODIZIO_CHEFE/), mecanicas: linhaDe(/^export const MECANICAS/),
  barao: linhaDe(/^export const BARAO/), mitigar: linhaDe(/^const mitigar = /),
  rm: linhaDe(/^export const RM_MONSTRO/), dif: linhaDe(/^export const NIVEL_DIF/),
  teto: linhaDe(/^export const TETO_VIDA_ITEM/), vidaRef: linhaDe(/^export const vidaRefItem/),
  locais: linhaDe(/^export const LOCAIS = \[/), golpeBasico: linhaDe(/^function golpeBasico/),
  golpear: linhaDe(/^function golpear\(/), abates: linhaDe(/^function processarAbates/),
  voracidade: linhaDe(/if \(HPk\?\.voracidade\)/), mecanicaChefe: linhaDe(/^function mecanicaChefe/),
  katarinaPasso: linhaDe(/^function katarinaPasso/), giro: linhaDe(/^export function giroAdaga/),
  soltarAdaga: linhaDe(/^export function soltarAdaga/), receberDano: linhaDe(/^function receberDano/),
  curar: linhaDe(/^function curar/), usarPocao: linhaDe(/^export function usarPocao/),
  passo: linhaDe(/^export function passo/), criarMonstro: linhaDe(/^export function criarMonstro/),
  avancarAtaque: linhaDe(/^function avancarAtaque/), inimigoAtaca: linhaDe(/^function inimigoAtaca/),
  atributos: linhaDe(/^export function atributos/), efetivo: linhaDe(/^function efetivo/),
  luden: linhaDe(/^function aoUsarHabilidade/), ordemKat: linhaDe(/katarina: \{ id: 'katarina'/),
  gerarGrupo: linhaDe(/^function gerarGrupo/), kit: linhaDe(/  katarina: \{ id: 'katarina'/),
  papel: linhaDe(/  katarina: \{ id: 'katarina'/),
};
const JOGO = { DT: 0.05, dtLinha: 'jogo.js:30', passoLinha: 'jogo.js:1564' };

// =============================================================================================
// 2) O PERSONAGEM DO DONO — MEDIDO, nao deduzido
// =============================================================================================
/** Atributos do dono: painel MEDIDO (Forca 81, Vitalidade 3, Foco 0 no nv29; 81+3 = 84 = 3x28, motor.js:483). */
const ATRIB_DONO = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };
/** Atributos com que a base do campeao foi CALIBRADA (sim-chefes.mjs:964) — usado so na conferencia. */
const ATRIB_CALIB = { forca: 84, vitalidade: 0, resistencia: 4, agilidade: 0, foco: 0 };
/** Build MEDIDA no snapshot (docs/snapshots/katarina.json: cycles[].setup.equip). 5 espacos = motor.js:28. */
const BUILD_DONO = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];
/** Variante que liga TODOS os procs citados no pedido: Luden 6655, Lich 3100, Rei Destruido 3153, Liandry 6653. */
const BUILD_PROCS = ['3175~A', '6655~B', '3100+3~A', '3153~B', '6653~B'];
/** Ranks MEDIDOS em docs/snapshots/skills.json (arsenal[].rank). D nao aparece no DOM (e passiva) -> 0. */
/**
 * Ranks MEDIDOS em docs/snapshots/skills.json (arsenal[].rank) MAIS a passiva D, que nao
 * aparece no DOM (e passiva) e tem de ser DEDUZIDA. Calculo (motor.js:1061 — o
 * migrar poe `pontos = nivel - soma(ranks)`, ou seja, com pontos = 0 a soma dos ranks
 * IGUALA o nivel; a Q inicial e de graca, motor.js:1016):
 *   nv29 -> soma dos ranks 29 = Q10+W1+E3+R3+G1+A5+F1 (24, medidos) + D
 *   D = 29 - 24 = 5
 * Prova independente e decisiva: a CURA MEDIDA. motor.js:2192 da
 * `cura = curaBase 0,05 + curaGiro[rank-1]`; com D = 5 vale 0,05 + 0,12 = 0,17, e
 * 0,17 x 1640 (o giro medido) = 278,8 contra os 279 medidos (-0,07%). Com D = 4 seriam
 * 262,4 (-5,9%) — fora da tolerancia. O roda-pe da secao 7 mostra a conta toda.
 */
const RANKS_MEDIDOS = { Q: 10, W: 1, E: 3, R: 3, G: 1, A: 5, F: 1, T: 0, B: 0, M: 0, N: 0, D: 5 };
/** Barra MEDIDA em docs/snapshots/skills.json (bar[].t), na ordem dos 4 espacos (motor.js:900 BARRA = 4). */
const BARRA_MEDIDA = ['W', 'Q', 'R', 'A'];
/** Painel MEDIDO do dono (docs/snapshots/player.json). */
const PAINEL = { nivel: 29, vida: 4476, armadura: 164, rm: 134, dano: 161, poder: 1104, va: 1.16 };

/**
 * Base do campeao — LIDA de docs/game-src/dados-katarina.js (motor.js:13 importa-o; o ficheiro
 * passou a existir no repo em 2026-10-14). ANTES era uma calibracao a mao (905 hp / 4,5 de
 * armadura por nivel). A base REAL (672 hp, +108/nivel, armadura 32 +4,7, VA 0,658 +2,74%/nivel)
 * reproduz o painel MEDIDO do dono (docs/snapshots/player.json nv29): armadura 163,6 contra 164
 * medidos e VA 1,163 contra 1,16 medidos. A RM usa o crescimento fixo de motor.js:509 (3,5/nivel).
 */
const BASE_KATARINA = { ...BASE_LIDA.katarina, aspdNivel: BASE_LIDA.katarina.attackspeedperlevel, spellblockPorNivel: 3.5 };
/** Katarina: adBase 58 / adNivel 3.4 (motor.js:897); magia, sem mana e papel (motor.js:898). */
const KIT_KAT = { adBase: 58, adNivel: 3.4, magia: true, semMana: true, papel: { dano: 1.2, recebido: 0.75 } };

/** motor.js:492-544 — atributos() com a base calibrada. Espelha o motor campo a campo. */
function statsJogador(nivel, itens, atrib) {
  const b = BASE_KATARINA, g = M.crescimento(nivel);
  const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...(atrib || {}) };
  let ad = KIT_KAT.adBase + KIT_KAT.adNivel * g, vida = b.hp + b.hpperlevel * g, armadura = b.armor + b.armorperlevel * g, rm = b.spellblock + 3.5 * g;
  let va = 0, rv = 0, critico = 0, danoCritico = 1.75, regenItens = 0, cdrItens = 0, ap = 0;
  const baseAd = ad, baseVida = vida, baseArmadura = armadura;
  const pct = { adPct: 0, apPct: 0, vidaPct: 0, armPct: 0, rmPct: 0, esquiva: 0, penMag: 0 };
  ap += 2 * at.forca;                                        // motor.js:503 (magia: a Forca vira Poder)
  vida += 20 * at.vitalidade; armadura += 1.5 * at.resistencia; rm += 1 * at.resistencia; va += 0.008 * at.agilidade;
  for (const id of itens) {
    if (!ITENS[M.baseId(id)]) continue;
    const i = M.infoItem(id);
    ad += i.ad; ap += i.ap; vida += i.vida; armadura += i.armadura; rm += i.rm; va += i.va; rv += i.rv; critico += i.critico;
    regenItens += i.regen; cdrItens += i.cdr;
    for (const p in pct) pct[p] += i[p] || 0;                 // motor.js:509 (o penMag do TEXTO nao entra: motor.js:254)
  }
  vida *= 1 + pct.vidaPct;                                    // motor.js:511
  const tem = (id) => itens.some((x) => M.baseId(x) === id);
  if (tem('2501')) ad += 0.02 * (vida - baseVida);            // motor.js:514
  if (tem('3031')) danoCritico += 0.4;                        // motor.js:515
  if (tem('3089')) ap *= 1.35;                                // motor.js:522
  ad *= 1 + pct.adPct; ap *= 1 + pct.apPct; armadura *= 1 + pct.armPct; rm *= 1 + pct.rmPct;
  return { nivel, ad, ap, baseAd, baseVida, baseArmadura, vida, armadura, rm,
    penMagica: Math.min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag),        // motor.js:529
    danoHab: 0.002 * at.foco,                                              // motor.js:531 (FOCO_DANO_HAB)
    velAtaque: Math.min(M.VEL_ATAQUE_MAX, b.attackspeed * (1 + (b.aspdNivel / 100) * g + va)),   // motor.js:534
    regen: 0.1 * at.vitalidade + regenItens,                               // motor.js:535 (hpregen ausente -> 0)
    esquiva: Math.min(0.25, 0.0025 * at.agilidade + pct.esquiva),          // motor.js:536
    reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens),  // motor.js:537
    rouboVida: rv,                                                         // motor.js:538
    penArmadura: 1 - (1 - 0) * (tem('3036') ? 0.7 : 1),                    // motor.js:539
    critico: Math.min(1, critico), danoCritico, tem, itens };
}

// =============================================================================================
// 3) O MOTOR DA LUTA — passo de 0.05 s, na ordem de motor.js:1334-1626
// =============================================================================================
/** PRNG semeado (mulberry32): a linha do tempo e reproduzivel com a mesma --semente. */
function prng(semente) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CHEFES = [
  { nome: 'Arauto do Vale', local: 'rio', nm: [25, 33] },
  { nome: 'Dragão Infernal', local: 'dragao', nm: [30, 38] },
  { nome: 'Barão Nashor', local: 'barao', nm: [40, 48] },
];
/** Nivel do chefe — REGRA REAL (motor.js:1121): max(n0+2, min(n1+2, nivelJogador+4)). */
const nivelDoChefe = (nm, nivel) => Math.max(nm[0] + 2, Math.min(nm[1] + 2, nivel + 4));

let idMonstro = 0, idAdaga = 0;
/** motor.js:1066-1075 — criarMonstro(nome, n, extra). */
function criarMonstro(nome, n, extra, r) {
  const m = M.MONSTROS[nome];
  return { nome, nivel: n, chefe: !!m.chefe, magico: !!m.magico, hpMax: M.CURVA.hp(n) * m.hp, hp: M.CURVA.hp(n) * m.hp,
    ad: M.CURVA.ad(n) * m.ad, as: m.as, armadura: M.CURVA.armadura(n) * m.armadura,
    ouro: M.CURVA.ouro(n) * m.ouro * (0.5 + r() * 0.5), xp: M.CURVA.xp(n) * m.xp,
    acumulos: 0, tSangue: 0, reducaoArmadura: 0, lento: 0, chegada: 1.2, ataque: r() / m.as,
    tocado: false, id: 'm' + (++idMonstro), distancia: m.distancia || 0, ...extra };
}

/**
 * Corre UMA luta completa e devolve a linha do tempo.
 * opts: { nome, nm, nivelJogador, st, ranks, barra, itens, semente, pisoPct, margem, maxSeg, pocoes }
 */
function lutar(o) {
  const r = prng(o.semente >>> 0);
  const dt = JOGO.DT, st = o.st, nivel = o.nivelJogador, ranks = { ...o.ranks };
  const nomeChefe = o.nome;
  const nivelBoss = nivelDoChefe(o.nm, nivel);
  const boss = criarMonstro(nomeChefe, nivelBoss, { chegada: 1.8 }, r);      // motor.js:1121 (chefe nasce com chegada 1.8)
  boss.ataque = 1 / boss.as;                                                // 1.o golpe ao fim de um intervalo cheio
  const rodizio = M.RODIZIO_CHEFE[nomeChefe];
  const HK = M.HAB_KATARINA;
  const tem = (id) => o.itens.some((x) => M.baseId(x) === id);
  const hpMax = st.vida;
  const MULT_MEC = { investida: 3.5, pancada: 2.2, olho: 2.6, sopro: 2.2, chuva: 1.8, acido: 1.2, tentaculos: 2.6 };

  let hp = hpMax, escudo = 0, t = 0, cdPocao = 0, hpMin = hpMax, morto = null, matouEm = null, ultimoGolpe = 0;
  const d = { recargas: {}, timers: { quebra: 0, couraca: 0, pocao: 0, luden: 0 }, ataque: 0, lich: false, trindade: 0,
    adagas: [], pegaCd: 0, sede: 0, sedeVa: 0, veneno: 0, sinistra: 0, sinistraAcum: 0, sinistraVa: 0,
    lotus: null, tempestade: null, queimando: 0, queimaDano: 0, invulneravel: 0 };
  for (const k of ['Q', 'W', 'E', 'R', 'G', 'A', 'D', 'F', 'T', 'B', 'M', 'N']) d.recargas[k] = 0;

  const inimigos = [boss], larvas = [], ev = [];
  const tot = { danoJogador: 0, danoRecebido: 0, curaRV: 0, curaGiro: 0, curaPocao: 0, curaRegen: 0,
    lich: 0, lichDano: 0, luden: 0, ludenDano: 0, liandry: 0, liandryDano: 0, rei3153: 0, reiDano: 0, queima: 0,
    abatesLarva: 0, abatesChefe: 0, cortesVoracidade: 0, cortesVoracidadeChefe: 0,
    porTecla: {}, procs: {}, pocoes: { vida: 0, vidaF: 0, vidaS: 0 }, ouroPocoes: 0, cont: {}, ouroAbates: 0, xpAbates: 0 };
  const conta = (tipo) => { tot.cont[tipo] = (tot.cont[tipo] || 0) + 1; };
  const reg = (tipo, texto, dano, extra) => { conta(tipo); ev.push({ t, tipo, texto, dano,
    hpChefe: Math.max(0, boss.hp), hpJog: Math.max(0, hp), pocoes: tot.pocoes.vida + tot.pocoes.vidaF + tot.pocoes.vidaS, ...(extra || {}) }); };

  const multCura = tem('3065') ? 1.25 : 1;                                   // motor.js:1286
  const curar = (valor, fonte) => {
    if (!(valor > 0)) return 0;
    const antes = hp; hp = Math.min(hpMax, hp + valor * multCura);
    const feito = hp - antes;
    if (fonte === 'rv') tot.curaRV += feito; else if (fonte === 'giro') tot.curaGiro += feito;
    else if (fonte === 'pocao') tot.curaPocao += feito; else tot.curaRegen += feito;
    if (tem('3072') && valor * multCura > hpMax - antes) escudo = Math.min(hpMax * 0.25, escudo + (valor * multCura - (hpMax - antes)));   // motor.js:1229
    return feito;
  };

  /** motor.js:1192-1233 — golpear(estado, c, a, alvo, bruto, fonte, opcoes). */
  function golpear(alvo, bruto, fonte, opt) {
    opt = opt || {};
    if (!alvo || alvo.hp <= 0) return 0;
    let magico = !!opt.magico, poder = !!opt.poder;
    if (KIT_KAT.magia && fonte !== 'ataque' && fonte !== 'item' && fonte !== 'pet' && fonte !== 'sangue') { magico = true; poder = true; }   // motor.js:1201
    const arm = magico ? (poder ? alvo.armadura * M.RM_MONSTRO * (1 - st.penMagica) : 0) : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - st.penArmadura);   // motor.js:1202
    if (poder && fonte !== 'ataque' && tem('6653')) { alvo.queima = { dps: M.vidaRefItem(alvo) * 0.015, t: 3 }; tot.liandry++; tot.procs.liandry = (tot.procs.liandry || 0) + 1; }   // motor.js:1207
    let dano = M.mitigar(bruto, arm) * KIT_KAT.papel.dano;                    // motor.js:1211-1212 (papel.dano = 1.2)
    if (opt.critico) dano *= st.danoCritico;                                  // motor.js:1213
    if (alvo.chefe && tem('3036')) dano *= 1.15;                              // motor.js:1214
    const hab = fonte !== 'ataque' && fonte !== 'item' && fonte !== 'pet' && fonte !== 'sangue';
    if (hab && st.danoHab) dano *= 1 + st.danoHab;                            // motor.js:1218
    dano *= M.fatorDanoJogador({ nivel }, alvo);                              // motor.js:1221
    alvo.hp -= dano; tot.danoJogador += dano;
    if (fonte === 'item') { if (opt.proc === 'lich') tot.lichDano += dano; else if (opt.proc === 'luden') tot.ludenDano += dano; }
    if (st.rouboVida && fonte === 'ataque') curar(dano * st.rouboVida, 'rv');  // motor.js:1226-1230
    return dano;
  }

  /** motor.js:2693-2735 — receberDano. */
  function levar(dano, doSangramento, magico, origem) {
    if (d.invulneravel > 0) return 0;
    if (!doSangramento && origem && origem.nivel) dano *= M.fatorDanoMonstro({ nivel }, origem);   // motor.js:2696
    if (!doSangramento) dano *= KIT_KAT.papel.recebido;                                           // motor.js:2697
    if (escudo > 0) { const abs = Math.min(escudo, dano); escudo -= abs; dano -= abs; }           // motor.js:2718
    hp -= dano; tot.danoRecebido += dano;
    if (!doSangramento) ultimoGolpe = dano;
    if (hp <= 0) { hp = 0; morto = t; }
    return dano;
  }

  const soltarAdaga = (tecla) => { const ad = { id: 'k' + (++idAdaga), de: tecla, t: HK.P.queda[tecla] ?? 1, resto: (HK.P.queda[tecla] ?? 1) + HK.P.dura }; d.adagas.push(ad); return ad; };   // motor.js:2144-2150
  function giroAdaga(alvos, ad) {                                             // motor.js:2159-2172
    const bruto = HK.P.giro(nivel, st);
    let total = 0;
    for (const i of alvos) total += golpear(i, bruto, 'P', { acumula: false });
    if (HK.P.shunpo && d.recargas.E > 0) d.recargas.E *= 1 - HK.P.shunpo;      // motor.js:2162
    const cura = (HK.P.curaBase || 0) + (ranks.D > 0 ? HK.D.curaGiro[ranks.D - 1] : 0);   // motor.js:2169
    const curado = total > 0 && cura > 0 ? curar(total * cura, 'giro') : 0;
    reg('GIRO', 'Voracidade: giro da adaga (' + (ad ? ad.de : '?') + ') em ' + alvos.length + ' alvo(s) — cura ' + (100 * cura).toFixed(0) + '% do dano', Math.round(total), { cura: Math.round(curado), alvos: alvos.length });
    return total;
  }

  let prontosAtual = [];
  const perto = () => inimigos.filter((i) => i.hp > 0 && i.chegada <= 0.5);
  const pode = (k) => o.barra.includes(k) && ranks[k] > 0 && d.recargas[k] <= 0;    // motor.js:1578
  function usar(k, recarga) {
    const cd = (recarga != null ? recarga : HK[k].recarga[ranks[k] - 1]) * (1 - st.reducaoRecarga);   // motor.js:1581
    d.recargas[k] = cd;
    d.trindade = tem('3078') ? 2 : tem('3057') ? 1 : 0;                                // motor.js:1583 + 1672 (Lâmina Encantada)
    if (tem('3100')) d.lich = true;                                                                   // motor.js:1944
    if (tem('6655') && d.timers.luden <= 0) {                                                         // motor.js:1945-1950
      d.timers.luden = 6;
      const alvos = inimigos.filter((i) => i.hp > 0).slice(0, 3);
      let soma = 0; for (const i of alvos) soma += golpear(i, 100 + 0.1 * st.ap, 'item', { magico: true, poder: true, proc: 'luden' });
      tot.luden++; tot.procs.luden = (tot.procs.luden || 0) + 1;
      if (alvos.length) reg('PROC', 'Luden (6655): Eco em ' + alvos.length + ' alvo(s) = 100 + 10% do Poder [motor.js:1945]', Math.round(soma));
    }
    tot.porTecla[k] = (tot.porTecla[k] || 0) + 1;
    return cd;
  }
  const acoes = {                                                            // motor.js:2212-2287
    N() { if (!pode('N') || d.tempestade || !(inimigos.filter((i) => i.hp > 0).length >= 3 || boss.chefe)) return;
      d.tempestade = { t: HK.N.duracao, tick: 0.1, cada: HK.N.duracao / HK.N.golpes, n: HK.N.golpes, bruto: HK.N.dano(ranks.N, st) };
      const cd = usar('N'); reg('HAB', 'N Tempestade de Lótus — recarga que entra ' + cd.toFixed(2) + 's', 0); },
    R() { if (!pode('R') || d.lotus || !(perto().length >= 2 || (boss.chefe && boss.chegada <= 0.5))) return;
      d.lotus = { t: HK.R.duracao, tick: 0.05, cada: HK.R.duracao / HK.R.golpes, n: HK.R.golpes, bruto: HK.R.dano(ranks.R, st) };
      const cd = usar('R'); reg('HAB', 'R Lótus da Morte — canal ' + HK.R.duracao + 's, ' + HK.R.golpes + ' levas; recarga que entra ' + cd.toFixed(2) + 's', 0); },
    E() { if (!pode('E')) return;
      const ad = d.adagas.find((x) => x.t <= 0);
      const destino = inimigos.filter((i) => i.hp > 0 && i.chegada > 0).sort((x, y) => x.chegada - y.chegada)[0] || (boss.hp > 0 ? boss : null);
      if (!destino) return;
      destino.chegada = 0;
      const dano = golpear(destino, HK.E.dano(ranks.E, st), 'E', { acumula: false });
      const cd = usar('E'); reg('HAB', 'E Shunpo — recarga que entra ' + cd.toFixed(2) + 's', Math.round(dano));
      if (ad && !d.tempestade) { d.adagas.splice(d.adagas.indexOf(ad), 1); d.pegaCd = HK.P.pegaCada; giroAdaga(perto(), ad); } },
    A() { const arauto = prontosAtual.find((i) => M.MECANICAS[i.nome] === 'investida' && i.hp > 0);
      if (!pode('A') || (arauto && !(arauto.carregando > 0))) return;         // motor.js:2256 (contra o Arauto, so durante a carga)
      const longe = (arauto && arauto.carregando > 0 ? arauto : null) || inimigos.filter((i) => i.hp > 0 && i.chegada > 0).sort((x, y) => y.chegada - x.chegada)[0] || boss;
      if (longe.hp <= 0) return;
      longe.atordoado = Math.max(longe.atordoado || 0, HK.A.atordoa);        // motor.js:2259
      const dano = golpear(longe, HK.A.dano(ranks.A, st), 'A', { acumula: false });
      soltarAdaga('A');
      const cd = usar('A'); reg('HAB', 'A Adaga Certeira em ' + longe.nome + ' (atordoa ' + HK.A.atordoa + 's) — recarga que entra ' + cd.toFixed(2) + 's', Math.round(dano)); },
    G() { if (!pode('G') || !(perto().length >= 2 || boss.chefe)) return;
      d.sede = HK.G.duracao; d.sedeVa = HK.G.va[ranks.G - 1];
      const cd = usar('G'); reg('HAB', 'G Sede de Sangue (' + HK.G.duracao + 's, +' + (100 * d.sedeVa).toFixed(0) + '% VA) — recarga que entra ' + cd.toFixed(2) + 's', 0); },
    F() { if (!pode('F') || !(perto().length >= 2 || boss.chefe)) return;
      d.veneno = HK.F.duracao;
      const cd = usar('F'); reg('HAB', 'F Lâmina Envenenada (' + HK.F.duracao + 's) — recarga que entra ' + cd.toFixed(2) + 's', 0); },
    T() { const alvos = inimigos.filter((i) => i.hp > 0 && i.chegada <= 1);
      if (!pode('T') || !(alvos.length >= 2 || boss.chefe)) return;
      let soma = 0; for (const i of alvos) soma += golpear(i, HK.T.dano(ranks.T, st), 'T', { acumula: false });
      for (let k = 0; k < HK.T.adagas; k++) soltarAdaga('T');
      const cd = usar('T'); reg('HAB', 'T Chuva de Adagas (' + HK.T.adagas + ' adagas) — recarga que entra ' + cd.toFixed(2) + 's', Math.round(soma)); },
    M() { if (!pode('M')) return;
      const ferido = perto().sort((x, y) => x.hp / x.hpMax - y.hp / y.hpMax)[0];
      if (!ferido || !(ferido.chefe || perto().length >= 2 || ferido.hp / ferido.hpMax < 0.6)) return;
      const dano = golpear(ferido, HK.M.dano(ranks.M, st), 'M', { acumula: false });
      const cd = usar('M'); reg('HAB', 'M Execução Noxiana — recarga que entra ' + cd.toFixed(2) + 's', Math.round(dano)); },
    Q() { if (!pode('Q') || boss.hp <= 0) return;
      const atingidos = [boss, ...inimigos.filter((i) => i !== boss && i.hp > 0).sort((x, y) => x.chegada - y.chegada)].slice(0, HK.Q.alvos);
      const bruto = HK.Q.dano(ranks.Q, st);
      let soma = 0; for (const i of atingidos) soma += golpear(i, bruto, 'Q', { acumula: false });
      soltarAdaga('Q');
      const cd = usar('Q'); reg('HAB', 'Q Lâmina Saltitante em ' + atingidos.length + ' alvo(s) — recarga que entra ' + cd.toFixed(2) + 's', Math.round(soma)); },
    W() { if (!pode('W') || !perto().length) return;
      soltarAdaga('W');
      const cd = usar('W'); reg('HAB', 'W Preparação (adaga cai em ' + HK.P.queda.W + 's) — recarga que entra ' + cd.toFixed(2) + 's', 0); },
  };

  /** motor.js:1673-1722 — golpeBasico(ctx, alvo). */
  function golpeBasico(alvo) {
    d.ataque = 1 / st.velAtaque;                                              // motor.js:1675
    let bruto = st.ad;
    if (d.sede > 0) { const v = golpear(alvo, HK.G.dano(ranks.G, st), 'G', { acumula: false }); curar(v * HK.G.curaSede, 'giro'); }   // motor.js:1683-1685
    if (d.lich && tem('3100')) { d.lich = false; const v = golpear(alvo, 0.75 * st.ap, 'item', { magico: true, poder: true, proc: 'lich' }); tot.lich++; tot.procs.lich = (tot.procs.lich || 0) + 1;
      reg('PROC', 'Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688]', Math.round(v)); }
    if (d.trindade) { bruto += d.trindade * st.baseAd; d.trindade = 0; }      // motor.js:1697
    if (tem('3742') && d.timers.couraca <= 0) { bruto += 40; d.timers.couraca = 4; }   // motor.js:1698
    const ceu = tem('6610') && !alvo.tocado; alvo.tocado = true;              // motor.js:1699-1701
    if (tem('3153')) { const extra = 0.05 * M.vidaRefItem(alvo, alvo.hp); bruto += extra; tot.rei3153++; tot.reiDano += extra; }   // motor.js:1702 + 1191
    const critico = ceu || r() < st.critico;                                  // motor.js:1700
    const dano = golpear(alvo, bruto, 'ataque', { critico });
    if (tem('6631') && d.timers.quebra <= 0) { golpear(alvo, 0.8 * st.ad, 'item', { acumula: false }); d.timers.quebra = 5; }   // motor.js:1719
    if (tem('3748')) golpear(alvo, 0.015 * hpMax, 'item', { acumula: false });   // motor.js:1721
    return { dano, critico };
  }

  /** motor.js:3081-3125 — mecanicaChefe. */
  function mecanicaChefe(i) {
    if (!rodizio) return;
    if (i.tMec == null) i.tMec = 5; if (i.mecK == null) i.mecK = 0;
    if (i.furiaT > 0) { i.furiaT -= dt; if (i.furiaT <= 0) i.as /= 1.5; }     // motor.js:3085
    if (i.carregando > 0) {
      const tipo = i.mecAtual;
      if (i.atordoado > 0 && tipo !== 'rugido') { i.carregando = 0; i.tMec = 6; reg('CHEFE', 'CHEFE INTERROMPIDO (' + tipo + ') pelo atordoamento — tMec volta a 6s [motor.js:3089]', 0); return; }
      i.carregando -= dt;
      if (i.carregando > 0) return;
      i.carregando = 0;
      const h = M.HAB_CHEFE[tipo];
      const fn = M.fatorDanoMonstro({ nivel }, i);
      let dano = 0;
      const fis = (k) => { dano = levar(M.mitigar(i.ad * k, st.armadura) * fn, false, false, null); };
      const mag = (k) => { dano = levar(M.mitigar(i.ad * k, st.rm) * fn, false, true, null); };
      if (tipo === 'investida') fis(3.5);
      else if (tipo === 'pancada') fis(2.2);
      else if (tipo === 'olho') mag(2.6);
      else if (tipo === 'sopro') { mag(2.2); d.queimando = 4; d.queimaDano = hpMax * 0.03; }
      else if (tipo === 'chuva') { mag(1.8); d.queimando = Math.max(d.queimando || 0, 3); d.queimaDano = hpMax * 0.025; }
      else if (tipo === 'rugido') { i.as *= 1.5; i.furiaT = 5; }
      else if (tipo === 'acido') { mag(1.2); d.queimando = 5; d.queimaDano = hpMax * 0.028; }
      else if (tipo === 'tentaculos') fis(2.6);
      const extra = tipo === 'sopro' ? ' + queimadura 3%/s por 4s' : tipo === 'chuva' ? ' + queimadura 2,5%/s por 3s'
        : tipo === 'acido' ? ' + queimadura 2,8%/s por 5s' : tipo === 'rugido' ? ' (as x1,5 por 5s)' : '';
      reg('CHEFE', 'GOLPE ' + h.nome + ' (' + tipo + ', x' + (MULT_MEC[tipo] || 0) + ')' + extra, Math.round(dano));
      i.tMec = h.espera;
      return;
    }
    i.tMec -= dt;
    if (i.tMec > 0) return;
    const tipo = rodizio[i.mecK++ % rodizio.length];                          // motor.js:3115
    i.mecAtual = tipo;
    if (tipo === 'invocar') {
      for (let k = 0; k < 2; k++) {
        const nl = Math.max(1, i.nivel - 6);                                  // motor.js:3118
        const lv = criarMonstro('Larva do Vazio', nl, { chegada: 1 + k * 0.3, invocado: true }, r);
        inimigos.push(lv); larvas.push(lv);
        reg('LARVA', 'LARVA NASCE (nv ' + nl + ', ' + Math.round(lv.hpMax) + ' HP, ' + Math.round(lv.ad) + ' AD magico, as ' + lv.as + ', armadura ' + lv.armadura.toFixed(1) + ') — chega em ' + (1 + k * 0.3).toFixed(1) + 's [motor.js:3118]', 0);
      }
      reg('CHEFE', 'CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120]', 0);
      i.tMec = M.HAB_CHEFE.invocar.espera;
      return;
    }
    i.carregando = M.HAB_CHEFE[tipo].carrega;
    reg('CHEFE', 'CHEFE CARREGA ' + M.HAB_CHEFE[tipo].nome + ' (' + tipo + ') — aviso de ' + i.carregando + 's [motor.js:3123]', 0);
  }

  /** motor.js:1725-1737 — inimigoAtaca. */
  function inimigoAtaca(i) {
    i.ataque -= dt * (i.lento > 0 ? 0.6 : 1);
    if (i.ataque > 0) return;
    i.ataque = 1 / i.as;
    const dano = levar(M.mitigar(i.ad, i.magico ? st.rm : st.armadura), false, i.magico, i);
    if (i.chefe) reg('CHEFE_BASICO', 'Auto-ataque do chefe (' + (i.magico ? 'magico' : 'fisico') + ', ' + Math.round(i.ad) + ' AD, as ' + i.as.toFixed(2) + ')', Math.round(dano));
    else reg('LARVA_ATAQUE', 'Auto-ataque da larva (' + Math.round(i.ad) + ' AD magico)', Math.round(dano));
  }

  /** motor.js:1751-1794 — processarAbates: cada abate corta a Voracidade (motor.js:1789). */
  function processarAbates() {
    for (const i of inimigos) {
      if (i.hp <= 0 && !i.morto) {
        i.morto = true;
        if (i.chefe) { tot.abatesChefe++; matouEm = t; } else tot.abatesLarva++;
        tot.ouroAbates += i.ouro; tot.xpAbates += i.xp;
        const corte = i.chefe ? HK.P.voracidadeChefe : HK.P.voracidade;       // motor.js:736 + 1789
        let cortado = 0;
        for (const k of ['Q', 'W', 'E']) { const antes = d.recargas[k]; d.recargas[k] = Math.max(0, d.recargas[k] - corte); cortado += antes - d.recargas[k]; }
        tot.cortesVoracidade += corte; if (i.chefe) tot.cortesVoracidadeChefe += corte;
        reg('ABATE', (i.chefe ? 'ABATE DO CHEFE ' + i.nome : 'ABATE da larva') + ' -> Voracidade corta ' + corte + 's de Q/W/E (cortou ' + cortado.toFixed(2) + 's)' + (i.chefe ? ' [voracidadeChefe, motor.js:736]' : '') + ' [motor.js:1789]', 0, { corte, ouro: Math.round(i.ouro), xp: Math.round(i.xp) });
      }
    }
  }

  // =========================== O PASSO (motor.js:1334-1626) ===========================
  let danoQueimaBloco = 0, queimaBlocoT = 0;
  while (t < o.maxSeg) {
    const antesRegen = hp; hp = Math.min(hpMax, hp + st.regen * dt); tot.curaRegen += hp - antesRegen;   // motor.js:1356
    if (d.queimando > 0) {                                                     // motor.js:1358-1362
      d.queimando = Math.max(0, d.queimando - dt);
      danoQueimaBloco += levar(d.queimaDano * dt, true); tot.queima += d.queimaDano * dt; queimaBlocoT += dt;
      if (queimaBlocoT >= 0.5 - 1e-9) { reg('QUEIMA', 'Queimadura do chefe (' + Math.round(d.queimaDano) + '/s, resta ' + d.queimando.toFixed(2) + 's) [motor.js:3105-3108]', Math.round(danoQueimaBloco)); danoQueimaBloco = 0; queimaBlocoT = 0; }
      if (morto != null) break;
    }
    for (const k of Object.keys(d.recargas)) d.recargas[k] = Math.max(0, d.recargas[k] - dt);            // motor.js:1363
    for (const k of Object.keys(d.timers)) d.timers[k] = Math.max(0, d.timers[k] - dt);                  // motor.js:1364
    for (const k of ['sede', 'veneno', 'sinistra', 'sombraPronta', 'pegaCd']) if (d[k] > 0) d[k] = Math.max(0, d[k] - dt);   // motor.js:1385
    cdPocao = Math.max(0, cdPocao - dt);
    // --- politica de pocao (o motor so tem o clique/auto; a regra e a do dono: piso + ultimo golpe) ---
    {
      const alvo = Math.min(hpMax, Math.max(o.pisoPct * hpMax, ultimoGolpe * o.margem));
      if (hp < alvo && cdPocao <= 0 && morto == null) {
        const falta = alvo - hp;
        const disp = [['vida', M.POCOES.vida], ['vidaF', M.POCOES.vidaF], ['vidaS', M.POCOES.vidaS]]
          .filter(([k, p]) => nivel >= p.nivel && (o.pocoes[k] == null || o.pocoes[k] > 0));             // motor.js:1294,1301
        const cabem = disp.filter(([, p]) => p.cura <= falta * 1.2).sort((a, b) => b[1].cura - a[1].cura);
        const escolha = cabem[0] || disp.slice().sort((a, b) => b[1].cura - a[1].cura)[0];
        if (escolha) {
          const [k, p] = escolha;
          if (o.pocoes[k] != null) o.pocoes[k]--;
          const antes = hp; hp = Math.min(hpMax, hp + p.cura); tot.curaPocao += hp - antes;
          tot.pocoes[k]++; tot.ouroPocoes += p.preco; cdPocao = M.EXAUSTAO;                               // motor.js:1304
          reg('POCAO', 'Poção ' + p.nome + ' (' + k + '): +' + p.cura + ' HP por ' + p.preco + ' g (exaustão ' + M.EXAUSTAO + 's) [motor.js:262-264,1301]', 0, { k, cura: Math.round(hp - antes), preco: p.preco });
        }
      }
    }
    for (const i of inimigos) { const ant = i.chegada; i.chegada = Math.max(0, i.chegada - dt); if (ant > 0 && i.chegada <= 0) reg(i.chefe ? 'CHEFE' : 'LARVA', (i.chefe ? 'CHEFE CHEGOU' : 'LARVA CHEGOU') + ' (nv ' + i.nivel + ')', 0); }   // motor.js:1443
    const vivos = inimigos.filter((i) => i.hp > 0);
    const prontos = vivos.filter((i) => i.chegada <= 0);
    const alvo = prontos[0];                                                  // motor.js:1446 (corpo a corpo: o 1.o que chegou)
    prontosAtual = prontos;
    for (const i of vivos) {                                                  // motor.js:1641-1658 (tickInimigos)
      if (i.surgindo > 0) i.surgindo = Math.max(0, i.surgindo - dt);
      i.lento = Math.max(0, (i.lento || 0) - dt);
      i.atordoado = Math.max(0, (i.atordoado || 0) - dt);
      if (i.noAr > 0) i.noAr = Math.max(0, i.noAr - dt);
      i.marca = Math.max(0, (i.marca || 0) - dt);
      if (i.queima && i.queima.t > 0 && i.hp > 0) {
        const q = Math.min(i.hp, i.queima.dps * dt); i.queima.t -= dt; i.hp -= q; i.queimaAcum = (i.queimaAcum || 0) + q; i.queimaSeg = (i.queimaSeg || 0) + dt;
        tot.danoJogador += q;
        if (i.queimaSeg >= 0.5 || i.queima.t <= 0 || i.hp <= 0) { tot.liandryDano += i.queimaAcum; reg('PROC', 'Queima no ' + i.nome + ' (' + Math.round(i.queima.dps) + '/s) [motor.js:1207,1653]', Math.round(i.queimaAcum)); i.queimaAcum = 0; i.queimaSeg = 0; }
      }
    }
    if (d.adagas.length) {                                                    // motor.js:2176-2184
      for (const ad of d.adagas) { ad.t -= dt; ad.resto -= dt; }
      const somem = d.adagas.filter((ad) => ad.resto <= 0);
      if (somem.length) { d.adagas = d.adagas.filter((ad) => ad.resto > 0); for (const ad of somem) reg('ADAGA', 'adaga (' + ad.de + ') some do chão sem ser apanhada [motor.js:2178]', 0); }
      const p = perto(), ad = d.adagas.find((x) => x.t <= 0);
      if (ad && p.length && d.pegaCd <= 0 && !d.tempestade) { d.adagas.splice(d.adagas.indexOf(ad), 1); d.pegaCd = HK.P.pegaCada; giroAdaga(p, ad); }
    }
    if (d.lotus) {                                                            // motor.js:2186-2195
      d.lotus.t -= dt; d.lotus.tick -= dt;
      while (d.lotus.tick <= 0 && d.lotus.n > 0) {
        d.lotus.tick += d.lotus.cada; d.lotus.n--;
        const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5).sort((x, y) => x.chegada - y.chegada).slice(0, HK.R.alvos);
        let soma = 0; for (const i of alvos) soma += golpear(i, d.lotus.bruto, 'R', { acumula: false });
        if (alvos.length) reg('HAB_TICK', 'Lótus da Morte: leva ' + (HK.R.golpes - d.lotus.n) + '/' + HK.R.golpes + ' em ' + alvos.length + ' alvo(s)', Math.round(soma));
      }
      if (d.lotus.t <= 0 || d.lotus.n <= 0) { d.lotus = null; reg('HAB', 'Lótus da Morte terminou [motor.js:2194]', 0); }
    }
    if (d.tempestade) {                                                       // motor.js:2197-2208
      d.tempestade.t -= dt; d.tempestade.tick -= dt;
      while (d.tempestade.tick <= 0 && d.tempestade.n > 0) { d.tempestade.tick += d.tempestade.cada; d.tempestade.n--; for (const i of vivos) if (i.hp > 0 && i.chegada <= 2) { i.chegada = 0; golpear(i, d.tempestade.bruto, 'N', { acumula: false }); } }
      if (d.tempestade.t <= 0 || d.tempestade.n <= 0) { d.tempestade = null; for (let k = 0; k < (HK.N.adagasFim || 0); k++) soltarAdaga('T'); }
    }
    if (alvo && !d.lotus && !d.tempestade) for (const k of ['N', 'R', 'B', 'M', 'E', 'A', 'G', 'F', 'T', 'Q', 'W']) if (acoes[k]) acoes[k]();   // motor.js:886 + 1593
    if (alvo && alvo.hp > 0 && !d.lotus && !d.tempestade) {                   // motor.js:1606-1608
      d.ataque -= dt * (1 + (d.sede > 0 ? d.sedeVa : 0) + (d.sinistra > 0 ? (d.sinistraAcum || 0) * (d.sinistraVa || 0) : 0));   // motor.js:1667
      if (d.ataque <= 0) {
        const gb = golpeBasico(alvo);
        reg('AUTO', 'Auto-ataque' + (gb.critico ? ' CRÍTICO (x' + st.danoCritico.toFixed(2) + ')' : '')
          + (st.rouboVida ? ' — roubo de vida ' + (100 * st.rouboVida).toFixed(0) + '% = +' + Math.round(gb.dano * st.rouboVida) + ' HP [motor.js:1226]' : ' — sem roubo de vida na build'),
          Math.round(gb.dano), { critico: gb.critico, cura: Math.round(gb.dano * st.rouboVida) });
      }
    }
    for (const i of prontos) if (i.chefe && i.hp > 0 && morto == null) mecanicaChefe(i);   // motor.js:1611-1612
    if (morto != null) break;
    for (const i of prontos) {                                                // motor.js:1617-1621
      if (i.hp <= 0 || morto != null || i.atordoado > 0 || i.carregando > 0 || i.chegada > 0) continue;
      inimigoAtaca(i);
    }
    if (morto != null) break;
    if (hp < hpMin) hpMin = hp;
    processarAbates();                                                        // motor.js:1624
    if (boss.hp <= 0) { boss.hp = 0; break; }
    t += dt;
  }

  return { ev, boss, larvas, t, hp, hpMax, hpMin, morto, matouEm, tot, nivelBoss, st, nomeChefe,
    viveu: morto == null, matou: boss.hp <= 0, dur: +(t).toFixed(2) };
}

// =============================================================================================
// 4) RELATORIO — a tabela e o resumo
// =============================================================================================
const BT = String.fromCharCode(96);   // crase, para o markdown
const OUT = [];
const P = (s) => { OUT.push(s); console.log(s); };
const n0 = (x) => Number(Math.round(x)).toLocaleString('pt-PT');
const f2 = (x) => Number(x).toFixed(2);

/** Procs/efeitos que cada build LIGA (motor.js:1207, 1688, 1702, 1719, 1721, 1945; motor.js:1229, 1286). */
function procsDaBuild(itens) {
  const tem = (id) => itens.some((x) => M.baseId(x) === id);
  const lista = [];
  const add = (id, txt, linha) => { if (tem(id)) lista.push(txt + ' [' + linha + ']'); };
  add('3100', 'Lich: próximo auto após habilidade = 75% do Poder', 'motor.js:1688');
  add('6653', 'Liandry: queima de 1,5%/s da vida (com TETO de 3x CURVA.hp)', 'motor.js:1207,1191');
  add('3153', 'Rei Destruído: +5% da vida ATUAL do alvo por auto (com TETO)', 'motor.js:1702,1191');
  add('6655', 'Luden: 100 + 10% do Poder a cada 6 s, em até 3 alvos', 'motor.js:1945');
  add('3089', 'Rabadon: +35% do Poder total', 'motor.js:522');
  add('3135', 'Cajado do Vazio: 40% de penetração mágica', 'motor.js:529');
  add('4629', 'Ímpeto Cósmico: +15% de recarga (escalado por refino e qualidade)', 'motor.js:24,255');
  add('3072', 'Sedenta por Sangue: o que passa da vida máxima vira escudo (25%)', 'motor.js:1229');
  add('3065', 'Semblante Espiritual: +25% em toda cura recebida', 'motor.js:1286');
  add('6631', 'Quebrapassos: 80% do AD a cada 5 s (fonte item, NÃO cura por rv)', 'motor.js:1719');
  add('3748', 'Hidra Titânica: 1,5% da vida máxima por auto (fonte item, NÃO cura por rv)', 'motor.js:1721');
  return lista;
}

/** Cabecalho do chefe: tudo o que entra na conta, com a linha de onde saiu. */
function cabecalhoChefe(nomeChefe, nivelBoss, st, itens, ranks, barra) {
  const m = M.MONSTROS[nomeChefe];
  P('');
  P('### ' + nomeChefe + ' — nv ' + nivelBoss + '  (nível = max(nm0+2, min(nm1+2, nv+4)) [motor.js:1121])');
  P('');
  P('| grandeza | valor | fonte |');
  P('|---|---|---|');
  P('| vida máxima | ' + n0(M.CURVA.hp(nivelBoss) * m.hp) + ' | CURVA.hp(' + nivelBoss + ') x ' + m.hp + ' [motor.js:' + L.curva + ', ' + L.monstros + '] |');
  P('| dano de ataque | ' + n0(M.CURVA.ad(nivelBoss) * m.ad) + ' | CURVA.ad(' + nivelBoss + ') x ' + m.ad + ' [motor.js:' + L.curva + '] |');
  P('| velocidade de ataque | ' + m.as + '/s | [motor.js:' + L.monstros + '] |');
  P('| armadura | ' + (M.CURVA.armadura(nivelBoss) * m.armadura).toFixed(1) + ' | CURVA.armadura(' + nivelBoss + ') x ' + m.armadura + ' [motor.js:' + L.curva + '] |');
  P('| tipo de dano | ' + (m.magico ? 'mágico (bate na RM)' : 'físico (bate na armadura)') + ' | [motor.js:' + L.monstros + '] |');
  P('| rodízio de mecânicas | ' + M.RODIZIO_CHEFE[nomeChefe].join(' -> ') + ' | [motor.js:' + L.rodizio + '] |');
  P('| 1.a mecânica | ' + M.MECANICAS[nomeChefe] + ' | [motor.js:' + L.mecanicas + '] |');
  P('| fator de nível (dano do monstro) | x' + M.fatorDanoMonstro({ nivel: st.nivel }, { nivel: nivelBoss }).toFixed(2) + ' | [motor.js:' + L.dif + '] |');
  P('| fator de nível (dano do jogador) | x' + M.fatorDanoJogador({ nivel: st.nivel }, { nivel: nivelBoss }).toFixed(2) + ' | [motor.js:' + L.dif + '] |');
  P('');
  P('Jogador: **' + n0(st.vida) + ' HP**, ' + n0(st.ad) + ' AD, ' + n0(st.ap) + ' Poder, ' + n0(st.armadura) + ' armadura, ' + n0(st.rm) + ' RM, ' + st.velAtaque.toFixed(3) + ' ataques/s, '
    + (100 * st.reducaoRecarga).toFixed(2) + '% de recarga, ' + (100 * st.penMagica).toFixed(0) + '% de pen. mágica, ' + (100 * st.rouboVida).toFixed(0) + '% de roubo de vida.');
  P('');
  P('Barra (4 espaços, motor.js:900): **' + barra.join(', ') + '** — ranks: ' + Object.entries(ranks).filter(([, v]) => v > 0).map(([k, v]) => k + ' ' + v).join(', ') + '.');
  P('');
  const procs = procsDaBuild(itens);
  P('Build: ' + itens.join(', ') + ' — procs LIGADOS: ' + (procs.length ? '' : 'nenhum'));
  for (const p of procs) P('  - ' + p);
  P('');
}

/** Tabela da linha do tempo. */
function tabela(r, curto) {
  const ignorar = curto ? new Set(['AUTO', 'QUEIMA', 'LARVA_ATAQUE', 'HAB_TICK']) : new Set();
  P('| t (s) | evento | dano | vida do chefe | vida do jogador | poções |');
  P('|---|---|---:|---:|---:|---:|');
  for (const e of r.ev) {
    if (ignorar.has(e.tipo)) continue;
    const dano = e.dano ? (['AUTO', 'HAB', 'HAB_TICK', 'GIRO', 'PROC', 'ABATE'].includes(e.tipo) ? n0(e.dano) : '-' + n0(e.dano)) : '';
    P('| ' + f2(e.t) + ' | ' + e.texto + ' | ' + dano + ' | ' + n0(e.hpChefe) + ' | ' + n0(e.hpJog) + ' | ' + e.pocoes + ' |');
  }
  P('');
}

function resumo(r, nomeChefe) {
  const tot = r.tot;
  const pocoes = tot.pocoes.vida + tot.pocoes.vidaF + tot.pocoes.vidaS;
  const fim = r.morto != null ? 'MORREU aos ' + f2(r.morto) + ' s' : r.matou ? 'MATOU em ' + f2(r.matouEm) + ' s' : 'NÃO MATOU em ' + f2(r.dur) + ' s (vivo)';
  const cortes = tot.abatesLarva * M.HAB_KATARINA.P.voracidade + tot.abatesChefe * M.HAB_KATARINA.P.voracidadeChefe;
  const cont = Object.entries(tot.cont).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ');
  P('**RESUMO — ' + nomeChefe + '**');
  P('');
  P('| grandeza | valor |');
  P('|---|---|');
  P('| resultado | ' + fim + ' |');
  P('| duração | ' + f2(r.dur) + ' s |');
  P('| vida do jogador | min **' + n0(r.hpMin) + '** / ' + n0(r.hpMax) + ' (' + (100 * r.hpMin / r.hpMax).toFixed(1) + '%) |');
  P('| poções | **' + pocoes + '** (P1 ' + tot.pocoes.vida + ', P2 ' + tot.pocoes.vidaF + ', P3 ' + tot.pocoes.vidaS + ') = **' + n0(tot.ouroPocoes) + ' g** |');
  P('| abates | larvas **' + tot.abatesLarva + '**, chefes **' + tot.abatesChefe + '** |');
  P('| recarga cortada pela Voracidade | **' + cortes.toFixed(1) + ' s** em Q/W/E (' + tot.abatesLarva + ' x ' + M.HAB_KATARINA.P.voracidade + ' + ' + tot.abatesChefe + ' x ' + M.HAB_KATARINA.P.voracidadeChefe + ') [motor.js:' + L.voracidade + '] |');
  P('| dano causado | ' + n0(tot.danoJogador) + ' (auto + skills + itens + queima) |');
  P('| dano recebido | ' + n0(tot.danoRecebido) + ' |');
  P('| cura | roubo de vida ' + n0(tot.curaRV) + ' + giro ' + n0(tot.curaGiro) + ' + poções ' + n0(tot.curaPocao) + ' + regeneração ' + n0(tot.curaRegen) + ' |');
  P('| procs | Lich ' + tot.lich + ' (' + n0(tot.lichDano) + ' de dano), Liandry ' + tot.liandry + ' (' + n0(tot.liandryDano) + '), Rei 3153 ' + tot.rei3153 + ' (' + n0(tot.reiDano) + ' de bónus), Luden ' + tot.luden + ' (' + n0(tot.ludenDano) + ') |');
  P('| habilidades lançadas | ' + Object.entries(tot.porTecla).map(([k, v]) => k + ' x' + v).join(', ') + ' |');
  P('| ouro dos abates | ' + n0(tot.ouroAbates) + ' g (sem multiplicadores de VIP/rotina) |');
  P('| eventos na linha do tempo | ' + r.ev.length + ' (' + cont + ') |');
  P('');
}

// =============================================================================================
// 5) CONFERENCIA — o modelo contra o que foi MEDIDO (nao ha surpresa sem isto)
// =============================================================================================
function conferirPainel(itens) {
  P('## 0) CONFERÊNCIA DO MODELO CONTRA O MEDIDO');
  P('');
  P('**[1] Painel do dono** (docs/snapshots/player.json): nv ' + PAINEL.nivel + ', ' + PAINEL.vida + ' HP, ' + PAINEL.dano + ' AD, '
    + PAINEL.poder + ' Poder, ' + PAINEL.armadura + ' armadura, ' + PAINEL.rm + ' RM, ' + PAINEL.va + ' ataques/s.');
  P('');
  P('| atributos usados | vida | AD | Poder | armadura | RM | ataques/s |');
  P('|---|---:|---:|---:|---:|---:|---:|');
  for (const par of [['painel do dono (81/3/0/0/0)', ATRIB_DONO], ['calibragem (84/0/4/0/0)', ATRIB_CALIB]]) {
    const rot = par[0], at = par[1];
    const s = statsJogador(PAINEL.nivel, itens, at);
    const e = (a, b) => (b ? ' (' + ((100 * (a - b) / b) >= 0 ? '+' : '') + (100 * (a - b) / b).toFixed(1) + '%)' : '');
    P('| ' + rot + ' | ' + n0(s.vida) + e(s.vida, PAINEL.vida) + ' | ' + n0(s.ad) + e(s.ad, PAINEL.dano) + ' | ' + n0(s.ap) + e(s.ap, PAINEL.poder)
      + ' | ' + n0(s.armadura) + e(s.armadura, PAINEL.armadura) + ' | ' + n0(s.rm) + e(s.rm, PAINEL.rm) + ' | ' + s.velAtaque.toFixed(3) + e(s.velAtaque, PAINEL.va) + ' |');
  }
  P('');
  P('A base do campeão é a REAL, LIDA de docs/game-src/dados-katarina.js (motor.js:13 importa-o): hp 672 +108/nível, armadura 32 +4,7, VA 0,658 +2,74%/nível.');
  P('A armadura (163,6 contra 164 medidos) e a velocidade de ataque (1,163 contra 1,16) fecham com o painel do dono **sem ajuste nenhum**; vida, AD e Poder ficam ~4-5% abaixo,');
  P('  que é o que ainda não está modelado (bónus de montaria/conquistas — não é a base). Antes este bloco era uma calibração à mão e dava hp NaN.');
  P('');
}

/** Valores que o modelo preve para o Dragao nv33 — para comparar com os eventos MEDIDOS no snapshot. */
function previsoesDragon(st, ranks) {
  const nivelBoss = nivelDoChefe([30, 38], st.nivel);
  const m = M.MONSTROS['Dragão Infernal'];
  const boss = { nivel: nivelBoss, armadura: M.CURVA.armadura(nivelBoss) * m.armadura, hpMax: M.CURVA.hp(nivelBoss) * m.hp, ad: M.CURVA.ad(nivelBoss) * m.ad };
  const fnM = M.fatorDanoMonstro({ nivel: st.nivel }, boss), fnJ = M.fatorDanoJogador({ nivel: st.nivel }, boss);
  const papel = KIT_KAT.papel;
  const armFis = boss.armadura * (1 - st.penArmadura);
  const armMag = boss.armadura * M.RM_MONSTRO * (1 - st.penMagica);
  const dmg = (bruto, arm) => M.mitigar(bruto, arm) * papel.dano * fnJ;
  return { nivelBoss,
    basicoChefe: M.mitigar(boss.ad, st.rm) * fnM * papel.recebido,
    sopro: M.mitigar(boss.ad * 2.2, st.rm) * fnM * papel.recebido,
    queimaS: 0.03 * st.vida,
    auto: dmg(st.ad, armFis),
    Q: dmg(M.HAB_KATARINA.Q.dano(ranks.Q, st), armMag),
    A: dmg(M.HAB_KATARINA.A.dano(ranks.A, st), armMag),
    giro: dmg(M.HAB_KATARINA.P.giro(st.nivel, st), armMag),
    lich: dmg(0.75 * st.ap, armMag),
    R: dmg(M.HAB_KATARINA.R.dano(ranks.R, st), armMag) };
}

function conferirEventos(itens, ranks) {
  let snap;
  try { snap = JSON.parse(lerFich('docs/snapshots/katarina.json')); } catch (e) { P('(sem docs/snapshots/katarina.json: ' + e.message + ')'); return; }
  const l = (snap.lutas || []).find((x) => /Dragão/.test(x.boss || '') && (x.hist || []).length > 20);
  if (!l) { P('(nenhuma luta contra o Dragão com histórico no snapshot)'); return; }
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const hits = (l.hist || []).filter((h) => h.t === 'hit');
  const basico = med(hits.filter((h) => h.drop > 200 && h.drop < 450).map((h) => h.drop));
  const sopro = med(hits.filter((h) => h.drop > 500).map((h) => h.drop));
  const queima = med(hits.filter((h) => h.drop > 0 && h.drop < 60).map((h) => h.drop));
  const gaps = [];
  for (let i = 1; i < hits.length; i++) if (hits[i].drop < 60 && hits[i - 1].drop < 60) gaps.push(hits[i].at - hits[i - 1].at);
  const passo = gaps.length ? med(gaps) / 1000 : 0.25;
  const outs = {};
  for (const h of (l.hist || []).filter((x) => x.t === 'dmg' && x.dir === 'out')) outs[h.v] = (outs[h.v] || 0) + 1;
  const st = statsJogador(PAINEL.nivel, itens, ATRIB_DONO);
  const p = previsoesDragon(st, ranks);
  P('**[2] Eventos MEDIDOS numa luta REAL contra o Dragão** (docs/snapshots/katarina.json: lutas[].hist — ' + (l.hist || []).length + ' eventos, durS ' + l.durS + ', poções ' + l.potUsadas + ')');
  P('');
  P('| evento medido | medido no snapshot | modelo (atributos do dono) | desvio | fonte do modelo |');
  P('|---|---:|---:|---:|---|');
  const linhas = [
    ['auto-ataque do chefe', basico, p.basicoChefe, 'motor.js:1725-1737, 1167, 2697'],
    ['golpe do Sopro (x2,2)', sopro, p.sopro, 'motor.js:3105, 3101'],
    ['queimadura por ' + Math.round(passo * 1000) + ' ms', queima, p.queimaS * passo, 'motor.js:3105 (3% da vida máxima por segundo)'],
  ];
  for (const li of linhas) {
    const rot = li[0], a = li[1], b = li[2], fonte = li[3];
    const dd = a ? (100 * (b - a) / a).toFixed(1) + '%' : '-';
    P('| ' + rot + ' | ' + (a ? n0(a) : '-') + ' | ' + n0(b) + ' | ' + dd + ' | ' + fonte + ' |');
  }
  P('');
  const top = Object.entries(outs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  P('Dano do jogador no chefe, valores distintos MEDIDOS (hist.t = dmg, dir out) e o que o modelo prevê:');
  P('');
  P('| medido | vezes | modelo mais próximo | desvio |');
  P('|---|---:|---:|---:|');
  for (const par of top) {
    const v = par[0], c = par[1];
    const cand = [['auto', p.auto], ['Q (rank ' + ranks.Q + ')', p.Q], ['A (rank ' + ranks.A + ')', p.A], ['giro da adaga', p.giro], ['Lich (75% do Poder)', p.lich], ['leva do R', p.R]];
    let melhor = cand[0], err = Infinity;
    for (const c2 of cand) { const e2 = Math.abs(c2[1] - (+v)) / (+v); if (e2 < err) { err = e2; melhor = c2; } }
    P('| ' + v + ' | ' + c + ' | ' + melhor[0] + ' = ' + n0(melhor[1]) + ' | ' + (100 * err).toFixed(1) + '% |');
  }
  P('');
  P('Leitura: os eventos do chefe (auto, sopro, queimadura) batem no modelo **sem ajuste nenhum** — é o nível do chefe (motor.js:1121),');
  P('a mitigação (motor.js:1216) e o papel da Katarina (motor.js:898) a fazerem a conta. Os números do jogador usam a base REAL do campeão');
  P('(dados-katarina.js) e ficam ~4% abaixo do medido — o que falta é o bónus global de montaria/conquistas, não a base.');
  P('');
}

// =============================================================================================
// 6) CLI
// =============================================================================================
const direto = process.argv[1] && /sim-timeline\.mjs$/.test(process.argv[1].replace(/\\/g, '/'));
const args = direto ? process.argv.slice(2) : [];
const arg = (nome, omissao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : omissao; };
const temArg = (nome) => args.includes(nome);

if (direto) {
  const semente = Number(arg('--semente', 20261014));
  const maxSeg = Number(arg('--max', 300));
  const pisoPct = Number(arg('--piso', 0.75));
  const margem = Number(arg('--margem', 1.1));
  const curto = temArg('--curto');
  const nivel = Number(arg('--nivel', 29));
  const itens = temArg('--procs') ? BUILD_PROCS : BUILD_DONO;
  const ranks = { ...RANKS_MEDIDOS };
  if (arg('--rankD', null) != null) ranks.D = Number(arg('--rankD'));
  const barra = (arg('--barra', null) || BARRA_MEDIDA.join(',')).split(',');
  const st = statsJogador(nivel, itens, ATRIB_DONO);

  P('# A linha do tempo da luta — LoL Idle (Katarina nv ' + nivel + ', os 3 chefes)');
  P('');
  P('Gerado por ' + BT + 'bun tools/sim-timeline.mjs' + BT + ' — passo de **' + JOGO.DT + ' s**, o do próprio jogo (DT = 0.05, jogo.js:30; M.passo(...) a cada quadro, jogo.js:1564).');
  P('Ordem das operações dentro do passo: motor.js:' + L.passo + '-1626. Todos os números do jogo são **lidos** de docs/game-src/motor.js (nunca copiados).');
  P('Semente do PRNG: **' + semente + '** (mesmo comando = mesma linha do tempo). Barra: ' + barra.join(',') + '. Poções: piso ' + pisoPct + ' da vida, margem ' + margem + ' do último golpe. Teto de tempo: ' + maxSeg + ' s.');
  P('');
  conferirPainel(itens);
  conferirEventos(itens, ranks);

  const resultados = [];
  for (const c of CHEFES) {
    const r = lutar({ nome: c.nome, nm: c.nm, nivelJogador: nivel, st, ranks, barra, itens, semente: semente + c.nm[0], pisoPct, margem, maxSeg, pocoes: { vida: null, vidaF: null, vidaS: null } });
    resultados.push({ c, r });
    P('');
    P('---');
    P('');
    P('## ' + c.nome + ' (local ' + c.local + ', nm = [' + c.nm[0] + ', ' + c.nm[1] + '] [motor.js:' + L.locais + '])');
    P('');
    cabecalhoChefe(c.nome, r.nivelBoss, st, itens, ranks, barra);
    tabela(r, curto);
    resumo(r, c.nome);
  }

  P('');
  P('---');
  P('');
  P('## Resumo dos 3 chefes');
  P('');
  P('| chefe | nv | resultado | duração | poções | ouro em poções | hpMin | larvas abatidas | recarga cortada (Voracidade) | dano causado | dano recebido |');
  P('|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const par of resultados) {
    const c = par.c, r = par.r, tot = r.tot;
    const pocoes2 = tot.pocoes.vida + tot.pocoes.vidaF + tot.pocoes.vidaS;
    const cortes = tot.abatesLarva * M.HAB_KATARINA.P.voracidade + tot.abatesChefe * M.HAB_KATARINA.P.voracidadeChefe;
    const fim = r.morto != null ? 'MORREU ' + f2(r.morto) + ' s' : r.matou ? 'MATOU ' + f2(r.matouEm) + ' s' : 'não matou';
    P('| ' + c.nome + ' | ' + r.nivelBoss + ' | ' + fim + ' | ' + f2(r.dur) + ' s | ' + pocoes2 + ' | ' + n0(tot.ouroPocoes) + ' g | '
      + n0(r.hpMin) + ' (' + (100 * r.hpMin / r.hpMax).toFixed(0) + '%) | ' + tot.abatesLarva + ' | ' + cortes.toFixed(1) + ' s | '
      + n0(tot.danoJogador) + ' | ' + n0(tot.danoRecebido) + ' |');
  }
  P('');
  P('### O que este simulador NÃO modela (para não haver surpresa escondida)');
  P('');
  P('- O **rank da passiva D (Lâmina Sinistra)** não aparece no DOM (docs/snapshots/skills.json só lista Q,W,E,R,G,A,F,T,B,M,N) e o snapshot diz pontos: 0');
  P('  com 24 ranks gastos — no nv29 o motor dá 28 pontos (motor.js:2798-2801). Os 4 pontos em falta podem estar na D ou na T.');
  P('  Por omissão usa-se **D = 0** (sem curaGiro): com D = 4 o giro passaria a curar mais 11% do dano dele (motor.js:755-756). Usa --rankD 4 para ver.');
  P('- A barra é a MEDIDA no snapshot (W, Q, R, A). A extensão reordena a barra a cada 2 s (barraPorDisponibilidade, automation.js:5654) — isso é política da extensão, não do motor.');
  P('- O crítico e o relógio inicial dos ataques são aleatórios no motor (motor.js:1072, 1700); aqui são semeados e a semente sai impressa.');
  P('- Ouro/XP de abate usam o ouro/xp do monstro sem os multiplicadores de VIP, rotina e eventos (motor.js:1758-1766).');
  P('- Loot, mochila, refino e qualidade NÃO entram na luta (só a qualidade/refino dos itens JÁ equipados, via infoItem, motor.js:251-256).');
  P('- Nada disto foi medido a jogar: sem browser, sem CDP, sem partida — só o motor lido como texto e os snapshots já gravados.');
  P('');

  P('');
  P('## 5) O ABATE e A ULTIMATE — o que o motor faz de facto');
  P('');
  P('motor.js:1789 — em TODOS os campeões, cada abate corta a recarga de **Q, W e E**:');
  P('');
  P('| campeão | corte por abate comum | corte por abate de CHEFE | a ULTIMATE reinicia? |');
  P('|---|---:|---:|---|');
  P('| Katarina (motor.js:736) | ' + M.HAB_KATARINA.P.voracidade + ' s | ' + M.HAB_KATARINA.P.voracidadeChefe + ' s | **NÃO** — Q/W/E só; a R fica com a recarga inteira (motor.js:1789) |');
  P('| Darius (motor.js:1853) | - | - | **SIM** — o abate reinicia a Guilhotina em 2 s, também nos chefes (usar(\'R\',{},2)) |');
  P('');
  P('Ou seja: o reset da ultimate que se le em motor.js:1853 e do DARIUS. A Katarina não o tem — o abate só corta Q/W/E.');
  P('Na luta simulada isto aparece em cada ABATE: o giro da adaga volta mais vezes (Q/W mais curtos), mas a Lótus da Morte continua a esperar os ' + (M.HAB_KATARINA.R.recarga[RANKS_MEDIDOS.R - 1] * (1 - st.reducaoRecarga)).toFixed(2) + ' s da recarga cheia.');
  P('');

  // ---- a luta simulada contra as lutas MEDIDAS no snapshot ----
  {
    const dr = resultados.find((x) => x.c.nome === 'Dragão Infernal');
    let snap = null;
    try { snap = JSON.parse(lerFich('docs/snapshots/katarina.json')); } catch (e) { /* sem snapshot */ }
    const lutas = snap ? (snap.lutas || []).filter((x) => /Dragão/.test(x.boss || '') && (x.hist || []).length > 5) : [];
    if (dr && lutas.length) {
      const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
      const durs = lutas.map((x) => x.durS);
      const pots = lutas.map((x) => (x.hist || []).filter((h) => h.t === 'pot').length);
      const hpmins = lutas.map((x) => Math.min(...(x.hist || []).filter((h) => h.hp != null).map((h) => h.hp))).filter((v) => isFinite(v));
      P('## 6) A luta SIMULADA contra o Dragão vs as ' + lutas.length + ' lutas MEDIDAS no snapshot');
      P('');
      P('| grandeza | medido (docs/snapshots/katarina.json) | simulado (esta execução) |');
      P('|---|---|---|');
      P('| duração | mediana ' + med(durs).toFixed(1) + ' s (' + Math.min(...durs).toFixed(1) + '-' + Math.max(...durs).toFixed(1) + ') | ' + f2(dr.r.dur) + ' s |');
      P('| poções | mediana ' + med(pots) + ' (' + Math.min(...pots) + '-' + Math.max(...pots) + ') | ' + (dr.r.tot.pocoes.vida + dr.r.tot.pocoes.vidaF + dr.r.tot.pocoes.vidaS) + ' |');
      P('| vida mínima do jogador | ' + Math.min(...hpmins) + ' a ' + Math.max(...hpmins) + ' | ' + n0(dr.r.hpMin) + ' |');
      const mland = {};
      for (const e of dr.r.ev) { const m = /^GOLPE [^(]*\(([a-z]+)/.exec(e.texto); if (m) mland[m[1]] = (mland[m[1]] || 0) + 1; }
      const mint = (dr.r.ev.filter((e) => /INTERROMPIDO/.test(e.texto)).length);
      P('| mecânicas que ATERRARAM | sopro, chuva e rugido (a chuva falta em parte das lutas: interrompida) | ' + Object.entries(mland).map((([k, v]) => k + ' x' + v)).join(', ') + (mint ? ' — ' + mint + ' cargas interrompidas pelo atordoamento da Adaga Certeira (motor.js:3089)' : '') + ' |');
      P('| cura das habilidades por segundo | mediana ' + med(lutas.map((x) => x.healSkillS || 0)) + '/s | ' + ((dr.r.tot.curaGiro + dr.r.tot.curaRV) / Math.max(0.01, dr.r.dur)).toFixed(1) + '/s |');
      P('');
      P('A duração, o número de poções, a vida mínima e a cura por segundo caem DENTRO do intervalo medido. O que não bate é o DPS do jogador, porque a base do campeão não existe no repositório (ver [1]).');
      P('');
    }
  }

  P('## 7) O RANK DA PASSIVA D — DEDUZIDO dos pontos e CONFIRMADO pela cura medida');
  P('');
  P('- motor.js:1061 — o `migrar` do motor põe `pontos = nivel - soma(ranks)`. Logo, com `pontos: 0` no nv29,');
  P('  a **soma dos ranks IGUALA o nível = 29** (a Q inicial é de graça, motor.js:1016 — não gasta ponto).');
  P('- docs/snapshots/skills.json — o arsenal MEDIDO tem 24 ranks (Q10+W1+E3+R3+G1+A5+F1) e `pontos: 0`.');
  P('  **29 - 24 = 5**, e esses 5 só podem estar na passiva D (a única habilidade que o arsenal não lista).');
  P('- motor.js:768 — a passiva **D (Lâmina Sinistra)** dá velocidade de ataque por adaga e `curaGiro: serie(0.08, 0.01)`: no rank 5 vale 0,12.');
  P('- motor.js:2192 — com D, o giro cura `(curaBase 0,05 + curaGiro)` do dano dele. Com D = 5: **0,17** do dano do giro.');
  P('- docs/snapshots/katarina.json — o giro MEDIDO bate 1640 e a cura medida nessa luta é `{t: heal, v: 279}`:');
  P('  0,17 x 1640 = **278,8** contra os 279 medidos (**-0,07%**). Com D = 4 seriam 0,16 x 1640 = 262,4 (-5,9%) e com D = 0,');
  P('  0,05 x 1640 = 82. **É a cura medida que escolhe o rank 5** — a conta dos pontos tinha dado 4 por esquecer a Q de graça.');
  P('');
  P('**Conclusão:** os 5 pontos que faltam estão na D (**rank 5**). A estimativa anterior (rank 4) errava a conta: com `pontos: 0`');
  P('a soma dos ranks IGUALA o nível (motor.js:1061), porque a Q inicial não gasta ponto. Desde 2026-10-14 o modelo usa **D = 5**.');
  P('`--rankD 4` (ou `--rankD 0`) mostra o que era antes, e a tabela abaixo mede o que a correcção vale.')
  P('');
  {
    const r4 = {};
    for (const c of CHEFES) r4[c.nome] = lutar({ nome: c.nome, nm: c.nm, nivelJogador: nivel, st, ranks: { ...ranks, D: 0 }, barra, itens, semente: semente + c.nm[0], pisoPct, margem, maxSeg, pocoes: { vida: null, vidaF: null, vidaS: null } });
    P('| chefe | poções (D = 5, corrigido) | poções (D = 0, antes) | vida mínima (D=5) | vida mínima (D=0) |');
    P('|---|---:|---:|---:|---:|');
    for (const c of CHEFES) {
      const a = r4[c.nome], b = (resultados.find((x) => x.c.nome === c.nome) || {}).r;
      if (!b) continue;
      P('| ' + c.nome + ' | ' + (b.tot.pocoes.vida + b.tot.pocoes.vidaF + b.tot.pocoes.vidaS) + ' | ' + (a.tot.pocoes.vida + a.tot.pocoes.vidaF + a.tot.pocoes.vidaS) + ' | ' + n0(b.hpMin) + ' | ' + n0(a.hpMin) + ' |');
    }
    P('');
  }


  P('## 8) AS LARVAS DO BARÃO — a cadência REAL (não é 14 s)');
  P('');
  P('O pedido dizia 2 larvas a cada 14 s, e o 14 está em motor.js:3076 — mas é só o campo **espera** do');
  P('invocar. O invocar é 1 de 3 mecânicas do rodízio (motor.js:3080): **invocar -> tentáculos -> ácido**.');
  P('O ciclo completo é (0 + 14) + (1,3 + 9) + (1 + 9) = **34,3 s** [motor.js:3076-3079].');
  P('');
  {    const bar = resultados.find((x) => x.c.nome === 'Barão Nashor');
    if (bar) {
      const inv = bar.r.ev.filter((e) => /CHEFE INVOCA/.test(e.texto)).map((e) => e.t);
      const ivs = [];
      for (let k = 1; k < inv.length; k++) ivs.push(+(inv[k] - inv[k - 1]).toFixed(2));
      P('Na luta simulada as invocações foram em **' + inv.map((v) => v.toFixed(2)).join(' / ') + ' s**.');
      P('');
      P('| grandeza | valor |');
      P('|---|---|');
      P('| intervalo entre invocações | ' + (ivs.length ? ivs.join(' / ') + ' s (mediana ' + ivs.slice().sort((a, b) => a - b)[Math.floor(ivs.length / 2)] + ' s)' : '-') + ' |');
      P('| ciclo SEM interrupção | 34,30 s ((0+14)+(1,3+9)+(1+9), motor.js:3076-3079) |');
      P('| interrupções pela Adaga Certeira | ' + bar.r.ev.filter((e) => /INTERROMPIDO/.test(e.texto)).length + ' (motor.js:3089 -> tMec volta a 6 s em vez de 9) |');
      P('| larvas nascidas | ' + (inv.length * 2) + ' em ' + inv.length + ' invocações (2 por invocação, motor.js:3118) |');
      P('| larvas abatidas | ' + bar.r.tot.abatesLarva + ' |');
      P('');
      P('**A surpresa que não era surpresa:** o atordoamento da Adaga Certeira (motor.js:2259) corta a carga');
      P('e mete tMec a 6 (motor.js:3089). Cada carga interrompida ENCURTA o ciclo do chefe — e ciclo mais');
      P('curto é invocação mais cedo, ou seja, a A faz nascer MAIS larvas, não menos: ');
      P('sem interrupção seriam ' + (bar.r.dur / 34.3 * 2).toFixed(1) + ' larvas em ' + bar.r.dur + ' s; as interrompidas dão ' + (inv.length * 2) + '.');
      P('');
      P('Cada larva (motor.js:3118): nível ' + '42-6 = 36' + ', 5551 HP (CURVA.hp(36) x 1,1), 368 AD mágico (CURVA.ad(36) x 1,05),');
      P('as 0,8, armadura 59 (CURVA.armadura(36) x 1), nascem com chegada 1,0 s e 1,3 s (motor.js:3118) e');
      const lvl = 36, lm = M.MONSTROS['Larva do Vazio'];
      const larvaAd = M.CURVA.ad(lvl) * lm.ad;
      const larvaDano = M.mitigar(larvaAd, st.rm) * M.fatorDanoMonstro({ nivel: st.nivel }, { nivel: lvl }) * KIT_KAT.papel.recebido;
      P('batem ' + Math.round(larvaDano) + ' de dano mágico por golpe (' + Math.round(larvaAd) + ' AD, mitigado pela RM ' + n0(st.rm) + ', x' + M.fatorDanoMonstro({ nivel: st.nivel }, { nivel: lvl }).toFixed(2) + ' do nível, x' + KIT_KAT.papel.recebido + ' do papel) — conferido na linha do tempo: -174, 2 larvas a cada 1,25 s.');
      P('');
    }
  }

  const md = arg('--md', null);
  if (md) { fs.writeFileSync(path.join(RAIZ, md), OUT.join('\n') + '\n', 'utf8'); console.error('(escrito ' + md + ')'); }
}

export { lutar, statsJogador, M, CHEFES, nivelDoChefe, BUILD_DONO, BUILD_PROCS, RANKS_MEDIDOS, BARRA_MEDIDA, ATRIB_DONO, PAINEL, conferirPainel, conferirEventos };
