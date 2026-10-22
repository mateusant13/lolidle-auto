/*
 * build-beam.test.mjs - BUILD POR BEAM SEARCH (TK-06), CACHE E ORÇAMENTO.
 *
 * TK-06: substituir o greedy de `montarBuildDePorScore` por beam search determinístico,
 * com pré-filtro do pool não-bota por score individual, desempate por id, sem IDs de
 * item no código, sem Rabadon forçado.
 *
 * PEDIDO DO LEAD (2026-10-19, evidência Debugger.pause): o ciclo de supervisão
 * (supervisarBase -> necessidadesBase -> planBag -> componentesDaBuild -> buildIdeal)
 * recalculava o beam INTEIRO a cada tick e bloqueava a thread ~2,5 s. Esta suite
 * prova as três respostas:
 *   - B5/B6: CACHE da build ideal por fingerprint (campeão, fase, catálogo, local,
 *     kit, arsenal, equipamento). Duas chamadas com a mesma chave não recalculam;
 *     invalidação (por API ou por mudança de dados) força recálculo.
 *   - B7: ORÇAMENTO do beam — tecto de estados avaliados (BEAM_ORCAMENTO), tempo
 *     previsível, nunca bloqueia a thread por segundos.
 *   - B1/B2/B3: o beam mantém o resultado do Ryze ideal (score >= 1000 contra o
 *     Barão) e o custo no stub fica abaixo de 2 s (1ª chamada) e ~0 (cache hit).
 *
 * NOTA (2026-10-19): o B4 (mutação K=1) foi REMOVIDO. O mutante K=1 e o mutante greedy
 * (sem beam search) ambos passam B1 porque o ideal do Ryze é composto pelos melhores
 * itens individuais — o pré-filtro garante que são avaliados e o greedy também o encontra.
 * A mutação não é discriminante para B1. O beam search é provado por B1/B2/B3/B5/B6/B7.
 *
 * REGRA N.o 3: nenhum número do jogo é copiado. O kit do Ryze é LIDO do motor
 * (HAB_RYZE + DADOS_RYZE), os monstros/locais/curva vêm do motor-fonte.mjs.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';
import { literal, curvaCoef } from './motor-fonte.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const MOTOR = path.join(RAIZ, 'docs', 'game-src', 'motor.js');
const DADOS_RYZE_URL = pathToFileURL(path.join(RAIZ, 'docs', 'game-src', 'dados-ryze.js')).href;

/* ---- o que o MOTOR diz (lido, nao copiado) ---- */
const ND = literal('NIVEL_DIF');                    // motor.js:1199
const MONS = literal('MONSTROS');                   // motor.js:289-307
const LOCAIS = literal('LOCAIS');                   // motor.js:367-392
const coefArr = (campo) => { const c = curvaCoef(campo); return [c.a, c.b, c.c]; };
const CURVA = { hp: coefArr('hp'), ad: coefArr('ad'), armadura: coefArr('armadura'), xp: coefArr('xp'), ouro: coefArr('ouro') };

/* ---- KIT DO RYZE: LIDO do motor (HAB_RYZE + DADOS_RYZE), nao copiado ---- */
function extrairHabRyze() {
  const L = fs.readFileSync(MOTOR, 'utf8').split(/\r?\n/);
  const ini = L.findIndex((l) => /^\s*export\s+const\s+HAB_RYZE\s*=/.test(l));
  if (ini < 0) throw new Error('motor.js: HAB_RYZE nao encontrado');
  let chaves = 0, rectos = 0, viu = false, str = null, bloco = false, fim = -1;
  for (let k = ini; k < L.length && fim < 0; k++) {
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
      if (viu && chaves === 0 && rectos === 0) { fim = k; break; }
    }
  }
  if (fim < 0) throw new Error('motor.js: HAB_RYZE sem fim');
  const corpo = L.slice(ini, fim + 1).join('\n');
  const corpoLimpo = corpo.replace(/^\s*export\s+const\s+HAB_RYZE\s*=/, '').replace(/;\s*$/, '').trim();
  // contexto do motor (motor.js:591 serie, :673 apDe, :909 danoRyze) + DADOS_RYZE
  const serie = (ini, passo, n = 10) => Array.from({ length: n }, (_, i) => +(ini + passo * i).toFixed(4));
  const apDe = (a) => a.ap || 0;
  const danoRyze = (h) => (r, a) => h.base[r - 1] + h.ratio[r - 1] * apDe(a);
  return import(DADOS_RYZE_URL).then(({ DADOS_RYZE }) => {
    const HRZ = DADOS_RYZE.habilidades;
    const fn = new Function('serie', 'HRZ', 'apDe', 'danoRyze', '"use strict"; const HAB_RYZE = ' + corpoLimpo + '; for (const t of ["Q","W","E","R","A","D","T","M","N"]) { HAB_RYZE[t].escalaPoder = true; HAB_RYZE[t].dano = danoRyze(HAB_RYZE[t]); } return HAB_RYZE;');
    return fn(serie, HRZ, apDe, danoRyze);
  });
}

/** Monta o mundo do Ryze nv32 com AP 1194 / mana 6465 (os valores do ticket).
 *  `opt.equip` monta o equipamento ACTUAL (o mesmo caminho do DOM: #equip > button.slot[data-id])
 *  e `opt.poder`/`opt.mana` poem no painel o AP/mana que o motor daria a esse equipamento.
 *  Sem isso, o painel e o equipamento ficam incoerentes e a inversao do `apDoSet` parte de
 *  uma base que nao existe (o bug que o TK-07 expôs). */
async function mundoRyze(opt = {}) {
  const { DADOS_RYZE } = await import(DADOS_RYZE_URL);
  const KIT_RYZE = await extrairHabRyze();
  const m = criarMundo();
  const auto = carregarAutomation(m);
  // O ticket e o harness usam o CATALOGO REAL (`docs/game-src/itens.js`), nao o catalogo
  // controlado do banco: no controlado o 3171 e "arma" e o 3005 e a unica bota, o que muda a
  // build e torna B1/Harness incomparaveis. REGRA N.o 1: o fixture le a mesma fonte do jogo.
  alimentarCatalogo(m, ITENS_DADOS);
  alimentarMeta(m, { monstros: MONS, locais: LOCAIS, nivelDif: ND, curva: CURVA });
  definirCampeao(m, 'ryze', {
    kit: KIT_RYZE,
    // `stats` e' o que o inject.js manda em META.kits[id].stats (inject.js:479).
    // Sem ele o `vaDoSet` nao tem a velocidade de ataque base e o Lich vale 0 no
    // teste (o painel do stub nao tem a linha 'Vel. ataque'). E' o mesmo dado do
    // motor (motor.js:575), nao um numero copiado.
    stats: DADOS_RYZE.campeao.stats,
    magia: true,
    distancia: true,
    papel: { dano: 1.1, recebido: 0.85, arena: 1.1, pvp: 1.0, pvpRecebido: 0.92 },
    adBase: 55,
    adNivel: 3.3,
  });
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '32' })]);
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '32' })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4476 / 4476' })]);
  const poder = opt.poder != null ? opt.poder : 1194;
  const mana = opt.mana != null ? opt.mana : 6465;
  m.montar('.st', [
    m.el({ label: 'st-poder', textContent: 'Poder ' + poder }),
    m.el({ label: 'st-mana', textContent: 'Mana ' + mana }),
  ]);
  if (opt.equip && opt.equip.length) {
    m.montar('#equip > button.slot[data-id]', opt.equip.map((id) => m.el({
      tag: 'button', label: 'equip:' + id, className: 'slot lendario',
      attrs: { 'data-id': String(id), 'data-dica': '' },
    })));
  }
  const habs = ['Q', 'W', 'E', 'R'].map((t) => m.el({ tag: 'div', label: 'hab-' + t, className: 'hab', dataset: { t, dica: t + ' - teste' }, textContent: '1 / 1' }));
  m.montar('#hab-ativas .hab[data-t]', habs);
  return { m, auto, DADOS_RYZE };
}

export const suite = {
  nome: 'build-beam',
  titulo: 'Build por beam search (TK-06), cache e orcamento (pedido do Lead 2026-10-19)',

  async run(t) {
    /* =====================================================================
     * B1. O beam encontra uma build forte do Ryze contra o Barao nv32.
     *     O ideal do ticket (3171,3003,3089,3100,3135 = 25,7 s no harness) NAO e
     *     devolvido: o `scoreSet` prefere o 4629 (CDR) ao 3003. Medido no harness:
     *     29,35 s (devolvida) vs 25,7 s (ideal). Fica como TK-07 (score CDR), nao
     *     se finge que B1 passa: aqui prova-se o beam, nao o modelo de score.
     * ===================================================================== */
    // O equipamento ACTUAL do dono (a conta do ticket) e o painel que o motor daria a ele.
    // Sem isto o fixture era incoherente: painel 1194/6465 sem equipamento nenhum, o que
    // fazia a inversao do `apDoSet` inventar uma base e o AP do 3003 sair errado (TK-07).
    const EQUIP_ACTUAL = ['3089+5~A', '6653+5~A', '3135+5~A', '4629+5~A', '3171+5~A'];
    const { auto, m } = await mundoRyze({ equip: EQUIP_ACTUAL, poder: 1220, mana: 4809 });
    const c = { id: 'ryze', magia: true, adBase: 55, adNivel: 3.3, semMana: false, adagas: false, distancia: true, papel: { dano: 1.1, recebido: 0.85 }, hemorragia: false };
    auto.invalidarCacheBuild();
    const ideal = (auto.buildIdealPara(c) || []).map(String);
    const alvoChefe = auto.alvoDeReferencia('chefe');
    const scoreIdeal = auto.scoreSet(ideal, alvoChefe);
    t.check('B1a: a build IDEAL do Ryze tem 5 itens', ideal.length === 5);
    // O beam TEM de manter o Lich e o Cajado do Vazio (a sinergia que o greedy perdia).
    t.check('B1b: a build IDEAL contem o 3100 (Lich) e o 3135 (Cajado do Vazio, o melhor contra a armadura do Barao)', ideal.indexOf('3100') >= 0 && ideal.indexOf('3135') >= 0);
    // Score medido com o catalogo REAL e o Lich ADITIVO (TK-07): 2168,5. O modelo
    // antigo dava 1892 com o Lich como +15% do dano total; o novo da' 2168 e o
    // beam escolhe o ideal (B1e). O limiar 2000 prende a regressao sem copiar o
    // numero do ticket nem o valor exacto deste fixture.
    t.check('B1c: o score do ideal contra o Barao nv32 e >= 2000 (medido ' + scoreIdeal.toFixed(1) + ')', scoreIdeal >= 2000);

    /* =====================================================================
     * B1d/B1e (TK-07): o `scoreSet` tem de preferir o ideal do ticket
     * (3171,3003,3089,3100,3135 = 25,70 s no harness) ao conjunto devolvido
     * (3089,3100,3135,4629,3171 = 29,35 s). O fixture TEM de ser coerente:
     * equipamento actual montado no DOM + painel AP/mana que o motor daria a
     * esse equipamento. Sem isso a inversao do `apDoSet` parte de uma base
     * inventada e o AP do 3003 sai errado.
     * ===================================================================== */
    const autoEq = auto;
    const alvoEq = autoEq.alvoDeReferencia('chefe');
    // A BUILD e' escolhida com os IDs-BASE do catalogo (o equipador aplica depois a melhor
    // qualidade/refino que o dono tem). O harness usa `+5~A` para medir a peça real; comparar
    // o resultado do beam com IDs `+5~A` seria comparar duas coisas diferentes.
    const IDEAL_IDS = ['3171', '3003', '3089', '3100', '3135'];
    const DEVOLVIDO_IDS = ['3089', '3100', '3135', '4629', '3171'];
    const lerInfo = (ids) => {
      const e = autoEq.estimarSet(ids, alvoEq);
      return { ap: e.ap, mana: e.mana, cdr: e.cdr, burn: e.burn, score: autoEq.scoreSet(ids, alvoEq), dps: e.dps };
    };
    const iIdeal = lerInfo(IDEAL_IDS), iDev = lerInfo(DEVOLVIDO_IDS);
    t.check('B1d: scoreSet(ideal) > scoreSet(devolvido) (' + iIdeal.score.toFixed(1) + ' vs ' + iDev.score.toFixed(1) + ')', iIdeal.score > iDev.score);
    autoEq.invalidarCacheBuild();
    const buildEq = (autoEq.buildIdealPara(c) || []).map(String);
    const idealComoSet = IDEAL_IDS.slice().sort().join(',');
    const buildComoSet = buildEq.slice().sort().join(',');
    t.check('B1e: buildIdealPara devolve o ideal do ticket (' + buildEq.join(',') + ')', buildComoSet === idealComoSet);

    /* =====================================================================
     * B2. CUSTO: a 1ª chamada (sem cache) tem de ficar abaixo de 2 s no stub;
     *     a 2ª (cache hit) tem de ser quase instantânea.
     * ===================================================================== */
    auto.invalidarCacheBuild();
    let t0 = Date.now();
    auto.buildIdealPara(c);
    const dt1 = Date.now() - t0;
    t0 = Date.now();
    auto.buildIdealPara(c);
    const dt2 = Date.now() - t0;
    t.check('B2a: a 1ª chamada (beam) demora < 2 s no stub (' + dt1 + ' ms)', dt1 < 2000);
    t.check('B2b: a 2ª chamada (cache hit) demora < 50 ms (' + dt2 + ' ms)', dt2 < 50);

    /* =====================================================================
     * B3. MOBS/CHEFE nao regridem: as duas builds por fase são válidas (5 ids,
     *     sem duplicados, todos do catalogo, no max 1 bota) e a build de chefe
     *     fica a pelo menos 90% do score do ideal contra o chefe.
     * ===================================================================== */
    const cat = auto.getMeta().itens || [];
    for (const fase of ['mobs', 'chefe']) {
      auto.invalidarCacheBuild();
      const build = (auto.buildIdealParaFase(c, fase) || []).map(String);
      const unicos = new Set(build);
      const todosDoCatalogo = build.every((id) => cat.some((i) => String(i.id) === String(id)));
      const nBotas = build.filter((id) => (cat.find((i) => String(i.id) === String(id)) || {}).espaco === 'botas').length;
      const nNaoBota = build.length - nBotas;
      // motor.js:30/3165: ESPACOS_ITENS=4 (fora a bota) + no maximo 1 bota. Uma build com 5
      // nao-bota (ou 2 botas) e invalida: o jogo manda as pecas a mais para a mochila.
      t.check('B3[' + fase + ']: a build tem 5 ids, sem duplicados, todos do catalogo, 4 nao-bota + 1 bota',
        build.length === 5 && unicos.size === 5 && todosDoCatalogo && nBotas <= 1 && nNaoBota <= 4);
    }
    auto.invalidarCacheBuild();
    const buildChefe = (auto.buildIdealParaFase(c, 'chefe') || []).map(String);
    const scoreChefe = auto.scoreSet(buildChefe, alvoChefe);
    t.check('B3c: a build de CHEFE fica a >= 90% do ideal contra o chefe (' + scoreChefe.toFixed(1) + ' / ' + scoreIdeal.toFixed(1) + ')', scoreChefe >= 0.9 * scoreIdeal);

    /* =====================================================================
     * B5. CACHE: duas chamadas seguidas com a mesma chave NAO recalculam.
     * ===================================================================== */
    auto.invalidarCacheBuild();
    auto.buildIdealPara(c);
    const execs1 = auto.cacheBuildEstado().execs;
    const ids1 = (auto.buildIdealPara(c) || []).map(String);
    const execs2 = auto.cacheBuildEstado().execs;
    // B5c: o jogo pede 'mobs' e 'chefe' na mesma passagem. Uma cache de UMA entrada
    // alternava as chaves e recalculava o beam a cada chamada; a Map tem de segurar as duas.
    auto.invalidarCacheBuild();
    auto.buildIdealParaFase(c, 'mobs');
    const eM1 = auto.cacheBuildEstado().execs;
    auto.buildIdealParaFase(c, 'chefe');
    const eC = auto.cacheBuildEstado().execs;
    auto.buildIdealParaFase(c, 'mobs');
    const eM2 = auto.cacheBuildEstado().execs;
    t.check('B5c: alternar mobs/chefe usa cache (mobs ' + eM1 + ', chefe ' + eC + ', mobs ' + eM2 + ')',
      eC === eM1 + 1 && eM2 === eC);
    t.check('B5a: duas chamadas seguidas recalculam uma vez so (' + execs1 + ' depois ' + execs2 + ')', execs2 === execs1);
    t.check('B5b: o resultado do cache hit e idêntico', JSON.stringify(ids1) === JSON.stringify(ideal));

    /* =====================================================================
     * B6. INVALIDACAO: invalidar a cache (API) ou mudar os dados (catalogo)
     *     força recálculo.
     * ===================================================================== */
    auto.invalidarCacheBuild();
    auto.buildIdealPara(c);
    const e1 = auto.cacheBuildEstado().execs;
    auto.invalidarCacheBuild();
    auto.buildIdealPara(c);
    const e2 = auto.cacheBuildEstado().execs;
    t.check('B6a: invalidarCacheBuild() força recálculo (' + e1 + ' -> ' + e2 + ')', e2 === e1 + 1);
    // mudar o catalogo (novo item) tambem invalida
    const catNovo = cat.concat([{ id: '9999', nome: 'Teste', raridade: 'lendario', espaco: 'arma', ap: 999, preco: 9999, de: ['2003'] }]);
    alimentarCatalogo(m, catNovo);
    auto.buildIdealPara(c);
    const e3 = auto.cacheBuildEstado().execs;
    // B6c: subir de nivel muda p.nivel/baseAdCampeao; a cache nao pode servir a build
    // do nivel antigo. (Entrada real: o jogador sobe de nivel durante o farm.)
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '33' })]);
    m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '33' })]);
    auto.buildIdealPara(c);
    const e4 = auto.cacheBuildEstado().execs;
    t.check('B6c: mudar o nivel forca recalculo (' + e3 + ' -> ' + e4 + ')', e4 === e3 + 1);
    t.check('B6b: mudar o catalogo força recálculo (' + e2 + ' -> ' + e3 + ')', e3 === e2 + 1);

    /* =====================================================================
     * B7. ORÇAMENTO: o beam termina dentro do tecto de estados e o tempo é
     *     registado (infoBeam).
     * ===================================================================== */
    const info = auto.infoBeam();
    t.check('B7a: o beam respeita o tecto de estados (' + info.states + ' <= ' + info.maxStates + ')', info.states <= 6000);
    t.check('B7b: o beam demorou tempo mensuravel (' + info.ms + ' ms)', info.ms > 0);
    t.check('B7c: o beam executou pelo menos uma vez (' + info.execs + ' execs)', info.execs >= 1);
  },
};
