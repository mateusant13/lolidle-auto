// Vilemaw, a aranha do chefe global: a arte é uma imagem só (feita com a IA local e reduzida para o jogo) e a animação
// sai dela, quadro a quadro, na hora em que o jogo carrega:
//   parado (16 quadros, 1,6 s): as patas dos dois lados sobem e descem alternadas, o corpo respira e os olhos pulsam;
//   bote (12 quadros): ela empina, cresce e desce com força (o golpe acerta no quadro BOTE_IMPACTO);
//   rugido (14 quadros): treme inteira, cresce um pouco e os olhos acendem.
// Cada quadro tem margem em volta (MARGEM) para as patas e o empinar não saírem do desenho.
export const MARGEM = 26, BOTE_IMPACTO = 7;
const tela = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// os pixels que brilham (olhos, presas, runas): claros e de cor forte
function mascaraBrilho(img) {
  const c = tela(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, luz = [];
  for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 200) luz.push(p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11);
  luz.sort((a, b) => b - a);
  const corte = luz[Math.floor(luz.length * 0.07)] || 255;      // só os 7% mais claros (olhos, presas, detalhes acesos)
  for (let i = 0; i < p.length; i += 4) {
    const v = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
    if (!(p[i + 3] > 200 && v >= corte)) p[i + 3] = 0;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// desenha a aranha com as patas mexendo: cada coluna sobe ou desce conforme o lado e a distância do meio
// (fase: 0 a 1 do ciclo; amp: quanto as patas sobem; resp: o quanto o corpo estica para cima; ox/oy: deslocamento)
function desenhar(g, img, { fase = 0, amp = 2.2, resp = 0, ox = 0, oy = 0, esc = 1 } = {}) {
  const w = img.width, h = img.height, cx = w / 2, chao = MARGEM + h + oy;
  for (let x = 0; x < w; x++) {
    const d = (x - cx) / cx, lado = d < 0 ? 0 : Math.PI, longe = suave(0.18, 0.95, Math.abs(d));
    // pernas: duas ondas por ciclo, com atraso pela distância (parece cada par de patas mexendo na sua vez)
    const dy = -amp * longe * Math.max(0, Math.sin(fase * Math.PI * 2 * 2 + lado + Math.abs(d) * 2.4));
    const dx = 0.8 * longe * Math.sin(fase * Math.PI * 2 * 2 + lado + 1) * Math.sign(d);
    const hh = h * esc * (1 + resp * (1 - longe * 0.6));
    g.drawImage(img, x, 0, 1, h, Math.round(MARGEM + cx + (x - cx) * esc + dx + ox), Math.round(chao - hh + dy), Math.ceil(esc) + 1, Math.round(hh));
  }
}
function brilhar(g, brilho, img, { forca = 0.4, ox = 0, oy = 0, esc = 1 } = {}) {
  if (forca <= 0) return;
  const w = img.width * esc, h = img.height * esc;
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, forca);
  g.drawImage(brilho, MARGEM + (img.width - w) / 2 + ox, MARGEM + img.height - h + oy, w, h);
  g.restore();
}

export function gerarQuadros(img) {
  const W = img.width + MARGEM * 2, H = img.height + MARGEM * 2, brilho = mascaraBrilho(img);
  const quadro = (f) => { const c = tela(W, H); f(c.getContext('2d')); return c; };
  const parado = Array.from({ length: 16 }, (_, k) => quadro((g) => {
    const t = k / 16;
    desenhar(g, img, { fase: t, resp: 0.018 * Math.sin(t * Math.PI * 2) });
    brilhar(g, brilho, img, { forca: 0.25 + 0.25 * Math.sin(t * Math.PI * 2 * 2) });
  }));
  // bote: prepara (abaixa), empina (sobe e cresce), cai com força no impacto e volta
  const curva = [[0, 0.03, 0.98], [3, 0.04, 0.97], [-4, 0, 1.02], [-9, -0.02, 1.06], [-12, -0.03, 1.08], [-12, -0.03, 1.08], [-6, 0, 1.05], [3, 0.05, 1.02], [2, 0.03, 1], [1, 0.02, 1], [0, 0.01, 1], [0, 0, 1]];
  const bote = curva.map(([oy, resp, esc], k) => quadro((g) => {
    desenhar(g, img, { fase: k / 12, amp: k >= 2 && k <= 5 ? 4.5 : 1.5, resp, oy, esc });
    brilhar(g, brilho, img, { forca: k >= 3 && k <= BOTE_IMPACTO ? 0.9 : 0.35, oy, esc });
    if (k === BOTE_IMPACTO) { g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,60,40,0.12)'; g.fillRect(0, 0, W, H); g.restore(); }
  }));
  // rugido: treme de um lado para o outro, cresce um pouco, os olhos acendem forte
  const rugido = Array.from({ length: 14 }, (_, k) => quadro((g) => {
    const t = k / 14, forte = Math.sin(t * Math.PI), ox = (k % 2 ? 1.5 : -1.5) * forte, esc = 1 + 0.05 * forte;
    desenhar(g, img, { fase: t * 2, amp: 3, resp: 0.03 * forte, ox, esc });
    brilhar(g, brilho, img, { forca: 0.4 + 0.8 * forte, ox, esc });
  }));
  return { parado, bote, rugido, largura: W, altura: H };
}

