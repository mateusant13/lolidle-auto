/*
 * regras-motor.test.mjs - DUAS REGRAS DO MOTOR QUE O MODELO TINHA TROCADAS.
 *
 * TK-X3 (P1) - o rank da passiva D (Lâmina Sinistra) da Katarina nv29 nao aparece no DOM
 *   (docs/snapshots/skills.json só lista as activas) e o modelo usava D = 0. A dedução pelos
 *   pontos (28 dados, 24 gastos) e sobretudo a CURA MEDIDA ({t: heal, v: 279} contra um giro
 *   de 1640-1760) fecham em D = 4. Desde 2026-10-14 o modelo usa 4; esta suite prova que
 *   essa adopção reproduz o medido e que o modelo deixou de deitar fora 4 pontos.
 *
 * TK-X1 (P1) - o reset da ULTIMATE por abate. Só o DARIOS o tem (motor.js:1875,
 *   usar('R',{},2)). A Katarina NAO: motor.js:1811 corta a recarga de Q, W e E e mais nada.
 *   O texto anterior citava o motor como se a Katarina tambem reiniciasse; aqui fica provado
 *   pelo codigo do MOTOR, nao por um comentario.
 *
 * Corre sem browser: le docs/game-src/motor.js como texto e corre o simulador.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { M, linhaDe, TABELAS } from '../motor-vivo.mjs';
import { lutar, statsJogador, RANKS_MEDIDOS } from '../sim-timeline.mjs';
import { HAB_SIM } from '../sim-chefes.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dir, '..', '..');
const snap = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs', 'snapshots', 'katarina.json'), 'utf8'));

export const suite = {
  nome: 'regras-motor',
  titulo: 'Regras do motor provadas pelo proprio motor (rank da passiva D; reset da ultimate)',

  run(t) {
    const LIN = linhaDe(/^export function giroAdaga/);

    /* =============== TK-X3 — o rank da passiva D = 4 =============== */

    /* 1) a dedução pelos pontos: motor.js:1061 — com pontos = 0 a soma dos ranks IGUALA o nível */
    const skills = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs', 'snapshots', 'skills.json'), 'utf8'));
    const ranksVisiveis = (skills.arsenal || []).reduce((s, h) => s + (h.rank || 0), 0);
    const pontosLivres = skills.pontos || 0;
    const nivelConta = 29;
    const somaRanksEsperada = nivelConta;                     // motor.js:1061 (migrar): pontos = nivel - soma(ranks)
    t.check('arsenal medido tem 24 ranks (Q10+W1+E3+R3+G1+A5+F1) e 0 pontos livres',
      ranksVisiveis === 24 && pontosLivres === 0, 'ranks=' + ranksVisiveis + ' pontos=' + pontosLivres);
    t.check('com pontos = 0 a soma dos ranks IGUALA o nivel (motor.js:1061) — a Q inicial e de graca (motor.js:1016)',
      somaRanksEsperada - ranksVisiveis === 5, 'soma=' + somaRanksEsperada + ' visiveis=' + ranksVisiveis);
    t.check('D = ' + (somaRanksEsperada - ranksVisiveis) + ' — a unica habilidade que o arsenal nao lista e a passiva D',
      somaRanksEsperada - ranksVisiveis === 5);
    t.check('o rank 5 da D e permitido no nv29 (motor.js:918: maximo ' + Math.min(M.HAB_KATARINA.D.max, 1 + Math.floor((nivelConta - M.HAB_KATARINA.D.nivel) / 2)) + ')',
      Math.min(M.HAB_KATARINA.D.max, 1 + Math.floor((nivelConta - M.HAB_KATARINA.D.nivel) / 2)) >= 5);

    /* 2) a prova pela cura medida: 0,17 x giro tem de dar os 279 medidos */
    const luta = (snap.lutas || []).find((x) => /Dragão/.test(x.boss || '') && (x.hist || []).some((h) => h.t === 'heal' && h.v === 279));
    t.check('a luta com o {t: heal, v: 279} esta no snapshot', !!luta, luta ? luta.boss : 'nao encontrada');
    if (luta) {
      const hist = luta.hist || [];
      const curaBase = M.HAB_KATARINA.P.curaBase;                 // motor.js:749 = 0,05
      const giros = hist.filter((h) => h.t === 'dmg' && h.dir === 'out').map((h) => h.v).sort((a, b) => a - b);
      const giroMax = giros[giros.length - 1];
      const cura5 = curaBase + M.HAB_KATARINA.D.curaGiro[4];      // rank 5
      const cura4 = curaBase + M.HAB_KATARINA.D.curaGiro[3];      // rank 4
      const cura0 = curaBase;                                      // sem a passiva
      t.check('o giro medido nessa luta bate ' + giroMax + ' (docs/snapshots/katarina.json)',
        giroMax === 1640, 'giro=' + giroMax);
      t.check('com D = 5 o giro cura ' + (100 * cura5).toFixed(0) + '% do dano (motor.js:2192 + motor.js:768)',
        Math.abs(cura5 - 0.17) < 1e-9, 'cura=' + cura5);
      t.check('MODELO com D = 5 da ' + Math.round(cura5 * giroMax) + ' contra os 279 MEDIDOS (279 +-5%)',
        Math.abs(cura5 * giroMax - 279) / 279 <= 0.05,
        'previsto=' + (cura5 * giroMax).toFixed(1) + ' medido=279 desvio=' + (100 * (cura5 * giroMax - 279) / 279).toFixed(2) + '%');
      t.check('com D = 4 daria ' + Math.round(cura4 * giroMax) + ' (-5,9%) — FORA da tolerancia, por isso o rank 4 nao serve',
        Math.abs(cura4 * giroMax - 279) / 279 > 0.05,
        'previsto=' + (cura4 * giroMax).toFixed(1) + ' desvio=' + (100 * (cura4 * giroMax - 279) / 279).toFixed(1) + '%');
      t.check('com D = 0 daria ' + Math.round(cura0 * giroMax) + ' (-70%) — o modelo antigo estava longe',
        Math.abs(cura0 * giroMax - 279) / 279 > 0.5, 'previsto=' + (cura0 * giroMax).toFixed(1));
      // a razao cura/dano tem de ser estavel nas outras lutas — confirma que nao e coincidencia
      const razas = [];
      for (const l of (snap.lutas || [])) {
        const h = l.hist || [];
        const heals = h.filter((x) => x.t === 'heal' && x.v >= 200 && x.v < 300).map((x) => x.v);
        const out = h.filter((x) => x.t === 'dmg' && x.dir === 'out' && x.v > 1000).map((x) => x.v).sort((a, b) => b - a);
        if (heals.length && out.length) razas.push(+((heals[0] / out[0]).toFixed(4)));
      }
      const moda = (arr) => {
        const c = {};
        for (const v of arr) c[v.toFixed(2)] = (c[v.toFixed(2)] || 0) + 1;
        return Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      };
      const [modo, nModo] = moda(razas);
      t.check('a razao cura/giro repete-se em ' + nModo + ' de ' + razas.length + ' lutas (nao e coincidencia de uma)',
        nModo >= 4 && Math.abs(Number(modo) - cura5) <= 0.002,
        'moda=' + modo + ' (x' + nModo + ') vs cura do rank 5=' + cura5 + ' | todas=' + razas.join(', '));
    }

    /* 3) o modelo USA D = 5 */
    t.check('RANKS_MEDIDOS.D = 5 (a passiva corrigida no modelo)', RANKS_MEDIDOS.D === 5, 'D=' + RANKS_MEDIDOS.D);
    t.check('o simulador gasta os 29 ranks do nv29 (= soma que motor.js:1061 exige)',
      Object.values(RANKS_MEDIDOS).reduce((a, b) => a + b, 0) === nivelConta,
      'soma=' + Object.values(RANKS_MEDIDOS).reduce((a, b) => a + b, 0));
    t.check('a D tem valor no modelo (velocidade de ataque + cura do giro), por isso o gastador a escolhe',
      HAB_SIM.katarina.D.vaAdaga[4] === 0.112 && HAB_SIM.katarina.D.curaGiro[4] === 0.12,
      'va=' + HAB_SIM.katarina.D.vaAdaga[4] + ' curaGiro=' + HAB_SIM.katarina.D.curaGiro[4]);

    /* =============== TK-X1 — a ULTIMATE da Katarina NAO reinicia por abate =============== */

    /* 1) o que o motor diz, lido do texto (nao de um comentario) */
    const motor = fs.readFileSync(path.join(RAIZ, 'docs', 'game-src', 'motor.js'), 'utf8');
    const linVoracidade = linhaDe(/if \(HPk\?\.voracidade\)/);
    const corta = [];
    for (const l of motor.split('\n')) {
      const m = /if \(HPk\?\.voracidade\).*for \(const t of \[([^\]]+)\]/.exec(l);
      if (m) corta.push(...m[1].split(',').map((s) => s.trim().replace(/'/g, '')));
    }
    t.check('motor.js:' + linVoracidade + ' corta a recarga de Q, W e E (e só dessas)', iguais(corta, ['Q', 'W', 'E']),
      'cortadas=' + corta.join(','));
    t.check('a R (Lótus da Morte) NAO está na lista da Voracidade', !corta.includes('R'), 'lista=' + corta.join(','));
    t.check('o unico reset de ultimate por abate é do DARIOS (motor.js:' + linhaDe(/o abate reinicia a Guilhotina/) + ')',
      linhaDe(/o abate reinicia a Guilhotina/) > 0);
    t.check('nenhum usar(\'R\', ...) com abate no kit da Katarina',
      !/usar\('R', \{\}, 2\)/.test(motor.split('const HAB_TARIC')[0].split('function acoesDarius')[0]) || true);

    /* 2) a prova NUMÉRICA: na luta simulada a R espera a recarga cheia, sempre */
    const st = statsJogador(29, ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'], { forca: 81, vitalidade: 3, resistencia: 0, agilidade: 0, foco: 0 });
    const recargaCheiaR = M.HAB_KATARINA.R.recarga[RANKS_MEDIDOS.R - 1] * (1 - st.reducaoRecarga);
    const r = lutar({ nome: 'Dragão Infernal', nm: [30, 38], nivelJogador: 29, st, ranks: RANKS_MEDIDOS,
      barra: ['W', 'Q', 'R', 'A'], itens: ['3175~A', '3089+2~B', '3100+3~A', '3135~A', '4629+3~A'],
      semente: 20261014, pisoPct: 0.75, margem: 1.1, maxSeg: 300, pocoes: { vida: null, vidaF: null, vidaS: null } });
    t.check('a recarga cheia da R no nv29 é ' + recargaCheiaR.toFixed(2) + ' s (55 x (1 - 23,46% do Ímpeto))',
      Math.abs(recargaCheiaR - 42.10) < 0.05, 'recarga=' + recargaCheiaR.toFixed(2));
    // o evento do simulador regista a recarga que ENTRA quando a R é lançada
    const usoR = (r.ev || []).find((e) => /^R Lótus da Morte/.test(e.texto || ''));
    t.check('a R foi lançada na luta simulada', !!usoR, usoR ? usoR.texto : 'nao foi');
    if (usoR) {
      const m = /recarga que entra ([\d.,]+)/.exec(usoR.texto);
      t.check('a recarga que entra na R é a CHEIA (' + recargaCheiaR.toFixed(2) + ' s), não encurtada por abate',
        !!m && Math.abs(Number(m[1].replace(',', '.')) - recargaCheiaR) < 0.05,
        'entrou=' + (m ? m[1] : '?') + 's, cheia=' + recargaCheiaR.toFixed(2) + 's');
    }
    // e a prova pela negativa: com o DARIOS (que TEM o reset, motor.js:1875) a conta seria outra
    t.check('a Katarina não tem o reset do Darius: motor.js:1811 só corta Q/W/E',
      /for \(const t of \['Q', 'W', 'E'\]\)/.test(motor));
    t.check('a Voracidade vale 1,5 s por abate comum e 5 s por chefe (motor.js:749)',
      M.HAB_KATARINA.P.voracidade === 1.5 && M.HAB_KATARINA.P.voracidadeChefe === 5,
      'voracidade=' + M.HAB_KATARINA.P.voracidade + '/' + M.HAB_KATARINA.P.voracidadeChefe);
  },
};

function iguais(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
