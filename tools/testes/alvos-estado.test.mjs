/*
 * alvos-estado.test.mjs - ALVOS DO AUTO-PLAY, BARRA POR DISPONIBILIDADE, TAREFAS POR VALOR/s
 * e ESTADO COMPLETO DO JOGO (pedido do dono, 2026-10-18).
 *
 * O que se protege (cada check afirma um numero/comportamento que so a versao CERTA produz —
 * REGRA N.º 6: verde sem discriminacao nao e prova):
 *   A1 - `champAlvo` aceita id, lista CSV, array e null; `campeoesAlvo()` normaliza as quatro;
 *   A2 - a migracao one-shot `'yasuo' -> ['yasuo','ryze']` (CFG_VER 2) e a lista do dono fica intacta;
 *   A3 - `campeoesDoJogo()` le os ids dos KITS que o motor manda (nunca copiados);
 *   A4 - `ehCampeaoAlvo()` com a LISTA (o defeito: so aceitava um id);
 *   B1 - a DISPONIBILIDADE passa a MANDAR na `barraIdeal` (uma skill PRONTA entra a frente de uma
 *        de dano alto em recarga) — e `barraPorDisponibilidade:false` volta a ordenacao estavel;
 *   B2 - o campo `espalha` do kit (Ryze E = 3) decide a barra de MOBS (e sai no chefe);
 *   C1 - `aceitarTarefa` pontua por VALOR/SEGUNDO com o MEU ritmo medido (a mesma tarefa vale mais
 *        onde eu mato mais rapido) — nao pelo `~min` do jogo nem por uma penalizacao fixa de tipo;
 *   D1 - `estadoCompleto()` mantem inventario/equip/habilidades/cofre/mobs gravados em STORAGE.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao, montarMochila, IMG_HAB_SEL } from './dom-stub.mjs';

const STORAGE_KEY = 'lolidleAutoPotion';
const flush = () => new Promise((r) => setTimeout(r, 0));

/* ------------------------------------------------------------------------------------ *
 *  A/B — alvos, migracao e barra
 * ------------------------------------------------------------------------------------ */
function mundoBarra() {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  // kit de teste: F (alvo unico forte) · Q · A · E (espalha 3) · B (fraco) · R (ultimate)
  const kit = {
    Q: { nivel: 1, max: 10, base: [300], ratio: [0], recarga: [10] },
    A: { nivel: 1, max: 10, base: [250], ratio: [0], recarga: [10] },
    B: { nivel: 1, max: 10, base: [50], ratio: [0], recarga: [10] },
    E: { nivel: 1, max: 10, base: [100], ratio: [0], recarga: [10], espalha: 3 },
    F: { nivel: 1, max: 10, base: [400], ratio: [0], recarga: [10] },
    R: { nivel: 6, max: 5, base: [500], ratio: [0], recarga: [75, 65, 55, 48, 42] },
  };
  definirCampeao(m, 'aptest', { kit, magia: false });
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
  m.montar('.st', [m.el({ label: 'st-dano', textContent: 'Dano 300' })]);
  m.montar('#hab-ativas .hab[data-t]', ['F', 'Q', 'A', 'E', 'B', 'R'].map((tt) => m.el({
    tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
    textContent: (tt === 'R' ? 1 : 10) + ' / ' + (tt === 'R' ? 5 : 10),
  })));
  return { m, auto, ars: ['F', 'Q', 'A', 'E', 'B', 'R'].map((t) => ({ t, rank: t === 'R' ? 1 : 10 })) };
}

function provaBarra(t) {
  const { auto, ars } = mundoBarra();
  const clon = () => ars.map((h) => ({ t: h.t, rank: h.rank }));

  /* ---- B1 - a DISPONIBILIDADE manda (regra do dono: "usava tudo disponivel") ---- */
  // Equipados: o ultra-forte F com 8 s de recarga, o Q e o A tambem em recarga; o E esta PRONTO.
  const bar = [{ t: 'F', cd: 8 }, { t: 'Q', cd: 8 }, { t: 'A', cd: 8 }, { t: 'E', cd: 0 }, { t: 'R', cd: 0 }];
  const mobs = auto.barraIdeal({ arsenal: clon(), bar: bar.slice() }, 'mobs');
  t.check('B1: a skill PRONTA (E) entra na barra', mobs.indexOf('E') >= 0);
  t.check('B1: ...e fica logo a seguir a ultimate, A FRENTE da de dano alto em recarga (F)',
    mobs.indexOf('E') < mobs.indexOf('F'));
  t.check('B1: a ultimate continua em 1.o (inviolavel)', mobs[0] === 'R');
  t.check('B1: a barra enche os 4 slots', mobs.length === 4);

  // CONTROL: com a antiga ordenacao (DPS primeiro, disponibilidade so a desempatar) o F vem antes.
  auto.setConfig({ barraPorDisponibilidade: false });
  const estab = auto.barraIdeal({ arsenal: clon(), bar: bar.slice() }, 'mobs');
  t.check('B1: CONTROL barraPorDisponibilidade=false -> o F (mais dano) vem ANTES do E pronto',
    estab.indexOf('F') < estab.indexOf('E'));
  auto.setConfig({ barraPorDisponibilidade: true });

  /* ---- B2 - o `espalha` do kit (Ryze E) decide a barra de MOBS ---- */
  // Sem `bar` (tudo pronto) o peso da fase decide: em mobs o E (espalha 3, base 100) pesa 30 e
  // entra; no chefe pesa 10 e sai (F 40 · Q 30 · A 25 ficam). Sem `espalha` o E nunca entrava.
  const mSemBar = auto.barraIdeal({ arsenal: clon() }, 'mobs');
  const bSemBar = auto.barraIdeal({ arsenal: clon() }, 'boss');
  t.check('B2: em MOBS o E (espalha 3) entra', mSemBar.indexOf('E') >= 0);
  t.check('B2: no CHEFE o E sai (alvo unico: F/Q/A sao mais fortes)', bSemBar.indexOf('E') < 0);
  t.check('B2: as duas barras diferem (o espalha muda o CONJUNTO)',
    mSemBar.slice().sort().join(',') !== bSemBar.slice().sort().join(','));
}

/* ------------------------------------------------------------------------------------ *
 *  A1-A4 — alvos configuraveis
 * ------------------------------------------------------------------------------------ */
function provaAlvos(t) {
  const { auto } = mundoBarra();

  auto.setConfig({ champAlvo: 'aptest' });
  t.check('A1: id simples normaliza para lista', JSON.stringify(auto.campeoesAlvo()) === JSON.stringify(['aptest']));
  auto.setConfig({ champAlvo: 'yasuo, ryze' });
  t.check('A1: CSV normaliza (trim + lowercase)', JSON.stringify(auto.campeoesAlvo()) === JSON.stringify(['yasuo', 'ryze']));
  auto.setConfig({ champAlvo: ['Ryze', 'Yasuo'] });
  t.check('A1: array normaliza (lowercase)', JSON.stringify(auto.campeoesAlvo()) === JSON.stringify(['ryze', 'yasuo']));
  auto.setConfig({ champAlvo: null });
  t.check('A1: null = qualquer campeao (lista vazia)', auto.campeoesAlvo().length === 0);
  auto.setConfig({ champAlvo: '' });
  t.check('A1: string vazia = qualquer campeao', auto.campeoesAlvo().length === 0);

  auto.setConfig({ champAlvo: ['outro', 'aptest'] });
  t.check('A4: com o campeao na LISTA (2.o elemento), ehCampeaoAlvo() diz que e alvo', auto.ehCampeaoAlvo() === true);
  auto.setConfig({ champAlvo: ['outro', 'mais-um'] });
  t.check('A4: com o campeao fora da lista, ehCampeaoAlvo() diz que nao', auto.ehCampeaoAlvo() === false);
  auto.setConfig({ champAlvo: ['outro'] });
  t.check('A4: fora da lista ate com 1 elemento', auto.ehCampeaoAlvo() === false);

  const lista = auto.campeoesDoJogo();
  t.check('A3: campeoesDoJogo() traz o id do kit que o motor mandou', Array.isArray(lista) && lista.some((c) => c.id === 'aptest'));
  t.check('A3: cada campeao traz id e nome legivel', lista.every((c) => c.id && c.nome && c.nome !== c.id));

  /* ---- A2 - migracao one-shot ---- */
  const m1 = auto.migrarCfg({ automation: { champAlvo: 'yasuo' } });
  t.check('A2: o default velho "yasuo" migra para a LISTA com o Ryze',
    Array.isArray(m1.cfg.champAlvo) && m1.cfg.champAlvo.join(',') === 'yasuo,ryze');
  t.check('A2: a migracao e reportada (para o log)', m1.migrou.some((x) => x.chave === 'champAlvo'));
  const m2 = auto.migrarCfg({ automation: { champAlvo: 'katarina' } });
  t.check('A2: a escolha EXPLICITA do dono (outro campeao) fica INTACTA', m2.cfg.champAlvo === 'katarina');
  const m3 = auto.migrarCfg({ automation: { champAlvo: 'yasuo' }, cfgVer: auto.CFG_VER });
  t.check('A2: config ja migrada nao volta a migrar (one-shot)', !m3.migrou.some((x) => x.chave === 'champAlvo'));
  t.check('A2: CFG_VER subiu para 2 (a versao da migracao do champAlvo)', auto.CFG_VER >= 2);
}

/* ------------------------------------------------------------------------------------ *
 *  D1 — estado completo do jogo
 * ------------------------------------------------------------------------------------ */
function provaEstado(t) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'aptest', { kit: { Q: { nivel: 1, max: 5, base: [60], ratio: [0.5], recarga: [10] } } });
  m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: 'Toca dos Lobos nível 1–8' })]);
  m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '12.3k' })]);
  m.montar('#hud-pocoes [data-pocao]', ['vida', 'vidaF', 'vidaS'].map((k) => m.el({
    tag: 'div', label: 'poc-' + k, dataset: { pocao: k },
    find: { b: [m.el({ tag: 'b', label: 'poc-' + k + '-b', textContent: '5' })] },
  })));
  m.montar('#hab-ativas .hab[data-t]', [m.el({
    tag: 'div', label: 'hab-Q', className: 'hab', dataset: { t: 'Q' }, textContent: '3 / 5',
  })]);
  montarMochila(m, [{ id: '3089+S~SS', raridade: 'lendario', dica: 'Chapéu Mágico' }], 30);
  m.montar('#equip > button.slot[data-id]', [m.el({
    tag: 'button', label: 'equip:3020~A', className: 'slot basico epico', attrs: { 'data-id': '3020~A', 'data-dica': 'Botas' },
  })]);
  auto.setConfig({ champAlvo: ['aptest'] });

  const est = auto.estadoCompleto();
  t.check('D1: estadoCompleto devolve campeao/nivel/ouro', !!est && est.campeao === 'aptest');
  t.check('D1: le o ouro do HUD (12.3k = 12300)', est.ouro === 12300);
  t.check('D1: le o local', /Toca dos Lobos/.test(est.local || ''));
  t.check('D1: inventario com used/cap e o item', !!est.inventario && est.inventario.used === 1 && est.inventario.itens.length === 1);
  t.check('D1: equipado traz a peca', est.equipado.length === 1 && est.equipado[0].base === '3020');
  t.check('D1: habilidades traz a barra/ranks', !!est.habilidades && Array.isArray(est.habilidades.ranks) && est.habilidades.ranks.indexOf('Q:3') >= 0);
  t.check('D1: pocoes contadas', !!est.pocoes && est.pocoes.vida === 5);
  t.check('D1: lista de alvos no estado', est.alvo.join(',') === 'aptest');
  t.check('D1: o retrato ficou GRAVADO no storage (a GUI le-o sem varrer o DOM)',
    !!(m.estado.storage[STORAGE_KEY + ':estado'] && m.estado.storage[STORAGE_KEY + ':estado'].at));
}

/* ------------------------------------------------------------------------------------ *
 *  C1 — tarefa por valor/segundo com o MEU ritmo
 * ------------------------------------------------------------------------------------ */
const LOCAIS = [
  { id: 'boa', nome: 'Zona Boa', nm: [1, 30], faixa: [1, 30], tier: 1, monstros: [['bicho', 1]], chefe: null },
  { id: 'ruim', nome: 'Zona Ruim', nm: [1, 30], faixa: [1, 30], tier: 1, monstros: [['bicho', 1]], chefe: null },
];
const MONSTROS = { bicho: { hp: 1, ad: 1, as: 1, armadura: 1, xp: 1, ouro: 1 } };

/** Mundo na Fonte com o historico MEDIDO: 30 abates/min na Zona Boa, 6 na Zona Ruim. */
function mundoTarefa() {
  const store = {};
  store[STORAGE_KEY + ':farm'] = {
    cycles: [
      { region: 'Zona Boa', gold: 3000, xp: 9000, fase: 'mobs', mobFase: { startedAt: 0, durMs: 60000, perMin: { gold: 3000, xp: 9000, kills: 30, potions: 0 }, gold: 3000, xp: 9000, kills: 30 } },
      { region: 'Zona Ruim', gold: 600, xp: 1800, fase: 'mobs', mobFase: { startedAt: 0, durMs: 60000, perMin: { gold: 600, xp: 1800, kills: 6, potions: 0 }, gold: 600, xp: 1800, kills: 6 } },
    ],
    log: [], issues: [], deaths: [],
  };
  const m = criarMundo({ storage: store });
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest');
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  alimentarMeta(m, { locais: LOCAIS, monstros: MONSTROS, grupoSpawn: { base: 2, rand: 3 } });
  // Na Fonte + o Capitão e a janela de tarefas montados (o MESMO caminho do jogo).
  m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: 'Fonte' })]);
  m.montar('#npcs button[data-npc="Capitão da Legião"]', [m.el({ tag: 'button', label: 'npc-capitao' })]);
  m.montar('#janela-npc [data-palavra="tarefa"]', [m.el({ tag: 'button', label: 'palavra-tarefa' })]);
  // Duas ofertas com os MESMOS numeros; so o LUGAR muda (e o meu ritmo la).
  const oferta = (k, lugar, tipo) => {
    const row = m.el({
      tag: 'div', label: 'linha-' + k, className: 'troca-linha tarefa-' + tipo,
      textContent: '20 monstros em ' + lugar + ' ' + (tipo === 'desafio' ? 'Desafio' : 'Normal') + ' ~15 min · 5k de XP · 3k de ouro',
    });
    const btn = m.el({ tag: 'button', label: 'tarefa-' + k, dataset: { tarefa: k } });
    row._find['[data-tarefa]'] = [btn];
    return row;
  };
  const rows = [oferta('ruim', 'Zona Ruim', 'desafio'), oferta('boa', 'Zona Boa', 'normal')];
  m.montar('#npc-troca .troca-linha', rows);
  m.montar('#npc-troca [data-tarefa]', rows.map((r) => r._find['[data-tarefa]'][0]));
  return { m, auto };
}

async function provaTarefa(t) {
  const { m, auto } = mundoTarefa();
  const r = await auto.aceitarTarefa();
  t.check('C1: aceitarTarefa correu (fixture valida)', !!r && r.ok === true);
  t.check('C1: escolheu a oferta da ZONA BOA (onde eu mato mais rapido)', r.lugar === 'Zona Boa');
  // A Zona Boa tem 30 abates/min medidos: 20 abates equivalentes -> ~0,67 min reais (nao os 15 do jogo).
  const boa = (r.todas || []).find((o) => o.lugar === 'Zona Boa');
  const ruim = (r.todas || []).find((o) => o.lugar === 'Zona Ruim');
  t.check('C1: minReal da Zona Boa = 20/30 = ~0,7 min (o MEU ritmo, nao os 15 do jogo)',
    !!boa && boa.minReal != null && Math.abs(boa.minReal - 0.667) < 0.05);
  t.check('C1: minReal da Zona Ruim = 20/6 = ~3,3 min (mais lento)', !!ruim && ruim.minReal > 3);
  t.check('C1: a Zona Boa pontua MAIS que a Zona Ruim (valor/segundo)', !!boa && !!ruim && boa.score > ruim.score);
  t.check('C1: o ritmo medido de cada zona entrou na decisao', !!boa && boa.ritmo === 30 && !!ruim && ruim.ritmo === 6);
  t.check('C1: o clique final foi na oferta boa', m.cliqueDe('tarefa-boa') === true && m.cliqueDe('tarefa-ruim') === false);
}

export const suite = {
  nome: 'alvos-estado',
  titulo: 'Alvos do auto-play, barra por disponibilidade/espalha, tarefas por valor/s e estado completo',
  async run(t) {
    provaAlvos(t);
    provaBarra(t);
    await provaTarefa(t);
    provaEstado(t);
  },
};
