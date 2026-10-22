/*
 * fix-2026-10-21.test.mjs - regressoes das queixas do dono de 2026-10-21.
 *
 * Cobre três contratos NOVOS (cada um nasceu de uma queixa verbatim):
 *
 *  1. DIÁRIA PRONTA -> RECEBIDA EM QUALQUER LUGAR (jogo.js:5480-5495, 6402-6405).
 *     "missao diaria completa e o boneco nao conclui. so conclui a missao padrao."
 *     A extensão só tocava nas diárias dentro do passo `tarefa`, e só quando NÃO havia tarefa
 *     pronta. Agora o tick (`checarDiaria`) clica o rastreador `.pronta` onde o boneco estiver.
 *
 *  2. CARTAS: escala REAL da raridade (motor `somaCartas`: 2/5/10%, não 1/2/3) e raridade mínima
 *     (`cfg.cartaMinRaridade` = 2). "meu boneco ta colocando carta no rabadon, sendo que eu nao
 *     mandei habilitar isso".
 *
 *  3. SWITCHES DE CARTA passam a nascer DESLIGADOS + migração `ver: 3` para o que ficou gravado
 *     como `true` (o arranque persiste os defaults; sem migração o dono continuaria a ver o
 *     comportamento que não pediu).
 *
 * CONTRATO: t.check(rotulo, condicao) só passa com condicao === true.
 */

import { criarMundo, carregarAutomation, definirCampeao, alimentarCatalogo, alimentarMeta, montarMochila } from './dom-stub.mjs';
import { readFileSync } from 'node:fs';

export const suite = {
  nome: 'fix-2026-10-21',
  titulo: 'Queixas de 2026-10-21: diaria pronta recebida, escala real das cartas, switches opt-in',

  async run(t) {
    /* ---- D1 - diária PRONTA: clica o rastreador e registra (em qualquer lugar) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      definirCampeao(m, 'adtest');
      const d1 = m.el({
        label: 'rastreio-diaria',
        className: 'pronta',
        textContent: 'Missão diária completa! Clique aqui para receber o prêmio.',
      });
      // Simula o SERVIDOR: no jogo, `receberDiaria` põe `estado.diaria = null` e `atualizarUI`
      // esconde o rastreador (jogo.js:7148). Sem esta confirmação o teste antigo dava "recebeu"
      // mesmo quando o servidor recusava.
      const clickOriginal = d1.click;
      d1.click = () => { clickOriginal(); d1.hidden = true; d1.classList.remove('pronta'); };
      m.montar('#rastreio-diaria', [d1]);
      const antes = auto.diariaEstado();
      t.check('D1: diariaEstado le a diaria de Runeterra visivel+pronta',
        antes.length === 1 && antes[0].tipo === 'runeterra' && antes[0].pronta === true);
      const r = await auto.receberDiariasProntas();
      t.check('D1: recebeu a diaria pronta', r.ok === true && r.recebeu.indexOf('runeterra') >= 0);
      t.check('D1: o clique foi no PROPRIO rastreador (jogo.js:6402)', m.cliqueDe('rastreio-diaria') === true);
      const logs = auto.getFarm().log || [];
      t.check('D1: ficou registado no historico (type diaria)',
        logs.some((l) => l.type === 'diaria' && Array.isArray(l.recebeu) && l.recebeu.indexOf('runeterra') >= 0));
    }

    /* ---- D2 - diária a MEIO: não clica (o clique no rastreador NAVEGA, não recebe) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      m.montar('#rastreio-diaria-rift', [m.el({
        label: 'rastreio-diaria-rift', className: '', textContent: 'Missão diária: 300/1000',
      })]);
      t.check('D2: diariaEstado ve a diaria do Rift a meio', auto.diariaEstado().some((d) => d.tipo === 'rift' && !d.pronta));
      const r = await auto.receberDiariasProntas();
      t.check('D2: nada recebido', r.recebeu.length === 0);
      t.check('D2: o rastreador NAO foi clicado', m.cliqueDe('rastreio-diaria-rift') === false);
    }

    /* ---- D3 - progresso da diária é LIDO do rastreador (com separador de milhar) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      m.montar('#rastreio-diaria-rift', [m.el({
        label: 'rastreio-diaria-rift', className: '', textContent: 'Diária do Rift 1.234/1.000 · do seu nível',
      })]);
      const d = auto.diariaEstado().find((x) => x.tipo === 'rift');
      t.check('D3: lê feitos/qtd e resta do texto do jogo', !!d && d.feitos === 1234 && d.qtd === 1000 && d.resta === 0);
      const p = auto.parseQtdDiaria('300/1000');
      t.check('D3: parseQtdDiaria lê 300/1000', p.feitos === 300 && p.qtd === 1000);
    }

    /* ---- D4 - só a diária do RIFT é aceita; a de Runeterra é MANUAL ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('D4: aceita a diária do Rift', auto.diariaAceitavel('rift') === true);
      t.check('D4: NÃO aceita a diária manual de Runeterra', auto.diariaAceitavel('runeterra') === false);
    }

    /* ---- D5 - vale a pena? Runeterra nunca; Rift conta onde está = custo zero ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('D5: Runeterra é manual -> não vale a pena para o bot',
        auto.diariaValeAPena({ tipo: 'runeterra', manual: true }).vale === false);
      t.check('D5: Rift onde os monstros contam -> progresso grátis',
        auto.diariaValeAPena({ tipo: 'rift' }, { conta: true }).vale === true);
      t.check('D5: Rift pronto -> só receber, não "completar"',
        auto.diariaValeAPena({ tipo: 'rift', pronta: true }).vale === false);
    }

    /* ---- D6 - o monstro conta para a diária? nível mínimo do local >= nível-5 ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      const alto = { faixa: [40, 50], nm: [40, 50] };
      const baixo = { faixa: [1, 10], nm: [1, 10] };
      t.check('D6: nível 44 num local 40-50 conta', auto.diariaContaLocal(alto, 44) === true);
      t.check('D6: nível 46 no MESMO local já não conta (mínimo 40 < 41)', auto.diariaContaLocal(alto, 46) === false);
      t.check('D6: local 1-10 não conta para nível 40', auto.diariaContaLocal(baixo, 40) === false);
      t.check('D6: arena nunca conta', auto.diariaContaLocal({ faixa: [1, 99], nm: [1, 99], arena: true }, 40) === false);
    }

    /* ---- D7 - servidor recusou (mochila cheia): NÃO diz "recebeu" e deixa .pronta ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      m.montar('#rastreio-diaria-rift', [m.el({
        label: 'rastreio-diaria-rift', className: 'pronta', textContent: 'Missão diária completa!',
      })]);
      const r = await auto.receberDiariasProntas();
      t.check('D7: não confirmou -> ok=false e falha registada',
        r.ok === false && r.falhas.indexOf('rift') >= 0 && r.recebeu.length === 0);
      t.check('D7: não regista "recebeu" quando o rastreador continua .pronta',
        (auto.getFarm().log || []).every((l) => !(l.type === 'diaria' && Array.isArray(l.recebeu) && l.recebeu.length && l.recebeu.indexOf('rift') >= 0)));
    }


    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      definirCampeao(m, 'aptest');
      t.check('C1: default cartaMinRaridade = 2 (rara)',
        auto.melhorCartaDisponivel([{ id: 'poder1', n: 1, qtd: 9 }], 2) === null);
      const r = auto.melhorCartaDisponivel([{ id: 'poder1', n: 1, qtd: 9 }, { id: 'poder2', n: 2, qtd: 1 }], 2);
      t.check('C1: com minN=2 escolhe a RARA e ignora a básica', r && r.id === 'poder2');
    }

    /* ---- C2 - escala REAL: uma lendária vale 10%, uma básica 2% (5x, não 3x) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      definirCampeao(m, 'aptest');
      // Um tipo conhecido e com peso > 0 é preciso para a comparação. `poder` só pesa se o
      // campeão escala com AP (aptest, magia:true) — e `player()` do stub é todo zero, logo o
      // peso é 0 e a ordenação fica empatada. O que se prova aqui é a CONSTANTE da raridade,
      // lida do próprio objecto exportado (nada copiado no teste).
      const P = auto.PCT_CARTA;
      t.check('C2: PCT_CARTA básica = 2%', P[1] === 0.02);
      t.check('C2: PCT_CARTA rara = 5%', P[2] === 0.05);
      t.check('C2: PCT_CARTA lendária = 10% (5x a básica, não 3x)', P[3] === 0.10 && P[3] / P[1] === 5);
    }

    /* ---- C3 - sem build conhecida NÃO se gasta carta (item seria trocado) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      // sem campeão/build: a lista de alvos tem de ser vazia (não "todos os itens").
      t.check('C3: sem build, itensParaCarta() = [] (não gasta carta em item descartável)',
        Array.isArray(auto.itensParaCarta()) && auto.itensParaCarta().length === 0);
    }

    /* ---- S1 - switches de carta nascem DESLIGADOS ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('S1: cartasEncaixar nasce desligado (o dono não pediu)', auto.getConfig().cartasEncaixar === false);
      t.check('S1: cartasAbrir nasce desligado', auto.getConfig().cartasAbrir === false);
      t.check('S1: cartaMinRaridade guardado = 2', auto.getConfig().cartaMinRaridade === 2);
    }

    /* ---- S2 - migrações: o `true` que o MESTRE gravava é limpo (ver 3 e ver 4) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('S2: CFG_VER = 4', auto.CFG_VER === 4);
      const r = auto.migrarCfg({ cfgVer: 2, automation: { cartasEncaixar: true, cartasAbrir: true } });
      t.check('S2: migra cartasEncaixar true -> false', r.cfg.cartasEncaixar === false);
      t.check('S2: migra cartasAbrir true -> false', r.cfg.cartasAbrir === false);
      // A ver 3 é o caso REAL do dono: o mestre gravou `true` DEPOIS da migração da ver 3 e o
      // cfgVer ficou em 3, por isso ela nunca voltava a correr. A ver 4 tem de limpar também.
      const r2 = auto.migrarCfg({ cfgVer: 3, automation: { cartasEncaixar: true, cartasAbrir: true } });
      t.check('S2: em ver 3 o true do mestre é limpo (a queixa do CDR no tier C)', r2.cfg.cartasEncaixar === false && r2.cfg.cartasAbrir === false);
      // one-shot: já em ver 4, um `true` explícito do dono NÃO é pisado.
      const r3 = auto.migrarCfg({ cfgVer: 4, automation: { cartasEncaixar: true } });
      t.check('S2: em ver 4 a escolha do dono fica intacta', r3.cfg.cartasEncaixar === true);
    }

    /* ---- S3 - o MESTRE nunca liga as cartas (defeito que pôs CDR num tier C) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      auto.setConfig({ cartasEncaixar: false, cartasAbrir: false });
      auto.setConfig({ enabled: true });                         // "liga tudo"
      t.check('S3: ligar o mestre NÃO liga cartasEncaixar', auto.getConfig().cartasEncaixar === false);
      t.check('S3: ligar o mestre NÃO liga cartasAbrir', auto.getConfig().cartasAbrir === false);
      t.check('S3: as cartas nem entram na lista do mestre', !auto.chavesSwitches(true).includes('cartasEncaixar'));
      auto.alternarTodosSwitches();                              // desliga tudo (guarda escolhas)
      auto.alternarTodosSwitches();                              // religa o que estava
      t.check('S3: "pausar/religar tudo" também não liga as cartas', auto.getConfig().cartasEncaixar === false);
      // e a deixa passar só quando o dono quer: `podeFazer` deixa de ser o gate, o cfg é que é.
      auto.setConfig({ cartasEncaixar: true });
      t.check('S3: com o dono a ligar, o switch fica ligado', auto.getConfig().cartasEncaixar === true);
    }

    /* ---- P1 - preço: factor EXACTO 0,90 (era 0,88–0,92 aleatório) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('P1: factor de anúncio = 0.90 fixo', auto.fatorAnuncio() === 0.90);
      t.check('P1: é reprodutível (10 chamadas iguais)',
        Array.from({ length: 10 }, () => auto.fatorAnuncio()).every((x) => x === 0.90));
    }

    /* ---- P2 - piso de compra: tier B não é comprado (ordem do dono) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('P2: compraMinTier = A por omissão', auto.getConfig().compraMinTier === 'A');
    }

    /* =====================================================================
     * ESPÓLIO (queixa: "quando recarrego, ele nao vende espolios na base")
     * O valor NÃO é copiado: lê-se do `title` que o jogo desenha
     * (jogo.js:6470-6472). O `n.vender` passa a conhecer o espólio; uma
     * viagem SÓ por espólio continua proibida sem pressão de espaço.
     * ===================================================================== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // `vender` pende de `irBase` -> `manutencao` -> mestre `enabled` (TK-01, ver w10 V1).
      auto.setConfig({ enabled: true });
      m.montar('#local-nome', [m.el({ tag: 'span', label: 'local', textContent: 'Fonte' })]);
      montarMochila(m, [{
        id: 'esp:escudo-quebrado:37', raridade: '',
        title: 'Escudo Quebrado ×37\nEspólio: o Lojista compra por 40 de ouro cada (1480 esta pilha).\nEmpilha até 1000 por espaço.',
      }], 30);

      const bag = auto.scanBag(true);
      const esp = bag.items.find((i) => i.kind === 'espolio');
      t.check('E1: valor unitário lido do título do jogo', !!esp && esp.valorUn === 40);
      t.check('E1: valor da pilha lido do título', !!esp && esp.valor === 1480);
      t.check('E1: quantidade lida da chave do slot', !!esp && esp.qty === 37);

      const n = auto.necessidadesBase();
      t.check('E1: com espólio na Fonte, vender é necessidade', n.vender === true);
      t.check('E1: o motivo registado é espolio', !!n._venda && n._venda.motivo === 'espolio');
      t.check('E1: valorEspolio exposto ao painel/decisão', !!n._venda && n._venda.valorEspolio === 1480);
      t.check('E1: espólio SOZINHO não paga viagem de campo',
        auto.motivosDeViagem(['vender'], n).length === 0);

      // Longe da Fonte e sem itens: o espólio NÃO vira necessidade (nem dispara viagem).
      m.montar('#local-nome', [m.el({ tag: 'span', label: 'local', textContent: 'Rio nível 25–35' })]);
      const n2 = auto.necessidadesBase();
      t.check('E2: longe da base e sem itens, espólio não vira necessidade', n2.vender === false);
    }

    /* ---- E3 - a conta do dono: valor do lote vs custo da viagem ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      const caro = { _venda: { itens: 6, valor: 1000, valorEspolio: 0, mochilaQuaseCheia: false }, _custoIda: { ouro: 2000 } };
      const paga = { _venda: { itens: 6, valor: 5000, valorEspolio: 0, mochilaQuaseCheia: false }, _custoIda: { ouro: 2000 } };
      t.check('E3: 6 básicos que não cobrem a viagem NÃO pagam ida',
        auto.motivosDeViagem(['vender'], caro, { venderMinItens: 6 }).length === 0);
      t.check('E3: 6 itens que cobrem o custo PAGAM a ida',
        auto.motivosDeViagem(['vender'], paga, { venderMinItens: 6 }).indexOf('vender') >= 0);
      t.check('E3: mochila quase cheia paga a ida mesmo com valor baixo',
        auto.motivosDeViagem(['vender'], { _venda: { itens: 1, valor: 10, mochilaQuaseCheia: true } }, { venderMinItens: 6 }).indexOf('vender') >= 0);
      t.check('E3: sem custo medido mantém a regra antiga (não inventa bloqueio)',
        auto.motivosDeViagem(['vender'], { _venda: { itens: 6, valor: 1, mochilaQuaseCheia: false } }, { venderMinItens: 6 }).indexOf('vender') >= 0);
    }

    /* =====================================================================
     * BÁSICOS DA BUILD (queixa: "conta level 1, vender basico a rodo
     * seria imbecil; no minimo tem que garantir os itens pro personagem")
     * Com a build INCOMPLETA, as folhas da receita ficam guardadas mesmo
     * com a montagem desligada. O excedente acima do tecto continua a sair.
     * ===================================================================== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      auto.setConfig({ autoMontar: false, autoComprar: false });

      montarMochila(m, [{ id: '1001~C', raridade: 'basico' }], 30);
      const bag = auto.scanBag(true);
      t.check('B1: build incompleta sem equipamento', auto.buildIncompleta(bag) === true);
      const acts = auto.planBag(bag).acts;
      const a = acts.find((x) => x.it.id === '1001~C');
      t.check('B1: básico da receita PROTEGIDO com montagem desligada', !!a && a.action === 'PROTEGER');

      // 1005 não serve a build: continua a ir ao Lojista (não se travou o Lojista).
      const acts2 = auto.planBag((montarMochila(m, [{ id: '1005~C', raridade: 'basico' }], 30), auto.scanBag(true))).acts;
      t.check('B2: básico que NÃO serve a build continua a ser vendido',
        acts2.some((x) => x.it.id === '1005~C' && x.action === 'VENDER_LOJISTA'));

      // Excedente: a receita guarda até ao tecto; o resto vai ao Lojista.
      const muitos = Array.from({ length: 9 }, () => ({ id: '1001~C', raridade: 'basico' }));
      const acts3 = auto.planBag((montarMochila(m, muitos, 30), auto.scanBag(true))).acts;
      const prot = acts3.filter((x) => x.it.id === '1001~C' && x.action === 'PROTEGER').length;
      const vend = acts3.filter((x) => x.it.id === '1001~C' && x.action === 'VENDER_LOJISTA').length;
      t.check('B3: guarda o tecto da receita e vende o excedente', prot > 0 && vend > 0);
    }

    /* =====================================================================
     * COFRE A SÉRIO (queixa: "inventario sempre quase cheio, cofre metade e
     * não é usado"). Com pressão de espaço, os EXCEDENTES protegidos vão para
     * o cofre; em transbordo, até a cópia única de um item que não é da fase.
     * ===================================================================== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest', { nivel: 30 });
      auto.setConfig({ enabled: true });          // `cofre` pende de irBase/manutencao
      // 9500 = "Lendario Fraco" do catálogo: NUNCA entra em build nenhuma.
      const slots = [];
      for (let i = 0; i < 28; i++) slots.push({ id: '1005~C', raridade: 'basico' });
      slots.push({ id: '9500~A', raridade: 'lendario' }, { id: '9500~A', raridade: 'lendario' });
      montarMochila(m, slots, 30);
      const acts = auto.planBag(auto.scanBag(true)).acts;
      const do9500 = acts.filter((a) => String(a.it.id).startsWith('9500'));
      // ORDEM NOVA (dono, 2026-10-22, verbatim): "garanta que items, quando pertos de encher,
      // que sao lendarios, todos os A vao para o cofre." -> com a mochila em pressão (30/30),
      // TODAS as cópias lendário-A vão ao COFRE — inclusive a que o plano ia anunciar. Esta
      // regra SUBSTITUI, sob pressão, o "A em excesso → mercado" de 2026-10-21 (que continua
      // a valer quando a mochila tem folga; ver M1/M2 nesta mesma suite).
      t.check('K1: mochila perto de encher -> TODAS as cópias lendário A vão ao COFRE',
        do9500.length === 2 && do9500.every((a) => a.action === 'GUARDAR_COFRE'));
      t.check('K1: perto de encher o COFRE ganha ao anúncio (nenhum lendário A vai ao mercado)',
        do9500.every((a) => a.action !== 'ANUNCIAR_MERCADO'));
      t.check('K1: o motivo diz que é a ordem do dono (cofre), não um acidente',
        do9500.every((a) => /cofre/i.test(String(a.why))));

      // K1b: o cofre continua a apanhar o excedente de itens PROTEGIDOS que NÃO são A
      // (aqui S: A já tem a via do mercado; S+ é intocável para venda).
      const mS = criarMundo();
      const autoS = carregarAutomation(mS);
      alimentarCatalogo(mS);
      definirCampeao(mS, 'adtest', { nivel: 30 });
      autoS.setConfig({ enabled: true });
      const sS = [];
      for (let i = 0; i < 28; i++) sS.push({ id: '1005~C', raridade: 'basico' });
      sS.push({ id: '9500~S', raridade: 'lendario' }, { id: '9500~S', raridade: 'lendario' });
      montarMochila(mS, sS, 30);
      const doS = autoS.planBag(autoS.scanBag(true)).acts.filter((a) => String(a.it.id).startsWith('9500'));
      t.check('K1b: excedente de S (não-A) vai para o COFRE', doS.filter((a) => a.action === 'GUARDAR_COFRE').length === 1);

      // TRANSBORDO: 30 itens numa mochila de 29. A cópia ÚNICA (que não é da fase) vai ao cofre.
      const m2 = criarMundo();
      const auto2 = carregarAutomation(m2);
      alimentarCatalogo(m2);
      definirCampeao(m2, 'adtest', { nivel: 30 });
      auto2.setConfig({ enabled: true });
      const slots2 = [];
      for (let i = 0; i < 29; i++) slots2.push({ id: '1005~C', raridade: 'basico' });
      slots2.push({ id: '9500~A', raridade: 'lendario' });
      montarMochila(m2, slots2, 29);
      const a2 = auto2.planBag(auto2.scanBag(true)).acts;
      t.check('K2: transbordo guarda no cofre (não vende) o item único fora da fase',
        a2.some((a) => String(a.it.id).startsWith('9500') && a.action === 'GUARDAR_COFRE'));
    }

    /* =====================================================================
     * A EM EXCESSO -> MERCADO (ordem do dono, 2026-10-21): "quando tem muita
     * copia A, ou muito A enchendo, anuncia A no mercado. os menos desejaveis
     * pra minha classe". O ranking de desejo é `valorDeFase` da CLASSE DO
     * CAMPEÃO CARREGADO — nunca uma lista do dono.
     * ===================================================================== */
    {
      // M1: duas cópias A do mesmo base -> a pior vai ao mercado, fica 1. Mochila COM FOLGA
      // (5/30): é o regime em que a regra de mercado de 2026-10-21 vale. Sob pressão o cofre
      // ganha (ordem do dono de 2026-10-22, provada em K1) — as duas regras convivem por regime.
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest', { nivel: 30 });
      auto.setConfig({ enabled: true });
      const slots = [];
      for (let i = 0; i < 3; i++) slots.push({ id: '1005~C', raridade: 'basico' });
      slots.push({ id: '3153~A', raridade: 'lendario' }, { id: '3153~A', raridade: 'lendario' });
      montarMochila(m, slots, 30);
      const acts = auto.planBag(auto.scanBag(true)).acts;
      const doA = acts.filter((a) => String(a.it.id) === '3153~A');
      t.check('M1: duplicata A -> 1 fica e 1 vai ao MERCADO (nunca ao Lojista)',
        doA.filter((a) => a.action === 'ANUNCIAR_MERCADO').length === 1 &&
        doA.every((a) => a.action !== 'VENDER_LOJISTA'));

      // M2: mochila cheia de A de classes diferentes -> o PIOR para o campeão (AP no adtest)
      // vai ao mercado; o melhor (AD) fica. Usa ÉPICOS A de propósito: o LENDÁRIO A sob pressão
      // passou a ir ao COFRE (ordem do dono de 2026-10-22, provada em K1) — a regra "o menos
      // desejável para a classe sai primeiro" continua a ser a mesma, só muda o destino por
      // raridade. 2002 = épico AD; 2003 = épico AP.
      const m2 = criarMundo();
      const auto2 = carregarAutomation(m2);
      alimentarCatalogo(m2);
      definirCampeao(m2, 'adtest', { nivel: 30 });
      auto2.setConfig({ enabled: true });
      const s2 = [];
      for (let i = 0; i < 28; i++) s2.push({ id: '1005~C', raridade: 'basico' });
      s2.push({ id: '2003~A', raridade: 'epico' });   // AP: pouco desejável p/ AD
      s2.push({ id: '2002~A', raridade: 'epico' });   // AD: desejável
      montarMochila(m2, s2, 30);
      const a2 = auto2.planBag(auto2.scanBag(true)).acts;
      const ap = a2.find((a) => String(a.it.id) === '2003~A');
      const ad = a2.find((a) => String(a.it.id) === '2002~A');
      t.check('M2: com A enchendo, o MENOS desejável para a classe vai ao mercado',
        !!ap && ap.action === 'ANUNCIAR_MERCADO');
      t.check('M2: o mais desejável da classe NÃO é anunciado só para fazer número',
        !!ad && ad.action !== 'ANUNCIAR_MERCADO');
    }

    /* =====================================================================
     * REGIÕES NOVAS + MUNDOS: o ranking só pode ter CAÇA NO RIFT. As zonas do
     * Freljord (`mundo:'freljord'`), a arena `fj` e a Fonte não têm marcador no
     * mapa do Rift (mapa.js:59) — entram no META mas ficam fora das contas.
     * ===================================================================== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarMeta(m, { locais: [
        { id: 'rota-inf', nome: 'Rota Inferior', faixa: [1, 10], nm: [1, 6], tier: 0, monstros: [['X', 1]] },
        { id: 'anciao', nome: 'Covil do Dragão Ancião', faixa: [50, 75], nm: [50, 68], tier: 8, monstros: [['X', 1]] },
        { id: 'fj-tundra', nome: 'Tundra Uivante', faixa: [50, 60], nm: [50, 58], tier: 8, mundo: 'freljord', monstros: [['X', 1]] },
        { id: 'fj', nome: 'Freljord', arena: true, mundo: 'freljord', monstros: [['X', 1]] },
        { id: 'fonte', nome: 'Fonte', base: true, monstros: [['X', 1]] },
      ] });
      const r = auto.rankRegioes('xp');
      t.check('R1: região NOVA do Rift (anciao) entra no ranking', r.some((x) => x.id === 'anciao'));
      t.check('R2: zona do Freljord (outro mundo) fica FORA do ranking', !r.some((x) => x.id === 'fj-tundra'));
      t.check('R3: arena (fj) e Fonte ficam FORA do ranking', !r.some((x) => x.id === 'fj') && !r.some((x) => x.id === 'fonte'));
      t.check('R4: fail-closed — região sem faixa não é região de farm', auto.ehRegiaoDeFarm({ id: 'x', nome: 'X' }) === false);
      const src = readFileSync(new URL('../../extension/inject.js', import.meta.url), 'utf8');
      t.check('R5: inject.js manda LOCAIS + LOCAIS_FRELJORD (as zonas novas chegam ao META)',
        /M\.LOCAIS_FRELJORD/.test(src) && /locais\.push/.test(src));
    }

    /* =====================================================================
     * CARTAS: opt-in ESTRITO. Sem `=== true` não se abre, não se encaixa,
     * não se selecciona nada. Uma chave ausente já não conta como ligada.
     * ===================================================================== */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      auto.setConfig({ cartasEncaixar: false, cartasAbrir: false });
      const a = await auto.encaixarCartas();
      const b = await auto.abrirCartasMisteriosas();
      t.check('C1: encaixar recusa com opt-in desligado', a.ok === false && /opt-in/.test(String(a.motivo)));
      t.check('C1: abrir recusa com opt-in desligado', b.ok === false && /opt-in/.test(String(b.motivo)));
      t.check('C1: nada foi clicado no Ornn/cartas', m.cliqueDe('carta-abrir') === false && m.cliqueDe('carta-encaixar') === false);
    }
  },
};
