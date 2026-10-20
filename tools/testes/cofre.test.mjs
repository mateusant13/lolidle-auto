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
 *      1 clique por tile na funcao directa `andarParaCima` (conversao tile->ecra do jogo).
 *      `subirNaFonte(n)` faz UM clique de DESTINO n tiles acima (o jogo faz o caminho com
 *      `cena.andarPara`) e `abrirCofreTesoureira` faz DUAS subidas de 4 tiles = 8 (CY+3 -> CY-5).
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
  // O motor real tem os DOIS lados (cena.js:325): bitmap = VIS_*T*ESCALA. O clicarNpcPorPosicao
  // exige `cv.width > 0`; sem isto o caminho por posicao nunca corria no banco.
  tela.width = w * 2;
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
/** O jogo real NÃO põe a Tesoureira em `#npcs` (`jogo.js:7025`: `#npcs` fica oculto na Fonte e
 *  nas cidades; os botões estáticos de `jogar.html:181-187` nem a têm). Ela abre quando se clica
 *  no canvas em cima dela: `comandoNaFonte` -> `cena.clicar` -> `falarCom` (`jogo.js:472-477`) e
 *  `abrirConversa` escreve o nome em `#npc-titulo` (`jogo.js:5513`). Este fixture simula isso. */
function abrirDialogoNpc(m, nome) {
  m.montar('#janela-npc', [m.el({ tag: 'section', label: 'janela-npc', className: 'janela', hidden: false })]);
  m.montar('#npc-titulo', [m.el({ tag: 'span', label: 'npc-titulo', textContent: nome })]);
  montarDialogoCofre(m, nome);
}
const soDireito = (evs) => evs.every((e) => e.tipo === 'mousedown' && e.button === 2);
/** O clique do jogo é o `mousedown`; a humanização acrescenta `mousemove`/`mouseup` à volta.
 *  As contagens têm de olhar para os cliques, não para todos os eventos. */
const cliques = (evs) => evs.filter((e) => e.tipo === 'mousedown');

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
/** Grade de cofre VIVA como o motor (motor.js:3277-3283 + jogo.js:5598/6181-6192):
 *  `data-k` é o ÍNDICE do array; clicar num slot de retirar faz splice(k,1), adiciona o
 *  item à mochila e re-renderiza os restantes com os novos índices. Se `semSaque` for true,
 *  o clique não remove nem adiciona (simula mochila cheia / servidor recusou). O label é
 *  estável por spec (base~qual) para as asserções poderem procurar o slot certo. */
/** Monta o #npc-troca como o jogo (jogo.js:5605-5638): a mochila (guardar) e o cofre
 *  (retirar) usam a MESMA classe .cofre-slot e o MESMO data-k (indice do array de cada lado).
 *  O clique no slot da mochila regista 'guardar'; o do cofre adiciona o item a mochila. */
function montarNpcTroca(m, mochilaSpecs, cofreSpecs) {
  const mochila = mochilaSpecs.map((s, i) => {
    const img = m.el({ tag: 'img', label: 'troca-img-m:' + i, attrs: { src: 'assets/img/itens/' + s.base + '.png' } });
    const el = m.el({
      tag: 'button', label: 'troca-mochila:' + s.base + '~' + s.qual, className: 'cofre-slot r-' + (s.rar || 'basico'),
      dataset: { k: String(i), nome: s.nome, cofre: 'guardar', id: s.base + '~' + s.qual, dica: s.dica || '' },
      find: { img: [img] },
    });
    el.click = () => { m.estado.clicks.push(el.label); return true; };
    return el;
  });
  const cofre = cofreSpecs.map((s, i) => {
    const img = m.el({ tag: 'img', label: 'troca-img-c:' + i, attrs: { src: s.refino ? 'assets/img/itens/ref/' + s.base + '-' + s.refino + '.png' : 'assets/img/itens/' + s.base + '.png' } });
    const el = m.el({
      tag: 'button', label: 'troca-cofre:' + s.base + '~' + (s.qual || 'C') + '+' + (s.refino || 0), className: 'cofre-slot r-' + (s.rar || 'basico'),
      dataset: { k: String(i), nome: s.nome, cofre: 'retirar', id: s.base + '~' + (s.qual || 'C'), dica: s.dica || '' },
      find: { img: [img] },
    });
    el.click = () => {
      m.estado.clicks.push(el.label);
      const mo = m.estado.montados.get('#mochila')[0];
      if (mo) mo.children.push(m.el({ tag: 'button', label: 'mochila:' + el.dataset.id, className: 'slot ' + (s.rar || 'basico'), attrs: { 'data-id': el.dataset.id, 'data-dica': el.dataset.dica || '' } }));
      return true;
    };
    return el;
  });
  m.montar('.cofre-slot[data-k]', [...mochila, ...cofre]);
}
function montarGradeCofreMotor(m, specs, opts) {
  opts = opts || {};
  let vivos = specs.slice();
  const pinta = () => {
    const els = vivos.map((s, i) => {
      const img = m.el({ tag: 'img', label: 'cofre-img:' + s.base + i, attrs: { src: s.refino ? `assets/img/itens/ref/${s.base}-${s.refino}.png` : `assets/img/itens/${s.base}.png` } });
      const el = m.el({
        tag: 'button', label: 'cofre-slot:' + s.base + '~' + (s.qual || 'C'), className: 'cofre-slot r-' + (s.rar || 'basico'),
        dataset: { k: String(i), nome: s.nome, cofre: 'retirar', id: `${s.base}~${s.qual || 'C'}`, dica: s.dica || '' },
        find: { img: [img] },
      });
      el.click = () => {
        m.estado.clicks.push(el.label);
        const idx = vivos.indexOf(s);
        if (idx < 0) return false;
        vivos.splice(idx, 1);                   // motor.js:3277-3283
        if (!opts.semSaque) {
          const mo = m.estado.montados.get('#mochila')[0];
          if (mo) mo.children.push(m.el({ tag: 'button', label: 'mochila:' + el.dataset.id, className: 'slot ' + (s.rar || 'basico'), attrs: { 'data-id': el.dataset.id, 'data-dica': el.dataset.dica || '' } }));
        }
        pinta();                                 // jogo.js:6181-6192 mostrarCofre()
        return true;
      };
      return el;
    });
    montarGradeCofre(m, els);
  };
  pinta();
}

export const suite = {
  nome: 'cofre',
  titulo: 'Cofre na Fonte (Tesoureira em CY-5: duas subidas de 4 tiles, CY+3 -> CY-5)',

  async run(t) {

    /* ============ C1 - a CONVERSAO tile->ecra: 1 tile = rect.height/VIS_A, botao direito ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarTela(m, 480, 352);                       // 352/11 = 32 px de CSS por tile
      const r = await auto.andarParaCima(2);
      const evs = cliques(m.eventosDe('tela'));
      t.check('C1: andarParaCima(2) corre e conta 2 tiles', r.ok === true && r.tiles === 2);
      t.check('C1: disparou 2 cliques no canvas #tela', evs.length === 2);
      t.check('C1: CONTROLO - os dois sao mousedown do BOTAO DIREITO (jogo.js:1449 exige button===2)', soDireito(evs));
      t.check('C1: x = centro do canvas (a camera centra o campeao: cena.js:4060)', evs.length === 2 && evs[0].clientX === 240);
      t.check('C1: y = centro - 1 tile (176 - 352/11 = 144)', evs.length === 2 && evs[0].clientY === 144);
      t.check('C1: o 2.º clique e no MESMO ponto (a camera recentra-se depois de andar 1 tile)',
        evs.length === 2 && evs[1].clientY === 144 && evs[1].clientX === 240);
      t.check('C1: nao cliquei no centro do canvas (isso seria andar 0 tiles)', evs.length === 2 && evs.every((e) => e.clientY < 176));
      t.check('C1: o clique traz a sequencia humana mousemove+mousedown+mouseup', m.eventosDe('tela').length === 6 && m.eventosDe('tela').filter((e) => e.tipo === 'mouseup').length === 2);
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

    /* ============ C3 - O DEFEITO: na FONTE a Tesoureira NÃO está em #npcs ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      const tela = montarTela(m, 480, 352);
      // PROVA da fonte: `#npcs` pode até ter sido montado — na Fonte ele está OCULTO e não tem
      // a Tesoureira (`jogo.js:7025`, `jogar.html:181-187`). O NPC só abre por clique no CANVAS,
      // uma vez adjacente: depois das duas subidas (y=48), o tile à ESQUERDA do boneco é o dela.
      m.montar('#npcs', [m.el({ tag: 'div', label: 'npcs', hidden: true })]);
      const original = tela.dispatchEvent;
      tela.dispatchEvent = (ev) => {
        original(ev);
        const subidas = cliques(m.eventosDe('tela')).filter((e) => e.clientY === 48).length;
        if (subidas >= 2 && ev.type === 'mousedown' && ev.clientX === 208 && ev.clientY === 176) abrirDialogoNpc(m, 'Tesoureira de Piltover');
        return true;
      };
      const r = await auto.abrirCofreTesoureira();
      const evs = cliques(m.eventosDe('tela'));
      t.check('C3: o cofre ABRIU (antes: motivo generico, nunca abria na Fonte)', r.ok === true);
      t.check('C3: abriu pela Tesoureira de Piltover', r.via === 'Tesoureira de Piltover');
      t.check('C3: CONTROLO - duas subidas de 4 tiles = 8 (CY+3 -> CY-5)',
        r.subiu === 8 && evs.filter((e) => e.clientY === 48).length === 2);
      t.check('C3: CONTROLO - clicou no NPC à ESQUERDA do boneco (1 tile) no canvas',
        evs.some((e) => e.clientX === 208 && e.clientY === 176));
      t.check('C3: CONTROLO - a palavra "cofre" foi clicada de verdade',
        m.cliqueDe('palavra-cofre') === true);
      t.check('C3: nenhum botão de #npcs foi usado para a Tesoureira',
        m.cliqueDe('npc-tesoureira') !== true);
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
      const evs = cliques(m.eventosDe('tela'));
      t.check('C6: o cofre nao abriu (nao ha NPC nenhum no DOM)', r.ok === false);
      // ACTUALIZADO (2026-10-19, Regra N.o 6): nao sao 6+6 cliques de 1 tile. O boneco chega a
      // Fonte em `mundo.js:201` `cy + 3`; a Tesoureira esta em `mundo.js:20` `CY - 5`: 8 tiles.
      // Dois DESTINOS de 4 tiles (o "duas vezes" do dono) deixam o `cena.andarPara` contornar o
      // chafariz; o antigo 1-clique-por-tile ficava preso e nunca a revelava.
      t.check('C6: o motivo e o VERDADEIRO, nao o generico antigo',
        r.motivo === 'subi 8 tiles na Fonte e a Tesoureira nao abriu o dialogo');
      t.check('C6: CONTROLO - tentou mesmo andar: 2 destinos de 4 tiles = 8 tiles (2 cliques no canvas)',
        evs.filter((e) => e.clientY === 48).length === 2 && r.subiu === 8 && soDireito(evs));
      t.check('C6: CONTROLO - depois de subir, procurou a Tesoureira no CANVAS (não em #npcs)',
        evs.length > 2 && evs.some((e) => e.clientY === 176));
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
      const r1 = await auto.subirNaFonte(4);
      const r2 = await auto.subirNaFonte(4);
      const todos = m.eventosDe('tela');
      const evs = cliques(todos);
      const centro = 240;
      t.check('C9: dois destinos de 4 tiles = o "duas vezes" do dono', r1.ok && r2.ok && r1.tiles === 4 && r2.tiles === 4 && evs.length === 2);
      t.check('C9: cada clique humano traz mousemove e mouseup (3 eventos por destino)',
        todos.length === 6 && todos.filter((e) => e.tipo === 'mousemove').length === 2 && todos.filter((e) => e.tipo === 'mouseup').length === 2);
      t.check('C9: 1.o clique NAO e o centro (a caminhada nao e uma linha exacta)', evs[0].clientX !== centro);
      t.check('C9: os dois cliques alternam de lado', evs[0].clientX !== evs[1].clientX && (evs[0].clientX - centro) * (evs[1].clientX - centro) < 0);
      t.check('C9: y = centro - 4 tiles (48), dentro do canvas', evs.every((e) => e.clientY === 48));
      t.check('C9: cliques dentro da coluna do alvo (|x-centro| <= 0,45 tile = 14,4 px)', evs.every((e) => Math.abs(e.clientX - centro) <= 14.45));
      t.check('C9: CONTROLO - os dois sao mousedown do botao direito', soDireito(evs));
      t.check('C9: eventos sao sinteticos (isTrusted=false): nunca abrem o menu de contexto do Chrome',
        evs.every((e) => e.isTrusted === false));
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

    /* ============ C10b - COMPONENTE DUPLICADO: uma copia fica, a pior e lixo ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarMochila(m, []);
      m.montar('#equip > button.slot[data-id]', [m.el({ tag: 'button', label: 'equip:2001', className: 'slot lendario', attrs: { 'data-id': '2001~S', 'data-dica': 'Lendario AD 1 (lendario)' } })]);
      const L = (k, nome, base, refino, rar) => slotCofre(m, { k, nome, base, refino, rar });
      montarGradeCofre(m, [
        L(1, 'Espada Longa [B]', '1001', 0, 'basico'),     // melhor copia do componente
        L(2, 'Espada Longa [C]', '1001', 0, 'basico'),     // duplicado do componente -> lixo
      ]);
      const lixo = auto.lixoDoCofreLista();
      t.check('C10b: componente duplicado -> so a pior copia e lixo',
        lixo.length === 1 && String(lixo[0].base) === '1001' && lixo[0].qual === 'C');
      t.check('C10b: a melhor copia do componente fica', !lixo.some((s) => s.qual === 'B'));
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

    /* ============ C14 - INDICE A MEXER: o splice reordena o cofre (motor.js:3277-3283) ==== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarLocal(m, 'Fonte');
      m.montar('#equip > button.slot[data-id]', [
        m.el({ tag: 'button', label: 'equip:2007', className: 'slot lendario', attrs: { 'data-id': '2007~S', 'data-dica': 'Botas AD (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2001', className: 'slot lendario', attrs: { 'data-id': '2001~S', 'data-dica': 'Lendario AD 1 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2004', className: 'slot lendario', attrs: { 'data-id': '2004~S', 'data-dica': 'Lendario AD 2 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2005', className: 'slot lendario', attrs: { 'data-id': '2005~S', 'data-dica': 'Lendario AD 3 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2006', className: 'slot lendario', attrs: { 'data-id': '2006~S', 'data-dica': 'Lendario AD 4 (lendario)' } }),
      ]);
      montarMochila(m, []);
      // 4 slots: 3 lixos (1005 C, 4002 C, 4001 C) + 1 LENDARIO (9500 S) — este e o que a
      // releitura protege: apos cada splice o k muda, e o lendario passa a ocupar o indice
      // que o lixo tinha. Se o codigo usasse o k antigo, sacava o lendario.
      montarGradeCofreMotor(m, [
        { base: '1005', qual: 'C', nome: 'Adaga Inutil [C]', rar: 'basico', dica: 'Adaga Inutil (basico)' },
        { base: '4002', qual: 'C', nome: 'Couraca Epica [C]', rar: 'epico', dica: 'Couraca Epica (epico)' },
        { base: '4001', qual: 'C', nome: 'Refugo Epico [C]', rar: 'epico', dica: 'Refugo Epico (epico)' },
        { base: '9500', qual: 'S', nome: 'Lendario Fraco [S]', rar: 'lendario', dica: 'Lendario Fraco (lendario)' },
      ]);
      montarLojista(m, [
        { id: '1005~C', dica: 'Adaga Inutil (basico)' },
        { id: '4002~C', dica: 'Couraca Epica (epico)' },
        { id: '4001~C', dica: 'Refugo Epico (epico)' },
      ]);
      const r = await auto.venderLixoDoCofre();
      const clicks = m.estado.clicks;
      t.check('C14: venderLixoDoCofre correu', r.ok === true);
      t.check('C14: vendidos = [1005, 4001, 4002] (exactamente os 3 lixos, ordem numerica de Object.keys)',
        Array.isArray(r.vendidos) && r.vendidos.length === 3 && r.vendidos.join(',') === '1005,4001,4002');
      t.check('C14: clicou nos 3 slots de lixo',
        clicks.indexOf('cofre-slot:1005~C') >= 0 && clicks.indexOf('cofre-slot:4002~C') >= 0 && clicks.indexOf('cofre-slot:4001~C') >= 0);
      t.check('C14: o LENDARIO (9500) NUNCA foi clicado', clicks.indexOf('cofre-slot:9500~S') < 0);
      const mo = m.estado.montados.get('#mochila')[0];
      t.check('C14: a mochila cresceu 3', mo.children.length === 3);
      const cofreFinal = m.estado.montados.get('.cofre-slot[data-k]') || [];
      t.check('C14: o cofre ficou so com o lendario (re-render com k actual)',
        cofreFinal.length === 1 && cofreFinal[0].dataset.k === '0' && cofreFinal[0].dataset.nome === 'Lendario Fraco [S]');
      const ev = (auto.getFarm().log || []).find((e) => e.type === 'cofre' && e.acao === 'vender-lixo');
      t.check('C14: logEvent cofre/vender-lixo com 3 vendidos', !!ev && ev.vendidos.join(',') === '1005,4001,4002');
    }

    /* ============ C14a — DOM filtrado por acao: mochila e cofre com o MESMO data-k ======== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarLocal(m, 'Fonte');
      montarMochila(m, []);
      // A mochila (guardar) e o cofre (retirar) usam a MESMA classe .cofre-slot e o MESMO
      // data-k (jogo.js:5627/5634). O sacarSlotDoCofre tem de clicar no do COFRE, nunca no
      // da mochila — sem o filtro de acao no find do DOM, o primeiro k=0 (mochila) ganha.
      montarNpcTroca(m,
        [{ base: '1001', qual: 'C', nome: 'Espada Longa [C]', rar: 'basico', dica: 'Espada Longa (basico)' }],
        [{ base: '1005', qual: 'C', nome: 'Adaga Inutil [C]', rar: 'basico', dica: 'Adaga Inutil (basico)' }]);
      const r = await auto.sacarSlotDoCofre({ base: '1005', qual: 'C', refino: 0 });
      const clicks = m.estado.clicks;
      t.check('C14a: sacarSlotDoCofre correu', r.ok === true);
      t.check('C14a: clicou no slot do COFRE (retirar)', clicks.indexOf('troca-cofre:1005~C+0') >= 0);
      t.check('C14a: NUNCA clicou no slot da mochila (guardar)', clicks.indexOf('troca-mochila:1001~C') < 0);
      t.check('C14a: o item entrou na mochila', m.estado.montados.get('#mochila')[0].children.length === 1);
    }

    /* ============ C14b — sem wildcard de refino: o +0 e lixo, o +2 fica ================== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarLocal(m, 'Fonte');
      montarMochila(m, []);
      // cofre com 1005+2 (melhor copia, PROTEGIDA) e 1005+0 (lixo). O alvo e o +0. Com o
      // wildcard (refino===0 aceita qualquer refino), o find apanhava o +2 primeiro.
      montarNpcTroca(m, [], [
        { base: '1005', qual: 'C', refino: 2, nome: 'Adaga Inutil +2 [C]', rar: 'basico', dica: 'Adaga Inutil +2 (basico)' },
        { base: '1005', qual: 'C', refino: 0, nome: 'Adaga Inutil [C]', rar: 'basico', dica: 'Adaga Inutil (basico)' },
      ]);
      const r = await auto.sacarSlotDoCofre({ base: '1005', qual: 'C', refino: 0 });
      const clicks = m.estado.clicks;
      t.check('C14b: sacarSlotDoCofre correu', r.ok === true);
      t.check('C14b: clicou no +0 (o lixo)', clicks.indexOf('troca-cofre:1005~C+0') >= 0);
      t.check('C14b: NUNCA clicou no +2 (a melhor copia protegida)', clicks.indexOf('troca-cofre:1005~C+2') < 0);
      t.check('C14b: o +2 ficou no cofre', (auto.lerCofreSlots() || []).some((s) => String(s.base) === '1005' && (s.refino || 0) === 2));
    }

    /* ============ C16 - POSICAO REAL DO MOTOR: clica no TILE da Tesoureira ============== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      const tela = montarTela(m, 480, 352);            // 1 tile = 32 px de CSS
      // Estado vivo como o inject.js publica: boneco em (10,10), camera centrada
      // (7 tiles a esquerda, 5 acima) e a Tesoureira em (13,11).
      m.dispatchMessage({ __lolidleAuto: 'estado', pos: { x: 10, y: 10 }, cam: { x: 96, y: 160 },
        npcs: [{ nome: 'Tesoureira de Piltover', x: 13, y: 11 }] });
      const original = tela.dispatchEvent;
      tela.dispatchEvent = (ev) => {
        original(ev);
        // (13,5 - 3,5) * 32 = 336 ; (11,5 - 5) * 32 = 208
        if (ev.type === 'mousedown' && ev.button === 2 && ev.clientX === 336 && ev.clientY === 208) abrirDialogoNpc(m, 'Tesoureira de Piltover');
        return true;
      };
      const r = await auto.abrirCofreTesoureira();
      const evs = m.eventosDe('tela');
      t.check('C16: com posicao real o cofre abre pela Tesoureira', r.ok === true && r.via === 'Tesoureira de Piltover');
      t.check('C16: NAO faz a subida cega de 8 tiles (subiu === 0)', r.subiu === 0);
      t.check('C16: clicou no tile REAL (336,208), nao a metade do caminho', evs.some((e) => e.clientX === 336 && e.clientY === 208));
      t.check('C16: nenhum clique na subida antiga (y = 48)', evs.every((e) => e.clientY !== 48));
    }

    /* ============ C17 - CONFIRMACAO (compra/venda) NUNCA e aceite pelo cofre ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      const tela = montarTela(m, 480, 352);
      const ok = m.el({ tag: 'button', label: 'dialogo-ok', className: 'dialogo-ok' });
      const cancel = m.el({ tag: 'button', label: 'dialogo-cancelar', className: 'dialogo-cancelar' });
      ok.click = () => { m.estado.clicks.push('ok-perigoso'); return true; };
      cancel.click = () => { m.estado.clicks.push('cancelou'); return true; };
      m.montar('.dialogo-fundo .dialogo-ok', [ok]);
      m.montar('.dialogo-fundo .dialogo-cancelar', [cancel]);
      m.dispatchMessage({ __lolidleAuto: 'estado', pos: { x: 10, y: 10 }, cam: { x: 96, y: 160 },
        npcs: [{ nome: 'Tesoureira de Piltover', x: 13, y: 11 }] });
      const original = tela.dispatchEvent;
      tela.dispatchEvent = (ev) => {
        original(ev);
        if (ev.type === 'mousedown' && ev.button === 2 && ev.clientX === 336 && ev.clientY === 208) abrirDialogoNpc(m, 'Tesoureira de Piltover');
        return true;
      };
      const r = await auto.abrirCofreTesoureira();
      t.check('C17: o cofre ainda abre depois de cancelar a confirmacao', r.ok === true);
      t.check('C17: clicou CANCELAR na confirmacao pendente', m.cliqueDe('cancelou') === true);
      t.check('C17: NUNCA clicou no OK da confirmacao (nao compra/vende sozinho)', m.cliqueDe('ok-perigoso') === false);
    }

    /* ============ C18 - JANELA ESCONDIDA NAO CONTA COMO COFRE ABERTO ================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarLocal(m, 'Fonte');
      const tela = montarTela(m, 480, 352);
      // O jogo esconde #janela-npc ao fechar mas deixa os slots no DOM (medido ao vivo).
      m.montar('#janela-npc', [m.el({ tag: 'section', label: 'janela-npc', className: 'janela', hidden: true })]);
      const slot = m.el({ tag: 'div', label: 'slot-fantasma', className: 'cofre-slot', dataset: { k: '0' } });
      m.montar('.cofre-slot[data-k]', [slot]);
      m.dispatchMessage({ __lolidleAuto: 'estado', pos: { x: 10, y: 10 }, cam: { x: 96, y: 160 },
        npcs: [{ nome: 'Tesoureira de Piltover', x: 13, y: 11 }] });
      const original = tela.dispatchEvent;
      tela.dispatchEvent = (ev) => {
        original(ev);
        if (ev.type === 'mousedown' && ev.button === 2 && ev.clientX === 336 && ev.clientY === 208) abrirDialogoNpc(m, 'Tesoureira de Piltover');
        return true;
      };
      const r = await auto.abrirCofreTesoureira();
      t.check('C18: janela escondida NAO e \"ja aberto\"', r.ok === true && r.ja !== true);
      t.check('C18: abriu pela Tesoureira com posicao real', r.via === 'Tesoureira de Piltover');
    }

    /* ============ C15 - SAQUE NAO CONFIRMADO: mochila cheia / servidor recusou ========== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      montarLocal(m, 'Fonte');
      m.montar('#equip > button.slot[data-id]', [
        m.el({ tag: 'button', label: 'equip:2007', className: 'slot lendario', attrs: { 'data-id': '2007~S', 'data-dica': 'Botas AD (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2001', className: 'slot lendario', attrs: { 'data-id': '2001~S', 'data-dica': 'Lendario AD 1 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2004', className: 'slot lendario', attrs: { 'data-id': '2004~S', 'data-dica': 'Lendario AD 2 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2005', className: 'slot lendario', attrs: { 'data-id': '2005~S', 'data-dica': 'Lendario AD 3 (lendario)' } }),
        m.el({ tag: 'button', label: 'equip:2006', className: 'slot lendario', attrs: { 'data-id': '2006~S', 'data-dica': 'Lendario AD 4 (lendario)' } }),
      ]);
      montarMochila(m, []);
      // semSaque: o clique NAO adiciona a mochila (mochila cheia / servidor recusou).
      montarGradeCofreMotor(m, [
        { base: '1005', qual: 'C', nome: 'Adaga Inutil [C]', rar: 'basico', dica: 'Adaga Inutil (basico)' },
      ], { semSaque: true });
      montarLojista(m, [{ id: '1005~C', dica: 'Adaga Inutil (basico)' }]);
      // o banco comeca em modo observacao (DEFAULT.enabled=false); liga o mestre como a GUI faria
      auto.setConfig({ enabled: true });
      const n1 = auto.necessidadesBase();
      t.check('C15: antes, n.venderLixoCofre e true (ha lixo, cadencia nao travada)', n1.venderLixoCofre === true);
      const r = await auto.venderLixoDoCofre();
      t.check('C15: vendidos vazios (nao confirmou o saque)', Array.isArray(r.vendidos) && r.vendidos.length === 0);
      t.check('C15: a mochila NAO cresceu', m.estado.montados.get('#mochila')[0].children.length === 0);
      t.check('C15: NAO registou venda', !(auto.getFarm().log || []).some((e) => e.type === 'cofre' && e.acao === 'vender-lixo'));
      const n2 = auto.necessidadesBase();
      t.check('C15: DEPOIS, n.venderLixoCofre continua true (cadencia NAO avancou)', n2.venderLixoCofre === true);
    }
  },
};
