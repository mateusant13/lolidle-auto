/*
 * cofre.test.mjs - O COFRE NA FONTE: a Tesoureira esta ACIMA da praca.
 *
 * DEFEITO MEDIDO AO VIVO (2026-10-14, Katarina na Fonte):
 *   `#npcs` tinha Soraka, Lojista, Mestre da Legiao, Capitao da Legiao e Ornn — a TESOUREIRA NAO
 *   ESTAVA LA — e `abrirCofreTesoureira()` devolvia sempre "sem Tesoureira/Burrinho aqui", em sitio
 *   nenhum: o cofre nunca podia ser lido. Causa (dono, verbatim): "por que tem que clicar pra cima, a
 *   partir da fonte, duas vezes (andar pra cima) e achar a tesoureira". No fonte do jogo a Tesoureira
 *   esta em `mundo.js:19-21` (NPCS_FONTE) em `(CX-1, CY-5)` — 5 tiles ACIMA do centro da praca.
 *
 * O QUE ESTE BANCO PROVA (contra o automation.js REAL, em vm com DOM stubado):
 *   1. `andarParaCima(n)` clica no chao do canvas `#tela` com o BOTAO DIREITO, exactamente a
 *      `rect.height/VIS_A` px de CSS acima do centro (a camera centra o campeao: cena.js:4060),
 *      1 clique por tile — a conversao tile->ecra tem de ser a do jogo, nao um numero inventado.
 *   2. Na FONTE e sem a Tesoureira no DOM, o motor ANDA e so depois a procura: se ela aparecer
 *      depois de subir, o cofre abre (via='Tesoureira de Piltover').
 *   3. Se mesmo assim ela nao aparecer, o motivo devolvido e o VERDADEIRO ("subi N tiles..."), nao
 *      o generico antigo — e o controlo prova que ele tentou mesmo andar (N cliques no canvas).
 *   4. A CIDADE (Burrinho de Carga) e o caminho antigo ficam intactos: abre sem andar 1 tile.
 *
 * Sem browser, sem CDP, sem jogo. So le o automation.js e corre-o isolado.
 */

import { criarMundo, carregarAutomation } from './dom-stub.mjs';

/** Canvas `#tela` com o mesmo formato do jogo: 15 tiles de largura x 11 de altura a 32 px = 480x352
 *  px de CSS e bitmap 11*32*2 = 704 (cena.js:325 `canvas.height = VIS_A*T*ESCALA`). */
function montarTela(m, w, h, bitmap) {
  const tela = m.el({ tag: 'canvas', label: 'tela', rect: { width: w, height: h } });
  tela.height = bitmap == null ? 704 : bitmap;
  m.montar('#tela', [tela]);
  return tela;
}
function montarLocal(m, texto) { m.montar('#local-nome', [m.el({ tag: 'span', label: 'local', textContent: texto })]); }
/** Simula o servidor a encher `#npcs` e o dialogo do cofre a abrir. */
function montarDialogoCofre(m, label) {
  const slot = m.el({ tag: 'div', label: 'cofre-slot', className: 'cofre-slot', dataset: { k: '0' } });
  const btn = m.el({ tag: 'button', label: 'palavra-cofre' });
  btn.click = () => { m.estado.clicks.push('palavra-cofre'); m.montar('.cofre-slot[data-k]', [slot]); return true; };
  m.montar('#janela-npc [data-palavra="cofre"]', [btn]);
  return btn;
}
function botaoNpc(m, nome, label) {
  const b = m.el({ tag: 'button', label: label });
  b.click = () => { m.estado.clicks.push(label); montarDialogoCofre(m, nome); return true; };
  m.montar('#npcs button[data-npc="' + nome + '"]', [b]);
  return b;
}
const soDireito = (evs) => evs.every((e) => e.tipo === 'mousedown' && e.button === 2);

export const suite = {
  nome: 'cofre',
  titulo: 'Cofre na Fonte (Tesoureira acima da praca: andar 2 tiles e so depois procurar o NPC)',

  async run(t) {

    /* ============ C1 - a CONVERSAO tile->ecra: 1 tile = rect.height/VIS_A, botao direito ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarTela(m, 480, 352);                       // 352/11 = 32 px de CSS por tile
      const r = await auto.andarParaCima(2);
      const evs = m.eventosDe('tela');
      t.check('C1: andarParaCima(2) corre e conta 2 tiles', r.ok === true && r.tiles === 2);
      t.check('C1: disparou 2 eventos no canvas #tela', evs.length === 2);
      t.check('C1: CONTROLO - os dois sao mousedown do BOTAO DIREITO (jogo.js:1449 exige button===2)', soDireito(evs));
      t.check('C1: x = centro do canvas (a camera centra o campeao: cena.js:4060)', evs.length === 2 && evs[0].clientX === 240);
      t.check('C1: y = centro - 1 tile (176 - 352/11 = 144)', evs.length === 2 && evs[0].clientY === 144);
      t.check('C1: o 2.º clique e no MESMO ponto (a camera recentra-se depois de andar 1 tile)',
        evs.length === 2 && evs[1].clientY === 144 && evs[1].clientX === 240);
      t.check('C1: nao cliquei no centro do canvas (isso seria andar 0 tiles)', evs.length === 2 && evs.every((e) => e.clientY < 176));
    }

    /* ============ C2 - subirNaFonte recusa fora da Fonte (nao se anda as cegas no campo) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Rio nível 25–35');
      montarTela(m, 480, 352);
      const r = await auto.subirNaFonte(2);
      t.check('C2: fora da Fonte subirNaFonte recusa', r.ok === false && r.tiles === 0 && /Fonte/.test(String(r.motivo)));
      t.check('C2: ...e nao clica no canvas', m.eventosDe('tela').length === 0);
    }

    /* ============ C3 - O DEFEITO: na FONTE a Tesoureira so aparece depois de SUBIR ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      const tela = montarTela(m, 480, 352);
      // o servidor so poe a Tesoureira em #npcs DEPOIS de o boneco andar (é o defeito medido):
      const original = tela.dispatchEvent;
      tela.dispatchEvent = (ev) => { original(ev); botaoNpc(m, 'Tesoureira de Piltover', 'npc-tesoureira'); return true; };
      const r = await auto.abrirCofreTesoureira();
      t.check('C3: o cofre ABRIU (antes: motivo generico, nunca abria na Fonte)', r.ok === true);
      t.check('C3: abriu pela Tesoureira de Piltover', r.via === 'Tesoureira de Piltover');
      t.check('C3: CONTROLO - andou 1 tile e parou (a Tesoureira apareceu e o resto do caminho nao se faz)',
        r.subiu === 1 && m.eventosDe('tela').length === 1);
      t.check('C3: CONTROLO - o clique no NPC e na palavra "cofre" aconteceram de verdade',
        m.cliqueDe('npc-tesoureira') === true && m.cliqueDe('palavra-cofre') === true);
    }

    /* ============ C4 - CIDADE: o Burrinho abre o cofre SEM andar 1 tile (caminho antigo intacto) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Runeterra Demacia');
      montarTela(m, 480, 352);
      botaoNpc(m, 'Burrinho de Carga', 'npc-burrinho');
      const r = await auto.abrirCofreTesoureira();
      t.check('C4: na cidade o Burrinho de Carga abre o cofre', r.ok === true && r.via === 'Burrinho de Carga');
      t.check('C4: ...e o motor NAO andou nenhum tile (subiu === 0)', r.subiu === 0);
      t.check('C4: ...nem tocou no canvas #tela', m.eventosDe('tela').length === 0);
    }

    /* ============ C5 - CIDADE sem Burrinho: motivo antigo, sem andar as cegas ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Runeterra Demacia');
      montarTela(m, 480, 352);
      const r = await auto.abrirCofreTesoureira();
      t.check('C5: cidade sem Burrinho devolve o motivo antigo (nao inventa subida)',
        r.ok === false && r.motivo === 'sem Tesoureira/Burrinho aqui (cofre abre na Fonte ou na cidade)');
      t.check('C5: ...e nao clica no canvas', m.eventosDe('tela').length === 0);
    }

    /* ============ C6 - FONTE sem Tesoureira nenhuma: MOTIVO VERDADEIRO + controlo de que andou ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      montarTela(m, 480, 352);
      const r = await auto.abrirCofreTesoureira();
      const evs = m.eventosDe('tela');
      t.check('C6: o cofre nao abriu (nao ha NPC nenhum no DOM)', r.ok === false);
      t.check('C6: o motivo e o VERDADEIRO, nao o generico antigo',
        r.motivo === 'subi 4 tiles na Fonte e a Tesoureira nao apareceu em #npcs');
      t.check('C6: CONTROLO - tentou mesmo andar: 4 cliques no canvas (2 tentativas x 2 tiles)',
        evs.length === 4 && soDireito(evs));
      // GUARDA (2026-10-14): o 1.º parametro de esperarNpcDoCofre sao TENTATIVAS, nao ms. Com um
      // "2000" colado ali (como no tempo em ms) o jogo ficaria 2000 x 180 ms ~ 6 MINUTOS a esperar.
      const procuras = m.estado.queries.filter((q) => q.sel === '#npcs button[data-npc="Tesoureira de Piltover"]').length;
      t.check('C6: a espera pelo NPC e LIMITADA (2 tentativas x 12 procuras = 24; nao 2000)', procuras > 0 && procuras <= 40);
    }

    /* ============ C7 - FONTE sem canvas medivel: motivo honesto da SUBIDA (nao o generico) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      montarTela(m, 0, 0);
      const r = await auto.abrirCofreTesoureira();
      t.check('C7: canvas sem tamanho -> motivo da subida, explicito',
        r.ok === false && /nao cheguei a Tesoureira/.test(String(r.motivo)) && /sem tamanho medivel/.test(String(r.motivo)));
    }

    /* ============ C8 - FONTE com canvas de formato inesperado: recusa em vez de clicar a toa ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      montarTela(m, 480, 352, 640);                  // 640 != VIS_A*T*ESCALA = 704
      const r = await auto.abrirCofreTesoureira();
      t.check('C8: canvas com altura fora do formato -> recusa clicar (nao adivinha a conversao)',
        r.ok === false && /nao sei converter tile->ecra/.test(String(r.motivo)));
      t.check('C8: ...e nao dispara nenhum clique no canvas', m.eventosDe('tela').length === 0);
    }
  },
};
