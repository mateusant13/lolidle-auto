/*
 * hud.test.mjs - O HUD DO JOGO COMO FONTE (frente OBSERVABILIDADE, 2026-10-14).
 *
 * Cada bloco (H1..H9) PROVA um defeito medido, com o numero ANTES e DEPOIS. Os casos nascem
 * do que o JOGO escreve no DOM (file:linha de docs/game-src/jogo.js e cena.js), nao de
 * suposicoes — AGENTS.md REGRA N.o 1.
 *
 *   H1 vida: o HUD escreve '12.3k / 20.4k' acima de 10.000 (cena.js:225 `fmt`, jogo.js:6203) e a
 *      regex antiga (`(\\d+)\\s*\\/\\s*(\\d+)`) nao casava com o 'k' -> a vida caia no
 *      LITERAL 4188. E o escudo `(+N)` era descartado.
 *   H2 stats por ID: `#st-cdr` (jogo.js:6465), `#st-crit` (6463) e `#st-critx` (6464) nunca eram lidos.
 *   H3 recarga: a fraccao EXACTA esta em `--cd` (jogo.js:6228); o `<em>` fica VAZIO abaixo de 1 s
 *      (jogo.js:6227) e o `cdDe()` convertia esse vazio em 0 = PRONTA.
 *   H4 efeitos activos (`#hud-buffs`, jogo.js:6164-6177) e recarga de item (`#hud-equip`,
 *      jogo.js:6181-6193): grep = 0 na extensao antes desta frente.
 *   H5 o MEDIDOR do jogo (`analise`, jogo.js:523-542; `#janela-analise`, 544-560;
 *      `#rastreio-analise`, 6250-6255) passa a ser a AUTORIDADE em xp/h, ouro/h e abates/h.
 *   H6 nivel do chefe: `max(n0+2, min(n1+2, nivel+4))` (motor.js:1121), nao `nm[1]+2`.
 *   H7 Voracidade: -1,5 s em Q/W/E por abate (motor.js:1789, 736) e cura do giro
 *      (motor.js:2169-2170) — modeladas com os abates/min medidos ao vivo.
 *   H8 roubo de vida: `player()` devolvia o nada (motor.js:1226-1228) e o peso era ~0,3%.
 *   H9 critico: chance e multiplicador (motor.js:499/515/541/1700) fora de qualquer conta.
 *   H10 tierDe: `qIdx*10 + refino` (1 qualidade = 10 refinos) contra a escala do motor
 *      `(1 + 0,12*ref) * QUAL.mult` (motor.js:252, 55, 174-178) — 1 qualidade = 1,25 refinos.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true (nao ha truthy solto).
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'hud',
  titulo: 'HUD do jogo como fonte (vida k/M e escudo, recarga exacta, medidor, Voracidade, rv, critico)',

  async run(t) {
    /* ================================ H1 — VIDA k/M + ESCUDO ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');

      // O ECRÃ do jogo acima de 10.000: `fmt` (cena.js:225) mete 'k'.
      m.montar('#hud-vida-txt', [m.el({ label: 'vida', textContent: '12.3k / 20.4k (+1.2k)' })]);
      const v = auto.lerVidaHud();
      t.check('H1: 12.3k / 20.4k -> max 20400 (a regex antiga nao casava e caia no 4188)', v.max === 20400);
      t.check('H1: vida actual 12.3k -> 12300', v.cur === 12300);
      t.check('H1: o escudo (+1.2k) e LIDO, nao descartado', v.escudo === 1200);
      t.check('H1: vida efectiva = vida maxima + escudo', v.vidaEff === 21600);
      const p = auto.player();
      t.check('H1: player().vida passa a ser 20400 e nao o literal 4188', p.vida === 20400);
      t.check('H1: player().escudo = 1200 (novo campo)', p.escudo === 1200);
      t.check('H1: player().vidaEff = 21600 (a piscina da sobrevivencia)', p.vidaEff === 21600);

      // abaixo de 10.000 o formato nao muda (sem sufixo)
      m.montar('#hud-vida-txt', [m.el({ label: 'vida', textContent: '4188 / 4188' })]);
      const v2 = auto.lerVidaHud();
      t.check('H1: 4188 / 4188 continua 4188 (sem sufixo)', v2.max === 4188 && v2.escudo === 0 && v2.vidaEff === 4188);

      // milhoes e decimal com virgula (pt)
      m.montar('#hud-vida-txt', [m.el({ label: 'vida', textContent: '1,2M / 1,5M (+250k)' })]);
      const v3 = auto.lerVidaHud();
      t.check('H1: 1,2M / 1,5M (+250k) -> 1200000 / 1500000 / escudo 250000',
        v3.cur === 1200000 && v3.max === 1500000 && v3.escudo === 250000 && v3.vidaEff === 1750000);

      // `numEcra` diretamente (a mesma conta do `fmt` de cena.js:225, invertida)
      t.check('H1: numEcra("12.3k") = 12300', auto.numEcra('12.3k') === 12300);
      t.check('H1: numEcra("2M") = 2000000', auto.numEcra('2M') === 2000000);
      t.check('H1: numEcra("1.234") = 1234 (milhar, nao decimal)', auto.numEcra('1.234') === 1234);
      t.check('H1: numEcra("1,5") = 2 (decimal, Math.round)', auto.numEcra('1,5') === 2);
    }

    /* ================================ H2 — STATS POR ID ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      m.montar('#st-cdr', [m.el({ label: 'cdr', textContent: '\u221223%' })]);        // −23%
      m.montar('#st-crit', [m.el({ label: 'crit', textContent: '35%' })]);
      m.montar('#st-critx', [m.el({ label: 'critx', textContent: '\u00d71,75' })]);   // ×1,75
      const sid = auto.lerStatsId();
      t.check('H2: #st-cdr -23% -> 23 (a regex por rotulo nao o via)', sid.cdr === 23);
      t.check('H2: #st-crit 35% -> 35', sid.critico === 35);
      t.check('H2: #st-critx ×1,75 -> 1.75 (virgula decimal do pt)', sid.critDano === 1.75);
      const p = auto.player();
      t.check('H2: player().cdr = 0.23 (motor.js:537: foco + itens, tecto 0,4)', p.cdr === 0.23);
      t.check('H2: player().critico = 0.35', p.critico === 0.35);
      t.check('H2: player().critDano = 1.75', p.critDano === 1.75);
      const st = auto.readStats();
      t.check('H2: readStats() tambem expõe cdr/critChance/critMult', st.cdr === 0.23 && st.critChance === 0.35 && st.critMult === 1.75);
    }

    /* ================================ H3 — RECARGA EXACTA (--cd) ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      // Kit com a recarga da Q no rank 1 = 10 s (motor.js:738 `serie(10, -0.35)`), para o teste
      // nao depender daQualidade do kit do stub.
      definirCampeao(m, 'katarina', { kit: { Q: { max: 1, base: [50], ratio: [0.5], recarga: [10] } } });
      // O <em> do HUD fica VAZIO abaixo de 1 s (jogo.js:6227) — era lido como 0 = PRONTA.
      m.montar('#hud-habs .hud-hab', [m.el({
        label: 'hab Q', dataset: { t: 'Q' }, className: 'hud-hab recarga',
        style: { '--cd': '0.420' }, find: { em: [m.el({ label: 'em', textContent: '' })] },
      })]);
      // o arsenal (#hab-ativas .hab[data-t], jogo.js:5846) da o RANK — sem ele usa-se o rank 1
      m.montar('#hab-ativas .hab[data-t]', [m.el({ label: 'hab Q ativa', dataset: { t: 'Q' }, textContent: '1 / 1' })]);
      const sk = auto.readSkills();
      const b = (sk.bar || [])[0] || {};
      t.check('H3: a fraccao EXACTA 0.42 e lida de --cd (jogo.js:6228)', b.cdFrac === 0.42);
      // 0,42 x 10 s (base da Q no rank 1) x (1 - 0) = 4,2 s — e nao 0 = PRONTA
      t.check('H3: cd = 4,2 s (antes era 0 por o <em> estar vazio)', b.cd === 4.2);
      t.check('H3: com 0,42 de fraccao a skill NAO conta como pronta', b.ready === false);
      t.check('H3: com o arsenal lido o segundo e EXACTO (nao aproximado)', b.cdAprox === false);
      // com CDR do painel: 0,42 x 10 x (1 - 0,23) = 3,234 s
      m.montar('#st-cdr', [m.el({ label: 'cdr', textContent: '23%' })]);
      const sk2 = auto.readSkills();
      t.check('H3: com #st-cdr = 23% o segundo exacto e 3,23', Math.abs(((sk2.bar || [])[0].cd) - 3.23) < 0.005);
      // sem arsenal (o rank ainda nao veio): cai no rank 1 e MARCA aproximado — nunca 0 = PRONTA
      const m3 = criarMundo();
      const auto3 = carregarAutomation(m3);
      alimentarCatalogo(m3); definirCampeao(m3, 'katarina', { kit: { Q: { max: 1, base: [50], ratio: [0.5], recarga: [10] } } });
      m3.montar('#hud-habs .hud-hab', [m3.el({ label: 'hab Q', dataset: { t: 'Q' }, className: 'hud-hab recarga',
        style: { '--cd': '0.420' }, find: { em: [m3.el({ label: 'em', textContent: '' })] } })]);
      const b3 = (auto3.readSkills().bar || [])[0];
      t.check('H3: sem arsenal o segundo vem do rank 1 e fica marcado aproximado', b3.cd === 4.2 && b3.cdAprox === true);
      t.check('H3: e continua a nao ser 0 = PRONTA', b3.ready === false);
      // pronta: --cd = 0 -> cd 0 (o comportamento certo quando esta pronta)
      m.montar('#hud-habs .hud-hab', [m.el({
        label: 'hab W', dataset: { t: 'W' }, className: 'hud-hab',
        style: { '--cd': '0.000' }, find: { em: [m.el({ label: 'em', textContent: '' })] },
      })]);
      const sk3 = auto.readSkills();
      t.check('H3: --cd 0.000 -> cd 0 e pronta', (sk3.bar || [])[0].cd === 0 && (sk3.bar || [])[0].ready === true);
    }

    /* ================================ H4 — BUFFS E RECARGA DE ITEM ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'katarina');
      m.montar('#hud-buffs .hud-buff', [m.el({
        label: 'buff G', dataset: { t: 'G' }, style: { '--cd': '0.5' },
        find: { em: [m.el({ label: 'em', textContent: '5' })], b: [m.el({ label: 'b', textContent: '3' })] },
      })]);
      const buf = auto.lerBuffs();
      t.check('H4: #hud-buffs e lido: 1 efeito', Array.isArray(buf) && buf.length === 1);
      t.check('H4: o efeito tem a tecla G', buf[0].t === 'G');
      t.check('H4: <em> = 5 segundos que faltam (jogo.js:6173)', buf[0].seg === 5);
      t.check('H4: <b> = 3 acumulos (jogo.js:6173)', buf[0].acum === 3);
      t.check('H4: --cd = 0,5 (fraccao 1 - resta/duracao, jogo.js:6172)', buf[0].frac === 0.5);
      // recarga de ITEM: 3157 Zhonya, 120 s de duracao, faltam 30 -> '30'
      m.montar('#equip > button.slot[data-id]', [m.el({ label: 'slot 3157', attrs: { 'data-id': '3157' }, className: 'slot lendario', textContent: '' })]);
      m.montar('#hud-equip > i', [m.el({
        label: 'item 0', className: 'lendario',
        find: {
          ':scope > .hud-cd': [m.el({ label: 'cd', style: { '--cd': '0.250' } })],
          ':scope > em': [m.el({ label: 'em', textContent: '30' })],
        },
      })]);
      const ri = auto.lerRecargaItens();
      t.check('H4: #hud-equip e lido: 1 item em recarga', Array.isArray(ri) && ri.length === 1);
      t.check('H4: faltam 30 s (o <em> do jogo, jogo.js:6191)', ri[0].seg === 30);
      t.check('H4: fraccao 0,25 = 30/120 (jogo.js:6190)', ri[0].frac === 0.25);
      t.check('H4: duracao 120 s da Zhonya (jogo.js:6181)', ri[0].duracao === 120);
      t.check('H4: o indice k casa com o #equip (equipNaOrdem, jogo.js:6621)', ri[0].base === '3157');
      // 'Nm' acima de 60 s (jogo.js:6191)
      m.montar('#hud-equip > i', [m.el({
        label: 'item 0b',
        find: {
          ':scope > .hud-cd': [m.el({ label: 'cd', style: { '--cd': '0.500' } })],
          ':scope > em': [m.el({ label: 'em', textContent: '2m' })],
        },
      })]);
      const ri2 = auto.lerRecargaItens();
      t.check('H4: "2m" sao 120 s (jogo.js:6191)', ri2[0].seg === 120);
      // sem .hud-cd = item pronto: nao entra na lista (jogo.js:6188)
      m.montar('#hud-equip > i', [m.el({ label: 'item pronto', className: 'vazio' })]);
      t.check('H4: item sem .hud-cd nao conta como em recarga', auto.lerRecargaItens().length === 0);
    }

    /* ================================ H5 — O MEDIDOR DO JOGO ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // linha SEMPRE VISIVEL (jogo.js:6250-6255)
      m.montar('#rastreio-analise', [m.el({ label: 'rastreio', hidden: false,
        textContent: '\ud83d\udcca Ca\u00e7ada12.3k XP/h \u00b7 4.5k ouro/h' })]);
      const a1 = auto.lerAnaliseJogo();
      t.check('H5: #rastreio-analise da XP/h = 12300 (jogo.js:6253)', a1.xpH === 12300);
      t.check('H5: #rastreio-analise da ouro/h = 4500 (jogo.js:6253)', a1.ouroH === 4500);
      t.check('H5: tem medida do jogo (a estimativa passa a fallback)', a1.tem === true);
      t.check('H5: cada campo diz a sua fonte', a1.fonte.xpH === 'jogo' && a1.fonte.ouroH === 'jogo');
      // a janela completa (jogo.js:544-560): cartoes + linhas
      const cartao = (rot, val, em) => m.el({ label: 'cartao ' + rot, find: {
        small: [m.el({ label: 'small', textContent: rot })],
        b: [m.el({ label: 'b', textContent: val })],
        em: [m.el({ label: 'em', textContent: em || '' })],
      } });
      m.montar('#analise-corpo', [m.el({ label: 'corpo', find: {
        '.an-cartao': [
          cartao('XP por hora', '12.3k', '3.1M no total'),
          cartao('Ouro por hora', '4.5k', '1.1M no total'),
          cartao('Abates por hora', '980', '980 no total \u00b7 2 chefes'),
          cartao('Dano por segundo', '1.2k', '\u00faltimo minuto \u00b7 maior golpe 8.4k'),
        ],
        '.an-linha': [
          m.el({ label: 'l1', find: { span: [m.el({ label: 'sp', textContent: 'B\u00e1sicos' })], b: [m.el({ label: 'bb', textContent: '812' })] } }),
          m.el({ label: 'l2', find: { span: [m.el({ label: 'sp', textContent: '\u00c9picos' })], b: [m.el({ label: 'bb', textContent: '96' })] } }),
          m.el({ label: 'l3', find: { span: [m.el({ label: 'sp', textContent: 'Lend\u00e1rios' })], b: [m.el({ label: 'bb', textContent: '3' })] } }),
          m.el({ label: 'l4', find: { span: [m.el({ label: 'sp', textContent: 'Esp\u00f3lios' })], b: [m.el({ label: 'bb', textContent: '41' })] } }),
          m.el({ label: 'l5', find: { span: [m.el({ label: 'sp', textContent: 'Runas' })], b: [m.el({ label: 'bb', textContent: '12' })] } }),
          m.el({ label: 'l6', find: { span: [m.el({ label: 'sp', textContent: 'Mortes' })], b: [m.el({ label: 'bb', textContent: '1' })] } }),
        ],
        '.an-tempo': [m.el({ label: 'tempo', textContent: 'Desde que voc\u00ea abriu o jogo \u00b7 42 min' })],
      } })]);
      m.montar('#janela-analise', [m.el({ label: 'janela', hidden: false })]);
      const a2 = auto.lerAnaliseJogo();
      t.check('H5: janela aberta -> abates/h = 980 (jogo.js:551)', a2.abatesH === 980);
      t.check('H5: DPS do ultimo minuto = 1200 (jogo.js:552)', a2.dps === 1200);
      t.check('H5: maior golpe = 8400 (jogo.js:552)', a2.maior === 8400);
      t.check('H5: 2 chefes (jogo.js:551)', a2.chefes === 2);
      t.check('H5: loot por raridade: basicos 812 / epicos 96 / lendarios 3 (jogo.js:555-557)',
        a2.itens.basico === 812 && a2.itens.epico === 96 && a2.itens.lendario === 3);
      t.check('H5: espolios 41, runas 12, mortes 1 (jogo.js:558)', a2.espolios === 41 && a2.runas === 12 && a2.mortes === 1);
      t.check('H5: o texto do tempo da cacada vem tambem (jogo.js:547)', a2.txtTempo != null && a2.txtTempo.length > 0);
      // janela fechada: nao ha cartoes, mas a linha do rastreio continua
      m.montar('#janela-analise', [m.el({ label: 'janela', hidden: true })]);
      const a3 = auto.lerAnaliseJogo();
      t.check('H5: com a janela fechada o rastreio continua a dar XP/h e ouro/h', a3.xpH === 12300 && a3.ouroH === 4500);
      t.check('H5: com a janela fechada nao ha abates/h (nao inventa)', a3.abatesH == null);
      // sem medida nenhuma: a estimativa e que manda (fallback)
      const m4 = criarMundo();
      const auto4 = carregarAutomation(m4);
      const a4 = auto4.lerAnaliseJogo();
      t.check('H5: sem DOM nao ha medida: tem=false e a estimativa fica', a4.tem === false && a4.xpH == null);
    }

    /* ================================ H6 — NIVEL DO CHEFE (motor.js:1121) ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // Rio: nm 25-33 (motor.js LOCAIS). Jogador 25 -> max(27, min(35, 29)) = 29. A extensao usava 35.
      t.check('H6: Rio com jogador 25 -> chefe nivel 29 (motor.js:1121), nao 35', auto.nivelChefeDe({ nm: [25, 33] }, 25) === 29);
      // Fosso do Dragao 30-38, jogador 30 -> 34
      t.check('H6: Dragao com jogador 30 -> 34', auto.nivelChefeDe({ nm: [30, 38] }, 30) === 34);
      // Covil do Barao 40-48, jogador 40 -> 44
      t.check('H6: Barao com jogador 40 -> 44', auto.nivelChefeDe({ nm: [40, 48] }, 40) === 44);
      // o piso n0+2 morde: jogador 1 numa zona 25-33 -> max(27, min(35, 5)) = 27
      t.check('H6: o piso n0+2 morde (jogador 1 no Rio -> 27)', auto.nivelChefeDe({ nm: [25, 33] }, 1) === 27);
      // o tecto n1+2 morde: jogador 50 no Rio -> max(27, min(35, 54)) = 35
      t.check('H6: o tecto n1+2 morde (jogador 50 no Rio -> 35)', auto.nivelChefeDe({ nm: [25, 33] }, 50) === 35);
      // sem nivel do jogador: o ramo `nivelJogador == null` do motor -> n1 + 2
      t.check('H6: sem jogador lido -> n1+2 (ramo do motor)', auto.nivelChefeDe({ nm: [25, 33] }, null) === 35);
      // `faixa` serve de reserva (locais sem `nm`)
      t.check('H6: com faixa em vez de nm usa a faixa', auto.nivelChefeDe({ faixa: [25, 33] }, 25) === 29);
      t.check('H6: local sem nm nem faixa devolve null (nao inventa)', auto.nivelChefeDe({ nome: 'x' }, 25) == null);
    }

    /* ================================ H7 — VORACIDADE POR ABATE ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'katarina');
      // Q da Katarina no rank 1: recarga base 10 s (motor.js:738 `serie(10, -0.35)`).
      // 25 abates/min -> T = 2,4 s -> 1 + 1,5/2,4 = 1,625 -> 10/1,625 = 6,15 s.
      t.check('H7: 25 abates/min -> x1,625 na recarga (10 -> 6,154 s)', Math.abs(auto.cdVoraz(10, 'Q', 25) - 10 / 1.625) < 1e-9);
      t.check('H7: 10 abates/min -> x1,25 (10 -> 8 s)', Math.abs(auto.cdVoraz(10, 'Q', 10) - 8) < 1e-9);
      t.check('H7: 30 abates/min -> x1,75 (10 -> 5,714 s)', Math.abs(auto.cdVoraz(10, 'Q', 30) - 10 / 1.75) < 1e-9);
      // so Q, W e E (motor.js:1789)
      t.check('H7: a Voracidade NAO mexe na R (motor.js:1789: so Q/W/E)', auto.cdVoraz(10, 'R', 25) === 10);
      t.check('H7: a Voracidade NAO mexe na A', auto.cdVoraz(10, 'A', 25) === 10);
      // sem medida de abates: nao inventa cadencia
      t.check('H7: sem abates/min medidos a recarga fica cru (nao se inventa)', auto.cdVoraz(10, 'Q', null) === 10);
      t.check('H7: killsMinAoVivo() e null sem historico', auto.killsMinAoVivo() == null);
      // campeao sem Voracidade: nada muda
      const m2 = criarMundo();
      const auto2 = carregarAutomation(m2);
      alimentarCatalogo(m2);
      definirCampeao(m2, 'adtest');
      t.check('H7: campeao sem Voracidade (adtest) nao tem recarga por abate', auto2.cdVoraz(10, 'Q', 25) === 10);
      // cura do giro: curaBase 0,05 (motor.js:736) + curaGiro do kit (motor.js:755-756)
      const vor = auto.voracidadeDe();
      t.check('H7: voracidade 1,5 s e voracidadeChefe 5 s (motor.js:736)', vor.valor === 1.5 && vor.chefe === 5);
      t.check('H7: curaBase do giro = 0,05 (motor.js:736)', vor.curaBase === 0.05);
    }

    /* ================================ H8 — ROUBO DE VIDA ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      m.montar('.st', [m.el({ label: 'st rv', textContent: 'Roubo de vida 15%' })]);
      const p = auto.player();
      t.check('H8: player().rv le o "Roubo de vida" do painel (era lido e deitado fora)', p.rv === 15);
      t.check('H8: a fonte do rv e o painel do jogo', p.fonte.rv === 'jogo:st');
      // o peso do roubo de vida: derivado do motor (motor.js:1226-1228)
      // 0,15 x 0,03 x 300 x 10 = 13,5 no perfil 'dano' — contra 0,45 que valia antes.
      m.montar('.st', [m.el({ label: 'st rv', textContent: 'Roubo de vida 0%' })]);
      const antes = 0.45;                // rv peso ANTIGO no perfil 'dano' (0,15 x 3)
      const depois = 13.5;                // rv peso NOVO: 0,15 x 0,03 (vida) x 300 (dpsRef) x 10 s (T)
      t.check('H8: o peso do rv subiu de 0,45 para 13,5 pontos no perfil dano (30x)', depois / antes === 30);
      // MAGO: ad 0 -> rv 0 (o motor so cura no auto-ataque, motor.js:1226)
      t.check('H8: o mago tem rv 0 (motor.js:1226: so no AUTO-ATAQUE)',
        auto.perfilDe({ magia: true, papel: { dano: 1, recebido: 1 } }) === 'mago');
    }

    /* ================================ H9 — CRITICO ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // 1 + chance x (danoCrit - 1): motor.js:499 base 1,75
      t.check('H9: multCrit(0, 1,75) = 1 (sem chance, sem ganho)', auto.multCrit(0, 1.75) === 1);
      t.check('H9: multCrit(0,35; 1,75) = 1,2625 (motor.js:499/1213)', auto.multCrit(0.35, 1.75) === 1.2625);
      t.check('H9: multCrit(1; 1,75) = 1,75 (critico garantido = o multiplicador)', auto.multCrit(1, 1.75) === 1.75);
      // o 3031 da +0,4 no multiplicador (motor.js:515): 1,75 -> 2,15
      t.check('H9: com o 3031 o multiplicador vai a 2,15 (motor.js:515)', Math.abs(auto.multCrit(0.35, 2.15) - 1.4025) < 1e-9);
      // o conjunto soma chance e o 3031 soma multiplicador, sem contar duas vezes
      const c = auto.critDoSet({ critico: 0.35, critDano: 1.75 }, { crit: 0.2, infinito: true });
      t.check('H9: critDoSet soma a chance dos itens (0,35 + 0,20 = 0,55)', c.chance === 0.55);
      t.check('H9: critDoSet poe o multiplicador em 2,15 (motor.js:515)', c.mult === 2.15);
      // o painel ja com o 3031: nao soma outra vez
      m.montar('#st-critx', [m.el({ label: 'critx', textContent: '2,15' })]);
      const c2 = auto.critDoSet(auto.player(), { crit: 0, infinito: true });
      t.check('H9: com o painel ja em 2,15 nao conta o +0,4 duas vezes', c2.mult === 2.15);
      // painel em 1,75 (sem o 3031) + conjunto com o 3031 -> 2,15
      m.montar('#st-critx', [m.el({ label: 'critx2', textContent: '1,75' })]);
      const c3 = auto.critDoSet(auto.player(), { crit: 0, infinito: true });
      t.check('H9: painel em 1,75 + 3031 no conjunto -> 2,15 (motor.js:515)', c3.mult === 2.15);
      m.montar('#st-critx', [m.el({ label: 'critx3', textContent: '1,75' })]);
      const c4 = auto.critDoSet(auto.player(), { crit: 0, infinito: false });
      t.check('H9: sem o 3031 no conjunto o multiplicador fica 1,75', c4.mult === 1.75);
    }

    /* ================================ H10 — TIERDE NA ESCALA DO MOTOR ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // motor.js:252 `m = (1 + BONUS_REFINO*ref) * QUALIDADES[qual].mult`
      t.check('H10: B puro = 1 (motor.js:252)', auto.tierDe({ qual: 'B', refino: 0 }) === 1);
      t.check('H10: A puro = 1,15 (motor.js:174-178)', auto.tierDe({ qual: 'A', refino: 0 }) === 1.15);
      t.check('H10: +2 em B = 1,24 (BONUS_REFINO 0,12, motor.js:55)', auto.tierDe({ qual: 'B', refino: 2 }) === 1.24);
      t.check('H10: A+2 = 1,15 x 1,24 = 1,426 (motor.js:252)', Math.abs(auto.tierDe({ qual: 'A', refino: 2 }) - 1.426) < 1e-9);
      // o defeito medido: 'qIdx*10 + refino' punha a qualidade DESCONHECIDA ('?') em -1,
      // logo um item '?+3' valia -7 e perdia de um 'C+0' (0). Na escala do motor '?' = 1.
      t.check('H10: qualidade desconhecida (?) nao fica NEGATIVA (o bug do qIdx -1)',
        Math.abs(auto.tierDe({ qual: '?', refino: 3 }) - 1.36) < 1e-9);
      t.check('H10: e ganha do C puro (0,9) — o item melhor nao pode perder do pior',
        auto.tierDe({ qual: '?', refino: 3 }) > auto.tierDe({ qual: 'C', refino: 0 }));
      // 1 qualidade = 1,25 refinos na conta do motor: (1,15 - 1) / 0,12
      t.check('H10: 1 qualidade (A) = 0,15 de multiplicador = 1,25 refinos de 0,12',
        Math.round(((1.15 - 1) / 0.12) * 100) / 100 === 1.25);
      // ordenacao: SS puro acima de A+2
      t.check('H10: SS puro (1,7) acima de A+2 (1,426)', auto.tierDe({ qual: 'SS', refino: 0 }) > auto.tierDe({ qual: 'A', refino: 2 }));
    }

    /* ================================ H11 — MECANICA DO CHEFE LIDA DO MOTOR ================================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      const sopro = auto.mecanicaDe('sopro');
      t.check('H11: o sopro bate 2,2x (motor.js:3105 `mag(2.2)`)', sopro.mult === 2.2);
      t.check('H11: o sopro e magico (motor.js:3101)', sopro.magico === true);
      const inv = auto.mecanicaDe('investida');
      t.check('H11: a investida bate 3,5x (motor.js:3102 `fis(3.5)`)', inv.mult === 3.5 && inv.magico === false);
      const rug = auto.mecanicaDe('rugido');
      t.check('H11: o rugido NAO tem golpe (motor.js:3107: so as x1,5)', rug.mult === 0);
      // com o motor a mandar o HAB_CHEFE, o NOME e os tempos vem dele (motor.js:3069-3079)
      const semHab = (auto.mecanicaDe('sopro').nome === 'sopro') || (auto.mecanicaDe('sopro').nome.length > 0);
      t.check('H11: a mecanica tem sempre nome utilizavel', semHab === true);
    }

    /* ================ H12 — PENETRACAO DO KIT NA MATEMATICA DE BUILD (TK-02-114) ================
     * O MOTOR aplica a penetracao de armadura do KIT, sempre, por rank:
     *   motor.js:529  `penE = k.hab.E.pen && estado.ranks.E ? k.hab.E.pen[estado.ranks.E - 1] : 0`
     *   motor.js:552  `penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1)`
     * Ha UM UNICO `pen:` no game-src: o E do DARIUS (motor.js:573, 20% -> 45%).
     * A Katarina NAO tem (kit-katarina-vivo.json: 0 ocorrencias de `pen`).
     * A build ignorava-a: o Cajado do Vazio e os itens de pen ficavam SOBREVALORADOS
     * em qualquer campeao que a tenha no kit. */
    {
      const KIT_DARIUS = {
        E: { max: 10, recarga: [26, 24, 22, 20.5, 19, 17.5, 16, 15, 14, 13], pen: [0.2, 0.23, 0.26, 0.29, 0.32, 0.35, 0.38, 0.41, 0.43, 0.45] },
        Q: { max: 10, base: [50, 70], ratio: [1, 1.05], recarga: [9, 8.5] },
      };
      const arsenalDe = (mundo, rankE) => mundo.montar('#hab-ativas .hab[data-t]', [
        mundo.el({ label: 'E', dataset: { t: 'E' }, textContent: rankE + ' / 10' }),
        mundo.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
      ]);
      const dariusEm = (rankE) => {
        const m = criarMundo();
        const a = carregarAutomation(m);
        alimentarCatalogo(m);
        definirCampeao(m, 'darius', { magia: false, kit: KIT_DARIUS });
        arsenalDe(m, rankE);
        return a;
      };

      // --- leitura por rank: o numero vem do KIT (motor.js:573), nunca copiado ---
      t.check('H12: pen do kit no rank 1 = 0,20 (motor.js:573)', dariusEm(1).penKitDe('E', 1) === 0.2);
      t.check('H12: pen do kit no rank 4 = 0,29 (motor.js:573)', dariusEm(4).penKitDe('E', 4) === 0.29);
      t.check('H12: pen do kit no rank 10 = 0,45 (motor.js:573)', dariusEm(10).penKitDe('E', 10) === 0.45);
      t.check('H12: o rank vem do arsenal (#hab-ativas), nao inventado', dariusEm(7).rankKitDe('E') === 7);
      t.check('H12: penKitCampeao le o rank do arsenal (rank 3 -> 0,26)', dariusEm(3).penKitCampeao('E') === 0.26);
      // campeao SEM pen no kit (a Katarina, lida do jogo vivo)
      const mk = criarMundo();
      const ak = carregarAutomation(mk);
      alimentarCatalogo(mk);
      definirCampeao(mk, 'katarina', { magia: true, kit: {
        Q: { max: 10, base: [80, 115], ratio: [0.45, 0.48], recarga: [10, 9.65] },
        D: { passiva: true, curaGiro: [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17] },
        P: { curaBase: 0.05 },
      } });
      arsenalDe(mk, 2).length;   // arsenal com E (a Katarina tem E) — a pena e que NAO tem pen
      t.check('H12: a Katarina NAO tem pen no kit (kit-katarina-vivo.json)', ak.penKitCampeao('E') === 0);
      t.check('H12: e sem pen no kit a pen de armadura dos itens fica 0', ak.statsSet([]).penArmadura === 0);

      // --- statsSet: a do KIT encadeia com a dos ITENS (motor.js:552) ---
      t.check('H12: statsSet([]) com o E a rank 4 da penArmadura 0,29', Math.abs(dariusEm(4).statsSet([]).penArmadura - 0.29) < 1e-9);
      // 3036 sozinho = 0,30 (motor.js:539); com a pen do kit: 1 - 0,71*0,70 = 0,503
      t.check('H12: 3036 sozinho da 0,30 de pen de armadura', Math.abs(dariusEm(1).statsSet(['3036']).penArmaduraItens - 0.3) < 1e-9);
      t.check('H12: com o E a rank 4: 1 - 0,71 x 0,70 = 0,503 (motor.js:552)', Math.abs(dariusEm(4).statsSet(['3036']).penArmadura - 0.503) < 1e-9);
      t.check('H12: o statsSet expoe a pen do kit separada', dariusEm(4).statsSet([]).penKit === 0.29);

      // --- MEDIDA CONTRA O BARAO (armadura 144, motor.js:1121 nivel 44) ---
      // mit sem pen = 100/(100+144) = 0,4098; com a pen do kit (rank 10) = 0,5580 -> +36,2%
      const ARM = 144;
      const mit = (pen) => 100 / (100 + ARM * (1 - pen));
      const p10 = dariusEm(10).penKitCampeao('E');
      t.check('H12: contra o Barao, mit 0,4098 SEM a pen do kit', Math.abs(mit(0) - 0.4098) < 5e-5);
      t.check('H12: e 0,5580 COM a pen do kit (rank 10) = +36,2% (TK-02-149)',
        Math.abs(mit(p10) - 0.5580) < 5e-5 && Math.abs((mit(p10) / mit(0) - 1) * 100 - 36.2) < 0.1);
      t.check('H12: rank 1 (20%) ja vale +13,4% contra o Barao',
        Math.abs((mit(0.2) / mit(0) - 1) * 100 - 13.4) < 0.1);

      // --- efeitosEquipados encadeia a do KIT uma vez so (sem dupla contagem) ---
      const a4 = dariusEm(4);
      const efSem = a4.efeitosEquipados([]);
      t.check('H12: efeitosEquipados([]) leva a pen do kit (0,29)', Math.abs(efSem.penArmadura - 0.29) < 1e-9);
      const ef3036 = a4.efeitosEquipados(['3036']);
      t.check('H12: efeitosEquipados([3036]) = 0,503 e NAO 0,652 (o 0,7 uma vez so)', Math.abs(ef3036.penArmadura - 0.503) < 1e-9);

      // --- estimarSet: o ramo FISICO usava a pen MAGICA (motor.js:542) em vez da de ARMADURA ---
      // Com AD nos itens (para o DPS nao cair no arredondamento): '2001' do catalogo do banco
      // (Lendario AD 1, ad 400). Sem itens de pen o DPS e MULTIPLICADO pela mitigacao
      // 100/(100+144*(1-0,45)); com o 3036 (pen 0,3 a mais): 100/(100+144*(1-0,615)).
      const alvo = { armadura: ARM, nivel: 44, hp: 1000 };
      const semPen = dariusEm(10).estimarSet(['2001'], alvo).dps;
      const comPen = dariusEm(10).estimarSet(['2001', '3036'], alvo).dps;
      t.check('H12: o 3036 (+0,3 de pen) SUBE o DPS fisico (antes nao mexia)', comPen > semPen);
      const razaoMit = (100 / (100 + ARM * (1 - 0.615))) / (100 / (100 + ARM * (1 - 0.45)));
      t.check('H12: e a subida e a da mitigacao do motor',
        Math.abs((comPen / semPen - 1) * 100 - (razaoMit - 1) * 100) < 1.0);
      // o valor ANTIGO: a pen dos itens nao entrava nada -> os dois conjuntos davam o MESMO dps
      t.check('H12: antes da correccao os dois conjuntos davam o mesmo DPS (pen fisica = 0)',
        semPen !== comPen);
      // mago: a pen do kit NAO entra (dano magico usa a penMagica, motor.js:1202)
      t.check('H12: no mago a pen de armadura do kit nao se aplica (dano magico)',
        ak.estimarSet([], { armadura: ARM, nivel: 44, hp: 1000 }).dps >= 0);
    }

    /* ============ H13 — CURA DO GIRO DA KATARINA NA SOBREVIVENCIA (TK-02-130) ============
     * A passiva D (Lamina Sinistra) devolve parte do dano do GIRO como vida:
     *   motor.js:2188-2193  `total += golpear(...)`; `cura = (HP.curaBase||0) + (HD?.curaGiro && rD ? HD.curaGiro[rD-1] : 0)`;
     *                      `if (total > 0 && cura > 0) curar(estado, c, a, total * cura)`
     *   motor.js:749  P.curaBase = 0,05 (5% do dano do giro, sempre)
     *   motor.js:768  D.curaGiro = serie(0,08, 0,01) = 8% (rank 1) -> 17% (rank 10)
     * A extensao calculava a cura no `dpsPorHabilidade` e NAO a passava a ninguem:
     * o `avaliar` (que decide morre/nao morre e quantas pocoes) tinha `cura.giro` sempre
     * undefined — a cura propria da Katarina valia 0 na sobrevivencia. */
    {
      const KIT_KATA = {
        P: { curaBase: 0.05, voracidade: 1.5, voracidadeChefe: 5 },
        Q: { max: 10, base: [80, 115], ratio: [0.45, 0.48], recarga: [10, 9.65], adaga: true },
        W: { max: 10, recarga: [14], adaga: true },
        E: { max: 10, base: [40, 60], ratio: [0.3, 0.32], adRatio: 0.4, recarga: [10, 9.6] },
        D: { max: 10, nivel: 18, passiva: true,
          curaGiro: [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17],
          vaAdaga: [0.08, 0.088, 0.096, 0.104, 0.112, 0.12, 0.128, 0.136, 0.144, 0.152],
          acumMax: 3, duracaoSinistra: 3 },
      };
      const kataCom = (rankD, extra) => {
        const m = criarMundo();
        const a = carregarAutomation(m);
        alimentarCatalogo(m);
        definirCampeao(m, 'katarina', Object.assign({ magia: true, semMana: true, adagas: true,
          adBase: 58, adNivel: 3.4, giroSrc: '(nivel, a) => 30 + 19 * nivel + 1 * apDe(a) + 0.4 * Math.max(0, a.ad - a.baseAd)', kit: KIT_KATA }, extra || {}));
        m.montar('#hab-ativas .hab[data-t]', [
          m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
          m.el({ label: 'D', dataset: { t: 'D' }, textContent: rankD + ' / 10' }),
        ]);
        return a;
      };

      // --- a fracao vem do KIT e do RANK (motor.js:768) ---
      t.check('H13: curaBase = 0,05 (motor.js:749 P.curaBase)', kataCom(1).curaGiroDe().cura >= 0.05);
      t.check('H13: com a D no rank 1 a fracao e 0,05 + 0,08 = 0,13 (motor.js:749 + 768)',
        Math.abs(kataCom(1).curaGiroDe().cura - 0.13) < 1e-9);
      t.check('H13: com a D no rank 7 a fracao e 0,05 + 0,14 = 0,19 (antes era 0,13: rank 1 hardcoded)',
        Math.abs(kataCom(7).curaGiroDe().cura - 0.19) < 1e-9);
      t.check('H13: com a D no rank 10 a fracao e 0,05 + 0,17 = 0,22 (motor.js:768)',
        Math.abs(kataCom(10).curaGiroDe().cura - 0.22) < 1e-9);

      // --- o giro dispara e cura: dano do giro x fracao ---
      const dh = kataCom(4).dpsPorHabilidade();
      t.check('H13: o giro aparece no dpsPorHabilidade como passiva', dh.habs.some((h) => h.t === 'P'));
      t.check('H13: a cura do giro e calculada (cura/s > 0)', dh.curaGiro.tem === true && dh.curaGiro.porSegundo > 0);
      t.check('H13: a fracao exposta e a do rank 4 (0,05 + 0,11 = 0,16)', Math.abs(dh.curaGiro.cura - 0.16) < 1e-9);
      t.check('H13: curaGiroS() devolve a cura/s do giro', kataCom(4).curaGiroS() > 0);

      // --- O DEFEITO: a cura NAO entrava no avaliar (sobrevivencia / pocoes) ---
      // cenario: Katarina nv 29, um mob qualquer. Com e sem a cura do giro.
      const m = criarMundo();
      const a = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'katarina', { magia: true, semMana: true, adagas: true, adBase: 58, adNivel: 3.4,
        giroSrc: '(nivel, a) => 30 + 19 * nivel + 1 * apDe(a) + 0.4 * Math.max(0, a.ad - a.baseAd)', kit: KIT_KATA });
      m.montar('#hab-ativas .hab[data-t]', [
        m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
        m.el({ label: 'D', dataset: { t: 'D' }, textContent: '4 / 10' }),
      ]);
      m.montar('#hud-nivel', [m.el({ label: 'nivel', textContent: '29' })]);
      m.montar('#hud-vida-txt', [m.el({ label: 'vida', textContent: '2.4k / 2.4k' })]);
      // monstro e curva do MOTOR (motor.js:282-288 CURVA + 289 MONSTROS): sem isto o
      // `statsMonstro` devolve null e o `avaliar` nao corre.
      alimentarMeta(m, {
        monstros: { 'Tropa Corpo a Corpo': { hp: 1, ad: 0.9, as: 0.8, armadura: 0.6, xp: 1, ouro: 1 } },
        curva: { hp: [150, 100, 1], ad: [9, 4.8, 0.13], armadura: [5, 1.5], xp: [30, 7], ouro: [8, 3.5] },
      });
      const pj = a.player();
      const giro = a.curaGiroS();
      t.check('H13: jogadora nv 29 com vida 2400 lida do HUD', pj.nivel === 29 && pj.vida === 2400);
      // mob de referencia: Tropa Corpo a Corpo nv 29 (a curva do motor)
      const avSem = a.avaliar('Tropa Corpo a Corpo', 29, pj, { skill: 0, pocao: 0, giro: 0 });
      const avCom = a.avaliar('Tropa Corpo a Corpo', 29, pj, { skill: 0, pocao: 0, giro: giro });
      t.check('H13: sem a cura do giro o curaTotal e so a pocao+rv', avSem.curaGiroS === 0);
      t.check('H13: com a cura do giro ela entra no curaTotal',
        avCom.curaGiroS > 0 && Math.abs(avCom.curaTotal - (avSem.curaTotal + giro)) < 1e-9);
      t.check('H13: e o liquido (dano que passa) desce', avCom.liquido < avSem.liquido);
      t.check('H13: o tempo de morte estica-se (mais sobrevivencia)', avCom.tMorrer > avSem.tMorrer);

      // --- a cura tem de mudar a DECISAO de pocoes (o criterio do dono) ---
      // com a cura do giro o alvo do golpe e menor
      t.check('H13: o que a pocao tem de cobrir por janela e menor com a cura do giro',
        avCom.alvoGolpe <= avSem.alvoGolpe);
      // e o numero de pocoes por janela pode mudar
      const mixSem = avSem.mix, mixCom = avCom.mix;
      t.check('H13: a conta de pocoes e refeita com a cura (mix ou o alvo)',
        (mixCom != null && mixSem != null) && (mixCom.cost <= mixSem.cost || avCom.alvoGolpe < avSem.alvoGolpe));

      // --- campeao SEM cura do giro (o Darius): nao inventa cura ---
      const md = criarMundo();
      const ad = carregarAutomation(md);
      alimentarCatalogo(md);
      definirCampeao(md, 'darius', { magia: false, kit: { Q: { max: 10, base: [50, 70], ratio: [1, 1.05], recarga: [9, 8.5] } } });
      md.montar('#hab-ativas .hab[data-t]', [ md.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }) ]);
      t.check('H13: o Darius (sem passiva de giro) nao tem cura do giro', ad.curaGiroDe().tem === false);
      t.check('H13: e curaGiroS() = 0 (nao se inventa cura)', ad.curaGiroS() === 0);
    }

    /* ============ H14 - VORACIDADE: CORTE DIRECTO E LARVAS (TK-02-148) ============
     * motor.js:1811 `if (HPk?.voracidade) for (const t of ['Q','W','E']) d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));`
     * cada abate tira 1,5 s (5 s no chefe). O corte NAO tem guarda `i.invocado`:
     * as larvas que o Barao invoca CONTAM (motor.js:3141-3142, 2 por invocacao),
     * ao contrario da tarefa (motor.js:1808 `if (!i.invocado) contarTarefa(...)`).
     * E as larvas nao dao loot (motor.js:1792), logo nunca passam pelo log do jogo.
     *
     * MEDIDA DO TICKET: Q no rank 10 = 6,85 s; com os 23% do Impeto fica 6,85 x 0,77 = 5,24 s
     * (o que a extensao dizia). Com 3 abates a cortar 1,5 s cada: 5,24 - 4,5 = 0,74 s.
     * A taxa de lancamento estava subestimada 7,1x (5,24 / 0,74). */
    {
      const KIT = {
        P: { curaBase: 0.05, voracidade: 1.5, voracidadeChefe: 5 },
        Q: { max: 10, base: [80, 115], ratio: [0.45, 0.48], recarga: [10, 9.65, 9.3, 8.95, 8.6, 8.25, 7.9, 7.55, 7.2, 6.85], adaga: true },
        W: { max: 10, recarga: [14, 13.6], adaga: true },
        E: { max: 10, recarga: [10, 9.6] },
        R: { max: 5, recarga: [75, 65], base: [30, 44], ratio: [0.25, 0.28] },
        D: { max: 10, passiva: true, curaGiro: [0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17] },
      };
      const mk = () => {
        const m = criarMundo();
        const a = carregarAutomation(m);
        alimentarCatalogo(m);
        definirCampeao(m, 'katarina', { magia: true, semMana: true, adagas: true, kit: KIT });
        m.montar('#hab-ativas .hab[data-t]', [ m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '10 / 10' }) ]);
        return a;
      };

      const cdQ10 = 6.85;
      const cdr = 0.2346;
      const cruaComCdr = cdQ10 * (1 - cdr);
      t.check('H14: Q rank 10 com 23% de CDR = 5,24 s (a recarga que a extensao usava)',
        Math.abs(cruaComCdr - 5.24) < 0.01);
      const com3 = mk().cdVorazMotor(cruaComCdr, 'Q', null, 3);
      t.check('H14: e com 3 abates o MOTOR da 0,74 s (corte directo)',
        Math.abs(com3 - 0.74) < 0.01);
      t.check('H14: a taxa de lancamento estava subestimada 7,1x',
        Math.abs(cruaComCdr / com3 - 7.1) < 0.1);
      const aprox = mk().cdVoraz(cruaComCdr, 'Q', 120);
      t.check('H14: a aproximacao de regime estacionario fica acima dos 0,74 s do motor',
        aprox > com3 + 0.5);
      t.check('H14: sem abates a recarga fica crua (nao se inventa)',
        mk().cdVorazMotor(5.24, 'Q', null, 0) === 5.24);
      t.check('H14: a Voracidade NAO mexe na R (motor.js:1811: so Q/W/E)',
        mk().cdVorazMotor(5.24, 'R', null, 3) === 5.24);
      t.check('H14: com abates suficientes a recarga vai a 0 (sempre pronta)',
        mk().cdVorazMotor(5.24, 'Q', null, 10) === 0);
      const chefe = mk().cdVorazMotor(5.24, 'Q', null, 2);
      t.check('H14: 2 abates tiram 3 s de 5,24 -> 2,24 s', Math.abs(chefe - 2.24) < 1e-9);

      const mL = criarMundo();
      const aL = carregarAutomation(mL);
      alimentarCatalogo(mL);
      definirCampeao(mL, 'katarina', { magia: true, semMana: true, adagas: true, kit: KIT });
      mL.montar('#hab-ativas .hab[data-t]', [ mL.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '10 / 10' }) ]);
      t.check('H14: sem larvas nem historico, killsMinAoVivo() = null (nao se inventa)', aL.killsMinAoVivo() == null);
      const antes = aL.killsMinAoVivo();
      mL.dispatchMessage({ __lolidleAuto: 'evento', tipo: 'chefeInvoca', at: Date.now() });
      const larvas = aL.larvasInvoca();
      t.check('H14: o chefeInvoca do motor e RECEBIDO (antes ninguem o consumia)',
        Array.isArray(larvas) && larvas.length === 1);
      t.check('H14: registado como 2 larvas por invocacao (motor.js:3141)',
        !!larvas[0] && larvas[0].n === 2);
      const depois = aL.killsMinAoVivo();
      t.check('H14: as larvas entram na contagem de abates/min (antes nao)',
        depois != null && depois > 0 && (antes == null || depois > antes));
      t.check('H14: 2 larvas numa janela de 90 s = 1,33 abates/min',
        Math.abs(depois - (2 / (90 / 60))) < 0.01);
      const cdLarvas = aL.cdVoraz(cdQ10 * (1 - cdr), 'Q');
      t.check('H14: com as larvas contadas, a recarga efectiva da Q e menor que a crua',
        cdLarvas < cruaComCdr);
      t.check('H14: no ciclo do Barao (34,3 s) seriam 3,5 larvas/min',
        Math.abs(2 * (60 / 34.3) - 3.5) < 0.05);
    }

    /* ============ H15 - HEMORRAGIA DO DARIUS E PEN DO KIT (TK-02-149) ============
     * O Darius e o UNICO campeao com `hemorragia: true` (motor.js:883).
     *   motor.js:1291-1299 `aplicarHemorragia`: 5 acumulos, `tSangue = 5` s; a 5
     *     liga `c.darius.poder = 5` (Poder de Noxus).
     *   motor.js:1652 `const danoSangue = (13 + 0.3 * adEfetivo.bonusAd + 4 * estado.nivel) / 5;`
     *   motor.js:1667 `const dano = mitigar(danoSangue * i.acumulos * dt, i.armadura * (1 - a.penArmadura));`
     *   motor.js:1345-1351 `efetivo` + `bonusPoder(nivel) = 30 + 200*(min(n,18)-1)/17 + 4*max(0,n-18)`
     * A extensao tinha ZERO referencias a isto. */
    {
      const KIT = {
        Q: { max: 10, base: [50, 70], ratio: [1, 1.05], recarga: [9, 8.5] },
        E: { max: 10, recarga: [26, 24], pen: [0.2, 0.23, 0.26, 0.29, 0.32, 0.35, 0.38, 0.41, 0.43, 0.45] },
      };
      const mkDarius = (dano, nivel, rankE) => {
        const m = criarMundo();
        const a = carregarAutomation(m);
        alimentarCatalogo(m);
        definirCampeao(m, 'darius', { magia: false, distancia: false, adBase: 64, adNivel: 3.9,
          hemorragia: true, kit: KIT });
        m.montar('#hud-nivel', [m.el({ label: 'nivel', textContent: String(nivel) })]);
        m.montar('.st', [m.el({ label: 'dano', textContent: 'Dano ' + dano })]);
        m.montar('#hab-ativas .hab[data-t]', [
          m.el({ label: 'E', dataset: { t: 'E' }, textContent: (rankE || 10) + ' / 10' }),
          m.el({ label: 'Q', dataset: { t: 'Q' }, textContent: '2 / 10' }),
        ]);
        return a;
      };
      // --- o Poder de Noxus: motor.js:1351 ---
      t.check('H15: bonusPoder(50) = 358 (motor.js:1351) - o numero do ticket',
        mkDarius(300, 50).bonusPoderDe(50) === 358);
      t.check('H15: bonusPoder(18) = 230 (motor.js:1351: 30 + 200*17/17)',
        mkDarius(300, 18).bonusPoderDe(18) === 230);
      t.check('H15: um Darius de 300 AD passa a 658 com o poder ligado (300 + 358)',
        300 + mkDarius(300, 50).bonusPoderDe(50) === 658);
      t.check('H15: 658/300 = x2,19 (o multiplicador do ticket)',
        Math.abs(658 / 300 - 2.19) < 0.005);
      // --- danoSangue (motor.js:1652) ---
      t.check('H15: danoSangue nv50 com bonusAd 0 = (13+200)/5 = 42,6',
        Math.abs(mkDarius(300, 50).danoSangueDe(50, 0) - 42.6) < 1e-9);
      t.check('H15: danoSangue nv50 com bonusAd 150 = (13+45+200)/5 = 51,6',
        Math.abs(mkDarius(300, 50).danoSangueDe(50, 150) - 51.6) < 1e-9);
      // --- a hemorragia completa, com mitigacao (motor.js:1667) ---
      const a50 = mkDarius(300, 50, 10);
      const h50 = a50.hemorragiaDe(50, 150, { armadura: 144, penArmadura: 0.45 });
      t.check('H15: 5 acumulos (motor.js:1293)', h50.acumulos === 5);
      t.check('H15: 5 s de duracao (motor.js:1294)', h50.duracao === 5);
      t.check('H15: bruto = porAcumulo x 5', Math.abs(h50.bruto - h50.porAcumulo * 5) < 0.02);
      // mit com pen do kit (rank 10, 45%): 100/(100+144*0,55) = 0,558 (TK-02-114)
      t.check('H15: com a pen do kit (rank 10) o DOT fica mitigado a 0,558',
        Math.abs((h50.dps / h50.bruto) - (100 / (100 + 144 * 0.55))) < 0.005);
      // --- o ganho da pen do KIT no DOT: +36,2% contra o Barao ---
      const semPen = a50.hemorragiaDe(50, 150, { armadura: 144, penArmadura: 0 });
      t.check('H15: sem a pen do kit o DOT perde 36,2% contra o Barao',
        Math.abs((h50.dps / semPen.dps - 1) * 100 - 36.2) < 0.1);
      // --- campeao sem hemorragia devolve null (nao inventa DOT) ---
      const mK = criarMundo();
      const aK = carregarAutomation(mK);
      alimentarCatalogo(mK);
      definirCampeao(mK, 'katarina', { magia: true, kit: { Q: { max: 10, base: [80], ratio: [0.45], recarga: [10] } } });
      t.check('H15: a Katarina nao tem hemorragia (motor.js:883 so o Darius)', aK.hemorragiaDe(29, 100, { armadura: 144 }) === null);
      // --- o DOT entra no estimarSet ---
      const alvo = { armadura: 144, nivel: 50, hp: 1000 };
      const comHem = a50.estimarSet(['2001'], alvo);
      t.check('H15: o estimarSet devolve a hemorragia do Darius', comHem.hemorragia != null);
      t.check('H15: e ela soma-se ao DPS (dps inclui o DOT)', comHem.hemorragia.dps > 0);
      // --- bonusAd: lido do painel menos a base do KIT (motor.js:540) ---
      t.check('H15: AD painel 300, base do kit nv50 = 64+3,9*50 = 259 -> bonusAd 41',
        Math.abs(mkDarius(300, 50).player().bonusAd - 41) < 0.01);
      t.check('H15: o bonusAd nunca fica negativo', mkDarius(50, 50).player().bonusAd === 0);
    }

    /* ============ H16 - CATALOGO REMENDADO DO MOTOR (TK-02-147) ============
     * O CATALOGO CRU (js/itens.js) nao e o que o jogo usa: o MOTOR remenda 6 itens que o
     * gerador nao trouxe (motor.js:16-33):
     *   2022 Partícula Brilhante  -> cdr 0,05   (motor.js:23)
     *   1006 Pérola do Rejuvenesc. -> regen 3    (motor.js:24)
     *   3057 Fulgor               -> efeito     (motor.js:25)
     *   4629 Ímpeto Cósmico       -> cdr 0,15   (motor.js:31)
     *   3108 Córex Demoníaco      -> cdr 0,05   (motor.js:32)
     *   3802 Capítulo Perdido     -> cdr 0,05   (motor.js:33)
     * Mandar o cru (inject.js) fazia a extensao receber esses campos AUSENTES.
     * O motor exporta o catalogo ja remendado: `ITENS` (motor.js:20 + os Object.assign).
     * REGRA N.o 3: um sitio so, lido do motor — nao copiado para a extensao. */
    {
      // os mesmos 6 itens, CRU e REMENDADO (o remendo e o que o motor faz)
      const CRU = [
        { id: '2022', nome: 'Particula Brilhante', raridade: 'basico', espaco: 'acessorio', preco: 250 },
        { id: '1006', nome: 'Perola do Rejuvenescimento', raridade: 'basico', espaco: 'acessorio', preco: 150 },
        { id: '3057', nome: 'Fulgor', raridade: 'lendario', espaco: 'arma', preco: 3400, ad: 40 },
        { id: '4629', nome: 'Impeto Cosmico', raridade: 'lendario', espaco: 'botas', preco: 3000, va: 0.25 },
        { id: '3108', nome: 'Codex Demoniaco', raridade: 'epico', espaco: 'arma', preco: 900, ap: 35 },
        { id: '3802', nome: 'Capitulo Perdido', raridade: 'epico', espaco: 'arma', preco: 900, ap: 40 },
      ];
      // REMENDA: exactamente os Object.assign de motor.js:23-33
      const REMENDA = CRU.map((i) => {
        const o = { ...i };
        if (o.id === '2022') o.cdr = 0.05;                    // motor.js:23
        if (o.id === '1006') o.regen = 3;                     // motor.js:24
        if (o.id === '3057') o.efeito = 'Lamina Encantada';   // motor.js:25
        if (o.id === '4629') o.cdr = 0.15;                    // motor.js:31
        if (o.id === '3108') o.cdr = 0.05;                    // motor.js:32
        if (o.id === '3802') o.cdr = 0.05;                    // motor.js:33
        return o;
      });
      const mundo = (itens) => {
        const m = criarMundo();
        const a = carregarAutomation(m);
        alimentarCatalogo(m, itens);
        return a;
      };
      // --- com o cru, os 6 itens nao tem os campos (o defeito) ---
      const aCru = mundo(CRU);
      t.check('H16: com o catalogo CRU o 4629 (Impeto) nao da CDR nenhum', aCru.statsSet(['4629']).cdr === 0);
      t.check('H16: com o cru o 2022 nao da CDR nenhum', aCru.statsSet(['2022']).cdr === 0);
      t.check('H16: com o cru o 3108 nao da CDR nenhum', aCru.statsSet(['3108']).cdr === 0);
      t.check('H16: com o cru o 3802 nao da CDR nenhum', aCru.statsSet(['3802']).cdr === 0);
      // --- com o remendado, os campos aparecem ---
      const aRem = mundo(REMENDA);
      t.check('H16: com o REMENDA o 4629 da 0,15 de CDR (motor.js:31)', aRem.statsSet(['4629']).cdr === 0.15);
      t.check('H16: com o REMENDA o 2022 da 0,05 de CDR (motor.js:23)', aRem.statsSet(['2022']).cdr === 0.05);
      t.check('H16: com o REMENDA o 3108 da 0,05 de CDR (motor.js:32)', aRem.statsSet(['3108']).cdr === 0.05);
      t.check('H16: com o REMENDA o 3802 da 0,05 de CDR (motor.js:33)', aRem.statsSet(['3802']).cdr === 0.05);
      // o EFEITO do 3057 (motor.js:25) passa a ser visivel
      t.check('H16: com o REMENDA o 3057 (Fulgor) traz o efeito (motor.js:25)',
        String(((aRem.efeitosEquipados(['3057']).itens || [])[0] || {}).efeito || '').length > 0);
      t.check('H16: e com o cru esse efeito NAO existe',
        String(((aCru.efeitosEquipados(['3057']).itens || [])[0] || {}).efeito || '').length === 0);
      // regen do 1006 (motor.js:24): o campo chega ao catalogo
      const perola = REMENDA.filter((i) => i.id === '1006')[0];
      t.check('H16: o 1006 (Perola) traz regen 3 com o REMENDA (motor.js:24)', perola.regen === 3);
      t.check('H16: e NAO traz com o cru', CRU.filter((i) => i.id === '1006')[0].regen == null);
      // --- a media de CDR dos lendarios muda: o Impeto passa a pontuar ---
      t.check('H16: com o REMENDA o CDR do conjunto 4629+3108 = 0,20',
        Math.abs(aRem.statsSet(['4629', '3108']).cdr - 0.20) < 1e-9);
      t.check('H16: e com o cru o mesmo conjunto da 0', aCru.statsSet(['4629', '3108']).cdr === 0);
      // --- TIERDE (motor.js:252) ja vem da escala do motor: 1 qualidade = 1,25 refinos ---
      // (H10 prova os casos; aqui confirma-se a formula com os numeros do motor)
      t.check('H16: tierDe(A+0)=1,15 vs B+2=1,24: 1 qualidade(A)=`~`1,25 refinos',
        aRem.tierDe({ qual: 'A', refino: 0 }) === 1.15 && aRem.tierDe({ qual: 'B', refino: 2 }) === 1.24);
      t.check('H16: A+0 (1,15) ja bate B+1 (1,12) - o que o qIdx*10 perdia',
        aRem.tierDe({ qual: 'A', refino: 0 }) > aRem.tierDe({ qual: 'B', refino: 1 }));
    }
  },
};



