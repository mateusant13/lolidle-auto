/*
 * pve-sempre.test.mjs - AS TRÊS ORDENS DO DONO DE 2026-10-22:
 *
 *   1) "Sem tarefa ativa. Fala com o Capitão da Legião na Fonte." NUNCA pode acontecer —
 *      "é pra estar em missão sempre". Defeito medido: o `_ultimaTarefa` era carimbado ANTES da
 *      rotina, o `n.tarefa` já ia falso para dentro do `acaoBase`, o passo nunca corria e o
 *      carimbo renovava-se a cada 5 min. Eternamente sem missão.
 *
 *   2) "Identifica ... skills que NÃO são ativadas no PvE ... e não coloque na rotação."
 *      A `B` da Katarina (`motor.js:1695`: só com vida < 55% ou chefe a carregar) ficava na
 *      barra sem nunca entrar em recarga. O detetor lê o KIT — logo vale para os outros
 *      campeões e para qualquer um lançado depois.
 *
 *   3) "Se eu morro pro chefe mas sobrevivo pros mobs, eu devo ir farmar ... a extensão deve me
 *      enviar pra base assim que o chefe é detectado." O `estimarRegiao` somava mobs+chefe num
 *      só veredicto, e a região era recusada mesmo SEM chefe no mapa.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import fs from 'node:fs';
import path from 'node:path';
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao, alimentarMeta, RAIZ } from './dom-stub.mjs';

/** Kit da Katarina REAL, lido do jogo vivo (REGRA N.º 3: o numero e' LIDO, nunca copiado). */
function kitKatarinaVivo() {
  const p = path.join(RAIZ, 'docs/game-src/kit-katarina-vivo.json');
  const v = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\/\/.*$/gm, ''));
  const kit = v && v.kit && v.kit.hab ? v.kit.hab : null;
  if (!kit) throw new Error('kit-katarina-vivo.json sem .kit.hab');
  return kit;
}

const RANKS = { Q: 10, W: 6, E: 6, R: 3, G: 4, A: 2, F: 1, B: 1, T: 1 };

/** Mundo com a Katarina (kit vivo) e os ranks reais — o mesmo caminho do jogo. */
function mundoKatarina() {
  const m = criarMundo();
  const auto = carregarAutomation(m);
  alimentarCatalogo(m);
  definirCampeao(m, 'katarina', { kit: kitKatarinaVivo(), magia: true });
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
  m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
  m.montar('#hab-ativas .hab[data-t]', Object.keys(RANKS).map((tt) => m.el({
    tag: 'div', label: 'hab-' + tt, className: 'hab', dataset: { t: tt },
    textContent: RANKS[tt] + ' / 10',
  })));
  return { m, auto };
}

/** Zonas e monstros no formato do inject (coeficientes do motor, relativos a CURVA). */
const LOCAIS = [
  { id: 'lobos', nome: 'Toca dos Lobos', nm: [25, 32], faixa: [25, 32], tier: 1,
    monstros: [['lobo', 1]], chefe: null },
  { id: 'barao', nome: 'Covil do Barao', nm: [29, 36], faixa: [29, 36], tier: 7,
    monstros: [['larv', 1]], chefe: ['barao', 0.05] },
  { id: 'fj', nome: 'Floresta dos Pinheiros Brancos', faixa: [1, 60], tier: 9, mundo: 'freljord',
    monstros: [['lobo', 1]], chefe: null },
];
const MONSTROS = {
  lobo: { hp: 1.0, ad: 1.0, as: 1.0, armadura: 1.0, xp: 1.0, ouro: 1.0 },
  larv: { hp: 0.5, ad: 0.6, as: 1.2, armadura: 0.6, xp: 0.4, ouro: 0.4 },
  barao: { hp: 6.0, ad: 2.2, as: 0.7, armadura: 1.8, xp: 6.0, ouro: 6.0, chefe: true },
};

export const suite = {
  nome: 'pve-sempre',
  titulo: 'Sempre em missão, skills fora da rotação do PvE e chefe-fatal sem matar o farm',

  async run(t) {
    /* ================= 1) TAREFA: NUNCA FICAR SEM MISSÃO ================= */
    {
      const m = criarMundo();
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      // Sem `#rastreio-tarefa` no DOM = sem missão aceita (o estado medido pelo dono).
      const st = auto.tarefaEstado();
      t.check('T1: o cenario e sem missao (tarefaEstado().tem === false)', st.tem === false);
      const n = auto.necessidadesBase();
      t.check('T1: SEM missao a necessidade `tarefa` esta LIGADA (antes o cooldown de 5 min a desligava)',
        n.tarefa === true);
      t.check('T1: o estado da tarefa e exposto (tem=false)', n._tarefa && n._tarefa.tem === false);

      auto.setConfig({ autoTarefa: false });
      t.check('T2: com o interruptor desligado a necessidade nao pede tarefa', auto.necessidadesBase().tarefa === false);
      auto.setConfig({ autoTarefa: true });
      t.check('T2: religado volta a pedir imediatamente', auto.necessidadesBase().tarefa === true);
    }

    /* ================= 2) SKILL QUE O PvE NÃO ATIVA ================= */
    {
      const { auto } = mundoKatarina();
      t.check('S1: a B da Katarina (Passo das Sombras) e reconhecida como NAO-ativa no PvE',
        auto.habilidadeAtivaNoPve('B') === false);
      t.check('S1: a Q (Lâmina Saltitante) continua ativa', auto.habilidadeAtivaNoPve('Q') === true);
      t.check('S1: a W (Preparação, deixa adaga) continua ativa', auto.habilidadeAtivaNoPve('W') === true);
      t.check('S1: a R (ultimate) tem lugar garantido', auto.habilidadeAtivaNoPve('R') === true);
      t.check('S1: a D e passiva -> nunca entra na rotacao', auto.habilidadeAtivaNoPve('D') === false);

      const arsenal = Object.keys(RANKS).map((tt) => ({ t: tt, rank: RANKS[tt] }));
      const bar = auto.barraIdeal({ arsenal }, 'mobs');
      t.check('S2: a barra ideal NAO coloca a B (skill que o PvE nao usa)', bar.indexOf('B') < 0);
      t.check('S2: a barra continua com 4 slots (nao perde lugar)', bar.length === 4);
      const barChefe = auto.barraIdeal({ arsenal }, 'boss');
      t.check('S2: e a ultimate continua dentro da barra de CHEFE', barChefe.indexOf('R') >= 0);
      t.check('S2: nem na barra de chefe a B entra', barChefe.indexOf('B') < 0);

      /* S3 - PROVA DISCRIMINANTE: um kit com SÓ 3 skills ativas. Sem o filtro, a B (defensiva)
       * ocupava o 4.º lugar por ser a única que sobra — era assim que ela "entrava e ficava". */
      const m2 = criarMundo();
      const auto2 = carregarAutomation(m2);
      alimentarCatalogo(m2);
      const kitPequeno = {
        Q: { max: 5, base: [50, 70], ratio: [0.5, 0.6], recarga: [10, 9] },
        W: { max: 5, base: [40, 60], ratio: [0.4, 0.5], recarga: [12, 11] },
        E: { max: 5, base: [60, 80], ratio: [0.5, 0.6], recarga: [14, 13] },
        B: { max: 5, some: 1.5, janela: 5, bonusSombra: [1, 0.08], recarga: [24, 22] },
      };
      definirCampeao(m2, 'katarina', { kit: kitPequeno, magia: true });
      m2.montar('#hud-nivel', [m2.el({ label: 'hud-nivel', textContent: '29' })]);
      m2.montar('#hud-vida-txt', [m2.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
      m2.montar('#hab-ativas .hab[data-t]', ['Q', 'W', 'E', 'B'].map((tt) => m2.el({
        tag: 'div', label: 'hab2-' + tt, className: 'hab', dataset: { t: tt }, textContent: '1 / 5',
      })));
      const arsenal2 = ['Q', 'W', 'E', 'B'].map((t2) => ({ t: t2, rank: 1 }));
      const bar2 = auto2.barraIdeal({ arsenal: arsenal2 }, 'mobs');
      t.check('S3: com 3 skills ativas a barra fica com 3 (a B NAO ocupa a 4.ª vaga)', bar2.length === 3);
      t.check('S3: e a B nao esta entre elas', bar2.indexOf('B') < 0);
    }

    /* ================= 3) MOBS vs CHEFE: DOIS RISCOS SEPARADOS ================= */
    {
      // Boneco fraco (nivel 29) numa zona de chefe: os MOBS (`larv`) são triviais; o BARAO é um
      // muro (hp/ad muito acima). Antes: `morte=true` -> região recusada SEMPRE, mesmo sem chefe
      // no mapa. O DPS é MEDIDO (ciclo no storage), senão o fail-closed declara tudo mortal.
      const MONSTROS_BOSS_MURO = Object.assign({}, MONSTROS, {
        barao: { hp: 40, ad: 30, as: 0.8, armadura: 2.5, xp: 6, ouro: 6, chefe: true },
      });
      const store = {};
      store['lolidleAutoPotion:farm'] = {
        cycles: [{ region: 'Toca dos Lobos', gold: 3000, xp: 9000, fase: 'mobs', janela: 'jE',
          mobFase: { startedAt: 0, durMs: 60000, perMin: { gold: 3000, xp: 9000, kills: 60, potions: 0, goldPotion: 0, healSkill: 0, healPotion: 0 }, gold: 3000, xp: 9000, kills: 60 } }],
        log: [], issues: [], deaths: [],
      };
      const m = criarMundo({ storage: store });
      const auto = carregarAutomation(m);
      alimentarCatalogo(m);
      definirCampeao(m, 'adtest');
      m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: '29' })]);
      m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: '29' })]);
      m.montar('#hud-vida-txt', [m.el({ label: 'hud-vida-txt', textContent: '4188 / 4188' })]);
      alimentarMeta(m, { locais: LOCAIS, monstros: MONSTROS_BOSS_MURO, grupoSpawn: { base: 2, rand: 3 } });

      const bar = auto.estimarRegiao('barao');
      t.check('C1: a zona de chefe devolve estimativa', !!bar);
      t.check('C1: os MOBS sao dados como seguros (mobsSeguros)', bar.mobsSeguros === true);
      t.check('C1: o CHEFE e dado como fatal (chefeFatal)', bar.chefeFatal === true);
      t.check('C1: mesmo com o chefe fatal, os mobs RENDEM (xpMinReal > 0)', bar.xpMinReal > 0);
      t.check('C1: e o ouro real tambem > 0', bar.goldMinReal > 0);
      t.check('C1: o tecto fica separado do real (xpMin >= xpMinReal)',
        bar.xpMin >= bar.xpMinReal && bar.xpMin > 0);
      t.check('C1: a regiao continua a servir para farmar (mobsSeguros -> regiaoSegura)',
        auto.estimarRegiao('barao').mobsSeguros === true);
      t.check('C1b: os dois riscos sao CAMPOS SEPARADOS (mobsMatam=false, chefeMatam=true)',
        bar.mobsMatam === false && bar.chefeMatam === true);
      // ATRIBUICAO DA MORTE MEDIDA (ordem do dono, 2026-10-23): quem matou decide o veredicto.
      // Antes, o `risco.rmorte` do agregado (risco do CHEFE) era lido como "os mobs matam" e a
      // primeira morte no Covil condenava a regiao inteira.
      auto.importar({ farm: { deaths: [{ at: 1, by: 'barao', region: 'Covil do Barao 29-36' }] } });
      const eChefe = auto.estimarRegiao('barao');
      t.check('C3: morte causada pelo CHEFE nao acusa os mobs como letais', eChefe.mobsMatam === false);
      auto.importar({ farm: { deaths: [{ at: 2, by: 'larv', region: 'Covil do Barao 29-36' }] } });
      t.check('C4: morte causada por um MOB acusa mobsMatam', auto.estimarRegiao('barao').mobsMatam === true);

      // COntraste: a zona do Freljord nao pode sequer entrar no planejador de item.
      alimentarMeta(m, { ondeItem: { '3089': { fj: { zona: LOCAIS[2], porClasse: { ap: 0.5 } },
        barao: { zona: LOCAIS[1], porClasse: { ap: 0.02 } } } } });
      const plano = auto.planejar(['3089']);
      t.check('C2: o planejador NAO oferece a zona do Freljord (fora do Rift)',
        (plano || []).every((x) => x.zona !== 'fj'));
      t.check('C2: e mantem a zona do Rift (barao)', (plano || []).some((x) => x.zona === 'barao'));
      // A ROTA QUE O DONO PEDIU: Rabadon (3089) no Covil do Barao. O chefe mata (medido), os
      // mobs nao -> a zona TEM de ficar na rota e o resto e a fuga quando ele aparece.
      auto.importar({ farm: { deaths: [] } });
      const rota3089 = auto.planejarRota(['3089']) || [];
      t.check('C2b: so o CHEFE matar nao tira a zona da rota (Rabadon no Barao)',
        rota3089.some((p) => p.regiao === 'barao'));
      t.check('C2c: e a rota nao ganha passos fora do Rift', rota3089.every((p) => p.regiao !== 'fj'));
    }

    /* ================= 4) LOG: A ROTACAO NAO AFUNDA O HISTORICO ================= */
    {
      // DEFEITO MEDIDO (2026-10-23): o `rotacao` corre a cada ~2 s e o anel de 200 ficou
      // 100% rotacao/evento — `base`, `morte` e `chefe-fatal` eram expulsos antes de alguem
      // os ler. O dono perguntou "como chegou a esse ponto?" e o log nao tinha resposta.
      const m = criarMundo();
      const a = carregarAutomation(m);
      alimentarCatalogo(m);
      a.logEvent('rotacao', { mudou: true, alvo: 'X' });
      a.logEvent('rotacao', { mudou: true, alvo: 'Y' });
      a.logEvent('morte', { by: 'barao', region: 'Covil do Barao' });
      a.logEvent('rotacao', { mudou: true, alvo: 'Z' });
      const log = a.exportar().farm.log;
      const nRot = log.filter((e) => e.type === 'rotacao').length;
      t.check('L1: rotacao repetida ocupa UMA entrada (coalescida)', nRot === 1);
      t.check('L2: o evento de morte sobrevive a rotacao', log.some((e) => e.type === 'morte'));
      const antes = a.exportar().farm.log.length;
      a.logEvent('rotacao', { mudou: false });
      t.check('L3: rotacao sem mudanca nao entra no log', a.exportar().farm.log.length === antes);
    }
  },
};
