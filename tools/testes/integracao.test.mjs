/*
 * integracao.test.mjs - INTEGRACAO com o inject.js (TK-INT-01).
 *
 * PORQUE ESTA SUITE EXISTE: o inject.js (mundo MAIN) publica ha meses dois canais que o
 * automation.js (mundo isolado) IGNORAVA - a mensagem morria no !== 'meta' do
 * carregarMeta. O estado vivo do combate e os eventos do motor nao chegavam a ninguem.
 * O ticket TK-INT-01 fez o consumo; esta suite prova que chega.
 *
 * O que se protege:
 *   N1 - a whitelist do META aceita os campos novos (curvaPorNivel/rmMonstro);
 *   N2 - curva() usa o valor LIDO do motor em vez de reavaliar o polinomio (REGRA N.o 3);
 *   N3 - um ABATE do motor e consumido: contadores, buffer e LOG com o ouro/xp do evento;
 *   N4 - o 'estado' vivo fica disponivel para quem quiser ler (inimigos/recargas exactas).
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'integracao',
  titulo: 'Integracao com o inject.js: estado vivo, eventos do motor e curva lida',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'aptest');

    /* ---- N1/N2 - os campos NOVOS do inject.js tem de entrar no META e ser USADOS ---- */
    // curvaPorNivel[29] como o inject.js a manda: avaliarCurva (inject.js:156-169) avalia
    // as CURVA do motor (motor.js:282-288) com o ajuste da planilha (balanco.js) ja
    // DENTRO. No nivel 29 a faixa do balanco e 21-60 (tudo 1), logo o numero e o polinomio
    // puro: hp (150+100*29+29^2)=3891 | ad (9+4,8*29+0,13*29^2)=257,53 | armadura 48,5 |
    // xp 233 | ouro 109,5. Se o jogo buffar a curva, este numero muda sozinho no meta.
    const curvaPorNivel = { 29: { hp: 3891, ad: 257.53, armadura: 48.5, xp: 233, ouro: 109.5, ajuste: null } };
    alimentarMeta(m, { curvaPorNivel, rmMonstro: 0.6 });

    const meta = auto.getMeta();
    t.check('N1: a whitelist do META aceita curvaPorNivel (inject.js novo)', !!(meta.curvaPorNivel && meta.curvaPorNivel[29]));
    t.check('N1: a whitelist do META aceita rmMonstro do motor (motor.js:1179)', meta.rmMonstro === 0.6);
    // rmMonstro() e o que a mitigacao magica usa (automation.js): com 0.6 vindo do motor,
    // o dano magico deixa de ser estimado com o fallback.
    t.check('N1: rmMonstro() devolve o valor do MOTOR (0.6, motor.js:1179)', auto.rmMonstro() === 0.6);
    t.check('N1: armMagicaEfetiva aplica o RM_MONSTRO lido (motor.js:1202)',
      Math.abs(auto.armMagicaEfetiva(100, 0) - 60) < 1e-9);

    // N2 - curva() tem de PREFERIR o valor lido. A prova: um monstro no nivel 29 cujo hp
    // sai de curvaPorNivel[29].hp (3891) e NAO do polinomio com outro ajuste.
    alimentarMeta(m, { monstros: { 'Tropa Corpo a Corpo': { hp: 1, ad: 0.9, as: 0.8, armadura: 0.6, xp: 1, ouro: 1 } },
      locais: [], balanco: [{ de: 1, ate: 60, xpUpar: 1, xp: 1, ouro: 1, vida: 1, dano: 1, drop: 1 }] });
    const sm = auto.statsMonstro('Tropa Corpo a Corpo', 29);
    t.check('N2: statsMonstro(29).hp usa curvaPorNivel[29].hp LIDO do motor (3891)',
      !!sm && Math.abs(sm.hp - 3891) < 0.01);
    t.check('N2: statsMonstro(29).armadura usa curvaPorNivel[29].armadura (48,5*0,6=29,1)',
      !!sm && Math.abs(sm.armadura - 48.5 * 0.6) < 0.01);
    t.check('N2: statsMonstro(29).ouro usa curvaPorNivel[29].ouro com o 0,75 do motor',
      !!sm && Math.abs(sm.ouro - 109.5 * 0.75) < 0.01);
    // N2 (DISCRIMINANTE) - a prova de que o valor LIDO ganha ao polinomio local: se o jogo
    // buffar a curva amanha, o inject manda outro numero e o automation tem de acompanhar
    // SOZINHO (REGRA N.o 3). Com um hp buffado (2x) o fallback daria 3891 - o teste
    // falha se alguem voltar a reavaliar o polinomio em vez de ler o META.
    alimentarMeta(m, { curvaPorNivel: { 29: { hp: 7782, ad: 515.06, armadura: 48.5, xp: 233, ouro: 219, ajuste: null } } });
    const smBuff = auto.statsMonstro('Tropa Corpo a Corpo', 29);
    t.check('N2: com a curva BUFFADA o statsMonstro segue o valor LIDO (7782), nao o polinomio',
      !!smBuff && Math.abs(smBuff.hp - 7782) < 0.01);

    /* ---- N3 - um ABATE do motor e CONSUMIDO (motor.js:1807) ---- */
    m.dispatchMessage({ __lolidleAuto: 'evento', tipo: 'abate', t: 12.5, at: 1700000000000,
      alvo: 7, nome: 'Tropa Corpo a Corpo', ouro: 45, xp: 30, chefe: false, furioso: false,
      itens: [], perdidos: [], espolios: [], gemas: [] });
    const cont = auto.eventosContadores();
    t.check('N3: o evento abate e contado', cont.abate === 1);
    const buf = auto.eventosVivos();
    t.check('N3: o evento abate entra no buffer com o t do motor', buf.length >= 1 && buf[0].tipo === 'abate' && buf[0].t === 12.5);
    const log = (auto.getFarm().log || []).find((e) => e.type === 'evento:abate');
    t.check('N3: o abate e LOGADO com o ouro/xp do EVENTO (motor.js:1807)',
      !!log && log.ouro === 45 && log.xp === 30 && log.nome === 'Tropa Corpo a Corpo');

    // os eventos do CHEFE tambem nao podem morrer: invocacao (larvas), carga, golpe.
    m.dispatchMessage({ __lolidleAuto: 'evento', tipo: 'chefeInvoca', t: 40, at: 1700000001000, alvo: 1 });
    m.dispatchMessage({ __lolidleAuto: 'evento', tipo: 'chefeCarrega', t: 41, at: 1700000002000, alvo: 1, mec: 'sopro', dur: 1.5 });
    m.dispatchMessage({ __lolidleAuto: 'evento', tipo: 'chefeGolpe', t: 42.5, at: 1700000003000, alvo: 1, mec: 'sopro' });
    const cont2 = auto.eventosContadores();
    t.check('N3: chefeInvoca contado (as larvas do Barao, motor.js:3142)', cont2.chefeInvoca === 1);
    t.check('N3: chefeCarrega contado', cont2.chefeCarrega === 1);
    t.check('N3: chefeGolpe contado', cont2.chefeGolpe === 1);
    const logChefe = (auto.getFarm().log || []).filter((e) => String(e.type).indexOf('evento:') === 0);
    t.check('N3: cada evento decidivel deixa rasto no log do farm', logChefe.length >= 4);

    /* ---- N4 - o ESTADO vivo fica disponivel (inject.js: snapshot) ---- */
    const estado = { v: 1, at: 1700000004000, t: 12.6, local: 'floresta', arena: false,
      vida: 3000, mana: null, respawn: 1.5,
      inimigos: [{ id: 7, nome: 'Tropa Corpo a Corpo', nivel: 29, chefe: false, magico: false,
        hp: 1200, hpMax: 3891, ad: 257.5, as: 0.8, armadura: 48.5, ouro: 109.5, xp: 233,
        acumulos: 0, atordoado: 0, noAr: 0, marca: 0, lento: 0, noturno: false, furioso: false,
        elite: false, guardiao: false, invocado: false, distancia: 0, chegada: 0 }],
      darius: { recargas: { Q: 3.2, W: 0 }, timers: {}, escudo: 0 },
      spawn: { clear: 1.5, local: 1.2, min: 2, max: 4, n: 20 } };
    m.dispatchMessage(Object.assign({ __lolidleAuto: 'estado' }, estado));
    const vivo = auto.estadoVivo();
    t.check('N4: estadoVivo() devolve o ultimo snapshot do combate', !!vivo && vivo.t === 12.6);
    t.check('N4: o snapshot traz os INIMIGOS com hp/armadura exactos do motor',
      !!vivo && vivo.inimigos[0].hp === 1200 && vivo.inimigos[0].armadura === 48.5);
    t.check('N4: o snapshot traz as RECARGAS exactas em segundos (motor.js:1055)',
      !!vivo && vivo.darius.recargas.Q === 3.2);
    // o evento NAO pode somar ouro duas vezes: quem conta e o handleLog (frase do ecra).
    const c = auto.getFarm().current;
    t.check('N4: o abate do evento NAO soma ouro ao ciclo (handleLog e o contador)',
      !c || (c.gold || 0) === 0);
  },
};
