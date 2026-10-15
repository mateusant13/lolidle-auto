/*
 * atributos.test.mjs - RECOMENDAÇÃO DE PONTOS DE ATRIBUTO pelo dano medido (TK-01-37).
 *
 * MOTIVO: o dono mediu (parte-01.md:1076, D2) — "10 pontos em Vitalidade/Resistencia =
 * +0,00% de dano; Forca = +2,64%; Agilidade = +1,96%. ACREDITO NA MATEMATICA" — e o ticket
 * pede a recomendação pelo valor medido de dano por ponto, por classe, SEM inventar número:
 * as fórmulas são do motor vivo.
 *
 * O que se protege:
 *   A1 - o Yasuo (AD) recomenda Força/Agilidade ANTES de Vitalidade/Resistencia;
 *   A2 - Vitalidade e Resistencia valem 0 de dano (motor.js:457/459/516 não entram no dano);
 *   A3 - cada atributo volta com a citação file:linha do motor;
 *   A4 - na magia a Força vale pelo Poder (motor.js:467), não pelo dano de ataque.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'atributos',
  titulo: 'Recomendação de pontos de atributo pelo dano medido (por classe)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);

    /* ---- kit do Yasuo (AD, corpo a corpo) com 2 habilidades de dano ---- */
    // Níveis de desbloqueio REAIS do kit (motor.js: Q1 W1 E1 R6 G8 A13 D18 F23 T28).
    const kit = {
      Q: { nivel: 1, max: 10, base: [40], ratio: [0.55], recarga: [4] },
      T: { nivel: 28, max: 10, base: [70], ratio: [0.9], recarga: [11] },
      R: { nivel: 6, max: 5, base: [200], ratio: [1], recarga: [70, 60, 50, 42, 35] },
    };
    definirCampeao(m, 'yasuo', { kit, magia: false, adBase: 60 });
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
    m.montar('.st', [
      m.el({ label: 'st-dano', textContent: 'Dano 300' }),
      m.el({ label: 'st-va', textContent: 'Vel. ataque 1,58' }),
    ]);
    m.montar('#hab-ativas .hab[data-t]', ['Q', 'T', 'R'].map((tt) => m.el({
      tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
      textContent: (tt === 'R' ? 1 : 10) + ' / ' + (tt === 'R' ? 5 : 10),
    })));

    const rec = auto.recomendarAtributos({ magia: false, adBase: 60, semMana: false });
    const ordem = rec.map((x) => x.atrib);
    const pos = (k) => ordem.indexOf(k);
    // A ordem EXACTA entre Força e Agilidade depende dos números do campeão (na medição do
    // dono, D2, a Força ganhou: +2,64% contra +1,96%). O que o ticket exige — e o que é
    // sempre verdade — é que as DUAS fiquem acima das de defesa no cenário de dano.
    t.check('A1: Yasuo (AD) — as duas primeiras recomendações são Força e Agilidade',
      pos('forca') <= 1 && pos('agilidade') <= 1);
    t.check('A1: Força vem antes de Vitalidade/Resistencia',
      pos('forca') < pos('vitalidade') && pos('forca') < pos('resistencia'));
    t.check('A1: Agilidade vem antes de Vitalidade/Resistencia',
      pos('agilidade') < pos('vitalidade') && pos('agilidade') < pos('resistencia'));
    t.check('A2: Vitalidade vale 0 de dano (motor.js:457/516 — é sobrevivência)',
      rec.find((x) => x.atrib === 'vitalidade').danoPorPonto === 0);
    t.check('A2: Resistencia vale 0 de dano (motor.js:459/516 — é sobrevivência)',
      rec.find((x) => x.atrib === 'resistencia').danoPorPonto === 0);
    t.check('A3: cada atributo volta com a citação file:linha do motor',
      rec.every((x) => typeof x.fonte === 'string' && /motor\.js:\d+/.test(x.fonte)));
    const vForca = rec.find((x) => x.atrib === 'forca').danoPorPonto;
    const vAgi = rec.find((x) => x.atrib === 'agilidade').danoPorPonto;
    t.check('A1: Força e Agilidade dão dano por ponto; as de defesa não',
      vForca > 0 && vAgi > 0);

    /* ---- A4 - na magia a Força vale pelo Poder de Habilidade (motor.js:467) ---- */
    definirCampeao(m, 'lux', { kit, magia: true, adBase: 54 });
    m.montar('.st', [
      m.el({ label: 'st-dano', textContent: 'Dano 120' }),
      m.el({ label: 'st-poder', textContent: 'Poder 400' }),
      m.el({ label: 'st-va', textContent: 'Vel. ataque 1,1' }),
    ]);
    const recMagia = auto.recomendarAtributos({ magia: true, adBase: 54, semMana: false });
    const posM = (k) => recMagia.map((x) => x.atrib).indexOf(k);
    t.check('A4: na magia a Força está no topo (vira Poder, motor.js:467)',
      posM('forca') <= 1);
    t.check('A4: a citação do mago aponta para o FORCA_MAGO',
      /motor\.js:467/.test(recMagia.find((x) => x.atrib === 'forca').fonte));
    t.check('A4: na magia as de defesa continuam em último',
      posM('vitalidade') > posM('forca') && posM('resistencia') > posM('forca'));
  },
};
