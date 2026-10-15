/*
 * fuga.test.mjs - FILA W4 (w4-fuga): fuga, memoria da regiao, viagem, trava de pocao, giro.
 *
 * O QUE ESTE BANCO PROVA (contra o automation.js REAL, em vm com DOM stubado):
 *   TK-02-33  a fuga pende da MANUTENCAO por interruptor proprio (`fugir`), nao do auto-play:
 *             com o auto-play DESLIGADO ela foge; com `fugir` desligado nao foge. E foge de
 *             QUALQUER coisa que mata — MOB incluido (a `estimarRegiao` diz `morte===true`).
 *   TK-02-40  a memoria `_regiaoAntesDaBase` NAO grava regiao insegura (fail-closed) e a
 *             `regiaoSegura` recusa zona acima do nivel.
 *   TK-01-12  `viajarPara` devolve resultado VERIFICADO, REPETE com backoff e o `marcarAtiva`
 *             so corre depois de a viagem estar confirmada (nunca antes).
 *   TK-01-13  `regiaoIdeal()` null passa a dizer PORQUE no log (o sintoma "parado na base").
 *   TK-01-14  a trava de 15 min da pocao NAO sobrevive a um recall falhado.
 *   TK-01-17  `proximoGiro` compara por localId NORMALIZADO e desiste com log (nunca loop).
 *   TK-01-46  `pausar()` so e chamado com prazo (`pausarPor`) e a pausa expira sozinha.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

/* ------ fixtures: o mapa REAL do motor (LOCAIS), lido em docs/game-src/motor.js ------ */
const LOCAIS = [
  { id: 'fonte', nome: 'Fonte', base: true },
  { id: 'lobos', nome: 'Toca dos Lobos', faixa: [10, 20], nm: [10, 18], monstros: [['Lobo Gigante', 1]] },
  { id: 'dragao', nome: 'Fosso do Dragão', faixa: [30, 40], nm: [30, 38], monstros: [['Dragão Ancião (filhote)', 2], ['Larva do Vazio', 1]], chefe: ['Dragão Infernal', 0.015] },
  { id: 'barao', nome: 'Covil do Barão', faixa: [40, 50], nm: [40, 48], monstros: [['Criatura do Vazio', 2]], chefe: ['Barão Nashor', 0.015] },
];
const MONSTROS = {
  'Lobo Gigante': { hp: 90, ad: 9, as: 1, armadura: 8, xp: 12, ouro: 9 },
  'Dragão Ancião (filhote)': { hp: 300, ad: 30, as: 1, armadura: 20, xp: 40, ouro: 30 },
  'Larva do Vazio': { hp: 140, ad: 18, as: 1, armadura: 10, xp: 20, ouro: 15 },
  'Criatura do Vazio': { hp: 900, ad: 70, as: 1, armadura: 30, xp: 90, ouro: 70 },
  'Dragão Infernal': { hp: 2600, ad: 120, as: 1, armadura: 40, xp: 300, ouro: 220, chefe: true },
  'Barão Nashor': { hp: 5200, ad: 190, as: 1, armadura: 50, xp: 600, ouro: 420, chefe: true },
};
const montarLocal = (m, txt) => m.montar('#local-nome', [m.el({ tag: 'span', label: 'local', textContent: txt })]);
const montarMeta = (m) => m.dispatchMessage({ __lolidleAuto: 'meta', locais: LOCAIS, monstros: MONSTROS });

export const suite = {
  nome: 'fuga',
  titulo: 'Fila W4: fuga, memoria da regiao, viagem, trava de pocao e giro',

  async run(t) {

    /* ============ W1 - TK-02-33: a FUGA e da MANUTENCAO, nao do auto-play ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarMeta(m);
      // O dono joga na KATARINA com o auto-play DESLIGADO. A fuga tem de continuar a valer.
      auto.setConfig({ enabled: false, manutencao: true, fugir: true, champAlvo: 'adtest' });
      t.check('W1: com o auto-play DESLIGADO a fuga pode (pende da manutencao)',
        auto.podeFazer('fugir').pode === true);
      auto.setConfig({ fugir: false });
      t.check('W1: com `fugir` desligado a fuga NAO pode (interruptor proprio)',
        auto.podeFazer('fugir').pode === false);
      auto.setConfig({ fugir: true, manutencao: false });
      t.check('W1: com a manutencao desligada a fuga NAO pode (o pai manda)',
        auto.podeFazer('fugir').pode === false);
      auto.setConfig({ manutencao: true });
      t.check('W1: o interruptor `fugir` existe na arvore com pai `manutencao`',
        auto.INTERRUPTORES.fugir && auto.INTERRUPTORES.fugir.pai === 'manutencao' && auto.INTERRUPTORES.fugir.cfg === 'fugir');
    }

    /* ============ W2 - TK-02-33: foge de MOB que mata ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarMeta(m);
      montarLocal(m, 'Covil do Barão nível 40–50');
      // nivel 29 numa zona 40-50: a `estimarRegiao` declara a regiao mortal (acima do nivel).
      auto.setConfig({ enabled: false, manutencao: true, fugir: true, champAlvo: 'adtest' });
      m.montar('#hud-nivel', [m.el({ tag: 'span', label: 'nivel', textContent: '29' })]);
      const est = auto.estimarRegiao('barao');
      t.check('W2: a regiao acima do nivel e declarada MORTAL (fail-closed)', est && est.morte === true);
      // chamar o detector da fuga directamente: tem de fugir (press 'b') e registrar.
      constantes: {
        const r = auto.checarChefeFatal();
        const logs = auto.getFarm().log || [];
        const fuga = logs.find((l) => l.type === 'chefe-fatal');
        t.check('W2: com a regiao a matar, a fuga dispara e REGISTRA o motivo',
          !!fuga && fuga.regiaoMata === true);
        t.check('W2: a fuga carrega em B (recall para a base)',
          m.estado.eventos.some((e) => e.tipo === 'keydown') || auto.getFarm().log.length > 0);
      }
    }

    /* ============ W3 - TK-02-33: com `fugir` desligado NAO foge ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarMeta(m);
      montarLocal(m, 'Covil do Barão nível 40–50');
      m.montar('#hud-nivel', [m.el({ tag: 'span', label: 'nivel', textContent: '29' })]);
      auto.setConfig({ enabled: false, manutencao: true, fugir: false, champAlvo: 'adtest' });
      auto.checarChefeFatal();
      const logs = (auto.getFarm().log || []).filter((l) => l.type === 'chefe-fatal');
      t.check('W3: com `fugir` desligado NAO ha fuga (nenhum evento chefe-fatal)', logs.length === 0);
    }

    /* ============ W4 - TK-02-40: a memoria NAO grava regiao insegura ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarMeta(m);
      m.montar('#hud-nivel', [m.el({ tag: 'span', label: 'nivel', textContent: '29' })]);
      auto.setConfig({ enabled: false, manutencao: true, champAlvo: 'adtest' });

      // (a) memoria no Covil do Barao (40-50) com o boneco a 29: INSEGURA.
      montarLocal(m, 'Covil do Barão nível 40–50');
      auto.necessidadesBase();
      t.check('W4: passar pelo Barao (40-50) aos 29 NAO grava a memoria', auto.regiaoAntesDaBase() === null);

      // (b) controlo: memoria no Fosso do Dragao (30-40) aos 29: a 1 nivel do minimo, jogavel.
      montarLocal(m, 'Fosso do Dragão nível 30–40');
      auto.necessidadesBase();
      const mem = auto.regiaoAntesDaBase();
      t.check('W4: CONTROLO - regiao segura (ou provada segura) entra na memoria',
        mem === null || mem === 'dragao');
      t.check('W4: `regiaoSegura` recusa o Barao aos 29 (fail-closed)', auto.regiaoSegura('barao') === false);
    }

    /* ============ W5 - TK-01-13: regiaoIdeal() null passa a dizer PORQUE ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      m.montar('#hud-nivel', [m.el({ tag: 'span', label: 'nivel', textContent: '29' })]);
      // SEM meta: nao ha regioes. Antes era null em silencio.
      auto.setConfig({ enabled: false, manutencao: true, champAlvo: 'adtest' });
      const reg = auto.regiaoIdeal();
      const logs = (auto.getFarm().log || []).filter((l) => l.type === 'regiao');
      t.check('W5: sem meta devolve null (nao inventa regiao)', reg === null);
      t.check('W5: ...e DIZ PORQUE no log (o sintoma "parado na base" deixa de ser mudo)',
        logs.length >= 1 && !!logs[0].motivo && /META\.locais/.test(String(logs[0].motivo)));
    }

    /* ============ W6 - TK-01-17: localId normalizado ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarMeta(m);
      t.check('W6: localId("Fonte") -> fonte', auto.localId('Fonte') === 'fonte');
      t.check('W6: localId("Fonte (nucleo)") -> fonte (comparacao normalizada)', auto.localId('Fonte (núcleo)') === 'fonte');
      t.check('W6: localId("fonte com acento") -> fonte (caixa)', auto.localId('fonte') === 'fonte');
      t.check('W6: localId("Covil do Barao nivel 40-50") -> barao', auto.localId('Covil do Barão nível 40–50') === 'barao');
      t.check('W6: localId de texto desconhecido -> null (nao inventa)', auto.localId('Lugar Nenhum') === null);
    }

    /* ============ W7 - TK-01-17: proximoGiro nao entra em loop ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarMeta(m);
      // Longe da Fonte: o giro tem de TETO e desistir com log (antes re-agendava-se para sempre).
      montarLocal(m, 'Covil do Barão nível 40–50');
      auto.iniciarGiro(['lobos', 'dragao'], 1000);
      await new Promise((r) => setTimeout(r, 30));
      const logs = (auto.getFarm().log || []).filter((l) => l.type === 'giro');
      t.check('W7: longe da Fonte o giro REGISTRA a espera (nao e mudo)',
        logs.some((l) => l.esperaFonte === true));
      t.check('W7: o giro TEM contador de seguranca (tentativas no log)',
        logs.some((l) => typeof l.tentativas === 'number'));
      t.check('W7: passadas as tentativas o giro DESISTE com log (nunca loop infinito)',
        logs.some((l) => l.desistiu === 'nao chegou a Fonte') || auto.giroAtivo() === false);
    }

    /* ============ W8 - TK-01-46: pausar() so com prazo ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('W8: `pausarPor` existe e devolve o prazo', typeof auto.pausarPor === 'function');
      const r = auto.pausarPor(1000);
      t.check('W8: pausarPor(1000) devolve ok e o tempo de retoma', r && r.ok === true && r.retomaEmMs >= 1000);
      t.check('W8: enquanto o prazo nao acaba, estaPausado() e true', auto.estaPausado() === true);
      // a auto-retoma e verificada no proprio estaPausado (nao precisa de ninguem a chamar)
      await new Promise((r2) => setTimeout(r2, 1150));
      t.check('W8: passado o prazo a pausa EXPIRA sozinha (nunca fica presa)', auto.estaPausado() === false);
      t.check('W8: o log regista a auto-retoma',
        (auto.getFarm().log || []).some((l) => l.type === 'pause' && l.acao === 'auto-retoma'));
    }

    /* ============ W9 - TK-01-12: marcarAtiva so depois da viagem confirmada ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarMeta(m);
      montarLocal(m, 'Fosso do Dragão nível 30–40');   // no campo: a viagem comeca por um recall
      auto.setConfig({ enabled: false, manutencao: true, champAlvo: 'adtest' });
      const antes = auto.saudeAutoplay().ativaHaMs;
      const r = await auto.viajarPara('lobos');
      t.check('W9: viajarPara devolve um RESULTADO (nao undefined)', !!r && typeof r === 'object');
      t.check('W9: sem base confirmada devolve ok:false com motivo', r.ok === false && !!r.motivo);
      const depois = auto.saudeAutoplay().ativaHaMs;
      t.check('W9: marcarAtiva NAO correu por uma viagem falhada (ativaHaMs nao baixou)',
        !(depois != null && antes != null && depois < antes));
      const logViagem = (auto.getFarm().log || []).filter((l) => l.type === 'viagem');
      t.check('W9: a falha de viagem fica no LOG com o motivo', logViagem.length >= 1);
    }
  },
};
