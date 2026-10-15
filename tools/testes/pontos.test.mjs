/*
 * pontos.test.mjs - GASTAR TODOS OS PONTOS (skill points e attribute points).
 *
 * Regra do dono: "Gastar TODOS os pontos: skill points (subir habilidades, com a ULTIMATE
 * na barra) e attribute points (distribuir)."
 *
 * PORQUE ESTA SUITE EXISTE: era o ULTIMO eixo das regras do dono sem UM teste. O banco tinha
 * zero cobertura para subirHabilidades / distribuirAtributos / valorDoPonto.
 *
 * O QUE AQUI SE PROTEGE (a propriedade que causou os ciclos de recall medidos): estas duas
 * accoes NAO PODEM agir quando nao ha pontos. Uma accao que 'age sempre' vira necessidade
 * eterna (n.hab / n.atrib nunca fecham) e o boneco volta a base a cada 20 s.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';

export const suite = {
  nome: 'pontos',
  titulo: 'Gastar pontos (skill e atributo) - nada a gastar = nada a fazer)',

  async run(t) {
    const m = criarMundo();
    const auto = carregarAutomation(m);
    alimentarCatalogo(m);
    definirCampeao(m, 'adtest');

    /* ---- P1: sem pontos no HUD, subir habilidades nao gasta nada e nao falha. */
    let s = null, erroS = null;
    try { s = await auto.subirHabilidades(); } catch (e) { erroS = String(e.message); }
    t.check('P1: subirHabilidades sem pontos nao lanca excepcao', erroS === null);
    t.check('P1: subirHabilidades sem pontos devolve ok:true', !!(s && s.ok === true));
    t.check('P1: subirHabilidades sem pontos gasta 0', !!(s && s.gastos === 0));
    t.check('P1: subirHabilidades sem pontos nao desbloqueia nada', !!(s && (s.desbloqueios || 0) === 0));

    /* ---- P2: sem botoes de atributo, distribuir nao gasta nada e nao falha. */
    let a = null, erroA = null;
    try { a = await auto.distribuirAtributos(); } catch (e) { erroA = String(e.message); }
    t.check('P2: distribuirAtributos sem botoes nao lanca excepcao', erroA === null);
    t.check('P2: distribuirAtributos sem botoes gasta 0', !!(a && a.gastos === 0));

    /* ---- P3: readSkills devolve os DOIS contadores separados (skill x atributo). */
    let rs = null;
    try { rs = auto.readSkills(); } catch { /* ignore */ }
    t.check('P3: readSkills devolve pontos de SKILL', !!(rs && rs.pontos === 0));
    t.check('P3: readSkills devolve pontos de ATRIBUTO (contador separado)', !!(rs && rs.pontosAtrib === 0));

    /* ---- P4: as necessidades ficam FECHADAS sem pontos (nao viram necessidade eterna). */
    let n = null;
    try { n = auto.necessidadesBase(); } catch { /* ignore */ }
    t.check('P4: n.hab fechada sem pontos de skill', !!(n && n.hab === false));
    t.check('P4: n.atrib fechada sem pontos de atributo', !!(n && n.atrib === false));
  },
};
