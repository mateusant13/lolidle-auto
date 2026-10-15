/*
 * w5-itens.test.mjs - SUITE DO WORKER W5 (fila-W5.md): mercado, epicos, equipar e Ornn.
 *
 * Fecha os tickets:
 *   TK-01-51 (P0) planBag vendia BASICOS que sao componente de receita da build
 *   TK-01-68 (P0) n.equip/n.comprar presos em true
 *   TK-02-01 (P0) epico -> Lojista sem excepcao de componente
 *   TK-02-04 (P1) Gume do Infinito (3031) intocavel, duplicado incluido
 *   TK-02-07 (P1) lendario UNICO da classe do campeao -> guardar
 *   parseNum    sufixo k/M do fmt do jogo (cena.js:225) nao pode ser apagado
 *
 * Mesmo contrato das outras suites: automation.js REAL em vm com DOM stubado, e
 * t.check(rotulo, condicao) so passa com condicao === true.
 */

import {
  criarMundo, carregarAutomation, CATALOGO, alimentarCatalogo, definirCampeao,
  montarMochila, montarOrnn,
} from './dom-stub.mjs';

/** Poe o boneco na Fonte (o `naBase()` exige o texto 'Fonte' no #local-nome). */
function montarLocal(m, texto) { m.montar('#local-nome', [m.el({ tag: 'span', label: 'local', textContent: texto })]); }

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
function eProtegido(acts, id) { return acts.some((a) => a.it.id === id && (a.action === 'PROTEGER' || a.action === 'GUARDAR' || a.action === 'GUARDAR_COFRE')); }
function slot(id, raridade, dica) { return { id: id, raridade: raridade, dica: dica || '' }; }
function mochila(m, auto, slots, cap) { montarMochila(m, slots, cap); return auto.scanBag(true); }

export const suite = {
  nome: 'w5-itens',
  titulo: 'W5: componentes de receita, necessidades da base, intocaveis e parseNum',

  async run(t) {

    /* ===== W5.1 - TK-01-51 (P0): BASICO componente de receita NAO e vendido ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      // FIXTURE: o catalogo do stub Poe 1001 (Espada Longa) como FOLHA da receita do AD
      // (2007/2001/2004/... todos tem `de: ['1001']` ou `de: ['2002']` e 2002 tem `de: ['1001']`).
      const comp = [...w.auto.componentesDaBuild()];
      t.check('W5.1: fixture - 1001 e componente da build do AD', comp.indexOf('1001') >= 0);
      t.check('W5.1: fixture - 1005 (Adaga Inutil) NAO e componente', comp.indexOf('1005') < 0);

      // O BUG MEDIDO: com `componentesDaBuild()` a conter 1001, o `1001~C` saia
      // `VENDER_LOJISTA` com motivo "regra do dono: nunca se monta" — o actor vendia a
      // materia-prima e NENHUMA receita do Ornn arrancava (zero Adagas, ouro parado).
      const bag = mochila(w.m, w.auto, [slot('1001~C', 'basico')]);
      const acts = acoes(w.auto, bag);
      t.check('W5.1: basico COMPONENTE da build nao e vendido (TK-01-51)', eVendido(acts, '1001~C') === false);
      t.check('W5.1: ...fica guardado como materia-prima', acaoDe(acts, '1001~C') === 'GUARDAR');
      t.check('W5.1: ...e o motivo diz QUE e componente (nao "sem regra")',
        /componente da build/.test(String((act(acts, '1001~C') || {}).why || '')) === true);

      // CONTROLO obrigatorio (regra do dono): o basico que NAO serve a build continua a ir
      // ao Lojista — a excepcao nao pode transformar-se em "guarda tudo".
      const bag2 = mochila(w.m, w.auto, [slot('1005~C', 'basico')]);
      t.check('W5.1: CONTROLO - basico FORA da build vai ao Lojista', eVendido(acoes(w.auto, bag2), '1005~C') === true);

      // CONTROLO 2: o EXCEDENTE acima do tecto da receita continua vendivel (senao a mochila
      // nunca drena e o loot para).
      const muitos = [];
      for (let i = 0; i < 9; i++) muitos.push(slot('1001~C', 'basico'));
      const bag3 = mochila(w.m, w.auto, muitos);
      const acts3 = acoes(w.auto, bag3);
      const vendidos3 = acts3.filter((a) => a.it.id === '1001~C' && a.action === 'VENDER_LOJISTA').length;
      const guardados3 = acts3.filter((a) => a.it.id === '1001~C' && a.action === 'GUARDAR').length;
      t.check('W5.1: excedente acima do tecto da receita e vendido (a mochila drena)', vendidos3 > 0);
      t.check('W5.1: ...mas o tecto da receita fica guardado', guardados3 > 0 && vendidos3 + guardados3 === 9);

      // CONTROLO 3 (o ticket exige): lixo nunca fica preso por causa da excepcao.
      const bag4 = mochila(w.m, w.auto, [slot('1005~C', 'basico'), slot('1001~C', 'basico')]);
      const acts4 = acoes(w.auto, bag4);
      t.check('W5.1: lixo + componente na mesma mochila: o lixo sai', eVendido(acts4, '1005~C') === true);
      t.check('W5.1: ...e o componente fica', eVendido(acts4, '1001~C') === false);

      // CONTROLO 4: com a mochila ACIMA da capacidade o transbordo rebaixa o GUARDAR de basico
      // para VENDER_LOJISTA — a valvula que garante que a mochila esvazia e o loot nao para.
      const cheia = [];
      for (let i = 0; i < 30; i++) cheia.push(slot(i % 2 ? '1001~C' : '1005~C', 'basico'));
      const bag5 = mochila(w.m, w.auto, cheia, 30);
      const acts5 = acoes(w.auto, bag5);
      t.check('W5.1: mochila cheia (30/30) ainda vende (transbordo funciona)',
        acts5.filter((a) => a.action === 'VENDER_LOJISTA').length > 0);
      t.check('W5.1: ...e cada slot tem exactamente uma accao', acts5.length === 30);
    }

    /* ===== W5.2 - TK-02-01 (P0): EPICO -> Lojista SEM excepcao de componente ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      // 2002 (Lamina Epica) tem `de: ['1001']` e os lendarios da build do AD tem
      // `de: ['2002']` -> 2002 E EPICO *E* COMPONENTE da build. A regra do dono
      // ("item basico, epico, duplicado: vende no lojista. a nao ser q seja tier s mais")
      // manda-o ao Lojista NA MESMA — sem excepcao de componente (era exactamente a
      // condicao `!componentesDaBuild()` na linha 407/411 que prendia o epico em GUARDAR).
      t.check('W5.2: fixture - 2002 e epico E componente da build do AD',
        (CATALOGO.find((x) => x.id === '2002') || {}).raridade === 'epico'
        && [...w.auto.componentesDaBuild()].indexOf('2002') >= 0);
      // CONTROLO negativo: 4001 (Refugo Epico) NAO esta na cadeia da build, e tambem vai.
      t.check('W5.2: CONTROLO - epico fora da build (4001) tambem vai ao Lojista',
        (() => { const b = mochila(w.m, w.auto, [slot('4001~C', 'epico')]); return acaoDe(acoes(w.auto, b), '4001~C') === 'VENDER_LOJISTA'; })());
      const bag = mochila(w.m, w.auto, [slot('2002~C', 'epico')]);
      const acts = acoes(w.auto, bag);
      t.check('W5.2: epico-COMPONENTE vai ao Lojista (sem excepcao de componente)',
        acaoDe(acts, '2002~C') === 'VENDER_LOJISTA');
      // O sintoma do ticket era o motivo 'sem regra' -> GUARDAR. Nao pode voltar.
      t.check('W5.2: nunca sai com motivo "sem regra"',
        acts.every((a) => String(a.why || '').indexOf('sem regra') < 0));
      // Epico S+ continua no cofre (excepcao da regra do dono: "a nao ser q seja tier s mais").
      const bag2 = mochila(w.m, w.auto, [slot('4001~S', 'epico')]);
      t.check('W5.2: epico S+ continua guardado no cofre', acaoDe(acoes(w.auto, bag2), '4001~S') === 'GUARDAR_COFRE');
    }

    /* ===== W5.3 - TK-02-04 (P1): 3031 e 3089 intocaveis, DUPLICADO incluido ===== */
    {
      // O 3031 (Gume do Infinito) NAO existe no catalogo do stub: acrescenta-se como o teste T6
      // faz (catalogo tardio), para a assercao correr contra a tabela PRIORIDADE_EXTREMA real.
      const NOVO = [
        { id: '3031', nome: 'Gume do Infinito', raridade: 'lendario', espaco: 'arma', critico: 0.4, preco: 3400, de: ['1001'] },
        { id: '9501', nome: 'Lendario Comum', raridade: 'lendario', espaco: 'arma', ad: 100, preco: 2900, de: ['1001'] },
      ];
      for (const champ of ['adtest', 'aptest']) {
        const w = novoMundo();
        alimentarCatalogo(w.m, CATALOGO.concat(NOVO));
        definirCampeao(w.m, champ);
        // DUPLICADO de 3031 e de 3089: nenhum dos dois pode ser vendido nem anunciado.
        const bag = mochila(w.m, w.auto, [
          slot('3031~C', 'lendario'), slot('3031~C', 'lendario'),
          slot('3089~C', 'lendario'), slot('3089~C', 'lendario'),
        ]);
        const acts = acoes(w.auto, bag);
        for (const id of ['3031~C', '3089~C']) {
          t.check('W5.3 (' + champ + '): ' + id + ' nunca e vendido', eVendido(acts, id) === false);
          t.check('W5.3 (' + champ + '): ' + id + ' nunca e anunciado', eAnunciado(acts, id) === false);
          t.check('W5.3 (' + champ + '): ' + id + ' fica protegido/guardado', eProtegido(acts, id) === true);
        }
        const n3031 = acts.filter((a) => a.it.id === '3031~C' && eProtegido(acts, a.it.id)).length;
        t.check('W5.3 (' + champ + '): as DUAS copias do 3031 ficam (duplicado incluido)', n3031 === 2);
        // CONTROLO na MESMA execucao: duplicado de item COMUM continua a ser tratado.
        const bag2 = mochila(w.m, w.auto, [slot('9501~C', 'lendario'), slot('9501~C', 'lendario')]);
        const acts2 = acoes(w.auto, bag2);
        t.check('W5.3 (' + champ + '): CONTROLO - duplicado de lendario comum sai da mochila',
          acts2.filter((a) => a.it.id === '9501~C' && (a.action === 'VENDER_LOJISTA' || a.action === 'ANUNCIAR_MERCADO')).length > 0);
        // A guarda e POR CLASSE sem excepcoes: o 3031 e multiplicador de AD e o 3089 de AP, mas
        // os dois ficam intocaveis nos DOIS campeoes (a extensao nao sabe se o dono troca de boneco).
        t.check('W5.3 (' + champ + '): ehPrioridadeExtrema(3031) === true', w.auto.ehPrioridadeExtrema('3031') === true);
        t.check('W5.3 (' + champ + '): ehPrioridadeExtrema(3089) === true', w.auto.ehPrioridadeExtrema('3089') === true);
      }
    }

    /* ===== W5.4 - TK-02-07 (P1): lendario UNICO da classe do campeao ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'aptest');
      // 3001 (Lendario AP 1) e lendario da build da classe AP; 2001 e da classe AD.
      t.check('W5.4: fixture - 3001 e lendario da build do AP', w.auto.ehLendarioDaBuild('3001') === true);
      t.check('W5.4: fixture - 2001 NAO e lendario da build do AP', w.auto.ehLendarioDaBuild('2001') === false);
      const bag = mochila(w.m, w.auto, [slot('3001~C', 'lendario')]);
      const acts = acoes(w.auto, bag);
      t.check('W5.4: lendario UNICO da classe -> PROTEGER', acaoDe(acts, '3001~C') === 'PROTEGER');
      t.check('W5.4: lendario UNICO da classe nunca e vendido', eVendido(acts, '3001~C') === false);
      t.check('W5.4: lendario UNICO da classe nunca e anunciado', eAnunciado(acts, '3001~C') === false);
      t.check('W5.4: o motivo nomeia a classe (nao uma tabela fixa)',
        /LENDÁRIO DA BUILD DA CLASSE/.test(String((act(acts, '3001~C') || {}).why || '')) === true);

      // O criterio e a CLASSE LIDA DO JOGO, nao uma tabela fixa: o MESMO item no campeao
      // errado nao entra na build (e portanto nao e blindado por este motivo).
      definirCampeao(w.m, 'adtest');
      const bag2 = mochila(w.m, w.auto, [slot('3001~C', 'lendario')]);
      const acts2 = acoes(w.auto, bag2);
      t.check('W5.4: CONTROLO - o mesmo lendario noutra classe nao e blindado por build',
        w.auto.ehLendarioDaBuild('3001') === false);
      t.check('W5.4: ...e por isso sai da mochila (mercado ou Lojista)',
        eVendido(acts2, '3001~C') === true || eAnunciado(acts2, '3001~C') === true);

      // O teste do ticket: "lendario unico da classe e duplicado de lendario de outra classe
      // dao resultados DIFERENTES" — na mesma mochila, ao mesmo tempo.
      definirCampeao(w.m, 'aptest');
      const bag3 = mochila(w.m, w.auto, [slot('3001~C', 'lendario'), slot('2001~C', 'lendario'), slot('2001~C', 'lendario')]);
      const acts3 = acoes(w.auto, bag3);
      t.check('W5.4: na mesma mochila, o da classe fica', acaoDe(acts3, '3001~C') === 'PROTEGER');
      t.check('W5.4: ...e o da outra classe sai', eVendido(acts3, '2001~C') === true || eAnunciado(acts3, '2001~C') === true);
    }

    /* ===== W5.5 - TK-01-68 (P0): necessidades que nunca fechavam ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const auto = w.auto;

      // Sem DOM de HUD (banco de testes) o `readGold` da NaN e o `readEquip` da vazio. O que se
      // exige e que a funcao de reachability NAO deite excepcao e DEVOLVA false (nunca true).
      const r = auto.compraAlcancavel ? auto.compraAlcancavel() : { alguma: 'SEM FUNCAO' };
      t.check('W5.5: compraAlcancavel() existe e nao deita excepcao', typeof r === 'object' && r !== null);
      t.check('W5.5: sem ouro nem itens, nao ha compra alcancavel (n.comprar fecha)', r.alguma === false);

      // `necessidadesBase()` corre no mundo stubado e devolve o mapa completo.
      let n = null;
      try { n = auto.necessidadesBase(); } catch (e) { n = { erro: String(e) }; }
      t.check('W5.5: necessidadesBase() nao deita excepcao', !!(n && !n.erro));
      if (n && !n.erro) {
        t.check('W5.5: n.comprar NAO e true eterno (TK-01-68)', n.comprar === false);
        t.check('W5.5: n.comprar traz o diagnostico do porque', !!(n._comprar && n._comprar.motivo));
        t.check('W5.5: n.equip nao e true eterno', n.equip === false);
        t.check('W5.5: n.equip traz o diagnostico do porque', !!(n._equip && n._equip.motivo));
        // As duas necessidades passam pelo backoff como as outras (o laco de
        // \`estaIndisponivel\` corre sobre TODAS as chaves, e \`comprar\`/`equip` estao la).
        const chaves = Object.keys(n).filter((k) => n[k] === true);
        t.check('W5.5: n.comprar e n.equip nao estao entre as necessidades presas',
          chaves.indexOf('comprar') < 0 && chaves.indexOf('equip') < 0);
        // REGRESSAO POSITIVA: com ouro e um item da build em falta e ACESSIVEL, a necessidade
        // volta a acender — a correccao nao pode ser "deixar sempre falso".
        try {
          w.m.montar('#st-ouro', [w.m.el({ label: 'ouro', textContent: '1.5M' })]);
          const n2 = auto.necessidadesBase();
          t.check('W5.5: com ouro, a necessidade comprar volta a acender (nao ficou sempre falsa)',
            n2.comprar === true || (n2._comprar && n2._comprar.alcancaveis > 0));
        } catch (e) { t.check('W5.5: cenario positivo correu sem excepcao (' + String(e) + ')', false); }
      }
    }

    /* ===== W5.7 - TK-01-45: receita do Ornn escolhida POR DADO (custo esperado) ===== */
    {
      const w = novoMundo();
      const f = w.auto.escolherReceitaOrnn;
      t.check('W5.7: escolherReceitaOrnn existe (funcao pura, testavel)', typeof f === 'function');
      if (typeof f === 'function') {
        // 3 receitas que SERVEM a build, com componentes, e custos diferentes.
        // custo esperado = ouro/tentativa x tentativasMedias.
        const recs = [
          { id: '3006', nome: 'Grevas do Berserker', ouro: '49.077', tentativasMedias: '61', pode: true },
          { id: '3086', nome: 'Zelo', ouro: '57.257', tentativasMedias: '61', pode: true },
          { id: '3144', nome: 'Estilingue', ouro: '16.358', tentativasMedias: '30', pode: true },
        ];
        const ideal = ['3006', '3086', '3144'];
        const comps = new Set(['3006', '3086', '3144']);
        const ordem = f(recs, ideal, comps, 5000000).map((r) => r.id);
        t.check('W5.7: com 3 receitas serve-build, a escolhida e a de MENOR custo esperado',
          ordem[0] === '3144');
        t.check('W5.7: o custo esperado e ouro x tentativas (nao o ouro da receita)',
          f(recs, ideal, comps, 5e6)[0].custo === 16358 * 30);
        t.check('W5.7: ...e a mais caro fica em ultimo', ordem[ordem.length - 1] === '3086');
        // Sem componentes nao serve (a bancada vazia nao monta nada).
        const semComp = f(recs.map((r) => ({ ...r, pode: false })), ideal, comps, 5e6);
        t.check('W5.7: receita sem componentes na mochila nao entra', semComp.length === 0);
        // Receita que NAO serve a build nao entra, mesmo com componentes.
        const foraDaBuild = f([{ id: '9999', nome: 'Fora', ouro: '1.000', tentativasMedias: '1', pode: true }], ideal, comps, 5e6);
        t.check('W5.7: receita fora da build nao entra', foraDaBuild.length === 0);
        // Teto de ouro: o que nao cabe fica de fora. 3144 custa 16.358 x 30 = 490.740;
        // com tecto de 500.000 so ele cabe (3006 = 2.993.697 e 3086 = 3.492.677 ficam fora).
        const apertado = f(recs, ideal, comps, 500000);
        t.check('W5.7: respeita o teto de ouro da reserva', apertado.length === 1 && apertado[0].id === '3144');
        // E com tecto abaixo do custo da MAIS BARATA, nao monta nada (melhor guardar o ouro).
        const semTeto = f(recs, ideal, comps, 400000);
        t.check('W5.7: sem tecto para a mais barata, nao ha escolha', semTeto.length === 0);
        // O ouro da bancada tambem passa pelo fmt do jogo (k/M, cena.js:225).
        const comSufixo = f([{ id: '3006', nome: 'Grevas', ouro: '49.1k', tentativasMedias: '61', pode: true }], ideal, comps, 5e6);
        t.check('W5.7: o ouro com sufixo k/M e lido certo (49.1k -> 49100)',
          comSufixo.length === 1 && comSufixo[0].ouro === 49100);
      }
    }

    /* ===== W5.8 - TK-01-27: refinar o ESSENCIAL da build, com limite de risco ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);          // a escolha le META.itens (raridade do item)
      definirCampeao(w.m, 'adtest');
      const f = w.auto.escolherRefinoAlvo;
      t.check('W5.8: escolherRefinoAlvo existe (funcao pura, testavel)', typeof f === 'function');
      const vale = w.auto.valeRefino;
      t.check('W5.8: valeRefino existe', typeof vale === 'function');
      if (typeof f !== 'function' || typeof vale !== 'function') return;

      // RISCO LIDO DO MOTOR (motor.js:67 e :69): +1/+2 nunca rebaixam; +3 rebaixa 4%.
      t.check('W5.8: +1 nunca rebaixa (regressao 0, motor.js:69)', vale(0, 2, false).ok === true);
      t.check('W5.8: +2 nunca rebaixa (regressao 0, motor.js:69)', vale(1, 2, false).ok === true);
      t.check('W5.8: +3 rebaixa 4% -> so passa com refinoArriscado ligado',
        vale(2, 3, false).ok === false && vale(2, 3, true).ok === true);
      t.check('W5.8: +4 (chance 0,8%) abaixo do minimo de 2% -> recusado',
        vale(3, 5, true).ok === false);
      t.check('W5.8: acima do teto nao tenta', vale(2, 2, true).ok === false);

      // CENARIO DO TICKET: 3 itens refinaveis; so o ESSENCIAL da build e escolhido.
      const equip = [
        { base: '9500', qual: 'A', refino: 0 },   // lendario A+, NAO essencial
        { base: '2001', qual: 'S', refino: 1 },   // ESSENCIAL (build AD), lendario S+
        { base: '4001', qual: 'A', refino: 0 },    // EPICO, nunca se refina
        { base: '1005', qual: 'S', refino: 0 },    // BASICO, nunca se refina
        { base: '3089', qual: 'A', refino: 0 },    // Rabadon: excluido de proposito
      ];
      const essenciais = ['2001', '2004', '2005', '2006', '2007'];
      const r = f(equip, essenciais, 2, false);
      t.check('W5.8: com 3 itens refinaveis, o escolhido e o ESSENCIAL da build', r.base === '2001');
      t.check('W5.8: ...e o motivo diz que e essencial', /essencial da build/.test(String(r.porquê)) === true);
      t.check('W5.8: epico/basico nunca sao alvo de refino',
        f(equip.filter((e) => ['4001', '1005'].indexOf(e.base) >= 0), essenciais, 2, false).base === null);
      t.check('W5.8: sem essencial na mochila, nenhum alvo',
        f([{ base: '9500', qual: 'A', refino: 0 }], essenciais, 2, false).base === null);
      // Ja no teto (+2) -> nao escolhe (parar no seguro).
      t.check('W5.8: essencial ja no teto +2 nao e escolhido',
        f([{ base: '2001', qual: 'A', refino: 2 }], essenciais, 2, false).base === null);
      // O mais atrasado (menos refino) sai primeiro.
      const dois = f([{ base: '2001', qual: 'A', refino: 1 }, { base: '2004', qual: 'A', refino: 0 }], essenciais, 2, false);
      t.check('W5.8: entre dois essenciais, o mais atrasado (+0) vem primeiro', dois.base === '2004');
    }
    /* ===== W5.9 - TK-01-39: a cadeia completa receitas -> escolha -> montar -> contabilidade ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      w.m.montar('#st-ouro', [w.m.el({ label: 'ouro', textContent: '1.5M' })]);
      const auto = w.auto;

      // (0) CONTROLO DO CENARIO: fora da Fonte a montagem tem de RECUSAR (o `naBase()` do
      // automation.js:6232 exige /fonte/i no #local-nome). Prova que o cenario seguinte
      // realmente passa pelo porteiro da base, e nao que o teste corre as cegas.
      const semBase = await auto.montarItem('2001', 10, 'arcana');
      t.check('W5.9: fora da Fonte a montagem recusa (controlo)',
        semBase.ok === false && /Fonte/.test(String(semBase.motivo || '')));

      // Agora sim: o boneco esta na base.
      montarLocal(w.m, 'Fonte — praca');
      // Uma mochila com um componente da receita (o `temAgora` da montagem conta o que ha la).
      montarMochila(w.m, [{ id: '1001~C', raridade: 'basico' }]);

      // Bancada com 3 receitas que servem a build DO CAMPEAO (a build do AD no catalogo do
      // stub e [2007,2001,2004,2005,2006] e os componentes sao 1001 e 2002), com componentes
      // presentes e custos diferentes. custo = ouro x tentativasMedias:
      //   2001: 3000 x 10 = 30.000 · 2004: 3000 x 61 = 183.000 · 2005: 3000 x 200 = 600.000
      montarOrnn(w.m, [
        { id: '2001', nome: 'Lendario AD 1', ouro: '3.000', chance: '8%', tentativasMedias: 10,
          comps: [{ nome: 'Espada Longa', tem: true }, { nome: 'Lamina Epica', tem: true }] },
        { id: '2004', nome: 'Lendario AD 2', ouro: '3.000', chance: '1,2%', tentativasMedias: 61,
          comps: [{ nome: 'Espada Longa', tem: true }] },
        { id: '2005', nome: 'Lendario AD 3', ouro: '3.000', chance: '0,4%', tentativasMedias: 200,
          comps: [{ nome: 'Espada Longa', tem: true }] },
      ], 2);

      // (1) LEITURA: receitasOrnn le a bancada (medido ao vivo: 40 receitas, custo zero).
      const rec = await auto.receitasOrnn();
      t.check('W5.9: receitasOrnn() le a bancada', rec.ok === true && rec.receitas.length === 3);
      t.check('W5.9: ...e marca quais tem componentes na mochila',
        rec.receitas.filter((r) => r.pode).length === 3);

      // (2) ESCOLHA: a mais barata que serve a build e tem componentes (2001 = 30.000).
      const cands = auto.escolherReceitaOrnn(rec.receitas, auto.buildDaClasse(), auto.componentesDaBuild(), 1480000);
      t.check('W5.9: a escolhida e a de menor custo esperado (2001)', cands.length > 0 && cands[0].id === '2001');
      t.check('W5.9: ...com o custo esperado = ouro x tentativas', cands[0].custo === 3000 * 10);
      t.check('W5.9: ...e as outras duas ficam ordenadas atras', cands.length === 3 && cands[1].id === '2004' && cands[2].id === '2005');

      // (3) MONTAGEM: montarItem corre na bancada e devolve a contabilidade.
      const antes = auto.readGold();
      const res = await auto.montarItem('2001', 100, 'arcana');
      t.check('W5.9: montarItem() correu na bancada', res.ok === true);
      t.check('W5.9: ...e devolve vezesUsadas (o lote clicado)', Number(res.vezesUsadas) === 100);
      t.check('W5.9: ...e devolve ouroAntes/ouroDepois', res.ouroAntes === antes && res.ouroDepois === antes);
      t.check('W5.9: ...e devolve temAgora (itens na mochila)', typeof res.temAgora === 'number');
      t.check('W5.9: os cliques foram na receita certa e no lote pedido',
        w.m.cliqueDe('receita:2001') && w.m.cliqueDe('montar:2001:100'));

      // (4) A CADEIA COMPLETA: escolherReceitaOrnn -> montarMelhorReceita -> montarItem.
      const r2 = await auto.montarMelhorReceita();
      t.check('W5.9: montarMelhorReceita() fecha o ciclo escolha->montar', r2.ok === true);
      t.check('W5.9: ...e devolve a contabilidade para o log', r2.vezesUsadas != null && r2.ouroGasto != null && r2.temAgora != null);
      t.check('W5.9: ...e o alvo foi o de menor custo', String(r2.alvo) === '2001');

      // (5) PARAR EM FALHA: bancada sem pecas que sirvam -> nao monta, com motivo.
      montarOrnn(w.m, [{ id: '2001', nome: 'Lendario AD 1', ouro: '3.000', tentativasMedias: 10, comps: [{ nome: 'Espada Longa', tem: false }] }], 2);
      const r3 = await auto.montarMelhorReceita();
      t.check('W5.9: sem componentes a montagem nao corre (para, nao insiste)',
        r3.ok === true && /nada montavel/.test(String(r3.motivo || '')));
    }


    /* ===== W5.10 - TK-01-40 (lado do codigo): a escada lendaria e guiada por DADO ===== */
    {
      const w = novoMundo();
      alimentarCatalogo(w.m);
      definirCampeao(w.m, 'adtest');
      const auto = w.auto;
      // Um slot com um BASICO fraco equipado: a build da classe AD pede lendarios.
      w.m.montar('#equip > button.slot[data-id]', [
        w.m.el({ tag: 'button', label: 'eq0', className: 'slot basico', attrs: { 'data-id': '1005~C' } }),
      ]);

      // (a) O objectivo (a build ideal) e LIDO do campeao, nao uma lista fixa.
      const ideal = auto.buildDaClasse();
      t.check('W5.10: a build ideal da classe tem 5 pecas (a escada)', ideal.length === 5);

      // (b) O "alvo de 4 fontes" diz de ONDE vem cada peca (equipado/mochila/mercado/cofre)
      //     e o que FALTA — e isso que guia `buscar` (cofre) e `comprar` (mercado).
      montarMochila(w.m, [{ id: '2001~C', raridade: 'lendario' }]);
      const q = auto.alvoQuatroFontes(null);
      t.check('W5.10: a peca da mochila entra no alvo com a fonte certa',
        (q.alvoTotal || []).some((i) => i.base === '2001' && i.fonte === 'mochila'));
      t.check('W5.10: o que nao existe em lado nenhum fica em faltamTotal',
        (q.faltamTotal || []).length > 0 && (q.faltamTotal || []).every((f) => f.nome));

      // (c) CONSISTENCIA planeador <-> actor (a regra do comentario automation.js:275-282): o que
      //     o actor vai vestir tem de estar no alvo, e o `planBag` nao pode manda-lo vender.
      const bag = auto.scanBag(true);
      const pl = auto.planoEquipar(bag);
      t.check('W5.10: o actor quer vestir o que esta na mochila (planoEquipar mexe)', pl.mexe === true);
      const naoVende = auto.planBag(bag).acts.filter((a) => a.action === 'VENDER_LOJISTA' && pl.bases.has(String(a.it.base)));
      t.check('W5.10: o planeador NAO vende o que o actor vai vestir (sem ping-pong)', naoVende.length === 0);
      t.check('W5.10: a necessidade equip acende (ha troca real a fazer)', auto.necessidadesBase().equip === true);

      // (d) CONTROLO: um EPICO na mochila com um basico no slot tem de sair EQUIPAR (regra do dono:
      //     "um epico equipavel NUNCA pode ficar na mochila com um basico equipado").
      montarMochila(w.m, [{ id: '2002~C', raridade: 'epico' }]);
      const bag2 = auto.scanBag(true);
      const eq = auto.planBag(bag2).acts.filter((a) => a.action === 'EQUIPAR').map((a) => a.it.id);
      t.check('W5.10: epico com basico no slot -> EQUIPAR', eq.indexOf('2002~C') >= 0);
    }

    /* ===== W5.6 - parseNum: o sufixo k/M do fmt do jogo (cena.js:225) ===== */
    {
      const w = novoMundo();
      const p = w.auto.parseNum;
      t.check('W5.6: parseNum existe', typeof p === 'function');
      // Casos EXACTOS pedidos pelo Lead (o bug corrompia em silencio acima de 10 000).
      const casos = [
        ['12.3k', 'k', 12300], ['20.4k', 'k', 20400], ['9.876', null, 9876],
        ['12.3M', 'M', 12300000], ['1.2M', 'M', 1200000],
        ['4.188', null, 4188],          // grupo de 3 = MILHAR em pt-BR
        ['1.234.567', null, 1234567],   // milhar com separador
        ['350', null, 350],             // inteiro: comportamento identico ao antigo
        ['0', null, 0], ['', null, NaN],
      ];
      for (const [txt, suf, esp] of casos) {
        const v = p(txt, suf);
        t.check('W5.6: parseNum("' + txt + '", ' + JSON.stringify(suf) + ') === ' + esp,
          Number.isNaN(esp) ? Number.isNaN(v) : v === esp);
      }
      // O sufixo tambem tem de ser reconhecido quando vem no grupo da regex (o `fmt` nao mete espaco).
      t.check('W5.6: sufixo no grupo ("12.3" + "k") da 12300', p('12.3', 'k') === 12300);
      // parseBig (precos do MERCADO/recompensas): o MESMO defeito, o MESMO conserto.
      const big = w.auto.parseBig;
      t.check('W5.6: parseBig existe', typeof big === 'function');
      if (typeof big === 'function') {
        t.check('W5.6: parseBig("4.188 ouro") = 4188 (grupo de 3 = milhar)', big('4.188 ouro') === 4188);
        t.check('W5.6: parseBig("12.3k ouro") = 12300', big('12.3k ouro') === 12300);
        t.check('W5.6: parseBig("12,3k") = 12300 (decimal com virgula)', big('12,3k') === 12300);
        t.check('W5.6: parseBig("1.234.567") = 1234567', big('1.234.567') === 1234567);
        t.check('W5.6: parseBig("1.2M") = 1200000', big('1.2M') === 1200000);
        t.check('W5.6: parseBig("350.000") = 350000 (preco real do 3172)', big('350.000') === 350000);
        t.check('W5.6: parseBig sem numero devolve null', big('sem preço') === null);
        // O CASO REAL (precos MEDIDOS ao vivo no mercado do jogo, parte-01.md L1748-1749):
        // "3172 = 350.000 / 3085 = 180.000". Com o `parseFloat` antigo davam 350 e 180 — e o
        // `comprarNoMercado` comparava o preco contra um valor 1000x menor.
        const rePreco = /([\d.,]+\s*[kKmM]?)\s*ouro/i;
        const m1 = 'Gume do Infinito [S] 350.000 ouro'.match(rePreco);
        const m2 = 'Eco de Luden [A] 180.000 ouro'.match(rePreco);
        t.check('W5.6: mercado real "350.000 ouro" = 350000 (era 350)', big(m1[1]) === 350000);
        t.check('W5.6: mercado real "180.000 ouro" = 180000 (era 180)', big(m2[1]) === 180000);
      }
      // REGRESSAO: sem sufixo, o parser novo tem de dar o MESMO que o antigo dava.
      t.check('W5.6: regressao - inteiro simples inalterado', p('318') === 318);
      t.check('W5.6: regressao - texto sem numero da NaN', Number.isNaN(p('lendario')));
    }
  },
};
