/*
 * planejar.test.mjs - PLANEJADOR DE FARM: a tabela de drops depende da CLASSE do campeão.
 *
 * TK-02-03 (P0). ANTES: `planejar()` era class-blind — lia `z.porClasse.ap || z.porClasse.ad`
 * e portanto preferia SEMPRE a tabela AP, mesmo num campeão AD (parte-02.md:313-314/340-341).
 * MEDIDO: respondia "onde dropa o item X" com zonas por drops que o campeão nunca recebe.
 *
 * FONTE (REGRA Nº 1 — lido em docs/game-src/motor.js, não copiado):
 *   motor.js:383  const DROPS      = { ... }   -> l.drops    (tabela AD)
 *   motor.js:397  const DROPS_AP   = { ... }   -> l.dropsAp  (tabela AP)
 *   motor.js:407  `for (const l of LOCAIS) { if (DROPS[l.id]) l.drops = ...; if (DROPS_AP[l.id]) l.dropsAp = ...; }`
 *   motor.js:391  barao/DROPS    lendario: ['3031', ...]   <- Gume do Infinito (AD), SEM o 3089
 *   motor.js:405  barao/DROPS_AP lendario: ['3089', ...]   <- Rabadon (AP), SEM o 3031
 *   wiki-dados.js:48-58  `ONDE_ITEM[id][z.id] = { zona, porClasse: { ad|ap } }`
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarMeta, definirCampeao, CATALOGO } from './dom-stub.mjs';

/** Zonas no formato que o inject.js reencaminha (motor.js LOCAIS + wiki-dados.js ONDE_ITEM). */
const ZONA_BARAO = { id: 'barao', nome: 'Covil do Barão', nm: [40, 48], monstros: [['Larva do Vazio', 1]], chefe: ['Barão Nashor', 1] };

/** ONDE_ITEM real: 3089 SÓ na tabela AP do Barão; 3031 SÓ na tabela AD (motor.js:391 vs :405). */
const ONDE_ITEM = {
  '3089': { barao: { zona: ZONA_BARAO, porClasse: { ap: 0.02 } } },
  '3031': { barao: { zona: ZONA_BARAO, porClasse: { ad: 0.02 } } },
  // Zona de OUTRO mundo (Runeterra/Freljord), como o jogo a manda: `mundo: true`. A rota nunca
  // pode passar por aqui (a extensão só anda no Rift) e é isto que o P6 prova.
  '3089b': { fjfloresta: { zona: { id: 'fj-floresta', nome: 'Floresta dos Pinheiros Brancos', mundo: true }, porClasse: { ap: 0.9 } } },
};

/** `META.locais` como o inject o reencaminha: `faixa` é o marcador de região de farm do Rift. */
const LOCAIS = [
  Object.assign({}, ZONA_BARAO, { faixa: [40, 50], tier: 7 }),
  { id: 'fj-floresta', nome: 'Floresta dos Pinheiros Brancos', mundo: true, faixa: [1, 10] },
];

/** Monstros do Barão (motor.js:290/297). */
const MONSTROS = {
  'Larva do Vazio': { hp: 1.1, ad: 1.05, as: 0.8, armadura: 1, xp: 1.1, ouro: 1, magico: true },
  'Barão Nashor': { hp: 16, ad: 3.2, as: 0.5, armadura: 1.8, xp: 20, ouro: 20, chefe: true, magico: true },
};

/** Ciclos medidos na região do Barão: 12 abates/min -> killsH = 720/h (motor: chance por abate). */
const CYCLES = [
  { region: 'Covil do Barão 40–48', endedAt: 2, deaths: 0, boss: 'Barão Nashor',
    mobFase: { perMin: { gold: 5000, xp: 3000, kills: 12, potions: 1 }, hpMin: 3000, hpMax: 4000 },
    bossFase: { durMs: 60000 } },
];

/** Catálogo do banco + o 3031 real (itens.js:2534) — o 3089 já está no CATALOGO do stub. */
const ITENS = CATALOGO.concat([
  { id: '3031', nome: 'Gume do Infinito', raridade: 'lendario', espaco: 'arma', ad: 75, critico: 0.25, preco: 3500, de: ['1001'] },
]);

export const suite = {
  nome: 'planejar',
  titulo: 'Planejador class-aware: a tabela de drops segue a classe do campeão (motor.js:383/397/407)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarMeta(m, { itens: ITENS, monstros: MONSTROS, ondeItem: ONDE_ITEM, locais: LOCAIS,
      // Poção no META (caminho do motor) + cargas no HUD: com poção que cobre a janela, o
      // adjudicador usa `tMatar` quando o DPS existe e 'nao-sei' quando não existe. Sem poção
      // ele responde 'mata' por falta de cobertura — o que esconderia o tri-estado (REGRA Nº 6).
      pocoes: { vidaS: { cura: 20000, preco: 300, nivel: 1 } } });
    auto.importar({ farm: { cycles: CYCLES, log: [], issues: [] } });
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '2000 / 2000' })]);
    m.montar('#hud-pocoes [data-pocao]', ['vida', 'vidaF', 'vidaS'].map((k) => m.el({
      tag: 'div', label: 'poc-' + k, dataset: { pocao: k },
      find: { b: [m.el({ tag: 'b', label: 'poc-' + k + '-b', textContent: k === 'vidaS' ? '5' : '0' })] },
    })));

    const plano = (champ, ids) => { definirCampeao(m, champ); return auto.planejar(ids); };
    const chanceDe = (r, item) => { const x = (r || []).find((y) => y.item === item); return x ? x.chance : 0; };
    const dropsHDe = (r, item) => { const x = (r || []).find((y) => y.item === item); return x ? x.dropsH : null; };

    /* ---- AP: o Barão continua a ser a resposta para o 3089 ---- */
    const ap = plano('aptest', ['3089']);
    t.check('P1: campeão AP -> o Barão devolve o 3089 (chance > 0)', chanceDe(ap, '3089') > 0);
    t.check('P1: a chance AP é a da tabela DROPS_AP (motor.js:405)', Math.abs(chanceDe(ap, '3089') - 0.02) < 1e-9);
    t.check('P1: com kills medidas, o drops/h é finito (720/h x 0,02)', dropsHDe(ap, '3089') > 0);

    /* ---- AD: o 3089 NÃO é respondido com a zona do Barão ---- */
    const ad = plano('adtest', ['3089']);
    t.check('P2: campeão AD -> o 3089 tem chance 0 (a tabela AD não o tem, motor.js:391)', chanceDe(ad, '3089') === 0);
    t.check('P2: e portanto não há drops/h a prometer', dropsHDe(ad, '3089') === null);

    /* ---- controlo: o Barão responde ao 3031 num campeão AD ---- */
    const ad3031 = plano('adtest', ['3031']);
    t.check('P3: campeão AD -> o 3031 (Gume do Infinito) cai no Barão (motor.js:391)', chanceDe(ad3031, '3031') > 0);
    t.check('P3: e num campeão AP o 3031 não cai lá (motor.js:405 não o lista)', chanceDe(plano('aptest', ['3031']), '3031') === 0);

    /* ---- o plano é uma FUNÇÃO do campeão pedido: mesma entrada, saídas distintas ---- */
    t.check('P4: AP->3089 chance ' + chanceDe(plano('aptest', ['3089']), '3089') + ' e AD->3089 chance ' + chanceDe(plano('adtest', ['3089']), '3089'),
      chanceDe(plano('aptest', ['3089']), '3089') > 0 && chanceDe(plano('adtest', ['3089']), '3089') === 0);
    t.check('P5: nenhum seletor desconhecido foi usado (stub honesto)', m.unstubbed().length === 0);

    /* ---- zona de OUTRO MUNDO nunca entra na rota (Runeterra/Freljord) ----
     * DEFEITO MEDIDO AO VIVO (2026-10-23): a rota guardada tinha "Floresta dos Pinheiros
     * Brancos", que a extensão não alcança pelo mapa do Rift. Agora `planejar` usa a MESMA
     * fonte da `regiaoRecomendada` (`ehRegiaoDeFarm`) e falha fechado quando a zona não
     * está no `META.locais`. */
    const fora = plano('aptest', ['3089b']);
    t.check('P6: zona fora do Rift (mundo:true) nao entra no plano', (fora || []).length === 0);
    t.check('P6b: zona ausente do META.locais falha fechado', (plano('aptest', ['9999']) || []).length === 0);

    /* =====================================================================================
     * P7/P8 (2026-10-24) — O VEREDICTO DO CHEFE É TRI-ESTADO, E O DPS DE SAÍDA VAI JUNTO.
     *
     * QUEIXA DO DONO, verbatim: *"prova que mata"* — sobre a frase da GUI
     *   "Melhor destino para a sua escolha: Covil do Barão · 0 drops/hora de Capuz da Morte
     *    de Rabadon · ⚠ o chefe dessa zona mata você".
     *
     * CAUSA (lida, não deduzida): `planejar` chamava `avaliar(chefe, nivel, p, cura)` — QUATRO
     * argumentos. `avaliar` calcula `tMatar = dps > 0 ? hp/dps : null` (automation.js:3612) e o
     * adjudicador D01 usa `tMatar == null` para cair no critério conservador; o `veredicto` desse
     * caso é 'nao-sei' (automation.js:3653-3654). A GUI lia o `morre` e imprimia "mata você".
     * Ou seja: a frase era a FALTA DE DADO a falar. Agora o DPS de saída entra (`dpsContra`),
     * e o que não se sabe diz-se que não se sabe.
     *
     * Prova de que o caminho MEDIDO é real e não decorativo: `meuDps()` só devolve número numa
     * região DPS-limitada — o CYCLES desta suíte tem 12 abates/min contra 120/h teóricos
     * (motor.js:1132/1739), logo há medição e `dpsContra` devolve número.
     * ===================================================================================== */
    const regDe = (r, item) => (r || []).find((y) => y.item === item) || null;
    const apRec = regDe(ap, '3089');
    t.check('P7: com DPS medido, o chefe tem veredicto PROVADO (nao e "nao-sei")',
      !!apRec && (apRec.veredictoChefe === 'mata' || apRec.veredictoChefe === 'nao-mata'));
    t.check('P7b: e o veredicto do mob tambem saiu do "nao sei"',
      !!apRec && apRec.veredictoMob !== 'nao-sei' && apRec.veredictoMob != null);
    t.check('P7c: `chefeFatal` e o ESPELHO do veredicto (true so quando mata)',
      !!apRec && apRec.chefeFatal === (apRec.veredictoChefe === 'mata'));

    /* ---- P8: SEM medição, o plano diz "não sei" — nunca "mata" nem "0 drops/hora" ---- */
    const m2 = criarMundo();
    const auto2 = carregarAutomation(m2);
    // Poção grande no META (vem do motor pelo inject; `pocaoInfo` lê `META.pocoes`).
    alimentarMeta(m2, { itens: ITENS, monstros: MONSTROS, ondeItem: ONDE_ITEM, locais: LOCAIS,
      pocoes: { vidaS: { cura: 20000, preco: 300, nivel: 1 } } });
    definirCampeao(m2, 'aptest');
    // Sem `importar` de ciclos: `meuDps()` === null, logo `dpsContra` === null. Vida e poções vêm do
    // HUD pelo caminho real — sem elas o modelo lê `vidaPool = 0` e chama "mata" a tudo (fail-closed
    // legítimo, mas não é o caso que se quer medir aqui: é o do "não há DPS para saber").
    m2.montar('#hud-vida-txt', [m2.el({ label: 'hud-vida-txt', textContent: '2000 / 2000' })]);
    // A poção existe no HUD (5 cargas) — sem poção que cubra a janela, 'mata' é uma PROVA
    // (não há como aguentar) e o ramo "sem DPS" nunca seria exercitado.
    m2.montar('#hud-pocoes [data-pocao]', ['vida', 'vidaF', 'vidaS'].map((k) => m2.el({
      tag: 'div', label: 'poc-' + k, dataset: { pocao: k },
      find: { b: [m2.el({ tag: 'b', label: 'poc-' + k + '-b', textContent: k === 'vidaS' ? '5' : '0' })] },
    })));
    const semMedida = regDe(auto2.planejar(['3089']), '3089');
    t.check('P8: sem DPS medido o chefe e "nao-sei" (nao "mata")',
      !!semMedida && semMedida.veredictoChefe === 'nao-sei');
    t.check('P8b: e `chefeFatal` fica NULL (nao `false`: nao e prova de seguranca)',
      !!semMedida && semMedida.chefeFatal === null);
    t.check('P8c: zona nunca medida nao promete 0 abates/hora (dropsH null, nao 0)',
      !!semMedida && semMedida.dropsH === null);
    t.check('P8d: sem medicao nao se afirma sobrevivencia aos mobs',
      !!semMedida && semMedida.sobreviveMob !== true);

    /* ---- P9: a grandeza que faltava, isolada (`dpsContra`) ---- */
    // `baseMedido` explícito: `null` significa "calcula com o `meuDps()`"; `0` significa "não há
    // medição" e TEM de devolver `null` (nunca 0, nunca NaN — `avaliar` distingue os dois).
    t.check('P9: dpsContra sem medicao e null (nao 0, nao NaN)',
      auto.dpsContra('Barão Nashor', 44, 0) === null && auto.dpsContra('Mob Inexistente', 44, 1265) === null);
    const dc = auto.dpsContra('Barão Nashor', 44, 1265);
    t.check('P9b: dpsContra com medicao e finito e positivo (mitigacao do motor entra)',
      typeof dc === 'number' && Number.isFinite(dc) && dc > 0);
    // A armadura do alvo tem de MORDER: o Barão (armadura 1,8x) recebe menos DPS que a Larva
    // (1,0x) no MESMO nível e com a MESMA base medida. Se a mitigação não entrasse, os dois
    // números seriam iguais (era o defeito de comparar `meuDps` cru com `statsMonstro`).
    const dcMob = auto.dpsContra('Larva do Vazio', 44, 1265);
    t.check('P9c: alvo mais blindado leva menos DPS no mesmo nivel (' + (dcMob || 0).toFixed(1) + ' vs ' + (dc || 0).toFixed(1) + ')',
      typeof dcMob === 'number' && typeof dc === 'number' && dcMob > dc && dc > 0);
    t.check('P9d: stub honesto nos dois mundos', m.unstubbed().length === 0 && m2.unstubbed().length === 0);
  },
};
