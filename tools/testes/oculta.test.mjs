/*
 * oculta.test.mjs - "ABA ESCONDIDA: O JOGO CORRE; A BASE ESPERA; O BONECO NÃO FICA PARADO".
 *
 * QUEIXA DO DONO (2026-10-23), verbatim:
 *   "por algum motivo, talvez por eu nao ter a pagina carregada, a extensao nao faz auto farm mais.
 *    fica parada na fonte. arruma."
 *
 * CAUSA MEDIDA AO VIVO (2026-10-23, `document.hidden: true`): o `js/pulso.js` do jogo chama
 * `avancar(false)` por um Worker, logo o relógio do motor avança 1:1 com o tempo real mesmo com a
 * aba escondida — medido: 14 -> 28 abates em 30 s. A crença antiga ("aba oculta = jogo parado"),
 * escrita em `supervisarBase`, fazia `return` seco: na Fonte, com a aba escondida, NADA corria e o
 * boneco ficava lá para sempre.
 *
 * A regra que substitui: escondida + na base + algo pendente -> SAIR A FARMAR (farmar não precisa de
 * UI). A rotina da base continua a não correr (`acaoBase` mantém a guarda: os diálogos dependem de
 * timers que o Chrome atrasa e uma falha falsa quarentenava 45 min).
 *
 * CONTRATO: t.check(rotulo, condicao) só passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

function mundo(local) {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  // Armadura/l RM altas: a região tem de ser considerada SEGURA para `regiaoIdeal()` devolver algo.
  definirCampeao(m, 'adtest', {
    nivel: 20,
    stats: { hp: 2000, hpperlevel: 100, hpregen: 10, hpregenperlevel: 0.5, armor: 3000, spellblock: 3000 },
  });
  alimentarMeta(m, {
    monstros: { lobo: { hp: 1, ad: 0.1, as: 1, armadura: 1, xp: 1, ouro: 1 } },
    locais: [{ id: 'lobos', nome: 'Toca dos Lobos', nm: [12, 20], faixa: [12, 20], tier: 1, monstros: [['lobo', 1]] }],
  });
  m.montar('#local-nome', [m.el({ label: 'local-nome', textContent: local })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '2000 / 2000' })]);
  m.montar('.st', [
    m.el({ label: 'st-dano', textContent: 'Dano 100' }),
    m.el({ label: 'st-arm', textContent: 'Armadura 3000' }),
    m.el({ label: 'st-rm', textContent: 'Res. mágica 3000' }),
    m.el({ label: 'st-va', textContent: 'Vel. ataque 1' }),
  ]);
  m.montar('#janela-bolsa', [m.el({ label: 'janela-bolsa', hidden: true })]);
  // Poções a zero: é a necessidade que garante `falta` não vazio (a base tem algo para fazer).
  m.montar('#hud-pocoes', [m.el({ label: 'pocao', attrs: { 'data-pocao': 'vida' }, textContent: '0' })]);
  auto.setConfig({ enabled: true, autoFarm: true });
  return { m, auto };
}

export const suite = {
  nome: 'oculta',
  titulo: 'Aba escondida: o jogo corre, a base espera, e o boneco NÃO fica parado na Fonte',

  async run(t) {
    /* ---- H1: escondida + na Fonte + pendências -> manda farmar (e diz PORQUÊ no log) ---- */
    {
      const { m, auto } = mundo('Fonte');
      m.documento.hidden = true;
      auto.supervisarBase();
      const log = (auto.getFarm().log || []).filter((l) => l.escondida === true);
      t.check('H1a: escondida na Fonte com pendências -> decide SAIR a farmar (regista no log)',
        log.length === 1 && log[0].regiao === 'lobos');
      t.check('H1b: a região escolhida é uma região REAL (não um nome inventado)',
        !!log[0] && log[0].regiao === auto.regiaoIdeal());
      t.check('H1c: o motivo no log nomeia o aba oculta e o que faltava na base',
        !!log[0] && /oculta/i.test(String(log[0].farmar)) && Array.isArray(log[0].falta) && log[0].falta.length > 0);
    }

    /* ---- H2: escondida mas FORA da base -> não força viagem nenhuma (o farm já corre) ---- */
    {
      const { m, auto } = mundo('Toca dos Lobos nível 12–20');
      m.documento.hidden = true;
      auto.supervisarBase();
      const log = (auto.getFarm().log || []).filter((l) => l.escondida === true);
      t.check('H2: fora da base a regra da aba oculta não inventa viagem', log.length === 0);
    }

    /* ---- H3: VISÍVEL + na Fonte -> a rotina da base corre, não o atalho da aba oculta ---- */
    {
      const { m, auto } = mundo('Fonte');
      m.documento.hidden = false;
      auto.supervisarBase();
      const log = (auto.getFarm().log || []).filter((l) => l.escondida === true);
      t.check('H3: com a aba visível a base é tratada (o atalho da aba oculta não dispara)', log.length === 0);
    }

    /* ---- H4: o throttle impede um `press` de viagem a cada tick de 5 s ---- */
    {
      const { m, auto } = mundo('Fonte');
      m.documento.hidden = true;
      auto.supervisarBase();
      auto.supervisarBase();
      auto.supervisarBase();
      const log = (auto.getFarm().log || []).filter((l) => l.escondida === true);
      t.check('H4: 3 ticks seguidos -> UMA decisão de saída (throttle de 45 s)', log.length === 1);
    }
  },
};
