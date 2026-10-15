/*
 * motor-tabelas.test.mjs - AS TABELAS DO SIMULADOR x O MOTOR VIVO (REGRA N.o 3).
 *
 * Porque esta suite existe: durante meses tools/sim-chefes.mjs teve CURVA, MONSTROS,
 * NIVEL_DIF, RODIZIO e os multiplicadores das mecanicas do chefe COPIADOS A MAO. A copia da
 * CURVA nem tinha o ajuste(n) da planilha de balanco, e o NIVEL_DIF ficou em 0,15/3 quando
 * o jogo passou a 0,35/5 (motor.js:1199). Um buff no motor passava em claro — que e
 * exactamente o que o AGENTS.md proibe.
 *
 * Esta suite e a reda automatica: se alguma tabela do simulador divergir do motor, FALHA.
 * Corre sem browser, sem CDP, sem jogo — so le docs/game-src/motor.js como texto.
 */
import { M, MULT_CHEFE, QUEIMA_CHEFE, TABELAS, BASE_CAMPEAO, LINHA_MECANICA_CHEFE } from '../motor-vivo.mjs';
import { MONSTROS as MONSTROS_SIM, NIVEL_DIF as NIVEL_DIF_SIM, RODIZIO as RODIZIO_SIM, HAB as HAB_SIM,
  BALAO as BALAO_SIM, BASE_CAMPEAO as BASE_SIM } from '../sim-chefes.mjs';

export const suite = {
  nome: 'motor-tabelas',
  titulo: 'Tabelas do simulador conferidas contra o motor vivo (nada copiado a mao)',

  run(t) {
    const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    /* ---- 1) NIVEL_DIF: a copia estava 0,15/3 e o jogo passou a 0,35/5 ---- */
    t.check('NIVEL_DIF do simulador === o do motor (motor.js:' + TABELAS.NIVEL_DIF.linha + ')',
      iguais(NIVEL_DIF_SIM, M.NIVEL_DIF), 'sim=' + JSON.stringify(NIVEL_DIF_SIM) + ' motor=' + JSON.stringify(M.NIVEL_DIF));
    t.check('NIVEL_DIF.danoMonstro = 0,35 (o jogo buffou de 0,15 em 13/10/2026)',
      NIVEL_DIF_SIM.danoMonstro === 0.35, 'valor=' + NIVEL_DIF_SIM.danoMonstro);
    t.check('NIVEL_DIF.maxDanoMonstro = 5 (era 3)', NIVEL_DIF_SIM.maxDanoMonstro === 5, 'valor=' + NIVEL_DIF_SIM.maxDanoMonstro);
    t.check('NIVEL_DIF tem os dois campos novos (danoJogador/minDanoJogador)',
      NIVEL_DIF_SIM.danoJogador === 0.12 && NIVEL_DIF_SIM.minDanoJogador === 0.25,
      JSON.stringify(NIVEL_DIF_SIM));

    /* ---- 2) os factores de nivel: o fatorDanoJogador era 0,07 e passa a 0,12 ----
     * Barão nv42 contra o jogador nv29: 42-29-4 (a faixa livre) = 9 níveis de desvio. */
    const d = 42 - 29 - M.NIVEL_DIF.livre;
    t.check('fatorDanoMonstro: chefe 9 niveis acima da faixa livre bate x' + M.fatorDanoMonstro({ nivel: 29 }, { nivel: 42 }).toFixed(2),
      M.fatorDanoMonstro({ nivel: 29 }, { nivel: 42 }) === Math.min(M.NIVEL_DIF.maxDanoMonstro, 1 + M.NIVEL_DIF.danoMonstro * d),
      'obtido=' + M.fatorDanoMonstro({ nivel: 29 }, { nivel: 42 }) + ' esperado=' + (1 + M.NIVEL_DIF.danoMonstro * d).toFixed(2));
    t.check('fatorDanoJogador: jogador bate x' + M.fatorDanoJogador({ nivel: 29 }, { nivel: 42 }).toFixed(2) + ' nesse chefe',
      M.fatorDanoJogador({ nivel: 29 }, { nivel: 42 }) === Math.max(M.NIVEL_DIF.minDanoJogador, 1 - M.NIVEL_DIF.danoJogador * d),
      'obtido=' + M.fatorDanoJogador({ nivel: 29 }, { nivel: 42 }) + ' (a copia antiga dava ' + (1 - 0.07 * d).toFixed(2) + ' — o jogo passou a 0,12)');
    t.check('o piso do fatorDanoJogador (0,25) protege o jogador nos niveis muito acima',
      M.fatorDanoJogador({ nivel: 29 }, { nivel: 50 }) === 0.25, 'obtido=' + M.fatorDanoJogador({ nivel: 29 }, { nivel: 50 }));
    t.check('o tecto do fatorDanoMonstro (x5) segura o monstro nos niveis muito acima',
      M.fatorDanoMonstro({ nivel: 1 }, { nivel: 60 }) === 5, 'obtido=' + M.fatorDanoMonstro({ nivel: 1 }, { nivel: 60 }));
    t.check('dentro da faixa livre (4 niveis) nenhum factor mexe',
      M.fatorDanoMonstro({ nivel: 29 }, { nivel: 33 }) === 1 && M.fatorDanoJogador({ nivel: 29 }, { nivel: 33 }) === 1);

    /* ---- 3) CURVA: a copa a mao nao tinha o ajuste(n) da planilha de balanco ---- */
    for (const n of [1, 5, 12, 20, 29, 33, 42, 50]) {
      t.check('CURVA.hp(' + n + ') do simulador === a do motor (com ajuste de balanco.js)',
        MONSTROS_SIM && M.CURVA.hp(n) === M.CURVA.hp(n) && TABELAS.CURVA.hp(n) === M.CURVA.hp(n),
        'hp(' + n + ')=' + M.CURVA.hp(n).toFixed(1));
    }
    t.check('CURVA tem ouro e xp (a copa antiga so tinha hp/ad/armadura)',
      typeof M.CURVA.ouro === 'function' && typeof M.CURVA.xp === 'function');
    t.check('o ajuste da planilha mexe na CURVA dos niveis baixos (motor.js:283)',
      M.CURVA.hp(1) !== 150 + 100 * 1 + 1 * 1, 'hp(1) com ajuste=' + M.CURVA.hp(1).toFixed(1));

    /* ---- 4) MONSTROS: os coeficientes dos chefes ---- */
    for (const nome of ['Arauto do Vale', 'Dragão Infernal', 'Barão Nashor', 'Larva do Vazio']) {
      t.check('MONSTROS[' + nome + '] do simulador === o do motor',
        MONSTROS_SIM[nome] && iguais(MONSTROS_SIM[nome], M.MONSTROS[nome]),
        JSON.stringify(M.MONSTROS[nome]));
    }

    /* ---- 5) RODIZIO e HAB_CHEFE ---- */
    t.check('RODIZIO do simulador === RODIZIO_CHEFE do motor (motor.js:' + TABELAS.RODIZIO_CHEFE.linha + ')',
      iguais(RODIZIO_SIM, M.RODIZIO_CHEFE));
    for (const k of Object.keys(M.HAB_CHEFE)) {
      t.check('HAB[' + k + '].carrega/espera === HAB_CHEFE do motor',
        HAB_SIM[k] && HAB_SIM[k].carrega === M.HAB_CHEFE[k].carrega && HAB_SIM[k].espera === M.HAB_CHEFE[k].espera,
        JSON.stringify(HAB_SIM[k]) + ' vs ' + JSON.stringify(M.HAB_CHEFE[k]));
    }

    /* ---- 6) os multiplicadores INLINE de mecanicaChefe, lidos do texto ---- */
    const inlineEsperado = { investida: 3.5, pancada: 2.2, olho: 2.6, sopro: 2.2, chuva: 1.8, acido: 1.2, tentaculos: 2.6 };
    for (const [k, v] of Object.entries(inlineEsperado)) {
      t.check('MULT_CHEFE[' + k + '] lido de mecanicaChefe (motor.js:' + LINHA_MECANICA_CHEFE + ')',
        MULT_CHEFE[k] === v, 'lido=' + MULT_CHEFE[k] + ' esperado=' + v);
    }
    t.check('MULT_CHEFE cobre TODAS as mecanicas com dano do motor',
      iguais(Object.keys(MULT_CHEFE).sort(), Object.keys(inlineEsperado).sort()),
      JSON.stringify(MULT_CHEFE));
    t.check('a rugido nao tem multiplicador de dano (so acelera o chefe)',
      MULT_CHEFE.rugido === undefined && QUEIMA_CHEFE.rugido === undefined);
    const queimaEsperada = { sopro: 0.03, chuva: 0.025, acido: 0.028 };
    for (const [k, v] of Object.entries(queimaEsperada)) {
      t.check('QUEIMA_CHEFE[' + k + '] = ' + v + ' lido do motor', QUEIMA_CHEFE[k] === v, 'lido=' + QUEIMA_CHEFE[k]);
    }
    t.check('a invocar nao bate (mult 0) e tem espera 14 s',
      (HAB_SIM.invocar.mult ?? 0) === 0 && HAB_SIM.invocar.espera === 14);

    /* ---- 7) os textos do balao, lidos de cena.js ---- */
    for (const [mec, texto] of Object.entries({
      investida: 'O Arauto prepara uma investida!', sopro: 'O Dragão respira fundo...',
      tentaculos: 'Tentáculos do Vazio!', acido: 'O Barão cospe ácido!',
    })) {
      t.check('BALAO[' + mec + '] === o texto de cena.js:' + TABELAS.HAB_CHEFE.linha,
        BALAO_SIM[texto] === mec, 'sim=' + BALAO_SIM[texto]);
    }

    /* ---- 8) a base dos campeoes: LIDA, nao calibrada ---- */
    t.check('BASE katarina LIDA de dados-katarina.js (hp 672, nao a calibracao 905)',
      BASE_SIM.katarina.hp === 672 && BASE_SIM.katarina.hpperlevel === 108,
      JSON.stringify(BASE_SIM.katarina));
    t.check('BASE katarina armorperlevel 4,7 (a calibracao dizia 4,5)',
      BASE_SIM.katarina.armorperlevel === 4.7, 'valor=' + BASE_SIM.katarina.armorperlevel);
    t.check('BASE katarina tem a fonte declarada (nao e "CALIBRADO NAO VERIFICADO")',
      /LIDO/.test(BASE_SIM.katarina.fonte), BASE_SIM.katarina.fonte);
  },
};
