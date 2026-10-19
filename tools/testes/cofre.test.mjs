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

import { criarMundo, carregarAutomation, alimentarCatalogo, CATALOGO, definirCampeao, montarMochila, montarLojista } from './dom-stub.mjs';

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

/** Slot de cofre no formato do jogo (jogo.js:5598 `grade`): `data-k`, `data-nome` ("Nome [QUAL]")
 *  e o ícone com o src do jogo (jogo.js:167 `imgItem`). O `find:{img}` é OBRIGATÓRIO: o stub só
 *  devolve `img` se ele estiver no mapa `_find` do elemento (`el.querySelector('img')`), senão a
 *  leitura do base/refino não vê o ícone. */
function slotCofre(m, { k, nome, base, refino = 0, rar = 'basico' }) {
  const img = m.el({
    tag: 'img', label: 'cofre-img:' + k,
    attrs: { src: refino ? `assets/img/itens/ref/${base}-${refino}.png` : `assets/img/itens/${base}.png` },
  });
  return m.el({
    tag: 'button', label: 'cofre-slot:' + k, className: 'cofre-slot r-' + rar,
    dataset: { k: String(k), nome, cofre: 'retirar' },
    find: { img: [img] },
  });
}
/** Monta a grade do cofre (o selector que `lerCofreSlots`/`cofreConhecido` leem). */
function montarGradeCofre(m, slots) { return m.montar('.cofre-slot[data-k]', slots); }

export const suite = {
  nome: 'cofre',
  titulo: 'Cofre na Fonte (Tesoureira em CY-5: subir ate ela, verificando #npcs a cada tile)',

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
      // ACTUALIZADO (2026-10-15, Regra N.o 6): o tecto de subida passou de 2 para 6 tiles POR
      // TENTATIVA. Motivo MEDIDO na fonte do jogo: a Tesoureira esta em \`mundo.js:20\` NPCS_FONTE com
      // \`y: CY - 5\` — 5 tiles acima do centro — e o dono reportou ao vivo "subi 4 tiles na Fonte e a
      // Tesoureira nao apareceu em #npcs". Com 2+2=4 o boneco ficava UM TILE AQUEM. A assercao antiga
      // (4 cliques) codificava o comportamento errado; a nova exige os 12 (2 tentativas x 6) e que o
      // motivo reporte o numero REAL de tiles andados.
      t.check('C6: o motivo e o VERDADEIRO, nao o generico antigo',
        r.motivo === 'subi ' + evs.length + ' tiles na Fonte e a Tesoureira nao apareceu em #npcs');
      t.check('C6: CONTROLO - tentou mesmo andar: 12 cliques no canvas (2 tentativas x 6 tiles = CY-5 com margem)',
        evs.length === 12 && soDireito(evs));
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

    /* ============ C9 - CAMINHADA HUMANIZADA na Fonte (TK-03, TODO §7) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      montarTela(m, 480, 352);                    // 352/11 = 32 px por tile; centro (240,176)
      const r = await auto.subirNaFonte(8);
      const evs = m.eventosDe('tela');
      const centro = 240;
      t.check('C9: subirNaFonte(8) corre e conta 8 tiles', r.ok === true && r.tiles === 8 && evs.length === 8);
      // (a) o 1.º clique NAO e o centro — a caminhada humanizada desvia ja no 1.º passo
      t.check('C9: 1.º clique NAO e o centro (a caminhada nao e uma linha exacta)', evs[0].clientX !== centro);
      // (b) x alterna de lado: o deslocamento entre cliques consecutivos inverte o sinal
      const xs = [centro, ...evs.map((e) => e.clientX)];
      const deltas = [];
      for (let i = 1; i < xs.length; i++) deltas.push(xs[i] - xs[i - 1]);
      t.check('C9: todos os passos tem deslocamento x NAO-zero', deltas.every((d) => d !== 0));
      t.check('C9: x alterna de lado (cada passo inverte o sinal do anterior)',
        deltas.every((d, i) => i === 0 || d * deltas[i - 1] < 0));
      // (c) y entre centro-1.5 tile e centro-0.5 tile (sempre acima do boneco: tem de subir)
      t.check('C9: y > centro-1.5 tile e < centro-0.5 tile', evs.every((e) => e.clientY > 128 && e.clientY < 160));
      // (d) todos os cliques dentro da coluna do tile alvo (meio tile = 16 px)
      t.check('C9: todos os cliques dentro do tile alvo (|x-centro| < 16)', evs.every((e) => Math.abs(e.clientX - centro) < 16));
      // deriva limitada a ±0,45 tile (14,4 px): nunca sai da coluna da Tesoureira
      t.check('C9: deriva limitada a ±0,45 tile (14,4 px)', evs.every((e) => Math.abs(e.clientX - centro) <= 14.45));
      t.check('C9: CONTROLO - todos os cliques sao mousedown do botao direito', soDireito(evs));
    }

    /* ============ C10 - LIXO DO COFRE: classificacao (TK-03, TODO §8) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      // catalogo + um item "especial" (vidaPct -> papel neutro -> `meu`) que e epico: todos os
      // ITENS_ESPECIAIS do CATALOGO sao lendarios, e lendario ja e excluido por outra regra.
      const CAT = CATALOGO.concat([{ id: '7001', nome: 'Amuleto Especial', raridade: 'epico', espaco: 'arma', vidaPct: 0.06, preco: 900 }]);
      alimentarCatalogo(m, CAT);
      definirCampeao(m, 'adtest');
      montarMochila(m, []);
      m.montar('#equip > button.slot[data-id]', [m.el({ tag: 'button', label: 'equip:2001', className: 'slot lendario', attrs: { 'data-id': '2001~S', 'data-dica': 'Lendario AD 1 (lendario)' } })]);
      const L = (k, nome, base, refino, rar) => slotCofre(m, { k, nome, base, refino, rar });
      const slots = [
        L(1, 'Adaga Inutil [B]', '1005', 0, 'basico'),     // duplicado: a melhor copia (B) fica
        L(2, 'Adaga Inutil [C]', '1005', 0, 'basico'),     // duplicado: so o C e lixo
        L(3, 'Refugo Epico [S]', '4001', 0, 'epico'),      // epico S -> NUNCA e lixo
        L(4, 'Couraca Epica [C]', '4002', 0, 'epico'),     // epico C fora da build -> lixo
        L(5, 'Lendario Fraco [C]', '9500', 0, 'lendario'), // lendario -> NUNCA e lixo
        L(6, 'Espada Longa [C]', '1001', 0, 'basico'),     // componente da build -> NUNCA e lixo
        L(7, 'Amuleto Especial [C]', '7001', 0, 'epico'),  // especial -> NUNCA e lixo
      ];
      montarGradeCofre(m, slots);
      const lixo = auto.lixoDoCofreLista();
      const bases = lixo.map((s) => String(s.base)).sort();
      t.check('C10: basico C (duplicado) e lixo', bases.includes('1005') && lixo.some((s) => String(s.base) === '1005' && s.qual === 'C'));
      t.check('C10: epico C fora da build e lixo', bases.includes('4002'));
      t.check('C10: epico S NAO e lixo', !lixo.some((s) => s.qual === 'S'));
      t.check('C10: lendario NUNCA e lixo', !bases.includes('9500'));
      t.check('C10: componente da build NAO e lixo', !bases.includes('1001'));
      t.check('C10: especial NAO e lixo', !bases.includes('7001'));
      t.check('C10: duplicado B+C -> so o C e lixo (o B fica)', lixo.filter((s) => String(s.base) === '1005').length === 1);
      t.check('C10: lixo total = {1005, 4002}', lixo.length === 2 && bases.join(',') === '1005,4002');
      // prova de que a regra da build esta a ser aplicada (1005 nao entra na build do adtest)
      t.check('C10: CONTROLO - 1005 nao esta na build do adtest', !(auto.buildIdeal() || []).map(String).includes('1005'));
      t.check('C10: CONTROLO - 4002 (epico fora da build) nao esta na build', !(auto.buildIdeal() || []).map(String).includes('4002'));
    }

    /* ============ C11 - VENDER O LIXO DO COFRE: caminho ponta a ponta (TK-03) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarLocal(m, 'Fonte');
      // equipamento CHEIO (1 bota + 4 itens, todos melhores que o lixo): assim o `alvoEquip` não
      // escolhe o básico para VESTIR (com o pool quase vazio ele enchia os 4 slots com o lixo).
      m.montar('#equip > button.slot[data-id]', [
        m.el({ tag: 'button', label: 'equip:2007', className: 'slot lendario', attrs: { 'data-id': '2007~S', 'data-dica': 'Botas AD (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2001', className: 'slot lendario', attrs: { 'data-id': '2001~S', 'data-dica': 'Lendario AD 1 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2004', className: 'slot lendario', attrs: { 'data-id': '2004~S', 'data-dica': 'Lendario AD 2 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2005', className: 'slot lendario', attrs: { 'data-id': '2005~S', 'data-dica': 'Lendario AD 3 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2006', className: 'slot lendario', attrs: { 'data-id': '2006~S', 'data-dica': 'Lendario AD 4 (lendario)' } }),
      ]);
      montarMochila(m, []);
      const img = m.el({ tag: 'img', label: 'cofre-img:1', attrs: { src: 'assets/img/itens/1005.png' } });
      const slot = m.el({ tag: 'button', label: 'cofre-slot:1', className: 'cofre-slot r-basico', dataset: { k: '1', nome: 'Adaga Inutil [C]', cofre: 'retirar' }, find: { img: [img] } });
      slot.click = () => {
        m.estado.clicks.push('cofre-slot:1');
        const mo = m.estado.montados.get('#mochila')[0];
        mo.children.push(m.el({ tag: 'button', label: 'mochila:1005~C', className: 'slot basico', attrs: { 'data-id': '1005~C', 'data-dica': 'Adaga Inutil (basico)' } }));
        return true;
      };
      montarGradeCofre(m, [slot]);
      montarLojista(m, [{ id: '1005~C', dica: 'Adaga Inutil (basico)' }]);
      const r = await auto.venderLixoDoCofre();
      t.check('C11: venderLixoDoCofre correu', r.ok === true);
      t.check('C11: sacou o slot do cofre', m.cliqueDe('cofre-slot:1') === true);
      t.check('C11: o item entrou na mochila', m.estado.montados.get('#mochila')[0].children.some((c) => c.getAttribute('data-id') === '1005~C'));
      t.check('C11: passou pelo Lojista (npc -> vender -> abrir-venda -> vender-cesta)',
        m.cliqueDe('npc-lojista') === true && m.cliqueDe('palavra-vender') === true && m.cliqueDe('abrir-venda') === true && m.cliqueDe('vender-cesta') === true);
      t.check('C11: o slot de venda foi clicado', m.clicksDePrefixo('slot:').indexOf('1005~C') >= 0);
      const log = auto.getFarm().log || [];
      const ev = log.find((e) => e.type === 'cofre' && e.acao === 'vender-lixo');
      t.check('C11: logEvent cofre/vender-lixo com vendidos=[1005]', !!ev && Array.isArray(ev.vendidos) && ev.vendidos.join(',') === '1005');
    }

    /* ============ C12 - COFRE VAZIO: nao vende nada (TK-03) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarLocal(m, 'Fonte');
      montarMochila(m, []);
      montarGradeCofre(m, []);
      montarLojista(m, []);
      const r = await auto.venderLixoDoCofre();
      t.check('C12: cofre vazio -> nada a vender', r.ok === true && r.vendidos.length === 0);
      t.check('C12: NAO passou pelo Lojista', m.cliqueDe('npc-lojista') !== true);
      t.check('C12: NAO registou venda', !(auto.getFarm().log || []).some((e) => e.type === 'cofre' && e.acao === 'vender-lixo'));
    }

    /* ============ C13 - DEFEITO da leitura do cofre: base/refino do src refinado (TK-03) ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      const img = m.el({ tag: 'img', label: 'cofre-img', attrs: { src: 'assets/img/itens/ref/1005-2.png' } });
      const slot = m.el({ tag: 'button', label: 'cofre-slot:ref', className: 'cofre-slot r-basico', dataset: { k: '3', nome: 'Adaga Inutil [C]', cofre: 'retirar' }, find: { img: [img] } });
      montarGradeCofre(m, [slot]);
      const lido = auto.lerCofreSlots();
      t.check('C13: base lido do src refinado (1005, NAO o data-k 3)', lido.length === 1 && String(lido[0].base) === '1005');
      t.check('C13: refino lido do src refinado (+2)', lido.length === 1 && lido[0].refino === 2);
      t.check('C13: qualidade lida do data-nome ([C])', lido.length === 1 && lido[0].qual === 'C');
    }
  },
};
