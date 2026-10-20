/*
 * interruptores.test.mjs - HIERARQUIA DE INTERRUPTORES do auto-play.
 *
 * Pedido do dono: "faca o autoplay ser um switch que liga varios switchs. e o usuario pode
 * desligar um deles, e cada switch pode depender de outro ... uma hierarquia. mas nao faca de
 * forma burra ou bloated".
 *
 * O que se protege: a cadeia de PAIS (um sub-interruptor nao pode agir com o mestre desligado),
 * o desligar individual, e o fail-open para nomes desconhecidos.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'interruptores',
  titulo: 'Hierarquia de interruptores (mestre -> sub -> sub)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');
    // O mestre NAO tem excepcao de campeao (TK-01). Estes testes sao sobre a HIERARQUIA,
    // logo aponta-se o alvo ao campeao do stub.
    auto.setConfig({ champAlvo: 'adtest' });

    /* I1 - o MESTRE UNICO manda: desligado, NENHUM sub-interruptor pode agir. */
    auto.setConfig({ enabled: false });
    t.check('I1: com o mestre desligado, o proprio autoplay nao pode', auto.podeFazer('autoplay').pode === false);
    // CONTRATO TK-01: UM mestre unico (autoplay). Desligar o mestre desliga TUDO — vender,
    // equipar, montar, build. Nao ha mais o segundo mestre independente.
    t.check('I1: com o MESTRE desligado, VENDER nao pode (era o segundo mestre)', auto.podeFazer('vender').pode === false);
    t.check('I1: com o MESTRE desligado, EQUIPAR nao pode', auto.podeFazer('equip').pode === false);
    // `buildPorFase` e o unico interruptor que resta sob o autoplay (depende do contexto de
    // luta). A `rotacao` passou para manutencao (trocar a barra e sempre, regra do dono).
    t.check('I1: com o MESTRE desligado, o ramo dele NAO pode — BUILD POR FASE', auto.podeFazer('buildPorFase').pode === false);
    auto.setConfig({ manutencao: false });
    t.check('I1: com a MANUTENCAO desligada, VENDER nao pode', auto.podeFazer('vender').pode === false);
    t.check('I1: com a MANUTENCAO desligada, EQUIPAR nao pode', auto.podeFazer('equip').pode === false);
    t.check('I1: com a MANUTENCAO desligada, MONTAR nao pode (neto: montar -> irBase)', auto.podeFazer('montar').pode === false);
    auto.setConfig({ manutencao: true });

    /* I2 - ligado o mestre, cada sub-interruptor decide por si. */
    auto.setConfig({ enabled: true });
    t.check('I2: com o mestre ligado, o autoplay pode', auto.podeFazer('autoplay').pode === true);
    t.check('I2: com o mestre ligado, VENDER pode', auto.podeFazer('vender').pode === true);
    auto.setConfig({ autoEquip: false });
    t.check('I2: desligar EQUIPAR desliga SO o equipar', auto.podeFazer('equip').pode === false);
    t.check('I2: desligar EQUIPAR nao mexe no VENDER', auto.podeFazer('vender').pode === true);
    auto.setConfig({ autoEquip: true });
    t.check('I2: religar EQUIPAR volta a poder', auto.podeFazer('equip').pode === true);

    /* I3 - os ramos: a base exige a base; o campo nao. */
    t.check('I3: o ramo da BASE pende de irBase', auto.INTERRUPTORES.vender.pai === 'irBase');
    t.check('I3: irBase pende da MANUTENCAO (recursos base, nao auto-play)', auto.INTERRUPTORES.irBase.pai === 'manutencao');
    t.check('I3: equip pende da MANUTENCAO', auto.INTERRUPTORES.equip.pai === 'manutencao');
    // ACTUALIZADO 2026-10-14 (regra do dono): "o negocio de trocar habilidades sozinho no combate
    // tem que ser usado sempre, em farm". Trocar a barra e RECURSO BASE (manutencao), nao farmar —
    // estava sob `autoplay`, que tem excepcao de campeao, logo na Katarina a barra ficava PARADA.
    t.check('I3: rotacao pende da MANUTENCAO (trocar a barra e sempre, nao so no farm)', auto.INTERRUPTORES.rotacao.pai === 'manutencao');
    t.check('I3: ha UM mestre unico (autoplay) e manutencao e filho dele', auto.INTERRUPTORES.autoplay.pai === null && auto.INTERRUPTORES.manutencao.pai === 'autoplay');

    /* I4 - excepcoes declaradas (Runeterra: nao vender, nao mexer no cofre). */
    t.check('I4: VENDER tem excepcao declarada (Runeterra)', !!auto.INTERRUPTORES.vender.excecao);
    t.check('I4: COFRE tem excepcao declarada (Runeterra)', !!auto.INTERRUPTORES.cofre.excecao);
    t.check('I4: EQUIPAR nao tem excepcao (age em qualquer mapa)', !auto.INTERRUPTORES.equip.excecao);

    /* I5 - a arvore exposta para a GUI desenhar interruptores dentro de interruptores. */
    const arv = auto.arvoreInterruptores();
    t.check('I5: a arvore tem os interruptores todos', Array.isArray(arv) && arv.length === Object.keys(auto.INTERRUPTORES).length);
    // Depois do reparent da rotacao/skillsPorFase, sob 'autoplay' fica so o `buildPorFase`
    // (o unico que depende mesmo do contexto de luta).
    t.check('I5: a arvore diz o PAI de cada um', arv.filter((x) => x.pai === 'autoplay').length >= 1 && arv.filter((x) => x.pai === 'manutencao').length >= 7);
    t.check('I5: a arvore traz o estado resolvido (pode)', arv.every((x) => typeof x.pode === 'boolean'));


    /* I7 - INTEGRACAO: as NECESSIDADES tem de respeitar a hierarquia (nao basta o resolvedor
     * existir - ele tem de ser CONSUMIDO pelo necessidadesBase). */
    auto.setConfig({ enabled: false, manutencao: false, autoEquip: true, autoAtrib: true, autoRefino: true, autoMontar: true });
    let nOff = null;
    try { nOff = auto.necessidadesBase(); } catch { /* ignore */ }
    t.check('I7: mestre desligado => n.vender falso (integracao, nao so o resolvedor)', !!(nOff && nOff.vender === false));
    t.check('I7: mestre desligado => n.equip falso', !!(nOff && nOff.equip === false));
    t.check('I7: mestre desligado => n.atrib falso', !!(nOff && nOff.atrib === false));
    t.check('I7: mestre desligado => n.montar falso', !!(nOff && nOff.montar === false));
    t.check('I7: mestre desligado => n.refino falso', !!(nOff && nOff.refino === false));
    t.check('I7: mestre desligado => n.hab falso', !!(nOff && nOff.hab === false));
    auto.setConfig({ enabled: true, manutencao: true });
    t.check('I7: CONTROLO - com o mestre ligado o vender nao fica bloqueado pela hierarquia',
      !!(auto.podeFazer('vender').pode === true));


    /* I8 - VOLTAR PARA ONDE ESTAVA (regra implicita do dono): a memoria da regiao do campo
     * tem de existir e NAO pode inventar regiao quando nao ha local lido. */
    t.check('I8: regiaoAntesDaBase e uma funcao exportada', typeof auto.regiaoAntesDaBase === 'function');
    t.check('I8: sem local lido, a memoria comeca vazia (nao inventa regiao)', auto.regiaoAntesDaBase() === null);
    try { auto.necessidadesBase(); } catch { /* ignore */ }
    t.check('I8: correr as necessidades sem local NAO inventa regiao', auto.regiaoAntesDaBase() === null);


    /* I9 - SEM EXCEPCAO DE CAMPEAO (TK-01): `podeFazer('autoplay')` NAO bloqueia por campeao.
     * O champAlvo continua a existir como preferencia visual (a GUI mostra-o), mas o motor
     * nao o usa como bloqueio. O dono mandou simplificar: um mestre, sem excecoes. */
    auto.setConfig({ enabled: true, manutencao: true, champAlvo: 'yasuo' });
    t.check('I9: enabled=true com campeao fora do alvo -> autoplay AINDA pode (sem excepcao)', auto.podeFazer('autoplay').pode === true);
    t.check('I9: campeao fora do alvo -> BUILD POR FASE tambem pode', auto.podeFazer('buildPorFase').pode === true);
    t.check('I9: campeao fora do alvo NAO trava a MANUTENCAO (vender segue)', auto.podeFazer('vender').pode === true);
    t.check('I9: ehCampeaoAlvo() diz que nao e o alvo', auto.ehCampeaoAlvo() === false);
    auto.setConfig({ champAlvo: 'adtest' });
    t.check('I9: com o campeao certo o mestre segue a poder', auto.podeFazer('autoplay').pode === true);
    t.check('I9: ehCampeaoAlvo() diz que e o alvo', auto.ehCampeaoAlvo() === true);
    auto.setConfig({ champAlvo: null });
    t.check('I9: champAlvo null -> qualquer campeao serve', auto.ehCampeaoAlvo() === true);
    auto.setConfig({ champAlvo: 'adtest' });

    /* I6 - fail-open: um nome desconhecido nao pode bloquear o motor. */
    t.check('I6: nome desconhecido devolve pode:true (fail-open)', auto.podeFazer('naoExiste').pode === true);

    /* I10 - CONTRATO TK-01 (criterio 4): NENHUM interruptor tem `cfg:null` (fim do "implicito")
     * e o `vender` segue o mestre SEM campeao carregado (a hierarquia nao depende de identidade). */
    const comCfgNull = Object.keys(auto.INTERRUPTORES).filter((k) => auto.INTERRUPTORES[k].cfg == null);
    t.check('I10: nenhum interruptor tem cfg:null (fim do implicito)', comCfgNull.length === 0);
    {
      const m2 = criarMundo();
      const a2 = carregarAutomation(m2);
      a2.setConfig({ enabled: false });
      t.check('I10: sem campeao e enabled:false -> vender NAO pode', a2.podeFazer('vender').pode === false);
      a2.setConfig({ enabled: true, autoVender: true });
      t.check('I10: sem campeao e enabled:true + autoVender:true -> vender PODE', a2.podeFazer('vender').pode === true);
      a2.setConfig({ autoVender: false });
      t.check('I10: sem campeao e autoVender:false -> vender NAO pode', a2.podeFazer('vender').pode === false);
    }

    /* I11 - MESTRE = TUDO (ordem do dono, 2026-10-20): ligar liga todos os switches;
     * desligar devolve exactamente as escolhas que ele tinha. O botao "desligar tudo"
     * desliga todos e o MESMO botao religa o conjunto anterior. */
    {
      const m3 = criarMundo();
      const a3 = carregarAutomation(m3);
      a3.setConfig({ enabled: true });                       // liga: tudo ligado
      const chaves = a3.chavesSwitches(false);               // sem os dois do Ornn (aposta)
      t.check('I11: ligar o mestre liga TODOS os switches', chaves.every((k) => a3.getConfig()[k] !== false));
      a3.setConfig({ autoEquip: false, autoHab: false });    // escolhas dele com o mestre ligado
      a3.setConfig({ enabled: false });                      // desliga: devolve a escolha
      const c3 = a3.getConfig();
      t.check('I11: desligar o mestre devolve as escolhas dele (equipar desligado)', c3.autoEquip === false);
      t.check('I11: desligar o mestre devolve as escolhas dele (habilidades desligadas)', c3.autoHab === false);
      t.check('I11: desligar o mestre NAO deixa tudo ligado', c3.autoVender !== false || c3.autoEquip === false);
      // "desligar tudo": todos off; o mesmo botao religa o que ele tinha escolhido
      a3.setConfig({ enabled: true });
      a3.setConfig({ autoEquip: false });
      const antes = a3.estadoSwitches();
      const off = a3.alternarTodosSwitches();
      t.check('I11: desligar tudo desliga todos os switches', off.todosOff === true && off.ligados === 0);
      t.check('I11: desligar tudo guarda quantos estavam ligados', off.guardados === antes.ligados);
      const volta = a3.alternarTodosSwitches();
      t.check('I11: o mesmo botao religa o conjunto anterior', volta.todosOff === false && volta.ligados === antes.ligados);
      t.check('I11: e a escolha individual volta igual (equipar desligado)', a3.getConfig().autoEquip === false);
      // a vigia do mercado nao depende de switch nenhum (ordem do dono: vigia mesmo com tudo off)
      a3.setConfig({ enabled: false, manutencao: false });
      t.check('I11: a vigia do mercado age mesmo com os switches desligados', a3.podeFazer('vigiarMercado').pode === true);
    }
  },
};
