/*
 * objetivo.test.mjs - A BUILD NAO TEM ALVO POR DECRETO (TK-01).
 *
 * HISTORIA: o dono pediu "quero settar o objetivo pra rabaddon" e existiu um `cfg.objetivoItem`
 * que fixava um item a frente de tudo na build. O TK-01 REMOVEU esse campo: a build passou a ser
 * escolhida por SCORE MEDIDO (`scoreSet`) sobre o catalogo — um item entra se o score o escolher.
 *
 * O QUE ESTA SUITE GUARDA AGORA (o contrato novo):
 *   - o Rabadon (3089, AP) NUNCA entra numa build AD (o scoreSet da-lhe 0 sem AP);
 *   - no AP ele entra POR MERITO (o score escolhe-o), sem decreto nenhum;
 *   - mexer em `cfg.objetivoItem` (campo removido) NAO muda a build — nao ha alvo por decreto.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'objetivo',
  titulo: 'Sem alvo por decreto: a build e escolhida por scoreSet (TK-01)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);

    /* ---- AD: o Rabadon (AP) nunca entra (o scoreSet da-lhe 0 sem AP) ---- */
    definirCampeao(m, 'adtest');
    const sem = (auto.buildIdeal() || []).map(String);
    t.check('O1: sem decreto o Rabadon NAO entra na build AD (scoreSet sem AP)', sem.indexOf('3089') < 0);
    t.check('O1: a build AD tem 5 itens', sem.length === 5);

    /* ---- o campo REMOVIDO `objetivoItem` nao muda NADA (nao ha alvo por decreto) ---- */
    auto.setConfig({ objetivoItem: 'rabadon' });
    const com = (auto.buildIdeal() || []).map(String);
    t.check('O2: `objetivoItem` (removido no TK-01) nao contamina a build AD', com.indexOf('3089') < 0);
    t.check('O2: a build AD nao muda com o campo removido', com.join(',') === sem.join(','));

    auto.setConfig({ objetivoItem: '3089' });
    const cru = (auto.buildIdeal() || []).map(String);
    t.check('O3: o id cru ("3089") tambem nao entra em AD', cru.indexOf('3089') < 0);
    t.check('O3: e a build continua igual', cru.join(',') === sem.join(','));

    /* ---- AP: o Rabadon entra POR MERITO (o scoreSet escolhe-o), sem decreto ---- */
    definirCampeao(m, 'aptest');
    const ap = (auto.buildIdeal() || []).map(String);
    t.check('O4: no AP o Rabadon entra por merito (o score escolhe-o)', ap.indexOf('3089') >= 0);

    /* ---- alvo inexistente nao pode quebrar a build ---- */
    definirCampeao(m, 'adtest');
    auto.setConfig({ objetivoItem: '999999' });
    const inval = (auto.buildIdeal() || []).map(String);
    t.check('O5: valor invalido nao quebra a build', inval.length === 5);
    t.check('O5: valor invalido nao entra na build', inval.indexOf('999999') < 0);
    auto.setConfig({ objetivoItem: null });
  },
};
