// Campeões do LoL Idle. Usado pela tela de criação de personagem, pelo jogo, pelo site e pelo servidor (que só aceita os disponíveis).
// Para lançar um campeão novo: gere os dados (node _raw/gerar_campeao.mjs), acrescente-o aqui com disponivel: true
// e crie o kit dele no motor (atributos, habilidades e lógica), o sprite em pixel.js e os efeitos em cena.js.
import { t, ingles } from './i18n.js';
export const CAMPEOES = [
  {
    id: 'darius', nome: 'Darius', titulo: 'a Mão de Noxus', funcao: 'Lutador', regiao: 'Noxus', disponivel: true,
    alcance: 'corpo a corpo',
    resumo: 'Sangra os inimigos com a Hemorragia, gira o machado no Dizimar e executa quem estiver fraco com a Guilhotina Noxiana. Aguenta caçadas longas e fica mais forte quanto mais o combate dura.',
  },
  {
    id: 'ezreal', nome: 'Ezreal', titulo: 'o Explorador Pródigo', funcao: 'Atirador', regiao: 'Piltover', disponivel: true,
    alcance: 'à distância',
    resumo: 'Ataca de longe com a luva shurimane: acerta os monstros antes que cheguem perto, recua atirando quando alcançado (até o fôlego acabar), se teletransporta quando cercado e varre o grupo inteiro com a Barragem Incendiária. Frágil se for pego.',
  },
  {
    id: 'lux', nome: 'Lux', titulo: 'a Dama da Luz', funcao: 'Maga', regiao: 'Demacia', disponivel: true,
    alcance: 'à distância',
    resumo: 'Usa o Poder de Habilidade: prende os monstros com a Ligação da Luz, protege-se com a Barreira Prismática, explode grupos com a Singularidade Lucente e apaga a tela com a Centelha Final. Cresce muito com itens de mago, mas é a mais frágil dos três.',
  },
  {
    id: 'yasuo', nome: 'Yasuo', titulo: 'o Imperdoável', funcao: 'Espadachim', regiao: 'Ionia', disponivel: true,
    alcance: 'corpo a corpo',
    resumo: 'Não usa mana: luta com o Fluxo, que vira um escudo de vento. Tem o dobro de chance de acerto crítico, joga os monstros para o alto com o tornado da Tempestade de Aço, atravessa o grupo com a Espada Ágil, bloqueia tiros com a Parede de Vento e finaliza com o Último Suspiro em quem está no ar.',
  },
  {
    id: 'katarina', nome: 'Katarina', titulo: 'a Lâmina Sinistra', funcao: 'Assassina', regiao: 'Noxus', disponivel: true,
    alcance: 'corpo a corpo',
    resumo: 'Não usa mana: as habilidades só dependem da recarga. Joga adagas que caem no chão e, ao pegar uma, gira cortando todos em volta. Aparece ao lado dos monstros com o Shunpo, e cada abate faz as habilidades voltarem mais rápido. Escala com o Poder de Habilidade e usa itens de mago, mas é frágil.',
  },
  {
    id: 'taric', nome: 'Taric', titulo: 'o Escudo de Valoran', funcao: 'Suporte', regiao: 'Targon', disponivel: true,
    alcance: 'corpo a corpo',
    resumo: 'Tanque que cura: o Fulgor Estelar cura ele e o grupo, e o Bastião e a Égide Cristalina dão escudos. Depois de cada habilidade, os próximos ataques batem mais forte e as recargas andam. Atordoa com o feixe do Deslumbrar e, no Resplendor Cósmico, ele e o grupo ficam invulneráveis. Escala com o Poder de Habilidade e a armadura.',
  },
  // Zac: fase 1 (motor) pronta; a fase 2 (desenho, Runeterra, PvP, ícones e wiki) troca para disponivel: true
  {
    id: 'zac', nome: 'Zac', titulo: 'a Arma Secreta', funcao: 'Tanque', regiao: 'Zaun', disponivel: true,
    alcance: 'corpo a corpo',
    resumo: 'Tanque de gosma que entra no meio do grupo: se lança longe com o Estilingue Elástico, agarra os monstros com a Esticada e quica em cima deles no Vamos pular!. Não usa mana: cada habilidade custa um pouco da vida, e as gosmas que se soltam dele curam quando ele pega. Ao cair, se divide e volta a se juntar. Escala com a vida e com o Poder de Habilidade.',
  },
];
// quantas vagas "em breve" aparecem na tela de criação (diminuem conforme novos campeões chegam)
// em inglês, os textos de apresentação já saem traduzidos (o nome e o id ficam iguais)
if (ingles) for (const c of CAMPEOES) for (const k of ['titulo', 'funcao', 'regiao', 'alcance', 'resumo']) c[k] = t(c[k]);
export const VAGAS_EM_BREVE = 0;
export const CAMPEAO_PADRAO = 'darius';
export const campeao = (id) => CAMPEOES.find((c) => c.id === id) || CAMPEOES.find((c) => c.id === CAMPEAO_PADRAO);
export const campeaoDisponivel = (id) => CAMPEOES.some((c) => c.id === id && c.disponivel);

// onde ficam os arquivos de cada campeão (o Darius, o primeiro, ficou na raiz das pastas)
const pasta = (id) => (id === 'darius' ? '' : `${id}/`);
// o Cloudflare guarda as imagens por horas: aumente V_ICONES sempre que gerar ícones novos, senão os jogadores continuam vendo os antigos
const V_ICONES = 12;
export const iconeHabilidade = (id, tecla) => `assets/img/habilidades/${pasta(id)}${tecla}.png?v=${V_ICONES}`;
const V_SPLASH = 2;      // aumente quando uma imagem de skin entrar ou mudar (a Cloudflare guarda as imagens por horas)
export const splashSkin = (id, num) => `assets/img/skins/${pasta(id)}${num}.jpg?v=${V_SPLASH}`;
// nome do sprite em pixel.js: "darius", "darius@15", "ezreal", "ezreal@5"…
export const spriteCampeao = (id, skin) => (skin ? `${id}@${skin}` : id);

