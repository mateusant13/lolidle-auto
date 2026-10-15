/*
 * passivas.test.mjs - PASSIVAS DOS ITENS NA BUILD (campo + texto), ALVO respeitando a classe
 *                     e o Lich medido pela FREQUÊNCIA DE SKILLS do campeão.
 *
 * tickets cobertos: TK-02-24 (P0), TK-02-32 (P0), TK-02-25 (P1), TK-02-35 (P1)
 *
 * REGRA Nº 1 — tudo lido em docs/game-src/, nada copiado. O catálogo é IMPORTADO de
 * docs/game-src/itens.js (o ficheiro real do jogo); as recargas dos kits vêm de motor.js com
 * o file:linha de cada uma (o motor.js não é importável aqui — faltam dados-<campeao>.js —,
 * pelo que o kit entra pela MESMA forma que o jogo o entrega: META.kits[id].kit, e os números
 * transcritos estão asseridos abaixo contra a soma que o modelo tem de dar).
 *
 *   itens.js:1558-1559  3171 Lucidez Escarlate -> cdr 0,15 E texto "−15% na recarga"
 *   itens.js:2010       4629 Ímpeto Cósmico    -> SEM campo cdr; só o texto "−15% na recarga"
 *   itens.js:1710       3100 Perdição de Lich  -> "+75% do Poder de Habilidade" no próximo ataque
 *   itens.js:2580       3089 Rabadon           -> "+35% do Poder de Habilidade total"
 *   motor.js:529        `penMagica: Math.min(0.6, ...)`        -> tecto de pen 60%
 *   motor.js:537        `reducaoRecarga: Math.min(0.4, ...)`  -> tecto de CDR 40%
 *   motor.js:563        `serie(ini, passo, n)`                 -> recargas por rank
 *   motor.js:564-565    "110 ranks no total e só 50 pontos (1 POR NÍVEL)"
 *   motor.js:899/903    `ordem: [...]`                         -> ordem oficial de subir
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarMeta, IMG_HAB_SEL } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';

/* ------------------------------------------------------------------ *
 * KITS — recargas transcritas de motor.js, com o file:linha de cada.
 * ------------------------------------------------------------------ */
/** KATARINA (motor.js:748-784). Ordem oficial motor.js:899 ['N','R','B','M','E','A','G','F','T','Q','W'].
 *  Q serie(10,-0.35) :751 · W serie(14,-0.4) :754 · E serie(10,-0.4) :756 · R [75,65,55,48,42] :759
 *  G serie(20,-0.8) :762 · A serie(12,-0.5) :765 · D passiva :768 · F serie(16,-0.5) :770
 *  T serie(24,-0.8) :773 · B serie(24,-0.8) :776 · M serie(14,-0.5) :778 · N [75,66,58,51,45] :781 */
const KIT_KATARINA = {
  Q: { nivel: 1, max: 10, recarga: [10, 9.65, 9.3, 8.95, 8.6, 8.25, 7.9, 7.55, 7.2, 6.85], base: [80, 115, 150, 185, 220], ratio: [0.45, 0.48, 0.51, 0.54, 0.57] },
  W: { nivel: 1, max: 10, recarga: [14, 13.6, 13.2, 12.8, 12.4, 12, 11.6, 11.2, 10.8, 10.4] },
  E: { nivel: 1, max: 10, recarga: [10, 9.6, 9.2, 8.8, 8.4, 8, 7.6, 7.2, 6.8, 6.4], base: [40, 60, 80, 100, 120], ratio: [0.3, 0.32, 0.34, 0.36, 0.38], adRatio: 0.4 },
  R: { nivel: 6, max: 5, recarga: [75, 65, 55, 48, 42], base: [30, 44, 58, 72, 86], ratio: [0.25, 0.28, 0.31, 0.34, 0.37] },
  G: { nivel: 8, max: 10, recarga: [20, 19.2, 18.4, 17.6, 16.8, 16, 15.2, 14.4, 13.6, 12.8], base: [30, 45, 60, 75, 90], ratio: [0.3, 0.315, 0.33, 0.345, 0.36] },
  A: { nivel: 13, max: 10, recarga: [12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5], base: [90, 125, 160, 195, 230], ratio: [0.6, 0.635, 0.67, 0.705, 0.74] },
  D: { nivel: 18, max: 10, passiva: true },
  F: { nivel: 23, max: 10, recarga: [16, 15.5, 15, 14.5, 14, 13.5, 13, 12.5, 12, 11.5] },
  T: { nivel: 28, max: 10, recarga: [24, 23.2, 22.4, 21.6, 20.8, 20, 19.2, 18.4, 17.6, 16.8], base: [60, 88, 116, 144, 172], ratio: [0.4, 0.43, 0.46, 0.49, 0.52] },
  B: { nivel: 33, max: 10, recarga: [24, 23.2, 22.4, 21.6, 20.8, 20, 19.2, 18.4, 17.6, 16.8] },
  M: { nivel: 38, max: 10, recarga: [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5], base: [200, 280, 360, 440, 520], ratio: [1.2, 1.27, 1.34, 1.41, 1.48] },
  N: { nivel: 45, max: 5, recarga: [75, 66, 58, 51, 45], base: [90, 130, 170, 210, 250], ratio: [0.45, 0.5, 0.55, 0.6, 0.65] },
};

/** TARIC — o "mago lento" do ticket (motor.js:791-827). Ordem oficial motor.js:903.
 *  Q serie(6,-0.2) :794 · W serie(15,-0.5) :798 · E serie(13,-0.4) :801 · R [140,120,100,85,70] :804
 *  G serie(26,-0.8) :807 (defensivo) · A serie(12,-0.5) :809 · D passiva :812 · F serie(26,-0.8) :814
 *  (escudo) · T serie(11,-0.4) :816 · B serie(35,-1.5) :819 · M serie(14,-0.5) :821 · N [90,80,70,62,55] :824 */
const KIT_TARIC = {
  Q: { nivel: 1, max: 10, recarga: [6, 5.8, 5.6, 5.4, 5.2, 5, 4.8, 4.6, 4.4, 4.2], base: [60, 86, 112, 138, 164], ratio: [0.35, 0.37, 0.39, 0.41, 0.43] },
  W: { nivel: 1, max: 10, recarga: [15, 14.5, 14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5] },
  E: { nivel: 1, max: 10, recarga: [13, 12.6, 12.2, 11.8, 11.4, 11, 10.6, 10.2, 9.8, 9.4], base: [110, 155, 200, 245, 290], ratio: [0.5, 0.53, 0.56, 0.59, 0.62] },
  R: { nivel: 6, max: 5, recarga: [140, 120, 100, 85, 70], base: [320, 460, 600, 740, 880], ratio: [1.1, 1.22, 1.34, 1.46, 1.58] },
  G: { nivel: 8, max: 10, recarga: [26, 25.2, 24.4, 23.6, 22.8, 22, 21.2, 20.4, 19.6, 18.8] },
  A: { nivel: 13, max: 10, recarga: [12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5], base: [90, 125, 160, 195, 230], ratio: [0.6, 0.635, 0.67, 0.705, 0.74] },
  D: { nivel: 18, max: 10, passiva: true },
  F: { nivel: 23, max: 10, recarga: [26, 25.2, 24.4, 23.6, 22.8, 22, 21.2, 20.4, 19.6, 18.8] },
  T: { nivel: 28, max: 10, recarga: [11, 10.6, 10.2, 9.8, 9.4, 9, 8.6, 8.2, 7.8, 7.4], base: [110, 158, 206, 254, 302], ratio: [0.7, 0.74, 0.78, 0.82, 0.86] },
  B: { nivel: 33, max: 10, recarga: [35, 33.5, 32, 30.5, 29, 27.5, 26, 24.5, 23, 21.5] },
  M: { nivel: 38, max: 10, recarga: [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5], base: [130, 185, 240, 295, 350], ratio: [0.85, 0.9, 0.95, 1, 1.05] },
  N: { nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], base: [320, 460, 600, 740, 880], ratio: [1.1, 1.22, 1.34, 1.46, 1.58] },
};

const PAPEL_KAT = { dano: 1.2, recebido: 0.75 };   // motor.js:898
const PAPEL_TARIC = { dano: 0.9, recebido: 0.75 };  // motor.js:902
const ORDEM_KAT = ['N', 'R', 'B', 'M', 'E', 'A', 'G', 'F', 'T', 'Q', 'W'];   // motor.js:899
const ORDEM_TARIC = ['R', 'N', 'F', 'Q', 'W', 'E', 'B', 'G', 'M', 'T', 'A'];  // motor.js:903

/** Kits como o inject.js os entrega (inject.js:156-161). */
const KITS = {
  katarina: { kit: KIT_KATARINA, adBase: 58, adNivel: 3.4, magia: true, semMana: true, distancia: false, papel: PAPEL_KAT, ordem: ORDEM_KAT },
  taric: { kit: KIT_TARIC, adBase: 55, adNivel: 3.3, magia: true, semMana: false, distancia: false, papel: PAPEL_TARIC, ordem: ORDEM_TARIC },
};

/** Põe um campeão EM CAMPO pelo caminho REAL (ícone da skill no HUD + META.kits), sem
 *  substituir o kit pelo mínimo do stub — é o `definirCampeao` do banco, mas com o kit real. */
function porCampeaoEmCampo(m, id) {
  m.montar(IMG_HAB_SEL, [m.el({ tag: 'img', label: 'hud-hab-img', attrs: { src: '/img/habilidades/' + id + '/q.png' } })]);
  // o `carregarMeta` SUBSTITUI o META.kits inteiro (automação.js:994), não funde: por isso
  // reenvia-se sempre o mapa completo dos dois campeões.
  return alimentarMeta(m, { kits: KITS });
}

/** Nível do jogador (#hud-nivel) — o que o freqSkills lê para saber os ranks. */
function montarNivel(m, nivel) {
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nivel) })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nivel) })]);
}



export const suite = {
  nome: 'passivas',
  titulo: 'Passivas dos itens na build + alvo por classe + Lich pela frequência de skills do motor',
  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarMeta(m, { itens: ITENS_DADOS, kits: KITS });
    montarNivel(m, 29);
    porCampeaoEmCampo(m, 'katarina');

    const champ = (id, magia, papel) => ({ id, magia, distancia: false, papel });

    /* ================= TK-02-24: CAMPO + PASSIVA (CDR / pen / AP%) ================= */
    // 3171 (campo cdr 0,15 E texto) + 4629 (SÓ texto): 15 + 15 = 30%, abaixo do tecto de 40%.
    const ef = auto.efeitosEquipados(['3171', '4629']);
    t.check('D1: 3171+4629 somam 30% de CDR (15 do campo + 15 do texto)', Math.abs(ef.cdr - 0.30) < 1e-9);
    t.check('D1: abaixo do tecto de 40% do motor (motor.js:537) e SEM desperdício', ef.cdr < 0.4 && ef.cdr > 0);
    t.check('D2: o 4629 (só texto, itens.js:2010) vale 15% sozinho', Math.abs(auto.efeitosEquipados(['4629']).cdr - 0.15) < 1e-9);
    t.check('D3: o 3171 (campo E texto, itens.js:1558-1559) vale 15%, não 30% (sem contagem dupla)',
      Math.abs(auto.efeitosEquipados(['3171']).cdr - 0.15) < 1e-9);
    t.check('D4: o AP% do 3089 sai do TEXTO (35%, itens.js:2580)', Math.abs(auto.efeitosEquipados(['3089']).apPct - 0.35) < 1e-9);
    t.check('D5: pen do CAMPO (3175 = 0,15, itens.js:1811)', Math.abs(auto.efeitosEquipados(['3175']).penMag - 0.15) < 1e-9);
    t.check('D5: pen do TEXTO (3135 = 40%, itens.js:1960)', Math.abs(auto.efeitosEquipados(['3135']).penMag - 0.40) < 1e-9);
    // a passiva do Lich entra na soma como campo do efeitosEquipados (motor: lich = 0,75)
    t.check('D6: o lich do 3100 entra como campo (0,75)', Math.abs(auto.efeitosEquipados(['3100']).lich - 0.75) < 1e-9);

    /* ================= TK-02-25: a build NÃO depende de quem está em campo ================= */
    const pedido = champ('katarina', true, PAPEL_KAT);
    porCampeaoEmCampo(m, 'taric');                             // EM CAMPO: Taric (outro campeão)
    const comTaricEmCampo = auto.buildIdealPara(pedido);
    porCampeaoEmCampo(m, 'katarina');                         // EM CAMPO: Katarina
    const comKatarinaEmCampo = auto.buildIdealPara(pedido);
    t.check('V1: buildIdealPara(katarina) dá o MESMO resultado com champAtual=taric e champAtual=katarina',
      JSON.stringify(comTaricEmCampo) === JSON.stringify(comKatarinaEmCampo));
    t.check('V2: e difere da build do OUTRO campeão (perfis diferentes, motor.js:877/901)',
      JSON.stringify(auto.buildIdealPara(champ('taric', true, PAPEL_TARIC))) !== JSON.stringify(comKatarinaEmCampo));

    /* ================= TK-02-32: o ALVO FIXO respeita a classe ================= */
    auto.setConfig({ objetivoItem: 'rabadon' });
    const adComAlvo = auto.buildIdealPara(champ('katarina', false, PAPEL_KAT));
    t.check('O1: objetivo "rabadon" NÃO contamina uma build AD (3089 ausente)', adComAlvo.indexOf('3089') < 0);
    t.check('O1: a build AD continua com 5 itens', adComAlvo.length === 5);
    t.check('O1: a build AD não tem nenhum item AP', adComAlvo.every((id) => {
      const it = ITENS_DADOS.find((x) => String(x.id) === id); return !it || !(it.ap > 0 && !(it.ad || it.critico || it.va || it.rv));
    }));
    const apComAlvo = auto.buildIdealPara(pedido);
    t.check('O2: no campeão AP o objetivo ENTRA (3089 presente)', apComAlvo.indexOf('3089') >= 0);
    auto.setConfig({ objetivoItemForcar: true });
    t.check('O3: com objetivoItemForcar o alvo de classe oposta ENTRA (escape do dono)',
      auto.buildIdealPara(champ('katarina', false, PAPEL_KAT)).indexOf('3089') >= 0);
    auto.setConfig({ objetivoItemForcar: false, objetivoItem: null });

    /* ================= TK-02-35: LICH pela FREQUÊNCIA de skills ================= */
    // nv29, pontos (29-1=28) na ordem oficial. Destrancadas sem dano: W, F (e D é passiva).
    // KATARINA: Q r1 (:751 10s) · E r10 (:756 6,4s) · R r5 (:759 42s) · G r1 (:762 20s)
    //           A r8 (:765 8,5s) · T r1 (:773 24s)
    const FREQ_KAT_29 = 1 / 10 + 1 / 6.4 + 1 / 42 + 1 / 20 + 1 / 8.5 + 1 / 24;
    // TARIC: Q r8 (:794 4,6s) · E r1 (:801 13s) · R r5 (:804 70s) · A r1 (:809 12s) · T r1 (:816 11s)
    const FREQ_TARIC_29 = 1 / 4.6 + 1 / 13 + 1 / 70 + 1 / 12 + 1 / 11;
    const cK = champ('katarina', true, PAPEL_KAT), cT = champ('taric', true, PAPEL_TARIC);
    const vpK = auto.valorPassiva('3100', cK), vpT = auto.valorPassiva('3100', cT);
    t.check('L1: KATARINA nv29 -> 75 x 9 x ' + (vpK / 675).toFixed(6) + ' conjurações/s (motor.js:751/756/759/762/765/773)',
      Math.abs(vpK - 75 * 9 * FREQ_KAT_29) < 1e-6);
    t.check('L1: TARIC (mago lento) nv29 -> 75 x 9 x ' + (vpT / 675).toFixed(6) + ' conjurações/s (motor.js:794/801/804/809/816)',
      Math.abs(vpT - 75 * 9 * FREQ_TARIC_29) < 1e-6);
    t.check('L2: as duas frequências são DIFERENTES (o ×2,2 fixo tratava os dois iguais)', vpK !== vpT);
    t.check('L2: a Katarina (skills curtas) vale MAIS que o mago lento', vpK > vpT);
    // o valor acompanha o NÍVEL (mais skills destrancadas = mais procs):
    const FREQ_KAT_13 = 1 / 10 + 1 / 9.2 + 1 / 42 + 1 / 20 + 1 / 12;    // nv13: E r3, A r1
    const FREQ_KAT_45 = 1 / 10 + 1 / 7.2 + 1 / 42 + 1 / 20 + 1 / 12 + 1 / 24 + 1 / 9.5 + 1 / 45;   // nv45: M r10, N r5
    montarNivel(m, 13);
    t.check('L3: nv13 -> 75 x 9 x ' + (auto.valorPassiva('3100', cK) / 675).toFixed(6) + ' (menos skills destrancadas)',
      Math.abs(auto.valorPassiva('3100', cK) - 75 * 9 * FREQ_KAT_13) < 1e-6);
    montarNivel(m, 45);
    t.check('L3: nv45 -> 75 x 9 x ' + (auto.valorPassiva('3100', cK) / 675).toFixed(6) + ' (todas as skills)',
      Math.abs(auto.valorPassiva('3100', cK) - 75 * 9 * FREQ_KAT_45) < 1e-6);
    montarNivel(m, 29);
    // RESPOSTA À PERGUNTA DO DONO (parte-02.md:1597): "o Lich entra na build dela? E na de um mago lento?"
    const buildK = auto.buildIdealPara(cK), buildT = auto.buildIdealPara(cT);
    t.check('L4: RESPOSTA KATARINA nv29 -> 3100 na build? ' + (buildK.indexOf('3100') >= 0 ? 'SIM' : 'NÃO') + ' [' + buildK.join(',') + ']', buildK.length === 5);
    t.check('L4: RESPOSTA TARIC (mago lento) nv29 -> 3100 na build? ' + (buildT.indexOf('3100') >= 0 ? 'SIM' : 'NÃO') + ' [' + buildT.join(',') + ']', buildT.length === 5);

    /* ================= honestidade do stub ================= */
    t.check('Z: nenhum seletor desconhecido foi usado (stub honesto)', m.unstubbed().length === 0);
  },
};

/* helpers locais (o lado do merge que os usava ficou de fora) */



import { criarMundo, carregarAutomation, alimentarMeta, IMG_HAB_SEL } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';

/* ------------------------------------------------------------------ *
 * KITS — recargas transcritas de motor.js, com o file:linha de cada.
 * ------------------------------------------------------------------ */
/** KATARINA (motor.js:748-784). Ordem oficial motor.js:899 ['N','R','B','M','E','A','G','F','T','Q','W'].
 *  Q serie(10,-0.35) :751 · W serie(14,-0.4) :754 · E serie(10,-0.4) :756 · R [75,65,55,48,42] :759
 *  G serie(20,-0.8) :762 · A serie(12,-0.5) :765 · D passiva :768 · F serie(16,-0.5) :770
 *  T serie(24,-0.8) :773 · B serie(24,-0.8) :776 · M serie(14,-0.5) :778 · N [75,66,58,51,45] :781 */
const KIT_KATARINA = {
  Q: { nivel: 1, max: 10, recarga: [10, 9.65, 9.3, 8.95, 8.6, 8.25, 7.9, 7.55, 7.2, 6.85], base: [80, 115, 150, 185, 220], ratio: [0.45, 0.48, 0.51, 0.54, 0.57] },
  W: { nivel: 1, max: 10, recarga: [14, 13.6, 13.2, 12.8, 12.4, 12, 11.6, 11.2, 10.8, 10.4] },
  E: { nivel: 1, max: 10, recarga: [10, 9.6, 9.2, 8.8, 8.4, 8, 7.6, 7.2, 6.8, 6.4], base: [40, 60, 80, 100, 120], ratio: [0.3, 0.32, 0.34, 0.36, 0.38], adRatio: 0.4 },
  R: { nivel: 6, max: 5, recarga: [75, 65, 55, 48, 42], base: [30, 44, 58, 72, 86], ratio: [0.25, 0.28, 0.31, 0.34, 0.37] },
  G: { nivel: 8, max: 10, recarga: [20, 19.2, 18.4, 17.6, 16.8, 16, 15.2, 14.4, 13.6, 12.8], base: [30, 45, 60, 75, 90], ratio: [0.3, 0.315, 0.33, 0.345, 0.36] },
  A: { nivel: 13, max: 10, recarga: [12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5], base: [90, 125, 160, 195, 230], ratio: [0.6, 0.635, 0.67, 0.705, 0.74] },
  D: { nivel: 18, max: 10, passiva: true },
  F: { nivel: 23, max: 10, recarga: [16, 15.5, 15, 14.5, 14, 13.5, 13, 12.5, 12, 11.5] },
  T: { nivel: 28, max: 10, recarga: [24, 23.2, 22.4, 21.6, 20.8, 20, 19.2, 18.4, 17.6, 16.8], base: [60, 88, 116, 144, 172], ratio: [0.4, 0.43, 0.46, 0.49, 0.52] },
  B: { nivel: 33, max: 10, recarga: [24, 23.2, 22.4, 21.6, 20.8, 20, 19.2, 18.4, 17.6, 16.8] },
  M: { nivel: 38, max: 10, recarga: [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5], base: [200, 280, 360, 440, 520], ratio: [1.2, 1.27, 1.34, 1.41, 1.48] },
  N: { nivel: 45, max: 5, recarga: [75, 66, 58, 51, 45], base: [90, 130, 170, 210, 250], ratio: [0.45, 0.5, 0.55, 0.6, 0.65] },
};

/** TARIC — o "mago lento" do ticket (motor.js:791-827). Ordem oficial motor.js:903.
 *  Q serie(6,-0.2) :794 · W serie(15,-0.5) :798 · E serie(13,-0.4) :801 · R [140,120,100,85,70] :804
 *  G serie(26,-0.8) :807 (defensivo) · A serie(12,-0.5) :809 · D passiva :812 · F serie(26,-0.8) :814
 *  (escudo) · T serie(11,-0.4) :816 · B serie(35,-1.5) :819 · M serie(14,-0.5) :821 · N [90,80,70,62,55] :824 */
const KIT_TARIC = {
  Q: { nivel: 1, max: 10, recarga: [6, 5.8, 5.6, 5.4, 5.2, 5, 4.8, 4.6, 4.4, 4.2], base: [60, 86, 112, 138, 164], ratio: [0.35, 0.37, 0.39, 0.41, 0.43] },
  W: { nivel: 1, max: 10, recarga: [15, 14.5, 14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5] },
  E: { nivel: 1, max: 10, recarga: [13, 12.6, 12.2, 11.8, 11.4, 11, 10.6, 10.2, 9.8, 9.4], base: [110, 155, 200, 245, 290], ratio: [0.5, 0.53, 0.56, 0.59, 0.62] },
  R: { nivel: 6, max: 5, recarga: [140, 120, 100, 85, 70], base: [320, 460, 600, 740, 880], ratio: [1.1, 1.22, 1.34, 1.46, 1.58] },
  G: { nivel: 8, max: 10, recarga: [26, 25.2, 24.4, 23.6, 22.8, 22, 21.2, 20.4, 19.6, 18.8] },
  A: { nivel: 13, max: 10, recarga: [12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5], base: [90, 125, 160, 195, 230], ratio: [0.6, 0.635, 0.67, 0.705, 0.74] },
  D: { nivel: 18, max: 10, passiva: true },
  F: { nivel: 23, max: 10, recarga: [26, 25.2, 24.4, 23.6, 22.8, 22, 21.2, 20.4, 19.6, 18.8] },
  T: { nivel: 28, max: 10, recarga: [11, 10.6, 10.2, 9.8, 9.4, 9, 8.6, 8.2, 7.8, 7.4], base: [110, 158, 206, 254, 302], ratio: [0.7, 0.74, 0.78, 0.82, 0.86] },
  B: { nivel: 33, max: 10, recarga: [35, 33.5, 32, 30.5, 29, 27.5, 26, 24.5, 23, 21.5] },
  M: { nivel: 38, max: 10, recarga: [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5], base: [130, 185, 240, 295, 350], ratio: [0.85, 0.9, 0.95, 1, 1.05] },
  N: { nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], base: [320, 460, 600, 740, 880], ratio: [1.1, 1.22, 1.34, 1.46, 1.58] },
};

const PAPEL_KAT = { dano: 1.2, recebido: 0.75 };   // motor.js:898
const PAPEL_TARIC = { dano: 0.9, recebido: 0.75 };  // motor.js:902
const ORDEM_KAT = ['N', 'R', 'B', 'M', 'E', 'A', 'G', 'F', 'T', 'Q', 'W'];   // motor.js:899
const ORDEM_TARIC = ['R', 'N', 'F', 'Q', 'W', 'E', 'B', 'G', 'M', 'T', 'A'];  // motor.js:903

/** Kits como o inject.js os entrega (inject.js:156-161). */
const KITS = {
  katarina: { kit: KIT_KATARINA, adBase: 58, adNivel: 3.4, magia: true, semMana: true, distancia: false, papel: PAPEL_KAT, ordem: ORDEM_KAT },
  taric: { kit: KIT_TARIC, adBase: 55, adNivel: 3.3, magia: true, semMana: false, distancia: false, papel: PAPEL_TARIC, ordem: ORDEM_TARIC },
};

/** Põe um campeão EM CAMPO pelo caminho REAL (ícone da skill no HUD + META.kits), sem
 *  substituir o kit pelo mínimo do stub — é o `definirCampeao` do banco, mas com o kit real. */
function porCampeaoEmCampo(m, id) {
  m.montar(IMG_HAB_SEL, [m.el({ tag: 'img', label: 'hud-hab-img', attrs: { src: '/img/habilidades/' + id + '/q.png' } })]);
  // o `carregarMeta` SUBSTITUI o META.kits inteiro (automação.js:994), não funde: por isso
  // reenvia-se sempre o mapa completo dos dois campeões.
  return alimentarMeta(m, { kits: KITS });
}

/** Nível do jogador (#hud-nivel) — o que o freqSkills lê para saber os ranks. */
function montarNivel(m, nivel) {
  m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nivel) })]);
  m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nivel) })]);
}

export const suite = {
  nome: 'passivas',
  titulo: 'Passivas dos itens na build + alvo por classe + Lich pela frequência de skills do motor',
  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarMeta(m, { itens: ITENS_DADOS, kits: KITS });
    montarNivel(m, 29);
    porCampeaoEmCampo(m, 'katarina');

    const champ = (id, magia, papel) => ({ id, magia, distancia: false, papel });

    /* ================= TK-02-24: CAMPO + PASSIVA (CDR / pen / AP%) ================= */
    // 3171 (campo cdr 0,15 E texto) + 4629 (SÓ texto): 15 + 15 = 30%, abaixo do tecto de 40%.
    const ef = auto.efeitosEquipados(['3171', '4629']);
    t.check('D1: 3171+4629 somam 30% de CDR (15 do campo + 15 do texto)', Math.abs(ef.cdr - 0.30) < 1e-9);
    t.check('D1: abaixo do tecto de 40% do motor (motor.js:537) e SEM desperdício', ef.cdr < 0.4 && ef.cdr > 0);
    t.check('D2: o 4629 (só texto, itens.js:2010) vale 15% sozinho', Math.abs(auto.efeitosEquipados(['4629']).cdr - 0.15) < 1e-9);
    t.check('D3: o 3171 (campo E texto, itens.js:1558-1559) vale 15%, não 30% (sem contagem dupla)',
      Math.abs(auto.efeitosEquipados(['3171']).cdr - 0.15) < 1e-9);
    t.check('D4: o AP% do 3089 sai do TEXTO (35%, itens.js:2580)', Math.abs(auto.efeitosEquipados(['3089']).apPct - 0.35) < 1e-9);
    t.check('D5: pen do CAMPO (3175 = 0,15, itens.js:1811)', Math.abs(auto.efeitosEquipados(['3175']).penMag - 0.15) < 1e-9);
    t.check('D5: pen do TEXTO (3135 = 40%, itens.js:1960)', Math.abs(auto.efeitosEquipados(['3135']).penMag - 0.40) < 1e-9);
    // a passiva do Lich entra na soma como campo do efeitosEquipados (motor: lich = 0,75)
    t.check('D6: o lich do 3100 entra como campo (0,75)', Math.abs(auto.efeitosEquipados(['3100']).lich - 0.75) < 1e-9);

    /* ================= TK-02-25: a build NÃO depende de quem está em campo ================= */
    const pedido = champ('katarina', true, PAPEL_KAT);
    porCampeaoEmCampo(m, 'taric');                             // EM CAMPO: Taric (outro campeão)
    const comTaricEmCampo = auto.buildIdealPara(pedido);
    porCampeaoEmCampo(m, 'katarina');                         // EM CAMPO: Katarina
    const comKatarinaEmCampo = auto.buildIdealPara(pedido);
    t.check('V1: buildIdealPara(katarina) dá o MESMO resultado com champAtual=taric e champAtual=katarina',
      JSON.stringify(comTaricEmCampo) === JSON.stringify(comKatarinaEmCampo));
    t.check('V2: e difere da build do OUTRO campeão (perfis diferentes, motor.js:877/901)',
      JSON.stringify(auto.buildIdealPara(champ('taric', true, PAPEL_TARIC))) !== JSON.stringify(comKatarinaEmCampo));

    /* ================= TK-02-32: o ALVO FIXO respeita a classe ================= */
    auto.setConfig({ objetivoItem: 'rabadon' });
    const adComAlvo = auto.buildIdealPara(champ('katarina', false, PAPEL_KAT));
    t.check('O1: objetivo "rabadon" NÃO contamina uma build AD (3089 ausente)', adComAlvo.indexOf('3089') < 0);
    t.check('O1: a build AD continua com 5 itens', adComAlvo.length === 5);
    t.check('O1: a build AD não tem nenhum item AP', adComAlvo.every((id) => {
      const it = ITENS_DADOS.find((x) => String(x.id) === id); return !it || !(it.ap > 0 && !(it.ad || it.critico || it.va || it.rv));
    }));
    const apComAlvo = auto.buildIdealPara(pedido);
    t.check('O2: no campeão AP o objetivo ENTRA (3089 presente)', apComAlvo.indexOf('3089') >= 0);
    auto.setConfig({ objetivoItemForcar: true });
    t.check('O3: com objetivoItemForcar o alvo de classe oposta ENTRA (escape do dono)',
      auto.buildIdealPara(champ('katarina', false, PAPEL_KAT)).indexOf('3089') >= 0);
    auto.setConfig({ objetivoItemForcar: false, objetivoItem: null });

    /* ================= TK-02-35: LICH pela FREQUÊNCIA de skills ================= */
    // nv29, pontos (29-1=28) na ordem oficial. Destrancadas sem dano: W, F (e D é passiva).
    // KATARINA: Q r1 (:751 10s) · E r10 (:756 6,4s) · R r5 (:759 42s) · G r1 (:762 20s)
    //           A r8 (:765 8,5s) · T r1 (:773 24s)
    const FREQ_KAT_29 = 1 / 10 + 1 / 6.4 + 1 / 42 + 1 / 20 + 1 / 8.5 + 1 / 24;
    // TARIC: Q r8 (:794 4,6s) · E r1 (:801 13s) · R r5 (:804 70s) · A r1 (:809 12s) · T r1 (:816 11s)
    const FREQ_TARIC_29 = 1 / 4.6 + 1 / 13 + 1 / 70 + 1 / 12 + 1 / 11;
    const cK = champ('katarina', true, PAPEL_KAT), cT = champ('taric', true, PAPEL_TARIC);
    const vpK = auto.valorPassiva('3100', cK), vpT = auto.valorPassiva('3100', cT);
    t.check('L1: KATARINA nv29 -> 75 x 9 x ' + (vpK / 675).toFixed(6) + ' conjurações/s (motor.js:751/756/759/762/765/773)',
      Math.abs(vpK - 75 * 9 * FREQ_KAT_29) < 1e-6);
    t.check('L1: TARIC (mago lento) nv29 -> 75 x 9 x ' + (vpT / 675).toFixed(6) + ' conjurações/s (motor.js:794/801/804/809/816)',
      Math.abs(vpT - 75 * 9 * FREQ_TARIC_29) < 1e-6);
    t.check('L2: as duas frequências são DIFERENTES (o ×2,2 fixo tratava os dois iguais)', vpK !== vpT);
    t.check('L2: a Katarina (skills curtas) vale MAIS que o mago lento', vpK > vpT);
    // o valor acompanha o NÍVEL (mais skills destrancadas = mais procs):
    const FREQ_KAT_13 = 1 / 10 + 1 / 9.2 + 1 / 42 + 1 / 20 + 1 / 12;    // nv13: E r3, A r1
    const FREQ_KAT_45 = 1 / 10 + 1 / 7.2 + 1 / 42 + 1 / 20 + 1 / 12 + 1 / 24 + 1 / 9.5 + 1 / 45;   // nv45: M r10, N r5
    montarNivel(m, 13);
    t.check('L3: nv13 -> 75 x 9 x ' + (auto.valorPassiva('3100', cK) / 675).toFixed(6) + ' (menos skills destrancadas)',
      Math.abs(auto.valorPassiva('3100', cK) - 75 * 9 * FREQ_KAT_13) < 1e-6);
    montarNivel(m, 45);
    t.check('L3: nv45 -> 75 x 9 x ' + (auto.valorPassiva('3100', cK) / 675).toFixed(6) + ' (todas as skills)',
      Math.abs(auto.valorPassiva('3100', cK) - 75 * 9 * FREQ_KAT_45) < 1e-6);
    montarNivel(m, 29);
    // RESPOSTA À PERGUNTA DO DONO (parte-02.md:1597): "o Lich entra na build dela? E na de um mago lento?"
    const buildK = auto.buildIdealPara(cK), buildT = auto.buildIdealPara(cT);
    t.check('L4: RESPOSTA KATARINA nv29 -> 3100 na build? ' + (buildK.indexOf('3100') >= 0 ? 'SIM' : 'NÃO') + ' [' + buildK.join(',') + ']', buildK.length === 5);
    t.check('L4: RESPOSTA TARIC (mago lento) nv29 -> 3100 na build? ' + (buildT.indexOf('3100') >= 0 ? 'SIM' : 'NÃO') + ' [' + buildT.join(',') + ']', buildT.length === 5);

    /* ================= honestidade do stub ================= */
    t.check('Z: nenhum seletor desconhecido foi usado (stub honesto)', m.unstubbed().length === 0);
  },
};

/* helpers locais (o lado do merge que os usava ficou de fora) */
function montarNivel(m, nv) { m.montar('#st-nivel', [m.el({ label: 'st-nivel', textContent: String(nv) })]); m.montar('#hud-nivel', [m.el({ label: 'hud-nivel', textContent: String(nv) })]); }
function porCampeaoEmCampo(m, id) { if (typeof m.definirCampeao === 'function') m.definirCampeao(m, id); }


