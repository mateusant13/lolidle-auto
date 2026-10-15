// Camada visual: transforma o estado do motor em uma tela de OT — tiles, criaturas andando de tile em tile,
// nomes e barras coloridos pela vida, números de dano subindo, corpos, sangue e palavras de magia.
import { spriteCampeao } from './campeoes.js';
import { Particulas, pixelsDe, halo, mapearCor } from './fx.js';
import { T, DIR, sprite, corpo, aparencia, efeitoMachado, spriteEstandarte, estiloNovoLigado, ANIM_NOVA, tamanhoExtra, Pincel, contornar, tom, iconeChave, subidaMontaria } from './pixel.js';
import { gerarMapa, gerarMundo, gerarAbismo, caminho, vizinhos } from './mundo.js';
import { gerarFreljord } from './freljord.js';      // p668: o mapa da Dungeon do Braum
import { ARENA_PVP } from './arena-pvp.js';
import { zonaEm, cidadeEm, mundoLogico, ZONAS_PK, zonaPkEm, corZonaPk } from './runeterra.js';
import { t } from './i18n.js';
import { urlBrasao } from './guilda.js';
import { paredeBarra, PAREDE_PVP } from './motor.js';
import { ALCANCE_HAB } from './arena.js';
import { gerarQuadros as quadrosVilemaw, MARGEM as MARGEM_VM } from './vilemaw.js';
import { GOLPES_VILEMAW } from './chefe-global.js';
// as águas dentro de um retângulo de tiles: Runeterra tem ~22 mil e percorrer a lista toda a cada quadro pesava nas lutas
// (p611); a lista é separada por linha uma vez e só as linhas e colunas pedidas são olhadas
function aguaEm(m, x0, y0, x1, y1) {
  if (!m.aguaLinhas) { m.aguaLinhas = []; for (const q of m.agua) (m.aguaLinhas[q[1]] ??= []).push(q); }
  const r = [];
  for (let y = Math.max(0, y0); y <= y1; y++) for (const q of m.aguaLinhas[y] || []) if (q[0] >= x0 && q[0] <= x1) r.push(q);
  return r;
}
// panos com física (cabelo, capa, cachecol): a cada quadro só no seu campeão e nos PANO_PERTO jogadores mais perto;
// os outros refazem o pano a cada PANO_LONGE_S segundos (a Fonte cheia lagava)
const PANO_PERTO = 4, PANO_LONGE_S = 0.5, PANO_OUTRO_S = 1 / 15;      // p729 (eram 6, 0,4 s e 30 por segundo)
// brasões de guilda desenhados em cima do nome (uma imagem por brasão, carregada uma vez)
const imagensBrasao = new Map();
function imgBrasao(b) { let i = imagensBrasao.get(b); if (!i) { i = new Image(); i.src = urlBrasao(b); imagensBrasao.set(b, i); } return i; }

// a janela tem 11 tiles de altura; a largura começa em 15 (como no Tibia) e cresce até 24 em monitor largo
// (Cena.definirLargura, chamada pelo jogo.js; quem importa VIS_L enxerga o valor novo)
export let VIS_L = 15;
export const VIS_A = 11;
const ESCALA = 2;
// Skins com efeitos próprios: as habilidades mudam só de COR (mesmo tamanho, mesma área, mesmo dano).
// Cada cor das habilidades do campeão vira outra. As outras skins mudam só o personagem.
// mapas do Rift ao ar livre com passarinhos, coelhos e folhas caindo (vidaRota)
const RIFT_VIVO = new Set(['rota', 'selva', 'rio', 'barao']);
const SKINS_EFEITO = {
  // Lux Guardiã Estelar: luz violeta no lugar do rosa, estrelas ciano no lugar do dourado
  'lux@6': {
    flash: '200,160,255',
    '#ff9ae0': '#a87aff', '#ff5ac8': '#7a3aff', '#ffd0f0': '#d4c0ff', '#ffe0f4': '#e4daff', '#fff0f8': '#f0ecff', '#ffe8f8': '#ece4ff',
    '#fff0a0': '#8af4ff', '#ffe070': '#4ae4ff', '#ffe080': '#9af0ff', '#ffd040': '#30c8ff', '#fff0c0': '#c8faff',
    '#9ad8ff': '#ff9ae0', '#8ad0ff': '#ff8ad0', '#c8a0ff': '#ff7ac8',
  },
  // Pulsefire Ezreal: energia azul-elétrica no lugar do dourado, disparos magenta e orbe verde-água
  'ezreal@5': {
    flash: '90,200,255',              // clarão da tela
    '#ffd860': '#5af0ff', '#ffb020': '#20c8ff', '#ffe080': '#b0f8ff', '#ffe8a0': '#d0fcff', '#fff0b0': '#e0ffff', '#ffd060': '#60e8ff',
    '#ff9a20': '#1890ff', '#ff8a10': '#1478e8', '#ffc040': '#40d8ff', '#ff8a20': '#1a88f0', '#ffcf40': '#48e0ff', '#fff060': '#a0ffff',
    '#7ad8ff': '#ff5ad8', '#30c8ff': '#ff3aa8', '#c8f4ff': '#ffc8f0', '#5ab8ff': '#e05aff', '#9ae8ff': '#ff9ae8',
    '#b060ff': '#30ffc8', '#c890ff': '#80ffe0', '#e0b0ff': '#c0fff0', '#ff4a8a': '#40ffa0',
  },
  // Yasuo Florescer Espiritual: o vento fica rosa-claro, no tom #ffb3c1 que o dono escolheu (antes boa parte dos efeitos continuava azul)
  'yasuo@36': {
    flash: '255,179,193',
    '#bfe8ff': '#ffb3c1', '#9ad8ff': '#ff94aa', '#d8f0ff': '#ffc8d2', '#e8f4ff': '#ffdce3', '#3a7ab8': '#b85a6e', '#8ac8f0': '#ffa0b4',
    '#c8b0ff': '#ffaabd', '#5ab0e8': '#e88098', '#a0d7fa': '#ffa8b8', '#d2f0ff': '#ffc4cf', '#ffffff': '#ffe4ea', '#fff0f8': '#ffe8ee',
  },
  // Taric Embalos no Espaço: a luz das estrelas fica rosa e lilás
  'taric@18': {
    flash: '255,120,220',
    '#6af0ff': '#ff7ad8', '#9af4ff': '#ffa8ec', '#c8f8ff': '#ffd0f4', '#30c8ff': '#c050f0', '#ffd860': '#c8a0ff', '#ffe27a': '#e0a8ff', '#fff0b0': '#f8d8ff',
  },
  // Katarina Rainha de Batalha: o carmesim das lâminas vira magenta
  'katarina@29': {
    flash: '255,90,200',
    '#ff3a4a': '#ff5ac8', '#c8202c': '#d03a8a', '#7a0a14': '#7a1a5a', '#ff8aa0': '#ffa0e0', '#ff5a7a': '#ff7ad8', '#ffc0c8': '#ffd0f0', '#4a0810': '#4a0a3a',
  },
  // Deus-Rei Darius: luz divina dourada no lugar do vermelho-sangue
  'darius@15': {
    flash: '255,200,60',
    '#c01010': '#e0a020', '#ff3020': '#ffd040', '#ff5a2a': '#ffe070', '#ff4a2a': '#ffd860', '#ff2a1a': '#ffc830', '#ff6a40': '#fff0a0',
    '#ffd0a0': '#ffffff', '#ff4020': '#ffd040', '#b01010': '#e8b830', '#7a0808': '#a87818', '#d01020': '#ffc020', '#7a0810': '#b08010',
    '#ff9a30': '#fff080', '#ffa040': '#fff0a0', '#ff5020': '#ffd040', '#ffb040': '#ffffc0', '#ff9a5a': '#ffe8a0', '#ff2020': '#ffd030',
    '#ff8a5a': '#ffeaa0', '#ff1020': '#ffc020', '#ff3a20': '#ffd848', '#8a0808': '#a87818', '#ff8a3a': '#fff0a0', '#ffe0d0': '#ffffff',
  },
  // Darius de Porcelana: o vermelho-sangue vira azul porcelana e o dourado, branco-azulado (skin nova de 11/10/2026)
  'darius@54': {
    flash: '90,150,255',
    filtroEstandarte: 'hue-rotate(205deg) saturate(0.85) brightness(1.1)',
    '#7a0a0a': '#0a397b', '#a01414': '#134ea1', '#631212': '#113464', '#480d0d': '#0c2549', '#400c0c': '#0b2241', '#e890d0': '#94a4e4',
    '#f0c830': '#79bacf', '#c8a03a': '#75a6b6', '#4a0606': '#06224a', '#b01010': '#0f53b1', '#ff4a2a': '#2a83ff', '#2a0a0a': '#09172b',
    '#ff3a20': '#207dff', '#ff3020': '#207dff', '#c01010': '#0f59c1', '#ffd0c0': '#c3e4fc', '#7a0808': '#08377a', '#ff3030': '#3086ff',
    '#8a0808': '#083e8a', '#ff9a5a': '#62b9f7', '#ffe0c0': '#c3e4fc', '#d01818': '#1764d1', '#ff6a40': '#4090ff', '#a01010': '#0f4ca1',
    '#f08a1c': '#2796e5', '#a01d1d': '#1c53a1', '#701414': '#133a71', '#ffd0a0': '#a5d7fa', '#ff5a2a': '#2a83ff', '#ff5a3a': '#3a8cff',
    '#ff7a30': '#3aa7f5', '#d07a2a': '#3289c8', '#ff281e': '#1e7cff', '#ff2a1a': '#1a79ff', '#ffe0d0': '#d2ebfd', '#ff6a4a': '#4a95ff',
    '#ff8a5a': '#62b9f7', '#ffd040': '#8bc9dd', '#c8140a': '#0959c9', '#c81400': '#0053c8', '#280000': '#001128', '#ff2010': '#1074ff',
    '#ff5040': '#4090ff', '#ff9a30': '#3aa7f5', '#ff6a20': '#2ba0f4', '#ffa040': '#4aaef5', '#ffe0a0': '#d5ebf3', '#ff5020': '#207dff',
    '#ffb040': '#4aaef5', '#280a00': '#021726', '#ff9628': '#33a4f4', '#e87830': '#399adf', '#ff2030': '#207dff', '#d01020': '#0f60d1',
    '#7a0810': '#08377a', '#ff4a40': '#4090ff', '#c01020': '#0f59c1', '#ff6a30': '#3aa7f5', '#ff9a40': '#4aaef5', '#ffb070': '#77c2f8',
    '#d8a050': '#579ed1', '#ffd060': '#a3d4e4', '#ff503c': '#3c8dff', '#ff1a08': '#086fff', '#ff4a20': '#207dff', '#ff2020': '#207dff',
    '#ff4020': '#207dff', '#ff1020': '#1074ff', '#ff8a3a': '#44abf5',
  },
  // Ezreal PsyOps: energia verde neon no lugar do dourado, brilho rosa-choque no lugar do ciano (skin nova de 11/10/2026)
  'ezreal@22': {
    flash: '90,255,150',
    '#bee1ff': '#ffbefa', '#2a8ae0': '#e02ad1', '#6aade9': '#e96ade', '#195386': '#86197d', '#f0c830': '#30f060', '#e87830': '#30e89b',
    '#c8a03a': '#3ac85e', '#d07a2a': '#2ad08b', '#ffc040': '#40ff70', '#30c8ff': '#ff30ee', '#3a7aff': '#ff3aef', '#a06a20': '#20a06b',
    '#9ae8ff': '#ff9af7', '#ffe0a0': '#a0ffb8', '#ffe080': '#80ffa0', '#7ad8ff': '#ff7af4', '#c8f4ff': '#ffc8fa', '#ffd040': '#40ff70',
    '#3a5a9a': '#9a3a92', '#293f6c': '#6c2966', '#7a4426': '#267a57', '#956951': '#519579', '#693821': '#21694b', '#5f331e': '#1e5f44',
    '#9a5230': '#309a6e', '#b8866e': '#6eb899', '#a08a60': '#60a070', '#b37d64': '#64b392', '#8e6047': '#478e70', '#1a568b': '#8b1a82',
    '#75b3eb': '#eb75e1', '#94785f': '#5f947e', '#efc29a': '#9aefcc', '#f4d4b8': '#b8f4db', '#2a7ae8': '#e82ad8', '#a7886c': '#6ca78e',
    '#957a24': '#249540', '#f0c43a': '#3af068', '#f5d675': '#75f595', '#ad8d2a': '#2aad4b', '#5a4632': '#325a49', '#e0b040': '#40e068',
    '#866a26': '#26863e', '#5ad0ff': '#ff5af1', '#7bd9ff': '#ff7bf4', '#6d3c9e': '#3c9e9e', '#b060ff': '#60ffff', '#c890ff': '#90ffff',
    '#fff0c0': '#c0ffd0', '#e0b0ff': '#b0ffff', '#ffd860': '#60ff88', '#ffe8a0': '#a0ffb8', '#ffe066': '#66ff8c', '#fffbe0': '#e0ffe8',
    '#8ac8f0': '#f08ae8', '#ffb020': '#20ff58', '#1a8a8a': '#8a1a81', '#dcf0ff': '#ffdcfc', '#8cdeff': '#ff8cf5', '#ff9a20': '#20ffa2',
    '#ffd060': '#60ff88', '#fffadc': '#dcffe5', '#ffc850': '#50ff7c', '#ff7814': '#14ff9d', '#ff8a10': '#10ff9b', '#ffd278': '#78ff9a',
    '#0a1e2d': '#2d0a2a', '#fff0b0': '#b0ffc4', '#dcf5ff': '#ffdcfc', '#4c879e': '#9e4c97', '#a3e4ff': '#ffa3f7', '#fff6c0': '#c0ffd0',
    '#fff060': '#60ff88', '#ff4a8a': '#4aff4a', '#e0f8ff': '#ffe0fc', '#5ab8ff': '#ff5af1', '#3078ff': '#ff30ee', '#2a7ab8': '#b82aac',
    '#c8f0ff': '#ffc8fa', '#78c8ff': '#ff78f4', '#9ae0ff': '#ff9af7', '#b8f0ff': '#ffb8f9', '#62361e': '#1e6246', '#51889e': '#9e5198',
    '#83dcff': '#ff83f5', '#a8e7ff': '#ffa8f8', '#ff8a20': '#20ffa2', '#ffcf40': '#40ff70',
  },
  // Lux Empírea: a luz fica verde-água e menta, com o detalhe rosa (skin nova de 11/10/2026)
  'lux@42': {
    flash: '90,240,210',
    '#bee1ff': '#c1fce3', '#e890d0': '#90e1e8', '#f0c830': '#30f0ca', '#8ad0ff': '#90f9cd', '#3a7aff': '#44f5ab', '#a06a20': '#20a086',
    '#fff4b0': '#b0ffef', '#ffe070': '#70ffe2', '#fff0c0': '#c0fff2', '#e0b0ff': '#ffb0e5', '#ffe080': '#80ffe6', '#ff9ae0': '#9af7ff',
    '#ffe0f0': '#e0fcff', '#8ac8f0': '#8febc5', '#fff0a0': '#a0ffec', '#e0a0ff': '#ffa0df', '#ffbeeb': '#befaff', '#ffe1f8': '#e1fdff',
    '#9ad8ff': '#9ffad4', '#c8a0ff': '#ffa0df', '#a0ffd0': '#a0fff7', '#ffc890': '#90ffe9', '#ffaae6': '#aaf8ff', '#b8ffb0': '#b0fff8',
    '#c89a4a': '#4ac8af', '#ffd860': '#60ffdf', '#ffe0f4': '#e0fcff', '#ffd0f0': '#d0fbff', '#ff5ac8': '#5af1ff', '#ffecc8': '#c8fff4',
    '#1a0022': '#220017', '#c8a03a': '#3ac8ac', '#ffec96': '#96ffea', '#5a3a10': '#105a4b', '#ffe58a': '#8affe8', '#fff8d0': '#d0fff6',
    '#ffd0ff': '#d0fbff', '#dcf0ff': '#defdf0', '#ff7ad8': '#7af4ff', '#ffe060': '#60ffdf', '#ffc8ff': '#c8faff', '#6ad8ff': '#71f8c0',
    '#fff0b4': '#b4fff0', '#fff0be': '#befff2', '#c8ffe0': '#c8fffa', '#bfe8ff': '#c2fce4', '#ffc850': '#50ffdc', '#ffe0f8': '#e0fcff',
    '#ffb8ec': '#b8f9ff', '#ffd040': '#40ffd9', '#fff0f8': '#e6fff8', '#fff0fa': '#e8fffa', '#e8ffd0': '#d0fff0',
  },
  // Yasuo Emissário da Escuridão: o vento vira brasa vermelho-alaranjada (skin nova de 11/10/2026)
  'yasuo@9': {
    flash: '255,110,50',
    '#bee1ff': '#ff4c1f', '#e87830': '#ca2310', '#f0c830': '#d41e09', '#8ac8f0': '#e94820', '#d07a2a': '#b52d1e', '#c8a03a': '#ac3629',
    '#ffd040': '#e51700', '#d8f0ff': '#ff5227', '#bfe8ff': '#ff4c1f', '#fff2a0': '#ff1a00', '#ffd060': '#ee1800', '#ffae00': '#d41500',
    '#3a7ab8': '#af4930', '#9ad8ff': '#ff4314', '#d2f0ff': '#ff5125', '#a0d7fa': '#f9461a', '#ffb040': '#e51700', '#5ab0e8': '#e04018',
    '#c8b0ff': '#e10c1e', '#ffd860': '#ee1800', '#7ad8ff': '#ff3b0a', '#ffe8a0': '#ff1a00', '#040e20': '#210903', '#ffffff': '#ffc8b0',
    '#fff0f8': '#ffcdb8',
  },
  // Katarina Jurada de Morte: as lâminas ficam ciano espectral (skin nova de 11/10/2026)
  'katarina@10': {
    flash: '90,230,255',
    '#ac1c26': '#1b95ad', '#941821': '#178095', '#d1444e': '#42bbd3', '#e87830': '#39b3df', '#f0c830': '#30e0f0', '#d07a2a': '#32a0c8',
    '#c8a03a': '#3abcc8', '#ff3a4a': '#3adeff', '#ff5a7a': '#5ae4ff', '#ff8aa0': '#8aebff', '#ff5a64': '#5ae4ff', '#7a0a14': '#0a687b',
    '#ffc0c8': '#c0f5ff', '#4a0810': '#083f4a', '#2a0a1a': '#09252b', '#28040a': '#042228', '#c8202c': '#1eadca', '#fff060': '#60f2ff',
    '#ffd860': '#60f2ff', '#8aff6a': '#75f4d4', '#d0ffc0': '#c5faed', '#2a8a3a': '#31836e',
  },
  // Taric Cavaleiro de Hematita: as joias e a luz ficam vermelho-sangue (skin nova de 11/10/2026)
  'taric@3': {
    flash: '255,60,90',
    '#8ac8f0': '#d4152e', '#e890d0': '#ba263a', '#f0c830': '#a51539', '#c8a03a': '#882c43', '#6af0ff': '#e5001e', '#9af4ff': '#f00020',
    '#3a848c': '#8a333e', '#c8f8ff': '#fc0022', '#ffd040': '#b60a35', '#ffd860': '#bc0a36', '#30c8ff': '#d6001d', '#fff060': '#bc0a36',
    '#ffe27a': '#c10a38', '#fff0b0': '#cb0b3b', '#ff9ae0': '#e8001f', '#fff0a0': '#c80b3a', '#fff8d0': '#d10b3d', '#ffe8c0': '#ffb0b8',
  },
  // Zac Molho Picante: a gosma das habilidades fica amarelo-queijo e o ácido vira molho apimentado (laranja-avermelhado)
  'zac@24': {
    flash: '255,200,40',
    '#7ae83a': '#eac038', '#c8ff8a': '#ffe48a', '#3a9a1a': '#9b7d19', '#c8f03a': '#f56235', '#8ad020': '#d4471c', '#f0ffc0': '#ffccbc',
    '#d8ff5a': '#ff815a', '#c8ff9a': '#ffe79a', '#e8ffd8': '#fff3cd', '#a6f06a': '#f1d169', '#e8ff96': '#ffaf96', '#284608': '#481606',
    '#a0e628': '#eb5223', '#5aa014': '#a43310', '#78ff5a': '#ffd85a', '#061004': '#100a04', '#0a1408': '#140e08', '#061e04': '#1e1104',
  },
};
// eventos que não são habilidade do campeão: não passam pelo mapa de cores da skin
const EVENTOS_SEM_SKIN = new Set(['abate', 'recebido', 'item', 'nivel', 'morreu', 'pocao', 'semPocao', 'recall', 'recallCancelado', 'chefe', 'chefeCarrega',
  'chefeGolpe', 'chefeInterrompido', 'chefeInvoca', 'golpeAviso', 'golpeGuardiao', 'guardiaoFuria', 'guardiaoVencido', 'grupo', 'pisao', 'pisaoAviso',
  'tiroMonstro', 'chavePega', 'arenaFalhou', 'arenaPausa', 'arenaVolta', 'buffBarao', 'mascoteAtaque', 'mascoteNivel', 'vmImpacto', 'vmMordida', 'esquiva', 'kite']);
// contexto de desenho que troca as cores na hora (fillStyle, strokeStyle e gradientes)
function contextoTingido(g, mapa) {
  const cor = (c) => mapearCor(mapa, c);
  return new Proxy(g, {
    set(t, k, v) { t[k] = k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor' ? cor(v) : v; return true; },
    get(t, k) {
      const v = t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { const gr = v.apply(t, a), add = gr.addColorStop.bind(gr); gr.addColorStop = (o, c) => add(o, cor(c)); return gr; };
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}

const VEL_ONDA = 520;      // px/s da onda da Barragem Incendiária
const FONTE = '"Verdana", "Tahoma", sans-serif';
// impacto das habilidades de outros jogadores nos monstros da sua tela (p652): o que não tem dano (escudo, cura, buff) e o que é
// projétil (a colisão do p648) fica de fora; ajustes de tempo, pulsos e as áreas que caem no ponto do mouse
const AREA_OUTRO = {
  semImpacto: new Set(['darius:G', 'darius:F', 'darius:B', 'darius:D', 'ezreal:Q', 'ezreal:W', 'ezreal:A', 'ezreal:M', 'ezreal:R', 'ezreal:G', 'ezreal:F', 'ezreal:B', 'ezreal:D',
    'lux:Q', 'lux:A', 'lux:W', 'lux:B', 'lux:F', 'lux:D', 'lux:P', 'yasuo:W', 'yasuo:G', 'yasuo:B', 'yasuo:D', 'katarina:Q', 'katarina:A', 'katarina:W', 'katarina:G', 'katarina:F', 'katarina:B', 'katarina:D',
    'taric:A', 'taric:W', 'taric:R', 'taric:F', 'taric:B', 'taric:G', 'taric:D', 'zac:G', 'zac:B', 'zac:M', 'zac:D']),
  ajuste: {
    'darius:R': { atraso: 0.25, grande: true }, 'darius:N': { pulsos: [4, 1] }, 'darius:E': { ang: 55 },
    'ezreal:T': { ponto: 2.2, atraso: 0.4 }, 'ezreal:N': { atraso: 0.5, grande: true }, 'ezreal:E': { atraso: 0.2 },
    'lux:E': { ponto: 1.8, atraso: 0.9, grande: true }, 'lux:R': { atraso: 0.6, grande: true }, 'lux:T': { atraso: 0.6 }, 'lux:M': { ponto: 2.2, pulsos: [3, 0.3] }, 'lux:N': { pulsos: [5, 0.5] },
    'yasuo:R': { atraso: 0.3, grande: true }, 'yasuo:N': { pulsos: [5, 0.5] },
    'katarina:R': { pulsos: [5, 0.5] }, 'katarina:N': { pulsos: [6, 0.5] }, 'katarina:E': { atraso: 0.1 },
    'taric:E': { atraso: 1, grande: true }, 'taric:M': { ponto: 2.5, atraso: 0.5, grande: true }, 'taric:N': { atraso: 0.3, grande: true },
    'zac:E': { ponto: 2.5, atraso: 0.6, grande: true }, 'zac:F': { ponto: 1.8 }, 'zac:R': { pulsos: [4, 0.6] }, 'zac:N': { atraso: 0.3, grande: true },
  },
  cor: { darius: '#ff4a3a', ezreal: '#ffd060', lux: '#fff0a0', yasuo: '#bfe8ff', katarina: '#ff3a4a', taric: '#9af4ff', zac: '#7dff7a' },
};
// rótulos de texto já desenhados (nomes e níveis em cima das criaturas): trocar a fonte e desenhar texto com contorno a
// cada quadro é caro (no tablet era o que mais pesava depois do pano); cada rótulo vira uma imagem na resolução da tela
// e o quadro só a cola
const ROTULOS = new Map();
function rotulo(txt, font, fill, lw) {
  const k = `${font}|${fill}|${lw}|${txt}`;
  let r = ROTULOS.get(k);
  if (r) return r;
  const tam = parseFloat(/([\d.]+)px/.exec(font)?.[1] || 6), cv = document.createElement('canvas'), g = cv.getContext('2d');
  g.font = font;
  const wt = g.measureText(txt).width, w = Math.ceil(wt + lw * 2 + 2), h = Math.ceil(tam * 1.5 + lw * 2 + 2), by = Math.ceil(tam * 1.1 + lw + 1);
  cv.width = w * ESCALA; cv.height = h * ESCALA;
  g.setTransform(ESCALA, 0, 0, ESCALA, 0, 0); g.font = font; g.textAlign = 'center'; g.lineWidth = lw; g.strokeStyle = '#000'; g.fillStyle = fill;
  g.strokeText(txt, w / 2, by); g.fillText(txt, w / 2, by);
  r = { cv, w, h, by, wt };
  if (ROTULOS.size >= 800) ROTULOS.delete(ROTULOS.keys().next().value);
  ROTULOS.set(k, r);
  return r;
}
// como strokeText + fillText centrados em (x, y) (y é a linha de base); devolve o rótulo (wt = largura do texto)
function escrever(g, txt, x, y, font, fill, lw) { const r = rotulo(String(txt), font, fill, lw); g.drawImage(r.cv, x - r.w / 2, y - r.by, r.w, r.h); return r; }
// (fora da classe: dentro do kit do Ezreal "t" é a tecla da habilidade)
const apogeuDaManopla = () => t('Apogeu da Manopla!');
const furacaoDeLuz = () => t('Furacão de Luz!');
const dominioNoxus = () => t('Domínio de Noxus!');

const direcao = (dx, dy) => (dx > 0 ? DIR.L : dx < 0 ? DIR.O : dy < 0 ? DIR.N : DIR.S);
// cor da vida no padrão do Tibia: verde → verde claro → amarelo → vermelho → vermelho escuro
const corVida = (f) => (f > 0.92 ? '#00c000' : f > 0.6 ? '#60c060' : f > 0.3 ? '#c0c000' : f > 0.1 ? '#c03030' : '#c00000');
export const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString());

// desenha uma imagem girada em volta do próprio centro
function girado(g, img, x, y, ang, esc = 1, alpha = 1) {
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(ang);
  g.drawImage(img, (-img.width * esc) / 2, (-img.height * esc) / 2, img.width * esc, img.height * esc);
  g.restore();
}
// cópia do sprite pintada de uma cor (para brilhos de fúria, grito etc.)
const tintas = new WeakMap();
function tingido(img, cor) {
  let m = tintas.get(img);
  if (!m) tintas.set(img, (m = {}));
  if (m[cor]) return m[cor];
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = cor; g.fillRect(0, 0, c.width, c.height);
  return (m[cor] = c);
}

// Relíquia Shurimane: triângulo dourado num pedestal de pedra, com a gema azul
let reliquia = null;
function spriteReliquia() {
  if (reliquia) return reliquia;
  const c = document.createElement('canvas'); c.width = 24; c.height = 30;
  const g = c.getContext('2d');
  g.fillStyle = '#5a5248'; g.fillRect(4, 24, 16, 5); g.fillStyle = '#7a7266'; g.fillRect(4, 24, 16, 2); g.fillStyle = '#2a2620'; g.fillRect(4, 29, 16, 1);
  g.fillStyle = '#3a2a0a'; g.beginPath(); g.moveTo(12, 2); g.lineTo(22, 24); g.lineTo(2, 24); g.closePath(); g.fill();
  g.fillStyle = '#e0a830'; g.beginPath(); g.moveTo(12, 3); g.lineTo(21, 23); g.lineTo(3, 23); g.closePath(); g.fill();
  g.fillStyle = '#fff0b0'; g.beginPath(); g.moveTo(12, 3); g.lineTo(13, 5); g.lineTo(5, 22); g.lineTo(3, 23); g.closePath(); g.fill();
  g.fillStyle = '#2a1a06'; g.beginPath(); g.moveTo(12, 10); g.lineTo(17, 21); g.lineTo(7, 21); g.closePath(); g.fill();
  g.fillStyle = '#5ae0ff'; g.fillRect(11, 15, 3, 3); g.fillStyle = '#ffffff'; g.fillRect(11, 15, 1, 1);
  return (reliquia = c);
}

// Farol de Demacia (Lux): torre branca com faixas azuis, varanda dourada e o cristal de luz no alto
let farol = null;
function spriteFarol() {
  if (farol) return farol;
  const c = document.createElement('canvas'); c.width = 24; c.height = 38;
  const g = c.getContext('2d');
  g.fillStyle = '#5a5248'; g.fillRect(3, 32, 18, 5); g.fillStyle = '#7a7266'; g.fillRect(3, 32, 18, 2); g.fillStyle = '#2a2620'; g.fillRect(3, 37, 18, 1);
  g.fillStyle = '#2a2a3a'; g.beginPath(); g.moveTo(7.5, 12); g.lineTo(16.5, 12); g.lineTo(19.5, 32); g.lineTo(4.5, 32); g.closePath(); g.fill();
  g.fillStyle = '#f4f0e6'; g.beginPath(); g.moveTo(9, 13); g.lineTo(15, 13); g.lineTo(18, 32); g.lineTo(6, 32); g.closePath(); g.fill();
  g.fillStyle = '#c8c0b0'; g.beginPath(); g.moveTo(13, 13); g.lineTo(15, 13); g.lineTo(18, 32); g.lineTo(15, 32); g.closePath(); g.fill();
  g.fillStyle = '#2a4a9a'; g.fillRect(8, 18, 9, 2); g.fillRect(7, 26, 11, 2);
  g.fillStyle = '#e6b440'; g.fillRect(6, 11, 12, 2); g.fillStyle = '#8a6a20'; g.fillRect(6, 13, 12, 1);
  g.fillStyle = '#2a1a30'; g.beginPath(); g.moveTo(12, 0); g.lineTo(17, 6); g.lineTo(12, 12); g.lineTo(7, 6); g.closePath(); g.fill();
  g.fillStyle = '#ff9ae0'; g.beginPath(); g.moveTo(12, 1); g.lineTo(16, 6); g.lineTo(12, 11); g.lineTo(8, 6); g.closePath(); g.fill();
  g.fillStyle = '#ffd0f0'; g.beginPath(); g.moveTo(12, 1); g.lineTo(12, 11); g.lineTo(8, 6); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(10, 4, 2, 3);
  return (farol = c);
}
// estrela de 5 pontas (Chuva de Estrelas)
function estrela5(g, x, y, r, cor) {
  g.fillStyle = cor; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

// o ofício de cada NPC, em loop: quadros do sprite (10 a 13) e quantos por segundo
const ACAO_NPC = {
  Soraka: { seq: [10, 11, 12, 13, 12, 11], fps: 3, flutua: true },
  Ornn: { seq: [10, 10, 11, 12, 12, 13, 10, 10, 10], fps: 7 },
  Lojista: { seq: [10, 10, 10, 10, 11, 12, 12, 13, 10, 10, 10, 10, 10, 10], fps: 7 },
  'Capitão da Legião': { seq: [10, 11, 12, 12, 13, 13, 12, 12, 11, 10, 10, 10], fps: 1.5 },
  'Mestre da Legião': { seq: [10, 10, 11, 12, 13, 10, 10, 11, 12, 13, 10, 10, 10, 10, 10, 10], fps: 5 },
  'Tesoureira de Piltover': { seq: [10, 10, 10, 11, 12, 13, 10, 11, 12, 13, 10, 10, 10, 10, 10, 10, 10, 10], fps: 6 },
  'Burrinho de Carga': { seq: [10, 10, 11, 10, 13, 10, 10, 12, 12, 12, 10, 11, 10, 13, 10, 10, 19, 10], fps: 4 },
  Mercador: { seq: [10, 10, 10, 11, 12, 13, 12, 11, 10, 10, 10, 10, 19, 10], fps: 4 },
};
// o que cada NPC diz quando o campeão chega perto (estilo novo)
const SAUDACAO = {
  Soraka: ['Que as estrelas te guiem!', 'Precisa de cura?', 'Bem-vindo de volta!'],
  Lojista: ['Olá, freguês!', 'Poções fresquinhas!', 'Trouxe saque? Eu compro!'],
  'Capitão da Legião': ['Soldado!', 'Tenho trabalho para você.', 'Apresente-se!'],
  'Mestre da Legião': ['Pronto para treinar?', 'Postura, recruta!', 'A força vem da disciplina.'],
  'Tesoureira de Piltover': ['Seus bens estão seguros comigo.', 'Quer guardar alguma coisa?', 'Tudo anotado no livro-caixa.'],
  'Burrinho de Carga': ['Iá-óóó!', 'Iii-ó! Iii-ó!', 'Iá-óóó... (balança as orelhas)'],
  Mercador: ['Itens de todo Runeterra!', 'Compre e venda com outros campeões!', 'Ofertas novas chegando!'],
};
// o que cada NPC diz no balão quando o mouse passa por cima
const FALA_NPC = {
  Soraka: 'Ferido? Eu curo você.', Lojista: 'Compro seu saque. Tenho poções!', Ornn: 'Trouxe peças? Eu forjo.',
  'Capitão da Legião': 'Quer trabalho, soldado?', 'Mestre da Legião': 'Vamos refazer seu treino?',
  'Tesoureira de Piltover': 'Guardo seus itens e seu ouro.',
  'Burrinho de Carga': 'Carrega o cofre. Clique para guardar itens.',
  Mercador: 'Mercado dos jogadores: compre e venda itens.',
};
function novaCriatura(id, nome, p) {
  const a = aparencia(nome);
  return { id, nome, x: p.x, y: p.y, de: { ...p }, t: 1, dur: 0.2, vel: 0.2, fila: [], dir: DIR.S, passo: 0,
    atk: 0, vida: 1, acumulos: 0, grande: !!a.grande, parada: !!a.parada, surge: 0.35 };
}

export class Cena {
  constructor(canvas, falas, descreverItem) {
    this.cv = canvas;
    this.panoPasso = 1 / 30;        // o pano do seu campeão e dos mais próximos: no máximo 30 vezes por segundo
    this.leve = false;              // modo leve (jogo.js, aplicarDesempenho): sem bichos e enfeites animados
    canvas.width = VIS_L * T * ESCALA; canvas.height = VIS_A * T * ESCALA;
    this.g = canvas.getContext('2d');
    this.falas = falas;            // nomes das habilidades, ditos em laranja como palavras de magia
    this.descreverItem = descreverItem;   // id → { nome, cor }
    this.log = () => {};
    this.cam = { x: 0, y: 0 };
    this.mapas = {};
    this.tempo = 0;
    this.fx = new Particulas();
    this.agenda = [];          // efeitos marcados para daqui a pouco (ex.: o impacto depois da queda)
    this.auraT = 0; this.ambT = 0;
    this.bausAbertos = new Map();      // baús de fortaleza abertos (y * 1000 + x → até quando)
    this.sacos = new Map();            // sacos de quem morreu em Runeterra (id → { x, y, dono, itens })
    this.pisoes = []; this.ondas = []; this.chefeBarra = null;      // guardião: áreas marcadas, ondas de choque, barra de vida
  }

  entrarLocal(local) {
    this.local = local;
    this.bichosVivos = null; this.fonteVida = null; this.rotaVida = null;        // peixes, pombas, borboletas, passarinhos e coelhos são de cada mapa
    this.arena = !!local.arena; this.arenaPausado = false; this.estadoArena = null; this.miraArena = null;
    this.jogArena = new Map(); this.monsOutros = new Map(); this.projOutros = []; this.alvoPvp = null; this.paredes = [];
    this.mapa = this.mapas[local.id] ??= local.dungeon ? gerarFreljord() : local.aram ? gerarAbismo(ARENA_PVP.mapa) : local.arena ? gerarMundo() : gerarMapa(local.bioma, local.semente || 1);
    this.criaturas = new Map();
    this.npcs = this.mapa.npcs.map((n) => ({ ...novaCriatura('npc-' + n.nome, n.nome, n), npc: true, surge: 0 }));
    this.darius = novaCriatura('darius', this.skin || this.campeao || 'darius', local.base ? this.pontoNaFonte() : this.mapa.centro);
    this.outros = new Map();
    this.darius.vel = 0.18;
    this.textos = []; this.efeitos = []; this.corpos = []; this.manchas = []; this.baloes = []; this.avisos = []; this.moedas = []; this.conversas = [];
    this.tremor = 0; this.curaAcum = 0; this.curaT = 0; this.poder = false; this.morto = false;
    this.recall = 0; this.mana = 1; this.aoChegar = null;
    this.fx.limpar(); this.agenda = [];
    this.pet = this.petNome ? { ...novaCriatura('pet', this.petNome, this.mapa.centro), vel: 0.14, pet: true, surge: 0 } : null;
    this.efeito('poof', this.darius, 0.6);
  }

  // o campeão do jogador muda o sprite e os efeitos das habilidades
  definirCampeao(id, nome) {
    this.campeao = id; this.nomeCampeao = nome; this.definirSkin(this.skinNum || 0);
  }
  get atirador() { return this.campeao === 'ezreal' || this.campeao === 'lux'; }        // ataca de longe e recua (kiting)
  get maga() { return this.campeao === 'lux'; }
  get espadachim() { return this.campeao === 'yasuo'; }
  get assassina() { return this.campeao === 'katarina'; }
  get suporte() { return this.campeao === 'taric'; }
  get gelatina() { return this.campeao === 'zac'; }
  definirSkin(num) {
    this.skinNum = num;
    this.skin = spriteCampeao(this.campeao || 'darius', num);
    this.mapaSkin = SKINS_EFEITO[this.skin] || null; this.mapaProprio = this.mapaSkin;
    this.gTingido = this.mapaSkin ? contextoTingido(this.g, this.mapaSkin) : null;
    this.corFlash = this.mapaSkin?.flash || (this.campeao === 'ezreal' ? '255,200,90' : this.campeao === 'lux' ? '255,236,200' : this.campeao === 'yasuo' ? '191,232,255' : this.campeao === 'katarina' ? '255,58,74' : this.campeao === 'taric' ? '106,240,255' : this.campeao === 'zac' ? '120,255,90' : '200,0,0');
    if (this.darius) this.darius.nome = this.skin;
  }

  definirMascote(nome) {
    this.petNome = nome;
    if (!this.mapa) return;
    const d = this.darius;
    this.pet = nome ? { ...novaCriatura('pet', nome, { x: d.x, y: d.y }), vel: 0.14, pet: true, surge: 0.4 } : null;
  }
  // segue o Darius; quando o Poro está ativo, corre até os corpos para pegar o ouro
  guiarMascote() {
    const p = this.pet, d = this.darius;
    if (!p || p.fila.length || p.t < 1 || this.morto) return;
    if (p.levando) { p.levando = false; this.recolher(p.x, p.y, p); }
    // próxima pilha de moedas ainda no chão
    const pilha = this.moedas.find((m) => !m.voando && m.paraPet);
    if (pilha) {
      const passos = pilha.tx === p.x && pilha.ty === p.y ? [] : caminho(this.mapa, p, { x: pilha.tx, y: pilha.ty }, new Set(), 200);
      if (passos && passos.length <= 8) { if (passos.length) { p.fila = passos; p.levando = true; } else this.recolher(p.x, p.y, p); return; }
      pilha.paraPet = false; pilha.vida = 0.3;      // longe demais: as moedas vão direto para o Darius
    }
    const dist = Math.max(Math.abs(p.x - d.x), Math.abs(p.y - d.y));
    if (dist <= 1 && !(p.x === d.x && p.y === d.y)) { this.olhar(p, d); return; }
    if (dist > 8) { p.x = p.de.x = d.x; p.y = p.de.y = d.y; this.efeito('poof', p, 0.4); }
    const dd = this.destino(d), ocup = this.ocupados(d);
    const livres = vizinhos(dd).filter((q) => this.mapa.livre(q.x, q.y) && !ocup.has(q.x + ',' + q.y))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (livres[0]) { const passos = caminho(this.mapa, p, livres[0], ocup, 200); if (passos) p.fila = passos; }
  }

  // ---------- moedas no chão ----------
  // a pilha é lançada do corpo e cai; o Poro busca, senão as moedas voam até o Darius
  soltarMoedas(c, ouro) {
    const { px, py } = this.pos(c), n = Math.max(2, Math.min(7, Math.round(Math.log10(ouro + 1) * 2)));
    const r = Math.random, paraPet = !!this.pet?.nome.startsWith('Poro') && !this.morto && !this.arena;
    this.moedas.push({
      tx: c.x, ty: c.y, ouro, paraPet, voando: false, t: 0, vida: paraPet ? 8 : 0.9,
      sx: px + 16, sy: py + 16, x: px + 8 + r() * 14, y: py + 20 + r() * 6,
      pecas: Array.from({ length: n }, () => ({ dx: (r() - 0.5) * 12, dy: (r() - 0.5) * 5, fase: r() * 6 })),
    });
  }
  // moedas daquele tile voam para quem recolheu (Poro ou Darius)
  recolher(tx, ty, quem) {
    let total = 0;
    for (const m of this.moedas) if (!m.voando && m.tx === tx && m.ty === ty) { m.voando = quem; m.t = 0; total += m.ouro; }
    if (total) this.texto(quem, t('+{n} ouro', { n: fmt(total) }), '#f0d040', 0.9, 0.25);
  }
  atualizarMoedas(dt) {
    for (const m of this.moedas) {
      m.t += dt;
      if (m.voando) continue;
      m.vida -= dt;
      if (m.vida <= 0) { m.voando = this.darius; m.t = 0; this.texto(this.darius, t('+{n} ouro', { n: fmt(m.ouro) }), '#f0d040', 0.8, 0.3); }
    }
    this.moedas = this.moedas.filter((m) => !(m.voando && m.t > 0.35));
  }
  desenharMoedas(g) {
    for (const m of this.moedas) {
      let x = m.x, y = m.y;
      if (!m.voando && m.t < 0.4) {               // arco saindo do corpo
        const k = m.t / 0.4; x = m.sx + (m.x - m.sx) * k; y = m.sy + (m.y - m.sy) * k - Math.sin(k * Math.PI) * 14;
      } else if (m.voando) {                      // voando para quem recolheu
        const p = this.pos(m.voando), k = Math.min(1, m.t / 0.35);
        x = m.x + (p.px + 16 - m.x) * k; y = m.y + (p.py + 18 - m.y) * k - Math.sin(k * Math.PI) * 10;
      }
      if (!m.voando && m.t >= 0.4) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 3, 9, 3, 0, 0, Math.PI * 2); g.fill(); }
      for (const pc of m.pecas) {
        const cx = Math.round(x + pc.dx), cy = Math.round(y + pc.dy);
        g.fillStyle = '#2a1a00'; g.fillRect(cx - 3, cy - 2, 7, 5);
        g.fillStyle = '#f0b820'; g.fillRect(cx - 2, cy - 1, 5, 3);
        g.fillStyle = '#a87010'; g.fillRect(cx - 2, cy + 1, 5, 1);
        g.fillStyle = '#fff4b0'; g.fillRect(cx - 2, cy - 1, 2, 1);
        if (Math.sin(this.tempo * 5 + pc.fase) > 0.9) { g.fillStyle = '#ffffff'; g.fillRect(cx + 1, cy - 5, 1, 3); g.fillRect(cx, cy - 4, 3, 1); }
      }
    }
  }

  pontoNaFonte() {
    const c = this.mapa.centro, livres = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) if (this.mapa.livre(c.x + dx, c.y + dy)) livres.push({ x: c.x + dx, y: c.y + dy });
    return livres[Math.floor(Math.random() * livres.length)] || c;
  }

  // ---------- outros jogadores (só na Fonte) ----------
  definirOutros(lista) {
    if (this.local?.dungeon) return;      // na dungeon os outros são os aliados (definirAliados)
    if (!this.local?.base) lista = [];
    const vistos = new Set();
    for (const p of lista) {
      vistos.add(p.nome);
      const visual = spriteCampeao(p.campeao || 'darius', p.skin);
      let o = this.outros.get(p.nome);
      if (!o) {
        o = { ...novaCriatura('j-' + p.nome, visual, { x: p.x, y: p.y }), jogador: true, nomeJogador: p.nome, surge: 0.5, vel: 0.2, dir: p.dir };
        this.outros.set(p.nome, o);
      }
      o.nome = visual; o.titulo = p.titulo; o.nivel = p.nivel; o.vip = !!p.vip; o.brasao = p.brasao || null;
      const dest = this.destino(o);
      if (dest.x !== p.x || dest.y !== p.y) {
        const passos = caminho(this.mapa, dest, { x: p.x, y: p.y }, new Set(), 300);
        if (passos && passos.length <= 12) o.fila = passos;
        else { o.x = o.de.x = p.x; o.y = o.de.y = p.y; o.t = 1; o.fila = []; o.surge = 0.5; }
      } else if (!o.fila.length && o.t >= 1) o.dir = p.dir;
    }
    for (const nome of [...this.outros.keys()]) if (!vistos.has(nome)) this.outros.delete(nome);
  }

  // muda quantos tiles a tela mostra na largura (múltiplo de 1/4, para o canvas ter largura inteira)
  definirLargura(tiles) {
    VIS_L = Math.round(tiles * 4) / 4;
    this.cv.width = VIS_L * T * ESCALA;
  }

  // ---------- NPCs ----------
  npcEm(tx, ty) {
    // NPCs grandes (como o Ornn) ocupam 2×2 tiles acima e à esquerda do tile deles
    return this.npcs.find((n) => (n.grande ? tx >= n.x - 1 && tx <= n.x && ty >= n.y - 2 && ty <= n.y : n.x === tx && (n.y === ty || n.y === ty + 1)));
  }
  // converte um clique (coordenadas CSS do canvas) em tile do mundo
  clicar(x, y, largCss) {
    const k = largCss / (VIS_L * T);
    return this.npcEm(Math.floor((this.cam.x + x / k) / T), Math.floor((this.cam.y + y / k) / T));
  }
  // o jogador (na Fonte) no ponto clicado: o tile dele ou o de cima (o boneco é alto)
  jogadorEm(x, y, largCss) {
    const k = largCss / (VIS_L * T), tx = (this.cam.x + x / k) / T, ty = (this.cam.y + y / k) / T;
    let melhor = null, dist = 0.9;
    for (const o of this.outros.values()) { const p = this.pos(o), d = Math.hypot(tx - (p.px + 16) / T, ty - (p.py + 14) / T); if (d < dist) { dist = d; melhor = o.nomeJogador; } }
    return melhor;
  }
  // anda até ficar ao lado do NPC e então chama aoChegar
  irAte(npc, aoChegar) {
    const d = this.darius, ocup = this.ocupados(d);
    if (Math.max(Math.abs(d.x - npc.x), Math.abs(d.y - npc.y)) <= 1 && !d.fila.length) { this.olhar(d, npc); aoChegar(); return; }
    const alvos = vizinhos(npc).filter((p) => this.mapa.livre(p.x, p.y) && !ocup.has(p.x + ',' + p.y))
      .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
    for (const a of alvos) {
      const passos = caminho(this.mapa, this.destino(d), a, ocup, 600);
      if (passos) { d.fila = passos; this.aoChegar = { npc, f: aoChegar }; return; }
    }
    aoChegar();
  }

  // Fonte: botão direito no chão (coordenadas CSS do canvas) faz o campeão andar até lá; devolve true se achou caminho
  andarPara(x, y, largCss) {
    const k = largCss / (VIS_L * T), tx = Math.floor((this.cam.x + x / k) / T), ty = Math.floor((this.cam.y + y / k) / T);
    const d = this.darius, m = this.mapa, ocup = this.ocupados(d), livre = (p) => m.livre(p.x, p.y) && !ocup.has(p.x + ',' + p.y);
    // clicou num lugar ocupado (fonte, banca, árvore): vai para o vizinho livre mais perto do clique
    const alvo = livre({ x: tx, y: ty }) ? { x: tx, y: ty }
      : vizinhos({ x: tx, y: ty }).filter(livre).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (!alvo) return false;
    const passos = caminho(m, { x: d.x, y: d.y }, alvo, ocup, 1500);
    if (!passos) return false;
    d.fila = passos; this.aoChegar = null;
    this.destinoFonte = { x: alvo.x, y: alvo.y, t: 0 };
    return true;
  }
  // marca verde no chão onde o jogador clicou (some em 0,6 s)
  desenharDestinoFonte(g, dt) {
    const dc = this.destinoFonte;
    if (!dc || dc.t >= 0.6) return;
    dc.t += dt;
    const k = dc.t / 0.6, x = dc.x * T + 16, y = dc.y * T + 28;
    g.strokeStyle = `rgba(90,230,110,${1 - k})`; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x, y, 10 * (1 - k * 0.6), 5 * (1 - k * 0.6), 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = `rgba(90,230,110,${1 - k})`;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillRect(Math.round(x + dx * (5 + 6 * k)) - 1, Math.round(y + dy * (3 + 3 * k)) - 1, 2, 2);
  }

  // ---------- movimento ----------
  andar(c, dt) {
    // c.dist = quanto a criatura já andou (em tiles): é ele que marca o ciclo do passo (ver desenharCriatura)
    let sobra = 0;
    if (c.t < 1) {
      const t0 = c.t, nt = c.t + dt / c.dur;
      if (nt > 1) sobra = (nt - 1) * c.dur;            // o tempo que passou do fim do tile vai para o próximo (sem tranco)
      c.t = Math.min(1, nt); c.dist = (c.dist || 0) + (c.t - t0);
    }
    if (c.t >= 1 && c.fila.length) {
      const n = c.fila.shift();
      c.de = { x: c.x, y: c.y };
      c.dir = direcao(n.x - c.x, n.y - c.y);
      c.dur = c.vel * (n.x !== c.x && n.y !== c.y ? 1.4 : 1);
      c.x = n.x; c.y = n.y; c.passo ^= 1;
      c.t = Math.min(1, sobra / c.dur); c.dist = (c.dist || 0) + c.t;
      if (c === this.darius && this.fx) this.fx.explosao(c.de.x * T + 16, c.de.y * T + 28, { qtd: 3, vel: 18, cor: ['#b8a07a', '#d0bc96'], vida: 0.45, tam: 2, encolhe: true, grav: -6 });
    }
    // posição desenhada (sx, sy) segue a real com uma mola rápida: as curvas de 90° viram curvas arredondadas e
    // qualquer tranco some; teleporte (salto grande) não é suavizado
    const lx = c.de.x + (c.x - c.de.x) * c.t, ly = c.de.y + (c.y - c.de.y) * c.t;
    if (c.ix0 != null) { c.it += dt; const k = Math.min(1, c.it / 0.05); c.sx = c.ix0 + (c.ixA - c.ix0) * k; c.sy = c.iy0 + (c.iyA - c.iy0) * k; }      // Runeterra (ver colocar)
    else if (c.sx == null || Math.abs(lx - c.sx) + Math.abs(ly - c.sy) > 2) { c.sx = lx; c.sy = ly; }
    else { const k = 1 - Math.exp(-dt * 16); c.sx += (lx - c.sx) * k; c.sy += (ly - c.sy) * k; }
    c.atk = Math.max(0, c.atk - dt);
    c.surge = Math.max(0, c.surge - dt);
    c.hit = Math.max(0, (c.hit || 0) - dt);
    c.canal = Math.max(0, (c.canal || 0) - dt);
    if (c.giro > 0) { c.giro -= dt; c.dir = [DIR.S, DIR.L, DIR.N, DIR.O][Math.floor(c.giro / 0.055) % 4]; if (c.giro <= 0 && c.dirAntes != null) c.dir = c.dirAntes; }
    if (c.salto > 0) c.salto = Math.max(0, c.salto - dt);
    if (c.pulo > 0) c.pulo = Math.max(0, c.pulo - dt);
    if (c.empurrao > 0) c.empurrao = Math.max(0, c.empurrao - dt);
  }
  pos(c) {
    const k = c.t;
    let px = (c.sx ?? c.de.x + (c.x - c.de.x) * k) * T, py = (c.sy ?? c.de.y + (c.y - c.de.y) * k) * T;
    if (c.salto > 0) {      // salto da Guilhotina: sobe e avança na direção do alvo
      const k = 1 - c.salto / 0.32, arco = Math.sin(k * Math.PI);
      px += (c.saltoDx || 0) * arco * 10; py += (c.saltoDy || 0) * arco * 10 - arco * 22;
    }
    if (c.pulo > 0) py -= Math.sin((1 - c.pulo / (c.puloDur || 0.6)) * Math.PI) * (c.puloAlto || 30);      // Apogeu da Manopla: o Ezreal salta no lugar
    if (c.zacVoo) { const o = this.vooZac(c); px += o.x; py += o.y; }      // Zac: o voo do Estilingue Elástico
    if (c.empurrao > 0) {   // empurrado por um golpe
      const k = c.empurrao / 0.16; px += (c.empDx || 0) * 4 * k; py += (c.empDy || 0) * 4 * k;
    }
    if (c.atk > 0) {        // avanço curto no golpe
      const e = Math.sin((c.atk / 0.22) * Math.PI) * 4;
      px += c.dir === DIR.L ? e : c.dir === DIR.O ? -e : 0; py += c.dir === DIR.S ? e : c.dir === DIR.N ? -e : 0;
    }
    return { px, py };
  }
  destino(c) { return c.fila.length ? c.fila[c.fila.length - 1] : { x: c.x, y: c.y }; }
  ocupados(exceto) {
    const s = new Set();
    for (const c of [this.darius, ...this.criaturas.values(), ...this.npcs]) if (c !== exceto) { const d = this.destino(c); s.add(d.x + ',' + d.y); }
    return s;
  }
  olhar(c, alvo) { const dx = alvo.x - c.x, dy = alvo.y - c.y; if (dx || dy) c.dir = Math.abs(dx) >= Math.abs(dy) ? direcao(dx, 0) : direcao(0, dy); }

  // entre as ondas o Darius dá uns passos pelo mapa, como quem está caçando
  passear() {
    const d = this.darius, m = this.mapa, r = Math.random;
    for (let tent = 0; tent < 12; tent++) {
      let x = d.x + Math.round((r() - 0.5) * 7), y = d.y + Math.round((r() - 0.5) * 5);
      x = Math.max(9, Math.min(m.larg - 10, x)); y = Math.max(7, Math.min(m.alt - 8, y));
      if (!m.livre(x, y) || (x === d.x && y === d.y)) continue;
      const passos = caminho(m, d, { x, y }, this.ocupados(d), 150);
      if (passos && passos.length <= 5) { d.fila = passos; return; }
    }
  }

  surgir(inimigo) {
    const m = this.mapa, alvo = this.destino(this.darius), ocup = this.ocupados();
    const v = novaCriatura(inimigo.id, inimigo.nome, alvo);
    v.chefe = !!inimigo.chefe; v.distancia = inimigo.distancia || 0;
    const livresPerto = v.distancia > 1 ? this.anel(alvo, v.distancia, ocup) : vizinhos(alvo).filter((p) => m.livre(p.x, p.y) && !ocup.has(p.x + ',' + p.y));
    if (v.parada || !livresPerto.length) {
      const p = livresPerto[0] || alvo;
      v.x = v.de.x = p.x; v.y = v.de.y = p.y; v.surge = 0.6;
      this.efeito('poof', v, 0.6);
      this.criaturas.set(v.id, v); this.olhar(v, alvo);
      return;
    }
    // nasce a 4–6 tiles de distância e caminha até encostar no Darius
    const cands = [];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -7; dx <= 7; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = alvo.x + dx, y = alvo.y + dy;
      if (dist >= Math.max(4, v.distancia + 2) && dist <= Math.max(6, v.distancia + 3) && m.livre(x, y) && !ocup.has(x + ',' + y)) cands.push({ x, y });
    }
    for (let tent = 0; tent < 8 && cands.length; tent++) {
      const ini = cands.splice((Math.random() * cands.length) | 0, 1)[0];
      livresPerto.sort((a, b) => Math.hypot(a.x - ini.x, a.y - ini.y) - Math.hypot(b.x - ini.x, b.y - ini.y));
      const passos = caminho(m, ini, livresPerto[0], ocup, 500);
      if (!passos) continue;
      v.x = v.de.x = ini.x; v.y = v.de.y = ini.y;
      v.fila = passos; v.vel = Math.max(0.12, Math.min(0.5, inimigo.chegada / Math.max(1, passos.length)));
      this.criaturas.set(v.id, v);
      return;
    }
    const p = livresPerto[0];
    v.x = v.de.x = p.x; v.y = v.de.y = p.y;
    this.criaturas.set(v.id, v);
  }

  // quadrados livres a exatamente "raio" quadrados de distância (para quem ataca de longe)
  anel(p, raio, ocup) {
    const r = [];
    for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++)
      if (Math.max(Math.abs(dx), Math.abs(dy)) === raio && this.mapa.livre(p.x + dx, p.y + dy) && !ocup.has(p.x + dx + ',' + (p.y + dy))) r.push({ x: p.x + dx, y: p.y + dy });
    return r;
  }
  // já está lutando mas ficou longe (Darius andou, caminho estava ocupado): procura um tile colado nele
  encostar(v) {
    v.busca = this.tempo + 0.5;
    const d = this.destino(this.darius), raio = v.distancia > 1 ? v.distancia : 1;
    if (Math.max(Math.abs(v.x - d.x), Math.abs(v.y - d.y)) <= raio) return;
    const ocup = this.ocupados(v);
    const alvos = (raio > 1 ? this.anel(d, raio, ocup) : vizinhos(d).filter((p) => this.mapa.livre(p.x, p.y) && !ocup.has(p.x + ',' + p.y)))
      .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
    for (const a of alvos.slice(0, 3)) {
      const passos = caminho(this.mapa, v, a, ocup, 300);
      if (passos) { v.fila = passos; v.vel = 0.12; return; }
    }
  }

  // ---------- sincronia com o motor ----------
  sincronizar(combate, vidaFrac, manaFrac) {
    const d = combate.darius;
    this.darius.vida = Math.max(0, vidaFrac);
    this.mana = Math.max(0, manaFrac);
    this.recall = d.recall;
    this.grito = d.grito > 0; this.furiaS = d.furiaS > 0; this.estandarte = d.estandarte; this.wPronto = d.wPronto;
    this.queimando = d.queimando; this.forcaAcum = d.forcaAcum || 0; this.folego = d.folego ?? 1;
    this.poder = d.poder > 0;
    this.cargasTornado(d);
    this.adagasDoMotor(combate);
    this.gosmasDoMotor(combate);
    const ids = new Set();
    this.furiaGrupo = combate.inimigos.some((i) => i.furioso && !i.morto && i.hp > 0);      // um furioso vivo: os outros ficam bravos
    for (const i of combate.inimigos) {
      if (i.morto) continue;
      ids.add(i.id);
      let v = this.criaturas.get(i.id);
      if (!v) { this.surgir(i); v = this.criaturas.get(i.id); }
      if (!v) continue;
      v.elite = !!i.elite; v.guardiao = i.guardiao != null; v.miniChefe = !!i.furioso; v.spriteNome = v.guardiao ? i.nome + '#guardiao' : v.miniChefe ? i.nome + '#furioso' : null;
      if (v.guardiao && i.aggro && Math.hypot(i.x - (this.estadoArena?.x ?? 0), i.y - (this.estadoArena?.y ?? 0)) < 14) this.chefeBarra = { nome: i.nome, vida: i.hp / i.hpMax, t: this.tempo };
      v.vida = Math.max(0, i.hp / i.hpMax); v.acumulos = i.acumulos; v.atordoado = i.atordoado > 0 && !(i.surgindo > 0); v.surgindo = i.surgindo > 0 ? i.surgindo : 0; v.noturno = !!i.noturno; v.marca = i.marca > 0; v.noAr = i.noAr || 0;
      if (i.chegada <= 0 && v.fila.length) v.vel = 0.07;       // puxado pela E
      if (!v.fila.length && v.t >= 1) {
        if ((i.chegada <= 0 || this.atirador) && !v.parada && this.tempo > (v.busca || 0)) { this.encostar(v); if (i.chegada > 0) v.vel = Math.max(v.vel, 0.3); }
        this.olhar(v, this.darius);
      }
    }
    for (const id of this.criaturas.keys()) if (!ids.has(id)) this.criaturas.delete(id);
    // o atirador mira o monstro mais próximo, mesmo que ainda esteja chegando
    const alvo = this.atirador
      ? combate.inimigos.filter((i) => i.hp > 0 && !i.morto).sort((x, y) => x.chegada - y.chegada)[0]
      : combate.inimigos.find((i) => i.hp > 0 && i.chegada <= 0 && !i.morto);
    const va = alvo && this.criaturas.get(alvo.id);
    if (va && !this.darius.fila.length && this.darius.t >= 1) {
      this.olhar(this.darius, va);
      const d = this.darius, longe = Math.max(Math.abs(va.x - d.x), Math.abs(va.y - d.y)) > 1;
      if (!this.atirador && va.distancia > 1 && longe && !this.morto && this.tempo > (d.busca || 0)) {
        d.busca = this.tempo + 0.6;
        const ocup = this.ocupados(d);
        const lados = vizinhos(va).filter((p) => this.mapa.livre(p.x, p.y) && !ocup.has(p.x + ',' + p.y)).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
        for (const p of lados.slice(0, 3)) { const passos = caminho(this.mapa, d, p, ocup, 300); if (passos) { d.fila = passos; break; } }
      }
    }
    this.alvo = va;
  }

  // ---------- Dungeon do Braum (p670): a luta vem do servidor e a cena só desenha ----------
  // os aliados: em volta do seu campeão, parados (eles lutam de onde estão, como você no Rift); caído vira corpo
  definirAliados(lista) {
    const vistos = new Set(), base = this.mapa.centro;
    const lugares = [[-2, 1], [2, 1], [-1, -2], [1, -2], [-3, -1], [3, -1]];
    lista.forEach((p, k) => {
      vistos.add(p.nome);
      let o = this.outros.get(p.nome);
      if (!o) {
        const [dx, dy] = lugares[k % lugares.length];
        let x = base.x + dx, y = base.y + dy;
        for (let r = 0; r < 4 && !this.mapa.livre(x, y); r++) { x = base.x + dx + (r + 1) * Math.sign(dx || 1); }
        o = { ...novaCriatura('j-' + p.nome, spriteCampeao(p.campeao || 'darius', p.skin || 0), { x, y }), jogador: true, aliado: true, nomeJogador: p.nome, campeaoId: p.campeao, surge: 0.6, vel: 0.2, dir: DIR.N };
        this.outros.set(p.nome, o); this.efeito('poof', o, 0.6);
      }
      o.nivel = p.nivel; o.vida = p.vidaMax ? Math.max(0, p.vida / p.vidaMax) : 1;
      if (p.morto && !o.caido) { o.caido = true; this.corpos.push({ x: o.x, y: o.y, img: corpo(o.nome), t: 0, dur: 600, dono: p.nome }); o.oculto = true; }
      else if (!p.morto && o.caido) { o.caido = false; o.oculto = false; this.corpos = this.corpos.filter((c) => c.dono !== p.nome); this.efeito('poof', o, 0.6); this.brilhos(this.centro(o).x, this.centro(o).y, ['#bfe8ff', '#ffffff'], 16, 70); }
    });
    for (const nome of [...this.outros.keys()]) if (!vistos.has(nome)) this.outros.delete(nome);
  }
  // o evento de um aliado: desenhado como se fosse ele (a posição, a pose e as cores da skin DELE e o campeão dele)
  comoAliado(o, campeao, f) {
    const meu = this.campeao;
    this.campeao = campeao;
    try { this.comoOutro(o, f); } finally { this.campeao = meu; }
  }
  // um monstro da dungeon morreu (o abate vem uma vez só, de quem estiver mais perto no servidor)
  abateDungeon(id) {
    const v = this.criaturas.get(id);
    if (!v) return;
    this.desfazer(v);
    this.corpos.push({ x: v.x, y: v.y, img: corpo(v.spriteNome || v.nome), grande: v.grande, t: 0, dur: 6 });
    const c = this.centro(v);
    this.fx.explosao(c.x, c.y + 6, { qtd: v.chefe ? 60 : 14, vel: v.chefe ? 140 : 60, cor: ['#ffffff', '#cfe8f7', '#8ad8ff'], vida: v.chefe ? 1.4 : 0.7, tam: 2, encolhe: true, grav: 40 });
    if (v.chefe) {
      this.tremor = 0.8; this.flash = 0.5; this.corFlash = '200,240,255';
      this.onda(c.x, c.y + 20, 7 * T, '#bfe8ff', 1.1, 6); this.onda(c.x, c.y + 20, 4 * T, '#ffffff', 0.8, 4);
      this.texto(v, t('Braum foi vencido!'), '#ffe08a', 1.6, 0.2);
    }
    this.criaturas.delete(id);
  }
  // a criatura (sua, de um aliado ou o monstro) pelo nome de quem é / pelo id do monstro
  quemNaDungeon(nome) { return nome === this.nomeJogador ? this.darius : this.outros.get(nome) || null; }
  peNaDungeon(c) { const p = this.centro(c); return { x: p.x / T, y: (p.y + (c.grande ? 24 : 10)) / T }; }
  // as mecânicas dos bonecos e do Braum (o registro da luta, no tempo certo)
  dungeonMecanica(l) {
    const braum = [...this.criaturas.values()].find((v) => v.nome === 'Braum');
    const mon = l.id ? this.criaturas.get(l.id) : null, alvo = l.alvo ? this.quemNaDungeon(l.alvo) : null;
    const gelo = '160,225,255';
    switch (l.tipo) {
      case 'avalancheAviso': {
        if (!alvo) break;
        const p = this.peNaDungeon(alvo);
        this.pisoes.push({ x: p.x, y: p.y, raio: 1.5, t: 0, dur: l.dur || 1.2, rgb: gelo });
        if (mon) { mon.atk = 0.4; this.balao(mon, t('Poro!'), '#bfe8ff'); this.olhar(mon, alvo); }
        break;
      }
      case 'avalanche': {
        if (!alvo) break;
        const de = mon || braum;
        if (de) this.projetil('disparo', de, alvo, 0.3, '#f0faff');
        this.depois(0.28, () => {
          const c = this.centro(alvo);
          this.tremor = Math.max(this.tremor || 0, 0.35);
          this.fx.explosao(c.x, c.y + 8, { qtd: 34, vel: 110, cor: ['#ffffff', '#e8f6ff', '#bcdcf0'], vida: 0.9, tam: 3, encolhe: true, grav: 160, achatado: 0.5 });
          this.onda(c.x, c.y + 10, 1.6 * T, '#e8f6ff', 0.5, 4);
          this.texto(alvo, t('Bola de neve!'), '#e8f6ff', 1.1);
        });
        break;
      }
      case 'mordida': if (alvo) { this.texto(alvo, t('Atordoado!'), '#ffe040', 1); this.estrela4(this.centro(alvo).x, this.centro(alvo).y - 18, '#bfe8ff', 20); if (braum) braum.atk = 0.3; } break;
      case 'inquebravel': {
        if (!braum) break;
        this.efeito('barreira', braum, l.dur || 4); braum.quadroDg = { q: 5, ate: this.tempo + (l.dur || 4) };
        this.balao(braum, t('Inquebrável!'), '#9fe0ff');
        const c = this.centro(braum); this.onda(c.x, c.y + 20, 2.6 * T, '#9fe0ff', 0.7, 4); this.brilhos(c.x, c.y, ['#ffffff', '#9fe0ff'], 24, 90);
        break;
      }
      case 'fissuraAviso': {
        if (!braum) break;
        const p = this.peNaDungeon(this.darius);
        this.pisoes.push({ x: p.x, y: p.y, raio: 4.2, t: 0, dur: l.dur || 1.5, rgb: gelo });
        braum.atk = 0.6; braum.pulo = 0.8; braum.puloDur = 0.8; braum.puloAlto = 20; braum.quadroDg = { q: 6, ate: this.tempo + (l.dur || 1.5) };
        this.balao(braum, t('Fissura Glacial!'), '#9fe0ff');
        this.aviso(t('Braum prepara a Fissura Glacial!'), '#9fe0ff');
        break;
      }
      case 'fissura': {
        if (braum) braum.quadroDg = { q: 7, ate: this.tempo + 0.7 };
        const de = braum ? this.centro(braum) : this.centro(this.darius), para = this.centro(this.darius);
        this.tremor = 0.7; this.flash = 0.3; this.corFlash = gelo;
        // a fissura: estacas de gelo saindo do chão do Braum até o grupo
        for (let k = 0; k <= 12; k++) {
          const f = k / 12, x = de.x + (para.x - de.x) * f, y = de.y + 20 + (para.y - de.y) * f;
          this.depois(k * 0.03, () => { this.fx.explosao(x, y, { qtd: 8, vel: 70, ang: -Math.PI / 2, abertura: 1.2, cor: ['#ffffff', '#bfe8ff', '#7ac8f0'], vida: 0.7, tam: 3, grav: 140, encolhe: true }); this.estrela4(x, y - 6, '#bfe8ff', 14); });
        }
        this.onda(para.x, para.y + 10, 4.2 * T, '#bfe8ff', 0.8, 6);
        for (const c of [this.darius, ...this.outros.values()]) if (!c.oculto) { c.pulo = 0.6; c.puloDur = 0.6; c.puloAlto = 26; }
        break;
      }
      case 'braumQ': {      // Mordida do Inverno: gelo arremessado com o escudo
        if (!braum || !alvo) break;
        braum.atk = 0.4; braum.quadroDg = { q: 4, ate: this.tempo + 0.6 }; this.olhar(braum, alvo); this.balao(braum, t('Mordida do Inverno!'), '#9fe0ff');
        this.projetil('disparo', braum, alvo, 0.35, '#bfe8ff');
        this.depois(0.33, () => { const c = this.centro(alvo); this.fx.explosao(c.x, c.y, { qtd: 22, vel: 90, cor: ['#ffffff', '#bfe8ff', '#7ac8f0'], vida: 0.7, tam: 2.4, encolhe: true, forma: 'faisca' }); this.onda(c.x, c.y + 10, 1.2 * T, '#bfe8ff', 0.5, 3); this.texto(alvo, t('Congelado!'), '#bfe8ff', 1); });
        break;
      }
      case 'braumSalto': {      // Fique Atrás de Mim: salta em cima de quem está atrás do grupo
        if (!braum || !alvo) break;
        braum.pulo = 0.55; braum.puloDur = 0.55; braum.puloAlto = 46; braum.quadroDg = { q: 6, ate: this.tempo + 0.55 }; this.balao(braum, t('Fique atrás de Braum!'), '#ffe08a');
        const de = this.peNaDungeon(braum);
        this.depois(0.3, () => {
          const livres = vizinhos(alvo).filter((p) => this.mapa.livre(p.x, p.y)).sort((a, b) => Math.hypot(a.x - de.x, a.y - de.y) - Math.hypot(b.x - de.x, b.y - de.y));
          const p = livres[0] || alvo;
          braum.x = braum.de.x = p.x; braum.y = braum.de.y = p.y; braum.fila = []; braum.t = 1; braum.sx = braum.sy = null; this.olhar(braum, alvo);
        });
        this.depois(0.55, () => { const c = this.centro(braum); this.tremor = 0.6; this.onda(c.x, c.y + 24, 2.5 * T, '#ffffff', 0.6, 5); this.onda(c.x, c.y + 24, 3.5 * T, '#bfe8ff', 0.8, 4); this.fx.explosao(c.x, c.y + 22, { qtd: 40, vel: 120, cor: ['#ffffff', '#cfe8f7', '#8ad8ff'], vida: 0.9, tam: 3, encolhe: true, grav: 120 }); });
        break;
      }
      case 'braumFuria': {
        if (!braum) break;
        braum.furiaVis = true;
        const c = this.centro(braum); this.tremor = 0.6; this.flash = 0.25; this.corFlash = '255,120,80';
        this.onda(c.x, c.y + 20, 3.5 * T, '#ff7a50', 0.7, 5); this.brilhos(c.x, c.y, ['#ff7a50', '#ffe08a', '#ffffff'], 30, 120);
        this.balao(braum, t('Agora é sério!'), '#ff9a6a'); this.aviso(t('Braum ficou furioso!'), '#ff9a6a');
        break;
      }
      case 'chamado': if (braum) { braum.atk = 0.5; this.balao(braum, t('Ao meu lado, amigos!'), '#bfe8ff'); const c = this.centro(braum); this.onda(c.x, c.y + 20, 2.4 * T, '#ffffff', 0.6, 3); } break;
      case 'onda': if ((l.nomes || []).includes('Braum')) { this.aviso(t('Braum, o Coração de Freljord'), '#ffe08a'); this.tremor = 0.5; } break;
      case 'estagio': this.aviso(t('Estágio vencido!'), '#9ff0a8'); break;
    }
  }
  // depois da sincronia: o Braum aparece num lugar fixo ao norte do grupo; cada monstro vai até quem ele está atacando
  // (não todos até você); e o seu campeão volta para o meio se ficou longe
  guiarDungeon(inimigos) {
    const base = this.mapa.centro, livreAli = (x, y) => this.mapa.livre(x, y);
    for (const i of inimigos) {
      const v = this.criaturas.get(i.id);
      if (!v) continue;
      if (i.nome === 'Braum' && !v.posto) {
        v.posto = true;
        let p = { x: base.x, y: base.y - 3 };
        for (let r = 0; r < 4 && !livreAli(p.x, p.y); r++) p = { x: base.x + (r % 2 ? r : -r), y: base.y - 3 };
        v.x = v.de.x = p.x; v.y = v.de.y = p.y; v.fila = []; v.t = 1; v.surge = 0.8;
        const c = this.centro(v);
        this.tremor = 0.7; this.flash = 0.35; this.corFlash = '200,240,255';
        this.onda(c.x, c.y + 24, 5 * T, '#bfe8ff', 0.9, 6); this.onda(c.x, c.y + 24, 3 * T, '#ffffff', 0.7, 4);
        this.fx.explosao(c.x, c.y + 20, { qtd: 50, vel: 130, cor: ['#ffffff', '#cfe8f7', '#8ad8ff'], vida: 1.1, tam: 3, encolhe: true, grav: 90 });
        this.balao(v, t('Fiquem atrás de mim!'), '#ffe08a');
        this.olhar(v, this.darius);
      }
      const alvo = i.foco ? this.quemNaDungeon(i.foco) : null;
      v.parada = !!(alvo && alvo !== this.darius);      // quem não ataca você não vem atrás de você (vai atrás de quem ataca)
      if (!alvo || alvo.oculto || alvo === this.darius) { if (alvo && !v.fila.length) this.olhar(v, alvo); continue; }
      if (v.fila.length || v.t < 1 || this.tempo < (v.buscaA || 0)) continue;
      v.buscaA = this.tempo + 0.7;
      const raio = v.distancia > 1 ? v.distancia : 1;
      if (Math.max(Math.abs(v.x - alvo.x), Math.abs(v.y - alvo.y)) <= raio) { this.olhar(v, alvo); continue; }
      const ocup = this.ocupados(v);
      const alvos = (raio > 1 ? this.anel(alvo, raio, ocup) : vizinhos(alvo).filter((p) => livreAli(p.x, p.y) && !ocup.has(p.x + ',' + p.y)))
        .sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
      for (const a of alvos.slice(0, 3)) { const passos = caminho(this.mapa, v, a, ocup, 300); if (passos) { v.fila = passos; v.vel = Math.max(v.vel || 0.12, 0.16); break; } }
    }
    // os campeões: quem bate de perto vai até o monstro que está atacando; quem ataca de longe fica perto do meio
    const DE_LONGE = new Set(['ezreal', 'lux']);
    for (const [c, camp, caido] of [[this.darius, this.campeao, this.morto], ...[...this.outros.values()].filter((o) => o.aliado).map((o) => [o, o.campeaoId, o.caido])]) {
      if (caido || c.fila.length || c.t < 1 || this.tempo < (c.voltaDg || 0)) continue;
      c.voltaDg = this.tempo + 0.6;
      const alvo = c.alvoDg && this.criaturas.get(c.alvoDg);
      if (!DE_LONGE.has(camp) && alvo) {
        const raio = alvo.grande ? 2 : 1;
        if (Math.max(Math.abs(c.x - alvo.x), Math.abs(c.y - alvo.y)) <= raio) { this.olhar(c, alvo); continue; }
        const ocup = this.ocupados(c);
        const lados = (raio > 1 ? this.anel(alvo, raio, ocup) : vizinhos(alvo).filter((p) => livreAli(p.x, p.y) && !ocup.has(p.x + ',' + p.y))).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        for (const p of lados.slice(0, 3)) { const passos = caminho(this.mapa, c, p, ocup, 300); if (passos) { c.fila = passos; c.vel = 0.16; break; } }
      } else if (Math.max(Math.abs(c.x - base.x), Math.abs(c.y - base.y)) > 3) {
        const passos = caminho(this.mapa, c, base, this.ocupados(c), 300);
        if (passos) c.fila = passos.slice(0, -1);
      }
    }
  }
  // neve caindo em volta da câmera (só na dungeon)
  nevar(dt) {
    this.neveAcum = (this.neveAcum || 0) + dt * (this.leve ? 18 : 40);
    const L = VIS_L * T, A = VIS_A * T;
    while (this.neveAcum >= 1) {
      this.neveAcum--;
      const x = this.cam.x + Math.random() * (L + 60) - 30, y = this.cam.y - 8 + Math.random() * A * 0.3;
      this.fx.add({ x, y, vx: -12 + Math.random() * 8, vy: 22 + Math.random() * 18, cor: Math.random() < 0.7 ? '#ffffff' : '#d8ecf8', vida: 2.4 + Math.random() * 1.6, tam: Math.random() < 0.2 ? 2 : 1.2, atrito: 0 });
    }
  }

  // ---------- Runeterra: as posições vêm direto do motor (em tiles, quebradas) ----------
  // (x, y) do motor = o ponto do chão onde a criatura pisa; o sprite de 32 px fica meio tile para a esquerda e quase um tile acima
  colocar(c, fx, fy, olhar) {
    const nx = fx - (c.grande ? 0 : 0.5), ny = fy - 0.875, dx = nx - c.x, dy = ny - c.y, mov = Math.hypot(dx, dy);
    c.andando = mov > 0.004 && mov < 2;
    if (c.andando) c.dist = (c.dist || 0) + mov;
    const v = olhar || (c.andando ? { x: dx, y: dy } : null);
    if (v && (v.x || v.y)) c.dir = Math.abs(v.x) >= Math.abs(v.y) ? direcao(v.x, 0) : direcao(0, v.y);
    c.x = c.de.x = nx; c.y = c.de.y = ny; c.t = 1; c.fila = [];
    // o motor anda 20 vezes por segundo e a tela desenha 60: entre um passo e outro, o desenho desliza da posição
    // anterior até a nova (em vez de ficar parado e pular), o que tira o tranco. Teleporte (salto grande) não desliza.
    if (c.sx == null || Math.abs(nx - c.sx) + Math.abs(ny - c.sy) > 2) { c.sx = nx; c.sy = ny; c.ix0 = null; return; }
    if (nx !== c.ixA || ny !== c.iyA) { c.ix0 = c.sx; c.iy0 = c.sy; c.ixA = nx; c.iyA = ny; c.it = 0; }
  }
  sincronizarArena(combate, vidaFrac, manaFrac) {
    const A = combate.arena, d = combate.darius;
    this.estadoArena = A;
    this.darius.vida = Math.max(0, vidaFrac); this.mana = Math.max(0, manaFrac);
    this.recall = d.recall;
    this.grito = d.grito > 0; this.furiaS = d.furiaS > 0; this.estandarte = d.estandarte; this.wPronto = d.wPronto;
    this.queimando = d.queimando; this.forcaAcum = d.forcaAcum || 0; this.folego = 1;
    this.poder = d.poder > 0;
    this.cargasTornado(d);
    if (!A) return;
    this.adagasDoMotor(combate);
    this.gosmasDoMotor(combate);
    this.arenaPausado = A.pausado;
    if (!this.morto) this.colocar(this.darius, A.x, A.y, A.olhar || (A.andando ? A.dir : null));
    const ids = new Set();
    for (const i of combate.inimigos) {
      if (i.morto || i.hp <= 0 && !this.criaturas.has(i.id)) continue;
      ids.add(i.id);
      let v = this.criaturas.get(i.id);
      if (!v) {
        v = novaCriatura(i.id, i.nome, { x: 0, y: 0 }); v.chefe = !!i.chefe; v.surge = 0.5;
        this.colocar(v, i.x, i.y); this.criaturas.set(i.id, v); this.efeito('poof', v, 0.5);
      }
      const dx = A.x - i.x, dy = A.y - i.y;
      this.colocar(v, i.x, i.y, Math.hypot(dx, dy) < 4 ? { x: dx, y: dy } : null);
      v.elite = !!i.elite; v.guardiao = i.guardiao != null; v.miniChefe = !!i.furioso; v.spriteNome = v.guardiao ? i.nome + '#guardiao' : v.miniChefe ? i.nome + '#furioso' : null;
      if (v.guardiao && i.aggro && Math.hypot(i.x - (this.estadoArena?.x ?? 0), i.y - (this.estadoArena?.y ?? 0)) < 14) this.chefeBarra = { nome: i.nome, vida: i.hp / i.hpMax, t: this.tempo };
      v.vida = Math.max(0, i.hp / i.hpMax); v.acumulos = i.acumulos; v.atordoado = i.atordoado > 0 && !(i.surgindo > 0); v.surgindo = i.surgindo > 0 ? i.surgindo : 0; v.noturno = !!i.noturno; v.marca = i.marca > 0; v.noAr = i.noAr || 0;
    }
    for (const id of this.criaturas.keys()) if (!ids.has(id)) this.criaturas.delete(id);
    this.alvo = A.alvo && this.criaturas.get(A.alvo);
  }
  // o mascote acompanha o campeão andando livre (sem tiles)
  guiarMascoteArena(dt) {
    const p = this.pet, d = this.darius;
    if (!p || this.morto) return;
    const alvo = { x: d.x - 0.9, y: d.y + 0.2 }, dx = alvo.x - p.x, dy = alvo.y - p.y, n = Math.hypot(dx, dy);
    if (n > 8) { p.x = p.de.x = alvo.x; p.y = p.de.y = alvo.y; this.efeito('poof', p, 0.4); return; }
    const passo = Math.min(n, (n > 1.2 ? 4.2 : 2.5) * dt);
    if (n > 0.6) this.colocar(p, p.x + 0.5 + (dx / n) * passo, p.y + 0.875 + (dy / n) * passo);
    else { p.andando = false; this.olhar(p, d); }
  }
  // ---------- outros jogadores em Runeterra (chegam do servidor ~10x por segundo; aqui andam suave) ----------
  redeArena(lista, meuNivel, difNivel, semCap = false) {
    if (!this.arena) return;
    const vistos = new Set(), monsVistos = new Set();
    for (const j of lista) {
      if (j.m) continue;            // caído: some até voltar
      vistos.add(j.n);
      let o = this.jogArena.get(j.n);
      const visual = spriteCampeao(j.c || 'darius', j.s);
      if (!o) {
        o = { ...novaCriatura('j:' + j.n, visual, { x: 0, y: 0 }), jogador: true, arenaJog: true, nomeJogador: j.n, surge: 0.5 };
        this.colocar(o, j.x, j.y); o.alvoX = j.x; o.alvoY = j.y;
        this.jogArena.set(j.n, o); this.efeito('poof', o, 0.5);
      }
      o.adagas = Array.isArray(j.ad) ? j.ad : [];
      o.gosmas = Array.isArray(j.gz) ? j.gz : [];
      o.acumulos = j.sg || 0;          // Hemorragia do Darius (o servidor conta)
      o.nome = visual; o.nivel = j.nv; o.poder = j.pd || 0; o.vida = j.v; o.agressor = j.ag; o.pk = j.pk; o.caveira = !!j.cv || !!j.rv; o.vermelha = !!j.rv; o.vip = j.vip; o.parado = j.p; o.morto = j.m;
      o.brasao = j.gb || null; o.mesmaGuilda = !!(j.gi && j.gi === this.minhaGuilda); o.mesmoGrupo = !!(j.gp && j.gp === this.meuGrupo);
      o.atacavel = (Math.abs(j.nv - meuNivel) <= difNivel || (semCap && !!zonaPkEm(j.x, j.y)?.semCap)) && !o.mesmaGuilda && !o.mesmoGrupo;      // Zona de Guerra vermelha: sem limite de nível (p689)      // da mesma guilda ou do mesmo grupo nunca é alvo
      if (j.ar) { o.mesmaGuilda = false; o.mesmoGrupo = false; o.atacavel = true; }      // na Arena o oponente é sempre alvo
      o.alvoX = j.x; o.alvoY = j.y; o.olharV = { x: j.dx, y: j.dy }; o.andaRede = j.a;
      o.montaria = j.mt ? (j.mt === 'b' ? 'Montaria' : 'Montaria@' + j.mt) : null;
      if (j.k && !(o.atk > 0)) o.atk = 0.22;
      for (const m of j.mons || []) {
        if (m.g) continue;      // guardião de fortaleza: cada um tem o seu (não aparece para os outros)
        const id = j.n + ':' + m.i;
        monsVistos.add(id);
        let v = this.monsOutros.get(id);
        if (!v) { v = novaCriatura('o:' + id, m.n, { x: 0, y: 0 }); v.surge = 0.5; this.colocar(v, m.x, m.y); this.monsOutros.set(id, v); }
        v.alvoX = m.x; v.alvoY = m.y; v.vida = m.v; v.deOutro = true; v.guardiaoOutro = !!m.g; v.noAr = m.ar ? 1 : 0; v.atordoado = !!m.at;      // p645
      }
    }
    for (const n of [...this.jogArena.keys()]) if (!vistos.has(n)) this.jogArena.delete(n);
    for (const id of [...this.monsOutros.keys()]) if (!monsVistos.has(id) && !id.startsWith('vilemaw:')) { const v = this.monsOutros.get(id); if (v.vida <= 0.02) this.desfazer(v); this.monsOutros.delete(id); }
  }
  // posição suave (a rede manda 10x por segundo; a tela desenha 60)
  suavizarArena(dt) {
    const k = Math.min(1, dt * 12);
    const passo = (o, olhar) => {
      const cx = o.x + (o.grande ? 0 : 0.5), cy = o.y + 0.875;
      if (Math.hypot(o.alvoX - cx, o.alvoY - cy) > 6) this.colocar(o, o.alvoX, o.alvoY, olhar);
      else this.colocar(o, cx + (o.alvoX - cx) * k, cy + (o.alvoY - cy) * k, olhar);
    };
    for (const o of this.jogArena.values()) passo(o, o.andaRede ? null : o.olharV);
    for (const v of this.monsOutros.values()) passo(v, null);
    for (const p of this.projOutros) {
      const x0 = p.x, y0 = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.andou += p.vel * dt;
      for (const w of this.paredes) {
        if (w.ate <= this.tempo || w.dono === p.dono || (!w.dono && !this.jogArena.get(p.dono)?.atacavel)) continue;
        const q = paredeBarra(w, { x: x0, y: y0 }, p);
        if (q) { p.andou = p.alcance; this.barrarVento(q.x * T, q.y * T - 14, p.vx, p.vy, ['#ffe080', '#ffffff'], false, w.dono ? this.jogArena.get(w.dono) : this.darius); break; }
      }
      if (p.andou < p.alcance) this.colisaoOutro(p);      // bate no primeiro monstro ou jogador do caminho (p648)
    }
    this.projOutros = this.projOutros.filter((p) => p.andou < p.alcance);
  }
  // habilidade de área/corpo a corpo de outro jogador: os monstros atingidos na sua tela piscam e mostram o golpe (p652)
  areaOutro(o, m) {
    const camp = ['darius', 'ezreal', 'lux', 'yasuo', 'katarina', 'taric', 'zac'].find((c) => o.nome.startsWith(c));
    const forma = ALCANCE_HAB[camp]?.[m.tecla], k = camp + ':' + m.tecla;
    if (!forma || AREA_OUTRO.semImpacto.has(k)) return;
    const extra = AREA_OUTRO.ajuste[k] || {}, cor = AREA_OUTRO.cor[camp] || '#ffe080';
    const n = Math.hypot(m.dx || 0, m.dy || 0) || 1, dir = { x: (m.dx || 0) / n, y: (m.dy || 0) / n };
    const mira = Number.isFinite(m.mx) ? { x: m.mx, y: m.my } : Number.isFinite(m.px) ? { x: m.px, y: m.py } : { x: m.x + dir.x * Math.min(forma.alcance, 4), y: m.y + dir.y * Math.min(forma.alcance, 4) };
    const pulso = () => {
      const de = this.jogArena.get(m.n), ox = de ? de.x + 0.5 : m.x, oy = de ? de.y + 0.875 : m.y;      // nos pulsos, quem lançou pode ter andado
      const vivos = [...this.criaturas.values(), ...this.monsOutros.values()].filter((v) => v && !v.morto && !(v.vida <= 0) && !v.npc)
        .map((v) => { const c = this.centro(v); return { v, c, x: c.x / T, y: (c.y + 6) / T }; });
      let alvos;
      if (extra.ponto) { const px = Number.isFinite(m.px) ? m.px : mira.x, py = Number.isFinite(m.py) ? m.py : mira.y; alvos = vivos.filter((a) => Math.hypot(a.x - px, a.y - py) <= extra.ponto); }
      else if (forma.forma === 'circulo') alvos = vivos.filter((a) => Math.hypot(a.x - ox, a.y - oy) <= forma.alcance + 0.4);
      else if (forma.forma === 'cone') alvos = vivos.filter((a) => { const dx = a.x - ox, dy = a.y - oy, d = Math.hypot(dx, dy); return d <= forma.alcance + 0.4 && d > 0.01 && (dx * dir.x + dy * dir.y) / d >= Math.cos(((extra.ang || 55) / 2) * Math.PI / 180); });
      else if (forma.forma === 'linha') alvos = vivos.filter((a) => { const dx = a.x - m.x, dy = a.y - m.y, ao = dx * dir.x + dy * dir.y, lado = Math.abs(dx * dir.y - dy * dir.x); return ao >= -0.3 && ao <= forma.alcance + 0.3 && lado <= (forma.largura || 1) / 2 + 0.4; });
      else { const c = vivos.filter((a) => Math.hypot(a.x - ox, a.y - oy) <= forma.alcance + 0.6).sort((a, b) => Math.hypot(a.x - mira.x, a.y - mira.y) - Math.hypot(b.x - mira.x, b.y - mira.y))[0]; alvos = c ? [c] : []; }
      for (const a of alvos.slice(0, extra.max || 12)) {
        a.v.hit = 0.14;
        this.faiscas(a.c.x, a.c.y - 2, [cor, '#ffffff'], 8, 90); this.estrela4(a.c.x, a.c.y, cor, extra.grande ? 32 : 24); this.acender(a.c.x, a.c.y, 22, cor, 0.25);
      }
    };
    const [vezes, cada] = extra.pulsos || [1, 0];
    for (let i = 0; i < vezes; i++) this.depois((extra.atraso ?? 0.15) + i * cada, pulso);
  }
  // o impacto do projétil de outro jogador, como o do seu acerto: o alvo pisca e cada habilidade tem a sua cor e forma (p649)
  impactoOutro(tipo, v, c) {
    v.hit = 0.14;
    if (tipo === 'luxQ') {
      this.efeito('prisao', v, 1.5);
      this.brilhos(c.x, c.y, ['#fff0a0', '#ffffff', '#ff9ae0'], 16, 110, { forma: 'faisca' }); this.acender(c.x, c.y, 34, '#fff0a0', 0.35); this.estrela4(c.x, c.y, '#fff0a0', 34);
    } else if (tipo === 'adagaKat' || tipo === 'adagaCerteira') {
      this.faiscas(c.x, c.y - 2, ['#ff3a4a', '#ffd0d0', '#ffffff'], 10, 100); this.estrela4(c.x, c.y, '#ff3a4a', 26); this.acender(c.x, c.y, 22, '#ff3a4a', 0.2);
    } else if (tipo === 'gelo' || tipo === 'estilhaco') {
      this.brilhos(c.x, c.y, ['#9af4ff', '#ffffff'], 14, 90, { forma: 'estrela' }); this.estrela4(c.x, c.y, '#9af4ff', 28); this.acender(c.x, c.y, 26, '#9af4ff', 0.3);
    } else {
      this.faiscas(c.x, c.y - 2, ['#ffd060', '#ffffff'], 10, 100); this.estrela4(c.x, c.y, tipo === 'ricochete' ? '#ffc040' : '#ffe080', 26); this.acender(c.x, c.y, 24, '#ffd060', 0.25);
    }
  }
  // projétil de outro jogador: para no primeiro monstro (seu ou de outro) no caminho e desenha o impacto (p648, p650)
  colisaoOutro(p) {
    if (p.tipo === 'luxE') return;      // a Singularidade explode no ponto (areaOutro, p652)
    const atravessa = { R: 99, varinha: 99, precisao: 3 }[p.tipo] || 1;
    const dono = this.jogArena.get(p.dono);
    const alvos = [...this.criaturas.values(), ...this.monsOutros.values()]      // só monstros (p650): aliado não para a habilidade
      .filter((v) => v && v !== dono && !v.morto && !(v.vida <= 0) && !v.npc && !(p.atingidos?.has(v)));
    for (const v of alvos) {
      const c = this.centro(v);
      if (Math.hypot(c.x / T - p.x, (c.y + 6) / T - p.y) > 0.75) continue;
      (p.atingidos ??= new Set()).add(v);
      this.impactoOutro(p.tipo, v, c);      // o mesmo capricho do seu acerto (p649)
      if (p.atingidos.size >= atravessa) { p.andou = p.alcance; return; }
    }
  }
  // onde cada jogador está, no sistema de tiles do motor (para os golpes acertarem o que se vê na tela)
  posicoesArena() {
    return [...this.jogArena.values()].map((o) => ({ nome: o.nomeJogador, x: o.x + 0.5, y: o.y + 0.875, atacavel: o.atacavel, mesmaGuilda: o.mesmaGuilda, mesmoGrupo: o.mesmoGrupo, morto: o.morto, nivel: o.nivel, caveira: o.caveira }));
  }
  // um jogador usou uma habilidade: os outros veem o efeito (só visual; quem acerta é o servidor quem diz)
  // desenha a habilidade de outro jogador com a mesma função da sua: durante o desenho o "campeão" da cena é ele; o que é só
  // da sua tela (escurecer, tremer, clarão, aviso, esconder o campeão, sombra, estandarte, mira) volta como estava, e os
  // efeitos novos sem alvo ficam presos nele
  comoOutro(o, f) {
    const campos = ['darius', 'tremor', 'flash', 'corFlash', 'escuro', 'corEscuro', 'ocultoAte', 'sombraAte', 'estandartePos', 'dirCentelha', 'avisos', 'mapaSkin', 'emOutro'];
    const salvo = Object.fromEntries(campos.map((k) => [k, this[k]])), lista = this.efeitos, n0 = lista.length;
    const mapaO = SKINS_EFEITO[o.nome] || null;      // as cores da skin DELE (ou as padrão), nunca as da sua
    this.darius = o; this.mapaSkin = mapaO; this.emOutro = true;
    try { this.comCoresDaSkin(f, mapaO); } catch (e) { console.warn('[habilidade de outro jogador]', e?.message); }
    finally {
      Object.assign(this, salvo);
      if (this.efeitos === lista) for (const e of lista.slice(n0)) {
        if (!e.fixo && !e.alvo) { e.alvo = o; e.dono ??= o; }
        if (mapaO) { e.skin = true; e.skinMapa = mapaO; } else e.skin = false;
      }
    }
  }
  // roda f com as cores da skin do outro jogador o (ou as padrão, nunca as da sua)
  comSkinDe(o, f) {
    const meu = this.mapaSkin, mapaO = SKINS_EFEITO[o.nome] || null, lista = this.efeitos, n0 = lista.length;
    this.mapaSkin = mapaO;
    try { return this.comCoresDaSkin(f, mapaO); } finally {
      this.mapaSkin = meu;
      if (this.efeitos === lista) for (const e of lista.slice(n0)) if (!mapaO) { e.skin = false; delete e.skinMapa; }
    }
  }
  lanceDeOutro(m) {
    const o = this.jogArena.get(m.n);
    if (!o) return;
    if (!m.comSkin) { this.areaOutro(o, m); return this.comSkinDe(o, () => this.lanceDeOutro({ ...m, comSkin: true })); }      // o impacto nos monstros (p652)
    const ezreal = o.nome.startsWith('ezreal'), lux = o.nome.startsWith('lux'), dir = { x: m.dx || 0, y: m.dy || 0 };
    const c = this.centro(o), pe = c.y + 10;
    o.atk = 0.22;
    if (dir.x || dir.y) o.olharV = dir;
    const proj = (tipo, vel, alcance) => this.projOutros.push({ tipo, x: m.x, y: m.y, vx: dir.x * vel, vy: dir.y * vel, vel, alcance, andou: 0, dono: m.n });
    // o desenho completo, o mesmo de quem lançou (a pose, as camadas e os efeitos)
    const ev = { tipo: 'habilidade', tecla: m.tecla, dx: m.dx || 0, dy: m.dy || 0, alvos: [], tornado: !!m.tornado, outro: true };
    if (estiloNovoLigado()) this.comoOutro(o, () => this.poseHabilidade(o, m.tecla));
    const kat = o.nome.startsWith('katarina'), yas = o.nome.startsWith('yasuo'), tar = o.nome.startsWith('taric');
    if (o.nome.startsWith('zac')) { this.comoOutro(o, () => this.lanceZac(o, m, dir)); return; }
    if (yas && m.tecla !== 'W') { this.comoOutro(o, () => this.habilidadeYasuo(ev, o)); return; }
    if (!yas && !kat && !tar && !ezreal && !lux) {
      const eu = this.darius, n = Math.hypot(dir.x, dir.y) || 1, fx = m.x + (dir.x / n) * 1.5, fy = m.y + (dir.y / n) * 1.5;
      const perto = [eu, ...this.jogArena.values()].filter((c2) => c2 && c2 !== o && Math.hypot(c2.x - fx, c2.y - fy) < 2.5).sort((a, b) => Math.hypot(a.x - fx, a.y - fy) - Math.hypot(b.x - fx, b.y - fy))[0];
      const alvo = perto || { x: fx, y: fy, sx: fx, sy: fy, de: { x: fx, y: fy }, t: 1 };
      this.comoOutro(o, () => {
        this.habilidadeDariusTudo(ev, o);
        if (m.tecla === 'W') this.golpeVertical(alvo);
        else if (m.tecla === 'E') this.gancho(o, alvo);
        else if (m.tecla === 'R') this.machadoGigante(alvo);
      });
      return;
    }
    if (kat && !['Q', 'A', 'E', 'R', 'N'].includes(m.tecla)) { this.comoOutro(o, () => this.habilidadeKatarina(ev, o)); return; }
    if (tar) this.lanceTaric(o, m, dir);
    else if (o.nome.startsWith('katarina')) {       // Katarina de outro jogador
      if (m.tecla === 'Q') proj('adagaKat', 16, 6.5);
      else if (m.tecla === 'A') proj('adagaCerteira', 18, 8);
      else if (m.tecla === 'E') { const q = { x: m.x * T, y: m.y * T - 12 }; this.fumacaSombria(q.x, q.y, 14); this.fumacaSombria(c.x, c.y, 10); }
      else if (m.tecla === 'R') this.efeitos.push({ tipo: 'katLotus', dur: 2.5, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: o, raio: 3.5 * T });
      else if (m.tecla === 'N') this.efeitos.push({ tipo: 'katLotus', dur: 3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: o, raio: 3.5 * T, tempestade: true });
      else if (m.tecla === 'T' || m.tecla === 'M') { this.onda(c.x, pe, (m.tecla === 'T' ? 2.4 : 1.2) * T, '#ff3a4a', 0.45, 3); this.faiscas(c.x, c.y, ['#dfe6ee', '#ff3a4a'], 10, 90); }
      else if (m.tecla === 'B') this.fumacaSombria(c.x, c.y, 18);
      else { this.onda(c.x, pe, 26, '#ff3a4a', 0.4, 2); this.brilhos(c.x, c.y, ['#ff8aa0', '#ffffff'], 8, 50); }
    } else if (o.nome.startsWith('yasuo')) {          // Yasuo de outro jogador
      const n = Math.hypot(dir.x, dir.y) || 1, ux = dir.x / n || 1, uy = dir.y / n;
      if (m.tecla === 'W') {                   // a Parede de Vento dele: todos veem, e os tiros param nela
        const wx = m.x + ux * 1.4, wy = m.y + uy * 1.4;
        this.efeitos.push({ tipo: 'paredeVento', dur: PAREDE_PVP, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: wx * T, cy: wy * T + 8, vx: ux, vy: uy, dono: o });      // contra jogador, 2,5 s (p714)
        this.onda(wx * T, wy * T + 8, 26, '#bfe8ff', 0.5, 2);
        this.paredes.push({ dono: m.n, x: wx, y: wy, dx: ux, dy: uy, ate: this.tempo + PAREDE_PVP });
      } else if (m.tecla === 'Q' || m.tecla === 'M')
        this.efeitos.push({ tipo: 'estocadaVento', dur: 0.28, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x + ux * 6, oy: c.y + 2 + uy * 6, vx: ux, vy: uy, comp: (m.tecla === 'M' ? 6 : 4.5) * T, larg: m.tecla === 'M' ? 7 : 5, lua: m.tecla === 'M' });
      else if (m.tecla === 'R') { this.texto(o, 'Sorye ge ton!', '#bfe8ff', 1); this.estrela4(c.x, c.y - 10, '#bfe8ff', 40); }
      else { this.onda(c.x, pe, 30, '#bfe8ff', 0.4, 2); this.brilhos(c.x, c.y, ['#ffffff', '#bfe8ff'], 10, 60); }
    } else if (lux) {
      if (m.tecla === 'Q') proj('luxQ', 15, 7.5);
      else if (m.tecla === 'A') proj('gelo', 18, 7.5);
      else if (m.tecla === 'W') { proj('varinha', 12, 7); this.efeito('barreira', o, 2.5); }
      else if (m.tecla === 'E') proj('luxE', 11, 5);
      else if (m.tecla === 'M') { const px0 = m.x + dir.x * 5, py0 = m.y + dir.y * 5; this.chuvaDeMeteoros([0, 1, 2].map((k) => ({ x: px0 + (Math.random() - 0.5) * 3, y: py0 + (Math.random() - 0.5) * 2, t: 0.45 + k * 0.3 }))); }
      else if (m.tecla === 'R') { o.canal = 0.6; this.depois(0.6, () => { const c2 = this.centro(o); this.raioCentelha(c2.x, c2.y - 4, dir.x || 1, dir.y); }); }
      else if (m.tecla === 'N') this.efeitos.push({ tipo: 'tornado', dur: 3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: (m.x + dir.x * 1.2) * T, oy: (m.y + dir.y * 1.2) * T, vx: dir.x * 3 * T, vy: dir.y * 3 * T });
      else if (m.tecla === 'T') { this.efeitos.push({ tipo: 'convergindo', dur: 0.6, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: c.x, cy: pe, raio: 2.4 * T }); this.depois(0.6, () => this.explodirConvergencia(c.x, pe, 2.4 * T)); }
      else if (m.tecla === 'F') this.efeito('luzCura', o, 1.2);
      else this.brilhos(c.x, c.y, ['#fff0a0', '#ffffff'], 12, 60);
    } else if (ezreal) {
      if (m.tecla === 'Q') proj('Q', 18, 7.5);
      else if (m.tecla === 'W') proj('W', 14, 7.5);
      else if (m.tecla === 'A') proj('precisao', 30, 8);
      else if (m.tecla === 'M') proj('ricochete', 20, 7.5);
      else if (m.tecla === 'B') { if (m.px != null) this.portalEm(m.px * T, m.py * T, 6); else if (m.atravessa) { this.fecharPortal(); this.brilhos(c.x, c.y, ['#ffc040', '#30c8ff', '#ffffff'], 16, 90); } }
      else if (m.tecla === 'N') { o.pulo = 0.6; this.depois(0.58, () => { const c2 = this.centro(o); this.onda(c2.x, c2.y + 10, 5 * T, '#ffc040', 0.75, 5); this.onda(c2.x, c2.y + 10, 3.5 * T, '#30c8ff', 0.6, 4); this.brilhos(c2.x, c2.y, ['#ffc040', '#30c8ff', '#ffffff'], 30, 180, { forma: 'faisca' }); this.tremor = Math.max(this.tremor, 0.3); }); }
      else if (m.tecla === 'F') this.brilhos(c.x, c.y, ['#b060ff', '#e0b0ff'], 16, 80);
      else if (m.tecla === 'R') { this.depois(1, () => proj('R', 16, 25)); o.canal = 1; }
      else if (m.tecla === 'E') { this.brilhos(c.x, c.y, ['#ffd860', '#7ad8ff', '#ffffff'], 16, 80); }
      else if (m.tecla === 'T') this.descargaShurima(c.x, c.y - 4, (m.x + dir.x * 5) * T, (m.y + dir.y * 5) * T);
      else this.brilhos(c.x, c.y, ['#ffd860', '#ffffff'], 12, 60);
    } else {
      if (m.tecla === 'M') this.rupturaEm(c.x, pe, dir.x || 1, dir.y, 6 * T);
      else if (m.tecla === 'Q') { this.onda(c.x, pe, 36, '#c01010', 0.5, 3); o.giro = 0.42; o.dirAntes = o.dir; }
      else if (m.tecla === 'T') { this.onda(c.x, pe, 3.6 * T, '#8a6a40', 0.6, 4); this.pedras(c.x, pe, 14, 1.2); }
      else if (m.tecla === 'G') this.onda(c.x, pe, 50, '#ff9a30', 0.6, 3);
      else if (m.tecla === 'N') this.dominioEm(c.x, pe, 3.5 * T, 10);
      else this.poeira(c.x, pe, 10, 1);
    }
  }
  // número de dano em cima de um jogador (o próprio, ou outro)
  danoEmJogador(nome, valor, tipo) {
    const o = nome === this.nomeJogador ? this.darius : this.jogArena.get(nome);
    if (!o) return;
    this.texto(o, fmt(valor), tipo === 'verdadeiro' ? '#ffffff' : tipo === 'magico' ? '#c070ff' : '#ff6a3a', 1.15);
    o.hit = 0.14; this.sangue(o, 4);
  }
  // ---------- Vilemaw (chefe global): o servidor manda onde ela está e a vida; ela entra junto com os monstros dos outros
  // jogadores (dá para clicar e acertar; o acerto vai pelo servidor). A arte é a da IA, animada por js/vilemaw.js.
  chefeGlobal(st) {
    const id = 'vilemaw:vm', v0 = this.monsOutros.get(id);
    if (!st?.ativo) {
      if (v0 && st?.morreu) {             // vencida: estouro, tremor e o corpo some devagar
        const b = this.centro(v0); this.tremor = 0.9; this.flash = 0.25; this.corFlash = '120,255,232';
        this.fx.explosao(b.x, b.y - 30, { qtd: 70, vel: 140, cor: ['#7affe8', '#c8a0ff', '#ffffff', '#2a6a6a'], vida: 1.2, tam: 3, encolhe: true });
        for (const [k, at] of [[0, 0], [1, 0.15], [2, 0.3]]) this.depois(at, () => this.onda(b.x, b.y + 10, 120 + k * 50, k === 1 ? '#c8a0ff' : '#7affe8', 0.8, 5 - k));
      }
      if (v0) this.monsOutros.delete(id);
      this.vilemaw = null; return;
    }
    if (!this.quadrosVm && !this.carregandoVm) {
      this.carregandoVm = true;
      const img = new Image(); img.onload = () => { this.quadrosVm = quadrosVilemaw(img); }; img.src = 'assets/img/chefes/vilemaw.png';
    }
    let v = v0;
    if (!v) {
      v = novaCriatura('o:' + id, 'Vilemaw', { x: 0, y: 0 }); v.chefeGlobal = true; v.surge = 1.2; this.colocar(v, st.x, st.y); this.monsOutros.set(id, v);
      if (st.nasceu) { this.tremor = 0.8; this.escuro = Math.max(this.escuro || 0, 0.4); this.corEscuro = '0,30,40'; v.animVm = { tipo: 'rugido', ini: this.tempo, dur: 1.4 }; }
    }
    v.raio = st.raio; v.alvoX = st.x; v.alvoY = st.y; v.vida = st.hpMax ? st.hp / st.hpMax : 1; v.deOutro = true;
    v.rankVm = st.top || []; v.euVm = st.eu || null;      // quem está batendo mais
    if (st.furia && !v.furiosa) { v.animVm = { tipo: 'rugido', ini: this.tempo, dur: 1.4 }; this.aviso(t('A Vilemaw está furiosa!'), '#ff5a7a'); }
    // ponto fraco: o servidor diz quanto falta; ao abrir, aviso, balão e som (50% a mais de dano)
    if (st.fraco > 0) {
      if (!(v.fracoAte > this.tempo)) { this.aviso(t('Ponto fraco! +50% de dano'), '#ffd040'); this.balao(v, t('Ponto fraco!'), '#ffd040'); }
      v.fracoAte = this.tempo + st.fraco / 1000;
    } else v.fracoAte = 0;
    v.furiosa = !!st.furia;
    this.vilemaw = st;
  }
  // a marca do golpe no chão (como a dos guardiões), o nome num balão em cima dela e a animação certa
  avisoVilemaw(m) {
    const G = GOLPES_VILEMAW[m.mec], v = this.monsOutros.get('vilemaw:vm');
    if (!G) return;
    this.avisoGuardiao({ ...m, cor: G.cor, alvo: null });
    if (!v) return;
    this.balao(v, t(G.nome) + '!', `rgb(${G.cor})`);
    if (m.mec === 'bote') this.depois(Math.max(0, m.t - 0.7), () => { v.animVm = { tipo: 'bote', ini: this.tempo, dur: 1.2 }; });      // o impacto do bote cai no quadro 7 de 12
    else if (m.mec === 'rugido') v.animVm = { tipo: 'rugido', ini: this.tempo, dur: m.t };
    else v.atk = 0.3;
  }
  impactoVilemaw(ev) {
    const v = this.monsOutros.get('vilemaw:vm'), b = v ? this.centro(v) : { x: ev.x * T, y: ev.y * T };
    if (ev.mec === 'teia' || ev.mec === 'ninho') for (const q of ev.pontos) { this.efeitos.push({ tipo: 'teiaChao', dur: 1.8, t: 0, alvo: null, fixo: { px: q.x * T - 16, py: q.y * T - 18 }, r: q.r * T }); this.onda(q.x * T, q.y * T, q.r * T, '#d8c8ff', 0.4, 2); }
    else if (ev.mec === 'ovos') for (const [k, q] of ev.pontos.entries()) this.depois(k * 0.06, () => {
      this.efeitos.push({ tipo: 'ovoCai', dur: 0.32, t: 0, alvo: null, fixo: { px: q.x * T - 16, py: q.y * T - 18 } });
      this.depois(0.32, () => { this.onda(q.x * T, q.y * T, q.r * T, '#8affb0', 0.4, 3); this.fx.explosao(q.x * T, q.y * T - 4, { qtd: 16, vel: 70, cor: ['#8affb0', '#2a8a6a', '#e8fff0'], forma: 'circ', vida: 0.6, grav: 140, tam: 2, atrito: 2 }); });
    });
    else if (ev.mec === 'chuvaAcida') for (const [k, q] of ev.pontos.entries()) this.depois(k * 0.05, () => {      // gotas de ácido caindo
      this.onda(q.x * T, q.y * T, q.r * T, '#a0ff50', 0.45, 3);
      this.fx.explosao(q.x * T, q.y * T - 4, { qtd: 12, vel: 60, cor: ['#a0ff50', '#3a8a1a', '#eaffc8'], forma: 'circ', vida: 0.55, grav: 160, tam: 2, atrito: 2 });
    });
    else if (ev.mec === 'veneno') {
      this.feixeAura(ev.x * T, ev.y * T - 20, ev.dx, ev.dy, ev.comp * T, ['#5aff4a', '#d8ffa0'], 0.7, ev.comp * T * 0.5);
      for (let k = 0; k < 40; k++) { const a = Math.atan2(ev.dy, ev.dx) + (Math.random() - 0.5) * ev.ang * 2, r = Math.random() * ev.comp * T; this.fx.add({ x: ev.x * T, y: ev.y * T - 20, vx: Math.cos(a) * r * 2.2, vy: Math.sin(a) * r * 2.2, cor: ['#c8ff80', '#5aff4a', '#2a8a20'][k % 3], brilho: true, vida: 0.6, tam: 2.5, encolhe: true, atrito: 2 }); }
      this.tremor = 0.35;
    } else if (ev.mec === 'bote') { const x = ev.ex * T, y = ev.ey * T; this.onda(x, y, 46, '#7affe8', 0.5, 4); this.estrela4(x, y - 10, '#c8a0ff', 46); this.pedras(x, y, 14, 1.4); this.poeira(x, y, 16, 1.5); this.tremor = 0.6; }
    else if (ev.mec === 'rugido') {
      for (const [k, at] of [[0, 0], [1, 0.12], [2, 0.24]]) this.depois(at, () => this.onda(b.x, b.y + 10, ev.r * T * (0.5 + k * 0.25), k === 1 ? '#c8a0ff' : '#7affe8', 0.6, 5 - k));
      this.tremor = 0.8; this.escuro = Math.max(this.escuro || 0, 0.35); this.corEscuro = '0,30,40';
    }
    if (ev.acertou && (ev.mec === 'teia' || ev.mec === 'ninho')) this.aviso(t('Preso na teia!'), '#d8c8ff');
    if (ev.acertou && ev.mec === 'chuvaAcida') this.aviso(t('Queimando no ácido!'), '#a0ff50');
  }
  desenharVilemaw(g, c) {
    const { px, py } = this.pos(c), mx = px + (c.grande ? 0 : 16), chao = py + 29, Q = this.quadrosVm, tt = this.tempo, R = (c.raio || 2.4) * T * 1.9;
    const al = c.surge > 0 ? Math.max(0, 1 - c.surge / 1.2) : 1;
    g.save(); g.globalAlpha = al;
    // a teia no chão em volta dela
    g.strokeStyle = 'rgba(210,200,255,0.22)'; g.lineWidth = 1;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283; g.beginPath(); g.moveTo(mx, chao); g.lineTo(mx + Math.cos(a) * R, chao + Math.sin(a) * R * 0.5); g.stroke(); }
    for (const f of [0.35, 0.6, 0.85, 1]) { g.beginPath(); for (let k = 0; k <= 12; k++) { const a = (k / 12) * 6.283, x = mx + Math.cos(a) * R * f, y = chao + Math.sin(a) * R * f * 0.5; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    // névoa (turquesa; vermelha na fúria) e a sombra
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * (0.32 + 0.08 * Math.sin(tt * 2)); g.drawImage(halo(c.furiosa ? '#ff4a6a' : '#3ce0d0'), mx - R, chao - R * 0.6, R * 2, R * 1.2);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = al * 0.55; g.fillStyle = '#000'; g.beginPath(); g.ellipse(mx, chao, R * 0.5, R * 0.15, 0, 0, 6.283); g.fill();
    g.globalAlpha = al;
    if (Q) {
      const an = c.animVm, dentro = an && tt - an.ini < an.dur;
      const lista = dentro ? Q[an.tipo] : Q.parado, k = dentro ? Math.min(lista.length - 1, Math.floor(((tt - an.ini) / an.dur) * lista.length)) : Math.floor(tt * 10) % lista.length;
      const q = lista[k], x0 = Math.round(mx - q.width / 2), y0 = Math.round(chao - q.height + MARGEM_VM + 4);
      g.drawImage(q, x0, y0);
      if (c.hit > 0 || c.atk > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(0.5, Math.max(c.hit || 0, (c.atk || 0) * 0.6) * 2.5); g.drawImage(q, x0, y0); }
      if (c.furiosa) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.15 * Math.sin(tt * 8); g.drawImage(halo('#ff3a5a'), mx - R * 0.8, chao - q.height * 0.9, R * 1.6, q.height * 0.9); }
      if (c.fracoAte > tt) {            // ponto fraco: um alvo dourado pulsando no meio do corpo
        const fy = chao - q.height * 0.55, pulso = 0.5 + 0.5 * Math.sin(tt * 10), r0 = 10 + pulso * 4;
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + 0.35 * pulso; g.drawImage(halo('#ffd040'), mx - 34, fy - 34, 68, 68);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.lineWidth = 2;
        for (const [rr, cor] of [[r0, '#fff3b0'], [r0 + 7, '#ffb020']]) { g.strokeStyle = cor; g.beginPath(); g.arc(mx, fy, rr, 0, 6.283); g.stroke(); }
        g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(mx, fy, 3.5, 0, 6.283); g.fill();
        for (let k = 0; k < 4; k++) { const a = tt * 2 + (k * Math.PI) / 2; g.beginPath(); g.moveTo(mx + Math.cos(a) * (r0 + 10), fy + Math.sin(a) * (r0 + 10)); g.lineTo(mx + Math.cos(a) * (r0 + 17), fy + Math.sin(a) * (r0 + 17)); g.stroke(); }
      }
    } else { const s2 = sprite('Vilemaw', DIR.S, 0); g.drawImage(s2, Math.round(mx - s2.width / 2), Math.round(chao - s2.height + 4)); }
    g.restore();
    if (Math.random() < 0.4) this.fx.add({ x: mx + (Math.random() - 0.5) * R * 1.4, y: chao + (Math.random() - 0.5) * R * 0.4, vx: 0, vy: -10 - Math.random() * 12, cor: c.furiosa ? '#ff6a8a' : '#7affe8', brilho: true, vida: 1.2, tam: 2, encolhe: true });
    // a barra grande no alto da tela, para quem está perto
    if (Math.hypot((c.alvoX ?? 0) - (this.estadoArena?.x ?? 0), (c.alvoY ?? 0) - (this.estadoArena?.y ?? 0)) < 24) this.chefeBarra = { nome: 'Vilemaw', vida: c.vida, t: this.tempo, larg: 240, y: this.eventoNoTopo ? 58 : 30, cor: c.fracoAte > tt ? '#ffc030' : c.furiosa ? '#ff3a5a' : '#3ad8c8', titulo: c.fracoAte > tt ? `Vilemaw · ${Math.max(0, Math.ceil(c.vida * 100))}% · ` + t('ponto fraco! {s} s', { s: Math.ceil(c.fracoAte - tt) })
      : t('Vilemaw, a Rainha da Teia') + ` · ${Math.max(0, Math.ceil(c.vida * 100))}%` + (this.vilemaw?.n ? ' · ' + t('{n} lutando', { n: this.vilemaw.n }) : ''), ranking: c.rankVm, eu: c.euVm };
  }
  // os monstros que os outros jogadores estão enfrentando (para clicar e acertar): posição no mundo e de quem são
  monstrosDeOutros() {
    const r = [];
    for (const [chave, v] of this.monsOutros) {
      if ((v.vida <= 0.02 && !v.chefeGlobal) || v.alvoX == null) continue;      // a Vilemaw: até o último golpe
      const k = chave.indexOf(':');
      r.push({ chave, dono: chave.slice(0, k), mid: chave.slice(k + 1), nome: v.nome, x: v.alvoX, y: v.alvoY, ...(v.chefeGlobal ? { raio: v.raio, chefe: true } : {}), ...(v.guardiaoOutro ? { g: true } : {}) });
    }
    return r;
  }
  ataqueEmMonstroOutro(chave) {
    const o = this.monsOutros.get(chave), d = this.darius;
    if (!o) return;
    d.atk = 0.22; this.olhar(d, o);
    if (this.atirador) this.efeito('tiro', o, 0.16, this.maga ? '#ff9ae0' : '#ffe080'); else this.efeito('corte', o, 0.18, '#ffd0c0');
  }
  // o número do dano que você causou no monstro de outro jogador (o servidor confirma)
  danoEmMonstroOutro(chave, valor, fraco = false, queima = false) { const v = this.monsOutros.get(chave); if (v) { this.texto(v, fmt(valor), queima ? '#c890ff' : fraco ? '#ffe040' : '#ffd0a0', queima ? 0.8 : undefined); if (!queima) v.hit = 0.14; } }      // queima (Liandry, p589) em roxo e menor
  // outro jogador acertou um monstro seu
  danoDeOutro(id, valor) { const v = this.criaturas.get(id); if (v) { this.texto(v, fmt(valor), '#b8c8ff', 0.9); v.hit = 0.14; } }
  ataqueEmJogador(nome) {
    const o = this.jogArena.get(nome), d = this.darius;
    if (!o) return;
    d.atk = 0.22; this.olhar(d, o);
    if (this.atirador) this.efeito('tiro', o, 0.16, this.maga ? '#ff9ae0' : '#ffe080'); else this.efeito('corte', o, 0.18, '#ffd0c0');
  }
  jogadorCaiu(nome) {
    const o = this.jogArena.get(nome);
    if (!o) return;
    this.corpos.push({ x: o.x, y: o.y, img: corpo(o.nome), t: 0, dur: 6 });
    this.desfazer(o); this.jogArena.delete(nome);
  }

  // projéteis de Runeterra (Q, orbe, machado...), desenhados na altura da mão
  desenharProjeteis(g) {
    const A = this.estadoArena;
    const lista = [...(A?.proj || []), ...this.projOutros];
    if (!lista.length) return;
    for (const p of lista) {
      if (p.tipo === 'R') {        // Barragem de outro jogador: onda dourada larga
        const x = p.x * T, y = p.y * T - 14, ang = Math.atan2(p.vy, p.vx);
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.8; g.drawImage(halo('#ffb020'), x - 28, y - 28, 56, 56); g.restore();
        g.strokeStyle = '#ffe080'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - Math.cos(ang) * 20, y - Math.sin(ang) * 20); g.lineTo(x, y); g.stroke();
        continue;
      }
      const x = p.x * T, y = p.y * T - 14, ang = Math.atan2(p.vy, p.vx);
      if (p.tipo === 'machado') { girado(g, efeitoMachado(), x, y, this.tempo * 22, 0.4); continue; }
      if (p.tipo === 'adagaCerteira' || p.tipo === 'adagaKat') { this.desenharAdagaVoando(p.dono ? this.tingidoDe(SKINS_EFEITO[this.jogArena.get(p.dono)?.nome]) : this.gTingido || g, x, y - 12, this.tempo * 26, p.vx, p.vy); continue; }
      if (p.tipo === 'estilhaco') { this.cristalTaric(g, x, y, this.tempo * 25, 1, this.corDoProj(p, '#6af0ff')); if (Math.random() < 0.7) this.fx.add({ x, y, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, cor: Math.random() < 0.5 ? '#6af0ff' : '#ffffff', brilho: true, forma: 'estrela', vida: 0.3, tam: 1.5, encolhe: true }); continue; }
      if (p.tipo === 'varinha') { this.desenharVarinha(g, x, y, this.tempo * 18); this.rastroPrisma(x, y); continue; }
      if (p.tipo === 'gelo') { this.desenharGelo(g, x, y, ang); continue; }
      if (p.tipo === 'luxQ' || p.tipo === 'luxE' || p.tipo === 'estrela') {      // Lux: esfera de luz, singularidade e estrela
        const cor = this.corDoProj(p, p.tipo === 'luxE' ? '#ff9ae0' : '#fff0a0'), r = p.tipo === 'luxE' ? 6 : 4;
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.8; g.drawImage(halo(cor), x - r * 4, y - r * 4, r * 8, r * 8);
        g.restore();
        g.fillStyle = cor; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.fill();
        if (p.tipo === 'luxQ') for (const lado of [-1, 1]) { const a2 = this.tempo * 14 + (lado > 0 ? 0 : Math.PI); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x + Math.cos(a2) * 7), Math.round(y + Math.sin(a2) * 3), 2, 2); }
        if (Math.random() < 0.9) this.fx.add({ x, y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, cor: Math.random() < 0.5 ? cor : '#ffffff', brilho: true, forma: p.tipo === 'estrela' ? 'estrela' : undefined, vida: 0.35, tam: 1.8, encolhe: true });
        continue;
      }
      if (p.tipo === 'precisao') {          // Tiro de Precisão: risco longo e fino
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (const [l, cor, a2] of [[6, '#ffc040', 0.3], [2.5, '#fff0b0', 0.8], [1, '#ffffff', 1]]) { g.globalAlpha = a2; g.strokeStyle = cor; g.lineWidth = l; g.beginPath(); g.moveTo(x - Math.cos(ang) * 34, y - Math.sin(ang) * 34); g.lineTo(x, y); g.stroke(); }
        g.restore();
        continue;
      }
      const cor = this.corDoProj(p, p.tipo === 'W' ? '#b060ff' : p.tipo === 'A' ? '#ffe080' : p.tipo === 'luzA' ? '#fff8e0' : p.tipo === 'ricochete' ? '#9ae8ff' : '#7ad8ff');
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.7; g.drawImage(halo(cor), x - 12, y - 12, 24, 24);
      g.restore();
      for (let i = 1; i <= 5; i++) {
        g.globalAlpha = (1 - i / 6) * 0.8; g.fillStyle = cor;
        g.fillRect(Math.round(x - Math.cos(ang) * i * 3) - 1, Math.round(y - Math.sin(ang) * i * 3) - 1, 3, 3);
      }
      g.globalAlpha = 1;
      if (p.tipo === 'W') { g.fillStyle = cor; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe080'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2); }
      else {
        g.strokeStyle = cor; g.lineWidth = 4; g.beginPath(); g.moveTo(x - Math.cos(ang) * 9, y - Math.sin(ang) * 9); g.lineTo(x, y); g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - Math.cos(ang) * 6, y - Math.sin(ang) * 6); g.lineTo(x, y); g.stroke();
      }
      if (Math.random() < 0.8) this.fx.add({ x, y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, cor, brilho: true, vida: 0.3, tam: 1.8, encolhe: true });
    }
  }
  // mira no chão onde o mouse está (vermelha em cima de um alvo)
  desenharMira(g) {
    const m = this.miraArena;
    if (!m || this.morto) return;
    const x = Math.round(m.x * T), y = Math.round(m.y * T), pul = 1 + 0.15 * Math.sin(this.tempo * 6);
    const cor = this.miraSobreAlvo ? '255,90,70' : '255,240,200';
    g.strokeStyle = `rgba(${cor},0.85)`; g.lineWidth = 1;
    g.beginPath(); g.ellipse(x, y, 6 * pul, 3 * pul, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = `rgba(${cor},0.9)`; g.fillRect(x - 9, y, 4, 1); g.fillRect(x + 6, y, 4, 1); g.fillRect(x, y - 6, 1, 3); g.fillRect(x, y + 4, 1, 3);
  }
  // marcador verde no ponto clicado para andar (como no LoL)
  marcarDestino(x, y) { this.destinoClique = { x, y, t: 0 }; }
  desenharComandos(g, dt) {
    const A = this.estadoArena;
    if (!A || this.morto) return;
    const pe = { x: A.x * T, y: A.y * T };
    // alcance do ataque básico (com "mostrar alcance" ligado)
    if (this.alcanceBasico) {
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(pe.x, pe.y, this.alcanceBasico * T, this.alcanceBasico * T * 0.55, 0, 0, Math.PI * 2); g.stroke();
    }
    // destino clicado
    const dc = this.destinoClique;
    if (dc && A.destino && dc.t < 0.6) {
      dc.t += dt;
      const k = dc.t / 0.6, x = dc.x * T, y = dc.y * T;
      g.strokeStyle = `rgba(90,230,110,${1 - k})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(x, y, 10 * (1 - k * 0.6), 5 * (1 - k * 0.6), 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(90,230,110,${1 - k})`;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillRect(Math.round(x + dx * (5 + 6 * k)) - 1, Math.round(y + dy * (3 + 3 * k)) - 1, 2, 2);
    }
    // anel vermelho no monstro que está sendo atacado
    if (this.alvo && this.criaturas.has(this.alvo.id)) {
      const p = this.pos(this.alvo), o = this.alvo.grande ? 16 : 0;
      g.strokeStyle = `rgba(255,60,50,${0.6 + 0.3 * Math.sin(this.tempo * 8)})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(p.px + 16 - o, p.py + 28, this.alvo.grande ? 24 : 13, this.alvo.grande ? 9 : 5, 0, 0, Math.PI * 2); g.stroke();
    }
    // indicador de alcance da habilidade segurada
    const ind = this.indicador, m = this.miraArena;
    if (!ind) return;
    const R = ind.alcance * T, dx = m ? m.x * T - pe.x : 1, dy = m ? m.y * T - pe.y : 0, n = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
    g.save();
    g.fillStyle = 'rgba(110,200,255,0.16)'; g.strokeStyle = 'rgba(150,225,255,0.85)'; g.lineWidth = 1.5;
    if (ind.forma === 'circulo') { g.beginPath(); g.ellipse(pe.x, pe.y, R, R * 0.6, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    else if (ind.forma === 'linha') {
      const L = Math.min(R, 15 * T), w = (ind.largura || 0.8) * T;
      g.translate(pe.x, pe.y - 14); g.rotate(ang);
      g.fillRect(0, -w / 2, L, w); g.strokeRect(0, -w / 2, L, w);
      g.beginPath(); g.moveTo(L, -w / 2 - 3); g.lineTo(L + 7, 0); g.lineTo(L, w / 2 + 3); g.closePath(); g.fillStyle = 'rgba(150,225,255,0.6)'; g.fill();
    } else if (ind.forma === 'cone') {
      g.beginPath(); g.moveTo(pe.x, pe.y); g.arc(pe.x, pe.y, R, ang - 0.7, ang + 0.7); g.closePath(); g.fill(); g.stroke();
    } else if (ind.forma === 'alvo') {
      g.setLineDash([4, 3]); g.beginPath(); g.ellipse(pe.x, pe.y, R, R * 0.6, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      const d = Math.min(n, R), x = pe.x + (dx / n) * d, y = pe.y + (dy / n) * d;
      g.beginPath(); g.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.restore();
  }
  // Translocação em Runeterra: some de um ponto e aparece onde o motor colocou
  piscarArena(ev) {
    if (!ev.de || !ev.para) return;
    const ax = ev.de.x * T, ay = ev.de.y * T - 14, bx = ev.para.x * T, by = ev.para.y * T - 14;
    this.efeitos.push({ tipo: 'translocar', c: this.darius, dur: 0.45, t: 0, alvo: null, fixo: { px: ax - 16, py: ay - 4 } });
    this.brilhos(ax, ay, ['#ffd860', '#7ad8ff', '#ffffff'], 18, 90); this.acender(ax, ay, 40, '#ffd860', 0.4);
    for (let i = 0; i < 14; i++) { const f = i / 14; this.fx.add({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, cor: i % 2 ? '#ffd860' : '#7ad8ff', brilho: true, vida: 0.5, tam: 1.6, encolhe: true }); }
    this.brilhos(bx, by, ['#7ad8ff', '#ffffff'], 16, 80); this.onda(bx, by + 10, 24, '#ffd860', 0.4, 2); this.acender(bx, by, 44, '#7ad8ff', 0.45);
  }

  // roda f com as cores da skin: partículas e luzes já nascem trocadas; efeitos criados ficam marcados
  comCoresDaSkin(f, mapa = this.mapaSkin) {
    if (!mapa) return f();
    const n0 = this.efeitos?.length || 0, antes = this.fx.mapa;
    this.fx.mapa = mapa;
    try { return f(); } finally {
      this.fx.mapa = antes;
      for (let i = n0; i < (this.efeitos?.length || 0); i++) { this.efeitos[i].skin = true; if (mapa !== this.mapaProprio) this.efeitos[i].skinMapa = mapa; }
    }
  }
  corSkin(c) { return mapearCor(this.mapaSkin, c); }
  // contexto que troca as cores pelo mapa de uma skin (um por mapa, guardado)
  tingidoDe(mapa) {
    if (!mapa) return this.g;
    if (!this.tingidos || this.tingidos.g !== this.g) this.tingidos = { g: this.g, m: new Map() };
    let t = this.tingidos.m.get(mapa);
    if (!t) { t = contextoTingido(this.g, mapa); this.tingidos.m.set(mapa, t); }
    return t;
  }
  // a cor de um projétil: a do mapa da skin de quem atirou (outro jogador) ou a da sua
  corDoProj(p, c) { return p.dono ? mapearCor(SKINS_EFEITO[this.jogArena.get(p.dono)?.nome], c) : this.corSkin(c); }
  // Yasuo: com 2 cargas da Tempestade de Aço o próximo Q é o tornado; quando fica pronto, um estouro de vento avisa
  cargasTornado(d) {
    const pronto = this.espadachim && (d.qCarga || 0) >= 2;
    this.tornadoT = d.qCargaT || 0;
    if (pronto && !this.tornadoPronto && !this.morto) {
      const c = this.centro(this.darius), pe = c.y + 12;
      this.comCoresDaSkin(() => {
        this.onda(c.x, pe, 22, '#bfe8ff', 0.45, 2); this.onda(c.x, pe, 14, '#ffffff', 0.35, 1.5);
        this.brilhos(c.x, c.y, ['#ffffff', '#bfe8ff'], 12, 70);
      });
    }
    this.tornadoPronto = pronto;
  }
  // o redemoinho do tornado pronto girando em volta do Yasuo: anéis subindo do pé até o peito, metade atrás do corpo
  // (desenhada antes do sprite) e metade na frente (depois). Pisca quando as cargas estão para acabar.
  redemoinhoTornado(g, X, Y, frente) {
    const t0 = this.tempo, pisca = this.tornadoT < 1.5 ? 0.45 + 0.55 * Math.abs(Math.sin(t0 * 9)) : 1;
    const cor = this.corSkin('#bfe8ff'), claro = this.corSkin('#ffffff'), mx = X + 16, pe = Y + 29;
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    if (!frente) {              // o brilho do vento no chão
      g.globalAlpha = (0.28 + 0.12 * Math.sin(t0 * 7)) * pisca; g.strokeStyle = cor; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, pe, 13, 4.5, 0, 0, Math.PI * 2); g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const r = 10.5 + i * 1.6 - (i === 3 ? 3.5 : 0), yy = pe - 2 - i * 6.5, vel = 8 + i * 1.6, ry = r * 0.36;
      for (let s = 0; s < 2; s++) {
        const a0 = t0 * vel + i * 1.3 + s * Math.PI, passos = 12;
        let ant = null;
        for (let k = 0; k <= passos; k++) {
          const a = a0 + (1.7 * k) / passos, p = { x: mx + Math.cos(a) * r, y: yy + Math.sin(a) * ry }, naFrente = Math.sin(a) > 0;
          if (ant && naFrente === frente && ant.f === frente) {
            g.globalAlpha = (0.35 + 0.6 * (k / passos)) * pisca * (i === 3 ? 0.7 : 0.95);
            g.strokeStyle = (i + s) % 2 ? claro : cor; g.lineWidth = 0.6 + 1.4 * (k / passos);
            g.beginPath(); g.moveTo(ant.x, ant.y); g.lineTo(p.x, p.y); g.stroke();
          }
          ant = { ...p, f: naFrente };
        }
      }
    }
    g.restore();
    if (frente && Math.random() < 0.3) {     // fiapos de vento subindo
      const a = Math.random() * Math.PI * 2;
      this.fx.add({ x: mx + Math.cos(a) * 11, y: pe - Math.random() * 18, vx: -Math.sin(a) * 30, vy: -25 - Math.random() * 20, cor: Math.random() < 0.5 ? cor : claro, brilho: true, vida: 0.4, tam: 1.2, encolhe: true });
    }
  }
  evento(ev, combate) {
    // tudo o que é habilidade do campeão sai com as cores da skin; o que vem de monstros, chefes e da interface, não
    if (!EVENTOS_SEM_SKIN.has(ev.tipo)) return this.comCoresDaSkin(() => this.eventoDireto(ev, combate));
    return this.eventoDireto(ev, combate);
  }
  eventoDireto(ev, combate) {
    const d = this.darius;
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    switch (ev.tipo) {
      case 'pisaoAviso': this.pisoes.push({ x: ev.x, y: ev.y, raio: ev.raio, t: 0, dur: ev.t }); break;
      case 'pisao': {
        this.tremor = ev.acertou ? 0.5 : 0.35; this.flash = ev.acertou ? 0.25 : 0;
        this.ondas.push({ x: ev.x, y: ev.y, raio: ev.raio, t: 0 });
        for (let k = 0; k < 26; k++) { const a = Math.random() * 6.28, r = Math.random() * ev.raio * T; this.fx.add({ x: ev.x * T + Math.cos(a) * r, y: ev.y * T + Math.sin(a) * r * 0.6, vx: Math.cos(a) * 30, vy: -20 - Math.random() * 30, grav: 120, chao: ev.y * T + Math.sin(a) * r * 0.6 + 4, cor: ['#8a7a5a', '#b8a888', '#6a5a40'][k % 3], vida: 0.7, tam: 2 }); }
        break;
      }
      case 'guardiaoVencido':
        this.tremor = 0.4; this.chefeBarra = null;
        this.fx.explosao(ev.x * T, ev.y * T, { qtd: 30, vel: 60, cor: ['#ffd84a', '#fff0a0', '#ff8a30'], vida: 0.9, tam: 2.5, encolhe: true });
        break;
      case 'guardiaoFuria':
        this.tremor = 0.5; this.flash = 0.2; this.corFlash = '200,30,0';
        this.aviso(t('O guardião está furioso!'), '#ff4020');
        if (v) { v.furioso = true; this.efeito('furia', v, 1.2); }
        break;
      case 'chavePega': this.aviso(t('Você pegou a Chave da Fortaleza!'), '#ffd84a'); this.efeito('brilho', d, 1.2, '#ffd84a'); break;
      case 'grupo':
        if (ev.guardiao) { this.tremor = 0.5; this.aviso(t('O Guardião da Fortaleza despertou!'), '#ff5050'); this.log(t('O guardião da fortaleza despertou: {nome}!', { nome: t(ev.nome) }), 'chefe'); break; }
        if (ev.chefe) {
          this.aviso(t('{nome} apareceu!', { nome: t(ev.nome) }), '#ff5050');
          this.log(t('Um chefe apareceu: {nome}!', { nome: t(ev.nome) }), 'chefe');
        } else if (!this.morto && !this.arena) {
          if (ev.furioso) {
            this.aviso(t('Um monstro furioso apareceu!'), '#ff6a3a');
            this.log(t('Um monstro furioso apareceu: {nome}! Ele deixa os outros do grupo mais fortes, mas rende como vários monstros.', { nome: t(ev.furioso) }), 'chefe');
          }
          this.passear();
        }
        break;
      case 'dano': {
        if (!v) break;
        const fonte = ev.fonte;
        // a queima (Liandry, veneno): número roxo pequeno, igual para todos os campeões
        if (fonte === 'queima') { if (ev.valor >= 1) this.texto(v, fmt(ev.valor), '#c07cff', 0.85); break; }
        const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : fonte === 'sangue' ? '#b01010'
          : fonte === 'Q' ? '#ff7a30' : fonte === 'item' ? '#e8c840' : fonte === 'T' ? '#d8a050' : fonte === 'M' ? '#ffd040'
          : fonte === 'A' ? '#ff9a5a' : '#ff3030';
        if (this.gelatina) { this.danoZac(ev, v, d); break; }
        if (this.assassina) { this.danoKatarina(ev, v, d); break; }
        if (this.suporte) { this.danoTaric(ev, v, d); break; }
        if (this.espadachim) { this.danoYasuo(ev, v, d); break; }
        if (this.maga) { this.danoLux(ev, v, d); break; }
        if (this.atirador) { this.danoAtirador(ev, v, d); break; }
        this.texto(v, fmt(ev.valor), cor, ev.verdadeiro || ev.critico ? 1.35 : fonte === 'sangue' ? 0.85 : 1);
        if (fonte === 'ataque' || fonte === 'W' || fonte === 'R') { d.atk = 0.22; this.olhar(d, v); }
        if (fonte !== 'sangue') { this.efeito('respingo', v, 0.3); if (Math.random() < 0.35) this.mancha(v); v.hit = 0.14; }
        this.impactoDarius(fonte, v, ev);
        if (fonte === 'ataque') this.efeito('corte', v, 0.18, '#ffd0c0');
        if (fonte === 'Q' || fonte === 'A' || fonte === 'M') this.efeito('corte', v, 0.25, '#ff5a3a');
        if (fonte === 'W') { this.efeito('corteW', v, 0.35); this.efeito('impacto', v, 0.3); this.efeito('lentidao', v, 1.8); this.golpeVertical(v); }
        if (fonte === 'T') this.efeito('lentidao', v, 1.8);
        if (fonte === 'R') {
          this.efeito('guilhotina', v, 0.8); this.efeito('rachadura', v, 1.4); this.flash = 0.22; this.machadoGigante(v);
          if (fonte === 'R') { const dx = v.x - d.x, dy = v.y - d.y, n = Math.hypot(dx, dy) || 1; d.salto = 0.32; d.saltoDx = dx / n; d.saltoDy = dy / n; }
        }
        break;
      }
      case 'habilidade':
        if (estiloNovoLigado()) this.poseHabilidade(d, ev.tecla);
        if (this.gelatina) { this.habilidadeZac(ev, d); break; }
        if (this.assassina) { this.habilidadeKatarina(ev, d); break; }
        if (this.suporte) { this.habilidadeTaric(ev, d); break; }
        if (this.espadachim) { this.habilidadeYasuo(ev, d); break; }
        if (this.maga) { this.habilidadeLux(ev, d); break; }
        if (this.atirador) { this.habilidadeAtirador(ev, d); break; }
        this.habilidadeDariusTudo(ev, d);
        break;
      case 'mascoteAtaque': if (v && this.pet) { if (ev.pet === 'aranha') this.efeito('brilho', v, 0.3, '#8afff0'); else this.efeito('bolaFogo', v, 0.4); this.pet.atk = 0.22; this.olhar(this.pet, v); } break;
      case 'mascoteNivel': if (this.pet) this.texto(this.pet, t('nível {n}!', { n: ev.nivel }), '#ffe080', 0.9); this.log(t('{nome} subiu para o nível {n}!', { nome: t(ev.nome), n: ev.nivel }), 'nivel'); break;
      case 'kite': if (this.atirador) this.recuar(d); break;
      case 'barragem': this.soltarBarragem(d, ev.alvos, ev.dir); break;
      case 'centelha': this.soltarCentelha(d, ev.alvos, ev.dir); break;
      case 'singularidade': this.explodirSingularidade(ev.x * T, ev.y * T); break;
      case 'luzPrende': if (v) this.efeito('prisao', v, 1.5); break;
      // Taric: o feixe do Deslumbrar explode, o Resplendor pega, o pulso do Brilho Facetado
      case 'deslumbrar': {
        for (const e of this.efeitos) if (e.tipo === 'taricFeixe' && (!e.dono || e.dono === d)) e.t = e.dur;
        const cores = ['#30c8ff', '#9af4ff', '#ffffff'], alvos = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
        if (this.arena && ev.dx != null) { const ox = ev.x * T, oy = ev.y * T - 14, comp = (ev.comp || 5.5) * T; this.efeitos.push({ tipo: 'precisao', dur: 0.45, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, ex: ox + ev.dx * comp, ey: oy + ev.dy * comp, cores }); }
        else { const m0 = this.mao(); for (const a2 of alvos) this.raioMistico(m0, a2, cores, 0.3); }
        for (const a2 of alvos) { const p = this.centro(a2); this.estrela4(p.x, p.y, '#9af4ff', 30); this.brilhos(p.x, p.y, ['#9af4ff', '#ffffff'], 10, 80, { forma: 'estrela' }); }
        this.flash = Math.max(this.flash || 0, 0.1); this.tremor = Math.max(this.tremor, 0.15);
        break;
      }
      case 'resplendor':
        for (const e of this.efeitos) if (e.tipo === 'taricEstrela' && e.dono === d) e.t = e.dur;
        this.cupulaTaric(d, ev.duracao || 2.5); this.escuro = Math.max(this.escuro || 0, 0.25); this.corEscuro = '40,30,0';
        for (const nome of ev.grupo || []) { const o = this.jogArena.get(nome); if (o) this.cupulaTaric(o, ev.duracao || 2.5); }
        break;
      case 'facetado': { const c0 = this.centro(d); this.onda(c0.x, c0.y + 10, this.arena ? 1 * T : 30, '#c8f8ff', 0.4, 2); break; }
      case 'bravata': if (v) { const p = this.centro(v); this.onda(p.x, p.y + 8, 14, '#6af0ff', 0.3, 2); } break;
      // Katarina: pegou a adaga e girou; a Lótus jogando adagas; o fim da Lótus e da Tempestade; o golpe saindo das sombras
      // Zac: os quiques, a poça, o braço, a queda do Estilingue, as cópias, as gosmas e a Divisão Celular
      case 'quique': case 'quiqueFim': case 'pocaFim': case 'pocaAcida': case 'zacBraco': case 'zacQueda': case 'mitose': case 'cloneGolpe': case 'mitoseFim':
      case 'gosma': case 'gosmaPega': case 'gosmaSome': case 'divisao': case 'reuniu': this.eventoZac(ev, d); break;
      case 'adagaGiro': this.giroKatarina(d, ev); break;
      case 'lotusLeva': this.levaLotus(d, ev); break;
      case 'lotusFim':
        this.efeitos = this.efeitos.filter((e) => e.tipo !== 'katLotus' || e.dono !== d);
        if (d.pose && d.pose.seq[0] === 54) d.pose = null;
        if (ev.interrompida) this.texto(d, t('interrompida'), '#ffc0c8', 0.75);
        break;
      case 'tempestadeFim': { const c0 = this.centro(d); this.onda(c0.x, c0.y + 10, 46, '#ff3a4a', 0.5, 3); this.faiscas(c0.x, c0.y, ['#dfe6ee', '#ff3a4a'], 14, 120); break; }
      case 'sombraGolpe': if (v) { const p = this.centro(v); this.estrela4(p.x, p.y, '#ff3a4a', 34); this.fx.explosao(p.x, p.y, { qtd: 14, vel: 70, cor: ['#2a0a1a', '#4a0810', '#ff3a4a'], vida: 0.6, atrito: 3, tam: 3, encolhe: true }); } break;
      // Yasuo: o escudo do Fluxo, a Parede de Vento segurando um tiro, os cortes da Lâmina Fantasma e da Dança
      case 'fluxo': {
        const c0 = this.centro(d);
        this.texto(d, t('Fluxo') + ' +' + fmt(ev.escudo || 0), '#bfe8ff', 0.9);
        this.efeito('brilhoArcano', d, 0.8, '#bfe8ff'); this.onda(c0.x, c0.y + 8, 26, '#bfe8ff', 0.5, 2);
        this.brilhos(c0.x, c0.y, ['#ffffff', '#bfe8ff'], 12, 60);
        break;
      }
      case 'ventoBloqueia': {          // a Parede de Vento segurou um tiro: ele voa até a parede e se desfaz nela
        if (!v) { const c0 = this.centro(d); this.barrarVento(c0.x + 14, c0.y - 6, 1, 0); break; }
        const fonte = this.centro(v), p = ev.x != null ? { x: ev.x * T, y: ev.y * T - 12 } : this.pontoNaParede(d, fonte.x, fonte.y - 4);
        v.barrado = this.tempo; v.atk = 0.22; this.olhar(v, d);
        this.tiroNaParede(fonte.x, fonte.y - 4, p.x, p.y, /Mago|Vazio/.test(v.nome) ? '#c070ff' : '#ffb040');
        break;
      }
      case 'ventoBarrou': this.barrarVento(ev.x * T, ev.y * T - 14, -ev.dx, -ev.dy, ['#ffe080', '#ffffff'], false, this.jogArena.get(ev.dono)); break;
      case 'corteFantasma': for (const id of ev.alvos || []) { const a2 = this.criaturas.get(id); if (a2) this.corteVento(a2, 0.25, '#d8f0ff', Math.random() * 1.2 - 0.6); } break;
      case 'dancaCorte': if (v) {
        const p = this.centro(v), lado = Math.random() < 0.5 ? -1 : 1, pv = this.pos(v);
        this.efeitos.push({ tipo: 'fantasmaYasuo', dur: 0.32, t: 0, alvo: null, fixo: { px: 0, py: 0 }, nome: d.nome, dir: lado > 0 ? DIR.O : DIR.L, quadro: Math.random() < 0.5 ? 32 : 53, pts: [{ x: pv.px + lado * 14, y: pv.py - 2 }], forte: true });
        this.corteVento(v, 0.22, '#ffffff', Math.random() * Math.PI, 1.4); this.estrela4(p.x, p.y, '#bfe8ff', 20);
      } break;
      case 'varinhaVolta': {       // a varinha voltou: o escudo vem de novo
        this.efeito('barreira', d, 2.5);
        if (ev.escudo) this.texto(d, '+' + fmt(ev.escudo), '#ffe8f8', 0.85);
        const m0 = this.mao(); this.brilhos(m0.x, m0.y, ['#ff9ae0', '#fff0a0', '#9ad8ff'], 12, 50, { forma: 'estrela' });
        break;
      }
      case 'congela': if (v) this.efeito('congelado', v, 1); break;
      // Ezreal: Marca Arcana, rastros do Apogeu, ricochetes e o portal
      case 'arcanaMarca': if (v) { this.tirarEfeito('runaArcana', v); this.efeito('runaArcana', v, 4); } break;
      case 'arcanaExplode': if (v) {
        this.tirarEfeito('runaArcana', v);
        const p = this.centro(v);
        this.onda(p.x, p.y + 8, 28, '#b060ff', 0.45, 3); this.brilhos(p.x, p.y, ['#b060ff', '#e0b0ff', '#ffffff'], 18, 120, { forma: 'faisca' }); this.acender(p.x, p.y, 40, '#b060ff', 0.4);
      } break;
      case 'rastro': if (v) { this.tirarEfeito('rastro', v); this.efeitos.push({ tipo: 'rastro', c: v, dur: 10, n: ev.n, t: 0, alvo: v, ...this.pos(v) }); } break;
      case 'ressonancia': if (v) { this.tirarEfeito('rastro', v); this.tremor = Math.max(this.tremor, 0.3); } break;
      case 'ricochete': {
        const de = this.criaturas.get(ev.de), para = this.criaturas.get(ev.para);
        if (de && para) {
          const cor = ['#9ae8ff', '#b8f0ff', '#e0f8ff', '#fff0b0', '#ffe080', '#ffc040'][Math.min(5, ev.k || 0)];
          this.projetil('disparo', de, para, 0.12, cor);
          this.depois(0.12, () => { if (this.criaturas.has(para.id)) { const p2 = this.centro(para); this.estrela4(p2.x, p2.y, cor, 16 + (ev.k || 0) * 4); } });
        }
        break;
      }
      case 'ricocheteExplode': if (v) { const p = this.centro(v); this.estrela4(p.x, p.y, '#ffc040', 48); this.pilaresLuz(p.x, p.y + 8, 30, '#ffc040'); this.onda(p.x, p.y + 8, 48, '#ffc040', 0.6, 3); this.brilhos(p.x, p.y, ['#ffc040', '#ffffff', '#9ae8ff'], 26, 160, { forma: 'faisca' }); this.acender(p.x, p.y, 60, '#ffc040', 0.5); this.tremor = Math.max(this.tremor, 0.25); } break;
      case 'portalAtravessa': this.atravessarPortal(d, v); break;
      case 'portalFecha': this.fecharPortal(); break;
      case 'iscaTiro': this.tiroDaIsca(v); break;
      case 'iscaSome': if (this.iscaEf) { this.iscaEf.t = Math.max(this.iscaEf.t, this.iscaEf.dur - 0.35); this.iscaEf = null; } break;
      case 'dominioCresce': {        // Domínio de Noxus: alguém morreu dentro, o território cresce
        const e = this.dominioAtual;
        if (e && e.t < e.dur) { e.raio = ev.raio != null ? ev.raio * T : Math.min(130, e.raio + 12); this.onda(e.cx, e.cy, e.raio, '#ff3020', 0.5, 3); this.acender(e.cx, e.cy, e.raio, '#ff3020', 0.4); }
        break;
      }
      case 'convergencia': {       // Convergência Radiante: a explosão de luz e quem foi preso
        const c0 = this.centro(d), cx = ev.x != null ? ev.x * T : c0.x, cy = ev.y != null ? ev.y * T : c0.y + 10;
        this.explodirConvergencia(cx, cy, this.arena ? 2.4 * T : 46, (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean));
        break;
      }
      case 'estrela': this.estrelaCaindo(ev.x * T, ev.y * T - 8); break;
      case 'prisma': {             // Faísca Prismática: um prisma aparece no cajado e solta um raio de cada cor
        const vs = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
        this.efeitos.push({ tipo: 'prismaLux', c: d, dur: 0.45, t: 0, alvo: null, ...this.pos(d) });
        vs.forEach((a2, k) => this.efeitos.push({ tipo: 'raioPrisma', c: a2, dur: 0.35, t: 0, alvo: a2, cor: ['#ff7ad8', '#ffe060', '#6ad8ff'][k % 3], ...this.pos(a2) }));
        break;
      }
      case 'iluminacao': if (v) { const p = this.centro(v); this.onda(p.x, p.y + 6, 24, '#ffe070', 0.4, 2); this.acender(p.x, p.y, 30, '#ffe070', 0.3); } break;
      case 'luden': for (const id of ev.alvos || []) { const a2 = this.criaturas.get(id); if (a2) this.efeito('disparo', a2, 0.18, '#8ad0ff'); } break;
      case 'arenaFalhou': if (ev.motivo !== 'Em recarga' || Math.random() < 0.3) this.texto(d, ev.texto || t(ev.motivo), '#c8c0b0', 0.75); break;
      case 'arenaPausa': this.arenaPausado = true; this.efeitos = this.efeitos.filter((e) => e.tipo !== 'avisoChao'); this.pisoes = []; break;     // os monstros somem: as marcas no chão também
      case 'arenaVolta': this.arenaPausado = false; this.aviso(t('De volta à luta!'), '#50ff50'); break;
      case 'recallCancelado': this.texto(d, t('Recall cancelado'), '#8ad8ff', 0.8); break;
      case 'tiroMonstro': if (v && !(this.tempo - (v.barrado ?? -9) < 0.15)) { v.atk = 0.22; this.projetil('disparo', v, d, 0.25, '#c070ff'); } break;
      case 'orbePreso': if (v) { const p = this.centro(v); this.brilhos(p.x, p.y - 4, ['#b060ff', '#e0b0ff'], 12, 70); } break;
      case 'esquiva': this.texto(d, t('esquivou'), '#e0e0e0', 0.8); break;
      case 'chefeCarrega':
        if (v) this.chefeCarregaRift(v, d, ev.mec, ev.dur);
        break;
      case 'chefeGolpe':
        if (!v) break;
        v.atk = 0.22; this.tremor = 0.45;
        this.chefeGolpeRift(v, d, ev.mec, ev.bloqueado);
        break;
      // Runeterra: o guardião marca a área no chão e depois acerta
      case 'golpeAviso': this.avisoGuardiao(ev); break;
      case 'vmImpacto': this.impactoVilemaw(ev); break;
      case 'vmMordida': { const vv = this.monsOutros.get('vilemaw:vm'); if (vv) vv.atk = 0.3; this.efeito('corte', this.darius, 0.2, '#7affe8'); this.sangue(this.darius, 5); this.tremor = Math.max(this.tremor || 0, 0.2); break; }
      case 'golpeGuardiao': this.golpeGuardiaoVisual(ev); break;
      case 'chefeInterrompido': if (v) { this.texto(v, t('Interrompido!'), '#ffe040', 1.2); this.efeito('impacto', v, 0.4); } break;
      case 'chefeInvoca':
        if (v) { this.efeito('portal', v, 1); this.aviso(t('O Barão invoca larvas do Vazio!'), '#c070ff'); }
        break;
      case 'buffBarao':
        this.aviso(t('Mão do Barão!'), '#c070ff');
        this.log(t('Você derrotou o Barão Nashor e recebeu a Mão do Barão: +25% de dano, +50% de regeneração e recall rápido por 3 minutos.'), 'raro');
        break;
      case 'recebido': {
        if (ev.pvp) { this.impacto(d, null, ev); break; }
        let quem = ev.origem && this.criaturas.get(ev.origem);
        if (!quem) { const perto = [...this.criaturas.values()].filter((c) => !c.fila.length && Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1); quem = perto[(Math.random() * perto.length) | 0]; }
        if (quem) { quem.atk = 0.22; this.olhar(quem, d); }
        // de longe: o disparo voa até o campeão e o impacto acontece quando ele chega
        if (quem?.distancia > 1) {
          this.projetil('disparo', quem, d, 0.24, ev.magico ? '#c070ff' : '#ffb040');
          this.depois(0.2, () => this.impacto(d, quem, ev));
        } else this.impacto(d, quem, ev);
        if (ev.valor >= 1) this.texto(d, fmt(ev.valor), ev.magico ? '#c070ff' : '#ff3030', ev.frac > 0.08 ? 1.25 : 1);
        break;
      }
      case 'cura': this.curaAcum += ev.valor; break;
      case 'poder': this.balao(d, t('Pelo sangue de Noxus!')); break;
      case 'abate': {
        if (!v) break;
        this.desfazer(v);
        this.corpos.push({ x: v.x, y: v.y, img: corpo(v.spriteNome || v.nome), grande: v.grande, t: 0, dur: 10 });
        this.mancha(v);
        this.soltarMoedas(v, ev.ouro);
        if (ev.furioso) {             // o furioso caiu: estouro de brasas e o aviso
          const p = this.pos(v); this.tremor = Math.max(this.tremor || 0, 0.25);
          this.fx.explosao(p.px + 16, p.py + 18, { qtd: 28, vel: 60, cor: ['#ff5a20', '#ffb040', '#fff0a0'], vida: 0.8, tam: 2.2, encolhe: true });
          this.texto(v, t('Furioso derrotado!'), '#ff7a4a', 1.3, 0.1);
          this.log(t('Você derrotou o monstro furioso ({nome})! +{xp} de experiência.', { nome: t(v.nome), xp: fmt(ev.xp) }), 'chefe');
        }
        const itens = ev.itens.map((id) => this.descreverItem(id));
        itens.forEach((it, k) => { this.texto(v, it.nome + '!', it.cor, 1.1, 0.45 + k * 0.35); this.efeito('brilho', v, 1.6, it.cor); });
        (ev.gemas || []).forEach((g, k) => { const cor = this.corGema?.(g) || '#fff'; this.texto(v, (this.nomeGema?.(g) || g) + '!', cor, 1.2, 0.45 + (itens.length + k) * 0.35); this.efeito('brilho', v, 1.8, cor); });
        this.criaturas.delete(v.id);
        this.log(t('Loot de {nome}: {ouro} de ouro{itens}. +{xp} de experiência.', { nome: t(v.nome).toLowerCase(), ouro: fmt(ev.ouro), itens: itens.map((it) => ', ' + it.nome).join('') + (ev.gemas || []).map((g) => ', ' + (this.nomeGema?.(g) || g)).join('') + (ev.espolios || []).map((id) => ', ' + (this.nomeEspolio?.(id) || id)).join(''), xp: fmt(ev.xp) }), itens.length || ev.gemas?.length ? 'raro' : 'loot');
        for (const id of ev.perdidos) this.log(t('Sua mochila está cheia! {item} ficou no chão.', { item: this.ehEspolio?.(id) ? this.nomeEspolio(id) : this.descreverItem(id).nome }), 'morte');
        if (ev.chefe) this.log(t('{nome} foi derrotado!', { nome: t(v.nome) }), 'chefe');
        break;
      }
      case 'morreu':
        this.morto = true;
        this.corpos.push({ x: d.x, y: d.y, img: corpo(d.nome), t: 0, dur: 4.5 });
        if (ev.aram) { this.aviso(t('Você caiu nesta rodada.'), '#ff4040'); this.log(t('Você caiu nesta rodada (derrotado por {por}). Na arena morrer não custa XP nem itens.', { por: ev.por || '?' }), 'morte'); break; }
        this.aviso(t('Você está morto.'), '#ff4040');
        this.log(ev.por ? t('Você está morto (derrotado por {por}). Perdeu {xp} de experiência.', { por: ev.pvp ? ev.por : t(ev.por).toLowerCase(), xp: fmt(ev.perdaXp) }) : t('Você está morto. Perdeu {xp} de experiência.', { xp: fmt(ev.perdaXp) }), 'morte');
        for (const id of ev.itensPerdidos || []) this.log(t('Você perdeu {item} ao morrer!', { item: this.descreverItem(id).nome }), 'morte');
        break;
      case 'recall': this.balao(d, t('Voltando para a base...'), '#8ad8ff'); break;
      case 'pocao': { const p = this.centro(d); this.fx.explosao(p.x, p.y, { qtd: 10, vel: 30, cor: ev.mana ? '#5aa8ff' : '#ff5a6a', brilho: true, forma: 'circ', vida: 0.7, grav: -40, tam: 2 }); }
        this.texto(d, '+' + fmt(ev.valor), ev.mana ? '#5aa8ff' : '#40e060', 0.9);
        this.efeito('bolhas', d, 0.7, ev.mana ? '#5aa8ff' : '#ff5a5a');
        break;
      case 'semPocao': this.log(t('Acabou o estoque de {nome}!', { nome: ev.nome }), 'morte'); break;
      case 'nivel':
        this.aviso(t('Você avançou para o nível {n}.', { n: ev.nivel }), '#ffffff');
        this.log(t('Você avançou do nível {de} para o nível {n}.', { de: ev.nivel - 1, n: ev.nivel }), 'nivel');
        this.efeito('nivel', d, 1.2);
        this.subiuNivel(d);
        break;
      case 'item': this.balao(d, ev.nome, '#8ad8ff'); this.log(t('{nome} ativado!', { nome: ev.nome }), 'item'); break;
      case 'chefe': break;
    }
  }

  // ---------- helpers visuais ----------
  texto(c, txt, cor, tam = 1, atraso = 0) {
    const { px, py } = this.pos(c), x = px + 16, y = py - (c.grande ? 20 : 0) - tamanhoExtra(c.spriteNome || c.nome);
    // quantos textos saíram há pouco no mesmo lugar: cada novo vai para um lado e um pouco mais para cima
    const n = this.textos.filter((o) => o.t < 0.35 && Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 20).length;
    const lado = n % 2 ? 1 : -1, passo = Math.min(n, 6);
    this.textos.push({ x, y: y - passo * 4, txt, cor, tam, t: -atraso, dx: (Math.random() - 0.5) * 6 + (n ? lado * (6 + passo * 3) : 0) });
  }
  // fala do chat da Fonte: "Nome:" e o texto quebrado em linhas, em amarelo, como no Tibia
  falar(nome, txt) {
    const c = nome === this.nomeJogador ? this.darius : this.outros?.get(nome) || this.jogArena?.get(nome);
    if (!c) return;
    this.conversas = (this.conversas || []).filter((f) => f.c !== c);
    this.conversas.push({ c, nome, txt, t: 0, dur: Math.min(9, 3 + txt.length * 0.07), linhas: null });
  }
  balao(c, txt, cor = '#f08a1c') { this.baloes = this.baloes.filter((b) => b.c !== c); this.baloes.push({ c, txt, cor, t: 0 }); }
  aviso(txt, cor) { this.avisos = [{ txt, cor, t: 0 }]; }
  // ---------- partículas: atalhos ----------
  centro(c) { const { px, py } = this.pos(c); return c.grande ? { x: px, y: py + 4 } : { x: px + 16, y: py + 16 }; }
  depois(t, f) { const mapa = this.fx.mapa, outro = this.emOutro ? this.darius : null; this.agenda.push({ t, f: () => (outro ? this.comoOutro(outro, f) : this.comCoresDaSkin(f, mapa)) }); }
  faiscas(x, y, cor, qtd = 8, vel = 90, vida = 0.3) { this.fx.explosao(x, y, { qtd, vel, cor, forma: 'faisca', brilho: true, vida, atrito: 4, tam: 1.5, achatado: 0.8 }); }
  brilhos(x, y, cor, qtd = 12, vel = 60, extra = {}) { this.fx.explosao(x, y, { qtd, vel, cor, brilho: true, vida: 0.5, atrito: 3, tam: 1.8, encolhe: true, ...extra }); }
  poeira(x, y, qtd = 10, raio = 1) { this.fx.explosao(x, y, { qtd, vel: 55 * raio, cor: ['#b8a07a', '#8a7656', '#d0bc96'], vida: 0.8, atrito: 3, tam: 3, encolhe: true, grav: -10, achatado: 0.4 }); }
  pedras(x, y, qtd = 8, forca = 1, cores = ['#6a5a4a', '#9a8a72', '#4a3e32']) {
    for (let i = 0; i < qtd; i++) {
      const a = Math.random() * Math.PI * 2;
      this.fx.add({ x, y, vx: Math.cos(a) * (20 + Math.random() * 50) * forca, vy: -(50 + Math.random() * 70) * forca, grav: 300, chao: y + 4 + Math.random() * 8,
        vida: 0.8 + Math.random() * 0.4, cor: cores[i % cores.length], tam: 2 + Math.random() * 1.5 });
    }
  }
  sangue(c, qtd = 6, forca = 1) {
    const p = this.centro(c);
    for (let i = 0; i < qtd; i++) this.fx.add({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - 2, vx: (Math.random() - 0.5) * 90 * forca, vy: -(20 + Math.random() * 60) * forca,
      grav: 260, chao: p.y + 9 + Math.random() * 5, vida: 0.9, cor: Math.random() < 0.5 ? '#b01010' : '#7a0808', tam: 1.5 + Math.random() });
  }
  onda(x, y, raio, cor, vida = 0.5, tam = 3, achatado = 0.42) { this.fx.add({ x, y, forma: 'anel', raio, cor, vida, tam, achatado, brilho: true }); }
  acender(x, y, r, cor, vida = 0.3, forca = 1) { this.fx.luz(x, y, r, cor, vida, forca); }
  projetil(tipo, de, para, dur, cor) { this.efeitos.push({ tipo, c: para, de, dur, cor, t: 0, alvo: para, ...this.pos(para) }); }
  mao() {
    const p = this.pos(this.darius), dir = this.darius.dir;
    if (this.maga) return { x: p.px + (dir === DIR.L ? 29 : dir === DIR.O ? 3 : dir === DIR.N ? 9 : 23), y: p.py + (dir === DIR.L || dir === DIR.O ? 17 : 4) };
    return { x: p.px + (dir === DIR.L ? 26 : dir === DIR.O ? 6 : 22), y: p.py + (dir === DIR.N ? 18 : 16) }; }

  // o monstro morto se desfaz em pedaços da cor dele e uma luz sobe
  desfazer(v) {
    const s = sprite(v.spriteNome || v.nome, v.dir, 0), ex = tamanhoExtra(v.spriteNome || v.nome), { px, py } = this.pos(v), l = pixelsDe(s);
    const o = (v.grande ? 32 : 0) + ex;
    const n = Math.min(l.length, v.grande ? 110 : 45);
    for (let i = 0; i < n; i++) {
      const q = l[(Math.random() * l.length) | 0];
      this.fx.add({ x: px - (v.grande ? 32 : 0) - ex / 2 + q.x, y: py - o + q.y, vx: (q.x - s.width / 2) * 2.2 + (Math.random() - 0.5) * 30, vy: -25 - Math.random() * 50,
        grav: 200, chao: py + 24 + Math.random() * 6, vida: 0.7 + Math.random() * 0.5, cor: q.cor, tam: 2 });
    }
    const c = this.centro(v);
    for (let i = 0; i < 6; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 10, y: c.y, vy: -30 - Math.random() * 20, cor: '#e8f0ff', brilho: true, vida: 0.9, tam: 1.5, encolhe: true });
    this.acender(c.x, c.y, v.grande ? 60 : 26, '#fff0d0', 0.4, 0.6);
  }
  subiuNivel(d) {
    const c = this.centro(d);
    this.efeitos.push({ tipo: 'pilar', c: d, dur: 1.1, cor: '#ffd860', t: 0, alvo: null, ...this.pos(d) });
    for (let i = 0; i < 40; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 22, y: c.y + 10, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 80, cor: Math.random() < 0.5 ? '#ffd860' : '#ffffff', brilho: true, vida: 1.2, tam: 1.6, encolhe: true, forma: Math.random() < 0.3 ? 'estrela' : 'quad' });
    this.onda(c.x, c.y + 10, 40, '#ffd860', 0.8, 3); this.acender(c.x, c.y, 80, '#ffe080', 1, 1);
  }

  // ---------- golpe recebido: o campeão pisca, é empurrado, solta faíscas e, se o golpe for forte, a tela treme ----------
  impacto(d, quem, ev) {
    if (this.morto) return;
    const c = this.centro(d), frac = ev.frac || 0, magico = !!ev.magico;
    d.hit = 0.16;
    if (quem) {            // empurrão para longe de quem bateu
      const dx = d.x - quem.x, dy = d.y - quem.y, n = Math.hypot(dx, dy) || 1;
      d.empurrao = 0.16; d.empDx = dx / n; d.empDy = dy / n;
    }
    if (magico) {
      this.brilhos(c.x, c.y - 2, ['#c070ff', '#f0c0ff', '#ffffff'], 10 + Math.round(frac * 60), 90);
      this.onda(c.x, c.y + 8, 18, '#c070ff', 0.35, 2);
    } else {
      this.faiscas(c.x, c.y - 2, ['#ffe0c0', '#ff6a40'], 6 + Math.round(frac * 50), 100);
      this.sangue(d, 3 + Math.round(frac * 30), 1);
      this.efeito('garra', d, 0.26, '#ff4a3a');
    }
    this.acender(c.x, c.y, 26, magico ? '#c070ff' : '#ff3020', 0.18, 0.6);
    if (frac > 0.06) this.tremor = Math.max(this.tremor, Math.min(0.32, frac * 2.5));
    if (frac > 0.12) { this.flash = Math.max(this.flash || 0, 0.12); this.corFlash = magico ? '150,40,200' : '200,0,0'; }
  }

  // ---------- Darius: peso e sangue ----------
  impactoDarius(fonte, v, ev) {
    const c = this.centro(v);
    if (fonte === 'ataque') {
      this.faiscas(c.x, c.y - 2, ['#ffe0c0', '#ff9a5a'], ev.critico ? 12 : 5, ev.critico ? 120 : 80);
      this.sangue(v, ev.critico ? 6 : 3);
      if (ev.critico) this.acender(c.x, c.y, 30, '#ffae40', 0.25);
    } else if (fonte === 'Q') { this.faiscas(c.x, c.y, ['#ff5a2a', '#ffd0a0'], 6); this.sangue(v, 4); }
    else if (fonte === 'W') {
      this.faiscas(c.x, c.y - 4, ['#ff2a1a', '#ffe0d0', '#ff8a5a'], 16, 140); this.sangue(v, 9, 1.3);
      this.onda(c.x, c.y + 10, 26, '#ff3020', 0.4, 2); this.acender(c.x, c.y, 34, '#ff3020', 0.35);
    } else if (fonte === 'A') { this.pedras(c.x, c.y + 10, 6); this.poeira(c.x, c.y + 10, 8); this.acender(c.x, c.y, 26, '#ff9a5a', 0.3); this.sangue(v, 4); }
    else if (fonte === 'T') this.pedras(c.x, c.y + 10, 3, 0.7);
    else if (fonte === 'M') { this.faiscas(c.x, c.y, ['#ff3a20', '#ffd0a0'], 10, 110); this.sangue(v, 5, 1.2); this.efeito('rachadura', v, 1); }
    else if (fonte === 'N') { this.sangue(v, 2, 0.6); if (Math.random() < 0.5) this.faiscas(c.x, c.y + 6, ['#ff3020', '#7a0808'], 4, 50); }
    else if (fonte === 'item') this.faiscas(c.x, c.y, ['#ffe060', '#ffffff'], 6, 70);
    else if (fonte === 'sangue' && Math.random() < 0.5) this.sangue(v, 1, 0.4);
    if (fonte === 'R') this.depois(0.27, () => {
      this.pedras(c.x, c.y + 10, 14, 1.4); this.poeira(c.x, c.y + 10, 16, 1.5); this.sangue(v, 12, 1.5);
      this.onda(c.x, c.y + 10, 56, '#ff3020', 0.6, 3); this.faiscas(c.x, c.y, ['#ff3020', '#ffd0a0'], 14, 160);
      this.acender(c.x, c.y, 70, '#ff3020', 0.5, 1);
    });
  }
  // ---------- panos com física (capa do Darius, cachecol do Ezreal) ----------
  // cada borda do pano é uma corda de pontos presa no ombro/pescoço: cai com a gravidade, leva vento e fica para trás
  // quando o boneco anda (Verlet, em pixels do mundo). O pano é pintado em pixel art num canvas pequeno, com contorno.
  // viajando: barra no meio da tela e um redemoinho de luz azul em volta do campeão
  desenharViagem(g) {
    const v = this.viagem, W = VIS_L * T, y = VIS_A * T * 0.7, w = 120, x = Math.round(W / 2 - w / 2);
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 2, y - 12, w + 4, 20);
    g.strokeStyle = '#5ab8ff'; g.lineWidth = 1; g.strokeRect(x - 1.5, y - 11.5, w + 3, 19);
    g.fillStyle = '#1a2a40'; g.fillRect(x, y + 2, w, 4);
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#3a8aff'); gr.addColorStop(1, '#a8e8ff');
    g.fillStyle = gr; g.fillRect(x, y + 2, Math.round(w * v.k), 4);
    g.font = `bold 7px ${FONTE}`; g.textAlign = 'center'; g.lineWidth = 1.5; g.strokeStyle = '#000'; g.fillStyle = '#d8f0ff';
    const txt = t('Viajando para {lugar}...', { lugar: v.nome });
    g.strokeText(txt, W / 2, y - 2); g.fillText(txt, W / 2, y - 2);
    g.font = `5px ${FONTE}`; g.fillStyle = '#9ab8d0'; const esc = t('Esc para cancelar');
    g.strokeText(esc, W / 2, y + 16); g.fillText(esc, W / 2, y + 16);
    const p = this.pos(this.darius);
    if (this.fx && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 6;
      this.fx.add({ x: p.px + 16 + Math.cos(a) * r, y: p.py + 26 + Math.sin(a) * r * 0.4, vx: -Math.sin(a) * 18, vy: -14 - v.k * 30, cor: ['#5ab8ff', '#a8e8ff', '#ffffff'][(Math.random() * 3) | 0], brilho: true, vida: 0.7, tam: 1.6 + v.k, encolhe: true });
    }
    g.save(); g.globalAlpha = 0.25 + 0.35 * v.k; g.strokeStyle = '#7ad0ff'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(p.px + 16, p.py + 29, 9 + 5 * v.k, 3.5 + 2 * v.k, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  // a perna do cavaleiro: coxa para a frente e canela até o estribo, com contorno, na cor da calça (ou da bota) do campeão
  pernaMontado(g, c, X, yQuadril, subida) {
    const m = c.montXY; if (!m) return;
    const ap = aparencia(c.spriteNome || c.nome), cor = ap.botas || ap.calca || '#3a3030', bota = ap.botas ? tom(ap.botas, 0.75) : '#2a1e16';
    const lado = m.lado, hx = Math.round(X + 16 + lado), hy = Math.round(yQuadril - 2);
    const ex = Math.round(lado === 1 ? m.x + m.w - 17.2 * m.k : m.x + 17.2 * m.k), ey = Math.round(m.y + 20.6 * m.k + subida);
    const jx = Math.round(hx + lado * 3), jy = hy + 2;
    const seg = (x0, y0, x1, y1, w, cc) => { g.strokeStyle = cc; g.lineWidth = w; g.lineCap = 'square'; g.beginPath(); g.moveTo(x0 + 0.5, y0 + 0.5); g.lineTo(x1 + 0.5, y1 + 0.5); g.stroke(); };
    seg(hx, hy, jx, jy, 4, '#140e0a'); seg(jx, jy, ex, ey - 1, 4, '#140e0a');
    seg(hx, hy, jx, jy, 2, cor); seg(jx, jy, ex, ey - 1, 2, cor);
    g.fillStyle = '#140e0a'; g.fillRect(ex - 2 + (lado === 1 ? 1 : -1), ey - 1, 5, 3);
    g.fillStyle = bota; g.fillRect(ex - 1 + (lado === 1 ? 1 : -1), ey - 1, 3, 2);
    g.fillStyle = '#c8c8d0'; g.fillRect(ex - 1, ey + 1, 3, 1);          // estribo
  }
  // os jogadores (fora o seu campeão) mais perto de você: só eles têm a física dos panos a cada quadro (calculado uma vez por quadro)
  panoPerto() {
    if (this.pertoT === this.tempo) return this.perto;
    const d = this.darius, dist = (o) => Math.hypot(o.x - d.x, o.y - d.y);
    const cand = [...this.outros.values(), ...this.jogArena.values()].filter((o) => o.x != null);
    this.perto = new Set(cand.length <= PANO_PERTO ? cand : cand.sort((a2, b) => dist(a2) - dist(b)).slice(0, PANO_PERTO));
    this.pertoT = this.tempo;
    return this.perto;
  }
  pano(c, X, Y) {
    const forma = aparencia(c.nome).forma, a = aparencia(c.nome), d = c.dir;
    // Fonte cheia (30 jogadores criavam 30 a 60 imagens por quadro): longe de você, o pano é refeito só algumas vezes por
    // segundo e, no meio, o último desenho acompanha o personagem
    // perto (o seu e os mais próximos): refeito no máximo a cada panoPasso (30 por segundo; no modo leve, 15)
    const cache = c.panoCache;
    if (cache && cache.d === d && this.tempo - cache.t < (c === this.darius ? this.panoPasso : this.panoPerto().has(c) ? Math.max(this.panoPasso, PANO_OUTRO_S) : PANO_LONGE_S)) return { img: cache.img, x: X + cache.dx, y: Y + cache.dy, frente: cache.frente };
    const esp = d === DIR.O ? (x) => 32 - x : (x) => x;          // o lado esquerdo é o direito espelhado
    let ancoras, seg, nSeg, cor, frente = false;
    if (forma === 'darius') {
      if (!a.capa) return null;
      ancoras = d === DIR.S ? [[10, 15], [22, 15]] : d === DIR.N ? [[10, 15], [22, 15]] : [[esp(11), 15], [esp(15), 15]];
      seg = 3.3; nSeg = 4; cor = a.capa; frente = d === DIR.N;
    } else if (forma === 'ezreal') {
      ancoras = d === DIR.S ? [[11, 15], [12.5, 15]] : d === DIR.N ? [[15, 15], [17, 15]] : [[esp(12.5), 14], [esp(14), 14]];
      seg = 2.4; nSeg = 4; cor = a.ombro; frente = d === DIR.N;
    } else if (forma === 'lux') {
      // o cabelo comprido da Lux: um lençol de fios presos atrás da cabeça, até a cintura; balança andando e com o vento
      ancoras = d === DIR.S || d === DIR.N ? [[10.8, 8], [21.2, 8]] : [[esp(12), 8.5], [esp(14.6), 6.2]];
      seg = 2.5; nSeg = 5; cor = a.cabelo; frente = d === DIR.N;
    } else if (forma === 'taric') {
      // o cabelo comprido e ondulado do Taric: solto atrás da cabeça até os ombros; balança andando e com o vento
      ancoras = d === DIR.S || d === DIR.N ? [[11.6, 8], [20.4, 8]] : [[esp(11.8), 9], [esp(14.4), 6]];
      seg = 2.4; nSeg = 4; cor = a.cabelo; frente = d === DIR.N;
    } else if (forma === 'katarina') {
      // o cabelo vermelho comprido da Katarina: solto atrás da cabeça até as costas; balança andando, girando e com o vento
      ancoras = d === DIR.S || d === DIR.N ? [[12.2, 7], [19.8, 7]] : [[esp(10.4), 9.6], [esp(14.6), 5]];
      seg = 2.6; nSeg = 5; cor = a.cabelo; frente = d === DIR.N;
    } else if (forma === 'yasuo') {
      // o rabo de cavalo do Yasuo: preso no nó do alto da cabeça, comprido e grosso; balança andando, atacando e com o vento
      ancoras = d === DIR.S ? [[18.4, 4.8], [19.6, 4.2]] : d === DIR.N ? [[15.2, 3.8], [16.8, 3.8]] : [[esp(12.6), 4.6], [esp(13.8), 3.8]];
      seg = 2.6; nSeg = 6; cor = a.cabelo; frente = d === DIR.N;
    } else return null;
    const agora = this.tempo, dt = Math.min(0.05, Math.max(0.001, agora - (c.panoT ?? agora - 0.016))); c.panoT = agora;
    const vento = (forma === 'ezreal' ? 0.16 : forma === 'yasuo' ? 0.13 : forma === 'lux' ? 0.05 : 0.07) * (0.6 + 0.4 * Math.sin(agora * 1.7 + (c.x || 0))) + Math.sin(agora * 4.3) * 0.03;
    c.cordas ??= [];
    const cordas = ancoras.map(([ax, ay], k) => {
      const x0 = X + ax, y0 = Y + ay;
      // de frente e de costas a capa abre em leque (as bordas são puxadas para fora)
      // de lado, capa e cachecol vão um pouco para trás (para as costas), mesmo parados
      const abre = (forma === 'darius' || forma === 'lux' || forma === 'katarina' || forma === 'taric') && (d === DIR.S || d === DIR.N) ? (k === 0 ? -0.06 : 0.06) * (forma === 'darius' ? 1.5 : 0.7) : forma === 'yasuo' && d === DIR.S ? 0.07 : forma === 'yasuo' && d === DIR.N ? 0.04 : d === DIR.L ? (forma === 'katarina' ? -0.04 : -0.1) : d === DIR.O ? (forma === 'katarina' ? 0.04 : 0.1) : 0;
      let corda = c.cordas[k];
      if (!corda || corda.length !== nSeg + 1 || Math.hypot(corda[0].x - x0, corda[0].y - y0) > 40)
        corda = c.cordas[k] = Array.from({ length: nSeg + 1 }, (_, i) => ({ x: x0, y: y0 + i * seg, ax: x0, ay: y0 + i * seg }));
      corda[0].x = corda[0].ax = x0; corda[0].y = corda[0].ay = y0;
      // o cabelo do Yasuo: o vento sempre o leva para as costas (de lado) e o balança de um lado para o outro (de frente e de costas)
      const ventoX = forma !== 'yasuo' ? vento * (d === DIR.O ? -1 : 1)
        : d === DIR.L ? -vento * 0.6 : d === DIR.O ? vento * 0.6 : Math.sin(agora * 1.4 + (c.x || 0)) * 0.09;
      const passos = Math.max(1, Math.round(dt * 60)), peso = forma === 'lux' || forma === 'katarina' || forma === 'taric' ? 0.6 : 0.32;      // o cabelo da Lux é pesado: cai pelas costas
      for (let n = 0; n < passos; n++) {
        for (let i = 1; i <= nSeg; i++) {
          const q = corda[i], am = forma === 'lux' || forma === 'katarina' || forma === 'taric' ? 0.84 : 0.9, vx = (q.x - q.ax) * am, vy = (q.y - q.ay) * am;
          q.ax = q.x; q.ay = q.y; q.x += vx + (ventoX + abre) * (i / nSeg); q.y += vy + peso;
        }
        for (let it = 0; it < 4; it++) for (let i = 1; i <= nSeg; i++) {
          const a0 = corda[i - 1], b = corda[i], dx = b.x - a0.x, dy = b.y - a0.y, dd = Math.hypot(dx, dy) || 0.001, dif = (dd - seg) / dd;
          if (i === 1) { b.x -= dx * dif; b.y -= dy * dif; } else { a0.x += dx * dif * 0.5; a0.y += dy * dif * 0.5; b.x -= dx * dif * 0.5; b.y -= dy * dif * 0.5; }
          if (b.y < y0 - 2) b.y = y0 - 2;            // o pano não sobe por cima do ombro
        }
      }
      return corda;
    });
    // desenho: polígono entre as duas cordas (capa) ou faixa grossa (cachecol), em pixels inteiros, com contorno
    const pts = [...cordas[0], ...[...cordas[1]].reverse()];
    const x0 = Math.floor(Math.min(...pts.map((q) => q.x))) - 2, y0 = Math.floor(Math.min(...pts.map((q) => q.y))) - 2;
    const w = Math.ceil(Math.max(...pts.map((q) => q.x))) - x0 + 3, h = Math.ceil(Math.max(...pts.map((q) => q.y))) - y0 + 3;
    const cv = c.panoCv || (c.panoCv = document.createElement('canvas')); cv.width = w; cv.height = h;      // o mesmo canvas de sempre (p729)
    cv.getContext('2d', { willReadFrequently: true });         // o contorno lê os pixels: na memória comum, sem copiar da placa de vídeo
    const p = new Pincel(cv), loc = pts.map((q) => [q.x - x0, q.y - y0]);
    if (forma === 'darius') {
      p.poli(loc, d === DIR.N ? cor : tom(cor, 0.62));
      const meio = cordas[0].map((q, i) => [(q.x + cordas[1][i].x) / 2 - x0, (q.y + cordas[1][i].y) / 2 - y0]);
      for (let i = 1; i < meio.length; i++) p.l(meio[i - 1][0], meio[i - 1][1], meio[i][0], meio[i][1], tom(cor, d === DIR.N ? 0.7 : 0.45));
      const fim = [cordas[0][nSeg], cordas[1][nSeg]];
      p.l(fim[0].x - x0, fim[0].y - y0, fim[1].x - x0, fim[1].y - y0, tom(cor, 0.4));
    } else if (forma === 'lux' || forma === 'katarina' || forma === 'taric') {
      // cabelo: o lençol (loiro na Lux, vermelho na Katarina) com mechas mais escuras, um brilho no meio e as pontas em fios
      const base = d === DIR.N ? cor : tom(cor, 0.86), mix = (q, r, f) => ({ x: q.x + (r.x - q.x) * f - x0, y: q.y + (r.y - q.y) * f - y0 });
      p.poli(loc, base);
      // as pontas em mechas: triângulos descendo da borda de baixo, uns mais compridos que os outros
      for (const [f, l] of [[0.08, 2], [0.3, 3.2], [0.52, 2.4], [0.74, 3.4], [0.94, 2]]) {
        const q = mix(cordas[0][nSeg], cordas[1][nSeg], f), w = Math.max(1.2, Math.hypot(cordas[1][nSeg].x - cordas[0][nSeg].x, cordas[1][nSeg].y - cordas[0][nSeg].y) * 0.12);
        p.poli([[q.x - w, q.y - 0.5], [q.x + w, q.y - 0.5], [q.x + 0.3, q.y + l]], base);
      }
      for (const [f, c2] of [[0.22, tom(cor, 0.74)], [0.5, tom(cor, 1.16)], [0.78, tom(cor, 0.74)]])
        for (let i = 1; i <= nSeg; i++) { const q0 = mix(cordas[0][i - 1], cordas[1][i - 1], f), q1 = mix(cordas[0][i], cordas[1][i], f); p.l(q0.x, q0.y, q1.x, q1.y, c2); }
    } else if (forma === 'yasuo') {
      // cabelo: mais grosso perto do nó e afinando na ponta, com uma mecha clara em cima e a ponta em fios
      p.poli(loc, cor);
      for (let i = 1; i <= nSeg; i++) {
        const q0 = cordas[0][i - 1], q1 = cordas[0][i], r0 = cordas[1][i - 1], r1 = cordas[1][i], grosso = 1.6 * (1 - i / (nSeg + 2));
        p.l((q0.x + r0.x) / 2 - x0, (q0.y + r0.y) / 2 - y0 - grosso, (q1.x + r1.x) / 2 - x0, (q1.y + r1.y) / 2 - y0 - grosso, cor, 1 + grosso);
        if (i < nSeg) p.l(q0.x - x0, q0.y - y0, q1.x - x0, q1.y - y0, tom(cor, 1.75));
      }
      const pa = cordas[0][nSeg], pb = cordas[1][nSeg];
      p.l(pa.x - x0, pa.y - y0, pa.x - x0 + (pa.x - cordas[0][nSeg - 1].x) * 0.6, pa.y - y0 + 1.5, tom(cor, 0.7));
      p.l(pb.x - x0, pb.y - y0, pb.x - x0 + (pb.x - cordas[1][nSeg - 1].x) * 0.8, pb.y - y0 + 1, tom(cor, 0.6));
    } else {
      p.poli(loc, cor);
      for (let i = 1; i <= nSeg; i++) p.l(cordas[0][i - 1].x - x0, cordas[0][i - 1].y - y0, cordas[0][i].x - x0, cordas[0][i].y - y0, tom(cor, 1.3));
      const ponta = cordas[1][nSeg]; p.px(ponta.x - x0, ponta.y - y0, tom(cor, 0.6));
    }
    contornar(cv);
    c.panoCache = { img: cv, dx: x0 - X, dy: y0 - Y, frente, d, t: this.tempo };
    return { img: cv, x: x0, y: y0, frente };
  }
  // parado por um tempo, o campeão faz um gesto: Darius apoia o machado no ombro, olha em volta ou bate o pé;
  // Ezreal ergue a manopla brilhando ou olha para os lados
  gestoParado(c) {
    c.paradoT = (c.paradoT || 0) + 1 / 60;
    c.proxGesto ??= 4 + Math.random() * 5;
    if (c.pose && this.tempo < c.pose.ate) return;
    if (c.olhando) {                  // olhando em volta: vira para um lado, para o outro e volta
      const k = (this.tempo - c.olhando.t0) / 1.8;
      if (k >= 1) { c.dir = c.olhando.dir; c.olhando = null; } else c.dir = [DIR.L, DIR.L, DIR.S, DIR.O, DIR.O, DIR.S][Math.floor(k * 6)];
      return;
    }
    if (c.paradoT < c.proxGesto) return;
    c.paradoT = 0; c.proxGesto = 5 + Math.random() * 6;
    const forma = aparencia(c.nome).forma, r = Math.random();
    if (r < 0.35) { c.olhando = { t0: this.tempo, dir: c.dir }; return; }
    const g = forma === 'zac' ? (r < 0.75 ? [[45, 45, 45, 45], 1.6] : [[51, 51], 0.7]) : forma === 'darius' || forma === 'taric' ? (r < 0.75 ? [[45, 45, 45, 45, 45, 45], 2.2] : forma === 'taric' ? [[55, 55, 55], 1.1] : [[60, 32, 0], 0.7]) : (r < 0.7 ? [[55, 55, 55], 1.1] : [[51, 51], 0.8]);
    c.pose = { seq: g[0], dur: g[1], ate: this.tempo + g[1] };
    if (forma === 'ezreal' && g[0][0] === 55) this.brilhos(this.centro(c).x, this.centro(c).y - 16, ['#7ad8ff', '#ffffff'], 8, 40);
    if (forma === 'lux' && g[0][0] === 55) this.brilhos(this.centro(c).x, this.centro(c).y - 20, ['#ff9ae0', '#ffffff'], 8, 40);
  }
  // estilo novo: cada habilidade tem a sua sequência de poses (quadros 50 a 60 e o ataque 30 a 33, ver pixel.js)
  poseHabilidade(c, tecla) {
    const POSES = {
      darius: { E: [[54, 54, 33], 0.45], A: [[54, 33], 0.35], W: [[30, 31, 32, 33], 0.36], G: [[59], 0.8], F: [[59], 0.8], N: [[59], 0.9], B: [[59], 0.5], T: [[60, 60, 32, 33], 0.55] },
      ezreal: { Q: [[50, 50, 33], 0.32], W: [[51, 51, 33], 0.45], E: [[52, 53], 0.3], A: [[50, 33], 0.28], M: [[50, 33], 0.28], G: [[55], 0.7], F: [[55], 0.7], T: [[55, 32], 0.5] },
      lux: { Q: [[50, 50, 33], 0.32], W: [[50, 50, 33], 0.35], E: [[55, 50, 33], 0.45], A: [[50, 50, 33], 0.3], M: [[55, 55, 50], 0.45], G: [[55], 0.7], F: [[51, 51, 55], 0.8], T: [[55, 32, 32], 0.55], B: [[55], 0.5], N: [[55, 55, 50, 33], 0.7] },
      yasuo: { Q: [[50, 50, 33], 0.3], W: [[51, 51, 51], 0.5], E: [[52, 53], 0.3], R: [[54, 54, 32, 33], 0.6], A: [[53, 32], 0.35], M: [[30, 31, 32, 33], 0.4], T: [[55, 32, 33], 0.45],
        N: [[54, 32, 53, 32, 54, 33], 0.9], G: [[55], 0.6], F: [[55], 0.5], B: [[51], 0.5] },
      katarina: { Q: [[50, 50, 33], 0.3], W: [[51, 51], 0.4], E: [[52, 53, 33], 0.32], R: [[54], 2.5], A: [[50, 33], 0.28], M: [[52, 53, 32, 33], 0.4], T: [[51, 55], 0.45],
        N: [[54], 3], G: [[55], 0.6], F: [[55], 0.5], B: [[52], 0.4] },
      taric: { Q: [[50, 50, 50], 0.5], W: [[51, 51, 51], 0.6], E: [[52, 52, 52, 52], 1], R: [[54], 2.5], A: [[30, 52, 33], 0.35], M: [[53, 53, 32, 33], 0.6], T: [[54, 54, 55], 0.6],
        N: [[54, 54, 32, 33], 0.7], G: [[55], 0.6], F: [[51, 51, 55], 0.7], B: [[54, 54], 0.6] },
      zac: { Q: [[50, 50, 30], 0.35], W: [[51, 51], 0.3], E: [[52, 52, 53, 53], 0.9], R: [[52], 0.15], A: [[50, 50, 33], 0.35], T: [[55, 55], 0.4], F: [[51, 32], 0.3],
        B: [[45], 0.5], M: [[51, 51], 0.5], N: [[53, 53, 51], 0.6], G: [[51], 0.4] },
    }[aparencia(c.nome).forma]?.[tecla];
    if (POSES) c.pose = { seq: POSES[0], dur: POSES[1], ate: this.tempo + POSES[1] };
  }
  // todas as camadas da habilidade do Darius (o seu e o de outro jogador)
  habilidadeDariusTudo(ev, d) {
    this.balao(d, this.falas[ev.tecla] || ev.tecla);
    this.habilidadeDarius(ev, d);
    if (ev.tecla === 'Q') { d.dirAntes = d.dir; d.giro = 0.42; this.efeito('giro', d, 0.5); this.arcoGiro(d); }
    if (ev.tecla === 'E') for (const c of this.criaturas.values()) if (!ev.alvos || ev.alvos.includes(c.id)) { this.efeito('corrente', c, 0.5); this.gancho(d, c); }
    if (ev.tecla === 'G') { this.efeito('grito', d, 0.9); d.atk = 0.3; }
    if (ev.tecla === 'A' && this.criaturas.has(ev.alvo)) { this.efeito('avanco', this.criaturas.get(ev.alvo), 0.45); this.efeito('impacto', this.criaturas.get(ev.alvo), 0.35); }
    if (ev.tecla === 'F') this.efeito('furia', d, 0.9);
    if (ev.tecla === 'T') { this.efeitos.push({ tipo: 'pisotear', c: d, dur: 0.9, t: 0, alvo: null, escala: 1.7, ...this.pos(d) }); d.atk = 0.22; }
    if (ev.tecla === 'B') {        // Estandarte de Noxus: o Darius fica com a armadura brilhando
      this.estandartePos = { x: d.x - 1, y: d.y };
      this.depois(0.4, () => { const c0 = this.centro(d); this.efeito('brilhoArcano', d, 1, '#c8ccd8'); this.onda(c0.x, c0.y + 10, 30, '#c8ccd8', 0.5, 3); this.faiscas(c0.x, c0.y, ['#ffffff', '#c8ccd8', '#ff5a3a'], 12, 80); });
    }
    if (ev.tecla === 'M') this.rupturaNoxiana(d, ev);
    if (ev.tecla === 'N') this.dominioNoxus(d, ev);
  }
  habilidadeDarius(ev, d) {
    const c = this.centro(d), pe = c.y + 10, t = ev.tecla;
    if (t === 'Q') { this.onda(c.x, pe, 36, '#c01010', 0.5, 3); this.poeira(c.x, pe, 14, 1.3); this.acender(c.x, c.y, 44, '#ff4020', 0.45); }
    if (t === 'E') for (const v of this.criaturas.values()) this.depois(0.22, () => { const p = this.centro(v); this.faiscas(p.x, p.y, ['#c8c8d8', '#ffffff'], 6, 70); });
    if (t === 'G') {
      for (const [k, atraso] of [[0, 0], [1, 0.12], [2, 0.24]]) this.depois(atraso, () => this.onda(c.x, pe, 50 + k * 14, k === 1 ? '#ffe0a0' : '#ff9a30', 0.6, 3 - k * 0.6));
      this.poeira(c.x, pe, 20, 1.6); this.acender(c.x, c.y, 64, '#ff9a30', 0.6);
      for (let i = 0; i < 20; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 30, y: pe, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 50, cor: Math.random() < 0.5 ? '#ffb040' : '#ff5020', brilho: true, vida: 1, tam: 1.5, encolhe: true });
      this.estrela4(c.x, c.y - 4, '#ff9a30', 42); this.aura(['#ff6a20', '#ffd0a0'], 8, 'chamas');
      this.escuro = Math.max(this.escuro || 0, 0.18); this.corEscuro = '40,10,0';
    }
    if (t === 'A') {
      const v = this.criaturas.get(ev.alvo);
      if (v) { const a = this.centro(v); for (let i = 0; i < 10; i++) { const f = i / 10; this.poeira(c.x + (a.x - c.x) * f, pe + (a.y - c.y) * f, 2, 0.5); }
        this.efeitos.push({ tipo: 'investida', dur: 0.32, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: c.y, ex: a.x, ey: a.y });
        this.depois(0.12, () => { this.estrela4(a.x, a.y, '#ff6a4a', 32); this.onda(a.x, a.y + 10, 34, '#ff3020', 0.4, 3); }); }
    }
    if (t === 'F') {
      this.acender(c.x, c.y, 50, '#ff1020', 0.6);
      this.fx.explosao(c.x, c.y, { qtd: 30, vel: 70, cor: ['#d01020', '#7a0810', '#ff4a40'], forma: 'circ', vida: 0.8, grav: -60, tam: 2, atrito: 2 });
      this.estrela4(c.x, c.y - 2, '#ff2030', 36); this.aura(['#d01020', '#ff4a40'], 6, 'sangue');
    }
    if (t === 'T') {
      this.pedras(c.x, pe, 16, 1.2); this.poeira(c.x, pe, 24, 2);
      this.onda(c.x, pe, 104, '#8a6a40', 0.6, 4); this.onda(c.x, pe, 68, '#ffd0a0', 0.4, 2); this.acender(c.x, c.y, 60, '#ffb070', 0.3);
      this.efeitos.push({ tipo: 'rachaduraRadial', dur: 1.3, t: 0, alvo: null, fixo: { px: c.x - 16, py: pe - 18 }, linhas: Array.from({ length: 9 }, (_, k) => ({ a: (k / 9) * Math.PI * 2 + Math.random() * 0.4, l: 34 + Math.random() * 26, z: Array.from({ length: 5 }, () => Math.random() * 2 - 1) })) });
      this.estrela4(c.x, pe - 6, '#ffb070', 44);
    }
    if (t === 'B') { this.cairDoCeu('#ff3020'); this.feixeCeu(c.x, pe, '#ffd060'); this.depois(0.2, () => this.aura(['#c8ccd8', '#ff5a3a'], 4, 'escudo')); }
  }
  // Ruptura Noxiana: o machado bate no chão e abre uma fenda vermelha em linha reta
  rupturaNoxiana(d, ev) {
    const c = this.centro(d), pe = c.y + 10;
    let vx = ev.dir?.x ?? ev.dx ?? 0, vy = ev.dir?.y ?? ev.dy ?? 0, comp = (ev.comp || 6) * T;
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    if (!this.arena && v) {
      const alvos = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean), p = this.centro(v);
      const n = Math.hypot(p.x - c.x, p.y + 10 - pe) || 1; vx = (p.x - c.x) / n; vy = (p.y + 10 - pe) / n;
      comp = Math.max(90, ...alvos.map((a2) => { const q = this.centro(a2); return Math.hypot(q.x - c.x, q.y + 10 - pe) + 26; }));
      this.olhar(d, v);
    }
    if (!vx && !vy) vx = 1;
    this.rupturaEm(c.x + vx * 10, pe + vy * 4, vx, vy, comp);
    d.atk = 0.3;
  }
  rupturaEm(ox, oy, vx, vy, comp) {
    this.estrela4(ox, oy - 4, '#ff3a20', 38);
    const n = Math.hypot(vx, vy) || 1;
    this.efeitos.push({ tipo: 'ruptura', dur: 1.6, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, vx: vx / n, vy: vy / n, comp, zig: Array.from({ length: 16 }, () => Math.random() * 2 - 1) });
    this.flash = 0.15; this.corFlash = '200,20,0';
    this.pedras(ox, oy, 10, 1.3); this.poeira(ox, oy, 12, 1.4); this.acender(ox, oy, 60, '#ff3020', 0.5);
    for (let k = 1; k <= 4; k++) this.depois(k * 0.05, () => { const x = ox + (vx / n) * comp * (k / 4), y = oy + (vy / n) * comp * (k / 4); this.pedras(x, y, 4, 1); this.poeira(x, y, 5, 1); });
  }
  // Domínio de Noxus: o machado fincado e o território vermelho em volta, por 10 s
  dominioNoxus(d, ev) {
    const c = this.centro(d), pe = c.y + 10;
    const cx = ev.x != null ? ev.x * T : c.x, cy = ev.y != null ? ev.y * T : pe, raio = ev.raio != null ? ev.raio * T : 80;
    this.dominioEm(cx, cy, raio, ev.duracao || 10, ev.x == null ? d : null);   // no Rift o território vai junto com o Darius
    this.aviso(dominioNoxus(), '#ff3030'); d.atk = 0.3;
  }
  dominioEm(cx, cy, raio, dur, segue = null) {
    this.estrela4(cx, cy - 10, '#ff2010', 48); this.escuro = Math.max(this.escuro || 0, 0.3); this.corEscuro = '40,0,0';
    const e = { tipo: 'dominio', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx, cy, raio, segue };
    this.efeitos.push(e); this.dominioAtual = e;
    this.onda(cx, cy, raio, '#ff2020', 0.7, 4); this.onda(cx, cy, raio * 0.6, '#ffd0a0', 0.5, 2);
    this.pedras(cx, cy, 12, 1.4); this.acender(cx, cy, raio * 1.4, '#ff2020', 0.6, 0.8);
  }
  // Estandarte / Relíquia: cai do céu e finca no chão
  cairDoCeu(cor) {
    this.quedaB = 1;
    this.depois(0.35, () => {
      const ep = this.estandartePos; if (!ep) return;
      const x = ep.x * T + 16, y = ep.y * T + 26;
      this.poeira(x, y, 18, 1.4); this.pedras(x, y, 8); this.onda(x, y, 44, cor, 0.6, 3); this.acender(x, y - 10, 50, cor, 0.5);
     
    });
  }

  // ---------- Lux: luz prismática ----------
  danoLux(ev, v, d) {
    const f = ev.fonte;
    const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : f === 'P' ? '#ffe070' : f === 'item' ? '#8ad0ff' : f === 'ataque' ? '#ffe0f0'
      : f === 'A' ? '#fff8d0' : f === 'T' ? '#ffe070' : f === 'N' ? '#fff4b0' : f === 'M' ? '#ffe0f8' : f === 'D' ? '#ffc8ff' : '#e0a0ff';
    const atrasoE = f === 'E' && !this.arena ? 0.45 : 0;
    this.texto(v, fmt(ev.valor), cor, ev.verdadeiro || ev.critico || f === 'R' || f === 'M' || f === 'N' ? 1.2 : 1, f === 'ataque' ? 0.12 : f === 'Q' || f === 'A' ? 0.18 : f === 'D' ? 0.12 : atrasoE);
    const p0 = this.centro(v);
    const acerto = (atraso, fn) => this.depois(atraso, () => { const vivo = this.criaturas.has(v.id); if (vivo) v.hit = f === 'ataque' ? 0.07 : 0.14; fn(vivo ? this.centro(v) : p0); });
    if (f === 'ataque') {
      d.atk = 0.22; this.olhar(d, v); this.efeito('tiro', v, 0.16, ev.critico ? '#ffae00' : '#ff9ae0');
      acerto(0.13, (p) => { this.faiscas(p.x, p.y - 2, ev.critico ? ['#ffae00', '#ffffff'] : ['#ff9ae0', '#ffffff'], ev.critico ? 12 : 5, 80); this.acender(p.x, p.y, 20, '#ff9ae0', 0.2); });
    }
    if (f === 'Q') {
      if (!this.arena) { d.atk = 0.22; this.olhar(d, v); this.efeito('disparo', v, 0.2, '#fff0a0'); }
      acerto(this.arena ? 0 : 0.16, (p) => { this.brilhos(p.x, p.y, ['#fff0a0', '#ffffff', '#ff9ae0'], 14, 100, { forma: 'faisca' }); this.acender(p.x, p.y, 30, '#fff0a0', 0.3); });
    }
    if (f === 'A') acerto(this.arena ? 0 : 0.2, (p) => { this.brilhos(p.x, p.y, ['#fff8d0', '#ffffff', '#ff9ae0'], 16, 90, { forma: 'faisca' }); this.acender(p.x, p.y, 26, '#fff0c0', 0.3); });
    if (f === 'M') acerto(0, (p) => this.faiscas(p.x, p.y, ['#ffffff', '#fff0a0', '#ff9ae0'], 8, 100));
    if (f === 'D') acerto(0.12, (p) => this.brilhos(p.x, p.y, ['#ff7ad8', '#ffe060', '#6ad8ff', '#ffffff'], 10, 80, { forma: 'estrela' }));
    if (f === 'E') acerto(atrasoE, (p) => this.faiscas(p.x, p.y, ['#ff9ae0', '#ffffff'], 6, 70));
    if (f === 'R') acerto(0.04, (p) => { this.brilhos(p.x, p.y, ['#ffffff', '#fff0a0', '#ff9ae0'], 18, 150, { forma: 'faisca' }); this.acender(p.x, p.y, 40, '#fff0c0', 0.4); });
    if (f === 'P') acerto(0, (p) => { this.onda(p.x, p.y + 6, 20, '#ffe070', 0.35, 2); this.brilhos(p.x, p.y, ['#ffe070', '#ffffff'], 10, 70, { forma: 'estrela' }); });
    if (f === 'T') acerto(0, (p) => this.brilhos(p.x, p.y, ['#fff0a0', '#ffffff'], 8, 70, { forma: 'estrela' }));
    if (f === 'N') acerto(0, (p) => { this.faiscas(p.x, p.y, ['#ffffff', '#fff0a0', '#ff9ae0'], 7, 90); if (Math.random() < 0.4) this.acender(p.x, p.y, 30, '#fff0c0', 0.25); });
    if (f === 'item' || f === 'pet') acerto(0, (p) => this.faiscas(p.x, p.y, ['#8ad0ff', '#ffffff'], 6, 70));
  }
  // cópias de vento do Yasuo pelo caminho de um avanço (de → até, em pixels do centro), da mais fraca à mais forte
  copiasVento(d, de, ate, quadro = 53, n = 4) {
    const dir = ate.x >= de.x ? DIR.L : DIR.O, pts = [];
    for (let k = 0; k < n; k++) { const f = (k + 0.5) / n; pts.push({ x: de.x + (ate.x - de.x) * f - 16, y: de.y + (ate.y - de.y) * f - 16 }); }
    this.efeitos.push({ tipo: 'fantasmaYasuo', dur: 0.4, t: 0, alvo: null, fixo: { px: 0, py: 0 }, nome: d.nome, dir, quadro, pts });
  }
  // corte de vento em meia-lua sobre o alvo (giro: o ângulo do corte)
  corteVento(v, dur = 0.25, cor = '#bfe8ff', giro = 0, tam = 1) { this.efeitos.push({ tipo: 'corteVento', c: v, dur, cor, giro, tam, t: 0, alvo: v === this.darius ? null : v, ...this.pos(v) }); }
  danoYasuo(ev, v, d) {
    const f = ev.fonte;
    const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : f === 'E' ? '#c8b0ff' : f === 'R' ? '#ffffff' : f === 'ataque' ? '#e8f4ff'
      : f === 'item' ? '#e8c840' : f === 'N' ? '#d8f0ff' : '#9ad8ff';
    this.texto(v, fmt(ev.valor), cor, ev.critico || f === 'R' ? 1.35 : f === 'N' ? 0.9 : 1, f === 'ataque' ? 0.08 : 0);
    v.hit = 0.14;
    const p = this.centro(v);
    if (f === 'ataque') {
      d.atk = 0.22; this.olhar(d, v);
      this.corteVento(v, 0.2, ev.critico ? '#ffd060' : '#e8f4ff', Math.random() * 0.8 - 0.4, ev.critico ? 1.3 : 1);
      if (ev.critico) { this.estrela4(p.x, p.y - 2, '#ffd060', 26); this.faiscas(p.x, p.y, ['#ffd060', '#ffffff'], 10, 100); }
      else this.faiscas(p.x, p.y, ['#ffffff', '#bfe8ff'], 4, 60);
    }
    if (f === 'Q' || f === 'A' || f === 'T' || f === 'M') { this.corteVento(v, 0.25, '#9ad8ff', Math.random() * 1.2 - 0.6, ev.critico ? 1.3 : 1.1); this.faiscas(p.x, p.y, ['#ffffff', '#9ad8ff'], 6, 80); }
    if (f === 'E') { this.corteVento(v, 0.25, '#c8b0ff', -0.5); this.brilhos(p.x, p.y, ['#c8b0ff', '#ffffff'], 8, 60); }
    if (f === 'R') {
      for (let k = 0; k < 3; k++) this.depois(k * 0.07, () => { if (this.criaturas.has(v.id)) this.corteVento(v, 0.22, k === 1 ? '#ffffff' : '#bfe8ff', -1 + k, 1.5); });
      this.estrela4(p.x, p.y - 4, '#ffffff', 40); this.acender(p.x, p.y, 44, '#bfe8ff', 0.4);
    }
    if (f === 'item' || f === 'pet') this.faiscas(p.x, p.y, ['#e8c840', '#ffffff'], 5, 60);
  }
  habilidadeYasuo(ev, d) {
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    const t2 = ev.tecla, c = this.centro(d), pe = c.y + 10;
    const alvosEv = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
    if (v) this.olhar(d, v);
    // direção: em Runeterra a da mira; no Rift, a do alvo (ou para a frente)
    const rumo = () => {
      if (this.arena && (ev.dx || ev.dy)) { const n = Math.hypot(ev.dx, ev.dy) || 1; return { x: ev.dx / n, y: ev.dy / n }; }
      const alvo = v || alvosEv[0] || this.alvo;
      if (alvo) { const p = this.centro(alvo), n = Math.hypot(p.x - c.x, p.y - c.y) || 1; return { x: (p.x - c.x) / n, y: (p.y - c.y) / n }; }
      return { x: d.dir === DIR.O ? -1 : 1, y: 0 };
    };
    d.atk = 0.22;
    if (t2 === 'Q') {
      const r0 = rumo();
      if (ev.tornado && ev.giro) {      // EQ: o tornado gira em volta dele e joga todos para o alto
        this.balao(d, t('Hasagi!'), '#bfe8ff');
        this.efeitos.push({ tipo: 'tornadoVento', dur: 0.7, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: pe, vx: 0, vy: 0, meio: { x: c.x, y: pe }, largo: 1.6 });
        this.onda(c.x, pe, this.arena ? 2.2 * T : 40, '#bfe8ff', 0.5, 3); this.acender(c.x, c.y, 50, '#bfe8ff', 0.45); this.poeira(c.x, pe, 14, 1.3);
      } else if (ev.tornado) {          // o tornado sai da katana e atravessa o grupo
        this.balao(d, t('Hasagi!'), '#bfe8ff');
        if (this.arena) this.efeitos.push({ tipo: 'tornadoVento', dur: 0.85, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: pe, vx: r0.x * 11 * T, vy: r0.y * 11 * T });
        else {
          const cs = alvosEv.map((a2) => this.centro(a2)), m = cs.length ? { x: cs.reduce((s2, q) => s2 + q.x, 0) / cs.length, y: cs.reduce((s2, q) => s2 + q.y, 0) / cs.length + 10 } : { x: c.x + r0.x * 80, y: pe };
          this.efeitos.push({ tipo: 'tornadoVento', dur: 0.9, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: pe, vx: 0, vy: 0, meio: m });
        }
        this.acender(c.x, c.y, 40, '#bfe8ff', 0.4); this.poeira(c.x, pe, 10, 1.1);
      } else if (ev.giro) {             // depois da Espada Ágil: corte em volta
        this.onda(c.x, pe, 34, '#bfe8ff', 0.4, 3); this.efeitos.push({ tipo: 'arcoGiro', c: d, dur: 0.4, t: 0, alvo: null, cor: '#bfe8ff', ...this.pos(d) });
        this.corteVento(d, 0.3, '#ffffff', 0, 2);
      } else {                          // estocada: um risco de vento reto para a frente
        this.efeitos.push({ tipo: 'estocadaVento', dur: 0.28, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x + r0.x * 6, oy: c.y + 2 + r0.y * 6, vx: r0.x, vy: r0.y, comp: this.arena ? 4.5 * T : 64, larg: 5 });
        if ((ev.carga || 0) >= 2) { this.texto(d, t('tornado pronto'), '#bfe8ff', 0.7); this.brilhos(c.x + r0.x * 10, c.y - 4, ['#ffffff', '#bfe8ff'], 10, 50); }
      }
    }
    if (t2 === 'W') {                   // a parede de vento na frente dele
      const r0 = rumo(), x = ev.x != null ? ev.x * T : c.x + r0.x * 26, y = ev.y != null ? ev.y * T + 8 : pe + r0.y * 14;
      this.efeitos.push({ tipo: 'paredeVento', dur: ev.duracao || 4, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: x, cy: y, vx: r0.x, vy: r0.y, dono: d });
      if (this.arena && ev.x != null) {
        const w = ev.dir || r0, n = Math.hypot(w.x, w.y) || 1;
        this.paredes.push({ dono: d === this.darius ? null : d.nomeJogador, x: ev.x, y: ev.y, dx: w.x / n, dy: w.y / n, ate: this.tempo + (ev.duracao || 4) });
      }
      this.onda(x, y, 26, '#bfe8ff', 0.5, 2); this.acender(x, y - 14, 40, '#bfe8ff', 0.5);
    }
    if (t2 === 'E') {                   // a Espada Ágil: o Yasuo atravessa deixando cópias de vento pelo caminho
      const alvo = v || alvosEv[0], r0 = rumo();
      let de = { x: c.x, y: c.y }, ate = alvo ? this.centro(alvo) : { x: c.x + r0.x * 60, y: c.y + r0.y * 60 };
      if (this.arena) { de = { x: c.x - r0.x * (ev.jogador ? 60 : 70), y: c.y - r0.y * 70 }; ate = { x: c.x, y: c.y }; }
      this.copiasVento(d, de, ate, 53, 4);
      this.efeitos.push({ tipo: 'rastroVento', dur: 0.3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: de.x, oy: de.y, ex: ate.x, ey: ate.y });
      this.poeira(c.x, pe, 6, 0.9);
    }
    if (t2 === 'R') {                   // Último Suspiro: some, aparece no alto em cima de quem está no ar e corta todos em X
      const cs = alvosEv.map((a2) => this.centro(a2)), meio = cs.length ? { x: cs.reduce((s2, q) => s2 + q.x, 0) / cs.length, y: Math.min(...cs.map((q) => q.y)) } : { x: c.x, y: c.y };
      this.efeito('translocar', d, 0.4); this.tremor = Math.max(this.tremor, 0.45); this.flash = Math.max(this.flash || 0, 0.15);
      this.escuro = Math.max(this.escuro || 0, 0.5); this.corEscuro = '4,14,32';
      this.ocultoAte = this.tempo + 0.75;
      this.aviso(t('Último Suspiro!'), '#bfe8ff');
      this.efeitos.push({ tipo: 'fantasmaYasuo', dur: 0.75, t: 0, alvo: null, fixo: { px: 0, py: 0 }, nome: d.nome, dir: d.dir === DIR.O ? DIR.O : DIR.L, quadro: 54, pts: [{ x: meio.x - 16, y: meio.y - 46 }], forte: true });
      this.depois(0.05, () => this.texto(d, t('Sorye ge ton!'), '#ffffff', 1));
      alvosEv.forEach((a2, k) => this.depois(0.12 + k * 0.08, () => { if (!this.criaturas.has(a2.id)) return; const p = this.centro(a2); this.efeitos.push({ tipo: 'cortesX', dur: 0.4, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: p.x, cy: p.y - 10, tam: 30, cor: '#bfe8ff' }); this.estrela4(p.x, p.y - 10, '#ffffff', 34); }));
      this.depois(0.55, () => { this.onda(meio.x, meio.y + 10, 60, '#bfe8ff', 0.5, 3); this.acender(meio.x, meio.y, 70, '#bfe8ff', 0.5); });
    }
    if (t2 === 'A') {                   // Investida do Vendaval: o avanço com as cópias e o corte para cima
      const alvo = v || alvosEv[0];
      if (alvo) {
        const p = this.centro(alvo); this.copiasVento(d, c, p, 53, 3);
        this.efeitos.push({ tipo: 'rastroVento', dur: 0.35, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: c.y, ex: p.x, ey: p.y });
        this.depois(0.1, () => { this.corteVento(alvo, 0.3, '#ffffff', -1.6, 1.6); this.estrela4(p.x, p.y, '#bfe8ff', 30); });
      }
    }
    if (t2 === 'G') { this.aura(['#bfe8ff', '#ffffff'], 8, 'estrelas'); this.onda(c.x, pe, 30, '#bfe8ff', 0.5, 2); this.brilhos(c.x, c.y, ['#ffffff', '#bfe8ff'], 14, 60); }
    if (t2 === 'F') { this.aura(['#d8f0ff', '#8ac8f0'], 6, 'arcana'); this.feixeAura(c.x - 20, c.y, 1, 0, 40, ['#ffffff', '#bfe8ff'], 0.3, 6); }
    if (t2 === 'B') {
      this.efeito('brilhoArcano', d, 1, '#bfe8ff'); this.onda(c.x, pe, 30, '#bfe8ff', 0.6, 3); this.aura(['#bfe8ff', '#ffffff'], 3, 'escudo');
      if (ev.escudo) this.texto(d, '+' + fmt(ev.escudo), '#d8f0ff', 0.9);
    }
    if (t2 === 'T') {                   // Furacão Cortante: um redemoinho grande em volta
      this.efeitos.push({ tipo: 'tornadoVento', dur: 0.55, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: pe, vx: 0, vy: 0, meio: { x: c.x, y: pe }, largo: 1.8 });
      this.onda(c.x, pe, this.arena ? 2.6 * T : 48, '#bfe8ff', 0.5, 3); this.onda(c.x, pe, this.arena ? 1.8 * T : 34, '#ffffff', 0.4, 2);
      this.efeitos.push({ tipo: 'arcoGiro', c: d, dur: 0.45, t: 0, alvo: null, cor: '#bfe8ff', ...this.pos(d) });
      this.poeira(c.x, pe, 16, 1.4); this.tremor = Math.max(this.tremor, 0.25);
    }
    if (t2 === 'M') {                   // Lâmina do Vendaval: uma lâmina de vento enorme voa em linha reta
      const r0 = rumo();
      this.efeitos.push({ tipo: 'estocadaVento', dur: 0.45, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x + r0.x * 6, oy: c.y + r0.y * 6, vx: r0.x, vy: r0.y, comp: this.arena ? 6 * T : 150, larg: 13, lua: true });
      for (const a2 of alvosEv) { const p = this.centro(a2); this.depois(0.12, () => { this.corteVento(a2, 0.3, '#ffffff', -1.6, 1.5); this.estrela4(p.x, p.y, '#bfe8ff', 26); }); }
    }
    if (t2 === 'N') {                   // Dança das Mil Lâminas: o Yasuo vira vento; as cópias cortam em volta (ver dancaCorte)
      this.aviso(t('Dança das Mil Lâminas!'), '#bfe8ff'); this.tremor = Math.max(this.tremor, 0.3);
      this.escuro = Math.max(this.escuro || 0, 0.4); this.corEscuro = '4,14,32';
      this.ocultoAte = this.tempo + (ev.duracao || 2.5);
      this.efeito('translocar', d, 0.4); this.onda(c.x, pe, 40, '#bfe8ff', 0.6, 3);
      this.depois(ev.duracao || 2.5, () => { const c2 = this.centro(d); this.efeito('translocar', d, 0.4); this.onda(c2.x, c2.y + 10, 36, '#ffffff', 0.5, 3); });
    }
  }

  // ---------- Katarina ----------
  // as adagas que estão no chão vêm do motor (Rift: combate.darius.adagas, sem posição; Runeterra: A.adagas, em tiles).
  // Cada uma cai girando (de onde foi jogada até o chão) e fica cravada, brilhando, até ela pegar (voa para a mão) ou sumir.
  adagasDoMotor(combate) {
    if (!this.assassina) { if (this.adagasK?.size) this.adagasK.clear(); return; }
    this.adagasK ??= new Map();
    const A = this.arena ? combate.arena : null, lista = (A ? A.adagas : combate.darius.adagas) || [], vistas = new Set();
    const c = this.centro(this.darius);
    for (const ad of lista) {
      vistas.add(ad.id);
      if (this.adagasK.has(ad.id)) continue;
      const resta = Math.max(0.12, A ? ad.cai - A.tempo : ad.t);
      let x, y;
      if (A) { x = ad.x * T; y = ad.y * T - 2; }
      else {           // no Rift o motor não tem posição: perto do monstro em que ela caiu, ou em volta da Katarina
        const alvo = ad.alvo && this.criaturas.get(ad.alvo), b = alvo ? this.centro(alvo) : c, ang = Math.random() * Math.PI * 2, r = alvo ? 12 + Math.random() * 8 : 16 + Math.random() * 14;
        x = b.x + Math.cos(ang) * r; y = b.y + 12 + Math.sin(ang) * r * 0.45;
      }
      const daMao = ad.de === 'W' || ad.de === 'T';
      this.adagasK.set(ad.id, { x, y, ox: daMao ? c.x : x + (c.x - x) * 0.35, oy: daMao ? c.y - 6 : y - 14 + (c.y - y) * 0.35, t0: this.tempo, cai: this.tempo + resta, alto: daMao ? 56 : 30, giro: Math.random() * 6 });
    }
    for (const [id, k] of this.adagasK) if (!vistas.has(id) && !k.fim) k.fim = this.tempo;
    for (const [id, k] of this.adagasK) if (k.fim && this.tempo - k.fim > 0.3) this.adagasK.delete(id);
  }
  // a adaga curva da Katarina em (x, y), com a ponta para "ang"; s = escala
  desenharAdagaVoando(g, x, y, ang, vx = 0, vy = 0, s = 1) {
    const ap = aparencia(this.darius?.nome || 'katarina'), ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (a, b) => [x + ca * a - sa * b, y + sa * a + ca * b];
    g.save(); g.lineCap = 'round';
    if (vx || vy) {              // rastro carmesim
      const n = Math.hypot(vx, vy) || 1; g.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 5; i++) { g.globalAlpha = 0.5 * (1 - i / 6); g.fillStyle = '#ff3a4a'; g.fillRect(Math.round(x - (vx / n) * i * 3) - 1, Math.round(y - (vy / n) * i * 3) - 1, 2, 2); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    const linha = (a0, b0, a1, b1, w, cor) => { const [x0, y0] = P(a0, b0), [x1, y1] = P(a1, b1); g.strokeStyle = cor; g.lineWidth = w * s; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    linha(-4 * s, 0, 8 * s, 0, 3.2, '#160a0c');
    linha(0, 0, 4 * s, 0.6 * s, 1.8, ap.lamina || '#dfe6ee'); linha(4 * s, 0.6 * s, 8 * s, -0.4 * s, 1.4, ap.lamina || '#dfe6ee');
    linha(-4 * s, 0, -0.5 * s, 0, 1.8, ap.cabo || '#5a1a20');
    linha(-0.5 * s, -2 * s, -0.5 * s, 2 * s, 1.4, ap.guarda || '#c8a050');
    g.restore();
  }
  // as adagas que a Katarina de outro jogador deixou no chão (vêm no estado do servidor): a mesma marca, sem o voo
  desenharAdagasOutros(g) {
    if (!this.arena || !this.jogArena?.size) return;
    for (const o of this.jogArena.values()) {
      if (!o.adagas?.length || o.morto) continue;
      const meu = this.mapaSkin; this.mapaSkin = SKINS_EFEITO[o.nome] || null;
      try { o.adagas.forEach(([x, y], k) => this.adagaCravada(this.tingidoDe(this.mapaSkin), { x: x * T, y: y * T - 2, giro: k * 1.7 }, this.tempo)); } finally { this.mapaSkin = meu; }
    }
  }
  desenharAdagas(g0) {
    const agora = this.tempo, g = this.gTingido || g0;      // as cores da skin valem nas adagas
    for (const k of this.adagasK.values()) {
      this.comCoresDaSkin(() => {
        if (k.fim) {             // pega: voa para a mão; sumiu: apaga
          const q = Math.min(1, (agora - k.fim) / 0.3);
          if (k.pega) { const c = this.centro(this.darius); this.desenharAdagaVoando(g, k.x + (c.x - k.x) * q, k.y - 8 + (c.y - k.y) * q, agora * 30); }
          else { g.globalAlpha = 1 - q; this.adagaCravada(g, k, agora); g.globalAlpha = 1; }
          return;
        }
        if (agora < k.cai) {     // caindo: um arco do ponto de saída até o chão, girando; a sombra cresce
          const q = (agora - k.t0) / Math.max(0.01, k.cai - k.t0), x = k.ox + (k.x - k.ox) * q, yc = k.oy + (k.y - k.oy) * q - Math.sin(q * Math.PI) * k.alto;
          g.fillStyle = `rgba(10,6,8,${0.15 + 0.3 * q})`; g.beginPath(); g.ellipse(k.x, k.y + 1, 2 + 3 * q, 1 + q, 0, 0, Math.PI * 2); g.fill();
          this.desenharAdagaVoando(g, x, yc, k.giro + agora * 22);
          if (Math.random() < 0.4) this.fx.add({ x, y: yc, vx: 0, vy: 0, cor: '#ff3a4a', brilho: true, vida: 0.25, tam: 1.2, encolhe: true });
          return;
        }
        if (!k.cravou) { k.cravou = true; this.faiscas(k.x, k.y, ['#dfe6ee', '#ff8aa0'], 5, 50, 0.2); this.poeira(k.x, k.y + 1, 3, 0.4); }
        this.adagaCravada(g, k, agora);
      });
    }
  }
  // cravada no chão, inclinada, com um anel carmesim pulsando em volta (é ali que ela pega)
  adagaCravada(g, k, agora) {
    const pulso = 0.5 + 0.5 * Math.sin(agora * 6 + k.giro), cor = this.corSkin('#ff3a4a');
    // sombra escura embaixo: a adaga aparece em qualquer chão (grama clara, areia, pedra)
    g.save(); g.globalAlpha *= 0.55; g.fillStyle = '#000'; g.beginPath(); g.ellipse(k.x, k.y + 1, 10, 4.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';
    // uma coluna fina de luz subindo, pulsando (dá para achar a adaga de longe)
    const gr = g.createLinearGradient(0, k.y - 30, 0, k.y);
    gr.addColorStop(0, 'rgba(255,58,74,0)'); gr.addColorStop(1, `rgba(255,90,100,${0.3 + 0.35 * pulso})`);
    g.fillStyle = gr; g.fillRect(k.x - 2.5, k.y - 30, 5, 30);
    g.globalAlpha *= 0.7 + 0.3 * pulso; g.strokeStyle = cor; g.lineWidth = 2;
    g.beginPath(); g.ellipse(k.x, k.y + 1, 8.5 + pulso * 2, 3.8 + pulso * 0.8, 0, 0, Math.PI * 2); g.stroke();
    g.drawImage(halo(cor), k.x - 11, k.y - 9, 22, 16);
    g.restore();
    g.save(); g.translate(k.x - 1, k.y - 6); g.scale(1.3, 1.3); this.desenharAdagaVoando(g, 0, 0, Math.PI / 2 + 0.35); g.restore();          // a ponta enterrada, o cabo para cima (30% maior)
    if (Math.random() < 0.02) this.fx.add({ x: k.x - 2, y: k.y - 9, vx: 0, vy: -8, cor: '#ffffff', brilho: true, forma: 'estrela', vida: 0.35, tam: 1.6, encolhe: true });
  }
  fumacaSombria(x, y, qtd = 14) {
    this.fx.explosao(x, y, { qtd, vel: 55, cor: ['#1a0a12', '#2a0a1a', '#4a0810', '#7a0a14'], vida: 0.7, atrito: 3, tam: 3.4, encolhe: true, grav: -18 });
    this.fx.explosao(x, y, { qtd: Math.ceil(qtd / 2), vel: 80, cor: ['#ff3a4a', '#ff8aa0'], brilho: true, forma: 'faisca', vida: 0.3, atrito: 4, tam: 1.4 });
  }
  // pegou a adaga: um corte em círculo em volta dela
  giroKatarina(d, ev) {
    const k = ev.adaga != null && this.adagasK?.get(ev.adaga);
    if (k) { k.pega = true; k.fim = k.fim || this.tempo; }
    const c = this.centro(d), raio = this.arena ? 2 * T : 40;
    this.efeitos.push({ tipo: 'katGiro', dur: 0.36, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, raio, giro: Math.random() * 6 });
    d.pose = { seq: [54, 54], dur: 0.3, ate: this.tempo + 0.3 }; d.atk = 0.22;
    this.onda(c.x, c.y + 10, raio, '#ff3a4a', 0.35, 2); this.acender(c.x, c.y, 34, '#ff3a4a', 0.3);
    for (const id of ev.alvos || []) { const v = this.criaturas.get(id); if (v) { const p = this.centro(v); this.depois(0.06, () => this.faiscas(p.x, p.y, ['#dfe6ee', '#ff3a4a'], 6, 80)); } }
  }
  // Lótus da Morte: uma leva de adagas da Katarina até cada alvo
  levaLotus(d, ev) {
    const c = this.centro(d);
    for (const id of ev.alvos || []) {
      const v = this.criaturas.get(String(id)) || (String(id).startsWith('j:') ? this.jogArena.get(String(id).slice(2)) : null);
      if (!v) continue;
      const p = this.centro(v), ang = Math.random() * 0.6 - 0.3;
      this.efeitos.push({ tipo: 'katVoo', dur: 0.12, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x + Math.cos(ang) * 6, oy: c.y - 4, ex: p.x, ey: p.y - 4, alto: 4 });
    }
  }
  danoKatarina(ev, v, d) {
    const f = ev.fonte;
    const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : f === 'ataque' ? '#ffe8ec' : f === 'item' ? '#e8c840' : f === 'P' ? '#ff8aa0' : '#ff5a7a';
    this.texto(v, fmt(ev.valor), cor, ev.verdadeiro || f === 'M' ? 1.3 : f === 'R' || f === 'N' ? 0.8 : 1, f === 'ataque' ? 0.08 : 0);
    v.hit = 0.14;
    const p = this.centro(v);
    if (f === 'ataque') { d.atk = 0.22; this.olhar(d, v); this.efeito('corte', v, 0.18, '#ffc0c8'); this.faiscas(p.x, p.y, ['#ffffff', '#ff8aa0'], 4, 60); }
    else if (f === 'R' || f === 'N') { if (Math.random() < 0.5) this.faiscas(p.x, p.y, ['#dfe6ee', '#ff3a4a'], 3, 60); }
    else if (f === 'item' || f === 'pet') this.faiscas(p.x, p.y, ['#e8c840', '#ffffff'], 5, 60);
    else { this.efeito('corte', v, 0.22, '#ff3a4a'); this.faiscas(p.x, p.y, ['#ffffff', '#ff3a4a'], 6, 80); }
    if (ev.verdadeiro && f === 'M') { this.texto(v, t('Executado!'), '#ffffff', 0.9, 0.12); this.tremor = Math.max(this.tremor, 0.3); }
  }
  habilidadeKatarina(ev, d) {
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    const t2 = ev.tecla, c = this.centro(d), pe = c.y + 10, mao = { x: c.x + (d.dir === DIR.O ? -8 : 8), y: c.y - 2 };
    const alvosEv = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
    if (v) this.olhar(d, v);
    d.atk = 0.22;
    const voo = (de, para, dur, alto = 6, atraso = 0) => this.depois(atraso, () => this.efeitos.push({ tipo: 'katVoo', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: de.x, oy: de.y, ex: para.x, ey: para.y, alto }));
    if (t2 === 'Q') {             // a adaga salta de alvo em alvo
      const pts = this.arena && ev.caminho ? ev.caminho.map((q) => ({ x: q.x * T, y: q.y * T - 14 })) : alvosEv.map((a2) => { const q = this.centro(a2); return { x: q.x, y: q.y - 4 }; });
      let de = mao;
      pts.forEach((q, k) => { voo(de, q, 0.11, k ? 10 : 4, k * 0.11); this.depois(k * 0.11 + 0.11, () => this.estrela4(q.x, q.y, '#ff3a4a', 18)); de = q; });
    }
    if (t2 === 'W') { this.poeira(c.x, pe, 6, 0.8); this.brilhos(mao.x, mao.y, ['#ff8aa0', '#ffffff'], 8, 40); this.efeitos.push({ tipo: 'katRastro', dur: 1.25, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d }); }
    if (t2 === 'E') {             // Shunpo: some numa fumaça e aparece do lado do alvo
      let de = { x: c.x, y: c.y }, ate = v ? this.centro(v) : { x: c.x + (d.dir === DIR.O ? -50 : 50), y: c.y };
      if (this.arena && ev.de) { de = { x: ev.de.x * T, y: ev.de.y * T - 16 }; ate = { x: c.x, y: c.y }; }
      this.fumacaSombria(de.x, de.y, 16); this.depois(0.05, () => this.fumacaSombria(ate.x, ate.y, 10));
      const dir = ate.x >= de.x ? DIR.L : DIR.O;
      this.efeitos.push({ tipo: 'fantasmaYasuo', dur: 0.35, t: 0, alvo: null, fixo: { px: 0, py: 0 }, nome: d.nome, dir, quadro: 53, tinta: '#ff3a4a', pts: [{ x: de.x - 16, y: de.y - 16 }] });
      if (v) this.depois(0.06, () => { if (this.criaturas.has(v.id)) { const p = this.centro(v); this.efeitos.push({ tipo: 'cortesX', dur: 0.3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: p.x, cy: p.y - 6, tam: 18, cor: '#ff3a4a' }); } });
    }
    if (t2 === 'R') {             // Lótus da Morte: gira no lugar, adagas para todo lado (as levas vêm em lotusLeva)
      this.efeitos.push({ tipo: 'katLotus', dur: ev.duracao || 2.5, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, raio: this.arena ? 3.5 * T : 56 });
      this.balao(d, t('Lótus da Morte!'), '#ff8aa0');
      this.escuro = Math.max(this.escuro || 0, 0.3); this.corEscuro = '40,4,10';
      this.onda(c.x, pe, this.arena ? 3.5 * T : 56, '#ff3a4a', 0.6, 3);
    }
    if (t2 === 'A') {             // Adaga Certeira: no Rift a adaga voa reta até o mais distante (em Runeterra é um projétil)
      if (!this.arena && v) { const p = this.centro(v); voo(mao, { x: p.x, y: p.y - 4 }, 0.16, 2); this.depois(0.16, () => this.estrela4(p.x, p.y, '#ffffff', 26)); }
    }
    if (t2 === 'G') { this.aura(['#ff3a4a', '#7a0a14'], 8, 'sangue'); this.onda(c.x, pe, 30, '#ff3a4a', 0.5, 2); this.brilhos(c.x, c.y, ['#ff8aa0', '#ffffff'], 12, 60); }
    if (t2 === 'F') { this.aura(['#8aff6a', '#2a8a3a'], 8, 'arcana'); this.brilhos(mao.x, mao.y, ['#8aff6a', '#d0ffc0'], 12, 50); }
    if (t2 === 'T') {             // Chuva de Adagas: um giro em volta e as adagas sobem (e caem pelo adagasDoMotor)
      const raio = this.arena ? (ev.raio || 2.4) * T : 44;
      this.efeitos.push({ tipo: 'katGiro', dur: 0.4, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, raio, giro: 0 });
      this.onda(c.x, pe, raio, '#ff3a4a', 0.5, 3); this.poeira(c.x, pe, 10, 1.1);
    }
    if (t2 === 'B') {             // Passo das Sombras: some numa fumaça escura
      this.sombraAte = this.tempo + (ev.duracao || 1.5);
      this.fumacaSombria(c.x, c.y, 22); this.texto(d, t('sombras'), '#ffc0c8', 0.75);
      this.escuro = Math.max(this.escuro || 0, 0.25); this.corEscuro = '20,0,10';
    }
    if (t2 === 'M') {             // Execução Noxiana: um X enorme no alvo
      if (v) {
        const p = this.centro(v);
        this.efeitos.push({ tipo: 'cortesX', dur: 0.45, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: p.x, cy: p.y - 6, tam: 30, cor: '#ff3a4a' });
        this.estrela4(p.x, p.y - 4, ev.executou ? '#ffffff' : '#ff3a4a', ev.executou ? 44 : 30);
        if (ev.executou) { this.escuro = Math.max(this.escuro || 0, 0.35); this.corEscuro = '40,4,10'; this.flash = Math.max(this.flash || 0, 0.12); }
      }
    }
    if (t2 === 'N') {             // Tempestade de Lótus: um redemoinho de lâminas em volta dela
      this.efeitos.push({ tipo: 'katLotus', dur: ev.duracao || 3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, raio: this.arena ? 3.5 * T : 64, tempestade: true });
      this.aviso(t('Tempestade de Lótus!'), '#ff8aa0'); this.tremor = Math.max(this.tremor, 0.3);
      this.escuro = Math.max(this.escuro || 0, 0.4); this.corEscuro = '40,4,10';
    }
  }
  // ---------- Zac: a gelatina de Zaun ----------
  // as partes do corpo dele (braços, gosmas, pedaços, cópias) têm a cor do sprite (a skin muda junto); as ondas, a poça e a
  // membrana são os efeitos (verde-limão; a skin Molho Picante troca pelo mapa SKINS_EFEITO['zac@24'])
  corpoZac(dono) {
    const a = aparencia((dono || this.darius)?.nome || 'zac');
    return a.forma === 'zac' ? { c: a.corpo, l: a.brilho, d: a.sombra } : { c: '#5fcf3a', l: '#a6f06a', d: '#2c7a1e' };
  }
  // uma bolinha de gosma em (x, y): contorno escuro, o corpo, a sombra embaixo e o brilho em cima; ach < 1 achata
  gotaZac(g, x, y, r, cc, ach = 1) {
    if (r <= 0.3) return;
    g.fillStyle = 'rgba(6,16,4,0.6)'; g.beginPath(); g.ellipse(x, y + 0.4, r + 1, (r + 1) * ach, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = cc.d; g.beginPath(); g.ellipse(x, y, r, r * ach, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = cc.c; g.beginPath(); g.ellipse(x - r * 0.18, y - r * 0.18 * ach, r * 0.78, r * 0.78 * ach, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = cc.l; g.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.55 * ach), Math.max(1, Math.round(r * 0.45)), 1);
  }
  // a mão de cá do Zac (de onde sai o braço esticado)
  maoZac(d, outra = false) {
    const p = this.pos(d), dir = d.dir, o = outra ? -1 : 1;
    if (dir === DIR.L) return { x: p.px + (outra ? 12 : 27), y: p.py + (outra ? 22 : 15) };
    if (dir === DIR.O) return { x: p.px + (outra ? 20 : 5), y: p.py + (outra ? 22 : 15) };
    return { x: p.px + 16 + o * 9, y: p.py + (dir === DIR.N ? 15 : 18) };
  }
  // ---------- gosmas no chão (passiva Divisão Celular) ----------
  // Rift: combate.darius.gosmas, sem posição (cada uma perto do monstro de onde saltou); Runeterra: A.gosmas em tiles (ou só os
  // eventos "gosma" com posição). Cada uma salta em arco, cai, treme no chão, e é sugada para o Zac (pega) ou derrete (sumiu).
  gosmasDoMotor(combate) {
    if (!this.gelatina) { if (this.gosmasZ?.size) this.gosmasZ.clear(); return; }
    this.gosmasZ ??= new Map();
    const A = this.arena ? combate.arena : null, lista = A ? A.gosmas : combate.darius.gosmas;
    if (Array.isArray(lista)) {
      const vistas = new Set();
      for (const gz of lista) { vistas.add(gz.id); if (!this.gosmasZ.has(gz.id)) this.novaGosma(gz, A); }
      for (const k of this.gosmasZ.values()) if (!k.fim && !vistas.has(k.id) && this.tempo - k.t0 > 0.1) k.fim = this.tempo;
    } else for (const k of this.gosmasZ.values()) if (!k.fim && this.tempo > k.cai + 6.5) k.fim = this.tempo;      // sem estado: somem sozinhas
    for (const [id, k] of this.gosmasZ) if (k.fim && this.tempo - k.fim > 0.45) this.gosmasZ.delete(id);
  }
  novaGosma(gz, A) {
    const c = this.centro(this.darius);
    let x, y, ox, oy, resta;
    if (gz.x != null) {          // Runeterra: o ponto do chão em tiles; salta de perto do alvo (entre ele e o Zac)
      x = gz.x * T; y = gz.y * T - 2; ox = x + (c.x - x) * 0.35; oy = y - 14 + (c.y + 12 - y) * 0.35;
      resta = gz.cai != null && A ? gz.cai - A.tempo : gz.t ?? 0.6;
    } else {                     // Rift: perto do monstro atingido (ou em volta do Zac)
      const alvo = gz.alvo != null && this.criaturas.get(gz.alvo), b = alvo ? this.centro(alvo) : c, ang = Math.random() * Math.PI * 2, r = alvo ? 10 + Math.random() * 10 : 16 + Math.random() * 12;
      x = b.x + Math.cos(ang) * r; y = b.y + 12 + Math.sin(ang) * r * 0.45; ox = b.x; oy = b.y - 4; resta = gz.t ?? 0.6;
    }
    this.gosmasZ.set(gz.id, { id: gz.id, x, y, ox, oy, t0: this.tempo, cai: this.tempo + Math.max(0.15, resta), alto: 16 + Math.random() * 12, fase: Math.random() * 6, r: 2.8 + Math.random() * 0.9 });
  }
  // a camada do chão do Zac (antes das criaturas): as poças de ácido, as gosmas dele e as dos outros jogadores
  desenharChaoZac(g) {
    if (this.pocasZ?.length) {
      this.pocasZ = this.pocasZ.filter((p) => this.tempo - p.t0 < p.dur);
      for (const p of this.pocasZ) { const meu = this.mapaSkin; this.mapaSkin = p.mapa; this.fx.mapa = p.mapa; try { this.desenharPocaZac(this.tingidoDe(p.mapa), p); } finally { this.mapaSkin = meu; this.fx.mapa = null; } }
    }
    if (this.gosmasZ?.size) {
      const cc = this.corpoZac(this.darius), agora = this.tempo;
      for (const k of this.gosmasZ.values()) {
        if (k.fim) {
          const q = Math.min(1, (agora - k.fim) / 0.35);
          if (k.pega) {              // sugada para o corpo: estica na direção dele
            const c = this.centro(this.darius), x = k.x + (c.x - k.x) * q * q, y = k.y + (c.y + 2 - k.y) * q * q - Math.sin(q * Math.PI) * 8;
            g.strokeStyle = cc.c; g.lineWidth = 2 * (1 - q) + 0.5; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(k.x + (x - k.x) * 0.4, k.y + (y - k.y) * 0.4); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1;
            this.gotaZac(g, x, y, k.r * (1 - q * 0.5), cc);
          } else this.gotaZac(g, k.x, k.y + q * 1.5, k.r * (1 + q * 0.5), cc, 0.6 * (1 - q) + 0.05);      // derretendo
          continue;
        }
        if (agora < k.cai) {         // saltando em arco até o chão; a sombra cresce
          const q = (agora - k.t0) / Math.max(0.01, k.cai - k.t0), x = k.ox + (k.x - k.ox) * q, yc = k.oy + (k.y - k.oy) * q - Math.sin(q * Math.PI) * k.alto;
          g.fillStyle = `rgba(10,20,8,${0.15 + 0.3 * q})`; g.beginPath(); g.ellipse(k.x, k.y + 1.5, 2 + 3 * q, 1 + q, 0, 0, Math.PI * 2); g.fill();
          this.gotaZac(g, x, yc, k.r * 0.9, cc, 1.15);
          continue;
        }
        if (!k.caiu) { k.caiu = true; this.fx.explosao(k.x, k.y, { qtd: 6, vel: 40, cor: [cc.c, cc.l], forma: 'circ', vida: 0.35, grav: 160, tam: 1.4, atrito: 2, chao: k.y + 2 }); }
        this.gosmaNoChao(g, k, cc, agora);
      }
    }
    if (this.arena && this.jogArena?.size) for (const o of this.jogArena.values()) {
      if (!o.gosmas?.length || o.morto) continue;
      const cc = this.corpoZac(o);
      o.gosmas.forEach((q, i) => { const x = Array.isArray(q) ? q[0] : q.x, y = Array.isArray(q) ? q[1] : q.y; if (x != null) this.gosmaNoChao(g, { x: x * T, y: y * T - 2, r: 3.1, fase: i * 1.9, t0: 0 }, cc, this.tempo); });
    }
  }
  // a gosma parada no chão: tremendo, com um anel de brilho pulsando em volta (dá para achar de longe)
  gosmaNoChao(g, k, cc, agora) {
    const pul = 0.5 + 0.5 * Math.sin(agora * 5 + k.fase), trem = Math.sin(agora * 11 + k.fase * 3);
    g.save(); g.globalAlpha *= 0.4; g.fillStyle = '#000'; g.beginPath(); g.ellipse(k.x, k.y + 1.5, 6.5, 2.6, 0, 0, Math.PI * 2); g.fill(); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.25 + 0.3 * pul;
    g.drawImage(halo(cc.l), k.x - 9, k.y - 8, 18, 13);
    g.globalAlpha = 0.45 + 0.35 * pul; g.strokeStyle = cc.l; g.lineWidth = 1; g.beginPath(); g.ellipse(k.x, k.y + 1, 6 + pul * 1.5, 2.6 + pul * 0.5, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    this.gotaZac(g, k.x, k.y - 1.5, k.r * (1 + 0.07 * trem), cc, 0.72 - 0.06 * trem);
    if (Math.random() < 0.015) this.fx.add({ x: k.x - 1, y: k.y - 4, vx: 0, vy: -10, cor: cc.l, brilho: true, forma: 'circ', vida: 0.4, tam: 1.2, encolhe: true });
  }
  // a poça de ácido de Zaun: cresce, borbulha (bolhas que inflam e estouram), solta fumaça e seca no fim
  desenharPocaZac(g, p) {
    const t0 = this.tempo - p.t0, cresce = Math.min(1, t0 / 0.3), seca = Math.min(1, (p.dur - t0) / 0.6), R = p.raio * (0.4 + 0.6 * cresce) * (0.85 + 0.15 * seca);
    g.save(); g.globalAlpha *= 0.85 * seca;
    g.fillStyle = 'rgba(40,70,8,0.55)'; g.beginPath(); g.ellipse(p.x, p.y, R + 2, (R + 2) * 0.45, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    gr.addColorStop(0, 'rgba(216,255,90,0.6)'); gr.addColorStop(0.6, 'rgba(160,230,40,0.45)'); gr.addColorStop(1, 'rgba(90,160,20,0.4)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(p.x, p.y, R, R * 0.45, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d8ff5a'; g.lineWidth = 1.2; g.globalAlpha *= 0.6 + 0.3 * Math.sin(this.tempo * 6); g.beginPath(); g.ellipse(p.x, p.y, R, R * 0.45, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.save(); g.globalAlpha *= seca;
    for (const b of p.bolhas) {          // cada bolha infla e estoura, num ciclo próprio
      const f = (this.tempo * b.vel + b.fase) % 1, bx = p.x + b.dx * R, by = p.y + b.dy * R * 0.45;
      if (f < 0.8) { const r = 0.6 + 2.4 * (f / 0.8); g.fillStyle = '#c8f03a'; g.beginPath(); g.arc(bx, by - r * 0.5, r, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0ffc0'; g.fillRect(Math.round(bx - r * 0.5), Math.round(by - r), 1, 1); }
      else { const q = (f - 0.8) / 0.2; g.strokeStyle = `rgba(232,255,150,${1 - q})`; g.lineWidth = 1; g.beginPath(); g.ellipse(bx, by - 1, 2 + q * 3, (2 + q * 3) * 0.5, 0, 0, Math.PI * 2); g.stroke(); }
    }
    g.restore();
    if (seca > 0.3 && Math.random() < 0.35) { const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.8; this.fx.add({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.45, vx: (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 14, cor: Math.random() < 0.5 ? '#c8f03a' : '#8ad020', vida: 0.9, tam: 2.4, encolhe: true }); }
  }
  pocaZac(x, y, raio, dur) {
    this.pocasZ ??= [];
    if (this.pocasZ.some((p) => this.tempo - p.t0 < 0.3 && Math.hypot(p.x - x, p.y - y) < 20)) return;      // o mesmo lance chegou duas vezes
    this.pocasZ.push({ x, y, raio, dur, t0: this.tempo, mapa: this.mapaSkin, bolhas: Array.from({ length: 8 }, () => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.8; return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, fase: Math.random(), vel: 0.8 + Math.random() * 0.9 }; }) });
    this.fx.explosao(x, y - 2, { qtd: 14, vel: 70, cor: ['#c8f03a', '#8ad020', '#f0ffc0'], forma: 'circ', vida: 0.5, grav: 200, tam: 1.8, atrito: 1.5, chao: y + 3 });
  }
  // respingos de gosma (o corpo dele espirrando)
  respingoZac(x, y, qtd = 10, forca = 1, cc = this.corpoZac(this.darius)) {
    this.fx.explosao(x, y, { qtd, vel: 80 * forca, cor: [cc.c, cc.l, cc.d], forma: 'circ', vida: 0.55, grav: 220, tam: 1.9, atrito: 1.2, chao: y + 10 });
  }
  // o impacto de uma queda (E, quiques do R): a onda de gosma, respingos, poeira e o tremor
  quedaZac(x, y, raio, forte = 1) {
    this.onda(x, y, raio, '#7ae83a', 0.5, 3 + forte); this.onda(x, y, raio * 0.6, '#c8ff8a', 0.4, 2);
    this.respingoZac(x, y - 4, Math.round(10 + 8 * forte), 0.9 + 0.3 * forte);
    this.poeira(x, y, 8, 0.8 + 0.4 * forte); this.acender(x, y - 6, raio, '#7ae83a', 0.35);
    this.efeitos.push({ tipo: 'zacMarca', dur: 0.9, t: 0, alvo: null, fixo: { px: 0, py: 0 }, x, y, raio: raio * 0.55 });
    this.tremor = Math.max(this.tremor || 0, 0.12 + 0.12 * forte);
  }
  // o voo do Estilingue (Rift): estica para trás, voa em arco até o grupo, cai e volta como um elástico
  vooZac(c) {
    const v = c.zacVoo, t0 = this.tempo - v.t0;
    if (t0 < 0) return { x: -v.dx * 0.06, y: -v.dy * 0.06 };
    if (t0 < v.dur) { const k = t0 / v.dur; return { x: v.dx * k, y: v.dy * k - Math.sin(k * Math.PI) * v.alto }; }
    const q = (t0 - v.dur) / (v.volta || 0.01);
    if (q < 1) return { x: v.dx * (1 - q) * (1 - q), y: v.dy * (1 - q) * (1 - q) };
    c.zacVoo = null; return { x: 0, y: 0 };
  }
  danoZac(ev, v, d) {
    const f = ev.fonte;
    const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : f === 'ataque' ? '#e8ffd8' : f === 'item' ? '#e8c840' : f === 'F' ? '#d8ff5a' : f === 'M' ? '#c8ff9a' : '#a6f06a';
    this.texto(v, fmt(ev.valor), cor, ev.verdadeiro || f === 'N' || f === 'E' ? 1.3 : f === 'F' || f === 'M' ? 0.8 : 1, f === 'ataque' ? 0.08 : 0);
    v.hit = 0.14;
    const p = this.centro(v);
    if (f === 'ataque') { d.atk = 0.22; this.olhar(d, v); this.efeito('impacto', v, 0.25); this.respingoZac(p.x, p.y, 5, 0.6); }
    else if (f === 'F') { if (Math.random() < 0.4) this.fx.add({ x: p.x + (Math.random() - 0.5) * 10, y: p.y + 8, vx: 0, vy: -20, cor: '#c8f03a', brilho: true, forma: 'circ', vida: 0.4, tam: 1.5, encolhe: true }); }
    else if (f === 'item' || f === 'pet') this.faiscas(p.x, p.y, ['#e8c840', '#ffffff'], 5, 60);
    else if (f === 'R' || f === 'M') this.respingoZac(p.x, p.y, 4, 0.6);
    else { this.respingoZac(p.x, p.y, 7, 0.8); this.brilhos(p.x, p.y, ['#a6f06a', '#ffffff'], 5, 50); }
  }
  // os acertos e a pose de cada habilidade (o seu Zac e o de outro jogador; em Runeterra os campos vêm em tiles)
  habilidadeZac(ev, d) {
    const v = ev.alvo != null && this.criaturas.get(ev.alvo);
    const t2 = ev.tecla, c = this.centro(d), pe = c.y + 10, cc = this.corpoZac(d);
    const alvosEv = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
    const emTiles = this.arena && ev.x != null, px = emTiles ? ev.x * T : c.x, py = emTiles ? ev.y * T : pe;
    if (v) this.olhar(d, v);
    if (t2 === 'Q' || t2 === 'A') {          // Esticada / Gancho Viscoso: o braço estica, agarra e volta
      if (this.arena) { if (ev.ate) this.bracoZac(d, ev.ate, { puxa: t2 === 'A' }); return; }      // em Runeterra o braço vem no zacBraco
      const alvos = t2 === 'A' ? [v].filter(Boolean) : (alvosEv.length ? alvosEv : [v].filter(Boolean)).slice(0, 2);
      alvos.forEach((a2, k) => this.bracoZac(d, a2, { outra: k === 1, atraso: k * 0.08, puxa: t2 === 'A' }));
      if (t2 === 'Q') this.depois(0.3, () => {          // bate um no outro (ou, sozinho, no chão)
        const vivos = alvos.filter((a2) => this.criaturas.has(a2.id)); if (!vivos.length) return;
        const p1 = this.centro(vivos[0]), p2 = vivos[1] ? this.centro(vivos[1]) : p1, mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        this.estrela4(mx, my, '#c8ff8a', vivos.length > 1 ? 30 : 36); this.respingoZac(mx, my, 12, 1.1, cc);
        if (vivos.length === 1) { this.onda(mx, my + 10, 26, '#7ae83a', 0.4, 3); this.poeira(mx, my + 10, 8, 0.8); this.tremor = Math.max(this.tremor, 0.15); }
      });
      else this.depois(0.18, () => { if (v && this.criaturas.has(v.id)) { const p = this.centro(v); this.estrela4(p.x, p.y, '#c8ff8a', 26); this.respingoZac(p.x, p.y, 8, 0.9, cc); } });
    }
    if (t2 === 'W') {             // Matéria Instável: o corpo estoura para fora
      this.efeitos.push({ tipo: 'zacEstouro', dur: 0.45, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, raio: this.arena ? (ev.raio || 2.4) * T : 40, giro: Math.random() * 6 });
      this.onda(c.x, pe, this.arena ? (ev.raio || 2.4) * T : 40, '#7ae83a', 0.45, 3); this.respingoZac(c.x, c.y, 18, 1.2, cc); this.acender(c.x, c.y, 44, '#7ae83a', 0.35);
      alvosEv.forEach((a2) => this.depois(0.08, () => { if (this.criaturas.has(a2.id)) { const p = this.centro(a2); this.respingoZac(p.x, p.y, 5, 0.7, cc); } }));
    }
    if (t2 === 'E') {             // Estilingue Elástico: carrega (estica para trás), voa em arco e cai no grupo
      d.pose = { seq: [52, 52, 52, 53, 53, 53, 53, 54], dur: 0.9, ate: this.tempo + 0.9 };
      this.balao(d, t('Estilingue Elástico'), '#a6f06a');
      if (this.arena) {           // Runeterra: o motor move o Zac; aqui o arco, o rastro e (se o zacQueda não vier) a queda
        const dur = ev.dur || 0.6, x0 = ev.x0 != null ? ev.x0 * T : c.x, y0 = ev.y0 != null ? ev.y0 * T : pe;
        d.pulo = dur; d.puloDur = dur; d.puloAlto = 34 + 14 * (ev.carga || 0);
        this.efeitos.push({ tipo: 'zacRastro', dur: dur + 0.3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: x0, oy: y0, ex: px, ey: py, alto: d.puloAlto, voo: dur });
        if (ev.x != null) { const t0 = this.tempo; this.depois(dur, () => { if (!((this.zacQuedaT || -9) > t0)) this.quedaZac(px, py, (ev.raio || 2.2) * T, 1.3); }); }
        return;
      }
      const alvo = v || alvosEv[0];
      const ac = alvo ? this.centro(alvo) : { x: c.x + (d.dir === DIR.O ? -50 : 50), y: c.y };
      const dx = (ac.x - c.x) * 0.85, dy = (ac.y - c.y) * 0.85;
      d.zacVoo = { t0: this.tempo + 0.3, dur: 0.42, dx, dy, alto: 34 + Math.min(20, Math.hypot(dx, dy) * 0.15), volta: 0.22 };
      this.efeitos.push({ tipo: 'zacCarga', dur: 0.3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, dx, dy });
      this.efeitos.push({ tipo: 'zacRastro', dur: 0.95, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: c.x, oy: pe, ex: c.x + dx, ey: pe + dy, alto: d.zacVoo.alto, voo: 0.42, atraso: 0.3 });
      this.depois(0.72, () => { const q = { x: c.x + dx, y: pe + dy }; this.quedaZac(q.x, q.y, 52, 1.4); this.flash = Math.max(this.flash || 0, 0.12); this.corFlash = this.mapaSkin?.flash || '120,255,90'; this.pedras(q.x, q.y, 6, 0.8); });
    }
    if (t2 === 'R') {             // Vamos pular!: agacha e começa a quicar (cada queda vem no evento "quique")
      d.pose = { seq: [52], dur: 0.15, ate: this.tempo + 0.15 };
      this.balao(d, t('Vamos pular!'), '#a6f06a');
      this.onda(c.x, pe, 30, '#7ae83a', 0.4, 2);
      d.zacQuiqueAte = this.tempo + (ev.duracao || 2.5);
    }
    if (t2 === 'G') {             // Membrana Reforçada: a gosma endurece em volta
      for (const e of this.efeitos) if (e.tipo === 'zacMembrana' && e.dono === d) e.t = Math.max(e.t, e.dur - 0.3);
      this.efeitos.push({ tipo: 'zacMembrana', dur: ev.duracao || 6, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d });
      if (ev.escudo) this.texto(d, '+' + fmt(ev.escudo), '#c8ff8a', 0.85);
      this.onda(c.x, pe, 30, '#c8ff8a', 0.45, 2); this.brilhos(c.x, c.y, ['#c8ff8a', '#ffffff'], 12, 60, { forma: 'circ' });
    }
    if (t2 === 'F') {             // Poça Ácida: embaixo do grupo (Rift) ou no ponto mirado (Runeterra)
      let x = px, y = py;
      if (!emTiles) {
        if (alvosEv.length) { x = alvosEv.reduce((s, a2) => s + this.centro(a2).x, 0) / alvosEv.length; y = alvosEv.reduce((s, a2) => s + this.centro(a2).y, 0) / alvosEv.length + 12; }
        else { x = c.x + (d.dir === DIR.O ? -24 : d.dir === DIR.L ? 24 : 0); y = pe + (d.dir === DIR.S ? 16 : d.dir === DIR.N ? -16 : 2); }
      }
      if (emTiles || !this.arena) this.pocaZac(x, y, this.arena ? (ev.raio || 2.4) * T : 42, ev.duracao || ev.dur || 4);
      this.respingoZac(c.x, c.y, 8, 0.8, cc);
    }
    if (t2 === 'T') {             // Ondulação: as mãos no chão e a onda de gosma correndo em volta
      const raio = this.arena ? (ev.raio || 2.8) * T : 50;
      this.depois(0.12, () => {
        this.efeitos.push({ tipo: 'zacOnda', dur: 0.6, t: 0, alvo: null, fixo: { px: 0, py: 0 }, x: emTiles ? px : this.centro(d).x, y: emTiles ? py : this.centro(d).y + 10, raio });
        this.onda(emTiles ? px : c.x, emTiles ? py : pe, raio, '#7ae83a', 0.55, 3); this.poeira(c.x, pe, 10, 1.1); this.tremor = Math.max(this.tremor, 0.2);
      });
    }
    if (t2 === 'B') {             // Regeneração Química: bolhas e o brilho químico subindo
      for (const e of this.efeitos) if (e.tipo === 'zacRegen' && e.dono === d) e.t = Math.max(e.t, e.dur - 0.3);
      this.efeitos.push({ tipo: 'zacRegen', dur: ev.duracao || 5, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d });
      this.feixeCeu(c.x, pe, '#a6f06a');
    }
    if (t2 === 'M') {             // Mitose: duas cópias se soltam dos lados
      const pts = Array.isArray(ev.clones) ? ev.clones : null;
      if (this.arena && !pts) return;            // em Runeterra as cópias vêm no evento "mitose", com as posições
      this.mitoseZac(d, pts, ev.duracao || ev.dur || 6);
    }
    if (t2 === 'N') {             // Explosão Celular: estoura em pedaços que voam e voltam
      const raio = this.arena ? (ev.raio || 4) * T : 80, x = emTiles ? px : c.x, y = emTiles ? py - 10 : c.y;
      d.zacOculto = this.tempo + 0.55;
      this.efeitos.push({ tipo: 'zacExplosao', dur: 0.75, t: 0, alvo: null, fixo: { px: 0, py: 0 }, x, y, raio: raio * 0.7, dono: d, pedacos: Array.from({ length: 10 }, (_, k) => ({ a: (k / 10) * Math.PI * 2 + Math.random() * 0.4, f: 0.6 + Math.random() * 0.4, r: 3 + Math.random() * 2.5 })) });
      this.aviso(t('Explosão Celular!'), '#a6f06a'); this.tremor = Math.max(this.tremor, 0.45); this.flash = Math.max(this.flash || 0, 0.18); this.corFlash = this.mapaSkin?.flash || '120,255,90';
      this.escuro = Math.max(this.escuro || 0, 0.35); this.corEscuro = this.mapaSkin ? '34,22,2' : '6,30,4';
      for (const [k, cor] of [[0, '#ffffff'], [1, '#7ae83a'], [2, '#c8ff8a']]) this.depois(k * 0.1, () => this.onda(x, y + 10, raio * (1 - k * 0.2), cor, 0.7, 5 - k));
      this.respingoZac(x, y, 34, 1.8, cc); this.acender(x, y, raio, '#7ae83a', 0.6, 1);
    }
  }
  // o braço esticando até o alvo (criatura, ou um ponto {x, y} em tiles) e voltando
  bracoZac(d, alvo, { outra = false, atraso = 0, puxa = false, dur = 0.42 } = {}) {
    const ponto = alvo && alvo.de ? null : alvo ? { x: alvo.x * T, y: alvo.y * T - 12 } : null;
    this.efeitos.push({ tipo: 'zacBraco', dur: dur + atraso, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, alvoC: ponto ? null : alvo, ponto, outra, atraso, puxa });
  }
  mitoseZac(d, pts, dur) {
    for (const e of this.efeitos) if (e.tipo === 'zacClone' && e.dono === d) e.t = Math.max(e.t, e.dur - 0.01);
    const c = this.centro(d);
    for (const lado of [0, 1]) {
      const q = pts?.[lado], fix = q ? { x: q.x * T, y: q.y * T - 16 } : null;
      this.efeitos.push({ tipo: 'zacClone', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, lado, fix, golpe: null });
      const p = fix || { x: c.x + (lado ? 22 : -22), y: c.y + 4 };
      this.fx.explosao(c.x, c.y, { qtd: 6, vel: 30, cor: [this.corpoZac(d).c], forma: 'circ', vida: 0.3, tam: 2, ang: Math.atan2(p.y - c.y, p.x - c.x), abertura: 0.6 });
    }
    this.onda(c.x, c.y + 10, 34, '#7ae83a', 0.45, 2);
  }
  // Divisão Celular: o corpo explode em 4 pedaços que se arrastam de volta (o Zac some até se juntar)
  divisaoZac(d, espera = 2) {
    const c = this.centro(d), cc = this.corpoZac(d);
    d.zacOculto = this.tempo + espera + 0.05;
    for (const e of this.efeitos) if (e.tipo === 'zacDivisao' && e.dono === d) e.t = e.dur;
    this.efeitos.push({ tipo: 'zacDivisao', dur: espera, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, x: c.x, y: c.y + 10,
      pedacos: Array.from({ length: 4 }, (_, k) => ({ a: (k / 4) * Math.PI * 2 + 0.4 + Math.random() * 0.5, r: 18 + Math.random() * 10, tam: k === 0 ? 7 : 5 + Math.random() })) });
    this.respingoZac(c.x, c.y, 26, 1.4, cc); this.onda(c.x, c.y + 10, 40, '#7ae83a', 0.6, 3); this.tremor = Math.max(this.tremor, 0.35);
    this.texto(d, t('Divisão Celular!'), '#a6f06a', 1.1);
  }
  reuniuZac(d, vida) {
    const c = this.centro(d), cc = this.corpoZac(d);
    for (const e of this.efeitos) if (e.tipo === 'zacDivisao' && e.dono === d) e.t = e.dur;
    d.zacOculto = 0; d.pose = { seq: [54, 53, 45], dur: 0.4, ate: this.tempo + 0.4 };
    this.respingoZac(c.x, c.y, 14, 0.8, cc); this.onda(c.x, c.y + 10, 26, '#c8ff8a', 0.45, 2); this.brilhos(c.x, c.y, ['#c8ff8a', '#ffffff'], 12, 60);
    if (vida) this.texto(d, '+' + fmt(vida), '#40e060', 1);
  }
  // os eventos próprios do Zac (o seu; d = o campeão da cena)
  eventoZac(ev, d) {
    const c = this.centro(d);
    switch (ev.tipo) {
      case 'quique': {          // cada queda do Vamos pular!: a onda, os respingos e o próximo arco
        const x = this.arena && ev.x != null ? ev.x * T : c.x, y = this.arena && ev.y != null ? ev.y * T : c.y + 10;
        this.quedaZac(x, y, this.arena ? (ev.raio || 2.6) * T : 44, ev.k === 1 ? 1.2 : 0.8);
        if (ev.k === 1) this.flash = Math.max(this.flash || 0, 0.08);
        if ((ev.k || 1) < 4) { d.pulo = 0.5; d.puloDur = 0.5; d.puloAlto = 24; d.pose = { seq: [54, 53, 53, 53, 53, 54], dur: 0.6, ate: this.tempo + 0.6 }; }
        else d.pose = { seq: [54, 54, 45], dur: 0.4, ate: this.tempo + 0.4 };
        return true;
      }
      case 'quiqueFim': d.zacQuiqueAte = 0; if (!(d.pulo > 0)) d.pose = { seq: [54, 45], dur: 0.3, ate: this.tempo + 0.3 }; return true;
      case 'pocaFim': for (const p of this.pocasZ || []) p.dur = Math.min(p.dur, this.tempo - p.t0 + 0.6); return true;
      case 'pocaAcida': if (ev.x != null) this.pocaZac(ev.x * T, ev.y * T, (ev.raio || 2.4) * T, ev.dur || 4); return true;
      case 'zacBraco': {
        const alvo = (ev.alvo != null && (this.criaturas.get(ev.alvo) || this.monsOutros?.get(ev.alvo) || this.jogArena?.get(String(ev.alvo).replace(/^j:/, '')))) || ev.ate;
        if (alvo) this.bracoZac(d, alvo, { puxa: !!ev.puxa });
        return true;
      }
      case 'zacQueda': this.zacQuedaT = this.tempo; this.quedaZac(ev.x * T, ev.y * T, (ev.raio || 2.2) * T, 1.3); this.flash = Math.max(this.flash || 0, 0.1); this.corFlash = this.mapaSkin?.flash || '120,255,90'; return true;
      case 'mitose': if (!this.efeitos.some((e) => e.tipo === 'zacClone' && e.dono === d && e.t < 0.2)) this.mitoseZac(d, ev.clones, ev.dur || 6); return true;
      case 'cloneGolpe': {
        const v = this.criaturas.get(ev.alvo) || this.monsOutros?.get(ev.alvo);
        const e = this.efeitos.find((e2) => e2.tipo === 'zacClone' && e2.dono === d && e2.lado === (ev.clone || 0) && e2.t < e2.dur);
        if (e && v) { e.golpe = { t0: this.tempo, alvo: v }; this.depois(0.12, () => { if (this.criaturas.has(v.id) || this.monsOutros?.has(v.id)) { const p = this.centro(v); this.estrela4(p.x, p.y, '#c8ff8a', 18); this.respingoZac(p.x, p.y, 5, 0.6); } }); }
        return true;
      }
      case 'mitoseFim': for (const e of this.efeitos) if (e.tipo === 'zacClone' && e.dono === d) { e.fim = this.tempo; e.dur = Math.min(e.dur, e.t + 0.4); } return true;
      case 'gosma':                 // Runeterra sem A.gosmas: a posição vem no evento
        if (this.arena) for (const gz of ev.gosmas || []) if (gz && gz.x != null && !this.gosmasZ?.has(gz.id)) { this.gosmasZ ??= new Map(); this.novaGosma(gz, null); }
        return true;
      case 'gosmaPega': {
        const k = this.gosmasZ?.get(ev.gosma);
        if (k) { k.pega = true; k.fim = k.fim || this.tempo; }
        this.depois(0.3, () => { const c2 = this.centro(d); this.respingoZac(c2.x, c2.y, 4, 0.4); this.onda(c2.x, c2.y + 10, 14, '#c8ff8a', 0.3, 1.5); });
        return true;
      }
      case 'gosmaSome': { const k = this.gosmasZ?.get(ev.gosma); if (k && !k.fim) k.fim = this.tempo; return true; }
      case 'divisao': this.divisaoZac(d, ev.espera || 2); return true;
      case 'reuniu': this.reuniuZac(d, ev.vida); return true;
    }
    return false;
  }
  // o Zac de outro jogador (só o visual; quem acerta é o servidor): o mesmo desenho, montado a partir do lance
  lanceZac(o, m, dir) {
    const n = Math.hypot(dir.x, dir.y) || 1, ux = dir.x / n || 1, uy = dir.y / n;
    const alvoPt = (L) => ({ x: (m.px ?? m.x + ux * L), y: (m.py ?? m.y + uy * L) });
    const ev = { tipo: 'habilidade', tecla: m.tecla, dx: ux, dy: uy, alvos: [], outro: true, x: m.x, y: m.y };
    if (m.tecla === 'Q' || m.tecla === 'A') {
      const p = alvoPt(m.tecla === 'A' ? 7 : 6), perto = [this.darius, ...this.jogArena.values()].filter((c2) => c2 && c2 !== o && !c2.morto)
        .map((c2) => ({ c2, d: Math.hypot(c2.x + 0.5 - p.x, c2.y + 0.875 - p.y) })).filter((q) => q.d < 1.6).sort((a2, b) => a2.d - b.d)[0];
      this.bracoZac(o, perto ? perto.c2 : p, { puxa: m.tecla === 'A' });
      return;
    }
    if (m.tecla === 'E') { const p = alvoPt(6); this.habilidadeZac({ ...ev, x0: m.x, y0: m.y, x: p.x, y: p.y, dur: 0.6 }, o); return; }
    if (m.tecla === 'F') { const p = alvoPt(4); this.pocaZac(p.x * T, p.y * T, 2.4 * T, 4); return; }
    if (m.tecla === 'R') {
      this.habilidadeZac(ev, o);
      for (let k = 1; k <= 4; k++) this.depois(0.15 + (k - 1) * 0.625, () => { const c2 = this.centro(o); this.eventoZac({ tipo: 'quique', k, x: (c2.x) / T, y: (c2.y + 10) / T, raio: 2.6 }, o); });
      return;
    }
    if (m.tecla === 'M') { this.mitoseZac(o, Array.isArray(m.clones) ? m.clones : [{ x: m.x - 1.2, y: m.y + 0.3 }, { x: m.x + 1.2, y: m.y + 0.3 }], 6); return; }
    this.habilidadeZac(ev, o);
  }
  // o Zac de outro jogador se dividiu / juntou (o servidor manda { t: 'divisao' } e { t: 'reuniu' }; o jogo.js chama)
  divisaoOutro(nome, espera = 2) { const o = this.jogArena?.get(nome); if (o) this.comoOutro(o, () => this.divisaoZac(o, espera)); }
  reuniuOutro(nome) { const o = this.jogArena?.get(nome); if (o) this.comoOutro(o, () => this.reuniuZac(o)); }
  efeitoZac(g, e, k) {
    const dono = e.dono || this.darius, cc = this.corpoZac(dono), c = this.centro(dono);
    if (e.tipo === 'zacBraco') {          // o braço elástico: sai fino e ondulando, agarra e volta
      const kk = Math.max(0, (e.t - e.atraso) / Math.max(0.01, e.dur - e.atraso));
      if (e.t < e.atraso) return;
      let alvoP = e.ponto;
      if (e.alvoC) { if (this.criaturas.has(e.alvoC.id) || e.alvoC.arenaJog || this.monsOutros?.has(e.alvoC.id) || e.alvoC === this.darius) { const p = this.centro(e.alvoC); e.ultimo = { x: p.x, y: p.y - 2 }; } alvoP = e.ultimo; }
      if (!alvoP) return;
      const ext = kk < 0.38 ? kk / 0.38 : kk < 0.6 ? 1 : 1 - (kk - 0.6) / 0.4, ini = dono === this.darius || dono.arenaJog ? this.maoZac(dono, e.outra) : { x: c.x, y: c.y };
      const ex = ini.x + (alvoP.x - ini.x) * ext, ey = ini.y + (alvoP.y - ini.y) * ext, L = Math.hypot(ex - ini.x, ey - ini.y);
      if (L < 1) return;
      const nx = -(ey - ini.y) / L, ny = (ex - ini.x) / L, pts = [];
      for (let i = 0; i <= 12; i++) { const f = i / 12, onda = Math.sin(f * Math.PI * 3 - this.tempo * 25) * 1.6 * Math.sin(f * Math.PI) * (kk < 0.38 ? 1 : 0.5); pts.push([ini.x + (ex - ini.x) * f + nx * onda, ini.y + (ey - ini.y) * f + ny * onda]); }
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [w, cor] of [[5, 'rgba(6,16,4,0.7)'], [3.4, cc.d], [2.2, cc.c], [0.8, cc.l]]) {
        g.strokeStyle = cor; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      g.restore();
      this.gotaZac(g, ex, ey, ext > 0.95 ? 4 : 3.2, cc, 0.9);              // a mão grudenta
      if (ext > 0.95 && kk < 0.6 && Math.random() < 0.4) this.fx.add({ x: ex, y: ey + 2, vx: (Math.random() - 0.5) * 10, vy: 10, grav: 120, cor: cc.c, forma: 'circ', vida: 0.4, tam: 1.3 });
    } else if (e.tipo === 'zacEstouro') {   // espinhos de gosma saindo do corpo em todas as direções
      const al = 1 - k, R = e.raio * (0.3 + 0.7 * Math.sqrt(k));
      g.save(); g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = e.giro + (i * Math.PI * 2) / 12, l = R * (i % 2 ? 0.75 : 1), x1 = c.x + Math.cos(a) * l, y1 = c.y + 4 + Math.sin(a) * l * 0.55;
        g.globalAlpha = al; g.strokeStyle = '#3a9a1a'; g.lineWidth = 4 * al + 1; g.beginPath(); g.moveTo(c.x + Math.cos(a) * 6, c.y + 4 + Math.sin(a) * 3.3); g.lineTo(x1, y1); g.stroke();
        g.strokeStyle = '#7ae83a'; g.lineWidth = 2.4 * al + 0.6; g.beginPath(); g.moveTo(c.x + Math.cos(a) * 6, c.y + 4 + Math.sin(a) * 3.3); g.lineTo(x1, y1); g.stroke();
        g.fillStyle = '#c8ff8a'; g.beginPath(); g.arc(x1, y1, 2.2 * al + 0.6, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * al; g.drawImage(halo(this.corSkin('#7ae83a')), c.x - R, c.y + 4 - R * 0.7, R * 2, R * 1.4);
      g.restore();
    } else if (e.tipo === 'zacOnda') {      // a Ondulação: um anel de calombos de gosma correndo para fora
      const r = e.raio * Math.sqrt(k), al = 1 - k * k;
      g.save();
      for (let i = 0; i < 18; i++) {
        const a = (i * Math.PI * 2) / 18, x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r * 0.45, h = (3 + 3 * Math.sin(k * Math.PI)) * al;
        g.globalAlpha = al; g.fillStyle = '#3a9a1a'; g.beginPath(); g.ellipse(x, y - h * 0.5, 3.4, h * 0.7 + 1, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7ae83a'; g.beginPath(); g.ellipse(x - 0.4, y - h * 0.6, 2.4, h * 0.55 + 0.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c8ff8a'; g.fillRect(Math.round(x - 1), Math.round(y - h * 1.1), 1, 1);
      }
      g.restore();
    } else if (e.tipo === 'zacMembrana') {  // a membrana endurecida: uma casca de gosma ondulando em volta dele
      const al = Math.min(1, e.t / 0.2) * Math.min(1, (e.dur - e.t) / 0.4), pe = c.y + 10;
      g.save(); g.globalAlpha = 0.22 * al; g.fillStyle = '#7ae83a';
      const casca = (dr) => { g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, w = 1 + 0.06 * Math.sin(a * 4 + this.tempo * 5); const x = c.x + Math.cos(a) * 17 * w + dr, y = pe - 11 + Math.sin(a) * 19 * w; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
      casca(0); g.fill();
      g.globalAlpha = 0.8 * al; g.strokeStyle = '#c8ff8a'; g.lineWidth = 1.3; casca(0); g.stroke();
      g.globalAlpha = 0.5 * al; g.strokeStyle = '#3a9a1a'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(c.x, pe - 1, 15, 4.5, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = al; g.fillStyle = '#ffffff'; g.fillRect(Math.round(c.x - 9), Math.round(pe - 24), 2, 1); g.fillRect(Math.round(c.x - 11), Math.round(pe - 22), 1, 2);
      g.restore();
      if (Math.random() < 0.1) this.fx.add({ x: c.x + (Math.random() - 0.5) * 30, y: pe - 6 - Math.random() * 20, vx: 0, vy: -8, cor: '#c8ff8a', brilho: true, forma: 'circ', vida: 0.4, tam: 1.2, encolhe: true });
    } else if (e.tipo === 'zacRegen') {     // bolhas verdes subindo e o brilho químico
      const al = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.5), pe = c.y + 10;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (0.25 + 0.15 * Math.sin(this.tempo * 6)) * al;
      g.drawImage(halo(this.corSkin('#7ae83a')), c.x - 22, pe - 34, 44, 44); g.restore();
      for (let i = 0; i < 6; i++) {
        const f = (this.tempo * 0.9 + i / 6) % 1, x = c.x + Math.sin(i * 2.1 + this.tempo * 2) * 10, y = pe - f * 34, r = 1 + 1.6 * f;
        g.globalAlpha = al * (1 - f); g.strokeStyle = '#c8ff8a'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#7ae83a'; g.fillRect(Math.round(x - r * 0.5), Math.round(y - r * 0.5), 1, 1);
      }
      g.globalAlpha = 1;
      if (Math.random() < 0.08) this.fx.add({ x: c.x + (Math.random() - 0.5) * 18, y: pe - 10, vx: 0, vy: -26, cor: Math.random() < 0.5 ? '#40e060' : '#c8ff8a', brilho: true, forma: 'estrela', vida: 0.6, tam: 1.4, encolhe: true });
    } else if (e.tipo === 'zacClone') {     // uma cópia menor e translúcida, que dá um tapa quando bate
      const al = Math.min(1, e.t / 0.25) * (e.fim ? Math.max(0, 1 - (this.tempo - e.fim) / 0.4) : Math.min(1, (e.dur - e.t) / 0.4));
      let p = e.fix || { x: c.x + (e.lado ? 22 : -22), y: c.y + 4 };
      let dirC = e.fix ? dono.dir : e.lado ? DIR.L : DIR.O;
      if (e.golpe) {
        const q = (this.tempo - e.golpe.t0) / 0.25;
        if (q >= 1 || !e.golpe.alvo) e.golpe = null;
        else { const a2 = this.centro(e.golpe.alvo), f = Math.sin(q * Math.PI) * 0.6; p = { x: p.x + (a2.x - p.x) * f, y: p.y + (a2.y - p.y) * f }; dirC = a2.x >= p.x ? DIR.L : DIR.O; }
      }
      const quadro = e.golpe ? 31 : 40 + (Math.floor(this.tempo * 3 + e.lado * 2) % 4), s = sprite(dono.nome, dirC, quadro), esc = 0.72;
      const w = s.width * esc, h = s.height * esc, X = Math.round(p.x - w / 2), Y = Math.round(p.y + 13 - h + Math.sin(this.tempo * 6 + e.lado * 3) * 0.8);
      g.save(); g.globalAlpha = 0.3 * al; g.fillStyle = '#000'; g.beginPath(); g.ellipse(p.x, p.y + 13, 7, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.78 * al; g.drawImage(s, X, Y, w, h);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = (0.18 + 0.1 * Math.sin(this.tempo * 8 + e.lado)) * al; g.drawImage(tingido(s, this.corSkin('#7ae83a')), X, Y, w, h);
      g.restore();
    } else if (e.tipo === 'zacExplosao') {  // os pedaços voam para fora e voltam para o meio
      const ida = k < 0.45 ? k / 0.45 : k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      for (const pc of e.pedacos) {
        const r = e.raio * pc.f * Math.sin(ida * Math.PI / 2), x = e.x + Math.cos(pc.a) * r, y = e.y + Math.sin(pc.a) * r * 0.5 - Math.sin(ida * Math.PI) * 8;
        g.strokeStyle = cc.c; g.globalAlpha = 0.5; g.lineWidth = 1.2; g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1;
        this.gotaZac(g, x, y, pc.r * (0.8 + 0.2 * ida), cc);
      }
      if (k < 0.2) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - k / 0.2; g.drawImage(halo(this.corSkin('#7ae83a')), e.x - 40, e.y - 30, 80, 60); g.restore(); }
    } else if (e.tipo === 'zacDivisao') {   // os 4 pedaços: saltam para fora e se arrastam de volta, tremendo
      const sai = Math.min(1, e.t / 0.25), volta = Math.max(0, (e.t - 0.4) / Math.max(0.1, e.dur - 0.4));
      e.pedacos.forEach((pc, i) => {
        const r = pc.r * sai * (1 - volta * volta), x = e.x + Math.cos(pc.a) * r + Math.sin(this.tempo * 9 + i) * (volta > 0 ? 0.8 : 0), y = e.y + Math.sin(pc.a) * r * 0.5 - (sai < 1 ? Math.sin(sai * Math.PI) * 10 : 0);
        this.gotaZac(g, x, y - 2, pc.tam * (1 + 0.08 * Math.sin(this.tempo * 12 + i)), cc, 0.75);
        if (i === 0) { const ol = aparencia(dono.nome).olho || '#f2e94a'; g.fillStyle = ol; g.fillRect(Math.round(x - 2), Math.round(y - 4), 1, 1); g.fillRect(Math.round(x + 1), Math.round(y - 4), 1, 1); }
        if (volta > 0 && Math.random() < 0.05) this.fx.add({ x, y: y + 1, vx: 0, vy: 0, cor: cc.d, forma: 'circ', vida: 0.5, tam: 1.4, encolhe: true });
      });
    } else if (e.tipo === 'zacCarga') {     // o Estilingue carregando: os braços cravados esticam para trás como um elástico
      const p = this.pos(dono), n = Math.hypot(e.dx, e.dy) || 1, ux = e.dx / n, uy = e.dy / n, puxa = Math.min(1, k * 1.4);
      g.save(); g.lineCap = 'round';
      for (const lado of [-1, 1]) {
        const ax = p.px + 16 + ux * 8 - uy * lado * 6, ay = p.py + 28 + uy * 4 + ux * lado * 2, bx = p.px + 16 - ux * (6 + 6 * puxa), by = p.py + 20 - uy * 4 * puxa;
        for (const [w, cor] of [[3.4, 'rgba(6,16,4,0.7)'], [2, cc.c]]) { g.strokeStyle = cor; g.lineWidth = w * (1 - puxa * 0.4); g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2 - uy * lado * 4, (ay + by) / 2, bx, by); g.stroke(); }
        this.gotaZac(g, ax, ay, 2.4, cc, 0.6);
      }
      g.restore();
    } else if (e.tipo === 'zacRastro') {    // o rastro de gotas do voo do Estilingue
      const k0 = Math.max(0, (e.t - (e.atraso || 0)) / e.voo); if (e.t < (e.atraso || 0)) return;
      const al = Math.max(0, 1 - Math.max(0, e.t - (e.atraso || 0) - e.voo) / 0.3);
      for (let i = 0; i < 10; i++) {
        const f = Math.min(k0, 1) * (i / 9), x = e.ox + (e.ex - e.ox) * f, y = e.oy - 14 + (e.ey - e.oy) * f - Math.sin(f * Math.PI) * e.alto;
        g.globalAlpha = al * (0.25 + 0.55 * (i / 9)); this.gotaZac(g, x, y, 0.8 + 1.4 * (i / 9), cc);
      }
      g.globalAlpha = 1;
    } else if (e.tipo === 'zacMarca') {     // a marca molhada que fica no chão depois de uma queda
      const al = 1 - k;
      g.save(); g.globalAlpha = 0.55 * al; g.fillStyle = cc.d; g.beginPath(); g.ellipse(e.x, e.y, e.raio, e.raio * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.6 * al; g.fillStyle = cc.c; for (let i = 0; i < 6; i++) { const a = i * 1.05; g.beginPath(); g.ellipse(e.x + Math.cos(a) * e.raio * 1.1, e.y + Math.sin(a) * e.raio * 0.45, 2.2, 1.2, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }
  // ---------- Taric: luz das estrelas, joias e cristal ----------
  danoTaric(ev, v, d) {
    const f = ev.fonte;
    const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : f === 'ataque' ? '#ffe8c0' : f === 'item' ? '#e8c840' : f === 'P' ? '#9af4ff' : f === 'D' ? '#c8f8ff' : '#6af0ff';
    this.texto(v, fmt(ev.valor), cor, ev.verdadeiro || f === 'N' ? 1.3 : f === 'D' ? 0.8 : 1, f === 'ataque' ? 0.08 : 0);
    v.hit = 0.14;
    const p = this.centro(v);
    if (f === 'ataque') { d.atk = 0.22; this.olhar(d, v); this.efeito('impacto', v, 0.25); this.faiscas(p.x, p.y, ['#ffd860', '#ffffff'], 4, 60); }
    else if (f === 'P') { this.estrela4(p.x, p.y - 2, '#6af0ff', 22); this.brilhos(p.x, p.y, ['#6af0ff', '#ffffff'], 6, 50, { forma: 'estrela' }); }
    else if (f === 'D') this.brilhos(p.x, p.y, ['#c8f8ff', '#ffffff'], 4, 40);
    else if (f === 'item' || f === 'pet') this.faiscas(p.x, p.y, ['#e8c840', '#ffffff'], 5, 60);
    else this.faiscas(p.x, p.y, ['#6af0ff', '#ffffff', '#ffd860'], 6, 80);
  }
  // a estrela de 4 pontas com halo, desenhada direto no canvas
  estrelaTaric(g, x, y, r, cor, ang = 0, al = 1) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * 0.7; g.drawImage(halo(cor), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    g.globalAlpha = al; g.fillStyle = cor; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = ang + (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, Math.max(1, r * 0.22), 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // o cristal do Estilhaço Estelar (e o do martelo): um losango lapidado girando
  cristalTaric(g, x, y, ang, tam = 1, cor = '#6af0ff') {
    const c = Math.cos(ang), s = Math.sin(ang), P = (u, w) => [x + c * u * tam - s * w * tam, y + s * u * tam + c * w * tam];
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7; g.drawImage(halo(cor), x - 12 * tam, y - 12 * tam, 24 * tam, 24 * tam); g.restore();
    g.fillStyle = tom(cor, 0.55); g.beginPath(); for (const q of [P(-5, 0), P(0, -2.6), P(5, 0), P(0, 2.6)]) g.lineTo(q[0], q[1]); g.closePath(); g.fill();
    g.fillStyle = cor; g.beginPath(); for (const q of [P(-3.4, 0), P(0, -1.6), P(3.4, 0), P(0, 1.6)]) g.lineTo(q[0], q[1]); g.closePath(); g.fill();
    const a = P(-2, -0.6), b = P(2, -0.6); g.strokeStyle = '#ffffff'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  // o martelo celeste caindo do céu no ponto (x, y)
  marteloCelestial(x, y, atraso = 0) {
    this.depois(atraso, () => {
      this.efeitos.push({ tipo: 'taricMartelo', dur: 0.3, t: 0, alvo: null, fixo: { px: 0, py: 0 }, x, y });
      this.depois(0.3, () => {
        this.onda(x, y, this.arena ? 2.2 * T : 44, '#6af0ff', 0.55, 4); this.onda(x, y, this.arena ? 1.4 * T : 28, '#ffd860', 0.4, 3);
        this.estrela4(x, y - 6, '#ffffff', 44); this.poeira(x, y, 14, 1.3); this.acender(x, y - 6, 70, '#6af0ff', 0.45);
        this.brilhos(x, y - 6, ['#6af0ff', '#ffd860', '#ffffff'], 22, 140, { forma: 'faisca' });
        this.tremor = Math.max(this.tremor, 0.35); this.escuro = Math.max(this.escuro || 0, 0.2); this.corEscuro = '0,20,40';
      });
    });
  }
  // a cúpula de luz do Resplendor Cósmico (no Taric e em quem ele protegeu)
  cupulaTaric(dono, dur) {
    for (const e of this.efeitos) if (e.tipo === 'taricCupula' && e.dono === dono) e.t = e.dur;
    this.efeitos.push({ tipo: 'taricCupula', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono });
    const c = this.centro(dono); this.feixeCeu(c.x, c.y + 10, '#ffe27a');
  }
  // Resplendor recebido do Taric do grupo
  resplendorRecebido(dur) { this.cupulaTaric(this.darius, dur || 2.5); }
  habilidadeTaric(ev, d) {
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    const t2 = ev.tecla, c = this.centro(d), pe = c.y + 10, mao = this.mao();
    const alvosEv = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
    if (v) this.olhar(d, v);
    if (t2 === 'Q') {             // Fulgor Estelar: estrelinhas descem sobre ele e a luz cura
      this.pilaresLuz(c.x, pe, 26, '#6af0ff'); this.onda(c.x, pe, this.arena ? 1.6 * T : 34, '#6af0ff', 0.5, 3); this.acender(c.x, c.y, 50, '#6af0ff', 0.4);
      for (let k = 0; k < 7; k++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 26, y: c.y - 30 - Math.random() * 12, vx: (Math.random() - 0.5) * 6, vy: 40 + Math.random() * 30, cor: k % 2 ? '#6af0ff' : '#ffffff', brilho: true, forma: 'estrela', vida: 0.6, tam: 2, encolhe: true });
      this.brilhos(mao.x, mao.y - 8, ['#ffffff', '#6af0ff'], 8, 40, { forma: 'estrela' });
      alvosEv.forEach((a2, k) => this.depois(0.05 * k, () => { if (this.criaturas.has(a2.id)) { const p = this.centro(a2); this.estrela4(p.x, p.y, '#6af0ff', 18); } }));
    }
    if (t2 === 'W' || t2 === 'F') {   // Bastião e Égide: facetas de cristal girando em volta
      const egide = t2 === 'F';
      this.efeitos.push({ tipo: 'taricFacetas', dur: egide ? 1.2 : 0.9, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, egide });
      this.onda(c.x, pe, egide ? 46 : 30, egide ? '#ffd860' : '#6af0ff', 0.5, 3);
      if (ev.escudo) this.texto(d, '+' + fmt(ev.escudo), egide ? '#ffe27a' : '#c8f8ff', 0.85);
      if (egide) { this.aura(['#ffd860', '#fff0b0'], 4, 'escudo'); this.acender(c.x, c.y, 60, '#ffd860', 0.45); }
    }
    if (t2 === 'E') {             // Deslumbrar: o feixe se forma (explode no evento deslumbrar, 1 s depois)
      const dur = ev.espera || 1;
      if (this.arena && ev.dx != null) {
        const ox = (ev.x ?? d.x) * T, oy = (ev.y ?? d.y) * T - 14, comp = (ev.comp || 5.5) * T;
        this.efeitos.push({ tipo: 'taricFeixe', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, pts: [{ x: ox + ev.dx * comp, y: oy + ev.dy * comp }] });
      } else this.efeitos.push({ tipo: 'taricFeixe', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, alvos: alvosEv });
      this.brilhos(mao.x, mao.y, ['#ffffff', '#6af0ff'], 8, 40, { forma: 'estrela' });
    }
    if (t2 === 'R') {             // Resplendor Cósmico: a estrela se forma em cima dele por 2,5 s
      this.efeitos.push({ tipo: 'taricEstrela', dur: ev.espera || 2.5, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d });
      this.balao(d, t('Resplendor Cósmico!'), '#ffe27a');
      this.onda(c.x, pe, this.arena ? 6 * T : 70, '#ffe27a', 0.8, 2);
    }
    if (t2 === 'G') {             // Pele de Diamante: a pele vira cristal
      this.aura(['#9af4ff', '#ffffff'], ev.duracao || 8, 'escudo'); this.estrela4(c.x, c.y - 4, '#9af4ff', 34);
      this.brilhos(c.x, c.y, ['#9af4ff', '#ffffff'], 14, 70, { forma: 'faisca' });
    }
    if (t2 === 'A') {             // Estilhaço Estelar: no Rift o cristal voa até o alvo (em Runeterra é um projétil)
      if (!this.arena && v) { const p = this.centro(v); this.efeitos.push({ tipo: 'taricCristal', dur: 0.18, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: mao.x, oy: mao.y, ex: p.x, ey: p.y - 4 }); this.depois(0.18, () => { this.estrela4(p.x, p.y, '#ffffff', 28); this.onda(p.x, p.y + 8, 20, '#6af0ff', 0.35, 2); }); }
    }
    if (t2 === 'T') {             // Chuva de Estrelas: estrelas caem em volta dele
      const raio = this.arena ? 2.6 * T : 44;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + Math.random() * 0.5, r = raio * (0.35 + Math.random() * 0.6), alvo = alvosEv[k];
        this.depois(k * 0.07, () => { const p = alvo && this.criaturas.has(alvo.id) ? this.centro(alvo) : { x: c.x + Math.cos(a) * r, y: pe - 8 + Math.sin(a) * r * 0.45 }; this.estrelaCaindo(p.x, p.y, null, ['#6af0ff', '#ffffff', '#ffd860']); });
      }
      this.onda(c.x, pe, raio, '#6af0ff', 0.6, 3);
    }
    if (t2 === 'B') {             // Constelação: estrelas ligadas por fios de luz em volta dele
      this.feixeCeu(c.x, pe, '#9af4ff');
      for (const e of this.efeitos) if (e.tipo === 'taricConstelacao') e.t = Math.max(e.t, e.dur - 0.4);
      this.efeitos.push({ tipo: 'taricConstelacao', dur: ev.duracao || 10, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: d, giro: Math.random() * 6 });
    }
    if (t2 === 'M') {             // Martelo Celestial: salta e o martelo cai do céu
      d.pulo = 0.45; d.puloDur = 0.45; d.puloAlto = 22; d.atk = 0.4;
      if (this.arena && ev.x != null) this.marteloCelestial(ev.x * T, ev.y * T, 0.05);
      else { const p = v ? this.centro(v) : { x: c.x + (d.dir === DIR.O ? -30 : 30), y: c.y }; this.marteloCelestial((c.x + p.x) / 2, pe + 2, 0.05); }
    }
    if (t2 === 'N') {             // Supernova: a estrela explode em volta dele
      this.efeitos.push({ tipo: 'taricSupernova', dur: 0.9, t: 0, alvo: null, fixo: { px: 0, py: 0 }, x: c.x, y: c.y - 4, raio: this.arena ? 4 * T : 80 });
      this.aviso(t('Supernova!'), '#9af4ff'); this.tremor = Math.max(this.tremor, 0.45); this.flash = Math.max(this.flash || 0, 0.18);
      this.escuro = Math.max(this.escuro || 0, 0.4); this.corEscuro = '0,16,40';
      for (const [k, cor] of [[0, '#ffffff'], [1, '#6af0ff'], [2, '#ffd860']]) this.depois(k * 0.1, () => this.onda(c.x, pe, (this.arena ? 4 * T : 80) * (1 - k * 0.2), cor, 0.7, 5 - k));
      this.pilaresLuz(c.x, pe, 60, '#9af4ff'); this.brilhos(c.x, c.y, ['#ffffff', '#6af0ff', '#ffd860'], 40, 200, { forma: 'estrela' });
    }
  }
  // o Taric de outro jogador: só o visual (quem acerta é o servidor)
  lanceTaric(o, m, dir) {
    const c = this.centro(o), pe = c.y + 10;
    if (m.tecla === 'A') this.projOutros.push({ tipo: 'estilhaco', x: m.x, y: m.y, vx: dir.x * 17, vy: dir.y * 17, vel: 17, alcance: 8, andou: 0, dono: m.n });
    else if (m.tecla === 'E') {
      const ox = m.x * T, oy = m.y * T - 14, comp = 5.5 * T;
      this.efeitos.push({ tipo: 'taricFeixe', dur: 1, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, pts: [{ x: ox + dir.x * comp, y: oy + dir.y * comp }] });
      this.depois(1, () => this.efeitos.push({ tipo: 'precisao', dur: 0.4, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, ex: ox + dir.x * comp, ey: oy + dir.y * comp, cores: ['#30c8ff', '#9af4ff', '#ffffff'] }));
    } else if (m.tecla === 'R') { this.efeitos.push({ tipo: 'taricEstrela', dur: 2.5, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: o }); this.depois(2.5, () => this.cupulaTaric(o, 2.5)); }
    else if (m.tecla === 'M') { o.pulo = 0.45; o.puloDur = 0.45; o.puloAlto = 22; this.depois(0.3, () => { const c2 = this.centro(o); this.marteloCelestial(c2.x, c2.y + 10); }); }
    else if (m.tecla === 'N') this.efeitos.push({ tipo: 'taricSupernova', dur: 0.9, t: 0, alvo: null, fixo: { px: 0, py: 0 }, x: c.x, y: c.y - 4, raio: 4 * T });
    else if (m.tecla === 'T') { for (let k = 0; k < 5; k++) { const a = Math.random() * 6.28, r = Math.random() * 2.4 * T; this.depois(k * 0.08, () => this.estrelaCaindo(c.x + Math.cos(a) * r, pe - 8 + Math.sin(a) * r * 0.45, null, ['#6af0ff', '#ffffff', '#ffd860'])); } }
    else if (m.tecla === 'W' || m.tecla === 'F') this.efeitos.push({ tipo: 'taricFacetas', dur: 0.9, t: 0, alvo: null, fixo: { px: 0, py: 0 }, dono: o, egide: m.tecla === 'F' });
    else if (m.tecla === 'B') this.feixeCeu(c.x, pe, '#9af4ff');
    else { this.pilaresLuz(c.x, pe, 22, '#6af0ff'); this.brilhos(c.x, c.y, ['#6af0ff', '#ffffff'], 10, 50, { forma: 'estrela' }); }
  }
  efeitoTaric(g, e, k) {
    const cs = (c) => this.corSkin(c);
    const dono = e.dono || this.darius, c = this.centro(dono), pe = c.y + 10;
    if (e.tipo === 'taricFeixe') {        // o feixe do Deslumbrar se formando: fino e piscando, cada vez mais forte
      const de = e.ox != null ? { x: e.ox, y: e.oy } : (dono === this.darius ? this.mao() : { x: c.x, y: c.y - 2 });
      const pts = e.pts || (e.alvos || []).filter((a) => this.criaturas.has(a.id)).map((a) => this.centro(a));
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const p of pts) {
        const pisca = 0.55 + 0.45 * Math.sin(this.tempo * (20 + k * 30));
        for (const [w, cor, f] of [[2 + k * 4, cs('#30c8ff'), 0.3], [0.8 + k * 1.6, cs('#9af4ff'), 0.7], [0.6, '#ffffff', 1]]) {
          g.globalAlpha = (0.25 + 0.6 * k) * pisca * f; g.strokeStyle = cor; g.lineWidth = w; g.beginPath(); g.moveTo(de.x, de.y); g.lineTo(p.x, p.y - 2); g.stroke();
        }
        const q = (this.tempo * 2.2) % 1;       // uma faísca correndo pelo feixe
        g.globalAlpha = 0.8; g.fillStyle = '#ffffff'; g.fillRect(Math.round(de.x + (p.x - de.x) * q) - 1, Math.round(de.y + (p.y - 2 - de.y) * q) - 1, 2, 2);
      }
      g.restore();
      this.estrelaTaric(g, de.x, de.y, 3 + k * 4, cs('#9af4ff'), this.tempo * 4, 0.9);
    } else if (e.tipo === 'taricEstrela') {   // a estrela do Resplendor se formando em cima da cabeça
      const r = 4 + 10 * k, y0 = c.y - 30 - 4 * k;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 + 0.35 * k; g.strokeStyle = cs('#ffe27a'); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(c.x, pe, (this.arena ? 6 * T : 70) * (1 - k * 0.6), (this.arena ? 6 * T : 70) * (1 - k * 0.6) * 0.42, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      this.estrelaTaric(g, c.x, y0, r, cs('#ffe27a'), this.tempo * 1.5, 0.9);
      this.estrelaTaric(g, c.x, y0, r * 0.6, cs('#9af4ff'), -this.tempo * 2 + 0.4, 0.8);
      if (Math.random() < 0.7) {               // pontinhos de luz convergindo para a estrela
        const a = Math.random() * Math.PI * 2, rr = 30 + Math.random() * 20;
        this.fx.add({ x: c.x + Math.cos(a) * rr, y: y0 + Math.sin(a) * rr * 0.6, vx: -Math.cos(a) * rr * 2.2, vy: -Math.sin(a) * rr * 1.3, cor: Math.random() < 0.5 ? cs('#ffe27a') : '#ffffff', brilho: true, vida: 0.45, tam: 1.5, encolhe: true });
      }
    } else if (e.tipo === 'taricCupula') {    // a cúpula dourada: ninguém fere quem está dentro
      const al = Math.min(1, e.t / 0.2) * Math.min(1, (e.dur - e.t) / 0.4), R = 19 + Math.sin(this.tempo * 6);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.22 * al; g.fillStyle = cs('#ffe27a'); g.beginPath(); g.ellipse(c.x, pe - 2, R, R * 1.25, 0, Math.PI, 0); g.ellipse(c.x, pe - 2, R, R * 0.4, 0, 0, Math.PI); g.fill();
      g.globalAlpha = 0.8 * al; g.strokeStyle = cs('#fff0b0'); g.lineWidth = 1.4; g.beginPath(); g.ellipse(c.x, pe - 2, R, R * 1.25, 0, Math.PI, 0); g.stroke();
      g.globalAlpha = 0.6 * al; g.strokeStyle = cs('#9af4ff'); g.lineWidth = 1; g.beginPath(); g.ellipse(c.x, pe - 2, R, R * 0.4, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      for (let i = 0; i < 4; i++) { const a = this.tempo * 1.6 + (i * Math.PI) / 2, px = c.x + Math.cos(a) * R * 0.85, py = pe - 2 - Math.abs(Math.sin(a)) * R * 1.05; this.estrelaTaric(g, px, py, 2 + Math.sin(this.tempo * 8 + i), cs('#ffffff'), 0, al); }
    } else if (e.tipo === 'taricFacetas') {   // facetas de cristal girando em volta (Bastião; a Égide é dourada e maior)
      const al = 1 - k, n = e.egide ? 6 : 4, R = (e.egide ? 18 : 14) + 6 * k, cor = cs(e.egide ? '#ffd860' : '#6af0ff');
      for (let i = 0; i < n; i++) {
        const a = this.tempo * 3 + (i * Math.PI * 2) / n, px = c.x + Math.cos(a) * R, py = c.y - 2 + Math.sin(a) * R * 0.45;
        g.globalAlpha = al; this.cristalTaric(g, px, py, Math.PI / 2, e.egide ? 1.2 : 1, cor); g.globalAlpha = 1;
      }
    } else if (e.tipo === 'taricCristal') {   // Estilhaço no Rift: o cristal voando até o alvo
      const q = Math.min(1, k), x = e.ox + (e.ex - e.ox) * q, y = e.oy + (e.ey - e.oy) * q;
      this.cristalTaric(g, x, y, this.tempo * 25, 1, cs('#6af0ff'));
    } else if (e.tipo === 'taricMartelo') {   // o martelo celeste caindo do céu
      const q = k * k, y = e.y - 120 * (1 - q) - 10, cor = cs('#6af0ff');
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.strokeStyle = cs('#9af4ff'); g.lineWidth = 6; g.beginPath(); g.moveTo(e.x, y - 50); g.lineTo(e.x, y); g.stroke(); g.restore();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(e.x, y - 30); g.lineTo(e.x, y); g.stroke();
      g.strokeStyle = cs('#ffd860'); g.lineWidth = 2; g.beginPath(); g.moveTo(e.x, y - 30); g.lineTo(e.x, y); g.stroke();
      this.cristalTaric(g, e.x, y + 2, 0, 2.6, cor);
    } else if (e.tipo === 'taricConstelacao') {   // as estrelas da Constelação ligadas por fios, girando devagar em volta dele
      const al = Math.min(1, e.t / 0.4) * Math.min(1, (e.dur - e.t) / 0.6), n = 6, pts = [];
      for (let i = 0; i < n; i++) { const a = e.giro + this.tempo * 0.5 + (i * Math.PI * 2) / n, r = 20 + (i % 2) * 5; pts.push([c.x + Math.cos(a) * r, c.y - 4 + Math.sin(a) * r * 0.5 - (i % 3) * 3]); }
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.4 * al; g.strokeStyle = cs('#9af4ff'); g.lineWidth = 0.8;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke(); g.restore();
      pts.forEach(([x, y], i) => this.estrelaTaric(g, x, y, 1.8 + Math.sin(this.tempo * 5 + i) * 0.6, cs(i % 2 ? '#ffffff' : '#9af4ff'), 0, al));
    } else if (e.tipo === 'taricSupernova') {   // a explosão: um núcleo branco que se abre em raios
      const al = 1 - k, r = 10 + e.raio * 0.5 * Math.sqrt(k);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = al * 0.9; g.drawImage(halo(cs('#9af4ff')), e.x - r * 1.6, e.y - r * 1.6, r * 3.2, r * 3.2);
      g.globalAlpha = al; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(e.x, e.y, Math.max(1, 12 * (1 - k)), 0, Math.PI * 2); g.fill();
      g.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10 + k * 0.6, l = r * (i % 2 ? 0.8 : 1.2);
        g.strokeStyle = cs(i % 2 ? '#ffd860' : '#6af0ff'); g.lineWidth = 2.5 * al + 0.5;
        g.beginPath(); g.moveTo(e.x + Math.cos(a) * r * 0.3, e.y + Math.sin(a) * r * 0.3 * 0.6); g.lineTo(e.x + Math.cos(a) * l, e.y + Math.sin(a) * l * 0.6); g.stroke();
      }
      g.restore();
    }
  }
  efeitoKatarina(g, e, k) {
    {
      const dono = e.dono || this.darius, c = this.centro(dono), pe = c.y + 10;
      if (e.tipo === 'katVoo') {          // uma adaga voando de (ox, oy) até (ex, ey), num arquinho
        const q = Math.min(1, k), x = e.ox + (e.ex - e.ox) * q, y = e.oy + (e.ey - e.oy) * q - Math.sin(q * Math.PI) * (e.alto || 0);
        this.desenharAdagaVoando(g, x, y, this.tempo * 30, e.ex - e.ox, e.ey - e.oy);
      } else if (e.tipo === 'katGiro') {  // o giro: três cortes curvos em volta dela, no chão (achatado)
        const al = 1 - k, r = e.raio * (0.55 + 0.45 * k), a0 = e.giro + k * Math.PI * 2.4;
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a = a0 + (i * Math.PI * 2) / 3;
          for (const [w, cor, f] of [[5, '#7a0a14', 0.6], [3, '#ff3a4a', 0.9], [1.2, '#ffc0c8', 1]]) {
            g.globalAlpha = al * f; g.strokeStyle = cor; g.lineWidth = w;
            g.beginPath(); g.ellipse(c.x, pe - 4, r, r * 0.45, 0, a, a + 1.3); g.stroke();
          }
          const px = c.x + Math.cos(a + 1.3) * r, py = pe - 4 + Math.sin(a + 1.3) * r * 0.45;
          g.globalAlpha = al; this.desenharAdagaVoando(g, px, py - 2, a + 1.3 + Math.PI / 2, 0, 0, 0.8);
        }
        g.restore();
      } else if (e.tipo === 'katLotus') { // Lótus (e Tempestade): pétalas de lâmina girando no chão e ela girando
        const tem = e.tempestade, n = tem ? 8 : 6, r = e.raio * (tem ? 0.75 + 0.15 * Math.sin(this.tempo * 6) : 0.55), al = Math.min(1, (e.dur - e.t) / 0.3, e.t / 0.15);
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = al * 0.35; g.fillStyle = '#7a0a14'; g.beginPath(); g.ellipse(c.x, pe, r, r * 0.42, 0, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < n; i++) {           // pétalas
          const a = this.tempo * (tem ? 9 : 6) + (i * Math.PI * 2) / n, px = c.x + Math.cos(a) * r * 0.7, py = pe + Math.sin(a) * r * 0.3;
          g.globalAlpha = al * 0.7; g.fillStyle = i % 2 ? '#ff3a4a' : '#ff8aa0';
          g.beginPath(); g.ellipse(px, py, 5, 2, a, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = al; g.strokeStyle = '#ff3a4a'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(c.x, pe, r, r * 0.42, 0, 0, Math.PI * 2); g.stroke();
        g.restore();
        for (let i = 0; i < (tem ? 6 : 4); i++) {   // lâminas girando em volta do corpo
          const a = -this.tempo * (tem ? 14 : 10) + (i * Math.PI * 2) / (tem ? 6 : 4), rr = tem ? 26 : 18;
          g.globalAlpha = al; this.desenharAdagaVoando(g, c.x + Math.cos(a) * rr, c.y - 2 + Math.sin(a) * rr * 0.45, a + Math.PI / 2, 0, 0, 0.9);
        }
        g.globalAlpha = 1;
        // ela gira junto: a direção do corpo troca rápido
        dono.dir = [DIR.S, DIR.L, DIR.N, DIR.O][Math.floor(this.tempo * (tem ? 16 : 12)) % 4];
        if (dono.pose?.seq?.[0] !== 54 && e.t < e.dur - 0.05) dono.pose = { seq: [54], dur: 0.2, ate: this.tempo + 0.2 };
        if (Math.random() < 0.5) this.fx.add({ x: c.x + (Math.random() - 0.5) * r, y: pe + (Math.random() - 0.5) * r * 0.4, vx: (Math.random() - 0.5) * 40, vy: -20, cor: Math.random() < 0.5 ? '#ff3a4a' : '#ff8aa0', brilho: true, vida: 0.4, tam: 1.4, encolhe: true });
      } else if (e.tipo === 'katRastro') { // Preparação: correndo, um rastro carmesim nos pés
        if (Math.random() < 0.6) this.fx.add({ x: c.x + (Math.random() - 0.5) * 10, y: pe, vx: 0, vy: -6, cor: ['#ff3a4a', '#7a0a14'][(Math.random() * 2) | 0], brilho: true, vida: 0.4, tam: 2, encolhe: true });
      }
    }
  }
  habilidadeLux(ev, d) {
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    const t = ev.tecla, c = this.centro(d), pe = c.y + 10, m = this.mao();
    if (v && t !== 'W') this.olhar(d, v);
    const alvosEv = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
    const meio = () => {
      const cs = alvosEv.map((a2) => this.centro(a2));
      return cs.length ? { x: cs.reduce((s2, p) => s2 + p.x, 0) / cs.length, y: cs.reduce((s2, p) => s2 + p.y, 0) / cs.length } : null;
    };
    if (t === 'Q') {
      d.atk = 0.22; this.brilhos(m.x, m.y, ['#fff0a0', '#ffffff'], 10, 60);
      if (!this.arena) for (const a2 of alvosEv) { this.raioMistico(m, a2, [this.corSkin('#ff9ae0'), '#fff0f8', '#ffffff'], 0.16); this.depois(0.16, () => { if (this.criaturas.has(a2.id)) { this.efeito('prisao', a2, 1.5); const p = this.centro(a2); this.estrela4(p.x, p.y, this.corSkin('#fff0a0'), 26); } }); }
    }
    if (t === 'W') {           // a varinha sai girando; o escudo aparece na hora
      d.atk = 0.22; this.efeito('barreira', d, 2.5); this.efeitos.push({ tipo: 'bolhaPrisma', dur: 2.5, t: 0, alvo: null });
      this.brilhos(c.x, c.y, ['#ffffff', '#ff9ae0', '#9ad8ff', '#fff0a0'], 16, 60, { forma: 'estrela' }); this.acender(c.x, c.y, 50, '#ffe8f8', 0.5);
      if (ev.escudo) this.texto(d, '+' + fmt(ev.escudo), '#ffe8f8', 0.9);
      if (!this.arena && v) this.efeitos.push({ tipo: 'varinha', c: v, dur: 0.9, t: 0, alvo: v, ...this.pos(v) });
    }
    if (t === 'E') {           // a singularidade voa até o meio do grupo (em Runeterra, até o ponto mirado)
      let para = null;
      if (ev.ponto) para = { x: ev.ponto.x * T, y: ev.ponto.y * T };
      else { const p = meio(); if (p) para = { x: p.x, y: p.y + 8 }; }
      d.atk = 0.22;
      if (para) {
        this.efeitos.push({ tipo: 'singularidade', dur: this.arena ? 0.6 : 0.45, t: 0, alvo: null, fixo: { px: para.x - 16, py: para.y - 18 }, de: { x: m.x, y: m.y }, raio: this.arena ? 2.2 * T : 40 });
        if (!this.arena) this.depois(0.45, () => this.explodirSingularidade(para.x, para.y));
      }
    }
    if (t === 'R') {           // mira por meio segundo: a linha fina mostra por onde o raio vai passar
      const alvo = v || this.alvo || [...this.criaturas.values()][0];
      let vx = 1, vy = 0;
      if (this.arena && (ev.dx || ev.dy)) { const n = Math.hypot(ev.dx, ev.dy) || 1; vx = ev.dx / n; vy = ev.dy / n; }
      else if (alvo) { const p = this.centro(alvo), n = Math.hypot(p.x - m.x, p.y - m.y) || 1; vx = (p.x - m.x) / n; vy = (p.y - m.y) / n; this.olhar(d, alvo); }
      this.dirCentelha = { x: vx, y: vy };
      d.canal = ev.canal || 0.6; d.fila = [];
      this.efeitos.push({ tipo: 'miraLux', c: d, dur: ev.canal || 0.6, t: 0, alvo: null, vx, vy, comp: this.arena ? 14 * T : 620, ...this.pos(d) });
    }
    if (t === 'A') {           // Lança de Luz
      d.atk = 0.22; this.brilhos(m.x, m.y, ['#fff0a0', '#ffffff'], 10, 60);
      if (!this.arena && v) {
        // a lança sai do cajado e passa por todos até o último da fila
        this.efeitos.push({ tipo: 'lancaGelo', c: v, dur: 0.26, t: 0, alvo: v, ...this.pos(v) });
        { const p = this.centro(v); this.feixeAura(m.x, m.y, p.x - m.x, p.y - m.y, Math.hypot(p.x - m.x, p.y - m.y) + 70, [this.corSkin('#fff0a0'), '#ffffff'], 0.4, 12); this.depois(0.08, () => this.estrela4(p.x, p.y, this.corSkin('#fff0a0'), 30)); }
      }
    }
    if (t === 'F') {           // Prisma Regenerador: uma coluna de luz com cristais girando envolve a Lux
      d.atk = 0.22; this.efeito('luzCura', d, 1.2); this.acender(c.x, c.y, 60, '#fff0c0', 0.6);
      this.pilaresLuz(c.x, pe, 26, '#b8ffb0'); this.estrela4(c.x, c.y - 6, '#e8ffd0', 36); this.aura(['#b8ffb0', '#fff0c0'], 1.6, 'estrelas');
    }
    if (t === 'T') {           // Convergência Radiante: o círculo de luz se fecha no chão e explode depois de um instante
      d.atk = 0.22;
      const cx = ev.x != null ? ev.x * T : c.x, cy = ev.y != null ? ev.y * T : pe;
      this.efeitos.push({ tipo: 'convergindo', dur: ev.espera || 0.6, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx, cy, raio: this.arena ? 2.4 * T : 46 });
      this.brilhos(m.x, m.y, ['#fff0a0', '#ffffff'], 10, 50, { forma: 'estrela' });
    }
    if (t === 'M') {           // Chuva de Luz: o cajado chama os raios de luz, que caem um de cada vez
      d.atk = 0.22; this.brilhos(m.x, m.y - 4, ['#fff0a0', '#ff9ae0', '#ffffff'], 14, 50, { forma: 'estrela' }); this.acender(m.x, m.y, 40, '#fff0c0', 0.4);
      this.chuvaDeMeteoros((ev.quedas || []).map((q) => (q.alvo ? { alvo: this.criaturas.get(q.alvo), t: q.t } : q)));
    }
    if (t === 'N') {           // Furacão de Luz: nasce ao lado da Lux e atravessa o grupo
      this.aviso(furacaoDeLuz(), '#fff0a0'); this.tremor = 0.3; d.atk = 0.3;
      const dur = ev.duracao || 3;
      let ox = c.x, oy = pe, vx = 0, vy = 0, meioG = null;
      if (this.arena && ev.dir) { ox = ev.x0 * T; oy = ev.y0 * T; vx = ev.dir.x * (ev.vel || 3) * T; vy = ev.dir.y * (ev.vel || 3) * T; }
      else {
        const p = meio(), alvo = v || [...this.criaturas.values()][0];
        const q = p || (alvo && this.centro(alvo));
        if (q) { meioG = { x: q.x, y: q.y + 10 }; const n = Math.hypot(meioG.x - c.x, meioG.y - pe) || 1; ox = c.x + ((meioG.x - c.x) / n) * 16; oy = pe + ((meioG.y - pe) / n) * 16; }
      }
      this.efeitos.push({ tipo: 'tornado', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, vx, vy, meio: meioG });
      this.acender(c.x, c.y, 90, '#fff0c0', 0.6, 0.9);
      this.brilhos(m.x, m.y, ['#ffffff', '#fff0a0', '#ff9ae0'], 20, 90, { forma: 'estrela' });
      this.estrela4(c.x, c.y - 4, this.corSkin('#fff0a0'), 48); this.escuro = Math.max(this.escuro || 0, 0.32); this.corEscuro = '26,0,34';
    }
    if (t === 'G') {
      this.estrela4(c.x, c.y - 4, this.corSkin('#fff0a0'), 40); this.aura([this.corSkin('#fff0a0'), this.corSkin('#ff9ae0')], 8, 'estrelas');
      this.efeito('brilhoArcano', d, 0.9, '#fff0a0'); this.onda(c.x, pe, 40, '#fff0a0', 0.6, 3); this.depois(0.15, () => this.onda(c.x, pe, 54, '#ff9ae0', 0.6, 2));
      for (let i = 0; i < 16; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 26, y: pe, vy: -40 - Math.random() * 50, vx: (Math.random() - 0.5) * 16, cor: i % 2 ? '#fff0a0' : '#ff9ae0', brilho: true, forma: 'estrela', vida: 1, tam: 2, encolhe: true });
      this.acender(c.x, c.y, 60, '#fff0a0', 0.6);
    }
    if (t === 'B') {           // Farol de Demacia: o farol cai do céu e a Lux fica envolvida em luz (mana e poder)
      this.estandartePos = { x: d.x - 1, y: d.y }; this.cairDoCeu('#ff9ae0'); this.feixeCeu(c.x, pe, '#bfe8ff');
      this.depois(0.25, () => this.aura(['#8ad0ff', '#ffffff'], 10, 'estrelas'));
      this.depois(0.4, () => { this.efeito('brilhoArcano', d, 1, '#bfe8ff'); this.brilhos(c.x, c.y, ['#8ad0ff', '#ffffff', '#ff9ae0'], 18, 60, { forma: 'estrela' }); });
    }
  }
  // explosão da Convergência Radiante: anéis de luz, colunas em quem foi preso e as amarras de luz
  explodirConvergencia(x, y, raio, presos = []) {
    this.estrela4(x, y - 4, '#fff0a0', 46); this.pilaresLuz(x, y, raio, this.corSkin('#fff0a0')); this.tremor = Math.max(this.tremor, 0.3);
    this.onda(x, y, raio, '#fff0a0', 0.5, 4); this.depois(0.06, () => this.onda(x, y, raio * 0.7, '#ff9ae0', 0.45, 3)); this.depois(0.12, () => this.onda(x, y, raio * 1.15, '#ffffff', 0.4, 2));
    this.brilhos(x, y - 6, ['#ffffff', '#fff0a0', '#ff9ae0'], 34, 160, { forma: 'estrela', achatado: 0.5 });
    this.acender(x, y - 6, raio * 1.6, '#fff0c0', 0.5, 1); this.tremor = Math.max(this.tremor, 0.2);
    for (const v of presos) { this.efeitos.push({ tipo: 'pilar', c: v, dur: 0.5, cor: '#fff0a0', t: 0, alvo: v, ...this.pos(v) }); this.efeito('prisao', v, 1.2); }
  }
  // folhas e pétalas soltas (Raízes da Natureza)
  folhas(x, y, qtd) {
    for (let i = 0; i < qtd; i++) this.fx.add({ x: x + (Math.random() - 0.5) * 24, y: y - Math.random() * 6, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 40, grav: 90, atrito: 1.5, cor: ['#6ab83a', '#8ae04a', '#3a7a2a', '#d8f080'][i % 4], vida: 0.9, tam: 1.8 });
  }
  // meteoros: cada queda tem um monstro (Rift) ou um ponto em tiles (Runeterra) e a hora do impacto
  chuvaDeMeteoros(quedas) {
    for (const q of quedas) {
      const onde = () => (q.alvo && this.criaturas.has(q.alvo.id) ? (({ x, y }) => ({ x, y: y + 8 }))(this.centro(q.alvo)) : q.alvo ? q.ultimo : q.x != null ? { x: q.x * T, y: q.y * T } : null);
      if (q.alvo) q.ultimo = (({ x, y }) => ({ x, y: y + 8 }))(this.centro(q.alvo));
      this.depois(Math.max(0, q.t - 0.35), () => {
        const p = onde(); if (!p) return;
        q.ultimo = p;
        this.efeitos.push(q.alvo && this.criaturas.has(q.alvo.id)
          ? { tipo: 'meteoro', c: q.alvo, dur: 0.35, t: 0, alvo: q.alvo, giro: Math.random() * 6, ...this.pos(q.alvo) }
          : { tipo: 'meteoro', dur: 0.35, t: 0, alvo: null, giro: Math.random() * 6, fixo: { px: p.x - 16, py: p.y - 18 - 8 } });
      });
      this.depois(q.t, () => { const p = onde(); if (p) this.explodirMeteoro(p.x, p.y); });
    }
  }
  explodirMeteoro(x, y) {
    this.estrela4(x, y - 4, this.corSkin('#fff0a0'), 32);
    this.efeitos.push({ tipo: 'cratera', dur: 2.2, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 } });
    this.onda(x, y, 34, '#fff0a0', 0.45, 3); this.onda(x, y, 22, '#ff9ae0', 0.3, 2);
    this.brilhos(x, y - 6, ['#ffffff', '#fff0a0', '#ff9ae0', '#bfe8ff'], 26, 140, { forma: 'estrela' });
    this.acender(x, y - 6, 80, '#fff0c0', 0.5, 1); this.tremor = Math.max(this.tremor, 0.18);
  }
  // uma estrela cai do céu num ponto (ou num monstro) e estoura
  estrelaCaindo(x, y, alvo = null, cores = ['#fff0a0', '#ffffff', '#ff9ae0']) {
    this.efeitos.push(alvo ? { tipo: 'estrelaCai', c: alvo, dur: 0.18, t: 0, alvo, ...this.pos(alvo) } : { tipo: 'estrelaCai', dur: 0.18, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 } });
    this.depois(0.18, () => {
      const p = alvo && this.criaturas.has(alvo.id) ? this.centro(alvo) : { x, y };
      this.brilhos(p.x, p.y, cores, 14, 90, { forma: 'estrela' }); this.onda(p.x, p.y + 8, 20, cores[0], 0.35, 2); this.acender(p.x, p.y, 34, cores[0], 0.3);
    });
  }
  // escudo que veio da Lux do grupo
  escudoRecebido(v) { this.efeito('barreira', this.darius, 2.5); if (v) this.texto(this.darius, '+' + fmt(v), '#ffe8f8', 0.9); }
  // a varinha da Barreira Prismática, girando
  desenharVarinha(g, x, y, ang) {
    const c = Math.cos(ang), s2 = Math.sin(ang), L = 7;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7; g.drawImage(halo(this.corSkin('#ff9ae0')), x - 12, y - 12, 24, 24); g.restore();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - c * L, y - s2 * L); g.lineTo(x + c * L, y + s2 * L); g.stroke();
    g.strokeStyle = '#c89a4a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - c * L, y - s2 * L); g.lineTo(x + c * L, y + s2 * L); g.stroke();
    g.strokeStyle = '#ffd860'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - c * 2, y - s2 * 2); g.lineTo(x + c * 2, y + s2 * 2); g.stroke();
    g.fillStyle = this.corSkin('#ff9ae0'); g.beginPath(); g.arc(x + c * L, y + s2 * L, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(x + c * L) - 1, Math.round(y + s2 * L) - 1, 1.5, 1.5);
  }
  rastroPrisma(x, y) {
    if (Math.random() < 0.9) this.fx.add({ x, y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, cor: this.corSkin(['#ff9ae0', '#fff0a0', '#9ad8ff', '#c8a0ff'][Math.floor(Math.random() * 4)]), brilho: true, forma: 'estrela', vida: 0.45, tam: 1.6, encolhe: true });
  }
  // a Lança de Luz: um losango comprido de luz dourada com rastro de brilhos
  desenharGelo(g, x, y, ang) {
    const c = Math.cos(ang), s2 = Math.sin(ang);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.7; g.drawImage(halo(this.corSkin('#ff9ae0')), x - 13, y - 13, 26, 26); g.restore();
    g.fillStyle = '#5a3a10'; g.beginPath(); g.moveTo(x + c * 10, y + s2 * 10); g.lineTo(x - s2 * 3.2, y + c * 3.2); g.lineTo(x - c * 10, y - s2 * 10); g.lineTo(x + s2 * 3.2, y - c * 3.2); g.closePath(); g.fill();
    g.fillStyle = '#ffe58a'; g.beginPath(); g.moveTo(x + c * 9, y + s2 * 9); g.lineTo(x - s2 * 2.4, y + c * 2.4); g.lineTo(x - c * 9, y - s2 * 9); g.lineTo(x + s2 * 2.4, y - c * 2.4); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + c * 9, y + s2 * 9); g.lineTo(x - s2 * 1, y + c * 1); g.lineTo(x - c * 3, y - s2 * 3); g.closePath(); g.fill();
    if (Math.random() < 0.9) this.fx.add({ x: x - c * 8, y: y - s2 * 8, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, cor: Math.random() < 0.5 ? '#ffffff' : '#fff0a0', brilho: true, forma: 'estrela', vida: 0.5, tam: 1.4, encolhe: true });
  }
  // explosão da Singularidade Lucente
  explodirSingularidade(x, y) {
    this.estrela4(x, y - 4, '#ff9ae0', 40); this.pilaresLuz(x, y, this.arena ? 2.2 * T : 40, this.corSkin('#ff9ae0'));
    this.tremor = Math.max(this.tremor, 0.25);
    this.onda(x, y, 44, '#ff9ae0', 0.5, 3); this.depois(0.08, () => this.onda(x, y, 60, '#fff0f8', 0.45, 2));
    this.brilhos(x, y - 6, ['#ff9ae0', '#ffffff', '#fff0a0'], 30, 150, { forma: 'faisca' });
    this.acender(x, y, 70, '#ff9ae0', 0.5); this.tremor = Math.max(this.tremor, 0.15);
  }
  // Centelha Final: o raio sai do cristal na direção do grupo (ou da direção mirada em Runeterra)
  soltarCentelha(d, alvos = [], dir = null) {
    const m = this.mao(), vs = alvos.map((id) => this.criaturas.get(id)).filter(Boolean);
    let vx = 1, vy = 0;
    if (dir && (dir.x || dir.y)) { const n = Math.hypot(dir.x, dir.y); vx = dir.x / n; vy = dir.y / n; }
    else if (this.dirCentelha) { vx = this.dirCentelha.x; vy = this.dirCentelha.y; this.dirCentelha = null; }
    else if (vs.length) {
      const cs = vs.map((v) => this.centro(v)), ax = cs.reduce((s2, p) => s2 + p.x, 0) / cs.length, ay = cs.reduce((s2, p) => s2 + p.y, 0) / cs.length;
      const n = Math.hypot(ax - m.x, ay - m.y) || 1; vx = (ax - m.x) / n; vy = (ay - m.y) / n;
      this.olhar(d, vs[0]);
    } else { const dd = d.dir; vx = dd === DIR.L ? 1 : dd === DIR.O ? -1 : 0; vy = dd === DIR.S ? 1 : dd === DIR.N ? -1 : 0; }
    d.canal = 0; d.atk = 0.3;
    this.raioCentelha(m.x, m.y, vx, vy, this.arena ? 14 * T : 620);
    this.tremor = 0.4; this.flash = 0.22;
  }
  raioCentelha(x, y, vx, vy, comp = 14 * T) {
    this.feixeAura(x, y, vx, vy, comp, [this.corSkin('#ff9ae0'), '#fff0f8'], 0.85, 34);
    this.tremor = Math.max(this.tremor, 0.5); this.escuro = Math.max(this.escuro || 0, 0.45); this.corEscuro = '26,0,34';
    const n = Math.hypot(vx, vy) || 1;
    this.efeitos.push({ tipo: 'centelha', dur: 0.75, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, ox: x, oy: y, vx: vx / n, vy: vy / n, comp });
    this.efeitos.push({ tipo: 'rastroLuz', dur: 1.4, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, ox: x, oy: y + 12, vx: vx / n, vy: vy / n, comp });
    this.onda(x, y, 30, '#ff9ae0', 0.4, 3);
    this.brilhos(x, y, ['#ff9ae0', '#ffffff', '#fff0a0'], 26, 180, { forma: 'faisca', ang: Math.atan2(vy, vx), abertura: 1.2 });
    this.acender(x, y, 110, '#ff9ae0', 0.6, 1);
  }

  // ---------- Ezreal: luz e energia arcana ----------
  danoAtirador(ev, v, d) {
    const f = ev.fonte;
    const cor = ev.verdadeiro ? '#ffffff' : ev.critico ? '#ffae00' : ev.magico ? '#c890ff' : f === 'Q' ? '#7ad8ff'
      : f === 'E' || f === 'R' ? '#ffd860' : f === 'item' ? '#e8c840' : f === 'A' || f === 'M' ? '#9ae8ff' : f === 'T' ? '#5ab8ff' : '#ffe0a0';
    const chegadaOnda = f === 'R' ? this.atrasoOnda(v) : 0;
    this.texto(v, fmt(ev.valor), cor, ev.verdadeiro || ev.critico ? 1.35 : 1, f === 'R' ? chegadaOnda : f === 'ataque' ? 0.12 : 0.18);
    // o efeito do acerto chega junto com o projétil (se o monstro morreu no caminho, explode onde ele estava)
    const p0 = this.centro(v);
    const acerto = (atraso, fn) => this.depois(atraso, () => { const vivo = this.criaturas.has(v.id); if (vivo) v.hit = f === 'ataque' ? 0.07 : 0.14; fn(vivo ? this.centro(v) : p0); });
    if (f === 'ataque') {
      d.atk = 0.22; this.olhar(d, v); this.efeito('tiro', v, 0.16, ev.critico ? '#ffae00' : '#ffe080');
      acerto(0.13, (p) => { this.faiscas(p.x, p.y - 2, ev.critico ? ['#ffae00', '#ffffff'] : ['#ffe080', '#ffffff'], ev.critico ? 12 : 5, ev.critico ? 120 : 80); this.acender(p.x, p.y, ev.critico ? 34 : 18, '#ffd060', 0.2); });
    }
    if (f === 'Q' && !this.arena) this.raioMistico(this.mao(), v, ['#30c8ff', '#c8f4ff', '#ffffff'], 0.16);
    if (f === 'Q' || f === 'A') this.depois(this.arena ? 0 : 0.16, () => { if (this.criaturas.has(v.id)) { const p = this.centro(v); this.estrela4(p.x, p.y, f === 'A' ? '#ffe080' : '#7ad8ff', 22); } });
    if (f === 'Q' || f === 'A') {
      if (!this.arena) { d.atk = 0.22; this.olhar(d, v); this.efeito('disparo', v, 0.2, f === 'A' ? '#ffffff' : '#7ad8ff'); }
      this.efeito('impacto', v, 0.3);
      acerto(this.arena ? 0 : 0.16, (p) => {
        this.brilhos(p.x, p.y, f === 'A' ? ['#ffffff', '#ffe080'] : ['#30c8ff', '#c8f4ff'], 16, 110, { forma: 'faisca' });
        this.onda(p.x, p.y + 6, 22, f === 'A' ? '#ffe080' : '#30c8ff', 0.35, 2); this.acender(p.x, p.y, 32, f === 'A' ? '#ffe080' : '#30c8ff', 0.3);
        if (f === 'A') for (let i = 0; i < 5; i++) this.fx.add({ x: p.x, y: p.y - 14, vx: Math.cos(i * 1.26) * 30, vy: Math.sin(i * 1.26) * 12, cor: '#fff060', brilho: true, forma: 'estrela', vida: 0.6, tam: 2, atrito: 4 });
      });
    }
    if (f === 'M') { this.efeito('impacto', v, 0.25); acerto(0.05, (p) => this.faiscas(p.x, p.y, ['#9ae8ff', '#ffffff'], 8, 90)); }
    if (f === 'E') { this.efeito('disparo', v, 0.25, '#ffd860'); this.efeito('impacto', v, 0.35); acerto(0.2, (p) => { this.brilhos(p.x, p.y, ['#ffd860', '#ffffff'], 18, 110); this.acender(p.x, p.y, 36, '#ffd860', 0.35); }); }
    if (f === 'W') { this.tirarEfeito('runaOrbe', v); const p = this.centro(v); this.estrela4(p.x, p.y, '#c890ff', 30); this.onda(p.x, p.y + 6, 44, '#e0b0ff', 0.5, 2); this.tremor = Math.max(this.tremor, 0.12); }
    if (f === 'W') {
      this.efeito('detonar', v, 0.45); v.hit = 0.14;
      const p = this.centro(v);
      this.brilhos(p.x, p.y - 4, ['#b060ff', '#e0b0ff', '#ffe080'], 26, 130); this.onda(p.x, p.y + 4, 32, '#b060ff', 0.5, 3); this.acender(p.x, p.y, 44, '#b060ff', 0.45);
    }
    if (f === 'T') { this.efeito('lentidao', v, 1.8); v.hit = 0.14; const p = this.centro(v); this.faiscas(p.x, p.y, ['#5ab8ff', '#ffffff'], 6, 70); }
    if (f === 'R') acerto(chegadaOnda, (p) => { this.efeito('impacto', v, 0.4); this.brilhos(p.x, p.y, ['#ffb020', '#ffe080', '#ffffff'], 22, 160, { forma: 'faisca', ang: Math.atan2(this.ondaR?.vy || 0, this.ondaR?.vx || 1), abertura: 1.6 }); this.acender(p.x, p.y, 44, '#ffb020', 0.4); });
    if (f === 'N') {
      this.efeitos.push({ tipo: 'pilar', c: v, dur: 0.7, cor: '#ffc040', t: 0, alvo: v, ...this.pos(v) });
      const p = this.centro(v);
      this.depois(0.2, () => { this.efeito('detonar', v, 0.6); this.brilhos(p.x, p.y, ['#ffc040', '#ffffff'], 24, 150, { forma: 'faisca' }); this.onda(p.x, p.y + 8, 44, '#ffc040', 0.6, 3); this.acender(p.x, p.y, 60, '#ffc040', 0.5); });
    }
    if (f === 'item') { const p = this.centro(v); this.faiscas(p.x, p.y, ['#ffe060', '#ffffff'], 6, 70); }
    if (f === 'F') { this.efeito('detonar', v, 0.4); v.hit = 0.14; }
    if (f === 'B') { this.efeito('impacto', v, 0.3); acerto(0.2, (p) => { this.brilhos(p.x, p.y, ['#ffd860', '#30c8ff', '#ffffff'], 16, 110, { forma: 'faisca' }); this.acender(p.x, p.y, 36, '#ffd860', 0.35); }); }
  }
  habilidadeAtirador(ev, d) {
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    const t = ev.tecla, c = this.centro(d), pe = c.y + 10, m = this.mao();
    if (t === 'W' && this.arena) { d.atk = 0.22; this.brilhos(m.x, m.y, ['#b060ff', '#e0b0ff'], 10, 50); }
    if (t === 'W' && v) { d.atk = 0.22; this.olhar(d, v); this.efeito('orbe', v, 0.3); this.brilhos(m.x, m.y, ['#b060ff', '#e0b0ff'], 10, 50); this.depois(0.3, () => { if (this.criaturas.has(v.id)) { this.tirarEfeito('runaOrbe', v); this.efeito('runaOrbe', v, 4); } }); }
    if (t === 'E') { if (this.arena) this.piscarArena(ev); else this.translocar(d); this.depois(0.06, () => { const c2 = this.centro(d); this.estrela4(c2.x, c2.y, '#ffd860', 34); this.onda(c2.x, c2.y + 10, 40, '#7ad8ff', 0.45, 3); }); }
    if (t === 'R') {           // começa a carregar: braço estendido, energia sendo puxada para a luva
      const alvo = v || this.alvo || [...this.criaturas.values()][0];
      if (alvo) this.olhar(d, alvo);
      d.canal = ev.canal || 1; d.fila = [];
      this.efeitos.push({ tipo: 'canalR', c: d, dur: ev.canal || 1, t: 0, alvo: null, ...this.pos(d) });
    }
    if (t === 'G') {
      this.efeito('brilhoArcano', d, 0.9, '#ffd860'); this.onda(c.x, pe, 40, '#ffd860', 0.6, 3); this.depois(0.15, () => this.onda(c.x, pe, 54, '#fff0b0', 0.6, 2));
      for (let i = 0; i < 16; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 26, y: pe, vy: -40 - Math.random() * 50, vx: (Math.random() - 0.5) * 16, cor: '#ffd860', brilho: true, forma: 'estrela', vida: 1, tam: 2, encolhe: true });
      this.acender(c.x, c.y, 60, '#ffd860', 0.6);
      this.estrela4(c.x, c.y - 4, '#ffd860', 40); this.aura(['#ffd860', '#fff0b0'], 8, 'estrelas');
    }
    if (t === 'A' || (this.arena && (t === 'Q' || t === 'M'))) { d.atk = 0.22; this.brilhos(m.x, m.y, t === 'Q' ? ['#30c8ff', '#c8f4ff'] : ['#ffffff', '#ffe080'], 10, 60); }
    if (t === 'A' && !this.arena) {          // Tiro de Precisão: um risco branco que atravessa a fila até o último
      const vs = (ev.alvos || [ev.alvo]).map((id) => this.criaturas.get(id)).filter(Boolean);
      if (vs.length) {
        this.olhar(d, vs[0]);
        const ult = vs.map((o) => this.centro(o)).sort((p1, p2) => Math.hypot(p2.x - m.x, p2.y - m.y) - Math.hypot(p1.x - m.x, p1.y - m.y))[0];
        const n = Math.hypot(ult.x - m.x, ult.y - m.y) || 1, ex = ult.x + ((ult.x - m.x) / n) * 30, ey = ult.y + ((ult.y - m.y) / n) * 30;
        this.efeitos.push({ tipo: 'precisao', dur: 0.32, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: m.x, oy: m.y, ex, ey });
        this.acender(m.x, m.y, 30, '#fff6c0', 0.25);
        this.feixeAura(m.x, m.y, ex - m.x, ey - m.y, n + 30, ['#ffc040', '#fff6c0'], 0.35, 12); this.estrela4(m.x, m.y, '#fff6c0', 22);
        const p0 = this.centro(vs[0]); this.depois(0.05, () => this.estrela4(p0.x, p0.y, '#ffe080', 30));
      }
    }
    if (t === 'F') {
      this.efeito('brilhoArcano', d, 0.9, '#c890ff');
      for (let i = 0; i < 30; i++) {           // espiral roxa sendo sugada para o Ezreal
        const a = (i / 30) * Math.PI * 4, r = 34 - i * 0.6;
        this.fx.add({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 1.6, vy: -Math.sin(a) * r, cor: i % 3 ? '#b060ff' : '#ff4a8a', brilho: true, vida: 0.6, tam: 1.6 });
      }
      this.acender(c.x, c.y, 50, '#b060ff', 0.6);
      this.estrela4(c.x, c.y - 4, '#c890ff', 36); this.aura(['#b060ff', '#e0b0ff'], 5, 'arcana');
    }
    if (t === 'T') {           // Descarga Shurimane: a carga voa até o ponto (no Rift, o meio do grupo), quebra e solta as bolinhas
      d.atk = 0.22;
      let para = null, bolas = null;
      if (ev.ponto) { para = { x: ev.ponto.x * T, y: ev.ponto.y * T }; bolas = (ev.bolas || []).map((b) => ({ x: b.x * T, y: b.y * T })); }
      else {
        const vs = (ev.alvos || []).map((id) => this.criaturas.get(id)).filter(Boolean);
        if (vs.length) { const cs = vs.map((o) => this.centro(o)); para = { x: cs.reduce((a2, p) => a2 + p.x, 0) / cs.length, y: cs.reduce((a2, p) => a2 + p.y, 0) / cs.length + 10 }; this.olhar(d, vs[0]); }
      }
      if (para) this.descargaShurima(m.x, m.y, para.x, para.y, bolas);
    }
    if (t === 'B') {           // Passagem Shurimane
      if (!this.arena) this.portalRift(d);
      else if (ev.abre && ev.portal) { this.portalEm(ev.portal.x * T, ev.portal.y * T, ev.duracao || 6); this.brilhos(m.x, m.y, ['#ffc040', '#30c8ff'], 10, 60); }
      else if (ev.atravessa) { this.fecharPortal(); if (ev.de) this.iscaEm((ev.de.x - 0.5) * T, (ev.de.y - 0.875) * T, 2.5); this.piscarArena(ev); }
    }
    if (t === 'M' && v) { d.atk = 0.22; this.olhar(d, v); this.efeito('disparo', v, 0.12, '#9ae8ff'); }
    if (t === 'N') {           // Apogeu da Manopla: salta, a manopla acende e ele cai com uma onda de energia
      d.pulo = 0.6; d.atk = 0.4;
      this.aviso(apogeuDaManopla(), '#ffc040'); this.flash = 0.15; this.corFlash = '255,200,80';
      this.efeitos.push({ tipo: 'apogeu', dur: ev.duracao || 10, t: 0, alvo: null });
      for (let i = 0; i < 20; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 20, y: pe, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, cor: i % 2 ? '#ffc040' : '#30c8ff', brilho: true, forma: 'estrela', vida: 0.8, tam: 2, encolhe: true });
      this.depois(0.58, () => {
        const c2 = this.centro(d), pe2 = c2.y + 10;
        const R = this.arena ? 5 * T : 120;
        this.estrela4(c2.x, pe2 - 6, '#ffc040', 56); this.escuro = Math.max(this.escuro || 0, 0.3); this.corEscuro = '24,16,0';
        this.tremor = 0.6; this.flash = 0.15; this.corFlash = '255,210,120';
        this.onda(c2.x, pe2, R, '#ffc040', 0.75, 5); this.onda(c2.x, pe2, R * 0.7, '#30c8ff', 0.6, 4); this.depois(0.1, () => this.onda(c2.x, pe2, R * 0.85, '#fff0b0', 0.6, 2));
        this.pedras(c2.x, pe2, 18, 1.6);
        this.brilhos(c2.x, pe2 - 4, ['#ffc040', '#ffffff', '#30c8ff'], 36, 200, { forma: 'faisca', achatado: 0.45 }); this.acender(c2.x, c2.y, 120, '#ffc040', 0.7, 0.9); this.poeira(c2.x, pe2, 20, 1.6);
      });
    }
  }
  // Descarga Shurimane: a carga sai da manopla em arco, quebra no chão e as bolinhas quicam para fora
  descargaShurima(ox, oy, x, y, bolas = null) {
    if (!bolas) bolas = Array.from({ length: 6 }, (_, k) => { const a2 = (k / 6) * Math.PI * 2 + Math.random() * 0.5, rr = 22 + Math.random() * 22; return { x: x + Math.cos(a2) * rr, y: y + Math.sin(a2) * rr * 0.6 }; });
    this.efeitos.push({ tipo: 'descargaShurima', dur: 1.05, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, de: { x: ox, y: oy }, bolas });
    this.depois(0.35, () => {
      this.onda(x, y, 30, '#ffc040', 0.45, 4); this.onda(x, y, 20, '#30c8ff', 0.35, 3);
      this.brilhos(x, y - 4, ['#ffc040', '#30c8ff', '#ffffff'], 26, 150, { forma: 'faisca', achatado: 0.5 }); this.acender(x, y, 60, '#ffc040', 0.45);
      this.pedras(x, y, 10, 1.1); this.tremor = Math.max(this.tremor, 0.18);
    });
    bolas.forEach((b, k) => this.depois(0.35 + 0.25 + k * 0.05, () => { this.faiscas(b.x, b.y, ['#30c8ff', '#ffffff', '#ffc040'], 6, 60); this.acender(b.x, b.y, 18, '#30c8ff', 0.25); }));
  }
  // a cópia de energia que fica no portal (como um teletransporte: azul, translúcida, com colunas de luz)
  iscaEm(px, py, dur) {
    if (this.iscaEf) this.iscaEf.t = Math.max(this.iscaEf.t, this.iscaEf.dur - 0.3);
    this.iscaEf = { tipo: 'iscaEz', dur: dur + 0.35, t: 0, alvo: null, fixo: { px, py }, dir: this.darius.dir, colunas: Array.from({ length: 7 }, () => ({ x: 6 + Math.random() * 20, f: Math.random() * 6, l: 1 + Math.random() * 2 })) };
    this.efeitos.push(this.iscaEf);
  }
  tiroDaIsca(v) {
    const e = this.iscaEf; if (!e || !v) return;
    const ox = e.fixo.px + 22, oy = e.fixo.py + 14, p = this.centro(v);
    this.efeitos.push({ tipo: 'precisao', dur: 0.22, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, ex: p.x, ey: p.y, cores: ['#30c8ff', '#c8f4ff', '#ffffff'] });
    this.brilhos(ox, oy, ['#7ad8ff', '#ffffff'], 6, 40); this.efeito('impacto', v, 0.2); v.hit = 0.1;
  }
  // ---------- camadas de efeito (habilidades mais bonitas) ----------
  // estrela de impacto: um brilho em cruz, rápido, no ponto do acerto
  // Parede de Vento: um golpe bate nela e não passa. (x, y) em pixels; (ux, uy) para onde o golpe ia; quem: o Yasuo (para o texto)
  barrarVento(x, y, ux, uy, cores = ['#ffe080', '#ffffff'], forte = false, quem = null) {
    const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
    this.efeitos.push({ tipo: 'impactoVento', dur: forte ? 0.6 : 0.45, t: 0, alvo: null, fixo: { px: 0, py: 0 }, cx: x, cy: y, ux, uy, cores, forte });
    // os pedaços do golpe voltam para trás, espalhados
    for (let i = 0; i < (forte ? 26 : 14); i++) {
      const a = Math.atan2(-uy, -ux) + (Math.random() - 0.5) * 2.4, v = 50 + Math.random() * (forte ? 150 : 100);
      this.fx.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, cor: i % 3 ? cores[i % cores.length] : '#bfe8ff', brilho: true, vida: 0.35 + Math.random() * 0.25, tam: forte ? 2.2 : 1.6, encolhe: true, atrito: 3 });
    }
    this.estrela4(x, y, '#ffffff', forte ? 40 : 26); this.acender(x, y, forte ? 60 : 36, '#bfe8ff', 0.3);
    for (const e of this.efeitos) if (e.tipo === 'paredeVento' && e.t < e.dur && Math.hypot(e.cx - x, e.cy - 20 - y) < 70) { e.flashT = this.tempo; e.flashX = x; e.flashY = y; }
    if (forte) this.tremor = Math.max(this.tremor, 0.25);
    const alvo = quem || this.darius;
    if (alvo && this.tempo - (alvo.bloqueioT ?? -9) > 0.5) { alvo.bloqueioT = this.tempo; this.texto(alvo, t('Bloqueado!'), alvo === this.darius ? this.corSkin('#bfe8ff') : '#bfe8ff', forte ? 1.1 : 0.85); }
  }
  // um tiro que voa de (ox, oy) até a parede, em (x, y), e se desfaz nela
  tiroNaParede(ox, oy, x, y, cor, cores = null, forte = false, quem = null) {
    const dur = Math.max(0.12, Math.min(0.35, Math.hypot(x - ox, y - oy) / 260));
    this.efeitos.push({ tipo: 'tiroAte', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox, oy, ex: x, ey: y, cor, grande: forte });
    this.depois(dur, () => this.barrarVento(x, y, x - ox, y - oy, cores || [cor, '#ffffff'], forte, quem));
  }
  // onde um golpe vindo de (sx, sy) bate: na parede do Yasuo, se ela está do lado de onde ele vem; senão, logo na frente dele
  pontoNaParede(d, sx, sy) {
    const c = this.centro(d), yc = c.y - 4;
    let ux = sx - c.x, uy = sy - yc; const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
    const e = this.efeitos.find((f) => f.tipo === 'paredeVento' && f.t < f.dur && f.dono === d), dot = e ? ux * e.vx + uy * e.vy : 0;
    const dw = dot > 0.3 ? Math.max(14, Math.min(n - 6, ((e.cx - c.x) * e.vx + (e.cy - 14 - yc) * e.vy) / dot)) : Math.min(22, n * 0.6);
    return { x: c.x + ux * dw, y: yc + uy * dw };
  }
  // PvP: a Parede de Vento de um Yasuo segurou um golpe (o servidor avisa quem atirou e o Yasuo)
  ventoPvp(m) {
    const y = m.yasuo === this.nomeJogador ? this.darius : this.jogArena.get(m.yasuo);
    if (y) this.barrarVento(m.x * T, m.y * T - 14, -(m.dx || 0) || 1, -(m.dy || 0), ['#ffe080', '#ffffff'], false, y);
  }
  // as Paredes de Vento dos Yasuos que posso atacar (os meus tiros param nelas, ver moverProjeteis no arena.js)
  paredesDeOutros() {
    this.paredes = this.paredes.filter((w) => w.ate > this.tempo);
    return this.paredes.filter((w) => w.dono && this.jogArena.get(w.dono)?.atacavel).map(({ x, y, dx, dy, dono }) => ({ x, y, dx, dy, dono }));
  }
  estrela4(x, y, cor, tam = 24) { this.efeitos.push({ tipo: 'estrela4', dur: 0.22, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, cor, tam, giro: Math.random() * 0.6 - 0.3 }); }
  // raio que sai da mão até o alvo (Q do Ezreal no Rift, Q da Lux)
  raioMistico(de, v, cores, dur = 0.16) { if (!v) return; const p = this.centro(v); this.efeitos.push({ tipo: 'precisao', dur: dur + 0.12, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: de.x, oy: de.y, ex: p.x, ey: p.y, cores }); }
  // Q do Darius: dois arcos do machado girando em volta dele, com rastro
  arcoGiro(d) { this.efeitos.push({ tipo: 'arcoGiro', dur: 0.46, t: 0, alvo: null }); this.depois(0.3, () => { const c = this.centro(d); this.onda(c.x, c.y + 10, 46, '#ff3020', 0.4, 3); this.sangue(d, 0); }); }
  // W do Darius: o machado desce num arco vertical sobre o alvo
  golpeVertical(v) { this.efeito('golpeVertical', v, 0.34); const p = this.centro(v); this.estrela4(p.x, p.y, '#ff6a4a', 28); }
  // E do Darius: a corrente com o gancho sai dele, prende o alvo e volta
  gancho(d, v) { this.efeitos.push({ tipo: 'gancho', dur: 0.42, t: 0, alvo: v, c: v, de: d, ...this.pos(v) }); }
  // R do Darius: um machado gigante de sangue cai do céu sobre o alvo
  machadoGigante(v) {
    const p = this.centro(v);
    this.efeitos.push({ tipo: 'machadoGigante', dur: 0.55, t: 0, alvo: null, fixo: { px: p.x - 16, py: p.y - 18 } });
    this.escuro = Math.max(this.escuro || 0, 0.38); this.corEscuro = '40,0,0';
    this.depois(0.24, () => { this.estrela4(p.x, p.y, '#ff3020', 46); this.onda(p.x, p.y + 10, 70, '#ff2010', 0.6, 4); this.onda(p.x, p.y + 10, 44, '#ffd0a0', 0.4, 2); this.acender(p.x, p.y, 90, '#ff2010', 0.6, 1); });
  }
  // feixe largo e brilhante por cima de um raio (R do Ezreal e da Lux)
  feixeAura(x, y, vx, vy, comp, cores, dur = 0.8, larg = 30) { const n = Math.hypot(vx, vy) || 1; this.efeitos.push({ tipo: 'feixeAura', dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: x, oy: y, vx: vx / n, vy: vy / n, comp, cores, larg }); }
  // colunas de luz subindo em volta de um ponto (explosão da Singularidade)
  pilaresLuz(x, y, raio, cor) { this.efeitos.push({ tipo: 'pilaresLuz', dur: 0.7, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, cor, cols: Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2 + Math.random() * 0.6, r = raio * (0.3 + Math.random() * 0.6); return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.45, atraso: Math.random() * 0.15, l: 3 + Math.random() * 3 }; }) }); }
  // aura em volta do próprio campeão enquanto um efeito dura (chamas, sangue, estrelas, faíscas arcanas ou escudo)
  aura(cores, dur, estilo) {
    for (const e of this.efeitos) if (e.tipo === 'auraBuff' && e.estilo === estilo) e.t = Math.max(e.t, e.dur - 0.3);
    this.efeitos.push({ tipo: 'auraBuff', dur, t: 0, alvo: null, cores, estilo });
  }
  // coluna de luz que desce do céu sobre um ponto (Estandarte, Farol)
  feixeCeu(x, y, cor) {
    this.efeitos.push({ tipo: 'feixeCeu', dur: 0.75, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, cor });
    this.depois(0.14, () => { this.estrela4(x, y - 8, cor, 40); this.onda(x, y, 46, cor, 0.5, 3); this.acender(x, y, 70, cor, 0.5); });
  }
  // ---------- chefes: avisos no chão e os golpes ----------
  // área de perigo no chão que vai enchendo até o golpe (forma: circulo, linha ou cone; posições em pixels)
  avisoChao(a) { this.efeitos.push({ tipo: 'avisoChao', dur: a.dur, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ...a }); }
  chefeCarregaRift(v, d, mec, dur) {
    const cv = this.centro(v), cd = this.centro(d), pe = cd.y + 10;
    const BAL = { investida: 'O Arauto prepara uma investida!', pancada: 'O Arauto ergue os punhos!', olho: 'O olho do Arauto começa a brilhar...',
      sopro: 'O Dragão respira fundo...', chuva: 'O Dragão chama a chuva de fogo!', rugido: 'O Dragão ruge!', acido: 'O Barão cospe ácido!', tentaculos: 'Tentáculos do Vazio!' };
    if (BAL[mec]) this.balao(v, t(BAL[mec]), mec === 'acido' ? '#7ae050' : mec === 'tentaculos' || mec === 'olho' ? '#c070ff' : '#ff6a3a');
    if (mec === 'investida') this.efeito('avisoInvestida', v, dur);
    else if (mec === 'sopro') { this.efeito('avisoSopro', v, dur); this.avisoChao({ forma: 'cone', cx: cv.x, cy: cv.y + 10, dirx: cd.x - cv.x, diry: pe - cv.y - 10, comp: Math.hypot(cd.x - cv.x, pe - cv.y) + 30, ang: 0.45, cor: '255,120,30', dur }); }
    else if (mec === 'pancada') this.avisoChao({ forma: 'circulo', cx: cv.x, cy: cv.y + 14, r: 80, cor: '255,90,40', dur });
    else if (mec === 'olho') { this.efeito('olhoCarga', v, dur); this.avisoChao({ forma: 'linha', cx: cv.x, cy: cv.y, ex: cd.x, ey: cd.y, larg: 16, cor: '190,80,255', dur }); }
    else if (mec === 'chuva') { this.chuvaPontos = [0, 1, 2].map((k) => ({ x: cd.x + (k - 1) * 24 + (Math.random() - 0.5) * 10, y: pe + (Math.random() - 0.5) * 16 })); for (const q of this.chuvaPontos) this.avisoChao({ forma: 'circulo', cx: q.x, cy: q.y, r: 24, cor: '255,110,30', dur }); }
    else if (mec === 'rugido') { this.onda(cv.x, cv.y + 10, 60, '#ff4a2a', 0.5, 3); this.efeito('olhoCarga', v, dur, '#ff4a2a'); }
    else if (mec === 'acido') this.avisoChao({ forma: 'circulo', cx: cd.x, cy: pe, r: 34, cor: '120,230,60', dur });
    else if (mec === 'tentaculos') this.avisoChao({ forma: 'circulo', cx: cd.x, cy: pe, r: 30, cor: '190,80,255', dur });
  }
  chefeGolpeRift(v, d, mec, bloqueado = false) {
    const cv = this.centro(v), cd = this.centro(d), pe = cd.y + 10;
    if (bloqueado) {                // a Parede de Vento do Yasuo segurou: o sopro, o raio ou o ácido param nela
      const p = this.pontoNaParede(d, cv.x, cv.y - 4);
      if (mec === 'sopro') {
        this.efeito('sopro', v, 0.6);
        this.efeitos[this.efeitos.length - 1].corte = Math.max(0.2, Math.min(1, Math.hypot(p.x - cv.x, p.y - cv.y) / (Math.hypot(cd.x - cv.x, cd.y - cv.y) || 1)));
        for (const at of [0.1, 0.3]) this.depois(at, () => this.barrarVento(p.x, p.y, cd.x - cv.x, cd.y - cv.y, ['#ff8a20', '#ffe060', '#d83010'], true));
      } else if (mec === 'olho') {
        this.feixeAura(cv.x, cv.y - 6, p.x - cv.x, p.y - cv.y + 6, Math.hypot(p.x - cv.x, p.y - cv.y), ['#b060ff', '#f0d8ff'], 0.5, 22);
        this.barrarVento(p.x, p.y, p.x - cv.x, p.y - cv.y, ['#c070ff', '#f0d8ff'], true);
      } else this.tiroNaParede(cv.x, cv.y - 6, p.x, p.y, '#7ae050', ['#7ae050', '#c8ff80', '#3a8a20'], true);
      return;
    }
    if (mec === 'sopro') { this.efeito('sopro', v, 0.6); this.fogo = { x: d.x, y: d.y, t: 0 }; this.estrela4(cd.x, cd.y, '#ff8a20', 34); return; }
    this.golpeEm(mec, cv.x, cv.y, cd.x, pe, this.chuvaPontos, v);
  }
  // o golpe de cada habilidade (em pixels): de (bx, by), o chefe, para (x, y), o alvo
  golpeEm(mec, bx, by, x, y, pontos, v) {
    if (mec === 'investida') { this.efeito('impacto', this.darius, 0.4); this.estrela4(x, y - 10, '#ff4020', 40); this.pedras(x, y, 10, 1.2); this.poeira(x, y, 14, 1.4); this.tremor = 0.5; }
    else if (mec === 'pancada' || mec === 'anel') {
      const R = mec === 'anel' ? 3.2 * T : 80;
      for (const [k, at] of [[0, 0], [1, 0.08], [2, 0.16]]) this.depois(at, () => this.onda(bx, by + 14, R * (0.6 + k * 0.25), k === 1 ? '#ffd0a0' : '#ff6a2a', 0.5, 4 - k));
      this.efeitos.push({ tipo: 'rachaduraRadial', dur: 1.3, t: 0, alvo: null, fixo: { px: bx - 16, py: by + 14 - 18 }, linhas: Array.from({ length: 10 }, (_, k) => ({ a: (k / 10) * Math.PI * 2 + Math.random() * 0.4, l: R * (0.6 + Math.random() * 0.4), z: Array.from({ length: 5 }, () => Math.random() * 2 - 1) })) });
      this.estrela4(bx, by + 6, '#ffb070', 50); this.pedras(bx, by + 14, 16, 1.4); this.tremor = 0.55;
    } else if (mec === 'olho') {
      this.feixeAura(bx, by - 6, x - bx, y - 10 - by + 6, Math.hypot(x - bx, y - by) + 20, ['#b060ff', '#f0d8ff'], 0.6, 22);
      this.efeitos.push({ tipo: 'precisao', dur: 0.35, t: 0, alvo: null, fixo: { px: 0, py: 0 }, ox: bx, oy: by - 6, ex: x, ey: y - 10, cores: ['#b060ff', '#e0b0ff', '#ffffff'] });
      this.estrela4(x, y - 10, '#c070ff', 44); this.flash = 0.18; this.corFlash = '150,60,220'; this.tremor = 0.4;
    } else if (mec === 'chuva') {
      for (const [k, q] of (pontos || [{ x, y }]).entries()) this.depois(k * 0.12, () => {
        this.efeitos.push({ tipo: 'bolaFogo', dur: 0.3, t: 0, alvo: null, fixo: { px: q.x - 16, py: q.y - 18 } });
        this.depois(0.3, () => { this.estrela4(q.x, q.y - 6, '#ff8a20', 32); this.onda(q.x, q.y, 30, '#ff6a20', 0.45, 3); this.faiscas(q.x, q.y - 4, ['#ffe060', '#ff8a20', '#d83010'], 14, 120); this.acender(q.x, q.y, 50, '#ff8a20', 0.4); this.tremor = Math.max(this.tremor, 0.25); });
      });
    } else if (mec === 'rugido') {
      if (v) this.efeito('auraChefe', v, 5, '#ff3a20');
      this.onda(bx, by + 10, 90, '#ff3a20', 0.7, 5); this.estrela4(bx, by - 10, '#ff4a20', 50); this.tremor = 0.6;
      this.escuro = Math.max(this.escuro || 0, 0.3); this.corEscuro = '40,6,0'; this.aviso(t('O Dragão está furioso!'), '#ff4a20');
    } else if (mec === 'acido') {
      this.efeitos.push({ tipo: 'pocaAcido', dur: this.arena ? 4.5 : 5, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 }, r: this.arena ? 1.8 * T : 34 });
      this.fx.explosao(x, y - 4, { qtd: 24, vel: 70, cor: ['#7ae050', '#c8ff80', '#3a8a20'], forma: 'circ', vida: 0.7, grav: 140, tam: 2, atrito: 2 });
    } else if (mec === 'tentaculos') {
      for (const [k, q] of (pontos || [{ x, y }]).entries()) this.depois(k * 0.1, () => {
        this.efeitos.push({ tipo: 'tentaculos', dur: 1, t: 0, alvo: null, fixo: { px: q.x - 16, py: q.y - 18 }, tent: Array.from({ length: 5 }, (_, j) => ({ dx: Math.cos(j * 1.26 + Math.random()) * 14, dy: Math.sin(j * 1.26 + Math.random()) * 6, h: 32 + Math.random() * 18, curva: (Math.random() - 0.5) * 16 })) });
        this.estrela4(q.x, q.y - 14, '#c070ff', 36); this.pedras(q.x, q.y, 8, 1.1); this.tremor = Math.max(this.tremor, 0.4);
      });
    } else if (mec === 'pisao') { this.estrela4(x, y - 6, '#ffb070', 36); }
  }
  // Runeterra: o aviso vem do motor de Runeterra em tiles
  avisoGuardiao(ev) {
    const cor = ev.cor || '255,60,30', dur = ev.t;
    if (ev.forma === 'circulos') for (const q of ev.pontos) this.avisoChao({ forma: 'circulo', cx: q.x * T, cy: q.y * T, r: q.r * T, cor, dur });
    else if (ev.forma === 'circulo') this.avisoChao({ forma: 'circulo', cx: ev.x * T, cy: ev.y * T, r: ev.r * T, cor, dur });
    else if (ev.forma === 'linha') this.avisoChao({ forma: 'linha', cx: ev.x * T, cy: ev.y * T, ex: ev.ex * T, ey: ev.ey * T, larg: ev.larg * T, cor, dur });
    else if (ev.forma === 'cone') this.avisoChao({ forma: 'cone', cx: ev.x * T, cy: ev.y * T, dirx: ev.dx, diry: ev.dy, comp: ev.comp * T, ang: ev.ang, cor, dur });
    const v = ev.alvo && this.criaturas.get(ev.alvo);
    if (v && ev.nome) this.balao(v, t(ev.nome) + '!', `rgb(${cor})`);
    if (v && ev.mec === 'olho') this.efeito('olhoCarga', v, dur);
  }
  golpeGuardiaoVisual(ev) {
    const v = ev.alvo && this.criaturas.get(ev.alvo), b = v ? this.centro(v) : { x: ev.x * T, y: ev.y * T };
    if (v) v.atk = 0.3;
    const pontos = ev.pontos?.map((q) => ({ x: q.x * T, y: q.y * T }));
    if (ev.bloqueado) {             // a Parede de Vento segurou o sopro ou o ácido
      const p = ev.bx != null ? { x: ev.bx * T, y: ev.by * T - 12 } : this.pontoNaParede(this.darius, b.x, b.y - 4);
      if (ev.mec === 'sopro') {
        const ox = ev.x * T, oy = ev.y * T - 10, comp = Math.hypot(p.x - ox, p.y - oy);
        this.feixeAura(ox, oy, p.x - ox, p.y - oy, comp, ['#ff6a10', '#ffe080'], 0.6, comp * 0.5);
        for (const at of [0.1, 0.3]) this.depois(at, () => this.barrarVento(p.x, p.y, p.x - ox, p.y - oy, ['#ff8a20', '#ffe060', '#d83010'], true));
      } else {
        this.tiroNaParede(b.x, b.y - 6, p.x, p.y, '#7ae050', ['#7ae050', '#c8ff80', '#3a8a20'], true);
        this.depois(0.3, () => this.golpeEm('acido', b.x, b.y, ev.x * T, ev.y * T, null, v));
      }
      return;
    }
    if (ev.mec === 'investida') { this.onda(ev.ex * T, ev.ey * T, 40, '#ff4020', 0.5, 3); this.estrela4(ev.ex * T, ev.ey * T - 10, '#ff4020', 40); this.pedras(ev.ex * T, ev.ey * T, 12, 1.3); this.tremor = 0.5; return; }
    if (ev.mec === 'sopro') { this.feixeAura(ev.x * T, ev.y * T - 10, ev.dx, ev.dy, ev.comp * T, ['#ff6a10', '#ffe080'], 0.6, ev.comp * T * 0.5); for (let k = 0; k < 40; k++) { const a = Math.atan2(ev.dy, ev.dx) + (Math.random() - 0.5) * ev.ang * 2, r = Math.random() * ev.comp * T; this.fx.add({ x: ev.x * T, y: ev.y * T - 10, vx: Math.cos(a) * r * 2.4, vy: Math.sin(a) * r * 2.4, cor: ['#ffe060', '#ff8a20', '#d83010'][k % 3], brilho: true, vida: 0.5, tam: 2.5, encolhe: true, atrito: 2 }); } this.tremor = 0.4; return; }
    this.golpeEm(ev.mec, b.x, b.y, (ev.x ?? 0) * T, (ev.y ?? 0) * T, pontos, v);
  }
  tirarEfeito(tipo, v) { for (const e of this.efeitos) if (e.tipo === tipo && e.alvo === v) e.t = e.dur; }
  // Passagem Shurimane: um anel dourado em pé, com energia girando dentro
  portalEm(x, y, dur = 6) {
    this.fecharPortal();
    this.portalEf = { tipo: 'portalShurima', dur, t: 0, alvo: null, fixo: { px: x - 16, py: y - 18 } };
    this.efeitos.push(this.portalEf);
    this.onda(x, y, 26, '#ffc040', 0.5, 3); this.brilhos(x, y - 14, ['#ffc040', '#30c8ff', '#ffffff'], 18, 90); this.acender(x, y - 12, 50, '#ffc040', 0.5);
  }
  fecharPortal() { if (this.portalEf && this.portalEf.t < this.portalEf.dur - 0.25) this.portalEf.t = this.portalEf.dur - 0.25; this.portalEf = null; this.portalRiftPos = null; }
  // no Rift: o portal abre longe dos monstros; quando eles alcançam o Ezreal, ele atravessa
  portalRift(d) {
    const mp = this.mapa, ocup = this.ocupados(d), cands = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = d.x + dx, y = d.y + dy, dd = Math.max(Math.abs(dx), Math.abs(dy));
      if (dd >= 3 && x > 8 && x < mp.larg - 9 && y > 6 && y < mp.alt - 7 && mp.livre(x, y) && !ocup.has(x + ',' + y)) cands.push({ x, y });
    }
    d.atk = 0.22;
    if (!cands.length) return;
    const vs = [...this.criaturas.values()], n = Math.max(1, vs.length);
    const mx = vs.reduce((sx, o) => sx + o.x, 0) / n, my = vs.reduce((sy, o) => sy + o.y, 0) / n;
    cands.sort((p1, p2) => Math.hypot(p2.x - mx, p2.y - my) - Math.hypot(p1.x - mx, p1.y - my));
    const p = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
    this.portalEm(p.x * T + 16, p.y * T + 18, 6);
    this.portalRiftPos = p;
  }
  atravessarPortal(d, v) {
    const p = this.portalRiftPos, saida = this.pos(d);
    this.iscaEm(saida.px, saida.py, 2.5);
    if (!p) { this.translocar(d); }
    else {
      const antes = this.pos(d), ca = this.centro(d);
      this.efeitos.push({ tipo: 'translocar', c: d, dur: 0.45, t: 0, alvo: null, fixo: { px: antes.px, py: antes.py } });
      this.brilhos(ca.x, ca.y, ['#ffc040', '#30c8ff', '#ffffff'], 18, 90);
      d.fila = []; d.x = d.de.x = p.x; d.y = d.de.y = p.y; d.t = 1; d.sx = null; d.sy = null;
      this.efeito('translocar', d, 0.45);
      const cn = this.centro(d);
      for (let i = 0; i < 14; i++) { const f = i / 14; this.fx.add({ x: ca.x + (cn.x - ca.x) * f, y: ca.y + (cn.y - ca.y) * f, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, cor: i % 2 ? '#ffc040' : '#30c8ff', brilho: true, vida: 0.5, tam: 1.6, encolhe: true }); }
      this.onda(cn.x, cn.y + 10, 30, '#ffc040', 0.45, 3); this.acender(cn.x, cn.y, 50, '#ffc040', 0.45);
    }
    this.fecharPortal();
    if (v) this.depois(0.15, () => { if (this.criaturas.has(v.id)) { this.olhar(d, v); d.atk = 0.22; this.efeito('disparo', v, 0.2, '#ffd860'); } });
  }
  // Barragem Incendiária: a onda sai da luva na direção do grupo e atravessa a tela
  soltarBarragem(d, alvos = [], dir = null) {
    const m = this.mao(), vs = alvos.map((id) => this.criaturas.get(id)).filter(Boolean);
    let vx = 1, vy = 0;
    if (dir) { vx = dir.x; vy = dir.y; }
    else if (vs.length) {
      const cs = vs.map((v) => this.centro(v)), ax = cs.reduce((s2, p) => s2 + p.x, 0) / cs.length, ay = cs.reduce((s2, p) => s2 + p.y, 0) / cs.length;
      const n = Math.hypot(ax - m.x, ay - m.y) || 1; vx = (ax - m.x) / n; vy = (ay - m.y) / n;
      this.olhar(d, vs[0]);
    } else { const dd = d.dir; vx = dd === DIR.L ? 1 : dd === DIR.O ? -1 : 0; vy = dd === DIR.S ? 1 : dd === DIR.N ? -1 : 0; }
    this.ondaR = { ox: m.x, oy: m.y, vx, vy };
    d.canal = 0; d.atk = 0.3;
    this.efeitos.push({ tipo: 'barragem', c: d, dur: 0.9, t: 0, alvo: null, ...this.pos(d), onda: this.ondaR });
    this.tremor = 0.35; this.flash = 0.12;
    this.onda(m.x, m.y, 36, '#ffb020', 0.45, 3);
    this.brilhos(m.x, m.y, ['#ffb020', '#ffe080', '#ffffff'], 30, 200, { forma: 'faisca', ang: Math.atan2(vy, vx), abertura: 1.4 });
    this.acender(m.x, m.y, 100, '#ffb020', 0.6, 1);
    const c = this.centro(d); this.poeira(c.x - vx * 8, c.y + 12, 10, 1);     // o tranco do disparo
  }
  // quanto tempo a onda leva da luva até o monstro
  atrasoOnda(v) {
    const o = this.ondaR; if (!o) return 0;
    const p = this.centro(v);
    return Math.max(0, ((p.x - o.ox) * o.vx + (p.y - o.oy) * o.vy) / VEL_ONDA);
  }

  // kiting: um passo para longe dos monstros colados (eles correm atrás); depois volta a mirar
  recuar(d) {
    if (d.fila.length || this.morto) return;
    const perto = [...this.criaturas.values()].filter((c) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1);
    if (!perto.length) return;
    const mx = perto.reduce((s2, c) => s2 + c.x, 0) / perto.length, my = perto.reduce((s2, c) => s2 + c.y, 0) / perto.length;
    const ocup = this.ocupados(d);
    const opcoes = vizinhos(d).filter((p) => this.mapa.livre(p.x, p.y) && !ocup.has(p.x + ',' + p.y) && p.x > 8 && p.x < this.mapa.larg - 9 && p.y > 6 && p.y < this.mapa.alt - 7)
      .map((p) => ({ ...p, dist: Math.hypot(p.x - mx, p.y - my) })).sort((a, b) => b.dist - a.dist);
    const atual = Math.hypot(d.x - mx, d.y - my);
    if (!opcoes.length || opcoes[0].dist <= atual) return;      // encurralado: fica e aguenta
    d.fila = [opcoes[0]];
    const c = this.centro(d);
    this.fx.explosao(c.x, c.y + 12, { qtd: 5, vel: 26, cor: ['#b8a07a', '#d0bc96'], vida: 0.5, tam: 2, encolhe: true, grav: -6 });
    for (const v of perto) if (!v.parada) v.busca = this.tempo + 0.15;   // os monstros saem correndo atrás
  }

  // Translocação Arcana: some num brilho e reaparece a alguns tiles; os monstros voltam a caminhar até ele
  translocar(d) {
    const m = this.mapa, ocup = this.ocupados(d), cands = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = d.x + dx, y = d.y + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist >= 3 && x > 8 && x < m.larg - 9 && y > 6 && y < m.alt - 7 && m.livre(x, y) && !ocup.has(x + ',' + y)) cands.push({ x, y });
    }
    const antes = this.pos(d), ca = this.centro(d);
    this.efeitos.push({ tipo: 'translocar', c: d, dur: 0.45, t: 0, alvo: null, fixo: { px: antes.px, py: antes.py } });
    this.brilhos(ca.x, ca.y, ['#ffd860', '#7ad8ff', '#ffffff'], 18, 90); this.acender(ca.x, ca.y, 40, '#ffd860', 0.4);
    if (!cands.length) return;
    // foge para o lado oposto ao dos monstros
    const vs = [...this.criaturas.values()], n = Math.max(1, vs.length);
    const mx = vs.reduce((s, c) => s + c.x, 0) / n, my = vs.reduce((s, c) => s + c.y, 0) / n;
    cands.sort((a, b) => Math.hypot(b.x - mx, b.y - my) - Math.hypot(a.x - mx, a.y - my));
    const p = cands[Math.floor(Math.random() * Math.min(4, cands.length))];
    d.fila = []; d.x = d.de.x = p.x; d.y = d.de.y = p.y; d.t = 1;
    this.efeito('translocar', d, 0.45);
    this.efeitos.push({ tipo: 'fantasmas', c: d, dur: 0.4, t: 0, alvo: null, fixo: { px: antes.px, py: antes.py } });
    const cn = this.centro(d);
    for (let i = 0; i < 14; i++) { const f = i / 14; this.fx.add({ x: ca.x + (cn.x - ca.x) * f, y: ca.y + (cn.y - ca.y) * f, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, cor: i % 2 ? '#ffd860' : '#7ad8ff', brilho: true, vida: 0.5, tam: 1.6, encolhe: true }); }
    this.brilhos(cn.x, cn.y, ['#7ad8ff', '#ffffff'], 16, 80); this.onda(cn.x, cn.y + 10, 24, '#ffd860', 0.4, 2); this.acender(cn.x, cn.y, 44, '#7ad8ff', 0.45);
    for (const c of vs) if (!c.parada) { c.fila = []; c.busca = this.tempo + 0.3; }
    this.aoChegar = null;
  }

  // ---------- auras contínuas (enquanto o efeito dura) ----------
  auras(dt) {
    this.quedaB = Math.max(0, (this.quedaB || 0) - dt / 0.35);
    this.auraT += dt;
    if (this.auraT < 0.05 || !this.mapa) return;
    this.auraT = 0;
    if (this.estandarte > 0 && this.estandartePos) {
      const ep = this.estandartePos;
      this.fx.add({ x: ep.x * T + 4 + Math.random() * 24, y: ep.y * T + 26, vy: -25 - Math.random() * 15, cor: this.corSkin(this.atirador ? '#ffd860' : '#ff5040'), brilho: true, vida: 1, tam: 1.4, encolhe: true });
    }
    if (this.morto || !this.darius) return;
    const c = this.centro(this.darius), d = this.darius;
    if (this.furiaS) {
      if (this.atirador) {           // Sifão Arcano: energia roxa sai dos monstros e vai para o Ezreal
        for (const v of [...this.criaturas.values()].slice(0, 3)) {
          const p = this.centro(v);
          this.fx.add({ x: p.x, y: p.y, vx: (c.x - p.x) / 0.45, vy: (c.y - p.y) / 0.45, cor: Math.random() < 0.5 ? '#b060ff' : '#ff4a8a', brilho: true, vida: 0.45, tam: 1.5 });
        }
      } else for (let i = 0; i < 2; i++) this.fx.add({ x: c.x + (Math.random() - 0.5) * 20, y: c.y + 10, vx: (Math.random() - 0.5) * 10, vy: -30 - Math.random() * 30, cor: Math.random() < 0.6 ? '#d01020' : '#ff6a30', brilho: true, vida: 0.6, tam: 2, encolhe: true });
    }
    if (this.grito && Math.random() < 0.6) this.fx.add({ x: c.x + (Math.random() - 0.5) * 22, y: c.y + 10, vy: -25 - Math.random() * 25, cor: this.atirador ? '#ffd860' : '#ffa040', brilho: true, forma: this.atirador ? 'estrela' : 'quad', vida: 0.8, tam: 1.5, encolhe: true });
    if (this.poder && Math.random() < 0.5) this.fx.add({ x: c.x + (Math.random() - 0.5) * 24, y: c.y + 10, vy: -40, cor: '#ff3020', brilho: true, vida: 0.5, tam: 1.5, encolhe: true });
    if (this.recall > 0) this.fx.add({ x: c.x + (Math.random() - 0.5) * 20, y: c.y + 12, vy: -50, cor: '#8ad8ff', brilho: true, vida: 0.8, tam: 1.5 });
    if (this.atirador && this.forcaAcum >= 5 && Math.random() < 0.4) { const m = this.mao(); this.fx.add({ x: m.x, y: m.y, vx: (Math.random() - 0.5) * 20, vy: -20, cor: '#7ad8ff', brilho: true, vida: 0.4, tam: 1.2 }); }
    if (this.wPronto && !this.atirador && Math.random() < 0.5) { const m = this.mao(); this.fx.add({ x: m.x, y: m.y - 6, vx: (Math.random() - 0.5) * 16, vy: -30, cor: '#ff3a20', brilho: true, forma: 'faisca', vida: 0.4, tam: 1.2 }); }
  }

  // ---------- ambiente: cada região tem a sua vida própria ----------
  ambiente(dt) {
    const b = this.mapa?.mundo ? this.biomaAqui() : this.local?.bioma; if (!b) return;
    this.ambT += dt;
    if (this.ambT < 0.1) return;
    this.ambT = 0;
    const W = VIS_L * T, H = VIS_A * T, r = Math.random, x = this.cam.x + r() * W, y = this.cam.y + r() * H, noite = (this.luz ?? 1) < 0.6;
    if (noite && b !== 'base' && r() < 0.5)          // vaga-lumes piscando
      this.fx.add({ x, y, vx: (r() - 0.5) * 14, vy: (r() - 0.5) * 10, cor: b === 'barao' ? '#c080ff' : '#d0ff70', brilho: true, vida: 2.5 + r() * 2, tam: 1.3, balanco: 12, fase: r() * 6 });
    if (b === 'selva' && !noite && r() < 0.3)         // folhas caindo
      this.fx.add({ x, y: this.cam.y - 4, vx: 6 + r() * 10, vy: 12 + r() * 8, cor: ['#4a8a2a', '#6aa83a', '#8a6a2a', '#a8b040'][(r() * 4) | 0], vida: 7, tam: 2, balanco: 18, fase: r() * 6 });
    if (b === 'rota' && r() < 0.25) this.fx.add({ x, y, vx: 8 + r() * 6, vy: -2, cor: '#d8ccb0', vida: 3, tam: 1, balanco: 6, fase: r() * 6 });
    if (b === 'rio' && this.mapa.agua.length && r() < 0.5) {      // brilhos na água
      const [ax, ay] = this.mapa.agua[(r() * this.mapa.agua.length) | 0];
      if (ax * T >= this.cam.x - T && ax * T <= this.cam.x + W && ay * T >= this.cam.y - T && ay * T <= this.cam.y + H)
        this.fx.add({ x: ax * T + r() * T, y: ay * T + r() * T, cor: '#c8f0ff', brilho: true, forma: 'estrela', vida: 0.6, tam: 1.5, encolhe: true });
    }
    if (b === 'barao' && r() < 0.5) this.fx.add({ x, y: this.cam.y + H, vx: (r() - 0.5) * 8, vy: -14 - r() * 10, cor: '#9a50e0', brilho: true, vida: 6, tam: 1.4, balanco: 10, fase: r() * 6 });
    if (b === 'base' && r() < 0.35) this.fx.add({ x, y, vy: -8 - r() * 8, cor: '#8ad8ff', brilho: true, vida: 3, tam: 1.2, balanco: 8, fase: r() * 6 });
    // estilo novo: fumaça saindo das chaminés que estão na tela
    if (this.mapa?.novo && r() < 0.6) {
      const tx0 = Math.floor(this.cam.x / T) - 3, ty0 = Math.floor(this.cam.y / T), m = this.mapa;
      for (let ty = ty0; ty <= ty0 + VIS_A + 3 && ty < m.alt; ty++) for (let tx = Math.max(0, tx0); tx <= tx0 + VIS_L + 3 && tx < m.larg; tx++) {
        const o = m.obj[ty]?.[tx]; if (!o?.fumaca && !o?.brasas && !o?.respingos) continue;
        if (o.brasas && r() < 0.45)      // faíscas subindo das chamas e brilhos dos cristais
          this.fx.add({ x: tx * T - o.ox + o.brasas[0] + (r() - 0.5) * 6, y: ty * T - o.oy + o.brasas[1], vx: (r() - 0.5) * 8, vy: -14 - r() * 12, cor: o.brasas[2], brilho: true, vida: 0.9 + r() * 0.6, tam: 1.2, balanco: 6, fase: r() * 6, encolhe: true });
        if (o.respingos) for (let k = 0; k < 2; k++) {      // gotas de água pulando (chafariz, roda d'água)
          const bx = tx * T - o.ox + o.respingos[0] + (r() - 0.5) * 16, by = ty * T - o.oy + o.respingos[1];
          this.fx.add({ x: bx, y: by, vx: (r() - 0.5) * 30, vy: -30 - r() * 30, grav: 160, chao: by + 2 + r() * 4, cor: r() < 0.5 ? '#c8ecff' : '#ffffff', vida: 0.7, tam: 1.3 });
        }
        if (!o.fumaca) continue;
        const px = tx * T - o.ox + o.fumaca[0], py = ty * T - o.oy + o.fumaca[1];
        this.fx.add({ x: px + (r() - 0.5) * 4, y: py, vx: 4 + r() * 4, vy: -10 - r() * 6, cor: ['#c8c8c8', '#a8a8b0', '#e0e0e0'][(r() * 3) | 0], vida: 2.6, tam: 2.4, balanco: 5, fase: r() * 6 });
      }
    }
  }

  // estilo novo: borboletas voando pela grama e libélulas por cima da água (de dia)
  bichos(dt) {
    const m = this.mapa;
    if (!m?.novo || m.bioma === 'freljord') { this.bichosVivos = null; return; }      // p668: sem borboletas na neve
    const lista = this.bichosVivos ??= [], noite = (this.luz ?? 1) < 0.6, W = VIS_L * T, H = VIS_A * T, r = Math.random;
    if (!noite && lista.filter((b) => b.tipo !== 'peixe').length < 8 && r() < dt * 1.5) {
      const naTela = aguaEm(m, Math.floor(this.cam.x / T), Math.floor(this.cam.y / T), Math.ceil((this.cam.x + W) / T), Math.ceil((this.cam.y + H) / T)).filter(([ax, ay]) => ax * T > this.cam.x && ax * T < this.cam.x + W && ay * T > this.cam.y && ay * T < this.cam.y + H);
      if (naTela.length && r() < 0.35) { const [ax, ay] = naTela[(r() * naTela.length) | 0]; lista.push({ tipo: 'libelula', x: ax * T + 16, y: ay * T + 16, ang: r() * 6.28, t: 0, vida: 10 + r() * 8, pausa: 0 }); }
      else lista.push({ tipo: 'borboleta', x: this.cam.x + r() * W, y: this.cam.y + r() * H, ang: r() * 6.28, t: 0, vida: 12 + r() * 10, cor: ['#f4f0e8', '#f0c830', '#e87830', '#8ac8f0', '#e890d0'][(r() * 5) | 0], fase: r() * 6 });
    }
    // peixes: sombras nadando debaixo d'água (de dia e de noite), sem nunca sair dela
    const fonte = m.bioma === 'base', fx = ((m.larg >> 1) + 0.5) * T, fy = ((m.alt >> 1) - 0.5) * T;
    const naAgua = fonte ? (x, y) => Math.hypot(x - fx, (y - fy) * 1.05) < 1.35 * T : (x, y) => m.chao[Math.floor(y / T)]?.[Math.floor(x / T)] === 'agua';
    if (fonte && lista.filter((b) => b.tipo === 'peixe').length < 6 && r() < dt * 3) {
      const a = r() * 6.28, d = r() * T;
      lista.push({ tipo: 'peixe', x: fx + Math.cos(a) * d, y: fy + Math.sin(a) * d, ang: r() * 6.28, t: 0, vida: 40 + r() * 30, vel: 6 + r() * 7,
        cor: ['rgba(255,130,40,0.9)', 'rgba(250,250,245,0.9)', 'rgba(255,200,60,0.9)', 'rgba(230,70,40,0.85)'][(r() * 4) | 0], tam: 5 + ((r() * 3) | 0), onda: 0 });
    }
    if (!fonte && lista.filter((b) => b.tipo === 'peixe').length < 7 && r() < dt * 2) {
      const naTela = aguaEm(m, Math.floor(this.cam.x / T) - 1, Math.floor(this.cam.y / T) - 1, Math.ceil((this.cam.x + W) / T), Math.ceil((this.cam.y + H) / T)).filter(([ax, ay]) => ax * T > this.cam.x - T && ax * T < this.cam.x + W && ay * T > this.cam.y - T && ay * T < this.cam.y + H);
      if (naTela.length) {
        const [ax, ay] = naTela[(r() * naTela.length) | 0];
        lista.push({ tipo: 'peixe', x: ax * T + 16, y: ay * T + 16, ang: r() * 6.28, t: 0, vida: 25 + r() * 20, vel: 8 + r() * 10, cor: r() < 0.25 ? 'rgba(240,130,50,0.8)' : r() < 0.5 ? 'rgba(200,210,215,0.55)' : 'rgba(10,30,45,0.55)', tam: 6 + ((r() * 4) | 0), onda: 0 });
      }
    }
    for (const b of lista) {
      b.t += dt;
      if (b.tipo === 'peixe') {
        b.ang += (r() - 0.5) * dt * 2.5;
        const nx = b.x + Math.cos(b.ang) * b.vel * dt, ny = b.y + Math.sin(b.ang) * b.vel * 0.6 * dt;
        // perto da margem: dá meia-volta
        if (naAgua(nx + Math.cos(b.ang) * 8, ny + Math.sin(b.ang) * 6) && naAgua(nx, ny)) { b.x = nx; b.y = ny; } else b.ang += Math.PI * (0.7 + r() * 0.6);
        if ((b.onda -= dt) < -4 - r() * 8) b.onda = 0.9;      // de vez em quando sobe e faz uma ondinha
        continue;
      }
      if (b.tipo === 'borboleta') { b.ang += (r() - 0.5) * dt * 6; b.x += Math.cos(b.ang) * 16 * dt; b.y += Math.sin(b.ang) * 10 * dt; }
      else if ((b.pausa -= dt) <= 0) {          // libélula: dispara, para no ar, dispara de novo
        if (b.pausa < -0.35) { b.pausa = 0.4 + r() * 1.2; b.ang = r() * 6.28; }
        else { b.x += Math.cos(b.ang) * 70 * dt; b.y += Math.sin(b.ang) * 45 * dt; }
      }
    }
    this.bichosVivos = lista.filter((b) => b.t < b.vida && !(noite && b.tipo !== 'peixe' && r() < dt) && (b.tipo !== 'peixe' || naAgua(b.x, b.y)) && b.x > this.cam.x - 60 && b.x < this.cam.x + W + 60 && b.y > this.cam.y - 60 && b.y < this.cam.y + H + 60);
  }
  // ---------- Rift ao ar livre (rotas, selva, rio): passarinhos voando em bando com a sombra correndo no chão, coelhos na
  // grama (comem, pulam e fogem quando o campeão chega perto) e folhas caindo com o vento ----------
  vidaRota(g, camada) {
    const m = this.mapa, agora = this.tempo, r = Math.random, W = VIS_L * T, H = VIS_A * T, cam = this.cam, noite = (this.luz ?? 1) < 0.6;
    const v = this.rotaVida ??= { t: agora, bandos: [], coelhos: [], folhas: [], proxBando: agora + 1.5 };
    // em Runeterra vale a zona onde o campeão está (biomaAqui/zonaEm); no Rift, o mapa
    const zona = m.mundo ? zonaEm(this.darius.x + 0.5, this.darius.y + 0.875) : this.local?.id, bio = m.mundo ? this.biomaAqui() : m.bioma;
    const barao = bio === 'barao', dragao = zona === 'dragao';
    if (barao || dragao) {             // no Covil do Barão e no Fosso do Dragão: fagulhas subindo (roxas / de fogo), sem bichos
      if (camada !== 'ceu') return;
      const dt = Math.min(0.05, Math.max(0, agora - (v.tc ?? agora))); v.tc = agora;
      if (v.folhas.length < 22 && r() < dt * 6)
        v.folhas.push({ x: cam.x + r() * W, y: cam.y + H * (0.3 + r() * 0.75), t: 0, vida: 2.5 + r() * 2.5, fase: r() * 6, cor: barao ? ['#a050e8', '#e0b0ff', '#7a3ab8'][(r() * 3) | 0] : ['#ff8a2a', '#ffc048', '#ff5a1a'][(r() * 3) | 0] });
      for (const f of v.folhas) { f.t += dt; f.y -= (barao ? 10 : 18) * dt; f.x += Math.sin(f.t * 3 + f.fase) * 8 * dt; }
      v.folhas = v.folhas.filter((f) => f.t < f.vida);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const f of v.folhas) { g.globalAlpha = Math.min(1, f.t * 2, f.vida - f.t) * 0.9; g.fillStyle = f.cor; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1); if (f.t % 0.6 < 0.3) g.fillRect(Math.round(f.x), Math.round(f.y) + 1, 1, 1); }
      g.restore();
      return;
    }
    const naGrama = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T), c = m.chao[ty]?.[tx]; return (c === 'grama' || c === 'gramaE') && m.livre(tx, ty) && !(m.mundo && cidadeEm(tx + 0.5, ty + 0.5)); };
    if (camada === 'chao') {
      const dt = Math.min(0.05, Math.max(0, agora - v.t)); v.t = agora;
      const d = this.centro(this.darius);
      // coelhos: nascem na grama longe do campeão, dentro da tela
      if (v.coelhos.length < (noite ? 1 : 3) && r() < dt * 0.6) for (let k = 0; k < 12; k++) {
        const x = cam.x + 20 + r() * (W - 40), y = cam.y + 30 + r() * (H - 50);
        if (naGrama(x, y) && Math.hypot(x - d.x, y - d.y) > 3.5 * T) { v.coelhos.push({ x, y, dir: r() < 0.5 ? -1 : 1, pulo: 0, pausa: 0.5 + r() * 2, come: 0, foge: false, cor: r() < 0.6 ? ['#a8865e', '#6e5236'] : ['#b8b4a8', '#7a766c'], t: 0 }); break; }
      }
      for (const c of v.coelhos) {
        c.t += dt;
        if (!c.foge && Math.hypot(c.x - d.x, c.y - d.y) < 2.6 * T) { c.foge = true; c.dir = c.x < d.x ? -1 : 1; c.pausa = 0; }
        if (c.pulo > 0) {
          c.pulo -= dt; c.x += c.hx * dt; c.y += c.hy * dt;
          if (c.pulo <= 0) c.pausa = c.foge ? 0.04 : 0.3 + r() * 1.6;
          continue;
        }
        if ((c.pausa -= dt) > 0) { c.come = (c.come + dt) % 1.2; continue; }
        // pula: fugindo, para longe do campeão; senão, para um lado qualquer (só se o destino for grama)
        const ang = c.foge ? Math.atan2(c.y - d.y, c.x - d.x) + (r() - 0.5) * 0.6 : r() * Math.PI * 2, dist = c.foge ? 22 : 9 + r() * 7;
        const nx = c.x + Math.cos(ang) * dist, ny = c.y + Math.sin(ang) * dist * 0.6;
        if (c.foge || naGrama(nx, ny)) { c.pulo = 0.26; c.hx = (nx - c.x) / 0.26; c.hy = (ny - c.y) / 0.26; if (Math.abs(c.hx) > 1) c.dir = Math.sign(c.hx); }
        else c.pausa = 0.4;
      }
      v.coelhos = v.coelhos.filter((c) => c.x > cam.x - 40 && c.x < cam.x + W + 40 && c.y > cam.y - 40 && c.y < cam.y + H + 40 && c.t < 90);
      for (const c of v.coelhos) {
        const h = c.pulo > 0 ? Math.sin((1 - c.pulo / 0.26) * Math.PI) * 5 : 0, x = Math.round(c.x), y = Math.round(c.y), dd = c.dir, [cor, esc] = c.cor;
        const some = Math.min(1, c.t * 2);
        g.globalAlpha = 0.28 * some; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y + 1, 4, 1.5, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = some; const yb = y - Math.round(h);
        g.fillStyle = esc; g.fillRect(x - 3, yb - 3, 6, 3);                         // corpo (sombra embaixo)
        g.fillStyle = cor; g.fillRect(x - 3, yb - 4, 6, 3); g.fillRect(x - 2, yb - 5, 4, 1);
        g.fillStyle = cor; g.fillRect(x + dd * 2 + (dd > 0 ? 0 : -1), yb - 6, 2, 3);  // cabeça
        const orelha = c.come > 0.9 && c.pulo <= 0 ? 1 : 0;                         // a orelha mexe enquanto come
        g.fillStyle = esc; g.fillRect(x + dd * 2 + (dd > 0 ? 0 : 0), yb - 9 + orelha, 1, 3); g.fillRect(x + dd * 2 + (dd > 0 ? 1 : -1), yb - 9, 1, 3 - orelha);
        g.fillStyle = '#1a1410'; g.fillRect(x + dd * 3 + (dd > 0 ? 0 : -1), yb - 5, 1, 1);
        g.fillStyle = '#f4f0e8'; g.fillRect(x - dd * 3 + (dd > 0 ? -1 : 0), yb - 4, 2, 2);    // rabinho branco
        if (c.pulo <= 0 && c.come < 0.6) { g.fillStyle = esc; g.fillRect(x + dd * 3 + (dd > 0 ? 0 : -1), yb - 3, 1, 1); }
      }
      g.globalAlpha = 1;
      // a sombra dos passarinhos correndo no chão (desenhada aqui, embaixo de tudo)
      for (const b of v.bandos) for (const p of b.aves) {
        g.globalAlpha = 0.16; g.fillStyle = '#000'; g.beginPath(); g.ellipse(Math.round(p.x + 18), Math.round(p.y + 46), 3, 1.2, 0, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      return;
    }
    // céu: os bandos passam de um lado para o outro, batendo as asas, e as folhas caem
    const dt = Math.min(0.05, Math.max(0, agora - (v.tc ?? agora))); v.tc = agora;
    if (agora > v.proxBando) {
      v.proxBando = agora + (noite ? 16 : 7) + r() * (noite ? 14 : 8);
      const n = 3 + ((r() * 4) | 0), ida = r() < 0.5 ? 1 : -1, vel = 48 + r() * 26, y0 = cam.y + H * (0.12 + r() * 0.5), x0 = ida > 0 ? cam.x - 30 : cam.x + W + 30;
      const cor = bio === 'rio' && r() < 0.5 ? ['#e8ecf0', '#8a96a4'] : ['#2a2a34', '#4a4a58'];
      v.bandos.push({ ida, vel, aves: Array.from({ length: n }, (_, k) => { const fila = Math.ceil(k / 2), lado = k % 2 ? 1 : -1; return { x: x0 - ida * fila * 11, y: y0 + lado * fila * 6, fase: r() * 6, onda: r() * 6 }; }), cor });
    }
    for (const b of v.bandos) for (const p of b.aves) { p.x += b.ida * b.vel * dt; p.y += Math.sin(agora * 2 + p.onda) * 4 * dt; }
    v.bandos = v.bandos.filter((b) => b.aves.some((p) => p.x > cam.x - 80 && p.x < cam.x + W + 80));
    for (const b of v.bandos) for (const p of b.aves) {
      const x = Math.round(p.x), y = Math.round(p.y), asa = Math.sin(agora * 13 + p.fase), [cor, claro] = b.cor;
      g.fillStyle = cor; g.fillRect(x - 1, y, 3, 1); g.fillRect(x + b.ida * 2, y - 1 + (asa > 0.6 ? 0 : 0), 1, 1);      // corpo e cabeça
      if (asa > 0.3) { g.fillRect(x - 3, y - 2, 2, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 2, y - 2, 2, 1); g.fillRect(x + 1, y - 1, 1, 1); }   // asas para cima
      else if (asa > -0.3) { g.fillStyle = claro; g.fillRect(x - 3, y, 2, 1); g.fillRect(x + 2, y, 2, 1); }                                                 // asas abertas
      else { g.fillRect(x - 3, y + 1, 2, 1); g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 2, y + 1, 2, 1); }                                                   // asas para baixo
    }
    // folhas caindo e balançando com o vento
    if (v.folhas.length < 10 && r() < dt * (noite ? 0.6 : 1.4))
      v.folhas.push({ x: cam.x + r() * W, y: cam.y - 6 + r() * H * 0.4, t: 0, vida: 4 + r() * 3, fase: r() * 6, cor: ['#5a8a32', '#86b04a', '#c8a03a', '#d07a2a', '#6aa040'][(r() * 5) | 0] });
    for (const f of v.folhas) { f.t += dt; f.y += 14 * dt; f.x += (Math.sin(f.t * 2.2 + f.fase) * 16 + 6) * dt; }
    v.folhas = v.folhas.filter((f) => f.t < f.vida);
    for (const f of v.folhas) {
      g.globalAlpha = Math.min(1, f.t, f.vida - f.t); g.fillStyle = f.cor;
      const vira = Math.sin(f.t * 5 + f.fase) > 0;
      g.fillRect(Math.round(f.x), Math.round(f.y), vira ? 2 : 1, vira ? 1 : 2);
    }
    g.globalAlpha = 1;
  }
  // ---------- a Fonte, primeira tela do jogo: ondinhas e pulsos de luz no chafariz, runas girando na praça,
  // pombas ciscando (voam quando o campeão chega perto), pétalas caindo, raios de sol e sombras de nuvens ----------
  vidaFonte(g, camada) {
    const m = this.mapa, cx = ((m.larg >> 1) + 0.5) * T, cy = ((m.alt >> 1) - 0.5) * T, agora = this.tempo, r = Math.random;
    const v = this.fonteVida ??= { t: agora, ondinhas: [], pulsos: [], pombas: null, petalas: [], proxPulso: agora + 2, proxOnda: agora };
    if (camada === 'chao') {
      const dt = Math.min(0.05, agora - v.t); v.t = agora;
      // ondinhas na água do chafariz
      if (agora > v.proxOnda) { v.proxOnda = agora + 0.35 + r() * 0.6; const a = r() * 6.28, d = r() * 1.15 * T; v.ondinhas.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, t: 0 }); }
      v.ondinhas = v.ondinhas.filter((o) => (o.t += dt) < 1.4);
      for (const o of v.ondinhas) { const k = o.t / 1.4; g.strokeStyle = `rgba(220,245,255,${0.6 * (1 - k)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(o.x, o.y, 2 + k * 9, (2 + k * 9) * 0.5, 0, 0, Math.PI * 2); g.stroke(); }
      // pulso do cristal: uma onda de luz azul que corre pela praça e brilhos subindo da água
      if (agora > v.proxPulso) {
        v.proxPulso = agora + 3.5 + r() * 1.5; v.pulsos.push({ t: 0 });
        for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.28; this.fx.add({ x: cx + Math.cos(a) * 1.2 * T, y: cy + Math.sin(a) * 0.65 * T, vy: -18 - r() * 18, cor: k % 2 ? '#8ae8ff' : '#ffffff', brilho: true, forma: 'estrela', vida: 1.2, tam: 1.5, encolhe: true }); }
      }
      v.pulsos = v.pulsos.filter((p) => (p.t += dt) < 2.2);
      for (const p of v.pulsos) {
        const k = p.t / 2.2, raio = (1.7 + k * 5.5) * T;
        g.strokeStyle = `rgba(110,220,255,${0.55 * (1 - k)})`; g.lineWidth = 3 * (1 - k) + 1;
        g.beginPath(); g.ellipse(cx, cy, raio, raio / 1.15, 0, 0, Math.PI * 2); g.stroke();
      }
      // runas girando no círculo da praça (e um anel de dentro girando ao contrário)
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 6.28 + agora * 0.12, x = cx + Math.cos(a) * 4.35 * T, y = cy + Math.sin(a) * 4.35 * T, brilho = 0.45 + 0.4 * Math.sin(agora * 2 + k);
        g.fillStyle = `rgba(150,235,255,${brilho})`; g.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 4); g.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 2);
      }
      for (let k = 0; k < 12; k++) {
        const a = -(k / 12) * 6.28 - agora * 0.25, x = cx + Math.cos(a) * 2.2 * T, y = cy + Math.sin(a) * 2.05 * T;
        g.fillStyle = `rgba(255,220,120,${0.4 + 0.35 * Math.sin(agora * 3 + k)})`; g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
      // pombas ciscando na praça
      v.pombas ??= Array.from({ length: 7 }, (_, k) => { const a = k * 0.9 + 0.4, d = (3 + (k % 3)) * T; return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.9 + T, cor: k % 3 ? '#b8b8c0' : '#f0f0f0', fase: k, voando: 0, alt: 0 }; });
      const dp = this.pos(this.darius);
      for (const b of v.pombas) {
        const dx = b.x - (dp.px + 16), dy = b.y - (dp.py + 28), perto = Math.hypot(dx, dy) < 1.6 * T;
        if (perto && !b.voando) { b.voando = 1; b.vx = (dx >= 0 ? 1 : -1) * (40 + r() * 30); b.vy = -30; }
        if (b.voando) {
          b.x += b.vx * dt; b.alt += 55 * dt; b.voando += dt;
          if (b.voando > 4) { const a = r() * 6.28, d = (3 + r() * 2.5) * T; b.x = cx + Math.cos(a) * d; b.y = cy + Math.sin(a) * d * 0.9 + T; b.voando = 0; b.alt = 0; }
          continue;
        }
        b.fase += dt;
        if (Math.sin(b.fase * 0.7) > 0.6) b.x += Math.sin(b.fase * 2) * 3 * dt;       // anda um pouquinho
        const bica = Math.sin(b.fase * 7) > 0.5, x = Math.round(b.x), y = Math.round(b.y);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 2, y + 2, 5, 1);
        g.fillStyle = b.cor; g.fillRect(x - 2, y - 1, 4, 3); g.fillRect(x + (bica ? 1 : 1), y - (bica ? 1 : 3), 2, 2);
        g.fillStyle = '#6a6a74'; g.fillRect(x - 3, y, 1, 1); g.fillStyle = '#e88a40'; g.fillRect(x + 3, y - (bica ? 0 : 2), 1, 1);
      }
      return;
    }
    // céu: pombas voando, pétalas, raios de sol e sombras de nuvens (por cima de tudo)
    for (const b of v.pombas || []) if (b.voando) {
      const x = Math.round(b.x), y = Math.round(b.y - b.alt), asa = Math.sin(agora * 18 + b.fase) > 0;
      g.fillStyle = b.cor; g.fillRect(x - 2, y, 4, 2); g.fillRect(x - 4, y - (asa ? 2 : -1), 3, 1); g.fillRect(x + 2, y - (asa ? 2 : -1), 3, 1);
    }
    const W = VIS_L * T, H = VIS_A * T, cam = this.cam;
    if (v.petalas.length < 14 && r() < 0.08) v.petalas.push({ x: cam.x + r() * W, y: cam.y - 6, vx: 10 + r() * 10, vy: 12 + r() * 8, f: r() * 6, cor: r() < 0.6 ? '#ffc8dc' : '#ffffff' });
    v.petalas = v.petalas.filter((p) => { p.x += (p.vx + Math.sin(agora * 2 + p.f) * 12) / 60; p.y += p.vy / 60; return p.y < cam.y + H + 8; });
    for (const p of v.petalas) { g.fillStyle = p.cor; g.fillRect(Math.round(p.x), Math.round(p.y), Math.sin(agora * 5 + p.f) > 0 ? 2 : 1, 1); }
    if ((this.luz ?? 1) > 0.6) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {                       // raios de sol inclinados, respirando devagar
        const x = cam.x + W * (0.15 + k * 0.32) + Math.sin(agora * 0.2 + k) * 20, a = 0.05 + 0.03 * Math.sin(agora * 0.6 + k * 2);
        const gr = g.createLinearGradient(x, cam.y, x + 90, cam.y + H); gr.addColorStop(0, `rgba(255,240,200,${a})`); gr.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x, cam.y); g.lineTo(x + 46, cam.y); g.lineTo(x + 140, cam.y + H); g.lineTo(x + 80, cam.y + H); g.fill();
      }
      g.restore();
    }
    for (let k = 0; k < 2; k++) {                         // sombras de nuvens atravessando a praça
      const x = cam.x + ((agora * 8 + k * 330) % (W + 300)) - 150, y = cam.y + H * (0.3 + k * 0.4);
      const gr = g.createRadialGradient(x, y, 10, x, y, 120); gr.addColorStop(0, 'rgba(10,20,40,0.12)'); gr.addColorStop(1, 'rgba(10,20,40,0)');
      g.save(); g.translate(x, y); g.scale(1, 0.5); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - 120, y - 120, 240, 240); g.restore();
    }
  }
  // os peixes ficam debaixo d'água: desenhados logo depois do chão, antes dos objetos e dos bonecos
  desenharPeixes(g) {
    for (const b of this.bichosVivos || []) {
      if (b.tipo !== 'peixe') continue;
      const some = Math.min(1, b.t / 1.5, (b.vida - b.t) / 1.5), c = Math.cos(b.ang), s = Math.sin(b.ang) * 0.6, n = Math.hypot(c, s), dx = c / n, dy = s / n;
      const rabo = Math.sin(this.tempo * 10 + b.vida) * 1.2;
      g.globalAlpha = Math.max(0, some); g.fillStyle = b.cor;
      // corpo mais grosso no meio, afinando para o rabo, que abana
      for (let k = 0; k <= b.tam; k++) {
        const f = k / b.tam, gros = f < 0.15 ? 2 : f < 0.65 ? 3 : 2, x = b.x - dx * k, y = b.y - dy * k;
        g.fillRect(Math.round(x - Math.abs(dy) * (gros - 1) / 2), Math.round(y - Math.abs(dx) * (gros - 1) / 2), 1 + Math.round(Math.abs(dy) * (gros - 1)), 1 + Math.round(Math.abs(dx) * (gros - 1)));
      }
      const xr = b.x - dx * (b.tam + 2), yr = b.y - dy * (b.tam + 2);
      g.fillRect(Math.round(xr - dy * (2 + rabo)), Math.round(yr + dx * (2 + rabo)), 2, 2); g.fillRect(Math.round(xr + dy * (2 - rabo)), Math.round(yr - dx * (2 - rabo)), 2, 2);
      if (b.onda > 0) {          // ondinha na superfície
        const raio = (1 - b.onda / 0.9) * 7 + 1;
        g.strokeStyle = `rgba(220,245,255,${b.onda * 0.7})`; g.lineWidth = 1;
        g.beginPath(); g.ellipse(Math.round(b.x), Math.round(b.y), raio, raio * 0.5, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  desenharBichos(g) {
    for (const b of this.bichosVivos || []) {
      if (b.tipo === 'peixe') continue;
      const x = Math.round(b.x), y = Math.round(b.y), some = Math.min(1, b.t, b.vida - b.t);
      g.globalAlpha = Math.max(0, some);
      if (b.tipo === 'borboleta') {
        const aberta = Math.sin(this.tempo * 16 + b.fase) > 0;
        g.fillStyle = '#2a2020'; g.fillRect(x, y, 1, 2);
        g.fillStyle = b.cor;
        if (aberta) { g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 2, 2); g.fillRect(x - 1, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); }
        else { g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 1, 1, 2); }
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + 6, 2, 1);
      } else {
        const asa = Math.sin(this.tempo * 40) > 0;
        g.fillStyle = '#1a8a8a'; g.fillRect(x - 2, y, 5, 1); g.fillStyle = '#4ae0d0'; g.fillRect(x - 2, y, 2, 1);
        g.fillStyle = asa ? 'rgba(220,240,255,0.85)' : 'rgba(220,240,255,0.45)'; g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); g.fillRect(x - 1, y - 2, 1, 1); g.fillRect(x - 1, y + 2, 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  // no mundo aberto: o bioma da zona onde o campeão está (cidade = base)
  biomaAqui() {
    const d = this.darius, x = d.x + 0.5, y = d.y + 0.875;
    if (cidadeEm(x, y)) return 'base';
    return { 'rota-inf': 'rota', 'rota-sup': 'rota', lobos: 'selva', azul: 'selva', vermelho: 'selva', rio: 'rio', dragao: 'rio', barao: 'barao' }[zonaEm(x, y)] || 'rota';
  }
  // faíscas na bigorna do Ornn, estrelinhas subindo da reza da Soraka, a moeda do Lojista brilhando no alto
  efeitosNpc(dt) {
    for (const n of this.npcs || []) {
      if (!ACAO_NPC[n.nome] || n.dir !== DIR.S) continue;
      const q = n.quadroAcao, mudou = q !== n.quadroAnt; n.quadroAnt = q;
      const { px, py } = this.pos(n);
      if (n.nome === 'Ornn' && estiloNovoLigado() && Math.random() < 0.025) {        // vapor saindo da bigorna
        this.fx.add({ x: px - 32 + 51 + (Math.random() - 0.5) * 8, y: py - 32 + 40, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 8, cor: '#d8d8e0', vida: 1.4, tam: 2.4, encolhe: true });
      }
      if (n.nome === 'Ornn' && mudou && q === 12) {
        const x = px - 32 + 51, y = py - 32 + 42;
        this.fx.explosao(x, y, { qtd: 10, vel: 120, cor: ['#ffd060', '#ff8a20', '#fff4c0'], brilho: true, grav: 280, vida: 0.5, tam: 1.1, ang: -Math.PI / 2, abertura: 2.8, forma: 'faisca' });
        this.fx.luz(x, y, 24, '#ff8a20', 0.25);
      } else if (n.nome === 'Soraka') {
        n.estrelaT = (n.estrelaT || 0) - dt;
        if (n.estrelaT <= 0) {
          n.estrelaT = 0.28;
          this.fx.add({ x: px + 6 + Math.random() * 20, y: py + 24, vy: -12 - Math.random() * 10, cor: Math.random() < 0.5 ? '#fff4b0' : '#c8e8ff', brilho: true, forma: 'estrela', vida: 1.6, tam: 1.2, balanco: 6, fase: Math.random() * 6, encolhe: true });
        }
      } else if (n.nome === 'Lojista' && mudou && q === 12) {
        this.fx.add({ x: px + 22.5, y: py + 3, cor: '#fff6c0', brilho: true, forma: 'estrela', vida: 0.45, tam: 1.5, encolhe: true });
      }
    }
  }
  // balão de conversa em cima do NPC que está com o mouse em cima
  desenharBalaoNpc(g) {
    const n = this.npcFoco;
    if (!n || !this.npcs?.includes(n)) return;
    const { px, py } = this.pos(n), base = Math.round(py - (n.grande ? 40 : 12));
    const txt = t(FALA_NPC[n.nome] || 'Olá!'), dica = t('clique para conversar');
    g.font = `bold 7px ${FONTE}`; const w1 = g.measureText(txt).width;
    g.font = `6px ${FONTE}`; const w2 = g.measureText(dica).width;
    const w = Math.ceil(Math.max(w1, w2)) + 12, h = 21, y = base - h - 5;
    const centro = Math.round(px + 16), x = Math.max(Math.round(this.cam.x) + 2, Math.min(Math.round(this.cam.x + VIS_L * T) - w - 3, centro - Math.round(w / 2)));
    const cx = Math.max(x + 6, Math.min(x + w - 6, centro));
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(x + 1.5, y + 1.5, w, h, 4); g.fill();
    g.fillStyle = '#fbf6e8'; g.strokeStyle = '#2a2018'; g.lineWidth = 1;
    g.beginPath(); g.roundRect(x + 0.5, y + 0.5, w, h, 4); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(cx - 3.5, y + h + 0.5); g.lineTo(cx, y + h + 5.5); g.lineTo(cx + 3.5, y + h + 0.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx - 3.5, y + h + 0.5); g.lineTo(cx, y + h + 5.5); g.lineTo(cx + 3.5, y + h + 0.5); g.stroke();
    g.fillStyle = '#fbf6e8'; g.fillRect(cx - 3, y + h - 0.5, 6, 1.5);
    g.textAlign = 'center';
    const meio = x + w / 2;
    g.font = `bold 7px ${FONTE}`; g.fillStyle = '#2a2018'; g.fillText(txt, meio, y + 9.5);
    g.font = `6px ${FONTE}`; g.fillStyle = '#9a6a2a'; g.fillText(dica, meio, y + 17.5);
    g.restore();
  }
  efeito(tipo, c, dur, cor) { this.efeitos.push({ tipo, c, dur, cor, t: 0, alvo: c === this.darius ? null : c, ...this.pos(c) }); }
  mancha(c) { const { px, py } = this.pos(c); this.manchas.push({ x: px + 8 + Math.random() * 14, y: py + 18 + Math.random() * 8, t: 0, f: Math.random() }); if (this.manchas.length > 40) this.manchas.shift(); }

  atualizar(dt) {
    this.tempo += dt;
    if (!this.mapa) return;
    if (this.local?.dungeon) this.nevar(dt);
    this.andar(this.darius, dt);
    for (const c of this.criaturas.values()) this.andar(c, dt);
    if (this.pet) { this.andar(this.pet, dt); if (this.arena) this.guiarMascoteArena(dt); else this.guiarMascote(); }
    if (this.arena) { this.suavizarArena(dt); for (const o of this.jogArena.values()) this.andar(o, dt); for (const v of this.monsOutros.values()) this.andar(v, dt); }
    for (const o of this.outros?.values() || []) this.andar(o, dt);
    if (this.aoChegar && !this.darius.fila.length && this.darius.t >= 1) {
      const { npc, f } = this.aoChegar; this.aoChegar = null; this.olhar(this.darius, npc); f();
    }
    this.curaT += dt;
    if (this.curaT > 0.9) { if (this.curaAcum >= 8 && !this.morto) this.texto(this.darius, '+' + fmt(this.curaAcum), '#40e060', 0.9); this.curaAcum = 0; this.curaT = 0; }
    const envelhecer = (l, dur) => l.filter((o) => (o.t += dt) < (o.dur ?? dur));
    this.textos = envelhecer(this.textos, 1.1);
    this.efeitos = envelhecer(this.efeitos);
    this.corpos = envelhecer(this.corpos);
    this.manchas = envelhecer(this.manchas, 8);
    this.atualizarMoedas(dt);
    this.fx.atualizar(dt);
    for (const a of this.agenda) a.t -= dt;
    const prontos = this.agenda.filter((a) => a.t <= 0);
    this.agenda = this.agenda.filter((a) => a.t > 0);
    for (const a of prontos) a.f();
    this.comCoresDaSkin(() => this.auras(dt));
    if (!this.leve) { this.ambiente(dt); this.bichos(dt); }
    this.efeitosNpc(dt);
    this.baloes = envelhecer(this.baloes, 2.2);
    this.conversas = envelhecer(this.conversas || []);
    this.avisos = envelhecer(this.avisos, 3);
    this.tremor = Math.max(0, this.tremor - dt);
    this.flash = Math.max(0, (this.flash || 0) - dt);
    this.escuro = Math.max(0, (this.escuro || 0) - dt); if (!this.escuro) this.corEscuro = null;
  }

  // onde a câmera fica com o campeão no meio da tela (para soltar a câmera e para o Espaço voltar a ele)
  camNoCampeao() { const dp = this.pos(this.darius); return { x: dp.px - ((VIS_L - 1) / 2) * T, y: dp.py - ((VIS_A - 1) / 2) * T }; }
  // ---------- desenho ----------
  desenhar() {
    const g = this.g, m = this.mapa;
    g.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000'; g.fillRect(0, 0, VIS_L * T, VIS_A * T);
    if (!m) return;
    const dp = this.pos(this.darius);
    let cx = dp.px - ((VIS_L - 1) / 2) * T, cy = dp.py - ((VIS_A - 1) / 2) * T;      // campeão no meio da tela
    const livre = this.camLivre && m.mundo;
    if (livre) { cx = this.camLivre.x; cy = this.camLivre.y; }      // câmera solta (tecla Y, só em Runeterra)
    cx = Math.max(0, Math.min(m.larg * T - VIS_L * T, cx)); cy = Math.max(0, Math.min(m.alt * T - VIS_A * T, cy));
    if (livre) { this.camLivre.x = cx; this.camLivre.y = cy; }
    if (this.tremor > 0) { cx += (Math.random() - 0.5) * 6; cy += (Math.random() - 0.5) * 6; }
    cx = Math.round(cx * ESCALA) / ESCALA; cy = Math.round(cy * ESCALA) / ESCALA;
    this.cam = { x: cx, y: cy };
    g.save(); g.translate(-cx, -cy);

    if (m.desenharChao) m.desenharChao(g, cx, cy, VIS_L * T, VIS_A * T);      // Runeterra: o chão fica em pedaços
    if (m.mundo) this.desenharZonasPk(g, cx, cy);
    else g.drawImage(m.img, cx, cy, VIS_L * T, VIS_A * T, cx, cy, VIS_L * T, VIS_A * T);
    const tx0 = Math.floor(cx / T), ty0 = Math.floor(cy / T), tx1 = tx0 + VIS_L + 2, ty1 = ty0 + VIS_A + 2;

    // brilho da água
    g.fillStyle = 'rgba(190,225,255,0.55)';
    if (m.bioma !== 'base') for (const [x, y] of aguaEm(m, tx0 - 1, ty0 - 1, tx1, ty1)) {      // só as águas da tela (p611)
      if (x < tx0 - 1 || x > tx1 || y < ty0 - 1 || y > ty1) continue;
      for (let k = 0; k < 2; k++) {
        const h = (x * 73 + y * 31 + k * 17) % 97;
        const ox = (h + this.tempo * (6 + k * 3)) % 26, oy = 6 + ((h * 7) % 20);
        g.fillRect(x * T + 3 + ox, y * T + oy, 3, 1);
      }
    }
    if (!this.leve) {
      this.desenharPeixes(g);
      if (m.novo && m.bioma === 'base') this.vidaFonte(g, 'chao');
      else if (m.novo && (m.mundo || RIFT_VIVO.has(m.bioma))) this.vidaRota(g, 'chao');
    }
    // sangue no chão
    for (const s of this.manchas) {
      g.globalAlpha = Math.min(1, (8 - s.t) / 2) * 0.8;
      g.fillStyle = '#7a0a0a'; g.fillRect(s.x, s.y, 4, 2); g.fillRect(s.x + 1, s.y - 1, 2, 4);
      g.fillStyle = '#a01414'; g.fillRect(s.x + (s.f > 0.5 ? 4 : -2), s.y + 2, 2, 1);
    }
    g.globalAlpha = 1;
    for (const c of this.corpos) {
      g.globalAlpha = Math.min(1, (c.dur - c.t) / 1.5);
      const o = c.grande ? 32 : 0, ex = c.img.width - (c.grande ? 64 : 32);
      g.drawImage(c.img, c.x * T - o - ex / 2, c.y * T - o - ex);
    }
    g.globalAlpha = 1;
    this.desenharMoedas(g);
    this.desenharGuardiao(g);
    this.desenharChaoZac(g);

    // chão em chamas depois do sopro do Dragão
    if (this.queimando > 0 && this.fogo) {
      for (let k = 0; k < 9; k++) {
        const tx = this.fogo.x - 1 + (k % 3), ty = this.fogo.y - 1 + Math.floor(k / 3);
        for (let f = 0; f < 3; f++) {
          const fase = (this.tempo * 3 + k * 0.37 + f * 0.33) % 1;
          g.globalAlpha = Math.min(1, this.queimando / 1.5) * (1 - fase);
          g.fillStyle = f === 0 ? '#ffe060' : f === 1 ? '#ff8a20' : '#d83010';
          g.fillRect(tx * T + 6 + ((k * 7 + f * 9) % 20), ty * T + 26 - fase * 14, 3, 4);
        }
      }
      g.globalAlpha = 1;
    }
    // Mão do Barão: aura roxa
    if (this.barao && !this.morto) {
      g.strokeStyle = `rgba(190,100,255,${0.5 + 0.3 * Math.sin(this.tempo * 5)})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(dp.px + 16, dp.py + 27, 16, 6, 0, 0, Math.PI * 2); g.stroke();
    }
    // Estandarte de Noxus fincado ao lado do Darius
    if (this.estandarte > 0 && this.estandartePos) {
      const ep = this.estandartePos;
      g.fillStyle = this.corSkin(this.atirador ? `rgba(255,200,80,${0.12 + 0.08 * Math.sin(this.tempo * 4)})` : `rgba(255,80,60,${0.12 + 0.08 * Math.sin(this.tempo * 4)})`);      // o brilho no chão com as cores da skin
      g.beginPath(); g.ellipse(ep.x * T + 16, ep.y * T + 26, 40, 16, 0, 0, Math.PI * 2); g.fill();
      const queda = this.quedaB > 0 ? this.quedaB * 90 : 0;
      const filtroB = !this.maga && !this.atirador && this.mapaSkin?.filtroEstandarte;      // a bandeira no tom da skin
      if (filtroB) { g.save(); g.filter = filtroB; }
      g.drawImage(this.maga ? spriteFarol() : this.atirador ? spriteReliquia() : spriteEstandarte(), ep.x * T + 4, ep.y * T - (this.maga ? 12 : this.atirador ? 4 : 18) - queda);
      if (filtroB) g.restore();
      if (this.maga) {         // o cristal do farol pulsa e solta luz
        const pul = 0.5 + 0.5 * Math.sin(this.tempo * 4), fx0 = ep.x * T + 16, fy0 = ep.y * T - 6 - queda;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 + 0.35 * pul; g.drawImage(halo(this.corSkin('#ff9ae0')), fx0 - 18, fy0 - 18, 36, 36); g.restore();
        if (Math.random() < 0.3) this.fx.add({ x: fx0 + (Math.random() - 0.5) * 8, y: fy0, vx: (Math.random() - 0.5) * 16, vy: -20 - Math.random() * 20, cor: Math.random() < 0.5 ? '#ff9ae0' : '#fff0a0', brilho: true, forma: 'estrela', vida: 0.8, tam: 1.4, encolhe: true });
      }
    }
    // Grito de Guerra: anel alaranjado; Fúria Sanguinária: gotas subindo
    if (this.grito && !this.morto) {
      g.strokeStyle = this.maga ? `rgba(255,236,150,${0.5 + 0.3 * Math.sin(this.tempo * 8)})` : `rgba(255,150,40,${0.5 + 0.3 * Math.sin(this.tempo * 8)})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(dp.px + 16, dp.py + 26, 14, 5, 0, 0, Math.PI * 2); g.stroke();
    }
    if (this.furiaS && !this.morto) for (let i = 0; i < 5; i++) {
      const f = (this.tempo * 1.2 + i / 5) % 1;
      g.fillStyle = '#c01020'; g.globalAlpha = 1 - f;
      g.fillRect(dp.px + 8 + ((i * 7) % 16), dp.py + 22 - f * 30, 2, 3);
      g.globalAlpha = 1;
    }
    // recall: círculo azul que fecha em volta do Darius, como o "B" do LoL
    if (this.recall > 0 && !this.morto) {
      const k = 1 - this.recall / 4;
      g.strokeStyle = 'rgba(120,200,255,0.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(dp.px + 16, dp.py + 26, 18 - k * 6, 7 - k * 2, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(120,200,255,${0.15 + 0.25 * k})`; g.fillRect(dp.px + 6, dp.py - 30 + 30 * (1 - k), 20, 56 - 30 * (1 - k));
      for (let i = 0; i < 6; i++) { const f = (this.tempo * 0.8 + i / 6) % 1; g.fillStyle = '#c8f0ff'; g.fillRect(dp.px + 8 + ((i * 37) % 16), dp.py + 24 - f * 50, 2, 2); }
    }
    // aura da Hemorragia no máximo
    if (this.poder && !this.morto) {
      const pul = 0.5 + 0.5 * Math.sin(this.tempo * 10);
      g.fillStyle = `rgba(220,30,30,${0.25 + 0.2 * pul})`;
      g.beginPath(); g.ellipse(dp.px + 16, dp.py + 26, 13 + pul * 2, 5, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 10; i++) {          // labaredas vermelhas subindo em volta
        const f = (this.tempo * 1.6 + i / 10) % 1, ang = (i / 10) * Math.PI * 2;
        g.globalAlpha = 1 - f; g.fillStyle = f < 0.3 ? '#ffd060' : f < 0.6 ? '#ff4a20' : '#a01010';
        g.fillRect(Math.round(dp.px + 16 + Math.cos(ang) * 12), Math.round(dp.py + 26 + Math.sin(ang) * 4 - f * 22), 2, 3);
      }
      g.globalAlpha = 1;
    }

    // objetos e criaturas, linha por linha (quem está embaixo cobre quem está em cima)
    const porLinha = new Map();
    const todos = [...this.criaturas.values(), ...this.npcs];
    if (!this.morto) todos.push(this.darius);
    if (this.pet && !this.morto) todos.push(this.pet);
    for (const o of this.outros?.values() || []) if (!o.oculto) todos.push(o);
    if (this.arena) { for (const o of this.jogArena.values()) todos.push(o); for (const v of this.monsOutros.values()) todos.push(v); }
    for (const c of todos) {
      c.ultimoDesenho = null;
      const ly = Math.round(Math.max(c.y, c.de.y));
      if (!porLinha.has(ly)) porLinha.set(ly, []);
      porLinha.get(ly).push(c);
    }
    for (let y = ty0; y <= ty1 && y < m.alt; y++) {
      for (let x = Math.max(0, tx0 - 2); x <= tx1 && x < m.larg; x++) {
        const o = m.obj[y]?.[x];
        if (o?.bau && (this.bausAbertos.get(y * 1000 + x) || 0) > Date.now()) g.drawImage(o.aberto || o.img, x * T - (o.ox ?? (o.alto ? 32 : 0)), y * T - (o.oy ?? (o.alto ? 32 : 0)));
        else if (o) g.drawImage(o.quadros ? o.quadros[Math.floor(this.tempo * o.fps + x * 0.37 + y * 0.61) % o.quadros.length] : o.img, x * T - (o.ox ?? (o.alto ? 32 : 0)), y * T - (o.oy ?? (o.alto ? 32 : 0)));
      }
      const lista = porLinha.get(y);
      if (lista) for (const c of lista.sort((a, b) => a.x - b.x)) this.desenharCriatura(g, c);
    }
    // atrás de uma árvore ou casa: o boneco aparece em transparência por cima dela (onde nada o cobre, nada muda)
    for (const c of todos) {
      const u = c.ultimoDesenho; if (!u || c.npc) continue;
      g.globalAlpha = (c === this.darius ? 0.45 : 0.3) * u.alfa; g.drawImage(u.s, u.X, u.Y);
    }
    g.globalAlpha = 1;
    this.desenharBichos(g);
    if (!this.leve && m.novo && m.bioma === 'base') this.vidaFonte(g, 'ceu');
    else if (!this.leve && m.novo && (m.mundo || RIFT_VIVO.has(m.bioma))) this.vidaRota(g, 'ceu');

    if (this.arena) {
      const alvo = this.alvoPvp && this.jogArena.get(this.alvoPvp);
      if (alvo) { const p = this.pos(alvo); g.strokeStyle = `rgba(255,40,40,${0.6 + 0.3 * Math.sin(this.tempo * 8)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p.px + 16, p.py + 28, 13, 5, 0, 0, Math.PI * 2); g.stroke(); }
      this.desenharComandos(g, 1 / 60);
      this.desenharProjeteis(g);
    } else if (m.bioma === 'base') this.desenharDestinoFonte(g, 1 / 60);
    if (this.adagasK?.size) this.desenharAdagas(g);
    this.desenharAdagasOutros(g);
    for (const e of this.efeitos) {
      if (e.skinMapa) {      // efeito de outro jogador com skin: desenha com o mapa dele (e devolve o seu)
        const meu = this.mapaSkin; this.mapaSkin = e.skinMapa; this.fx.mapa = e.skinMapa;
        try { this.desenharEfeito(this.tingidoDe(e.skinMapa), e); } finally { this.fx.mapa = null; this.mapaSkin = meu; }
      } else if (e.skin && this.gTingido) { this.fx.mapa = this.mapaSkin; this.desenharEfeito(this.gTingido, e); this.fx.mapa = null; }
      else this.desenharEfeito(g, e);
    }
    this.fx.desenhar(g, 'base');
    if (!this.local?.dungeon) this.desenharNoite(g, cx, cy, dp, tx0, ty0, tx1, ty1);      // no alto da montanha é sempre dia (p670)
    this.fx.desenhar(g, 'brilho');

    // nomes e barras por cima de tudo, como no cliente
    for (const c of todos) this.desenharNome(g, c);
    for (const tx of this.textos) {
      if (tx.t < 0) continue;
      const k = tx.t / 1.1;
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      const pulo = k < 0.12 ? 1 + (0.12 - k) * (tx.tam > 1.2 ? 9 : 5) : 1;
      const y = tx.y - 4 - (1 - (1 - k) * (1 - k)) * 28;
      escrever(g, tx.txt, tx.x + tx.dx, y, `bold ${Math.round(7 * tx.tam * pulo)}px ${FONTE}`, tx.cor, 1.2);      // o número vira imagem (vive ~1 s)
    }
    g.globalAlpha = 1;
    const ocupado = [];        // balões já desenhados: o próximo que cruzar com um deles sobe para cima
    for (const f of [...this.conversas].sort((a, b) => b.t - a.t)) {
      const vivo = f.c === this.darius ? !this.morto : [...(this.outros?.values() || [])].includes(f.c) || [...(this.jogArena?.values() || [])].includes(f.c);
      if (!vivo) continue;
      const { px, py } = this.pos(f.c);
      if (!f.linhas) {           // quebra o texto em linhas de até ~120 px
        g.font = `bold 6.5px ${FONTE}`;
        f.linhas = [];
        let linha = '';
        for (const p of f.txt.split(' ')) {
          const tenta = linha ? linha + ' ' + p : p;
          if (g.measureText(tenta).width > 120 && linha) { f.linhas.push(linha); linha = p; } else linha = tenta;
        }
        if (linha) f.linhas.push(linha);
        f.linhas = f.linhas.slice(0, 5);
      }
      g.globalAlpha = f.t > f.dur - 0.5 ? Math.max(0, (f.dur - f.t) / 0.5) : 1;
      let base = py - 13, topo = base - 7 - f.linhas.length * 7;
      for (const o of ocupado) if (Math.abs(o.x - px) < 110 && topo < o.base && base > o.topo) { base = o.topo - 2; topo = base - 7 - f.linhas.length * 7; }
      ocupado.push({ x: px, topo: topo - 6, base });
      escrever(g, f.nome + ':', px + 16, topo, `bold 6.5px ${FONTE}`, '#f0e060', 1.4);
      f.linhas.forEach((l, i) => escrever(g, l, px + 16, topo + 7 * (i + 1), `bold 6.5px ${FONTE}`, '#f0e060', 1.4));
      g.globalAlpha = 1;
    }
    this.desenharBalaoNpc(g);
    for (const b of this.baloes) {
      if (b.c !== this.darius && !this.criaturas.has(b.c.id)) continue;
      const { px, py } = this.pos(b.c);
      escrever(g, b.txt, px + 16, py - 16, `bold 6.5px ${FONTE}`, b.cor, 1.2);
    }
    g.restore();

    if (!this.morto && this.darius && this.darius.vida > 0 && this.darius.vida < 0.3) {     // pouca vida: as bordas pulsam em vermelho
      const k = (0.3 - this.darius.vida) / 0.3, pul = 0.6 + 0.4 * Math.sin(this.tempo * (4 + k * 4));
      const W = VIS_L * T, H = VIS_A * T, gr = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.62);
      gr.addColorStop(0, 'rgba(160,0,0,0)'); gr.addColorStop(1, `rgba(160,0,0,${(0.25 + 0.35 * k) * pul})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) { g.fillStyle = `rgba(${this.corFlash || '200,0,0'},${Math.min(0.5, this.flash * 1.2)})`; g.fillRect(0, 0, VIS_L * T, VIS_A * T); }
    if (this.escuro > 0) {
      const gr = g.createRadialGradient((VIS_L * T) / 2, (VIS_A * T) / 2, 40, (VIS_L * T) / 2, (VIS_A * T) / 2, 280);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(${this.corEscuro || '40,0,0'},${Math.min(0.85, this.escuro * 1.4)})`);      // o escurecimento de cinema dos golpes finais
      g.fillStyle = gr; g.fillRect(0, 0, VIS_L * T, VIS_A * T);
    }
    if (this.arena && this.arenaPausado && !this.morto) {
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, VIS_A * T * 0.16, VIS_L * T, 34);
      g.font = `bold 10px ${FONTE}`; g.textAlign = 'center'; g.lineWidth = 1.5; g.strokeStyle = '#000'; g.fillStyle = '#ffe080';
      g.strokeText(t('Parado'), (VIS_L * T) / 2, VIS_A * T * 0.16 + 14); g.fillText(t('Parado'), (VIS_L * T) / 2, VIS_A * T * 0.16 + 14);
      g.font = `7px ${FONTE}`; g.fillStyle = '#e0dacf';
      const volta = t('Clique com o botão direito para voltar a caçar');
      g.strokeText(volta, (VIS_L * T) / 2, VIS_A * T * 0.16 + 26); g.fillText(volta, (VIS_L * T) / 2, VIS_A * T * 0.16 + 26);
    }
    if (m.mini && this.verMinimapa !== false) this.desenharMinimapa(g);
    if (this.arena || this.local?.dungeon) this.desenharBarraChefe(g); else this.mostrarRankingVm?.(null);
    if (this.viagem && !this.morto) this.desenharViagem(g);
    for (const a of this.avisos) {
      g.globalAlpha = a.t > 2.3 ? (3 - a.t) / 0.7 : 1;
      g.font = `bold 9px ${FONTE}`; g.textAlign = 'center'; g.lineWidth = 1.5; g.strokeStyle = '#000'; g.fillStyle = a.cor;
      g.strokeText(a.txt, (VIS_L * T) / 2, VIS_A * T * 0.3); g.fillText(a.txt, (VIS_L * T) / 2, VIS_A * T * 0.3);
    }
    g.globalAlpha = 1;
  }

  // minimapa de Runeterra (canto de cima, à direita): o mundo inteiro, você e os outros jogadores
  // pisão do guardião (a área enche de vermelho até o golpe), ondas de choque e as chaves caídas no chão
  desenharGuardiao(g) {
    const dt = 1 / 60;
    this.pisoes = this.pisoes.filter((p) => (p.t += dt) < p.dur);
    for (const p of this.pisoes) {
      const k = p.t / p.dur, x = p.x * T, y = p.y * T, rx = p.raio * T, ry = p.raio * T * 0.6;
      g.fillStyle = `rgba(${p.rgb || '255,40,20'},${0.12 + 0.1 * k})`; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(${p.rgb || '255,60,30'},${0.25 + 0.2 * k})`; g.beginPath(); g.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = p.rgb ? `rgba(${p.rgb},0.95)` : `rgba(255,${120 - 80 * k},60,0.9)`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    }
    this.ondas = this.ondas.filter((o) => (o.t += dt) < 0.45);
    for (const o of this.ondas) {
      const k = o.t / 0.45, x = o.x * T, y = o.y * T;
      g.strokeStyle = `rgba(255,230,180,${1 - k})`; g.lineWidth = 3 * (1 - k) + 1;
      g.beginPath(); g.ellipse(x, y, o.raio * T * (0.4 + k), o.raio * T * 0.6 * (0.4 + k), 0, 0, Math.PI * 2); g.stroke();
    }
    // sacos de quem morreu: um saco de couro amarrado no chão, com um brilho; o seu tem a seta e o nome em azul
    for (const s of this.sacos.values()) {
      const x = Math.round(s.x * T), y = Math.round(s.y * T), meu = s.dono === this.nomeJogador;
      if (x < this.cam.x - 40 || x > this.cam.x + VIS_L * T + 40 || y < this.cam.y - 40 || y > this.cam.y + VIS_A * T + 40) continue;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.15 * Math.sin(this.tempo * 3 + s.id); g.drawImage(halo(meu ? '#6ab8ff' : '#ffd040'), x - 14, y - 16, 28, 28); g.restore();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y + 1, 7, 2.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a120a'; g.beginPath(); g.ellipse(x, y - 4, 7, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6a4424'; g.beginPath(); g.ellipse(x, y - 4, 6, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a5c34'; g.beginPath(); g.ellipse(x - 1.5, y - 5.5, 3.5, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a381c'; g.fillRect(x - 2, y - 11, 4, 3); g.fillStyle = '#c9a050'; g.fillRect(x - 3, y - 9, 6, 1);
      g.fillStyle = '#3a2412'; g.fillRect(x - 3, y - 13, 2, 2); g.fillRect(x + 1, y - 13, 2, 2);
      if (Math.random() < 0.06) this.fx.add({ x: x + (Math.random() - 0.5) * 10, y: y - 6, vy: -10, cor: meu ? '#bfe8ff' : '#fff0a0', brilho: true, forma: 'estrela', vida: 0.6, tam: 1.2, encolhe: true });
      const d = this.darius, perto = Math.hypot(d.x + 0.5 - s.x, d.y + 0.875 - s.y) < 6;
      if (perto || meu) {
        const txt = meu ? t('Seu saco ({n})', { n: s.itens.length }) : t('Saco de {nome} ({n})', { nome: s.dono, n: s.itens.length });
        g.font = `bold 6px ${FONTE}`; g.textAlign = 'center'; g.lineWidth = 1.2; g.strokeStyle = '#000'; g.fillStyle = meu ? '#8ad0ff' : '#ffd860';
        g.strokeText(txt, x, y - 16); g.fillText(txt, x, y - 16);
        if (meu) { const b = Math.sin(this.tempo * 5) * 1.5; g.fillStyle = '#8ad0ff'; g.beginPath(); g.moveTo(x - 3, y - 26 + b); g.lineTo(x + 3, y - 26 + b); g.lineTo(x, y - 22 + b); g.fill(); }
      }
    }
    // a chave do baú gira no ar em cima do corpo do guardião, brilhando, até alguém passar por cima
    for (const c of this.estadoArena?.chaves || []) {
      const x = Math.round(c.x * T), y = Math.round(c.y * T - 22 + Math.sin(this.tempo * 3) * 2);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + 0.2 * Math.sin(this.tempo * 5); g.drawImage(halo('#ffd040'), x - 18, y - 16, 36, 36); g.restore();
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, c.y * T + 2, 6 * Math.abs(Math.cos(this.tempo * 3.5)) + 2, 2, 0, 0, Math.PI * 2); g.fill();
      // chave dourada girando (achata na largura como se desse a volta) com argola, haste e dentes
      // cada fortaleza tem a sua chave (iconeChave em pixel.js); ela gira achatando na largura
      const giro = Math.cos(this.tempo * 3.5), w = Math.max(0.15, Math.abs(giro)), icone = iconeChave(mundoLogico().fortalezas[c.fortaleza]?.zona);
      g.save(); g.translate(x, y); g.scale(w * (giro < 0 ? -1 : 1), 1); g.drawImage(icone, -8, -8); g.restore();
      if (Math.random() < 0.2) this.fx.add({ x: x + (Math.random() - 0.5) * 14, y: y - 2, vy: -14, cor: '#fff0a0', brilho: true, forma: 'estrela', vida: 0.7, tam: 1.4, encolhe: true });
    }
  }
  // barra de vida grande do guardião, no alto da tela, enquanto ele está brigando por perto
  desenharBarraChefe(g) {
    const b = this.chefeBarra;
    if (!b || this.tempo - b.t > 1) { this.mostrarRankingVm?.(null); this.aoBarraChefe?.(0); return; }
    const W = VIS_L * T, w = b.larg || 220, x = (W - w) / 2, y = b.y || 26;
    this.aoBarraChefe?.((y + 14) / (VIS_A * T));      // onde a barra termina, em fração da altura da tela      // a Vilemaw: barra maior, mais embaixo (a faixa do evento fica em cima)
    g.fillStyle = 'rgba(10,6,4,0.8)'; g.fillRect(x - 4, y - 14, w + 8, 26);
    g.fillStyle = '#3a0a08'; g.fillRect(x, y, w, 8);
    g.fillStyle = b.cor || '#d8281c'; g.fillRect(x, y, Math.round(w * Math.max(0, b.vida)), 8);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.round(w * Math.max(0, b.vida)), 2);
    g.strokeStyle = '#c9a050'; g.lineWidth = 1; g.strokeRect(x - 0.5, y - 0.5, w + 1, 9);
    g.font = 'bold 9px Verdana, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd84a';
    g.fillText(b.titulo || t('Guardião da Fortaleza') + ' · ' + t(b.nome), W / 2, y - 4);
    // a Vilemaw: quem mais bateu vai num quadro embaixo do minimapa (o jogo desenha, mostrarRankingVm)
    this.mostrarRankingVm?.(b.ranking?.length ? b : null);
  }
  // Zonas de Guerra no chão: um círculo avermelhado, com a borda tracejada e caveiras em volta
  desenharZonasPk(g, cx, cy) {
    for (const z of ZONAS_PK) {
      const x = z.x * T, y = z.y * T, rx = z.r * T, ry = rx / 1.1;
      if (x + rx < cx || x - rx > cx + VIS_L * T || y + ry < cy || y - ry > cy + VIS_A * T) continue;
      g.save();
      // o gradiente do chão é criado uma vez por zona (criar a cada quadro, do tamanho da zona, pesava; p580); no modo leve, cor lisa
      const cache = (this.gradPk ??= new Map());
      let gr = cache.get(z);
      if (!gr || gr.g !== g) { const n = g.createRadialGradient(x, y, rx * 0.2, x, y, rx); n.addColorStop(0, corZonaPk(z, 0.1)); n.addColorStop(1, corZonaPk(z, 0.24)); gr = { g, n }; cache.set(z, gr); }
      g.fillStyle = this.leve ? corZonaPk(z, 0.16) : gr.n; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = z.semCap ? `rgba(255,60,50,${0.6 + 0.2 * Math.sin(this.tempo * 3)})` : `rgba(255,150,40,${0.6 + 0.2 * Math.sin(this.tempo * 3)})`; g.lineWidth = 3; g.setLineDash([14, 10]); g.lineDashOffset = -this.tempo * 12;
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 12; i++) {          // as caveiras da borda: do cache de rótulos e só as que estão na tela
        const a = (i / 12) * Math.PI * 2, kx = x + Math.cos(a) * rx, ky = y + Math.sin(a) * ry + 4;
        if (kx < cx - 20 || kx > cx + VIS_L * T + 20 || ky < cy - 20 || ky > cy + VIS_A * T + 20) continue;
        escrever(g, '☠', kx, ky, `bold 13px ${FONTE}`, z.semCap ? 'rgba(255,90,80,0.8)' : 'rgba(255,170,70,0.8)', 0);
      }
      g.restore();
    }
  }
  desenharMinimapa(g) {
    // no mundo grande o minimapa mostra só um pedaço de 256×192 tiles em volta do jogador (do tamanho do mundo antigo);
    // com zoom (zoomMini: 1, 2 ou 4, pedido de jogador), 128×96 ou 64×48 tiles, no mesmo tamanho na tela
    const m = this.mapa, bw = Math.min(m.larg, 256), bh = Math.min(m.alt, 192), kb = Math.min(0.75, 100 / bw), w = Math.round(bw * kb), h = Math.round(bh * kb), x0b = VIS_L * T - w - 4, y0b = 4;
    const zm = m.mundo ? this.zoomMini || 1 : 1, vw = bw / zm, vh = bh / zm, k = w / vw;
    const sx = Math.max(0, Math.min(m.larg - vw, Math.round((this.darius.x - vw / 2) * zm) / zm)), sy = Math.max(0, Math.min(m.alt - vh, Math.round((this.darius.y - vh / 2) * zm) / zm));
    this.miniRet = { x: x0b, y: y0b, w, h };
    const x0 = x0b - sx * k, y0 = y0b - sy * k;
    g.save();
    g.globalAlpha = 0.92;
    g.fillStyle = 'rgba(8,10,16,0.85)'; g.fillRect(x0b - 2, y0b - 2, w + 4, h + 4);
    g.imageSmoothingEnabled = false;
    g.drawImage(m.mini, sx, sy, vw, vh, x0b, y0b, w, h);
    g.globalAlpha = 1;
    g.strokeStyle = '#8a7a52'; g.lineWidth = 1; g.strokeRect(x0b - 1.5, y0b - 1.5, w + 3, h + 3);
    g.beginPath(); g.rect(x0b, y0b, w, h); g.clip();
    // o que aparece na tela agora
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.strokeRect(x0 + (this.cam.x / T) * k + 0.5, y0 + (this.cam.y / T) * k + 0.5, VIS_L * k, VIS_A * k);
    if (m.mundo) for (const z of ZONAS_PK) { g.strokeStyle = z.semCap ? 'rgba(255,60,50,0.9)' : 'rgba(255,150,40,0.9)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x0 + z.x * k, y0 + z.y * k, z.r * k, (z.r * k) / 1.1, 0, 0, Math.PI * 2); g.stroke(); g.fillStyle = corZonaPk(z, 0.25); g.fill(); }
    for (const o of this.jogArena.values()) {
      const px = x0 + (o.x + 0.5) * k, py = y0 + (o.y + 0.9) * k;
      if (o.caveira) { g.fillStyle = '#000'; g.fillRect(px - 3, py - 3, 6, 6); g.fillStyle = Math.sin(this.tempo * 8) > 0 ? (o.vermelha ? '#ff2020' : '#ff9a20') : (o.vermelha ? '#ffd0d0' : '#ffe0b0'); g.fillRect(px - 2, py - 2, 4, 4); continue; }      // Caveira: maior e piscando
      if (o.mesmaGuilda || o.mesmoGrupo) { g.fillStyle = '#000'; g.fillRect(px - 2, py - 2, 4, 4); g.fillStyle = o.mesmoGrupo ? '#5ab4ff' : '#4ef08a'; g.fillRect(px - 1.5, py - 1.5, 3, 3); continue; }      // grupo azul, guilda verde
      g.fillStyle = o.pk ? '#ff4040' : '#ffffff'; g.fillRect(px - 1, py - 1, 2, 2);
    }
    if (this.vilemaw?.ativo) { const vx = x0 + this.vilemaw.x * k, vy = y0 + this.vilemaw.y * k, pv = 0.6 + 0.4 * Math.sin(this.tempo * 5); g.fillStyle = '#12061e'; g.fillRect(vx - 3.5, vy - 3.5, 7, 7); g.fillStyle = `rgba(122,255,232,${pv})`; g.fillRect(vx - 2.5, vy - 2.5, 5, 5); }      // a Vilemaw
    // o seu saco (onde você morreu): um quadradinho marrom com o miolo azul
    for (const s of this.sacos.values()) if (s.dono === this.nomeJogador) { const px = x0 + s.x * k, py = y0 + s.y * k; g.fillStyle = '#000'; g.fillRect(px - 2.5, py - 2.5, 5, 5); g.fillStyle = '#8a5c34'; g.fillRect(px - 2, py - 2, 4, 4); g.fillStyle = '#8ad0ff'; g.fillRect(px - 0.5, py - 0.5, 1, 1); }
    const d = this.darius;
    if (!this.morto) {
      const px = x0 + (d.x + 0.5) * k, py = y0 + (d.y + 0.9) * k, pisca = 0.6 + 0.4 * Math.sin(this.tempo * 6);
      g.fillStyle = `rgba(255,220,80,${pisca})`; g.fillRect(px - 2, py - 2, 4, 4);
      g.fillStyle = '#000'; g.fillRect(px - 0.5, py - 0.5, 1, 1);
    }
    g.restore();
  }

  // escuridão da noite com pontos de luz (Darius, cristais, pilares, fogo, estandarte), como no Tibia
  desenharNoite(g, cx, cy, dp, tx0, ty0, tx1, ty1) {
    const luz = this.luz ?? 1;
    if (luz >= 0.99) return;
    const W = VIS_L * T, H = VIS_A * T;
    this.sombra ??= Object.assign(document.createElement('canvas'), { width: W, height: H });
    if (this.sombra.width !== W || this.sombra.height !== H) { this.sombra.width = W; this.sombra.height = H; }      // a tela mudou de largura (girar o celular, gaveta)
    const s = this.sombra.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, W, H);
    s.fillStyle = `rgba(4,6,24,${(1 - luz) * 0.9})`;
    s.fillRect(0, 0, W, H);
    s.globalCompositeOperation = 'destination-out';
    const furo = (x, y, r, forca = 1) => {
      const gr = s.createRadialGradient(x - cx, y - cy, 0, x - cx, y - cy, r);
      gr.addColorStop(0, `rgba(0,0,0,${forca})`); gr.addColorStop(0.6, `rgba(0,0,0,${forca * 0.55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = gr; s.fillRect(x - cx - r, y - cy - r, r * 2, r * 2);
    };
    if (!this.morto) furo(dp.px + 16, dp.py + 16, 78 + Math.sin(this.tempo * 3) * 2);
    for (let y = ty0; y <= ty1 && y < this.mapa.alt; y++) for (let x = tx0; x <= tx1 && x < this.mapa.larg; x++) {
      const o = this.mapa.obj[y]?.[x];
      if (o?.luz) furo(x * T + 16, y * T + 10, o.pisca ? 37 + Math.sin(this.tempo * 9 + x * 3 + y) * 3 + Math.sin(this.tempo * 23 + x) * 2 : 40, 0.85);
    }
    if (this.queimando > 0 && this.fogo) furo(this.fogo.x * T + 16, this.fogo.y * T + 16, 56, 0.9);
    if (this.estandarte > 0 && this.estandartePos) furo(this.estandartePos.x * T + 16, this.estandartePos.y * T, 46, 0.7);
    for (const l of this.fx.luzes) furo(l.x, l.y, l.r * 1.3, Math.min(1, (1 - l.t / l.vida) * l.forca));
    for (const c of this.criaturas.values()) if (c.noturno) { const p = this.pos(c); furo(p.px + 16, p.py + 20, 22, 0.5); }
    g.drawImage(this.sombra, cx, cy);
  }

  desenharCriatura(g, c) {
    if (c.chefeGlobal) { this.desenharVilemaw(g, c); return; }       // a Vilemaw (chefe global): arte e animação próprias
    if (c === this.darius && (this.ocultoAte || 0) > this.tempo) return;      // Yasuo virou vento (R, N): só as cópias aparecem
    if ((c.zacOculto || 0) > this.tempo) return;      // Zac dividido em pedaços
    const { px, py } = this.pos(c);
    // caminhada em 8 fases por ciclo (dois passos a cada 2 tiles andados: pernas, braços, capa; ver marcha() em pixel.js);
    // o corpo sobe na passagem da perna e desce no apoio, em meio pixel
    const movendo = c.t < 1 || c.andando, andando = movendo && !c.montaria;      // montado, quem anda é a montaria
    // estilo novo: o passo segue a distância andada na tela (contínua), e não os passos do motor
    const pv = this.pos(c);
    if (c.montaria) {
      const vx = c.ultPx != null ? pv.px - c.ultPx : 0;
      if (Math.abs(vx) > 0.15) c.montDir = vx > 0 ? DIR.L : DIR.O;
      else if (!movendo && (c.dir === DIR.L || c.dir === DIR.O)) c.montDir = c.dir;
      c.montDir ??= DIR.L;
      c.dir = c.montDir;
    }
    if (c.ultPx != null) { const dd = Math.hypot(pv.px - c.ultPx, pv.py - c.ultPy) / T; if (dd < 1) c.distVis = (c.distVis || 0) + dd; }
    c.ultPx = pv.px; c.ultPy = pv.py;
    const novoCamp = estiloNovoLigado() && ANIM_NOVA.has(aparencia(c.nome).forma);
    const fase = Math.floor(((novoCamp ? c.distVis : c.dist) || 0) * 4) % 8;
    let frame = c.atk > 0 || c.canal > 0 ? 3 : andando ? 20 + fase : 0;
    if (c.quadroDg && this.tempo < c.quadroDg.ate) frame = c.quadroDg.q;      // dungeon: a pose da habilidade do Braum (p670)
    // estilo novo: campeões com ataque em 4 tempos (preparação, golpe, impacto, recuperação) e respirando parados
    if (estiloNovoLigado() && ANIM_NOVA.has(aparencia(c.nome).forma)) {
      if (c.atk > (c.atkVisto || 0)) c.golpeT0 = this.tempo;
      c.atkVisto = c.atk;
      const g4 = c.golpeT0 != null ? (this.tempo - c.golpeT0) / 0.36 : 1;
      if (g4 < 1 && !(c.canal > 0)) frame = 30 + Math.floor(g4 * 4);
      else if (frame === 0) {
        frame = 40 + (Math.floor(this.tempo * 2.5 + (c.x + c.y) * 0.7) % 4);
        if ((this.tempo + (c.x || 0) * 0.37) % 3.6 < 0.13) frame = 44;           // pisca
        if (!c.montaria) this.gestoParado(c);
      }
      if (frame < 40 || andando) { c.paradoT = 0; c.proxGesto = null; }
      // poses das habilidades (ver poseHabilidade) e dos movimentos longos
      const forma = aparencia(c.nome).forma;
      if (c.pose && this.tempo < c.pose.ate) { const k = 1 - (c.pose.ate - this.tempo) / c.pose.dur; frame = c.pose.seq[Math.min(c.pose.seq.length - 1, Math.floor(k * c.pose.seq.length))]; }
      if (forma === 'darius' && c.giro > 0) frame = 50;
      if (forma === 'darius' && c.salto > 0) { const k = 1 - c.salto / 0.32; frame = k < 0.2 ? 56 : k < 0.8 ? 57 : 32; }
      if ((forma === 'ezreal' || forma === 'lux') && c.canal > 0) frame = 54;
      // poeirinha a cada pisada
      if (andando && (fase === 0 || fase === 4) && c.ultimaFase !== fase && this.fx) { const p0 = this.pos(c); this.fx.add({ x: p0.px + 16 + (Math.random() - 0.5) * 6, y: p0.py + 30, vx: (Math.random() - 0.5) * 14, vy: -6, cor: '#c8b898', vida: 0.4, tam: 1.6, encolhe: true }); }
      c.ultimaFase = fase;
    }
    let flutua = andando && frame !== 3 ? -[0, 0.5, 1, 0.5, 0, 0.5, 1, 0.5][fase] : 0, balancoX = 0;
    // estilo novo, monstros: dragão batendo asa, lobo abanando o rabo e latindo/uivando, todos respirando,
    // a larva e o Barão ondulando, o Brambleback bufando, a Sentinela e o Krug com brilho
    const formaM = aparencia(c.nome).forma;
    if (estiloNovoLigado() && !c.npc && !novoCamp && c !== this.pet) {
      c.fase0 ??= Math.random() * 10;
      const tf = this.tempo + c.fase0;
      if (formaM === 'dragao' && frame !== 3) frame = 70 + (Math.floor(tf * (andando ? 10 : 6)) % 4);
      if (formaM === 'fera' && frame === 0) {
        c.proxLatido ??= this.tempo + 3 + Math.random() * 8;
        if (!c.latido && this.tempo > c.proxLatido) {
          const uiva = Math.random() < 0.3; c.latido = { t0: this.tempo, uiva }; c.proxLatido = this.tempo + 7 + Math.random() * 9;
          this.texto(c, uiva ? t('Auuuu!') : t('Au! Au!'), '#e8e0d0', 0.8);
        }
        if (c.latido) { const k = (this.tempo - c.latido.t0) / (c.latido.uiva ? 1.6 : 0.8); if (k >= 1) c.latido = null; else frame = c.latido.uiva ? 74 : [72, 73, 72, 73][Math.floor(k * 4)]; }
        if (frame === 0) frame = 70 + (Math.floor(tf * 5) % 2);
      }
      // animação contínua (quadros 70 a 73): o cristal da Sentinela girando, a Arraia nadando, a Larva e o Barão ondulando, os tentáculos
      const LOOP = { sentinela: [5, false], arraia: [7, true], verme: [5, true], olhoVazio: [6, true] }[formaM];
      if (LOOP && frame !== 3 && (frame === 0 || LOOP[1])) frame = 70 + (Math.floor(tf * LOOP[0]) % 4);
      if (formaM === 'golem' && frame === 0) frame = 70 + (Math.floor(tf * 1.4) % 2);          // respirando
      if (formaM === 'tropa' && frame === 0) frame = 70 + (Math.floor(tf * 1.6) % 2);          // penacho e brilho da espada
      if (formaM === 'mago' && frame === 0) frame = 70 + (Math.floor(tf * 6) % 4);             // faíscas em volta do orbe
      if (formaM === 'cerco' && Math.random() < 0.01) { const p0 = this.pos(c); this.fx.add({ x: p0.px + 16 + (c.dir === DIR.O ? -10 : 10), y: p0.py + 10, vx: (Math.random() - 0.5) * 6, vy: -12, cor: '#b8b8c0', vida: 1.4, tam: 2.4, encolhe: true }); }
      if (formaM === 'javali' && frame === 0) frame = 70 + (Math.floor(tf * 4) % 2);           // espinhos tremulando
      // de vez em quando, um gesto especial (parado)
      const ESP = { golem: [[72, 72, 72, 73, 73, 73], 1.1], javali: [[72, 70, 72, 70], 0.9], olhoVazio: [[74], 0.18], verme: c.grande ? [[74, 74, 74, 74], 1.3] : null }[formaM];
      if (ESP && !andando && frame !== 3) {
        c.proxEsp ??= this.tempo + 3 + Math.random() * 6;
        if (!c.esp && this.tempo > c.proxEsp) { c.esp = { t0: this.tempo }; c.proxEsp = this.tempo + (formaM === 'olhoVazio' ? 2.5 : 6) + Math.random() * 7; }
        if (c.esp) {
          const k = (this.tempo - c.esp.t0) / ESP[1];
          if (k >= 1) c.esp = null;
          else {
            frame = ESP[0][Math.floor(k * ESP[0].length)];
            const p0 = this.pos(c);
            if (formaM === 'golem' && frame === 73 && !c.esp.bateu) { c.esp.bateu = true; this.tremor = Math.max(this.tremor || 0, 0.2); this.poeira(p0.px + 16, p0.py + 30, 14, 1.2); }
            if (formaM === 'verme' && !c.esp.rugiu) { c.esp.rugiu = true; this.tremor = Math.max(this.tremor || 0, 0.35); this.texto(c, t('ROAAAR!'), '#d8a0ff', 1.1); }
            if (formaM === 'javali' && !c.esp.bufou) { c.esp.bufou = true; this.poeira(p0.px + 16, p0.py + 30, 8, 0.8); }
          }
        }
      }
      if (!andando && frame !== 3) flutua -= Math.round((Math.sin(tf * 2.2) * 0.5 + 0.5) * 1) / 2;            // respirando
      if (formaM === 'javali' && Math.random() < 0.012) {        // bufando: fumaça saindo do focinho
        const p0 = this.pos(c), lado = c.dir === DIR.O ? -1 : c.dir === DIR.L ? 1 : 0;
        for (let k = 0; k < 4; k++) this.fx.add({ x: p0.px + 16 + lado * 12, y: p0.py + 18, vx: lado * 20 + (Math.random() - 0.5) * 16, vy: -10 - Math.random() * 8, cor: '#c8c0b8', vida: 0.7, tam: 2, encolhe: true });
      }
    }
    if (novoCamp) {
      const ph = (c.distVis || 0) * Math.PI, meio = (v) => Math.round(v * 2) / 2;
      if (andando) {          // sobe e desce a cada passo e balança de um lado para o outro (de frente e de costas)
        flutua = -meio(Math.abs(Math.sin(ph)) * 1.5);
        if (c.dir === DIR.S || c.dir === DIR.N) balancoX = meio(Math.sin(ph) * 0.8);
      } else flutua = -meio((Math.sin(this.tempo * 2.2 + (c.x || 0)) * 0.5 + 0.5) * 0.5);        // respiração
    }
    const acao = c.npc && c.dir === DIR.S && ACAO_NPC[c.nome];
    if (acao) {
      c.fase ??= Math.random() * 5;
      frame = acao.seq[Math.floor((this.tempo + c.fase) * acao.fps) % acao.seq.length];
      c.quadroAcao = frame;
      if (estiloNovoLigado() && c.nome !== 'Ornn') {
        // cumprimenta quem chega perto (uma vez a cada 25 s) e pisca de vez em quando
        const dp = this.pos(this.darius), pc = this.pos(c), perto = Math.hypot(dp.px - pc.px, dp.py - pc.py) < 2.6 * T;
        if (perto && !c.oi && this.tempo - (c.oiT || -99) > 25) {
          c.oi = { t0: this.tempo }; c.oiT = this.tempo;
          const frases = SAUDACAO[c.nome] || []; if (frases.length) this.balao(c, t(frases[(Math.random() * frases.length) | 0]), '#ffe8a0');
        }
        if (c.oi) { const k = (this.tempo - c.oi.t0) / 1.8; if (k >= 1) c.oi = null; else frame = 20 + (Math.floor(k * 8) % 4); }
        else if ((this.tempo + c.fase) % 4.2 < 0.13 && (frame === 10 || frame === 0)) frame = 19;
      }
      if (acao.flutua) flutua = Math.round(Math.sin(this.tempo * 2) * 1.5) - 1;
    }
    const s = sprite(c.spriteNome || c.nome, c.dir, frame), ex = tamanhoExtra(c.spriteNome || c.nome), o = c.grande ? 32 : 0;
    if (c.guardiao) {          // guardião de fortaleza: anel dourado pulsando no chão
      const k = 1 + tamanhoExtra(c.spriteNome || c.nome) / (c.grande ? 64 : 32);
      // brilho vermelho atrás do guardião
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = c.furioso ? 0.6 + 0.3 * Math.sin(this.tempo * 12) : 0.35 + 0.15 * Math.sin(this.tempo * 4);
      g.drawImage(halo('#ff4020'), px + 16 - (c.grande ? 16 : 0) - 34 * k, py + 14 - ex / 2 - 34 * k, 68 * k, 68 * k); g.restore();
      g.strokeStyle = `rgba(255,210,80,${0.5 + 0.3 * Math.sin(this.tempo * 5)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(px + 16 - (c.grande ? 16 : 0), py + 29, 15 * k * (c.grande ? 1.6 : 1), 5 * k * (c.grande ? 1.6 : 1), 0, 0, Math.PI * 2); g.stroke();
    }
    if (c.miniChefe) {          // monstro furioso (Rift): chão em brasa, brilho vermelho pulsando e faíscas subindo
      const mx = px + 16 - (c.grande ? 16 : 0), k = 1 + tamanhoExtra(c.spriteNome || c.nome) / (c.grande ? 64 : 32), pul = Math.sin(this.tempo * 7);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 + 0.25 * pul;
      g.drawImage(halo('#ff3a10'), mx - 30 * k, py + 14 - ex / 2 - 30 * k, 60 * k, 60 * k); g.restore();
      g.fillStyle = `rgba(255,70,20,${0.4 + 0.2 * pul})`; g.beginPath(); g.ellipse(mx, py + 29, 15 * k, 5 * k, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(255,190,80,${0.5 + 0.3 * pul})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(mx, py + 29, 17 * k, 6 * k, 0, 0, Math.PI * 2); g.stroke();
      if (Math.random() < 0.5) this.fx.add({ x: mx + (Math.random() - 0.5) * 22 * k, y: py + 28, vx: 0, vy: -30 - Math.random() * 30, cor: Math.random() < 0.5 ? '#ff5a20' : '#ffb040', brilho: true, vida: 0.6, tam: 1.8, encolhe: true });
    } else if (this.furiaGrupo && !this.arena && !c.npc && !c.pet && !c.jogador && c !== this.darius && !c.guardiao) {
      // os outros monstros do grupo, bravos com o furioso por perto: um anel vermelho no chão
      g.strokeStyle = `rgba(255,80,40,${0.45 + 0.2 * Math.sin(this.tempo * 6 + c.x)})`; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(px + 16 - (c.grande ? 16 : 0), py + 29, 13, 4.5, 0, 0, Math.PI * 2); g.stroke();
      if (Math.random() < 0.06) this.fx.add({ x: px + 16 + (Math.random() - 0.5) * 14, y: py + 26, vx: 0, vy: -24, cor: '#ff6a3a', brilho: true, vida: 0.5, tam: 1.4, encolhe: true });
    }
    if (c.noturno) {
      g.fillStyle = `rgba(150,80,255,${0.3 + 0.15 * Math.sin(this.tempo * 4)})`;
      g.beginPath(); g.ellipse(px + 16, py + 27, 13, 5, 0, 0, Math.PI * 2); g.fill();
    }
    if (c.surgindo > 0) {          // Runeterra: o monstro surgindo do chão (1,5 s sem levar dano): um anel roxo no chão e o corpo aparecendo
      const f = 1 - c.surgindo / 1.5, cx = px + 16 - (c.grande ? 16 : 0);
      g.strokeStyle = `rgba(190,150,255,${0.85 - 0.5 * f})`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(cx, py + 28, 6 + 9 * f + Math.sin(this.tempo * 10), 2.5 + 3 * f, 0, 0, Math.PI * 2); g.stroke();
      if (Math.random() < 0.3) this.fx.add({ x: cx + (Math.random() - 0.5) * 16, y: py + 28, vx: 0, vy: -30, cor: '#c8a8ff', brilho: true, vida: 0.5, tam: 1.2, encolhe: true });
      g.globalAlpha = 0.25 + 0.6 * f;
    } else if (c.surge > 0) g.globalAlpha = 1 - c.surge / 0.6;
    const parado = c.t >= 1 && !(c.atk > 0) && !c.fila.length && !c.andando;
    const resp = parado && !acao && Math.sin(this.tempo * 2.6 + c.x * 1.7 + c.y * 2.3) > 0.55 ? 1 : 0;
    // meio pixel, igual à câmera: o boneco não treme em relação ao chão enquanto a tela anda
    // montado: a montaria embaixo e o campeão sentado na sela (mais alto)
    // passo de 8 quadros a cada 1,6 tile andado; o cavaleiro sobe e desce junto com o corpo da montaria
    let ms = null, mfq = 0, subida = 0;
    if (c.montaria) {
      mfq = movendo ? 20 + (Math.floor((c.distVis || 0) * 5) % 8) : (this.tempo + (c.x || 0)) % 3.7 < 0.14 ? 19 : 0;
      ms = sprite(c.montaria, c.montDir === DIR.L ? DIR.O : DIR.L, mfq);
      c.alturaMont = Math.max(4, Math.round(19 * (ms.height / 32) - 13));
      subida = Math.round(subidaMontaria(mfq) * (ms.height / 32) * 2) / 2;
    } else c.alturaMont = 0;
    c.noArVis = (c.noArVis || 0) + ((c.noAr > 0 ? 17 + Math.sin(this.tempo * 9) * 1.5 : 0) - (c.noArVis || 0)) * 0.28;      // jogado para o alto (Yasuo)
    const noAr = Math.round(c.noArVis * 2) / 2;
    const X = Math.round((px - o - ex / 2) * ESCALA) / ESCALA + (ms ? 0 : balancoX), Y = Math.round((py - o - ex) * ESCALA) / ESCALA + (novoCamp ? 0 : resp) + (ms ? 0 : flutua) - c.alturaMont + subida - noAr;
    if (noAr > 1) {                    // redemoinho de vento girando embaixo de quem está no ar
      g.save(); g.globalCompositeOperation = 'lighter';
      const mx = px + 16 - (c.grande ? 16 : 0), cor = this.corSkin('#bfe8ff');
      for (let i = 0; i < 5; i++) {
        const a0 = this.tempo * (12 + i) + i * 2.1, r2 = 5 + i * 2.6, yy = py + 28 - i * (noAr / 5);
        g.globalAlpha = 0.85 - i * 0.12; g.strokeStyle = i % 2 ? cor : '#ffffff'; g.lineWidth = 1.6 - i * 0.15;
        g.beginPath(); g.ellipse(mx, yy, r2, r2 * 0.34, 0, a0, a0 + Math.PI * 1.4); g.stroke();
      }
      g.restore();
    }
    if (c === this.npcFoco) {          // NPC com o mouse em cima: brilho dourado no chão
      g.strokeStyle = `rgba(255,216,90,${0.55 + 0.25 * Math.sin(this.tempo * 6)})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(px + 16, py + 28, c.grande ? 18 : 12, c.grande ? 6 : 4.5, 0, 0, Math.PI * 2); g.stroke();
    }
    if (estiloNovoLigado() && !c.parada) {     // estilo novo: sombra macia no chão, embaixo dos pés
      g.fillStyle = 'rgba(10,14,20,0.32)';
      const k = 1 + ex / (c.grande ? 64 : 32);
      g.beginPath(); g.ellipse(px + 16 - (c.grande ? 16 : 0), py + 29, (c.grande ? 20 : 10) * k, (c.grande ? 6 : 3.5) * k, 0, 0, Math.PI * 2); g.fill();
    }
    if (estiloNovoLigado() && (formaM === 'sentinela' || formaM === 'golem') && !c.npc) {
      const k = 0.5 + 0.5 * Math.sin(this.tempo * 3 + (c.fase0 || 0)), w = s.width;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.3 * k;
      if (formaM === 'sentinela') g.drawImage(halo('#4ec8ff'), X + w / 2 - w * 0.35, Y - w * 0.1, w * 0.7, w * 0.7);
      else g.drawImage(halo(aparencia(c.nome).olho || '#ffb040'), X + w / 2 - w * 0.22, Y + w * 0.08, w * 0.44, w * 0.3);
      g.restore();
    }
    if (estiloNovoLigado() && c.npc && c.nome === 'Ornn') {
      const k = 0.5 + 0.5 * Math.sin(this.tempo * 4) + (c.quadroAcao === 12 ? 0.6 : 0);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, 0.25 + 0.2 * k);
      g.drawImage(halo('#ff8a20'), X + 32, Y + 26, 36, 30); g.restore();
    }
    if (ms) {
      const lado = c.montDir === DIR.L ? 1 : -1, k = ms.height / 32;
      g.fillStyle = 'rgba(10,14,20,0.32)'; g.beginPath(); g.ellipse(px + 16, py + 29, 11 * k, 3.4 * k, 0, 0, Math.PI * 2); g.fill();
      c.montXY = { x: Math.round(px + 16 - ms.width / 2 + lado * 1.5 * k), y: Math.round(py + 32 - ms.height), k, lado, w: ms.width };
      g.drawImage(ms, c.montXY.x, c.montXY.y);
      if (movendo && this.fx && (mfq === 20 || mfq === 24) && c.ultMfq !== mfq) this.fx.add({ x: px + 16 - lado * 8 * k + (Math.random() - 0.5) * 6, y: py + 30, vx: -lado * 10 + (Math.random() - 0.5) * 10, vy: -6, cor: '#c8b898', vida: 0.45, tam: 1.8, encolhe: true });
      c.ultMfq = mfq;
    }
    if (c === this.darius && this.montandoT > 0) {          // montando: barrinha em cima da cabeça
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(Math.round(px + 2), Math.round(py - 12), 28, 4);
      g.fillStyle = '#e8c060'; g.fillRect(Math.round(px + 3), Math.round(py - 11), Math.round(26 * this.montandoT), 2);
    }
    const sombra = c === this.darius && (this.sombraAte || 0) > this.tempo;      // Passo das Sombras (Katarina)
    if (sombra) g.globalAlpha = 0.3 + 0.08 * Math.sin(this.tempo * 20);
    const pano = novoCamp ? this.pano(c, X, Y) : null;
    if (pano && !pano.frente) g.drawImage(pano.img, pano.x, pano.y);
    const tornadoAqui = c === this.darius && this.tornadoPronto && !this.morto && !ms;
    if (tornadoAqui) this.redemoinhoTornado(g, X, Y, false);
    if (ms) {          // montado: o corpo até o quadril e a perna de cá descendo até o estribo (a outra fica atrás da montaria)
      const corte = Math.round(s.height * 0.7);
      g.drawImage(s, 0, 0, s.width, corte, X, Y, s.width, corte);
      this.pernaMontado(g, c, X, Y + corte, subida);
    }
    else g.drawImage(s, X, Y);
    if (pano?.frente) g.drawImage(pano.img, pano.x, pano.y);
    if (tornadoAqui) this.redemoinhoTornado(g, X, Y, true);
    c.ultimoDesenho = { s, X, Y, alfa: g.globalAlpha };
    if (sombra) g.globalAlpha = 1;
    if (c.hit > 0) { g.globalAlpha = Math.min(1, c.hit / 0.14) * 0.5; g.drawImage(tingido(s, '#ffffff'), X, Y); g.globalAlpha = 1; }
    if (c === this.darius) {
      // fúria e Hemorragia no máximo deixam o Darius avermelhado; o grito dá um clarão laranja
      const pulso = 0.5 + 0.5 * Math.sin(this.tempo * 9);
      if (this.furiaS) { g.globalAlpha = 0.28 + 0.12 * pulso; g.drawImage(tingido(s, '#ff1020'), X, Y); }
      else if (this.poder) { g.globalAlpha = 0.15 + 0.15 * pulso; g.drawImage(tingido(s, '#ff2a10'), X, Y); }
      if (this.grito) { g.globalAlpha = 0.12 + 0.1 * pulso; g.drawImage(tingido(s, '#ffb040'), X, Y); }
      g.globalAlpha = 1;
      // W carregado: o machado brilha e solta faíscas vermelhas
      if (this.wPronto && !this.morto) {
        const mx = X + (c.dir === DIR.O ? 6 : c.dir === DIR.N ? 8 : 25), my = Y + 10;
        g.fillStyle = `rgba(255,40,30,${0.35 + 0.25 * pulso})`; g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 3; i++) { const f = (this.tempo * 2 + i / 3) % 1; g.fillStyle = i % 2 ? '#ffd0a0' : '#ff3a20'; g.fillRect(Math.round(mx - 3 + i * 3), Math.round(my - f * 12), 1, 2); }
      }
    }
    if (c.marca) {        // orbe do Fluxo Essencial preso no monstro
      const pul = 0.5 + 0.5 * Math.sin(this.tempo * 8), ox = px + 16, oy = py + 12;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 + 0.25 * pul; g.drawImage(halo(this.corSkin(this.maga ? '#ffd040' : '#b060ff')), ox - 14, oy - 14, 28, 28);
      g.restore();
      g.globalAlpha = 0.85; g.fillStyle = this.corSkin(this.maga ? '#ffe070' : '#c890ff'); g.beginPath(); g.arc(ox, oy, 3.5 + pul, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1; g.fillStyle = '#fff0c0'; g.fillRect(Math.round(ox) - 1, Math.round(oy) - 1, 2, 2);
      for (let i = 0; i < 3; i++) {
        const a2 = this.tempo * 5 + i * 2.09;
        g.fillStyle = i % 2 ? '#ffe080' : '#e0b0ff'; g.fillRect(Math.round(ox + Math.cos(a2) * 8), Math.round(oy + Math.sin(a2) * 3), 1, 1);
      }
    }
    if (c === this.darius && this.atirador && this.forcaAcum && !this.morto) {   // Feitiço do Poder Crescente
      for (let k = 0; k < this.forcaAcum; k++) {
        const ang = this.tempo * 3 + (k * Math.PI * 2) / this.forcaAcum;
        g.globalAlpha = 0.8; g.fillStyle = k % 2 ? '#7ad8ff' : '#ffe080';
        g.fillRect(Math.round(px + 16 + Math.cos(ang) * 11) - 1, Math.round(py + 20 + Math.sin(ang) * 4) - 1, 2, 2);
      }
      g.globalAlpha = 1;
    }
    // Hemorragia: gotas de sangue pingando de quem está sangrando
    if (c.acumulos > 0) for (let k = 0; k < c.acumulos; k++) {
      const f = (this.tempo * 1.4 + k * 0.23) % 1;
      g.globalAlpha = 1 - f; g.fillStyle = k % 2 ? '#c01010' : '#8a0808';
      g.fillRect(Math.round(px + 9 + ((k * 5) % 14)), Math.round(py + 12 + f * 14), 1, 2);
    }
    g.globalAlpha = 1;
  }

  // caveira pixelada balançando em cima do nome (PK ligado)
  desenharCaveira(g, x, y) {
    const b = Math.round(Math.sin(this.tempo * 4) * 1.5), X = Math.round(x) - 5, Y = Math.round(y) - 12 + b;
    const brilho = 0.35 + 0.25 * Math.sin(this.tempo * 6);
    g.fillStyle = `rgba(255,40,40,${brilho})`; g.fillRect(X - 1, Y - 1, 12, 12);
    const px = (a, c2, w, h, cor) => { g.fillStyle = cor; g.fillRect(X + a, Y + c2, w, h); };
    px(2, 0, 6, 1, '#f0ece0'); px(1, 1, 8, 5, '#f0ece0'); px(2, 6, 6, 2, '#f0ece0'); px(3, 8, 4, 2, '#d8d2c0');
    px(2, 2, 2, 2, '#1a0808'); px(6, 2, 2, 2, '#1a0808'); px(4, 5, 2, 1, '#1a0808'); px(3, 8, 1, 1, '#1a0808'); px(5, 8, 1, 1, '#1a0808');
  }
  // Caveira Vermelha (frags acima do limite): vermelha, com os ossos cruzados atrás, brilho forte e um anel pulsando.
  // laranja = a Caveira de 10 min por morte injusta (sem cidade e sem sair de Runeterra)
  desenharCaveiraVermelha(g, x, y, laranja = false) {
    const b = Math.round(Math.sin(this.tempo * 4) * 1.5), X = Math.round(x) - 5, Y = Math.round(y) - 13 + b;
    const brilho = 0.45 + 0.3 * Math.sin(this.tempo * 7);
    if (!laranja) { const r = 9 + 3 * ((this.tempo * 1.5) % 1); g.strokeStyle = `rgba(255,40,40,${0.7 - 0.6 * ((this.tempo * 1.5) % 1)})`; g.lineWidth = 1; g.strokeRect(X + 5 - r, Y + 5 - r, r * 2, r * 2); }
    g.fillStyle = laranja ? `rgba(255,140,20,${brilho})` : `rgba(255,20,20,${brilho})`; g.fillRect(X - 3, Y - 2, 16, 15);
    g.fillStyle = '#e8dcc8';
    for (let k = 0; k < 10; k++) { g.fillRect(X - 2 + k * 1.4, Y + 1 + k, 2, 1); g.fillRect(X + 12 - k * 1.4, Y + 1 + k, 2, 1); }      // os ossos cruzados
    const px = (a, c2, w, h, cor) => { g.fillStyle = cor; g.fillRect(X + a, Y + c2, w, h); };
    const claro = laranja ? '#ffb35a' : '#ff6a5a', escuro = laranja ? '#d8862a' : '#d84a3a';
    px(2, 0, 6, 1, claro); px(1, 1, 8, 5, claro); px(2, 6, 6, 2, claro); px(3, 8, 4, 2, escuro);
    if (!laranja) this.sangueCaveira(g, X, Y);
    px(2, 2, 2, 2, '#1a0000'); px(6, 2, 2, 2, '#1a0000'); px(4, 5, 2, 1, '#1a0000'); px(3, 8, 1, 1, '#1a0000'); px(5, 8, 1, 1, '#1a0000');
  }
  // a Caveira Vermelha escorre sangue: riscos saindo dos olhos e gotas que se formam no queixo e pingam (cada uma num tempo)
  sangueCaveira(g, X, Y) {
    // riscos de sangue escorrendo dos olhos e do nariz pela caveira
    g.fillStyle = '#6a0000'; g.fillRect(X + 2, Y + 4, 2, 4); g.fillRect(X + 6, Y + 4, 2, 3); g.fillRect(X + 4, Y + 6, 1, 3);
    g.fillStyle = '#c00000'; g.fillRect(X + 2, Y + 7, 1, 2); g.fillRect(X + 7, Y + 6, 1, 2);
    g.fillStyle = '#7a0000'; g.fillRect(X + 3, Y + 10, 2, 1); g.fillRect(X + 6, Y + 10, 1, 2);
    // gotas: cada uma se forma embaixo da caveira, cresce e cai (cada uma num tempo)
    for (const [k, dx] of [[0, 2], [1, 6], [2, 4], [3, 8]]) {
      const ff = (this.tempo * 0.6 + k * 0.29) % 1, base = Y + 11;
      if (ff < 0.35) { const tam = ff < 0.15 ? 1 : 2; g.fillStyle = '#b00000'; g.fillRect(X + dx, base, 1, tam); if (tam > 1) { g.fillStyle = '#ff4040'; g.fillRect(X + dx, base, 1, 1); } continue; }
      const cai = (ff - 0.35) / 0.65, y = base + cai * cai * 20, a = 1 - cai * 0.75;
      g.fillStyle = `rgba(110,0,0,${0.55 * a})`; g.fillRect(X + dx, base, 1, Math.max(1, (y - base) * 0.45));      // o rastro
      g.fillStyle = `rgba(190,0,0,${a})`; g.fillRect(X + dx - (dx === 4 ? 0 : 0), Math.round(y), 2, 2);
      g.fillStyle = `rgba(255,80,80,${a})`; g.fillRect(X + dx, Math.round(y), 1, 1);      // o brilho da gota
    }
  }
  // a criatura está debaixo do mouse? (mouseCss vem do jogo.js, em pixels CSS do canvas)
  sobMouse(c) {
    const m = this.mouseCss;
    if (!m) return false;
    const k = m.larg / (VIS_L * T), wx = this.cam.x + m.x / k, wy = this.cam.y + m.y / k, { px, py } = this.pos(c);
    return Math.hypot(wx - (px + 16 - (c.grande ? 16 : 0)), wy - (py + 14)) < (c.grande ? 30 : 18);
  }
  // brasão da guilda à esquerda do nome (o texto já tem a fonte certa em g)
  brasaoNome(g, b, txt, meio, y, w = g.measureText(txt).width) {
    if (!b) return;
    const img = imgBrasao(b);
    if (!img.complete || !img.naturalWidth) return;
    g.drawImage(img, Math.round(meio - w / 2 - 9), Math.round(y - 7), 7, 8);
  }
  desenharNome(g, c) {
    const { px, py } = this.pos(c);
    const topo = py - (c.grande ? 34 : 4) - tamanhoExtra(c.spriteNome || c.nome) - (c.alturaMont || 0), meio = px + 16 - (c.grande ? 16 : 0);
    if (c.atordoado) for (let i = 0; i < 3; i++) {
      const ang = this.tempo * 6 + (i * Math.PI * 2) / 3;
      g.fillStyle = '#fff060'; g.fillRect(Math.round(meio + Math.cos(ang) * 9) - 1, Math.round(topo - 12 + Math.sin(ang) * 3), 2, 2);
    }
    const cor = corVida(c.vida);
    if (c.pet) {
      escrever(g, this.petRotulo || t(c.nome), px + 16, py + 14, `5px ${FONTE}`, '#d8d0c0', 1);
      return;
    }
    if (c.arenaJog) {       // jogador em Runeterra: nome (vermelho se atacou alguém), nível e vida
      const rot = `${c.vip ? '★ ' : ''}${c.nomeJogador}`;
      if (c.vermelha) this.desenharCaveiraVermelha(g, meio, topo - 10); else if (c.caveira) this.desenharCaveiraVermelha(g, meio, topo - 10, true); else if (c.pk) this.desenharCaveira(g, meio, topo - 10);
      const corJ = c.vermelha ? '#ff3030' : c.caveira ? '#ffa040' : c.agressor ? '#ff4040' : c.mesmoGrupo ? '#7ad8ff' : c.mesmaGuilda ? '#8af08a' : c.atacavel ? '#f0f0f0' : '#a8a29a';
      this.brasaoNome(g, c.brasao, rot, meio, topo - 3, escrever(g, rot, meio, topo - 3, `bold 6px ${FONTE}`, corJ, 1.2).wt);
      g.fillStyle = '#000'; g.fillRect(meio - 14, topo - 1, 28, 4);
      g.fillStyle = corVida(c.vida); g.fillRect(meio - 13, topo, Math.max(0, Math.round(26 * c.vida)), 2);
      for (let k = 0; k < (c.acumulos || 0); k++) {        // acúmulos de Hemorragia do Darius (o servidor conta)
        g.fillStyle = '#000'; g.fillRect(meio - 12 + k * 5, topo + 4, 4, 4);
        g.fillStyle = k === 4 ? '#ff3030' : '#c01414'; g.fillRect(meio - 11 + k * 5, topo + 5, 2, 2);
      }
      const nv = (c.parado ? t('nível {n} · parado', { n: c.nivel }) : t('nível {n}', { n: c.nivel })) + (c.poder ? ' · ⚔' + fmt(c.poder) : '');
      escrever(g, nv, meio, topo + (c.acumulos > 0 ? 13 : 9), `5px ${FONTE}`, '#a8a29a', 1.2);
      return;
    }
    if (c.jogador) {        // outro jogador: nome em branco, título e nível, sem barra de vida
      const rot = `${c.vip ? '★ ' : ''}${c.nomeJogador}${c.titulo ? ', ' + t(c.titulo) : ''}`;
      escrever(g, rot, meio, topo - 3, `bold 6px ${FONTE}`, '#f0f0f0', 1.2);
      escrever(g, t('nível {n}', { n: c.nivel }), meio, topo + 3, `5px ${FONTE}`, '#a8a29a', 1.2);
      return;
    }
    if (c.chefeGlobal) return;          // a Vilemaw tem o nome na barra grande
    const meuNome = this.nomeJogador || 'Darius';
    if (c === this.darius && this.arena && !this.morto) {          // a sua caveira: a Vermelha (escorrendo sangue), a de 10 min ou a do PK
      if (this.minhaVermelha) this.desenharCaveiraVermelha(g, meio, topo - 10);
      else if (this.minhaCaveira) this.desenharCaveiraVermelha(g, meio, topo - 10, true);
      else if (this.pk) this.desenharCaveira(g, meio, topo - 10);
    }
    // o próprio campeão mostra só o nome (o título fica no perfil); monstro comum só mostra o nome no alvo,
    // nos chefes e guardiões, ou com o mouse em cima: com vários na tela, os nomes ficavam um em cima do outro
    const nome = c === this.darius ? (this.vip ? '★ ' : '') + meuNome : c.miniChefe ? '✹ ' + t(c.nome) : c.noturno ? '☾ ' + t(c.nome) : t(c.nome);
    const comNome = c === this.darius || c.npc || c.chefe || c.grande || c.guardiao || c.miniChefe || c === this.alvo || this.sobMouse(c);
    // a fonte só quando o nome aparece: trocar g.font é caro e isto roda para toda criatura em todo quadro
    if (comNome) {
      const r = escrever(g, nome, meio, topo - 3, `bold 6px ${FONTE}`, c.npc ? '#8ad8ff' : c.miniChefe ? '#ff7a4a' : cor, 1.2);
      if (c === this.darius) this.brasaoNome(g, this.meuBrasao, nome, meio, topo - 3, r.wt);
    }
    if (c.npc) return;
    if (c.pet) return;
    if (c === this.darius) {
      if (!this.assassina && !this.gelatina) {         // a Katarina e o Zac não usam recurso nenhum
        g.fillStyle = '#000'; g.fillRect(meio - 14, topo + 2, 28, 3);
        // Yasuo: o Fluxo em amarelo (cheio, pisca mais claro), para não parecer mana
        g.fillStyle = !this.espadachim ? '#3a7aff' : this.mana < 0.99 ? '#e8c040' : Math.sin(this.tempo * 6) > 0 ? '#fff2a0' : '#ffd040';
        g.fillRect(meio - 13, topo + 3, Math.max(0, Math.round(26 * this.mana)), 1);
      }
      if (this.atirador && this.folego < 0.99) {
        g.fillStyle = '#000'; g.fillRect(meio - 14, topo + 5, 28, 2);
        g.fillStyle = this.folego < 0.25 ? '#a06a20' : '#f0c040'; g.fillRect(meio - 13, topo + 5, Math.max(0, Math.round(26 * this.folego)), 1);
      }
    }
    g.fillStyle = '#000'; g.fillRect(meio - 14, topo - 1, 28, 4);
    g.fillStyle = cor; g.fillRect(meio - 13, topo, Math.max(0, Math.round(26 * c.vida)), 2);
    for (let k = 0; k < (c.acumulos || 0); k++) {        // acúmulos de Hemorragia
      g.fillStyle = '#000'; g.fillRect(meio - 10 + k * 4, topo + 4, 3, 3);
      g.fillStyle = '#d01818'; g.fillRect(meio - 9 + k * 4, topo + 5, 1, 1);
    }
  }

  desenharEfeito(g, e) {
    const k = e.t / e.dur;
    if (e.tipo.startsWith('kat')) return this.efeitoKatarina(g, e, k);
    if (e.tipo.startsWith('taric')) return this.efeitoTaric(g, e, k);
    if (e.tipo.startsWith('zac')) return this.efeitoZac(g, e, k);
    const base = e.fixo || (e.alvo ? (this.criaturas.has(e.alvo.id) || e.alvo.arenaJog || e.alvo.aliado ? this.pos(e.alvo) : e) : this.pos(this.darius));      // segue o monstro ou o jogador de Runeterra
    const x = base.px + 16, y = base.py + 18;
    if (e.tipo === 'tiro' || e.tipo === 'disparo' || e.tipo === 'orbe') {
      // projétil saindo da manopla (ou de outro monstro, no ricochete) até o alvo, com rastro
      const d = e.de && this.criaturas.has(e.de.id) ? this.pos(e.de) : this.pos(this.darius), ox = d.px + 16, oy = d.py + 15;
      const q = Math.min(1, k * 1.25), bx = ox + (x - ox) * q, by = oy + (y - 4 - oy) * q;
      const ang = Math.atan2(y - 4 - oy, x - ox), grande = e.tipo !== 'tiro';
      if (q < 1) {
        for (let i = 1; i <= (grande ? 6 : 4); i++) {
          g.globalAlpha = (1 - i / 7) * 0.8;
          g.fillStyle = e.tipo === 'orbe' ? '#c890ff' : e.cor || '#ffe080';
          const s2 = grande ? 3 : 2;
          g.fillRect(Math.round(bx - Math.cos(ang) * i * 3) - 1, Math.round(by - Math.sin(ang) * i * 3) - 1, s2, s2);
        }
        g.globalAlpha = 1;
        const cr = e.tipo === 'orbe' ? '#b060ff' : e.cor && e.cor.length === 7 ? e.cor : '#ffd060';
        if (Math.random() < (grande ? 0.9 : 0.5)) this.fx.add({ x: bx, y: by, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, cor: cr, brilho: true, vida: grande ? 0.35 : 0.2, tam: grande ? 2 : 1.3, encolhe: true });
        if (e.tipo === 'disparo' && e.cor === '#7ad8ff') for (const lado of [-1, 1]) {   // Q: espiral de energia em volta
          const a3 = k * 30 + lado * Math.PI / 2;
          this.fx.add({ x: bx + Math.cos(ang + Math.PI / 2) * Math.sin(a3) * 4, y: by + Math.sin(ang + Math.PI / 2) * Math.sin(a3) * 4, cor: lado > 0 ? '#c8f4ff' : '#30c8ff', brilho: true, vida: 0.25, tam: 1.2 });
        }
        if (e.tipo === 'orbe') { g.fillStyle = '#c890ff'; g.beginPath(); g.arc(bx, by, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe080'; g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2); }
        else {
          const r1 = grande ? 9 : 5, r2 = grande ? 6 : 3;
          g.strokeStyle = e.cor || '#ffe080'; g.lineWidth = grande ? 4 : 2;
          g.beginPath(); g.moveTo(bx - Math.cos(ang) * r1, by - Math.sin(ang) * r1); g.lineTo(bx, by); g.stroke();
          g.strokeStyle = '#ffffff'; g.lineWidth = grande ? 1.5 : 1;
          g.beginPath(); g.moveTo(bx - Math.cos(ang) * r2, by - Math.sin(ang) * r2); g.lineTo(bx, by); g.stroke();
        }
      } else if (grande) {
        g.globalAlpha = Math.max(0, 1 - k) * 4; g.fillStyle = e.tipo === 'orbe' ? '#c890ff' : e.cor || '#ffe080';
        g.beginPath(); g.arc(x, y - 4, 6, 0, Math.PI * 2); g.fill();
      }
    } else if (e.tipo === 'garra') {
      const a = 1 - k;
      g.globalAlpha = a; g.strokeStyle = e.cor || '#ff4a3a'; g.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const ox = x + i * 5, f = Math.min(1, k * 3);
        g.beginPath(); g.moveTo(ox - 7, y - 12); g.lineTo(ox - 7 + 14 * f, y - 12 + 18 * f); g.stroke();
      }
      g.strokeStyle = '#fff0e0'; g.lineWidth = 1; g.globalAlpha = a * 0.8;
      g.beginPath(); g.moveTo(x - 7, y - 12); g.lineTo(x - 7 + 14 * Math.min(1, k * 3), y - 12 + 18 * Math.min(1, k * 3)); g.stroke();
      g.globalAlpha = 1;
    } else if (e.tipo === 'detonar') {
      // o orbe explode: anel roxo e dourado
      g.globalAlpha = 1 - k; g.strokeStyle = '#c890ff'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y - 4, 4 + k * 14, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#ffe080'; g.lineWidth = 1; g.beginPath(); g.arc(x, y - 4, 2 + k * 10, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 8; i++) { const a2 = i * 0.785, r2 = 4 + k * 16; g.fillStyle = i % 2 ? '#ffffff' : '#c890ff'; g.fillRect(Math.round(x + Math.cos(a2) * r2) - 1, Math.round(y - 4 + Math.sin(a2) * r2) - 1, 2, 2); }
    } else if (e.tipo === 'translocar') {
      // brilho dourado de teletransporte
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#ffd860'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 8, 4 + k * 12, 2 + k * 5, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 12; i++) {
        const f = (i / 12 + k) % 1, a2 = i * 0.52;
        g.fillStyle = i % 3 ? '#ffe8a0' : '#7ad8ff';
        g.fillRect(Math.round(x + Math.cos(a2) * (6 + f * 8)), Math.round(y + 8 - f * 26), 2, 2);
      }
    } else if (e.tipo === 'prisao') {
      // Ligação da Luz: dois anéis de luz girando nos pés e faixas subindo
      const pe = y + 10, some = Math.min(1, (1 - k) * 5), aperta = 1 - Math.min(1, k * 6) * 0.35;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [r2, vel, cor2] of [[13, 4, '#fff0a0'], [9, -6, '#ffffff']]) {
        g.globalAlpha = 0.8 * some; g.strokeStyle = cor2; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(x, pe, r2 * aperta, r2 * aperta * 0.4, 0, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 4; i++) { const a2 = this.tempo * vel + (i * Math.PI) / 2; g.fillStyle = cor2; g.fillRect(Math.round(x + Math.cos(a2) * r2 * aperta) - 1, Math.round(pe + Math.sin(a2) * r2 * aperta * 0.4) - 1, 2, 2); }
      }
      for (let i = 0; i < 3; i++) {
        const a2 = this.tempo * 3 + i * 2.09, fx2 = x + Math.cos(a2) * 10 * aperta, alto = 14 + 4 * Math.sin(this.tempo * 6 + i);
        g.globalAlpha = 0.35 * some; g.fillStyle = '#fff0a0'; g.fillRect(Math.round(fx2) - 1, Math.round(pe - alto), 2, alto);
      }
      g.restore();
    } else if (e.tipo === 'barreira') {
      // Barreira Prismática: bolha de luz com a borda nas cores do prisma, cristais girando e um brilho que passa por ela
      const some = Math.min(1, (1 - k) * 4) * Math.min(1, k * 8), cx = x, cy = y - 1, rx = 17, ry = 20;
      const cores = ['#ff9ae0', '#fff0a0', '#9ad8ff', '#c8a0ff', '#a0ffd0', '#ffc890'];
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, ry);
      gr.addColorStop(0, 'rgba(255,240,250,0)'); gr.addColorStop(0.75, 'rgba(255,190,235,0.10)'); gr.addColorStop(1, 'rgba(255,225,248,0.38)');
      g.globalAlpha = some; g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 6; i++) {
        const a0 = this.tempo * 1.6 + (i * Math.PI) / 3;
        g.globalAlpha = 0.85 * some; g.strokeStyle = cores[i]; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, a0, a0 + Math.PI / 3 - 0.1); g.stroke();
      }
      const sw = ((this.tempo * 0.9) % 1) * 2 - 1;
      g.globalAlpha = 0.4 * some; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx * Math.abs(sw)), ry - 1, 0, -Math.PI / 2, Math.PI / 2, sw < 0); g.stroke();
      for (let i = 0; i < 3; i++) {       // três cristais de prisma girando em volta
        const a2 = -this.tempo * 2.2 + i * 2.094, px2 = cx + Math.cos(a2) * (rx + 3), py2 = cy + 4 + Math.sin(a2) * ry * 0.5;
        g.globalAlpha = some; g.fillStyle = cores[i * 2];
        g.beginPath(); g.moveTo(px2, py2 - 3.5); g.lineTo(px2 + 2.2, py2); g.lineTo(px2, py2 + 3.5); g.lineTo(px2 - 2.2, py2); g.closePath(); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(px2) - 1, Math.round(py2) - 2, 1, 2);
      }
      g.restore();
    } else if (e.tipo === 'varinha') {
      // a varinha vai girando até o alvo e volta para a mão da Lux
      const m0 = this.mao(), q = k < 0.5 ? k * 2 : (1 - k) * 2;
      const bx = m0.x + (x - m0.x) * q, by = m0.y + (y - 4 - m0.y) * q - Math.sin(q * Math.PI) * 8;
      this.desenharVarinha(g, bx, by, this.tempo * 18); this.rastroPrisma(bx, by);
    } else if (e.tipo === 'lancaGelo') {
      // Lança de Luz saindo do cajado até o monstro mais distante
      const m0 = this.mao(), q = Math.min(1, k * 1.1), bx = m0.x + (x - m0.x) * q, by = m0.y + (y - 4 - m0.y) * q;
      this.desenharGelo(g, bx, by, Math.atan2(y - 4 - m0.y, x - m0.x));
    } else if (e.tipo === 'congelado') {
      // o monstro preso num bloco de gelo
      const some = Math.min(1, (1 - k) * 5) * Math.min(1, k * 10), pe = y + 10;
      const cristais = [[-9, 14, 6], [-4, 24, 7], [3, 21, 7], [9, 15, 6], [0, 12, 8]];
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 * some; g.fillStyle = '#fff0a0';
      for (const [dx, h, w] of cristais) { g.beginPath(); g.moveTo(x + dx - w / 2, pe); g.lineTo(x + dx, pe - h); g.lineTo(x + dx + w / 2, pe); g.closePath(); g.fill(); }
      g.globalAlpha = 0.95 * some; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
      for (const [dx, h, w] of cristais) { g.beginPath(); g.moveTo(x + dx - w / 2, pe); g.lineTo(x + dx, pe - h); g.lineTo(x + dx + w / 2, pe); g.stroke(); }
      g.globalAlpha = 0.5 * some; g.fillStyle = '#ffffff'; g.fillRect(x - 5, pe - 18, 1, 6); g.fillRect(x + 2, pe - 14, 1, 4);
      g.restore();
    } else if (e.tipo === 'convergindo') {
      // Convergência Radiante: um círculo de runas de luz se fecha no chão, com raios puxando a luz para o meio
      const cx = e.cx, cy = e.cy, R = e.raio || 46, f = 1 - k * 0.5, pul = 0.5 + 0.5 * Math.sin(this.tempo * 20);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.1 + 0.3 * k; g.fillStyle = '#fff0a0'; g.beginPath(); g.ellipse(cx, cy, R * f, R * f * 0.42, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.85; g.strokeStyle = '#ffe070'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(cx, cy, R * f, R * f * 0.42, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.7; g.strokeStyle = '#ff9ae0'; g.lineWidth = 1; g.setLineDash([4, 5]); g.lineDashOffset = -this.tempo * 40;
      g.beginPath(); g.ellipse(cx, cy, R * f * 0.66, R * f * 0.28, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 8; i++) {           // runas girando no anel
        const a2 = this.tempo * 1.6 + (i * Math.PI) / 4, rx = cx + Math.cos(a2) * R * f, ry = cy + Math.sin(a2) * R * f * 0.42;
        g.globalAlpha = 0.95; g.fillStyle = i % 2 ? '#ffffff' : '#fff0a0';
        g.beginPath(); g.moveTo(rx, ry - 3); g.lineTo(rx + 2, ry); g.lineTo(rx, ry + 3); g.lineTo(rx - 2, ry); g.closePath(); g.fill();
        g.globalAlpha = 0.25 + 0.35 * k; g.strokeStyle = '#fff0a0'; g.beginPath(); g.moveTo(rx, ry); g.lineTo(cx, cy); g.stroke();
      }
      g.globalAlpha = 0.6 + 0.4 * k; g.drawImage(halo(this.corSkin('#fff0a0')), cx - 10 - k * 14, cy - 10 - k * 14, 20 + k * 28, 20 + k * 28);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 1.5 + k * 3 + pul, 0, Math.PI * 2); g.fill();
      g.restore();
      if (Math.random() < 0.9) { const a2 = Math.random() * 6.28; this.fx.add({ x: cx + Math.cos(a2) * R * f, y: cy + Math.sin(a2) * R * f * 0.42, vx: -Math.cos(a2) * R * 2.2, vy: -Math.sin(a2) * R * 0.9, cor: Math.random() < 0.5 ? '#fff0a0' : '#ffffff', brilho: true, vida: 0.35, tam: 1.4 }); }
    } else if (e.tipo === 'luzCura') {
      // Prisma Regenerador: uma coluna de luz sobe em volta da Lux, com cristais girando e brilhos de cura
      const pe = y + 10, some = Math.min(1, (1 - k) * 3), alto = Math.min(1, k * 3) * 44;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, pe - alto, 0, pe);
      gr.addColorStop(0, 'rgba(255,240,180,0)'); gr.addColorStop(1, 'rgba(255,240,190,0.5)');
      g.globalAlpha = some; g.fillStyle = gr; g.fillRect(x - 10, pe - alto, 20, alto);
      for (let i = 0; i < 3; i++) {
        const f = (k * 1.4 + i / 3) % 1;
        g.globalAlpha = (1 - f) * 0.85 * some; g.strokeStyle = ['#fff0a0', '#ff9ae0', '#c8ffe0'][i]; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(x, pe - f * 36, 13 - f * 4, 4.5 - f * 1.2, 0, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a2 = this.tempo * 3 + i * 2.09, px2 = x + Math.cos(a2) * 13, py2 = pe - 10 - k * 22 + Math.sin(a2) * 4;
        g.globalAlpha = some; g.fillStyle = ['#ff9ae0', '#fff0a0', '#bfe8ff'][i];
        g.beginPath(); g.moveTo(px2, py2 - 4); g.lineTo(px2 + 2.4, py2); g.lineTo(px2, py2 + 4); g.lineTo(px2 - 2.4, py2); g.closePath(); g.fill();
      }
      g.restore();
      if (Math.random() < 0.8) this.fx.add({ x: x + (Math.random() - 0.5) * 22, y: pe - Math.random() * 16, vx: (Math.random() - 0.5) * 10, vy: -30 - Math.random() * 30, cor: Math.random() < 0.5 ? '#c8ffe0' : '#fff0a0', brilho: true, forma: 'estrela', vida: 0.8, tam: 1.6, encolhe: true });
    } else if (e.tipo === 'meteoro') {
      // Chuva de Luz: um raio de luz desce do céu até o alvo, com uma esfera brilhante na ponta
      const q = Math.min(1, k), mx = x + 40 * (1 - q), my = y + 4 - 170 * (1 - q), ux = 40 / 174, uy = -170 / 174;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const [l, cor2, al, comp] of [[16, '255,154,224', 0.3, 90], [9, '255,240,160', 0.6, 66], [3.5, '255,255,255', 0.95, 48]]) {
        const gr = g.createLinearGradient(mx, my, mx + ux * comp, my + uy * comp);
        gr.addColorStop(0, `rgba(${cor2},${al})`); gr.addColorStop(1, `rgba(${cor2},0)`);
        g.strokeStyle = gr; g.lineWidth = l; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + ux * comp, my + uy * comp); g.stroke();
      }
      g.globalAlpha = 0.9; g.drawImage(halo(this.corSkin('#ff9ae0')), mx - 16, my - 16, 32, 32);
      g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mx, my, 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff0a0'; g.lineWidth = 1.2; g.beginPath(); g.arc(mx, my, 6.5, 0, Math.PI * 2); g.stroke();
      g.restore();
      if (Math.random() < 0.9) this.fx.add({ x: mx + ux * 8, y: my + uy * 8, vx: (Math.random() - 0.5) * 24, vy: -6 - Math.random() * 12, cor: Math.random() < 0.5 ? '#fff0a0' : '#ff9ae0', brilho: true, forma: 'estrela', vida: 0.5, tam: 1.5, encolhe: true });
    } else if (e.tipo === 'cratera') {
      // onde o raio caiu: uma marca de luz no chão com raios curtos, que vai apagando
      const some = 1 - k;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 * some; g.fillStyle = '#fff0a0'; g.beginPath(); g.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.7 * some; g.strokeStyle = '#ff9ae0'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, 10 + k * 12, (10 + k * 12) * 0.38, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = Math.max(0, 1 - k * 1.8); g.strokeStyle = '#ffffff'; g.lineWidth = 1;
      g.beginPath(); for (let i = 0; i < 8; i++) { const a2 = i * 0.785 + 0.2; g.moveTo(x + Math.cos(a2) * 4, y + Math.sin(a2) * 1.5); g.lineTo(x + Math.cos(a2) * 15, y + Math.sin(a2) * 5.5); } g.stroke();
      g.restore();
      if (k < 0.5 && Math.random() < 0.3) this.fx.add({ x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 6, vy: -18 - Math.random() * 14, cor: '#fff0a0', brilho: true, forma: 'estrela', vida: 0.8, tam: 1.4, encolhe: true });
    } else if (e.tipo === 'prismaLux') {
      // um prisma de cristal aparece girando acima do cajado
      const m0 = this.mao(), px2 = m0.x, py2 = m0.y - 8, a0 = this.tempo * 8, r2 = 5 * Math.min(1, k * 4) * (1 - Math.max(0, k - 0.7) * 3);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.7; g.drawImage(halo(this.corSkin('#ffd0ff')), px2 - 14, py2 - 14, 28, 28);
      g.globalAlpha = 0.95; g.fillStyle = 'rgba(220,240,255,0.55)'; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
      g.beginPath(); for (let i = 0; i < 3; i++) { const a2 = a0 + (i * Math.PI * 2) / 3; g[i ? 'lineTo' : 'moveTo'](px2 + Math.cos(a2) * r2, py2 + Math.sin(a2) * r2); } g.closePath(); g.fill(); g.stroke();
      g.restore();
    } else if (e.tipo === 'raioPrisma') {
      // um raio de uma cor do prisma, do cajado até o monstro
      const m0 = this.mao(), ox = m0.x, oy = m0.y - 8, q = Math.min(1, k * 3), tx = ox + (x - ox) * q, ty = oy + (y - 4 - oy) * q, some = 1 - Math.max(0, k - 0.4) / 0.6;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      g.globalAlpha = 0.45 * some; g.strokeStyle = e.cor; g.lineWidth = 5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(tx, ty); g.stroke();
      g.globalAlpha = 0.95 * some; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(tx, ty); g.stroke();
      g.globalAlpha = some; g.drawImage(halo(e.cor), tx - 9, ty - 9, 18, 18);
      g.restore();
    } else if (e.tipo === 'estrelaCai') {
      // uma estrela riscando o céu até o alvo
      const q = Math.min(1, k), sx = x + 46 * (1 - q), sy = y - 4 - 110 * (1 - q);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      g.globalAlpha = 0.5; g.strokeStyle = '#ff9ae0'; g.lineWidth = 4; g.beginPath(); g.moveTo(sx + 16, sy - 38); g.lineTo(sx, sy); g.stroke();
      g.globalAlpha = 0.95; g.strokeStyle = '#fff0a0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx + 12, sy - 28); g.lineTo(sx, sy); g.stroke();
      g.globalAlpha = 0.9; g.drawImage(halo(this.corSkin('#fff0a0')), sx - 11, sy - 11, 22, 22);
      g.restore();
      estrela5(g, sx, sy, 4.5, '#fff8d0');
    } else if (e.tipo === 'tornadoVento') {
      // Tempestade de Aço (3ª): funil de vento azul-claro girando, que anda (Runeterra) ou vai até o meio do grupo (Rift)
      let cx = e.ox + e.vx * e.t, cy = e.oy + e.vy * e.t;
      if (e.meio) { const q = Math.min(1, e.t / 0.35); cx = e.ox + (e.meio.x - e.ox) * q; cy = e.oy + (e.meio.y - e.oy) * q; }
      const al = Math.min(1, e.t / 0.12) * Math.min(1, (e.dur - e.t) / 0.25), H = 60 * (e.largo ? 0.8 : 1), lg = e.largo || 1;
      g.save(); g.globalAlpha = 0.3 * al; g.fillStyle = '#bfe8ff'; g.beginPath(); g.ellipse(cx, cy, 22 * lg, 7 * lg, 0, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3 * al; g.drawImage(halo(e.skin ? this.corSkin('#bfe8ff') : '#bfe8ff'), cx - 34 * lg, cy - H / 2 - 30, 68 * lg, 68);
      // o funil: anéis girando, fino embaixo e largo em cima, com um contorno claro
      for (let i = 0; i < 16; i++) {
        const f = i / 15, ry = cy - f * H, r2 = (4 + f * f * 20) * lg + Math.sin(this.tempo * 12 + i) * 1.4, desvio = Math.sin(this.tempo * 7 + f * 4) * 4 * f;
        const a0 = this.tempo * 18 + i * 0.9;
        g.globalAlpha = (0.85 - f * 0.3) * al; g.strokeStyle = f < 0.35 ? '#8ac8f0' : f < 0.7 ? '#bfe8ff' : '#ffffff'; g.lineWidth = 2.8 - f * 1.4;
        g.beginPath(); g.ellipse(cx + desvio, ry, r2, r2 * 0.32, 0, a0, a0 + Math.PI * 1.45); g.stroke();
      }
      for (const lado of [-1, 1]) { g.globalAlpha = 0.5 * al; g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= 10; i++) { const f = i / 10; g[i ? 'lineTo' : 'moveTo'](cx + lado * (4 + f * f * 20) * lg + Math.sin(this.tempo * 7 + f * 4) * 4 * f, cy - f * H); } g.stroke(); }
      g.restore();
      // poeira e folhas girando em volta
      if (al > 0.3) for (let i = 0; i < 2; i++) { const a2 = Math.random() * Math.PI * 2, r3 = 6 + Math.random() * 16 * lg; this.fx.add({ x: cx + Math.cos(a2) * r3, y: cy - Math.random() * H * 0.7, vx: -Math.sin(a2) * 60, vy: -25, cor: Math.random() < 0.3 ? '#b8a07a' : Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', brilho: true, vida: 0.35, tam: 1.3 }); }
    } else if (e.tipo === 'paredeVento') {
      // Parede de Vento: uma cortina de vento translúcida, curva, na frente do Yasuo; o vento corre de um lado para o outro
      const ab = Math.min(1, e.t / 0.25), al = ab * Math.min(1, (e.dur - e.t) / 0.4), px2 = -e.vy, py2 = e.vx, L = 32 * (0.4 + 0.6 * ab), H = 46, cor = '#bfe8ff';
      const ponto = (f) => ({ x: e.cx + px2 * L * f + e.vx * (1 - f * f) * 8, y: e.cy + py2 * L * f * 0.55 + e.vy * (1 - f * f) * 8 });
      g.save(); g.globalCompositeOperation = 'lighter';
      // o corpo da parede: faixas verticais com degradê (forte embaixo, some em cima)
      for (let k = -12; k < 12; k++) {
        const a0 = ponto(k / 12), a1 = ponto((k + 1) / 12), borda = 1 - Math.abs(k + 0.5) / 12;
        const gr = g.createLinearGradient(0, a0.y, 0, a0.y - H);
        const pulso = 0.85 + 0.15 * Math.sin(this.tempo * 8 + k * 0.7);
        gr.addColorStop(0, `rgba(210,240,255,${0.75 * al * (0.45 + 0.55 * borda) * pulso})`); gr.addColorStop(0.55, `rgba(160,215,250,${0.4 * al * pulso})`); gr.addColorStop(1, 'rgba(191,232,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(a0.x, a0.y); g.lineTo(a1.x, a1.y); g.lineTo(a1.x, a1.y - H); g.lineTo(a0.x, a0.y - H); g.closePath(); g.fill();
      }
      // as bordas e a base brilhando
      for (const f of [-1, 1]) { const q = ponto(f); g.globalAlpha = al * 0.8; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x, q.y - H * 0.9); g.stroke(); }
      g.globalAlpha = al * 0.95; g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k <= 24; k++) { const q = ponto(k / 12 - 1); g[k ? 'lineTo' : 'moveTo'](q.x, q.y); } g.stroke();
      // a crista ondulando no alto da parede
      g.globalAlpha = al * 0.7; g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k <= 24; k++) { const q = ponto(k / 12 - 1); g[k ? 'lineTo' : 'moveTo'](q.x, q.y - H * 0.78 - Math.sin(k * 0.9 + this.tempo * 7) * 2.5); } g.stroke();
      // o vento correndo: riscos curvos andando de um lado para o outro, em várias alturas
      for (let j = 0; j < 9; j++) {
        const h = 4 + (j * 37) % (H - 6), f0 = ((this.tempo * 1.4 + j * 0.37) % 2) - 1, f1 = Math.min(1, f0 + 0.35);
        g.globalAlpha = al * (0.4 + 0.5 * Math.sin(Math.PI * (f0 + 1) / 2)); g.strokeStyle = j % 3 ? cor : '#ffffff'; g.lineWidth = 1.2;
        g.beginPath(); for (let k = 0; k <= 6; k++) { const q = ponto(f0 + (f1 - f0) * k / 6); g[k ? 'lineTo' : 'moveTo'](q.x, q.y - h - Math.sin(k + this.tempo * 6) * 1.5); } g.stroke();
      }
      const fl = Math.max(0, 1 - (this.tempo - (e.flashT ?? -9)) / 0.45);
      if (fl > 0) {
        g.globalAlpha = al * fl * 0.22; g.fillStyle = '#bfe8ff'; g.beginPath();
        for (let j = 0; j <= 24; j++) { const q = ponto(j / 12 - 1); g[j ? 'lineTo' : 'moveTo'](q.x, q.y); }
        for (let j = 24; j >= 0; j--) { const q = ponto(j / 12 - 1); g.lineTo(q.x, q.y - H * 0.85); }
        g.closePath(); g.fill();
        g.globalAlpha = al * fl; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
        for (const r2 of [1, 0.6]) { g.beginPath(); g.ellipse(e.flashX, e.flashY, (6 + (1 - fl) * 26) * r2, (4 + (1 - fl) * 14) * r2, 0, 0, Math.PI * 2); g.stroke(); }
      }
      g.restore();
    } else if (e.tipo === 'tiroAte') {
      // um tiro voando até a Parede de Vento
      const q = Math.min(1, k), bx = e.ox + (e.ex - e.ox) * q, by = e.oy + (e.ey - e.oy) * q, ang = Math.atan2(e.ey - e.oy, e.ex - e.ox), r2 = e.grande ? 4 : 2.5;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8; g.drawImage(halo(e.cor), bx - r2 * 4, by - r2 * 4, r2 * 8, r2 * 8);
      for (let i = 1; i <= 6; i++) { g.globalAlpha = (1 - i / 7) * 0.8; g.fillStyle = e.cor; g.fillRect(Math.round(bx - Math.cos(ang) * i * 3) - 1, Math.round(by - Math.sin(ang) * i * 3) - 1, 3, 3); }
      g.restore();
      g.fillStyle = e.cor; g.beginPath(); g.arc(bx, by, r2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx, by, r2 * 0.45, 0, Math.PI * 2); g.fill();
    } else if (e.tipo === 'impactoVento') {
      // o golpe batendo na Parede de Vento: o vento se curva para quem atirou, em ondas, e o golpe se desfaz
      const px2 = -e.uy, py2 = e.ux, al = 1 - k;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const hr = e.forte ? 34 : 22; g.globalAlpha = al * 0.9; g.drawImage(halo(e.cores[0]), e.cx - hr, e.cy - hr, hr * 2, hr * 2);
      for (let j = 0; j < 3; j++) {
        const q = Math.min(1, k * 1.6 + j * 0.15), R = (e.forte ? 16 : 11) + q * (e.forte ? 16 : 11), cava = R * 0.45 * (1 - q * 0.5);
        for (const [lw, cor, a2] of [[5, '#5ab0e8', 0.35], [2.5, '#bfe8ff', 0.7], [1.2, '#ffffff', 1]]) {
          g.globalAlpha = al * a2 * (1 - j * 0.28); g.strokeStyle = cor; g.lineWidth = lw * (1 - j * 0.2); g.beginPath();
          for (let i = 0; i <= 12; i++) {
            const s2 = i / 6 - 1, curva = (1 - s2 * s2) * cava + j * 3;
            g[i ? 'lineTo' : 'moveTo'](e.cx + px2 * s2 * R - e.ux * curva, e.cy + py2 * s2 * R * 0.8 - e.uy * curva);
          }
          g.stroke();
        }
      }
      g.restore();
    } else if (e.tipo === 'estocadaVento') {
      // Tempestade de Aço (estocada) e Lâmina do Vendaval: uma lança de vento que sai da katana; lua: a lâmina larga em meia-lua
      const q = Math.min(1, e.t / (e.dur * 0.35)), al = Math.min(1, (e.dur - e.t) / (e.dur * 0.6)), comp = e.comp * q, w = e.larg;
      const px2 = -e.vy, py2 = e.vx, bx = e.ox, by = e.oy, tx = bx + e.vx * comp, ty = by + e.vy * comp;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [k, cor, a2] of [[1.8, '#3a7ab8', 0.35], [1.1, '#9ad8ff', 0.6], [0.45, '#ffffff', 1]]) {
        g.globalAlpha = al * a2; g.fillStyle = cor; g.beginPath();
        if (e.lua) {           // meia-lua: a frente curva e larga
          const mx = tx - e.vx * w, my = ty - e.vy * w;
          g.moveTo(bx + px2 * w * 0.3 * k, by + py2 * w * 0.3 * k); g.quadraticCurveTo(mx + px2 * w * 2 * k, my + py2 * w * 2 * k, tx + px2 * w * 1.6 * k, ty + py2 * w * 1.6 * k);
          g.quadraticCurveTo(tx + e.vx * w * 0.8, ty + e.vy * w * 0.8, tx - px2 * w * 1.6 * k, ty - py2 * w * 1.6 * k);
          g.quadraticCurveTo(mx - px2 * w * 2 * k, my - py2 * w * 2 * k, bx - px2 * w * 0.3 * k, by - py2 * w * 0.3 * k);
        } else { g.moveTo(bx + px2 * w * k, by + py2 * w * k); g.lineTo(tx, ty); g.lineTo(bx - px2 * w * k, by - py2 * w * k); }
        g.closePath(); g.fill();
      }
      // riscos de velocidade dos lados
      g.globalAlpha = al * 0.7; g.strokeStyle = '#d8f0ff'; g.lineWidth = 1;
      for (const lado of [-1, 1]) for (let j = 1; j <= 2; j++) { const o = lado * (w + j * 3); g.beginPath(); g.moveTo(bx + px2 * o + e.vx * comp * 0.15, by + py2 * o + e.vy * comp * 0.15); g.lineTo(bx + px2 * o + e.vx * comp * (0.55 + j * 0.1), by + py2 * o + e.vy * comp * (0.55 + j * 0.1)); g.stroke(); }
      g.globalAlpha = al; g.drawImage(halo(e.skin ? this.corSkin('#bfe8ff') : '#bfe8ff'), tx - 10, ty - 10, 20, 20);
      g.restore();
    } else if (e.tipo === 'fantasmaYasuo') {
      // cópias de vento do Yasuo (avanços, Último Suspiro, Dança): o sprite tingido de azul-claro, sumindo
      const al = 1 - e.t / e.dur, s0 = sprite(e.nome, e.dir, e.quadro), tint = tingido(s0, e.tinta ? this.corSkin(e.tinta) : e.skin ? this.corSkin('#bfe8ff') : '#bfe8ff');
      g.save();
      e.pts.forEach((q, k) => {
        const forca = e.forte ? 1 : (k + 1) / e.pts.length;
        g.globalAlpha = al * 0.85 * forca; g.drawImage(tint, Math.round(q.x), Math.round(q.y));
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * 0.4 * forca; g.drawImage(tint, Math.round(q.x), Math.round(q.y)); g.globalCompositeOperation = 'source-over';
        if (e.forte) { g.globalAlpha = al * 0.8; g.drawImage(s0, Math.round(q.x), Math.round(q.y)); g.globalCompositeOperation = 'lighter'; g.globalAlpha = al * 0.35; g.drawImage(tint, Math.round(q.x), Math.round(q.y)); g.globalCompositeOperation = 'source-over'; }
      });
      g.restore();
    } else if (e.tipo === 'cortesX') {
      // Último Suspiro: dois cortes enormes em X sobre o alvo, um depois do outro
      const al = Math.min(1, (e.dur - e.t) / (e.dur * 0.5));
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      [[-0.7, 0], [0.7, 0.35]].forEach(([ang, atraso]) => {
        const q = Math.min(1, Math.max(0, (e.t / e.dur - atraso * 0.4) / 0.25)); if (q <= 0) return;
        const dx = Math.cos(ang) * e.tam, dy = Math.sin(ang) * e.tam;
        for (const [w, cor, a2] of [[7, e.cor, 0.35], [3.5, e.cor, 0.7], [1.4, '#ffffff', 1]]) {
          g.globalAlpha = al * a2; g.strokeStyle = cor; g.lineWidth = w;
          g.beginPath(); g.moveTo(e.cx - dx, e.cy - dy); g.lineTo(e.cx - dx + 2 * dx * q, e.cy - dy + 2 * dy * q); g.stroke();
        }
      });
      g.restore();
    } else if (e.tipo === 'corteVento') {
      // corte de vento em meia-lua sobre o alvo: núcleo branco e a borda da cor do golpe
      const al = 1 - k, s2 = (e.tam || 1) * 15, a0 = -2.4 + (e.giro || 0), q = Math.min(1, k * 3.5);
      g.save(); g.translate(x, y - 8); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = al; g.strokeStyle = e.cor || '#bfe8ff'; g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, s2, a0, a0 + q * 2.4); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, s2, a0, a0 + q * 2.4); g.stroke();
      g.restore();
    } else if (e.tipo === 'rastroVento') {
      // o avanço da Espada Ágil e da Investida: um risco de vento do ponto de saída até o alvo
      const al = 1 - k, q = Math.min(1, k / 0.35);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const ex = e.ox + (e.ex - e.ox) * q, ey = e.oy + (e.ey - e.oy) * q;
      for (const [w, cor, a2] of [[12, '#3a7ab8', 0.3], [6, '#bfe8ff', 0.6], [2, '#ffffff', 0.95]]) { g.globalAlpha = al * a2; g.strokeStyle = cor; g.lineWidth = w * (1 - k * 0.5); g.beginPath(); g.moveTo(e.ox, e.oy); g.lineTo(ex, ey); g.stroke(); }
      g.restore();
    } else if (e.tipo === 'tornado') {
      // Furacão de Luz: funil de anéis de luz girando, estreito embaixo e largo em cima, que anda pelo chão
      // no Rift ele vai até o meio do grupo e fica girando ali; em Runeterra anda em linha reta
      let cx = e.ox + e.vx * e.t, cy = e.oy + e.vy * e.t;
      if (e.meio) {
        const q = Math.min(1, e.t / 0.6), w = Math.max(0, e.t - 0.6) * 2.4;
        cx = q < 1 ? e.ox + (e.meio.x - e.ox) * q : e.meio.x + Math.sin(w) * 20;
        cy = q < 1 ? e.oy + (e.meio.y - e.oy) * q : e.meio.y + Math.sin(w * 2) * 5;
      }
      const al = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.4), H = 66;
      g.save(); g.globalAlpha = 0.3 * al; g.fillStyle = '#ff9ae0'; g.beginPath(); g.ellipse(cx, cy, 24, 8, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.25 * al; g.fillStyle = '#fff0f8'; g.beginPath(); g.ellipse(cx, cy, 12, 4, 0, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28 * al; g.drawImage(halo(this.corSkin('#ff9ae0')), cx - 34, cy - H / 2 - 30, 68, 68);
      for (let i = 0; i < 16; i++) {
        const f = i / 15, ry = cy - f * H, r2 = 5 + f * f * 24 + Math.sin(this.tempo * 9 + i) * 1.5, desvio = Math.sin(this.tempo * 5 + f * 4) * 5 * f;
        const cor = f < 0.25 ? '#ff7ad8' : f < 0.55 ? '#ffb8ec' : f < 0.85 ? '#fff0a0' : '#ffffff';
        const a0 = this.tempo * 13 + i * 0.9;
        g.globalAlpha = (0.65 - f * 0.25) * al; g.strokeStyle = cor; g.lineWidth = 2.6 - f * 1.2;
        g.beginPath(); g.ellipse(cx + desvio, ry, r2, r2 * 0.32, 0, a0, a0 + Math.PI * 1.35); g.stroke();
      }
      g.globalAlpha = 0.5 * al; g.strokeStyle = '#fff0a0'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, cy); for (let i = 1; i <= 10; i++) { const f = i / 10; g.lineTo(cx + Math.sin(this.tempo * 10 + f * 9) * (3 + f * 14), cy - f * H); } g.stroke();
      g.restore();
      if (al > 0.2) {
        for (let i = 0; i < 4; i++) {
          const a2 = Math.random() * 6.28, f = Math.random();
          this.fx.add({ x: cx + Math.cos(a2) * (5 + f * 20), y: cy - f * H, vx: -Math.sin(a2) * 60, vy: -40 - Math.random() * 40, cor: ['#ff9ae0', '#fff0a0', '#bfe8ff'][i % 3], brilho: true, forma: 'estrela', vida: 0.45, tam: 2, encolhe: true });
        }
        if (Math.random() < 0.5) this.fx.add({ x: cx + (Math.random() - 0.5) * 30, y: cy, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 40, grav: 30, cor: '#ffffff', brilho: true, forma: 'estrela', vida: 0.9, tam: 1.2 });
        if (Math.random() < 0.2) this.acender(cx, cy - 22, 60, '#ffd0f0', 0.25, 0.6);
      }
    } else if (e.tipo === 'miraLux') {
      // a mira da Centelha Final: linha tracejada que pisca, e a luz sendo puxada para o cristal
      const m0 = this.mao(), L = e.comp || 620;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 + 0.55 * k; g.strokeStyle = '#ff9ae0'; g.lineWidth = 1 + k * 2;
      g.setLineDash([6, 4]); g.lineDashOffset = -this.tempo * 60;
      g.beginPath(); g.moveTo(m0.x, m0.y); g.lineTo(m0.x + e.vx * L, m0.y + e.vy * L); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 0.5 + 0.5 * k; g.drawImage(halo(this.corSkin('#ff9ae0')), m0.x - 8 - k * 14, m0.y - 8 - k * 14, 16 + k * 28, 16 + k * 28);
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(m0.x, m0.y, 1.5 + k * 2.5, 0, Math.PI * 2); g.fill();
      g.restore();
      for (let i = 0; i < 2; i++) {
        const a2 = Math.random() * 6.28, r2 = 18 + Math.random() * 14;
        this.fx.add({ x: m0.x + Math.cos(a2) * r2, y: m0.y + Math.sin(a2) * r2, vx: (-Math.cos(a2) * r2) / 0.25, vy: (-Math.sin(a2) * r2) / 0.25, cor: Math.random() < 0.5 ? '#ff9ae0' : '#fff0f8', brilho: true, vida: 0.25, tam: 1.3 });
      }
    } else if (e.tipo === 'rastroLuz') {
      // o chão fica marcado de luz por onde a Centelha passou
      const L = e.comp || 620, some = 1 - k;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      g.globalAlpha = 0.25 * some; g.strokeStyle = '#ff9ae0'; g.lineWidth = 10; g.beginPath(); g.moveTo(e.ox, e.oy); g.lineTo(e.ox + e.vx * L, e.oy + e.vy * L); g.stroke();
      g.globalAlpha = 0.35 * some; g.strokeStyle = '#fff0f8'; g.lineWidth = 2; g.beginPath(); g.moveTo(e.ox, e.oy); g.lineTo(e.ox + e.vx * L, e.oy + e.vy * L); g.stroke();
      g.restore();
      if (Math.random() < 0.6 * some) { const d2 = Math.random() * L; this.fx.add({ x: e.ox + e.vx * d2, y: e.oy + e.vy * d2, vx: (Math.random() - 0.5) * 10, vy: -15 - Math.random() * 15, cor: Math.random() < 0.5 ? '#ff9ae0' : '#fff0a0', brilho: true, forma: 'estrela', vida: 0.6, tam: 1.3, encolhe: true }); }
    } else if (e.tipo === 'singularidade') {
      // Singularidade Lucente: a esfera voa em arco, o campo se abre no chão com runas girando e a luz é sugada para o meio
      const q = Math.min(1, k / 0.55), ox = e.de.x + (x - e.de.x) * q, oy = e.de.y + (y - e.de.y) * q - Math.sin(Math.PI * q) * 22;
      const raio = e.raio || 38, pul = 0.5 + 0.5 * Math.sin(this.tempo * 18);
      g.save(); g.globalCompositeOperation = 'lighter';
      if (q >= 1) {
        const f = Math.min(1, (k - 0.55) / 0.2);
        g.globalAlpha = 0.16 + 0.1 * pul; g.fillStyle = '#ff9ae0'; g.beginPath(); g.ellipse(x, y, raio * f, raio * f * 0.45, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.85; g.strokeStyle = '#ffd0f0'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, raio * f, raio * f * 0.45, 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 0.6; g.strokeStyle = '#fff0a0'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, raio * f * 0.6, raio * f * 0.27, 0, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 10; i++) {
          const a2 = this.tempo * 2.4 + i * 0.628;
          g.globalAlpha = 0.9; g.fillStyle = i % 2 ? '#ffffff' : '#ff9ae0';
          g.fillRect(Math.round(x + Math.cos(a2) * raio * f) - 1, Math.round(y + Math.sin(a2) * raio * f * 0.45) - 1, 2, 2);
        }
        if (Math.random() < 0.8) { const a2 = Math.random() * 6.28; this.fx.add({ x: x + Math.cos(a2) * raio * f, y: y + Math.sin(a2) * raio * f * 0.45, vx: -Math.cos(a2) * raio * 2.5, vy: -Math.sin(a2) * raio * 1.1, cor: Math.random() < 0.5 ? '#ff9ae0' : '#fff0f8', brilho: true, vida: 0.35, tam: 1.4 }); }
      }
      g.globalAlpha = 0.95; g.drawImage(halo(this.corSkin('#ff9ae0')), ox - 16, oy - 16, 32, 32);
      g.fillStyle = '#ffe0f4'; g.beginPath(); g.arc(ox, oy, 4 + pul, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ox, oy, 2, 0, Math.PI * 2); g.fill();
      g.restore();
      if (Math.random() < 0.7) this.fx.add({ x: ox, y: oy, vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24, cor: Math.random() < 0.5 ? '#ff9ae0' : '#ffffff', brilho: true, forma: 'estrela', vida: 0.3, tam: 1.5, encolhe: true });
    } else if (e.tipo === 'centelha') {
      // Centelha Final: um raio de luz enorme, que acende de uma vez e vai afinando
      const L = e.comp || 620, env = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.5), w = 16 * env + 2;
      const ox = e.ox, oy = e.oy, fx2 = ox + e.vx * L, fy2 = oy + e.vy * L;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const [l, cor2, al] of [[w * 2.2, '#ff5ac8', 0.25], [w * 1.4, '#ff9ae0', 0.5], [w * 0.8, '#ffe0f4', 0.85], [w * 0.35, '#ffffff', 1]]) {
        g.globalAlpha = al * Math.min(1, env * 1.5); g.strokeStyle = cor2; g.lineWidth = l;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(fx2, fy2); g.stroke();
      }
      g.globalAlpha = Math.min(1, env * 1.5); g.drawImage(halo(this.corSkin('#ff9ae0')), ox - 30, oy - 30, 60, 60);
      g.restore();
      if (k < 0.7) for (let i = 0; i < 6; i++) {
        const d2 = Math.random() * L, lado = (Math.random() - 0.5) * w;
        this.fx.add({ x: ox + e.vx * d2 - e.vy * lado, y: oy + e.vy * d2 + e.vx * lado, vx: e.vx * 60 + (Math.random() - 0.5) * 40, vy: e.vy * 60 + (Math.random() - 0.5) * 40, cor: Math.random() < 0.5 ? '#ff9ae0' : '#fff0f8', brilho: true, forma: 'faisca', vida: 0.4, atrito: 4, tam: 1.5 });
      }
    } else if (e.tipo === 'canalR') {
      // carregando: runas giram no chão, a energia é sugada para a luva e o brilho cresce
      const m = this.mao(), cx = x, cy = y + 9;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 + 0.5 * k; g.strokeStyle = (e.cor || '#ffb020'); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(cx, cy, 20 - k * 4, 8 - k * 1.5, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 6; i++) {         // runas girando
        const a2 = this.tempo * 3 + (i * Math.PI) / 3;
        g.fillStyle = (e.cor2 || '#ffe080'); g.fillRect(Math.round(cx + Math.cos(a2) * 18) - 1, Math.round(cy + Math.sin(a2) * 7) - 1, 2, 2);
      }
      g.globalAlpha = 0.4 + 0.6 * k; g.drawImage(halo(this.corSkin((e.cor || '#ffb020'))), m.x - 6 - k * 16, m.y - 6 - k * 16, 12 + k * 32, 12 + k * 32);
      g.globalAlpha = 0.6 + 0.4 * k; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(m.x, m.y, 1.5 + k * 3, 0, Math.PI * 2); g.fill();
      g.restore();
      for (let i = 0; i < 3; i++) {          // energia sendo puxada de longe
        const a2 = Math.random() * Math.PI * 2, r2 = 26 + Math.random() * 18;
        this.fx.add({ x: m.x + Math.cos(a2) * r2, y: m.y + Math.sin(a2) * r2 * 0.7, vx: (-Math.cos(a2) * r2) / 0.3, vy: (-Math.sin(a2) * r2 * 0.7) / 0.3, cor: Math.random() < 0.5 ? (e.cor || '#ffb020') : (e.cor2 || '#ffe080'), brilho: true, vida: 0.3, tam: 1.4 });
      }
      if (k > 0.6 && Math.random() < 0.5) this.tremor = Math.max(this.tremor, 0.05);
    } else if (e.tipo === 'barragem') {
      // a onda: uma meia-lua dourada enorme, preenchida de luz, com borda branca, linhas de energia e rastro
      const o = e.onda, dist = e.t * VEL_ONDA, W = 42 + Math.min(1, k * 3) * 22, B = 20;
      const cx = o.ox + o.vx * dist, cy = o.oy + o.vy * dist, nx = -o.vy, ny = o.vx;
      const ponto = (s2, recuo = 0, larg = W) => [cx + nx * s2 * larg - o.vx * (s2 * s2 * B + recuo), cy + ny * s2 * larg * 0.75 - o.vy * (s2 * s2 * B + recuo)];
      const curva = (recuo, larg = W) => { g.beginPath(); for (let i = 0; i <= 16; i++) { const [px2, py2] = ponto(-1 + i / 8, recuo, larg); g[i ? 'lineTo' : 'moveTo'](px2, py2); } };
      const some = Math.min(1, (1 - k) * 4), cor = this.corSkin('#ffb020');
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.globalAlpha = some * 0.35; g.drawImage(halo(cor), cx - o.vx * 30 - 60, cy - o.vy * 30 - 60, 120, 120);     // brilho grande atrás
      for (let j = 7; j >= 1; j--) {         // rastro
        g.globalAlpha = (some * 0.13 * (8 - j)) / 7; g.strokeStyle = j % 2 ? '#ff9a20' : '#ffd060'; g.lineWidth = 11 - j; curva(j * 9, W * (1 - j * 0.03)); g.stroke();
      }
      // o corpo da meia-lua: entre a borda da frente e uma curva de trás mais estreita
      g.beginPath();
      for (let i = 0; i <= 16; i++) { const [px2, py2] = ponto(-1 + i / 8, 0); g[i ? 'lineTo' : 'moveTo'](px2, py2); }
      for (let i = 16; i >= 0; i--) { const [px2, py2] = ponto(-1 + i / 8, B * 0.9, W * 0.82); g.lineTo(px2, py2); }
      g.closePath();
      const gr = g.createRadialGradient(cx, cy, 2, cx, cy, W); gr.addColorStop(0, 'rgba(255,250,220,0.95)'); gr.addColorStop(0.5, 'rgba(255,200,80,0.7)'); gr.addColorStop(1, 'rgba(255,120,20,0.25)');
      g.globalAlpha = some * 0.85; g.fillStyle = gr; g.fill();
      // linhas de energia correndo por dentro
      for (let j = 1; j <= 3; j++) { g.globalAlpha = some * (0.5 + 0.3 * Math.sin(this.tempo * 20 + j)); g.strokeStyle = j === 2 ? '#ffffff' : '#ffe8a0'; g.lineWidth = 1; curva(B * 0.25 * j, W * (1 - 0.06 * j)); g.stroke(); }
      // a borda da frente: grossa e quente por fora, branca por dentro
      for (const [l, cor2, al] of [[14, '#ff8a10', 0.35], [8, '#ffc040', 0.75], [4, '#ffe8a0', 0.95], [1.6, '#ffffff', 1]]) {
        g.globalAlpha = some * al; g.strokeStyle = cor2; g.lineWidth = l; curva(0); g.stroke();
      }
      // as pontas da lua brilham
      for (const s2 of [-1, 1]) { const [px2, py2] = ponto(s2, 0); g.globalAlpha = some * 0.8; g.drawImage(halo('#fff0b0'), px2 - 10, py2 - 10, 20, 20); }
      g.restore();
      if (k < 0.85) for (let i = 0; i < 6; i++) {
        const [px2, py2] = ponto(Math.random() * 2 - 1, Math.random() * B * 0.6);
        this.fx.add({ x: px2, y: py2, vx: o.vx * 120 + (Math.random() - 0.5) * 40, vy: o.vy * 120 + (Math.random() - 0.5) * 40, cor: Math.random() < 0.5 ? '#ffb020' : '#ffe080', brilho: true, forma: i % 3 ? 'faisca' : 'estrela', vida: 0.4, atrito: 4, tam: 1.6 });
      }
    } else if (e.tipo === 'brilhoArcano') {
      for (let i = 0; i < 14; i++) {
        const f = (i * 0.29 + k * 1.4) % 1;
        g.globalAlpha = (1 - k) * (1 - f); g.fillStyle = i % 2 ? e.cor : '#ffffff';
        g.fillRect(Math.round(x - 12 + ((i * 41) % 24)), Math.round(y + 10 - f * 30), 2, 2);
      }
      g.globalAlpha = 0.4 * (1 - k); g.strokeStyle = e.cor; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 8, 12, 5, 0, 0, Math.PI * 2); g.stroke();
    } else if (e.tipo === 'pulso') {
      // Pulso da Luva: onda azul saindo da manopla
      for (const atraso of [0, 0.2]) {
        const q = Math.max(0, (k - atraso) / (1 - atraso)); if (q <= 0) continue;
        g.globalAlpha = 1 - q; g.strokeStyle = atraso ? '#ffe080' : '#5ab8ff'; g.lineWidth = 3 - q * 2;
        g.beginPath(); g.ellipse(x, y + 6, 6 + q * 34, 3 + q * 14, 0, 0, Math.PI * 2); g.stroke();
      }
    } else if (e.tipo === 'fantasmas') {
      // rastro do teletransporte: cópias douradas do Ezreal entre o ponto de saída e o de chegada
      const s2 = sprite(this.darius.nome, this.darius.dir, 0), a = e.fixo, b = this.pos(this.darius);
      for (let i = 0; i < 5; i++) {
        const f = i / 5;
        g.globalAlpha = (1 - k) * (0.15 + f * 0.4);
        g.drawImage(tingido(s2, i % 2 ? '#ffd860' : '#7ad8ff'), Math.round(a.px + (b.px - a.px) * f), Math.round(a.py + (b.py - a.py) * f));
      }
    } else if (e.tipo === 'pilar') {
      // pilar de luz caindo do céu sobre o alvo
      const larg = 10 * Math.sin(Math.min(1, k * 1.6) * Math.PI) + 2;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(0, y - 200, 0, y + 8);
      gr.addColorStop(0, e.cor + '00'); gr.addColorStop(0.7, e.cor + 'aa'); gr.addColorStop(1, '#ffffff');
      g.globalAlpha = 1 - Math.max(0, k - 0.6) * 2.5; g.fillStyle = gr; g.fillRect(x - larg, y - 200, larg * 2, 208);
      g.fillStyle = '#ffffff'; g.fillRect(x - larg * 0.3, y - 200, larg * 0.6, 208);
      g.restore();
    } else if (e.tipo === 'giro') {
      // Dizimar: anel da lâmina no chão, rastro em meia-lua e o machado girando em volta
      const cy = y + 6;
      g.globalAlpha = 0.5 * (1 - k);
      g.strokeStyle = '#c01010'; g.lineWidth = 5; g.beginPath(); g.ellipse(x, cy, 28, 12, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#ff6a40'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, cy, 31, 13.5, 0, 0, Math.PI * 2); g.stroke();
      const ang = -Math.PI / 2 + k * Math.PI * 2.4;
      for (let i = 1; i <= 6; i++) {             // rastro
        g.globalAlpha = (1 - i / 7) * (1 - k * 0.6);
        g.strokeStyle = i < 3 ? '#ffffff' : '#ff4a2a'; g.lineWidth = 3 - i * 0.35;
        g.beginPath(); g.ellipse(x, cy - 4, 24, 11, 0, ang - i * 0.32, ang - (i - 1) * 0.32); g.stroke();
      }
      g.globalAlpha = 1 - Math.max(0, k - 0.8) * 5;
      girado(g, efeitoMachado(), x + Math.cos(ang) * 24, cy - 4 + Math.sin(ang) * 11, ang + Math.PI / 2, 0.42);
      if (k < 0.85) for (let i = 0; i < 2; i++) this.fx.add({ x: x + Math.cos(ang) * 26, y: cy - 4 + Math.sin(ang) * 12, vx: -Math.sin(ang) * 60 + (Math.random() - 0.5) * 30, vy: Math.cos(ang) * 25 - 10, cor: i ? '#ff5a2a' : '#ffd0a0', brilho: true, forma: 'faisca', vida: 0.3, atrito: 3, tam: 1.4 });
      if (k > 0.7) for (let i = 0; i < 10; i++) {   // sangue espirrando para fora no fim do giro
        const a2 = i * 0.63, r2 = 20 + (k - 0.7) * 60;
        g.fillStyle = '#b01010'; g.globalAlpha = (1 - k) * 3;
        g.fillRect(Math.round(x + Math.cos(a2) * r2), Math.round(cy + Math.sin(a2) * r2 * 0.45), 2, 2);
      }
    } else if (e.tipo === 'corrente') {
      // Apreender: a corrente sai com a lâmina na ponta, prende e volta puxando
      const d = this.pos(this.darius), dx = d.px + 18, dy = d.py + 16;
      const alcance = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55 * 0.85;
      const ex = dx + (x - dx) * alcance, ey = dy + (y - 2 - dy) * alcance;
      const n = Math.max(2, Math.round(Math.hypot(ex - dx, ey - dy) / 4));
      g.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      for (let i = 0; i < n; i++) {
        const lx = Math.round(dx + ((ex - dx) * i) / n), ly = Math.round(dy + ((ey - dy) * i) / n);
        g.fillStyle = '#1a1a20'; g.fillRect(lx - 2, ly - 1, i % 2 ? 3 : 5, i % 2 ? 4 : 3);
        g.fillStyle = i % 2 ? '#8a8a98' : '#c8c8d8'; g.fillRect(lx - 1, ly, i % 2 ? 1 : 3, i % 2 ? 2 : 1);
      }
      girado(g, efeitoMachado(), ex, ey, Math.atan2(ey - dy, ex - dx) + Math.PI / 2, 0.32);
      if (k > 0.4 && k < 0.6) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x) - 4, Math.round(y) - 1, 8, 1); g.fillRect(Math.round(x) - 1, Math.round(y) - 4, 1, 8); }
    } else if (e.tipo === 'corte') {
      // corte diagonal: núcleo branco e bordas da cor do golpe
      const c = Math.min(1, k * 3), l = 9;
      g.globalAlpha = 1 - k;
      g.strokeStyle = e.cor; g.lineWidth = 3; g.beginPath(); g.moveTo(x - l, y - 10); g.lineTo(x - l + 2 * l * c, y - 10 + 2 * l * c * 0.8); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - l, y - 10); g.lineTo(x - l + 2 * l * c, y - 10 + 2 * l * c * 0.8); g.stroke();
    } else if (e.tipo === 'corteW') {
      // Golpe Mutilador: meia-lua vertical vermelha caindo sobre o alvo
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#ff2a1a'; g.lineWidth = 4; g.beginPath(); g.arc(x - 4, y - 6, 14, -1.9, -1.9 + k * 3.2 + 0.4); g.stroke();
      g.strokeStyle = '#ffe0d0'; g.lineWidth = 1.5; g.beginPath(); g.arc(x - 4, y - 6, 14, -1.9, -1.9 + k * 3.2 + 0.4); g.stroke();
    } else if (e.tipo === 'lentidao') {
      // correntes no chão: o alvo está lento
      g.globalAlpha = Math.min(1, (1 - k) * 2) * 0.85;
      for (let i = 0; i < 10; i++) {
        const a2 = (i / 10) * Math.PI * 2 + this.tempo * 0.8;
        g.fillStyle = i % 2 ? '#5a5a6a' : '#a8a8b8'; g.fillRect(Math.round(x + Math.cos(a2) * 10) - 1, Math.round(y + 9 + Math.sin(a2) * 4), i % 2 ? 2 : 3, 2);
      }
    } else if (e.tipo === 'rachadura') {
      // chão rachado onde a Guilhotina caiu
      g.globalAlpha = Math.min(1, (1 - k) * 2) * 0.9; g.strokeStyle = '#1a0a08'; g.lineWidth = 1.2;
      for (let i = 0; i < 7; i++) {
        const a2 = i * 0.9 + 0.3; let cx2 = x, cy2 = y + 8;
        g.beginPath(); g.moveTo(cx2, cy2);
        for (let j = 0; j < 3; j++) { cx2 += Math.cos(a2 + (j % 2 ? 0.4 : -0.4)) * 5; cy2 += Math.sin(a2 + (j % 2 ? 0.4 : -0.4)) * 2.2; g.lineTo(cx2, cy2); }
        g.stroke();
      }
      g.fillStyle = `rgba(200,20,10,${0.5 * (1 - k)})`; g.beginPath(); g.ellipse(x, y + 8, 8 + k * 6, 3 + k * 2, 0, 0, Math.PI * 2); g.fill();
    } else if (e.tipo === 'impacto') {
      const r = 3 + k * 9;
      g.fillStyle = k < 0.5 ? '#ffffff' : '#ffd040'; g.globalAlpha = 1 - k;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]])
        g.fillRect(Math.round(x + ax * r) - 1, Math.round(y - 4 + ay * r) - 1, 2, 2);
    } else if (e.tipo === 'respingo') {
      g.fillStyle = '#c01010';
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.05 + e.dur * 7;
        g.fillRect(Math.round(x + Math.cos(ang) * k * 10), Math.round(y - 6 + Math.sin(ang) * k * 8 + k * k * 6), 2, 2);
      }
    } else if (e.tipo === 'guilhotina') {
      // Guilhotina Noxiana: a sombra cresce, o machado gigante cai girando e o impacto espirra sangue
      const m = efeitoMachado(), queda = Math.min(1, k / 0.35);
      g.globalAlpha = 0.35 * Math.min(1, k * 4) * (1 - Math.max(0, k - 0.6) * 2.5);
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y + 9, 6 + queda * 10, 2 + queda * 3, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      girado(g, m, x + 4, y - 48 + queda * 36, (1 - queda) * -0.9, 1.15);
      if (k > 0.33) {
        const b = (k - 0.33) / 0.67;
        g.globalAlpha = 1 - b;
        g.strokeStyle = '#ff3020'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 8, 6 + b * 30, 3 + b * 12, 0, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 14; i++) {
          const a2 = i * 0.45, r2 = b * 26;
          g.fillStyle = i % 3 ? '#b01010' : '#ff5040';
          g.fillRect(Math.round(x + Math.cos(a2) * r2), Math.round(y - 4 + Math.sin(a2) * r2 * 0.6 - Math.sin(b * Math.PI) * 10 + b * b * 10), 2, 2);
        }
      }
    } else if (e.tipo === 'nivel') {
      for (let i = 0; i < 12; i++) {
        const fase = (i * 0.37 + k) % 1;
        g.globalAlpha = 1 - fase;
        g.fillStyle = i % 2 ? '#fff6a0' : '#ffffff';
        g.fillRect(Math.round(x - 12 + ((i * 53) % 24)), Math.round(y + 10 - fase * 34), 2, 2);
      }
    } else if (e.tipo === 'avisoInvestida' || e.tipo === 'avisoSopro') {
      // área de perigo no chão, piscando cada vez mais rápido
      const d = this.pos(this.darius), dx = d.px + 16, dy = d.py + 24;
      g.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(this.tempo * (6 + k * 14)));
      g.fillStyle = e.tipo === 'avisoInvestida' ? '#ff2020' : '#ff8a20';
      if (e.tipo === 'avisoInvestida') {
        const n = Math.max(1, Math.round(Math.hypot(dx - x, dy - y) / 6));
        for (let i = 0; i <= n; i++) g.fillRect(Math.round(x + ((dx - x) * i) / n) - 8, Math.round(y + 6 + ((dy - y - 6) * i) / n) - 4, 16, 8);
      } else { g.beginPath(); g.ellipse(dx, dy, 44, 18, 0, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.font = `bold 10px ${FONTE}`; g.textAlign = 'center'; g.lineWidth = 1.5; g.strokeStyle = '#000'; g.fillStyle = '#ffe040';
      g.strokeText('!', x, y - 26); g.fillText('!', x, y - 26);
    } else if (e.tipo === 'sopro') {
      const d = this.pos(this.darius), dx = d.px + 16, dy = d.py + 18;
      for (let i = 0; i < 24; i++) {
        const f = ((k + i / 24) % 1) * (e.corte ?? 1), esp = (i % 5 - 2) * 4 * f;
        g.globalAlpha = 1 - k * 0.6;
        g.fillStyle = i % 3 === 0 ? '#ffe060' : i % 3 === 1 ? '#ff8a20' : '#d83010';
        g.fillRect(Math.round(x + (dx - x) * f + esp), Math.round(y - 8 + (dy - y + 8) * f + esp * 0.5), 4, 4);
      }
    } else if (e.tipo === 'portal') {
      for (const lado of [-1, 1]) {
        g.globalAlpha = 1 - k; g.strokeStyle = '#c070ff'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(x + lado * 40, y + 8, 6 + k * 8, 3 + k * 3, 0, 0, Math.PI * 2); g.stroke();
      }
    } else if (e.tipo === 'bolaFogo') {
      const p = this.pet ? this.pos(this.pet) : this.pos(this.darius), ox = p.px + 16, oy = p.py + 20;
      const bx = ox + (x - ox) * k, by = oy + (y - oy) * k - Math.sin(k * Math.PI) * 8;
      g.fillStyle = '#ff8a20'; g.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 4, 4);
      g.fillStyle = '#ffe060'; g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
    } else if (e.tipo === 'grito') {
      // Grito de Guerra: ondas de choque, arcos de som dos dois lados e brasas subindo
      g.strokeStyle = '#ffa040';
      for (const atraso of [0, 0.18, 0.36]) {
        const q = Math.max(0, (k - atraso) / (1 - atraso)); if (q <= 0) continue;
        g.globalAlpha = 1 - q; g.lineWidth = 2 - q; g.beginPath(); g.ellipse(x, y + 6, 6 + q * 46, 3 + q * 18, 0, 0, Math.PI * 2); g.stroke();
      }
      g.globalAlpha = 1 - k; g.strokeStyle = '#ffe0a0'; g.lineWidth = 1;
      for (const lado of [-1, 1]) for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(x + lado * 6, y - 8, 4 + i * 4 + k * 6, lado > 0 ? -0.7 : Math.PI - 0.7, lado > 0 ? 0.7 : Math.PI + 0.7); g.stroke(); }
      for (let i = 0; i < 12; i++) { const f = (k * 1.5 + i / 12) % 1; g.globalAlpha = (1 - k) * (1 - f); g.fillStyle = i % 2 ? '#ffb040' : '#ff5020'; g.fillRect(Math.round(x - 14 + ((i * 37) % 28)), Math.round(y + 8 - f * 34), 2, 2); }
    } else if (e.tipo === 'avanco') {
      // Avanço Noxiano: "fantasmas" do Darius no caminho até o alvo e poeira
      const d = this.pos(this.darius), dx = d.px, dy = d.py, s2 = sprite(this.darius.nome, this.darius.dir, 3);
      for (let i = 1; i <= 3; i++) {
        const f = (i / 4) * Math.min(1, k * 2.5);
        g.globalAlpha = (1 - k) * (0.55 - i * 0.12);
        g.drawImage(tingido(s2, '#ffb070'), Math.round(dx + (x - 16 - dx) * f), Math.round(dy + (y - 18 - dy) * f));
      }
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 8; i++) { const f = i / 8; g.fillStyle = i % 2 ? '#c8a878' : '#8a7050'; g.fillRect(Math.round(dx + 16 + (x - dx - 16) * f + Math.sin(i) * 3), Math.round(dy + 28 + (y - dy - 18) * f - k * 6), 3, 2); }
    } else if (e.tipo === 'furia') {
      // Fúria Sanguinária: redemoinho de sangue em volta do Darius
      for (let i = 0; i < 16; i++) {
        const a2 = i * 0.39 + k * 9, r2 = 8 + k * 14 + (i % 3) * 2;
        g.globalAlpha = 1 - k; g.fillStyle = i % 2 ? '#d01020' : '#7a0810';
        g.fillRect(Math.round(x + Math.cos(a2) * r2), Math.round(y + Math.sin(a2) * r2 * 0.55 - k * 6), 2, 2);
      }
    } else if (e.tipo === 'pisotear') {
      // Pisotear: rachaduras saindo do Darius, poeira e pedras pulando
      const cy = y + 9, es = e.escala || 1;
      g.globalAlpha = Math.min(1, (1 - k) * 1.6); g.strokeStyle = '#2a1a0a'; g.lineWidth = 1.3;
      for (let i = 0; i < 9; i++) {
        const a2 = (i / 9) * Math.PI * 2 + 0.2, alc = Math.min(1, k * 4) * 30 * es;
        g.beginPath(); g.moveTo(x, cy);
        g.lineTo(x + Math.cos(a2) * alc * 0.5 + (i % 2 ? 2 : -2), cy + Math.sin(a2) * alc * 0.22);
        g.lineTo(x + Math.cos(a2) * alc, cy + Math.sin(a2) * alc * 0.42); g.stroke();
      }
      g.globalAlpha = 0.4 * (1 - k); g.fillStyle = '#c8a878'; g.beginPath(); g.ellipse(x, cy, (10 + k * 34) * es, (4 + k * 12) * es, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 10; i++) {
        const a2 = (i / 10) * Math.PI * 2, r2 = (6 + k * 30) * es;
        g.fillStyle = i % 2 ? '#6a5a4a' : '#9a8a72';
        g.fillRect(Math.round(x + Math.cos(a2) * r2), Math.round(cy + Math.sin(a2) * r2 * 0.42 - Math.sin(k * Math.PI) * 12), 3, 3);
      }
    } else if (e.tipo === 'avisoChao') {
      // área de perigo: borda piscando e o enchimento crescendo até o golpe
      const pisca = 0.55 + 0.45 * Math.abs(Math.sin(this.tempo * (5 + k * 16))), cor = e.cor;
      g.save();
      if (e.forma === 'circulo') {
        const rx = e.r, ry = e.r * 0.6;
        g.fillStyle = `rgba(${cor},0.16)`; g.beginPath(); g.ellipse(e.cx, e.cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(${cor},0.32)`; g.beginPath(); g.ellipse(e.cx, e.cy, rx * k, ry * k, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = `rgba(${cor},${0.9 * pisca})`; g.lineWidth = 2; g.beginPath(); g.ellipse(e.cx, e.cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      } else if (e.forma === 'linha') {
        const ang = Math.atan2(e.ey - e.cy, e.ex - e.cx), comp = Math.hypot(e.ex - e.cx, e.ey - e.cy);
        g.translate(e.cx, e.cy); g.rotate(ang);
        g.fillStyle = `rgba(${cor},0.16)`; g.fillRect(0, -e.larg / 2, comp, e.larg);
        g.fillStyle = `rgba(${cor},0.34)`; g.fillRect(0, -e.larg / 2, comp * k, e.larg);
        g.strokeStyle = `rgba(${cor},${0.9 * pisca})`; g.lineWidth = 2; g.strokeRect(0, -e.larg / 2, comp, e.larg);
      } else if (e.forma === 'cone') {
        const ang = Math.atan2(e.diry, e.dirx);
        const setor = (r2) => { g.beginPath(); g.moveTo(e.cx, e.cy); g.ellipse(e.cx, e.cy, r2, r2 * 0.6, 0, ang - e.ang, ang + e.ang); g.closePath(); };
        g.fillStyle = `rgba(${cor},0.16)`; setor(e.comp); g.fill();
        g.fillStyle = `rgba(${cor},0.34)`; setor(e.comp * k); g.fill();
        g.strokeStyle = `rgba(${cor},${0.9 * pisca})`; g.lineWidth = 2; setor(e.comp); g.stroke();
      }
      g.restore();
    } else if (e.tipo === 'olhoCarga') {
      // o chefe juntando energia: brilho crescente na cabeça e partículas sendo puxadas para ele
      const cor = e.cor || '#c070ff', s2 = 10 + 26 * k;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.4 * Math.sin(this.tempo * 18); g.drawImage(halo(cor), x - s2, y - 26 - s2, s2 * 2, s2 * 2); g.restore();
      if (Math.random() < 0.9) { const a = Math.random() * 6.28, r2 = 40; this.fx.add({ x: x + Math.cos(a) * r2, y: y - 26 + Math.sin(a) * r2 * 0.6, vx: -Math.cos(a) * r2 * 2.2, vy: -Math.sin(a) * r2 * 1.3, cor, brilho: true, vida: 0.4, tam: 1.6, encolhe: true }); }
    } else if (e.tipo === 'auraChefe') {
      // o chefe enfurecido: halo vermelho pulsando e chamas subindo
      const al = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.5), cor = e.cor || '#ff3a20';
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * al * (0.7 + 0.3 * Math.sin(this.tempo * 9)); g.drawImage(halo(cor), x - 44, y - 60, 88, 88); g.restore();
      if (Math.random() < 0.8 * al) this.fx.add({ x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 10, vx: 0, vy: -40 - Math.random() * 40, cor: Math.random() < 0.5 ? cor : '#ffb040', brilho: true, vida: 0.6, tam: 2.2, encolhe: true });
    } else if (e.tipo === 'bolaFogo') {
      // bola de fogo caindo do céu sobre a área marcada
      const yy = y - 180 * (1 - k * k);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 5; i++) { g.globalAlpha = 0.3 * (1 - i / 6); g.drawImage(halo('#ff6a10'), x - 10, yy - 10 - i * 14, 20, 20); }
      g.globalAlpha = 1; g.drawImage(halo('#ffb040'), x - 16, yy - 16, 32, 32);
      g.restore();
      g.fillStyle = '#fff0a0'; g.beginPath(); g.arc(x, yy, 4, 0, Math.PI * 2); g.fill();
    } else if (e.tipo === 'teiaChao') {
      // a teia da Vilemaw no chão: fios saindo do meio e anéis, e some no fim
      const al = Math.min(1, e.t / 0.12) * Math.min(1, (e.dur - e.t) / 0.5), rr = e.r * (0.6 + 0.4 * Math.min(1, e.t / 0.15));
      g.save(); g.globalAlpha = 0.85 * al; g.strokeStyle = '#ece6ff'; g.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55); g.stroke(); }
      for (const f of [0.3, 0.55, 0.8, 1]) { g.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * 6.283 + 0.2, xx = x + Math.cos(a) * rr * f, yy2 = y + Math.sin(a) * rr * f * 0.55; if (i) g.lineTo(xx, yy2); else g.moveTo(xx, yy2); } g.stroke(); }
      g.restore();
    } else if (e.tipo === 'ovoCai') {
      // ovo da Vilemaw caindo do alto, com a sombra crescendo no chão
      const q = e.t / e.dur, yo = y - 160 * (1 - q * q);
      g.save(); g.globalAlpha = 0.4; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y, 7 * q + 1, 3 * q + 0.5, 0, 0, 6.283); g.fill();
      g.globalAlpha = 1; g.fillStyle = '#1e4e44'; g.beginPath(); g.ellipse(x, yo, 6, 8, 0, 0, 6.283); g.fill(); g.fillStyle = '#8affb0'; g.beginPath(); g.ellipse(x - 2, yo - 3, 2, 3, 0, 0, 6.283); g.fill();
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(halo('#8affb0'), x - 12, yo - 12, 24, 24); g.restore();
    } else if (e.tipo === 'pocaAcido') {
      // poça de ácido do Barão: verde, borbulhando, que some no fim
      const al = Math.min(1, e.t / 0.2) * Math.min(1, (e.dur - e.t) / 0.6), rx = e.r, ry = e.r * 0.55;
      g.save(); g.globalAlpha = 0.55 * al; g.fillStyle = '#3a8a20'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.5 * al; g.fillStyle = '#7ae050'; g.beginPath(); g.ellipse(x, y, rx * 0.75, ry * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 * al; g.drawImage(halo('#7ae050'), x - rx, y - ry * 1.6, rx * 2, ry * 3.2);
      g.restore();
      if (Math.random() < 0.5 * al) { const a = Math.random() * 6.28, r2 = Math.random(); this.fx.add({ x: x + Math.cos(a) * rx * r2, y: y + Math.sin(a) * ry * r2, vx: 0, vy: -12 - Math.random() * 10, cor: Math.random() < 0.5 ? '#c8ff80' : '#7ae050', brilho: false, vida: 0.5, tam: 1.8, encolhe: true }); }
    } else if (e.tipo === 'tentaculos') {
      // tentáculos do Vazio saindo do chão em volta do ponto, subindo, balançando e voltando
      const sobe = Math.sin(Math.min(1, k) * Math.PI);
      g.save(); g.lineCap = 'round';
      g.globalAlpha = 0.5 * sobe; g.fillStyle = '#2a0a3a'; g.beginPath(); g.ellipse(x, y, 26, 10, 0, 0, Math.PI * 2); g.fill();
      for (const tn of e.tent) {
        const bx = x + tn.dx, by = y + tn.dy, h = tn.h * sobe, sw = Math.sin(this.tempo * 6 + tn.dx) * 4;
        for (const [w, cor] of [[7, '#1a0624'], [4.5, '#6a2a9a'], [1.6, '#d8a0ff']]) {
          g.globalAlpha = sobe; g.strokeStyle = cor; g.lineWidth = w * (0.6 + 0.4 * sobe);
          g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + tn.curva + sw, by - h * 0.6, bx + tn.curva * 0.4 + sw * 1.5, by - h); g.stroke();
        }
      }
      g.restore();
    } else if (e.tipo === 'auraBuff') {
      // aura: halo pulsando, anel girando no chão e partículas do estilo de cada habilidade
      const al = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.4), pulso = 0.75 + 0.25 * Math.sin(this.tempo * 7), [c1, c2] = e.cores;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28 * al * pulso; g.drawImage(halo(c1), x - 24, y - 38, 48, 48);
      g.globalAlpha = 0.6 * al; g.strokeStyle = c1; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.lineDashOffset = -this.tempo * 18;
      g.beginPath(); g.ellipse(x, y + 1, 15, 5.5, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      if (e.estilo === 'escudo') { g.globalAlpha = 0.45 * al; g.strokeStyle = c1; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - 13, 15 + Math.sin(this.tempo * 5), 0, Math.PI * 2); g.stroke(); }
      g.restore();
      if (Math.random() < 0.55 * al) {
        const a = Math.random() * Math.PI * 2, r2 = 6 + Math.random() * 10, px2 = x + Math.cos(a) * r2, py2 = y - 2 + Math.sin(a) * r2 * 0.4;
        if (e.estilo === 'chamas') this.fx.add({ x: px2, y: py2, vx: (Math.random() - 0.5) * 8, vy: -30 - Math.random() * 30, cor: Math.random() < 0.5 ? c1 : c2, brilho: true, vida: 0.6, tam: 2, encolhe: true });
        else if (e.estilo === 'sangue') this.fx.add({ x: x + Math.cos(a) * 14, y: y - 12 + Math.sin(a) * 6, vx: -Math.sin(a) * 30, vy: Math.cos(a) * 12, cor: Math.random() < 0.6 ? c1 : c2, brilho: false, vida: 0.5, tam: 1.6, encolhe: true });
        else if (e.estilo === 'arcana') this.fx.add({ x: x + Math.cos(a) * 16, y: y - 12 + Math.sin(a) * 7, vx: -Math.cos(a) * 18, vy: -Math.sin(a) * 8 - 8, cor: Math.random() < 0.5 ? c1 : c2, brilho: true, vida: 0.55, tam: 1.5, encolhe: true });
        else this.fx.add({ x: px2, y: py2 - 4, vx: 0, vy: -22 - Math.random() * 18, cor: Math.random() < 0.5 ? c1 : c2, brilho: true, forma: e.estilo === 'estrelas' ? 'estrela' : undefined, vida: 0.7, tam: 1.6, encolhe: true });
      }
    } else if (e.tipo === 'feixeCeu') {
      // coluna de luz descendo do céu: estreita e forte no começo, depois alarga e some
      const desce = Math.min(1, k / 0.2), al = k < 0.2 ? 1 : Math.max(0, 1 - (k - 0.2) / 0.8), w = 6 + 14 * Math.min(1, k * 2.5), topo = y - 220;
      g.save(); g.globalCompositeOperation = 'lighter';
      const fundoY = topo + (y - topo) * desce;
      const gr = g.createLinearGradient(0, topo, 0, fundoY); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, e.cor);
      g.globalAlpha = al * 0.55; g.fillStyle = gr; g.fillRect(x - w, topo, w * 2, fundoY - topo);
      g.globalAlpha = al; g.fillStyle = '#ffffff'; g.fillRect(x - w * 0.18, topo, w * 0.36, fundoY - topo);
      g.globalAlpha = al * 0.5; g.drawImage(halo(e.cor), x - 30, fundoY - 30, 60, 60);
      g.restore();
    } else if (e.tipo === 'rachaduraRadial') {
      // Pisotear: rachaduras saindo em estrela do pé do Darius, em brasa no começo e escuras depois
      const q = Math.min(1, k / 0.15), brasa = Math.max(0, 1 - k / 0.5), al = Math.min(1, (1 - k) * 3);
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      for (const li of e.linhas) {
        const caminho = () => { g.beginPath(); g.moveTo(x, y); for (let i = 1; i <= 5; i++) { const f = (i / 5) * q; g.lineTo(x + Math.cos(li.a) * li.l * f + li.z[i - 1] * 3, y + Math.sin(li.a) * li.l * f * 0.45 + li.z[i - 1] * 1.5); } };
        g.globalAlpha = al * 0.85; g.strokeStyle = '#1a1008'; g.lineWidth = 2.6; caminho(); g.stroke();
        if (brasa > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = brasa; g.strokeStyle = '#ff9a40'; g.lineWidth = 1.2; caminho(); g.stroke(); g.globalCompositeOperation = 'source-over'; }
      }
      g.restore();
    } else if (e.tipo === 'investida') {
      // Avanço do Darius: um rastro vermelho grosso do ponto de partida até o alvo
      const al = 1 - k, q = Math.min(1, k / 0.3);
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const ex = e.ox + (e.ex - e.ox) * q, ey = e.oy + (e.ey - e.oy) * q;
      for (const [w, cor, a2] of [[14, '#a01010', 0.3], [7, '#ff3a20', 0.6], [2.5, '#ffd0c0', 0.9]]) { g.globalAlpha = al * a2; g.strokeStyle = cor; g.lineWidth = w * (1 - k * 0.5); g.beginPath(); g.moveTo(e.ox, e.oy); g.lineTo(ex, ey); g.stroke(); }
      g.restore();
    } else if (e.tipo === 'estrela4') {
      // brilho de impacto em cruz: abre rápido e some
      const s2 = e.tam * (0.6 + 0.6 * Math.min(1, k * 4)) * (1 - k * 0.4), al = 1 - k;
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y - 2); g.rotate(e.giro || 0);
      g.globalAlpha = 0.6 * al; g.drawImage(halo(e.cor), -s2, -s2, s2 * 2, s2 * 2);
      for (const [cor, f] of [[e.cor, 1], ['#ffffff', 0.55]]) {
        g.globalAlpha = al; g.fillStyle = cor;
        g.beginPath(); g.moveTo(-s2 * f, 0); g.lineTo(0, -s2 * 0.1 * f); g.lineTo(s2 * f, 0); g.lineTo(0, s2 * 0.1 * f); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(0, -s2 * 0.75 * f); g.lineTo(s2 * 0.08 * f, 0); g.lineTo(0, s2 * 0.75 * f); g.lineTo(-s2 * 0.08 * f, 0); g.closePath(); g.fill();
      }
      g.restore();
    } else if (e.tipo === 'arcoGiro') {
      // Q do Darius: dois arcos do machado dando a volta, com rastro e a lâmina na ponta
      const cx = x, cy = y - 6, rx = 34 * (0.85 + 0.15 * Math.sin(k * Math.PI)), ry = rx * 0.5, al = Math.min(1, (1 - k) * 2.5);
      const a0 = -Math.PI / 2 + k * Math.PI * 2.3;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const lado of [0, Math.PI]) for (let i = 0; i < 7; i++) {
        const ai = a0 + lado - i * 0.2, w = 7 - i * 0.8;
        // vento (Yasuo): azul-claro e sem o machado na ponta
        g.globalAlpha = al * (1 - i / 7) * 0.9; g.strokeStyle = e.cor ? (i < 2 ? '#ffffff' : i < 4 ? e.cor : '#3a7ab8') : i < 2 ? '#ffd0c0' : i < 4 ? '#ff4a2a' : '#a01010'; g.lineWidth = Math.max(1, w);
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, ai - 0.35, ai); g.stroke();
      }
      g.globalAlpha = al * 0.25; g.drawImage(halo(e.cor || '#ff3020'), cx - rx, cy - rx * 0.7, rx * 2, rx * 1.4);
      g.restore();
      if (!e.cor) for (const lado of [0, Math.PI]) { const a = a0 + lado; girado(g, efeitoMachado(), cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, a + Math.PI / 2, 0.32, al); }
    } else if (e.tipo === 'golpeVertical') {
      // W do Darius: arco vertical do machado descendo sobre o alvo
      const q = Math.min(1, k / 0.35), al = Math.min(1, (1 - k) * 2.2), cx = x + 4, cy = y - 10, r2 = 22;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const a1 = -2.5, a2 = a1 + 2.9 * q;
      for (const [w, cor, f] of [[10, '#a01010', 0.5], [6, '#ff3a20', 0.9], [2.5, '#ffe0d0', 1]]) { g.globalAlpha = al * f; g.strokeStyle = cor; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, r2, a1, a2); g.stroke(); }
      g.restore();
    } else if (e.tipo === 'gancho') {
      // E do Darius: corrente de elos saindo do Darius com o gancho na ponta; prende e volta
      const de = this.centro(e.de), alvoP = this.criaturas.has(e.alvo?.id) ? this.centro(e.alvo) : { x, y };
      const q = k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) / 0.55) * 0.999 + 0.001, px2 = de.x + (alvoP.x - de.x) * q, py2 = de.y - 4 + (alvoP.y - de.y + 4) * q;
      const n = Math.hypot(px2 - de.x, py2 - de.y), ux = (px2 - de.x) / (n || 1), uy = (py2 - de.y) / (n || 1);
      g.save();
      g.strokeStyle = '#1a1a1e'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(de.x, de.y - 4); g.lineTo(px2, py2); g.stroke();
      for (let d2 = 0; d2 < n; d2 += 4) { const lx = de.x + ux * d2, ly = de.y - 4 + uy * d2; g.fillStyle = (d2 / 4) % 2 < 1 ? '#c8ccd4' : '#7a808a'; g.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 2, 2); }
      g.restore();
      girado(g, efeitoMachado(), px2, py2, Math.atan2(uy, ux), 0.28, 1);
      if (k > 0.4 && k < 0.5) this.faiscas(px2, py2, ['#ffffff', '#c8ccd4', '#ff4a2a'], 3, 60);
    } else if (e.tipo === 'machadoGigante') {
      // R do Darius: o machado de sangue cai do céu girando e crava no alvo
      const queda = 0.24 / e.dur, q = Math.min(1, k / queda), al = k < queda ? 1 : Math.max(0, 1 - (k - queda) / (1 - queda));
      const yy = y - 150 * (1 - q * q), ang = -1.6 + q * 2.4;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = al * 0.55; g.drawImage(halo('#ff2010'), x - 50, yy - 60, 100, 100);
      if (k < queda) for (let i = 1; i <= 5; i++) { g.globalAlpha = 0.25 * (1 - i / 6); g.drawImage(halo('#ff4a2a'), x - 20, yy - 30 - i * 16, 40, 40); }
      if (k >= queda) { const f = (k - queda) / (1 - queda); g.globalAlpha = (1 - f) * 0.7; g.fillStyle = '#ff3020'; g.fillRect(x - 6 * (1 - f) - 1, y - 160, 12 * (1 - f) + 2, 160); }
      g.restore();
      girado(g, efeitoMachado(), x, yy - 14, ang, 1.15, al);
    } else if (e.tipo === 'runaOrbe') {
      // W do Ezreal: o orbe preso, com um anel de runas roxas girando no chão e três faíscas em volta
      const al = Math.min(1, e.t / 0.2) * (0.75 + 0.25 * Math.sin(this.tempo * 6)), cy = y + 6;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = al;
      g.strokeStyle = '#b060ff'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.lineDashOffset = -this.tempo * 20; g.beginPath(); g.ellipse(x, cy, 15, 6, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 3; i++) { const a = this.tempo * 3 + (i * Math.PI * 2) / 3; g.fillStyle = i ? '#e0b0ff' : '#ffe080'; g.fillRect(Math.round(x + Math.cos(a) * 12) - 1, Math.round(y - 12 + Math.sin(a) * 5) - 1, 3, 3); }
      g.globalAlpha = al * 0.4; g.drawImage(halo('#b060ff'), x - 16, y - 28, 32, 32);
      g.restore();
    } else if (e.tipo === 'bolhaPrisma') {
      // W da Lux: bolha de luz em volta dela, com favos de cristal e a borda furta-cor
      const al = Math.min(1, e.t / 0.25) * Math.min(1, (e.dur - e.t) / 0.4), cx = x, cy = y - 12, r2 = 20 + Math.sin(this.tempo * 5) * 1.2;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(cx, cy, r2 * 0.4, cx, cy, r2); gr.addColorStop(0, 'rgba(255,240,250,0)'); gr.addColorStop(1, 'rgba(255,170,230,0.35)');
      g.globalAlpha = al; g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 12; i++) { const a0 = (i / 12) * Math.PI * 2 + this.tempo * 1.5; g.strokeStyle = ['#ff9ae0', '#9ad8ff', '#fff0a0', '#b8ffb0'][i % 4]; g.lineWidth = 1.6; g.globalAlpha = al * 0.9; g.beginPath(); g.arc(cx, cy, r2, a0, a0 + 0.42); g.stroke(); }
      g.globalAlpha = al * (0.25 + 0.15 * Math.sin(this.tempo * 4)); g.strokeStyle = '#ffffff'; g.lineWidth = 0.8;
      for (const [hx, hy] of [[0, 0], [-8, -5], [8, -5], [-8, 5], [8, 5], [0, -10], [0, 10]]) { g.beginPath(); for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; g[j ? 'lineTo' : 'moveTo'](cx + hx + Math.cos(a) * 4, cy + hy + Math.sin(a) * 4); } g.closePath(); g.stroke(); }
      g.restore();
    } else if (e.tipo === 'pilaresLuz') {
      // explosão da Singularidade: colunas de luz sobem do chão em volta
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const col of e.cols) {
        const f = (e.t - col.atraso) / (e.dur - col.atraso); if (f <= 0 || f >= 1) continue;
        const alt = 70 * Math.min(1, f * 4), al = 1 - f, bx = x + col.dx, by = y + col.dy;
        const gr = g.createLinearGradient(0, by - alt, 0, by); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, e.cor);
        g.globalAlpha = al; g.fillStyle = gr; g.fillRect(bx - col.l / 2, by - alt, col.l, alt);
        g.fillStyle = '#ffffff'; g.fillRect(bx - 0.5, by - alt * 0.8, 1, alt * 0.8);
      }
      g.restore();
    } else if (e.tipo === 'feixeAura') {
      // brilho largo por cima dos raios finais: um feixe suave que encolhe, com anéis correndo ao longo dele
      const al = Math.min(1, (1 - k) * 1.6), w = e.larg * (1 - k * 0.6), ex = e.ox + e.vx * e.comp, ey = e.oy + e.vy * e.comp;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      for (const [f, cor, a2] of [[1, e.cores[0], 0.22], [0.55, e.cores[0], 0.4], [0.25, e.cores[1], 0.7]]) { g.globalAlpha = al * a2; g.strokeStyle = cor; g.lineWidth = w * f; g.beginPath(); g.moveTo(e.ox, e.oy); g.lineTo(ex, ey); g.stroke(); }
      const ang = Math.atan2(e.vy, e.vx);
      for (let i = 0; i < 6; i++) {
        const d2 = ((k * 2 + i / 6) % 1) * Math.min(e.comp, 360), rx2 = 5, ry2 = w * 0.5;
        g.globalAlpha = al * 0.6; g.strokeStyle = e.cores[1]; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(e.ox + e.vx * d2, e.oy + e.vy * d2, rx2, ry2, ang, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    } else if (e.tipo === 'precisao') {
      // Tiro de Precisão: um risco branco e dourado, fino e muito rápido, que some logo
      const q = Math.min(1, k / 0.25), al = 1 - Math.max(0, k - 0.3) / 0.7, ex = e.ox + (e.ex - e.ox) * q, ey = e.oy + (e.ey - e.oy) * q;
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
      const cs = e.cores || ['#ffc040', '#fff0b0', '#ffffff'];
      for (const [l, cor, a2] of [[7, cs[0], 0.25], [3, cs[1], 0.7], [1.2, cs[2], 1]]) { g.globalAlpha = a2 * al; g.strokeStyle = cor; g.lineWidth = l; g.beginPath(); g.moveTo(e.ox, e.oy); g.lineTo(ex, ey); g.stroke(); }
      g.restore();
    } else if (e.tipo === 'descargaShurima') {
      // a carga dourada voa em arco; depois do impacto, as bolinhas azuis quicam duas vezes até o ponto delas
      const voo = 0.35 / e.dur, tv = e.t;
      g.save(); g.globalCompositeOperation = 'lighter';
      if (k < voo) {
        const q = k / voo, bx = e.de.x + (x - e.de.x) * q, by = e.de.y + (y - e.de.y) * q - Math.sin(Math.PI * q) * 26;
        g.globalAlpha = 0.9; g.drawImage(halo('#ffc040'), bx - 14, by - 14, 28, 28);
        g.fillStyle = '#fff0b0'; g.beginPath(); g.arc(bx, by, 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#30c8ff'; g.fillRect(Math.round(bx + Math.cos(this.tempo * 20) * 5) - 1, Math.round(by + Math.sin(this.tempo * 20) * 3) - 1, 2, 2);
        if (Math.random() < 0.8) this.fx.add({ x: bx, y: by, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, cor: Math.random() < 0.5 ? '#ffc040' : '#30c8ff', brilho: true, vida: 0.3, tam: 1.5, encolhe: true });
      } else {
        const fq = Math.max(0, 1 - (tv - 0.35) / 0.3);          // o clarão do impacto
        if (fq > 0) { g.globalAlpha = fq * 0.8; g.drawImage(halo('#ffc040'), x - 26, y - 26, 52, 52); }
        e.bolas.forEach((b, i) => {
          const t0 = 0.35 + i * 0.05 * 0, f = (tv - t0) / 0.5;
          if (f < 0 || f > 1.25) return;
          const ff = Math.min(1, f), mx = x + (b.x - x) * 0.55, my = y + (b.y - y) * 0.55;
          let bx, by;
          if (ff < 0.5) { const q = ff / 0.5; bx = x + (mx - x) * q; by = y + (my - y) * q - Math.sin(Math.PI * q) * 14; }
          else { const q = (ff - 0.5) / 0.5; bx = mx + (b.x - mx) * q; by = my + (b.y - my) * q - Math.sin(Math.PI * q) * 7; }
          const al = f > 1 ? 1 - (f - 1) / 0.25 : 1;
          g.globalAlpha = 0.85 * al; g.drawImage(halo('#30c8ff'), bx - 7, by - 7, 14, 14);
          g.globalAlpha = al; g.fillStyle = '#e0f8ff'; g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
        });
      }
      g.restore();
    } else if (e.tipo === 'iscaEz') {
      // a cópia de energia: o Ezreal translúcido e azulado, com colunas de luz e brilhos subindo; some piscando no fim
      const s2 = sprite(this.darius.nome, e.dir ?? DIR.S, 0), entra = Math.min(1, e.t / 0.2), sai = Math.min(1, (e.dur - e.t) / 0.35);
      const pisca = sai < 1 ? (Math.random() < 0.3 ? 0.3 : 1) : 0.85 + 0.15 * Math.sin(this.tempo * 20), al = entra * sai * pisca, px = e.fixo.px, py = e.fixo.py;
      g.save();
      g.globalAlpha = 0.7 * al; g.drawImage(s2, px, py);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.3 * al; g.drawImage(tingido(s2, '#2a7ab8'), px, py);
      for (const col of e.colunas) {        // colunas de luz verticais, como no teletransporte
        const brilho = 0.35 + 0.35 * Math.sin(this.tempo * 9 + col.f);
        const gr = g.createLinearGradient(0, py - 4, 0, py + 34); gr.addColorStop(0, 'rgba(200,240,255,0)'); gr.addColorStop(0.5, 'rgba(200,240,255,1)'); gr.addColorStop(1, 'rgba(120,200,255,0)');
        g.globalAlpha = brilho * 0.55 * al; g.fillStyle = gr; g.fillRect(Math.round(px + col.x), py - 4, Math.min(1.5, col.l), 38);
      }
      g.globalAlpha = 0.15 * al; g.drawImage(halo('#7ad8ff'), px - 6, py - 4, 44, 44);
      g.restore();
      if (Math.random() < 0.7 * al) this.fx.add({ x: px + 8 + Math.random() * 16, y: py + 6 + Math.random() * 26, vx: 0, vy: -14 - Math.random() * 12, cor: Math.random() < 0.5 ? '#ffffff' : '#9ae0ff', brilho: true, vida: 0.5, tam: 1.2, encolhe: true });
    } else if (e.tipo === 'portalShurima') {
      // Passagem Shurimane: anel dourado em pé, com runas girando e a energia azul no meio
      const al = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.25), cy = y - 14, s2 = 0.6 + 0.4 * Math.min(1, e.t / 0.3);
      g.save();
      g.globalAlpha = 0.3 * al; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y + 1, 12, 4, 0, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.55 * al; g.drawImage(halo('#30c8ff'), x - 22, cy - 26, 44, 52);
      const gi = g.createRadialGradient(x, cy, 1, x, cy, 14); gi.addColorStop(0, 'rgba(200,244,255,0.9)'); gi.addColorStop(0.6, 'rgba(48,200,255,0.5)'); gi.addColorStop(1, 'rgba(48,120,255,0)');
      g.globalAlpha = al; g.fillStyle = gi; g.beginPath(); g.ellipse(x, cy, 8 * s2, 14 * s2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffc040'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, cy, 10 * s2, 16 * s2, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#fff0b0'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, cy, 10 * s2, 16 * s2, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 6; i++) { const a2 = this.tempo * 3 + (i * Math.PI) / 3; g.fillStyle = i % 2 ? '#ffc040' : '#ffffff'; g.fillRect(Math.round(x + Math.cos(a2) * 10 * s2) - 1, Math.round(cy + Math.sin(a2) * 16 * s2) - 1, 2, 2); }
      g.restore();
      if (Math.random() < 0.5 * al) this.fx.add({ x: x + (Math.random() - 0.5) * 12, y: cy + (Math.random() - 0.5) * 22, vx: 0, vy: -16, cor: Math.random() < 0.5 ? '#ffc040' : '#30c8ff', brilho: true, vida: 0.5, tam: 1.3, encolhe: true });
    } else if (e.tipo === 'runaArcana') {
      if (e.alvo && !this.criaturas.has(e.alvo.id)) { e.t = e.dur; return; }
      // Marca Arcana: um círculo roxo girando no chão do monstro
      const al = Math.min(1, e.t / 0.15) * (0.7 + 0.3 * Math.sin(this.tempo * 8)), cy = y + 6;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = al;
      g.strokeStyle = '#b060ff'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, cy, 12, 5, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 4; i++) { const a2 = this.tempo * 2 + (i * Math.PI) / 2; g.fillStyle = '#e0b0ff'; g.fillRect(Math.round(x + Math.cos(a2) * 12) - 1, Math.round(cy + Math.sin(a2) * 5) - 1, 3, 2); }
      g.restore();
    } else if (e.tipo === 'rastro') {
      if (e.alvo && !this.criaturas.has(e.alvo.id)) { e.t = e.dur; return; }
      // rastros do Apogeu: um losango dourado por habilidade diferente, em cima do monstro
      const al = Math.min(1, e.t / 0.15), cy = y - 40 + Math.sin(this.tempo * 4) * 1.5;
      g.save(); g.globalAlpha = al;
      for (let i = 0; i < 3; i++) {
        const px2 = x - 8 + i * 8, cheio = i < e.n;
        g.fillStyle = cheio ? '#ffc040' : 'rgba(40,30,10,0.6)'; g.strokeStyle = cheio ? '#fff0b0' : '#806020'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px2, cy - 3); g.lineTo(px2 + 3, cy); g.lineTo(px2, cy + 3); g.lineTo(px2 - 3, cy); g.closePath(); g.fill(); g.stroke();
      }
      g.restore();
    } else if (e.tipo === 'apogeu') {
      // Apogeu da Manopla: o Ezreal brilhando dourado, com faíscas girando em volta
      const al = Math.min(1, e.t / 0.3) * Math.min(1, (e.dur - e.t) / 0.5), cy = y - 12, pulso = 0.8 + 0.2 * Math.sin(this.tempo * 6);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.45 * al * pulso; g.drawImage(halo('#ffc040'), x - 30, cy - 30, 60, 60);
      for (let i = 0; i < 5; i++) { const a2 = this.tempo * 2.5 + (i * Math.PI * 2) / 5; g.globalAlpha = al; g.fillStyle = i % 2 ? '#30c8ff' : '#ffc040'; g.fillRect(Math.round(x + Math.cos(a2) * 15) - 1, Math.round(cy + Math.sin(a2) * 7) - 1, 3, 3); }
      g.restore();
      if (Math.random() < 0.4 * al) this.fx.add({ x: x + (Math.random() - 0.5) * 18, y: y, vx: 0, vy: -30 - Math.random() * 20, cor: Math.random() < 0.6 ? '#ffc040' : '#30c8ff', brilho: true, forma: 'estrela', vida: 0.6, tam: 1.6, encolhe: true });
    } else if (e.tipo === 'ruptura') {
      // a fenda: uma rachadura em zigue-zague que se abre do Darius para a frente, com brilho vermelho que vai apagando
      const q = Math.min(1, k / 0.12), L = e.comp * q, N = 16, nx = -e.vy, ny = e.vx, brilho = Math.max(0, 1 - Math.max(0, k - 0.25) / 0.75);
      const ponto = (i) => { const f = i / N, larg = (4 + 3 * Math.sin(i * 1.7)) * e.zig[i % e.zig.length]; return [e.ox + e.vx * L * f + nx * larg, e.oy + e.vy * L * f * 0.75 + ny * larg * 0.5]; };
      const linha = () => { g.beginPath(); for (let i = 0; i <= N; i++) { const [px2, py2] = ponto(i); g[i ? 'lineTo' : 'moveTo'](px2, py2); } };
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      g.globalAlpha = Math.min(1, (1 - k) * 2.5); g.strokeStyle = '#140604'; g.lineWidth = 4.5; linha(); g.stroke();
      for (let i = 3; i < N; i += 4) { const [px2, py2] = ponto(i), lado = i % 8 ? 1 : -1; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px2, py2); g.lineTo(px2 + nx * 9 * lado + e.vx * 5, py2 + ny * 4 * lado + e.vy * 3); g.stroke(); }
      g.globalCompositeOperation = 'lighter';
      for (const [l, cor2, al] of [[7, '#ff1a08', 0.35], [3, '#ff4a20', 0.8], [1.2, '#ffd0a0', 1]]) { g.globalAlpha = al * brilho; g.strokeStyle = cor2; g.lineWidth = l; linha(); g.stroke(); }
      g.restore();
      if (brilho > 0.3 && Math.random() < 0.8) { const [px2, py2] = ponto(Math.floor(Math.random() * N * q)); this.fx.add({ x: px2, y: py2, vx: (Math.random() - 0.5) * 16, vy: -25 - Math.random() * 30, cor: Math.random() < 0.5 ? '#ff3a20' : '#ffb070', brilho: true, vida: 0.6, tam: 1.5, encolhe: true }); }
    } else if (e.tipo === 'dominio') {
      // Domínio de Noxus: território vermelho com espinhos em volta, anel girando, pulso a cada meio segundo e o machado fincado no meio
      if (e.segue) { const p = this.centro(e.segue); e.cx = p.x; e.cy = p.y + 10; }
      const cx = e.cx, cy = e.cy, R = e.raio, al = Math.min(1, e.t / 0.4) * Math.min(1, (e.dur - e.t) / 0.6), Ry = R * 0.42;
      g.save();
      g.globalAlpha = 0.24 * al; g.fillStyle = '#4a0606'; g.beginPath(); g.ellipse(cx, cy, R, Ry, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.95 * al; g.strokeStyle = '#b01010'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, R, Ry, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.55 * al; g.strokeStyle = '#ff4a2a'; g.lineWidth = 1; g.setLineDash([6, 6]); g.lineDashOffset = this.tempo * 20;
      g.beginPath(); g.ellipse(cx, cy, R * 0.72, Ry * 0.72, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 14; i++) {           // espinhos de Noxus em volta
        const a2 = (i * Math.PI * 2) / 14 + this.tempo * 0.25, px2 = cx + Math.cos(a2) * R, py2 = cy + Math.sin(a2) * Ry;
        g.globalAlpha = al; g.fillStyle = '#2a0a0a'; g.beginPath(); g.moveTo(px2 - 3, py2); g.lineTo(px2, py2 - 9); g.lineTo(px2 + 3, py2); g.closePath(); g.fill();
        g.strokeStyle = '#ff3a20'; g.lineWidth = 1; g.stroke();
      }
      g.globalCompositeOperation = 'lighter';
      const f = (e.t * 2) % 1;
      g.globalAlpha = (1 - f) * 0.4 * al; g.strokeStyle = '#ff3020'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, R * f, Ry * f, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.35 * al; g.drawImage(halo('#ff2a10'), cx - 26, cy - 34, 52, 52);
      g.restore();
      girado(g, efeitoMachado(), cx, cy - 12, 2.5, 0.6, al);       // o machado fincado no chão
      if (al > 0.3 && Math.random() < 0.6) { const a2 = Math.random() * 6.28, rr = Math.random(); this.fx.add({ x: cx + Math.cos(a2) * R * rr, y: cy + Math.sin(a2) * Ry * rr, vx: 0, vy: -20 - Math.random() * 25, cor: Math.random() < 0.5 ? '#ff3a20' : '#7a0808', brilho: true, vida: 0.8, tam: 1.5, encolhe: true }); }
    } else if (e.tipo === 'machadoDraven') {
      // Machado de Draven: o machado gira de verdade, com rastro, e volta para a mão
      const d = this.pos(this.darius), dx = d.px + 16, dy = d.py + 14;
      const posM = (q) => { const f = q < 0.5 ? q * 2 : 2 - q * 2; return [dx + (x - dx) * f, dy + (y - 4 - dy) * f - Math.sin(f * Math.PI) * 14]; };
      for (let i = 3; i >= 0; i--) {
        const q = Math.max(0, k - i * 0.035), [mx, my] = posM(q);
        girado(g, efeitoMachado(), mx, my, q * 38, 0.38, i ? 0.25 : 1);
      }
      { const [mx, my] = posM(k); if (k < 0.95) this.fx.add({ x: mx, y: my, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, cor: '#ff8a3a', brilho: true, vida: 0.3, tam: 1.5, encolhe: true }); }
      if (k > 0.92) { g.fillStyle = '#fff6c0'; g.fillRect(dx - 4, dy - 1, 8, 1); g.fillRect(dx - 1, dy - 4, 1, 8); }
    } else if (e.tipo === 'brilho') {
      for (let i = 0; i < 8; i++) {
        const f = (k * 2 + i / 8) % 1, ang = i * 0.8 + k * 3;
        g.globalAlpha = (1 - k) * (1 - f * 0.5);
        g.fillStyle = i % 2 ? '#ffffff' : e.cor;
        const r = 4 + f * 10, px = Math.round(x + Math.cos(ang) * r), py = Math.round(y + Math.sin(ang) * r * 0.7);
        g.fillRect(px - 1, py, 3, 1); g.fillRect(px, py - 1, 1, 3);
      }
    } else if (e.tipo === 'bolhas') {
      for (let i = 0; i < 7; i++) {
        const f = (k + i / 7) % 1;
        g.globalAlpha = 1 - k; g.fillStyle = i % 2 ? '#ffffff' : e.cor;
        g.fillRect(Math.round(x - 9 + ((i * 41) % 18)), Math.round(y + 6 - f * 26), 2, 2);
      }
    } else if (e.tipo === 'cura') {
      for (let i = 0; i < 16; i++) {
        const f = (k * 1.3 + i / 16) % 1;
        g.globalAlpha = 1 - k; g.fillStyle = i % 3 ? '#a8ffb0' : '#ffffff';
        g.fillRect(Math.round(x - 14 + ((i * 29) % 28)), Math.round(y + 10 - f * 40), 2, 2);
      }
    } else if (e.tipo === 'poof') {
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        g.fillStyle = i % 2 ? '#a8e0ff' : '#ffffff';
        g.fillRect(Math.round(x + Math.cos(ang) * k * 16), Math.round(y + Math.sin(ang) * k * 10), 2, 2);
      }
    }
    g.globalAlpha = 1;
  }
}
