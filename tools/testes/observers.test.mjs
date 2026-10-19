/*
 * observers.test.mjs - OBSERVADOR DE NOVIDADES: custo por mutação + limpeza na reinjeção.
 *
 * MOTIVO (diagnóstico de FPS, 2026-10-18): o `cuidarNovidades()` do automation.js observava
 * `documentElement` com `{ childList: true, subtree: true }` — o callback `tentar()` (um
 * `querySelector('.novidades-fundo')` no documento INTEIRO) corria a CADA mutação da página, e o
 * jogo mexe no DOM a ~5-20 Hz (HUD a cada 0,2 s, #log, chat). Além disso o observer, o intervalo de
 * 1,5 s e o listener de clique ficavam SEM referência: o `_T` limpava os timers, mas estes três
 * empilhavam numa reinjeção (N `tentar()` por mutação). É o MESMO erro que o content.js já tinha
 * corrigido (content.js:172: "SEM MutationObserver no HUD ... era isso que derrubava o FPS").
 *
 * O jogo acrescenta o diálogo DIRETO ao `<body>` (jogo.js:7547 `document.body.append(fundo)`), logo
 * observar `document.body` + `childList` (sem subtree) chega e é ordens de magnitude mais barato.
 *
 * O que este banco prova (contra o automation.js REAL, em vm com DOM stubado):
 *   O1 - observa o `body`, com `childList`, e SEM `subtree` (barato);
 *   O2 - mantém referências em `window.__lolidleNov*` (intervalo + clique + observer);
 *   O3 - na reinjeção, DESLIGA o observer anterior, limpa o intervalo anterior e repõe o clique
 *        (uma só assinatura, sem empilhar).
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation } from './dom-stub.mjs';

export const suite = {
  nome: 'observers',
  titulo: 'Novidades: observer barato (body+childList) e sem empilhar na reinjeção',

  async run(t) {
    const m = criarMundo();
    carregarAutomation(m);
    const w = m.sandbox.window;

    /* ---- O1 - observer único, no BODY, childList, sem subtree ---- */
    const obs1 = w.__lolidleNovObs;
    t.check('O1: criou o observer de novidades', !!obs1 && Array.isArray(obs1._alvos));
    t.check('O1: observa UM alvo', !!obs1 && obs1._alvos.length === 1);
    const alvo1 = obs1 && obs1._alvos[0];
    t.check('O1: o alvo é o <body> (não documentElement)', !!alvo1 && alvo1.alvo === m.documento.body);
    t.check('O1: sem subtree e com childList', !!alvo1 && alvo1.cfg && alvo1.cfg.childList === true && !alvo1.cfg.subtree);
    t.check('O1: NÃO observa documentElement', !!obs1 && !obs1._alvos.some((a) => a.alvo === m.documento.documentElement));

    /* ---- O2 - referências guardadas (intervalo + clique) ---- */
    const id1 = w.__lolidleNovT;
    t.check('O2: guardou o id do intervalo (window.__lolidleNovT)', typeof id1 === 'number');
    t.check('O2: o intervalo está registado', m.estado.intervals.some((x) => x.id === id1));
    t.check('O2: guardou o listener de clique (window.__lolidleNovClique)', typeof w.__lolidleNovClique === 'function');
    t.check('O2: uma só assinatura de clique', (m.estado.domListeners.get('click') || []).length === 1);
    const clique1 = w.__lolidleNovClique;

    /* ---- O3 - reinjeção: desliga o anterior e repõe (sem empilhar) ---- */
    carregarAutomation(m);
    const obs2 = w.__lolidleNovObs;
    t.check('O3: o observer anterior foi DESLIGADO (0 alvos)', !!obs1 && obs1._alvos.length === 0);
    t.check('O3: há um observer NOVO', !!obs2 && obs2 !== obs1);
    t.check('O3: o novo também observa o body (childList, sem subtree)',
      !!obs2 && obs2._alvos.length === 1 && obs2._alvos[0].alvo === m.documento.body && obs2._alvos[0].cfg.childList === true && !obs2._alvos[0].cfg.subtree);
    t.check('O3: o intervalo anterior foi LIMPO', !m.estado.intervals.some((x) => x.id === id1));
    t.check('O3: o novo intervalo está registado', m.estado.intervals.some((x) => x.id === w.__lolidleNovT));
    t.check('O3: o clique anterior foi retirado (continua 1 assinatura)', (m.estado.domListeners.get('click') || []).length === 1);
    t.check('O3: o listener de clique é novo (o antigo saiu)', w.__lolidleNovClique !== clique1);
  },
};
