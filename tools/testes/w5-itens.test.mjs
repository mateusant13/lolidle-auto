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
  montarMochila,
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
      // REGRESSAO: sem sufixo, o parser novo tem de dar o MESMO que o antigo dava.
      t.check('W5.6: regressao - inteiro simples inalterado', p('318') === 318);
      t.check('W5.6: regressao - texto sem numero da NaN', Number.isNaN(p('lendario')));
    }
  },
};
