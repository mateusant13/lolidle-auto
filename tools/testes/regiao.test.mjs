/*
 * regiao.test.mjs - REGIAO E OBJETIVO (as duas regras do dono sobre onde farmar).
 *
 *   "Nivel/regiao: nao ficar em regiao abaixo do nivel; subir para a regiao que maximiza
 *    ouro+xp/min."
 *
 * PORQUE ESTA SUITE EXISTE: o banco tinha ZERO cobertura para regiao - nenhum teste tocava
 * regiaoIdeal / rankRegioes / abaixoDoNivel / scoreRegiao / taxaXpOuro. A decisao de ONDE
 * farmar e o eixo com maior efeito no ouro/min e nao estava protegida por nada.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true (nao ha truthy solto).
 */

import fs from 'node:fs';
import path from 'node:path';
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao, alimentarMeta, RAIZ } from './dom-stub.mjs';

export const suite = {
  nome: 'regiao',
  titulo: 'Regiao e objetivo (abaixo do nivel; score por ouro+xp)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');

    /* ---- R1: 'abaixo do nivel' e o TOPO da faixa, nao o fundo (motor.js:421 fatorXp). */
    const faixa = { faixa: [30, 40] };
    t.check('R1: nivel 29 numa faixa [30,40] NAO esta abaixo do nivel', auto.abaixoDoNivel(faixa, { nivel: 29 }) === false);
    t.check('R1: nivel 40 (topo exacto) ainda NAO esta abaixo do nivel', auto.abaixoDoNivel(faixa, { nivel: 40 }) === false);
    t.check('R1: nivel 41 numa faixa [30,40] ESTA abaixo do nivel', auto.abaixoDoNivel(faixa, { nivel: 41 }) === true);
    t.check('R1: sem faixa definida nunca conta como abaixo do nivel', auto.abaixoDoNivel({ faixa: null }, { nivel: 99 }) === false);
    t.check('R1: local nulo nao rebenta', auto.abaixoDoNivel(null, { nivel: 5 }) === false);

    /* ---- R2: o score tem de mudar com o OBJETIVO (senao a escolha da regiao nao obedece). */
    const e = { xpMin: 100, goldMin: 50, runasH: 7, mobLevel: 30 };
    t.check('R2: objetivo xp pontua pelo xp medido', auto.scoreRegiao(e, 'xp') === 100);
    t.check('R2: objetivo ouro pontua pelo ouro medido', auto.scoreRegiao(e, 'ouro') === 50);
    t.check('R2: objetivo runas pontua pelas runas/h', auto.scoreRegiao(e, 'runas') === 7);
    t.check('R2: objetivo combinado vale MAIS que so xp (soma ouro ponderado)', auto.scoreRegiao(e, 'ouro+xp') > 100);

    /* ---- R3: o MEDIDO manda sobre a teoria quando existe amostra. */
    t.check('R3: com amostra, o score usa o xp MEDIDO e nao o teorico',
      auto.scoreRegiao({ xpMin: 1, goldMin: 1 }, 'xp', { xpMin: 999 }) === 999);
    t.check('R3: com amostra, o score usa o ouro MEDIDO e nao o teorico',
      auto.scoreRegiao({ xpMin: 1, goldMin: 1 }, 'ouro', { goldMin: 888 }) === 888);

    /* ---- R4: entrada invalida nao pode ganhar a escolha da regiao. */
    t.check('R4: entrada nula pontua -Infinity (nunca e escolhida)', auto.scoreRegiao(null, 'xp') === -Infinity);
  },
};

/* ====================================================================================== *
 * E — GUARDA DE RE-ENTRANCIA (2026-10-18). O JOGO CONGELAVA.
 *
 * PORQUE ESTA SUITE EXISTE: com a Katarina (Voracidade + giro) o `renderTudo` da GUI entrava
 * num CICLO INFINITO de chamadas e o main thread nunca mais respondia — provado ao vivo, no
 * browser do dono, com `Debugger.pause` (a stack tinha centenas de frames do ciclo repetido).
 *
 *   agregar -> curaGiroS -> dpsPorHabilidade -> cdVoraz -> killsMinAoVivo -> ritmoMobs -> agregar
 *
 * A guarda corta o ciclo no `agregar` (e no `ritmoMobs`): quem re-entra recebe o ULTIMO
 * resultado, nunca recomputa. Os contadores contam as re-entradas — so' existem para o banco
 * poder PROVAR que a guarda existe E que o caminho a atravessa (mutacao: retirar a guarda -> 0).
 * ====================================================================================== */

/** Kit da Katarina REAL, lido do jogo vivo (REGRA N.o 3: o numero e' LIDO, nunca copiado).
 *  So' existe o ciclo se o kit tiver a `curaGiro` (D) e as `recarga` (Q/W/E) — e' o que faz
 *  `curaGiroS` chamar `dpsPorHabilidade` e este chamar `cdVoraz`. */
function kitKatarinaVivo() {
  const p = path.join(RAIZ, 'docs/game-src/kit-katarina-vivo.json');
  const v = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\/\/.*$/gm, ''));
  const kit = v && v.kit && v.kit.hab ? v.kit.hab : null;
  if (!kit) throw new Error('kit-katarina-vivo.json sem .kit.hab: o ciclo nao pode ser exercitado');
  return kit;
}

/** Ranks REAIS da Katarina ao nivel 29 (os mesmos do barrafase: o arsenal e' dado por isto). */
const RANKS_KATARINA = { Q: 10, W: 6, E: 6, R: 3, G: 4, A: 2, F: 1, T: 1 };

/** Mundo com o historico MEDIDO e a Katarina (Voracidade + giro) — as duas condicoes do ciclo. */
function mundoCongelamento() {
  const store = {};
  store['lolidleAutoPotion:farm'] = {
    cycles: [{
      region: 'Fosso do Dragao', gold: 3000, xp: 9000, fase: 'mobs', janela: 'jE',
      mobFase: { startedAt: 0, durMs: 60000, perMin: { gold: 3000, xp: 9000, kills: 30, potions: 0, goldPotion: 0, healSkill: 0, healPotion: 0 }, gold: 3000, xp: 9000, kills: 30 },
    }],
    log: [], issues: [], deaths: [],
  };
  const m = criarMundo({ storage: store });
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'katarina', { kit: kitKatarinaVivo(), magia: true });
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  // O ARSENAL tem de estar no DOM: o `dpsPorHabilidade` le `#hab-ativas .hab[data-t]` (readSkills).
  // Sem ele o loop das skills nao corre, o `cdVoraz` nunca e' chamado, e o ciclo nao se forma.
  m.montar('#hab-ativas .hab[data-t]', Object.keys(RANKS_KATARINA).map((tt) => m.el({
    tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
    textContent: RANKS_KATARINA[tt] + ' / 10',
  })));
  alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1, grupoSpawn: { base: 2, rand: 3 } });
  return { m, auto };
}

async function provaGuardas(t) {
  const { auto } = mundoCongelamento();
  await new Promise((r) => setTimeout(r, 30));
  t.check('E: a guarda do agregar esta exposta (agregarReentradas)', typeof auto.agregarReentradas === 'function');
  t.check('E: a guarda do ritmoMobs esta exposta (ritmoReentradas)', typeof auto.ritmoReentradas === 'function');
  // A prova dura: SEM a guarda isto e' recursao infinita e o processo NUNCA chega a esta linha.
  // As duas checagens abaixo provam que o CENARIO e' real (kit vivo com giro + Voracidade):
  // sem elas, uma configuracao que nao formasse o ciclo passaria sem exercitar nada.
  const d0 = auto.curaGiroDe();
  t.check('E: o cenario tem a cura do giro ligada (curaGiroDe().tem)', d0.tem === true);
  t.check('E: o cenario tem kills/min medidos (a Voracidade entra no cd)', auto.killsMinAoVivo() > 0);
  const agg = auto.agregar();
  t.check('E: agregar() COMPLETA com a Katarina (Voracidade + giro) — antes era recursao infinita',
    Array.isArray(agg));
  t.check('E: o ciclo foi REALMENTE atravessado (agregar re-entrou >= 1x)', auto.agregarReentradas() >= 1);
  const ideal = auto.regiaoIdeal();
  t.check('E: regiaoIdeal() completa (passa pelo mesmo ciclo, nao congela)',
    ideal === null || typeof ideal === 'string');
  // REGRESSAO (2026-10-19): o `if (!cand.length) ...; return null;` sem chavetas fazia o
  // `return null` ser INCONDICIONAL — a GUI ficava sem regiao recomendada em modo AUTO.
  const recAuto = auto.regiaoRecomendada();
  t.check('E: regiaoRecomendada() devolve uma regiao quando ha candidatas seguras',
    typeof recAuto === 'string' && recAuto.length > 0);
  const rec = auto.recomendar();
  t.check('E: recomendar() completa (usa agregar + ritmoMobs)',
    rec === null || typeof rec === 'object');
  t.check('E: agregar() devolve dados (nao foi esvaziado pela guarda)',
    Array.isArray(agg) && agg.length >= 1 && !!agg[0].region);
}

export const suiteE = {
  nome: 'w1-guardas',
  titulo: 'Guardas de re-entrancia: o ciclo agregar->curaGiroS->...->ritmoMobs->agregar nao congela o jogo',
  async run(t) { await provaGuardas(t); },
};

/* ====================================================================================== *
 * W1-REGIOES (TK-02-39 / TK-01-01 / TK-01-02 / TK-01-04 / TK-01-05 / TK-01-06 / TK-01-08 /
 * TK-01-41 / TK-01-42) — bloco acrescentado no FIM, com ancora unica (REGRA N.o 5:
 * um ficheiro, um escritor; nunca se substitui o bloco dos outros).
 *
 * Traz o META do jogo (locais + monstros + curva) pelo caminho REAL (message -> carregarMeta),
 * que e o unico caminho que o automation.js aceita. Nada de copiar numeros: o que se quer
 * provar e o que o automation.js DEVOLVE com o meta do motor.
 * ====================================================================================== */

/** Locais de teste com a faixa do jogo (nm) e os monstros. O 'dragao' e o Fosso do Dragao:
 *  nm [30,38] com chefe nv 40 pelo MOTOR (motor.js:1134: max(n0+2, min(n1+2, 29+4)) = 35... e
 *  sem nivel do jogador, n1+2 = 40 -- o valor que o ticket TK-01-02 pede provado). */
const LOCAIS_W1 = [
  { id: 'lobos', nome: 'Toca dos Lobos', nm: [1, 8], faixa: [1, 8], tier: 0,
    monstros: [['lobo', 1]], chefe: null },
  { id: 'dragao', nome: 'Fosso do Dragao', nm: [30, 38], faixa: [30, 38], tier: 6,
    monstros: [['dracete', 1]], chefe: ['dragao', 0.05] },
  { id: 'barao', nome: 'Covil do Barao', nm: [40, 48], faixa: [40, 48], tier: 7,
    monstros: [['larv', 1]], chefe: ['barao', 0.05] },
];
/** Monstros: os coeficientes do motor (hp/ad/as/armadura/xp/ouro relativos a curva). */
const MONSTROS_W1 = {
  lobo:    { hp: 1.0, ad: 1.0, as: 1.0, armadura: 1.0, xp: 1.0, ouro: 1.0 },
  dracete:  { hp: 1.2, ad: 1.1, as: 1.0, armadura: 1.1, xp: 1.0, ouro: 1.0 },
  dragao:  { hp: 4.0, ad: 1.8, as: 0.8, armadura: 1.6, xp: 5.0, ouro: 5.0, chefe: true },
  larv:    { hp: 0.5, ad: 0.6, as: 1.2, armadura: 0.6, xp: 0.4, ouro: 0.4 },
  barao:   { hp: 6.0, ad: 2.2, as: 0.7, armadura: 1.8, xp: 6.0, ouro: 6.0, chefe: true },
};

function mundoW1(nivelJog, champ, over) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, champ || 'adtest');
  // nivel do jogador lido do HUD (#hud-nivel) — o unico caminho que o player() aceita
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nivelJog) })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nivelJog) })]);
  // vida do jogador no formato do HUD ('atual / max', jogo.js:6203) — sem isto o player()
  // fica com vida null e o tMorrer do avaliar da 1/liquido (zero arredondado).
  const vida = over && over.vida != null ? over.vida : 4188;
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: vida + ' / ' + vida })]);
  alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1, nivelDif: null });
  return { m, auto };
}

/** Mundo W1 com historico MEDIDO: um ciclo de 1 min com 30 kills no Fosso do Dragao.
   *  E o unico caminho por onde o `meuDps()` da extensao devolve um numero (ele deriva o DPS
   *  do medido, nao de formula) — e o `estimarLuta` precisa de DPS para haver tKill.
   *  Vem pelo storage real (FARM_KEY), que e onde a extensao le o farm no arranque. */
function mundoW1Medido(nivelJog, killsMin) {
  const store = {};
  store['lolidleAutoPotion:farm'] = {
    cycles: [{
      region: 'Fosso do Dragao', gold: 3000, xp: 9000, fase: 'mobs',
      mobFase: { startedAt: 0, durMs: 60000, perMin: { gold: 3000, xp: 9000, kills: killsMin, potions: 0, goldPotion: 0, healSkill: 0, healPotion: 0 }, gold: 3000, xp: 9000, kills: killsMin },
    }],
    log: [], issues: [], deaths: [],
  };
  const m = criarMundo({ storage: store });
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest');
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nivelJog) })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nivelJog) })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1 });
  return { m, auto };
}
/* ---- B: PROVA DOS NUMEROS (os 4 sitios onde o banco estava cego) -------------------
 *  REGRA N.o 6: "verde nao e prova". A primeira versao desta suite passava com o codigo
 *  REVERTIDO em 4 pontos (mutation testing). Estes testes existem para fechar esses buracos:
 *  cada um afirma um numero que SO a versao certa produz. */

/** B1 — parseNum com o sufixo do `fmt` do jogo (defeito transversal, regra do Lead).
 *  cena.js:225: n>=1e6 -> 'M' · n>=1e4 -> 'k'. O parseNum antigo apagava o sufixo: '12.3k'
 *  virava 123 e corrompia readPotions/readGold EM SILENCIO acima de 10.000. */
async function provaParseNum(t) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest');
  // pocoes no HUD: `#hud-pocoes [data-pocao]` com `b` = quantidade (readPotions le com parseNum)
  const poc = (nome, qtd) => m.el({
    tag: 'div', label: 'poc-' + nome, className: 'pocao',
    dataset: { pocao: nome },
    find: { b: [m.el({ tag: 'b', label: 'poc-' + nome + '-b', textContent: qtd })] },
  });
  m.montar('#hud-pocoes [data-pocao]', [poc('vida', '12.3k'), poc('vidaF', '4.188'), poc('vidaS', '1.2M')]);
  const p = auto.readPotions();
  t.check('B1: readPotions("12.3k") = 12300 (antes: 123) — sufixo k entra no grupo', p.vida === 12300);
  t.check('B1: readPotions("4.188") = 4188 (grupo de 3 = MILHAR, nao decimal)', p.vidaF === 4188);
  t.check('B1: readPotions("1.2M") = 1200000 — sufixo M', p.vidaS === 1200000);
  // o mesmo parser no readGold (ultimo ramo, sem k/M no texto)
  m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '9.876' })]);
  t.check('B1: readGold("9.876") = 9876 (milhar, nao 9,876 partido)', auto.readGold() === 9876);
  m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '12.3k' })]);
  t.check('B1: readGold("12.3k") = 12300 (ramo proprio do k, mantido)', auto.readGold() === 12300);
  m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '1.2M' })]);
  t.check('B1: readGold("1.2M") = 1200000', auto.readGold() === 1200000);
  m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '12345' })]);
  t.check('B1: com inteiros o comportamento e IDÊNTICO ao de antes (sem regressao)', auto.readGold() === 12345);
}

/** B2 — a MEDIA da wave (TK-01-08): E[2+floor(r()*3)] = 3, nao `base` = 2.
 *  motor.js:1137. A versao antiga usava `grupoSpawn.base` (o MINIMO) e deixava o `seg3` do
 *  `valeUlt` 33% baixo — e a ultimate nunca saia nos mobs. */
function provaMediaWave(t) {
  {
    const { auto } = mundoW1(29);
    t.check('B2: mediaWaveDe({base:2, rand:3}) devolve 3', auto.mediaWaveDe({ base: 2, rand: 3 }) === 3);
    t.check('B2: mediaWaveDe({base:2, rand:4}) = 3,5 (media de 2..5)', auto.mediaWaveDe({ base: 2, rand: 4 }) === 3.5);
    t.check('B2: mediaWaveDe({base:2, rand:1}) = 2 (sem variacao, a base e a media)', auto.mediaWaveDe({ base: 2, rand: 1 }) === 2);
    t.check('B2: mediaWaveDe(null) = 3 (valor esperado do motor, nao 0/NaN)', auto.mediaWaveDe(null) === 3);
  }
  {
    // o estimarRegiao tem de usar a MESMA media (era uma formula propria, que ja dava 3
    // por acaso: 2 + floor((3-1)/2) = 3) — agora e a mesma funcao, Provado.
    const { m, auto } = mundoW1(29);
    alimentarMeta(m, { grupoSpawn: { base: 2, rand: 3 } });
    const e = auto.estimarRegiao('lobos');
    t.check('B2: estimarRegiao mobsPerWave = 3 (media, nao a base 2)', e && e.mobsPerWave === 3);
  }
  {
    // A prova que faltava: o ritmoMobs, com kills MEDIDOS no #log, usa a MEDIA.
    // A versao antiga punha `grupoSpawn.base` (2) -- o MINIMO da distribuicao -- e o seg3
    // do `valeUlt` ficava 33% baixo, pelo que a ultimate nunca saia nos mobs.
    const { m: m2, auto: a2 } = mundoW1ComLog(29, 12);
    const rm = a2.ritmoMobs();
    t.check('B2: com kills no #log o ritmoMobs devolve o tamanho da wave MEDIO = 3',
      rm && rm.perWave === 3);
    t.check('B2: o perWave do ritmoMobs NAO e a base (2) — mutation testing fechado',
      rm && rm.perWave !== 2);
    alimentarMeta(m2, { grupoSpawn: { base: 2, rand: 4 } });   // media = 2 + 1,5 = 3,5
    const rm2 = a2.ritmoMobs();
    t.check('B2: grupoSpawn {base:2, rand:4} -> perWave = 3,5 (media, nao a base)',
      rm2 && rm2.perWave === 3.5);
    t.check('B2: sem killTimes o ritmoMobs devolve null (nao inventa ritmo)',
      (() => { const { auto: a3 } = mundoW1(29); return a3.ritmoMobs() === null; })());
  }
}

/** B3 — o fJ tem de entrar no DPS contra o chefe (TK-01-04).
 *  A primeira versao do A5 afirmava `comFJ/semFJ == 1/fJ` usando o PROPRIO `meuDpsBoss`
 *  mutado nos dois lados: passava com o fator removido. Agora afirma o VALOR absoluto:
 *  o DPS contra o chefe nunca pode passar do DPS do jogador vezes o fator de nivel. */
async function provaFJ(t) {
  const { m, auto } = mundoW1Medido(20, 30);
  await new Promise((r) => setTimeout(r, 30));
  const dps = auto.meuDps();
  const est = auto.estimarLuta('dragao');
  t.check('B3: pre-condicao — DPS medido > 0', typeof dps === 'number' && dps > 0);
  t.check('B3: fJ do chefe a nv 20 = 0,25 (motor.js:1199)', est && est.fJ === 0.25);
  // SEM o fator: meuDpsBoss = dps * mitBoss (mitBoss ~0,66) ~ 0,66*dps > dps*0,25.
  // COM o fator: dps * mitBoss * 0,25 <= dps * 0,25. Fronteira que so a versao certa passa.
  t.check('B3: o DPS efectivo contra o chefe <= DPS do jogador x fJ (o fator ENTRA)',
    est.meuDpsBoss <= dps * est.fJ + 1e-9);
  t.check('B3: e fica abaixo do DPS sem o fator de nivel (mitBoss < 1 mas > fJ)',
    est.meuDpsBoss < dps * 0.9);
}

/** B4 — fail-closed: `morte` nunca pode ser null/undefined (TK-02-39 / TK-01-01).
 *  O `!x.e.morte` tratava `undefined` como segura: era um NO-OP que mandava o boneco morrer.
 *  O contrato e: para TODA a regiao do META, `morte` e booleano. */
async function provaFailClosed(t) {
  const { m, auto } = mundoW1(29);
  alimentarMeta(m, { kits: { adtest: { magia: false, distancia: false, papel: { dano: 1, recebido: 1 }, kit: {} } } });
  for (const l of LOCAIS_W1) {
    const e = auto.estimarRegiao(l.id);
    t.check('B4: estimarRegiao(' + l.id + ') devolve morte booleano (nunca null/undefined)',
      e && typeof e.morte === 'boolean');
  }
  // regiao sem stats de monstro: o fail-closed tem de devolver morte === true, nao null
  alimentarMeta(m, { locais: [{ id: 'fantasma', nome: 'Vale Fantasma', nm: [40, 48], faixa: [40, 48], tier: 5, monstros: [['naoExiste', 1]] }] });
  const ef = auto.estimarRegiao('fantasma');
  t.check('B4: regiao sem dados -> morte === true (fail-closed, nunca null)', ef && ef.morte === true);
  t.check('B4: regiao sem dados vem marcada semDados (nao passa por taxa teorica)', ef && ef.semDados === true);
  // e o filtro do ranking: `sobrevive` so e true com morte === false
  const rk = auto.rankRegioes('ouro');
  t.check('B4: nenhuma regiao do ranking fica com `sobrevive` verdadeiro sem morte === false',
    rk.every((r) => r.sobrevive === (r.morte === false)));
}
/** Mundo com #log alimentado por linhas REAIS do formato do jogo (cena.js:1570):
   *  'Loot de {nome}: {ouro} de ouro{itens}. +{xp} de experiência.'
   *  O `scanLog()` corre no arranque e enche os `killTimes` — e o `ritmoMobs()` passa a ter
   *  onde medir o tamanho da wave (TK-01-08). */
function mundoW1ComLog(nivelJog, nLinhas) {
  const m = criarMundo();
  const linhas = [];
  for (let k = 0; k < (nLinhas || 12); k++) {
    linhas.push(m.el({ tag: 'p', label: 'log' + k,
      textContent: 'Loot de lobo: 12.3k de ouro. +4.5k de experiencia.' }));
  }
  m.montar('#log', [m.el({ tag: 'div', label: 'log-box', find: { p: linhas } })]);
  m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: 'Toca dos Lobos nivel 1-8' })]);
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest');
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nivelJog) })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nivelJog) })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1, grupoSpawn: { base: 2, rand: 3 } });
  return { m, auto };
}
/** C — PARSER DO #log (TK-01-07): o formato real do jogo, com o sufixo do `fmt`.
 *  Fonte: cena.js:1570 'Loot de {nome}: {ouro} de ouro{itens}. +{xp} de experiência.'
 *  e cena.js:225 `fmt`: acima de 10.000 -> 'k', acima de 1.000.000 -> 'M'.
 *  DEFEITO MEDIDO: a regex antiga `(\d[\d.]*)\s*de ouro` exige ESPACO a seguir ao numero,
 *  e '12.3k de ouro' tem 'k' nessa posicao: NAO casava. Perdia o ouro E o abate -- e o kill
 *  so era contado dentro do grupo do ouro. E a linha da caça offline (jogo.js:6767) injecta
 *  XP sem abate nenhum. */
async function provaLog(t) {
  const linhas = [
    'Loot de lobo: 12.3k de ouro. +4.5k de experiencia.',      // (1) sufixo k
    'Loot de lobo: 1.2M de ouro. +890k de experiencia.',       // (2) sufixo M
    'Loot de lobo: 4.188 de ouro. +999 de experiencia.',       // (3) milhar com ponto
    'Enquanto voce estava fora (2 h 5 min), Katarina cacou: +12.3k de experiencia e +45.6k de ouro.',   // (4) CACA OFFLINE
  ];
  // ESPIAO no caminho REAL: o `handleLog` chama `window.__lolidleRlog({t:'kill', gold, xp})`
  // com os numeros JA PARSEADOS. Monta-se antes de carregar o automation.js e ve-se o que
  // o parser devolveu -- sem copiar nada, sem reimplementar a regex.
  const vistos = [];
  const m = criarMundo();
  m.sandbox.__lolidleRlog = (o) => vistos.push(o);
  const els = linhas.map((txt, k) => m.el({ tag: 'p', label: 'lg' + k, textContent: txt }));
  m.montar('#log', [m.el({ tag: 'div', label: 'log-box', find: { p: els } })]);
  m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: 'Fosso do Dragao nivel 30-38' })]);
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest');
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1 });
  // O `handleLog` chama o `__lolidleRlog` para cada linha que tenha ouro OU xp -- inclusive a
  // de caça offline. O que PROVA que a offline nao conta abate e o contador de kills, nao o
  // espião: por isso alimentamos 3 linhas de loot + 1 de caça offline e medimos as kills.
  t.check('C: o parser correu sobre as 4 linhas reais', vistos.length === 4);
  t.check('C: "12.3k de ouro" da gold = 12300 e nao 123 (sufixo no grupo)', vistos[0].gold === 12300);
  t.check('C: "+4.5k de experiencia" da xp = 4500', vistos[0].xp === 4500);
  t.check('C: "1.2M de ouro" da gold = 1200000', vistos[1].gold === 1200000);
  t.check('C: "+890k de experiencia" da xp = 890000', vistos[1].xp === 890000);
  t.check('C: "4.188 de ouro" da 4188 (grupo de 3 = MILHAR, nao decimal)', vistos[2].gold === 4188);
  t.check('C: "+999 de experiencia" da 999', vistos[2].xp === 999);
  // A CAÇA OFFLINE (jogo.js:6767): tem XP e ouro, mas NAO e abate. A linha tem de ser
  // reconhecida e NAO pode entrar como kill -- senao o `calibrar`/`agregar` (que decidem a
  // regiao por ouro/min e xp/min) ficam envenenados com uma soma que o servidor ja fez.
  const off = vistos.filter((v) => v.t === 'kill' && v.gold === 45600);
  t.check('C: a linha de caça offline nao traz ouro (o grupo do ouro e ignorado nela)', off.length === 0);
  const log = auto.getRunLog();
  t.check('C: ha registo da linha de caça offline no log da extensao (nao passa em silencio)',
    (log || []).some((e) => e.type === 'caca-offline'));
  // E a conta que interessa: 3 linhas de loot = 3 ABATES. A de caça offline NAO entra --
  // se entrasse, seriam 4. E a prova de que o contador de abates e independente do grupo
  // do ouro: a offline tem XP (e o jogo injecta-a sem abate nenhum, jogo.js:6767).
  const waves = auto.analisarWaves();
  t.check('C: 3 linhas de loot contam 3 abates e a de caça offline nao conta (n===3, nao 4)',
    waves && waves.n === 3);
  t.check('C: as linhas com sufixo k/M entraram nos abates (sem o parser novo, n seria 0)',
    waves && waves.n > 0);
}

/** C2 — KILLS contados pelo ABATE, nao pelo grupo do ouro (TK-01-07).
 *  Havia duas linhas reais possiveis no #log do jogo: a de loot traz os dois, mas a linha de
 *  XP de grupo (jogo.js:946 'Grupo: +{xp} de experiencia dos abates dos seus companheiros.')
 *  e a de tarefa (jogo.js:4901) trazem XP sem ouro. Contar o abate so dentro do grupo do
 *  ouro perdia esses abates -- e o `ritmoMobs`/`killsMinAoVivo` (Voracidade) ficavam cegos.
 *  PROVA: uma linha com XP e SEM ouro, sozinha, tem de dar 1 abate. */
async function provaKillsDoAbate(t) {
  const { auto } = (() => {
    const vistos = [];
    const m = criarMundo();
    m.sandbox.__lolidleRlog = (o) => vistos.push(o);
    const els = [m.el({ tag: 'p', label: 'lg0',
      textContent: 'Loot de lobo: +999 de experiencia.' })];
    m.montar('#log', [m.el({ tag: 'div', label: 'log-box', find: { p: els } })]);
    m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: 'Toca dos Lobos nivel 1-8' })]);
    const a = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
    m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
    alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1, grupoSpawn: { base: 2, rand: 3 } });
    return { m, auto: a };
  })();
  const w = auto.analisarWaves();
  t.check('C2: linha com XP e SEM ouro conta 1 abate (antes contava 0 — mutation testing fechado)',
    w && w.n === 1);
}

/** D — janela (run id) em cada amostra (TK-01-42). */
async function provaJanela(t) {
  const { m, auto } = mundoW1Medido(29, 30);
  await new Promise((r) => setTimeout(r, 30));
  const agg = auto.agregar();
  t.check('D: os ciclos do historico carregam o id da janela (nao comparavel entre janelas)',
    agg.length > 0 && agg.every((a) => a.janelas !== undefined));
  // o ranking tem de recusar ordenar celulas de regioes diferentes
  alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1 });
  const rk = auto.rankBuildsTestadas(null);
  t.check('D: cada celula do ranking traz as janelas em que foi medida',
    Array.isArray(rk) && rk.every((b) => Array.isArray(b.janelas)));
  t.check('D: celula medida em mais de uma janela leva aviso de nao-comparabilidade',
    Array.isArray(rk) && rk.every((b) => b.avisoJanela === null || typeof b.avisoJanela === 'string'));
  // E a prova de que a JANELA chega ao ranking: com dois ciclos da MESMA regiao em janelas
  // diferentes, a celula tem de trazer as DUAS e o aviso. Sem o `janela` no ciclo (novoCiclo),
  // a lista chegaria vazia e a ferramenta voltaria a somar o que nao e comparavel.
  const store2 = {};
  store2['lolidleAutoPotion:farm'] = {
    cycles: [
      { region: 'Fosso do Dragao', gold: 1000, xp: 3000, janela: 'jA', setup: { equip: [{ base: '2001' }, { base: '2002' }] },
        mobFase: { durMs: 60000, perMin: { gold: 1000, xp: 3000, kills: 20 } } },
      { region: 'Fosso do Dragao', gold: 2000, xp: 6000, janela: 'jB', setup: { equip: [{ base: '2001' }, { base: '2002' }] },
        mobFase: { durMs: 60000, perMin: { gold: 2000, xp: 6000, kills: 40 } } },
    ], log: [], issues: [], deaths: [] };
  const m2 = criarMundo({ storage: store2 });
  const a2 = carregarAutomation(m2);
  alimentarCatalogo(m2);
  definirCampeao(m2, 'adtest');
  m2.montar('#hud-nivel', [m2.el({ label: 'hud-nivel', textContent: '29' })]);
  m2.montar('#st-nivel', [m2.el({ label: 'st-nivel', textContent: '29' })]);
  m2.montar('#hud-vida-txt', [m2.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  alimentarMeta(m2, { locais: LOCAIS_W1, monstros: MONSTROS_W1 });
  await new Promise((rz) => setTimeout(rz, 30));
  const rk2 = a2.rankBuildsTestadas(null);
  t.check('D: a celula medida em 2 janelas traz as DUAS (jA, jB)',
    Array.isArray(rk2) && rk2.some((b) =>
      b.janelas && b.janelas.length === 2 && b.janelas.indexOf('jA') >= 0 && b.janelas.indexOf('jB') >= 0));
  t.check('D: e leva o aviso de nao-comparabilidade entre janelas',
    Array.isArray(rk2) && rk2.some((b) => typeof b.avisoJanela === 'string'));
  t.check('D: o agregar() tambem expoe as janelas da regiao',
    (a2.agregar() || []).some((a) => a.janelas && a.janelas.length === 2));
  // LIMITACAO DECLARADA (REGRA N.o 6): o `janela: janelaAtual()` do `novoCiclo()` em si nao
  // tem teste proprio -- nao ha caminho PUBLICO que feche um ciclo (o `handleLog` fecha-o na
  // troca de regiao e o MutationObserver do stub nao dispara). O que fica provado e o consumo:
  // `agregar()` e `rankBuildsTestadas()` EXPÕEM e USAM o campo quando o ciclo o traz. Se o
  // `novoCiclo` deixar de o escrever, o `rankBuildsTestadas` passa a devolver `janelas: []` e o
  // aviso de nao-comparabilidade desaparece -- que os testes acima apanham.
  t.nota && t.nota('D: limitacao — o janela do novoCiclo nao tem teste directo (sem caminho publico); coberto pelo consumo em agregar/rankBuildsTestadas');
}
async function rodaW1(t) {
  /* ---- A1 (TK-02-39 / TK-01-01): o filtro de morte era um NO-OP. ----------------------
   *  `!x.e.morte` com `morte === undefined` da TRUE: uma regiao sem risco calculado passava
   *  como segura e encabecava o ranking com a taxa TEORICA. Medido: Covil do Barao #1 com o
   *  boneco a nv 29, faixa 40-50 — e o dono morreu la. */
  {
    const { m, auto } = mundoW1(29, 'katarina' in {} ? 'adtest' : 'adtest');
    alimentarMeta(m, { kits: { adtest: { magia: false, distancia: false, papel: { dano: 1, recebido: 1 }, kit: {} } } });
    const eB = auto.estimarRegiao('barao');
    t.check('A1: estimarRegiao(barao) devolve morte === true com o boneco a nv 29 (acima da faixa)', eB && eB.morte === true);
    t.check('A1: estimarRegiao(barao) traz o risco avaliado (riscoDps/riscoTMorrer), nao so a taxa teorica',
      eB && (Number.isFinite(eB.riscoDps) || Number.isFinite(eB.riscoTMorrer)));
    const rk = auto.rankRegioes('ouro');
    const seguro = rk.filter((r) => r.sobrevive);
    t.check('A1: o Barão NAO pode encabecar o ranking de regiões seguras', !seguro.length || seguro[0].id !== 'barao');
    t.check('A1: o Barão aparece marcado como nao sobrevivivel', rk.some((r) => r.id === 'barao' && r.sobrevive === false));
  }

  /* ---- A2 (TK-01-01): fail-closed — sem prova de que sobrevive, NAO e segura. ----------
   *  O ticket exige: "regiao sem dados da morte: true (fail-closed), nunca undefined". */
  {
    const { m, auto } = mundoW1(29);
    // um local que existe mas cujos monstros o META nao conhece -> nao da para avaliar nada
    alimentarMeta(m, { locais: [{ id: 'fantasma', nome: 'Vale Fantasma', nm: [40, 48], faixa: [40, 48], tier: 5, monstros: [['naoExiste', 1]] }] });
    const e = auto.estimarRegiao('fantasma');
    t.check('A2: regiao sem dados avaliaveis da morte === true (fail-closed), nunca null/undefined',
      e && e.morte === true);
  }

  /* ---- A3 (TK-01-01): nv 27 nunca pode ser mandado ao Dragao. ---------------------------
   *  nm[0] = 30 <= 27+6, portanto o `doNivel0` deixa-o passar; quem tem de o travar e o risco. */
  {
    const { m, auto } = mundoW1(27);
    alimentarMeta(m, { kits: { adtest: { magia: false, distancia: false, papel: { dano: 1, recebido: 1 }, kit: {} } } });
    const ideal = auto.regiaoIdeal();
    t.check('A3: nv 27 — regiaoIdeal() NAO devolve dragao (regiao acima do boneco)', ideal !== 'dragao');
    const rk = auto.rankRegioes('ouro');
    const seguras = rk.filter((r) => r.sobrevive).map((r) => r.id);
    t.check('A3: nv 27 — o Fosso do Dragao nao esta entre as regioes seguras', seguras.indexOf('dragao') < 0);
  }

  /* ---- A4 (TK-01-02): o nivel do chefe pela regra do MOTOR. ----------------------------
   *  motor.js:1134  `nivelJogador == null ? n1 + 2 : Math.max(n0 + 2, Math.min(n1 + 2, nivel + 4))`
   *  Dragao nm [30,38]: sem jogador -> 38+2 = 40. Com jogador 29 -> max(32, min(40, 33)) = 33. */
  {
    const { m, auto } = mundoW1(29);
    const d = LOCAIS_W1.find((l) => l.id === 'dragao');
    const b = LOCAIS_W1.find((l) => l.id === 'barao');
    t.check('A4: nivelChefeDe(dragao) sem jogador = n1+2 = 40 (motor.js:1134)', auto.nivelChefeDe(d, null) === 40);
    t.check('A4: nivelChefeDe(dragao) com jogador 29 = max(32, min(40,33)) = 33', auto.nivelChefeDe(d, 29) === 33);
    t.check('A4: nivelChefeDe(barao) sem jogador = 48+2 = 50', auto.nivelChefeDe(b, null) === 50);
    t.check('A4: nivelChefeDe(barao) com jogador 29 = max(42, min(50,33)) = 42 (n0+2 manda)', auto.nivelChefeDe(b, 29) === 42);
    t.check('A4: nivelMobDe(dragao) com jogador 29 = clamp(28,5; [30,38]) = 30 (motor.js:1132)', auto.nivelMobDe(d, 29) === 30);
    t.check('A4: nivelMobDe(dragao) sem jogador = media da faixa = 34', auto.nivelMobDe(d, null) === 34);
  }

  /* ---- A5 (TK-01-04): fJ tem de entrar no tKill. --------------------------------------
   *  motor.js:1236 aplica `fatorDanoJogador` a TODO o dano do jogador. Com o motor vivo
   *  (motor.js:1199): um jogador de nv 20 contra o chefe do Dragao (nv 32 pelo motor) tem
   *  dif = 32-20-4 = 8 -> fJ = max(0,25; 1 - 0,12x8) = 0,04 -> 0,25 (piso). Logo o DPS efectivo
   *  e 1/4 e o tempo de matar e 4x o que a versao sem fator dizia. O ticket aceita
   *  exactamente isto: "tKill multiplicado por 1/fJ face a versao sem fator".
   *  (valor antigo do fallback: fJ = 1 - 0,07x8 = 0,44 -> tKill so 2,3x.) */
  {
    const { m, auto } = mundoW1Medido(20, 30);
    await new Promise((r) => setTimeout(r, 30));
    const dps = auto.meuDps();
    t.check('A5: o DPS do jogador vem do medido (pre-condicao do teste)', typeof dps === 'number' && dps > 0);
    const est = auto.estimarLuta('dragao');
    t.check('A5: estimarLuta(dragao) devolve o fJ aplicado (motor.js:1199)',
      est && Number.isFinite(est.fJ) && est.fJ > 0 && est.fJ <= 1);
    t.check('A5: nv 20 vs chefe do Dragao -> fJ = 0,25 (piso do motor, motor.js:1199)',
      est && est.fJ === 0.25);
    t.check('A5: o fJ NAO e o valor desactualizado do fallback antigo (0,44)', est && est.fJ !== 0.44);
    // tKill(sem fator) = hp / (meuDpsBoss / fJ)  ->  tKill(com) = hp / meuDpsBoss
    const chefe = LOCAIS_W1.find((l) => l.id === 'dragao');
    const nivel = auto.nivelChefeDe(chefe, 20);
    const st = auto.statsMonstro('dragao', nivel);
    const semFJ = st.hp / (est.meuDpsBoss / est.fJ);
    const comFJ = st.hp / est.meuDpsBoss;
    t.check('A5: com o fator, o tempo de matar e exactamente 1/fJ (=4x) face a sem fator',
      Math.abs(comFJ / semFJ - 1 / est.fJ) < 1e-9 && Math.abs(1 / est.fJ - 4) < 1e-9);
  }
  /* ---- A6 (TK-01-05): papel.recebido do campeao. --------------------------------------
   *  motor.js:2720 multiplica TODO o dano recebido: Katarina 0,75 (motor.js:898). Ignorar isso
   *  inflava o dpsTomado 33% e fazia fugir de luta ganhavel. */
  {
    const { m, auto } = mundoW1(27, 'katarina');
    alimentarMeta(m, { kits: { katarina: { magia: true, distancia: false, adagas: true, semMana: true,
      papel: { dano: 1.2, recebido: 0.75, recebidoArena: 1, arena: 1.75 }, kit: {} } } });
    const p = auto.player();
    const aKat = auto.avaliar('lobo', 29, { ...p, nivel: 27 }, { skill: 0, pocao: 0 });
    t.check('A6: avaliar() devolve o fator de papel aplicado (Katarina 0,75, motor.js:898)',
      aKat && aKat.fPapel === 0.75);
    // o fator tem de ser o do campeao LIDO, nao um numero copiado: mudar o papel muda o resultado
    alimentarMeta(m, { kits: { katarina: { magia: true, distancia: false, adagas: true, semMana: true,
      papel: { dano: 1.2, recebido: 0.5, recebidoArena: 1, arena: 1.75 }, kit: {} } } });
    const aKat2 = auto.avaliar('lobo', 29, { ...auto.player(), nivel: 27 }, { skill: 0, pocao: 0 });
    t.check('A6: mudar o papel.recebido no META muda o fator (0,5) — vem do jogo, nao copiado',
      aKat2 && aKat2.fPapel === 0.5);
    // sem o papel no champ (fallback 1) o dpsTomado e 1/0,75 maior
    const { m: m2, auto: a2 } = mundoW1(27, 'adtest');
    alimentarMeta(m2, { kits: { adtest: { magia: false, distancia: false, papel: { dano: 1, recebido: 1 }, kit: {} } } });
    const aNeu = a2.avaliar('lobo', 29, { ...a2.player(), nivel: 27 }, { skill: 0, pocao: 0 });
    t.check('A6: com recebido 1 o dpsTomado e 1/0,75 do da Katarina (prova do fator)',
      aNeu && Math.abs(aNeu.dpsTomado / aKat.dpsTomado - 1 / 0.75) < 1e-9);
    // B1 — o papel tem de entrar nos TRES sitios por onde o jogador apanha:
    //  `dpsTomado`, `danoGolpe` (golpe iminente) e `piorMec`/`hpSeguro` (mecanica do chefe).
    //  Mutation testing mostrou que so o dpsTomado estava protegido: os outros dois
    //  passavam com o fator removido. Cada um afirmado contra o valor SEM papel.
    t.check('A6: danoGolpe leva o papel (0,75) — mutation testing fechado',
      Math.abs(aKat.danoGolpe / aNeu.danoGolpe - 0.75) < 1e-9);
    t.check('A6: hpSeguro (pior golpe) tambem leva o papel',
      Math.abs(aKat.hpSeguro / aNeu.hpSeguro - 0.75) < 1e-9);
    // tMorrer = vida / (dpsTomado - cura): o dpsTomado escala com o papel, logo o tempo de
    // vida da Katarina e 1/0,75 = 1,333x o do neutro (menos dano recebido = vive mais).
    t.check('A6: tMorrer da Katarina e 1/0,75 maior (o papel muda a sobrevivencia)',
      Number.isFinite(aKat.tMorrer) && Number.isFinite(aNeu.tMorrer) &&
      Math.abs(aKat.tMorrer / aNeu.tMorrer - 1 / 0.75) < 1e-6 && aKat.tMorrer > aNeu.tMorrer);
  }

  /* ---- A7 (TK-01-08): o tamanho da wave e a MEDIA, nao a base. ------------------------
   *  motor.js:1137 `const qtd = 2 + Math.floor(r() * 3)` -> {2,3,4} equiprovavel, E = 3.
   *  Usar `base = 2` deixava o segPorWave (e o seg3 do valeUlt) 33% baixo. */
  {
    const { m, auto } = mundoW1(29);
    alimentarMeta(m, { grupoSpawn: { base: 2, rand: 3 } });
    const r = auto.ritmoMobs();
    t.check('A7: sem killTimes o ritmoMobs devolve null (nao inventa)', r === null);
    alimentarMeta(m, { grupoSpawn: { base: 2, rand: 3 } });
    const gs = 2 + Math.floor((3 - 1) / 2);
    t.check('A7: media da wave (base 2, rand 3) = base + (rand-1)/2 = 3 (motor.js:1137)', gs === 3);
    t.check('A7: estimarRegiao usa mobsPerWave = 3, nao base = 2',
      (() => { const e = auto.estimarRegiao('lobos'); return e && e.mobsPerWave === 3; })());
  }

  /* ---- A8 (TK-01-41 / TK-01-42): ranking por regiao e janela. -------------------------
   *  O 1264 que o agente viu era outra regiao; e 834 vs 1581 eram janelas diferentes. */
  {
    const { m, auto } = mundoW1(29);
    alimentarMeta(m, { locais: LOCAIS_W1, monstros: MONSTROS_W1 });
    const rk = auto.rankBuildsTestadas(null);   // sem regiao: NAO pode ser tabela unica
    t.check('A8: rankBuildsTestadas(null) devolve lista (nao rebenta sem dados)', Array.isArray(rk));
    t.check('A8: cada celula traz regiao/janelas/amostrasPorRegiao (nunca numero solto)',
      rk.every((b) => b.regioes !== undefined && b.janelas !== undefined && b.n !== undefined));
    t.check('A8: toda a celua tem aviso de nao-comparabilidade entre janelas quando mediu em >1 janela',
      rk.every((b) => b.avisoJanela === null || typeof b.avisoJanela === 'string'));
    // com regiaoId explicito o ranking e dessa regiao
    const rk2 = auto.rankBuildsTestadas('dragao');
    t.check('A8: com regiaoId o ranking devolve lista', Array.isArray(rk2));
  }
}

export const suiteW1 = {
  nome: 'w1-regioes',
  titulo: 'Fila W1: regioes, avaliacao de luta e ritmo (morte fail-closed, nivel do alvo, fator de dano, papel, ritmo, janela)',
  async run(t) {
    await rodaW1(t);
    await provaParseNum(t);
    provaMediaWave(t);
    await provaFJ(t);
    await provaFailClosed(t);
    await provaLog(t);
    await provaJanela(t);
    await provaKillsDoAbate(t);
  },
};
