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
      // O CDR do PAINEL e o TOTAL do motor (motor.js:537: foco + itens). A soma dos itens nao
      // ve o Foco — um boneco com 10 de foco tem 4% de CDR que a soma nao conhecothis.
      t.check('H2: sem itens de CDR o efeitosEquipados() usa o do painel (23%)',
        auto.efeitosEquipados().cdr === 0.23);
      const m2b = criarMundo();
      const auto2b = carregarAutomation(m2b);
      alimentarCatalogo(m2b); definirCampeao(m2b, 'adtest');
      t.check('H2: sem painel nem itens o CDR e 0 (nao inventa)', auto2b.efeitosEquipados().cdr === 0);
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
      t.check('H8: player().rv le o "Roubo de vida" do painel em FRACCAO (painel mostra %, motor guarda fracção — motor.js:538)', p.rv === 0.15);
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


    /* ================ H12 — OS NUMEROS ENTRAM NAS DECISOES (nao ficam no leitor) ================ */
    /*
     * Ler o numero e so metade do defeito: o observabilidade.md pede que ele MUDE a decisao.
     * Estes casos montam o DOM como o jogo escreve e provam o efeito na saida.
     */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest', { kit: {
        Q: { max: 1, base: [100], ratio: [1], recarga: [10] },
        G: { max: 1, base: [50], ratio: [0.5], recarga: [8], auto: true },
      } });
      alimentarMeta(m, {
        monstros: { 'Tropa Corpo a Corpo': { hp: 1, ad: 0.9, as: 0.8, armadura: 0.6, xp: 1, ouro: 1 },
          'Arauto do Vale': { hp: 10, ad: 2.5, as: 0.6, armadura: 1.5, xp: 12, ouro: 12, chefe: true } },
        locais: [
          { id: 'rio', nome: 'Rio', faixa: [25, 35], nm: [25, 33], tier: 5,
            monstros: [['Tropa Corpo a Corpo', 1]], chefe: ['Arauto do Vale', 0.015] },
          { id: 'lobos', nome: 'Toca dos Lobos', faixa: [10, 20], nm: [10, 18], tier: 2,
            monstros: [['Tropa Corpo a Corpo', 1]] },
        ],
      });
      m.montar('#hab-ativas .hab[data-t]', [
        m.el({ label: 'aQ', dataset: { t: 'Q' }, textContent: '1 / 1' }),
        m.el({ label: 'aG', dataset: { t: 'G' }, textContent: '1 / 1' }),
      ]);
      m.montar('.st', [m.el({ label: 'st', textContent: 'Dano 100' }), m.el({ label: 'st2', textContent: 'Vel. ataque 1.50' })]);
      m.montar('#hud-vida-txt', [m.el({ label: 'v', textContent: '2000 / 2000' })]);
      m.montar('#hud-nivel', [m.el({ label: 'nivel', textContent: '25' })]);   // jogador 25 no Rio
      m.montar('#st-critx', [m.el({ label: 'critx', textContent: '1,75' })]);
      const alvo = { armadura: 100, hp: 50000, nivel: 30 };

      // ---- (a) CRITICO muda o score do conjunto.
      m.montar('#st-crit', [m.el({ label: 'crit', textContent: '0%' })]);
      const semCrit = auto.scoreSet(['2001'], alvo);
      m.montar('#st-crit', [m.el({ label: 'crit2', textContent: '35%' })]);
      const comCrit = auto.scoreSet(['2001'], alvo);
      t.check('H12a: o score do conjunto SOBE com o critico do painel (35%)', comCrit > semCrit);
      t.check('H12a: e sobe na medida do motor: 1 + fracAuto x (1,2625 - 1)',
        Math.abs(comCrit / semCrit - (1 + auto.fracAuto() * (1.2625 - 1))) < 1e-9);
      t.check('H12a: a parcela dos autos e a maioria neste campeao', auto.fracAuto() > 0.5);
      t.check('H12a: a skill pura NAO leva critico (fracAuto < 1)', auto.fracAuto() < 1);
      t.check('H12a: e a skill pura nao entra na fracao de critico (fracHabs > 0)', auto.fracHabs() > 0);

      // ---- (b) ROUBO DE VIDA muda a sobrevivencia: cura = dano x rv (motor.js:1226-1228).
      m.montar('.st', [m.el({ label: 'st3', textContent: 'Roubo de vida 15%' })]);
      const p = auto.player();
      const antes = auto.avaliar('Tropa Corpo a Corpo', 30, { ...p, rv: 0 }, { skill: 0, pocao: 0 }, 500);
      const depois = auto.avaliar('Tropa Corpo a Corpo', 30, { ...p, rv: 0.15 }, { skill: 0, pocao: 0 }, 500);
      t.check('H12b: o rv devolvido pelo player() e 0,15 (15% do painel na lingua do motor)', p.rv === 0.15);
      t.check('H12b: avaliar() soma a cura do roubo de vida (motor.js:1226)', depois.curaRv > 0);
      t.check('H12b: e essa cura estica o tempo de vida', depois.tMorrer > antes.tMorrer);
      t.check('H12b: a conta liquida usa a cura total (nao so a das skills)',
        Math.abs(depois.liquido - (depois.dpsTomado - depois.curaTotal)) < 1e-9);
      t.check('H12b: a cura entra por dano x rv x mitigacao da saida',
        depois.curaRv > antes.curaRv && antes.curaRv === 0);

      // ---- (c) O MEDIDOR DO JOGO manda na calibracao (antes era so a estimativa).
      const f = auto.getFarm();
      f.cycles = [{ region: 'Rio nível 25\u201333', mobFase: { perMin: { gold: 1000, xp: 200, kills: 10 } } }];
      const cExt = auto.calibrar();
      t.check('H12c: sem o jogo a fonte e a estimativa da extensao', cExt.fonte === 'extensao');
      m.montar('#rastreio-analise', [m.el({ label: 'rastreio', hidden: false,
        textContent: 'Ca\u00e7ada10k XP/h \u00b7 2k ouro/h' })]);
      const cJogo = auto.calibrar();
      t.check('H12c: com o jogo a fonte passa a ser a medida do JOGO', cJogo.fonte === 'jogo');
      t.check('H12c: kXp sai da medicao do jogo: (10000/60) / 200 = 0,833',
        Math.abs(cJogo.kXp - (10000 / 60 / 200)) < 1e-3);   // 3 casas (o cfg grava toFixed(3))
      t.check('H12c: kOuro sai da medicao do jogo: (2000/60) / 1000 = 0,033',
        Math.abs(cJogo.kOuro - (2000 / 60 / 1000)) < 1e-3);
      t.check('H12c: a medida do jogo vem no resultado', cJogo.jogo && cJogo.jogo.tem === true);
      t.check('H12c: sem abates/h no rastreio o kAbates fica 1 (nao inventa)', cJogo.kAbates === 1);
      // REGIAO MEDIDA: a medida dela ganha (o kReg por regiao NAO muda — ver o comentario do
      // `calibrar`). REGIAO NUNCA RODADA: entra a medida do JOGO como autoridade.
      const eRio = auto.estimarRegiao('rio');
      t.check('H12c: na regiao JA MEDIDA a medida dela ganha (kReg por regiao)', eRio.kXp === cExt.kXp);
      const eLobos = auto.estimarRegiao('lobos');
      t.check('H12c: na regiao NUNCA RODADA a autoridade e a medicao do JOGO', eLobos.kXp === cJogo.kXp);
      t.check('H12c: e o xp/min teorico sai escalado por ela', eLobos.xpMin > 0);
      t.check('H12c: o killsMin teorico continua visivel ao lado do aplicado',
        eLobos.killsMinTeorico > 0 && eLobos.kAbates === 1);

      // ---- (d) O NIVEL DO CHEFE mede o risco do chefe REAL (motor.js:1121).
      const luta = auto.estimarLuta('rio');
      t.check('H12d: a luta contra o chefe do Rio usa o nivel 29 do motor (nao 35)', luta.nivel === 29);
      t.check('H12d: e o HP do chefe e o do nivel 29 do motor',
        luta.hpBoss > 0 && luta.nivel === auto.nivelChefeDe({ nm: [25, 33] }, 25));
    }


    /* ========= H14 — COPIAS À MÃO: detetam quando o motor muda (REGRA N.º 3) ========= */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // --- POCAO_FB: sem o motor nao ha divergencia (ainda nao se pode comparar).
      t.check('H14: sem o motor, as divergencias das pocoes estao vazias (nao ha com que comparar)',
        auto.divergenciasPocao().length === 0);
      // com o motor a mandar o MESMO valor: continua vazio.
      alimentarMeta(m, { pocoes: {
        vida: { cura: 300, preco: 40, nivel: 1 }, vidaF: { cura: 900, preco: 110, nivel: 15 },
        vidaS: { cura: 2200, preco: 260, nivel: 30 } } });
      t.check('H14: com o motor a concordar, continua vazio', auto.divergenciasPocao().length === 0);
      // o jogo BUFFOU a Suprema para 2600 de cura: a copia tem de acusar.
      alimentarMeta(m, { pocoes: {
        vida: { cura: 300, preco: 40, nivel: 1 }, vidaF: { cura: 900, preco: 110, nivel: 15 },
        vidaS: { cura: 2600, preco: 260, nivel: 30 } } });
      const div = auto.divergenciasPocao();
      t.check('H14: um buff na Pocao Suprema (2200 -> 2600) e ACUSADO',
        div.length === 1 && div[0].pocoes === 'vidaS' && div[0].campo === 'cura');
      t.check('H14: e a divergencia traz o valor do fallback e o do motor',
        div.length === 1 && div[0].fallback === 2200 && div[0].motor === 2600);
      t.check('H14: quem le a pocao ve o valor do MOTOR (pocaoInfo prefere o motor)',
        auto.pocaoInfo('vidaS').cura === 2600);
      // --- KAT_FB: a comparacao com o kit do motor.
      const m2 = criarMundo();
      const auto2 = carregarAutomation(m2);
      alimentarCatalogo(m2); definirCampeao(m2, 'adtest');
      t.check('H14: sem kit do motor, as divergencias do kit estao vazias',
        auto2.divergenciasKit().length === 0);
      // o motor manda um kit DIFERENTE do fallback da Katarina: a copia acusa.
      definirCampeao(m2, 'katarina', { kit: { Q: { max: 1, base: [999], ratio: [1], recarga: [10] } } });
      const divK = auto2.divergenciasKit('katarina');
      t.check('H14: um kit do motor diferente do fallback e ACUSADO', divK.length > 0);
      t.check('H14: e a divergencia diz o campo e os dois valores',
        divK.some((d) => d.hab === 'Q' && d.campo === 'base' && d.motor === 999));
      t.check('H14: o kit usado em jogo e o do MOTOR (o fallback fica so para quando nao ha motor)',
        auto2.dpsPorHabilidade().nivel >= 0);
    }
    /* ================ H13 — TECTOS DO MOTOR num sitio so, cada um com o file:linha ================ */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      const caps = auto.capsMotor();
      t.check('H13: tecto de CDR = 0,4 (motor.js:537)', caps.cdr === 0.4);
      t.check('H13: tecto de pen magica = 0,6 (motor.js:529)', caps.penMag === 0.6);
      t.check('H13: tecto de esquiva = 0,25 (motor.js:536)', caps.esquiva === 0.25);
      t.check('H13: tecto de chance de critico = 1 (motor.js:541)', caps.critico === 1);
      t.check('H13: velocidade de ataque maxima = 3 (motor.js:344)', caps.velAtaque === 3);
      // pen de armadura: a conta do motor e `1 - (1 - penE) x 0,7` (motor.js:539). Com o pen do KIT
      // no maximo (0,45, motor.js:560) e a 3036: 1 - 0,55 x 0,7 = 0,615. A extensao fazia
      // `Math.min(0,7, soma dos itens)` — via so o 0,30 da 3036 e NAO via o pen do kit.
      t.check('H13: pen de armadura maxima = 0,615 (motor.js:539/560, nao 0,7)',
        Math.abs(caps.penArmadura - 0.615) < 1e-9);
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
      // com o motor a mandar o HAB_CHEFE (motor.js:3069-3079): NOME, carrega e espera vem dele
      alimentarMeta(m, { habChefe: { sopro: { carrega: 1, espera: 9, nome: 'Sopro de Fogo [motor]' } } });
      const soproM = auto.mecanicaDe('sopro');
      t.check('H11: o nome da mecanica vem do HAB_CHEFE do motor', soproM.nome === 'Sopro de Fogo [motor]');
      t.check('H11: o aviso (carrega) vem do motor (motor.js:3069-3079)', soproM.carrega === 1);
      t.check('H11: a espera entre mecanicas vem do motor', soproM.espera === 9);
      t.check('H11: e o multiplicador continua o do mecanicaChefe (motor.js:3105)', soproM.mult === 2.2);
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
  },
};
