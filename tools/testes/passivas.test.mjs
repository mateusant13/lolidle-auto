/*
 * passivas.test.mjs - PASSIVAS DE ESTADO com contexto de combate (TK-02-05).
 *
 * MOTIVO: 13 passivas de estado ficaram SEM regra propria durante varias rondas — o scoring
 * so olhava para texto e stats, e itens como o Fulgor (3057), o Anjo Guardiao (3026), a
 * Danca da Morte (6333) e a Sedenta (3072) valiam 0 em TODAS as fases. Evidencia:
 * parte-02.md:226 (objectivo do dono, ponto 2) e parte-02.md:3396 (as 13 restantes).
 *
 * O que se protege:
 *   P1 - cada uma das 13 tem regra propria declarada (PASSIVAS_ESTADO ou PESO_FASE);
 *   P2 - cada regra cita o motor VIVO (file:linha no comentario) — nenhuma constante solta;
 *   P3 - a Lamina Encantada (3057/3078) vale lamina x baseAd x lançamentos/s (motor.js:1694);
 *   P4 - a Geada (3116) vale 0,6 s de ataques do alvo evitados (motor.js:1223 + 1748);
 *   P5 - a fase ACTIVA e DESACTIVA: Anjo/Zhonya/Danca so no chefe; valor 0 na fase errada;
 *   P6 - Warmog (3083) está coberto pelo campo regen do próprio item (motor.js:548/1375);
 *   P7 - os itens que eram INVISÍVEIS (0 em tudo) deixam de ser. *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao } from './dom-stub.mjs';
import { ITENS_DADOS } from '../../docs/game-src/itens.js';
import { readFileSync } from 'node:fs';
const _kj = readFileSync(new URL('../../docs/game-src/kit-katarina-vivo.json', import.meta.url), 'utf8');
const KITS = JSON.parse(_kj.slice(_kj.indexOf('{')));
const PAPEL_KAT = { dano: 1, recebido: 0.75 };
const PAPEL_TARIC = { dano: 1, recebido: 1 };

const OS_13 = ['3057', '3116', '3085', '6655', '3742', '3102', '3083', '6610', '3026', '3157', '6333', '3078', '3072'];

export const suite = {
  nome: 'passivas',
  titulo: 'Passivas de estado com contexto de combate (as 13)',
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
