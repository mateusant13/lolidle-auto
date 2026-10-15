// motor.js — LIDO DO JOGO VIVO em 2026-10-14 via https://lolidle.com/js/motor.js (curl, sem browser).
// 285082 bytes · 3846 linhas · sha256 e3bb66d4d8c6574d77fe6736aac783ca8b3b4e404b0b2983768baf77c176b8eb
// A copia anterior do repo (278724 bytes / 3792 linhas, mais de 60 linhas atrasada) ficou em
// docs/historico/motor-anterior-desactualizado.js. Regra N.o 3: numero LIDO, nunca copiado.
// DIFERENCAS vs a copia antiga: +54 linhas, com o lote de mascote no mercado (ofertaMascote/MASCOTE)
// e novos comentarios; ha INSERTOES a partir da linha 122, logo os numeros de linha dos documentos
// antigos podem estar desviados em dezenas — relocalizar por conteudo, nao por linha.
// Motor do jogo: estado, atributos, combate, loot e progressão. Sem DOM, para poder simular no Node.
import { DADOS } from './dados.js';
import { DADOS_EZREAL } from './dados-ezreal.js';
import { DADOS_YASUO } from './dados-yasuo.js';
import { DADOS_LUX } from './dados-lux.js';
import { DADOS_KATARINA } from './dados-katarina.js';
import { DADOS_TARIC } from './dados-taric.js';
import { DADOS_ZAC } from './dados-zac.js';
import { ITENS_DADOS } from './itens.js';
import { t, ingles } from './i18n.js';
import { BALANCO } from './balanco.js';

export const ITENS = Object.fromEntries(ITENS_DADOS.map((i) => [i.id, i]));
// componentes que no LoL dão atributos que o gerador não traz: aqui ganham o efeito equivalente
// (regen = vida por segundo, cdr = redução de recarga das habilidades)
Object.assign(ITENS['2022'], { cdr: 0.05, resumo: 'Reduz a recarga das habilidades' });          // Partícula Brilhante
Object.assign(ITENS['1006'], { regen: 3 });                                                         // Pérola do Rejuvenescimento
Object.assign(ITENS['3057'], { efeito: 'Lâmina Encantada: depois de usar uma habilidade, o próximo ataque (ou o Disparo Místico do Ezreal) causa +100% do Dano de Ataque base.' });  // Fulgor
// item que não dá nada ao ser equipado (só serve de componente) não entra no equipamento
export const temAtributo = (x) => { const i = ITENS[baseId(x)]; return !!(i && (i.ad || i.ap || i.mana || i.vida || i.armadura || i.rm || i.va || i.rv || i.critico || i.regen || i.cdr || i.efeito)); };
// classe do item: 'ap' (de mago: Poder de Habilidade), 'ad' (de ataque: dano, crítico, velocidade, roubo de vida) ou 'neutro' (vida, armadura, mana…)
export const classeItem = (x) => { const i = ITENS[baseId(x)]; if (!i) return 'neutro'; const ad = i.ad || i.critico || i.va || i.rv; return i.ap && !ad ? 'ap' : ad && !i.ap ? 'ad' : 'neutro'; };
// componentes e itens de mago que no LoL dão atributos que o gerador não traz
Object.assign(ITENS['4629'], { cdr: 0.15 });           // Ímpeto Cósmico (aceleração de habilidade)
Object.assign(ITENS['3108'], { cdr: 0.05 });           // Códex Demoníaco
Object.assign(ITENS['3802'], { cdr: 0.05 });           // Capítulo Perdido
export const NIVEL_MAX = 50;
export const ESPACOS = 5;        // itens equipados: 1 bota + 4 outros (out/2026)
export const ESPACOS_ITENS = 4;  // espaços para os itens que não são bota
// o tipo de cada item (js/itens.js, campo espaco). O equipamento tem 1 espaço só de bota e 4 livres: o tipo só serve para achar a bota
export const ESPACOS_EQUIP = ['arma', 'armadura', 'cabeca', 'mao', 'botas', 'acessorio'];
export const NOME_ESPACO = { arma: 'Arma', armadura: 'Armadura', cabeca: 'Cabeça', mao: 'Mão esquerda', botas: 'Botas', acessorio: 'Acessório' };
export const espacoDe = (x) => ITENS[baseId(x)]?.espaco || null;
// mochila: começa com 20 espaços e ganha mais conforme o nível (+2 a cada 5 níveis, 40 no nível 50); MOCHILA é o máximo
export const MOCHILA_INICIO = 20, MOCHILA_GANHO = { niveis: 5, espacos: 2 };
export const mochilaDe = (nivel) => MOCHILA_INICIO + MOCHILA_GANHO.espacos * Math.floor(Math.min(NIVEL_MAX, Math.max(1, nivel || 1)) / MOCHILA_GANHO.niveis);
export const MOCHILA = mochilaDe(NIVEL_MAX);
// o nível em que o espaço k (contando do 0) da mochila libera
export const nivelDoEspaco = (k) => k < MOCHILA_INICIO ? 1 : MOCHILA_GANHO.niveis * Math.ceil((k + 1 - MOCHILA_INICIO) / MOCHILA_GANHO.espacos);
export const RECALL = 4;         // segundos para voltar à base
export const EXAUSTAO = 1;       // intervalo mínimo entre poções, como no Tibia
// lutando contra outro jogador (nos últimos segundos), a poção cura metade e só pode ser usada a cada 3 s
export const POCAO_PVP = { cura: 0.3, exaustao: 6 };      // em luta contra jogador (0,5 e 3 s até 13/10/2026; p630)

// ---------- Itens como drop de MMORPG ----------
// básico = componente (não é feito de nada); épico = intermediário; lendário = item final
export const raridade = (i) => i.raridade || (i.lendario ? 'lendario' : 'basico');
export const NOME_RARIDADE = { basico: 'básico', epico: 'épico', lendario: 'lendário' };
const POR_RARIDADE = { basico: [], epico: [], lendario: [] };
for (const i of ITENS_DADOS) POR_RARIDADE[raridade(i)].push(i.id);
// por classe de campeão: quem luta com ataque não recebe item de mago, e o mago não recebe item de ataque
const POR_CLASSE = { ad: { basico: [], epico: [], lendario: [] }, ap: { basico: [], epico: [], lendario: [] } };
// itens refinados são guardados como "id+N" (ex.: "3044+2")
export const REFINO_MAX = 5;
export const BONUS_REFINO = 0.12;            // +12% em todos os bônus do item por nível de refino
// chance de forjar +1..+5 com ouro, e a chance de, ao falhar, o item PERDER um nível de refino (ver _raw/balanco.mjs).
// O começo é fácil e seguro: +1 e +2 saem rápido e nunca regridem; a regressão só existe da tentativa de +3 em diante.
// 09/10/2026 (pedido de jogadores: do +2 para o +3 a chance despencava de 12% para 0,4%): a escada ficou 30% → 12% → 2% →
// 0,8% → 0,3%, e cada tentativa do +3 em diante custa o dobro (PRECO_REFINO_ALTO). Antes: [0.30, 0.12, 0.004, 0.002, 0.001].
export const CHANCE_REFINO = [0.30, 0.12, 0.02, 0.008, 0.003];
export const PRECO_REFINO_ALTO = 2;
export const REGRESSAO_REFINO = [0, 0, 0.04, 0.015, 0.006];
// Persistência do Ornn (proteção contra azar): cada falha conta. Desde a primeira falha a chance sobe um pouquinho
// (PERSISTENCIA_PASSO da chance por falha, até +PERSISTENCIA_TETO); depois de "subir" falhas seguidas ela começa a crescer
// rápido, e na tentativa "max" é garantida. Na forja conta por nível que se tenta alcançar (+1 a +5) e pela raridade do
// item (básico, épico, lendário: chave "<alvo>:<raridade>", p555 de 12/10/2026; antes valia para qualquer item e dava para
// juntar falhas de +3 a +5 num item barato e gastar no lendário); na montagem, por receita. Ao dar certo, zera só aquela faixa.
export const PERSISTENCIA = {
  forja: { 1: {}, 2: {}, 3: { subir: 80, max: 120 }, 4: { subir: 200, max: 300 }, 5: { subir: 530, max: 800 } },        // antes 268/400, 540/1000, 1100/2000
  montar: { epico: { subir: 108, max: 150 }, lendario: { subir: 1125, max: 1500 } },
};
export const PERSISTENCIA_PASSO = 0.01, PERSISTENCIA_TETO = 0.5;
// quanto a chance já subiu só pelas falhas (0,05 = +5% da chance)
export const bonusFalhas = (falhas) => Math.min(PERSISTENCIA_TETO, PERSISTENCIA_PASSO * (falhas || 0));
export function comPersistencia(base, falhas, regra) {
  if (!regra) return base;
  const b = Math.min(1, base * (1 + bonusFalhas(falhas)));
  if (!regra.subir || falhas < regra.subir) return b;
  return Math.min(1, b + ((1 - b) * (falhas - regra.subir + 1)) / (regra.max - regra.subir));
}
// a faixa da persistência da forja: a raridade do item (aceita também 'basico', 'epico' ou 'lendario' direto)
export const faixaForja = (x) => { if (Object.hasOwn(POR_RARIDADE, x)) return x; const i = Object.hasOwn(ITENS, baseId(x)) ? ITENS[baseId(x)] : null; return i ? raridade(i) : 'basico'; };
export const chaveForja = (alvo, x) => `${alvo}:${faixaForja(x)}`;
const contador = (o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) && Number.isFinite(o[k]) && o[k] > 0 ? o[k] : 0);
export const falhasForja = (e, alvo, x) => contador(e.persistencia?.forja, chaveForja(alvo, x));
// saves de antes do p555: as falhas contadas só pelo nível ("3": 57) vão para a faixa dos lendários ("3:lendario": 57)
export function migrarPersistencia(e) {
  const f = e?.persistencia?.forja;
  if (!f || typeof f !== 'object') return e;
  for (const k of Object.keys(f)) {
    if (!/^[1-5]$/.test(k)) continue;
    const v = contador(f, k), nova = `${k}:lendario`;
    if (v) f[nova] = Math.max(contador(f, nova), v);
    delete f[k];
  }
  return e;
}
export const falhasMontar = (e, id) => e.persistencia?.montar?.[id] || 0;
function anotarFalha(e, tipo, chave, falhou) {
  e.persistencia ??= {}; e.persistencia[tipo] ??= {};
  if (falhou) e.persistencia[tipo][chave] = contador(e.persistencia[tipo], chave) + 1; else delete e.persistencia[tipo][chave];
}
// ---------- Gemas: caem dos monstros e, gastas no Ornn, ajudam uma tentativa ----------
// mult: multiplica a chance da tentativa; protege: se a forja falhar, o item não volta de nível.
// chance: por monstro comum (o Campo Vermelho dá ~40% a mais que a Rota; o Barão, ~70%); chefe: chance própria.
// Ficam numa bolsa à parte (não ocupam a mochila) e podem ser vendidas no mercado entre jogadores.
export const GEMAS = {
  sorte: { nome: 'Runa da Sorte', cor: '#4fe0a0', mult: 1.25, forja: true, montar: true, chance: 0.0053, chefe: 0.3,
    desc: 'Multiplica por 1,25 a chance de uma tentativa de forja ou de montagem (10% vira 12,5%; 0,1% vira 0,125%).' },
  arcana: { nome: 'Runa Arcana', cor: '#5ad8ff', mult: 2, forja: true, montar: true, chance: 0.00063, chefe: 0.08,
    desc: 'Dobra a chance de uma tentativa de forja ou de montagem (10% vira 20%; 0,1% vira 0,2%).' },
  protecao: { nome: 'Runa de Proteção', cor: '#ffcc4a', protege: true, forja: true, montar: false, chance: 0.00063, chefe: 0.08,
    desc: 'Se a forja falhar, o item não volta de nível.' },
};
export const ORDEM_GEMAS = ['sorte', 'arcana', 'protecao'];
export const nomeGema = (id) => t(GEMAS[id]?.nome || id);
// a gema que o jogador escolheu serve para isto (forja ou montagem) e ele tem pelo menos uma?
export const podeUsarGema = (e, gema, para) => !!(gema && GEMAS[gema]?.[para] && (e.gemas?.[gema] || 0) > 0);
function gastarGema(e, gema) { e.gemas[gema]--; if (!e.gemas[gema]) delete e.gemas[gema]; }
// no mercado, um lote de gemas vira o item "gema:<id>:<quantidade>"
export const ofertaGema = (item) => { const m = /^gema:(\w+):(\d+)$/.exec(String(item)); return m && Object.hasOwn(GEMAS, m[1]) && +m[2] >= 1 ? { id: m[1], q: +m[2] } : null; };
// o lote de mascote no mercado (p677): "mascote:<id>", só dos negociáveis (o Poro de Bigode); devolve o id ou null
export const ofertaMascote = (item) => { const m = /^mascote:(\w+)$/.exec(String(item)); return m && Object.hasOwn(MASCOTES, m[1]) && MASCOTES[m[1]].negociavel ? m[1] : null; };
export const nomeOferta = (item) => { const g = ofertaGema(item); if (g) return `${g.q}× ${nomeGema(g.id)}`; const mo = ofertaMascote(item); return mo ? MASCOTES[mo].nome : infoItem(item).nomeRef; };
export function chancesGema(local, mult = 1) {
  const k = 1 + (local?.tier || 0) * 0.1;
  return Object.fromEntries(ORDEM_GEMAS.map((id) => [id, Math.min(1, GEMAS[id].chance * k * mult)]));
}
export function sortearGemas(local, chefe, mult = 1) {
  const r = [];
  if (chefe) { for (const id of ORDEM_GEMAS) if (Math.random() < GEMAS[id].chefe * mult) r.push(id); return r; }
  const ch = chancesGema(local, mult);
  for (const id of ORDEM_GEMAS) if (Math.random() < ch[id]) r.push(id);
  return r;
}
// chance desta tentativa já contando a persistência acumulada
// x: o item na bigorna (a persistência é da faixa dele)
export const chanceForjaAgora = (e, ref, x) => comPersistencia(chanceRefino(e, ref), falhasForja(e, ref + 1, x), PERSISTENCIA.forja[ref + 1]);


// ---------- VIP (apoiadores) ----------
// Vantagem pequena de propósito: 20% a mais sobre o normal (1% de drop vira 1,2%), nunca algo que desequilibre.
// O servidor é quem diz até quando o VIP vale (estado.vipAte): o que o navegador mandar nesse campo é ignorado.
// grupo em Runeterra: até 4 jogadores; cada outro membro vivo a até 15 tiles dá +15% de experiência
export const GRUPO = { max: 4, raio: 15, porMembro: 0.15 };
// boasVindas: dias de VIP de presente para toda conta nova (cadastro ou convidado), para experimentar o automático
export const VIP = { boasVindas: 2, xp: 1.2, drop: 1.2, refino: 1.2, refinoMax: 0.5, preco: 200, dias: 30 };       // 200 💎 = R$ 4 (09/10/2026: R$ 1 = 50 💎)
// convidado que salva a conta (cria nome, email e senha) ganha mais 1 dia de VIP (out/2026: para ele criar vínculo e voltar)
VIP.salvarConvidado = 1;
// presente do nível 3 (out/2026: metade dos jogadores novos saía antes dos 9 minutos): um épico de qualidade A da classe do campeão,
// uma vez por conta, entregue pelo servidor (POST /api/presente-nivel). O jogo oferece até o nível 9.
export const PRESENTE_NIVEL = { nivel: 3, ateNivel: 9, item: { ad: '3044', ap: '3145' }, qualidade: 'A' };
export const presenteNivelDe = (estado) => `${PRESENTE_NIVEL.item[kit(estado).magia ? 'ap' : 'ad']}~${PRESENTE_NIVEL.qualidade}`;
export const ehVip = (estado) => (estado?.vipAte || 0) > Date.now();
export const chanceRefino = (estado, ref) => (ehVip(estado) ? Math.min(VIP.refinoMax, CHANCE_REFINO[ref] * VIP.refino) : CHANCE_REFINO[ref]);
// a rotina automática (ir à base, vender, comprar poções e voltar) é do VIP
// o "Automático" (poções sozinhas e voltar à Fonte) é do VIP; cada opção liga e desliga à parte
export const rotinaAtiva = (estado) => ehVip(estado);
// um item é um texto: o id do item, o refino (+N) e a qualidade (~Q). "3071+2~S" = Sedenta +2 de qualidade S.
// Sem ~Q é um item de antes das qualidades e vale como B. "~?" = acabou de cair e o servidor ainda vai sortear a qualidade.
export function baseId(x) { const s = String(x), i = s.search(/[+~]/); return i < 0 ? s : s.slice(0, i); }
export const refinoDe = (x) => +((/\+(\d+)/.exec(String(x)) || [])[1] || 0);
const sufixoQual = (x) => (/~(SS|S|A|B|C|\?)$/.exec(String(x)) || [])[1] || null;
// a qualidade do item ('?' enquanto o servidor não sorteou; sem marca = B)
export const qualidadeDe = (x) => sufixoQual(x) || 'B';
export const pendente = (x) => sufixoQual(x) === '?';
// monta o texto do item (mantém a marca de qualidade do item original quando ela existe)
export const comItem = (base, ref, qual) => `${base}${ref > 0 ? '+' + ref : ''}${qual ? '~' + qual : ''}`;
const comRefino = (x, n) => comItem(baseId(x), n, sufixoQual(x));

// ---------- Qualidade dos itens (out/2026) ----------
// Todo item que cai, sai do baú ou é montado ganha uma qualidade sorteada pelo servidor. A qualidade multiplica os
// atributos do item (mult) e o preço no Lojista (venda). peso = chance em % (somam 100).
// 09/10/2026 (pedido do dono): S e SS ficaram muito mais raros (antes S 4,5% e SS 0,5%; o C ficou com a diferença).
export const QUALIDADES = {
  C: { peso: 49.9495, mult: 0.9, venda: 0.8, cor: '#a8a8a8' },
  B: { peso: 35, mult: 1, venda: 1, cor: '#e8e4d8' },
  A: { peso: 15, mult: 1.15, venda: 1.5, cor: '#5adc6a' },
  S: { peso: 0.05, mult: 1.35, venda: 3, cor: '#ffc840' },
  SS: { peso: 0.0005, mult: 1.7, venda: 8, cor: '#ff5a8a' },        // out/2026: o SS é bem mais forte que um lendário comum
};
export const ORDEM_QUAL = ['C', 'B', 'A', 'S', 'SS'];
// bônus (0 = chances normais): na montagem, peças de qualidade alta melhoram as chances de A, S e SS
export function chancesQualidade(bonus = 0) {
  const b = Math.max(0, bonus), w = (q) => QUALIDADES[q].peso;
  const p = { C: w('C'), B: w('B'), A: w('A') * (1 + 0.5 * b), S: w('S') * (1 + 0.6 * b), SS: w('SS') * (1 + 0.8 * b) };
  const tot = Object.values(p).reduce((a, x) => a + x, 0);
  return Object.fromEntries(ORDEM_QUAL.map((q) => [q, p[q] / tot]));
}
export function sortearQualidade(bonus = 0, rng = Math.random) {
  const ch = chancesQualidade(bonus); let x = rng();
  for (const q of ORDEM_QUAL) { if (x < ch[q]) return q; x -= ch[q]; }
  return 'C';
}
// bônus da montagem: a média das peças (C 0, B 1, A 2, S 3, SS 4) acima de B
export const bonusMontagem = (pecas) => (pecas.length ? Math.max(0, pecas.reduce((a, x) => a + ORDEM_QUAL.indexOf(qualidadeDe(x) === '?' ? 'B' : qualidadeDe(x)), 0) / pecas.length - 1) : 0);
// o servidor sorteia a qualidade dos itens "~?" do save e guarda o que acabou de revelar em e.avaliados ([{ b, q, em }]; só o
// servidor escreve: o api.js copia do save anterior). Dois casos em que um "~?" não é sorteado do zero (12/10/2026):
//  1) o jogo mandou o save seguinte antes de aplicar a resposta: o item revelado (base~q) não está no save que chegou e o
//     "~?" ainda está lá. Recebe exatamente a qualidade já sorteada (as revelações valem até o próximo save aceito, até AVALIADOS.ms).
//  2) sumiu um item avaliado da mesma base e apareceu um "~?" sem ser revelação recente: pode ser o item de volta como "~?"
//     (tentativa de sortear de novo) ou um item vendido no mesmo intervalo em que caiu outro da mesma base. Não dá para saber
//     qual: fica com a PIOR entre a qualidade que sumiu e um sorteio novo. Assim ninguém sorteia de novo para melhorar e
//     ninguém herda o S de um item vendido (antes herdava qualquer qualidade que sumiu: vender um S no intervalo em que caía
//     outro da mesma base fazia o novo virar S).
// Devolve a lista do que foi revelado, na ordem (itens equipados, depois a mochila).
export const AVALIADOS = { ms: 10 * 60e3, max: 50 };      // 50: cabe a mochila cheia (40) e os 5 equipados
export function revelarPendentes(antes, e, rng = Math.random, agora = Date.now()) {
  const tinha = new Map(), tem = new Map();
  const chave = (x) => baseId(x) + '~' + qualidadeDe(x);
  for (const x of [...(antes?.itens || []), ...(antes?.mochila || [])]) if (!pendente(x)) tinha.set(chave(x), (tinha.get(chave(x)) || 0) + 1);
  for (const x of [...(e.itens || []), ...(e.mochila || [])]) if (!pendente(x)) tem.set(chave(x), (tem.get(chave(x)) || 0) + 1);
  const falta = new Map();        // base~qualidade → quantos estavam no save anterior e não estão neste
  for (const [k, n] of tinha) if (n > (tem.get(k) || 0)) falta.set(k, n - (tem.get(k) || 0));
  // 1) revelações recentes do servidor que o jogo ainda não aplicou: base → qualidades, na ordem em que foram reveladas
  const guardadas = new Map();
  for (const r of Array.isArray(antes?.avaliados) ? antes.avaliados : []) {
    if (!r || typeof r.b !== 'string' || typeof r.q !== 'string' || !Object.hasOwn(QUALIDADES, r.q) || !Number.isFinite(r.em)) continue;
    if (agora - r.em > AVALIADOS.ms || r.em > agora + 60e3) continue;
    const k = r.b + '~' + r.q;
    if (!((falta.get(k) || 0) > 0)) continue;           // o item revelado está no save: o jogo já aplicou
    falta.set(k, falta.get(k) - 1);
    (guardadas.get(r.b) || guardadas.set(r.b, []).get(r.b)).push(r.q);
  }
  // 2) o resto do que sumiu, por base, da pior qualidade para a melhor
  const sumiram = new Map();
  for (const [k, n] of falta) { const [b, q] = k.split('~'); for (let i = 0; i < n; i++) (sumiram.get(b) || sumiram.set(b, []).get(b)).push(q); }
  for (const l of sumiram.values()) l.sort((a, c) => ORDEM_QUAL.indexOf(a) - ORDEM_QUAL.indexOf(c));
  const revelados = [], novas = [];
  for (const lista of [e.itens || [], e.mochila || []]) for (let k = 0; k < lista.length; k++) {
    if (!pendente(lista[k])) continue;
    const b = baseId(lista[k]), volta = guardadas.get(b)?.shift();
    let q, novo;
    if (volta) { q = volta; novo = false; }
    else {
      const sumiu = sumiram.get(b)?.shift(), sorteio = sortearQualidade(0, rng);
      q = sumiu && ORDEM_QUAL.indexOf(sumiu) < ORDEM_QUAL.indexOf(sorteio) ? sumiu : sorteio;
      novo = q !== sumiu;
    }
    lista[k] = comItem(b, refinoDe(lista[k]), q);
    revelados.push({ base: b, q, novo });
    novas.push({ b, q, em: agora });
  }
  if (novas.length) e.avaliados = novas.slice(-AVALIADOS.max); else delete e.avaliados;
  return revelados;
}
// "Poder": um número para mostrar a força do personagem pelo nível e pelos itens equipados (preço do item × refino × qualidade)
export function poder(estado) {
  let p = (estado.nivel || 1) * 40;
  for (const x of estado.itens || []) { const i = ITENS[baseId(x)]; if (!i) continue; p += (i.preco || 0) * (1 + BONUS_REFINO * refinoDe(x)) * (QUALIDADES[qualidadeDe(x)]?.mult || 1) / 10; }
  return Math.round(p);
}
export function infoItem(x) {
  const i = ITENS[baseId(x)], ref = refinoDe(x), qual = qualidadeDe(x), m = (1 + BONUS_REFINO * ref) * (QUALIDADES[qual]?.mult || 1);
  return { ...i, chave: x, ref, qual, nomeRef: ref ? `${i.nome} +${ref}` : i.nome,
    ad: i.ad * m, ap: (i.ap || 0) * m, mana: (i.mana || 0) * m, vida: i.vida * m, armadura: i.armadura * m, rm: i.rm * m, va: i.va * m, rv: i.rv * m, critico: (i.critico || 0) * m,
    regen: (i.regen || 0) * m, cdr: (i.cdr || 0) * m };
}
export const valorVenda = (x) => Math.floor(ITENS[baseId(x)].preco * 0.5 * (1 + 0.5 * refinoDe(x)) * (QUALIDADES[qualidadeDe(x)]?.venda || 1));
export const precoRefino = (x) => Math.round(ITENS[baseId(x)].preco * (0.5 + 0.5 * refinoDe(x)) * (refinoDe(x) >= 2 ? PRECO_REFINO_ALTO : 1));

// ---------- Poções (vendidas pelo Lojista) ----------
export const POCOES = {
  vida:  { nome: 'Poção de Vida', tipo: 'vida', cura: 300, preco: 40, nivel: 1 },
  vidaF: { nome: 'Poção de Vida Forte', tipo: 'vida', cura: 900, preco: 110, nivel: 15 },
  vidaS: { nome: 'Poção de Vida Suprema', tipo: 'vida', cura: 2200, preco: 260, nivel: 30 },
  mana:  { nome: 'Poção de Mana', tipo: 'mana', cura: 100, preco: 30, nivel: 1 },
  manaF: { nome: 'Poção de Mana Forte', tipo: 'mana', cura: 280, preco: 80, nivel: 15 },
};

// ---------- Monstros ----------
// Todo monstro segue a mesma curva por nível; cada espécie multiplica essa curva.
// ajuste fino por faixa de nível, vindo da planilha balanco.csv (multiplicadores; 1 = como o jogo foi feito)
export const ajuste = (n) => BALANCO.find((f) => n >= f.de && n <= f.ate) || BALANCO[BALANCO.length - 1];
export const CURVA = {
  hp: (n) => (150 + 100 * n + 1.0 * n * n) * ajuste(n).vida,
  ad: (n) => (9 + 4.8 * n + 0.13 * n * n) * ajuste(n).dano,     // ajustado para quem joga com básicos e épicos (ver _raw/sustento.mjs)
  armadura: (n) => 5 + 1.5 * n,
  xp: (n) => (30 + 7 * n) * ajuste(n).xp,
  ouro: (n) => (8 + 3.5 * n) * ajuste(n).ouro,
};
export const MONSTROS = {
  'Tropa Corpo a Corpo':     { hp: 1, ad: 0.9, as: 0.8, armadura: 0.6, xp: 1, ouro: 1 },
  // distancia: os que atacam de longe param a essa distância (em quadrados) e atiram
  'Tropa Mago':              { hp: 0.7, ad: 1.15, as: 0.65, armadura: 0.3, xp: 0.9, ouro: 0.9, magico: true, distancia: 3 },
  'Tropa de Cerco':          { hp: 1.8, ad: 1.5, as: 0.5, armadura: 1.2, xp: 1.6, ouro: 1.8, distancia: 4 },
  'Lobo Gigante':            { hp: 1.1, ad: 1.1, as: 0.8, armadura: 0.8, xp: 1.1, ouro: 1 },
  'Krug Anciã':              { hp: 1.5, ad: 0.8, as: 0.6, armadura: 1.5, xp: 1.2, ouro: 1.2 },
  'Sentinela Azul':          { hp: 2.2, ad: 1.05, as: 0.55, armadura: 1.2, xp: 2, ouro: 2.2, magico: true },
  'Brambleback Vermelho':    { hp: 2.2, ad: 1.5, as: 0.55, armadura: 1.2, xp: 2, ouro: 2.2 },
  'Arraia do Rio':           { hp: 1.5, ad: 0.8, as: 0.5, armadura: 1.6, xp: 1.2, ouro: 1.1 },
  'Larva do Vazio':          { hp: 1.1, ad: 1.05, as: 0.8, armadura: 1, xp: 1.1, ouro: 1, magico: true },
  'Cria de Vilemaw':         { hp: 0.6, ad: 0.8, as: 1, armadura: 0.7, xp: 0.3, ouro: 0.2 },      // nasce dos ovos da Vilemaw (chefe global)
  'Dragão Ancião (filhote)': { hp: 1.6, ad: 1.3, as: 0.6, armadura: 1.2, xp: 1.5, ouro: 1.4 },
  'Criatura do Vazio':       { hp: 1.3, ad: 1.3, as: 0.7, armadura: 1, xp: 1.4, ouro: 1.3, magico: true },
  // chefes: aparecem raramente; o saque deles está em DROP_CHEFE
  'Arauto do Vale':          { hp: 10, ad: 2.5, as: 0.6, armadura: 1.5, xp: 12, ouro: 12, chefe: true },
  'Dragão Infernal':         { hp: 12, ad: 3, as: 0.55, armadura: 1.6, xp: 14, ouro: 14, chefe: true, magico: true },
  'Barão Nashor':            { hp: 16, ad: 3.2, as: 0.5, armadura: 1.8, xp: 20, ouro: 20, chefe: true, magico: true },
};

// ---------- Espólios ----------
// Partes dos monstros (como no Tibia): não servem para equipar, só para vender no Lojista. Ficam numa bolsa à parte,
// empilhados (estado.espolios = { id: quantidade }). O valor acompanha o ouro dos monstros do lugar de onde vêm:
// na média, os espólios rendem uns 30% a mais de ouro por abate.
const valorEsp = (nivelRef, mult = 1) => Math.round(0.6 * CURVA.ouro(nivelRef) * mult);
export const ESPOLIOS = {
  'escudo-quebrado':    { nome: 'Escudo Quebrado', valor: valorEsp(5), cor: '#8aa4d8' },
  'po-arcano':          { nome: 'Pó Arcano', valor: valorEsp(5), cor: '#b8a8ff' },
  'engrenagem':         { nome: 'Engrenagem de Cerco', valor: valorEsp(9), cor: '#a8a8b0' },
  'pele-lobo':          { nome: 'Pele de Lobo', valor: valorEsp(14), cor: '#9a9aa8' },
  'presa-lobo':         { nome: 'Presa de Lobo', valor: valorEsp(14, 3), cor: '#f0ead8' },
  'pedra-krug':         { nome: 'Pedra de Krug', valor: valorEsp(19), cor: '#9a8460' },
  'cristal-azul':       { nome: 'Cristal Azul', valor: valorEsp(19, 1.3), cor: '#6ee0ff' },
  'espinho':            { nome: 'Espinho de Brambleback', valor: valorEsp(24, 1.3), cor: '#ff7a3a' },
  'escama-arraia':      { nome: 'Escama de Arraia', valor: valorEsp(29), cor: '#5ac8c0' },
  'quitina':            { nome: 'Quitina do Vazio', valor: valorEsp(29), cor: '#c070ff' },
  'escama-dragao':      { nome: 'Escama de Dragão', valor: valorEsp(34), cor: '#8a9ac8' },
  'garra-dragao':       { nome: 'Garra de Dragão', valor: valorEsp(34, 3), cor: '#ffe0a0' },
  'olho-vazio':         { nome: 'Olho do Vazio', valor: valorEsp(44), cor: '#ff5af0' },
  'chifre-arauto':      { nome: 'Chifre do Arauto', valor: valorEsp(35, 25), cor: '#d88aff' },
  'coracao-dragao':     { nome: 'Coração de Dragão', valor: valorEsp(40, 25), cor: '#ff6a2a' },
  'presa-barao':        { nome: 'Presa do Barão', valor: valorEsp(50, 25), cor: '#c8a0ff' },
  // só do Baú da Vilemaw (chefe global)
  'seda-vilemaw':       { nome: 'Seda de Vilemaw', valor: valorEsp(45, 4), cor: '#d8d0ff' },
  'presa-vilemaw':      { nome: 'Presa de Vilemaw', valor: valorEsp(50, 30), cor: '#7affe8' },
  // a Dungeon do Braum (p675): só vêm do prêmio da dungeon
  'pele-yeti':          { nome: 'Pele de Yeti', valor: valorEsp(45, 20.14), cor: '#e8f4ff' },      // ~2.000, abaixo da Presa do Barão (p684)
  'presa-gelo':         { nome: 'Presa do Lobo do Gelo', valor: valorEsp(45, 25.18), cor: '#bfe8ff' },      // ~2.500 (p684)
  'bigode-braum':       { nome: 'Mecha do Bigode do Braum', valor: valorEsp(50, 683.06), cor: '#c8a070' },      // ~75 mil (p686)
};
// o que cada monstro pode deixar: [espólio, chance] (cada um é sorteado à parte; à noite, os noturnos sorteiam duas vezes)
export const ESPOLIO_MONSTRO = {
  'Tropa Corpo a Corpo': [['escudo-quebrado', 0.3]], 'Tropa Mago': [['po-arcano', 0.3]], 'Tropa de Cerco': [['engrenagem', 0.35]],
  'Lobo Gigante': [['pele-lobo', 0.3], ['presa-lobo', 0.06]], 'Krug Anciã': [['pedra-krug', 0.3]], 'Sentinela Azul': [['cristal-azul', 0.35]],
  'Brambleback Vermelho': [['espinho', 0.35]], 'Arraia do Rio': [['escama-arraia', 0.3]], 'Larva do Vazio': [['quitina', 0.3]],
  'Dragão Ancião (filhote)': [['escama-dragao', 0.3], ['garra-dragao', 0.06]], 'Criatura do Vazio': [['olho-vazio', 0.3]],
  'Arauto do Vale': [['chifre-arauto', 1]], 'Dragão Infernal': [['coracao-dragao', 1]], 'Barão Nashor': [['presa-barao', 1]],
};
export function sortearEspolios(nome, mult = 1) {
  const r = [];
  for (const [id, ch] of ESPOLIO_MONSTRO[nome] || []) if (Math.random() < Math.min(1, ch * mult)) r.push(id);
  return r;
}
// os espólios ocupam a mochila em pilhas: cada pilha é um espaço. Até 1.000 por pilha desde 10/10/2026 (pedido de
// jogador; eram 100 e a mochila lotava em meia hora de caça)
export const PILHA = 1000;
// teto da velocidade de ataque: 3,0 desde 10/10/2026 (pedido do dono; era 2,5, o do LoL). Medido com o build todo de
// velocidade de ataque (+4/+5): XP/min +0,5% no Ezreal 31, +19% no Ezreal 45 e +13% no Yasuo 45 (<scratch>/hud/sim-as.mjs)
export const VEL_ATAQUE_MAX = 3;
export const espacosEspolios = (e) => Object.values(e.espolios || {}).reduce((s2, q) => s2 + Math.ceil(q / PILHA), 0);
export const espacosLivres = (e) => mochilaDe(e.nivel) - e.mochila.length - espacosEspolios(e);
export const mochilaCheia = (e) => espacosLivres(e) <= 0;
// cabe mais um deste espólio? (numa pilha que ainda não encheu, ou num espaço livre)
const cabeEspolio = (e, id) => ((e.espolios?.[id] || 0) % PILHA !== 0) || espacosLivres(e) > 0;
export const valorEspolios = (estado) => Object.entries(estado.espolios || {}).reduce((s2, [id, q]) => s2 + (ESPOLIOS[id]?.valor || 0) * q, 0);

// ---------- Locais do mapa ----------
// faixa: nível ideal do jogador · nm: nível dos monstros · pos: posição no mapa do LoL (0–1, base azul embaixo à esquerda)
export const LOCAIS = [
  { id: 'fonte', nome: 'Fonte', base: true, bioma: 'base', pos: [0.09, 0.91],
    descricao: 'A base dos invocadores. Aqui você se cura com a Soraka, vende o que caçou para o Lojista e leva seus itens para o Ornn.' },
  { id: 'rota-inf', nome: 'Rota Inferior', faixa: [1, 10], nm: [1, 6], tier: 0, bioma: 'rota', semente: 1, pos: [0.52, 0.93], icone: 'minionmapcircle',
    monstros: [['Tropa Corpo a Corpo', 3], ['Tropa Mago', 2]], descricao: 'Tropas fracas, que caem em poucos golpes. É por aqui que todo mundo começa.' },
  { id: 'rota-sup', nome: 'Rota Superior', faixa: [5, 15], nm: [5, 13], tier: 1, bioma: 'rota', semente: 2, pos: [0.07, 0.45], icone: 'minionmapcircle',
    monstros: [['Tropa Corpo a Corpo', 3], ['Tropa Mago', 2], ['Tropa de Cerco', 1]], descricao: 'As tropas daqui vêm acompanhadas da tropa de cerco, que bate mais forte, mas também rende mais ouro.' },
  { id: 'lobos', nome: 'Toca dos Lobos', faixa: [10, 20], nm: [10, 18], tier: 2, bioma: 'selva', semente: 1, pos: [0.27, 0.56], icone: 'camp',
    monstros: [['Lobo Gigante', 1]], descricao: 'Os lobos andam em matilha e atacam juntos. A pele e a presa deles vendem bem no Lojista.' },
  { id: 'azul', nome: 'Campo Azul', faixa: [15, 25], nm: [15, 23], tier: 3, bioma: 'selva', semente: 2, pos: [0.24, 0.42], icone: 'blue',
    monstros: [['Krug Anciã', 2], ['Sentinela Azul', 1]], descricao: 'Clareira dos Krugs de pedra e da Sentinela Azul, o guardião do cristal azul.' },
  { id: 'vermelho', nome: 'Campo Vermelho', faixa: [20, 30], nm: [20, 28], tier: 4, bioma: 'selva', semente: 3, pos: [0.53, 0.74], icone: 'red',
    monstros: [['Brambleback Vermelho', 1], ['Lobo Gigante', 1], ['Krug Anciã', 1]], descricao: 'Território do Brambleback, que queima quem chega perto. Os espinhos dele valem um bom ouro.' },
  { id: 'rio', nome: 'Rio', faixa: [25, 35], nm: [25, 33], tier: 5, bioma: 'rio', semente: 1, pos: [0.45, 0.45], icone: 'riftherald',
    monstros: [['Arraia do Rio', 2], ['Larva do Vazio', 2]], chefe: ['Arauto do Vale', 0.015], descricao: 'Arraias e larvas do Vazio vivem na beira do rio, e de vez em quando o Arauto do Vale aparece.' },
  { id: 'dragao', nome: 'Fosso do Dragão', faixa: [30, 40], nm: [30, 38], tier: 6, bioma: 'rio', semente: 2, pos: [0.67, 0.7], icone: 'dragon_infernal',
    monstros: [['Dragão Ancião (filhote)', 2], ['Larva do Vazio', 1]], chefe: ['Dragão Infernal', 0.015], descricao: 'Os filhotes de dragão guardam o ninho, e às vezes o Dragão Infernal vem defendê-los.' },
  { id: 'barao', nome: 'Covil do Barão', faixa: [40, 50], nm: [40, 48], tier: 7, bioma: 'barao', semente: 1, pos: [0.33, 0.29], icone: 'baron',
    monstros: [['Criatura do Vazio', 2], ['Dragão Ancião (filhote)', 1]], chefe: ['Barão Nashor', 0.015], descricao: 'A região mais perigosa do mapa, tomada pelas criaturas do Vazio. É onde o Barão Nashor espera.' },
  // Runeterra: o mundo aberto, no controle (js/runeterra.js). O id continua 'arena' por causa dos saves.
  { id: 'arena', nome: 'Runeterra', arena: true, bioma: 'mundo', semente: 1, pos: [0.77, 0.42], icone: 'atakhan_r',
    descricao: 'O mundo aberto, onde você controla o campeão e vai andando pelas zonas de caça, cada uma com monstros de uma faixa de nível. Para descansar, passe numa cidade.' },
  // a Arena (12/10/2026): PvP 1 contra 1 numa ponte (js/arena-pvp.js), com o motor de Runeterra e sem monstros
  { id: 'aram', nome: 'Arena', arena: true, aram: true, bioma: 'abismo', semente: 1,
    descricao: 'A ponte da Arena, onde os jogadores se enfrentam 1 contra 1. Morrer aqui não custa XP nem itens.' },
];
export const LOCAL = Object.fromEntries(LOCAIS.map((l) => [l.id, l]));
// o que cai em cada lugar: componentes (básicos), intermediários (épicos) e alguns lendários;
// o resto dos lendários se monta no Ornn juntando os componentes
const DROPS = {
  'rota-inf': { basico: ['1036', '1028', '1042', '1029', '2022', '1001', '1054'], epico: ['3077', '3144', '3047', '3140'], lendario: ['6631', '3078', '3174'] },
  'rota-sup': { basico: ['1036', '1028', '1033', '1006', '1018', '1120'], epico: ['3044', '3057', '1053', '3133', '3006'], lendario: ['3078', '3074', '3172'] },
  lobos: { basico: ['1042', '1037', '1018', '1029', '1001'], epico: ['3051', '3086', '1043', '2019', '3009', '3105'], lendario: ['3046', '6333', '3170'] },
  azul: { basico: ['1033', '1006', '2022', '1028', '1120'], epico: ['3067', '3211', '3066', '1011', '3111', '3801'], lendario: ['3065', '3071', '8020', '3190', '3174'] },
  vermelho: { basico: ['1036', '1037', '1038', '1028', '1054'], epico: ['2021', '3077', '3035', '6670', '3008'], lendario: ['3748', '2501', '3072', '3168'] },
  rio: { basico: ['1042', '1018', '1038', '1001'], epico: ['3086', '6670', '3144', '1043', '3158', '3024'], lendario: ['3085', '3153', '3036', '3156', '3173'] },
  dragao: { basico: ['1037', '1038', '1029', '1028', '1120'], epico: ['1031', '3076', '2019', '3133', '3047', '3140'], lendario: ['3075', '3742', '6610', '3068', '3143', '663056', '3172'] },
  barao: { basico: ['1038', '1037', '1018', '1054'], epico: ['3035', '6670', '3133', '1011', '3006', '3111'], lendario: ['3031', '3026', '3053', '6673', '3083', '3168'] },
};
// 09/10/2026: o Campo Azul, o Dragão e o Barão (e o Vermelho para mago) ganharam uma bota lendária no saque: sem ela, quem passava
// do nível 30 só conseguia bota lendária voltando para zona baixa ou montando no Ornn
// saque das mesmas zonas para os campeões de magia (itens de mago e os de defesa)
// 13/10/2026 (p614): Lobos, Selva Rubra e Rio ganharam um lendário de tanque (Solari, Randuin, Máscara Abissal) para o Zac e o Taric
const DROPS_AP = {
  'rota-inf': { basico: ['1052', '1027', '1028', '1029', '2022', '1001', '1056'], epico: ['3916', '3108', '3020', '3140'], lendario: ['6655', '3116', '3174'] },
  'rota-sup': { basico: ['1052', '1027', '1028', '1033', '1006', '1120', '1054'], epico: ['3802', '3113', '3145', '3158'], lendario: ['3116', '3003', '3171'] },
  lobos: { basico: ['1052', '3070', '1029', '1028', '1001'], epico: ['3108', '4630', '3147', '2508', '3009', '3105'], lendario: ['3100', '6653', '3170', '3190'] },
  azul: { basico: ['1033', '1006', '2022', '1028', '1027', '1056'], epico: ['3802', '3067', '3113', '1011', '3111', '3801'], lendario: ['3003', '3165', '3065', '8020', '3190', '3171'] },
  vermelho: { basico: ['1026', '1052', '1028', '1120'], epico: ['2508', '3145', '2420', '3147', '3020'], lendario: ['4645', '6653', '3102', '3152', '3175', '3143'] },
  rio: { basico: ['1026', '1052', '3070', '1001'], epico: ['4630', '3916', '4632', '3113', '3158', '3024'], lendario: ['3135', '4629', '3157', '3175', '3173', '8020'] },
  dragao: { basico: ['1026', '1058', '1029', '1028', '1120'], epico: ['2420', '3145', '4632', '3108', '3047', '3140'], lendario: ['3157', '4645', '3075', '3068', '664644', '3175'] },
  barao: { basico: ['1058', '1026', '1052', '1054'], epico: ['4630', '3802', '2420', '1011', '3020', '3111'], lendario: ['3089', '3135', '3157', '4633', '3083', '3171'] },
};
for (const l of LOCAIS) { if (DROPS[l.id]) l.drops = DROPS[l.id]; if (DROPS_AP[l.id]) l.dropsAp = DROPS_AP[l.id]; }
for (const i of ITENS_DADOS) { const cl = classeItem(i.id); if (cl !== 'ap') POR_CLASSE.ad[raridade(i)].push(i.id); if (cl !== 'ad') POR_CLASSE.ap[raridade(i)].push(i.id); }

// ---------- Runeterra ----------
// bonus: XP e chance de drop a mais por jogar no controle; ocioso: segundos sem mexer até o campeão parar
export const ARENA = { bonus: 1.3, ocioso: 30 };
// os monstros e o saque vêm do lugar de caça do nível do jogador (o mais alto cuja faixa ele já alcançou)
export const localDaArena = (nivel) => [...LOCAIS].reverse().find((l) => l.faixa && nivel >= l.faixa[0]) || LOCAIS.find((l) => l.faixa);
// o motor de Runeterra (js/arena.js) se registra aqui; sem ele (no servidor) o campeão só fica parado
let motorArena = null;
export const registrarArena = (f) => { motorArena = f; };

// ---------- XP e níveis ----------
// monstros mais de 5 níveis abaixo do Darius dão menos XP (−10% por nível, mínimo 10%)
export const fatorXp = (nivelDarius, nivelMonstro) => { const dif = nivelDarius - nivelMonstro; return dif > 5 ? Math.max(0.1, 1 - 0.1 * (dif - 5)) : 1; };
// o saque (itens, ouro, runas e espólios) segue a mesma regra da XP: monstro mais de 5 níveis abaixo rende menos
// (09/10/2026: um nível 45 farmava lendário e ouro na Rota Inferior, 10x mais rápido que no Barão)
export const fatorSaque = fatorXp;
// XP de cada nível = ritmo típico daquele nível (XP/h medido por _raw/ritmo.mjs) × horas desejadas, que crescem 17,15% por nível:
// ~27 min no nível 1, ~10 h até o 11 e ~6.000 h de jogo até o 50 (de meses a mais de um ano). Arredondado em 3 algarismos.
const RITMO_XP = (n) => 43000 + 4345 * (n - 1) + 17.9 * (n - 1) ** 2;
const tres = (v) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 2); return Math.round(v / p) * p; };
export const xpParaNivel = (n) => tres(RITMO_XP(n) * 0.4433 * 1.1715 ** (n - 1) * ajuste(n).xpUpar);
export const perdaPorMorte = (estado) => Math.round(xpParaNivel(estado.nivel) * 0.1);

// ---------- Atributos do Darius ----------
// até o 18 segue a curva do LoL; depois disso cresce linearmente
const crescimento = (nivel) => {
  const n = Math.min(nivel, 18);
  return (n - 1) * (0.7025 + 0.0175 * (n - 1)) + Math.max(0, nivel - 18);
};
// ---------- Pontos de atributo (3 por nível) ----------
// para que serve, o que cada ponto dá e quanto o total dá agora (v = pontos colocados)
const num1 = (x) => (Math.round(x * 10) / 10).toLocaleString(ingles ? 'en-US' : 'pt-BR');
export const ATRIBUTOS = {
  forca: { curto: '+1,2 dano', nome: 'Força', serve: 'Mais dano em todos os ataques e habilidades.', efeito: '+1,2 de dano de ataque',
    total: (v) => t('+{v} de dano', { v: num1(1.2 * v) }) },
  vitalidade: { curto: '+20 vida', nome: 'Vitalidade', serve: 'Mais vida: aguenta mais tempo sem poção.', efeito: '+20 de vida máxima e +0,1 de regeneração de vida por segundo',
    total: (v) => t('+{v} de vida, +{r} de regeneração/s', { v: 20 * v, r: num1(0.1 * v) }) },
  resistencia: { curto: '+1,5 armadura, +1 res. mágica', nome: 'Resistência', serve: 'Toma menos dano dos golpes físicos e mágicos.', efeito: '+1,5 de armadura e +1 de resistência mágica',
    total: (v) => t('+{a} de armadura, +{r} de res. mágica', { a: num1(1.5 * v), r: v }) },
  agilidade: { curto: '+0,8% vel. ataque, +0,25% esquiva', nome: 'Agilidade', serve: 'Ataca mais rápido e às vezes desvia dos golpes.', efeito: '+0,8% de velocidade de ataque e +0,25% de esquiva (máx. 25%)',
    total: (v) => t('+{v}% de vel. de ataque, +{e}% de esquiva', { v: num1(0.8 * v), e: num1(Math.min(25, 0.25 * v)) }) },
  foco: { curto: '+8 mana, −0,4% recarga', nome: 'Foco', serve: 'Mais mana e habilidades voltando mais rápido.', efeito: '+8 de mana, +0,06 de regeneração de mana e −0,4% de recarga (máx. 30%)',
    total: (v) => t('+{m} de mana, −{r}% de recarga', { m: 8 * v, r: num1(Math.min(30, 0.4 * v)) }) },
};
// nos campeões de magia, a Força dá Poder de Habilidade
export const FORCA_MAGO = { curto: '+2 poder', nome: 'Força', serve: 'Mais Poder de Habilidade: as magias causam mais dano.', efeito: '+2 de Poder de Habilidade',
  total: (v) => t('+{v} de Poder de Habilidade', { v: 2 * v }) };
// quem não usa mana (Yasuo e Katarina): a parte da mana do Foco vira algo do campeão (pedido de jogador: para eles o Foco só dava recarga)
export const FOCO_DANO_HAB = 0.002, FOCO_FLUXO = 0.01;
export const FOCO_SEM_MANA = {
  katarina: { curto: '−0,4% recarga, +0,2% dano das habilidades', nome: 'Foco', serve: 'Habilidades voltando mais rápido e cortando mais (também o giro das adagas).',
    efeito: '−0,4% de recarga (máx. 30%) e +0,2% de dano das habilidades e do giro das adagas',
    total: (v) => t('−{r}% de recarga, +{d}% de dano das habilidades', { r: num1(Math.min(30, 0.4 * v)), d: num1(100 * FOCO_DANO_HAB * v) }) },
  zac: { curto: '−0,4% recarga, +0,2% dano das habilidades', nome: 'Foco', serve: 'Habilidades voltando mais rápido e batendo um pouco mais (o Zac paga as habilidades com vida, não com mana).',
    efeito: '−0,4% de recarga (máx. 30%) e +0,2% de dano das habilidades',
    total: (v) => t('−{r}% de recarga, +{d}% de dano das habilidades', { r: num1(Math.min(30, 0.4 * v)), d: num1(100 * FOCO_DANO_HAB * v) }) },
  yasuo: { curto: '−0,4% recarga, +1% Fluxo', nome: 'Foco', serve: 'Habilidades voltando mais rápido e o Fluxo enchendo mais rápido (o escudo de vento vem mais vezes).',
    efeito: '−0,4% de recarga (máx. 30%) e +1% de Fluxo ganho',
    total: (v) => t('−{r}% de recarga, +{f}% de Fluxo', { r: num1(Math.min(30, 0.4 * v)), f: Math.round(100 * FOCO_FLUXO * v) }) },
};
export const atributosDe = (estado) => {
  const k = kit(estado);
  return { ...ATRIBUTOS, ...(k.magia ? { forca: FORCA_MAGO } : {}), ...(FOCO_SEM_MANA[k.id] ? { foco: FOCO_SEM_MANA[k.id] } : {}) };
};
// sugestão de build por campeão (aparece na aba Atributos)
export const DICA_ATRIBUTOS = {
  darius: 'Darius luta colado nos monstros: Força e Vitalidade são a base; Resistência ajuda nos lugares difíceis.',
  ezreal: 'Ezreal é frágil e ataca de longe: Força e Agilidade dão dano; um pouco de Vitalidade evita que ele morra quando é alcançado.',
  lux: 'Lux é maga: a Força vira Poder de Habilidade e faz as magias baterem mais; Foco dá mana e recarga menor; Vitalidade evita que ela morra quando é alcançada.',
  katarina: 'Katarina é uma assassina de magia: a Força vira Poder de Habilidade e faz as adagas cortarem mais; Vitalidade segura ela colada nos monstros; Agilidade acelera os ataques. Ela não usa mana: o Foco dá recarga e mais dano nas habilidades e nas adagas.',
  zac: 'Zac é um tanque de magia que paga as habilidades com vida: Vitalidade é a base (mais vida deixa os golpes dele mais fortes e as gosmas curam mais); a Força vira Poder de Habilidade; Resistência segura o grupo em volta; Foco dá recarga e um pouco mais de dano.',
  taric: 'Taric é um tanque de magia: a Força vira Poder de Habilidade e deixa as curas, os escudos e o dano mais fortes; Vitalidade e Resistência seguram tudo (a armadura bônus também aumenta o dano da Bravata); Foco dá mana e recarga menor, e cada habilidade carrega a Bravata.',
  yasuo: 'Yasuo luta colado e vive do crítico: Força e Agilidade dão dano e velocidade de ataque (que também acelera a Tempestade de Aço); Vitalidade segura os golpes até o escudo do Fluxo encher.',
};
export const PONTOS_POR_NIVEL = 3;
export const MODELOS = {
  tanque:      { nome: 'Tanque', pesos: { vitalidade: 2, resistencia: 2, forca: 1 } },
  equilibrado: { nome: 'Equilibrado', pesos: { forca: 2, vitalidade: 2, resistencia: 1, agilidade: 1, foco: 1 } },
  dano:        { nome: 'Dano', pesos: { forca: 3, agilidade: 2, vitalidade: 1 } },
  conjurador:  { nome: 'Habilidades', pesos: { foco: 2, forca: 2, vitalidade: 1 } },
};
const atribVazio = () => ({ forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0 });

export function atributos(estado) {
  const k = kit(estado), b = k.stats;
  const g = crescimento(estado.nivel);
  let ad = k.adBase + k.adNivel * g, vida = b.hp + b.hpperlevel * g, armadura = b.armor + b.armorperlevel * g;
  let rm = b.spellblock + 3.5 * g, va = 0, rv = 0;
  const baseAd = ad, baseVida = vida, baseArmadura = armadura;
  const at = { ...atribVazio(), ...estado.atrib };
  let critico = 0, danoCritico = 1.75, regenItens = 0, cdrItens = 0, ap = 0, manaItens = 0;
  // efeitos dos lendários dos espaços (% do total, esquiva e penetração mágica)
  const pct = { adPct: 0, apPct: 0, vidaPct: 0, armPct: 0, rmPct: 0, esquiva: 0, penMag: 0 };
  // Força: dano de ataque; nos campeões de magia vira Poder de Habilidade
  if (k.magia) ap += 2 * at.forca; else ad += 1.2 * at.forca; vida += 20 * at.vitalidade; armadura += 1.5 * at.resistencia; rm += 1 * at.resistencia; va += 0.008 * at.agilidade;
  for (const id of estado.itens) {
    if (!ITENS[baseId(id)]) continue;
    const i = infoItem(id);
    ad += i.ad; ap += i.ap; manaItens += i.mana; vida += i.vida; armadura += i.armadura; rm += i.rm; va += i.va; rv += i.rv; critico += i.critico;
    regenItens += i.regen; cdrItens += i.cdr;
    for (const p in pct) pct[p] += i[p] || 0;
  }
  vida *= 1 + pct.vidaPct;
  const wArm = k.hab.W?.armPassiva && estado.ranks?.W ? k.hab.W.armPassiva[estado.ranks.W - 1] : 0;      // Bastião (Taric): armadura passiva
  const tem = (id) => estado.itens.some((x) => baseId(x) === id);
  if (tem('2501')) ad += 0.02 * (vida - baseVida);
  if (tem('3031')) danoCritico += 0.4;                     // Gume do Infinito
  const penE = k.hab.E.pen && estado.ranks.E ? k.hab.E.pen[estado.ranks.E - 1] : 0;
  const bc = bonusConquistas(estado), bm = bonusMascote(estado);
  // Yasuo: o Fluxo ocupa o lugar da mana (sempre 100; enche lutando e andando, ver encherFluxo)
  // Katarina: não usa recurso nenhum (mana 0)
  const manaMax = k.fluxo ? FLUXO_MAX : k.semMana ? 0 : b.mp + b.mpperlevel * g + 8 * at.foco + manaItens;
  if (tem('3003')) ap += 0.03 * manaMax;                    // Cajado do Arcanjo: 3% da mana vira poder
  if (tem('3089')) ap *= 1.35;                              // Rabadon: +35% do poder total
  ad *= 1 + pct.adPct; ap *= 1 + pct.apPct; armadura *= 1 + pct.armPct + wArm; rm *= 1 + pct.rmPct;
  ad *= 1 + bc.ad; ap *= 1 + bc.ad; vida *= 1 + bc.vida; armadura *= 1 + bc.armadura + bm.armadura; rm *= 1 + bc.rm + bm.rm;
  return {
    ouroMult: 1 + bc.ouro + bm.ouro,
    ad, baseAd, bonusAd: ad - baseAd, vida, bonusVida: vida - baseVida,
    armadura, bonusArmadura: armadura - baseArmadura, rm,
    ap, penMagica: Math.min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag),     // Cajado do Vazio: 40%; botas de mago somam
    mana: manaMax,
    danoHab: k.semMana ? FOCO_DANO_HAB * at.foco : 0,          // Foco da Katarina
    fluxoMult: k.fluxo ? 1 + FOCO_FLUXO * at.foco : 1,          // Foco do Yasuo
    regenMana: k.fluxo || k.semMana ? 0 : ((b.mpregen + b.mpregenperlevel * g) / 5) * 3 + 0.06 * at.foco,
    velAtaque: Math.min(VEL_ATAQUE_MAX, b.attackspeed * (1 + (b.attackspeedperlevel / 100) * g + va)),
    regen: (b.hpregen + b.hpregenperlevel * g) / 5 + 0.1 * at.vitalidade + regenItens,
    esquiva: Math.min(0.25, 0.0025 * at.agilidade + pct.esquiva),
    reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens),
    rouboVida: rv,
    penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1),   // Apreender e Lembranças do Lorde Dominik (30%)
    // Estilo do Errante (Yasuo): a chance de crítico dobra e o crítico causa um pouco menos
    critico: Math.min(1, (critico + (k.hab.P?.critBase?.(estado.nivel) || 0)) * (k.hab.P?.critMult || 1)), danoCritico: danoCritico * (k.hab.P?.critDano || 1),
    tem,
  };
}

// ---------- Habilidades (valores do jogo, adaptados ao idle) ----------
// Q/W/E/R vêm do LoL; as outras foram criadas para o MMORPG e liberam conforme o nível.
const H = DADOS.habilidades;
// série com n valores: começa em ini e anda passo a cada rank
const serie = (ini, passo, n = 10) => Array.from({ length: n }, (_, i) => +(ini + passo * i).toFixed(4));
// Cada habilidade vai até o rank 10 (as ultimates até o 5). São 110 ranks no total e só 50 pontos
// (1 por nível), então a build depende de quais habilidades você escolhe fortalecer.
const HAB_DARIUS = {
  Q: { nome: H.Q.nome, nivel: 1, max: 10, recarga: serie(9, -0.5), custo: serie(20, 2), base: serie(50, 30), ratio: serie(1, 0.05),
    dano: (r, a) => HAB_DARIUS.Q.base[r - 1] + HAB_DARIUS.Q.ratio[r - 1] * a.ad,
    desc: 'Gira o machado, acertando todos os inimigos encostados. Cura por inimigo atingido.' },
  W: { nome: H.W.nome, nivel: 1, max: 10, recarga: [5, 5, 4.8, 4.6, 4.4, 4.2, 4, 3.8, 3.6, 3.4], custo: [20, 20, 22, 22, 24, 24, 26, 26, 28, 30], mult: serie(1.4, 0.05),
    dano: (r, a) => HAB_DARIUS.W.mult[r - 1] * a.ad,
    desc: 'O próximo ataque causa dano extra e deixa o alvo lento.' },
  E: { nome: H.E.nome, nivel: 1, max: 10, recarga: [26, 24, 22, 20.5, 19, 17.5, 16, 15, 14, 13], custo: serie(45, 0), pen: [0.2, 0.23, 0.26, 0.29, 0.32, 0.35, 0.38, 0.41, 0.43, 0.45],
    desc: 'Puxa os inimigos que estão chegando e deixa todos lentos. Dá penetração de armadura (passiva).' },
  R: { nome: H.R.nome, nivel: 6, max: 5, recarga: [120, 100, 80, 65, 50], custo: [100, 50, 0, 0, 0], base: serie(125, 125, 5),
    dano: (r, a, acumulos) => (HAB_DARIUS.R.base[r - 1] + 0.75 * a.bonusAd) * (1 + 0.2 * acumulos),
    desc: 'Executa o alvo com dano verdadeiro, maior por acúmulo de Hemorragia. Ao matar, volta em 2 segundos (em Runeterra, quase na hora), também nos chefes.' },
  G: { nome: 'Grito de Guerra', nivel: 8, max: 10, recarga: serie(25, -1), custo: serie(40, 2), bonus: serie(0.15, 0.03), duracao: 8,
    desc: 'Grito de batalha: aumenta todo o dano causado por 8 segundos.' },
  A: { nome: 'Avanço Noxiano', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: serie(35, 2), base: serie(60, 30), ratio: serie(0.8, 0.05),
    dano: (r, a) => HAB_DARIUS.A.base[r - 1] + HAB_DARIUS.A.ratio[r - 1] * a.ad,
    desc: 'Investe contra o inimigo mais distante, causando dano e atordoando por 1 segundo.' },
  D: { nome: 'Disciplina da Legião', nivel: 18, max: 10, passiva: true, acumulos: serie(2, 2),
    desc: 'Passiva: cada abate sem voltar à base dá +1% de armadura e de dano, até um limite que cresce com o rank.' },
  F: { nome: 'Fúria Sanguinária', nivel: 23, max: 10, recarga: serie(22, -0.5), custo: serie(0, 0), custoVida: 0.06, roubo: serie(0.12, 0.03), duracao: 6,
    desc: 'Sacrifica 6% da vida atual: por 6 segundos, parte de todo dano causado cura o Darius.' },
  T: { nome: 'Pisotear', nivel: 28, max: 10, recarga: serie(10, -0.4), custo: serie(40, 4), base: serie(70, 35), ratio: serie(0.9, 0.04),
    dano: (r, a) => HAB_DARIUS.T.base[r - 1] + HAB_DARIUS.T.ratio[r - 1] * a.ad,
    desc: 'Golpeia o chão: dano em todos os inimigos encostados e lentidão por 2 segundos.' },
  B: { nome: 'Estandarte de Noxus', nivel: 33, max: 10, recarga: serie(35, -1.5), custo: serie(60, 2), cura: serie(0.01, 0.0015), duracao: 10,
    desc: 'Finca o estandarte: por 10 segundos regenera vida (% da máxima) e 2% da mana por segundo.' },
  M: { nome: 'Machado de Draven', nivel: 38, max: 10, recarga: serie(7, -0.3), custo: serie(30, 3), base: serie(30, 30), ratio: serie(0.6, 0.04),
    dano: (r, a) => HAB_DARIUS.M.base[r - 1] + HAB_DARIUS.M.ratio[r - 1] * a.ad,
    desc: 'Arremessa um machado giratório que acerta o alvo na ida e na volta.' },
  N: { nome: 'Mão de Noxus', nivel: 45, max: 5, recarga: [60, 52, 45, 40, 35], custo: serie(100, 0, 5), limiar: serie(0.2, 0.03, 5), chefe: serie(300, 200, 5),
    danoChefe: (r, a) => HAB_DARIUS.N.chefe[r - 1] + a.bonusAd,
    desc: 'Executa todos os inimigos comuns com pouca vida. Em chefes, causa dano verdadeiro.' },
};
// Ezreal: atirador. Q/W/E/R e a passiva seguem o LoL; as extras são próprias (a manopla shurimane e o tiro de longe).
const HE = DADOS_EZREAL.habilidades;
const HAB_EZREAL = {
  Q: { nome: HE.Q.nome, nivel: 1, max: 10, recarga: serie(3.6, -0.2), custo: serie(22, 1.5), base: serie(40, 32), ratio: serie(1.3, 0.06), reduz: 1.5,
    dano: (r, a) => HAB_EZREAL.Q.base[r - 1] + HAB_EZREAL.Q.ratio[r - 1] * a.ad,
    desc: 'Dispara energia no monstro mais próximo. Se acertar, reduz em 1,5s a recarga das outras habilidades.' },
  W: { nome: HE.W.nome, nivel: 1, max: 10, recarga: serie(8, -0.3), custo: serie(50, 2), base: serie(80, 35), ratio: serie(0.6, 0.05), devolveMana: serie(40, 6),
    dano: (r, a) => HAB_EZREAL.W.base[r - 1] + HAB_EZREAL.W.ratio[r - 1] * a.ad,
    desc: 'Prende um orbe no alvo. O próximo ataque ou habilidade que acertá-lo detona o orbe: dano extra e devolve mana.' },
  E: { nome: HE.E.nome, nivel: 1, max: 10, recarga: [26, 24, 22, 20, 18.5, 17, 15.5, 14.5, 13.5, 12.5], custo: serie(70, 0), base: serie(80, 30), ratio: serie(0.5, 0.05), afasta: serie(1.6, 0.08),
    dano: (r, a) => HAB_EZREAL.E.base[r - 1] + HAB_EZREAL.E.ratio[r - 1] * a.ad,
    desc: 'Teletransporta-se para longe quando cercado: os monstros precisam caminhar até ele de novo. Dispara um raio teleguiado no mais próximo.' },
  R: { nome: HE.R.nome, nivel: 6, max: 5, recarga: [120, 105, 90, 75, 60], custo: serie(100, 0, 5), base: serie(300, 150, 5), ratio: serie(1, 0.1, 5),
    dano: (r, a) => HAB_EZREAL.R.base[r - 1] + HAB_EZREAL.R.ratio[r - 1] * a.ad,
    desc: 'Carrega a luva por 1 segundo, parado, e dispara uma enorme onda de energia que atravessa todos os monstros do grupo, perto ou longe.' },
  // extras próprias (out/2026): tudo gira em torno da manopla e de acertar de longe
  G: { nome: 'Arrogância do Explorador', nivel: 8, max: 10, recarga: serie(25, -1), custo: serie(40, 2), bonusHab: serie(0.2, 0.025), duracao: 8, estende: 0.5, estendeMax: 4,
    desc: 'Ezreal se exibe: por 8 segundos as habilidades causam mais dano. Cada habilidade que acerta estende o efeito em 0,5 segundo (até 4 segundos a mais).' },
  A: { nome: 'Tiro de Precisão', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: serie(35, 2), base: serie(60, 30), ratio: serie(0.8, 0.05), primeiro: 0.3, atravessa: 2,
    dano: (r, a) => HAB_EZREAL.A.base[r - 1] + HAB_EZREAL.A.ratio[r - 1] * a.ad,
    desc: 'Um disparo muito rápido que atravessa a fila de monstros (até 3). O primeiro atingido leva 30% a mais e fica atordoado por 1 segundo.' },
  D: { nome: 'Mira do Explorador', nivel: 18, max: 10, passiva: true, longe: serie(0.12, 0.02), pressa: 0.2,
    desc: 'Passiva: as habilidades causam mais dano quanto mais longe está o alvo. Acertar uma habilidade de longe dá 20% de velocidade por 2 segundos (no Summoner\'s Rift, recupera o fôlego do recuo).' },
  F: { nome: 'Sobrecarga Arcana', nivel: 23, max: 10, recarga: serie(18, -0.5), custo: serie(40, 3), duracao: 5, base: serie(40, 22), ratio: serie(0.4, 0.04), manaExplosao: 0.02,
    dano: (r, a) => HAB_EZREAL.F.base[r - 1] + HAB_EZREAL.F.ratio[r - 1] * a.ad,
    desc: 'Por 5 segundos, as habilidades deixam uma Marca Arcana nos monstros atingidos. Quando um monstro marcado é atingido de novo, a marca explode: dano extra e 2% da mana de volta.' },
  T: { nome: 'Descarga Shurimane', nivel: 28, max: 10, recarga: serie(12, -0.4), custo: serie(45, 4), base: serie(45, 24), ratio: serie(0.55, 0.035), alcance: 7, raio: 1.6, bolinhas: 6, bolinha: 0.2,
    dano: (r, a) => HAB_EZREAL.T.base[r - 1] + HAB_EZREAL.T.ratio[r - 1] * a.ad,
    desc: 'Ezreal lança uma carga de energia da manopla no ponto escolhido (no Summoner\'s Rift, no meio do grupo). Ao tocar o chão ela se quebra: dano em área e 6 bolinhas de energia que quicam em volta e acertam quem está perto com 20% do dano.' },
  B: { nome: 'Passagem Shurimane', nivel: 33, max: 10, recarga: serie(22, -0.8), custo: serie(60, 2), base: serie(60, 22), ratio: serie(0.45, 0.03), afasta: serie(1.4, 0.06), portal: 6, alcance: 8, duasVezes: true,
    isca: 2.5, iscaTiro: serie(0.3, 0.02), iscaSegura: 1,
    dano: (r, a) => HAB_EZREAL.B.base[r - 1] + HAB_EZREAL.B.ratio[r - 1] * a.ad,
    desc: 'Abre um portal no ponto escolhido e, depois de meio segundo, o Ezreal pode atravessá-lo (em Runeterra, aperte de novo em até 6 segundos). Ao atravessar, dispara sozinho no monstro mais perto e deixa para trás uma cópia de energia por 2,5 segundos, que atira no monstro mais perto e atrai os monstros em volta. No Summoner\'s Rift, ele abre o portal longe dos monstros e atravessa quando é alcançado.' },
  M: { nome: 'Tiro do Explorador', nivel: 38, max: 10, recarga: serie(12, -0.4), custo: serie(45, 3), base: serie(30, 15), ratio: serie(0.35, 0.025), saltos: 5, cresce: 0.15, explosao: 1,
    dano: (r, a) => HAB_EZREAL.M.base[r - 1] + HAB_EZREAL.M.ratio[r - 1] * a.ad,
    desc: 'Um disparo arcano que ricocheteia entre os monstros próximos até 5 vezes, e cada salto bate 15% mais forte que o anterior. Se o último acerto for num chefe, o disparo explode em área.' },
  N: { nome: 'Apogeu da Manopla', nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], custo: serie(100, 0, 5), duracao: 10, base: serie(300, 150, 5), ratio: serie(1.2, 0.15, 5),
    manaVolta: serie(0.2, 0.05, 5), chefePct: serie(0.03, 0.01, 5), impactoBase: serie(220, 110, 5), impactoRatio: serie(0.9, 0.1, 5), raioArena: 5, empurraArena: 3, empurraRift: 1.6,
    dano: (r, a) => HAB_EZREAL.N.base[r - 1] + HAB_EZREAL.N.ratio[r - 1] * a.ad,
    impacto: (r, a) => HAB_EZREAL.N.impactoBase[r - 1] + HAB_EZREAL.N.impactoRatio[r - 1] * a.ad,
    desc: 'Ezreal salta e cai com uma onda de choque enorme: dano e os monstros em volta são jogados para longe (menos os chefes). Por 10 segundos fica em Sobrecarga e recupera parte da mana: cada habilidade deixa um rastro no monstro atingido e, com 3 habilidades diferentes no mesmo monstro, os rastros explodem em dano enorme (em chefes, também uma parte da vida máxima).' },
};

// Lux: maga. Tudo escala com o Poder de Habilidade (a.ap) e causa dano mágico (os monstros têm resistência mágica:
// RM_MONSTRO da armadura). A passiva Iluminação marca quem as habilidades acertam; o próximo ataque básico detona a marca.
const HL = DADOS_LUX.habilidades;
const apDe = (a) => a.ap || 0;
const HAB_LUX = {
  P: { passivaLux: true, base: (nivel) => 20 + 10 * nivel, ratio: 0.2 },
  Q: { nome: HL.Q.nome, nivel: 1, max: 10, recarga: serie(7, -0.3), custo: serie(50, 2), base: serie(115, 45), ratio: serie(0.65, 0.04), prende: 1.5,
    dano: (r, a) => HAB_LUX.Q.base[r - 1] + HAB_LUX.Q.ratio[r - 1] * apDe(a),
    desc: 'Lança uma esfera de luz que prende os 2 primeiros monstros por 1,5s e causa dano mágico.' },
  W: { nome: HL.W.nome, nivel: 1, max: 10, recarga: serie(12, -0.4), custo: serie(60, 2), base: serie(60, 25), ratio: serie(0.35, 0.02),
    escudo: (r, a) => HAB_LUX.W.base[r - 1] + HAB_LUX.W.ratio[r - 1] * apDe(a),
    desc: 'Lança a varinha para a frente e ela volta para a Lux. Na ida e na volta, dá um escudo de luz nela e em quem do grupo a varinha tocar.' },
  E: { nome: HL.E.nome, nivel: 1, max: 10, recarga: serie(8, -0.3), custo: serie(60, 3), base: serie(115, 45), ratio: serie(0.65, 0.04),
    dano: (r, a) => HAB_LUX.E.base[r - 1] + HAB_LUX.E.ratio[r - 1] * apDe(a),
    desc: 'Uma singularidade de luz cai no meio do grupo, deixa todos lentos e explode, causando dano mágico em área.' },
  R: { nome: HL.R.nome, nivel: 6, max: 5, recarga: [70, 60, 50, 42, 35], custo: serie(100, 0, 5), base: serie(300, 150, 5), ratio: serie(1, 0.1, 5),
    dano: (r, a) => HAB_LUX.R.base[r - 1] + HAB_LUX.R.ratio[r - 1] * apDe(a),
    desc: 'Mira por meio segundo e dispara um raio enorme de luz que atravessa todos os monstros do grupo, perto ou longe.' },
  G: { ...HAB_DARIUS.G, nome: 'Luz Inspiradora', desc: 'A luz de Demacia brilha mais forte: aumenta todo o dano causado por 8 segundos.' },
  // as extras da Lux são elementais (como a skin Elementalista): gelo, água, natureza, estrelas e fogo
  A: { nome: 'Lança de Luz', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: serie(35, 2), base: serie(100, 38), ratio: serie(0.75, 0.04),
    dano: (r, a) => HAB_LUX.A.base[r - 1] + HAB_LUX.A.ratio[r - 1] * apDe(a),
    desc: 'Uma lança de luz atravessa os monstros: passa pelo primeiro e acerta todos os que estão atrás dele, na mesma linha.' },
  D: { nome: 'Faísca Prismática', nivel: 18, max: 10, passiva: true, prisma: true, cada: 3, raios: 3, base: serie(70, 35), ratio: serie(0.4, 0.03),
    dano: (r, a) => HAB_LUX.D.base[r - 1] + HAB_LUX.D.ratio[r - 1] * apDe(a),
    desc: 'Passiva: a cada 3 habilidades usadas, um prisma de luz se divide em 3 raios que acertam monstros diferentes, com dano mágico.' },
  F: { nome: 'Prisma Regenerador', nivel: 23, max: 10, recarga: serie(24, -0.8), custo: serie(60, 4), curaPct: serie(0.08, 0.008), curaPoder: 0.4,
    desc: 'Uma luz envolve a Lux e restaura uma parte da vida máxima, mais uma fração do Poder de Habilidade.' },
  T: { nome: 'Convergência Radiante', nivel: 28, max: 10, recarga: serie(11, -0.4), custo: serie(45, 4), base: serie(130, 55), ratio: serie(0.85, 0.04), prende: 1.2, espera: 0.6,
    dano: (r, a) => HAB_LUX.T.base[r - 1] + HAB_LUX.T.ratio[r - 1] * apDe(a),
    desc: 'A Lux concentra energia no chão em volta dela; depois de um instante, a área explode, causa dano mágico e prende os monstros atingidos por 1,2 segundo.' },
  B: { nome: 'Farol de Demacia', nivel: 33, max: 10, recarga: serie(35, -1.5), custo: serie(60, 2), duracao: 10, poderBonus: serie(0.1, 0.02), manaSeg: 0.03,
    desc: 'Acende um farol de luz: por 10 segundos aumenta o Poder de Habilidade e regenera 3% da mana por segundo.' },
  M: { nome: 'Chuva de Luz', nivel: 38, max: 10, recarga: serie(18, -0.6), custo: serie(70, 4), base: serie(140, 55), ratio: serie(0.9, 0.05), meteoros: 3, respingo: 0.45,
    dano: (r, a) => HAB_LUX.M.base[r - 1] + HAB_LUX.M.ratio[r - 1] * apDe(a),
    desc: 'Três raios de luz caem do céu sobre o grupo. Cada um explode no monstro atingido e acerta também os que estão perto dele.' },
  N: { nome: 'Furacão de Luz', nivel: 45, max: 5, recarga: [75, 66, 58, 51, 45], custo: serie(100, 0, 5), base: serie(260, 115, 5), ratio: serie(0.95, 0.11, 5), duracao: 3,
    dano: (r, a) => HAB_LUX.N.base[r - 1] + HAB_LUX.N.ratio[r - 1] * apDe(a),
    desc: 'Lança um furacão de luz que atravessa o grupo por 3 segundos, puxa os monstros para o meio e acerta todos a cada meio segundo.' },
};
// o efeito de cada rank mostra "do poder" nas habilidades da Lux
for (const t of ['Q', 'E', 'R', 'A', 'D', 'T', 'M', 'N']) HAB_LUX[t].escalaPoder = true;

// Darius: as extras dele são próprias (as antigas, em HAB_DARIUS, continuam como base das do Ezreal)
const HAB_DARIUS_KIT = {
  ...HAB_DARIUS,
  D: { nome: 'Vontade do General', nivel: 18, max: 10, passiva: true, vontade: serie(0.15, 0.03), tenacidade: serie(0.3, 0.04), limiarTenacidade: 0.35,
    desc: 'Passiva: quanto menor a vida do Darius, maior o dano de ataque (o máximo do rank vale com a vida quase no fim). Abaixo de 35% da vida, ele também resiste a atordoamentos e lentidões.' },
  F: { nome: 'Banho de Sangue', nivel: 23, max: 10, recarga: serie(22, -0.5), custo: serie(0, 0), custoVida: 0.08, duracao: 6, vidaPerdida: serie(0.03, 0.004), curaSangue: serie(0.01, 0.001),
    desc: 'Sacrifica 8% da vida atual para fortalecer o machado por 6 segundos: os ataques causam dano extra pela vida que falta ao alvo e curam um pouco quando o alvo está com Hemorragia.' },
  T: { ...HAB_DARIUS.T, raioArena: 3.6, desc: 'Golpeia o chão com força: dano em todos os inimigos numa área grande em volta e lentidão por 2 segundos.' },
  B: { nome: 'Estandarte de Noxus', nivel: 33, max: 10, recarga: serie(35, -1.5), custo: serie(60, 2), duracao: 10, defesaBonus: serie(0.2, 0.04),
    desc: 'Finca o estandarte: por 10 segundos aumenta a armadura e a resistência mágica do Darius e regenera 2% da mana por segundo.' },
  M: { nome: 'Ruptura Noxiana', nivel: 38, max: 10, recarga: serie(13, -0.4), custo: serie(40, 3), base: serie(110, 55), ratio: serie(1, 0.06), bonusSangue: 0.35, atordoa: 1,
    dano: (r, a) => HAB_DARIUS_KIT.M.base[r - 1] + HAB_DARIUS_KIT.M.ratio[r - 1] * a.ad,
    desc: 'Crava o machado no chão e abre uma fenda em linha reta: dano físico pesado, Hemorragia e atordoamento de 1 segundo. Quem já está sangrando leva 35% a mais.' },
  N: { nome: 'Domínio de Noxus', nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], custo: serie(100, 0, 5), duracao: 10, base: serie(70, 35, 5), ratio: serie(0.35, 0.05, 5), ampMax: 0.3, curaAbate: 0.04,
    dano: (r, a) => HAB_DARIUS_KIT.N.base[r - 1] + HAB_DARIUS_KIT.N.ratio[r - 1] * a.ad,
    desc: 'Finca o machado e transforma a área em volta em território de Noxus por 10 segundos: quem está dentro sofre dano e Hemorragia sem parar, e quanto mais tempo fica, mais lento fica e mais dano leva do Darius. Lá dentro o Darius não pode ser atordoado, preso nem puxado. Cada inimigo que morre na área aumenta o território e devolve vida ao Darius.' },
};

// Yasuo: espadachim corpo a corpo, sem mana (usa o Fluxo, que vira escudo), com o crítico dobrado.
// Q/W/E/R e a passiva seguem o LoL; as extras são próprias, todas de vento. Várias jogam os monstros para o alto
// (i.noAr), e o Último Suspiro (R) só funciona com alguém no ar.
export const FLUXO_MAX = 100;
const HY = DADOS_YASUO.habilidades;
const semCusto = (n = 10) => serie(0, 0, n);
const HAB_YASUO = {
  P: { passivaYasuo: true, critMult: 2, critDano: 0.8, critBase: (nivel) => Math.min(0.18, 0.1 + 0.0018 * nivel), fluxoSeg: 9, fluxoTile: 6, escudoFluxo: (nivel) => 80 + 28 * nivel },
  Q: { nome: HY.Q.nome, nivel: 1, max: 10, recarga: serie(4, -0.15), custo: semCusto(), base: serie(40, 20), ratio: serie(0.55, 0), fila: 2, cargas: 2, levanta: 1, recargaVa: true, minima: 1.5,
    dano: (r, a) => HAB_YASUO.Q.base[r - 1] + HAB_YASUO.Q.ratio[r - 1] * a.ad,
    desc: 'Uma estocada que pode dar acerto crítico. Cada acerto guarda uma carga; com 2, a próxima Tempestade de Aço vira um tornado que atravessa o grupo e joga os monstros para o alto por 1 segundo. A recarga cai com a velocidade de ataque, e logo depois da Espada Ágil ela acerta todos em volta.' },
  W: { nome: HY.W.nome, nivel: 1, max: 10, recarga: serie(24, -0.8), custo: semCusto(), duracao: 4, reducao: serie(0.3, 0.02),
    desc: 'Ergue uma parede de vento por 4 segundos. Tudo o que vem de longe para nela: tiros, habilidades de outros campeões e o sopro, o raio e o ácido dos chefes. Os outros golpes causam menos dano. Em Runeterra a parede fica onde foi erguida e só segura o que vem pela frente dela.' },
  E: { nome: HY.E.nome, nivel: 1, max: 10, recarga: serie(3.5, -0.15), custo: semCusto(), base: serie(50, 18), ratio: serie(0.2, 0.01), acumula: 0.25, acumMax: 2, mesmoAlvo: 6, magico: true,
    dano: (r, a) => HAB_YASUO.E.base[r - 1] + HAB_YASUO.E.ratio[r - 1] * a.ad,
    desc: 'Avança através de um monstro e causa dano mágico (o mesmo monstro só de novo depois de 6 segundos). Cada avanço seguido aumenta o dano do próximo em 25% (até 50%). No Summoner\'s Rift, ele vai até quem ainda está chegando.' },
  R: { nome: HY.R.nome, nivel: 6, max: 5, recarga: [70, 60, 50, 42, 35], custo: semCusto(5), base: serie(200, 110, 5), ratio: serie(1, 0.08, 5), penSuspiro: 0.3, duracaoPen: 15, segura: 1,
    dano: (r, a) => HAB_YASUO.R.base[r - 1] + HAB_YASUO.R.ratio[r - 1] * a.ad,
    desc: 'Só funciona com monstros no ar: o Yasuo aparece no meio deles, golpeia todos os que estão no ar com um dano enorme e os segura lá em cima por mais 1 segundo. Depois, por 15 segundos, os golpes dele ignoram 30% da armadura.' },
  G: { nome: 'Respiração do Vento', nivel: 8, max: 10, recarga: serie(25, -1), custo: semCusto(), duracao: 8, va: serie(0.25, 0.03),
    desc: 'O Yasuo entra no ritmo do vento: por 8 segundos ataca mais rápido, e a Tempestade de Aço volta mais rápido junto.' },
  A: { nome: 'Investida do Vendaval', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: semCusto(), base: serie(60, 30), ratio: serie(0.8, 0.05), levanta: 1,
    dano: (r, a) => HAB_YASUO.A.base[r - 1] + HAB_YASUO.A.ratio[r - 1] * a.ad,
    desc: 'Corre até o monstro mais distante e o corta para cima: dano, e o monstro fica no ar por 1 segundo.' },
  D: { nome: 'Lâmina Inquieta', nivel: 18, max: 10, passiva: true, inquieta: serie(0.03, 0.004), acumMax: 5, duracaoInquieta: 4,
    desc: 'Passiva: cada acerto crítico dá velocidade de ataque por 4 segundos, acumulando até 5 vezes.' },
  F: { nome: 'Lâmina Fantasma', nivel: 23, max: 10, recarga: serie(20, -0.6), custo: semCusto(), duracao: 6, pctCorte: serie(0.4, 0.03), alvosCorte: 2,
    desc: 'Por 6 segundos, cada ataque básico solta um corte de vento que acerta até 2 outros monstros perto com parte do dano.' },
  T: { nome: 'Furacão Cortante', nivel: 28, max: 10, recarga: serie(11, -0.4), custo: semCusto(), base: serie(70, 35), ratio: serie(0.9, 0.04), levanta: 0.75, raioArena: 2.6,
    dano: (r, a) => HAB_YASUO.T.base[r - 1] + HAB_YASUO.T.ratio[r - 1] * a.ad,
    desc: 'Gira a katana num redemoinho: dano em todos em volta, e os monstros sobem por 0,75 segundo.' },
  B: { nome: 'Brisa Protetora', nivel: 33, max: 10, recarga: serie(28, -1), custo: semCusto(), escudoPct: serie(0.12, 0.02),
    desc: 'O vento se fecha em volta do Yasuo e vira um escudo de uma parte da vida máxima.' },
  M: { nome: 'Lâmina do Vendaval', nivel: 38, max: 10, recarga: serie(13, -0.4), custo: semCusto(), base: serie(110, 55), ratio: serie(1, 0.06), levanta: 0.75, alvos: 4,
    dano: (r, a) => HAB_YASUO.M.base[r - 1] + HAB_YASUO.M.ratio[r - 1] * a.ad,
    desc: 'Um corte de vento em linha reta: acerta até 4 monstros (em Runeterra, todos na linha) e joga todos para o alto por 0,75 segundo.' },
  N: { nome: 'Dança das Mil Lâminas', nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], custo: semCusto(5), duracao: 2.5, golpes: 10, base: serie(60, 30, 5), ratio: serie(0.5, 0.06, 5),
    dano: (r, a) => HAB_YASUO.N.base[r - 1] + HAB_YASUO.N.ratio[r - 1] * a.ad,
    desc: 'Por 2,5 segundos o Yasuo vira vento: corta 10 vezes os monstros em volta (cada corte pode ser crítico) e nada o acerta enquanto isso.' },
};

// Katarina: assassina corpo a corpo de Noxus, de magia (escala com o Poder de Habilidade) e sem mana.
// Q, A e T deixam adagas no chão (no Rift, d.adagas; em Runeterra, A.adagas com posição); ao pegar uma, ela gira e corta
// todos em volta (Voracidade). Cada abate reduz a recarga da Q, W e E. A R é um canal de 2,5 s que um atordoamento interrompe.
const HKT = DADOS_KATARINA.habilidades;
const HAB_KATARINA = {
  P: { voracidade: 1.5, voracidadeChefe: 5, curaBase: 0.05, queda: { Q: 1.1, W: 1.25, A: 1, T: 0.8 }, dura: 4, pegaCada: 0.35, shunpo: 0.5,
    giro: (nivel, a) => 30 + 19 * nivel + 1 * apDe(a) + 0.4 * Math.max(0, a.ad - a.baseAd) },
  Q: { nome: HKT.Q.nome, nivel: 1, max: 10, recarga: serie(10, -0.35), custo: semCusto(), base: serie(80, 35), ratio: serie(0.45, 0.03), alvos: 3, adaga: true,
    dano: (r, a) => HAB_KATARINA.Q.base[r - 1] + HAB_KATARINA.Q.ratio[r - 1] * apDe(a),
    desc: 'Arremessa uma adaga que salta em até 3 monstros e depois cai no chão atrás do primeiro, do lado oposto ao dela. Quando a Katarina pega a adaga, gira e corta todos em volta.' },
  W: { nome: HKT.W.nome, nivel: 1, max: 10, recarga: serie(14, -0.4), custo: semCusto(), vel: serie(0.5, 0.03), duracaoVel: 1.25, adaga: true,
    desc: 'Joga uma adaga para o alto, que cai ao lado dela, e corre mais rápido por um instante. Pegar a adaga faz a Katarina girar e cortar todos em volta.' },
  E: { nome: HKT.E.nome, nivel: 1, max: 10, recarga: serie(10, -0.4), custo: semCusto(), base: serie(40, 20), ratio: serie(0.3, 0.02), adRatio: 0.4,
    dano: (r, a) => HAB_KATARINA.E.base[r - 1] + HAB_KATARINA.E.ratio[r - 1] * apDe(a) + HAB_KATARINA.E.adRatio * a.ad,
    desc: 'Aparece ao lado de um monstro e o corta. Se for até uma adaga no chão, pega a adaga e já gira. Cada adaga que ela pega corta pela metade o tempo que falta para o Shunpo voltar. No Summoner\'s Rift, ela vai até quem ainda está chegando.' },
  R: { nome: HKT.R.nome, nivel: 6, max: 5, recarga: [75, 65, 55, 48, 42], custo: semCusto(5), duracao: 2.5, golpes: 15, alvos: 3, base: serie(30, 14, 5), ratio: serie(0.25, 0.03, 5),
    dano: (r, a) => HAB_KATARINA.R.base[r - 1] + HAB_KATARINA.R.ratio[r - 1] * apDe(a),
    desc: 'Gira no lugar por 2,5 segundos, atirando adagas sem parar nos 3 monstros mais perto (15 adagas em cada um). Ser atordoada interrompe o giro.' },
  G: { nome: 'Sede de Sangue', nivel: 8, max: 10, recarga: serie(20, -0.8), custo: semCusto(), duracao: 8, base: serie(30, 15), ratio: serie(0.3, 0.015), curaSede: 0.3, va: serie(0.2, 0.02),
    dano: (r, a) => HAB_KATARINA.G.base[r - 1] + HAB_KATARINA.G.ratio[r - 1] * apDe(a),
    desc: 'Por 8 segundos a Katarina ataca mais rápido e cada ataque básico corta de novo com dano mágico; 30% desse dano volta como vida.' },
  A: { nome: 'Adaga Certeira', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: semCusto(), base: serie(90, 35), ratio: serie(0.6, 0.035), atordoa: 1, adaga: true,
    dano: (r, a) => HAB_KATARINA.A.base[r - 1] + HAB_KATARINA.A.ratio[r - 1] * apDe(a),
    desc: 'Atira uma adaga no monstro mais distante: dano mágico, ele fica atordoado por 1 segundo e a adaga cai no chão ao lado dele.' },
  D: { nome: 'Lâmina Sinistra', nivel: 18, max: 10, passiva: true, vaAdaga: serie(0.08, 0.008), acumMax: 3, duracaoSinistra: 3, curaGiro: serie(0.08, 0.01),
    desc: 'Passiva: cada adaga que a Katarina pega dá velocidade de ataque por 3 segundos (acumula 3 vezes), e o giro devolve parte do dano como vida.' },
  F: { nome: 'Lâmina Envenenada', nivel: 23, max: 10, recarga: serie(16, -0.5), custo: semCusto(), duracao: 8, venenoBase: serie(40, 18), venenoRatio: 0.25, venenoT: 3,
    veneno: (r, a) => HAB_KATARINA.F.venenoBase[r - 1] + HAB_KATARINA.F.venenoRatio * apDe(a),
    desc: 'Passa veneno nas lâminas: por 8 segundos, os ataques básicos e os giros das adagas envenenam, e o monstro perde vida por 3 segundos.' },
  T: { nome: 'Chuva de Adagas', nivel: 28, max: 10, recarga: serie(24, -0.8), custo: semCusto(), base: serie(60, 28), ratio: serie(0.4, 0.03), adagas: 3, raioArena: 2.4,
    dano: (r, a) => HAB_KATARINA.T.base[r - 1] + HAB_KATARINA.T.ratio[r - 1] * apDe(a),
    desc: 'Joga 3 adagas para o alto: elas cortam todos em volta ao cair e ficam no chão para a Katarina pegar.' },
  B: { nome: 'Passo das Sombras', nivel: 33, max: 10, recarga: serie(24, -0.8), custo: semCusto(), some: 1.5, janela: 5, bonusSombra: serie(1, 0.08),
    desc: 'Some nas sombras por 1,5 segundo (nada a acerta). O próximo golpe dela, de habilidade ou de adaga, causa muito mais dano.' },
  M: { nome: 'Execução Noxiana', nivel: 38, max: 10, recarga: serie(14, -0.5), custo: semCusto(), base: serie(200, 80), ratio: serie(1.2, 0.07), executa: serie(0.2, 0.01), reembolso: 0.5,
    dano: (r, a) => HAB_KATARINA.M.base[r - 1] + HAB_KATARINA.M.ratio[r - 1] * apDe(a),
    desc: 'Um golpe certeiro no monstro mais ferido. Se a vida dele ficar abaixo do limite, ele morre na hora e metade da recarga volta (os chefes só levam o dano).' },
  N: { nome: 'Tempestade de Lótus', nivel: 45, max: 5, recarga: [75, 66, 58, 51, 45], custo: semCusto(5), duracao: 3, golpes: 12, base: serie(90, 40, 5), ratio: serie(0.45, 0.05, 5), adagasFim: 2,
    dano: (r, a) => HAB_KATARINA.N.base[r - 1] + HAB_KATARINA.N.ratio[r - 1] * apDe(a),
    desc: 'Vira uma tempestade de lâminas por 3 segundos: corta todos os monstros em volta 12 vezes e puxa quem ainda está chegando. Nada a interrompe, e no fim 2 adagas ficam no chão.' },
};
for (const t of ['Q', 'E', 'R', 'G', 'A', 'T', 'M', 'N']) HAB_KATARINA[t].escalaPoder = true;

// Taric: tanque de suporte, de magia (a Força vira Poder de Habilidade). Cura, escudos e atordoamentos; o dano vem da Bravata
// (cada habilidade carrega 2 ataques mais rápidos, com dano mágico que escala com o poder e com a armadura bônus, e cada um
// tira 1 s de todas as recargas). Em Runeterra a cura, os escudos, a Constelação e o Resplendor valem também para o grupo.
const HTR = DADOS_TARIC.habilidades;
const HAB_TARIC = {
  P: { bravata: true, ataques: 2, duracao: 4, va: 0.6, reduz: 1, reduzQ: 0.75, manaGolpe: 0.015, emRuneterra: 0.8, ratioAp: 0.15, ratioArm: 0.4,
    dano: (nivel, a) => 30 + 12 * nivel + 0.15 * apDe(a) + 0.4 * Math.max(0, a.bonusArmadura || 0) },
  Q: { nome: HTR.Q.nome, nivel: 1, max: 10, recarga: serie(6, -0.2), custo: serie(30, 1), curaBase: serie(64, 29), curaRatio: 0.48, curaVida: 0.018, base: serie(60, 26), ratio: serie(0.35, 0.02), emRuneterra: 0.65,
    dano: (r, a) => HAB_TARIC.Q.base[r - 1] + HAB_TARIC.Q.ratio[r - 1] * apDe(a),
    valorCura: (r, a) => HAB_TARIC.Q.curaBase[r - 1] + HAB_TARIC.Q.curaRatio * apDe(a) + HAB_TARIC.Q.curaVida * a.vida,
    desc: 'A luz das estrelas cura o Taric e atinge os monstros em volta com dano mágico. Em Runeterra, cura também os aliados do grupo que estão perto dele.' },
  W: { nome: HTR.W.nome, nivel: 1, max: 10, recarga: serie(15, -0.5), custo: serie(60, 2), base: serie(70, 28), ratio: serie(0.4, 0.02), armPassiva: serie(0.06, 0.008),
    escudo: (r, a) => HAB_TARIC.W.base[r - 1] + HAB_TARIC.W.ratio[r - 1] * apDe(a),
    desc: 'Passiva: mais armadura. Ativa: um escudo no Taric e, em Runeterra, também no aliado do grupo mais perto.' },
  E: { nome: HTR.E.nome, nivel: 1, max: 10, recarga: serie(13, -0.4), custo: serie(55, 2), base: serie(110, 45), ratio: serie(0.5, 0.03), atordoa: 1.25, espera: 1, alvos: 4,
    dano: (r, a) => HAB_TARIC.E.base[r - 1] + HAB_TARIC.E.ratio[r - 1] * apDe(a),
    desc: 'Um feixe de luz sai do Taric e, depois de 1 segundo, explode: dano mágico e atordoamento em todos na linha (no Summoner\'s Rift, até 4 monstros).' },
  R: { nome: HTR.R.nome, nivel: 6, max: 5, recarga: [140, 120, 100, 85, 70], custo: serie(100, 0, 5), espera: 2.5, invulneravel: 2.5,
    desc: 'O céu se abre sobre o Taric: depois de 2,5 segundos, ele e os aliados do grupo perto ficam invulneráveis por 2,5 segundos.' },
  // as extras são de joias e de luz cósmica
  G: { nome: 'Pele de Diamante', nivel: 8, max: 10, recarga: serie(26, -0.8), custo: serie(40, 2), duracao: 8, defesa: serie(0.3, 0.03), reflete: serie(0.2, 0.025),
    desc: 'A armadura do Taric vira diamante por 8 segundos: muito mais armadura e resistência mágica, e quem bate nele leva parte do golpe de volta.' },
  A: { nome: 'Estilhaço Estelar', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: serie(35, 2), base: serie(90, 35), ratio: serie(0.6, 0.035), atordoa: 1,
    dano: (r, a) => HAB_TARIC.A.base[r - 1] + HAB_TARIC.A.ratio[r - 1] * apDe(a),
    desc: 'Arremessa um estilhaço de cristal no monstro mais distante: dano mágico e atordoamento de 1 segundo.' },
  D: { nome: 'Brilho Facetado', nivel: 18, max: 10, passiva: true, pulso: serie(0.4, 0.04),
    desc: 'Passiva: cada cura do Taric solta um pulso de luz que causa aos monstros em volta dano mágico igual a parte da cura.' },
  F: { nome: 'Égide Cristalina', nivel: 23, max: 10, recarga: serie(26, -0.8), custo: serie(60, 3), escudoPct: serie(0.12, 0.015), escudoPoder: 0.5,
    desc: 'Uma égide de cristal envolve o Taric: um escudo grande de parte da vida máxima mais o poder. Em Runeterra, os aliados do grupo perto também ganham o escudo.' },
  T: { nome: 'Chuva de Estrelas', nivel: 28, max: 10, recarga: serie(11, -0.4), custo: serie(50, 4), base: serie(110, 48), ratio: serie(0.7, 0.04), raioArena: 2.6, lento: 2,
    dano: (r, a) => HAB_TARIC.T.base[r - 1] + HAB_TARIC.T.ratio[r - 1] * apDe(a),
    desc: 'Estrelas caem em volta do Taric: dano mágico em todos perto e lentidão por 2 segundos.' },
  B: { nome: 'Constelação', nivel: 33, max: 10, recarga: serie(35, -1.5), custo: serie(60, 2), duracao: 10, cura: serie(0.012, 0.0015), manaSeg: 0.03,
    desc: 'Uma constelação brilha em volta do Taric por 10 segundos: ele regenera vida e mana. Em Runeterra, os aliados do grupo perto também.' },
  M: { nome: 'Martelo Celestial', nivel: 38, max: 10, recarga: serie(14, -0.5), custo: serie(60, 3), base: serie(130, 55), ratio: serie(0.85, 0.05), atordoa: 1, raioArena: 2.5, alcance: 6,
    dano: (r, a) => HAB_TARIC.M.base[r - 1] + HAB_TARIC.M.ratio[r - 1] * apDe(a),
    desc: 'O Taric salta com o martelo no meio dos monstros: impacto em área, dano mágico e atordoamento de 1 segundo.' },
  N: { nome: 'Supernova', nivel: 45, max: 5, recarga: [90, 80, 70, 62, 55], custo: serie(100, 0, 5), base: serie(320, 140, 5), ratio: serie(1.1, 0.12, 5), curaDano: 0.25, raioArena: 4,
    dano: (r, a) => HAB_TARIC.N.base[r - 1] + HAB_TARIC.N.ratio[r - 1] * apDe(a),
    desc: 'Uma estrela explode em volta do Taric: dano mágico enorme em todos perto, e um quarto do dano causado vira cura para ele (em Runeterra, também para o grupo).' },
};
for (const t of ['Q', 'E', 'A', 'T', 'M', 'N']) HAB_TARIC[t].escalaPoder = true;

// Zac: tanque de Zaun que entra no meio do grupo. Não usa mana: cada habilidade custa uma parte da vida ATUAL (custoVida, por rank),
// e as habilidades que acertam soltam gosmas (passiva Divisão Celular); pegar uma gosma cura uma parte da vida máxima e adianta a
// Matéria Instável (W). No Rift as gosmas não têm posição (d.gosmas; ele pega uma de cada vez quando precisa de vida ou tem a
// Absorção); em Runeterra ficam no chão com posição (fase 2, arena.js). Ao levar um golpe mortal, se divide e renasce com parte da
// vida (uma vez a cada 5 min). O dano escala com o Poder de Habilidade e com a vida máxima dele (ratioVida); a Matéria Instável tira
// uma parte da vida máxima do alvo (com o teto dos itens de % de vida, vidaRefItem).
const HZC = DADOS_ZAC.habilidades;
const custoVidaZ = (ini, passo = 0, n = 10) => serie(ini, passo, n);
const danoZac = (h) => (r, a) => h.base[r - 1] + h.ratio[r - 1] * apDe(a) + (h.ratioVida || 0) * (a.vida || 0);
export const HAB_ZAC = {
  P: { passivaZac: true, queda: 0.6, dura: 6, pegaCada: 0.4, wReduz: 0.3, maxPorLance: 3,
    curaGosma: (nivel) => 0.05 - 0.0006 * nivel, curaFalta: (nivel) => 0.12 - 0.0018 * nivel,      // da vida máxima mais da vida que falta
    renasce: { recarga: 300, espera: 2, vida: (nivel) => Math.min(0.45, 0.2 + 0.005 * nivel) } },
  Q: { nome: HZC.Q.nome, nivel: 1, max: 10, recarga: serie(9, -0.3), custo: semCusto(), custoVida: custoVidaZ(0.04), base: serie(30, 66), ratio: serie(0.4, 0.03), ratioVida: 0.025, alvos: 2, solo: [1.5, 1.5, 1.6, 1.7, 1.75, 1.8, 1.85, 1.9, 2.05, 2.2], lento: 1.5,
    desc: 'Estica o braço, agarra 2 monstros e bate um no outro: dano mágico nos dois e lentidão. Com um monstro só, bate ele no chão: até 2,2 vezes o dano. Em Runeterra, o braço vai longe e agarra o primeiro que encontrar.' },
  W: { nome: HZC.W.nome, nivel: 1, max: 10, recarga: serie(6, 0), custo: semCusto(), custoVida: custoVidaZ(0.03), base: serie(90, 4), ratio: serie(0.35, 0), pctAlvo: serie(0.02, 0),
    desc: 'O corpo do Zac explode para fora: dano mágico em todos em volta, mais uma parte da vida máxima de cada monstro. Cada gosma que ele pega adianta a recarga em 0,3 segundo.' },
  E: { nome: HZC.E.nome, nivel: 1, max: 10, recarga: serie(14, -0.5), custo: semCusto(), custoVida: custoVidaZ(0.05), base: serie(100, 56), ratio: serie(0.75, 0.04), ratioVida: 0.02, levanta: 1, alcance: 9,
    desc: 'Estica os braços no chão, puxa o corpo para trás e se lança longe, caindo no meio do grupo: dano mágico em todos onde cai, e eles vão para o alto por 1 segundo. No Summoner\'s Rift, ele cai em cima de quem ainda está chegando.' },
  R: { nome: HZC.R.nome, nivel: 6, max: 5, recarga: [100, 88, 76, 66, 56], custo: semCusto(5), custoVida: custoVidaZ(0, 0, 5), duracao: 2.5, quiques: 4, base: serie(200, 80, 5), ratio: serie(0.45, 0.05, 5), ratioVida: 0.015,
    reduzDano: serie(0.15, 0.05, 5), levanta: 1, lento: 1.5, quiquePvp: 0.5,
    desc: 'Quica 4 vezes em 2,5 segundos: cada queda causa dano mágico em todos em volta. A primeira joga os monstros para o alto e as outras deixam lentos. Enquanto quica, o Zac recebe menos dano.' },
  // as extras são de gosma e da química de Zaun
  G: { nome: 'Membrana Reforçada', nivel: 8, max: 10, recarga: serie(24, -0.8), custo: semCusto(), custoVida: custoVidaZ(0.03), duracao: 6, escudoPct: serie(0.08, 0.008), defesa: serie(0.2, 0.025),
    desc: 'A gosma do Zac endurece por 6 segundos: um escudo de parte da vida máxima e mais armadura e resistência mágica.' },
  A: { nome: 'Gancho Viscoso', nivel: 13, max: 10, recarga: serie(12, -0.5), custo: semCusto(), custoVida: custoVidaZ(0.04), base: serie(80, 32), ratio: serie(0.5, 0.03), ratioVida: 0.015, atordoa: 1, alcance: 7,
    desc: 'Lança um braço grudento no monstro mais distante e o puxa para perto: dano mágico e atordoamento de 1 segundo.' },
  D: { nome: 'Absorção', nivel: 18, max: 10, passiva: true, danoGosma: serie(0.03, 0.003), acumMax: 3, duracaoAbs: 5, reduzGosma: serie(0.05, 0.005),
    desc: 'Passiva: cada gosma que o Zac pega aumenta o dano das habilidades por 5 segundos (acumula até 3 vezes) e adianta as outras recargas.' },
  F: { nome: 'Poça Ácida', nivel: 23, max: 10, recarga: serie(18, -0.6), custo: semCusto(), custoVida: custoVidaZ(0.04), duracao: 4, base: serie(22, 10), ratio: serie(0.1, 0.008), ratioVida: 0.003, raioArena: 2.4, lento: 1,
    desc: 'Derrama uma poça de ácido de Zaun embaixo do grupo por 4 segundos: queima quem está nela a cada meio segundo (dano mágico) e deixa lento.' },
  T: { nome: 'Ondulação', nivel: 28, max: 10, recarga: serie(12, -0.4), custo: semCusto(), custoVida: custoVidaZ(0.05), base: serie(245, 57), ratio: serie(1.38, 0.05), ratioVida: 0.03, levanta: 0.75, raioArena: 2.8,
    desc: 'O Zac bate no chão e uma onda de gosma corre em volta dele: dano mágico em todos perto, que vão para o alto por 0,75 segundo.' },
  B: { nome: 'Regeneração Química', nivel: 33, max: 10, recarga: serie(30, -1), custo: semCusto(), custoVida: custoVidaZ(0), duracao: 5, curaTotal: serie(0.15, 0.015),
    desc: 'Um coquetel químico faz a gosma se refazer: o Zac recupera uma boa parte da vida máxima ao longo de 5 segundos.' },
  M: { nome: 'Mitose', nivel: 38, max: 10, recarga: serie(24, -0.8), custo: semCusto(), custoVida: custoVidaZ(0.06), duracao: 6, clones: 2, cada: 0.75, base: serie(30, 14), ratio: serie(0.15, 0.01), ratioVida: 0.004, reduzDano: 0.35,
    desc: 'Duas gosmas se soltam do Zac e viram cópias dele por 6 segundos: elas batem nos monstros e chamam a atenção deles, e o Zac recebe menos dano enquanto elas estão de pé.' },
  N: { nome: 'Explosão Celular', nivel: 45, max: 5, recarga: [55, 50, 45, 41, 37], custo: semCusto(5), custoVida: custoVidaZ(0.08, 0, 5), base: serie(1000, 300, 5), ratio: serie(2.6, 0.2, 5), ratioVida: 0.1, curaPorAlvo: 0.04, curaAlvos: 5, gosmas: 3, raioArena: 4,
    desc: 'O Zac explode em pedaços e se junta de novo: dano mágico enorme em todos perto, e cada monstro atingido devolve um pouco de vida (até 5). Três gosmas ficam no chão.' },
};
for (const t of ['Q', 'W', 'E', 'R', 'A', 'F', 'T', 'M', 'N']) { HAB_ZAC[t].escalaPoder = true; HAB_ZAC[t].dano = danoZac(HAB_ZAC[t]); }
// o dano da Matéria Instável num alvo: o fixo mais a parte da vida máxima dele (com o teto dos itens de % de vida)
export const danoWZac = (r, a, alvo) => HAB_ZAC.W.dano(r, a) + HAB_ZAC.W.pctAlvo[r - 1] * (alvo ? vidaRefItem(alvo) : 0);
// quanto da vida atual a habilidade custa (0 para quem não paga com vida); o arena.js e o jogo usam
export const custoVidaHab = (estado, tecla) => { const h = habDe(estado)[tecla], r = estado.ranks?.[tecla] || 0; return Array.isArray(h?.custoVida) && r ? h.custoVida[r - 1] || 0 : 0; };

// cada campeão é um kit: atributos-base, habilidades e jeito de lutar
export const KITS = {
  // papel: multiplica o dano causado e o recebido contra monstros (balanceamento de 11/10/2026, pedido do dono: Darius tanque de
  // pouco dano; Ezreal dano, frágil e ágil; Lux o maior dano e a mais frágil; Taric tanque de suporte; Yasuo equilibrado e um
  // pouco mais tanque; Katarina com mais dano que o Yasuo e mais frágil). arena: o dano contra monstros em Runeterra (lá vêm em
  // bando: quem bate num alvo só precisa de mais). pvp e pvpRecebido: os mesmos papéis pela metade, só entre jogadores.
  // vel: velocidade de andar em Runeterra (o servidor aceita junto, pvp.js)
  darius: { id: 'darius', dados: DADOS, stats: DADOS.campeao.stats, adBase: 64, adNivel: 3.9, hab: HAB_DARIUS_KIT, distancia: false, hemorragia: true, papel: { dano: 1.1, recebido: 0.55, arena: 1.075, pvp: 0.95, pvpRecebido: 0.85 },      // dano 0,91 → 1,1 e arena 1,3 → 1,075 em 13/10/2026 (p633: +21% só no Rift)
    ordem: ['N', 'R', 'E', 'A', 'G', 'B', 'F', 'T', 'Q', 'M', 'W'] },
  ezreal: { id: 'ezreal', dados: DADOS_EZREAL, stats: DADOS_EZREAL.campeao.stats, adBase: 66, adNivel: 4.2, hab: HAB_EZREAL, distancia: true, hemorragia: false, chegadaExtra: 1.2, papel: { dano: 1.12, recebido: 1.05, arena: 1.1, pvp: 1.08, pvpRecebido: 0.95, vel: 1.08 },
    // kiting: recua entre os disparos (recuo em s que o monstro leva para alcançar de novo), gastando fôlego
    kite: { recarga: 1.6, recuo: 0.6, gasto: 0.25, recupera: 0.15, pausa: 0.2 },
    ordem: ['N', 'G', 'F', 'R', 'E', 'B', 'T', 'A', 'M', 'W', 'Q'] },
  // magia: as habilidades escalam com o Poder de Habilidade e causam dano mágico; o saque é de itens de mago
  lux: { id: 'lux', dados: DADOS_LUX, stats: DADOS_LUX.campeao.stats, adBase: 54, adNivel: 3.3, hab: HAB_LUX, distancia: true, magia: true, hemorragia: false, chegadaExtra: 1.2, papel: { dano: 1.59, recebido: 1.05, arena: 1.0, pvp: 1.2, pvpRecebido: 0.95 },
    kite: { recarga: 1.8, recuo: 0.55, gasto: 0.25, recupera: 0.15, pausa: 0.2 },
    ordem: ['N', 'R', 'W', 'E', 'A', 'G', 'B', 'F', 'T', 'Q', 'M'] },
  // Yasuo: corpo a corpo, sem mana (Fluxo), crítico dobrado
  yasuo: { id: 'yasuo', dados: DADOS_YASUO, stats: DADOS_YASUO.campeao.stats, adBase: 60, adNivel: 3.9, hab: HAB_YASUO, distancia: false, hemorragia: false, fluxo: true, papel: { dano: 1.15, recebido: 0.85, arena: 1.5, pvp: 0.92, pvpRecebido: 0.92, vel: 1.04 },
    ordem: ['N', 'R', 'W', 'E', 'A', 'G', 'B', 'F', 'T', 'M', 'Q'] },
  // Katarina: corpo a corpo, de magia, sem mana; as adagas (Q, A, T) caem no chão e ela gira ao pegar
  katarina: { id: 'katarina', dados: DADOS_KATARINA, stats: DADOS_KATARINA.campeao.stats, adBase: 58, adNivel: 3.4, hab: HAB_KATARINA, distancia: false, magia: true, semMana: true, adagas: true,
    hemorragia: false, papel: { dano: 1.2, recebido: 0.75, recebidoArena: 1, arena: 1.75, pvp: 1.15, pvpRecebido: 0.92, vel: 1.05 },
    ordem: ['N', 'R', 'B', 'M', 'E', 'A', 'G', 'F', 'T', 'Q', 'W'] },
  // Taric: tanque de suporte, de magia; cura, escudos e atordoamentos, e a Bravata depois de cada habilidade
  taric: { id: 'taric', dados: DADOS_TARIC, stats: DADOS_TARIC.campeao.stats, adBase: 55, adNivel: 3.3, hab: HAB_TARIC, distancia: false, magia: true,
    hemorragia: false, papel: { dano: 0.9, recebido: 0.75, arena: 0.78, pvp: 0.8, pvpRecebido: 1 },      // recebido 0,62 → 0,75 em 12/10/2026 (aguentava mais que o Darius)
    ordem: ['R', 'N', 'F', 'Q', 'W', 'E', 'B', 'G', 'M', 'T', 'A'] },
  // Zac: tanque que entra na briga; sem mana, paga as habilidades com vida (semMana) e se cura com as gosmas
  zac: { id: 'zac', dados: DADOS_ZAC, stats: DADOS_ZAC.campeao.stats, adBase: 60, adNivel: 3.3, hab: HAB_ZAC, distancia: false, magia: true, semMana: true, gosmas: true,
    hemorragia: false, papel: { dano: 1.425, recebido: 0.66, recebidoArena: 0.7, arena: 0.7, pvp: 0.65, pvpRecebido: 0.69 },      // dano 1,37 → 1,425 em 13/10/2026 (p600, +4%)
    ordem: ['N', 'R', 'B', 'G', 'E', 'A', 'T', 'M', 'F', 'W', 'Q'] },
};
export const kit = (estado) => KITS[estado?.campeao] || KITS.darius;
export const habDe = (estado) => kit(estado).hab;
export const HAB = HAB_DARIUS_KIT;          // as habilidades do Darius (para quem ainda não sabe o campeão)
export const ORDEM_HAB = ['Q', 'W', 'E', 'R', 'G', 'A', 'D', 'F', 'T', 'B', 'M', 'N'];
export const BARRA = 4;           // a barra de combate: 4 habilidades (em Runeterra, uma em cada tecla Q, Espaço, E, R)
export const RANKS_TOTAIS = ORDEM_HAB.reduce((s, t) => s + HAB[t].max, 0);
export const nivelMinimoR = [6, 11, 16, 25, 35];
const nivelMinimoN = [45, 46, 47, 48, 50];
// quantos ranks o nível permite em cada habilidade (Q/W/E sobem a cada 2 níveis; as novas, a cada 2 níveis depois de liberar)
export function rankMaximoNoNivel(estado, tecla) {
  const h = habDe(estado)[tecla];
  if (estado.nivel < h.nivel) return 0;
  if (tecla === 'R') return nivelMinimoR.filter((n) => estado.nivel >= n).length;
  if (tecla === 'N') return nivelMinimoN.filter((n) => estado.nivel >= n).length;
  if (tecla === 'Q' || tecla === 'W' || tecla === 'E') return Math.min(h.max, Math.ceil(estado.nivel / 2));
  return Math.min(h.max, 1 + Math.floor((estado.nivel - h.nivel) / 2));
}
export function podeSubir(estado, tecla) {
  return estado.pontos > 0 && (estado.ranks[tecla] || 0) < rankMaximoNoNivel(estado, tecla);
}
// o que a habilidade faz num rank (para comparar o rank atual com o próximo)
const pct = (v) => `${Math.round(v * 100)}%`;
export function efeitosRank(tecla, r, estado) {
  const h = habDe(estado)[tecla], i = r - 1;
  if (r < 1) return [];
  const lista = [];
  if (h.escudo) lista.push([t('Escudo'), t('{b} + {p} do Poder de Habilidade', { b: h.base[i], p: pct(h.ratio[i]) })]);
  else if (h.base) lista.push([t('Dano'), h.escalaPoder ? t('{b} + {p} do Poder de Habilidade', { b: h.base[i], p: pct(h.ratio[i]) }) : h.ratio ? t('{b} + {p} do dano', { b: h.base[i], p: pct(h.ratio[i]) }) : t('{b} + {p} do dano bônus', { b: h.base[i], p: pct(0.75) })]);
  if (h.mult) lista.push([t('Dano'), t('{p} do dano', { p: pct(h.mult[i]) })]);
  if (h.reduz) lista.push([t('Reduz as outras recargas'), `${h.reduz}s`]);
  if (h.devolveMana) lista.push([t('Devolve mana'), String(h.devolveMana[i])]);
  if (h.afasta) lista.push([t('Monstros voltam a caminhar'), `${h.afasta[i].toFixed(2)}s`]);
  if (h.pen) lista.push([t('Penetração de armadura'), pct(h.pen[i])]);
  if (h.bonus) lista.push([t('Dano extra'), `+${pct(h.bonus[i])}`]);
  if (h.roubo) lista.push([t('Roubo de vida'), pct(h.roubo[i])]);
  if (h.cura) lista.push([t('Cura por segundo'), t('{p}% da vida', { p: (h.cura[i] * 100).toFixed(2) })]);
  if (h.curaPct) lista.push([t('Cura'), t('{p}% da vida + {q} do Poder de Habilidade', { p: num1(h.curaPct[i] * 100), q: pct(h.curaPoder) })]);
  if (h.prende) lista.push([t('Prende'), `${h.prende}s`]);
  if (h.meteoros) lista.push([t('Raios'), String(h.meteoros)]);
  if (h.poderBonus) lista.push([t('Poder de Habilidade'), `+${pct(h.poderBonus[i])}`]);
  if (h.vontade) lista.push([t('Dano de ataque com a vida no fim'), `+${pct(h.vontade[i])}`], [t('Resistência a controle (vida abaixo de 35%)'), pct(h.tenacidade[i])]);
  if (h.vidaPerdida) lista.push([t('Dano extra'), t('{p} da vida que falta ao alvo', { p: pct(h.vidaPerdida[i]) })], [t('Cura no alvo com Hemorragia'), t('{p} da vida por ataque', { p: pct(h.curaSangue[i]) })]);
  if (h.defesaBonus) lista.push([t('Armadura e resistência mágica'), `+${pct(h.defesaBonus[i])}`]);
  if (h.bonusHab) lista.push([t('Dano das habilidades'), `+${pct(h.bonusHab[i])}`]);
  if (h.primeiro) lista.push([t('Primeiro atingido'), t('+{p} e atordoa 1s', { p: pct(h.primeiro) })]);
  if (h.longe) lista.push([t('Dano das habilidades de longe'), t('até +{p}', { p: pct(h.longe[i]) })]);
  if (h.manaExplosao) lista.push([t('Mana por explosão'), pct(h.manaExplosao)]);
  if (h.bolinhas) lista.push([t('Bolinhas'), t('{n} × {p} do dano', { n: h.bolinhas, p: pct(h.bolinha) })]);
  if (h.iscaTiro) lista.push([t('Cópia de energia'), t('5 tiros de {p} do dano', { p: pct(h.iscaTiro[i]) })]);
  if (h.impacto) lista.push([t('Onda da queda'), t('{b} + {p} do dano', { b: h.impactoBase[i], p: pct(h.impactoRatio[i]) })]);
  if (h.saltos) lista.push([t('Ricochetes'), t('{n} (+{p} cada)', { n: h.saltos, p: pct(h.cresce) })]);
  if (h.manaVolta) lista.push([t('Mana de volta'), pct(h.manaVolta[i])], [t('Em chefes'), t('+{p} da vida máxima', { p: pct(h.chefePct[i]) })]);
  if (h.manaSeg) lista.push([t('Mana por segundo'), pct(h.manaSeg)]);
  if (h.cada) lista.push([t('Dispara a cada'), t('{n} habilidades', { n: h.cada })]);
  if (h.duracao && tecla === 'N' && h.base) lista.push([t('Duração'), `${h.duracao}s`]);
  if (h.acumulos) lista.push([t('Limite'), t('+{n}% de armadura e dano', { n: h.acumulos[i] })]);
  if (h.limiar) lista.push([t('Executa abaixo de'), pct(h.limiar[i])], [t('Dano em chefes'), t('{n} + dano bônus', { n: h.chefe[i] })]);
  if (h.cargas) lista.push([t('Tornado'), t('a cada {n} acertos, joga para o alto por {s}s', { n: h.cargas, s: num1(h.levanta) })]);
  else if (h.levanta) lista.push([t('Joga para o alto'), `${num1(h.levanta)}s`]);
  if (h.reducao) lista.push([t('Dano reduzido'), pct(h.reducao[i])], [t('Tiros e habilidades de longe'), t('bloqueados')]);
  if (h.acumula) lista.push([t('Avanços seguidos'), t('+{p} cada (até +{m})', { p: pct(h.acumula), m: pct(h.acumula * h.acumMax) })]);
  if (h.penSuspiro) lista.push([t('Ignora armadura'), t('{p} por {s}s', { p: pct(h.penSuspiro), s: h.duracaoPen })]);
  if (h.va) lista.push([t('Velocidade de ataque'), `+${pct(h.va[i])}`]);
  if (h.inquieta) lista.push([t('Velocidade de ataque por crítico'), t('+{p} (até {n} vezes)', { p: num1(h.inquieta[i] * 100) + '%', n: h.acumMax })]);
  if (h.pctCorte) lista.push([t('Corte de vento'), t('{p} do dano em até {n} monstros', { p: pct(h.pctCorte[i]), n: h.alvosCorte })]);
  if (h.escudoPct) lista.push([t('Escudo'), h.escudoPoder ? t('{p} da vida máxima + {q} do Poder de Habilidade', { p: pct(h.escudoPct[i]), q: pct(h.escudoPoder) }) : t('{p} da vida máxima', { p: pct(h.escudoPct[i]) })]);
  if (h.valorCura) lista.push([t('Cura'), t('{b} + {p} do Poder de Habilidade + {v}% da vida', { b: h.curaBase[i], p: pct(h.curaRatio), v: num1(h.curaVida * 100) })]);
  if (h.armPassiva) lista.push([t('Armadura (passiva)'), `+${pct(h.armPassiva[i])}`]);
  if (h.invulneravel) lista.push([t('Invulnerável'), t('{s}s, depois de {e}s', { s: num1(h.invulneravel), e: num1(h.espera) })]);
  if (h.espera && h.atordoa && !h.invulneravel) lista.push([t('Explode depois de'), `${num1(h.espera)}s`]);
  if (h.defesa) lista.push([t('Armadura e resistência mágica'), `+${pct(h.defesa[i])}`]);
  if (h.reflete) lista.push([t('Dano devolvido'), pct(h.reflete[i])]);
  if (h.pulso) lista.push([t('Dano do pulso'), t('{p} da cura', { p: pct(h.pulso[i]) })]);
  if (h.curaDano) lista.push([t('Cura'), t('{p} do dano causado', { p: pct(h.curaDano) })]);
  if (h.golpes) lista.push([t('Cortes'), String(h.golpes)]);
  if (h.atordoa && !h.bonusSangue) lista.push([t('Atordoa'), `${num1(h.atordoa)}s`]);
  if (h.adRatio) lista.push([t('Mais'), t('{p} do dano de ataque', { p: pct(h.adRatio) })]);
  if (h.vel) lista.push([t('Velocidade (Runeterra)'), `+${pct(h.vel[i])}`]);
  if (h.curaSede) lista.push([t('Vida de volta'), pct(h.curaSede)]);
  if (h.vaAdaga) lista.push([t('Velocidade de ataque por adaga'), t('+{p} (até {n} vezes)', { p: pct(h.vaAdaga[i]), n: h.acumMax })], [t('Cura do giro'), t('{p} do dano', { p: pct(h.curaGiro[i]) })]);
  if (h.venenoBase) lista.push([t('Veneno por segundo'), t('{b} + {p} do Poder de Habilidade', { b: h.venenoBase[i], p: pct(h.venenoRatio) })]);
  if (h.adagas) lista.push([t('Adagas'), String(h.adagas)]);
  if (h.adagasFim) lista.push([t('Adagas no fim'), String(h.adagasFim)]);
  if (h.bonusSombra) lista.push([t('Próximo golpe'), `+${pct(h.bonusSombra[i])}`]);
  if (h.executa) lista.push([t('Executa abaixo de'), pct(h.executa[i])]);
  if (h.ratioVida) lista.push([t('Mais'), t('{p} da vida máxima', { p: num1(h.ratioVida * 100) + '%' })]);
  if (h.pctAlvo) lista.push([t('Da vida máxima do alvo'), num1(h.pctAlvo[i] * 100) + '%']);
  if (h.reduzDano) lista.push([t('Dano recebido a menos'), pct(Array.isArray(h.reduzDano) ? h.reduzDano[i] : h.reduzDano)]);
  if (h.quiques) lista.push([t('Quiques'), String(h.quiques)]);
  if (Array.isArray(h.solo)) lista.push([t('Com um monstro só'), t('{x} vezes o dano', { x: num1(h.solo[i]) })]);
  if (h.curaTotal) lista.push([t('Cura em {s}s', { s: h.duracao }), t('{p} da vida máxima', { p: pct(h.curaTotal[i]) })]);
  if (h.danoGosma) lista.push([t('Dano das habilidades por gosma'), t('+{p} (até {n} vezes)', { p: num1(h.danoGosma[i] * 100) + '%', n: h.acumMax })], [t('Recargas a menos por gosma'), `${h.reduzGosma[i]}s`]);
  if (h.clones) lista.push([t('Cópias'), String(h.clones)]);
  if (h.curaPorAlvo) lista.push([t('Cura por monstro atingido'), t('{p} da vida máxima (até {n})', { p: pct(h.curaPorAlvo), n: h.curaAlvos })]);
  if (h.recarga) lista.push([t('Recarga'), `${h.recarga[i]}s`]);
  if (h.custoVida && h.custoVida[i]) lista.push([t('Custo'), t('{p} da vida atual', { p: num1(h.custoVida[i] * 100) + '%' })]);
  if (h.custo && h.custo[i]) lista.push([t('Mana'), String(h.custo[i])]);
  return lista;
}
const ranksVazios = () => Object.fromEntries(ORDEM_HAB.map((t) => [t, 0]));

// ---------- Estado inicial ----------
export function novoEstado(campeao = 'darius') {
  const e = {
    versao: 3,
    campeao,
    nivel: 1, xp: 0, pontos: 0,
    ranks: { ...ranksVazios(), Q: 1 },     // começa com a Q aprendida (os pontos dos outros níveis o jogador escolhe onde pôr)
    barra: ['Q'],              // cada habilidade entra aqui quando é aprendida
    atrib: atribVazio(), pontosAtrib: 0, modelo: '',
    ouro: 150,
    itens: [],            // equipados
    mochila: [],
    espolios: {},         // partes de monstros, só para vender (id → quantidade)
    gemas: {},            // gemas do Ornn (id → quantidade), numa bolsa à parte da mochila
    pocoes: { vida: 10, vidaF: 0, vidaS: 0, mana: 5, manaF: 0 },
    montaria: { nivel: 1, xp: 0, skins: [], skin: '' },     // o Burrinho de Runeterra (ver MONTARIA)
    auto: { vida: true, limiarVida: 0.5, mana: true, limiarMana: 0.3, voltar: true },
    local: 'fonte',
    vida: 0, mana: 0,
    totais: { abates: 0, ouro: 0, mortes: 0, drops: 0, chefes: 0 },
    salvoEm: Date.now(),
  };
  const a = atributos(e);
  e.vida = a.vida; e.mana = a.mana;
  return e;
}

// saves antigos: completa os campos novos e devolve os pontos que faltam
export function migrar(e) {
  montariaDe(e);
  if (Array.isArray(e.barra) && e.barra.length > BARRA) e.barra = e.barra.slice(0, BARRA);     // a barra era de 6
  e.espolios ??= {};
  e.gemas ??= {};
  migrarPersistencia(e);        // a persistência da forja passou a contar por raridade do item (p555)
  // a Precisão saiu do jogo: os pontos dela voltam livres
  if (e.atrib?.precisao !== undefined) { e.pontosAtrib = (e.pontosAtrib || 0) + (e.atrib.precisao || 0); delete e.atrib.precisao; }
  // os pontos livres nunca passam do que o nível dá (p602: com pontos a mais, gastá-los fazia o servidor recusar todo save)
  if (e.versao === 3 && Number.isFinite(e.nivel) && e.atrib && Number.isFinite(e.pontosAtrib)) {
    const gastos = Object.values(e.atrib).reduce((s, v) => s + (Number.isInteger(v) && v > 0 ? v : 0), 0);
    e.pontosAtrib = Math.max(0, Math.min(e.pontosAtrib, PONTOS_POR_NIVEL * (e.nivel - 1) - gastos));
  }
  if (e.modelo === 'critico') e.modelo = 'dano';
  // a planilha de balanço pode baixar a experiência de um nível: quem já passou do novo valor sobe na hora
  if (e.versao === 3 && e.nivel && e.xp >= xpParaNivel(e.nivel)) ganharXp(e, null, 0);
  if (e.versao === 3) return e;
  e.versao = 3;
  e.ranks = { ...ranksVazios(), ...e.ranks };
  e.barra ??= ['Q', 'W', 'E', 'R'];
  e.atrib ??= atribVazio();
  e.modelo ??= 'equilibrado';
  e.pontosAtrib = PONTOS_POR_NIVEL * (e.nivel - 1);
  e.pontos = e.nivel - Object.values(e.ranks).reduce((s, r) => s + r, 0);
  return e;
}

// ---------- Combate ----------
export function criarCombate() {
  return {
    darius: { escudo: 0, recargas: ranksVazios(), ataque: 0, wPronto: false, trindade: false,
      poder: 0, sangramentoRecebido: [], timers: { quebra: 0, couraca: 0, sterak: 0, anjo: 0, pocao: 0 }, furia: 0, morto: 0, recall: 0,
      grito: 0, gritoBonus: 0, furiaS: 0, furiaRoubo: 0, estandarte: 0, estandarteCura: 0, disciplina: 0, machados: [], meteoros: [], prismaCont: 0 },
    inimigos: [],
    eventos: [],
    tempo: 0,
    respawn: 1,
  };
}

let proximoId = 1;
export function criarMonstro(nome, n, extra = {}) {
  const m = MONSTROS[nome];
  return {
    nome, nivel: n, chefe: !!m.chefe, magico: !!m.magico,
    hpMax: CURVA.hp(n) * m.hp, hp: CURVA.hp(n) * m.hp, ad: CURVA.ad(n) * m.ad, as: m.as, armadura: CURVA.armadura(n) * m.armadura,
    ouro: CURVA.ouro(n) * m.ouro * (0.5 + Math.random() * 0.5), xp: CURVA.xp(n) * m.xp,
    acumulos: 0, tSangue: 0, reducaoArmadura: 0, lento: 0, chegada: 1.2, ataque: Math.random() / m.as,
    tocado: false, id: 'm' + proximoId++, distancia: m.distancia || 0, ...extra,
  };
}

// ---------- Dia e noite ----------
// ciclo de 16 min: 9 de dia, 1 de anoitecer, 5 de noite, 1 de amanhecer
// relógio = segundos desde a meia-noite no horário de Brasília (o mundo segue a hora de verdade)
// dia das 6h às 18h, noite das 18h às 6h, com amanhecer (5h30–6h30) e entardecer (17h30–18h30) suaves
export const CICLO = 86400;
const HORA = 3600;
export function luzDoDia(relogio = 0) {
  const t = ((relogio % CICLO) + CICLO) % CICLO;
  if (t >= 6.5 * HORA && t < 17.5 * HORA) return 1;
  if (t >= 17.5 * HORA && t < 18.5 * HORA) return 1 - ((t - 17.5 * HORA) / HORA) * 0.72;
  if (t >= 5.5 * HORA && t < 6.5 * HORA) return 0.28 + ((t - 5.5 * HORA) / HORA) * 0.72;
  return 0.28;
}
export const FUSO = -3;                                   // horário de Brasília (UTC−3, sem horário de verão)
// "14:32:07" a partir do relógio do mundo
export const horaDoRelogio = (relogio) => { const t = ((relogio % CICLO) + CICLO) % CICLO; return `${String(Math.floor(t / HORA)).padStart(2, '0')}:${String(Math.floor((t % HORA) / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
export const ehNoite = (estado) => luzDoDia(estado.relogio) < 0.6;
// o dia e a noite são do mundo, iguais para todos: vêm da hora (do servidor), não de cada personagem
export const relogioMundial = (ms) => ((((ms / 1000) + FUSO * HORA) % CICLO) + CICLO) % CICLO;
export const NOTURNO = { chance: 0.35, hp: 1.4, ad: 1.25, xp: 1.8, ouro: 1.5 };
function tornarNoturno(m) {
  m.noturno = true;
  m.hp *= NOTURNO.hp; m.hpMax *= NOTURNO.hp; m.ad *= NOTURNO.ad; m.xp *= NOTURNO.xp; m.ouro *= NOTURNO.ouro;
  return m;
}
// monstro furioso (09/10/2026, sugestão de jogador): no Summoner's Rift, em FURIOSO.chance dos grupos (sem chefe) um dos monstros
// nasce furioso: mais vida, bate mais forte e mais rápido e, enquanto vive, deixa os outros do grupo mais bravos (aura: batem
// mais forte e mais rápido). Derrubá-lo rende como vários: XP e ouro x5, o saque sorteado 3 vezes e runas e espólios 2.
// Nunca é noturno ao mesmo tempo. Medido em <scratch>/hud/sim-furioso.mjs (XP/min, ouro/min e itens por hora, com e sem).
export const FURIOSO = { chance: 0.05, hp: 4, ad: 1.5, as: 1.15, xp: 5, ouro: 5, saque: 3, extras: 2, aura: { ad: 1.25, as: 1.2 } };
function tornarFurioso(m) {
  m.furioso = true;
  m.hp *= FURIOSO.hp; m.hpMax *= FURIOSO.hp; m.ad *= FURIOSO.ad; m.as *= FURIOSO.as; m.xp *= FURIOSO.xp; m.ouro *= FURIOSO.ouro;
  return m;
}
// quantas vezes a mais o saque, as runas e os espólios de um monstro são sorteados: o noturno 1, o furioso n − 1
const aMais = (i, n, f) => Array.from({ length: i.furioso ? n - 1 : i.noturno ? 1 : 0 }, f).flat();

// os monstros nascem perto do nível do jogador (de 2 abaixo a 1 acima), sempre dentro da faixa do lugar
function gerarGrupo(local, noite = false, nivelJogador = null) {
  const [n0, n1] = local.nm, r = Math.random;
  const nivel = nivelJogador == null ? () => n0 + Math.floor(r() * (n1 - n0 + 1))
    : () => Math.max(n0, Math.min(n1, nivelJogador - 2 + Math.floor(r() * 4)));
  // furioso conta como chefe no automático (p632); o chefe nasce no nível do jogador + 4, entre o começo da zona + 2 e o topo + 2
  if (local.chefe && r() < local.chefe[1]) return [criarMonstro(local.chefe[0], nivelJogador == null ? n1 + 2 : Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4)), { chegada: 1.8 })];
  const total = local.monstros.reduce((s, [, p]) => s + p, 0);
  const sortear = () => { let x = r() * total; for (const [nome, p] of local.monstros) if ((x -= p) < 0) return nome; return local.monstros[0][0]; };
  const qtd = 2 + Math.floor(r() * 3), furioso = r() < FURIOSO.chance ? Math.floor(r() * qtd) : -1;
  return Array.from({ length: qtd }, (_, k) => {
    const m = criarMonstro(sortear(), nivel(), { chegada: 1.2 + k * 0.25 });
    if (k === furioso) return tornarFurioso(m);
    return noite && r() < NOTURNO.chance ? tornarNoturno(m) : m;
  });
}

const escolher = (lista) => lista[Math.floor(Math.random() * lista.length)];
// chance (0–1) de cada raridade cair de um monstro comum; mesma conta de sortearLoot (uma raridade por abate)
// chance por monstro comum, por raridade (tier 0 a 7): lendário de 0,004% a 0,016% (cresce 4x do início ao Barão;
// out/2026, pedido do dono: o lendário cai de verdade, ~1 a cada 10 mil abates, e o raro passa a ser a qualidade S/SS),
// épico de 0,05% a 0,155%, básico (componente) de 1,2% a 0,85%. Ver _raw/balanco.mjs para o tempo médio de cada um.
// (multiplicado pela chance_de_drop da planilha, pela faixa de nível do lugar: o meio da faixa ideal dele)
const NIVEL_DO_TIER = Object.fromEntries(LOCAIS.filter((l) => l.faixa).map((l) => [l.tier, Math.floor((l.faixa[0] + l.faixa[1]) / 2)]));
// 09/10/2026 (pedido de jogadores): nas zonas onde se mata menos por hora o lendário cai mais, para o tempo até um lendário
// ficar parecido (no nível ideal: ~6,7 h na Rota Inferior, ~9 h nas selvas e ~7,5 h a 8,5 h no Rio, no Dragão e no Barão;
// medido por <scratch>/hud/drop-zonas.mjs). Por tier: Rota Inferior, Rota Superior, Lobos, Azul, Vermelho, Rio, Dragão, Barão
export const LENDARIO_TIER = [1, 1, 1.4, 2.7, 2.8, 2.5, 2.5, 2.3];
const BRUTO = (t) => { const k = ajuste(NIVEL_DO_TIER[t] ?? 1).drop; return { lendario: 4e-5 * 4 ** (t / 7) * k * (LENDARIO_TIER[t] ?? 1), epico: (0.0005 + 0.00015 * t) * k, basico: (0.012 - 0.0005 * t) * k }; };
// chefe: 0,1% de lendário (10x um monstro comum), 5% de épico e 40% de básico
export const DROP_CHEFE = { lendario: 0.001, epico: 0.05, basico: 0.4 };
export function chancesDrop(local, mult = 1) {
  const c = BRUTO(local.tier || 0), l = Math.min(1, c.lendario * mult), e = Math.min(1, c.epico * mult), b = Math.min(1, c.basico * mult);
  return { lendario: l, epico: (1 - l) * e, basico: (1 - l) * (1 - e) * b };
}
// classe: 'ad' (padrão: Darius, Ezreal) ou 'ap' (campeões de magia)
export const itensPorRaridade = (r, local, classe = 'ad') => (classe === 'ap' ? local?.dropsAp?.[r] || POR_CLASSE.ap[r] : local?.drops?.[r] || POR_CLASSE.ad[r]);
export const classeDe = (estado) => (kit(estado).magia ? 'ap' : 'ad');
export function sortearLoot(local, chefe, mult = 1, classe = 'ad') {
  const r = Math.random, t = local.tier || 0, itens = [];
  const pool = (rar) => itensPorRaridade(rar, local, classe);
  if (chefe) {
    for (const rar of ['lendario', 'epico', 'basico']) if (r() < DROP_CHEFE[rar] * mult) itens.push(escolher(pool(rar)));
    return itens;
  }
  const c = BRUTO(t);
  if (r() < c.lendario * mult) itens.push(escolher(pool('lendario')));
  else if (r() < c.epico * mult) itens.push(escolher(pool('epico')));
  else if (r() < c.basico * mult) itens.push(escolher(pool('basico')));
  return itens;
}

const mitigar = (dano, armadura) => dano * (100 / (100 + Math.max(0, armadura)));

function emitir(c, tipo, dados) { c.eventos.push({ tipo, t: c.tempo, ...dados }); }
// na dungeon (p708): a queimadura lembra quem a aplicou, para o dano ir para a conta dele (não aparece em JSON nem no desenho)
function donoQueima(q, c) { if (c.dg) Object.defineProperty(q, 'dono', { value: c, enumerable: false }); return q; }

function gastarMana(estado, custo) {
  if (estado.mana < custo) return false;
  estado.mana -= custo; return true;
}

// aplica um golpe físico de Darius a um inimigo
// (dano mágico ignora a armadura: os monstros não têm resistência mágica)
// RM_MONSTRO: a resistência mágica dos monstros é 60% da armadura (só conta para o dano mágico de Poder de Habilidade)
export const RM_MONSTRO = 0.6;
// ---------- Diferença de nível (10/10/2026, pedido do dono: um nível 23 com lendários matava o Barão em 15 s) ----------
// Monstro mais de NIVEL_DIF.livre níveis acima do jogador bate mais forte e aguenta mais, por nível a mais (com teto e piso).
// Quem caça na própria faixa não sente nada. Vale no Rift e em Runeterra (chefes e guardiões também); a Vilemaw e o PvP, não.
// (a primeira versão, livre 5 / +8% / 2,5x / −5% / 35%, só pesava no Barão: jogadores de nível 23 a 25 continuavam solando o Dragão)
export const NIVEL_DIF = { livre: 4, danoMonstro: 0.35, maxDanoMonstro: 5, danoJogador: 0.12, minDanoJogador: 0.25 };      // 0,15 / 3 / 0,07 até 13/10/2026 (p647: o Yasuo 30 solava o Vazio)
export const difNivel = (estado, m) => Math.max(0, (Number(m?.nivel) || 0) - (estado.nivel || 1) - NIVEL_DIF.livre);
export const fatorDanoMonstro = (estado, m) => { const d = difNivel(estado, m); return d ? Math.min(NIVEL_DIF.maxDanoMonstro, 1 + NIVEL_DIF.danoMonstro * d) : 1; };
export const fatorDanoJogador = (estado, m) => { const d = difNivel(estado, m); return d ? Math.max(NIVEL_DIF.minDanoJogador, 1 - NIVEL_DIF.danoJogador * d) : 1; };
// itens que tiram % da vida do monstro (Liandry, Rei Destruído): a porcentagem conta no máximo sobre TETO_VIDA_ITEM vezes a
// curva de vida do nível (um monstro comum forte); senão, quanto mais vida o monstro (chefe, guardião, furioso), mais o item rendia
export const TETO_VIDA_ITEM = 3;
export const vidaRefItem = (alvo, vida = alvo.hpMax) => Math.min(alvo.refItem ? alvo.refItem * vida / alvo.hpMax : vida, TETO_VIDA_ITEM * CURVA.hp(alvo.nivel || 1));      // na dungeon (p709): sobre a vida que o monstro teria fora dela
function golpear(estado, c, a, alvo, bruto, fonte, { acumula = true, critico = false, magico = false, poder = false, frac = 1 } = {}) {
  if (alvo.hp <= 0) return 0;
  if (alvo.surgindo > 0) return 0;      // Runeterra: o monstro ainda está surgindo (1,5 s sem levar dano)
  // monstro de outro jogador (Runeterra): o servidor calcula o dano e manda para o dono; aqui só avisa o acerto
  // (frac: a parte do golpe da habilidade, como a bolinha da Descarga, 20%; o servidor confere o teto)
  if (alvo.externo) {
    if (fonte !== 'item' && fonte !== 'pet' && fonte !== 'sangue') emitir(c, 'acertoMonstro', { dono: alvo.dono, id: alvo.mid, tecla: fonte, lance: fonte === 'ataque' ? 0 : c.arena?.lancePorTecla?.[fonte] || 0, ...(frac !== 1 ? { f: +frac.toFixed(3) } : {}) });
    return 0;
  }
  if (kit(estado).magia && fonte !== 'ataque' && fonte !== 'item' && fonte !== 'pet' && fonte !== 'sangue') { magico = true; poder = true; }
  const arm = magico ? (poder ? alvo.armadura * RM_MONSTRO * (1 - (a.penMagica || 0)) : 0) : alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura);
  if (poder && fonte !== 'ataque') {                        // efeitos dos itens de mago nas habilidades
    const f = alvo.hp / alvo.hpMax;
    if (a.tem?.('4645') && f < 0.4) bruto *= 1.2;           // Chama Sombria
    if (a.tem?.('3165') && f < 0.5) bruto *= 1.12;          // Morellonomicon
    if (a.tem?.('6653')) alvo.queima = donoQueima({ dps: vidaRefItem(alvo) * 0.015, t: 3 }, c);     // Liandry: queima (com teto em monstro de muita vida)
    if (a.tem?.('3116')) alvo.lento = Math.max(alvo.lento || 0, 1.5);         // Rylai: lentidão
  }
  const d = c.darius;
  let dano = mitigar(bruto, arm) * (1 + (d.grito > 0 ? d.gritoBonus : 0) + 0.01 * d.disciplina + (estado.buffBarao > 0 ? BARAO.dano : 0));
  dano *= (kit(estado).papel?.dano ?? 1) * (LOCAL[estado.local]?.arena ? kit(estado).papel?.arena ?? 1 : 1);      // o papel do campeão (tanque bate menos, a maga bate mais); em Runeterra, o ajuste de lá
  if (critico) dano *= a.danoCritico || 1.75;
  if (alvo.chefe && a.tem?.('3036')) dano *= 1.15;
  if (alvo.dominioAmp) dano *= 1 + alvo.dominioAmp;          // Domínio de Noxus: quanto mais tempo dentro, mais dano leva
  const ezreal = kit(estado).id === 'ezreal', hab = fonte !== 'ataque' && fonte !== 'item' && fonte !== 'pet' && fonte !== 'sangue';
  if (ezreal && hab) dano *= bonusEzreal(estado, c, alvo);
  if (hab && a.danoHab) dano *= 1 + a.danoHab;               // Foco da Katarina (vale também no giro das adagas)
  if (hab && d.absorcao > 0) dano *= 1 + (d.absorcaoBonus || 0) * (d.absorcaoAcum || 0);      // Absorção (Zac): cada gosma pega
  if (d.sombraPronta > 0 && hab && fonte !== 'B') { dano *= 1 + (d.sombraBonus || 0); d.sombraPronta = 0; emitir(c, 'sombraGolpe', { alvo: alvo.id }); }
  if (!c.dg) dano *= fatorDanoJogador(estado, alvo);                  // monstro bem acima do seu nível aguenta mais
  if (alvo.escudoLonge > 0 && kit(estado).distancia) dano *= 1 - alvo.escudoLonge;      // Inquebrável do Braum: segura quem ataca de longe (p663)
  if (alvo.reducaoDano > 0) dano *= 1 - alvo.reducaoDano;      // a fúria do Braum (p663)
  alvo.hp -= dano;
  alvo.golpeOutro = null;                                   // o último golpe agora é seu (ver processarAbates)
  emitir(c, 'dano', { alvo: alvo.id, valor: dano, fonte, critico, magico });
  if (ezreal) marcasEzreal(estado, c, a, alvo, fonte, hab);
  if (a.rouboVida && fonte === 'ataque') {
    const cura = dano * a.rouboVida, falta = a.vida - estado.vida;
    curar(estado, c, a, cura);
    if (a.tem('3072') && cura > falta) d.escudo = Math.min(a.vida * 0.25, (d.escudo || 0) + (cura - falta));
  }
  if (d.furiaS > 0) curar(estado, c, a, dano * d.furiaRoubo);
  if (acumula && kit(estado).hemorragia) aplicarHemorragia(c, alvo);
  return dano;
}

// Ezreal: a Arrogância do Explorador e a Mira do Explorador (quanto mais longe o alvo, mais dano; de longe, pressa)
function bonusEzreal(estado, c, alvo) {
  const d = c.darius, HD = habDe(estado).D, rD = estado.ranks.D;
  let k = 1 + (d.arrogancia > 0 ? d.arrogBonus || 0 : 0);
  if (HD?.longe && rD) {
    const A = LOCAL[estado.local]?.arena ? c.arena : null;
    // em Runeterra: de 2 a 7 tiles; no Rift, pelo tempo que o monstro ainda leva para chegar
    const f = A && alvo.x != null ? Math.min(1, Math.max(0, (Math.hypot(alvo.x - A.x, alvo.y - A.y) - 2) / 5)) : Math.min(1, Math.max(0, alvo.chegada || 0));
    k *= 1 + HD.longe[rD - 1] * f;
    if (f >= 0.9 && !(d.pressa > 0)) { d.pressa = 2; d.folego = Math.min(FOLEGO_MAX, (d.folego ?? FOLEGO_MAX) + 0.25); }
  }
  return k;
}
// Sobrecarga Arcana (marca que explode no acerto seguinte) e Apogeu da Manopla (3 habilidades diferentes no mesmo monstro)
function marcasEzreal(estado, c, a, alvo, fonte, hab) {
  const d = c.darius, HK = habDe(estado), r = estado.ranks;
  if (alvo.hp <= 0) return;
  if (d.sobrecarga > 0 && r.F && fonte !== 'F' && fonte !== 'N') {
    if (alvo.arcanaAte > c.tempo) {
      alvo.arcanaAte = 0;
      emitir(c, 'arcanaExplode', { alvo: alvo.id });
      golpear(estado, c, a, alvo, HK.F.dano(r.F, a), 'F', { acumula: false });
      estado.mana = Math.min(a.mana, estado.mana + a.mana * HK.F.manaExplosao);
    } else if (hab) { alvo.arcanaAte = c.tempo + 4; emitir(c, 'arcanaMarca', { alvo: alvo.id }); }
  }
  if (d.apogeu > 0 && r.N && hab && fonte !== 'F' && fonte !== 'N' && fonte !== 'D' && alvo.hp > 0) {
    alvo.rastros ??= [];
    if (alvo.rastros.includes(fonte)) return;
    alvo.rastros.push(fonte);
    if (alvo.rastros.length < 3) { emitir(c, 'rastro', { alvo: alvo.id, n: alvo.rastros.length }); return; }
    alvo.rastros = [];
    emitir(c, 'ressonancia', { alvo: alvo.id });
    let bruto = HK.N.dano(r.N, a);
    if (alvo.chefe) bruto += Math.min(4 * a.ad, HK.N.chefePct[r.N - 1] * alvo.hpMax);      // em chefe, um pedaço da vida máxima (com teto)
    golpear(estado, c, a, alvo, bruto, 'N', { acumula: false });
  }
}

function aplicarHemorragia(c, alvo) {
  const antes = alvo.acumulos;
  alvo.acumulos = c.darius.poder > 0 ? 5 : Math.min(5, alvo.acumulos + 1);
  alvo.tSangue = 5;
  if (alvo.acumulos === 5 && antes < 5 && c.darius.poder <= 0) {
    c.darius.poder = 5;
    emitir(c, 'poder', {});
  }
}

export const CURA_PVP = 0.65;      // curas em luta contra jogador (habilidades, roubo de vida, Sede); a poção tem o POCAO_PVP (p640)
function curar(estado, c, a, valor) {
  const mult = (a.tem('3065') ? 1.25 : 1) * (c.arena?.combatePvp > 0 ? CURA_PVP : 1);
  const antes = estado.vida;
  estado.vida = Math.min(a.vida, estado.vida + valor * mult);
  if (estado.vida - antes > 1) emitir(c, 'cura', { valor: estado.vida - antes });
}

// ---------- Poções ----------
function escolherPocao(estado, tipo, falta) {
  const disp = Object.entries(POCOES).filter(([k, p]) => p.tipo === tipo && estado.pocoes[k] > 0 && estado.nivel >= p.nivel)
    .sort((x, y) => y[1].cura - x[1].cura);
  if (!disp.length) return null;
  const pref = tipo === 'vida' ? estado.auto?.pocaoVida : estado.auto?.pocaoMana;      // a poção escolhida no automático (p695)
  if (pref && disp.some(([k]) => k === pref)) return pref;
  return (disp.find(([, p]) => p.cura <= falta * 1.2) || disp[disp.length - 1])[0];
}
export function usarPocao(estado, c, chave) {
  const p = POCOES[chave], d = c.darius;
  if (!p || estado.pocoes[chave] <= 0 || d.timers.pocao > 0 || d.morto > 0 || estado.nivel < p.nivel) return false;
  const a = atributos(estado), pvp = c.arena?.combatePvp > 0;
  estado.pocoes[chave]--;
  d.timers.pocao = pvp ? POCAO_PVP.exaustao : EXAUSTAO;
  if (p.tipo === 'vida') { const antes = estado.vida; estado.vida = Math.min(a.vida, estado.vida + p.cura * (pvp ? POCAO_PVP.cura : 1)); emitir(c, 'pocao', { chave, valor: estado.vida - antes }); }
  else { const antes = estado.mana; estado.mana = Math.min(a.mana, estado.mana + p.cura); emitir(c, 'pocao', { chave, valor: estado.mana - antes, mana: true }); }
  if (estado.pocoes[chave] === 0) emitir(c, 'semPocao', { chave, nome: p.nome });
  return true;
}
export const temPocao = (estado, tipo) => Object.entries(POCOES).some(([k, p]) => p.tipo === tipo && estado.pocoes[k] > 0 && estado.nivel >= p.nivel);
function usarPocoesAuto(estado, c, a) {
  if (!ehVip(estado) && !c.pocaoAuto) return;          // sem VIP, as poções são usadas clicando
  if (c.darius.timers.pocao > 0) return;
  const cfg = estado.auto;
  if (cfg.vida && estado.vida < a.vida * cfg.limiarVida) {
    const k = escolherPocao(estado, 'vida', a.vida - estado.vida);
    if (k && usarPocao(estado, c, k)) return;
  }
  if (cfg.mana && !kit(estado).fluxo && !kit(estado).semMana && estado.mana < a.mana * cfg.limiarMana) {
    const k = escolherPocao(estado, 'mana', a.mana - estado.mana);
    if (k) usarPocao(estado, c, k);
  }
}

// o que os golpes usam: dano de ataque com os bônus da hora (Vontade do General, W do Darius) e o poder com o Farol
function efetivo(estado, d, a) {
  const HD = habDe(estado).D, rD = estado.ranks.D;
  const vontade = HD?.vontade && rD ? HD.vontade[rD - 1] * Math.max(0, 1 - estado.vida / a.vida) : 0;
  return { ...a, ad: (a.ad + (d.poder > 0 ? bonusPoder(estado.nivel) : 0)) * (1 + vontade), ap: (a.ap || 0) * (1 + (d.farol > 0 ? d.farolPoder || 0 : 0)),
    penArmadura: d.suspiro > 0 ? 1 - (1 - a.penArmadura) * (1 - (d.suspiroPen || 0)) : a.penArmadura };
}
export const bonusPoder = (nivel) => 30 + (200 * (Math.min(nivel, 18) - 1)) / 17 + 4 * Math.max(0, nivel - 18);

export function passo(estado, c, dt) {
  const a = atributos(estado);
  const d = c.darius;
  c.tempo += dt;
  estado.relogio = (estado.relogio || 0) + dt;
  estado.tempoJogo = (estado.tempoJogo || 0) + dt;      // o tempo que o jogo andou: o servidor compara com o relógio dele (speed hack)

  // morto: espera renascer na Fonte (na Arena, espera a próxima rodada, que o servidor manda: renascerArena)
  if (d.morto > 0) {
    if (LOCAL[estado.local]?.aram || c.dg) return;      // na dungeon fica caído até o fim do estágio (p663)
    d.morto -= dt;
    if (d.morto <= 0) {
      estado.local = 'fonte'; c.inimigos = [];
      estado.vida = a.vida * 0.1; estado.mana = 0;
      emitir(c, 'renasceu', {});
    }
    return;
  }

  if (estado.buffBarao > 0) estado.buffBarao = Math.max(0, estado.buffBarao - dt);
  // regeneração natural (lenta — para curar de verdade, fale com a Soraka ou use poções)
  const regenBarao = estado.buffBarao > 0 ? 1 + BARAO.regen : 1;
  estado.vida = Math.min(a.vida, estado.vida + a.regen * regenBarao * dt);
  estado.mana = Math.min(a.mana, estado.mana + a.regenMana * regenBarao * dt);
  if (d.queimando > 0) {
    d.queimando = Math.max(0, d.queimando - dt);
    receberDano(estado, c, a, d.queimaDano * dt, true);
    if (d.morto > 0) return;
  }
  for (const k of Object.keys(d.recargas)) d.recargas[k] = Math.max(0, d.recargas[k] - dt);
  for (const k of Object.keys(d.timers)) d.timers[k] = Math.max(0, d.timers[k] - dt);
  if (d.invulneravel > 0) d.invulneravel = Math.max(0, d.invulneravel - dt);
  d.poder = Math.max(0, d.poder - dt);
  d.furia = Math.max(0, d.furia - dt);
  d.grito = Math.max(0, d.grito - dt);
  d.forca = Math.max(0, (d.forca || 0) - dt);            // passiva do Ezreal
  if (d.forca <= 0) d.forcaAcum = 0;
  d.furiaS = Math.max(0, d.furiaS - dt);
  d.banho = Math.max(0, (d.banho || 0) - dt);
  if (d.arrogancia > 0) d.arrogancia = Math.max(0, d.arrogancia - dt);           // extras do Ezreal
  if (d.sobrecarga > 0) d.sobrecarga = Math.max(0, d.sobrecarga - dt);
  if (d.pressa > 0) d.pressa = Math.max(0, d.pressa - dt);
  if (d.apogeu > 0) { d.apogeu = Math.max(0, d.apogeu - dt); if (d.apogeu <= 0) for (const i of c.inimigos) i.rastros = null; }
  if (d.estandarte <= 0) d.estandarteDef = 0;
  if (d.estandarte > 0) {
    d.estandarte = Math.max(0, d.estandarte - dt);
    estado.vida = Math.min(a.vida, estado.vida + a.vida * d.estandarteCura * dt);
    estado.mana = Math.min(a.mana, estado.mana + a.mana * (d.farolMana || 0.02) * dt);
  }
  if (d.farol > 0) d.farol = Math.max(0, d.farol - dt);
  for (const k of ['vento', 'ventania', 'inquieta', 'fantasma', 'suspiro', 'eqCombo', 'eAcumT', 'qCargaT']) if (d[k] > 0) d[k] = Math.max(0, d[k] - dt);      // Yasuo
  for (const k of ['sede', 'veneno', 'sinistra', 'sombraPronta', 'pegaCd']) if (d[k] > 0) d[k] = Math.max(0, d[k] - dt);      // Katarina
  for (const k of ['bravataT', 'diamante']) if (d[k] > 0) d[k] = Math.max(0, d[k] - dt);      // Taric
  for (const k of ['membrana', 'absorcao', 'pegaGosmaCd']) if (d[k] > 0) d[k] = Math.max(0, d[k] - dt);      // Zac
  if (!(d.absorcao > 0)) d.absorcaoAcum = 0;
  if (d.dividido > 0) { d.dividido = Math.max(0, d.dividido - dt); if (d.dividido <= 0) reunirZac(estado, c, a); }      // Divisão Celular: os pedaços se juntam
  if (!(d.bravataT > 0)) d.bravata = 0;
  if (!(d.sinistra > 0)) d.sinistraAcum = 0;
  if (!(d.inquieta > 0)) d.inquietaAcum = 0;
  if (!(d.eAcumT > 0)) d.eAcum = 0;
  if (!(d.qCargaT > 0)) d.qCarga = 0;

  // voltando para a base
  if (d.recall > 0) {
    d.recall -= dt;
    if (d.recall <= 0) { d.recall = 0; d.disciplina = 0; estado.local = 'fonte'; c.inimigos = []; emitir(c, 'chegouBase', {}); return; }
  }

  const local = LOCAL[estado.local];
  if (local.base) return;       // na Fonte não há combate (e o campeão fica parado até o jogador mandar caçar)

  usarPocoesAuto(estado, c, a);
  // VIP: acabaram as poções de vida ou a mochila encheu → volta para a Fonte e fica lá parado (para não morrer nem perder saque)
  if (rotinaAtiva(estado) && !local.arena && !c.dg && estado.rotina.pocoes && d.recall <= 0 && !temPocao(estado, 'vida')) {
    voltarBase(estado, c); emitir(c, 'rotinaVolta', { motivo: 'pocoes' });
  }
  // rotina: mochila cheia também é motivo para voltar
  else if (rotinaAtiva(estado) && !local.arena && !c.dg && estado.rotina.mochila && mochilaCheia(estado) && d.recall <= 0) {
    voltarBase(estado, c); emitir(c, 'rotinaVolta', { motivo: 'mochila' });
  }

  if (local.arena) { motorArena?.(estado, c, dt, a); return; }

  // novo grupo de monstros
  if (!c.inimigos.length) {
    if (c.dg) return;      // na dungeon quem manda as ondas é ela (p663)
    c.respawn -= dt;
    if (c.respawn > 0) return;
    c.inimigos = gerarGrupo(local, ehNoite(estado), estado.nivel);
    // o atirador começa a acertar de longe: os monstros levam mais tempo para alcançá-lo
    for (const i of c.inimigos) i.chegada += kit(estado).chegadaExtra || 0;
    emitir(c, 'grupo', { chefe: c.inimigos[0].chefe, nome: c.inimigos[0].nome, furioso: c.inimigos.find((i) => i.furioso)?.nome });
  }

  const adEfetivo = efetivo(estado, d, a);
  adEfetivo.bonusAd = adEfetivo.ad - a.baseAd;

  // sangramento guardado pela Dança da Morte
  if (d.sangramentoRecebido.length) {
    let total = 0;
    d.sangramentoRecebido = d.sangramentoRecebido.filter((s) => {
      const parte = Math.min(s.resto, (s.total / 3) * dt); s.resto -= parte; total += parte; return s.resto > 0.01;
    });
    receberDano(estado, c, a, total, true);
    if (d.morto > 0) return;
  }

  const K = kit(estado), HK = K.hab;
  const vivos = c.inimigos.filter((i) => i.hp > 0);
  if (K.fluxo && vivos.length) encherFluxo(estado, a, HK.P.fluxoSeg * dt);      // Yasuo: lutando, o Fluxo enche
  if (!c.dg) for (const i of vivos) i.chegada = Math.max(0, i.chegada - dt);      // na dungeon os monstros andam uma vez só (p663)
  const prontos = vivos.filter((i) => i.chegada <= 0);
  // corpo a corpo luta com quem já chegou; o atirador acerta o mais próximo, mesmo se ainda estiver chegando
  const alvo = K.distancia ? [...vivos].sort((x, y) => x.chegada - y.chegada)[0] : prontos[0];

  tickInimigos(estado, c, a, adEfetivo, vivos, dt);
  if (K.adagas) katarinaPasso(estado, c, a, adEfetivo, vivos, dt);
  if (K.id === 'taric') taricPasso(estado, c, a, adEfetivo, vivos, dt);
  if (K.gosmas) zacPasso(estado, c, a, adEfetivo, vivos, dt);

  // Lux: o Tornado de Fogo queima o grupo a cada meio segundo; a varinha da Barreira Prismática volta e dá o escudo de novo
  if (d.tornado) {
    d.tornado.t -= dt; d.tornado.tick -= dt;
    if (d.tornado.tick <= 0) {
      d.tornado.tick += 0.5;
      for (const i of vivos) if (i.hp > 0) { golpear(estado, c, adEfetivo, i, d.tornado.bruto, 'N', { acumula: false }); i.lento = Math.max(i.lento || 0, 0.6); }
    }
    if (d.tornado.t <= 0) d.tornado = null;
  }
  if (d.meteoros?.length) d.meteoros = d.meteoros.filter((mt) => {
    mt.t -= dt;
    if (mt.t > 0) return true;
    const HKm = habDe(estado).M, alvoM = c.inimigos.find((i) => i.id === mt.alvo && i.hp > 0) || vivos.find((i) => i.hp > 0);
    if (!alvoM) return false;
    golpear(estado, c, adEfetivo, alvoM, mt.bruto, 'M', { acumula: false }); iluminar(estado, alvoM);
    // a explosão pega até 2 vizinhos (no Rift o grupo está junto)
    for (const i of vivos.filter((o) => o !== alvoM && o.hp > 0).slice(0, 2)) golpear(estado, c, adEfetivo, i, mt.bruto * HKm.respingo, 'M', { acumula: false });
    return false;
  });
  if (d.dominio) {               // Domínio de Noxus (Darius)
    d.dominio.t -= dt; d.dominio.tick -= dt;
    const HN = habDe(estado).N, rN = estado.ranks.N || 1;
    if (d.dominio.tick <= 0 && HN.ampMax) {
      d.dominio.tick += 0.5;
      for (const i of vivos) {
        if (i.hp <= 0 || i.chegada > 1.5) continue;
        i.dominioT = (i.dominioT || 0) + 0.5;
        i.dominioAmp = Math.min(HN.ampMax, (i.dominioT / 6) * HN.ampMax);
        i.lento = Math.max(i.lento || 0, 0.6);
        golpear(estado, c, adEfetivo, i, HN.dano(rN, adEfetivo), 'N');
        if (i.hp <= 0) { curar(estado, c, a, (a.vida - estado.vida) * HN.curaAbate); d.dominio.cresceu = (d.dominio.cresceu || 0) + 1; emitir(c, 'dominioCresce', { n: d.dominio.cresceu }); }
      }
    }
    if (d.dominio.t <= 0) { d.dominio = null; d.inabalavel = false; for (const i of c.inimigos) { i.dominioAmp = 0; i.dominioT = 0; } }
  }
  if (d.danca) {                 // Dança das Mil Lâminas (Yasuo): um corte a cada quarto de segundo, em quem estiver por perto
    d.danca.t -= dt; d.danca.tick -= dt;
    while (d.danca.tick <= 0 && d.danca.n > 0) {
      d.danca.tick += d.danca.cada; d.danca.n--;
      const vs = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5), i = vs[Math.floor(Math.random() * vs.length)];
      if (i) { golpear(estado, c, adEfetivo, i, d.danca.bruto, 'N', { acumula: false, critico: Math.random() < a.critico }); emitir(c, 'dancaCorte', { alvo: i.id }); }
    }
    if (d.danca.t <= 0) d.danca = null;
  }
  if (d.convergencia) {          // Convergência Radiante: a explosão
    d.convergencia.t -= dt;
    if (d.convergencia.t <= 0) {
      d.convergencia = null;
      const HT = habDe(estado).T, rT = estado.ranks.T || 1, presos = prontos.filter((i) => i.hp > 0);
      emitir(c, 'convergencia', { alvos: presos.map((i) => i.id) });
      for (const i of presos) {
        if (i.marca > 0) detonarOrbe({ estado, c, a, adEfetivo }, i);
        golpear(estado, c, adEfetivo, i, HT.dano(rT, adEfetivo), 'T', { acumula: false });
        i.atordoado = Math.max(i.atordoado || 0, HT.prende); iluminar(estado, i);
      }
    }
  }
  if (d.varinha) {
    d.varinha.t -= dt;
    if (d.varinha.t <= 0) { d.escudo = Math.min(2 * d.varinha.valor, (d.escudo || 0) + d.varinha.valor); emitir(c, 'varinhaVolta', { escudo: Math.round(d.varinha.valor) }); d.varinha = null; }
  }
  // Passagem Shurimane (Ezreal): o portal espera alguém alcançar o Ezreal; então ele atravessa e dispara
  if (d.portal) {
    d.portal.t -= dt; d.portal.pronto -= dt;
    if (d.portal.pronto <= 0 && prontos.some((i) => i.hp > 0)) {
      const HB = HK.B, rB = estado.ranks.B || 1, afasta = HB.afasta[rB - 1] + (HB.iscaSegura || 0);      // a cópia segura os monstros mais um pouco
      for (const i of vivos) if (!i.chefe || i.chegada <= 0) i.chegada = Math.max(i.chegada, afasta * (i.chefe ? 0.5 : 1));
      if (HB.isca) d.isca = { t: HB.isca, tick: 0.5 };
      const mira = vivos.filter((i) => i.hp > 0).sort((x, y) => (y.marca > 0) - (x.marca > 0) || x.chegada - y.chegada)[0];
      emitir(c, 'portalAtravessa', { alvo: mira?.id });
      if (mira) {
        golpear(estado, c, adEfetivo, mira, HB.dano(rB, adEfetivo), 'B', { acumula: false });
        if (mira.marca > 0) detonarOrbe({ estado, c, a, adEfetivo }, mira);
        acertouHabilidade(estado, c);
      }
      d.portal = null;
    } else if (d.portal.t <= 0) { d.portal = null; emitir(c, 'portalFecha', {}); }
  }
  // a cópia de energia que fica no portal: atira a cada meio segundo
  if (d.isca) {
    d.isca.t -= dt; d.isca.tick -= dt;
    if (d.isca.tick <= 0) {
      d.isca.tick += 0.5;
      const vs = vivos.filter((i) => i.hp > 0), i = vs[Math.floor(Math.random() * vs.length)];
      if (i) { emitir(c, 'iscaTiro', { alvo: i.id }); golpear(estado, c, adEfetivo, i, HK.B.iscaTiro[(estado.ranks.B || 1) - 1] * adEfetivo.ad, 'B', { acumula: false }); }
    }
    if (d.isca.t <= 0) { d.isca = null; emitir(c, 'iscaSome', {}); }
  }
  // Tiro do Explorador (Ezreal): o disparo pula de monstro em monstro, cada salto mais forte
  if (d.ricochetes?.length) d.ricochetes = d.ricochetes.filter((rc) => {
    rc.t -= dt;
    if (rc.t > 0) return true;
    const HM = HK.M, rM = estado.ranks.M || 1;
    const alvoR = c.inimigos.find((i) => i.id === rc.alvo && i.hp > 0) || vivos.find((i) => i.hp > 0);
    if (!alvoR) return false;
    const bruto = HM.dano(rM, adEfetivo) * (1 + HM.cresce) ** rc.k;
    golpear(estado, c, adEfetivo, alvoR, bruto, 'M', { acumula: false });
    if (alvoR.marca > 0) detonarOrbe({ estado, c, a, adEfetivo }, alvoR);
    if (rc.k === 0) acertouHabilidade(estado, c);
    const prox = vivos.filter((i) => i.hp > 0 && i !== alvoR);
    if (rc.k < HM.saltos && prox.length) {
      const n = prox[Math.floor(Math.random() * prox.length)];
      emitir(c, 'ricochete', { de: alvoR.id, para: n.id, k: rc.k + 1 });
      rc.alvo = n.id; rc.k++; rc.t = 0.12;
      return true;
    }
    if (alvoR.chefe) {           // o último acerto foi num chefe: explode em área
      emitir(c, 'ricocheteExplode', { alvo: alvoR.id });
      for (const i of vivos) if (i.hp > 0) golpear(estado, c, adEfetivo, i, bruto * HM.explosao, 'M', { acumula: false });
    }
    return false;
  });
  // machados do Draven voltando (e as estrelas da Lux caindo)
  d.machados = d.machados.filter((m) => {
    m.t -= dt;
    if (m.t > 0) return true;
    const alvoM = c.inimigos.find((i) => i.id === m.alvo && i.hp > 0) || prontos.find((i) => i.hp > 0);
    if (alvoM) golpear(estado, c, adEfetivo, alvoM, m.bruto, 'M');
    return false;
  });

  // canalizando o recall o Darius não luta
  if (alvo && d.recall <= 0 && !(d.dividido > 0)) {
    const r = estado.ranks;
    // só as habilidades que estão na barra são usadas
    const pode = (t) => estado.barra.includes(t) && r[t] && d.recargas[t] <= 0 && estado.mana >= HK[t].custo[r[t] - 1];
    const usar = (t, extra = {}, recarga = HK[t].recarga[r[t] - 1]) => {
      gastarMana(estado, HK[t].custo[r[t] - 1]);
      d.recargas[t] = recarga * (1 - a.reducaoRecarga);
      emitir(c, 'habilidade', { tecla: t, ...extra });
      d.trindade = lamina(a);
      aoUsarHabilidade(estado, c, a, adEfetivo, vivos);
    };
    const chegando = vivos.filter((i) => i.chegada > 0);
    const alcancaveis = K.distancia ? vivos : prontos;     // quem as habilidades de área e de execução conseguem acertar
    const ctx = { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alcancaveis, alvo, pode, usar };
    const acoes = { ...acoesComuns(ctx), ...(K.id === 'lux' ? acoesLux(ctx) : K.id === 'ezreal' ? acoesEzreal(ctx) : K.id === 'yasuo' ? acoesYasuo(ctx) : K.id === 'katarina' ? acoesKatarina(ctx) : K.id === 'taric' ? acoesTaric(ctx) : K.id === 'zac' ? acoesZac(ctx) : acoesDarius(ctx)) };
    if (d.canalR > 0) {        // Barragem Incendiária: carregando a luva, parado e sem atacar
      d.canalR -= dt;
      if (d.canalR <= 0) (K.id === 'lux' ? dispararCentelha : dispararBarragem)(ctx);
    } else if (!d.lotus && !d.tempestade && !d.quique) for (const t of K.ordem) acoes[t]?.();
    // Dragãozinho: bola de fogo a cada 2,5s; Aranhinha: mordida a cada 3s
    const petAtq = MASCOTES[estado.mascote];
    if (petAtq?.ataque) {
      const iv = petAtq.intervalo || 2.5;
      d.timers.mascote = (d.timers.mascote ?? iv);
      if (d.timers.mascote <= 0 && alvo.hp > 0) {
        d.timers.mascote = iv;
        golpear(estado, c, adEfetivo, alvo, basePet(estado, a) * petAtq.ataque(nivelMascote(estado)), 'pet', { acumula: false });
        emitir(c, 'mascoteAtaque', { alvo: alvo.id, pet: estado.mascote });
      }
    }

    // ataque básico
    avancarAtaque(c, dt);
    if (d.ataque <= 0 && alvo.hp > 0 && !(d.canalR > 0) && !d.lotus && !d.tempestade && !d.quique) golpeBasico(ctx, alvo);
  }

  // mecânicas dos chefes
  if (!c.dg) for (const i of prontos) if (i.chefe && i.hp > 0 && d.morto <= 0) mecanicaChefe(estado, c, a, i, dt);      // na dungeon, as mecânicas são dela (p663)
  if (d.morto > 0) return;

  if (K.kite) kitar(c, K.kite, prontos, dt);

  // inimigos atacam
  for (const i of prontos) {
    if (i.hp <= 0 || d.morto > 0 || i.atordoado > 0 || i.carregando > 0 || i.chegada > 0 || (c.dg && i.foco !== c.dg.id)) continue;      // na dungeon cada monstro bate em quem escolheu (p663)
    inimigoAtaca(estado, c, a, i, dt);
  }
  if (d.morto > 0) return;

  if (c.dg) { for (const i of c.inimigos) if (i.hp <= 0 && !i.morto) { i.morto = true; emitir(c, 'abate', { alvo: i.id, nome: i.nome, dungeon: true }); } return; }      // dungeon: o prêmio é o baú do fim (p663)
  processarAbates(estado, c, a, local);
  if (c.inimigos.length && c.inimigos.every((i) => i.morto)) { c.inimigos = []; c.respawn = 1.5; }
}

// Hemorragia (dano ao longo do tempo) e os efeitos que passam com o tempo nos inimigos
export const SOLAR = { base: 3, porNivel: 0.5, vida: 0.003, raio: 2.2 };      // queima da Égide de Fogo Solar, por segundo (p598; um terço no p598b)
function tickInimigos(estado, c, a, adEfetivo, vivos, dt) {
  const danoSangue = (13 + 0.3 * adEfetivo.bonusAd + 4 * estado.nivel) / 5;
  // Égide de Fogo Solar (p598): a cada 1 s queima os monstros encostados (no Rift os que já chegaram; em Runeterra até SOLAR.raio)
  if (a.tem?.('3068') && !(c.darius.morto > 0)) {
    c.darius.solarT = (c.darius.solarT || 0) + dt;
    if (c.darius.solarT >= 1) {
      c.darius.solarT -= 1;
      const dano = SOLAR.base + SOLAR.porNivel * estado.nivel + SOLAR.vida * a.vida, A = c.arena;
      for (const i of vivos) if (i.hp > 0 && !i.externo && (A ? Math.hypot(i.x - A.x, i.y - A.y) <= SOLAR.raio : i.chegada <= 0)) golpear(estado, c, adEfetivo, i, dano, 'item', { acumula: false, magico: true });
    }
  }
  if (c.dg && !c.dg.principal) return;      // na dungeon os efeitos nos monstros passam uma vez por passo (p663)
  for (const i of vivos) {
    if (i.surgindo > 0) i.surgindo = Math.max(0, i.surgindo - dt);
    if (i.acumulos > 0 && i.tSangue > 0) {
      i.tSangue -= dt;
      const dano = mitigar(danoSangue * i.acumulos * dt, i.armadura * (1 - a.penArmadura));
      i.hp -= dano;
      i.sangueAcum = (i.sangueAcum || 0) + dano;
      if (i.sangueAcum > 25) { emitir(c, 'dano', { alvo: i.id, valor: i.sangueAcum, fonte: 'sangue' }); i.sangueAcum = 0; }
      if (i.tSangue <= 0) i.acumulos = 0;
    }
    i.lento = Math.max(0, i.lento - dt);
    if (i.queima?.t > 0 && i.hp > 0) {      // Liandry e veneno: a queima tira vida por alguns segundos e o número aparece aos poucos
      const q = Math.min(i.hp, i.queima.dps * dt); i.queima.t -= dt; i.hp -= q; i.queimaAcum = (i.queimaAcum || 0) + q; i.queimaSeg = (i.queimaSeg || 0) + dt;
      if (i.queimaSeg >= 0.5 || i.queima.t <= 0 || i.hp <= 0) { emitir(i.queima.dono || c, 'dano', { alvo: i.id, valor: Math.round(i.queimaAcum), fonte: 'queima' }); i.queimaAcum = 0; i.queimaSeg = 0; }      // na dungeon, na conta de quem aplicou (p708)      // um número a cada meio segundo
    }
    i.atordoado = Math.max(0, (i.atordoado || 0) - dt);
    if (i.noAr > 0) i.noAr = Math.max(0, i.noAr - dt);      // jogado para o alto (Yasuo): fica atordoado enquanto está no ar
    i.marca = Math.max(0, (i.marca || 0) - dt);            // orbe do Fluxo Essencial
  }
}

// o relógio do ataque básico (bônus de velocidade da Fúria, da passiva do Ezreal e da Dançarina Fantasma)
function avancarAtaque(c, dt) {
  const d = c.darius;
  d.valsa = Math.max(0, (d.valsa || 0) - dt); if (d.valsa <= 0) d.valsaAcum = 0;     // Dançarina Fantasma
  d.ataque -= dt * (1 + (d.furia > 0 ? 0.08 : 0) + 0.1 * (d.forcaAcum || 0) + 0.06 * (d.valsaAcum || 0)
    + (d.ventania > 0 ? d.ventaniaVa || 0 : 0) + (d.sinistra > 0 ? (d.sinistraAcum || 0) * (d.sinistraVa || 0) : 0) + (d.sede > 0 ? d.sedeVa || 0 : 0) + (d.inquieta > 0 ? (d.inquietaAcum || 0) * (d.inquietaVa || 0) : 0) + (d.bravata > 0 ? d.bravataVa || 0 : 0));
}

// um ataque básico com todos os efeitos de item; ctx.alcancaveis = quem o campeão alcança (para os itens de área)
// Lâmina Encantada: quanto do dano base o ataque depois de uma habilidade ganha (Força da Trindade 2x, Fulgor 1x)
export const lamina = (a) => (a.tem('3078') ? 2 : a.tem('3057') ? 1 : 0);
function golpeBasico(ctx, alvo) {
  const { estado, c, a, d, r, HK, adEfetivo } = ctx;
  d.ataque = 1 / a.velAtaque;
  let bruto = adEfetivo.ad, fonte = 'ataque';
  if (alvo.marca > 0) detonarOrbe(ctx, alvo);
  if (d.banho > 0 && HK.F?.vidaPerdida) {            // Banho de Sangue: dano pela vida que falta ao alvo; cura se ele sangra
    const rF = estado.ranks.F || 1;
    bruto += Math.min(1.5 * adEfetivo.ad, HK.F.vidaPerdida[rF - 1] * Math.max(0, alvo.hpMax - alvo.hp));
    if (alvo.acumulos > 0) curar(estado, c, a, a.vida * HK.F.curaSangue[rF - 1]);
  }
  if (d.sede > 0 && HK.G?.curaSede) {               // Sede de Sangue (Katarina): corta de novo com dano mágico e cura
    const v = golpear(estado, c, adEfetivo, alvo, HK.G.dano(estado.ranks.G || 1, adEfetivo), 'G', { acumula: false });
    curar(estado, c, a, v * HK.G.curaSede);
  }
  if (d.veneno > 0) envenenar(estado, c, adEfetivo, alvo);
  if (d.lich && a.tem('3100')) { d.lich = false; golpear(estado, c, adEfetivo, alvo, 0.75 * (a.ap || 0), 'item', { acumula: false, magico: true, poder: true }); }
  if (d.wPronto) { bruto = HK.W.dano(r.W, adEfetivo); fonte = 'W'; d.wPronto = false; alvo.lento = 2; d.trindade = d.trindade || lamina(a); }
  if (d.bravata > 0 && HK.P?.bravata) {               // Bravata (Taric): dano mágico extra e as recargas andam 1 s
    d.bravata--;
    golpear(estado, c, adEfetivo, alvo, HK.P.dano(estado.nivel, adEfetivo) * (LOCAL[estado.local]?.arena ? HK.P.emRuneterra || 1 : 1), 'P', { acumula: false });      // em Runeterra as habilidades saem mais vezes
    for (const tk of Object.keys(d.recargas)) d.recargas[tk] = Math.max(0, d.recargas[tk] - HK.P.reduz * (tk === 'Q' ? HK.P.reduzQ : 1));      // a Q (cura) anda menos
    estado.mana = Math.min(a.mana, estado.mana + a.mana * (HK.P.manaGolpe || 0));
    emitir(c, 'bravata', { alvo: alvo.id, resta: d.bravata });
  }
  if (d.trindade) { bruto += d.trindade * a.baseAd; d.trindade = 0; }
  if (a.tem('3742') && d.timers.couraca <= 0) { bruto += 40; d.timers.couraca = 4; }
  const ceu = a.tem('6610') && !alvo.tocado;          // Céu Dividido: o primeiro ataque em cada inimigo é crítico
  const critico = ceu || Math.random() < a.critico;
  alvo.tocado = true;
  if (a.tem('3153')) bruto += 0.05 * vidaRefItem(alvo, alvo.hp);         // Espada do Rei Destruído: % da vida atual (com teto em monstro de muita vida)
  golpear(estado, c, adEfetivo, alvo, bruto, fonte, { critico });
  if (ceu) curar(estado, c, a, (a.vida - estado.vida) * 0.06);
  if (a.tem('3071')) alvo.reducaoArmadura = Math.min(0.3, alvo.reducaoArmadura + 0.06);
  if (a.tem('3044')) d.furia = 2;
  if (a.tem('3046')) { d.valsaAcum = Math.min(5, (d.valsaAcum || 0) + 1); d.valsa = 3; }
  // quem o campeão alcança: colados (corpo a corpo) ou todos do grupo (à distância)
  const alcance = ctx.alcancaveis.filter((i) => i.hp > 0), outros = alcance.filter((i) => i !== alvo);
  const HDy = HK.D, rDy = estado.ranks.D;
  if (critico && HDy?.inquieta && rDy) { d.inquietaAcum = Math.min(HDy.acumMax, (d.inquietaAcum || 0) + 1); d.inquieta = HDy.duracaoInquieta; d.inquietaVa = HDy.inquieta[rDy - 1]; }
  if (d.fantasma > 0 && HK.F?.pctCorte) {
    const cortes = outros.slice(0, HK.F.alvosCorte);
    for (const i of cortes) golpear(estado, c, adEfetivo, i, bruto * d.fantasmaPct, 'F', { acumula: false, critico: Math.random() < a.critico });
    if (cortes.length) emitir(c, 'corteFantasma', { alvos: cortes.map((i) => i.id) });
  }
  // Furacão de Runaan: para quem ataca de longe (o grupo todo ao alcance) as flechas extras causam 15% e não dão crítico (p603; eram 55%)
  if (a.tem('3085')) { const longe = kit(estado).distancia; for (const i of outros.slice(0, 2)) golpear(estado, c, adEfetivo, i, (longe ? 0.15 : 0.55) * bruto, 'item', { acumula: false, critico: !longe && Math.random() < a.critico }); }
  if (a.tem('6631') && d.timers.quebra <= 0) { for (const i of alcance) golpear(estado, c, adEfetivo, i, 0.8 * adEfetivo.ad, 'item', { acumula: false }); d.timers.quebra = 5; }
  if (a.tem('3074')) for (const i of outros) golpear(estado, c, adEfetivo, i, 0.4 * adEfetivo.ad, 'item', { acumula: false });
  if (a.tem('3748')) for (const i of alcance) golpear(estado, c, adEfetivo, i, 0.015 * a.vida, 'item', { acumula: false });
}

// o relógio do ataque de um inimigo; quando zera, ele bate (ou o campeão esquiva)
function inimigoAtaca(estado, c, a, i, dt) {
  i.ataque -= dt * (i.lento > 0 ? 0.6 : 1);
  if (i.ataque > 0) return false;
  // o monstro furioso deixa os outros do grupo mais bravos enquanto está vivo
  const aura = !i.furioso && c.inimigos.some((o) => o.furioso && o.hp > 0) ? FURIOSO.aura : null;
  i.ataque = 1 / (i.as * (aura ? aura.as : 1));
  if (Math.random() < a.esquiva) { emitir(c, 'esquiva', {}); return true; }
  // dano físico é reduzido pela armadura; dano mágico, pela resistência mágica
  const defesa = (i.magico ? a.rm : a.armadura) * (1 + 0.01 * c.darius.disciplina + (c.darius.estandarte > 0 ? c.darius.estandarteDef || 0 : 0) + (c.darius.diamante > 0 ? c.darius.diamanteDef || 0 : 0) + (c.darius.membrana > 0 ? c.darius.membranaDef || 0 : 0));
  receberDano(estado, c, a, mitigar(i.ad * (aura ? aura.ad : 1), defesa), false, i.magico, i);
  if (a.tem('3075')) i.hp -= 10 + 0.1 * a.bonusArmadura;
  return true;
}

// bônus de XP da Twitch (assistindo, logado, a uma live oficial): o servidor diz quanto é a cada save
// (servidor/twitch.js, de 1 a ~1,5); no servidor, nos bots e nos testes fica 1
let bonusTwitchXp = 1;
export function usarBonusTwitch(m) { bonusTwitchXp = Math.min(1.5, Math.max(1, Number(m) || 1)); }
export const bonusTwitchAtual = () => bonusTwitchXp;
// evento de XP (servidor/evento.js): o servidor manda o multiplicador; aqui só a XP dos monstros muda
let bonusEventoXp = 1;
export function usarEventoXp(m) { bonusEventoXp = Math.min(3, Math.max(1, Number(m) || 1)); }
export const eventoXpAtual = () => bonusEventoXp;

// abates e loot: local = de onde vem o saque; bonus multiplica XP e chance de drop (Runeterra)
// bonusXp: o bônus de grupo de Runeterra (só experiência; o servidor diz quanto é)
function processarAbates(estado, c, a, local, bonus = 1, bonusXp = 1) {
  const d = c.darius;
  for (const i of c.inimigos) {
    if (i.hp <= 0 && !i.morto) {
      i.morto = true;
      // Runeterra: outro jogador (fora do seu grupo) deu o último golpe: o abate é dele (o servidor repassa)
      if (i.golpeOutro && !i.golpeOutro.grupo) { emitir(c, 'abateRoubado', { id: i.id, para: i.golpeOutro.de, nome: i.nome }); continue; }
      const fs = fatorSaque(estado.nivel, i.nivel), ouro = i.ouro * a.ouroMult * fs;
      estado.ouro += ouro; estado.totais.ouro += ouro; estado.totais.abates++;
      if (i.chefe) estado.totais.chefes++;
      if (i.furioso) estado.totais.furiosos = (estado.totais.furiosos || 0) + 1;
      estado.totais.porMonstro ??= {};
      estado.totais.porMonstro[i.nome] = (estado.totais.porMonstro[i.nome] || 0) + 1;
      const vip = ehVip(estado), mult = (vip ? VIP.drop : 1) * bonus * fs, multEsp = (vip ? VIP.drop : 1) * fs;
      const xp = i.xp * fatorXp(estado.nivel, i.nivel) * (vip ? VIP.xp : 1) * bonus * bonusXp * bonusTwitchXp * bonusEventoXp;
      ganharXp(estado, c, xp);
      ganharXpMascote(estado, c, xp * 0.1);
      const petIt = 1 + bonusMascote(estado).itens;      // a Aranhinha acha um pouco mais de itens
      const lugar = typeof local === 'function' ? local(i) : local;
      const cl = classeDe(estado), itens = i.invocado ? [] : [...sortearLoot(lugar, i.chefe, mult * petIt, cl), ...aMais(i, FURIOSO.saque, () => sortearLoot(lugar, false, mult * petIt, cl))], guardados = [], perdidos = [];
      for (const id of itens) {
        if (estado.ignorarBasicos && raridade(infoItem(id)) === 'basico') continue;
        if (espacosLivres(estado) > 0) { estado.mochila.push(comItem(id, 0, '?')); guardados.push(id); estado.totais.drops++; if (ITENS[id].lendario) estado.totais.lendarios = (estado.totais.lendarios || 0) + 1; }
        else perdidos.push(id);
      }
      const esp = i.invocado ? [] : [...sortearEspolios(i.nome, multEsp), ...aMais(i, FURIOSO.extras, () => sortearEspolios(i.nome, multEsp))];
      estado.espolios ??= {};
      const espGuardados = [];
      for (const id of esp) if (cabeEspolio(estado, id)) { estado.espolios[id] = (estado.espolios[id] || 0) + 1; espGuardados.push(id); } else perdidos.push(id);
      // gemas: o monstro noturno sorteia duas vezes, como o saque (o furioso, FURIOSO.extras); não ocupam a mochila
      const gemas = i.invocado ? [] : [...sortearGemas(lugar, i.chefe, multEsp), ...aMais(i, FURIOSO.extras, () => sortearGemas(lugar, false, multEsp))];
      estado.gemas ??= {};
      for (const g of gemas) estado.gemas[g] = (estado.gemas[g] || 0) + 1;
      if (i.nome === 'Barão Nashor') { estado.buffBarao = BARAO.duracao; emitir(c, 'buffBarao', {}); }
      emitir(c, 'abate', { alvo: i.id, nome: i.nome, ouro, xp, chefe: i.chefe, furioso: !!i.furioso, itens: guardados, perdidos, espolios: espGuardados, gemas });
      if (!i.invocado) contarTarefa(estado, c, i.nome, !!i.furioso);      // as larvas que o Barão invoca não contam (como na diária)
      contarDiaria(estado, i);
      const HPk = habDe(estado).P;
      if (HPk?.voracidade) for (const t of ['Q', 'W', 'E']) d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));
      if (a.tem('6333')) { d.sangramentoRecebido = []; curar(estado, c, a, (a.vida - estado.vida) * 0.15); }
      if (estado.ranks.D && habDe(estado).D.acumulos) d.disciplina = Math.min(habDe(estado).D.acumulos[estado.ranks.D - 1], d.disciplina + 1);
    }
  }
}

// ---------- habilidades em combate ----------
// mecânicas iguais para todos os campeões (as extras do MMORPG); só os números e nomes mudam por kit
function acoesComuns({ estado, c, a, d, r, HK, adEfetivo, prontos, chegando, alcancaveis, alvo, pode, usar }) {
  return {
    N() {      // execução em massa
      if (!pode('N')) return;
      const lim = HK.N.limiar[r.N - 1];
      const fracos = alcancaveis.filter((i) => !i.chefe && i.hp > 0 && i.hp < i.hpMax * lim);
      if (fracos.length < 2 && !alvo.chefe) return;
      for (const i of fracos) { emitir(c, 'dano', { alvo: i.id, valor: i.hp, fonte: 'N', verdadeiro: true }); i.hp = 0; }
      if (alvo.chefe) { const golpe = HK.N.danoChefe(r.N, adEfetivo); alvo.hp -= golpe; emitir(c, 'dano', { alvo: alvo.id, valor: golpe, fonte: 'N', verdadeiro: true }); }
      usar('N', { alvos: [...fracos, ...(alvo.chefe ? [alvo] : [])].map((i) => i.id) });
    },
    A() {      // atordoa o mais distante (e interrompe a investida do Arauto)
      const arauto = prontos.find((i) => MECANICAS[i.nome] === 'investida' && i.hp > 0);
      if (!pode('A') || (arauto && !(arauto.carregando > 0))) return;
      const longe = (arauto?.carregando > 0 && arauto) || chegando.sort((x, y) => y.chegada - x.chegada)[0] || alvo;
      if (!kit(estado).distancia) longe.chegada = 0;      // o Darius puxa; o Ezreal só atordoa de longe
      longe.atordoado = 1;
      golpear(estado, c, adEfetivo, longe, HK.A.dano(r.A, adEfetivo), 'A');
      usar('A', { alvo: longe.id });
      acertouHabilidade(estado, c);
    },
    G() { if (pode('G')) { d.grito = HK.G.duracao; d.gritoBonus = HK.G.bonus[r.G - 1]; usar('G'); } },
    B() {
      if (pode('B') && (estado.vida < a.vida * 0.85 || estado.mana < a.mana * 0.5)) { d.estandarte = HK.B.duracao; d.estandarteCura = HK.B.cura[r.B - 1]; usar('B'); }
    },
    F() {
      if (!pode('F') || estado.vida <= a.vida * 0.35 || estado.vida >= a.vida * 0.8) return;
      estado.vida -= estado.vida * HK.F.custoVida;
      d.furiaS = HK.F.duracao; d.furiaRoubo = HK.F.roubo[r.F - 1]; usar('F');
    },
    T() {
      if (!pode('T') || !(prontos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      for (const i of prontos) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T'); i.lento = 2; }
      usar('T');
      acertouHabilidade(estado, c);
    },
    M() {      // acerta agora e de novo na volta
      if (!pode('M') || alvo.hp <= 0) return;
      const bruto = HK.M.dano(r.M, adEfetivo);
      golpear(estado, c, adEfetivo, alvo, bruto, 'M');
      d.machados.push({ t: 0.6, alvo: alvo.id, bruto });
      usar('M', { alvo: alvo.id });
      acertouHabilidade(estado, c);
    },
  };
}

function acoesDarius({ estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alvo, pode, usar }) {
  return {
    R() {      // executa quando o dano verdadeiro basta
      if (!pode('R') || alvo.hp <= 0 || !(alvo.chefe || !HK.R.custo[r.R - 1] || estado.mana > a.mana * 0.6)) return;      // a trava de mana só enquanto o R custa mana
      const golpe = HK.R.dano(r.R, adEfetivo, alvo.acumulos);
      if (golpe < alvo.hp) return;
      alvo.hp -= golpe;
      emitir(c, 'dano', { alvo: alvo.id, valor: golpe, fonte: 'R', verdadeiro: true });
      usar('R', {}, 2);   // o abate reinicia a Guilhotina em 2 s (também nos chefes: antes ficava a recarga inteira)
      aplicarHemorragia(c, alvo);
    },
    E() {      // puxa quem ainda está chegando
      if (!pode('E') || !(chegando.length || alvo.chefe || alvo.furioso)) return;
      for (const i of vivos) { i.chegada = 0; i.lento = 2; }
      usar('E');
    },
    Q() {      // giro em área, cura por inimigo atingido
      if (!pode('Q') || !(prontos.length >= 2 || alvo.chefe || alvo.furioso || estado.vida < a.vida * 0.8)) return;
      const bruto = HK.Q.dano(r.Q, adEfetivo);
      let atingidos = 0;
      for (const i of prontos) { golpear(estado, c, adEfetivo, i, bruto, 'Q'); atingidos++; }
      curar(estado, c, a, (a.vida - estado.vida) * 0.13 * Math.min(3, atingidos));
      usar('Q');
    },
    W() { if (pode('W') && !d.wPronto && estado.mana > a.mana * 0.4) { d.wPronto = true; d.ataque = 0; usar('W'); } },
    F() {      // Banho de Sangue: sangue vira força no machado (não usa com a vida baixa)
      if (!pode('F') || !prontos.length || estado.vida <= a.vida * 0.4) return;
      estado.vida -= estado.vida * HK.F.custoVida;
      d.banho = HK.F.duracao; d.furiaS = HK.F.duracao; d.furiaRoubo = 0;
      usar('F');
    },
    T() {      // Pisotear: área grande (também quem está quase chegando)
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      if (!pode('T') || !(alvos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      for (const i of alvos) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T'); i.lento = 2; }
      usar('T', { alvos: alvos.map((i) => i.id) });
    },
    B() {      // Estandarte de Noxus: armadura e resistência mágica
      if (!pode('B') || !(prontos.length >= 2 || alvo.chefe || alvo.furioso || estado.vida < a.vida * 0.7)) return;
      d.estandarte = HK.B.duracao; d.estandarteCura = 0; d.estandarteDef = HK.B.defesaBonus[r.B - 1];
      usar('B');
    },
    M() {      // Ruptura Noxiana: a fenda pega a fila; quem já sangra leva mais
      if (!pode('M') || alvo.hp <= 0 || !(prontos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      const fila = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0)].slice(0, 4);
      for (const i of fila) {
        const sangra = i.acumulos > 0;
        golpear(estado, c, adEfetivo, i, HK.M.dano(r.M, adEfetivo) * (sangra ? 1 + HK.M.bonusSangue : 1), 'M');
        i.atordoado = Math.max(i.atordoado || 0, HK.M.atordoa);
      }
      usar('M', { alvo: alvo.id, alvos: fila.map((i) => i.id) });
    },
    N() {      // Domínio de Noxus: 10 s de território (ver o passo)
      if (!pode('N') || d.dominio || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      d.dominio = { t: HK.N.duracao, tick: 0.25 }; d.inabalavel = true;
      usar('N', { alvos: vivos.map((i) => i.id), duracao: HK.N.duracao });
    },
  };
}

// passiva do Ezreal: cada habilidade que acerta dá velocidade de ataque, até 5 acúmulos por 6s
function acertouHabilidade(estado, c) {
  if (kit(estado).id !== 'ezreal') return;
  const d = c.darius, HG = habDe(estado).G;
  d.forcaAcum = Math.min(5, (d.forcaAcum || 0) + 1); d.forca = 6;
  if (d.arrogancia > 0 && HG?.estende && (d.arrogExtra || 0) < HG.estendeMax) { d.arrogancia += HG.estende; d.arrogExtra = (d.arrogExtra || 0) + HG.estende; }
}
// orbe do Fluxo Essencial: detona com o próximo acerto, causa dano extra e devolve mana
function detonarOrbe({ estado, c, a, adEfetivo }, alvo) {
  const r = estado.ranks.W, HK = habDe(estado);
  alvo.marca = 0;
  if (HK.P?.passivaLux) {             // Iluminação: a marca de luz explode com o ataque básico
    golpear(estado, c, adEfetivo, alvo, HK.P.base(estado.nivel) + HK.P.ratio * (a.ap || 0), 'P', { acumula: false });
    emitir(c, 'iluminacao', { alvo: alvo.id });
    return;
  }
  if (!r || !HK.W.devolveMana) return;
  golpear(estado, c, adEfetivo, alvo, HK.W.dano(r, adEfetivo), 'W', { acumula: false });
  estado.mana = Math.min(a.mana, estado.mana + HK.W.devolveMana[r - 1]);
}

// itens de mago que reagem a habilidades: Eco de Luden (dano extra em até 3, a cada 6s) e Perdição de Lich (próximo ataque)
function aoUsarHabilidade(estado, c, a, adEfetivo, vivos) {
  const d = c.darius, A = LOCAL[estado.local]?.arena ? c.arena : null;      // o c.arena fica guardado depois de sair de Runeterra
  if (A) vivos = (vivos || []).filter((i) => Math.hypot(i.x - A.x, i.y - A.y) < 7);
  const HPt = habDe(estado).P;
  if (HPt?.bravata) { d.bravata = HPt.ataques; d.bravataT = HPt.duracao; d.bravataVa = HPt.va; }      // Taric: cada habilidade carrega a Bravata
  const HD = habDe(estado).D, rD = estado.ranks.D;
  if (HD?.prisma && rD) {
    d.prismaCont = (d.prismaCont || 0) + 1;
    if (d.prismaCont >= HD.cada) {
      const alvos = (vivos || []).filter((i) => i.hp > 0).slice(0, HD.raios), jogs = A ? jogadoresPerto(estado, c, 7).slice(0, HD.raios - alvos.length) : [];
      if (alvos.length || jogs.length) {
        d.prismaCont = 0;
        emitir(c, 'prisma', { alvos: alvos.map((i) => i.id), jogadores: jogs.map((o) => o.nome) });      // os jogadores: o jogo manda o acerto (o servidor calcula)
        for (const i of alvos) { golpear(estado, c, adEfetivo, i, HD.dano(rD, adEfetivo), 'D', { acumula: false }); iluminar(estado, i); }
      }
    }
  }
  if (a.tem('3100')) d.lich = true;
  if (a.tem('6655') && (d.timers.luden || 0) <= 0) {
    d.timers.luden = 6;
    const alvos = (vivos || []).filter((i) => i.hp > 0).slice(0, 3);
    for (const i of alvos) golpear(estado, c, adEfetivo, i, 100 + 0.1 * (a.ap || 0), 'item', { acumula: false, magico: true, poder: true });
    if (alvos.length) emitir(c, 'luden', { alvos: alvos.map((i) => i.id) });
  }
}
// marca da passiva da Lux
const iluminar = (estado, i) => { if (habDe(estado).P?.passivaLux && i.hp > 0) i.marca = 6; };
// Centelha Final: depois de 1s concentrando a luz, o raio atravessa o grupo todo e marca quem sobreviver
function dispararCentelha(ctx) {
  const { estado, c, r, HK, adEfetivo, vivos } = ctx;
  if (!r.R) return;
  emitir(c, 'centelha', { alvos: vivos.map((i) => i.id) });
  const bruto = HK.R.dano(r.R, adEfetivo);
  for (const i of vivos) { if (i.marca > 0) detonarOrbe(ctx, i); golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false }); iluminar(estado, i); }
}
function acoesLux(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alvo, pode, usar } = ctx;
  return {
    R() {      // Centelha Final: em grupo, em chefe ou num monstro só ainda cheio
      if (!pode('R') || !(vivos.length >= 2 || alvo.chefe || alvo.furioso || (alvo.hp > alvo.hpMax * 0.6 && alvo.chegada <= 0.5))) return;      // antes só com 3 ou chefe: ficava acesa sem usar
      usar('R', { canal: CANAL_LUX, alvo: alvo.id });
      d.canalR = CANAL_LUX;
    },
    W() {      // Barreira Prismática: a varinha vai e volta; escudo na ida e de novo na volta
      if (!pode('W') || !(estado.vida < a.vida * 0.85 || prontos.length >= 2)) return;
      const v = HK.W.escudo(r.W, a);
      d.escudo = Math.max(d.escudo || 0, v);
      d.varinha = { t: 0.9, valor: v };
      usar('W', { alvo: alvo.id, escudo: Math.round(v) });
    },
    A() {      // Lança de Luz: atravessa o primeiro monstro e acerta todos os que estão atrás dele (sem atordoar)
      if (!pode('A') || alvo.hp <= 0) return;
      const fila = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0)].slice(0, 5);
      for (const i of fila) {
        if (i.marca > 0) detonarOrbe(ctx, i);
        golpear(estado, c, adEfetivo, i, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
        iluminar(estado, i);
      }
      usar('A', { alvo: fila[fila.length - 1].id, alvos: fila.map((i) => i.id) });
    },
    F() {      // Prisma Regenerador: cura na hora quando a vida cai
      if (!pode('F') || estado.vida >= a.vida * 0.6) return;
      curar(estado, c, a, a.vida * HK.F.curaPct[r.F - 1] + HK.F.curaPoder * (a.ap || 0));
      usar('F');
    },
    T() {      // Convergência Radiante: a energia junta no chão e, depois de um instante, explode em quem está encostado
      if (!pode('T') || d.convergencia || !(prontos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      d.convergencia = { t: HK.T.espera };
      usar('T', { alvos: prontos.filter((i) => i.hp > 0).map((i) => i.id), espera: HK.T.espera });
    },
    B() {      // Farol de Demacia: mana e Poder de Habilidade por 10 s (quando falta mana ou a luta é grande)
      if (!pode('B') || !(estado.mana < a.mana * 0.6 || vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      d.estandarte = HK.B.duracao; d.estandarteCura = 0; d.farolMana = HK.B.manaSeg;
      d.farol = HK.B.duracao; d.farolPoder = HK.B.poderBonus[r.B - 1];
      usar('B');
    },
    M() {      // Chuva de Meteoros: 3 meteoros, um a cada 0,3 s, cada um num monstro diferente; a explosão queima os vizinhos
      if (!pode('M') || alvo.hp <= 0 || !(vivos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      const vs = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0)], bruto = HK.M.dano(r.M, adEfetivo);
      const quedas = [];
      for (let k = 0; k < HK.M.meteoros; k++) { const q = { t: 0.45 + k * 0.3, alvo: vs[k % vs.length].id }; quedas.push(q); d.meteoros.push({ ...q, bruto }); }
      usar('M', { alvo: alvo.id, quedas });
    },
    N() {      // Tornado de Fogo: atravessa o grupo por 3 s e queima todos a cada meio segundo
      if (!pode('N') || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      d.tornado = { t: HK.N.duracao, tick: 0.25, bruto: HK.N.dano(r.N, adEfetivo) };
      usar('N', { alvo: alvo.id, alvos: vivos.map((i) => i.id), duracao: HK.N.duracao });
    },
    E() {      // Singularidade Lucente: no meio do grupo (todos lentos e o dano em área)
      if (!pode('E') || !(vivos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      const bruto = HK.E.dano(r.E, adEfetivo);
      for (const i of vivos) { if (i.marca > 0) detonarOrbe(ctx, i); golpear(estado, c, adEfetivo, i, bruto, 'E', { acumula: false }); i.lento = 2; iluminar(estado, i); }
      usar('E', { alvo: alvo.id, alvos: vivos.map((i) => i.id) });
    },
    Q() {      // Ligação da Luz: prende os 2 mais próximos
      if (!pode('Q') || alvo.hp <= 0) return;
      const presos = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0)].slice(0, 2);
      for (const i of presos) { golpear(estado, c, adEfetivo, i, HK.Q.dano(r.Q, adEfetivo), 'Q', { acumula: false }); i.atordoado = Math.max(i.atordoado || 0, HK.Q.prende); iluminar(estado, i); }
      usar('Q', { alvo: alvo.id, alvos: presos.map((i) => i.id) });
    },
  };
}

// Fluxo do Yasuo: enche lutando (Rift) e andando (Runeterra); cheio, o próximo golpe que ele levar vira escudo
export function encherFluxo(estado, a, quanto) { if (kit(estado).fluxo) estado.mana = Math.min(a.mana, (estado.mana || 0) + quanto * (a.fluxoMult || 1)); }
// joga o monstro para o alto: fica atordoado enquanto está no ar (o Último Suspiro só pega quem está no ar)
// Parede de Vento em Runeterra: fica parada num lugar, virada para (dx, dy). Segura o que vem pela frente dela:
// a linha de a (quem atira) até b (o Yasuo) cruza a parede de frente para trás, a até PAREDE_MEIA tiles do meio.
// Devolve o ponto onde a linha bate na parede (ou null). Usada pelo motor, pelo arena.js, pela cena e pelo servidor.
export const PAREDE_MEIA = 1.3;
export const PAREDE_PVP = 2.5;      // a Parede de Vento segura outro jogador por 2,5 s (contra monstro, a duração da habilidade; p714)
export function paredeBarra(p, a, b) {
  if (!p || !a || !b || a.x == null || b.x == null) return null;
  const sa = (a.x - p.x) * p.dx + (a.y - p.y) * p.dy, sb = (b.x - p.x) * p.dx + (b.y - p.y) * p.dy;
  if (!(sa > 0) || sb > 0) return null;
  const k = sa / (sa - sb || 1e-9), x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
  return Math.abs((x - p.x) * -p.dy + (y - p.y) * p.dx) <= PAREDE_MEIA ? { x, y } : null;
}
// a Parede de Vento do campeão segura um golpe de longe vindo de origem? No Rift ela protege de todos os lados
// (devolve {}); em Runeterra só o que vem pela frente dela (devolve o ponto onde bate)
export function ventoSegura(c, origem) {
  const d = c.darius;
  if (!(d.vento > 0)) return null;
  if (!d.parede) return {};
  return paredeBarra(d.parede, origem, c.arena);
}
// habilidades dos chefes e guardiões que vêm de longe (a parede segura); as que saem do chão, do céu ou do corpo dele, não
export const GOLPES_DE_LONGE = new Set(['sopro', 'olho', 'acido']);
export function levantar(i, s) { if (i.hp <= 0) return; i.noAr = Math.max(i.noAr || 0, s); i.atordoado = Math.max(i.atordoado || 0, s); }
// a recarga da Tempestade de Aço cai com a velocidade de ataque (como no LoL)
export const recargaQYasuo = (h, r, velAtaque, ventania = 0) => Math.max(h.minima, h.recarga[r - 1] / Math.max(1, (velAtaque * (1 + ventania)) / 0.697));
function acoesYasuo(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alvo, pode, usar } = ctx;
  const crit = () => Math.random() < a.critico;
  return {
    N() {      // Dança das Mil Lâminas: 10 cortes em 2,5 s, sem poder ser acertado
      if (!pode('N') || d.danca || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      d.danca = { t: HK.N.duracao, tick: 0.1, cada: HK.N.duracao / HK.N.golpes, n: HK.N.golpes, bruto: HK.N.dano(r.N, adEfetivo) };
      d.invulneravel = Math.max(d.invulneravel || 0, HK.N.duracao);
      usar('N', { duracao: HK.N.duracao, alvos: vivos.map((i) => i.id) });
    },
    R() {      // Último Suspiro: só com monstros no ar; segura todos lá em cima e ignora armadura por 15 s
      const noAr = vivos.filter((i) => i.hp > 0 && i.noAr > 0);
      if (!pode('R') || !noAr.length || !(noAr.length >= 2 || noAr.some((i) => i.chefe) || vivos.length >= 3)) return;
      const bruto = HK.R.dano(r.R, adEfetivo);
      for (const i of noAr) { golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false, critico: crit() }); levantar(i, i.noAr + HK.R.segura); }
      d.suspiro = HK.R.duracaoPen; d.suspiroPen = HK.R.penSuspiro;
      usar('R', { alvos: noAr.map((i) => i.id) });
    },
    W() {      // Parede de Vento: quando apanha de verdade (ou contra chefe)
      if (!pode('W') || d.vento > 0) return;
      // contra chefe: espera ele preparar um golpe de longe (sopro, olho, ácido) para a parede segurar; ou a vida cair
      const chefe = vivos.find((i) => i.chefe && i.hp > 0);
      const golpeVindo = chefe && chefe.carregando > 0 && chefe.carregando < 0.9 && GOLPES_DE_LONGE.has(chefe.mecAtual);
      if (!(golpeVindo || (prontos.length && (estado.vida < a.vida * (chefe ? 0.5 : 0.7) || (!chefe && prontos.length >= 3))))) return;
      d.vento = HK.W.duracao; d.ventoRed = HK.W.reducao[r.W - 1]; d.parede = null;
      usar('W', { duracao: HK.W.duracao });
    },
    E() {      // Espada Ágil: vai até quem está chegando (o monstro chega na hora); cada avanço seguido bate mais
      if (!pode('E')) return;
      const livres = (l) => l.filter((i) => i.hp > 0 && !(i.eAte > c.tempo));
      const destino = livres(chegando).sort((x, y) => x.chegada - y.chegada)[0] || livres([alvo])[0];
      if (!destino) return;
      destino.chegada = 0; destino.eAte = c.tempo + HK.E.mesmoAlvo;
      golpear(estado, c, adEfetivo, destino, HK.E.dano(r.E, adEfetivo) * (1 + HK.E.acumula * (d.eAcum || 0)), 'E', { acumula: false, magico: true });
      d.eAcum = Math.min(HK.E.acumMax, (d.eAcum || 0) + 1); d.eAcumT = 5;
      d.eqCombo = 0.6;
      usar('E', { alvo: destino.id });
    },
    A() {      // Investida do Vendaval: corre até o mais distante e o joga para o alto
      if (!pode('A')) return;
      const longe = chegando.filter((i) => i.hp > 0).sort((x, y) => y.chegada - x.chegada)[0] || alvo;
      if (longe.hp <= 0) return;
      longe.chegada = 0; levantar(longe, HK.A.levanta);
      golpear(estado, c, adEfetivo, longe, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false, critico: crit() });
      usar('A', { alvo: longe.id });
    },
    G() { if (pode('G') && (prontos.length >= 2 || alvo.chefe || alvo.furioso)) { d.ventania = HK.G.duracao; d.ventaniaVa = HK.G.va[r.G - 1]; usar('G'); } },
    B() {
      if (!pode('B') || !(estado.vida < a.vida * 0.75 || prontos.length >= 3)) return;
      const v = a.vida * HK.B.escudoPct[r.B - 1]; d.escudo = Math.max(d.escudo || 0, v);
      usar('B', { escudo: Math.round(v) });
    },
    F() { if (pode('F') && (prontos.length >= 2 || alvo.chefe || alvo.furioso)) { d.fantasma = HK.F.duracao; d.fantasmaPct = HK.F.pctCorte[r.F - 1]; usar('F'); } },
    T() {      // Furacão Cortante: área em volta e todos sobem
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      if (!pode('T') || !(alvos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      for (const i of alvos) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false, critico: crit() }); levantar(i, HK.T.levanta); }
      usar('T', { alvos: alvos.map((i) => i.id) });
    },
    M() {      // Lâmina do Vendaval: a fila de até 4, todos sobem
      if (!pode('M') || alvo.hp <= 0 || !(vivos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      const fila = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0)].slice(0, HK.M.alvos);
      for (const i of fila) { golpear(estado, c, adEfetivo, i, HK.M.dano(r.M, adEfetivo), 'M', { acumula: false, critico: crit() }); levantar(i, HK.M.levanta); }
      usar('M', { alvo: alvo.id, alvos: fila.map((i) => i.id) });
    },
    Q() {      // Tempestade de Aço: estocada; com 2 cargas vira tornado (o grupo sobe); depois da Espada Ágil acerta em volta
      if (!pode('Q') || alvo.hp <= 0) return;
      const rec = recargaQYasuo(HK.Q, r.Q, a.velAtaque, d.ventania > 0 ? d.ventaniaVa : 0), bruto = HK.Q.dano(r.Q, adEfetivo);
      if ((d.qCarga || 0) >= HK.Q.cargas) {
        const atingidos = vivos.filter((i) => i.hp > 0).slice(0, 5);
        for (const i of atingidos) { golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false, critico: crit() }); levantar(i, HK.Q.levanta); }
        d.qCarga = 0;
        usar('Q', { tornado: true, alvos: atingidos.map((i) => i.id) }, rec);
        return;
      }
      // a estocada atravessa a fila (no Rift, o alvo e mais um); depois da Espada Ágil, acerta todos em volta
      const giro = d.eqCombo > 0, atingidos = giro ? prontos.filter((i) => i.hp > 0) : [alvo, ...prontos.filter((i) => i !== alvo && i.hp > 0)].slice(0, HK.Q.fila);
      for (const i of atingidos) golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false, critico: crit() });
      if (atingidos.length) { d.qCarga = Math.min(HK.Q.cargas, (d.qCarga || 0) + 1); d.qCargaT = 6; }
      d.eqCombo = 0;
      usar('Q', { alvo: alvo.id, giro, carga: d.qCarga, alvos: atingidos.map((i) => i.id) }, rec);
    },
  };
}

// ---------- Katarina ----------
// a adaga no chão (Rift): cai depois de "t" segundos e some depois de "resto"; ela pega uma de cada vez (pegaCada)
export function soltarAdaga(estado, c, tecla, alvo = null) {
  const d = c.darius, HP = habDe(estado).P;
  d.adagas ??= [];
  const ad = { id: 'k' + proximoId++, t: HP.queda[tecla] ?? 1, resto: (HP.queda[tecla] ?? 1) + HP.dura, de: tecla, alvo: alvo?.id };
  d.adagas.push(ad);
  return ad;
}
// veneno da Lâmina Envenenada: dano mágico por segundo (já reduzido pela resistência do monstro)
function envenenar(estado, c, a, alvo) {
  const HF = habDe(estado).F, rF = estado.ranks.F;
  if (!HF?.veneno || !rF || alvo.hp <= 0) return;
  const dps = mitigar(HF.veneno(rF, a), alvo.armadura * RM_MONSTRO * (1 - (a.penMagica || 0))) * (kit(estado).papel?.dano ?? 1);
  alvo.queima = donoQueima({ dps: Math.max(alvo.queima?.t > 0 ? alvo.queima.dps : 0, dps), t: HF.venenoT }, c);
}
// o giro de quando ela pega uma adaga: corta todos em volta; com a Lâmina Sinistra, ataca mais rápido e cura
export function giroAdaga(estado, c, a, adEfetivo, alvos, ad = null) {
  const d = c.darius, HP = habDe(estado).P, HD = habDe(estado).D, rD = estado.ranks.D;
  const bruto = HP.giro(estado.nivel, adEfetivo);
  if (HP.shunpo && d.recargas?.E > 0) d.recargas.E *= 1 - HP.shunpo;      // cada adaga pega corta pela metade o que falta do Shunpo
  emitir(c, 'adagaGiro', { adaga: ad?.id, alvos: alvos.map((i) => i.id) });
  let total = 0;
  for (const i of alvos) { total += golpear(estado, c, adEfetivo, i, bruto, 'P', { acumula: false }); if (d.veneno > 0) envenenar(estado, c, adEfetivo, i); }
  if (HD?.vaAdaga && rD) {
    d.sinistraAcum = Math.min(HD.acumMax, (d.sinistraAcum || 0) + 1); d.sinistra = HD.duracaoSinistra; d.sinistraVa = HD.vaAdaga[rD - 1];
  }
  const cura = (HP.curaBase || 0) + (HD?.curaGiro && rD ? HD.curaGiro[rD - 1] : 0);
  if (total > 0 && cura > 0) curar(estado, c, a, total * cura);
  return total;
}
function katarinaPasso(estado, c, a, adEfetivo, vivos, dt) {
  const d = c.darius, HK = habDe(estado), r = estado.ranks;
  // adagas no chão: ela pega a primeira que já caiu, se houver monstro perto para cortar
  if (d.adagas?.length) {
    for (const ad of d.adagas) { ad.t -= dt; ad.resto -= dt; }
    d.adagas = d.adagas.filter((ad) => { if (ad.resto > 0) return true; emitir(c, 'adagaSome', { adaga: ad.id }); return false; });
    const perto = vivos.filter((i) => i.hp > 0 && i.chegada <= 0.5), ad = d.adagas.find((x) => x.t <= 0);
    if (ad && perto.length && !(d.pegaCd > 0) && !d.tempestade && d.morto <= 0) {
      d.adagas.splice(d.adagas.indexOf(ad), 1); d.pegaCd = HK.P.pegaCada;
      giroAdaga(estado, c, a, adEfetivo, perto, ad);
    }
  }
  // Lótus da Morte: 15 levas de adagas nos 3 mais perto
  if (d.lotus) {
    d.lotus.t -= dt; d.lotus.tick -= dt;
    while (d.lotus.tick <= 0 && d.lotus.n > 0) {
      d.lotus.tick += d.lotus.cada; d.lotus.n--;
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5).sort((x, y) => x.chegada - y.chegada).slice(0, HK.R.alvos);
      for (const i of alvos) golpear(estado, c, adEfetivo, i, d.lotus.bruto, 'R', { acumula: false });
      if (alvos.length) emitir(c, 'lotusLeva', { alvos: alvos.map((i) => i.id) });
    }
    if (d.lotus.t <= 0 || d.lotus.n <= 0) { d.lotus = null; emitir(c, 'lotusFim', {}); }
  }
  // Tempestade de Lótus: todos em volta, e quem estava chegando chega
  if (d.tempestade) {
    d.tempestade.t -= dt; d.tempestade.tick -= dt;
    while (d.tempestade.tick <= 0 && d.tempestade.n > 0) {
      d.tempestade.tick += d.tempestade.cada; d.tempestade.n--;
      for (const i of vivos) if (i.hp > 0 && i.chegada <= 2) { i.chegada = 0; golpear(estado, c, adEfetivo, i, d.tempestade.bruto, 'N', { acumula: false }); }
    }
    if (d.tempestade.t <= 0 || d.tempestade.n <= 0) {
      d.tempestade = null; d.inabalavel = false;
      const ads = Array.from({ length: HK.N.adagasFim || 0 }, () => soltarAdaga(estado, c, 'T'));
      emitir(c, 'tempestadeFim', { adagas: ads.map((x) => x.id) });
    }
  }
}
// atordoar a Katarina interrompe a Lótus da Morte (Runeterra/PvP)
export function interromperLotus(c) { if (c.darius.lotus) { c.darius.lotus = null; emitir(c, 'lotusFim', { interrompida: true }); } }
function acoesKatarina(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alvo, pode, usar } = ctx;
  const perto = () => vivos.filter((i) => i.hp > 0 && i.chegada <= 0.5);
  return {
    N() {      // Tempestade de Lótus
      if (!pode('N') || d.tempestade || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      d.tempestade = { t: HK.N.duracao, tick: 0.1, cada: HK.N.duracao / HK.N.golpes, n: HK.N.golpes, bruto: HK.N.dano(r.N, adEfetivo) };
      d.inabalavel = true;
      usar('N', { duracao: HK.N.duracao, alvos: vivos.map((i) => i.id) });
    },
    R() {      // Lótus da Morte: com o grupo em volta (ou num chefe)
      if (!pode('R') || d.lotus || !(perto().length >= 2 || ((alvo.chefe || alvo.furioso) && alvo.chegada <= 0.5))) return;
      d.lotus = { t: HK.R.duracao, tick: 0.05, cada: HK.R.duracao / HK.R.golpes, n: HK.R.golpes, bruto: HK.R.dano(r.R, adEfetivo) };
      usar('R', { duracao: HK.R.duracao, alvos: perto().slice(0, HK.R.alvos).map((i) => i.id) });
    },
    B() {      // Passo das Sombras: quando apanha muito (ou o chefe prepara um golpe)
      const chefe = vivos.find((i) => i.chefe && i.hp > 0);
      if (!pode('B') || !(estado.vida < a.vida * 0.55 || (chefe?.carregando > 0 && chefe.carregando < 0.9))) return;
      d.invulneravel = Math.max(d.invulneravel || 0, HK.B.some);
      d.sombraPronta = HK.B.janela; d.sombraBonus = HK.B.bonusSombra[r.B - 1];
      usar('B', { duracao: HK.B.some });
    },
    M() {      // Execução Noxiana: no mais ferido
      if (!pode('M')) return;
      const ferido = vivos.filter((i) => i.hp > 0 && i.chegada <= 0.5).sort((x, y) => x.hp / x.hpMax - y.hp / y.hpMax)[0];
      if (!ferido || !(ferido.chefe || vivos.length >= 2 || ferido.hp / ferido.hpMax < 0.6)) return;
      golpear(estado, c, adEfetivo, ferido, HK.M.dano(r.M, adEfetivo), 'M', { acumula: false });
      const exec = ferido.hp > 0 && !ferido.chefe && ferido.hp < ferido.hpMax * HK.M.executa[r.M - 1];
      if (exec) { emitir(c, 'dano', { alvo: ferido.id, valor: ferido.hp, fonte: 'M', verdadeiro: true }); ferido.hp = 0; }
      usar('M', { alvo: ferido.id, executou: exec });
      if (exec) d.recargas.M *= 1 - HK.M.reembolso;
    },
    E() {      // Shunpo: até uma adaga que já caiu (pega e gira) ou até quem está chegando
      if (!pode('E')) return;
      const ad = d.adagas?.find((x) => x.t <= 0);
      const destino = chegando.filter((i) => i.hp > 0).sort((x, y) => x.chegada - y.chegada)[0] || (alvo.hp > 0 ? alvo : null);
      if (!destino) return;
      destino.chegada = 0;
      golpear(estado, c, adEfetivo, destino, HK.E.dano(r.E, adEfetivo), 'E', { acumula: false });
      usar('E', { alvo: destino.id, adaga: ad?.id });
      if (ad && !d.tempestade) { d.adagas.splice(d.adagas.indexOf(ad), 1); d.pegaCd = HK.P.pegaCada; giroAdaga(estado, c, a, adEfetivo, perto(), ad); }
    },
    A() {      // Adaga Certeira: no mais distante (e interrompe a investida do Arauto)
      const arauto = prontos.find((i) => MECANICAS[i.nome] === 'investida' && i.hp > 0);
      if (!pode('A') || (arauto && !(arauto.carregando > 0))) return;
      const longe = (arauto?.carregando > 0 && arauto) || chegando.filter((i) => i.hp > 0).sort((x, y) => y.chegada - x.chegada)[0] || alvo;
      if (longe.hp <= 0) return;
      longe.atordoado = Math.max(longe.atordoado || 0, HK.A.atordoa);
      golpear(estado, c, adEfetivo, longe, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
      const ad = soltarAdaga(estado, c, 'A', longe);
      usar('A', { alvo: longe.id, adaga: ad.id });
    },
    G() { if (pode('G') && (prontos.length >= 2 || alvo.chefe || alvo.furioso)) { d.sede = HK.G.duracao; d.sedeVa = HK.G.va[r.G - 1]; usar('G'); } },
    F() { if (pode('F') && (prontos.length >= 2 || alvo.chefe || alvo.furioso)) { d.veneno = HK.F.duracao; usar('F'); } },
    T() {      // Chuva de Adagas: corta em volta e deixa 5 adagas no chão
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1);
      if (!pode('T') || !(alvos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      for (const i of alvos) golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false });
      const ads = Array.from({ length: HK.T.adagas }, () => soltarAdaga(estado, c, 'T'));
      usar('T', { alvos: alvos.map((i) => i.id), adagas: ads.map((x) => x.id) });
    },
    Q() {      // Lâmina Saltitante: o alvo e mais 2 (também quem está chegando); a adaga cai no chão
      if (!pode('Q') || alvo.hp <= 0) return;
      const atingidos = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0).sort((x, y) => x.chegada - y.chegada)].slice(0, HK.Q.alvos);
      const bruto = HK.Q.dano(r.Q, adEfetivo);
      for (const i of atingidos) golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false });
      const ad = soltarAdaga(estado, c, 'Q', atingidos[0]);          // cai atrás do primeiro (como no LoL)
      usar('Q', { alvo: alvo.id, alvos: atingidos.map((i) => i.id), adaga: ad.id });
    },
    W() {      // Preparação: a adaga cai ao lado dela (só com monstro perto, para dar tempo de pegar)
      if (!pode('W') || !perto().length) return;
      const ad = soltarAdaga(estado, c, 'W');
      usar('W', { adaga: ad.id });
    },
  };
}

// ---------- Taric ----------
// cura do Taric: com o Brilho Facetado (D), a cura solta um pulso de dano nos monstros em volta
function curaTaric(estado, c, a, adEfetivo, valor, vivos) {
  curar(estado, c, a, valor);
  const HD = habDe(estado).D, rD = estado.ranks.D;
  if (!HD?.pulso || !rD) return;
  const alvos = (vivos || []).filter((i) => i.hp > 0 && (i.chegada ?? 0) <= 1), jogs = jogadoresPerto(estado, c, 2.6);
  if (!alvos.length && !jogs.length) return;
  emitir(c, 'facetado', { alvos: alvos.map((i) => i.id), jogadores: jogs.map((o) => o.nome) });
  for (const i of alvos) golpear(estado, c, adEfetivo, i, valor * HD.pulso[rD - 1], 'D', { acumula: false });
}
// o feixe do Deslumbrar explode depois de 1 s; o Resplendor Cósmico deixa invulnerável depois de 2,5 s
function taricPasso(estado, c, a, adEfetivo, vivos, dt) {
  const d = c.darius, HK = habDe(estado), r = estado.ranks;
  if (d.deslumbrar) {
    d.deslumbrar.t -= dt;
    if (d.deslumbrar.t <= 0) {
      const ids = d.deslumbrar.alvos, alvos = vivos.filter((i) => ids.includes(i.id) && i.hp > 0);
      d.deslumbrar = null;
      emitir(c, 'deslumbrar', { alvos: alvos.map((i) => i.id) });
      for (const i of alvos) { golpear(estado, c, adEfetivo, i, HK.E.dano(r.E || 1, adEfetivo), 'E', { acumula: false }); i.atordoado = Math.max(i.atordoado || 0, HK.E.atordoa); }
    }
  }
  if (d.radiancia) {
    d.radiancia.t -= dt;
    if (d.radiancia.t <= 0) { d.radiancia = null; d.invulneravel = Math.max(d.invulneravel || 0, HK.R.invulneravel); emitir(c, 'resplendor', { duracao: HK.R.invulneravel }); }
  }
}
function acoesTaric(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alvo, pode, usar } = ctx;
  const chefeArmando = () => { const ch = vivos.find((i) => i.chefe && i.hp > 0); return ch?.carregando > 0 && ch.carregando < 2.6; };
  return {
    R() {      // Resplendor Cósmico: com a vida baixa ou quando o chefe prepara um golpe
      if (!pode('R') || d.radiancia || d.invulneravel > 0 || !(estado.vida < a.vida * 0.5 || chefeArmando())) return;
      d.radiancia = { t: HK.R.espera };
      usar('R', { espera: HK.R.espera, duracao: HK.R.invulneravel });
    },
    N() {      // Supernova: grupo grande ou chefe; um quarto do dano vira cura
      if (!pode('N') || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 2), bruto = HK.N.dano(r.N, adEfetivo);
      let total = 0;
      for (const i of alvos) total += golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false });
      usar('N', { alvos: alvos.map((i) => i.id) });
      curaTaric(estado, c, a, adEfetivo, total * HK.N.curaDano, vivos);
    },
    F() {      // Égide Cristalina: quando a vida cai
      if (!pode('F') || estado.vida >= a.vida * 0.65) return;
      const v = a.vida * HK.F.escudoPct[r.F - 1] + HK.F.escudoPoder * (a.ap || 0);
      d.escudo = Math.max(d.escudo || 0, v);
      usar('F', { escudo: Math.round(v) });
    },
    Q() {      // Fulgor Estelar: a luz cura e atinge os monstros encostados
      if (!pode('Q') || !((prontos.length && estado.mana > a.mana * 0.25) || estado.vida < a.vida * 0.6)) return;
      const alvos = prontos.filter((i) => i.hp > 0), bruto = HK.Q.dano(r.Q, adEfetivo);
      for (const i of alvos) golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false });
      usar('Q', { alvos: alvos.map((i) => i.id) });
      curaTaric(estado, c, a, adEfetivo, HK.Q.valorCura(r.Q, a), vivos);
    },
    W() {      // Bastião: escudo com monstros encostados
      if (!pode('W') || !prontos.length || !(estado.vida < a.vida * 0.85 || prontos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      const v = HK.W.escudo(r.W, a);
      d.escudo = Math.max(d.escudo || 0, v);
      usar('W', { escudo: Math.round(v) });
    },
    E() {      // Deslumbrar: o feixe pega o alvo e mais 2, e explode depois de 1 s (ver taricPasso)
      if (!pode('E') || d.deslumbrar || alvo.hp <= 0) return;
      const fila = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0).sort((x, y) => x.chegada - y.chegada)].slice(0, HK.E.alvos);
      d.deslumbrar = { t: HK.E.espera, alvos: fila.map((i) => i.id) };
      usar('E', { alvo: alvo.id, alvos: fila.map((i) => i.id), espera: HK.E.espera });
    },
    B() {      // Constelação: vida e mana por 10 s
      if (!pode('B') || !(estado.vida < a.vida * 0.8 || estado.mana < a.mana * 0.5)) return;
      d.estandarte = HK.B.duracao; d.estandarteCura = HK.B.cura[r.B - 1]; d.farolMana = HK.B.manaSeg; d.estandarteDef = 0;
      usar('B');
    },
    G() {      // Pele de Diamante
      if (!pode('G') || !(prontos.length >= 2 || alvo.chefe || alvo.furioso || estado.vida < a.vida * 0.7)) return;
      d.diamante = HK.G.duracao; d.diamanteDef = HK.G.defesa[r.G - 1]; d.diamanteReflete = HK.G.reflete[r.G - 1];
      usar('G');
    },
    M() {      // Martelo Celestial: salta no meio do grupo (quem estava chegando também é atingido)
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      if (!pode('M') || !(alvos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      for (const i of alvos) { i.chegada = 0; golpear(estado, c, adEfetivo, i, HK.M.dano(r.M, adEfetivo), 'M', { acumula: false }); i.atordoado = Math.max(i.atordoado || 0, HK.M.atordoa); }
      usar('M', { alvo: alvo.id, alvos: alvos.map((i) => i.id) });
    },
    T() {      // Chuva de Estrelas: em volta, com lentidão
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1);
      if (!pode('T') || !(alvos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      for (const i of alvos) { golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false }); i.lento = Math.max(i.lento || 0, HK.T.lento); }
      usar('T', { alvos: alvos.map((i) => i.id) });
    },
    A() {      // Estilhaço Estelar: no mais distante (e interrompe a investida do Arauto)
      const arauto = prontos.find((i) => MECANICAS[i.nome] === 'investida' && i.hp > 0);
      if (!pode('A') || (arauto && !(arauto.carregando > 0))) return;
      const longe = (arauto?.carregando > 0 && arauto) || chegando.filter((i) => i.hp > 0).sort((x, y) => y.chegada - x.chegada)[0] || alvo;
      if (longe.hp <= 0) return;
      longe.atordoado = Math.max(longe.atordoado || 0, HK.A.atordoa);
      golpear(estado, c, adEfetivo, longe, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
      usar('A', { alvo: longe.id });
    },
  };
}

// ---------- Zac ----------
// paga a habilidade com vida (uma parte da vida atual; nunca mata)
export function pagarVida(estado, tecla) {
  const f = custoVidaHab(estado, tecla);
  if (f > 0 && estado.vida > 1) estado.vida = Math.max(1, estado.vida - estado.vida * f);
  return f;
}
// gosmas no Rift: caem depois de "t" segundos e somem depois de "resto"; uma habilidade solta uma por monstro atingido (até 3)
// (alvos: os ids de quem foi atingido, para a tela pôr cada gosma perto de um deles)
export function soltarGosmas(estado, c, tecla, atingidos = 1, n = null, alvos = []) {
  const d = c.darius, HP = habDe(estado).P;
  if (!HP?.passivaZac || !(atingidos > 0)) return [];
  d.gosmas ??= [];
  const qtd = n ?? Math.min(atingidos, HP.maxPorLance), novas = [];
  for (let k = 0; k < qtd; k++) { const g = { id: 'z' + proximoId++, t: HP.queda, resto: HP.queda + HP.dura, de: tecla, alvo: alvos[k % (alvos.length || 1)] }; d.gosmas.push(g); novas.push(g); }
  emitir(c, 'gosma', { tecla, gosmas: novas.map((g) => g.id), alvos: novas.map((g) => g.alvo ?? null) });
  return novas;
}
// pegar uma gosma: cura parte da vida máxima, adianta a Matéria Instável (W) e, com a Absorção (D), dano e recargas
export function pegarGosma(estado, c, a, g = null) {
  const d = c.darius, HK = habDe(estado), HP = HK.P, HD = HK.D, rD = estado.ranks.D;
  const cura = a.vida * HP.curaGosma(estado.nivel) + Math.max(0, a.vida - estado.vida) * (HP.curaFalta?.(estado.nivel) || 0);
  curar(estado, c, a, cura);
  if (d.recargas?.W > 0) d.recargas.W = Math.max(0, d.recargas.W - HP.wReduz);
  if (HD?.danoGosma && rD) {
    d.absorcaoAcum = Math.min(HD.acumMax, (d.absorcaoAcum || 0) + 1); d.absorcao = HD.duracaoAbs; d.absorcaoBonus = HD.danoGosma[rD - 1];
    for (const tk of Object.keys(d.recargas)) if (tk !== 'W') d.recargas[tk] = Math.max(0, d.recargas[tk] - HD.reduzGosma[rD - 1]);
  }
  emitir(c, 'gosmaPega', { gosma: g?.id, cura: Math.round(cura) });
  return cura;
}
// Divisão Celular: o golpe mortal divide o Zac em pedaços; depois de "espera" segundos (sem poder ser acertado) ele se junta
// com parte da vida. Uma vez a cada 5 minutos (d.timers.divisao). Na Arena e no PvP quem decide é o servidor (fase 2)
function dividirZac(estado, c, a) {
  const d = c.darius, HP = habDe(estado).P;
  if (!HP?.renasce || (d.timers.divisao || 0) > 0 || LOCAL[estado.local]?.aram) return false;
  d.timers.divisao = HP.renasce.recarga;
  d.dividido = HP.renasce.espera; d.invulneravel = Math.max(d.invulneravel || 0, HP.renasce.espera);
  d.quique = null; d.mitose = null; d.poca = null;
  estado.vida = 1;
  emitir(c, 'divisao', { espera: HP.renasce.espera, pedacos: 4, ...(c.arena && LOCAL[estado.local]?.arena ? { x: c.arena.x, y: c.arena.y } : {}) });
  return true;
}
// os pedaços se juntam: ele volta com parte da vida (chamado no passo, também sem monstros por perto)
function reunirZac(estado, c, a) {
  estado.vida = Math.max(estado.vida, a.vida * habDe(estado).P.renasce.vida(estado.nivel));
  emitir(c, 'reuniu', { vida: Math.round(estado.vida), ...(c.arena && LOCAL[estado.local]?.arena ? { x: c.arena.x, y: c.arena.y } : {}) });
}
function zacPasso(estado, c, a, adEfetivo, vivos, dt) {
  const d = c.darius, HK = habDe(estado), r = estado.ranks;
  if (d.dividido > 0) return;          // dividido: espera os pedaços se juntarem (ver o passo)
  // gosmas no chão: pega a primeira que já caiu quando falta vida (cheio, deixa no chão para depois)
  if (d.gosmas?.length) {
    for (const g of d.gosmas) { g.t -= dt; g.resto -= dt; }
    d.gosmas = d.gosmas.filter((g) => { if (g.resto > 0) return true; emitir(c, 'gosmaSome', { gosma: g.id }); return false; });
    const g = d.gosmas.find((x) => x.t <= 0), quer = estado.vida < a.vida * 0.97;
    if (g && quer && !(d.pegaGosmaCd > 0)) { d.gosmas.splice(d.gosmas.indexOf(g), 1); d.pegaGosmaCd = HK.P.pegaCada; pegarGosma(estado, c, a, g); }
  }
  // Vamos pular!: cada queda acerta em volta; a primeira joga para o alto, as outras deixam lentos
  if (d.quique) {
    d.quique.t -= dt; d.quique.tick -= dt;
    while (d.quique.tick <= 0 && d.quique.n > 0) {
      d.quique.tick += d.quique.cada; d.quique.n--;
      const k = HK.R.quiques - d.quique.n, alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      for (const i of alvos) { i.chegada = 0; golpear(estado, c, adEfetivo, i, d.quique.bruto, 'R', { acumula: false }); if (k === 1) levantar(i, HK.R.levanta); else i.lento = Math.max(i.lento || 0, HK.R.lento); }
      emitir(c, 'quique', { k, alvos: alvos.map((i) => i.id) });
      if (alvos.length && k === 1) soltarGosmas(estado, c, 'R', alvos.length, null, alvos.map((i) => i.id));
    }
    if (d.quique.t <= 0 || d.quique.n <= 0) { d.quique = null; emitir(c, 'quiqueFim', {}); }
  }
  // Poça Ácida: queima a cada meio segundo quem está nela
  if (d.poca) {
    d.poca.t -= dt; d.poca.tick -= dt;
    if (d.poca.tick <= 0) {
      d.poca.tick += 0.5;
      for (const i of vivos) if (i.hp > 0 && i.chegada <= 1) { golpear(estado, c, adEfetivo, i, d.poca.bruto, 'F', { acumula: false }); i.lento = Math.max(i.lento || 0, HK.F.lento); }
    }
    if (d.poca.t <= 0) { d.poca = null; emitir(c, 'pocaFim', {}); }
  }
  // Mitose: as cópias batem
  if (d.mitose) {
    d.mitose.t -= dt; d.mitose.tick -= dt;
    if (d.mitose.tick <= 0) {
      d.mitose.tick += HK.M.cada;
      const vs = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      for (let k = 0; k < HK.M.clones && vs.length; k++) { const i = vs[Math.floor(Math.random() * vs.length)]; golpear(estado, c, adEfetivo, i, d.mitose.bruto, 'M', { acumula: false }); emitir(c, 'cloneGolpe', { clone: k, alvo: i.id }); }
    }
    if (d.mitose.t <= 0) { d.mitose = null; emitir(c, 'mitoseFim', {}); }
  }
  // Regeneração Química: cura ao longo de 5 s
  if (d.regenZ) {
    const passo = Math.min(dt, d.regenZ.t); d.regenZ.t -= dt;
    estado.vida = Math.min(a.vida, estado.vida + d.regenZ.porSeg * passo);
    if (d.regenZ.t <= 0) d.regenZ = null;
  }
}
function acoesZac(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, chegando, alvo, pode, usar } = ctx;
  // cada habilidade custa vida (uma parte da atual), mas as gosmas que soltam devolvem mais: só a Mitose e a Explosão esperam a vida
  const vidaOk = (lim = 0.2) => estado.vida > a.vida * lim;
  const lancar = (t, extra = {}, recarga) => { pagarVida(estado, t); usar(t, extra, recarga); };
  const colados = () => vivos.filter((i) => i.hp > 0 && i.chegada <= 0.5);
  return {
    N() {      // Explosão Celular: grupo grande ou chefe; cada monstro atingido devolve vida
      if (!pode('N') || !vidaOk(0.25) || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      lancar('N', { alvos: vivos.filter((i) => i.hp > 0 && i.chegada <= 2).map((i) => i.id) });
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 2), bruto = HK.N.dano(r.N, adEfetivo);
      for (const i of alvos) { i.chegada = 0; golpear(estado, c, adEfetivo, i, bruto, 'N', { acumula: false }); }
      curar(estado, c, a, a.vida * HK.N.curaPorAlvo * Math.min(HK.N.curaAlvos, alvos.length));
      soltarGosmas(estado, c, 'N', alvos.length, HK.N.gosmas, alvos.map((i) => i.id));
    },
    R() {      // Vamos pular!: com o grupo em volta (ou num chefe)
      const perto = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      if (!pode('R') || d.quique || !(perto.length >= 2 || alvo.chefe || alvo.furioso)) return;
      d.quique = { t: HK.R.duracao, tick: 0.15, cada: HK.R.duracao / HK.R.quiques, n: HK.R.quiques, bruto: HK.R.dano(r.R, adEfetivo), reduz: HK.R.reduzDano[r.R - 1] };
      lancar('R', { duracao: HK.R.duracao, quiques: HK.R.quiques, alvos: perto.map((i) => i.id) });
    },
    B() {      // Regeneração Química: quando a vida cai
      if (!pode('B') || d.regenZ || estado.vida >= a.vida * 0.6) return;
      d.regenZ = { t: HK.B.duracao, porSeg: (a.vida * HK.B.curaTotal[r.B - 1]) / HK.B.duracao };
      lancar('B', { duracao: HK.B.duracao });
    },
    G() {      // Membrana Reforçada: com o grupo em volta, chefe ou a vida caindo
      if (!pode('G') || !(colados().length >= 2 || alvo.chefe || alvo.furioso || estado.vida < a.vida * 0.7)) return;
      const v = a.vida * HK.G.escudoPct[r.G - 1];
      d.escudo = Math.max(d.escudo || 0, v); d.membrana = HK.G.duracao; d.membranaDef = HK.G.defesa[r.G - 1];
      lancar('G', { escudo: Math.round(v), duracao: HK.G.duracao });
    },
    E() {      // Estilingue Elástico: cai em cima de quem está chegando (ou no meio do grupo) e joga todos para o alto
      if (!pode('E') || !(chegando.some((i) => i.hp > 0) || colados().length >= 2 || alvo.chefe || alvo.furioso)) return;
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 2), bruto = HK.E.dano(r.E, adEfetivo);
      if (!alvos.length) return;
      lancar('E', { alvo: (chegando.filter((i) => i.hp > 0).sort((x, y) => y.chegada - x.chegada)[0] || alvo).id, alvos: alvos.map((i) => i.id) });
      for (const i of alvos) { i.chegada = 0; golpear(estado, c, adEfetivo, i, bruto, 'E', { acumula: false }); levantar(i, HK.E.levanta); }
      soltarGosmas(estado, c, 'E', alvos.length, null, alvos.map((i) => i.id));
    },
    A() {      // Gancho Viscoso: puxa o mais distante e atordoa (e interrompe a investida do Arauto)
      const arauto = prontos.find((i) => MECANICAS[i.nome] === 'investida' && i.hp > 0);
      if (!pode('A') || (arauto && !(arauto.carregando > 0))) return;
      const longe = (arauto?.carregando > 0 && arauto) || chegando.filter((i) => i.hp > 0).sort((x, y) => y.chegada - x.chegada)[0] || alvo;
      if (longe.hp <= 0) return;
      longe.chegada = 0; longe.atordoado = Math.max(longe.atordoado || 0, HK.A.atordoa);
      lancar('A', { alvo: longe.id });
      golpear(estado, c, adEfetivo, longe, HK.A.dano(r.A, adEfetivo), 'A', { acumula: false });
      soltarGosmas(estado, c, 'A', 1, null, [longe.id]);
    },
    T() {      // Ondulação: a onda em volta joga todos para o alto
      const alvos = vivos.filter((i) => i.hp > 0 && i.chegada <= 1.5);
      if (!pode('T') || !(alvos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      lancar('T', { alvos: alvos.map((i) => i.id) });
      for (const i of alvos) { i.chegada = 0; golpear(estado, c, adEfetivo, i, HK.T.dano(r.T, adEfetivo), 'T', { acumula: false }); levantar(i, HK.T.levanta); }
      soltarGosmas(estado, c, 'T', alvos.length, null, alvos.map((i) => i.id));
    },
    M() {      // Mitose: as cópias batem e seguram os monstros
      if (!pode('M') || d.mitose || !vidaOk(0.3) || !(colados().length >= 2 || alvo.chefe || alvo.furioso)) return;
      d.mitose = { t: HK.M.duracao, tick: 0.3, bruto: HK.M.dano(r.M, adEfetivo), reduz: HK.M.reduzDano };
      lancar('M', { duracao: HK.M.duracao, clones: HK.M.clones });
    },
    F() {      // Poça Ácida: embaixo do grupo
      if (!pode('F') || d.poca || !(colados().length >= 2 || alvo.chefe || alvo.furioso)) return;
      d.poca = { t: HK.F.duracao, tick: 0.2, bruto: HK.F.dano(r.F, adEfetivo) };
      lancar('F', { duracao: HK.F.duracao, alvos: colados().map((i) => i.id) });
      soltarGosmas(estado, c, 'F', colados().length, null, colados().map((i) => i.id));
    },
    W() {      // Matéria Instável: em volta, com parte da vida máxima de cada monstro
      const alvos = colados();
      if (!pode('W') || !alvos.length) return;
      lancar('W', { alvos: alvos.map((i) => i.id) });
      for (const i of alvos) golpear(estado, c, adEfetivo, i, danoWZac(r.W, adEfetivo, i), 'W', { acumula: false });
      soltarGosmas(estado, c, 'W', alvos.length, null, alvos.map((i) => i.id));
    },
    Q() {      // Esticada: agarra 2 (também quem está chegando) e bate um no outro
      if (!pode('Q') || alvo.hp <= 0) return;
      const atingidos = [alvo, ...vivos.filter((i) => i !== alvo && i.hp > 0).sort((x, y) => x.chegada - y.chegada)].slice(0, HK.Q.alvos);
      lancar('Q', { alvo: alvo.id, alvos: atingidos.map((i) => i.id) });
      const bruto = HK.Q.dano(r.Q, adEfetivo) * (atingidos.length === 1 ? HK.Q.solo[r.Q - 1] : 1);      // um só: bate no chão
      for (const i of atingidos) { i.chegada = 0; golpear(estado, c, adEfetivo, i, bruto, 'Q', { acumula: false }); i.lento = Math.max(i.lento || 0, HK.Q.lento); }
      soltarGosmas(estado, c, 'Q', atingidos.length, null, atingidos.map((i) => i.id));
    },
  };
}

export const CANAL_R = 1;
export const CANAL_LUX = 0.6;
function dispararBarragem(ctx) {
  const { estado, c, r, HK, adEfetivo, vivos } = ctx;
  if (!r.R) return;
  emitir(c, 'barragem', { alvos: vivos.map((i) => i.id) });     // antes do dano: a cena atrasa os números até a onda chegar
  const bruto = HK.R.dano(r.R, adEfetivo);
  for (const i of vivos) { golpear(estado, c, adEfetivo, i, bruto, 'R', { acumula: false }); if (i.marca > 0) detonarOrbe(ctx, i); }
  acertouHabilidade(estado, c);
}

function acoesEzreal(ctx) {
  const { estado, c, a, d, r, HK, adEfetivo, vivos, prontos, alvo, pode, usar } = ctx;
  return {
    G() {      // Arrogância do Explorador: só com monstros para acertar
      if (!pode('G') || !(vivos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      d.arrogancia = HK.G.duracao; d.arrogExtra = 0; d.arrogBonus = HK.G.bonusHab[r.G - 1];
      usar('G');
    },
    A() {      // Tiro de Precisão: atravessa a fila; o primeiro leva mais e fica atordoado (e interrompe a investida do Arauto)
      const arauto = prontos.find((i) => MECANICAS[i.nome] === 'investida' && i.hp > 0);
      if (!pode('A') || alvo.hp <= 0 || (arauto && !(arauto.carregando > 0))) return;
      const fila = vivos.filter((i) => i.hp > 0).sort((x, y) => x.chegada - y.chegada);
      const primeiro = (arauto?.carregando > 0 && arauto) || fila[0];
      const atingidos = [primeiro, ...fila.filter((i) => i !== primeiro)].slice(0, 1 + HK.A.atravessa), bruto = HK.A.dano(r.A, adEfetivo);
      atingidos.forEach((i, k) => {
        if (!k) i.atordoado = Math.max(i.atordoado || 0, 1);
        golpear(estado, c, adEfetivo, i, bruto * (k ? 1 : 1 + HK.A.primeiro), 'A', { acumula: false });
        if (i.marca > 0) detonarOrbe(ctx, i);
      });
      usar('A', { alvo: primeiro.id, alvos: atingidos.map((i) => i.id) });
      acertouHabilidade(estado, c);
    },
    F() {      // Sobrecarga Arcana
      if (!pode('F') || d.sobrecarga > 0 || !(vivos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      d.sobrecarga = HK.F.duracao;
      usar('F');
    },
    T() {      // Descarga Shurimane: cai no meio do grupo, quebra e as bolinhas quicam em volta
      if (!pode('T') || !(vivos.length >= 2 || alvo.chefe || alvo.furioso)) return;
      const bruto = HK.T.dano(r.T, adEfetivo), atingidos = vivos.filter((i) => i.hp > 0);
      for (const i of atingidos) { golpear(estado, c, adEfetivo, i, bruto, 'T', { acumula: false }); if (i.marca > 0) detonarOrbe(ctx, i); }
      for (let k = 0; k < HK.T.bolinhas; k++) {
        const vs = vivos.filter((i) => i.hp > 0), i = vs[Math.floor(Math.random() * vs.length)];
        if (i) golpear(estado, c, adEfetivo, i, bruto * HK.T.bolinha, 'T', { acumula: false });
      }
      usar('T', { alvos: atingidos.map((i) => i.id) });
      acertouHabilidade(estado, c);
    },
    B() {      // Passagem Shurimane: abre o portal quando os monstros estão quase chegando (atravessa no passo)
      if (!pode('B') || d.portal || !vivos.some((i) => i.hp > 0 && i.chegada <= 0.6)) return;
      d.portal = { t: HK.B.portal, pronto: 0.5 };
      usar('B');
    },
    M() {      // Tiro do Explorador: começa no alvo e ricocheteia (ver o passo)
      if (!pode('M') || alvo.hp <= 0) return;
      d.ricochetes = [...(d.ricochetes || []), { t: 0.12, alvo: alvo.id, k: 0 }];
      usar('M', { alvo: alvo.id });
    },
    N() {      // Apogeu da Manopla: 10 s de Sobrecarga, com parte da mana de volta
      if (!pode('N') || d.apogeu > 0 || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      d.apogeu = HK.N.duracao;
      usar('N', { duracao: HK.N.duracao, alvos: vivos.map((i) => i.id) });
      estado.mana = Math.min(a.mana, estado.mana + a.mana * HK.N.manaVolta[r.N - 1]);
      // a onda da queda: dano em todos e quem não é chefe volta a ter de caminhar até ele
      const imp = HK.N.impacto(r.N, adEfetivo);
      for (const i of vivos) { if (i.hp <= 0) continue; golpear(estado, c, adEfetivo, i, imp, 'N', { acumula: false }); if (!i.chefe) i.chegada = Math.max(i.chegada, HK.N.empurraRift); }
    },
    R() {      // barragem: como no LoL, 1s carregando a luva e então a onda atravessa o grupo todo
      if (!pode('R') || !(vivos.length >= 3 || alvo.chefe || alvo.furioso)) return;
      usar('R', { canal: CANAL_R, alvo: alvo.id });
      d.canalR = CANAL_R;
    },
    E() {      // teletransporta para longe quando cercado ou ferido: os monstros voltam a caminhar
      if (!pode('E') || !(prontos.length >= 2 || (prontos.length && estado.vida < a.vida * 0.5))) return;
      const afasta = HK.E.afasta[r.E - 1];
      for (const i of vivos) if (!i.chefe || i.chegada <= 0) i.chegada = Math.max(i.chegada, afasta);
      const mira = vivos.find((i) => i.marca > 0) || alvo;
      golpear(estado, c, adEfetivo, mira, HK.E.dano(r.E, adEfetivo), 'E', { acumula: false });
      if (mira.marca > 0) detonarOrbe(ctx, mira);
      usar('E', { alvo: mira.id });
      acertouHabilidade(estado, c);
    },
    W() {      // prende o orbe no alvo (poupa quando a mana está baixa)
      if (!pode('W') || alvo.marca > 0 || alvo.hp <= 0 || estado.mana < a.mana * 0.3) return;
      alvo.marca = 4;
      usar('W', { alvo: alvo.id });
      acertouHabilidade(estado, c);
    },
    Q() {      // disparo místico: se acerta, reduz as outras recargas
      if (!pode('Q') || alvo.hp <= 0) return;
      const lam = (d.trindade || 0) * a.baseAd; d.trindade = 0;      // a Lâmina Encantada da habilidade anterior (Trindade/Fulgor, p629)
      golpear(estado, c, adEfetivo, alvo, HK.Q.dano(r.Q, adEfetivo) + lam, 'Q', { acumula: false });
      if (alvo.marca > 0) detonarOrbe(ctx, alvo);
      usar('Q', { alvo: alvo.id });
      for (const t of Object.keys(d.recargas)) if (t !== 'Q') d.recargas[t] = Math.max(0, d.recargas[t] - HK.Q.reduz);
      acertouHabilidade(estado, c);
    },
  };
}

// Kiting do atirador: quando um monstro encosta, ele recua atirando e o monstro precisa correr atrás.
// Não é infinito: cada recuo gasta fôlego, que só volta quando ninguém está colado nele; cercado por 3 ou mais
// ele quase não sai do lugar; chefes alcançam mais rápido; monstros lentos ficam mais para trás.
export const FOLEGO_MAX = 1;
function kitar(c, k, prontos, dt) {
  const d = c.darius;
  d.folego ??= FOLEGO_MAX;
  d.kiteCd = Math.max(0, (d.kiteCd || 0) - dt);
  const colados = prontos.filter((i) => i.hp > 0 && i.chegada <= 0);
  if (!colados.length) { d.folego = Math.min(FOLEGO_MAX, d.folego + k.recupera * dt); return; }
  if (d.kiteCd > 0 || d.recall > 0 || d.canalR > 0 || d.folego < k.gasto) return;
  const recuo = k.recuo * (0.4 + 0.6 * d.folego) * (colados.length >= 3 ? 0.5 : 1);
  for (const i of colados) i.chegada = recuo * (i.chefe ? 0.5 : 1) * (i.lento > 0 ? 1.5 : 1);
  d.folego -= k.gasto; d.kiteCd = k.recarga; d.ataque += k.pausa;
  emitir(c, 'kite', { recuo, folego: d.folego, alvos: colados.map((i) => i.id) });
}

function receberDano(estado, c, a, dano, doSangramento, magico = false, origem = null) {
  const d = c.darius;
  if ((d.invulneravel || 0) > 0) return;                                       // Zhonya: em stasis, nada acerta
  if (!doSangramento && origem?.nivel && !c.dg) dano *= fatorDanoMonstro(estado, origem);      // na dungeon o nível dos monstros é o do grupo (p663)      // monstro bem acima do seu nível bate mais forte
  if (!doSangramento) { const pp = kit(estado).papel; dano *= (LOCAL[estado.local]?.arena && pp?.recebidoArena != null ? pp.recebidoArena : pp?.recebido) ?? 1; }      // o papel do campeão (o tanque apanha menos; em Runeterra pode ser outro)
  if (!doSangramento && a.tem('3102') && (d.timers.banshee || 0) <= 0) {        // Véu da Banshee: bloqueia um golpe
    d.timers.banshee = 40; emitir(c, 'item', { nome: t('Escudo de Feitiço') }); return;
  }
  if (!doSangramento && a.tem('6333')) {
    const guardado = dano * 0.3; dano -= guardado;
    d.sangramentoRecebido.push({ total: guardado, resto: guardado });
  }
  if (!doSangramento && d.vento > 0) {                                          // Parede de Vento: quem atira de longe não passa
    const q = origem && (origem.distancia || MONSTROS[origem.nome]?.distancia) ? ventoSegura(c, origem) : null;
    if (q) { emitir(c, 'ventoBloqueia', { alvo: origem.id, x: q.x, y: q.y }); return; }
    dano *= 1 - (d.ventoRed || 0);
  }
  if (!doSangramento && d.quique) dano *= 1 - (d.quique.reduz || 0);                 // Vamos pular! (Zac)
  if (!doSangramento && d.mitose) dano *= 1 - (d.mitose.reduz || 0);                 // Mitose (Zac): os monstros batem nas cópias
  if (!doSangramento && d.diamante > 0 && d.diamanteReflete && origem?.hp > 0 && dano > 0) golpear(estado, c, a, origem, dano * d.diamanteReflete, 'G', { acumula: false });      // Pele de Diamante
  if (!doSangramento && dano > 0 && kit(estado).fluxo && estado.mana >= a.mana - 0.01) {     // Fluxo cheio: o golpe vira escudo
    const v = habDe(estado).P.escudoFluxo(estado.nivel);
    d.escudo = Math.max(d.escudo || 0, v); estado.mana = 0;
    emitir(c, 'fluxo', { escudo: Math.round(v) });
  }
  if (d.escudo > 0) { const abs = Math.min(d.escudo, dano); d.escudo -= abs; dano -= abs; }
  estado.vida -= dano;
  if (c.arena?.mundo && LOCAL[estado.local]?.arena && dano > 0) apanhouNoMundo(c);      // só em Runeterra (o objeto fica depois de sair)
  if (!doSangramento) emitir(c, 'recebido', { valor: dano, magico, origem: origem?.id, frac: dano / Math.max(1, a.vida) });
  if (a.tem('3157') && estado.vida > 0 && estado.vida < a.vida * 0.25 && (d.timers.zhonya || 0) <= 0) {      // Zhonya: stasis
    d.invulneravel = 2.5; d.timers.zhonya = 120; emitir(c, 'item', { nome: t('Stasis') });
  }
  if (a.tem('3053') && estado.vida < a.vida * 0.3 && d.timers.sterak <= 0) {
    d.escudo = 0.6 * a.bonusVida; d.timers.sterak = 90; emitir(c, 'item', { nome: t('Pele de Aço') });
  }
  if (estado.vida <= 0) {
    if (a.tem('3026') && d.timers.anjo <= 0) {
      estado.vida = a.vida * 0.5; d.timers.anjo = 300; emitir(c, 'item', { nome: t('Renascimento') }); return;
    }
    if (dividirZac(estado, c, a)) return;      // Zac: Divisão Celular
    morrer(estado, c);
  }
}

// ao morrer em Runeterra, cada item equipado tem esta chance de cair no chão (num saco que o dono ou outro jogador pega,
// estilo Tibia; quem sorteia e guarda é o servidor, rota /api/morte). No Summoner's Rift nenhum item cai (out/2026).
export const CHANCE_PERDER_ITEM = 0.1;
export const itensQueCaem = (estado, chance = CHANCE_PERDER_ITEM) => estado.itens.filter(() => Math.random() < chance);
// morrer para outro jogador em Runeterra: 30% de chance de cair 1 item equipado, sorteado (para monstro, 10% por item) (12/10/2026)
export const CHANCE_PERDER_PVP = 0.3;
export const itemQueCaiPvp = (estado, chance = CHANCE_PERDER_PVP) => (estado.itens?.length && Math.random() < chance ? [estado.itens[Math.floor(Math.random() * estado.itens.length)]] : []);
// Caveira Vermelha (12/10/2026): 3 frags (mortes injustas no PvP) em 24 h dão a Vermelha por 24 h, contadas do frag que completou os 3
// (um frag novo com 3 em 24 h renova). Com ela, morrendo em Runeterra cai metade de tudo que o personagem carrega (equipados e mochila)
export const CAVEIRA_VERMELHA = { limites: [{ ms: 504e5, n: 3, dura: 504e5 }], perde: 0.5 };      // cada frag conta 14 h; 3 frags em 14 h: 14 h de Vermelha (eram 24 h e 24 h até 12/10/2026, p586/p590)
// até quando dura (0 = sem ela): o fim mais tarde entre os frags que completaram um limite
export function fimVermelha(tempos, agora = Date.now()) {
  const ts = [...tempos].sort((a, b) => a - b);
  let fim = 0;
  for (const { ms, n, dura } of CAVEIRA_VERMELHA.limites)
    for (let i = n - 1; i < ts.length; i++) if (ts[i] - ts[i - n + 1] < ms) fim = Math.max(fim, ts[i] + dura);
  return fim;
}
export const contagemFrags = (tempos, agora = Date.now()) => CAVEIRA_VERMELHA.limites.map((l) => tempos.filter((t) => t > agora - l.ms).length);
// metade de tudo que carrega (sorteado), como pares [onde, item] ('itens' = equipado, 'mochila'); item ainda sendo avaliado fica
export function metadeDosItens(estado) {
  const todos = [...(estado.itens || []).map((id) => ['itens', id]), ...(estado.mochila || []).filter((id) => typeof id === 'string' && !pendente(id)).map((id) => ['mochila', id])];
  for (let i = todos.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [todos[i], todos[k]] = [todos[k], todos[i]]; }
  return todos.slice(0, Math.ceil(todos.length * CAVEIRA_VERMELHA.perde));
}
// a morte custa 10% do XP do nível (em qualquer lugar); os itens não somem mais aqui
export function penalidadeMorte(estado) {
  const perda = Math.min(estado.xp, perdaPorMorte(estado));
  estado.xp -= perda;
  estado.totais.mortes++;
  return { perda, perdidos: [] };
}
function zerarEfeitos(d) {
  d.recall = 0; d.escudo = 0; d.sangramentoRecebido = []; d.poder = 0;
  d.grito = 0; d.furiaS = 0; d.estandarte = 0; d.disciplina = 0; d.machados = []; d.queimando = 0; d.forcaAcum = 0; d.folego = FOLEGO_MAX; d.canalR = 0; d.tornado = null; d.varinha = null; d.meteoros = []; d.prismaCont = 0; d.farol = 0; d.farolMana = 0; d.convergencia = null; d.banho = 0; d.estandarteDef = 0; d.dominio = null; d.inabalavel = false;
  d.arrogancia = 0; d.sobrecarga = 0; d.apogeu = 0; d.pressa = 0; d.portal = null; d.ricochetes = []; d.isca = null;
  d.bravata = 0; d.bravataT = 0; d.diamante = 0; d.deslumbrar = null; d.radiancia = null;
  d.gosmas = []; d.quique = null; d.poca = null; d.mitose = null; d.regenZ = null; d.membrana = 0; d.absorcao = 0; d.absorcaoAcum = 0; d.dividido = 0;
}
function morrer(estado, c, por) {
  const d = c.darius, aram = !!LOCAL[estado.local]?.aram;
  zerarEfeitos(d);
  d.morto = aram || c.dg ? 1e9 : 3;          // na Arena fica caído até a próxima rodada; na dungeon, até o próximo estágio (p663)
  estado.buffBarao = 0;
  estado.vida = 0;
  const { perda } = aram || c.dg ? { perda: 0 } : penalidadeMorte(estado);      // na Arena e na dungeon morrer não custa nada (p663)
  const quem = c.inimigos.find((i) => i.hp > 0 && i.chegada <= 0);
  // em Runeterra o jogo pede ao servidor para derrubar os itens no chão (soltarSaco no jogo.js)
  emitir(c, 'morreu', { perdaXp: perda, por: por ?? quem?.nome, pvp: !!por, aram, runeterra: !aram && !!(c.arena?.mundo && LOCAL[estado.local]?.arena) });
}
// Arena: a próxima rodada (o servidor manda): vida, mana e recargas cheias e nada da rodada anterior
export function renascerArena(estado, c) {
  const a = atributos(estado), d = c.darius;
  zerarEfeitos(d);
  d.morto = 0; d.recargas = ranksVazios(); d.ataque = 0;
  estado.vida = a.vida; estado.mana = a.mana;
}

export function ganharXp(estado, c, xp) {
  if (estado.nivel >= NIVEL_MAX) return;
  estado.xp += xp;
  while (estado.nivel < NIVEL_MAX && estado.xp >= xpParaNivel(estado.nivel)) {
    estado.xp -= xpParaNivel(estado.nivel);
    estado.nivel++;
    estado.pontos++;
    estado.pontosAtrib = (estado.pontosAtrib || 0) + PONTOS_POR_NIVEL;
    if (c) {
      const a = atributos(estado);
      estado.vida = Math.min(a.vida, estado.vida + (a.vida - estado.vida) * 0.3);
      emitir(c, 'nivel', { nivel: estado.nivel });
    }
  }
  if (estado.nivel >= NIVEL_MAX) estado.xp = 0;
}

// ---------- Ações do jogador ----------
export function subirHabilidade(estado, tecla) {
  if (!podeSubir(estado, tecla)) return false;
  estado.ranks[tecla]++; estado.pontos--;
  // primeira vez: entra sozinha na barra se houver espaço
  if (estado.ranks[tecla] === 1 && !habDe(estado)[tecla].passiva && estado.barra.length < BARRA && !estado.barra.includes(tecla)) estado.barra.push(tecla);
  return true;
}
// distribui pontos: ultimates primeiro, depois o que está na barra, depois a passiva, depois o resto
export function subirAutomatico(estado) {
  let subiu = false, deu = true;
  while (deu && estado.pontos > 0) {
    deu = false;
    // habilidades recém-liberadas entram primeiro enquanto houver espaço vazio na barra
    // (mesmo com a barra cheia aprende o rank 1, para a habilidade ficar disponível para troca)
    const novas = ORDEM_HAB.filter((t) => !habDe(estado)[t].passiva && !estado.ranks[t]);
    const prioridade = ['N', 'R', ...novas, 'Q', 'E', ...estado.barra.filter((t) => !'NRQE'.includes(t)), 'D', ...ORDEM_HAB];
    for (const t of prioridade) if (subirHabilidade(estado, t)) { subiu = deu = true; break; }
  }
  return subiu;
}
// coloca ou tira uma habilidade da barra
export function alternarBarra(estado, tecla) {
  const k = estado.barra.indexOf(tecla);
  if (k >= 0) { estado.barra.splice(k, 1); return true; }
  if (habDe(estado)[tecla].passiva || !estado.ranks[tecla] || estado.barra.length >= BARRA) return false;
  estado.barra.push(tecla); return true;
}
// põe uma habilidade aprendida no lugar de outra da barra
export function trocarNaBarra(estado, indice, tecla) {
  if (habDe(estado)[tecla].passiva || !estado.ranks[tecla] || estado.barra.includes(tecla) || !estado.barra[indice]) return false;
  estado.barra[indice] = tecla; return true;
}

export function subirAtributo(estado, chave, qtd = 1) {
  const n = Math.min(qtd, estado.pontosAtrib || 0);
  if (!ATRIBUTOS[chave] || n <= 0) return 0;
  estado.atrib[chave] = (estado.atrib[chave] || 0) + n; estado.pontosAtrib -= n;
  return n;
}
// distribui os pontos livres seguindo as proporções do modelo escolhido
export function distribuirAtributos(estado) {
  const m = MODELOS[estado.modelo];
  if (!m) return 0;
  const total = Object.values(m.pesos).reduce((s, p) => s + p, 0);
  let gastos = 0;
  while (estado.pontosAtrib > 0) {
    const soma = Object.values(estado.atrib).reduce((s, v) => s + v, 0) + 1;
    // o atributo mais "atrasado" em relação ao peso recebe o próximo ponto
    const [chave] = Object.entries(m.pesos).sort(([ka, pa], [kb, pb]) => ((estado.atrib[ka] || 0) - (soma * pa) / total) - ((estado.atrib[kb] || 0) - (soma * pb) / total))[0];
    subirAtributo(estado, chave); gastos++;
  }
  return gastos;
}
const limitarVida = (estado) => { const a = atributos(estado); estado.vida = Math.min(estado.vida, a.vida); estado.mana = Math.min(estado.mana, a.mana); };
// equipa o item k da mochila: um espaço só de bota e 4 para os outros itens; cada lendário uma vez.
// Bota nova troca de lugar com a bota equipada.
export const ehBota = (x) => espacoDe(x) === 'botas';
export function equipar(estado, k) {
  const id = estado.mochila[k];
  if (!id || !temAtributo(id)) return false;
  if (ehBota(id)) {
    const j = estado.itens.findIndex(ehBota);
    if (j >= 0) { estado.mochila[k] = estado.itens[j]; estado.itens[j] = id; limitarVida(estado); return true; }
    estado.mochila.splice(k, 1); estado.itens.push(id); return true;
  }
  if (estado.itens.filter((x) => !ehBota(x)).length >= ESPACOS_ITENS) return false;
  if (ITENS[baseId(id)].lendario && estado.itens.some((x) => baseId(x) === baseId(id))) return false;
  estado.mochila.splice(k, 1); estado.itens.push(id); return true;
}
// troca o item k da mochila pelo equipado j (os dois de bota ou os dois sem ser): o equipado vai para o lugar dele na mochila
export function trocarItem(estado, k, j) {
  const id = estado.mochila[k], velho = estado.itens[j];
  if (!id || !velho || !temAtributo(id) || ehBota(id) !== ehBota(velho)) return false;
  if (ITENS[baseId(id)].lendario && estado.itens.some((x, i) => i !== j && baseId(x) === baseId(id))) return false;
  estado.mochila[k] = velho; estado.itens[j] = id; limitarVida(estado); return true;
}
// pode ficar equipado assim? (uma bota, até 4 outros itens, cada lendário uma vez)
const cabeNoEquip = (lista, x) => (ehBota(x) ? !lista.some(ehBota) : lista.filter((y) => !ehBota(y)).length < ESPACOS_ITENS)
  && !(ITENS[baseId(x)]?.lendario && lista.some((y) => baseId(y) === baseId(x)));
export function equipamentoValido(e) {
  const ok = [];
  for (const x of e.itens || []) { if (!cabeNoEquip(ok, x)) return false; ok.push(x); }
  return true;
}
// quanto um item vale no equipamento (para escolher o que fica)
const valorEquip = (x) => (ITENS[baseId(x)]?.preco || 0) * (1 + BONUS_REFINO * refinoDe(x)) * (QUALIDADES[qualidadeDe(x)]?.mult || 1);
// equipamento fora da regra (mais de 4 itens fora a bota, duas botas, lendário repetido): fica o que vale mais e o resto vai para a mochila
// (sem lugar, para o cofre da Tesoureira). Feito no servidor. Devolve o que mudou de lugar: [{ item, para }]
export function arrumarEquipamento(e) {
  if (equipamentoValido(e)) return [];
  const fica = [], sai = [];
  for (const x of [...(e.itens || [])].sort((a, b) => valorEquip(b) - valorEquip(a))) (cabeNoEquip(fica, x) ? fica : sai).push(x);
  e.itens = fica;
  const movidos = [];
  for (const x of sai) {
    if (espacosLivres(e) > 0) { e.mochila.push(x); movidos.push({ item: x, para: 'mochila' }); }
    else { cofreDe(e).itens.push(x); movidos.push({ item: x, para: 'cofre' }); }
  }
  return movidos;
}
export function desequipar(estado, k) {
  const id = estado.itens[k];
  if (!id || mochilaCheia(estado)) return false;
  estado.itens.splice(k, 1); estado.mochila.push(id); limitarVida(estado); return true;
}

// ações de NPC: só funcionam na Fonte (Soraka e Lojista também nas cidades de Runeterra)
export const naBase = (estado) => !!LOCAL[estado.local]?.base;
let cidadeAtual = null;         // a cidade de Runeterra onde o campeão está agora (o motor de js/arena.js avisa)
export const definirCidade = (id) => { cidadeAtual = id || null; };
export const naCidade = (estado) => !!LOCAL[estado.local]?.arena && !!cidadeAtual;
export const atendeAqui = (estado) => naBase(estado) || naCidade(estado);
export function curarNaFonte(estado) {
  if (!atendeAqui(estado)) return false;
  const a = atributos(estado);
  estado.vida = a.vida; estado.mana = a.mana; return true;
}
export function venderItem(estado, k) {
  const id = estado.mochila[k];
  if (!atendeAqui(estado) || !id || pendente(id)) return 0;        // ainda sendo avaliado: espera o servidor sortear a qualidade
  const v = valorVenda(id);
  estado.mochila.splice(k, 1); estado.ouro += v; estado.totais.vendidos = (estado.totais.vendidos || 0) + 1; return v;
}
// vende uma quantidade de um espólio (janela de venda do Lojista); devolve o ouro
export function venderEspolio(estado, id, qtd) {
  const tem = estado.espolios?.[id] || 0, n = Math.min(tem, Math.max(0, Math.floor(qtd)));
  if (!atendeAqui(estado) || !n || !ESPOLIOS[id]) return 0;
  const v = ESPOLIOS[id].valor * n;
  if (tem - n > 0) estado.espolios[id] = tem - n; else delete estado.espolios[id];
  estado.ouro += v; return v;
}
// vende todos os espólios de uma vez; devolve o ouro
export function venderEspolios(estado) {
  if (!atendeAqui(estado)) return 0;
  const v = valorEspolios(estado);
  estado.ouro += v; estado.espolios = {};
  return v;
}
export function comprarPocao(estado, chave, qtd = 1) {
  const p = POCOES[chave];
  if (!atendeAqui(estado) || !p || qtd < 1 || estado.nivel < p.nivel) return 0;
  const n = Math.min(qtd, Math.floor(estado.ouro / p.preco));
  estado.ouro -= n * p.preco; estado.pocoes[chave] += n; return n;
}

// ---------- Cofre da Tesoureira de Piltover (Fonte): guarda itens e ouro fora da mochila ----------
// também com o Burrinho de Carga nas cidades de Runeterra; no servidor, a rota confere a posição e libera com comCofreLiberado
let cofreLiberado = false;
export function comCofreLiberado(f) { cofreLiberado = true; try { return f(); } finally { cofreLiberado = false; } }
export const podeCofre = (e) => naBase(e) || naCidade(e) || cofreLiberado;
// Tudo passa pelo servidor (rota /api/cofre); o cofre que vem do navegador é ignorado (ver conferirEstado no api.js).
// ampliações compradas: com ouro (+20, 3 vezes, cada uma mais cara) e com diamantes (+10, 5 vezes)
export const COFRE = { espacos: 40, ouro: { espacos: 20, precos: [150000, 500000, 1500000] }, diamantes: { espacos: 10, preco: 100, vezes: 5 } };
export function cofreDe(e) {
  e.cofre ??= { itens: [], ouro: 0 };
  if (!Array.isArray(e.cofre.itens)) e.cofre.itens = [];
  e.cofre.ouro = Math.max(0, Math.floor(Number(e.cofre.ouro) || 0));
  e.cofre.compOuro = Math.max(0, Math.min(COFRE.ouro.precos.length, Math.floor(Number(e.cofre.compOuro) || 0)));
  e.cofre.compDia = Math.max(0, Math.min(COFRE.diamantes.vezes, Math.floor(Number(e.cofre.compDia) || 0)));
  return e.cofre;
}
export const espacosCofre = (e) => { const c = e?.cofre || {}; return COFRE.espacos + COFRE.ouro.espacos * (c.compOuro || 0) + COFRE.diamantes.espacos * (c.compDia || 0); };
export const COFRE_MAX = COFRE.espacos + COFRE.ouro.espacos * COFRE.ouro.precos.length + COFRE.diamantes.espacos * COFRE.diamantes.vezes;
// o preço da próxima ampliação com ouro (null: já comprou todas)
export const precoCofreOuro = (e) => COFRE.ouro.precos[e?.cofre?.compOuro || 0] ?? null;
export function ampliarCofreOuro(e) {
  if (!podeCofre(e)) return 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.';
  const c = cofreDe(e), preco = precoCofreOuro(e);
  if (preco == null) return 'Você já comprou todas as ampliações do cofre com ouro.';
  if ((e.ouro || 0) < preco) return { pt: 'Você precisa de {n} de ouro.', v: { n: preco.toLocaleString('pt-BR') } };
  e.ouro -= preco; c.compOuro++;
  return null;
}
// a parte dos diamantes: o motor só confere e soma; quem desconta os diamantes é o servidor
export function ampliarCofreDiamante(e) {
  if (!podeCofre(e)) return 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.';
  const c = cofreDe(e);
  if (c.compDia >= COFRE.diamantes.vezes) return 'Você já comprou todas as ampliações do cofre com diamantes.';
  c.compDia++;
  return null;
}
export function guardarNoCofre(e, k) {
  if (!podeCofre(e)) return 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.';
  const c = cofreDe(e), id = e.mochila[k];
  if (!id) return 'Item não encontrado.';
  if (c.itens.length >= espacosCofre(e)) return 'O cofre está cheio.';
  e.mochila.splice(k, 1); c.itens.push(id);
  return null;
}
export function retirarDoCofre(e, k) {
  if (!podeCofre(e)) return 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.';
  const c = cofreDe(e), id = c.itens[k];
  if (!id) return 'Item não encontrado.';
  if (espacosLivres(e) <= 0) return 'Sua mochila está cheia.';
  c.itens.splice(k, 1); e.mochila.push(id);
  return null;
}
// tudo de uma vez: guarda (ou retira) até o cofre (ou a mochila) encher; devolve quantos foram
export function guardarTudoNoCofre(e) {
  if (!podeCofre(e)) return { erro: 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.' };
  const c = cofreDe(e), n = Math.min(e.mochila.length, espacosCofre(e) - c.itens.length);
  if (!e.mochila.length) return { erro: 'A mochila está vazia.' };
  if (n <= 0) return { erro: 'O cofre está cheio.' };
  c.itens.push(...e.mochila.splice(0, n));
  return { n };
}
export function retirarTudoDoCofre(e) {
  if (!podeCofre(e)) return { erro: 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.' };
  const c = cofreDe(e), n = Math.min(c.itens.length, espacosLivres(e));
  if (!c.itens.length) return { erro: 'O cofre está vazio.' };
  if (n <= 0) return { erro: 'Sua mochila está cheia.' };
  e.mochila.push(...c.itens.splice(0, n));
  return { n };
}
export function depositarOuro(e, n) {
  if (!podeCofre(e)) return 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.';
  const c = cofreDe(e), q = Math.min(Math.floor(Number(n) || 0), Math.floor(e.ouro));
  if (!(q > 0)) return 'Você não tem esse ouro para guardar.';
  e.ouro -= q; c.ouro += q;
  return null;
}
export function sacarOuro(e, n) {
  if (!podeCofre(e)) return 'O cofre abre na Fonte e com o Burrinho de Carga nas cidades de Runeterra.';
  const c = cofreDe(e), q = Math.min(Math.floor(Number(n) || 0), c.ouro);
  if (!(q > 0)) return 'Não há esse ouro no cofre.';
  c.ouro -= q; e.ouro += q;
  return null;
}

// viagem pelo mapa: da base ou de outro local de caça
export function viajar(estado, c, id) {
  if (!LOCAL[id] || c.darius.morto > 0 || id === estado.local) return false;
  if (LOCAL[id].base) c.darius.disciplina = 0;
  estado.local = id; c.inimigos = []; c.respawn = 1.2; c.darius.recall = 0;
  return true;
}
// Runeterra: "em combate" por EM_COMBATE_MUNDO segundos depois de levar dano, com PvP recente ou com monstro em cima.
// Em combate não dá para voltar para a Fonte nem viajar (senão dava para fugir de uma luta)
export const EM_COMBATE_MUNDO = 6;
function apanhouNoMundo(c) {
  c.arena.apanhou = EM_COMBATE_MUNDO;
  if (c.darius.recall > 0) { c.darius.recall = 0; emitir(c, 'recallCancelado', { dano: true }); }
}
export const emCombate = (c) => !!c.arena?.mundo && ((c.arena.combatePvp || 0) > 0 || (c.arena.apanhou || 0) > 0 || c.inimigos.some((i) => i.aggro && i.hp > 0 && !i.morto));
// Esc cancela o retorno à base (p658)
export function cancelarRecall(c) { if (!(c.darius.recall > 0)) return false; c.darius.recall = 0; emitir(c, 'recallCancelado', {}); return true; }
export function voltarBase(estado, c) {
  if (naBase(estado) || c.darius.morto > 0 || c.darius.recall > 0) return false;
  if (LOCAL[estado.local]?.arena && emCombate(c)) return false;
  c.darius.recall = estado.buffBarao > 0 ? BARAO.recall : RECALL; emitir(c, 'recall', { dur: c.darius.recall }); return true;
}

// ---------- Chefes com mecânica própria ----------
export const MECANICAS = { 'Arauto do Vale': 'investida', 'Dragão Infernal': 'sopro', 'Barão Nashor': 'invocar' };
export const BARAO = { duracao: 180, dano: 0.25, regen: 0.5, recall: 2 };
// o rodízio de habilidades de cada chefe (a primeira é a de sempre): tempo de aviso (carrega) e o que faz no golpe
export const HAB_CHEFE = {
  investida: { carrega: 1.5, espera: 8, nome: 'Investida' },
  pancada: { carrega: 1.2, espera: 7, nome: 'Pancada Sísmica' },
  olho: { carrega: 1.3, espera: 8, nome: 'Olho do Arauto' },
  sopro: { carrega: 1, espera: 9, nome: 'Sopro de Fogo' },
  chuva: { carrega: 1.1, espera: 9, nome: 'Chuva de Fogo' },
  rugido: { carrega: 0.8, espera: 7, nome: 'Rugido do Dragão' },
  invocar: { carrega: 0, espera: 14, nome: 'Invocar Larvas' },
  acido: { carrega: 1, espera: 9, nome: 'Ácido Corrosivo' },
  tentaculos: { carrega: 1.3, espera: 9, nome: 'Tentáculos do Vazio' },
};
export const RODIZIO_CHEFE = { 'Arauto do Vale': ['investida', 'pancada', 'olho'], 'Dragão Infernal': ['sopro', 'chuva', 'rugido'], 'Barão Nashor': ['invocar', 'tentaculos', 'acido'] };
function mecanicaChefe(estado, c, a, i, dt) {
  const rodizio = RODIZIO_CHEFE[i.nome];
  if (!rodizio) return;
  i.tMec ??= 5; i.mecK ??= 0;
  if (i.furiaT > 0) { i.furiaT -= dt; if (i.furiaT <= 0) i.as /= 1.5; }        // o Rugido acaba
  if (i.carregando > 0) {
    const tipo = i.mecAtual;
    // o Avanço Noxiano (e qualquer atordoamento) interrompe o que o chefe está preparando
    if (i.atordoado > 0 && tipo !== 'rugido') { i.carregando = 0; i.tMec = 6; emitir(c, 'chefeInterrompido', { alvo: i.id }); return; }
    i.carregando -= dt;
    if (i.carregando > 0) return;
    i.carregando = 0;
    if (GOLPES_DE_LONGE.has(tipo) && ventoSegura(c, i)) {          // a Parede de Vento do Yasuo segura o golpe
      emitir(c, 'chefeGolpe', { alvo: i.id, mec: tipo, bloqueado: true });
      i.tMec = HAB_CHEFE[tipo].espera;
      return;
    }
    emitir(c, 'chefeGolpe', { alvo: i.id, mec: tipo });
    const fn = fatorDanoMonstro(estado, i);
    const fis = (k) => receberDano(estado, c, a, mitigar(i.ad * k, a.armadura) * fn, false);
    const mag = (k) => receberDano(estado, c, a, mitigar(i.ad * k, a.rm) * fn, false, true);
    if (tipo === 'investida') fis(3.5);
    else if (tipo === 'pancada') { fis(2.2); for (const o of c.inimigos) if (o !== i && o.hp > 0) o.chegada = Math.max(o.chegada, 0); }
    else if (tipo === 'olho') mag(2.6);
    else if (tipo === 'sopro') { mag(2.2); c.darius.queimando = 4; c.darius.queimaDano = a.vida * 0.03; }
    else if (tipo === 'chuva') { mag(1.8); c.darius.queimando = Math.max(c.darius.queimando || 0, 3); c.darius.queimaDano = a.vida * 0.025; }
    else if (tipo === 'rugido') { i.as *= 1.5; i.furiaT = 5; }
    else if (tipo === 'acido') { mag(1.2); c.darius.queimando = 5; c.darius.queimaDano = a.vida * 0.028; }
    else if (tipo === 'tentaculos') fis(2.6);
    i.tMec = HAB_CHEFE[tipo].espera;
    return;
  }
  i.tMec -= dt;
  if (i.tMec > 0) return;
  const tipo = rodizio[i.mecK++ % rodizio.length];
  i.mecAtual = tipo;
  if (tipo === 'invocar') {
    for (let k = 0; k < 2; k++) c.inimigos.push(criarMonstro('Larva do Vazio', Math.max(1, i.nivel - 6), { chegada: 1 + k * 0.3, invocado: true }));
    emitir(c, 'chefeInvoca', { alvo: i.id });
    i.tMec = HAB_CHEFE.invocar.espera;
    return;
  }
  i.carregando = HAB_CHEFE[tipo].carrega;
  emitir(c, 'chefeCarrega', { alvo: i.id, mec: tipo, dur: i.carregando });
}

// ---------- Refino (Ornn, na Fonte) ----------
// onde: 'itens' (equipados) ou 'mochila'
// receita: os componentes (ids) e o ouro de montagem. Usa primeiro a mochila, depois o equipamento.
// cada tentativa de montagem custa o ouro da receita multiplicado (intermediário x3, lendário x45)
export const MULT_CUSTO_MONTAR = { epico: 3, lendario: 45 };
// lendários: o custo de cada tentativa segue o preço total do item (média ~15 mil, de ~11,8 mil a ~16,8 mil). Antes vinha do
// "ouro da receita" do LoL, que varia muito de item para item (a Hidra Titânica saía 20x mais barata que outros).
export const CUSTO_LENDARIO_POR_PRECO = 4.8;
const custoMontar = (i) => (raridade(i) === 'lendario' ? Math.round((i.preco * CUSTO_LENDARIO_POR_PRECO) / 50) * 50 : (i.custo || 0) * (MULT_CUSTO_MONTAR[raridade(i)] || 1));
export function receitaDe(id) { const i = ITENS[id]; return i?.de?.length ? { de: i.de, custo: custoMontar(i) } : null; }
// o que falta para montar (componentes que o jogador não tem) e se dá
// escolha: [{ onde, k }] — as peças que o jogador colocou na bancada (cada uma tem que bater com um componente da receita)
export function analisarMontagem(estado, id, escolha = null) {
  const rec = receitaDe(id); if (!rec) return null;
  if (escolha) {
    const usa = [], vistos = new Set(), resta = [...rec.de];
    for (const u of escolha) {
      const onde = u?.onde === 'itens' ? 'itens' : u?.onde === 'mochila' ? 'mochila' : null, k = Number(u?.k);
      if (!onde || !Number.isInteger(k) || !estado[onde][k] || vistos.has(onde + k)) continue;
      const j = resta.indexOf(baseId(estado[onde][k]));
      if (j < 0) continue;
      resta.splice(j, 1); vistos.add(onde + k); usa.push({ onde, k, b: baseId(estado[onde][k]) });
    }
    return { ...rec, usa, faltam: resta, pode: !resta.length && estado.ouro >= rec.custo };
  }
  const sobra = [...estado.mochila.map((x, k) => ({ onde: 'mochila', k, b: baseId(x) })), ...estado.itens.map((x, k) => ({ onde: 'itens', k, b: baseId(x) }))];
  const usa = [], faltam = [];
  for (const c of rec.de) { const j = sobra.findIndex((x) => x.b === c); if (j >= 0) usa.push(sobra.splice(j, 1)[0]); else faltam.push(c); }
  return { ...rec, usa, faltam, pode: !faltam.length && estado.ouro >= rec.custo };
}
// chance de cada tentativa: intermediário 1%, lendário 0,1% (VIP +20%). Cada tentativa gasta o ouro (receita x3 ou x45);
// as peças só saem quando dá certo. Com a persistência, em média ~60 tentativas por um intermediário e ~550 (~8 milhões
// de ouro) por um lendário (out/2026: era 0,5% e 0,05%, ~115 e ~1.100 tentativas). Ver _raw/economia.mjs.
export const CHANCE_MONTAR = { epico: 0.01, lendario: 0.001 };      // out/2026: 2x mais fácil (antes 0,5% e 0,05%)
export const chanceMontar = (estado, id) => Math.min(0.5, (CHANCE_MONTAR[raridade(ITENS[id])] ?? 1) * (ehVip(estado) ? VIP.refino : 1));
export const chanceMontarAgora = (estado, id) => comPersistencia(chanceMontar(estado, id), falhasMontar(estado, id), PERSISTENCIA.montar[raridade(ITENS[id])]);
// tenta até "vezes" (ou até acabar o ouro / dar certo); devolve { erro } ou { sucesso, tentativas, gasto }
export function montarVarias(estado, id, vezes = 1, escolha = null, gema = null) {
  let tentativas = 0, gasto = 0, gemas = 0;
  for (; tentativas < vezes; ) {
    const ouro = estado.ouro, r = montarItem(estado, id, escolha, gema);
    if (r.erro) return tentativas ? { sucesso: false, tentativas, gasto, gemas, parou: r.erro } : r;
    tentativas++; gasto += ouro - estado.ouro; if (r.gema) gemas++;
    if (r.sucesso) return { sucesso: true, tentativas, gasto, gemas, item: r.item };
  }
  return { sucesso: false, tentativas, gasto, gemas };
}
// devolve { erro } se não dá para montar, ou { sucesso: true/false } (o sorteio é feito aqui; no jogo, pelo servidor)
export function montarItem(estado, id, escolha = null, gema = null) {
  if (!naBase(estado)) return { erro: t('O Ornn fica na Fonte.') };
  const a = analisarMontagem(estado, id, escolha);
  if (!a) return { erro: t('Esse item não tem receita.') };
  if (a.faltam.length) return { erro: t('Faltam componentes: {lista}.', { lista: a.faltam.map((c) => ITENS[c].nome).join(', ') }) };
  if (estado.ouro < a.custo) return { erro: t('Faltam {n} de ouro.', { n: a.custo - estado.ouro }) };
  // se der certo o item novo vai para a mochila: confere o espaço antes (os componentes da mochila liberam lugar)
  if (espacosLivres(estado) + a.usa.filter((u) => u.onde === 'mochila').length <= 0) return { erro: t('Sua mochila está cheia.') };
  const persiste = !!PERSISTENCIA.montar[raridade(ITENS[id])];
  const g = podeUsarGema(estado, gema, 'montar') ? GEMAS[gema] : null;
  if (g) gastarGema(estado, gema);
  if (Math.random() >= Math.min(1, chanceMontarAgora(estado, id) * (g?.mult || 1))) { estado.ouro -= a.custo; if (persiste) anotarFalha(estado, 'montar', id, true); return { sucesso: false, gema: g ? gema : null }; }
  if (persiste) anotarFalha(estado, 'montar', id, false);
  // a qualidade do item montado: sorteada, melhor se as peças forem boas
  const qual = sortearQualidade(bonusMontagem(a.usa.map((u) => estado[u.onde][u.k])));
  // tira os componentes (de trás para frente, para os índices não mudarem)
  for (const onde of ['mochila', 'itens']) for (const u of a.usa.filter((x) => x.onde === onde).sort((x, y) => y.k - x.k)) estado[onde].splice(u.k, 1);
  estado.ouro -= a.custo;
  estado.mochila.push(comItem(id, 0, qual));
  if (ITENS[id].lendario) estado.totais.lendarios = (estado.totais.lendarios || 0) + 1;
  limitarVida(estado);
  return { sucesso: true, gema: g ? gema : null, item: comItem(id, 0, qual) };
}

// gema: id da gema escolhida (gasta uma nesta tentativa, se tiver e se servir para a forja)
export function forjar(estado, onde, k, gema = null) {
  const lista = estado[onde], x = lista?.[k];
  if (!naBase(estado) || !x) return null;
  const ref = refinoDe(x);
  if (ref >= REFINO_MAX) return { maximo: true };
  const preco = precoRefino(x);
  if (estado.ouro < preco) return { semOuro: true, preco };
  estado.ouro -= preco;
  const g = podeUsarGema(estado, gema, 'forja') ? GEMAS[gema] : null;
  if (g) gastarGema(estado, gema);
  migrarPersistencia(estado);
  const sucesso = Math.random() < Math.min(1, chanceForjaAgora(estado, ref, x) * (g?.mult || 1));
  if (PERSISTENCIA.forja[ref + 1]) anotarFalha(estado, 'forja', chaveForja(ref + 1, x), !sucesso);
  let regrediu = false, protegeu = false;
  if (sucesso) lista[k] = comRefino(x, ref + 1);
  else if (Math.random() < REGRESSAO_REFINO[ref]) {
    if (g?.protege) protegeu = true;                         // a Gema de Proteção segurou o item no nível
    else { lista[k] = comRefino(x, ref - 1); regrediu = true; }
  }
  if (onde === 'itens') limitarVida(estado);
  return { sucesso, regrediu, protegeu, preco, item: lista[k], gema: g ? gema : null };
}
// forja várias vezes seguidas: para no sucesso, na regressão ou quando acaba o ouro; a gema escolhida é gasta
// uma por tentativa enquanto houver (depois as tentativas seguem sem ela)
export function forjarVarias(estado, onde, k, vezes = 1, gema = null) {
  let tentativas = 0, gasto = 0, gemas = 0, protegeu = 0, r = null;
  while (tentativas < vezes) {
    r = forjar(estado, onde, k, gema);
    if (!r || r.maximo || r.semOuro) return tentativas ? { sucesso: false, regrediu: false, tentativas, gasto, gemas, protegeu, item: estado[onde][k], parou: r?.semOuro ? 'ouro' : null } : r;
    tentativas++; gasto += r.preco; if (r.gema) gemas++; if (r.protegeu) protegeu++;
    if (r.sucesso || r.regrediu) break;
  }
  return { ...r, tentativas, gasto, gemas, protegeu };
}

// ---------- Tarefas de caça (Capitão da Legião) ----------
// O Capitão oferece 3 tarefas com monstros dos lugares ideais para o nível; a recompensa é entregue na Fonte.
export const QTDS = [80, 100, 120, 150, 200];
// recompensa máxima de uma tarefa (a mesma conta de criarOfertas); o servidor usa para aceitar a entrega
// tarefas por zona (out/2026, pedido de jogadores: as tarefas caíam em zonas fáceis e demoravam): qualquer monstro da zona conta.
// Tipos: rápida e normal na sua zona ideal, desafio na zona de cima (sem zona acima, uma longa na sua). min: os minutos que a
// tarefa leva no ritmo típico da zona (ABATES_MIN_ZONA, medido); xp/ouro: a fração da XP/ouro dos próprios abates que vem de prêmio.
// 09/10/2026 (2ª vez): o ouro voltou ao nível das tarefas de antes (jogadores: "não paga nem as poções"), e entraram a Caça
// (uma espécie da zona) e a Fúria (monstros furiosos da zona), sorteadas junto (jogadores: "sempre as mesmas 3")
export const TAREFA_TIPOS = {
  rapida: { min: 7, xp: 0.42, ouro: 0.55 }, normal: { min: 15, xp: 0.43, ouro: 0.55 },
  desafio: { min: 15, xp: 0.44, ouro: 0.5 }, longa: { min: 25, xp: 0.42, ouro: 0.55 },
  especie: { min: 12, xp: 0.42, ouro: 0.55 }, furioso: { min: 16, xp: 0.42, ouro: 0.55 },
};
// 09/10/2026 à noite (jogador: "tem quests muito melhores que as outras"): os fatores acima deixam todas pagando ~45% da XP
// de caçar por minuto (o Desafio um pouco mais na maioria dos níveis, a zona é mais difícil); antes o Desafio pagava o dobro da Normal nos níveis 28 a 34.
// Ritmo real: quem joga mata ~1,5x mais rápido que os bots que mediram ABATES_MIN_ZONA (média de caça dos saves, níveis 10
// a 22: 1,4x a 2x, com o prêmio das tarefas junto), então a quantidade e o tempo mostrado usam ritmoZona.
export const RITMO_REAL = 1.5;
const ritmoZona = (id) => (ABATES_MIN_ZONA[id] || 7) * RITMO_REAL;
export const TAREFA_VERSAO = 2;       // ofertas guardadas de outra versão são sorteadas de novo
const fracaoEspecie = (l, nome) => { const tot = l.monstros.reduce((s2, [, f]) => s2 + f, 0), m = l.monstros.find(([n]) => n === nome); return m ? m[1] / tot : 0; };
// quantos abates de qualquer monstro da zona a tarefa vale (o tempo que ela leva): a Caça conta só uma espécie e a Fúria
// só os furiosos (um a cada ~1/(FURIOSO.chance/3) abates: um grupo tem 3 monstros em média)
export function abatesEquivalentes(t) {
  const l = LOCAL[t.local];
  if (t.tipo === 'especie') { const f = fracaoEspecie(l, t.monstro); return f ? t.qtd / f : 0; }
  if (t.tipo === 'furioso') return t.qtd * (3 / FURIOSO.chance);
  return t.qtd;
}
export const minutosTarefa = (t) => Math.max(1, Math.round(abatesEquivalentes(t) / ritmoZona(t.local)));
export const ABATES_MIN_ZONA = { 'rota-inf': 18, 'rota-sup': 13, lobos: 11, azul: 6.5, vermelho: 7, rio: 7.5, dragao: 7, barao: 7.5 };
export const zonaIdeal = (n) => [...LOCAIS].reverse().find((l) => l.faixa && !l.arena && n >= l.faixa[0]) || LOCAIS.find((l) => l.faixa && !l.arena);
const zonaAcima = (l) => LOCAIS.filter((x) => x.faixa && !x.arena && x.faixa[0] > l.faixa[0]).sort((a, b) => a.faixa[0] - b.faixa[0])[0] || null;
// XP e ouro médios de um abate na zona (pelos monstros comuns, no nível do meio da zona; sem bônus)
export function porAbateZona(l) {
  const nm = (l.nm[0] + l.nm[1]) / 2, tot = l.monstros.reduce((s, [, f]) => s + f, 0);
  let xp = 0, ouro = 0;
  for (const [m, f] of l.monstros) { xp += (f / tot) * CURVA.xp(nm) * MONSTROS[m].xp; ouro += (f / tot) * CURVA.ouro(nm) * MONSTROS[m].ouro; }
  return { xp, ouro };
}
export function recompensaTarefa(t) {
  if (t?.tipo) {          // tarefa por zona (e a Caça e a Fúria, que valem pelos abates equivalentes)
    const T = TAREFA_TIPOS[t.tipo], l = LOCAL[t.local];
    if (!T || !l?.nm || !l.faixa || l.arena || !Number.isInteger(t.qtd)) return null;
    if (t.tipo === 'especie' ? !fracaoEspecie(l, t.monstro) || t.qtd < 5 || t.qtd > 500 : t.tipo === 'furioso' ? t.qtd < 1 || t.qtd > 5 : t.qtd < 10 || t.qtd > 1000) return null;
    const z = porAbateZona(l), eq = abatesEquivalentes(t);
    return { xp: Math.round(eq * z.xp * T.xp), ouro: Math.round(eq * z.ouro * T.ouro) };
  }
  const l = LOCAL[t?.local], m = MONSTROS[t?.monstro];
  if (!l?.nm || !m || !QTDS.includes(t.qtd)) return null;
  const nm = (l.nm[0] + l.nm[1]) / 2;
  return { xp: Math.round(t.qtd * CURVA.xp(nm) * m.xp * 0.6), ouro: Math.round(t.qtd * CURVA.ouro(nm) * m.ouro * 0.75) };
}
// recompensa em item: tarefa grande (150+ abates) garante um item (básico, 12% de ser épico, 0,05% de ser lendário);
// as outras têm 30% de chance de um básico. O sorteio é feito na entrega, e as chances aparecem na oferta.
// a chance de épico e de lendário da tarefa acompanha o drop do lugar: vale metade do que aqueles abates dropariam
// (200 Tropas na Rota Inferior: 5% de épico; 200 no Covil do Barão: ~15%). Se não sair, a grande garante um básico
// e a pequena tem 30% de chance de um básico.
export const ITEM_TAREFA = { fator: 0.5, fatorZona: 0.3, pequena: 0.3 };      // por zona todo abate conta: a chance por abate é menor
export function chancesItemTarefa(t) {
  const l = LOCAL[t.local], ch = l?.drops ? chancesDrop(l) : { lendario: 0, epico: 0 }, q = t.tipo && l ? abatesEquivalentes(t) : Number(t.qtd) || 0, f = t.tipo ? ITEM_TAREFA.fatorZona : ITEM_TAREFA.fator;
  return { lendario: Math.min(0.05, q * ch.lendario * f), epico: Math.min(0.5, q * ch.epico * f) };
}
// raridade do item que a tarefa dá agora ('grande' e 'pequena' sorteiam; tarefas antigas já vinham com a raridade)
function raridadeTarefa(t) {
  if (t.item !== 'grande' && t.item !== 'pequena') return t.item || null;     // tarefas antigas já vinham com a raridade
  const ch = chancesItemTarefa(t), r = Math.random();
  if (r < ch.lendario) return 'lendario';
  if (r < ch.lendario + ch.epico) return 'epico';
  return t.item === 'grande' || Math.random() < ITEM_TAREFA.pequena ? 'basico' : null;
}
// Cada vez sai diferente (pedido de jogador: "sempre as mesmas"): a quantidade varia ±20% (a recompensa vai junto, então
// o que se ganha por minuto não muda) e a segunda oferta é Normal ou Longa; sem zona acima, a terceira é a outra das duas.
// A 1ª é Rápida ou uma Caça na sua zona; a 2ª, Normal/Longa, Caça ou Fúria; a 3ª, o Desafio da zona de cima (ou mais uma da sua).
function criarOfertas(estado) {
  const z = zonaIdeal(estado.nivel), cima = zonaAcima(z), r = Math.random, var_ = () => 0.8 + r() * 0.4;
  const fechar = (o, grande) => ({ ...o, ...recompensaTarefa(o), item: grande ? 'grande' : 'pequena' });
  const zona = (tipo, l) => fechar({ tipo, local: l.id, qtd: Math.max(20, Math.round((TAREFA_TIPOS[tipo].min * ritmoZona(l.id) * var_()) / 10) * 10) }, tipo === 'desafio' || tipo === 'longa');
  const especie = (l, sem) => {
    const lista = l.monstros.filter(([n]) => n !== sem), tot = lista.reduce((s2, [, f]) => s2 + f, 0);
    let x = r() * tot, nome = lista[0][0];
    for (const [n, f] of lista) if ((x -= f) < 0) { nome = n; break; }
    const qtd = Math.max(10, Math.round((TAREFA_TIPOS.especie.min * ritmoZona(l.id) * fracaoEspecie(l, nome) * var_()) / 5) * 5);
    return fechar({ tipo: 'especie', local: l.id, monstro: nome, qtd }, false);
  };
  const furioso = (l) => fechar({ tipo: 'furioso', local: l.id, qtd: r() < 0.6 ? 3 : 4 }, true);
  const primeira = r() < 0.5 ? zona('rapida', z) : especie(z);
  const opcoes = [() => zona(r() < 0.6 ? 'normal' : 'longa', z), () => furioso(z), ...(primeira.tipo === 'especie' && z.monstros.length < 2 ? [] : [() => especie(z, primeira.monstro)])];
  const k = Math.floor(r() * opcoes.length), segunda = opcoes.splice(k, 1)[0]();
  const terceira = cima ? zona('desafio', cima) : opcoes[Math.floor(r() * opcoes.length)]();
  return [primeira, segunda, terceira];
}
// as ofertas de antes (por espécie, em qualquer zona perto do nível): ficaram só para referência
function criarOfertasAntigas(estado) {
  const n = estado.nivel;
  let locais = LOCAIS.filter((l) => l.faixa && n >= l.faixa[0] - 2 && n <= l.faixa[1] + 2);
  if (!locais.length) locais = [LOCAIS.find((l) => l.faixa)];
  const especies = new Map();
  for (const l of locais) for (const [m] of l.monstros) if (!especies.has(m)) especies.set(m, l);
  const sorteio = [...especies.entries()].sort(() => Math.random() - 0.5).slice(0, 3);
  return sorteio.map(([monstro, l]) => {
    const qtd = QTDS[Math.floor(Math.random() * QTDS.length)];
    const nm = (l.nm[0] + l.nm[1]) / 2, m = MONSTROS[monstro];
    return {
      monstro, local: l.id, qtd,
      xp: Math.round(qtd * CURVA.xp(nm) * m.xp * 0.6),
      ouro: Math.round(qtd * CURVA.ouro(nm) * m.ouro * 0.75),
      item: qtd >= 150 ? 'grande' : 'pequena',
    };
  });
}
// ---------- Missões diárias (09/10/2026, pedido do dono): uma no Summoner's Rift e uma em Runeterra ----------
// Cada uma uma vez por dia (dia de Brasília): abater qtd monstros do seu nível ou até `abaixo` níveis abaixo (os que dão a
// XP inteira), nunca os invocados; um abate conta só na diária do lugar onde foi. A de Runeterra é caçando você mesmo (um
// bot mata 6 a 12 por minuto lá: 1h30 a 3h) e paga um pouco mais que as tarefas do Capitão (que pagam de 38% a 60% da XP
// dos próprios abates): 75% da XP (com o bônus de Runeterra) e 66% do ouro de 1.000 abates na zona ideal, um épico garantido
// e a chance de ser lendário (27% da chance daqueles abates, até 8%). A do Rift é no automático e paga como as tarefas:
// 50% da XP e do ouro, um épico garantido e 13% da chance de lendário (até 4%). (O lendário era o dobro até 09/10 à noite.)
// O jogo aceita e conta; a entrega é só no servidor (rota /api/diaria), que guarda o dia da última de cada uma
// (diariaFeita, diariaRiftFeita).
export const DIARIA = { qtd: 1000, xp: 0.75, ouro: 0.66, lendario: 0.27, lendarioMax: 0.08, abaixo: 5 };      // lendário: era 0,5 e até 15%
export const DIARIA_RIFT = { qtd: 1000, xp: 0.5, ouro: 0.5, lendario: 0.13, lendarioMax: 0.04, abaixo: 5 };      // lendário: era 0,25 e até 7,5%
export const DIARIAS = {
  rift: { regra: DIARIA_RIFT, campo: 'diariaRift', feita: 'diariaRiftFeita', aqui: (estado) => { const l = LOCAL[estado.local]; return !!l?.faixa && !l.arena; } },
  runeterra: { regra: DIARIA, campo: 'diaria', feita: 'diariaFeita', aqui: (estado) => !!LOCAL[estado.local]?.arena && !LOCAL[estado.local]?.aram },
};
export const diaHoje = (agora = Date.now()) => new Date(agora - 3 * 3600000).toISOString().slice(0, 10);      // Brasília
// ---------- Prêmio diário por entrar (out/2026, pedido do dono) ----------
// Um por dia (de Brasília) por conta. Pegar em dias seguidos sobe a sequência (o ciclo vai do dia 1 ao 7 e recomeça);
// passar um dia inteiro sem pegar volta para o dia 1. O ouro vem em minutos de caça na zona ideal do nível (a mesma
// conta das tarefas), as runas são fixas e o dia 7 dá um épico da classe (qualidade sorteada no servidor).
export const PREMIO_LOGIN = [
  { ouro: 10 },
  { runas: { sorte: 2 } },
  { ouro: 20 },
  { runas: { sorte: 2, protecao: 1 } },
  { ouro: 30 },
  { runas: { sorte: 2, arcana: 1 } },
  { ouro: 45, item: 'epico' },
];
const ouroPorMinuto = (nivel) => { const l = zonaIdeal(nivel); return porAbateZona(l).ouro * ritmoZona(l.id); };
// o prêmio de um dia do ciclo (1 a 7) para o nível
export function premioLoginDe(nivel, dia) {
  const p = PREMIO_LOGIN[(Math.max(1, dia) - 1) % PREMIO_LOGIN.length];
  return { ouro: p.ouro ? Math.max(100, Math.round((p.ouro * ouroPorMinuto(nivel)) / 100) * 100) : 0, runas: p.runas || null, item: p.item || null };
}
// a partir do último prêmio pego ({ dia: 'AAAA-MM-DD', seq } ou null): se já pegou hoje, a sequência e o dia do ciclo
export function proximoLogin(info, agora = Date.now()) {
  const hoje = diaHoje(agora), ontem = diaHoje(agora - 86400000);
  if (info?.dia === hoje) return { pegouHoje: true, seq: info.seq, diaCiclo: ((info.seq - 1) % PREMIO_LOGIN.length) + 1, perdeu: false };
  const seguiu = info?.dia === ontem, seq = seguiu ? info.seq + 1 : 1;
  return { pegouHoje: false, seq, diaCiclo: ((seq - 1) % PREMIO_LOGIN.length) + 1, perdeu: !!info && !seguiu };
}
export function recompensaDiaria(nivel, tipo = 'runeterra') {
  const Rg = DIARIAS[tipo].regra, l = zonaIdeal(nivel), z = porAbateZona(l), ch = chancesDrop(l);
  return { xp: Math.round(Rg.qtd * z.xp * (tipo === 'runeterra' ? ARENA.bonus : 1) * Rg.xp), ouro: Math.round(Rg.qtd * z.ouro * Rg.ouro),
    lendario: Math.min(Rg.lendarioMax, Rg.qtd * ch.lendario * Rg.lendario) };
}
export const podeAceitarDiaria = (estado, agora = Date.now(), tipo = 'runeterra') => { const D = DIARIAS[tipo]; return !estado[D.campo] && estado[D.feita] !== diaHoje(agora); };
export function aceitarDiaria(estado, tipo = 'runeterra') {
  const D = DIARIAS[tipo];
  if (!D || !podeAceitarDiaria(estado, Date.now(), tipo)) return false;
  estado[D.campo] = { dia: diaHoje(), qtd: D.regra.qtd, feitos: 0 };
  return true;
}
export const diariaPronta = (estado, tipo = 'runeterra') => { const d = estado[DIARIAS[tipo].campo]; return !!d && d.feitos >= d.qtd; };
function contarDiaria(estado, i) {
  if (i.invocado) return;
  for (const D of Object.values(DIARIAS)) {
    const d = estado[D.campo];
    if (d && d.feitos < d.qtd && D.aqui(estado) && (i.nivel || 0) >= estado.nivel - D.regra.abaixo) d.feitos++;
  }
}
// a entrega (só no servidor): XP, ouro e o item; devolve null se não pode, ou { mochilaCheia }
export function entregarDiaria(estado, c = null, agora = Date.now(), tipo = 'runeterra') {
  const D = DIARIAS[tipo];
  if (!D || !diariaPronta(estado, tipo) || estado[D.feita] === diaHoje(agora)) return null;
  if (mochilaCheia(estado)) return { mochilaCheia: true };
  const r = recompensaDiaria(estado.nivel, tipo), rar = Math.random() < r.lendario ? 'lendario' : 'epico';
  const item = comItem(escolher(POR_CLASSE[classeDe(estado)][rar]), 0, sortearQualidade());
  estado.mochila.push(item);
  if (rar === 'lendario') estado.totais.lendarios = (estado.totais.lendarios || 0) + 1;
  estado.ouro += r.ouro; estado.totais.ouro += r.ouro;
  ganharXp(estado, c, r.xp);
  estado[D.campo] = null; estado[D.feita] = diaHoje(agora);
  estado.totais.diarias = (estado.totais.diarias || 0) + 1;
  return { xp: r.xp, ouro: r.ouro, item, tipo };
}
export const TROCAR_TAREFAS_MIN = 10;      // de quanto em quanto tempo o Capitão troca as ofertas (sozinho, ou pelo botão Outras tarefas)
export function ofertasTarefa(estado) {
  const z = zonaIdeal(estado.nivel).id, velhas = estado.ofertas && Date.now() - (estado.ofertas.em || 0) >= TROCAR_TAREFAS_MIN * 60000;
  if (!estado.ofertas || velhas || estado.ofertas.zona !== z || !estado.ofertas.lista?.[0]?.tipo || estado.ofertas.v !== TAREFA_VERSAO) estado.ofertas = { v: TAREFA_VERSAO, nivel: estado.nivel, zona: z, em: Date.now(), lista: criarOfertas(estado) };
  return estado.ofertas.lista;
}
// troca as ofertas (de graça, a cada TROCAR_TAREFAS_MIN minutos); devolve os segundos que faltam, ou 0 se trocou
export function trocarOfertas(estado) {
  ofertasTarefa(estado);
  const falta = estado.ofertas.em + TROCAR_TAREFAS_MIN * 60000 - Date.now();
  if (falta > 0) return Math.ceil(falta / 1000);
  estado.ofertas = { v: TAREFA_VERSAO, nivel: estado.nivel, zona: zonaIdeal(estado.nivel).id, em: Date.now(), lista: criarOfertas(estado) };
  return 0;
}
export function aceitarTarefa(estado, k) {
  // a oferta que estava na tela, mesmo que os 10 min tenham passado com a janela aberta (senão aceitaria outra)
  const o = (estado.ofertas?.lista?.[0]?.tipo ? estado.ofertas.lista : ofertasTarefa(estado))[k];
  if (!o || estado.tarefa || !naBase(estado)) return false;
  estado.tarefa = { ...o, feitos: 0 };
  estado.ofertas = null;
  return true;
}
function contarTarefa(estado, c, nome, furioso = false) {
  const t = estado.tarefa;
  if (!t || t.feitos >= t.qtd) return;
  if (t.tipo) {                     // por zona: qualquer monstro dela; a Caça, só a espécie; a Fúria, só os furiosos
    if (estado.local !== t.local || (t.tipo === 'especie' && t.monstro !== nome) || (t.tipo === 'furioso' && !furioso)) return;
  } else if (t.monstro !== nome) return;
  t.feitos++;
  if (t.feitos === t.qtd) emitir(c, 'tarefaPronta', { monstro: t.monstro, local: t.local });
}
export const tarefaPronta = (estado) => !!estado.tarefa && estado.tarefa.feitos >= estado.tarefa.qtd;
export function entregarTarefa(estado, c) {
  const t = estado.tarefa;
  if (!naBase(estado) || !tarefaPronta(estado)) return null;
  if (t.item && mochilaCheia(estado)) return { mochilaCheia: true };
  const max = recompensaTarefa(t);       // aceita antes de um rebalanço: paga no máximo o de agora (o anticheat confere assim)
  if (max) { t.xp = Math.min(Number(t.xp) || 0, max.xp); t.ouro = Math.min(Number(t.ouro) || 0, max.ouro); }
  const rar = raridadeTarefa(t), item = rar ? escolher(POR_CLASSE[classeDe(estado)][rar]) : null;
  if (item) { estado.mochila.push(comItem(item, 0, '?')); if (ITENS[item].lendario) estado.totais.lendarios = (estado.totais.lendarios || 0) + 1; }
  estado.ouro += t.ouro; estado.totais.ouro += t.ouro;
  ganharXp(estado, c, t.xp);
  estado.tarefa = null;
  estado.totais.tarefas = (estado.totais.tarefas || 0) + 1;
  return { ouro: t.ouro, xp: t.xp, item };
}
export function cancelarTarefa(estado) {
  if (!estado.tarefa) return false;
  estado.tarefa = null; return true;
}

// ---------- Conquistas e títulos ----------
// prog devolve [atual, alvo] para mostrar o andamento; bonus é permanente depois de liberada
const abatidos = (e, nome) => e.totais.porMonstro?.[nome] || 0;
export const CONQUISTAS = [
  { id: 'sangue', nome: 'Primeiro Sangue', desc: 'Abata seu primeiro monstro', titulo: 'o Recruta', prog: (e) => [e.totais.abates, 1] },
  { id: 'centuriao', nome: 'Centurião', desc: 'Abata 1.000 monstros', titulo: 'Centurião', bonus: { ad: 0.02 }, prog: (e) => [e.totais.abates, 1000] },
  { id: 'carniceiro', nome: 'Carniceiro de Noxus', desc: 'Abata 10.000 monstros', titulo: 'o Carniceiro', bonus: { ad: 0.03 }, prog: (e) => [e.totais.abates, 10000] },
  { id: 'veterano', nome: 'Veterano', desc: 'Chegue ao nível 25', titulo: 'o Veterano', bonus: { vida: 0.02 }, prog: (e) => [e.nivel, 25] },
  { id: 'mao', nome: 'A Mão de Noxus', desc: 'Chegue ao nível 50', titulo: 'a Mão de Noxus', bonus: { ad: 0.03, vida: 0.03 }, prog: (e) => [e.nivel, 50] },
  { id: 'imortal', nome: 'Imortal', desc: 'Chegue ao nível 30 sem morrer nenhuma vez', titulo: 'o Imortal', bonus: { armadura: 0.03 }, ok: (e) => e.nivel >= 30 && e.totais.mortes === 0 },
  { id: 'arauto', nome: 'Caçador de Arautos', desc: 'Derrote o Arauto do Vale', titulo: 'Caçador de Arautos', bonus: { vida: 0.02 }, prog: (e) => [abatidos(e, 'Arauto do Vale'), 1] },
  { id: 'dragao', nome: 'Matador de Dragões', desc: 'Derrote o Dragão Infernal', titulo: 'Matador de Dragões', bonus: { rm: 0.03 }, prog: (e) => [abatidos(e, 'Dragão Infernal'), 1] },
  { id: 'barao', nome: 'Carrasco do Barão', desc: 'Derrote o Barão Nashor', titulo: 'Carrasco do Barão', bonus: { ad: 0.03 }, prog: (e) => [abatidos(e, 'Barão Nashor'), 1] },
  { id: 'soldado', nome: 'Soldado Dedicado', desc: 'Complete 10 tarefas', titulo: 'Soldado Dedicado', bonus: { ouro: 0.05 }, prog: (e) => [e.totais.tarefas || 0, 10] },
  { id: 'mercador', nome: 'Mercador', desc: 'Venda 100 itens', titulo: 'o Mercador', bonus: { ouro: 0.05 }, prog: (e) => [e.totais.vendidos || 0, 100] },
  { id: 'sortudo', nome: 'Sortudo', desc: 'Encontre um item lendário', titulo: 'o Sortudo', prog: (e) => [e.totais.lendarios || 0, 1] },
  { id: 'vilemaw', nome: 'Matador de Vilemaw', desc: 'Ajude a vencer a Vilemaw', titulo: 'Matador de Vilemaw', prog: (e) => [e.totais.vilemaw || 0, 1] },
  { id: 'ferreiro', nome: 'Discípulo de Ornn', desc: 'Tenha um item +5', titulo: 'Discípulo de Ornn', bonus: { armadura: 0.02 }, ok: (e) => [...e.itens, ...e.mochila].some((x) => refinoDe(x) >= REFINO_MAX) },
  { id: 'rico', nome: 'Tesouro de Noxus', desc: 'Ganhe 1.000.000 de ouro ao todo', titulo: 'o Magnata', bonus: { ouro: 0.05 }, prog: (e) => [e.totais.ouro, 1e6] },
  { id: 'colecionador', nome: 'Colecionador', desc: 'Tenha 3 skins', titulo: 'o Colecionador', prog: (e) => [(e.skins || [0]).length, 3] },
];
const cumpriu = (c, e) => (c.ok ? c.ok(e) : c.prog(e)[0] >= c.prog(e)[1]);
function bonusConquistas(estado) {
  const b = { ad: 0, vida: 0, armadura: 0, rm: 0, ouro: 0 };
  for (const c of CONQUISTAS) if (c.bonus && estado.conquistas?.includes(c.id)) for (const [k, v] of Object.entries(c.bonus)) b[k] += v;
  return b;
}
// marca as conquistas recém-cumpridas e devolve quais foram
export function verificarConquistas(estado) {
  estado.conquistas ??= [];
  const novas = CONQUISTAS.filter((c) => !estado.conquistas.includes(c.id) && cumpriu(c, estado));
  for (const c of novas) estado.conquistas.push(c.id);
  return novas;
}
export function escolherTitulo(estado, id) {
  if (id && !estado.conquistas?.includes(id)) return false;
  estado.titulo = id || null; return true;
}
export const tituloAtual = (estado) => CONQUISTAS.find((c) => c.id === estado.titulo)?.titulo || null;

// ---------- Mascotes ----------
export const MASCOTE_MAX = 20;
export const MASCOTES = {
  poro: { nome: 'Poro', preco: 2000, desc: 'Corre pegar o ouro dos monstros: +1% de ouro por nível.', bonus: (n) => ({ ouro: 0.01 * n }) },
  krug: { nome: 'Krugzinho', preco: 8000, desc: 'Casca de pedra: +1% de armadura e de res. mágica por nível.', bonus: (n) => ({ armadura: 0.01 * n, rm: 0.01 * n }) },
  dragao: { nome: 'Dragãozinho', req: { texto: 'Derrote o Dragão Infernal', ok: (e) => (e.totais.porMonstro?.['Dragão Infernal'] || 0) > 0 },
    desc: 'Cospe fogo no alvo a cada 2,5s (25% do dano +3% por nível). Em personagem AP, usa também o Poder de Habilidade.', ataque: (n) => 0.25 + 0.03 * n },
  // só o servidor dá (especial): no Baú da Vilemaw ou com 30 dias seguidos de prêmio diário; vale para a conta toda
  aranha: { nome: 'Aranhinha', especial: true, req: { texto: 'Cai do Baú da Vilemaw ou vem com 30 dias seguidos de prêmio diário', ok: (e) => !!e.mascotes?.aranha },
    desc: 'Filhote da Vilemaw: morde o alvo a cada 3s (22% do dano +2,5% por nível) e acha um pouco mais de itens (+0,25% de chance por nível). Em personagem AP, usa também o Poder de Habilidade.', ataque: (n) => 0.22 + 0.025 * n, intervalo: 3,
    bonus: (n) => ({ itens: 0.0025 * n }) },
  // só o servidor dá: 1% por vitória na Dungeon do Braum, sem garantia (p675, p679)
  poroBigode: { nome: 'Poro de Bigode', especial: true, negociavel: true, req: { texto: 'Cai da Dungeon do Braum', ok: (e) => !!e.mascotes?.poroBigode },
    desc: 'O poro favorito do Braum: corre pegar o ouro dos monstros, +1,25% de ouro por nível.', bonus: (n) => ({ ouro: 0.0125 * n }) },
};
// a Aranhinha também vem pela sequência do prêmio diário
export const ARANHA_DIAS = 30;
// o dano em que o mascote se baseia: o AD e, nos campeões de magia (a Força deles vira Poder), mais metade do Poder
// (10/10/2026, relato de jogador: com 4 lendários a Lux tem ~210 de AD e ~450 de Poder, e o mascote dela batia menos da metade)
export const PET_AP = 0.5;
export const basePet = (estado, a) => a.ad + (kit(estado).magia ? PET_AP * (a.ap || 0) : 0);
export const xpMascote = (n) => Math.round(150 * n ** 1.7);
const prepararMascotes = (e) => { e.mascotes ??= {}; };
export const nivelMascote = (e) => e.mascotes?.[e.mascote]?.nivel || 0;
function bonusMascote(estado) {
  const m = MASCOTES[estado.mascote];
  return { ouro: 0, armadura: 0, rm: 0, itens: 0, ...(m?.bonus ? m.bonus(nivelMascote(estado)) : {}) };
}
export function mascoteLiberado(estado, id) { const m = MASCOTES[id]; return !!m && (!m.req || m.req.ok(estado)); }
export function adotarMascote(estado, id) {
  prepararMascotes(estado);
  const m = MASCOTES[id];
  if (!m || m.especial || estado.mascotes[id]) return false;
  if (m.req ? !m.req.ok(estado) : estado.ouro < m.preco) return false;
  if (!m.req) estado.ouro -= m.preco;
  estado.mascotes[id] = { nivel: 1, xp: 0 };
  estado.mascote = id;
  return true;
}
// ---------- Dungeon do Braum: o prêmio (p675) ----------
// XP de xpMin minutos e ouro de ouroMin minutos de caça na zona ideal (com o bônus de Runeterra na XP), mais espólios de
// Freljord que valem uns espoliosMin minutos de ouro; a derrota paga porEstagio[estágios vencidos]. Só na vitória: o lendário
// (2%), a Mecha do Bigode (2%) e o Poro de Bigode (1%, sem garantia; quem decide é o servidor).
// a referência é o que os jogadores ganham de verdade caçando (p680): mediana de XP e ouro por minuto de cada faixa de
// nível na produção (saves.media, 14/10/2026; do 45 em diante, a mesma subida das faixas de baixo); a XP leva o bônus de
// Runeterra (a caça do Vazio). Antes era 0,2 nível por hora para todos, o que no 45 dava 3,2 milhões de ouro por luta.
// teto (p681, p685): o ouro e os espólios comuns de uma luta, cada um, nunca passam de 20 mil (10 min caçando no Barão rendem ~120 mil no 45)
export const PREMIO_DUNGEON = { xpMin: 15, ouroMin: 10, espoliosMin: 10, teto: 20000, porEstagio: [0, 0.25, 0.5], lendario: 0.1, bigode: 0.02, mascote: 0.01 };
const RITMO_NIVEL = [[5, 1588, 533], [10, 2067, 688], [15, 2929, 951], [20, 5055, 1598], [25, 7917, 2489], [30, 12899, 4213], [35, 21075, 6826], [40, 31565, 9104], [45, 45800, 12300], [50, 66400, 16600]];
export function ritmoReal(nivel) {      // { xp, ouro } por minuto, interpolado entre as faixas
  const T = RITMO_NIVEL, n = Math.max(T[0][0], Math.min(T[T.length - 1][0], nivel));
  let k = 0; while (k < T.length - 2 && n > T[k + 1][0]) k++;
  const [a, xa, oa] = T[k], [b, xb, ob] = T[k + 1], f = (n - a) / (b - a);
  return { xp: xa + (xb - xa) * f, ouro: oa + (ob - oa) * f };
}
export function premioDungeonDe(nivel, frac = 1) {
  const r = ritmoReal(nivel), P = PREMIO_DUNGEON;
  return { xp: Math.round(P.xpMin * r.xp * ARENA.bonus * frac), ouro: Math.round(Math.min(P.teto, P.ouroMin * r.ouro) * frac), espolioOuro: Math.round(Math.min(P.teto, P.espoliosMin * r.ouro) * frac) };
}
export function darPremioDungeon(estado, frac, venceu, r = Math.random) {
  const pr = premioDungeonDe(estado.nivel || 1, frac), E = ESPOLIOS;
  estado.ouro = (estado.ouro || 0) + pr.ouro;
  if (pr.xp > 0) ganharXp(estado, null, pr.xp);
  const ganhos = {};
  if (frac > 0) { ganhos['pele-yeti'] = Math.max(1, Math.round(pr.espolioOuro / 2 / E['pele-yeti'].valor)); ganhos['presa-gelo'] = Math.max(1, Math.round(pr.espolioOuro / 2 / E['presa-gelo'].valor)); }
  if (venceu && r() < PREMIO_DUNGEON.bigode) ganhos['bigode-braum'] = 1;
  estado.espolios ??= {}; const espolios = {}, perdidos = [];
  for (const [id, q] of Object.entries(ganhos)) { if (cabeEspolio(estado, id)) { estado.espolios[id] = (estado.espolios[id] || 0) + q; espolios[id] = q; } else perdidos.push(id); }
  let item = null;
  if (venceu && r() < PREMIO_DUNGEON.lendario) {
    const lista = itensPorRaridade('lendario', localDaArena(estado.nivel || 1), classeDe(estado)), base = lista[Math.floor(r() * lista.length)];
    if (base) { const id = comItem(base, 0, sortearQualidade()); if (espacosLivres(estado) > 0) { estado.mochila.push(id); item = id; } else perdidos.push(id); }
  }
  return { xp: pr.xp, ouro: pr.ouro, espolios, item, perdidos };
}
// mascote especial dado pelo servidor (a Aranhinha, o Poro de Bigode); devolve true se era novo
export function ganharMascote(estado, id) {
  prepararMascotes(estado);
  if (!MASCOTES[id] || estado.mascotes[id]) return false;
  estado.mascotes[id] = { nivel: 1, xp: 0 }; return true;
}
export function escolherMascote(estado, id) {
  prepararMascotes(estado);
  if (id && !estado.mascotes[id]) return false;
  estado.mascote = id || null; return true;
}
function ganharXpMascote(estado, c, xp) {
  const p = estado.mascotes?.[estado.mascote];
  if (!p || p.nivel >= MASCOTE_MAX) return;
  p.xp += xp;
  while (p.nivel < MASCOTE_MAX && p.xp >= xpMascote(p.nivel)) {
    p.xp -= xpMascote(p.nivel); p.nivel++;
    emitir(c, 'mascoteNivel', { nome: MASCOTES[estado.mascote].nome, nivel: p.nivel });
  }
  if (p.nivel >= MASCOTE_MAX) p.xp = 0;
}

// ---------- Skins ----------
// Skins são compradas com diamantes na Loja (aba Mercado). Por enquanto, 3 à venda por campeão (2 de 900 com efeitos); quem já tinha
// outras (de antes, compradas com ouro ou liberadas por feitos) continua com elas.
// "efeitos": a skin também muda as cores das habilidades (só o visual: mesmo dano e mesma área). Custa mais.
const SKINS_A_VENDA = {
  darius: { 15: { preco: 900, efeitos: true }, 4: { preco: 500 }, 54: { preco: 900, efeitos: true } },
  ezreal: { 5: { preco: 900, efeitos: true }, 18: { preco: 500 }, 22: { preco: 900, efeitos: true } },
  lux: { 6: { preco: 900, efeitos: true }, 15: { preco: 500 }, 42: { preco: 900, efeitos: true } },
  yasuo: { 36: { preco: 900, efeitos: true }, 3: { preco: 500 }, 9: { preco: 900, efeitos: true } },
  katarina: { 29: { preco: 900, efeitos: true }, 12: { preco: 500 }, 10: { preco: 900, efeitos: true } },
  taric: { 18: { preco: 900, efeitos: true }, 1: { preco: 500 }, 3: { preco: 900, efeitos: true } },
  zac: { 1: { preco: 500 }, 24: { preco: 900, efeitos: true } },
};
for (const k of Object.values(KITS)) {
  const venda = SKINS_A_VENDA[k.id] || {};
  k.skins = k.dados.skins.map((sk) => ({ ...sk, aVenda: !!venda[sk.num], preco: venda[sk.num]?.preco || 0, efeitos: !!venda[sk.num]?.efeitos }));
}
export const skinsDe = (estado) => kit(estado).skins;
export const SKINS = KITS.darius.skins;
// as que aparecem na Coleção: a padrão e as que estão à venda na Loja
export const skinsVisiveis = (estado) => skinsDe(estado).filter((sk) => sk.num === 0 || sk.aVenda);
const prepararSkins = (e) => { e.skins ??= [0]; e.skin ??= 0; };
export const temSkin = (e, num) => { prepararSkins(e); return e.skins.includes(num); };
export function usarSkin(estado, num) {
  if (!temSkin(estado, num)) return false;
  estado.skin = num; return true;
}

// ---------- Skins dos mascotes ----------
export const SKINS_PET = {
  poro: [{ id: 'rei', nome: 'Poro Rei' }, { id: 'gelo', nome: 'Poro de Gelo' }],
  krug: [{ id: 'lava', nome: 'Krugzinho de Lava' }, { id: 'cristal', nome: 'Krugzinho de Cristal' }],
  dragao: [{ id: 'oceano', nome: 'Dragãozinho do Oceano' }, { id: 'anciao', nome: 'Dragãozinho Ancião' }],
};
export const temSkinPet = (e, pet, id) => !id || (e.skinsPet || []).includes(`${pet}:${id}`);
export function usarSkinPet(estado, pet, id) {
  if (!temSkinPet(estado, pet, id)) return false;
  estado.skinPet ??= {};
  if (id) estado.skinPet[pet] = id; else delete estado.skinPet[pet];
  return true;
}
// nome do sprite do mascote ativo ("Poro", "Poro@rei"…)
export const spriteMascote = (estado) => {
  const m = MASCOTES[estado.mascote]; if (!m) return null;
  const sk = estado.skinPet?.[estado.mascote];
  return sk ? `${m.nome}@${sk}` : m.nome;
};

// ---------- Montaria (Runeterra) ----------
// Todo jogador tem o Burrinho. Montado ele anda mais rápido (+30% no nível 1 até +75% no 10) e a montaria sobe de nível
// com a distância andada montado (em tiles). Montar leva 1 s (andando ou parado); atacar ou usar habilidade desmonta.
export const MONTARIA = { max: 10, montar: 1, base: 0.3, porNivel: 0.05 };
export const SKINS_MONTARIA = [{ id: 'cavalo', nome: 'Cavalo de Guerra de Demacia', preco: 600 }];
export const xpMontaria = (n) => 250 + 250 * n;          // tiles andados montado para passar do nível n
export const montariaDe = (e) => {
  const m = (e.montaria ??= { nivel: 1, xp: 0, skins: [], skin: '' });
  m.nivel ??= 1; m.xp ??= 0; m.skins ??= []; m.skin ??= '';
  return m;
};
// bônus de velocidade montado (mais = níveis a mais, para a folga do servidor)
export const velMontaria = (e, mais = 0) => MONTARIA.base + MONTARIA.porNivel * (Math.min(MONTARIA.max, montariaDe(e).nivel + mais) - 1);
export const nomeMontaria = (e) => SKINS_MONTARIA.find((s) => s.id === montariaDe(e).skin)?.nome || 'Burrinho';
export const spriteMontaria = (e) => (montariaDe(e).skin ? 'Montaria@' + montariaDe(e).skin : 'Montaria');
// soma a distância andada montado; devolve true se subiu de nível
export function andarMontado(e, tiles) {
  const m = montariaDe(e);
  if (m.nivel >= MONTARIA.max || !(tiles > 0)) return false;
  m.xp = Math.round((m.xp + tiles) * 100) / 100;
  let subiu = false;
  while (m.nivel < MONTARIA.max && m.xp >= xpMontaria(m.nivel)) { m.xp = Math.round((m.xp - xpMontaria(m.nivel)) * 100) / 100; m.nivel++; subiu = true; }
  if (m.nivel >= MONTARIA.max) m.xp = 0;
  return subiu;
}
// distância total andada montado (para o servidor conferir)
export const totalMontaria = (m) => { let s = m?.xp || 0; for (let n = 1; n < (m?.nivel || 1); n++) s += xpMontaria(n); return s; };
export function usarSkinMontaria(e, id) {
  const m = montariaDe(e);
  if (id && !m.skins.includes(id)) return false;
  m.skin = id || ''; return true;
}

// ---------- Loja (vendida pelo servidor, paga com diamantes) ----------
// O servidor confere o saldo, desconta e aplica a compra no personagem (resets e skins não podem ser feitos pelo navegador).
// enviar diamantes para outro jogador (o servidor confere tudo; ver /api/diamantes/enviar)
export const TRANSFERIR = { min: 10, maxDia: 20000, travaCartaoDias: 30, nota: 60, espera: 5 };      // maxDia: 5.000 até 12/10/2026 (pedido do dono, para os sorteios das lives)
export const LOJA = {
  resetHab: { nome: 'Reset de habilidades', desc: 'Devolve todos os pontos de habilidade para escolher de novo.', preco: 150 },
  resetAtrib: { nome: 'Reset de atributos', desc: 'Devolve todos os pontos de atributo para redistribuir.', preco: 150 },
  skin: { nome: 'Skin de campeão', preco: 500 },          // o preço de verdade é o de cada skin (precoLoja)
  skinPet: { nome: 'Skin de mascote', preco: 300 },
  skinMontaria: { nome: 'Skin de montaria', preco: 600 },     // o preço de verdade é o de cada skin
  // Bênção Protetora (10/10/2026, pedido de jogador e do dono): protege a próxima morte em Runeterra (nenhum item
  // equipado cai). Uma por vez; qualquer morte em Runeterra a gasta (mesmo sem item para cair) e aí é preciso comprar
  // outra. O servidor guarda se a pessoa tem (estado.bencoes, 0 ou 1)
  bencao: { nome: 'Bênção Protetora', desc: 'Protege a próxima morte em Runeterra: nenhum item equipado cai. Ao morrer lá, ela é gasta e é preciso comprar outra.', preco: 300 },
  // trocar o nome do personagem (10/10/2026, pedido do dono): rota própria, /api/loja/nome (não passa pelo aplicarCompraLoja)
  nome: { nome: 'Trocar o nome', desc: 'Escolha um nome novo para este personagem. O nível, os itens e todo o resto continuam.', preco: 200 },
};
export const BENCAO_MAX = 1;
// o Mestre da Legião também refaz o treino, por ouro (pedido do dono: caro de propósito, umas 6 h de caça em
// qualquer nível); a Loja continua vendendo os resets por diamantes. Quem cobra e aplica é o servidor (rota /api/mestre/reset)
export const RESET_OURO = 25000;
export const precoResetOuro = (nivel) => RESET_OURO * Math.max(1, nivel || 1);
// preço de um produto (as skins de campeão têm preço próprio)
export function precoLoja(estado, produto, alvo) {
  if (produto === 'skin') return skinsDe(estado).find((x) => x.num === Number(alvo) && x.aVenda)?.preco || null;
  if (produto === 'skinMontaria') return SKINS_MONTARIA.find((x) => x.id === alvo)?.preco || null;
  return LOJA[produto]?.preco || null;
}
// aplica uma compra da loja no estado; devolve o erro (texto) ou null
export function aplicarCompraLoja(estado, produto, alvo) {
  if (produto === 'resetHab') {
    estado.pontos = (estado.pontos || 0) + Object.values(estado.ranks).reduce((s2, r) => s2 + r, 0);
    estado.ranks = ranksVazios(); estado.barra = [];
  } else if (produto === 'resetAtrib') {
    estado.pontosAtrib = (estado.pontosAtrib || 0) + Object.values(estado.atrib || {}).reduce((s2, v) => s2 + v, 0);
    estado.atrib = atribVazio(); estado.modelo = '';
    limitarVida(estado);
  } else if (produto === 'skin') {
    const num = Number(alvo), sk = skinsDe(estado).find((x) => x.num === num);
    if (!sk || !sk.aVenda) return t('Essa skin não está à venda.');
    if (temSkin(estado, num)) return t('Você já tem essa skin.');
    estado.skins.push(num); estado.skin = num;
  } else if (produto === 'skinPet') {
    const [pet, id] = String(alvo).split(':');
    if (!SKINS_PET[pet]?.some((x) => x.id === id)) return t('Essa skin de mascote não existe.');
    estado.skinsPet ??= [];
    if (estado.skinsPet.includes(`${pet}:${id}`)) return t('Você já tem essa skin.');
    estado.skinsPet.push(`${pet}:${id}`);
    if (estado.mascotes?.[pet]) { estado.skinPet ??= {}; estado.skinPet[pet] = id; }
  } else if (produto === 'bencao') {
    if ((estado.bencoes || 0) >= BENCAO_MAX) return t('Você já tem uma Bênção ativa. Ela é gasta na próxima morte em Runeterra.');
    estado.bencoes = (estado.bencoes || 0) + 1;
  } else if (produto === 'skinMontaria') {
    const sk = SKINS_MONTARIA.find((x) => x.id === alvo), m = montariaDe(estado);
    if (!sk) return t('Essa skin de montaria não existe.');
    if (m.skins.includes(sk.id)) return t('Você já tem essa skin.');
    m.skins.push(sk.id); m.skin = sk.id;
  } else return t('Produto inexistente.');
  return null;
}

// ---------- Automático (VIP) ----------
// Usa poções sozinho e, se o jogador quiser, volta para a Fonte quando acabam as poções de vida ou quando a mochila enche.
// Lá o campeão fica parado: curar, vender, comprar e voltar a caçar é com o jogador.
export const rotinaPadrao = () => ({ mochila: true, pocoes: true });
// a melhor poção de cada tipo que o nível permite
export const melhorPocao = (estado, tipo) => Object.entries(POCOES).filter(([, p]) => p.tipo === tipo && estado.nivel >= p.nivel).sort((x, y) => y[1].cura - x[1].cura)[0][0];

// PvP: o servidor calcula o dano; aqui só desconta (o escudo absorve) e, se zerar, morre para aquele jogador
export function danoPvp(estado, c, valor, por) {
  const d = c.darius;
  if (d.morto > 0 || !LOCAL[estado.local]?.arena) return;
  if (valor > 0 && kit(estado).fluxo && estado.mana >= atributos(estado).mana - 0.01) {     // Fluxo cheio: o golpe de jogador também vira escudo (o servidor conta o mesmo)
    const v = habDe(estado).P.escudoFluxo(estado.nivel);
    d.escudo = Math.max(d.escudo || 0, v); estado.mana = 0;
    emitir(c, 'fluxo', { escudo: Math.round(v) });
  }
  if (d.escudo > 0) { const abs = Math.min(d.escudo, valor); d.escudo -= abs; valor -= abs; }
  estado.vida -= valor;
  if (c.arena) { apanhouNoMundo(c); c.arena.combatePvp = Math.max(c.arena.combatePvp || 0, 6); if (por) (c.arena.agressores ??= {})[por] = (c.arena.tempo || 0) + 60; }      // legítima defesa sem PK (p641)      // apanhar de jogador também é luta PvP (poção mais fraca, p630)
  emitir(c, 'recebido', { valor, pvp: true, frac: valor / Math.max(1, atributos(estado).vida) });
  if (estado.vida <= 0) {
    if (habDe(estado).P?.renasce) { estado.vida = 1; return; }      // Zac: o servidor manda a Divisão Celular ({ t: 'divisao' }) ou a morte
    if (atributos(estado).tem('3026')) { estado.vida = 1; return; }      // Anjo Guardião: o servidor manda o { t: 'anjo' } ou a morte (p608)
    morrer(estado, c, por);
  }
}
// Zac no PvP: o servidor decidiu a Divisão Celular (o golpe de um jogador zeraria a vida); vale mesmo com a recarga daqui
// (o relógio que manda é o do servidor). Dividido por `espera` s, sem poder ser acertado; depois o passo junta os pedaços (reunirZac)
export function divisaoPvp(estado, c, espera) {
  const d = c.darius, HP = habDe(estado).P;
  if (!HP?.renasce || d.morto > 0 || d.dividido > 0) return;
  const s = Number(espera) > 0 ? Math.min(3, Number(espera)) : HP.renasce.espera;
  d.timers.divisao = HP.renasce.recarga;
  d.dividido = s; d.invulneravel = Math.max(d.invulneravel || 0, s);
  d.quique = null; d.mitose = null; d.poca = null;
  estado.vida = 1;
  emitir(c, 'divisao', { espera: s, pedacos: 4, pvp: true, ...(c.arena ? { x: c.arena.x, y: c.arena.y } : {}) });
}
// PvP: os efeitos do ataque básico num jogador que não dependem de monstro (Bravata do Taric, a marca de luz da Lux, a Sede de
// Sangue da Katarina); devolve as teclas que viram acerto extra (o servidor calcula o dano)
export function efeitosAtaqueJogador(estado, c, nome) {
  const d = c.darius, HK = habDe(estado), a = atributos(estado), A = c.arena, extra = [];
  if (d.bravata > 0 && HK.P?.bravata) {
    d.bravata--;
    for (const tk of Object.keys(d.recargas)) d.recargas[tk] = Math.max(0, d.recargas[tk] - HK.P.reduz * (tk === 'Q' ? HK.P.reduzQ : 1));
    estado.mana = Math.min(a.mana, estado.mana + a.mana * (HK.P.manaGolpe || 0));
    emitir(c, 'bravata', { resta: d.bravata });
    extra.push('P');
  }
  if (HK.P?.passivaLux && A?.marcasJog?.[nome] > (A.tempo || 0)) { delete A.marcasJog[nome]; extra.push('P'); }
  if (d.sede > 0 && HK.G?.curaSede) extra.push('G');
  return extra;
}
// PvP: o servidor confirmou um golpe num jogador (com o valor): roubo de vida e a cura da Sede de Sangue
export function aoAcertarJogador(estado, c, tecla, valor) {
  const d = c.darius, a = atributos(estado), HK = habDe(estado);
  if (!(valor > 0) || d.morto > 0) return;
  let cura = 0;
  if (tecla === 'ataque' && a.rouboVida) cura += valor * a.rouboVida;
  if (tecla === 'G' && HK.G?.curaSede) cura += valor * HK.G.curaSede;
  if (cura > 0) curar(estado, c, a, cura);
}
// os jogadores atacáveis a até `raio` do campeão (para o prisma e o pulso do Taric em Runeterra e na Arena)
const jogadoresPerto = (estado, c, raio) => { const A = c.arena; return LOCAL[estado.local]?.arena && A?.mundo && !A.cidade ? (A.outros || []).filter((o) => o.atacavel && !o.morto && (A.pvp || o.caveira) && Math.hypot(o.x - A.x, o.y - A.y) <= raio) : []; };
export function morrerPvp(estado, c, por) { if (c.darius.morto <= 0) morrer(estado, c, por); }
// Anjo Guardião no PvP (p608): o servidor decidiu que ele salvou do golpe mortal de um jogador
export function anjoPvp(estado, c) {
  const d = c.darius;
  if (d.morto > 0) return;
  estado.vida = Math.max(estado.vida, atributos(estado).vida * 0.5); d.timers.anjo = 300;
  emitir(c, 'item', { nome: t('Renascimento'), pvp: true });
}

// peças do combate usadas pelo motor de Runeterra (js/arena.js)
export const interno = { efetivo, golpear, curar, receberDano, aplicarHemorragia, acertouHabilidade, detonarOrbe, emitir, gastarMana, tornarNoturno,
  bonusPoder, tickInimigos, avancarAtaque, golpeBasico, inimigoAtaca, processarAbates, mecanicaChefe, aoUsarHabilidade, dispararCentelha, iluminar, curaTaric, pegarGosma, soltarGosmas, pagarVida, dividirZac, reunirZac };
