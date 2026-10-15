/*
 * objetivo.test.mjs - OBJETIVO DE ITEM (cfg.objetivoItem): o alvo do dono entra na build.
 *
 * Pedido do dono (verbatim): "faz funcionar bem o objetivo de farm/item. quero settar o
 * objetivo pra rabaddon."
 *
 * PORQUE ESTA SUITE EXISTE: a build ideal e EMERGENTE (stats x multiplicador de classe).
 * Num campeao AD o Rabadon (AP) leva 0.12x e nunca entra. O campo objetivoItem existe para
 * fixar o alvo - e ate agora nao tinha UM UNICO teste. Feature sem teste = feature que
 * quebra em silencio na proxima mexida.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'objetivo',
  titulo: 'Objetivo de item (cfg.objetivoItem fixa o alvo na build)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);

    /* ---- AD: o Rabadon so entra se o dono o pedir ---- */
    definirCampeao(m, 'adtest');
    auto.setConfig({ objetivoItem: null });
    const sem = (auto.buildIdeal() || []).map(String);
    t.check('O1: sem objetivo o Rabadon NAO entra na build AD (0.12x de classe)', sem.indexOf('3089') < 0);
    t.check('O1: a build AD tem 5 itens', sem.length === 5);

    auto.setConfig({ objetivoItem: 'rabadon' });
    const com = (auto.buildIdeal() || []).map(String);
    // ACTUALIZADO 2026-10-14 (regra do dono): o alvo fixo passou a RESPEITAR A CLASSE. A build AD do
    // Yasuo nao pode ser contaminada com um item AP — o Rabadon (3089) e AP, logo NAO entra aqui.
    // Antes o pin entrava 'a frente de tudo' e punha Rabadon numa build AD (medido:
    // buildIdealPara({magia:false}) = 3172,3089,3046,6631,3031).
    t.check('O2: objetivo de CLASSE OPOSTA nao entra na build AD', com.indexOf('3089') < 0);
    t.check('O2: a build continua com 5 itens', com.length === 5);
    t.check('O2: a build AD fica limpa de itens AP', com.filter((x) => x === '3089').length === 0);

    /* ---- o id cru tambem serve de objetivo ---- */
    auto.setConfig({ objetivoItem: '3089' });
    const cru = (auto.buildIdeal() || []).map(String);
    t.check('O3: o id cru ("3089") tambem respeita a classe (nao entra em AD)', cru.indexOf('3089') < 0);

    /* ---- O3b: no campeao da MESMA classe, o objetivo CONTINUA a entrar (controlo) ---- */
    definirCampeao(m, 'aptest');
    auto.setConfig({ objetivoItem: 'rabadon' });
    const ap = (auto.buildIdeal() || []).map(String);
    t.check('O3b: no campeao AP o objetivo ENTRA (controlo da regra por classe)', ap.indexOf('3089') >= 0);
    auto.setConfig({ objetivoItem: null });
    definirCampeao(m, 'adtest');

    /* ---- AP: entra por merito proprio, com ou sem objetivo ---- */
    definirCampeao(m, 'aptest');
    auto.setConfig({ objetivoItem: null });
    const apSem = (auto.buildIdeal() || []).map(String);
    t.check('O4: no AP o Rabadon entra por merito (sem objetivo)', apSem.indexOf('3089') >= 0);

    /* ---- alvo inexistente nao pode quebrar a build ---- */
    definirCampeao(m, 'adtest');
    auto.setConfig({ objetivoItem: '999999' });
    const inval = (auto.buildIdeal() || []).map(String);
    t.check('O5: objetivo invalido nao quebra a build', inval.length === 5);
    t.check('O5: objetivo invalido nao entra na build', inval.indexOf('999999') < 0);
    auto.setConfig({ objetivoItem: null });
  },
};
