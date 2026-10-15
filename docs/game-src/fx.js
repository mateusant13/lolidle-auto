// Partículas e luzes da cena: faíscas, poeira, brasas, pedaços de monstro, brilhos que somam luz (modo "lighter").
// Tudo em coordenadas do mundo (pixels), desenhado por cima das criaturas e antes dos nomes.

// troca uma cor "#rrggbb" (com ou sem transparência no fim) pela da skin, se a skin tiver uma substituta
export function mapearCor(mapa, c) {
  if (!mapa || typeof c !== 'string') return c;
  if (c[0] === 'r') {                 // rgba(r,g,b,a) / rgb(r,g,b): troca pela mesma cor em hexadecimal, mantendo a transparência
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([^)]+))?\)$/.exec(c);
    if (!m) return c;
    const nova = mapa['#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('')];
    if (!nova) return c;
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(nova.slice(k, k + 2), 16));
    return m[4] != null ? `rgba(${r},${g},${b},${m[4]})` : `rgb(${r},${g},${b})`;
  }
  if (c[0] !== '#' || c.length < 7) return c;
  const nova = mapa[c.slice(0, 7).toLowerCase()];
  return nova ? nova + c.slice(7) : c;
}

const cacheHalo = new Map();
// halo redondo e macio de uma cor, usado para brilhos aditivos (pré-desenhado: é muito mais rápido que gradiente por partícula)
export function halo(cor) {
  let c = cacheHalo.get(cor);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, cor); gr.addColorStop(0.35, cor + '88'); gr.addColorStop(1, cor + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  cacheHalo.set(cor, c);
  return c;
}

const MAX = 1400;
export class Particulas {
  constructor() { this.lista = []; this.luzes = []; this.mapa = null; this.leve = false; }    // mapa: cores da skin com efeitos próprios; leve: metade das partículas
  limpar() { this.lista.length = 0; this.luzes.length = 0; }

  // p: { x, y, vx, vy, grav, atrito, vida, cor, tam, encolhe, brilho, forma: 'quad' | 'faisca' | 'circ' | 'anel', chao }
  add(p) {
    if (this.leve && Math.random() < 0.5) return;
    if (this.lista.length >= MAX) this.lista.shift();
    if (this.mapa) p.cor = mapearCor(this.mapa, p.cor);
    this.lista.push({ vx: 0, vy: 0, grav: 0, atrito: 0, vida: 0.6, tam: 2, forma: 'quad', t: 0, ...p });
  }
  // rajada em círculo (ou num cone, com ang e abertura)
  explosao(x, y, { qtd = 16, vel = 60, varia = 0.6, ang = null, abertura = Math.PI * 2, achatado = 0.55, ...resto } = {}) {
    for (let i = 0; i < qtd; i++) {
      const a = ang == null ? Math.random() * Math.PI * 2 : ang + (Math.random() - 0.5) * abertura;
      const v = vel * (1 - varia + Math.random() * varia * 2) * 0.5;
      const cor = Array.isArray(resto.cor) ? resto.cor[(Math.random() * resto.cor.length) | 0] : resto.cor;
      this.add({ ...resto, cor, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * achatado, vida: (resto.vida || 0.6) * (0.6 + Math.random() * 0.6) });
    }
  }
  // luz passageira: soma brilho na cena e também clareia a noite
  luz(x, y, r, cor, vida = 0.3, forca = 1) { this.luzes.push({ x, y, r, cor: mapearCor(this.mapa, cor), vida, forca, t: 0 }); }

  atualizar(dt) {
    for (const p of this.lista) {
      p.t += dt;
      if (p.atrito) { const f = Math.max(0, 1 - p.atrito * dt); p.vx *= f; p.vy *= f; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.balanco) p.x += Math.sin(p.t * 2.5 + (p.fase || 0)) * p.balanco * dt;   // folhas e vaga-lumes oscilam
      // quica no "chão" (a altura de onde saiu) e perde força, como pedrinhas
      if (p.chao != null && p.y > p.chao) { p.y = p.chao; p.vy *= -0.35; p.vx *= 0.6; }
    }
    this.lista = this.lista.filter((p) => p.t < p.vida);
    for (const l of this.luzes) l.t += dt;
    this.luzes = this.luzes.filter((l) => l.t < l.vida);
  }

  // modo 'base': partículas comuns (poeira, pedras, sangue), antes da escuridão da noite;
  // modo 'brilho': luzes e partículas que brilham, somando luz por cima de tudo
  desenhar(g, modo) {
    if (modo === 'base') { for (const p of this.lista) if (!p.brilho) this.uma(g, p); g.globalAlpha = 1; return; }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of this.luzes) {
      const k = l.t / l.vida;
      g.globalAlpha = (1 - k) * l.forca * 0.42;
      g.drawImage(halo(l.cor), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    for (const p of this.lista) if (p.brilho) {
      const k = p.t / p.vida, tam = p.tam * (p.encolhe ? 1 - k * 0.7 : 1);
      g.globalAlpha = (1 - k) * 0.32;
      const h = tam * 3.2;
      g.drawImage(halo(p.cor), p.x - h, p.y - h, h * 2, h * 2);
      this.uma(g, p);
    }
    g.restore();
    g.globalAlpha = 1;
  }
  uma(g, p) {
    const k = p.t / p.vida, tam = Math.max(0.5, p.tam * (p.encolhe ? 1 - k * 0.7 : 1));
    g.globalAlpha = p.fixo ? 1 : Math.min(1, (1 - k) * 1.6);
    g.fillStyle = p.brilho && k < 0.3 ? '#ffffff' : p.cor;
    if (p.forma === 'faisca') {          // risco na direção do movimento
      const v = Math.hypot(p.vx, p.vy) || 1, l = Math.min(7, v * 0.05 + 1);
      g.strokeStyle = g.fillStyle; g.lineWidth = tam * 0.7;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / v) * l, p.y - (p.vy / v) * l); g.stroke();
    } else if (p.forma === 'circ') {
      g.beginPath(); g.arc(p.x, p.y, tam / 2 + 0.3, 0, Math.PI * 2); g.fill();
    } else if (p.forma === 'anel') {   // onda que cresce
      g.strokeStyle = p.cor; g.lineWidth = Math.max(0.5, p.tam * (1 - k));
      const r = (p.raio || 30) * (0.15 + k * 0.85);
      g.beginPath(); g.ellipse(p.x, p.y, r, r * (p.achatado ?? 0.42), 0, 0, Math.PI * 2); g.stroke();
    } else if (p.forma === 'estrela') {
      g.fillRect(Math.round(p.x - tam), Math.round(p.y), tam * 2 + 1, 1); g.fillRect(Math.round(p.x), Math.round(p.y - tam), 1, tam * 2 + 1);
    } else {
      g.fillRect(Math.round(p.x - tam / 2), Math.round(p.y - tam / 2), Math.ceil(tam), Math.ceil(tam));
    }
  }
}

// cores opacas de um sprite (para o monstro se desfazer em pedaços da cor dele)
const cachePixels = new WeakMap();
export function pixelsDe(img) {
  let l = cachePixels.get(img);
  if (l) return l;
  const g = img.getContext('2d'), d = g.getImageData(0, 0, img.width, img.height).data;
  l = [];
  for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) {
    const i = (y * img.width + x) * 4;
    if (d[i + 3] > 200) l.push({ x, y, cor: `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` });
  }
  cachePixels.set(img, l);
  return l;
}
