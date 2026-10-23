/*
 * ator.test.mjs - REGRAS DO ATOR (venderBase, o vendedor REAL do Lojista).
 *
 * ARMA ANTI-FALSO-VERDE (a que ja queimou este projeto duas vezes):
 *   TODA a assercao de "NAO vendeu" leva, NA MESMA EXECUCAO de venderBase(), uma assercao
 *   de CONTROLO provando que um item genuinamente vendavel FOI vendido e recebeu clique REAL
 *   no DOM. Alem disso cada cenario fecha com o conjunto EXATO de slots clicados: se o
 *   fixture partir e nada for clicado, os controlos falham e o banco fica VERMELHO.
 *
 * O ator corre contra o extension/automation.js REAL (vm + DOM stubado). Sem browser, sem CDP.
 */

import {
  criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao,
  montarMochila, montarLojista, saturarMercado,
} from './dom-stub.mjs';

const DICA = {
  lendario: 'Item Lendario do teste (+80 AP)',
  epico: 'Item Epico do teste (+30 AD)',
  basico: 'Item Basico do teste (+10 AD)',
};
/* o jogo escreve com acento; o ator testa /lendário/i e /épico/i */
const DICA_REAL = {
  lendario: 'Item Lendário do teste (+80 AP)',
  epico: 'Item Épico do teste (+30 AD)',
  basico: 'Item Básico do teste (+10 AD)',
};

function sl(id, classe) {
  const c = classe || 'basico';
  return { id: id, classe: c, dica: DICA_REAL[c] || DICA_REAL.basico };
}

function conjunto(arr) { return arr.slice().sort().join('|'); }

async function cenario(slots, opts) {
  opts = opts || {};
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'adtest');
  if (opts.saturado) await saturarMercado(auto, m);
  if (opts.autoMontar) auto.setConfig({ autoMontar: true });
  montarMochila(m, slots.map((s) => ({ id: s.id, raridade: s.classe, dica: s.dica })));
  if (opts.semLojista) {
    m.montar('[data-fechar]', []);
    m.montar('#janela-npc [data-fechar]', []);
  } else {
    montarLojista(m, slots);
  }
  return { m: m, auto: auto };
}

export const suite = {
  nome: 'ator',
  titulo: 'Regras do ator (venderBase real no Lojista, com controlos)',

  async run(t) {

    /* ================= R1 - lendario DA BUILD nunca chega ao Lojista ================= */
    {
      const slots = [sl('2001~C', 'lendario'), sl('4001~C', 'epico'), sl('9500~C', 'lendario')];
      const w = await cenario(slots, { saturado: true });
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R1: venderBase retornou ok (o fluxo chegou ao fim)', res.ok === true);
      t.check('R1: CONTROLO - o epico <A 4001~C FOI vendido nesta mesma execucao',
        res.epicosVendidos.indexOf('4001~C') >= 0);
      // ACTUALIZADO 2026-10-14 (regra do dono): "nunca se vende lendario pelo lojista, so pelo mercado".
      // Com o mercado SATURADO nao ha lugar para anunciar, mas o Lojista continua PROIBIDO para
      // lendarios -> o motor GUARDA-O. O comportamento antigo (Lojista como ultimo recurso) caiu.
      t.check('R1: o lendario FORA da build 9500~C NAO vai ao Lojista (regra do dono)',
        res.epicosVendidos.indexOf('9500~C') < 0);
      t.check('R1: CONTROLO - o epico 4001~C recebeu clique REAL e o lendario NAO',
        clicados.indexOf('4001~C') >= 0 && clicados.indexOf('9500~C') < 0);
      t.check('R1: o lendario DA BUILD 2001~C NAO foi vendido', res.epicosVendidos.indexOf('2001~C') < 0);
      t.check('R1: o lendario DA BUILD 2001~C NAO recebeu clique', clicados.indexOf('2001~C') < 0);
      t.check('R1: o lendario DA BUILD esta em regras.protegidos com o motivo certo',
        res.protegidos.some((p) => p.id === '2001~C' && /build da classe/.test(p.motivo)));
      t.check('R1: conjunto EXATO de slots clicados = {4001~C} (so o epico; o lendario fica guardado)',
        conjunto(clicados) === conjunto(['4001~C']));
      t.check('R1: o fluxo passou pela cesta de venda', w.m.cliqueDe('vender-cesta') === true);
      t.check('R1: o fluxo passou pelo NPC Lojista e pela palavra vender',
        w.m.cliqueDe('npc-lojista') === true && w.m.cliqueDe('palavra-vender') === true);
    }

    /* ================= R2 - acima de A (A, A+S, S, SS): NENHUMA raridade ================= */
    {
      // ACTUALIZADO (regra do dono 2026-10-14): só S/SS são intocáveis. A e A+S VÃO ao Lojista.
      // (O corte do próprio jogo é `protegidoVenda = S/SS OU refino>0`, jogo.js:5515.)
      const ACIMA = ['2001+2~S', '4001+1~S', '9500~S', '9500+2~SS'];
      const slots = ACIMA.map((id) => sl(id, /^4001/.test(id) ? 'epico' : 'lendario'))
        .concat([sl('4001~A', 'epico'), sl('9500~A', 'lendario'), sl('4001~C', 'epico'), sl('9500~C', 'lendario')]);
      const w = await cenario(slots, { saturado: true });
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R2: nenhum item S+ foi vendido (S/SS, qualquer raridade)',
        ACIMA.every((id) => res.epicosVendidos.indexOf(id) < 0));
      t.check('R2: nenhum item S+ recebeu clique',
        ACIMA.every((id) => clicados.indexOf(id) < 0));
      t.check('R2: CONTROLO - o epico <A 4001~C FOI vendido nesta mesma execucao',
        res.epicosVendidos.indexOf('4001~C') >= 0);
      // ACTUALIZADO 2026-10-14 (regra do dono): lendario NUNCA ao Lojista, mesmo <A e com o mercado
      // saturado. Os EPICOS <A (4001~A e 4001~C) continuam a ir — sao lixo, e o Lojista e o descarte.
      t.check('R2: o lendario <A 9500~C NAO vai ao Lojista (regra do dono)',
        res.epicosVendidos.indexOf('9500~C') < 0);
      // ACTUALIZADO 2026-10-23 (ordem do dono, verbatim: "é pra vender epico tier a tambem"): o
      // épico A da MINHA classe passa a ir ao Lojista; só S+ é intocável. O 4001~C continua a ser
      // lixo vendável — é o controlo de que a regra não passou a proteger tudo.
      t.check('R2: o epico A da MINHA classe 4001~A VAI ao Lojista (ordem do dono 2026-10-23)',
        res.epicosVendidos.indexOf('4001~A') >= 0);
      t.check('R2: conjunto EXATO de slots clicados = {4001~A, 4001~C} (os dois épicos)',
        conjunto(clicados) === conjunto(['4001~A', '4001~C']));
      t.check('R2: o fluxo chegou ao fim (ok + cesta clicada)',
        res.ok === true && w.m.cliqueDe('vender-cesta') === true);
    }

    /* ================= R3 - mercado SATURADO: sub-A vai inteiro (dedupe-1 e do anuncio) ================= */
    {
      // NOTA (2026-10-14): o epico usado aqui era o 2002, mas ele E COMPONENTE de lendarios
      // da build (2001/2004/2005/2006/2008) — e uma regra NOVA passou a proteger epicamente
      // componentes da build (o Tiamat montado por 124.500 de ouro foi VENDIDO por 600 antes
      // disso). O 4001 nao e componente de nada (R2 ja prova que ele E vendido), por isso
      // passou a ser ele a servir de "epico sub-A vendavel". O 2002 fica como CONTROLCO da
      // regra nova: tem de ser PROTEGIDO.
      const slots = [sl('4001~B', 'epico'), sl('4001~C', 'epico'), sl('2002~C', 'epico'),
        sl('9500~B', 'lendario'), sl('9500~C', 'lendario'), sl('2001~C', 'lendario')];
      const w = await cenario(slots, { saturado: true });
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R3: com o mercado saturado, os dois epicos sub-A vao inteiro (4001~B e 4001~C)',
        ['4001~B', '4001~C'].every((id) => res.epicosVendidos.indexOf(id) >= 0));
      // ACTUALIZADO 2026-10-21 (regra do dono, verbatim: "eu nao mandei nunca montar itens. e
      // sempre comprar do mercado"). ANTES o actor guardava TODO componente da build ideal mesmo
      // com a montagem desligada; o `planBag` mandava vender (`basico/épico → Lojista`), o actor
      // vendia 0, a necessidade `vender` ficava `true` e a loja abria 5× por ida à base (P0 medido
      // no log de 2026-10-21). Agora a guarda de componente só vale com `autoMontar` LIGADO:
      // montagem desligada -> vende (como o planeador manda). R3b prova o outro lado.
      t.check('R3-NOVO: com a montagem DESLIGADA, o epico COMPONENTE (2002~C) E vendido (plano do planBag)',
        res.epicosVendidos.indexOf('2002~C') >= 0);
      // ACTUALIZADO 2026-10-14 (regra do dono, verbatim): "lendarios sao desejados pelos jogadores,
      // entao nunca se vende lendario pelo lojista, so pelo mercado". Com o mercado SATURADO nao ha
      // lugar para anunciar, mas o Lojista continua PROIBIDO para lendarios -> o motor GUARDA-os.
      // O comportamento antigo (vender ao Lojista como ultimo recurso) foi proibido pelo dono.
      t.check('R3: com o mercado saturado, os dois lendarios sub-A NAO vao ao Lojista (regra do dono)',
        ['9500~B', '9500~C'].every((id) => res.epicosVendidos.indexOf(id) < 0));
      t.check('R3: CONTROLO de protecao - o lendario da build 2001~C NAO foi vendido',
        res.epicosVendidos.indexOf('2001~C') < 0);
      // So os dois EPICOS sao clicados: os lendarios ficam guardados (mercado saturado + Lojista
      // proibido para lendarios). O 2002~C entra (componente, mas montagem DESLIGADA) e o 2001~C
      // nao entra (lendario da build, protegido).
      t.check('R3: conjunto EXATO de slots clicados = {4001~B, 4001~C, 2002~C} (epicos, montagem desligada)',
        conjunto(clicados) === conjunto(['4001~B', '4001~C', '2002~C']));
      t.check('R3: o fluxo chegou ao fim', res.ok === true && w.m.cliqueDe('vender-cesta') === true);
      t.check('R3: nenhum item vendido era ACIMA de A (A/S/SS)',
        res.epicosVendidos.every((id) => /~(A|S|SS)$/.test(id) === false));
    }

    /* ========= R3b - MONTAGEM LIGADA (`autoMontar`): o componente É protegido =========
     * O outro lado da mesma regra. Sem este controlo, "vender o componente" passaria tanto com a
     * montagem ligada como desligada e a guarda podia ser apagada sem o banco dar por isso. */
    {
      const slots = [sl('4001~B', 'epico'), sl('2002~C', 'epico')];
      const w = await cenario(slots, { saturado: true, autoMontar: true });
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R3b: com a montagem LIGADA, o epico COMPONENTE (2002~C) NAO foi vendido',
        res.epicosVendidos.indexOf('2002~C') < 0 && clicados.indexOf('2002~C') < 0);
      t.check('R3b: ...mas o epico que nao serve a build (4001~B) continua a ser vendido',
        res.epicosVendidos.indexOf('4001~B') >= 0);
    }

    /* ================= R4 - Rabadon '3089+2' (base 3089) nunca vai ao Lojista ================= */
    {
      const slots = [sl('3089+2~C', 'lendario'), sl('4001~C', 'epico')];
      const w = await cenario(slots, { saturado: true });
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R4: CONTROLO - o epico 4001~C FOI vendido nesta mesma execucao',
        res.epicosVendidos.indexOf('4001~C') >= 0);
      t.check('R4: Rabadon com refino (3089+2~C) NAO foi vendido', res.epicosVendidos.indexOf('3089+2~C') < 0);
      t.check('R4: Rabadon com refino NAO recebeu clique', clicados.indexOf('3089+2~C') < 0);
      t.check('R4: conjunto EXATO de slots clicados = {4001~C}', conjunto(clicados) === '4001~C');
      t.check('R4: o fluxo chegou ao fim', res.ok === true && w.m.cliqueDe('vender-cesta') === true);
    }

    /* ================= R5 - qualidade ILEGIVEL vai para regras.protegidos ================= */
    {
      const slots = [sl('9500~?', 'lendario'), sl('4001~C', 'epico')];
      const w = await cenario(slots, { saturado: true });
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R5: qualidade ilegivel vai para regras.protegidos com motivo de qualidade',
        res.protegidos.some((p) => p.id === '9500~?' && /qualidade/.test(p.motivo)));
      t.check('R5: qualidade ilegivel NAO foi vendida', res.epicosVendidos.indexOf('9500~?') < 0);
      t.check('R5: qualidade ilegivel NAO recebeu clique', clicados.indexOf('9500~?') < 0);
      t.check('R5: CONTROLO - o epico 4001~C FOI vendido nesta mesma execucao',
        res.epicosVendidos.indexOf('4001~C') >= 0);
      t.check('R5: conjunto EXATO de slots clicados = {4001~C}', conjunto(clicados) === '4001~C');
      t.check('R5: o fluxo chegou ao fim', res.ok === true && w.m.cliqueDe('vender-cesta') === true);
    }

    /* ================= R6 - sem saturacao, lendario <A fora da build nao vai ao Lojista ================= */
    {
      const slots = [sl('9500~C', 'lendario'), sl('4001~C', 'epico')];
      const w = await cenario(slots, {});
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('R6: CONTROLO - o epico 4001~C FOI vendido nesta mesma execucao',
        res.epicosVendidos.indexOf('4001~C') >= 0);
      t.check('R6: sem mercado saturado, o lendario <A fora da build NAO vai ao Lojista',
        res.epicosVendidos.indexOf('9500~C') < 0);
      t.check('R6: ...e nao recebeu clique', clicados.indexOf('9500~C') < 0);
      t.check('R6: conjunto EXATO de slots clicados = {4001~C}', conjunto(clicados) === '4001~C');
      t.check('R6: o fluxo chegou ao fim', res.ok === true && w.m.cliqueDe('vender-cesta') === true);
    }

    /* ================= R7 - canario do harness: sem NPC nada vende (nao ha verde vazio) ================= */
    {
      const slots = [sl('4001~C', 'epico')];
      const w = await cenario(slots, { semLojista: true });
      const res = await w.auto.venderBase();
      t.check('R7: canario - sem NPC Lojista o vendedor falha explicitamente',
        res.ok === false && res.motivo === 'sem lojista');
      t.check('R7: canario - nenhum slot foi clicado quando o NPC falta',
        w.m.clicksDePrefixo('slot:').length === 0);
      const w2 = await cenario(slots, {});
      const res2 = await w2.auto.venderBase();
      t.check('R7: canario - a MESMA fixture com o NPC presente vende o epico (o falhanco era o NPC)',
        res2.ok === true && res2.epicosVendidos.indexOf('4001~C') >= 0);
      t.check('R7: canario - a fixture vendavel e mesmo vendavel (prova de que os controlos mordem)',
        w2.m.clicksDePrefixo('slot:').indexOf('4001~C') >= 0);
    }
  },
};
