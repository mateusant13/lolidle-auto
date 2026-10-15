// dados-katarina.js — LIDO DO JOGO VIVO em 2026-10-14 (nunca escrito à mão).
// Fonte: import('https://lolidle.com/js/dados-katarina.js') via relay CDP 9224 (mundo MAIN).
// Versão declarada pelo jogo: 16.19.1
// Ferramenta: tools/probe-dados-kata.mjs (repete-se quando o jogo mudar).
export const DADOS_KATARINA = {
  "versao": "16.19.1",
  "campeao": {
    "nome": "Katarina",
    "titulo": "a Lâmina Sinistra",
    "lore": "Decisiva em seus julgamentos e letal em combate, Katarina é a assassina de maior calibre de Noxus. Filha mais velha do lendário General Du Couteau, Katarina é reconhecida por seus assassinatos eficientes contra inimigos desavisados. Sua ambição ardente a levou a buscar alvos extremamente protegidos, mesmo correndo o risco de colocar seus aliados em perigo; mas não importa a missão, Katarina não hesita ao executar seu dever no meio de um furacão de adagas serrilhadas.",
    "stats": {
      "hp": 672,
      "hpperlevel": 108,
      "mp": 0,
      "mpperlevel": 0,
      "movespeed": 335,
      "armor": 32,
      "armorperlevel": 4.7,
      "spellblock": 32,
      "spellblockperlevel": 2.05,
      "attackrange": 125,
      "hpregen": 7.5,
      "hpregenperlevel": 0.7,
      "mpregen": 0,
      "mpregenperlevel": 0,
      "crit": 0,
      "critperlevel": 0,
      "attackdamage": 58,
      "attackdamageperlevel": 0,
      "attackspeedperlevel": 2.74,
      "attackspeed": 0.658
    },
    "funcoes": [
      "Assassin",
      "Mage"
    ]
  },
  "habilidades": {
    "P": {
      "nome": "Voracidade",
      "descricao": "Os Tempos de Recarga de Katarina são reduzidos drasticamente sempre que um Campeão que ela havia causado dano recentemente morrer. Se apanhar uma Adaga, Katarina a usa para cortar todos os inimigos próximos, causando Dano Mágico."
    },
    "Q": {
      "nome": "Lâmina Saltitante",
      "descricao": "Katarina arremessa uma Adaga no alvo. Ela salta em inimigos próximos antes de ricochetear e cair no chão.",
      "recarga": [
        11,
        10,
        9,
        8,
        7
      ]
    },
    "W": {
      "nome": "Preparação",
      "descricao": "Katarina recebe um impulso de Velocidade de Movimento e joga uma Adaga para cima.",
      "recarga": [
        15,
        14,
        13,
        12,
        11
      ]
    },
    "E": {
      "nome": "Shunpo",
      "descricao": "Katarina desloca-se em direção ao alvo, golpeando-o caso seja inimigo ou golpeando o inimigo mais próximo caso não seja.",
      "recarga": [
        12,
        11,
        10,
        9,
        8
      ]
    },
    "R": {
      "nome": "Lótus da Morte",
      "descricao": "Katarina gira em torno de si mesma, disparando adagas muito rapidamente e causando muito Dano Mágico nos 3 Campeões inimigos mais próximos.",
      "recarga": [
        75,
        60,
        45
      ]
    }
  },
  "skins": [
    {
      "num": 0,
      "nome": "Katarina"
    },
    {
      "num": 10,
      "nome": "Katarina Jurada de Morte"
    },
    {
      "num": 12,
      "nome": "Katarina Academia de Batalha"
    },
    {
      "num": 29,
      "nome": "Katarina Rainha de Batalha"
    }
  ]
};
