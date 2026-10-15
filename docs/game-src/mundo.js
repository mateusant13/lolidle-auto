// Mapa em tiles de cada zona: chão com bordas recortadas, objetos e caminhos (como um mapa de OT).
import { T, PISOS, piso, objeto, tela, rng, tom } from './pixel.js';
import { mundoLogico, chegadaCidade, CIDADES, cidadeEm, zonaEm } from './runeterra.js';
import { estiloNovoLigado, pintarChao, criarPintorChao, objetoNovo, sombraNoChao, luzNoChao } from './arte-nova.js';

export const LARG = 48, ALT = 36;

const BIOMAS = {
  rota: { base: 'grama', objetos: [['flores', 0.05], ['arbusto', 0.03], ['arvore', 0.025], ['rocha', 0.015], ['ruina', 0.008]] },
  selva: { base: 'gramaE', objetos: [['arvoreE', 0.13], ['arbusto', 0.05], ['cogumelo', 0.03], ['rocha', 0.02], ['flores', 0.02]] },
  rio: { base: 'grama', objetos: [['arvore', 0.03], ['arbusto', 0.025], ['rocha', 0.02], ['flores', 0.03]], naAreia: [['junco', 0.12], ['rocha', 0.03]] },
  barao: { base: 'vazio', objetos: [['cristal', 0.04], ['rochaV', 0.04], ['ossos', 0.05]] },
  base: { base: 'grama', objetos: [['flores', 0.06], ['arvore', 0.05], ['arbusto', 0.03]] },
  // Runeterra: chão de terra batida, aberto, com poucas pedras para desviar
  arena: { base: 'grama', objetos: [['flores', 0.03], ['rocha', 0.012], ['arbusto', 0.008]] },
};
const CX = LARG >> 1, CY = ALT >> 1;
// a Fonte: praça circular de pedra azul, com o poço no meio e os NPCs em volta
export const NPCS_FONTE = [{ nome: 'Soraka', x: CX - 3, y: CY + 1 }, { nome: 'Lojista', x: CX + 3, y: CY + 1 }, { nome: 'Mestre da Legião', x: CX - 5, y: CY + 4 },
  { nome: 'Capitão da Legião', x: CX + 5, y: CY + 4 }, { nome: 'Ornn', x: CX, y: CY + 6 }, { nome: 'Tesoureira de Piltover', x: CX - 1, y: CY - 5 }, { nome: 'Burrinho de Carga', x: CX + 1, y: CY - 5 },
  { nome: 'Mercador', x: CX - 4, y: CY - 2 }];

// ruído suave (value noise) para manchas de terreno
function ruido(r, escala) {
  const g = [];
  for (let y = 0; y <= ALT / escala + 1; y++) { g.push([]); for (let x = 0; x <= LARG / escala + 1; x++) g[y].push(r()); }
  const suave = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / escala, gy = y / escala, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = suave(gx - x0), fy = suave(gy - y0);
    const a = g[y0][x0] + (g[y0][x0 + 1] - g[y0][x0]) * fx, b = g[y0 + 1][x0] + (g[y0 + 1][x0 + 1] - g[y0 + 1][x0]) * fx;
    return a + (b - a) * fy;
  };
}

function gerarChao(bioma, r) {
  const n1 = ruido(r, 6), n2 = ruido(r, 4);
  const chao = [];
  for (let y = 0; y < ALT; y++) {
    const linha = [];
    for (let x = 0; x < LARG; x++) {
      let t = BIOMAS[bioma].base;
      if (bioma === 'base') {
        const d = Math.hypot(x - CX, (y - CY) * 1.15);
        if (Math.abs(x - CX) <= 1 && Math.abs(y - CY + 1) <= 1) t = 'agua';
        else if (d < 7.5) t = 'fonte';
        else if (d < 8.6) t = 'pedra';
        else if (Math.abs(x - CX) <= 1 && y > CY) t = 'terra';
      } else if (bioma === 'rota') {
        // a rota: uma faixa de terra na diagonal do mapa
        const d = Math.abs(x * ALT / LARG + y - ALT) / 1.4 + (n2(x, y) - 0.5) * 2;
        if (d < 2) t = 'terra';
        else if (n1(x, y) > 0.8) t = 'pedra';
      } else if (bioma === 'arena') {
        const d = Math.hypot((x - CX) / 1.25, y - CY) + (n2(x, y) - 0.5) * 3;
        if (d < 12) t = n1(x, y) > 0.78 ? 'pedra' : 'terra';
      } else if (bioma === 'selva') {
        if (n1(x, y) > 0.64) t = 'terra';
      } else if (bioma === 'rio') {
        const v = y - (ALT / 2 + 5 + Math.sin(x / 6) * 3 + (n1(x, y) - 0.5) * 4);
        if (Math.abs(v) < 2.3) t = 'agua';
        else if (Math.abs(v) < 3.6 || n2(x, y) > 0.8) t = 'areia';
      } else {
        if (n1(x, y) > 0.6) t = 'lama';
        else if (n2(x, y) > 0.78) t = 'pedra';
      }
      linha.push(t);
    }
    chao.push(linha);
  }
  return chao;
}

// desenha a borda recortada do piso vizinho (de prioridade maior) invadindo este tile
function borda(g, X, Y, textura, cor, lado, r) {
  const fase = r() * 10, sombra = tom(cor, 0.55);
  for (let i = 0; i < T; i++) {
    const d = Math.max(1, Math.min(7, Math.round(3.5 + 2 * Math.sin(i * 0.45 + fase) + r() * 1.4)));
    if (lado === 'N') { g.drawImage(textura, i, 0, 1, d, X + i, Y, 1, d); g.fillStyle = sombra; g.fillRect(X + i, Y + d, 1, 1); }
    if (lado === 'S') { g.drawImage(textura, i, T - d, 1, d, X + i, Y + T - d, 1, d); g.fillStyle = sombra; g.fillRect(X + i, Y + T - d - 1, 1, 1); }
    if (lado === 'O') { g.drawImage(textura, 0, i, d, 1, X, Y + i, d, 1); g.fillStyle = sombra; g.fillRect(X + d, Y + i, 1, 1); }
    if (lado === 'L') { g.drawImage(textura, T - d, i, d, 1, X + T - d, Y + i, d, 1); g.fillStyle = sombra; g.fillRect(X + T - d - 1, Y + i, 1, 1); }
  }
}

export function gerarMapa(nomeBioma, semente = 1) {
  const r = rng(1000 + nomeBioma.length * 7919 + semente * 104729);
  const chao = gerarChao(nomeBioma, r);
  const obj = chao.map((l) => l.map(() => null));
  const cx = CX, cy = CY;
  const bioma = BIOMAS[nomeBioma];
  const ehBase = nomeBioma === 'base';
  // estilo de arte novo (em teste): todos os mapas do Rift, só com o teste ligado neste navegador
  const novo = estiloNovoLigado() && !!NOVO[nomeBioma];
  const cfg = NOVO[nomeBioma];
  if (novo && nomeBioma === 'rota') for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) if (chao[y][x] === 'pedra') { chao[y][x] = 'grama'; if (r() < 0.35 && x > 1 && y > 1 && x < LARG - 2 && y < ALT - 2) obj[y][x] = objetoNovo('pedrasN', (x + y) % 4); }
  if (novo && nomeBioma !== 'rota' && !ehBase) for (const l of chao) for (let x = 0; x < l.length; x++) if (l[x] === 'pedra') l[x] = nomeBioma === 'barao' ? 'lama' : 'cascalho';
  if (novo) antesDosObjetos(nomeBioma, semente, chao);
  for (let y = 1; y < ALT - 1; y++) for (let x = 1; x < LARG - 1; x++) {
    if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) continue;
    const t = chao[y][x];
    if (t === 'agua' || t === 'ponte' || t === 'fonte' || t === 'pedra' && ehBase || ((nomeBioma === 'rota' || nomeBioma === 'arena') && t === 'terra') || (ehBase && t === 'terra')) continue;
    if (novo) {
      if (obj[y][x]) continue;
      // árvores (ou rochas, no Barão) puxam outras para perto: formam bosques em vez de ficarem soltas
      const vizinhaArvore = t !== 'areia' && [obj[y - 1]?.[x], obj[y]?.[x - 1], obj[y - 1]?.[x - 1]].some((o) => o?.sombra && o.sombra[2] >= 14);
      if (vizinhaArvore && r() < cfg.bosque) { obj[y][x] = objetoNovo(cfg.borda[r() < 0.75 ? 0 : cfg.borda.length - 1], (r() * 4) | 0); continue; }
      const lista = t === 'areia' && cfg.naAreia ? cfg.naAreia : cfg.objetos;
      for (const [tipo, chance, vs] of lista) if (r() < chance) { obj[y][x] = objetoNovo(tipo, vs ? vs[(r() * vs.length) | 0] : (r() * 4) | 0); break; }
      continue;
    }
    const lista = t === 'areia' && bioma.naAreia ? bioma.naAreia : bioma.objetos;
    for (const [tipo, chance] of lista) if (r() < chance) { obj[y][x] = objeto(tipo, (r() * 4) | 0); break; }
  }
  // a moldura do mapa é mata fechada, para ninguém sair andando pela borda
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++)
    if ((x < 1 || y < 1 || x >= LARG - 1 || y >= ALT - 1) && chao[y][x] !== 'agua')
      obj[y][x] = novo ? objetoNovo(cfg.borda[(x * 7 + y * 3) % 5 ? 0 : cfg.borda.length - 1], (x + y) % 4) : objeto(nomeBioma === 'barao' ? 'rochaV' : nomeBioma === 'selva' ? 'arvoreE' : 'arvore', (x + y) % 4);
  if (novo) depoisDosObjetos(nomeBioma, semente, chao, obj, r);
  if (ehBase) {
    // pilares de cristal em volta da praça e as caixas do Lojista
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
      obj[Math.round(cy + Math.sin(ang) * 6.2)][Math.round(cx + Math.cos(ang) * 7)] = novo ? objetoNovo('pilarCristal') : objeto('pilar');
    }
    obj[cy][cx + 4] = objeto('caixote', 0); obj[cy + 1][cx + 5] = objeto('caixote', 1); obj[cy][cx + 5] = objeto('barril');
    // a praça: cristal no chafariz, estandartes, banca do Lojista, forja do Ornn, armas da Legião e luzes no caminho
    const por = (x, y, o) => { if (!obj[y][x]) obj[y][x] = o; };
    obj[cy - 1][cx] = novo ? objetoNovo('cristalFonte') : objeto('cristal-fonte');
    por(cx - 4, cy - 4, novo ? objetoNovo('bandeiraN', 0) : objeto('bandeira')); por(cx + 4, cy - 4, novo ? objetoNovo('bandeiraN', 0) : objeto('bandeira'));
    por(cx + 5, cy - 1, objeto('tenda'));
    // acima da fonte: o cofre de ferro e o barril da Tesoureira de Piltover; do lado do burrinho, os caixotes da carga
    por(cx - 2, cy - 5, objeto('cofre')); por(cx - 2, cy - 6, objeto('barril'));
    por(cx + 2, cy - 5, objeto('caixote', 0)); por(cx + 2, cy - 6, objeto('caixote', 1));
    // a barraca do Mercador (mercado dos jogadores), no alto à esquerda da praça
    por(cx - 5, cy - 3, objeto('barraca')); por(cx - 6, cy - 3, objeto('caixote', 1));
    por(cx - 3, cy + 6, objeto('forja'));
    por(cx - 6, cy + 5, objeto('arsenal')); por(cx + 6, cy + 5, objeto('arsenal', 1));
    por(cx - 2, cy + 9, novo ? objetoNovo('tocha') : objeto('braseiro')); por(cx + 2, cy + 9, novo ? objetoNovo('tocha') : objeto('braseiro'));
    for (const y of [12, 15]) { por(cx - 2, cy + y, novo ? objetoNovo('lampiaoN') : objeto('lampiao')); por(cx + 2, cy + y, novo ? objetoNovo('lampiaoN') : objeto('lampiao')); }
    for (const [x, y] of [[cx - 4, cy], [cx - 4, cy + 2], [cx - 2, cy + 2]]) if (!obj[y][x]) obj[y][x] = objeto('estrelas', x + y);
  }

  const bloq = chao.map((l, y) => l.map((t, x) => !!(PISOS[t].bloqueia || obj[y][x]?.bloqueia)));

  // pré-renderiza o chão inteiro uma vez
  // a praça da Fonte é um círculo de verdade (as mesmas contas de gerarChao, mas por pixel): sem escadinha na borda
  const praca = ehBase ? (px, py) => {
    const t = chao[(py / T) | 0][(px / T) | 0]; if (t === 'agua' || t === 'terra') return null;
    const u = px / T - 0.5, v = py / T - 0.5, d = Math.hypot(u - cx, (v - cy) * 1.15);
    return d < 7.5 ? 'fonte' : d < 8.6 ? 'pedra' : t === 'pedra' || t === 'fonte' ? 'grama' : null;
  } : null;
  const img = novo ? pintarChao(chao, semente, praca) : tela(LARG * T, ALT * T), g = img.getContext('2d');
  const agua = [];
  if (novo) {
    // sombras dos objetos e a luz das tochas vão pintadas no chão
    for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) {
      const o = obj[y][x]; if (!o?.sombra) continue;
      const [sx, sy, rx, ry] = o.sombra;
      sombraNoChao(g, x * T + sx, y * T + sy, rx, ry);      // (sx, sy) = onde fica o pé do objeto dentro do tile
      if (o.luz) luzNoChao(g, x * T + 16, y * T + 8, 70, typeof o.luz === 'string' ? o.luz : undefined);
    }
    for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) if (chao[y][x] === 'agua') agua.push([x, y]);
  }
  if (!novo) {
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) {
    g.drawImage(piso(chao[y][x], (x * 7 + y * 13) % 4), x * T, y * T);
    if (chao[y][x] === 'agua') agua.push([x, y]);
  }
  const rb = rng(55 + semente * 7 + nomeBioma.length);
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) {
    const a = PISOS[chao[y][x]];
    for (const [dx, dy, lado] of [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'O'], [1, 0, 'L']]) {
      const t = chao[y + dy]?.[x + dx];
      if (t && PISOS[t].prio > a.prio) borda(g, x * T, y * T, piso(t, 0), PISOS[t].cor, lado, rb);
    }
  }
  }
  if (ehBase) {
    // borda redonda de pedra em volta do chafariz e o círculo de runas da plataforma
    const ox = (cx + 0.5) * T, oy = (cy - 0.5) * T;
    g.save();
    g.strokeStyle = '#3a4258'; g.lineWidth = 0.62 * T; g.beginPath(); g.arc(ox, oy, 1.93 * T, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#6a7690'; g.lineWidth = 3; g.beginPath(); g.arc(ox, oy, 1.66 * T, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#c9a050'; g.lineWidth = 1; g.beginPath(); g.arc(ox, oy, 2.2 * T, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(110,220,255,0.45)'; g.lineWidth = 2;
    for (const raio of [4.05, 4.65]) { g.beginPath(); g.arc(ox, oy, raio * T, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(150,235,255,0.6)';
    for (let k = 0; k < 36; k++) {           // runas: tracinhos e pontos entre os dois anéis
      const a = (k / 36) * Math.PI * 2, rr = 4.35 * T, x = ox + Math.cos(a) * rr, y = oy + Math.sin(a) * rr;
      if (k % 3 === 0) g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      else g.fillRect(Math.round(x - Math.sin(a) * 3), Math.round(y + Math.cos(a) * 3), 2, 2);
    }
    g.restore();
  }
  // decoração rasteira vai direto no chão
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++)
    if (obj[y][x]?.chao) { g.drawImage(obj[y][x].img, x * T, y * T); obj[y][x] = null; }

  const livre = (x, y) => x >= 0 && y >= 0 && x < LARG && y < ALT && !bloq[y][x];
  if (ehBase) for (const n of NPCS_FONTE) bloq[n.y][n.x] = true;
  return { bioma: nomeBioma, larg: LARG, alt: ALT, chao, obj, bloq, img, agua: ehBase && !novo ? [] : agua, livre, npcs: ehBase ? NPCS_FONTE : [], centro: pontoLivre(livre, cx, ehBase ? cy + 3 : cy), novo };
}

// ---------- estilo novo (em teste): o que cada mapa do Rift ganha ----------
// objetos: [tipo, chance por tile, variantes?]; borda: árvores (ou rochas) da moldura e dos bosques; bosque: chance de juntar
const NOVO = {
  rota: { bosque: 0.32, borda: ['pinheiro', 'arvoreRedonda'],
    objetos: [['pinheiro', 0.05], ['arvoreRedonda', 0.02], ['arbustoN', 0.03], ['pedrasN', 0.016], ['tocha', 0.005], ['capimAlto', 0.035], ['canteiro', 0.025], ['cogumelos', 0.008], ['toco', 0.006], ['tronco', 0.004]] },
  selva: { bosque: 0.4, borda: ['arvoreSelva', 'arvoreSelva'],
    objetos: [['arvoreSelva', 0.07], ['samambaia', 0.06], ['arbustoN', 0.025], ['pedrasN', 0.014], ['cogumelos', 0.025], ['capimAlto', 0.025], ['toco', 0.006], ['tronco', 0.006], ['espinheiro', 0.005]] },
  rio: { bosque: 0.3, borda: ['arvoreRedonda', 'pinheiro'],
    objetos: [['arvoreRedonda', 0.025], ['pinheiro', 0.014], ['arbustoN', 0.02], ['canteiro', 0.035], ['capimAlto', 0.03], ['pedrasN', 0.01], ['toco', 0.004], ['cogumelos', 0.006]],
    naAreia: [['juncoN', 0.12], ['pedrasN', 0.02], ['tronco', 0.008], ['ossosN', 0.006]] },
  barao: { bosque: 0.25, borda: ['rochaVN', 'cristalV'],
    objetos: [['cristalV', 0.03], ['rochaVN', 0.035], ['ossosN', 0.04], ['pocaVazio', 0.014], ['ruinaPilar', 0.006, [1, 3]]] },
  base: { bosque: 0.3, borda: ['pinheiro', 'arvoreRedonda'],
    objetos: [['canteiro', 0.06], ['arvoreRedonda', 0.03], ['pinheiro', 0.03], ['arbustoN', 0.03], ['capimAlto', 0.02]] },
};
const VAZIO = { img: Object.assign(typeof document !== 'undefined' ? document.createElement('canvas') : {}, { width: 1, height: 1 }), bloqueia: true, ox: 0, oy: 0 };
const noMeio = (x, y) => Math.abs(x - CX) <= 3 && Math.abs(y - CY) <= 3;

// riacho: meio(y) dá a coluna do centro em cada linha; termina num lago (cx, cy, rx, ry); onde cruza a trilha vira ponte
function riacho(chao, meio, y0, y1, lago) {
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) {
    const noRio = y >= y0 && y <= y1 && Math.abs(x - meio(y)) < 1.05;
    const noLago = lago && ((x - lago[0]) / lago[2]) ** 2 + ((y - lago[1]) / lago[3]) ** 2 < 1;
    if (!noRio && !noLago) continue;
    chao[y][x] = chao[y][x] === 'terra' ? 'ponte' : 'agua';
  }
  // a ponte é um retângulo: a água que ficar dentro dele também vira ponte
  let x0 = 1e9, ya = 1e9, x1 = -1, yb = -1;
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) if (chao[y][x] === 'ponte') { x0 = Math.min(x0, x); ya = Math.min(ya, y); x1 = Math.max(x1, x); yb = Math.max(yb, y); }
  for (let y = ya; y <= yb; y++) for (let x = x0; x <= x1; x++) if (chao[y][x] === 'agua') chao[y][x] = 'ponte';
}
function lago(chao, cx, cy, rx, ry) {
  for (let y = 1; y < ALT - 1; y++) for (let x = 1; x < LARG - 1; x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 && !noMeio(x, y)) chao[y][x] = 'agua';
}

// mexe no chão antes de espalhar os objetos (água, pontes)
function antesDosObjetos(bioma, sem, chao) {
  if (bioma === 'rota' && sem === 1) riacho(chao, (y) => 20 + y * 0.6 + Math.sin(y / 3.2) * 1.8, 0, 23, [34.5, 24.5, 3.6, 2.4]);
  if (bioma === 'rota' && sem === 2) riacho(chao, (y) => 31.5 - y * 0.5 + Math.sin(y / 3) * 1.6, 12, ALT - 1, [25.5, 9.5, 3.6, 2.4]);
  if (bioma === 'selva' && sem === 1) lago(chao, CX - 12, CY + 8, 2.6, 1.9);
  if (bioma === 'selva' && sem === 2) lago(chao, CX + 9, CY - 7, 3.4, 2.3);
  if (bioma === 'rio') {
    // uma ponte atravessando o rio de margem a margem
    const px = sem === 1 ? CX - 10 : CX + 11;
    for (let y = 0; y < ALT; y++) for (const x of [px, px + 1]) if (chao[y][x] === 'agua') chao[y][x] = 'ponte';
  }
}

// cada objeto ocupa w×h tiles com a imagem no tile de baixo à esquerda (x, y)
function cabe(chao, obj, x, y, w, h) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const a = x + dx, b = y - dy;
    if (a < 1 || b < 1 || a >= LARG - 1 || b >= ALT - 1 || noMeio(a, b) || obj[b][a]) return false;
    const t = chao[b][a]; if (t === 'agua' || t === 'ponte' || t === 'fonte') return false;
  }
  return true;
}
function por(chao, obj, x, y, tipo, v = 0) {
  const o = objetoNovo(tipo, v), [w, h] = o.area || [1, 1];
  if (!cabe(chao, obj, x, y, w, h)) return false;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) obj[y - dy][x + dx] = dx || dy ? VAZIO : o;
  return true;
}
// tira os objetos soltos de uma área (para abrir espaço a uma construção)
function limpar(chao, obj, x0, y0, x1, y1) {
  for (let y = Math.max(1, y0); y <= Math.min(ALT - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(LARG - 2, x1); x++) obj[y][x] = null;
}
// tenta pôr perto de (x, y), espiralando até achar lugar
function porPerto(chao, obj, x, y, tipo, v = 0, raio = 4) {
  for (let r = 0; r <= raio; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if ((Math.abs(dx) === r || Math.abs(dy) === r) && por(chao, obj, x + dx, y + dy, tipo, v)) return [x + dx, y + dy];
  return null;
}
// decoração pintada na água (vitória-régia, barco)
function naAgua(chao, obj, x, y, tipo, v = 0) { if (chao[y]?.[x] === 'agua' && !obj[y][x]) obj[y][x] = objetoNovo(tipo, v); }

// garante que todo chão livre dá para alcançar a partir do meio do mapa: onde ficou um bolsão fechado por árvores,
// tira o mínimo de objetos soltos (árvores, moitas, pedras) no caminho; casas, água e a moldura ficam
function abrirPassagens(chao, obj) {
  const anda = (x, y) => !PISOS[chao[y][x]].bloqueia && !obj[y][x]?.bloqueia;
  const tiravel = (x, y) => x > 0 && y > 0 && x < LARG - 1 && y < ALT - 1 && !PISOS[chao[y][x]].bloqueia && obj[y][x] && obj[y][x] !== VAZIO && !obj[y][x].area;
  const custo = new Float64Array(LARG * ALT).fill(Infinity), veio = new Int32Array(LARG * ALT).fill(-1);
  const ini = CY * LARG + CX; custo[ini] = 0;
  const fila = [ini];                                   // 0-1 BFS: passar por chão livre custa 0, por um objeto tirável custa 1
  while (fila.length) {
    const i = fila.shift(), x = i % LARG, y = (i / LARG) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= LARG || b >= ALT) continue;
      const j = b * LARG + a, c = anda(a, b) ? 0 : tiravel(a, b) ? 1 : Infinity;
      if (custo[i] + c < custo[j]) { custo[j] = custo[i] + c; veio[j] = i; if (c === 0) fila.unshift(j); else fila.push(j); }
    }
  }
  for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) {
    if (!anda(x, y) || !(custo[y * LARG + x] > 0) || custo[y * LARG + x] === Infinity) continue;
    for (let j = y * LARG + x; j >= 0 && j !== ini; j = veio[j]) { const a = j % LARG, b = (j / LARG) | 0; if (!anda(a, b)) obj[b][a] = null; }
  }
}

function depoisDosObjetos(bioma, sem, chao, obj, r) {
  depoisDosObjetos2(bioma, sem, chao, obj, r);
  abrirPassagens(chao, obj);
}
// roda d'água: no primeiro tile de grama com água logo à direita, entre as linhas y0 e y1
function rodaDagua(chao, obj, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = 2; x < LARG - 3; x++)
    if (chao[y][x] === 'grama' && chao[y][x + 1] === 'agua' && chao[y - 1][x] === 'grama' && !noMeio(x, y)) { obj[y][x] = objetoNovo('rodaDagua'); return; }
}
function depoisDosObjetos2(bioma, sem, chao, obj, r) {
  if (bioma === 'rota') rodaDagua(chao, obj, sem === 1 ? 5 : 26, sem === 1 ? 14 : 33);
  if (bioma === 'rota' && sem === 1) { vilarejo(chao, obj); centroDaRota(chao, obj, r); }
  if (bioma === 'rota' && sem === 2) { acampamento(chao, obj); centroDaRota(chao, obj, r, 1); }
  if (bioma !== 'rota' && bioma !== 'base') enfeitarCentro(bioma, sem, chao, obj, r);
  if (bioma === 'selva') {
    if (sem === 1) {                    // Toca dos Lobos: caverna na rocha, ossos espalhados
      limpar(chao, obj, CX + 5, CY - 10, CX + 12, CY - 4);
      const c = porPerto(chao, obj, CX + 7, CY - 5, 'caverna');
      if (c) for (const [dx, dy, v] of [[-1, 1, 1], [3, 1, 0], [1, 2, 0], [-2, -1, 1]]) porPerto(chao, obj, c[0] + dx, c[1] + dy, 'ossosN', v, 1);
    }
    if (sem === 2 || sem === 3) {       // Campo Azul / Vermelho: altar com cristal no meio de um círculo
      const ax = CX, ay = sem === 2 ? CY - 6 : CY + 7;
      limpar(chao, obj, ax - 4, ay - 4, ax + 4, ay + 4);
      por(chao, obj, ax, ay, 'altar', sem === 2 ? 0 : 1);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        porPerto(chao, obj, Math.round(ax + Math.cos(a) * 3.4), Math.round(ay + Math.sin(a) * 2.6), sem === 2 ? 'pilarFogo' : 'espinheiro', sem === 2 ? 0 : k, 1);
      }
      if (sem === 3) { porPerto(chao, obj, ax - 2, ay, 'pilarFogo', 1, 1); porPerto(chao, obj, ax + 2, ay, 'pilarFogo', 1, 1); }
      if (sem === 3) porPerto(chao, obj, ax + 4, ay + 2, 'fogueira', 0, 2);
    }
  }
  // vitórias-régias em toda água (rio, lagos, riachos)
  if (bioma !== 'barao' && bioma !== 'base') for (let y = 1; y < ALT - 1; y++) for (let x = 1; x < LARG - 1; x++) if (r() < 0.05) naAgua(chao, obj, x, y, 'nenufar', (r() * 4) | 0);
  if (bioma === 'rio') {
    if (sem === 1) {                    // cais de madeira com um barco e a casa do pescador
      const dx0 = CX + 7;
      let y0 = -1; for (let y = 1; y < ALT - 1; y++) if (chao[y][dx0] === 'agua') { y0 = y; break; }
      if (y0 > 0) {
        for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (chao[y0 + b]?.[dx0 + a] === 'agua') { chao[y0 + b][dx0 + a] = 'ponte'; obj[y0 + b][dx0 + a] = null; }
        naAgua(chao, obj, dx0 + 2, y0 + 1, 'barco');
        limpar(chao, obj, dx0 - 4, y0 - 6, dx0 + 4, y0 - 1);
        porPerto(chao, obj, dx0 - 2, y0 - 2, 'casa', 0, 3);
        for (const [t, a, b] of [['barril', 2, -1], ['caixote', 3, -1], ['barril', 3, -2], ['tocha', -1, -1]]) porPerto(chao, obj, dx0 + a, y0 + b, t, 0, 2);
      }
    }
    if (sem === 2) {                    // Fosso do Dragão: crânio gigante, ossada, braseiros e ruínas
      limpar(chao, obj, CX + 3, CY - 9, CX + 10, CY - 4);
      const c = porPerto(chao, obj, CX + 5, CY - 5, 'cranio');
      if (c) for (const [a, b] of [[-1, 0], [3, 0]]) porPerto(chao, obj, c[0] + a, c[1] + b, 'tocha', 0, 1);
      for (let k = 0; k < 14; k++) porPerto(chao, obj, 2 + ((r() * (LARG - 4)) | 0), 2 + ((r() * (ALT - 4)) | 0), 'ossosN', k % 2, 1);
      for (let k = 0; k < 5; k++) porPerto(chao, obj, 3 + ((r() * (LARG - 6)) | 0), 3 + ((r() * (ALT - 6)) | 0), 'ruinaPilar', 0, 2);
    }
  }
  if (bioma === 'barao') {              // pilares do vazio em volta do covil, cristais e poças
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      porPerto(chao, obj, Math.round(CX + Math.cos(a) * 7), Math.round(CY + Math.sin(a) * 5), 'ruinaPilar', 1 + (k % 2) * 2, 1);
    }
    for (let k = 0; k < 8; k++) porPerto(chao, obj, 3 + ((r() * (LARG - 6)) | 0), 3 + ((r() * (ALT - 6)) | 0), 'cristalV', k, 2);
  }
  if (bioma === 'base') {               // bancos e canteiros no caminho da Fonte
    for (const y of [11, 14]) { porPerto(chao, obj, CX - 3, CY + y, 'banco', 0, 1); porPerto(chao, obj, CX + 3, CY + y, 'banco', 0, 1); }
    for (let k = 0; k < 10; k++) porPerto(chao, obj, CX + ((r() - 0.5) * 24 | 0), CY + ((r() - 0.5) * 22 | 0), 'canteiro', k, 2);
  }
}

// um vilarejo no canto de cima à esquerda: duas casas, poço, cerca, carroça, barris, feno e canteiros
function vilarejo(chao, obj) {
  limpar(chao, obj, 2, 3, 17, 15);
  // caminho de terra saindo das portas, passando pelo poço e descendo até a trilha
  const caminho = [[5, 8], [5, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [8, 11]];
  for (let y = 11; y < ALT - 1 && chao[y][8] !== 'terra'; y++) caminho.push([8 + Math.round(Math.sin(y / 3) * 0.6), y]);
  for (const [x, y] of caminho) { chao[y][x] = 'terra'; obj[y][x] = null; }
  por(chao, obj, 4, 7, 'casa', 0); por(chao, obj, 10, 9, 'casa', 1);
  por(chao, obj, 9, 12, 'poco');
  por(chao, obj, 3, 8, 'barril'); por(chao, obj, 7, 6, 'barril', 1); por(chao, obj, 13, 10, 'caixote'); por(chao, obj, 14, 10, 'barril');
  por(chao, obj, 3, 11, 'feno'); por(chao, obj, 4, 11, 'feno');
  por(chao, obj, 12, 13, 'carroca');
  for (const x of [2, 3, 4, 5]) por(chao, obj, x, 14, 'cerca');
  for (const [x, y, v] of [[6, 8, 0], [4, 8, 2], [12, 11, 1], [10, 11, 3], [7, 11, 0]]) por(chao, obj, x, y, 'canteiro', v);
  por(chao, obj, 9, 9, 'tocha');
  por(chao, obj, 6, 12, 'banco');
}
// Rota Inferior: o meio do mapa (onde a câmera fica) ganha a torre da rota em ruínas na beira da estrada, bandeiras azuis,
// lampiões, uma placa, um acampamento com fogueira e bancos, pedrinhas na estrada e flores nas bordas
function centroDaRota(chao, obj, r, lado = 0) {
  const grama = (x, y, tira = false) => chao[y]?.[x] === 'grama' && (!obj[y][x] || (tira && obj[y][x] !== VAZIO && !obj[y][x].area));
  const estrada = (x, y, d) => { for (let b = -d; b <= d; b++) for (let a = -d; a <= d; a++) if (chao[y + b]?.[x + a] === 'terra') return true; return false; };
  const lugar = (x0, y0, w, d, longe = 1, tira = false) => {
    for (let raio = 0; raio < 8; raio++) for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
      const x = x0 + dx, y = y0 + dy; let ok = !noMeio(x, y);
      for (let k = 0; k < w && ok; k++) ok = !noMeio(x + k, y) && grama(x + k, y, tira) && estrada(x + k, y, d) && !estrada(x + k, y, longe - 1);
      if (ok) return [x, y];
    }
    return null;
  };
  // pedrinhas na estrada e flores nas bordas, perto do meio
  for (let y = CY - 9; y <= CY + 9; y++) for (let x = CX - 15; x <= CX + 15; x++) {
    if (y < 1 || x < 1 || y >= ALT - 1 || x >= LARG - 1 || noMeio(x, y) || obj[y][x]) continue;
    if (chao[y][x] === 'terra' && r() < 0.09) por(chao, obj, x, y, 'seixos', (r() * 4) | 0);
    else if (chao[y][x] === 'grama' && estrada(x, y, 1) && r() < 0.16) por(chao, obj, x, y, 'canteiro', (r() * 4) | 0);
  }
  // a torre da rota, em cima da estrada, com entulho e uma bandeira do lado
  const t = [[CX - 6, CY - 4], [CX + 5, CY - 4], [CX - 6, CY + 3], [CX + 5, CY + 3], [CX - 6, CY - 4, 3]].map(([x, y, d = 2]) => lugar(x, y, 2, d, 2, true)).find(Boolean);
  if (t) {
    for (let y = t[1] - 3; y <= t[1]; y++) for (let x = t[0] - 1; x <= t[0] + 2; x++) if (obj[y]?.[x] && !obj[y][x].area) obj[y][x] = null;
    por(chao, obj, t[0], t[1], 'torreRota', lado);
    porPerto(chao, obj, t[0] + 3, t[1], 'bandeiraN', lado ? 2 : 0, 2); porPerto(chao, obj, t[0] - 1, t[1] + 1, 'pedrasN', 1, 1);
  }
  // do outro lado da estrada: a placa, uma bandeira e os lampiões
  const p = lugar(CX + 3, CY + 3, 1, 1); if (p) por(chao, obj, p[0], p[1], 'placaN');
  const b = lugar(CX - 3, CY + 4, 1, 1); if (b) por(chao, obj, b[0], b[1], 'bandeiraN', lado ? 2 : 0);
  for (const [x, y] of [[CX + 5, CY - 3], [CX - 9, CY + 2], [CX + 9, CY + 1]]) { const l = lugar(x, y, 1, 1); if (l) por(chao, obj, l[0], l[1], 'lampiaoN'); }
  // o acampamento das tropas: fogueira, bancos, barris e caixotes
  const f = lugar(CX + 6, CY + 5, 1, 3, 2);
  if (f) {
    por(chao, obj, f[0], f[1], 'fogueira');
    for (const [dx, dy, tipo] of [[-1, 1, 'banco'], [1, 1, 'banco'], [2, -1, 'barril'], [-2, -1, 'caixote'], [2, 0, 'caixote']]) porPerto(chao, obj, f[0] + dx, f[1] + dy, tipo, 0, 1);
  }
}
// o meio dos outros mapas do Rift (onde a câmera fica), cada um com o seu tema: Toca dos Lobos com ossos, troncos e
// cogumelos que brilham; Campo Azul e Vermelho com pedras de runa da cor do campo; Rio com runas roxas do Arauto e
// troncos na margem; Fosso do Dragão com chão queimado, pilares de fogo e ossos; Covil do Barão com as veias do Vazio
function enfeitarCentro(bioma, sem, chao, obj, r) {
  const pisa = (x, y) => { const t = chao[y]?.[x]; return t && t !== 'agua' && t !== 'ponte' && t !== 'fonte' && !obj[y][x] && !noMeio(x, y); };
  const espalhar = (lista, raioX = 14, raioY = 9) => {
    for (let y = CY - raioY; y <= CY + raioY; y++) for (let x = CX - raioX; x <= CX + raioX; x++) {
      if (y < 1 || x < 1 || y >= ALT - 1 || x >= LARG - 1 || !pisa(x, y)) continue;
      for (const [tipo, p, nv, onde] of lista) if ((!onde || onde.includes(chao[y][x])) && r() < p) { por(chao, obj, x, y, tipo, (r() * (nv || 1)) | 0); break; }
    }
  };
  // um anel de pedras de runa em volta do meio, a uma distância fixa
  const runas = (v, n, rx, ry, giro = 0.4) => {
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + giro; porPerto(chao, obj, Math.round(CX + Math.cos(a) * rx), Math.round(CY + Math.sin(a) * ry), 'pedraRuna', v, 2); }
  };
  const terra = ['terra', 'lama', 'cascalho'];
  if (bioma === 'selva' && sem === 1) {           // Toca dos Lobos
    espalhar([['ossosN', 0.055, 2], ['seixos', 0.08, 4, terra], ['cogumeloLuz', 0.03, 2], ['samambaia', 0.06, 2], ['toco', 0.02], ['tronco', 0.015], ['cogumelos', 0.025, 2], ['pedrasN', 0.015, 2]]);
  }
  if (bioma === 'selva' && sem === 2) {           // Campo Azul: runas azuis e as rochas dos Krugs
    runas(0, 4, 7, 5);
    espalhar([['cogumeloLuz', 0.035, 1], ['pedrasN', 0.03, 2], ['samambaia', 0.03, 2], ['seixos', 0.07, 4, terra], ['toco', 0.008]]);
  }
  if (bioma === 'selva' && sem === 3) {           // Campo Vermelho: runas vermelhas, chão queimado e espinheiros
    runas(1, 4, 7, 5, 1.1);
    espalhar([['queimado', 0.03, 2], ['espinheiro', 0.02, 3], ['cogumelos', 0.025, 1], ['seixos', 0.07, 4, terra], ['samambaia', 0.02, 2]]);
  }
  if (bioma === 'rio' && sem === 1) {             // Rio: as runas roxas do Arauto e troncos trazidos pela água
    runas(2, 3, 8, 5, 0.9);
    espalhar([['juncoN', 0.08, 2, ['areia']], ['tronco', 0.012, 1], ['seixos', 0.06, 4, ['areia', ...terra]], ['canteiro', 0.03, 4, ['grama']], ['cogumeloLuz', 0.008, 2]]);
  }
  if (bioma === 'rio' && sem === 2) {             // Fosso do Dragão: chão queimado, pilares de fogo e ossos
    for (const [dx, dy] of [[-6, -3], [6, -3], [-6, 4], [6, 4]]) porPerto(chao, obj, CX + dx, CY + dy, 'pilarFogo', 1, 2);
    runas(1, 2, 9, 1, 0);
    espalhar([['queimado', 0.05, 2], ['ossosN', 0.03, 2], ['seixos', 0.06, 4, ['areia', ...terra]], ['juncoN', 0.04, 2, ['areia']]]);
  }
  if (bioma === 'barao') {                        // Covil do Barão: veias do Vazio, cristais, cogumelos roxos
    runas(2, 4, 8, 6, 0.2);
    espalhar([['veiaVazio', 0.08, 4], ['cogumeloLuz', 0.025, 2], ['cristalV', 0.015, 2], ['ossosN', 0.02, 2]]);
  }
}
// acampamento de viajantes na Rota Superior: tendas, fogueira, carroça e cerca
function acampamento(chao, obj) {
  limpar(chao, obj, 30, 21, 45, 33);
  por(chao, obj, 33, 26, 'tendaN', 0); por(chao, obj, 39, 24, 'tendaN', 1);
  por(chao, obj, 36, 29, 'fogueira');
  por(chao, obj, 34, 30, 'banco'); por(chao, obj, 38, 30, 'banco');
  por(chao, obj, 41, 29, 'carroca');
  for (const [t, x, y] of [['barril', 31, 27], ['caixote', 32, 28], ['feno', 42, 26], ['feno', 43, 27], ['barril', 37, 25], ['tocha', 31, 23], ['tocha', 44, 31]]) por(chao, obj, x, y, t, 0);
  for (const x of [31, 32, 33, 34]) por(chao, obj, x, 32, 'cerca');
  for (const [x, y, v] of [[35, 27, 1], [40, 27, 2], [33, 31, 0]]) por(chao, obj, x, y, 'canteiro', v);
}

function pontoLivre(livre, x, y) {
  for (let raio = 0; raio < 10; raio++)
    for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++)
      if (livre(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return { x, y };
}

const VIZ = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

// BFS em 8 direções (o OT também anda na diagonal); devolve os passos sem o ponto inicial
export function caminho(mapa, de, para, ocupado = new Set(), limite = 400) {
  if (de.x === para.x && de.y === para.y) return [];
  const chave = (x, y) => x + ',' + y;
  const veio = new Map([[chave(de.x, de.y), null]]);
  const fila = [de];
  while (fila.length && veio.size < limite) {
    const a = fila.shift();
    for (const [dx, dy] of VIZ) {
      const x = a.x + dx, y = a.y + dy, k = chave(x, y);
      if (veio.has(k)) continue;
      const alvo = x === para.x && y === para.y;
      if (!mapa.livre(x, y) || (!alvo && ocupado.has(k))) continue;
      veio.set(k, a);
      if (alvo) {
        const passos = [{ x, y }];
        for (let p = a; p && veio.get(chave(p.x, p.y)); p = veio.get(chave(p.x, p.y))) passos.unshift({ x: p.x, y: p.y });
        return passos;
      }
      fila.push({ x, y });
    }
  }
  return null;
}

export const vizinhos = (p) => VIZ.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));

// ---------- Runeterra: o mundo aberto (a lógica vem de runeterra.js; aqui só o desenho) ----------
// estilo novo em Runeterra: só o visual muda. As colisões continuam as do mundo lógico (as mesmas do servidor),
// então os objetos antigos só trocam de desenho e os enfeites novos nunca bloqueiam.
const NO_MUNDO = { arvore: (v) => (v % 3 === 2 ? 'arvoreRedonda' : 'pinheiro'), arvoreE: () => 'arvoreSelva', arbusto: () => 'arbustoN', rocha: () => 'pedrasN',
  rochaV: () => 'rochaVN', cristal: () => 'cristalV', penhasco: () => 'penhasco', bau: () => 'bau', cogumelo: () => 'cogumelos', ossos: () => 'ossosN', junco: () => 'juncoN', flores: () => 'canteiro' };
const ENFEITES_MUNDO = { grama: [['capimAlto', 0.03], ['canteiro', 0.02], ['cogumelos', 0.004]], gramaE: [['samambaia', 0.05], ['cogumelos', 0.015], ['capimAlto', 0.015]],
  areia: [['juncoN', 0.02]], vazio: [['pocaVazio', 0.01], ['ossosN', 0.012]], lama: [['ossosN', 0.01]] };
// enfeites de cada zona de Runeterra por tipo de chão: [tipo, chance, variante fixa (senão sorteia)]. Só entram os que não
// bloqueiam (as colisões de Runeterra são as do servidor); pedrinhas, chão queimado e veias do Vazio vão pintados no chão
const PEDRINHAS = ['seixos', 0.05];
const ENFEITES_ZONA = {
  'rota-inf': { grama: [['canteiro', 0.03], ['capimAlto', 0.03], ['cogumelos', 0.004]], terra: [PEDRINHAS] },
  'rota-sup': { grama: [['canteiro', 0.025], ['capimAlto', 0.035], ['cogumelos', 0.005]], terra: [PEDRINHAS] },
  lobos: { gramaE: [['samambaia', 0.05], ['ossosN', 0.01], ['cogumelos', 0.015], ['cogumeloLuz', 0.004, 1], ['capimAlto', 0.012]], terra: [PEDRINHAS, ['ossosN', 0.01]] },
  azul: { gramaE: [['samambaia', 0.045], ['cogumeloLuz', 0.01, 0], ['capimAlto', 0.015]], pedra: [['seixos', 0.04]], terra: [PEDRINHAS] },
  vermelho: { gramaE: [['samambaia', 0.04], ['cogumelos', 0.02], ['queimado', 0.008], ['capimAlto', 0.012]], terra: [PEDRINHAS, ['queimado', 0.015]] },
  rio: { grama: [['canteiro', 0.03], ['capimAlto', 0.03]], areia: [['juncoN', 0.04], ['seixos', 0.02]], terra: [PEDRINHAS], agua: [['nenufar', 0.02]] },
  dragao: { areia: [['queimado', 0.025], ['seixos', 0.025], ['ossosN', 0.008], ['juncoN', 0.008]], lama: [['queimado', 0.04], ['ossosN', 0.015]], pedra: [['seixos', 0.03]], agua: [['nenufar', 0.01]] },
  barao: { vazio: [['veiaVazio', 0.05], ['pocaVazio', 0.01], ['ossosN', 0.012], ['cogumeloLuz', 0.008, 1]], lama: [['veiaVazio', 0.03], ['ossosN', 0.01]] },
};
// em Runeterra, uma parte das pedras (que já bloqueiam no servidor) vira algo da zona, no mesmo tile: pedras de runa acesas
// nos campos, no rio e na Fenda do Vazio; lampiões e bandeiras perto das estradas das rotas. As colisões não mudam.
const RUNA_ZONA = { azul: 0, vermelho: 1, dragao: 1, rio: 2, barao: 2 };
function trocaNoMundo(L, tipo, x, y) {
  if (tipo !== 'rocha' && tipo !== 'rochaV') return null;
  if (cidadeEm(x + 0.5, y + 0.5)) return null;
  const h = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100, z = zonaEm(x + 0.5, y + 0.5);
  if (RUNA_ZONA[z] != null && h < 14) return ['pedraRuna', RUNA_ZONA[z]];
  if ((z === 'rota-inf' || z === 'rota-sup') && h < 45) {
    let estrada = false;
    for (let dy = -2; dy <= 2 && !estrada; dy++) for (let dx = -2; dx <= 2; dx++) if (L.estrada[y + dy]?.[x + dx]) { estrada = true; break; }
    if (estrada) return h < 25 ? ['lampiaoN', 0] : ['bandeiraN', z === 'rota-sup' ? 2 : 0];
  }
  return null;
}
const PEDACO = 4;              // o chão de Runeterra é pintado em pedaços de 4×4 tiles (128 px)
const MAX_PEDACOS = 700;       // pedaços guardados (uns 45 MB); os mais antigos são descartados e repintados se voltar

// Runeterra (16384×12288 px) não cabe num canvas só: o chão fica em pedaços pintados quando a câmera chega perto
export function gerarMundo() {
  const L = mundoLogico(), { larg, alt, chao } = L, novo = estiloNovoLigado();
  let obj, pintarChaoPedaco;
  if (novo) {
    const r = rng(4242);
    obj = L.obj.map((l, y) => l.map((o, x) => {
      if (!o || o[0] === 'npc') return null;
      const troca = trocaNoMundo(L, o[0], x, y);         // algumas pedras viram runas, lampiões e bandeiras (no mesmo tile que já bloqueia)
      if (troca) return objetoNovo(troca[0], troca[1]);
      if (NO_MUNDO[o[0]] && !cidadeEm(x + 0.5, y + 0.5)) return objetoNovo(NO_MUNDO[o[0]](o[1]), o[1]);
      if (o[0] === 'braseiro') return objetoNovo('tocha');
      if (o[0] === 'bandeira') return objetoNovo('bandeiraN', o[1]);
      if (o[0] === 'lampiao') return objetoNovo('lampiaoN');
      return objeto(o[0], o[1]);
    }));
    for (let y = 1; y < alt - 1; y++) for (let x = 1; x < larg - 1; x++) {
      const naAgua = chao[y][x] === 'agua';
      if (obj[y][x] || (L.bloq[y][x] && !naAgua) || L.estrada[y][x] || cidadeEm(x + 0.5, y + 0.5)) continue;
      const lista = ENFEITES_ZONA[zonaEm(x + 0.5, y + 0.5)]?.[chao[y][x]] || (naAgua ? [] : ENFEITES_MUNDO[chao[y][x]]) || [];
      for (const [tipo, chance, v] of lista) if (r() < chance) { const o = objetoNovo(tipo, v ?? (r() * 4) | 0); if (!o.bloqueia) obj[y][x] = o; break; }
    }
    // cópia só para pintar (o chão lógico é o mesmo do servidor e não muda): fora das cidades, 'pedra' vira cascalho
    const chaoPintado = chao.map((l, y) => l.map((t, x) => (t === 'pedra' && !cidadeEm(x + 0.5, y + 0.5) && !L.estrada[y][x] ? 'cascalho' : t)));   // na estrada, é a ponte de pedra
    // o centro de cada cidade (laje azul) vira um círculo, sem escadinha
    const pracaRedonda = (px, py) => {
      const t = chao[(py / T) | 0][(px / T) | 0]; if (t !== 'fonte' && t !== 'pedra') return null;
      for (const c of CIDADES) {
        const dx = px / T - c.x, dy = py / T - c.y; if (Math.abs(dx) > 4 || Math.abs(dy) > 4) continue;
        return Math.hypot(dx / 2.5, dy / 2.3) < 1 ? 'fonte' : 'pedra';
      }
      return null;
    };
    pintarChaoPedaco = criarPintorChao(chaoPintado, 7, pracaRedonda);
  } else {
    obj = L.obj.map((l) => l.map((o) => (o && o[0] !== 'npc' ? objeto(o[0], o[1]) : null)));
    pintarChaoPedaco = (g, tx0, ty0, tx1, ty1, ox, oy) => {
      g.save(); g.translate(-ox, -oy);
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) g.drawImage(piso(chao[y][x], (x * 7 + y * 13) % 4), x * T, y * T);
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        const a = PISOS[chao[y][x]], rb = rng(977 + x * 7919 + y * 104729);
        for (const [dx, dy, lado] of [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'O'], [1, 0, 'L']]) {
          const t = chao[y + dy]?.[x + dx];
          if (t && PISOS[t].prio > a.prio) borda(g, x * T, y * T, piso(t, 0), PISOS[t].cor, lado, rb);
        }
      }
      g.restore();
    };
  }
  // decoração rasteira (canteiros, poças) vai pintada no chão, junto com o pedaço
  const decalques = new Map();
  for (let y = 0; y < alt; y++) for (let x = 0; x < larg; x++) if (obj[y][x]?.chao) { decalques.set(y * larg + x, obj[y][x]); obj[y][x] = null; }
  const pedacos = new Map();
  const pintarPedaco = (px, py) => {
    const tx0 = px * PEDACO, ty0 = py * PEDACO, tx1 = Math.min(larg - 1, tx0 + PEDACO - 1), ty1 = Math.min(alt - 1, ty0 + PEDACO - 1);
    const c = tela((tx1 - tx0 + 1) * T, (ty1 - ty0 + 1) * T), g = c.getContext('2d'), ox = tx0 * T, oy = ty0 * T;
    pintarChaoPedaco(g, tx0, ty0, tx1, ty1, ox, oy);
    g.save(); g.translate(-ox, -oy);
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) { const d = decalques.get(y * larg + x); if (d) g.drawImage(d.img, x * T, y * T); }
    if (novo) for (let y = Math.max(0, ty0 - 3); y <= Math.min(alt - 1, ty1 + 3); y++) for (let x = Math.max(0, tx0 - 4); x <= Math.min(larg - 1, tx1 + 4); x++) {
      const o = obj[y][x]; if (!o?.sombra) continue;
      const [sx, sy, rx, ry] = o.sombra;
      sombraNoChao(g, x * T + sx, y * T + sy, rx, ry);
      if (o.luz) luzNoChao(g, x * T + 16, y * T + 8, 70, typeof o.luz === 'string' ? o.luz : undefined);
    }
    for (const cid of CIDADES) {          // a praça de cada cidade: anel de runas na cor da cidade
      if (Math.abs(cid.x - (tx0 + tx1) / 2) > 8 || Math.abs(cid.y - (ty0 + ty1) / 2) > 8) continue;
      const cx = cid.x * T, cy = cid.y * T;
      g.strokeStyle = tom(cid.cor, 0.5); g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, 2.75 * T, 2.5 * T, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = cid.cor; g.globalAlpha = 0.55; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, 2.2 * T, 2 * T, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    g.restore();
    return c;
  };
  const pedaco = (px, py) => {
    const k = py * 1000 + px;
    let c = pedacos.get(k);
    if (c) { pedacos.delete(k); pedacos.set(k, c); return c; }          // o mais usado vai para o fim da fila
    c = pintarPedaco(px, py); pedacos.set(k, c);
    if (pedacos.size > MAX_PEDACOS) pedacos.delete(pedacos.keys().next().value);
    return c;
  };
  // desenha o chão que a câmera vê e deixa pintado um pedaço da vizinhança por quadro (para não engasgar ao andar)
  const desenharChao = (g, camX, camY, w, h) => {
    const P = PEDACO * T, a = Math.max(0, Math.floor(camX / P)), b = Math.max(0, Math.floor(camY / P));
    const c = Math.min(Math.ceil(larg / PEDACO) - 1, Math.floor((camX + w) / P)), d = Math.min(Math.ceil(alt / PEDACO) - 1, Math.floor((camY + h) / P));
    for (let py = b; py <= d; py++) for (let px = a; px <= c; px++) g.drawImage(pedaco(px, py), px * P, py * P);
    for (let py = Math.max(0, b - 1); py <= d + 1; py++) for (let px = Math.max(0, a - 1); px <= c + 1; px++)
      if (px * PEDACO < larg && py * PEDACO < alt && !pedacos.has(py * 1000 + px)) { pedaco(px, py); return; }
  };
  // o mundo inteiro numa imagem pequena (para testes e prévias): escala k
  const miniatura = (k) => {
    const c = tela(Math.round(larg * T * k), Math.round(alt * T * k)), g = c.getContext('2d'), P = PEDACO * T;
    for (let py = 0; py * PEDACO < alt; py++) for (let px = 0; px * PEDACO < larg; px++) { const p = pintarPedaco(px, py); g.drawImage(p, px * P * k, py * P * k, p.width * k, p.height * k); }
    return c;
  };
  const agua = [];
  for (let y = 0; y < alt; y++) for (let x = 0; x < larg; x++) if (chao[y][x] === 'agua') agua.push([x, y]);
  const c0 = chegadaCidade('demacia');
  return { bioma: 'mundo', mundo: true, larg, alt, chao, obj, bloq: L.bloq, agua, livre: L.livre, npcs: L.npcs,
    centro: { x: Math.floor(c0.x), y: Math.floor(c0.y) }, pontos: L.pontos, mini: miniMundo(), novo, desenharChao, miniatura };
}
// o mundo inteiro em 1 pixel por tile (minimapa e mapa-múndi)
let mini = null;
export function miniMundo() {
  if (mini) return mini;
  const L = mundoLogico(), { larg, alt, chao } = L;
  mini = tela(larg, alt);
  const mg = mini.getContext('2d');
  for (let y = 0; y < alt; y++) for (let x = 0; x < larg; x++) {
    const cid = cidadeEm(x + 0.5, y + 0.5), t = chao[y][x];
    let cor = PISOS[t].cor;
    if (cid) cor = t === 'fonte' ? tom(cid.cor, 0.9) : tom(cid.cor, 0.5);
    else if (L.estrada[y][x]) cor = '#c8a870';
    else if (L.bloq[y][x]) cor = tom(cor, 0.6);
    mg.fillStyle = cor; mg.fillRect(x, y, 1, 1);
  }
  return mini;
}

// ---------- a Arena (12/10/2026): uma ponte de pedra coberta de neve sobre o abismo, com uma base em cada ponta ----------
// O chão é pintado aqui mesmo (o abismo não é um tipo de piso comum): lajes de pedra com geada, neve nas bordas, a lateral
// da ponte descendo para o escuro e névoa com brilhos de gelo lá embaixo. As medidas vêm de js/arena-pvp.js (ARENA_PVP.mapa).
export function gerarAbismo(m) {
  const novo = estiloNovoLigado(), W = LARG * T, H = ALT * T;
  // ruído suave sem limite de tamanho (o ruido() daqui só cobre o mapa em tiles)
  const hash = (x, y, k) => { const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  const suave = (t) => t * t * (3 - 2 * t);
  const ruidoLivre = (escala, k) => (x, y) => {
    const gx = x / escala, gy = y / escala, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = suave(gx - x0), fy = suave(gy - y0);
    const a = hash(x0, y0, k) + (hash(x0 + 1, y0, k) - hash(x0, y0, k)) * fx, b = hash(x0, y0 + 1, k) + (hash(x0 + 1, y0 + 1, k) - hash(x0, y0 + 1, k)) * fx;
    return a + (b - a) * fy;
  };
  const n1 = ruidoLivre(3, 1), n2 = ruidoLivre(1, 2), n3 = ruidoLivre(6, 3);
  const naPonte = (x, y) => x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1;
  const naBase = (x) => x <= m.x0 + 4 || x >= m.x1 - 4;
  const chao = [], obj = [];
  for (let y = 0; y < ALT; y++) { chao.push([]); obj.push([]); for (let x = 0; x < LARG; x++) { chao[y].push(naPonte(x, y) ? (naBase(x) ? 'fonte' : 'pedra') : 'agua'); obj[y].push(null); } }
  const img = tela(W, H), g = img.getContext('2d'), dados = g.createImageData(W, H), d = dados.data;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const ABISMO = ['#04060b', '#070b14', '#0b111f', '#10192c', '#16233b', '#1e3050'].map(hex);
  const NEVOA = ['#2a3d5a', '#3a5274', '#56719a'].map(hex);
  const PEDRA = ['#2c323b', '#3b434e', '#4c5663', '#5f6b79', '#768391', '#909dab'].map(hex);
  const LAJE = ['#24304a', '#33415f', '#435377', '#566892', '#6e82ad', '#93a8cf'].map(hex);
  const NEVE = ['#aebccb', '#c8d5e1', '#dce6ef', '#eef3f8'].map(hex);
  const pinta = (i, c) => { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
  const Y0 = m.y0 * T, Y1 = (m.y1 + 1) * T, X0 = m.x0 * T, X1 = (m.x1 + 1) * T;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = (py * W + px) * 4, tx = px / T, ty = py / T;
    const dentro = px >= X0 && px < X1 && py >= Y0 && py < Y1;
    if (!dentro) {
      // a lateral da ponte (pedra escura descendo uns 18 px) e o parapeito em cima
      if (px >= X0 && px < X1 && py >= Y1 && py < Y1 + 18) {
        const k = (px % 24 === 0 ? 0 : 1) + (py - Y1 < 3 ? 2 : py - Y1 > 12 ? -1 : 0) + (n2(tx * 4, ty * 4) > 0.6 ? 1 : 0);
        pinta(i, PEDRA[Math.max(0, Math.min(3, k))]); continue;
      }
      if (px >= X0 && px < X1 && py >= Y0 - 5 && py < Y0) { pinta(i, py === Y0 - 5 ? NEVE[2] : PEDRA[py < Y0 - 2 ? 3 : 1]); continue; }
      // o abismo: escuro, mais claro perto da ponte (névoa subindo) e uns brilhos de gelo
      const dist = Math.min(Math.abs(py - Y0), Math.abs(py - Y1)) / T;
      let v = 3.2 - Math.min(3, dist * 0.45) + (n1(tx, ty) - 0.5) * 1.6 + (n3(tx * 1.5, ty) - 0.5) * 1.2;
      const k = Math.max(0, Math.min(5, Math.round(v)));
      const nev = n3(tx + 7, ty * 2) * (1 - Math.min(1, dist / 7));
      if (nev > 0.55 && (px + py * 3) % 4 !== 0) pinta(i, NEVOA[nev > 0.7 ? 1 : 0]);
      else pinta(i, ABISMO[k]);
      if (n2(tx * 9, ty * 9) > 0.93 && ((px * 7 + py * 13) % 11) === 0) pinta(i, NEVOA[2]);
      continue;
    }
    // em cima da ponte: lajes em fiada (as das bases em azul), geada e neve nas bordas
    const base = naBase(Math.floor(tx)), R_ = base ? LAJE : PEDRA;
    const fiada = py >> 4, qx = px + (fiada % 2) * 16, sx = qx % 32, sy = py & 15;
    let k = 3 + Math.round((n2((qx >> 5) * 3.1, fiada * 1.7) - 0.5) * 2 + (n1(tx, ty) - 0.5));
    if (sx === 0 || sy === 0) k = 1; else if (sx === 1 || sy === 1) k = Math.min(5, k + 1);
    k = Math.max(0, Math.min(5, k));
    const borda = Math.min(py - Y0, Y1 - 1 - py) / T;
    const neve = n1(tx * 2, ty * 2) * 0.6 + n2(tx * 3, ty * 3) * 0.4 - borda * 0.32;
    if (neve > 0.42) pinta(i, NEVE[Math.max(0, Math.min(3, Math.round((neve - 0.42) * 8 + (n2(tx * 8, ty * 8) - 0.5) * 2)))]);
    else pinta(i, R_[k]);
  }
  g.putImageData(dados, 0, 0);
  // o círculo de runas no chão de cada base e a linha do meio da ponte
  g.save();
  for (const bx of [m.x0 + 2.5, m.x1 - 1.5]) {
    const ox = bx * T, oy = ((m.y0 + m.y1 + 1) / 2) * T;
    g.strokeStyle = 'rgba(140,210,255,0.45)'; g.lineWidth = 2;
    for (const raio of [2.1, 2.6]) { g.beginPath(); g.arc(ox, oy, raio * T, 0, Math.PI * 2); g.stroke(); }
  }
  g.strokeStyle = 'rgba(190,230,255,0.25)'; g.setLineDash([10, 8]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(((m.x0 + m.x1 + 1) / 2) * T, Y0 + 6); g.lineTo(((m.x0 + m.x1 + 1) / 2) * T, Y1 - 6); g.stroke();
  g.restore();
  // os objetos: tochas na borda, as bandeiras (azul de um lado, vermelha do outro), o cristal de cada base e pilares no meio para se esconder
  const por = (x, y, o) => { if (!obj[y][x]) obj[y][x] = o; };
  const yc = Math.floor((m.y0 + m.y1) / 2);
  for (let x = m.x0 + 8; x <= m.x1 - 8; x += 6) { por(x, m.y0, novo ? objetoNovo('tocha') : objeto('braseiro')); por(x, m.y1, novo ? objetoNovo('tocha') : objeto('braseiro')); }
  for (const [x, cor] of [[m.x0, 0], [m.x1, 2]]) {
    por(x, m.y0, novo ? objetoNovo('bandeiraN', cor) : objeto('bandeira')); por(x, m.y1, novo ? objetoNovo('bandeiraN', cor) : objeto('bandeira'));
    por(x, yc + 1, novo ? objetoNovo('cristalFonte') : objeto('cristal-fonte'));
  }
  for (const x of [m.x0 + 14, m.x1 - 14]) for (const y of [m.y0 + 2, m.y1 - 2]) por(x, y, novo ? objetoNovo('pilarCristal') : objeto('pilar'));
  if (novo) for (let y = 0; y < ALT; y++) for (let x = 0; x < LARG; x++) {
    const o = obj[y][x]; if (!o?.sombra) continue;
    const [sx, sy, rx, ry] = o.sombra;
    sombraNoChao(g, x * T + sx, y * T + sy, rx, ry);
    if (o.luz) luzNoChao(g, x * T + 16, y * T + 8, 70, typeof o.luz === 'string' ? o.luz : undefined);
  }
  // a primeira fileira da ponte é só a borda de neve: quem pisasse nela apareceria em pé em cima do abismo (o desenho sobe um tile)
  const bloq = chao.map((l, y) => l.map((t, x) => !!(PISOS[t].bloqueia || obj[y][x]?.bloqueia) || (y === m.y0 && x >= m.x0 && x <= m.x1)));
  const livre = (x, y) => x >= 0 && y >= 0 && x < LARG && y < ALT && !bloq[y][x];
  return { bioma: 'abismo', aram: true, larg: LARG, alt: ALT, chao, obj, bloq, img, agua: [], livre, npcs: [], centro: { x: Math.floor((m.x0 + m.x1) / 2), y: yc }, novo };
}
