/*
 * tarefa-banner.test.mjs - BANNER `#rastreio-tarefa.pronta` (TK-01): o atalho da tarefa pronta.
 *
 * O JOGO (docs/game-src/jogo.js:6774-6783) mostra "Tarefa pronta! Clique aqui para falar com o
 * Capitão." e o click handler (jogo.js:6407) chama `falarCom('Capitão da Legião')` — mas SÓ na
 * Fonte. Fora da base o clique nao faz nada (o jogo pede "Volte à Fonte (tecla B)").
 *
 * A EXTENSAO passou a clicar no banner (`clicarTarefaPronta()`) no passo `tarefa` de PASSOS_BASE,
 * em vez de mandar o boneco à Fonte so para entregar a tarefa. So clica quando:
 *   - o banner esta visivel E `.pronta` (o jogo só poe a classe quando a tarefa esta pronta); e
 *   - o personagem esta na Fonte (`naBase()`) — fora da base o clique é um no-op.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, definirCampeao } from './dom-stub.mjs';

function baseComBanner(m, { local, pronta }) {
  m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: local })]);
  m.montar('#rastreio-tarefa', [m.el({
    label: 'rastreio-tarefa',
    className: pronta ? 'pronta' : '',
    textContent: pronta ? 'Tarefa pronta! Clique aqui para falar com o Capitao.' : 'Tarefa em andamento (3/5)',
  })]);
}

export const suite = {
  nome: 'tarefa-banner',
  titulo: 'Banner de tarefa pronta: so clica pronto E na Fonte (TK-01)',

  async run(t) {
    /* ---- B1 - visivel + `.pronta` + NA FONTE: clica (abre o dialogo do Capitao) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      definirCampeao(m, 'adtest');
      baseComBanner(m, { local: 'Fonte', pronta: true });
      const r = auto.clicarTarefaPronta();
      t.check('B1: banner visivel+pronta na Fonte -> clica', r.ok === true && r.clicou === true);
      t.check('B1: o clique foi mesmo no banner #rastreio-tarefa', m.cliqueDe('rastreio-tarefa') === true);
      // o clique do banner E o que abre o dialogo do Capitao (jogo.js:6407) — prova de que o
      // caminho do Capitao foi tentado, nao so "disse que clicou":
      const logs = auto.getFarm().log || [];
      t.check('B1: registou o caminho do Capitao (clicouBanner:true)',
        logs.some((l) => l.type === 'tarefa' && l.clicouBanner === true));
      t.check('B1: e a necessidade de tarefa fica verdadeira (a base trata dela)',
        auto.necessidadesBase().tarefa === true);
    }

    /* ---- B2 - banner ESCONDIDO: nao clica ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      baseComBanner(m, { local: 'Fonte', pronta: true });
      m.montar('#rastreio-tarefa', [m.el({ label: 'rastreio-tarefa', className: 'pronta', hidden: true, textContent: 'Tarefa pronta!' })]);
      const r = auto.clicarTarefaPronta();
      t.check('B2: banner escondido -> NAO clica', r.ok === false);
      t.check('B2: o banner nao foi clicado', m.cliqueDe('rastreio-tarefa') === false);
    }

    /* ---- B3 - visivel mas NAO `.pronta` (tarefa a meio): nao clica ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      baseComBanner(m, { local: 'Fonte', pronta: false });
      const r = auto.clicarTarefaPronta();
      t.check('B3: tarefa a meio (sem .pronta) -> NAO clica', r.ok === false);
      t.check('B3: o banner nao foi clicado', m.cliqueDe('rastreio-tarefa') === false);
    }

    /* ---- B4 - visivel + `.pronta` mas FORA da base: nao clica, e a necessidade leva o
     * personagem à Fonte (o jogo pede "Volte à Fonte") ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      baseComBanner(m, { local: 'Selva do Acampamento', pronta: true });
      const r = auto.clicarTarefaPronta();
      t.check('B4: fora da base -> NAO clica', r.ok === false);
      t.check('B4: o motivo diz que é por estar fora da base', r.motivo === 'fora da base');
      t.check('B4: o banner nao foi clicado', m.cliqueDe('rastreio-tarefa') === false);
      t.check('B4: a necessidade n.tarefa fica TRUE — o supervisarBase manda o boneco à Fonte',
        auto.necessidadesBase().tarefa === true);
    }

    /* ---- B5 - so clica UMA vez por chamada (nao e um loop) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      baseComBanner(m, { local: 'Fonte', pronta: true });
      auto.clicarTarefaPronta();
      auto.clicarTarefaPronta();
      const cliques = m.estado.clicks.filter((c) => c === 'rastreio-tarefa').length;
      t.check('B5: cada chamada clica uma vez (sem loop)', cliques === 2);
    }

    /* ---- B6 - BUG MEDIDO 2026-10-20: `#janela-npc` escondida deixa o botao
     * "entregar" no DOM. O `dialogoAberto:true` apanhava esse FANTASMA e dizia que
     * entregou. Tem de recusar o fantasma e nunca clicar nele. ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      baseComBanner(m, { local: 'Fonte', pronta: true });
      m.montar('#npcs button[data-npc="Capitão da Legião"]', [m.el({ tag: 'button', label: 'npc-capitao' })]);
      m.montar('#janela-npc', [m.el({ tag: 'section', label: 'janela-npc', className: 'janela', hidden: true })]);
      m.montar('#janela-npc [data-palavra="entregar"]', [m.el({ tag: 'button', label: 'palavra-entregar-fantasma' })]);
      const r = await auto.entregarTarefa({ dialogoAberto: true });
      t.check('B6: janela NPC escondida + botao fantasma -> NAO entrega', r.ok === false);
      t.check('B6: o botao fantasma NUNCA foi clicado', m.cliqueDe('palavra-entregar-fantasma') === false);
    }
  },
};
