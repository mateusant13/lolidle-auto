/*
 * score.test.mjs - PONTUACAO E MATEMATICA DE BUILDS (fila W9).
 *
 * PORQUE ESTA SUITE EXISTE: o banco tinha ZERO cobertura para a matematica de decisao de item.
 * scoreSet, tierDe, valorPassiva, auditoriaPassivas, statsSet, infoItem, nomeCompleto e o
 * armMagicaEfetiva nao tinham UMA assercao. Cada correccao dos tickets W9 fica aqui presa.
 *
 * O CATALOGO E O REAL: docs/game-src/itens.js (108 itens, com os textos acentuados que as
 * regex de passiva procuram). Nada foi transcrito a mao - um acento errado escondia o defeito.
 * Os numeros do motor sao LIDOS do META quando o inject os expoe (rmMonstro): duas execucoes
 * com motor diferente TEM de dar resultado diferente (prova de que nao sao copias congeladas).
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';

const SRC_ITENS = fs.readFileSync(path.join(RAIZ, 'docs', 'game-src', 'itens.js'), 'utf8');
const ITENS_REAIS = JSON.parse(SRC_ITENS.slice(SRC_ITENS.indexOf('['), SRC_ITENS.lastIndexOf(']') + 1));
// Dois pares SINTETICOS que diferem SO num stat (controlos limpos):
//   9001/9002 -> so o CDR   (TK-02-89)      9003/9004 -> so a pen magica (TK-02-31)
const SINTETICOS = [
  { id: '9001', nome: 'Teste Sem CDR', raridade: 'lendario', espaco: 'arma', ap: 100, preco: 3000 },
  { id: '9002', nome: 'Teste Com CDR', raridade: 'lendario', espaco: 'arma', ap: 100, cdr: 0.15, preco: 3000 },
  { id: '9003', nome: 'Teste Sem Pen', raridade: 'lendario', espaco: 'arma', ap: 100, preco: 3000 },
  { id: '9004', nome: 'Teste Com Pen', raridade: 'lendario', espaco: 'arma', ap: 100, penMag: 0.15, preco: 3000, efeito: 'Feitico: 15% de penetra\u00e7\u00e3o m\u00e1gica.' },
];

function montarEquip(m, slots) {
  const filhos = slots.map((s) => m.el({
    tag: 'button', label: 'equip:' + s.id,
    className: 'slot ' + (s.raridade || 'basico'),
    attrs: { 'data-id': s.id, 'data-dica': s.dica || '' },
  }));
  m.montar('#equip > button.slot[data-id]', filhos);
}
const sl = (id, raridade) => ({ id: id, raridade: raridade, dica: '' });
const ALVO = { armadura: 104, hp: 10000, nivel: 29 };

export const suite = {
  nome: 'score',
  titulo: 'Pontuacao e matematica de builds (tierDe, CAMPOS_MULT, infoItem, pen, mit, CDR, rv)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m, ITENS_REAIS.concat(SINTETICOS));
    definirCampeao(m, 'aptest');

    /* TK-02-64 - tierDe NA ESCALA DO MOTOR (motor.js:252) */
    const T = (qual, refino) => auto.tierDe({ qual: qual, refino: refino });
    t.check('T64a: 1 qualidade (B->A) = +15% (motor.js:174-178 mult A 1,15)', Math.abs(T('A', 0) - 1.15) < 1e-9);
    t.check('T64b: 1 refino = +12% (motor.js:55 BONUS_REFINO)', Math.abs(T('B', 1) - 1.12) < 1e-9);
    t.check('T64c: A+0 (1,15) VENCE B+1 (1,12) - o tierDe antigo perdia (0 contra 1)', T('A', 0) > T('B', 1));
    t.check('T64d: 1 qualidade NAO vale 10 refinos (o bug): A+0 < B+10', T('A', 0) < T('B', 10));
    t.check('T64e: refino 2 de C (1,116) PERDE de A+0 (1,15)', T('C', 2) < T('A', 0));
    t.check('T64f: qualidade desconhecida (?) = B = 1 (nao se inventa)', Math.abs(T('?', 0) - 1) < 1e-9);
    t.check('T64g: SS+0 (1,7) < S+5 (2,16) - o refino ainda pode ganhar', T('SS', 0) < T('S', 5));

    /* TK-02-66 - CAMPOS_MULT com penMag (motor.js:501/514) */
    const esp3175 = auto.especialDe('3175');
    t.check('T66a: 3175 entra no mapa especial PELO CAMPO penMag', !!esp3175 && esp3175.tipo === 'multiplicador');
    t.check('T66b: o papel do campo penMag e ap (mitigacao magica, motor.js:542)', !!esp3175 && esp3175.papel === 'ap');
    t.check('T66c: e especial DA MINHA CLASSE num campeao AP (meu=true)', !!esp3175 && esp3175.meu === true);
    const emLista = (auto.ITENS_ESPECIAIS || []).some((e) => String(e.id) === '3175');
    t.check('T66d: ...e NAO esta na lista manual ITENS_ESPECIAIS', emLista === false);
    const esp3020 = auto.especialDe('3020');
    t.check('T66e: 3020 (penMag 0,08) tambem entra pelo campo', !!esp3020 && esp3020.papel === 'ap');

    /* TK-02-109 - a pen MAGICA nao escala com qualidade/refino (motor.js:254-255) */
    const p3175A = auto.statsDePeca('3175', 'A', 0);
    t.check('T109a: 3175~A -> pen 0,15 (NAO 0,1725)', Math.abs(p3175A.penMag - 0.15) < 1e-9);
    t.check('T109b: 3175~A -> AP 70*1,15 = 80,5 (o AP ESCALA)', Math.abs(p3175A.ap - 80.5) < 1e-9);
    const p4629A3 = auto.statsDePeca('4629', 'A', 3);
    t.check('T109c: 4629+3~A -> cdr 0,2346 (o CDR ESCALA)', Math.abs(p4629A3.cdr - 0.2346) < 1e-6);
    t.check('T109d: 4629+3~A -> ap 109,48', Math.abs(p4629A3.ap - 109.48) < 0.01);
    t.check('T109e: 4629+3~A -> vida 547,4', Math.abs(p4629A3.vida - 547.4) < 0.1);
    const s3175A = auto.statsSet(['3175~A']);
    t.check('T109f: statsSet(["3175~A"]).pen = 0,15', Math.abs(s3175A.pen - 0.15) < 1e-9);

    /* TK-02-134 - o 3036 e pen de ARMADURA, nunca pen MAGICA (motor.js:529) */
    const s3036 = auto.statsSet(['3036']);
    t.check('T134a: com o 3036, a pen MAGICA e 0', Math.abs(s3036.pen) < 1e-9);
    t.check('T134b: com o 3036, a pen de ARMADURA e 0,30 (motor.js:539)', Math.abs(s3036.penArmadura - 0.3) < 1e-9);
    const s3135 = auto.statsSet(['3135']);
    t.check('T134c: CONTROLO - o 3135 da 0,40 de pen MAGICA e 0 de pen de armadura',
      Math.abs(s3135.pen - 0.4) < 1e-9 && Math.abs(s3135.penArmadura) < 1e-9);

    /* TK-02-62 - mit com RM_MONSTRO (motor.js:1179/1202), LIDO do META */
    t.check('T62a: armMagicaEfetiva(104,0) = 62,4', Math.abs(auto.armMagicaEfetiva(104, 0) - 62.4) < 1e-9);
    t.check('T62b: com 40% de pen, 104*0,6*0,6 = 37,44', Math.abs(auto.armMagicaEfetiva(104, 0.4) - 37.44) < 1e-9);
    alimentarMeta(m, { rmMonstro: 0.5 });
    t.check('T62c: com META.rmMonstro=0,5 o valor acompanha (LIDO, nao copiado)',
      Math.abs(auto.armMagicaEfetiva(104, 0) - 52) < 1e-9);
    alimentarMeta(m, { rmMonstro: 0.6 });
    t.check('T62d: de volta a 0,6 o valor volta a 62,4', Math.abs(auto.armMagicaEfetiva(104, 0) - 62.4) < 1e-9);

    /* TK-02-31 - a guarda da CONTAGEM DUPLA (108 itens reais) e o pen do 3175 */
    const aud = auto.auditoriaPassivas();
    t.check('T31a: a guarda percorre os 108 itens do catalogo real', aud.n === ITENS_REAIS.length + SINTETICOS.length);
    t.check('T31b: a guarda NAO acusa contagem dupla (duplas.length === 0)', aud.duplas.length === 0);
    t.check('T31c: o 3175 deixou de contar a pen pelo texto (campo presente -> vp 0)', auto.valorPassiva('3175') === 0);
    t.check('T31d: o 3135 CONTINUA a contar 40*7 = 280 (nao tem campo; motor.js:542)', auto.valorPassiva('3135') === 280);
    t.check('T31e: o 3171 (cdr de campo) sem eco de texto', auto.valorPassiva('3171') === 0);
    t.check('T31f: o 4629 (cdr SO no texto) continua a contar 15*6 = 90', auto.valorPassiva('4629') === 90);
    t.check('T31g: 9004 (campo penMag + texto) vale 0 de passiva', auto.valorPassiva('9004') === 0);
    t.check('T31h: 9003 (sem campo e sem texto) vale 0 (controlo de forma)', auto.valorPassiva('9003') === 0);
    t.check('T31i: o 3175 continua a ter valor no score (a pen vem do CAMPO)', auto.valorDeFase('3175', null, null) > 0);

    /* TK-02-79 / TK-02-80 - infoItem com STATS e o nome com qualidade */
    t.check('T79a: sem peca conhecida, o infoItem da os stats do catalogo cru (ap 70)',
      !!auto.infoItem('4629').stats && Math.abs(auto.infoItem('4629').stats.ap - 70) < 1e-9);
    t.check('T79b: ...e NAO inventa valor de equipamento', auto.infoItem('4629').valorEquip === null);
    montarEquip(m, [sl('4629+3~A', 'lendario')]);
    const info = auto.infoItem('4629');
    t.check('T79c: com 4629+3~A equipado, stats.ap = 109,5', !!info.stats && Math.abs(info.stats.ap - 109.48) < 0.02);
    t.check('T79d: ...stats.vida = 547', !!info.stats && Math.abs(info.stats.vida - 547.4) < 0.1);
    t.check('T79e: ...stats.cdr = 0,23', !!info.stats && Math.abs(info.stats.cdr - 0.2346) < 1e-4);
    t.check('T79f: ...stats.penMag = 0 (o Impeto nao tem pen)', !!info.stats && info.stats.penMag === 0);
    t.check('T79g: a qualidade/refino resolvidos aparecem na ficha', info.qual === 'A' && info.refino === 3);
    t.check('T79h: o valor de equipamento passa a existir', info.valorEquip != null && info.valorEquip > 0);
    t.check('T80a: o nome casa com o ecra: Impeto Cosmico +3 [A]',
      auto.nomeCompleto('4629', 'A', 3) === '\u00cdmpeto C\u00f3smico +3 [A]');
    t.check('T80b: sem qualidade o nome nao leva sufixo', auto.nomeCompleto('4629', null, 0) === '\u00cdmpeto C\u00f3smico');
    montarEquip(m, []);

    /* TK-02-89 - o CDR acelera SO as habilidades (motor.js:1398/3236) */
    const semSkill1 = auto.scoreSet(['9001'], ALVO);
    const semSkill2 = auto.scoreSet(['9002'], ALVO);
    t.check('T89a: SEM habilidades na barra, o CDR NAO pontua (9001 == 9002)', Math.abs(semSkill1 - semSkill2) < 1e-6);
    m.montar('#hab-ativas .hab[data-t]', [
      m.el({ tag: 'div', label: 'hab:Q', className: 'hab escolhida', dataset: { t: 'Q' }, textContent: '5/10' }),
      m.el({ tag: 'div', label: 'hab:A', className: 'hab escolhida', dataset: { t: 'A' }, textContent: '5/10' }),
    ]);
    const comSkill1 = auto.scoreSet(['9001'], ALVO);
    const comSkill2 = auto.scoreSet(['9002'], ALVO);
    t.check('T89b: COM habilidades, o CDR AUMENTA o score (9002 > 9001)', comSkill2 > comSkill1);
    t.check('T89c: o ganho do CDR e plausivel (< 30% para 15% de CDR)', (comSkill2 / comSkill1) < 1.3);
    t.check('T89d: o item sem CDR nao muda de score por a barra ter skills', Math.abs(semSkill1 - comSkill1) < 1e-6);

    /* TK-02-150 - pen MAGICA nao serve de pen de ARMADURA */
    definirCampeao(m, 'adtest');
    const adSem = auto.scoreSet([], ALVO);
    const adCom3135 = auto.scoreSet(['3135'], ALVO);
    t.check('T150a: num campeao AD, o 3135 (pen MAGICA) NAO reduz a armadura do alvo',
      Math.abs(adCom3135 - adSem) < 1e-6);
    const adCom3036 = auto.scoreSet(['3036'], ALVO);
    t.check('T150b: num campeao AD, o 3036 (pen de ARMADURA) AUMENTA o dano', adCom3036 > adSem);
    definirCampeao(m, 'aptest');

    /* TK-02-142 / TK-02-127 - o rv lido do painel e a cura/s = autoDps * rv (motor.js:1226-1228) */
    const stRv = (txt) => m.el({ tag: 'div', label: 'st:' + txt, className: 'st', textContent: txt });
    m.montar('#hab-ativas .hab[data-t]', []);
    m.montar('.st', [stRv('Dano 161'), stRv('Vel. ataque 1.16'), stRv('Roubo de Vida 12%'), stRv('Armadura 104')]);
    t.check('T142a: o painel escreve Roubo de Vida (jogo.js:5999) e o player() le',
      Math.abs(auto.player().rv - 0.12) < 1e-9);
    t.check('T142b: o rv sai em FRACCAO (motor.js:538), nao em percentagem', auto.player().rv < 1);
    m.montar('.st', [stRv('Roubo de vida 6%')]);
    t.check('T142c: CONTROLO - a grafia antiga (Roubo de vida) tambem e aceite',
      Math.abs(auto.player().rv - 0.06) < 1e-9);
    m.montar('.st', [stRv('Dano 161'), stRv('Vel. ataque 1.16'), stRv('Roubo de Vida 12%')]);
    const comRv = auto.scoreSet(['3074'], ALVO);
    const semRv = auto.scoreSet([], ALVO);
    t.check('T127a: um item com rv AUMENTA o score (a cura entra em conta)', comRv > semRv);
    const s3074 = auto.statsSet(['3074']);
    t.check('T127b: o statsSet devolve o rv do conjunto (motor.js:538)', Math.abs(s3074.rv - 0.12) < 1e-9);
    const scoreAdAlto = auto.scoreSet(['3074'], ALVO);
    m.montar('.st', [stRv('Dano 20'), stRv('Vel. ataque 1.16'), stRv('Roubo de Vida 12%')]);
    const scoreAdBaixo = auto.scoreSet(['3074'], ALVO);
    t.check('T127c: a mesma % de rv vale MAIS com dano de auto-ataque alto', scoreAdAlto > scoreAdBaixo);
    m.montar('.st', [stRv('Dano 0'), stRv('Vel. ataque 0'), stRv('Roubo de Vida 12%')]);
    t.check('T127d: sem auto-dano o termo de cura desaparece (so auto-ataque cura)',
      Math.abs(auto.scoreSet(['3074'], ALVO) - auto.scoreSet([], ALVO)) < 1e-6);

    /* TK-02-63 - a passiva NAO e contada TRES vezes (multEsp x PESO_FASE x multRar) */
    const v3135semFase = auto.valorDeFase('3135', null, null);
    const v3135chefe = auto.valorDeFase('3135', null, 'chefe');
    t.check('T63a: a passiva do 3135 continua a valer 280 pelo TEXTO (nao mudou)',
      auto.valorPassiva('3135') === 280);
    t.check('T63b: a FASE continua a dar peso ao 3135 (chefe > sem fase)', v3135chefe > v3135semFase);
    // DISCRIMINANTE (TK-02-63): o `bonusItemFase` (1,35 no 3135) multiplica SO a passiva, NAO
    // o item inteiro. Com o defeito (o `bonus` no exterior) dava `chefe === semFase x 1,35`,
    // logo o delta era `semFase x 0,35`. Agora o delta e `0,35 x passiva x multClasse x multRar`,
    // sempre MENOR que `semFase x 0,35` (o `semFase` inclui stats + passiva + sinergia).
    t.check('T63c: o bónus de fase NAO multiplica o item inteiro (delta < semFase x 0,35)',
      (v3135chefe - v3135semFase) < v3135semFase * 0.35,
      'delta=' + (v3135chefe - v3135semFase).toFixed(1) + ' limite=' + (v3135semFase * 0.35).toFixed(1));
    t.check('T63d: regressao - valorDeFase(3135, chefe) = 844,2 (era 1061 com o empilhamento)',
      Math.abs(v3135chefe - 844.2) < 0.5, 'valor=' + v3135chefe);
    t.check('T63e: a guarda de contagem dupla de passivas continua limpa',
      auto.auditoriaPassivas().duplas.length === 0);
  },
};
