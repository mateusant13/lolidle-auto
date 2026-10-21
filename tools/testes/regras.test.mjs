/*
 * regras.test.mjs - REGRAS DO PLANEJADOR (planBag / identidade / dedupe / memo / mercado).
 *
 * Cada assercao corre contra o extension/automation.js REAL carregado num vm com o DOM
 * stubado (dom-stub.mjs). As mochilas sao montadas no DOM e lidas por scanBag() REAL, para
 * que a cadeia DOM -> scanBag -> planBag seja exercitada de ponta a ponta.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true (nao ha truthy solto).
 */

import {
  criarMundo, carregarAutomation, CATALOGO, alimentarCatalogo, alimentarMeta, definirCampeao,
  montarMochila, montarMercado, ofertasLendarias, ofertasEpicas, saturarMercado, stubFetchMercado,
} from './dom-stub.mjs';

function novoMundo(opts) {
  const m = criarMundo(opts);
  const auto = carregarAutomation(m);
  return { m: m, auto: auto };
}
function acoes(auto, bag) { return auto.planBag(bag).acts; }
function act(acts, id) { return acts.filter((a) => a.it.id === id)[0] || null; }
function acaoDe(acts, id) { const a = act(acts, id); return a ? a.action : '(sem acao)'; }
function eVendido(acts, id) { return acts.some((a) => a.it.id === id && a.action === 'VENDER_LOJISTA'); }
function eAnunciado(acts, id) { return acts.some((a) => a.it.id === id && a.action === 'ANUNCIAR_MERCADO'); }
function slot(id, raridade, dica) { return { id: id, raridade: raridade, dica: dica || '' }; }
function mochila(m, auto, slots) { montarMochila(m, slots); return auto.scanBag(true); }

export const suite = {
  nome: 'regras',
  titulo: 'Regras do planejador (planBag/identidade/dedupe/memo/mercado)',

  async run(t) {

    /* ================= T1 - IDENTIDADE: o campeao e identificavel pela classe/build ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      t.check('T1: o catalogo entrou no META pelo caminho real (message -> carregarMeta)',
        (w.auto.getMeta().itens || []).length === CATALOGO.length);
      t.check('T1: o campeao atual entrou pelo caminho real (icone #hud-habs + META.kits)',
        !!(w.auto.getMeta().champAtual && w.auto.getMeta().champAtual.id === 'adtest'));
      t.check('T1: window.postMessage funciona (o script real pediu o meta: pedir-meta)',
        w.m.estado.posted.some((p) => p && p.__lolidleAuto === 'pedir-meta'));
      t.check('T1: classe do campeao AD = ad', w.auto.classeCampeao() === 'ad');
      t.check('T1: perfil do campeao AD = dano', w.auto.identidadeCampeao().perfil === 'dano');
      const buildAD = w.auto.buildDaClasse().slice();
      t.check('T1: build da classe AD tem 5 itens (1 bota + 4)', buildAD.length === 5);
      t.check('T1: a build da classe AD tem lendarios', w.auto.lendariosDaClasse().size >= 1);
      t.check('T1: Rabadon (3089) NAO entra na build do AD', buildAD.indexOf('3089') < 0);

      definirCampeao(w.m, 'aptest');
      t.check('T1: classe do campeao AP = ap', w.auto.classeCampeao() === 'ap');
      t.check('T1: perfil do campeao AP = mago', w.auto.identidadeCampeao().perfil === 'mago');
      const buildAP = w.auto.buildDaClasse().slice();
      t.check('T1: a build muda com a classe (AD vs AP)', buildAD.join(',') !== buildAP.join(','));
      t.check('T1: Rabadon (3089) entra na build do AP', buildAP.indexOf('3089') >= 0);
      t.check('T1: lendario AP entra na build do AP', buildAP.indexOf('3001') >= 0);
    }

    /* ================= T2 - lendario DA BUILD nunca vai ao mercado ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      t.check('T2: fixture: 2001 e lendario da build do AD', w.auto.ehLendarioDaBuild('2001') === true);
      t.check('T2: fixture: 9500 NAO e lendario da build (fora)', w.auto.ehLendarioDaBuild('9500') === false);

      const bag = mochila(w.m, w.auto, [slot('2001~C', 'lendario'), slot('9500~C', 'lendario')]);
      const acts = acoes(w.auto, bag);
      t.check('T2: lendario da build <A -> PROTEGER', acaoDe(acts, '2001~C') === 'PROTEGER');
      t.check('T2: lendario da build nunca e ANUNCIAR_MERCADO', eAnunciado(acts, '2001~C') === false);
      t.check('T2: lendario da build nunca e VENDER_LOJISTA', eVendido(acts, '2001~C') === false);
      t.check('T2: CONTROLO - lendario FORA da build <A vai ao mercado', eAnunciado(acts, '9500~C') === true);

      t.check('T2: lendario da CLASSE ERRADA (3001 AP) nao e blindado no campeao AD',
        w.auto.ehLendarioDaBuild('3001') === false);
      const bag2 = mochila(w.m, w.auto, [slot('3001~C', 'lendario')]);
      const acts2 = acoes(w.auto, bag2);
      t.check('T2: ...e continua anunciavel (sem over-protecao)', eAnunciado(acts2, '3001~C') === true);
      t.check('T2: ...e nao recebe PROTEGER', acaoDe(acts2, '3001~C') !== 'PROTEGER');
    }

    /* ================= T3 - dedupe por base: fica o MAIOR tier (C < B < A < S < SS) ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');

      const bag = mochila(w.m, w.auto, [slot('9500~B', 'lendario'), slot('9500~C', 'lendario')]);
      const acts = acoes(w.auto, bag);
      t.check('T3: duplicata lendaria: fica o MAIOR tier (B > C)', eAnunciado(acts, '9500~B') === true);
      // REGRA DO DONO (2026-10-14, verbatim): "a liandry c e anunciada no mercado. pronto. e fica
      // a liandry a. se eu tenho outra liandry a, (duas), anuncia uma delas no mercado."
      // -> LENDARIO duplicado vai ao MERCADO (antes ia ao Lojista, que era a regra errada).
      t.check('T3: a duplicata de LENDARIO vai ao mercado', eAnunciado(acts, '9500~C') === true);
      t.check('T3: a duplicata de LENDARIO nao vai ao Lojista', eVendido(acts, '9500~C') === false);
      t.check('T3: a duplicata sai com motivo de duplicata',
        String((act(acts, '9500~C') || {}).why || '').indexOf('duplicata') === 0);
      const anunciados = acts.filter((a) => a.it.base === '9500' && a.action === 'ANUNCIAR_MERCADO').length;
      t.check('T3: as duas copias lendarias vao ao mercado (nenhuma ao Lojista)', anunciados === 2);

      const bag2 = mochila(w.m, w.auto, [slot('9500~C', 'lendario'), slot('9500+2~C', 'lendario')]);
      const acts2 = acoes(w.auto, bag2);
      t.check('T3: mesmo id+qual com refino: o +2 e o MAIOR tier e fica', eAnunciado(acts2, '9500+2~C') === true);
      t.check('T3: a copia sem refino do mesmo tier e a duplicata, e vai ao mercado', eAnunciado(acts2, '9500~C') === true);

      const bag3 = mochila(w.m, w.auto, [slot('4001~C', 'epico')]);
      const acts3 = acoes(w.auto, bag3);
      t.check('T3: epico <A continua lixo (comportamento antigo mantido)', eVendido(acts3, '4001~C') === true);
      t.check('T3: epico <A nao vai pro mercado', eAnunciado(acts3, '4001~C') === false);
    }

    /* ================= T4 - acima de A (A, A+S, S, SS): NAO SE MEXE, em qualquer raridade ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');

      const bag = mochila(w.m, w.auto, [
        slot('1005~A', 'basico'), slot('1005~S', 'basico'), slot('1005~SS', 'basico'),
        slot('1005+3~SS', 'basico'), slot('1005~C', 'basico'),
      ]);
      const acts = acoes(w.auto, bag);
      // ACTUALIZADO a 2026-10-14 (regra do dono): "item basico, epico, duplicado: vende no
      // lojista. a nao ser q seja tier s mais." -> A NAO e intocavel; só S/SS sao. O jogo
      // concorda: `protegidoVenda = S/SS OU refino>0` (jogo.js:5515).
      t.check('T4: basico A E vendido (só S+ é intocável, regra do dono)',
        eVendido(acts, '1005~A') === true);
      t.check('T4: basico S nunca e vendido/anunciado',
        !eVendido(acts, '1005~S') && !eAnunciado(acts, '1005~S'));
      t.check('T4: basico SS nunca e vendido/anunciado',
        !eVendido(acts, '1005~SS') && !eAnunciado(acts, '1005~SS'));
      t.check('T4: basico +3~SS nunca e vendido/anunciado',
        !eVendido(acts, '1005+3~SS') && !eAnunciado(acts, '1005+3~SS'));
      t.check('T4: CONTROLO - basico C em excesso E vendido (nao travei o Lojista)', eVendido(acts, '1005~C') === true);

      const bag2 = mochila(w.m, w.auto, [slot('4001~A', 'epico'), slot('4001~C', 'epico')]);
      const acts2 = acoes(w.auto, bag2);
      // ACTUALIZADO (regra do dono 2026-10-14): "basico, epico, duplicado: vende no lojista.
      // a nao ser q seja tier s mais" -> épico A NÃO é S+ -> VAI AO LOJISTA.
      t.check('T4: epico A vai ao Lojista (só S+ é intocável)',
        acaoDe(acts2, '4001~A') === 'VENDER_LOJISTA');
      t.check('T4: CONTROLO - a duplicata ABAIXO de A do epico E vendida', eVendido(acts2, '4001~C') === true);

      const bag3 = mochila(w.m, w.auto, [slot('9500+2~S', 'lendario')]);
      const acts3 = acoes(w.auto, bag3);
      t.check('T4: lendario A+2~S -> PROTEGER', acaoDe(acts3, '9500+2~S') === 'PROTEGER');
      t.check('T4: lendario A+2~S nao e vendido nem anunciado',
        !eVendido(acts3, '9500+2~S') && !eAnunciado(acts3, '9500+2~S'));
    }

    /* ================= T5 - sem campeao carregado: nada e inventado ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      t.check('T5: build da classe vazia sem campeao', w.auto.buildDaClasse().length === 0);
      t.check('T5: nenhum lendario blindado sem campeao', w.auto.lendariosDaClasse().size === 0);
      const bag = mochila(w.m, w.auto, [slot('9500~C', 'lendario'), slot('2001~C', 'lendario')]);
      const acts = acoes(w.auto, bag);
      t.check('T5: sem identidade, o lendario <A vai ao mercado',
        eAnunciado(acts, '9500~C') === true && eAnunciado(acts, '2001~C') === true);
      definirCampeao(w.m, 'adtest');
      t.check('T5: a classe volta a existir quando o campeao carrega (memo invalidado)',
        w.auto.buildDaClasse().length === 5 && w.auto.ehLendarioDaBuild('2001') === true);
    }

    /* ================= T6 - catalogo que chega DEPOIS invalida o memo ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      t.check('T6: antes do catalogo tardio, 2009 nao existe', w.auto.ehLendarioDaBuild('2009') === false);
      // ACTUALIZADO 2026-10-14 (fila W11): o catalogo do banco passou a ter os itens REAIS
      // do jogo (3153 Espada do Rei Destruido, 3031 Gume do Infinito, 6653 Liandry, 3171 Impeto,
      // 3100 Lich, 3135 Cajado do Vazio, 3036 Lembrancas, 3168 Couraca) para o ticket P0 da fila
      // W11 (a build de chefe tem de conter a 3153) ter onde se provar. Com isso a composicao das
      // builds mudou: no perfil 'dano' o 3031 (+40% no critico, motor.js:515) passou a ganhar o
      // 4. espaco ao 2006. A assercao agora fixa o 3031 no lugar do 2006 - o que se prova e que o
      // lendario da build esta blindado, e a linha seguinte (T6: 2009 tardio) prova a invalidacao
      // do memo pelo caminho que interessa.
      const buildAntes = w.auto.buildDaClasse();
      t.check('T6: fixture: 2001 esta na build antes', buildAntes.indexOf('2001') >= 0);
      t.check('T6: fixture: 2006 esta na build antes', buildAntes.indexOf('2006') >= 0);
      const novo = { id: '2009', nome: 'Lendario Tardio', raridade: 'lendario', espaco: 'arma', ad: 900, preco: 3000, de: ['2002'] };
      alimentarCatalogo(w.m, CATALOGO.concat([novo]));
      const buildDepois = w.auto.buildDaClasse();
      t.check('T6: catalogo tardio invalida o memo (memo por tamanho do catalogo)',
        buildDepois.indexOf('2009') >= 0);
      t.check('T6: o lendario novo passa a blindado', w.auto.ehLendarioDaBuild('2009') === true);
      // DIVERGENCIA AO TICKET (reportada): com o beam search (TK-06), o 2009 (ad 900) substitui
      // o 3031 (o pior item da build), NAO o 2006. O 2006 continua na build. O contrato que
      // importa e que o item que SAI da build deixa de ser blindado — o 3031 sai e o seu
      // lugar de lendarioDaBuild deve ser ocupado pelo 2009.
      const saiu = buildAntes.filter((id) => buildDepois.indexOf(id) < 0)[0];
      t.check('T6: o item que saiu da build (' + saiu + ') deixa de ser blindado',
        saiu !== undefined && w.auto.ehLendarioDaBuild(saiu) === false);
    }

    /* ================= T7 - a build e por SCORE, nao pelo PAPEL (TK-01) =================
     * ANTES (PESO_FASE): o papel mudava a build (dano -> tanque). AGORA a build e escolhida por
     * SCORE MEDIDO (`scoreSet`) sobre o catalogo, e o score NAO le o papel — logo a build deixa
     * de mudar com ele. Este teste guarda o contrato novo: se a build VOLTAR a mudar com o papel,
     * e porque o PESO_FASE regressou ao caminho da build (o que o TK-01 proibe). */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const antes = w.auto.buildDaClasse().slice();
      t.check('T7: perfil inicial = dano', w.auto.identidadeCampeao().perfil === 'dano');
      // DIVERGENCIA AO TICKET (reportada): com o beam search (TK-06), a build inicial do adtest
      // e ["2001","2004","2005","2006","3031"] — o 3031 (Gume do Infinito, +40% critico) da mais
      // score que o 2007 (Botas AD). O greedy antigo escolhia botas[0] + 4 nao-bota; o beam
      // escolhe os melhores 4 nao-bota + o melhor 5o slot (que pode ser nao-bota). O contrato
      // que importa e que a build NAO muda com o papel — isso continua a ser provado abaixo.
      t.check('T7: fixture: build inicial tem 5 itens', antes.length === 5);
      definirCampeao(w.m, 'adtest', { papel: { dano: 0.8, recebido: 0.5 } });
      t.check('T7: papel muda o perfil (dano -> tanque)', w.auto.identidadeCampeao().perfil === 'tanque');
      const depois = w.auto.buildDaClasse().slice();
      t.check('T7: a build NAO depende do papel (scoreSet manda, nao PESO_FASE)', antes.join(',') === depois.join(','));
      // O lendario da build (seja qual for) continua blindado depois da troca de papel.
      const lendarioDaBuild = depois.find((id) => w.auto.ehLendarioDaBuild(id));
      t.check('T7: o lendario da build continua blindado depois da troca de papel', lendarioDaBuild !== undefined);
    }

    /* ================= T8 - a build e por SCORE, nao pela DISTANCIA (TK-01) ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const antes = w.auto.buildDaClasse().slice();
      definirCampeao(w.m, 'adtest', { distancia: true });
      t.check('T8: distancia muda o perfil (dano -> atirador)', w.auto.identidadeCampeao().perfil === 'atirador');
      const depois = w.auto.buildDaClasse().slice();
      t.check('T8: a build NAO depende da distancia (scoreSet manda, nao PESO_FASE)', antes.join(',') === depois.join(','));
      t.check('T8: o lendario da build continua blindado depois da troca de distancia', w.auto.ehLendarioDaBuild('2006') === true);
    }

    /* ================= T9 - qualidade ilegivel ('?') nunca e mexida ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const bag = mochila(w.m, w.auto, [slot('9500~?', 'lendario'), slot('9500~C', 'lendario')]);
      t.check("T9: scanBag le a qualidade '?' do slot '9500~?'", bag.items[0].qual === '?');
      const acts = acoes(w.auto, bag);
      t.check("T9: qualidade '?' -> PROTEGER", acaoDe(acts, '9500~?') === 'PROTEGER');
      t.check("T9: qualidade '?' nunca e vendida nem anunciada",
        !eVendido(acts, '9500~?') && !eAnunciado(acts, '9500~?'));
      t.check("T9: CONTROLO - no mesmo plano, 9500~C e anunciado", eAnunciado(acts, '9500~C') === true);
    }

    /* ================= T10 - Rabadon '3089+2' tem de ser reconhecido como base 3089 ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      t.check('T10: fixture: Rabadon NAO esta na build do AD (a protecao nao vem da build)',
        w.auto.ehLendarioDaBuild('3089') === false);
      const bag = mochila(w.m, w.auto, [slot('3089+2~C', 'lendario'), slot('9500~C', 'lendario')]);
      t.check("T10: scanBag reconhece '3089+2~C' como base 3089", bag.items[0].base === '3089');
      t.check('T10: scanBag le o refino +2', bag.items[0].refino === 2);
      const acts = acoes(w.auto, bag);
      t.check('T10: Rabadon +2 abaixo de A nunca vai ao Lojista', eVendido(acts, '3089+2~C') === false);
      t.check('T10: Rabadon +2 abaixo de A nunca e anunciado', eAnunciado(acts, '3089+2~C') === false);
      t.check('T10: CONTROLO - no mesmo plano, 9500~C e anunciado', eAnunciado(acts, '9500~C') === true);
    }

    /* ================= T11 - mercadoSaturado(): 10 ofertas LENDARIAS ================= */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const ofertas = await saturarMercado(w.auto, w.m);
      t.check('T11: salvarOfertas leu as 10 ofertas do SERVIDOR (sem abrir o mercado)', (ofertas || []).length === 10);
      const ms = w.auto.mercadoSaturado();
      t.check('T11: mercadoSaturado() com 10 ofertas lendarias -> sat = true', ms.sat === true);
      t.check('T11: ...e conta 10 lendarias', ms.lend === 10);
      t.check('T11: ...e o total de ofertas e 10', ms.total === 10);
      t.check('T11: a cache de ofertas (ofertasEmCache) tem as 10', w.auto.ofertasEmCache().length === 10);
      const bag = mochila(w.m, w.auto, [slot('9500~C', 'lendario')]);
      const acts = acoes(w.auto, bag);
      // ACTUALIZADO 2026-10-14 (regra do dono): "nunca se vende lendario pelo lojista, so pelo mercado".
      // Mercado SATURADO + lendario <A -> nao ha lugar para anunciar E o Lojista e proibido: fica GUARDADO.
      t.check('T11: mercado SATURADO: lendario <A NAO vai ao Lojista (regra do dono)', eVendido(acts, '9500~C') === false);
      t.check('T11: ...e nao e anunciado (nao ha lugar no mercado)', eAnunciado(acts, '9500~C') === false);
    }
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      t.check('T11: CONTROLO - sem ofertas, sat = false (antes era SEMPRE falso)', w.auto.mercadoSaturado().sat === false);
      const bag = mochila(w.m, w.auto, [slot('9500~C', 'lendario')]);
      const acts = acoes(w.auto, bag);
      t.check('T11: CONTROLO - sem saturacao o mesmo lendario e anunciado', eAnunciado(acts, '9500~C') === true);
    }
    {
      /* chrome.storage.local com callback ASSINCRONO: a 1a chamada ainda nao ve as ofertas,
       * o callback (queueMicrotask, como no MV3) alimenta a cache e a 2a chamada ve. */
      const guardadas = ofertasLendarias(10).map((o, i) => ({ id: 'st:' + i, raridade: 'lendario', qual: 'S', txt: o.txt }));
      const w = novoMundo({ storage: { 'lolidleAutoPotion:ofertas': { at: 1, ofertas: guardadas } } });
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const antes = w.auto.mercadoSaturado();
      await null;
      const depois = w.auto.mercadoSaturado();
      t.check('T11: chrome.storage.local.get com callback ASSINCRONO alimenta a cache de ofertas',
        depois.sat === true && depois.lend === 10);
      t.check('T11: ...e antes do callback async a oferta guardada ainda nao era visivel',
        antes.sat === false);
    }
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const epicas = ofertasEpicas(1).map((o) => ({ id: 'ep:0', txt: o.txt }));
      const ofertas9 = ofertasLendarias(9).concat(epicas);
      montarMercado(w.m, ofertas9);
      stubFetchMercado(w.m, ofertas9);
      await w.auto.salvarOfertas();
      const ms = w.auto.mercadoSaturado();
      t.check('T11: 9 lendarias + 1 epica -> sat = false (limiar exato de 10)', ms.sat === false);
      t.check('T11: ...e conta 9 lendarias', ms.lend === 9);
      t.check('T11: ...com 10 ofertas no total', ms.total === 10);
    }
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const ofertas10 = ofertasEpicas(10);
      montarMercado(w.m, ofertas10);
      stubFetchMercado(w.m, ofertas10);
      await w.auto.salvarOfertas();
      const ms = w.auto.mercadoSaturado();
      t.check('T11: 10 epicas -> sat = false (so lendarias contam)', ms.sat === false);
      t.check('T11: ...e conta 0 lendarias', ms.lend === 0);
    }
    /* ========= T12 - necessidade `mercado` fecha quando o passo fica INDISPONIVEL =========
     * P0 MEDIDO (2026-10-20): a base marcava `marcarIndisponivel('mercado')`, mas a guarda
     * olhava `estaIndisponivel('anunciar')` - chave que nunca era marcada. O `n.mercado`
     * continuava `true` no tick seguinte e a base repetia `mercado` a cada passagem. */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      w.auto.setConfig({ enabled: true });
      mochila(w.m, w.auto, [slot('9500~C', 'lendario')]);
      const n0 = w.auto.necessidadesBase();
      t.check('T12: sem saturação, o lendário <A abre a necessidade `mercado`', n0.mercado === true);
      w.auto.marcarIndisponivel('mercado', 'teste de regressão');
      const n1 = w.auto.necessidadesBase();
      t.check('T12: `mercado` indisponível -> a necessidade FECHA (não fica eterna)',
        n1.mercado === false && n1.anunciar === false);
      t.check('T12: CONTROLO - a chave marcada é a do passo (`mercado`)',
        w.auto.estaIndisponivel('mercado') === true);
    }

    /* ================= T13 - O CICLO "VOLTA À BASE TODA HORA" (2026-10-20) =================
     * Duas causas medidas no código:
     *  (1) `n.cura` era `vidaCur < vida` (faltar 1 ponto): em combate é SEMPRE verdade, logo
     *      o supervisor recordava a cada 20 s para a Soraka curar.
     *  (2) o `supervisarBase` calculava `motivoViagem` (a venda só paga a viagem com a mochila
     *      quase cheia ou >= venderMinItens) e NUNCA o usava: quem decidia era `motivo`, onde
     *      `vender` entrava com UM item. */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      w.auto.setConfig({ enabled: true });
      w.m.montar('#hud-vida-txt', [w.m.el({ label: 'hud-vida-txt', textContent: '900 / 1000' })]);
      t.check('T13: com 90% de vida, a cura NAO paga uma viagem', w.auto.necessidadesBase().cura === false);
      w.m.montar('#hud-vida-txt', [w.m.el({ label: 'hud-vida-txt', textContent: '200 / 1000' })]);
      t.check('T13: com 20% de vida, a cura passa a ser necessidade', w.auto.necessidadesBase().cura === true);
      const comVenda = (itens, cheia) => w.auto.motivosDeViagem(['cura', 'vender'], { _venda: { itens: itens, mochilaQuaseCheia: cheia } }, { venderMinItens: 6 });
      t.check('T13: 1 item para vender NAO paga a viagem (a cura continua a pagar)',
        JSON.stringify(comVenda(1, false)) === '["cura"]');
      t.check('T13: 6 itens para vender PAGAM a viagem',
        JSON.stringify(comVenda(6, false)) === '["cura","vender"]');
      t.check('T13: mochila quase cheia PAGA a viagem mesmo com poucos itens',
        JSON.stringify(comVenda(2, true)) === '["cura","vender"]');
      t.check('T13: sem necessidade de venda a lista fica vazia',
        JSON.stringify(w.auto.motivosDeViagem(['vender'], { _venda: { itens: 1, mochilaQuaseCheia: false } }, { venderMinItens: 6 })) === '[]');
      t.check('T13: ler o cofre NAO e necessidade primaria (nao paga uma viagem sozinha)',
        w.auto.NECESSIDADES_PRIMARIAS.indexOf('lerCofre') < 0);
    }
  },
};
