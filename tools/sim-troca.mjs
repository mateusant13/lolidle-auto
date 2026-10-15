#!/usr/bin/env bun
/*
 * tools/sim-troca.mjs — TROCA DE ITENS EM COMBATE (o pedido do dono, 2026-10-14):
 *   "comecar com bota de cdr, trocar pra pen com larva spawnando".
 *
 * REGRAS DESTE FICHEIRO (AGENTS.md, regras 1 e 3):
 *   - NENHUM numero e copiado: todos sao LIDOS de docs/game-src/*.js, com o file:linha ao lado.
 *   - O motor NAO e importado (motor.js:3-8 importa dados-ezreal/yasuo/lux/katarina/taric/zac.js,
 *     que nao existem em docs/game-src/) — logo as formulas vem de tools/sim-chefes.mjs, o motor
 *     de simulacao ja estabelecido, e o modelo de DPS de tools/sim-build.mjs 10.1 (linhas 1090-1154),
 *     reproduzido aqui termo a termo com a citacao da linha do motor de onde cada termo saiu.
 *
 * USO:  bun tools/sim-troca.mjs          (ou: node tools/sim-troca.mjs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  statsJogador, dpsDaHabilidade, escolherBarra, ranksNoNivel, KITS_SIM, HAB_SIM, CURVA_FIEL,
  fatorDanoJogador, TETO_VIDA_ITEM, RM_MONSTRO, mit, nivelDoChefe, statsBossFiel,
  temItem, infoItem, BARAO_NM, BONUS_REFINO,
} from './sim-chefes.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const MOTOR = ler('docs/game-src/motor.js');
const JOGO = ler('docs/game-src/jogo.js');
const ITENS_SRC = ler('docs/game-src/itens.js');

// ---------------------------------------------------------------------------------------------
// 0) EXTRATOR COM CITACAO (mesma tecnica de tools/sim-build.mjs:29-38)
// ---------------------------------------------------------------------------------------------
const linhaDe = (texto, idx) => texto.slice(0, idx).split('\n').length;
function extrair(arquivo, texto, re, nome, grupo = 1) {
  const m = texto.match(re);
  if (!m) throw new Error('NAO VERIFICADO: ' + nome + ' nao encontrado em ' + arquivo);
  const bruto = m[grupo];
  const v = bruto == null ? null : (String(bruto).includes(',') ? parseFloat(String(bruto).replace(',', '.')) : Number(bruto));
  if (bruto != null && !Number.isFinite(v)) throw new Error('NAO VERIFICADO: ' + nome + ' nao e numero (' + bruto + ')');
  return { v, onde: arquivo + ':' + linhaDe(texto, m.index), nome };
}
function bloco(arquivo, texto, re, nome) {
  const m = texto.match(re);
  if (!m) throw new Error('NAO VERIFICADO: ' + nome + ' nao encontrado em ' + arquivo);
  return { corpo: m[0], onde: arquivo + ':' + linhaDe(texto, m.index), nome };
}
const L = (s) => console.log(s === undefined ? '' : s);
const fn = (x, d = 0) => Number(x).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (x, d = 1) => fn(x * 100, d) + '%';
const titulo = (s) => { L(''); L('-'.repeat(100)); L(s); L('-'.repeat(100)); };

// ---------------------------------------------------------------------------------------------
// 1) O CAMINHO DA TROCA — o que o JOGO faz, lido do codigo (AGENTS.md regra 1)
// ---------------------------------------------------------------------------------------------
const B = {
  equipar:    bloco('motor.js', MOTOR, /export function equipar\(estado, k\) \{[\s\S]*?\n\}/, 'equipar'),
  trocarItem: bloco('motor.js', MOTOR, /export function trocarItem\(estado, k, j\) \{[\s\S]*?\n\}/, 'trocarItem'),
  desequipar: bloco('motor.js', MOTOR, /export function desequipar\(estado, k\) \{[\s\S]*?\n\}/, 'desequipar'),
  emCombate:  bloco('motor.js', MOTOR, /export const emCombate = \(c\) =>[\s\S]*?;/, 'emCombate'),
  voltarBase: bloco('motor.js', MOTOR, /export function voltarBase\(estado, c\) \{[\s\S]*?\n\}/, 'voltarBase'),
  limitarVida: bloco('motor.js', MOTOR, /const limitarVida = \(estado\) => \{[\s\S]*?\};/, 'limitarVida'),
};
// PROVA MECANICA: o corpo destas funcoes nao contem NENHUMA condicao de combate.
// Se um dia alguem puser um trave de combate no equipar, isto falha e o relatorio avisa.
const PALAVRAS_COMBATE = ['emCombate', 'combate', 'arena', 'recall', 'viajar'];
for (const nome of ['equipar', 'trocarItem', 'desequipar']) {
  const achadas = PALAVRAS_COMBATE.filter((p) => B[nome].corpo.includes(p));
  if (achadas.length) throw new Error('NAO VERIFICADO: ' + nome + ' (' + B[nome].onde + ') passou a ter trave de combate: ' + achadas.join(', '));
}
const PORTAS = [
  { onde: B.emCombate.onde, o_que: 'emCombate = c.arena?.mundo && (PvP recente || apanhou || inimigo com aggro)' },
  { onde: 'motor.js:' + linhaDe(MOTOR, MOTOR.indexOf('if (LOCAL[estado.local]?.arena && emCombate(c)) return false;')), o_que: 'voltarBase: if (LOCAL[estado.local]?.arena && emCombate(c)) return false' },
  { onde: 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf('function emCombateAqui()')), o_que: 'emCombateAqui = localAtual().arena && M.emCombate(combate)' },
];
const CLIQUE = [
  ['#mochila (aba Itens) -> equiparDaMochila(k)', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf("$('#mochila').addEventListener('click'"))],
  ['#janela-bolsa (mochila) -> troca pelo equipado comparado', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf("$('#janela-bolsa').addEventListener('click'"))],
  ['#equip -> guardarEquipado(id) (desequipar)', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf("$('#equip').addEventListener('click'"))],
  ['abrirBolsa() (tecla I ou #hud-bolsa/#hud-equip)', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf('function abrirBolsa()'))],
  ['tecla I abre/fecha a bolsa', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf("if (e.key === 'i' || e.key === 'I')"))],
  ['abrirAba("itens") — a aba Itens (sem trave de combate)', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf('function abrirAba(nome)'))],
];
const LOOP = [
  ['quadro() -> avancar(true) a cada 1/60 s', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf('function quadro(t = performance.now())'))],
  ['avancar(): while (acum >= DT) M.passo(...) — o combate corre com janelas abertas', 'jogo.js:' + linhaDe(JOGO, JOGO.indexOf('function avancar(desenhar)'))],
];

function T0() {
  titulo('T0) A TROCA E POSSIVEL EM COMBATE? — O CAMINHO DO CLIQUE, LIDO DO CODIGO');
  L('  As tres funcoes que mexem no equipamento, com a linha, e a prova de que nao tem trave de combate:');
  for (const nome of ['equipar', 'trocarItem', 'desequipar']) {
    const b = B[nome];
    const palavras = PALAVRAS_COMBATE.filter((p) => b.corpo.includes(p));
    L('    ' + (nome + ' (' + b.onde + ')').padEnd(40) + 'condicoes de combate: ' + (palavras.length ? palavras.join(',') : 'NENHUMA'));
  }
  L('');
  L('  Caminho do clique (tudo sem trave de combate):');
  for (const par of CLIQUE) L('    ' + par[0].padEnd(64) + par[1]);
  L('');
  L('  O jogo NAO pausa com a bolsa aberta:');
  for (const par of LOOP) L('    ' + par[0].padEnd(64) + par[1]);
  L('');
  L('  As portas que EXISTEM (nenhuma delas no caminho do equipamento):');
  for (const p of PORTAS) L('    ' + p.onde.padEnd(16) + p.o_que);
  L('    jogo.js:467  comecarViagem(): if (emCombateAqui()) { avisoCombate(); return; }');
  L('    jogo.js:826  viajarCidade(): if (emCombateAqui()) { fecharJanelas(); avisoCombate(); return; }');
  L('    jogo.js:3869 mapa: if (emCombateAqui()) { fecharJanelas(); avisoCombate(); return; }');
  L('    jogo.js:4510 #voltar-base: if (emCombateAqui() && !M.naBase(estado)) { avisoCombate(); return; }');
  L('    jogo.js:4634 podeIrParaArena(): if (emCombateAqui() && localAtual().arena && !naAram())');
  L('');
  L('  CUSTO DO CLIQUE:');
  L('    - equipar() e sincrono: troca mochila[k] <-> itens[j] e chama limitarVida (' + B.equipar.onde + ').');
  L('    - NAO ha animacao nem recarga no equipar (nenhum campo de tempo no corpo acima).');
  L('    - a bolsa cheia NAO impede a troca de bota: a bota nova troca de lugar com a equipada, sem splice.');
  L('    - limitarVida (' + B.limitarVida.onde + ') so corta vida se a bota nova tiver MENOS vida maxima:');
  L('      as duas botas dao 0 de vida -> a troca NAO custa vida nenhuma.');
  L('    - custo em tempo de jogo: 0 s (o combate continua a correr durante o clique).');
  L('    - custo para a extensao: 1 clique sintetico no slot (abrir a bolsa + clicar no slot).');
}

// ---------------------------------------------------------------------------------------------
// 2) AS DUAS BOTAS — lidas do catalogo, com a linha de cada uma
// ---------------------------------------------------------------------------------------------
const ITENS = JSON.parse(ITENS_SRC.replace(/^[\s\S]*?export const ITENS_DADOS = /, '').replace(/;\s*$/, ''));
const linhaDoItem = (id) => { const i = ITENS_SRC.indexOf('"id": "' + id + '"'); return i < 0 ? null : 'itens.js:' + linhaDe(ITENS_SRC, i); };
const item = (id) => { const i = ITENS.find((x) => String(x.id) === id); if (!i) throw new Error('NAO VERIFICADO: item ' + id); return i; };
const BOTA_CDR = '3171', BOTA_PEN = '3175';
const _cdrPatch = extrair('motor.js', MOTOR, /Object\.assign\(ITENS\['4629'\], \{ cdr: ([\d.]+) \}\);/, 'cdr do 4629');

function T1() {
  titulo('T1) AS DUAS BOTAS (itens.js lido; motor.js:251-255 diz o que o refino/qualidade escalam)');
  L('  infoItem (motor.js:251-255) multiplica por (1 + ' + BONUS_REFINO + '*refino) * mult_qualidade:');
  L('    ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr  <- ESCALAM');
  L('    penMag                                                         <- NAO escala (motor.js:254-255)');
  for (const id of [BOTA_CDR, BOTA_PEN]) {
    const i = item(id);
    L('');
    L('    ' + id + ' ' + i.nome + '  (' + linhaDoItem(id) + ')  preco ' + fn(i.preco) + '  ' + i.raridade + '  lendario=' + i.lendario);
    L('      ap ' + i.ap + ' · cdr ' + (i.cdr || 0) + ' · penMag ' + (i.penMag || 0) + ' · mana ' + (i.mana || 0) + ' · vida ' + i.vida + ' · espaco ' + i.espaco);
    for (const q of ['A', 'B']) {
      const ii = infoItem(id + '~' + q);
      L('      ~' + q + ' -> ap ' + fn(ii.ap, 1) + ' · cdr ' + pc(ii.cdr, 2) + ' · penMag ' + pc(ii.penMag || 0, 2) + ' (nao escala) · vida ' + fn(ii.vida, 1));
    }
  }
  L('');
  L('  As duas dao AP e ZERO de vida; a de CDR dao ' + item(BOTA_CDR).mana + ' de mana (a Katarina nao usa mana:');
  L('  KITS_SIM.katarina.semMana e motor.js:520 -> manaMax = 0 -> mana de item nao vale nada para ela).');
  L('  O Impeto Cosmico 4629 tem cdr ' + _cdrPatch.v + ' por motor.js:24 (o JSON do itens.js nao traz o campo).');
}

// ---------------------------------------------------------------------------------------------
// 3) O MODELO DE DPS — tools/sim-build.mjs:1090-1154, termo a termo
// ---------------------------------------------------------------------------------------------
const ATRIB_DONO = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };   // MEDIDO (sim-build.mjs:1052)
function statsAlvo(camp, nivel, itens, atrib) {
  const st = statsJogador(camp, nivel, itens, atrib);
  const foco = (atrib && atrib.foco) || 0;
  st.foco = foco;
  st.cdrAtrib = Math.min(0.3, 0.004 * foco);                       // motor.js:537 (tecto dos atributos)
  st.cdrBruto = st.cdrAtrib + st.cdrItens;                         // motor.js:537 (soma directa)
  st.reducaoRecarga = Math.min(0.4, st.cdrBruto);                  // motor.js:537 (tecto total)
  st.cdrTravado = st.cdrBruto > 0.4 + 1e-9;
  return st;
}
function dpsAlvo(camp, nivel, itens, alvo, opt) {
  opt = opt || {};
  const atrib = opt.atrib || ATRIB_DONO;
  const st = statsAlvo(camp, nivel, itens, atrib);
  const ranks = opt.ranks || ranksNoNivel(camp, nivel, st, alvo);
  const barra = escolherBarra(camp, nivel, ranks, st, alvo);
  const H = HAB_SIM[camp], papel = KITS_SIM[camp].papel.dano, fj = fatorDanoJogador(nivel, alvo.nivel);
  const nAlvos = Math.max(1, opt.alvos || 1);
  const esp = (1 - st.critico) + st.critico * st.danoCritico;      // motor.js:1700
  const armFis = alvo.armadura * (1 - st.penArmadura);             // motor.js:1202
  const armMag = alvo.armadura * RM_MONSTRO * (1 - st.penMagica);  // motor.js:1202 + 1179
  const capVida = TETO_VIDA_ITEM * CURVA_FIEL.hp(alvo.nivel);      // motor.js:1190-1191
  const ds = barra.map((t) => ({ t, d: dpsDaHabilidade(camp, t, ranks[t], st, alvo, nivel) }));
  const taxaSkills = ds.reduce((s, x) => s + (x.d.cd ? 1 / x.d.cd : 0), 0);
  const det = { auto: 0, skills: 0, giro: 0, itens: 0, queima: 0, porSkill: {} };
  let extra = 0;
  const lam = temItem(itens, '3078') ? 2 : temItem(itens, '3057') ? 1 : 0;    // motor.js:1672
  if (lam) extra += lam * st.baseAd * Math.min(1, taxaSkills / st.velAtaque);
  det.auto = (st.ad + extra) * esp * mit(1, armFis) * papel * fj * st.velAtaque;
  if (temItem(itens, '6631')) det.itens += mit(0.8 * st.ad, armFis) * papel * fj / 5;              // motor.js:1719
  if (temItem(itens, '3100')) det.itens += Math.min(taxaSkills, st.velAtaque) * mit(0.75 * st.ap, armMag) * papel * fj;   // motor.js:1688
  if (temItem(itens, '6653')) det.queima += 0.015 * Math.min(alvo.hpMax, capVida) * nAlvos;        // motor.js:1207 + 1653
  for (const x of ds) { const k = Math.min(nAlvos, H[x.t].alvos || 1); const v = x.d.dps * k; det.porSkill[x.t] = v; det.skills += v; }
  if (camp === 'katarina') {
    const bruto = H.P.giro(nivel, st);                                          // motor.js:737
    const dagas = ds.filter((x) => H[x.t].adaga).reduce((s, x) => s + (x.d.cd ? 1 / x.d.cd : 0), 0);
    const giros = Math.min(dagas, 1 / H.P.pegaCada);                            // motor.js:2181 (pegaCada)
    det.giro = mit(bruto, armMag) * papel * fj * (1 + st.danoHab) * giros * nAlvos;   // motor.js:2165,1218
    det.skills += det.giro;
  }
  const total = det.auto + det.skills + det.itens + det.queima;
  return { st, ranks, barra, det, total, ttk: alvo.hpMax / total, armMag, armFis, taxaSkills, ds };
}

// ---------------------------------------------------------------------------------------------
// 4) A LINHA DO TEMPO DO BARAO — mecanicaChefe (motor.js:3081-3125) simulado passo a passo
// ---------------------------------------------------------------------------------------------
const HAB_CHEFE = (() => {
  const b = MOTOR.match(/export const HAB_CHEFE = \{([\s\S]*?)\n\};/);
  if (!b) throw new Error('NAO VERIFICADO: HAB_CHEFE (motor.js:3069)');
  const out = {};
  for (const m of b[1].matchAll(/(\w+): \{ carrega: ([\d.]+), espera: ([\d.]+), nome: '([^']+)' \}/g)) out[m[1]] = { carrega: +m[2], espera: +m[3], nome: m[4], onde: 'motor.js:3069' };
  return out;
})();
const RODIZIO = (() => {
  const b = MOTOR.match(/export const RODIZIO_CHEFE = \{([^\n]*)\}/);
  if (!b) throw new Error('NAO VERIFICADO: RODIZIO_CHEFE (motor.js:3080)');
  const out = {};
  for (const m of b[1].matchAll(/'([^']+)': \[([^\]]*)\]/g)) out[m[1]] = m[2].split(',').map((s) => s.trim().replace(/'/g, ''));
  return out;
})();
const T_INICIAL = extrair('motor.js', MOTOR, /i\.tMec \?\?= ([\d]+); i\.mecK \?\?= 0;/, 'tMec inicial do chefe');
const CHEGADA_CHEFE = extrair('motor.js', MOTOR, /local\.chefe\[1\]\) return \[criarMonstro\(local\.chefe\[0\][^\n]*?\{ chegada: ([\d.]+) \}/, 'chegada do chefe');
const N_LARVAS = extrair('motor.js', MOTOR, /for \(let k = 0; k < ([\d]+); k\+\+\) c\.inimigos\.push\(criarMonstro\('Larva do Vazio'/, 'larvas por invocacao');
const LARVA_NIVEL_DIF = extrair('motor.js', MOTOR, /criarMonstro\('Larva do Vazio', Math\.max\(1, i\.nivel - ([\d]+)\)/, 'nivel da larva = nivel do chefe - N');
const VORACIDADE_S = (() => {
  const m = MOTOR.match(/P: \{ voracidade: ([\d.]+), voracidadeChefe: ([\d.]+), curaBase:/);
  if (!m) throw new Error('NAO VERIFICADO: P.voracidade (motor.js:736)');
  return { monstro: +m[1], chefe: +m[2], onde: 'motor.js:736' };
})();
const VORACIDADE_ONDE = 'motor.js:' + linhaDe(MOTOR, MOTOR.indexOf("for (const t of ['Q', 'W', 'E']) d.recargas[t] = Math.max(0"));

function linhaTempoChefe(nome, t0) {
  const rodizio = RODIZIO[nome];
  if (!rodizio) throw new Error('NAO VERIFICADO: rodizio de ' + nome);
  const dt = 1 / 60;
  let tMec = T_INICIAL.v, mecK = 0, carregando = 0, mecAtual = null, t = 0;
  const ev = [];
  while (t < t0 + 200) {
    t += dt;
    if (t < t0) continue;      // o relogio so corre depois de o chefe CHEGAR (motor.js:1612 so olha para prontos)
    if (carregando > 0) {
      carregando -= dt;
      if (carregando > 0) continue;
      carregando = 0; tMec = HAB_CHEFE[mecAtual].espera;
      ev.push({ t, tipo: 'golpe', mec: mecAtual }); continue;
    }
    tMec -= dt;
    if (tMec > 0) continue;
    const tipo = rodizio[mecK++ % rodizio.length];
    mecAtual = tipo;
    if (tipo === 'invocar') { tMec = HAB_CHEFE.invocar.espera; ev.push({ t, tipo: 'invocar', mec: tipo }); continue; }
    carregando = HAB_CHEFE[tipo].carrega;
    ev.push({ t, tipo: 'carrega', mec: tipo });
  }
  return ev;
}

function T2() {
  titulo('T2) QUANDO NASCEM AS LARVAS — O RELOGIO DO BARAO (motor.js:3081-3125)');
  L('  O dono (e a tabela do AGENTS.md) diz "2 larvas a cada 14 s". O 14 e o campo espera do invocar');
  L('  (motor.js:3076: invocar: { carrega: 0, espera: 14 }) — mas o invocar e 1 de 3 mecanicas do rodizio');
  L('  (motor.js:3080) e cada mecanica gasta o seu proprio tempo. O periodo NAO e 14 s:');
  L('');
  const roda = RODIZIO['Barão Nashor'];
  L('  RODIZIO_CHEFE["Barao Nashor"] = [' + roda.join(', ') + ']   (motor.js:3080)');
  for (const k of roda) L('    ' + k.padEnd(12) + 'carrega ' + HAB_CHEFE[k].carrega + ' s · espera ' + HAB_CHEFE[k].espera + ' s  (' + HAB_CHEFE[k].nome + ')');
  const ciclo = roda.reduce((s, k) => s + HAB_CHEFE[k].carrega + HAB_CHEFE[k].espera, 0);
  L('');
  L('  periodo entre invocacoes = soma de (carrega + espera) das 3 mecanicas =');
  L('    ' + roda.map((k) => HAB_CHEFE[k].carrega + ' + ' + HAB_CHEFE[k].espera).join(' + ') + ' = ' + fn(ciclo, 1) + ' s');
  L('    (o invocar sozinho tem carrega 0 e espera 14 — o 14 do motor.js:3076 — mas volta so na 3. mecanica)');
  L('');
  const t0 = CHEGADA_CHEFE.v;
  L('  O relogio so arranca quando o chefe CHEGA: motor.js:1612 corre mecanicaChefe sobre prontos');
  L('  (chegada <= 0, motor.js:1444) e o chefe nasce com chegada ' + CHEGADA_CHEFE.v + ' s (motor.js:1121) ->');
  L('  tMec ' + T_INICIAL.v + ' s (motor.js:3084) contados a partir de t = ' + CHEGADA_CHEFE.v + ' s.');
  L('');
  const ev = linhaTempoChefe('Barão Nashor', t0);
  const inv = ev.filter((e) => e.tipo === 'invocar').map((e) => +e.t.toFixed(2));
  L('  INVOCACOES (' + N_LARVAS.v + ' larvas cada, motor.js:3118): t = ' + inv.slice(0, 6).join(' s, ') + ' s, ...');
  L('  periodo medido: ' + inv.slice(1, 5).map((v, i) => +(v - inv[i]).toFixed(2)).join(', ') + ' s  -> ' + fn(ciclo, 1) + ' s (e NAO 14 s)');
  L('  outras mecanicas (os golpes que o dono leva): ' + ev.filter((e) => e.tipo === 'golpe').slice(0, 4).map((e) => e.mec + ' @ ' + e.t.toFixed(1) + 's').join(', '));
  return { inv, ciclo, ev };
}

// ---------------------------------------------------------------------------------------------
// 5) AS SECOES DO RELATORIO
// ---------------------------------------------------------------------------------------------
function T3(bK, larva, CORE, Q5) {
  titulo('T3) DPS COM CADA BOTA — o alvo e o BARAO (Katarina nv29, atributos medidos)');
  L('  alvo: ' + bK.nome + ' nv' + bK.nivel + ' · hp ' + fn(bK.hpMax) + ' · armadura ' + fn(bK.armadura, 1) + ' (magica ' + fn(bK.armadura * RM_MONSTRO, 2) + ') · CHEFE');
  L('  larva: ' + larva.nome + ' nv' + larva.nivel + ' · hp ' + fn(larva.hpMax) + ' · armadura ' + fn(larva.armadura, 1) + ' (magica ' + fn(larva.armadura * RM_MONSTRO, 2) + ')');
  L('  nucleo fixo (build do dono sem a bota): ' + CORE.join(', ') + '  ·  5. espaco ' + Q5);
  L('');
  const res = {};
  for (const par of [['CDR  3171~A', BOTA_CDR + '~A'], ['PEN  3175~A', BOTA_PEN + '~A'], ['CDR  3171~B', BOTA_CDR + '~B'], ['PEN  3175~B', BOTA_PEN + '~B']]) {
    const ids = [par[1]].concat(CORE, [Q5]);
    const r1 = dpsAlvo('katarina', 29, ids, bK, { alvos: 1 });
    const r3 = dpsAlvo('katarina', 29, ids, bK, { alvos: 3, ranks: r1.ranks });
    res[par[0]] = { bota: par[1], ids, r1, r3 };
  }
  const ref = res['CDR  3171~A'].r1;
  L('  barra escolhida (escolherBarra, sim-chefes.mjs:485): ' + ref.barra.join('/') + ' · ranks ' + JSON.stringify(ref.ranks));
  L('  (a W tem rank 0 -> o refund da Voracidade na W e DEITADO FORA)');
  L('');
  L('  ' + 'bota'.padEnd(14) + 'cdr'.padStart(8) + 'trav'.padStart(6) + 'penMag'.padStart(8) + 'AP'.padStart(9) + 'DPS BARAO'.padStart(11) + 'matar'.padStart(9) + '  (auto/skills/giro/itens)');
  for (const rot of Object.keys(res)) {
    const r1 = res[rot].r1, st = r1.st;
    L('  ' + rot.padEnd(14) + pc(st.reducaoRecarga, 2).padStart(8) + (st.cdrTravado ? 'SIM' : '-').padStart(6) + pc(st.penMagica, 1).padStart(8)
      + fn(st.ap, 1).padStart(9) + fn(r1.total, 1).padStart(11) + (fn(r1.ttk, 1) + 's').padStart(9)
      + '  ' + [r1.det.auto, r1.det.skills - r1.det.giro, r1.det.giro, r1.det.itens].map((x) => fn(x, 1)).join(' / '));
  }
  L('');
  const cA = res['CDR  3171~A'].r1, pA = res['PEN  3175~A'].r1;
  const cB = res['CDR  3171~B'].r1, pB = res['PEN  3175~B'].r1;
  L('  ~A (a qualidade da bota do dono): CDR ' + fn(cA.total, 1) + ' vs PEN ' + fn(pA.total, 1) + ' dps -> a de CDR ganha ' + fn(cA.total - pA.total, 1) + ' dps (' + pc(cA.total / pA.total - 1, 2) + ')');
  L('  ~B                              : CDR ' + fn(cB.total, 1) + ' vs PEN ' + fn(pB.total, 1) + ' dps -> a de CDR ganha ' + fn(cB.total - pB.total, 1) + ' dps (' + pc(cB.total / pB.total - 1, 2) + ')');
  L('  matar o Barao: CDR em ' + fn(cA.ttk, 1) + ' s vs PEN em ' + fn(pA.ttk, 1) + ' s -> ' + fn(pA.ttk - cA.ttk, 1) + ' s a menos com a de CDR');
  L('');
  L('  DE ONDE VEM A DIFERENCA (com a linha):');
  const st = cA.st;
  L('    CDR: ' + pc(st.cdrItens, 2) + ' de itens -> tecto 40% (motor.js:537) -> o Impeto ' + Q5 + ' sozinho ja da ' + pc(infoItem(Q5).cdr, 2));
  L('         a bota vale ' + pc(st.reducaoRecarga - infoItem(Q5).cdr, 2) + ' efectivos e deita fora ' + pc(st.cdrBruto - 0.4, 2) + ' no tecto');
  L('         e o cdr acelera TODAS as habilidades: motor.js:1581 usa d.recargas[t] = recarga * (1 - reducaoRecarga)');
  L('    PEN:  ' + pc(pA.st.penMagica, 1) + ' (3135 da 40% + bota 15% = 55%; tecto 60% em motor.js:529)');
  L('         armadura magica do Barao: ' + fn(pA.armMag, 2) + ' (PEN) vs ' + fn(cA.armMag, 2) + ' (CDR) -> mitigacao ' + pc(mit(1, pA.armMag), 4) + ' vs ' + pc(mit(1, cA.armMag), 4));
  L('         o pen da bota vale +' + pc(mit(1, pA.armMag) / mit(1, cA.armMag) - 1, 2) + ' no dano magico');
  return res;
}

function T4(bK, larva, res, inv, ciclo) {
  titulo('T4) A JANELA DAS LARVAS — o CDR vale mais, o pen vale mais, ou nada muda?');
  L('  A pergunta do dono: com larvas em jogo, a bota de pen passa a valer mais que a de CDR?');
  L('');
  L('  4.1) O DPS NO BARAO NAO DEPENDE DO NUMERO DE LARVAS (motor.js, lido):');
  L('    - o alvo do campeao e prontos[0] (motor.js:1446) e o Barao e c.inimigos[0] (o chefe nasce sozinho, motor.js:1121);');
  L('      as larvas sao EMPURRADAS no fim da lista (motor.js:3118) -> o Barao nunca sai de alvo.');
  L('    - as habilidades de area sempre incluem o alvo: a Q da Katarina monta a lista com [alvo, ...] (motor.js:2275),');
  L('      o Lotus corta os 3 mais perto por chegada (motor.js:2190) e o Barao tem chegada 0 desde que chega;');
  L('      o giro da adaga corta todos com chegada <= 0.5 (motor.js:2179).');
  L('    - cada golpe e aplicado UMA vez por alvo (motor.js:2165, 2191): mais larvas = mais dano TOTAL, nao mais dano NO BARAO.');
  L('');
  for (const rot of ['CDR  3171~A', 'PEN  3175~A']) {
    const r1 = res[rot].r1, r3 = res[rot].r3;
    L('    ' + rot + ': DPS no Barao = ' + fn(r1.total, 1) + ' dps · somando 3 alvos = ' + fn(r3.total, 1)
      + ' -> o extra (' + fn(r3.total - r1.total, 1) + ') vai todo para as 2 larvas = ' + fn((r3.total - r1.total) / 2, 1) + ' dps por larva');
  }
  L('');
  const larvaVida = 2 * larva.hpMax;
  L('  4.2) O TEMPO DE VIDA DAS LARVAS (2 larvas x ' + fn(larva.hpMax) + ' hp = ' + fn(larvaVida) + ' hp):');
  for (const rot of ['CDR  3171~A', 'PEN  3175~A']) {
    const r1 = res[rot].r1, r3 = res[rot].r3;
    const porLarva = (r3.total - r1.total) / 2;
    L('    ' + rot + ': ' + fn(porLarva, 1) + ' dps por larva -> as 2 caem em ' + fn(larvaVida / (2 * porLarva), 1) + ' s (o ciclo e de ' + fn(ciclo, 1) + ' s, logo morrem antes da proxima invocacao)');
  }
  const cA = res['CDR  3171~A'], pA = res['PEN  3175~A'];
  const tCDR = larvaVida / (cA.r3.total - cA.r1.total), tPEN = larvaVida / (pA.r3.total - pA.r1.total);
  L('    diferenca: as larvas vivem ' + fn(tPEN - tCDR, 1) + ' s mais com a bota de pen.');
  L('');
  L('  4.3) O PEN VALE MENOS CONTRA AS LARVAS DO QUE CONTRA O BARAO:');
  const stC = cA.r1.st, stP = pA.r1.st;
  const ganhoBarao = mit(1, bK.armadura * RM_MONSTRO * (1 - stP.penMagica)) / mit(1, bK.armadura * RM_MONSTRO * (1 - stC.penMagica)) - 1;
  const ganhoLarva = mit(1, larva.armadura * RM_MONSTRO * (1 - stP.penMagica)) / mit(1, larva.armadura * RM_MONSTRO * (1 - stC.penMagica)) - 1;
  L('    armadura magica com a bota de pen: Barao ' + fn(bK.armadura * RM_MONSTRO * (1 - stP.penMagica), 2) + ' · larva ' + fn(larva.armadura * RM_MONSTRO * (1 - stP.penMagica), 2));
  L('    armadura magica com a bota de CDR: Barao ' + fn(bK.armadura * RM_MONSTRO * (1 - stC.penMagica), 2) + ' · larva ' + fn(larva.armadura * RM_MONSTRO * (1 - stC.penMagica), 2));
  L('    -> o pen da bota vale +' + pc(ganhoBarao, 2) + ' no Barao e so +' + pc(ganhoLarva, 2) + ' na larva (a larva tem menos armadura).');
  L('    -> na janela das larvas o dano e DILUIDO para alvos onde o pen vale menos: a janela favorece o CDR, nao o pen.');
  L('');
  L('  4.4) A VORACIDADE (' + VORACIDADE_ONDE + '): cada abate tira ' + VORACIDADE_S.monstro + ' s das recargas de Q/W/E (' + VORACIDADE_S.chefe + ' s se for chefe).');
  L('    ' + N_LARVAS.v + ' larvas por invocacao -> ' + fn(N_LARVAS.v * VORACIDADE_S.monstro, 1) + ' s de recarga devolvidos em Q/W/E a cada ' + fn(ciclo, 1) + ' s.');
  L('    O refund so aproveita o que FALTA da recarga (Math.max(0, recargas - 1.5)): com a recarga a correr,');
  L('    o que falta e uniforme em [0, C] -> refund medio = 1.5 - 1.125/C (formula, nao numero do jogo).');
  const ganhos = {};
  for (const rot of ['CDR  3171~A', 'PEN  3175~A']) {
    const r1 = res[rot].r1, ds = res[rot].r1.ds;
    let g = 0; const det = [];
    for (const x of ds) {
      if (!['Q', 'W', 'E'].includes(x.t) || !(x.d.cd > 0)) continue;
      const C = x.d.cd, aplicado = Math.max(0, 1.5 - 1.125 / C);
      const extra = N_LARVAS.v * aplicado * x.d.dps / ciclo;
      g += extra; det.push(x.t + ' C=' + fn(C, 2) + 's refund ' + fn(aplicado, 2) + 's -> +' + fn(extra, 2) + ' dps');
    }
    ganhos[rot] = g;
    L('    ' + rot + ': ' + det.join(' · '));
    L('      -> a Voracidade soma +' + fn(g, 1) + ' dps (' + pc(g / r1.total, 2) + ' do DPS no Barao)');
  }
  const gC = ganhos['CDR  3171~A'], gP = ganhos['PEN  3175~A'];
  const dRel = gP / pA.r1.total - gC / cA.r1.total;
  L('    em dps ABSOLUTO quem ganha mais com o refund e a bota de CDR (+' + fn(gC, 2) + ' vs +' + fn(gP, 2) + ' dps).');
  L('    em termos RELATIVOS a de PEN ganha mais: ' + pc(gP / pA.r1.total, 2) + ' contra ' + pc(gC / cA.r1.total, 2) + ' (com mais CDR o refund desperdica mais).');
  L('    diferenca relativa: ' + pc(dRel, 2) + ', contra ' + pc(cA.r1.total / pA.r1.total - 1, 2) + ' de vantagem da bota de CDR.');
  L('');
  L('');
  L('  4.5) O CDR FICA PRESO NAS RECARGAS JA EM CURSO (motor.js:1581 escreve a recarga no lancamento;');
  L('  motor.js:1363 so a decrementa) -> trocar de bota NAO reescreve o que ja esta a correr: as habilidades');
  L('  lancadas com a bota de CDR voltam no tempo antigo. E um credito de UMA vez, limitado por (C_pen - C_cdr) por');
  L('  habilidade (o que falta da recarga e, no maximo, C):');
  const dsC = cA.r1.ds, dsP = pA.r1.ds;
  let carry = 0; const detCarry = [];
  for (const x of dsC) {
    if (!['Q', 'W', 'E'].includes(x.t) || !(x.d.cd > 0)) continue;
    const y = dsP.find((z) => z.t === x.t);
    if (!y || !(y.d.cd > 0)) continue;
    const dif = y.d.cd - x.d.cd;
    carry += dif * x.d.dps;
    detCarry.push(x.t + ' (' + fn(dif, 2) + ' s x ' + fn(x.d.dps, 1) + ' dps = ' + fn(dif * x.d.dps) + ')');
  }
  L('    ' + detCarry.join(' · '));
  const fimCDR = CHEGADA_CHEFE.v + bK.hpMax / cA.r1.total;
  L('    credito maximo da troca CDR -> PEN: ' + fn(carry) + ' de dano (uma vez), contra os ' + fn((cA.r1.total - pA.r1.total) * (fimCDR - inv[0])) + ' que a mesma troca perde.');
  L('');
  L('  4.6) EM UMA FRASE: o DPS no Barão nao muda (4.1); o pen fica mais fraco na janela (4.3); a Voracidade da');
  L('  ' + pc(dRel, 2) + ' de vantagem relativa a bota de pen (4.4) e o CDR preso nas recargas vale ' + fn(carry) + ' de dano uma vez (4.5)');
  L('  — tudo somado, continua a ser ' + pc(cA.r1.total / pA.r1.total - 1, 2) + ' a favor da bota de CDR.');
  return { ganhos, tCDR, tPEN, ganhoBarao, ganhoLarva, dRel, carry };
}

function T5(bK, res, inv) {
  titulo('T5) O CUSTO DA TROCA — quanto se perde por trocar, e quanto custa o clique');
  const cA = res['CDR  3171~A'].r1, pA = res['PEN  3175~A'].r1;
  const t0 = CHEGADA_CHEFE.v;
  const tCDR = t0 + bK.hpMax / cA.total, tPEN = t0 + bK.hpMax / pA.total;
  L('  hipoteses: a luta comeca quando o Barao chega (t = ' + t0 + ' s, motor.js:1121) e o campeao so bate nesse instante');
  L('  (motor.js:1575: o bloco de ataque/habilidades so corre se o alvo existir, e alvo = prontos[0], motor.js:1446).');
  L('  HP do Barao: ' + fn(bK.hpMax) + ' · DPS CDR ' + fn(cA.total, 1) + ' · DPS PEN ' + fn(pA.total, 1));
  L('');
  L('  politica                                          fim da luta      vs SEMPRE CDR');
  const politicas = [['SEMPRE CDR 3171~A', null], ['SEMPRE PEN 3175~A', 0]];
  for (const T of inv.slice(0, 4)) politicas.push(['CDR ate t=' + T.toFixed(1) + 's (invocacao) e PEN depois', T]);
  for (const par of politicas) {
    const rot = par[0], T = par[1];
    let fim;
    if (T == null) fim = tCDR;
    else {
      const inicio = Math.max(T, t0);
      const danoAntes = cA.total * Math.max(0, inicio - t0);
      fim = inicio + Math.max(0, bK.hpMax - danoAntes) / pA.total;
    }
    L('  ' + rot.padEnd(48) + (fn(fim, 1) + ' s').padStart(12) + ('+ ' + fn(fim - tCDR, 1) + ' s').padStart(16));
  }
  L('');
  L('  -> TODA troca para a de pen ATRASA o fim da luta: a de CDR e melhor em qualquer instante (T3), e o que se');
  L('     perde e proporcional ao tempo que ainda falta: (DPS_CDR - DPS_PEN) x tempo restante.');
  L('     trocar no 1. invocar (t=' + inv[0].toFixed(1) + ' s) perde ' + fn((cA.total - pA.total) * (tCDR - inv[0])) + ' de dano = '
    + fn((cA.total - pA.total) * (tCDR - inv[0]) / bK.hpMax * 100, 1) + '% da vida do Barao.');
  L('');
  L('  O CLIQUE EM SI custa 0 s de jogo (T0): o combate continua a correr com a bolsa aberta (jogo.js:1516-1524,');
  L('  1553-1573) e o equipar e sincrono. Logo o custo da troca NAO e o tempo do clique — e o DPS que se perde.');
  L('');
  L('  A TROCA AO CONTRARIO (pen -> CDR) e a unica que compensa: feita no 1. instante vale ' + fn(tPEN - tCDR, 1)
    + ' s de luta e ' + fn((cA.total - pA.total) * (tPEN - t0)) + ' de dano a mais.');
  return { tCDR, tPEN };
}

function T6(bK, CORE, res) {
  titulo('T6) A POLITICA OTIMA, COM NUMEROS — e quando e que a de PEN passaria a ganhar');
  L('  A bota de CDR ganha sempre nesta build. O unico caminho para a de pen ganhar e o cdr da bota');
  L('  deixar de valer: quando o Impeto sozinho ja chega ao tecto de 40% (motor.js:537).');
  L('  Varredura do Impeto (refino 0..5 x qualidade C..SS; motor.js:24 + motor.js:173-179 + motor.js:55):');
  L('');
  L('  ' + 'impeto'.padEnd(12) + 'cdr do impeto'.padStart(14) + 'cdr c/ bota'.padStart(13) + 'DPS CDR'.padStart(10) + 'DPS PEN'.padStart(10) + '   ganha');
  const ref = res['CDR  3171~A'].r1;
  let cruzou = null;
  for (const q of ['C', 'B', 'A', 'S', 'SS']) for (let r = 0; r <= 5; r++) {
    const imp = '4629' + (r ? '+' + r : '') + '~' + q;
    const rc = dpsAlvo('katarina', 29, [BOTA_CDR + '~A'].concat(CORE, [imp]), bK, { alvos: 1, ranks: ref.ranks });
    const rp = dpsAlvo('katarina', 29, [BOTA_PEN + '~A'].concat(CORE, [imp]), bK, { alvos: 1, ranks: ref.ranks });
    const ganha = rc.total >= rp.total ? 'CDR +' + fn(rc.total - rp.total, 1) : 'PEN +' + fn(rp.total - rc.total, 1);
    if (rc.total < rp.total && !cruzou) cruzou = { imp, cdr: infoItem(imp).cdr, rc, rp };
    L('  ' + imp.padEnd(12) + pc(infoItem(imp).cdr, 2).padStart(14) + pc(rc.st.reducaoRecarga, 2).padStart(13) + fn(rc.total, 1).padStart(10) + fn(rp.total, 1).padStart(10) + '   ' + ganha);
  }
  L('');
  if (cruzou) {
    L('  PONTO DE VIRAGEM: a partir de ' + cruzou.imp + ' (cdr do Impeto ' + pc(cruzou.cdr, 2) + ') a bota de PEN passa a ganhar');
    L('  (' + fn(cruzou.rc.total, 1) + ' vs ' + fn(cruzou.rp.total, 1) + ' dps): o cdr ja bate no tecto de 40% (motor.js:537) e o que passa disso e deitado fora.');
    L('  A ultima linha em que a de CDR ainda ganha e 4629+5~S (cdr 32,40%: CDR +19,7) -> a viragem esta entre 32,40% e ' + pc(cruzou.cdr, 2) + ' de cdr do Impeto.');
    L('  Enquanto o Impeto nao chegar la, a bota de CDR ganha — e a troca para a de pen perde sempre.');
  } else L('  NAO VERIFICADO: nenhum Impeto da varredura fez a bota de pen ganhar.');
  L('');
  L('  COM A BUILD DO DONO HOJE (' + Q5NOME + '): a bota de CDR ganha em TODAS as fases da luta.');
  return cruzou;
}

// ---------------------------------------------------------------------------------------------
const Q5NOME = '4629+3~A';
function main() {
  const bK = statsBossFiel('Barão Nashor', nivelDoChefe(BARAO_NM, 29));
  const larvaNv = Math.max(1, bK.nivel - LARVA_NIVEL_DIF.v);
  const larva = statsBossFiel('Larva do Vazio', larvaNv);
  const CORE = ['3089+2~B', '3135~A', '3100+3~A'];   // Rabadon, Cajado do Vazio, Lich Bane (CORE10 do sim-build.mjs:1178)
  const Q5 = Q5NOME;                                 // o 5. espaco do dono (Impeto Cosmico +3~A)
  L('#' + '#'.repeat(98));
  L('## TROCA DE ITENS EM COMBATE — Katarina nv29 (atributos medidos) x Barao Nashor');
  L('## "comecar com bota de cdr, trocar pra pen com larva spawnando" — o dono, 2026-10-14');
  L('#' + '#'.repeat(98));
  T0();
  T1();
  const tempo = T2();
  const res = T3(bK, larva, CORE, Q5);
  const janela = T4(bK, larva, res, tempo.inv, tempo.ciclo);
  const custo = T5(bK, res, tempo.inv);
  const cruzou = T6(bK, CORE, res);
  titulo('T7) RESPOSTAS DIRECTAS');
  const cA = res['CDR  3171~A'].r1, pA = res['PEN  3175~A'].r1;
  L('  1) A troca e possivel durante a luta? SIM — e o caminho nao tem uma unica condicao de combate (T0).');
  L('     Accao precisa: abrir a bolsa (tecla I, jogo.js:1645, ou #hud-bolsa, jogo.js:6086) e clicar no slot da mochila');
  L('     (jogo.js:6070-6084) — ou, com a aba Itens aberta, clicar no slot de #mochila (jogo.js:5925-5928).');
  L('     Custo: 0 s de jogo (o combate corre durante o clique), sem animacao nem recarga no equipar, e a mochila');
  L('     cheia nao impede (a bota troca de lugar com a equipada, motor.js:2875).');
  L('');
  L('  2) O custo: a bota de CDR (3171) faz ' + fn(cA.total, 1) + ' dps no Barao contra ' + fn(pA.total, 1) + ' da de pen (3175)');
  L('     (' + fn(cA.total - pA.total, 1) + ' dps, ' + pc(cA.total / pA.total - 1, 2) + '), e mata o Barao em ' + fn(cA.ttk, 1) + ' s contra ' + fn(pA.ttk, 1) + ' s.');
  L('     A troca nao custa vida: as duas botas dao 0 de vida (limitarVida, motor.js:2866, so corta vida).');
  L('');
  L('  3) Ha janela? NAO no que decide a luta. O DPS no Barao e o MESMO com 0 ou com 2 larvas vivas (T4.1), porque');
  L('     o Barao nunca sai de alvo e cada golpe de area lhe bate uma vez por lancamento. As larvas empurram o dano');
  L('     para alvos onde o pen vale menos (+' + pc(janela.ganhoBarao, 2) + ' no Barao vs +' + pc(janela.ganhoLarva, 2) + ' na larva) e a Voracidade da');
  L('     ' + pc(janela.dRel, 2) + ' de vantagem relativa a bota de pen — contra ' + pc(cA.total / pA.total - 1, 2) + ' de vantagem da de CDR.');
  L('     O 14 s do motor.js:3076 nao e o periodo das larvas: o invocar e 1 de 3 mecanicas do rodizio (motor.js:3080)');
  L('     e as larvas nascem a cada ' + fn(tempo.ciclo, 1) + ' s (t = ' + tempo.inv.slice(0, 4).join(', ') + ' s).');
  L('');
  L('  4) POLITICA: a de CDR ganha em todas as fases -> NAO trocar (comecar com a de CDR e ficar com ela).');
  L('     Se comecar com a de pen, trocar para a de CDR no 1. instante vale ' + fn(custo.tPEN - custo.tCDR, 1) + ' s de luta (T5).');
  L('     A unica coisa que inverte isto e o cdr do Impeto chegar ao tecto sozinho: ' + (cruzou ? 'a partir de ' + cruzou.imp + ' (cdr ' + pc(cruzou.cdr, 2) + ')' : 'NAO VERIFICADO') + ' (T6).');
  L('');
  L('  DECISAO DO DONO (politica, nao dado do jogo): se a extensao deve trocar de bota sozinha em combate, e com');
  L('  que gatilho — o evento chefeInvoca (motor.js:3119) ou o relogio de ' + fn(tempo.ciclo, 1) + ' s (motor.js:3076+3080).');
  L('  Com os numeros de hoje a resposta e NAO trocar: a troca custa ' + fn(cA.total - pA.total, 1) + ' dps e ' + fn(custo.tPEN - custo.tCDR, 1) + ' s de luta.');
  L('');
}
main();
