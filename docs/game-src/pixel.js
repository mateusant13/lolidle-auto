// Pixel art gerada por código, no estilo dos sprites de OT (32×32, contorno escuro, sombreado duro).
// Nada aqui vem de arquivos .spr/.dat — tudo é desenhado pixel a pixel.

export const T = 32;                 // tamanho do tile
export const DIR = { N: 0, L: 1, S: 2, O: 3 };   // mesma ordem do Tibia: norte, leste, sul, oeste

// estilo de arte novo: ligado para todos. Quem quiser a arte antiga abre o jogo com ?arte=velha (fica guardado
// neste navegador); ?arte=nova volta para a nova. Sem navegador (servidor, testes no Node) vale a antiga.
let novoLigado;
export function estiloNovoLigado() {
  if (novoLigado !== undefined) return novoLigado;
  try {
    if (typeof location !== 'undefined' && /[?&]arte=nova\b/.test(location.search)) localStorage.setItem('lolidle-arte-nova', '1');
    if (typeof location !== 'undefined' && /[?&]arte=velha\b/.test(location.search)) localStorage.setItem('lolidle-arte-nova', '0');
    novoLigado = typeof document !== 'undefined' && localStorage.getItem('lolidle-arte-nova') !== '0';
  } catch { novoLigado = false; }
  return novoLigado;
}

export function tela(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

export function rng(semente) {
  let s = (semente >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// escurece (k < 1) ou clareia (k > 1) uma cor #rrggbb
export function tom(cor, k) {
  const n = parseInt(cor.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
}

// ---------- Pincel: desenha em coordenadas de pixel, com escala opcional (sprites 64×64) ----------
class Pincel {
  constructor(canvas, escala = 1) { this.g = canvas.getContext('2d'); this.s = escala; }
  px(x, y, cor) { const s = this.s, l = Math.max(1, Math.round(s)); this.g.fillStyle = cor; this.g.fillRect(Math.round(x * s), Math.round(y * s), l, l); }
  r(x, y, w, h, cor) {
    const s = this.s; this.g.fillStyle = cor;
    this.g.fillRect(Math.round(x * s), Math.round(y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
  }
  o(cx, cy, rx, ry, cor) {
    const s = this.s; cx *= s; cy *= s; rx *= s; ry *= s;
    this.g.fillStyle = cor;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry; if (Math.abs(dy) > 1) continue;
      const meia = rx * Math.sqrt(1 - dy * dy);
      const x0 = Math.round(cx - meia), x1 = Math.round(cx + meia);
      if (x1 > x0) this.g.fillRect(x0, y, x1 - x0, 1);
    }
  }
  // elipse com sombra embaixo/direita e brilho em cima/esquerda
  bola(cx, cy, rx, ry, cor) {
    this.o(cx, cy, rx, ry, tom(cor, 0.62));
    this.o(cx - rx * 0.12, cy - ry * 0.12, rx * 0.85, ry * 0.85, cor);
    this.o(cx - rx * 0.35, cy - ry * 0.4, rx * 0.35, ry * 0.3, tom(cor, 1.3));
  }
  l(x0, y0, x1, y1, cor, esp = 1) {
    const s = this.s; x0 *= s; y0 *= s; x1 *= s; y1 *= s; esp = Math.max(1, Math.round(esp * s));
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    this.g.fillStyle = cor;
    for (let i = 0; i <= n; i++) this.g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), esp, esp);
  }
  // polígono pelo meio de cada pixel (par-ímpar), pintado em trechos por linha (p611: antes um fillRect por pixel; os mesmos pixels)
  poli(pts, cor) {
    const s = this.s, p = pts.map(([x, y]) => [x * s, y * s]);
    let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;
    for (const [x, y] of p) { if (x < mx) mx = x; if (x > Mx) Mx = x; if (y < my) my = y; if (y > My) My = y; }
    const xa = Math.floor(mx), xb = Math.ceil(Mx), cortes = [];
    this.g.fillStyle = cor;
    for (let y = Math.floor(my); y <= Math.ceil(My); y++) {
      const yc = y + 0.5; cortes.length = 0;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if ((yi > yc) !== (yj > yc)) cortes.push(((xj - xi) * (yc - yi)) / (yj - yi) + xi);
      }
      cortes.sort((a, b) => a - b);
      // o pixel x está dentro quando o meio dele (x + 0,5) fica entre um corte par e o seguinte: a <= x + 0,5 < b
      for (let k = 0; k + 1 < cortes.length; k += 2) {
        const ini = Math.max(xa, Math.ceil(cortes[k] - 0.5)), fim = Math.min(xb, Math.ceil(cortes[k + 1] - 0.5) - 1);
        if (fim >= ini) this.g.fillRect(ini, y, fim - ini + 1, 1);
      }
    }
  }
}

// contorno escuro de 1px em volta de tudo que for opaco — é o que dá a "cara de OT"
export { Pincel };
export function contornar(c, cor = [14, 12, 16]) {
  const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
  const opaco = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 120;
  const marcar = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (!opaco(x, y) && (opaco(x - 1, y) || opaco(x + 1, y) || opaco(x, y - 1) || opaco(x, y + 1))) marcar.push((y * w + x) * 4);
  for (const i of marcar) { d[i] = cor[0]; d[i + 1] = cor[1]; d[i + 2] = cor[2]; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}

// acabamento do estilo novo, depois do contorno: luz de cima à esquerda na borda do corpo, sombra embaixo à direita
// e o contorno tingido pela cor da peça que ele envolve (mais escuro embaixo, onde o boneco pisa)
const CONTORNO = [14, 12, 16];
function acabamento(c) {
  const g = c.getContext('2d'), img = g.getImageData(0, 0, c.width, c.height), d = img.data, w = c.width, h = c.height;
  const o = new Uint8ClampedArray(d);
  const tipo = (x, y) => {           // 0 vazio, 1 contorno, 2 corpo
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const i = (y * w + x) * 4;
    if (o[i + 3] <= 120) return 0;
    return o[i] === CONTORNO[0] && o[i + 1] === CONTORNO[1] && o[i + 2] === CONTORNO[2] ? 1 : 2;
  };
  let topo = h, base = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (o[(y * w + x) * 4 + 3] > 120) { topo = Math.min(topo, y); base = Math.max(base, y); }
  const alto = base - (base - topo) * 0.2;         // o quinto de baixo (pés) fica um pouco mais escuro
  const mistura = (i, cor, k) => { for (let j = 0; j < 3; j++) d[i + j] = Math.round(o[i + j] + (cor[j] - o[i + j]) * k); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = tipo(x, y), i = (y * w + x) * 4;
    if (t === 2) {
      // quão perto (até 3 px) está a borda em cima/à esquerda (luz) e embaixo/à direita (sombra)
      let luz = 0, sombra = 0;
      for (let k = 3; k >= 1; k--) {
        const f = (4 - k) / 3;
        if (tipo(x - k, y - k) !== 2 || tipo(x, y - k) !== 2) luz = Math.max(luz, f);
        if (tipo(x + k, y + k) !== 2 || tipo(x + k, y) !== 2 || tipo(x, y + k) !== 2) sombra = Math.max(sombra, f);
      }
      const v = luz - sombra * 1.1 - (y > alto ? 0.25 : 0);
      if (v > 0.2) mistura(i, [255, 240, 205], v > 0.75 ? 0.3 : 0.15);
      else if (v < -0.2) mistura(i, [24, 16, 46], v < -0.75 ? 0.34 : 0.18);
    } else if (t === 1) {
      // média das cores do corpo encostado, bem escurecida
      let r = 0, gg = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tipo(x + dx, y + dy) === 2) { const k = ((y + dy) * w + x + dx) * 4; r += o[k]; gg += o[k + 1]; b += o[k + 2]; n++; }
      if (!n) continue;
      const embaixo = tipo(x, y - 1) === 2 && tipo(x, y + 1) === 0, f = embaixo ? 0.18 : 0.34;
      d[i] = Math.round(10 + (r / n) * f); d[i + 1] = Math.round(8 + (gg / n) * f); d[i + 2] = Math.round(14 + (b / n) * f);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function espelhar(c) {
  const e = tela(c.width, c.height), g = e.getContext('2d');
  g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return e;
}

// ---------- Criaturas ----------
// frame: 0 parado, 1 e 2 passos, 3 ataque; 20 a 27: as 8 fases de um ciclo de caminhada (dois passos), para quem tem
// caminhada fluida (FLUIDOS); as outras formas recebem 1/0/2 conforme a fase (ver sprite)
// marcha(f): o que cada parte do corpo faz naquela fase. s = perna da frente avançando (+) ou recuando (-);
// c = velocidade dela (a perna que vai para a frente sobe do chão)
export function marcha(f) {
  let s = 0, c = 0;
  if (f >= 20 && f <= 27) { const ph = ((f - 20) / 8) * Math.PI * 2; s = Math.sin(ph); c = Math.cos(ph); }
  else if (f === 1) { s = 0.5; c = 1; } else if (f === 2) { s = -0.5; c = -1; }
  const anda = s !== 0 || c !== 0;
  return {
    anda,
    passo: s * 2,                                                  // de lado: pernas para a frente/trás
    liftF: Math.max(0, c) * 1.5, liftT: Math.max(0, -c) * 1.5,     // de lado: pé que sobe (perna da frente / de trás)
    lA: -Math.max(0, c) * 1.6 + s * 0.4, lB: -Math.max(0, -c) * 1.6 - s * 0.4,   // de frente/costas: cada perna sobe e desce
    braco: -s * 1.5,                                               // de lado: braço balança ao contrário da perna
    bA: s * 1.2, bB: -s * 1.2,                                     // de frente/costas: cada braço sobe e desce
    vento: anda ? 0.8 + 0.7 * Math.abs(c) : 0,                     // capa/cachecol jogados para trás
    balanco: s * 0.8,                                              // capa balançando de um lado para o outro
  };
}
const FLUIDOS = new Set(['darius', 'ezreal', 'lux', 'yasuo', 'katarina', 'taric', 'zac', 'humanoide', 'tropa', 'mago']);
// estilo novo: quem tem ataque em 4 tempos (30 preparação, 31 golpe, 32 impacto, 33 recuperação)
// e respiração parado (40 a 43, a capa/cachecol balança); os outros recebem 3 e 0 no lugar
export const ANIM_NOVA = new Set(['darius', 'ezreal', 'lux', 'yasuo', 'katarina', 'taric', 'zac']);
// poses de habilidade (só no estilo novo), quadros 50 a 60:
//   Darius: 50 machado aberto girando (Q), 54 machado lançado para a frente (E), 56 agachado com o machado atrás e
//   57 no ar com o machado no alto (R, Guilhotina), 59 rugindo de braços abertos (grito, fúria), 60 pisão com o joelho alto
//   Ezreal: 50 tiro com coice (Q), 51 conjurando com as duas mãos (W), 52/53 agachado para o salto (E),
//   54 carregando a Barragem com a mão no pulso (R), 55 manopla erguida (as outras)
function tempos(f) {
  if (f === 44 || f === 45) return { atk: f === 45 ? 1 : 0, m: marcha(0), by: 0, pose: f };
  if (f >= 50 && f <= 69) {
    const m = marcha(0);
    if (f === 57) { m.lA = m.lB = -2; m.liftF = m.liftT = 2.5; m.vento = 1.8; }
    if (f === 60) { m.lA = -4; m.liftF = 4; }
    if (f === 54) { m.passo = 1.5; m.vento = 1.2; }
    return { atk: f === 56 ? 1 : f === 57 ? 2 : 0, m, by: { 56: 1, 57: -3, 52: 2, 53: 1, 60: -1 }[f] || 0, pose: f };
  }
  const atk = f === 3 ? 3 : f >= 30 && f <= 33 ? f - 29 : 0;
  const m = marcha(f >= 40 ? 0 : f);
  if (f >= 40) { const k = f - 40; m.vento = [0.2, 0.6, 1, 0.6][k]; m.balanco = [0, 0.5, 0, -0.5][k]; }
  // estilo novo: a caminhada é mais solta (braços balançam mais, passada maior, capa e cachecol esvoaçando)
  if (f >= 20 && f <= 27 && estiloNovoLigado()) { m.passo *= 1.3; m.braco *= 1.7; m.bA *= 1.7; m.bB *= 1.7; m.vento *= 1.5; m.balanco *= 1.6; m.lA *= 1.2; m.lB *= 1.2; }
  // o corpo sobe um pouco na preparação e agacha no impacto (só nos quadros novos)
  return { atk, m, by: f >= 30 && f <= 33 ? [0, -1, 0, 1, 0][atk] : 0, pose: 0 };
}

function humanoide(p, a, dir, f) {
  const botas = tom(a.calca, 0.5), cinto = tom(a.arm, 0.45), ataque = f === 3;
  const m = marcha(f), passo = m.passo, bx = ataque ? 0 : m.braco;
  const olho = a.olho || '#141414';
  if (dir === DIR.L) {
    armaAtras(p, a, dir, ataque);
    if (a.capa) p.poli([[9, 15], [14, 15], [14, 27], [9 - m.vento, 27]], tom(a.capa, 0.75));
    p.r(13 - passo, 23 - m.liftT, 3, 5, tom(a.calca, 0.75)); p.r(13 - passo, 27 - m.liftT, 3, 2, tom(botas, 0.8));
    p.r(16 + passo, 23 - m.liftF, 3, 5, a.calca); p.r(16 + passo, 27 - m.liftF, 4, 2, botas);
    p.r(13 - bx, 16, 3, 6, tom(a.arm, 0.65));
    if (a.robe) p.bola(15.5, 22, 5, 6, a.robe);
    p.bola(16, 19, 4.6, 5, a.arm); p.r(12, 22, 9, 1, cinto);
    if (a.ombro) p.bola(15, 15.5, 3, 2.2, a.ombro);
    p.bola(17, 10.5, 4, 4.4, a.pele);
    p.px(20, 10, olho);
    if (a.barba) p.r(17, 13, 4, 2, a.barba);
    if (a.elmo) { p.bola(16.5, 8, 4.6, 3.2, a.elmo); p.r(19, 9, 2, 1, tom(a.elmo, 0.5)); }
    else p.bola(15.5, 8, 4, 3, a.cabelo);
    if (a.topete) { p.bola(19, 6.5, 2.6, 1.8, a.cabelo); p.px(21, 7, tom(a.cabelo, 1.2)); }
    if (a.oculos) { p.r(15, 8, 5, 1, tom(a.oculos, 0.5)); p.r(18, 7, 2, 2, a.oculos); }
    if (ataque) { p.r(17, 16, 6, 3, a.arm); p.r(22, 16, 2, 3, a.pele); }
    else { p.r(16 + bx, 16, 3, 6, a.arm); p.r(16 + bx, 22, 3, 2, a.pele); }
    armaFrente(p, a, dir, ataque);
    return;
  }
  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = ataque ? 0 : m.bA, bB = ataque ? 0 : m.bB;
  if (costas) armaFrente(p, a, dir, ataque);
  if (a.capa && !costas) p.poli([[10, 15], [22, 15], [22 + m.balanco, 27], [10 + m.balanco, 27]], tom(a.capa, 0.6));
  p.r(12, 23 + lA, 3, 5, a.calca); p.r(17, 23 + lB, 3, 5, a.calca);
  p.r(12, 27 + lA, 3, 2, botas); p.r(17, 27 + lB, 3, 2, botas);
  const levanta = ataque ? -3 : 0;
  p.r(8, 16 + bA, 3, 7, tom(a.arm, 0.8)); p.r(8, 22 + bA, 3, 2, a.pele);
  p.r(21, 16 + levanta + bB, 3, 7, tom(a.arm, 0.8)); p.r(21, 22 + levanta + bB, 3, 2, a.pele);
  if (a.robe) p.bola(16, 22, 6, 6, a.robe);
  p.bola(16, 19, 5.6, 5, a.arm); p.r(11, 22, 10, 1, cinto);
  if (a.ombro) { p.bola(10, 15.5, 2.8, 2.2, a.ombro); p.bola(22, 15.5, 2.8, 2.2, a.ombro); }
  if (costas && a.capa) { p.bola(16, 20, 5.5, 6.5, a.capa); p.r(12, 15, 8, 1, tom(a.capa, 0.5)); }
  p.bola(16, 10.5, 4.6, 4.5, a.pele);
  if (costas) {
    if (a.elmo) p.bola(16, 10, 5, 4.8, a.elmo); else p.bola(16, 10, 4.8, 4.6, a.cabelo);
    if (a.oculos) p.r(11, 9, 10, 1, tom(a.oculos, 0.5));
  } else {
    p.r(14, 11, 1, 1, olho); p.r(18, 11, 1, 1, olho);
    if (a.barba) p.r(13, 13, 7, 2, a.barba);
    if (a.elmo) { p.bola(16, 8, 5.2, 3, a.elmo); p.r(15, 8, 2, 4, tom(a.elmo, 0.55)); }
    else p.bola(16, 7.5, 4.8, 2.6, a.cabelo);
    if (a.topete) { p.bola(18.5, 6, 3.2, 1.8, a.cabelo); p.px(21, 6, tom(a.cabelo, 1.2)); p.px(13, 9, a.cabelo); }
    if (a.oculos) { p.r(12, 8, 8, 1, tom(a.oculos, 0.5)); p.r(13, 7, 2, 2, a.oculos); p.r(17, 7, 2, 2, a.oculos); }
  }
  if (!costas) armaFrente(p, a, dir, ataque);
}

const CABO = '#6b4a2b', LAMINA_PADRAO = '#c3c9d3';
function armaAtras(p, a, dir, ataque) {
  const LAMINA = a.lamina || LAMINA_PADRAO;
  if (a.arma === 'machado' && dir === DIR.L && !ataque) { p.l(12, 7, 12, 24, CABO, 1); p.bola(10, 9, 2.6, 3.6, LAMINA); }
}
function armaFrente(p, a, dir, ataque) {
  const LAMINA = a.lamina || LAMINA_PADRAO;
  if (a.arma === 'machado') {
    if (dir === DIR.S) {
      if (ataque) { p.l(22, 16, 16, 29, CABO); p.bola(14, 28, 4, 2.6, LAMINA); p.l(10, 29, 18, 29, tom(LAMINA, 0.5)); }
      else { p.l(23, 8, 23, 27, CABO); p.bola(26, 10.5, 3, 4, LAMINA); p.l(29, 7, 29, 14, tom(LAMINA, 0.55)); }
    } else if (dir === DIR.N) {
      if (ataque) { p.l(10, 18, 10, 4, CABO); p.bola(10, 4, 4.2, 2.6, LAMINA); }
      else { p.l(9, 8, 9, 27, CABO); p.bola(6, 10.5, 3, 4, LAMINA); }
    } else if (ataque) { p.l(18, 17, 29, 17, CABO); p.bola(28.5, 20, 2.8, 3.8, LAMINA); p.l(26, 24, 31, 24, tom(LAMINA, 0.55)); }
  } else if (a.arma === 'espada') {
    if (dir === DIR.S) ataque ? p.l(22, 19, 27, 26, LAMINA) : p.l(22, 14, 22, 22, LAMINA);
    else if (dir === DIR.L) ataque ? p.l(23, 17, 30, 17, LAMINA) : p.l(18, 16, 18, 10, LAMINA);
    else p.l(9, 14, 9, 21, LAMINA);
  } else if (a.arma === 'cajado') {
    const orbe = a.orbe || '#7cd4ff';
    if (dir === DIR.S) { p.l(23, 9, 23, 27, CABO); p.bola(23, 8, 2, 2, orbe); }
    else if (dir === DIR.L) { p.l(ataque ? 24 : 19, 8, 19, 26, CABO); p.bola(ataque ? 24 : 19, 7, 2, 2, orbe); }
    else { p.l(9, 9, 9, 27, CABO); p.bola(9, 8, 2, 2, orbe); }
  } else if (a.arma === 'manopla') {
    const ouro = a.manopla || '#d8a838', gema = a.brilho || '#7ad8ff';
    if (dir === DIR.S) {
      const y = ataque ? 17 : 20;
      p.r(20, y, 5, 4, ouro); p.r(20, y + 3, 5, 1, tom(ouro, 0.6)); p.px(22, y + 1, gema);
      if (ataque) { p.bola(22.5, y - 2, 2.4, 2.4, tom(gema, 1.3)); p.px(22, y - 3, '#ffffff'); }
    } else if (dir === DIR.L) {
      if (ataque) { p.r(20, 15, 4, 5, ouro); p.px(22, 17, gema); p.bola(26.5, 17.5, 2.6, 2.6, tom(gema, 1.3)); p.px(27, 17, '#ffffff'); }
      else { p.r(15, 20, 5, 4, ouro); p.r(15, 23, 5, 1, tom(ouro, 0.6)); p.px(17, 21, gema); }
    } else { p.r(7, 20, 5, 4, ouro); p.px(9, 21, tom(gema, 0.8)); }
  } else if (a.arma === 'canhao') {
    if (dir === DIR.S) p.bola(16, 21, 3, 3, '#3a3a44');
    else if (dir === DIR.L) { p.r(19, 18, 9, 4, '#44444f'); p.r(27, 17, 2, 6, '#2a2a31'); }
  }
}

function fera(p, a, dir, f) {
  const pata = tom(a.cor, 0.7), claro = a.barriga || tom(a.cor, 1.35);
  const s1 = f === 1 ? -1 : 0, s2 = f === 2 ? -1 : 0, bote = f === 3 ? 2 : 0;
  if (dir === DIR.L) {
    if (a.juba) { p.bola(6, 16 - (f === 1 ? 1 : 0), 3.2, 2.2, a.cor); p.r(3, 15 - (f === 1 ? 1 : 0), 2, 2, a.juba); }
    else p.l(7, 19, 3, 14 - (f === 1 ? 1 : 0), a.cor, 2);
    p.r(9, 23 + s1, 2, 5, pata); p.r(20, 23 + s2, 2, 5, pata);
    p.bola(15 + bote / 2, 20, 8.5, 4.6, a.cor);
    p.r(11, 23 + s2, 2, 5, a.cor); p.r(22 + bote, 23 + s1, 2, 5, a.cor);
    if (a.juba) p.bola(21 + bote, 17, 3.6, 4.4, a.juba);
    p.bola(24 + bote, 15.5, 4.2, 3.8, a.cor);
    p.r(27 + bote, 16, a.juba ? 4 : 3, 2, claro); p.px(a.juba ? 31 + bote : 30 + bote, 16, '#141414');
    if (a.juba) { p.poli([[21 + bote, 13], [22 + bote, 8], [24 + bote, 12]], tom(a.cor, 0.7)); if (f === 3) p.r(28 + bote, 18, 2, 1, '#f0f0e0'); }
    else p.r(22 + bote, 11, 2, 2, tom(a.cor, 0.7));
    p.px(25 + bote, 14, a.olho || '#f0e050');
    if (a.espinhos) for (let x = 10; x < 21; x += 3) p.r(x, 14, 1, 2, a.espinhos);
    return;
  }
  const frente = dir === DIR.S;
  p.r(11, 23 + s1, 2, 5, pata); p.r(19, 23 + s2, 2, 5, pata);
  p.bola(16, 20, 6.5, 5.5, a.cor);
  if (a.espinhos) for (let x = 11; x < 22; x += 3) p.r(x, 14, 1, 2, a.espinhos);
  p.r(12, 24 + s2, 2, 5, a.cor); p.r(18, 24 + s1, 2, 5, a.cor);
  if (frente) {
    if (a.juba) p.bola(16, 19 + bote, 6, 3.4, a.juba);
    p.bola(16, 15 + bote, 4.8, 4.2, a.cor);
    if (a.juba) { p.poli([[11, 13 + bote], [11, 7 + bote], [14, 11 + bote]], tom(a.cor, 0.7)); p.poli([[21, 13 + bote], [21, 7 + bote], [18, 11 + bote]], tom(a.cor, 0.7)); }
    p.bola(16, 18 + bote, 2.6, 1.6, claro); p.px(16, 17 + bote, '#141414');
    p.px(14, 14 + bote, a.olho || '#f0e050'); p.px(18, 14 + bote, a.olho || '#f0e050');
    p.r(11, 10 + bote, 2, 3, tom(a.cor, 0.7)); p.r(19, 10 + bote, 2, 3, tom(a.cor, 0.7));
  } else {
    p.bola(16, 13, 4.2, 3.6, tom(a.cor, 0.85));
    p.r(12, 9, 2, 3, tom(a.cor, 0.7)); p.r(18, 9, 2, 3, tom(a.cor, 0.7));
    p.l(16, 24, 16, 29 - (f === 1 ? 1 : 0), a.cor, 2);
  }
}

function golem(p, a, dir, f) {
  const braco = f === 1 ? -1 : f === 2 ? 1 : 0, soco = f === 3 ? 3 : 0;
  const pedra = tom(a.cor, 0.8), olho = a.olho || '#ffde59';
  if (dir === DIR.L) {
    p.r(12, 24, 4, 5, pedra); p.r(18, 24 - (f === 1 ? 1 : 0), 4, 5, pedra);
    p.bola(11, 20 + braco, 3, 5, tom(a.cor, 0.7));
    p.bola(16, 18, 7.5, 7.5, a.cor);
    if (a.cristal) { p.poli([[9, 12], [11, 5], [13, 12]], a.cristal); p.poli([[12, 11], [15, 4], [17, 11]], tom(a.cristal, 1.25)); }
    p.bola(21, 11, 3.8, 3.2, pedra); p.r(23, 10, 2, 1, olho);
    p.bola(20 + soco, 21 - braco, 3.4, 5, a.cor);
    manchas(p, a.cor, 11, 14, 10, 8);
    return;
  }
  const frente = dir === DIR.S;
  p.r(10, 24 - (f === 1 ? 1 : 0), 5, 5, pedra); p.r(17, 24 - (f === 2 ? 1 : 0), 5, 5, pedra);
  p.bola(16, 18, 8.5, 7.5, a.cor);
  if (a.cristal && !frente) { p.poli([[10, 16], [12, 6], [14, 16]], a.cristal); p.poli([[15, 14], [18, 3], [20, 14]], tom(a.cristal, 1.25)); }
  manchas(p, a.cor, 10, 13, 12, 9);
  if (a.musgo) { p.r(10, 11, 7, 2, a.musgo); p.r(17, 12, 4, 1, a.musgo); p.r(12, 10, 3, 1, tom(a.musgo, 1.3)); }
  p.bola(6, 20 + braco, 3.4, 5.4, tom(a.cor, 0.85)); p.bola(26, 20 - braco + (frente ? soco : 0), 3.4, 5.4, tom(a.cor, 0.85));
  p.bola(16, 10.5, 4.4, 3.6, pedra);
  if (frente) { p.r(13, 10, 2, 1, olho); p.r(17, 10, 2, 1, olho); p.r(14, 13, 4, 1, tom(a.cor, 0.35)); }
  if (a.cristal && frente) { p.poli([[7, 13], [8, 7], [10, 13]], a.cristal); p.poli([[22, 13], [24, 6], [25, 13]], a.cristal); }
}
function manchas(p, cor, x, y, w, h) {
  const r = rng(x * 31 + y * 17 + w);
  for (let i = 0; i < 6; i++) p.r(x + r() * w, y + r() * h, 2, 1, tom(cor, r() < 0.5 ? 0.7 : 1.25));
}

function verme(p, a, dir, f) {
  const ond = f === 1 ? 1 : f === 2 ? -1 : 0, bote = f === 3 ? 2 : 0;
  const seg = (x, y, r, i) => {
    p.bola(x, y, r, r * 0.85, i % 2 ? a.cor : tom(a.cor, 0.85));
    if (a.espinhos) p.poli([[x - 1, y - r * 0.7], [x, y - r - 2.5], [x + 1, y - r * 0.7]], a.espinhos);
  };
  if (dir === DIR.L) {
    [[5, 25, 2.5], [8, 24 + ond, 3.2], [11.5, 22, 3.8], [15, 20 - ond, 4.2]].forEach(([x, y, r], i) => seg(x, y, r, i));
    p.bola(21 + bote, 16, 5.6, 5, a.cor);
    p.poli([[24 + bote, 15], [30 + bote, 12], [27 + bote, 17]], a.dente || '#eee4c8');
    p.poli([[24 + bote, 18], [30 + bote, 21], [26 + bote, 19]], a.dente || '#eee4c8');
    p.r(21 + bote, 13, 2, 2, a.olho || '#b8ff5a');
    return;
  }
  const frente = dir === DIR.S;
  [[16 - ond, 27, 3], [16 + ond, 24, 4], [16, 20, 5]].forEach(([x, y, r], i) => seg(x, frente ? y : 36 - y, r, i));
  p.bola(16, frente ? 13 : 19, 6.4, 5.6, a.cor);
  if (frente) {
    p.o(16, 16 + bote / 2, 3.2, 2 + bote / 2, '#2a0d1e');
    p.poli([[13, 14], [14, 18 + bote], [15, 14]], a.dente || '#eee4c8');
    p.poli([[17, 14], [18, 18 + bote], [19, 14]], a.dente || '#eee4c8');
    p.r(12, 10, 2, 2, a.olho || '#b8ff5a'); p.r(18, 10, 2, 2, a.olho || '#b8ff5a');
  }
}

function dragao(p, a, dir, f) {
  const asa = f === 1 ? -2 : f === 2 ? 1 : 0, bote = f === 3 ? 2 : 0;
  const membrana = a.asa || tom(a.cor, 0.7), barriga = a.barriga || tom(a.cor, 1.4);
  if (dir === DIR.L) {
    p.poli([[12, 17], [4, 6 + asa], [10, 9 + asa], [15, 4 + asa], [18, 16]], membrana);
    p.l(12, 17, 4, 6 + asa, tom(a.cor, 0.5)); p.l(15, 16, 15, 4 + asa, tom(a.cor, 0.5));
    p.l(9, 22, 2, 26, a.cor, 2); p.poli([[0, 26], [3, 23], [4, 28]], a.cor);
    p.r(10, 24, 3, 5, tom(a.cor, 0.7)); p.r(18, 24, 3, 5, tom(a.cor, 0.7));
    p.bola(15, 21, 7, 5, a.cor); p.o(16, 23, 5, 2, barriga);
    p.bola(21 + bote / 2, 15, 2.6, 4.2, a.cor);
    p.bola(24 + bote, 10.5, 4, 3.2, a.cor); p.r(27 + bote, 11, 3, 2, tom(a.cor, 0.85));
    p.poli([[21 + bote, 8], [19 + bote, 3], [23 + bote, 7]], a.chifre || '#e8dcc0');
    p.px(25 + bote, 9, a.olho || '#ffe23a');
    if (f === 3) { p.bola(31, 12, 1.4, 1.4, '#ffb030'); }
    return;
  }
  const frente = dir === DIR.S;
  if (frente) {
    p.poli([[11, 16], [1, 6 + asa], [4, 17], [11, 21]], membrana); p.poli([[21, 16], [31, 6 + asa], [28, 17], [21, 21]], membrana);
  }
  p.r(10, 24, 4, 5, tom(a.cor, 0.7)); p.r(18, 24, 4, 5, tom(a.cor, 0.7));
  p.bola(16, 20, 6.6, 6, a.cor);
  if (frente) {
    p.o(16, 22, 3.6, 4, barriga);
    p.bola(16, 11 + bote, 4.6, 4, a.cor); p.bola(16, 14 + bote, 2.6, 1.8, tom(a.cor, 0.85));
    p.px(14, 10 + bote, a.olho || '#ffe23a'); p.px(18, 10 + bote, a.olho || '#ffe23a');
    p.poli([[12, 9], [9, 3], [13, 7]], a.chifre || '#e8dcc0'); p.poli([[20, 9], [23, 3], [19, 7]], a.chifre || '#e8dcc0');
  } else {
    p.l(16, 25, 16, 31, a.cor, 2);
    p.poli([[11, 18], [1, 5 + asa], [5, 20]], membrana); p.poli([[21, 18], [31, 5 + asa], [27, 20]], membrana);
    p.bola(16, 11, 4.2, 3.8, tom(a.cor, 0.85));
    p.poli([[12, 9], [9, 3], [13, 7]], a.chifre || '#e8dcc0'); p.poli([[20, 9], [23, 3], [19, 7]], a.chifre || '#e8dcc0');
  }
}

function torre(p, a) {
  p.o(16, 29, 12, 3, 'rgba(0,0,0,0.35)');
  p.r(8, 14, 16, 15, a.cor); p.r(8, 14, 4, 15, tom(a.cor, 1.25)); p.r(20, 14, 4, 15, tom(a.cor, 0.7));
  for (let y = 16; y < 29; y += 4) for (let x = 8 + ((y / 4) % 2) * 3; x < 24; x += 6) p.r(x, y, 1, 3, tom(a.cor, 0.55));
  for (let y = 16; y < 29; y += 4) p.r(8, y, 16, 1, tom(a.cor, 0.6));
  p.r(6, 11, 20, 4, tom(a.cor, 0.85)); for (let x = 6; x < 26; x += 4) p.r(x, 8, 2, 3, tom(a.cor, 0.85));
  p.poli([[12, 9], [16, 0], [20, 9], [16, 12]], a.cristal); p.poli([[14, 8], [16, 2], [17, 8]], tom(a.cristal, 1.5));
  p.r(14, 22, 4, 7, '#1c1a22');
}

// Ornn, o semideus da forja: corpo de carneiro, chifres enrolados, barba trançada, lava nas rachaduras e o martelo
let ornnQuadro = 0;
function ornn(p, a, dir, f) {
  ornnQuadro = f >= 10 ? f - 10 : 0;
  const pelo = '#7a3420', peloC = '#a85a34', peloE = '#4a1e12', chifre = '#d8c49a', chifreE = '#8a7454';
  const barba = '#ece4d4', barbaE = '#a8a090', metal = '#6a6a76', lava = '#ff8a20', lavaC = '#ffd060', casco = '#2a1a14';
  const forja = f >= 10;
  if (forja) { f = 0; dir = DIR.S; }
  const passo = f === 1 ? -0.6 : f === 2 ? 0.6 : 0, golpe = f === 3;
  // chifre em espiral: sai da cabeça, sobe, enrola para fora e volta para baixo
  const chifreEspiral = (cx, cy, lado, escala = 1) => {
    for (let t = 0; t <= 1; t += 0.03) {
      const th = Math.PI + t * Math.PI * 1.75, r = 3.6 * escala * (1 - 0.5 * t);
      const x = cx + lado * Math.cos(th) * r, y = cy + Math.sin(th) * r, w = 1.7 * escala * (1 - 0.35 * t);
      p.bola(x, y, w, w, chifre);
      if (Math.round(t * 100) % 12 === 0) p.r(x - 0.5, y - 0.5, 1, 1, chifreE);
    }
  };
  const martelo = (x, y) => {
    p.l(x, y, x, y + 15, '#4a3020', 1);
    p.r(x - 3.5, y - 3, 7, 5, metal); p.r(x - 3.5, y - 3, 7, 1, tom(metal, 1.35));
    p.r(x - 3, y + 1, 6, 1, lava); p.r(x - 1, y - 2, 2, 2, lavaC);
  };
  if (dir === DIR.L) {
    p.bola(12, 25.5 + passo, 2.4, 3.2, peloE); p.bola(18, 25.5 - passo, 2.6, 3.4, pelo);
    p.r(10, 28.5, 4, 2, casco); p.r(16, 28.5, 4.5, 2, casco);
    p.bola(14.5, 18, 7.5, 7.5, pelo); p.bola(17, 19, 4, 4.5, peloC);
    p.r(8, 22, 13, 1.5, metal); p.r(16, 21.5, 2.5, 2.5, lava);
    p.l(10, 14, 12, 17, lava, 0.5); p.l(12, 13, 13, 15, lavaC, 0.5);
    chifreEspiral(16.5, 9.5, -1, 1.05);
    p.bola(19.5, 10, 4, 3.8, pelo); p.bola(23, 11.5, 2.4, 1.8, peloC); p.r(24.5, 11, 1, 1, peloE);
    p.r(20.5, 8.5, 1, 1, lavaC);
    p.poli([[19, 13.5], [24, 13.5], [21, 21]], barba); p.l(21.5, 14, 21.2, 20, barbaE, 0.5); p.r(20.5, 17.5, 2, 1, metal);
    if (golpe) { p.bola(23, 16, 3.2, 3, pelo); p.r(21, 15, 4, 2, metal); martelo(28, 5); }
    else { p.bola(18, 20, 3, 5, pelo); p.r(16, 21, 4.5, 2, metal); martelo(21, 12); }
    return;
  }
  const costas = dir === DIR.N;
  p.bola(12, 25.5 + passo, 2.6, 3.4, pelo); p.bola(20, 25.5 - passo, 2.6, 3.4, pelo);
  p.r(9.5, 28.5, 5, 2, casco); p.r(17.5, 28.5, 5, 2, casco);
  p.bola(16, 18, 8.5, 7.5, pelo);
  if (!costas) {
    p.bola(16, 19, 5, 5, peloC);
    p.r(8.5, 22, 15, 1.5, metal); p.r(14.5, 21.5, 3, 2.5, lava); p.r(15.5, 22, 1, 1, lavaC);
  }
  // rachaduras de lava pelo corpo
  p.l(9, 14.5, 11, 17.5, lava, 0.5); p.l(23, 14, 21, 17.5, lava, 0.5); p.l(10, 18, 12, 19, lavaC, 0.5);
  // braços enormes com braçadeiras de metal
  const ergue = golpe && !costas ? 4 : 0;
  p.bola(6.5, 19, 3.2, 5, pelo); p.r(3.5, 20, 6, 2, metal); p.bola(6.5, 24, 2.4, 2, peloE);
  if (!forja) {
    p.bola(25.5, 19 - ergue, 3.2, 5, pelo); p.r(22.5, 20 - ergue, 6, 2, metal); p.bola(25.5, 24 - ergue, 2.4, 2, peloE);
    if (!costas) martelo(26.5, golpe ? 3 : 11);
  }
  // chifres saem da lateral da cabeça e enrolam em volta das bochechas
  chifreEspiral(21, 9.5, 1, 1.05); chifreEspiral(11, 9.5, -1, 1.05);
  // cabeça, focinho e olhos de brasa
  p.bola(16, 9.5, 4.4, 4.2, costas ? peloE : pelo);
  p.r(12.5, 5.5, 7, 1.5, peloE);
  if (!costas) {
    p.bola(16, 11.5, 2.6, 2, peloC); p.r(15, 11, 2, 1, peloE);
    p.r(13.5, 8.5, 1, 1, lavaC); p.r(17.5, 8.5, 1, 1, lavaC);
    // barba trançada com anéis de metal
    p.bola(16, 15, 3.8, 3, barba); p.poli([[13, 15], [19, 15], [16, 22]], barba);
    p.l(16, 15.5, 16, 21, barbaE, 0.5); p.r(15, 18.5, 2, 1, metal); p.r(15.5, 20.5, 1, 1, metal);
  }
  if (costas) martelo(5.5, 11);
  if (forja) {
    const k = ornnQuadro;
    ornnForja(p, 10 + k);
    const [hx, hy, mx, my] = [[24, 11, 26, 3], [26, 14, 30, 9], [24, 17, 25.5, 19], [26, 15, 29, 12]][k];
    p.bola(23, 15, 3, 4, pelo); p.bola(hx, hy, 2.6, 2.4, peloE); p.r(hx - 2.5, hy + 1, 5, 1.6, metal);
    p.l(hx, hy, mx, my, '#4a3020', 1);
    p.r(mx - 3, my - 2.5, 6, 4.5, metal); p.r(mx - 3, my - 2.5, 6, 1, tom(metal, 1.35)); p.r(mx - 2.5, my + 1, 5, 1, lava);
  }
}

// Aranhinha (mascote): filhote da Vilemaw: abdômen escuro com a caveira acesa, 8 patas que mexem e olhinhos brilhando
function aranha(p, a, dir, f) {
  const C = a.cor || '#3b2f52', Cd = tom(C, 0.62), Cl = tom(C, 1.6), MK = a.marca || '#8afff0', O = a.olho || '#ff5ae0';
  const pata = a.pata || '#7a68a8', pataD = tom(pata, 0.6), passo = f % 2 ? 1.6 : -1.6;
  const lado = dir === DIR.L ? 1 : dir === DIR.O ? -1 : 0, costas = dir === DIR.N;
  const ax = 16 - lado * 4, ay = costas ? 19 : lado ? 17 : 16;          // abdômen
  const hx = 16 + lado * 6, hy = costas ? 12 : lado ? 20 : 23;          // cabeça
  const patas = () => {
    for (let k = 0; k < 4; k++) {
      const s2 = (k % 2 ? 1 : -1) * passo, yb = hy - 2.5 + k * 1.8;
      for (const L of [-1, 1]) {
        if (lado && L !== lado && k > 1) continue;      // de lado, as de trás ficam escondidas
        const x0 = hx + L * 2.5, xj = hx + L * (8 + k * 0.7), yj = yb - 5 + s2 * L * 0.7, xp = hx + L * (12 + k * 0.6), yp = Math.min(30.5, yb + 5.5 + s2 * L * 0.6);
        p.l(x0, yb, xj, yj, pataD, 2.2); p.l(xj, yj, xp, yp, pataD, 2);       // contorno
        p.l(x0, yb, xj, yj, pata, 1.2); p.l(xj, yj, xp, yp, pata, 1); p.px(xj, yj - 0.5, MK);
      }
    }
  };
  const abdomen = () => {
    p.bola(ax, ay, 8.5, 7.2, Cd); p.bola(ax, ay - 0.5, 7.8, 6.5, C); p.bola(ax - 2.5, ay - 3, 3.5, 2.2, Cl);
    for (const [x, y] of [[-6, -1], [6, -1], [-4, 4], [4, 4]]) p.px(ax + x, ay + y, MK);     // pelinhos acesos
    // a marca em caveira, acesa
    p.bola(ax, ay - 0.3, 3, 2.6, MK); p.r(ax - 1.8, ay + 1.6, 3.6, 1.4, MK);
    p.r(ax - 1.6, ay - 0.6, 1.2, 1.2, Cd); p.r(ax + 0.5, ay - 0.6, 1.2, 1.2, Cd); p.px(ax - 0.8, ay + 2, Cd); p.px(ax + 0.6, ay + 2, Cd);
  };
  const cabeca = () => {
    p.bola(hx, hy, 5, 4, tom(Cd, 0.8)); p.bola(hx, hy - 0.4, 4.4, 3.5, Cd); p.bola(hx - 1.2, hy - 1.8, 2.2, 1.3, C);
    if (costas) return;
    const ox = lado * 2;
    for (const [x, y] of [[-2, -0.4], [2, -0.4], [-0.8, -1.8], [0.8, -1.8]]) p.r(hx + x + ox - 0.5, hy + y - 0.5, 1.2, 1.2, O);
    p.px(hx - 2 + ox, hy - 1, '#ffffff'); p.px(hx + 2 + ox, hy - 1, '#ffffff');
    p.r(hx - 2 + ox, hy + 2.6, 1.2, 2, '#e8e0d0'); p.r(hx + 0.9 + ox, hy + 2.6, 1.2, 2, '#e8e0d0');      // presinhas
  };
  patas();
  if (costas) { cabeca(); abdomen(); } else { abdomen(); cabeca(); }
}

// Poro: bola de pelo branca com chifrinhos e a língua de fora
function poro(p, a, dir, f) {
  const pelo = a.pelo || '#f6f2ec', sombra = a.sombra || '#c8beb4', pulo = f === 1 ? -1.5 : 0;
  p.r(10, 27, 3, 2, sombra); p.r(19, 27, 3, 2, sombra);
  p.bola(16, 20 + pulo, 9.5, 8, pelo);
  for (const [x, y] of [[8, 16], [24, 16], [11, 12.5], [21, 12.5], [16, 11.5]]) p.bola(x, y + pulo, 2.6, 2.4, pelo);
  const chifre = a.chifre || '#d8b080';
  p.poli([[10, 13 + pulo], [7.5, 7 + pulo], [12.5, 11.5 + pulo]], chifre); p.poli([[22, 13 + pulo], [24.5, 7 + pulo], [19.5, 11.5 + pulo]], chifre);
  if (a.coroa) {               // Poro Rei: coroa de ouro com joia vermelha
    p.r(12, 7 + pulo, 9, 3, a.coroa); p.poli([[12, 7 + pulo], [13, 4 + pulo], [14.5, 7 + pulo]], a.coroa);
    p.poli([[15, 7 + pulo], [16.5, 3 + pulo], [18, 7 + pulo]], a.coroa); p.poli([[18.5, 7 + pulo], [20, 4 + pulo], [21, 7 + pulo]], a.coroa);
    p.r(16, 8 + pulo, 1.5, 1.5, '#e02040'); p.r(12, 9.5 + pulo, 9, 0.6, tom(a.coroa, 0.6));
  }
  if (a.brilhos) for (const [x, y] of [[9, 20], [23, 22], [14, 26]]) p.r(x, y + pulo, 1, 1, a.brilhos);
  if (dir === DIR.N) return;
  const dx = dir === DIR.L ? 3 : dir === DIR.O ? -3 : 0;
  p.r(12 + dx, 17.5 + pulo, 2, 2.5, '#1a1a2a'); p.r(18.5 + dx, 17.5 + pulo, 2, 2.5, '#1a1a2a');
  p.r(12.5 + dx, 17.5 + pulo, 1, 1, '#ffffff'); p.r(19 + dx, 17.5 + pulo, 1, 1, '#ffffff');
  p.r(15 + dx, 21 + pulo, 2.5, 1.2, '#3a2a2a'); p.r(15.5 + dx, 22.2 + pulo, 2, 3, '#ff7a9a');
}

// Darius: armadura noxiana pesada, ombreiras com espinhos, capa vermelha, cabelo curto raspado dos lados e o machadão.
// arm = armadura, ombro = ombreiras, capa (null: sem capa), calca = perneiras, elmo (skins), lamina = lâmina do machado
function darius(p, a, dir, f) {
  const A = a.arm, Ad = tom(A, 0.65), Al = tom(A, 1.35), O = a.ombro, Od = tom(O, 0.6), Ol = tom(O, 1.4);
  const capaD = a.capa && tom(a.capa, 0.6), perna = a.calca, pernaD = tom(perna, 0.7);
  const aco = tom(A, 1.15), botas = tom(A, 0.55), pele = a.pele, cab = a.cabelo, barba = a.barba || tom(cab, 1.1);
  const LAM = a.lamina || '#c3c9d3', lamD = tom(LAM, 0.55), lamL = tom(LAM, 1.3), cabo = '#4a3424', fio = a.fio || '#a01d1d';
  const { atk, m, by, pose } = tempos(f), ataque = atk === 3, passo = m.passo, bx = atk ? 0 : m.braco;
  if (by) p.g.translate(0, by);
  const aberto = pose === 50 || pose === 54, ruge = pose === 59, machadoNaMao = !aberto && !ruge, pisca = pose === 44;
  const capa = estiloNovoLigado() ? null : a.capa;
  const poeira = () => { if (f >= 30) for (const [x, y, c] of [[3, 29, '#e8d8b0'], [6, 30, '#c8b890'], [13, 30, '#c8b890'], [26, 30, '#e8d8b0'], [28, 28, '#c8b890']]) p.px(x, y, c); };
  // lâmina em meia-lua: (x, y) = onde encosta no cabo; lado = 1 para a direita, -1 para a esquerda
  const lamina = (x, y, lado) => {
    const X = (d) => x + d * lado;
    p.poli([[X(0), y - 1.5], [X(4), y - 5.5], [X(7.5), y - 1.5], [X(7.5), y + 3.5], [X(4), y + 7.5], [X(0), y + 4.5]], LAM);
    p.poli([[X(4.5), y - 5], [X(7.5), y - 1.5], [X(7.5), y + 3.5], [X(4.5), y + 7], [X(6), y + 1]], lamD);
    p.l(X(1), y + 0.5, X(1), y + 2.5, fio); p.px(X(3), y - 1.5, lamL);
    p.poli([[X(0), y], [X(-2.5), y - 1.5], [X(0), y + 2]], lamD);
  };
  const cabeca = (x, costas, lado) => {
    p.bola(x, 10, 4.2, 4.3, pele);
    if (a.elmo) {
      p.bola(x, 8.5, 4.8, 3.6, a.elmo); p.r(x - 4.5, 9, 9, 1, tom(a.elmo, 0.55));
      p.poli([[x - 4, 7], [x - 6.5, 3], [x - 2.5, 6]], tom(a.elmo, 1.2)); p.poli([[x + 4, 7], [x + 6.5, 3], [x + 2.5, 6]], tom(a.elmo, 1.2));
      if (!costas && !lado) { p.r(x - 2.5, 10.5, 1.5, 1, '#f0e0b0'); p.r(x + 1, 10.5, 1.5, 1, '#f0e0b0'); p.r(x - 2.5, 12.5, 5, 1.5, barba); }
      if (lado) { p.r(x + 2, 10.5, 1.2, 1, '#f0e0b0'); p.r(x + 1, 12.5, 3, 1.5, barba); }
      return;
    }
    if (costas) { p.bola(x, 8.5, 4.4, 4, tom(cab, 0.85)); p.bola(x, 7, 3.6, 2.4, cab); return; }
    if (lado) {
      p.bola(x - 1, 7, 3.8, 2.4, cab); p.r(x - 4, 8, 3, 3, tom(cab, 0.8));
      p.poli([[x - 2, 5], [x - 0.5, 3], [x + 1, 5]], cab); p.poli([[x + 0.5, 5.5], [x + 3, 4.5], [x + 3, 7]], cab);
      p.l(x + 1, 8.5, x + 3.5, 9, tom(cab, 0.7)); p.px(x + 2.5, 10, '#f0e8d0'); p.px(x + 3, 10, '#2a1a1a');
      p.r(x + 1, 12.5, 3, 1.5, barba); p.px(x + 3.5, 11.5, tom(pele, 0.7));
      if (pisca) p.r(x + 2, 10, 2, 1, tom(pele, 0.75));
      return;
    }
    // laterais raspadas, topo curto e espetado
    p.r(x - 4.3, 8, 1.2, 3, tom(cab, 0.75)); p.r(x + 3.1, 8, 1.2, 3, tom(cab, 0.75));
    p.bola(x, 6.8, 3.6, 2.3, cab);
    p.poli([[x - 2.5, 5.5], [x - 1.5, 3], [x, 5]], cab); p.poli([[x, 5], [x + 1.5, 2.5], [x + 2.5, 5.5]], cab); p.px(x - 1, 5, tom(cab, 1.4));
    // sobrancelhas franzidas e olhos duros
    p.l(x - 3, 8.5, x - 1, 9.5, '#1a1212'); p.l(x + 3, 8.5, x + 1, 9.5, '#1a1212');
    p.px(x - 2, 10, '#f0e8d0'); p.px(x + 1, 10, '#f0e8d0'); p.px(x - 1.5, 10, '#2a1a1a'); p.px(x + 1.5, 10, '#2a1a1a');
    p.r(x - 2.5, 12.3, 6, 1.7, barba); p.r(x - 1, 12, 3, 0.8, tom(pele, 0.6));
    if (pisca) { p.r(x - 2, 10, 2, 1, tom(pele, 0.75)); p.r(x + 1, 10, 2, 1, tom(pele, 0.75)); }
  };

  if (dir === DIR.L) {
    // o machado vai na mão da frente e acompanha o balanço do braço; a capa vai para trás com o vento
    if ((!atk || atk === 4) && machadoNaMao) { const ax = 20 + bx * 0.7, ay = atk === 4 ? 2 : 0; p.l(ax, 5 + ay, ax, 28, cabo, 1.2); lamina(ax + 0.5, 7 + ay, 1); }
    if (atk === 1) { p.l(17, 18, 7, 6, cabo, 1.2); lamina(7, 6, -1); }      // preparação: o machado vai lá para trás
    if (capa) { const v = m.vento; p.poli([[11, 15], [15, 15], [14 - v, 28], [8 - v, 28]], capaD); p.r(8 - v, 27, 6, 1, tom(capa, 0.45)); }
    p.r(13 - passo, 22 - m.liftT, 3, 5, pernaD); p.r(12 - passo, 27 - m.liftT, 5, 2, tom(botas, 0.8));
    p.r(16 + passo, 22 - m.liftF, 3.5, 5, perna); p.r(16 + passo, 24 - m.liftF, 3.5, 1, aco); p.r(16 + passo, 27 - m.liftF, 5, 2, botas);
    p.bola(16, 18.5, 5, 5, A); p.r(18.5, 15.5, 1.5, 5, Al); p.r(12, 21, 9, 1.5, Ad); p.poli([[16, 22], [20, 22], [19, 26], [16, 26]], fio);
    cabeca(17, false, true);
    // ombreira com espinhos
    p.bola(15, 15, 3.8, 3, O); p.poli([[13, 13.5], [11.5, 9.5], [15.5, 12.5]], Ol); p.poli([[16, 13], [16.5, 9.5], [18, 13]], Ol); p.r(12, 16.8, 6, 1, Od);
    if (ataque) { p.r(17, 16, 6, 3, Ad); p.r(22, 16, 2, 3, aco); p.l(18, 17, 26, 17, cabo, 1.2); lamina(24.5, 17, 1); if (f >= 30) { p.r(20, 27.5, 9, 1, tom(cabo, 0.7)); poeira(); } }
    else if (atk === 1) { p.r(14, 15, 4, 3, Ad); p.r(14.5, 16, 2.5, 2.5, aco); }
    else if (atk === 2 && pose === 57) { p.l(21, 13, 21, -2, cabo, 1.2); lamina(21.5, 0, 1); p.r(18, 8, 3, 7, Ad); p.r(18.5, 7, 3, 2.5, aco); }      // no ar: o machado bem no alto
    else if (atk === 2) { p.l(17, 15, 24, 8, cabo, 1.2); lamina(24, 8, 1); p.r(16, 14, 4, 3, Ad); p.r(18.5, 13, 3, 2.5, aco); }
    else if (aberto) {             // Q: machado aberto na horizontal; E: lançado mais longe para a frente
      const ponta = pose === 54 ? 31 : 28;
      p.l(16, 17.5, ponta, 17.5, cabo, 1.2); lamina(ponta - 2, 16, 1);
      p.r(16, 16, pose === 54 ? 8 : 6, 3, Ad); p.r(pose === 54 ? 23 : 21, 16, 2.5, 3, aco);
    } else if (ruge) {             // rugindo: braço e machado erguidos, boca aberta
      p.l(19, -1, 19, 16, cabo, 1.2); lamina(19.5, 1, 1); p.r(17, 9, 3, 7, Ad); p.r(17.5, 8, 3, 2.5, aco);
      p.r(19.5, 12, 1.5, 1.5, '#3a0a0a');
    } else { p.r(16 + bx, 16, 3, 6, Ad); p.r(17.5 + bx, 21, 3, 2.5, aco); }
    return;
  }

  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = atk ? 0 : m.bA, bB = atk ? 0 : m.bB, bal = m.balanco;
  const xm = costas ? 7 : 24;               // mão do machado (o machado sobe e desce com o braço)
  const ym = (costas ? bA : bB) + (atk === 4 ? 2 : 0), Lm = costas ? -1 : 1;
  if ((!atk || atk === 4) && machadoNaMao) { p.l(xm, 5 + ym, xm, 28 + ym, cabo, 1.2); lamina(xm + (costas ? -0.5 : 0.5), 7 + ym, Lm); }
  if (atk === 1) { p.l(xm - 2 * Lm, 22, xm + Lm, 3, cabo, 1.2); lamina(xm + Lm * 1.5, 4, Lm); }      // preparação: machado erguido atrás do ombro
  if (capa && !costas) p.poli([[10, 15], [22, 15], [24 + bal, 28], [8 + bal, 28]], capaD);
  // pernas com perneiras de aço
  for (const [x, l] of [[11, lA], [17.5, lB]]) {
    p.r(x, 22 + l, 3.5, 5, perna); p.r(x, 24 + l, 3.5, 1.2, aco); p.r(x - 0.5, 27 + l, 4.5, 2, botas);
  }
  // braços com manoplas
  const sobe = atk && atk !== 4 ? -3 : 0;
  if (ruge) {                       // braços abertos para o alto
    p.r(5.5, 9, 3, 8, Ad); p.r(5.5, 8, 3, 2.5, aco); p.r(23.5, 9, 3, 8, Ad); p.r(23.5, 8, 3, 2.5, aco);
  } else if (aberto) {              // as duas mãos no cabo, os braços esticados para o lado do machado
    p.r(costas ? 4 : 7.5, 16, 3, 5, Ad); p.r(costas ? 8 : 18, 17, 7, 3, Ad); p.r(costas ? 7 : 23, 17, 2.5, 3, aco);
  } else {
    p.r(7.5, 16 + bA, 3, 6, Ad); p.r(7.5, 21 + bA, 3, 2.5, aco);
    p.r(21.5, 16 + sobe + bB, 3, 6, Ad); p.r(21.5, 21 + sobe + bB, 3, 2.5, aco);
  }
  // peitoral, cinto e saiote vermelho
  p.bola(16, 18.5, 6.4, 5, A);
  if (costas) { if (capa) { p.poli([[10, 15], [22, 15], [23.5 + bal, 28], [8.5 + bal, 28]], capa); p.l(16, 17, 16 + bal, 27, capaD); p.r(8.5 + bal, 27, 15, 1, capaD); } }
  else {
    p.r(13, 15.5, 6, 4, Al); p.r(13, 19, 6, 1, Ad); p.l(16, 15.5, 16, 19, Ad);
    p.r(10, 21, 12, 1.5, Ad); p.r(15, 21, 2, 1.5, '#c8a040'); p.poli([[13.5, 22.5], [18.5, 22.5], [18, 27], [14, 27]], fio); p.r(14, 26, 4, 1, tom(fio, 0.6));
  }
  cabeca(16, costas, false);
  // ombreiras grandes com espinhos
  for (const lado of [-1, 1]) {
    const x = 16 + lado * 6.8;
    p.bola(x, 15, 3.8, 3, O); p.r(x - 3.5, 16.8, 7, 1, Od); p.px(x - lado, 14, Ol);
    p.poli([[x - lado * 1.5, 13.5], [x + lado * 2, 9], [x + lado * 1.5, 13.5]], Ol);
    p.poli([[x + lado * 1.5, 14], [x + lado * 4.5, 11.5], [x + lado * 3, 15]], O);
  }
  // golpe: machado descendo na frente do corpo
  if (ataque) {
    if (costas) { p.l(10, 18, 10, 3, cabo, 1.2); lamina(10, 4, -1); }
    else { p.l(23, 14, 10, 23, cabo, 1.2); lamina(10, 22, -1); poeira(); }
  } else if (atk === 2 && pose === 57) {      // Guilhotina no ar: machado bem acima da cabeça, as duas mãos no cabo
    const x = costas ? 11 : 21, lado = costas ? -1 : 1;
    p.r(costas ? 10 : 19, 8, 3, 8, Ad); p.r(costas ? 7.5 : 22, 9, 2.5, 7, Ad); p.r(costas ? 8 : 19, 7, 5, 2.5, aco);
    p.l(x, 12, x, -2, cabo, 1.2); lamina(x + lado * 0.5, 0, lado);
  } else if (atk === 2) {            // golpe: o machado passa por cima da cabeça
    if (costas) { p.l(10, 16, 13, 2, cabo, 1.2); lamina(13, 3, -1); }
    else { p.l(22, 16, 19, 2, cabo, 1.2); lamina(19, 3, 1); }
  } else if (aberto) {               // Q e E de frente/costas: o machado atravessado na horizontal
    const lado = costas ? -1 : 1, ponta = 16 + lado * (pose === 54 ? 15 : 12);
    p.l(16 - lado * 2, 18.5, ponta, 18.5, cabo, 1.2); lamina(ponta - lado * 1.5, 16.5, lado);
  } else if (ruge) {                 // rugindo: machado erguido na mão da direita
    const x = costas ? 6.5 : 25; p.l(x, -1, x, 10, cabo, 1.2); lamina(x + (costas ? -0.5 : 0.5), 1, costas ? -1 : 1);
    if (!costas) p.r(15, 13, 2.5, 1.5, '#3a0a0a');
  }
}

// Ezreal: jaqueta de couro, cachecol alto, jeans com joelheiras, cabelo espetado com óculos e a manopla dourada.
// arm = jaqueta, ombro = cachecol, calca = jeans, oculos = lentes (null: sem óculos), manopla/brilho = luva e gema
function ezreal(p, a, dir, f) {
  const J = a.arm, Jd = tom(J, 0.68), Jl = tom(J, 1.25), C = a.ombro, Cd = tom(C, 0.62), Cl = tom(C, 1.35);
  const camisa = a.camisa || '#ece6d6', jeans = a.calca, jd = tom(jeans, 0.7), botas = a.botas || '#7a4426';
  const pele = a.pele, cab = a.cabelo, cabD = tom(cab, 0.72), cabL = tom(cab, 1.3), olho = a.olho || '#2a6ad8';
  const ouro = a.manopla || '#d8a838', ouroD = tom(ouro, 0.6), gema = a.brilho || '#7ad8ff', luva = '#2a2a34';
  const joelho = '#5a5a64', cinto = '#3a3a42', alca = '#5a4632';
  const t0 = tempos(f), { atk, m, by, pose } = t0, passo = m.passo, bx = atk || pose ? 0 : m.braco;
  const ataque = atk === 2 || atk === 3 || pose === 50 || pose === 51 || pose === 54, ergue = pose === 55, duasMaos = pose === 51 || pose === 54;
  if (by) p.g.translate(0, by);
  if (pose === 50 && dir === DIR.L) p.g.translate(-1, 0);          // coice do tiro: o corpo vai um pixel para trás
  const orbe = (x, y, r) => { p.bola(x, y, r, r, pose === 51 ? '#b060ff' : tom(gema, 1.2)); p.px(x - 1, y - 1, '#ffffff'); };
  // preparação: a manopla junta energia; impacto: o disparo explode na frente da mão
  const carga = (x, y) => { p.px(x, y - 1, tom(gema, 1.3)); p.px(x - 1, y + 1, gema); p.px(x + 2, y, '#ffffff'); p.px(x + 1, y + 2, tom(gema, 1.2)); };
  const estouro = (x, y) => { p.bola(x, y, 3.6, 3.6, tom(gema, 1.15)); p.o(x, y, 2, 2, '#ffffff'); for (const [dx, dy] of [[5, 0], [-4, -3], [3, -4], [3, 4], [-4, 3]]) p.px(x + dx, y + dy, tom(gema, 1.3)); };
  const lente = (x, y) => { p.bola(x, y, 1.8, 1.4, a.oculos); p.px(x - 1, y - 1, '#ffffff'); };

  if (dir === DIR.L) {
    // perna de trás, casaco atrás
    const lt = m.liftT, lf = m.liftF;
    p.r(13 - passo, 22 - lt, 3, 5, jd); p.r(13 - passo, 24.5 - lt, 3, 1.2, tom(joelho, 0.8)); p.r(12 - passo, 27 - lt, 4, 2, tom(botas, 0.8));
    if (!duasMaos) p.r(11 - bx, 18, 3, 5, Jd);
    p.r(16 + passo, 22 - lf, 3, 5, jeans); p.r(16 + passo, 24.5 - lf, 3, 1.2, joelho); p.r(16 + passo, 27 - lf, 5, 2, botas); p.r(16 + passo, 26 - lf, 3, 1, tom(botas, 1.2));
    // tronco
    p.bola(16, 18.5, 4.6, 4.4, J); p.r(19, 15, 1.5, 5, camisa); p.r(13, 16, 1, 5, Jl);
    p.r(12, 21, 8, 1.5, cinto); p.px(19, 21, '#c8c8c8'); p.r(12, 21, 2, 3, tom(botas, 1.15));
    // cachecol
    p.poli([[12, 16], [12.5 - m.vento, 12.5], [15.5, 14.5]], C); p.bola(16.5, 15.2, 4.4, 1.8, C); p.r(14, 14, 4, 1, Cl); p.r(14, 16.4, 5, 0.8, Cd);
    // cabeça
    p.bola(17, 9.5, 4.4, 4.5, pele); if (pose === 44) p.r(19.5, 10, 1.2, 0.8, tom(pele, 0.65)); else { p.r(19.5, 9, 1.2, 1.8, olho); p.px(19.5, 9, '#ffffff'); } p.r(19, 8, 2, 0.7, cabD); p.px(20, 12, tom(pele, 0.7));
    p.bola(15.5, 6.8, 4.6, 3, cab);
    p.poli([[12, 6], [8, 8.5], [12.5, 9.5]], cab); p.poli([[12.5, 4.5], [9.5, 2], [15, 4]], cab);
    p.poli([[15, 4], [17.5, 0.8], [19, 4]], cab); p.poli([[18, 5], [21.5, 7.5], [18.5, 8.5]], cab);
    p.poli([[13, 8], [13.5, 12.5], [15.5, 9]], cabD); p.px(14, 4, cabL); p.px(17, 3, cabL); p.px(12, 6, cabL);
    if (a.oculos) { p.l(12.5, 5.5, 17.5, 4.5, alca); lente(18.8, 4.6); }
    // braço com a manopla
    if (ergue) {                   // manopla erguida acima da cabeça, brilhando
      p.r(17, 7, 3, 9, J); p.r(16.5, 3, 4, 4.5, ouro); p.px(18, 5, gema); orbe(18.5, 0.5, 2.2);
    } else if (ataque) {
      if (duasMaos) { p.r(15, 16.5, 6, 2.5, Jd); p.r(20, 16.5, 2, 2.5, luva); }          // a outra mão segura o pulso / ajuda a conjurar
      p.r(17, 16, 5, 3, J); p.r(21, 15.5, 4, 4, ouro); p.r(21, 18.5, 4, 1, ouroD); p.px(23, 17, gema);
      if (pose === 51) orbe(27, 16.5, 3.2);
      else if (pose === 54) { orbe(27.5, 17.5, 3.6); p.px(30, 15, '#ffffff'); p.px(29, 20, tom(gema, 1.3)); }
      else if (atk === 3 && f >= 30 || pose === 50) estouro(27.5, 17.5);
      else { p.bola(27, 17.5, 2.8, 2.8, tom(gema, 1.25)); p.px(27, 17, '#ffffff'); p.px(26, 16, '#ffffff'); }
    } else {
      p.r(16 + bx, 16, 3, 4, J); p.r(15.5 + bx, 19.5, 4.5, 4.5, ouro); p.r(15.5 + bx, 23, 4.5, 1, ouroD); p.px(16 + bx, 21, ouroD); p.px(18 + bx, 21, ouroD);
      p.px(17 + bx, 20, gema); p.px(20 + bx, 21, tom(gema, 1.2));
      if (atk === 1) carga(18, 21); else if (atk === 4) p.px(21, 19, tom(gema, 1.3));
    }
    return;
  }

  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = ataque ? 0 : m.bA, bB = ataque ? 0 : m.bB;
  // de frente a manopla fica no braço da direita da tela; de costas, na esquerda
  const xm = costas ? 6 : 22, xl = costas ? 22 : 7;
  // pernas afastadas, joelheiras e botas
  for (const [x, l] of [[11, lA], [18, lB]]) {
    p.r(x, 22 + l, 4, 5, jeans); p.r(x, 22 + l, 1, 5, jd);
    if (!costas) p.r(x, 24.5 + l, 4, 1.2, joelho);
    p.r(x - (x < 16 ? 1 : 0), 27 + l, 5, 2, botas); p.r(x, 26 + l, 4, 1, tom(botas, 1.2));
  }
  // braço de luva preta (nas poses de duas mãos ele sobe junto com a manopla)
  const yl = costas ? bB : bA, ym = costas ? bA : bB;
  if (duasMaos) { p.r(xl + (costas ? -1 : 1), 14, 3, 4, Jd); p.r(xl + (costas ? -1 : 2), 13, 3, 2.5, luva); }
  else if (ergue) { p.r(xl, 16, 3, 6, Jd); p.r(xl, 21.5, 3, 2.5, luva); }
  else { p.r(xl, 16 + yl, 3, 6, Jd); p.r(xl, 21.5 + yl, 3, 2.5, luva); if (!costas) p.px(xl + 1, 23 + yl, pele); }
  // tronco: jaqueta aberta com a camisa branca
  p.bola(16, 18.5, 6, 4.8, J);
  p.r(10, 20, 3, 3, Jd); p.r(19, 20, 3, 3, Jd);
  if (!costas) {
    p.r(14.5, 15, 3, 6, camisa); p.r(14.5, 15, 1, 6, tom(camisa, 0.8)); p.px(16, 17, '#a08a60');
    p.l(14, 15, 14, 21, Jd); p.l(18, 15, 18, 21, Jd); p.r(11, 16, 1, 4, Jl);
  } else { p.l(16, 16, 16, 21, Jd); p.r(12, 16, 1, 4, Jl); }
  p.r(11, 21, 10, 1.5, cinto); if (!costas) { p.px(16, 21, '#c8c8c8'); p.r(19, 21, 2, 3, tom(botas, 1.15)); }
  // cachecol
  p.poli([[10, 16], [10.5, 12.5], [13.5, 14.5]], C); p.poli([[22, 16], [21.5, 12.5], [18.5, 14.5]], C);
  p.bola(16, 15.2, 6.4, 1.9, C); p.r(11, 14, 3, 1, Cl); p.r(12, 16.4, 8, 0.8, Cd);
  // cabeça grande (chibi)
  p.bola(16, 9.5, 4.8, 4.6, pele);
  if (costas) {
    p.bola(16, 8.5, 5.3, 5, cab);
    p.poli([[11, 8], [9.5, 12], [13, 11]], cab); p.poli([[21, 8], [22.5, 12], [19, 11]], cab);
    p.poli([[12.5, 12], [14, 14], [15.5, 12]], cabD); p.poli([[16.5, 12], [18, 14], [19.5, 12]], cabD);
  } else {
    if (pose === 44) { p.r(13, 10, 2, 1, tom(pele, 0.65)); p.r(18, 10, 2, 1, tom(pele, 0.65)); }
    else { p.r(13, 9.5, 2, 2, olho); p.r(18, 9.5, 2, 2, olho); p.px(13, 9.5, '#ffffff'); p.px(18, 9.5, '#ffffff'); }
    p.px(16, 12, tom(pele, 0.7));
    p.bola(16, 6, 5.4, 2.6, cab);
    p.poli([[11, 6], [10, 11.5], [12.8, 8.5]], cab); p.poli([[21, 6], [22, 11], [19.2, 8.5]], cab);
    p.poli([[12, 6.5], [12.5, 9.5], [14.5, 7]], cab); p.poli([[14, 6.5], [15.8, 9.5], [17, 7]], cab); p.poli([[16.5, 6.5], [19, 9], [19.5, 6.5]], cab);
    p.r(12.5, 8.6, 2.5, 0.7, cabD); p.r(17.5, 8.6, 2.5, 0.7, cabD);
  }
  p.poli([[11, 5.5], [8.5, 3], [13, 4]], cab); p.poli([[13, 4.2], [14.5, 0.8], [16.5, 3.6]], cab);
  p.poli([[16, 3.6], [20, 1.5], [19.5, 4.5]], cab); p.poli([[19.5, 4.5], [23, 4.5], [21, 6.5]], cab);
  p.px(14, 3, cabL); p.px(18, 3, cabL); p.px(12, 5, cabL); p.px(20, 5, cabL);
  if (a.oculos) {
    if (costas) p.l(11, 6, 21, 5, alca);
    else { p.l(11, 5.5, 21, 4.5, alca); lente(14, 4.9); lente(18, 4.5); }
  }
  // braço da manopla
  const y = ergue ? 4 : ataque ? 15 : 19 + ym;
  p.r(xm, ergue ? 8 : 16 + (ataque ? 0 : ym), 3, ergue ? 8 : ataque ? 2 : 4, J);
  p.r(xm - 0.5, y, 4.5, 5, ouro); p.r(xm - 0.5, y + 4, 4.5, 1, ouroD); p.px(xm, y + 2, ouroD); p.px(xm + 2, y + 2, ouroD);
  p.px(xm + 1, y + 1, gema); if (!costas) p.px(xm + 4, y + 1, tom(gema, 1.2));
  if (ataque && !costas) {
    if (pose === 51) orbe(15.5, 12, 3.2);                       // W: a esfera entre as duas mãos
    else if (pose === 54) orbe(xm + 1.5, y - 3, 3.8);           // R: carregando
    else if (atk === 3 && f >= 30 || pose === 50) estouro(xm + 1.5, y - 3.5);
    else { p.bola(xm + 1.5, y - 2.5, 2.6, 2.6, tom(gema, 1.25)); p.px(xm + 1, y - 3, '#ffffff'); }
  }
  if (ergue) orbe(xm + 1.5, y - 2.5, 2.4);
  if (atk === 1) carga(xm + 1.5, y + 1.5);
  else if (atk === 4 && !costas) p.px(xm + 3, y - 1, tom(gema, 1.3));
}


// Lux: cabelo loiro comprido, roupa branca e azul com detalhes dourados, saia, botas brancas e o cajado com o cristal.
// Poses: 50 lança a luz para a frente (Q e as de disparo), 51 as duas mãos no cajado (W, a barreira),
// 54 concentrando a Centelha Final (R), 55 cajado erguido brilhando (E e as outras)
function lux(p, a, dir, f) {
  const roupa = a.roupa || '#f2eee6', roupaD = tom(roupa, 0.78), azul = a.azul || '#3a64c8', azulD = tom(azul, 0.7), azulL = tom(azul, 1.3);
  const ouro = a.ouro || '#e6b440', ouroD = tom(ouro, 0.65), ouroL = tom(ouro, 1.25), pele = a.pele, cab = a.cabelo, cabD = tom(cab, 0.75), cabL = tom(cab, 1.22);
  const olho = a.olho || '#3a8ae8', botas = a.botas || '#ece8f0', botasD = tom(botas, 0.75), meia = a.meia || '#dcd8e8';
  const cristal = a.cristal || '#ff9ae0', cajado = a.cajado || '#c89a4a', joia = a.joia || '#5ab8ff';
  const novo = estiloNovoLigado();                 // no estilo novo o cabelo de trás é o pano com física
  const t0 = tempos(f), { atk, m, by, pose } = t0, passo = m.passo, bx = atk || pose ? 0 : m.braco;
  const ataque = atk === 2 || atk === 3 || pose === 50 || pose === 51 || pose === 54, ergue = pose === 55, duasMaos = pose === 51 || pose === 54;
  if (by) p.g.translate(0, by);
  // a luz do cristal: um ponto que pulsa, uma esfera no ataque e um clarão no impacto
  const luz = (x, y, r) => { p.bola(x, y, r, r, tom(cristal, 1.15)); p.bola(x, y, r * 0.55, r * 0.55, '#fff6fc'); p.px(x - 1, y - 1, '#ffffff'); };
  const brilhoCristal = (x, y) => { p.poli([[x, y - 2.5], [x + 1.6, y], [x, y + 2.5], [x - 1.6, y]], cristal); p.px(x, y - 1, '#ffffff'); p.px(x - 0.5, y, tom(cristal, 1.25)); };
  const estouro = (x, y) => { luz(x, y, 3.4); for (const [dx, dy] of [[5, 0], [-4, -3], [3, -4], [3, 4], [-4, 3], [0, -5]]) p.px(x + dx, y + dy, tom(cristal, 1.3)); };
  // o topo do cajado: a haste dourada abre em duas pontas que seguram o cristal
  const topoCajado = (x, y) => { p.poli([[x - 2, y + 1.5], [x - 1.2, y - 1.5], [x - 0.4, y + 1]], ouro); p.poli([[x + 2, y + 1.5], [x + 1.2, y - 1.5], [x + 0.4, y + 1]], ouro); p.px(x - 1.6, y + 1.2, ouroD); brilhoCristal(x, y - 0.5); };
  // ombreira dourada grande, com o miolo branco e a joia azul
  const ombreira = (x, y, w = 2.7) => { p.bola(x, y, w, w * 0.72, ouro); p.bola(x, y + 0.6, w * 0.95, w * 0.35, ouroD); p.bola(x, y - 0.3, w * 0.55, w * 0.4, roupa); p.px(x, y - 0.3, joia); p.px(x - w * 0.5, y - 1, ouroL); };

  if (dir === DIR.L) {
    const lt = m.liftT, lf = m.liftF;
    // cabelo comprido caindo atrás (estilo antigo; no novo é o pano)
    if (!novo) p.poli([[11, 7], [8.5, 19], [12, 20.5], [14, 10]], cabD);
    // perna de trás e braço de trás
    p.r(13 - passo, 23 - lt, 2.5, 4, tom(meia, 0.85)); p.r(12.5 - passo, 26.5 - lt, 3.5, 2.5, botasD);
    if (!duasMaos) p.r(12 - bx, 16, 2.5, 5, roupaD);
    // perna da frente
    p.r(16 + passo, 23 - lf, 2.5, 4, meia); p.r(16 + passo, 26.5 - lf, 4, 2.5, botas); p.r(16 + passo, 26.5 - lf, 4, 0.8, ouro);
    // saia azul com a barra dourada e o branco aparecendo na abertura da frente
    p.poli([[12, 20], [20, 20], [21.5, 24.5], [11, 24.5]], azul); p.poli([[18, 20.5], [20, 20.5], [21.5, 24.5], [19, 24.5]], roupa);
    p.r(11.5, 23.6, 8, 0.9, ouro); p.r(13, 20.5, 1, 3.5, azulL); p.l(18, 20.5, 19, 24.5, ouro);
    // tronco: o peitoral azul com a borda dourada
    p.bola(16, 17.5, 4.2, 3.8, roupa); p.poli([[15, 14.5], [20, 14.5], [19.5, 19.5], [15.5, 19.5]], azul); p.l(19.8, 14.5, 19.5, 19.5, ouro); p.r(15, 14.5, 5, 0.8, ouro);
    p.r(13, 16, 1, 4, roupaD); p.r(12.5, 19.6, 7.5, 1, ouro); p.px(17.5, 19.6, joia);
    // cabeça
    p.bola(17, 9.5, 4.3, 4.4, pele);
    if (pose === 44) p.r(19.5, 10, 1.2, 0.8, tom(pele, 0.65)); else { p.r(19.4, 9, 1.3, 1.8, olho); p.px(19.4, 9, '#ffffff'); }
    p.px(20, 12, tom(pele, 0.72));
    // cabelo: o topo, a franja caindo na testa e a mecha comprida na frente da orelha até o ombro
    p.bola(16, 6.6, 4.9, 3.3, cab); p.poli([[12, 6], [10.5, 12], [14.5, 9]], cab);
    p.poli([[17, 4.5], [21.6, 6.2], [21, 7.9], [18.5, 7]], cab); p.px(21, 7.5, cabD);
    p.poli([[13.5, 9.5], [12.5, 17.5], [14.2, 17], [15.5, 10.5]], cab); p.l(14, 11, 13.2, 16.5, cabD);
    p.px(15, 4, cabL); p.px(17.5, 4, cabL); p.px(13, 7, cabL); p.px(19, 5.2, cabL);
    p.r(13.5, 3.6, 6, 0.9, ouro); p.poli([[19.3, 3.2], [21, 4.2], [19.3, 5]], ouro); p.px(20, 4.1, joia);     // tiara com a joia na frente
    ombreira(15.5, 15, 2.4);
    // braço da frente com o cajado
    if (ergue) {                                                   // cajado erguido, o cristal brilhando no alto
      p.r(17, 8, 2.5, 8, roupa); p.r(17.5, 7, 2, 1.5, pele);
      p.r(18, -2, 1.2, 12, cajado); topoCajado(18.6, -3); luz(18.6, -3.5, 2);
    } else if (ataque) {                                           // cajado apontado para a frente
      if (duasMaos) { p.r(15, 16.5, 5, 2.2, roupaD); p.r(19.5, 16.5, 1.5, 2.2, pele); }
      p.r(17, 16, 4, 2.6, roupa); p.r(20.5, 16, 1.6, 2.4, pele);
      p.r(18, 17, 9, 1.2, cajado); brilhoCristal(27.5, 17.5);
      if (pose === 51) luz(29, 17.5, 3);
      else if (pose === 54) { luz(29.5, 17.5, 3.6); p.px(31, 15, '#ffffff'); p.px(30, 21, tom(cristal, 1.3)); }
      else if (atk === 3 && f >= 30 || pose === 50) estouro(29.5, 17.5);
      else luz(29.5, 17.5, 2.4);
    } else {                                                       // parado/andando: cajado de pé ao lado do corpo
      p.r(16 + bx, 16, 2.5, 4.5, roupa); p.r(16 + bx, 20, 2.5, 1.6, pele);
      p.r(18.5 + bx, 8, 1.2, 18, cajado); p.r(18.5 + bx, 15, 1.2, 0.8, ouro); topoCajado(19.1 + bx, 6);
      if (atk === 1) luz(19.1, 5.5, 1.8); else if (atk === 4) p.px(21, 5, tom(cristal, 1.3));
    }
    return;
  }

  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = ataque ? 0 : m.bA, bB = ataque ? 0 : m.bB;
  // de frente o cajado fica na mão da direita da tela; de costas, na da esquerda
  const xm = costas ? 7 : 22, xl = costas ? 22 : 7;
  // de costas: o cabelo comprido cobre as costas (estilo antigo; no novo é o pano, desenhado por cima)
  if (costas && !novo) p.poli([[10.5, 8], [21.5, 8], [22.5, 20], [9.5, 20]], cabD);
  // de frente: o cabelo comprido aparece dos lados, atrás dos ombros (estilo antigo)
  if (!costas && !novo) { p.poli([[10.5, 8], [8.6, 19], [11, 19.5], [12, 10]], cabD); p.poli([[21.5, 8], [23.4, 19], [21, 19.5], [20, 10]], cabD); }
  // pernas finas com meia branca e botas
  for (const [x, l] of [[12.5, lA], [17.5, lB]]) {
    p.r(x, 23 + l, 2.6, 4, meia); p.r(x, 23 + l, 0.8, 4, tom(meia, 0.82));
    p.r(x - (x < 16 ? 0.6 : 0), 26.5 + l, 3.4, 2.5, botas); p.r(x - (x < 16 ? 0.6 : 0), 26.5 + l, 3.4, 0.8, ouro);
  }
  // braço sem o cajado
  const yl = costas ? bB : bA, ym = costas ? bA : bB;
  if (duasMaos) { p.r(xl + (costas ? -1 : 1), 14.5, 2.6, 4, roupaD); p.r(xl + (costas ? -1 : 2), 13.5, 2.4, 2, pele); }
  else if (ergue) { p.r(xl, 16, 2.6, 5, roupaD); p.r(xl, 20.5, 2.6, 1.8, pele); }
  else { p.r(xl, 16 + yl, 2.6, 5, roupaD); p.r(xl, 20.5 + yl, 2.6, 1.8, pele); p.r(xl, 19.5 + yl, 2.6, 0.8, ouro); }
  // saia azul em sino com a barra dourada; de frente, aberta no meio mostrando o branco
  p.poli([[11, 20], [21, 20], [23, 24.6], [9, 24.6]], azul); p.r(9.5, 23.7, 13, 0.9, ouro);
  p.r(11.5, 20.5, 1, 3.5, azulL); p.r(19.5, 20.5, 1, 3.5, azulD);
  if (!costas) { p.poli([[15, 20.3], [17, 20.3], [18.3, 24.6], [13.7, 24.6]], roupa); p.l(15, 20.3, 13.7, 24.4, ouro); p.l(17, 20.3, 18.3, 24.4, ouro); }
  // tronco: branco por baixo, o peitoral azul com o V dourado e a joia, o cinto dourado
  p.bola(16, 17.5, 5.4, 4, roupa);
  if (!costas) {
    p.poli([[12.6, 14.2], [19.4, 14.2], [18.8, 19.6], [13.2, 19.6]], azul); p.r(12.6, 14.2, 6.8, 0.8, azulL);
    p.l(12.8, 14.6, 16, 17.6, ouro); p.l(19.2, 14.6, 16, 17.6, ouro); p.bola(16, 17.4, 0.9, 0.9, ouro); p.px(16, 17.4, joia);
    p.r(13.2, 16.5, 0.8, 2.6, azulD); p.r(10.5, 16, 1, 3, roupaD);
  } else p.poli([[12, 14.5], [20, 14.5], [19.5, 19.5], [12.5, 19.5]], azul);
  p.r(11, 19.6, 10, 1, ouro); p.r(11, 20.4, 10, 0.4, ouroD);
  // cabeça
  p.bola(16, 9.5, 4.8, 4.6, pele);
  if (costas) {
    p.bola(16, 8.5, 5.4, 5, cab); p.bola(16, 11.5, 4.8, 2.4, cab);
    p.l(13, 6, 12.5, 12, cabD); p.l(19, 6, 19.5, 12, cabD); p.l(16, 5, 16, 12.5, cabL);
    p.r(11.5, 4.6, 9, 0.9, ouro); p.px(11.2, 5, ouroL); p.px(20.6, 5, ouroL);             // a tiara passando atrás
  } else {
    if (pose === 44) { p.r(13, 10, 2, 1, tom(pele, 0.65)); p.r(17.5, 10, 2, 1, tom(pele, 0.65)); }
    else { p.r(13, 9.5, 2, 2, olho); p.r(17.5, 9.5, 2, 2, olho); p.px(13, 9.5, '#ffffff'); p.px(17.5, 9.5, '#ffffff'); p.px(14, 10.5, tom(olho, 0.7)); p.px(18.5, 10.5, tom(olho, 0.7)); }
    p.px(15.8, 12.2, tom(pele, 0.72)); p.r(15, 13, 1.6, 0.5, tom(pele, 0.8));
    // topo e a franja grande jogada para o lado (da esquerda para a direita da tela)
    p.bola(16, 6, 5.7, 2.9, cab);
    p.poli([[10.6, 6], [17.5, 4.6], [20.2, 7.8], [16.5, 6.9], [13.6, 8.1], [11.2, 8.6]], cab);
    p.l(12, 6.6, 16.5, 5.4, cabL); p.l(16.8, 5.6, 19.4, 7.6, cabD); p.px(13.6, 8, cabD);
    // as mechas compridas dos lados do rosto, até o peito
    p.poli([[11, 6.5], [9.4, 17.5], [11.4, 18], [12.6, 10]], cab); p.poli([[21, 6.5], [22.6, 17.5], [20.6, 18], [19.4, 10]], cab);
    p.l(10.8, 9, 10.2, 17, cabD); p.l(21.2, 9, 21.8, 17, cabD); p.px(9.8, 17.6, cabL); p.px(22.2, 17.6, cabL);
    // tiara dourada com a joia azul no meio da testa e as pontinhas dos lados
    p.r(11.5, 3.6, 9, 0.9, ouro); p.poli([[15, 3.4], [16, 1.8], [17, 3.4], [16, 4.6]], ouro); p.px(16, 3.2, joia); p.px(16, 2.6, tom(joia, 1.3));
    p.px(11.3, 3.4, ouroL); p.px(20.7, 3.4, ouroL);
  }
  p.px(13, 4.6, cabL); p.px(18.5, 4.6, cabL);
  // ombreiras douradas grandes
  ombreira(10.6, 15.2); ombreira(21.4, 15.2);
  // braço com o cajado
  const yb = ergue ? 8 : ataque ? 14 : 16 + ym;
  p.r(xm, yb, 2.6, ergue ? 7 : ataque ? 2.4 : 5, roupa);
  if (ergue) {                     // cajado erguido acima da cabeça
    p.r(xm + 0.2, 7, 2.2, 1.6, pele);
    p.r(xm + 0.6, -3, 1.2, 12, cajado); topoCajado(xm + 1.2, -4); luz(xm + 1.2, -4.5, 2.2);
  } else if (ataque && !costas) {  // cajado apontado para cima e para a frente, a luz saindo do cristal
    p.r(xm + 0.2, 13.5, 2.2, 1.8, pele);
    p.r(xm + 0.6, 3, 1.2, 12, cajado); topoCajado(xm + 1.2, 2);
    if (pose === 51) luz(16, 11, 3.2);                                    // W: a barreira entre as mãos
    else if (pose === 54) luz(xm + 1.2, -1.5, 3.8);                       // R: concentrando
    else if (atk === 3 && f >= 30 || pose === 50) estouro(xm + 1.2, -1.5);
    else luz(xm + 1.2, -0.5, 2.4);
  } else {                         // cajado de pé, ao lado do corpo
    p.r(xm, 20.5 + ym, 2.6, 1.8, pele); p.r(xm, 19.7 + ym, 2.6, 0.8, ouro);
    p.r(xm + 0.8, 8 + ym, 1.2, 19, cajado); p.r(xm + 0.8, 14 + ym, 1.2, 0.8, ouro); topoCajado(xm + 1.4, 6 + ym);
    if (atk === 1) luz(xm + 1.4, 5.5, 1.8);
    else if (atk === 4 && !costas) p.px(xm + 3, 5, tom(cristal, 1.3));
  }
}

// Yasuo: o espadachim errante, como no LoL. Cabelo castanho-escuro espetado com franja e um rabo de cavalo enorme preso
// no alto (no estilo novo o rabo é um pano com física, ver pano() no cena.js; aqui fica só o nó), cicatriz no nariz,
// barba por fazer, colar de contas com a pedra do vento; quimono azul com a manga só no braço de trás, o braço da
// espada de fora com a braçadeira de couro, a ombreira grande de aço no outro ombro, faixa de corda na cintura,
// calça larga azul-escura, faixas nas canelas e a katana.
// Poses: 50 estocada (Q), 51 mão aberta chamando o vento (W), 52 agachado e 53 avançando baixo (E),
// 54 no ar com a katana no alto (R), 55 katana erguida na frente (as outras); 45 a katana apoiada no ombro (gesto parado)
function yasuo(p, a, dir, f) {
  const Q = a.roupa || '#36598e', Qd = tom(Q, 0.66), Ql = tom(Q, 1.32);
  const pele = a.pele, peleD = tom(pele, 0.72), cab = a.cabelo, cabD = tom(cab, 0.7), cabL = tom(cab, 1.7);
  const faixa = a.faixa || '#c8a86a', faixaD = tom(faixa, 0.7), couro = a.couro || '#7a4a2a', couroL = tom(couro, 1.3);
  const aco = a.metal || '#a8b2bd', acoD = tom(aco, 0.62), acoL = tom(aco, 1.25);
  const calca = a.calca || '#262c44', calcaD = tom(calca, 0.72), botas = a.botas || '#3e2e24', faixaPerna = a.faixaPerna || '#c9bca0';
  const LAM = a.lamina || '#dde5ee', lamL = '#ffffff', lamD = tom(LAM, 0.6), cabo = a.cabo || '#2a1c18', guarda = a.guarda || '#c9a24a';
  const olho = a.olho || '#2a1c18', vento = a.vento || '#bfe8ff', conta = a.conta || '#5a3a2a', pedra = a.pedra || '#9ad8ff';
  const comPano = estiloNovoLigado();                 // estilo novo: o rabo de cavalo é desenhado pela cena, com física
  const { atk, m, by, pose } = tempos(f), passo = m.passo, bx = atk || pose ? 0 : m.braco;
  const estoca = pose === 50, chama = pose === 51, agacha = pose === 52, avanca = pose === 53, noAr = pose === 54, ergue = pose === 55, ombro = pose === 45;
  if (by) p.g.translate(0, by);
  if (agacha) p.g.translate(0, 2);
  if (estoca && dir === DIR.L) p.g.translate(1, 0);                 // estocada: o corpo vai para a frente
  if (avanca && dir === DIR.L) p.g.translate(2, 1);

  // katana: (hx, hy) = a mão no cabo, (tx, ty) = a ponta da lâmina
  const katana = (hx, hy, tx, ty, brilho = false) => {
    const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    p.l(hx - ux * 3, hy - uy * 3, hx, hy, cabo, 1.2);
    p.l(hx + ux * 0.8 - uy * 1.3, hy + uy * 0.8 + ux * 1.3, hx + ux * 0.8 + uy * 1.3, hy + uy * 0.8 - ux * 1.3, guarda, 1);
    p.l(hx + ux * 1.5, hy + uy * 1.5, tx, ty, LAM, 1);
    p.l(hx + ux * 2.5 - uy * 0.6, hy + uy * 2.5 + ux * 0.6, tx - ux * 1.5 - uy * 0.6, ty - uy * 1.5 + ux * 0.6, lamD, 0.6);
    p.px(tx, ty, lamL);
    if (brilho) { p.px(tx + ux, ty + uy, lamL); p.px(tx - uy * 1.5, ty + ux * 1.5, vento); p.px(tx + uy * 1.5, ty - ux * 1.5, vento); }
  };
  const corte = (pts) => { for (let k = 0; k < pts.length - 1; k++) p.l(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], k % 2 ? '#ffffff' : vento, 1); };
  const redemoinho = (x, y) => { p.o(x, y, 3, 3, 'rgba(191,232,255,0.55)'); p.o(x, y, 1.6, 1.6, 'rgba(255,255,255,0.75)'); p.px(x + 3, y - 2, vento); p.px(x - 3, y + 2, vento); p.px(x + 1, y + 3, '#ffffff'); };
  // rabo de cavalo (estilo antigo e Node): parado, caindo para trás
  const raboFixo = (x, y, lado) => {
    const v = m.vento, b = m.balanco;
    const pts = [[x, y], [x - lado * 3, y + 1 - v], [x - lado * 6, y + 4 - v * 1.5 + b], [x - lado * 7, y + 9 - v * 2 + b * 1.5]];
    for (let k = 0; k < pts.length - 1; k++) p.l(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], k ? cab : cabD, k < 2 ? 2.6 : 1.8);
  };
  // braço da espada: de fora, com a braçadeira de couro
  const bracoNu = (x, y, w, h) => { p.r(x, y, w, h, pele); p.r(x, y + h * 0.55, w, h * 0.45, couro); p.r(x, y + h * 0.55, w, 0.7, couroL); };
  // colar de contas com a pedra do vento
  const colar = (pts, px2, py2) => { for (const [x, y] of pts) p.px(x, y, conta); p.r(px2 - 0.5, py2 - 0.5, 1.6, 1.6, pedra); p.px(px2 - 0.5, py2 - 0.5, '#ffffff'); };

  if (dir === DIR.L) {
    const lt = m.liftT, lf = m.liftF;
    if (!comPano) raboFixo(13.5, 4.5, 1);
    // as pontas da faixa de corda balançando atrás
    p.l(12.5, 21.5, 9.5 - m.vento, 25 + m.balanco, faixaD, 1.4); p.l(13.2, 21.8, 11 - m.vento, 26 + m.balanco, faixa, 1);
    // perna de trás e o braço de trás (com a manga do quimono)
    if (agacha || avanca) { p.r(11, 23, 4, 3, calcaD); p.r(10, 26, 4, 2, botas); }
    else { p.poli([[12.5 - passo, 21.5 - lt], [16.5 - passo, 21.5 - lt], [16.5 - passo, 26 - lt], [12.5 - passo, 26 - lt]], calcaD); p.r(12.8 - passo, 25 - lt, 3.4, 1, tom(faixaPerna, 0.8)); p.r(12.5 - passo, 27 - lt, 4.5, 2, tom(botas, 0.85)); }
    if (!chama && !noAr) { p.r(12 - bx, 16, 2.8, 5, Qd); p.r(12 - bx, 20.5, 2.6, 1.6, peleD); }
    // perna da frente: a calça larga
    if (agacha || avanca) { p.r(17, 22, 4.5, 4, calca); p.r(19, 25, 3, 1, faixaPerna); p.r(19, 26, 5, 2, botas); }
    else { p.poli([[15.5 + passo, 21.5 - lf], [20.5 + passo, 21.5 - lf], [20.5 + passo, 26 - lf], [16 + passo, 26 - lf]], calca); p.r(16.5 + passo, 25 - lf, 4, 1, faixaPerna); p.r(16 + passo, 27 - lf, 5, 2, botas); }
    // tronco: quimono azul aberto no peito, faixa de corda com o nó
    p.bola(16, 18, 4.6, 4.2, Q);
    p.poli([[17.6, 14.5], [20.5, 14.5], [18.8, 19.5]], pele); p.l(17.6, 14.5, 18.8, 19.5, Qd); p.r(13, 15.5, 1, 4.5, Ql);
    colar([[17.5, 14.8], [18, 15.6], [18.6, 16.3]], 19.2, 17);
    p.r(11.5, 20.5, 9, 1.8, faixa); p.r(11.5, 21.8, 9, 0.6, faixaD); p.r(18.5, 20.2, 1.6, 2.4, faixaD);
    // a ombreira de aço no ombro de trás (aparece atrás do pescoço)
    p.bola(13.5, 14.6, 2.6, 2, aco); p.r(11.5, 15.8, 4, 0.8, acoD);
    // cabeça: cabelo espetado com franja, cicatriz no nariz, barba por fazer
    p.bola(17, 9.5, 4.3, 4.4, pele);
    if (pose === 44) p.r(19.4, 10, 1.4, 0.8, peleD); else { p.r(19.4, 9.2, 1.3, 1.6, olho); p.px(19.4, 9.2, '#ffffff'); }
    p.l(18.5, 8.2, 20.6, 8.7, cabD);                                    // sobrancelha
    p.l(19.6, 10.4, 21.1, 11.6, '#c07a6a');                             // cicatriz
    p.r(18, 12.6, 3, 1.1, tom(pele, 0.8)); p.px(20.5, 12, peleD);        // barba por fazer
    p.bola(15.8, 6.6, 5, 3.4, cab);
    p.poli([[12.5, 5], [10, 2], [14.5, 3.6]], cab); p.poli([[14.5, 3.4], [14, 0], [16.8, 3]], cab); p.poli([[16.8, 3.2], [18.5, 0.5], [19, 3.8]], cab);     // espetos no alto
    p.poli([[17.5, 5], [22, 7.5], [19.5, 9.4]], cab); p.poli([[19.8, 7], [21.5, 11.5], [19, 9.6]], cab); p.poli([[20.5, 6.5], [22.5, 9], [21, 9.5]], cabD);   // franja no rosto
    p.poli([[12, 6], [10.8, 11.5], [14, 8.5]], cabD);
    p.px(15, 3.5, cabL); p.px(18, 4.5, cabL); p.px(13, 5, cabL);
    p.r(12.6, 3.6, 1.8, 1.8, faixa);                                    // o nó que prende o rabo de cavalo
    // braço da frente (a espada): de fora, com a braçadeira
    if (estoca) {                                        // Q: braço esticado, a katana reta para a frente
      bracoNu(17, 16, 6, 2.6);
      katana(24, 17, 32, 17, true); corte([[25, 15], [29, 14.5], [32, 15.5]]);
    } else if (chama) {                                  // W: a mão aberta para a frente, o vento rodando; a katana para trás
      p.r(17, 15.5, 5, 2.6, pele); p.r(19, 15.5, 3, 2.6, couro); p.r(21.5, 15, 2, 3.5, pele); p.px(23.5, 15, pele); p.px(23.5, 17.5, pele);
      redemoinho(26.5, 16.5);
      katana(12, 18, 5, 23);
    } else if (agacha || avanca) {                       // E: abaixado, a katana para trás, pronta
      bracoNu(16, 16, 4, 2.5); p.r(19.5, 16, 2, 2.4, pele);
      katana(20.5, 17.5, avanca ? 7 : 9, avanca ? 22 : 24);
      if (avanca) corte([[24, 13], [26, 17], [24, 22]]);
    } else if (noAr) {                                   // R: no ar, a katana no alto com as duas mãos
      p.r(16, 8, 3, 8, pele); p.r(16, 12, 3, 3, couro); p.r(19, 9, 2.5, 7, Qd); p.r(16.5, 6.5, 4.5, 2.4, pele);
      katana(18.5, 6.5, 22, -6, true);
    } else if (ergue) {                                  // katana erguida na frente do corpo
      p.r(17, 14, 3, 4, pele); p.r(17, 16, 3, 2, couro); p.r(18.5, 13, 2.4, 2.4, pele);
      katana(19.5, 13.5, 21.5, 1, true);
    } else if (ombro) {                                  // parado: a katana descansando no ombro
      p.r(17, 13, 3, 5, pele); p.r(17, 15.5, 3, 2.2, couro); p.r(17.5, 12.5, 2.4, 2.4, pele);
      katana(18.5, 13, 9, 5);
    } else if (atk === 1) {                              // preparação: a katana sobe atrás da cabeça
      p.r(16, 13, 3, 5, pele); p.r(16, 15.5, 3, 2.2, couro); p.r(16, 12, 2.4, 2.4, pele);
      katana(17, 12.5, 9, 4);
    } else if (atk === 2 || ataque3(atk)) {              // golpe: corte de cima para baixo, na frente
      bracoNu(17, 16, 5, 2.6); p.r(21.5, 16, 2, 2.4, pele);
      if (atk === 2) { katana(22.5, 17, 30, 11); corte([[22, 6], [27, 7], [30, 11]]); }
      else { katana(22.5, 17.5, 30, 24, true); corte([[30, 11], [31.5, 17], [30, 24]]); }
    } else {                                             // parado/andando: a katana baixa, apontando para o chão à frente
      const hx = 17.5 + bx, hy = 21.5 + (atk === 4 ? -1 : 0);
      bracoNu(16 + bx, 16, 2.6, 5); p.r(16.3 + bx, 20.5, 2.4, 2, pele);
      katana(hx, hy, hx + 8, hy + 7);
    }
    return;
  }

  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = atk || pose ? 0 : m.bA, bB = atk || pose ? 0 : m.bB;
  // de frente a katana fica na mão da direita da tela; de costas, na da esquerda. A ombreira, no outro ombro.
  const xm = costas ? 7 : 22, xl = costas ? 22 : 7, lado = costas ? -1 : 1;
  if (!comPano && !costas) { p.l(14, 4, 9 - m.vento, 7 + m.balanco, cabD, 2.6); p.l(9 - m.vento, 7 + m.balanco, 6 - m.vento, 12 + m.balanco, tom(cab, 0.6), 1.8); }
  // pernas com a calça larga, faixas e botas
  const yp = agacha ? 1 : 0;
  for (const [x, l] of [[10.8, lA], [17.5, lB]]) {
    p.poli([[x - 0.5, 21.5 + l], [x + 4.3, 21.5 + l], [x + 4.3, 26 + l - yp], [x, 26 + l - yp]], calca); p.r(x - 0.5, 21.5 + l, 1, 4.5, calcaD);
    p.r(x, 25 + l - yp, 4, 1, faixaPerna); p.r(x - 0.5, 27 + l - yp, 4.5, 2, botas);
  }
  // braço sem a katana: com a manga do quimono (no W, aberto para a frente)
  const yl = costas ? bB : bA, ym = costas ? bA : bB;
  if (chama && !costas) { p.r(xl - 1, 14, 3, 4, Qd); p.r(xl - 1, 12, 3, 2.5, pele); redemoinho(xl, 9); }
  else if (noAr) { p.r(xl + lado * 3, 8, 3, 8, Qd); }
  else { p.r(xl, 16 + yl, 2.8, 5, Qd); p.r(xl, 20.5 + yl, 2.6, 2, pele); }
  // tronco: quimono azul aberto no peito, o colar e a faixa de corda com o nó e as pontas
  p.bola(16, 18, 5.8, 4.4, Q);
  if (!costas) {
    p.poli([[14, 14.5], [18.4, 14.5], [16.2, 19.5]], pele); p.l(14, 14.5, 16.2, 19.5, Qd); p.l(18.4, 14.5, 16.2, 19.5, Qd); p.r(11, 16, 1, 3.5, Ql);
    colar([[14.2, 14.6], [14.8, 15.6], [15.6, 16.4], [16.8, 16.4], [17.6, 15.6], [18.2, 14.6]], 16.2, 17.2);
  } else { p.l(16, 15, 16, 20, Qd); p.r(11, 16, 1, 3.5, Ql); }
  p.r(10.5, 20.5, 11, 1.8, faixa); p.r(10.5, 21.8, 11, 0.6, faixaD);
  const nx = costas ? 18.5 : 13;
  p.r(nx - 0.8, 20.2, 1.8, 2.4, faixaD);
  p.l(nx, 22, nx - lado * 1.5 + m.balanco, 26, faixaD, 1.2); p.l(nx + 0.8, 22, nx + 0.8 - lado * 0.5 + m.balanco, 25.5, faixa, 1);
  // a ombreira de aço no ombro sem a katana
  const xo = costas ? 22.5 : 9.5;
  p.bola(xo, 15.2, 3.4, 2.6, aco); p.r(xo - 3.2, 16.6, 6.4, 0.9, acoD); p.px(xo - lado * 1, 14, acoL); p.r(xo - 1.5, 13.2, 3, 0.8, acoL);
  // cabeça
  p.bola(16, 9.5, 4.8, 4.6, pele);
  if (costas) {
    // cabelo preso: a nuca aparece, as mechas espetadas dos lados e o nó no alto (o rabo vem da cena, por cima)
    p.bola(16, 7.4, 5.3, 4.1, cab); p.r(12, 10, 8, 2.5, cabD);
    p.poli([[11, 7], [9.5, 12], [12.5, 10.5]], cab); p.poli([[21, 7], [22.5, 12], [19.5, 10.5]], cab);
    p.poli([[13, 4], [12, 1], [15, 3]], cab); p.poli([[19, 4], [20, 1], [17, 3]], cab);
    if (!comPano) { const b = m.balanco; p.l(16, 4, 16 + b * 0.5, 12, cab, 3); p.l(16 + b * 0.5, 12, 16 + b, 19, cabD, 2.2); }
    p.px(15, 6.5, cabL); p.r(14.8, 3.2, 2.4, 1.6, faixa);
  } else {
    if (pose === 44) { p.r(13, 10, 2, 1, peleD); p.r(17.5, 10, 2, 1, peleD); }
    else { p.r(13, 9.6, 2, 1.7, olho); p.r(17.5, 9.6, 2, 1.7, olho); p.px(13, 9.6, '#ffffff'); p.px(17.5, 9.6, '#ffffff'); }
    p.l(12.4, 8.5, 15, 9, cabD); p.l(20.1, 8.5, 17.5, 9, cabD);       // sobrancelhas sérias
    p.l(14.6, 10.6, 17.4, 11.6, '#c07a6a');                            // cicatriz atravessando o nariz
    p.r(13.5, 12.7, 5, 1.1, tom(pele, 0.8));                           // barba por fazer
    p.bola(16, 6, 5.8, 2.9, cab);
    // espetos no alto e dos lados, e a franja caindo no meio da testa
    p.poli([[11, 6], [8.5, 3], [12.5, 4]], cab); p.poli([[21, 6], [23.5, 3], [19.5, 4]], cab);
    p.poli([[13, 4], [12.5, 0.5], [15.2, 3]], cab); p.poli([[16.8, 3], [19.5, 0.5], [19, 4]], cab); p.poli([[15, 3], [16, 0], [17, 3]], cabD);
    p.poli([[11, 6], [9.6, 12.5], [12.8, 8.5]], cab); p.poli([[21, 6], [22.4, 12.5], [19.2, 8.5]], cab);
    p.poli([[13.5, 6.5], [14.6, 9.2], [16.2, 7]], cab); p.poli([[16.5, 6.5], [17.8, 9], [19.2, 6.8]], cabD); p.poli([[15.2, 6.8], [16.2, 10.2], [17, 7]], cab);
    p.px(13, 4.5, cabL); p.px(18.5, 4.5, cabL); p.px(16, 2.5, cabL);
  }
  // braço com a katana: de fora, com a braçadeira
  if (noAr) {
    p.r(xm - lado * 3, 7, 3, 9, pele); p.r(xm - lado * 3, 11, 3, 3, couro); p.r(15, 5.5, 3, 2.4, pele);
    katana(16.5, 6, 16.5 + lado * 2, -6, true);
  } else if (estoca && !costas) {
    p.r(xm, 14, 3, 3, pele); p.r(xm, 15.5, 3, 1.5, couro); p.r(xm, 12.5, 2.6, 2.4, pele);
    katana(xm + 1.3, 13, xm + 6, 2, true); corte([[xm + 2, 1], [xm + 6, 0.5], [xm + 8, 3]]);
  } else if (ergue || chama) {
    p.r(xm, 13, 2.6, 4, pele); p.r(xm, 15, 2.6, 2, couro); p.r(xm, 11.5, 2.6, 2.4, pele);
    katana(xm + 1.3, 12, xm + 1.3 + lado * 2, 0, ergue);
  } else if (agacha || avanca) {
    p.r(xm, 17, 2.6, 4, pele); p.r(xm, 19, 2.6, 2, couro); p.r(xm, 20.5, 2.6, 2, pele);
    katana(xm + 1.3, 21.5, xm + 1.3 + lado * 7, 27);
  } else if (ombro) {
    p.r(xm, 13, 2.6, 4, pele); p.r(xm, 15, 2.6, 2, couro); p.r(xm, 12, 2.6, 2.4, pele);
    katana(xm + 1.3, 12.5, xm - lado * 8, 6);
  } else if (atk === 1) {
    p.r(xm, 12, 2.6, 5, pele); p.r(xm, 14.5, 2.6, 2, couro); p.r(xm, 11, 2.6, 2.4, pele);
    katana(xm + 1.3, 11.5, xm + 1.3 + lado * 6, 2);
  } else if (atk === 2 || ataque3(atk)) {
    p.r(xm, 15, 2.6, 4, pele); p.r(xm, 17, 2.6, 2, couro); p.r(xm - lado * 1, 14, 3, 2.4, pele);
    if (costas) katana(xm + 1.3, 14.5, xm - 6, 4);
    else if (atk === 2) { katana(xm + 1.3, 14.5, xm - 7, 6); corte([[xm + 6, 3], [xm, 1.5], [xm - 7, 6]]); }
    else { katana(xm + 1.3, 15, xm - 10, 20, true); corte([[xm - 7, 6], [xm - 11, 13], [xm - 10, 20]]); }
  } else {
    p.r(xm, 16 + ym, 2.6, 5, pele); p.r(xm, 18.5 + ym, 2.6, 2.3, couro); p.r(xm, 20.5 + ym, 2.6, 2, pele);
    katana(xm + 1.3, 21.5 + ym, xm + 1.3 + lado * 6, 28.5 + ym);
  }
}
// Katarina, a Lâmina Sinistra, como no LoL: cabelo vermelho-carmesim comprido (no estilo novo é um pano com física, ver
// pano() no cena.js), a cicatriz no olho esquerdo, olhos verdes, corpete de couro preto com as tiras vermelhas cruzadas,
// a barriga de fora com o cinto de fivelas, a ombreira escura num ombro, luvas e braçadeiras, calça preta com joelheiras,
// botas altas e as duas adagas curvas (uma em cada mão, seguradas ao contrário).
// Poses: 50 arremesso (Q), 51 a adaga jogada para o alto (W), 52 agachada e 53 avançando (E, Shunpo), 54 girando com os
// braços abertos (R, Lótus da Morte), 55 adaga erguida (as outras); 45 girando a adaga na mão (gesto parado)
function katarina(p, a, dir, f) {
  const pele = a.pele, peleD = tom(pele, 0.74), cab = a.cabelo, cabD = tom(cab, 0.7), cabL = tom(cab, 1.35);
  const couro = a.roupa || '#2a2228', couroD = tom(couro, 0.7), couroL = tom(couro, 1.6), tira = a.tira || '#b01c2a', tiraL = tom(tira, 1.3);
  const metal = a.metal || '#8a8e98', metalL = tom(metal, 1.3), calca = a.calca || '#1e1a22', calcaD = tom(calca, 0.72), botas = a.botas || '#2a2228';
  const LAM = a.lamina || '#dfe6ee', lamD = tom(LAM, 0.6), cabo = a.cabo || '#5a1a20', guarda = a.guarda || '#c8a050', olho = a.olho || '#3aa070';
  const brilho = a.brilho || '#ff3a4a';
  const novo = estiloNovoLigado();                    // estilo novo: o cabelo de trás é o pano com física
  const { atk, m, by, pose } = tempos(f), passo = m.passo, bx = atk || pose ? 0 : m.braco;
  const joga = pose === 50, alto = pose === 51, agacha = pose === 52, avanca = pose === 53, lotus = pose === 54, ergue = pose === 55, gira = pose === 45;
  if (by) p.g.translate(0, by);
  if (agacha) p.g.translate(0, 2);
  if (avanca && dir === DIR.L) p.g.translate(2, 1);

  // adaga curva: (hx, hy) a mão no cabo, (tx, ty) a ponta; a lâmina faz uma curvinha para o lado de "curva"
  const adaga = (hx, hy, tx, ty, acesa = false, curva = 1) => {
    const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy * curva, ny = ux * curva;
    p.l(hx - ux * 2, hy - uy * 2, hx, hy, cabo, 1.3);
    p.l(hx + nx * 1.2, hy + ny * 1.2, hx - nx * 1.2, hy - ny * 1.2, guarda, 1);
    const mx = hx + dx * 0.55 + nx * 0.9, my = hy + dy * 0.55 + ny * 0.9;
    p.l(hx + ux, hy + uy, mx, my, LAM, 1.4); p.l(mx, my, tx, ty, LAM, 1);
    p.l(hx + ux * 1.5 - nx * 0.4, hy + uy * 1.5 - ny * 0.4, mx - nx * 0.5, my - ny * 0.5, lamD, 0.6);
    p.px(tx, ty, '#ffffff');
    if (acesa) { p.px(tx + ux, ty + uy, brilho); p.px(mx + nx, my + ny, brilho); }
  };
  const risco = (pts) => { for (let k = 0; k < pts.length - 1; k++) p.l(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], k % 2 ? '#ffffff' : brilho, 1); };
  // braço com a luva e a braçadeira de couro
  const braco = (x, y, w, h) => { p.r(x, y, w, h, pele); p.r(x, y + h * 0.5, w, h * 0.5, couro); p.r(x, y + h * 0.5, w, 0.6, couroL); };

  if (dir === DIR.L) {
    const lt = m.liftT, lf = m.liftF;
    // cabelo comprido caindo nas costas (estilo antigo; no novo é o pano)
    if (!novo) p.poli([[12, 6], [9, 20], [12.5, 21.5], [14.5, 9]], cabD);
    // perna de trás e o braço de trás (com a outra adaga)
    if (agacha || avanca) { p.r(11, 23, 4, 3, calcaD); p.r(10, 26, 4.5, 2, tom(botas, 0.85)); }
    else { p.r(12.8 - passo, 21.5 - lt, 3.2, 4.5, calcaD); p.r(12.5 - passo, 25.5 - lt, 3.8, 3.5, tom(botas, 0.85)); }
    if (!lotus && !alto) { braco(11.8 - bx, 15.8, 2.6, 5); adaga(13 - bx, 21, 9 - bx, 24, false, -1); }
    // perna da frente: calça justa, joelheira e bota alta
    if (agacha || avanca) { p.r(17, 22, 4.5, 3.5, calca); p.r(19.5, 22.5, 1.6, 1.6, metal); p.r(19, 25, 5, 3, botas); }
    else { p.r(16 + passo, 21.5 - lf, 3.4, 4.5, calca); p.r(17.8 + passo, 22.8 - lf, 1.6, 1.6, metal); p.r(15.8 + passo, 25.5 - lf, 4.4, 3.5, botas); p.r(15.8 + passo, 25.5 - lf, 4.4, 0.7, couroL); }
    // tronco: o corpete preto com as tiras vermelhas, a barriga de fora e o cinto de fivelas
    p.bola(16, 16.8, 4.3, 3.6, couro);
    p.r(13.5, 18.8, 5.6, 1.6, pele); p.r(13.5, 18.8, 5.6, 0.5, peleD);
    p.l(13.5, 14, 18.6, 18.4, tira, 0.9); p.l(18.6, 14.2, 14.2, 18.3, tira, 0.7);
    p.r(12.6, 20.3, 7.8, 1.5, couroD); p.r(17.4, 20.2, 1.4, 1.7, guarda); p.r(14, 20.6, 1, 1, metal);
    // a ombreira escura no ombro de trás
    p.bola(13.6, 14.6, 2.5, 1.9, couroD); p.r(11.8, 15.6, 3.8, 0.7, metal);
    // cabeça: olho verde, a cicatriz vertical, cabelo vermelho com a franja de lado
    p.bola(17, 9.5, 4.3, 4.4, pele);
    if (pose === 44) p.r(19.4, 10, 1.3, 0.8, peleD); else { p.r(19.4, 9.2, 1.3, 1.6, olho); p.px(19.4, 9.2, '#ffffff'); }
    p.l(18.6, 8.4, 20.6, 8.6, cabD); p.px(20.4, 12.2, '#c0505a');                       // sobrancelha e a boca vermelha
    p.bola(15.6, 6.6, 5.1, 3.4, cab);
    p.poli([[17, 4.5], [21.6, 6.4], [21, 9.2], [18.6, 7.4]], cab); p.px(20.6, 8.8, cabD);   // franja na testa
    p.poli([[12, 5.5], [10, 12], [13.5, 9]], cab); p.poli([[13.8, 9.5], [12.6, 16], [14.4, 15.4], [15.6, 10.5]], cab);
    p.l(13.2, 10.5, 12.8, 15.2, cabD); p.px(14.5, 3.8, cabL); p.px(17.5, 4, cabL); p.px(12.8, 6.8, cabL);
    // braço da frente com a adaga
    if (joga) {                                           // Q: o braço esticado, a adaga saindo para a frente
      braco(17, 16, 6, 2.6); p.r(22.5, 16, 1.6, 2.4, pele);
      adaga(24, 17, 31, 15.5, true); risco([[24, 14.5], [28, 14], [31, 15]]);
    } else if (alto) {                                    // W: a adaga jogada para o alto, girando
      p.r(17, 8, 2.6, 8, pele); p.r(17, 12, 2.6, 3, couro); p.r(17.2, 6.8, 2.2, 1.8, pele);
      adaga(19, -2, 22, -6, true); adaga(13, 18, 9, 22, false, -1);
    } else if (agacha || avanca) {                        // E: abaixada, as adagas para trás, pronta para o golpe
      braco(16, 16, 4, 2.5); p.r(19.5, 16, 1.8, 2.4, pele);
      adaga(20.5, 17.5, avanca ? 10 : 12, avanca ? 21 : 23, avanca);
      if (avanca) risco([[24, 12], [27, 17], [24, 22]]);
    } else if (lotus) {                                   // R: girando, os dois braços abertos com as adagas para fora
      p.r(17, 15, 7, 2.4, pele); p.r(20, 15, 4, 2.4, couro); adaga(24, 16, 31, 13, true);
      p.r(9, 15, 7, 2.4, peleD); adaga(9, 16, 2, 19, true, -1);
      risco([[26, 10], [30, 12], [31, 17]]); risco([[6, 21], [2, 18], [3, 13]]);
    } else if (ergue) {                                   // adaga erguida na frente do corpo
      p.r(17, 13, 2.6, 4.5, pele); p.r(17, 15.5, 2.6, 2, couro); p.r(17.2, 12, 2.2, 2, pele);
      adaga(18.4, 12.5, 20, 4, true);
    } else if (gira) {                                    // parada: a adaga girando na mão, na altura do peito
      braco(16, 15, 4, 2.5); p.r(19.5, 15, 1.8, 2.4, pele);
      const ang = (f % 4) * (Math.PI / 2); adaga(20.5, 16, 20.5 + Math.cos(ang) * 5, 16 + Math.sin(ang) * 5, true);
    } else if (atk === 1) {                               // preparação: a adaga sobe para trás
      p.r(16, 13, 2.6, 5, pele); p.r(16, 15.5, 2.6, 2.2, couro); p.r(16, 12, 2.2, 2, pele);
      adaga(17, 12.5, 11, 6);
    } else if (atk === 2 || atk === 3) {                  // golpe: corte em X na frente
      braco(17, 16, 5, 2.6); p.r(21.5, 16, 1.8, 2.4, pele);
      if (atk === 2) { adaga(22.5, 17, 29, 11, true); risco([[22, 8], [27, 9], [29, 12]]); }
      else { adaga(22.5, 17.5, 29, 23, true); risco([[29, 12], [30.5, 17], [29, 23]]); }
    } else {                                              // parada/andando: a adaga ao contrário, a ponta para trás
      const hx = 17.5 + bx, hy = 21 + (atk === 4 ? -1 : 0);
      braco(16 + bx, 16, 2.6, 5); p.r(16.2 + bx, 20, 2.2, 1.8, pele);
      adaga(hx, hy, hx - 5, hy + 4, false, -1);
    }
    return;
  }

  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = atk || pose ? 0 : m.bA, bB = atk || pose ? 0 : m.bB;
  const xm = costas ? 7 : 22, xl = costas ? 22 : 7, lado = costas ? -1 : 1;
  // cabelo comprido atrás (estilo antigo): de costas cobre as costas, de frente aparece dos lados
  if (!novo) { if (costas) p.poli([[10.5, 8], [21.5, 8], [22.5, 21], [9.5, 21]], cabD); else { p.poli([[10.5, 8], [8.4, 20], [11, 20.5], [12, 10]], cabD); p.poli([[21.5, 8], [23.6, 20], [21, 20.5], [20, 10]], cabD); } }
  // pernas: calça justa preta, joelheiras de metal e botas altas
  const yp = agacha ? 1 : 0;
  for (const [x, l] of [[12, lA], [17, lB]]) {
    p.r(x, 21.5 + l, 3.2, 4.5 - yp, calca); p.r(x, 21.5 + l, 0.8, 4.5 - yp, calcaD); p.r(x + 0.6, 22.6 + l, 1.8, 1.4, metal);
    p.r(x - 0.4, 25.5 + l - yp, 4, 3.5, botas); p.r(x - 0.4, 25.5 + l - yp, 4, 0.7, couroL);
  }
  // o braço com a outra adaga
  const yl = costas ? bB : bA, ym = costas ? bA : bB;
  if (lotus) { p.r(xl - lado * 6, 15, 7, 2.4, peleD); adaga(xl - lado * 5, 16, xl - lado * 12, 19, true, -lado); }
  else if (alto && !costas) { p.r(xl, 16 + yl, 2.6, 5, pele); p.r(xl, 18.5 + yl, 2.6, 2.3, couro); adaga(xl + 1.3, 21 + yl, xl - 3, 25 + yl, false, -1); }
  else { p.r(xl, 16 + yl, 2.6, 5, pele); p.r(xl, 18.5 + yl, 2.6, 2.3, couro); p.r(xl, 20.5 + yl, 2.6, 1.6, peleD); adaga(xl + 1.3, 21.5 + yl, xl + 1.3 - lado * 4, 26 + yl, false, -lado); }
  // tronco: corpete preto com as tiras vermelhas cruzadas, a barriga de fora e o cinto
  p.bola(16, 16.6, 5.4, 3.8, couro);
  if (!costas) {
    p.r(13, 18.8, 6, 1.6, pele); p.r(13, 18.8, 6, 0.5, peleD);
    p.l(11.5, 14.2, 19.5, 18.4, tira, 1); p.l(20.5, 14.2, 12.5, 18.4, tira, 0.8); p.px(16, 16.3, tiraL);
  } else { p.l(12, 14.5, 20, 18, tira, 0.8); p.l(20, 14.5, 12, 18, tira, 0.8); }
  p.r(11, 20.3, 10, 1.5, couroD); p.r(15.2, 20.2, 1.6, 1.7, guarda); p.r(12.2, 20.6, 1, 1, metal); p.r(19, 20.6, 1, 1, metal);
  // a ombreira escura no ombro da adaga de trás
  const xo = costas ? 22.4 : 9.6;
  p.bola(xo, 15, 3, 2.2, couroD); p.r(xo - 2.6, 16.2, 5.2, 0.8, metal); p.px(xo - lado, 14, couroL);
  // cabeça
  p.bola(16, 9.5, 4.8, 4.6, pele);
  if (costas) {
    p.bola(16, 8.4, 5.4, 4.9, cab); p.bola(16, 11.6, 4.8, 2.4, cab);
    p.l(13, 6, 12.6, 12, cabD); p.l(19, 6, 19.4, 12, cabD); p.l(16, 4.5, 16, 12.5, cabL);
  } else {
    if (pose === 44) { p.r(13, 10, 2, 1, peleD); p.r(17.5, 10, 2, 1, peleD); }
    else { p.r(13, 9.6, 2, 1.7, olho); p.r(17.5, 9.6, 2, 1.7, olho); p.px(13, 9.6, '#ffffff'); p.px(17.5, 9.6, '#ffffff'); }
    p.l(12.4, 8.6, 15, 8.9, cabD); p.l(20.1, 8.6, 17.5, 8.9, cabD);
    p.l(14, 7.8, 14.4, 12, '#c0505a', 0.7);                             // a cicatriz no olho esquerdo
    p.r(15.2, 12.8, 1.8, 0.6, '#b8404a');                              // boca
    // topo e a franja grande de lado, mechas compridas emoldurando o rosto
    p.bola(16, 6, 5.8, 3, cab);
    p.poli([[10.5, 6], [17.5, 4.4], [20.5, 7.6], [16.8, 6.8], [14, 8], [11.2, 8.8]], cab);
    p.l(12, 6.6, 16.6, 5.2, cabL); p.l(17, 5.6, 19.6, 7.6, cabD);
    p.poli([[11, 6.5], [9, 17], [11.2, 17.6], [12.6, 10]], cab); p.poli([[21, 6.5], [23, 17], [20.8, 17.6], [19.4, 10]], cab);
    p.l(10.6, 9, 10, 16.5, cabD); p.l(21.4, 9, 22, 16.5, cabD); p.px(9.6, 17.2, cabL); p.px(22.4, 17.2, cabL);
  }
  p.px(13, 4.6, cabL); p.px(18.5, 4.6, cabL);
  // braço com a adaga principal
  if (lotus) {
    p.r(lado > 0 ? xm : xm - 6, 15, 7, 2.4, pele); p.r(lado > 0 ? xm + 3 : xm - 6, 15, 4, 2.4, couro);
    adaga(xm + lado * 5, 16, xm + lado * 12, 13, true, lado);
    risco([[xm + lado * 8, 9], [xm + lado * 12, 12], [xm + lado * 11, 18]]);
  } else if (joga && !costas) {
    p.r(xm, 14, 2.6, 3, pele); p.r(xm, 15.5, 2.6, 1.5, couro); p.r(xm, 12.5, 2.4, 2, pele);
    adaga(xm + 1.2, 13, xm + 6, 3, true); risco([[xm + 2, 2], [xm + 6, 1], [xm + 8, 4]]);
  } else if (alto) {
    p.r(xm, 9, 2.6, 7, pele); p.r(xm, 12.5, 2.6, 2.5, couro); p.r(xm, 7.6, 2.4, 2, pele);
    adaga(xm + 1.2 + lado, -1, xm + 1.2 + lado * 4, -5, true);
  } else if (ergue || gira) {
    p.r(xm, 13, 2.6, 4, pele); p.r(xm, 15, 2.6, 2, couro); p.r(xm, 11.6, 2.4, 2, pele);
    if (gira) { const ang = (f % 4) * (Math.PI / 2); adaga(xm + 1.2, 12, xm + 1.2 + Math.cos(ang) * 5, 12 + Math.sin(ang) * 5, true); }
    else adaga(xm + 1.2, 12, xm + 1.2 + lado * 2, 3, true);
  } else if (agacha || avanca) {
    p.r(xm, 17, 2.6, 4, pele); p.r(xm, 19, 2.6, 2, couro); p.r(xm, 20.5, 2.4, 2, pele);
    adaga(xm + 1.2, 21.5, xm + 1.2 + lado * 7, 26, avanca);
  } else if (atk === 1) {
    p.r(xm, 12, 2.6, 5, pele); p.r(xm, 14.5, 2.6, 2, couro); p.r(xm, 11, 2.4, 2, pele);
    adaga(xm + 1.2, 11.5, xm + 1.2 + lado * 5, 3);
  } else if (atk === 2 || atk === 3) {
    p.r(xm, 15, 2.6, 4, pele); p.r(xm, 17, 2.6, 2, couro); p.r(xm - lado, 14, 2.8, 2.2, pele);
    if (costas) adaga(xm + 1.2, 14.5, xm - 5, 6, true);
    else if (atk === 2) { adaga(xm + 1.2, 14.5, xm - 6, 7, true); risco([[xm + 5, 4], [xm, 2.5], [xm - 6, 7]]); }
    else { adaga(xm + 1.2, 15, xm - 8, 20, true); risco([[xm - 6, 7], [xm - 9, 13], [xm - 8, 20]]); }
  } else {
    p.r(xm, 16 + ym, 2.6, 5, pele); p.r(xm, 18.5 + ym, 2.6, 2.3, couro); p.r(xm, 20.5 + ym, 2.6, 1.6, pele);
    adaga(xm + 1.3, 21.5 + ym, xm + 1.3 + lado * 4, 26 + ym, false, lado);
  }
}

// Taric: armadura dourada pesada com as joias azuis, ombreiras grandes, a faixa azul, o diadema com a joia na testa,
// o cabelo comprido ondulado (no estilo novo é o pano com física) e o martelo com a cabeça de cristal.
// Poses: 50 a mão erguida com a luz das estrelas (Q), 51 o martelo atravessado na frente como escudo (W), 52 a mão
// apontando o feixe (E), 53 o martelo acima da cabeça (salto do Martelo Celestial), 54 os dois braços para o céu (R),
// 55 o martelo erguido, 45 o martelo apoiado no ombro (parado)
function taric(p, a, dir, f) {
  const pele = a.pele, peleD = tom(pele, 0.76), cab = a.cabelo, cabD = tom(cab, 0.7), cabL = tom(cab, 1.35);
  const ouro = a.ouro || '#e2b44a', ouroD = tom(ouro, 0.66), ouroL = tom(ouro, 1.3), azul = a.azul || '#2a6ab8', azulD = tom(azul, 0.7), azulL = tom(azul, 1.35);
  const joia = a.joia || '#4ae0e8', joiaL = tom(joia, 1.4), calca = a.calca || '#2a3a6a', calcaD = tom(calca, 0.72), botas = a.botas || '#b88a3a';
  const cabo = a.cabo || '#7a5a3a', cristal = a.cristal || '#6af0ff', cristalD = tom(cristal, 0.62), olho = a.olho || '#3a8ae8';
  const novo = estiloNovoLigado();
  const { atk, m, by, pose } = tempos(f), passo = m.passo, bx = atk || pose ? 0 : m.braco;
  const luz = pose === 50, guarda = pose === 51, aponta = pose === 52, salto = pose === 53, ceu = pose === 54, ergue = pose === 55, ombro = pose === 45;
  if (by) p.g.translate(0, by);
  if (salto && dir === DIR.L) p.g.translate(0, -1);

  // o martelo: (hx, hy) a mão no cabo, (tx, ty) o meio da cabeça de cristal, atravessada no cabo
  const martelo = (hx, hy, tx, ty, aceso = false) => {
    const dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    p.l(hx - ux * 2.5, hy - uy * 2.5, tx, ty, cabo, 1.3);
    p.px(hx - ux * 2.8, hy - uy * 2.8, ouro);
    p.l(tx - ux * 1.6 + nx * 1.6, ty - uy * 1.6 + ny * 1.6, tx - ux * 1.6 - nx * 1.6, ty - uy * 1.6 - ny * 1.6, ouro, 1.2);
    // a cabeça: um cristal lapidado, mais comprido para os lados
    const c = (s, t) => [tx + nx * s + ux * t, ty + ny * s + uy * t];
    p.poli([c(-3.4, 0), c(-2.4, -1.6), c(2.4, -1.6), c(3.4, 0), c(2.4, 1.8), c(-2.4, 1.8)], cristalD);
    p.poli([c(-2.6, 0), c(-1.8, -1.1), c(1.8, -1.1), c(2.6, 0), c(1.8, 1.2), c(-1.8, 1.2)], cristal);
    p.l(c(-1.8, -0.6)[0], c(-1.8, -0.6)[1], c(1.6, -0.6)[0], c(1.6, -0.6)[1], '#ffffff', 0.6);
    p.px(c(0, 2.2)[0], c(0, 2.2)[1], ouro);
    if (aceso) { p.px(c(3.6, -1)[0], c(3.6, -1)[1], '#ffffff'); p.px(c(-3.6, 1)[0], c(-3.6, 1)[1], joiaL); }
  };
  // a manopla dourada (mão fechada) e a mão aberta com a luz
  const luva = (x, y) => { p.r(x, y, 2.6, 2.2, ouro); p.r(x, y, 2.6, 0.6, ouroL); };
  const estrela = (x, y, c = joiaL) => { p.px(x, y, '#ffffff'); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); };
  const gema = (x, y, r = 1.3) => { p.bola(x, y, r + 0.5, r + 0.4, ouroD); p.bola(x, y, r, r, joia); p.px(x - r * 0.4, y - r * 0.4, '#ffffff'); };

  if (dir === DIR.L) {
    const lt = m.liftT, lf = m.liftF;
    if (!novo) p.poli([[11.5, 6], [9.5, 19], [12.8, 20.5], [14.5, 9]], cabD);
    // perna de trás e o braço de trás (manopla)
    p.r(12.6 - passo, 21.5 - lt, 3.6, 4.5, calcaD); p.r(12.2 - passo, 25.5 - lt, 4.2, 3.5, tom(botas, 0.8));
    if (ceu) { p.r(12, 7, 2.6, 8, peleD); luva(11.8, 5); }
    else if (!salto && !guarda) { p.r(11.8 - bx, 15.8, 2.8, 4.5, ouroD); p.r(11.8 - bx, 19.6, 2.8, 1.8, peleD); }
    // perna da frente: grevas douradas e a bota
    p.r(16 + passo, 21.5 - lf, 3.8, 4.5, calca); p.r(16.2 + passo, 22.2 - lf, 3.4, 2.2, ouro); p.r(16.2 + passo, 22.2 - lf, 3.4, 0.6, ouroL);
    p.r(15.6 + passo, 25.5 - lf, 4.8, 3.5, botas); p.r(15.6 + passo, 25.5 - lf, 4.8, 0.7, ouroL);
    // tronco: o peitoral dourado largo com a joia, a faixa azul e as abas da saia
    p.bola(16.2, 16.8, 5, 4, ouro); p.bola(17.6, 15.6, 2.6, 2, ouroL);
    p.r(12, 20, 9, 1.6, azul); p.r(12, 20, 9, 0.5, azulL);
    p.poli([[17, 21.4], [21.4, 21.4], [21, 24], [17.6, 24]], azul); p.l(19.2, 21.6, 19.2, 23.8, azulD);
    p.poli([[11.6, 21.4], [15, 21.4], [14.4, 23.6], [11.4, 23]], azulD);
    gema(19.4, 16.4, 1.4);
    // a ombreira grande no ombro de trás, com a joia
    p.bola(13.6, 13.8, 3.4, 2.6, ouro); p.bola(13.6, 13.2, 2.4, 1.5, ouroL); p.r(10.6, 15.2, 6, 0.9, ouroD); gema(13.4, 13.6, 0.8);
    // cabeça: maxilar forte, olho, o diadema dourado com a joia e o cabelo ondulado
    p.bola(17, 9.5, 4.3, 4.5, pele); p.r(17.5, 12.2, 3.4, 1.6, pele); p.r(17.5, 13.4, 3.4, 0.5, peleD);
    if (pose === 44) p.r(19.4, 9.8, 1.4, 0.7, peleD); else { p.r(19.4, 9, 1.4, 1.5, olho); p.px(19.4, 9, '#ffffff'); }
    p.l(18.6, 8, 20.8, 8.2, cabD); p.r(20, 12.2, 1.2, 0.5, '#9a5a4a');
    p.px(21.2, 10.4, pele); p.px(21.2, 11, peleD);
    p.bola(14.8, 6.6, 4.6, 3.2, cab); p.poli([[16, 4.2], [19.6, 5.2], [17.6, 6.6], [15, 7]], cab); p.poli([[11.4, 6], [10.2, 13], [13.4, 15.6], [15.2, 9.6]], cab);
    p.l(11.8, 8, 11.6, 13, cabD); p.l(13.2, 9.5, 13, 14.6, cabD); p.px(13.5, 4, cabL); p.px(16.5, 3.8, cabL); p.px(11.6, 7.2, cabL);
    p.l(13.5, 6.6, 21, 6.6, ouro, 1); p.px(20.6, 6.2, joia); p.px(20.6, 6.9, joiaL);
    // braço da frente
    if (luz) {                                     // Q: a mão aberta erguida, a luz das estrelas
      p.r(17.6, 7, 2.8, 8.5, ouro); p.r(17.6, 10.6, 2.8, 0.7, ouroD); p.r(17.8, 4.6, 2.4, 2.6, pele);
      estrela(19, 2.6); p.px(16.4, 1.2, joiaL); p.px(21.6, 1.6, joiaL);
      martelo(12.4, 20, 9, 24.5);
    } else if (guarda) {                           // W: o martelo atravessado na frente do corpo, como escudo
      p.r(17, 15, 5, 2.6, ouro); luva(21.4, 14.8); p.r(12.4, 16, 2.8, 2.6, ouroD); luva(12.6, 18.2);
      martelo(22.6, 16, 22.6, 6, true);
    } else if (aponta) {                           // E: o braço esticado, apontando o feixe
      p.r(17.4, 15.4, 6, 2.6, ouro); p.r(17.4, 15.4, 6, 0.6, ouroL); p.r(23, 15.6, 2, 2.2, pele); p.px(25.2, 16.2, pele);
      estrela(27, 16.4); martelo(12.6, 20.4, 9, 25);
    } else if (salto) {                            // M: o martelo acima da cabeça, com as duas mãos
      p.r(18.6, 4.6, 2.4, 10, ouro); p.r(18.6, 9, 2.4, 0.6, ouroD); luva(18.4, 3);
      martelo(19.6, 3.6, 11, 2, true);
    } else if (ceu) {                              // R: os dois braços para o céu
      p.r(18, 4, 2.6, 11, ouro); p.r(18, 9, 2.6, 0.7, ouroD); luva(18, 2);
      estrela(19.2, 0); estrela(12.8, 3);
      martelo(14, 22, 10, 26.5);
    } else if (ergue) {                            // o martelo erguido na frente
      p.r(17.4, 12, 2.8, 5, ouro); luva(17.4, 10.6);
      martelo(18.6, 11.6, 19.6, 2.5, true);
    } else if (ombro) {                            // parado: o martelo apoiado no ombro
      p.r(17, 14, 3, 4, ouro); luva(17.2, 13);
      martelo(18.4, 14, 11.5, 6.5);
    } else if (atk === 1) {                        // preparação: o martelo sobe para trás
      p.r(16, 12.5, 2.8, 5, ouro); luva(16, 11);
      martelo(17.2, 11.8, 10.5, 4);
    } else if (atk === 2 || atk === 3) {           // golpe: o martelo desce na frente
      p.r(17, 15.4, 5, 2.6, ouro); luva(21.4, 15.2);
      if (atk === 2) martelo(22.6, 16.4, 28, 10, true); else martelo(22.6, 16.6, 28.5, 22, true);
    } else {                                       // andando/parado: o martelo pendurado na mão, a cabeça embaixo
      const hx = 17.4 + bx, hy = 20.6 + (atk === 4 ? -1 : 0);
      p.r(16 + bx, 15.6, 2.8, 4.5, ouro); p.r(16 + bx, 15.6, 2.8, 0.6, ouroL); luva(16 + bx, 19.6);
      martelo(hx, hy, hx + 2.5, hy + 6.5);
    }
    return;
  }

  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = atk || pose ? 0 : m.bA, bB = atk || pose ? 0 : m.bB;
  const xm = costas ? 7 : 22.4, xl = costas ? 22.4 : 7, lado = costas ? -1 : 1;
  if (!novo) { if (costas) p.poli([[10.5, 8], [21.5, 8], [22, 19], [10, 19]], cabD); else { p.poli([[10.5, 8], [8.6, 18], [11, 18.6], [12, 10]], cabD); p.poli([[21.5, 8], [23.4, 18], [21, 18.6], [20, 10]], cabD); } }
  // pernas: grevas douradas e botas
  for (const [x, l] of [[11.6, lA], [16.8, lB]]) {
    p.r(x, 21.5 + l, 3.6, 4.5, calca); p.r(x + 0.2, 22.2 + l, 3.2, 2.2, ouro); p.r(x + 0.2, 22.2 + l, 3.2, 0.6, ouroL);
    p.r(x - 0.4, 25.5 + l, 4.4, 3.5, botas); p.r(x - 0.4, 25.5 + l, 4.4, 0.7, ouroL);
  }
  // o braço de trás (manopla)
  const yl = costas ? bB : bA, ym = costas ? bA : bB;
  if (ceu || salto) { p.r(xl, 4, 2.8, 11, ouroD); luva(xl, 2.4); if (ceu) estrela(xl + 1.3, 0.4); }
  else { p.r(xl, 15.8 + yl, 2.8, 4.5, ouroD); luva(xl, 19.8 + yl); }
  // tronco: o peitoral largo, a joia no peito, a faixa azul e as abas
  p.bola(16, 16.6, 6, 4.2, ouro);
  if (!costas) {
    p.bola(16, 15.4, 3.6, 2.2, ouroL); p.l(16, 13, 16, 19.6, ouroD); gema(16, 16.2, 1.8);
  } else { p.l(12, 14.4, 20, 14.4, ouroD); p.l(16, 13, 16, 19.6, ouroD); }
  p.r(10.4, 20, 11.2, 1.6, azul); p.r(10.4, 20, 11.2, 0.5, azulL);
  if (!costas) { p.poli([[13.6, 21.4], [18.4, 21.4], [17.6, 24.4], [14.4, 24.4]], azul); p.l(16, 21.6, 16, 24.2, azulD); }
  else p.poli([[11, 21.4], [21, 21.4], [20.4, 24], [11.6, 24]], azulD);
  // as duas ombreiras grandes, com joias
  for (const xo of [9.4, 22.6]) { p.bola(xo, 14, 3.4, 2.6, ouro); p.bola(xo, 13.4, 2.4, 1.5, ouroL); p.r(xo - 3, 15.4, 6, 0.9, ouroD); if (!costas) gema(xo, 13.8, 0.8); }
  // cabeça
  p.bola(16, 9.5, 4.6, 4.6, pele);
  if (costas) {
    p.bola(16, 8.2, 5.4, 4.8, cab); p.bola(16, 12.2, 5, 2.6, cab);
    p.l(13, 6, 12.6, 13.6, cabD); p.l(19, 6, 19.4, 13.6, cabD); p.l(16, 4.5, 16, 13.8, cabL);
    p.l(11, 7.4, 21, 7.4, ouro, 1);
  } else {
    p.r(13.2, 11.6, 5.6, 2, pele); p.r(13.2, 13.2, 5.6, 0.5, peleD);
    if (pose === 44) { p.r(13, 10, 2, 0.8, peleD); p.r(17.2, 10, 2, 0.8, peleD); }
    else { p.r(13, 9.4, 2, 1.6, olho); p.r(17.2, 9.4, 2, 1.6, olho); p.px(13, 9.4, '#ffffff'); p.px(17.2, 9.4, '#ffffff'); }
    p.l(12.4, 8.4, 15, 8.6, cabD); p.l(19.8, 8.4, 17.2, 8.6, cabD); p.r(15, 12.6, 2.2, 0.5, '#9a5a4a');
    // o cabelo repartido no meio, caindo dos lados do rosto, e o diadema com a joia na testa
    p.bola(16, 5.8, 5.6, 2.8, cab);
    p.poli([[10.6, 6], [8.8, 15.6], [11.2, 16.4], [12.4, 9]], cab); p.poli([[21.4, 6], [23.2, 15.6], [20.8, 16.4], [19.6, 9]], cab);
    p.l(10.4, 9, 9.8, 15, cabD); p.l(21.6, 9, 22.2, 15, cabD); p.px(13.4, 4.4, cabL); p.px(18.4, 4.4, cabL); p.l(16, 3.6, 16, 5.4, cabD);
    p.l(11.2, 7, 20.8, 7, ouro, 1); p.r(15.2, 6.2, 1.6, 1.8, joia); p.px(15.4, 6.4, '#ffffff');
  }
  // braço da frente
  if (luz && !costas) {
    p.r(xm, 6.6, 2.8, 9, ouro); p.r(xm, 4.4, 2.4, 2.4, pele); estrela(xm + 1.2, 2.4); p.px(xm - 2, 1, joiaL); p.px(xm + 4, 1.4, joiaL);
  } else if (guarda) {
    p.r(xm - lado * 2, 15.5, 2.8, 3, ouro); luva(xm - lado * 2, 17.6);
    martelo(16 - lado * 6, 19, 16 + lado * 6, 19, true);
  } else if (aponta && !costas) {
    p.r(xm, 13.6, 2.8, 4.4, ouro); p.r(xm - 0.2, 12, 2.6, 2, pele); estrela(xm + 1.2, 10.4);
  } else if (salto) {
    p.r(xm, 4, 2.8, 11, ouro); luva(xm, 2.4); martelo(16, 2, 16 + lado * 1, -3, true);
  } else if (ceu) {
    p.r(xm, 4, 2.8, 11, ouro); luva(xm, 2.4); estrela(xm + 1.3, 0.4);
  } else if (ergue || (luz && costas) || (aponta && costas)) {
    p.r(xm, 12.6, 2.8, 4.5, ouro); luva(xm, 11); martelo(xm + 1.3, 11.6, xm + 1.3 + lado * 2, 2.6, true);
  } else if (ombro) {
    p.r(xm, 13.4, 2.8, 4, ouro); luva(xm, 12.4); martelo(xm + 1.3, 13.2, xm - lado * 5, 6.5);
  } else if (atk === 1) {
    p.r(xm, 12, 2.8, 5, ouro); luva(xm, 10.6); martelo(xm + 1.3, 11.4, xm + 1.3 + lado * 4, 3);
  } else if (atk === 2 || atk === 3) {
    p.r(xm, 15, 2.8, 4, ouro); luva(xm - lado, 14);
    if (costas) martelo(xm + 1.2, 14.6, xm - 4, 7, true);
    else if (atk === 2) martelo(xm + 1.2, 14.6, xm - 5, 8, true); else martelo(xm + 1.2, 15, xm - 6, 22, true);
  } else {
    p.r(xm, 15.8 + ym, 2.8, 4.5, ouro); p.r(xm, 15.8 + ym, 2.8, 0.6, ouroL); luva(xm, 19.8 + ym);
    martelo(xm + 1.3, 21 + ym, xm + 1.3 + lado * 2.5, 27 + ym);
  }
}

// Zac: a gelatina verde de Zaun. Corpo largo e curvado para a frente, a cabeça baixa entre os ombros, os olhos amarelos
// bravos e o sorriso de dentes, a "antena" de gosma que sai do alto da cabeça e cai na frente do rosto, os braços compridos
// com as mãos quase no chão, pernas curtas e grossas, o "esqueleto" escuro aparecendo por dentro e a faixa de contenção.
// Respira inflando e desinflando (40 a 43), anda quicando (20 a 27: o corpo achata no apoio e estica no passo).
// Poses: 50 o braço da frente esticado (Q, A; o braço comprido é da cena), 51 inflado de braços abertos (W, F, M),
// 52 achatado para trás com as mãos cravadas no chão (carga do E), 53 a bola esticada no ar (voo do E, N), 54 a bola
// achatada (quique do R), 55 as mãos batendo no chão (T), 45 balançando parado
function zac(p, a, dir, f) {
  const cor = a.corpo || '#5fcf3a', corD = a.sombra || tom(cor, 0.6), corL = a.brilho || tom(cor, 1.35), corM = tom(cor, 0.82);
  const nuc = a.nucleo || 'rgba(16,64,12,0.5)', olho = a.olho || '#f2e94a', boca = a.boca || '#12280c', dente = a.dente || '#eef6d8';
  const faixa = a.faixa, metal = a.metal || '#9aa0aa';
  const { atk, m, pose } = tempos(f);
  const anda = f >= 20 && f <= 27, ph = anda ? ((f - 20) / 8) * Math.PI * 2 : 0;
  // respirando (40 a 43) o corpo infla; andando, achata no apoio e estica no meio do passo; 45 balança de lado
  const infl = f >= 40 && f <= 43 ? [0, 0.5, 1, 0.5][f - 40] : 0;
  const quica = anda ? Math.cos(ph * 2) : 0, sx = 1 + 0.06 * quica + 0.05 * infl, sy = 1 - 0.07 * quica + 0.04 * infl;
  const bob = anda ? Math.abs(Math.sin(ph)) * -1.2 : 0, tor = pose === 45 ? 1 : 0;
  const passo = m.passo * 0.8, bx = atk || pose ? 0 : m.braco * 0.9;
  const fechado = pose === 44;
  // a gelatina: a bola com a sombra e o brilho, e um reflexo de vidro em cima
  const gel = (cx, cy, rx, ry, c = cor) => { p.bola(cx, cy, rx, ry, c); p.o(cx - rx * 0.32, cy - ry * 0.52, Math.max(0.8, rx * 0.32), Math.max(0.6, ry * 0.16), tom(c, 1.5)); };
  const mao = (x, y, rx = 2.7, ry = 2.5, c = cor) => { p.bola(x, y, rx, ry, c); p.px(x - rx * 0.4, y - ry * 0.4, tom(c, 1.55)); };
  const braco = (x0, y0, x1, y1, esp = 3, c = cor) => { p.l(x0, y0, x1, y1, tom(c, 0.7), esp + 0.6); p.l(x0, y0, x1, y1, c, esp); };
  const bolhas = (pts) => { for (const [x, y] of pts) p.px(x, y, corL); };
  const antena = (pts, bulbo) => {
    for (let i = 1; i < pts.length; i++) p.l(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], cor, 1.2);
    if (bulbo) { p.bola(bulbo[0], bulbo[1], 1.4, 1.5, corL); p.px(bulbo[0] - 0.4, bulbo[1] - 0.5, '#ffffff'); }
  };
  // os ferrões da Arma Especial e os pedacinhos de pimenta do Molho Picante
  const ferrao = (x, y, dx, dy) => { if (a.ferroes) p.poli([[x - 1, y], [x + 1, y], [x + dx, y + dy]], a.ferroes); };
  const pintas = (pts) => { if (a.pintas) pts.forEach(([x, y], k) => p.px(x, y, a.pintas[k % a.pintas.length])); };
  // o rosto de frente: sobrancelhas bravas, os olhos acesos e o sorriso cheio de dentes (aberto = gritando)
  const rosto = (cx, cy, aberto = false) => {
    p.l(cx - 4.6, cy - 2.2, cx - 1.6, cy - 1.2, corD, 1); p.l(cx + 4.4, cy - 2.2, cx + 1.4, cy - 1.2, corD, 1);
    if (fechado) { p.r(cx - 4, cy - 0.6, 2.4, 0.7, corD); p.r(cx + 1.6, cy - 0.6, 2.4, 0.7, corD); }
    else {
      p.r(cx - 4, cy - 1, 2.4, 1.5, olho); p.r(cx + 1.6, cy - 1, 2.4, 1.5, olho);
      p.px(cx - 3.2, cy - 0.6, '#ffffff'); p.px(cx + 2.4, cy - 0.6, '#ffffff');
    }
    const h = aberto ? 3.4 : 2.2;
    p.r(cx - 4.6, cy + 1.6, 9.2, h, boca); p.px(cx - 5.2, cy + 1.1, boca); p.px(cx + 4.6, cy + 1.1, boca);
    for (let x = cx - 4.2; x < cx + 4.4; x += 1.6) { p.px(x, cy + 1.6, dente); p.px(x + 0.8, cy + 1.6 + h - 1, dente); }
  };
  // o "esqueleto" escuro por dentro (a membrana e a coluna) e a faixa de contenção
  const nucleo = (cx, cy, s = 1) => {
    p.o(cx, cy, 3.6 * s, 2.8 * s, nuc);
    p.l(cx, cy - 4.5 * s, cx, cy + 4 * s, nuc, 1);
    p.l(cx - 1, cy - 1.5 * s, cx - 4 * s, cy - 0.5 * s, nuc, 1); p.l(cx + 1, cy - 1.5 * s, cx + 4 * s, cy - 0.5 * s, nuc, 1);
  };
  const cinto = (x, y, w) => {
    if (a.calcao) { p.r(x, y - 0.4, w, 3.4, a.calcao); p.r(x, y - 0.4, w, 0.7, tom(a.calcao, 1.35)); return; }
    if (!faixa) return;
    p.r(x, y, w, 1.6, faixa); p.r(x, y, w, 0.5, metal); p.r(x + w / 2 - 1, y - 0.4, 2.2, 2.4, metal); p.px(x + w / 2 - 0.4, y + 0.4, '#ffffff');
  };
  const manga = (x, y) => { if (a.manga) { p.bola(x, y, 3.2, 2, a.manga); p.px(x - 1, y + 1.6, a.manga); p.px(x + 1.2, y + 1.8, a.manga); } };

  if (Math.round(bob)) p.g.translate(0, Math.round(bob));
  if (dir === DIR.L) {
    const lt = m.liftT, lf = m.liftF;
    // de lado: curvado para a frente, a cabeça na frente do corpo
    if (pose === 53 || pose === 54) {                 // bola: no ar (53) ou achatada no quique (54)
      const bola = pose === 53 ? [16, 15, 8.4, 9.2] : [16, 23.5, 12, 6];
      gel(bola[0] - 3, bola[1] + (pose === 53 ? 6 : 1), 3, 2.4, corD);           // um pé recolhido
      gel(...bola); nucleo(bola[0] - 2, bola[1] + 1, 0.9);
      const fx = bola[0] + bola[2] * 0.42, fy = bola[1] - (pose === 53 ? 2 : 1.4);
      p.l(fx - 1.6, fy - 2.4, fx + 2.6, fy - 1.6, corD, 1);
      if (!fechado) { p.r(fx, fy - 1.2, 2.2, 1.5, olho); p.px(fx + 0.6, fy - 0.8, '#ffffff'); }
      p.r(fx - 1, fy + 1.4, 5, 2, boca); p.px(fx, fy + 1.4, dente); p.px(fx + 1.6, fy + 1.4, dente); p.px(fx + 3.2, fy + 1.4, dente); p.px(fx + 0.8, fy + 2.6, dente); p.px(fx + 2.4, fy + 2.6, dente);
      mao(bola[0] + 2, bola[1] + bola[3] * 0.55, 2.4, 2, cor);                   // a mão recolhida na frente
      antena([[bola[0] + 1, bola[1] - bola[3] + 0.6], [bola[0] + 2.6, bola[1] - bola[3] - 2.4], [bola[0] + 5.4, bola[1] - bola[3] - 2.2]], [bola[0] + 6.4, bola[1] - bola[3]]);
      bolhas([[bola[0] - 4, bola[1] - 2], [bola[0] - 1, bola[1] + 3], [bola[0] + 3, bola[1] + 2]]);
      ferrao(bola[0] - 4, bola[1] - bola[3] + 1.6, -2, -3); ferrao(bola[0] - 7, bola[1] - 2, -3, -1.5);
      pintas([[bola[0] - 3, bola[1] - 3], [bola[0] + 1, bola[1] + 4], [bola[0] - 6, bola[1] + 2]]);
      return;
    }
    const ag = pose === 52, sl = pose === 55, inf = pose === 51;
    const ox = ag ? -2 : sl ? 0.5 : 0, oy = ag ? 3.4 : sl ? 1.2 : 0;           // achatado para trás / inclinado para bater no chão
    const T0 = [14 + ox + tor * 0.6, 18.2 + oy, (inf ? 8.6 : ag ? 8.6 : 7.4) * sx, (inf ? 7.6 : ag ? 5.4 : 6.8) * sy];
    const C0 = [21 + ox + (ag ? 0.6 : 0) + tor, 13.4 + oy + (ag ? 1.8 : 0) - (inf ? 1.4 : 0), 5, 4.4];
    // perna e braço de trás
    if (!ag) { gel(13 - passo, 25.4 - lt, 2.6, 3, corD); gel(13.6 - passo, 28 - lt, 3, 1.4, corD); }
    if (inf) { braco(12.5, 14, 9, 7, 2.6, corD); mao(8.6, 6.4, 2.6, 2.4, corD); }
    else if (ag) { braco(14, 19, 24, 27, 2.4, corD); mao(24.4, 27.6, 3, 1.5, corD); }
    else if (sl) { braco(14, 15, 21.5, 26.6, 2.6, corD); mao(21.8, 27.6, 3.2, 1.6, corD); }
    else { braco(13, 14.5, 11.5 - bx, 23, 2.6, corD); mao(11.4 - bx, 24.6, 2.6, 2.4, corD); }
    // perna da frente
    if (!ag) { gel(17.6 + passo, 25.4 - lf, 2.8, 3, corM); gel(18.6 + passo, 28 - lf, 3.2, 1.5, corM); }
    // tronco curvado e a corcunda; o esqueleto por dentro; a faixa
    gel(...T0); gel(12.6 + ox, 13.4 + oy, 5.6 * sx, 4.2 * sy);
    p.o(T0[0] - 0.6, T0[1] - 0.2, 3.4, 3, nuc);                                 // a membrana escura por dentro
    p.l(10.4 + ox, 11.6 + oy, 9.6 + ox, 21 + oy, nuc, 1);                       // a coluna aparecendo nas costas
    for (const yv of [13.5, 16, 18.5]) p.px(10.2 + ox - (yv - 13.5) * 0.08, yv + oy, nuc);
    cinto(T0[0] - T0[2] + 1, T0[1] + T0[3] - 3.2, T0[2] * 2 - 2);
    manga(14.2 + ox, 13.2 + oy);
    bolhas([[T0[0] - 4, T0[1] + 1], [T0[0] + 3, T0[1] - 2], [T0[0] + 1, T0[1] + 4]]);
    ferrao(10 + ox, 10.5 + oy, -2, -3.4); ferrao(8 + ox, 14 + oy, -3.4, -1.6); ferrao(9 + ox, 18 + oy, -3, 0.6);
    pintas([[T0[0] - 3, T0[1] - 3], [T0[0] + 2, T0[1] + 3], [T0[0] - 5, T0[1] + 3], [13 + ox, 12 + oy]]);
    // a cabeça na frente (separada dos ombros por uma dobra escura): o olho, a sobrancelha e o sorriso de lado
    p.o(C0[0] - 0.4, C0[1] + 0.3, C0[2] + 0.8, C0[3] + 0.7, corD);
    gel(...C0);
    const [hx, hy] = C0, aberto = inf || pose === 50 || atk === 2 || atk === 3;
    p.l(hx - 0.2, hy - 3, hx + 4.6, hy - 1.8, corD, 1);
    if (fechado) p.r(hx + 1.6, hy - 1.2, 2.8, 0.8, corD); else { p.r(hx + 1.6, hy - 1.8, 2.8, 1.8, olho); p.px(hx + 2.6, hy - 1.4, '#ffffff'); }
    const hb = aberto ? 3.2 : 2.2;
    p.r(hx - 0.6, hy + 1.2, 6, hb, boca); p.px(hx - 1.2, hy + 0.7, boca);
    for (let x = hx - 0.2; x < hx + 5.2; x += 1.5) { p.px(x, hy + 1.2, dente); p.px(x + 0.7, hy + 1.2 + hb - 1, dente); }
    // a antena de gosma: sobe do alto da cabeça e cai na frente do rosto
    antena([[hx - 1.4, hy - 3.8], [hx - 0.4, hy - 7.2], [hx + 2.6, hy - 8.8], [hx + 5.2, hy - 7.4]], [hx + 5.6, hy - 5.4]);
    // o braço da frente
    if (pose === 50) { braco(17, 14.5, 28.6, 13.6, 2); mao(29.4, 13.6, 2.2, 2.2, corL); }                 // esticado (a cena estica mais)
    else if (inf) { braco(17.5, 14, 23.5, 7.4, 2.8); mao(24, 6.6, 2.8, 2.6); }
    else if (ag) { braco(17, 19.5, 28, 27, 2.6); mao(28.4, 27.6, 3.2, 1.6); }
    else if (sl) { braco(18, 15, 26, 26.4, 3); mao(26.4, 27.4, 3.4, 1.8); }
    else if (atk === 1) { braco(17, 14.5, 14.6, 8, 3); mao(14, 7, 2.8, 2.6); }
    else if (atk === 2) { braco(17.5, 14.5, 27.4, 14, 2.4); mao(28.2, 14.4, 3, 2.8); }
    else if (atk === 3) { braco(17.5, 15, 26.6, 21, 2.8); mao(27.2, 21.8, 3.4, 2.8); }
    else if (atk === 4) { braco(17.5, 15, 22.6, 20, 3); mao(23, 21.2, 2.8, 2.6); }
    else { braco(17.2, 14.8, 19.6 + bx, 23, 3); mao(20 + bx, 24.8, 2.8, 2.6); }
    return;
  }

  // de frente e de costas
  const costas = dir === DIR.N;
  const lA = m.lA, lB = m.lB, bA = atk || pose ? 0 : m.bA, bB = atk || pose ? 0 : m.bB;
  if (pose === 53 || pose === 54) {
    const bola = pose === 53 ? [16, 15, 8.8, 9.2] : [16, 24, 12.4, 5.8];
    gel(...bola); nucleo(16, bola[1] + 1, pose === 53 ? 1 : 0.8);
    mao(bola[0] - bola[2] + 1.4, bola[1] + 2, 2.2, 2); mao(bola[0] + bola[2] - 1.4, bola[1] + 2, 2.2, 2);
    if (!costas) rosto(16, bola[1] - (pose === 53 ? 2.6 : 1.4), pose === 53);
    else p.l(16, bola[1] - bola[3] + 2, 16, bola[1] + bola[3] - 2, nuc, 1);
    antena([[16, bola[1] - bola[3] + 0.8], [16.8, bola[1] - bola[3] - 2.4], [19, bola[1] - bola[3] - 3.4]], costas ? null : [20.6, bola[1] - bola[3] - 1.4]);
    bolhas([[bola[0] - 5, bola[1] - 1], [bola[0] + 5, bola[1] + 2], [bola[0] - 2, bola[1] + 4]]);
    ferrao(bola[0] - 6, bola[1] - bola[3] + 3, -3, -3); ferrao(bola[0] + 6, bola[1] - bola[3] + 3, 3, -3);
    pintas([[bola[0] - 4, bola[1] - 3], [bola[0] + 3, bola[1] + 3], [bola[0] + 6, bola[1] - 2]]);
    return;
  }
  const ag = pose === 52, sl = pose === 55, inf = pose === 51;
  const oy = ag ? 3.6 : sl ? 1.4 : 0, wx = inf ? 1.4 : ag ? 1.6 : 0;
  const T0 = [16 + tor * 0.6, 18.6 + oy, (8.4 + wx) * sx, (inf ? 7.6 : ag ? 5.4 : 6.8) * sy];
  // pernas curtas e grossas
  if (!ag) for (const [x, l] of [[12.4, lA], [19.6, lB]]) { gel(x, 25.4 + l, 2.8, 3, corM); gel(x + (x < 16 ? -0.6 : 0.6), 28 + l, 3.2, 1.5, corM); }
  // braços: de frente, um de cada lado; erguidos (inflado), cravados no chão (agachado) ou batendo no chão
  const xl = costas ? 24 : 8, xr = costas ? 8 : 24, lado = costas ? -1 : 1;
  const bracos = () => {
    if (inf) { braco(9, 13.4, 5, 8, 2.8); mao(4.4, 7.4); braco(23, 13.4, 27, 8, 2.8); mao(27.6, 7.4); return; }
    if (ag) { braco(9, 18.5, 4.4, 27, 2.6); mao(4, 27.6, 3, 1.5); braco(23, 18.5, 27.6, 27, 2.6); mao(28, 27.6, 3, 1.5); return; }
    if (sl) { braco(10, 15, 11, 27, 3); mao(11, 27.8, 3.4, 1.8); braco(22, 15, 21, 27, 3); mao(21, 27.8, 3.4, 1.8); return; }
    // o braço de trás (do lado de lá) e o da frente, com o ataque
    braco(xl + lado * -0.6, 14, xl - lado * 1.6, 22 + (costas ? bB : bA), 2.8); mao(xl - lado * 1.8, 24 + (costas ? bB : bA));
    const ym = costas ? bA : bB;
    if (pose === 50 && !costas) { braco(xr, 14.5, 29.2, 17, 2); mao(29.8, 17.2, 2.2, 2.2, corL); }
    else if (atk === 1) { braco(xr, 14, xr + lado * 1.6, 7, 3); mao(xr + lado * 1.8, 6.2, 2.8, 2.6); }
    else if (atk === 2) { braco(xr, 14.5, xr - lado * 2.4, 20.4, 2.8); mao(xr - lado * 3, 21.4, 3.6, 3.2); }
    else if (atk === 3) { braco(xr, 15, xr - lado * 4, 24, 3); mao(xr - lado * 4.4, 25, 3.8, 3); }
    else { braco(xr + lado * 0.6, 14, xr + lado * 1.6, 22 + ym, 2.8); mao(xr + lado * 1.8, 24 + ym); }
  };
  if (!costas) bracos();
  // tronco largo, ombros grandes, o esqueleto por dentro e a faixa
  gel(...T0);
  for (const xo of [8.6 - wx, 23.4 + wx]) gel(xo + tor * 0.6, 14 + oy - (inf ? 1 : 0), 4.2, 3.4);
  nucleo(T0[0], T0[1] - 1, 1);
  cinto(T0[0] - T0[2] + 1.6, T0[1] + T0[3] - 3.4, T0[2] * 2 - 3.2);
  for (const xo of [8.6 - wx, 23.4 + wx]) manga(xo, 13.6 + oy);
  bolhas([[T0[0] - 5, T0[1] + 1], [T0[0] + 4, T0[1] - 2], [T0[0] + 2, T0[1] + 4], [9 - wx, 13 + oy]]);
  ferrao(7 - wx, 11.6 + oy, -2.6, -3.2); ferrao(25 + wx, 11.6 + oy, 2.6, -3.2); if (costas) { ferrao(14, 15 + oy, -1.6, -3); ferrao(18, 15 + oy, 1.6, -3); }
  pintas([[T0[0] - 4, T0[1] - 3], [T0[0] + 3, T0[1] + 3], [T0[0] + 6, T0[1] - 1], [T0[0] - 6, T0[1] + 3]]);
  // a cabeça baixa entre os ombros
  const hy = 10.6 + oy + (ag ? 1.4 : 0) - (inf ? 1 : 0), hx = 16 + tor;
  gel(hx, hy, 6, 4.8);
  if (costas) {
    p.l(hx, hy - 2, hx, hy + 3, nuc, 1);
    antena([[hx, hy - 4.4], [hx + 0.6, hy - 7.6], [hx + 2.4, hy - 8.6]], null);
    bracos();
  } else {
    rosto(hx, hy, inf || atk === 2 || atk === 3 || pose === 50);
    antena([[hx + 0.4, hy - 4.4], [hx + 1.6, hy - 7.8], [hx + 4.4, hy - 8.8], [hx + 6.4, hy - 7.2]], [hx + 6.8, hy - 5.2]);
  }
}

// o ataque em 4 tempos: 3 é o golpe do estilo antigo e o impacto do novo
const ataque3 = (atk) => atk === 3;

// ---------- Monstros com forma própria ----------
// Tropa Corpo a Corpo: armadura azul, elmo redondo com viseira e crista, escudo redondo e espada curta
function tropa(p, a, dir, f) {
  const arm = a.arm, armE = tom(arm, 0.65), armC = tom(arm, 1.3), elmo = a.elmo, escudo = a.escudo || '#c9a050';
  const calca = a.calca, bota = tom(calca, 0.55), lamina = a.lamina || '#d8dde6', olho = a.olho || '#ffe066';
  const ataque = f === 3, m = marcha(f), lA = m.lA, lB = m.lB, bA = ataque ? 0 : m.bA, bB = ataque ? 0 : m.bB;
  const pa = m.passo * 0.8, bx = ataque ? 0 : m.braco * 0.8;
  const escudoFrente = (x, y) => { p.bola(x, y, 4.2, 5, escudo); p.o(x, y, 2.6, 3.3, tom(escudo, 0.8)); p.bola(x, y, 1.4, 1.4, '#e8e0c8'); };
  if (dir === DIR.L) {
    p.r(13 - pa, 24 - m.liftT, 3, 4, tom(calca, 0.75)); p.r(13 - pa, 27 - m.liftT, 4, 2, bota);
    p.r(17 + pa, 24 - m.liftF, 3, 4, calca); p.r(17 + pa, 27 - m.liftF, 4, 2, bota);
    p.bola(15.5, 19, 5.2, 5.4, arm); p.r(11, 22, 9, 1, armE); p.r(14, 17, 2, 3, armC);
    if (ataque) { p.r(17, 16, 7, 3, arm); p.l(23, 17, 31, 17, lamina, 1); p.r(22, 15, 1, 5, '#c9a050'); }
    else { p.r(16 + bx, 17, 3, 6, arm); p.l(18 + bx, 22, 18 + bx, 14, lamina, 1); p.r(17 + bx, 21, 3, 1, '#c9a050'); }
    p.bola(16.5, 10, 5, 5, elmo); p.r(18, 9.5, 5, 1.5, '#141820'); p.r(20, 9.5, 1, 1, olho);
    p.poli([[11, 6], [15, 2], [17, 4], [13, 8]], armC);
    p.bola(21.5 - bx * 0.5, 19.5, 2, 5, escudo); p.r(22 - bx * 0.5, 18, 1, 3, '#e8e0c8');
    return;
  }
  const costas = dir === DIR.N;
  if (costas) escudoFrente(23, 19 + bB);
  p.r(12, 24 + lA, 3, 4, calca); p.r(17, 24 + lB, 3, 4, calca);
  p.r(12, 27 + lA, 3, 2, bota); p.r(17, 27 + lB, 3, 2, bota);
  p.bola(16, 19, 6, 5.4, arm); p.r(10, 22, 12, 1, armE);
  if (!costas) { p.r(15, 16, 2, 4, armC); p.r(14, 17, 4, 1, armC); }
  p.bola(10, 15.5, 2.6, 2, armC); p.bola(22, 15.5, 2.6, 2, armC);
  // espada (lado do escudo é o outro)
  const ex = costas ? 9 : 23;
  if (ataque && !costas) { p.r(21, 13, 3, 5, arm); p.l(23, 12, 29, 5, lamina, 1); p.r(21, 12, 4, 1, '#c9a050'); }
  else { const ye = costas ? bA : bB; p.r(ex - 2, 16 + ye, 3, 6, arm); p.l(ex, 15 + ye, ex, 25 + ye, lamina, 1); p.r(ex - 1, 21 + ye, 3, 1, '#c9a050'); }
  p.bola(16, 10, 5.4, 5, elmo);
  p.poli([[14.5, 2], [17.5, 2], [18.5, 7], [13.5, 7]], armC); p.r(15.5, 2, 1, 5, tom(armC, 1.2));
  if (!costas) { p.r(11.5, 10, 9, 1.6, '#141820'); p.r(13, 10, 1, 1, olho); p.r(18, 10, 1, 1, olho); p.r(15.5, 11.6, 1, 2, tom(elmo, 0.6)); }
  if (!costas) escudoFrente(8.5, 19.5 + bA);
}

// Tropa Mago: capuz pontudo com o rosto na sombra, olhos brilhando, manto até o chão e um orbe flutuando
function mago(p, a, dir, f) {
  const robe = a.robe, robeE = tom(robe, 0.68), robeC = tom(robe, 1.25), capuz = a.capuz || tom(robe, 0.8), ouro = '#d8b050';
  const orbe = a.orbe, sombra = '#100c1a', ataque = f === 3, m = marcha(f), bob = m.bA * 0.8, barra = m.balanco * 1.3;
  const orbeEm = (x, y, r) => { p.bola(x, y, r, r, orbe); p.r(x - r * 0.4, y - r * 0.5, 1, 1, '#ffffff'); };
  if (dir === DIR.L) {
    p.poli([[10 + barra, 29], [22, 29], [19, 14], [13, 14]], robe);
    p.poli([[10 + barra, 29], [14, 29], [14, 15], [13, 14]], robeE);
    p.r(10 + barra, 28, 12, 1, ouro);
    p.r(13, 20, 7, 1, ouro);
    p.poli([[11, 14], [20, 14], [21, 9], [18, 4], [14, 3], [8, 8]], capuz);
    p.poli([[8, 8], [14, 3], [11, 9]], tom(capuz, 0.75));
    p.bola(18.5, 10.5, 2.4, 2.6, sombra); p.r(19, 10, 1, 1, orbe);
    p.l(12, 14, 20, 14, ouro, 1);
    if (ataque) { p.r(18, 15, 6, 3, robeC); orbeEm(27, 14, 3.2); p.l(24, 14, 31, 14, tom(orbe, 1.3), 1); }
    else { p.r(17, 16, 3, 6, robeC); orbeEm(23, 17 + bob, 2.2); }
    return;
  }
  const costas = dir === DIR.N;
  p.poli([[9 - barra, 29], [23 + barra, 29], [20, 14], [12, 14]], robe);
  p.poli([[16, 14], [20, 14], [23 + barra, 29], [17, 29]], robeE);
  if (!costas) { p.l(16, 16, 16, 28, tom(robe, 0.8), 1); p.r(12, 20, 8, 1, ouro); p.r(15, 21, 1, 3, ouro); }
  p.r(9 - barra, 28, 14 + barra * 2, 1, ouro);
  // mangas
  p.bola(10, 18, 2.6, 3.4, robeC); p.bola(22, 18 + (ataque ? -4 : 0), 2.6, 3.4, robeC);
  p.poli([[10, 15], [22, 15], [20, 7], [16, 2], [12, 7]], capuz);
  p.poli([[16, 2], [20, 7], [22, 15], [17, 15]], tom(capuz, 0.78));
  p.l(10, 15, 22, 15, ouro, 1);
  if (!costas) { p.bola(16, 11, 3.4, 3, sombra); p.r(14, 11, 1, 1, orbe); p.r(18, 11, 1, 1, orbe); }
  if (ataque && !costas) { orbeEm(24, 8, 3.4); p.r(21, 12, 2, 2, orbe); }
  else orbeEm(costas ? 7 : 25, 15 + bob, 2.2);
}

// Tropa de Cerco: carroça com rodas, um canhão e a bandeira azul
function cerco(p, a, dir, f) {
  const madeira = '#7a5230', madeiraE = '#4e3420', metal = a.cor, ferro = '#3a3e48', roda = '#5a4028', band = a.bandeira || '#3b6dd0';
  const ataque = f === 3, gira = f === 1 ? 1 : f === 2 ? 2 : 0;
  const rodaLado = (cx, cy, r) => {
    p.bola(cx, cy, r, r, roda); p.o(cx, cy, r - 1.4, r - 1.4, tom(roda, 0.7));
    for (let k = 0; k < 4; k++) { const an = (k / 4) * Math.PI + gira * 0.4; p.l(cx - Math.cos(an) * (r - 1), cy - Math.sin(an) * (r - 1), cx + Math.cos(an) * (r - 1), cy + Math.sin(an) * (r - 1), tom(roda, 1.25), 1); }
    p.bola(cx, cy, 1.4, 1.4, metal);
  };
  if (dir === DIR.L) {
    p.l(8, 4, 8, 17, '#6b4a2b', 1); p.poli([[8, 4], [2, 6], [8, 9]], band);
    rodaLado(19, 23, 4); // roda de trás (mais escura)
    p.r(6, 16, 18, 6, madeira); p.r(6, 16, 18, 2, metal); p.r(6, 21, 18, 1, madeiraE);
    const recuo = ataque ? -2 : 0;
    p.r(12 + recuo, 11, 15, 5, ferro); p.r(12 + recuo, 11, 15, 1, tom(ferro, 1.4)); p.r(26 + recuo, 10, 2, 7, tom(ferro, 0.7));
    p.bola(13 + recuo, 13.5, 3, 3, ferro);
    if (ataque) { p.bola(30, 13.5, 2.6, 2.6, '#ffd060'); p.r(29, 12, 3, 3, '#fff4c0'); }
    rodaLado(12, 24, 5);
    return;
  }
  const costas = dir === DIR.N;
  p.l(costas ? 11 : 21, 3, costas ? 11 : 21, 17, '#6b4a2b', 1);
  p.poli(costas ? [[11, 3], [5, 5], [11, 8]] : [[21, 3], [27, 5], [21, 8]], band);
  p.r(5, 17, 5, 11, roda); p.r(22, 17, 5, 11, roda);
  for (let y = 18 + gira; y < 28; y += 3) { p.r(5, y, 5, 1, tom(roda, 1.3)); p.r(22, y, 5, 1, tom(roda, 1.3)); }
  p.r(8, 16, 16, 9, madeira); p.r(8, 16, 16, 2, metal); p.r(8, 24, 16, 1, madeiraE);
  for (const x of [11, 16, 21]) p.r(x, 18, 1, 6, madeiraE);
  if (costas) { p.r(13, 10, 6, 7, ferro); p.bola(16, 11, 3, 2.4, tom(ferro, 1.2)); }
  else {
    p.bola(16, 14, 5, 4.6, ferro); p.o(16, 14, 3, 2.8, '#101014');
    if (ataque) { p.bola(16, 14, 3.6, 3.2, '#ffd060'); p.bola(16, 14, 1.8, 1.6, '#fff4c0'); }
  }
}

// Arraia do Rio: arraia-jamanta voando baixo, batendo as asas, com o rabo comprido
function arraia(p, a, dir, f) {
  const cor = a.cor, corE = tom(cor, 0.7), claro = a.barriga || tom(cor, 1.4), olho = a.olho || '#ffffff';
  const asa = f === 1 ? -3 : f === 2 ? 2 : 0, ataque = f === 3;
  p.o(16, 28, 9, 2, 'rgba(0,0,0,0.28)');
  if (dir === DIR.L) {
    p.l(7, 18, 1, 21, corE, 1); p.poli([[0, 21], [2, 19], [3, 22]], tom(cor, 1.2));
    p.poli([[6, 18], [15, 12 + asa], [24, 16], [16, 21]], cor);
    p.poli([[6, 18], [16, 21], [24, 16], [16, 19]], corE);
    p.poli([[24, 16], [29, 14 + (ataque ? 2 : 0)], [28, 18]], cor);
    p.r(23, 15, 1, 1, olho);
    for (const [x, y] of [[12, 16], [16, 15], [19, 16]]) p.r(x, y, 1, 1, claro);
    return;
  }
  const costas = dir === DIR.N;
  if (!costas) { p.l(16, 12, 16, 3, corE, 1); p.poli([[15, 3], [16, 0], [17, 3]], tom(cor, 1.2)); }
  p.poli([[16, 9], [31, 17 + asa], [16, 25], [1, 17 + asa]], cor);
  p.poli([[16, 17], [31, 17 + asa], [16, 25], [1, 17 + asa]], corE);
  p.l(1, 17 + asa, 16, 9, tom(cor, 1.3), 1); p.l(16, 9, 31, 17 + asa, tom(cor, 1.3), 1);
  for (const [x, y] of [[9, 16], [23, 16], [13, 19], [19, 19], [16, 14]]) p.r(x, y + (Math.abs(x - 16) > 5 ? asa / 2 : 0), 1.5, 1, claro);
  if (costas) { p.l(16, 24, 16, 31, corE, 1); p.poli([[15, 29], [16, 32], [17, 29]], tom(cor, 1.2)); }
  else {
    p.poli([[13, 11], [12, 6], [15, 10]], cor); p.poli([[19, 11], [20, 6], [17, 10]], cor);
    p.r(13, 13, 2, 1, olho); p.r(17, 13, 2, 1, olho);
    if (ataque) p.o(16, 16, 2.5, 1.5, '#0c2a2a');
  }
}

// Criatura do Vazio: um olho só, enorme, numa carapaça com espinhos, flutuando sobre tentáculos
function olhoVazio(p, a, dir, f) {
  const cor = a.cor, corE = tom(cor, 0.62), carap = a.cristal || tom(cor, 1.4), olho = a.olho, bob = f === 1 ? -1 : f === 2 ? 1 : 0, ataque = f === 3;
  const tentaculo = (x0, fase, lado) => {
    for (let k = 0; k < 8; k++) { const y = 20 + k * 1.2 + bob, x = x0 + Math.sin(k * 0.8 + fase + f) * 1.4 * lado; p.r(x, y, k < 4 ? 2 : 1, 1.2, k % 3 === 2 ? tom(cor, 0.8) : corE); }
  };
  p.o(16, 29, 7, 1.8, 'rgba(0,0,0,0.3)');
  tentaculo(10, 0, 1); tentaculo(14.5, 1.5, -1); tentaculo(19, 3, 1); tentaculo(22, 4.2, -1);
  if (dir === DIR.L) {
    p.bola(15, 14 + bob, 8, 7.5, cor);
    for (const [x, y, h] of [[9, 9, 5], [13, 7, 6], [17, 7, 5]]) p.poli([[x - 1.5, y + 2 + bob], [x - 2.5, y - h + bob], [x + 1.5, y + 2 + bob]], carap);
    p.o(20.5, 14 + bob, 2.8, 3.6, '#ffd8f8'); p.o(21, 14 + bob, 1.8, 2.8, ataque ? '#ff3060' : olho); p.r(21.5, 13 + bob, 1, 2, '#200818');
    p.o(21, 19.5 + bob, 2.5, ataque ? 2 : 1, '#200818');
    return;
  }
  const costas = dir === DIR.N;
  p.bola(16, 14 + bob, 8.5, 7.5, cor);
  for (const [x, h] of [[10, 5], [13.5, 7], [18.5, 7], [22, 5]]) p.poli([[x - 2, 10 + bob], [x, 9 - h + bob], [x + 2, 10 + bob]], carap);
  if (costas) { p.l(10, 15 + bob, 22, 15 + bob, carap, 1); p.l(16, 8 + bob, 16, 20 + bob, carap, 1); return; }
  p.o(16, 14 + bob, 4.6, 4, '#ffd8f8');
  p.o(16, 14 + bob, 3, 3.4, ataque ? '#ff3060' : olho);
  p.r(15.5, 12 + bob, 1, 4, '#200818'); p.r(14, 12 + bob, 1, 1, '#ffffff');
  p.o(16, 19.5 + bob, 4, ataque ? 2.4 : 1.4, '#200818');
  for (const x of [13, 15, 17, 19]) p.r(x, 18.6 + bob, 1, 1, '#f0e8e0');
}

// Brambleback Vermelho: um javali enorme coberto de espinhos em brasa, com presas
function javali(p, a, dir, f) {
  const cor = a.cor, corE = tom(cor, 0.62), corC = tom(cor, 1.3), esp = a.cristal || '#ff7a3a', presa = '#efe4c8', olho = a.olho || '#ffe070';
  const s1 = f === 1 ? -1 : 0, s2 = f === 2 ? -1 : 0, bote = f === 3 ? 2 : 0;
  const espinho = (x, y, h, k) => { p.poli([[x - 1.2, y], [x, y - h], [x + 1.2, y]], k % 2 ? tom(esp, 0.75) : esp); p.r(x - 0.5, y - h, 1, 1, '#fff0a0'); };
  if (dir === DIR.L) {
    p.r(8, 23 + s1, 3, 6, corE); p.r(19, 23 + s2, 3, 6, corE);
    p.bola(15, 19, 10, 6.4, cor);
    p.o(15, 22, 7, 2.4, corC);
    for (let k = 0; k < 7; k++) espinho(7 + k * 2.6, 15 - Math.sin((k / 6) * Math.PI) * 3, 3 + (k % 3), k);
    p.r(11, 23 + s2, 3, 6, cor); p.r(22, 23 + s1, 3, 6, cor);
    p.r(10, 28.5, 4, 1, '#2a1410'); p.r(21, 28.5, 4, 1, '#2a1410');
    p.bola(25 + bote, 20 + bote / 2, 4.6, 4.2, cor);
    p.r(28 + bote, 20 + bote / 2, 3, 3.4, corC); p.r(30 + bote, 21 + bote / 2, 1, 1, '#2a1410');
    p.poli([[27 + bote, 23 + bote / 2], [30 + bote, 19 + bote / 2], [29 + bote, 24 + bote / 2]], presa);
    p.r(25 + bote, 18 + bote / 2, 1.5, 1, olho);
    p.poli([[22, 16], [23, 12], [25, 16]], corE);
    return;
  }
  const costas = dir === DIR.N;
  p.r(10, 24 + s1, 3, 5, corE); p.r(19, 24 + s2, 3, 5, corE);
  p.bola(16, 19, 9, 6.4, cor);
  for (let k = 0; k < 7; k++) espinho(8 + k * 2.7, 15 - Math.sin((k / 6) * Math.PI) * 2.5, 3 + ((k + 1) % 3), k);
  if (costas) { p.l(16, 22, 16, 26, corE, 1); p.r(15.5, 26, 1, 1, corE); return; }
  p.bola(16, 21 + bote / 2, 5.4, 4.6, cor);
  p.o(16, 23.5 + bote / 2, 3, 2, corC); p.r(14.5, 23 + bote / 2, 1, 1, '#2a1410'); p.r(16.5, 23 + bote / 2, 1, 1, '#2a1410');
  p.poli([[12, 23], [10, 19], [13, 22]], presa); p.poli([[20, 23], [22, 19], [19, 22]], presa);
  p.r(13, 19.5 + bote / 2, 1.5, 1, olho); p.r(17.5, 19.5 + bote / 2, 1.5, 1, olho);
  p.poli([[11, 17], [10, 13], [13, 16]], corE); p.poli([[21, 17], [22, 13], [19, 16]], corE);
}

// Sentinela Azul: guardião de pedra alto, com runas acesas e um cristal flutuando sobre a cabeça
function sentinela(p, a, dir, f) {
  const cor = a.cor, corE = tom(cor, 0.62), corC = tom(cor, 1.25), cristal = a.cristal, olho = a.olho, musgo = '#4a7a3a';
  const bob = f === 1 ? -1 : f === 2 ? 0.5 : 0, soco = f === 3, passo = f === 1 ? -1 : 0, passo2 = f === 2 ? -1 : 0;
  const pedraCristal = (x, y) => {
    p.poli([[x, y - 4 + bob], [x + 3, y + bob], [x, y + 4 + bob], [x - 3, y + bob]], cristal);
    p.poli([[x, y - 4 + bob], [x + 3, y + bob], [x, y + bob]], tom(cristal, 1.35)); p.r(x - 1, y - 2 + bob, 1, 1, '#ffffff');
  };
  if (dir === DIR.L) {
    p.r(11, 23 + passo, 5, 6, corE); p.r(17, 23 + passo2, 5, 6, cor);
    p.bola(15, 17, 7, 7, cor);
    p.l(12, 14, 15, 19, cristal, 1); p.l(15, 19, 13, 22, cristal, 1);
    p.bola(14, 12, 4, 3.2, corC); p.r(12, 10, 4, 1.5, musgo);
    p.bola(21, 11, 3, 2.8, corE); p.r(23, 10.5, 1.5, 1, olho);
    p.bola(soco ? 24 : 19, soco ? 17 : 20, 3, 4.6, corC);
    pedraCristal(19, 4.5);
    return;
  }
  const costas = dir === DIR.N;
  p.r(10, 23 + passo, 5, 6, corE); p.r(17, 23 + passo2, 5, 6, corE);
  p.bola(16, 17, 8, 7, cor);
  if (!costas) { p.l(16, 13, 16, 21, cristal, 1); p.l(12, 16, 16, 18, cristal, 1); p.l(20, 16, 16, 18, cristal, 1); }
  p.bola(8, 13, 3.6, 3.2, corC); p.bola(24, 13, 3.6, 3.2, corC);
  p.r(6, 10.5, 4, 1.5, musgo); p.r(22, 10.5, 4, 1.5, musgo);
  p.bola(7, 20, 2.8, 5, corC); p.bola(25, soco ? 15 : 20, 2.8, 5, corC);
  p.bola(16, 10, 3.6, 3, costas ? corE : tom(cor, 0.85));
  if (!costas) { p.r(14, 10, 1.4, 1, olho); p.r(17, 10, 1.4, 1, olho); }
  pedraCristal(16, 4.5);
}

// ---------- NPCs: desenho próprio de frente e uma animação de ofício (quadros 10 a 13) ----------
// pernas e cabeça de frente, para os NPCs
function pernasFrente(p, calca, bota) { p.r(12, 24, 3, 4, calca); p.r(17, 24, 3, 4, calca); p.r(11.5, 27, 4, 2, bota); p.r(16.5, 27, 4, 2, bota); }
// lua crescente (o cajado da Soraka): arco grosso aberto para a direita
function crescente(p, cx, cy, r, cor, brilho) {
  p.o(cx, cy, r, r, cor); p.o(cx - r * 0.25, cy + r * 0.2, r * 0.55, r * 0.55, tom(cor, 1.3));
  const g = p.g; g.save(); g.globalCompositeOperation = 'destination-out';
  p.o(cx + r * 0.55, cy - r * 0.35, r * 0.8, r * 0.8, '#000'); g.restore();
  if (brilho) for (const [dx, dy] of [[-r - 2, 0], [0, -r - 1.5], [-1, r + 2]]) p.r(cx + dx, cy + dy, 1, 1, brilho);
}
function soraka(p, a, f) {
  const pele = '#8fb0ec', peleE = '#6a88c8', cabelo = '#f4f6ff', cabeloE = '#c4cceb', vestido = '#c8b8f0', vestidoE = '#9480cc';
  const ouro = '#f0c850', chifre = '#ffe9a0', reza = f >= 10 && f <= 13, k = f - 10, oi = f >= 20 && f <= 23, pisca = f === 19;
  const luz = reza ? ['#fff4b0', '#ffffff', '#fff4b0', '#ffe070'][k] : oi ? ['#fff4b0', '#ffffff', '#ffffff', '#fff4b0'][f - 20] : null;
  const vento = reza ? [0, 0.5, 1, 0.5][k] : oi ? 1 : 0;
  // o cabelo comprido esvoaça para os lados
  p.poli([[11, 8], [21, 8], [22 + vento, 21], [10 - vento, 21]], cabeloE);
  p.poli([[10.4, 12], [9 - vento, 20], [11, 22], [11.6, 13]], cabelo); p.poli([[21.6, 12], [23 + vento, 20], [21, 22], [20.4, 13]], cabelo);
  p.poli([[12, 15], [20, 15], [23, 29], [9, 29]], vestido);
  p.poli([[17, 15], [20, 15], [23, 29], [18, 29]], vestidoE);
  p.l(16, 21, 15, 28, tom(vestido, 1.2), 1);
  p.r(9, 28, 14, 1, ouro); p.r(12, 20, 8, 1, ouro); p.r(15, 21, 2, 1, '#7ad8ff');
  p.poli([[13, 15], [19, 15], [16, 18]], ouro); p.poli([[14, 15], [18, 15], [16, 17]], pele);
  for (const [x, y] of [[13, 24], [17, 26], [19, 22], [14.6, 27]]) p.px(x, y, '#ffffff');        // brilhos no vestido
  // cajado com a lua crescente, sempre à direita (ao cumprimentar, ela ergue o cajado)
  const sobe = oi ? 4 : 0;
  p.l(25, 7 - sobe, 25, 29 - sobe, '#c8a868', 1); p.r(24, 16 - sobe, 3, 1, ouro);
  crescente(p, 25, 4.5 - sobe, 3.4, ouro, luz);
  if (oi) { p.r(20, 13, 3, 5, vestido); p.r(22.4, 11.4, 3, 2, pele); p.r(9, 16, 3, 6, vestido); p.r(9, 21, 3, 2, pele); if (f >= 21) p.bola(25, 0.6, 2.4, 2.4, '#fff6c0'); }
  else if (reza) {
    // mãos juntas no peito
    p.r(10.5, 16, 3, 5, vestido); p.r(18.5, 16, 3, 5, vestido);
    p.r(13, 17, 2, 3, pele); p.r(17, 17, 2, 3, pele); p.r(15, 16, 2, 4, pele);
    if (k === 1 || k === 2) { p.bola(16, 15, 1.6, 1.6, '#fff6c0'); }
  } else {
    p.r(9, 16, 3, 6, vestido); p.r(9, 21, 3, 2, pele);
    p.r(20, 16, 3, 5, vestido); p.r(21.5, 20, 3, 2, pele);
  }
  // cabeça, cabelo, orelhas pontudas e o chifre
  p.r(10.5, 9, 1.5, 2.5, pele); p.r(20, 9, 1.5, 2.5, pele);
  p.bola(16, 10.5, 4.4, 4.4, pele);
  p.bola(16, 7, 4.8, 2.6, cabelo); p.r(11, 7, 1.6, 9, cabelo); p.r(19.4, 7, 1.6, 9, cabelo);
  if (reza || pisca) { p.r(13, 11, 2, 1, peleE); p.r(17, 11, 2, 1, peleE); }
  else { p.r(13.5, 10.5, 1.5, 1.5, '#2a2a6a'); p.r(17.5, 10.5, 1.5, 1.5, '#2a2a6a'); p.r(13.5, 10.5, 1, 1, '#ffffff'); }
  p.r(15, 13, 2, 1, oi ? '#c86a8a' : '#6a7ac8');
  p.poli([[14.8, 6.5], [17.2, 6.5], [16.5, 0.5]], chifre); p.r(15.5, 4, 1.5, 1, tom(chifre, 0.75)); p.r(16, 2, 1, 1, tom(chifre, 0.75));
  p.r(15.5, 7, 1, 1, '#7ad8ff');
}
function lojista(p, a, f) {
  const pele = '#e0b890', chapeu = '#5a3a20', aba = '#4a2e18', faixa = '#c83a2a', camisa = '#e8dcc0', colete = '#3a6a4a';
  const avental = '#d8c8a0', calca = '#4a3a2a', bigode = '#6a4024', bolsa = '#8a5a2a', moeda = '#ffd84a';
  pernasFrente(p, calca, '#2a1e14');
  p.bola(16, 19, 6.4, 5.8, camisa);
  p.r(9.5, 15, 3.5, 9, colete); p.r(19, 15, 3.5, 9, colete);
  p.r(12, 19, 8, 8, avental); p.r(12, 19, 8, 1, tom(avental, 0.75)); p.r(14, 23, 4, 2, tom(avental, 0.82));
  p.r(9.5, 21, 13, 1, '#4a2e18'); p.r(15, 21, 2, 1, '#c9a050');
  p.bola(22.5, 23, 2.2, 2.6, bolsa); p.r(22, 21, 1, 1, '#c9a050');
  // poções penduradas no cinto e o bolso do avental
  for (const [x, cor] of [[11, '#d83a3a'], [13, '#3a6ad8']]) { p.r(x, 22, 1.4, 2.4, cor); p.r(x, 21.6, 1.4, 0.6, '#c8b090'); p.px(x, 22.4, '#ffffff'); }
  p.r(15, 24, 3, 2, tom(avental, 0.8)); p.px(16, 24.4, '#c9a050');
  // braços: o esquerdo na barriga; o direito joga uma moeda para cima e pega de novo (ou acena, ao cumprimentar)
  p.r(8, 16, 3, 5, camisa); p.r(10, 20, 3, 2, pele);
  if (f >= 20 && f <= 23) {
    const w = [-1, 1, -1, 1][f - 20];
    p.r(21, 10, 3, 6, camisa); p.r(21 + w, 8, 3, 2.4, pele); p.px(22 + w, 7.4, pele);
  } else if (f >= 10 && f <= 13) {
    const k = f - 10, alt = [0, 4, 7, 3][k];
    p.r(21, 14, 3, 5, camisa); p.r(21, 12.5, 3, 2, pele);
    p.r(21.5, 10 - alt, 2, 2, moeda); if (k === 2) p.r(21.5, 10 - alt, 1, 1, '#ffffff');
  } else { p.r(21, 16, 3, 6, camisa); p.r(21, 21, 3, 2, pele); }
  // cabeça: bochechas rosadas, bigodão e chapéu com pena
  p.bola(16, 10.5, 4.6, 4.4, pele);
  p.r(12, 12, 1.5, 1, '#e89a80'); p.r(18.5, 12, 1.5, 1, '#e89a80');
  if (f === 19) { p.r(13.5, 10.6, 1.5, 0.6, '#2a1a10'); p.r(17, 10.6, 1.5, 0.6, '#2a1a10'); }
  else { p.r(13.5, 10, 1.5, 1.5, '#2a1a10'); p.r(17, 10, 1.5, 1.5, '#2a1a10'); p.px(13.5, 10, '#ffffff'); p.px(17, 10, '#ffffff'); }
  p.poli([[11.5, 13.5], [16, 12], [20.5, 13.5], [19.5, 15], [16, 13.8], [12.5, 15]], bigode);
  if (f >= 20 && f <= 23) p.r(15, 15, 2, 0.8, '#a04030');
  p.r(9, 6.5, 14, 2, aba); p.r(11, 1.5, 10, 5.5, chapeu); p.r(11, 5, 10, 1.2, faixa);
  p.poli([[20, 3], [25, 0], [22.5, 4.5]], '#e8c040');
}
function capitao(p, a, f) {
  const armadura = '#3a3a44', armC = '#5a5a66', vermelho = '#a01d1d', ouro = '#c9a050', pele = '#d0a07a', elmo = '#7a7a86';
  p.poli([[9, 15], [23, 15], [25, 29], [7, 29]], tom(vermelho, 0.7));
  pernasFrente(p, '#2a2a30', '#18181c');
  p.bola(16, 19, 6, 5.4, armadura); p.r(13, 16, 6, 4, armC); p.l(11, 16, 21, 23, vermelho, 1); p.r(15, 21, 2, 2, ouro);
  p.bola(10, 15.5, 3, 2.4, armC); p.bola(22, 15.5, 3, 2.4, armC);
  for (const [x, y] of [[13.4, 17], [18.6, 17], [12.6, 21], [19.4, 21]]) p.px(x, y, '#9a9aa8');       // rebites
  p.r(7.4, 28, 17.4, 1, ouro);                                                                       // barra da capa
  p.poli([[8, 14], [6, 10.5], [10, 13]], '#c8ccd4'); p.poli([[24, 14], [26, 10.5], [22, 13]], '#c8ccd4');
  // lança plantada à direita
  p.l(25, 3, 25, 29, '#5a3a20', 1); p.poli([[24, 4], [26, 4], [25, 0]], '#d0d4dc'); p.r(24, 5, 3, 1, vermelho);
  if (f >= 20 && f <= 23) {
    // continência: a mão na aba do elmo
    p.r(8, 16, 3, 6, armadura); p.r(8, 21, 3, 2, pele);
    p.l(21, 16, 20, 11, armadura, 3); p.r(18.4, 9.4, 3, 2, pele);
  } else if (f >= 10 && f <= 13) {
    // lendo a lista de tarefas
    const k = f - 10;
    p.r(10, 17, 3, 4, armadura); p.r(19, 17, 3, 4, armadura);
    if (k === 0) { p.r(12, 18, 8, 2, '#e8dcb0'); p.r(12, 18, 1, 2, tom('#e8dcb0', 0.7)); p.r(19, 18, 1, 2, tom('#e8dcb0', 0.7)); }
    else {
      p.r(11, 16, 10, 7, '#efe4c0'); p.r(10, 16, 1.5, 7, '#d8c890'); p.r(20.5, 16, 1.5, 7, '#d8c890');
      for (let y = 17.5; y < 22; y += 1.5) p.r(12.5, y, k === 2 && y > 20 ? 4 : 7, 0.6, '#6a5a40');
      p.r(12, 21.5, 1, 1, vermelho);
    }
  } else { p.r(8, 16, 3, 6, armadura); p.r(8, 21, 3, 2, pele); p.r(21, 16, 3, 6, armadura); p.r(22, 21, 3, 2, pele); }
  p.bola(16, 10.5, 4.4, 4.4, pele);
  p.r(13, 13, 6, 2, '#3a2a2a');
  const olhar = f === 13 ? 1 : f === 12 ? 0 : 0, baixo = f === 11 || f === 12 ? 0.5 : 0;
  if (f === 19) { p.r(13.5, 11, 1.4, 0.5, '#141414'); p.r(17.5, 11, 1.4, 0.5, '#141414'); }
  else { p.r(13.5 + olhar, 10.5 + baixo, 1.4, 1, '#141414'); p.r(17.5 + olhar, 10.5 + baixo, 1.4, 1, '#141414'); }
  p.bola(16, 8, 5.2, 3, elmo); p.r(15.4, 8, 1.2, 4, tom(elmo, 0.55)); p.r(11, 9.5, 2, 2.5, tom(elmo, 0.8)); p.r(19, 9.5, 2, 2.5, tom(elmo, 0.8));
  p.poli([[13, 5.5], [19, 5.5], [21, 2], [16, 0], [11, 2]], vermelho); p.poli([[16, 0], [21, 2], [19, 5.5], [16, 5.5]], tom(vermelho, 0.75));
}
function mestre(p, a, f) {
  const tunica = '#5a2a2a', placa = '#8a8a94', capa = '#7a1414', pele = '#c8946c', cabelo = '#c8c8c8', barba = '#e4e4e4', lamina = '#c3c9d3';
  p.poli([[9, 15], [23, 15], [24, 29], [8, 29]], tom(capa, 0.8));
  pernasFrente(p, '#2a2a2a', '#18181c');
  p.bola(16, 19, 5.8, 5.4, tunica); p.r(11, 16, 10, 3, placa); p.r(11, 22, 10, 1, '#3a2a1a');
  p.bola(10.5, 15.5, 2.6, 2, placa); p.bola(21.5, 15.5, 2.6, 2, placa);
  const k = f >= 20 && f <= 23 ? 1 : f >= 10 && f <= 13 ? f - 10 : -1;            // cumprimentando: espada erguida em saudação
  p.r(14.6, 22, 2.8, 1.6, '#c9a050'); p.px(15.4, 22.4, '#fff0b0');                         // fivela
  p.bola(13, 17.4, 1, 1, '#d8b050'); p.px(13, 18.6, '#a01d1d');                             // medalha
  // espada de treino: guarda, ergue, corta, volta
  const mao = k === 1 ? [16, 7] : k === 2 ? [22, 19] : [19, 19];
  p.r(9, 16, 3, 6, tunica); p.r(9, 21, 3, 2, pele);
  p.l(19, 17, mao[0], mao[1] + 1, tunica, 2); p.r(mao[0] - 1, mao[1], 3, 2, pele);
  if (k === 1) { p.l(16, 7, 16, 0, lamina, 1); p.r(14.5, 7, 4, 1, '#c9a050'); }
  else if (k === 2) { p.l(22, 19, 30, 27, lamina, 1); p.r(21, 18, 2, 2, '#c9a050'); for (const [x, y] of [[27, 17], [29, 21], [24, 13]]) p.r(x, y, 1, 1, '#ffffff'); }
  else { p.l(20, 18, 26, 8, lamina, 1); p.r(18.5, 18.5, 3, 1, '#c9a050'); }
  // cabeça: careca de lado grisalho, testa franzida e a barba comprida
  p.bola(16, 10.5, 4.4, 4.4, pele);
  p.r(11.5, 9, 2, 4, cabelo); p.r(18.5, 9, 2, 4, cabelo); p.r(12, 7.5, 8, 1, tom(pele, 0.85));
  p.r(13, 9.5, 2.5, 1, cabelo); p.r(17, 9.5, 2.5, 1, cabelo);
  if (f === 19) { p.r(13.5, 11, 1.4, 0.5, '#141414'); p.r(17.5, 11, 1.4, 0.5, '#141414'); }
  else { p.r(13.5, 10.5, 1.4, 1, '#141414'); p.r(17.5, 10.5, 1.4, 1, '#141414'); }
  p.poli([[12.5, 12.5], [19.5, 12.5], [18.5, 19], [16, 21.5], [13.5, 19]], barba); p.l(16, 14, 16, 20, tom(barba, 0.8), 1);
  p.r(14, 13, 4, 1, tom(pele, 0.7));
}
// Tesoureira de Piltover: casaco azul-petróleo com debrum dourado, óculos redondos, coque ruivo, livro-caixa e a chave do cofre
function tesoureira(p, a, f) {
  const pele = '#e8c0a0', casaco = '#1f6a74', casacoE = '#164e56', ouro = '#d8b050', cabelo = '#a8502a', blusa = '#efe6d6', livro = '#6a3a22';
  pernasFrente(p, '#2a2e3a', '#18181e');
  p.poli([[9.5, 16], [22.5, 16], [24, 28], [8, 28]], casacoE);                     // a saia do casaco
  p.bola(16, 19, 6.4, 5.8, casaco);
  p.poli([[13, 14], [16, 20], [19, 14]], blusa); p.r(15.4, 15, 1.2, 1.2, ouro);       // a gola e o broche
  p.l(16, 20, 16, 27, ouro, 0.8); for (const y of [21, 23.5, 26]) p.px(15.6, y, '#fff0a0');   // botões dourados
  p.r(8, 27.4, 16, 0.8, ouro);
  // o livro-caixa no braço esquerdo
  p.r(8, 16, 3, 5, casaco); p.r(8.5, 19, 6, 4, livro); p.r(9, 19.4, 5, 0.6, '#e8d8a8'); p.r(10, 20, 2, 2, ouro);
  // a chave do cofre: gira na mão (10 a 13) ou sobe no cumprimento (20 a 23)
  const chave = (x, y, deitada) => { if (deitada) { p.r(x, y, 5, 1, ouro); p.r(x + 3.4, y + 1, 1, 1.4, ouro); p.bola(x - 0.6, y + 0.4, 1.4, 1.4, ouro); p.px(x - 0.6, y + 0.4, '#5a3a10'); } else { p.r(x, y, 1, 5, ouro); p.r(x + 1, y + 3.4, 1.4, 1, ouro); p.bola(x + 0.4, y - 0.6, 1.4, 1.4, ouro); p.px(x + 0.4, y - 0.6, '#5a3a10'); } };
  if (f >= 20 && f <= 23) { const w = [-1, 1, -1, 1][f - 20]; p.r(21, 10, 3, 6, casaco); p.r(21 + w, 8, 3, 2.4, pele); chave(22 + w, 3, false); }
  else if (f >= 10 && f <= 13) { p.r(21, 15, 3, 5, casaco); p.r(21, 19.5, 3, 2, pele); chave(22, 21, f % 2 === 1); }
  else { p.r(21, 16, 3, 6, casaco); p.r(21, 21, 3, 2, pele); chave(22, 22, false); }
  // cabeça: coque ruivo, óculos redondos dourados e um sorriso
  p.bola(16, 10.5, 4.5, 4.4, pele);
  p.bola(16, 7, 5, 2.6, cabelo); p.bola(16, 3.6, 2.4, 2.2, cabelo); p.r(11.4, 7, 1.4, 5, cabelo); p.r(19.2, 7, 1.4, 5, cabelo);
  p.px(16, 2.4, ouro);
  if (f === 19) { p.r(13.4, 10.6, 1.5, 0.6, '#2a1a10'); p.r(17.1, 10.6, 1.5, 0.6, '#2a1a10'); }
  else { p.r(13.4, 10, 1.5, 1.5, '#2a1a10'); p.r(17.1, 10, 1.5, 1.5, '#2a1a10'); p.px(13.4, 10, '#ffffff'); p.px(17.1, 10, '#ffffff'); }
  for (const x of [12.6, 16.3]) { p.r(x, 9.2, 3, 0.6, ouro); p.r(x, 11.8, 3, 0.6, ouro); p.r(x, 9.2, 0.6, 3.2, ouro); p.r(x + 2.4, 9.2, 0.6, 3.2, ouro); }      // óculos redondos
  p.r(15.6, 10.2, 0.7, 0.5, ouro);
  p.r(12, 12, 1.4, 1, '#f09a8a'); p.r(18.6, 12, 1.4, 1, '#f09a8a');
  p.r(15, 13.4, 2, 0.7, '#a04040');
}
// Mercador (mercado dos jogadores): túnica roxa com debrum dourado, turbante azul com a joia, barba pontuda e a balança
// de pesar ouro na mão. Quadros: 10 a 13 pesando (os pratos sobem e descem), 19 piscando, 20 a 23 acenando com a bolsa
function mercador(p, a, f) {
  const pele = '#c88a60', robe = '#5a2a7a', robeE = tom(robe, 0.72), ouro = '#d8b050', faixa = '#e8a020', turbante = '#2a7a8a';
  const barba = '#2a1a14', bolsa = '#8a5a2a', moeda = '#ffd84a', joia = '#e83a5a';
  pernasFrente(p, '#3a2a3a', '#2a1a14');
  p.poli([[9.5, 16], [22.5, 16], [24, 28], [8, 28]], robeE);                       // a túnica comprida
  p.bola(16, 19, 6.4, 5.8, robe);
  p.l(16, 18, 16, 27.6, ouro, 0.8); p.r(8, 27.4, 16, 0.8, ouro);                     // debrum dourado
  p.poli([[12.5, 14.4], [16, 18.4], [19.5, 14.4]], tom(robe, 1.35)); p.bola(16, 17.4, 0.9, 0.9, ouro);      // gola e o medalhão
  p.r(9.5, 21, 13, 1.4, faixa); p.r(9.5, 21, 13, 0.4, tom(faixa, 1.25)); p.r(14.8, 20.6, 2.4, 2.2, ouro);  // faixa com a fivela
  p.bola(10.6, 23.4, 1.8, 2.1, bolsa); p.r(10.2, 21.8, 0.8, 0.8, ouro);                                   // bolsinha no cinto
  // braço esquerdo: a balança de pesar ouro (os pratos balançam quando ele pesa)
  const k = f >= 10 && f <= 13 ? [0, 1.4, 0, -1.4][f - 10] : 0;
  p.r(8, 16, 3, 5, robe); p.r(8.4, 20.4, 2.4, 1.8, pele);
  p.r(9.2, 11, 0.8, 9.6, '#8a6a3a');                                                   // o cabo
  p.l(5, 12 + k, 13.4, 12 - k, ouro, 0.8);                                             // o travessão
  for (const [x, y, cheio] of [[5, 12 + k, true], [13.4, 12 - k, false]]) {
    p.l(x, y, x - 1.4, y + 3, '#b8a070', 0.4); p.l(x, y, x + 1.4, y + 3, '#b8a070', 0.4);
    p.r(x - 2, y + 3, 4, 0.9, ouro);
    if (cheio) { p.r(x - 1.2, y + 2.2, 1.2, 0.8, moeda); p.r(x, y + 2.2, 1.2, 0.8, moeda); p.px(x - 0.6, y + 1.6, moeda); }
  }
  // braço direito: parado com a mão na faixa, ou acenando com a bolsa de moedas
  if (f >= 20 && f <= 23) {
    const w = [-1, 1, -1, 1][f - 20];
    p.r(21, 10, 3, 6, robe); p.r(21 + w, 8, 3, 2.4, pele);
    p.bola(22.5 + w, 5.8, 2.2, 2.4, bolsa); p.r(21.6 + w, 3.4, 1.8, 0.8, ouro); p.px(23 + w, 5, moeda); p.px(22 + w, 6.4, moeda);
  } else { p.r(21, 16, 3, 5, robe); p.r(21, 20.4, 3, 1.8, pele); }
  // cabeça: turbante azul com a joia, olhos, bigode e a barba pontuda
  p.bola(16, 10.5, 4.5, 4.4, pele);
  p.r(12, 12, 1.4, 1, '#d8806a'); p.r(18.6, 12, 1.4, 1, '#d8806a');
  if (f === 19) { p.r(13.5, 10.6, 1.5, 0.6, '#1a1008'); p.r(17, 10.6, 1.5, 0.6, '#1a1008'); }
  else { p.r(13.5, 10, 1.5, 1.5, '#1a1008'); p.r(17, 10, 1.5, 1.5, '#1a1008'); p.px(13.5, 10, '#ffffff'); p.px(17, 10, '#ffffff'); }
  p.l(13, 9, 15, 8.7, barba, 0.6); p.l(17, 8.7, 19, 9, barba, 0.6);                  // sobrancelhas
  p.poli([[12.6, 12.6], [16, 12], [19.4, 12.6], [18.6, 14.2], [17, 13.4], [15, 13.4], [13.4, 14.2]], barba);   // bigode
  p.poli([[13.6, 13.6], [18.4, 13.6], [16, 18.6]], barba); p.l(16, 14, 16, 18, tom(barba, 1.6), 0.4);        // barba pontuda
  if (f >= 20 && f <= 23) p.r(15, 14, 2, 0.7, '#a04030');
  p.bola(16, 5.6, 5.6, 2.8, turbante); p.r(10.6, 6.6, 10.8, 1.5, tom(turbante, 0.78)); p.l(11.4, 4.6, 20.6, 4.6, tom(turbante, 1.3), 0.6);
  p.bola(16, 2.6, 2.4, 1.6, turbante);
  p.bola(16, 5.4, 1.3, 1.3, ouro); p.bola(16, 5.4, 0.8, 0.8, joia); p.px(15.8, 5.1, '#ffffff');
}
const NPC_FRENTE = { soraka, lojista, capitao, mestre, tesoureira, mercador };
// Montaria de Runeterra, de lado olhando para a esquerda (o cena espelha para a direita): o Burrinho com a sela e o
// Cavalo de Guerra de Demacia (skin da Loja: branco, crina dourada, manta azul com as asas de Demacia, testeira e penacho).
// Quadros: 0 parado · 19 piscando · 20 a 27 andando (passo em 4 tempos: uma pata de cada vez, o corpo sobe e desce
// duas vezes por ciclo, a cabeça acompanha e o rabo balança)
const fasePasso = (f) => (f >= 20 && f <= 27 ? (f - 20) / 8 : -1);
// quanto o corpo da montaria sobe em cada quadro (o cavaleiro sobe junto; ver cena.js)
export const subidaMontaria = (f) => { const ph = fasePasso(f); return ph < 0 ? 0 : -0.9 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 4)); };
function montaria(p, a, dir, f) {
  const cav = a.tipo === 'cavalo';
  const pelo = cav ? '#ece8e0' : '#8a7c6c', pelo2 = cav ? '#c4bcb0' : '#6e6254', barriga = cav ? '#faf8f2' : '#bcae98';
  const focinho = cav ? '#d4ccc4' : '#d8cab2', crina = cav ? '#e8cc70' : '#3e342c', casco = cav ? '#5a4a3a' : '#2a221c';
  const ph = fasePasso(f), anda = ph >= 0, s = subidaMontaria(f);
  const cab = anda ? Math.sin(ph * Math.PI * 4 + 1) * 0.6 : 0;          // a cabeça balança no ritmo do passo
  p.o(16.5, 29.5, cav ? 12 : 11, 1.8, 'rgba(0,0,0,0.3)');
  // patas: traseira de lá, dianteira de lá, traseira de cá, dianteira de cá (uma de cada vez). A pata vai para a frente
  // (para a esquerda, onde está a cabeça) levantada e volta apoiada no chão
  const topo = cav ? 20.8 : 21.5, alto = cav ? 7.2 : 6.5;
  for (const [x, cor, off] of [[21.5, pelo2, 0], [12.5, pelo2, 0.25], [23.5, pelo, 0.5], [10.5, pelo, 0.75]]) {
    const th = (ph + off) * Math.PI * 2, dx = anda ? -Math.sin(th) * 1.9 : 0, up = anda ? Math.max(0, Math.cos(th)) * 1.6 : 0;
    const joelho = up > 0.8 ? 0.6 : 0;          // levantada, a canela dobra um pouco
    p.r(x + dx * 0.5, topo + s, 1.8, (alto - up) * 0.5, cor);
    p.r(x + dx - joelho, topo + s + (alto - up) * 0.5 - 0.2, 1.8, (alto - up) * 0.5 + 0.2 - s, cor);
    p.r(x + dx - joelho - 0.2, 27.6 - up, 2.2, 1.4, casco);
  }
  // rabo
  const rabo = anda ? Math.sin(ph * Math.PI * 2) * 1.4 : 0;
  if (cav) { p.l(25, 16.5 + s, 27 + rabo, 23, crina, 1.8); p.bola(27.2 + rabo, 23.8, 1.3, 2.2, crina); }
  else { p.l(25, 17 + s, 26.5 + rabo, 22, pelo2, 1.2); p.bola(26.8 + rabo, 23.4, 1.2, 1.8, crina); }
  // corpo e barriga
  p.bola(17.5, 19 + s, 8.2, 4.8, pelo); p.bola(17.5, 21.4 + s, 6.5, 2.3, barriga);
  // manta: vermelha no Burrinho; azul com a borda dourada e as asas brancas de Demacia no Cavalo
  if (cav) {
    p.r(11, 14.4 + s, 13, 7.2, '#2c4ea8'); p.r(11, 14.4 + s, 13, 0.8, '#4a72d4'); p.r(11, 21.2 + s, 13, 1, '#e8c050');
    for (const x of [12, 15, 18, 21]) p.r(x, 22.2 + s, 1.4, 0.8, '#e8c050');
    p.poli([[15.4, 17.6 + s], [17.6, 15.8 + s], [19.8, 17.6 + s], [17.6, 20.2 + s]], '#f4f0e0'); p.px(17.4, 17.6 + s, '#e8c050');
  } else {
    p.r(12.5, 14.6 + s, 9.5, 5, '#a83030'); p.r(12.5, 14.6 + s, 9.5, 0.8, '#c84a3a'); p.r(12.5, 19.3 + s, 9.5, 0.9, '#e0b84a');
    for (const x of [13.5, 16.5, 19.5]) p.px(x, 19.8 + s, '#e0b84a');
  }
  // sela de couro com o arção na frente e atrás
  p.r(14.2, 12.6 + s, 6.6, 2.4, '#6a4224'); p.r(14.2, 12.6 + s, 6.6, 0.7, '#8a5a32');
  p.r(13.4, 11.6 + s, 1.4, 1.8, '#8a5a32'); p.r(20.2, 11.4 + s, 1.6, 2, '#8a5a32');
  // pescoço com a crina e a cabeça
  const hy = (cav ? 11.8 : 12.5) + s + cab;
  p.poli([[12, 17 + s], [9.5, 12 + s + cab * 0.5], [7, 11 + s + cab], [8, 15 + s + cab * 0.6], [11, 19 + s]], pelo);
  p.poli([[11.6, 16.5 + s], [9.2, 11.6 + s + cab * 0.5], [8.6, 10.6 + s + cab], [10.6, 15 + s + cab * 0.5]], crina);
  if (cav) { p.bola(5.8, hy, 3.2, 2.2, pelo); p.bola(2.6, hy + 1, 2.2, 1.6, focinho); }
  else { p.bola(5.6, hy, 3.4, 2.5, pelo); p.bola(3, hy + 0.9, 2, 1.7, focinho); }
  p.px(2, hy + 0.4, '#4a3a2c'); p.r(1.8, hy + 2.1, 2.2, 0.5, '#5a4a3c');
  if (f === 19) p.r(5.6, hy - 0.6, 1.4, 0.5, '#1a1410');
  else { p.r(5.6, hy - 1, 1.3, 1.3, '#1a1410'); p.px(5.6, hy - 1, '#ffffff'); }
  // rédea até a sela
  p.l(3.6, hy + 1.4, 13.6, 13 + s, '#4a2a14', 0.5);
  if (cav) {
    p.poli([[6.6, hy - 2], [6.8, hy - 4.6], [8, hy - 2.2]], pelo2); p.poli([[7.8, hy - 2], [8.6, hy - 4.4], [9.2, hy - 1.8]], pelo);
    p.r(3.2, hy - 1.9, 4.2, 1.2, '#c8ccd8'); p.px(4.6, hy - 1.6, '#e8c050');
    p.bola(8.4, hy - 5.4, 1.3, 2.2, '#3a6ad0'); p.bola(9, hy - 6.6, 0.9, 1.3, '#f4f0e0');
  } else {
    const oy = hy - 2.4, mexe = anda ? cab * 0.8 : 0;          // as orelhas balançam andando
    p.poli([[6.5, oy], [6 + mexe, oy - 6], [8 + mexe, oy - 5.6], [8.4, oy]], pelo2);
    p.poli([[7.6, oy], [8.6 + mexe, oy - 6.4], [10 + mexe, oy - 5.6], [9.4, oy]], pelo);
    p.px(8.8 + mexe * 0.5, oy - 3.6, '#c8a898');
  }
}
// Burrinho de Carga (Fonte): de lado, com a manta vermelha, um saco e o baú da Tesoureira nas costas.
// Quadros: 0 parado · 10 a 13 rabo balançando, orelha mexendo e cabeça pastando · 19 piscando · 20 a 23 zurrando (cabeça para cima)
function burro(p, a, dir, f) {
  const pelo = '#8a7c6c', pelo2 = '#6e6254', barriga = '#bcae98', focinho = '#d8cab2', crina = '#3e342c', casco = '#2a221c';
  const zurra = f >= 20 && f <= 23, pasta = f === 12, abre = zurra && f % 2 === 0;
  const rabo = f === 11 ? -2 : f === 13 ? 2 : zurra ? 1 : 0, orelha = f === 12 || zurra ? 1 : 0, sobe = zurra ? -2 : pasta ? 3 : 0;
  // sombra e patas (as de trás um pouco mais escuras)
  p.o(16.5, 29.5, 11, 1.8, 'rgba(0,0,0,0.3)');
  for (const [x, cor] of [[21.5, pelo2], [12.5, pelo2], [23.5, pelo], [10.5, pelo]]) { p.r(x, 21.5, 1.8, 6.5, cor); p.r(x - 0.2, 27.6, 2.2, 1.4, casco); }
  // rabo com o tufo escuro na ponta
  p.l(25, 17, 26.5 + rabo, 22, pelo2, 1.2); p.bola(26.8 + rabo, 23.4, 1.2, 1.8, crina);
  // corpo, barriga e a manta
  p.bola(17.5, 19, 8.2, 4.8, pelo); p.bola(17.5, 21.4, 6.5, 2.3, barriga);
  p.r(12, 14.5, 10.5, 5.5, '#a83030'); p.r(12, 19.4, 10.5, 1, '#e0b84a'); p.r(12, 14.5, 10.5, 0.8, '#c84a3a');
  for (const x of [13, 16, 19, 22]) p.px(x, 19.8, '#e0b84a');
  // a carga: saco de pano amarrado e o baú da Tesoureira (com a fechadura dourada), presos com corda
  p.bola(14, 12.4, 2.8, 2.6, '#c8a868'); p.r(13.4, 9.6, 1.4, 1.2, '#8a6a3a'); p.px(13, 12, '#e8d0a0');
  p.r(16.5, 9, 6.5, 5.6, '#7a4a24'); p.r(16.5, 9, 6.5, 1.2, '#a06a34'); p.r(16.5, 11.6, 6.5, 0.7, '#4a2c14');
  p.r(19.2, 11.2, 1.2, 1.6, '#e0b84a'); p.px(19.5, 12, '#5a3a10');
  p.l(15, 14.6, 23, 9.4, '#5a4a30', 0.6);
  // pescoço com a crina e a cabeça (abaixa para pastar, sobe para zurrar)
  p.poli([[12, 17], [9.5, 12 + sobe * 0.6], [7, 11 + sobe], [8, 15 + sobe * 0.4], [11, 19]], pelo);
  p.poli([[11.6, 16.5], [9.2, 11.6 + sobe * 0.6], [8.6, 10.6 + sobe], [10.6, 15]], crina);
  const hy = 12.5 + sobe;
  p.bola(5.6, hy, 3.4, 2.5, pelo); p.bola(3, hy + 0.9, 2, 1.7, focinho);
  p.px(2, hy + 0.4, '#4a3a2c');
  if (abre) { p.r(1.6, hy + 2, 2.6, 1.2, '#4a1a1a'); p.px(2.2, hy + 2, '#ffffff'); }
  else p.r(1.8, hy + 2.1, 2.2, 0.5, '#5a4a3c');
  if (f === 19) p.r(5.6, hy - 0.6, 1.4, 0.5, '#1a1410');
  else { p.r(5.6, hy - 1, 1.3, 1.3, '#1a1410'); p.px(5.6, hy - 1, '#ffffff'); }
  // orelhas compridas (mexem e vão para trás ao zurrar)
  const oy = hy - 2.4;
  p.poli([[6.5, oy], [6 - orelha * 2, oy - 6 + orelha * 2], [8 - orelha * 2, oy - 5.6 + orelha * 2], [8.4, oy]], pelo2);
  p.poli([[7.6, oy], [8.6, oy - 6.4 + orelha], [10, oy - 5.6 + orelha], [9.4, oy]], pelo);
  p.px(8.8, oy - 3.6 + orelha, '#c8a898');
}
// forma 'npc': de frente usa o desenho próprio; de lado e de costas, o humanoide com as cores do NPC
function npc(p, a, dir, f) {
  if (dir === DIR.S) NPC_FRENTE[a.npc](p, a, f);
  else humanoide(p, a, dir, f >= 10 ? 0 : f);       // (19 a 23 também caem no 0: piscar/cumprimentar é só de frente)
}
// Ornn na forja: bigorna na frente, lingote em brasa, martelo sobe e desce (quadros 10 a 13)
function ornnForja(p, f) {
  const k = f - 10, metal = '#6a6a76', lava = '#ff8a20', lavaC = '#ffd060';
  // bigorna à frente, à direita
  p.r(22, 25, 7, 5, '#4a3020'); p.poli([[19, 22], [31, 22], [29.5, 25], [20.5, 25]], '#4a4e58'); p.r(19, 22, 12, 1, '#8a8e98');
  p.r(23, 21, 5, 1.2, k === 2 ? '#fff4c0' : lavaC); p.r(23, 21.6, 5, 0.8, lava);
}

const GERADORES = { darius, ezreal, lux, yasuo, katarina, taric, zac, humanoide, fera, golem, verme, dragao, torre, ornn, poro, aranha, tropa, mago, cerco, arraia, olhoVazio, javali, sentinela, npc, burro, montaria };

// Aparências: o motor só conhece nomes; aqui cada inimigo vira um "looktype"
export const APARENCIAS = {
  darius: { forma: 'darius', pele: '#d29a74', cabelo: '#2a2626', barba: '#3a3232', arm: '#4a4f5c', ombro: '#5a5e6a',
    calca: '#2e2a2e', capa: '#a01d1d', elmo: null, fio: '#b02020' },
  ezreal: { forma: 'ezreal', pele: '#efc29a', cabelo: '#f0c43a', arm: '#9a5230', ombro: '#2a8ae0', calca: '#3a5a9a',
    manopla: '#e0b040', brilho: '#5ad0ff', oculos: '#c8d4dc', olho: '#2a7ae8' },
  lux: { forma: 'lux', joia: '#5ab8ff', pele: '#f2cca8', cabelo: '#f4d468', roupa: '#f2eee6', azul: '#3a64c8', ouro: '#e6b440', cristal: '#ff9ae0', olho: '#3a8ae8',
    botas: '#ece8f0', meia: '#dcd8e8', cajado: '#c89a4a' },
  katarina: { forma: 'katarina', pele: '#f0c8a8', cabelo: '#c8202c', roupa: '#2a2228', tira: '#b01c2a', metal: '#8a8e98', calca: '#1e1a22', botas: '#2a2228',
    lamina: '#dfe6ee', cabo: '#5a1a20', guarda: '#c8a050', olho: '#3aa070', brilho: '#ff3a4a' },
  taric: { forma: 'taric', pele: '#c98e66', cabelo: '#8a5a34', ouro: '#e2b44a', azul: '#2a6ab8', joia: '#4ae0e8', calca: '#2a3a6a', botas: '#b88a3a',
    cabo: '#7a5a3a', cristal: '#6af0ff', olho: '#3a8ae8' },
  zac: { forma: 'zac', corpo: '#5fcf3a', brilho: '#a6f06a', sombra: '#2c7a1e', olho: '#f2e94a', nucleo: 'rgba(16,64,12,0.5)', boca: '#12280c', dente: '#eef6d8',
    faixa: '#4a4c56', metal: '#9aa0aa' },
  yasuo: { forma: 'yasuo', pele: '#dba57e', cabelo: '#33261f', roupa: '#36598e', faixa: '#c8a86a', couro: '#7a4a2a', metal: '#a8b2bd',
    calca: '#262c44', botas: '#3e2e24', faixaPerna: '#c9bca0', lamina: '#dde5ee', cabo: '#2a1c18', guarda: '#c9a24a', olho: '#2a1c18', vento: '#bfe8ff',
    conta: '#5a3a2a', pedra: '#9ad8ff' },
  'Tropa Corpo a Corpo': { forma: 'tropa', arm: '#3b6dd0', calca: '#2c3550', elmo: '#8aa4d8', escudo: '#c9a050', pequeno: true },
  'Tropa Mago': { forma: 'mago', robe: '#4e54c4', capuz: '#2e3a8e', orbe: '#8ae8ff', pequeno: true },
  'Tropa de Cerco': { forma: 'cerco', cor: '#6d93e0', bandeira: '#3b6dd0', escala: 1.25 },
  'Lobo Gigante': { forma: 'fera', cor: '#6c7080', olho: '#ffe066', barriga: '#a8acb8', juba: '#9aa0ae', escala: 1.75 },
  'Krug Anciã': { forma: 'golem', cor: '#7c6a52', olho: '#ffb040', musgo: '#5a8a3a', escala: 1.6 },
  'Sentinela Azul': { forma: 'sentinela', cor: '#5a7090', olho: '#d8f4ff', cristal: '#4ec8ff', escala: 1.75 },
  'Brambleback Vermelho': { forma: 'javali', cor: '#8a3424', olho: '#ffe070', cristal: '#ff7a3a', escala: 1.75 },
  'Larva do Vazio': { forma: 'verme', cor: '#7a3fa4', olho: '#d06bff', espinhos: '#c7a3ff', escala: 1.2 },
  'Cria de Vilemaw': { forma: 'verme', cor: '#2f6f72', olho: '#8afff0', espinhos: '#b890ff' },
  'Vilemaw': { forma: 'verme', cor: '#2a5a6a', olho: '#7affe8', espinhos: '#c8a0ff', grande: true, escala: 2 },      // reserva: a arte de verdade é a da IA (js/vilemaw.js)
  'Arraia do Rio': { forma: 'arraia', cor: '#2f8c8c', barriga: '#9ae8d8', olho: '#ffffff', escala: 1.4 },
  'Dragão Ancião (filhote)': { forma: 'dragao', cor: '#5a6a8a', asa: '#8a6aa8', olho: '#b8f0ff', escala: 1.4 },
  'Criatura do Vazio': { forma: 'olhoVazio', cor: '#5c2f7a', olho: '#ff5af0', cristal: '#b06aff', escala: 1.5 },
  Soraka: { forma: 'npc', npc: 'soraka', pele: '#8fa8e8', cabelo: '#eef2ff', arm: '#d8d0f0', robe: '#e8e2fa', ombro: '#f0d060',
    calca: '#6a6aa8', arma: 'cajado', orbe: '#ffe86a', olho: '#3a3a7a' },
  Lojista: { forma: 'npc', npc: 'lojista', pele: '#e0b890', cabelo: '#7a4a28', barba: '#8a5a30', arm: '#6a4a2a', robe: '#8a6a3a',
    calca: '#4a3a2a', ombro: '#c8a040' },
  'Mestre da Legião': { forma: 'npc', npc: 'mestre', pele: '#c8946c', cabelo: '#4a4a4a', barba: '#6a6a6a', arm: '#5a2a2a', ombro: '#8a8a94',
    calca: '#2a2a2a', capa: '#7a1414', arma: 'espada', elmo: '#6a6a74' },
  'Capitão da Legião': { forma: 'npc', npc: 'capitao', pele: '#d0a07a', cabelo: '#2a2020', barba: '#3a2a2a', arm: '#3a3a44', ombro: '#a01d1d',
    calca: '#2a2a30', capa: '#a01d1d', arma: 'espada', elmo: '#8a8a94' },
  Ornn: { forma: 'ornn', grande: true },
  'Burrinho de Carga': { forma: 'burro', escala: 1.35 },
  // montarias de Runeterra (ver montaria)
  Montaria: { forma: 'montaria', tipo: 'burro', escala: 1.5 },
  'Montaria@cavalo': { forma: 'montaria', tipo: 'cavalo', escala: 1.62 },
  Mercador: { forma: 'npc', npc: 'mercador', pele: '#c88a60', cabelo: '#2a1a14', arm: '#5a2a7a', robe: '#5a2a7a', ombro: '#d8b050', calca: '#3a2a3a', olho: '#1a1008' },
  'Tesoureira de Piltover': { forma: 'npc', npc: 'tesoureira', pele: '#e8c0a0', cabelo: '#a8502a', arm: '#1f6a74', robe: '#1f6a74', ombro: '#d8b050',
    calca: '#2a2e3a', olho: '#2a1a10' },
  // mascotes: desenhados em escala reduzida (mini), ancorados no chão
  Poro: { forma: 'poro', mini: 0.62 },
  Krugzinho: { forma: 'golem', cor: '#8c7a5e', olho: '#ffb040', mini: 0.55 },
  'Dragãozinho': { forma: 'dragao', cor: '#c2452a', asa: '#7a2618', olho: '#ffe23a', barriga: '#f0a060', mini: 0.55 },
  Aranhinha: { forma: 'aranha', cor: '#3b2f52', marca: '#8afff0', olho: '#ff5ae0', pata: '#7a68a8', mini: 0.72 },
  'Torre Externa': { forma: 'torre', cor: '#8a8478', cristal: '#58b8ff', grande: true, parada: true },
  'Arauto do Vale': { forma: 'golem', cor: '#7a2f8a', olho: '#ff9af0', cristal: '#d88aff', grande: true },
  'Dragão Infernal': { forma: 'dragao', cor: '#c2452a', asa: '#7a2618', olho: '#ffe23a', barriga: '#f0a060', grande: true, escala: 1.5 },
  'Barão Nashor': { forma: 'verme', cor: '#6a3a9a', olho: '#ff5ae0', espinhos: '#c8a0ff', grande: true, escala: 1.5 },
};
// cores de cada skin do Darius aplicadas sobre a aparência padrão
export const PALETAS_SKIN = {
  1:  { arm: '#3a3226', ombro: '#d8a830', capa: '#2a2622', calca: '#2a2420', elmo: '#c89a28', lamina: '#e8d8a0' },
  2:  { arm: '#46524a', ombro: '#58d058', capa: '#2a6a2a', calca: '#2a342a', lamina: '#9aff9a' },
  3:  { arm: '#34468a', ombro: '#e8e8f0', capa: '#2a3a9a', calca: '#222a4a', elmo: '#e8c040' },
  4:  { arm: '#e87a20', ombro: '#ffffff', capa: null, calca: '#f0f0f0', lamina: '#ff9a3a' },
  8:  { arm: '#24242e', ombro: '#e8e8e8', capa: '#7a1a1a', calca: '#2a2a3a', cabelo: '#4a3020' },
  14: { arm: '#262642', ombro: '#c040ff', capa: '#3a1a6a', calca: '#1a1a2a', lamina: '#d080ff', elmo: '#3a3a5a' },
  15: { arm: '#e0d098', ombro: '#ffd040', capa: '#b02020', calca: '#8a6a30', elmo: '#ffd040', lamina: '#fff0a0' },
  16: { arm: '#8a5a30', ombro: '#5a3a1a', capa: '#4a3020', calca: '#3a4a6a', elmo: '#3a2a1a', lamina: '#a0a0a0' },
  24: { arm: '#8a1a1a', ombro: '#e8b030', capa: '#c02020', calca: '#4a1010', lamina: '#ffd060' },
  33: { arm: '#1a1a1e', ombro: '#40e0ff', capa: '#2a0a2a', calca: '#101014', lamina: '#40e0ff' },
  43: { arm: '#3a4a6a', ombro: '#ff8ac0', capa: '#e86a9a', calca: '#2a3448', lamina: '#ffc0e0' },
  54: { arm: '#e8eef8', ombro: '#3a6ad8', capa: '#2a4aa8', calca: '#c8d0e0', lamina: '#9ac0ff' },
  64: { arm: '#f0f0ff', ombro: '#ffd040', capa: '#4a8aff', calca: '#c8c8e0', elmo: '#ffd040', lamina: '#a0e0ff' },
  65: { arm: '#c8a040', ombro: '#fff0a0', capa: '#e8c060', calca: '#8a6a20', elmo: '#fff0a0', lamina: '#fff8d0' },
  67: { arm: '#8a8a94', ombro: '#e03030', capa: null, calca: '#4a4a54', elmo: '#6a6a74', lamina: '#ff5050' },
};
// paletas das skins do Ezreal (só as cores mudam; a forma é a mesma)
export const PALETAS_SKIN_EZREAL = {
  1:  { arm: '#3a6a2a', ombro: '#6a4a2a', calca: '#4a3a2a', cabelo: '#c89a40', oculos: null, manopla: '#8a6a3a', brilho: '#c8ff7a' },
  2:  { arm: '#e8e8f0', ombro: '#2a5ad8', calca: '#2a5ad8', manopla: '#c8c8d0', brilho: '#ffd040' },
  3:  { arm: '#a8d8f0', ombro: '#ffffff', calca: '#5a7a9a', cabelo: '#f0e8c0', manopla: '#c8e8ff', brilho: '#e8ffff' },
  4:  { arm: '#8a6a3a', ombro: '#5a3a1a', calca: '#5a4a3a', oculos: '#3a3a3a', manopla: '#c09030', brilho: '#ffd060' },
  5:  { arm: '#2a2a3a', ombro: '#4ae0ff', calca: '#1a1a24', cabelo: '#f0d070', manopla: '#3ac8ff', brilho: '#aaf8ff', oculos: '#4ae0ff' },
  7:  { arm: '#3a3a4a', ombro: '#c02020', calca: '#2a2a34', manopla: '#c0c0c8', brilho: '#ff5050' },
  8:  { arm: '#1a1a1e', ombro: '#e8e8e8', calca: '#2a2a30', manopla: '#c8a040', brilho: '#ff4040' },
  9:  { arm: '#d84a9a', ombro: '#4ae0ff', calca: '#3a2a6a', cabelo: '#ffd84a', manopla: '#ffd84a', brilho: '#ff7af0' },
  18: { arm: '#3a3a9a', ombro: '#ffd040', calca: '#e8e8ff', cabelo: '#fff0a0', manopla: '#ffd040', brilho: '#ff9ae0' },
  19: { arm: '#e8e8f0', ombro: '#e8c040', calca: '#2a2a34', cabelo: '#f0d070', manopla: '#e8c040', brilho: '#ffe88a' },
  21: { arm: '#2a3a6a', ombro: '#e8e8f0', calca: '#3a3a44', manopla: '#c8a040', brilho: '#ff6a4a' },
  22: { arm: '#1a1a20', ombro: '#4ae08a', calca: '#2a2a30', cabelo: '#d8d8e8', oculos: '#4ae08a', manopla: '#3a3a44', brilho: '#4ae08a' },
  25: { arm: '#e8eef8', ombro: '#3a6ad8', calca: '#c8d0e0', manopla: '#3a6ad8', brilho: '#9ac0ff' },
  33: { arm: '#4a8a5a', ombro: '#e8b0d8', calca: '#3a5a3a', cabelo: '#f0e090', manopla: '#c8e070', brilho: '#ff9ae8' },
  43: { arm: '#1e1e26', ombro: '#e83a5a', calca: '#2a2a34', cabelo: '#f0e0b0', manopla: '#c0c0d0', brilho: '#ff4a6a' },
  44: { arm: '#c03a2a', ombro: '#ffd040', calca: '#5a1a1a', cabelo: '#f0d070', manopla: '#ffd040', brilho: '#ffe88a' },
};
// skins da Lux: só as cores mudam (roupa, saia, detalhes, cristal do cajado)
// Yasuo: Lua Sangrenta (3: preto e vermelho, cabelo branco) e Florescer Espiritual (36: branco e rosa, o vento cor-de-rosa)
// Katarina: Academia de Batalha (12: cabelo rosa, colete escuro e gravata rosa) e Rainha de Batalha (29: armadura branca e
// dourada, cabelo lilás e o brilho magenta)
export const PALETAS_SKIN_KATARINA = {
  12: { cabelo: '#f06aa0', roupa: '#2a2a3a', tira: '#e0407a', metal: '#c8c0d8', calca: '#3a2a4a', botas: '#2a2230', guarda: '#e8a0d0', brilho: '#ff7ac8', lamina: '#f4f0ff', cabo: '#4a2a5a', olho: '#6a4aa0' },
  10: { cabelo: '#6ae0f4', roupa: '#18262e', tira: '#2ab0d8', metal: '#7aa8b8', calca: '#121c22', botas: '#1a2a32', guarda: '#5ad8f0', brilho: '#6af0ff', lamina: '#d0faff', cabo: '#1a3a48', olho: '#7af4ff' },      // Jurada de Morte
  29: { cabelo: '#c8a8f0', roupa: '#eeeaf4', tira: '#d03a8a', metal: '#e8c060', calca: '#3a2a4a', botas: '#eeeaf4', guarda: '#e8c060', brilho: '#ff5ac8', lamina: '#fff4fa', cabo: '#d03a8a', olho: '#a050c0' },
};
// Taric: Esmeralda (1: armadura dourada com joias e cristal verdes) e Embalos no Espaço (18: cromado lilás, cabelo rosa,
// as joias e o martelo cor-de-rosa)
export const PALETAS_SKIN_TARIC = {
  1: { ouro: '#d8b850', azul: '#1e7a46', joia: '#3ae88a', cristal: '#5aff9a', calca: '#1a3a26', botas: '#a88a3a', olho: '#2aa060' },
  3: { ouro: '#5a4450', azul: '#2a1820', joia: '#ff2a48', cristal: '#ff4a64', calca: '#1a1016', botas: '#4a3640', cabelo: '#1c1416', cabo: '#2a1a22', olho: '#ff3a4a' },      // Cavaleiro de Hematita
  18: { ouro: '#e0b0f0', azul: '#6a2ab8', joia: '#ff6ad8', cristal: '#ff9af0', calca: '#2a1a5a', botas: '#c890ff', cabelo: '#f088c8', cabo: '#4a2a8a', olho: '#c040e0' },
};
// Zac: Arma Especial (1: roxo e magenta, olhos rosa e os ferrões) e Molho Picante (24: amarelo-queijo, o calção verde,
// as mangas brancas rasgadas e os pedacinhos de pimenta)
export const PALETAS_SKIN_ZAC = {
  1: { corpo: '#7a2a8a', brilho: '#d0389a', sombra: '#3a1048', olho: '#ff7ac8', nucleo: 'rgba(40,6,40,0.55)', boca: '#1a0618', dente: '#ffd0f0', ferroes: '#d0389a', faixa: '#2a2230', metal: '#c890d8' },
  24: { corpo: '#f5c518', brilho: '#ffe680', sombra: '#b8860b', olho: '#fff8e0', nucleo: 'rgba(150,80,0,0.4)', boca: '#5a2a08', dente: '#ffffff', faixa: null, calcao: '#1e6a5a', manga: '#f4f0e6', pintas: ['#d83a1a', '#3a9a2a'] },
};
export const PALETAS_SKIN_YASUO = {
  3: { roupa: '#2a1c26', faixa: '#c42838', couro: '#3a2a30', metal: '#5a5260', calca: '#1c141a', botas: '#2a1a1a', faixaPerna: '#8a2030', cabelo: '#e8e2dc', lamina: '#f0d8d8', guarda: '#c42838', cabo: '#1a0a0a', vento: '#ff7a7a', conta: '#8a1a24', pedra: '#ff5a5a' },
  9: { roupa: '#231c22', faixa: '#c8401a', couro: '#2e2024', metal: '#4a4048', calca: '#161216', botas: '#1e1618', faixaPerna: '#7a2416', cabelo: '#1a1416', lamina: '#ff8a4a', guarda: '#c8401a', cabo: '#120a0a', vento: '#ff7a3a', conta: '#5a1810', pedra: '#ff6a2a', olho: '#ff5a1a' },      // Emissário da Escuridão
  36: { roupa: '#f2e8f0', faixa: '#e8689e', couro: '#9a6ab0', metal: '#e8d0f4', calca: '#4a3a6a', botas: '#3a2a4a', faixaPerna: '#f0b8d4', cabelo: '#2a2238', lamina: '#fbeeff', guarda: '#e8689e', vento: '#ffb0d8', conta: '#9a4a7a', pedra: '#ffb0d8' },
};
export const PALETAS_SKIN_LUX = {
  6:  { roupa: '#fff0f8', azul: '#ff7ac8', ouro: '#ffd860', cristal: '#ffb0f0', cabelo: '#fff0a0', botas: '#ffffff', cajado: '#ffd860' },
  42: { roupa: '#1a2a36', azul: '#2ad8c0', ouro: '#7af0e0', cristal: '#5affd0', cabelo: '#e8f0ff', botas: '#16242e', meia: '#223644', cajado: '#2a4050', joia: '#ff5ac8', olho: '#3af0d0' },      // Empírea
  15: { roupa: '#f4f4f8', azul: '#2a3a7a', ouro: '#e6c040', cristal: '#ffe060', cajado: '#3a3a4a' },
};
// skins dos mascotes (Poro@rei, Krugzinho@lava, Dragãozinho@oceano…): só as cores mudam
export const PALETAS_PET = {
  Poro: { rei: { pelo: '#fff4d8', sombra: '#d8c08a', coroa: '#ffcc30' }, gelo: { pelo: '#d8f0ff', sombra: '#8ab8e0', chifre: '#a8e8ff', brilhos: '#ffffff' } },
  Krugzinho: { lava: { cor: '#4a3a34', olho: '#ff6a20', cristal: '#ff8a20' }, cristal: { cor: '#6a5a9a', olho: '#e8b0ff', cristal: '#c890ff' } },
  'Dragãozinho': { oceano: { cor: '#2a7ab8', asa: '#1a4a7a', olho: '#a8ffff', barriga: '#8ae0f0' }, anciao: { cor: '#5a3a8a', asa: '#3a2060', olho: '#ffd040', barriga: '#d8b0ff' } },
};
export const aparencia = (nome) => {
  const arroba = nome.indexOf('@');
  if (arroba > 0 && PALETAS_PET[nome.slice(0, arroba)]) return { ...APARENCIAS[nome.slice(0, arroba)], ...PALETAS_PET[nome.slice(0, arroba)][nome.slice(arroba + 1)] };
  if (nome.endsWith('#guardiao')) return { ...aparencia(nome.slice(0, -9)), guardiao: 1.4 };      // guardião de fortaleza: 40% maior
  if (nome.endsWith('#furioso')) return { ...aparencia(nome.slice(0, -8)), guardiao: 1.25 };      // monstro furioso do Rift: 25% maior
  if (nome.startsWith('darius@')) return { ...APARENCIAS.darius, ...PALETAS_SKIN[nome.slice(7)] };
  if (nome.startsWith('ezreal@')) return { ...APARENCIAS.ezreal, ...PALETAS_SKIN_EZREAL[nome.slice(7)] };
  if (nome.startsWith('lux@')) return { ...APARENCIAS.lux, ...PALETAS_SKIN_LUX[nome.slice(4)] };
  if (nome.startsWith('yasuo@')) return { ...APARENCIAS.yasuo, ...PALETAS_SKIN_YASUO[nome.slice(6)] };
  if (nome.startsWith('taric@')) return { ...APARENCIAS.taric, ...PALETAS_SKIN_TARIC[nome.slice(6)] };
  if (nome.startsWith('katarina@')) return { ...APARENCIAS.katarina, ...PALETAS_SKIN_KATARINA[nome.slice(9)] };
  if (nome.startsWith('zac@')) return { ...APARENCIAS.zac, ...PALETAS_SKIN_ZAC[nome.slice(4)] };
  return APARENCIAS[nome] || { forma: 'golem', cor: '#777777' };
};

// estilo novo: alguns monstros são desenhados maiores (mesmo tamanho de pixel, mais detalhe); só o desenho muda,
// o monstro continua ocupando o mesmo tile. Fica apoiado pelos pés (ver tamanhoExtra em cena.js)
export const escalaVisual = (a) => ((estiloNovoLigado() && a.escala) || 1) * (a.guardiao || 1);
export const tamanhoExtra = (nome) => { const a = aparencia(nome), base = a.grande ? 64 : 32; return Math.round(base * escalaVisual(a)) - base; };
const cacheSprites = new Map();
export function sprite(nome, dir, frame) {
  const chave = `${nome}|${dir}|${frame}`;
  let c = cacheSprites.get(chave);
  if (c) return c;
  const a = aparencia(nome);
  const tam = Math.round((a.grande ? 64 : 32) * escalaVisual(a));
  // quem não tem caminhada fluida usa os passos antigos conforme a fase do ciclo
  if (frame >= 20 && frame <= 27 && !FLUIDOS.has(a.forma) && a.forma !== 'npc' && a.forma !== 'burro' && a.forma !== 'montaria') return sprite(nome, dir, [0, 1, 1, 1, 0, 2, 2, 2][frame - 20]);      // NPC parado: 20 a 23 é o cumprimento
  // ataque em 4 tempos (30 a 33) e respiração parado (40 a 43): só os campeões do estilo novo têm; os outros usam 3 e 0
  const novo = estiloNovoLigado() && ANIM_NOVA.has(a.forma), monstroNovo = estiloNovoLigado() && MONSTROS_NOVOS.has(a.forma);
  if (frame >= 70 && !monstroNovo) return sprite(nome, dir, 0);          // quadros 70+ só dos monstros redesenhados
  if (frame >= 30 && frame < 70 && !novo) return sprite(nome, dir, frame < 40 ? 3 : 0);
  if (dir === DIR.O && a.forma !== 'torre') {
    c = espelhar(sprite(nome, DIR.L, frame));
  } else {
    c = tela(tam, tam);
    const p = new Pincel(c, a.mini || tam / 32);
    if (a.mini) p.g.translate(Math.round((32 - 32 * a.mini) / 2), Math.round(32 - 32 * a.mini) - 1);
    (monstroNovo ? GERADORES_NOVOS[a.forma] : GERADORES[a.forma])(p, a, a.forma === 'torre' ? DIR.S : dir, frame);
    contornar(c);
    if (estiloNovoLigado()) acabamento(c);
    if (a.pequeno && !monstroNovo) c = encolher(c);           // as tropas do estilo novo já são desenhadas pequenas
  }
  cacheSprites.set(chave, c);
  return c;
}
// tropas são um pouco menores: redesenha em 85% ancorado nos pés
function encolher(c) {
  const e = tela(32, 32), g = e.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, 32, 32, 3, 5, 27, 27);
  return e;
}

// corpo caído: o sprite deitado e escurecido, como os corpos que ficam no chão no OT
export function corpo(nome) {
  const chave = `corpo|${nome}`;
  if (cacheSprites.has(chave)) return cacheSprites.get(chave);
  const s = sprite(nome, DIR.L, 0), c = tela(s.width, s.height), g = c.getContext('2d');
  g.translate(s.width / 2, s.height / 2 + s.height * 0.18); g.rotate(Math.PI / 2); g.scale(1, 0.8);
  g.drawImage(s, -s.width / 2, -s.height / 2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(20,10,10,0.45)'; g.fillRect(0, 0, c.width, c.height);
  cacheSprites.set(chave, c);
  return c;
}

// machado gigante da Guilhotina Noxiana (efeito da R)
let machado;
export function efeitoMachado() {
  if (machado) return machado;
  const c = tela(40, 56), p = new Pincel(c);
  p.l(20, 4, 20, 54, '#5a3a22', 3); p.l(20, 4, 20, 54, '#7a5232', 1);
  p.poli([[22, 30], [38, 22], [39, 50], [22, 44]], '#b8bec8');
  p.poli([[22, 32], [35, 26], [36, 36], [22, 38]], '#e0e4ea');
  p.l(38, 22, 39, 50, '#8a1a1a', 1);
  p.poli([[18, 32], [6, 28], [6, 40], [18, 40]], '#8a8f99');
  p.bola(20, 29, 3, 3, '#a01d1d');
  machado = contornar(c);
  return machado;
}

// estandarte de Noxus fincado no chão (efeito da habilidade B)
let estandarte;
export function spriteEstandarte() {
  if (estandarte) return estandarte;
  const c = tela(32, 48), p = new Pincel(c);
  p.o(12, 46, 6, 2, 'rgba(0,0,0,0.35)');
  p.l(11, 4, 11, 46, '#6a4a2a', 2); p.bola(12, 4, 2, 2, '#e8c040');
  p.poli([[13, 7], [30, 7], [27, 15], [30, 23], [13, 23]], '#a01d1d'); p.poli([[13, 7], [30, 7], [29, 9], [13, 9]], '#c83030');
  p.bola(20, 15, 3.5, 3.5, '#e8c040'); p.r(19, 13, 2, 4, '#7a1414');
  estandarte = contornar(c);
  return estandarte;
}

// frascos de poção (ícones da interface e do loot)
const cachePocoes = new Map();
export function frasco(cor) {
  if (cachePocoes.has(cor)) return cachePocoes.get(cor);
  const c = tela(32, 32), p = new Pincel(c);
  p.bola(16, 20, 8, 8, cor);
  p.r(13, 7, 6, 6, '#c8d8e8'); p.r(12, 5, 8, 2, '#8a6a4a');
  p.r(11, 16, 3, 3, 'rgba(255,255,255,0.7)');
  const url = contornar(c).toDataURL();
  cachePocoes.set(cor, url);
  return url;
}

// ---------- Espólios (partes de monstros que o Lojista compra) ----------
// 32×32 no mesmo estilo dos sprites: formas simples, luz em cima/esquerda, sombra embaixo/direita e contorno escuro.
const cacheEspolios = new Map();
const DESENHO_ESPOLIO = {
  'escudo-quebrado'(p) {          // escudo azul da tropa, rachado e sem um pedaço
    p.poli([[7, 6], [25, 6], [25, 15], [16, 27], [7, 15]], '#3b6dd0');
    p.poli([[16, 6], [25, 6], [25, 15], [16, 27]], '#2c55a8');
    p.r(7, 6, 18, 2, '#8aa4d8'); p.r(15, 8, 2, 16, '#c8a040');
    p.poli([[19, 6], [25, 6], [25, 11]], '#00000000');
    p.l(18, 7, 14, 12, '#141420'); p.l(14, 12, 17, 16, '#141420'); p.l(17, 16, 13, 21, '#141420');
    p.r(9, 9, 2, 3, '#a8c0f0');
  },
  'po-arcano'(p) {                // saquinho de couro com pó roxo brilhando
    p.bola(16, 20, 8, 7, '#8a6a42'); p.r(13, 11, 6, 3, '#6a4a2a'); p.r(12, 13, 8, 2, '#c8a040');
    p.bola(16, 9, 4, 2.5, '#b8a8ff'); p.px(14, 7, '#ffffff'); p.px(19, 8, '#e8e0ff');
    for (const [x, y] of [[10, 6], [22, 5], [24, 10], [8, 11], [21, 3]]) p.px(x, y, '#d8c8ff');
    p.r(11, 18, 2, 2, '#b08a5a');
  },
  engrenagem(p) {                 // engrenagem de metal da tropa de cerco
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.r(16 + Math.cos(a) * 9.5 - 2, 16 + Math.sin(a) * 9.5 - 2, 4, 4, '#8a8a94'); }
    p.bola(16, 16, 9, 9, '#a8a8b0'); p.bola(16, 16, 3.5, 3.5, '#3a3a44'); p.px(16, 16, '#141418');
    p.r(11, 10, 3, 1, '#d8d8e0');
  },
  'pele-lobo'(p) {                // pele cinza esticada, com as patas nas pontas
    p.poli([[6, 8], [11, 10], [16, 7], [21, 10], [26, 8], [24, 16], [26, 24], [20, 22], [16, 26], [12, 22], [6, 24], [8, 16]], '#8a8e9c');
    p.poli([[16, 7], [21, 10], [26, 8], [24, 16], [26, 24], [20, 22], [16, 26]], '#6c7080');
    for (const [x, y] of [[11, 13], [15, 15], [19, 13], [13, 19], [18, 19]]) p.r(x, y, 3, 1, '#5a5e6a');
    p.r(9, 11, 2, 2, '#b8bcc8');
  },
  'presa-lobo'(p) {               // presa curva de marfim
    p.poli([[11, 6], [18, 6], [21, 14], [20, 22], [16, 27], [17, 20], [15, 13]], '#f0ead8');
    p.poli([[18, 6], [21, 14], [20, 22], [16, 27], [18, 18]], '#c8bea0');
    p.r(11, 5, 7, 3, '#a08a6a'); p.px(14, 10, '#ffffff'); p.px(15, 13, '#ffffff');
  },
  'pedra-krug'(p) {               // pedaço de Krug, com veio laranja quente
    p.poli([[7, 18], [10, 9], [18, 6], [25, 11], [26, 20], [19, 26], [10, 25]], '#9a8460');
    p.poli([[18, 6], [25, 11], [26, 20], [19, 26], [18, 16]], '#7a6648');
    p.l(11, 20, 15, 15, '#ffb040'); p.l(15, 15, 20, 17, '#ff8a20'); p.px(13, 17, '#ffe080');
    p.r(11, 10, 3, 2, '#c0aa80');
  },
  'cristal-azul'(p) {             // cristais da Sentinela Azul
    p.poli([[10, 26], [8, 14], [12, 10], [15, 26]], '#3ab0e0');
    p.poli([[14, 27], [13, 9], [17, 3], [21, 9], [20, 27]], '#6ee0ff');
    p.poli([[17, 3], [21, 9], [20, 27], [17, 27]], '#3ab0e0');
    p.poli([[20, 27], [21, 15], [25, 12], [25, 27]], '#2a8ac0');
    p.l(15, 10, 15, 22, '#d8f8ff'); p.px(16, 6, '#ffffff');
    p.r(7, 26, 19, 2, '#5a5e70');
  },
  espinho(p) {                    // espinho do Brambleback, vermelho e quente na ponta
    p.poli([[8, 26], [12, 21], [24, 5], [15, 24]], '#d84a2a');
    p.poli([[12, 21], [24, 5], [15, 24]], '#a8301a');
    p.poli([[19, 12], [24, 5], [21, 13]], '#ffb040');
    p.r(7, 24, 6, 4, '#5a3020'); p.px(14, 18, '#ff9a6a');
  },
  'escama-arraia'(p) {            // escama verde-água com nervuras
    p.bola(16, 16, 9, 11, '#5ac8c0'); p.poli([[16, 5], [25, 16], [16, 27]], '#3a9a94');
    p.l(16, 7, 16, 25, '#2a7a74'); p.l(16, 12, 11, 16, '#2a7a74'); p.l(16, 12, 21, 16, '#2a7a74'); p.l(16, 18, 11, 22, '#2a7a74'); p.l(16, 18, 21, 22, '#2a7a74');
    p.r(11, 9, 2, 3, '#b8f0e8');
  },
  quitina(p) {                    // placa roxa da carapaça da Larva do Vazio
    p.poli([[6, 20], [9, 10], [16, 6], [23, 10], [26, 20], [16, 24]], '#8a4ab8');
    p.poli([[16, 6], [23, 10], [26, 20], [16, 24]], '#6a3290');
    p.l(9, 15, 23, 15, '#4a2068'); p.l(10, 19, 22, 19, '#4a2068');
    p.r(11, 10, 3, 2, '#c890f0'); p.px(20, 12, '#d06bff');
  },
  'escama-dragao'(p) {            // escama azul-acinzentada com brilho metálico
    p.poli([[16, 4], [26, 13], [22, 26], [10, 26], [6, 13]], '#7a8ab8');
    p.poli([[16, 4], [26, 13], [22, 26], [16, 26]], '#5a6a98');
    p.poli([[16, 9], [21, 14], [16, 22], [11, 14]], '#9aaad8'); p.l(16, 9, 16, 22, '#4a5a88');
    p.px(10, 13, '#e8f0ff'); p.px(11, 12, '#e8f0ff');
  },
  'garra-dragao'(p) {             // três garras curvas presas num pedaço de couro
    p.r(8, 20, 16, 7, '#7a2618'); p.r(8, 20, 16, 2, '#a83a24');
    for (const x of [9, 15, 21]) { p.poli([[x, 21], [x + 1, 12], [x + 4, 6], [x + 3, 13], [x + 4, 21]], '#ffe0a0'); p.poli([[x + 4, 6], [x + 3, 13], [x + 4, 21], [x + 2, 21]], '#c8a870'); }
  },
  'olho-vazio'(p) {               // olho do Vazio, roxo com íris rosa
    p.bola(16, 16, 10, 8, '#e8d8f0'); p.l(8, 13, 12, 15, '#c04a8a'); p.l(24, 19, 20, 17, '#c04a8a');
    p.bola(16, 16, 5, 5, '#ff5af0'); p.bola(16, 16, 2.5, 3.5, '#2a0a2a'); p.px(14, 14, '#ffffff');
    p.r(6, 9, 20, 2, '#5c2f7a'); p.r(6, 22, 20, 2, '#5c2f7a');
  },
  'chifre-arauto'(p) {            // chifre roxo em espiral do Arauto
    p.poli([[7, 26], [10, 18], [15, 11], [22, 5], [26, 4], [22, 10], [18, 17], [14, 26]], '#a050c0');
    p.poli([[26, 4], [22, 10], [18, 17], [14, 26], [12, 24]], '#7a3290');
    for (const [x, y] of [[11, 21], [14, 16], [18, 11], [22, 7]]) p.l(x - 2, y + 1, x + 2, y - 1, '#d88aff');
    p.r(6, 25, 9, 3, '#4a2a5a');
  },
  'coracao-dragao'(p) {           // coração ainda em brasa do Dragão Infernal
    p.bola(12, 13, 6, 6, '#c2452a'); p.bola(20, 13, 6, 6, '#c2452a');
    p.poli([[6, 15], [26, 15], [16, 27]], '#c2452a'); p.poli([[16, 12], [26, 15], [16, 27]], '#962c18');
    p.bola(12, 14, 3, 3, '#ff8a3a'); p.px(10, 11, '#ffe080'); p.px(11, 10, '#ffe080');
    for (const [x, y] of [[9, 5], [16, 3], [22, 5]]) { p.r(x, y, 2, 3, '#ff8a20'); p.px(x, y - 1, '#ffe080'); }
  },
  'presa-barao'(p) {              // presa enorme do Barão, roxa e brilhando
    p.poli([[9, 4], [21, 4], [23, 14], [20, 23], [14, 29], [15, 20], [12, 12]], '#c8a0ff');
    p.poli([[21, 4], [23, 14], [20, 23], [14, 29], [18, 17]], '#8a5ad0');
    p.r(9, 3, 12, 3, '#5a2a7a'); p.l(14, 8, 15, 18, '#f0e0ff');
    for (const [x, y] of [[6, 10], [25, 18], [8, 22]]) p.px(x, y, '#ff5ae0');
  },
  'seda-vilemaw'(p) {             // novelo de seda da Vilemaw, claro e brilhando, com fios soltos
    p.bola(16, 18, 8, 7, '#b8b0e8'); p.bola(15, 17, 7, 6, '#e8e4ff');
    for (const [a, b, c, d] of [[9, 14, 23, 22], [10, 21, 22, 13], [12, 11, 20, 25]]) p.l(a, b, c, d, '#9a90d0');
    p.l(23, 22, 28, 28, '#d8d0ff'); p.l(9, 14, 4, 8, '#d8d0ff'); p.px(13, 14, '#ffffff'); p.px(19, 20, '#7affe8');
  },
  'presa-vilemaw'(p) {            // presa curva da Vilemaw, turquesa com a ponta acesa
    p.poli([[10, 4], [20, 4], [22, 13], [19, 22], [13, 29], [14, 19], [11, 12]], '#4ab8b0');
    p.poli([[20, 4], [22, 13], [19, 22], [13, 29], [17, 16]], '#2a7a78');
    p.r(10, 3, 10, 3, '#1a3a44'); p.l(13, 8, 14, 18, '#c8fff4'); p.px(13, 28, '#7affe8'); p.px(14, 27, '#ffffff');
  },
};
// ícone de um espólio (data URL); se não houver desenho, um saquinho genérico da cor dele
export function iconeEspolio(id, cor = '#b8a080') {
  if (cacheEspolios.has(id)) return cacheEspolios.get(id);
  const c = tela(32, 32), p = new Pincel(c);
  (DESENHO_ESPOLIO[id] || ((q) => { q.bola(16, 19, 8, 8, cor); q.r(13, 9, 6, 4, tom(cor, 0.6)); }))(p);
  const url = contornar(c).toDataURL();
  cacheEspolios.set(id, url);
  return url;
}

// ---------- Chão ----------
export const PISOS = {
  grama:  { cor: '#3f7a2c', prio: 3, grama: true },
  gramaE: { cor: '#2d5a22', prio: 3, grama: true },
  terra:  { cor: '#7a5a3a', prio: 4, pedrinhas: true },
  pedra:  { cor: '#6c6a66', prio: 5, tijolo: true },
  areia:  { cor: '#c2ac74', prio: 2, pedrinhas: true },
  agua:   { cor: '#2a5a9a', prio: 0, agua: true, bloqueia: true },
  ponte:  { cor: '#8a6a40', prio: 0 },
  cascalho: { cor: '#6c6a66', prio: 4 },
  escada:  { cor: '#8a8478', prio: 7, tijolo: true },      // a escada de pedra das fortalezas de Runeterra
  planalto: { cor: '#6f7a4c', prio: 3, grama: true },     // o chão lá em cima das fortalezas      // só no estilo novo: a 'pedra' fora das praças vira chão de cascalho        // só no estilo novo (a ponte é pintada no chão em arte-nova.js)
  vazio:  { cor: '#3a2448', prio: 3, brilho: '#9a5ad0' },
  lama:   { cor: '#4a3a44', prio: 4, pedrinhas: true },
  fonte:  { cor: '#4e5e80', prio: 6, laje: true, brilho: '#a8e0ff' },
};

const cachePisos = new Map();
export function piso(tipo, variante = 0) {
  const chave = tipo + variante;
  if (cachePisos.has(chave)) return cachePisos.get(chave);
  const def = PISOS[tipo], c = tela(T, T), g = c.getContext('2d'), r = rng(tipo.length * 977 + variante * 131 + 7);
  g.fillStyle = def.cor; g.fillRect(0, 0, T, T);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = tom(def.cor, r() < 0.5 ? 0.82 : 1.14);
    g.fillRect((r() * T) | 0, (r() * T) | 0, 1 + (r() * 2 | 0), 1);
  }
  if (def.grama) for (let i = 0; i < 14; i++) {
    const x = (r() * 30) | 0, y = (r() * 29) | 0;
    g.fillStyle = tom(def.cor, 1.35); g.fillRect(x, y, 1, 2);
    g.fillStyle = tom(def.cor, 0.7); g.fillRect(x + 1, y + 1, 1, 2);
  }
  if (def.pedrinhas) for (let i = 0; i < 5; i++) {
    const x = (r() * 29) | 0, y = (r() * 29) | 0;
    g.fillStyle = tom(def.cor, 1.3); g.fillRect(x, y, 2, 1);
    g.fillStyle = tom(def.cor, 0.6); g.fillRect(x, y + 1, 2, 1);
  }
  if (def.laje) {                 // lajotas de 16 px com chanfro e, às vezes, um cravo de latão no canto
    for (const [lx, ly] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
      const v = tom(def.cor, 0.92 + r() * 0.16);
      g.fillStyle = v; g.fillRect(lx + 1, ly + 1, 14, 14);
      g.fillStyle = tom(v, 1.25); g.fillRect(lx + 1, ly + 1, 14, 1); g.fillRect(lx + 1, ly + 1, 1, 14);
      g.fillStyle = tom(v, 0.7); g.fillRect(lx + 1, ly + 14, 14, 1); g.fillRect(lx + 14, ly + 1, 1, 14);
      g.fillStyle = tom(def.cor, 0.45); g.fillRect(lx, ly, 16, 1); g.fillRect(lx, ly, 1, 16);
      for (let k = 0; k < 6; k++) { g.fillStyle = tom(v, r() < 0.5 ? 0.88 : 1.1); g.fillRect(lx + 2 + ((r() * 12) | 0), ly + 2 + ((r() * 12) | 0), 1, 1); }
    }
    if (variante % 2 === 0) { g.fillStyle = '#c9a050'; g.fillRect(15, 15, 2, 2); g.fillStyle = '#f0d48a'; g.fillRect(15, 15, 1, 1); }
  }
  if (def.tijolo) {
    g.fillStyle = tom(def.cor, 0.62);
    for (let y = 0; y < T; y += 8) { g.fillRect(0, y, T, 1); for (let x = (y / 8) % 2 ? 4 : 0; x < T; x += 10) g.fillRect(x, y, 1, 8); }
    g.fillStyle = tom(def.cor, 1.18);
    for (let y = 1; y < T; y += 8) g.fillRect(0, y, T, 1);
  }
  if (def.agua) {
    g.fillStyle = tom(def.cor, 1.3);
    for (let i = 0; i < 6; i++) { const x = (r() * 26) | 0, y = (r() * 30) | 0; g.fillRect(x, y, 4 + (r() * 3 | 0), 1); }
  }
  if (def.brilho) for (let i = 0; i < 4; i++) { g.fillStyle = def.brilho; g.fillRect((r() * T) | 0, (r() * T) | 0, 1, 1); }
  cachePisos.set(chave, c);
  return c;
}

// ---------- Objetos do mapa ----------
// cada objeto: { img, bloqueia, alto } — objetos altos (árvores) têm 64px e vazam para cima/esquerda, como no OT
const cacheObjetos = new Map();
export function objeto(tipo, variante = 0) {
  const chave = tipo + variante;
  if (cacheObjetos.has(chave)) return cacheObjetos.get(chave);
  const r = rng(tipo.length * 733 + variante * 97 + 3);
  let o;
  if (tipo === 'arvore' || tipo === 'arvoreE') {
    const c = tela(64, 64), p = new Pincel(c), escura = tipo === 'arvoreE';
    const folha = escura ? '#24552a' : '#3a7a2c';
    p.o(44, 60, 14, 4, 'rgba(0,0,0,0.3)');
    p.r(41, 40, 7, 21, '#5a3a22'); p.r(41, 40, 2, 21, '#7a5232'); p.r(46, 40, 2, 21, '#3e2616');
    for (let i = 0; i < 7; i++) p.bola(33 + r() * 18, 20 + r() * 16, 8 + r() * 4, 7 + r() * 3, tom(folha, 0.85 + r() * 0.3));
    for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = r() * 11; p.r(40 + Math.cos(a) * d, 26 + Math.sin(a) * d * 0.8, 2, 2, tom(folha, 1.4)); }
    o = { img: contornar(c), bloqueia: true, alto: true };
  } else if (tipo === 'arbusto') {
    const c = tela(32, 32), p = new Pincel(c);
    p.o(16, 27, 11, 3, 'rgba(0,0,0,0.25)');
    p.bola(11, 20, 6, 5.5, '#3c7e30'); p.bola(21, 20, 6, 5.5, '#357228'); p.bola(16, 15, 6.5, 5.5, '#45902f');
    for (let i = 0; i < 4; i++) p.r(8 + r() * 16, 12 + r() * 12, 2, 2, variante % 2 ? '#d83a3a' : '#e8d850');
    o = { img: contornar(c), bloqueia: true };
  } else if (tipo === 'rocha' || tipo === 'rochaV') {
    const c = tela(32, 32), p = new Pincel(c), cor = tipo === 'rochaV' ? '#4a3a5a' : '#7a7670';
    p.o(17, 26, 11, 3, 'rgba(0,0,0,0.3)');
    p.bola(16, 20, 10, 7, cor); p.bola(22, 17, 5, 4, tom(cor, 1.08));
    p.l(10, 20, 15, 23, tom(cor, 0.55));
    o = { img: contornar(c), bloqueia: true };
  } else if (tipo === 'cristal') {
    const c = tela(32, 32), p = new Pincel(c), cor = variante % 2 ? '#b070ff' : '#e060d0';
    p.o(16, 28, 9, 2.5, 'rgba(0,0,0,0.35)');
    p.poli([[10, 28], [9, 12], [13, 5], [15, 28]], cor); p.poli([[15, 28], [18, 8], [22, 14], [21, 28]], tom(cor, 0.75));
    p.poli([[11, 26], [11, 14], [13, 9], [13, 26]], tom(cor, 1.5));
    o = { img: contornar(c), bloqueia: true, luz: cor };
  } else if (tipo === 'pilar') {
    const c = tela(32, 32), p = new Pincel(c);
    p.o(16, 28, 8, 2.5, 'rgba(0,0,0,0.35)');
    p.r(11, 20, 10, 8, '#6a7088'); p.r(11, 20, 3, 8, '#8a90a8'); p.r(18, 20, 3, 8, '#4a5068');
    p.poli([[12, 21], [13, 6], [16, 1], [19, 6], [20, 21]], '#58b8ff'); p.poli([[14, 19], [14, 7], [16, 3], [16, 19]], '#b8ecff');
    o = { img: contornar(c), bloqueia: true, luz: '#58b8ff' };
  } else if (tipo === 'caixote' || tipo === 'barril') {
    const c = tela(32, 32), p = new Pincel(c);
    p.o(16, 28, 10, 2.5, 'rgba(0,0,0,0.3)');
    if (tipo === 'caixote') {
      p.r(7, 12, 18, 16, '#9a6a3a'); p.r(7, 12, 18, 2, '#b8864e'); p.r(7, 19, 18, 1, '#6a4422'); p.r(15, 12, 2, 16, '#6a4422');
      if (variante) { p.r(10, 8, 5, 5, '#d83a3a'); p.r(17, 9, 4, 4, '#3a6ad8'); }
    } else {
      p.bola(16, 20, 8, 9, '#8a5a30'); p.r(8, 14, 16, 1, '#3a3a3a'); p.r(8, 24, 16, 1, '#3a3a3a');
    }
    o = { img: contornar(c), bloqueia: true };
  } else if (tipo === 'cristal-fonte') {     // o cristal da Fonte, flutuando sobre o chafariz
    const c = tela(64, 64), p = new Pincel(c);
    p.o(48, 54, 10, 3, 'rgba(160,230,255,0.35)'); p.o(48, 54, 6, 1.6, 'rgba(220,250,255,0.5)');
    p.poli([[48, 6], [57, 24], [48, 44], [39, 24]], '#3fb8f0');
    p.poli([[48, 6], [57, 24], [48, 44]], '#2a86c8');
    p.poli([[48, 10], [52, 24], [48, 38], [44, 24]], '#8ae8ff'); p.l(46, 14, 44, 24, '#e8fbff');
    for (const [x, y] of [[36, 18], [60, 30], [40, 38], [58, 12]]) { p.poli([[x, y - 3], [x + 2, y], [x, y + 3], [x - 2, y]], '#6ad8ff'); p.px(x, y - 1, '#ffffff'); }
    o = { img: contornar(c), bloqueia: true, alto: true, luz: '#7ae8ff' };
  } else if (tipo === 'penhasco') {           // paredão da fortaleza (0: frente, alto; 1: lados e fundo)
    const c = tela(64, 64), p = new Pincel(c);
    if (variante % 2 === 0) {
      p.r(32, 10, 32, 54, '#6a6458'); p.r(32, 10, 32, 6, '#5f7a3a'); p.r(32, 16, 32, 2, '#4a4438');
      for (let y = 22; y < 64; y += 9) { p.r(32, y, 32, 1, '#4a4438'); p.r(32, y + 1, 32, 1, '#8a8474'); }
      for (let k = 0; k < 5; k++) p.r(34 + ((r() * 26) | 0), 18 + ((r() * 40) | 0), 1, 5, '#3a362e');
    } else { p.bola(48, 46, 17, 15, '#7a7466'); p.bola(42, 36, 8, 6, '#5f7a3a'); p.bola(54, 40, 7, 5, '#5f7a3a'); }
    o = { img: contornar(c), bloqueia: true, alto: true };
  } else if (tipo === 'bau') {                // o baú da fortaleza
    const c = tela(64, 64), p = new Pincel(c);
    p.o(48, 61, 11, 2, 'rgba(0,0,0,0.35)');
    p.r(38, 46, 20, 14, '#7a4a24'); p.r(38, 42, 20, 6, '#9a6030'); p.r(38, 46, 20, 1, '#4a2a14');
    p.r(41, 42, 2, 18, '#d8a838'); p.r(53, 42, 2, 18, '#d8a838'); p.r(46, 47, 4, 4, '#f0d060'); p.r(47, 49, 2, 1, '#3a2410');
    o = { img: contornar(c), bloqueia: true, alto: true, bau: true };
  } else if (tipo === 'bandeira') {           // estandarte da base aliada (azul) ou de uma cidade de Runeterra
    const c = tela(64, 64), p = new Pincel(c);
    const [pano, panoE, emblema] = [['#2a5ad8', '#1e44a8', '#6ad8ff'], ['#d8a030', '#a87418', '#3ad0c0'], ['#b02020', '#781414', '#1a1a1a']][variante % 3];
    p.o(46, 61, 7, 2, 'rgba(0,0,0,0.35)');
    p.r(42, 57, 9, 4, '#5a5e6a'); p.r(42, 57, 9, 1, '#8a8e9a');
    p.r(45, 8, 3, 50, '#6a4a2a'); p.r(45, 8, 1, 50, '#8a6a42');
    p.bola(46.5, 7, 2.5, 2.5, '#e8c060'); p.r(44, 11, 19, 2, '#c9a050');
    p.poli([[48, 13], [62, 13], [62, 38], [55, 33], [48, 38]], pano);
    p.poli([[55, 13], [62, 13], [62, 38], [55, 33]], panoE);
    p.r(48, 13, 14, 2, '#c9a050'); p.l(48, 36, 55, 31, '#c9a050'); p.l(55, 31, 62, 36, '#c9a050');
    p.poli([[55, 18], [59, 23], [55, 28], [51, 23]], '#f0d48a'); p.poli([[55, 20], [57, 23], [55, 26], [53, 23]], emblema);
    o = { img: contornar(c), bloqueia: true, alto: true };
  } else if (tipo === 'casa') {               // casa de cidade (3 tiles de largura): Demacia, Piltover ou Noxus
    const c = tela(96, 96), p = new Pincel(c);
    const [parede, paredeE, telhado, telhadoE, enfeite] = [
      ['#dcd6c6', '#b0a890', '#2f5fc8', '#1e3f90', '#d8b050'],
      ['#b8825a', '#8a5a3a', '#2a9a94', '#1a6a66', '#e0b040'],
      ['#55505a', '#3a363e', '#a82a2a', '#6a1616', '#1a1418']][variante % 3];
    p.o(48, 92, 44, 4, 'rgba(0,0,0,0.35)');
    p.r(6, 46, 84, 46, parede); p.r(6, 46, 84, 3, tom(parede, 1.12)); p.r(84, 46, 6, 46, paredeE);
    if (variante % 3 === 1) for (let y = 52; y < 92; y += 6) for (let x = 6 + ((y / 6) % 2) * 6; x < 84; x += 12) p.r(x, y, 11, 1, paredeE);     // tijolos
    else for (let y = 56; y < 92; y += 10) p.r(6, y, 78, 1, paredeE);                                                                       // pedras
    p.r(6, 88, 84, 4, tom(parede, 0.7));
    // telhado
    p.poli([[0, 50], [96, 50], [82, 10], [14, 10]], telhado);
    p.poli([[48, 10], [82, 10], [96, 50], [48, 50]], telhadoE);
    for (let y = 18; y < 50; y += 8) p.l(14 - (y - 10) * 0.35, y, 82 + (y - 10) * 0.35, y, tom(telhado, 0.75));
    p.r(0, 48, 96, 3, tom(telhadoE, 0.8)); p.r(14, 9, 68, 2, enfeite);
    if (variante % 3 === 2) for (const x of [16, 48, 80]) p.poli([[x - 3, 10], [x, 1], [x + 3, 10]], '#2a2228');          // pontas de ferro de Noxus
    else { p.r(68, 2, 8, 12, '#6a5a50'); p.r(68, 2, 8, 2, '#8a7a70'); }                                                       // chaminé
    // porta e janelas acesas
    p.r(40, 64, 16, 28, '#3a2416'); p.r(42, 66, 12, 26, '#6a4428'); p.r(47, 66, 2, 26, '#4a2c18'); p.px(51, 79, enfeite);
    p.r(38, 62, 20, 2, enfeite);
    for (const x of [16, 66]) {
      p.r(x - 1, 59, 16, 14, tom(paredeE, 0.7)); p.r(x, 60, 14, 12, '#ffd77a'); p.r(x, 60, 14, 3, '#fff0c0');
      p.r(x + 6, 60, 2, 12, tom(paredeE, 0.6)); p.r(x, 65, 14, 1, tom(paredeE, 0.6));
    }
    if (variante % 3 === 0) { p.r(44, 52, 8, 8, '#2f5fc8'); p.poli([[48, 53], [51, 56], [48, 59], [45, 56]], enfeite); }      // brasão de Demacia
    if (variante % 3 === 1) { p.bola(48, 56, 5, 5, enfeite); p.bola(48, 56, 2, 2, paredeE); }                                 // engrenagem de Piltover
    if (variante % 3 === 2) { p.poli([[42, 52], [54, 52], [48, 60]], '#b02020'); }                                             // marca de Noxus
    o = { img: contornar(c), bloqueia: true, ox: 32, oy: 64, luz: '#ffd77a' };
  } else if (tipo === 'lampiao') {            // poste de ferro com lanterna acesa
    const c = tela(64, 64), p = new Pincel(c);
    p.o(48, 61, 5, 1.8, 'rgba(0,0,0,0.35)');
    p.r(46, 22, 3, 39, '#2e3240'); p.r(46, 22, 1, 39, '#4a5060'); p.r(43, 58, 9, 3, '#2e3240');
    p.r(44, 18, 7, 2, '#2e3240'); p.r(43, 8, 9, 10, '#3a3020'); p.r(44, 9, 7, 8, '#ffd27a'); p.r(45, 10, 2, 5, '#fff4c8');
    p.poli([[42, 8], [47.5, 3], [53, 8]], '#2e3240');
    o = { img: contornar(c), bloqueia: true, alto: true, luz: '#ffd27a' };
  } else if (tipo === 'cofre') {              // o cofre de ferro da Tesoureira de Piltover, com cantoneiras douradas e o segredo
    const c = tela(32, 32), p = new Pincel(c);
    p.o(16, 29, 11, 2.5, 'rgba(0,0,0,0.35)');
    p.r(5, 10, 22, 18, '#3a4048'); p.r(5, 10, 22, 2, '#5a626c'); p.r(24, 10, 3, 18, '#2a2e34');
    p.r(7, 13, 16, 13, '#2e343c'); p.r(7, 13, 16, 1, '#4a525c');
    for (const [x, y] of [[5, 10], [24, 10], [5, 25], [24, 25]]) p.r(x, y, 3, 3, '#d8b050');
    p.bola(15, 19.5, 3.4, 3.4, '#c8a040'); p.bola(15, 19.5, 2.2, 2.2, '#5a4a20'); p.r(14.6, 16.4, 0.8, 2, '#fff0a0');
    p.r(20, 18, 1.6, 4, '#c8a040'); p.px(9, 15, '#8a96a4');
    o = { img: contornar(c), bloqueia: true };
  } else if (tipo === 'barraca') {            // a barraca do Mercador: toldo roxo e dourado e o balcão com itens à venda
    const c = tela(64, 64), p = new Pincel(c);
    p.o(48, 61, 15, 2.6, 'rgba(0,0,0,0.3)');
    p.r(33, 22, 3, 39, '#5a3a22'); p.r(60, 22, 3, 39, '#5a3a22'); p.r(33, 22, 1, 39, '#7a5232');
    // o toldo em gomos roxo e dourado, com a franja
    for (let k = 0; k < 6; k++) p.poli([[32 + k * 5, 15], [37 + k * 5, 15], [37 + k * 5, 27], [32 + k * 5, 27]], k % 2 ? '#e0b848' : '#6a2a8a');
    p.r(31, 13, 34, 3, '#4a2a18'); p.r(31, 13, 34, 1, '#7a5232');
    for (let k = 0; k < 6; k++) { p.bola(34.5 + k * 5, 27, 2.5, 2, k % 2 ? '#e0b848' : '#6a2a8a'); p.px(34.5 + k * 5, 29.4, '#f0d070'); }
    // itens pendurados embaixo do toldo: uma espada e um escudo
    p.l(38, 30, 38, 33, '#8a8a8a', 0.6); p.r(37, 33, 2, 1, '#c8a040'); p.r(37.6, 34, 0.8, 6, '#d8e0ea');
    p.l(57, 30, 57, 32, '#8a8a8a', 0.6); p.bola(57, 35, 3, 3.2, '#3a6ad8'); p.bola(57, 35, 1.4, 1.6, '#e0b848');
    // o balcão de madeira com o pano e os itens
    p.r(35, 44, 27, 5, '#7a4a28'); p.r(35, 44, 27, 1, '#a8703c'); p.r(35, 49, 27, 6, '#5a3420');
    p.r(35, 49, 27, 2, '#6a2a8a'); for (let x = 36; x < 62; x += 4) p.px(x, 50, '#e0b848');
    p.r(39, 40, 4, 4, '#3a6ad8'); p.r(39, 40, 4, 1, '#8ab0f0');                          // um livro
    p.poli([[47, 44], [49, 39], [51, 44]], '#5ae0e8'); p.px(48.6, 41, '#ffffff');        // um cristal
    p.r(53, 41, 3, 3, '#8a5a2a'); p.r(53, 43, 5, 1, '#6a4020');                          // uma bota
    p.r(58, 41.6, 2, 2.4, '#d83a3a'); p.r(58, 41, 2, 0.8, '#c8d8e8');                    // uma poção
    p.bola(45, 43, 1.4, 1, '#ffd84a'); p.bola(44, 43.6, 1.2, 0.8, '#ffd84a');            // moedas
    o = { img: contornar(c), bloqueia: true, alto: true };
  } else if (tipo === 'tenda') {              // toldo listrado da banca do Lojista
    const c = tela(64, 64), p = new Pincel(c);
    p.o(48, 61, 14, 2.5, 'rgba(0,0,0,0.3)');
    p.r(34, 24, 3, 37, '#6a4a2a'); p.r(60, 24, 3, 37, '#6a4a2a');
    for (let k = 0; k < 6; k++) p.poli([[32 + k * 5, 18], [37 + k * 5, 18], [37 + k * 5, 30], [32 + k * 5, 30]], k % 2 ? '#e8e2d0' : '#c8302a');
    p.r(32, 16, 32, 3, '#8a5a30');
    for (let k = 0; k < 6; k++) p.bola(34.5 + k * 5, 30, 2.5, 2, k % 2 ? '#e8e2d0' : '#c8302a');
    p.r(36, 44, 25, 4, '#8a5a30'); p.r(36, 44, 25, 1, '#b07a42');
    for (const [x, cor] of [[39, '#d83a3a'], [44, '#3a6ad8'], [49, '#e8a020'], [54, '#5ad05a']]) { p.r(x, 39, 3, 5, cor); p.r(x, 38, 3, 1, '#c8d8e8'); }
    o = { img: contornar(c), bloqueia: true, alto: true };
  } else if (tipo === 'braseiro' || tipo === 'forja') {
    const c = tela(32, 32), p = new Pincel(c), forja = tipo === 'forja';
    p.o(16, 29, 10, 2.5, 'rgba(0,0,0,0.35)');
    if (forja) {                              // forja de pedra do Ornn, com a boca em brasa
      p.r(5, 10, 22, 18, '#5a5450'); p.r(5, 10, 22, 2, '#7a746e'); p.r(24, 10, 3, 18, '#3e3a36');
      p.r(10, 17, 12, 8, '#2a1008'); p.r(11, 19, 10, 6, '#ff6a20'); p.r(12, 21, 8, 3, '#ffd060');
      p.r(18, 2, 5, 9, '#4a4440'); p.px(20, 1, '#9a9a9a'); p.px(22, 0, '#7a7a7a');
    } else {                                  // braseiro de latão sobre três pés
      p.l(10, 28, 13, 20, '#5a4220', 2); p.l(22, 28, 19, 20, '#5a4220', 2); p.l(16, 28, 16, 21, '#5a4220', 2);
      p.bola(16, 19, 8, 3.5, '#c9a050'); p.r(8, 17, 16, 2, '#7a5a28');
      p.poli([[10, 17], [13, 8], [15, 13], [17, 4], [19, 12], [21, 9], [22, 17]], '#ff7a20');
      p.poli([[13, 17], [15, 11], [17, 8], [19, 13], [20, 17]], '#ffd060'); p.px(17, 12, '#fff4c8');
    }
    o = { img: contornar(c), bloqueia: true, luz: forja ? '#ff6a20' : '#ff9a30' };
  } else if (tipo === 'bigorna') {
    const c = tela(32, 32), p = new Pincel(c);
    p.o(16, 29, 10, 2.5, 'rgba(0,0,0,0.35)');
    p.r(11, 20, 10, 9, '#6a4a2a'); p.r(11, 20, 10, 2, '#8a6a42');
    p.poli([[5, 13], [27, 13], [24, 18], [20, 18], [20, 20], [12, 20], [12, 18], [8, 18]], '#4a4e58');
    p.r(6, 13, 21, 1, '#8a8e98'); p.poli([[2, 13], [6, 13], [6, 15]], '#4a4e58');
    p.r(19, 9, 2, 4, '#6a4a2a'); p.r(16, 7, 8, 3, '#7a7e88');
    o = { img: contornar(c), bloqueia: true };
  } else if (tipo === 'arsenal') {            // suporte com espada, machado e lança
    const c = tela(32, 32), p = new Pincel(c);
    p.o(16, 29, 11, 2.5, 'rgba(0,0,0,0.3)');
    p.r(5, 10, 2, 19, '#6a4a2a'); p.r(25, 10, 2, 19, '#6a4a2a'); p.r(5, 12, 22, 2, '#8a5a30'); p.r(5, 24, 22, 2, '#8a5a30');
    p.l(10, 4, 10, 26, '#c3c9d3', 1); p.r(8, 20, 5, 1, '#c9a050');
    p.l(16, 6, 16, 27, '#6a4a2a', 1); p.bola(18, 8, 3, 4, '#a8aeb8');
    p.l(22, 2, 22, 27, '#6a4a2a', 1); p.poli([[21, 2], [22, 0], [23, 2], [22, 5]], '#c3c9d3');
    o = { img: contornar(c), bloqueia: true };
  } else if (tipo === 'ruina') {
    const c = tela(32, 32), p = new Pincel(c);
    p.r(6, 12, 20, 18, '#7a766e'); p.r(6, 12, 20, 2, '#9a968c'); p.r(22, 12, 4, 18, '#5a574f');
    for (let y = 16; y < 30; y += 5) p.r(6, y, 16, 1, '#4e4b45');
    p.r(8, 8, 5, 4, '#7a766e'); p.r(16, 6, 4, 6, '#7a766e');
    o = { img: contornar(c), bloqueia: true };
  } else {
    // decoração que não bloqueia
    const c = tela(32, 32), p = new Pincel(c);
    if (tipo === 'flores') for (let i = 0; i < 5; i++) {
      const x = 5 + r() * 22, y = 8 + r() * 18; p.r(x, y + 1, 1, 3, '#2a6a20'); p.r(x - 1, y - 1, 3, 2, ['#f0e060', '#f07ab0', '#ffffff', '#8ab0ff'][(r() * 4) | 0]);
    } else if (tipo === 'ossos') {
      p.l(8, 20, 18, 16, '#e0dccc', 2); p.bola(8, 21, 1.6, 1.6, '#e0dccc'); p.bola(18, 15, 1.6, 1.6, '#e0dccc');
      p.bola(22, 22, 3.4, 3, '#d8d4c4'); p.px(21, 22, '#222'); p.px(23, 22, '#222');
    } else if (tipo === 'junco') for (let i = 0; i < 6; i++) {
      const x = 6 + r() * 20; p.l(x, 28, x + r() * 2 - 1, 12 + r() * 8, '#5a8a3a'); p.r(x, 12 + r() * 4, 2, 4, '#6a4a2a');
    } else if (tipo === 'estrelas') {          // canteiro de flores-estrela da Soraka
      for (let i = 0; i < 7; i++) {
        const x = 5 + r() * 22, y = 9 + r() * 17, cor = ['#cfe8ff', '#ffffff', '#ffe890', '#a8c8ff'][(r() * 4) | 0];
        p.r(x, y + 1, 1, 3, '#2a6a3a'); p.r(x - 1, y, 3, 1, cor); p.r(x, y - 1, 1, 3, cor); p.px(x, y, '#fffbe0');
      }
    } else if (tipo === 'cogumelo') {
      p.r(15, 20, 3, 6, '#e8e0d0'); p.bola(16, 19, 5, 3, '#c8302a'); p.px(14, 18, '#fff'); p.px(18, 19, '#fff');
    }
    o = { img: contornar(c), bloqueia: false, chao: true };
  }
  cacheObjetos.set(chave, o);
  return o;
}

// ---------- monstros redesenhados no estilo novo (lobo e dragões) ----------
// Desenhados em coordenadas de 32 com detalhes de fração de unidade (o sprite sai maior pela escala, então cabe mais
// detalhe sem mudar o tamanho do pixel). Quadros: 0 parado, 1 e 2 passos, 3 ataque e, só no estilo novo:
//   lobo: 70/71 rabo abanando, 72/73 latindo, 74 uivando; dragão: 70 a 73 batida de asa (cima, meio, baixo, meio)
export const MONSTROS_NOVOS = new Set(['fera', 'dragao']);
function lobo(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.7), DD = tom(C, 0.48), L = tom(C, 1.25), B = a.barriga || tom(C, 1.4), J = a.juba || tom(C, 1.12), JD = tom(J, 0.78);
  const dorso = tom(C, 0.56), olho = a.olho || '#ffe066', nariz = '#121216', boca = '#5a1418', dente = '#f4f0e2', garra = '#d8d2c4';
  const anda = f === 1 ? 1 : f === 2 ? -1 : 0, bote = f === 3 ? 1 : 0;
  const rabo = f === 70 ? 1 : f === 71 ? -1 : f === 72 || f === 73 ? 1.2 : f === 74 ? 0.8 : f === 3 ? 0.6 : 0;
  const late = f === 72 ? 1 : f === 73 ? 2 : f === 3 ? 2 : 0, uiva = f === 74;
  // tufos de pelo (triângulos) ao longo de uma linha
  const tufos = (x0, x1, y, cor, alt = 1.6, passo = 1.5) => { for (let x = x0; x < x1; x += passo) p.poli([[x, y + 0.5], [x + passo * 0.45, y - alt], [x + passo * 0.9, y + 0.5]], cor); };
  // perna em 3 segmentos (coxa/braço, canela, pata), com o pé deslocado por "sw" (passo) e "er" (levantado)
  const perna = (pts, cor, larg, sw = 0, er = 0) => {
    const q = pts.map(([x, y], i) => [x + sw * (i / (pts.length - 1)), y - er * (i / (pts.length - 1))]);
    for (let i = 0; i + 1 < q.length; i++) p.l(q[i][0], q[i][1], q[i + 1][0], q[i + 1][1], cor, larg - i * 0.25);
    const [px, py] = q[q.length - 1];
    p.o(px + 0.5, py + 0.2, 1.3, 0.75, tom(cor, 0.85)); p.px(px + 1.4, py + 0.4, garra);
  };
  if (dir === DIR.L) {
    const bx = bote * 1.8, cab = uiva ? 0 : late && !bote ? -0.4 : bote ? 1.2 : 0;
    // rabo peludo, caído como o dos lobos (sobe quando abana ou late)
    const ty = -rabo * 3;
    p.poli([[9.6, 15.2], [6.4, 15.6 + ty * 0.4], [3.4, 17.6 + ty * 0.8], [2, 20.6 + ty], [3.2, 22 + ty], [4.6, 20.8 + ty * 0.9], [7, 19 + ty * 0.5], [9.8, 18.6]], D);
    p.poli([[9.4, 15.8], [6.6, 16.4 + ty * 0.4], [4, 18.2 + ty * 0.8], [3.2, 20.4 + ty], [5, 19.8 + ty * 0.8], [7.4, 18.2 + ty * 0.4]], C);
    p.poli([[2, 20.6 + ty], [3.2, 22 + ty], [3.8, 21 + ty * 0.95], [2.6, 19.8 + ty]], DD);
    // pernas do lado de lá (mais escuras)
    perna([[11.6, 19], [12.6, 22.4], [10.8, 25], [11.2, 27.6]], DD, 1.8, -anda * 1.2 - bote * 1.2, anda < 0 ? 0.8 : 0);
    perna([[20.6 + bx, 19.6], [20.4 + bx, 23.4], [20.8 + bx, 26.4], [21.2 + bx, 27.6]], DD, 1.8, anda * 1.2 + bote * 1.6, anda > 0 ? 0.8 : 0);
    // corpo: anca, cintura fina, peito fundo; dorso escuro e barriga clara
    p.bola(11.4, 17.4, 3.6, 3.4, C);
    p.bola(15.6 + bx * 0.5, 17.2, 5.6, 2.9, C);
    p.bola(20 + bx, 17.8, 3.6, 4.2, C);
    p.poli([[8.6, 16], [10.6, 14.4], [14, 13.9], [18 + bx, 14.2], [16 + bx * 0.5, 15.4], [12, 15.8]], tom(C, 0.8));
    p.o(15.6 + bx * 0.5, 19.8, 3.6, 0.9, B); p.o(20.2 + bx, 20.8, 2.2, 1.6, B);
    tufos(9, 17.4 + bx, 14.6, tom(C, 0.8), 0.9, 1.4);
    // pernas do lado de cá: traseira com jarrete, dianteira reta
    p.bola(11.2, 19.2, 2.4, 2.8, C);
    perna([[11.4, 20], [12.6, 22.8], [10.4, 25.2], [10.8, 27.8]], D, 2, anda * 1.2 - bote * 1.6, anda > 0 ? 0.8 : 0);
    p.l(12.2, 21.4, 12.4, 22.6, L, 0.6);
    perna([[21.4 + bx, 19.8], [21.6 + bx, 23.4], [21.8 + bx, 26.6], [22.2 + bx, 27.8]], C, 2.1, -anda * 1.2 + bote * 2, anda < 0 ? 0.8 : 0);
    p.l(22.2 + bx, 20.4, 22.4 + bx, 25.6, L, 0.5);
    // juba volumosa no pescoço e nos ombros
    const hx = 25.4 + bx, hy = 11.6 + cab;
    // pescoço inclinado (na cor do corpo) com a juba em tufos: na nuca, para trás, e no peito, para baixo
    p.poli([[17.2 + bx, 15.4], [20 + bx, 12.6], [22.8 + bx, 10.4 + cab], [25.4 + bx, 11.2 + cab], [25.2 + bx, 14.6 + cab], [24 + bx, 19.2], [21.8 + bx, 21], [19.4 + bx, 19.2]], C);
    for (let k = 0; k < 5; k++) { const x = 17.6 + k * 1.2 + bx, y = 14.6 - k * 0.95 + (k > 3 ? cab * 0.5 : 0); p.poli([[x, y + 0.4], [x - 1.6, y - 0.6], [x + 0.6, y - 1.2]], J); p.poli([[x + 0.2, y + 0.2], [x - 0.8, y - 0.4], [x + 0.5, y - 0.7]], L); }
    for (let k = 0; k < 4; k++) { const x = 20.8 + k * 0.9 + bx, y = 19.6 - Math.abs(k - 1.5) * 0.5; p.poli([[x - 0.7, y], [x + 0.1, y + 2.2], [x + 0.8, y]], k % 2 ? J : B); }
    p.poli([[24.4 + bx, 13.6 + cab], [25.6 + bx, 16.2], [24 + bx, 17.6]], J);
    for (let k = 0; k < 3; k++) p.l(20.6 + k * 1.1 + bx, 14.4 + k * 0.1, 21.2 + k * 1.1 + bx, 17.4, D, 0.5);
    if (uiva) {            // uivando: cabeça para trás e focinho apontado para o céu
      p.bola(hx - 0.8, hy - 0.4, 3, 2.8, C);
      p.poli([[hx - 0.4, hy - 2], [hx + 2, hy - 7.6], [hx + 3.6, hy - 7], [hx + 2.4, hy - 0.6]], C);
      p.poli([[hx + 2.4, hy - 0.6], [hx + 3.6, hy - 7], [hx + 4.6, hy - 5.6], [hx + 3.2, hy + 0.2]], B);
      p.poli([[hx + 2.6, hy - 1.4], [hx + 3.8, hy - 6.4], [hx + 4.4, hy - 5.2]], boca);
      p.r(hx + 1.7, hy - 8.2, 1.6, 1.2, nariz);
      p.poli([[hx - 3, hy - 1.2], [hx - 5.4, hy - 3.6], [hx - 2, hy - 2.6]], D);
      p.r(hx + 0.2, hy - 1.6, 1.2, 0.7, olho); p.px(hx + 0.4, hy - 1.6, '#fffbe0');
      return;
    }
    // cabeça: crânio, testa clara, bochecha peluda
    p.bola(hx, hy, 3.2, 2.7, C); p.o(hx - 0.4, hy - 1.4, 2, 0.8, L);
    p.poli([[hx - 2.8, hy + 0.4], [hx - 3.4, hy + 2.8], [hx - 1.2, hy + 2.2]], J);
    // orelhas altas e pontudas (a de lá escura, a de cá com o miolo claro)
    p.poli([[hx - 2.6, hy - 1.6], [hx - 2.4, hy - 6.6], [hx - 0.6, hy - 2.2]], DD);
    p.poli([[hx - 1.2, hy - 1.8], [hx - 0.2, hy - 7], [hx + 1.4, hy - 2]], D); p.poli([[hx - 0.6, hy - 2.2], [hx - 0.1, hy - 5.4], [hx + 0.7, hy - 2.2]], tom(C, 1.6));
    // focinho comprido, com o queixo claro
    p.poli([[hx + 1.4, hy - 1.4], [hx + 6, hy - 0.4], [hx + 6.4, hy + 0.6], [hx + 1.8, hy + 1.4]], C);
    p.l(hx + 1.6, hy - 1.2, hx + 5.8, hy - 0.4, L, 0.6);
    p.r(hx + 5.6, hy - 0.9, 1.4, 1.2, nariz); p.px(hx + 5.8, hy - 0.8, '#5a5a66');
    if (late) {            // boca aberta: língua e presas
      p.poli([[hx + 1.8, hy + 1.2], [hx + 6.2, hy + 0.6], [hx + 5.6, hy + 1.6 + late], [hx + 1.6, hy + 2.4]], boca);
      p.px(hx + 5, hy + 1, dente); p.px(hx + 3, hy + 1.2, dente); p.px(hx + 4.6, hy + 1.4 + late * 0.7, dente);
      p.o(hx + 3.4, hy + 1.8 + late * 0.5, 1, 0.4, '#c84a5a');
    }
    p.poli([[hx + 1.6, hy + 1.4 + late * 0.5], [hx + 5.6, hy + 1.2 + late], [hx + 5.2, hy + 2.2 + late], [hx + 1.2, hy + 2.6]], B);
    // olho amarelo com brilho e a sobrancelha brava
    p.poli([[hx + 0.2, hy - 0.6], [hx + 0.8, hy - 1.5], [hx + 2.4, hy - 1.3], [hx + 2, hy - 0.4]], olho); p.px(hx + 1.6, hy - 1.2, '#fffbe0'); p.px(hx + 0.9, hy - 1, '#1a1408');
    p.l(hx - 0.2, hy - 2.2, hx + 2.6, hy - 1.6, DD, 0.6);
    return;
  }
  const frente = dir === DIR.S;
  const sobe = anda ? -0.3 : 0;
  if (frente) {
    // rabo abanando atrás do corpo (peludo e curto, não um pau de lado)
    const rx = 16 + rabo * 5;
    p.poli([[14.4, 18.4], [rx - 2, 14.4], [rx - 0.6, 12.6], [rx + 1.4, 13.4], [rx + 1.2, 15], [17.6, 18.4]], D);
    p.poli([[15, 17.8], [rx - 1.2, 14.2], [rx, 13.4], [rx + 0.4, 14.8], [17, 17.8]], C);
    // pernas traseiras ao fundo
    p.r(11.4, 23 + sobe, 2, 4.6, DD); p.r(18.6, 23 - sobe, 2, 4.6, DD);
    // corpo e peito
    p.bola(16, 20.4 + sobe, 6.2, 4.8, C); p.o(16, 22.2 + sobe, 3.4, 1.6, B);
    // patas da frente
    perna([[13.2, 21.4], [13.2, 24.6], [13, 27.6]], C, 2.4, 0, anda > 0 ? 0.8 : 0);
    perna([[18.8, 21.4], [18.8, 24.6], [19, 27.6]], C, 2.4, 0, anda < 0 ? 0.8 : 0);
    p.l(13.4, 22, 13.4, 26, L, 0.5); p.l(19, 22, 19, 26, L, 0.5);
    // juba em volta da cabeça e no peito
    const hy = 12.8 + bote * 1.2 + (late && !bote ? -0.4 : 0);
    p.poli([[9.6, hy - 1], [11.4, hy - 4.4], [16, hy - 4.6], [20.6, hy - 4.4], [22.4, hy - 1], [21.8, hy + 4.6], [19.4, hy + 8.6], [16, hy + 9.8], [12.6, hy + 8.6], [10.2, hy + 4.6]], J);
    for (let k = 0; k < 5; k++) p.poli([[11.4 + k * 2.3, hy + 6.6 + (k % 2) * 0.8], [12.5 + k * 2.3, hy + 9.6 + (k === 2 ? 1 : 0)], [13.6 + k * 2.3, hy + 6.6 + (k % 2) * 0.8]], J);
    p.poli([[9.6, hy - 1], [8.4, hy + 1.4], [10.2, hy + 2]], J); p.poli([[22.4, hy - 1], [23.6, hy + 1.4], [21.8, hy + 2]], J);
    for (let k = 0; k < 4; k++) p.l(13 + k * 2, hy + 4.6, 13.4 + k * 2, hy + 7.2, JD, 0.5);
    // orelhas altas
    p.poli([[11.2, hy - 1.6], [11.6, hy - 8], [14.4, hy - 3]], D); p.poli([[20.8, hy - 1.6], [20.4, hy - 8], [17.6, hy - 3]], D);
    p.poli([[12, hy - 2.4], [12.3, hy - 6.4], [13.6, hy - 3]], tom(C, 1.6)); p.poli([[20, hy - 2.4], [19.7, hy - 6.4], [18.4, hy - 3]], tom(C, 1.6));
    // cabeça com a testa escura em "V" e o focinho comprido e claro
    p.bola(16, hy, 4.4, 3.8, C);
    p.poli([[13.2, hy - 3.2], [16, hy - 0.4], [18.8, hy - 3.2], [16, hy - 3.8]], dorso);
    p.poli([[14, hy + 0.4], [18, hy + 0.4], [17.6, hy + 4.4], [16, hy + 5.2], [14.4, hy + 4.4]], B);
    p.r(15.1, hy + 2.6, 1.8, 1.3, nariz); p.px(15.4, hy + 2.7, '#5a5a66');
    if (late) { p.o(16, hy + 4.8 + late * 0.3, 1.8, 0.7 + late * 0.5, boca); p.px(14.8, hy + 4.4, dente); p.px(17, hy + 4.4, dente); }
    // olhos amarelos puxados e as sobrancelhas
    p.poli([[12.6, hy - 0.6], [14.6, hy - 1], [14.4, hy + 0.2], [12.8, hy + 0.2]], olho); p.poli([[19.4, hy - 0.6], [17.4, hy - 1], [17.6, hy + 0.2], [19.2, hy + 0.2]], olho);
    p.px(13.8, hy - 0.6, '#1a1408'); p.px(18, hy - 0.6, '#1a1408'); p.px(13.2, hy - 0.6, '#fffbe0'); p.px(18.6, hy - 0.6, '#fffbe0');
    p.l(12.4, hy - 1.6, 14.8, hy - 1.2, DD, 0.6); p.l(19.6, hy - 1.6, 17.2, hy - 1.2, DD, 0.6);
    return;
  }
  // de costas: pernas, anca, o dorso mais escuro descendo pela espinha, rabo peludo caído (abana para os lados), nuca com a juba e as orelhas
  p.r(11.6, 23 - sobe, 2.2, 4.8, D); p.r(18.2, 23 + sobe, 2.2, 4.8, D);
  p.o(12.7, 27.9 - sobe, 1.6, 0.7, DD); p.o(19.3, 27.9 + sobe, 1.6, 0.7, DD);
  p.bola(16, 19.8 + sobe, 6.2, 5, C);
  p.poli([[14.2, 14.6], [17.8, 14.6], [17, 21 + sobe], [16, 22 + sobe], [15, 21 + sobe]], tom(C, 0.8));
  tufos(10.4, 21.6, 18.4 + sobe, tom(C, 0.85), 0.8, 1.6);
  const rx = 16 + rabo * 3;
  p.poli([[14.4, 20.4], [rx - 2.2, 24], [rx - 1.4, 27.8], [rx, 28.8], [rx + 1.4, 27.8], [rx + 2.2, 24], [17.6, 20.4]], D);
  p.poli([[15, 20.8], [rx - 1.4, 24], [rx - 0.6, 27.2], [rx + 0.6, 24.4], [17, 20.8]], C);
  p.poli([[rx - 1.4, 27.8], [rx, 28.8], [rx + 1.4, 27.8], [rx, 26.8]], DD);
  // juba em volta do pescoço
  p.poli([[10.2, 14.6], [11.4, 11], [16, 10.2], [20.6, 11], [21.8, 14.6], [19.6, 16.6], [16, 17.2], [12.4, 16.6]], J);
  for (let k = 0; k < 6; k++) p.poli([[10.8 + k * 1.8, 15.6], [11.7 + k * 1.8, 17.4 + (k % 2) * 0.6], [12.6 + k * 1.8, 15.6]], J);
  // nuca (mais escura no alto) e as orelhas por trás
  p.bola(16, 11.4 + sobe, 3.6, 3, C); p.o(16, 10.4 + sobe, 2.2, 1.4, tom(C, 0.8));
  p.poli([[12.2, 10.6], [12.6, 4.8], [14.8, 9.2]], D); p.poli([[19.8, 10.6], [19.4, 4.8], [17.2, 9.2]], D);
  p.poli([[12.8, 10], [13, 6.6], [14.2, 9.2]], DD); p.poli([[19.2, 10], [19, 6.6], [17.8, 9.2]], DD);
}

function dragaoNovo(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.66), DD = tom(C, 0.45), L = tom(C, 1.3), M = a.asa || tom(C, 0.7), MD = tom(M, 0.7), ML = tom(M, 1.25);
  const B = a.barriga || tom(C, 1.4), chifre = a.chifre || '#e8dcc0', olho = a.olho || '#ffe23a';
  const fase = f === 70 ? 0 : f === 71 ? 1 : f === 72 ? 2 : f === 73 ? 1 : f === 3 ? 0 : 1;      // 0 asas no alto, 1 meio, 2 embaixo
  const ataca = f === 3, sobe = [-1, 0, 1][fase] * 0.6;
  // asa: raiz → cotovelo → ponta, com a membrana até a base (dedos marcados)
  const ASA = [{ E: [-4, -8], P: [-10, -13], m1: [-11, -6], m2: [-7, -1] }, { E: [-5, -5], P: [-13, -7], m1: [-13, -1], m2: [-8, 2] }, { E: [-5, 0], P: [-12, 5], m1: [-8, 7], m2: [-4, 6] }][fase];
  const asa = (rx, ry, lado, escura, k = 1) => {          // k: envergadura (de frente/costas um pouco menor, para caber)
    const P = (q) => [rx + q[0] * lado * k, ry + q[1] * k];
    const E = P(ASA.E), Pt = P(ASA.P), m1 = P(ASA.m1), m2 = P(ASA.m2), base = [rx - 1 * lado, ry + 4];
    p.poli([[rx, ry], E, Pt, m1, m2, base], escura ? MD : M);
    p.poli([[rx, ry], E, m1, m2, base], escura ? tom(MD, 0.85) : ML);
    p.l(rx, ry, E[0], E[1], escura ? DD : D, 1.2); p.l(E[0], E[1], Pt[0], Pt[1], escura ? DD : D);
    p.l(E[0], E[1], m1[0], m1[1], escura ? DD : D); p.l(E[0], E[1], m2[0], m2[1], escura ? DD : D);
    p.poli([[Pt[0], Pt[1]], [Pt[0] - lado * 1.4, Pt[1] - 1.2], [Pt[0] + lado * 0.2, Pt[1] + 0.8]], chifre);
  };
  if (dir === DIR.L) {
    asa(15, 14 + sobe, 1, true);                          // asa de lá
    // cauda com espinhos e ponta de flecha
    p.l(9, 22, 5, 24.6, C, 2.6); p.l(5, 24.6, 1.4, 25.4, C, 1.8);
    p.poli([[0, 25.4], [2.6, 23.2], [3, 27.4]], D); for (const x of [8, 5.6, 3.4]) p.poli([[x - 0.8, 23.4 - (8 - x) * 0.4], [x, 21.6 - (8 - x) * 0.4], [x + 0.8, 23.2 - (8 - x) * 0.4]], chifre);
    p.r(10.6, 23.6, 2.4, 5, D); p.r(18.6, 23.6, 2.4, 5, D);
    // corpo com placas na barriga
    p.bola(15, 20.4, 7.2, 5, D); p.bola(15, 19.8, 6.6, 4.4, C); p.bola(14, 17.6, 4.6, 1.6, L);
    for (let k = 0; k < 5; k++) p.r(11.4 + k * 1.7, 22.6, 1.3, 1.6, k % 2 ? B : tom(B, 0.88));
    for (let k = 0; k < 4; k++) p.poli([[10 + k * 2.2, 15.6], [11 + k * 2.2, 13.6], [12 + k * 2.2, 15.6]], chifre);
    // pernas de cá com garras
    p.bola(12, 22, 2.6, 2.6, C); p.r(11.4, 23.4, 2.2, 4.4, C); p.r(10.8, 27.4, 3.2, 1.2, DD); p.px(10.6, 28, chifre);
    p.r(19.4, 22.4, 2.2, 5, C); p.r(19, 27.4, 3.2, 1.2, DD); p.px(22, 28, chifre);
    // pescoço curvo e cabeça
    p.poli([[18.6, 18], [20.4, 13.4], [23, 10.4], [24.6, 12], [22.4, 15], [21.4, 19]], C); p.l(20.6, 17.6, 23.6, 12.6, B, 1.2);
    const hx = 25.2 + (ataca ? 1 : 0), hy = 9.6;
    p.bola(hx, hy, 3.6, 2.8, C); p.bola(hx - 0.6, hy - 1, 2.2, 1.2, L);
    p.poli([[hx + 1.4, hy - 1.2], [hx + 6, hy - 0.4], [hx + 6, hy + 0.9], [hx + 1.4, hy + 1.2]], C);
    p.poli([[hx + 1.4, hy + 1.2], [hx + 5.6, hy + 1 + (ataca ? 1.8 : 0)], [hx + 5.2, hy + 2 + (ataca ? 2 : 0)], [hx + 1.2, hy + 2.4]], D);
    if (ataca) { p.poli([[hx + 1.8, hy + 1], [hx + 5.8, hy + 0.9], [hx + 5.4, hy + 2.6]], '#5a1010'); p.bola(hx + 7.6, hy + 1.8, 2, 2, '#ffb030'); p.px(hx + 7.4, hy + 1.4, '#fff0b0'); }
    p.px(hx + 5.4, hy - 0.4, DD);
    p.poli([[hx - 1.6, hy - 1.6], [hx - 5.6, hy - 5.4], [hx - 0.8, hy - 2.6]], chifre); p.poli([[hx - 0.4, hy - 2], [hx - 3, hy - 6.2], [hx + 0.4, hy - 2.6]], tom(chifre, 0.85));
    p.r(hx + 0.6, hy - 1, 1.2, 0.9, olho); p.px(hx + 1.2, hy - 1, '#ffffff');
    asa(16.4, 14.6 + sobe, 1, false);                     // asa de cá
    return;
  }
  const frente = dir === DIR.S;
  if (frente) { asa(11.5, 15 + sobe, 1, false, 0.8); asa(20.5, 15 + sobe, -1, false, 0.8); }
  else { p.l(16, 25, 16, 31, C, 2.4); p.poli([[14.6, 30.4], [16, 32], [17.4, 30.4]], D); }
  p.r(10.6, 24, 3.6, 5, D); p.r(17.8, 24, 3.6, 5, D); p.r(10.2, 28, 4.4, 1.2, DD); p.r(17.4, 28, 4.4, 1.2, DD);
  p.bola(16, 20.4, 6.8, 6, D); p.bola(16, 19.8, 6.2, 5.4, C);
  if (frente) {
    for (let k = 0; k < 4; k++) p.r(13.6, 18.4 + k * 1.8, 4.8, 1.4, k % 2 ? B : tom(B, 0.88));
    const hy = 11 + (ataca ? 1 : 0);
    p.poli([[13, 17], [14, 13], [18, 13], [19, 17]], C);
    p.poli([[12, hy - 1], [8.4, hy - 6.4], [13, hy - 2.6]], chifre); p.poli([[20, hy - 1], [23.6, hy - 6.4], [19, hy - 2.6]], chifre);
    p.bola(16, hy, 4.6, 4, C); p.bola(15.2, hy - 1.4, 2.4, 1.4, L);
    p.bola(16, hy + 3, 2.8, 1.8, tom(C, 0.85)); p.px(15, hy + 2.4, DD); p.px(17, hy + 2.4, DD);
    if (ataca) { p.o(16, hy + 4.6, 2, 1.4, '#5a1010'); p.bola(16, hy + 6.6, 2.2, 2, '#ffb030'); }
    p.r(13.4, hy - 0.8, 1.6, 1, olho); p.r(17, hy - 0.8, 1.6, 1, olho); p.px(13.6, hy - 0.8, '#ffffff'); p.px(17.2, hy - 0.8, '#ffffff');
  } else {
    for (let k = 0; k < 4; k++) p.poli([[15, 14 + k * 3], [16, 12 + k * 3], [17, 14 + k * 3]], chifre);
    asa(11.5, 15 + sobe, 1, false, 0.8); asa(20.5, 15 + sobe, -1, false, 0.8);
    p.bola(16, 11, 4.2, 3.8, tom(C, 0.85));
    p.poli([[12, 9], [8.6, 3.6], [13, 7]], chifre); p.poli([[20, 9], [23.4, 3.6], [19, 7]], chifre);
  }
}
const GERADORES_NOVOS = { fera: lobo, dragao: dragaoNovo };

// ---------- mais monstros redesenhados (estilo novo) ----------
// golem (Krug, Arauto): 70/71 respirando, 72 punhos erguidos, 73 punhos no chão (rachaduras)
function golemNovo(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.66), DD = tom(C, 0.46), L = tom(C, 1.28), LL = tom(C, 1.5), olho = a.olho || '#ffde59';
  const brilhoRachadura = a.cristal ? tom(a.cristal, 1.2) : null, musgo = a.musgo, cristal = a.cristal;
  const anda = f === 1 ? -1 : f === 2 ? 1 : 0, soco = f === 3 ? 3 : 0, respira = f === 71 ? -0.6 : 0, alto = f === 72, chao = f === 73;
  const pedraBola = (x, y, rx, ry) => { p.bola(x, y, rx, ry, D); p.bola(x - rx * 0.08, y - ry * 0.1, rx * 0.88, ry * 0.86, C); p.bola(x - rx * 0.32, y - ry * 0.38, rx * 0.42, ry * 0.32, L); };
  const rachaduras = (pts) => { for (let i = 0; i < pts.length - 1; i++) { p.l(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], brilhoRachadura || DD); } };
  const punho = (x, y, escuro) => {
    p.bola(x, y, 3.4, 3, escuro ? DD : D); p.bola(x - 0.3, y - 0.4, 2.9, 2.5, escuro ? D : C); p.px(x - 1.2, y - 1.4, escuro ? C : LL);
    if (!escuro) for (const dx of [-1.2, 0, 1.2]) p.px(x + dx, y + 1.6, DD);
  };
  const quebrado = (x, y) => { for (const [dx, dy, ex, ey] of [[0, 0, -3, 1.4], [0, 0, 3, 1.2], [0, 0, -1, 2.4], [0, 0, 1.6, 2.6]]) p.l(x + dx, y + dy, x + ex, y + ey, '#2a1e14'); for (const [dx, dy] of [[-4, -1], [4, -0.6], [-2.6, -2.4], [3, -2.6]]) p.px(x + dx, y + dy, '#b8a888'); };
  if (dir === DIR.L) {
    // braço de trás (mais escuro)
    if (alto) { p.l(13, 15, 13.4, 5, DD, 3); punho(13.4, 3, true); } else if (chao) punho(24, 26.4, true); else { p.bola(11, 19 + anda, 2.6, 4.6, DD); punho(11, 23.6 + anda, true); }
    p.r(11.6, 24, 4.4, 4.6, D); p.r(18, 24 - (f === 1 ? 1 : 0), 4.4, 4.6, D); p.r(11, 28, 5.4, 1.2, DD); p.r(17.4, 28 - (f === 1 ? 1 : 0), 5.4, 1.2, DD);
    // tronco de placas de rocha
    pedraBola(16, 18 + respira, 7.8, 7.6);
    pedraBola(12.4, 14.4 + respira, 3.6, 3);
    rachaduras([[13, 18 + respira], [15, 20 + respira], [14.4, 23 + respira]]); rachaduras([[18, 15 + respira], [19.6, 17.4 + respira], [21.4, 18 + respira]]);
    if (cristal) { p.poli([[9, 12 + respira], [10.6, 4.4 + respira], [12.8, 12 + respira]], cristal); p.poli([[12, 11 + respira], [15, 2.4 + respira], [17, 11 + respira]], tom(cristal, 1.25)); p.l(14.6, 4 + respira, 15, 9 + respira, '#ffffff'); }
    if (musgo) { p.bola(14.4, 11.4 + respira, 4.6, 1.6, musgo); p.r(11, 12 + respira, 1, 2.4, musgo); p.r(17.4, 12.4 + respira, 1, 1.8, musgo); p.px(13.4, 10.6 + respira, tom(musgo, 1.4)); }
    // cabeça enterrada nos ombros, sobrancelha de pedra e olhos acesos
    pedraBola(21.4, 11.4 + respira, 3.8, 3.2); p.l(19.4, 9.8 + respira, 24.4, 10.4 + respira, DD, 1.2);
    p.r(22.6, 10.8 + respira, 1.8, 1, olho); p.px(23.2, 10.8 + respira, '#ffffff');
    // braço da frente
    if (alto) { p.l(18.4, 16, 19.4, 5, D, 3.2); p.l(18, 16, 19, 5.4, C, 2); punho(19.4, 3.4, false); }
    else if (chao) { p.bola(21, 20, 2.8, 4, C); punho(24.4, 25.6, false); quebrado(25, 28.4); }
    else { p.bola(20 + soco * 0.6, 19 - anda, 2.8, 4.4, C); punho(21 + soco, 23 - anda, false); }
    return;
  }
  const frente = dir === DIR.S;
  p.r(9.6, 24 - (f === 1 ? 1 : 0), 5.4, 4.6, D); p.r(17, 24 - (f === 2 ? 1 : 0), 5.4, 4.6, D); p.r(9, 28 - (f === 1 ? 1 : 0), 6.4, 1.2, DD); p.r(16.6, 28 - (f === 2 ? 1 : 0), 6.4, 1.2, DD);
  pedraBola(16, 18 + respira, 8.6, 7.6);
  if (cristal && !frente) { p.poli([[10, 16 + respira], [12, 5.4 + respira], [14, 16 + respira]], cristal); p.poli([[15, 14 + respira], [18, 2.4 + respira], [20, 14 + respira]], tom(cristal, 1.25)); }
  rachaduras([[11.4, 17 + respira], [13.4, 19.6 + respira], [12.6, 22.4 + respira]]); rachaduras([[20.6, 16 + respira], [19, 19 + respira], [20.4, 21.6 + respira]]);
  if (musgo) { p.bola(14.4, 11.6 + respira, 5.4, 1.8, musgo); p.r(11, 12 + respira, 1, 3, musgo); p.r(19, 12.6 + respira, 1, 2.2, musgo); p.px(12.4, 10.6 + respira, tom(musgo, 1.4)); }
  // braços e punhos
  const ombro = (x, lado) => {
    if (alto) { const fx = 16 + lado * 5.4; p.l(x - lado * 1, 15, fx, 6, D, 3.4); p.l(x - lado * 1.4, 15, fx - lado * 0.4, 6.4, C, 2.2); punho(fx, 4, false); }
    else if (chao) { p.bola(x, 21, 2.8, 4, C); punho(x + lado * 1, 26.4, false); quebrado(x + lado * 1, 28.6); }
    else { p.bola(x, 19 + (lado < 0 ? anda : -anda) + respira, 3, 5, C); punho(x, 24 + (lado < 0 ? anda : -anda) + (frente && lado > 0 ? soco : 0), false); }
  };
  ombro(6, -1); ombro(26, 1);
  pedraBola(16, 10.6 + respira, 4.4, 3.6);
  if (frente) {
    p.l(12.4, 9 + respira, 15, 9.8 + respira, DD, 1.2); p.l(19.6, 9 + respira, 17, 9.8 + respira, DD, 1.2);
    p.r(13, 10.2 + respira, 2, 1.1, olho); p.r(17, 10.2 + respira, 2, 1.1, olho); p.px(13.4, 10.2 + respira, '#ffffff'); p.px(17.4, 10.2 + respira, '#ffffff');
    p.r(14, 12.6 + respira, 4, 1, DD);
    if (cristal) { p.poli([[6.6, 13], [7.6, 6.6], [9.8, 13]], cristal); p.poli([[22.2, 13], [24.2, 6], [25.4, 13]], cristal); }
  }
}

// Brambleback: javali coberto de espinhos em brasa. 70/71 espinhos tremulando (bufa), 72 cavando o chão com a pata
function javaliNovo(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.62), DD = tom(C, 0.42), L = tom(C, 1.3), esp = a.cristal || '#ff7a3a', presa = '#efe4c8', olho = a.olho || '#ffe070', focinho = '#c87a6a';
  const s1 = f === 1 ? -1 : 0, s2 = f === 2 ? -1 : 0, bote = f === 3 ? 2 : 0, chama = f === 71 ? 1 : 0, cava = f === 72, abaixa = f === 70 || f === 71 ? 0.6 : 0;
  const espinho = (x, y, h, k) => {
    const hh = h + ((k + chama) % 2 ? 0.8 : 0);
    p.poli([[x - 1.3, y], [x, y - hh], [x + 1.3, y]], '#8a1a0a'); p.poli([[x - 0.8, y - hh * 0.3], [x, y - hh], [x + 0.8, y - hh * 0.3]], esp);
    p.poli([[x - 0.4, y - hh * 0.6], [x, y - hh], [x + 0.4, y - hh * 0.6]], '#ffd060'); p.px(x, y - hh - 0.6, (k + chama) % 3 ? '#fff0a0' : '#ffffff');
  };
  const pelos = (x0, x1, y0, y1) => { for (let x = x0; x < x1; x += 1.6) for (let y = y0; y < y1; y += 2.2) p.l(x + ((y * 3) % 1.4), y, x + 0.8 + ((y * 3) % 1.4), y + 1.2, D); };
  if (dir === DIR.L) {
    p.r(8, 23 + s1, 3, 5.6, DD); p.r(19, 23 + s2, 3, 5.6, DD);
    p.bola(15, 19, 10, 6.4, D); p.bola(14.6, 18.4, 9.4, 5.8, C); p.bola(12, 15.6, 6, 2, L);
    pelos(7, 22, 17, 22); p.o(15, 22.4, 7, 2.2, tom(C, 1.15));
    for (let k = 0; k < 8; k++) espinho(6 + k * 2.4, 15.2 - Math.sin((k / 7) * Math.PI) * 3, 3 + (k % 3), k);
    // pernas da frente (uma levantada quando cava)
    p.r(11, 23 + s2, 3, 5.6, C); p.r(10.6, 28.2 + s2, 3.8, 1.2, '#2a1410');
    if (cava) { p.r(22.6, 21.4, 3, 3.6, C); p.r(23.4, 24.6, 3, 1.2, '#2a1410'); for (const [x, y] of [[27, 27], [29, 26], [26, 28.6]]) p.px(x, y, '#8a6a40'); }
    else { p.r(22, 23 + s1, 3, 5.6, C); p.r(21.6, 28.2 + s1, 3.8, 1.2, '#2a1410'); }
    // cabeça baixa: focinho, presas curvas, orelha, olho bravo
    const hx = 25 + bote, hy = 20 + bote / 2 + abaixa;
    p.bola(hx, hy, 4.8, 4.4, D); p.bola(hx - 0.4, hy - 0.4, 4.2, 3.8, C);
    p.bola(hx + 3.6, hy + 0.6, 2, 2.2, focinho); p.r(hx + 4.6, hy + 0.2, 0.8, 0.8, '#2a1410'); p.r(hx + 4.6, hy + 1.4, 0.8, 0.8, '#2a1410');
    p.poli([[hx + 1.4, hy + 2.6], [hx + 4.6, hy - 1.4], [hx + 5, hy - 0.8], [hx + 2.6, hy + 3.4]], presa);
    p.poli([[hx - 2.4, hy - 3], [hx - 1.6, hy - 7], [hx + 0.4, hy - 3.4]], D);
    p.l(hx - 0.6, hy - 2.4, hx + 1.8, hy - 1.4, '#1a0a06'); p.r(hx + 0.2, hy - 1.6, 1.6, 1, olho); p.px(hx + 0.8, hy - 1.6, '#ffffff');
    return;
  }
  const costas = dir === DIR.N;
  p.r(10, 24 + s1, 3, 5, DD); p.r(19, 24 + s2, 3, 5, DD);
  p.bola(16, 19, 9, 6.4, D); p.bola(16, 18.4, 8.4, 5.8, C); pelos(9, 23, 16, 22);
  for (let k = 0; k < 8; k++) espinho(7 + k * 2.6, 15 - Math.sin((k / 7) * Math.PI) * 2.5, 3 + ((k + 1) % 3), k);
  if (costas) { p.l(16, 22, 16, 25.4, D, 1.2); p.bola(16, 26, 1.2, 1, D); return; }
  const hy = 21 + bote / 2 + abaixa;
  p.bola(16, hy, 5.6, 4.8, D); p.bola(16, hy - 0.4, 5, 4.2, C);
  p.bola(16, hy + 2.6, 3.2, 2.2, focinho); p.r(14.6, hy + 2.2, 1, 1, '#2a1410'); p.r(16.6, hy + 2.2, 1, 1, '#2a1410');
  p.poli([[12, hy + 2.4], [9.6, hy - 2.4], [10.6, hy - 2.6], [13.2, hy + 1.6]], presa); p.poli([[20, hy + 2.4], [22.4, hy - 2.4], [21.4, hy - 2.6], [18.8, hy + 1.6]], presa);
  p.l(12.6, hy - 2.2, 14.6, hy - 1.4, '#1a0a06'); p.l(19.4, hy - 2.2, 17.4, hy - 1.4, '#1a0a06');
  p.r(13, hy - 1.4, 1.6, 1, olho); p.r(17.4, hy - 1.4, 1.6, 1, olho);
  p.poli([[11, hy - 4], [10, hy - 8], [13, hy - 5]], D); p.poli([[21, hy - 4], [22, hy - 8], [19, hy - 5]], D);
  if (cava) for (const [x, y] of [[9, 28], [11, 27], [8, 26.6]]) p.px(x, y, '#8a6a40');
}

// Sentinela Azul: gigante de pedra com runas acesas e o cristal flutuando (70 a 73: o cristal gira e as runas pulsam)
function sentinelaNova(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.62), DD = tom(C, 0.45), L = tom(C, 1.25), LL = tom(C, 1.45), cr = a.cristal, olho = a.olho, musgo = '#4a7a3a';
  const fase = f >= 70 && f <= 73 ? f - 70 : 0, bob = f === 1 ? -1 : f === 2 ? 0.5 : [0, -0.6, -1, -0.6][fase], soco = f === 3;
  const passo = f === 1 ? -1 : 0, passo2 = f === 2 ? -1 : 0, runa = [cr, tom(cr, 1.3), tom(cr, 1.55), tom(cr, 1.3)][fase];
  const cristal = (x, y) => {
    const w = [3, 2.2, 1.2, 2.2][fase];
    p.poli([[x, y - 5 + bob], [x + w, y + bob], [x, y + 5 + bob], [x - w, y + bob]], cr);
    p.poli([[x, y - 5 + bob], [x + w, y + bob], [x, y + bob]], tom(cr, 1.35)); p.r(x - 0.4, y - 3 + bob, 0.8, 2, '#ffffff');
    for (const k of [0, 1, 2]) { const an = (fase / 4 + k / 3) * Math.PI * 2; p.px(x + Math.cos(an) * 5, y + Math.sin(an) * 1.6 + bob, tom(cr, 1.4)); }
  };
  const pedra = (x, y, rx, ry) => { p.bola(x, y, rx, ry, D); p.bola(x - rx * 0.1, y - ry * 0.1, rx * 0.86, ry * 0.86, C); p.bola(x - rx * 0.35, y - ry * 0.4, rx * 0.4, ry * 0.3, L); };
  if (dir === DIR.L) {
    p.r(11, 23 + passo, 5, 6, DD); p.r(17, 23 + passo2, 5, 6, D); p.r(10.6, 28 + passo, 5.8, 1.2, DD); p.r(16.6, 28 + passo2, 5.8, 1.2, DD);
    pedra(15, 17, 7, 7);
    p.l(12, 14, 15, 19, runa, 1); p.l(15, 19, 13, 22.6, runa, 1); p.l(15, 19, 18, 18.4, runa); p.px(15, 19, '#ffffff');
    pedra(14, 12, 4, 3.2); p.bola(13.4, 9.8, 3.4, 1.4, musgo); p.r(11.6, 10.4, 0.8, 2, musgo);
    pedra(21, 11, 3, 2.8); p.l(19.6, 9.6, 23.6, 10, DD); p.r(22.4, 10.6, 1.6, 1, olho); p.px(23, 10.6, '#ffffff');
    pedra(soco ? 24 : 19, soco ? 17 : 20, 3, 4.6); p.l(soco ? 23 : 18, soco ? 16 : 19, soco ? 25 : 20, soco ? 18.4 : 21.4, runa);
    cristal(19, 4.5);
    return;
  }
  const costas = dir === DIR.N;
  p.r(10, 23 + passo, 5, 6, DD); p.r(17, 23 + passo2, 5, 6, DD); p.r(9.6, 28 + passo, 5.8, 1.2, tom(DD, 0.8)); p.r(16.6, 28 + passo2, 5.8, 1.2, tom(DD, 0.8));
  pedra(16, 17, 8, 7);
  if (!costas) { p.l(16, 12.6, 16, 21.6, runa, 1); p.l(11.6, 16, 16, 18.4, runa, 1); p.l(20.4, 16, 16, 18.4, runa, 1); p.bola(16, 18, 1.2, 1.2, tom(runa, 1.3)); }
  else { p.l(12, 14, 20, 20, runa); p.l(20, 14, 12, 20, runa); }
  pedra(8, 13, 3.6, 3.2); pedra(24, 13, 3.6, 3.2);
  p.bola(7.4, 10.6, 3.2, 1.2, musgo); p.bola(23.4, 10.6, 3.2, 1.2, musgo); p.r(6, 11, 0.8, 2.4, musgo); p.r(25.4, 11, 0.8, 2, musgo);
  pedra(7, 20, 2.8, 5); pedra(25, soco ? 15 : 20, 2.8, 5);
  pedra(16, 10, 3.6, 3);
  if (!costas) { p.l(13.6, 8.8, 18.4, 8.8, DD); p.r(13.8, 10, 1.6, 1, olho); p.r(16.8, 10, 1.6, 1, olho); p.px(14.2, 10, '#ffffff'); p.px(17.2, 10, '#ffffff'); }
  cristal(16, 4.5);
}

// Arraia do Rio: nada no ar. 70 a 73: nadadeiras subindo e descendo, cauda ondulando
function arraiaNova(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.68), DD = tom(C, 0.48), L = tom(C, 1.3), B = a.barriga || tom(C, 1.4), olho = a.olho || '#ffffff';
  const fase = f >= 70 && f <= 73 ? f - 70 : f === 1 ? 0 : f === 2 ? 2 : 1, asa = [-3.2, 0, 2.4, 0][fase], ataque = f === 3, ond = [0, 1, 0, -1][fase];
  p.o(16, 28.6, 8, 1.8, 'rgba(0,0,0,0.25)');
  if (dir === DIR.L) {
    for (let k = 0; k < 7; k++) p.r(7 - k, 18.6 + Math.sin(k * 0.9 + fase * 1.5) * 1.2, 1.2, 1, k < 3 ? D : DD);
    p.poli([[0, 19.4 + ond], [1.6, 17.4 + ond], [2.4, 20.6 + ond]], L);
    p.poli([[6, 18], [15, 11.4 + asa], [24, 16], [16, 21]], C); p.poli([[6, 18], [16, 21], [24, 16], [16, 19.2]], D);
    p.l(7, 17.6, 15, 11.8 + asa, L); for (const [x, y] of [[12, 15.6], [16, 14.6 + asa * 0.3], [19, 15.8]]) p.r(x, y, 1.2, 0.8, B);
    p.poli([[24, 16], [29, 14 + (ataque ? 2 : 0)], [28.4, 18]], C); p.r(26.4, 16.4, 0.8, 1.6, DD);
    p.r(23, 14.8, 1.2, 1, olho); p.px(23, 14.8, '#141414');
    return;
  }
  const costas = dir === DIR.N;
  if (!costas) { for (let k = 0; k < 8; k++) p.r(15.6 + Math.sin(k * 0.8 + fase * 1.5) * 1.1, 11 - k * 1.1, 1, 1.2, k < 4 ? D : DD); p.poli([[15, 3 + ond * 0.3], [16, 0], [17, 3 + ond * 0.3]], L); }
  p.poli([[16, 9], [31, 17 + asa], [16, 25], [1, 17 + asa]], C);
  p.poli([[16, 17], [31, 17 + asa], [16, 25], [1, 17 + asa]], D);
  p.l(1, 17 + asa, 16, 9, L); p.l(16, 9, 31, 17 + asa, L);
  for (const [x, y] of [[9, 16], [23, 16], [13, 19], [19, 19], [16, 14], [6, 17], [26, 17]]) p.r(x, y + (Math.abs(x - 16) > 5 ? asa / 2 : 0), 1.5, 1, B);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) p.l(16 + s * (3 + k * 1.4), 20.6 + k * 0.4, 16 + s * (3.6 + k * 1.4), 21.6 + k * 0.4, DD);
  if (costas) { for (let k = 0; k < 8; k++) p.r(15.6 + Math.sin(k * 0.8 + fase * 1.5) * 1.1, 24 + k * 1, 1, 1.2, k < 4 ? D : DD); p.poli([[15, 31 + ond * 0.3], [16, 32], [17, 31 + ond * 0.3]], L); }
  else {
    p.poli([[13, 11], [12, 6], [15, 10]], C); p.poli([[19, 11], [20, 6], [17, 10]], C);
    p.r(12.8, 12.8, 2, 1.2, olho); p.r(17.2, 12.8, 2, 1.2, olho); p.px(13.6, 12.8, '#141414'); p.px(18, 12.8, '#141414');
    if (ataque) p.o(16, 16, 2.5, 1.5, '#0c2a2a');
  }
}

// Larva do Vazio / Barão Nashor: segmentos com placas e espinhos ondulando (70 a 73), 74 rugindo de boca aberta
function vermeNovo(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.66), DD = tom(C, 0.45), L = tom(C, 1.3), esp = a.espinhos || tom(C, 1.5), olho = a.olho || '#b8ff5a', dente = a.dente || '#eee4c8';
  const fase = f >= 70 && f <= 73 ? f - 70 : f === 1 ? 1 : f === 2 ? 3 : 0, ruge = f === 74, bote = f === 3 ? 2 : 0;
  const ond = (i) => Math.sin((fase / 4) * Math.PI * 2 + i * 1.2) * 1.1;
  const seg = (x, y, r, i) => {
    p.bola(x, y, r, r * 0.85, DD); p.bola(x - 0.2, y - 0.3, r * 0.9, r * 0.74, i % 2 ? C : D);
    p.l(x - r * 0.7, y + r * 0.1, x + r * 0.7, y + r * 0.1, DD); p.px(x - r * 0.4, y - r * 0.4, L);
    p.poli([[x - 1, y - r * 0.6], [x, y - r - 2.4], [x + 1, y - r * 0.6]], esp); p.px(x, y - r - 2.2, '#ffffff');
  };
  const boca = (abre) => abre || bote;
  if (dir === DIR.L) {
    [[5, 25, 2.5], [8, 24, 3.2], [11.5, 22, 3.8], [15, 20, 4.2]].forEach(([x, y, r], i) => seg(x, y + ond(i), r, i));
    const hx = 21 + bote, hy = 16 + ond(4) * 0.5, abre = ruge ? 3 : bote ? 1.6 : 0.4;
    p.bola(hx, hy, 5.6, 5, DD); p.bola(hx - 0.3, hy - 0.4, 5, 4.4, C); p.bola(hx - 1.6, hy - 2, 2.4, 1.4, L);
    for (const k of [0, 1, 2]) p.poli([[hx - 3 + k * 2, hy - 4.2], [hx - 2.4 + k * 2, hy - 7.2], [hx - 1.6 + k * 2, hy - 4.2]], esp);
    if (abre > 0.5) p.poli([[hx + 3, hy - 1], [hx + 6, hy - abre], [hx + 6, hy + abre * 1.2], [hx + 3, hy + 1.4]], '#2a0d1e');
    if (ruge) p.bola(hx + 4.4, hy, 1.4, 1.4, tom(olho, 1.2));
    p.poli([[hx + 3, hy - 1], [hx + 9, hy - 4 - abre], [hx + 6, hy + 0.4]], dente); p.poli([[hx + 3, hy + 2], [hx + 9, hy + 5 + abre], [hx + 5.6, hy + 2.2]], dente);
    p.r(hx, hy - 3, 2, 1.6, olho); p.px(hx + 0.6, hy - 3, '#ffffff');
    return;
  }
  const frente = dir === DIR.S;
  [[16, 27, 3], [16, 24, 4], [16, 20, 5]].forEach(([x, y, r], i) => seg(x + ond(i) * 1.4, frente ? y : 36 - y, r, i));
  const hy = frente ? 13 : 19;
  p.bola(16, hy, 6.4, 5.6, DD); p.bola(16, hy - 0.4, 5.8, 5, C); p.bola(14.4, hy - 2.4, 2.6, 1.4, L);
  for (const k of [-2, 0, 2]) p.poli([[16 + k * 2 - 1, hy - 4.4], [16 + k * 2, hy - 8], [16 + k * 2 + 1, hy - 4.4]], esp);
  if (frente) {
    const abre = ruge ? 3.4 : bote ? 2 : 0.6;
    p.o(16, hy + 3 + abre / 2, 3.4, 1.4 + abre, '#2a0d1e');
    if (ruge) { p.bola(16, hy + 3.6 + abre / 2, 1.6, 1.4, tom(olho, 1.2)); for (const x of [13.4, 14.8, 17.2, 18.6]) p.poli([[x - 0.5, hy + 1.6], [x, hy + 3], [x + 0.5, hy + 1.6]], dente); }
    p.poli([[12.4, hy + 1], [13.4, hy + 5 + abre], [14.8, hy + 1]], dente); p.poli([[17.2, hy + 1], [18.6, hy + 5 + abre], [19.6, hy + 1]], dente);
    p.r(11.6, hy - 3, 2.4, 2, olho); p.r(18, hy - 3, 2.4, 2, olho); p.px(12.2, hy - 3, '#ffffff'); p.px(18.6, hy - 3, '#ffffff');
  }
}

// Criatura do Vazio: olho gigante numa carapaça com veias brilhantes; 70 a 73 tentáculos ondulando, 74 piscando
function olhoVazioNovo(p, a, dir, f) {
  const C = a.cor, D = tom(C, 0.62), DD = tom(C, 0.45), L = tom(C, 1.3), carap = a.cristal || tom(C, 1.4), olho = a.olho, veia = tom(a.olho || '#ff5af0', 1.1);
  const fase = f >= 70 && f <= 73 ? f - 70 : f === 1 ? 1 : f === 2 ? 3 : 0, pisca = f === 74, ataque = f === 3, bob = [0, -0.6, -1, -0.6][fase];
  const tentaculo = (x0, ph, lado) => { for (let k = 0; k < 9; k++) { const y = 20 + k * 1.2 + bob, x = x0 + Math.sin(k * 0.8 + ph + fase * 1.6) * 1.6 * lado; p.r(x, y, k < 4 ? 2 : k < 7 ? 1.4 : 1, 1.2, k % 3 === 2 ? tom(C, 0.85) : D); if (k === 8) p.px(x, y + 1, veia); } };
  p.o(16, 29, 7, 1.8, 'rgba(0,0,0,0.3)');
  tentaculo(10, 0, 1); tentaculo(14.5, 1.5, -1); tentaculo(19, 3, 1); tentaculo(22, 4.2, -1);
  const corpo = (x, rx) => {
    p.bola(x, 14 + bob, rx, 7.5, DD); p.bola(x - 0.3, 13.6 + bob, rx * 0.92, 6.8, C); p.bola(x - 2.4, 10.6 + bob, rx * 0.4, 2.2, L);
    for (const [x0, y0, x1, y1] of [[x - 5, 16, x - 2, 19], [x + 4, 15, x + 6, 18.6], [x - 6, 12, x - 4, 9.6]]) p.l(x0, y0 + bob, x1, y1 + bob, veia);
  };
  const olhoGrande = (x, y, rx, ry) => {
    p.o(x, y, rx + 0.6, ry + 0.6, DD);
    if (pisca) { p.o(x, y, rx, ry, D); p.l(x - rx, y, x + rx, y, DD); return; }
    p.o(x, y, rx, ry, '#ffd8f8'); p.o(x, y, rx * 0.66, ry * 0.86, ataque ? '#ff3060' : olho); p.o(x, y, rx * 0.4, ry * 0.6, tom(ataque ? '#ff3060' : olho, 0.6));
    p.r(x - 0.4, y - ry * 0.5, 0.9, ry, '#200818'); p.r(x - rx * 0.5, y - ry * 0.6, 1, 1, '#ffffff');
  };
  if (dir === DIR.L) {
    corpo(15, 8);
    for (const [x, y, h] of [[9, 9, 5], [13, 7, 6], [17, 7, 5]]) { p.poli([[x - 1.5, y + 2 + bob], [x - 2.5, y - h + bob], [x + 1.5, y + 2 + bob]], carap); p.l(x - 1.6, y + 1 + bob, x - 2.2, y - h + 1.4 + bob, tom(carap, 1.3)); }
    olhoGrande(20.8, 14 + bob, 2.8, 3.6);
    p.o(21, 19.6 + bob, 2.5, ataque ? 2 : 1, '#200818');
    return;
  }
  const costas = dir === DIR.N;
  corpo(16, 8.5);
  for (const [x, h] of [[10, 5], [13.5, 7], [18.5, 7], [22, 5]]) { p.poli([[x - 2, 10 + bob], [x, 9 - h + bob], [x + 2, 10 + bob]], carap); p.l(x - 0.6, 9.4 + bob, x, 9.6 - h + bob, tom(carap, 1.3)); }
  if (costas) { p.l(10, 15 + bob, 22, 15 + bob, carap, 1); p.l(16, 8 + bob, 16, 20 + bob, carap, 1); return; }
  olhoGrande(16, 14 + bob, 4.6, 4);
  p.o(16, 19.6 + bob, 4, ataque ? 2.4 : 1.4, '#200818');
  for (const x of [13, 15, 17, 19]) p.r(x, 18.6 + bob, 1, 1, '#f0e8e0');
}
for (const [forma, gerador] of [['golem', golemNovo], ['javali', javaliNovo], ['sentinela', sentinelaNova], ['arraia', arraiaNova], ['verme', vermeNovo], ['olhoVazio', olhoVazioNovo]]) { MONSTROS_NOVOS.add(forma); GERADORES_NOVOS[forma] = gerador; }

// tropas no estilo novo, como as tropas do LoL, desenhadas no tamanho certo (sem encolher, ver sprite()).
// Quadros: 0 parado, 1 e 2 passos, 3 golpe, 70 a 73 parado (respira, os olhos piscam, a crista e o orbe se mexem).
// Tropa Corpo a Corpo: elmo grande e redondo com a viseira escura e os olhos acesos, a crista vermelha, ombreiras grandes
// com a borda dourada, escudo redondo dourado com o emblema azul, espada curta, cinto e botas.
function tropaNova(p, a, dir, f) {
  const k = f >= 70 ? f - 70 : -1, q = f >= 70 ? 0 : f;
  const arm = a.arm, armE = tom(arm, 0.62), armC = tom(arm, 1.3), armB = tom(arm, 1.6), elmo = a.elmo, elmoE = tom(elmo, 0.68), elmoC = tom(elmo, 1.22);
  const escudo = a.escudo || '#c9a050', escE = tom(escudo, 0.62), escC = tom(escudo, 1.25), ouro = '#e8c048', calca = a.calca, bota = tom(calca, 0.55);
  const lamina = '#e4e8f0', laminaE = '#9aa2b0', olho = k === 2 ? tom(a.olho || '#ffe066', 0.6) : a.olho || '#ffe066', crista = '#c83a2a', vis = '#0e1218';
  const ataque = q === 3, m = marcha(q), lA = m.lA, lB = m.lB, bA = ataque ? 0 : m.bA, bB = ataque ? 0 : m.bB, resp = k === 1 || k === 2 ? 0.5 : 0;
  const balanca = k >= 0 ? (k % 2 ? 0.5 : -0.3) : m.passo * 0.15;
  const espada = (x, y, cima = true) => {                 // a espada curta: guarda dourada, lâmina larga com o fio claro
    p.r(x - 1.5, y, 4, 1, ouro); p.r(x, y + 1, 1, 2, '#5a3a20');
    if (cima) { p.r(x - 0.5, y - 7, 2, 7, lamina); p.r(x + 1, y - 7, 0.6, 7, laminaE); p.px(x, y - 8, lamina); }
    else { p.r(x - 0.5, y + 3, 2, 7, lamina); p.r(x + 1, y + 3, 0.6, 7, laminaE); }
  };
  if (dir === DIR.L) {
    const pa = m.passo * 0.8, bx = ataque ? 0 : m.braco * 0.7;
    // pernas e botas
    p.r(12.5 - pa, 23.5 - m.liftT, 3, 3.5, tom(calca, 0.75)); p.r(12 - pa, 26.5 - m.liftT, 4.5, 2.5, tom(bota, 0.8));
    p.r(16.5 + pa, 23.5 - m.liftF, 3, 3.5, calca); p.r(16.5 + pa, 26.5 - m.liftF, 4.6, 2.5, bota); p.r(16.5 + pa, 26.5 - m.liftF, 4.6, 0.6, tom(bota, 1.5));
    // corpo com a couraça, o saiote e o cinto
    p.bola(15.5, 19 - resp, 5.4, 5, arm); p.poli([[11, 21.5], [20, 21.5], [20.5, 24.5], [10.5, 24.5]], armE); p.r(11, 21.2, 9.5, 1, ouro);
    p.r(13, 16 - resp, 2, 4, armC); p.px(13.5, 15.5 - resp, armB);
    // espada no braço de trás (golpe para a frente)
    if (ataque) { p.r(16, 16, 6, 3, arm); p.r(21, 16, 2, 2.5, armC); p.r(22.5, 16.5, 1, 2, ouro); p.r(23.5, 16.6, 7, 1.8, lamina); p.r(23.5, 17.8, 7, 0.6, laminaE); p.px(30.5, 17.2, lamina); }
    else { p.r(13 + bx, 17, 3, 5, armE); espada(14.5 + bx, 21.5, true); }
    // ombreira grande
    p.bola(14, 15 - resp, 3.4, 2.6, armC); p.l(11, 16.5 - resp, 17, 16.5 - resp, ouro); p.px(13, 14 - resp, armB);
    // elmo: redondo, a viseira na frente com o olho aceso, a crista vermelha balançando
    const hy = 10 - resp;
    p.bola(16.5, hy, 5.6, 5.4, elmo); p.bola(15.5, hy - 1.5, 3.6, 3, elmoC); p.r(12, hy + 3.5, 9, 1.4, elmoE);
    p.r(17.5, hy - 0.5, 4.8, 2.2, vis); p.r(20, hy, 1.2, 1, olho); p.px(21, hy, tom(olho, 1.3));
    p.poli([[11.5, hy - 2.5 + balanca], [14.5, hy - 7.5], [16.5, hy - 6.5], [14, hy - 2]], crista); p.l(12.4, hy - 3.2, 14.6, hy - 6.8, tom(crista, 1.35));
    // escudo na frente, de lado (uma elipse fina com a borda)
    const sx = 21.6 - bx * 0.4;
    p.bola(sx, 19.5 - resp, 2.2, 5.2, escE); p.bola(sx - 0.5, 19.5 - resp, 1.6, 4.6, escudo); p.r(sx - 1, 18.5 - resp, 1, 2, escC);
    return;
  }
  const costas = dir === DIR.N;
  const ex = costas ? 9 : 23, sx = costas ? 23 : 8.5;          // de frente: escudo na esquerda da tela e espada na direita
  // escudo atrás do corpo, de costas
  if (costas) { p.bola(sx, 19.5 + bB - resp, 4.4, 5.2, escE); p.bola(sx, 19.5 + bB - resp, 3.4, 4.2, tom(escE, 0.85)); }
  // pernas e botas
  for (const [x, l] of [[12, lA], [17, lB]]) { p.r(x, 23.5 + l, 3, 3.5, calca); p.r(x - 0.5, 26.5 + l, 4, 2.5, bota); p.r(x - 0.5, 26.5 + l, 4, 0.6, tom(bota, 1.5)); }
  // corpo: couraça, o saiote em placas e o cinto dourado com a fivela
  p.bola(16, 19 - resp, 6.4, 5.2, arm);
  p.poli([[10.5, 21.5], [21.5, 21.5], [22.5, 24.6], [9.5, 24.6]], armE); for (const x of [13, 16, 19]) p.r(x, 22, 0.6, 2.6, tom(armE, 0.75));
  p.r(10, 21.2, 12, 1, ouro); if (!costas) { p.r(15, 21, 2, 1.6, escC); p.px(15.5, 21.5, '#8a6a20'); }
  if (!costas) { p.r(14, 15.5 - resp, 4, 4.5, armC); p.r(15, 15 - resp, 2, 1, armB); p.l(14, 15.5 - resp, 16, 18.5 - resp, armB); }
  // a espada
  const ye = costas ? bA : bB;
  if (ataque && !costas) { p.r(20, 13, 3, 5, arm); p.r(20, 12, 3, 1.5, armC); p.l(21.5, 12, 28, 4, ouro, 1); p.l(22.5, 11, 29.5, 2.5, lamina, 2); p.px(30, 2, lamina); }
  else { p.r(ex - 1.5, 16 + ye - resp, 3, 5, costas ? armE : arm); espada(ex + (costas ? -2.5 : 2.5), 21 + ye - resp, true); }
  // ombreiras grandes com a borda dourada
  for (const x of [9.6, 22.4]) { p.bola(x, 15.4 - resp, 3.4, 2.6, armC); p.l(x - 3, 16.8 - resp, x + 3, 16.8 - resp, ouro); p.px(x - 1, 14.2 - resp, armB); }
  // elmo grande e redondo
  const hy = 9.6 - resp;
  p.bola(16, hy, 6.2, 5.6, elmo); p.bola(15, hy - 1.6, 4, 3.2, elmoC); p.r(10.5, hy + 3.4, 11, 1.6, elmoE);
  p.r(15.6, hy - 5.4, 0.8, 9, costas ? elmoE : elmoC);                                  // a quilha no meio do elmo
  if (!costas) {
    p.r(11, hy - 0.2, 10, 2.6, vis);                                                     // a viseira
    p.r(12.8, hy + 0.4, 1.6, 1.2, olho); p.r(17.6, hy + 0.4, 1.6, 1.2, olho); p.px(13.4, hy + 0.4, '#fff8d0'); p.px(18.2, hy + 0.4, '#fff8d0');
    p.r(13, hy + 2.6, 6, 1, elmoE); for (const x of [14, 16, 18]) p.px(x, hy + 3.2, vis);   // a grade da boca
  }
  p.poli([[15, hy - 5.4], [16 + balanca, hy - 10], [17, hy - 5.4]], crista); p.px(16 + balanca, hy - 9, tom(crista, 1.4)); p.r(15, hy - 6, 2, 1, tom(crista, 0.7));
  // escudo redondo na frente: borda dourada escura, campo dourado, o emblema azul no meio e o cravo
  if (!costas) {
    const sy = 19.5 + bA - resp;
    p.bola(sx, sy, 4.6, 5.4, escE); p.bola(sx, sy, 3.8, 4.6, escudo); p.bola(sx - 1, sy - 1.4, 1.8, 1.6, escC);
    p.poli([[sx, sy - 3], [sx + 2.4, sy], [sx, sy + 3.2], [sx - 2.4, sy]], arm); p.poli([[sx, sy - 1.8], [sx + 1.2, sy], [sx, sy + 2], [sx - 1.2, sy]], armB);
    p.px(sx, sy, '#fff0b0');
  }
}
// Tropa Mago: elmo-capuz de metal pontudo com o rosto na sombra e os olhos acesos, manto azul-violeta até o chão com a
// barra e as runas douradas, ombreiras, e o cajado com o orbe brilhando que gira em volta da ponta
function magoNovo(p, a, dir, f) {
  const k = f >= 70 ? f - 70 : -1, q = f >= 70 ? 0 : f;
  const robe = a.robe, robeE = tom(robe, 0.66), robeC = tom(robe, 1.25), capuz = a.capuz || tom(robe, 0.8), capuzC = tom(capuz, 1.35), capuzE = tom(capuz, 0.7);
  const ouro = '#e8c048', ouroE = '#a07a28', orbe = a.orbe, sombra = '#0c0a16', cajado = '#6a4628', olho = k === 2 ? tom(orbe, 0.6) : orbe;
  const ataque = q === 3, m = marcha(q), bob = m.bA * 0.8 + (k === 1 || k === 3 ? -0.5 : 0), barra = m.balanco * 1.2, resp = k === 1 || k === 2 ? 0.5 : 0;
  const giro = ((k >= 0 ? k : q) / 4) * Math.PI * 2;
  const orbeEm = (x, y, r) => { p.bola(x, y, r + 1, r + 1, tom(orbe, 0.55)); p.bola(x, y, r, r, orbe); p.bola(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.45, tom(orbe, 1.35)); p.px(x - r * 0.45, y - r * 0.55, '#ffffff');
    for (let i = 0; i < 2; i++) { const an = giro + i * Math.PI; p.px(x + Math.cos(an) * (r + 2.4), y + Math.sin(an) * (r + 1), i ? '#ffffff' : tom(orbe, 1.3)); } };
  if (dir === DIR.L) {
    // manto
    p.poli([[10 + barra, 29], [22, 29], [20, 14], [12, 14]], robe); p.poli([[10 + barra, 29], [14, 29], [14, 15], [12, 14]], robeE);
    p.r(10 + barra, 27.6, 12, 1.4, ouro); p.r(12, 21 - resp, 8, 1, ouro); p.px(17, 24, ouro); p.px(19, 26, ouro);
    // cajado na mão da frente
    if (ataque) { p.r(17, 15, 6, 2.6, robeC); p.l(20, 17, 29, 13, cajado, 1); orbeEm(28.5, 12.5, 2.6); p.l(24, 11, 31, 9, tom(orbe, 1.3), 1); }
    else { p.r(18, 16 - resp, 4, 3, robeC); p.l(22.5, 9 + bob, 22.5, 28, cajado, 1); p.r(21.9, 10 + bob, 1.4, 1.4, ouro); orbeEm(22.6, 6.5 + bob, 2.2); }
    // ombreira e o capuz de metal pontudo, o rosto na sombra com o olho aceso
    p.bola(14, 15 - resp, 3, 2.2, capuzC); p.l(11.5, 16.4 - resp, 16.5, 16.4 - resp, ouro);
    const hy = -resp;
    p.poli([[10.5, 14 + hy], [19.5, 14 + hy], [21, 9.5 + hy], [18, 4 + hy], [13.5, 2 + hy], [8, 7 + hy]], capuz); p.poli([[8, 7 + hy], [13.5, 2 + hy], [12, 8 + hy]], capuzE);
    p.l(13.5, 2.5 + hy, 18, 4.5 + hy, capuzC); p.l(11, 14 + hy, 19.5, 14 + hy, ouro);
    p.bola(18.6, 10.4 + hy, 2.4, 2.6, sombra); p.r(19.2, 10 + hy, 1.2, 1, olho);
    return;
  }
  const costas = dir === DIR.N, xc = costas ? 7 : 25;
  // manto até o chão com a barra dourada e as runas na frente
  p.poli([[9 - barra, 29], [23 + barra, 29], [20.5, 14], [11.5, 14]], robe);
  p.poli([[16, 14], [20.5, 14], [23 + barra, 29], [17, 29]], robeE);
  p.r(9 - barra, 27.6, 14 + barra * 2, 1.4, ouro); p.r(9 - barra, 29, 14 + barra * 2, 0.4, ouroE);
  if (!costas) {
    p.poli([[14, 15], [18, 15], [19, 27.5], [13, 27.5]], robeC); p.l(16, 16, 16, 27, tom(robe, 0.8));
    p.r(12, 20.5 - resp, 8, 1, ouro); p.r(15.4, 21.5 - resp, 1.2, 1.2, orbe);
    for (const [x, y] of [[14, 24], [18, 24], [16, 26]]) p.px(x, y, ouro);
  }
  // mangas
  p.bola(10.4, 18.5 - resp, 2.6, 3.6, robeC); p.r(9, 21 - resp, 3, 1, ouro);
  // cajado com o orbe
  if (ataque && !costas) { p.bola(22, 13, 2.6, 3, robeC); p.l(22, 15, 27, 4, cajado, 1); orbeEm(27.5, 3.5, 3.2); p.r(20.5, 11, 2, 2, orbe); }
  else { p.bola(xc - 2.5 + (costas ? 5 : 0), 18.5 - resp, 2.6, 3.6, robeC); p.l(xc, 9 + bob, xc, 28.5, cajado, 1); p.r(xc - 0.7, 10 + bob, 1.4, 1.2, ouro); orbeEm(xc, 6.5 + bob, 2.3); }
  // ombreiras de metal
  for (const x of [10.6, 21.4]) { p.bola(x, 15.2 - resp, 3, 2.2, capuzC); p.l(x - 2.6, 16.4 - resp, x + 2.6, 16.4 - resp, ouro); }
  // o capuz de metal pontudo, com a borda dourada e o rosto na sombra
  const hy = -resp;
  p.poli([[10, 15 + hy], [22, 15 + hy], [20.4, 7 + hy], [16, 1 + hy], [11.6, 7 + hy]], capuz);
  p.poli([[16, 1 + hy], [20.4, 7 + hy], [22, 15 + hy], [17, 15 + hy]], capuzE);
  p.l(13, 5 + hy, 16, 1.5 + hy, capuzC); p.l(10, 15 + hy, 22, 15 + hy, ouro); p.px(16, 1.4 + hy, ouro);
  if (!costas) {
    p.bola(16, 11 + hy, 3.6, 3.2, sombra); p.poli([[12.6, 8.5 + hy], [16, 6.8 + hy], [19.4, 8.5 + hy], [16, 8 + hy]], ouro);
    p.r(13.8, 10.8 + hy, 1.4, 1.2, olho); p.r(17, 10.8 + hy, 1.4, 1.2, olho); p.px(14.2, 10.8 + hy, '#ffffff'); p.px(17.4, 10.8 + hy, '#ffffff');
  }
}
MONSTROS_NOVOS.add('tropa'); MONSTROS_NOVOS.add('mago'); GERADORES_NOVOS.tropa = tropaNova; GERADORES_NOVOS.mago = magoNovo;

// ---------- chaves das fortalezas: uma diferente para cada zona (16×16, usada no chão girando e no inventário) ----------
const ESTILO_CHAVE = {
  'rota-inf': { cor: ['#5a3214', '#c88a40', '#f0c070'], cabeca: 'redonda', dentes: [11, 14] },
  'rota-sup': { cor: ['#2a2e38', '#8a92a4', '#d0d6e0'], cabeca: 'quadrada', dentes: [10, 12, 14] },
  lobos: { cor: ['#5a4a34', '#d8ccb0', '#fff6e0'], cabeca: 'orelhas', dentes: [11, 13] },
  azul: { cor: ['#2a3a5a', '#b0c0d8', '#ffffff'], cabeca: 'redonda', gema: '#4ec8ff', dentes: [12, 14] },
  vermelho: { cor: ['#4a1408', '#d04a20', '#ffb060'], cabeca: 'redonda', gema: '#ff3020', dentes: [10, 13] },
  rio: { cor: ['#103a34', '#3ab8a0', '#a8f8e8'], cabeca: 'gota', dentes: [11, 14] },
  dragao: { cor: ['#5a3008', '#e0a020', '#fff0a0'], cabeca: 'redonda', gema: '#ff8a20', dentes: 'chama' },
  barao: { cor: ['#24103a', '#9050d0', '#e0b8ff'], cabeca: 'olho', gema: '#ff5af0', dentes: [11, 12, 14] },
};
const cacheChaves = new Map();
export function iconeChave(zona) {
  if (cacheChaves.has(zona)) return cacheChaves.get(zona);
  const e = ESTILO_CHAVE[zona] || ESTILO_CHAVE['rota-inf'], [E, B, C] = e.cor;
  const c = tela(16, 16), g = c.getContext('2d'), px = (x, y, w, h, cor) => { g.fillStyle = cor; g.fillRect(x, y, w, h); };
  // haste e dentes
  px(6, 7, 9, 2, B); px(6, 7, 9, 1, C);
  if (e.dentes === 'chama') { for (const [x, h] of [[10, 3], [12, 4], [14, 3]]) { px(x, 9, 1, h, B); px(x, 9 + h - 1, 1, 1, '#ff6020'); } }
  else for (const x of e.dentes) px(x, 9, 1, 3, B);
  // cabeça (argola)
  if (e.cabeca === 'quadrada') { px(1, 4, 6, 7, B); px(1, 4, 6, 1, C); px(3, 6, 2, 3, '#00000000'); g.clearRect(3, 6, 2, 3); }
  else if (e.cabeca === 'gota') { px(2, 5, 5, 6, B); px(3, 3, 3, 2, B); px(4, 2, 1, 1, B); px(3, 4, 1, 2, C); g.clearRect(3, 7, 3, 2); }
  else if (e.cabeca === 'orelhas') { px(1, 5, 6, 6, B); px(1, 3, 2, 2, B); px(5, 3, 2, 2, B); px(1, 5, 6, 1, C); g.clearRect(3, 7, 2, 2); px(2, 7, 1, 1, '#3a2410'); px(5, 7, 1, 1, '#3a2410'); }
  else if (e.cabeca === 'olho') { px(1, 4, 6, 7, B); px(2, 3, 4, 1, B); px(2, 11, 4, 1, B); px(1, 4, 6, 1, C); }
  else { px(1, 4, 6, 7, B); px(2, 3, 4, 1, B); px(2, 11, 4, 1, B); px(1, 4, 2, 1, C); g.clearRect(3, 6, 2, 3); }
  if (e.gema) { px(3, 6, 2, 3, e.gema); px(3, 6, 1, 1, '#ffffff'); }
  if (e.cabeca === 'olho') { px(2, 6, 4, 3, '#1a0820'); px(3, 6, 2, 3, e.gema); px(3, 7, 1, 1, '#ffffff'); }
  contornar(c, [42, 26, 12]);
  cacheChaves.set(zona, c);
  return c;
}

