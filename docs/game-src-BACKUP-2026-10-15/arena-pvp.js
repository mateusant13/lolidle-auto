// Arena: PvP 1 contra 1 numa ponte, inspirada no ARAM (pedido do dono, 12/10/2026). Regras usadas pelo jogo e pelo servidor.
// Duas formas de jogar: o desafio (um jogador chama outro pelo nome; não mexe nos PDL) e a ranqueada (fila que procura alguém
// de Poder parecido; quem ganha leva PDL e quem perde perde). A partida é melhor de 3 rodadas; cada rodada acaba com uma morte
// ou no tempo (aí vence quem está com mais % de vida). Na arena ninguém perde XP nem itens, e as poções valem.

export const ARENA_PVP = {
  vitorias: 2,                // melhor de 3: quem ganhar 2 rodadas leva
  maxRodadas: 5,              // rodada empatada no tempo não dá ponto a ninguém; depois da 5ª, a partida termina empatada
  rodadaSeg: 120,             // tempo de cada rodada
  contagemSeg: 3,             // contagem antes de cada rodada (ninguém anda nem ataca)
  intervaloSeg: 4,            // entre o fim de uma rodada e a contagem da próxima
  esperaSeg: 40,              // tempo para os dois chegarem na arena; quem não chega perde a vez (sem PDL)
  preparoSeg: Number(globalThis.process?.env?.ARENA_PREPARO ?? 15),      // antes de ir para a ponte: ver o oponente e ajustar a build ("Estou pronto" nos dois começa na hora; ARENA_PREPARO só nos testes)
  quedaSeg: 20,               // caiu a conexão no meio da partida: perde se não voltar nesse tempo
  nivelMin: 10,               // ranqueada a partir do nível 10 (desafio, qualquer nível)
  aceitarSeg: 15,             // a partida encontrada na fila espera o aceite por 15 s
  desafioSeg: 60,             // um desafio vale 60 s
  castigoSeg: 120,            // não aceitou a partida encontrada: 2 min sem poder entrar na fila
  mesmoParDia: 3,             // a mesma dupla vale PDL no máximo 3 vezes por dia (contra vitória combinada)
  calibracao: 5,              // as 5 primeiras ranqueadas valem o dobro de PDL (para cada um chegar logo no seu elo)
  fila: { faixa: 0.1, cresce: 0.05, cada: 20, max: 0.3 },     // Poder parecido: ±10%, abrindo +5% a cada 20 s na fila, até ±30% (era até ±60%: 3.000 × 1.700)
  pdl: { vitoria: 20, derrota: 18, ajuste: 20, maxAjuste: 8, poder: 1.5, poderMin: 0.5, poderMax: 1.5 }, // ±1 PDL a cada 20 pontos de diferença, até ±8; e pelo Poder (abaixo)
  // o mapa (48 × 36, como os do Summoner's Rift): a ponte deitada no meio, com as duas bases nas pontas
  mapa: { larg: 48, alt: 36, y0: 14, y1: 21, x0: 3, x1: 44 },
  inicio: [{ x: 6.5, y: 17.5 }, { x: 41.5, y: 17.5 }],     // onde cada um começa a rodada
};

// os elos: de Ferro a Diamante com 4 divisões (IV a I) de 100 PDL; depois Mestre, Grão-Mestre e Desafiante (PDL sem teto)
export const ELOS = [
  { id: 'ferro', nome: 'Ferro', cor: '#8b7d74' },
  { id: 'bronze', nome: 'Bronze', cor: '#b0703f' },
  { id: 'prata', nome: 'Prata', cor: '#a9b8c6' },
  { id: 'ouro', nome: 'Ouro', cor: '#e5bd4f' },
  { id: 'platina', nome: 'Platina', cor: '#4cc3b2' },
  { id: 'esmeralda', nome: 'Esmeralda', cor: '#33c46e' },
  { id: 'diamante', nome: 'Diamante', cor: '#7ea8ff' },
  { id: 'mestre', nome: 'Mestre', cor: '#b863dc' },
  { id: 'graomestre', nome: 'Grão-Mestre', cor: '#e8524a' },
  { id: 'desafiante', nome: 'Desafiante', cor: '#f7dc7a' },
];
const DIVISOES = ['IV', 'III', 'II', 'I'];
export const PDL_ELO = 400;                       // pontos de um elo inteiro (4 divisões de 100)
export const PISO_ALTO = { mestre: 2800, graomestre: 3200, desafiante: 3600 };

// pontos (o total guardado no banco) → o elo, a divisão e os PDL que aparecem na tela
export function elo(pontos) {
  const p = Math.max(0, Math.floor(Number(pontos) || 0));
  for (const id of ['desafiante', 'graomestre', 'mestre']) if (p >= PISO_ALTO[id]) {
    const e = ELOS.find((x) => x.id === id);
    return { ...e, i: ELOS.indexOf(e), div: '', pdl: p - PISO_ALTO[id], pontos: p };
  }
  const i = Math.floor(p / PDL_ELO), resto = p % PDL_ELO;
  return { ...ELOS[i], i, div: DIVISOES[Math.floor(resto / 100)], pdl: resto % 100, pontos: p };
}

// quanto a partida ranqueada muda: perto de 20 para quem ganha e 18 para quem perde, corrigido pela diferença dos dois
// (ganhar de quem está acima vale mais; perder para quem está abaixo custa mais); na calibração vale o dobro
// O Poder também conta: vencer quem é mais forte rende mais e perder para ele custa menos (e o contrário), ×0,5 a ×1,5
export function variacaoPdl(meus, deles, venceu, jogadas = 99, poderMeu = 0, poderDeles = 0) {
  const P = ARENA_PVP.pdl;
  const aj = Math.max(-P.maxAjuste, Math.min(P.maxAjuste, ((Number(deles) || 0) - (Number(meus) || 0)) / P.ajuste));
  let v = venceu ? P.vitoria + aj : -(P.derrota - aj);
  const pm = Number(poderMeu) || 0, pd = Number(poderDeles) || 0;
  if (pm > 0 && pd > 0) {
    const d = (pd - pm) / Math.max(pm, pd);          // + quando o outro é mais forte
    v *= Math.max(P.poderMin, Math.min(P.poderMax, venceu ? 1 + P.poder * d : 1 - P.poder * d));
  }
  if (jogadas < ARENA_PVP.calibracao) v *= 2;
  return Math.round(v);
}

// na fila: até quanto de diferença de Poder (fração) já vale, depois de `seg` segundos esperando
export const faixaFila = (seg) => Math.min(ARENA_PVP.fila.max, ARENA_PVP.fila.faixa + Math.floor(Math.max(0, seg) / ARENA_PVP.fila.cada) * ARENA_PVP.fila.cresce);
// dois jogadores da fila combinam se a diferença de Poder cabe na faixa de quem está esperando há mais tempo
export const combinam = (poderA, segA, poderB, segB) => Math.abs(poderA - poderB) <= Math.max(poderA, poderB, 1) * Math.max(faixaFila(segA), faixaFila(segB));

// o chão da arena: a ponte (e as duas bases nas pontas) é andável; o resto é o abismo
export function livreArena(x, y) {
  const m = ARENA_PVP.mapa;
  return x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1;
}

