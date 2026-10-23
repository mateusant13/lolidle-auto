/*
 * mercado-preco.test.mjs - POLÍTICA DE PREÇO DO MERCADO e RARIDADE NOVA (`mitica`).
 *
 * QUEIXAS DO DONO (2026-10-22, verbatim):
 *   "anunciou uma bota lendaria por 1.5kk. taria certo se nao tivesse uma bota igual, com
 *    tier melhor, mais barata. e esse preço aí, é só pra tier a. item tier b por esse preço
 *    só faz sentido quando é rabadon. quando é gume, é 10 milhoes pra mais."
 *   "jogo tem uma raridade nova, chamada mitica. nao podemos fazer nada com essa raridade
 *    pela extensao, ela é excecao. nao pode em nenhuma hipotese destruir os itens ou mexer
 *    neles. só equipar, quando faz sentido pra classe q estamos."
 *
 * O que este banco prova, SEM browser/rede:
 *   P1  mesmo tier -> 90% do menor (regra antiga preservada);
 *   P2  sem mesmo tier, tier SUPERIOR é o FALLBACK -> 90% do menor do tier melhor;
 *       COM mesmo tier, o mesmo tier manda (correcção do dono, 2026-10-23);
 *   P3  1,5M só tier A; tier B/C sem referência NÃO usa 1,5M;
 *   P4  excepções do dono: Rabadon (3089) 1,5M; Gume (3031) 10M+;
 *   P5  `planejarMercado` DESCE uma oferta B quando há uma A mais barata;
 *   P6  vigia: piso tier A por defeito; Rabadon B <= 1,5M é a excepção;
 *   P7  `mitica`: nunca VENDER_LOJISTA, nunca GUARDAR_COFRE, nunca ANUNCIAR_MERCADO;
 *       classe errada -> nem EQUIPAR.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import {
  criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao,
  montarMochila, montarLojista, CATALOGO,
} from './dom-stub.mjs';

const CONF = {
  precoSemComparavel: 1500000,
  precoSemComparavelPorBase: { '3089': 1500000, '3031': 10000000 },
};

const OF = (id, item, preco, extra) => Object.assign({ id: id, item: item, preco: preco, moeda: 'ouro', vendedor: 'x' }, extra || {});

export const suite = {
  nome: 'mercado-preco',
  titulo: 'Preço do mercado (tier A/Superior/Rabadon/Gume) e raridade nova (mitica)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');
    auto.setConfig({ enabled: true });

    /* ================= P1 - mesmo tier: 90% do menor ================= */
    let r = auto.precoDeAnuncio(
      { base: '3006', qual: 'B' },
      [{ base: '3006', qual: 'B', preco: 1000000 }], CONF);
    t.check('P1: oferta do MESMO tier -> 90% do menor', r.preco === 900000 && /MESMO tier/i.test(r.regra));

    /* ================= P2 - tier superior é FALLBACK ================= */
    // O caso exacto do dono: B a 1,5M, mas existe uma bota A mais barata (1M).
    r = auto.precoDeAnuncio(
      { base: '3006', qual: 'B' },
      [{ base: '3006', qual: 'A', preco: 1000000 }], CONF);
    t.check('P2: B sem oferta do mesmo tier usa 90% do A (900k), nunca 1,5M',
      r.preco === 900000 && /SUPERIOR/i.test(r.regra));
    r = auto.precoDeAnuncio(
      { base: '3006', qual: 'B' },
      [{ base: '3006', qual: 'A', preco: 900000 }], CONF);
    t.check('P2b: 90% do A mais barato (810k), e o anúncio fica ABAIXO do tier melhor', r.preco === 810000);
    // Um tier C também não pode ficar acima de um B/A mais barato.
    r = auto.precoDeAnuncio(
      { base: '3006', qual: 'C' },
      [{ base: '3006', qual: 'B', preco: 500000 }, { base: '3006', qual: 'A', preco: 800000 }], CONF);
    t.check('P2c: tier C usa o menor dos tiers SUPERIORES (B 500k -> 450k)', r.preco === 450000);
    // CORRIGIDO (dono, 2026-10-23): quando EXISTE oferta do MESMO tier, ela manda — o tier
    // superior deixou de ser tecto e passou a ser FALLBACK. MEDIDO ao vivo na base 3190: uma
    // `~A` de 64 (lixo de outro jogador) empurrava a `~B` anunciada para 58/7999, com a `~B`
    // mais barata da loja a 29.997. Um tier A barato é o preço do A, não o preço do B.
    r = auto.precoDeAnuncio(
      { base: '3006', qual: 'B' },
      [{ base: '3006', qual: 'B', preco: 1000000 }, { base: '3006', qual: 'A', preco: 800000 }], CONF);
    t.check('P2d: B 1M com A 800k -> 900k (o MESMO tier manda; a A não é tecto)', r.preco === 900000
      && /MESMO tier/i.test(r.regra));
    r = auto.precoDeAnuncio(
      { base: '3006', qual: 'B' },
      [{ base: '3006', qual: 'B', preco: 500000 }, { base: '3006', qual: 'A', preco: 800000 }], CONF);
    t.check('P2e: B 500k com A 800k -> 450k (mesmo tier, o menor)', r.preco === 450000);
    // O CASO AO VIVO (2026-10-23): B do mercado a 29.997 e uma A de lixo a 64. O anúncio é
    // 90% da B (26.997), nunca 90% da A (58).
    r = auto.precoDeAnuncio(
      { base: '3190', qual: 'B' },
      [{ base: '3190', qual: 'B', preco: 29997 }, { base: '3190', qual: 'A', preco: 64 }], CONF);
    t.check('P2f: B 29.997 com A 64 -> 26.997 (a A não define o preço do B)', r.preco === 26997);

    /* ================= P3 - 1,5M SÓ tier A ================= */
    r = auto.precoDeAnuncio({ base: '3006', qual: 'A' }, [], CONF);
    t.check('P3: tier A sem comparável -> precoSemComparavel (1,5M)', r.preco === 1500000);
    r = auto.precoDeAnuncio({ base: '3006', qual: 'B' }, [], CONF);
    t.check('P3b: tier B sem comparável NÃO usa 1,5M (preco null)', r.preco === null && /SO tier A/i.test(r.regra));
    r = auto.precoDeAnuncio({ base: '3006', qual: 'C' }, [], CONF);
    t.check('P3c: tier C sem comparável NÃO usa 1,5M (preco null)', r.preco === null);

    /* ================= P4 - excepções nomeadas pelo dono ================= */
    r = auto.precoDeAnuncio({ base: '3089', qual: 'B' }, [], CONF);
    t.check('P4: Rabadon (3089) tier B sem comparável -> 1,5M', r.preco === 1500000);
    r = auto.precoDeAnuncio({ base: '3031', qual: 'B' }, [], CONF);
    t.check('P4b: Gume (3031) -> 10M (piso do dono)', r.preco === 10000000);
    // O piso do dono ganha ao tecto do tier superior: Gume nunca abaixo de 10M.
    r = auto.precoDeAnuncio({ base: '3031', qual: 'B' }, [{ base: '3031', qual: 'A', preco: 8000000 }], CONF);
    t.check('P4c: Gume nunca abaixo de 10M, mesmo com A a 8M', r.preco === 10000000);

    // O EXCEDENTE NÃO ABRE EXCEPÇÃO AO RABADON (ordem do dono: "nao é pra rabaddon ter interacao
    // pra venda ou destruicao do item ... mesmo duplicados"). O plano da mochila nunca o manda ao
    // Lojista nem ao mercado, mesmo com 2 cópias.
    {
      const mR = criarMundo();
      const aR = carregarAutomation(mR);
      alimentarCatalogo(mR);
      definirCampeao(mR, 'aptest');
      aR.setConfig({ enabled: true });
      montarMochila(mR, [
        { id: '3089~B', raridade: 'lendario' },
        { id: '3089~B', raridade: 'lendario' },
      ], 30);
      const actsR = aR.planBag(aR.scanBag(true)).acts.filter((x) => x.it && String(x.it.base).replace(/[+~].*$/, '') === '3089');
      t.check('P4d: 2 cópias do Rabadon -> nenhuma vai ao Lojista nem ao mercado',
        actsR.length === 2 && actsR.every((x) => x.action === 'PROTEGER'));
    }

    /* ================= P5 - planejarMercado DESCE a oferta ================= */
    m.sandbox.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({
        ofertas: [
          OF('o1', '9500~B', 1500000, { minha: true }),
          OF('o2', '9500~A', 900000, { minha: false }),
        ],
      }),
    });
    const plano = await auto.planejarMercado();
    const a1 = (plano.acoes || []).find((x) => x.id === 'o1');
    t.check('P5: planejarMercado DESCE a oferta B para 90% da A (810k)',
      !!a1 && a1.para === 810000 && /descer/i.test(a1.acao));

    // Sem referência nenhuma, uma oferta B a 1,5M é cancelada (1,5M só tier A).
    m.sandbox.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ ofertas: [OF('o3', '9500~B', 1500000, { minha: true })] }),
    });
    const plano2 = await auto.planejarMercado();
    const a3 = (plano2.acoes || []).find((x) => x.id === 'o3');
    t.check('P5b: oferta tier B a 1,5M sem referência é CANCELADA',
      !!a3 && /cancelar/i.test(a3.acao) && /1,5M|sem referencia/i.test(a3.acao));

    // A QUEIXA DO "Chama Sombria [A] ... vendeu para Malenya": um tier A ÚNICO não fica
    // anunciado. O plano cancela-o em vez de o reanunciar.
    m.sandbox.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ ofertas: [OF('oA', '9500~A', 1500000, { minha: true })] }),
    });
    const planoA = await auto.planejarMercado();
    const aA = (planoA.acoes || []).find((x) => x.id === 'oA');
    t.check('P5c: tier A único é CANCELADO (nunca reanunciado por 1,5M)',
      !!aA && /cancelar/i.test(aA.acao) && /protegido/i.test(aA.acao));

    // P5d/P5e — EXCEDENTE DE ESPECIAL: o `planBag` manda-o ao mercado; o plano não pode
    // cancelá-lo no ciclo seguinte (foi o vaivém que deixava a praça a meio: "meu mercado ta
    // com 5 slots de 10"). Cancelar só quando o campeão NÃO tem em casa as cópias que usa.
    {
      const mS = criarMundo();
      const aS = carregarAutomation(mS);
      alimentarCatalogo(mS);
      definirCampeao(mS, 'aptest');
      aS.setConfig({ enabled: true });
      mS.sandbox.fetch = async () => ({
        ok: true, status: 200,
        json: async () => ({ ofertas: [OF('oEx', '3100~C', 100, { minha: true })] }),
      });
      const pSem = await aS.planejarMercado();
      const exSem = (pSem.acoes || []).find((x) => x.id === 'oEx');
      t.check('P5d: especial SEM cópia em casa -> cancelar (o campeão precisa dela)',
        !!exSem && /cancelar/i.test(exSem.acao) && /protegido/i.test(exSem.acao));
      // Agora com UMA cópia EQUIPADA (o campeão usa 1): a oferta é excedente -> NÃO cancelar.
      mS.montar('#equip > button.slot[data-id]', [mS.el({
        tag: 'button', label: 'equip:3100', className: 'slot lendario',
        attrs: { 'data-id': '3100~C', 'data-dica': 'Perdicao de Lich (lendario)' },
      })]);
      const pCom = await aS.planejarMercado();
      const exCom = (pCom.acoes || []).find((x) => x.id === 'oEx');
      t.check('P5e: especial com a cópia em casa -> excedente, NÃO é cancelado',
        !!exCom && !/cancelar/i.test(exCom.acao));
      t.check('P5f: CONTROLO - 3100 é mesmo especial deste campeão', aS.ehEspecialMeu('3100') === true);
      // P5g — DUAS ofertas do mesmo especial, ZERO cópias em casa, o campeão usa 1: só UMA
      // volta (a que ele está a usar); a outra é excedente e fica anunciada. Sem isto o plano
      // esvaziava a praça do excedente que ele próprio tinha anunciado.
      const mZ = criarMundo();
      const aZ = carregarAutomation(mZ);
      alimentarCatalogo(mZ);
      definirCampeao(mZ, 'aptest');
      aZ.setConfig({ enabled: true });
      mZ.sandbox.fetch = async () => ({
        ok: true, status: 200,
        json: async () => ({ ofertas: [OF('o1', '3100~C', 100, { minha: true }), OF('o2', '3100~C', 100, { minha: true })] }),
      });
      const pDois = await aZ.planejarMercado();
      const doDois = (pDois.acoes || []).filter((x) => x.id === 'o1' || x.id === 'o2');
      t.check('P5g: 2 ofertas do especial, 1 em uso -> UMA cancela, a outra fica',
        doDois.filter((x) => /cancelar/i.test(x.acao)).length === 1
          && doDois.filter((x) => !/cancelar/i.test(x.acao)).length === 1);
    }

    /* ================= P6 - piso de tier da vigia ================= */
    t.check('P6: tier B NÃO passa no piso A por defeito',
      auto.tierPermitidoWatch(OF('x', '3006~B', 1000000), {}, 'A') === false);
    t.check('P6b: tier A passa no piso A',
      auto.tierPermitidoWatch(OF('x', '3006~A', 1000000), {}, 'A') === true);
    t.check('P6c: tier S passa no piso A',
      auto.tierPermitidoWatch(OF('x', '3006~S', 1000000), {}, 'A') === true);
    const exc = { excecoesTier: { '3089': { tier: 'B', precoMax: 1500000 } } };
    t.check('P6d: Rabadon B a 1,5M é a excepção que passa',
      auto.tierPermitidoWatch(OF('x', '3089~B', 1500000), exc, 'A') === true);
    t.check('P6e: Rabadon B acima de 1,5M NÃO passa',
      auto.tierPermitidoWatch(OF('x', '3089~B', 1500001), exc, 'A') === false);
    t.check('P6f: bota B a 1,5M não é excepção',
      auto.tierPermitidoWatch(OF('x', '3006~B', 1500000), exc, 'A') === false);

    // A mesma regra no caminho da COMPRA.
    const OURO = 1000000000;
    t.check('P6g: podeComprarOfertaWatch bloqueia bota B (piso A por defeito)',
      auto.podeComprarOfertaWatch(OF('x', '3006~B', 1000000), OURO, {}).ok === false);
    t.check('P6h: podeComprarOfertaWatch deixa passar tier A',
      auto.podeComprarOfertaWatch(OF('x', '3006~A', 1000000), OURO, {}).ok === true);
    t.check('P6i: podeComprarOfertaWatch deixa passar Rabadon B <= 1,5M',
      auto.podeComprarOfertaWatch(OF('x', '3089~B', 1500000), OURO, exc).ok === true);
    t.check('P6j: podeComprarOfertaWatch bloqueia Rabadon B > 1,5M',
      auto.podeComprarOfertaWatch(OF('x', '3089~B', 1500001), OURO, exc).ok === false);

    // `casarOfertas` (detecção) usa o mesmo piso e a mesma excepção.
    const soB = auto.casarOfertas([OF('x', '3006~B', 1000000)], { itens: ['3006'], tierMin: 'A' });
    t.check('P6k: casarOfertas descarta bota B com piso A', soB.length === 0);
    const rab = auto.casarOfertas([OF('x', '3089~B', 1500000)], { itens: ['3089'], tierMin: 'A', ...exc });
    t.check('P6l: casarOfertas mantém Rabadon B <= 1,5M (excepção)', rab.length === 1);

    /* ================= P7 - raridade NOVA (mitica) ================= */
    const CAT_MIT = CATALOGO.concat([
      // Stats MUITO acima dos lendários do stub (320-400) de propósito: o ponto do P8 é provar
      // que o mítico CONCORRE. Se perdesse por ser fraco, o teste não diria nada.
      { id: '9001', nome: 'Mítico AD', raridade: 'mitica', espaco: 'arma', ad: 500, preco: 100000 },
      { id: '9002', nome: 'Mítico AP', raridade: 'mitica', espaco: 'arma', ap: 500, preco: 100000 },
    ]);
    const m2 = criarMundo();
    const a2 = carregarAutomation(m2);
    alimentarCatalogo(m2, CAT_MIT);
    definirCampeao(m2, 'adtest');
    a2.setConfig({ enabled: true });
    montarMochila(m2, [
      { id: '9001~A', raridade: 'mitica' },
      { id: '9002~A', raridade: 'mitica' },
    ], 30);
    const acts = a2.planBag(a2.scanBag(true)).acts;
    const ad = acts.find((x) => x.it && x.it.id === '9001~A');
    const ap = acts.find((x) => x.it && x.it.id === '9002~A');
    t.check('P7: mítico da CLASSE nunca é vendido/guardado no cofre/anunciado',
      !!ad && ['EQUIPAR', 'PROTEGER'].includes(ad.action));
    t.check('P7b: mítico da classe ERRADA é PROTEGER (nem EQUIPAR)',
      !!ap && ap.action === 'PROTEGER' && /classe errada/i.test(ap.why));
    t.check('P7c: nenhum mítico vai ao Lojista, cofre ou mercado',
      acts.every((x) => !x.it || !String(x.it.raridade).includes('mitic')
        || !['VENDER_LOJISTA', 'GUARDAR_COFRE', 'ANUNCIAR_MERCADO'].includes(x.action)));
    // P8 (ordem do dono, 2026-10-23): o mitico tem de ser CONSIDERADO pela build, nao apenas
    // protegido. "classe a servir, stats e passiva ... nada manual, nada hardcoded." O 9001 tem
    // 100 AD e e uma arma, logo tem de ganhar o lugar a qualquer lendario de arma do catalogo.
    const buildAD = (a2.buildIdeal() || []).map(String);
    t.check('P8: o mitico AD entra na build ideal do campeao AD', buildAD.indexOf('9001') >= 0);
    const mAP = criarMundo();
    const aAP = carregarAutomation(mAP);
    alimentarCatalogo(mAP, CAT_MIT);
    definirCampeao(mAP, 'aptest');
    const buildAP = (aAP.buildIdeal() || []).map(String);
    t.check('P8b: o mitico AP entra na build ideal do campeao AP', buildAP.indexOf('9002') >= 0);
    t.check('P8c: e o mitico da OUTRA classe nao entra na build AP', buildAP.indexOf('9001') < 0);

    // O ALVO DE EQUIPAMENTO: o mítico da CLASSE ERRADA nunca entra no pool; o da classe
    // pode entrar (a ordem do dono permite equipar, mas só quando faz sentido).
    const m4 = criarMundo();
    const a4 = carregarAutomation(m4);
    alimentarCatalogo(m4, CAT_MIT);
    definirCampeao(m4, 'adtest');
    a4.setConfig({ enabled: true });
    m4.montar('#equip > button.slot[data-id]', [m4.el({
      tag: 'button', label: 'equip:1001', className: 'slot basico',
      attrs: { 'data-id': '1001~C', 'data-dica': '' },
    })]);
    montarMochila(m4, [
      { id: '9001~A', raridade: 'mitica' },
      { id: '9002~A', raridade: 'mitica' },
    ], 30);
    const alvoEq = a4.alvoEquip(a4.scanBag(true));
    const entramIds = (alvoEq.entram || []).map((i) => String(i.id));
    t.check('P7e: mítico AP (classe errada) NÃO entra no alvo de equipamento',
      entramIds.indexOf('9002~A') < 0);
    t.check('P7f: mítico AD (classe certa) pode entrar no alvo de equipamento',
      entramIds.indexOf('9001~A') >= 0 || (alvoEq.alvo || []).some((i) => String(i.id) === '9001~A'));

    // O ator REAL do Lojista também não toca no mítico.
    const m3 = criarMundo();
    const autoLoj = carregarAutomation(m3);
    alimentarCatalogo(m3, CAT_MIT);
    definirCampeao(m3, 'adtest');
    autoLoj.setConfig({ enabled: true });
    const slots = [{ id: '9001~A', classe: 'mitica', dica: 'Mítico AD. +100 de Dano de Ataque.' }];
    montarMochila(m3, slots);
    montarLojista(m3, slots);
    const res = await autoLoj.venderBase();
    t.check('P7d: venderBase NÃO vende o mítico (nem clica no slot)',
      res.ok === true && res.epicosVendidos.indexOf('9001~A') < 0
        && m3.clicksDePrefixo('slot:').indexOf('9001~A') < 0);
  },
};
