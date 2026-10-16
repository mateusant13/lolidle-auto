// Runeterra: o mundo aberto onde o jogador anda com o campeão (o modo no controle).
// Aqui fica só a parte lógica (sem canvas): zonas de caça por faixa de nível, cidades seguras, estradas,
// o terreno de cada tile, os obstáculos e os pontos onde os monstros nascem. O desenho fica em mundo.js.
// O servidor também usa este arquivo (para saber onde é cidade e o tamanho do mundo).

// o mundo cresceu três vezes (128×96, 256×192, 512×384 e, em 13/10/2026, 1,5x: 768×576): ESC multiplica as posições do desenho original
// (cidades, estradas, zonas). As cidades, as fortalezas e o terreno miúdo (lagos, manchas) continuam do mesmo tamanho.
export const LARG_M = 768, ALT_M = 576;
const ESC = 6;

// cidades: zona segura (sem monstros e sem PvP), com Soraka e Lojista. faixa = níveis de quem caça em volta.
export const CIDADES = [
  { id: 'demacia', nome: 'Demacia', x: 20 * ESC, y: 78 * ESC, r: 16, faixa: [1, 15], cor: '#6aa8ff', estilo: 0 },
  { id: 'piltover', nome: 'Piltover', x: 64 * ESC, y: 50 * ESC, r: 15, faixa: [15, 30], cor: '#e8b850', estilo: 1 },
  { id: 'noxus', nome: 'Noxus', x: 104 * ESC, y: 22 * ESC, r: 16, faixa: [30, 50], cor: '#ff5a4a', estilo: 2 },
];
export const CIDADE = Object.fromEntries(CIDADES.map((c) => [c.id, c]));
// Zonas de Guerra: dentro delas o PK fica ligado e não desliga, e a experiência rende PK_BONUS a mais.
// Duas por faixa de nível a partir do 10 (eram uma até 13/10/2026: poucas e fáceis de monopolizar), longe das cidades
// (posições achadas por <scratch>/hud/achar-pk.mjs e, as novas, <scratch>/mapa3/achar-pk2.mjs).
export const PK_BONUS = 0.4;
export const ZONAS_PK = [
  { id: 'clareira', nome: 'Clareira Sangrenta', x: 28 * ESC, y: 40 * ESC, r: 6.5 * ESC, zona: 'lobos' },
  { id: 'renegados', nome: 'Arena dos Renegados', x: 91 * ESC, y: 82 * ESC, r: 6.5 * ESC, zona: 'vermelho' },
  { id: 'ruinas', nome: 'Ruínas em Guerra', x: 116 * ESC, y: 87 * ESC, r: 6.5 * ESC, zona: 'dragao', semCap: true },
  { id: 'abismo', nome: 'Abismo Sangrento', x: 119 * ESC, y: 47 * ESC, r: 6.5 * ESC, zona: 'barao', semCap: true },
  { id: 'uivos', nome: 'Covil dos Uivos', x: 67 * ESC, y: 88 * ESC, r: 6.5 * ESC, zona: 'lobos' },
  { id: 'laminas', nome: 'Campo das Lâminas', x: 73 * ESC, y: 63 * ESC, r: 6.5 * ESC, zona: 'azul' },
  { id: 'duelos', nome: 'Vale dos Duelos', x: 53 * ESC, y: 43 * ESC, r: 6.5 * ESC, zona: 'azul' },
  { id: 'escarlate', nome: 'Mata Escarlate', x: 7 * ESC, y: 19 * ESC, r: 6.5 * ESC, zona: 'vermelho' },
  { id: 'vau', nome: 'Vau Sangrento', x: 63 * ESC, y: 13 * ESC, r: 6.5 * ESC, zona: 'rio' },
  { id: 'discordia', nome: 'Margem da Discórdia', x: 94 * ESC, y: 35 * ESC, r: 6.5 * ESC, zona: 'rio' },
  { id: 'cinzas', nome: 'Cinzas da Batalha', x: 109 * ESC, y: 66 * ESC, r: 6.5 * ESC, zona: 'dragao', semCap: true },
  { id: 'carnificina', nome: 'Fenda da Carnificina', x: 103 * ESC, y: 7 * ESC, r: 6.5 * ESC, zona: 'barao', semCap: true },
];
// semCap (p689): Zona de Guerra vermelha, sem limite de nível no PvP entre quem está dentro; as outras são laranjas
export const corZonaPk = (z, a = 1) => z.semCap ? `rgba(210,25,25,${a})` : `rgba(235,125,20,${a})`;
export const zonaPkEm = (x, y) => ZONAS_PK.find((z) => Math.hypot(x - z.x, (y - z.y) * 1.1) < z.r) || null;

// as zonas de caça são anéis em volta de Demacia: quanto mais longe, mais fortes os monstros.
// Cada zona usa os monstros, o saque e a faixa de nível de um lugar do Summoner's Rift (motor.js LOCAIS).
export const ZONAS = ['rota-inf', 'rota-sup', 'lobos', 'azul', 'vermelho', 'rio', 'dragao', 'barao'];
const LIMITES = [24, 37, 50, 63, 76, 89, 103].map((d) => d * ESC);     // distância (com ruído) onde começa a próxima zona
// nome de cada zona no mundo
export const NOME_ZONA = {
  'rota-inf': 'Campos de Demacia', 'rota-sup': 'Estrada dos Soldados', lobos: 'Mata dos Lobos', azul: 'Bosque Azul',
  vermelho: 'Selva Rubra', rio: 'Pântano do Rio', dragao: 'Ermos do Dragão', barao: 'Fenda do Vazio',
};

// estradas: ligam as cidades e cortam as zonas (pontos em tiles)
const ESTRADAS = [
  [[20, 78], [34, 70], [46, 60], [64, 50]],                      // Demacia → Piltover
  [[64, 50], [78, 40], [92, 30], [104, 22]],                     // Piltover → Noxus
  [[20, 78], [36, 84], [56, 88], [80, 86], [104, 80], [122, 70]],  // Demacia → leste, pelo sul
  [[20, 78], [14, 60], [16, 40], [24, 22], [36, 8]],             // Demacia → norte, pelo oeste
  [[64, 50], [52, 34], [44, 18], [56, 6]],                       // Piltover → norte
  [[64, 50], [80, 62], [100, 64], [120, 48]],                    // Piltover → leste
  [[104, 22], [118, 10]], [[104, 22], [84, 10]],                 // em volta de Noxus
  [[36, 84], [40, 72], [34, 70]], [[56, 88], [60, 70], [64, 50]],  // atalhos entre as estradas do sul
  [[16, 40], [30, 36], [44, 18]], [[80, 62], [86, 46], [92, 30]], [[104, 80], [100, 64]],
].map((e) => e.map(([x, y]) => [x * ESC, y * ESC]));
// aldeias na beira das estradas: algumas casas, poço de lampião e barris (pontos no desenho original)
const ALDEIAS = [[34, 70, 0], [16, 52, 0], [56, 88, 0], [46, 60, 1], [80, 86, 1], [52, 34, 1], [100, 64, 2], [92, 30, 2], [118, 10, 2]].map(([x, y, e]) => [x * ESC, y * ESC, e]);

// ---------- números repetíveis (mesmo mundo no navegador e no servidor) ----------
function sfc32(a, b, c, d) {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0; d = (d + 1) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
const rngM = (s) => { const r = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, s); for (let i = 0; i < 12; i++) r(); return r; };
function ruido(r, escala) {   // escala em tiles do mundo novo
  const gw = Math.ceil(LARG_M / escala) + 2, gh = Math.ceil(ALT_M / escala) + 2, g = [];
  for (let y = 0; y < gh; y++) { g.push([]); for (let x = 0; x < gw; x++) g[y].push(r()); }
  const suave = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = Math.max(0, x) / escala, gy = Math.max(0, y) / escala, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = suave(gx - x0), fy = suave(gy - y0);
    const a = g[y0][x0] + (g[y0][x0 + 1] - g[y0][x0]) * fx, b = g[y0 + 1][x0] + (g[y0 + 1][x0 + 1] - g[y0 + 1][x0]) * fx;
    return a + (b - a) * fy;
  };
}

// ---------- zonas ----------
let grade = null;       // índice da zona de cada tile (0–7) ou 100 + índice da cidade
function montarGrade() {
  const n = ruido(rngM(7), 11 * ESC), n2 = ruido(rngM(8), 5 * ESC);
  grade = new Uint8Array(LARG_M * ALT_M);
  const d0 = CIDADES[0];
  for (let y = 0; y < ALT_M; y++) for (let x = 0; x < LARG_M; x++) {
    const ci = CIDADES.findIndex((c) => Math.hypot(x + 0.5 - c.x, (y + 0.5 - c.y) * 1.1) < c.r);
    if (ci >= 0) { grade[y * LARG_M + x] = 100 + ci; continue; }
    const d = Math.hypot(x - d0.x, (y - d0.y) * 1.15) + (n(x, y) - 0.5) * 16 * ESC + (n2(x, y) - 0.5) * 4 * ESC;
    let z = 0;
    while (z < LIMITES.length && d >= LIMITES[z]) z++;
    grade[y * LARG_M + x] = z;
  }
}
const celula = (x, y) => {
  if (!grade) montarGrade();
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= LARG_M || ty >= ALT_M) return 0;
  return grade[ty * LARG_M + tx];
};
// a cidade em (x, y) (posição em tiles), ou null
export const cidadeEm = (x, y) => { const v = celula(x, y); return v >= 100 ? CIDADES[v - 100] : null; };
// o id da zona de caça em (x, y) (um id de LOCAIS), ou null numa cidade
export const zonaEm = (x, y) => { const v = celula(x, y); return v >= 100 ? null : ZONAS[v]; };

// ---------- o mundo: chão, obstáculos e pontos de nascimento ----------
// chão por zona (tipos de pixel.js PISOS) e objetos com a chance por tile
const TERRENO = {
  'rota-inf': { base: 'grama', objetos: [['flores', 0.05], ['arbusto', 0.018], ['arvore', 0.02], ['rocha', 0.008]] },
  'rota-sup': { base: 'grama', mancha: 'terra', objetos: [['arvore', 0.03], ['arbusto', 0.025], ['flores', 0.03], ['rocha', 0.012], ['ruina', 0.005]] },
  lobos: { base: 'gramaE', mancha: 'terra', objetos: [['arvoreE', 0.075], ['arbusto', 0.03], ['cogumelo', 0.03], ['rocha', 0.012]] },
  azul: { base: 'gramaE', mancha: 'pedra', objetos: [['arvoreE', 0.06], ['rocha', 0.025], ['arbusto', 0.025], ['flores', 0.025], ['cristal', 0.004]] },
  vermelho: { base: 'gramaE', mancha: 'terra', objetos: [['arvoreE', 0.065], ['cogumelo', 0.04], ['arbusto', 0.02], ['rocha', 0.02]] },
  rio: { base: 'grama', agua: true, objetos: [['arvore', 0.03], ['arbusto', 0.02], ['flores', 0.03], ['rocha', 0.015]], naAreia: [['junco', 0.12], ['rocha', 0.02]] },
  dragao: { base: 'areia', mancha: 'lama', agua: true, objetos: [['rocha', 0.04], ['ossos', 0.035], ['ruina', 0.01], ['arbusto', 0.008]], naAreia: [['ossos', 0.03], ['rocha', 0.03]] },
  barao: { base: 'vazio', mancha: 'lama', objetos: [['cristal', 0.035], ['rochaV', 0.035], ['ossos', 0.05]] },
};
// fortalezas: um planalto cercado de penhascos, com uma escada na frente. Lá em cima ficam monstros da zona, um
// guardião (o chefe da zona ou a versão elite do monstro mais forte dela) e um baú que só abre depois de vencê-lo.
export const GUARDIOES = { 'rota-inf': 'Tropa Corpo a Corpo', 'rota-sup': 'Tropa de Cerco', lobos: 'Lobo Gigante', azul: 'Sentinela Azul',
  vermelho: 'Brambleback Vermelho', rio: 'Arauto do Vale', dragao: 'Dragão Infernal', barao: 'Barão Nashor' };
export const FRX = 7, FRY = 5;          // meia largura e meia altura do planalto (tiles)

// objetos que não bloqueiam a passagem (decoração rasteira)
export const RASTEIROS = new Set(['flores', 'ossos', 'junco', 'estrelas', 'cogumelo']);
// objetos grandes que ocupam mais de um tile: [esquerda, direita, para cima] a partir do tile de apoio
export const PEGADA = { casa: [1, 1, 1] };

function linhaGrossa(marcar, pts, r) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ondula = Math.sin(t * 6 + k) * 1.5;
      const nx = -(y1 - y0), ny = x1 - x0, nn = Math.hypot(nx, ny) || 1;
      marcar(x + (nx / nn) * ondula, y + (ny / nn) * ondula, r);
    }
  }
}

let logica = null;
// gera (uma vez) o mundo inteiro: { larg, alt, chao[y][x], obj[y][x] = [tipo, variante] | null, bloq[y][x], estrada, npcs, pontos }
export function mundoLogico() {
  if (logica) return logica;
  const r = rngM(42), n1 = ruido(rngM(3), 8), n2 = ruido(rngM(4), 5), nAgua = ruido(rngM(5), 13);
  const L = LARG_M, A = ALT_M;
  const chao = [], obj = [], estrada = [];
  for (let y = 0; y < A; y++) { chao.push(new Array(L).fill('grama')); obj.push(new Array(L).fill(null)); estrada.push(new Uint8Array(L)); }
  // estradas (2 tiles de largura, com ondulação)
  const marcar = (x, y, raio) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.round(x + dx), ty = Math.round(y + dy);
      if (tx >= 0 && ty >= 0 && tx < L && ty < A && Math.hypot(tx - x, ty - y) <= raio) estrada[ty][tx] = 1;
    }
  };
  for (const e of ESTRADAS) linhaGrossa(marcar, e, 1.1);

  // chão de cada zona
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) {
    const cid = cidadeEm(x + 0.5, y + 0.5);
    if (cid) {
      const d = Math.hypot(x + 0.5 - cid.x, (y + 0.5 - cid.y) * 1.1);
      chao[y][x] = d < 3 ? 'fonte' : 'pedra';
      continue;
    }
    const z = TERRENO[zonaEm(x, y)];
    let t = z.base;
    if (z.mancha && n1(x, y) > 0.68) t = z.mancha;
    if (z.agua) {
      const w = nAgua(x, y);
      if (w > 0.74) t = 'agua';
      else if (w > 0.66) t = 'areia';
    }
    if (zonaEm(x, y) === 'dragao' && n2(x, y) > 0.8) t = 'pedra';
    if (estrada[y][x]) t = t === 'agua' ? 'pedra' : 'terra';        // a estrada atravessa a água numa ponte de pedra
    chao[y][x] = t;
  }

  // cidades: muralha com portões nas estradas, casas, praça com lampiões, bandeiras e a banca do Lojista
  const npcs = [];
  for (const c of CIDADES) {
    const ocupar = (x, y, o) => { if (x > 0 && y > 0 && x < L - 1 && y < A - 1 && !obj[y][x] && !estrada[y][x]) obj[y][x] = o; };
    // NPCs ao lado da praça, fora da rua
    const lugarNpc = (cands) => cands.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).find((p) => !estrada[p.y][p.x] && !obj[p.y][p.x]) || { x: c.x + cands[0][0], y: c.y + cands[0][1] };
    for (let y = c.y - c.r - 2; y <= c.y + c.r + 2; y++) for (let x = c.x - c.r - 2; x <= c.x + c.r + 2; x++) {
      if (x < 1 || y < 1 || x >= L - 1 || y >= A - 1) continue;
      const d = Math.hypot(x + 0.5 - c.x, (y + 0.5 - c.y) * 1.1);
      if (d >= c.r - 0.75 && d < c.r + 0.25 && !estrada[y][x] && !estrada[y - 1]?.[x] && !estrada[y + 1]?.[x]) obj[y][x] = ['ruina', 0];
    }
    for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) ocupar(c.x + dx, c.y + dy, ['lampiao', 0]);
    ocupar(c.x - 2, c.y - 3, ['bandeira', c.estilo]); ocupar(c.x + 2, c.y - 3, ['bandeira', c.estilo]);
    const so = lugarNpc([[-2, 1], [-2, 2], [-3, 1], [-1, 2], [-2, -1], [-3, -1], [-3, 2]]);
    obj[so.y][so.x] = ['npc', 0];
    const lo = lugarNpc([[2, 1], [2, 2], [3, 1], [1, 2], [2, -1], [3, -1], [3, 2], [1, -2]]);
    npcs.push({ nome: 'Soraka', ...so, cidade: c.id }, { nome: 'Lojista', ...lo, cidade: c.id });
    obj[lo.y][lo.x] = ['npc', 0];
    ocupar(lo.x + 1, lo.y, ['tenda', 0]); ocupar(lo.x + 1, lo.y + 1, ['caixote', 1]); ocupar(lo.x - 1, lo.y + 1, ['barril', 0]);
    ocupar(so.x - 1, so.y, ['braseiro', 0]); ocupar(so.x - 1, so.y + 1, ['estrelas', 1]); ocupar(so.x, so.y + 1, ['estrelas', 2]);
    // o Burrinho de Carga (out/2026): o cofre da Tesoureira também nas cidades
    const bu = lugarNpc([[1, -2], [-1, -2], [0, -2], [2, -1], [-2, -2], [3, -2], [0, 2]]);
    obj[bu.y][bu.x] = ['npc', 0]; npcs.push({ nome: 'Burrinho de Carga', ...bu, cidade: c.id });
    ocupar(bu.x + 1, bu.y, ['caixote', 0]);
    // o Mercador (mercado dos jogadores) com a barraca dele
    const me = lugarNpc([[-2, -2], [-1, -2], [-3, -2], [0, -3], [-2, 3], [2, 3], [3, -2]]);
    obj[me.y][me.x] = ['npc', 0]; npcs.push({ nome: 'Mercador', ...me, cidade: c.id });
    ocupar(me.x - 1, me.y - 1, ['barraca', 0]);
    // casas em volta da praça (3 tiles de largura), fora das ruas
    const casas = [];
    for (let k = 0; k < 30; k++) {
      const volta = k < 18 ? 0 : 1, ang = ((volta ? k - 18 : k) / (volta ? 12 : 18)) * Math.PI * 2 + c.estilo + volta * 0.3, rr = volta ? c.r - 9.5 : c.r - 4.2;
      const x = Math.round(c.x + Math.cos(ang) * rr), y = Math.round(c.y + Math.sin(ang) * rr / 1.1);
      let cabe = !casas.some((h) => Math.abs(h.x - x) < 4 && Math.abs(h.y - y) < 3);
      for (let dy = -1; dy <= 1 && cabe; dy++) for (let dx = -1; dx <= 1 && cabe; dx++) {
        const tx = x + dx, ty = y + dy;
        if (estrada[ty]?.[tx] || obj[ty]?.[tx] || !cidadeEm(tx + 0.5, ty + 0.5)) cabe = false;
      }
      if (cabe) { obj[y][x] = ['casa', c.estilo]; casas.push({ x, y }); }
    }
  }

  // aldeias: casas dos dois lados da estrada, um lampião e barris
  for (const [ax, ay, estilo] of ALDEIAS) {
    const livreAqui = (x, y) => x > 1 && y > 1 && x < L - 2 && y < A - 2 && !obj[y][x] && !estrada[y][x] && chao[y][x] !== 'agua' && !cidadeEm(x + 0.5, y + 0.5);
    let feitas = 0;
    for (const [dx, dy] of [[-5, -3], [4, -3], [-5, 4], [4, 4], [0, -6], [0, 7]]) {
      if (feitas >= 3) break;
      const x = ax + dx, y = ay + dy;
      let cabe = true;
      for (let yy = y - 2; yy <= y + 1 && cabe; yy++) for (let xx = x - 2; xx <= x + 2 && cabe; xx++) if (!livreAqui(xx, yy)) cabe = false;
      if (!cabe) continue;
      obj[y][x] = ['casa', estilo]; feitas++;
      if (livreAqui(x + 2, y + 1)) obj[y + 1][x + 2] = ['barril', 0];
    }
    if (feitas && livreAqui(ax + 2, ay + 2)) obj[ay + 2][ax + 2] = ['lampiao', 0];
  }

  // fortalezas: uma por zona, num lugar livre (sem água, cidade nem estrada), a uns 10 tiles de uma estrada
  const distEstrada = new Int16Array(L * A).fill(999), fila = [];
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) if (estrada[y][x]) { distEstrada[y * L + x] = 0; fila.push(y * L + x); }
  for (let i = 0; i < fila.length; i++) {
    const k = fila[i], x = k % L, y = (k / L) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= L || b >= A || distEstrada[b * L + a] !== 999) continue; distEstrada[b * L + a] = distEstrada[k] + 1; fila.push(b * L + a); }
  }
  const reservado = new Uint8Array(L * A), fortalezas = [], d0 = CIDADES[0];
  const PEGADA_FORT = [];     // só o planalto, a margem e a frente da escada (na mesma ordem de antes)
  for (let dy = -FRY - 3; dy <= FRY + 3; dy++) for (let dx = -FRX - 3; dx <= FRX + 3; dx++) if (!(Math.hypot(dx / (FRX + 2), dy / (FRY + 2)) > 1 && !(dy > 0 && Math.abs(dx) <= 2))) PEGADA_FORT.push([dx, dy]);
  for (const [zi, z] of ZONAS.entries()) {
    let melhor = null;
    const meio = zi < LIMITES.length ? ((LIMITES[zi - 1] ?? 0) + LIMITES[zi]) / 2 : LIMITES[LIMITES.length - 1] + 12 * ESC;
    for (let y = FRY + 5; y < A - FRY - 5; y += 2) for (let x = FRX + 5; x < L - FRX - 5; x += 2) {
      if (zonaEm(x, y) !== z) continue;      // o centro também é testado embaixo: pular antes dá o mesmo resultado, bem mais rápido (p606)
      if (fortalezas.some((f) => Math.hypot(f.x - x, f.y - y) < 20 * ESC)) continue;
      let ok = true;
      for (const [dx, dy] of PEGADA_FORT) {
        const tx = x + dx, ty = y + dy;
        if (zonaEm(tx, ty) !== z || cidadeEm(tx + 0.5, ty + 0.5) || chao[ty][tx] === 'agua' || estrada[ty][tx] || obj[ty][tx]) { ok = false; break; }
      }
      if (!ok) continue;
      const nota = -Math.abs(distEstrada[(y + FRY + 2) * L + x] - 8) - Math.abs(Math.hypot(x - d0.x, (y - d0.y) * 1.15) - meio) * 0.002;       // a escada perto (mas não em cima) de uma estrada
      if (!melhor || nota > melhor.nota) melhor = { x, y, nota };
    }
    if (!melhor) continue;
    const { x: cx, y: cy } = melhor, id = fortalezas.length;
    for (let dy = -FRY - 1; dy <= FRY + 2; dy++) for (let dx = -FRX - 1; dx <= FRX + 1; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.hypot(dx / FRX, dy / FRY), escada = dy > 0 && Math.abs(dx) <= 1;
      if (d >= 1.25 && !(escada && dy <= FRY + 2)) continue;
      reservado[y * L + x] = 1; obj[y][x] = null;
      if (escada && d >= 0.8) chao[y][x] = 'escada';                                  // a escada sobe pela frente
      else if (d >= 0.8 && d < 1.0) obj[y][x] = ['penhasco', dy >= FRY * 0.45 ? 0 : 1];  // 0: paredão da frente, 1: lados e fundo
      else if (d < 0.8) chao[y][x] = 'planalto';
    }
    obj[cy - FRY + 2][cx] = ['bau', id];
    fortalezas.push({ id, x: cx, y: cy, zona: z, guardiao: GUARDIOES[z], bau: { x: cx, y: cy - FRY + 2 } });
  }

  // natureza de cada zona
  for (let y = 1; y < A - 1; y++) for (let x = 1; x < L - 1; x++) {
    if (obj[y][x] || estrada[y][x] || cidadeEm(x + 0.5, y + 0.5) || reservado[y * L + x]) continue;
    // nada a menos de 2 tiles de uma estrada ou da muralha (para dar para andar)
    let pertoEstrada = false;
    for (let dy = -1; dy <= 1 && !pertoEstrada; dy++) for (let dx = -1; dx <= 1; dx++) if (estrada[y + dy]?.[x + dx]) { pertoEstrada = true; break; }
    const t = chao[y][x];
    if (t === 'agua') continue;
    const z = TERRENO[zonaEm(x, y)];
    const lista = t === 'areia' && z.naAreia ? z.naAreia : z.objetos;
    for (const [tipo, chance] of lista) {
      if (pertoEstrada && !RASTEIROS.has(tipo)) continue;
      if (r() < chance) { obj[y][x] = [tipo, (r() * 4) | 0]; break; }
    }
  }
  // a borda do mundo é mata fechada
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++)
    if (x < 1 || y < 1 || x >= L - 1 || y >= A - 1) obj[y][x] = [zonaEm(x, y) === 'barao' ? 'rochaV' : 'arvoreE', (x + y) % 4];

  const bloq = chao.map((l, y) => l.map((t, x) => t === 'agua' || !!(obj[y][x] && !RASTEIROS.has(obj[y][x][0]))));
  for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) {
    const o = obj[y][x], p = o && PEGADA[o[0]];
    if (p) for (let dy = -p[2]; dy <= 0; dy++) for (let dx = -p[0]; dx <= p[1]; dx++) bloq[y + dy][x + dx] = true;
  }
  for (const n of npcs) { obj[n.y][n.x] = null; bloq[n.y][n.x] = true; }

  // pontos de nascimento: espalhados pelas zonas, a pelo menos 6 tiles um do outro e longe das cidades
  const pontos = [], ordem = [];
  for (let y = 2; y < A - 2; y++) for (let x = 2; x < L - 2; x++) ordem.push([x, y]);
  for (let i = ordem.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
  // em cada fortaleza: o guardião no meio e três monstros da zona
  for (const f of fortalezas) {
    pontos.push({ x: f.x + 0.5, y: f.y + 0.8, zona: f.zona, guardiao: f.guardiao, fortaleza: f.id });
    for (const [dx, dy] of [[-4, -1], [4, -1], [0, 2]]) pontos.push({ x: f.x + dx + 0.5, y: f.y + dy + 0.8, zona: f.zona, fortaleza: f.id });
  }
  const G = 6, gw = Math.ceil(L / G), perto = new Map();
  const marcarPonto = (p) => { const k = Math.floor(p.y / G) * gw + Math.floor(p.x / G); (perto.get(k) || perto.set(k, []).get(k)).push(p); };
  for (const p of pontos) marcarPonto(p);
  const ocupado = (x, y) => {
    const gx = Math.floor(x / G), gy = Math.floor(y / G);
    for (let b = gy - 1; b <= gy + 1; b++) for (let a = gx - 1; a <= gx + 1; a++) for (const p of perto.get(b * gw + a) || []) if (Math.hypot(p.x - x, p.y - y) < 6) return true;
    return false;
  };
  for (const [x, y] of ordem) {
    if (bloq[y][x] || estrada[y][x] || reservado[y * L + x]) continue;
    if (CIDADES.some((c) => Math.hypot(x - c.x, (y - c.y) * 1.1) < c.r + 4)) continue;
    let livres = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!bloq[y + dy][x + dx]) livres++;
    if (livres < 7) continue;
    if (ocupado(x, y)) continue;
    const p = { x: x + 0.5, y: y + 0.8, zona: zonaEm(x, y) };
    pontos.push(p); marcarPonto(p);
  }

  const livre = (x, y) => x >= 0 && y >= 0 && x < L && y < A && !bloq[y][x];
  logica = { larg: L, alt: A, chao, obj, bloq, estrada, npcs, pontos, livre, fortalezas };
  return logica;
}

// onde o jogador aparece em cada cidade (na praça, um pouco abaixo do centro)
export const chegadaCidade = (id) => { const c = CIDADE[id] || CIDADES[0]; return { x: c.x + 0.5, y: c.y + 2.8 }; };
// a cidade "de casa" para o nível do jogador
export const cidadeDoNivel = (nivel) => [...CIDADES].reverse().find((c) => nivel >= c.faixa[0]) || CIDADES[0];
