/*
 * w10.test.mjs - W10: CONFIG GUARDADA, PRECOS, LOJISTA, REPETICAO DE ITEM BASE E FARM POR ITEM.
 *
 * Cobre os tickets da fila W10 (docs/tickets/fila-W10.md) e a directiva do Lead de 22:01 sobre
 * os numeros do ecra. Cada assercao corre contra o extension/automation.js REAL num vm com DOM
 * stubado; as mochilas sao montadas no DOM e lidas por scanBag() REAL (cadeia ponta a ponta).
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import {
  criarMundo, carregarAutomation, CATALOGO, alimentarCatalogo, alimentarMeta, definirCampeao,
  montarMochila, montarLojista, saturarMercado,
} from './dom-stub.mjs';

const STORAGE_KEY = 'lolidleAutoPotion';

function novoMundo(opts) {
  const m = criarMundo(opts);
  const auto = carregarAutomation(m);
  return { m: m, auto: auto };
}
function slot(id, raridade, dica) { return { id: id, raridade: raridade, dica: dica || '' }; }
function mochila(m, auto, slots) { montarMochila(m, slots); return auto.scanBag(true); }
function acaoDe(acts, id) { const a = acts.filter((x) => x.it.id === id)[0]; return a ? a.action : '(sem acao)'; }
function eVendido(acts, id) { return acts.some((a) => a.it.id === id && a.action === 'VENDER_LOJISTA'); }
function eAnunciado(acts, id) { return acts.some((a) => a.it.id === id && a.action === 'ANUNCIAR_MERCADO'); }
/** deixa as microtasks do stub (storage/timers) correrem */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** META minimo para o planejar (onde cada item dropa) funcionar. */
function metaComDrop(m, itemId, zonaId, opts) {
  opts = opts || {};
  const zona = {
    id: zonaId, nome: opts.nome || 'Zona do Teste', faixa: [10, 20], nm: [10, 20],
    monstros: [['Tropa Corpo a Corpo', 3]], chefe: opts.chefe ? ['Barao do Teste'] : null,
  };
  const monstros = { 'Tropa Corpo a Corpo': { hp: 1, ad: 0.9, as: 0.8, armadura: 0.6, xp: 1, ouro: 1 } };
  if (opts.chefe) monstros['Barao do Teste'] = { hp: 20, ad: 2, as: 0.6, armadura: 1.5, xp: 8, ouro: 8, chefe: true };
  alimentarMeta(m, {
    itens: CATALOGO, monstros: monstros, balanco: [{ de: 1, ate: 50, vida: 1, dano: 1, xp: 1, ouro: 1 }],
    locais: [{ id: zonaId, nome: zona.nome, faixa: zona.faixa, nm: zona.nm, monstros: zona.monstros, chefe: zona.chefe }],
    ondeItem: { [itemId]: { [zonaId]: { zona: zona, porClasse: { ad: 0.01, ap: 0.005 } } } },
  });
}

export const suite = {
  nome: 'w10',
  titulo: 'W10 - config guardada, precos, Lojista, repeticao de base e farm por item',

  async run(t) {

    /* ============ N1 - NUMEROS DO ECRA (directiva do Lead, 22:01) ============
     * O jogo escreve tudo pelo fmt (cena.js:225): '4188' - '12.3k' - '1.2M'. O parseNum antigo
     * apagava o sufixo e '12.3k' virava 123 (100x menos). */
    {
      const w = novoMundo();
      const n = w.auto.numEcra;
      t.check('N1: "12.3k" -> 12300 (antes 123)', n('12.3k') === 12300);
      t.check('N1: "1.2M" -> 1200000 (antes 12)', n('1.2M') === 1200000);
      t.check('N1: "4188" -> 4188 (inteiro nao muda)', n('4188') === 4188);
      t.check('N1: "4.188" -> 4188 (grupo de 3 casas = MILHAR)', n('4.188') === 4188);
      t.check('N1: "12,3k" -> 12300 (virgula decimal com sufixo)', n('12,3k') === 12300);
      t.check('N1: "9.876 / 12.3k" -> 12300 (o valor e o ULTIMO numero)', n('9.876 / 12.3k') === 12300);
      t.check('N1: "Vale 5625 de ouro no Lojista." -> 5625 (o ponto final nao engana)', n('Vale 5625 de ouro no Lojista.') === 5625);
      t.check('N1: vazio -> null (sem numero)', n('') === null);
      t.check('N1: "--" -> null', n('\u2014') === null);
      t.check('N1: parseNum("12.3k") = 12300 (o parser antigo dava 123)', w.auto.parseNum('12.3k') === 12300);
      t.check('N1: parseNum("4188") = 4188 (sem regressao nos inteiros)', w.auto.parseNum('4188') === 4188);
      t.check('N1: parseNum("") continua NaN (contrato antigo)', String(w.auto.parseNum('')) === 'NaN');
      t.check('N1: parseBig("4.188") = 4188 (antes dava 4)', w.auto.parseBig('4.188') === 4188);
      t.check('N1: parseBig("") continua null', w.auto.parseBig('') === null);
      t.check('N1: parseBig("a partir de 1.2k ouro") = 1200', w.auto.parseBig('a partir de 1.2k ouro') === 1200);
    }

    /* ============ N2 - OS MESMOS CASOS PELOS LEITORES REAIS (ponta a ponta) ============ */
    {
      const w = novoMundo();
      w.m.montar('#st-ouro', [w.m.el({ label: 'st-ouro', textContent: '12.3k' })]);
      t.check('N2: readGold() com "12.3k" = 12300 (antes 123)', w.auto.readGold() === 12300);
      w.m.montar('#st-ouro', [w.m.el({ label: 'st-ouro', textContent: '1.2M' })]);
      t.check('N2: readGold() com "1.2M" = 1200000', w.auto.readGold() === 1200000);
      w.m.montar('#st-ouro', [w.m.el({ label: 'st-ouro', textContent: '4188' })]);
      t.check('N2: readGold() com "4188" = 4188', w.auto.readGold() === 4188);

      w.m.montar('#hud-pocoes [data-pocao]', [
        w.m.el({ tag: 'button', label: 'pocao-vida', dataset: { pocao: 'vida' }, find: { b: [w.m.el({ tag: 'b', label: 'b', textContent: '12.3k' })] } }),
      ]);
      t.check('N2: readPotions() com "12.3k" = 12300 (antes 123)', w.auto.readPotions().vida === 12300);

      w.m.montar('#hud-vida-txt', [w.m.el({ label: 'hud-vida-txt', textContent: '12.3k / 20.4k' })]);
      t.check('N2: player().vida com "12.3k / 20.4k" = 20400 (antes caia no literal 4188)', w.auto.player().vida === 20400);
      t.check('N2: player().vidaCur = 12300 (o valor da esquerda)', w.auto.player().vidaCur === 12300);
      w.m.montar('#hud-vida-txt', [w.m.el({ label: 'hud-vida-txt', textContent: '9.876 / 12.3k' })]);
      t.check('N2: player().vida com "9.876 / 12.3k" = 12300 (antes 123)', w.auto.player().vida === 12300);
      w.m.montar('#hud-vida-txt', [w.m.el({ label: 'hud-vida-txt', textContent: '4188 / 5200 (+300)' })]);
      t.check('N2: com escudo "4188 / 5200 (+300)" a vida e 5200 (o escudo NAO e a vida maxima)', w.auto.player().vida === 5200);
      t.check('N2: ...e a vida actual e 4188', w.auto.player().vidaCur === 4188);
      w.m.montar('#hud-vida-txt', [w.m.el({ label: 'hud-vida-txt', textContent: '12.3k / 20.4k (+1.5k)' })]);
      t.check('N2: com escudo em k "12.3k / 20.4k (+1.5k)" a vida e 20400', w.auto.player().vida === 20400);
    }

    /* ============ N3 - O VALOR DO LOJISTA NO TOOLTIP (o caminho que decide o descarte) ============ */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const bag = mochila(w.m, w.auto, [
        slot('2001~C', 'lendario', 'Item Lendario. Vale 5.6k de ouro no Lojista.'),
        slot('2004~C', 'lendario', 'Item Lendario. Vale 5625 de ouro no Lojista.'),
      ]);
      const it = bag.items.filter((i) => i.base === '2001')[0];
      const it2 = bag.items.filter((i) => i.base === '2004')[0];
      t.check('N3: vendaLojista com sufixo "5.6k" = 5600 (antes 56)', it.vendaLojista === 5600);
      t.check('N3: vendaLojista inteiro "5625" = 5625 (sem regressao)', it2.vendaLojista === 5625);
    }

    /* ============ P1 - PRECO: qualidade/refino escalam (TK-02-78) ============
     * motor.js:266 valorVenda = floor(preco*0,5*(1+0,5*refino)*QUALIDADES[qual].venda)
     * motor.js:2921 valorEquip = preco*(1+0,12*refino)*QUALIDADES[qual].mult
     * A conta do print do dono (Impeto 3000 base, qualidade A, refino +3): 4692 e 5625. */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      t.check('P1: valorEquip(3000, A, +3) = 4692 (3000 x 1,36 x 1,15)', w.auto.valorEquip('2001', 'A', 3) === 4692);
      t.check('P1: valorVenda(3000, A, +3) = 5625 (3000 x 0,5 x 2,5 x 1,5 - os 5.625 do ecra)', w.auto.valorVenda('2001', 'A', 3) === 5625);
      t.check('P1: o preco BASE sozinho seria 3000 (o defeito antigo)', 3000 !== w.auto.valorEquip('2001', 'A', 3));
      t.check('P1: qualidade SS multiplica mais que A no equipamento', w.auto.valorEquip('2001', 'SS', 0) > w.auto.valorEquip('2001', 'A', 0));
      t.check('P1: refino sobe o valor de venda', w.auto.valorVenda('2001', 'B', 3) > w.auto.valorVenda('2001', 'B', 0));
      t.check('P1: qualidade pendente (?) vale 1 - motor.js:261 usa ?.mult || 1, NAO 0,9 do C', w.auto.valorEquip('2001', '?', 0) === 3000);
      t.check('P1: sem qualidade (ausente) vale 1 - o motor trata como B', w.auto.valorEquip('2001', undefined, 0) === 3000);
      t.check('P1: venda de (?) vale 1 tambem', w.auto.valorVenda('2001', '?', 0) === 1500);
      t.check('P1: item fora do catalogo devolve null (contrato antigo)', w.auto.valorEquip('999999', 'A', 0) === null);
    }

    /* ============ L1 - LOJISTA: lendario NUNCA, basico/epico SEMPRE (TK-02-85 / TK-02-86) ============
     * Palavra do dono: "lendarios sao desejados pelos jogadores, entao nunca se vende lendario pelo
     * lojista, so pelo mercado" + "basico, epico, duplicado: vende no lojista". */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');

      const bag = mochila(w.m, w.auto, [slot('9500~C', 'lendario'), slot('9500~B', 'lendario')]);
      const acts = w.auto.planBag(bag).acts;
      t.check('L1: lendario duplicado -> MERCADO (mercado vazio)', eAnunciado(acts, '9500~C') === true);
      t.check('L1: lendario duplicado NUNCA -> Lojista (mercado vazio)', eVendido(acts, '9500~C') === false);
      t.check('L1: lendario duplicado NUNCA -> Lojista (2.a copia)', eVendido(acts, '9500~B') === false);
      const actsEpi = w.auto.planBag(mochila(w.m, w.auto, [slot('4001~C', 'epico')])).acts;
      t.check('L1: epico inutil -> VENDER_LOJISTA', eVendido(actsEpi, '4001~C') === true);
      const actsBas = w.auto.planBag(mochila(w.m, w.auto, [slot('1005~C', 'basico')])).acts;
      t.check('L1: basico -> VENDER_LOJISTA', eVendido(actsBas, '1005~C') === true);
    }

    /* ============ L2 - mercado SATURADO: o lendario fica na mochila, nunca no Lojista ============ */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      await saturarMercado(w.auto, w.m);
      const bag = mochila(w.m, w.auto, [slot('9500~C', 'lendario'), slot('9500~B', 'lendario'), slot('4001~C', 'epico')]);
      const acts = w.auto.planBag(bag).acts;
      t.check('L2: CONTROLO - o epico continua a ir ao Lojista com o mercado saturado', eVendido(acts, '4001~C') === true);
      t.check('L2: lendario duplicado com mercado SATURADO -> PROTEGER (fica na mochila)', acaoDe(acts, '9500~C') === 'PROTEGER');
      t.check('L2: ...e NUNCA VENDER_LOJISTA', eVendido(acts, '9500~C') === false);
      t.check('L2: ...nem ANUNCIAR (nao ha lugar)', eAnunciado(acts, '9500~C') === false);
      t.check('L2: o motivo diz que o lendario nunca vai ao Lojista', /nunca vai ao Lojista/i.test(String((acts.filter((a) => a.it.id === '9500~C')[0] || {}).why || '')));
    }

    /* ============ L3 - 3031/3089 duplicado -> PROTEGIDO (controlo acima da regra) ============ */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const acts = w.auto.planBag(mochila(w.m, w.auto, [slot('3031~C', 'lendario'), slot('3031~B', 'lendario')])).acts;
      t.check('L3: CONTROLO - o 3031 e prioridade extrema no campeao AD', w.auto.ehPrioridadeExtrema('3031') === true);
      t.check('L3: 3031 duplicado -> PROTEGER (nem mercado, nem Lojista)', acaoDe(acts, '3031~C') === 'PROTEGER');
      t.check('L3: 3031 duplicado NUNCA -> Lojista', eVendido(acts, '3031~C') === false);
      t.check('L3: 3031 duplicado NUNCA -> mercado', eAnunciado(acts, '3031~C') === false);
      definirCampeao(w.m, 'aptest');
      const actsAp = w.auto.planBag(mochila(w.m, w.auto, [slot('3089~C', 'lendario'), slot('3089~B', 'lendario')])).acts;
      t.check('L3: 3089 (Rabadon) duplicado no AP -> PROTEGER', acaoDe(actsAp, '3089~C') === 'PROTEGER');
      t.check('L3: 3089 duplicado NUNCA -> Lojista', eVendido(actsAp, '3089~C') === false);
    }

    /* ============ L4 - o ACTOR do Lojista nunca clica num lendario (mercado saturado) ============ */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      await saturarMercado(w.auto, w.m);
      const slots = [
        { id: '9500~C', classe: 'lendario', dica: 'Item Lendario do teste' },
        { id: '4001~C', classe: 'epico', dica: 'Item Epico do teste' },
      ];
      montarMochila(w.m, slots.map((s) => ({ id: s.id, raridade: s.classe, dica: s.dica })));
      montarLojista(w.m, slots);
      const res = await w.auto.venderBase();
      const clicados = w.m.clicksDePrefixo('slot:');
      t.check('L4: CONTROLO - o epico foi clicado e vendido nesta execucao', clicados.indexOf('4001~C') >= 0);
      t.check('L4: o lendario NAO recebeu clique nenhum', clicados.indexOf('9500~C') < 0);
      t.check('L4: o lendario nao esta em epicosVendidos', res.epicosVendidos.indexOf('9500~C') < 0);
      t.check('L4: o lendario esta em regras.protegidos', res.protegidos.some((p) => p.id === '9500~C'));
    }

    /* ============ R1 - REPETICAO DE ITEM BASE (TK-02-65) ============
     * motor.js:2902/2909/2913-2914: so o LENDARIO repetido e proibido. */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const cmp = (a, b) => (b.ad || 0) - (a.ad || 0);
      const doisBasicos = [{ base: '1001', ad: 10 }, { base: '1001', ad: 10 }];
      const alvoB = w.auto.escolherConjunto(doisBasicos, cmp);
      t.check('R1: dois itens NAO-lendarios iguais PODEM ser escolhidos (o motor permite)', alvoB.length === 2);
      t.check('R1: ...e sao mesmo a mesma base', alvoB[0].base === '1001' && alvoB[1].base === '1001');

      const doisLendarios = [{ base: '2001', ad: 400 }, { base: '2001', ad: 400 }];
      const alvoL = w.auto.escolherConjunto(doisLendarios, cmp);
      t.check('R1: dois LENDARIOS iguais NAO podem (motor.js:2914 lendario unico)', alvoL.length === 1);

      const duasBotas = [{ base: '2007', va: 0.3 }, { base: '3005', va: 0.2 }];
      const alvoBotas = w.auto.escolherConjunto(duasBotas, (a, b) => (b.va || 0) - (a.va || 0));
      t.check('R1: continua a entrar so UMA bota (motor.js:2913)', alvoBotas.length === 1);
      t.check('R1: ...e e a melhor delas', alvoBotas[0].base === '2007');

      const misto = [{ base: '1001', ad: 10 }, { base: '1001', ad: 10 }, { base: '2001', ad: 400 }, { base: '2001', ad: 400 }];
      const alvoM = w.auto.escolherConjunto(misto, cmp);
      t.check('R1: misto -> 1 lendario + 2 basicos = 3', alvoM.length === 3);
      t.check('R1: misto -> o lendario aparece UMA vez', alvoM.filter((i) => i.base === '2001').length === 1);
      t.check('R1: misto -> o basico aparece DUAS vezes', alvoM.filter((i) => i.base === '1001').length === 2);

      const porBase = w.auto.porMelhorBase([{ base: '1001', qual: 'C' }, { base: '1001', qual: 'A' }]);
      t.check('R1: porMelhorBase mantem as DUAS instancias do basico (o jogo permite repetir)', porBase.length === 2);
      const porBaseL = w.auto.porMelhorBase([{ base: '2001', qual: 'C' }, { base: '2001', qual: 'A' }]);
      t.check('R1: porMelhorBase deixa UMA instancia do lendario (a melhor)', porBaseL.length === 1);
      t.check('R1: ...e a que fica e a de maior qualidade', porBaseL[0].qual === 'A');
    }

    /* ============ F1 - FARM POR ITEM: modo persistente (TK-02-47) ============ */
    {
      const w = novoMundo();
      definirCampeao(w.m, 'adtest');
      metaComDrop(w.m, '3089', 'zona-teste', { nome: 'Zona do Teste' });
      w.m.montar('#local-nome', [w.m.el({ label: 'local-nome', textContent: 'Fonte' })]);

      const r = w.auto.farmarItem(['3089']);
      t.check('F1: farmarItem liga com 1 id', r.ok === true && r.ids.length === 1);
      t.check('F1: fixa a REGIAO do drop (vem do planejar/ONDE_ITEM do jogo)', r.regiao === 'zona-teste');
      t.check('F1: a regiao fica gravada na config (persiste ao reload)', w.auto.getConfig().regionDefault === 'zona-teste');
      t.check('F1: os ids ficam gravados na config', (w.auto.getConfig().farmarItem || []).join(',') === '3089');
      t.check('F1: o estado diz que esta ativo', w.auto.farmarItemEstado().ativo === true);

      const p1 = w.auto.farmarItemPasso();
      t.check('F1: sem o item o modo CONTINUA ativo', p1.ativo === true && p1.parou !== true);
      t.check('F1: sem o item a regiao continua fixa', w.auto.getConfig().regionDefault === 'zona-teste');

      mochila(w.m, w.auto, [slot('3089~C', 'lendario')]);
      const p2 = w.auto.farmarItemPasso();
      t.check('F1: com o item na mochila o modo PARA', p2.parou === true && p2.caiu.indexOf('3089') >= 0);
      t.check('F1: ao parar larga a regiao fixa (o motor volta a escolher)', w.auto.getConfig().regionDefault === null);
      t.check('F1: ao parar limpa os ids da config', (w.auto.getConfig().farmarItem || []).length === 0);
      t.check('F1: o motivo da paragem nomeia o item', /3089/.test(String(p2.motivo)));
      t.check('F1: o estado final diz que ja nao esta ativo', w.auto.farmarItemEstado().ativo === false);

      const r2 = w.auto.farmarItem('rabadon');
      t.check('F1: "rabadon" normaliza para o id 3089', r2.ok === true && r2.ids.join(',') === '3089');
      w.auto.farmarItemParar('teste');
      t.check('F1: farmarItemParar desliga o modo', w.auto.farmarItemEstado().ativo === false);
      const r3 = w.auto.farmarItem([]);
      t.check('F1: sem ids recusa ligar (nao inventa alvo)', r3.ok === false);
    }

    /* ============ F2 - FARM POR ITEM: para tambem quando o item esta EQUIPADO ============ */
    {
      const w = novoMundo();
      definirCampeao(w.m, 'adtest');
      metaComDrop(w.m, '3089', 'zona-teste');
      w.m.montar('#local-nome', [w.m.el({ label: 'local-nome', textContent: 'Fonte' })]);
      w.auto.farmarItem(['3089']);
      const el = w.m.el({ tag: 'button', label: 'equip:3089~C', attrs: { 'data-id': '3089~C' } });
      w.m.montar('#equip > button.slot[data-id]', [el]);
      w.m.montar('#equip button.slot[data-id]', [el]);
      const p = w.auto.farmarItemPasso();
      t.check('F2: item EQUIPADO tambem para o modo', p.parou === true);
    }

    /* ============ C1 - MIGRACAO DA CONFIG (TK-02-61) ============
     * O {...DEFAULT, ...guardada} nunca aplica um default NOVO a uma chave que JA existe: a conta
     * do dono ficou com barraPorDisponibilidade false e a rotacao da barra nunca ligava. */
    {
      const w = novoMundo();
      const so = (o) => w.auto.migrarCfg(o);
      const m1 = so({ automation: { barraPorDisponibilidade: false } });
      t.check('C1: default VELHO (false) guardado -> passa a TRUE', m1.cfg.barraPorDisponibilidade === true);
      t.check('C1: ...e a migracao e reportada (para o log)', m1.migrou.length === 1 && m1.migrou[0].chave === 'barraPorDisponibilidade');
      t.check('C1: ...e a versao da config avanca', m1.cfgVer === w.auto.CFG_VER);

      const m2 = so({ automation: { barraPorDisponibilidade: true } });
      t.check('C1: valor ja novo nao mexe em nada', m2.migrou.length === 0 && m2.cfg.barraPorDisponibilidade === true);

      const m3 = so({ automation: { barraPorDisponibilidade: false }, cfgVer: w.auto.CFG_VER });
      t.check('C1: config JA migrada nao volta a migrar (one-shot)', m3.migrou.length === 0);

      const m4 = so({ automation: { autoRefino: false } });
      t.check('C1: o autoRefino (a accao que nascia desligada) tambem migra para true', m4.cfg.autoRefino === true);

      const m5 = so({ automation: {} });
      t.check('C1: chave AUSENTE nao e inventada (o DEFAULT ja a traz)', m5.migrou.length === 0);

      const m6 = so({ automation: { barraPorDisponibilidade: false, regionDefault: 'rio', champAlvo: 'katarina', enabled: false } });
      t.check('C1: a escolha do dono (regionDefault) fica INTACTA', m6.cfg.regionDefault === 'rio');
      t.check('C1: o champAlvo do dono fica INTACTO', m6.cfg.champAlvo === 'katarina');
      t.check('C1: o interruptor-mestre NUNCA e migrado', m6.cfg.enabled === undefined || m6.cfg.enabled === false);
      t.check('C1: sem storage nao rebenta', so(null).cfg === null);
    }

    /* ============ C2 - A MIGRACAO ACONTECE NO ARRANQUE, pelo chrome.storage REAL ============ */
    {
      const seed = { enabled: false, automation: { barraPorDisponibilidade: false, regionDefault: 'rio', autoRefino: false, champAlvo: 'katarina' } };
      const w = novoMundo({ storage: { [STORAGE_KEY]: seed } });
      await flush(); await flush(); await flush();
      const c = w.auto.getConfig();
      t.check('C2: ao carregar, barraPorDisponibilidade fica TRUE (a conta do dono)', c.barraPorDisponibilidade === true);
      t.check('C2: o autoRefino fica TRUE', c.autoRefino === true);
      t.check('C2: a regiao escolhida pelo dono NAO e apagada', c.regionDefault === 'rio');
      t.check('C2: o champAlvo do dono NAO e apagado', c.champAlvo === 'katarina');
      t.check('C2: o auto-play continua desligado (nao se liga nada sozinho)', c.enabled === false);
      w.auto.setConfig({ equipHisterese: 1.06 });
      await flush(); await flush(); await flush();
      const g = w.m.estado.storage[STORAGE_KEY] || {};
      t.check('C2: o cfgVer fica gravado no storage', g.cfgVer === w.auto.CFG_VER);
      t.check('C2: a config gravada tem o valor migrado', (g.automation || {}).barraPorDisponibilidade === true);
      t.check('C2: a config gravada mantem a escolha do dono', (g.automation || {}).regionDefault === 'rio');
    }

    /* ============ C3 - ONE-SHOT A SERIO: a versao grava-se e a escolha EXPLICITA do dono manda ============
     * Sem gravar a versao no arranque, a migracao voltava a correr de cada vez e DESFAZIA uma
     * escolha explicita do dono (ele desliga a barra; o arranque seguinte ligava-a outra vez). */
    {
      // config que NAO tem o default velho (nada a migrar) — a versao tem de ficar gravada na mesma
      const w3 = novoMundo({ storage: { [STORAGE_KEY]: { enabled: false, automation: { barraPorDisponibilidade: true } } } });
      await flush(); await flush(); await flush();
      const g3 = w3.m.estado.storage[STORAGE_KEY] || {};
      t.check('C3: o cfgVer fica gravado no arranque mesmo sem nada a migrar', g3.cfgVer === w3.auto.CFG_VER);

      // o dono DESLIGA a barra explicitamente...
      w3.auto.setConfig({ barraPorDisponibilidade: false });
      await flush(); await flush(); await flush();
      // ...e um arranque NOVO com essa config NAO pode voltar a liga-la
      const w4 = novoMundo({ storage: { [STORAGE_KEY]: w3.m.estado.storage[STORAGE_KEY] } });
      await flush(); await flush(); await flush();
      t.check('C3: a escolha EXPLICITA do dono sobrevive ao arranque (nao e migrada de volta)', w4.auto.getConfig().barraPorDisponibilidade === false);
      t.check('C3: CONTROLO - a versao continua gravada', (w4.m.estado.storage[STORAGE_KEY] || {}).cfgVer === w4.auto.CFG_VER);
    }
    /* ============ B1 - RESTRICAO POR CLASSE (TK-02-82): o DEFEITO medido ============
     * O motor usa classeItem SO nas TABELAS DE DROP (motor.js:421 POR_CLASSE); o equipamento nao
     * tem restricao de classe (motor.js:2902/2909/2913-2914 so limitam bota/lendario/espaco).
     * A extensao PENALIZA a classe oposta em 8x (cfg.pesoClasseOposta) e, num campeao AP, o
     * pesosItem(mago).ad e 0 - logo um item AD vale ZERO e a build AD/critico contra o Barao
     * (2,8x o DPS, docs/sim-baron.md) fica INALCANCAVEL por construcao. */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'aptest');
      t.check('B1: no campeao AP o item AD pontua ZERO (o bloqueio e o PESO, nao o multiplicador)', w.auto.valorDe('2001') === 0);
      t.check('B1: CONTROLO - o item AP pontua > 0 no mesmo campeao', w.auto.valorDe('3001') > 0);
      t.check('B1: a classe do item AD e ad (motor.js:29 classeItem)', w.auto.classeItem('2001') === 'ad');
      t.check('B1: a classe do item AP e ap', w.auto.classeItem('3001') === 'ap');
      t.check('B1: o multiplicador da classe oposta vem da config (cfg.pesoClasseOposta)', typeof w.auto.getConfig().pesoClasseOposta === 'number');
      const buildAp = (w.auto.buildDaClasse() || []).map(String);
      t.check('B1: a build do AP nao contem o item AD (consequencia do peso 0)', buildAp.indexOf('2001') < 0);
      t.check('B1: CONTROLO - a build do AP contem itens AP', buildAp.some((b) => ['3001', '3002', '3003', '3004', '3089', '3005'].indexOf(b) >= 0));
    }

    /* ============ M1 - refinarMelhores: a MEDIDA manda sobre a lista teorica (TK-02-93) ============
     * A "muleta" (essenciais = buildIdeal() quando nao ha medicao) so pode sair quando houver
     * >=2 builds medidas. O que se prova aqui e a ORDEM DE AUTORIDADE: com historico suficiente
     * (confianca.mob >= 3) os essenciais sao os da build MEDIDA — mesmo que difiram da teorica —,
     * e so sem historico e que cai na teorica, com a fonte NOMEADA no resultado. */
    {
      // sem historico nenhum: fonte 'teorico' e a lista e a buildIdeal()
      const w1 = novoMundo();
      alimentarCatalogo(w1.m);
      definirCampeao(w1.m, 'adtest');
      w1.m.montar('#local-nome', [w1.m.el({ label: 'local-nome', textContent: 'Fonte' })]);
      const r1 = await w1.auto.refinarMelhores();
      t.check('M1: sem historico a fonte dos essenciais e a TEORICA (a muleta, declarada)', r1.fonteEssenciais === 'teorico');
      t.check('M1: ...e a lista teorica e a buildIdeal() do campeao', (r1.essenciais || []).join(',') === (w1.auto.buildIdeal() || []).map(String).join(','));

      // com historico (3 amostras da MESMA build): a fonte passa a ser a MEDIDA
      const equip = ['1001', '1001', '1001', '1001'];   // build medida (basicos, diferente da teorica)
      const ciclo = () => ({
        region: 'Zona do Teste', gold: 100, xp: 100, mobFase: { kills: 5, perMin: { gold: 1200, xp: 900 } },
        setup: { equip: equip.map((b) => ({ base: b })) },
      });
      const seed = {};
      seed[STORAGE_KEY + ':farm'] = { cycles: [ciclo(), ciclo(), ciclo()] };
      const w2 = novoMundo({ storage: seed });
      alimentarCatalogo(w2.m);
      definirCampeao(w2.m, 'adtest');
      w2.m.montar('#local-nome', [w2.m.el({ label: 'local-nome', textContent: 'Fonte' })]);
      await flush(); await flush(); await flush();
      const r2 = await w2.auto.refinarMelhores();
      t.check('M1: com >=3 amostras a fonte passa a MEDIDA', /^medido/.test(String(r2.fonteEssenciais)));
      t.check('M1: ...e os essenciais sao os da build MEDIDA (nao a teorica)', (r2.essenciais || []).join(',') === equip.join(','));
      t.check('M1: a build medida DIFERE da teorica (senao o teste nao prova nada)', (w2.auto.buildIdeal() || []).map(String).join(',') !== equip.join(','));
      t.check('M1: sem alvo refinavel devolve ok e diz por que', r2.ok === true && String(r2.motivo || '').length > 0);
    }
    /* ============ V1 - A VENDA AO LOJISTA NAO E DECIDIDA POR OURO (TK-02-85) ============
     * Prova exigida pelo ticket: "com a mochila NAO cheia e valor alto, n.vender tem de ficar
     * FALSO; com a mochila cheia, continua verdadeiro". O valor da venda continua calculado —
     * mas como INFORMACAO (n._venda.valor), nunca como receita (n._venda.receita === 0). */
    {
      // mochila COM espaco (1/30) e itens de valor ALTO (lendarios/Epicos com dica de 5.6k)
      const w1 = novoMundo();
      alimentarCatalogo(w1.m);
      definirCampeao(w1.m, 'adtest');
      mochila(w1.m, w1.auto, [
        slot('4001~C', 'epico', 'Item Epico. Vale 5.6k de ouro no Lojista.'),
        slot('4002~C', 'epico', 'Item Epico. Vale 5.6k de ouro no Lojista.'),
      ]);
      const n1 = w1.auto.necessidadesBase();
      t.check('V1: ha itens para vender (o plano marca VENDER_LOJISTA)', (n1._venda || {}).itens === 2);
      t.check('V1: o VALOR da venda e alto (11.2k) — e continua calculado', (n1._venda || {}).valor === 11200);
      t.check('V1: mochila NAO cheia + valor ALTO -> n.vender FALSO (nao vende por ouro)', n1.vender === false);
      t.check('V1: a receita do Lojista e ZERO (nao e ganho)', (n1._venda || {}).receita === 0);
      t.check('V1: o motivo registado nao e o ouro', (n1._venda || {}).motivo === 'prioridade' || (n1._venda || {}).motivo === 'espaco');

      // mochila QUASE CHEIA: vender passa a verdadeiro (espaco e a razao real)
      const w2 = novoMundo();
      alimentarCatalogo(w2.m);
      definirCampeao(w2.m, 'adtest');
      const muitos = [];
      for (let i = 0; i < 29; i++) muitos.push(slot('4001~C', 'epico', 'Item Epico do teste'));
      mochila(w2.m, w2.auto, muitos, 30);
      const n2 = w2.auto.necessidadesBase();
      t.check('V2: mochila quase cheia (29/30) -> n.vender VERDADEIRO', n2.vender === true);
      t.check('V2: o motivo e ESPACO', (n2._venda || {}).motivo === 'espaco');
      t.check('V2: mochilaQuaseCheia fica registado', (n2._venda || {}).mochilaQuaseCheia === true);
    }
  },
};
