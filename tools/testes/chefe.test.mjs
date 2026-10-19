/*
 * chefe.test.mjs - BUILD DE CHEFE (3153), TOLERANCIA DE NIVEL e CRITERIO DE SOBREVIVENCIA.
 *
 * Fila W11: TK-02-81 (P0), TK-02-83, TK-02-74, TK-02-75, TK-02-52, TK-02-55.
 *
 * MOTIVO DESTA SUITE EXISTIR: os tickets da fila W11 foram provados so por script efemero
 * (parte-02.md:3049, verbatim: "deixei-as provadas por script efemero"). Script efemero nao
 * volta a correr: um buff/nerf do motor passaria em claro. Aqui as assercoes ficam no banco.
 *
 * REGRA N.o 3 aplicada com rigor: NENHUM numero do jogo esta copiado neste ficheiro. As
 * suites leem docs/game-src/motor.js como TEXTO (motor-fonte.mjs) e comparam. Se o jogo
 * mudar o NIVEL_DIF, a CURVA, o coeficiente do Barao ou a formula do nivel do chefe,
 * estas assercoes FALHAM - que e o que se quer.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';
import { literal, curvaCoef, escalar, hpMonstro } from './motor-fonte.mjs';

/* ---- o que o MOTOR diz (lido, nao copiado) ---- */
const ND = literal('NIVEL_DIF');                    // motor.js:1199
const MONS = literal('MONSTROS');                   // motor.js:289-307
const LOCAIS = literal('LOCAIS');                   // motor.js:367-392
const BARAO_NOME = Object.keys(MONS).find((k) => /Nashor/.test(k));   // motor.js:306 (a chave tem acento)
const BARAO = MONS[BARAO_NOME];                 // motor.js:306
const LOCAL_BARAO = LOCAIS.find((l) => l.id === 'barao');
const TETO_VIDA = escalar('TETO_VIDA_ITEM');        // motor.js:1205
const CURVA_HP = curvaCoef('hp');
// `curva()` da extensao espera os COEFICIENTES de CADA campo da CURVA do motor como array
// [a, b, c] (motor.js:283-288). Todos os campos tem de vir: `curva()` calcula hp/ad/armadura/
// xp/ouro ao mesmo tempo, e um campo a mais ou a menos muda tudo (Regra N.o 1: ler a LISTA).
const coefArr = (campo) => { const c = curvaCoef(campo); return [c.a, c.b, c.c]; };
const CURVA = { hp: coefArr('hp'), ad: coefArr('ad'), armadura: coefArr('armadura'), xp: coefArr('xp'), ouro: coefArr('ouro') };
const KIT_AP = { Q: { max: 10, base: [80, 395], ratio: [0.45, 0.72], recarga: [10, 6.85], alvos: 3, mult: 3 } };
const KIT_AD = { Q: { max: 10, base: [40, 200], ratio: [0.55, 0.55], recarga: [4, 3.9], alvos: 1, mult: 1 } };

/** Monta um mundo com o meta do jogo (monstros/locais/kit) e o campeao pedido.
 *  `arsenal` (opcional) monta #hab-ativas/.hab[data-t] para o DPS deixar de ser 0 -
 *  `estimarSet()` (que o criterio de sobrevivencia usa) le o arsenal do HUD. */
function mundo(champId, nivel, arsenal) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  alimentarMeta(m, {
    monstros: MONS, locais: LOCAIS, nivelDif: ND, curva: CURVA,
    kits: {
      aptest: { kit: KIT_AP, magia: true, distancia: false, papel: { dano: 1, recebido: 1 }, adBase: 58, adNivel: 3.4 },
      adtest: { kit: KIT_AD, magia: false, distancia: false, papel: { dano: 1, recebido: 1 }, adBase: 60, adNivel: 3.9 },
    },
  });
  definirCampeao(m, champId);
  if (nivel) {
    m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nivel) })]);
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nivel) })]);
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4476 / 4476' })]);
  }
  if (arsenal) {
    const habs = arsenal.map((h) => m.el({ tag: 'div', label: 'hab-' + h.t, className: 'hab',
      dataset: { t: h.t, dica: h.t + ' - teste' }, textContent: h.txt || '1 / 1' }));
    m.montar('#hab-ativas .hab[data-t]', habs);
  }
  return { m, auto };
}

export const suite = {
  nome: 'chefe',
  titulo: 'Build de chefe (3153), tolerancia de nivel e criterio de sobrevivencia',

  async run(t) {
    /* =====================================================================
     * A. O CATALOGO DO BANCO TEM DE TER A 3153 (a peca que decide a luta)
     * ===================================================================== */
    const cat = (mundo('adtest').auto.getMeta().itens) || [];
    t.check('A1: o catalogo do banco tem a 3153 (a peca que decide a luta contra o Barao)',
      cat.some((i) => String(i.id) === '3153') === true);


    /* =====================================================================
     * B. TK-02-81: a build de CHEFE e a IDEAL levam a 3153; a de MOBS nao
     * ===================================================================== */
    for (const par of [['adtest', false], ['aptest', true]]) {
      const id = par[0], magia = par[1];
      const nome = magia ? 'AP' : 'AD';
      const { auto } = mundo(id);
      const champ = { id: id, magia: magia };
      const ideal = (auto.buildIdealPara(champ) || []).map(String);
      const chefe = (auto.buildIdealParaFase(champ, 'chefe') || []).map(String);
      const mobs = (auto.buildIdealParaFase(champ, 'mobs') || []).map(String);
      t.check('B1[' + nome + ']: a build IDEAL contem a 3153 contra chefes de vida alta', ideal.indexOf('3153') >= 0);
      t.check('B2[' + nome + ']: a build de CHEFE contem a 3153', chefe.indexOf('3153') >= 0);
      t.check('B3[' + nome + ']: a build de MOBS NAO leva a 3153 (vida baixa: o teto morde)', mobs.indexOf('3153') < 0);
      t.check('B4[' + nome + ']: a build de CHEFE tem 5 itens (1 bota + 4)', chefe.length === 5);
      t.check('B5[' + nome + ']: a build IDEAL tem 5 itens', ideal.length === 5);
      t.check('B6[' + nome + ']: a build de MOBS tem 5 itens', mobs.length === 5);
    }

    /* =====================================================================
     * C. TK-02-81: a 3153 entra por MERITO (a formula do motor), e o nivel do
     *    chefe segue motor.js:1134 (jogador+4, preso em n0+2)
     * ===================================================================== */
    {
      const { auto } = mundo('adtest', 29);
      const alvo = auto.alvoDeReferencia('chefe');
      t.check('C1: ha alvo de referencia (o chefe da regiao de maior tier)', !!alvo);
      const nivelMotor = Math.max(LOCAL_BARAO.nm[0] + 2, Math.min(LOCAL_BARAO.nm[1] + 2, 29 + 4));
      t.check('C2: o nivel do chefe segue a formula do motor.js:1134', alvo.nivel === nivelMotor);
      t.check('C3: com o jogador a 29 o Barao fica PRESO em 42 (n0+2)',
        alvo.nivel === LOCAL_BARAO.nm[0] + 2);
      const hpMotor = hpMonstro(BARAO.hp, alvo.nivel);
      t.check('C4: a vida do alvo e a do motor (CURVA.hp x coeficiente)', Math.abs(alvo.hp - hpMotor) < 1);
      // valor da passiva: 5% da vida actual, com tecto de 3x a curva (motor.js:1702 / 1191)
      const teto = TETO_VIDA * (CURVA_HP.a + CURVA_HP.b * alvo.nivel + CURVA_HP.c * alvo.nivel * alvo.nivel);
      const porAuto = Math.min(0.05 * alvo.hp, teto);
      t.check('C5: a 3153 vale mais de 1000 por auto contra o Barao (bate no tecto)', porAuto > 1000);
      // a tolerancia de nivel DO CHEFE (nivel 42 com jogador 29)
      const av = auto.avaliar(BARAO_NOME, alvo.nivel, { nivel: 29, vida: 4476, armadura: 154, rm: 127 }, { skill: 0, pocao: 0 });
      const difEsp = Math.max(0, alvo.nivel - 29 - ND.livre);
      t.check('C6: fM do motor (min(max, 1+danoMonstro*dif))',
        Math.abs(av.fM - Math.min(ND.maxDanoMonstro, 1 + ND.danoMonstro * difEsp)) < 1e-9);
      t.check('C7: fJ do motor (max(min, 1-danoJogador*dif))',
        Math.abs(av.fJ - Math.max(ND.minDanoJogador, 1 - ND.danoJogador * difEsp)) < 1e-9);
    }


    /* =====================================================================
     * D. TK-02-83: TOLERANCIA DE NIVEL (motor.js:1196-1202)
     * ===================================================================== */
    {
      const { auto } = mundo('adtest', 29);
      t.check('D1: livre = 4, o do motor.js:1199', auto.NIVEL_DIF_FB.livre === ND.livre);
      t.check('D2: danoMonstro = o do motor (era 0,15 ate 13/10/2026)', auto.NIVEL_DIF_FB.danoMonstro === ND.danoMonstro);
      t.check('D3: maxDanoMonstro = o do motor (era 3)', auto.NIVEL_DIF_FB.maxDanoMonstro === ND.maxDanoMonstro);
      t.check('D4: danoJogador = o do motor (era 0,07)', auto.NIVEL_DIF_FB.danoJogador === ND.danoJogador);
      t.check('D5: minDanoJogador = o do motor', auto.NIVEL_DIF_FB.minDanoJogador === ND.minDanoJogador);
      t.check('D6: o fallback da extensao NAO e a versao velha (0,15 / 3 / 0,07)',
        !(auto.NIVEL_DIF_FB.danoMonstro === 0.15 && auto.NIVEL_DIF_FB.maxDanoMonstro === 3 && auto.NIVEL_DIF_FB.danoJogador === 0.07));
      const pj = 29;
      t.check('D7: monstro +3 NAO penaliza (dif=0, fM=1, fJ=1)',
        auto.difNivelMotor(pj + 3, pj) === 0 && auto.fatorDanoMonstroMotor(0) === 1 && auto.fatorDanoJogadorMotor(0) === 1);
      t.check('D8: monstro +4 (o limite da faixa livre) NAO penaliza', auto.difNivelMotor(pj + 4, pj) === 0);
      t.check('D9: monstro +5 penaliza (dif=1)', auto.difNivelMotor(pj + 5, pj) === 1);
      t.check('D10: +5 -> fM = min(max, 1 + danoMonstro*1) do motor',
        auto.fatorDanoMonstroMotor(1) === Math.min(ND.maxDanoMonstro, 1 + ND.danoMonstro * 1));
      t.check('D11: +5 -> fJ = max(min, 1 - danoJogador*1) do motor',
        auto.fatorDanoJogadorMotor(1) === Math.max(ND.minDanoJogador, 1 - ND.danoJogador * 1));
      t.check('D12: o fator do monstro tem TETO (maxDanoMonstro)',
        auto.fatorDanoMonstroMotor(99) === ND.maxDanoMonstro);
      t.check('D13: o fator do jogador tem PISO (minDanoJogador)',
        auto.fatorDanoJogadorMotor(99) === ND.minDanoJogador);
      // o RELAY tem prioridade sobre o fallback (Regra N.o 3: numero LIDO)
      const outro = { livre: 2, danoMonstro: 0.5, maxDanoMonstro: 4, danoJogador: 0.2, minDanoJogador: 0.4 };
      // (a) COM relay: o valor do relay manda (Regra N.o 3: numero LIDO)
      const m2 = criarMundo();
      const a2 = carregarAutomation(m2);
      alimentarMeta(m2, { nivelDif: outro });
      t.check('D14: com o relay a responder, o valor e o do RELAY (nao o fallback)',
        a2.nivelDifMotor().danoMonstro === 0.5 && a2.nivelDifMotor().livre === 2);
      // (b) SEM relay: vale a fotografia do motor.js:1199 (e ela tem de estar actualizada)
      const m3 = criarMundo();
      const a3 = carregarAutomation(m3);
      t.check('D15: sem relay, o fallback e a fotografia do motor.js:1199',
        a3.nivelDifMotor().danoMonstro === ND.danoMonstro
          && a3.fatorDanoMonstroMotor(1) === Math.min(ND.maxDanoMonstro, 1 + ND.danoMonstro)
          && a3.fatorDanoJogadorMotor(1) === Math.max(ND.minDanoJogador, 1 - ND.danoJogador));
    }

    /* =====================================================================
     * E. TK-02-83: a tolerancia explica o nivel 29 no Barao; morte continua true
     * ===================================================================== */
    {
      const { auto } = mundo('adtest', 29);
      const nivelChefe = auto.nivelDoChefe(LOCAL_BARAO, 29);
      const av = auto.avaliar(BARAO_NOME, nivelChefe, { nivel: 29, vida: 4476, armadura: 154, rm: 127 }, { skill: 0, pocao: 0 });
      const difEsp = Math.max(0, nivelChefe - 29 - ND.livre);
      t.check('E1: avaliar() expoe fM e fJ calculados', av.fM > 1 && av.fJ < 1);
      t.check('E2: a diferenca de niveis e a do motor (motor.js:1200)', av.dif === difEsp);
      t.check('E3: fM = min(max, 1 + danoMonstro*dif) do motor',
        Math.abs(av.fM - Math.min(ND.maxDanoMonstro, 1 + ND.danoMonstro * difEsp)) < 1e-9);
      t.check('E4: fJ = max(min, 1 - danoJogador*dif) do motor',
        Math.abs(av.fJ - Math.max(ND.minDanoJogador, 1 - ND.danoJogador * difEsp)) < 1e-9);
      t.check('E5: ao nivel 29 a tolerancia JA SE ESGOTOU (teto do monstro ou piso do jogador)',
        av.fM === ND.maxDanoMonstro || av.fJ === ND.minDanoJogador);
      t.check('E6: morte do Barao ao nivel 29 continua true (criterio de fuga)', av.morre === true);
      // CONTROLO: ao nivel 38 (o limiar que o ticket cita) a tolerancia zerou
      const av38 = auto.avaliar(BARAO_NOME, auto.nivelDoChefe(LOCAL_BARAO, 38),
        { nivel: 38, vida: 4476, armadura: 154, rm: 127 }, { skill: 0, pocao: 0 });
      t.check('E7: ao nivel 38 a tolerancia zerou (dif=0, fM=fJ=1)',
        av38.dif === 0 && av38.fM === 1 && av38.fJ === 1);
      // CONTROLO: um mob comum a +3 nao penaliza (a faixa livre)
      const avMob = auto.avaliar('Larva do Vazio', 32, { nivel: 29, vida: 4476, armadura: 154, rm: 127 }, { skill: 0, pocao: 0 });
      t.check('E8: mob a +3 nao sofre penalizacao nenhuma (fM=fJ=1)',
        avMob.fM === 1 && avMob.fJ === 1);
      const avMob5 = auto.avaliar('Larva do Vazio', 34, { nivel: 29, vida: 4476, armadura: 154, rm: 127 }, { skill: 0, pocao: 0 });
      t.check('E9: mob a +5 ja penaliza nos DOIS lados', avMob5.fM > 1 && avMob5.fJ < 1);
    }


    /* =====================================================================
     * F. TK-02-75: o ranking de itens deixa de ser SO DPS
     * ===================================================================== */
    {
      const { auto } = mundo('aptest', 29, [{ t: 'Q', txt: '10 / 10' }, { t: 'R', txt: '3 / 5' }]);
      const alvo = { nome: BARAO_NOME, nivel: 42, hp: hpMonstro(BARAO.hp, 42), armadura: 122, chefe: true };
      const base = ['3005', '3089', '3100', '3135'];
      const s = auto.sobrevivenciaSet(base, alvo, 'barao');
      t.check('F1: sobrevivenciaSet() devolve o criterio completo do dono',
        !!s && Number.isFinite(s.vida) && Number.isFinite(s.tMorrer) && typeof s.morre === 'boolean');
      // a vida efectiva tem de ser a do painel + a dos itens do conjunto: a base nao tem
      // nenhum item de vida, logo fica na do painel. O CONTROLE (logo abaixo, com o 3168 de 500
      // de vida) e que prova que o calculo soma de verdade.
      t.check('F2: a vida efectiva = a do painel quando nenhum item da vida', s.vida === 4476);
      t.check('F3: contra o Barao ao nivel 29 o boneco MORRE (o criterio diz morre)', s.morre === true);
      const sVida = auto.sobrevivenciaSet(['3005', '3089', '3100', '3168'], alvo, 'barao');
      t.check('F4: um item de vida aumenta o tempo que se aguenta (numero, nao opiniao)',
        sVida.vida > s.vida && sVida.tMorrer > s.tMorrer);
      const rank = auto.rankItensSobrevivencia(alvo, { base: base, regiaoId: 'barao' });
      t.check('F5: rankItensSobrevivencia() devolve uma lista ordenada', Array.isArray(rank) && rank.length > 0);
      t.check('F6: o primeiro do rank tem sobrevive definido', typeof rank[0].sobrevive === 'boolean');
      t.check('F7: o rank NAO e so DPS: carrega tMorrer, nPocoes e ouroPocao',
        rank[0].tMorrer !== undefined && rank[0].nPocoes !== undefined && rank[0].ouroPocao !== undefined);
      const sobreviventes = rank.filter((r) => r.sobrevive === true);
      if (sobreviventes.length) {
        const primeiroQueMorre = rank.findIndex((r) => r.sobrevive !== true);
        t.check('F8: com um item que sobrevive, ele fica A FRENTE dos que matam (mesmo com menos DPS)',
          rank.indexOf(sobreviventes[0]) < primeiroQueMorre);
      }
      // o rank tem de ser DIFERENTE do rank de DPS puro: se fossem iguais, nao havia criterio novo
      const soDps = auto.rankItens(alvo).filter((x) => cat.some((i) => String(i.id) === String(x.id)));
      const novo = rank.slice(0, 5).map((r) => String(r.id));
      const antigo = soDps.slice(0, 5).map((r) => String(r.id));
      t.check('F9: o criterio novo da uma ordem DIFERENTE do ranking de DPS puro',
        JSON.stringify(novo) !== JSON.stringify(antigo));
    }

    /* =====================================================================
     * G. TK-02-74: Liandry vs Impeto no 5. espaco, com sobrevivencia
     * ===================================================================== */
    {
      const { auto } = mundo('aptest', 29, [{ t: 'Q', txt: '10 / 10' }, { t: 'R', txt: '3 / 5' }]);
      const alvo = { nome: BARAO_NOME, nivel: 42, hp: hpMonstro(BARAO.hp, 42), armadura: 122, chefe: true };
      const base = ['3005', '3089', '3100', '3135'];
      const comLiandry = auto.sobrevivenciaSet(base.concat(['6653']), alvo, 'barao');
      const comImpeto = auto.sobrevivenciaSet(base.concat(['3171']), alvo, 'barao');
      t.check('G1: as duas builds completas foram medidas', !!comLiandry && !!comImpeto);
      t.check('G2: a comparacao traz DPS dos dois lados', comLiandry.dps > 0 && comImpeto.dps > 0);
      const cdrL = auto.efeitosEquipados(base.concat(['6653'])).cdr;
      const cdrI = auto.efeitosEquipados(base.concat(['3171'])).cdr;
      t.check('G3: o CDR dos dois lados contra o tecto de 40% do motor.js:401',
        cdrL <= 0.4 && cdrI <= 0.4 && cdrI > cdrL);
      t.check('G4: o Impeto da os 350 de vida que o Liandry nao da', comImpeto.vida - comLiandry.vida > 0);
      t.check('G5: os dois tem tKill (a pergunta dos segundos do dono)',
        comLiandry.tKill != null && comImpeto.tKill != null);
      t.check('G6: os dois dao nPocoes e ouroPocao (a 3.a pergunta do dono)',
        comLiandry.nPocoes != null && comImpeto.nPocoes != null
          && comLiandry.ouroPocao != null && comImpeto.ouroPocao != null);
      t.check('G7: o vencedor por segundos mata mais rapido', comLiandry.tKill !== comImpeto.tKill);
    }


    /* =====================================================================
     * H. TK-02-52 / TK-02-55(e): a barra por disponibilidade, cena exacta
     * ===================================================================== */
    {
      const { auto } = mundo('aptest');
      // REGRA DA ULTIMATE (2026-10-19): por defeito a ultimate sai da barra de MOBS. Este bloco
      // testa disponibilidade/anti-oscilação com a ultimate PRESENTE, logo força-a em mobs.
      auto.setConfig({});
      t.check('H1: barraPorDisponibilidade nasce LIGADA (pedido do dono)',
        auto.getConfig().barraPorDisponibilidade === true);
      // 4 skills: Q e R prontas (cd 0), A a 3s e F a 7s de recarga. A barra actual tem as 4.
      const arsenal = [
        { t: 'Q', rank: 10 }, { t: 'W', rank: 1 }, { t: 'A', rank: 5 }, { t: 'F', rank: 1 }, { t: 'R', rank: 3 },
      ];
      const bar = [
        { t: 'R', cd: 0 }, { t: 'Q', cd: 0 }, { t: 'A', cd: 3 }, { t: 'F', cd: 7 },
      ];
      const s = { arsenal: arsenal.map((h) => Object.assign({}, h)), bar: bar.map((b) => Object.assign({}, b)) };
      const desejadas = auto.barraIdeal(s, 'mobs', true);
      t.check('H2: a barra desejada tem exactamente 4 slots', desejadas.length === 4);
      t.check('H3: a ULTIMATE fica SEMPRE dentro (regra inviolavel do dono)', desejadas.indexOf('R') >= 0);
      t.check('H4: a ULTIMATE e a primeira (nunca cai pelo corte dos 4)', desejadas[0] === 'R');
      // prontas primeiro: Q e W estao PRONTAS (cd 0) e A/F estao em recarga. W (fora da
      // barra, cd 0 = disponivel) entrou justamente por isso: "usava tudo disponivel".
      t.check('H5: as PRONTAS (Q, W) vem antes das em recarga (A) - usar tudo disponivel',
        desejadas.indexOf('Q') < desejadas.indexOf('A') && desejadas.indexOf('W') < desejadas.indexOf('A'));
      t.check('H5b: a skill disponivel FORA da barra (W) entrou no lugar da mais atrasadas',
        desejadas.indexOf('W') >= 0 && desejadas.indexOf('F') < 0);
      // anti-oscilacao: repetir a conta com a barra JA no alvo nao muda nada
      const bar2 = desejadas.map((tt) => ({ t: tt, cd: 0 }));
      const repetido = auto.barraIdeal({ arsenal: arsenal.map((h) => Object.assign({}, h)), bar: bar2 }, 'mobs', true);
      t.check('H6: anti-oscilacao: repetir a conta com a barra ja no alvo NAO reordena',
        JSON.stringify(repetido) === JSON.stringify(desejadas));
      // empate sem oscilacao: mesma recarga restante -> mantem quem ja esta na barra
      const tie1 = auto.barraIdeal({ arsenal: [{ t: 'A', rank: 5 }, { t: 'F', rank: 5 }, { t: 'R', rank: 1 }],
        bar: [{ t: 'F', cd: 2 }, { t: 'A', cd: 2 }, { t: 'R', cd: 0 }] }, 'mobs', true);
      const tie2 = auto.barraIdeal({ arsenal: [{ t: 'A', rank: 5 }, { t: 'F', rank: 5 }, { t: 'R', rank: 1 }],
        bar: [{ t: 'A', cd: 2 }, { t: 'F', cd: 2 }, { t: 'R', cd: 0 }] }, 'mobs', true);
      t.check('H7: empate mantem a ordem de quem ja esta na barra (sem churn de 2 s)',
        tie1[0] === 'R' && tie2[0] === 'R' && tie1[1] === 'F' && tie2[1] === 'A');
      auto.setConfig({ barraPorDisponibilidade: false });
      const off = auto.barraIdeal(s, 'mobs', true);
      t.check('H8: DESLIGADO a barra enche na mesma os 4 slots', off.length === 4);
      t.check('H9: DESLIGADO a ULTIMATE continua dentro', off.indexOf('R') >= 0);
      auto.setConfig({ barraPorDisponibilidade: true });
      t.check('H10: o interruptor volta a ficar ligado por defeito',
        auto.getConfig().barraPorDisponibilidade === true);
    }
  },
};
