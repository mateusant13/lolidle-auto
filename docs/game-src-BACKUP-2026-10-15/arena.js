// Runeterra (o antigo Campo de Batalha): aqui o jogador controla o campeão, como no LoL. Clica no chão para andar, clica num monstro
// (ou num jogador, com o PvP ligado) para atacá-lo — o campeão vai até ficar ao alcance e continua batendo nele —
// e as habilidades vão na direção do mouse (projéteis podem errar).
// Posições em tiles (x, y = o ponto do chão onde a criatura pisa). Sem DOM: dá para simular no Node.
// PvP: os outros jogadores ficam em A.outros (vindos do servidor). Com o modo PvP ligado, os golpes que pegam neles
// geram o evento 'acertoPvp' — quem calcula o dano é o servidor.
// Mundo aberto (A.mundo): os monstros nascem em pontos fixos de cada zona, vagam em volta, perseguem quem chega
// perto e desistem se forem puxados para longe de casa. Nas cidades não entra monstro nem vale PvP.
import * as M from './motor.js';
import { t as tr } from './i18n.js';
import { zonaPkEm, PK_BONUS } from './runeterra.js';
import { VILEMAW, GOLPES_VILEMAW, danoVilemaw } from './chefe-global.js';

const { efetivo, golpear, curar, receberDano, aplicarHemorragia, acertouHabilidade, detonarOrbe, emitir, gastarMana, tornarNoturno,
  bonusPoder, tickInimigos, avancarAtaque, golpeBasico, inimigoAtaca, processarAbates, aoUsarHabilidade, iluminar, curaTaric } = M.interno;

export const AR = {
  vel: 4.4,                                   // tiles/s do campeão (o servidor aceita até 3,4 × 1,5 = 5,1: ver pvp.js)
  alcance: { darius: 1.6, ezreal: 5, lux: 5, yasuo: 1.6, katarina: 1.6, taric: 1.7, zac: 1.8 },        // ataque básico
  vivosMax: 3, intervalo: 1.4, inicio: 1.2,   // monstros ao mesmo tempo e de quanto em quanto tempo nasce outro
  surgir: [7, 10],                            // distância em que os monstros nascem
  velMonstro: 2.3, raio: 0.42,                // tiles/s e "tamanho" de cada criatura
  area: 2.4,                                  // raio das habilidades em volta do campeão (Q do Darius, Pisotear…)
};
// mundo aberto: distância em que um ponto de nascimento fica ativo e em que o monstro some; aggro, leash e respawn
export const MUNDO = { ativo: 15, some: 20, aggro: 5, leash: 12, respawn: [20, 35], regenCidade: 0.05, surgir: 1.5 };      // surgir: o monstro que nasce fica 1,5 s sem levar dano e sem atacar (anda)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const raioDe = (i) => i.raio ?? (i.chefe ? 0.9 : AR.raio);      // a Vilemaw (chefe global) é bem maior

// montaria: montar leva MONTARIA.montar segundos, andando ou parado (atacar, usar habilidade ou levar dano cancela)
export function alternarMontaria(c, estado) {
  const A = c.arena;
  if (!A?.mundo || c.darius.morto > 0) return;
  if (A.montado) { desmontar(c, A); return; }
  if (A.montando > 0) { A.montando = 0; emitir(c, 'montariaCancelada', {}); return; }
  A.alvoAtaque = null; A.entrada.fila.length = 0;          // continua andando (jogadores: "cancelava toda hora")
  A.montando = M.MONTARIA.montar; A.vidaMontando = estado.vida;
  emitir(c, 'montando', { dur: M.MONTARIA.montar });
}
function desmontar(c, A, derrubado = false) { if (!A.montado) return; A.montado = false; emitir(c, 'desmontou', { derrubado }); }
// outro jogador acertou: cai da montaria (e para de montar)
export function derrubar(c) {
  const A = c.arena; if (!A) return;
  if (A.montando > 0) { A.montando = 0; emitir(c, 'montariaCancelada', {}); }
  desmontar(c, A, true);
}

export function novaArena(livre = () => true, x = 24, y = 18) {
  return { x, y, dir: { x: 0, y: 1 }, livre, entrada: { mx: 0, my: 0, mira: null, fila: [] },
    mexeu: true, ocioso: 0, pausado: false, spawnT: AR.inicio, proj: [], atrasos: [], olhar: null,
    outros: [], pvp: false, alvoPvp: null, lances: 0, lanceAtual: 0, lentoJog: 0, presoJog: 0,
    destino: null,          // ponto do chão clicado
    caminho: null,          // no mundo aberto: os pontos do caminho até o destino (desviando de árvores e casas)
    mundo: null, pontos: null, cidade: null, zona: null,
    alvoAtaque: null,       // { tipo: 'monstro', id } ou { tipo: 'jogador', nome }: o campeão persegue e ataca
    travado: 0 };
}
// chamado ao entrar (livre = os tiles onde dá para pisar, centro = onde o campeão aparece;
// mundo = { larg, pontos, zonaEm(x, y), cidadeEm(x, y) } no mundo aberto, e aí o centro já é a posição exata)
export function entrar(c, livre, centro, mundo = null) {
  const antes = c.arena;
  c.arena = novaArena(livre, centro.x + (mundo ? 0 : 0.5), centro.y + (mundo ? 0 : 0.8));
  if (antes) c.arena.pvp = antes.pvp;
  if (mundo) { c.arena.mundo = mundo; c.arena.pontos = mundo.pontos.map((p) => ({ ...p, t: 0, id: null })); }
  c.inimigos = [];
  return c.arena;
}
const cidadeAqui = (A, x, y) => (A.mundo ? A.mundo.cidadeEm(x, y) : null);

// com Caveira (PvP) não se entra em cidade (quem já está dentro pode sair)
const podePisar = (A, x, y) => A.livre(Math.floor(x), Math.floor(y)) && !(A.caveira && cidadeAqui(A, x, y) && !cidadeAqui(A, A.x, A.y));
// anda com colisão, deslizando nas paredes (tenta x e y separados)
function mover(A, o, dx, dy) {
  if (dx && podePisar(A, o.x + dx, o.y)) o.x += dx;
  if (dy && podePisar(A, o.x, o.y + dy)) o.y += dy;
}
// monstro: além das paredes, não entra em cidade (mas sai, se for puxado para dentro)
const pisaMonstro = (A, o, x, y) => podePisar(A, x, y) && (!A.mundo || !cidadeAqui(A, x, y) || !!cidadeAqui(A, o.x, o.y));
function moverMonstro(A, o, dx, dy) {
  if (dx && pisaMonstro(A, o, o.x + dx, o.y)) o.x += dx;
  if (dy && pisaMonstro(A, o, o.x, o.y + dy)) o.y += dy;
}
const VIZ8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// caminho no mundo aberto (A* nos tiles, 8 direções, sem cortar quina); devolve os pontos até lá, ou null
function rota(A, de, para, limite = 5000) {
  const L = A.mundo.larg, sx = Math.floor(de.x), sy = Math.floor(de.y), tx = Math.floor(para.x), ty = Math.floor(para.y);
  if (!A.livre(tx, ty) || (sx === tx && sy === ty)) return null;
  const chave = (x, y) => y * L + x, inicio = chave(sx, sy);
  const h = (x, y) => { const ax = Math.abs(x - tx), ay = Math.abs(y - ty); return Math.max(ax, ay) + 0.41 * Math.min(ax, ay); };
  const g = new Map([[inicio, 0]]), veio = new Map(), heap = [[h(sx, sy), sx, sy]];
  const sobe = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const desce = (i) => {
    for (;;) {
      const a = 2 * i + 1, b = a + 1; let m = i;
      if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
      if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
      if (m === i) return;
      [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
    }
  };
  for (let n = 0; heap.length && n < limite; n++) {
    const [, x, y] = heap[0], ultimo = heap.pop();
    if (heap.length) { heap[0] = ultimo; desce(0); }
    if (x === tx && y === ty) {
      const pts = [{ x: para.x, y: para.y }];
      for (let k = veio.get(chave(x, y)); k != null && k !== inicio; k = veio.get(k)) pts.unshift({ x: (k % L) + 0.5, y: Math.floor(k / L) + 0.5 });
      return pts;
    }
    const gx = g.get(chave(x, y));
    for (const [dx, dy] of VIZ8) {
      const nx = x + dx, ny = y + dy;
      if (!A.livre(nx, ny) || (dx && dy && (!A.livre(x + dx, y) || !A.livre(x, y + dy)))) continue;
      const k = chave(nx, ny), ng = gx + (dx && dy ? 1.41 : 1);
      if (ng >= (g.get(k) ?? Infinity)) continue;
      g.set(k, ng); veio.set(k, chave(x, y)); heap.push([ng + h(nx, ny), nx, ny]); sobe(heap.length - 1);
    }
  }
  return null;
}
// dá para ir em linha reta de a até b?
function linhaLivre(A, a, b) {
  const n = Math.ceil(dist(a, b) / 0.25);
  for (let k = 1; k <= n; k++) if (!podePisar(A, a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)) return false;
  return true;
}
// até onde dá para ir em linha reta (avanços e o teleporte do Ezreal não atravessam obstáculos)
function ateOnde(A, de, dir, max) {
  let x = de.x, y = de.y;
  for (let k = 0; k < max; k += 0.1) {
    const nx = de.x + dir.x * (k + 0.1), ny = de.y + dir.y * (k + 0.1);
    if (!podePisar(A, nx, ny)) break;
    x = nx; y = ny;
  }
  return { x, y };
}
// direção da mira (do campeão até o mouse); sem mouse, para onde ele está virado
function mirar(A) {
  const m = A.entrada.mira;
  if (m) { const dx = m.x - A.x, dy = m.y - A.y, n = Math.hypot(dx, dy); if (n > 0.05) return { x: dx / n, y: dy / n, d: n }; }
  return { ...A.dir, d: 0 };
}

// ---------- comandos do jogador (cliques) ----------
export function mandarAndar(c, x, y) {
  const A = c.arena; if (!A) return;
  A.destino = { x, y }; A.alvoAtaque = null; A.travado = 0; A.mexeu = true;
  A.caminho = A.mundo && !linhaLivre(A, A, A.destino) ? rota(A, A, A.destino) : null;
}
export function mandarAtacar(c, alvo) { const A = c.arena; if (!A) return; A.alvoAtaque = alvo; A.destino = null; A.caminho = null; A.rotaT = 0; A.travado = 0; A.mexeu = true; }
// o alcance de cada habilidade, para o indicador na tela: circulo (em volta do campeão), linha (largura), cone, alvo (ponto até tal distância)
export const ALCANCE_HAB = {
  darius: { Q: { forma: 'circulo', alcance: 2.4 }, W: { forma: 'circulo', alcance: 1.6 }, E: { forma: 'cone', alcance: 5 }, R: { forma: 'alvo', alcance: 3.5 },
    A: { forma: 'linha', alcance: 4, largura: 1.2 }, M: { forma: 'linha', alcance: 6, largura: 0.9 }, T: { forma: 'circulo', alcance: 2.4 }, N: { forma: 'circulo', alcance: 5 } },
  ezreal: { Q: { forma: 'linha', alcance: 7.5, largura: 0.7 }, W: { forma: 'linha', alcance: 7.5, largura: 0.8 }, E: { forma: 'alvo', alcance: 3.5 }, R: { forma: 'linha', alcance: 25, largura: 2 },
    A: { forma: 'linha', alcance: 8, largura: 0.7 }, M: { forma: 'linha', alcance: 7.5, largura: 0.7 }, T: { forma: 'alvo', alcance: 7 }, B: { forma: 'alvo', alcance: 8 }, N: { forma: 'circulo', alcance: 5 } },
  lux: { Q: { forma: 'linha', alcance: 7.5, largura: 0.8 }, W: { forma: 'linha', alcance: 7, largura: 1.2 }, E: { forma: 'alvo', alcance: 7 }, R: { forma: 'linha', alcance: 14, largura: 1.8 },
    A: { forma: 'linha', alcance: 7.5, largura: 0.7 }, M: { forma: 'alvo', alcance: 7 }, T: { forma: 'circulo', alcance: 2.4 }, N: { forma: 'linha', alcance: 10, largura: 1.7 } },
  yasuo: { Q: { forma: 'linha', alcance: 4.5, largura: 0.6 }, W: { forma: 'linha', alcance: 1.6, largura: 2.2 }, E: { forma: 'alvo', alcance: 4.5 }, R: { forma: 'alvo', alcance: 8 },
    A: { forma: 'linha', alcance: 4, largura: 1.2 }, M: { forma: 'linha', alcance: 6, largura: 1 }, T: { forma: 'circulo', alcance: 2.6 }, N: { forma: 'circulo', alcance: 4 } },
  katarina: { Q: { forma: 'alvo', alcance: 6.5 }, W: { forma: 'circulo', alcance: 1 }, E: { forma: 'alvo', alcance: 7 }, R: { forma: 'circulo', alcance: 3.5 },
    A: { forma: 'linha', alcance: 8, largura: 0.6 }, M: { forma: 'alvo', alcance: 3 }, T: { forma: 'circulo', alcance: 2.4 }, N: { forma: 'circulo', alcance: 3.5 } },
  taric: { Q: { forma: 'circulo', alcance: 2.4 }, W: { forma: 'circulo', alcance: 6 }, E: { forma: 'linha', alcance: 5.5, largura: 0.9 }, R: { forma: 'circulo', alcance: 6 },
    A: { forma: 'linha', alcance: 8, largura: 0.4 }, F: { forma: 'circulo', alcance: 5 }, T: { forma: 'circulo', alcance: 2.6 }, B: { forma: 'circulo', alcance: 6 }, M: { forma: 'alvo', alcance: 6 }, N: { forma: 'circulo', alcance: 4 } },
  zac: { Q: { forma: 'linha', alcance: 6, largura: 0.8 }, W: { forma: 'circulo', alcance: 2.4 }, E: { forma: 'alvo', alcance: 9 }, R: { forma: 'circulo', alcance: 2.6 },
    A: { forma: 'linha', alcance: 7, largura: 0.6 }, F: { forma: 'alvo', alcance: 6 }, T: { forma: 'circulo', alcance: 2.8 }, M: { forma: 'circulo', alcance: 1.6 }, N: { forma: 'circulo', alcance: 4 } },
};
// Katarina: raio do giro ao pegar uma adaga, distância para pegar e alcance do Shunpo
export const KAT = { giro: 2, pega: 0.9, shunpo: 7, lotusRaio: 3.5, lotusOndas: 15, qAtras: 3 };   // qAtras: a adaga da Q cai atrás do primeiro alvo
// Zac: as gosmas (pega passando a `pega` tile; nascem de 0,8 a 1,6 tile atrás de quem foi atingido; no máximo `max` no chão), a Esticada
// (linha; o 2º agarrado a até `qSegundo` do 1º; os dois são batidos um no outro), o Estilingue (carrega até `eCarga` s: de `eMin` a
// HAB_ZAC.E.alcance tiles; voa `eVoo` s e cai num círculo de `eRaio`), os quiques (círculo `rRaio`, anda `rLento` mais devagar), o Gancho
// (puxa até `aPuxa` do Zac), a Poça (até `fAlc` tiles) e as cópias da Mitose (a `mLado` tile de cada lado; cada uma chama até `mSegura`
// monstros a até `mIsca` tiles e bate num a até `mAlc`)
export const ZAC = { pega: 0.9, longe: [0.8, 1.6], max: 12, qAlc: 6, qLarg: 0.8, qSegundo: 3, qJunta: 1.5, eMin: 4, eCarga: 1, eVoo: 0.6, eRaio: 2.2,
  wRaio: 2.4, rRaio: 2.6, rLento: 0.3, aLarg: 0.6, aPuxa: 1.2, fAlc: 6, mLado: 1.6, mIsca: 5, mSegura: 2, mAlc: 2 };
// a Lótus da Morte acaba: atordoada, andando ou usando outra habilidade
function pararLotus(c, A, interrompida = true) { if (!A.lotus) return; A.lotus = null; emitir(c, 'lotusFim', { interrompida }); }
export const alcanceBasico = (campeao) => AR.alcance[campeao] ?? 1.6;

// ---------- PvP ----------
// jogadores que dá para acertar agora (modo PvP ligado, nível parecido, vivos)
// quem dá para atacar: com o seu PK ligado, quem tem Caveira, ou quem te acertou nos últimos 60 s (legítima defesa, p641)
export const podeAtacarJog = (A, o) => !!(A?.pvp || o.caveira || (A?.agressores?.[o.nome] || 0) > (A?.tempo || 0));
const jogadoresAlvo = (A) => (!A.cidade ? A.outros.filter((o) => podeAtacarJog(A, o) && o.atacavel && !o.morto && !cidadeAqui(A, o.x, o.y)) : []);      // quem tem Caveira qualquer um ataca
const RAIO_JOG = 0.4;
const EM_COMBATE = 6;       // segundos "em combate PvP" depois de acertar ou ser acertado (poções mais fracas)
function acertarJogador(c, A, o, tecla, lance = A.lanceAtual) {
  A.combatePvp = EM_COMBATE;
  if (A.marcaLuz && !['ataque', 'P', 'D', 'W'].includes(tecla)) (A.marcasJog ??= {})[o.nome] = (A.tempo || 0) + 6;      // Lux: a habilidade marca o jogador (o ataque seguinte explode)
  emitir(c, 'acertoPvp', { alvo: o.nome, tecla, lance });
}
// o servidor mandou: lentidão, atordoamento ou puxão (E do Darius)
export function efeitoPvp(c, msg) {
  const A = c.arena; if (!A) return;
  A.combatePvp = EM_COMBATE;
  if (A.inabalavel) return;                       // Domínio de Noxus: o Darius não é atordoado, preso nem puxado
  const resiste = 1 - (A.tenacidade || 0);       // Vontade do General
  if (msg.lento) A.lentoJog = Math.max(A.lentoJog, msg.lento * resiste);
  if (msg.atordoado) { A.presoJog = Math.max(A.presoJog, msg.atordoado * resiste); pararLotus(c, A); }
  if (msg.puxar) { A.x = msg.puxar.x; A.y = msg.puxar.y; }
  if (msg.empurrar) { const p = ateOnde(A, A, msg.empurrar, Math.min(3, msg.empurrar.d || 2)); A.x = p.x; A.y = p.y; }
}
export function corrigirPosicao(c, x, y) { if (c.arena) { c.arena.x = x; c.arena.y = y; } }

// ---------- monstros ----------
function surgir(estado, c, A) {
  const base = M.localDaArena(estado.nivel), r = Math.random;
  let nome, nivel;
  if (base.chefe && r() < base.chefe[1] / 3) { nome = base.chefe[0]; nivel = estado.nivel + 2; }
  else {
    const total = base.monstros.reduce((s, [, p]) => s + p, 0);
    let x = r() * total; nome = base.monstros[0][0];
    for (const [n, p] of base.monstros) if ((x -= p) < 0) { nome = n; break; }
    nivel = Math.max(1, estado.nivel - 1 + Math.floor(r() * 4));
  }
  for (let tent = 0; tent < 30; tent++) {
    const ang = r() * Math.PI * 2, d = AR.surgir[0] + r() * (AR.surgir[1] - AR.surgir[0]);
    const x = A.x + Math.cos(ang) * d, y = A.y + Math.sin(ang) * d;
    if (x < 2 || y < 2 || x > 46 || y > 34 || !podePisar(A, x, y)) continue;
    const m = M.criarMonstro(nome, nivel, { chegada: 0, x, y });
    m.distancia = M.MONSTROS[nome].distancia ? M.MONSTROS[nome].distancia + 0.5 : 0;       // quem atira para a essa distância
    if (!m.chefe && M.ehNoite(estado) && r() < M.NOTURNO.chance) tornarNoturno(m);
    c.inimigos.push(m);
    if (m.chefe) emitir(c, 'grupo', { chefe: true, nome: m.nome });
    return m;
  }
  return null;
}

// ---------- mundo aberto: cada ponto guarda um monstro; morto, ele volta depois de um tempo ----------
function nascerNoPonto(estado, c, A, p) {
  const l = M.LOCAL[p.zona], r = Math.random, nj = estado.nivel;
  const entre = (v, a, b) => Math.max(a, Math.min(b, v));
  let nome, nivel;
  if (p.guardiao) { nome = p.guardiao; nivel = entre(Math.max(nj + 3, l.nm[1]), l.nm[0], l.nm[1] + 4); }      // sempre no topo da zona
  else if (l.chefe && r() < l.chefe[1] / 3) { nome = l.chefe[0]; nivel = entre(nj + 2, l.nm[0], l.nm[1] + 2); }
  else {
    const total = l.monstros.reduce((s2, [, q]) => s2 + q, 0);
    let x = r() * total; nome = l.monstros[0][0];
    for (const [n, q] of l.monstros) if ((x -= q) < 0) { nome = n; break; }
    nivel = entre(nj - 1 + Math.floor(r() * 4), l.nm[0], l.nm[1]);       // a zona tem a sua faixa; dentro dela, perto do seu nível
  }
  const m = M.criarMonstro(nome, nivel, { chegada: 0, x: p.x, y: p.y });
  // monstro acima do seu nível é perigoso, mas não rende mais que um de 2 níveis acima
  if (nivel > nj + 2) { const ref = M.criarMonstro(nome, nj + 2); m.xp = Math.min(m.xp, ref.xp); m.ouro = Math.min(m.ouro, ref.ouro); }
  m.distancia = M.MONSTROS[nome].distancia ? M.MONSTROS[nome].distancia + 0.5 : 0;
  if (!m.chefe && M.ehNoite(estado) && r() < M.NOTURNO.chance) tornarNoturno(m);
  m.casa = { x: p.x, y: p.y }; m.zona = p.zona; m.aggro = false; m.voltando = false; m.vagar = 1 + r() * 3;
  // (o monstro surgindo do p577 foi desligado no p579: todo mundo passou a ganhar menos XP em Runeterra)
  // guardião de fortaleza que não é chefe: a versão elite (3x a vida, mais forte), sem contar como chefe no save
  // guardião de fortaleza: um desafio de verdade, luta longa (elite: 15x a vida; chefe de verdade: 3x a vida; o dano sobe pouco para a luta ser longa, não impossível)
  if (p.guardiao && !m.chefe) { m.hp *= 15; m.hpMax *= 15; m.ad *= 1.7; m.armadura *= 1.6; m.elite = true; m.vagar = 0; }
  else if (p.guardiao) { m.hp *= 3; m.hpMax *= 3; m.ad *= 1.1; m.armadura *= 1.3; }
  if (p.guardiao) { m.guardiao = p.fortaleza; m.pisaoT = 4; }
  c.inimigos.push(m);
  p.id = m.id; p.monstro = m;
  if (m.chefe || p.guardiao) emitir(c, 'grupo', { chefe: true, nome: m.nome, guardiao: !!p.guardiao });
}
function gerirPontos(estado, c, A, dt) {
  const porId = new Map();
  for (const i of c.inimigos) porId.set(i.id, i);
  const sumir = new Set();
  for (const p of A.pontos) {
    if (p.id != null) {
      const m = porId.get(p.id), morreu = !!p.monstro && (p.monstro.morto || p.monstro.hp <= 0);
      if (!m || morreu) {
        // o guardião morto larga a chave do baú no chão; só volta quando o baú encher de novo (ver mundo.guardiaoEspera)
        if (morreu && p.guardiao) {
          p.t = 10;
          A.chaves = (A.chaves || []).filter((k) => k.fortaleza !== p.fortaleza);
          A.chaves.push({ fortaleza: p.fortaleza, x: p.monstro.x, y: p.monstro.y, ate: Date.now() + 10 * 60000, nasceu: Date.now() });
          emitir(c, 'guardiaoVencido', { fortaleza: p.fortaleza, x: p.monstro.x, y: p.monstro.y });
        } else p.t = 0;          // monstro comum: volta assim que o campeão se afasta (como sempre foi)
        p.id = null; p.monstro = null; continue;
      }
      if (!m.aggro && dist(p, A) > MUNDO.some) { sumir.add(m.id); p.id = null; p.t = 0; }      // longe do campeão: guarda até ele voltar
      continue;
    }
    p.t -= dt;
    if (p.t > 0 || Math.abs(p.x - A.x) > MUNDO.ativo || Math.abs(p.y - A.y) > MUNDO.ativo) continue;
    if (p.guardiao && A.mundo?.guardiaoEspera?.(p.fortaleza)) continue;      // baú vazio (ou guardião vencido há pouco): não nasce
    const d = dist(p, A);
    const covil = A.vm?.ativo && Math.hypot(p.x - A.vm.x, p.y - A.vm.y) < VILEMAW.semMonstros;      // perto da Vilemaw viva: sem monstros comuns
    if (d < MUNDO.ativo && d > (p.guardiao ? 1.2 : 3.5) && !covil) nascerNoPonto(estado, c, A, p);      // o guardião pode surgir mais perto (o planalto é pequeno)
  }
  if (sumir.size) c.inimigos = c.inimigos.filter((i) => !sumir.has(i.id));
}
// fora de combate o monstro passeia em volta de casa; perto do campeão (ou se apanhar) persegue; longe de casa desiste.
// Devolve true se ele está perseguindo o campeão.
function cerebroMundo(c, A, i, dt) {
  const vel = AR.velMonstro * (i.lento > 0 ? 0.55 : 1) * dt;
  const ir = (alvo, k) => { const n = dist(alvo, i); if (n > 0.05) { const p = Math.min(n, vel * k); moverMonstro(A, i, ((alvo.x - i.x) / n) * p, ((alvo.y - i.y) / n) * p); } };
  if (i.voltando) {
    ir(i.casa, 1.3);
    i.hp = Math.min(i.hpMax, i.hp + i.hpMax * 0.25 * dt);
    i.preso = (i.preso || 0) + dt;
    if (dist(i, i.casa) < 0.3 || i.preso > 6) { i.voltando = false; i.preso = 0; i.hp = i.hpMax; i.acumulos = 0; }
    return false;
  }
  const caido = c.darius.morto > 0;
  if (!i.aggro) {
    // quem passa montado não chama os monstros parados (a menos que bata neles)
    if (!caido && !A.cidade && ((!A.montado && dist(i, A) < MUNDO.aggro) || i.hp < i.hpMax)) i.aggro = true;
    else {
      i.vagar -= dt;
      if (i.vagar <= 0) { i.vagar = 2 + Math.random() * 4; const ang = Math.random() * Math.PI * 2, rr = Math.random() * 2.2; i.passeio = { x: i.casa.x + Math.cos(ang) * rr, y: i.casa.y + Math.sin(ang) * rr }; }
      if (i.passeio) { ir(i.passeio, 0.35); if (dist(i, i.passeio) < 0.1) i.passeio = null; }
      return false;
    }
  }
  if (caido || A.cidade || dist(i, i.casa) > MUNDO.leash) { i.aggro = false; i.voltando = true; i.passeio = null; return false; }
  return true;
}

function moverMonstros(estado, c, A, a, vivos, dt) {
  const isca = A.isca && A.isca.ate > (A.tempo || 0) ? A.isca : null;
  // Mitose (Zac): cada cópia chama a atenção dos monstros mais perto dela (até ZAC.mSegura cada, a até ZAC.mIsca tiles; o guardião não cai nessa)
  const presos = new Map();
  if (A.zacClones && A.zacClones.ate > (A.tempo || 0)) for (const p of A.zacClones.pts) {
    for (const i of vivos.filter((x) => !presos.has(x) && x.guardiao == null && dist(x, p) <= ZAC.mIsca).sort((x, y) => dist(x, p) - dist(y, p)).slice(0, ZAC.mSegura)) presos.set(i, p);
  }
  for (const i of vivos) {
    if (i.atordoado > 0) continue;
    if (A.mundo && i.casa && !cerebroMundo(c, A, i, dt)) continue;
    if (i.guardiao != null && pisaoGuardiao(estado, c, A, a, i, dt)) continue;
    // a cópia de energia do Ezreal atrai quem está perto dela (eles vão até ela e ficam lá, sem acertar o Ezreal)
    const foco = presos.get(i) || (isca && dist(i, isca) <= 5 ? isca : A);
    const d = dist(i, foco), alcance = (i.distancia || 0.9) + raioDe(i) * 0.5;
    if (d > alcance) {
      const vel = AR.velMonstro * (i.chefe ? 0.85 : 1) * (i.lento > 0 ? 0.55 : 1) * dt;
      moverMonstro(A, i, ((foco.x - i.x) / d) * vel, ((foco.y - i.y) / d) * vel);
    } else if (foco === A && !(i.surgindo > 0) && inimigoAtaca(estado, c, a, i, dt) && i.distancia) emitir(c, 'tiroMonstro', { alvo: i.id });
    if (c.darius.morto > 0) return;
  }
  // um não fica em cima do outro (nem em cima do campeão)
  for (let k = 0; k < vivos.length; k++) {
    const i = vivos[k];
    for (let j = k + 1; j < vivos.length; j++) {
      const o = vivos[j], d = dist(i, o), min = raioDe(i) + raioDe(o);
      if (d < min && d > 0.001) { const f = (min - d) / 2 / d; moverMonstro(A, i, (i.x - o.x) * f, (i.y - o.y) * f); moverMonstro(A, o, (o.x - i.x) * f, (o.y - i.y) * f); }
    }
    const d = dist(i, A), min = raioDe(i) + 0.35;
    if (d < min && d > 0.001) moverMonstro(A, i, ((i.x - A.x) / d) * (min - d), ((i.y - A.y) / d) * (min - d));
  }
}

// ---------- projéteis ----------
// tipo: para a cena desenhar; vel e alcance em tiles; aoAcertar(i) devolve true se o projétil para
function lancar(A, tipo, dir, { vel = 16, alcance = 7, raio = 0.35, aoAcertar, volta = false, de = A, tecla = null, aoAliado = null, aoVoltar = null, aoJogador = null }) {
  A.proj.push({ tipo, x: de.x, y: de.y, vx: dir.x * vel, vy: dir.y * vel, vel, alcance, raio, aoAcertar, volta, andou: 0, atingidos: new Set(), voltando: false,
    tecla, lance: A.lanceAtual, aoAliado, aoVoltar, aoJogador });
}
function moverProjeteis(c, A, vivos, dt) {
  A.proj = A.proj.filter((p) => {
    const passos = Math.ceil((p.vel * dt) / 0.25);
    for (let k = 0; k < passos; k++) {
      if (p.voltando) {         // volta para a mão do campeão
        const d = dist(p, A);
        if (d < 0.5) { p.aoVoltar?.(); return false; }
        p.vx = ((A.x - p.x) / d) * p.vel; p.vy = ((A.y - p.y) / d) * p.vel;
      }
      const x0 = p.x, y0 = p.y;
      p.x += (p.vx * dt) / passos; p.y += (p.vy * dt) / passos; p.andou += (p.vel * dt) / passos;
      if (!p.voltando) for (const w of A.paredesOutros || []) {
        const q = M.paredeBarra(w, { x: x0, y: y0 }, p);
        if (q) { emitir(c, 'ventoBarrou', { x: q.x, y: q.y, dx: w.dx, dy: w.dy, tipo: p.tipo, dono: w.dono }); return false; }
      }
      for (const i of vivos) {
        if (i.hp <= 0 || p.atingidos.has(i.id) || dist(p, i) > p.raio + raioDe(i)) continue;
        p.atingidos.add(i.id);
        if (p.aoAcertar(i) && !p.volta) return false;
      }
      if (p.tecla) for (const o of jogadoresAlvo(A)) {
        if (p.atingidos.has('j:' + o.nome) || dist(p, o) > p.raio + RAIO_JOG) continue;
        p.atingidos.add('j:' + o.nome);
        acertarJogador(c, A, o, p.tecla, p.lance);
        p.aoJogador?.(o);
        if (!p.volta) return false;
      }
      if (p.aoAliado) for (const o of A.outros) {            // membros do grupo tocados (na ida e de novo na volta)
        if (!o.mesmoGrupo || o.morto || p.atingidos.has('a:' + o.nome) || dist(p, o) > p.raio + RAIO_JOG) continue;
        p.atingidos.add('a:' + o.nome);
        p.aoAliado(o);
      }
      if (!p.voltando && p.andou >= p.alcance) {
        if (!p.volta) return false;
        p.voltando = true; p.atingidos.clear();
      }
    }
    return true;
  });
}
const depois = (A, t, f) => A.atrasos.push({ t, f });

// ---------- habilidades ----------
function habilidades(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, A, vivos, K } = ctx;
  const atirador = K.distancia;
  const perto = (raio, centro = A) => vivos.filter((i) => i.hp > 0 && dist(i, centro) <= raio + raioDe(i));
  // o monstro mais perto do mouse (ou do campeão) dentro do alcance
  const alvoNaMira = (alcance) => {
    const m = A.entrada.mira, cands = vivos.filter((i) => i.hp > 0 && dist(i, A) <= alcance + raioDe(i));
    if (!cands.length) return null;
    return cands.sort((x, y) => (m ? dist(x, m) - dist(y, m) : dist(x, A) - dist(y, A)))[0];
  };
  const olhar = (dir) => { A.olhar = { x: dir.x, y: dir.y, t: 0.35 }; };
  const jogPerto = (raio, centro = A) => jogadoresAlvo(A).filter((o) => dist(o, centro) <= raio + RAIO_JOG);
  const area = (t, dano, extra) => {
    const atingidos = perto(AR.area);
    for (const i of atingidos) { golpear(estado, c, adEfetivo, i, dano, t); extra?.(i); }
    for (const o of jogPerto(AR.area)) acertarJogador(c, A, o, t);
    return atingidos;
  };
  // o mais perto do mouse entre monstros e jogadores atacáveis (devolve { monstro } ou { jogador })
  const alvoNaMiraComJogadores = (alcance) => {
    const m = A.entrada.mira, ref = m || A;
    const cands = [...vivos.filter((i) => i.hp > 0 && dist(i, A) <= alcance + raioDe(i)).map((i) => ({ monstro: i, p: i })),
      ...jogadoresAlvo(A).filter((o) => dist(o, A) <= alcance + RAIO_JOG).map((o) => ({ jogador: o, p: o }))];
    return cands.sort((x, y) => dist(x.p, ref) - dist(y.p, ref))[0] || null;
  };
  const comum = {
    G() { d.grito = HK.G.duracao; d.gritoBonus = HK.G.bonus[r.G - 1]; return true; },
    B() { d.estandarte = HK.B.duracao; d.estandarteCura = HK.B.cura[r.B - 1]; return true; },
    F() {
      if (estado.vida <= a.vida * 0.1) return 'Vida baixa demais';
      estado.vida -= estado.vida * HK.F.custoVida; d.furiaS = HK.F.duracao; d.furiaRoubo = HK.F.roubo[r.F - 1]; return true;
    },
    T() {
      const at = area('T', HK.T.dano(r.T, adEfetivo), (i) => { i.lento = 2; });
      if (at.length) acertouHabilidade(estado, c);
      return true;
    },
    N() {
      const raio = atirador ? 6 : 5, lim = HK.N.limiar[r.N - 1], alvos = perto(raio);
      const fracos = alvos.filter((i) => !i.chefe && i.hp < i.hpMax * lim), chefes = alvos.filter((i) => i.chefe), jogs = jogPerto(raio);
      if (!fracos.length && !chefes.length && !jogs.length) return 'Nenhum monstro fraco por perto';
      for (const o of jogs) acertarJogador(c, A, o, 'N');
      for (const i of fracos) { emitir(c, 'dano', { alvo: i.id, valor: i.hp, fonte: 'N', verdadeiro: true }); i.hp = 0; }
      for (const i of chefes) { const g = HK.N.danoChefe(r.N, adEfetivo); if (i.externo) { golpear(estado, c, adEfetivo, i, g, 'N', { acumula: false }); continue; } i.hp -= g; emitir(c, 'dano', { alvo: i.id, valor: g, fonte: 'N', verdadeiro: true }); }
      return { alvos: [...fracos, ...chefes].map((i) => i.id) };
    },
  };
  const darius = {
    Q() {          // giro: acerta tudo em volta e cura por inimigo atingido
      const nj = jogPerto(AR.area).length, at = area('Q', HK.Q.dano(r.Q, adEfetivo));
      curar(estado, c, a, (a.vida - estado.vida) * 0.13 * Math.min(3, at.length + nj));      // cura também pelos jogadores atingidos
      return true;
    },
    W() { if (d.wPronto) return 'Já está pronto'; d.wPronto = true; d.ataque = Math.min(d.ataque, 0); A.lanceW = A.lanceAtual; return true; },
    E() {          // puxa quem estiver no cone na direção do mouse (sem mouse, em volta): cada um vem na própria linha até o Darius
      const dir = mirar(A), cone = dir.d ? Math.cos((55 * Math.PI) / 180) : -1;
      const noCone = (o, raio) => { const dx = o.x - A.x, dy = o.y - A.y, n = Math.hypot(dx, dy); return n <= 5.5 + raio && n > 0.01 && (dx * dir.x + dy * dir.y) / n > cone; };
      const puxados = vivos.filter((i) => i.hp > 0 && noCone(i, raioDe(i)));
      puxados.forEach((i) => {
        // o ponto final: a 1,1 tile do Darius, na linha do monstro; se ali não dá para pisar, o mais perto do Darius que der
        const dx = i.x - A.x, dy = i.y - A.y, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
        let fx = i.x, fy = i.y;
        for (let r2 = 1.1; r2 < n; r2 += 0.25) { const x = A.x + ux * r2, y = A.y + uy * r2; if (pisaMonstro(A, i, x, y)) { fx = x; fy = y; break; } }
        const sx = i.x, sy = i.y;
        for (let k = 1; k <= 5; k++) depois(A, k * 0.05, () => { if (i.hp > 0) { i.x = sx + ((fx - sx) * k) / 5; i.y = sy + ((fy - sy) * k) / 5; } });     // desliza em 0,25 s
        i.lento = 2; i.atordoado = Math.max(i.atordoado || 0, 0.3);
      });
      for (const o of jogadoresAlvo(A)) if (noCone(o, RAIO_JOG)) acertarJogador(c, A, o, 'E');
      olhar(dir);
      return { alvos: puxados.map((i) => i.id), dir };
    },
    R() {          // salta no monstro (ou jogador) mais perto do mouse e executa
      const escolha = alvoNaMiraComJogadores(3.5);
      if (!escolha) return 'Nenhum alvo ao alcance';
      if (escolha.jogador) {
        const o = escolha.jogador, n = dist(o, A) || 1, dir = { x: (o.x - A.x) / n, y: (o.y - A.y) / n };
        const ponto = ateOnde(A, A, dir, Math.max(0, n - 0.8)); A.x = ponto.x; A.y = ponto.y; olhar(dir);
        acertarJogador(c, A, o, 'R');
        return { jogador: o.nome };
      }
      const alvo = escolha.monstro;
      const golpe = HK.R.dano(r.R, adEfetivo, alvo.acumulos), matou = golpe >= alvo.hp;
      const n = dist(alvo, A) || 1, dir = { x: (alvo.x - A.x) / n, y: (alvo.y - A.y) / n };
      const ponto = ateOnde(A, A, dir, Math.max(0, n - 0.8)); A.x = ponto.x; A.y = ponto.y; olhar(dir);
      if (alvo.externo) { golpear(estado, c, adEfetivo, alvo, golpe, 'R', { acumula: false }); return {}; }      // Vilemaw / monstro de outro jogador: o servidor calcula
      if (alvo.surgindo > 0) return {};      // ainda surgindo: nada acerta
      if (alvo.surgindo > 0) return {};      // ainda surgindo: nada acerta
      alvo.hp -= golpe;
      emitir(c, 'dano', { alvo: alvo.id, valor: golpe, fonte: 'R', verdadeiro: true });
      aplicarHemorragia(c, alvo);
      return { recarga: matou ? 0.6 : undefined };       // o abate reinicia a Guilhotina (também nos chefes e guardiões)
    },
    A() {          // investida na direção do mouse: o primeiro monstro no caminho leva dano e fica atordoado
      const dir = mirar(A), max = 4;
      let alvo = null, ate = max;
      for (const i of vivos) {
        if (i.hp <= 0) continue;
        const px = i.x - A.x, py = i.y - A.y, ao = px * dir.x + py * dir.y, lado = Math.abs(px * dir.y - py * dir.x);
        if (ao > 0 && ao < ate + raioDe(i) && lado < 0.6 + raioDe(i)) { alvo = i; ate = Math.max(0, ao - 0.8); }
      }
      let jog = null;
      for (const o of jogadoresAlvo(A)) {
        const px = o.x - A.x, py = o.y - A.y, ao = px * dir.x + py * dir.y, lado = Math.abs(px * dir.y - py * dir.x);
        if (ao > 0 && ao < ate + RAIO_JOG && lado < 0.6 + RAIO_JOG) { jog = o; alvo = null; ate = Math.max(0, ao - 0.8); }
      }
      const ponto = ateOnde(A, A, dir, ate); A.x = ponto.x; A.y = ponto.y; olhar(dir);
      if (alvo) { alvo.atordoado = 1; golpear(estado, c, adEfetivo, alvo, HK.A.dano(r.A, adEfetivo), 'A'); }
      if (jog) acertarJogador(c, A, jog, 'A');
      return { alvo: alvo?.id, dir };
    },
    M() {          // Ruptura Noxiana: fenda em linha reta na direção do mouse
      const dir = mirar(A), comp = 6, larg = 0.9, lance = A.lanceAtual;
      const naLinha = (p, raio) => { const px = p.x - A.x, py = p.y - A.y, ao = px * dir.x + py * dir.y; return ao > -0.3 && ao < comp && Math.abs(px * dir.y - py * dir.x) < larg + raio; };
      const atingidos = vivos.filter((i) => i.hp > 0 && naLinha(i, raioDe(i)));
      for (const i of atingidos) {
        const sangra = i.acumulos > 0;
        golpear(estado, c, adEfetivo, i, HK.M.dano(r.M, adEfetivo) * (sangra ? 1 + HK.M.bonusSangue : 1), 'M');
        i.atordoado = Math.max(i.atordoado || 0, HK.M.atordoa);
      }
      for (const o of jogadoresAlvo(A)) if (naLinha(o, RAIO_JOG)) acertarJogador(c, A, o, 'M', lance);
      olhar(dir);
      return { dir, comp };
    },
    F() {          // Banho de Sangue
      if (estado.vida <= a.vida * 0.1) return 'Vida baixa demais';
      estado.vida -= estado.vida * HK.F.custoVida;
      d.banho = HK.F.duracao; d.furiaS = HK.F.duracao; d.furiaRoubo = 0;
      return true;
    },
    T() {          // Pisotear com área grande
      const raio = HK.T.raioArena || 2.4, at = perto(raio);
      for (const i of at) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T'); i.lento = 2; }
      for (const o of jogPerto(raio)) acertarJogador(c, A, o, 'T');
      return { alvos: at.map((i) => i.id), raio };
    },
    B() {          // Estandarte de Noxus: armadura e resistência mágica
      d.estandarte = HK.B.duracao; d.estandarteCura = 0; d.estandarteDef = HK.B.defesaBonus[r.B - 1];
      return true;
    },
    N() {          // Domínio de Noxus: território em volta de onde o machado foi fincado, por 10 s
      const zona = { x: A.x, y: A.y, raio: 3.5, ate: (A.tempo || 0) + HK.N.duracao }, lance = A.lanceAtual, atingiu = new Set();
      A.dominio = zona;
      const marcados = new Set();
      const pulso = (k) => {
        for (const i of perto(zona.raio, zona)) {
          marcados.add(i);
          i.dominioT = (i.dominioT || 0) + 0.5;
          i.dominioAmp = Math.min(HK.N.ampMax, (i.dominioT / 6) * HK.N.ampMax);
          i.lento = Math.max(i.lento || 0, 0.6);
          golpear(estado, c, adEfetivo, i, HK.N.dano(r.N, adEfetivo), 'N');
          if (i.hp <= 0) {                       // morreu no território: a área cresce e o Darius recupera vida
            curar(estado, c, a, (a.vida - estado.vida) * HK.N.curaAbate);
            zona.raio = Math.min(5.5, zona.raio + 0.5);
            emitir(c, 'dominioCresce', { raio: zona.raio, x: zona.x, y: zona.y });
          }
        }
        for (const o of jogPerto(zona.raio, zona)) if (!atingiu.has(o.nome)) { atingiu.add(o.nome); acertarJogador(c, A, o, 'N', lance); }
        if (k < 19) depois(A, 0.5, () => pulso(k + 1));
        else { for (const i of marcados) { i.dominioAmp = 0; i.dominioT = 0; } }
      };
      depois(A, 0.25, () => pulso(0));
      return { x: zona.x, y: zona.y, raio: zona.raio, duracao: HK.N.duracao };
    },
  };
  const ezreal = {
    Q() {          // disparo místico: o primeiro monstro atingido leva o dano e as outras recargas diminuem
      const dir = mirar(A), lam = (d.trindade || 0) * a.baseAd; d.trindade = 0;      // a Lâmina Encantada da habilidade anterior vai no disparo (p629)
      lancar(A, 'Q', dir, { tecla: 'Q', vel: 18, alcance: 7.5, raio: 0.35, aoAcertar: (i) => {
        golpear(estado, c, adEfetivo, i, HK.Q.dano(r.Q, adEfetivo) + lam, 'Q', { acumula: false });
        if (i.marca > 0) detonarOrbe(ctx, i);
        for (const t of Object.keys(d.recargas)) if (t !== 'Q') d.recargas[t] = Math.max(0, d.recargas[t] - HK.Q.reduz);
        acertouHabilidade(estado, c);
        return true;
      } });
      olhar(dir);
      return { dir };
    },
    W() {          // orbe: gruda no primeiro monstro; o próximo acerto nele detona
      const dir = mirar(A);
      lancar(A, 'W', dir, { tecla: 'W', vel: 14, alcance: 7.5, raio: 0.4, aoAcertar: (i) => { i.marca = 4; acertouHabilidade(estado, c); emitir(c, 'orbePreso', { alvo: i.id }); return true; } });
      olhar(dir);
      return { dir };
    },
    E() {          // teletransporte na direção do mouse e um raio no monstro mais perto (de preferência o marcado)
      const dir = mirar(A), de = { x: A.x, y: A.y }, para = ateOnde(A, A, dir, Math.min(3.5, dir.d || 3.5));
      A.x = para.x; A.y = para.y;
      const cands = perto(6).sort((x, y) => (y.marca > 0) - (x.marca > 0) || dist(x, A) - dist(y, A));
      const jog = jogPerto(6).sort((x, y) => dist(x, A) - dist(y, A))[0];
      const mira = jog && (!cands[0] || dist(jog, A) < dist(cands[0], A)) ? null : cands[0];
      if (!mira && jog) { acertarJogador(c, A, jog, 'E'); acertouHabilidade(estado, c); return { alvoJogador: jog.nome, de, para: { ...para } }; }
      if (mira) {
        golpear(estado, c, adEfetivo, mira, HK.E.dano(r.E, adEfetivo), 'E', { acumula: false });
        if (mira.marca > 0) detonarOrbe(ctx, mira);
        acertouHabilidade(estado, c);
      }
      return { alvo: mira?.id, de, para: { ...para } };
    },
    R() {          // carrega a luva por 1s, parado, e solta a onda na direção que estava mirando
      d.canalR = M.CANAL_R; A.dirR = mirar(A); olhar(A.dirR); A.lanceR = A.lanceAtual;
      return { canal: M.CANAL_R };
    },
    G() { d.arrogancia = HK.G.duracao; d.arrogExtra = 0; d.arrogBonus = HK.G.bonusHab[r.G - 1]; return true; },
    A() {          // Tiro de Precisão: muito rápido, atravessa até 4 monstros; o primeiro leva mais e fica atordoado
      const dir = mirar(A), bruto = HK.A.dano(r.A, adEfetivo);
      let n = 0;
      lancar(A, 'precisao', dir, { tecla: 'A', vel: 30, alcance: 8, raio: 0.35, aoAcertar: (i) => {
        const primeiro = n === 0; n++;
        if (primeiro) i.atordoado = Math.max(i.atordoado || 0, 1);
        golpear(estado, c, adEfetivo, i, bruto * (primeiro ? 1 + HK.A.primeiro : 1), 'A', { acumula: false });
        if (i.marca > 0) detonarOrbe(ctx, i);
        if (primeiro) acertouHabilidade(estado, c);
        return n > HK.A.atravessa;
      } });
      olhar(dir);
      return { dir };
    },
    F() { d.sobrecarga = HK.F.duracao; return true; },
    T() {          // Descarga Shurimane: a carga cai no ponto do mouse (até 7 tiles), quebra e solta bolinhas que quicam em volta
      const dir = mirar(A), alc = Math.min(HK.T.alcance, dir.d ?? 4), ponto = { x: A.x + dir.x * alc, y: A.y + dir.y * alc }, lance = A.lanceAtual, bruto = HK.T.dano(r.T, adEfetivo);
      const n = HK.T.bolinhas, gira = Math.random() * Math.PI * 2;
      const bolas = Array.from({ length: n }, (_, k) => { const a2 = gira + (k / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, rr = 1.3 + Math.random() * 1.2; return { x: +(ponto.x + Math.cos(a2) * rr).toFixed(2), y: +(ponto.y + Math.sin(a2) * rr * 0.8).toFixed(2) }; });
      depois(A, 0.35, () => {
        const at = perto(HK.T.raio, ponto);
        for (const i of at) { golpear(estado, c, adEfetivo, i, bruto, 'T', { acumula: false }); if (i.marca > 0) detonarOrbe(ctx, i); }
        for (const o of jogPerto(HK.T.raio, ponto)) acertarJogador(c, A, o, 'T', lance);
        if (at.length) acertouHabilidade(estado, c);
        bolas.forEach((b, k) => depois(A, 0.25 + k * 0.05, () => { for (const i of perto(0.8, b)) golpear(estado, c, adEfetivo, i, bruto * HK.T.bolinha, 'T', { acumula: false, frac: HK.T.bolinha }); }));
      });
      olhar(dir);
      return { ponto: { x: +ponto.x.toFixed(2), y: +ponto.y.toFixed(2) }, bolas };
    },
    B() {          // Passagem Shurimane: 1º aperto abre o portal no ponto mirado; o 2º (depois de meio segundo) atravessa e dispara
      if (A.portal && A.portal.ate > A.tempo) {
        if (A.tempo < A.portal.pronto) return 'O portal ainda está abrindo';
        const de = { x: A.x, y: A.y }, para = { x: A.portal.x, y: A.portal.y };
        A.x = para.x; A.y = para.y; A.portal = null; A.destino = null; A.caminho = null;
        A.isca = { x: de.x, y: de.y, ate: A.tempo + HK.B.isca, prox: A.tempo + 0.4 };          // a cópia de energia fica no lugar de onde ele saiu
        const mons = perto(7).sort((x, y) => (y.marca > 0) - (x.marca > 0) || dist(x, A) - dist(y, A))[0];
        const jog = jogPerto(7).sort((x, y) => dist(x, A) - dist(y, A))[0];
        if (jog && (!mons || dist(jog, A) < dist(mons, A))) { acertarJogador(c, A, jog, 'B'); acertouHabilidade(estado, c); return { atravessa: true, de, para, alvoJogador: jog.nome }; }
        if (mons) {
          golpear(estado, c, adEfetivo, mons, HK.B.dano(r.B, adEfetivo), 'B', { acumula: false });
          if (mons.marca > 0) detonarOrbe(ctx, mons);
          acertouHabilidade(estado, c);
        }
        return { atravessa: true, de, para, alvo: mons?.id };
      }
      const dir = mirar(A), alc = Math.min(HK.B.alcance, dir.d || 5);
      let px = A.x + dir.x * alc, py = A.y + dir.y * alc;
      for (let k = alc; k > 0.5 && !podePisar(A, px, py); k -= 0.25) { px = A.x + dir.x * k; py = A.y + dir.y * k; }
      if (!podePisar(A, px, py) || (cidadeAqui(A, px, py) && !cidadeAqui(A, A.x, A.y))) return 'Não dá para abrir o portal ali';
      A.portal = { x: +px.toFixed(2), y: +py.toFixed(2), pronto: A.tempo + 0.5, ate: A.tempo + HK.B.portal, recarga: HK.B.recarga[r.B - 1] * (1 - a.reducaoRecarga) };
      olhar(dir);
      return { abre: true, portal: { x: A.portal.x, y: A.portal.y }, duracao: HK.B.portal, recarga: 0.5 };
    },
    M() {          // Tiro do Explorador: o disparo pula para o monstro mais perto (até 4 tiles), cada salto 15% mais forte
      const dir = mirar(A), bruto0 = HK.M.dano(r.M, adEfetivo), ja = new Set();
      const saltar = (i, k) => {
        if (i.hp <= 0) {                   // morreu no caminho: segue para o mais perto dele
          const outro = vivos.filter((o) => o.hp > 0 && o !== i && dist(o, i) <= 4).sort((x, y) => dist(x, i) - dist(y, i))[0];
          if (!outro) return;
          i = outro;
        }
        ja.add(i.id);
        const bruto = bruto0 * (1 + HK.M.cresce) ** k;
        golpear(estado, c, adEfetivo, i, bruto, 'M', { acumula: false, frac: (1 + HK.M.cresce) ** k });
        if (i.marca > 0) detonarOrbe(ctx, i);
        if (k === 0) acertouHabilidade(estado, c);
        const cands = k < HK.M.saltos ? vivos.filter((o) => o.hp > 0 && o !== i && dist(o, i) <= 4) : [];
        const prox = cands.sort((x, y) => ja.has(x.id) - ja.has(y.id) || dist(x, i) - dist(y, i))[0];
        if (prox) { emitir(c, 'ricochete', { de: i.id, para: prox.id, k: k + 1 }); depois(A, 0.12, () => saltar(prox, k + 1)); }
        else if (i.chefe) {
          emitir(c, 'ricocheteExplode', { alvo: i.id });
          for (const o of perto(2, i)) golpear(estado, c, adEfetivo, o, bruto * HK.M.explosao, 'M', { acumula: false, frac: (1 + HK.M.cresce) ** k * HK.M.explosao });
        }
      };
      lancar(A, 'ricochete', dir, { tecla: 'M', vel: 20, alcance: 7.5, raio: 0.35, aoAcertar: (i) => { saltar(i, 0); return true; } });
      olhar(dir);
      return { dir };
    },
    N() {          // Apogeu da Manopla: salta, cai com uma onda de choque que joga os monstros longe e entra em Sobrecarga por 10 s
      d.apogeu = HK.N.duracao;
      estado.mana = Math.min(a.mana, estado.mana + a.mana * HK.N.manaVolta[r.N - 1]);
      const lance = A.lanceAtual, imp = HK.N.impacto(r.N, adEfetivo), raio = HK.N.raioArena;
      depois(A, 0.6, () => {
        for (const i of perto(raio)) {
          golpear(estado, c, adEfetivo, i, imp, 'N', { acumula: false });
          if (i.chefe || i.guardiao != null) continue;
          const dd = dist(i, A) || 0.01, ux = (i.x - A.x) / dd || 1, uy = (i.y - A.y) / dd;
          for (let k = 0; k < HK.N.empurraArena; k += 0.25) moverMonstro(A, i, ux * 0.25, uy * 0.25);
          i.atordoado = Math.max(i.atordoado || 0, 0.3);
        }
        for (const o of jogPerto(raio)) acertarJogador(c, A, o, 'N', lance);
      });
      return { duracao: HK.N.duracao, raio };
    },
  };
  const lux = {
    Q() {          // Ligação da Luz: a esfera prende os 2 primeiros monstros que atravessar
      const dir = mirar(A);
      let presos = 0;
      lancar(A, 'luxQ', dir, { tecla: 'Q', vel: 15, alcance: 7.5, raio: 0.4, aoAcertar: (i) => {
        if (i.marca > 0) detonarOrbe(ctx, i);
        golpear(estado, c, adEfetivo, i, HK.Q.dano(r.Q, adEfetivo), 'Q', { acumula: false });
        i.atordoado = Math.max(i.atordoado || 0, HK.Q.prende); iluminar(estado, i);
        emitir(c, 'luzPrende', { alvo: i.id });
        return ++presos >= 2;
      } });
      olhar(dir);
      return { dir };
    },
    W() {          // Barreira Prismática: a varinha vai e volta; escudo na Lux na hora e de novo quando ela volta, e em quem do grupo ela tocar
      const dir = mirar(A), v = HK.W.escudo(r.W, a), lance = A.lanceAtual;
      d.escudo = Math.max(d.escudo || 0, v);
      lancar(A, 'varinha', dir, { vel: 12, alcance: 7, raio: 0.6, volta: true, aoAcertar: () => false,
        aoAliado: (o) => emitir(c, 'escudoAliado', { nome: o.nome, lance }),
        aoVoltar: () => { d.escudo = Math.min(2 * v, (d.escudo || 0) + v); emitir(c, 'varinhaVolta', { escudo: Math.round(v) }); } });
      olhar(dir);
      return { dir, escudo: Math.round(v) };
    },
    E() {          // Singularidade Lucente: cai onde está o mouse (até 7 tiles), deixa lento e explode 0,6s depois
      const dir = mirar(A), alc = Math.min(7, dir.d ?? 4), ponto = { x: A.x + dir.x * alc, y: A.y + dir.y * alc }, lance = A.lanceAtual;
      for (const i of perto(2.2, ponto)) i.lento = 2;
      depois(A, 0.6, () => {
        for (const i of perto(2.2, ponto)) {
          if (i.marca > 0) detonarOrbe(ctx, i);
          golpear(estado, c, adEfetivo, i, HK.E.dano(r.E, adEfetivo), 'E', { acumula: false }); i.lento = 2; iluminar(estado, i);
        }
        for (const o of jogPerto(2.2, ponto)) acertarJogador(c, A, o, 'E', lance);
        emitir(c, 'singularidade', { x: ponto.x, y: ponto.y });
      });
      olhar(dir);
      return { ponto };
    },
    R() {          // Centelha Final: mira por meio segundo, parada, e solta o raio na direção escolhida
      d.canalR = M.CANAL_LUX; A.dirR = mirar(A); olhar(A.dirR); A.lanceR = A.lanceAtual;
      return { canal: M.CANAL_LUX };
    },
    A() {          // Lança de Luz: atravessa os monstros e acerta todos na linha (sem atordoar)
      const dir = mirar(A);
      lancar(A, 'gelo', dir, { tecla: 'A', vel: 18, alcance: 7.5, raio: 0.4, aoAcertar: (i) => {
        if (i.marca > 0) detonarOrbe(ctx, i);
        golpear(estado, c, adEfetivo, i, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
        iluminar(estado, i);
        return false;
      } });
      olhar(dir);
      return { dir };
    },
    F() {          // Prisma Regenerador: cura na hora
      curar(estado, c, a, a.vida * HK.F.curaPct[r.F - 1] + HK.F.curaPoder * (a.ap || 0));
      return true;
    },
    T() {          // Convergência Radiante: a energia junta no chão onde a Lux está e explode depois de um instante
      const centro = { x: A.x, y: A.y }, lance = A.lanceAtual;
      depois(A, HK.T.espera, () => {
        const presos = perto(2.4, centro);
        for (const i of presos) {
          if (i.marca > 0) detonarOrbe(ctx, i);
          golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false });
          i.atordoado = Math.max(i.atordoado || 0, HK.T.prende); iluminar(estado, i);
        }
        for (const o of jogPerto(2.4, centro)) acertarJogador(c, A, o, 'T', lance);
        emitir(c, 'convergencia', { alvos: presos.map((i) => i.id), x: centro.x, y: centro.y });
      });
      return { espera: HK.T.espera, x: centro.x, y: centro.y };
    },
    B() {          // Farol de Demacia: mana e Poder de Habilidade por 10 s
      d.estandarte = HK.B.duracao; d.estandarteCura = 0; d.farolMana = HK.B.manaSeg;
      d.farol = HK.B.duracao; d.farolPoder = HK.B.poderBonus[r.B - 1];
      return true;
    },
    M() {          // Chuva de Luz: 3 raios de luz caem em volta do ponto mirado (nos monstros que estão lá) e explodem
      const dir = mirar(A), alc = Math.min(7, dir.d ?? 4), ponto = { x: A.x + dir.x * alc, y: A.y + dir.y * alc }, lance = A.lanceAtual, bruto = HK.M.dano(r.M, adEfetivo);
      const alvos = perto(2.5, ponto), quedas = [];
      for (let k = 0; k < HK.M.meteoros; k++) {
        const i = alvos[k % Math.max(1, alvos.length)];
        const onde = i ? { x: i.x, y: i.y } : { x: ponto.x + (Math.random() - 0.5) * 3, y: ponto.y + (Math.random() - 0.5) * 2 };
        const q = { x: +onde.x.toFixed(2), y: +onde.y.toFixed(2), t: 0.45 + k * 0.3 };
        quedas.push(q);
        depois(A, q.t, () => {
          const atingidos = perto(1.3, q);
          for (const o of atingidos) { golpear(estado, c, adEfetivo, o, i && o === i ? bruto : bruto * HK.M.respingo, 'M', { acumula: false, frac: i && o === i ? 1 : HK.M.respingo }); iluminar(estado, o); }
          for (const o of jogPerto(1.3, q)) acertarJogador(c, A, o, 'M', lance);
        });
      }
      olhar(dir);
      return { ponto, quedas };
    },
    N() {          // Furacão de Luz: anda 3 tiles/s na direção mirada por 3 s, puxa os monstros e queima a cada meio segundo
      const dir = mirar(A), lance = A.lanceAtual, bruto = HK.N.dano(r.N, adEfetivo), tor = { x: A.x + dir.x * 1.2, y: A.y + dir.y * 1.2 }, atingiu = new Set();
      const queimar = (k) => {
        for (const i of perto(1.7, tor)) {
          const dd = dist(i, tor) || 1;
          moverMonstro(A, i, ((tor.x - i.x) / dd) * Math.min(0.35, dd), ((tor.y - i.y) / dd) * Math.min(0.35, dd));
          golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false }); i.lento = Math.max(i.lento || 0, 0.6);
        }
        for (const o of jogPerto(1.7, tor)) if (!atingiu.has(o.nome)) { atingiu.add(o.nome); acertarJogador(c, A, o, 'N', lance); }
        tor.x += dir.x * 1.5; tor.y += dir.y * 1.5;
        if (k < 5) depois(A, 0.5, () => queimar(k + 1));
      };
      depois(A, 0.25, () => queimar(0));
      olhar(dir);
      return { dir, x0: tor.x, y0: tor.y, vel: 3, duracao: 3 };
    },
  };
  // Yasuo: estocada e tornado (Q), parede de vento (W), avanço através do monstro (E), Último Suspiro em quem está no ar (R)
  const yasuo = {
    Q() {
      const dir = mirar(A), h = HK.Q, bruto = h.dano(r.Q, adEfetivo), lance = A.lanceAtual, crit = () => Math.random() < a.critico;
      const recarga = M.recargaQYasuo(h, r.Q, a.velAtaque, d.ventania > 0 ? d.ventaniaVa : 0);
      const ganhar = () => { d.qCarga = Math.min(h.cargas, (d.qCarga || 0) + 1); d.qCargaT = 6; };
      if (A.eDash > A.tempo) {                      // logo depois da Espada Ágil: corta em volta; com o tornado carregado, o EQ joga todos em volta para o alto
        const at = perto(2.2), eq = (d.qCarga || 0) >= h.cargas;
        for (const i of at) { golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false, critico: crit() }); if (eq) M.levantar(i, h.levanta); }
        const jq = jogPerto(2.2);
        for (const o of jq) { acertarJogador(c, A, o, 'Q', lance); if (eq) (A.levantados ??= {})[o.nome] = A.tempo + 1.2; }
        if (eq) d.qCarga = 0; else if (at.length || jq.length) ganhar();
        return { giro: true, recarga, alvos: at.map((i) => i.id), ...(eq ? { tornado: true } : {}) };
      }
      if ((d.qCarga || 0) >= h.cargas) {            // tornado: atravessa e joga todos para o alto
        d.qCarga = 0;
        lancar(A, 'tornado', dir, { tecla: 'Q', vel: 11, alcance: 9, raio: 0.65, aoAcertar: (i) => {
          golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false, critico: crit() }); M.levantar(i, h.levanta);
          return false;
        }, aoJogador: (o) => { (A.levantados ??= {})[o.nome] = A.tempo + 1.2; } });      // jogador no ar: o Último Suspiro pega nele
        olhar(dir);
        return { dir, tornado: true, recarga };
      }
      // estocada: acerta tudo na linha à frente
      const comp = 4.5, larg = 0.6;
      const naLinha = (p, raio) => { const px = p.x - A.x, py = p.y - A.y, ao = px * dir.x + py * dir.y; return ao > -0.3 && ao < comp && Math.abs(px * dir.y - py * dir.x) < larg + raio; };
      const at = vivos.filter((i) => i.hp > 0 && naLinha(i, raioDe(i)));
      for (const i of at) golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false, critico: crit() });
      const jq = jogadoresAlvo(A).filter((o) => naLinha(o, RAIO_JOG));
      for (const o of jq) acertarJogador(c, A, o, 'Q', lance);
      if (at.length || jq.length) ganhar();          // acertar jogador também carrega o tornado (antes só monstro: na Arena ele nunca saía)
      olhar(dir);
      return { dir, carga: d.qCarga || 0, recarga };
    },
    W() {          // Parede de Vento: na frente do Yasuo, por 4 s (bloqueia quem atira de longe e diminui os outros golpes)
      const dir = mirar(A);
      d.vento = HK.W.duracao; d.ventoRed = HK.W.reducao[r.W - 1];
      A.parede = { x: A.x + dir.x * 1.4, y: A.y + dir.y * 1.4, dir: { x: dir.x, y: dir.y }, ate: A.tempo + HK.W.duracao };
      d.parede = { x: A.parede.x, y: A.parede.y, dx: dir.x, dy: dir.y };       // o motor confere o que bate nela (M.ventoSegura)
      olhar(dir);
      return { dir, duracao: HK.W.duracao, x: A.parede.x, y: A.parede.y };
    },
    E() {          // Espada Ágil: atravessa o monstro (ou jogador) mais perto do mouse; o mesmo monstro só de novo depois de 6 s
      const m = A.entrada.mira, ref = m || A, h = HK.E;
      const cands = [...vivos.filter((i) => i.hp > 0 && !(i.eAteA > A.tempo) && dist(i, A) <= 4.5 + raioDe(i)).map((i) => ({ monstro: i, p: i })),
        ...jogadoresAlvo(A).filter((o) => dist(o, A) <= 4.5 + RAIO_JOG).map((o) => ({ jogador: o, p: o }))];
      const escolha = cands.sort((x, y) => dist(x.p, ref) - dist(y.p, ref))[0];
      if (!escolha) return 'Nenhum alvo ao alcance';
      const o = escolha.p, n = dist(o, A) || 1, dir = { x: (o.x - A.x) / n, y: (o.y - A.y) / n };
      const ponto = ateOnde(A, A, dir, n + 1.2); A.x = ponto.x; A.y = ponto.y; olhar(dir);
      A.eDash = A.tempo + 0.5;
      if (escolha.jogador) { acertarJogador(c, A, escolha.jogador, 'E'); return { jogador: escolha.jogador.nome, dir }; }
      const i = escolha.monstro; i.eAteA = A.tempo + h.mesmoAlvo;
      golpear(estado, c, adEfetivo, i, h.dano(r.E, adEfetivo) * (1 + h.acumula * (d.eAcum || 0)), 'E', { acumula: false, magico: true, frac: 1 + h.acumula * (d.eAcum || 0) });
      d.eAcum = Math.min(h.acumMax, (d.eAcum || 0) + 1); d.eAcumT = 5;
      return { alvo: i.id, dir };
    },
    R() {          // Último Suspiro: aparece em quem está no ar (monstro ou jogador que ele jogou para o alto) e segura todos lá
      const noAr = vivos.filter((i) => i.hp > 0 && i.noAr > 0 && dist(i, A) <= 8 + raioDe(i));
      const jogs = jogadoresAlvo(A).filter((o) => (A.levantados?.[o.nome] || 0) > A.tempo && dist(o, A) <= 8 + RAIO_JOG);
      if (!noAr.length && !jogs.length) return 'Ninguém no ar';
      const m = A.entrada.mira || A, foco = [...noAr, ...jogs].sort((x, y) => dist(x, m) - dist(y, m))[0];
      const n = dist(foco, A) || 1, dir = { x: (foco.x - A.x) / n, y: (foco.y - A.y) / n };
      const ponto = ateOnde(A, A, dir, Math.max(0, n - 0.8)); A.x = ponto.x; A.y = ponto.y; olhar(dir);
      const bruto = HK.R.dano(r.R, adEfetivo), pegos = noAr.filter((i) => dist(i, foco) <= 3.2 + raioDe(i));
      for (const i of pegos) { golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false, critico: Math.random() < a.critico }); M.levantar(i, i.noAr + HK.R.segura); }
      for (const o of jogs) if (dist(o, foco) <= 3.2 + RAIO_JOG) acertarJogador(c, A, o, 'R');
      d.suspiro = HK.R.duracaoPen; d.suspiroPen = HK.R.penSuspiro;
      return { alvos: pegos.map((i) => i.id), x: foco.x, y: foco.y };
    },
    A() {          // Investida do Vendaval: corre na direção do mouse; o primeiro no caminho leva o corte e sobe
      const dir = mirar(A), max = 4;
      let alvo = null, ate = max;
      for (const i of vivos) {
        if (i.hp <= 0) continue;
        const px = i.x - A.x, py = i.y - A.y, ao = px * dir.x + py * dir.y, lado = Math.abs(px * dir.y - py * dir.x);
        if (ao > 0 && ao < ate + raioDe(i) && lado < 0.6 + raioDe(i)) { alvo = i; ate = Math.max(0, ao - 0.8); }
      }
      let jog = null;
      for (const o of jogadoresAlvo(A)) {
        const px = o.x - A.x, py = o.y - A.y, ao = px * dir.x + py * dir.y, lado = Math.abs(px * dir.y - py * dir.x);
        if (ao > 0 && ao < ate + RAIO_JOG && lado < 0.6 + RAIO_JOG) { jog = o; alvo = null; ate = Math.max(0, ao - 0.8); }
      }
      const ponto = ateOnde(A, A, dir, ate); A.x = ponto.x; A.y = ponto.y; olhar(dir);
      if (alvo) { golpear(estado, c, adEfetivo, alvo, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false, critico: Math.random() < a.critico }); M.levantar(alvo, HK.A.levanta); }
      if (jog) { acertarJogador(c, A, jog, 'A'); (A.levantados ??= {})[jog.nome] = A.tempo + 1.2; }
      return { alvo: alvo?.id, dir };
    },
    G() { d.ventania = HK.G.duracao; d.ventaniaVa = HK.G.va[r.G - 1]; return true; },
    B() { const v = a.vida * HK.B.escudoPct[r.B - 1]; d.escudo = Math.max(d.escudo || 0, v); return { escudo: Math.round(v) }; },
    F() { d.fantasma = HK.F.duracao; d.fantasmaPct = HK.F.pctCorte[r.F - 1]; return true; },
    T() {          // Furacão Cortante: todos em volta sobem
      const raio = HK.T.raioArena, at = perto(raio);
      for (const i of at) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false, critico: Math.random() < a.critico }); M.levantar(i, HK.T.levanta); }
      for (const o of jogPerto(raio)) { acertarJogador(c, A, o, 'T'); (A.levantados ??= {})[o.nome] = A.tempo + 0.95; }
      return { alvos: at.map((i) => i.id), raio };
    },
    M() {          // Lâmina do Vendaval: corte em linha reta, todos na linha sobem
      const dir = mirar(A), comp = 6, larg = 1, lance = A.lanceAtual;
      const naLinha = (p, raio) => { const px = p.x - A.x, py = p.y - A.y, ao = px * dir.x + py * dir.y; return ao > -0.3 && ao < comp && Math.abs(px * dir.y - py * dir.x) < larg + raio; };
      const at = vivos.filter((i) => i.hp > 0 && naLinha(i, raioDe(i)));
      for (const i of at) { golpear(estado, c, adEfetivo, i, HK.M.dano(r.M, adEfetivo), 'M', { acumula: false, critico: Math.random() < a.critico }); M.levantar(i, HK.M.levanta); }
      for (const o of jogadoresAlvo(A)) if (naLinha(o, RAIO_JOG)) { acertarJogador(c, A, o, 'M', lance); (A.levantados ??= {})[o.nome] = A.tempo + 0.95; }
      olhar(dir);
      return { dir, comp };
    },
    N() {          // Dança das Mil Lâminas: 10 cortes em 2,5 s nos monstros em volta, sem poder ser acertado
      const h = HK.N, bruto = h.dano(r.N, adEfetivo), lance = A.lanceAtual, atingiu = new Set(), cada = h.duracao / h.golpes;
      d.invulneravel = Math.max(d.invulneravel || 0, h.duracao);
      const corte = (k) => {
        const vs = perto(4), i = vs[Math.floor(Math.random() * vs.length)];
        if (i) { golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false, critico: Math.random() < a.critico }); emitir(c, 'dancaCorte', { alvo: i.id }); }
        for (const o of jogPerto(4)) if (!atingiu.has(o.nome)) { atingiu.add(o.nome); acertarJogador(c, A, o, 'N', lance); }
        if (k + 1 < h.golpes) depois(A, cada, () => corte(k + 1));
      };
      depois(A, 0.1, () => corte(0));
      return { duracao: h.duracao, x: A.x, y: A.y };
    },
  };
  // Katarina: as adagas caem no chão (A.adagas, com posição) e ela gira ao passar por cima (ver pegarAdagas)
  const largar = (tecla, x, y, queda = HK.P.queda[tecla] ?? 1) => {
    const p = podePisar(A, x, y) ? { x, y } : { x: A.x, y: A.y };
    const ad = { id: 'a' + (A.nAdaga = (A.nAdaga || 0) + 1), x: p.x, y: p.y, cai: A.tempo + queda, ate: A.tempo + queda + HK.P.dura, lance: A.lanceAtual, de: tecla };
    (A.adagas ??= []).push(ad);
    return ad;
  };
  const katarina = {
    Q() {          // Lâmina Saltitante: no mais perto do mouse, salta em mais 2 perto dele; a adaga cai atrás do primeiro (como no LoL)
      const escolha = alvoNaMiraComJogadores(6.5);
      if (!escolha) return 'Nenhum alvo ao alcance';
      const h = HK.Q, bruto = h.dano(r.Q, adEfetivo), lance = A.lanceAtual, ja = new Set(), caminho = [];
      let atual = escolha.p, monstro = escolha.monstro, jog = escolha.jogador;
      for (let k = 0; k < h.alvos && atual; k++) {
        ja.add(atual);
        caminho.push({ x: atual.x, y: atual.y });
        if (monstro) golpear(estado, c, adEfetivo, monstro, bruto, 'Q', { acumula: false });
        if (jog) acertarJogador(c, A, jog, 'Q', lance);
        const prox = [...vivos.filter((i) => i.hp > 0 && !ja.has(i)).map((i) => ({ monstro: i, p: i })), ...jogadoresAlvo(A).filter((o) => !ja.has(o)).map((o) => ({ jogador: o, p: o }))]
          .filter((x) => dist(x.p, atual) <= 3.5).sort((x, y) => dist(x.p, atual) - dist(y.p, atual))[0];
        atual = prox?.p; monstro = prox?.monstro; jog = prox?.jogador;
      }
      // do lado oposto ao dela, KAT.qAtras quadrados atrás do primeiro alvo (antes de uma parede, se houver)
      const pri = caminho[0], n = dist(pri, A) || 1, cai = ateOnde(A, pri, { x: (pri.x - A.x) / n, y: (pri.y - A.y) / n }, KAT.qAtras);
      const ad = largar('Q', cai.x, cai.y);
      olhar({ x: (caminho[0].x - A.x) / (dist(caminho[0], A) || 1), y: (caminho[0].y - A.y) / (dist(caminho[0], A) || 1) });
      return { caminho, adaga: { id: ad.id, x: ad.x, y: ad.y, cai: HK.P.queda.Q } };
    },
    W() {          // Preparação: a adaga sobe e cai onde ela estava; ela corre mais rápido por um instante
      const ad = largar('W', A.x, A.y);
      A.rapida = { ate: A.tempo + HK.W.duracaoVel, v: HK.W.vel[r.W - 1] };
      return { adaga: { id: ad.id, x: ad.x, y: ad.y, cai: HK.P.queda.W } };
    },
    E() {          // Shunpo: aparece numa adaga no chão (e já gira), num monstro ou num jogador (o mais perto do mouse)
      const m = A.entrada.mira || A, alc = KAT.shunpo;
      const cands = [...(A.adagas || []).filter((x) => x.cai <= A.tempo && dist(x, A) <= alc).map((x) => ({ adaga: x, p: x, r: 0 })),
        ...vivos.filter((i) => i.hp > 0 && dist(i, A) <= alc + raioDe(i)).map((i) => ({ monstro: i, p: i, r: raioDe(i) + 0.15 })),
        ...jogadoresAlvo(A).filter((o) => dist(o, A) <= alc + RAIO_JOG).map((o) => ({ jogador: o, p: o, r: RAIO_JOG + 0.3 }))];
      // até a borda do corpo: com o mouse em cima do monstro ou do jogador, vai nele (antes, até o centro: a adaga ao lado ganhava; p638)
      const perto = (x) => Math.max(0, dist(x.p, m) - x.r), escolha = cands.sort((x, y) => perto(x) - perto(y) || (x.adaga ? 1 : 0) - (y.adaga ? 1 : 0))[0];
      if (!escolha) return 'Nenhum alvo ao alcance';
      const o = escolha.p, n = dist(o, A) || 1, dir = { x: (o.x - A.x) / n, y: (o.y - A.y) / n }, de = { x: A.x, y: A.y };
      // aparece do outro lado de quem ela corta (na adaga, em cima dela); se ali não dá para pisar, do lado de cá
      // do lado do alvo em que está o mouse (como no LoL); com o mouse no meio dele, atrás (p638)
      const dm = dist(m, o), lm = dm > 0.25 ? { x: (m.x - o.x) / dm, y: (m.y - o.y) / dm } : dir;
      const lado = escolha.adaga ? 0 : 0.7, alvoP = { x: o.x + lm.x * lado, y: o.y + lm.y * lado }, aqui = { x: o.x - lm.x * lado, y: o.y - lm.y * lado };
      const ponto = podePisar(A, alvoP.x, alvoP.y) ? alvoP : podePisar(A, aqui.x, aqui.y) ? aqui : ateOnde(A, A, dir, Math.max(0, n - 0.6));
      A.x = ponto.x; A.y = ponto.y; olhar(dir); A.destino = null; A.caminho = null;
      if (escolha.monstro) golpear(estado, c, adEfetivo, escolha.monstro, HK.E.dano(r.E, adEfetivo), 'E', { acumula: false });
      if (escolha.jogador) acertarJogador(c, A, escolha.jogador, 'E');
      if (escolha.adaga) girarAdaga(escolha.adaga);
      return { de, x: A.x, y: A.y, alvo: escolha.monstro?.id, jogador: escolha.jogador?.nome, adaga: escolha.adaga?.id };
    },
    R() {          // Lótus da Morte: parada por 2,5 s, adagas nos 3 mais perto (andar, outra habilidade ou atordoamento interrompem)
      const h = HK.R, id = A.lanceAtual, lance = A.lanceAtual, bruto = h.dano(r.R, adEfetivo), cada = h.duracao / KAT.lotusOndas;
      A.lotus = { id, ate: A.tempo + h.duracao }; A.destino = null; A.caminho = null;
      const onda = (k) => {
        if (!A.lotus || A.lotus.id !== id) return;
        const alvos = [...vivos.filter((i) => i.hp > 0 && dist(i, A) <= KAT.lotusRaio + raioDe(i)).map((i) => ({ monstro: i, p: i })),
          ...jogadoresAlvo(A).filter((o) => dist(o, A) <= KAT.lotusRaio + RAIO_JOG).map((o) => ({ jogador: o, p: o }))]
          .sort((x, y) => dist(x.p, A) - dist(y.p, A)).slice(0, h.alvos);
        for (const x of alvos) {
          if (x.monstro) golpear(estado, c, adEfetivo, x.monstro, bruto, 'R', { acumula: false });
          else if (k % 3 === 2) acertarJogador(c, A, x.jogador, 'R', lance);       // no PvP vale de 3 em 3 adagas (o servidor soma 3)
        }
        if (alvos.length) emitir(c, 'lotusLeva', { alvos: alvos.map((x) => x.monstro?.id || 'j:' + x.jogador.nome) });
        if (k + 1 < KAT.lotusOndas) depois(A, cada, () => onda(k + 1));
        else { A.lotus = null; emitir(c, 'lotusFim', {}); }
      };
      depois(A, 0.05, () => onda(0));
      return { duracao: h.duracao, x: A.x, y: A.y };
    },
    G() { d.sede = HK.G.duracao; d.sedeVa = HK.G.va[r.G - 1]; return true; },
    A() {          // Adaga Certeira: o primeiro na linha leva o dano e fica atordoado; a adaga cai ao lado dele (ou no fim do caminho)
      const dir = mirar(A), h = HK.A, alc = 8;
      let caiu = false;
      lancar(A, 'adagaCerteira', dir, { tecla: 'A', vel: 18, alcance: alc, raio: 0.35, aoAcertar: (i) => {
        if (caiu) return true;
        caiu = true;
        i.atordoado = Math.max(i.atordoado || 0, h.atordoa);
        golpear(estado, c, adEfetivo, i, h.dano(r.A, adEfetivo), 'A', { acumula: false });
        const ad = largar('A', i.x + dir.x * 0.9, i.y + dir.y * 0.9);
        emitir(c, 'adagaCai', { id: ad.id, x: ad.x, y: ad.y, cai: HK.P.queda.A });
        return true;
      } });
      // sem acertar ninguém, ela cai no fim do caminho (o tempo do voo)
      depois(A, alc / 18, () => {
        if (caiu) return;
        caiu = true;
        const p = ateOnde(A, A, dir, alc), ad = largar('A', p.x, p.y, 0.3);
        emitir(c, 'adagaCai', { id: ad.id, x: ad.x, y: ad.y, cai: 0.3 });
      });
      olhar(dir);
      return { dir };
    },
    F() { d.veneno = HK.F.duracao; return true; },
    T() {          // Chuva de Adagas: corta em volta e 3 adagas caem em volta dela
      const h = HK.T, raio = h.raioArena, at = perto(raio), ads = [];
      for (const i of at) golpear(estado, c, adEfetivo, i, h.dano(r.T, adEfetivo), 'T', { acumula: false });
      for (const o of jogPerto(raio)) acertarJogador(c, A, o, 'T');
      const giro = Math.random() * Math.PI * 2;
      for (let k = 0; k < h.adagas; k++) {
        const ang = giro + (k * Math.PI * 2) / h.adagas, ad = largar('T', A.x + Math.cos(ang) * 1.6, A.y + Math.sin(ang) * 1.6);
        ads.push({ id: ad.id, x: ad.x, y: ad.y });
      }
      return { alvos: at.map((i) => i.id), raio, adagas: ads, cai: HK.P.queda.T };
    },
    B() {          // Passo das Sombras: some por 1,5 s (nada acerta) e o próximo golpe de habilidade bate muito mais
      const h = HK.B;
      d.invulneravel = Math.max(d.invulneravel || 0, h.some);
      d.sombraPronta = h.janela; d.sombraBonus = h.bonusSombra[r.B - 1];
      A.sombraAte = A.tempo + h.some;
      return { duracao: h.some };
    },
    M() {          // Execução Noxiana: o golpe no mais perto do mouse; abaixo do limite, o monstro morre (e metade da recarga volta)
      const escolha = alvoNaMiraComJogadores(3);
      if (!escolha) return 'Nenhum alvo ao alcance';
      const h = HK.M, o = escolha.p, n = dist(o, A) || 1;
      olhar({ x: (o.x - A.x) / n, y: (o.y - A.y) / n });
      if (escolha.jogador) { acertarJogador(c, A, escolha.jogador, 'M'); return { jogador: escolha.jogador.nome }; }
      const i = escolha.monstro;
      golpear(estado, c, adEfetivo, i, h.dano(r.M, adEfetivo), 'M', { acumula: false });
      const exec = !i.externo && i.hp > 0 && !i.chefe && !i.guardiao && i.hp < i.hpMax * h.executa[r.M - 1];
      if (exec) { emitir(c, 'dano', { alvo: i.id, valor: i.hp, fonte: 'M', verdadeiro: true }); i.hp = 0; }
      return { alvo: i.id, executou: exec, recarga: h.recarga[r.M - 1] * (exec ? 1 - h.reembolso : 1) };
    },
    N() {          // Tempestade de Lótus: puxa quem está perto e corta todos em volta 12 vezes; nada a interrompe; 2 adagas no fim
      const h = HK.N, bruto = h.dano(r.N, adEfetivo), lance = A.lanceAtual, cada = h.duracao / h.golpes, raio = 3.5;
      A.tempestadeAte = A.tempo + h.duracao;
      for (const i of vivos) {
        if (i.hp <= 0 || i.externo || i.chefe || i.guardiao) continue;
        const dd = dist(i, A); if (dd > 5.5 || dd < 1.4) continue;
        const ux = (i.x - A.x) / dd, uy = (i.y - A.y) / dd, sx = i.x, sy = i.y;
        let fx = i.x, fy = i.y;
        for (let r2 = 1.3; r2 < dd; r2 += 0.25) { const x = A.x + ux * r2, y = A.y + uy * r2; if (pisaMonstro(A, i, x, y)) { fx = x; fy = y; break; } }
        for (let k = 1; k <= 5; k++) depois(A, k * 0.05, () => { if (i.hp > 0) { i.x = sx + ((fx - sx) * k) / 5; i.y = sy + ((fy - sy) * k) / 5; } });
      }
      const corte = (k) => {
        const at = perto(raio);
        for (const i of at) golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false });
        if (k % 3 === 2) for (const o of jogPerto(raio)) acertarJogador(c, A, o, 'N', lance);      // no PvP de 3 em 3 (o servidor soma 3)
        if (k + 1 < h.golpes) depois(A, cada, () => corte(k + 1));
        else {
          const ads = [], g = Math.random() * Math.PI * 2;
          for (let q = 0; q < (h.adagasFim || 0); q++) { const ad = largar('T', A.x + Math.cos(g + q * Math.PI) * 1.4, A.y + Math.sin(g + q * Math.PI) * 1.4, 0.6); ads.push({ id: ad.id, x: ad.x, y: ad.y }); }
          emitir(c, 'tempestadeFim', { adagas: ads });
        }
      };
      depois(A, 0.1, () => corte(0));
      return { duracao: h.duracao, x: A.x, y: A.y };
    },
  };
  // pegar a adaga: gira e corta todos em volta (monstros e, no PvP, jogadores); vale o lance de quem jogou a adaga
  function girarAdaga(ad) {
    A.adagas = (A.adagas || []).filter((x) => x !== ad);
    const at = perto(KAT.giro), jogs = jogPerto(KAT.giro);
    (A.lancePorTecla ??= {}).P = ad.lance;
    M.giroAdaga(estado, c, a, adEfetivo, at, ad);
    for (const o of jogs) acertarJogador(c, A, o, 'P', ad.lance);
    emitir(c, 'adagaPega', { id: ad.id, x: ad.x, y: ad.y });
  }
  ctx.girarAdaga = girarAdaga;
  // Taric: cura, escudos, Constelação, Resplendor e a cura da Supernova também no grupo (o jogo avisa o servidor com
  // 'apoioAliado' e ele confere o lance, o grupo e a distância, e calcula o valor para o aliado)
  const aliados = (raio) => A.outros.filter((o) => o.mesmoGrupo && !o.morto && dist(o, A) <= raio + RAIO_JOG);
  const apoiar = (raio, apoio, lance = A.lanceAtual) => { const lista = aliados(raio); for (const o of lista) emitir(c, 'apoioAliado', { nome: o.nome, apoio, lance }); return lista.map((o) => o.nome); };
  const taric = {
    Q() {          // Fulgor Estelar: cura o Taric e o grupo perto; a luz atinge os monstros em volta
      const at = perto(AR.area), bruto = HK.Q.dano(r.Q, adEfetivo) * (HK.Q.emRuneterra || 1);      // aqui a luz pega o bando inteiro
      for (const i of at) golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false });
      for (const o of jogPerto(AR.area)) acertarJogador(c, A, o, 'Q');
      const grupo = apoiar(5, 'cura');
      curaTaric(estado, c, a, adEfetivo, HK.Q.valorCura(r.Q, a), perto(2.6));
      return { alvos: at.map((i) => i.id), grupo };
    },
    W() {          // Bastião: escudo no Taric e no aliado do grupo mais perto
      const v = HK.W.escudo(r.W, a);
      d.escudo = Math.max(d.escudo || 0, v);
      const o = aliados(6).sort((x, y) => dist(x, A) - dist(y, A))[0];
      if (o) emitir(c, 'apoioAliado', { nome: o.nome, apoio: 'escudo', lance: A.lanceAtual });
      return { escudo: Math.round(v), aliado: o?.nome };
    },
    E() {          // Deslumbrar: o feixe na direção do mouse explode depois de 1 s (dano e atordoamento em todos na linha)
      const dir = mirar(A), comp = 5.5, larg = 0.9, lance = A.lanceAtual, de = { x: A.x, y: A.y };
      const naLinha = (p, raio) => { const px = p.x - de.x, py = p.y - de.y, ao = px * dir.x + py * dir.y; return ao > -0.3 && ao < comp && Math.abs(px * dir.y - py * dir.x) < larg + raio; };
      depois(A, HK.E.espera, () => {
        const at = vivos.filter((i) => i.hp > 0 && !i.morto && naLinha(i, raioDe(i)));      // inclui a Vilemaw e os monstros de outros jogadores
        for (const i of at) { golpear(estado, c, adEfetivo, i, HK.E.dano(r.E, adEfetivo), 'E', { acumula: false }); i.atordoado = Math.max(i.atordoado || 0, HK.E.atordoa); }
        for (const o of jogadoresAlvo(A)) if (naLinha(o, RAIO_JOG)) acertarJogador(c, A, o, 'E', lance);
        emitir(c, 'deslumbrar', { alvos: at.map((i) => i.id), x: de.x, y: de.y, dx: dir.x, dy: dir.y, comp });
      });
      olhar(dir);
      return { dir, espera: HK.E.espera, comp, x: de.x, y: de.y };
    },
    R() {          // Resplendor Cósmico: depois de 2,5 s, ele e o grupo perto ficam invulneráveis por 2,5 s
      const lance = A.lanceAtual;
      depois(A, HK.R.espera, () => {
        d.invulneravel = Math.max(d.invulneravel || 0, HK.R.invulneravel);
        const grupo = apoiar(6, 'resplendor', lance);
        emitir(c, 'resplendor', { duracao: HK.R.invulneravel, grupo });
      });
      return { espera: HK.R.espera, duracao: HK.R.invulneravel };
    },
    G() { d.diamante = HK.G.duracao; d.diamanteDef = HK.G.defesa[r.G - 1]; d.diamanteReflete = HK.G.reflete[r.G - 1]; return true; },
    A() {          // Estilhaço Estelar: o primeiro que o cristal tocar leva dano e fica atordoado
      const dir = mirar(A);
      lancar(A, 'estilhaco', dir, { tecla: 'A', vel: 17, alcance: 8, raio: 0.4, aoAcertar: (i) => {
        golpear(estado, c, adEfetivo, i, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
        i.atordoado = Math.max(i.atordoado || 0, HK.A.atordoa);
        return true;
      } });
      olhar(dir);
      return { dir };
    },
    F() {          // Égide Cristalina: escudo grande no Taric e no grupo perto
      const v = a.vida * HK.F.escudoPct[r.F - 1] + HK.F.escudoPoder * (a.ap || 0);
      d.escudo = Math.max(d.escudo || 0, v);
      return { escudo: Math.round(v), grupo: apoiar(5, 'egide') };
    },
    T() {          // Chuva de Estrelas: dano e lentidão em volta
      const at = perto(HK.T.raioArena);
      for (const i of at) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false }); i.lento = Math.max(i.lento || 0, HK.T.lento); }
      for (const o of jogPerto(HK.T.raioArena)) acertarJogador(c, A, o, 'T');
      return { alvos: at.map((i) => i.id) };
    },
    B() {          // Constelação: vida e mana por 10 s (também no grupo perto)
      d.estandarte = HK.B.duracao; d.estandarteCura = HK.B.cura[r.B - 1]; d.farolMana = HK.B.manaSeg; d.estandarteDef = 0;
      return { grupo: apoiar(6, 'constelacao') };
    },
    M() {          // Martelo Celestial: salta até o ponto do mouse (até 6 tiles) e cai com impacto em volta
      const dir = mirar(A), alc = Math.min(HK.M.alcance, dir.d ?? 3), lance = A.lanceAtual;
      const ponto = ateOnde(A, A, dir, alc); A.x = ponto.x; A.y = ponto.y; olhar(dir);
      depois(A, 0.3, () => {
        const at = perto(HK.M.raioArena);
        for (const i of at) { golpear(estado, c, adEfetivo, i, HK.M.dano(r.M, adEfetivo), 'M', { acumula: false }); i.atordoado = Math.max(i.atordoado || 0, HK.M.atordoa); }
        for (const o of jogPerto(HK.M.raioArena)) acertarJogador(c, A, o, 'M', lance);
        emitir(c, 'marteloCai', { x: A.x, y: A.y, alvos: at.map((i) => i.id) });
      });
      return { dir, x: ponto.x, y: ponto.y };
    },
    N() {          // Supernova: explosão em volta; um quarto do dano vira cura (também para o grupo)
      const at = perto(HK.N.raioArena), bruto = HK.N.dano(r.N, adEfetivo);
      let total = 0;
      for (const i of at) total += golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false });
      for (const o of jogPerto(HK.N.raioArena)) acertarJogador(c, A, o, 'N');
      curaTaric(estado, c, a, adEfetivo, total * HK.N.curaDano, perto(2.6));
      return { alvos: at.map((i) => i.id), grupo: apoiar(6, 'supernova') };
    },
  };
  // Zac: o braço (Q e A) pega o primeiro na linha; as habilidades que acertam soltam gosmas no chão (A.gosmas) atrás de quem foi
  // atingido; a vida que cada uma custa é cobrada no usarHabilidade (M.pagarVida). Os números vêm do motor (HAB_ZAC)
  const idDe = (x) => (!x ? undefined : x.monstro ? x.monstro.id : 'j:' + x.jogador.nome);
  const idsDe = (ms, js) => [...ms.map((i) => i.id), ...js.map((o) => 'j:' + o.nome)];
  const primeiroNaLinha = (dir, alc, larg) => {
    let melhor = null;
    const ver = (p, raio, x) => { const px = p.x - A.x, py = p.y - A.y, ao = px * dir.x + py * dir.y; if (ao > 0 && ao < alc + raio && Math.abs(px * dir.y - py * dir.x) < larg + raio && (!melhor || ao < melhor.ao)) melhor = { ...x, p, ao }; };
    for (const i of vivos) if (i.hp > 0) ver(i, raioDe(i), { monstro: i });
    for (const o of jogadoresAlvo(A)) ver(o, RAIO_JOG, { jogador: o });
    return melhor;
  };
  // o monstro desliza até `quanto` tiles na direção do ponto (parando antes da parede); guardião e monstro de outro jogador não
  const deslizar = (i, para, quanto) => {
    if (!(quanto > 0.05) || i.externo || i.guardiao != null) return;
    const dd = dist(i, para) || 1, ux = (para.x - i.x) / dd, uy = (para.y - i.y) / dd, sx = i.x, sy = i.y;
    let fx = sx, fy = sy;
    for (let k = quanto; k > 0.05; k -= 0.25) { const x = sx + ux * k, y = sy + uy * k; if (pisaMonstro(A, i, x, y)) { fx = x; fy = y; break; } }
    for (let k = 1; k <= 4; k++) depois(A, k * 0.05, () => { if (i.hp > 0) { i.x = sx + ((fx - sx) * k) / 4; i.y = sy + ((fy - sy) * k) / 4; } });
  };
  // gosmas: uma por atingido (até HAB_ZAC.P.maxPorLance; n força a quantidade, como as 3 da Explosão Celular), atrás de quem levou
  const soltarGosmasZac = (tecla, quem, n = null) => {
    const HP = HK.P;
    if (!HP?.passivaZac || !quem.length) return;
    const qtd = n ?? Math.min(quem.length, HP.maxPorLance), novas = [];
    for (let k = 0; k < qtd; k++) {
      const p = quem[k % quem.length], ang = Math.atan2(p.y - A.y, p.x - A.x) + (Math.random() - 0.5) * 1.2, rr = ZAC.longe[0] + Math.random() * (ZAC.longe[1] - ZAC.longe[0]);
      let x = p.x + Math.cos(ang) * rr, y = p.y + Math.sin(ang) * rr;
      if (!podePisar(A, x, y)) { x = p.x; y = p.y; }
      if (!podePisar(A, x, y)) { x = A.x; y = A.y; }
      const g = { id: 'z' + (A.nGosma = (A.nGosma || 0) + 1), x: +x.toFixed(2), y: +y.toFixed(2), cai: A.tempo + HP.queda, ate: A.tempo + HP.queda + HP.dura, de: tecla };
      (A.gosmas ??= []).push(g); novas.push(g);
    }
    if (A.gosmas.length > ZAC.max) for (const g of A.gosmas.splice(0, A.gosmas.length - ZAC.max)) emitir(c, 'gosmaSome', { gosma: g.id });
    emitir(c, 'gosma', { tecla, gosmas: novas.map((g) => ({ id: g.id, x: g.x, y: g.y })), queda: HP.queda });
  };
  const zacBraco = (dir, alc, pri, puxa) => {
    const ate = pri ? { x: pri.p.x, y: pri.p.y } : { x: A.x + dir.x * alc, y: A.y + dir.y * alc };
    emitir(c, 'zacBraco', { de: { x: +A.x.toFixed(2), y: +A.y.toFixed(2) }, ate: { x: +ate.x.toFixed(2), y: +ate.y.toFixed(2) }, alvo: idDe(pri), puxa });
  };
  const zac = {
    Q() {          // Esticada: o braço agarra o 1º na linha e o mais perto dele (a até 3 tiles) e bate um no outro; um só: bate no chão (× solo)
      const dir = mirar(A), h = HK.Q, alc = ZAC.qAlc, lance = A.lanceAtual, pri = primeiroNaLinha(dir, alc, ZAC.qLarg);
      zacBraco(dir, alc, pri, false); olhar(dir);
      if (!pri) return { dir, alcance: alc };
      const seg = [...vivos.filter((i) => i.hp > 0 && i !== pri.monstro).map((i) => ({ monstro: i, p: i })), ...jogadoresAlvo(A).filter((o) => o !== pri.jogador).map((o) => ({ jogador: o, p: o }))]
        .filter((x) => dist(x.p, pri.p) <= ZAC.qSegundo + (x.monstro ? raioDe(x.monstro) : RAIO_JOG)).sort((x, y) => dist(x.p, pri.p) - dist(y.p, pri.p))[0] || null;
      const pegos = [pri, seg].filter(Boolean), solo = pegos.length === 1 && pri.monstro ? h.solo[r.Q - 1] : 1, bruto = h.dano(r.Q, adEfetivo) * solo;
      for (const x of pegos) {
        if (x.monstro) { golpear(estado, c, adEfetivo, x.monstro, bruto, 'Q', { acumula: false, frac: solo }); x.monstro.lento = Math.max(x.monstro.lento || 0, h.lento); }
        else acertarJogador(c, A, x.jogador, 'Q', lance);
      }
      if (seg) { const meio = { x: (pri.p.x + seg.p.x) / 2, y: (pri.p.y + seg.p.y) / 2 }; for (const x of pegos) if (x.monstro) deslizar(x.monstro, meio, Math.min(ZAC.qJunta, dist(x.p, meio) - 0.45)); }
      soltarGosmasZac('Q', pegos.map((x) => x.p));
      return { dir, alcance: alc, alvo: idDe(pri), alvo2: idDe(seg) };
    },
    W() {          // Matéria Instável: em volta; em cada monstro, mais uma parte da vida máxima dele (o servidor faz a mesma conta no jogador)
      const raio = ZAC.wRaio, at = perto(raio), jogs = jogPerto(raio);
      for (const i of at) golpear(estado, c, adEfetivo, i, M.danoWZac(r.W, adEfetivo, i), 'W', { acumula: false });
      for (const o of jogs) acertarJogador(c, A, o, 'W');
      soltarGosmasZac('W', [...at, ...jogs]);
      return { x: A.x, y: A.y, raio, alvos: idsDe(at, jogs) };
    },
    E() {          // Estilingue Elástico: o 1º aperto carrega (até 1 s, parado); o 2º (ou a carga cheia) solta: voa até o mouse e cai no meio
      if (!A.zacCarga) {
        A.zacCarga = { t0: A.tempo }; A.destino = null; A.caminho = null;
        emitir(c, 'zacCarga', { max: ZAC.eCarga, de: ZAC.eMin, ate: HK.E.alcance });
        return null;          // carregando: a vida e a recarga só contam quando ele solta
      }
      const carga = Math.min(1, (A.tempo - A.zacCarga.t0) / ZAC.eCarga), alcMax = ZAC.eMin + (HK.E.alcance - ZAC.eMin) * carga;
      A.zacCarga = null;
      const dir = mirar(A), quer = dir.d ? Math.min(alcMax, dir.d) : alcMax;
      let px = A.x + dir.x * quer, py = A.y + dir.y * quer;
      for (let k = quer; k > 0.5 && !podePisar(A, px, py); k -= 0.25) { px = A.x + dir.x * k; py = A.y + dir.y * k; }
      if (!podePisar(A, px, py)) { px = A.x; py = A.y; }
      const de = { x: +A.x.toFixed(2), y: +A.y.toFixed(2) }, para = { x: +px.toFixed(2), y: +py.toFixed(2) }, lance = A.lanceAtual, bruto = HK.E.dano(r.E, adEfetivo);
      A.zacVoo = { de, para, t0: A.tempo, dur: ZAC.eVoo }; A.destino = null; A.caminho = null;
      depois(A, ZAC.eVoo, () => {
        A.x = para.x; A.y = para.y; A.zacVoo = null;
        if (d.morto > 0) return;
        const at = perto(ZAC.eRaio), jogs = jogPerto(ZAC.eRaio);
        for (const i of at) { golpear(estado, c, adEfetivo, i, bruto, 'E', { acumula: false }); M.levantar(i, HK.E.levanta); }
        for (const o of jogs) { acertarJogador(c, A, o, 'E', lance); (A.levantados ??= {})[o.nome] = A.tempo + HK.E.levanta + 0.2; }
        soltarGosmasZac('E', [...at, ...jogs]);
        emitir(c, 'zacQueda', { x: A.x, y: A.y, raio: ZAC.eRaio, alvos: idsDe(at, jogs) });
      });
      olhar(dir);
      return { x0: de.x, y0: de.y, x: para.x, y: para.y, carga: +carga.toFixed(2), dur: ZAC.eVoo, salto: para };
    },
    R() {          // Vamos pular!: 4 quiques em 2,5 s em volta dele (anda mais devagar); o 1º joga para o alto, os outros deixam lentos; apanha menos
      const h = HK.R, lance = A.lanceAtual, bruto = h.dano(r.R, adEfetivo), cada = h.duracao / h.quiques;
      A.zacQuique = { ate: A.tempo + h.duracao, id: lance }; d.quique = { reduz: h.reduzDano[r.R - 1], t: h.duracao };      // o motor reduz o dano (receberDano); t: o quadro de efeitos
      const quica = (k) => {
        if (A.zacQuique?.id !== lance || d.morto > 0) return;
        const at = perto(ZAC.rRaio), jogs = jogPerto(ZAC.rRaio);
        for (const i of at) { golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false }); if (k === 1) M.levantar(i, h.levanta); else i.lento = Math.max(i.lento || 0, h.lento); }
        for (const o of jogs) { acertarJogador(c, A, o, 'R', lance); if (k === 1) (A.levantados ??= {})[o.nome] = A.tempo + h.levanta + 0.2; }
        emitir(c, 'quique', { k, x: A.x, y: A.y, raio: ZAC.rRaio, alvos: idsDe(at, jogs) });
        if (k === 1) soltarGosmasZac('R', [...at, ...jogs]);
        if (k < h.quiques) depois(A, cada, () => quica(k + 1));
      };
      depois(A, 0.15, () => quica(1));
      return { duracao: h.duracao, quiques: h.quiques, x: A.x, y: A.y };
    },
    G() {          // Membrana Reforçada: escudo de parte da vida máxima e armadura e resistência mágica a mais (o servidor conta o escudo no PvP)
      const v = a.vida * HK.G.escudoPct[r.G - 1];
      d.escudo = Math.max(d.escudo || 0, v); d.membrana = HK.G.duracao; d.membranaDef = HK.G.defesa[r.G - 1];
      return { escudo: Math.round(v), duracao: HK.G.duracao };
    },
    A() {          // Gancho Viscoso: o braço grudento pega o 1º na linha (até 7 tiles), puxa para perto dele e atordoa
      const dir = mirar(A), alc = HK.A.alcance, lance = A.lanceAtual, pri = primeiroNaLinha(dir, alc, ZAC.aLarg);
      zacBraco(dir, alc, pri, true); olhar(dir);
      if (pri?.monstro) {
        const i = pri.monstro;
        i.atordoado = Math.max(i.atordoado || 0, HK.A.atordoa);
        golpear(estado, c, adEfetivo, i, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
        if (!i.chefe) deslizar(i, A, dist(i, A) - ZAC.aPuxa);
      }
      if (pri?.jogador) acertarJogador(c, A, pri.jogador, 'A', lance);      // o servidor puxa e atordoa o outro jogador
      if (pri) soltarGosmasZac('A', [pri.p]);
      return { dir, alcance: alc, alvo: idDe(pri) };
    },
    F() {          // Poça Ácida: no ponto do mouse (até 6 tiles), 4 s queimando a cada meio segundo e deixando lento
      const dir = mirar(A), alc = Math.min(ZAC.fAlc, dir.d || 3), ponto = { x: +(A.x + dir.x * alc).toFixed(2), y: +(A.y + dir.y * alc).toFixed(2) };
      const raio = HK.F.raioArena, lance = A.lanceAtual, bruto = HK.F.dano(r.F, adEfetivo), n = Math.round(HK.F.duracao / 0.5);
      A.zacPoca = { ...ponto, raio, ate: A.tempo + HK.F.duracao, id: lance };
      emitir(c, 'pocaAcida', { x: ponto.x, y: ponto.y, raio, dur: HK.F.duracao });
      const queima = (k) => {
        if (A.zacPoca?.id !== lance) return;
        const at = perto(raio, ponto), jogs = jogPerto(raio, ponto);
        for (const i of at) { golpear(estado, c, adEfetivo, i, bruto, 'F', { acumula: false }); i.lento = Math.max(i.lento || 0, HK.F.lento); }
        for (const o of jogs) acertarJogador(c, A, o, 'F', lance);
        if (k === 0) soltarGosmasZac('F', [...at, ...jogs]);
        if (k + 1 < n) depois(A, 0.5, () => queima(k + 1));
        else { A.zacPoca = null; emitir(c, 'pocaFim', {}); }
      };
      depois(A, 0.2, () => queima(0));
      olhar(dir);
      return { x: ponto.x, y: ponto.y, raio, duracao: HK.F.duracao };
    },
    T() {          // Ondulação: a onda em volta joga todos para o alto
      const raio = HK.T.raioArena, at = perto(raio), jogs = jogPerto(raio);
      for (const i of at) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false }); M.levantar(i, HK.T.levanta); }
      for (const o of jogs) { acertarJogador(c, A, o, 'T'); (A.levantados ??= {})[o.nome] = A.tempo + HK.T.levanta + 0.2; }
      soltarGosmasZac('T', [...at, ...jogs]);
      return { x: A.x, y: A.y, raio, alvos: idsDe(at, jogs) };
    },
    B() {          // Regeneração Química: cura ao longo de 5 s (zacArena)
      d.regenZ = { t: HK.B.duracao, porSeg: (a.vida * HK.B.curaTotal[r.B - 1]) / HK.B.duracao };
      return { duracao: HK.B.duracao };
    },
    M() {          // Mitose: 2 cópias dos lados dele por 6 s; os monstros perto vão atrás delas (moverMonstros) e elas batem (zacArena)
      const dir = A.olhar || A.dir, n = Math.hypot(dir.x, dir.y) || 1, lado = { x: -dir.y / n, y: dir.x / n };
      const pts = [1, -1].map((s) => { let p = { x: A.x + lado.x * ZAC.mLado * s, y: A.y + lado.y * ZAC.mLado * s }; if (!podePisar(A, p.x, p.y)) p = { x: A.x, y: A.y }; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2) }; });
      A.zacClones = { pts, ate: A.tempo + HK.M.duracao, prox: A.tempo + 0.3, lance: A.lanceAtual, bruto: HK.M.dano(r.M, adEfetivo) };
      d.mitose = { reduz: HK.M.reduzDano, t: HK.M.duracao };      // o motor reduz o dano que o Zac recebe (receberDano); t: o quadro de efeitos
      emitir(c, 'mitose', { clones: pts, dur: HK.M.duracao });
      return { duracao: HK.M.duracao, clones: pts.length };
    },
    N() {          // Explosão Celular: dano enorme em volta; cada atingido devolve vida (até 5); 3 gosmas no chão
      const raio = HK.N.raioArena, at = perto(raio), jogs = jogPerto(raio), bruto = HK.N.dano(r.N, adEfetivo);
      for (const i of at) golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false });
      for (const o of jogs) acertarJogador(c, A, o, 'N');
      if (at.length + jogs.length) curar(estado, c, a, a.vida * HK.N.curaPorAlvo * Math.min(HK.N.curaAlvos, at.length + jogs.length));
      soltarGosmasZac('N', [...at, ...jogs], HK.N.gosmas);
      return { x: A.x, y: A.y, raio, alvos: idsDe(at, jogs) };
    },
  };
  return { ...comum, ...(K.id === 'lux' ? lux : K.id === 'yasuo' ? yasuo : K.id === 'katarina' ? katarina : K.id === 'taric' ? taric : K.id === 'zac' ? zac : atirador ? ezreal : darius) };
}

// Barragem Incendiária: a onda atravessa tudo numa faixa na direção escolhida
function soltarBarragem(ctx) {
  const { estado, c, r, HK, adEfetivo, A, vivos, K } = ctx, dir = A.dirR || A.dir;
  const lux = K.id === 'lux', alc = lux ? 14 : 25, larg = lux ? 0.9 : 1;
  ctx.lanceR = A.lanceR;
  const atingidos = vivos.filter((i) => {
    const px = i.x - A.x, py = i.y - A.y, ao = px * dir.x + py * dir.y;
    return i.hp > 0 && ao > -0.5 && ao < alc && Math.abs(px * dir.y - py * dir.x) < larg + raioDe(i);
  });
  emitir(c, lux ? 'centelha' : 'barragem', { alvos: atingidos.map((i) => i.id), dir: { x: dir.x, y: dir.y } });
  for (const o of jogadoresAlvo(A)) {
    const px = o.x - A.x, py = o.y - A.y, ao = px * dir.x + py * dir.y;
    if (ao > -0.5 && ao < alc && Math.abs(px * dir.y - py * dir.x) < larg + RAIO_JOG) acertarJogador(c, A, o, 'R', ctx.lanceR);
  }
  const bruto = HK.R.dano(r.R, adEfetivo);
  for (const i of atingidos) {
    if (lux) { if (i.marca > 0) detonarOrbe(ctx, i); golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false }); iluminar(estado, i); continue; }
    golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false }); if (i.marca > 0) detonarOrbe(ctx, i);
  }
  acertouHabilidade(estado, c);
}

// Zac em Runeterra, a cada quadro: a Regeneração Química, o fim dos quiques, as cópias da Mitose batendo e as gosmas no chão
// (somem; passar por cima pega: M.interno.pegarGosma cura, adianta a W e, com a Absorção, dá dano e adianta as outras recargas)
function zacArena(ctx, dt) {
  const { estado, c, a, d, HK, adEfetivo, A, vivos } = ctx;
  if (d.regenZ) { const passo = Math.min(dt, d.regenZ.t); d.regenZ.t -= dt; estado.vida = Math.min(a.vida, estado.vida + d.regenZ.porSeg * passo); if (d.regenZ.t <= 0) d.regenZ = null; }
  if (d.quique?.t > 0) d.quique.t = Math.max(0, d.quique.t - dt);
  if (d.mitose?.t > 0) d.mitose.t = Math.max(0, d.mitose.t - dt);
  if (A.zacQuique && (A.zacQuique.ate <= A.tempo || !d.quique)) { A.zacQuique = null; d.quique = null; emitir(c, 'quiqueFim', {}); }
  if (A.zacClones) {
    const cl = A.zacClones;
    if (cl.ate <= A.tempo || !d.mitose) { A.zacClones = null; d.mitose = null; emitir(c, 'mitoseFim', {}); }
    else if (A.tempo >= cl.prox) {
      cl.prox += HK.M.cada;
      (A.lancePorTecla ??= {}).M = cl.lance;          // o acerto na Vilemaw ou no monstro de outro jogador diz o lance da Mitose
      cl.pts.forEach((p, k) => {
        const i = vivos.filter((x) => x.hp > 0 && !x.morto && dist(x, p) <= ZAC.mAlc + raioDe(x)).sort((x, y) => dist(x, p) - dist(y, p))[0];
        if (!i) return;
        golpear(estado, c, adEfetivo, i, cl.bruto, 'M', { acumula: false });
        emitir(c, 'cloneGolpe', { clone: k, alvo: i.id });
      });
    }
  }
  if (A.gosmas?.length) {
    A.gosmas = A.gosmas.filter((g) => { if (g.ate > A.tempo) return true; emitir(c, 'gosmaSome', { gosma: g.id }); return false; });
    if (d.morto <= 0 && !(d.dividido > 0) && !A.zacVoo) {
      const g = A.gosmas.find((x) => x.cai <= A.tempo && dist(x, A) <= ZAC.pega);
      if (g) { A.gosmas = A.gosmas.filter((x) => x !== g); M.interno.pegarGosma(estado, c, a, g); }
    }
  }
}

// tenta usar a habilidade t; devolve o motivo se não deu
function usarHabilidade(ctx, acoes, t) {
  const { estado, c, a, d, r, HK } = ctx;
  const h = HK[t];
  if (!h || h.passiva) return null;
  if (!r[t]) return 'Ainda não aprendida';
  if (d.canalR > 0) return null;
  if (ctx.A.presoJog > 0) return 'Atordoado';
  if (d.dividido > 0) return 'Dividido';                                    // Zac: os pedaços estão se juntando
  if (ctx.A.zacVoo) return 'No ar';
  if (ctx.A.zacCarga && t !== 'E') return 'Carregando o Estilingue';
  if (ctx.A.zacQuique) return 'Quicando';
  if (d.recargas[t] > 0) return 'Em recarga';
  if (ctx.A.lotus && t !== 'R') pararLotus(c, ctx.A);
  const custo = h.duasVezes && ctx.A.portal?.ate > ctx.A.tempo ? 0 : h.custo[r[t] - 1];      // atravessar o portal não gasta mana
  if (estado.mana < custo) return 'Sem mana';
  ctx.A.lanceAtual = ++ctx.A.lances;
  (ctx.A.lancePorTecla ??= {})[t] = ctx.A.lanceAtual;          // para o acerto em monstro de outro jogador dizer de qual lance foi
  if (ctx.HK.P?.bravata) { ctx.A.lancePorTecla.P = ctx.A.lanceAtual; if (t === 'Q' || t === 'N') ctx.A.lancePorTecla.D = ctx.A.lanceAtual; }
  if (ctx.HK.P?.passivaLux) { ctx.A.lancePorTecla.P = ctx.A.lanceAtual; ctx.A.lancePorTecla.D = ctx.A.lanceAtual; }      // Lux: a marca de luz e o prisma      // Taric: a Bravata e o pulso da cura vêm deste lance
  const res = acoes[t]?.();
  if (!res) return null;
  if (typeof res === 'string') return res;
  if (ctx.K.gosmas) M.pagarVida(estado, t);              // Zac: a habilidade custa uma parte da vida atual (nunca mata)
  gastarMana(estado, custo);
  aoUsarHabilidade(estado, c, a, ctx.adEfetivo, ctx.vivos);
  d.recargas[t] = (res.recarga ?? h.recarga[r[t] - 1]) * (1 - a.reducaoRecarga);
  d.trindade = M.lamina(a);
  if (d.recall > 0) { d.recall = 0; emitir(c, 'recallCancelado', {}); }
  const dir = mirar(ctx.A);
  emitir(c, 'habilidade', { tecla: t, ...res, recarga: undefined, lance: ctx.A.lanceAtual, dx: dir.x, dy: dir.y });
  return null;
}

// ---------- o passo de Runeterra (registrado no motor) ----------
export function passoArena(estado, c, dt, a) {
  const A = (c.arena ??= novaArena());
  const d = c.darius, K = M.kit(estado), HK = K.hab, r = estado.ranks, ent = A.entrada;
  A.marcaLuz = !!HK.P?.passivaLux;
  // Arena: PK sempre ligado; na contagem e entre as rodadas o jogo segura o campeão (nem anda nem ataca)
  if (A.mundo?.aram) {
    A.pvp = true; A.mexeu = true;
    if (A.congelado) { A.destino = null; A.caminho = null; A.alvoAtaque = null; ent.fila.length = 0; d.canalR = 0; return; }
  }
  // parado sem mexer: o campeão fica quieto e os monstros vão embora até ele voltar
  if (A.mexeu) { A.mexeu = false; A.ocioso = 0; } else A.ocioso += dt;
  // onde ele está: numa cidade (segura) ou numa zona de caça
  if (A.mundo) {
    const cid = A.mundo.cidadeEm(A.x, A.y), aqui = cid ? 'c:' + cid.id : A.mundo.zonaEm(A.x, A.y);
    A.cidade = cid?.id || null;
    M.definirCidade(A.cidade);
    if (aqui !== A.zona) { const antes = A.zona; A.zona = aqui; emitir(c, 'zona', { cidade: A.cidade, zona: cid ? null : aqui, antes }); }
  }
  if (A.portal && A.portal.ate <= (A.tempo || 0)) {          // Passagem Shurimane: o portal fechou sem ninguém atravessar
    d.recargas.B = Math.max(d.recargas.B || 0, A.portal.recarga - M.habDe(estado).B.portal); A.portal = null; emitir(c, 'portalFecha', {});
  }
  // Zona de Guerra: o PK liga sozinho e não desliga até sair (quando sai, volta como estava)
  if (A.mundo && !A.mundo.aram) {
    const zpk = zonaPkEm(A.x, A.y);
    if (zpk && !A.zonaPk) { A.pvpAntesZona = !!A.pvp; A.pvp = true; A.zonaPk = zpk; emitir(c, 'zonaPk', { entrou: true, nome: zpk.nome }); }
    else if (!zpk && A.zonaPk) { const nome = A.zonaPk.nome; A.zonaPk = null; A.pvp = !!A.pvpAntesZona; if (!A.pvp && A.alvoAtaque?.tipo === 'jogador') A.alvoAtaque = null; emitir(c, 'zonaPk', { entrou: false, nome, pvp: A.pvp }); }
  }
  if (A.ocioso >= M.ARENA.ocioso) {
    if (!A.pausado) { A.pausado = true; c.inimigos = []; A.proj = []; A.atrasos = []; d.canalR = 0; A.adagas = []; A.lotus = null; A.gosmas = []; A.zacCarga = null; A.zacVoo = null; A.zacQuique = null; A.zacClones = null; A.zacPoca = null; d.quique = null; d.mitose = null; if (A.pontos) for (const p of A.pontos) { p.id = null; p.t = 0; } emitir(c, 'arenaPausa', {}); }
    ent.fila.length = 0;
    return;
  }
  if (A.pausado) { A.pausado = false; A.spawnT = AR.inicio; emitir(c, 'arenaVolta', {}); }
  if (!A.cidade) estado.totais.tempoArena = (estado.totais.tempoArena || 0) + dt;      // na cidade não conta como caça
  else if (!(A.combatePvp > 0) && !c.inimigos.some((i) => i.aggro && i.hp > 0)) {   // descansando na cidade: vida e mana voltam rápido
    estado.vida = Math.min(a.vida, estado.vida + a.vida * MUNDO.regenCidade * dt);
    estado.mana = Math.min(a.mana, estado.mana + a.mana * MUNDO.regenCidade * dt);
  }

  const adEfetivo = efetivo(estado, d, a);
  // Vontade do General: com a vida baixa, resiste a controle; no Domínio de Noxus, imune
  const HD = HK.D, rD = r.D;
  A.tenacidade = HD?.tenacidade && rD && estado.vida < a.vida * HD.limiarTenacidade ? HD.tenacidade[rD - 1] : 0;
  A.inabalavel = !!(A.dominio && A.dominio.ate > A.tempo && Math.hypot(A.x - A.dominio.x, A.y - A.dominio.y) <= A.dominio.raio) || A.tempestadeAte > (A.tempo || 0);
  adEfetivo.bonusAd = adEfetivo.ad - a.baseAd;
  // sangramento guardado pela Dança da Morte
  if (d.sangramentoRecebido.length) {
    let total = 0;
    d.sangramentoRecebido = d.sangramentoRecebido.filter((s) => { const parte = Math.min(s.resto, (s.total / 3) * dt); s.resto -= parte; total += parte; return s.resto > 0.01; });
    receberDano(estado, c, a, total, true);
    if (d.morto > 0) return;
  }

  // movimento (andar cancela o recall, como no LoL; carregando a Barragem ele não anda)
  A.tempo = (A.tempo || 0) + dt;
  A.lentoJog = Math.max(0, A.lentoJog - dt); A.presoJog = Math.max(0, A.presoJog - dt); A.combatePvp = Math.max(0, (A.combatePvp || 0) - dt); A.apanhou = Math.max(0, (A.apanhou || 0) - dt);
  // montaria: terminando de montar; usar habilidade desmonta
  if (A.montando > 0) {
    if (ent.fila.length || A.alvoAtaque || estado.vida < A.vidaMontando - 1 || d.morto > 0) { A.montando = 0; emitir(c, 'montariaCancelada', {}); }
    else if ((A.montando -= dt) <= 0) { A.montando = 0; A.montado = true; emitir(c, 'montou', {}); }
  }
  if (A.montado && (d.morto > 0 || ent.fila.length)) desmontar(c, A);
  // o alvo clicado: monstro vivo ou jogador atacável; se sumiu, o comando acaba
  const alcB = alcanceBasico(K.id);
  let alvoM = null, alvoJ = null, alvoMO = null;
  if (A.alvoAtaque?.tipo === 'monstro') alvoM = c.inimigos.find((i) => i.id === A.alvoAtaque.id && i.hp > 0 && !i.morto) || null;
  else if (A.alvoAtaque?.tipo === 'jogador') alvoJ = jogadoresAlvo(A).find((o) => o.nome === A.alvoAtaque.nome) || null;
  else if (A.alvoAtaque?.tipo === 'monstroOutro') alvoMO = (A.monsOutros || []).find((o) => o.chave === A.alvoAtaque.chave && !cidadeAqui(A, o.x, o.y)) || null;      // monstro de outro jogador
  if (A.alvoAtaque && !alvoM && !alvoJ && !alvoMO) A.alvoAtaque = null;
  const alvoAtq = alvoM || alvoJ || alvoMO, alcAlvo = alvoAtq ? alcB + (alvoM ? raioDe(alvoM) : alvoMO ? alvoMO.raio ?? AR.raio : RAIO_JOG) : 0;      // a Vilemaw: bate da borda dela
  if (A.montado && alvoAtq && dist(alvoAtq, A) <= alcAlvo) desmontar(c, A);         // chegou no alvo: desce para atacar
  // para onde andar: até o alvo ficar ao alcance, ou até o ponto clicado
  let para = null;
  if (alvoAtq && dist(alvoAtq, A) > alcAlvo) {
    para = alvoAtq;
    // no mundo aberto, com árvore ou casa no meio, vai pelo caminho (recalculado a cada meio segundo)
    if (A.mundo) {
      A.rotaT = (A.rotaT || 0) - dt;
      if (A.rotaT <= 0) { A.rotaT = 0.5; A.caminho = linhaLivre(A, A, alvoAtq) ? null : rota(A, A, alvoAtq, 3000); }
      while (A.caminho?.length > 1 && dist(A.caminho[0], A) < 0.2) A.caminho.shift();
      if (A.caminho?.length > 1) para = A.caminho[0];
    }
  } else if (!alvoAtq && A.destino) {
    while (A.caminho?.length > 1 && dist(A.caminho[0], A) < 0.2) A.caminho.shift();
    if (dist(A.destino, A) < 0.12 || A.travado > 0.5) { A.destino = null; A.caminho = null; } else para = A.caminho?.length ? A.caminho[0] : A.destino;
  }
  if (A.lotus && (A.destino || A.presoJog > 0 || d.morto > 0)) pararLotus(c, A);
  if (A.lotus) para = null;
  if (A.zacVoo) {          // Estilingue Elástico (Zac): voando até o ponto (o servidor aceita o salto até o ponto do lance)
    const k = Math.min(1, (A.tempo - A.zacVoo.t0) / A.zacVoo.dur);
    A.x = A.zacVoo.de.x + (A.zacVoo.para.x - A.zacVoo.de.x) * k; A.y = A.zacVoo.de.y + (A.zacVoo.para.y - A.zacVoo.de.y) * k;
  }
  A.andando = !!para && !(d.canalR > 0) && A.presoJog <= 0 && !A.zacCarga && !A.zacVoo && !(d.dividido > 0);
  if (A.andando) {
    const dx = para.x - A.x, dy = para.y - A.y, n = Math.hypot(dx, dy) || 1, mx = dx / n, my = dy / n;
    if (d.recall > 0) { d.recall = 0; emitir(c, 'recallCancelado', {}); }
    const passo = Math.min(n, AR.vel * (M.kit(estado).papel?.vel || 1) * (A.lentoJog > 0 ? 0.6 : 1) * (d.pressa > 0 && HK.D?.pressa ? 1 + HK.D.pressa : 1) * (A.montado ? 1 + M.velMontaria(estado) : 1) * (A.rapida?.ate > A.tempo ? 1 + A.rapida.v : 1) * (A.zacQuique ? 1 - ZAC.rLento : 1) * dt), x0 = A.x, y0 = A.y;
    mover(A, A, mx * passo, my * passo);
    if (K.fluxo) M.encherFluxo(estado, a, HK.P.fluxoTile * Math.hypot(A.x - x0, A.y - y0));      // Yasuo: andando, o Fluxo enche
    if (A.montado && M.andarMontado(estado, Math.hypot(A.x - x0, A.y - y0))) emitir(c, 'montariaNivel', { nivel: M.montariaDe(estado).nivel });
    A.travado = Math.hypot(A.x - x0, A.y - y0) < passo * 0.25 ? A.travado + dt : 0;     // bateu numa parede
    A.dir = { x: mx, y: my };
  }
  if (A.olhar) { A.olhar.t -= dt; if (A.olhar.t <= 0) A.olhar = null; }

  if (A.chaves?.length) {
    for (const k of A.chaves) if (!k.pega && dist(k, A) < 0.9) {
      k.pega = true;
      A.chavesMao = (A.chavesMao || []).filter((q) => q.fortaleza !== k.fortaleza).concat({ fortaleza: k.fortaleza, ate: k.ate });
      emitir(c, 'chavePega', { fortaleza: k.fortaleza, ate: k.ate });
    }
    A.chaves = A.chaves.filter((k) => !k.pega && k.ate > Date.now());
  }
  let vivos = c.inimigos.filter((i) => i.hp > 0 && !i.morto);
  // novos monstros
  if (A.pontos) { gerirPontos(estado, c, A, dt); vivos = c.inimigos.filter((i) => i.hp > 0 && !i.morto); }
  else {
    A.spawnT -= dt;
    if (A.spawnT <= 0 && vivos.length < AR.vivosMax) { A.spawnT = AR.intervalo; if (surgir(estado, c, A)) vivos = c.inimigos.filter((i) => i.hp > 0 && !i.morto); }
  }

  tickInimigos(estado, c, a, adEfetivo, vivos, dt);
  if (K.fluxo && vivos.some((i) => i.aggro && i.hp > 0 && dist(i, A) < 4)) M.encherFluxo(estado, a, HK.P.fluxoSeg * 0.5 * dt);      // e lutando, mais devagar
  const alcancaveis = vivos.filter((i) => dist(i, A) <= alcB + raioDe(i) + 0.4);
  // os monstros dos outros jogadores entram nos alvos das habilidades e dos projéteis (o acerto vai pelo servidor; ver golpear)
  // (são refeitos a cada quadro: o "no ar" do Yasuo e as marcas (orbe do Ezreal, luz da Lux) ficam guardados em A.extEst,
  // senão o Último Suspiro nunca os pegava e as marcas não explodiam)
  const extEst = (A.extEst ??= new Map()), agoraExt = A.tempo || 0;
  const externos = (A.monsOutros || []).filter((o) => !cidadeAqui(A, o.x, o.y)).map((o) => { const g = extEst.get(o.chave); return { id: 'x:' + o.chave, externo: true, dono: o.dono, mid: o.mid, nome: o.nome, chave: o.chave,
    x: o.x, y: o.y, hp: 1, hpMax: 1, armadura: 0, reducaoArmadura: 0, acumulos: 0, lento: 0, atordoado: 0, chefe: !!o.chefe, ...(o.raio ? { raio: o.raio } : {}),
    noAr: Math.max(0, (g?.noAr || 0) - agoraExt), marca: Math.max(0, (g?.marca || 0) - agoraExt) }; });
  const vivosHab = externos.length ? vivos.concat(externos) : vivos;
  const ctx = { estado, c, a, d, r, HK, adEfetivo, A, vivos: vivosHab, K, alcancaveis };

  // atrasos (ricochete) e projéteis
  // roda depois de separar: um golpe que agenda o seguinte (Dança, Domínio, ricochete, Lótus…) põe o novo na lista nova
  // (antes o filter trocava a lista e o golpe agendado de dentro dele se perdia: as habilidades em cadeia paravam no 1º)
  const vencidos = [];
  A.atrasos = A.atrasos.filter((x) => { x.t -= dt; if (x.t > 0) return true; vencidos.push(x); return false; });
  for (const x of vencidos) x.f();
  moverProjeteis(c, A, vivosHab, dt);

  if (A.zacCarga) {          // Zac: o Estilingue sai sozinho com a carga cheia; atordoado, dividido ou morto, cancela (sem custo)
    if (A.presoJog > 0 || d.morto > 0 || d.dividido > 0) { A.zacCarga = null; emitir(c, 'zacCargaFim', { cancelada: true }); }
    else if (A.tempo - A.zacCarga.t0 >= ZAC.eCarga && !ent.fila.includes('E')) ent.fila.push('E');
  }
  // habilidades apertadas neste quadro
  const acoes = habilidades(ctx);
  for (const t of ent.fila.splice(0)) {
    const motivo = usarHabilidade(ctx, acoes, t);
    if (motivo) emitir(c, 'arenaFalhou', { tecla: t, motivo, texto: tr(motivo) });     // motivo fica em português (a cena compara); texto = traduzido
  }
  if (d.canalR > 0) { d.canalR -= dt; if (d.canalR <= 0) soltarBarragem(ctx); }
  for (const x of externos) extEst.set(x.chave, { noAr: agoraExt + (x.noAr || 0), marca: agoraExt + (x.marca || 0) });
  if (extEst.size > 40) for (const [k, g] of extEst) if (g.noAr < agoraExt && g.marca < agoraExt) extEst.delete(k);
  if (A.adagas?.length) {        // Katarina: adagas no chão (somem depois de um tempo; passar por cima pega e gira)
    A.adagas = A.adagas.filter((x) => { if (x.ate > A.tempo) return true; emitir(c, 'adagaSome', { id: x.id }); return false; });
    const ad = d.morto <= 0 && !A.lotus && !(A.tempestadeAte > A.tempo) ? A.adagas.find((x) => x.cai <= A.tempo && dist(x, A) <= KAT.pega) : null;
    if (ad) ctx.girarAdaga(ad);
  }
  if (K.gosmas) zacArena(ctx, dt);        // Zac: gosmas, cópias, quiques e a regeneração

  // ataque básico: só no alvo que o jogador clicou, quando ele estiver ao alcance (como no LoL)
  avancarAtaque(c, dt);
  if (d.ataque < -0.2) d.ataque = -0.2;
  const podeBater = d.ataque <= 0 && !(d.canalR > 0) && d.recall <= 0 && A.presoJog <= 0 && !A.lotus && !(A.tempestadeAte > A.tempo) && !A.zacCarga && !A.zacVoo && !A.zacQuique && !(d.dividido > 0);
  if (alvoJ && dist(alvoJ, A) <= alcAlvo + 0.05 && podeBater) {
    d.ataque = 1 / a.velAtaque;
    const comW = d.wPronto && !K.distancia;
    if (comW) d.wPronto = false;
    acertarJogador(c, A, alvoJ, comW ? 'W' : 'ataque', comW ? A.lanceW : 0);
    for (const t of M.efeitosAtaqueJogador(estado, c, alvoJ.nome)) acertarJogador(c, A, alvoJ, t, A.lancePorTecla?.[t] ?? A.lanceAtual);      // Bravata, marca de luz, Sede de Sangue
    emitir(c, 'ataquePvp', { alvo: alvoJ.nome, comW });
  } else if (alvoMO && dist(alvoMO, A) <= alcAlvo + 0.05 && podeBater) {      // ataque básico no monstro de outro jogador (ou na Vilemaw)
    // pela rotina normal do ataque (Bravata, recargas, mana, itens); o dano vai pelo servidor (golpear avisa o acerto).
    // O alvo fica guardado entre os quadros (senão o Céu Dividido daria crítico em todo golpe)
    const guard = (A.alvosServidor ??= new Map());
    let ext = guard.get(alvoMO.chave);
    if (!ext) { ext = { id: 'x:' + alvoMO.chave, externo: true, dono: alvoMO.dono, mid: alvoMO.mid, nome: alvoMO.nome, hp: 1, hpMax: 1, armadura: 0, reducaoArmadura: 0, acumulos: 0, lento: 0, atordoado: 0, chefe: !!alvoMO.chefe }; guard.set(alvoMO.chave, ext); if (guard.size > 30) guard.delete(guard.keys().next().value); }
    ext.x = alvoMO.x; ext.y = alvoMO.y;
    const est = extEst.get(alvoMO.chave);
    ext.marca = Math.max(0, (est?.marca || 0) - agoraExt);
    if (d.wPronto && !K.distancia) (A.lancePorTecla ??= {}).W = A.lanceW;      // o W do Darius: o acerto diz o lance do W
    golpeBasico(ctx, ext);
    if (est) est.marca = agoraExt + (ext.marca || 0);
    emitir(c, 'ataqueMonstroOutro', { chave: alvoMO.chave });
  } else if (alvoM && !(alvoM.surgindo > 0) && dist(alvoM, A) <= alcAlvo + 0.05 && podeBater) golpeBasico(ctx, alvoM);
  if (alvoAtq && !A.andando) { const k = dist(alvoAtq, A) || 1; A.olhar = { x: (alvoAtq.x - A.x) / k, y: (alvoAtq.y - A.y) / k, t: 0.3 }; }
  A.alvo = alvoM?.id; A.alvoPvp = alvoJ?.nome || null;
  // Dragãozinho (bola de fogo a cada 2,5s) e Aranhinha (mordida a cada 3s) no monstro mais perto
  const petAtq = M.MASCOTES[estado.mascote];
  if (petAtq?.ataque) {
    const iv = petAtq.intervalo || 2.5;
    d.timers.mascote = d.timers.mascote ?? iv;
    const perto = vivos.filter((i) => i.hp > 0 && dist(i, A) < 6).sort((x, y) => dist(x, A) - dist(y, A))[0];
    if (d.timers.mascote <= 0 && perto) {
      d.timers.mascote = iv;
      golpear(estado, c, adEfetivo, perto, M.basePet(estado, a) * petAtq.ataque(M.nivelMascote(estado)), 'pet', { acumula: false });
      emitir(c, 'mascoteAtaque', { alvo: perto.id, pet: estado.mascote });
    }
  }

  moverMonstros(estado, c, A, a, vivos.filter((i) => i.hp > 0), dt);
  golpesVilemaw(estado, c, A, a, dt);
  if (A.pocas?.length) {         // poças de ácido do Barão: queimam quem está em cima
    A.pocas = A.pocas.filter((q) => q.ate > A.tempo);
    for (const q of A.pocas) if (c.darius.morto <= 0 && dist(A, q) < q.r) receberDano(estado, c, a, q.dps * dt, true);
  }
  if (c.darius.queimando > 0 && c.darius.morto <= 0) {          // queimadura do Sopro de Fogo dos guardiões
    c.darius.queimando = Math.max(0, c.darius.queimando - dt);
    receberDano(estado, c, a, (c.darius.queimaDano || 0) * dt, true);
  }
  if (A.isca) {                 // Passagem Shurimane: a cópia de energia atira a cada meio segundo até sumir
    if (A.isca.ate <= A.tempo) { A.isca = null; emitir(c, 'iscaSome', {}); }
    else if (A.tempo >= A.isca.prox) {
      A.isca.prox += 0.5;
      const alvoI = c.inimigos.filter((i) => i.hp > 0 && !i.morto && dist(i, A.isca) <= 6).sort((x, y) => dist(x, A.isca) - dist(y, A.isca))[0];
      if (alvoI) { emitir(c, 'iscaTiro', { alvo: alvoI.id, de: { x: A.isca.x, y: A.isca.y } }); golpear(estado, c, adEfetivo, alvoI, HK.B.iscaTiro[(r.B || 1) - 1] * adEfetivo.ad, 'B', { acumula: false }); }
    }
  }
  if (d.morto > 0) return;
  const base = M.localDaArena(estado.nivel);
  processarAbates(estado, c, a, A.mundo ? (i) => M.LOCAL[i.zona] || base : base, M.ARENA.bonus, Math.min(1 + M.GRUPO.porMembro * (M.GRUPO.max - 1), A.bonusGrupo || 1) * (A.zonaPk ? 1 + PK_BONUS : 1));
  c.inimigos = c.inimigos.filter((i) => !i.morto);
}

M.registrarArena(passoArena);


// o guardião da fortaleza, a cada 5 a 7 s: marca um círculo onde o campeão está e pisa forte 1,2 s depois
// o rodízio de golpes de cada guardião (chefes de verdade: 3 golpes; elites: pisão e anel). Todos marcam a área antes.
const GOLPES_GUARDIAO = {
  'Arauto do Vale': ['pisao', 'investida', 'anel'],
  'Dragão Infernal': ['pisao', 'sopro', 'chuva'],
  'Barão Nashor': ['pisao', 'tentaculos', 'acido'],
};
const NOME_GOLPE = { anel: 'Pancada Sísmica', investida: 'Investida', sopro: 'Sopro de Fogo', chuva: 'Chuva de Fogo', tentaculos: 'Tentáculos do Vazio', acido: 'Ácido Corrosivo' };
const COR_GOLPE = { anel: '255,90,40', investida: '255,40,30', sopro: '255,120,30', chuva: '255,110,30', tentaculos: '190,80,255', acido: '120,230,60' };
const distSegmento = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, n2 = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / n2)); return Math.hypot(p.x - (a.x + vx * k), p.y - (a.y + vy * k)); };
function pisaoGuardiao(estado, c, A, a, i, dt) {
  // abaixo de 30% da vida ele enfurece: bate mais rápido e mais forte (+10% de dano, era +25% até o p599), e ataca com mais frequência
  if (!i.furia && i.hp < i.hpMax * 0.3) { i.furia = true; i.as *= 1.6; i.ad *= 1.1; i.pisaoT = Math.min(i.pisaoT, 1); emitir(c, 'guardiaoFuria', { alvo: i.id }); }
  if (i.golpe) {
    const g = i.golpe;
    g.t -= dt;
    if (g.t > 0) return true;                 // parado, preparando o golpe
    i.golpe = null;
    const vivo = c.darius.morto <= 0;
    const barra = M.GOLPES_DE_LONGE.has(g.mec) ? M.ventoSegura(c, i) : null;
    if (barra) {
      if (g.mec === 'acido' && barra.x != null) { g.x = barra.x; g.y = barra.y; (A.pocas ??= []).push({ x: g.x, y: g.y, r: g.r, ate: A.tempo + 4.5, dps: a.vida * 0.03 }); }
      emitir(c, 'golpeGuardiao', { mec: g.mec, alvo: i.id, x: g.x, y: g.y, dx: g.dx, dy: g.dy, comp: g.comp, ang: g.ang, acertou: false, bloqueado: true, bx: barra.x, by: barra.y });
      return true;
    }
    const fis = (k) => receberDano(estado, c, a, i.ad * k * (100 / (100 + Math.max(0, a.armadura))), false, false, i);
    const mag = (k) => receberDano(estado, c, a, i.ad * k * (100 / (100 + Math.max(0, a.rm))), false, true, i);
    let acertou = false;
    if (g.mec === 'pisao') {
      acertou = vivo && dist(A, g) < g.r;
      if (acertou) fis(2);
      emitir(c, 'pisao', { x: g.x, y: g.y, raio: g.r, acertou });
      return true;
    }
    if (g.mec === 'anel') { acertou = vivo && dist(A, i) < g.r + 0.3; if (acertou) fis(2.2); }
    else if (g.mec === 'investida') {
      acertou = vivo && distSegmento(A, g, { x: g.ex, y: g.ey }) < g.larg / 2 + 0.3;
      if (acertou) fis(3);
      // o Arauto avança de verdade até o fim da linha (até onde dá para pisar)
      const n = Math.hypot(g.ex - i.x, g.ey - i.y) || 1;
      for (let d2 = n; d2 > 0; d2 -= 0.25) { const x = i.x + ((g.ex - i.x) / n) * d2, y = i.y + ((g.ey - i.y) / n) * d2; if (pisaMonstro(A, i, x, y)) { i.x = x; i.y = y; break; } }
    } else if (g.mec === 'sopro') {
      const dx = A.x - g.x, dy = A.y - g.y, d2 = Math.hypot(dx, dy), ang = Math.acos(Math.max(-1, Math.min(1, (dx * g.dx + dy * g.dy) / (d2 || 1))));
      acertou = vivo && d2 < g.comp && ang < g.ang + 0.1;
      if (acertou) { mag(2.4); c.darius.queimando = 3; c.darius.queimaDano = a.vida * 0.025; }
    } else if (g.mec === 'chuva' || g.mec === 'tentaculos') {
      const n = vivo ? g.pontos.filter((q) => dist(A, q) < q.r + 0.2).length : 0;
      acertou = n > 0;
      for (let k = 0; k < n; k++) g.mec === 'chuva' ? mag(1.6) : fis(2.4);
    } else if (g.mec === 'acido') {
      acertou = vivo && dist(A, g) < g.r;
      if (acertou) mag(1);
      (A.pocas ??= []).push({ x: g.x, y: g.y, r: g.r, ate: A.tempo + 4.5, dps: a.vida * 0.03 });
    }
    emitir(c, 'golpeGuardiao', { mec: g.mec, alvo: i.id, x: g.x, y: g.y, ex: g.ex, ey: g.ey, dx: g.dx, dy: g.dy, comp: g.comp, ang: g.ang, pontos: g.pontos, acertou });
    return true;
  }
  i.pisaoT -= dt;
  if (i.pisaoT <= 0 && dist(i, A) < 7) {
    i.pisaoT = i.furia ? 2.4 + Math.random() : 4.5 + Math.random() * 2;
    const rod = GOLPES_GUARDIAO[i.nome] || ['pisao', 'anel'];
    const mec = rod[(i.golpeK = (i.golpeK ?? -1) + 1) % rod.length];
    const t = mec === 'investida' ? 1.4 : 1.2, n = dist(i, A) || 1, ux = (A.x - i.x) / n, uy = (A.y - i.y) / n;
    let g;
    if (mec === 'pisao') g = { x: A.x, y: A.y, r: i.chefe ? 2.8 : 2.2 };
    else if (mec === 'anel') g = { x: i.x, y: i.y, r: 3.2 };
    else if (mec === 'investida') { const comp = Math.min(8, n + 2); g = { x: i.x, y: i.y, ex: i.x + ux * comp, ey: i.y + uy * comp, larg: 1.6 }; }
    else if (mec === 'sopro') g = { x: i.x, y: i.y, dx: ux, dy: uy, comp: 5.5, ang: 0.5 };
    else if (mec === 'chuva') g = { x: A.x, y: A.y, pontos: [{ x: A.x, y: A.y, r: 1.1 }, ...[0, 1, 2].map((k) => { const a2 = Math.random() * 6.28 + k * 2.1, r2 = 1.4 + Math.random() * 1.2; return { x: A.x + Math.cos(a2) * r2, y: A.y + Math.sin(a2) * r2, r: 1.1 }; })] };
    else if (mec === 'tentaculos') g = { x: A.x, y: A.y, pontos: [{ x: A.x, y: A.y, r: 1.2 }, ...[0, 1].map((k) => { const a2 = Math.random() * 6.28 + k * 3.14; return { x: A.x + Math.cos(a2) * 1.9, y: A.y + Math.sin(a2) * 1.9, r: 1.2 }; })] };
    else if (mec === 'acido') g = { x: A.x, y: A.y, r: 1.8 };
    i.golpe = { mec, t, ...g };
    if (mec === 'pisao') emitir(c, 'pisaoAviso', { x: g.x, y: g.y, raio: g.r, t });
    else {
      const forma = mec === 'anel' || mec === 'acido' ? 'circulo' : mec === 'investida' ? 'linha' : mec === 'sopro' ? 'cone' : 'circulos';
      emitir(c, 'golpeAviso', { forma, mec, alvo: i.id, t, nome: NOME_GOLPE[mec], cor: COR_GOLPE[mec], ...g });
    }
    return true;
  }
  return false;
}
// ---------- Vilemaw (chefe global, js/chefe-global.js): o servidor manda o golpe (golpeVilemaw) e cada jogo resolve no
// próprio campeão quando a marca vence: teia prende, veneno queima, rugido deixa lento, ovos viram crias que vêm atrás de você
// achou a Vilemaw: os monstros calmos em volta do covil vão embora (os que já atacam e as crias ficam)
export function limparCovil(c) {
  const A = c.arena, vm = A?.vm; if (!vm) return;
  for (const i of c.inimigos) if (!i.aggro && !i.invocado && i.guardiao == null && !i.chefe && Math.hypot(i.x - vm.x, i.y - vm.y) < VILEMAW.semMonstros) { i.morto = true; i.hp = 0; }
}
export function golpeVilemaw(c, g) { const A = c.arena; if (A) (A.vmGolpes ??= []).push({ ...g, quando: A.tempo + g.t }); }
const ORIGEM_VM = { nome: 'Vilemaw', id: 'vilemaw' };
function golpesVilemaw(estado, c, A, a, dt) {
  const d = c.darius, vivo = d.morto <= 0;
  // o dano é o de um Barão do nível dela, mas um golpe tira no máximo `teto` da vida máxima (quem é de nível baixo ainda participa)
  const bate = (k, magico, teto) => { const bruto = danoVilemaw(k) * (100 / (100 + Math.max(0, magico ? a.rm : a.armadura))); receberDano(estado, c, a, teto ? Math.min(bruto, a.vida * teto) : bruto, false, magico, ORIGEM_VM); };
  if (A.vmGolpes?.length) {
    const fila = A.vmGolpes; A.vmGolpes = [];
    for (const g of fila) {
      if (A.tempo < g.quando) { A.vmGolpes.push(g); continue; }
      const G = GOLPES_VILEMAW[g.mec];
      if (!G) continue;
      let acertou = false;
      if (g.pontos) acertou = vivo && g.pontos.some((q) => dist(A, q) < q.r + 0.2);      // teia, ovos, ninho, chuva ácida
      else if (g.mec === 'veneno') { const dx = A.x - g.x, dy = A.y - g.y, d2 = Math.hypot(dx, dy), ang = Math.acos(Math.max(-1, Math.min(1, (dx * g.dx + dy * g.dy) / (d2 || 1)))); acertou = vivo && d2 < g.comp && ang < g.ang + 0.1; }
      else if (g.mec === 'bote') acertou = vivo && distSegmento(A, g, { x: g.ex, y: g.ey }) < g.larg / 2 + 0.3;
      else if (g.mec === 'rugido') acertou = vivo && dist(A, g) < g.r + 0.3;
      if (acertou) {
        bate(G.k, !!G.magico, G.teto);
        if (G.preso) { A.presoJog = Math.max(A.presoJog || 0, G.preso); pararLotus(c, A); A.destino = null; }
        if (G.lento) A.lentoJog = Math.max(A.lentoJog || 0, G.lento);
        if (G.queima) { d.queimando = 4; d.queimaDano = a.vida * G.queima; }
      }
      // os ovos que caem perto viram crias que vêm atrás de você (só no seu jogo; sem saque)
      if (g.mec === 'ovos' && vivo) for (const q of g.pontos.filter((q2) => dist(A, q2) < 10).slice(0, 3)) {
        if (!podePisar(A, q.x, q.y)) continue;
        const m = M.criarMonstro('Cria de Vilemaw', estado.nivel, { chegada: 0, x: q.x, y: q.y, invocado: true });
        m.casa = { x: q.x, y: q.y }; m.zona = A.mundo?.zonaEm?.(q.x, q.y); m.aggro = true; m.voltando = false; m.vagar = 0;
        c.inimigos.push(m);
      }
      emitir(c, 'vmImpacto', { ...g, acertou });
    }
  }
  // colado nela: uma mordida de tempos em tempos
  const vm = A.vm;
  if (vm?.ativo && vivo && dist(A, vm) < vm.raio + VILEMAW.mordida.alcance) {
    A.vmMordida = (A.vmMordida ?? 0.6) - dt;
    if (A.vmMordida <= 0) { A.vmMordida = VILEMAW.mordida.cada; bate(VILEMAW.mordida.k, false, VILEMAW.mordida.teto); emitir(c, 'vmMordida', {}); }
  } else A.vmMordida = 0.6;
}
// a chave do baú: quem venceu o guardião e pegou a chave pode abrir o baú daquela fortaleza (vale 10 minutos)
// (as chaves pegas ficam em A.chavesMao; o jogo guarda a lista no navegador para não perder ao sair de Runeterra)
export const temChave = (A, fortaleza) => !!A?.chavesMao?.some((q) => q.fortaleza === fortaleza && q.ate > Date.now());
export const usarChave = (A, fortaleza) => { if (A?.chavesMao) A.chavesMao = A.chavesMao.filter((q) => q.fortaleza !== fortaleza); };

