#!/usr/bin/env bun
/*
 * tools/sim-swap.mjs — TROCAR ITENS E HABILIDADES EM COMBATE, contra o DRAGAO INFERNAL.
 *
 * NAO reimplementa o motor: IMPORTA tools/sim-chefes.mjs (que ja reimplementa motor.js com a
 * citacao file:linha de cada numero). tools/sim-build.mjs nao e tocado.
 *
 * ============================ O QUE A TROCA EM COMBATE E, NO CODIGO ============================
 *  - motor.js:2870 equipar / 2883 trocarItem / 2913 desequipar / 2892 equipamentoValido: NAO
 *    olham para o combate. O unico guarda de combate e motor.js:3056 emCombate, usado SO em
 *    motor.js:3061 voltarBase (recall) e, no jogo.js, viajar/ir para a arena (467, 826, 3869,
 *    4510, 4634). NAO trava equipar nem a barra.
 *  - motor.js:2834 alternarBarra / 2841 trocarNaBarra: NAO olham para o combate nem para as
 *    recargas. So exigem rank >= 1 (2837/2842) e nao ser passiva.
 *  - motor.js:1581 d.recargas[t] = recarga * (1 - a.reducaoRecarga): a recarga e escrita na hora
 *    do USO com o CDR do momento; trocar o item depois NAO reescreve recargas em curso
 *    (motor.js:1363 so as decrementa). O estado das habilidades SOBREVIVE a troca.
 *  - motor.js:2866 limitarVida: trocar um item de vida corta a vida ATUAL ao novo maximo.
 *  - motor.js:1335 (passo) le atributos(estado) a cada quadro; motor.js:492-544 recalcula de
 *    estado.itens. A troca vale no quadro seguinte (sem cache).
 *  - jogo.js:1516-1524: ~60 quadros/s com a aba visivel. O custo real da troca e o tempo de
 *    cliques do jogador, nao um cooldown do jogo.
 *
 * ================================ DEFEITO ENCONTRADO NO CAMINHO ================================
 *  tools/sim-chefes.mjs:570 faz  extra += 0.05 * vidaMedia3153  e tools/sim-chefes.mjs:572
 *  multiplica esse extra por esperancaCrit (o crit). Em motor.js:1702 o 3153 tambem entra no
 *  bruto do golpe basico e motor.js:1700 aplica o critico a esse bruto. Ou seja: o modelo do
 *  sim-chefes REPRODUZ o motor — se for bug, e bug DO JOGO, nao do simulador. Como nao posso
 *  editar o sim-chefes, este ficheiro corre com a formula do sim-chefes (MODELO SIM-CHEFES) e,
 *  em paralelo, com o proc SEM critico (MODELO CORRIGIDO). Os dois numeros sao reportados.
 *  Prova do impacto: com a build AD/crit o proc do 3153 da 1.560 dos 2.485 de DPS de auto;
 *  sem o critico sobre o proc, o auto cai para ~443 e a build AD deixa de dominar.
 *
 * FONTE DOS NUMEROS: motor.js (MONSTROS:295-297, CURVA:273-279, NIVEL_DIF:1184-1187,
 * HAB_CHEFE:3069-3079, RODIZIO_CHEFE:3080, mecanicaChefe:3081-3125, golpear:1192-1233,
 * golpeBasico:1673-1722, receberDano:2693-2735, passo:1334-1363, POCOES:261-267, EXAUSTAO:41)
 * e itens.js (catalogo). Nada inventado.
 *
 * USO: bun tools/sim-swap.mjs
 */
import {
  ITENS, baseId, infoItem, statsJogador, statsBossFiel, nivelDoChefe, difNivel,
  fatorDanoMonstro, fatorDanoJogador, dpsTeorico, dpsDaHabilidade, ranksNoNivel,
  melhoresBuilds, buildExtensao, ouroDoEquipamento, curaDaBuild, refinoDe, qualidadeDe,
  HAB_SIM, KITS_SIM, CURVA_FIEL, POCOES_MOTOR, EXAUSTAO, vidaRefItem, TETO_VIDA_ITEM,
} from './sim-chefes.mjs';

// =============================================================================================
// 0) PARAMETROS DO PEDIDO
// =============================================================================================
export const CAMPEOES = 'katarina';
export const NIVEL = 29;                    // docs/snapshots/player.json: nivel 29
export const ATRIB = { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 };  // MEDIDO no painel
export const NOME_BOSS = 'Drag\u00e3o Infernal';
export const DRAGAO_NM = [30, 38];          // motor.js:369 (Fosso do Dragao, faixa 30-40)
export const DRAGAO_NIVEL = nivelDoChefe(DRAGAO_NM, NIVEL);          // motor.js:1121
export const BOSS = statsBossFiel(NOME_BOSS, DRAGAO_NIVEL);
export const CUSTO_TROCA = 1.0;             // segundos por troca (cliques do jogador) — variavel de politica
export const CUSTO_TROCA_CARO = 2.0;

export const DONO = ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'];   // docs/snapshots/dps.json
export const DONO_MEDIDO = { estT: 28.9, realT: 35.6, realPot: 0, estPot: 32 };

// =============================================================================================
// 1) ANALISE DE UM LOADOUT — com os DOIS modelos de critico
// =============================================================================================
/**
 * Devolve o dpsTeorico do sim-chefes e, quando o 3153 esta equipado, a versao em que o proc
 * 'Gume da Nevoa' NAO leva critico (motor.js:1702 entra no bruto; motor.js:1700 aplica o
 * critico ao bruto -> o modelo do sim-chefes; a versao corrigida tira-lhe o critico).
 */
export function analisar(itens, opts = {}) {
  const ranks = opts.ranks;
  const d = dpsTeorico(CAMPEOES, NIVEL, itens, BOSS, { atrib: ATRIB, ranks });
  const st = d.st;
  const esperanca = (1 - st.critico) + st.critico * st.danoCritico;
  const tem3153 = itens.some((x) => baseId(x) === '3153');
  let detCorr = d.det, totalCorr = d.total;
  if (tem3153 && esperanca > 1) {
    const cap = TETO_VIDA_ITEM * CURVA_FIEL.hp(BOSS.nivel);
    const fCap = Math.min(1, cap / BOSS.hpMax);
    const vidaMedia = cap * (1 - fCap / 2);
    const proc = 0.05 * vidaMedia;                                    // motor.js:1702
    const perdido = proc * (esperanca - 1) * d.st.velAtaque;          // o que o critico acrescentava
    detCorr = { ...d.det, auto: d.det.auto - perdido, autoCura: d.det.autoCura - perdido };
    totalCorr = d.total - perdido;
  }
  const cura = curaDaBuild(CAMPEOES, NIVEL, itens, BOSS, { d, semRV: opts.semRV });
  return { d, st, det: d.det, total: d.total, detCorr, totalCorr, cura, barra: d.barra, ranks: d.ranks };
}
// Ranks REAIS do dono, lidos de docs/snapshots/skills.json (o jogo da 1 ponto por nivel,
// motor.js:1048; nv29 = 29 pontos e o dono gastou 24, logo TEM 5 LIVRES):
//   barra actual = [W,Q,R,A]  |  ranks: Q10 W1 E3 R3 G1 A5 F1  (T,B,M,N = 0, nao aprendidas)
export const RANKS_REAL = { Q: 10, W: 1, E: 3, R: 3, G: 1, A: 5, F: 1, T: 0, B: 0, M: 0, N: 0, D: 0 };
export const PONTOS_LIVRES = 29 - 24;
export const BARRA_REAL = ['W', 'Q', 'R', 'A'];      // docs/snapshots/skills.json: bar
// ranks que o jogo ESCOLHERIA com os 29 pontos (sim-chefes) — para comparar
export const RANKS = ranksNoNivel(CAMPEOES, NIVEL, statsJogador(CAMPEOES, NIVEL, buildExtensao(CAMPEOES), ATRIB), BOSS);

// =============================================================================================
// 2) A LUTA COM LOADOUT VARIAVEL NO TEMPO
// =============================================================================================
/**
 * DPS de UMA barra de 4, sem o giro (o giro e adicionado fora), com a R fixa (e a N se
 * existir): motor.js:1578 so deixa usar o que esta na barra, e motor.js:2222-2233 mete a R
 * num chefe sozinho. Reusa dpsDaHabilidade do sim-chefes (motor.js:2124-2137 + 1581).
 */
export function dpsDaBarra(barra, ranks, A, opts = {}) {
  let total = 0; const por = {};
  for (const t of barra) {
    if (!ranks[t]) continue;
    const x = dpsDaHabilidade(CAMPEOES, t, ranks[t], A.st, BOSS, NIVEL, opts.penExtra);
    por[t] = +x.dps.toFixed(1);
    total += x.dps;
  }
  return { total, por };
}
export function lutarComTrocas(inicial, trocas = [], opts = {}) {
  const dt = 0.05, maxSeg = opts.maxSeg || 300;
  const custo = opts.custo ?? CUSTO_TROCA;
  const corrigido = opts.corrigido !== false;
  const boss = BOSS, nivel = NIVEL, campeao = CAMPEOES;
  const kit = KITS_SIM[campeao];
  const fM = fatorDanoMonstro(nivel, boss.nivel);
  const recebido = kit.papel.recebido;                       // motor.js:2697
  const rodizio = ['sopro', 'chuva', 'rugido'];              // motor.js:3080
  const HABM = { sopro: { carrega: 1.0, espera: 9, magico: true, mult: 2.2 },     // motor.js:3073/3105
                 chuva: { carrega: 1.1, espera: 9, magico: true, mult: 1.8 },     // motor.js:3074/3106
                 rugido: { carrega: 0.8, espera: 7, magico: false, mult: 0 } };   // motor.js:3075/3107

  let itens = inicial.slice(), barraAtual = null;
  let A = analisar(itens, { ranks: opts.ranks || RANKS });
  const pega = (x) => (corrigido ? x.totalCorr : x.total);
  const calc = () => (barraAtual
    ? A.detCorr.auto + A.detCorr.itens + A.detCorr.giro + dpsDaBarra(barraAtual, A.ranks, A).total
    : pega(A));
  let dps = calc(), curaRV = A.cura.curaRV, curaKit = A.cura.curaKit;
  let tem3065 = A.cura.tem3065, tem3072 = A.cura.tem3072;
  let hpMax = A.st.vida;
  let hp = Math.min(opts.vidaInicial ?? hpMax, hpMax), escudo = 0, bossHp = boss.hpMax;
  let t = 0, cdPocao = 0, mortoEm = null, matouEm = null, hpMin = hp;
  let danoRecebido = 0, piorGolpe = 0, piorMec = 0, custoTroca = 0, nTrocas = 0;
  const usadas = { vida: 0, vidaF: 0, vidaS: 0 };
  const log = [];
  const estoque = { vida: 999, vidaF: nivel >= 15 ? 999 : 0, vidaS: nivel >= 30 ? 999 : 0 };  // motor.js:1294 + 262-264
  const B = { tMec: 5, mecK: 0, carregando: 0, mec: null, asMul: 1, furiaT: 0, ataque: 1 / boss.as };
  let queimando = 0, queimaDano = 0;

  const aplicarBarra = (barra, motivo) => {
    barraAtual = barra.slice();
    dps = calc();
    nTrocas++; custoTroca += custo;
    log.push({ t: +t.toFixed(2), motivo, barra: barraAtual.slice(), dps: +dps.toFixed(1) });
  };
  const aplicar = (novos, motivo) => {
    itens = novos.slice();
    A = analisar(itens, { ranks: opts.ranks || RANKS });
    dps = calc(); curaRV = A.cura.curaRV; curaKit = A.cura.curaKit;
    tem3065 = A.cura.tem3065; tem3072 = A.cura.tem3072;
    hpMax = A.st.vida;
    if (hp > hpMax) hp = hpMax;                              // motor.js:2866 limitarVida
    nTrocas++; custoTroca += custo;
    log.push({ t: +t.toFixed(2), motivo, itens: itens.slice(), dps: +dps.toFixed(1),
      hpMax: Math.round(hpMax), rv: A.st.rouboVida, penMag: A.st.penMagica });
  };
  const levar = (dano, doSangramento) => {
    if (dano <= 0 || hp <= 0) return;
    if (!doSangramento) { dano *= (1 - A.st.esquiva); dano *= fM; dano *= recebido; }
    if (!doSangramento) piorGolpe = Math.max(piorGolpe, dano);
    if (escudo > 0) { const abs = Math.min(escudo, dano); escudo -= abs; dano -= abs; }
    hp -= dano; danoRecebido += dano;
    if (hp <= 0) { hp = 0; mortoEm = t; }
  };
  const durPrevista = dps > 0 ? boss.hpMax / dps : Infinity;
  if (durPrevista > maxSeg) {
    return { vivo: true, matou: false, t: maxSeg, motivo: 'dps baixo (>' + maxSeg + 's)', itens, log,
      nTrocas: 0, custoTroca: 0, usadas, totalPocoes: 0, custo: 0, hpMin: hpMax, hpMinPct: 100,
      danoRecebido: 0, piorGolpe: 0, piorMec: 0, dps: +dps.toFixed(1), durPrevista: +durPrevista.toFixed(2),
      curaRV: Math.round(curaRV), curaKit: Math.round(curaKit), tempoMatar: null };
  }
  const S = () => ({ t, hp, hpMax, hpPct: hp / hpMax, bossHp, bossPct: bossHp / boss.hpMax,
    carregando: B.carregando > 0 ? B.mec : null, carregandoFalta: B.carregando, queimando,
    itens: itens.slice(), dps, nTrocas, cdPocao, escudo });

  while (t < maxSeg && hp > 0 && bossHp > 0) {
    for (const tr of trocas) {
      if (tr.feito) continue;
      if (!tr.quando(S())) continue;
      tr.feito = true;
      if (tr.barra) aplicarBarra(tr.barra, tr.rotulo || 'barra'); else aplicar(tr.itens, tr.rotulo || 'troca');
    }
    if (curaRV + curaKit > 0) {                              // motor.js:1226-1230 / 1685 / 2169-2170
      const mult = tem3065 ? 1.25 : 1;                       // motor.js:1286
      const cura = (curaRV + curaKit) * mult * dt, falta = hpMax - hp;
      hp = Math.min(hpMax, hp + cura);
      if (tem3072 && cura > falta) escudo = Math.min(hpMax * 0.25, escudo + (cura - falta));   // motor.js:1229
    }
    if (queimando > 0) { queimando = Math.max(0, queimando - dt); levar(queimaDano * dt, true); if (hp <= 0) break; }   // motor.js:1358-1362
    if (B.furiaT > 0) { B.furiaT -= dt; if (B.furiaT <= 0) B.asMul = 1; }                    // motor.js:3085
    if (B.carregando > 0) {                                                                  // motor.js:3086-3112
      B.carregando -= dt;
      if (B.carregando <= 0) {
        const tipo = B.mec; B.carregando = 0; B.mec = null;
        const h = HABM[tipo], def = h.magico ? A.st.rm : A.st.armadura;
        const d = h.mult ? (boss.ad * h.mult) * (100 / (100 + Math.max(0, def))) : 0;         // motor.js:3100-3101
        if (d > 0) { piorMec = Math.max(piorMec, d); levar(d, false); }
        if (tipo === 'sopro') { queimando = 4; queimaDano = hpMax * 0.03; }
        else if (tipo === 'chuva') { queimando = Math.max(queimando, 3); queimaDano = hpMax * 0.025; }
        else if (tipo === 'rugido') { B.asMul = 1.5; B.furiaT = 5; }
        B.tMec = h.espera;
      }
    } else {
      B.tMec -= dt;
      if (B.tMec <= 0) { const tipo = rodizio[B.mecK++ % rodizio.length]; B.mec = tipo; B.carregando = HABM[tipo].carrega; }   // motor.js:3115-3124
    }
    if (B.carregando <= 0) {                                                                  // motor.js:1725-1737
      B.ataque -= dt * B.asMul;
      if (B.ataque <= 0) {
        B.ataque = 1 / boss.as;
        levar(boss.ad * (100 / (100 + Math.max(0, boss.magico ? A.st.rm : A.st.armadura))), false);
      }
    }
    if (hp <= 0) break;
    bossHp -= dps * dt;
    if (bossHp <= 0) { bossHp = 0; matouEm = t; break; }
    cdPocao = Math.max(0, cdPocao - dt);
    if (opts.estrategia) {
      const k = opts.estrategia(S());
      if (k && k !== 'FUGIR' && cdPocao <= 0 && (estoque[k] || 0) > 0) {
        hp = Math.min(hpMax, hp + POCOES_MOTOR[k].cura); usadas[k]++; estoque[k]--; cdPocao = EXAUSTAO;
      }
    }
    hpMin = Math.min(hpMin, hp);
    t += dt;
  }
  const totalPocoes = usadas.vida + usadas.vidaF + usadas.vidaS;
  const custoPocoes = usadas.vida * POCOES_MOTOR.vida.preco + usadas.vidaF * POCOES_MOTOR.vidaF.preco + usadas.vidaS * POCOES_MOTOR.vidaS.preco;
  return { vivo: hp > 0, matou: bossHp <= 0, t: +t.toFixed(2), tempoMatar: matouEm != null ? +matouEm.toFixed(2) : null,
    hpMin: Math.round(hpMin), hpMinPct: +(100 * hpMin / hpMax).toFixed(1), usadas, totalPocoes, custo: custoPocoes,
    danoRecebido: Math.round(danoRecebido), piorGolpe: Math.round(piorGolpe), piorMec: Math.round(piorMec),
    itens, log, nTrocas, custoTroca: +custoTroca.toFixed(2), dps: +dps.toFixed(1), durPrevista: +durPrevista.toFixed(2),
    curaRV: Math.round(curaRV), curaKit: Math.round(curaKit), motivo: hp > 0 ? 'nao matou' : 'morreu' };
}

// a smart de pocao do sim-chefes.smartCarga, reescrita para o S deste ficheiro
export function smartCarga({ pisoPct = 0.65, margem = 1.15 } = {}) {
  return (S) => {
    if (S.hpPct > pisoPct) return null;
    if (S.carregando === 'sopro' || S.carregando === 'chuva') {
      if (S.hpPct < pisoPct * margem) return S.hpPct < 0.35 ? 'vidaS' : 'vidaF';
    }
    return S.hpPct < 0.3 ? 'vidaS' : S.hpPct < 0.55 ? 'vidaF' : 'vida';
  };
}

// =============================================================================================
// 3) TUPLA DO DONO
// =============================================================================================
export const DEFINICAO_TUPLA = '(mata?, segundos, ouro em pocoes, ouro total = pocoes + preco de catalogo dos 5 itens)';
export function tuplaDe(r, itens) {
  const mata = !!(r.matou && r.vivo);
  const ouroEquip = ouroDoEquipamento(itens);
  return { mata, seg: mata ? r.tempoMatar : null, t: r.t, pocoes: r.totalPocoes, custoPocoes: r.custo,
    ouroEquip, ouroTotal: r.custo + ouroEquip, hpMinPct: r.hpMinPct, dps: r.dps, nTrocas: r.nTrocas,
    custoTroca: r.custoTroca, motivo: r.motivo };
}
export const linhaT = (a) =>
  (a.mata ? 'MATA  ' : 'NAO   ') + String(a.mata ? a.seg + 's' : (a.motivo === 'morreu' ? 'MORRE ' + a.t + 's' : a.motivo)).padEnd(18) +
  '| pocoes ' + String(a.pocoes).padStart(3) + ' = ' + String(a.custoPocoes).padStart(6) + 'g | ouro total ' +
  String(a.ouroTotal).padStart(7) + 'g | dps ' + String(Math.round(a.dps)).padStart(5) + ' | vida min ' + String(a.hpMinPct).padStart(5) + '%';

const L = (s = '') => console.log(s);
const nf = (n) => Number(Math.round(n)).toLocaleString('pt-PT');
const nome = (x) => (ITENS[baseId(x)]?.nome || baseId(x));

// =============================================================================================
// 4) CASOS DE USO — TODOS OS GATILHOS QUE O CODIGO PERMITE
// =============================================================================================
function casosDeUso(BASE, alt) {
  const troca = (rotulo, quando, itens, gatilho) => ({ rotulo, quando, itens, gatilho });
  const barra = (rotulo, quando, xs, gatilho, precisaPonto) => ({ rotulo, quando, itens: BASE, gatilho, barra: xs, precisaPonto });
  const bota = (x) => [x, ...BASE.slice(1)];
  const pos = (i, x) => BASE.map((v, k) => (k === i ? x : v));
  const casos = [
    // ---- trocar a BOTA (motor.js:2870-2875: a bota nova troca de lugar com a equipada) ----
    troca('bota: penMag -> CDR no arranque', (S) => S.t === 0 && BASE[0] !== alt.botaCdr, bota(alt.botaCdr), 'arranque'),
    troca('bota: CDR -> penMag no arranque', (S) => S.t === 0 && BASE[0] !== alt.botaPen, bota(alt.botaPen), 'arranque'),
    troca('bota: dano -> RM quando o Dragao carrega o sopro', (S) => S.carregando === 'sopro', bota(alt.botaRm), 'mecanica (carrega)'),
    troca('bota: dano -> RM quando o Dragao carrega a chuva', (S) => S.carregando === 'chuva', bota(alt.botaRm), 'mecanica (carrega)'),
    troca('bota: dano -> RM quando o Rugido soa (+50% as)', (S) => S.carregando === 'rugido', bota(alt.botaRm), 'mecanica (rugido)'),
    troca('bota: dano -> RM na 1.a queimadura', (S) => S.queimando > 0, bota(alt.botaRm), 'queimadura'),
    troca('bota: dano -> RM abaixo de 60% de vida', (S) => S.hpPct < 0.60, bota(alt.botaRm), 'vida < 60%'),
    troca('bota: dano -> RM abaixo de 40% de vida', (S) => S.hpPct < 0.40, bota(alt.botaRm), 'vida < 40%'),
    troca('bota: dano -> RM a meio do chefe (boss < 50%)', (S) => S.bossPct < 0.50, bota(alt.botaRm), 'vida do chefe < 50%'),

    // ---- trocar o 5.o item (motor.js:2883 trocarItem) ----
    troca('item: dano -> roubo de vida abaixo de 70% de vida', (S) => S.hpPct < 0.70, pos(4, alt.itemRv), 'vida < 70%'),
    troca('item: dano -> roubo de vida abaixo de 50% de vida', (S) => S.hpPct < 0.50, pos(4, alt.itemRv), 'vida < 50%'),
    troca('item: dano -> roubo de vida abaixo de 85% de vida', (S) => S.hpPct < 0.85, pos(4, alt.itemRv), 'vida < 85%'),
    troca('item: dano -> roubo de vida quando o chefe passa de 50%', (S) => S.bossPct < 0.50, pos(4, alt.itemRv), 'vida do chefe < 50%'),
    troca('item: dano -> roubo de vida quando o chefe passa de 25%', (S) => S.bossPct < 0.25, pos(4, alt.itemRv), 'vida do chefe < 25%'),
    troca('item: dano -> Semblante (cura x1,25) abaixo de 70%', (S) => S.hpPct < 0.70, pos(4, alt.itemCura), 'vida < 70%'),
    troca('item: dano -> escudo 3072 abaixo de 70%', (S) => S.hpPct < 0.70, pos(4, alt.item3072), 'vida < 70%'),
    troca('item: dano -> Warmog abaixo de 40%', (S) => S.hpPct < 0.40, pos(4, alt.itemVida), 'vida < 40%'),
    troca('item: dano -> Zhonya abaixo de 30%', (S) => S.hpPct < 0.30, pos(4, alt.itemZhonya), 'vida < 30%'),
    troca('item: dano -> penMag (3135) quando o chefe passa de 60%', (S) => S.bossPct < 0.60, pos(4, alt.itemPen), 'vida do chefe < 60%'),
    troca('item: dano -> RM (3173 nao-bota) quando carrega o sopro', (S) => S.carregando === 'sopro', pos(4, alt.itemRm), 'mecanica (carrega)'),
    troca('item: dano -> RM quando carrega a chuva', (S) => S.carregando === 'chuva', pos(4, alt.itemRm), 'mecanica (carrega)'),
    troca('item: dano -> dano quando o Dragao ruge', (S) => S.carregando === 'rugido', pos(4, alt.itemDano), 'mecanica (rugido)'),

    // ---- trocar a BARRA (motor.js:2834/2841) ----
    ...alt.barras.map((b) => barra('barra: ' + JSON.stringify(BARRA_REAL) + ' -> ' + JSON.stringify(b.barra),
      (S) => S.t === 0, b.barra, 'arranque', false)),
    // barras alternativas sem trocar de posicao (mesma barra, para ver o custo do clique)
    // ---- trocar a BARRA para habilidades que o dono NAO tem (rank 0): motola um ponto ----
    barra('barra -> [Q,F,R,M] (M = Execucao Noxiana, rank 0)', (S) => S.t === 0, ['Q', 'F', 'R', 'M'], 'arranque', true),
    barra('barra -> [Q,F,R,T] (T = Chuva de Adagas, area, rank 0)', (S) => S.t === 0, ['Q', 'F', 'R', 'T'], 'arranque', true),
    barra('barra -> [Q,F,R,B] (B = Passo das Sombras, rank 0)', (S) => S.hpPct < 0.55, ['Q', 'F', 'R', 'B'], 'vida < 55%', true),
  ];
  return casos;
}

// =============================================================================================
// 5) MAIN
// =============================================================================================
function main() {
  L('');
  L('################ TROCAR ITENS E HABILIDADES EM COMBATE — DRAGAO INFERNAL ################');
  L('');
  L('FONTE: docs/game-src/motor.js + docs/game-src/itens.js. Cada numero com file:linha.');
  L('');
  L('--- O BOSS (o 2.o mais forte) ---');
  L('  Dragao Infernal: MONSTROS hp=12 ad=3 as=0.55 armadura=1.6 chefe=true magico=true   [motor.js:296]');
  L('  Arauto hp=10 [motor.js:295]  |  Barao hp=16 [motor.js:297]  -> 12 fica no meio: 2.o');
  L('  Fosso do Dragao: faixa [30,40], nm=[30,38], tier 6, SEM a flag arena   [motor.js:369]');
  L('  Nivel do chefe: max(nm0+2, min(nm1+2, nivel+4)) = max(32, min(40, 33)) = ' + DRAGAO_NIVEL + '   [motor.js:1121]');
  L('  Jogador nv' + NIVEL + ' -> difNivel = ' + difNivel(NIVEL, DRAGAO_NIVEL) + ' (<= 4: sem ajuste)   [motor.js:1184-1185]');
  L('  hpMax = CURVA.hp(' + DRAGAO_NIVEL + ')*12 = ' + nf(BOSS.hpMax) + '   [motor.js:274+296]');
  L('  ad    = CURVA.ad(' + DRAGAO_NIVEL + ')*3   = ' + nf(BOSS.ad) + '   [motor.js:275+296]');
  L('  armadura = CURVA.armadura(' + DRAGAO_NIVEL + ')*1.6 = ' + BOSS.armadura.toFixed(1) + '   [motor.js:276+296]');
  L('  fatorDanoMonstro=' + fatorDanoMonstro(NIVEL, DRAGAO_NIVEL).toFixed(2) + '  fatorDanoJogador=' + fatorDanoJogador(NIVEL, DRAGAO_NIVEL).toFixed(2) + '   [motor.js:1186-1187]');
  L('  Rodizio: sopro(1.0s de aviso, 9s, mag 2.2x + queima 4s de 3% da vidaMax/s)   [motor.js:3073/3080/3105]');
  L('           chuva(1.1s de aviso, 9s, mag 1.8x + queima 3s de 2,5%/s)             [motor.js:3074/3106]');
  L('           rugido(0.8s de aviso, 7s, SEM dano: +50% de vel. de ataque por 5s)   [motor.js:3075/3107]');
  L('  ataque basico a cada 1/as = ' + (1 / BOSS.as).toFixed(2) + 's, MAGICO (mitiga na RM)   [motor.js:296+1725-1737]');
  L('  a queimadura NAO leva o fator de nivel nem a esquiva   [motor.js:1360 receberDano(...,true)]');
  L('');
  L('--- O JOGADOR ---');
  L('  Katarina nv' + NIVEL + ', atributos MEDIDOS: ' + JSON.stringify(ATRIB));
  L('  Katarina: magia=true, semMana=true, papel {dano:1.2, recebido:0.75}   [motor.js:884-885]');
  L('  NAO e arena -> recebido=0.75 (nao o recebidoArena=1)   [motor.js:2697 + 885]');
  L('  Forca -> AP: 2 por ponto   [motor.js:503]');
  L('  Trocas modeladas com custo de ' + CUSTO_TROCA + 's por troca (cliques do jogador).');
  L('');

  // ---- 5.1 o defeito do critico no proc ----
  L('--- 0) DEFEITO ENCONTRADO NO CAMINHO (a procurar a build, nao a resposta) ---');
  const ADbuild = ['3172', '3153', '3031', '3036', '3046'];
  const aAD = analisar(ADbuild, { ranks: RANKS });
  L('  Com a build AD/crit ' + ADbuild.map(nome).join(' + ') + ':');
  L('    auto (MODELO SIM-CHEFES, proc x critico) = ' + nf(aAD.det.auto) + ' dps');
  L('    auto (MODELO CORRIGIDO, proc sem critico) = ' + nf(aAD.detCorr.auto) + ' dps');
  L('    total: ' + nf(aAD.total) + ' -> ' + nf(aAD.totalCorr) + ' dps  (o proc do 3153 vale ' +
    nf(aAD.det.auto - aAD.detCorr.auto) + ' dps dos ' + nf(aAD.det.auto) + ')');
  L('  Causa: motor.js:1702 mete o proc do 3153 no bruto do golpe basico e motor.js:1700 aplica-lhe');
  L('  o critico; tools/sim-chefes.mjs:570/572 reproduzem-no. NAO corrigi o sim-chefes (outro');
  L('  escritor) — reporto-o. Os quadros abaixo correm com o MODELO CORRIGIDO.');
  L('  >>> PRECISA DE REGRA DO DONO: o proc do 3153 DEVE levar critico? Se deve, e exploit de');
  L('      AD/crit na Katarina; se nao deve, motor.js:1700/1702 tem de separar o proc do bruto.');
  L('');

  // ---- 5.2 a build do dono ----
  L('--- 1) A BUILD DO DONO (docs/snapshots/dps.json) ---');
  const donoCorr = lutarComTrocas(DONO, [], { estrategia: smartCarga({ pisoPct: 0.65 }), corrigido: true });
  const donoBug = lutarComTrocas(DONO, [], { estrategia: smartCarga({ pisoPct: 0.65 }), corrigido: false });
  L('  MEDIDO no jogo: estT=' + DONO_MEDIDO.estT + 's | realT=' + DONO_MEDIDO.realT + 's | realPot=' + DONO_MEDIDO.realPot + ' | estPot=' + DONO_MEDIDO.estPot);
  L('  SIMULADO aqui:  ' + linhaT(tuplaDe(donoCorr, DONO)));
  L('  (o modelo do sim-chefes nao usa crit nesta build, logo os 2 modelos coincidem aqui: ' +
    (Math.abs(donoBug.dps - donoCorr.dps) < 0.01 ? 'SIM' : 'NAO') + ')');
  L('  >>> O SIMULADOR ERRA O TEMPO EM ' + (100 * (donoCorr.tempoMatar / DONO_MEDIDO.realT - 1)).toFixed(0) + '% para a build do dono.');
  L('      E o mesmo erro de sempre (docs/sim-baron.md): o modelo e mais generoso que o jogo real.');
  L('      Uso-o para COMPARAR builds entre si, nao para prometer segundos absolutos.');
  L('');

  // ---- 5.3 a melhor build: o que o modelo diz ----
  L('--- 2) A MELHOR BUILD (busca exaustiva do sim-chefes, avaliada pela TUPLA do dono) ---');
  const cands = melhoresBuilds(CAMPEOES, NIVEL, BOSS, { atrib: ATRIB, ranks: RANKS, shortlist: 16 });
  const aval = cands.slice(0, 10).map((b) => ({ ids: b.ids, r: lutarComTrocas(b.ids, [], { estrategia: smartCarga({ pisoPct: 0.65 }), corrigido: true }) }))
    .map((x) => ({ ...x, t: tuplaDe(x.r, x.ids) }));
  aval.sort((a, b) => (a.t.mata !== b.t.mata ? (a.t.mata ? -1 : 1) : (a.t.mata ? a.t.seg - b.t.seg : b.t.t - a.t.t)));
  for (const x of aval.slice(0, 5)) {
    L('  ' + linhaT(x.t));
    L('        ' + x.ids.map((v) => nome(v) + (v !== baseId(v) ? ' [' + v + ']' : '')).join(' + '));
  }
  const MELHOR = aval[0].ids, MELHOR_T = aval[0].t;
  L('');
  L('  >>> a melhor build do catalogo usa AD/crit na Katarina, e o motor PERMITE: para os campeoes de');
  L('      magia o golpe de habilidade e forcado a magico (motor.js:1201) e a defesa que ele usa e');
  L('      armadura * 0.6 (motor.js:1202 RM_MONSTRO), nao a RM do jogador — logo o AP e o AD batem na');
  L('      MESMA defesa e o AD/crit ganha pelo auto-ataque (crit x2,15 com o 3031, motor.js:515).');
  L('');

  // ---- 5.4 A LUTA SEM TROCAS ----
  L('--- 3) A LUTA SEM TROCAS (baseline) ---');
  L('  melhor build (catalogo): ' + linhaT(MELHOR_T));
  L('  build do dono:           ' + linhaT(tuplaDe(donoCorr, DONO)));
  L('');

  // ---- 5.5 as trocas ----
  // A mochila do dono (docs/snapshots/bag.json + o catalogo de itens.js para os que faltam)
  const donoBag = {
    botas: ['3175~A', '3173~A', '3171+2~B', '3020', '3047', '1001'],
    outros: ['3089+2~B', '3100+3~A', '3135~A', '4629+3~A', '4645+2~A', '664644~A', '3157~C',
             '3075~A', '3075~C', '3108~A', '3153', '3072', '3074', '3172', '3083', '3065', '3165',
             '6653', '3116', '3003', '3102', '3089', '3157', '3085', '3031', '3036', '6631', '3078'],
  };
  const temDono = (x) => donoBag.botas.includes(x) || donoBag.outros.includes(x);
  // a melhor build de MAGO que o dono JA TEM (4 itens com ap>0 + bota), pelos ranks REAIS
  const apDono = donoBag.outros.filter((x) => (ITENS[baseId(x)].ap || 0) > 0);
  let melhorDono = null;
  for (const bt of donoBag.botas) {
    for (let a = 0; a < apDono.length; a++) for (let b = a + 1; b < apDono.length; b++)
      for (let c = b + 1; c < apDono.length; c++) for (let d = c + 1; d < apDono.length; d++) {
        const ids = [bt, apDono[a], apDono[b], apDono[c], apDono[d]];
        if (new Set(ids.map(baseId)).size < 5) continue;
        const A = analisar(ids, { ranks: RANKS_REAL });
        if (!melhorDono || A.totalCorr > melhorDono.v) melhorDono = { ids, v: A.totalCorr };
      }
  }
  L('--- 4) A MELHOR BUILD QUE O DONO JA TEM NA MOCHILA (familia de mago, ranks REAIS) ---');
  const BASE = melhorDono.ids;
  const OPTS = { estrategia: smartCarga({ pisoPct: 0.65 }), ranks: RANKS_REAL };
  const baseR = lutarComTrocas(BASE, [], OPTS);
  const baseT = tuplaDe(baseR, BASE);
  L('  ' + linhaT(baseT));
  L('        ' + BASE.map((v) => nome(v) + ' [' + v + ']').join(' + '));
  L('  ranks usados: ' + JSON.stringify(RANKS_REAL) + '   [docs/snapshots/skills.json]');
  L('  pontos de habilidade LIVRES: ' + PONTOS_LIVRES + '   [motor.js:1048: pontos = nivel - ranks gastos = 29-24]');
  L('  barra actual: ' + JSON.stringify(BARRA_REAL) + '   [docs/snapshots/skills.json]');
  L('  >>> T, B, M e N estao com rank 0 (nao aprendidas). Trocar a barra para elas EXIGE 1 ponto');
  L('      (motor.js:2813 subirHabilidade -> motor.js:2817 mete-a na barra se houver espaco).');
  L('      O dono tem ' + PONTOS_LIVRES + ' pontos livre' + (PONTOS_LIVRES === 1 ? '' : 's') + ': da para aprender 3.');
  L('');

  // ---- 4b) A PERGUNTA DO DONO: o MESMO set de habilidades, build MELHOR? ----
  L('--- 4b) "A MESMA BUILD, SO A BOTA TROCADA" — a resposta directa a pergunta do dono ---');
  L('  O dono joga hoje com:      ' + DONO.map((v) => nome(v) + ' [' + v + ']').join(' + '));
  L('  A melhor mochila dele e:   ' + BASE.map((v) => nome(v) + ' [' + v + ']').join(' + '));
  const soBota = DONO.filter((v, i) => v === BASE[i]).length;
  L('  >>> OS 4 ITENS SAO OS MESMOS (' + soBota + '/5 iguais). A UNICA diferenca e a BOTA:');
  L('      ' + nome(DONO[0]) + ' (' + DONO[0] + ')  ->  ' + nome(BASE[0]) + ' (' + BASE[0] + ')');
  // motor.js:251-255 escala ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr — e NAO o penMag
  // (docs/audit-itens.md e a regra do AGENTS.md): o penMag da bota fica 15% seja qual for a qualidade.
  const penDe = (x) => ITENS[baseId(x)].penMag || 0;
  const iDono = infoItem(DONO[0]), iBase = infoItem(BASE[0]);
  L('  Numeros da bota (itens.js; motor.js:251-255 escala o ap/cdr/vida/mana e NAO o penMag):');
  L('      ' + DONO[0] + ': ap=' + (+iDono.ap).toFixed(1) + ', penMag=' + (100 * penDe(DONO[0])).toFixed(0) + '%, cdr=' + (+iDono.cdr).toFixed(3) + ', vida=' + (+iDono.vida).toFixed(0) + ', mana=' + (+iDono.mana).toFixed(0));
  L('      ' + BASE[0] + ': ap=' + (+iBase.ap).toFixed(1) + ', penMag=' + (100 * penDe(BASE[0])).toFixed(0) + '%, cdr=' + (+iBase.cdr).toFixed(3) + ' (base ' + ITENS[baseId(BASE[0])].cdr + ' x (1+0,12x' + refinoDe(BASE[0]) + ')), vida=' + (+iBase.vida).toFixed(0) + ', mana=' + (+iBase.mana).toFixed(0));
  const stD = analisar(DONO, { ranks: RANKS_REAL }), stB = analisar(BASE, { ranks: RANKS_REAL });
  L('  Efeito no jogador:');
  L('      com ' + nome(DONO[0]) + ': AP=' + stD.st.ap.toFixed(0) + ', reducaoRecarga=' + (100 * stD.st.reducaoRecarga).toFixed(1) + '%, penMagica=' + (100 * stD.st.penMagica).toFixed(0) + '% -> dps ' + stD.totalCorr.toFixed(0));
  L('      com ' + nome(BASE[0]) + ': AP=' + stB.st.ap.toFixed(0) + ', reducaoRecarga=' + (100 * stB.st.reducaoRecarga).toFixed(1) + '%, penMagica=' + (100 * stB.st.penMagica).toFixed(0) + '% -> dps ' + stB.totalCorr.toFixed(0));
  const rD = lutarComTrocas(DONO, [], OPTS), rB = lutarComTrocas(BASE, [], OPTS);
  L('  LUTA (mesmo set de habilidades, mesmos 4 itens):');
  L('      ' + linhaT(tuplaDe(rD, DONO)) + '   <- o que o dono joga');
  L('      ' + linhaT(tuplaDe(rB, BASE)) + '   <- so com a outra bota');
  const ganho = (tuplaDe(rD, DONO).seg - tuplaDe(rB, BASE).seg);
  L('  >>> GANHO SO POR TROCAR A BOTA: ' + ganho.toFixed(2) + 's e ' + (tuplaDe(rD, DONO).pocoes - tuplaDe(rB, BASE).pocoes) + ' pocoes.');
  L('      E a mesma coisa na MEDIDA do jogo: o dono levou ' + DONO_MEDIDO.realT + 's com esta bota (docs/snapshots/dps.json).');
  L('      Porque e que o CDR ganha a penMag aqui: a Katarina e de MAGIA (motor.js:884), logo todo o');
  L('      dano dela (menos o auto-ataque) e forcado a magico (motor.js:1201) e defende-se com');
  L('      armadura*0,6 (motor.js:1202). A ' + nome(DONO[0]) + ' da mais ' + (iDono.ap - iBase.ap).toFixed(0) + ' de AP, mas a ' + nome(BASE[0]) + '');
  L('      da mais CDR — e o CDR encolhe a recarga do Q (rank 10) e da A (motor.js:738/752), que');
  L('      sao a maior parte do DPS dela. Os 15% de penMag da outra valem menos que ' + (100 * (iBase.cdr - 0)).toFixed(0) + '% de CDR.');
  L('      (o penMag a mais nao se sobrepoe: motor.js:529 soma os dois, com tecto de 60%.)');
  L('');

  // alternativas: SO o que o dono tem (ou o catalogo do jogo, quando o dono nao tem e pode comprar)
  const alt = {
    botaPen: temDono('3175~A') ? '3175~A' : '3175',
    botaCdr: temDono('3171+2~B') ? '3171+2~B' : '3171',
    botaRm: temDono('3173~A') ? '3173~A' : '3173',
    itemRv: temDono('3153') ? '3153' : '3153', itemCura: temDono('3065') ? '3065' : '3065',
    item3072: temDono('3072') ? '3072' : '3072', itemVida: temDono('3083') ? '3083' : '3083',
    itemZhonya: temDono('3157~C') ? '3157~C' : '3157', itemPen: temDono('3135~A') ? '3135~A' : '3135',
    itemRm: temDono('3173~A') ? '3173~A' : '3173', itemDano: temDono('3089+2~B') ? '3089+2~B' : '3089',
    // barras alternativas: as primeiras 3 nao precisam de ponto; T, B e M precisam de 1
    barras: [
      { barra: ['Q', 'E', 'R', 'A'], nota: 'E em vez de W (E = Shunpo, ja tem rank 3)' },
      { barra: ['W', 'E', 'R', 'A'], nota: 'sem o Q (so adagas: W+E giram)' },
      { barra: ['E', 'G', 'R', 'A'], nota: 'sem W nem Q (menos adagas no chao)' },
      { barra: ['G', 'F', 'R', 'A'], nota: 'so Sede + Veneno (nenhuma adaga: ZERO giro)' },
      { barra: ['Q', 'F', 'R', 'A'], nota: 'Veneno em vez de W' },
    ],
  };
  const casos = casosDeUso(BASE, alt);
  L('--- 5) TODOS OS CASOS DE USO DE TROCA (a luta corrida, uma a uma, ranks REAIS) ---');
  const resultados = [];
  for (const cs of casos) {
    const r = lutarComTrocas(BASE, [cs], OPTS);
    const t = tuplaDe(r, cs.itens);
    const rSem = lutarComTrocas(cs.itens, [], OPTS);
    const tSem = tuplaDe(rSem, cs.itens);
    const disparou = r.nTrocas > 0;
    resultados.push({ ...cs, t, tSem, r, rSem, disparou,
      dSeg: (t.mata && baseT.mata) ? baseT.seg - t.seg : null,
      dSegVsAlt: (t.mata && tSem.mata) ? tSem.seg - t.seg : null,
      dPoc: t.pocoes - baseT.pocoes, dOuro: t.ouroTotal - baseT.ouroTotal,
      mesma: cs.itens.join() === BASE.join(), precisaPonto: !!cs.precisaPonto });
  }
  for (const x of resultados) {
    L('  [' + x.gatilho + '] ' + x.rotulo + (x.precisaPonto ? '   [PRECISA 1 PUNTO DE HABILIDADE]' : ''));
    L('     com troca: ' + linhaT(x.t) + '   (disparou: ' + (x.disparou ? 'SIM' : 'NAO') + ', custo ' + x.t.custoTroca + 's)');
    if (x.disparou) for (const e of x.r.log) L('        troca em t=' + e.t + 's -> dps ' + e.dps + ', rv=' + (e.rv != null ? e.rv : '') + ', penMag=' + (e.penMag != null ? e.penMag : '') + (e.barra ? ', barra=' + e.barra : ''));
    L('     alternativa desde o inicio: ' + linhaT(x.tSem));
    const g = x.dSeg == null ? 'n/a' : (x.dSeg > 0 ? '+' : '') + x.dSeg.toFixed(2) + 's';
    L('     vs BASE: ' + g + ' | pocoes ' + (x.dPoc > 0 ? '+' : '') + x.dPoc + ' | ouro ' + (x.dOuro > 0 ? '+' : '') + nf(x.dOuro) + 'g'
      + (x.dSegVsAlt != null ? '   | vs alternativa desde o inicio: ' + (x.dSegVsAlt > 0 ? '+' : '') + x.dSegVsAlt.toFixed(2) + 's' : ''));
    L('');
  }

  // ---- 5.6 a tabela final ----
  L('--- 6) TABELA FINAL (ordenada por ganho vs a BASE; quem nao dispara / nao ganha fica no fim) ---');
  L('  CASO DE USO | GATILHO | TROCA | GANHO (seg/poc/ouro) | CUSTO | VALE A PENA?');
  const ordenado = resultados.slice().sort((a, b) => {
    if (a.disparou !== b.disparou) return a.disparou ? -1 : 1;
    if (a.disparou && b.disparou) {
      const ga = a.dSeg == null ? -1e9 : a.dSeg, gb = b.dSeg == null ? -1e9 : b.dSeg;
      if (gb !== ga) return gb - ga;
      return a.dPoc - b.dPoc;
    }
    return 0;
  });
  for (const x of ordenado) {
    const troca = x.barra
      ? '[' + x.barra.join(',') + ']'
      : nome(x.itens.find((v, i) => v !== BASE[i]) || x.itens[0]);
    const ganho = (x.dSeg == null ? 'n/a' : (x.dSeg >= 0 ? '+' : '') + x.dSeg.toFixed(2) + 's') + ' / ' +
      (x.dPoc >= 0 ? '+' : '') + x.dPoc + ' poc / ' + (x.dOuro >= 0 ? '+' : '') + nf(x.dOuro) + 'g';
    const custo = x.t.nTrocas * CUSTO_TROCA + 's (' + x.t.nTrocas + 'x)';
    const liquido = x.dSeg == null ? -1e9 : x.dSeg - x.t.nTrocas * CUSTO_TROCA;
    const vale = !x.disparou ? 'NAO (o gatilho nao dispara)' : (liquido > 0 ? 'SIM' : (x.dPoc < 0 || x.dOuro < -50 ? 'TALVEZ (poupanca)' : 'NAO'));
    L('  ' + x.rotulo.slice(0, 54).padEnd(54) + ' | ' + x.gatilho.slice(0, 18).padEnd(18) + ' | ' + String(troca).slice(0, 22).padEnd(22) + ' | ' + ganho.padEnd(30) + ' | ' + custo.padEnd(10) + ' | ' + vale);
  }
  L('');

  // ---- 5.7 o veredicto ----
  L('--- 7) A TROCA EM COMBATE COMPENSA? ---');
  const ganham = ordenado.filter((x) => x.dSeg != null && x.dSeg > x.t.nTrocas * CUSTO_TROCA);
  const poupam = ordenado.filter((x) => x.dOuro < -50 || x.dPoc < 0);
  L('  Onde COMPENSA (ganha mais segundos do que o custo da troca):');
  if (!ganham.length) L('    NENHUM caso. Nesta luta o custo de ' + CUSTO_TROCA + 's por troca e maior que o ganho.');
  for (const x of ganham) L('    + ' + x.rotulo + '  ->  ' + x.dSeg.toFixed(2) + 's ganhos vs ' + (x.t.nTrocas * CUSTO_TROCA) + 's de custo');
  L('  Onde POUPA ouro/pocoes (mesmo sem ganhar segundos):');
  if (!poupam.length) L('    NENHUM caso.');
  for (const x of poupam) L('    - ' + x.rotulo + '  ->  ' + (x.dPoc > 0 ? '+' : '') + x.dPoc + ' pocoes, ' + (x.dOuro > 0 ? '+' : '') + nf(x.dOuro) + 'g');
  L('');
  L('  REGRA QUE SAI DESTA LUTA: o Dragao Infernal nao tem fase que justifique a troca. Ele e UM alvo');
  L('  do primeiro ao ultimo segundo, o dano dele e quase todo magico e constante, e a melhor build');
  L('  de mago ja o mata sem pocoes. Nao ha "fase" — logo nao ha gatilho que pague os cliques.');
  L('');
  L('  ONDE A TROCA COMPENSARIA (e isto e o que o codigo permite, com o numero de cada caso):');
  L('   1. BARRA CHEIA COM HABILIDADES NOVAS: motor.js:2826-2827 — o jogo aprende o rank 1 das');
  L('      habilidades novas MESMO com a barra cheia "para a habilidade ficar disponivel para troca".');
  L('      A troca de barra e o unico uso que o proprio motor documenta.');
  L('   2. CHEFE COM INVOCACAO — o Barao: motor.js:3117-3120 invoca 2 larvas, mas isso e SO');
  L('      1 dos 3 do rodizio (motor.js:3080). O ciclo inteiro e:');
  L('        invocar (carrega 0, espera 14) + tentaculos (1,3 + 9) + acido (1,0 + 9) = 34,3 s');
  L('        [motor.js:3076-3078 + motor.js:3080]');
  L('      Logo as larvas vem a cada 34,3 s, NAO a cada 14. Ai ha mesmo "o que esta em campo" e uma');
  L('      barra de area passa a valer. O Dragao NAO invoca nada (motor.js:3080: so sopro/chuva/rugido).');
  L('   3. SEGUNDO ALVO EM CAMPO: no Fosso do Dragao os filhotes coexistem (motor.js:370), mas o');
  L('      chefe aparece sozinho na invocacao dele (motor.js:1121).');
  L('   4. PVP/Runeterra: motor.js:3056 emCombate existe para nao fugir da luta; trocar item');
  L('      continua permitido (nao ha guarda) — mas o dono proibiu testar em jogo.');
  L('');
  L('--- 8) O QUE NAO CONSEGUI VERIFICAR ---');
  L('  1. Se o custo real de uma troca e 1,0s ou 4,25s (jogo.js:6000-6008 + quadro() a 60/s).');
  L('     PRECISA DE MEDICAO NO JOGO (o dono proibiu jogar nesta sessao).');
  L('  2. Se o proc do 3153 DEVE levar critico (motor.js:1700 vs 1702). PRECISA DE REGRA DO DONO.');
  L('  3. O erro absoluto do simulador para a build do dono: sim ' + donoCorr.tempoMatar + 's vs real ' +
    DONO_MEDIDO.realT + 's. A comparacao entre builds e valida; os segundos absolutos nao.');
  L('  4. A BASE_CAMPEAO da Katarina no sim-chefes e "CALIBRADO NAO VERIFICADO (1 ponto medido)"');
  L('     (sim-chefes.mjs:352-353): os dados-katarina.js nao existem em docs/game-src.');
  L('');
  return { BASE, baseT, resultados, ordenado, MELHOR, MELHOR_T, DONO };
}

const R = main();
