// Guildas: regras e brasões. Usado pelo jogo (desenhar e escolher o brasão) e pelo servidor (conferir o que chegou).
// Um brasão é "icone:cor" (ex.: "machado:noxus"): um escudo pintado na cor com o símbolo por cima.

export const GUILDA = { custo: 100000, maxMembros: 5, nomeMin: 3, nomeMax: 20, convitesDias: 7,
  custoNome: 50000, esperaNomeDias: 7,        // trocar o nome: só o líder, uma vez a cada 7 dias
  // vagas a mais (09/10/2026, sugestão de jogador): o líder compra com ouro, da 6ª à 10ª, cada uma mais cara (1,2 mi no total)
  vagasMax: 10, custoVaga: [50000, 100000, 200000, 350000, 500000] };
export const vagasDe = (g) => Math.max(GUILDA.maxMembros, Math.min(GUILDA.vagasMax, Number(g?.vagas) || GUILDA.maxMembros));
export const custoProximaVaga = (vagas) => GUILDA.custoVaga[vagas - GUILDA.maxMembros] || null;
// cofre da guilda: qualquer membro doa ouro (a partir de doacaoMin) e o líder usa para comprar vagas; o cofre não passa
// do que falta para todas as vagas (ouro parado lá não serviria para nada)
export const DOACAO_MIN = 1000;
export const custoVagasRestantes = (vagas) => GUILDA.custoVaga.slice(Math.max(0, vagas - GUILDA.maxMembros)).reduce((s, c) => s + c, 0);
export const NOME_GUILDA = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9]+( [A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*$/;

// cores do escudo (nome → [cor do escudo, cor do símbolo])
export const CORES_BRASAO = {
  noxus: ['#9a1c1c', '#f0d48a'],
  demacia: ['#2a5aa8', '#f4f0e0'],
  piltover: ['#c8901a', '#2a1a06'],
  zaun: ['#2a8a4a', '#d8ffd0'],
  freljord: ['#6ab8d8', '#0e2a3a'],
  vazio: ['#5a2a8a', '#ff9af0'],
  ilhas: ['#1a5a5a', '#9affd8'],
  shurima: ['#e0b850', '#5a2a08'],
};

// símbolos em grade de 16×16 (caminhos SVG em pixels inteiros)
export const ICONES_BRASAO = {
  machado: 'M7 2h2v12H7zM4 3h3v1H5v4h2v1H4zM9 3h3v6H9V8h2V4H9z',
  espada: 'M7 1h2v9H7zM4 10h8v2H4zM7 12h2v3H7zM6 2h1v7H6z',
  coroa: 'M2 5l3 3 3-5 3 5 3-3v7H2zM2 13h12v2H2z',
  caveira: 'M4 3h8v1h1v5h-1v2h-1v2H5v-2H4V9H3V4h1zM5 6v2h2V6zM9 6v2h2V6zM7 9v1h2V9zM6 11v1h1v-1zM9 11v1h1v-1z',
  lua: 'M6 2h4v1H8v1H7v8h1v1h2v1H6v-1H5v-1H4V5h1V4h1z',
  sol: 'M7 1h2v2H7zM7 13h2v2H7zM1 7h2v2H1zM13 7h2v2h-2zM5 5h6v6H5zM3 3h2v2H3zM11 3h2v2h-2zM3 11h2v2H3zM11 11h2v2h-2z',
  estrela: 'M7 1h2v4h4v2h-2v2l2 5h-2l-3-3-3 3H3l2-5V7H3V5h4z',
  raio: 'M9 1h3L9 7h3L6 15l2-6H5z',
  olho: 'M2 7h1V6h2V5h6v1h2v1h1v2h-1v1h-2v1H5v-1H3V9H2zM6 6v4h4V6zM7 7h2v2H7z',
  chama: 'M8 1h1v2h1v2h1v1h1v5h-1v2h-1v1H6v-1H5v-2H4V7h1V6h1V4h1V2h1zM7 9v3h2V9z',
  lobo: 'M3 2h2v2h1v1h4V4h1V2h2v6h-1v2h-1v2h-1v2H6v-2H5v-2H4V8H3zM5 6v1h2V6zM9 6v1h2V6z',
  escudo: 'M3 2h10v6h-1v2h-1v2h-1v1H6v-1H5v-2H4V8H3zM7 4v7h2V4z',
};
export const ICONES_LISTA = Object.keys(ICONES_BRASAO);
export const CORES_LISTA = Object.keys(CORES_BRASAO);
export const BRASAO_PADRAO = 'machado:noxus';

export const brasaoValido = (b) => {
  if (typeof b !== 'string') return false;
  const [i, c] = b.split(':');
  return Object.hasOwn(ICONES_BRASAO, i) && Object.hasOwn(CORES_BRASAO, c) && b === `${i}:${c}`;      // hasOwn: "constructor:constructor" passava
};
export const nomeGuildaValido = (n) => typeof n === 'string' && n.length >= GUILDA.nomeMin && n.length <= GUILDA.nomeMax && NOME_GUILDA.test(n);

// o brasão em SVG (escudo com borda dourada e o símbolo no meio)
export function svgBrasao(b, tam = 32) {
  const [i, c] = (brasaoValido(b) ? b : BRASAO_PADRAO).split(':');
  const [fundo, simbolo] = CORES_BRASAO[c];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 26" width="${tam}" height="${Math.round(tam * 26 / 24)}" shape-rendering="crispEdges" aria-hidden="true">`
    + `<path d="M2 1h20v12l-2 5-4 4-4 3-4-3-4-4-2-5z" fill="#3a2a10"/>`
    + `<path d="M3 2h18v11l-2 4.5-3.6 3.6L12 23.6l-3.4-2.5L5 17.5 3 13z" fill="${fundo}"/>`
    + `<path d="M3 2h18v3H3z" fill="#fff" opacity=".12"/>`
    + `<path d="M2 1h20v12l-2 5-4 4-4 3-4-3-4-4-2-5z" fill="none" stroke="#e8c070" stroke-width="1"/>`
    + `<g transform="translate(4 3.5)"><path d="${ICONES_BRASAO[i]}" fill="#000" opacity=".35" transform="translate(.6 .6)"/><path d="${ICONES_BRASAO[i]}" fill="${simbolo}"/></g></svg>`;
}
export const urlBrasao = (b) => 'data:image/svg+xml,' + encodeURIComponent(svgBrasao(b, 48));

