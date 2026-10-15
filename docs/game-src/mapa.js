// Mapa de Summoner's Rift em pixel art, usado para escolher onde caçar.
// Base azul embaixo à esquerda, base vermelha em cima à direita, como no minimapa do LoL.
// As clareiras ficam exatamente onde estão os lugares de caça (LOCAIS[].pos), para os marcadores caírem nelas.
import { rng } from './pixel.js';
import { LOCAIS } from './motor.js';

export const TAM = 280;

const dSeg = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
};
const dLinha = (px, py, pts) => { let m = Infinity; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, dSeg(px, py, ...pts[i], ...pts[i + 1])); return m; };
const P = (v) => v * TAM;

// ---------- a geografia (em pixels do mapa) ----------
const M0 = P(0.075);
const ROTAS = [
  [[M0, P(0.8)], [M0, M0 + 14], [M0 + 14, M0], [P(0.8), M0]],                              // superior
  [[P(0.2), TAM - M0], [TAM - M0 - 14, TAM - M0], [TAM - M0, TAM - M0 - 14], [TAM - M0, P(0.2)]],  // inferior
  [[P(0.17), P(0.83)], [P(0.83), P(0.17)]],                                                // meio
];
const RIO = [[P(0.03), P(0.05)], [P(0.14), P(0.15)], [P(0.27), P(0.31)], [P(0.4), P(0.41)], [P(0.5), P(0.5)],
  [P(0.6), P(0.6)], [P(0.72), P(0.7)], [P(0.86), P(0.84)], [P(0.97), P(0.95)]];
const BASES = [{ x: P(0.09), y: P(0.91), r: P(0.17), time: 'azul' }, { x: P(0.91), y: P(0.09), r: P(0.17), time: 'vermelho' }];
const FOSSOS = [{ x: P(0.33), y: P(0.29), r: 13, tipo: 'barao' }, { x: P(0.67), y: P(0.7), r: 13, tipo: 'dragao' }];
const CORES = {
  azul: { escuro: '#1c3458', piso: '#27477a', piso2: '#2c5088', borda: '#8aa6c8', cristal: '#6ad8ff', claro: '#d8f6ff' },
  vermelho: { escuro: '#561c1c', piso: '#7a2a2a', piso2: '#883030', borda: '#c8a0a0', cristal: '#ff6a5a', claro: '#ffe0d8' },
};

function disco(g, cx, cy, r, cor, achatado = 1) {
  g.fillStyle = cor;
  for (let y = Math.floor(cy - r * achatado); y <= cy + r * achatado; y++) {
    const m = Math.sqrt(Math.max(0, r * r - ((y - cy) / achatado) ** 2));
    g.fillRect(Math.round(cx - m), y, Math.round(2 * m) || 1, 1);
  }
}
// pinta cada pixel onde a função devolve uma cor
function pintar(g, f, x0 = 0, y0 = 0, x1 = TAM, y1 = TAM) {
  for (let y = Math.max(0, y0 | 0); y < Math.min(TAM, y1); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(TAM, x1); x++) {
    const c = f(x, y); if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  }
}
// ruído suave para manchas no chão
function ruido(r, escala) {
  const n = Math.ceil(TAM / escala) + 2, grade = Array.from({ length: n * n }, r);
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / escala, gy = y / escala, x0 = gx | 0, y0 = gy | 0, fx = s(gx - x0), fy = s(gy - y0), v = (i, j) => grade[j * n + i];
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx, b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
}

export function desenharMapaLoL(canvas) {
  canvas.width = canvas.height = TAM;
  const g = canvas.getContext('2d'), r = rng(2009);
  const clareiras = LOCAIS.filter((l) => !l.base && !l.arena && l.id !== 'rio').map((l) => ({ x: P(l.pos[0]), y: P(l.pos[1]), r: l.arena ? 15 : 11, arena: !!l.arena }));
  const n1 = ruido(r, 22), n2 = ruido(r, 7);
  const LARG = 6.5;              // meia largura das rotas

  // ---------- chão da selva ----------
  pintar(g, (x, y) => {
    const v = n1(x, y) * 0.7 + n2(x, y) * 0.3, q = r();
    if (q < 0.05) return '#162e18';
    if (q > 0.97) return '#2e5a2a';
    return v > 0.62 ? '#28502a' : v > 0.42 ? '#224522' : '#1c3a1e';
  });

  // ---------- clareiras dos acampamentos ----------
  for (const c of clareiras) {
    if (c.arena) {          // Runeterra: arena de terra batida cercada de pedras
      disco(g, c.x, c.y, c.r + 2, '#3a3a40'); disco(g, c.x, c.y, c.r, '#7a6440'); disco(g, c.x, c.y, c.r - 4, '#8a7248');
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.fillStyle = k % 2 ? '#8a8a94' : '#6a6a74'; g.fillRect(Math.round(c.x + Math.cos(a) * (c.r + 1)) - 1, Math.round(c.y + Math.sin(a) * (c.r + 1)) - 1, 3, 3); }
      for (let k = 0; k < 25; k++) { g.fillStyle = r() < 0.5 ? '#6a5434' : '#a08858'; g.fillRect(Math.round(c.x + (r() - 0.5) * c.r * 1.4), Math.round(c.y + (r() - 0.5) * c.r * 1.4), 1, 1); }
      continue;
    }
    disco(g, c.x, c.y, c.r + 1, '#2e5a2a'); disco(g, c.x, c.y, c.r, '#3a6a30'); disco(g, c.x, c.y + 1, c.r - 4, '#5a5434');
    for (let k = 0; k < 14; k++) { g.fillStyle = r() < 0.5 ? '#6a6a5a' : '#4a6a34'; g.fillRect(Math.round(c.x + (r() - 0.5) * c.r * 1.6), Math.round(c.y + (r() - 0.5) * c.r * 1.6), 1, 1); }
  }

  // ---------- paredões de pedra em volta dos acampamentos, abertos para a rota mais perto ----------
  for (const c of clareiras) {
    let melhor = Infinity, ang = 0;
    for (const rt of ROTAS) for (let i = 0; i < rt.length - 1; i++) for (let t = 0; t <= 1; t += 0.05) {
      const px = rt[i][0] + (rt[i + 1][0] - rt[i][0]) * t, py = rt[i][1] + (rt[i + 1][1] - rt[i][1]) * t, d = Math.hypot(px - c.x, py - c.y);
      if (d < melhor) { melhor = d; ang = Math.atan2(py - c.y, px - c.x); }
    }
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2, dif = Math.abs(((a - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (dif < 0.75) continue;
      const rr = c.r + 3 + (r() < 0.4 ? 1 : 0), x = Math.round(c.x + Math.cos(a) * rr), y = Math.round(c.y + Math.sin(a) * rr);
      g.fillStyle = '#1a1a18'; g.fillRect(x - 1, y, 4, 3);
      g.fillStyle = r() < 0.5 ? '#5e5e54' : '#6e6c5e'; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = '#9a9684'; g.fillRect(x - 1, y - 1, 1, 1);
    }
  }

  // ---------- rio, com margem de areia, água em dois tons e marolas ----------
  const largRio = (x, y) => 9 + 3 * Math.sin((x + y) / 23) + (Math.abs(x - TAM / 2) + Math.abs(y - TAM / 2) < 30 ? 3 : 0);
  pintar(g, (x, y) => {
    const d = dLinha(x, y, RIO), w = largRio(x, y);
    if (d > w + 3) return null;
    if (d > w) return r() < 0.3 ? '#6a6440' : '#7a7048';
    if (d > w - 1.5) return '#2a5a8a';
    const fundo = d < w * 0.45;
    if (r() < 0.04) return '#6aa8e0';
    return fundo ? '#1e4a80' : '#2a62a0';
  });
  for (let k = 0; k < 160; k++) {       // marolas: traços claros na direção do rio
    const i = Math.floor(r() * (RIO.length - 1)), t = r(), [ax, ay] = RIO[i], [bx, by] = RIO[i + 1];
    const x = ax + (bx - ax) * t + (r() - 0.5) * 12, y = ay + (by - ay) * t + (r() - 0.5) * 12;
    if (dLinha(x, y, RIO) > largRio(x, y) - 2) continue;
    g.fillStyle = r() < 0.2 ? '#cfe8ff' : '#4a8ac8'; g.fillRect(Math.round(x), Math.round(y), 2, 1); g.fillRect(Math.round(x) + 1, Math.round(y) + 1, 2, 1);
  }

  for (let k = 0; k < 90; k++) {
    const i = Math.floor(r() * (RIO.length - 1)), t = r(), [ax, ay] = RIO[i], [bx, by] = RIO[i + 1];
    const x = ax + (bx - ax) * t + (r() - 0.5) * 30, y = ay + (by - ay) * t + (r() - 0.5) * 30, d = dLinha(x, y, RIO), w = largRio(x, y);
    const X = Math.round(x), Y = Math.round(y);
    if (d > w && d < w + 3 && r() < 0.7) {               // pedras na margem
      g.fillStyle = '#2a2a26'; g.fillRect(X, Y + 1, 3, 2); g.fillStyle = '#8a8676'; g.fillRect(X, Y, 3, 2); g.fillStyle = '#b8b4a0'; g.fillRect(X, Y, 1, 1);
    } else if (d < w - 2 && d > w * 0.45 && r() < 0.5) { // vitórias-régias
      g.fillStyle = '#1e5a2a'; g.fillRect(X - 1, Y, 4, 2); g.fillStyle = '#4aa04a'; g.fillRect(X - 1, Y - 1, 3, 2); g.fillStyle = '#ff9ad0'; g.fillRect(X, Y - 1, 1, 1);
    } else if (d > w - 1.8 && d <= w) { g.fillStyle = '#cfe8ff'; g.fillRect(X, Y, 2, 1); }   // espuma na beira
  }

  // ---------- rotas: terra batida com beira escura e pedrinhas ----------
  pintar(g, (x, y) => {
    let d = Infinity; for (const rt of ROTAS) d = Math.min(d, dLinha(x, y, rt));
    if (d > LARG + 1.5) return null;
    if (d > LARG) return '#3e3220';
    const q = r();
    // perto das bases a rota é calçada: lajotas de pedra com junta escura
    const perto = Math.min(...BASES.map((b) => Math.hypot(x - b.x, y - b.y) - b.r));
    if (perto < 26) {
      if ((x % 5 === 0) || ((y + (Math.floor(x / 5) % 2) * 2) % 4 === 0)) return '#3a3630';
      return q < 0.5 ? '#7a766a' : '#8a8676';
    }
    if (q < 0.04) return '#5e4a2e';
    if (q > 0.96) return '#b8a070';
    return d < 2.5 ? '#9a8054' : '#8a7048';
  });

  // ---------- fossos do Barão e do Dragão ----------
  for (const f of FOSSOS) {
    disco(g, f.x, f.y, f.r + 3, '#2a2a30'); disco(g, f.x, f.y, f.r + 1, '#55525a');
    const [c1, c2, c3] = f.tipo === 'barao' ? ['#2c1f44', '#3d2a60', '#6a48a0'] : ['#4a2c18', '#6a3e20', '#c86a2a'];
    disco(g, f.x, f.y, f.r, c1); disco(g, f.x, f.y + 1, f.r - 3, c2);
    for (let k = 0; k < 18; k++) { g.fillStyle = r() < 0.5 ? c3 : (f.tipo === 'barao' ? '#a080e0' : '#ffb040'); g.fillRect(Math.round(f.x + (r() - 0.5) * f.r * 1.5), Math.round(f.y + (r() - 0.5) * f.r * 1.5), 1, 1); }
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.fillStyle = '#7a7680'; g.fillRect(Math.round(f.x + Math.cos(a) * (f.r + 2)), Math.round(f.y + Math.sin(a) * (f.r + 2)), 2, 2); }
  }

  // ---------- bases: piso em ladrilhos, Nexus, inibidores e plataforma da Fonte ----------
  for (const b of BASES) {
    const c = CORES[b.time], az = b.time === 'azul';
    pintar(g, (x, y) => {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d > b.r + 2) return null;
      if (d > b.r) return c.escuro;
      if (d > b.r - 2) return c.borda;
      return ((x >> 2) + (y >> 2)) % 2 ? c.piso : c.piso2;
    }, b.x - b.r - 3, b.y - b.r - 3, b.x + b.r + 3, b.y + b.r + 3);
    // muralha com ameias; as rotas passam pelos portões
    const naRota = (x, y) => ROTAS.some((rt) => dLinha(x, y, rt) < LARG + 1);
    pintar(g, (x, y) => {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < b.r - 5 || d > b.r - 1 || naRota(x, y)) return null;
      const ang = Math.atan2(y - b.y, x - b.x), ameia = Math.floor((ang + Math.PI) * b.r / 3) % 2 === 0;
      if (d > b.r - 2) return ameia ? c.claro : c.borda;
      return d > b.r - 3.5 ? (az ? '#5a6a88' : '#886060') : '#14141a';
    }, b.x - b.r - 3, b.y - b.r - 3, b.x + b.r + 3, b.y + b.r + 3);
    // a Fonte, no canto
    const fx = az ? P(0.035) : TAM - P(0.035), fy = az ? TAM - P(0.035) : P(0.035);
    disco(g, fx, fy, 9, c.borda); disco(g, fx, fy, 7, c.escuro); disco(g, fx, fy, 4, c.cristal); g.fillStyle = '#fff'; g.fillRect(Math.round(fx) - 1, Math.round(fy) - 2, 1, 2);
    // inibidores na saída de cada rota
    const sx = az ? 1 : -1, sy = az ? -1 : 1;
    for (const [ox, oy] of [[0, sy * 0.13], [sx * 0.093, sy * 0.093], [sx * 0.13, 0]]) {
      const x = Math.round(b.x + P(ox)), y = Math.round(b.y + P(oy));
      g.fillStyle = '#1a1a20'; g.fillRect(x - 3, y - 3, 7, 7); g.fillStyle = c.borda; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = c.cristal; g.fillRect(x - 1, y - 1, 3, 3);
    }
    // o Nexus: cristal grande com brilho
    const nx = Math.round(b.x + sx * 10), ny = Math.round(b.y + sy * 10);
    disco(g, nx, ny + 2, 7, '#1a1a20');
    g.fillStyle = '#1a1a20'; g.beginPath(); g.moveTo(nx, ny - 10); g.lineTo(nx + 6, ny); g.lineTo(nx, ny + 5); g.lineTo(nx - 6, ny); g.closePath(); g.fill();
    g.fillStyle = c.cristal; g.beginPath(); g.moveTo(nx, ny - 8); g.lineTo(nx + 4, ny); g.lineTo(nx, ny + 3); g.lineTo(nx - 4, ny); g.closePath(); g.fill();
    g.fillStyle = c.claro; g.fillRect(nx - 1, ny - 6, 1, 4); g.fillRect(nx, ny - 7, 1, 2);
  }

  // ---------- torres ao longo das rotas ----------
  const torre = (x, y, time) => {
    x = Math.round(x); y = Math.round(y); const c = CORES[time];
    g.fillStyle = '#101014'; g.fillRect(x - 2, y - 5, 5, 8);
    g.fillStyle = '#8a8a94'; g.fillRect(x - 1, y - 2, 3, 4);
    g.fillStyle = c.cristal; g.fillRect(x - 1, y - 4, 3, 2); g.fillStyle = c.claro; g.fillRect(x, y - 4, 1, 1);
  };
  const aoLongo = (pts, t) => {         // ponto na fração t de uma linha quebrada
    const seg = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
    let d = t * total;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= seg[i]; }
    return pts[pts.length - 1];
  };
  for (const rt of ROTAS) {
    for (const t of [0.08, 0.24, 0.4]) torre(...aoLongo(rt, t), rt === ROTAS[1] ? 'azul' : rt === ROTAS[0] ? 'azul' : 'azul');
    for (const t of [0.6, 0.76, 0.92]) torre(...aoLongo(rt, t), 'vermelho');
  }

  // ---------- mata fechada: árvores em toda a selva que sobrou ----------
  const ocupado = (x, y) => {
    for (const rt of ROTAS) if (dLinha(x, y, rt) < LARG + 5) return true;
    if (dLinha(x, y, RIO) < largRio(x, y) + 6) return true;
    for (const b of BASES) if (Math.hypot(x - b.x, y - b.y) < b.r + 5) return true;
    for (const f of FOSSOS) if (Math.hypot(x - f.x, y - f.y) < f.r + 7) return true;
    for (const c of clareiras) if (Math.hypot(x - c.x, y - c.y) < c.r + 5) return true;
    return x < 3 || y < 3 || x > TAM - 3 || y > TAM - 3;
  };
  const arvores = [];
  for (let y = 4; y < TAM; y += 6) for (let x = 4; x < TAM; x += 6) {
    const ax = x + (r() - 0.5) * 5, ay = y + (r() - 0.5) * 5;
    if (!ocupado(ax, ay) && r() < 0.86) arvores.push({ x: Math.round(ax), y: Math.round(ay), raio: 3 + (r() < 0.35 ? 1 : 0), tom: r() });
  }
  arvores.sort((a, b) => a.y - b.y);
  for (const a of arvores) {
    disco(g, a.x + 1, a.y + 2, a.raio, '#0c1e0e');
    disco(g, a.x, a.y, a.raio, a.tom < 0.5 ? '#1f4a24' : '#24542a');
    disco(g, a.x - 1, a.y - 1, a.raio - 1.5, a.tom < 0.5 ? '#2c6230' : '#326c34');
    g.fillStyle = '#4a8a44'; g.fillRect(a.x - 2, a.y - 2, 1, 1);
  }
  // moitas (arbustos altos) nas beiras das rotas e do rio
  for (let k = 0; k < 70; k++) {
    const rt = ROTAS[Math.floor(r() * ROTAS.length)], [x, y] = aoLongo(rt, 0.15 + r() * 0.7), lado = r() < 0.5 ? -1 : 1;
    const bx = Math.round(x + lado * (LARG + 4) * (rt === ROTAS[2] ? 0.7 : 1)), by = Math.round(y + lado * (LARG + 4) * (rt === ROTAS[2] ? 0.7 : 0));
    if (r() < 0.6) continue;
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? '#4a7a2a' : '#6a9a3a'; g.fillRect(bx + (i % 3) * 2 - 2, by - (i % 2) * 2, 1, 3); }
  }

  // moldura: borda escura e um leve escurecer nos cantos
  const v = g.createRadialGradient(TAM / 2, TAM / 2, TAM * 0.35, TAM / 2, TAM / 2, TAM * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = v; g.fillRect(0, 0, TAM, TAM);
  g.strokeStyle = '#0a120b'; g.lineWidth = 2; g.strokeRect(1, 1, TAM - 2, TAM - 2);
  return canvas;
}

// ---------- animação por cima do mapa (canvas transparente do mesmo tamanho) ----------
// água correndo no rio, tropas azuis e vermelhas marchando nas rotas, Nexus e Fontes pulsando, os covis do Barão
// e do Dragão brilhando, sombras de nuvens passando e vaga-lumes na mata. tempo em segundos.
const aoLongoM = (pts, t) => {
  let total = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const k = d / seg[i], dx = (pts[i + 1][0] - pts[i][0]) / seg[i], dy = (pts[i + 1][1] - pts[i][1]) / seg[i]; return [pts[i][0] + dx * seg[i] * k, pts[i][1] + dy * seg[i] * k, dx, dy]; }
    d -= seg[i];
  }
  const n = pts.length - 1; return [pts[n][0], pts[n][1], 1, 0];
};
let vagaLumes = null;
// os lugares (posição 0–1, cor da situação, se é o ideal) e a trilha de onde o jogador está até o lugar olhado
let marcas = [], foco = null;
export const marcasMapa = (lista) => { marcas = lista || []; };
export const focoMapa = (f) => { foco = f; };
export function animarMapaLoL(cv, tempo) {
  // desenhada na resolução da tela (k pontos por ponto do mapa), para o movimento não andar aos saltos no mapa grande
  const k = Math.min(4, Math.max(1, Math.ceil(((cv.clientWidth || TAM) * (globalThis.devicePixelRatio || 1)) / TAM)));
  if (cv.width !== TAM * k) cv.width = cv.height = TAM * k;
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(k, 0, 0, k, 0, 0);
  // sombras de nuvens atravessando o mapa
  for (let k = 0; k < 3; k++) {
    const x = ((tempo * 5 + k * 140) % (TAM + 160)) - 80, y = 50 + k * 85 + Math.sin(tempo * 0.15 + k) * 12;
    const gr = g.createRadialGradient(x, y, 4, x, y, 60);
    gr.addColorStop(0, 'rgba(0,10,20,0.16)'); gr.addColorStop(1, 'rgba(0,10,20,0)');
    g.save(); g.translate(x, y); g.scale(1, 0.5); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - 60, y - 60, 120, 120); g.restore();
  }
  // a água do rio correndo: traços claros descendo o rio
  for (let k = 0; k < 34; k++) {
    const [x, y, dx, dy] = aoLongoM(RIO, (k / 34 + tempo * 0.02) % 1), lado = ((k * 7) % 5 - 2) * 1.6;
    g.strokeStyle = `rgba(225,245,255,${0.35 + 0.3 * Math.sin(tempo * 3 + k)})`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - dy * lado, y + dx * lado); g.lineTo(x - dy * lado + dx * 4, y + dx * lado + dy * 4); g.stroke();
  }
  // tropas: três ondas por rota, as azuis saindo da base azul e as vermelhas da vermelha, até o meio
  for (const rt of ROTAS) for (let onda = 0; onda < 3; onda++) {
    const fase = ((tempo * 0.025 + onda / 3) % 1) * 0.47;
    for (let k = 0; k < 3; k++) for (const azul of [true, false]) {
      const t = azul ? fase + k * 0.014 : 1 - fase - k * 0.014, [x, y] = aoLongoM(rt, t), some = Math.min(1, (0.47 - fase) * 12);
      g.globalAlpha = some; g.fillStyle = '#0a0a10'; g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = azul ? '#5ab0ff' : '#ff5a4a'; g.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  g.globalAlpha = 1;
  // Nexus e Fontes pulsando
  for (const b of BASES) {
    const c = CORES[b.time], az = b.time === 'azul', sx = az ? 1 : -1, sy = az ? -1 : 1, pul = 0.5 + 0.5 * Math.sin(tempo * 2.4 + (az ? 0 : 1.5));
    const brilho = (x, y, r, cor, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, cor.replace(')', `,${a})`).replace('rgb', 'rgba')); gr.addColorStop(1, cor.replace(')', ',0)').replace('rgb', 'rgba')); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const rgb = az ? 'rgb(106,216,255)' : 'rgb(255,106,90)';
    brilho(Math.round(b.x + sx * 10), Math.round(b.y + sy * 10) - 2, 16 + pul * 5, rgb, 0.25 + pul * 0.25);
    const fx = az ? P(0.035) : TAM - P(0.035), fy = az ? TAM - P(0.035) : P(0.035);
    brilho(fx, fy, 11 + pul * 4, rgb, 0.3 + pul * 0.2);
    // faísca girando em volta do Nexus
    const a = tempo * 2 + (az ? 0 : Math.PI), nx = b.x + sx * 10 + Math.cos(a) * 9, ny = b.y + sy * 10 - 2 + Math.sin(a) * 4;
    g.fillStyle = c.claro; g.fillRect(nx, ny, 1, 1);
  }
  // covis do Barão (roxo) e do Dragão (laranja) brilhando, com faíscas subindo
  for (const f of FOSSOS) {
    const cor = f.tipo === 'barao' ? [176, 90, 255] : [255, 140, 50], pul = 0.5 + 0.5 * Math.sin(tempo * 1.8 + f.x);
    const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r + 8);
    gr.addColorStop(0, `rgba(${cor},${0.18 + pul * 0.2})`); gr.addColorStop(1, `rgba(${cor},0)`);
    g.fillStyle = gr; g.fillRect(f.x - f.r - 8, f.y - f.r - 8, (f.r + 8) * 2, (f.r + 8) * 2);
    for (let k = 0; k < 5; k++) {
      const s = (tempo * 0.6 + k / 5) % 1, x = f.x + Math.sin(k * 2.3 + tempo) * (f.r - 3), y = f.y + 4 - s * 18;
      g.fillStyle = `rgba(${cor},${1 - s})`; g.fillRect(x, y, 1, 1);
    }
  }
  // farol no chão de cada lugar: um anel que se abre; nos ideais, também uma coluna de luz
  for (const [k, m] of marcas.entries()) {
    if (m.base) continue;
    const x = m.x * TAM, y = m.y * TAM + 7, s = (tempo * 0.7 + k * 0.37) % 1;
    g.strokeStyle = m.cor; g.lineWidth = 2; g.globalAlpha = (m.ideal ? 0.95 : 0.6) * (1 - s);
    g.beginPath(); g.ellipse(x, y, 8 + s * 14, (8 + s * 14) * 0.45, 0, 0, Math.PI * 2); g.stroke();
    if (m.ideal) {
      const pul = 0.55 + 0.45 * Math.sin(tempo * 2.5 + k);
      const gr = g.createLinearGradient(0, y - 40, 0, y);
      gr.addColorStop(0, 'rgba(120,255,120,0)'); gr.addColorStop(1, `rgba(120,255,120,${0.35 * pul})`);
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - 4, y - 40, 8, 40);
    }
  }
  g.globalAlpha = 1;
  // trilha tracejada andando de onde o jogador está até o lugar olhado, com um anel na chegada
  if (foco) {
    const [ax, ay] = [foco.de[0] * TAM, foco.de[1] * TAM], [bx, by] = [foco.para[0] * TAM, foco.para[1] * TAM];
    g.setLineDash([4, 3]); g.lineDashOffset = -tempo * 14; g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = '#ffe9a8'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.setLineDash([]);
    const s = (tempo * 1.2) % 1;
    g.strokeStyle = foco.cor; g.lineWidth = 2; g.globalAlpha = 1 - s;
    g.beginPath(); g.arc(bx, by, 6 + s * 12, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
  }
  // vaga-lumes piscando pela mata
  vagaLumes ??= Array.from({ length: 22 }, (_, k) => ({ x: (k * 97 + 31) % TAM, y: (k * 61 + 17) % TAM, f: k * 1.7 }));
  for (const v of vagaLumes) {
    const a = Math.max(0, Math.sin(tempo * 1.5 + v.f)); if (a < 0.2) continue;
    g.fillStyle = `rgba(220,255,140,${a * 0.8})`;
    g.fillRect(v.x + Math.sin(tempo * 0.7 + v.f) * 3, v.y + Math.cos(tempo * 0.5 + v.f) * 2, 1, 1);
  }
}

