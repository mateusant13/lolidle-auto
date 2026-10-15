// Traduz os textos de exibição dos dados do jogo (itens, lugares, habilidades, conquistas…) quando o idioma é inglês.
// Só tem efeito no navegador em inglês: troca os campos de texto dos próprios objetos (as chaves continuam iguais),
// então o resto da interface já mostra tudo traduzido. Importe uma vez, antes de desenhar a interface.
// Os nomes dos monstros são chaves (MONSTROS, ESPOLIO_MONSTRO, tarefas…) e NÃO são trocados: na hora de mostrar, use t(nome).
// Os nomes dos mascotes também não (viram o nome do sprite): use t(MASCOTES[id].nome) para mostrar.
import { ingles, t } from './i18n.js';
import * as M from './motor.js';
import * as R from './runeterra.js';
import { DADOS } from './dados.js';
import { DADOS_EZREAL } from './dados-ezreal.js';
import { ITENS_DADOS } from './itens.js';

const feitos = new WeakSet();
// traduz os campos de texto de um objeto (cada objeto uma vez só, mesmo que apareça em mais de uma lista)
function traduzir(obj, campos) {
  if (!obj || typeof obj !== 'object' || feitos.has(obj)) return;
  feitos.add(obj);
  for (const k of campos) if (typeof obj[k] === 'string' && obj[k]) obj[k] = t(obj[k]);
}
const cada = (lista, campos) => { for (const o of Object.values(lista || {})) traduzir(o, campos); };

function campeao(d) {
  traduzir(d.campeao, ['titulo', 'lore']);
  cada(d.habilidades, ['nome', 'descricao']);
  cada(d.skins, ['nome']);
  cada(d.itens, ['nome', 'resumo', 'efeito']);
}

export function traduzirDados() {
  if (!ingles) return;
  // itens (M.ITENS usa os mesmos objetos de ITENS_DADOS)
  cada(ITENS_DADOS, ['nome', 'resumo', 'efeito']);
  cada(M.ITENS, ['nome', 'resumo', 'efeito']);
  campeao(DADOS);
  campeao(DADOS_EZREAL);
  for (const k of Object.keys(M.NOME_RARIDADE)) M.NOME_RARIDADE[k] = t(M.NOME_RARIDADE[k]);
  cada(M.POCOES, ['nome']);
  cada(M.ESPOLIOS, ['nome']);
  cada(M.LOCAIS, ['nome', 'descricao']);          // LOCAL aponta para os mesmos objetos
  cada(M.ATRIBUTOS, ['curto', 'nome', 'serve', 'efeito']);
  for (const k of Object.keys(M.DICA_ATRIBUTOS)) M.DICA_ATRIBUTOS[k] = t(M.DICA_ATRIBUTOS[k]);
  cada(M.MODELOS, ['nome']);
  // habilidades do motor (as do LoL e as extras do MMORPG) e as skins de cada kit (cópias das de DADOS)
  for (const k of Object.values(M.KITS)) {
    cada(k.hab, ['nome', 'desc']);
    cada(k.skins, ['nome']);
  }
  cada(M.HAB, ['nome', 'desc']);
  cada(M.SKINS, ['nome']);
  cada(M.CONQUISTAS, ['nome', 'desc', 'titulo']);
  for (const m of Object.values(M.MASCOTES)) {
    traduzir(m, ['desc']);                          // o nome fica (é o nome do sprite)
    if (m.req) traduzir(m.req, ['texto']);
  }
  for (const l of Object.values(M.SKINS_PET)) cada(l, ['nome']);
  cada(M.LOJA, ['nome', 'desc']);
  cada(R.CIDADES, ['nome']);                        // CIDADE aponta para os mesmos objetos
  for (const k of Object.keys(R.NOME_ZONA)) R.NOME_ZONA[k] = t(R.NOME_ZONA[k]);
}
traduzirDados();

