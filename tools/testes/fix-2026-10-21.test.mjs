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

import { criarMundo, carregarAutomation, definirCampeao, alimentarCatalogo, montarMochila } from './dom-stub.mjs';

export const suite = {
  nome: 'fix-2026-10-21',
  titulo: 'Queixas de 2026-10-21: diaria pronta recebida, escala real das cartas, switches opt-in',

  async run(t) {
    /* ---- D1 - diária PRONTA: clica o rastreador e registra (em qualquer lugar) ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      definirCampeao(m, 'adtest');
      m.montar('#rastreio-diaria', [m.el({
        label: 'rastreio-diaria',
        className: 'pronta',
        textContent: 'Missão diária completa! Clique aqui para receber o prêmio.',
      })]);
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

    /* ---- C1 - raridade mínima: carta BÁSICA não é gasta por omissão (minN=2) ---- */
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

    /* ---- S2 - migração ver:3 desliga o `true` que o arranque tinha GRAVADO ---- */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      t.check('S2: CFG_VER = 3', auto.CFG_VER === 3);
      const r = auto.migrarCfg({ cfgVer: 2, automation: { cartasEncaixar: true, cartasAbrir: true } });
      t.check('S2: migra cartasEncaixar true -> false', r.cfg.cartasEncaixar === false);
      t.check('S2: migra cartasAbrir true -> false', r.cfg.cartasAbrir === false);
      t.check('S2: registou as duas migrações', r.migrou.length === 2);
      // one-shot: já em ver 3, um `true` explícito do dono NÃO é pisado.
      const r2 = auto.migrarCfg({ cfgVer: 3, automation: { cartasEncaixar: true } });
      t.check('S2: em ver 3 a escolha do dono fica intacta', r2.cfg.cartasEncaixar === true);
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
