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

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

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
