// Vilemaw, o chefe global (09/10/2026, sugestão de jogador): uma aranha gigante que aparece em Runeterra em horários
// fixos. A vida é uma só para todos (o servidor guarda e desconta os acertos de cada jogador, ver servidor/pvp.js), e
// é o servidor que escolhe os golpes e manda para todo mundo. Cada jogo vê a marca no chão e resolve o golpe no próprio
// campeão (dá para desviar andando), como os guardiões das fortalezas. Quem ajudou a vencer ganha o Baú da Vilemaw.
// Usado pelo jogo e pelo servidor (sem DOM).
import { CURVA, MONSTROS } from './motor.js';
import { mundoLogico, cidadeEm, zonaEm, zonaPkEm, RASTEIROS, LARG_M, ALT_M, chegadaCidade } from './runeterra.js';

export const VILEMAW = {
  nome: 'Vilemaw',
  raio: 2.4,                            // o tamanho dela no mundo (tiles): os golpes acertam a borda
  zonas: ['dragao', 'barao'],           // aparece num lugar sorteado dos Ermos do Dragão ou da Fenda do Vazio (pedido do dono)
  revela: 45,                           // a posição exata só vai para quem está a até 45 tiles (os outros sabem só a região)
  perto: 210,                           // e a até 210 tiles de Noxus (140 até o mapa crescer 1,5x, 13/10/2026) (a parte de nível alto do mapa; o anel inteiro seria grande demais para procurar)
  horarios: [13, 21],                   // horas (Brasília) em que ela aparece
  avisoMin: 10,                         // minutos de aviso no chat antes
  duraMin: 60,                          // minutos até ela voltar para a teia, se ninguém vencer (11/10/2026: 30 → 60, pedido do dono)
  // nível fixo (09/10/2026 à noite, pedido do dono: "mais forte de verdade"; antes a vida e a armadura seguiam o nível de quem
  // batia e 14 jogadores dos níveis 13 a 22 venceram em ~15 min). Vida: vidaBase Barões de nível `nivel` + vidaPorJogador
  // por participante; armadura e dano de um Barão desse nível. Medido (<scratch>/hud/sim-dps-vm.mjs, dano dos bots × 1,5
  // do ritmo real): 8 jogadores de nível 40 levam ~12 min, 15 de nível 20 ~22 min (perto do limite de 30), 3 de nível 48
  // ~17 min e um nível 48 sozinho não vence. Cada golpe tira no máximo `teto` da vida máxima de quem leva.
  // 10/10/2026 (pedido do dono: "um pouco mais fraca"): vida −20% (30 → 24 Barões, 1,5 → 1,2 por jogador) e os golpes −15%
  // (danoMult); e o ponto fraco: a cada 35 a 50 s ela fica exposta por 8 s e leva 50% a mais de dano
  nivel: 48, vidaBase: 24, vidaPorJogador: 1.2, danoMult: 0.85,
  pontoFraco: { cada: [35, 50], dura: 8, mult: 1.5 },
  minimo: 0.01,                         // parte mínima do dano total para ganhar o baú
  intervalo: [4.5, 6], intervaloFuria: [2.6, 3.6], furia: 0.3,
  mordida: { alcance: 1.3, cada: 2.2, k: 1.5, teto: 0.2 },     // quem fica colado nela leva uma mordida a cada 2,2 s
  semMonstros: 14,                      // sem os monstros comuns a esta distância dela enquanto ela está viva
};
// os golpes: o nome na tela, o tempo da marca até o golpe (s), o dano (× o de um Barão do nível dela), o teto (a parte máxima
// da vida de quem leva que um golpe tira) e a cor. Ninho de Teias e Chuva Ácida cobrem a área em volta dela.
export const GOLPES_VILEMAW = {
  teia: { nome: 'Teia Enredante', t: 1.4, k: 1.2, preso: 1.6, teto: 0.25, cor: '190,150,255' },
  ovos: { nome: 'Chuva de Ovos', t: 1.6, k: 1.1, teto: 0.25, cor: '140,240,170' },
  veneno: { nome: 'Sopro Venenoso', t: 1.3, k: 1.6, magico: true, queima: 0.02, teto: 0.3, cor: '120,240,90' },
  bote: { nome: 'Bote da Rainha', t: 1.5, k: 3, teto: 0.55, cor: '255,70,60' },
  rugido: { nome: 'Rugido da Rainha', t: 1.8, k: 2.2, lento: 2.5, teto: 0.4, cor: '110,240,255' },
  ninho: { nome: 'Ninho de Teias', t: 1.7, k: 1, preso: 1.2, teto: 0.25, cor: '210,170,255' },
  chuvaAcida: { nome: 'Chuva Ácida', t: 1.6, k: 1.2, magico: true, queima: 0.02, teto: 0.3, cor: '160,255,80' },
};
export const RODIZIO_VILEMAW = ['teia', 'ninho', 'veneno', 'ovos', 'chuvaAcida', 'bote'];
// dano base de um golpe (antes da armadura e do teto)
export const danoVilemaw = (k) => CURVA.ad(VILEMAW.nivel) * MONSTROS['Barão Nashor'].ad * k * (VILEMAW.danoMult || 1);
// um Barão do nível dela (a vida dela é contada em Barões)
export const baraoVilemaw = () => CURVA.hp(VILEMAW.nivel) * MONSTROS['Barão Nashor'].hp;
// o prêmio (sorteado no servidor, rota /api/vilemaw/bau): garantido para todos que ajudaram (ouro de ~8 Barões do nível,
// 2 a 4 runas, Seda de Vilemaw e a experiência de ~10 Barões do nível, uns 20 min de caça) e a chance de um drop melhor
// (os 3 que mais bateram: o dobro)
export const PREMIO_VILEMAW = { ouroBaroes: 8, runas: [2, 4], runasTop: 2, xpBaroes: 10, seda: [3, 8], presa: [1, 2],
  // 10/10/2026 (pedido do dono: "aumente um pouquinho a taxa de drops"): épico 50 → 60%, lendário 3 → 4,5%, Presa 40 → 50%,
  // Aranhinha 5 → 6% (os 3 que mais bateram: o dobro)
  chance: { epico: 0.6, lendario: 0.045, presa: 0.5, aranha: 0.06 }, chanceTop: { epico: 1, lendario: 0.09, presa: 1, aranha: 0.12 } };
// os lugares onde ela pode aparecer: clareiras das zonas de VILEMAW.zonas (6 tiles livres em volta), longe das cidades,
// das fortalezas e das Zonas de Guerra. Calculado uma vez (o mundo é sempre o mesmo).
let lugares = null;
export function lugaresVilemaw() {
  if (lugares) return lugares;
  const L = mundoLogico(), PISA = new Set(['grama', 'gramaE', 'terra', 'areia', 'pedra', 'cascalho', 'lama', 'vazio']);
  const pisa = (x, y) => { const c = L.chao[y]?.[x], o = L.obj[y]?.[x]; return (PISA.has(c) || cidadeEm(x + 0.5, y + 0.5)) && (!o || RASTEIROS.has(o[0]) || o[0] === 'casa'); };
  const livre = (x, y) => pisa(x, y) && !cidadeEm(x + 0.5, y + 0.5);
  // o que dá para alcançar a pé saindo de Noxus (sem ilhas cercadas de água)
  const chega = new Uint8Array(LARG_M * ALT_M), n0 = chegadaCidade('noxus'), fila = [[Math.floor(n0.x), Math.floor(n0.y)]];
  chega[fila[0][1] * LARG_M + fila[0][0]] = 1;
  for (let i = 0; i < fila.length; i++) {
    const [x, y] = fila[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * LARG_M + nx;
      if (nx < 0 || ny < 0 || nx >= LARG_M || ny >= ALT_M || chega[k] || !pisa(nx, ny)) continue;
      chega[k] = 1; fila.push([nx, ny]);
    }
  }
  lugares = [];
  for (let y = 16; y < ALT_M - 16; y += 3) for (let x = 16; x < LARG_M - 16; x += 3) {
    const z = zonaEm(x, y);
    if (!chega[y * LARG_M + x] || Math.hypot(x - n0.x, y - n0.y) > VILEMAW.perto) continue;
    if (!VILEMAW.zonas.includes(z) || zonaPkEm(x, y) || (L.fortalezas || []).some((f) => Math.hypot(f.x - x, f.y - y) < 14)) continue;
    let ok = true, bloq = 0;
    for (let dy = -6; dy <= 6 && ok; dy++) for (let dx = -6; dx <= 6; dx++) { const d2 = dx * dx + dy * dy; if (d2 > 36 || livre(x + dx, y + dy)) continue; bloq++; if (d2 < 12 || bloq > 8) { ok = false; break; } }
    if (ok) lugares.push({ x: x + 0.5, y: y + 0.5, zona: z });
  }
  return lugares;
}
// a próxima vez que ela aparece (ms), depois de "agora"
export function proximaVilemaw(agora = Date.now()) {
  const fuso = -3 * 3600000, local = new Date(agora + fuso), dia = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  for (let d = 0; d < 2; d++) for (const h of VILEMAW.horarios) { const t = dia + d * 86400000 + h * 3600000 - fuso; if (t > agora) return t; }
  return agora + 86400000;
}

