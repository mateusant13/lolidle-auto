// Wiki: os números, calculados a partir do motor (sem tela). Usado pela página (js/wiki.js) e pelo teste que confere
// cada número contra o jogo de verdade (<scratch>/hud/t-wiki.mjs). Se uma regra mudar no motor, mude aqui também.
import * as M from './motor.js';
import { ZONAS, GUARDIOES } from './runeterra.js';

export const ZONAS_RIFT = M.LOCAIS.filter((l) => l.faixa);
export const NOMES_COMUNS = Object.keys(M.MONSTROS).filter((n) => !M.MONSTROS[n].chefe);
export const NOMES_CHEFES = Object.keys(M.MONSTROS).filter((n) => M.MONSTROS[n].chefe);
export const ehBota = (i) => i.espaco === 'botas';
// em Runeterra, cada ponto de nascimento de uma zona com chefe tem esta fração de chance de ser o chefe (js/arena.js, nascerNoPonto)
export const CHEFE_RUNETERRA = 1 / 3;
// guardião das fortalezas (js/arena.js): elite = monstro comum reforçado; chefe = o próprio chefe, reforçado
export const GUARDIAO = { elite: { hp: 15, ad: 1.7, armadura: 1.6 }, chefe: { hp: 3, ad: 1.1, armadura: 1.3 }, acimaDoTopo: 4 };

// onde cada monstro aparece: [{ zona, peso (fração dos monstros do grupo), n0, n1 }] e, para os chefes, a chance por grupo
export const ONDE = {};
for (const z of ZONAS_RIFT) {
  const total = z.monstros.reduce((s, [, p]) => s + p, 0);
  for (const [nome, p] of z.monstros) (ONDE[nome] ||= []).push({ zona: z, peso: p / total, n0: z.nm[0], n1: z.nm[1] });
  if (z.chefe) (ONDE[z.chefe[0]] ||= []).push({ zona: z, chance: z.chefe[1], chanceRuneterra: z.chefe[1] * CHEFE_RUNETERRA, n0: z.nm[1] + 2, n1: z.nm[1] + 2 });
}
const faixaNiveis = (nome) => { const o = ONDE[nome] || []; return o.length ? [Math.min(...o.map((x) => x.n0)), Math.max(...o.map((x) => x.n1))] : [1, 1]; };
export { faixaNiveis };

// vida, dano por golpe (antes da armadura do campeão), armadura, ataques por segundo, experiência e ouro médio (sem bônus)
export function statsMonstro(nome, n, { noturno = false, guardiao = null, furioso = false } = {}) {
  const m = M.MONSTROS[nome], C = M.CURVA;
  let hp = C.hp(n) * m.hp, ad = C.ad(n) * m.ad, arm = C.armadura(n) * m.armadura, xp = C.xp(n) * m.xp, ouro = C.ouro(n) * m.ouro * 0.75;     // o ouro sai entre 50% e 100%
  if (noturno) { hp *= M.NOTURNO.hp; ad *= M.NOTURNO.ad; xp *= M.NOTURNO.xp; ouro *= M.NOTURNO.ouro; }
  if (furioso) { hp *= M.FURIOSO.hp; ad *= M.FURIOSO.ad; xp *= M.FURIOSO.xp; ouro *= M.FURIOSO.ouro; }
  const g = guardiao && GUARDIAO[guardiao];
  if (g) { hp *= g.hp; ad *= g.ad; arm *= g.armadura; }
  return { hp, ad, arm, xp, ouro, as: m.as * (furioso ? M.FURIOSO.as : 1) };
}
export function guardiaoDe(zid) {
  const z = M.LOCAL[zid], nome = GUARDIOES[zid], tipo = M.MONSTROS[nome]?.chefe ? 'chefe' : 'elite';
  return { zona: z, nome, tipo, n0: z.nm[1], n1: z.nm[1] + GUARDIAO.acimaDoTopo, stats: statsMonstro(nome, z.nm[1], { guardiao: tipo }) };
}
export const GUARDIOES_ZONAS = ZONAS.map(guardiaoDe);

// chance por abate de cada raridade e das runas numa zona (monstro comum, sem VIP), e a de cada item: a raridade
// sorteada dividida pelos itens daquela raridade na zona (o sorteio do item é uniforme). Por classe: ataque (ad) e mago (ap).
export function chancesZona(z) {
  const drop = M.chancesDrop(z, 1), runas = M.chancesGema(z, 1), q = M.QUALIDADES;
  const qual = Object.fromEntries(Object.entries(drop).map(([r, c]) => [r, { S: c * q.S.peso / 100, SS: c * q.SS.peso / 100 }]));
  return { drop, runas, qual };
}
export const ONDE_ITEM = {};
for (const z of ZONAS_RIFT) {
  const { drop } = chancesZona(z);
  for (const [classe, tabela] of [['ad', z.drops], ['ap', z.dropsAp]]) for (const rar of ['basico', 'epico', 'lendario']) {
    const lista = tabela?.[rar] || [];
    for (const id of lista) {
      const porZona = ((ONDE_ITEM[id] ||= {})[z.id] ||= { zona: z, porClasse: {} });
      porZona.porClasse[classe] = drop[rar] / lista.length;
    }
  }
}
export const melhorChance = (id) => Math.max(0, ...Object.values(ONDE_ITEM[id] || {}).flatMap((o) => Object.values(o.porClasse)));
export const USADO_EM = {};
for (const i of Object.values(M.ITENS)) for (const c of new Set(i.de || [])) (USADO_EM[c] ||= []).push(i.id);
export const custoMontagem = (id) => M.receitaDe(id)?.custo ?? null;

// habilidades: os números do rank 1 ao rank máximo (as tabelas do motor têm 10 posições, mesmo nas que vão só até o 5).
// tipo do dano (conferido contra a fórmula do motor no teste):
//   simples: base + escala × (Dano de Ataque ou Poder) · golpe: % do Dano de Ataque · escudo: base + escala × Poder (W da Lux)
//   execucao: (base + 75% do Dano de Ataque bônus) × (1 + 20% por acúmulo de Hemorragia) (R do Darius)
export const EXECUCAO = { bonusAd: 0.75, porAcumulo: 0.2 };
const corta = (h, arr) => (Array.isArray(arr) ? arr.slice(0, h.max) : null);
export function tipoDano(h) {
  if (typeof h.escudo === 'function' && Array.isArray(h.base) && Array.isArray(h.ratio)) return 'escudo';
  if (typeof h.dano !== 'function') return null;
  if (Array.isArray(h.mult) && !Array.isArray(h.base)) return 'golpe';
  if (Array.isArray(h.base) && Array.isArray(h.ratio)) return 'simples';
  if (Array.isArray(h.base)) return 'execucao';
  return 'outro';
}
// extras que têm nome claro para o jogador: [campo, rótulo, formato] (pct = porcentagem; s = segundos; num = número)
const EXTRAS = [
  ['pen', 'Penetração de armadura', 'pct'], ['bonus', 'Dano a mais', 'pct'], ['bonusHab', 'Dano das habilidades a mais', 'pct'],
  ['defesaBonus', 'Armadura e resistência mágica a mais', 'pct'], ['vontade', 'Dano de ataque a mais (com a vida baixa)', 'pct'],
  ['tenacidade', 'Resistência a controle', 'pct'], ['vidaPerdida', 'Dano extra pela vida que falta ao alvo', 'pct'], ['longe', 'Dano a mais de longe', 'pct'],
  ['devolveMana', 'Mana devolvida', 'num'], ['manaVolta', 'Mana de volta', 'pct'], ['curaPct', 'Cura (da vida máxima)', 'pct'],
  ['poderBonus', 'Poder de Habilidade a mais', 'pct'], ['duracao', 'Duração', 's'],
  // Yasuo
  ['reducao', 'Dano reduzido (quem atira de longe é bloqueado)', 'pct'], ['va', 'Velocidade de ataque a mais', 'pct'], ['escudoPct', 'Escudo (da vida máxima)', 'pct'],
  ['pctCorte', 'Corte de vento (do dano do ataque)', 'pct'], ['inquieta', 'Velocidade de ataque por crítico', 'pct'], ['levanta', 'Tempo no ar', 's'],
  ['acumula', 'Dano a mais por avanço seguido', 'pct'], ['penSuspiro', 'Ignora armadura (depois do golpe)', 'pct'], ['golpes', 'Cortes', 'num'],
  // Katarina
  ['atordoa', 'Atordoa', 's'], ['vel', 'Velocidade de movimento a mais (Runeterra)', 'pct'], ['curaSede', 'Vida de volta (do dano extra)', 'pct'],
  ['vaAdaga', 'Velocidade de ataque por adaga pega', 'pct'], ['curaGiro', 'Cura do giro (do dano)', 'pct'], ['venenoBase', 'Veneno por segundo (base)', 'num'],
  ['adagas', 'Adagas', 'num'], ['adagasFim', 'Adagas no fim', 'num'], ['some', 'Tempo nas sombras', 's'], ['bonusSombra', 'Próximo golpe a mais', 'pct'],
  ['executa', 'Executa abaixo de (da vida)', 'pct'],
  // Taric
  ['curaBase', 'Cura base', 'num'], ['curaRatio', 'Cura (do Poder de Habilidade)', 'pct'], ['curaVida', 'Cura a mais (da vida máxima)', 'pct'],
  ['armPassiva', 'Armadura a mais (passiva)', 'pct'], ['alvos', 'Alvos no Summoner\'s Rift', 'num'], ['espera', 'Demora para pegar', 's'],
  ['invulneravel', 'Invulnerável', 's'], ['defesa', 'Armadura e resistência mágica a mais', 'pct'], ['reflete', 'Dano devolvido', 'pct'],
  ['pulso', 'Dano do pulso (da cura)', 'pct'], ['escudoPoder', 'Escudo (do Poder de Habilidade)', 'pct'], ['lento', 'Lentidão', 's'],
  ['cura', 'Vida por segundo (da vida máxima)', 'pct'], ['manaSeg', 'Mana por segundo (da mana máxima)', 'pct'], ['curaDano', 'Cura (do dano causado)', 'pct'],
  ['emRuneterra', 'Dano em Runeterra (do normal)', 'pct'], ['ataques', 'Ataques fortalecidos', 'num'], ['reduz', 'Recargas a menos por ataque', 's'], ['manaGolpe', 'Mana por ataque (da mana máxima)', 'pct'],
  // Zac
  ['solo', 'Com um monstro só (vezes o dano)', 'vezes'], ['quiques', 'Quiques', 'num'], ['reduzDano', 'Dano recebido a menos', 'pct'],
  ['curaTotal', 'Cura no total (da vida máxima)', 'pct'], ['danoGosma', 'Dano das habilidades por gosma pega', 'pctMais'], ['reduzGosma', 'Recargas a menos por gosma pega', 's'],
  ['clones', 'Cópias', 'num'], ['curaPorAlvo', 'Cura por monstro atingido (da vida máxima)', 'pct'], ['curaAlvos', 'Monstros que curam (até)', 'num'], ['gosmas', 'Gosmas soltas', 'num'],
];
// a Matéria Instável (W do Zac) tira uma parte da vida máxima do alvo, contando no máximo esta vez a vida de um monstro comum do nível
export const TETO_VIDA_ALVO = M.TETO_VIDA_ITEM;
export function numerosHab(h, magia) {
  const out = [], f = (k) => corta(h, h[k]);
  if (h.recarga) out.push({ rotulo: 'Recarga', valores: f('recarga'), formato: 's' });
  if (h.custo && h.custo.some((x) => x > 0)) out.push({ rotulo: 'Mana', valores: f('custo'), formato: 'num' });      // o Yasuo não usa mana
  if (Array.isArray(h.custoVida) ? h.custoVida.some((x) => x > 0) : h.custoVida > 0)                                     // o Zac (e o Banho de Sangue) pagam com vida
    out.push({ rotulo: 'Custo (da vida atual)', valores: Array.isArray(h.custoVida) ? f('custoVida') : [h.custoVida], formato: 'pct' });
  const tipo = tipoDano(h), stat = magia ? 'Poder de Habilidade' : 'Dano de Ataque';
  if (tipo === 'simples') { out.push({ rotulo: 'Dano base', valores: f('base'), formato: 'num' }); out.push({ rotulo: 'Escala', valores: f('ratio'), formato: 'pctMais', de: stat }); }
  if (tipo === 'simples' && h.adRatio) out.push({ rotulo: 'Escala', valores: [h.adRatio], formato: 'pctMais', de: 'Dano de Ataque' });      // Shunpo (Katarina): soma o dano de ataque
  if (tipo === 'simples' && h.ratioVida) out.push({ rotulo: 'Escala', valores: [h.ratioVida], formato: 'pctMais', da: 'vida máxima' });      // Zac: soma uma parte da vida máxima
  if (Array.isArray(h.pctAlvo)) {                                                                                        // Matéria Instável (Zac)
    out.push({ rotulo: 'Mais (da vida máxima do alvo)', valores: f('pctAlvo'), formato: 'pct' });
    out.push({ rotulo: 'Vida do alvo que conta (no máximo)', valores: [TETO_VIDA_ALVO], formato: 'tetoVida' });
  }
  if (tipo === 'escudo') { out.push({ rotulo: 'Escudo base', valores: f('base'), formato: 'num' }); out.push({ rotulo: 'Escala', valores: f('ratio'), formato: 'pctMais', de: 'Poder de Habilidade' }); }
  if (tipo === 'golpe') out.push({ rotulo: 'Dano do golpe', valores: f('mult'), formato: 'pct', de: 'Dano de Ataque' });
  if (tipo === 'execucao') { out.push({ rotulo: 'Dano verdadeiro base', valores: f('base'), formato: 'num' }); out.push({ rotulo: 'Escala', valores: [EXECUCAO.bonusAd], formato: 'pctMais', de: 'Dano de Ataque bônus' }); out.push({ rotulo: 'Por acúmulo de Hemorragia', valores: [EXECUCAO.porAcumulo], formato: 'pctMais' }); }
  if (Array.isArray(h.impactoBase)) { out.push({ rotulo: 'Impacto', valores: f('impactoBase'), formato: 'num' }); out.push({ rotulo: 'Escala do impacto', valores: f('impactoRatio'), formato: 'pctMais', de: stat }); }
  for (const [k, rotulo, formato] of EXTRAS) if (h[k] != null) out.push({ rotulo, valores: Array.isArray(h[k]) ? f(k) : [h[k]], formato });
  if (h.clones && h.cada) out.push({ rotulo: 'Cada cópia bate a cada', valores: [h.cada], formato: 's' });                 // Mitose (Zac)
  if (h.danoGosma) out.push({ rotulo: 'Acúmulos (até)', valores: [h.acumMax], formato: 'num' }, { rotulo: 'Duração do bônus', valores: [h.duracaoAbs], formato: 's' });      // Absorção (Zac)
  return out;
}
// a passiva (P): o nome e a descrição vêm dos dados do campeão (a do Zac tem os números das gosmas e da Divisão Celular).
// Os que dependem do nível do campeão vão do nível 1 ao máximo (niveis).
export function numerosPassiva(h) {
  const out = [], niveis = [1, M.NIVEL_MAX];
  if (h?.passivaZac) {
    out.push({ rotulo: 'Gosmas por habilidade (uma por monstro atingido, até)', valores: [h.maxPorLance], formato: 'num' });
    out.push({ rotulo: 'Tempo da gosma no chão', valores: [h.dura], formato: 's' });
    out.push({ rotulo: 'Cura da gosma (da vida máxima)', valores: niveis.map(h.curaGosma), formato: 'pct', niveis });
    out.push({ rotulo: 'Mais (da vida que falta)', valores: niveis.map(h.curaFalta), formato: 'pct', niveis });
    out.push({ rotulo: 'Matéria Instável adiantada por gosma', valores: [h.wReduz], formato: 's' });
    out.push({ rotulo: 'Divisão Celular: tempo dividido', valores: [h.renasce.espera], formato: 's' });
    out.push({ rotulo: 'Volta com (da vida máxima)', valores: niveis.map(h.renasce.vida), formato: 'pct', niveis });
    out.push({ rotulo: 'Recarga da Divisão Celular', valores: [h.renasce.recarga], formato: 's' });
  }
  return out;
}
