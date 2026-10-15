/*
<<<<<<< HEAD
 * numeros.test.mjs - LEITURA DE NÚMEROS do jogo (ordem do Lead, 2026-10-14 22:01).
 *
 * MOTIVO: o automation.js:201 tinha o MESMO bug que o content.js tinha — o parser
 * apagava o sufixo k/M que o \`fmt\` do jogo (docs/game-src/cena.js:225) mete nos
 * números do HUD. "12.3k" virava 123, "1.2M" virava 12 e "4.188" (milhar pt-BR)
 * virava 4188 ou 4.188 conforme o caminho — ouro, poções, stats e tooltips lidos
 * errados EM SILÊNCIO acima de 10.000.
 *
 * REGRA (provada no content.js:83-100): SUFIXO {k:1e3, m:1e6}; o sufixo entra nos
 * GRUPOS do regex; grupo de 3 casas ("4.188") = MILHAR; com sufixo ("12.3k") = decimal.
 * Com inteiros, o comportamento é IDÊNTICO (sem regressão).
=======
 * numeros.test.mjs - LEITURA DE NUMEROS: o sufixo k/M do `fmt` do JOGO (achado do Lead, 22:01).
 *
 * DEFEITO (o MESMO que o content.js tinha, provado la):
 *   automation.js:201 `parseNum` fazia `String(s).replace(/[^\d]/g,'')` — APAGAVA o sufixo.
 *   O `fmt` do jogo (docs/game-src/cena.js:225) escreve:
 *     n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e4 ? (n/1e3).toFixed(1)+'k' : Math.round(n)
 *   e e ESSE `fmt` que escreve `#hud-vida-txt` (`${fmt(vida)} / ${fmt(a.vida)}`, jogo.js:6203),
 *   os textos de loot e o painel de stats. Logo, acima de 10 000, o jogo era lido errado
 *   EM SILENCIO: "12.3k" -> 123, "1.2M" -> 12, e o par de vida "9.876 / 12.3k" dava max = 12.
 *
 * O QUE ESTE BANCO PROVA (os tres casos que o Lead exigiu):
 *   "12.3k / 20.4k" -> {cur:12300, max:20400}
 *   "9.876 / 12.3k" -> max 12300   (antes 123)
 *   "1.2M"          -> 1200000
 * e que, com INTEIROS, o comportamento e IDENTICO ao de antes (sem regressao).
>>>>>>> w4-fuga
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

<<<<<<< HEAD
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'numeros',
  titulo: 'Leitura de números do jogo (sufixo k/M do fmt, cena.js:225)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');

    /* ---- M1 - os três casos que o Lead exigiu ---- */
    // "12.3k / 20.4k" -> {cur:12300, max:20400}
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida', textContent: '12.3k / 20.4k' })]);
    let p = auto.player();
    t.check('M1: "12.3k / 20.4k" -> vida máxima 20400 (antes 204)', p.vida === 20400);
    // "9.876 / 12.3k" -> max 12300 (antes 123)
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida', textContent: '9.876 / 12.3k' })]);
    p = auto.player();
    t.check('M1: "9.876 / 12.3k" -> vida máxima 12300 (antes 123)', p.vida === 12300);
    // "1.2M" -> 1200000
    m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '1.2M' })]);
    t.check('M1: ouro "1.2M" -> 1200000 (antes 12)', auto.readGold() === 1200000);

    /* ---- M2 - ouros e poções com sufixo e com milhar ---- */
    m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '12.3k' })]);
    t.check('M2: ouro "12.3k" -> 12300 (antes 123)', auto.readGold() === 12300);
    m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '4.188' })]);
    t.check('M2: ouro "4.188" (milhar pt-BR) -> 4188', auto.readGold() === 4188);
    m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '52.300' })]);
    t.check('M2: ouro "52.300" -> 52300', auto.readGold() === 52300);

    /* ---- M3 - stats do painel (.st vem do fmt, jogo.js:6454-6460) ---- */
    m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida', textContent: '3.000 / 4.188' })]);
    m.montar('.st', [
      m.el({ label: 'st-dano', textContent: 'Dano 12.3k' }),
      m.el({ label: 'st-poder', textContent: 'Poder 1.2M' }),
      m.el({ label: 'st-arm', textContent: 'Armadura 1.234' }),
      m.el({ label: 'st-va', textContent: 'Vel. ataque 1,58' }),
    ]);
    const s = auto.readStats();
    t.check('M3: "Dano 12.3k" -> 12300 (antes 12.3 — o DPS inteiro trabalhava com isso)', s['Dano'] === 12300);
    t.check('M3: "Poder 1.2M" -> 1200000', s['Poder'] === 1200000);
    t.check('M3: "Armadura 1.234" (milhar) -> 1234', s['Armadura'] === 1234);
    t.check('M3: "Vel. ataque 1,58" (decimal pt-BR) -> 1.58', Math.abs(s['Vel. ataque'] - 1.58) < 1e-9);

    /* ---- M4 - SEM REGRESSÃO: inteiros continuam iguais ---- */
    m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '52300' })]);
    t.check('M4: ouro inteiro "52300" -> 52300 (sem regressão)', auto.readGold() === 52300);
    m.montar('#st-ouro', [m.el({ label: 'st-ouro', textContent: '0' })]);
    t.check('M4: ouro "0" -> 0', auto.readGold() === 0);
    m.montar('.st', [
      m.el({ label: 'st-dano', textContent: 'Dano 4188' }),
      m.el({ label: 'st-arm', textContent: 'Armadura 78' }),
    ]);
    const s2 = auto.readStats();
    t.check('M4: "Dano 4188" -> 4188 (sem regressão)', s2['Dano'] === 4188);
    t.check('M4: "Armadura 78" -> 78 (sem regressão)', s2['Armadura'] === 78);
    m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida', textContent: '1234 / 5678' })]);
    t.check('M4: "1234 / 5678" -> vida máxima 5678 (sem regressão)', auto.player().vida === 5678);
    t.check('M4: vida máxima veio do texto (não do fallback 4188)', auto.player().vida !== 4188);

    /* ---- M5 - tooltips de itens (data-dica): o sufixo tem de entrar no grupo ---- */
    const dica = auto.parseDica('+12.3k dano de ataque, +1.2M vida, +2.5k poder de habilidade, +18% roubo de vida');
    t.check('M5: tooltip "+12.3k dano de ataque" -> 12300 (antes nem casava)', dica.ad === 12300);
    t.check('M5: tooltip "+1.2M vida" -> 1200000', dica.vida === 1200000);
    t.check('M5: tooltip "+2.5k poder de habilidade" -> 2500', dica.ap === 2500);
    const dica2 = auto.parseDica('+5.625 de ouro no Lojista, +45 armadura, +30 res. mágica');
    t.check('M5: tooltip "+5.625" (milhar) -> 5625', dica2.vida === 0);   // controlo: "ouro" não é stat
    t.check('M5: tooltip "+45 armadura" -> 45', dica2.armadura === 45);
    const dica3 = auto.parseDica('+120 poder de habilidade, +90 dano de ataque');
    t.check('M5: tooltip inteiro "+120 poder" -> 120 (sem regressão)', dica3.ap === 120);
    t.check('M5: tooltip inteiro "+90 dano" -> 90 (sem regressão)', dica3.ad === 90);
=======
import { criarMundo, carregarAutomation } from './dom-stub.mjs';

const montarVida = (m, txt) => m.montar('#hud-vida-txt', [m.el({ tag: 'span', label: 'vida', textContent: txt })]);
const montarStat = (m, rotulo, txt) => m.montar('.st', [m.el({ tag: 'div', label: 'st', textContent: rotulo + ' ' + txt })]);
const montarNivel = (m, n) => { m.montar('#hud-nivel', [m.el({ tag: 'span', label: 'nivel', textContent: String(n) })]); };

export const suite = {
  nome: 'numeros',
  titulo: 'Leitura de numeros (sufixo k/M do fmt do jogo: cena.js:225)',

  async run(t) {

    /* ============ N1 - parseNum: o sufixo entra na conta ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      const pn = auto.parseNum;
      t.check('N1: parseNum existe e foi exportado para o banco poder prova-lo', typeof pn === 'function');

      /* -- os tres casos exigidos pelo Lead -- */
      t.check('N1: "12.3k" -> 12300 (antes 123)', pn('12.3k') === 12300);
      t.check('N1: "1.2M" -> 1200000 (antes 12)', pn('1.2M') === 1200000);
      t.check('N1: "20.4k" -> 20400', pn('20.4k') === 20400);

      /* -- inteiros: identificicos ao parser antigo (sem regressao) -- */
      t.check('N1: "8" -> 8 (inteiro, igual ao antigo)', pn('8') === 8);
      t.check('N1: "0" -> 0', pn('0') === 0);
      t.check('N1: "12345" -> 12345', pn('12345') === 12345);

      /* -- grupo de 3 casas = MILHAR em pt-BR ("4.188" nao e 4,188) -- */
      t.check('N1: "4.188" -> 4188 (grupo de 3 = milhar, nao decimal)', pn('4.188') === 4188);
      t.check('N1: "9.876" -> 9876', pn('9.876') === 9876);
      t.check('N1: "1.234.567" -> 1234567', pn('1.234.567') === 1234567);

      /* -- com sufixo, uma casa = DECIMAL (o fmt da 1 casa: cena.js:225) -- */
      t.check('N1: "12.3" (sem sufixo) -> 12.3 (decimal, nao 123)', pn('12.3') === 12.3);
      t.check('N1: "12,3k" (virgula) -> 12300', pn('12,3k') === 12300);

      /* -- entradas que tem de continuar a dar NaN (nunca zero fingido) -- */
      t.check('N1: string vazia -> NaN (nao 0)', Number.isNaN(pn('')));
      t.check('N1: null -> NaN', Number.isNaN(pn(null)));
      t.check('N1: texto sem numero -> NaN', Number.isNaN(pn('sem numero')));
    }

    /* ============ N2 - o PAR de vida do HUD: sufixo nos GRUPOS da regex ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarNivel(m, 29);

      montarVida(m, '12.3k / 20.4k');
      let p = auto.player();
      t.check('N2: "12.3k / 20.4k" -> vida (max) 20400', p.vida === 20400);
      t.check('N2: "12.3k / 20.4k" -> vidaAtual (cur) 12300', p.vidaAtual === 12300);

      montarVida(m, '9.876 / 12.3k');
      p = auto.player();
      t.check('N2: "9.876 / 12.3k" -> max 12300 (ANTES dava 123 — o defeito)', p.vida === 12300);
      t.check('N2: "9.876 / 12.3k" -> cur 9876', p.vidaAtual === 9876);

      /* controlo: abaixo de 10 000 nada muda (o parser antigo acertava aqui) */
      montarVida(m, '1.684 / 2.452');
      p = auto.player();
      t.check('N2: CONTROLO inteiro "1.684 / 2.452" -> max 2452 (sem regressao)', p.vida === 2452);
      t.check('N2: CONTROLO inteiro "1.684 / 2.452" -> cur 1684', p.vidaAtual === 1684);

      /* milhao */
      montarVida(m, '1.1M / 1.2M');
      p = auto.player();
      t.check('N2: "1.1M / 1.2M" -> max 1200000', p.vida === 1200000);
      t.check('N2: "1.1M / 1.2M" -> cur 1100000', p.vidaAtual === 1100000);

      /* sem HUD: o fallback antigo continua la (nada inventado) */
      montarVida(m, '');
      p = auto.player();
      t.check('N2: HUD vazio -> fallback 4188 (nao zero, nao NaN)', p.vida === 4188 && p.vidaAtual === null);
    }

    /* ============ N3 - o painel de stats tambem passa pelo fmt ============ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      montarNivel(m, 29);
      montarStat(m, 'Dano', '12.3k');
      const p = auto.player();
      t.check('N3: "Dano 12.3k" -> dano 12300 (antes 12,3)', p.dano === 12300);
      montarStat(m, 'Armadura', '4.188');
      const p2 = auto.player();
      t.check('N3: CONTROLO "Armadura 4.188" -> 4188 (grupo de 3 = milhar)', p2.armadura === 4188);
    }

    /* ============ N4 - o TEXTO DE LOOT: o sufixo entra no grupo ============ */
    {
      // O handleLog do automation.js corre por dentro; a prova e pela funcao exportada que
      // alimenta o historico: um ciclo com loot "12.3k de ouro" tem de acumular 12300, nao 12,3.
      const m = criarMundo();
      const auto = carregarAutomation(m);
      const pn = auto.parseNum;
      // o grupo capturado pela regex do loot (com o sufixo dentro) e o que o parseNum recebe:
      t.check('N4: grupo do loot "12.3k" pelo parser com sufixo -> 12300', pn('12.3k') === 12300);
      t.check('N4: grupo do loot "3.400" -> 3400 (milhar, nao 3,4)', pn('3.400') === 3400);
    }
>>>>>>> w4-fuga
  },
};
