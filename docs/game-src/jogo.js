// Liga tudo: motor (regras) → cena (visual de OT) → painéis, mapa e NPCs. Também salva e calcula ganhos offline.
import './i18n-dados.js';
import { t, ingles, traduzirDom, seletorIdioma } from './i18n.js';
import * as M from './motor.js';
import * as Arena from './arena.js';
import { criarConexao } from './tempo-real.js';
import { ARENA_PVP, elo as eloArena } from './arena-pvp.js';
import { GANHOS, reais } from './ganhos.js';
import { ORBS, usd, enderecoValido, vendedorRecebe, taxaOrbs } from './orbs.js';
import { campeao as dadosCampeao, iconeHabilidade, splashSkin, spriteCampeao } from './campeoes.js';
import { Cena, fmt, VIS_L, VIS_A } from './cena.js';
import { sprite, DIR, T, frasco, iconeEspolio, tom, iconeChave } from './pixel.js';
import { desenharMapaLoL, animarMapaLoL, marcasMapa, focoMapa } from './mapa.js';
import * as R from './runeterra.js';
import { proximaVilemaw } from './chefe-global.js';
import * as rede from './rede.js';
import { conectar, captchaEm, escolherCampeao } from './entrada.js';
import * as som from './som.js';
import { animarOrnn } from './ornn-anim.js';
import './dicas.js';
// os formulários do chat e da entrada não recarregam a página (era um onsubmit no HTML, que a CSP bloquearia)
document.addEventListener('submit', (e) => { if (e.target.matches?.('[data-sem-envio]')) e.preventDefault(); }, true);
import { confirmar, avisar, pedirTexto } from './dialogo.js';
import { iniciarTutorial } from './tutorial.js';
import { NOVIDADES } from './novidades.js';
import { GUILDA, ICONES_LISTA, CORES_LISTA, BRASAO_PADRAO, svgBrasao, nomeGuildaValido, vagasDe, custoProximaVaga, DOACAO_MIN, custoVagasRestantes } from './guilda.js';

const $ = (s) => document.querySelector(s);
const CHAVE = 'darius-idle-v2';      // save local de antes das contas (só para importar o progresso antigo)
const DT = 0.05;
const LOCALE = ingles ? 'en-US' : 'pt-BR';       // datas no formato do idioma escolhido
som.iniciar();
// texto fixo do jogar.html no idioma escolhido, e os botões PT / EN no topo do painel de status
traduzirDom(document.body);
document.querySelector('#controle-som')?.insertAdjacentHTML('afterbegin', seletorIdioma());     // PT/EN no topo da coluna esquerda, ao lado do som
document.querySelector('#controle-som .seletor-idioma')?.insertAdjacentHTML('afterend', `<button type="button" id="bt-amigos" title="${t('Amigos (O)')}">🤝 <span>${t('Amigos')}</span><span class="nao-lidas" hidden></span></button>`);      // (p702)

// ---------- entrar, carregar e salvar (o progresso fica no servidor) ----------
// o jogo só começa depois que o jogador entra ou cria o personagem
const sessao = await conectar();
const NOME = sessao.nome;
// funil do começo (out/2026): manda ao servidor a primeira vez que o jogador passa por cada etapa (entrou, passo do
// tutorial, objetivo, nível…), para descobrir onde os novos param (_raw/funil.mjs). Cada etapa vai uma vez só.
const FUNIL_CHAVE = `lolidle-funil:${NOME}`;
let funilVisto = new Set();
try { funilVisto = new Set(JSON.parse(localStorage.getItem(FUNIL_CHAVE) || '[]')); } catch {}
function funil(evento) {
  if (funilVisto.has(evento)) return;
  funilVisto.add(evento);
  try { localStorage.setItem(FUNIL_CHAVE, JSON.stringify([...funilVisto])); } catch {}
  rede.funil([evento]).catch(() => {});
}
funil('entrou');
// o progresso do começo (Próximo passo, tutorial, tours, chaves, posição em Runeterra) fica neste navegador pelo nome do personagem;
// se a conta foi apagada e criada de novo com o mesmo nome, a data de criação muda e o que era do personagem antigo é esquecido
try {
  const marca = 'lolidle-conta:' + NOME, criado = String(sessao.criado || ''), antes = localStorage.getItem(marca);
  if (criado && antes !== criado) {
    if (antes != null) for (const k of Object.keys(localStorage)) if (k !== marca && k.startsWith('lolidle-') && (k.endsWith(':' + NOME) || k.endsWith('-' + NOME))) localStorage.removeItem(k);
    localStorage.setItem(marca, criado);
  }
} catch {}
document.body.classList.add('jogando');
let novoJogo = false, migrou = false, importouLocal = false;
function carregar() {
  let e = sessao.estado;
  // primeira vez desta conta no servidor: traz o progresso que já existia neste navegador (uma única vez)
  if (!e) try {
    const local = JSON.parse(localStorage.getItem(CHAVE));
    if (local?.estado && !localStorage.getItem(CHAVE + '-importado')) {
      e = local.estado; e.autoHab = local.autoHab; importouLocal = true;
      localStorage.setItem(CHAVE + '-importado', NOME);
    }
  } catch {}
  if (e?.versao === 2 || e?.versao === 3) {
    if (e.versao === 2) migrou = true;
    M.migrar(e);
    return { estado: e, autoHab: e.autoHab !== false };
  }
  novoJogo = true;
  return { estado: M.novoEstado(sessao.campeao || 'darius'), autoHab: true };
}
const salvo = carregar();
let estado = salvo.estado;
estado.nome = NOME;
// o campeão é da conta (escolhido na criação); saves antigos, de antes da escolha, são do Darius
estado.campeao = sessao.campeao || estado.campeao || 'darius';
const CAMP = estado.campeao, KIT = M.kit(estado), HABS = KIT.hab, CAMPEAO = dadosCampeao(CAMP);
estado.vipAte = sessao.vipAte || 0;       // quem diz até quando o VIP vale é o servidor
let rp = sessao.rp || 0, orbs = sessao.orbs || 0;
// hora do mundo = hora do servidor (o relógio do computador de cada um pode estar errado)
const desvioRelogio = (sessao.agora || Date.now()) - Date.now();
const agoraMundo = () => Date.now() + desvioRelogio;
estado.relogio = M.relogioMundial(agoraMundo());
estado.rotina = { ...M.rotinaPadrao(), ...estado.rotina };
for (const k of ['ativa', 'vida', 'mana', 'vender', 'voltarPara', 'mochilaTravada']) delete estado.rotina[k];      // opções da rotina antiga
let combate = M.criarCombate();
let avisouSemConexao = false, recusou = false;
// o servidor sorteou a qualidade dos itens novos: troca os "~?" (na ordem) e mostra os bons
// lendários de sorte além do limite que o servidor tirou do save (p622): saem daqui também, e o resto do progresso ficou salvo
function aplicarDescartados(lista) {
  for (const x of lista) for (const onde of ['mochila', 'itens']) { const k = estado[onde].lastIndexOf(x); if (k >= 0) { estado[onde].splice(k, 1); break; } }
  const nomes = lista.map((x) => M.ITENS[M.baseId(x)]?.nome || x).join(', ');
  log(t('O servidor descartou {itens}: lendários seguidos demais para os abates. O resto do progresso foi salvo.', { itens: nomes }), 'morte');
  cena.aviso?.(t('Lendário descartado pelo servidor'), '#ff9a6a');
  atualizarUI();
}
function aplicarRevelados(lista, soEquipados = false) {
  for (const { base, q } of lista) {
    const novo = M.comItem(base, 0, q);
    let k = estado.itens.indexOf(M.comItem(base, 0, '?'));
    if (k >= 0) estado.itens[k] = novo;
    else if (!soEquipados) { k = estado.mochila.indexOf(M.comItem(base, 0, '?')); if (k >= 0) estado.mochila[k] = novo; }
    const nome = M.ITENS[base]?.nome || base, Q = M.QUALIDADES[q];
    if (q === 'A' || q === 'S' || q === 'SS') {
      avisoSaque({ img: imgItem(base), nome: `${nome} ${q}`, cor: Q.cor, tipo: q === 'SS' ? t('Qualidade SS! Raríssimo!') : t('Qualidade {q}!', { q }), classe: 'qual-' + q });
      if (q !== 'A') { som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, Q.cor); }
    } else if (M.raridade(M.ITENS[base] || {}) !== 'basico') avisoSaque({ img: imgItem(base), nome: `${nome} ${q}`, cor: Q.cor, tipo: t('Qualidade {q}', { q }), classe: 'qual-' + q });   // épico e lendário: a qualidade de verdade
    log(t('{item} foi avaliado: qualidade {q}.', { item: nome, q }), q === 'S' || q === 'SS' ? 'raro' : 'item');
  }
  if (lista.length) { atualizarUI(); desenharVenda(); }
}
function prepararSave() { estado.salvoEm = Date.now(); estado.autoHab = false; }
let operando = false;           // compra/venda no mercado em andamento: o save espera
function salvar() {
  if (operando) return;
  prepararSave();
  const revEnviado = estado.rev || 0;
  return rede.salvarNoServidor(estado).then((r) => { avisouSemConexao = false; if (r?.descartados?.length) aplicarDescartados(r.descartados); if (r?.vm) vmInfo = r.vm; if (r?.amigos) aplicarResumoAmigos(r.amigos); if (r?.arena) arenaChamada(r.arena); if (r?.dungeon) dungeonChamada(r.dungeon); if (r?.revelados?.length) aplicarRevelados(r.revelados); if (r && 'evento' in r) aplicarEvento(r.evento); if (r && 'reinicio' in r) aplicarReinicio(r.reinicio); if (r?.donos) aplicarDonos(r.donos); if (r && 'twitch' in r) aplicarTwitch(r.twitch); if (r && 'kick' in r) aplicarKick(r.kick); if (r && 'voto' in r) aplicarVoto(r.voto); if (r && 'guilda' in r) aplicarGuilda(r.guilda); if (r?.recebidos) aplicarRecebidos(r.recebidos, r.rp); if (r && 'sorteios' in r) aplicarSorteio(r); }).catch((e) => {
    if (e.outraAba) return;          // o personagem foi aberto em outra aba: a janela de aviso vem pelo evento lolidle-outra-aba
    // um save que saiu antes de uma compra/venda chega velho: se o jogo já tem o rev novo, é só ignorar
    if (e.desatualizado) { if ((estado.rev || 0) === revEnviado && !recusou) { recusou = true; location.reload(); } return; }
    if (e instanceof rede.ErroSessao) { avisar(t('A sessão acabou: a conta entrou com outro personagem (só um joga por vez) ou a sessão expirou. Entre de novo para continuar.'), { titulo: t('Sessão encerrada'), ok: t('Entrar de novo') }).then(() => location.reload()); return; }
    if (e.recusado) {        // progresso impossível (editado pelo console): volta para o último save aceito
      if (!recusou) { recusou = true; avisar(e.message + ' ' + t('O jogo vai voltar para o último progresso salvo.'), { titulo: t('Progresso recusado'), ok: t('Voltar ao último save') }).then(() => location.reload()); }
      return;
    }
    if (!avisouSemConexao) { avisouSemConexao = true; log(t('Sem conexão com o servidor: o progresso será salvo quando ela voltar.'), 'morte'); }
  });
}

// o mesmo personagem foi aberto em outra aba ou aparelho: esta para de salvar e oferece continuar aqui (recarregar assume o personagem)
let avisouOutraAba = false;
addEventListener('lolidle-outra-aba', () => {
  if (avisouOutraAba) return;
  avisouOutraAba = true; recusou = true;
  log(t('Este personagem foi aberto em outra aba ou aparelho. Esta aba parou de salvar.'), 'morte');
  avisar(t('Este personagem foi aberto em outra aba ou em outro aparelho. Para o progresso não se perder, só uma pode jogar: esta aba parou de salvar. Feche esta aba, ou clique em Jogar aqui para continuar por aqui (a outra é que para).'),
    { titulo: t('Aberto em outra aba'), ok: t('Jogar aqui') }).then(() => location.reload());
});

// ---------- console ----------
function log(txt, tipo = 'info') {
  const el = $('#log'), p = document.createElement('p'), agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  p.className = tipo; p.innerHTML = `<span class="hora">${hora}</span> `; p.append(txt);
  const noFim = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  el.append(p);
  while (el.children.length > 150) el.firstChild.remove();
  if (noFim) el.scrollTop = el.scrollHeight;
}

// ---------- itens ----------
const COR_RARIDADE = { basico: '#d0d0d0', epico: '#c88aff', lendario: '#ffc040' };
const descreverItem = (id) => { const i = M.infoItem(id), r = M.raridade(i); return { nome: i.nomeRef + (M.pendente(id) ? '' : ` [${i.qual}]`), cor: COR_RARIDADE[r], raridade: r, qual: i.qual }; };
// item refinado no Ornn usa a arte do nível dele (gerada por _raw/gerar_refino.py): cada +N fica mais bonito
const imgItem = (id) => { const n = M.refinoDe(id); return n ? `assets/img/itens/ref/${M.baseId(id)}-${n}.png` : `assets/img/itens/${M.baseId(id)}.png`; };
// o "+N" do refino; a classe ref-N também muda o visual de quem contém o ícone (ver css/tema.css: cada nível brilha mais)
// e o selo da qualidade (C, B, A, S, SS; "?" enquanto o servidor ainda está sorteando)
const rotuloQual = (id) => { if (!M.ITENS[M.baseId(id)]) return ''; const q = M.qualidadeDe(id); return q === '?' ? `<span class="qual q-p" title="${t('Sendo avaliado...')}">?</span>` : `<span class="qual q-${q}">${q}</span>`; };
const rotuloRef = (id) => { const n = M.refinoDe(id); return (n ? `<span class="ref ref-${n}">+${n}</span>` : "") + rotuloQual(id); };
// em que itens o Ornn usa este (sugestão de jogador: ver o que dá para montar passando o mouse); do mais barato ao mais caro
let usadosMapa = null;
const usadoEm = (base) => {
  if (!usadosMapa) {
    usadosMapa = {};
    for (const x of Object.keys(M.ITENS)) for (const c of M.receitaDe(x)?.de || []) if (!(usadosMapa[c] ||= []).includes(x)) usadosMapa[c].push(x);
    for (const l of Object.values(usadosMapa)) l.sort((a, b) => (M.ITENS[a].preco || 0) - (M.ITENS[b].preco || 0));
  }
  return usadosMapa[base] || [];
};
const textoItem = (id) => {
  const i = M.infoItem(id), r = M.raridade(i), n = (v) => +v.toFixed(1);
  const bonus = [i.ad && t('+{v} dano', { v: n(i.ad) }), i.ap && t('+{v} poder de habilidade', { v: n(i.ap) }), i.mana && t('+{v} mana', { v: Math.round(i.mana) }), i.vida && t('+{v} vida', { v: Math.round(i.vida) }), i.armadura && t('+{v} armadura', { v: n(i.armadura) }), i.rm && t('+{v} res. mágica', { v: n(i.rm) }),
    i.va && t('+{v}% vel. ataque', { v: Math.round(i.va * 100) }), i.rv && t('+{v}% roubo de vida', { v: Math.round(i.rv * 100) }), i.critico && t('+{v}% crítico', { v: Math.round(i.critico * 100) }),
    i.regen && t('+{v} vida/s', { v: n(i.regen) }), i.cdr && t('−{v}% recarga', { v: Math.round(i.cdr * 100) })].filter(Boolean).join(', ');
  const rec = M.receitaDe(M.baseId(id));
  const receita = rec ? '\n' + t('Ornn monta com: {pecas} + {custo} de ouro', { pecas: rec.de.map((c) => M.ITENS[c].nome).join(' + '), custo: rec.custo }) : '';
  const us = usadoEm(M.baseId(id)), usado = us.length ? '\n' + t('Usado em: {itens}', { itens: us.slice(0, 4).map((x) => M.ITENS[x].nome).join(', ') + (us.length > 4 ? ' ' + t('e mais {n}', { n: us.length - 4 }) : '') }) : '';
  // mostra o poder que o jogo aplica de verdade (efeito), não a frase original do LoL (resumo)
  const pq = i.qual === '?' ? t('Qualidade: sendo avaliada (o servidor sorteia em alguns segundos).') : t('Qualidade {q}: atributos {p}', { q: i.qual, p: (M.QUALIDADES[i.qual].mult >= 1 ? '+' : '−') + Math.round(Math.abs(M.QUALIDADES[i.qual].mult - 1) * 100) + '%' }) + '\n' + t('Qualidades de C a SS: quanto mais alta, mais forte e mais rara.');
  const esp = i.espaco === 'botas' ? t('Botas: só dá para equipar uma.') + '\n' : '';
  return `${i.nomeRef} (${M.NOME_RARIDADE[r]}${i.ref ? t(', refinado +{ref}', { ref: i.ref }) : ''})\n${esp}${pq}\n${bonus}${i.efeito ? '\n' + i.efeito : ''}${receita}${usado}\n${t('Vale {valor} de ouro no Lojista.', { valor: M.valorVenda(id) })}`;
};
// gemas do Ornn: ícone (pedra lapidada na cor da gema), nome e o que fazem
const iconeGema = (id) => { const c = M.GEMAS[id]?.cor || '#ccc'; return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><polygon points="16,2 29,12 16,30 3,12" fill="${c}" stroke="#0b0d12" stroke-width="1.6"/><polygon points="16,2 22,12 16,30 10,12" fill="#fff" opacity=".25"/><polygon points="3,12 29,12 16,2" fill="#fff" opacity=".2"/><polygon points="10,12 16,6 22,12" fill="#fff" opacity=".5"/><polygon points="16,30 22,12 29,12" fill="#000" opacity=".22"/></svg>`); };
const textoGema = (id) => `${M.nomeGema(id)}\n${t(M.GEMAS[id].desc)}`;
// no mercado: um item ou um lote de gemas ("gema:<id>:<quantidade>")
const COR_MASCOTE = '#ffe08a';      // o mascote no mercado (p677)
const descreverOferta = (item) => { const g = M.ofertaGema(item); if (g) return { nome: M.nomeOferta(item), cor: M.GEMAS[g.id].cor, raridade: 'gema' }; const mo = M.ofertaMascote(item); return mo ? { nome: t(M.MASCOTES[mo].nome), cor: COR_MASCOTE, raridade: 'mascote' } : descreverItem(item); };
let gemaForja = null, gemaMontar = null;            // a gema escolhida para as próximas tentativas no Ornn
function escolhaGema(para, atual) {
  const lista = M.ORDEM_GEMAS.filter((g) => M.GEMAS[g][para]);
  return `<div class="gemas-escolha" data-gemas-para="${para}"><small>${t('Runa nas tentativas')}</small><div>
    <button type="button" class="gema-op${!atual ? ' ativa' : ''}" data-usar-gema="">${t('Nenhuma')}</button>
    ${lista.map((g) => { const q = estado.gemas?.[g] || 0; return `<button type="button" class="gema-op${atual === g ? ' ativa' : ''}" data-usar-gema="${g}" ${q ? '' : 'disabled'} title="${textoGema(g).replace(/"/g, '&quot;')}"><img src="${iconeGema(g)}" alt=""><span>${M.nomeGema(g)}</span><b>${q}</b></button>`; }).join('')}
  </div></div>`;
}
const ICONE_POCAO = { vida: '#d83030', vidaF: '#a01860', vidaS: '#e8a020', mana: '#3a6ae8', manaF: '#5a2ab8' };

// ---------- cena ----------
const falas = Object.fromEntries(M.ORDEM_HAB.map((hk) => [hk, HABS[hk].nome]));
// P/Q/W/E/R são os ícones oficiais do campeão (Data Dragon); os das habilidades novas foram criados no mesmo
// estilo por _raw/icones.html (regerar com: node _raw/gerar_icones.mjs)
const iconeHab = (hk) => iconeHabilidade(CAMP, hk);
const cena = new Cena($('#tela'), falas, descreverItem);
// com a barra de um chefe no alto da tela, o quadro do alvo desce para baixo dela (fim: fração da altura da tela; 0 = sem barra)
let fimBarraChefe = -1;
cena.aoBarraChefe = (fim) => {
  if (fim === fimBarraChefe) return;
  fimBarraChefe = fim;
  $('#hud-alvo').style.top = fim && !$('#moldura').classList.contains('hud-mini') ? `${Math.round(fim * $('#tela').clientHeight + 6)}px` : '';
};
// a Vilemaw: quem mais bateu (top 5 ao vivo, o seu nome em verde e, fora do top 5, a sua posição), embaixo do minimapa
let chaveRankVm = '';
cena.mostrarRankingVm = (b) => {
  const el = $('#rank-vm'), chave = b ? JSON.stringify([b.ranking, b.eu]) : '';
  if (chave === chaveRankVm) return;
  chaveRankVm = chave;
  if (!b) { el.hidden = true; return; }
  const fora = b.eu && b.eu.pos > b.ranking.length, nome = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const linha = (pos, quem, p, eu) => `<li class="${eu ? 'eu' : pos === 1 ? 'primeiro' : ''}"><b>${pos}</b><span>${nome(quem)}</span><i>${Math.round(p)}%</i></li>`;
  el.innerHTML = `<header>🕷 ${t('Dano na Vilemaw')}</header><ol>${b.ranking.map((r, k) => linha(k + 1, r.n, r.p, r.n === estado.nome)).join('')}${fora ? linha(b.eu.pos, t('Você'), b.eu.p, true) : ''}</ol>`;
  el.hidden = false;
};
cena.log = log;
cena.nomeEspolio = (id) => M.ESPOLIOS[id]?.nome || id;
cena.ehEspolio = (id) => !!M.ESPOLIOS[id];
cena.nomeGema = (id) => M.nomeGema(id);
cena.corGema = (id) => M.GEMAS[id]?.cor || '#ffffff';
cena.nomeJogador = NOME;
$('#st-nome').textContent = NOME;
// jogadores online agora (contados pelo servidor), ao lado do nome
async function atualizarOnline() {
  try {
    const { online } = await rede.online();
    $('#st-online b').textContent = fmt(online);
    $('#st-online').title = online === 1 ? t('Só você está com o jogo aberto agora') : t('{n} jogadores estão com o jogo aberto agora', { n: fmt(online) });
    $('#st-online').hidden = false;
  } catch {}
}
atualizarOnline();
setInterval(atualizarOnline, 20000);
document.title = `${NOME} · LoL Idle`;
const localAtual = () => M.LOCAL[estado.local];
// Arena (PvP 1 contra 1): declarado aqui em cima porque a cena e a interface usam antes do bloco da Arena, lá embaixo
const INFO_ARAM = { larg: ARENA_PVP.mapa.larg, pontos: [], zonaEm: () => null, cidadeEm: () => null, guardiaoEspera: () => false, aram: true };
const naAram = () => !!localAtual().aram;
let arenaEntrando = false, arenaPreparoT = null, arenaInfo = null, arenaPartida = null, arenaTimer = null, arenaAba = 'ranking', arenaLista = null, arenaFimMostrado = 0, arenaVidaAntes = null, arenaSaida = null;
// Runeterra lembra onde você estava (neste navegador) e as cidades que você já descobriu
const CHAVE_POS = 'lolidle-mundo4-' + NOME, CHAVE_CIDADES = 'lolidle-cidades-' + NOME;
// aparelho de toque: uma vez, a dica de segurar o dedo para ver o que uma habilidade ou item faz (não existe "passar o mouse")
function dicaDeToque(aba) {
  if (!['habilidades', 'atributos', 'itens', 'mochila'].includes(aba) || !matchMedia('(pointer: coarse)').matches || lerLocal('lolidle-dica-toque', false)) return;
  gravarLocal('lolidle-dica-toque', true);
  setTimeout(() => avisar(t('Segure o dedo em cima de uma habilidade, de um item ou de um botão para ver o que ele faz. Um toque rápido usa ou escolhe, como sempre.'), { titulo: t('Dica'), ok: t('Entendi') }), 300);
}
const lerLocal = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
// zoom do minimapa de Runeterra (09/10/2026, pedido de jogador): 1x, 2x ou 4x; a roda do mouse em cima dele ou os botões + e −
const ZOOM_MINI = [1, 2, 4];
function zoomMinimapa(passo) {
  const i = Math.max(0, Math.min(ZOOM_MINI.length - 1, ZOOM_MINI.indexOf(cena.zoomMini || 1) + passo));
  cena.zoomMini = ZOOM_MINI[i];
  try { localStorage.setItem('lolidle-mini-zoom', String(cena.zoomMini)); } catch {}
  document.querySelector('#mini-zoom [data-mini="+"]').disabled = i === ZOOM_MINI.length - 1;
  document.querySelector('#mini-zoom [data-mini="-"]').disabled = i === 0;
}
const gravarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let missoesMin = !!lerLocal('lolidle-missoes-min', false);      // quadro de missões recolhido (ver etiquetaMissoes)
// as duas abas do quadro: Missões e Eventos (a Vilemaw e os sorteios das lives)
const EVENTOS_RASTREIO = new Set(['rastreio-vilemaw', 'rastreio-sorteio']);
const FRAGS_RASTREIO = new Set(['rastreio-caveira']);      // a aba Frags (p587): a Caveira, a Vermelha e os frags
let avisouMorteMundo = false;
// desempenho (⚙): 'auto' (liga o modo leve sozinho se o aparelho ficar lento), 'normal' ou 'leve'
let hudTam = ['auto', '1', '0.85', '0.7'].includes(lerLocal('lolidle-hud-tam', 'auto')) ? lerLocal('lolidle-hud-tam', 'auto') : 'auto';
let latTam = ['auto', '1', '0.85', '0.7'].includes(lerLocal('lolidle-lat-tam', 'auto')) ? lerLocal('lolidle-lat-tam', 'auto') : 'auto';      // tamanho do painel do celular (gaveta), p588      // tamanho da barra de baixo (⚙ Configurações)
let desempenho = ['auto', 'normal', 'leve'].includes(lerLocal('lolidle-desempenho', 'auto')) ? lerLocal('lolidle-desempenho', 'auto') : 'auto', leveAuto = !!lerLocal('lolidle-leve-auto', false);      // o aviso maior de "itens podem cair" na primeira chegada a Runeterra (uma vez por sessão)
let abaRastreio = ['eventos', 'frags'].includes(lerLocal('lolidle-rastreio-aba', 'missoes')) ? lerLocal('lolidle-rastreio-aba', 'missoes') : 'missoes';
let donosRanking = {};      // o 1º de cada ranking (título: Dono do Mundo, O Mais Forte do Mundo, O Grande Caçador), vem do servidor
let loginInfo;                    // prêmio diário: o último pego ({ dia, seq }), null se nunca pegou; undefined até o jogo carregar
// o mundo cresceu (out/2026 o dobro, 13/10/2026 1,5x): a posição guardada num mundo anterior é convertida para o de agora
try {
  for (const [chave, k] of [['lolidle-mundo3-', 1.5], ['lolidle-mundo2-', 3]]) {
    const velha = lerLocal(chave + NOME, null);
    if (velha && localStorage.getItem(CHAVE_POS) == null) gravarLocal(CHAVE_POS, Number.isFinite(velha.x) ? { x: velha.x * k, y: velha.y * k } : velha);
    localStorage.removeItem(chave + NOME);
  }
} catch {}
// novidades: a última vista fica neste navegador; uma nova acende o botão e abre a janela sozinha
const CHAVE_NOVIDADE = 'lolidle-novidades-vistas';
// objetivos do começo (quadro "Próximo passo"; ver montarObjetivos): { i: índice ou 'fim', vendeu, runeterra }
const CHAVE_OBJ = 'lolidle-objetivos:' + NOME;
let obj = null;
// chaves das fortalezas no inventário (ver desenharChaves)
const CHAVE_CHAVES = 'lolidle-chaves-' + NOME;
let minhasChaves = lerLocal(CHAVE_CHAVES, []).filter((q) => q.ate > Date.now());
const guardarChaves = () => gravarLocal(CHAVE_CHAVES, minhasChaves);
const ICONE_CHAVE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="5" width="6" height="6" fill="#3a2410"/><rect x="2" y="6" width="4" height="4" fill="#f0c040"/><rect x="3" y="7" width="2" height="2" fill="#3a2410"/><rect x="6" y="7" width="9" height="2" fill="#3a2410"/><rect x="6" y="7" width="8" height="1" fill="#f0c040"/><rect x="11" y="9" width="2" height="3" fill="#3a2410"/><rect x="11" y="9" width="1" height="2" fill="#f0c040"/><rect x="14" y="9" width="1" height="2" fill="#3a2410"/><rect x="2" y="6" width="1" height="1" fill="#fff4b0"/></svg>');
const descobertas = new Set(['demacia', ...lerLocal(CHAVE_CIDADES, [])]);
let entradaCidade = null;          // escolhida no mapa: aparece na praça dessa cidade
const cidadeDeVolta = () => [...R.CIDADES].reverse().find((c) => descobertas.has(c.id) && estado.nivel >= c.faixa[0]) || R.CIDADES[0];
function posEntrada() {
  if (localAtual().aram) return posArena();      // na Arena: a base do seu lado (ou onde o servidor mandou)
  if (entradaCidade) { const id = entradaCidade; entradaCidade = null; return R.chegadaCidade(id); }
  const p = lerLocal(CHAVE_POS, null);
  if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && cena.mapa.livre(Math.floor(p.x), Math.floor(p.y))) return p;
  return R.chegadaCidade(cidadeDeVolta().id);
}
// guardiões vencidos: fortaleza → até quando ele fica morto (10 min, o tempo da chave); guardado no navegador para valer depois de recarregar
const CHAVE_GUARDIOES = 'lolidle-guardioes-' + NOME;
let guardioesMortos = lerLocal(CHAVE_GUARDIOES, {});
// o guardião só nasce quando o baú está cheio (ninguém abriu nos últimos 10 min) e já passou o tempo desde que ele foi vencido
function guardiaoEspera(fortaleza) {
  const f = R.mundoLogico().fortalezas[fortaleza], agora = Date.now();
  if (f && (cena.bausAbertos.get(f.bau.y * 1000 + f.bau.x) || 0) > agora) return true;
  return (guardioesMortos[fortaleza] || 0) > agora;
}
const infoMundo = () => ({ larg: cena.mapa.larg, pontos: cena.mapa.pontos, zonaEm: R.zonaEm, cidadeEm: R.cidadeEm, guardiaoEspera });
function entrarCena(l) {
  cena.entrarLocal(l);
  if (l.arena) {
    Arena.entrar(combate, cena.mapa.livre, posEntrada(), l.aram ? INFO_ARAM : infoMundo());
    if (l.aram) combate.arena.congelado = arenaPartida?.estado !== 'luta';      // na ponte só anda na hora da luta
    else sincronizarChaves();
  }
  else { M.definirCidade(null); combate.arena = null; }      // fora de Runeterra o estado de lá sai (senão a marca de luta PvP congelava e a poção curava 30%, p720)
}
cena.definirCampeao(CAMP, CAMPEAO.nome);
cena.definirSkin(estado.skin || 0);
cena.petNome = M.spriteMascote(estado);
entrarCena(localAtual());

function ajustarTela() {
  const deitado = innerWidth > innerHeight;
  // aparelho deitado (celular, ou tablet com toque): o jogo na tela inteira e a coluna numa gaveta (alça ☰ na borda)
  const gaveta = deitado && (innerHeight <= 600 || (matchMedia('(pointer: coarse)').matches && innerWidth <= 1400));
  if (document.body.classList.contains('gaveta') !== gaveta) { document.body.classList.toggle('gaveta', gaveta); abrirGaveta(false); }
  const empilhado = !gaveta && innerWidth <= 1000;
  $('#cliente').style.maxWidth = '';
  // o chat fica na coluna lateral: a tela pode usar a altura toda
  // empilhado (celular, tablet): em pé o jogo usa 62% da altura (o resto rola embaixo); deitado, a altura toda
  const livre = gaveta ? innerWidth - 4 : $('main').clientWidth - 4, livreAlt = gaveta ? innerHeight - 4 : empilhado ? (deitado ? innerHeight - 8 : innerHeight * 0.62) : $('main').clientHeight - 4;
  // monitor largo: em vez de sobrar faixa preta dos lados, a tela mostra mais mapa (de 15 até 24 tiles de largura)
  // celular em pé: 12 quadrados de largura (com 15 ficava tudo pequeno demais)
  const tiles = empilhado && !deitado ? (innerWidth < 600 ? 12 : 15) : Math.max(15, Math.min(24, Math.floor((livre / (livreAlt / VIS_A)) * 4) / 4));
  if (tiles !== VIS_L) cena.definirLargura(tiles);
  const base = VIS_L * T, alt = VIS_A * T;
  // ocupa todo o espaço; só usa um múltiplo inteiro (pixels perfeitos) quando ele quase preenche a área
  const cheio = Math.max(240, Math.min(livre, livreAlt * (base / alt))), k = Math.floor(cheio / base);
  const w = k >= 2 && base * k >= cheio * 0.94 ? base * k : cheio;
  $('#tela').style.width = `${w}px`; $('#tela').style.height = `${(w * alt) / base}px`;
  // a página fica só da largura do jogo + a coluna lateral (sem faixas vazias dos lados em monitor largo)
  if (!empilhado && !gaveta) { const cli = $('#cliente'), lado = $('#lateral').offsetWidth; if ($('main').clientWidth - w > 24) cli.style.maxWidth = `${Math.ceil(w + lado + 30)}px`; }
  { const m = cena.mapa, kk = w / (VIS_L * T), vw = m ? Math.min(m.larg, 256) : 256, vh = m ? Math.min(m.alt, 192) : 192, km = Math.min(0.75, 100 / vw);
    const lm = Math.round(vw * km), am = Math.round(vh * km);
    Object.assign($('#opcoes-mundo').style, { top: `${(am + 10) * kk}px`, right: `${2 * kk}px`, width: `${(lm + 4) * kk}px` });
    Object.assign($('#mini-zoom').style, { top: `${6 * kk}px`, right: `${(lm + 2) * kk}px` }); }      // + e − no canto de cima, à esquerda do minimapa
  $('#moldura').classList.toggle('hud-compacto', w < 800);
  $('#moldura').classList.toggle('hud-mini', w < 600);
  $('#moldura').classList.toggle('hud-sem-equip', w < 920);
  // tela baixa (celular deitado): quadro de missões, "Pontos para usar" e os botões do minimapa compactos
  $('#moldura').classList.toggle('hud-baixa', (w * alt) / base < 460 && w >= 600);
  document.body.classList.toggle('gaveta-alca', gaveta && w < 600);      // a barra no tamanho mínimo esconde os atalhos: a alça fica
  aplicarHudTam(); aplicarLatTam();
}
// a barra de baixo menor (pedido de jogadores no celular: "ocupa 1/4 da tela"); o automático usa 80% no celular deitado
// o painel do celular (a coluna como gaveta) menor (p588); o automático usa 80% no celular deitado
function aplicarLatTam() {
  const k = latTam === 'auto' ? (document.body.classList.contains('gaveta') && innerHeight <= 500 ? 0.8 : 1) : Number(latTam);
  document.body.style.setProperty('--lat-esc', String(k));
}
function aplicarHudTam() {
  const k = hudTam === 'auto' ? (document.body.classList.contains('gaveta') && innerHeight <= 500 ? 0.8 : 1) : Number(hudTam);
  $('#moldura').style.setProperty('--hud-esc', String(k));
}
// a gaveta (aparelho deitado): a alça abre e fecha; o fundo escuro e o Esc fecham
function abrirGaveta(abrir = !document.body.classList.contains('gaveta-aberta')) {
  document.body.classList.toggle('gaveta-aberta', abrir && document.body.classList.contains('gaveta'));
  $('#bt-gaveta').setAttribute('aria-expanded', String(document.body.classList.contains('gaveta-aberta')));
}
$('#bt-gaveta').addEventListener('click', (e) => { e.currentTarget.blur(); abrirGaveta(); });
$('#hud-painel').addEventListener('click', (e) => { e.currentTarget.blur(); abrirGaveta(true); });
$('#gaveta-fundo').addEventListener('click', () => abrirGaveta(false));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('gaveta-aberta') && !document.querySelector('.janela:not([hidden])')) abrirGaveta(false); });
addEventListener('resize', ajustarTela);
ajustarTela();
// a página ainda se ajeita depois de abrir (e o celular gira): recalcula, senão a barra de baixo ficava cortada no celular deitado
requestAnimationFrame(ajustarTela); setTimeout(ajustarTela, 600); setTimeout(ajustarTela, 2000);
addEventListener('orientationchange', () => setTimeout(ajustarTela, 300));
window.visualViewport?.addEventListener('resize', () => ajustarTela());

// Edge (p723): segurar o botão direito e arrastar para a esquerda é o gesto de "voltar página", e no jogo se anda segurando o
// botão direito. Até 1,5 s depois de soltar o botão direito o voltar do navegador é desfeito; fora disso, o voltar funciona.
let direitoSolto = 0;
addEventListener('mouseup', (e) => { if (e.button === 2) direitoSolto = performance.now(); }, true);
try { history.pushState({ lolidle: 1 }, '', location.href); } catch {}
addEventListener('popstate', () => {
  if (performance.now() - direitoSolto < 1500) { try { history.pushState({ lolidle: 1 }, '', location.href); } catch {} }
  else history.back();
});
// clicar num NPC na tela conversa com ele (o andar é no botão direito, ver comandoNaFonte)
$('#tela').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  const npc = cena.clicar(e.clientX - r.left, e.clientY - r.top, r.width);
  if (npc) falarCom(npc.nome);
  else { const j = cena.jogadorEm(e.clientX - r.left, e.clientY - r.top, r.width); if (j) abrirPerfil(j); }      // outro jogador na Fonte: a ficha
});
// Fonte, botão direito (igual a Runeterra): no chão anda até lá; num NPC vai até ele e conversa
function comandoNaFonte(e) {
  if (!M.naBase(estado) || localAtual().arena || combate.darius.morto > 0) return;
  e.preventDefault();
  const r = $('#tela').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const npc = cena.clicar(x, y, r.width);
  if (npc) falarCom(npc.nome); else cena.andarPara(x, y, r.width);
}
// um NPC da Fonte na tela vira um retângulo invisível por cima dele, para o tutorial e o "Como?" apontarem
function alvoNpc(nome) {
  if (!M.naBase(estado) || localAtual().arena) return null;
  const n = cena.npcs?.find((x) => x.nome === nome);
  if (!n) return null;
  let el = $('#alvo-npc');
  if (!el) { $('#moldura').insertAdjacentHTML('beforeend', '<div id="alvo-npc" aria-hidden="true"></div>'); el = $('#alvo-npc'); }
  const tela = $('#tela'), larg = tela.getBoundingClientRect().width, k = larg / (VIS_L * T);
  // NPC comum ocupa o tile dele e o de cima; os grandes (Ornn), 2×3 tiles acima e à esquerda
  const x0 = (n.grande ? n.x - 1 : n.x) * T, y0 = (n.grande ? n.y - 2 : n.y - 1) * T, w = (n.grande ? 2 : 1) * T, h = (n.grande ? 3 : 2) * T;
  const left = (x0 - cena.cam.x) * k, top = (y0 - cena.cam.y) * k;
  if (left + w * k < 0 || top + h * k < 0 || left > larg || top > tela.getBoundingClientRect().height) return null;      // fora da tela
  Object.assign(el.style, { left: `${tela.offsetLeft + left}px`, top: `${tela.offsetTop + top}px`, width: `${w * k}px`, height: `${h * k}px` });
  return el;
}
$('#tela').addEventListener('mousemove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  cena.mouseCss = { x: e.clientX - r.left, y: e.clientY - r.top, larg: r.width };
  const npc = cena.clicar(e.clientX - r.left, e.clientY - r.top, r.width);
  cena.npcFoco = npc || null;
  e.currentTarget.style.cursor = npc ? 'pointer' : '';
});
$('#tela').addEventListener('mouseleave', () => { cena.npcFoco = null; cena.mouseCss = null; });

const tempoTexto = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}min` : `${Math.max(1, Math.round(s / 60))} min`);
// ---------- automático (VIP) voltou para a Fonte ----------
let voltaAuto = null;          // motivo da volta em andamento ('pocoes' ou 'mochila')
async function explicarVoltaAuto(motivo) {
  const pocoes = motivo === 'pocoes';
  const opcao = pocoes ? t('Voltar à Fonte quando acabarem as poções de vida') : t('Voltar à Fonte quando a mochila encher');
  const texto = (pocoes
    ? t('O automático (VIP) trouxe você de volta para a Fonte porque as poções de vida acabaram, para você não morrer. Compre mais poções com o Lojista e volte a caçar.')
    : t('O automático (VIP) trouxe você de volta para a Fonte porque a mochila encheu, para você não perder saque. Venda os itens com o Lojista (ou guarde na Tesoureira) e volte a caçar.'))
    + ' ' + t('Se não quiser que ele volte sozinho, desligue "{opcao}" na aba ⚙ Auto.', { opcao });
  const lojista = await confirmar(texto, { titulo: pocoes ? t('Acabaram as poções de vida') : t('A mochila encheu'), ok: t('Ir ao Lojista'), cancelar: t('Ajustar o automático') });
  if (!M.naBase(estado)) return;
  if (lojista) { falarCom('Lojista'); return; }
  abrirAba('auto');
  const caixa = $(pocoes ? '#rot-pocoes' : '#rot-mochila')?.closest('label');
  if (caixa) { caixa.classList.add('obj-aponta'); caixa.scrollIntoView({ block: 'nearest' }); setTimeout(() => caixa.classList.remove('obj-aponta'), 6000); }
}

// ---------- viagens ----------
// toda viagem leva um tempo (barra na tela): andar, atacar, usar habilidade ou levar dano cancela. Em Runeterra,
// em combate nem começa. Assim ninguém some no meio de uma luta.
const TEMPO_VIAGEM = { runeterra: 5, cidade: 5, rift: 3 };
let viagem = null;
function emCombateAqui() { return localAtual().arena && M.emCombate(combate); }
function comecarViagem(nome, dur, fazer) {
  if (naAram()) { cena.aviso(t('Você está numa partida da arena.'), '#ff7050'); return; }
  if (typeof dungeonLuta === 'function' && dungeonLuta()) { cena.aviso(t('Seu grupo está na dungeon: espere a luta acabar na Fonte.'), '#9fe0ff'); return; }      // p665
  if (combate.darius.morto > 0 || bloqueioCaveira()) return;
  if (viagem) { if (viagem.nome === nome) return; cancelarViagem(); }
  if (emCombateAqui()) { avisoCombate(); return; }
  const A = localAtual().arena ? combate.arena : null;
  if (A) { A.destino = null; A.caminho = null; A.alvoAtaque = null; }
  viagem = { nome, dur, t: 0, fazer, vida: estado.vida, local: estado.local, x: A?.x, y: A?.y };
  cena.viagem = { nome, k: 0 };
  fecharJanelas();
  // celular: a gaveta fecha e, se o jogo está fora da tela (em pé o Mapa fica embaixo dele), a página volta até ele
  if (document.body.classList.contains('gaveta-aberta')) abrirGaveta(false);
  { const r = $('#tela').getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 60) $('#tela').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  log(t('Viajando para {lugar}... ({s} segundos; Esc, andar, atacar ou levar dano cancela)', { lugar: nome, s: dur }), 'npc');
  som.efeito('item');
}
function cancelarViagem(motivo) {
  if (!viagem) return;
  viagem = null; cena.viagem = null;
  if (motivo) { cena.aviso(motivo, '#ff9070'); log(motivo, 'morte'); }
}
function avisoCombate() {
  cena.aviso(t('Em combate: não dá para viajar agora'), '#ff7060');
  log(t('Você está em combate. Saia da luta (e fique alguns segundos sem levar dano) antes de viajar ou voltar para a Fonte.'), 'morte');
}
function passoViagem(dt) {
  if (!viagem) return;
  const A = localAtual().arena ? combate.arena : null;
  if (combate.darius.morto > 0 || estado.local !== viagem.local) return cancelarViagem();
  if (estado.vida < viagem.vida - 0.5) return cancelarViagem(t('Viagem cancelada: você levou dano'));
  if (A && (Math.hypot(A.x - viagem.x, A.y - viagem.y) > 0.3 || A.alvoAtaque || A.entrada.fila.length)) return cancelarViagem(t('Viagem cancelada'));
  viagem.vida = estado.vida;
  viagem.t += dt; cena.viagem.k = Math.min(1, viagem.t / viagem.dur);
  if (viagem.t >= viagem.dur) { const f = viagem.fazer; viagem = null; cena.viagem = null; f(); }
}
function irPara(id) {
  const l = M.LOCAL[id];
  if (!M.viajar(estado, combate, id)) return;
  entrarCena(l);
  fecharJanelas();
  if (l.base) log(t('Você está na Fonte.'), 'chefe');
  else if (l.aram) { /* a Arena avisa no entrarNaArena */ }
  else if (l.arena) {
    log(t('Runeterra: o mundo aberto, no controle. +{bonus}% de XP e de chance de drop. Quanto mais longe de Demacia, mais fortes os monstros.', { bonus: Math.round((M.ARENA.bonus - 1) * 100) }), 'chefe');
    log(t('Botão direito no chão para andar · botão direito num monstro para atacar · Q, W, E e R usam as 4 habilidades da barra, mirando no mouse · B volta para a Fonte.'), 'npc');
    log(t('Outros jogadores também andam por aqui. A caveira (ou a tecla P) liga o PK: aí suas habilidades acertam jogadores e o botão direito num jogador ataca. Nas cidades ninguém luta.'), 'morte');
  } else {
    log(t('Você viajou para {lugar} (nível ideal {min}–{max}).', { lugar: l.nome, min: l.faixa[0], max: l.faixa[1] }), 'chefe');
    cena.aviso(l.nome, '#50ff50');
  }
  atualizarUI();
}
function chegarNaBase(msg, cor) {
  entrarCena(M.LOCAL.fonte);
  cena.aviso(msg, cor);
  atualizarUI();
}

// ---------- loop ----------
// medidor da caçada (pedido de jogador): conta XP, ouro, abates, dano e o que caiu desde que abriu o jogo (ou desde o Zerar)
const novaAnalise = () => ({ ini: Date.now(), xp: 0, ouro: 0, abates: 0, chefes: 0, dano: 0, maior: 0, janela: [], itens: { basico: 0, epico: 0, lendario: 0 }, espolios: 0, runas: 0, mortes: 0 });
let analise = novaAnalise();
function contarAnalise(ev) {
  const A = analise;
  if (ev.tipo === 'abate') {
    A.abates++; if (ev.chefe) A.chefes++;
    A.xp += ev.xp || 0; A.ouro += ev.ouro || 0;
    for (const id of ev.itens || []) { const r = M.raridade(M.ITENS[M.baseId(id)] || {}); if (A.itens[r] != null) A.itens[r]++; }
    A.espolios += (ev.espolios || []).length; A.runas += (ev.gemas || []).length;
  } else if (ev.tipo === 'dano' && ev.valor > 0 && !String(ev.alvo).startsWith('j:')) {      // dano nos monstros (não em jogadores)
    A.dano += ev.valor; if (ev.fonte !== 'queima' && ev.fonte !== 'sangue' && ev.valor > A.maior) A.maior = ev.valor;
    const agora = Date.now(); A.janela.push([agora, ev.valor]);
    while (A.janela.length && agora - A.janela[0][0] > 60000) A.janela.shift();
  } else if (ev.tipo === 'morreu') A.mortes++;
}
function contasAnalise() {
  const A = analise, seg = Math.max(60, (Date.now() - A.ini) / 1000), h = seg / 3600;
  const ultimo = A.janela.reduce((s, [, v]) => s + v, 0), jan = A.janela.length ? Math.max(10, Math.min(60, (Date.now() - A.janela[0][0]) / 1000)) : 60;
  return { seg: (Date.now() - A.ini) / 1000, xpH: A.xp / h, ouroH: A.ouro / h, abatesH: A.abates / h, dps: ultimo / jan, dpsMedio: A.dano / seg };
}
const tempoCacada = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? t('{h} h {m} min', { h, m }) : t('{m} min', { m }); };
function desenharAnalise() {
  const A = analise, c = contasAnalise(), linha = (rot, val) => `<div class="an-linha"><span>${rot}</span><b>${val}</b></div>`;
  $('#analise-corpo').innerHTML = `
    <p class="an-tempo">${t('Desde que você abriu o jogo')} · ${tempoCacada(c.seg)}</p>
    <div class="an-grade">
      <div class="an-cartao"><small>${t('XP por hora')}</small><b>${fmt(Math.round(c.xpH))}</b><em>${t('{n} no total', { n: fmt(Math.round(A.xp)) })}</em></div>
      <div class="an-cartao ouro"><small>${t('Ouro por hora')}</small><b>${fmt(Math.round(c.ouroH))}</b><em>${t('{n} no total', { n: fmt(Math.round(A.ouro)) })}</em></div>
      <div class="an-cartao"><small>${t('Abates por hora')}</small><b>${fmt(Math.round(c.abatesH))}</b><em>${t('{n} no total', { n: inteiro(A.abates) })}${A.chefes ? ' · ' + t('{n} chefes', { n: A.chefes }) : ''}</em></div>
      <div class="an-cartao dano"><small>${t('Dano por segundo')}</small><b>${fmt(Math.round(c.dps))}</b><em>${t('último minuto · maior golpe {n}', { n: fmt(Math.round(A.maior)) })}</em></div>
    </div>
    <div class="an-secao">${t('O que caiu')}</div>
    ${linha('<i class="an-bola basico"></i>' + t('Básicos'), inteiro(A.itens.basico))}
    ${linha('<i class="an-bola epico"></i>' + t('Épicos'), inteiro(A.itens.epico))}
    ${linha('<i class="an-bola lendario"></i>' + t('Lendários'), inteiro(A.itens.lendario))}
    ${linha(t('Espólios'), inteiro(A.espolios))}${linha(t('Runas'), inteiro(A.runas))}${linha(t('Mortes'), inteiro(A.mortes))}
    <p class="fraco an-nota">${t('Conta só a caçada (monstros que você derrotou). Tarefas, baús e prêmios ficam de fora.')}</p>
    <button type="button" class="botao" data-zerar-analise>${t('Zerar e começar de novo')}</button>`;
}
let relogioAnalise = null;
function abrirAnalise() {
  desenharAnalise(); $('#janela-analise').hidden = false;
  clearInterval(relogioAnalise); relogioAnalise = setInterval(() => { if ($('#janela-analise').hidden) clearInterval(relogioAnalise); else desenharAnalise(); }, 1000);
}
$('#analise-corpo').addEventListener('click', (e) => { if (e.target.closest('[data-zerar-analise]')) { analise = novaAnalise(); desenharAnalise(); } });
function processarEventos() {
  const acertos = [];
  for (const ev of combate.eventos) {
    contarAnalise(ev);
    if (ev.tipo === 'abate') avisarSaque(ev);
    if (ev.tipo === 'grupo' && ev.furioso && !naArena()) som.efeito('furia');      // monstro furioso no Rift
    if (ev.tipo === 'abate' && ev.furioso) som.efeito('fanfarra');
    if (ev.tipo === 'morreu' && ev.runeterra && pertoDaVilemaw()) log(t('Perto da Vilemaw os seus itens não caem quando você morre.'), 'npc');
    else if (ev.tipo === 'morreu' && ev.runeterra) soltarSaco();
    if (ev.tipo === 'chavePega') { const z = R.mundoLogico().fortalezas[ev.fortaleza]?.zona; avisoSaque({ img: iconeChaveUrl(z), nome: t(NOME_CHAVE[z] || 'Chave da Fortaleza'), cor: '#ffd84a', tipo: t('Chave da fortaleza · vale 10 minutos'), classe: 'lendario' }); }
    if (naArena()) {
      // a habilidade vai antes dos acertos dela (o servidor só aceita acerto de lance que ele já viu)
      if (ev.tipo === 'habilidade') tempoReal.enviar({ t: 'lance', tecla: ev.tecla, lance: ev.lance, dx: ev.dx, dy: ev.dy, ...((mi) => (mi ? { mx: +mi.x.toFixed(2), my: +mi.y.toFixed(2) } : {}))(combate.arena?.entrada?.mira),      // o ponto mirado (p652)
        ...(ev.portal ? { px: ev.portal.x, py: ev.portal.y } : {}), ...(ev.salto ? { px: ev.salto.x, py: ev.salto.y } : {}), ...(ev.tornado ? { tornado: true } : {}) });
      if (ev.tipo === 'item' && ev.nome === t('Renascimento') && !ev.pvp) tempoReal.enviar({ t: 'anjoUsado' });      // Anjo Guardião contra monstro: a recarga vale no PvP (p608)
      if (ev.tipo === 'divisao' && !ev.pvp) tempoReal.enviar({ t: 'zacDividiu' });      // Zac: se dividiu num golpe de monstro (o servidor anota a recarga e mostra aos outros)
      if (ev.tipo === 'adagaPega') tempoReal.enviar({ t: 'adaga' });      // Katarina: a adaga pega adianta o Shunpo
      if (ev.tipo === 'acertoPvp') { acertos.push({ t: 'acerto', alvo: ev.alvo, tecla: ev.tecla, lance: ev.lance }); continue; }
      if ((ev.tipo === 'prisma' || ev.tipo === 'facetado') && ev.jogadores?.length) for (const nome of ev.jogadores) acertos.push({ t: 'acerto', alvo: nome, tecla: 'D', lance: combate.arena?.lancePorTecla?.D ?? combate.arena?.lanceAtual });      // Faísca da Lux e pulso do Taric
      if (ev.tipo === 'escudoAliado') { acertos.push({ t: 'escudoAliado', alvo: ev.nome, lance: ev.lance }); continue; }
      if (ev.tipo === 'apoioAliado') { acertos.push({ t: 'apoioAliado', alvo: ev.nome, tipo: ev.apoio, lance: ev.lance }); continue; }
      if (ev.tipo === 'ataquePvp') { cena.ataqueEmJogador(ev.alvo); continue; }
      if (ev.tipo === 'zonaPk') {
        if (ev.entrou && R.ZONAS_PK.find((z) => z.nome === ev.nome)?.semCap) { cena.aviso(t('⚔ {zona}: PK obrigatório, sem limite de nível · +{p}% de XP', { zona: t(ev.nome), p: Math.round(R.PK_BONUS * 100) }), '#ff4a4a'); log(t('Você entrou na {zona}, uma Zona de Guerra vermelha: o PK fica ligado, qualquer nível pode atacar você aqui dentro e a experiência rende +{p}%. Matar aqui não dá Caveira.', { zona: t(ev.nome), p: Math.round(R.PK_BONUS * 100) }), 'morte'); som.efeito('alerta'); }
        else if (ev.entrou) { cena.aviso(t('⚔ {zona}: PK obrigatório · +{p}% de XP', { zona: t(ev.nome), p: Math.round(R.PK_BONUS * 100) }), '#ff9a3a'); log(t('Você entrou na {zona}, uma Zona de Guerra laranja: o PK fica ligado, só quem está até {n} níveis de você pode atacar e a experiência rende +{p}%. Matar aqui não dá Caveira.', { zona: t(ev.nome), n: difNivelPvp, p: Math.round(R.PK_BONUS * 100) }), 'morte'); som.efeito('alerta'); }
        else { cena.aviso(t('Você saiu da Zona de Guerra'), '#8ad8ff'); log(ev.pvp ? t('Você saiu da {zona}. O PK continua ligado, como estava antes.', { zona: t(ev.nome) }) : t('Você saiu da {zona}. Modo seguro de novo.', { zona: t(ev.nome) }), 'npc'); }
        atualizarUI(); continue;
      }
      if (ev.tipo === 'montando') { cena.aviso(t('Montando…'), '#e8d8a0'); continue; }
      if (ev.tipo === 'montou') { cena.efeito('poof', cena.darius, 0.5); som.efeito('item'); atualizarMontaria(); continue; }
      if (ev.tipo === 'desmontou') { cena.efeito('poof', cena.darius, 0.4); if (ev.derrubado) cena.aviso(t('Você foi derrubado da montaria!'), '#ff7050'); atualizarMontaria(); continue; }
      if (ev.tipo === 'montariaCancelada') { cena.aviso(t('Montaria cancelada'), '#c0b8a8'); continue; }
      if (ev.tipo === 'montariaNivel') {
        const nm = t(M.nomeMontaria(estado)), vel = Math.round(M.velMontaria(estado) * 100);
        cena.aviso(t('{montaria} subiu para o nível {n}!', { montaria: nm, n: ev.nivel }), '#ffd84a');
        log(t('{montaria} subiu para o nível {n}: agora anda {vel}% mais rápido.', { montaria: nm, n: ev.nivel, vel }), 'raro');
        som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.2, '#ffe080'); atualizarMontaria(); continue;
      }
      if (ev.tipo === 'acertoMonstro') { acertos.push({ t: 'acertoMonstro', dono: ev.dono, id: ev.id, tecla: ev.tecla, lance: ev.lance, ...(ev.f ? { f: ev.f } : {}) }); continue; }
      if (ev.tipo === 'ataqueMonstroOutro') { cena.ataqueEmMonstroOutro(ev.chave); continue; }
      if (ev.tipo === 'abateRoubado') { acertos.push({ t: 'abateMonstro', id: ev.id, para: ev.para }); log(t('{quem} deu o último golpe e levou o abate de {monstro}.', { quem: ev.para, monstro: t(ev.nome) }), 'morte'); continue; }
    }
    som.evento(ev, CAMP);
    if (ev.tipo === 'renasceu') {
      if (localAtual().arena || combate.arena?.mundo) gravarLocal(CHAVE_POS, null);      // morreu em Runeterra: volta pela cidade
      chegarNaBase(t('Fale com a Soraka para se curar.'), '#8ad8ff');
      log(t('Você acordou na Fonte, muito ferido. Fale com a Soraka para se curar.'), 'npc');
    } else if (ev.tipo === 'guardiaoVencido') {
      tempoReal.enviar({ t: 'guardiao', fortaleza: ev.fortaleza });      // o servidor anota a vitória (o baú só abre com ela)
      guardioesMortos = Object.fromEntries(Object.entries({ ...guardioesMortos, [ev.fortaleza]: Date.now() + 10 * 60000 }).filter(([, ate]) => ate > Date.now()));
      gravarLocal(CHAVE_GUARDIOES, guardioesMortos);
      log(t('O guardião da fortaleza caiu e largou a Chave da Fortaleza! Pegue a chave e abra o baú.'), 'raro');
      cena.aviso(t('O guardião caiu! Pegue a chave'), '#ffd84a');
    } else if (ev.tipo === 'chavePega') {
      minhasChaves = minhasChaves.filter((q) => q.fortaleza !== ev.fortaleza).concat({ fortaleza: ev.fortaleza, ate: ev.ate }); guardarChaves();
      log(t('Você pegou a Chave da Fortaleza. Ela foi para o inventário (aba Itens) e vale 10 minutos.'), 'raro');
    } else if (ev.tipo === 'nivel') {
      cena.evento(ev, combate);
      if ([2, 3, 4, 5, 6, 8, 10, 15, 20].includes(ev.nivel)) funil('nivel:' + ev.nivel);
      if (ev.nivel === M.PRESENTE_NIVEL.nivel) setTimeout(() => oferecerPresente(), 1500);
      const HK = M.habDe(estado), novas = M.ORDEM_HAB.filter((k) => HK[k].nivel === ev.nivel && !(estado.ranks[k] > 0));
      for (const k of novas) {
        const nome = HABS[k]?.nome || k;
        cena.aviso(t('Nova habilidade liberada: {nome}!', { nome }), '#ffd84a');
        log(HK[k].passiva ? t('Nova passiva liberada: {nome}. Aprenda na aba Habilidades (botão +).', { nome })
          : t('Nova habilidade liberada: {nome}. Aprenda na aba Habilidades (botão +) e coloque na barra.', { nome }), 'raro');
      }
      log(t('Você ganhou 1 ponto de habilidade e {n} pontos de atributo. Use nas abas Habilidades e Atributos (ou no botão dourado em cima da barra).', { n: M.PONTOS_POR_NIVEL }), 'raro');
      if (M.mochilaDe(ev.nivel) > M.mochilaDe(ev.nivel - 1)) {
        const tam = M.mochilaDe(ev.nivel);
        cena.aviso(t('Mochila maior: +{n} espaços!', { n: tam - M.mochilaDe(ev.nivel - 1) }), '#7fd8ff');
        log(t('Sua mochila ganhou {n} espaços e agora leva {total} itens.', { n: tam - M.mochilaDe(ev.nivel - 1), total: tam }) + (tam < M.MOCHILA ? ' ' + t('Os próximos liberam no nível {nivel}.', { nivel: M.nivelDoEspaco(tam) }) : ''), 'raro');
      }
      if (novas.length) som.efeito('raro');
      const bp = $('#hud-pontos'); bp.classList.remove('novo'); void bp.offsetWidth; bp.classList.add('novo');
    } else if (ev.tipo === 'rotinaVolta') {
      // o automático decidiu voltar: avisa bem à vista (antes era só uma linha no chat e o jogador não entendia)
      const pocoes = ev.motivo === 'pocoes';
      voltaAuto = ev.motivo;
      cena.aviso(pocoes ? t('⚠ Sem poções de vida: voltando para a Fonte') : t('⚠ Mochila cheia: voltando para a Fonte'), '#ffb050');
      cena.balao(cena.darius, pocoes ? t('Acabaram as poções!') : t('A mochila encheu!'), '#ffb050');
      som.efeito('alerta');
      log(pocoes ? t('Acabaram as poções de vida: o automático (VIP) está levando {nome} de volta para a Fonte, para não morrer. Lá ele fica parado.', { nome: NOME })
        : t('A mochila encheu: o automático (VIP) está levando {nome} de volta para a Fonte, para não perder saque. Lá ele fica parado.', { nome: NOME }), 'morte');
    } else if (ev.tipo === 'chegouBase') {
      chegarNaBase(t('Fonte'), '#8ad8ff');
      log(t('Você voltou para a Fonte.'), 'npc');
      if (voltaAuto) { const motivo = voltaAuto; voltaAuto = null; explicarVoltaAuto(motivo); }
    } else if (ev.tipo === 'zona') {
      avisoZona(ev);
    } else if (ev.tipo === 'tarefaPronta') {
      cena.aviso(t('Tarefa completa!'), '#ffd84a');
      log(t('Tarefa completa: {monstro}! Volte à Fonte e fale com o Capitão da Legião.', { monstro: ev.monstro ? t(ev.monstro) : M.LOCAL[ev.local]?.nome || '' }), 'raro');
    } else cena.evento(ev, combate);
  }
  // no grupo (Runeterra): cada abate seu vira XP dividida para quem do grupo está perto (o servidor confere e calcula)
  if (grupoAtual && localAtual().arena) for (const ev of combate.eventos) if (ev.tipo === 'abate' && ev.alvo != null) tempoReal.enviar({ t: 'abateGrupo', id: ev.alvo });
  combate.eventos.length = 0;
  if (acertos.length && naArena()) enviarTempoReal(0.1);      // a posição antes dos acertos (o servidor mede a distância de onde você está)
  for (const m of acertos) tempoReal.enviar(m);
  const a = M.atributos(estado);
  if (localAtual().arena) { cena.sincronizarArena(combate, estado.vida / a.vida, a.mana ? estado.mana / a.mana : 0); seguirMundo(); }
  else if (dgVendo) dungeonSincronizar();      // p670
  else cena.sincronizar(combate, estado.vida / a.vida, a.mana ? estado.mana / a.mana : 0);
}
// ---------- Runeterra: zonas, cidades, NPCs das cidades e viagem rápida ----------
const zonaAvisada = new Map();
function avisoZona(ev) {
  const agora = Date.now();
  if (ev.cidade) {
    const c = R.CIDADE[ev.cidade];
    cena.aviso(c.nome, c.cor);
    if (agora - (zonaAvisada.get(c.id) || 0) > 60000) log(t('{cidade}: cidade segura. Aqui não entra monstro nem vale PvP, e a vida e a mana voltam rápido. A Soraka e o Lojista atendem na praça.', { cidade: c.nome }), 'npc');
    zonaAvisada.set(c.id, agora);
    if (!descobertas.has(c.id)) {
      descobertas.add(c.id); gravarLocal(CHAVE_CIDADES, [...descobertas]);
      log(t('Você descobriu {cidade}! Agora dá para viajar direto para cá pelo mapa (M).', { cidade: c.nome }), 'raro');
    }
    return;
  }
  const l = M.LOCAL[ev.zona];
  if (!l || agora - (zonaAvisada.get(l.id) || 0) < 15000) { if (l) zonaAvisada.set(l.id, agora); return; }
  zonaAvisada.set(l.id, agora);
  cena.aviso(t('{zona} · nível {min}–{max}', { zona: t(R.NOME_ZONA[l.id]), min: l.faixa[0], max: l.faixa[1] }), corFaixa(l));
  log(t('{zona} (nível {min}–{max}): {monstros}', { zona: t(R.NOME_ZONA[l.id]), min: l.faixa[0], max: l.faixa[1], monstros: l.monstros.map(([n]) => t(n)).join(', ') })
    + (l.chefe ? t('; às vezes aparece o {chefe}', { chefe: t(l.chefe[0]) }) : '') + '.', estado.nivel < l.faixa[0] - 3 ? 'morte' : 'npc');
}
let posT = 0, npcPendente = null;
function seguirMundo() {
  const A = combate.arena;
  if (!A?.mundo || A.mundo.aram) return;      // a posição da ponte não substitui a de Runeterra
  if ((posT += DT) > 2 && combate.darius.morto <= 0) { posT = 0; gravarLocal(CHAVE_POS, { x: +A.x.toFixed(2), y: +A.y.toFixed(2) }); }
  if (npcPendente) {
    if (Math.hypot(A.x - npcPendente.x, A.y - npcPendente.y) < 0.9) { const n = npcPendente.nome; npcPendente = null; abrirConversa(n); }
    else if (!A.destino) npcPendente = null;          // desistiu (clicou em outro lugar)
  }
  verBaus(A);
  verSacos(A);
  if ((bausT -= DT) <= 0) { bausT = 30; lerBaus(); lerSacos(); }
}
// ---------- sacos de quem morreu em Runeterra (estilo Tibia) ----------
// os sacos vêm do servidor ao entrar (e a cada 30 s) e as mudanças chegam pelo tempo real ('saco', 'sacoFim')
async function lerSacos() {
  try { const r = await rede.sacos(); cena.sacos = new Map(r.sacos.map((s) => [s.id, s])); } catch {}
}
// morreu em Runeterra: o servidor sorteia os itens equipados que caem e deixa o saco onde você caiu
async function soltarSaco(tentativa = 0) {
  if (operando) { if (tentativa < 25) setTimeout(() => soltarSaco(tentativa + 1), 400); return; }
  const A = combate.arena, r = await operarServidor('/api/morte', { x: A?.x, y: A?.y });
  if (!r) return;
  if (r.vermelha) { cena.aviso(t('☠ Caveira Vermelha: metade dos seus itens caiu!'), '#ff3030'); log(t('Você morreu com a Caveira Vermelha: caiu metade do que você carregava (equipados e mochila).'), 'morte'); }
  else if (r.porJogador && r.saco) log(t('Você morreu para outro jogador: havia 30% de chance de cair 1 dos seus itens equipados.'), 'morte');
  if (r.bencao) {
    log(r.bencao.salvos ? t('A Bênção Protetora segurou {n} item(ns) que iam cair. Ela foi gasta: compre outra na Loja para continuar protegido.', { n: r.bencao.salvos })
      : t('A Bênção Protetora foi gasta nesta morte (nenhum item ia cair). Compre outra na Loja para continuar protegido.'), 'raro');
    cena.aviso(t('🕊 A Bênção protegeu seus itens!'), '#ffe8a0');
    return;
  }
  if (!r.saco) { log(t('Nenhum item caiu desta vez.'), 'npc'); return; }
  cena.sacos.set(r.saco.id, r.saco);
  log(t('{n} itens caíram num saco onde você morreu. Volte lá para pegar: qualquer jogador que passar por cima também pega, e o saco some em 30 minutos.', { n: r.saco.itens.length }), 'morte');
  for (const id of r.saco.itens) log(t('Caiu no saco: {item}', { item: descreverItem(id).nome }), 'morte');
  cena.aviso(t('Seus itens caíram no chão!'), '#ff8040');
  log(t('Dica: a Bênção Protetora, na Loja, segura os itens na próxima morte em Runeterra.'), 'npc');
}
// passou por cima de um saco: pega o que couber na mochila
const tentouSaco = new Map();
function verSacos(A) {
  if (combate.darius.morto > 0 || operando || !cena.sacos.size) return;
  for (const s of cena.sacos.values()) {
    if (Math.hypot(A.x - s.x, A.y - s.y) > 1 || Date.now() < (tentouSaco.get(s.id) || 0)) continue;
    tentouSaco.set(s.id, Date.now() + 6000);
    pegarSaco(s);
    break;
  }
}
async function pegarSaco(s) {
  const r = await operarServidor('/api/saco/pegar', { id: s.id });
  if (!r) return;
  if (r.resto) cena.sacos.set(s.id, { ...s, itens: s.itens.slice(r.pegou.length) }); else cena.sacos.delete(s.id);
  som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.2, '#ffd040');
  const meu = r.dono === estado.nome;
  log(meu ? t('Você pegou de volta {n} itens do seu saco.', { n: r.pegou.length }) : t('Você pegou {n} itens do saco de {dono}.', { n: r.pegou.length, dono: r.dono }), 'raro');
  for (const id of r.pegou) { const it = descreverItem(id); avisoSaque({ img: imgItem(id), nome: it.nome, cor: it.cor, tipo: t('Do saco') }); }
  if (r.resto) log(t('A mochila encheu: {n} itens ficaram no saco.', { n: r.resto }), 'morte');
}
// chaves das fortalezas: ficam no inventário (seção Chaves) e expiram 10 minutos depois de cair do guardião
function sincronizarChaves() {
  const A = combate.arena;
  if (A) A.chavesMao = minhasChaves.map((q) => ({ ...q }));
}
function expirarChaves() {
  const agora = Date.now(), vencidas = minhasChaves.filter((q) => q.ate <= agora);
  if (!vencidas.length) return;
  minhasChaves = minhasChaves.filter((q) => q.ate > agora); guardarChaves(); sincronizarChaves();
  for (const q of vencidas) { const f = R.mundoLogico().fortalezas[q.fortaleza]; log(t('A Chave da Fortaleza ({zona}) expirou.', { zona: t(R.NOME_ZONA[f?.zona] || '') }), 'morte'); }
}
const urlsChave = {};
const NOME_CHAVE = { 'rota-inf': 'Chave de Bronze', 'rota-sup': 'Chave de Ferro', lobos: 'Chave de Osso', azul: 'Chave de Cristal',
  vermelho: 'Chave em Brasa', rio: 'Chave das Águas', dragao: 'Chave do Dragão', barao: 'Chave do Vazio' };
const iconeChaveUrl = (zona) => (urlsChave[zona] ??= iconeChave(zona).toDataURL());
function desenharChaves() {
  const agora = Date.now();
  const html = minhasChaves.length ? minhasChaves.map((q) => {
    const f = R.mundoLogico().fortalezas[q.fortaleza], resta = Math.max(0, q.ate - agora), mm = Math.floor(resta / 60000), ss = Math.floor((resta % 60000) / 1000);
    return `<div class="chave-bolsa${resta < 60000 ? ' acabando' : ''}"><img src="${iconeChaveUrl(f?.zona)}" alt=""><b>${t(NOME_CHAVE[f?.zona] || 'Chave da Fortaleza')}</b><span>${t(R.NOME_ZONA[f?.zona] || '')} · ${t('expira em {tempo}', { tempo: `${mm}:${String(ss).padStart(2, '0')}` })}</span></div>`;
  }).join('') : `<p class="vazio">${t('Vença o guardião de uma fortaleza em Runeterra para ganhar a chave do baú.')}</p>`;
  if ($('#chaves').dataset.html !== html) { $('#chaves').dataset.html = html; $('#chaves').innerHTML = html; }
}
// baús das fortalezas: chegou do lado, abre (se o guardião foi vencido); senão avisa uma vez
const bausEsperando = new Map(), avisouBau = new Set();
let abrindoBau = false;
function verBaus(A) {
  const f = R.mundoLogico().fortalezas.find((q) => Math.hypot(A.x - (q.bau.x + 0.5), A.y - (q.bau.y + 1.4)) < 1.6);
  if (!f) { avisouBau.clear(); return; }
  if (abrindoBau || (bausEsperando.get(f.id) || 0) > Date.now()) return;
  const vazio = (cena.bausAbertos.get(f.bau.y * 1000 + f.bau.x) || 0) > Date.now();
  if (vazio || !Arena.temChave(A, f.id)) {
    if (!avisouBau.has(f.id)) {
      avisouBau.add(f.id);
      const txt = vazio ? t('O baú está vazio. Ele enche de novo em {min} min.', { min: Math.ceil((cena.bausAbertos.get(f.bau.y * 1000 + f.bau.x) - Date.now()) / 60000) })
        : t('O baú está trancado: vença o guardião da fortaleza ({nome}) e pegue a chave.', { nome: t(f.guardiao) });
      cena.texto(cena.darius, vazio ? t('Baú vazio') : t('Precisa da chave'), '#ffd84a', 1); log(txt, 'morte');
    }
    return;
  }
  abrirBau(f);
}
// o estado dos baús vem do servidor ao entrar em Runeterra (e a cada 30 s); as mudanças chegam pelo tempo real
let bausT = 0;
async function lerBaus() {
  try { const r = await rede.baus(); for (const b of r.baus) { const f = R.mundoLogico().fortalezas[b.id]; if (f) cena.bausAbertos.set(f.bau.y * 1000 + f.bau.x, Date.now() + (b.cheioEm - r.agora)); } } catch {}
}
async function abrirBau(f) {
  abrindoBau = true;
  const r = await operarServidor('/api/bau', { fortaleza: f.id });
  abrindoBau = false;
  bausEsperando.set(f.id, Date.now() + (r?.bau ? 60000 : 20000));
  if (!r?.bau) return;
  Arena.usarChave(combate.arena, f.id);
  minhasChaves = minhasChaves.filter((q) => q.fortaleza !== f.id); guardarChaves();
  cena.bausAbertos.set(f.bau.y * 1000 + f.bau.x, Date.now() + 10 * 60000);
  som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040');
  cena.texto(cena.darius, '+' + fmt(r.bau.ouro) + ' ' + t('ouro'), '#ffd84a', 1.3);
  const b = r.bau, partes = [t('{ouro} de ouro', { ouro: fmt(b.ouro) })];
  for (const [g, q] of Object.entries(b.gemas || {})) partes.push(`${q}× ${t(M.GEMAS[g].nome)}`);
  for (const [id, q] of Object.entries(b.espolios || {})) partes.push(`${q}× ${t(M.ESPOLIOS[id]?.nome || id)}`);
  for (const id of b.itens || []) partes.push(M.ITENS[id]?.nome || id);
  log(t('Você abriu o baú da fortaleza: {lista}!', { lista: partes.join(', ') }), 'raro');
  const lendario = (b.itens || []).find((id) => M.ITENS[id]?.lendario), epico = (b.itens || []).find((id) => M.ITENS[id]?.raridade === 'epico' || M.ITENS[id]?.epico);
  if (lendario) { cena.aviso(t('ITEM LENDÁRIO: {nome}!', { nome: M.ITENS[lendario].nome }), '#ff8a20'); cena.tremor = 0.4; cena.efeito('brilho', cena.darius, 2.2, '#ff8a20'); som.efeito('raro'); alertaLendario(M.ITENS[lendario].nome, imgItem(lendario)); }
  else if (epico) cena.aviso(t('Item épico: {nome}!', { nome: M.ITENS[epico].nome }), '#c070ff');
  if (b.perdidos?.length) log(t('A mochila estava cheia: {n} coisas do baú ficaram para trás.', { n: b.perdidos.length }), 'morte');
}
// viagem rápida para uma cidade já descoberta (de fora de Runeterra, entra direto na praça)
function viajarCidade(id) {
  const c = R.CIDADE[id];
  if (!c || combate.darius.morto > 0) return;
  if (!descobertas.has(id)) { avisar(t('Você ainda não conhece {cidade}. Chegue lá andando uma vez para poder viajar direto.', { cidade: c.nome }), { titulo: t('Cidade não descoberta') }); return; }
  if (!localAtual().arena) { comecarViagem(c.nome, TEMPO_VIAGEM.runeterra, () => { entradaCidade = id; irPara('arena'); }); return; }
  if (emCombateAqui()) { fecharJanelas(); avisoCombate(); return; }
  comecarViagem(c.nome, TEMPO_VIAGEM.cidade, () => chegarNaCidade(id));
}
function chegarNaCidade(id) {
  const c = R.CIDADE[id];
  if (!localAtual().arena || combate.darius.morto > 0) return;
  Arena.entrar(combate, cena.mapa.livre, R.chegadaCidade(id), infoMundo()); sincronizarChaves();
  tempoReal.enviar({ t: 'cidade', id });
  cena.efeito('poof', cena.darius, 0.6);
  fecharJanelas();
  log(t('Você viajou para {lugar}.', { lugar: c.nome }), 'chefe');
}

// música da região (ou a do chefe, enquanto houver um vivo)
const MUSICA_BIOMA = { base: 'fonte', rota: 'rota', selva: 'selva', rio: 'rio', barao: 'barao', arena: 'rota', abismo: 'chefe' };
function trilhaAtual() {
  if (dgVendo) return cena.chefeBarra && cena.tempo - cena.chefeBarra.t < 1 ? 'chefe' : 'selva';      // a dungeon (p670)
  if (combate.inimigos.some((i) => i.chefe && i.hp > 0 && !i.morto)) return 'chefe';
  if (localAtual().arena && cena.mapa?.mundo) return MUSICA_BIOMA[cena.biomaAqui()] || 'rota';
  return MUSICA_BIOMA[localAtual().bioma] || 'fonte';
}
// ----- Configurações (pedidos de jogadores): o volume e a coluna da direita (ordem dos blocos, o que mostrar, altura do chat) -----
const BLOCOS_LATERAL = { status: 'Cartão do jogador', local: 'Local (Mapa, Runeterra, Voltar)', abas: 'Abas (habilidades, atributos, itens…)', chat: 'Chat' };
const LAYOUT_PADRAO = { ordem: ['status', 'local', 'abas', 'chat'], semRedes: false, semGuilda: false, semLocal: false, chat: 0 };
let layout = { ...LAYOUT_PADRAO, ...lerLocal('lolidle-layout', {}) };
if (!Array.isArray(layout.ordem) || layout.ordem.length !== 4 || !LAYOUT_PADRAO.ordem.every((b) => layout.ordem.includes(b))) layout.ordem = [...LAYOUT_PADRAO.ordem];
function aplicarLayout() {
  const L = $('#lateral');
  layout.ordem.forEach((b, k) => L.style.setProperty('--ordem-' + b, k));
  L.classList.toggle('sem-redes', !!layout.semRedes); L.classList.toggle('sem-guilda', !!layout.semGuilda); L.classList.toggle('sem-local', !!layout.semLocal);
  L.classList.toggle('com-altura-chat', layout.chat > 0);
  if (layout.chat > 0) L.style.setProperty('--altura-chat', layout.chat + 'px'); else L.style.removeProperty('--altura-chat');
}
function guardarLayout() { gravarLocal('lolidle-layout', layout); aplicarLayout(); desenharConfig(); }
aplicarLayout();
function desenharConfig() {
  const s = som.estado(), pct = (v) => Math.round((v ?? 0) * 100);
  const deslizar = (qual, rot, v) => `<label class="cf-linha"><span>${rot}</span><input type="range" min="0" max="100" step="5" value="${v}" data-volume="${qual}"><b>${v}%</b></label>`;
  const marcar = (k, rot) => `<label class="cf-marca"><input type="checkbox" data-mostrar="${k}" ${layout[k] ? '' : 'checked'}> ${rot}</label>`;
  $('#config-corpo').innerHTML = `
    <div class="cf-secao">🔊 ${t('Som')}</div>
    ${deslizar('musica', t('Música'), s.musica ? pct(s.volMusica) : 0)}
    ${deslizar('efeitos', t('Efeitos'), s.efeitos ? pct(s.volEfeitos) : 0)}
    ${deslizar('alerta', t('Alerta de lendário'), pct(s.volAlerta ?? 0.9))}
    ${deslizar('privado', t('Mensagem privada'), pct(s.volPrivado ?? 0.7))}
    <div class="cf-secao">⌨ ${t('Teclas')}</div>
    <div class="cf-teclas">${teclas.hab.map((k, i) => `<label><span>${t('Habilidade {n} da barra', { n: i + 1 })}</span><button type="button" class="botao cf-tecla${teclaEsperando === 'hab' + i ? ' esperando' : ''}" data-tecla="hab${i}">${teclaEsperando === 'hab' + i ? t('Aperte uma tecla…') : nomeTecla(k)}</button></label>`).join('')}
      ${Object.entries(M.POCOES).map(([pk, p], i) => `<label><span>${t(p.nome)}</span><button type="button" class="botao cf-tecla${teclaEsperando === 'pocao' + i ? ' esperando' : ''}" data-tecla="pocao${i}">${teclaEsperando === 'pocao' + i ? t('Aperte uma tecla…') : nomeTecla(teclas.pocao[i])}</button></label>`).join('')}</div>
    ${teclaAviso ? `<p class="cf-aviso">${teclaAviso}</p>` : ''}
    <p class="fraco cf-dica">${t('As teclas da barra valem em Runeterra e na Arena (no Summoner\'s Rift o campeão usa as habilidades sozinho). Clique num botão e aperte a tecla nova; Esc cancela.')}</p>
    <button type="button" class="botao cf-padrao" data-teclas-padrao>${t('Voltar as teclas ao padrão')}</button>
    <div class="cf-secao">⚡ ${t('Desempenho')}</div>
    <div class="cf-desempenho" role="group">${[['auto', t('Automático')], ['normal', t('Normal')], ['leve', t('Leve')]].map(([k, n]) => `<button type="button" class="botao${desempenho === k ? ' ativo' : ''}" data-desempenho="${k}" aria-pressed="${desempenho === k}">${n}</button>`).join('')}</div>
    <p class="fraco cf-dica">${t('O modo leve deixa o jogo mais leve em celular e tablet: 30 quadros por segundo e menos enfeites (bichos, partículas e brilhos). No automático ele liga sozinho se o aparelho ficar lento.')}${modoLeve() ? ' <b class="cf-leve-on">' + t('Agora: modo leve ligado.') + '</b>' : ''}</p>
    <div class="cf-secao">▭ ${t('Barra de baixo')}</div>
    <div class="cf-desempenho cf-hudtam" role="group">${[['auto', t('Automático')], ['1', t('Normal')], ['0.85', t('Menor')], ['0.7', t('Mínima')]].map(([k, n]) => `<button type="button" class="botao${hudTam === k ? ' ativo' : ''}" data-hudtam="${k}" aria-pressed="${hudTam === k}">${n}</button>`).join('')}</div>
    <p class="fraco cf-dica">${t('O tamanho da barra das habilidades, da vida e das poções. No automático ela fica menor no celular deitado.')}</p>
    <div class="cf-secao">☰ ${t('Tamanho no celular')}</div>
    <div class="cf-desempenho cf-lattam" role="group">${[['auto', t('Automático')], ['1', t('Normal')], ['0.85', t('Menor')], ['0.7', t('Mínimo')]].map(([k, n]) => `<button type="button" class="botao${latTam === k ? ' ativo' : ''}" data-lattam="${k}" aria-pressed="${latTam === k}">${n}</button>`).join('')}</div>
    <p class="fraco cf-dica">${t('O tamanho do painel que abre no botão ☰ Painel, das janelas (como o mapa) e das dicas, com o celular ou o tablet deitado. No automático fica um pouco menor no celular.')}</p>
    <div class="cf-secao">▤ ${t('Coluna da direita')}</div>
    <p class="fraco cf-dica">${t('A ordem dos blocos, de cima para baixo:')}</p>
    <ol class="cf-ordem">${layout.ordem.map((b, k) => `<li><span>${t(BLOCOS_LATERAL[b])}</span>
      <button type="button" class="cf-mover" data-mover="${b}" data-dir="-1" ${k === 0 ? 'disabled' : ''} title="${t('Subir')}">▲</button>
      <button type="button" class="cf-mover" data-mover="${b}" data-dir="1" ${k === 3 ? 'disabled' : ''} title="${t('Descer')}">▼</button></li>`).join('')}</ol>
    ${marcar('semRedes', t('Mostrar os botões do Discord, da Twitch e da Kick'))}
    ${marcar('semGuilda', t('Mostrar a guilda e o bônus dela no cartão'))}
    ${marcar('semLocal', t('Mostrar o painel Local (as teclas M, B e J continuam valendo)'))}
    <label class="cf-linha"><span>${t('Altura do chat')}</span><input type="range" min="0" max="500" step="20" value="${layout.chat || 0}" data-chat><b>${layout.chat ? layout.chat + ' px' : t('padrão')}</b></label>
    <button type="button" class="botao cf-padrao" data-layout-padrao>${t('Voltar a coluna ao padrão')}</button>`;
}
function abrirConfig() { teclaEsperando = null; teclaAviso = ''; desenharConfig(); $('#janela-config').hidden = false; }
// trocar uma tecla (p723): o clique marca qual; a próxima tecla apertada vale (Esc cancela)
var teclaEsperando = null, teclaAviso = '';
function guardarTeclas() {
  gravarLocal('lolidle-teclas', teclas);
  TECLA_ESPACO = Object.fromEntries(teclas.hab.map((k, i) => [k, i])); ROTULO_ESPACO = teclas.hab.map(nomeTecla);
  document.querySelectorAll('#hud-pocoes .hud-pocao > span, #pocoes .tecla-pocao').forEach((s, i) => { s.textContent = nomeTecla(teclas.pocao[i % 5]); });
  barraDesenhada = ''; atualizarUI();
}
$('#config-corpo').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tecla]');
  if (b) { teclaEsperando = teclaEsperando === b.dataset.tecla ? null : b.dataset.tecla; teclaAviso = ''; desenharConfig(); return; }
  if (e.target.closest('[data-teclas-padrao]')) { teclas = structuredClone(TECLAS_PADRAO); teclaEsperando = null; teclaAviso = ''; guardarTeclas(); desenharConfig(); }
});
addEventListener('keydown', (e) => {
  if (!teclaEsperando || $('#janela-config').hidden) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const k = e.key.toLowerCase();
  if (k === 'escape') { teclaEsperando = null; teclaAviso = ''; desenharConfig(); return; }
  if (k in TECLAS_FIXAS || k.length > 1 && !/^f\d+$/.test(k)) { teclaAviso = TECLAS_FIXAS[k] ? t('A tecla {k} já é de {f}. Escolha outra.', { k: nomeTecla(k), f: t(TECLAS_FIXAS[k]) }) : t('Essa tecla não dá para usar. Escolha uma letra, um número ou F1 a F12.'); desenharConfig(); return; }
  const [grupo, i] = [teclaEsperando.replace(/\d+$/, ''), +teclaEsperando.match(/\d+$/)[0]];
  // se a tecla já é de outra habilidade ou poção, as duas trocam
  for (const g of ['hab', 'pocao']) { const j = teclas[g].indexOf(k); if (j >= 0 && !(g === grupo && j === i)) teclas[g][j] = teclas[grupo][i]; }
  teclas[grupo][i] = k; teclaEsperando = null; teclaAviso = ''; guardarTeclas(); desenharConfig();
}, true);
$('#bt-config').addEventListener('click', (e) => { e.currentTarget.blur(); abrirConfig(); });
$('#config-corpo').addEventListener('input', (e) => {
  const v = e.target.closest('[data-volume]');
  if (v) {
    som.definirVolume(v.dataset.volume, v.value / 100); v.nextElementSibling.textContent = v.value + '%';
    $('#bt-musica').setAttribute('aria-pressed', som.estado().musica); $('#bt-efeitos').setAttribute('aria-pressed', som.estado().efeitos);
    return;
  }
  if (e.target.matches('[data-chat]')) { const n = Number(e.target.value); layout.chat = n >= 100 ? n : 0; gravarLocal('lolidle-layout', layout); aplicarLayout(); e.target.nextElementSibling.textContent = layout.chat ? layout.chat + ' px' : t('padrão'); }
});
$('#config-corpo').addEventListener('change', (e) => { const m = e.target.closest('[data-mostrar]'); if (m) { layout[m.dataset.mostrar] = !m.checked; guardarLayout(); } });
$('#config-corpo').addEventListener('click', (e) => {
  const m = e.target.closest('[data-mover]');
  if (m) { const o = layout.ordem, i = o.indexOf(m.dataset.mover), j = i + Number(m.dataset.dir); if (j >= 0 && j < o.length) { [o[i], o[j]] = [o[j], o[i]]; guardarLayout(); } return; }
  if (e.target.closest('[data-layout-padrao]')) { layout = { ...LAYOUT_PADRAO, ordem: [...LAYOUT_PADRAO.ordem] }; guardarLayout(); }
  const ht = e.target.closest('[data-hudtam]');
  if (ht) { hudTam = ht.dataset.hudtam; gravarLocal('lolidle-hud-tam', hudTam); aplicarHudTam(); desenharConfig(); return; }
  const lt = e.target.closest('[data-lattam]');
  if (lt) { latTam = lt.dataset.lattam; gravarLocal('lolidle-lat-tam', latTam); aplicarLatTam(); desenharConfig(); return; }
  const dp = e.target.closest('[data-desempenho]');
  if (dp) {
    desempenho = dp.dataset.desempenho; gravarLocal('lolidle-desempenho', desempenho);
    if (desempenho !== 'auto') { leveAuto = false; gravarLocal('lolidle-leve-auto', false); }
    medRuins = 0; medIni = 0; aplicarDesempenho(); desenharConfig();
  }
});
for (const [id, qual] of [['#bt-musica', 'musica'], ['#bt-efeitos', 'efeitos']]) {
  const b = $(id);
  b.setAttribute('aria-pressed', som.estado()[qual]);
  b.addEventListener('click', () => { b.setAttribute('aria-pressed', som.alternar(qual)); b.blur(); });
}

// ---------- grupo (party) em Runeterra ----------
let grupoAtual = null, conviteGrupoT = 0;
const escG = (x) => String(x ?? '').replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]);
const enviarGrupo = (acao, dados = {}) => tempoReal.enviar({ t: 'grupo', acao, ...dados });
// quadro do grupo na tela: membros, vida, quem está perto e o bônus de XP de agora
function mostrarGrupo(g) {
  grupoAtual = g || null;
  const box = $('#grupo-hud');
  box.hidden = !g;
  if (g) {
    const pct = Math.round((g.bonus - 1) * 100);
    const html = `<header>${t('Grupo')}<b class="${pct ? 'on' : ''}">${pct ? t('+{n}% XP', { n: pct }) : t('ninguém perto')}</b></header>`
      + g.membros.map((m) => `<div class="gm${m.eu ? ' eu' : ''}${m.perto ? ' perto' : ''}${m.on ? '' : ' fora'}"><img src="${miniatura(spriteCampeao(m.c, m.s))}" alt=""><span>${m.lider ? '♛ ' : ''}${escG(m.n)}<small>${m.on ? t('nível {n}', { n: m.nv }) : t('fora de Runeterra')}</small><i><em style="width:${Math.round(m.v * 100)}%"></em></i></span></div>`).join('');
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }
  if (!$('#grupo-painel').hidden) desenharPainelGrupo();
}
// XP dividida: um companheiro do grupo, perto, abateu um monstro dele (o servidor manda a sua parte)
let xpGrupoSoma = 0, xpGrupoLog = 0;
function ganharXpGrupo(m) {
  const xp = Math.max(0, Number(m.xp) || 0);
  if (!xp || !localAtual().arena) return;
  M.ganharXp(estado, combate, xp);
  xpGrupoSoma += xp;
  if (Date.now() - xpGrupoLog > 30000) { xpGrupoLog = Date.now(); log(t('Grupo: +{xp} de experiência dos abates dos seus companheiros.', { xp: fmt(xpGrupoSoma) }), 'npc'); xpGrupoSoma = 0; }
}
// ---------- Caveira (PvP): quem mata um jogador que não o atacou fica marcado (as regras ficam no servidor/pvp.js) ----------
let caveiraMs = 0, caveiraEm = 0;
const caveiraResta = () => Math.max(0, caveiraMs - (performance.now() - caveiraEm));
function aplicarCaveira(ms) { caveiraMs = Math.max(0, Number(ms) || 0); caveiraEm = performance.now(); caveiraNaTela(); }
// com a Vermelha ativa a Caveira de 10 min não barra cidade nem viagem e não aparece (p582)
function caveiraNaTela() { const so = caveiraMs > 0 && !(vermelhaResta() > 0); if (combate.arena) combate.arena.caveira = so; cena.minhaCaveira = so; }
// Caveira Vermelha (12/10/2026): frags acima do limite; o servidor conta e manda o tempo que falta e os frags de hoje, da semana e do mês
let vermelhaMs = 0, vermelhaEm = 0, fragsAgora = [0, 0, 0], fragsSomem = [];      // fragsSomem: ms até cada frag sumir (desde vermelhaEm)
const horasRegra = (ms) => Math.round(ms / 3600e3);
const proximoFragSome = () => { const r = fragsSomem.map((ms) => ms - (performance.now() - vermelhaEm)).filter((ms) => ms > 0); return r.length ? Math.min(...r) : 0; };
const fragsAtivos = () => fragsSomem.filter((ms) => ms - (performance.now() - vermelhaEm) > 0).length;
const vermelhaResta = () => Math.max(0, vermelhaMs - (performance.now() - vermelhaEm));
const tempoLongo = (s) => (s >= 86400 ? t('{d} d {h} h', { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) }) : tempoTexto(s));
function aplicarVermelha(m) {
  const antes = vermelhaResta() > 0;
  vermelhaMs = Math.max(0, Number(m.vermelha) || 0); vermelhaEm = performance.now();
  fragsAgora = Array.isArray(m.frags) ? m.frags : [0];      // o estado sem frags quer dizer que não há nenhum na janela
  fragsSomem = Array.isArray(m.fs) ? m.fs.filter((x) => Number.isFinite(x)) : [];
  cena.minhaVermelha = vermelhaMs > 0;          // a caveira escorrendo sangue em cima do seu campeão
  caveiraNaTela();
  if (antes && !vermelhaMs && m.vermelha != null) { cena.aviso(t('A Caveira Vermelha acabou'), '#8ad88a'); log(t('A sua Caveira Vermelha acabou.'), 'npc'); }
}
const textoFrags = () => t('Frags nas últimas {h} h: {d}/{n}', { h: horasRegra(M.CAVEIRA_VERMELHA.limites[0].ms), d: fragsAgora[0] || 0, n: M.CAVEIRA_VERMELHA.limites[0].n });
function avisoFrag(m) {
  aplicarVermelha(m);
  log(t('Frag por {nome}. {frags}. Com {n} frags em {h} horas você ganha a Caveira Vermelha por {d} horas.', { nome: m.vitima, frags: textoFrags(), n: M.CAVEIRA_VERMELHA.limites[0].n, h: horasRegra(M.CAVEIRA_VERMELHA.limites[0].ms), d: horasRegra(M.CAVEIRA_VERMELHA.limites[0].dura) }), 'morte');
  if (m.nova) {
    cena.aviso(t('☠ CAVEIRA VERMELHA!'), '#ff2020'); som.efeito('alerta');
    log(t('☠ Você ganhou a Caveira Vermelha por 14 horas: qualquer um pode te atacar fora das cidades, matar você não conta como frag e, se você morrer em Runeterra, cai metade dos seus itens (equipados e mochila; a Bênção não segura). Falta {tempo}; matar mais alguém sem motivo renova as 14 horas.', { tempo: tempoLongo(Math.ceil(vermelhaResta() / 1000)) }), 'morte');
  }
}
function avisoCaveira(m) {
  aplicarCaveira(m.resta);
  if (m.vitima && m.ajudou) {
    cena.aviso(t('☠ Caveira! Você ajudou a matar {nome}', { nome: m.vitima }), '#ffa040'); som.efeito('alerta');
    log(t('☠ Você ganhou a Caveira por ajudar a matar {nome}, que não te atacou: por {min} min você não entra em cidades nem sai de Runeterra, e qualquer um pode te atacar.', { nome: m.vitima, min: Math.ceil(m.resta / 60000) }), 'morte');
  } else if (m.vitima) {
    cena.aviso(t('☠ Caveira! Você matou {nome}', { nome: m.vitima }), '#ff4a4a'); som.efeito('alerta');
    log(t('☠ Você ganhou a Caveira por matar {nome}, que não te atacou: por {min} min você não entra em cidades nem sai de Runeterra, e qualquer um pode te atacar. O tempo só passa fora das cidades.', { nome: m.vitima, min: Math.ceil(m.resta / 60000) }), 'morte');
  } else if (m.fim === 'morreu') log(t('Você foi caçado e a sua Caveira acabou.'), 'npc');
  else if (m.fim === 'tempo') { cena.aviso(t('A Caveira acabou'), '#8ad88a'); log(t('A sua Caveira acabou. Você já pode voltar às cidades.'), 'npc'); }
}
function bloqueioCaveira() {
  if (!localAtual().arena || caveiraResta() <= 0 || vermelhaResta() > 0) return false;
  cena.aviso(t('☠ Com Caveira você não entra em cidades nem sai de Runeterra ({tempo})', { tempo: tempoTexto(Math.ceil(caveiraResta() / 1000)) }), '#ff4a4a');
  return true;
}
const entrarSozinhoGuilda = () => { try { return localStorage.getItem('lolidle-grupo-guilda') !== '0'; } catch { return true; } };
// painel do botão Grupo: convidar (pelo nome ou os jogadores perto, ou a guilda inteira), tirar alguém e sair
function desenharPainelGrupo() {
  const g = grupoAtual, souLider = !g || g.membros.find((m) => m.eu)?.lider;
  const nomesNoGrupo = new Set((g?.membros || []).map((m) => m.n));
  const perto = !combate.arena ? [] : cena.posicoesArena().filter((o) => !o.morto && !nomesNoGrupo.has(o.nome) && Math.hypot(o.x - combate.arena.x, o.y - combate.arena.y) < M.GRUPO.raio).slice(0, 6);      // fora de Runeterra não há estado de lá (p720)
  const cheio = g && g.membros.length >= M.GRUPO.max;
  const html = `<p class="gp-dica">${t('Cacem juntos: cada membro a até {r} quadrados de você dá +{p}% de experiência, e você ganha uma parte da experiência dos monstros que eles abatem (metade numa dupla). Membros do mesmo grupo não se atacam.', { r: M.GRUPO.raio, p: Math.round(M.GRUPO.porMembro * 100) })}</p>
    ${g ? `<div class="rotulo">${t('Membros ({n}/{max})', { n: g.membros.length, max: M.GRUPO.max })}</div><div class="gp-lista">${g.membros.map((m) => `<div class="gp-m"><span>${m.lider ? '♛ ' : ''}${escG(m.n)}${m.eu ? ' ' + t('(você)') : ''}</span>${souLider && !m.eu ? `<button type="button" class="botao" data-tirar="${escG(m.n)}">${t('Tirar')}</button>` : ''}</div>`).join('')}</div>` : ''}
    ${souLider && !cheio ? `<div class="rotulo">${t('Convidar')}</div>
      ${perto.length ? `<div class="gp-perto">${perto.map((o) => `<button type="button" class="botao" data-convidar="${escG(o.nome)}">+ ${escG(o.nome)} <small>nv ${o.nivel}</small></button>`).join('')}</div>` : `<p class="gp-dica">${t('Ninguém perto agora. Convide pelo nome:')}</p>`}
      <div class="gp-nome"><input id="gp-nome" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${t('nome do personagem')}"><button type="button" class="botao" id="gp-convidar">${t('Convidar')}</button></div>` : ''}
    ${cena.minhaGuilda && souLider && !cheio ? `<button type="button" class="botao gp-guilda" id="gp-guilda">🛡 ${t('Chamar a guilda')}</button>` : ''}
    ${cena.minhaGuilda ? `<label class="gp-auto"><input type="checkbox" id="gp-auto-guilda" ${entrarSozinhoGuilda() ? 'checked' : ''}> ${t('Entrar sozinho quando a guilda chamar')}</label>` : ''}
    ${g ? `<button type="button" class="botao gp-sair" id="gp-sair">${t('Sair do grupo')}</button>` : ''}`;
  const caixa = $('#grupo-conteudo');
  if (caixa.dataset.html !== html && !caixa.contains(document.activeElement)) { caixa.dataset.html = html; caixa.innerHTML = html; }
}
function mostrarConviteGrupo(de) {
  const box = $('#grupo-convite');
  box.innerHTML = `<span>${t('{nome} chamou você para o grupo (+XP caçando junto).', { nome: escG(de) })}</span><button type="button" class="botao" data-grupo="aceitar">${t('Aceitar')}</button><button type="button" class="botao" data-grupo="recusar">${t('Recusar')}</button>`;
  box.hidden = false; som.efeito('mensagem');
  clearTimeout(conviteGrupoT); conviteGrupoT = setTimeout(() => { box.hidden = true; }, 60000);
}
$('#grupo-painel').addEventListener('change', (e) => { if (e.target.id === 'gp-auto-guilda') { try { localStorage.setItem('lolidle-grupo-guilda', e.target.checked ? '1' : '0'); } catch {} desenharPainelGrupo(); } });
$('#grupo-convite').addEventListener('click', (e) => { const b = e.target.closest('[data-grupo]'); if (!b) return; enviarGrupo(b.dataset.grupo); $('#grupo-convite').hidden = true; });
$('#bt-grupo').addEventListener('click', (e) => { const p = $('#grupo-painel'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', !p.hidden); e.currentTarget.blur(); if (!p.hidden) desenharPainelGrupo(); });
$('#grupo-painel').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.convidar) enviarGrupo('convidar', { nome: b.dataset.convidar });
  else if (b.dataset.tirar) enviarGrupo('expulsar', { nome: b.dataset.tirar });
  else if (b.id === 'gp-convidar') { const n = $('#gp-nome').value.trim(); if (n) { enviarGrupo('convidar', { nome: n }); $('#gp-nome').value = ''; } }
  else if (b.id === 'gp-guilda') enviarGrupo('guilda');
  else if (b.id === 'gp-sair') enviarGrupo('sair');
  b.blur();
});

// ---------- Runeterra em tempo real: outros jogadores e PvP ----------
// ---------- Vilemaw (chefe global, js/chefe-global.js): o servidor manda o estado, os golpes e o fim da luta ----------
let vmVista = false, vmFraco = false;
const pertoDaVilemaw = () => { const A = combate.arena; return !!(A?.vm?.ativo && Math.hypot(A.x - A.vm.x, A.y - A.vm.y) < 24); };
let vmInfo = null;          // o estado público da Vilemaw (ativa, região, até quando, próxima), para o quadro de missões
function vilemawMsg(m) {
  const A = combate.arena;
  if (m.ev === 'estado') vmInfo = { ativo: !!m.ativo, zona: m.zona, fim: m.fim, proximo: m.proximo };
  else if (m.ev === 'morreu' || m.ev === 'foi') vmInfo = { ativo: false };
  if (m.ev === 'estado') {
    const perto = m.ativo && m.x != null;            // longe, o servidor manda só a região (os jogadores procuram)
    cena.chefeGlobal(perto ? m : { ativo: false });
    if (perto && m.fraco > 0 && !vmFraco) som.efeito('raro');      // o ponto fraco abriu
    vmFraco = !!(perto && m.fraco > 0);
    if (A) A.vm = perto ? { ativo: true, x: m.x, y: m.y, raio: m.raio } : null;
    if (perto && !vmVista) { vmVista = true; Arena.limparCovil(combate); log(t('Você achou a Vilemaw! Lute com ela: quem ajudar a vencer ganha o Baú da Vilemaw.'), 'raro'); cena.aviso(t('Você achou a Vilemaw!'), '#7affe8'); som.efeito('alarme'); }
    if (!m.ativo) vmVista = false;
    if (m.nasceu) { log(t('A Vilemaw despertou em algum lugar de {zona}! Procure por ela.', { zona: t(R.NOME_ZONA[m.zona] || m.zona) }), 'raro'); if (!perto) cena.aviso(t('A Vilemaw despertou!'), '#7affe8'); som.efeito('alarme'); }
  } else if (m.ev === 'golpe') {
    const g = { ...m, t: m.dur ?? 1.5 };          // o tempo da marca vem em `dur`
    Arena.golpeVilemaw(combate, g); cena.avisoVilemaw(g);
  } else if (m.ev === 'morreu') {
    cena.chefeGlobal({ ativo: false, morreu: true }); if (A) A.vm = null;
    log(t('{nome} deu o golpe final na Vilemaw!', { nome: m.por }), 'raro'); som.efeito('fanfarra');
    if (m.top?.length) log(t('Quem mais bateu: {lista}', { lista: m.top.map((x, k) => `${k + 1}. ${x.nome} (${x.pct}%)`).join(' · ') }), 'raro');
    if (m.premiados?.includes(NOME)) abrirBauVilemaw();
    else log(t('Você não ajudou o bastante desta vez: o baú é de quem tirou pelo menos 1% da vida dela.'), 'npc');
  } else if (m.ev === 'foi') { cena.chefeGlobal({ ativo: false }); if (A) A.vm = null; log(t('A Vilemaw voltou para a teia.'), 'npc'); }
}
// ganhou a Aranhinha (Baú da Vilemaw ou 30 dias de prêmio diário): ela já vem acompanhando, e a conta toda recebe
function ganhouAranha(motivo) {
  if (!estado.mascote) { M.escolherMascote(estado, 'aranha'); cena.definirMascote(M.spriteMascote(estado)); }
  som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.8, '#8afff0');
  avisoSaque({ img: miniatura('Aranhinha'), nome: t('Aranhinha'), cor: '#8afff0', tipo: t('Mascote novo!') });
  log(t('Você ganhou a Aranhinha, o filhote da Vilemaw! {motivo} Ela fica na aba Coleção, em Mascotes, e vale para todos os seus personagens.', { motivo }), 'raro');
  atualizarUI();
}
// o Baú da Vilemaw: quem ajudou a vencer abre (o servidor sorteia e entrega); se não deu na hora, abre ao entrar no jogo
let abrindoBauVm = false;
async function abrirBauVilemaw() {
  if (abrindoBauVm) return;
  abrindoBauVm = true;
  try {
    const r = await operarServidor('/api/vilemaw/bau'), b = r?.vilemaw;
    if (!b) return;
    estado.totais.vilemaw = b.vencidas;
    const runas = Object.values(b.gemas || {}).reduce((s2, q) => s2 + q, 0), itens = (b.itens || []).map((id) => descreverItem(id).nome).join(', ') || t('nenhum item');
    som.efeito('fanfarra'); cena.efeito('brilho', cena.darius, 1.6, '#7affe8');
    const txt = t('Baú da Vilemaw: +{ouro} de ouro, +{xp} de experiência, {runas} runas, espólios dela e {itens}.', { ouro: fmt(b.ouro), xp: fmt(b.xp), runas, itens });
    log(txt, 'raro');
    { const lend = (b.itens || []).find((id) => M.ITENS[M.baseId(id)]?.lendario); if (lend) alertaLendario(M.ITENS[M.baseId(lend)].nome, imgItem(lend)); }
    if (b.mascote) ganhouAranha(t('Ela estava no Baú da Vilemaw!'));
    avisar(txt + (b.top ? '\n\n' + t('Você está entre os 3 que mais bateram: mais runas e o dobro de chance de lendário!') : ''), { titulo: t('Baú da Vilemaw') });
    atualizarUI();
  } finally { abrindoBauVm = false; }
}
let difNivelPvp = 7, envioT = 0;
const avisouAtaque = new Map();
const tempoReal = criarConexao({ aoMsg: msgTempoReal });
function msgTempoReal(m) {
  if (!naArena()) return;
  switch (m.t) {
    case 'ok': difNivelPvp = m.difNivel || 7; break;
    case 'caveira': avisoCaveira(m); break;
    case 'frag': avisoFrag(m); break;
    case 'estado': aplicarCaveira(m.caveira); aplicarVermelha(m); cena.meuGrupo = m.grupo?.id || 0; if (combate.arena) combate.arena.bonusGrupo = m.grupo?.bonus || 1; cena.redeArena(m.jogadores, estado.nivel, difNivelPvp, !!(combate.arena && R.zonaPkEm(combate.arena.x, combate.arena.y)?.semCap)); mostrarGrupo(m.grupo); break;
    case 'grupoConvite':       // da mesma guilda e sem grupo: entra sozinho (se a opção do painel do Grupo estiver ligada)
      if (m.guilda && !grupoAtual && entrarSozinhoGuilda()) { enviarGrupo('aceitar'); log(t('{nome}, da sua guilda, chamou você para o grupo e você entrou (dá para desligar no botão Grupo).', { nome: m.de }), 'npc'); }
      else mostrarConviteGrupo(m.de);
      break;
    case 'grupoAviso': log(t(m.pt, m.v), 'npc'); break;
    case 'lance': cena.lanceDeOutro(m); break;
    case 'saco': cena.sacos.set(m.saco.id, m.saco); break;
    case 'sacoFim': cena.sacos.delete(m.id); break;
    case 'sacoPego': log(t('{nome} pegou {n} itens do seu saco!', { nome: m.por, n: m.n }), 'morte'); cena.aviso(t('{nome} pegou itens do seu saco!', { nome: m.por }), '#ff6040'); break;
    case 'vento': cena.ventoPvp(m); break;
    case 'dano':
      M.danoPvp(estado, combate, m.valor, m.de);
      Arena.derrubar(combate);
      Arena.efeitoPvp(combate, m);
      if (Date.now() - (avisouAtaque.get(m.de) || 0) > 15000) { avisouAtaque.set(m.de, Date.now()); log(t('{nome} está atacando você!', { nome: m.de }), 'morte'); cena.aviso(t('{nome} está atacando você!', { nome: m.de }), '#ff5050'); }
      break;
    case 'danoMonstro': {        // outro jogador acertou um monstro seu
      const i = combate.inimigos.find((x) => x.id === m.id && x.hp > 0 && !x.morto);
      if (i) { i.hp -= m.valor; i.aggro = true; i.golpeOutro = { de: m.de, grupo: !!m.grupo }; cena.danoDeOutro(i.id, m.valor); }
      break;
    }
    case 'meuDanoMonstro': cena.danoEmMonstroOutro(m.chave, m.valor, !!m.fraco, !!m.queima); if (m.tecla && !m.queima) M.aoAcertarJogador(estado, combate, m.tecla, m.valor); break;      // roubo de vida e Sede de Sangue (p635)
    case 'vm': vilemawMsg(m); break;
    case 'xpGrupo': ganharXpGrupo(m); break;
    case 'abateDeOutro': {       // você deu o último golpe no monstro de outro jogador: o abate é seu
      const A = combate.arena;
      const mon = M.criarMonstro(m.nome, m.nv || estado.nivel, { x: m.x, y: m.y, hp: 0, chegada: 0, zona: A?.mundo ? A.mundo.zonaEm(m.x, m.y) : undefined });
      combate.inimigos.push(mon);
      log(t('Último golpe! O abate de {monstro} de {dono} é seu.', { monstro: t(m.nome), dono: m.de }), 'raro');
      break;
    }
    case 'danoVisto': cena.danoEmJogador(m.alvo, m.valor, m.tipo); break;
    case 'escudo': {       // a Lux do grupo protegeu você com a Barreira Prismática
      const d = combate.darius, v = Math.max(0, Number(m.valor) || 0);
      d.escudo = Math.min(Math.max(2 * v, d.escudo || 0), (d.escudo || 0) + v);
      cena.escudoRecebido(v);
      if (Date.now() - (avisouAtaque.get('escudo:' + m.de) || 0) > 20000) { avisouAtaque.set('escudo:' + m.de, Date.now()); log(t('{nome} protegeu você com a Barreira Prismática.', { nome: m.de }), 'item'); }
      break;
    }
    case 'apoio': {        // o Taric do grupo curou, protegeu ou deixou você invulnerável
      const d = combate.darius, a = M.atributos(estado), v = Math.max(0, Number(m.valor) || 0);
      if (m.tipo === 'cura' || m.tipo === 'supernova') {
        const antes = estado.vida; estado.vida = Math.min(a.vida, estado.vida + v);
        if (estado.vida - antes > 1) combate.eventos.push({ tipo: 'cura', t: combate.tempo, valor: estado.vida - antes });
      } else if (m.tipo === 'escudo' || m.tipo === 'egide') { d.escudo = Math.max(d.escudo || 0, v); cena.escudoRecebido(v); }
      else if (m.tipo === 'constelacao') { d.estandarte = Math.max(d.estandarte || 0, Number(m.duracao) || 10); d.estandarteCura = Math.min(0.05, v); d.farolMana = 0.03; }
      else if (m.tipo === 'resplendor') { d.invulneravel = Math.max(d.invulneravel || 0, Math.min(3, v)); cena.aviso(t('Resplendor Cósmico: invulnerável!'), '#ffe27a'); cena.resplendorRecebido(Math.min(3, v)); }
      const TXT = { cura: '{nome} curou você com o Fulgor Estelar.', supernova: '{nome} curou você com a Supernova.', escudo: '{nome} protegeu você com o Bastião.', egide: '{nome} protegeu você com a Égide Cristalina.', constelacao: '{nome} acendeu a Constelação em você: vida e mana voltando.', resplendor: '{nome} deixou você invulnerável com o Resplendor Cósmico.' };
      if (TXT[m.tipo] && Date.now() - (avisouAtaque.get('apoio:' + m.tipo + m.de) || 0) > 20000) { avisouAtaque.set('apoio:' + m.tipo + m.de, Date.now()); log(t(TXT[m.tipo], { nome: m.de }), 'item'); }
      break;
    }
    case 'morte': M.morrerPvp(estado, combate, m.por); break;
    case 'anjo': if (m.nome) cena.aviso?.(t('{nome} voltou com o Anjo Guardião!', { nome: m.nome }), '#ffe08a'); else M.anjoPvp(estado, combate); break;      // p608
    // Zac: a Divisão Celular que o servidor decidiu (sem nome: a minha; com nome: de outro jogador, só para a tela)
    case 'divisao': if (m.nome) cena.divisaoOutro?.(m.nome, m.espera); else M.divisaoPvp(estado, combate, m.espera); break;
    case 'reuniu': if (m.nome) cena.reuniuOutro?.(m.nome); else if (combate.darius.dividido > 0) combate.darius.dividido = Math.min(combate.darius.dividido, 0.01); break;
    case 'abatePvp':
      estado.totais.abatesPvp = (estado.totais.abatesPvp || 0) + 1;
      log(t('Você derrotou {nome}!', { nome: m.alvo }), 'chefe'); cena.aviso(t('Você derrotou {nome}!', { nome: m.alvo }), '#ff5050');
      if (combate.arena?.alvoPvp === m.alvo) combate.arena.alvoPvp = null;
      break;
    case 'caiu': cena.jogadorCaiu(m.nome); if (m.nome !== NOME && m.por !== NOME) log(t('{nome} foi derrotado por {por}.', { nome: m.nome, por: m.por }), 'npc'); break;
    case 'corrigir': Arena.corrigirPosicao(combate, m.x, m.y); break;
    case 'arena': arenaMsg(m); break;          // a partida da Arena (rodadas, placar, fim)
    case 'arenaChamado': consultarArena(); break;
    case 'acertou': M.aoAcertarJogador(estado, combate, m.tecla, m.valor); break;      // o servidor confirmou o golpe: roubo de vida e curas
    case 'forcaNoxiana': combate.darius.poder = 5; combate.eventos.push({ tipo: 'poder' }); break;      // 5 acúmulos de Hemorragia num jogador
    case 'bau': {          // alguém abriu um baú de fortaleza, ou um baú encheu de novo
      const f = R.mundoLogico().fortalezas[m.id]; if (!f) break;
      cena.bausAbertos.set(f.bau.y * 1000 + f.bau.x, m.cheioEm ? Date.now() + Math.max(0, m.cheioEm - Date.now()) : 0);
      if (!m.cheioEm) cena.aviso(t('Os baús resetaram: o baú da fortaleza ({zona}) encheu de novo!', { zona: t(R.NOME_ZONA[f.zona]) }), '#ffd84a');
      else if (m.quem !== NOME) cena.aviso(t('{nome} abriu o baú da fortaleza ({zona})!', { nome: m.quem, zona: t(R.NOME_ZONA[f.zona]) }), '#ffd84a');
      avisouBau.clear();
      break;
    }
  }
}
// ~10x por segundo: onde estou, minha vida e meus monstros (os outros veem tudo isso)
function enviarTempoReal(dt) {
  if (!naArena()) { tempoReal.desligar(); cena.darius.montaria = null; cena.montandoT = 0; return; }
  tempoReal.ligar();
  const A = combate.arena;
  cena.darius.montaria = A.montado ? M.spriteMontaria(estado) : null;
  cena.montandoT = A.montando > 0 ? 1 - A.montando / M.MONTARIA.montar : 0;
  A.outros = cena.posicoesArena();
  A.monsOutros = cena.monstrosDeOutros();
  A.paredesOutros = cena.paredesDeOutros();
  cena.alvoPvp = A.alvoPvp;
  if ((envioT += dt) < 0.1) return;
  envioT = 0;
  const olhar = A.olhar || A.dir;
  tempoReal.enviar({ t: 'pos', tj: +(estado.tempoJogo || 0).toFixed(2), x: +A.x.toFixed(2), y: +A.y.toFixed(2), dx: +olhar.x.toFixed(2), dy: +olhar.y.toFixed(2), anda: !!A.andando, atk: cena.darius.atk > 0,
    vida: Math.max(0, Math.round(estado.vida)), skin: estado.skin || 0, pvp: !!A.pvp, ...(M.kit(estado).fluxo && estado.mana >= M.FLUXO_MAX - 0.01 ? { fl: 1 } : {}), parado: !!A.pausado, morto: combate.darius.morto > 0, mt: A.montado ? M.montariaDe(estado).skin || 'b' : '',
    // em Runeterra cada um tem os próprios monstros nos mesmos pontos: os outros só veem os que estão lutando com você
    // o guardião da fortaleza é de cada um (11/10/2026): não vai para os outros jogadores
    mons: combate.inimigos.filter((i) => i.hp > 0 && !i.morto && i.guardiao == null && (!i.casa || i.aggro)).slice(0, 6)
      .map((i) => ({ i: i.id, n: i.nome, nv: i.nivel, x: +i.x.toFixed(2), y: +i.y.toFixed(2), v: +(i.hp / i.hpMax).toFixed(2), ...(i.guardiao != null ? { g: 1 } : {}), ...(i.noAr > 0 ? { ar: 1 } : {}), ...(i.atordoado > 0 ? { at: 1 } : {}) })),      // no ar e atordoado: os outros veem (p645)
    // Katarina: as adagas que já caíram no chão (os outros jogadores veem onde vai ser o giro)
    ...(A.adagas?.length ? { ad: A.adagas.filter((d) => d.cai <= A.tempo).slice(0, 6).map((d) => [+d.x.toFixed(2), +d.y.toFixed(2)]) } : {}),
    // Zac: as gosmas que já caíram (os outros jogadores veem)
    ...(A.gosmas?.length ? { gz: A.gosmas.filter((g) => g.cai <= A.tempo).slice(0, 8).map((g) => ({ x: g.x, y: g.y })) } : {}) });
}
function alternarPvp() {
  const A = combate.arena;
  if (naAram()) return;          // na Arena o PK é sempre ligado
  if (A.zonaPk) { cena.aviso(t('Zona de Guerra: o PK não desliga aqui'), '#ff5050'); log(t('Na {zona} o PK fica ligado. Saia da zona para voltar ao modo seguro.', { zona: t(A.zonaPk.nome) }), 'morte'); return; }
  A.pvp = !A.pvp;
  if (!A.pvp) { A.alvoPvp = null; if (A.alvoAtaque?.tipo === 'jogador') A.alvoAtaque = null; }
  log(A.pvp ? t('PvP ligado: suas habilidades acertam outros jogadores (até {dif} níveis de diferença). Clique num jogador para atacá-lo.', { dif: difNivelPvp }) : t('Modo seguro: seus golpes não acertam jogadores.'), A.pvp ? 'morte' : 'npc');
  cena.aviso(A.pvp ? t('PK ligado') : t('Modo seguro'), A.pvp ? '#ff5050' : '#8ad8ff');
  atualizarUI();
}
$('#bt-pk').addEventListener('click', (e) => { if (naArena()) alternarPvp(); e.currentTarget.blur(); });
$('#hud-pontos').addEventListener('click', (e) => {
  abrirAba(estado.pontos > 0 ? 'habilidades' : 'atributos'); dicaDeToque('habilidades'); e.currentTarget.blur();
  // celular deitado: a aba fica na gaveta (abre); em pé, embaixo do jogo (rola até ela)
  if (document.body.classList.contains('gaveta')) { abrirGaveta(true); setTimeout(() => $('#direita').scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); }
  else if (!$('#direita').getBoundingClientRect().width || $('#direita').getBoundingClientRect().top > innerHeight - 80) $('#direita').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
$('#bt-montaria').addEventListener('click', (e) => { if (naArena() && !naAram()) Arena.alternarMontaria(combate, estado); e.currentTarget.blur(); });
cena.zoomMini = ZOOM_MINI.includes(Number(lerLocal('lolidle-mini-zoom', 1))) ? Number(lerLocal('lolidle-mini-zoom', 1)) : 1; zoomMinimapa(0);
$('#mini-zoom').addEventListener('click', (e) => { const b = e.target.closest('[data-mini]'); if (b) zoomMinimapa(b.dataset.mini === '+' ? 1 : -1); });
$('#tela').addEventListener('wheel', (e) => {
  const r = cena.miniRet; if (!r || !localAtual().arena) return;
  const b = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - b.left) / b.width) * VIS_L * T, y = ((e.clientY - b.top) / b.height) * VIS_A * T;
  if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return;
  e.preventDefault(); zoomMinimapa(e.deltaY < 0 ? 1 : -1);
}, { passive: false });
// botão da montaria (embaixo do minimapa) e o quadro dela na aba do mascote
let montariaDesenhada = '';
function atualizarMontaria() {
  const m = M.montariaDe(estado), max = m.nivel >= M.MONTARIA.max, montado = !!combate.arena?.montado, nm = t(M.nomeMontaria(estado));
  const vel = Math.round(M.velMontaria(estado) * 100), pct = max ? 100 : Math.floor((100 * m.xp) / M.xpMontaria(m.nivel));
  const chave = [m.nivel, pct, montado, m.skin, (m.skins || []).join(), ingles].join('|');
  if (chave === montariaDesenhada) return;
  montariaDesenhada = chave;
  const b = $('#bt-montaria');
  b.classList.toggle('ligado', montado); b.setAttribute('aria-pressed', String(montado));
  if (montado) gravarLocal('lolidle-montou', 1);
  b.classList.toggle('novo', !lerLocal('lolidle-montou', 0));
  b.querySelector('.mt-txt').textContent = montado ? t('Desmontar') : t('Montar') + ' · ' + t('nv {n}', { n: m.nivel });
  b.querySelector('.mt-barra > b').style.width = pct + '%';
  b.title = t('{montaria} nível {n}: +{vel}% de velocidade montado (tecla Z). Sobe de nível andando montado.', { montaria: nm, n: m.nivel, vel }) + (max ? '' : ' ' + t('Falta {x} para o próximo nível.', { x: Math.ceil(M.xpMontaria(m.nivel) - m.xp) + ' ' + t('tiles') }));
  const q = $('#montaria');
  if (!q) return;
  const skins = [{ id: '', nome: 'Burrinho' }, ...M.SKINS_MONTARIA];
  q.innerHTML = `<div class="pet ativo montaria-card">
      <img src="${miniatura(M.spriteMontaria(estado))}" alt="">
      <div><b>${nm}</b> <small class="nv">${t('nível {n}', { n: m.nivel })}${max ? t(' (máx.)') : ''}</small>
        <small>${t('Em Runeterra, aperte Z (ou o botão embaixo do minimapa) para montar: +{vel}% de velocidade. Sobe de nível andando montado. Atacar ou usar habilidade desmonta.', { vel })}</small>
        <div class="mini"><span style="width:${pct}%"></span></div>
        <div class="pet-skins">${skins.map((sk) => `<button type="button" data-montaria-skin="${sk.id}" class="${(m.skin || '') === sk.id ? 'usando' : ''} ${sk.id && !m.skins.includes(sk.id) ? 'bloq' : ''}" title="${t(sk.nome)}">${t(sk.nome)}${sk.id && !m.skins.includes(sk.id) ? ` · ${sk.preco} 💎` : ''}</button>`).join('')}</div></div>
    </div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-montaria-skin]'); if (!b) return;
  const id = b.dataset.montariaSkin, sk = M.SKINS_MONTARIA.find((x) => x.id === id);
  if (id && !M.montariaDe(estado).skins.includes(id)) { abrirMercado('loja'); log(t('Essa skin está à venda na Loja por {preco} diamantes.', { preco: sk.preco }), 'npc'); return; }
  M.usarSkinMontaria(estado, id); atualizarMontaria(); atualizarUI();
});
// teclas 1 a 5: as poções, na ordem da barra de poções (em qualquer lugar do jogo)
// usar uma poção à mão (clique ou tecla). Assistindo a dungeon, a luta é no servidor: a poção vai para lá (p726)
function usarPocaoJogador(k) {
  if (typeof dgVendo !== 'undefined' && dgVendo) {
    rede.acaoDungeon('pocao', { chave: k }).then((r) => { if (r?.ok) som.efeito('cura'); else if (r?.erro) cena.aviso(r.erro, '#ffb070'); }).catch((er) => cena.aviso(er.message || String(er), '#ffb070'));
    return;
  }
  if (M.usarPocao(estado, combate, k)) atualizarUI();
}
// ---------- teclas configuráveis (p723): habilidades da barra (Runeterra e Arena) e poções ----------
var TECLAS_PADRAO = { hab: ['q', 'w', 'e', 'r'], pocao: ['1', '2', '3', '4', '5'] };
// teclas que já são de outra função: não dá para escolher
var TECLAS_FIXAS = { p: 'PK', z: 'Montaria', a: 'Atacar o mais perto', s: 'Parar', m: 'Mapa', k: 'Ranking', g: 'Guilda', o: 'Amigos', b: 'Voltar para a Fonte', i: 'Mochila', j: 'Mercado',
  ' ': 'Câmera', enter: 'Chat', escape: 'Fechar', arrowup: 'Andar', arrowdown: 'Andar', arrowleft: 'Andar', arrowright: 'Andar', tab: 'Chat', shift: '', control: '', alt: '', meta: '' };
var teclas = (() => { try { const x = JSON.parse(localStorage.getItem('lolidle-teclas')); if (x?.hab?.length === 4 && x?.pocao?.length === 5 && [...x.hab, ...x.pocao].every((k) => typeof k === 'string' && k && !(k in TECLAS_FIXAS))) return x; } catch {} return structuredClone(TECLAS_PADRAO); })();
var nomeTecla = (k) => (k === ' ' ? t('Espaço') : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));
addEventListener('keydown', (e) => {
  if (digitando(e) || e.ctrlKey || e.altKey || e.metaKey || e.repeat || document.querySelector('.janela:not([hidden]), .dialogo-fundo')) return;
  const k = Object.keys(M.POCOES)[teclas.pocao.indexOf(e.key.toLowerCase())];      // a tecla escolhida para cada poção (p723)
  if (!k) return;
  e.preventDefault();
  usarPocaoJogador(k);
});

// ---------- Runeterra: teclado e mouse ----------
let mouseTela = null;                 // posição do mouse no canvas (px CSS), para mirar
// em Runeterra cada espaço da barra de combate é uma tecla: Q, W, E, R (o campeão anda com o mouse, como no LoL)
let TECLA_ESPACO = Object.fromEntries(teclas.hab.map((k, i) => [k, i]));      // as teclas escolhidas (p723; padrão Q W E R)
let ROTULO_ESPACO = teclas.hab.map(nomeTecla);
const naArena = () => !!localAtual().arena && combate.arena;
const digitando = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
// "Mostrar alcance": segurar a tecla mostra o alcance da habilidade e soltar lança (desligado, lança na hora)
let verAlcance = false;
try { verAlcance = localStorage.getItem('lolidle-alcance') === '1'; } catch {}
function definirAlcance(v) {
  verAlcance = v;
  try { localStorage.setItem('lolidle-alcance', v ? '1' : '0'); } catch {}
  const b = $('#bt-alcance');
  b.classList.toggle('ligado', v); b.setAttribute('aria-pressed', String(v));
  b.title = v ? t('Alcance ligado: segure Q, W, E ou R para ver o alcance e solte para lançar') : t('Alcance desligado: as habilidades saem na hora. Clique para ver o alcance antes de lançar');
}
definirAlcance(verAlcance);
$('#bt-alcance').addEventListener('click', (e) => { definirAlcance(!verAlcance); e.currentTarget.blur(); });
// "Só campeões" (como no LoL; pedido de jogadores): ligado, o botão direito e a tecla A só miram em jogadores
let soCampeoes = false;
try { soCampeoes = localStorage.getItem('lolidle-so-campeoes') === '1'; } catch {}
function definirSoCampeoes(v) {
  soCampeoes = v;
  try { localStorage.setItem('lolidle-so-campeoes', v ? '1' : '0'); } catch {}
  const b = $('#bt-campeoes');
  b.classList.toggle('ligado', v); b.setAttribute('aria-pressed', String(v));
  b.title = v ? t('Só campeões ligado: o botão direito e a tecla A miram só em jogadores (os monstros ficam de fora)') : t('Só campeões desligado: clique para o botão direito e a tecla A mirarem só em jogadores');
}
definirSoCampeoes(soCampeoes);
$('#bt-campeoes').addEventListener('click', (e) => { definirSoCampeoes(!soCampeoes); e.currentTarget.blur(); });
// câmera solta em Runeterra (tecla Y, como no LoL; pedido de jogadores): o mouse na borda da tela move a câmera,
// Espaço volta para o campeão e Y prende de novo. Quem atira de longe (Ezreal) mira melhor sem a tela correndo junto.
let cameraLivre = false, mouseJanela = null;
addEventListener('mousemove', (e) => { mouseJanela = { x: e.clientX, y: e.clientY }; });
document.addEventListener('mouseleave', () => { mouseJanela = null; });
function definirCameraLivre(v) {
  cameraLivre = !!v && !!naArena();
  cena.camLivre = cameraLivre ? cena.camNoCampeao() : null;
  cena.aviso(cameraLivre ? t('Câmera solta: leve o mouse à borda da tela. Espaço volta ao campeão, Y prende de novo') : t('Câmera presa no campeão'), '#c8e0ff');
}
function moverCameraLivre(dt) {
  if (!cameraLivre) return;
  if (!naArena()) { cameraLivre = false; cena.camLivre = null; return; }
  const c0 = cena.camNoCampeao();
  if (!cena.camLivre || Math.hypot(cena.camLivre.x - c0.x, cena.camLivre.y - c0.y) > 60 * T) cena.camLivre = c0;      // viajou ou renasceu longe: volta para ele
  if (!mouseJanela || document.querySelector('.janela:not([hidden]), .dialogo-fundo')) return;
  const r = $('#tela').getBoundingClientRect(), m = mouseJanela, borda = 22, vel = 16 * T * dt;
  if (m.x < r.left || m.x > r.right || m.y < r.top || m.y > r.bottom) return;
  const dx = m.x < r.left + borda ? -1 : m.x > r.right - borda ? 1 : 0, dy = m.y < r.top + borda ? -1 : m.y > r.bottom - borda ? 1 : 0;
  cena.camLivre.x += dx * vel; cena.camLivre.y += dy * vel;
}
let segurando = null;                 // { tecla do teclado, habilidade } enquanto o indicador está na tela
function apertarHabilidade(hk) { if (naArena() && hk) { if (usandoToque) miraAutomatica(); combate.arena.entrada.fila.push(hk); combate.arena.mexeu = true; } }
// toque (celular, tablet): sem mouse, a habilidade mira sozinha: no alvo que você ataca, senão no monstro mais perto
// (até 10 quadrados), senão 3 quadrados para a frente
let usandoToque = false;
function miraAutomatica() {
  const A = combate.arena; if (!A) return;
  const vivo = (i) => i && i.hp > 0 && !i.morto;
  let alvo = null;
  if (A.alvoAtaque?.tipo === 'monstro') alvo = combate.inimigos.find((i) => i.id === A.alvoAtaque.id && vivo(i));
  else if (A.alvoAtaque?.tipo === 'jogador') alvo = (A.outros || []).find((o) => o.nome === A.alvoAtaque.nome && !o.morto);
  if (!alvo) alvo = combate.inimigos.filter(vivo).sort((a, b) => Math.hypot(a.x - A.x, a.y - A.y) - Math.hypot(b.x - A.x, b.y - A.y))[0];
  if (alvo && Math.hypot(alvo.x - A.x, alvo.y - A.y) < 10) A.entrada.mira = { x: alvo.x, y: alvo.y };
  else { const d = A.dir || { x: 1, y: 0 }, n = Math.hypot(d.x, d.y) || 1; A.entrada.mira = { x: A.x + (d.x / n) * 3, y: A.y + (d.y / n) * 3 }; }
}
addEventListener('keydown', (e) => {
  if (!naArena() || digitando(e) || e.ctrlKey || e.altKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (e.repeat) { if (k in TECLA_ESPACO) e.preventDefault(); return; }
  if (k === 'p') { alternarPvp(); return; }
  if (k === 'z') { if (!naAram()) Arena.alternarMontaria(combate, estado); return; }
  if (k === 'a') { atacarMaisPerto(); return; }
  if (k === 's') { pararMovimento(); return; }
  if (k === ' ' && cameraLivre) { e.preventDefault(); cena.camLivre = cena.camNoCampeao(); return; }
  if (k === 'escape' && segurando) { segurando = null; return; }
  if (!(k in TECLA_ESPACO)) return;
  e.preventDefault();
  const hk = estado.barra[TECLA_ESPACO[k]];
  if (!hk) return;
  if (verAlcance && Arena.ALCANCE_HAB[CAMP]?.[hk]) segurando = { k, t: hk };
  else apertarHabilidade(hk);
});
// S para tudo, como no LoL (pedido do dono): para de andar (também o andar segurando o botão direito) e de atacar;
// as habilidades já na fila continuam
function pararMovimento() {
  const A = combate.arena; if (!A) return;
  A.destino = null; A.caminho = null; A.alvoAtaque = null; segurandoDireito = false;
}
addEventListener('keyup', (e) => {
  if (segurando && e.key.toLowerCase() === segurando.k) { const hk = segurando.t; segurando = null; apertarHabilidade(hk); }
});
addEventListener('blur', () => { segurando = null; setas.clear(); });
// setas do teclado também andam (além do botão direito): em Runeterra, segurando, nas 8 direções (desliza nas paredes
// como no clique e para ao soltar); na Fonte, um tile por passo. No Summoner's Rift a caça é automática: não fazem nada.
const SETAS = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }, setas = new Set();
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!(k in SETAS) || digitando(e) || e.ctrlKey || e.altKey || e.metaKey || document.querySelector('.janela:not([hidden]), .dialogo-fundo')) return;
  if (!naArena() && !localAtual().base) return;
  e.preventDefault(); setas.add(k);
});
addEventListener('keyup', (e) => setas.delete(e.key.toLowerCase()));
function andarPelasSetas() {
  if (!setas.size) return;
  let dx = 0, dy = 0;
  for (const k of setas) { dx += SETAS[k][0]; dy += SETAS[k][1]; }
  if (!dx && !dy) return;
  if (naArena()) {
    const A = combate.arena;
    if (combate.darius.morto > 0) return;
    // um ponto logo à frente, renovado a cada quadro: anda enquanto a seta está apertada e para logo depois de soltar
    const n = Math.hypot(dx, dy);
    A.destino = { x: A.x + (dx / n) * 0.5, y: A.y + (dy / n) * 0.5 }; A.caminho = null; A.alvoAtaque = null; A.travado = 0; A.mexeu = true;
    return;
  }
  // na Fonte: anda um tile na direção (se estiver livre), e segurando continua
  const d = cena.darius;
  if (!localAtual().base || d.fila.length || cena.morto) return;
  const m = cena.mapa, ocup = cena.ocupados(d), livre = (x, y) => m.livre(x, y) && !ocup.has(x + ',' + y);
  for (const [x, y] of [[d.x + dx, d.y + dy], [d.x + dx, d.y], [d.x, d.y + dy]]) {
    if ((x !== d.x || y !== d.y) && livre(x, y)) { d.fila = [{ x, y }]; cena.aoChegar = null; break; }
  }
}
$('#tela').addEventListener('mousemove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  mouseTela = { x: e.clientX - r.left, y: e.clientY - r.top, larg: r.width };
  if (naArena()) combate.arena.mexeu = true;
});
$('#tela').addEventListener('mouseleave', () => { mouseTela = null; });
// o que está debaixo do mouse em Runeterra: um monstro, um jogador ou o chão
// tecla A (como o "atacar" do LoL): ataca o inimigo mais perto do mouse (no celular, de você), até 8 quadrados;
// com "Só campeões" ligado, só jogadores. Jogador só com o PK ligado (ou com Caveira) e na diferença de nível certa.
function atacarMaisPerto() {
  const A = combate.arena; if (!A) return;
  const ref = mouseDireito && !usandoToque ? pontoDoMouse(mouseDireito) : { x: A.x, y: A.y };
  const perto = (o) => Math.hypot(o.x - ref.x, o.y - ref.y), lista = [];
  if (!soCampeoes) {
    for (const i of combate.inimigos) if (i.hp > 0 && !i.morto) lista.push({ d: perto(i), alvo: { tipo: 'monstro', id: i.id } });
    for (const o of cena.monstrosDeOutros()) lista.push({ d: perto(o), alvo: { tipo: 'monstroOutro', chave: o.chave } });
  }
  for (const o of cena.posicoesArena()) if (!o.morto && o.atacavel && Arena.podeAtacarJog(A, o)) lista.push({ d: perto(o), alvo: { tipo: 'jogador', nome: o.nome } });
  const m = lista.sort((a, b) => a.d - b.d)[0];
  if (!m || m.d > 8) { cena.texto(cena.darius, soCampeoes ? (A.pvp ? t('Nenhum jogador para atacar por perto') : t('Ligue o PvP (tecla P)')) : t('Nenhum inimigo por perto'), '#c8c0b0', 0.8); return; }
  Arena.mandarAtacar(combate, m.alvo);
}
function sobMouse(p, soJogadores = false) {
  // jogador: área maior (1 quadrado, no meio do corpo) e, se dá para atacá-lo agora, ganha do monstro que está junto
  const j = cena.posicoesArena().filter((o) => !o.morto && Math.hypot(o.x - p.x, o.y - 0.6 - p.y) < 1).sort((a, b) => Math.hypot(a.x - p.x, a.y - 0.6 - p.y) - Math.hypot(b.x - p.x, b.y - 0.6 - p.y))[0];
  const comoJogador = j && { tipo: 'jogador', nome: j.nome, atacavel: j.atacavel, mesmaGuilda: j.mesmaGuilda, mesmoGrupo: j.mesmoGrupo, caveira: j.caveira };
  if (comoJogador && j.atacavel && Arena.podeAtacarJog(combate.arena, j)) return comoJogador;
  const m = !soJogadores && combate.inimigos.filter((i) => i.hp > 0 && !i.morto && Math.hypot(i.x - p.x, i.y - (i.chefe ? 0.9 : 0.45) - p.y) < (i.chefe ? 1.3 : 0.75))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (m) return { tipo: 'monstro', id: m.id };
  // monstro que outro jogador está enfrentando: também dá para atacar
  const mo = !soJogadores && cena.monstrosDeOutros().filter((o) => Math.hypot(o.x - p.x, o.y - (o.raio ? 1.4 : 0.45) - p.y) < (o.raio ? o.raio + 0.6 : 0.75)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (mo) return { tipo: 'monstroOutro', chave: mo.chave };
  return comoJogador || null;
}
const pontoDoMouse = (e) => {
  const r = $('#tela').getBoundingClientRect(), k = r.width / (VIS_L * T);
  return { x: (cena.cam.x + (e.clientX - r.left) / k) / T, y: (cena.cam.y + (e.clientY - r.top) / k) / T };
};
// botão direito (como no LoL): no monstro ou jogador ataca; no chão anda. O esquerdo fica só para a interface.
function comandoDoMouse(e) {
  if (!naArena()) return false;
  e.preventDefault();
  const p = pontoDoMouse(e), alvo = sobMouse(p, soCampeoes);
  if (alvo?.tipo === 'monstro' || alvo?.tipo === 'monstroOutro') { Arena.mandarAtacar(combate, alvo); return true; }
  if (alvo?.tipo === 'jogador') {
    if (!Arena.podeAtacarJog(combate.arena, alvo)) { cena.texto(cena.darius, t('Ligue o PvP (tecla P)'), '#c8c0b0', 0.8); return true; }      // quem tem Caveira qualquer um ataca
    if (!alvo.atacavel) { cena.texto(cena.darius, alvo.mesmoGrupo ? t('É do seu grupo') : alvo.mesmaGuilda ? t('É da sua guilda') : t('Diferença de nível grande demais'), '#c8c0b0', 0.8); return true; }
    Arena.mandarAtacar(combate, { tipo: 'jogador', nome: alvo.nome }); return true;
  }
  Arena.mandarAndar(combate, p.x, p.y);
  cena.marcarDestino(p.x, p.y);
  return 'chao';
}
// segurar o botão direito no chão: o campeão segue o mouse até soltar (jogador: "clicar e segurar, em vez de ficar clicando")
let segurandoDireito = false, mouseDireito = null, segurandoT = 0;
$('#tela').addEventListener('mousedown', (e) => {
  if (e.button !== 2) return;
  const r = comandoDoMouse(e);
  if (!r) comandoNaFonte(e);
  segurandoDireito = r === 'chao'; mouseDireito = e; segurandoT = performance.now();
});
$('#tela').addEventListener('mousemove', (e) => { mouseDireito = e; });
window.addEventListener('mouseup', (e) => { if (e.button === 2) segurandoDireito = false; });
window.addEventListener('blur', () => { segurandoDireito = false; });
// toque na tela do jogo: no chão anda; num monstro ou jogador ataca (Runeterra); na Fonte, num NPC ou jogador o "click"
// abre (a conversa ou a ficha). Segurar e arrastar anda seguindo o dedo, como segurar o botão direito.
let toqueId = null;
$('#tela').addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') { usandoToque = false; return; }
  usandoToque = true; toqueId = e.pointerId; mouseDireito = e;
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  if (naArena()) { const r = comandoDoMouse(e); segurandoDireito = r === 'chao'; segurandoT = performance.now(); return; }
  if (!M.naBase(estado) || localAtual().arena || combate.darius.morto > 0) return;
  const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (cena.clicar(x, y, r.width) || cena.jogadorEm(x, y, r.width)) return;      // o "click" do toque cuida deles
  cena.andarPara(x, y, r.width);
});
$('#tela').addEventListener('pointermove', (e) => { if (e.pointerId === toqueId) mouseDireito = e; });
const fimToque = (e) => { if (e.pointerId === toqueId) { toqueId = null; segurandoDireito = false; } };
$('#tela').addEventListener('pointerup', fimToque);
$('#tela').addEventListener('pointercancel', fimToque);
addEventListener('mousemove', (e) => { if (!e.sourceCapabilities?.firesTouchEvents) usandoToque = false; }, { passive: true });
function andarSegurando() {
  if (!segurandoDireito || !mouseDireito || !naArena() || combate.darius.morto > 0) return;
  const agora = performance.now();
  if (agora - segurandoT < 150) return;           // a cada 0,15 s um destino novo, onde o mouse está
  segurandoT = agora;
  const p = pontoDoMouse(mouseDireito);
  if (Math.hypot(p.x - combate.arena.x, p.y - combate.arena.y) > 0.6) Arena.mandarAndar(combate, p.x, p.y);
}
// o botão direito anda: o menu do navegador (Inspecionar…) nunca abre na área do jogo, nem em cima dos quadros e botões dela
$('#moldura').addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
function lerControles() {
  const A = combate.arena;
  if (!naArena()) { cena.miraArena = null; cena.indicador = null; cena.alcanceBasico = 0; cursorLol(false, false); return; }
  // o mouse vira um ponto do chão do mundo (a câmera anda junto com o campeão)
  if (mouseTela) {
    const k = mouseTela.larg / (VIS_L * T);
    A.entrada.mira = { x: (cena.cam.x + mouseTela.x / k) / T, y: (cena.cam.y + mouseTela.y / k) / T };
  }
  cena.miraArena = mouseTela ? A.entrada.mira : null;
  cena.miraSobreAlvo = !!(mouseTela && sobMouse(A.entrada.mira));
  cena.indicador = segurando ? { ...Arena.ALCANCE_HAB[CAMP][segurando.t] } : null;
  cena.alcanceBasico = verAlcance ? Arena.alcanceBasico(CAMP) : 0;
  cursorLol(true, cena.miraSobreAlvo);
}
// o cursor de Runeterra (só troca a classe quando muda; o cursor do sistema nunca atrasa, ao contrário da mira desenhada)
let cursorAgora = '';
function cursorLol(lig, ataque) {
  const k = lig ? (ataque ? 'a' : 's') : '';
  if (k === cursorAgora) return;
  cursorAgora = k;
  const tela = $('#tela');
  tela.classList.toggle('cursor-lol', !!lig); tela.classList.toggle('cursor-ataque', !!(lig && ataque));
}

// O jogo só anda enquanto está aberto no navegador. Com a aba visível, cada quadro avança e desenha;
// com a aba escondida ou minimizada, o relógio em segundo plano (js/pulso.js) avança sem desenhar.
// Fechou o navegador, o personagem para: não existe progresso offline.
let ultimo = performance.now(), acum = 0, uiT = 0, saveT = 0;
// no máximo 60 quadros por segundo: em tela de 120 Hz o jogo rodava tudo 120 vezes (o modo leve usa 30)
let intervaloQuadro = 1000 / 60, ultimoQuadro = 0;
function quadro(t = performance.now()) {
  requestAnimationFrame(quadro);      // agenda antes: um erro num quadro não congela o jogo
  if (document.hidden) { medIni = 0; return; }
  // o ritmo médio fica em 60 (ou 30) em qualquer tela: 75 Hz, 90 Hz, 120 Hz (com "ultimoQuadro = t" a de 75 Hz caía para 37)
  const passou = t - ultimoQuadro;
  if (passou < intervaloQuadro - 1) return;
  ultimoQuadro = passou > 250 ? t : t - (passou % intervaloQuadro);
  avancar(true);
  medirDesempenho(t);
}
// modo leve: 30 quadros por segundo, pano 15 vezes por segundo, sem bichos e enfeites, metade das partículas e sem os
// brilhos pulsando da interface (classe modo-leve no body)
const modoLeve = () => desempenho === 'leve' || (desempenho === 'auto' && leveAuto);
function aplicarDesempenho() {
  const leve = modoLeve();
  intervaloQuadro = 1000 / (leve ? 30 : 60);
  cena.leve = leve; cena.fx.leve = leve; cena.panoPasso = leve ? 1 / 15 : 1 / 30;
  document.body.classList.toggle('modo-leve', leve);
}
aplicarDesempenho();
// automático: depois de 20 s, abaixo de 40 quadros por segundo em duas medições seguidas de 8 s, liga o modo leve
let medIni = 0, medQ = 0, medRuins = 0;
function medirDesempenho(ts) {
  if (desempenho !== 'auto' || leveAuto) return;
  if (!medIni) { medIni = ts; medQ = 0; return; }
  medQ++;
  if (ts - medIni < 8000) return;
  const fps = (medQ * 1000) / (ts - medIni); medIni = ts; medQ = 0;
  if (performance.now() < 20000) return;
  medRuins = fps < 40 ? medRuins + 1 : 0;
  if (medRuins < 2) return;
  leveAuto = true; gravarLocal('lolidle-leve-auto', true); aplicarDesempenho();
  cena.aviso(t('Modo leve ligado para o jogo rodar melhor neste aparelho'), '#8ad8ff');
  log(t('O jogo estava lento neste aparelho ({fps} quadros por segundo) e o modo leve foi ligado: menos enfeites e animações. Para mudar: ⚙ Configurações → Desempenho.', { fps: Math.round(fps) }), 'npc');
}
const pulso = new Worker('js/pulso.js');
pulso.onmessage = () => { if (document.hidden) avancar(false); };
function avancar(desenhar) {
  const agora = performance.now();
  // no máximo 1 s por vez: se o computador dormir, o jogo não "recupera" o tempo parado
  const dt = Math.min(desenhar ? 0.25 : 1, (agora - ultimo) / 1000);
  ultimo = agora;
  acum += dt;
  estado.relogio = M.relogioMundial(agoraMundo());          // dia e noite iguais para todos
  andarPelasSetas();
  moverCameraLivre(dt);
  andarSegurando();
  lerControles();
  while (acum >= DT) { M.passo(estado, combate, DT); processarEventos(); acum -= DT; }
  enviarTempoReal(dt);
  passoViagem(dt);
  cena.luz = M.luzDoDia(estado.relogio);
  cena.atualizar(dt);
  if (desenhar) cena.desenhar();
  if ((uiT += dt) > 0.2) { uiT = 0; som.trilha(trilhaAtual()); atualizarUI(); }
  if ((saveT += dt) > 15) { saveT = 0; salvar(); }
  atualizarPresenca(dt);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
addEventListener('beforeunload', () => { prepararSave(); rede.salvarAoFechar(estado); });
// o jogo foi atualizado no servidor: salva o progresso e recarrega para todo mundo ficar na mesma versão
let recarregando = false;
addEventListener('lolidle-nova-versao', async () => {
  if (recarregando) return;
  recarregando = true;
  log(t('O jogo foi atualizado! Salvando e recarregando em instantes…'), 'raro');
  cena.aviso(t('Jogo atualizado! Recarregando…'), '#ffd84a');
  try { prepararSave(); await rede.salvarNoServidor(estado); } catch {}
  setTimeout(() => location.reload(), 2500);
});
// tela preta (visto no Edge): o navegador às vezes descarta a memória de vídeo (aba em segundo plano, modo de eficiência,
// driver) e as imagens que o jogo guarda (chão, personagens, monstros) somem. O jogo continua rodando, mas tudo sai preto.
// Quando o navegador avisa, ou a tela fica toda preta por ~12 s, salva e recarrega. Se já recarregou 2 vezes em 5 minutos
// por isso, não insiste: explica como resolver no navegador.
{
  const tela = $('#tela'), amostra = document.createElement('canvas');
  amostra.width = amostra.height = 4;
  const ga = amostra.getContext('2d', { willReadFrequently: true });
  const aberto = Date.now(), CHAVE_PRETA = 'lolidle-tela-preta';
  let pretas = 0, explicou = false;
  const recuperar = async (motivo) => {
    if (recarregando) return;
    let vezes = [];
    try { vezes = JSON.parse(sessionStorage.getItem(CHAVE_PRETA) || '[]').filter((x) => Date.now() - x < 5 * 60000); } catch {}
    if (vezes.length >= 2) {
      if (!explicou) { explicou = true; avisar(t('A tela do jogo ficou preta e recarregar não resolveu. Isso acontece quando o navegador desliga a placa de vídeo. No Edge: em Configurações → Sistema e desempenho, desligue o "Modo de eficiência" e ligue "Usar aceleração de gráficos quando disponível"; depois reinicie o navegador. Se continuar, jogue pelo Chrome.')); }
      return;
    }
    recarregando = true;
    try { sessionStorage.setItem(CHAVE_PRETA, JSON.stringify([...vezes, Date.now()])); } catch {}
    console.warn('[tela]', motivo, '— salvando e recarregando');
    log(t('A tela do jogo apagou. Salvando e recarregando…'), 'raro');
    try { prepararSave(); await rede.salvarNoServidor(estado); } catch {}
    location.reload();
  };
  tela.addEventListener('contextlost', (e) => e.preventDefault());
  tela.addEventListener('contextrestored', () => recuperar('o navegador recriou a tela'));
  setInterval(() => {
    if (document.hidden || recarregando || Date.now() - aberto < 20000 || !tela.width || !tela.height) { pretas = 0; return; }
    try {
      ga.clearRect(0, 0, 4, 4); ga.drawImage(tela, 0, 0, 4, 4);
      const d = ga.getImageData(0, 0, 4, 4).data;
      let soma = 0;
      for (let k = 0; k < d.length; k += 4) soma += d[k] + d[k + 1] + d[k + 2];
      pretas = soma < 8 ? pretas + 1 : 0;
    } catch { return; }
    if (pretas >= 3) { pretas = 0; recuperar('tela preta'); }
  }, 4000);
}

// ---------- janelas ----------
function fecharJanelas() { document.querySelectorAll('.janela').forEach((j) => (j.hidden = true)); }
document.querySelectorAll('.janela').forEach((j) => j.addEventListener('click', (e) => {
  if (e.target === j || e.target.closest('[data-fechar]')) j.hidden = true;
}));
addEventListener('keydown', (e) => {
  if ((e.key === 'j' || e.key === 'J') && e.target.tagName !== 'INPUT') { if ($('#janela-mercado').hidden) abrirMercadoJogadores(); else $('#janela-mercado').hidden = true; }
  if (e.key === 'Escape' && viagem) { e.preventDefault(); cancelarViagem(t('Viagem cancelada')); return; }      // Esc cancela a viagem
  if (e.key === 'Escape' && combate?.darius?.recall > 0 && !document.querySelector('.janela:not([hidden])')) { e.preventDefault(); M.cancelarRecall(combate); return; }      // Esc cancela o retorno à base (p658)
  if (e.key === 'Escape') { fecharJanelas(); if (e.target.id === 'chat-texto') e.target.blur(); }
  if (e.target.tagName === 'INPUT') return;
  // Enter abre o chat (como no Tibia)
  if (e.key === 'Enter' && !document.querySelector('.janela:not([hidden])')) { e.preventDefault(); if (canalAtivo === 'servidor') trocarCanal('global'); $('#chat-texto').focus(); return; }
  if (e.key === 'm' || e.key === 'M') { if ($('#janela-mapa').hidden) abrirMapa(); else $('#janela-mapa').hidden = true; }      // M abre e fecha o mapa
  if (e.key === 'k' || e.key === 'K') { if ($('#janela-ranking').hidden) abrirRanking(); else $('#janela-ranking').hidden = true; }      // K, G e I abrem e fecham (p656)
  if (e.key === 'g' || e.key === 'G') { if ($('#janela-guilda').hidden) abrirGuilda(); else $('#janela-guilda').hidden = true; }
  if (e.key === 'o' || e.key === 'O') { if ($('#janela-amigos').hidden) abrirAmigos(); else $('#janela-amigos').hidden = true; }
  if (e.key === 'b' || e.key === 'B') $('#voltar-base').click();
  if (e.key === 'i' || e.key === 'I') { if ($('#janela-bolsa').hidden) abrirBolsa(); else $('#janela-bolsa').hidden = true; }
});

// ---------- VIP ----------
const diasRestantes = () => Math.ceil(((estado.vipAte || 0) - Date.now()) / 86400000);
function atualizarBotaoVip() {
  const b = $('#abrir-vip'), vip = M.ehVip(estado);
  b.classList.toggle('ativo', vip);
  b.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .8l2.2 4.6 5 .7-3.6 3.5.9 5L8 12.2 3.5 14.6l.9-5L.8 6.1l5-.7z"/></svg><span>${vip ? `VIP ${diasRestantes()}d` : 'VIP'}</span>`;
  b.title = vip ? t('VIP ativo até {data}', { data: new Date(estado.vipAte).toLocaleDateString(LOCALE) }) : t('Seja VIP e apoie o jogo');
  cena.vip = vip;
  $('#rotina').classList.toggle('sem-vip', !vip);
  for (const el of document.querySelectorAll('#rotina input')) el.disabled = !vip;
}
async function abrirVip() {
  $('#janela-vip').hidden = false; $('#vip-erro').textContent = ''; funil('loja:abriu');
  const pct = (x) => `+${Math.round((x - 1) * 100)}%`;
  $('#vip-beneficios').innerHTML = [
    t('<b>{pct}</b> de experiência', { pct: pct(M.VIP.xp) }),
    t('<b>{pct}</b> de chance de drop (1% vira 1,2%)', { pct: pct(M.VIP.drop) }),
    t('<b>{pct}</b> de chance de refino no Ornn (até {max}%)', { pct: pct(M.VIP.refino), max: Math.round(M.VIP.refinoMax * 100) }),
    t('<b>Automático</b>: usa poções de vida e mana sozinho e volta para a Fonte quando as poções acabam ou a mochila enche'),
    t('<b>★</b> ao lado do nome no chat, no ranking e na Fonte'),
  ].map((txt) => `<li>${txt}</li>`).join('');
  try {
    const v = await rede.vip();
    rp = v.rp; estado.vipAte = v.vipAte; mostrarDiamantes();
    $('#vip-status').innerHTML = t('Você tem <b class="dia">{qtd} 💎 diamantes</b>.', { qtd: fmt(rp) }) + ' ' + (M.ehVip(estado)
      ? t('VIP ativo até <b>{data}</b> ({dias} dias).', { data: new Date(estado.vipAte).toLocaleString(LOCALE), dias: diasRestantes() }) : t('Você ainda não é VIP.'));
    const b = $('#vip-ativar');
    b.textContent = M.ehVip(estado) ? t('Somar {dias} dias de VIP por {preco} 💎', { dias: v.dias, preco: fmt(v.preco) }) : t('Ativar {dias} dias de VIP por {preco} 💎', { dias: v.dias, preco: fmt(v.preco) });
    b.disabled = rp < v.preco;
    montarCompra(v);
  } catch (e) { $('#vip-status').textContent = t('Não foi possível falar com o servidor.'); }
  atualizarBotaoVip();
}
$('#abrir-vip').addEventListener('click', abrirVip);

// ---------- ganhar dinheiro: indicação, temporada do mês e saque por PIX ----------
const linkIndicacao = () => `${location.origin}${ingles ? '/en' : '/'}?ref=${encodeURIComponent(NOME)}`;
const dataCurta = (ms) => new Date(ms).toLocaleDateString(ingles ? 'en-US' : 'pt-BR', { day: 'numeric', month: 'short' });
// sorteio de VIP da indicação: o contador do seu link e os ganhadores
function blocoSorteio(g) {
  const S = g.regras.sorteio, sv = g.sorteio; if (!S || !sv) return '';
  const atual = sv.validos % S.aCada, falta = S.aCada - atual;
  const lista = (l, comLink) => l.length ? `<ul class="gn-hist">${l.map((x) => `<li><span>🎉 <b>${esc(x.ganhador)}</b>${comLink ? ` · ${t('amigo de {nome}', { nome: esc(x.indicador) })}` : ` · ${t('rodada {n}', { n: x.rodada + 1 })}`}</span><small>${dataCurta(x.criado)}</small></li>`).join('')}</ul>` : '';
  return `<section class="gn-bloco gn-sorteio">
      <h3>🎁 ${t('Sorteio de VIP')}</h3>
      <p>${t('A cada <b>{n} amigos</b> que chegam pelo seu link, um deles ganha <b>{dias} dias de VIP</b>. Conta quem confirmar o email e chegar ao nível {nivel}.', { n: S.aCada, dias: S.diasVip, nivel: S.nivelMin })}</p>
      <div class="gn-barra" title="${t('{v} de {n}', { v: atual, n: S.aCada })}"><i style="width:${(100 * atual) / S.aCada}%"></i><span>${t('{v}/{n} para o próximo sorteio', { v: atual, n: S.aCada })}</span></div>
      <small class="fraco">${t('{c} chegaram pelo seu link · {v} já contam · faltam {f} para sortear', { c: sv.chegaram, v: sv.validos, f: falta })}</small>
      ${sv.ganhadores.length ? `<div class="rotulo">${t('Ganhadores do seu link')}</div>${lista(sv.ganhadores, false)}` : ''}
      ${sv.ultimos.length ? `<div class="rotulo">${t('Últimos ganhadores')}</div>${lista(sv.ultimos, true)}` : ''}
    </section>`;
}
async function abrirGanhos() {
  $('#janela-ganhos').hidden = false;
  let g;
  try { g = await rede.ganhos(); } catch (e) { $('#ganhos-corpo').innerHTML = `<p class="alerta">${esc(e.message)}</p>`; return; }
  const R = (v) => reais(v, ingles);
  const s = g.saldo, aberto = g.saques.find((x) => x.status === 'pedido');
  const STATUS = { pedido: t('esperando pagamento'), pago: t('pago'), recusado: t('recusado') };
  const historico = [...g.saques.map((x) => `<li><span>${t('Saque')} · ${dataCurta(x.criado)}</span><b>${R(x.valor)}</b><small class="gn-st ${x.status}">${STATUS[x.status]}${x.obs ? ' · ' + esc(x.obs) : ''}</small></li>`),
    ...g.ganhos.slice(0, 8).map((x) => `<li><span>🤝 ${t('Indicação')} · ${dataCurta(x.criado)}</span><b>+${R(x.valor)}</b><small>${x.saque ? t('sacado') : x.libera_em > Date.now() ? t('libera em {data}', { data: dataCurta(x.libera_em) }) : t('liberado')}</small></li>`)].join('');
  const saque = g.convidado ? `<p class="alerta">${t('Salve seu progresso (crie a conta) para participar e sacar.')}</p><button type="button" class="botao principal" id="abrir-salvar">${t('Salvar meu progresso')}</button>`
    : aberto ? `<p class="gn-aviso">${t('Seu saque de {valor} está esperando pagamento. O PIX é feito em até 7 dias.', { valor: R(aberto.valor) })}</p>`
    : `<form class="gn-saque" id="gn-saque">
        <label>${t('Nome completo do dono da chave')} <input id="gn-nome" maxlength="80" autocomplete="name"></label>
        <label>${t('Chave PIX')} <input id="gn-chave" maxlength="120" placeholder="${t('CPF, email, celular ou chave aleatória')}"></label>
        <button type="submit" class="botao principal" ${s.liberado >= g.regras.saqueMin ? '' : 'disabled'}>${t('Sacar {valor}', { valor: R(s.liberado) })}</button>
        <small class="fraco">${t('Saque mínimo de {min}. O PIX é feito em até 7 dias.', { min: R(g.regras.saqueMin) })}</small>
        <p class="alerta" id="gn-erro"></p>
      </form>`;
  $('#ganhos-corpo').innerHTML = `
    <div class="gn-saldo">
      <div><small>${t('Para sacar')}</small><b>${R(s.liberado)}</b></div>
      <div><small>${t('Aguardando')}</small><b>${R(s.aguardando)}</b>${s.proxima ? `<small>${t('libera em {data}', { data: dataCurta(s.proxima) })}</small>` : ''}</div>
      <div><small>${t('Já sacado')}</small><b>${R(s.sacado)}</b></div>
    </div>
    <section class="gn-bloco">
      <h3>🤝 ${t('Indique amigos')}</h3>
      <p>${t('Você ganha <b>{pct}%</b> de tudo o que os amigos que entrarem pelo seu link gastarem em diamantes. O valor libera {dias} dias depois da compra.', { pct: Math.round(g.regras.comissao * 100), dias: g.regras.esperaComissao })}</p>
      <div class="gn-link"><input id="gn-link" readonly value="${linkIndicacao()}"><button type="button" class="botao" id="gn-copiar">${t('Copiar link')}</button></div>
      <small class="fraco">${g.indicados === 1 ? t('1 amigo entrou pelo seu link.') : t('{n} amigos entraram pelo seu link.', { n: g.indicados })}</small>
    </section>
    ${blocoSorteio(g)}
    <section class="gn-bloco">
      <h3>💸 ${t('Sacar por PIX')}</h3>
      ${saque}
      ${historico ? `<ul class="gn-hist">${historico}</ul>` : ''}
    </section>
    <p class="gn-regras">${t('Pagamentos feitos à mão pela equipe, por PIX. Contas com trapaça perdem os ganhos. Não é salário nem investimento: é uma recompensa para quem traz amigos.')}</p>`;
}
$('#abrir-ganhos').addEventListener('click', abrirGanhos);
// ---------- Discord: entrar no servidor do LoL Idle pelo login do Discord (1 dia de VIP de presente, uma vez) ----------
let infoDiscord = null, esperandoDiscord = false;
async function atualizarDiscord() {
  try { infoDiscord = await rede.discord(); } catch { return; }
  $('#abrir-discord').classList.toggle('ganhou', !!infoDiscord.premio);
  if (infoDiscord.vipAte > (estado.vipAte || 0) + 1000) {
    const ganhou = esperandoDiscord && infoDiscord.premio;
    estado.vipAte = infoDiscord.vipAte; atualizarBotaoVip();
    if (ganhou) {
      esperandoDiscord = false;
      cena.aviso(t('Você ganhou {dias} dia de VIP! Obrigado por entrar no Discord.', { dias: infoDiscord.dias }), '#9aa6ff');
      log(t('Você entrou no Discord do LoL Idle e ganhou {dias} dia de VIP.', { dias: infoDiscord.dias }), 'raro');
      som.efeito('raro');
    }
  }
  if (!$('#janela-discord').hidden) desenharDiscord();
}
function desenharDiscord() {
  const d = infoDiscord;
  if (!d) { $('#discord-corpo').innerHTML = `<p class="fraco">${t('Carregando…')}</p>`; return; }
  const abrirConvite = d.convite ? `<a class="botao dc-botao" href="${d.convite}" target="_blank" rel="noopener">${t('Abrir o Discord')}</a>` : '';
  const premio = CONVIDADO
    ? `<div class="dc-premio"><b>🎁 ${t('Ganhe {dias} dia de VIP', { dias: d.dias })}</b><p>${t('O presente é para quem tem conta: salve seu progresso (crie a conta) e volte aqui.')}</p><button type="button" class="botao principal" id="abrir-salvar">${t('Salvar meu progresso')}</button></div>`
    : d.premio
      ? `<div class="dc-premio ok"><b>✓ ${t('Presente recebido')}</b><p>${d.ligado ? t('Sua conta está ligada ao Discord como {nome}.', { nome: esc(d.ligado.nome || '') }) : ''}</p></div>`
      : d.oauth
        ? `<div class="dc-premio"><b>🎁 ${t('Ganhe {dias} dia de VIP', { dias: d.dias })}</b><p>${t('Entre pelo botão abaixo com a sua conta do Discord: você já cai no nosso servidor e o VIP chega na hora. Vale uma vez por conta.')}</p>
            <button type="button" class="botao dc-botao" data-discord-ligar>${t('Entrar no Discord e ganhar o VIP')}</button>
            <p class="dc-aviso">${t('Já entrou no servidor pelo link do convite? Clique no botão mesmo assim: entrar pelo convite não liga a sua conta, e é o botão que entrega o VIP.')}</p></div>`
        : '';
  $('#discord-corpo').innerHTML = `<p>${t('Converse com outros jogadores, tire dúvidas e acompanhe tudo do jogo:')}</p>
    <ul class="dc-lista"><li>✨ ${t('as novidades de cada atualização')}</li><li>💎 ${t('os lendários S e SS que caem no servidor, na hora')}</li><li>🎁 ${t('os sorteios de VIP e os avisos da equipe')}</li><li>🛡 ${t('guildas recrutando e gente para caçar junto')}</li></ul>
    ${premio}
    ${d.premio || CONVIDADO || !d.oauth ? abrirConvite : `<p class="fraco dc-so">${t('Só quer entrar, sem o presente?')} ${d.convite ? `<a href="${d.convite}" target="_blank" rel="noopener">${t('Abrir o convite')}</a>` : ''} ${t('(pelo convite o VIP não vem)')}</p>`}`;
}
async function abrirDiscord() {
  $('#janela-discord').hidden = false;
  desenharDiscord();
  await atualizarDiscord();
  desenharDiscord();
}
$('#abrir-discord').addEventListener('click', abrirDiscord);
$('#janela-discord').addEventListener('click', async (e) => {
  if (e.target.id === 'abrir-salvar') { $('#janela-discord').hidden = true; return; }
  const b = e.target.closest('[data-discord-ligar]');
  if (!b) return;
  // abre a aba antes do pedido (senão o navegador bloqueia a janela) e depois manda para o Discord
  const aba = window.open('about:blank', '_blank');
  b.disabled = true;
  try {
    const { url } = await rede.ligarDiscord();
    esperandoDiscord = true;
    if (aba) aba.location.href = url; else location.href = url;
  } catch (falha) { aba?.close(); avisar(t(falha.message)); }
  finally { b.disabled = false; }
});
// voltou da aba do Discord: confere se o presente chegou
addEventListener('focus', () => { if (esperandoDiscord) atualizarDiscord(); });
setTimeout(atualizarDiscord, 4000);

// ---------- Twitch: assistir, logado, a uma live oficial dá bônus de XP (servidor/twitch.js) ----------
let infoTwitch = null, esperandoTwitch = false, bonusTwitchVisto = 1, bonusTwAtual = 1;
const pctTw = (x) => (Math.round(x * 1000) / 10).toLocaleString(LOCALE);
const ICONE_TWITCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.3 2 2.5 6.6V20h4.6v2.5h2.6l2.5-2.5h3.8l5-5V2H4.3zm15 12.1-2.9 2.9h-4.6l-2.5 2.5V17H5.5V3.8h13.8v10.3zM15.6 7h1.8v5.2h-1.8zm-4.8 0h1.8v5.2h-1.8z"/></svg>';
// o bônus vem do servidor (no save e ao abrir a janela); o motor multiplica a XP dos abates por ele
function aplicarTwitch(bonus, lives) {
  const b = Math.max(1, Number(bonus) || 1);
  bonusTwAtual = b; aplicarBonusLive();        // soma com o da Kick
  if (b > 1 && bonusTwitchVisto <= 1) {
    cena.aviso(t('Bônus da Twitch ativo: +{p}% de XP', { p: pctTw(b - 1) }), '#bf94ff');
    log(t('Você está assistindo a uma live oficial: +{p}% de XP enquanto assistir.', { p: pctTw(b - 1) }), 'raro');
  } else if (b <= 1 && bonusTwitchVisto > 1) log(t('O bônus da Twitch acabou (nenhuma live oficial sendo assistida).'));
  bonusTwitchVisto = b;
  if (lives && infoTwitch) infoTwitch.lives = lives;
  const bt = $('#abrir-twitch');
  bt.classList.toggle('ativo', b > 1);
  bt.querySelector('em').textContent = t('+{p}% XP', { p: pctTw(b > 1 ? b - 1 : infoTwitch?.base ?? 0.15) });
  $('#buff-twitch').hidden = b <= 1;
  if (b > 1) $('#buff-twitch-t').textContent = `+${pctTw(b - 1)}%`;
}
async function atualizarTwitch() {
  try { infoTwitch = await rede.twitch(); } catch { return; }
  $('#abrir-twitch').hidden = !infoTwitch.ativo;
  aplicarTwitch(infoTwitch.bonus, infoTwitch.lives);
  if (esperandoTwitch && infoTwitch.ligado) { esperandoTwitch = false; log(t('Sua conta da Twitch {nome} está ligada ao LoL Idle.', { nome: infoTwitch.ligado.nome || infoTwitch.ligado.login })); }
  if (!$('#janela-twitch').hidden) desenharTwitch();
}
function desenharTwitch() {
  const d = infoTwitch;
  if (!d) { $('#twitch-corpo').innerHTML = `<p class="fraco">${t('Carregando…')}</p>`; return; }
  const n = d.lives?.length || 0;
  // cada live a mais rende "decai" × a anterior (a mesma conta do servidor); o total nunca passa do limite
  const dec = d.decai ?? 1, bonusN = (k) => d.base + (dec < 1 ? d.porLive * (1 - dec ** (k - 1)) / (1 - dec) : d.porLive * (k - 1)), limite = dec < 1 ? d.base + d.porLive / (1 - dec) : 0;
  const faixas = [1, 2, 3].map((k) => `<div class="tw-faixa${n === k ? ' agora' : ''}"><b>+${pctTw(bonusN(k))}%</b><small>${k === 1 ? t('1 live') : t('{n} lives', { n: k })}</small></div>`).join('<i>›</i>')
    + `<i>›</i><div class="tw-faixa${n >= 4 ? ' agora' : ''}"><b>${limite ? t('até +{p}%', { p: pctTw(limite) }) : t('+{p}% cada', { p: pctTw(d.porLive) })}</b><small>${t('4 lives ou mais')}</small></div>`;
  let estadoConta;
  if (d.convidado) estadoConta = `<p class="alerta">${t('O bônus da Twitch é para quem tem conta: salve seu progresso (crie a conta) e volte aqui.')}</p><button type="button" class="botao principal" id="abrir-salvar">${t('Salvar meu progresso')}</button>`;
  else if (!d.ligado) estadoConta = `<button type="button" class="botao tw-ligar" data-twitch-ligar>${ICONE_TWITCH} ${t('Ligar a Twitch')}</button>`;
  else estadoConta = `<div class="tw-conta"><span>${ICONE_TWITCH} ${t('Ligada como {nome}', { nome: `<b>${escG(d.ligado.nome || d.ligado.login)}</b>` })}</span><button type="button" class="tw-desligar" data-twitch-desligar>${t('Desligar')}</button></div>
      ${n ? `<p class="tw-status ok">✓ ${t('Bônus ativo: +{p}% de XP. Você está assistindo a {lives}.', { p: pctTw(d.bonus - 1), lives: d.lives.map((l) => `<b>${escG(d.canais.find((c) => c.login === l)?.nome || l)}</b>`).join(', ') })}</p>`
        : `<p class="tw-status">${t('Sem bônus agora. Abra uma live oficial ao vivo, logado na Twitch: o bônus entra em até 2 minutos.')}</p>`}`;
  const linha = (c) => `<a class="tw-canal${c.aoVivo ? ' vivo' : ''}${d.lives?.includes(c.login) ? ' meu' : ''}" href="https://www.twitch.tv/${encodeURIComponent(c.login)}" target="_blank" rel="noopener" title="${escG(c.titulo || '')}">
      ${c.foto ? `<img src="${escG(c.foto)}" alt="" loading="lazy">` : `<span class="tw-sem-foto">${ICONE_TWITCH}</span>`}
      <span class="tw-nome"><b>${escG(c.nome || c.login)}</b>${c.aoVivo && c.jogo ? `<small>${escG(c.jogo)}</small>` : ''}</span>
      ${c.bonusAtivo ? `<em class="tw-selo">⚡ ${t('Bônus ativado')}</em>` : ''}
      ${d.lives?.includes(c.login) ? `<em class="tw-selo meu">✓ ${t('Assistindo')}</em>` : ''}
      ${c.aoVivo ? `<span class="tw-esp" title="${t('Espectadores')}">👤 ${fmt(c.espectadores)}</span><span class="tw-ao-vivo">${t('Ao vivo')}</span>` : `<span class="tw-off">${t('Offline')}</span>`}</a>`;
  const vivos = d.canais.filter((c) => c.aoVivo), off = d.canais.filter((c) => !c.aoVivo);
  $('#twitch-corpo').innerHTML = `
    <div class="tw-topo">
      <div class="tw-grande">${ICONE_TWITCH}<b>+${pctTw(d.base)}%</b></div>
      <p>${t('Ligue a sua conta da Twitch e assista, logado, a uma live oficial do LoL Idle: você ganha +{p}% de XP enquanto assiste. Cada live oficial a mais ao mesmo tempo soma um pouco (+{q}% na segunda, e cada uma rende menos que a anterior).', { p: pctTw(d.base), q: pctTw(d.porLive) })}</p>
      <div class="tw-faixas">${faixas}</div>
    </div>
    ${estadoConta}
    <p class="tw-nota">${t('Assista logado na Twitch: é pelo chat da live que a gente te encontra (não precisa escrever nada). Vale com o jogo aberto.')}</p>
    <h4 class="tw-titulo">${t('Canais oficiais')}</h4>
    ${vivos.length ? `<div class="tw-lista">${vivos.map(linha).join('')}</div>` : `<p class="fraco tw-ninguem">${t('Nenhuma live oficial no ar agora. Volte mais tarde!')}</p>`}
    ${off.length ? `<details class="tw-offline"><summary>${t('Canais offline ({n})', { n: off.length })}</summary><div class="tw-lista">${off.map(linha).join('')}</div></details>` : ''}
    ${d.bot ? `<div class="tw-mod"><p>${t('Para ativar o bônus na sua live, dê moderador para a conta do jogo (como se faz com o Nightbot). O comando é:')}</p><button type="button" class="tw-comando" data-twitch-copiar="/mod ${escG(d.bot)}"><code>/mod ${escG(d.bot)}</code><small>${t('Copiar')}</small></button></div>` : ''}
    <div class="tw-parceiro">
      <span class="tw-parceiro-ic">${ICONE_TWITCH}</span>
      <div><em>${t('Vagas abertas')}</em><b>${t('Quer ser streamer parceiro do LoL Idle?')}</b><p>${t('Sua live entra na lista oficial e dá +{p}% de XP para quem assistir. Chama a gente no Discord!', { p: pctTw(d.base) })}</p></div>
      ${d.discord ? `<a class="botao dc-botao" href="${escG(d.discord)}" target="_blank" rel="noopener">Discord</a>` : ''}
    </div>
    <h4 class="tw-titulo">${t('Como funciona')}</h4>
    <ol class="tw-passos">
      <li>${t('Clique em Ligar a Twitch e autorize com a sua conta da Twitch.')}</li>
      <li>${t('Abra uma live oficial que esteja ao vivo, logado na mesma conta.')}</li>
      <li>${t('Em até 2 minutos o bônus aparece no seu cartão e vale enquanto você assiste, com o jogo aberto.')}</li>
      <li>${t('Cada conta da Twitch vale para um personagem por vez.')}</li>
    </ol>`;
}
async function abrirTwitch() {
  $('#janela-twitch').hidden = false;
  desenharTwitch();
  await atualizarTwitch();
}
$('#abrir-twitch').addEventListener('click', abrirTwitch);
$('#buff-twitch').addEventListener('click', abrirTwitch);
$('#janela-twitch').addEventListener('click', async (e) => {
  if (e.target.id === 'abrir-salvar') { $('#janela-twitch').hidden = true; return; }
  const cp = e.target.closest('[data-twitch-copiar]');
  if (cp) { try { await navigator.clipboard.writeText(cp.dataset.twitchCopiar); cp.querySelector('small').textContent = t('Copiado!'); } catch {} return; }
  if (e.target.closest('[data-twitch-desligar]')) {
    if (!(await confirmar(t('Desligar a conta da Twitch deste personagem? O bônus para na hora.')))) return;
    try { await rede.desligarTwitch(); } catch (falha) { avisar(t(falha.message)); }
    await atualizarTwitch(); return;
  }
  const b = e.target.closest('[data-twitch-ligar]');
  if (!b) return;
  // abre a aba antes do pedido (senão o navegador bloqueia a janela) e depois manda para a Twitch
  const aba = window.open('about:blank', '_blank');
  b.disabled = true;
  try {
    const { url } = await rede.ligarTwitch();
    esperandoTwitch = true;
    if (aba) aba.location.href = url; else location.href = url;
  } catch (falha) { aba?.close(); avisar(t(falha.message)); }
  finally { b.disabled = false; }
});
// voltou da aba da Twitch: confere a ligação; com a janela aberta, atualiza a lista a cada 30 s
addEventListener('focus', () => { if (esperandoTwitch) atualizarTwitch(); });
setInterval(() => { if (!$('#janela-twitch').hidden && !document.hidden) atualizarTwitch(); }, 30000);
setTimeout(atualizarTwitch, 5000);

// ---------- voto no TopIdle (servidor/topidle.js): quem vota no LoL Idle ganha +10% de XP por 4 h ----------
// O servidor manda { resta, proximo, link, bonus, horas } no save e no GET /api/voto; o jogo conta para baixo.
var votoInfo = null, votoAte = 0, votoClicou = 0;
function votoAtivo() { return votoAte > Date.now(); }
function aplicarVoto(v) {
  if (!v || !v.link) return;
  const ms = Math.max(0, Number(v.resta) || 0), novo = ms > 0 ? Date.now() + ms : 0;
  // o voto chegou agora (o bônus apareceu ou cresceu)
  if (votoInfo && novo - Math.max(votoAte, Date.now()) > 20 * 60000) {
    cena.aviso(t('Voto confirmado! +{p}% de XP por {h} h', { p: Math.round(v.bonus * 100), h: v.horas }), '#ff8a2b');
    log(t('Obrigado por votar no LoL Idle! Você ganhou +{p}% de XP por {h} horas.', { p: Math.round(v.bonus * 100), h: v.horas }), 'raro');
    som.efeito('raro');
    votoClicou = 0;
  }
  votoInfo = { ...v, proximoEm: Date.now() + Math.max(0, Number(v.proximo) || 0) };
  votoAte = novo;
  aplicarBonusLive();
}
function linhaVoto() {
  const bv = $('#buff-voto');
  if (!bv) return;
  bv.hidden = !votoAtivo();
  if (votoAtivo()) $('#buff-voto-t').textContent = `+${Math.round(votoInfo.bonus * 100)}% · ${tempoKick(votoAte - Date.now())}`;
}
// o botão na fileira das redes: brilha quando dá para votar, mostra o tempo do bônus ou quanto falta para o próximo voto
function botaoVoto() {
  const b = $('#abrir-voto');
  if (!b) return;
  b.hidden = !votoInfo;
  if (!votoInfo) return;
  const ativo = votoAtivo(), espera = !ativo && votoInfo.proximoEm > Date.now(), p = Math.round(votoInfo.bonus * 100);
  const selo = ativo ? tempoKick(votoAte - Date.now()) : espera ? tempoKick(votoInfo.proximoEm - Date.now()) : t('+{p}% XP', { p });
  const em = b.querySelector('em'); if (em.textContent !== selo) em.textContent = selo;
  b.classList.toggle('pode', !ativo && !espera);
  b.classList.toggle('ativo', ativo);
  b.classList.toggle('espera', espera);
  const dica = ativo ? t('Bônus do voto ativo: +{p}% de XP por mais {tempo}.', { p, tempo: tempoKick(votoAte - Date.now()) })
    : espera ? t('Você já votou. Dá para votar de novo no TopIdle em {tempo}.', { tempo: tempoKick(votoInfo.proximoEm - Date.now()) })
    : t('Vote no LoL Idle no TopIdle e ganhe +{p}% de XP por {h} h', { p, h: votoInfo.horas });
  if (b.dataset.dica !== dica) { b.title = dica; b.dataset.dica = dica; }
}
function abrirVoto() {
  if (!votoInfo) return;
  if (votoAtivo()) { log(t('Bônus do voto ativo: +{p}% de XP por mais {tempo}.', { p: Math.round(votoInfo.bonus * 100), tempo: tempoKick(votoAte - Date.now()) })); return; }
  if (votoInfo.proximoEm > Date.now()) { log(t('Você já votou. Dá para votar de novo no TopIdle em {tempo}.', { tempo: tempoKick(votoInfo.proximoEm - Date.now()) })); return; }
  votoClicou = Date.now();
  window.open(votoInfo.link, '_blank', 'noopener');
  log(t('Abrimos o TopIdle em outra aba: confirme que você é humano e o voto conta. O bônus de XP chega sozinho em instantes.'));
  rastreioVoto(); botaoVoto();
}
$('#abrir-voto').addEventListener('click', (e) => { e.currentTarget.blur(); abrirVoto(); });
function rastreioVoto() {
  const b = $('#rastreio-voto');
  if (!b) return;
  const pode = votoInfo && estado.nivel >= 5 && !votoAtivo() && votoInfo.proximoEm <= Date.now();
  b.hidden = !votoAtivo() && !pode;
  if (b.hidden) return;
  const html = votoAtivo()
    ? `<b>🗳 ${t('Bônus do voto +{p}%', { p: Math.round(votoInfo.bonus * 100) })}</b><small>${t('mais {tempo} de XP extra', { tempo: tempoKick(votoAte - Date.now()) })}</small>`
    : `<b>🗳 ${t('Vote no LoL Idle')}</b><small>${votoClicou ? t('Terminou de votar? O bônus chega em instantes.') : t('Ganhe +{p}% de XP por {h} h · clique', { p: Math.round(votoInfo.bonus * 100), h: votoInfo.horas })}</small>`;
  if (b.dataset.html !== html) { b.dataset.html = html; b.innerHTML = html; }
  b.classList.toggle('ativo', votoAtivo());
}
async function atualizarVoto() {
  try { const v = await rede.voto(); if (v?.ativo) aplicarVoto(v); } catch {}
}
$('#rastreio-voto').addEventListener('click', (e) => {
  e.currentTarget.blur();
  if (!votoAtivo()) abrirVoto();
});
// voltou da aba do TopIdle: confere o voto algumas vezes (o aviso do TopIdle chega em segundos)
addEventListener('focus', () => { if (votoClicou && Date.now() - votoClicou < 15 * 60000) for (const ms of [2000, 8000, 20000]) setTimeout(atualizarVoto, ms); });
setInterval(() => {
  if (votoAte && !votoAtivo()) { votoAte = 0; aplicarBonusLive(); log(t('O bônus do voto acabou. Dá para votar de novo no TopIdle a cada 18 horas.')); }
  linhaVoto(); rastreioVoto(); botaoVoto();
}, 1000);
setTimeout(atualizarVoto, 6000);

// ---------- Kick: os pontos do canal das lives oficiais viram horas de bônus de XP (servidor/kick.js) ----------
// O servidor diz quanto falta (resta, em ms); o jogo conta para baixo. O bônus soma com o da Twitch (teto de +50% no motor).
let infoKick = null, esperandoKick = false, kickAte = 0, kickConhecido = false;
// ---------- guilda: +1% de XP por membro online, até +4% (o servidor conta e manda no save; só XP) ----------
let bonusGuildaAtual = 1;
function aplicarGuilda(b) {
  const v = Math.min(1.04, Math.max(1, Number(b) || 1)), p = Math.round((v - 1) * 100);
  if (v > 1 && bonusGuildaAtual <= 1) log(t('Bônus da guilda ativo: +{p}% de XP (1% por membro online, até 4%).', { p }), 'raro');
  bonusGuildaAtual = v; aplicarBonusLive();
  $('#buff-guilda').hidden = v <= 1;
  if (v > 1) $('#buff-guilda-t').textContent = `+${p}%`;
}
const ICONE_KICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 2h6v6h3V5h3V2h6v6h-3v3h-3v2h3v3h3v6h-6v-3h-3v-3H9v6H3z"/></svg>';
const kickAtivo = () => kickAte > Date.now();
function tempoKick(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? t('{h} h {m} min', { h, m }) : t('{h} h', { h })) : t('{m} min', { m });
}
function aplicarBonusLive() {
  const k = kickAtivo() ? 1 + (infoKick?.bonus ?? 0.15) : 1;
  M.usarBonusTwitch(Math.min(1.5, 1 + (bonusTwAtual - 1) + (k - 1) + (bonusGuildaAtual - 1) + (votoAtivo() ? votoInfo.bonus : 0)));
  const bt = $('#abrir-kick'), ativo = k > 1;
  bt.classList.toggle('ativo', ativo);
  bt.querySelector('em').textContent = t('+{p}% XP', { p: pctTw(infoKick?.bonus ?? 0.15) });
  $('#buff-kick').hidden = !ativo;
  if (ativo) $('#buff-kick-t').textContent = `+${pctTw(k - 1)}% · ${tempoKick(kickAte - Date.now())}`;
}
function aplicarKick(resta) {
  if (resta == null) return;
  // sem bônus o servidor manda 0: fica 0 (antes virava "vence agora" e o aviso de que acabou repetia a cada save)
  const ms = Math.max(0, Number(resta) || 0), novo = ms > 0 ? Date.now() + ms : 0, antes = Math.max(kickAte, Date.now());
  // ganhou horas (resgatou na live): avisa. Na primeira leitura só guarda.
  if (kickConhecido && novo - antes > 20 * 60000) {
    cena.aviso(t('Resgate na Kick: +{p}% de XP por mais {tempo}', { p: pctTw(infoKick?.bonus ?? 0.15), tempo: tempoKick(novo - Date.now()) }), '#53fc18');
    log(t('Resgate na Kick confirmado: o bônus de +{p}% de XP vale por mais {tempo}.', { p: pctTw(infoKick?.bonus ?? 0.15), tempo: tempoKick(novo - Date.now()) }), 'raro');
    som.efeito('raro');
  }
  kickConhecido = true; kickAte = novo;
  $('#abrir-kick').hidden = false;        // o servidor só manda o tempo da Kick com ela ligada no jogo
  aplicarBonusLive();
}
// a cada segundo: o tempo da linha do bônus e o fim do bônus
setInterval(() => {
  if (!kickAte) return;
  if (!kickAtivo()) { kickAte = 0; aplicarBonusLive(); log(t('O bônus da Kick acabou. Resgate de novo nos pontos do canal de uma live oficial para ganhar mais horas.')); if (!$('#janela-kick').hidden) desenharKick(); return; }
  $('#buff-kick-t').textContent = `+${pctTw(infoKick?.bonus ?? 0.15)}% · ${tempoKick(kickAte - Date.now())}`;
}, 1000);
async function atualizarKick() {
  try { infoKick = await rede.kick(); } catch { return; }
  $('#abrir-kick').hidden = !infoKick.ativo;
  aplicarKick(infoKick.resta);
  if (esperandoKick && infoKick.ligado) { esperandoKick = false; log(t('Sua conta da Kick {nome} está ligada ao LoL Idle.', { nome: infoKick.ligado.nome })); }
  if (!$('#janela-kick').hidden) desenharKick();
}
function desenharKick() {
  const d = infoKick;
  if (!d) { $('#kick-corpo').innerHTML = `<p class="fraco">${t('Carregando…')}</p>`; return; }
  const p = pctTw(d.bonus), rec = `<b>${escG(d.recompensa)}</b>`;
  let estadoConta;
  if (d.convidado) estadoConta = `<p class="alerta">${t('O bônus da Kick é para quem tem conta: salve seu progresso (crie a conta) e volte aqui.')}</p><button type="button" class="botao principal" id="abrir-salvar">${t('Salvar meu progresso')}</button>`;
  else if (!d.ligado) estadoConta = `<button type="button" class="botao kk-ligar" data-kick-ligar>${ICONE_KICK} ${t('Ligar a Kick')}</button>
      <p class="kk-aviso">${t('Ligue antes de resgatar: resgate de quem não ligou a Kick no jogo é recusado.')}</p>`;
  else estadoConta = `<div class="tw-conta"><span>${ICONE_KICK} ${t('Ligada como {nome}', { nome: `<b>${escG(d.ligado.nome)}</b>` })}</span><button type="button" class="tw-desligar" data-kick-desligar>${t('Desligar')}</button></div>
      ${kickAtivo() ? `<p class="tw-status ok">✓ ${t('Bônus ativo: +{p}% de XP por mais {tempo}.', { p, tempo: `<b>${tempoKick(kickAte - Date.now())}</b>` })}</p>`
        : `<p class="tw-status">${t('Sem bônus agora. Numa live oficial, resgate {rec} nos pontos do canal: o bônus entra em até 1 minuto.', { rec })}</p>`}
      ${d.resgates?.length ? `<p class="kk-resgates">${t('Seus últimos resgates:')} ${d.resgates.map((r) => `${escG(d.canais.find((c) => c.slug === r.canal)?.nome || r.canal)} <small>(${t('há {tempo}', { tempo: tempoKick(r.ha) })})</small>`).join(', ')}</p>` : ''}`;
  const linha = (c) => `<a class="tw-canal${c.aoVivo ? ' vivo' : ''}" href="https://kick.com/${encodeURIComponent(c.slug)}" target="_blank" rel="noopener" title="${escG(c.titulo || '')}">
      ${c.foto ? `<img src="${escG(c.foto)}" alt="" loading="lazy">` : `<span class="tw-sem-foto">${ICONE_KICK}</span>`}
      <span class="tw-nome"><b>${escG(c.nome || c.slug)}</b>${c.aoVivo && c.categoria ? `<small>${escG(c.categoria)}</small>` : ''}</span>
      ${c.pontos ? `<em class="tw-selo kk-selo">${t('Pontos ativos')}</em>` : ''}
      ${c.aoVivo ? `<span class="tw-esp" title="${t('Espectadores')}">👤 ${fmt(c.espectadores)}</span><span class="tw-ao-vivo">${t('Ao vivo')}</span>` : `<span class="tw-off">${t('Offline')}</span>`}</a>`;
  const vivos = d.canais.filter((c) => c.aoVivo), off = d.canais.filter((c) => !c.aoVivo);
  $('#kick-corpo').innerHTML = `
    <div class="tw-topo kk-topo">
      <div class="tw-grande kk-grande">${ICONE_KICK}<b>+${p}%</b></div>
      <p>${t('Assista às lives oficiais na Kick, junte os pontos do canal e troque pela recompensa {rec}: cada resgate vale {h} hora de +{p}% de XP no jogo.', { rec, h: d.horas, p })}</p>
      <div class="kk-recompensa"><span class="kk-rec-ic">${ICONE_KICK}</span><div><b>${escG(d.recompensa)}</b><small>${t('{n} pontos do canal · {h} h por resgate', { n: fmt(d.custo), h: d.horas })}</small></div></div>
      <p class="kk-somam">⏱ ${t('As horas se somam: resgatar 3 vezes, no mesmo canal ou em canais diferentes, dá 3 horas de bônus (até {teto} h guardadas). Soma também com o bônus da Twitch.', { teto: d.tetoHoras })}</p>
    </div>
    ${estadoConta}
    <h4 class="tw-titulo">${t('Canais oficiais na Kick')}</h4>
    ${vivos.length ? `<div class="tw-lista">${vivos.map(linha).join('')}</div>` : `<p class="fraco tw-ninguem">${d.canais.length ? t('Nenhuma live oficial no ar agora. Volte mais tarde!') : t('Os primeiros canais oficiais na Kick estão chegando. Volte em breve!')}</p>`}
    ${off.length ? `<details class="tw-offline"><summary>${t('Canais offline ({n})', { n: off.length })}</summary><div class="tw-lista">${off.map(linha).join('')}</div></details>` : ''}
    <div class="tw-parceiro kk-parceiro">
      <span class="tw-parceiro-ic">${ICONE_KICK}</span>
      <div><em>${t('Vagas abertas')}</em><b>${t('Quer ser streamer parceiro do LoL Idle na Kick?')}</b><p>${t('Seu canal entra na lista oficial e os pontos dele viram +{p}% de XP para quem assistir. Chama a gente no Discord!', { p })}</p></div>
      ${d.discord ? `<a class="botao dc-botao" href="${escG(d.discord)}" target="_blank" rel="noopener">Discord</a>` : ''}
    </div>
    <h4 class="tw-titulo">${t('Como funciona')}</h4>
    <ol class="tw-passos">
      <li>${t('Clique em Ligar a Kick e autorize com a sua conta da Kick.')}</li>
      <li>${t('Assista a uma live oficial logado na Kick: você junta os pontos do canal.')}</li>
      <li>${t('Nos pontos do canal, resgate {rec} ({n} pontos).', { rec, n: fmt(d.custo) })}</li>
      <li>${t('Em até 1 minuto o bônus aparece no seu cartão, com {h} hora por resgate. Vale com o jogo aberto.', { h: d.horas })}</li>
      <li>${t('Cada conta da Kick vale para um personagem por vez: o bônus vai para o personagem ligado.')}</li>
    </ol>`;
}
async function abrirKick() {
  $('#janela-kick').hidden = false;
  desenharKick();
  await atualizarKick();
}
$('#abrir-kick').addEventListener('click', abrirKick);
$('#buff-kick').addEventListener('click', abrirKick);
$('#janela-kick').addEventListener('click', async (e) => {
  if (e.target.id === 'abrir-salvar') { $('#janela-kick').hidden = true; return; }
  if (e.target.closest('[data-kick-desligar]')) {
    if (!(await confirmar(t('Desligar a conta da Kick deste personagem? As horas de bônus que ele já tem continuam valendo, mas os próximos resgates serão recusados até você ligar de novo.')))) return;
    try { await rede.desligarKick(); } catch (falha) { avisar(t(falha.message)); }
    await atualizarKick(); return;
  }
  const b = e.target.closest('[data-kick-ligar]');
  if (!b) return;
  // abre a aba antes do pedido (senão o navegador bloqueia a janela) e depois manda para a Kick
  const aba = window.open('about:blank', '_blank');
  b.disabled = true;
  try {
    const { url } = await rede.ligarKick();
    esperandoKick = true;
    if (aba) aba.location.href = url; else location.href = url;
  } catch (falha) { aba?.close(); avisar(t(falha.message)); }
  finally { b.disabled = false; }
});
addEventListener('focus', () => { if (esperandoKick) atualizarKick(); });
setInterval(() => { if (!$('#janela-kick').hidden && !document.hidden) atualizarKick(); }, 30000);
setTimeout(atualizarKick, 5500);

$('#janela-ganhos').addEventListener('click', async (e) => {
  if (e.target.id === 'gn-copiar') {
    const campo = $('#gn-link'); campo.select();
    try { await navigator.clipboard.writeText(campo.value); } catch { document.execCommand?.('copy'); }
    e.target.textContent = t('Copiado!'); setTimeout(() => { if (e.target.isConnected) e.target.textContent = t('Copiar link'); }, 1800);
  }
  if (e.target.id === 'abrir-salvar') { $('#janela-ganhos').hidden = true; }
});
$('#janela-ganhos').addEventListener('submit', async (e) => {
  if (e.target.id !== 'gn-saque') return;
  e.preventDefault();
  const b = e.target.querySelector('button'); b.disabled = true; $('#gn-erro').textContent = '';
  try {
    const r = await rede.pedirSaque($('#gn-nome').value, $('#gn-chave').value);
    log(t('Saque de {valor} pedido. O PIX é feito em até 7 dias.', { valor: reais(r.valor, ingles) }), 'raro'); som.efeito('moeda');
    abrirGanhos();
  } catch (falha) { $('#gn-erro').textContent = t(falha.message); b.disabled = false; }
});

// ---------- Gema: a moeda com lastro em USDT (js/orbs.js) ----------
// Só entra por depósito de USDT (rede Solana) e só sai em USDT. Todo número vem do servidor.
let abaOrbs = 'depositar', dadosOrbs = null;
function mostrarOrbs() { const el = $('#orbs-saldo'), v = fmt(orbs); if (el && el.textContent !== v) el.textContent = v; }
mostrarOrbs();
const NOME_MOV = { deposito: 'Depósito', saque: 'Saque', saque_estorno: 'Saque devolvido', venda: 'Venda no mercado', compra: 'Compra no mercado' };
const STATUS_SAQUE = { aguardando: 'esperando envio', pago: 'enviado', recusado: 'recusado (as Gemas voltaram)', cancelado: 'cancelado (as Gemas voltaram)' };
const explorador = (tipo, v) => `https://solscan.io/${tipo}/${encodeURIComponent(v)}`;
async function abrirCarteira(aba) {
  if (aba) abaOrbs = aba;
  $('#janela-orbs').hidden = false;
  try { dadosOrbs = await rede.orbs(); orbs = dadosOrbs.saldo; mostrarOrbs(); }
  catch (e) { $('#orbs-corpo').innerHTML = `<p class="alerta">${esc(e.message)}</p>`; return; }
  desenharCarteira();
}
function desenharCarteira() {
  const o = dadosOrbs, R = o.regras;
  const abas = [['depositar', t('Depositar')], ['sacar', t('Sacar')], ['extrato', t('Extrato')], ['caixa', t('Transparência')]]
    .map(([k, n]) => `<button type="button" class="botao aba${abaOrbs === k ? ' ativa' : ''}" data-orbs-aba="${k}">${n}</button>`).join('');
  const risco = `<div class="ob-risco"><b>${t('Antes de mexer com dinheiro de verdade, leia:')}</b>
    <p>${t('O jogo permite vender itens para outros jogadores por valor real: é para isso que a Gema existe. Usar a Gema não quebra nenhuma regra.')}</p>
    <p>${t('O projeto não se responsabiliza por golpes entre jogadores: combinação feita fora do mercado do jogo, promessa não cumprida ou compra errada não têm como ser desfeitas.')}</p>
    <p>${t('Depósito enviado para um endereço diferente do mostrado aqui, ou saque pedido para uma carteira errada, é dinheiro perdido: transação em blockchain não tem estorno. Confira o endereço e a rede antes de confirmar.')}</p></div>`;
  let corpo = '';
  if (abaOrbs === 'depositar') {
    const meu = o.deposito.meu, alvo = meu || o.deposito.projeto;
    corpo = `<div class="ob-alerta">⚠ ${t('NÃO ENVIE A MOEDA SOL')} ⚠<small>${t('Envie USDT usando a rede Solana. A moeda SOL não vira Gema.')}</small></div>`
      + (!alvo ? `<p class="alerta">${t('Os depósitos ainda não estão abertos. Volte daqui a pouco.')}</p>` : `
      <div class="ob-conv">
        <label><small>${t('Você paga')}</small><span><input id="ob-usdt" type="number" min="1" step="1" value="10"><em>USDT</em></span></label>
        <span class="ob-seta" aria-hidden="true">↓</span>
        <label><small>${t('Você recebe')}</small><span><b id="ob-gemas">${fmt(Math.floor(10 / R.compra + 1e-9))}</b><em>💠 ${t('Gemas')}</em></span></label>
        <small class="fraco">${t('{preco} USDT por Gema · rede Solana (SPL)', { preco: R.compra.toFixed(4) })}</small>
      </div>
      <div class="ob-end-rotulo">${meu ? t('Seu endereço de depósito') : t('Endereço do projeto')}</div>
      <div class="ob-end"><code id="ob-end">${esc(alvo)}</code><button type="button" class="botao" data-orbs-copiar="ob-end">${t('Copiar endereço')}</button></div>
      ${meu ? `<small class="fraco">${t('Este endereço é só seu. Mande USDT de qualquer carteira ou corretora (Binance e outras): o valor cai na sua conta sozinho, em alguns minutos.')}</small>`
        : `<div class="ob-alerta pequeno">${t('Escreva este código no campo "memo" da transferência; sem ele não dá para saber que o depósito é seu:')} <code id="ob-memo">${esc(o.referencia)}</code> <button type="button" class="link" data-orbs-copiar="ob-memo">${t('Copiar')}</button></div>`}
      <button type="button" class="botao principal" data-orbs-verificar>${t('Já enviei: conferir agora')}</button>`) + risco;
  } else if (abaOrbs === 'sacar') {
    const aberto = o.saques.find((x) => x.status === 'aguardando'), q0 = Math.max(R.saqueMin, Math.floor(o.saldo / 100) * 100);
    corpo = (o.convidado ? '' : aberto
      ? `<p class="ob-info">${t('Seu saque de {gemas} 💠 ({usdt} USDT) está esperando o envio. Sai em até 2 dias.', { gemas: fmt(aberto.orbs), usdt: usd(aberto.usdt) })}</p><button type="button" class="botao" data-orbs-cancelar="${aberto.id}">${t('Cancelar o saque')}</button>`
      : `<form id="ob-saque" class="ob-saque" novalidate>
        <label>${t('Quantas Gemas')} <input id="ob-qtd" type="number" min="${R.saqueMin}" step="100" value="${q0}"></label>
        <p class="ob-recebe">${t('Você recebe')} <b id="ob-usdt-saque">${usd(q0 * R.saque)}</b> USDT</p>
        <label>${t('Endereço da sua carteira (rede Solana)')} <input id="ob-carteira" autocomplete="off" spellcheck="false" placeholder="${t('Cole aqui o endereço')}"></label>
        <small class="alerta" id="ob-carteira-erro"></small>
        <label class="ob-aceite"><input type="checkbox" id="ob-aceite"> ${t('Li o aviso abaixo e conferi que o endereço é da rede Solana.')}</label>
        <button type="submit" class="botao principal" ${o.saldo >= R.saqueMin ? '' : 'disabled'}>${t('Pedir saque')}</button>
        <small class="fraco">${t('Saque mínimo de {min} Gemas ({usd}). A equipe confere e envia em até 2 dias; a taxa da rede é por conta do projeto.', { min: fmt(R.saqueMin), usd: usd(R.saqueMin * R.saque) })}</small>
        <p class="alerta" id="ob-erro"></p></form>`)
      + (o.saques.length ? `<ul class="gn-hist">${o.saques.map((x) => `<li><span>${t('Saque')} · ${dataCurta(x.criado)}</span><b>${fmt(x.orbs)} 💠 · ${usd(x.usdt)}</b><small class="gn-st ${x.status}">${t(STATUS_SAQUE[x.status])}${x.tx ? ` · <a href="${explorador('tx', x.tx)}" target="_blank" rel="noopener">${t('ver na rede')}</a>` : ''}${x.obs && x.status === 'recusado' ? ' · ' + esc(x.obs) : ''}</small></li>`).join('')}</ul>` : '') + risco;
  } else if (abaOrbs === 'extrato') {
    corpo = o.extrato.length ? `<ul class="gn-hist">${o.extrato.map((m) => `<li><span>${t(NOME_MOV[m.tipo] || m.tipo)} · ${dataCurta(m.criado)}</span><b class="${m.orbs > 0 ? 'ob-mais' : 'ob-menos'}">${m.orbs > 0 ? '+' : ''}${fmt(m.orbs)} 💠</b><small>${m.usdt != null ? usd(m.usdt) + ' USDT' : esc(m.ref || '')}</small></li>`).join('')}</ul>`
      : `<p class="fraco">${t('Nada ainda. Deposite USDT ou venda um item no mercado por Gemas.')}</p>`;
  } else {
    const c = o.caixa, dinheiro = (v) => '$' + (Number(v) || 0).toLocaleString(ingles ? 'en-US' : 'pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const cartao = (ico, nome, valor, explica, cls = '') => `<div class="ob-cx${cls}"><span class="ob-cx-ico" aria-hidden="true">${ico}</span><div><small>${nome}</small><b>${valor}</b><em>${explica}</em></div></div>`;
    corpo = `<p class="ob-cx-intro">${t('Este é o dinheiro de verdade do sistema de Gemas. Todo USDT depositado fica na carteira pública do projeto, e qualquer pessoa pode conferir na rede Solana.')}</p>
      ${c.carteira ? `<div class="ob-end"><code>${esc(c.carteira)}</code><a class="botao" href="${explorador('account', c.carteira)}" target="_blank" rel="noopener">${t('Conferir na rede')}</a></div>` : ''}
      <div class="ob-caixa">
        ${c.naCarteira != null ? cartao('🏦', t('Na carteira agora'), dinheiro(c.naCarteira), t('saldo real, lido da rede Solana'), ' destaque') : ''}
        ${cartao('⬇', t('Depositado pelos jogadores'), dinheiro(c.depositado), t('todo USDT que já entrou'))}
        ${cartao('⬆', t('Pago em saques'), dinheiro(c.sacado), t('enviado para as carteiras dos jogadores'))}
        ${cartao('⏳', t('Saques na fila'), dinheiro(c.aguardando), t('pedidos esperando o envio'))}
        ${cartao('💠', t('Gemas com os jogadores'), dinheiro(c.orbsEmJogo * R.saque), t('{n} Gemas, que podem virar saque', { n: c.orbsEmJogo.toLocaleString(ingles ? 'en-US' : 'pt-BR') }))}
        ${cartao('⚖', t('Lucro do projeto (taxas)'), dinheiro(c.taxasOrbs * R.saque), t('taxa das vendas no mercado'))}
      </div>
      <p class="fraco ob-cx-nota">${t('O dinheiro dos jogadores (Gemas e saques na fila) nunca é gasto: só as taxas do mercado são do projeto, e pagam as tarifas da rede.')}</p>`;
  }
  let viu = false; try { viu = localStorage.getItem('lolidle-gemas-tutorial') === '1'; } catch {}
  const tutorial = o.tutorial ? `<a class="ob-tutorial${viu ? '' : ' novo'}" href="${esc(o.tutorial)}" target="_blank" rel="noopener" data-orbs-tutorial>
      <span class="ob-tut-ico" aria-hidden="true">?</span><span><b>${t('Primeira vez com Gemas?')}</b><small>${t('Veja o passo a passo de como depositar, vender e sacar (canal no Discord)')}</small></span><i aria-hidden="true">↗</i></a>` : '';
  $('#orbs-corpo').innerHTML = `${tutorial}<div class="ob-saldo"><span>${t('Seu saldo')}</span><b>${fmt(o.saldo)} 💠</b><small>≈ ${usd(o.saldo * R.saque)}</small></div>
    <div class="ob-abas" role="tablist">${abas}</div>${corpo}`;
}
$('#abrir-orbs').addEventListener('click', () => abrirCarteira());
$('#janela-orbs').addEventListener('click', (e) => { const a = e.target.closest('[data-orbs-tutorial]'); if (a) { try { localStorage.setItem('lolidle-gemas-tutorial', '1'); } catch {} a.classList.remove('novo'); } });
$('#janela-orbs').addEventListener('input', (e) => {
  const R = dadosOrbs?.regras; if (!R) return;
  if (e.target.id === 'ob-usdt') $('#ob-gemas').textContent = fmt(Math.floor(Math.max(0, +e.target.value || 0) / R.compra + 1e-9));
  if (e.target.id === 'ob-qtd') $('#ob-usdt-saque').textContent = usd(Math.max(0, Math.floor(+e.target.value || 0)) * R.saque);
  if (e.target.id === 'ob-carteira') $('#ob-carteira-erro').textContent = !e.target.value.trim() || enderecoValido(e.target.value) ? '' : t('Esse não é um endereço de carteira da rede Solana.');
});
$('#janela-orbs').addEventListener('click', async (e) => {
  const aba = e.target.closest('[data-orbs-aba]');
  if (aba) { abaOrbs = aba.dataset.orbsAba; return desenharCarteira(); }
  const cp = e.target.closest('[data-orbs-copiar]');
  if (cp) {
    const txt = $('#' + cp.dataset.orbsCopiar).textContent;
    try { await navigator.clipboard.writeText(txt); } catch {}
    const antes = cp.textContent; cp.textContent = t('Copiado!'); setTimeout(() => { if (cp.isConnected) cp.textContent = antes; }, 1800);
    return;
  }
  if (e.target.closest('[data-orbs-verificar]')) {
    const b = e.target.closest('button'); b.disabled = true; b.textContent = t('Conferindo…');
    const antes = orbs;
    try { const r = await rede.verificarOrbs(); orbs = r.saldo; mostrarOrbs(); }
    catch {}
    if (orbs > antes) { log(t('Depósito recebido: +{n} Gemas!', { n: fmt(orbs - antes) }), 'raro'); som.efeito('moeda'); }
    else cena.aviso(t('Ainda não chegou. A rede leva alguns minutos; o jogo confere sozinho a cada minuto.'), '#c8d8ff');
    return abrirCarteira();
  }
  const canc = e.target.closest('[data-orbs-cancelar]');
  if (canc && await confirmar(t('Cancelar o saque? As Gemas voltam para o seu saldo.'), { titulo: t('Cancelar o saque'), ok: t('Cancelar o saque') })) {
    try { const r = await rede.cancelarSaqueOrbs(+canc.dataset.orbsCancelar); orbs = r.saldo; mostrarOrbs(); } catch (falha) { avisar(t(falha.message)); }
    return abrirCarteira();
  }
});
$('#janela-orbs').addEventListener('submit', async (e) => {
  if (e.target.id !== 'ob-saque') return;
  e.preventDefault();
  const R = dadosOrbs.regras, qtd = Math.floor(+$('#ob-qtd').value || 0), carteira = $('#ob-carteira').value.trim();
  const erro = (m) => { $('#ob-erro').textContent = m; };
  if (qtd < R.saqueMin) return erro(t('O saque mínimo é de {n} Gemas.', { n: fmt(R.saqueMin) }));
  if (qtd > orbs) return erro(t('Você não tem Gemas suficientes.'));
  if (!enderecoValido(carteira)) return erro(t('Esse não é um endereço de carteira da rede Solana.'));
  if (!$('#ob-aceite').checked) return erro(t('Leia e aceite o aviso antes de sacar.'));
  // transferência em blockchain não volta: repete o endereço inteiro antes de pedir
  if (!(await confirmar(t('Sacar {gemas} Gemas = {usdt} USDT para este endereço da rede Solana:\n\n{carteira}\n\nConfira com cuidado: se o endereço estiver errado, o dinheiro se perde.', { gemas: fmt(qtd), usdt: usd(qtd * R.saque), carteira }), { titulo: t('Confirmar o saque'), ok: t('Pedir saque'), perigo: true }))) return;
  const b = e.target.querySelector('button[type=submit]'); b.disabled = true;
  try {
    const r = await rede.sacarOrbs(qtd, carteira, true);
    orbs = r.saldo; mostrarOrbs();
    log(t('Saque de {gemas} Gemas ({usdt} USDT) pedido. A equipe envia em até 2 dias.', { gemas: fmt(qtd), usdt: usd(r.usdt) }), 'raro');
    abrirCarteira();
  } catch (falha) { erro(t(falha.message)); b.disabled = false; }
});

// ---------- compra de diamantes ----------
// três passos: como pagar, quanto (pacote ou valor livre) e o botão de pagar. Em português: PIX ou cartão, em reais;
// em inglês: só cartão, em dólares (o servidor escolhe a mesma moeda pelo idioma)
const compra = { v: null, metodo: null, pacote: 0, livre: 20 };
const ICONE_METODO = {
  pix: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2 14.8 8 8 14.8 1.2 8z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6 11.4 8 8 11.4 4.6 8z" fill="currentColor"/></svg>',
  cartao: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="5.6" width="14" height="2" fill="currentColor"/><rect x="3" y="9.8" width="4" height="1.3" fill="currentColor"/></svg>',
};
const MOEDA = ingles ? 'US$' : 'R$';
const dinheiro = (metodo, valor) => `${MOEDA} ${fmt(valor)}`;
const escolhaCompra = () => {
  const { v, pacote, livre } = compra;
  if (pacote !== 'livre') return v.pacotes[pacote];
  const ok = Number.isInteger(livre) && livre >= v.livre.min && livre <= v.livre.max;
  return ok ? { diamantes: livre * v.livre.porUnidade, valor: livre } : null;
};
function montarCompra(v) {
  compra.v = v;
  if (sessao.convidado) {
    $('#vip-pacotes').innerHTML = `<p>${t('Para comprar diamantes, salve seu progresso antes (crie a conta com email e senha). Assim o que você comprar nunca se perde.')}</p>
      <button type="button" class="botao principal" id="abrir-salvar">${t('Salvar meu progresso')}</button>`;
    return;
  }
  const disp = (ingles ? ['cartao'] : ['pix', 'cartao']).filter((m) => v.metodos[m]);
  if (!disp.length) { $('#vip-pacotes').innerHTML = `<p class="fraco">${t('A compra de diamantes abre em breve. Fique de olho no chat Global!')}</p>`; return; }
  if (!disp.includes(compra.metodo)) compra.metodo = disp[0];
  const DESC = { pix: [t('PIX'), t('Só no Brasil · cai na hora · em reais')], cartao: [t('Cartão'), ingles ? t('Crédito ou débito · qualquer país · em dólar') : t('Crédito ou débito · em reais')] };
  const base = v.livre.porUnidade;
  $('#vip-pacotes').innerHTML = `
    <div class="compra-passo"><span>1</span>${t('Como você quer pagar?')}</div>
    <div class="compra-metodos" role="radiogroup" aria-label="${t('Como você quer pagar?')}">${disp.map((m) => `
      <button type="button" class="compra-metodo" role="radio" data-metodo="${m}">${ICONE_METODO[m]}<b>${DESC[m][0]}</b><small>${DESC[m][1]}</small></button>`).join('')}
    </div>
    <div class="compra-passo"><span>2</span>${t('Quantos diamantes?')}</div>
    <div class="compra-pacotes" role="radiogroup" aria-label="${t('Quantos diamantes?')}">${v.pacotes.map((p, k) => {
      const bonus = Math.round((p.diamantes / (p.valor * base) - 1) * 100), dias = Math.floor(p.diamantes / v.preco) * v.dias;
      return `<button type="button" class="compra-pacote" role="radio" data-pacote="${k}">
        ${p.selo ? `<i class="compra-selo promo">${t(p.selo)}</i>` : bonus > 0 ? `<i class="compra-selo">${t('+{pct}% de bônus', { pct: bonus })}</i>` : ''}
        <span class="cp-qtd">${fmt(p.diamantes)} 💎</span><span class="cp-preco" data-preco="${p.valor}"></span>
        <small>${dias ? t('dá para {dias} dias de VIP', { dias }) : ''}</small></button>`;
    }).join('')}
      <div class="compra-pacote livre" role="radio" data-pacote="livre" tabindex="0">
        <span class="cp-qtd">${t('Outro valor')}</span>
        <label class="cp-livre"><span class="cp-moeda"></span><input type="number" id="compra-livre" inputmode="numeric" min="${v.livre.min}" max="${v.livre.max}" step="1" value="${compra.livre}" aria-label="${t('Valor que você quer pagar')}"></label>
        <small class="cp-livre-qtd"></small>
      </div>
    </div>
    <button type="button" class="botao compra-pagar" data-pagar-agora></button>
    <p class="compra-nota"></p>
    ${v.metodos.simulado ? `<p class="erro">${t('Modo de teste: os pagamentos são de mentira.')}</p>` : ''}`;
  atualizarCompra();
}
// atualiza escolhas, preços e o botão sem redesenhar (o campo de valor livre não perde o foco)
function atualizarCompra() {
  const { v, metodo, pacote } = compra, el = $('#vip-pacotes');
  if (!v || !el.querySelector('.compra-pagar')) return;
  el.querySelectorAll('[data-metodo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.metodo === metodo)));
  el.querySelectorAll('[data-pacote]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pacote === String(pacote))));
  el.querySelectorAll('[data-preco]').forEach((s) => (s.textContent = dinheiro(metodo, +s.dataset.preco)));
  el.querySelector('.cp-moeda').textContent = MOEDA;
  const livre = compra.livre, okLivre = Number.isInteger(livre) && livre >= v.livre.min && livre <= v.livre.max;
  el.querySelector('.cp-livre-qtd').textContent = okLivre ? `= ${fmt(livre * v.livre.porUnidade)} 💎`
    : t('de {min} a {max}', { min: dinheiro(metodo, v.livre.min), max: dinheiro(metodo, v.livre.max) });
  el.querySelector('.cp-livre-qtd').classList.toggle('erro', !okLivre && pacote === 'livre');
  const esc = escolhaCompra(), b = el.querySelector('.compra-pagar');
  b.disabled = !esc;
  b.textContent = esc ? (metodo === 'pix' ? t('Pagar {preco} com PIX', { preco: dinheiro(metodo, esc.valor) }) : t('Pagar {preco} com cartão', { preco: dinheiro(metodo, esc.valor) }))
    : t('Escolha um valor entre {min} e {max}', { min: dinheiro(metodo, v.livre.min), max: dinheiro(metodo, v.livre.max) });
  el.querySelector('.compra-nota').textContent = metodo === 'pix'
    ? t('Você paga pelo app do seu banco, com o QR Code ou o código copia e cola. Os diamantes entram sozinhos quando o PIX cai.')
    : t('Você vai para a página segura do Stripe e volta para o jogo depois de pagar. Os diamantes entram sozinhos.');
}
$('#vip-pacotes').addEventListener('click', (e) => {
  const m = e.target.closest('[data-metodo]'), p = e.target.closest('[data-pacote]');
  if (m) compra.metodo = m.dataset.metodo;
  if (p) { compra.pacote = p.dataset.pacote === 'livre' ? 'livre' : +p.dataset.pacote; if (compra.pacote === 'livre' && e.target.tagName !== 'INPUT') $('#compra-livre').focus(); }
  if (m || p) atualizarCompra();
});
$('#vip-pacotes').addEventListener('keydown', (e) => {
  const p = e.target.closest('.compra-pacote.livre');
  if (p && e.target === p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.click(); }
});
$('#vip-pacotes').addEventListener('input', (e) => {
  if (e.target.id !== 'compra-livre') return;
  compra.livre = e.target.value === '' ? NaN : Number(e.target.value); compra.pacote = 'livre';
  atualizarCompra();
});
let pedidoAberto = null, vigiaPedido = null;
function pararVigia() { clearInterval(vigiaPedido); vigiaPedido = null; }
// pergunta ao servidor se o pedido já foi pago (o servidor confere no Stripe/Mercado Pago)
async function conferirPedido(id) {
  try {
    const r = await rede.statusPagamento(id);
    if (r.status !== 'pago') return false;
    pararVigia(); pedidoAberto = null;
    rp = r.saldo;
    $('#pagamento').hidden = false;
    $('#pagamento').innerHTML = `<p class="pago">${t('Pagamento confirmado! +{qtd} 💎', { qtd: fmt(r.diamantes) })}</p><p>${t('Obrigado por apoiar o LoL Idle!')}</p>`;
    som.efeito('fanfarra'); cena.aviso(t('+{qtd} diamantes!', { qtd: fmt(r.diamantes) }), '#8ae8ff');
    log(t('Pagamento confirmado: +{qtd} diamantes. Obrigado por apoiar o LoL Idle!', { qtd: fmt(r.diamantes) }), 'raro');
    mostrarDiamantes();
    if (!$('#janela-vip').hidden) { const st = $('#vip-status'); if (st) st.innerHTML = t('Você tem <b class="dia">{qtd} 💎 diamantes</b>.', { qtd: fmt(rp) }); $('#vip-ativar').disabled = rp < M.VIP.preco; }
    return true;
  } catch { return false; }
}
function vigiar(id) { pararVigia(); vigiaPedido = setInterval(() => conferirPedido(id), 4000); }
$('#janela-vip').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-pagar-agora]');
  if (b) {
    const metodo = compra.metodo, pacote = compra.pacote;
    if (!escolhaCompra()) return;
    funil('compra:escolheu');
    const painel = $('#pagamento');
    painel.hidden = false; painel.innerHTML = `<p class="esperando">${t('Preparando o pagamento…')}</p>`;
    painel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    try {
      const r = await rede.criarPagamento(pacote, metodo, pacote === 'livre' ? compra.livre : undefined);
      pedidoAberto = r.id;
      if (r.simulado) {
        painel.innerHTML = `<p>${t('Pagamento de teste ({metodo}, {moeda} {valor}).', { metodo: metodo === 'pix' ? 'PIX' : t('cartão'), moeda: r.moeda === 'brl' ? 'R$' : 'US$', valor: r.valor })}</p>
          <button class="botao" data-simular="${r.id}">${t('Confirmar pagamento de teste')}</button> <button class="botao" data-cancelar-pag>${t('Cancelar')}</button>`;
      } else if (r.url) {
        painel.innerHTML = `<p class="esperando">${t('Abrindo o pagamento com cartão…')}</p>`;
        location.href = r.url;                     // checkout do Stripe; na volta o jogo confere sozinho
      } else {
        painel.innerHTML = `<p>${t('Abra o app do seu banco e pague com PIX:')}</p>
          ${r.qr ? `<img src="data:image/png;base64,${r.qr}" alt="${t('QR Code do PIX')}">` : ''}
          <p class="fraco">${t('ou copie o código "copia e cola":')}</p>
          <textarea readonly id="pix-codigo">${r.copiaECola || ''}</textarea>
          <button class="botao" data-copiar>${t('Copiar código')}</button> <button class="botao" data-cancelar-pag>${t('Cancelar')}</button>
          <p class="esperando">${t('Aguardando o pagamento… os diamantes entram sozinhos assim que o PIX cair.')}</p>${r.teste ? `<p class="erro">${t('Mercado Pago em modo de teste: este PIX é aprovado sozinho em alguns segundos, sem dinheiro de verdade.')}</p>` : ''}`;
        vigiar(r.id);
      }
    } catch (err) { painel.innerHTML = `<p class="erro">${escG(err.message)}</p>`; }
    return;
  }
  if (e.target.closest('[data-copiar]')) {
    const campo = $('#pix-codigo'); campo.select();
    try { await navigator.clipboard.writeText(campo.value); e.target.textContent = t('Copiado!'); } catch { document.execCommand('copy'); }
    return;
  }
  if (e.target.closest('[data-cancelar-pag]')) { pararVigia(); pedidoAberto = null; $('#pagamento').hidden = true; return; }
  const sim = e.target.closest('[data-simular]');
  if (sim) { sim.disabled = true; await rede.simularPagamento(sim.dataset.simular); await conferirPedido(sim.dataset.simular); }
});
// volta do checkout do Stripe: /jogar?pagamento=ok&pedido=...
{
  const q = new URLSearchParams(location.search), volta = q.get('pagamento'), id = q.get('pedido');
  if (volta) history.replaceState(null, '', location.pathname);
  if (volta === 'cancelado') log(t('Pagamento cancelado. Nada foi cobrado.'), 'npc');
  if (volta === 'ok' && id) {
    log(t('Confirmando o pagamento com cartão…'), 'npc');
    conferirPedido(id).then((pago) => { if (!pago) vigiar(id); });
    setTimeout(pararVigia, 10 * 60000);
  }
}
$('#rotina-vip').addEventListener('click', (e) => { e.preventDefault(); abrirVip(); });
// a rotina travada (sem VIP) explica o VIP ao ser clicada
$('#rotina').addEventListener('click', (e) => { if (!M.ehVip(estado) && !e.target.closest('#rotina-vip')) { e.preventDefault(); abrirVip(); } });
async function ativarVipAgora() {
  try {
    const r = await rede.ativarVip();
    rp = r.rp; estado.vipAte = r.vipAte; mostrarDiamantes();
    som.efeito('fanfarra'); cena.aviso(t('VIP ativado!'), '#ffd84a');
    log(t('VIP ativo até {data}. Obrigado por apoiar o LoL Idle!', { data: new Date(r.vipAte).toLocaleString(LOCALE) }), 'raro');
    atualizarBotaoVip();
    return true;
  } catch (e) { $('#vip-erro').textContent = e.message; log(e.message, 'morte'); return false; }
}
$('#vip-ativar').addEventListener('click', async () => {
  $('#vip-ativar').disabled = true;
  if (await ativarVipAgora()) abrirVip(); else $('#vip-ativar').disabled = false;
});
atualizarBotaoVip();
setInterval(atualizarBotaoVip, 60000);

// ---------- aba Mercado: Loja (servidor, diamantes) e Jogadores (ofertas por ouro ou diamantes) ----------
let secaoMercado = 'loja', abaMercado = 'comprar', dadosMercado = null, vendendo = null, erroMercado = null, moedaVenda = 'ouro';
let reservaPara = '';      // "Vender só para": o nome digitado fica enquanto a aba Vender está aberta (para passar vários itens ao mesmo amigo)
const RESERVA_NIVEL = 20;      // a oferta reservada é dos dois no nível 20 ou mais (o servidor confere)
// histórico das minhas compras e vendas (aba Histórico): lido do servidor ao abrir a aba
let histMercado = null, lendoHist = false;
async function lerHistoricoMercado() {
  if (lendoHist) return; lendoHist = true;
  try { histMercado = await rede.historicoMercado(); } catch (e) { histMercado = { erro: e.message }; }
  lendoHist = false; desenharMercadoJog();
}
const fmtPreco = (preco, moeda) => (moeda === 'orbs' ? `${fmt(preco)} 💠` : moeda === 'diamante' ? `${fmt(preco)} 💎` : t('{qtd} ouro', { qtd: fmt(preco) }));
function mostrarDiamantes() {
  const el = $('#diamantes'), v = `${fmt(rp)} 💎`; if (el.textContent !== v) el.textContent = v;
  const c = $('#dia-saldo'), n = fmt(rp); if (c && c.textContent !== n) c.textContent = n;      // e no cartão do jogador
}
mostrarDiamantes();
async function carregarMercado() {
  try { dadosMercado = await rede.mercado(); rp = dadosMercado.diamantes ?? rp; orbs = dadosMercado.orbs ?? orbs; mostrarOrbs(); erroMercado = null; mostrarErroMercado(''); }
  catch (e) { erroMercado = e.message.includes('fetch') ? t('sem conexão com o servidor') : e.message; }
  mostrarDiamantes();
  desenharMercado();
}
function abrirMercado(secao) {
  abrirAba('mercado');
  secaoMercado = 'loja';
  desenharMercado();
  carregarMercado();
}
const linhaItem = (id, extra = '') => {
  const g = M.ofertaGema(id);
  if (g) return `<img src="${iconeGema(g.id)}" alt="" title="${textoGema(g.id).replace(/"/g, '&quot;')}"><div><div class="nome" style="color:${M.GEMAS[g.id].cor}">${M.nomeOferta(id)}</div><div class="detalhe">${t('Runa')}${extra}</div></div>`;
  const mo = M.ofertaMascote(id);
  if (mo) return `<img class="pet-mini" src="${miniatura(M.MASCOTES[mo].nome)}" alt="" title="${esc(t(M.MASCOTES[mo].desc))}"><div><div class="nome" style="color:${COR_MASCOTE}">${t(M.MASCOTES[mo].nome)}</div><div class="detalhe">${t('Mascote')}${extra}</div></div>`;
  const d = descreverItem(id);
  return `<img src="${imgItem(id)}" alt="" title="${textoItem(id).replace(/"/g, '&quot;')}"><div><div class="nome" style="color:${d.cor}">${d.nome}</div><div class="detalhe">${M.NOME_RARIDADE[d.raridade]}${extra}</div></div>`;
};
function desenharMercado() {
  // a aba Mercado da coluna é a Loja (diamantes); o mercado dos jogadores fica na janela do Mercador
  document.querySelectorAll('.secoes-mercado .aba').forEach((b) => { const sim = b.dataset.secao === 'loja'; b.classList.toggle('ativa', sim); b.setAttribute('aria-selected', sim); });
  mostrarDiamantes();
  desenharLoja();
  desenharMercadoJog();
}
function mostrarErroMercado(msg) { for (const s of ['#mercado-erro', '#mj-erro']) { const el = $(s); if (el) el.textContent = msg; } }

// ---------- mercado dos jogadores (janela do Mercador, pedido de jogador: a aba ficou apertada com muita oferta) ----------
// Comprar: os itens iguais (mesmo item, refino e qualidade) viram uma ficha com quantos estão à venda e o menor preço;
// clicando na ficha, as ofertas dela (da mais barata) e a comparação com o equipado. Vender: a mochila em grade, com o
// menor preço do mercado para o mesmo item. Olhar dá de qualquer lugar; comprar e vender, com o Mercador (Fonte ou cidades).
let mercadoCat = '', grupoSel = null;
const chaveGrupo = (item) => { const g = M.ofertaGema(item); return g ? 'gema:' + g.id : item; };
function gruposMercado(ofertas) {
  const mapa = new Map();
  for (const o of ofertas) {
    const ch = chaveGrupo(o.item), g = M.ofertaGema(o.item), un = g ? o.preco / g.q : o.preco;
    const gr = mapa.get(ch) || { chave: ch, item: o.item, gema: g?.id || null, mascote: M.ofertaMascote(o.item), ofertas: [], min: {}, novo: 0, qtd: 0 };
    gr.ofertas.push(o); gr.qtd += g ? g.q : 1; gr.novo = Math.max(gr.novo, o.id);
    gr.min[o.moeda] = Math.min(gr.min[o.moeda] ?? Infinity, un);
    mapa.set(ch, gr);
  }
  return [...mapa.values()];
}
const nomeGrupo = (gr) => (gr.gema ? M.nomeGema(gr.gema) : gr.mascote ? t(M.MASCOTES[gr.mascote].nome) : descreverItem(gr.item).nome);
const rarGrupo = (gr) => (gr.gema ? 'gema' : gr.mascote ? 'mascote' : descreverItem(gr.item).raridade);
const iconeGrupo = (gr) => (gr.gema ? `<span class="slot"><img src="${iconeGema(gr.gema)}" alt=""></span>`
  : gr.mascote ? `<span class="slot mascote"><img src="${miniatura(M.MASCOTES[gr.mascote].nome)}" alt=""></span>`
  : `<span class="slot ${rarGrupo(gr)}"><img src="${imgItem(gr.item)}" alt="">${rotuloRef(gr.item)}</span>`);
const precoMin = (gr, moeda) => (gr.min[moeda] == null ? '' : `<em class="${moeda === 'orbs' ? 'gem' : 'ouro'}">${t('a partir de')} ${fmtPreco(Math.ceil(gr.min[moeda]), moeda)}${gr.gema ? ' ' + t('cada') : ''}</em>`);
// o mascote no mercado (p677, só o Poro de Bigode): a conta tem um? e o texto da ficha
const jaTemMascote = (item) => { const mo = M.ofertaMascote(item); return !!mo && !!estado.mascotes?.[mo]; };
const mascoteMercadoHtml = (id) => `<p class="bolsa-efeito">${esc(t(M.MASCOTES[id].desc))}</p>
  <p class="fraco">${t('Vale para a conta toda (todos os seus personagens). Chega no nível 1: o nível fica com quem treinou.')}</p>
  ${estado.mascotes?.[id] ? `<p class="alerta">${t('Você já tem um Poro de Bigode. Cada conta pode ter só um.')}</p>` : ''}`;
// a comparação com o equipado (a mesma da janela de itens): atributos lado a lado e o Poder antes → depois
function comparacaoHtml(id) {
  if (!M.temAtributo(id)) return `<p class="fraco">${t('Não dá atributos: serve só para montar outros itens no Ornn.')}</p>`;
  const i = M.infoItem(id), alvo = alvoDaComparacao(id), ia = alvo ? M.infoItem(alvo) : null;
  const linhas = ATRIB_COMP.filter(([k]) => i[k] || ia?.[k]).map(([k, nome, f]) => {
    const v = i[k] || 0, w = ia ? ia[k] || 0 : 0, dif = v - w, sinal = Math.abs(dif) < 1e-9 ? '' : dif > 0 ? 'mais' : 'menos';
    return `<tr><th>${t(nome)}</th><td>${v ? numComp(v, f) : '—'}</td><td>${w ? numComp(w, f) : '—'}</td><td class="${sinal}">${sinal ? (dif > 0 ? '+' : '−') + numComp(Math.abs(dif), f) : '='}</td></tr>`;
  }).join('');
  const depois = alvo ? estado.itens.map((x) => (x === alvo ? id : x)) : [...estado.itens, id];
  const pa = M.poder(estado), pd = M.poder({ nivel: estado.nivel, itens: depois });
  return `<p class="bolsa-vs">${alvo ? t('Comparando com o equipado: {item}', { item: `<b class="cor-${descreverItem(alvo).raridade}">${descreverItem(alvo).nome}</b>` }) : t('Você tem um espaço livre para ele.')}</p>
    ${linhas ? `<table class="bolsa-comp"><thead><tr><th></th><th>${t('Este')}</th><th>${t('Equipado')}</th><th>${t('Diferença')}</th></tr></thead><tbody>${linhas}</tbody></table>` : ''}
    ${i.efeito ? `<p class="bolsa-efeito"><b>${descreverItem(id).nome}</b> ${i.efeito}</p>` : ''}
    <p class="bolsa-poder">${t('Poder')}: ${inteiro(pa)} → <b class="${pd > pa ? 'mais' : pd < pa ? 'menos' : ''}">${inteiro(pd)}</b> (${pd >= pa ? '+' : '−'}${inteiro(Math.abs(pd - pa))})</p>`;
}
function abrirMercadoJogadores(aba) {
  if (aba) { abaMercado = aba; vendendo = null; }
  $('#janela-mercado').hidden = false;
  desenharMercadoJog();
  carregarMercado();
}
function desenharMercadoJog() {
  const jan = $('#janela-mercado');
  if (!jan || jan.hidden) return;
  const lista = $('#mercado-lista'), det = $('#mj-detalhe'), dm = dadosMercado, aqui = M.atendeAqui(estado);
  const rolLista = lista.scrollTop, rolDet = det.scrollTop;
  const saldo = `<span class="ouro">${t('{qtd} ouro', { qtd: fmt(estado.ouro) })}</span> <span class="gem">${fmt(orbs || 0)} 💠</span>`;
  if ($('#mj-saldo').innerHTML !== saldo) $('#mj-saldo').innerHTML = saldo;
  $('#mercado-fora').hidden = aqui;
  document.querySelectorAll('#janela-mercado .abas-mercado .aba').forEach((b) => { const sim = b.dataset.aba === abaMercado; b.classList.toggle('ativa', sim); b.setAttribute('aria-selected', sim); });
  jan.querySelector('.mj-corpo').dataset.aba = abaMercado;
  document.querySelectorAll('#janela-mercado [data-cat]').forEach((b) => b.classList.toggle('ativa', b.dataset.cat === mercadoCat));
  const minhas = dm ? dm.ofertas.filter((o) => o.minha).length : 0;
  $('#mj-n-minhas').textContent = minhas ? String(minhas) : '';
  // caixa: o que as vendas renderam e os itens devolvidos
  const cx = dm?.caixa || [];
  $('#mercado-caixa').hidden = !cx.length;
  if (cx.length) {
    const ouro = cx.reduce((s2, c) => s2 + c.ouro, 0), dia = cx.reduce((s2, c) => s2 + (c.diamantes || 0), 0), gem = cx.reduce((s2, c) => s2 + (c.orbs || 0), 0), itens = cx.filter((c) => c.item).length;
    // o dinheiro é das vendas; os itens voltaram (oferta vencida, cancelada com a mochila cheia, devolvida pela equipe) (p656)
    const partes = [ouro && `<b>${t('{qtd} ouro', { qtd: fmt(ouro) })}</b>`, dia && `<b>${fmt(dia)} 💎</b>`, gem && `<b>${fmt(gem)} 💠</b>`].filter(Boolean);
    const textos = [partes.length && t('Suas vendas renderam: {partes}', { partes: partes.join(' + ') }), itens && (itens > 1 ? t('{n} itens voltaram para você', { n: itens }) : t('1 item voltou para você'))].filter(Boolean);
    const porque = [...new Set(cx.filter((c) => c.item).map((c) => t(c.motivo || '')))].filter(Boolean).join('\n');
    $('#mercado-caixa').innerHTML = `<span${porque ? ` title="${esc(porque)}"` : ''}>${textos.join(' · ')}</span><button class="botao principal" data-receber>${t('Recolher')}</button>`;
  }
  if (!dm) {
    lista.innerHTML = erroMercado
      ? `<div class="vazio-lista">${t('Não foi possível abrir o mercado ({erro}).', { erro: escG(erroMercado) })}<br><button class="link" data-recarregar>${t('Tentar de novo')}</button></div>`
      : `<div class="vazio-lista">${t('Carregando…')}</div>`;
    det.innerHTML = '';
    return;
  }
  const bloq = aqui ? '' : `disabled title="${t('Fale com o Mercador na Fonte ou numa cidade de Runeterra')}"`;
  if (abaMercado === 'comprar') {
    const busca = $('#mercado-busca').value.trim().toLowerCase(), classe = $('#mercado-classe').value, moeda = $('#mercado-moeda').value, ordem = $('#mercado-ordem').value;
    let ofs = dm.ofertas.filter((o) => !o.minha && !o.para && (M.ofertaGema(o.item) || M.ofertaMascote(o.item) || M.ITENS[M.baseId(o.item)]));
    // as reservadas para mim ficam num bloco em destaque, fora das fichas comuns
    const reserv = dm.ofertas.filter((o) => o.paraMim && !o.minha && (M.ofertaGema(o.item) || M.ofertaMascote(o.item) || M.ITENS[M.baseId(o.item)]));
    const nivelRes = estado.nivel < RESERVA_NIVEL ? `disabled title="${t('Só jogadores do nível {n} ou mais compram ofertas reservadas.', { n: RESERVA_NIVEL })}"` : '';
    const blocoRes = reserv.length ? `<div class="mj-reservadas"><div class="mj-res-tit">🔒 ${t('Reservadas para você ({n})', { n: reserv.length })}</div>${reserv.map((o) => {
        const falta = o.moeda === 'orbs' ? orbs < o.preco : estado.ouro < o.preco, ja = jaTemMascote(o.item);
        return `<div class="oferta mj-res">${linhaItem(o.item, ' · ' + t('de {nome}', { nome: escG(o.vendedor) }) + ' · ' + t('expira em {tempo}', { tempo: tempoTexto(Math.max(0, (o.expira - Date.now()) / 1000)) }))}
          <span class="preco${o.moeda === 'orbs' ? ' gem' : ''}">${fmtPreco(o.preco, o.moeda)}</span>
          <button class="botao principal" data-comprar="${o.id}" ${!aqui ? bloq : ja ? `disabled title="${t('Você já tem um Poro de Bigode. Cada conta pode ter só um.')}"` : nivelRes || (falta ? `disabled title="${t('Saldo insuficiente')}"` : '')}>${t('Comprar')}</button></div>`;
      }).join('')}</div>` : '';
    if (moeda) ofs = ofs.filter((o) => o.moeda === moeda);
    let grs = gruposMercado(ofs);
    if (busca) grs = grs.filter((g) => nomeGrupo(g).toLowerCase().includes(busca));
    if (mercadoCat === 'runas') grs = grs.filter((g) => g.gema);
    else if (mercadoCat === 'mascotes') grs = grs.filter((g) => g.mascote);
    else if (mercadoCat === 'botas') grs = grs.filter((g) => !g.gema && !g.mascote && M.ehBota(g.item));
    else if (mercadoCat) grs = grs.filter((g) => !g.gema && !g.mascote && rarGrupo(g) === mercadoCat);
    if (classe) grs = grs.filter((g) => !g.gema && !g.mascote && M.classeItem(g.item) === classe);
    const qual = $('#mercado-qual')?.value;
    if (qual) grs = grs.filter((g) => !g.gema && !g.mascote && M.qualidadeDe(g.item) === qual);
    // "Melhor primeiro": raridade, qualidade, refino (+N) e, empatado, o mais barato
    const TIER_RAR = { lendario: 3, epico: 2, basico: 1 }, tier = (g) => (g.mascote ? [4, 0, 0] : g.gema ? [0, 0, 0] : [TIER_RAR[rarGrupo(g)] || 0, M.ORDEM_QUAL.indexOf(M.qualidadeDe(g.item)), M.refinoDe(g.item)]);
    const melhor = (a, b) => { const x = tier(a), y = tier(b); return y[0] - x[0] || y[1] - x[1] || y[2] - x[2]; };
    const menor = (g) => g.min[moeda || 'ouro'] ?? (g.min.ouro ?? Infinity), menorG = (g) => g.min.orbs ?? Infinity;
    grs.sort(ordem === 'caro' ? (a, b) => (menor(b) === Infinity ? -1 : menor(a) === Infinity ? 1 : menor(b) - menor(a))
      : ordem === 'novo' ? (a, b) => b.novo - a.novo : ordem === 'ofertas' ? (a, b) => b.ofertas.length - a.ofertas.length || menor(a) - menor(b)
      : ordem === 'melhor' ? (a, b) => melhor(a, b) || menor(a) - menor(b)
      : (a, b) => menor(a) - menor(b) || menorG(a) - menorG(b));
    if (!grs.some((g) => g.chave === grupoSel)) grupoSel = null;
    lista.innerHTML = blocoRes + (grs.length ? `<div class="mj-grade">${grs.map((g) => `<button type="button" class="mj-card${g.chave === grupoSel ? ' ativa' : ''}" data-grupo="${g.chave.replace(/"/g, '&quot;')}">
        ${iconeGrupo(g)}<span class="mj-card-txt"><b class="cor-${rarGrupo(g)}">${nomeGrupo(g)}</b>
        <small>${g.gema ? t('{n} runas à venda', { n: g.qtd }) : g.ofertas.length === 1 ? t('1 à venda') : t('{n} à venda', { n: g.ofertas.length })}</small>
        <span class="mj-precos">${precoMin(g, 'ouro')}${precoMin(g, 'orbs')}</span></span></button>`).join('')}</div>`
      : `<div class="vazio-lista">${t('Nenhuma oferta encontrada.')}</div>`);
    const gr = grs.find((g) => g.chave === grupoSel);
    if (!gr) det.innerHTML = `<p class="fraco mj-dica">${t('Escolha um item para ver as ofertas, quem está vendendo e a comparação com o que você tem equipado.')}</p>`;
    else {
      const ofertas = [...gr.ofertas].sort((a, b) => (a.moeda === b.moeda ? a.preco - b.preco : a.moeda === 'ouro' ? -1 : 1));
      det.innerHTML = `<div class="bolsa-topo">${iconeGrupo(gr)}<div><b class="cor-${rarGrupo(gr)}">${nomeGrupo(gr)}</b><small>${gr.gema ? t('Runa') : gr.mascote ? t('Mascote') : M.NOME_RARIDADE[rarGrupo(gr)] + ' · ' + t('{valor} de ouro no Lojista', { valor: inteiro(M.valorVenda(gr.item)) })}</small></div></div>
        ${gr.gema ? `<p class="bolsa-efeito">${t(M.GEMAS[gr.gema].desc)}</p>` : gr.mascote ? mascoteMercadoHtml(gr.mascote) : comparacaoHtml(gr.item)}
        <div class="mj-ofertas-tit">${t('Ofertas')} (${ofertas.length})</div>
        ${ofertas.map((o) => {
          const g = M.ofertaGema(o.item), falta = o.moeda === 'orbs' ? orbs < o.preco : o.moeda === 'diamante' ? rp < o.preco : estado.ouro < o.preco, ja = jaTemMascote(o.item);
          return `<div class="mj-oferta"><span class="mj-vend"><b>${escG(o.vendedor)}</b><small>${g ? t('lote de {n}', { n: g.q }) + ' · ' : ''}${t('expira em {tempo}', { tempo: tempoTexto(Math.max(0, (o.expira - Date.now()) / 1000)) })}</small></span>
            <span class="preco${o.moeda === 'orbs' ? ' gem' : ''}">${fmtPreco(o.preco, o.moeda)}</span>
            <button class="botao" data-comprar="${o.id}" ${!aqui ? bloq : ja ? `disabled title="${t('Você já tem um Poro de Bigode. Cada conta pode ter só um.')}"` : falta ? `disabled title="${t('Saldo insuficiente')}"` : ''}>${t('Comprar')}</button></div>`;
        }).join('')}`;
    }
  } else if (abaMercado === 'vender') {
    // a mochila e as runas em grade; o item escolhido abre o formulário com o menor preço do mercado para ele
    const runas = M.ORDEM_GEMAS.filter((g) => estado.gemas?.[g]), petsVenda = Object.keys(estado.mascotes || {}).filter((p) => Object.hasOwn(M.MASCOTES, p) && M.MASCOTES[p].negociavel);
    lista.innerHTML = estado.mochila.length || runas.length || petsVenda.length
      ? `<div class="mj-mochila">${estado.mochila.map((id, k) => `<button type="button" class="slot ${M.raridade(M.infoItem(id))}${k === vendendo ? ' ativa' : ''}" data-escolher="${k}" ${M.pendente(id) ? `disabled title="${t('Sendo avaliado...')}"` : `title="${descreverItem(id).nome.replace(/"/g, '&quot;')}"`}><img src="${imgItem(id)}" alt="">${rotuloRef(id)}</button>`).join('')}
        ${runas.map((g) => `<button type="button" class="slot${vendendo === 'g:' + g ? ' ativa' : ''}" data-escolher="g:${g}" title="${M.nomeGema(g)}"><img src="${iconeGema(g)}" alt=""><span class="qtd">${estado.gemas[g]}</span></button>`).join('')}
        ${petsVenda.map((p) => `<button type="button" class="slot mascote${vendendo === 'm:' + p ? ' ativa' : ''}" data-escolher="m:${p}" title="${esc(t(M.MASCOTES[p].nome))}"><img src="${miniatura(M.MASCOTES[p].nome)}" alt=""><span class="qtd">🐾${estado.mascotes[p].nivel}</span></button>`).join('')}</div>`
      : `<div class="vazio-lista">${t('Mochila vazia. Só itens da mochila vão para o mercado (tire do equipamento antes).')}</div>`;
    const gemaVenda = typeof vendendo === 'string' && vendendo.startsWith('g:') ? vendendo.slice(2) : null, petVenda = typeof vendendo === 'string' && vendendo.startsWith('m:') ? vendendo.slice(2) : null;
    const chave = gemaVenda ? 'gema:' + gemaVenda : petVenda ? 'mascote:' + petVenda : typeof vendendo === 'number' ? estado.mochila[vendendo] : null;
    const iguais = chave ? dm.ofertas.filter((o) => !o.minha && !o.para && chaveGrupo(o.item) === chave) : [];
    const gr = iguais.length ? gruposMercado(iguais)[0] : null;
    const noMercado = chave ? `<p class="mj-ref">${gr ? t('No mercado agora: {n} à venda', { n: gr.ofertas.length }) + ' · ' + [precoMin(gr, 'ouro'), precoMin(gr, 'orbs')].filter(Boolean).join(' · ') : t('Ninguém está vendendo este item agora.')}</p>` : '';
    const sugestao = (padrao) => { const m = gr?.min[moedaVenda]; return m == null ? padrao : gemaVenda ? Math.max(1, Math.ceil(m)) : Math.max(1, Math.floor(m) - 1); };      // um pouco abaixo do mais barato
    let form = '';
    if (gemaVenda && estado.gemas?.[gemaVenda]) form = formVenda(`<img src="${iconeGema(gemaVenda)}" alt=""><div><b>${M.nomeGema(gemaVenda)}</b><small>${t('Runa')} · ${t('na bolsa: {n}', { n: estado.gemas[gemaVenda] })}</small></div>`,
      `<label class="vf-campo">${t('Quantidade')} <span><input id="vender-qtd" type="number" min="1" max="${Math.min(100, estado.gemas[gemaVenda])}" step="1" value="1"></span></label>`,
      sugestao(gemaVenda === 'sorte' ? 5000 : 40000), bloq);
    else if (petVenda && estado.mascotes?.[petVenda] && M.MASCOTES[petVenda]?.negociavel) form = formVenda(`<img class="pet-mini" src="${miniatura(M.MASCOTES[petVenda].nome)}" alt=""><div><b class="cor-mascote">${t(M.MASCOTES[petVenda].nome)}</b><small>${t('Mascote')} · ${t('nível {n} (quem comprar começa no 1)', { n: estado.mascotes[petVenda].nivel })}</small></div>`,
      '', sugestao(250000), bloq);
    else if (typeof vendendo === 'number' && estado.mochila[vendendo]) {
      const id = estado.mochila[vendendo], d = descreverItem(id);
      form = formVenda(`<span class="icone-item"><img src="${imgItem(id)}" alt="">${rotuloRef(id)}</span><div><b class="cor-${d.raridade}">${d.nome}</b><small>${M.NOME_RARIDADE[d.raridade]} · ${t('Lojista paga {valor}', { valor: fmt(M.valorVenda(id)) })}</small></div>`, '', sugestao(M.valorVenda(id) * 3), bloq);
    }
    // o mínimo pela referência dos jogadores (o servidor confere de novo ao anunciar)
    const refItem = chave && (gemaVenda ? `gema:${gemaVenda}:${Math.max(1, Math.floor(+($('#vender-qtd')?.value || 1)))}` : chave);
    pedirReferencia(refItem, moedaVenda);
    const rf = refItem && refsMercado.get(refItem + '|' + moedaVenda);
    const refHtml = refItem ? `<p class="mj-ref mj-minimo" id="mj-minimo" data-chave="${esc(refItem + '|' + moedaVenda)}" ${rf?.ref ? '' : 'hidden'}>${rf?.ref ? textoReferencia(rf.ref, moedaVenda) : ''}</p>` : '';
    det.innerHTML = (form ? noMercado + refHtml + form : `<p class="fraco mj-dica">${t('Escolha um item da mochila (ou uma runa) para anunciar.')}</p>`)
      + `<p class="fraco mj-regras">${t('Ofertas: {ativas}/{limite} · duram 48 h · taxa: {taxa}% em ouro, de 13% a 7,5% em Gemas', { ativas: minhas, limite: dm.limite, taxa: Math.round(dm.taxa * 100) })}</p>`;
    { const campo = $('#vender-preco'); if (rf?.ref && campo && !campo.dataset.editado && Number(campo.value) < rf.ref.minimo) campo.value = rf.ref.valor; }      // a sugestão não fica abaixo do mínimo
    atualizarLiquido();
  } else if (abaMercado === 'historico') {
    if (!histMercado) { lerHistoricoMercado(); lista.innerHTML = `<div class="vazio-lista">${t('Carregando…')}</div>`; det.innerHTML = ''; }
    else if (histMercado.erro) lista.innerHTML = `<div class="vazio-lista">${esc(histMercado.erro)}</div>`;
    else {
      const hs = histMercado.lista || [], quando = (q) => new Date(q).toLocaleString(ingles ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      lista.innerHTML = hs.length ? hs.map((h) => `<div class="oferta mj-hist ${h.vendi ? 'vendi' : 'comprei'}">${linhaItem(h.item, ' · ' + quando(h.quando))}
        <span class="mj-hist-quem">${h.vendi ? t('vendeu para {nome}', { nome: esc(h.outro || '?') }) : t('comprou de {nome}', { nome: esc(h.outro || '?') })}</span>
        <span class="preco${h.moeda === 'orbs' ? ' gem' : ''}">${h.vendi ? '+' : '−'}${fmtPreco(h.vendi ? h.recebido : h.preco, h.moeda)}</span></div>`).join('')
        : `<div class="vazio-lista">${t('Nenhuma compra ou venda ainda. O histórico começou a ser anotado em 10/10/2026.')}</div>`;
      const soma = (f) => hs.filter(f).reduce((s2, h) => { s2[h.moeda] = (s2[h.moeda] || 0) + (h.vendi ? h.recebido : h.preco); return s2; }, {});
      const txt = (o) => Object.entries(o).map(([m, v]) => fmtPreco(v, m)).join(' + ') || '—';
      det.innerHTML = `<p class="mj-hist-resumo">${t('Vendas: {n} · você recebeu {valor}', { n: hs.filter((h) => h.vendi).length, valor: txt(soma((h) => h.vendi)) })}</p>
        <p class="mj-hist-resumo">${t('Compras: {n} · você pagou {valor}', { n: hs.filter((h) => !h.vendi).length, valor: txt(soma((h) => !h.vendi)) })}</p>
        <p class="fraco mj-dica">${t('As suas últimas 60 compras e vendas. Nas vendas, o valor já é o que você recebeu, sem a taxa.')}</p>`;
    }
  } else {
    const mins = dm.ofertas.filter((o) => o.minha);
    lista.innerHTML = mins.length ? mins.map((o) => `<div class="oferta${o.para ? ' mj-res' : ''}">${linhaItem(o.item, ' · ' + t('expira em {tempo}', { tempo: tempoTexto(Math.max(0, (o.expira - Date.now()) / 1000)) })
      + (o.para ? ` · <span class="mj-res-para">🔒 ${t('reservada para {nome}', { nome: escG(o.para) })}</span>` : ''))}<span class="preco${o.moeda === 'orbs' ? ' gem' : o.moeda === 'diamante' ? ' dia' : ''}">${fmtPreco(o.preco, o.moeda)}</span><button class="botao" data-cancelar="${o.id}" ${bloq}>${t('Cancelar')}</button></div>`).join('')
      : `<div class="vazio-lista">${t('Você não tem ofertas no mercado.')}</div>`;
    det.innerHTML = `<p class="fraco mj-dica">${t('Cancelar devolve o item para a mochila (ou para a caixa, se ela estiver cheia). O que vender aparece em cima, em Recolher.')}</p>
      <p class="fraco mj-regras">${t('Ofertas: {ativas}/{limite} · duram 48 h · taxa: {taxa}% em ouro, de 13% a 7,5% em Gemas', { ativas: mins.length, limite: dm.limite, taxa: Math.round(dm.taxa * 100) })}</p>`;
  }
  lista.scrollTop = rolLista; det.scrollTop = rolDet;
}
// a referência de preço de um item no mercado (servidor: só ofertas e vendas de jogadores), guardada 1 min
const refsMercado = new Map();
function pedirReferencia(item, moeda) {
  if (!item) return;
  const k = item + '|' + moeda, ja = refsMercado.get(k);
  if (ja && Date.now() - ja.em < 60000) return;
  refsMercado.set(k, { em: Date.now(), ref: ja?.ref ?? null });
  fetch(`/api/mercado/referencia?item=${encodeURIComponent(item)}&moeda=${moeda}`, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('lol-idle-token') || '') } })
    .then((r) => r.json()).then((d) => {
      refsMercado.set(k, { em: Date.now(), ref: d?.ref || null });
      const el = $('#mj-minimo');      // a linha do formulário aberto: atualiza no lugar (sem redesenhar a janela)
      if (el && el.dataset.chave === k && d?.ref) {
        el.textContent = textoReferencia(d.ref, moeda); el.hidden = false;
        // a sugestão de preço não fica abaixo do mínimo (o que o jogador já digitou não muda)
        const campo = $('#vender-preco');
        if (campo && !campo.dataset.editado && Number(campo.value) < d.ref.minimo) { campo.value = d.ref.valor; atualizarLiquido(); }
      }
    }).catch(() => {});
}
// preço cheio (115.000 ouro, não 115.0k) na referência e no mínimo
const precoCheio = (v, moeda) => (moeda === 'orbs' ? `${inteiro(v)} 💠` : t('{qtd} ouro', { qtd: inteiro(v) }));
const textoReferencia = (ref, moeda) => t('Os jogadores pagam em torno de {ref} · preço mínimo: {min}', { ref: precoCheio(ref.valor, moeda), min: precoCheio(ref.minimo, moeda) });
// os avisos do mercado numa janela com OK (antes era uma linha vermelha embaixo da janela, que passava despercebida)
const avisoMercado = (msg, titulo = t('Mercado')) => avisar(msg, { titulo, ok: t('Entendi') });
// o formulário de venda: o item, a moeda (ouro ou Gemas, em dois botões), o preço com a moeda ao lado e quanto você recebe
function formVenda(itemHtml, extra, preco, semFonte) {      // semFonte: o atributo que trava o botão longe do Mercador
  const m = moedaVenda;
  return `<form class="vender-form vf" data-sem-envio>
    <div class="vf-item">${itemHtml}</div>
    <div class="vf-moedas" role="radiogroup" aria-label="${t('Moeda')}">
      <button type="button" class="vf-moeda ouro${m === 'ouro' ? ' ativa' : ''}" data-moeda-venda="ouro" aria-pressed="${m === 'ouro'}"><span class="vf-ico" aria-hidden="true">🪙</span><b>${t('Ouro')}</b><small>${t('dinheiro do jogo')}</small></button>
      <button type="button" class="vf-moeda gem${m === 'orbs' ? ' ativa' : ''}" data-moeda-venda="orbs" aria-pressed="${m === 'orbs'}"><span class="vf-ico" aria-hidden="true">💠</span><b>${t('Gemas')} <em>RMT</em></b><small>${t('vira dinheiro de verdade')}</small></button>
    </div>
    <input type="hidden" id="vender-moeda" value="${m}">
    <div class="vf-linha">${extra}<label class="vf-campo">${t('Preço')} <span><input id="vender-preco" type="number" min="1" step="1" value="${preco}"><i id="vender-unidade">${m === 'orbs' ? '💠 ' + t('Gemas') : t('ouro')}</i></span></label></div>
    <p class="vf-recebe" id="vender-liquido"></p>
    <div class="vf-reserva${reservaPara ? ' ativa' : ''}">
      <label class="vf-campo">🔒 ${t('Vender só para (opcional)')} <span><input id="vender-para" type="text" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${t('nome do jogador')}" value="${esc(reservaPara)}" ${estado.nivel < RESERVA_NIVEL ? 'disabled' : ''}></span></label>
      <small>${estado.nivel < RESERVA_NIVEL ? t('A oferta reservada é a partir do nível {n}.', { n: RESERVA_NIVEL }) : t('Vazio: qualquer um compra. Com um nome, só esse jogador vê e compra. Os dois precisam ser do nível 20 ou mais e ter a conta há 3 dias.')}</small>
    </div>
    <button class="botao principal vf-anunciar" data-anunciar ${semFonte}>${reservaPara ? t('Reservar para {nome}', { nome: esc(reservaPara) }) : t('Anunciar no mercado')}</button>
  </form>`;
}
function atualizarLiquido() {
  const campo = $('#vender-preco'); if (!campo || !dadosMercado) return;
  const p = Math.max(0, Math.floor(+campo.value || 0));
  const moeda = $('#vender-moeda').value;
  const un = $('#vender-unidade'); if (un) un.textContent = moeda === 'orbs' ? '💠 ' + t('Gemas') : t('ouro');
  $('#vender-liquido').textContent = moeda === 'orbs'
    ? t('você recebe {valor} (taxa {taxa}%) ≈ {usd}', { valor: fmtPreco(vendedorRecebe(p), moeda), taxa: String(taxaOrbs(p) * 100).replace('.', ingles ? '.' : ','), usd: usd(vendedorRecebe(p) * ORBS.saque) })
    : t('você recebe {valor}', { valor: fmtPreco(Math.floor(p * (1 - dadosMercado.taxa)), moeda) });
}
// ----- Loja do servidor -----
function desenharLoja() {
  const L = M.LOJA, vip = M.ehVip(estado);
  const produto = (img, nome, desc, preco, acao, tem = false) => `<div class="produto">
    ${img}<div><div class="nome">${nome}</div><div class="detalhe">${desc}</div></div>
    ${tem ? `<span class="tem">✓ ${t('seu')}</span>` : `<button class="botao" ${acao} ${rp < preco ? `disabled title="${t('Diamantes insuficientes')}"` : ''}>${fmt(preco)} 💎</button>`}</div>`;
  const pets = Object.entries(M.SKINS_PET).flatMap(([pet, lista]) => lista.map((sk) => ({ pet, ...sk })));
  $('#mercado-loja').innerHTML = `
    <button type="button" class="banner-diamantes" data-doar>
      <span class="bd-gema" aria-hidden="true">💎</span>
      <span class="bd-texto"><b>${t('Comprar diamantes')}</b><small>${(ingles ? t('Você tem {qtd} 💎 · pacotes a partir de {preco} · cartão de crédito ou débito', { qtd: fmt(rp), preco: 'US$ 4' }) : t('Você tem {qtd} 💎 · pacotes a partir de {preco} · PIX ou cartão', { qtd: fmt(rp), preco: 'R$ 4' }))}</small></span>
      <span class="bd-acao">${t('Comprar')}</span>
    </button>
    ${CONVIDADO ? '' : `<button type="button" class="botao loja-enviar" data-enviar-dia>💎 ${t('Enviar diamantes para outro jogador')}</button>`}
    <div class="rotulo">${t('Apoio')}</div>
    ${produto('<span class="icone-loja vip">★</span>', t('VIP {dias} dias', { dias: M.VIP.dias }) + ` <span class="selo-efeitos promo">🔥 ${t('promoção')}</span>`, vip ? t('ativo · {dias} dias restantes (soma mais {mais})', { dias: diasRestantes(), mais: M.VIP.dias }) : t('+20% XP, drop e refino, poções automáticas'), M.VIP.preco, 'data-vip')}
    <div class="rotulo">${t('Treino')}</div>
    ${produto('<span class="icone-loja">⟲</span>', L.resetHab.nome, L.resetHab.desc, L.resetHab.preco, 'data-loja="resetHab"')}
    ${produto('<span class="icone-loja">⚖</span>', L.resetAtrib.nome, L.resetAtrib.desc, L.resetAtrib.preco, 'data-loja="resetAtrib"')}
    <div class="rotulo">${t('Personagem')}</div>
    ${produto('<span class="icone-loja">✎</span>', t(L.nome.nome), sessao.convidado ? t('Salve a sua conta para trocar o nome.') : t(L.nome.desc), L.nome.preco, `data-loja-nome${sessao.convidado ? ' disabled' : ''}`)}
    <div class="rotulo">${t('Runeterra')}</div>
    ${produto('<span class="icone-loja">🕊</span>', t(L.bencao.nome), estado.bencoes ? t('Ativa: protege a sua próxima morte em Runeterra. Depois dela, compre outra.') : t(L.bencao.desc), L.bencao.preco, 'data-loja="bencao"', !!estado.bencoes)}
    <div class="rotulo">${t('Skins de {campeao}', { campeao: CAMPEAO.nome })}</div>
    ${M.skinsDe(estado).filter((sk) => sk.aVenda).map((sk) => produto(`<span class="skin-mini" style="background-image:url(${splashSkin(CAMP, sk.num)})"><img src="${miniatura(spriteCampeao(CAMP, sk.num))}" alt=""></span>`, sk.nome + (sk.efeitos ? ` <span class="selo-efeitos">✨ ${t('efeitos')}</span>` : ''), sk.efeitos ? t('muda o visual e as cores das habilidades') : t('muda o visual do campeão'), sk.preco, `data-loja="skin" data-alvo="${sk.num}"`, M.temSkin(estado, sk.num))).join('')}
    <div class="rotulo">${t('Skins de mascote')}</div>
    ${pets.map((p) => produto(`<img class="pet-mini" src="${miniatura(`${M.MASCOTES[p.pet].nome}@${p.id}`)}" alt="">`, p.nome, t(M.MASCOTES[p.pet].nome), L.skinPet.preco, `data-loja="skinPet" data-alvo="${p.pet}:${p.id}"`, M.temSkinPet(estado, p.pet, p.id))).join('')}
    <div class="rotulo">${t('Skins de montaria')}</div>
    ${M.SKINS_MONTARIA.map((sk) => produto(`<img class="pet-mini" src="${miniatura('Montaria@' + sk.id)}" alt="">`, t(sk.nome), t('troca o visual da sua montaria em Runeterra (a velocidade vem do nível)'), sk.preco, `data-loja="skinMontaria" data-alvo="${sk.id}"`, M.montariaDe(estado).skins.includes(sk.id))).join('')}`;
}
// operação no servidor: leva o estado e copia o que voltou (o que mudou enquanto a resposta vinha é somado)
// erro de uma ação no Ornn aparece na própria janela dele (antes só ia para o registro e para o aviso do mercado)
function erroOrnn(msg) {
  if ($('#janela-npc').hidden || npcAtual !== 'Ornn') return;
  $('#npc-troca').querySelector('.erro-ornn')?.remove();
  $('#npc-troca').insertAdjacentHTML('afterbegin', `<p class="erro-ornn alerta" role="alert">⚠ ${msg.replace(/[<>&]/g, '')}</p>`);
  cena.aviso(msg, '#ff7060');
}
async function operarServidor(rota, dados = {}) {
  if (operando) return null;
  operando = true; prepararSave(); mostrarErroMercado('');
  const ouro0 = estado.ouro, qtd0 = estado.mochila.length, gemas0 = { ...(estado.gemas || {}) };
  try {
    const r = await rede.operar(rota.startsWith('/') ? rota : `/api/mercado/${rota}`, { estado, ...dados });
    const novos = estado.mochila.slice(qtd0);
    estado.rev = r.rev; estado.ouro = r.ouro + (estado.ouro - ouro0);
    estado.mochila = [...r.mochila, ...novos].slice(0, M.MOCHILA);
    if (r.revelados?.length) aplicarRevelados(r.revelados, true);         // a mochila já veio avaliada do servidor
    const caiu = Object.fromEntries(Object.entries(estado.gemas || {}).map(([g, q]) => [g, Math.max(0, q - (gemas0[g] || 0))]));
    if (r.mudou) Object.assign(estado, r.mudou);
    if (r.mudou?.gemas) for (const [g, q] of Object.entries(caiu)) if (q) estado.gemas[g] = (estado.gemas[g] || 0) + q;
    if (r.diamantes != null) { rp = r.diamantes; mostrarDiamantes(); }
    if (r.orbs != null) { orbs = r.orbs; mostrarOrbs(); }
    atualizarUI();
    return r;
  } catch (e) {
    if (e.recusado) { avisar(e.message + ' ' + t('O jogo vai voltar para o último progresso salvo.'), { titulo: t('Progresso recusado'), ok: t('Voltar ao último save') }).then(() => location.reload()); }
    else if (e.desatualizado) location.reload();
    else { log(e.message, 'morte'); erroOrnn(e.message); if (!rota.startsWith('/') && !$('#janela-mercado')?.hidden) avisoMercado(e.message); else mostrarErroMercado(e.message); }
    return null;
  } finally { operando = false; }
}
// Mestre da Legião: o mesmo reset da Loja, pago em ouro (o servidor confere o ouro e aplica)
async function resetarNoMestre(produto) {
  const hab = produto === 'resetHab', preco = M.precoResetOuro(estado.nivel);
  const gastos = hab ? Object.values(estado.ranks || {}).reduce((s, r) => s + r, 0) : Object.values(estado.atrib || {}).reduce((s, v) => s + v, 0);
  if (!gastos) { const msg = hab ? t('Você não tem pontos de habilidade para devolver.') : t('Você não tem pontos de atributo para devolver.'); log(msg, 'morte'); cena.aviso(msg, '#ffb060'); return; }
  if (estado.ouro < preco) { const msg = t('Você precisa de {n} de ouro.', { n: inteiro(preco) }); log(msg, 'morte'); cena.aviso(msg, '#ffb060'); return; }
  const texto = hab ? t('Esquecer todas as habilidades por {preco} de ouro? Os {n} pontos voltam para você aprender de novo, e a barra fica vazia.', { preco: inteiro(preco), n: gastos })
    : t('Refazer os atributos por {preco} de ouro? Os {n} pontos voltam para você distribuir de novo.', { preco: inteiro(preco), n: gastos });
  if (!(await confirmar(texto, { titulo: hab ? t('Esquecer habilidades') : t('Refazer atributos'), ok: t('Pagar {preco} de ouro', { preco: inteiro(preco) }), cancelar: t('Cancelar'), perigo: true }))) return;
  const r = await operarServidor('/api/mestre/reset', { produto });
  if (!r) return;
  som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040');
  if (hab) { barraDesenhada = null; log(t('Seus {n} pontos de habilidade estão livres: aprenda com o + na aba Habilidades e monte a barra.', { n: estado.pontos }), 'npc'); abrirAba('habilidades'); }
  else { log(t('Seus {n} pontos de atributo estão livres: distribua na aba Atributos.', { n: estado.pontosAtrib }), 'npc'); abrirAba('atributos'); }
}
// trocar o nome do personagem (Loja, 200 💎): o servidor confere e cobra; o progresso guardado neste navegador pelo nome
// (tutorial, Próximo passo, chaves, posição em Runeterra…) passa para o nome novo, e o jogo recarrega
async function trocarNome() {
  const velho = estado.nome, preco = M.LOJA.nome.preco;
  const nome = (await pedirTexto(t('Digite o nome novo: de 3 a 16 letras ou números. O nível, os itens e todo o resto continuam. Custa {preco} 💎 diamantes.', { preco }),
    { titulo: '✎ ' + t('Trocar o nome'), ok: t('Trocar por {preco} 💎', { preco }), valor: velho, max: 16 }))?.trim().replace(/\s+/g, ' ');
  if (!nome || nome === velho) return;
  let r;
  try { prepararSave(); await rede.salvarNoServidor(estado); r = await rede.trocarNome(nome); }
  catch (e) { await avisar(e.message, { titulo: '✎ ' + t('Trocar o nome') }); return; }
  try {
    for (const k of Object.keys(localStorage)) for (const sep of [':', '-']) if (k.startsWith('lolidle-') && k.endsWith(sep + velho)) {
      localStorage.setItem(k.slice(0, -velho.length) + r.nome, localStorage.getItem(k)); localStorage.removeItem(k);
    }
  } catch {}
  rede.lembrarNome(r.nome); rp = r.diamantes; mostrarDiamantes();
  await avisar(t('Pronto! Agora o seu personagem se chama {nome}. O jogo vai recarregar.', { nome: r.nome }), { titulo: '✎ ' + t('Nome trocado') });
  estado.nome = r.nome; location.reload();
}
async function comprarNaLoja(produto, alvo) {
  const p = { ...M.LOJA[produto], preco: M.precoLoja(estado, produto, alvo) };
  const nome = produto === 'skin' ? M.skinsDe(estado).find((x) => x.num === +alvo).nome
    : produto === 'skinPet' ? M.SKINS_PET[alvo.split(':')[0]].find((x) => x.id === alvo.split(':')[1]).nome
    : produto === 'skinMontaria' ? t(M.SKINS_MONTARIA.find((x) => x.id === alvo).nome) : p.nome;
  if (!(await confirmar(t('{nome} por {preco} 💎 diamantes.', { nome, preco: fmt(p.preco) }), { titulo: t('Comprar na Loja'), ok: t('Comprar') }))) return;
  const r = await operarServidor('/api/loja/comprar', { produto, alvo });
  if (!r) return;
  som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040');
  log(t('Você comprou {nome}!', { nome }), 'raro');
  if (produto === 'resetHab') { barraDesenhada = null; log(t('Seus {n} pontos de habilidade estão livres: aprenda com o + na aba Habilidades e monte a barra.', { n: estado.pontos }), 'npc'); }
  if (produto === 'resetAtrib') { log(t('Seus {n} pontos de atributo estão livres: distribua na aba Atributos.', { n: estado.pontosAtrib }), 'npc'); }
  if (produto === 'skin') cena.definirSkin(estado.skin);
  if (produto === 'skinPet') cena.definirMascote(M.spriteMascote(estado));
  if (produto === 'skinMontaria') atualizarMontaria();
  if (produto === 'bencao') log(t('Bênção Protetora ativa: na sua próxima morte em Runeterra, nenhum item cai. Depois dela, é preciso comprar outra.'), 'npc');
  montarSkins(); atualizarUI(); desenharMercado();
}
async function cliqueMercado(e) {
  const sec = e.target.closest('[data-secao]');
  if (sec) { if (sec.dataset.secao === 'jogadores') return abrirMercadoJogadores(); secaoMercado = 'loja'; desenharMercado(); return; }
  const grp = e.target.closest('[data-grupo]');
  if (grp) { grupoSel = grp.dataset.grupo; desenharMercadoJog(); $('#mj-detalhe').scrollTop = 0; return; }
  const cat = e.target.closest('[data-cat]');
  if (cat) { mercadoCat = cat.dataset.cat; desenharMercadoJog(); return; }
  const aba = e.target.closest('[data-aba]');
  if (aba && aba.closest('.abas-mercado')) { abaMercado = aba.dataset.aba; vendendo = null; reservaPara = ''; if (abaMercado === 'historico') histMercado = null; desenharMercado(); return; }
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.hasAttribute('data-doar')) return abrirVip();
  if (b.hasAttribute('data-loja-nome')) return trocarNome();
  if (b.hasAttribute('data-recarregar')) { erroMercado = null; desenharMercado(); return carregarMercado(); }
  if (b.hasAttribute('data-vip')) { if (await confirmar(t('{dias} dias de VIP por {preco} 💎 diamantes.', { dias: M.VIP.dias, preco: fmt(M.VIP.preco) }), { titulo: '★ ' + t('Ativar VIP'), ok: t('Ativar VIP') })) await ativarVipAgora(); return desenharMercado(); }
  if (b.dataset.loja) return comprarNaLoja(b.dataset.loja, b.dataset.alvo);
  if (b.dataset.moedaVenda) {
    moedaVenda = b.dataset.moedaVenda; $('#vender-moeda').value = moedaVenda;
    document.querySelectorAll('[data-moeda-venda]').forEach((x) => { const sim = x.dataset.moedaVenda === moedaVenda; x.classList.toggle('ativa', sim); x.setAttribute('aria-pressed', sim); });
    atualizarLiquido(); desenharMercadoJog(); return;      // o preço sugerido muda com a moeda
  }
  if (b.dataset.escolher != null) { vendendo = /^[gm]:/.test(b.dataset.escolher) ? b.dataset.escolher : +b.dataset.escolher; desenharMercado(); $('#vender-preco')?.focus(); return; }
  if (b.hasAttribute('data-anunciar')) {
    const preco = Math.floor(+$('#vender-preco').value), moeda = $('#vender-moeda').value;
    const para = ($('#vender-para')?.disabled ? '' : $('#vender-para')?.value || '').trim(), extraPara = para ? { para } : {};
    if (!(preco >= 1)) { avisoMercado(t('Digite um preço.')); return; }
    if (para && para.toLowerCase() === NOME.toLowerCase()) { avisoMercado(t('Não dá para reservar para você mesmo nem para outro personagem da sua conta.')); return; }
    // abaixo do que os jogadores pagam: o mínimo trava (o servidor também) e perto dele o jogo pergunta antes
    const itemRef = typeof vendendo === 'string' ? (vendendo.startsWith('m:') ? 'mascote:' + vendendo.slice(2) : `gema:${vendendo.slice(2)}:${Math.max(1, Math.floor(+($('#vender-qtd')?.value || 1)))}`) : estado.mochila[vendendo];
    const rf = refsMercado.get(itemRef + '|' + moeda)?.ref;
    if (rf && preco < rf.minimo) {
      await avisar(t('O preço mínimo para este item é {min}. Os jogadores pagam em torno de {ref} por ele nas vendas recentes, e o mercado não aceita menos que um quarto disso.', { min: precoCheio(rf.minimo, moeda), ref: precoCheio(rf.valor, moeda) }), { titulo: t('Preço abaixo do mínimo'), ok: t('Usar o preço mínimo') });
      const campo = $('#vender-preco'); if (campo) { campo.value = rf.minimo; atualizarLiquido(); }
      return;
    }
    if (rf && preco < rf.aviso && !(await confirmar(t('Os jogadores pagam em torno de {ref} por este item e você está anunciando por {preco}. Anunciar mesmo assim?', { ref: precoCheio(rf.valor, moeda), preco: precoCheio(preco, moeda) }), { titulo: t('Preço bem abaixo do normal'), ok: t('Anunciar') }))) return;
    if (typeof vendendo === 'string' && vendendo.startsWith('m:')) {          // o Poro de Bigode (p677): sai da conta toda
      const pet = vendendo.slice(2), nome = t(M.MASCOTES[pet]?.nome || pet);
      if (!(await confirmar(t('Anunciar o {pet} por {preco}? Ele sai da sua conta agora (de todos os seus personagens) e quem comprar começa no nível 1. Se você cancelar ou a oferta vencer, ele volta pela caixa do mercado.', { pet: nome, preco: fmtPreco(preco, moeda) }), { titulo: t('Vender mascote'), ok: t('Anunciar') }))) return;
      b.disabled = true;
      if (await operarServidor('vender', { mascote: pet, preco, moeda, ...extraPara })) {
        log(para ? t('Você reservou {item} para {nome} por {preco}.', { item: nome, nome: para, preco: fmtPreco(preco, moeda) }) : t('Você anunciou {item} por {preco} no mercado.', { item: nome, preco: fmtPreco(preco, moeda) }), 'item');
        som.efeito('compra'); vendendo = null; cena.definirMascote(M.spriteMascote(estado));
      }
      return carregarMercado();
    }
    if (typeof vendendo === 'string') {          // lote de gemas
      const gema = vendendo.slice(2), qtd = Math.floor(+$('#vender-qtd').value);
      if (!(qtd >= 1 && qtd <= (estado.gemas?.[gema] || 0))) { avisoMercado(t('Quantidade inválida.')); return; }
      b.disabled = true;
      if (await operarServidor('vender', { gema, qtd, preco, moeda, ...extraPara })) { log(para ? t('Você reservou {item} para {nome} por {preco}.', { item: M.nomeOferta(`gema:${gema}:${qtd}`), nome: para, preco: fmtPreco(preco, moeda) }) : t('Você anunciou {item} por {preco} no mercado.', { item: M.nomeOferta(`gema:${gema}:${qtd}`), preco: fmtPreco(preco, moeda) }), 'item'); som.efeito('compra'); vendendo = null; }
      return carregarMercado();
    }
    const id = estado.mochila[vendendo];
    b.disabled = true;
    if (await operarServidor('vender', { indice: vendendo, preco, moeda, ...extraPara })) { log(para ? t('Você reservou {item} para {nome} por {preco}.', { item: descreverItem(id).nome, nome: para, preco: fmtPreco(preco, moeda) }) : t('Você anunciou {item} por {preco} no mercado.', { item: descreverItem(id).nome, preco: fmtPreco(preco, moeda) }), 'item'); som.efeito('compra'); vendendo = null; }
    return carregarMercado();
  }
  if (b.dataset.comprar) {
    b.disabled = true;
    const o = dadosMercado.ofertas.find((x) => x.id === +b.dataset.comprar);
    if (o && await confirmar(t('{item}, vendido por {vendedor}, por {preco}.', { item: descreverOferta(o.item).nome, vendedor: o.vendedor, preco: fmtPreco(o.preco, o.moeda) }), { titulo: t('Comprar no mercado'), ok: t('Comprar') }) && await operarServidor('comprar', { id: o.id })) {
      log(t('Você comprou {item} de {vendedor} por {preco}.', { item: descreverOferta(o.item).nome, vendedor: o.vendedor, preco: fmtPreco(o.preco, o.moeda) }), 'raro'); som.efeito('moeda');
    }
    return carregarMercado();
  }
  if (b.dataset.cancelar) {
    b.disabled = true;
    const rc = await operarServidor('cancelar', { id: +b.dataset.cancelar });
    if (rc) log(rc.mascoteFicou ? t('Oferta cancelada. A sua conta já tem outro Poro de Bigode, então este ficou na caixa do mercado: venda o seu para poder recolher este.') : t('Oferta cancelada: o item voltou para a mochila (ou para a caixa, se a mochila estava cheia).'), 'npc');
    return carregarMercado();
  }
  if (b.hasAttribute('data-receber')) {
    b.disabled = true;
    const r = await operarServidor('receber');
    if (r) {
      const { ouro, diamantes, orbs: gem, itens, ficaram } = r.recebido;
      const partes = [ouro && t('{qtd} de ouro', { qtd: fmt(ouro) }), diamantes && t('{qtd} diamantes', { qtd: fmt(diamantes) }), gem && t('{qtd} Gemas', { qtd: fmt(gem) }), itens.length && `${itens.length} ${itens.length > 1 ? t('itens') : t('item')}`].filter(Boolean);
      log(t('Mercado: você recebeu {partes}.', { partes: partes.join(', ') || t('nada') }) + (ficaram ? ' ' + t('{n} item(ns) ficaram na caixa (mochila cheia).', { n: ficaram }) : ''), 'raro');
      if (ouro || diamantes || gem) som.efeito('moeda');
      if (r.recebido.mascoteFicou) log(t('O Poro de Bigode ficou na caixa: a sua conta já tem outro. Venda o seu no mercado para poder recolher este.'), 'morte');
    }
    return carregarMercado();
  }
}
$('[data-painel="mercado"]').addEventListener('click', cliqueMercado);
$('#janela-mercado').addEventListener('click', cliqueMercado);
$('#janela-mercado').addEventListener('input', (e) => {
  if (e.target.id === 'vender-preco') e.target.dataset.editado = '1';      // o que o jogador digitou não é trocado pela sugestão
  if (e.target.id === 'vender-para') {
    reservaPara = e.target.value.trim();
    const bt = $('#janela-mercado [data-anunciar]'); if (bt) bt.textContent = reservaPara ? t('Reservar para {nome}', { nome: reservaPara }) : t('Anunciar no mercado');
    e.target.closest('.vf-reserva')?.classList.toggle('ativa', !!reservaPara);
    return;
  }
  if (e.target.id === 'vender-preco' || e.target.id === 'vender-moeda') atualizarLiquido();
  else if (e.target.closest('#mercado-filtros')) desenharMercadoJog();
});
$('#abrir-mercado').addEventListener('click', () => abrirMercadoJogadores());
$('#abrir-loja-dia').addEventListener('click', () => abrirMercado('loja'));
// avisa quando alguém compra o que você anunciou (confere a caixa de vez em quando)
let caixaAvisada = 0;
setInterval(async () => {
  try {
    const cheio = !$('#janela-mercado').hidden && !(abaMercado === 'vender' && vendendo != null);
    const dm = cheio ? await rede.mercado() : await fetch('/api/mercado?leve=1', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('lol-idle-token') || '') } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    const n = dm.caixa.filter((c) => c.ouro > 0 || c.diamantes > 0).length;
    if (n > caixaAvisada) { log(t('Mercado: você vendeu um item! Recolha no Mercado (tecla J).'), 'raro'); som.efeito('moeda'); }
    caixaAvisada = n; rp = dm.diamantes ?? rp; mostrarDiamantes();
    // a janela aberta atualiza, menos com um anúncio pela metade (apagaria o preço digitado)
    if (cheio && !$('#janela-mercado').hidden) { dadosMercado = dm; desenharMercadoJog(); }
  } catch {}
}, 30000);

// ---------- chat: Global (todos) e Fonte (balões em cima dos personagens) ----------
const caixas = { servidor: $('#log'), global: $('#chat-global'), ajuda: $('#chat-ajuda'), fonte: $('#chat-fonte'), guilda: $('#chat-guilda'), privado: $('#chat-privado') };
const naoLidas = { global: 0, ajuda: 0, fonte: 0, guilda: 0, privado: 0 };
// privado: com quem você está conversando, quem falou com você por último (/r) e quem você bloqueou (só neste navegador)
let privadoCom = null, ultimoQueFalou = null;
const bloqueados = new Set(lerLocal('lolidle-bloqueados', []));
const salvarBloqueados = () => gravarLocal('lolidle-bloqueados', [...bloqueados]);
function placeholderChat() {
  const c = canalAtivo;
  $('#chat-texto').placeholder = c === 'ajuda' ? t('Tire sua dúvida: os tutores respondem aqui…') : c === 'fonte' ? t('Falar com quem está perto de você…') : c === 'guilda' ? t('Mensagem para a sua guilda…')
    : c === 'privado' ? (privadoCom ? t('Mensagem para {nome}… (/w nome para outra pessoa)', { nome: privadoCom }) : t('Escreva /w nome mensagem, ou clique no nome de alguém')) : t('Mensagem para todos os jogadores…');
}
// abre a conversa privada com alguém (botão Conversar da ficha)
function conversarCom(nome) {
  privadoCom = nome;
  if (chatMin) { chatMin = false; gravarLocal('lolidle-chat-min', false); aplicarChat(); }
  trocarCanal('privado'); $('#chat-texto').focus();
}
const vistas = new Set();
let canalAtivo = 'servidor', chatDesde = 0, primeiraLeitura = true;
function trocarCanal(canal) {
  canalAtivo = canal;
  for (const b of document.querySelectorAll('#abas-console .aba')) {
    const sim = b.dataset.canal === canal;
    b.classList.toggle('ativa', sim); b.setAttribute('aria-selected', sim);
  }
  for (const [c, el] of Object.entries(caixas)) el.hidden = c !== canal;
  $('#chat-form').hidden = canal === 'servidor';
  placeholderChat();
  if (naoLidas[canal] !== undefined) { naoLidas[canal] = 0; marcarNaoLidas(canal); }
  caixas[canal].scrollTop = caixas[canal].scrollHeight;
}
function marcarNaoLidas(canal) {
  const el = document.querySelector(`#abas-console [data-canal="${canal}"] .nao-lidas`);
  el.hidden = !naoLidas[canal]; el.textContent = naoLidas[canal] > 99 ? '99+' : naoLidas[canal];
  if (['privado', 'guilda', 'fonte'].includes(canal)) el.closest('.aba')?.classList.toggle('tem-msg', !!naoLidas[canal]);      // a aba pisca (p703)
  $('#chat-min')?.classList.toggle('tem-msg', ['privado', 'guilda'].some((c) => naoLidas[c] > 0));      // e o botão do chat minimizado (só Privado e Guilda, p707)
}
function linhaChat(canal, filhos, classe = '') {
  const el = caixas[canal], p = document.createElement('p');
  const noFim = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  p.className = 'chat ' + classe; p.append(...filhos);
  el.append(p);
  while (el.children.length > 150) el.firstChild.remove();
  if (noFim || canal !== canalAtivo) el.scrollTop = el.scrollHeight;
}
// @nome no chat (sugestão de jogador): o @ de qualquer nome fica em negrito; o seu, destacado, e a linha inteira acende
const fimNome = '(?![\\p{L}\\p{N}_])', escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mencionaMim = (texto) => new RegExp('@' + escRe(NOME) + fimNome, 'iu').test(texto);
function pedacosMencao(texto) {
  // nomes com espaço ("Rito Gomes"): os conhecidos (o seu e os de quem falou no chat) vêm antes, do mais comprido ao mais curto
  const compostos = [...new Set([NOME, ...recentesChat()])].filter((n) => n.includes(' ')).sort((a, b) => b.length - a.length).map(escRe);
  const re = new RegExp(`(@(?:${[...compostos, '[\\p{L}\\p{N}_]+'].join('|')}))`, 'iu');
  return texto.split(re).filter(Boolean).map((x) => {
    if (!x.startsWith('@')) return document.createTextNode(x);
    const b = document.createElement('b'); b.className = 'marcado' + (x.slice(1).toLowerCase() === NOME.toLowerCase() ? ' eu' : ''); b.textContent = x; return b;
  });
}
function mostrarMsg(m) {
  if (vistas.has(m.id)) return;
  vistas.add(m.id);
  const d = new Date(m.t), hora = document.createElement('span'), quem = document.createElement('span'), texto = document.createElement('span');
  hora.className = 'hora'; hora.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} `;
  if (m.aviso) {          // aviso do servidor (baús das fortalezas): sem nome, em dourado
    const v = { ...m.aviso.v }; if (v.zona) v.zona = t(R.NOME_ZONA[v.zona] || v.zona);
    if (v.itemId) v.item = t(M.ITENS[v.itemId]?.nome || v.itemId);
    if (v.oferta) { v.item = descreverOferta(v.oferta).nome; if (v.valor != null) v.preco = fmtPreco(v.valor, v.moeda); }      // oferta reservada: o item e o preço no idioma do jogador
    texto.className = 'texto'; texto.textContent = (v.oferta ? '🔒 ' : v.itemId ? '✨ ' : '📦 ') + t(m.aviso.pt, v);
    linhaChat(m.canal, [hora, texto], 'aviso-servidor');
    if (m.canal === 'privado' && !primeiraLeitura) {
      log(texto.textContent, 'raro'); som.efeito('mensagem');
      if (canalAtivo !== 'privado') { naoLidas.privado++; marcarNaoLidas('privado'); }
    }
    return;
  }
  if (m.nome !== NOME && bloqueados.has(m.nome)) return;      // bloqueado: não aparece em nenhum canal
  const tit = m.canal === 'privado' ? [] : titulosDe(m.nome);
  quem.className = 'quem'; quem.textContent = (m.vip ? '★ ' : '') + tit.map((r) => r.selo + ' ').join('') + (m.canal === 'privado' && m.nome === NOME ? '→ ' + m.para : m.nome);
  const outro = m.canal === 'privado' && m.nome === NOME ? m.para : m.nome;
  if (outro !== NOME) { quem.dataset.perfil = outro; quem.title = t('Ver {nome} ou conversar', { nome: outro }); }      // clicar no nome abre a ficha
  if (tit.length) quem.title = tit.map((r) => r.titulo).join(' · ') + (quem.title ? '\n' + quem.title : '');
  if (m.canal === 'privado' && m.nome !== NOME) { ultimoQueFalou = m.nome; if (!privadoCom) privadoCom = m.nome; if (canalAtivo === 'privado') placeholderChat(); }
  if (m.brasao) quem.insertAdjacentHTML('afterbegin', `<span class="chat-brasao">${svgBrasao(m.brasao, 12)}</span>`);      // svgBrasao só aceita brasão válido
  const info = document.createElement('small'); info.textContent = ` [${m.nivel}]`; quem.append(info);
  texto.className = 'texto'; texto.append(': ', ...pedacosMencao(m.texto));      // só nós de texto: nada de HTML vindo de outros jogadores
  const marcou = m.nome !== NOME && mencionaMim(m.texto);
  const CARGOS_CHAT = { tutor: { rot: t('Tutor'), dica: t('Tutor do LoL Idle: pode tirar dúvidas sobre o jogo') } };
  const cargo = CARGOS_CHAT[m.cargo];
  const tag = cargo && Object.assign(document.createElement('span'), { className: 'tag-cargo ' + m.cargo, textContent: cargo.rot, title: cargo.dica });
  linhaChat(m.canal, tag ? [hora, tag, quem, texto] : [hora, quem, texto], (m.nome === NOME ? 'meu' : '') + (marcou ? ' mencao' : ''));
  if (marcou && !primeiraLeitura) { log(t('{nome} marcou você no chat: {texto}', { nome: m.nome, texto: m.texto.slice(0, 80) }), 'npc'); if (m.canal !== canalAtivo || chatMin) cena.aviso(t('{nome} marcou você no chat', { nome: m.nome }), '#ffd84a'); }
  if (m.canal !== canalAtivo && m.nome !== NOME) { naoLidas[m.canal]++; marcarNaoLidas(m.canal); }
  if (!primeiraLeitura && m.nome !== NOME) som.efeito(marcou ? 'alerta' : 'mensagem');
  if (!primeiraLeitura && m.canal === 'privado' && m.nome !== NOME && canalAtivo !== 'privado') log(t('Mensagem privada de {nome}: abra a aba Privado (ou responda com /r).', { nome: m.nome }), 'npc');
  if (m.canal === 'fonte' && !primeiraLeitura) cena.falar(m.nome, m.texto);
  if (!primeiraLeitura && m.nome !== NOME && m.canal === 'privado') avisoMensagem(m);      // (p703; só o Privado desde o p713, Local e Guilda piscam a aba)
  if (!primeiraLeitura && m.nome !== NOME && m.canal === 'privado') som.alertaPrivado();      // barulhinho do privado (p706)
}
// aviso de mensagem nova (p703): no canto da tela, quando o chat não está mostrando aquele canal; clicar abre o chat nele
const CANAL_AVISO = { privado: ['✉', 'Privado', 'privado'], guilda: ['🛡', 'Guilda', 'guilda'], fonte: ['💬', 'Local', 'local'] };
let tituloOriginal = document.title, tituloTimer = null;
function avisoMensagem(m) {
  const vendo = !document.hidden && !chatMin && canalAtivo === m.canal;
  if (document.hidden && !tituloTimer) { tituloOriginal = document.title; let k = 0; tituloTimer = setInterval(() => { document.title = k++ % 2 ? tituloOriginal : `💬 ${t('Nova mensagem')}`; }, 1000); }
  if (vendo) return;
  const [ico, rot, cls] = CANAL_AVISO[m.canal];
  let caixa = $('#avisos-msg'); if (!caixa) { caixa = Object.assign(document.createElement('div'), { id: 'avisos-msg' }); document.body.append(caixa); }
  const el = document.createElement('button'); el.type = 'button'; el.className = 'aviso-msg ' + cls;
  const topo = document.createElement('b'), corpo = document.createElement('span');
  topo.textContent = `${ico} ${t(rot)} · ${m.nome}`; corpo.textContent = String(m.texto || '').slice(0, 90);      // texto puro: nada de HTML de outros jogadores
  el.append(topo, corpo);
  el.addEventListener('click', () => { if (chatMin) { chatMin = false; gravarLocal('lolidle-chat-min', false); aplicarChat(); } if (m.canal === 'privado') privadoCom = m.nome; trocarCanal(m.canal); $('#chat-texto')?.focus(); el.remove(); });
  caixa.prepend(el); while (caixa.children.length > 3) caixa.lastChild.remove();
  setTimeout(() => el.remove(), 8000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && tituloTimer) { clearInterval(tituloTimer); tituloTimer = null; document.title = tituloOriginal; } });
async function buscarChat() {
  try {
    const r = await rede.lerChat(chatDesde);
    for (const m of r.msgs) mostrarMsg(m);
    chatDesde = Math.max(chatDesde, r.ultimo);
  } catch {}
  primeiraLeitura = false;
}
buscarChat();
setInterval(buscarChat, 2000);
// chat minimizável (lembrado neste navegador); em tela baixa de computador começa minimizado, para as abas terem espaço
let chatMin = lerLocal('lolidle-chat-min', innerHeight < 800 && innerWidth > 1000);
$('#abas-console').insertAdjacentHTML('beforeend', '<button type="button" id="chat-min"></button>');
function aplicarChat() {
  $('#console').classList.toggle('minimizado', chatMin);
  const b = $('#chat-min');
  b.textContent = chatMin ? '▴' : '▾';
  b.title = chatMin ? t('Abrir o chat') : t('Minimizar o chat');
  b.setAttribute('aria-expanded', String(!chatMin));
}
aplicarChat();
$('#chat-min').addEventListener('click', (e) => { e.stopPropagation(); chatMin = !chatMin; gravarLocal('lolidle-chat-min', chatMin); aplicarChat(); });
$('#console').addEventListener('click', (e) => { const q = e.target.closest('.chat [data-perfil]'); if (q) abrirPerfil(q.dataset.perfil); });
$('#abas-console').addEventListener('click', (e) => {
  const b = e.target.closest('[data-canal]');
  if (!b) return;
  if (chatMin) { chatMin = false; gravarLocal('lolidle-chat-min', false); aplicarChat(); }      // clicar num canal abre o chat
  trocarCanal(b.dataset.canal);
});
// ---------- convidado: jogou sem conta; salva o progresso com nome, email e senha ----------
const CONVIDADO = !!sessao.convidado;
// veio do aviso "Salvar o convidado" da tela de criar conta: abre a janela de salvar (e o tutorial fica para depois)
const ABRIR_SALVAR = CONVIDADO && new URLSearchParams(location.search).has('salvar');
if (CONVIDADO) {
  $('#painel-status .corpo').insertAdjacentHTML('afterbegin', `<div id="aviso-convidado"><b>${t('Você está jogando como convidado.')}</b>
    <span>${t('Salve para não perder o personagem e liberar o chat, o mercado e a loja.')}</span>
    <button type="button" class="botao principal" id="abrir-salvar">${t('Salvar meu progresso')}</button></div>`);
  $('#chat-texto').disabled = true; $('#chat-texto').placeholder = t('Salve seu progresso para usar o chat');
  if (ABRIR_SALVAR) { history.replaceState(null, '', location.pathname); setTimeout(() => abrirSalvar(), 1200); }
}
let captchaSalvar = null;
async function abrirSalvar() {
  $('#janela-salvar').hidden = false; $('#salvar-erro').textContent = '';
  if (!captchaSalvar) captchaSalvar = await captchaEm('#salvar-captcha');
  $('#salvar-nome').focus();
}
document.addEventListener('click', (e) => { if (e.target.closest('#abrir-salvar')) abrirSalvar(); });
let salvarPasso = 'dados';
$('#salvar-corrigir').addEventListener('click', () => { salvarPasso = 'dados'; $('#salvar-dados').hidden = false; $('#salvar-codigo').hidden = true; $('#salvar-enviar').textContent = t('Mandar código para o email'); });
$('#salvar-codigo-campo').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#salvar-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = $('#salvar-nome').value.trim(), email = $('#salvar-email').value.trim(), senha = $('#salvar-senha').value;
  const erro = $('#salvar-erro'), botao = $('#salvar-enviar');
  erro.textContent = '';
  if (salvarPasso === 'dados') {
    if (senha !== $('#salvar-senha2').value) { erro.textContent = t('As senhas não são iguais.'); return; }
    const captcha = captchaSalvar?.token();
    if (captcha === '') { erro.textContent = t('Confirme que você não é um robô (a caixinha acima do botão).'); return; }
    botao.disabled = true;
    try {
      await rede.pedirCodigo(nome, senha, email, CAMP, captcha);
      salvarPasso = 'codigo'; $('#salvar-dados').hidden = true; $('#salvar-codigo').hidden = false; $('#salvar-codigo-email').textContent = email;
      botao.textContent = t('Salvar meu progresso'); $('#salvar-codigo-campo').focus();
    } catch (falha) { erro.textContent = falha.message; }
    finally { botao.disabled = false; captchaSalvar?.renovar(); }
    return;
  }
  const codigo = $('#salvar-codigo-campo').value.trim();
  if (!/^\d{6}$/.test(codigo)) { erro.textContent = t('Digite os 6 números do código.'); return; }
  botao.disabled = true;
  try {
    prepararSave(); try { await rede.salvarNoServidor(estado); } catch {}
    const salvo = await rede.salvarConvidado(nome, senha, email, codigo);
    rede.lembrarEmail(email); rede.lembrarNome(nome);
    await avisar(t('Pronto! Seu progresso está salvo na conta {nome}. Daqui em diante você entra com {email} e a sua senha.', { nome, email })
      + (salvo?.diasVip ? ' ' + t('De presente, você ganhou mais {dias} dia de VIP.', { dias: salvo.diasVip }) : ''), { titulo: t('Progresso salvo') });
    location.reload();
  } catch (falha) { erro.textContent = falha.message; botao.disabled = false; }
});
// lembretes: ao chegar no nível 5 e no 10, o convidado é lembrado de salvar
let lembrouNivel = 0;
setInterval(() => {
  if (!CONVIDADO) return;
  const marco = [10, 5].find((n) => estado.nivel >= n && lembrouNivel < n);
  if (!marco) return;
  lembrouNivel = marco;
  log(t('Você chegou ao nível {n} como convidado. Salve seu progresso para não perder o personagem.', { n: marco }), 'raro');
  if (marco === 10) abrirSalvar();
}, 5000);

// ---------- presente do nível 3: um épico da classe do campeão, para o começo ficar com cara de progresso ----------
// aparece ao chegar no nível 3 (e, para quem já passou, ao entrar, até o nível 9); o servidor entrega uma vez por conta
let presentePego = !!sessao.presenteNivel;
// só a qualidade e os atributos (sem o nome repetido, a receita do Ornn e o valor no Lojista)
const presenteLinhas = (id) => { const ls = textoItem(id).split('\n').slice(1, -1); if (M.receitaDe(M.baseId(id))) ls.pop(); return ls; };
function oferecerPresente() {
  const P = M.PRESENTE_NIVEL;
  if (presentePego || estado.nivel < P.nivel || estado.nivel > P.ateNivel || !$('#janela-presente').hidden) return;
  // com o tutorial (ou um tour) na tela, ou outra janela aberta, espera e tenta de novo
  if (tutorial || tour || tourRt || naAram() || document.querySelector('.dialogo-fundo') || [...document.querySelectorAll('.janela')].some((j) => !j.hidden)) { setTimeout(oferecerPresente, 5000); return; }
  const id = M.presenteNivelDe(estado), d = descreverItem(id);
  funil('presente:viu');
  $('#presente-corpo').innerHTML = `
    <div class="presente-item"><img src="${imgItem(id)}" alt=""><div><b class="cor-${d.raridade}">${escG(d.nome)}</b><small>${M.NOME_RARIDADE[d.raridade]} · ${t('qualidade {q}', { q: d.qual })}</small></div></div>
    <p class="presente-stats">${presenteLinhas(id).map(escG).join('<br>')}</p>
    <p>${t('Você chegou ao nível 3! Este item épico é seu: equipado, o campeão bate mais forte e aguenta mais.')}</p>
    <p class="alerta presente-erro" hidden></p>
    <button type="button" class="botao principal presente-pegar">${t('Pegar e equipar')}</button>`;
  $('#janela-presente').hidden = false;
}
$('#janela-presente').addEventListener('click', async (e) => {
  const b = e.target.closest('.presente-pegar');
  if (!b) return;
  b.disabled = true;
  const r = await operarServidor('/api/presente-nivel');
  if (!r) { const er = $('#presente-corpo .presente-erro'); er.hidden = false; er.textContent = $('#mercado-erro').textContent || t('Não deu certo. Tente de novo.'); b.disabled = false; return; }
  presentePego = true;
  const k = estado.mochila.lastIndexOf(r.item);
  if (k >= 0 && M.equipar(estado, k)) log(t('Você equipou {item}.', { item: descreverItem(r.item).nome }), 'item');
  atualizarUI();
  $('#janela-presente').hidden = true;
  cena.aviso(t('Presente equipado: {item}!', { item: descreverItem(r.item).nome }), '#c792ff');
  som.efeito('raro');
  salvar();
  if (CONVIDADO) setTimeout(convidarParaSalvar, 2500);
});
// convidado no nível 3: convite para salvar a conta (com +1 dia de VIP), uma vez
const CHAVE_CONVITE = `lolidle-convite-salvar:${NOME}`;
async function convidarParaSalvar() {
  if (!CONVIDADO || lerLocal(CHAVE_CONVITE) || estado.nivel < M.PRESENTE_NIVEL.nivel) return;
  gravarLocal(CHAVE_CONVITE, 1);
  funil('convite-salvar:viu');
  const ok = await confirmar(t('Você está jogando como convidado. Salve sua conta (nome, email e senha) para não perder o personagem e ganhe mais {dias} dia de VIP de presente.', { dias: M.VIP.salvarConvidado }),
    { titulo: t('Salve sua conta e ganhe VIP'), ok: t('Salvar minha conta'), cancelar: t('Agora não') });
  if (ok) { funil('convite-salvar:aceitou'); abrirSalvar(); }
}
setTimeout(() => { if (!presentePego && estado.nivel >= M.PRESENTE_NIVEL.nivel) oferecerPresente(); else convidarParaSalvar(); }, 6000);

// perguntas de quem está perdido ("como joga?", "ajuda", "o que eu faço?")
const PERGUNTA_AJUDA = /como (se )?jog|como funciona|como (eu )?(fa[cç]o|upo|upa)|o que (eu )?(fa[cç]o|tem que fazer)|^\s*ajuda|^\s*help|how (to|do (i|you)) play|what (do|should) i do/i;
function ajudaNoChat(canal) {
  setTimeout(() => {
    linhaChat(canal, [t('Dica: o campeão caça sozinho. Abra o Mapa (tecla M), escolha a Rota Inferior e deixe ele lutar. Volte à Fonte (tecla B) para vender o saque no Lojista, pegar tarefas com o Capitão e forjar itens no Ornn. O quadro "Próximo passo", no canto do jogo, mostra o que fazer agora.')], 'sistema');
    mostrarObjetivo(true);
  }, 400);
}
$('#chat-form').addEventListener('submit', async () => {
  const campo = $('#chat-texto'), texto = campo.value.trim();
  if (!texto) return;
  // comandos: /w nome mensagem (privado), /r mensagem (responde a quem falou por último), /bloquear nome, /desbloquear nome
  const cmd = texto.match(/^\/(w|whisper|msg|r|bloquear|block|desbloquear|unblock)(?:\s+(.*))?$/i);
  if (cmd) {
    const c = cmd[1].toLowerCase(), resto = (cmd[2] || '').trim();
    if (c === 'bloquear' || c === 'block' || c === 'desbloquear' || c === 'unblock') {
      const nome = resto.trim();          // o nome inteiro (pode ter espaço)
      if (!nome) { linhaChat(canalAtivo === 'servidor' ? 'global' : canalAtivo, [t('Escreva o nome: /bloquear nome')], 'sistema'); return; }
      alternarBloqueio(nome, c === 'bloquear' || c === 'block'); campo.value = ''; return;
    }
    let para, msg;
    if (c === 'r') { para = ultimoQueFalou; msg = resto; if (!para) { linhaChat('privado', [t('Ninguém mandou mensagem privada para você ainda.')], 'sistema'); trocarCanal('privado'); return; } }
    else ({ para, msg } = await separarDestino(resto));          // o nome pode ter espaço ("/w Rito Gomes oi")
    if (!para) { linhaChat('privado', [t('Escreva /w nome mensagem.')], 'sistema'); trocarCanal('privado'); return; }
    privadoCom = para; trocarCanal('privado');
    if (!msg) { campo.value = ''; return; }
    return enviarPrivado(para, msg);
  }
  if (canalAtivo === 'privado') {
    if (!privadoCom) { linhaChat('privado', [t('Escreva /w nome mensagem, ou clique no nome de alguém no chat ou no ranking.')], 'sistema'); return; }
    return enviarPrivado(privadoCom, texto);
  }
  const canal = canalAtivo === 'fonte' || canalAtivo === 'guilda' || canalAtivo === 'ajuda' ? canalAtivo : 'global';
  campo.disabled = true;
  try { const r = await rede.enviarChat(canal, texto); campo.value = ''; mostrarMsg(r.msg); if (PERGUNTA_AJUDA.test(texto)) ajudaNoChat(canal); }
  catch (e) { linhaChat(canal, [e.message], 'sistema'); }
  finally { campo.disabled = false; campo.focus(); }
});

// autocompletar do @nome (e do /w nome) no chat (pedido do dono): enquanto digita, a lista de quem está online (e de quem
// falou no chat); ↑ ↓ escolhem, Enter ou Tab completam, Esc fecha (com a lista aberta, o Enter não envia)
const sugestoes = Object.assign(document.createElement('div'), { id: 'chat-sugestoes', hidden: true });
$('#chat-form').prepend(sugestoes);
let sugLista = [], sugK = 0, sugPedido = 0, sugAlvo = null, sugTimer = 0;
const recentesChat = () => [...new Set([...document.querySelectorAll('#console .chat [data-perfil]')].map((q) => q.dataset.perfil).reverse())];
function alvoSugestao() {
  const c = $('#chat-texto'), antes = c.value.slice(0, c.selectionStart ?? c.value.length), m = antes.match(/(?:^\/w\s+|@)([\p{L}\p{N}_][\p{L}\p{N}_ ]{0,15}|)$/u);      // nomes podem ter espaço (até 16 letras)
  return m ? { prefixo: m[1], ini: antes.length - m[1].length } : null;
}
const fecharSugestoes = () => { sugLista = []; sugestoes.hidden = true; };
function desenharSugestoes() {
  sugestoes.hidden = !sugLista.length;
  sugestoes.innerHTML = sugLista.map((n, k) => `<button type="button" tabindex="-1" data-sug="${k}"${k === sugK ? ' class="ativa"' : ''}>@${esc(n)}</button>`).join('');
}
async function atualizarSugestoes() {
  const a = alvoSugestao(); sugAlvo = a;
  if (!a) return fecharSugestoes();
  const pedido = ++sugPedido, p = a.prefixo.toLowerCase();
  const daqui = recentesChat().filter((n) => n.toLowerCase().startsWith(p));
  let doServidor = [];
  try { doServidor = (await rede.buscarJogadores(a.prefixo)).nomes || []; } catch {}
  if (pedido !== sugPedido) return;
  sugLista = [...new Set([...daqui, ...doServidor])].filter((n) => n !== NOME).slice(0, 8); sugK = 0;
  desenharSugestoes();
}
function completarSugestao(k) {
  const n = sugLista[k], c = $('#chat-texto'), a = sugAlvo;
  if (!n || !a) return;
  const fim = c.selectionStart ?? c.value.length;
  c.value = c.value.slice(0, a.ini) + n + ' ' + c.value.slice(fim);
  const pos = a.ini + n.length + 1; c.setSelectionRange(pos, pos); c.focus(); fecharSugestoes();
}
$('#chat-texto').addEventListener('input', () => { clearTimeout(sugTimer); sugTimer = setTimeout(atualizarSugestoes, 120); });
$('#chat-texto').addEventListener('keydown', (e) => {
  if (sugestoes.hidden || !sugLista.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); sugK = (sugK + (e.key === 'ArrowDown' ? 1 : sugLista.length - 1)) % sugLista.length; desenharSugestoes(); }
  else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); completarSugestao(sugK); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharSugestoes(); }
});
sugestoes.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-sug]'); if (b) { e.preventDefault(); completarSugestao(+b.dataset.sug); } });
$('#chat-texto').addEventListener('blur', () => setTimeout(fecharSugestoes, 150));
// "/w Rito Gomes oi": o nome pode ter espaço. Procura, entre quem está online e quem falou no chat, o nome mais comprido
// com que o texto começa; sem nenhum, vale a primeira palavra
async function separarDestino(resto) {
  const r = resto.toLowerCase(), primeira = resto.split(/\s+/)[0];
  let nomes = recentesChat();
  try { nomes = nomes.concat((await rede.buscarJogadores(primeira)).nomes || []); } catch {}
  const achado = nomes.filter((n) => r === n.toLowerCase() || r.startsWith(n.toLowerCase() + ' ')).sort((a, b) => b.length - a.length)[0];
  if (achado) return { para: achado, msg: resto.slice(achado.length).trim() };
  const k = resto.indexOf(' ');
  return { para: k < 0 ? resto : resto.slice(0, k), msg: k < 0 ? '' : resto.slice(k + 1).trim() };
}
async function enviarPrivado(para, msg) {
  const campo = $('#chat-texto');
  campo.disabled = true;
  try { const r = await rede.enviarChat('privado', msg, para); campo.value = ''; mostrarMsg(r.msg); }
  catch (e) { linhaChat('privado', [e.message], 'sistema'); }
  finally { campo.disabled = false; campo.focus(); }
}
function alternarBloqueio(nome, bloquear) {
  if (bloquear) { bloqueados.add(nome); if (privadoCom === nome) privadoCom = null; } else bloqueados.delete(nome);
  salvarBloqueados();
  log(bloquear ? t('Você bloqueou {nome}: as mensagens dele não aparecem mais para você. Para desfazer: /desbloquear {nome}', { nome }) : t('Você desbloqueou {nome}.', { nome }), 'npc');
  if (!$('#janela-perfil').hidden && $('#perfil-titulo').textContent === nome) abrirPerfil(nome);
}

// ---------- personagens (até 3 por conta) ----------
// cada personagem tem o próprio campeão, nível, itens, ouro e cofre; diamantes, VIP, Gemas e skins compradas são da conta.
// Só um joga por vez: entrar num derruba as abas dos outros. Trocar salva, troca o token e recarrega já no outro.
let infoPersonagens = null, apagandoPersonagem = null;
async function abrirPersonagens() {
  $('#janela-personagens').hidden = false; apagandoPersonagem = null;
  $('#personagens-corpo').innerHTML = `<p class="fraco">${t('Carregando…')}</p>`;
  try { infoPersonagens = await rede.personagens(); } catch (e) { $('#personagens-corpo').innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
  desenharPersonagens();
}
function desenharPersonagens(erro = '') {
  const d = infoPersonagens; if (!d) return;
  const cartao = (p) => {
    const c = dadosCampeao(p.campeao), atual = p.id === d.atual, apagando = apagandoPersonagem === p.id;
    return `<div class="pers-cartao${atual ? ' atual' : ''}">
      <img class="pers-sprite" src="${miniatura(spriteCampeao(p.campeao, p.skin))}" alt="">
      <div class="pers-info"><b>${esc(p.nome)}</b><small>${esc(c.nome)} · ${t('nível {n}', { n: p.nivel })}</small>${p.principal ? `<small class="fraco">${t('personagem da conta')}</small>` : ''}</div>
      ${atual ? `<span class="pers-selo">${t('jogando agora')}</span>` : `<button type="button" class="botao principal" data-pers-jogar="${p.id}">${t('Jogar')}</button>`}
      ${!p.principal && !apagando ? `<button type="button" class="link pers-apagar" data-pers-apagar="${p.id}">${t('Apagar')}</button>` : ''}
      ${apagando ? `<div class="pers-confirma"><p>${t('Apagar {nome} para sempre (nível, itens, ouro e cofre)? Digite o nome para confirmar:', { nome: esc(p.nome) })}</p>
        <input type="text" id="pers-conf" maxlength="16" autocomplete="off"><div><button type="button" class="botao" data-pers-cancelar>${t('Cancelar')}</button> <button type="button" class="botao botao-perigo" data-pers-confirmar="${p.id}">${t('Apagar')}</button></div></div>` : ''}
    </div>`;
  };
  const vagas = Math.max(0, d.max - d.lista.length);
  const novo = d.convidado
    ? `<div class="pers-cartao vazio"><p>${t('Salve a sua conta para ter até {n} personagens.', { n: d.max })}</p><button type="button" class="botao principal" data-pers-salvar>${t('Salvar meu progresso')}</button></div>`
    : vagas ? `<div class="pers-cartao vazio"><label>${t('Novo personagem')}<input type="text" id="pers-nome" maxlength="16" placeholder="${t('Nome do personagem')}" autocomplete="off"></label>
        <button type="button" class="botao principal" data-pers-criar>${t('Escolher o campeão')}</button></div>` : '';
  const vazias = d.convidado ? 0 : Math.max(0, vagas - 1);
  $('#personagens-corpo').innerHTML = `<p class="fraco">${t('Cada personagem tem o próprio campeão, nível, itens, ouro e cofre. Diamantes, VIP, Gemas e as skins compradas são da conta e valem em todos. Só um personagem joga por vez.')}</p>
    <div class="pers-lista">${d.lista.map(cartao).join('')}${novo}${'<div class="pers-cartao vazio livre"><span>' + t('Espaço livre') + '</span></div>'.repeat(vazias)}</div>
    ${erro ? `<p class="erro">${esc(erro)}</p>` : ''}`;
  $('#pers-conf')?.focus();
}
// antes de trocar: salva o personagem atual e sai da Fonte (para os outros não verem um boneco parado)
async function salvarAntesDeTrocar() {
  prepararSave();
  try { await rede.salvarNoServidor(estado); } catch {}
  await rede.presenca({ naFonte: false }).catch(() => {});
}
$('#abrir-personagens').addEventListener('click', abrirPersonagens);
$('#janela-personagens').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const corpo = $('#personagens-corpo');
  try {
    if (b.dataset.persJogar) {
      b.disabled = true; b.textContent = t('Entrando…');
      await salvarAntesDeTrocar();
      await rede.trocarPersonagem(Number(b.dataset.persJogar));
      location.href = '/jogar';
    } else if (b.dataset.persApagar) { apagandoPersonagem = Number(b.dataset.persApagar); desenharPersonagens(); }
    else if (b.hasAttribute('data-pers-cancelar')) { apagandoPersonagem = null; desenharPersonagens(); }
    else if (b.dataset.persConfirmar) {
      b.disabled = true;
      const id = Number(b.dataset.persConfirmar), r = await rede.apagarPersonagem(id, $('#pers-conf').value.trim());
      log(t('O personagem {nome} foi apagado.', { nome: r.nome }), 'sistema');
      if (r.token) { location.href = '/jogar'; return; }          // apagou o personagem em que estava: volta para o primeiro
      apagandoPersonagem = null; await abrirPersonagens();
    } else if (b.hasAttribute('data-pers-salvar')) { $('#janela-personagens').hidden = true; abrirSalvar(); }
    else if (b.hasAttribute('data-pers-criar')) {
      const nome = $('#pers-nome').value.trim();
      if (nome.length < 3) { desenharPersonagens(t('O nome precisa ter de 3 a 16 letras ou números (espaços simples no meio são permitidos).')); return; }
      $('#janela-personagens').hidden = true;
      const escolhido = await escolherCampeao({ inicial: CAMP, botao: t('Criar {nome}', { nome }) + ' · {nome}', cancelar: true,
        aoConfirmar: async (camp) => { await salvarAntesDeTrocar(); await rede.criarPersonagem(nome, camp); } });
      if (escolhido) { location.href = '/jogar'; return; }
      $('#janela-personagens').hidden = false; desenharPersonagens();
    }
  } catch (falha) { b.disabled = false; desenharPersonagens(falha.message.includes('fetch') ? t('Não foi possível falar com o servidor.') : t(falha.message)); }
  void corpo;
});

// ---------- sair ----------
$('#sair').addEventListener('click', async () => {
  if (CONVIDADO) {         // convidado sem salvar: sair perde o personagem (não tem email nem senha para voltar)
    if (!(await confirmar(t('Você está jogando como convidado, sem email e senha. Se sair agora, não vai conseguir voltar para este personagem. Salve o progresso antes.'), { titulo: t('Sair e perder o personagem?'), ok: t('Sair mesmo assim'), perigo: true }))) return;
  } else if (!(await confirmar(t('Seu progresso está salvo no servidor e continua de onde parou quando você entrar de novo.'), { titulo: t('Sair da conta de {nome}?', { nome: NOME }), ok: t('Sair') }))) return;
  $('#sair').disabled = true; $('#sair').textContent = t('Saindo…');
  prepararSave();
  try { await rede.salvarNoServidor(estado); } catch {}
  await rede.presenca({ naFonte: false }).catch(() => {});
  await rede.sair();
  try { sessionStorage.setItem('lol-idle-saiu', NOME); } catch {}
  location.href = '/jogar';          // sem o #criar, a tela volta na aba Entrar
});

// ---------- ranking ----------
const nomeTitulo = (id) => M.CONQUISTAS.find((c) => c.id === id)?.titulo || '';
// ---------- Ranking (10/10/2026, pedido do dono): por nível, Poder ou abates, com filtros, e os títulos do 1º lugar ----------
const RANKINGS = {
  nivel: { nome: t('Nível'), icone: '🏆', titulo: t('Dono do Mundo'), selo: '👑' },
  poder: { nome: t('Poder'), icone: '⚔', titulo: t('O Mais Forte do Mundo'), selo: '⚔' },
  abates: { nome: t('Abates'), icone: '💀', titulo: t('O Grande Caçador'), selo: '💀' },
};
let rkTipo = 'nivel', rkCamp = '', rkGuilda = false, rkBusca = '', rkPedido = 0, rkTimer = 0;
const titulosDe = (nome) => Object.entries(donosRanking || {}).filter(([k, n]) => n && n === nome && RANKINGS[k]).map(([k]) => RANKINGS[k]);
const seloTitulos = (nome) => titulosDe(nome).map((r) => `<span class="rk-dono" title="${esc(t('1º lugar no ranking de {ranking}', { ranking: r.nome }))}">${r.selo} ${esc(r.titulo)}</span>`).join(' ');
function aplicarDonos(d) { if (d && typeof d === 'object') donosRanking = d; }
function desenharRankingFiltros() {
  $('#ranking-filtros').innerHTML = `<div class="rk-tipos">${Object.entries(RANKINGS).map(([k, r]) => `<button type="button" class="rk-tipo${rkTipo === k ? ' ativo' : ''}" data-rk-tipo="${k}">${r.icone} ${r.nome}</button>`).join('')}</div>
    <div class="rk-filtros">
      <div class="rk-camps">${['', ...Object.keys(M.KITS)].map((c) => `<button type="button" class="rk-camp${rkCamp === c ? ' ativo' : ''}" data-rk-camp="${c}" title="${c ? esc(dadosCampeao(c).nome) : esc(t('Todos os campeões'))}">${c ? `<img src="${miniatura(spriteCampeao(c, 0))}" alt="${esc(dadosCampeao(c).nome)}">` : t('Todos')}</button>`).join('')}</div>
      <input type="search" id="rk-busca" placeholder="${esc(t('Procurar pelo nome'))}" value="${esc(rkBusca)}" maxlength="20">
      <label class="rk-guilda-filtro"><input type="checkbox" id="rk-guilda" ${rkGuilda ? 'checked' : ''}> ${t('Só a minha guilda')}</label>
    </div>`;
}
async function carregarRanking() {
  const n = ++rkPedido, el = $('#ranking');
  el.innerHTML = `<p class="fraco">${t('Carregando…')}</p>`;
  try {
    const r = await rede.ranking({ tipo: rkTipo, campeao: rkCamp, guilda: rkGuilda ? '1' : '', q: rkBusca });
    if (n !== rkPedido) return;
    aplicarDonos(r.donos);
    const { lista, eu } = r, R = RANKINGS[rkTipo];
    const col = (k, v) => `<td class="num${k === rkTipo ? ' rk-ordem' : ''}">${v}</td>`;
    const linha = (p, pos) => `<tr class="${pos && pos <= 3 ? 'top' + pos : ''}${p.nome === NOME ? ' eu' : ''}">
      <td class="pos">${pos ? (ingles ? '#' + pos : pos + 'º') : '–'}</td>
      <td class="rk-nome" data-perfil="${esc(p.nome)}" title="${t('Ver o equipamento de {nome}', { nome: esc(p.nome) })}"><img src="${miniatura(spriteCampeao(p.campeao || 'darius', p.skin))}" alt=""> ${p.vip ? '<span class="vip">★</span> ' : ''}${esc(p.nome)}${seloTitulos(p.nome) ? ' ' + seloTitulos(p.nome) : ''}${p.titulo ? ` <span class="titulo">${nomeTitulo(p.titulo)}</span>` : ''}${p.guilda ? ` <span class="rk-guilda">${svgBrasao(p.guilda.brasao, 14)} ${esc(p.guilda.nome)}</span>` : ''}</td>
      ${col('nivel', p.nivel)}${col('poder', fmt(p.poder || 0))}${col('abates', fmt(p.abates))}</tr>`;
    const donos = `<div class="rk-donos">${Object.entries(RANKINGS).map(([k, x]) => { const nome = r.donos?.[k]; return `<div class="rk-dono-card${nome === NOME ? ' eu' : ''}"${nome ? ` data-perfil="${esc(nome)}" title="${esc(t('1º lugar no ranking de {ranking}', { ranking: x.nome }))}"` : ''}><span class="rk-dono-ico">${x.selo}</span><div><small>${x.titulo}</small><b>${nome ? esc(nome) : '—'}</b></div></div>`; }).join('')}</div>`;
    const naLista = eu && eu.pos && eu.pos <= lista.length;
    const fora = eu && !naLista ? `<tr><td colspan="5" class="fraco">…</td></tr>${linha(eu, eu.pos)}` : '';
    const vazio = r.semGuilda ? t('Você não está numa guilda.') : t('Ninguém com esses filtros.');
    el.innerHTML = donos + (lista.length
      ? `<div class="rk-tabela"><table><thead><tr><th>#</th><th>${t('Personagem')}</th><th class="${rkTipo === 'nivel' ? 'rk-ordem' : ''}">${t('Nível')}</th><th class="${rkTipo === 'poder' ? 'rk-ordem' : ''}" title="${t('Poder: o nível e os itens equipados (refino e qualidade contam)')}">⚔ ${t('Poder')}</th><th class="${rkTipo === 'abates' ? 'rk-ordem' : ''}">${t('Abates')}</th></tr></thead><tbody>${lista.map((p, k) => linha(p, k + 1)).join('')}${fora}</tbody></table></div>
         <p class="fraco rk-total">${t('{n} personagens · ranking de {ranking}', { n: inteiro(r.total), ranking: R.nome })}</p>`
      : `<p class="fraco rk-vazio">${vazio}</p>`);
  } catch (e) {
    if (n === rkPedido) el.innerHTML = `<p class="alerta">${t('Não foi possível carregar o ranking: {erro}', { erro: escG(e.message) })}</p>`;
  }
}
async function abrirRanking() {
  $('#janela-ranking').hidden = false;
  desenharRankingFiltros();
  salvar();
  carregarRanking();
}
$('#ranking-filtros').addEventListener('click', (e) => {
  const tp = e.target.closest('[data-rk-tipo]'), cp = e.target.closest('[data-rk-camp]');
  if (tp) rkTipo = tp.dataset.rkTipo; else if (cp) rkCamp = cp.dataset.rkCamp; else return;
  desenharRankingFiltros(); carregarRanking();
});
$('#ranking-filtros').addEventListener('input', (e) => {
  if (e.target.id !== 'rk-busca') return;
  rkBusca = e.target.value; clearTimeout(rkTimer); rkTimer = setTimeout(carregarRanking, 350);
});
$('#ranking-filtros').addEventListener('change', (e) => { if (e.target.id === 'rk-guilda') { rkGuilda = e.target.checked; carregarRanking(); } });
$('#abrir-ranking').addEventListener('click', abrirRanking);
// ficha de um jogador (clicar no nome no ranking): campeão, nível, Poder, título, guilda e os itens equipados
$('#ranking').addEventListener('click', (e) => { const td = e.target.closest('[data-perfil]'); if (td) abrirPerfil(td.dataset.perfil); });
async function abrirPerfil(nome) {
  const j = $('#janela-perfil'), corpo = $('#perfil-corpo');
  $('#perfil-titulo').textContent = nome;
  corpo.innerHTML = `<p class="fraco">${t('Carregando…')}</p>`;
  j.hidden = false;
  let p;
  try { p = await rede.perfil(nome); } catch (err) { corpo.innerHTML = `<p class="alerta">${esc(err.message)}</p>`; return; }
  const camp = dadosCampeao(p.campeao || 'darius'), lista = [p.itens.find(M.ehBota) || '', ...p.itens.filter((x) => !M.ehBota(x))];
  while (lista.length < M.ESPACOS) lista.push('');
  const slot = (x, k) => (x ? `<span class="slot ${M.raridade(M.infoItem(x))}" title="${textoItem(x).replace(/"/g, '&quot;')}"><img src="${imgItem(x)}" alt="">${rotuloRef(x)}</span>`
    : `<span class="slot vazio${k === 0 ? ' bota-slot' : ''}" title="${k === 0 ? t('Sem bota') : t('Espaço vazio')}"></span>`);
  const meu = M.poder(estado);
  corpo.innerHTML = `<div class="pf-topo">
      <span class="pf-boneco"><img src="${miniatura(spriteCampeao(p.campeao || 'darius', p.skin))}" alt=""></span>
      <div class="pf-info"><b>${p.vip ? '<span class="vip">★</span> ' : ''}${esc(p.nome)}</b>${seloTitulos(p.nome) ? `<span class="pf-donos">${seloTitulos(p.nome)}</span>` : ''}${p.titulo ? `<span class="titulo">${nomeTitulo(p.titulo)}</span>` : ''}
        <small>${esc(camp.nome)} · ${t('nível {n}', { n: p.nivel })}</small>
        ${p.guilda ? `<span class="pf-guilda">${svgBrasao(p.guilda.brasao, 18)} ${esc(p.guilda.nome)}</span>` : ''}${p.arena ? `<span class="pf-arena" title="${t('Elo na arena · vitórias: {v}, derrotas: {d}', { v: p.arena.vitorias, d: p.arena.derrotas })}">${emblemaElo(p.arena, 20)} ${textoElo(p.arena)} · ${p.arena.pdl} ${t('PDL')}</span>` : ''}</div>
      <div class="pf-poder"><span>⚔ ${t('Poder')}</span><b>${inteiro(p.poder)}</b><small>${p.nome === NOME ? '' : t('o seu: {poder}', { poder: inteiro(meu) })}</small></div>
    </div>
    <div class="bolsa-rotulo">${t('Equipamento')} <small>${t('(passe o mouse para ver os atributos)')}</small></div>
    <div class="equip-moldura"><div class="pf-equip">${lista.map(slot).join('')}</div></div>
    <p class="fraco pf-abates">${t('{n} monstros abatidos', { n: inteiro(p.abates || 0) })}</p>
    ${p.nome !== NOME && !CONVIDADO ? `<div class="pf-acoes"><button type="button" class="botao principal" data-pf-conversar="${esc(p.nome)}">💬 ${t('Conversar')}</button>
      ${amigosInfo?.amigos.some((x) => x.nome === p.nome) ? `<span class="fraco pf-amigo">✓ ${t('Seu amigo')}</span>` : `<button type="button" class="botao" data-pf-amigo="${esc(p.nome)}">➕ ${t('Adicionar amigo')}</button>`}
      <button type="button" class="botao" data-pf-desafiar="${esc(p.nome)}">⚔ ${t('Desafiar na arena')}</button>
      <button type="button" class="botao" data-pf-enviar="${esc(p.nome)}">💎 ${t('Enviar diamantes')}</button>
      <button type="button" class="botao" data-pf-bloquear="${esc(p.nome)}">${bloqueados.has(p.nome) ? t('Desbloquear') : t('Bloquear')}</button></div>` : ''}`;
}
$('#janela-perfil').addEventListener('click', (e) => {
  const cv = e.target.closest('[data-pf-conversar]'), bl = e.target.closest('[data-pf-bloquear]'), am = e.target.closest('[data-pf-amigo]'), en = e.target.closest('[data-pf-enviar]');
  if (en) { abrirEnvio(en.dataset.pfEnviar); return; }
  const dz = e.target.closest('[data-pf-desafiar]');
  if (dz) { $('#janela-perfil').hidden = true; desafiarNaArena(dz.dataset.pfDesafiar); return; }
  if (am) { pedirAmizade(am.dataset.pfAmigo).then((erro) => { if (erro) avisar(erro); else { am.disabled = true; am.textContent = t('Pedido enviado'); } carregarAmigos(); }); return; }
  if (cv) { $('#janela-perfil').hidden = true; $('#janela-ranking').hidden = true; conversarCom(cv.dataset.pfConversar); }
  if (bl) alternarBloqueio(bl.dataset.pfBloquear, !bloqueados.has(bl.dataset.pfBloquear));
});

// ---------- Sorteio nas lives oficiais da Twitch (servidor/sorteio.js): aparece no quadro de missões ----------
let sorteios = [], twitchLigadaSorteio = false;
const textoPremioSorteio = (p) => (p.tipo === 'vip' ? t('{n} dias de VIP', { n: p.n }) : t('{n} diamantes', { n: fmt(p.n) }));
function aplicarSorteio(r) {
  const antes = new Set(sorteios.map((s) => s.canal + s.fim));
  sorteios = (r.sorteios || []).filter((s) => s.fim > Date.now());
  if ('twitchLigada' in r) twitchLigadaSorteio = r.twitchLigada;
  for (const s of sorteios) if (!antes.has(s.canal + s.fim) && !s.meu && !s.participando) cena.aviso(t('🎁 Sorteio ao vivo na live de {canal}!', { canal: s.nome }), '#c9a4ff');
  for (const g of r.sorteioGanhos || []) {
    if (r.rp != null) { rp = r.rp; mostrarDiamantes(); }
    if (r.vipAte) estado.vipAte = r.vipAte;
    som.efeito('fanfarra');
    log(t('Você ganhou o sorteio da live de {canal}: {premio}!', { canal: g.canal, premio: textoPremioSorteio(g.premio) }), 'raro');
    avisar(t('Você ganhou o sorteio da live de {canal}: {premio}! O prêmio já está na sua conta. Agradeça ao {por} no chat da live.', { canal: g.canal, premio: textoPremioSorteio(g.premio), por: g.por }), { titulo: t('🎉 Você ganhou!') });
  }
  for (const a of r.sorteioAvisos || []) {
    const v = { ...a.v, ...(a.v?.erro ? { erro: typeof a.v.erro === 'object' ? t(a.v.erro.pt, a.v.erro.v) : t(a.v.erro) } : {}) };
    log('🎁 ' + t(a.pt, v), 'npc');
    cena.aviso('🎁 ' + t(a.pt, v), '#c9a4ff');
  }
  desenharSorteio();
}
function desenharSorteio() {
  const el = $('#rastreio-sorteio'), ag = Date.now(), lista = sorteios.filter((s) => s.fim > ag);
  el.hidden = !lista.length;
  if (!lista.length) return;
  const s = lista[0], falta = Math.max(0, Math.ceil((s.fim - ag) / 1000)), mm = Math.floor(falta / 60), ss = falta % 60;
  const como = s.meu ? t('o seu sorteio · {n} participando', { n: s.n }) : s.participando ? '✓ ' + t('você está participando · {n} no total', { n: s.n })
    : twitchLigadaSorteio ? t('digite !sorteio no chat da live · clique para abrir') : t('ligue a Twitch ao jogo e digite !sorteio na live');
  const html = `<b>🎁 ${t('Sorteio na live de {canal}', { canal: esc(s.nome) })}</b><small>${textoPremioSorteio(s.premio)} · ${mm}:${String(ss).padStart(2, '0')} · ${como}</small>${lista.length > 1 ? `<small>${t('+{n} sorteios em outras lives', { n: lista.length - 1 })}</small>` : ''}`;
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  el.classList.toggle('participando', !!s.participando);
}
$('#rastreio-sorteio').addEventListener('click', (e) => {
  e.currentTarget.blur();
  const s = sorteios.find((x) => x.fim > Date.now()); if (!s) return;
  if (!twitchLigadaSorteio && !s.meu) { abrirTwitch(); return; }
  window.open('https://www.twitch.tv/' + encodeURIComponent(s.canal), '_blank', 'noopener');
});
setTimeout(() => aplicarSorteio(sessao), 2600);

// ---------- Enviar diamantes para outro jogador (o servidor confere: limite do dia, diamantes do cartão presos) ----------
let envioInfo = null;
async function abrirEnvio(para = '') {
  if (CONVIDADO) { avisar(t('Salve a sua conta para enviar diamantes.')); return; }
  $('#janela-perfil').hidden = true;
  $('#janela-enviar').hidden = false;
  $('#enviar-corpo').innerHTML = `<p class="fraco">${t('Carregando...')}</p>`;
  try { envioInfo = await rede.infoEnvio(); } catch (err) { $('#enviar-corpo').innerHTML = `<p class="alerta">${esc(err.message)}</p>`; return; }
  desenharEnvio(para);
}
function desenharEnvio(para = '', erro = '') {
  const i = envioInfo, T = M.TRANSFERIR, max = Math.min(i.livres, i.restaHoje);
  const hist = i.historico.length ? `<div class="env-hist">${i.historico.map((x) => `<div class="${x.enviou ? 'saiu' : 'chegou'}"><span>${x.enviou ? '↑ ' + t('para {nome}', { nome: esc(x.nome) }) : '↓ ' + t('de {nome}', { nome: esc(x.nome) })}${x.nota ? ` <small>· ${esc(x.nota)}</small>` : ''}</span><b>${x.vip ? '★ VIP' : (x.enviou ? '−' : '+') + fmt(x.qtd) + ' 💎'}</b><small>${new Date(x.criado).toLocaleDateString(ingles ? 'en-US' : 'pt-BR')}</small></div>`).join('')}</div>`
    : `<p class="fraco">${t('Nenhuma transferência ainda.')}</p>`;
  $('#enviar-corpo').innerHTML = `<div class="env-saldo"><span>${t('Seus diamantes')}<b>${fmt(i.rp)} 💎</b></span><span>${t('Pode enviar agora')}<b>${fmt(max)} 💎</b></span></div>
    ${i.presos > 0 ? `<p class="fraco env-nota">${t('{n} diamantes comprados no cartão ficam {d} dias sem poder ser enviados.', { n: fmt(i.presos), d: T.travaCartaoDias })}</p>` : ''}
    <label class="env-campo">${t('Para quem (nome do personagem)')}<input id="env-para" maxlength="16" autocomplete="off" spellcheck="false" value="${esc(para)}"></label>
    <label class="env-campo">${t('Quantos diamantes')}<input id="env-qtd" type="number" min="${T.min}" max="${max}" step="1" inputmode="numeric"></label>
    <label class="env-campo">${t('Recado (opcional)')}<input id="env-nota" maxlength="${T.nota}" autocomplete="off" placeholder="${t('ex.: prêmio do sorteio')}"></label>
    <p class="erro" role="alert">${esc(erro)}</p>
    <button type="button" class="botao principal" id="env-enviar" ${max >= T.min ? '' : 'disabled'}>${t('Enviar')}</button>
    <p class="fraco env-nota">${t('Mínimo de {min} e até {max} por dia. Os diamantes vão para a conta do personagem e não voltam: confira o nome antes.', { min: T.min, max: inteiro(T.maxDia) })}</p>
    <div class="rotulo">${t('Últimas transferências')}</div>${hist}`;
  if (!para) $('#env-para').focus(); else $('#env-qtd').focus();
}
$('#janela-enviar').addEventListener('click', async (e) => {
  if (!e.target.closest('#env-enviar')) return;
  const para = $('#env-para').value.trim(), qtd = Math.floor(+$('#env-qtd').value || 0), nota = $('#env-nota').value.trim();
  if (!para) { $('#env-para').focus(); return; }
  if (!(qtd >= M.TRANSFERIR.min)) { $('#env-qtd').focus(); return; }
  if (!(await confirmar(t('Enviar {n} diamantes para {nome}? Não dá para desfazer.', { n: fmt(qtd), nome: para }), { titulo: t('Enviar diamantes'), ok: t('Enviar') }))) return;
  const bt = $('#env-enviar'); bt.disabled = true;
  try {
    const r = await rede.enviarDiamantes(para, qtd, nota);
    rp = r.diamantes; mostrarDiamantes(); envioInfo = r.info;
    som.efeito('moeda'); log(t('Você enviou {n} diamantes para {nome}.', { n: fmt(r.qtd), nome: r.para }), 'raro');
    desenharEnvio();
    if (!$('#mercado-loja').closest('[hidden]')) desenharLoja();
  } catch (err) { desenharEnvio(para, err.message); $('#env-qtd').value = qtd; $('#env-nota').value = nota; }
});
document.addEventListener('click', (e) => { if (e.target.closest('[data-enviar-dia]')) abrirEnvio(); });
// diamantes que outro jogador mandou (chegam no save ou ao entrar)
function aplicarRecebidos(lista, novo) {
  if (!lista?.length) return;
  if (novo != null) { rp = novo; mostrarDiamantes(); }
  for (const x of lista) {
    log(t('{nome} enviou {n} diamantes para você.', { nome: x.de, n: fmt(x.qtd) }) + (x.nota ? ` (${x.nota})` : ''), 'raro');
    cena.aviso(t('+{n} 💎 de {nome}', { n: fmt(x.qtd), nome: x.de }), '#8ae8ff');
  }
  som.efeito('fanfarra');
  // a janela (antes só o registro e o aviso, e quem recebia nem percebia)
  const linhas = lista.map((x) => t('{nome} enviou {n} diamantes para você.', { nome: x.de, n: fmt(x.qtd) }) + (x.nota ? '\n' + t('Recado: "{nota}"', { nota: x.nota }) : ''));
  avisar(linhas.join('\n\n') + (novo != null ? '\n\n' + t('Agora você tem {n} 💎.', { n: fmt(novo) }) : ''), { titulo: t('💎 Diamantes recebidos'), ok: t('Oba!') });
}
setTimeout(() => aplicarRecebidos(sessao.recebidos), 2500);

// ---------- Amigos (lista de amigos: pedir pelo nome ou pela ficha, aceitar, conversar, chamar para o grupo) ----------
let amigosInfo = null, amigosOnline = null, pedidosAmizade = 0;
const ondeAmigo = (l) => (l && Object.hasOwn(M.LOCAL, l) ? escG(t(M.LOCAL[l].nome)) : '');      // o lugar vem do save de outro jogador: só um que existe
async function carregarAmigos() { try { amigosInfo = await rede.amigos(); } catch { amigosInfo = null; } return amigosInfo; }
function desenharAmigos(erro = '') {
  const caixa = $('#amigos'), a = amigosInfo;
  if (CONVIDADO) { caixa.innerHTML = `<p class="fraco">${t('Salve sua conta para ter uma lista de amigos.')}</p>`; return; }
  if (!a) { caixa.innerHTML = `<p class="fraco">${t('Carregando...')}</p>`; return; }
  const naArenaEu = !!localAtual().arena;
  const pessoa = (x, extra) => `<div class="am-pessoa${x.online ? ' on' : ''}"><img src="${miniatura(spriteCampeao(x.campeao || 'darius', x.skin))}" alt=""><span><b>${esc(x.nome)}</b><small>${t('nível {n}', { n: x.nivel })}${extra || ''}</small></span>`;
  const lista = [...a.amigos].sort((x, y) => (y.online - x.online) || x.nome.localeCompare(y.nome));
  const amigos = lista.map((x) => pessoa(x, x.online ? ' · ' + ondeAmigo(x.local) : '')
    + `<span class="am-acoes">${x.online ? `<button type="button" class="botao" data-am-conversar="${esc(x.nome)}" title="${t('Conversar')}">💬</button>` : ''}`
    + `${x.online && naArenaEu && x.local === 'arena' ? `<button type="button" class="botao" data-am-grupo="${esc(x.nome)}" title="${t('Chamar para o grupo')}">👥</button>` : ''}`
    + `<button type="button" class="botao gd-recusar" data-am-remover="${esc(x.nome)}" title="${t('Remover da lista')}">×</button></span></div>`).join('');
  const recebidos = a.recebidos.map((x) => pessoa(x) + `<span class="am-acoes"><button type="button" class="botao principal" data-am-aceitar="${esc(x.nome)}">${t('Aceitar')}</button><button type="button" class="botao gd-recusar" data-am-recusar="${esc(x.nome)}" title="${t('Recusar')}">×</button></span></div>`).join('');
  const enviados = a.enviados.map((n) => `<div class="am-enviado"><span>${esc(n)}</span><small>${t('esperando resposta')}</small><button type="button" class="botao gd-recusar" data-am-cancelar="${esc(n)}" title="${t('Cancelar o pedido')}">×</button></div>`).join('');
  const on = lista.filter((x) => x.online).length;
  caixa.innerHTML = `<div class="gd-convidar"><input id="am-nome" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${t('nome do personagem')}"><button type="button" class="botao" id="am-pedir">${t('Adicionar')}</button></div>
    <p class="gd-erro" id="am-erro">${esc(erro)}</p>
    ${recebidos ? `<div class="rotulo">${t('Pedidos de amizade')}</div><div class="am-lista">${recebidos}</div>` : ''}
    <div class="rotulo">${t('Amigos ({n}/{max})', { n: lista.length, max: a.max })} <small class="fraco">${t('{n} online', { n: on })}</small></div>
    <div class="am-lista">${amigos || `<p class="fraco">${t('Ninguém ainda. Adicione pelo nome ou clicando no nome de alguém no chat ou no ranking.')}</p>`}</div>
    ${enviados ? `<div class="rotulo">${t('Pedidos enviados')}</div><div class="am-lista">${enviados}</div>` : ''}`;
}
async function abrirAmigos() { $('#janela-amigos').hidden = false; desenharAmigos(); await carregarAmigos(); desenharAmigos(); }
async function pedirAmizade(nome) {
  try {
    const r = await rede.acaoAmigos('pedir', { nome });
    log(r.amigos ? t('Você e {nome} agora são amigos!', { nome: r.nome }) : t('Pedido de amizade enviado para {nome}.', { nome: r.nome }), 'npc');
    if (r.amigos) som.efeito('raro');
    return null;
  } catch (e) { return e.message; }
}
$('#abrir-amigos').addEventListener('click', (e) => { e.stopPropagation(); e.currentTarget.blur(); abrirAmigos(); });
$('#bt-amigos')?.addEventListener('click', (e) => { e.stopPropagation(); e.currentTarget.blur(); abrirAmigos(); });      // o botão do cartão (p702)
$('#amigos').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'am-nome') $('#am-pedir').click(); });
$('#amigos').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  let erro = '';
  try {
    if (b.id === 'am-pedir') { const n = $('#am-nome').value.trim(); if (!n) return; erro = (await pedirAmizade(n)) || ''; }
    else if (b.dataset.amAceitar) { await rede.acaoAmigos('responder', { nome: b.dataset.amAceitar, aceitar: true }); log(t('Você e {nome} agora são amigos!', { nome: b.dataset.amAceitar }), 'npc'); som.efeito('raro'); }
    else if (b.dataset.amRecusar) await rede.acaoAmigos('responder', { nome: b.dataset.amRecusar, aceitar: false });
    else if (b.dataset.amCancelar) await rede.acaoAmigos('cancelar', { nome: b.dataset.amCancelar });
    else if (b.dataset.amRemover) { if (!(await confirmar(t('Remover {nome} da sua lista de amigos? Você também sai da lista dele.', { nome: b.dataset.amRemover })))) return; await rede.acaoAmigos('remover', { nome: b.dataset.amRemover }); }
    else if (b.dataset.amConversar) { $('#janela-amigos').hidden = true; conversarCom(b.dataset.amConversar); return; }
    else if (b.dataset.amGrupo) { enviarGrupo('convidar', { nome: b.dataset.amGrupo }); return; }
    else return;
  } catch (err) { erro = err.message; }
  await carregarAmigos(); desenharAmigos(erro);
  pedidosAmizade = amigosInfo?.recebidos.length || 0; mostrarPedidosAmizade();
});
function mostrarPedidosAmizade() { for (const s of document.querySelectorAll('#abrir-amigos .nao-lidas, #bt-amigos .nao-lidas')) { s.hidden = !pedidosAmizade; s.textContent = pedidosAmizade || ''; } }
// a cada save: os pedidos esperando (o número no botão) e os amigos online (avisa quando um entra)
function aplicarResumoAmigos(r) {
  if (!r) return;
  if (r.pedidos > pedidosAmizade) { log(t('Você recebeu um pedido de amizade. Veja no botão 🤝 do chat.'), 'npc'); som.efeito('mensagem'); }
  pedidosAmizade = r.pedidos; mostrarPedidosAmizade();
  if (amigosOnline) for (const n of r.online) if (!amigosOnline.has(n)) log(t('Seu amigo {nome} entrou no jogo.', { nome: n }), 'npc');
  amigosOnline = new Set(r.online);
}

// ---------- Guilda ----------
const esc = (x) => String(x ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
let guildaInfo = null, escolhaBrasao = BRASAO_PADRAO;
// o cartão do jogador mostra a guilda (clicar abre a janela)
function mostrarGuildaNoCartao() {
  const b = $('#st-guilda'), g = guildaInfo?.minha;
  $('#abas-console [data-canal="guilda"]').hidden = !g;
  if (!g && canalAtivo === 'guilda') trocarCanal('global');
  cena.meuBrasao = g?.brasao || null; cena.minhaGuilda = g?.id || 0;
  b.hidden = !g;
  if (g) b.innerHTML = `${svgBrasao(g.brasao, 18)}<span>${esc(g.nome)}</span><small>${t('{n}/{max} membros', { n: g.membros.length, max: vagasDe(g) })}</small>`;
}
async function carregarGuilda() { try { guildaInfo = await rede.guilda(); } catch { guildaInfo = null; } mostrarGuildaNoCartao(); return guildaInfo; }
function htmlCriarGuilda() {
  const [ic, cor] = escolhaBrasao.split(':');
  const podeOuro = estado.ouro >= GUILDA.custo;
  return `<div class="gd-criar">
    <div class="gd-previa">${svgBrasao(escolhaBrasao, 72)}<b id="gd-previa-nome">${t('Sua guilda')}</b></div>
    <label class="gd-campo">${t('Nome da guilda')}<input id="gd-nome" maxlength="${GUILDA.nomeMax}" autocomplete="off" spellcheck="false" placeholder="${t('de {min} a {max} letras', { min: GUILDA.nomeMin, max: GUILDA.nomeMax })}"></label>
    <div class="rotulo">${t('Símbolo')}</div>
    <div class="gd-icones">${ICONES_LISTA.map((i) => `<button type="button" class="gd-op${i === ic ? ' ativo' : ''}" data-icone="${i}">${svgBrasao(`${i}:${cor}`, 30)}</button>`).join('')}</div>
    <div class="rotulo">${t('Cor')}</div>
    <div class="gd-cores">${CORES_LISTA.map((c) => `<button type="button" class="gd-op${c === cor ? ' ativo' : ''}" data-cor="${c}">${svgBrasao(`${ic}:${c}`, 30)}</button>`).join('')}</div>
    <p class="gd-regras">${t('A guilda começa com {max} vagas, contando você, e o líder pode comprar mais com ouro, até {total}. Você vira o líder e convida os outros pelo nome.', { max: GUILDA.maxMembros, total: GUILDA.vagasMax })}</p>
    <button type="button" class="botao gd-criar-bt" id="gd-criar"${podeOuro ? '' : ' disabled'}>${t('Criar guilda por {custo} de ouro', { custo: fmt(GUILDA.custo) })}</button>
    ${podeOuro ? '' : `<p class="gd-falta">${t('Você tem {ouro} de ouro. Faltam {falta}.', { ouro: fmt(estado.ouro), falta: fmt(GUILDA.custo - estado.ouro) })}</p>`}
    <p class="gd-erro" id="gd-erro"></p>
  </div>`;
}
function desenharGuilda() {
  const caixa = $('#guilda'), info = guildaInfo;
  if (!info) { caixa.innerHTML = `<p class="fraco">${t('Carregando…')}</p>`; return; }
  if (CONVIDADO) { caixa.innerHTML = `<p class="alerta">${t('Salve seu progresso (crie a conta) para criar ou entrar numa guilda.')}</p>`; return; }
  const g = info.minha;
  if (!g) {
    const convites = info.convites.length ? `<div class="rotulo">${t('Convites')}</div><div class="gd-convites">${info.convites.map((c) => `<div class="gd-convite">${svgBrasao(c.brasao, 30)}<span><b>${esc(c.nome)}</b><small>${t('convite de {nome}', { nome: esc(c.de) })}</small></span><button type="button" class="botao" data-aceitar="${c.guilda}">${t('Aceitar')}</button><button type="button" class="botao gd-recusar" data-recusar="${c.guilda}" title="${t('Recusar')}">×</button></div>`).join('')}</div>` : '';
    // procurar uma guilda: as que existem, com o botão de pedir para entrar (o líder aceita ou recusa)
    const meus = new Set(info.meusPedidos || []);
    const lista = (info.lista || []).length ? `<div class="rotulo">${t('Procurar guilda')}</div><div class="gd-convites gd-lista">${info.lista.map((x) => {
      const cheia = x.membros >= x.vagas, pedi = meus.has(x.id);
      return `<div class="gd-convite">${svgBrasao(x.brasao, 30)}<span><b>${esc(x.nome)}</b><small>${t('{n}/{max} membros', { n: x.membros, max: x.vagas })} · ${t('líder: {nome}', { nome: esc(x.lider) })}</small></span>`
        + (pedi ? `<small class="gd-pedido-ok">${t('Pedido enviado')}</small><button type="button" class="botao gd-recusar" data-cancelar-pedido="${x.id}" title="${t('Cancelar o pedido')}">×</button>`
          : `<button type="button" class="botao" data-pedir-guilda="${x.id}" ${cheia ? 'disabled' : ''}>${cheia ? t('Cheia') : t('Pedir para entrar')}</button>`) + '</div>';
    }).join('')}</div>` : '';
    caixa.innerHTML = convites + lista + `<div class="rotulo">${t('Criar uma guilda')}</div>` + htmlCriarGuilda();
    return;
  }
  const membros = g.membros.map((m) => `<div class="gd-membro${m.online ? ' on' : ''}"><img src="${miniatura(spriteCampeao(m.campeao || 'darius', m.skin))}" alt=""><span><b>${m.vip ? '★ ' : ''}${esc(m.nome)}</b><small>${t('nível {n}', { n: m.nivel })}${m.lider ? ' · ' + t('líder') : ''}</small></span><i title="${m.online ? t('online') : t('offline')}"></i>${g.souLider && !m.lider ? `<button type="button" class="botao gd-expulsar" data-expulsar="${esc(m.nome)}" title="${t('Expulsar da guilda')}">×</button>` : ''}</div>`).join('');
  const vagas = vagasDe(g) - g.membros.length, custoVaga = custoProximaVaga(vagasDe(g));
  caixa.innerHTML = `<div class="gd-topo">${svgBrasao(g.brasao, 64)}<div><h3>${esc(g.nome)}</h3><small>${t('{n}/{max} membros', { n: g.membros.length, max: vagasDe(g) })}${g.souLider ? ' · ' + t('você é o líder') : ''}</small></div></div>
    <div class="rotulo">${t('Membros')}</div><div class="gd-membros">${membros}${Array.from({ length: vagas }, () => `<div class="gd-membro vaga"><span>${t('vaga livre')}</span></div>`).join('')}</div>
    ${g.membros.length > 1 ? `<div class="gd-chamar"><button type="button" class="botao" id="gd-chamar-grupo" ${localAtual().arena ? '' : 'disabled'}>🛡 ${t('Chamar a guilda para o grupo')}</button><small class="fraco">${localAtual().arena ? t('Convida todos da guilda que estão em Runeterra e sem grupo.') : t('O grupo existe só em Runeterra: vá para lá e chame daqui ou do botão Grupo.')}</small></div>` : ''}
    ${g.souLider && custoVaga ? `<div class="gd-vaga"><button type="button" class="botao" id="gd-vaga" ${estado.ouro + (g.cofre || 0) < custoVaga ? 'disabled' : ''}>${t('Comprar mais uma vaga ({custo} de ouro)', { custo: fmt(custoVaga) })}</button><small class="fraco">${g.cofre ? t('Usa primeiro o cofre da guilda ({qtd}); o resto sai do seu ouro.', { qtd: fmt(Math.min(g.cofre, custoVaga)) }) + ' ' : ''}${t('Até {total} vagas; cada uma custa mais que a anterior.', { total: GUILDA.vagasMax })}</small></div>` : ''}
    ${custoVaga ? blocoCofreGuilda(g, custoVaga) : ''}
    ${g.souLider && g.pedidos?.length ? `<div class="rotulo">${t('Pedidos para entrar')}</div><div class="gd-convites">${g.pedidos.map((pd) => `<div class="gd-convite"><img src="${miniatura(spriteCampeao(pd.campeao || 'darius', pd.skin))}" alt=""><span><b>${esc(pd.nome)}</b><small>${t('nível {n}', { n: pd.nivel })}</small></span><button type="button" class="botao" data-aceitar-pedido="${esc(pd.nome)}" ${vagas > 0 ? '' : 'disabled'}>${t('Aceitar')}</button><button type="button" class="botao gd-recusar" data-recusar-pedido="${esc(pd.nome)}" title="${t('Recusar')}">×</button></div>`).join('')}</div>` : ''}
    ${g.souLider && vagas > 0 ? `<div class="rotulo">${t('Convidar jogador')}</div><div class="gd-convidar"><input id="gd-convidar-nome" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${t('nome do personagem')}"><button type="button" class="botao" id="gd-convidar">${t('Convidar')}</button></div>${g.convidados.length ? `<p class="gd-pendentes">${t('Convites enviados: {lista}', { lista: g.convidados.map(esc).join(', ') })}</p>` : ''}` : ''}
    ${g.souLider ? (() => {
      const libera = (g.renomeado || 0) + GUILDA.esperaNomeDias * 86400000, falta = Math.ceil((libera - Date.now()) / 86400000);
      return `<div class="rotulo">${t('Trocar o nome')}</div><div class="gd-convidar"><input id="gd-novo-nome" maxlength="${GUILDA.nomeMax}" autocomplete="off" spellcheck="false" placeholder="${t('novo nome')}" ${falta > 0 ? 'disabled' : ''}><button type="button" class="botao" id="gd-renomear" ${falta > 0 ? 'disabled' : ''}>${t('Trocar ({custo} de ouro)', { custo: fmt(GUILDA.custoNome) })}</button></div>`
        + `<small class="fraco">${falta > 0 ? t('Dá para trocar de novo daqui a {dias} dia(s).', { dias: falta }) : t('Só o líder troca, uma vez a cada {dias} dias.', { dias: GUILDA.esperaNomeDias })}</small>`;
    })() : ''}
    <p class="gd-erro" id="gd-erro"></p>
    <button type="button" class="botao gd-sair" id="gd-sair">${g.membros.length === 1 ? t('Desfazer a guilda') : t('Sair da guilda')}</button>`;
}
// cofre da guilda: quanto tem, quanto falta para a próxima vaga, o campo para doar e quem mais doou
function blocoCofreGuilda(g, custoVaga) {
  const cofre = g.cofre || 0, falta = Math.max(0, custoVaga - cofre), top = g.doacoes?.top || [], cheio = cofre >= custoVagasRestantes(vagasDe(g));
  return `<div class="rotulo">${t('Cofre da guilda')}</div><div class="gd-cofre">
    <p><b>🪙 ${t('{qtd} de ouro', { qtd: fmt(cofre) })}</b> · ${falta ? t('faltam {falta} para a próxima vaga ({custo})', { falta: fmt(falta), custo: fmt(custoVaga) }) : t('já dá para a próxima vaga: o líder compra aqui embaixo')}</p>
    ${cheio ? '' : `<div class="gd-convidar"><input id="gd-doar-valor" type="number" min="${DOACAO_MIN}" step="1000" inputmode="numeric" placeholder="${t('quanto doar')}"><button type="button" class="botao" id="gd-doar">${t('Doar')}</button></div>`}
    <small class="fraco">${t('Qualquer membro doa ouro (a partir de {min}) e o líder usa o cofre para comprar vagas. O ouro doado não volta.', { min: inteiro(DOACAO_MIN) })}</small>
    ${top.length ? `<p class="gd-doadores">${t('Quem mais doou: {lista}', { lista: top.map((x) => `${esc(x.nome)} (${fmt(x.ouro)})`).join(', ') })}</p>` : ''}
  </div>`;
}
async function abrirGuilda() {
  $('#janela-guilda').hidden = false;
  if (!guildaInfo) desenharGuilda();
  await carregarGuilda(); desenharGuilda();
}
const erroGuilda = (m) => { const el = $('#gd-erro'); if (el) el.textContent = m; };
$('#abrir-guilda').addEventListener('click', abrirGuilda);
$('#st-guilda').addEventListener('click', abrirGuilda);
$('#guilda').addEventListener('input', (e) => { if (e.target.id === 'gd-nome') $('#gd-previa-nome').textContent = e.target.value.trim() || t('Sua guilda'); });
$('#guilda').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const [ic, cor] = escolhaBrasao.split(':');
  if (b.dataset.icone || b.dataset.cor) {
    escolhaBrasao = `${b.dataset.icone || ic}:${b.dataset.cor || cor}`;
    const nome = $('#gd-nome')?.value || ''; desenharGuilda(); $('#gd-nome').value = nome; $('#gd-previa-nome').textContent = nome.trim() || t('Sua guilda');
    return;
  }
  if (b.id === 'gd-chamar-grupo') { enviarGrupo('guilda'); $('#janela-guilda').hidden = true; return; }
  try {
    if (b.id === 'gd-criar') {
      const nome = $('#gd-nome').value.trim().replace(/\s+/g, ' ');
      if (!nomeGuildaValido(nome)) return erroGuilda(t('O nome da guilda precisa ter de {min} a {max} letras ou números.', { min: GUILDA.nomeMin, max: GUILDA.nomeMax }));
      if (!(await confirmar(t('Criar a guilda {nome} por {custo} de ouro?', { nome, custo: fmt(GUILDA.custo) }), { titulo: t('Criar guilda'), ok: t('Criar') }))) return;
      const r = await operarServidor('/api/guilda/criar', { nome, brasao: escolhaBrasao });
      if (!r) return erroGuilda($('#mercado-erro').textContent || '');
      som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040');
      log(t('Você fundou a guilda {nome}!', { nome }), 'raro');
    } else if (b.id === 'gd-renomear') {
      const nome = $('#gd-novo-nome').value.trim().replace(/\s+/g, ' ');
      if (!nomeGuildaValido(nome)) return erroGuilda(t('O nome da guilda precisa ter de {min} a {max} letras ou números.', { min: GUILDA.nomeMin, max: GUILDA.nomeMax }));
      if (!(await confirmar(t('Trocar o nome da guilda para {nome} por {custo} de ouro? Depois, só daqui a {dias} dias.', { nome, custo: fmt(GUILDA.custoNome), dias: GUILDA.esperaNomeDias }), { titulo: t('Trocar o nome'), ok: t('Trocar') }))) return;
      const r = await operarServidor('/api/guilda/renomear', { nome });
      if (!r) return erroGuilda($('#mercado-erro').textContent || '');
      som.efeito('raro');
      log(t('A guilda agora se chama {nome}.', { nome }), 'raro');
    } else if (b.id === 'gd-vaga') {
      const custo = custoProximaVaga(vagasDe(guildaInfo?.minha));
      if (!custo || !(await confirmar(t('Comprar mais uma vaga para a guilda por {custo} de ouro?', { custo: fmt(custo) }), { titulo: t('Mais uma vaga'), ok: t('Comprar') }))) return;
      const r = await operarServidor('/api/guilda/vaga');
      if (!r) return erroGuilda($('#mercado-erro').textContent || '');
      som.efeito('compra');
      log(t('A guilda agora tem {n} vagas.', { n: r.vagas }) + (r.doCofre ? ' ' + t('{qtd} saíram do cofre da guilda.', { qtd: fmt(r.doCofre) }) : ''), 'raro');
    } else if (b.id === 'gd-doar') {
      const v = Math.floor(Number($('#gd-doar-valor').value) || 0);
      if (v < DOACAO_MIN) return erroGuilda(t('Doe pelo menos {min} de ouro.', { min: inteiro(DOACAO_MIN) }));
      if (v > estado.ouro) return erroGuilda(t('Ouro insuficiente.'));
      if (!(await confirmar(t('Doar {qtd} de ouro para o cofre da guilda? O ouro doado não volta.', { qtd: fmt(v) }), { titulo: t('Doar para a guilda'), ok: t('Doar') }))) return;
      const r = await operarServidor('/api/guilda/doar', { ouro: v });
      if (!r) return erroGuilda($('#mercado-erro').textContent || '');
      som.efeito('compra');
      log(t('Você doou {qtd} de ouro para o cofre da guilda.', { qtd: fmt(v) }), 'raro');
    } else if (b.dataset.aceitar) {
      const r = await rede.acaoGuilda('aceitar', { guilda: +b.dataset.aceitar });
      log(t('Você entrou na guilda {nome}!', { nome: r.nome }), 'raro'); som.efeito('raro');
    } else if (b.dataset.recusar) {
      await rede.acaoGuilda('recusar', { guilda: +b.dataset.recusar });
    } else if (b.dataset.pedirGuilda) {
      const r = await rede.acaoGuilda('pedir', { guilda: +b.dataset.pedirGuilda });
      log(t('Pedido enviado para a guilda {nome}. O líder aceita ou recusa.', { nome: r.nome }), 'npc');
    } else if (b.dataset.cancelarPedido) {
      await rede.acaoGuilda('cancelarPedido', { guilda: +b.dataset.cancelarPedido });
    } else if (b.dataset.aceitarPedido || b.dataset.recusarPedido) {
      const aceitar = !!b.dataset.aceitarPedido, nome = b.dataset.aceitarPedido || b.dataset.recusarPedido;
      await rede.acaoGuilda('responder', { nome, aceitar });
      if (aceitar) { log(t('{nome} entrou na guilda!', { nome }), 'raro'); som.efeito('raro'); }
    } else if (b.id === 'gd-convidar') {
      const nome = $('#gd-convidar-nome').value.trim();
      if (!nome) return;
      const r = await rede.acaoGuilda('convidar', { nome });
      log(t('Convite enviado para {nome}. Ele aceita na janela da Guilda (tecla G).', { nome: r.nome }), 'npc');
    } else if (b.dataset.expulsar) {
      if (!(await confirmar(t('Expulsar {nome} da guilda?', { nome: b.dataset.expulsar }), { titulo: t('Expulsar'), ok: t('Expulsar'), perigo: true }))) return;
      await rede.acaoGuilda('expulsar', { nome: b.dataset.expulsar });
    } else if (b.id === 'gd-sair') {
      const so = guildaInfo?.minha?.membros.length === 1;
      if (!(await confirmar(so ? t('A guilda vai acabar. O ouro gasto para criar não volta.') : t('Você vai sair da guilda. Para voltar, precisa de um novo convite.'), { titulo: so ? t('Desfazer a guilda?') : t('Sair da guilda?'), ok: so ? t('Desfazer') : t('Sair'), perigo: true }))) return;
      await rede.acaoGuilda('sair');
      log(so ? t('A guilda foi desfeita.') : t('Você saiu da guilda.'), 'npc');
    } else return;
    await carregarGuilda(); desenharGuilda();
  } catch (err) { erroGuilda(err.message); }
});
if (!CONVIDADO) carregarGuilda();
setInterval(() => { if (!CONVIDADO && document.visibilityState === 'visible') carregarGuilda().then(() => { if (!$('#janela-guilda').hidden && !document.activeElement?.closest('#guilda')) desenharGuilda(); }); }, 60000);

// ---------- outros jogadores na Fonte ----------
// enquanto estiver na Fonte, avisa o servidor onde está e recebe quem mais está lá
let presencaT = 0, estavaNaFonte = false;
function atualizarPresenca(dt) {
  const naFonte = M.naBase(estado) && combate.darius.morto <= 0;
  presencaT -= dt;
  if (!naFonte) {
    if (estavaNaFonte) { estavaNaFonte = false; cena.definirOutros([]); rede.presenca({ naFonte: false }).catch(() => {}); }
    return;
  }
  estavaNaFonte = true;
  if (presencaT > 0) return;
  presencaT = 1.5;
  enviarPresenca();
}
function enviarPresenca() {
  const d = cena.destino(cena.darius);
  rede.presenca({ naFonte: true, x: d.x, y: d.y, dir: cena.darius.dir, skin: estado.skin || 0, titulo: estado.titulo || null, nivel: estado.nivel })     // o código do título: cada um vê no próprio idioma
    .then((r) => { if (M.naBase(estado)) cena.definirOutros(r.jogadores.map((j) => ({ ...j, titulo: M.CONQUISTAS.find((c) => c.id === j.titulo)?.titulo || null }))); })
    .catch(() => {});
}
// com a aba em segundo plano o jogo pausa, mas o boneco continua na Fonte para os outros enquanto a aba estiver aberta
setInterval(() => { if (document.hidden && M.naBase(estado) && combate.darius.morto <= 0) enviarPresenca(); }, 20000);
addEventListener('pagehide', () => rede.sairDaFonteAoFechar());

// ---------- mapa: Summoner's Rift e Runeterra ----------
desenharMapaLoL($('#mapa-lol'));
function corFaixa(l) {
  if (l.arena) return '#ffb040';
  if (!l.faixa) return '#6ad0ff';
  const n = estado.nivel, [a, b] = l.faixa;
  if (n < a - 3) return '#e04040';
  if (n < a) return '#e8c840';
  if (n > b + 5) return '#8a847a';
  return '#3cd23c';
}
// situação do lugar para o nível do jogador
function situacao(l) {
  if (l.base) return t('Zona segura');
  if (l.arena) return t('Você no controle');
  const n = estado.nivel, [a, b] = l.faixa;
  return n < a - 3 ? t('Perigoso para você') : n < a ? t('Um pouco difícil') : n > b + 5 ? t('Fácil demais') : t('Ideal para o seu nível');
}
// desenho do monstro (o mesmo sprite do jogo), guardado como imagem
const fotos = new Map();
const fotoMonstro = (nome) => { if (!fotos.has(nome)) fotos.set(nome, sprite(nome, DIR.S, 0).toDataURL()); return fotos.get(nome); };
// chance por abate em palavras: "1 a cada 12 abates" (números grandes arredondados: "1 a cada 3.400", "1 a cada 1,1 milhão")
const numLegivel = (n) => {
  const loc = ingles ? 'en-US' : 'pt-BR';
  if (n >= 1e6) { const m = Math.round(n / 1e5) / 10; return t(m < 2 ? '{n} milhão' : '{n} milhões', { n: m.toLocaleString(loc) }); }
  return (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n)).toLocaleString(loc);
};
const cadaAbates = (p) => (p >= 0.95 ? t('quase sempre') : p > 0 ? t('1 a cada {n} abates', { n: numLegivel(1 / p) }) : '—');
// quanto um monstro aparece no grupo, em palavras
// ícone de um drop com a chance de cair embaixo
// a chance de cada item fica no texto do mouse; na tela, só a % de cada seção
const comChance = (img) => img;
const frequencia = (f) => (f >= 0.5 ? t('comum') : f >= 0.15 ? t('às vezes') : t('raro'));
const icoLocal = (l) => (l.icone ? `<img class="mi-ico" src="assets/img/inimigos/${l.icone}.png" alt="">` : '<i class="mi-ico base-ico"></i>');
// espólios de um monstro: ícone e nome; a chance e o valor ficam no texto do mouse. Os difíceis ficam em destaque
function espoliosDe(m) {
  const lista = M.ESPOLIO_MONSTRO[m] || [], vip = M.ehVip(estado) ? M.VIP.drop : 1;
  if (!lista.length) return '';
  const comum = Math.min(...lista.map(([id]) => M.ESPOLIOS[id].valor));
  return `<div class="mi-esp">${lista.map(([id, ch]) => {
    const p = M.ESPOLIOS[id], c = Math.min(1, ch * vip), raro = ch < 0.1 || (lista.length > 1 && p.valor >= 3 * comum);
    return `<span class="esp-chip${raro ? ' raro' : ''}" title="${p.nome}${raro ? t(' (raro)') : ''}\n${cadaAbates(c)}${vip > 1 ? t(' (com VIP)') : ''}\n${t('Vale {valor} de ouro no Lojista', { valor: fmt(p.valor) })}"><img class="pixel" src="${iconeEspolio(id, p.cor)}" alt="">${p.nome} <em>${pctFino(c)}</em></span>`;
  }).join('')}</div>`;
}
// drops só para vender: os espólios dos monstros do lugar
function blocoVenda(l) {
  const vip = M.ehVip(estado) ? M.VIP.drop : 1, vistos = new Map();
  for (const m of [...l.monstros.map(([n]) => n), ...(l.chefe ? [l.chefe[0]] : [])])
    for (const [id, ch] of M.ESPOLIO_MONSTRO[m] || []) if (!vistos.has(id)) vistos.set(id, { m, ch: Math.min(1, ch * vip) });
  if (!vistos.size) return '';
  const icones = [...vistos].map(([id, { m, ch }]) => { const p = M.ESPOLIOS[id];
    return comChance(`<img class="pixel" src="${iconeEspolio(id, p.cor)}" alt="" title="${p.nome}\n${t('Cai de: {monstro}, {chance}', { monstro: t(m), chance: cadaAbates(ch) })}\n${t('Vale {valor} de ouro no Lojista', { valor: fmt(p.valor) })}">`, ch); }).join('');
  return `<div class="mi-rar venda" style="--r:#7ad0a0"><div class="mi-rar-topo"><b>${t('Espólios')}</b></div><div class="drop-itens">${icones}</div></div>`;
}
function listaMonstros(l) {
  const pesoTotal = l.monstros.reduce((s2, [, p]) => s2 + p, 0);
  return `<div class="mi-monstros">${l.monstros.map(([m, p]) => `<div class="mi-bloco">
      <div class="mi-mon"><img src="${fotoMonstro(m)}" alt=""><span>${t(m)}${M.MONSTROS[m].magico ? ` <i class="tag-magico">✦ ${t('mágico')}</i>` : ''}</span>
        <div class="mi-barra"><i style="width:${(100 * p) / pesoTotal}%"></i></div><b>${frequencia(p / pesoTotal)}</b></div>${espoliosDe(m)}</div>`).join('')}
    ${l.chefe ? `<div class="mi-bloco chefe-bloco"><div class="mi-mon chefe" title="${t('Chefe: bem mais forte e solta mais saque (inclusive lendário).')}"><img src="${fotoMonstro(l.chefe[0])}" alt=""><span>👑 ${t(l.chefe[0])}</span>
        <div class="mi-barra"><i style="width:${Math.max(3, l.chefe[1] * 100)}%"></i></div><b title="${t('1 a cada {n} grupos', { n: numLegivel(1 / l.chefe[1]) })}">${t('raro')}</b></div>${espoliosDe(l.chefe[0])}</div>` : ''}</div>`;
}
// a cidade de onde se chega a uma zona de Runeterra: a da faixa de nível dela (se ainda não foi descoberta, Demacia)
function cidadeDaZona(l) {
  const meio = (l.faixa[0] + l.faixa[1]) / 2;
  const c = R.CIDADES.find((x) => meio >= x.faixa[0] && meio <= x.faixa[1]) || R.CIDADES[0];
  return { c: descobertas.has(c.id) ? c : R.CIDADE.demacia, alvo: c };
}
function botaoZonaMundo(l) {
  const { c, alvo } = cidadeDaZona(l), aqui = combate.arena?.cidade === c.id && localAtual().arena;
  const nota = alvo.id !== c.id ? t('Para chegar mais perto, descubra {cidade} andando: depois dá para viajar direto para lá.', { cidade: alvo.nome }) : '';
  return `<button class="botao mi-ir" data-cidade="${c.id}" ${aqui ? 'disabled' : ''}>${aqui ? t('Você está em {cidade}', { cidade: c.nome }) : t('Viajar para {cidade}', { cidade: c.nome })}</button>
    <p class="drop-nota">${t('Em Runeterra a viagem é sempre pelas cidades. De {cidade}, é só andar até {zona}: siga o minimapa.', { cidade: c.nome, zona: t(R.NOME_ZONA[l.id]) })} ${nota}</p>`;
}
function infoLocal(l, zonaMundo = false) {
  const atual = l.id === estado.local, cor = corFaixa(l);
  const botao = (txt) => (zonaMundo ? botaoZonaMundo(l) : `<button class="botao mi-ir" data-ir="${l.id}" ${atual ? 'disabled' : ''}>${atual ? t('Você está aqui') : txt}</button>`);
  const topo = zonaMundo
    ? `<div class="mi-topo" style="--cor:${cor}">${icoLocal(l)}<div><h3>${t(R.NOME_ZONA[l.id])}</h3><span class="mi-status">Runeterra · ${situacao(l)}</span></div></div>
`
    : `<div class="mi-topo" style="--cor:${cor}">${icoLocal(l)}<div><h3>${l.nome}</h3><span class="mi-status">${situacao(l)}</span></div></div>`;
  const desc = `<p class="mi-desc">${l.descricao}</p>`;          // só na Fonte (os lugares de caça mostram monstros e itens)
  if (l.base) {
    const NPCS = [['Soraka', t('Cura tudo, de graça.')], ['Lojista', t('Compra o saque, vende poção.')], ['Tesoureira de Piltover', t('Guarda itens e ouro fora da mochila.')],
      ['Ornn', t('Monta lendários e refina equipamento.')], ['Capitão da Legião', t('Tarefas de caça: XP, ouro e item.')],
      ['Mestre da Legião', t('Refaz seus atributos.')]];
    return topo + desc + `
      <div class="mapa-secao">${t('Na praça')}</div>
      <div class="mi-monstros">${NPCS.map(([n, txt]) => `<div class="mi-npc"><img src="${fotoMonstro(n)}" alt=""><span><b>${t(n)}</b>${txt}</span></div>`).join('')}</div>
      <p class="drop-nota">${t('Mercado entre jogadores na tecla J.')}</p>
      ${botao(t('Voltar para a Fonte (B)'))}`;
  }
  const vip = M.ehVip(estado), ch = M.chancesDrop(l, vip ? M.VIP.drop : 1);
  const RAR = [['basico', t('Básico'), '#d0d0d0'], ['epico', t('Épico'), '#c88aff'], ['lendario', t('Lendário'), '#ffc040']];
  const drops = RAR.map(([r, nome, corR]) => {
    const itens = M.itensPorRaridade(r, l, M.classeDe(estado));
    const cada = ch[r] / itens.length;
    const q = M.chancesQualidade(0);
    return `<div class="mi-rar" style="--r:${corR}"><div class="mi-rar-topo"><b>${nome}</b><span title="${cadaAbates(ch[r])}">${pctFino(ch[r])}</span></div>
      <div class="mi-rar-qual"><span title="${cadaAbates(ch[r] * q.S)}"><i class="qual q-S">S</i> ${pctFino(ch[r] * q.S)}</span><span title="${cadaAbates(ch[r] * q.SS)}"><i class="qual q-SS">SS</i> ${pctFino(ch[r] * q.SS)}</span></div>
      <div class="drop-itens">${itens.map((id) => comChance(`<img src="${imgItem(id)}" alt="" title="${(textoItem(id) + '\n' + t('Chance de cair: {pct} por abate', { pct: pctFino(cada) })).replace(/"/g, '&quot;')}">`, cada)).join('')}</div></div>`;
  }).join('');
  return topo + `
    <div class="mapa-secao">${t('Monstros')} <span class="fraco">${t('nível {min}–{max}', { min: l.nm[0], max: l.nm[1] })}</span></div>
    ${listaMonstros(l)}
    <div class="mapa-secao">${t('O que cai aqui')} ${vip ? `<span class="vip">${t('(com VIP)')}</span>` : ''}</div>
    <div class="mi-drops">${drops}${blocoVenda(l)}</div>
    <div class="mapa-secao">${t('Runas')}</div>
    <div class="mi-gemas">${Object.entries(M.chancesGema(l, vip ? M.VIP.drop : 1)).map(([g, c]) => `<span title="${textoGema(g).replace(/"/g, '&quot;')}"><img src="${iconeGema(g)}" alt="">${M.nomeGema(g)} <b title="${cadaAbates(c)}">${pctFino(c)}</b></span>`).join('')}</div>
    <p class="mi-wiki"><a href="/wiki#zona-${l.id}" target="_blank" rel="noopener">📖 ${t('Vida dos monstros e chances na wiki')}</a></p>
    ${botao(t('Viajar para cá'))}`;
}
function montarMarcadores() {
  $('#marcadores').innerHTML = M.LOCAIS.filter((l) => !l.arena).map((l) => {
    const atual = l.id === estado.local, lado = l.pos[0] < 0.15 ? ' esq' : l.pos[0] > 0.85 ? ' dir' : '', ideal = !l.base && corFaixa(l) === '#3cd23c';
    return `<button class="marcador${atual ? ' atual' : ''}${ideal ? ' ideal' : ''}${lado}" data-local="${l.id}" style="left:${l.pos[0] * 100}%;top:${l.pos[1] * 100}%;--cor:${corFaixa(l)}" aria-label="${l.nome}">
      <span class="mk-ico">${l.icone ? `<img src="assets/img/inimigos/${l.icone}.png" alt="">` : '<i class="base-ico"></i>'}${l.chefe ? '<b class="mk-coroa">👑</b>' : ''}${atual ? `<b class="mk-aqui">${t('Você')}</b>` : ''}</span>
      <span class="mk-nome">${ideal ? `<em class="mk-ideal">★ ${t('Ideal')}</em>` : ''}${l.base ? t('Fonte') : l.nome}${l.faixa ? `<small>${l.faixa[0]}–${l.faixa[1]}</small>` : l.arena ? '<small>PvP</small>' : ''}</span>
    </button>`;
  }).join('');
  marcasMapa(M.LOCAIS.filter((l) => !l.arena).map((l) => ({ x: l.pos[0], y: l.pos[1], cor: corFaixa(l), ideal: !l.base && corFaixa(l) === '#3cd23c', base: !!l.base })));
  // a dica de onde clicar, até o primeiro clique num lugar
  let viu = false; try { viu = !!localStorage.getItem('lolidle-mapa-dica'); } catch {}
  $('#mapa-dica').hidden = viu;
}
let mostrado = null, escolhido = null;
// trilha tracejada no mapa: de onde o jogador está até o lugar que ele está olhando
const focarNoMapa = (id) => { const de = M.LOCAL[estado.local], para = M.LOCAL[id]; focoMapa(de && !de.arena && para && de !== para ? { de: de.pos, para: para.pos, cor: corFaixa(para) } : null); };
const mostrarInfo = (id) => { if (id === mostrado) return; mostrado = id; focarNoMapa(id); $('#mapa-info').innerHTML = infoLocal(M.LOCAL[id]); };
// o clique escolhe o lugar e ele fica escolhido; passar o mouse só mostra uma prévia e, ao sair, volta para o escolhido
function escolherNoMapa(id) {
  escolhido = id;
  document.querySelectorAll('#marcadores .marcador').forEach((b) => b.classList.toggle('escolhido', b.dataset.local === id));
  mostrarInfo(id);
}
$('#marcadores').addEventListener('mouseover', (e) => { const m = e.target.closest('.marcador'); if (m) mostrarInfo(m.dataset.local); });
$('#marcadores').addEventListener('mouseleave', () => { if (escolhido) mostrarInfo(escolhido); });
$('#marcadores').addEventListener('click', (e) => {
  const m = e.target.closest('.marcador'); if (!m) return;
  escolherNoMapa(m.dataset.local);
  if (!$('#mapa-dica').hidden) { $('#mapa-dica').hidden = true; try { localStorage.setItem('lolidle-mapa-dica', '1'); } catch {} }
});
$('#mapa-info').addEventListener('click', (e) => {
  if (e.target.closest('[data-mundo-geral]')) { escolhidoMundo = null; desenharMapaMundo(); $('#mapa-info').innerHTML = infoRuneterra(); return; }
  const bc = e.target.closest('[data-cidade]');
  if (bc) { viajarCidade(bc.dataset.cidade); return; }
  const b = e.target.closest('[data-ir]'); if (!b) return;
  // a Fonte não é viagem: é o recall de sempre (4 s, como a tecla B), senão daria para fugir de uma luta na hora
  if (b.dataset.ir === 'fonte') { fecharJanelas(); $('#voltar-base').click(); return; }
  if (combate.darius.morto > 0) return;
  // saindo de Runeterra no meio de uma luta (monstro ou jogador): igual à viagem para as cidades, não deixa fugir
  if (emCombateAqui()) { fecharJanelas(); avisoCombate(); return; }
  const destino = M.LOCAL[b.dataset.ir];
  if (!destino || b.dataset.ir === estado.local) return;
  if (destino.arena && !lerLocal(CHAVE_POS, null)) entradaCidade = 'demacia';
  comecarViagem(t(destino.nome), destino.arena || localAtual().arena ? TEMPO_VIAGEM.runeterra : TEMPO_VIAGEM.rift, () => irPara(b.dataset.ir));
});
// os botões da janela do mapa: esconder o painel de detalhes (◨) e tela cheia (⤢), lembrados no navegador
function botoesMapa() {
  const jan = $('#janela-mapa'), semInfo = lerLocal('lolidle-mapa-sem-info', false), cheia = lerLocal('lolidle-mapa-cheia', false);
  jan.classList.toggle('sem-info', !!semInfo); jan.classList.toggle('cheia', !!cheia);
  const bi = $('#mapa-bt-info'), bc = $('#mapa-bt-cheia');
  bi.setAttribute('aria-pressed', String(!!semInfo)); bi.textContent = semInfo ? '◧' : '◨'; bi.title = semInfo ? t('Mostrar os detalhes') : t('Esconder os detalhes');
  bc.setAttribute('aria-pressed', String(!!cheia)); bc.textContent = cheia ? '⤡' : '⤢'; bc.title = cheia ? t('Sair da tela cheia') : t('Tela cheia');
}
$('#mapa-bt-info').addEventListener('click', (e) => { gravarLocal('lolidle-mapa-sem-info', !lerLocal('lolidle-mapa-sem-info', false)); botoesMapa(); ajustarJanelaMapa(); e.currentTarget.blur(); });
$('#mapa-bt-cheia').addEventListener('click', (e) => { gravarLocal('lolidle-mapa-cheia', !lerLocal('lolidle-mapa-cheia', false)); botoesMapa(); ajustarJanelaMapa(); e.currentTarget.blur(); });
// a janela no formato do mapa: o mapa ocupa toda a altura que dá (inteiro, sem cortar e sem faixa dos lados) e a janela fica
// da largura dele mais os detalhes. Com os detalhes abertos a largura é a de Runeterra (4:3) nas duas abas, e no Rift
// (quadrado) os detalhes ficam com o que sobra; sem os detalhes, a janela tem a largura do mapa da aba.
function ajustarJanelaMapa() {
  const jan = $('#janela-mapa'), pn = jan.querySelector('.painel'), col = jan.querySelector('.mapa-coluna'), palco = jan.querySelector('.mapa-palco');
  if (jan.hidden) return;
  if (!matchMedia('(min-width: 901px)').matches) { pn.style.width = pn.style.height = col.style.width = ''; return; }
  const cheia = jan.classList.contains('cheia'), semInfo = jan.classList.contains('sem-info'), mundo = !$('#mundo-area').hidden;
  const maxW = cheia ? innerWidth : Math.min(innerWidth * 0.96, 1680), maxH = cheia ? innerHeight : Math.min(innerHeight * 0.92, 1120);
  pn.style.width = maxW + 'px'; pn.style.height = maxH + 'px'; col.style.width = (semInfo ? maxW - 40 : maxW - 360) + 'px';      // larga, para nada quebrar linha ao medir
  const corpo = jan.querySelector('.mapa-corpo'), cs = getComputedStyle(corpo), dentro = corpo.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const Hp = palco.getBoundingClientRect().height, extraW = pn.getBoundingClientRect().width - dentro + (semInfo ? 0 : 300 + (parseFloat(cs.columnGap) || 0));      // o que não é mapa
  const forma = mundo || !semInfo ? 4 / 3 : 1, formaAba = mundo ? 4 / 3 : 1;
  let mapH = Hp, larg = mapH * forma;
  if (larg + extraW > maxW) { larg = maxW - extraW; mapH = larg / forma; }
  pn.style.width = Math.floor(larg + extraW) + 'px'; pn.style.height = Math.floor(maxH - (Hp - mapH)) + 'px';
  col.style.width = Math.floor(mapH * formaAba) + 'px';
}
addEventListener('resize', () => ajustarJanelaMapa());
function abrirMapa() {
  botoesMapa();
  montarMarcadores();
  mostrado = null;
  $('#janela-mapa').hidden = false;
  abaMapa(localAtual().arena ? 'mundo' : 'rift');
}
// abas do mapa: o Summoner's Rift (caça automática) e Runeterra (o mundo aberto)
function abaMapa(qual) {
  document.querySelectorAll('.aba-mapa').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === qual)));
  const mundo = qual === 'mundo';
  $('#mapa-area').hidden = mundo; $('#legenda-rift').hidden = mundo;
  $('#mundo-area').hidden = !mundo; $('#legenda-mundo').hidden = !mundo;
  mostrado = null; ajustarJanelaMapa();
  if (mundo) {
    prepararMapaMundo(); tamanhoMundo(); vista.z = 1;
    const A = combate.arena, zi = R.ZONAS.filter((z) => M.LOCAL[z].faixa[0] <= estado.nivel).pop() ?? R.ZONAS[0], p = rotulosZona[zi]?.[0];
    if (localAtual().arena && A?.mundo) centrarMundo(A.x, A.y); else if (p) centrarMundo(p.x, p.y); else limitarVista();
    escolhidoMundo = null; desenharMapaMundo(); $('#mapa-info').innerHTML = infoRuneterra();
    let viu = false; try { viu = !!localStorage.getItem('lolidle-mundo-dica'); } catch {}
    $('#mundo-dica').hidden = viu;
  }
  else escolherNoMapa(localAtual().arena ? 'fonte' : estado.local);
}
document.querySelector('.mapa-abas').addEventListener('click', (e) => { const b = e.target.closest('.aba-mapa'); if (b) abaMapa(b.dataset.aba); });
$('#ir-runeterra').addEventListener('click', () => {
  if (localAtual().arena || combate.darius.morto > 0) return;
  // muita gente abria o mapa e clicava no meio das zonas sem conseguir viajar: o botão leva direto (depois de alguns segundos)
  comecarViagem(t('Runeterra'), TEMPO_VIAGEM.runeterra, () => { if (!lerLocal(CHAVE_POS, null)) entradaCidade = 'demacia'; irPara('arena'); });
});

// mapa-múndi de Runeterra: o mundo inteiro, as zonas com a faixa de nível, as cidades e você.
// Desenhado como um mapa de aventura em pergaminho: terreno em aquarela, florestas e rochas em ícones, costa contornada,
// estradas, cidades muradas, aldeias, rosa dos ventos e moldura. Fica num canvas de 1024×768 (2 px por tile desde que o mundo dobrou). As cidades e as fortalezas são desenhadas
// maiores que o tamanho real (CK px por tile), como num mapa de verdade, para dar para ver.
const MUNDO_K = 1024 / R.LARG_M, KR = 4 / MUNDO_K, CK = 4;
const raioCidade = (c) => (c.r * CK) / MUNDO_K;          // raio da cidade desenhada no mapa, em tiles
let rotulosZona = null, bordasZona = null, escolhidoMundo = null, mascarasZona = null;
const FONTE_MAPA = 'Georgia, "Times New Roman", serif';
function prepararMapaMundo() {
  if (rotulosZona) return;
  // cada zona ganha até 2 rótulos, no ponto mais "de dentro" dela, sem um texto cobrir o outro nem as cidades
  rotulosZona = Object.fromEntries(R.ZONAS.map((z) => [z, []]));
  const cands = Object.fromEntries(R.ZONAS.map((z) => [z, []]));
  for (let y = 8 * KR; y < R.ALT_M - 8 * KR; y += 3 * KR) for (let x = 6 * KR; x < R.LARG_M - 6 * KR; x += 3 * KR) {
    const z = R.zonaEm(x, y);
    if (!z) continue;
    let raio = 1;
    while (raio < 28 * KR && [[raio, 0], [-raio, 0], [0, raio], [0, -raio], [raio, raio], [-raio, -raio], [raio, -raio], [-raio, raio]].every(([dx, dy]) => R.zonaEm(x + dx, y + dy) === z)) raio++;
    cands[z].push({ x, y, raio });
  }
  const g = document.createElement('canvas').getContext('2d');
  g.font = `bold 20px ${FONTE_MAPA}`;
  const caixas = R.CIDADES.map((c) => ({ x0: c.x - raioCidade(c) - 4 * KR, x1: c.x + raioCidade(c) + 4 * KR, y0: c.y - raioCidade(c) - 4 * KR, y1: c.y + raioCidade(c) / 1.1 + 10 * KR }));
  caixas.push({ x0: 0, x1: 52 * KR, y0: 0, y1: 20 * KR }, { x0: R.LARG_M - 30 * KR, x1: R.LARG_M, y0: R.ALT_M - 30 * KR, y1: R.ALT_M });   // título e rosa dos ventos
  for (const z of R.ZONAS_PK) caixas.push({ x0: z.x - 110 / MUNDO_K, x1: z.x + 110 / MUNDO_K, y0: z.y + z.r / 1.1, y1: z.y + z.r / 1.1 + 22 / MUNDO_K });   // o nome das Zonas de Guerra (o da zona pode ficar por cima do círculo, p607)
  const caixa = (z, p) => { const w = g.measureText(t(R.NOME_ZONA[z])).width / MUNDO_K / 2 + 2 * KR + 26 / MUNDO_K; return { x0: p.x - w, x1: p.x + w, y0: p.y - 8 * KR, y1: p.y + 9 * KR }; };
  const cruza = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  for (const z of R.ZONAS) cands[z].sort((a, b) => b.raio - a.raio);
  for (const rodada of [0, 1]) for (const z of R.ZONAS) {
    const ja = rotulosZona[z];
    if (ja.length !== rodada) continue;
    for (const p of cands[z]) {
      if (p.raio < (rodada ? 8 : 4) * KR) break;
      const cx = caixa(z, p);
      if (cx.x0 < 3 * KR || cx.x1 > R.LARG_M - 3 * KR || cx.y0 < 3 * KR || cx.y1 > R.ALT_M - 3 * KR) continue;
      if (caixas.some((c) => cruza(c, cx)) || ja.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 80 * KR)) continue;
      ja.push({ ...p, caixa: cx }); caixas.push(cx); break;
    }
  }
  bordasZona = construirAtlas(); molduraMundo = null;
}
// destaque de uma zona (com o mouse em cima ou escolhida): uma máscara de 1 px por tile, ampliada
function mascaraZona(id) {
  mascarasZona ??= {};
  if (mascarasZona[id]) return mascarasZona[id];
  const c = document.createElement('canvas'); c.width = R.LARG_M; c.height = R.ALT_M;
  const g = c.getContext('2d'); g.fillStyle = '#fff';
  for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) if (R.zonaEm(x, y) === id && !R.cidadeEm(x + 0.5, y + 0.5)) g.fillRect(x, y, 1, 1);
  return (mascarasZona[id] = c);
}
const destaques = new Map();
function destaqueZona(id, forte) {
  const k = id + (forte ? '!' : '');
  if (destaques.has(k)) return destaques.get(k);
  const m = document.createElement('canvas'); m.width = R.LARG_M; m.height = R.ALT_M;
  const mg = m.getContext('2d'); mg.drawImage(mascaraZona(id), 0, 0); mg.globalCompositeOperation = 'source-in';
  mg.fillStyle = forte ? 'rgba(255,214,74,0.38)' : 'rgba(255,255,240,0.26)'; mg.fillRect(0, 0, m.width, m.height);
  destaques.set(k, m); return m;
}
// o terreno do mapa-múndi (as cidades, as fortalezas e a moldura são desenhadas à parte). K: px por tile, MUNDO_K ou o dobro
// para o zoom (com KR = 1 entra cada árvore e cada rocha)
function construirAtlas(K = MUNDO_K) {
  const L = R.mundoLogico(), W = R.LARG_M * K, H = R.ALT_M * K, KR = 4 / K, e = K / MUNDO_K;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let semente = 7;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const cidade = (x, y) => R.cidadeEm(x + 0.5, y + 0.5);
  // 1. pergaminho: papel claro com manchas e fibras
  g.fillStyle = '#e8d9b0'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 260; k++) {
    const x = rnd() * W, y = rnd() * H, r = (20 + rnd() * 90) * e, gr = g.createRadialGradient(x, y, 0, x, y, r);
    const escuro = rnd() < 0.55; gr.addColorStop(0, escuro ? 'rgba(150,110,60,0.10)' : 'rgba(255,248,220,0.14)'); gr.addColorStop(1, 'rgba(150,110,60,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 2. terreno em aquarela: 1 pixel por tile, ampliado com suavização, por cima do papel
  // tom de cada região (bem leve, por cima da cor do chão)
  const TINTA_ZONA = { 'rota-inf': 'rgba(150,210,90,0.16)', 'rota-sup': 'rgba(230,200,90,0.16)', lobos: 'rgba(40,110,50,0.18)', azul: 'rgba(70,130,220,0.16)',
    vermelho: 'rgba(200,60,40,0.16)', rio: 'rgba(60,170,170,0.15)', dragao: 'rgba(230,120,40,0.17)', barao: 'rgba(120,60,170,0.18)' };
  const COR = { grama: '#97b663', gramaE: '#6b9450', terra: '#c2a06a', pedra: '#b2aa98', areia: '#e0cc94', agua: '#6ea4c4', vazio: '#7c5a9c', lama: '#9c8486', fonte: '#a8b4cc', planalto: '#9a9c78', escada: '#c8bca0', cascalho: '#b2aa98' };
  const base = document.createElement('canvas'); base.width = R.LARG_M; base.height = R.ALT_M;
  const bg = base.getContext('2d');
  for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) {
    const t = L.chao[y][x];
    bg.fillStyle = cidade(x, y) ? '#d8ccae' : COR[t] || COR.grama; bg.fillRect(x, y, 1, 1);
    const tz = t !== 'agua' && !cidade(x, y) && TINTA_ZONA[R.zonaEm(x, y)];
    if (tz) { bg.fillStyle = tz; bg.fillRect(x, y, 1, 1); }
  }
  g.save(); g.globalAlpha = 0.86; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(base, 0, 0, W, H); g.restore();
  // pinceladas: grão claro e escuro, como tinta sobre papel
  for (let k = 0; k < W * H / 6; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,250,230,0.07)' : 'rgba(60,40,10,0.07)'; g.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 1 + ((rnd() * 3) | 0), 1); }
  // 3. água: costa contornada, uma linha clara por dentro e ondinhas
  const agua = (x, y) => L.chao[y]?.[x] === 'agua';
  g.fillStyle = '#3e6e92';
  for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) {
    if (!agua(x, y) || (agua(x - 1, y) && agua(x + 1, y) && agua(x, y - 1) && agua(x, y + 1))) continue;
    g.beginPath(); g.arc(x * K + K / 2, y * K + K / 2, K * 0.75, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#6ea4c4';
  for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) if (agua(x, y)) g.fillRect(x * K - 1, y * K - 1, K + 2, K + 2);
  g.strokeStyle = 'rgba(230,244,255,0.55)'; g.lineWidth = 1;
  for (let y = 0; y < R.ALT_M; y += 2) for (let x = 0; x < R.LARG_M; x += 3) {
    if (!agua(x, y) || !agua(x + 2, y) || !agua(x, y - 1) || !agua(x, y + 1) || (x * 7 + y * 3) % 5) continue;
    const px = x * K + 2, py = y * K + 2;
    g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 3, py - 2, px + 6, py); g.quadraticCurveTo(px + 9, py + 2, px + 12, py); g.stroke();
  }
  // contorno da costa: distância de cada tile de água até a terra (até 6), e uma linha de pontos a 2 e a 4 tiles
  {
    const dist = new Int8Array(R.LARG_M * R.ALT_M).fill(-1), fila = [];
    for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) if (!agua(x, y)) { dist[y * R.LARG_M + x] = 0; fila.push(y * R.LARG_M + x); }
    for (let i = 0; i < fila.length; i++) {
      const k = fila[i], x = k % R.LARG_M, y = (k / R.LARG_M) | 0, d = dist[k];
      if (d >= 6) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = ny * R.LARG_M + nx;
        if (nx < 0 || ny < 0 || nx >= R.LARG_M || ny >= R.ALT_M || dist[nk] >= 0) continue;
        dist[nk] = d + 1; fila.push(nk);
      }
    }
    for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) {
      const d = dist[y * R.LARG_M + x];
      if ((d === 2 || d === 4) && (x + y) % 2 === 0) { g.fillStyle = d === 2 ? 'rgba(235,248,255,0.55)' : 'rgba(235,248,255,0.3)'; g.fillRect(x * K, y * K, 1.5, 1.5); }
    }
  }
  // 4. linhas pontilhadas entre as zonas
  g.fillStyle = 'rgba(110,40,20,0.45)';
  const zona = (x, y) => (R.cidadeEm(x, y) ? 'c' : R.zonaEm(x, y));
  for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) {
    if ((x + y) % (3 * KR) !== 0) continue;
    const z = zona(x, y);
    if (z === 'c' || agua(x, y)) continue;
    if (x + 1 < R.LARG_M && zona(x + 1, y) !== z && zona(x + 1, y) !== 'c') g.fillRect((x + 1) * K - 1, y * K + 1, 2, 2);
    if (y + 1 < R.ALT_M && zona(x, y + 1) !== z && zona(x, y + 1) !== 'c') g.fillRect(x * K + 1, (y + 1) * K - 1, 2, 2);
  }
  // 5. estradas: borda marrom e miolo claro
  for (const [raio, cor] of [[KR > 1 ? 2.6 : 3.4, '#7a5a34'], [KR > 1 ? 1.6 : 2.2, '#ecdcb0']]) {
    g.fillStyle = cor;
    for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) {
      if (!L.estrada[y][x] || cidade(x, y)) continue;
      g.beginPath(); g.arc(x * K + K / 2, y * K + K / 2, raio, 0, Math.PI * 2); g.fill();
    }
  }
  // 6. natureza em ícones, de cima para baixo (quem está embaixo cobre quem está em cima)
  const arvoreIcone = (cx, cy, selva) => {
    if (selva) {
      g.fillStyle = 'rgba(40,30,10,0.25)'; g.beginPath(); g.ellipse(cx + 1.5, cy + 3, 4, 1.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3a22'; g.fillRect(cx - 0.5, cy, 1.5, 3);
      g.fillStyle = '#2e5a2a'; g.beginPath(); g.arc(cx, cy - 1.5, 3.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#467a38'; g.beginPath(); g.arc(cx - 0.9, cy - 2.4, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6a9a48'; g.fillRect(cx - 2, cy - 4, 1.5, 1);
    } else {
      g.fillStyle = 'rgba(40,30,10,0.25)'; g.beginPath(); g.ellipse(cx + 1.5, cy + 3, 3.5, 1.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a3a22'; g.fillRect(cx - 0.5, cy + 1, 1.5, 2);
      g.fillStyle = '#2f5e34'; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + 3.6, cy + 1.5); g.lineTo(cx - 3.6, cy + 1.5); g.fill();
      g.fillStyle = '#4c8446'; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx, cy + 1.5); g.lineTo(cx - 3.6, cy + 1.5); g.fill();
    }
  };
  const rochaIcone = (cx, cy, vazio) => {
    const [esc, cla] = vazio ? ['#4a3462', '#8a6aaa'] : ['#6e685c', '#b4ac9c'];
    g.fillStyle = 'rgba(40,30,10,0.25)'; g.beginPath(); g.ellipse(cx + 1, cy + 2.5, 4, 1.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = esc; g.beginPath(); g.moveTo(cx - 4, cy + 2); g.lineTo(cx - 1, cy - 3); g.lineTo(cx + 1.5, cy - 1.5); g.lineTo(cx + 4, cy + 2); g.fill();
    g.fillStyle = cla; g.beginPath(); g.moveTo(cx - 4, cy + 2); g.lineTo(cx - 1, cy - 3); g.lineTo(cx, cy + 2); g.fill();
  };
  for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) {
    const o = L.obj[y][x]; if (!o || cidade(x, y)) continue;
    if (o[0] !== 'casa' && (x % KR || y % KR)) continue;
    const cx = x * K + K / 2 + (rnd() - 0.5) * 2, cy = y * K + K / 2 + (rnd() - 0.5) * 2, t = o[0];
    if (t === 'arvore' || t === 'arvoreE') { if (x > 0 && y > 0 && x < R.LARG_M - 1 && y < R.ALT_M - 1) arvoreIcone(cx, cy, t === 'arvoreE'); }
    else if (t === 'rocha' || t === 'rochaV') rochaIcone(cx, cy, t === 'rochaV');
    else if (t === 'cristal') {
      g.fillStyle = 'rgba(200,140,255,0.35)'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d8a8ff'; g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(cx + 2, cy + 2); g.lineTo(cx - 2, cy + 2); g.fill();
    } else if (t === 'casa') {                     // casinha de aldeia
      g.fillStyle = 'rgba(40,30,10,0.3)'; g.fillRect(cx - 4, cy + 1, 10, 3);
      g.fillStyle = '#efe4c8'; g.fillRect(cx - 4, cy - 3, 8, 6); g.strokeStyle = '#5a4020'; g.lineWidth = 1; g.strokeRect(cx - 4, cy - 3, 8, 6);
      g.fillStyle = ['#3a64c0', '#2a9a94', '#a82a2a'][o[1] % 3]; g.beginPath(); g.moveTo(cx - 6, cy - 3); g.lineTo(cx, cy - 8); g.lineTo(cx + 6, cy - 3); g.fill();
    }
  }
  return c;
}
// cidades e fortalezas, por cima do terreno: desenhadas a cada quadro em px do atlas, então com o zoom continuam nítidas
let casasCidades = null;
function desenharConstrucoes(g) {
  const L = R.mundoLogico(), K = MUNDO_K;
  if (!casasCidades) {
    casasCidades = Object.fromEntries(R.CIDADES.map((c) => [c.id, []]));
    for (let y = 0; y < R.ALT_M; y++) for (let x = 0; x < R.LARG_M; x++) { const c = L.obj[y][x]?.[0] === 'casa' && R.cidadeEm(x + 0.5, y + 0.5); if (c) casasCidades[c.id].push({ x, y }); }
  }
  // fortalezas: planalto de pedra com paredão, a escada na frente e o baú dourado
  for (const f of L.fortalezas || []) {
    const kf = Math.max(1, KR * 0.7), ox = f.x * K + K / 2, oy = f.y * K + K / 2, rx = R.FRX * K * kf, ry = R.FRY * K * kf;
    g.fillStyle = 'rgba(50,30,10,0.35)'; g.beginPath(); g.ellipse(ox + 3, oy + 6, rx + 2, ry + 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a7266'; g.beginPath(); g.ellipse(ox, oy + 3, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a4a080'; g.beginPath(); g.ellipse(ox, oy - 1, rx - 3, ry - 3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a4438'; g.lineWidth = 2; g.beginPath(); g.ellipse(ox, oy + 3, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#d8ccb0'; g.fillRect(ox - 6, oy + ry - 2, 12, 9);
    g.fillStyle = '#6a6052'; for (let k = 0; k < 4; k++) g.fillRect(ox - 6, oy + ry - 1 + k * 2.4, 12, 1);
    const bx = ox, by = oy - ry + 2 * K * kf;
    g.fillStyle = '#7a4a24'; g.fillRect(bx - 5, by - 3, 10, 7); g.fillStyle = '#e8b838'; g.fillRect(bx - 5, by - 3, 10, 2); g.fillRect(bx - 1, by - 1, 2, 3);
    g.strokeStyle = '#2a1808'; g.lineWidth = 1; g.strokeRect(bx - 5, by - 3, 10, 7);
  }
  // 7. cidades: muralha com ameias, casas com o telhado da cor da cidade, a torre com bandeira
  for (const cid of R.CIDADES) {
    const ox = cid.x * K, oy = cid.y * K, rx = cid.r * CK, ry = (cid.r * CK) / 1.1;
    g.fillStyle = 'rgba(50,30,10,0.35)'; g.beginPath(); g.ellipse(ox + 4, oy + 6, rx + 2, ry + 2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d6cab0'; g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,100,70,0.18)'; g.beginPath(); g.ellipse(ox, oy, rx * 0.35, ry * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4e4636'; g.lineWidth = 6; g.beginPath(); g.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#9a9080'; g.lineWidth = 3; g.stroke();
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; g.fillStyle = '#5e5646'; g.fillRect(ox + Math.cos(a) * rx - 3, oy + Math.sin(a) * ry - 3, 6, 6); g.fillStyle = '#aaa090'; g.fillRect(ox + Math.cos(a) * rx - 3, oy + Math.sin(a) * ry - 3, 6, 2); }
    for (let k = 0; k < 6; k++) {                  // torres na muralha
      const a = (k / 6) * Math.PI * 2 + 0.5, tx = ox + Math.cos(a) * rx, ty = oy + Math.sin(a) * ry;
      g.fillStyle = '#4e4636'; g.beginPath(); g.arc(tx, ty, 6.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#a8a090'; g.beginPath(); g.arc(tx - 1, ty - 1, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = cid.cor; g.beginPath(); g.moveTo(tx - 5, ty - 3); g.lineTo(tx, ty - 10); g.lineTo(tx + 5, ty - 3); g.fill();
    }
    for (const { x, y } of casasCidades[cid.id]) {
      const hx = ox + (x + 0.5 - cid.x) * CK, hy = oy + (y - cid.y) * CK;
      g.fillStyle = 'rgba(40,30,10,0.3)'; g.fillRect(hx - 5, hy + 1, 12, 4);
      g.fillStyle = '#f2e8d0'; g.fillRect(hx - 5, hy - 3, 10, 7); g.strokeStyle = '#5a4020'; g.lineWidth = 1; g.strokeRect(hx - 5, hy - 3, 10, 7);
      g.fillStyle = cid.cor; g.beginPath(); g.moveTo(hx - 7, hy - 3); g.lineTo(hx, hy - 9); g.lineTo(hx + 7, hy - 3); g.fill();
      g.strokeStyle = tom(cid.cor, 0.6); g.beginPath(); g.moveTo(hx - 7, hy - 3); g.lineTo(hx, hy - 9); g.lineTo(hx + 7, hy - 3); g.stroke();
    }
    // torre central com bandeira
    g.fillStyle = 'rgba(40,30,10,0.35)'; g.fillRect(ox - 4, oy + 2, 16, 5);
    g.fillStyle = '#6a6458'; g.fillRect(ox - 7, oy - 14, 14, 18); g.fillStyle = '#a49c8c'; g.fillRect(ox - 7, oy - 14, 5, 18);
    for (const dx of [-7, -2, 3]) { g.fillStyle = '#6a6458'; g.fillRect(ox + dx, oy - 18, 4, 4); }
    g.fillStyle = '#2a1e14'; g.fillRect(ox - 2, oy - 2, 4, 6);
    g.fillStyle = '#3a2a1a'; g.fillRect(ox - 0.5, oy - 32, 1.5, 15);
    g.fillStyle = cid.cor; g.beginPath(); g.moveTo(ox + 1, oy - 32); g.quadraticCurveTo(ox + 8, oy - 31, ox + 14, oy - 28); g.lineTo(ox + 1, oy - 24); g.fill();
  }
}
// vinheta de papel velho, rosa dos ventos, moldura e título: ficam parados na tela, fora do zoom
function construirMoldura(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // 8. vinheta de papel velho, rosa dos ventos e moldura
  const vin = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.68);
  vin.addColorStop(0, 'rgba(90,60,20,0)'); vin.addColorStop(1, 'rgba(90,60,20,0.42)');
  g.fillStyle = vin; g.fillRect(0, 0, W, H);
  // título num pergaminho no alto, à esquerda
  g.font = `bold italic 26px ${FONTE_MAPA}`; const tw = g.measureText('Runeterra').width + 48;
  g.fillStyle = 'rgba(244,234,206,0.94)'; g.fillRect(28, 26, tw, 40); g.strokeStyle = '#6a4a20'; g.lineWidth = 2; g.strokeRect(28, 26, tw, 40);
  g.fillStyle = '#c9a050'; g.fillRect(28, 26, 6, 40); g.fillRect(28 + tw - 6, 26, 6, 40);
  g.textAlign = 'center'; g.fillStyle = '#3a2410'; g.fillText('Runeterra', 28 + tw / 2, 55);
  return c;
}
// o que se mexe no mapa-múndi: brilho na água, nuvens e pássaros, bandeiras das cidades, tochas das fortalezas e cristais do Vazio
let vivoAtlas = null;
function animarAtlas(g, tempo, zm = 1) {
  const L = R.mundoLogico(), K = MUNDO_K, W = R.LARG_M * K, H = R.ALT_M * K;
  if (!vivoAtlas) {
    let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const agua = [], cristais = [];
    for (let y = 2; y < R.ALT_M - 2; y++) for (let x = 2; x < R.LARG_M - 2; x++) {
      if (L.chao[y][x] === 'agua' && L.chao[y][x + 2] === 'agua' && L.chao[y - 1][x] === 'agua' && rnd() < 0.08 / (KR * KR)) agua.push({ x: x * K, y: y * K, f: rnd() * 6.28 });
      if (L.obj[y][x]?.[0] === 'cristal' && rnd() < 0.5 / (KR * KR)) cristais.push({ x: x * K + K / 2, y: y * K + K / 2, f: rnd() * 6.28 });
    }
    vivoAtlas = { agua, cristais };
  }
  // brilhos andando na água
  for (const a of vivoAtlas.agua) {
    const v = Math.sin(tempo * 2 + a.f); if (v < 0.3) continue;
    g.fillStyle = `rgba(240,250,255,${(v - 0.3) * 0.9})`; g.fillRect(a.x + ((tempo * 6 + a.f * 3) % 10) - 5, a.y + 1, 3 / Math.max(1, zm / 2), 1 / Math.max(1, zm / 2));
  }
  // cristais do Vazio pulsando
  for (const c of vivoAtlas.cristais) {
    const v = 0.5 + 0.5 * Math.sin(tempo * 2.5 + c.f), gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, 9);
    gr.addColorStop(0, `rgba(220,160,255,${0.25 + v * 0.35})`); gr.addColorStop(1, 'rgba(220,160,255,0)'); g.fillStyle = gr; g.fillRect(c.x - 9, c.y - 9, 18, 18);
  }
  // tochas na escada das fortalezas
  for (const f of L.fortalezas || []) for (const lado of [-1, 1]) {
    const kf = Math.max(1, KR * 0.7), x = f.x * K + K / 2 + lado * 10, y = f.y * K + K / 2 + R.FRY * K * kf + 2, v = 0.6 + 0.4 * Math.sin(tempo * 11 + f.id * 3 + lado);
    const gr = g.createRadialGradient(x, y, 0, x, y, 8); gr.addColorStop(0, `rgba(255,190,80,${0.55 * v})`); gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr; g.fillRect(x - 8, y - 8, 16, 16); g.fillStyle = v > 0.8 ? '#fff0b0' : '#ffb040'; g.fillRect(x - 1, y - 2 - (v > 0.8 ? 1 : 0), 2, 2);
  }
  // bandeiras das cidades tremulando (por cima da bandeira parada do desenho)
  for (const c of R.CIDADES) {
    const ox = c.x * K, oy = c.y * K;
    g.fillStyle = '#3a2a1a'; g.fillRect(ox - 0.5, oy - 32, 1.5, 15);
    g.fillStyle = c.cor; g.beginPath(); g.moveTo(ox + 1, oy - 32);
    for (let k = 1; k <= 8; k++) g.lineTo(ox + 1 + k * 1.8, oy - 32 + Math.sin(tempo * 6 - k * 0.7) * 1.4 * (k / 8));
    for (let k = 8; k >= 0; k--) g.lineTo(ox + 1 + k * 1.8, oy - 25 + Math.sin(tempo * 6 - k * 0.7) * 1.4 * (k / 8));
    g.fill();
  }
  // nuvens: sombra no chão e a nuvem por cima, atravessando devagar
  for (let k = 0; k < 4; k++) {
    const x = ((tempo * 9 + k * 300) % (W + 400)) - 200, y = 90 + k * 170 + Math.sin(tempo * 0.1 + k) * 20;
    for (const [dx, dy, cor, a] of [[18, 40, '20,30,40', 0.12], [0, 0, '255,255,255', 0.22]]) {
      g.save(); g.translate(x + dx, y + dy); g.scale(1, 0.45);
      for (const [bx, by, r] of [[0, 0, 60], [-50, 10, 42], [48, 8, 46], [10, -26, 40]]) {
        const gr = g.createRadialGradient(bx, by, 0, bx, by, r); gr.addColorStop(0, `rgba(${cor},${a})`); gr.addColorStop(1, `rgba(${cor},0)`);
        g.fillStyle = gr; g.fillRect(bx - r, by - r, r * 2, r * 2);
      }
      g.restore();
    }
  }
  // um bando de pássaros cruzando o mapa de vez em quando
  const ciclo = (tempo % 40) / 40;
  if (ciclo < 0.5) {
    const bx = -40 + ciclo * 2 * (W + 80), by = H * 0.3 + Math.sin(ciclo * 6) * 30, asa = Math.sin(tempo * 10) > 0 ? -3 : 1;
    g.strokeStyle = 'rgba(40,30,20,0.75)'; g.lineWidth = 1.5;
    for (const [dx, dy] of [[0, 0], [-12, -8], [-12, 8], [-24, -15], [-24, 15]]) {
      g.beginPath(); g.moveTo(bx + dx - 5, by + dy + asa); g.lineTo(bx + dx, by + dy); g.lineTo(bx + dx + 5, by + dy + asa); g.stroke();
    }
  }
}
// medalhão de uma zona no mapa-múndi: o ícone do monstro num círculo com aro de latão e anel da cor da situação;
// nos ideais (e com o mouse em cima) um anel se abre em volta; com o mouse, também um anel tracejado girando
const iconesZona = new Map();
function iconeZona(l) {
  if (!iconesZona.has(l.id)) { const img = new Image(); img.src = `assets/img/inimigos/${l.icone}.png`; iconesZona.set(l.id, img); }
  const img = iconesZona.get(l.id); return img.complete && img.naturalWidth ? img : null;
}
function medalhaoZona(g, x, y, l, cor, ideal, foco, tt) {
  if (ideal || foco) {
    const s = (tt * 0.9) % 1;
    g.strokeStyle = cor; g.globalAlpha = 0.9 * (1 - s); g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 19 + s * 16, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(30,18,6,0.45)'; g.beginPath(); g.ellipse(x + 2, y + 18, 15, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#16110a'; g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill();
  const img = iconeZona(l);
  if (img) { g.save(); g.beginPath(); g.arc(x, y, 14.5, 0, Math.PI * 2); g.clip(); g.drawImage(img, x - 15, y - 15, 30, 30); g.restore(); }
  g.strokeStyle = cor; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 18.5, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#f0d48a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.stroke();
  if (foco) {
    g.save(); g.setLineDash([5, 4]); g.lineDashOffset = -tt * 12; g.strokeStyle = '#fff4c8'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.stroke(); g.restore();
  }
}
// selo do nível embaixo do nome da zona, na cor da situação; o ideal ganha a fitinha "★ Ideal" do lado
function seloNivel(g, txt, x, y, cor, ideal) {
  g.font = `bold 14px ${FONTE_MAPA}`; g.textAlign = 'center';
  const w = g.measureText(txt).width + 14, extra = ideal ? g.measureText('★ ' + t('Ideal')).width + 14 : 0, x0 = x - (w + extra) / 2;
  const pilula = (px, pw, fundo, borda) => { g.fillStyle = fundo; g.strokeStyle = borda; g.lineWidth = 2; g.beginPath(); g.roundRect(px, y - 9, pw, 18, 9); g.fill(); g.stroke(); };
  pilula(x0, w, 'rgba(24,16,6,0.88)', cor);
  g.fillStyle = cor; g.fillText(txt, x0 + w / 2, y + 5);
  if (ideal) { pilula(x0 + w + 4, extra - 4, '#5ae05a', '#14400f'); g.fillStyle = '#0c2a0c'; g.fillText('★ ' + t('Ideal'), x0 + w + 4 + (extra - 4) / 2, y + 5); }
}
// zoom do mapa-múndi (09/10/2026, pedido de jogador): a roda do mouse (ou + e −) aproxima onde está o mouse e arrastar anda pelo
// mapa. vista: o canto de cima à esquerda em px do atlas (1024×768) e o zoom. Com zoom o terreno vem de um atlas com o dobro de
// detalhe (feito na primeira vez), e os nomes, os selos e as marcas continuam do mesmo tamanho na tela.
// O mapa ocupa a área toda (10/10/2026, pedido do dono): o canvas tem o tamanho da área na tela e o atlas a cobre (o que
// sobra em cima e embaixo, ou nos lados, se vê arrastando). vista.z = 1 é "cobre a área" e é o mínimo (sem faixas nos lados).
const ZOOM_MUNDO_MAX = 4, vista = { z: 1, x: 0, y: 0 }, AW = R.LARG_M * MUNDO_K, AH = R.ALT_M * MUNDO_K;
let atlasFino = null, molduraMundo = null, fazendoFino = false;
const cobreMundo = () => { const cv = $('#mapa-mundo'); return Math.max(cv.width / AW, cv.height / AH); };
const zmMundo = () => vista.z * cobreMundo();          // px do canvas por px do atlas
// o canvas acompanha o tamanho da área (em tela pequena fica com pelo menos 1024 px de largura, como antes); o meio continua no meio
function tamanhoMundo() {
  const cv = $('#mapa-mundo'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  const q = Math.max(1, AW / Math.max(w, (h * AW) / AH)), W = Math.round(w * q), H = Math.round(h * q);
  if (W === cv.width && H === cv.height) return;
  const zm = zmMundo(), mx = vista.x + cv.width / 2 / zm, my = vista.y + cv.height / 2 / zm;
  cv.width = W; cv.height = H; molduraMundo = null;
  const z2 = zmMundo(); vista.x = mx - W / 2 / z2; vista.y = my - H / 2 / z2; limitarVista();
}
function limitarVista() {
  const cv = $('#mapa-mundo'), min = 1;
  vista.z = Math.min(ZOOM_MUNDO_MAX, Math.max(min, vista.z));
  const zm = zmMundo(), vw = cv.width / zm, vh = cv.height / zm;
  vista.x = vw >= AW ? (AW - vw) / 2 : Math.min(AW - vw, Math.max(0, vista.x));
  vista.y = vh >= AH ? (AH - vh) / 2 : Math.min(AH - vh, Math.max(0, vista.y));
  cv.classList.toggle('zoom', vw < AW - 1 || vh < AH - 1);          // tem mapa fora da tela: arrastar anda
  for (const b of document.querySelectorAll('#mundo-zoom [data-zoom]')) b.disabled = b.dataset.zoom === '+' ? vista.z >= ZOOM_MUNDO_MAX : b.dataset.zoom === 'eu' ? false : vista.z <= min + 1e-3;
  $('#mundo-zoom [data-zoom="eu"]').hidden = !(localAtual().arena && combate.arena?.mundo);
}
// aproxima (fator > 1) ou afasta deixando parado o ponto (cx, cy) do canvas
function zoomMundo(fator, cx = $('#mapa-mundo').width / 2, cy = $('#mapa-mundo').height / 2) {
  const zm = zmMundo(), ax = vista.x + cx / zm, ay = vista.y + cy / zm;
  vista.z = Math.min(ZOOM_MUNDO_MAX, Math.max(1, vista.z * fator));
  const z2 = zmMundo(); vista.x = ax - cx / z2; vista.y = ay - cy / z2; limitarVista();
}
// põe o ponto (em tiles) no meio da tela
function centrarMundo(x, y) { const cv = $('#mapa-mundo'), zm = zmMundo(); vista.x = x * MUNDO_K - cv.width / 2 / zm; vista.y = y * MUNDO_K - cv.height / 2 / zm; limitarVista(); }
function desenharMapaMundo() {
  prepararMapaMundo(); tamanhoMundo();
  const cv = $('#mapa-mundo'), g = cv.getContext('2d'), K = MUNDO_K, zm = zmMundo(), W = cv.width, H = cv.height;
  const P = (x, y) => [(x * K - vista.x) * zm, (y * K - vista.y) * zm];        // tile → px do canvas
  const noAtlas = () => g.setTransform(zm, 0, 0, zm, -vista.x * zm, -vista.y * zm), naTela = () => g.setTransform(1, 0, 0, 1, 0, 0);
  naTela(); g.imageSmoothingEnabled = true;
  g.fillStyle = '#16130c'; g.fillRect(0, 0, W, H);          // afastado até o mapa inteiro caber: o fundo que sobra
  noAtlas(); g.drawImage(bordasZona, 0, 0);
  if (zm > 1.15) {          // ampliado, o atlas detalhado entra aos poucos por cima (feito logo depois, sem travar a abertura)
    if (atlasFino) { g.globalAlpha = Math.min(1, (zm - 1.15) / 0.5); g.drawImage(atlasFino, 0, 0, AW, AH); g.globalAlpha = 1; }
    else if (!fazendoFino) { fazendoFino = true; setTimeout(() => { atlasFino = construirAtlas(K * 2); }, 300); }
  }
  desenharConstrucoes(g);
  naTela(); g.drawImage(molduraMundo ??= construirMoldura(W, H), 0, 0);
  noAtlas(); animarAtlas(g, performance.now() / 1000, zm);
  // texto de mapa: letra escura com contorno de papel (zonas) ou clara com contorno escuro (níveis, você)
  const texto = (s, x, y, cor, tam, contorno = 'rgba(30,18,6,0.9)', estilo = '') => {
    g.font = `${estilo}${tam}px ${FONTE_MAPA}`; g.textAlign = 'center'; g.lineJoin = 'round';
    g.lineWidth = 5; g.strokeStyle = contorno; g.strokeText(s, x, y); g.fillStyle = cor; g.fillText(s, x, y);
  };
  for (const id of new Set([sobMouseMundo, escolhidoMundo])) {
    if (!id) continue;
    const forte = id === escolhidoMundo;
    if (id.startsWith('c:')) {
      const c = R.CIDADE[id.slice(2)];
      g.strokeStyle = forte ? '#ffd84a' : 'rgba(255,255,255,0.85)'; g.lineWidth = (forte ? 5 : 3) / zm;
      g.beginPath(); g.ellipse(c.x * K, c.y * K, c.r * CK + 8, (c.r * CK) / 1.1 + 8, 0, 0, Math.PI * 2); g.stroke();
    } else {
      // a zona clareia (escolhida: dourado) por cima do mapa
      g.imageSmoothingEnabled = true; g.drawImage(destaqueZona(id, forte), 0, 0, R.LARG_M * K, R.ALT_M * K);
    }
  }
  naTela();
  const tt = performance.now() / 1000;
  // trilha tracejada até a zona com o mouse em cima (ou a escolhida): de onde o jogador está em Runeterra,
  // ou da cidade por onde se chega nela
  const olhada = [sobMouseMundo, escolhidoMundo].find((id) => id && !id.startsWith('c:'));
  if (olhada && rotulosZona[olhada]?.length) {
    const A = combate.arena, l = M.LOCAL[olhada], de = localAtual().arena && A?.mundo ? { x: A.x, y: A.y } : cidadeDaZona(l).c;
    const para = rotulosZona[olhada].reduce((m, p) => (Math.hypot(p.x - de.x, p.y - de.y) < Math.hypot(m.x - de.x, m.y - de.y) ? p : m));
    const [ax, ay] = P(de.x, de.y), [bx, by] = P(para.x, para.y);
    g.save(); g.setLineDash([12, 9]); g.lineDashOffset = -tt * 30; g.lineCap = 'round';
    g.strokeStyle = 'rgba(30,18,6,0.85)'; g.lineWidth = 7; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = '#ffe08a'; g.lineWidth = 3; g.stroke(); g.restore();
  }
  // as Zonas de Guerra: os círculos primeiro (os nomes das zonas ficam por cima), os nomes delas no fim
  for (const z of R.ZONAS_PK) {
    const [zx, zy] = P(z.x, z.y), rr = z.r * K * zm;
    if (zx + rr < 0 || zx - rr > W || zy + rr < 0 || zy - rr > H) continue;       // com zoom, fora da vista
    g.save(); g.fillStyle = R.corZonaPk(z, z.semCap ? 0.26 : 0.34); g.strokeStyle = z.semCap ? 'rgba(230,30,30,0.95)' : 'rgba(255,145,20,1)'; g.lineWidth = 4; g.setLineDash([10, 7]);      // (p701: mais visíveis)
    g.beginPath(); g.ellipse(zx, zy, rr, rr / 1.1, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
  }
  for (const z of R.ZONAS) for (const p of rotulosZona[z]) {
    const l = M.LOCAL[z], marcada = escolhidoMundo === z, sob = sobMouseMundo === z, cor = corFaixa(l), ideal = cor === '#3cd23c';
    const nome = t(R.NOME_ZONA[z]), [x, y] = P(p.x, p.y);
    g.font = `bold 20px ${FONTE_MAPA}`; const tw = g.measureText(nome).width;
    medalhaoZona(g, x - tw / 2 - 24, y - 12, l, cor, ideal, marcada || sob, tt);
    texto(nome, x, y - 4, marcada ? '#7a1a08' : '#3a2410', 20, 'rgba(244,234,206,0.95)', 'bold ');
    seloNivel(g, t('nível {min}–{max}', { min: l.faixa[0], max: l.faixa[1] }), x, y + 14, cor, ideal);
  }
  for (const c of R.CIDADES) {
    const conhece = descobertas.has(c.id), [cx, cy] = P(c.x, c.y), rx = c.r * CK * zm, rk = rx / 1.1;
    const ny = cy + rk + 26 > H - 20 ? cy - rk - 14 : cy + rk + 26;
    // faixa (fita) com o nome da cidade
    g.font = `bold 24px ${FONTE_MAPA}`; const w = g.measureText(c.nome).width + 36;
    g.fillStyle = conhece ? tom(c.cor, 0.45) : '#4a4640';
    for (const lado of [-1, 1]) { g.beginPath(); g.moveTo(cx + lado * (w / 2 - 6), ny - 16); g.lineTo(cx + lado * (w / 2 + 14), ny - 16); g.lineTo(cx + lado * (w / 2 + 6), ny - 6); g.lineTo(cx + lado * (w / 2 + 14), ny + 5); g.lineTo(cx + lado * (w / 2 - 6), ny + 5); g.fill(); }
    g.fillStyle = conhece ? tom(c.cor, 0.7) : '#6a6660'; g.fillRect(cx - w / 2, ny - 20, w, 26);
    g.strokeStyle = 'rgba(20,12,4,0.8)'; g.lineWidth = 2; g.strokeRect(cx - w / 2, ny - 20, w, 26);
    texto(c.nome, cx, ny, conhece ? '#fff4dc' : '#c8c2b8', 24, 'rgba(20,12,4,0.9)', 'bold ');
    if (conhece && !(localAtual().arena && combate.arena?.cidade === c.id)) {
      const pul = (tt * 0.8) % 1;
      g.strokeStyle = `rgba(255,216,74,${0.8 * (1 - pul)})`; g.lineWidth = 4;
      g.beginPath(); g.ellipse(cx, cy, rx + 6 + pul * 26, rk + 6 + pul * 22, 0, 0, Math.PI * 2); g.stroke();
      texto(t('clique para viajar'), cx, ny + 24, '#ffe8a0', 17, 'rgba(20,12,4,0.9)', 'bold ');
      if (c.id === 'demacia' && !lerLocal(CHAVE_POS, null)) {           // quem nunca foi: a seta grande em Demacia
        // seta na horizontal, do lado direito da cidade, apontando para ela (não cobre o nome da zona de cima)
        const sx = cx + rx + 18 + Math.abs(Math.sin(tt * 3)) * 14, sy = cy;
        g.fillStyle = '#ffd84a'; g.strokeStyle = 'rgba(20,12,4,0.9)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 24, sy - 16); g.lineTo(sx + 24, sy - 6); g.lineTo(sx + 46, sy - 6); g.lineTo(sx + 46, sy + 6); g.lineTo(sx + 24, sy + 6); g.lineTo(sx + 24, sy + 16); g.closePath(); g.fill(); g.stroke();
        texto(t('Comece aqui'), sx + 100, sy + 8, '#ffd84a', 24, 'rgba(20,12,4,0.95)', 'bold ');
      }
    }
  }
  // as Zonas de Guerra no mapa-múndi
  const nomesPk = [], nomesZona = [];
  for (const z of R.ZONAS) for (const p of rotulosZona[z]) if (p.caixa) { const [x0, y0] = P(p.caixa.x0, p.caixa.y0), [x1, y1] = P(p.caixa.x1, p.caixa.y1); nomesZona.push({ x0, y0, x1, y1 }); }
  for (const z of R.ZONAS_PK) {
    const [zx, zy] = P(z.x, z.y), rr = z.r * K * zm;
    if (zx + rr < 0 || zx - rr > W || zy + rr < 0 || zy - rr > H) continue;       // com zoom, fora da vista
    // o nome fica embaixo do círculo (ou no primeiro lugar livre em volta) e nunca sai da borda do mapa
    const lx = Math.min(W - 110, Math.max(110, zx));
    let ly = Math.min(H - 20, zy + rr / 1.1 + 14);
    g.font = `bold 13px ${FONTE_MAPA}`;
    const meia = g.measureText('☠ ' + t(z.nome)).width / 2 + 6;      // (p618: só o nome, em 13 px)
    const bate = (yy) => nomesPk.some((b) => Math.abs(b.x - lx) < b.meia + meia && Math.abs(b.y - yy) < 18)
      || nomesZona.some((b) => lx - meia < b.x1 && b.x0 < lx + meia && yy - 10 < b.y1 && b.y0 < yy + 6);
    const lugares = [ly, zy - rr / 1.1 - 8, zy + rr / 1.1 + 32, zy - rr / 1.1 - 26].map((v) => Math.min(H - 20, Math.max(20, v)));
    ly = lugares.find((v) => !bate(v)) ?? ly;
    nomesPk.push({ x: lx, y: ly, meia });
    texto('☠ ' + t(z.nome), lx, ly, z.semCap ? '#ffe0d0' : '#fff2d8', 13, z.semCap ? 'rgba(120,0,0,0.95)' : 'rgba(170,80,0,0.95)', 'bold ');
  }
  const A = combate.arena;
  if (localAtual().arena && A?.mundo) {
    const pul = 1 + Math.sin(performance.now() / 200) * 0.25, [px, py] = P(A.x, A.y);
    g.fillStyle = 'rgba(255,216,74,0.35)'; g.beginPath(); g.arc(px, py, 14 * pul, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(px, py, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(px, py, 5.5, 0, Math.PI * 2); g.fill();
    texto(t('Você'), px, py + 30, '#ffd84a', 19, 'rgba(30,18,6,0.95)', 'bold ');
  }
}
// px do canvas embaixo do mouse, e o tile do mundo (com o zoom)
const pontoCanvas = (e) => { const cv = $('#mapa-mundo'), r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }; };
const pontoMapaMundo = (e) => { const c = pontoCanvas(e), zm = zmMundo(); return { x: (vista.x + c.x / zm) / MUNDO_K, y: (vista.y + c.y / zm) / MUNDO_K }; };
const lugarMundo = (p) => { const c = R.CIDADES.find((k) => Math.hypot(p.x - k.x, p.y - k.y) < raioCidade(k)); return c ? 'c:' + c.id : R.cidadeEm(p.x, p.y) ? 'c:' + R.cidadeEm(p.x, p.y).id : R.zonaEm(p.x, p.y); };
const voltarMundo = '<button class="mi-voltar" data-mundo-geral>← Runeterra</button>';
const infoLugarMundo = (id) => (id?.startsWith('c:') ? voltarMundo + infoCidade(R.CIDADE[id.slice(2)]) : id ? voltarMundo + infoLocal(M.LOCAL[id], true) : infoRuneterra());
let sobMouseMundo = null;
$('#mapa-mundo').addEventListener('mousemove', (e) => {
  const id = lugarMundo(pontoMapaMundo(e));
  e.currentTarget.style.cursor = arrastoMundo?.moveu ? '' : id ? 'pointer' : '';
  if (id !== sobMouseMundo) { sobMouseMundo = id; desenharMapaMundo(); }
});
$('#mapa-mundo').addEventListener('mouseleave', () => { sobMouseMundo = null; desenharMapaMundo(); });
// zoom: a roda aproxima onde está o mouse; com zoom, arrastar (botão esquerdo ou o dedo) anda pelo mapa
$('#mapa-mundo').addEventListener('wheel', (e) => {
  e.preventDefault();
  const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY, p = pontoCanvas(e);
  zoomMundo(Math.min(1.6, Math.max(0.6, Math.exp(-d * 0.002))), p.x, p.y);
}, { passive: false });
let arrastoMundo = null, ignorarCliqueMundo = false;
$('#mapa-mundo').addEventListener('pointerdown', (e) => { if (e.button === 0) arrastoMundo = { ...pontoCanvas(e), vx: vista.x, vy: vista.y, moveu: false }; });
window.addEventListener('pointermove', (e) => {
  if (!arrastoMundo) return;
  const p = pontoCanvas(e), dx = p.x - arrastoMundo.x, dy = p.y - arrastoMundo.y;
  if (!arrastoMundo.moveu && Math.hypot(dx, dy) < 8) return;
  arrastoMundo.moveu = true;
  if (!$('#mapa-mundo').classList.contains('zoom')) return;
  const zm = zmMundo(); vista.x = arrastoMundo.vx - dx / zm; vista.y = arrastoMundo.vy - dy / zm; limitarVista();
  $('#mapa-mundo').classList.add('arrastando');
});
window.addEventListener('pointerup', () => {
  if (!arrastoMundo) return;
  ignorarCliqueMundo = arrastoMundo.moveu && $('#mapa-mundo').classList.contains('zoom'); arrastoMundo = null;
  $('#mapa-mundo').classList.remove('arrastando');
});
$('#mundo-zoom').addEventListener('click', (e) => {
  const b = e.target.closest('[data-zoom]'), A = combate.arena; if (!b) return;
  const q = b.dataset.zoom;
  if (q === '+') zoomMundo(1.5);
  else if (q === '-') zoomMundo(1 / 1.5);
  else if (q === '0') { vista.z = 1; limitarVista(); }
  else if (q === 'eu' && A?.mundo) { vista.z = Math.max(vista.z, 2); centrarMundo(A.x, A.y); }           // centraliza em você (aproximando)
});
$('#mapa-mundo').addEventListener('click', (e) => {
  if (ignorarCliqueMundo) { ignorarCliqueMundo = false; return; }        // foi o fim de um arrasto
  escolhidoMundo = lugarMundo(pontoMapaMundo(e)); desenharMapaMundo(); $('#mapa-info').innerHTML = infoLugarMundo(escolhidoMundo);
  if (escolhidoMundo && !$('#mundo-dica').hidden) { $('#mundo-dica').hidden = true; try { localStorage.setItem('lolidle-mundo-dica', '1'); } catch {} }
});
// os dois mapas são animados enquanto a janela está aberta (o Rift numa camada por cima; Runeterra redesenhado)
(function animarMapas() {
  requestAnimationFrame(animarMapas);
  if ($('#janela-mapa').hidden) return;
  if (!$('#mapa-area').hidden) animarMapaLoL($('#mapa-lol-anim'), performance.now() / 1000);
  if (!$('#mundo-area').hidden) desenharMapaMundo();
})();
const DESC_CIDADE = {
  demacia: t('A primeira cidade, cercada pelas zonas mais tranquilas. É onde quase todo mundo começa em Runeterra.'),
  piltover: t('Fica no meio do mapa, entre o Bosque Azul e a Selva Rubra. Boa parada para quem já passou do nível 15.'),
  noxus: t('A cidade mais distante, perto dos Ermos do Dragão e da Fenda do Vazio. Só vale a pena vir depois do nível 30.'),
};
function infoCidade(c) {
  const conhece = descobertas.has(c.id), aqui = combate.arena?.cidade === c.id && localAtual().arena;
  return `<div class="mi-topo" style="--cor:${c.cor}"><i class="mi-ico base-ico"></i><div><h3>${c.nome}</h3><span class="mi-status">${conhece ? t('Cidade') : t('Ainda não descoberta')}</span></div></div>
    <ul class="mi-rende"><li>${t('Sem monstros e sem PvP. Vida e mana voltam sozinhas, rápido.')}</li><li>${t('Vende o saque e compra poção sem voltar à Fonte.')}</li><li>${t('Em volta: caça para nível {min} a {max}.', { min: c.faixa[0], max: c.faixa[1] })}</li></ul>`
    + `
    <div class="mapa-secao">${t('Quem está na praça')}</div>
    <div class="mi-monstros">${[['Soraka', t('Cura tudo, de graça.')], ['Lojista', t('Compra o saque, vende poção.')]].map(([n, txt]) => `<div class="mi-npc"><img src="${fotoMonstro(n)}" alt=""><span><b>${t(n)}</b>${txt}</span></div>`).join('')}</div>
    <p class="drop-nota">${conhece ? t('Viagem direta liberada (fora de combate).') : t('Chegue andando uma vez para liberar a viagem direta.')} ${t('Ornn, Capitão e Mestre ficam na Fonte.')}</p>
    <button class="botao mi-ir" data-cidade="${c.id}" ${!conhece || aqui ? 'disabled' : ''}>${aqui ? t('Você está aqui') : conhece ? t('Viajar para {cidade}', { cidade: c.nome }) : t('Ainda não descoberta')}</button>`;
}
function infoRuneterra() {
  const bonus = Math.round((M.ARENA.bonus - 1) * 100), dentro = !!localAtual().arena;
  return `<div class="mi-topo" style="--cor:#ffb040"><img class="mi-ico" src="assets/img/inimigos/atakhan_r.png" alt=""><div><h3>Runeterra</h3><span class="mi-status">${t('Mundo aberto · no controle')}</span></div></div>
    <div class="mapa-secao">${t('Entre por uma cidade')}</div>
    <div class="mi-cidades">${R.CIDADES.map((c) => { const conhece = descobertas.has(c.id), comeco = c.id === 'demacia' && !lerLocal(CHAVE_POS, null);
      return `<button class="botao mi-cidade${comeco ? ' comece' : ''}" data-cidade="${c.id}" style="--cor:${c.cor}" ${conhece ? '' : 'disabled'} title="${conhece ? t('Viajar para {cidade}', { cidade: c.nome }) : t('Chegue lá andando uma vez para liberar a viagem')}"><b>${c.nome}</b><small>${comeco ? t('comece aqui') : conhece ? t('caça nível {min}–{max}', { min: c.faixa[0], max: c.faixa[1] }) : t('não descoberta')}</small></button>`; }).join('')}</div>
    <div class="mi-stats" style="--cor:#ffb040">
      <div><small>${t('XP e drop')}</small><b>+${bonus}%</b></div>
      <div><small>${t('Sua zona')}</small><b>${(() => { const z = [...M.LOCAIS].reverse().find((l) => l.faixa && estado.nivel >= l.faixa[0]); return z ? t(R.NOME_ZONA[z.id]) : '—'; })()}</b></div>
      <div><small>PvP</small><b>${t('±{n} níveis', { n: difNivelPvp })}</b></div>
    </div>
    <p class="mi-curta">${t('Zonas de Guerra: PK sempre ligado, +{p}% de XP e matar não dá Caveira. Vermelhas (Ermos do Dragão e Fenda do Vazio): sem limite de nível. Laranjas: até {n} níveis de diferença.', { p: Math.round(R.PK_BONUS * 100), n: difNivelPvp })}</p>
    ${dentro ? '' : `<button class="botao mi-ir" data-ir="arena">${t('Ir para Runeterra')}</button>`}`;
}
$('#abrir-mapa').addEventListener('click', abrirMapa);
$('#voltar-base').addEventListener('click', () => {
  if (naAram()) { cena.aviso(t('Na arena, use o Render-se para sair.'), '#ff7050'); return; }
  if (bloqueioCaveira()) return;
  if (emCombateAqui() && !M.naBase(estado)) { avisoCombate(); return; }
  if (M.voltarBase(estado, combate)) { cancelarViagem(); log(t('Voltando para a base... (4 segundos)'), 'npc'); }
});

// ---------- Arena (12/10/2026): PvP 1 contra 1 numa ponte (regras em js/arena-pvp.js, servidor em servidor/duelo.js) ----------
// A fila e os desafios andam pelo HTTP (consultarArena); a partida anda pelo tempo real (mensagens 'arena'). Ao achar a
// partida o jogo leva o campeão para a ponte e reconecta o tempo real (aí o servidor o põe na sala); no fim, volta para onde estava.
function textoElo(e) { return e ? (e.div ? `${t(e.nome)} ${e.div}` : t(e.nome)) : ''; }
// a posição do elo numa escala só (Ferro IV = 0, Ferro III = 1… Mestre e acima, de 4 em 4), para saber se subiu ou caiu
function degrauElo(e) { return e.i * 4 + Math.max(0, ['IV', 'III', 'II', 'I'].indexOf(e.div)); }
// o emblema do elo: um escudo na cor do elo com a divisão embaixo
function emblemaElo(e, tam = 34) {
  if (!e) return '';
  const id = 'el' + Math.random().toString(36).slice(2, 7), c = e.cor || '#888';
  return `<svg class="elo-emblema" width="${tam}" height="${tam}" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="#0a0c12" stop-opacity=".85"/></linearGradient></defs>
    <path d="M16 1.5 28 6v8.5c0 7.6-5.4 12.8-12 16-6.6-3.2-12-8.4-12-16V6Z" fill="url(#${id})" stroke="${c}" stroke-width="1.6"/><path d="M16 1.5 28 6v8.5c0 7.6-5.4 12.8-12 16-6.6-3.2-12-8.4-12-16V6Z" fill="none" stroke="#0a0c12" stroke-width=".6" opacity=".7"/>
    <path d="M16 7.5 20.5 13 16 20.5 11.5 13Z" fill="${c}" stroke="#fff" stroke-opacity=".8" stroke-width=".8"/>${e.i >= 7 ? `<path d="M9 6.5 12 9.5 16 4.5 20 9.5 23 6.5" fill="none" stroke="#fff4c0" stroke-width="1.3"/>` : ''}
    ${e.div ? `<text x="16" y="28" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff" stroke="#0a0c12" stroke-width="1.6" paint-order="stroke">${e.div}</text>` : ''}</svg>`;
}
async function consultarArena() {
  clearTimeout(arenaTimer);
  if (CONVIDADO) return;
  try { aplicarArena(await rede.arena()); } catch { arenaTimer = setTimeout(consultarArena, 8000); }
}
function aplicarArena(r) {
  arenaInfo = r;
  for (const a of r.avisos || []) avisoArena(a);
  mostrarAchada(r.achada);
  mostrarConviteArena(r.convites || []);
  if (r.partida) {
    arenaPartida = arenaPartida?.id === r.partida.id ? { ...arenaPartida, ...r.partida } : { ...r.partida };      // partida nova: nada da anterior
    if (!naAram()) { if (r.partida.preparo > 0 && r.partida.estado === 'espera') mostrarPreparo(r.partida); else entrarNaArena(); }
  } else { $('#arena-preparo').hidden = true; if (naAram() && !arenaPartida?.fim) sairDaArena(); }      // a partida acabou (ou nem existe): volta
  // enquanto algo acontece (fila, partida encontrada, desafio) consulta de 2 em 2 s; com a janela aberta, de 15 em 15
  const ativo = r.fila || r.achada || r.enviado || r.convites?.length || r.partida?.estado === 'espera';
  // uma volta só: sem o clearTimeout, cada chamada (save, Jogar de novo, cliques) deixava a sua volta rodando junto
  clearTimeout(arenaTimer);
  if (ativo || !$('#janela-arena').hidden) arenaTimer = setTimeout(consultarArena, r.partida?.preparo > 0 ? 1000 : ativo ? 2000 : 15000);
  if (!$('#janela-arena').hidden) desenharArena();
  atualizarStatusArena();
}
// o save avisa quando há algo da arena (desafio, partida encontrada, partida, fila, aviso): aí consulta
function arenaChamada(a) { if (a && (a.convites || a.achada || a.avisos || (a.partida && !naAram()) || (a.fila && !arenaInfo?.fila))) consultarArena(); }
function avisoArena(a) {
  const tx = {
    voltouFila: t('O outro jogador não aceitou a partida. Você voltou para a fila.'),
    naoAceitou: t('Você não aceitou a partida encontrada: {min} minutos sem poder entrar na fila.', { min: a.min || 2 }),
    desafioRecusado: t('{nome} recusou o seu desafio.', { nome: a.nome }),
    desafioExpirou: t('{nome} não respondeu o seu desafio.', { nome: a.nome }),
    cancelada: a.culpa ? t('A partida da arena foi cancelada: você não chegou a tempo.') : t('A partida da arena foi cancelada: {nome} não chegou a tempo.', { nome: a.oponente }),
  }[a.tipo];
  if (tx) { log(tx, 'npc'); cena.aviso(tx, '#e8c070'); }
  if (a.tipo === 'fim' && Date.now() - arenaFimMostrado > 60000) mostrarResultadoArena(a);      // caiu a conexão no fim: o resultado vem por aqui
}
// ---------- a partida encontrada (fila) e o desafio recebido ----------
function cartaoArena(c) {
  if (!c) return '';
  return `<div class="ar-cartao"><img src="${miniatura(spriteCampeao(c.campeao || 'darius', c.skin || 0))}" alt=""><div><b>${esc(c.nome)}</b><small>${esc(dadosCampeao(c.campeao || 'darius').nome)} · ${t('nível {n}', { n: c.nivel || 1 })}</small>
    <span>${emblemaElo(c.elo, 18)} ${c.ranqueadas ? `${textoElo(c.elo)} · ${c.elo.pdl} ${t('PDL')}` : t('sem ranqueadas')}</span></div></div>`;
}
// a preparação: o oponente e o tempo para ajustar a build (itens e barra); "Estou pronto" nos dois começa na hora
function mostrarPreparo(p) {
  const el = $('#arena-preparo');
  if (el.hidden) { som.efeito('alerta'); log(t('Arena: contra {nome} ({campeao}). Você tem {s} s para ajustar a build.', { nome: p.oponente?.nome || '?', campeao: dadosCampeao(p.oponente?.campeao || 'darius').nome, s: p.preparo }), 'chefe'); fecharJanelas(); }
  el.hidden = false;
  arenaPartida.preparoAte = Date.now() + p.preparo * 1000;
  el.innerHTML = `<div class="ap-topo">⚔ ${t('Arena em')} <b id="arena-preparo-s">${p.preparo}</b> s</div>${cartaoArena(p.oponente)}
    <p>${t('Ajuste a sua build agora: itens (I) e a barra de habilidades.')}</p>
    <div class="ap-botoes">${p.pronto ? `<span class="fraco">${t('Esperando {nome}…', { nome: esc(p.oponente?.nome || '') })}</span>` : `<button type="button" class="botao principal" data-arena-pronto>${t('Estou pronto')}</button>`}
      <button type="button" class="botao" data-arena-aba="itens">🎒 ${t('Itens')}</button><button type="button" class="botao" data-arena-aba="habilidades">✨ ${t('Habilidades')}</button></div>`;
  clearInterval(arenaPreparoT);
  arenaPreparoT = setInterval(() => {
    const s = Math.max(0, Math.ceil(((arenaPartida?.preparoAte || 0) - Date.now()) / 1000)), b = $('#arena-preparo-s');
    if (b) b.textContent = s;
    if (!s || $('#arena-preparo').hidden) { clearInterval(arenaPreparoT); if (!$('#arena-preparo').hidden) consultarArena(); }
  }, 250);
}
document.addEventListener('click', async (e) => {
  const aba = e.target.closest('#arena-preparo [data-arena-aba]');
  if (aba) {          // a aba da coluna (itens ou habilidades); no celular deitado ela fica na gaveta, em pé embaixo do jogo
    abrirAba(aba.dataset.arenaAba);
    if (document.body.classList.contains('gaveta')) { abrirGaveta(true); setTimeout(() => $('#direita').scrollIntoView({ block: 'start', behavior: 'smooth' }), 50); }
    else if (!$('#direita').getBoundingClientRect().width || $('#direita').getBoundingClientRect().top > innerHeight - 80) $('#direita').scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  if (!e.target.closest('[data-arena-pronto]')) return;
  try { await rede.acaoArena('pronto'); } catch (err) { avisar(err.message); }
  consultarArena();
});
// o quadro só é refeito quando muda (outro oponente ou "aceitei"): refazer a cada consulta trocava os botões entre o
// apertar e o soltar do mouse, e o clique em Aceitar se perdia (12/10/2026, reclamação de jogadores); no resto, só a barra anda
function mostrarAchada(ac) {
  const el = $('#arena-achada');
  if (!ac) { el.hidden = true; el.dataset.chave = ''; return; }
  if (el.hidden) som.efeito('alerta');
  el.hidden = false;
  const chave = `${ac.oponente}|${ac.aceitei ? 1 : 0}`, barra = el.querySelector('.aa-barra i');
  if (el.dataset.chave === chave && barra) { barra.style.width = `${Math.round(ac.resta / ARENA_PVP.aceitarSeg * 100)}%`; return; }
  el.dataset.chave = chave;
  el.innerHTML = `<div class="aa-caixa"><b class="aa-titulo">⚔ ${t('Partida encontrada!')}</b><p>${t('Ranqueada contra {nome}', { nome: `<b>${esc(ac.oponente)}</b>` })}</p>${cartaoArena(ac.cartao)}
    <div class="aa-barra"><i style="width:${Math.round(ac.resta / ARENA_PVP.aceitarSeg * 100)}%"></i></div>
    ${ac.aceitei ? `<p class="fraco">${t('Esperando {nome} aceitar…', { nome: esc(ac.oponente) })}</p>`
      : `<div class="aa-botoes"><button type="button" class="botao principal" data-arena-aceitar="1">${t('Aceitar')}</button><button type="button" class="botao" data-arena-aceitar="0">${t('Recusar')}</button></div>`}</div>`;
}
function mostrarConviteArena(lista) {
  const el = $('#arena-convite'), c = lista[0];
  if (!c || naAram()) { el.hidden = true; return; }
  if (el.hidden || el.dataset.de !== c.nome) { som.efeito('alerta'); log(t('{nome} desafiou você para um duelo na arena.', { nome: c.nome }), 'raro'); }
  el.hidden = false; el.dataset.de = c.nome;
  el.innerHTML = `<b>⚔ ${t('{nome} desafiou você para um duelo na arena', { nome: esc(c.nome) })}</b>${cartaoArena(c.cartao)}<small>${t('Desafio não vale PDL · {s} s', { s: c.resta })}</small>
    <span class="ac-botoes"><button type="button" class="botao principal" data-arena-desafio="1">${t('Aceitar')}</button><button type="button" class="botao" data-arena-desafio="0">${t('Recusar')}</button></span>`;
}
document.addEventListener('click', async (e) => {
  const ac = e.target.closest('[data-arena-aceitar]'), dz = e.target.closest('[data-arena-desafio]');
  if (!ac && !dz) return;
  try {
    if (ac) await rede.acaoArena('aceitar', { aceitar: ac.dataset.arenaAceitar === '1' });
    else { const sim = dz.dataset.arenaDesafio === '1'; if (sim && !podeIrParaArena()) return; await rede.acaoArena('responder', { nome: $('#arena-convite').dataset.de, aceitar: sim }); $('#arena-convite').hidden = true; }
  } catch (err) { avisar(err.message); }
  consultarArena();
});
// quem pode sair para a arena agora (a mesma regra das viagens: sem Caveira, fora de combate, vivo)
function podeIrParaArena() {
  if (bloqueioCaveira()) return false;
  if (dungeonInfo?.sala) { avisar(t('Saia do grupo da dungeon para ir à arena.')); return false; }      // p665
  if (emCombateAqui() && localAtual().arena && !naAram()) { avisoCombate(); return false; }
  return true;
}
// ---------- entrar e sair da ponte ----------
async function entrarNaArena() {
  if (naAram() || combate.darius.morto > 0 || arenaEntrando) return;      // caído: tenta de novo na próxima consulta
  $('#arena-preparo').hidden = true;
  arenaEntrando = true;          // salva antes (a build que você acabou de montar é a que vale na luta)
  try { await salvar(); } catch {}
  arenaEntrando = false;
  if (naAram() || combate.darius.morto > 0) return;
  arenaSaida = estado.local; arenaVidaAntes = { vida: estado.vida, mana: estado.mana };
  if (viagem) cancelarViagem();
  fecharJanelas(); $('#arena-achada').hidden = true; $('#arena-convite').hidden = true;
  tempoReal.desligar();          // reconecta já na ponte: aí o servidor põe na sala
  if (!M.viajar(estado, combate, 'aram')) return;
  entrarCena(M.LOCAL.aram);
  log(t('Arena: você contra {nome}. Melhor de 3 rodadas; morrer aqui não custa XP nem itens.', { nome: arenaPartida?.oponente?.nome || '?' }), 'chefe');
  cena.aviso(t('Arena · contra {nome}', { nome: arenaPartida?.oponente?.nome || '?' }), '#ffd84a');
  som.efeito('raro');
  atualizarUI();
}
function sairDaArena() {
  if (!naAram()) { arenaPartida = null; return; }
  const volta = M.LOCAL[arenaSaida] && !M.LOCAL[arenaSaida].aram ? arenaSaida : 'fonte';
  arenaPartida = null; $('#arena-hud').hidden = true; $('#arena-aviso').hidden = true; $('#janela-arena-fim').hidden = true;
  tempoReal.desligar();
  M.renascerArena(estado, combate);
  if (arenaVidaAntes) { estado.vida = Math.max(1, arenaVidaAntes.vida); estado.mana = arenaVidaAntes.mana; }     // volta como estava (a arena não cura)
  arenaVidaAntes = null; arenaSaida = null;
  irPara(volta);
  atualizarUI();
}
function posArena() { const p = ARENA_PVP.inicio[arenaPartida?.lado ?? 0]; return { x: arenaPartida?.x ?? p.x, y: arenaPartida?.y ?? p.y }; }
// ---------- as mensagens da partida (tempo real) ----------
function arenaMsg(m) {
  const mesma = arenaPartida?.id === m.id;
  arenaPartida = { ...(mesma ? arenaPartida : {}), ...m, fim: (mesma && arenaPartida.fim) || m.ev === 'fim' };
  if (!naAram() && m.ev !== 'fim' && m.ev !== 'cancelada') entrarNaArena();
  const A = () => combate.arena;
  if (m.ev === 'rodada') {
    M.renascerArena(estado, combate);
    entrarCena(M.LOCAL.aram);
    A().congelado = true;
    arenaPartida.contagemAte = Date.now() + m.contagem * 1000; arenaPartida.lutaAte = 0;
    cena.aviso(t('Rodada {n}', { n: m.rodada }), '#ffd84a');
    log(t('Rodada {n} · placar {a} × {b}', { n: m.rodada, a: m.placar[0], b: m.placar[1] }), 'chefe');
    som.efeito('alerta');
  } else if (m.ev === 'luta') {
    if (A()) A().congelado = false;
    arenaPartida.lutaAte = Date.now() + m.resta * 1000; arenaPartida.avisoAte = Date.now() + 900; arenaPartida.aviso = t('Lutem!');
    som.efeito('fanfarra');
  } else if (m.ev === 'fimRodada') {
    if (A()) A().congelado = true;
    arenaPartida.lutaAte = 0;
    const eu = m.vencedor === NOME;
    arenaPartida.aviso = m.vencedor ? (eu ? t('Você venceu a rodada!') : t('{nome} venceu a rodada', { nome: m.vencedor })) : t('Empate no tempo: a rodada não conta');
    arenaPartida.avisoAte = Date.now() + (ARENA_PVP.intervaloSeg - 0.3) * 1000;
    log(arenaPartida.aviso + (m.motivo === 'tempo' ? ' ' + t('(acabou o tempo: venceu quem tinha mais vida)') : ''), eu ? 'raro' : 'morte');
  } else if (m.ev === 'fim') {
    if (A()) A().congelado = true;
    arenaFimMostrado = Date.now();
    mostrarResultadoArena(m.resultado);
  } else if (m.ev === 'cancelada') {
    log(t('A partida da arena foi cancelada.'), 'npc');
    sairDaArena();
  } else if (m.ev === 'estado' && A()) A().congelado = m.estado !== 'luta';
  else if (m.ev === 'posicao') {          // voltou para a partida (recarregou): no lugar onde estava
    arenaPartida.x = m.x; arenaPartida.y = m.y;
    if (naAram() && A()) { Arena.corrigirPosicao(combate, m.x, m.y); A().congelado = m.estado !== 'luta'; }
  }
  atualizarHudArena();
}
function mostrarResultadoArena(r) {
  const j = $('#janela-arena-fim');
  const titulo = r.empate ? t('Empate') : r.venceu ? t('Vitória!') : t('Derrota');
  const motivo = { rendeu: r.venceu ? t('{nome} desistiu.', { nome: r.oponente }) : t('Você desistiu.'), caiu: r.venceu ? t('{nome} saiu da partida.', { nome: r.oponente }) : t('Você saiu da partida.'), empate: t('5 rodadas sem vencedor.') }[r.motivo] || '';
  const subiu = r.ranqueada && r.antes != null ? Math.sign(degrauElo(r.elo) - degrauElo(eloArena(r.antes))) : 0;
  $('#arena-fim-corpo').innerHTML = `<div class="af-titulo ${r.empate ? '' : r.venceu ? 'venceu' : 'perdeu'}">${titulo}</div>
    <div class="af-placar"><b>${esc(NOME)}</b> <span>${r.placar[0]} × ${r.placar[1]}</span> <b>${esc(r.oponente)}</b></div>
    ${motivo ? `<p class="fraco af-motivo">${esc(motivo)}</p>` : ''}
    ${r.ranqueada ? `<div class="af-elo">${emblemaElo(r.elo, 64)}<div><b>${textoElo(r.elo)}</b> · ${r.elo.pdl} ${t('PDL')}
      <span class="af-var ${r.variacao >= 0 ? 'mais' : 'menos'}">${r.variacao >= 0 ? '+' : '−'}${Math.abs(r.variacao)} ${t('PDL')}</span>
      ${subiu > 0 ? `<span class="af-sobe">▲ ${t('Você subiu para {elo}!', { elo: textoElo(r.elo) })}</span>` : subiu < 0 ? `<span class="af-desce">▼ ${t('Você caiu para {elo}.', { elo: textoElo(r.elo) })}</span>` : ''}</div></div>`
      : `<p class="fraco">${t('Desafio: não vale PDL.')}</p>`}
    <div class="af-botoes"><button type="button" class="botao principal" data-arena-sair>${t('Sair da arena')}</button>${r.ranqueada ? `<button type="button" class="botao" data-arena-denovo>${t('Jogar de novo')}</button>` : ''}</div>`;
  j.hidden = false;
  som.efeito(r.venceu ? 'fanfarra' : 'morte');
  log(`${titulo} ${r.placar[0]} × ${r.placar[1]} ${t('contra {nome}', { nome: r.oponente })}${r.ranqueada ? ` · ${r.variacao >= 0 ? '+' : '−'}${Math.abs(r.variacao)} ${t('PDL')} (${textoElo(r.elo)})` : ''}`, r.venceu ? 'raro' : 'morte');
  if (naAram()) setTimeout(() => { if (naAram() && arenaPartida?.fim) sairDaArena(); }, 15000);      // sai sozinho depois de 15 s
}
$('#janela-arena-fim').addEventListener('click', async (e) => {
  // fechar a janela do resultado (no × ou fora dela) também sai da ponte: senão ficava preso esperando a saída automática
  if (e.target.closest('[data-arena-sair]') || ((e.target === e.currentTarget || e.target.closest('[data-fechar]')) && naAram() && arenaPartida?.fim)) sairDaArena();
  else if (e.target.closest('[data-arena-denovo]')) { sairDaArena(); try { await rede.acaoArena('fila', { entrar: true }); } catch (err) { avisar(err.message); } consultarArena(); }
});
// ---------- o placar na tela, a contagem e o Render-se ----------
function relogioArena(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function atualizarHudArena() {
  const hud = $('#arena-hud'), av = $('#arena-aviso'), p = arenaPartida;
  if (!naAram() || !p) { hud.hidden = true; av.hidden = true; return; }
  hud.hidden = false;
  const agora = Date.now(), pontos = (n) => Array.from({ length: ARENA_PVP.vitorias }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('');
  const info = p.lutaAte ? relogioArena(p.lutaAte - agora) : p.estado === 'espera' ? t('esperando {nome}…', { nome: p.oponente?.nome || '' }) : '';
  const chave = [p.placar?.join(), p.rodada, info, p.oponente?.nome, p.fim].join('|');
  if (hud.dataset.chave !== chave) {
    hud.dataset.chave = chave;
    hud.innerHTML = `<div class="ah-lado eu"><b>${esc(NOME)}</b><span class="ah-pts">${pontos(p.placar?.[0] || 0)}</span></div>
      <div class="ah-meio"><b>${p.placar?.[0] || 0} × ${p.placar?.[1] || 0}</b><small>${p.rodada ? t('Rodada {n}', { n: p.rodada }) + (info ? ' · ' + info : '') : info}</small></div>
      <div class="ah-lado op"><span class="ah-pts">${pontos(p.placar?.[1] || 0)}</span><b>${esc(p.oponente?.nome || '')}</b></div>
      ${p.fim ? `<button type="button" class="botao ah-render" data-arena-sair-hud>🚪 ${t('Sair da arena')}</button>` : `<button type="button" class="botao ah-render" data-arena-render title="${t('Desistir da partida (conta como derrota)')}">🏳 ${t('Render-se')}</button>`}`;
  }
  // a contagem antes da rodada e os avisos grandes (rodada vencida, "Lutem!")
  let txt = '';
  if (p.contagemAte > agora) txt = String(Math.ceil((p.contagemAte - agora) / 1000));
  else if (p.avisoAte > agora) txt = p.aviso;
  av.hidden = !txt;
  if (txt && av.textContent !== txt) { av.textContent = txt; av.classList.remove('pulsa'); void av.offsetWidth; av.classList.add('pulsa'); }
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-arena-sair-hud]')) { sairDaArena(); return; }
  if (!e.target.closest('[data-arena-render]')) return;
  if (!(await confirmar(t('Desistir da partida? Ela conta como derrota.')))) return;
  try { await rede.acaoArena('render'); } catch (err) { avisar(err.message); }
});
// ---------- a janela da Arena ----------
function atualizarStatusArena() {
  const el = $('#arena-status'), f = arenaInfo?.fila;
  el.hidden = !f || naAram();
  if (!el.hidden) el.innerHTML = `⚔ ${t('Procurando partida')} · <b>${relogioArena(f.seg * 1000)}</b> <button type="button" class="fechar" data-arena-fila="0" title="${t('Sair da fila')}">×</button>`;
}
$('#arena-status').addEventListener('click', (e) => { if (!e.target.closest('[data-arena-fila]')) abrirArena(); });
async function abrirArena() {
  if (CONVIDADO) { avisar(t('Salve seu progresso (crie a conta) para jogar na arena.')); return; }
  $('#janela-arena').hidden = false;
  desenharArena();
  await consultarArena();
  carregarListaArena();
}
async function carregarListaArena() {
  arenaLista = null; desenharArena();
  try { arenaLista = arenaAba === 'historico' ? await rede.historicoArena() : arenaAba === 'ranking' ? await rede.rankingArena() : {}; } catch (err) { arenaLista = { erro: err.message }; }
  desenharArena();
}
function desenharArena() {
  const r = arenaInfo, el = $('#arena'), campo = $('#ar-nome'), digitado = campo?.value || '', foco = document.activeElement === campo;
  if (!r) { el.innerHTML = `<p class="fraco">${t('Carregando…')}</p>`; return; }
  const e = r.eu.elo, jog = r.eu.vitorias + r.eu.derrotas, nivelOk = estado.nivel >= r.regras.nivelMin;
  const fila = r.fila ? `<div class="ar-fila"><span class="ar-girando"></span><div><b>${t('Procurando partida…')}</b> <span id="ar-fila-t">${relogioArena(r.fila.seg * 1000)}</span>
      <small>${t('Poder parecido com o seu: até {p}% de diferença (abre com o tempo)', { p: Math.round(Math.min(ARENA_PVP.fila.max, ARENA_PVP.fila.faixa + Math.floor(r.fila.seg / ARENA_PVP.fila.cada) * ARENA_PVP.fila.cresce) * 100) })}</small></div>
      <button type="button" class="botao" data-arena-fila="0">${t('Sair da fila')}</button></div>`
    : `<button type="button" class="botao principal ar-procurar" data-arena-fila="1" ${nivelOk && !r.castigo ? '' : 'disabled'}>⚔ ${t('Procurar partida')}</button>
      ${!nivelOk ? `<small class="alerta">${t('A ranqueada libera no nível {n}.', { n: r.regras.nivelMin })}</small>` : r.castigo ? `<small class="alerta">${t('Você pode voltar para a fila em {s} s.', { s: r.castigo })}</small>` : ''}`;
  const desafio = r.enviado ? `<div class="ar-enviado">${t('Esperando {nome} responder ({s} s)', { nome: `<b>${esc(r.enviado.nome)}</b>`, s: r.enviado.resta })} <button type="button" class="botao" data-arena-cancelar>${t('Cancelar')}</button></div>`
    : `<form class="ar-desafio" data-sem-envio><input id="ar-nome" maxlength="24" placeholder="${t('Nome do jogador')}" autocomplete="off"><button type="submit" class="botao">${t('Desafiar')}</button></form>`;
  const convites = (r.convites || []).map((c) => `<div class="ar-convite">⚔ ${t('{nome} desafiou você ({s} s)', { nome: `<b>${esc(c.nome)}</b>`, s: c.resta })}
      <button type="button" class="botao principal" data-arena-resp="${esc(c.nome)}" data-sim="1">${t('Aceitar')}</button><button type="button" class="botao" data-arena-resp="${esc(c.nome)}" data-sim="0">${t('Recusar')}</button></div>`).join('');
  let lista = `<p class="fraco">${t('Carregando…')}</p>`;
  if (arenaAba === 'regras') lista = `<ul class="ar-regras"><li>${t('Partida 1 contra 1 numa ponte, melhor de 3 rodadas. Cada rodada acaba quando alguém morre ou em {m} minutos (aí vence quem tem mais % de vida).', { m: Math.round(ARENA_PVP.rodadaSeg / 60) })}</li>
      <li>${t('Morrer na arena não custa XP nem itens. As poções valem; vida, mana e recargas voltam cheias a cada rodada.')}</li>
      <li>${t('Ranqueada: a fila procura alguém de Poder parecido. Quem ganha leva PDL (perto de 20) e quem perde perde (perto de 18); vencer quem está acima vale mais. As 5 primeiras valem o dobro.')}</li>
      <li>${t('Elos: Ferro, Bronze, Prata, Ouro, Platina, Esmeralda e Diamante (divisões IV a I, 100 PDL cada), depois Mestre, Grão-Mestre e Desafiante.')}</li>
      <li>${t('Desafio: você chama alguém pelo nome. Não vale PDL.')}</li>
      <li>${t('Personagens da mesma conta ou criados na mesma rede não valem PDL entre si, e a mesma dupla vale no máximo {n} vezes por dia.', { n: ARENA_PVP.mesmoParDia })}</li>
      <li>${t('Sair no meio (fechar o jogo por mais de {s} s) ou se render conta como derrota.', { s: ARENA_PVP.quedaSeg })}</li></ul>`;
  else if (arenaLista?.erro) lista = `<p class="alerta">${esc(arenaLista.erro)}</p>`;
  else if (arenaAba === 'ranking' && arenaLista?.lista) lista = arenaLista.lista.length ? `<ol class="ar-ranking">${arenaLista.lista.map((x) => `<li class="${x.nome === NOME ? 'eu' : ''}"><span class="ar-pos">${x.pos}</span>${emblemaElo(x.elo, 24)}<a href="#" data-arena-perfil="${esc(x.nome)}">${esc(x.nome)}</a><small>${esc(dadosCampeao(x.campeao).nome)} · ${t('nv {n}', { n: x.nivel })}</small><span class="ar-vd">${x.vitorias}V ${x.derrotas}D</span><b>${textoElo(x.elo)} · ${x.elo.pdl}</b></li>`).join('')}</ol>`
      : `<p class="fraco">${t('Ninguém jogou ranqueada ainda. Seja o primeiro!')}</p>`;
  else if (arenaAba === 'historico' && arenaLista?.partidas) lista = arenaLista.partidas.length ? `<ul class="ar-hist">${arenaLista.partidas.map((p) => `<li class="${p.empate ? '' : p.venceu ? 'venceu' : 'perdeu'}"><b>${p.empate ? t('Empate') : p.venceu ? t('Vitória') : t('Derrota')}</b> ${p.placar.replace('-', ' × ')}
      <span>${t('contra {nome}', { nome: esc(p.oponente || '?') })}</span><small>${p.tipo === 'ranqueada' ? t('Ranqueada') : t('Desafio')}${p.tipo === 'ranqueada' ? ` · ${p.variacao >= 0 ? '+' : '−'}${Math.abs(p.variacao)} ${t('PDL')}` : ''} · ${new Date(p.quando).toLocaleString()}</small></li>`).join('')}</ul>`
      : `<p class="fraco">${t('Você ainda não jogou na arena.')}</p>`;
  el.innerHTML = `<div class="ar-topo">${emblemaElo(e, 72)}<div class="ar-elo"><b>${textoElo(e)}</b><span>${e.pdl} ${t('PDL')}${r.posicao ? ` · ${t('#{n} no ranking', { n: r.posicao })}` : ''}</span>
      ${e.div ? `<div class="ar-barra"><i style="width:${e.pdl}%"></i></div>` : ''}
      <small>${jog ? t('Vitórias: {v} · derrotas: {d} ({p}%)', { v: r.eu.vitorias, d: r.eu.derrotas, p: Math.round(r.eu.vitorias / jog * 100) }) : t('Sem partidas ranqueadas ainda')}${r.eu.ranqueadas < ARENA_PVP.calibracao ? ' · ' + t('calibração: {n} de {m}', { n: r.eu.ranqueadas, m: ARENA_PVP.calibracao }) : ''}</small></div></div>
    <div class="ar-colunas"><section class="ar-bloco"><h4>${t('Ranqueada')}</h4><p class="fraco">${t('Contra alguém de Poder parecido. Vale PDL.')}</p>${fila}</section>
      <section class="ar-bloco"><h4>${t('Desafio')}</h4><p class="fraco">${t('Chame um jogador pelo nome. Não vale PDL.')}</p>${desafio}${convites}</section></div>
    <nav class="ar-abas">${[['ranking', t('Ranking')], ['historico', t('Histórico')], ['regras', t('Regras')]].map(([k, n]) => `<button type="button" class="${arenaAba === k ? 'ativa' : ''}" data-arena-aba="${k}">${n}</button>`).join('')}</nav>
    <div class="ar-lista">${lista}</div>`;
  const novo = $('#ar-nome');
  if (novo) { novo.value = digitado; if (foco) novo.focus(); }
}
$('#janela-arena').addEventListener('click', async (e) => {
  const aba = e.target.closest('[data-arena-aba]'), fila = e.target.closest('[data-arena-fila]'), resp = e.target.closest('[data-arena-resp]'), pf = e.target.closest('[data-arena-perfil]');
  if (aba) { arenaAba = aba.dataset.arenaAba; carregarListaArena(); return; }
  if (pf) { e.preventDefault(); abrirPerfil(pf.dataset.arenaPerfil); return; }
  try {
    if (fila) { if (fila.dataset.arenaFila === '1' && !podeIrParaArena()) return; await rede.acaoArena('fila', { entrar: fila.dataset.arenaFila === '1' }); }
    else if (e.target.closest('[data-arena-cancelar]')) await rede.acaoArena('cancelar');
    else if (resp) { if (resp.dataset.sim === '1' && !podeIrParaArena()) return; await rede.acaoArena('responder', { nome: resp.dataset.arenaResp, aceitar: resp.dataset.sim === '1' }); }
    else return;
  } catch (err) { avisar(err.message); }
  consultarArena();
});
$('#janela-arena').addEventListener('submit', async (e) => {
  if (!e.target.closest('.ar-desafio')) return;
  e.preventDefault();
  const nome = $('#ar-nome').value.trim();
  if (!nome) return;
  await desafiarNaArena(nome);
});
async function desafiarNaArena(nome) {
  if (!podeIrParaArena()) return;
  try { const r = await rede.acaoArena('desafiar', { nome }); log(t('Você desafiou {nome} para um duelo na arena. O desafio vale 60 s.', { nome: r.nome || nome }), 'npc'); }
  catch (err) { avisar(err.message); }
  consultarArena();
}
// arena: fila de 1 em 1 s no relógio do status (sem consultar o servidor)
setInterval(() => { if (arenaInfo?.fila && !naAram()) { arenaInfo.fila.seg++; atualizarStatusArena(); const el = $('#ar-fila-t'); if (el) el.textContent = relogioArena(arenaInfo.fila.seg * 1000); } }, 1000);
$('#abrir-arena').addEventListener('click', abrirArena);
// o status da fila (fora da janela) também tira da fila
$('#arena-status').addEventListener('click', async (e) => { if (!e.target.closest('[data-arena-fila]')) return; e.stopPropagation(); try { await rede.acaoArena('fila', { entrar: false }); } catch {} consultarArena(); }, true);
// ao abrir: desafios ou partida esperando; se a página recarregou no meio de uma partida, volta para ela (ou sai da ponte)
if (!CONVIDADO) setTimeout(consultarArena, localAtual().aram ? 300 : 4000);
if (localAtual().aram) arenaSaida = 'fonte';

// ---------- Dungeon do Braum (servidor/masmorra.js): o grupo, os convites e a luta, que roda no servidor ----------
// var (não let): o save pode responder antes de o módulo chegar aqui
var dungeonPremio = null, dungeonInfo = null, dungeonTimer = null, dungeonDesde = 0, dungeonRecebendo = false, dungeonAmigos = null, dungeonConvitesVistos = new Set(), dungeonLogLinhas = [], dungeonResultado = null;
const dungeonLuta = () => dungeonInfo?.sala?.estado === 'luta';
function relogioDg(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
// o que aconteceu na luta, em texto (vai para o registro e, os grandes, para a tela)
function textoDg(l) {
  const nomeEst = (k) => t(dungeonInfo?.regras?.estagios?.[k] || '');
  switch (l.tipo) {
    case 'comecou': return [t('A dungeon começou! O grupo sobe a montanha de Freljord.'), 1];
    case 'onda': return [t('Onda {n}: {nomes}', { n: (l.onda || 0) + 1, nomes: [...new Set(l.nomes || [])].map((x) => t(x)).join(', ') }), 0];
    case 'estagio': return [t('Estágio vencido: {nome}!', { nome: nomeEst(l.estagio) }), 1];
    case 'avalancheAviso': return [t('Um poro enfurecido prepara uma bola de neve em {nome}!', { nome: l.alvo || '?' }), 0];
    case 'avalanche': return [t('Bola de neve em {nome}!', { nome: l.alvo || '?' }), 0];
    case 'braumQ': return [t('Mordida do Inverno em {nome}!', { nome: l.alvo || '?' }), 0];
    case 'braumSalto': return [t('Braum saltou em {nome}!', { nome: l.alvo || '?' }), 0];
    case 'mordida': return [t('Mordida do Inverno: {nome} ficou atordoado.', { nome: l.alvo || '?' }), 0];
    case 'inquebravel': return [t('Braum ergueu o Inquebrável: quem ataca de longe causa 70% menos dano por {s} s.', { s: l.dur || 4 }), 1];
    case 'fissuraAviso': return [t('Braum prepara a Fissura Glacial!'), 1];
    case 'fissura': return [t('Fissura Glacial! O grupo todo foi jogado para o alto.'), 0];
    case 'braumFuria': return [t('Braum ficou furioso!'), 1];
    case 'chamado': return [t('Braum chamou os lobos da montanha!'), 1];
    case 'caiu': return [t('{nome} caiu. Volta no próximo estágio, com metade da vida.', { nome: l.alvo || '?' }), 0];
    case 'desistiu': return [t('{nome} desistiu da dungeon.', { nome: l.alvo || '?' }), 0];
    case 'venceu': return [t('Vitória! Braum foi vencido.'), 1];
    case 'falhou': return [t('O grupo não aguentou. A dungeon acabou.'), 1];
  }
  return null;
}
async function consultarDungeon() {
  clearTimeout(dungeonTimer);
  if (CONVIDADO) return;
  try { aplicarDungeon(await rede.dungeon(dungeonDesde, dungeonLuta() || dgVendo ? dgVd : null)); } catch { dungeonTimer = setTimeout(consultarDungeon, dungeonLuta() ? 1500 : 8000); }
}
// o save avisa quando há algo (convite, grupo, resultado): aí o jogo passa a consultar
function dungeonChamada(c) { if (c && !dungeonTimer && !dungeonInfo?.sala) consultarDungeon(); }
function aplicarDungeon(r) {
  const antes = dungeonInfo;
  dungeonInfo = r;
  // convites novos
  for (const c of r.convites || []) if (!dungeonConvitesVistos.has(c.sala)) {
    dungeonConvitesVistos.add(c.sala); som.efeito('alerta');
    log(t('{nome} chamou você para a Dungeon do Braum. Abra a janela da Dungeon para aceitar.', { nome: c.de }), 'chefe');
    cena.aviso(t('{nome} chamou você para a dungeon!', { nome: c.de }), '#9fe0ff');
  }
  if (r.sala?.daFila && r.sala.estado === 'sala' && antes?.sala?.id !== r.sala.id) {      // a fila formou o grupo (p694)
    som.efeito('alerta'); cena.aviso(t('Grupo da dungeon encontrado! Fique pronto na Fonte.'), '#9fe0ff');
    log(t('A fila formou um grupo para a Dungeon do Braum. Abra a janela e clique em Estou pronto.'), 'chefe');
    if ($('#janela-dungeon').hidden) abrirDungeon();
  }
  if (r.sala?.resultado) dungeonResultado = r.sala.resultado;
  if (!r.sala && r.pendente?.motivo === 'desistiu') { dungeonResultado ??= r.pendente; if (dgVendo) sairDaDungeonVisual(); }      // desistiu (p692)      // o servidor tira a sala logo depois de entregar: o resultado fica aqui até fechar
  const L = r.sala?.luta;
  if (L) {
    if (antes?.sala?.estado !== 'luta' && r.sala.estado === 'luta') { fecharJanelas(); som.efeito('fanfarra'); }
    for (const l of L.log) {
      dungeonDesde = Math.max(dungeonDesde, l.n);
      const x = textoDg(l); if (!x) continue;
      log('🧊 ' + x[0], l.tipo === 'caiu' || l.tipo === 'falhou' ? 'morte' : x[1] ? 'chefe' : 'npc');
      if (x[1] && !dgVendo) cena.aviso(x[0], l.tipo === 'falhou' ? '#ff7050' : '#9fe0ff');
      if (l.tf != null) dgMecs.push(l);
    }
    dungeonVisual(L);
    if (r.sala.estado === 'fim' && dgVendo && !dgSaindo) dgSaindo = setTimeout(() => { dgSaindo = null; sairDaDungeonVisual(); }, 4500);
  } else dungeonDesde = 0;
  // resultado esperando: recebe sozinho (desconta as poções gastas na luta)
  if (r.pendente && !dungeonRecebendo) receberDungeon();
  desenharStatusDungeon();
  if (!$('#janela-dungeon').hidden) desenharDungeon();
  const ritmo = dungeonLuta() ? 300 : r.sala || r.fila ? 2500 : (r.convites?.length || !$('#janela-dungeon').hidden) ? 4000 : 0;
  dungeonTimer = ritmo ? setTimeout(consultarDungeon, ritmo) : null;
}
async function receberDungeon() {
  dungeonRecebendo = true;
  try {
    const r = await operarServidor('/api/dungeon/fim');
    const g = r?.resultado?.gastas || {}, n = Object.values(g).reduce((a, b) => a + b, 0);
    if (r) log(n ? t('Dungeon: você gastou {n} poções na luta.', { n }) : t('Dungeon: você não gastou poções na luta.'), 'npc');
    const pr = r?.premio;
    if (pr) {
      dungeonPremio = pr;
      if (pr.xp || pr.ouro) log(t('Prêmio da dungeon: +{xp} de XP e +{ouro} de ouro.', { xp: inteiro(pr.xp), ouro: inteiro(pr.ouro) }), 'raro');
      const esp = Object.entries(pr.espolios || {}).map(([id, q]) => `${q}× ${t(M.ESPOLIOS[id]?.nome || id)}`);
      if (esp.length) log(t('Espólios de Freljord: {lista}.', { lista: esp.join(', ') }), pr.espolios['bigode-braum'] ? 'raro' : 'loot');
      if (pr.item) { const it = descreverItem(pr.item); log(t('Lendário da dungeon: {item}!', { item: it.nome }), 'raro'); cena.aviso(t('Lendário: {item}!', { item: it.nome }), '#ffb030'); som.efeito('fanfarra'); alertaLendario?.(it.nome); }
      if (pr.mascote) { log(t('Você ganhou o mascote Poro de Bigode! Escolha ele na aba Coleção.'), 'raro'); cena.aviso(t('Poro de Bigode!'), '#ffe08a'); som.efeito('fanfarra'); }
      for (const id of pr.perdidos || []) log(t('Sua mochila está cheia! {item} ficou para trás.', { item: M.ESPOLIOS[id] ? t(M.ESPOLIOS[id].nome) : descreverItem(id).nome }), 'morte');
      atualizarUI();
      if (!$('#janela-dungeon').hidden) desenharDungeon();
    }
  } finally { dungeonRecebendo = false; }
}
function desenharStatusDungeon() {
  const el = $('#dungeon-status'), r = dungeonInfo, L = r?.sala?.luta;
  let txt = '';
  if (r?.sala?.estado === 'luta' && L) txt = `🧊 ${t('Dungeon')} · ${t('Estágio {n}/{m}', { n: L.estagio + 1, m: L.estagios })} · <b>${relogioDg(L.seg)}</b>`;
  else if (r?.convites?.length) txt = `🧊 ${t('{nome} chamou você para a dungeon', { nome: esc(r.convites[0].de) })}`;
  else if (r?.sala?.estado === 'sala') txt = `🧊 ${t('Grupo da dungeon')} · ${r.sala.membros.length}/${r.regras.max}`;
  else if (r?.fila) txt = `🔎 ${t('Procurando grupo para a dungeon')} · ${relogioDg(r.fila.seg)}`;
  el.hidden = !txt || !$('#janela-dungeon').hidden || dgVendo;      // com a luta na tela, o estágio aparece na própria cena
  if (!el.hidden && el.innerHTML !== txt) el.innerHTML = txt;
}
$('#dungeon-status').addEventListener('click', () => abrirDungeon());
// painel lateral (p704): encostado à direita da tela do jogo, deixando a coluna da direita livre
function posicionarDungeonLateral() {
  const j = $('#janela-dungeon'), lat = $('#lateral'), lado = innerWidth >= 1000 && !document.body.classList.contains('gaveta') && dungeonInfo?.sala?.estado === 'sala';      // só a tela do grupo
  j.classList.toggle('lateral-dg', lado);
  j.style.setProperty('--dg-dir', lado && lat ? `${Math.max(0, innerWidth - lat.getBoundingClientRect().left) + 8}px` : '0px');
}
addEventListener('resize', () => { if (!$('#janela-dungeon').hidden) posicionarDungeonLateral(); });
async function abrirDungeon() {
  if (CONVIDADO) { avisar(t('Salve seu progresso (crie a conta) para entrar na dungeon.')); return; }
  $('#janela-dungeon').hidden = false; $('#dungeon-status').hidden = true;
  posicionarDungeonLateral();      // painel lateral no computador (p704)
  desenharDungeon();
  rede.amigos().then((r) => { dungeonAmigos = r.amigos || []; if (!$('#janela-dungeon').hidden) desenharDungeon(); }).catch(() => {});
  await consultarDungeon();
}
$('#abrir-dungeon').addEventListener('click', abrirDungeon);
// as cartas das dungeons: a do Braum (clicável, monta o grupo) e duas que ainda vão chegar (p674)
function cartasDungeon(pode, R) {
  const img = (n) => `<img src="assets/img/dungeon/${n}.png" srcset="assets/img/dungeon/${n}.png 1x, assets/img/dungeon/${n}@2x.png 2x" width="240" height="340" alt="" loading="lazy" decoding="async">`;
  const breve = (n) => `<div class="dg-carta breve" aria-label="${t('Em breve')}">${img(n)}<span class="dg-carta-titulo">???</span><span class="dg-carta-selo">${t('Em breve')}</span></div>`;
  return `<div class="dg-cartas"><button type="button" class="dg-carta ativa" data-dg="criar" ${pode ? '' : 'disabled'} aria-label="${t('Covil de Braum')}">${img('braum')}<span class="dg-carta-titulo">${t('Covil de Braum')}</span><span class="dg-carta-selo">${t('Freljord · nível {n}', { n: R.nivelMin })}</span></button>${breve('misterio')}${breve('misterio-ambar')}</div>`;
}
// p678: o que a vitória dá, com as chances e os valores no nível do jogador
function recompensasDg(r, R) {
  const P = R.premio, v = M.premioDungeonDe(Math.max(R.nivelMin, r.nivel || 1)), pct = (x) => `${(x * 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 })}%`;
  const linha = (ico, nome, valor, chance, cls = '') => `<li class="${cls}"><span class="dg-rc-ico">${ico}</span><span class="dg-rc-nome">${nome}${valor ? `<small>${valor}</small>` : ''}</span><b class="dg-rc-chance">${chance}</b></li>`;
  return `<div class="dg-recompensas"><b>${t('Recompensas da vitória')}</b><small>${t('Valores no seu nível ({n}). Os espólios você vende no Lojista.', { n: Math.max(R.nivelMin, r.nivel || 1) })}</small><ul>
    ${linha('✨', t('Experiência'), t('+{n} de XP · uns {m} min de caça', { n: inteiro(v.xp), m: P.xpMin }), t('Sempre'))}
    ${linha('💰', t('Ouro'), `+${inteiro(v.ouro)}`, t('Sempre'))}
    ${linha('🧊', `${t('Pele de Yeti')} · ${t('Presa do Lobo do Gelo')}`, t('~{n} de ouro no Lojista', { n: inteiro(v.espolioOuro) }), t('Sempre'))}
    ${linha('🥨', t('Mecha do Bigode do Braum'), t('~{n} de ouro no Lojista', { n: inteiro(M.ESPOLIOS['bigode-braum']?.valor || 0) }), pct(P.bigode), 'raro')}
    ${linha('⚔', t('Item lendário da sua classe'), t('qualidade de C a SS, sorteada no servidor'), pct(P.lendario), 'lendario')}
    ${linha('🐾', t('Mascote Poro de Bigode'), `${t('+1,25% de ouro por nível')}${r.temPoro ? ` · ${t('Você já tem')}` : ''}`, r.temPoro ? '✔' : pct(P.mascote), 'raro')}
  </ul><small>${t('Na derrota: {a}% do XP, do ouro e dos espólios com 1 estágio vencido e {b}% com 2.', { a: Math.round(P.porEstagio[1] * 100), b: Math.round(P.porEstagio[2] * 100) })}</small></div>`;
}
function barraDg(v, max, cls = '') { const p = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0; return `<span class="dg-barra ${cls}"><i style="width:${p.toFixed(1)}%"></i></span>`; }
function desenharDungeon() {
  const el = $('#dungeon'), r = dungeonInfo, campo = $('#dg-nome'), digitado = campo?.value || '', foco = document.activeElement === campo;
  if (!r) { el.innerHTML = `<p class="fraco">${t('Carregando…')}</p>`; return; }
  const s = r.sala || (dungeonResultado ? { estado: 'fim', resultado: dungeonResultado } : null), R = r.regras;
  posicionarDungeonLateral();      // a tela do grupo vai para o lado; as outras ficam no meio (p704)
  const topo = `<div class="dg-topo"><div class="dg-escudo" aria-hidden="true"><svg viewBox="0 0 32 32" width="40" height="40"><path d="M2 28 12 10l5 8 4-6 9 16Z" fill="#cfe8f7" stroke="#0e2a3a" stroke-width="1.2"/><path d="M12 10l2.8 4.5-2.4 1.2-2-2.8ZM21 12l2.2 3.6-1.8.8-1.6-2.4Z" fill="#fff"/><path d="M5 28l4-6 3 3 5-5 4 4 3-2 5 6Z" fill="#6aa8d8" opacity=".55"/><path d="M26 4v6M23 7h6M24 5l4 4M28 5l-4 4" stroke="#bfe6ff" stroke-width="1"/></svg></div><div><b>${t('Covil de Braum')}</b>
      <small>${t('Freljord · de 1 a {n} jogadores · nível {nv}', { n: R.max, nv: R.nivelMin })}</small>
      <small>${r.espera ? t('Próxima entrada em {t}', { t: relogioDg(r.espera) }) : t('Você pode entrar agora')}</small></div></div>`;
  if (!s) {
    const convites = (r.convites || []).map((c) => `<div class="dg-convite">🧊 ${t('{nome} chamou você ({n} no grupo, {s} s)', { nome: `<b>${esc(c.de)}</b>`, n: c.membros, s: c.resta })}
        <button type="button" class="botao principal" data-dg-resp="${esc(c.sala)}" data-sim="1">${t('Aceitar')}</button><button type="button" class="botao" data-dg-resp="${esc(c.sala)}" data-sim="0">${t('Recusar')}</button></div>`).join('');
    const pode = r.nivel >= R.nivelMin && !r.espera;      // (p694: com a fila)
    el.innerHTML = `${topo}${convites}
      <p>${t('Braum espera no alto da montanha. A subida é automática: os campeões lutam sozinhos com as habilidades da barra e usam as suas poções. Junte até {n} amigos e chegue até ele.', { n: R.max - 1 })}</p>
      <ol class="dg-estagios">${R.estagios.map((n, k) => `<li><b>${t('Estágio {n}', { n: k + 1 })}</b> ${t(n)}</li>`).join('')}</ol>
      <ul class="dg-regras"><li>${t('Morrer na dungeon não custa XP nem itens. Quem cai volta no estágio seguinte.')}</li>
        <li>${t('Para começar, todo o grupo precisa estar na Fonte. Durante a luta você fica na Fonte.')}</li>
        <li>${t('O grupo tem {m} minutos para vencer o Braum.', { m: Math.round(R.limiteSeg / 60) })}</li>
        <li>${t('Dá para entrar de novo {m} minutos depois de começar a última.', { m: R.intervaloMin })}</li>
      </ul>
      ${recompensasDg(r, R)}
      ${convites}
      ${cartasDungeon(pode, R)}
      ${r.fila ? `<div class="dg-fila"><b>🔎 ${t('Procurando grupo…')}</b><small>${t('{n} na fila · esperando há {t}', { n: r.fila.n, t: relogioDg(r.fila.seg) })}</small><small>${t('Quando juntar {n} jogadores de nível parecido, o grupo se forma e a luta começa sozinha quando todos ficarem prontos na Fonte.', { n: r.fila.tam })}</small><button type="button" class="botao" data-dg-fila="0">${t('Sair da fila')}</button></div>`
        : `<div class="dg-botoes dg-entrar"><button type="button" class="botao principal dg-criar" data-dg-fila="1" ${pode ? '' : 'disabled'} title="${t('Entra na fila e o jogo forma um grupo com outros jogadores')}">🔎 ${t('Procurar grupo')}</button>
      <button type="button" class="botao principal dg-criar" data-dg="criar" ${pode ? '' : 'disabled'}>🧊 ${t('Montar um grupo')}</button></div>`}
      ${r.nivel < R.nivelMin ? `<small class="alerta">${t('A dungeon libera no nível {n}.', { n: R.nivelMin })}</small>` : r.espera ? `<small class="alerta">${t('Você pode entrar de novo em {m} min.', { m: Math.ceil(r.espera / 60) })}</small>` : ''}`;
    return;
  }
  if (s.estado === 'sala') {
    const eu = s.membros.find((m) => m.nome === NOME), cheio = s.membros.length >= R.max, todos = s.membros.every((m) => m.pronto);
    const vagas = Array.from({ length: R.max - s.membros.length }, () => `<li class="dg-vaga">${t('vaga livre')}</li>`).join('');
    const situ = (m) => m.pronto ? `<span class="dg-ok">✔ ${t('Pronto')}</span>` : !m.online ? `<span class="dg-nao">${t('offline')}</span>` : !m.naFonte ? `<span class="dg-nao">${t('fora da Fonte')}</span>` : `<span class="fraco">${t('esperando…')}</span>`;
    const amigos = s.souLider && !cheio ? (dungeonAmigos || []).filter((a) => a.online && a.nivel >= R.nivelMin && !s.membros.some((m) => m.nome === a.nome)) : [];
    el.innerHTML = `${topo}
      <ul class="dg-membros">${s.membros.map((m) => `<li class="${m.nome === NOME ? 'eu' : ''}"><img src="${miniatura(spriteCampeao(m.campeao, m.skin))}" alt="">
          <div><b>${s.lider === m.nome ? '♛ ' : ''}${esc(m.nome)}</b><small>${esc(dadosCampeao(m.campeao).nome)} · ${t('nível {n}', { n: m.nivel })}</small></div>${situ(m)}
          ${s.souLider && m.nome !== NOME ? `<button type="button" class="botao dg-tirar" data-dg-tirar="${esc(m.nome)}" title="${t('Tirar do grupo')}">×</button>` : ''}</li>`).join('')}${vagas}</ul>
      ${s.souLider && !cheio ? `<form class="dg-convidar" data-sem-envio><input id="dg-nome" maxlength="24" placeholder="${t('Nome do jogador')}" autocomplete="off"><button type="submit" class="botao">${t('Convidar')}</button></form>
        ${amigos.length ? `<div class="dg-amigos"><small>${t('Amigos online:')}</small>${amigos.map((a) => `<button type="button" class="botao" data-dg-amigo="${esc(a.nome)}">+ ${esc(a.nome)}</button>`).join('')}</div>` : ''}` : ''}
      ${s.daFila ? `<p class="dg-fila-aviso">🔎 ${t('Grupo formado pela fila: a luta começa sozinha quando todos estiverem prontos. Faltam {s} s para ficar pronto.', { s: s.prazo ?? 0 })}</p>` : ''}
      ${!localAtual().base ? `<p class="alerta">${t('Volte para a Fonte (tecla B) para ficar pronto.')}</p>` : ''}
      <div class="dg-botoes">${eu?.pronto ? `<button type="button" class="botao" data-dg-pronto="0">${t('Não estou pronto')}</button>` : `<button type="button" class="botao principal" data-dg-pronto="1">✔ ${t('Estou pronto')}</button>`}
        ${s.souLider ? `<button type="button" class="botao principal dg-comecar" data-dg="comecar" ${todos ? '' : 'disabled'} title="${todos ? '' : t('Todos precisam estar prontos')}">⛰ ${t('Começar')}</button>` : `<small class="fraco">${t('O líder começa quando todos estiverem prontos.')}</small>`}
        <button type="button" class="botao" data-dg="sair">${t('Sair do grupo')}</button></div>`;
    const novo = $('#dg-nome'); if (novo) { novo.value = digitado; if (foco) novo.focus(); }
    return;
  }
  const L = s.luta, res = s.resultado;
  if (s.estado === 'fim' && res) {
    el.innerHTML = `${topo}<div class="dg-fim ${res.venceu ? 'venceu' : 'perdeu'}"><b>${res.venceu ? t('Vitória! Braum foi vencido.') : res.motivo === 'desistiu' ? t('Você desistiu da dungeon.') : t('O grupo não aguentou.')}</b>
        <small>${t('Tempo: {t}', { t: relogioDg(res.seg) })} · ${t('Chegou ao estágio {n}', { n: res.estagio + 1 })}</small></div>
      <table class="dg-tabela"><tr><th>${t('Jogador')}</th><th>${t('Dano')}</th><th>${t('Quedas')}</th><th>${t('Poções')}</th></tr>
        ${res.jogadores.map((j) => `<tr class="${j.nome === NOME ? 'eu' : ''}"><td>${esc(j.nome)} <small>${esc(dadosCampeao(j.campeao).nome)}</small></td><td>${j.parte}%</td><td>${j.mortes}</td><td>${Object.values(j.pocoes || {}).reduce((a, b) => a + b, 0)}</td></tr>`).join('')}</table>
      ${dungeonPremio && !dungeonPremio.xp && !dungeonPremio.ouro ? `<p class="fraco">${t('Sem prêmio: o grupo não passou do primeiro estágio.')}</p>` : dungeonPremio ? `<div class="dg-premio"><b>${t('Seu prêmio')}</b><span>+${inteiro(dungeonPremio.xp)} ${t('de XP')}</span><span>+${inteiro(dungeonPremio.ouro)} ${t('de ouro')}</span>
        ${Object.entries(dungeonPremio.espolios || {}).map(([id, q]) => `<span style="color:${M.ESPOLIOS[id]?.cor || '#fff'}">${q}× ${esc(t(M.ESPOLIOS[id]?.nome || id))}</span>`).join('')}
        ${dungeonPremio.item ? `<span class="dg-lendario">✨ ${esc(descreverItem(dungeonPremio.item).nome)}</span>` : ''}${dungeonPremio.mascote ? `<span class="dg-lendario">🐾 ${t('Poro de Bigode')}</span>` : ''}</div>` : `<p class="fraco">${t('Recebendo o prêmio…')}</p>`}
      <div class="dg-botoes"><button type="button" class="botao principal" data-fechar>${t('Fechar')}</button></div>`;
    return;
  }
  if (!L) { el.innerHTML = `${topo}<p class="fraco">${t('Carregando…')}</p>`; return; }
  const est = Array.from({ length: L.estagios }, (_, k) => `<span class="${k < L.estagio ? 'feito' : k === L.estagio ? 'agora' : ''}">${k + 1}</span>`).join('');
  const mons = L.monstros.map((m) => `<li class="${m.chefe ? 'chefe' : ''}${m.fur ? ' fur' : ''}${m.chegando ? ' longe' : ''}"><span class="dg-mnome">${m.fur ? '✹ ' : ''}${esc(t(m.nome))}${m.escudo ? ' 🛡' : ''}${m.furia ? ' 🔥' : ''}${m.aviso ? ` <em class="dg-aviso">⚠ ${m.aviso === 'fissura' ? t('Fissura Glacial') : t('Bola de neve')}</em>` : ''}</span>
      ${barraDg(m.hp, m.max, 'vida-m')}<small>${m.foco ? '→ ' + esc(m.foco) : ''}</small></li>`).join('') || `<li class="fraco">${L.pausa ? t('Próxima onda chegando…') : '…'}</li>`;
  const total = L.jogadores.reduce((a, j) => a + j.dano, 0) || 1;
  const jogs = L.jogadores.map((j) => `<li class="${j.morto ? 'morto' : ''}${j.nome === NOME ? ' eu' : ''}"><img src="${miniatura(spriteCampeao(j.campeao, j.skin))}" alt="">
      <div><b>${j.morto ? '☠ ' : ''}${esc(j.nome)}</b>${barraDg(j.vida, j.vidaMax, 'vida')}${j.manaMax ? barraDg(j.mana, j.manaMax, 'mana') : ''}</div><small>${Math.round(100 * j.dano / total)}%</small></li>`).join('');
  const ultimos = (dungeonLogLinhas = [...dungeonLogLinhas, ...L.log.filter((l) => !dungeonLogLinhas.some((x) => x.n === l.n))].slice(-7));
  el.innerHTML = `${topo}<div class="dg-luta-topo"><div class="dg-pips">${est}</div><b>${esc(t(L.nomeEstagio))}</b><span>${L.estagio < L.estagios - 1 ? t('Onda {n}/{m}', { n: L.onda, m: L.ondas }) : ''}</span>
      <span class="dg-tempo" title="${t('Tempo para vencer: {m} min', { m: Math.round(L.limite / 60) })}">⏱ ${relogioDg(L.seg)} / ${relogioDg(L.limite)}</span></div>
    <div class="dg-colunas"><section><h4>${t('Grupo')}</h4><ul class="dg-jog">${jogs}</ul></section>
      <section><h4>${t('Inimigos')} <small>${t('nível {n}', { n: L.nivel })}</small></h4><ul class="dg-mons">${mons}</ul></section></div>
    <ul class="dg-log">${ultimos.map((l) => { const x = textoDg(l); return x ? `<li><small>${relogioDg(l.t)}</small> ${esc(x[0])}</li>` : ''; }).join('')}</ul>
    ${s.estado === 'luta' ? `<div class="dg-botoes"><button type="button" class="botao dg-desistir" data-dg="sair">${t('Desistir')}</button></div>` : ''}`;
}
$('#janela-dungeon').addEventListener('click', async (e) => {
  const filaB = e.target.closest('[data-dg-fila]');
  if (filaB) { try { await rede.acaoDungeon('fila', { sim: filaB.dataset.dgFila === '1' }); } catch (err) { avisar(err.message); } consultarDungeon(); return; }
  const b = e.target.closest('[data-dg]'), resp = e.target.closest('[data-dg-resp]'), pr = e.target.closest('[data-dg-pronto]'), tirar = e.target.closest('[data-dg-tirar]'), amigo = e.target.closest('[data-dg-amigo]');
  if (e.target.closest('[data-fechar]') && dungeonResultado) { dungeonResultado = null; dungeonPremio = null; if (dungeonInfo?.sala?.estado === 'fim') dungeonInfo.sala = null; }
  try {
    if (b) {
      if (b.dataset.dg === 'sair' && !(await confirmar(dungeonLuta() ? t('Desistir da dungeon? Você sai da luta e recebe só a parte dos estágios já vencidos; o grupo continua.') : t('Sair do grupo da dungeon?')))) return;
      if (b.dataset.dg === 'criar') { dungeonLogLinhas = []; dungeonResultado = null; }
      await rede.acaoDungeon(b.dataset.dg);
    } else if (resp) { if (resp.dataset.sim === '1') { dungeonLogLinhas = []; dungeonResultado = null; } await rede.acaoDungeon('responder', { sala: resp.dataset.dgResp, aceitar: resp.dataset.sim === '1' }); }
    else if (pr) {
      if (pr.dataset.dgPronto === '1') {
        if (!localAtual().base) { avisar(t('Volte para a Fonte (tecla B) para ficar pronto.')); return; }
        await salvar();      // o servidor confere pelo último save que você está na Fonte
      }
      await rede.acaoDungeon('pronto', { sim: pr.dataset.dgPronto === '1' });
    } else if (tirar) await rede.acaoDungeon('expulsar', { nome: tirar.dataset.dgTirar });
    else if (amigo) { await rede.acaoDungeon('convidar', { nome: amigo.dataset.dgAmigo }); log(t('Você chamou {nome} para a dungeon.', { nome: amigo.dataset.dgAmigo }), 'npc'); }
    else return;
  } catch (err) { avisar(err.message); }
  consultarDungeon();
});
$('#janela-dungeon').addEventListener('submit', async (e) => {
  if (!e.target.closest('.dg-convidar')) return;
  e.preventDefault();
  const nome = $('#dg-nome').value.trim();
  if (!nome) return;
  try { const r = await rede.acaoDungeon('convidar', { nome }); $('#dg-nome').value = ''; log(t('Você chamou {nome} para a dungeon.', { nome: r.nome || nome }), 'npc'); }
  catch (err) { avisar(err.message); }
  consultarDungeon();
});
// fechou a janela com a luta acontecendo: o status fica no alto da tela
new MutationObserver(() => desenharStatusDungeon()).observe($('#janela-dungeon'), { attributes: true, attributeFilter: ['hidden'] });
if (!CONVIDADO) setTimeout(consultarDungeon, 5000);
// ---------- Dungeon: a luta desenhada na tela (p670) ----------
// O servidor manda os monstros, o estado do seu campeão e os eventos do motor de cada um (com o tempo da luta). O jogo toca
// tudo DG_ATRASO segundos atrás do servidor, na ordem, com o mesmo desenho do Rift: o seu campeão no meio, os aliados em volta
// (os efeitos deles saem como se fossem eles: cena.comoAliado), o mapa de Freljord e as mecânicas do Braum e dos bonecos.
var dgVendo = false, dgFila = [], dgMecs = [], dgSnaps = [], dgVd = 0, dgSrv = null, dgSaindo = null, dgD = null, dgEu = null;
const DG_LOCAL = { id: 'freljord', nome: 'Covil de Braum', bioma: 'freljord', dungeon: true, semente: 1 };
const DG_ATRASO = 0.8;
const dgAgora = () => (dgSrv ? dgSrv.t + Math.min(1, (performance.now() - dgSrv.em) / 1000) - DG_ATRASO : 0);      // até 1 s além da última resposta
function dungeonVisual(L) {
  if (!L.mons) return;
  if (!dgSrv || L.tf > dgSrv.t) dgSrv = { t: L.tf, em: performance.now() };
  dgSnaps.push({ t: L.tf, mons: L.mons, jog: L.jogadores, d: L.d }); if (dgSnaps.length > 60) dgSnaps.splice(0, dgSnaps.length - 60);
  for (const v of L.visual || []) if (v.n > dgVd) dgFila.push(v);
  if (dgFila.length > 600) dgFila.splice(0, dgFila.length - 600);
  dgVd = Math.max(dgVd, L.vseq || 0);
  if (!dgVendo && !naAram()) entrarNaDungeonVisual();
}
function entrarNaDungeonVisual() {
  dgVendo = true; clearTimeout(dgSaindo);
  fecharJanelas();
  cena.entrarLocal(DG_LOCAL);
  cena.aviso(t('Covil de Braum'), '#bfe8ff');
  log(t('O grupo chegou ao alto da montanha de Freljord.'), 'chefe');
}
function sairDaDungeonVisual() {
  if (!dgVendo) return;
  dgVendo = false; dgFila = []; dgMecs = []; dgSnaps = []; dgVd = 0; dgSrv = null; dgD = null; dgEu = null;
  entrarCena(M.LOCAL.fonte);
  $('#janela-dungeon').hidden = false; desenharDungeon();      // o resultado
}
// um evento do motor de alguém do grupo
function desenharEventoDg(v, falso) {
  const ev = v.ev;
  if (!ev) return;
  if (ev.tipo === 'abate') { cena.abateDungeon(ev.alvo); return; }
  if (ev.tipo === 'morreu') { if (v.de === NOME) { cena.morto = true; cena.aviso(t('Você caiu! Volta no próximo estágio.'), '#ff4040'); } return; }
  if (ev.tipo === 'renasceu') { if (v.de === NOME) { cena.morto = false; cena.efeito('poof', cena.darius, 0.6); } return; }
  const quem = v.de === NOME ? cena.darius : cena.outros.get(v.de);
  if (quem && ev.tipo === 'dano' && ev.alvo && (ev.fonte === 'ataque' || !quem.alvoDg)) quem.alvoDg = ev.alvo;      // o monstro que ele está atacando (corpo a corpo anda até ele)
  if (v.de === NOME) { cena.evento(ev, falso); return; }
  const o = cena.outros.get(v.de);
  if (o && !o.caido && !(cena.leve && ev.tipo === 'dano' && !ev.critico)) cena.comoAliado(o, o.campeaoId, () => cena.evento(ev, falso));
}
// a cada passo do jogo (no lugar da sincronia com o combate de verdade, que está parado na Fonte)
function dungeonSincronizar() {
  const agora = dgAgora();
  let snap = null;
  for (const s of dgSnaps) if (s.t <= agora) snap = s;
  snap ??= dgSnaps[0];
  if (!snap) return;
  dgD = snap.d || null;      // as recargas e os buffs do seu campeão na luta, para a barra de baixo (p690)
  const falso = { darius: { recall: 0, ...(snap.d || {}) }, inimigos: snap.mons.map((m) => ({ ...m, morto: false, furioso: !!(m.furioso || m.furia), chegada: m.chegada || 0 })), eventos: [] };
  cena.definirAliados(snap.jog.filter((j) => j.nome !== NOME));
  const logAntes = cena.log; cena.log = () => {};      // o registro já conta a luta (textoDg); aqui só o desenho
  try {
    while (dgFila.length && dgFila[0].t <= agora) { try { desenharEventoDg(dgFila.shift(), falso); } catch (e) { console.warn('[dungeon]', e?.message); } }
    while (dgMecs.length && (dgMecs[0].tf ?? 0) <= agora) { try { cena.dungeonMecanica(dgMecs.shift()); } catch (e) { console.warn('[dungeon]', e?.message); } }
  } finally { cena.log = logAntes; }
  const eu = snap.jog.find((j) => j.nome === NOME);
  dgEu = eu || null;      // a vida e a mana da luta, para a barra de baixo (p715)
  cena.sincronizar(falso, eu ? eu.vida / Math.max(1, eu.vidaMax) : 1, eu?.manaMax ? eu.mana / eu.manaMax : 0);
  cena.guiarDungeon(falso.inimigos);
  const b = falso.inimigos.find((m) => m.nome === 'Braum');
  if (b) cena.chefeBarra = { nome: 'Braum', vida: b.hp / b.hpMax, t: cena.tempo, larg: 300, y: 30, cor: b.furia ? '#ff6a40' : b.escudo ? '#bfe8ff' : '#58b8f0',
    titulo: `${t('Braum, o Coração de Freljord')} · ${Math.max(0, Math.ceil((100 * b.hp) / b.hpMax))}%${b.escudo ? ' · ' + t('Inquebrável') : b.furia ? ' · ' + t('furioso') : ''}` };
}
// ---------- fim da dungeon desenhada ----------

// ---------- NPCs ----------
const NPC_FALAS = {
  Soraka: {
    oi: () => {
      const a = M.atributos(estado);
      return estado.vida < a.vida * 0.99 || estado.mana < a.mana * 0.99
        ? t('Que as estrelas te guiem, {nome}. Você está ferido... posso te {curar}.', { nome: NOME })
        : t('Que as estrelas te guiem, {nome}. Você está em plena forma! Se precisar, eu posso te {curar}.', { nome: NOME });
    },
    curar: () => {
      M.curarNaFonte(estado);
      cena.efeito('cura', cena.darius, 1.2); som.efeito('cura');
      log(t('Soraka restaurou sua vida e sua mana.'), 'npc');
      return t('Pronto! Sua vida e sua mana foram restauradas. Volte sempre que precisar.');
    },
  },
  'Mestre da Legião': {
    oi: () => t('Saudações, soldado. Eu treino os guerreiros da Legião Trifariana. Quer recomeçar o treino ({redistribuir} os atributos ou esquecer as {habilidades})? Ou prefere que eu explique os {atributos}?'),
    reset: () => { abrirMercado('loja'); return t('Recomeçar o treino agora é feito com os resets da Loja, na aba Mercado. Abri ela para você.'); },
    habilidades: () => t('Esquecer as habilidades devolve todos os pontos para você aprender de novo. Comigo custa {preco} de ouro (o preço sobe com o seu nível); na Loja, {d} diamantes. Quer {pagarHab} ou prefere o {reset} da Loja?', { preco: inteiro(M.precoResetOuro(estado.nivel)), d: M.LOJA.resetHab.preco }),
    pagarHab: () => { resetarNoMestre('resetHab'); return t('Pense bem: o ouro não volta. Quer ver de novo as {habilidades} ou {redistribuir} os atributos?'); },
    atributos: () => t('Força aumenta o dano. Vitalidade, a vida. Resistência, a armadura. Agilidade dá velocidade de ataque e esquiva. Foco dá mana e reduz a recarga das habilidades. Quer {redistribuir}?'),
    redistribuir: () => t('Refazer os atributos devolve todos os pontos para você distribuir de novo. Comigo custa {preco} de ouro (o preço sobe com o seu nível); na Loja, {d} diamantes. Quer {pagarAtrib} ou prefere o {reset} da Loja?', { preco: inteiro(M.precoResetOuro(estado.nivel)), d: M.LOJA.resetAtrib.preco }),
    pagarAtrib: () => { resetarNoMestre('resetAtrib'); return t('Pense bem: o ouro não volta. Quer ver de novo as {habilidades} ou {redistribuir} os atributos?'); },
  },
  Ornn: {
    oi: () => t('Hm. Sou Ornn. Junto componentes para {montar} itens melhores, como no Rift. E minha forja deixa qualquer item mais forte, até +5. Quer {forjar}?'),
    montar: () => { montarSel = null; mostrarMontagem(); return t('Escolha o que quer montar e coloque as suas peças na bancada. Cada tentativa gasta ouro; as peças só vão embora quando dá certo.'); },
    forjar: () => {
      mostrarForja();
      return t('Coloque na bigorna o item que quer forjar. O +1 e o +2 saem fácil e nunca dão errado de verdade; da tentativa de +3 em diante, a chance cai e falhar pode fazer o item voltar um nível.');
    },
  },
  'Capitão da Legião': {
    oi: () => {
      const tar = estado.tarefa;
      if (!tar) return t('Soldado! Noxus precisa de braços fortes. Tenho uma {tarefa} para você.') + (estado.totais.tarefas ? ' ' + t('Você já cumpriu {n}.', { n: estado.totais.tarefas }) : '');
      if (M.tarefaPronta(estado)) return t('Você abateu {qtd} {monstro}! Venha {entregar} a tarefa e receber sua recompensa.', { qtd: tar.qtd, monstro: alvoTarefa(tar) });
      return t('Sua tarefa: {monstro} ({feitos}/{qtd}), em {lugar}. Volte quando terminar, ou posso {cancelar} a tarefa.', { monstro: alvoTarefa(tar), feitos: tar.feitos, qtd: tar.qtd, lugar: M.LOCAL[tar.local].nome });
    },
    tarefa: () => {
      if (estado.tarefa) return t('Termine a tarefa que já tem primeiro. Ou quer {cancelar}?');
      mostrarTarefas();
      return t('Escolha uma. A recompensa é paga aqui mesmo, quando você voltar.');
    },
    entregar: () => {
      const r = M.entregarTarefa(estado, combate);
      if (!r) return t('Você ainda não terminou. Volte quando tiver abatido todos.');
      if (r.mochilaCheia) return t('Sua mochila está cheia! Abra espaço para eu te dar o item e venha {entregar} de novo.');
      // o item vai para a mochila como "~?": a qualidade quem sorteia é o servidor, no próximo save
      const item = r.item ? descreverItem(M.comItem(r.item, 0, '?')) : null;
      if (item) item.nome += ' ' + t('(a qualidade sai em instantes)');
      log(t('Tarefa entregue: +{ouro} de ouro, +{xp} de experiência', { ouro: fmt(r.ouro), xp: fmt(r.xp) }) + (item ? `, ${item.nome}` : '') + '.', 'raro');
      if (item) cena.efeito('brilho', cena.darius, 1.6, item.cor);
      $('#npc-troca').innerHTML = '';
      return item ? t('Excelente trabalho! Aqui está: {ouro} de ouro e {item}. Quer outra {tarefa}?', { ouro: fmt(r.ouro), item: item.nome })
        : t('Excelente trabalho! Aqui está: {ouro} de ouro. Quer outra {tarefa}?', { ouro: fmt(r.ouro) });
    },
    cancelar: () => estado.tarefa ? t('Cancelar perde todo o progresso ({feitos}/{qtd}). Tem certeza? {sim}', { feitos: estado.tarefa.feitos, qtd: estado.tarefa.qtd }) : t('Você não tem tarefa.'),
    sim: () => { M.cancelarTarefa(estado); log(t('Tarefa cancelada.'), 'morte'); return t('Tudo bem. Quando quiser outra {tarefa}, é só falar.'); },
    diaria: () => falaDiaria(),
  },
  'Tesoureira de Piltover': {
    oi: () => t('Olá! Este é o Cofre de Piltover. Aqui seus itens e seu ouro ficam guardados fora da mochila, com toda a segurança. Quer abrir o seu {cofre}?'),
    cofre: () => { mostrarCofre(); return t('Do lado esquerdo, a sua mochila; do direito, o cofre. Clique para guardar ou retirar. O ouro também pode ficar comigo.'); },
  },
  'Burrinho de Carga': {
    oi: () => t('Iá-óóó! (O burrinho da Tesoureira carrega o cofre de Piltover nas costas. Quer abrir o seu {cofre}?)'),
    cofre: () => { mostrarCofre(); return t('Iá-óóó! (Ele mexe as orelhas enquanto você mexe na carga: a mochila fica à esquerda, o cofre à direita.)'); },
  },
  Lojista: {
    oi: () => t('Bem-vindo! Quer {comprar} poções de vida e de mana, ou {vender} os itens que trouxe da caçada?'),
    comprar: () => { mostrarTroca('comprar'); return t('Dê uma olhada nas minhas poções. Qual vai querer? Se quiser, também posso te ajudar a {vender} itens.'); },
    vender: () => { abrirVenda(); $('#npc-troca').innerHTML = `<div class="botoes"><button class="botao principal" data-abrir-venda>💰 ${t('Abrir a janela de venda')}</button></div>`; return t('Mostre o que trouxe! Compro os espólios dos monstros (peles, escamas, cristais…) e pago metade do valor de cada item. Se precisar, também dá para {comprar} poções.'); },
  },
};
let npcAtual = null;
function falarCom(nome) {
  const A = combate.arena;
  if (localAtual().arena && A?.mundo) {
    const c = A.cidade && R.CIDADE[A.cidade];
    if (!c) { log(t('Em Runeterra, a Soraka, o Lojista, o Burrinho de Carga e o Mercador atendem nas cidades. Os outros NPCs ficam na Fonte.'), 'morte'); return; }
    const npc = cena.mapa.npcs.find((n) => n.nome === nome && n.cidade === c.id);
    if (!npc) { log(t('Em {cidade} atendem a Soraka, o Lojista, o Burrinho de Carga e o Mercador. {npc} fica na Fonte.', { cidade: c.nome, npc: t(nome) }), 'morte'); return; }
    const alvo = { x: npc.x + 0.5, y: npc.y + 1.6 };
    if (Math.hypot(A.x - alvo.x, A.y - alvo.y) < 0.9) abrirConversa(nome);
    else { Arena.mandarAndar(combate, alvo.x, alvo.y); npcPendente = { nome, ...alvo }; }
    return;
  }
  if (!M.naBase(estado)) { log(t('Os NPCs ficam na Fonte. Volte para a base primeiro.'), 'morte'); return; }
  const npc = cena.npcs.find((n) => n.nome === nome);
  if (npc) cena.irAte(npc, () => abrirConversa(nome));
}
// o que cada NPC faz (aparece embaixo do nome) e o texto dos botões de resposta
const PAPEL_NPC = { Mercador: t('Mercado dos jogadores'), 'Burrinho de Carga': t('Carrega o cofre da Tesoureira'), 'Tesoureira de Piltover': t('Guarda itens e ouro'), Soraka: t('Curandeira'), Lojista: t('Compra e vende'), Ornn: t('Ferreiro: monta e forja itens'), 'Capitão da Legião': t('Tarefas de caça'), 'Mestre da Legião': t('Treino de atributos') };
// missões diárias (Summoner's Rift e Runeterra): o Capitão fala delas em toda conversa
const TIPOS_DIARIA = ['rift', 'runeterra'];
const nomeDiaria = (k) => (k === 'rift' ? t("Summoner's Rift") : t('Runeterra'));
const oiCapitao = NPC_FALAS['Capitão da Legião'].oi;
NPC_FALAS['Capitão da Legião'].oi = () => {
  const ativas = TIPOS_DIARIA.filter((k) => estado[M.DIARIAS[k].campo]);
  const extra = ativas.some((k) => M.diariaPronta(estado, k)) ? t('Uma das suas {diaria} está completa!')
    : ativas.length ? t('Suas {diaria}: {lista}.', { lista: ativas.map((k) => `${nomeDiaria(k)} ${inteiro(estado[M.DIARIAS[k].campo].feitos)}/${inteiro(M.DIARIAS[k].regra.qtd)}`).join(', ') })
    : TIPOS_DIARIA.some((k) => M.podeAceitarDiaria(estado, Date.now(), k)) ? t("E todo dia tenho {diaria}: uma no Summoner's Rift e uma em Runeterra.") : '';
  return oiCapitao() + (extra ? ' ' + extra : '');
};
function falaDiaria() {
  const prontas = TIPOS_DIARIA.filter((k) => M.diariaPronta(estado, k));
  if (prontas.length) { receberDiarias(prontas); return t('Muito bem, soldado! Aqui está o seu prêmio.'); }
  mostrarDiaria();
  return t("Todo dia tenho duas: abater {qtd} monstros caçando no Summoner's Rift, e {qtd} em Runeterra caçando você mesmo (essa paga mais). Contam os do seu nível ou até 5 níveis abaixo.", { qtd: inteiro(M.DIARIA.qtd) });
}
function mostrarDiaria() {
  const linha = (k) => {
    const D = M.DIARIAS[k], r = M.recompensaDiaria(estado.nivel, k), d = estado[D.campo];
    const lend = (r.lendario * 100).toLocaleString(ingles ? 'en-US' : 'pt-BR', { maximumFractionDigits: 1 }) + '%';
    const acao = d ? `<small class="diaria-andando">${inteiro(d.feitos)}/${inteiro(D.regra.qtd)}</small>`
      : M.podeAceitarDiaria(estado, Date.now(), k) ? `<button type="button" class="botao" data-aceitar-diaria="${k}">${t('Aceitar')}</button>`
      : `<small class="diaria-feita">${t('Feita hoje ✓')}</small>`;
    return `<div class="troca-linha tarefa-diaria diaria-${k}">
      <img src="${miniatura(M.zonaIdeal(estado.nivel).monstros[0][0])}" alt="">
      <div class="info"><b>${k === 'rift' ? t("{qtd} monstros no Summoner's Rift", { qtd: inteiro(D.regra.qtd) }) : t('{qtd} monstros em Runeterra', { qtd: inteiro(D.regra.qtd) })} <span class="selo-tarefa">${k === 'rift' ? t('Diária') : t('Diária manual')}</span></b>
        <small>${t('{xp} de XP · {ouro} de ouro · épico garantido ({pct} de ser lendário)', { xp: fmt(r.xp), ouro: fmt(r.ouro), pct: lend })}</small></div>${acao}</div>`;
  };
  $('#npc-troca').innerHTML = `<div class="troca-lista">${TIPOS_DIARIA.map(linha).join('')}</div>
    <p class="nota">${t('Uma de cada por dia. A do Rift conta caçando no automático; a de Runeterra, caçando você mesmo, e paga mais. O progresso aparece no quadro de missões e o prêmio sai em qualquer lugar.')}</p>`;
}
let recebendoDiaria = false;
async function receberDiaria(tipo) {
  if (recebendoDiaria || !M.diariaPronta(estado, tipo)) return;
  recebendoDiaria = true;
  try {
    const r = await operarServidor('/api/diaria', { tipo }), b = r?.diaria;
    if (!b) return;
    const item = descreverItem(b.item);
    som.efeito('fanfarra'); cena.efeito('brilho', cena.darius, 1.6, item.cor);
    const txt = t('Missão diária ({lugar}) cumprida: +{xp} de experiência, +{ouro} de ouro e {item}.', { lugar: nomeDiaria(tipo), xp: fmt(b.xp), ouro: fmt(b.ouro), item: item.nome });
    log(txt, 'raro');
    avisar(txt + '\n\n' + t('Amanhã tem outra com o Capitão da Legião.'), { titulo: t('Missão diária') });
    $('#npc-troca').innerHTML = '';
    atualizarUI();
  } finally { recebendoDiaria = false; }
}
async function receberDiarias(lista) { for (const k of lista) await receberDiaria(k); }
const OPCAO = {
  curar: t('Me cure'), montar: t('Montar itens'), forjar: t('Forjar um item'), tarefa: t('Quero uma tarefa'), entregar: t('Entregar a tarefa'),
  cancelar: t('Cancelar a tarefa'), sim: t('Sim, cancelar'), comprar: t('Comprar poções'), vender: t('Vender'), reset: t('Abrir a Loja'),
  habilidades: t('Esquecer habilidades'), atributos: t('O que faz cada atributo?'), redistribuir: t('Refazer atributos'), tchau: t('Tchau'),
  cofre: t('Abrir o cofre'), diaria: t('Missões diárias'), pagarHab: t('Pagar com ouro'), pagarAtrib: t('Pagar com ouro'),
};
const PRINCIPAL = new Set(['curar', 'forjar', 'montar', 'tarefa', 'entregar', 'comprar', 'vender', 'cofre', 'diaria', 'pagarHab', 'pagarAtrib']);
// como cada palavra-chave {palavra} aparece escrita na fala (em português é a própria palavra)
const PALAVRA_NPC = {
  curar: t('curar'), redistribuir: t('redistribuir'), habilidades: t('habilidades'), atributos: t('atributos'), reset: t('reset'),
  montar: t('montar'), forjar: t('forjar'), tarefa: t('tarefa'), entregar: t('entregar'), cancelar: t('cancelar'), sim: t('sim'),
  comprar: t('comprar'), vender: t('vender'), cofre: t('cofre'), diaria: t('missões diárias'), pagarHab: t('pagar com ouro'), pagarAtrib: t('pagar com ouro'),
};
function abrirConversa(nome) {
  if (nome === 'Mercador') { abrirMercadoJogadores('comprar'); return; }      // o Mercador abre o mercado dos jogadores direto
  npcAtual = nome;
  $('#npc-nome').textContent = t('Conversa');
  $('#npc-titulo').textContent = t(nome);
  $('#npc-papel').textContent = PAPEL_NPC[nome] || '';
  $('#npc-retrato').src = miniatura(nome);
  forjaSel = null; montarSel = null;
  $('#npc-conversa').innerHTML = '';
  $('#npc-troca').innerHTML = '';
  $('#janela-npc').hidden = false;
  dizer('oi');
}
function dizer(palavra) {
  const conv = $('#npc-conversa');
  const falar = (classe, texto, marcado) => {
    const p = document.createElement('p'); p.className = classe;
    if (marcado) p.innerHTML = texto.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]).replace(/\{(\w+)\}/g, (_, w) => `<b>${PALAVRA_NPC[w] || w}</b>`);
    else p.textContent = texto;
    conv.append(p);
  };
  if (palavra !== 'oi') falar('eu', OPCAO[palavra] || palavra);
  if (palavra === 'tchau') {
    falar('ele', t('Até logo, {nome}!', { nome: NOME }));
    $('#npc-palavras').innerHTML = '';
    setTimeout(() => ($('#janela-npc').hidden = true), 600);
    return;
  }
  const resposta = NPC_FALAS[npcAtual][palavra]?.() ?? t('Hm? Não entendi.');
  falar('ele', resposta, true);
  conv.scrollTop = conv.scrollHeight;
  // as respostas possíveis viram botões (as palavras-chave da fala, como no Tibia)
  const palavras = [...new Set([...[...resposta.matchAll(/\{(\w+)\}/g)].map((m) => m[1]), 'tchau'])];
  $('#npc-palavras').innerHTML = palavras.map((w) => `<button class="opcao${PRINCIPAL.has(w) ? ' principal' : ''}${w === 'tchau' ? ' sair' : ''}" data-palavra="${w}">${OPCAO[w] || w}</button>`).join('');
  atualizarUI();
}
$('#npc-palavras').addEventListener('click', (e) => { const b = e.target.closest('[data-palavra]'); if (b) dizer(b.dataset.palavra); });
$('#npcs').addEventListener('click', (e) => { const b = e.target.closest('[data-npc]'); if (b) falarCom(b.dataset.npc); });

// abas da coluna direita (lembra a última aberta)
function abrirAba(nome) {
  document.querySelectorAll('.abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === nome));
  document.querySelectorAll('.aba-conteudo').forEach((p) => (p.hidden = p.dataset.painel !== nome));
  try { localStorage.setItem('lol-idle-aba', nome); } catch {}
  if (nome === 'mercado' && typeof carregarMercado === 'function') { desenharMercado(); carregarMercado(); }
}
$('.abas').addEventListener('click', (e) => { const b = e.target.closest('[data-aba]'); if (b) { abrirAba(b.dataset.aba); dicaDeToque(b.dataset.aba); } });
try { abrirAba(localStorage.getItem('lol-idle-aba') || 'habilidades'); } catch { abrirAba('habilidades'); }

// ---------- Ornn: montar itens (receitas do LoL) ----------
let filtroMontar = 'epico';
// porcentagem com 2 algarismos significativos: 3% · 0,4% · 0,05% · 0,00050%
const pctFino = (x) => { const v = x * 100; return (v >= 10 ? v.toFixed(0) : v > 0 && v < 1e-3 ? Number(v.toPrecision(2)).toFixed(1 - Math.floor(Math.log10(v))) : v.toPrecision(2)).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1').replace('.', ingles ? '.' : ',') + '%'; };
const BOTOES_VEZES = [1, 10, 100, 1000];
// barra da persistência do Ornn: quantas falhas já contam e em quantas tentativas, no máximo, dá certo.
// base: a chance sem as falhas; agora: com as falhas (as duas sem a runa). O bônus multiplica a chance (não soma pontos),
// por isso mostra a conta: "+38% da chance pelas falhas: 1,2% → 1,7%" (um jogador achou que eram 38 pontos a mais)
// faixa (só na forja): { r: raridade do item, n: nível que se tenta alcançar }; as falhas contam só para essa faixa
const FAIXA_PLURAL = { basico: 'básicos', epico: 'épicos', lendario: 'lendários' };
function barraPersistencia(regra, falhas, base, agora, faixa = null) {
  if (!regra) return '';
  const notaFaixa = faixa ? `<small class="fraco">${t('Conta só para itens {r} indo para +{n}.', { r: t(FAIXA_PLURAL[faixa.r] || FAIXA_PLURAL.basico), n: faixa.n })}</small>` : '';
  const bonus = M.bonusFalhas(falhas), conta = base != null && agora != null ? { de: pctFino(base), para: pctFino(agora) } : null;
  const txtBonus = !conta ? t('+{p} de chance pelas falhas', { p: Math.round(bonus * 100) + '%' })
    : regra.subir && falhas >= regra.subir ? t('pelas falhas: {de} → {para}', conta) : t('+{p} da chance pelas falhas: {de} → {para}', { p: Math.round(bonus * 100) + '%', ...conta });
  const subiu = bonus > 0 ? `<b class="persistencia-bonus">${txtBonus}</b>` : '';
  if (!regra.max) {          // +1 e +2: só a subidinha por falha (sem garantia, porque saem fácil)
    return `<dt title="${t('Cada falha aumenta a chance em 1% dela mesma, até +{p} (com 12% de chance, 50 falhas levam a 18%).', { p: Math.round(M.PERSISTENCIA_TETO * 100) + '%' })}">${t('Persistência')}</dt>
    <dd class="persistencia"><small class="fraco">${falhas ? t('{f} falhas', { f: fmt(falhas) }) + ' · ' : ''}</small>${subiu || `<small class="fraco">${t('cada falha deixa a próxima um pouquinho mais fácil')}</small>`}${notaFaixa}</dd>`;
  }
  const pct = Math.min(100, (falhas / regra.max) * 100), falta = Math.max(1, regra.max - falhas);
  return `<dt title="${t('Cada falha aumenta a chance em 1% dela mesma (até +50%: 2% vira 3%). Depois de muitas falhas a chance sobe rápido, até ficar garantida.')}">${t('Persistência')}</dt>
    <dd class="persistencia"><span class="persistencia-barra${falhas >= regra.subir ? ' subindo' : ''}"><i style="width:${pct.toFixed(1)}%"></i></span>
    <small class="fraco">${falhas ? t('{f} falhas · garantido em no máximo {n} tentativas', { f: fmt(falhas), n: fmt(falta) }) : t('garantido em no máximo {n} tentativas', { n: fmt(falta) })}</small>${subiu}${notaFaixa}</dd>`;
}
// Cofre da Tesoureira de Piltover: a mochila de um lado, o cofre do outro, e o ouro guardado em cima
// o cofre e a mochila como grade de ícones: itens iguais juntos (×N), lendários primeiro, depois épicos e básicos
let filtroCofre = 'todos';
const ORDEM_RARIDADE = { lendario: 0, epico: 1, basico: 2 };
function mostrarCofre() {
  const c = estado.cofre || { itens: [], ouro: 0 }, ouro = Math.floor(estado.ouro), livres = M.mochilaDe(estado.nivel) - estado.mochila.length, cap = M.espacosCofre(estado), vagas = cap - c.itens.length;
  const grade = (ids, acao, vazio) => {
    if (!ids.length) return `<p class="fraco cofre-vazio">${vazio}</p>`;
    const grupos = new Map();
    ids.forEach((id, k) => { const g = grupos.get(id); if (g) g.n++; else grupos.set(id, { id, k, n: 1, d: descreverItem(id) }); });
    const lista = [...grupos.values()].filter((g) => filtroCofre === 'todos' || g.d.raridade === filtroCofre)
      .sort((a, b) => (ORDEM_RARIDADE[a.d.raridade] ?? 3) - (ORDEM_RARIDADE[b.d.raridade] ?? 3) || M.baseId(a.id).localeCompare(M.baseId(b.id)) || M.refinoDe(b.id) - M.refinoDe(a.id));
    if (!lista.length) return `<p class="fraco cofre-vazio">${t('Nada desse tipo aqui.')}</p>`;
    const dica = acao === 'guardar' ? t('Clique para guardar no cofre') : t('Clique para levar para a mochila');
    return `<div class="cofre-grade">${lista.map((g) => `<button type="button" class="cofre-slot r-${g.d.raridade}" data-cofre="${acao}" data-k="${g.k}" data-nome="${esc(g.d.nome)}${g.n > 1 ? ' ×' + g.n : ''}" data-cor="${g.d.cor}" title="${esc(textoItem(g.id))}&#10;&#10;${dica}"><img src="${imgItem(g.id)}" alt="${esc(g.d.nome)}">${rotuloRef(g.id)}${g.n > 1 ? `<i class="qtd">×${g.n}</i>` : ''}</button>`).join('')}</div>`;
  };
  const conta = (lista, r) => lista.filter((id) => r === 'todos' || descreverItem(id).raridade === r).length;
  const todos = [...estado.mochila, ...c.itens];
  const filtros = [['todos', t('Todos')], ['lendario', t('Lendários')], ['epico', t('Épicos')], ['basico', t('Básicos')]]
    .map(([r, nome]) => `<button type="button" class="cofre-filtro r-${r}${filtroCofre === r ? ' ativo' : ''}" data-filtro-cofre="${r}">${nome} <small>${conta(todos, r)}</small></button>`).join('');
  const ocupacao = (n, max) => `<div class="cofre-ocupa" title="${n}/${max}"><i style="width:${Math.min(100, (100 * n) / max)}%"></i></div>`;
  $('#npc-troca').innerHTML = `<div class="cofre">
    <div class="cofre-ouro">
      <div class="cofre-saldo"><small>${t('Com você')}</small><b class="ouro">${fmt(ouro)}</b></div>
      <div class="cofre-ouro-meio">
        <input id="cofre-valor" type="number" min="1" step="1" inputmode="numeric" placeholder="${t('quantia de ouro')}">
        <div class="cofre-ouro-botoes">
          <button class="botao cofre-ir" data-cofre="depositar" ${ouro ? '' : 'disabled'}>${t('Guardar')} →</button>
          <button class="botao cofre-vir" data-cofre="sacar" ${c.ouro ? '' : 'disabled'}>← ${t('Retirar')}</button>
        </div>
        <div class="cofre-ouro-botoes">
          <button class="botao pequeno" data-cofre="depositar" data-tudo="1" ${ouro ? '' : 'disabled'}>${t('Guardar todo o ouro')}</button>
          <button class="botao pequeno" data-cofre="sacar" data-tudo="1" ${c.ouro ? '' : 'disabled'}>${t('Retirar todo o ouro')}</button>
        </div>
      </div>
      <div class="cofre-saldo"><small>${t('No cofre')}</small><b class="ouro">${fmt(c.ouro)}</b></div>
    </div>
    <div class="cofre-filtros" role="group" aria-label="${t('Mostrar')}">${filtros}</div>
    <div class="cofre-colunas">
      <div class="cofre-lado">
        <div class="cofre-topo"><h4>🎒 ${t('Mochila')} <small class="fraco">${estado.mochila.length}/${M.mochilaDe(estado.nivel)}</small></h4>
          <button class="botao principal cofre-ir" data-cofre="guardarTudo" ${estado.mochila.length && vagas > 0 ? '' : 'disabled'}>${t('Guardar tudo')} →</button></div>
        ${ocupacao(estado.mochila.length, M.mochilaDe(estado.nivel))}
        <div class="cofre-lista">${grade(estado.mochila, 'guardar', t('A mochila está vazia.'))}</div>
        <p class="cofre-info">${t('Clique num item para guardar no cofre.')}</p>
      </div>
      <div class="cofre-lado">
        <div class="cofre-topo"><h4>🗝 ${t('Cofre')} <small class="fraco">${c.itens.length}/${cap}</small></h4>
          <button class="botao principal cofre-vir" data-cofre="retirarTudo" ${c.itens.length && livres > 0 ? '' : 'disabled'}>← ${t('Retirar tudo')}</button></div>
        ${ocupacao(c.itens.length, cap)}
        <div class="cofre-lista">${grade(c.itens, 'retirar', t('O cofre está vazio.'))}</div>
        <p class="cofre-info">${t('Clique num item para levar para a mochila.')}</p>
        ${ampliacaoCofre(c, cap)}
      </div>
    </div></div>`;
}
// comprar mais espaços no cofre: com ouro (+20) e com diamantes (+10); some quando já comprou tudo
function ampliacaoCofre(c, cap) {
  if (cap >= M.COFRE_MAX) return `<p class="cofre-ampliar fraco">${t('Cofre no tamanho máximo ({n} espaços).', { n: cap })}</p>`;
  const precoOuro = M.precoCofreOuro(estado), D = M.COFRE.diamantes, restaD = D.vezes - (c.compDia || 0);
  const bOuro = precoOuro != null ? `<button type="button" class="botao pequeno cofre-mais ouro" data-cofre="ampliarOuro" ${estado.ouro >= precoOuro ? '' : 'disabled'} title="${esc(t('Ampliação {k} de {n} com ouro', { k: (c.compOuro || 0) + 1, n: M.COFRE.ouro.precos.length }))}">+${M.COFRE.ouro.espacos} · <b class="ouro">${inteiro(precoOuro)}</b></button>` : '';
  const bDia = restaD > 0 ? `<button type="button" class="botao pequeno cofre-mais dia" data-cofre="ampliarDiamante" ${sessao.convidado ? 'disabled' : ''} title="${esc(t('Ainda dá para comprar {n} vezes com diamantes', { n: restaD }))}">+${D.espacos} · ${D.preco} 💎</button>` : '';
  return `<div class="cofre-ampliar"><span>${t('Mais espaços')}</span>${bOuro}${bDia}</div>`;
}
// passar o mouse num item do cofre mostra o nome embaixo da grade (na cor da raridade)
$('#npc-troca').addEventListener('mouseover', (e) => {
  const s = e.target.closest('.cofre-slot'); if (!s) return;
  const info = s.closest('.cofre-lado')?.querySelector('.cofre-info'); if (!info) return;
  info.textContent = s.dataset.nome; info.style.color = s.dataset.cor;
});
// Bancada do Ornn: o jogador escolhe a receita e arrasta as próprias peças para os espaços dela
let montarSel = null;             // { id, slots: [{ c: componente, pos: { onde, k, id } | null }] }
function escolherReceita(id) {
  montarSel = { id, slots: M.ITENS[id].de.map((c) => ({ c, pos: null })) };
  mostrarMontagem();
}
// confere se cada peça ainda está onde estava (se mudou de lugar, acha pelo id; se sumiu, o espaço esvazia)
function conferirBancada() {
  if (!montarSel) return;
  const usados = new Set();
  for (const sl of montarSel.slots) {
    if (!sl.pos) continue;
    let { onde, k, id } = sl.pos;
    if (estado[onde][k] !== id || usados.has(onde + k)) k = estado[onde].findIndex((x, j) => x === id && !usados.has(onde + j));
    if (k < 0) sl.pos = null; else { sl.pos.k = k; usados.add(onde + k); }
  }
}
function porNoSlot(ref, qual) {
  if (!montarSel) return;
  const [onde, k] = String(ref).split(':'), id = estado[onde]?.[+k];
  if (!id) return;
  if (montarSel.slots.some((sl) => sl.pos && sl.pos.onde === onde && sl.pos.k === +k)) return;
  const b = M.baseId(id);
  const sl = qual != null && montarSel.slots[qual]?.c === b ? montarSel.slots[qual]
    : montarSel.slots.find((x) => !x.pos && x.c === b) || montarSel.slots.find((x) => x.c === b);
  if (!sl) { cena.texto(cena.darius, t('Essa peça não entra nessa receita'), '#c8c0b0', 0.8); log(t('{peca} não faz parte de {item}.', { peca: M.ITENS[b].nome, item: M.ITENS[montarSel.id].nome }), 'morte'); return; }
  sl.pos = { onde, k: +k, id };
  mostrarMontagem();
}
function mostrarBancada() {
  conferirBancada();
  if (!M.podeUsarGema(estado, gemaMontar, 'montar')) gemaMontar = null;
  const id = montarSel.id, d = descreverItem(id), rec = M.receitaDe(id), semGema = M.chanceMontarAgora(estado, id), ch = Math.min(1, semGema * (M.GEMAS[gemaMontar]?.mult || 1));
  const naBancada = new Set(montarSel.slots.filter((sl) => sl.pos).map((sl) => sl.pos.onde + sl.pos.k));
  const precisa = new Set(montarSel.slots.map((sl) => sl.c));
  const slots = montarSel.slots.map((sl, q) => sl.pos
    ? `<div class="montar-slot cheio" data-slot="${q}"><span class="forja-pegar"><img src="${imgItem(sl.pos.id)}" alt="">${rotuloRef(sl.pos.id)}</span><button class="forja-tirar" data-tirar-slot="${q}" title="${t('Tirar da bancada')}">×</button></div>`
    : `<div class="montar-slot" data-slot="${q}" title="${M.ITENS[sl.c].nome}"><img class="fantasma" src="${imgItem(sl.c)}" alt=""><small>${M.ITENS[sl.c].nome}</small></div>`).join('<span class="mais">+</span>');
  const cheia = montarSel.slots.every((sl) => sl.pos);
  const refinados = montarSel.slots.filter((sl) => sl.pos && M.refinoDe(sl.pos.id) > 0);
  const icone = (onde, x, k) => {
    const serve = precisa.has(M.baseId(x)), usado = naBancada.has(onde + k);
    return `<span class="forja-pegar${usado ? ' na-bigorna' : !serve ? ' nao-serve' : ''}" draggable="${serve && !usado ? 'true' : 'false'}" data-pegar="${onde}:${k}" title="${textoItem(x).replace(/"/g, '&quot;')}${serve ? '\n\n' + t('Arraste até a bancada ou dê dois cliques') : ''}"><img src="${imgItem(x)}" alt="">${rotuloRef(x)}</span>`;
  };
  const grupo = (titulo, onde) => estado[onde].length ? `<div class="forja-grupo"><small>${titulo}</small><div class="forja-itens">${estado[onde].map((x, k) => icone(onde, x, k)).join('')}</div></div>` : '';
  const semOuro = estado.ouro < rec.custo;
  $('#npc-troca').innerHTML = `
    <div class="forja">
      <button class="mi-voltar" data-receitas>← ${t('Receitas')}</button>
      <div class="montar-bancada" data-bancada-montar>
        <div class="montar-alvo"><span class="icone-item"><img src="${imgItem(id)}" alt="" title="${textoItem(id).replace(/"/g, '&quot;')}"></span><b class="cor-${d.raridade}">${d.nome}</b></div>
        <div class="montar-slots">${slots}</div>
        <dl class="montar-info">
          <dt>${t('Chance')}</dt><dd class="chance">${pctFino(ch)}${M.GEMAS[gemaMontar]?.mult ? ` <small class="sem-gema">${t('({pct} sem a runa)', { pct: pctFino(semGema) })}</small>` : ''} <small class="fraco">${t('(em média {n} tentativas)', { n: fmt(Math.round(1 / ch)) })}</small></dd>
          <dt>${t('Custo')}</dt><dd${semOuro ? ' class="caro"' : ''}>${t('<b class="ouro">{custo}</b> ouro por tentativa', { custo: fmt(rec.custo) })}</dd>
          <dt>${t('Se falhar')}</dt><dd>${t('as peças continuam com você')}</dd>
          ${linhaQualidadeMontar()}
          ${barraPersistencia(M.PERSISTENCIA.montar[d.raridade], M.falhasMontar(estado, id), M.chanceMontar(estado, id), semGema)}
        </dl>
        ${escolhaGema('montar', gemaMontar)}
        ${refinados.length ? `<p class="risco">⚠ ${t('{pecas} perde o refino ao virar {item}.', { pecas: refinados.map((sl) => descreverItem(sl.pos.id).nome).join(', '), item: d.nome })}</p>` : ''}
        ${semOuro ? avisoSemOuro(rec.custo) : ''}
        <div class="botoes vezes">${BOTOES_VEZES.map((n) => `<button class="botao${n === 1 ? ' principal' : ''}" data-montar="${id}" data-vezes="${n}" ${cheia && !semOuro ? '' : `disabled title="${semOuro ? t('Ouro insuficiente') : t('Coloque as peças na bancada')}"`}>${n === 1 ? (semOuro ? t('Ouro insuficiente') : t('Montar')) : '×' + n}</button>`).join('')}</div>
        <small class="fraco">${cheia ? t('×10, ×100 e ×1000 param no primeiro sucesso.') : t('Arraste as suas peças até os espaços da receita, ou dê dois cliques nelas.')}</small>
      </div>
      <p class="fraco forja-ouro">${t('Seu ouro: <b class="ouro">{ouro}</b>', { ouro: fmt(estado.ouro) })}</p>
      ${grupo(t('Equipados'), 'itens')}${grupo(t('Mochila'), 'mochila')}
    </div>`;
}
// a qualidade do item montado: sorteada quando fica pronto, com a chance de cada uma pelas peças que estão na bancada
function linhaQualidadeMontar() {
  // espaço vazio conta como peça B (comum), para não prometer a chance de quem ainda não pôs as outras peças
  const pecas = montarSel.slots.filter((sl) => sl.pos).map((sl) => sl.pos.id), bonus = M.bonusMontagem(montarSel.slots.map((sl) => (sl.pos ? sl.pos.id : '1~B')));
  const ch = M.chancesQualidade(bonus), comum = M.chancesQualidade(0), duasSS = M.chancesQualidade(M.bonusMontagem(['1~SS', '1~SS']));
  const lista = (c) => M.ORDEM_QUAL.map((q) => `${q} ${pctFino(c[q])}`).join(' · ');
  const dica = [t('A qualidade é sorteada quando o item fica pronto, como a de um item que cai: não é a média das peças e não tem mínimo.'),
    t('Peças A, S ou SS aumentam a chance de A, S e SS. Peças C ou B não pioram.'), '',
    t('Com peças C ou B: {chances}', { chances: lista(comum) }), t('Com duas peças SS: {chances}', { chances: lista(duasSS) })].join('\n');
  return `<dt>${t('Qualidade')}</dt><dd class="montar-qual" title="${esc(dica)}">
    <span class="mq-chances">${M.ORDEM_QUAL.map((q) => `<span class="mq" style="--c:${M.QUALIDADES[q].cor}"><b>${q}</b>${pctFino(ch[q])}</span>`).join('')}</span>
    <small class="fraco">${pecas.length && bonus > 0 ? t('Sorteada quando o item fica pronto. As suas peças aumentam a chance de A, S e SS (com peças comuns: A {a}, S {s}).', { a: pctFino(comum.A), s: pctFino(comum.S) })
      : t('Sorteada quando o item fica pronto, como a de um item que cai. Peças A, S ou SS aumentam a chance de A, S e SS; C ou B não pioram.')}</small></dd>`;
}
// faixa do Ornn quando não dá para pagar uma tentativa: quanto falta e onde conseguir
const avisoSemOuro = (custo) => `<p class="sem-ouro">💰 ${t('Faltam <b>{falta}</b> de ouro para uma tentativa (você tem {tem}).', { falta: fmt(custo - estado.ouro), tem: fmt(estado.ouro) })}<small>${t('Venda o saque no Lojista ou retire ouro do cofre da Tesoureira.')}</small></p>`;
function mostrarMontagem() {
  if (montarSel) { mostrarBancada(); return; }
  const todos = Object.values(M.ITENS).filter((i) => i.de?.length).map((i) => ({ i, a: M.analisarMontagem(estado, i.id) }));
  const ordem = { lendario: 0, epico: 1, basico: 2 };
  const lista = todos.filter((x) => M.raridade(x.i) === filtroMontar);
  lista.sort((x, y) => x.a.faltam.length - y.a.faltam.length || ordem[M.raridade(x.i)] - ordem[M.raridade(y.i)] || y.i.preco - x.i.preco);
  const tem = new Map();
  for (const u of [...estado.mochila, ...estado.itens]) tem.set(M.baseId(u), (tem.get(M.baseId(u)) || 0) + 1);
  const linha = ({ i, a }) => {
    const d = descreverItem(i.id), usados = new Map();
    const comps = a.de.map((c) => {
      const ok = (usados.get(c) || 0) < (tem.get(c) || 0); usados.set(c, (usados.get(c) || 0) + 1);
      return `<img class="comp${ok ? '' : ' falta'}" src="${imgItem(c)}" alt="" title="${M.ITENS[c].nome}\n${ok ? t('Você tem') : t('Falta: veja no mapa onde cai')}\n\n${textoItem(c)}">`;
    }).join('<span class="mais">+</span>');
    return `<div class="troca-linha montagem${a.faltam.length ? '' : ' pronta'}">
      <span class="icone-item"><img src="${imgItem(i.id)}" alt="" title="${textoItem(i.id).replace(/"/g, '&quot;')}"></span>
      <div class="info"><b class="cor-${d.raridade}">${d.nome}</b> <span class="chance-montar" title="${t('Chance de dar certo em cada tentativa')}\n${t('Cada tentativa gasta o ouro da receita. As peças só são usadas quando dá certo.')}\n${t('Em média: {n} tentativas.', { n: fmt(Math.round(1 / M.chanceMontar(estado, i.id))) })}">${pctFino(M.chanceMontar(estado, i.id))}</span><div class="receita">${comps}<span class="mais">+</span><span class="ouro">${a.custo}</span></div></div>
      <div class="botoes"><button class="botao${a.faltam.length ? '' : ' principal'}" data-receita="${i.id}">${a.faltam.length ? t('Ver') : t('Escolher')}</button></div></div>`;
  };
  const abas = [['epico', t('Intermediários')], ['lendario', t('Lendários')]];
  $('#npc-troca').innerHTML = `<div class="botoes filtro-montar">${abas.map(([k, n]) => `<button class="botao${filtroMontar === k ? ' ativo' : ''}" data-filtro-montar="${k}">${n}</button>`).join('')}</div>
    <p class="fraco">${t('Seu ouro: <b class="ouro">{ouro}</b>', { ouro: fmt(estado.ouro) })} · ${t('escolha a receita e arraste as suas peças até a bancada. Cada tentativa gasta o ouro; as peças só são usadas quando dá certo.')}</p>
    <div class="troca-lista">${lista.length ? lista.map(linha).join('') : `<p class="fraco">${t('Você ainda não tem componentes para montar nenhum item. Veja em "Lendários" o que cada um precisa e no mapa onde os componentes caem.')}</p>`}</div>`;
}

// Forja do Ornn: o jogador arrasta (ou clica) um item até a bigorna; só o item que está nela pode ser forjado.
let forjaSel = null;              // { onde: 'itens' | 'mochila', k, id }
function itemNaBigorna() {
  if (!forjaSel) return null;
  // o item continua no mesmo lugar? (se mudou de posição, procura pelo id; se sumiu, sai da bigorna)
  if (estado[forjaSel.onde][forjaSel.k] !== forjaSel.id) {
    const k = estado[forjaSel.onde].indexOf(forjaSel.id);
    if (k < 0) { forjaSel = null; return null; }
    forjaSel.k = k;
  }
  return forjaSel;
}
function mostrarForja() {
  const sel = itemNaBigorna();
  const icone = (onde, id, k) => {
    const aqui = sel && sel.onde === onde && sel.k === k;
    return `<span class="forja-pegar${aqui ? ' na-bigorna' : ''}" draggable="${aqui ? 'false' : 'true'}" data-pegar="${onde}:${k}" title="${textoItem(id).replace(/"/g, '&quot;')}\n\n${t('Arraste até a bigorna ou dê dois cliques')}"><img src="${imgItem(id)}" alt="">${rotuloRef(id)}</span>`;
  };
  const grupo = (titulo, onde) => estado[onde].length
    ? `<div class="forja-grupo"><small>${titulo}</small><div class="forja-itens">${estado[onde].map((id, k) => icone(onde, id, k)).join('')}</div></div>` : '';
  let detalhe;
  if (!sel) detalhe = `<div class="forja-vazia">${t('Arraste um item até a bigorna, ou dê dois cliques nele.')}<small>${t('Só o item que estiver aqui é forjado.')}</small></div>`;
  else {
    const id = sel.id, d = descreverItem(id), ref = M.refinoDe(id);
    if (ref >= M.REFINO_MAX) detalhe = `<div class="forja-det"><b class="cor-${d.raridade}">${d.nome}</b><span class="forja-max">${t('Refino máximo (+{max})', { max: M.REFINO_MAX })}</span></div>`;
    else {
      if (!M.podeUsarGema(estado, gemaForja, 'forja')) gemaForja = null;
      const gf = gemaForja && M.GEMAS[gemaForja];
      const semGema = M.chanceForjaAgora(estado, ref, id), ch = Math.min(1, semGema * (gf?.mult || 1)), reg = M.REGRESSAO_REFINO[ref] || 0, preco = M.precoRefino(id);
      detalhe = `<div class="forja-det">
        <b class="cor-${d.raridade}">${d.nome}</b>
        <div class="forja-passo"><span>+${ref}</span><i>→</i><span class="alvo">+${ref + 1}</span><em>${t('+{pct}% nos bônus', { pct: Math.round(M.BONUS_REFINO * 100) })}</em></div>
        <dl>
          <dt>${t('Chance')}</dt><dd class="chance">${pctFino(ch)}${gf?.mult ? ` <small class="sem-gema">${t('({pct} sem a runa)', { pct: pctFino(semGema) })}</small>` : ''}</dd>
          <dt>${t('Se falhar')}</dt><dd class="${reg && !gf?.protege ? 'risco' : ''}">${reg && gf?.protege ? t('a Runa de Proteção segura o item no nível') : reg ? t('{pct} de voltar para +{ref}', { pct: pctFino(reg), ref: ref - 1 }) : t('nada muda')}</dd>
          <dt>${t('Custo')}</dt><dd${estado.ouro < preco ? ' class="caro"' : ''}>${t('<b class="ouro">{custo}</b> ouro por tentativa', { custo: fmt(preco) })}</dd>
          ${barraPersistencia(M.PERSISTENCIA.forja[ref + 1], M.falhasForja(estado, ref + 1, id), M.chanceRefino(estado, ref), semGema, { r: M.faixaForja(id), n: ref + 1 })}
        </dl>
        ${escolhaGema('forja', gemaForja)}
        ${estado.ouro < preco ? avisoSemOuro(preco) : ''}
        <div class="botoes vezes">${BOTOES_VEZES.map((n) => `<button class="botao${n === 1 ? ' principal' : ''}" data-forjar="${sel.onde}:${sel.k}" data-vezes="${n}" ${estado.ouro >= preco ? '' : `disabled title="${t('Ouro insuficiente')}"`}>${n === 1 ? (estado.ouro >= preco ? t('Forjar') : t('Ouro insuficiente')) : '×' + n}</button>`).join('')}</div>
        <small class="fraco">${reg ? t('×10, ×100 e ×1000 param no primeiro sucesso ou se o item regredir.') : t('×10, ×100 e ×1000 param no primeiro sucesso.')}</small>
      </div>`;
    }
  }
  const slot = sel ? `<span class="forja-pegar"><img src="${imgItem(sel.id)}" alt="">${rotuloRef(sel.id)}</span><button class="forja-tirar" data-tirar title="${t('Tirar da bigorna')}">×</button>` : '';
  $('#npc-troca').innerHTML = (estado.itens.length || estado.mochila.length) ? `
    <div class="forja">
      <div class="forja-bancada">
        <div class="forja-slot${sel ? ' cheia' : ''}" data-bigorna>${slot}</div>
        ${detalhe}
      </div>
      <p class="fraco forja-ouro">${t('Seu ouro: <b class="ouro">{ouro}</b>', { ouro: fmt(estado.ouro) })}</p>
      ${grupo(t('Equipados'), 'itens')}${grupo(t('Mochila'), 'mochila')}
    </div>` : `<p class="fraco">${t('Você não tem itens para forjar.')}</p>`;
}
function porNaBigorna(ref) {
  const [onde, k] = String(ref).split(':');
  const id = estado[onde]?.[+k];
  if (!id) return;
  forjaSel = { onde, k: +k, id };
  mostrarForja();
}
// dois cliques numa peça: vai para a receita (montagem) ou para a bigorna (forja), como arrastar
$('#npc-troca').addEventListener('dblclick', (e) => {
  const p = e.target.closest('[data-pegar]'); if (!p || p.classList.contains('na-bigorna')) return;
  e.preventDefault(); getSelection?.().removeAllRanges?.();
  if (montarSel && $('#npc-troca [data-slot]')) porNoSlot(p.dataset.pegar, null);
  else if ($('#npc-troca [data-bigorna]')) porNaBigorna(p.dataset.pegar);
});
$('#npc-troca').addEventListener('dragstart', (e) => {
  const p = e.target.closest?.('[data-pegar]'); if (!p) return;
  e.dataTransfer.setData('text/plain', p.dataset.pegar); e.dataTransfer.effectAllowed = 'move';
  document.querySelector('[data-bigorna]')?.classList.add('esperando');
});
$('#npc-troca').addEventListener('dragend', () => document.querySelectorAll('#npc-troca .sobre, #npc-troca .esperando').forEach((x) => x.classList.remove('sobre', 'esperando')));
const alvoSoltar = (e) => e.target.closest?.('[data-bigorna], [data-slot], [data-bancada-montar]');
$('#npc-troca').addEventListener('dragover', (e) => { const b = alvoSoltar(e); if (b) { e.preventDefault(); (b.closest('[data-slot]') || b).classList.add('sobre'); } });
$('#npc-troca').addEventListener('dragleave', (e) => { const b = e.target.closest?.('[data-bigorna], [data-slot]'); if (b && !b.contains(e.relatedTarget)) b.classList.remove('sobre'); });
$('#npc-troca').addEventListener('drop', (e) => {
  const b = alvoSoltar(e); if (!b) return;
  e.preventDefault();
  const ref = e.dataTransfer.getData('text/plain');
  if (b.matches('[data-bigorna]')) porNaBigorna(ref);
  else { const sl = e.target.closest('[data-slot]'); porNoSlot(ref, sl ? +sl.dataset.slot : null); }
});

// ---------- skins ----------
let skinsMontadas = false;
function montarSkins() {
  const primeira = !skinsMontadas; skinsMontadas = true;
  $('#skins').innerHTML = M.skinsVisiveis(estado).map((sk) => `
    <button class="skin" data-skin="${sk.num}" style="background-image:url(${splashSkin(CAMP, sk.num)})" title="${sk.nome}">
      <span class="preco"></span>${sk.efeitos ? `<span class="selo-efeitos" title="${t('Muda também as cores das habilidades')}">✨</span>` : ''}<img class="boneco" src="${miniatura(spriteCampeao(CAMP, sk.num))}" alt=""><span class="nome">${sk.nome}</span>
    </button>`).join('');
  if (primeira) $('#skins').addEventListener('click', (e) => {
    const b = e.target.closest('[data-skin]'); if (!b) return;
    const num = +b.dataset.skin, sk = M.skinsDe(estado).find((x) => x.num === num);
    if (M.temSkin(estado, num)) { M.usarSkin(estado, num); log(t('Você está usando {skin}.', { skin: sk.nome }), 'item'); }
    else { abrirMercado('loja'); log(sk.efeitos ? t('{skin} está à venda na Loja por {preco} diamantes (muda também as cores das habilidades).', { skin: sk.nome, preco: sk.preco }) : t('{skin} está à venda na Loja por {preco} diamantes.', { skin: sk.nome, preco: sk.preco }), 'npc'); }
    cena.definirSkin(estado.skin); atualizarUI();
  });
}
// ---------- conquistas ----------
const textoBonus = (b) => !b ? '' : Object.entries(b).map(([k, v]) => `+${Math.round(v * 100)}% ${{ ad: t('dano'), vida: t('vida'), armadura: t('armadura'), rm: t('res. mágica'), ouro: t('ouro') }[k]}`).join(', ');
// número inteiro com o separador de milhar do idioma (1.000 / 1,000)
const FMT_INTEIRO = new Intl.NumberFormat(LOCALE), inteiro = (n) => FMT_INTEIRO.format(Math.floor(Math.max(0, n)));       // um formatador só (toLocaleString criava um a cada chamada)
function montarConquistas() {
  $('#conquistas').innerHTML = M.CONQUISTAS.map((c) => `
    <div class="conq" data-conq="${c.id}" title="${t('Título: {titulo}', { titulo: c.titulo })}${c.bonus ? ' · ' + t('Bônus: {bonus}', { bonus: textoBonus(c.bonus) }) : ''}">
      <i>★</i><b>${c.nome}</b>
      <small>${c.desc}${c.bonus ? ' · ' + textoBonus(c.bonus) : ''}</small>
      ${c.prog ? '<div class="mini"><span></span></div><em class="conq-num"></em>' : ''}
    </div>`).join('');
  $('#titulo').addEventListener('change', (e) => { M.escolherTitulo(estado, e.target.value); atualizarUI(); });
}
let titulosMontados = '';
function atualizarConquistas() {
  for (const c of M.verificarConquistas(estado)) {
    log(c.bonus ? t('Conquista: {nome}! Título "{titulo}" liberado e bônus permanente de {bonus}.', { nome: c.nome, titulo: c.titulo, bonus: textoBonus(c.bonus) })
      : t('Conquista: {nome}! Título "{titulo}" liberado.', { nome: c.nome, titulo: c.titulo }), 'raro');
    cena.aviso(t('Conquista: {nome}!', { nome: c.nome }), '#ffd84a');
  }
  const feitas = estado.conquistas || [];
  for (const el of document.querySelectorAll('#conquistas .conq')) {
    const c = M.CONQUISTAS.find((x) => x.id === el.dataset.conq), feita = feitas.includes(c.id);
    el.classList.toggle('feita', feita);
    const barra = el.querySelector('.mini > span');
    if (barra) {
      const [a, b] = c.prog(estado), num = el.querySelector('.conq-num'), txtNum = feita ? '' : `${inteiro(Math.min(a, b))} / ${inteiro(b)}`;
      barra.style.width = `${Math.min(100, (100 * a) / b)}%`; barra.parentElement.hidden = feita;
      if (num && num.textContent !== txtNum) num.textContent = txtNum;      // o contador (pedido de jogador): 3.450 / 10.000
    }
  }
  const chave = feitas.join(',');
  if (chave !== titulosMontados) {
    titulosMontados = chave;
    $('#titulo').innerHTML = `<option value="">${t('(nenhum)')}</option>` + M.CONQUISTAS.filter((c) => feitas.includes(c.id)).map((c) => `<option value="${c.id}">${c.titulo}</option>`).join('');
    $('#titulo').value = estado.titulo || '';
  }
  const q = `(${feitas.length}/${M.CONQUISTAS.length})`;
  if ($('#conq-qtd').textContent !== q) $('#conq-qtd').textContent = q;
  cena.titulo = M.tituloAtual(estado);
}

// ---------- mascotes ----------
function montarMascotes() {
  $('#mascotes').innerHTML = Object.entries(M.MASCOTES).map(([id, m]) => `
    <div class="pet" data-pet="${id}">
      <img src="${miniatura(m.nome)}" alt="">
      <div><b>${t(m.nome)}</b> <small class="nv"></small><small>${t(m.desc)}</small><div class="mini"><span></span></div>
        <div class="pet-skins">${[{ id: '', nome: t('Normal') }, ...(M.SKINS_PET[id] || [])].map((sk) => `<button type="button" data-pet-skin="${id}:${sk.id}" title="${sk.nome}">${sk.id ? (ingles ? sk.nome.replace(t(m.nome), '').trim() : sk.nome.replace(m.nome, '').replace(/^ (de |do )?/, '')) : t('Normal')}</button>`).join('')}</div></div>
      <button class="botao"></button>
    </div>`).join('');
  $('#mascotes').addEventListener('click', (e) => {
    const sk = e.target.closest('[data-pet-skin]');
    if (sk) {
      const [pet, id] = sk.dataset.petSkin.split(':');
      if (!estado.mascotes?.[pet]) { log(t('Adote o {pet} primeiro.', { pet: t(M.MASCOTES[pet].nome) }), 'npc'); return; }
      if (!M.temSkinPet(estado, pet, id)) { abrirMercado('loja'); log(t('Essa skin está à venda na Loja por {preco} diamantes.', { preco: M.LOJA.skinPet.preco }), 'npc'); return; }
      M.usarSkinPet(estado, pet, id || null);
      cena.definirMascote(M.spriteMascote(estado)); atualizarUI();
      return;
    }
    const b = e.target.closest('.pet .botao'); if (!b) return;
    const id = b.closest('.pet').dataset.pet, m = M.MASCOTES[id];
    if (estado.mascotes?.[id]) {
      M.escolherMascote(estado, estado.mascote === id ? null : id);
      log(estado.mascote ? t('{pet} está te acompanhando.', { pet: t(m.nome) }) : t('{pet} foi descansar.', { pet: t(m.nome) }), 'item');
    } else if (m.especial) { log(t('{pet}: {req}.', { pet: t(m.nome), req: t(m.req.texto) }), 'npc'); return; }
    else if (M.adotarMascote(estado, id)) { log(t('Você adotou um {pet}!', { pet: t(m.nome) }), 'raro'); cena.efeito('brilho', cena.darius, 1.4, '#ffe080'); }
    else log(m.req ? t('{pet}: {req} para liberar.', { pet: t(m.nome), req: m.req.texto }) : t('{pet} custa {preco} de ouro.', { pet: t(m.nome), preco: fmt(m.preco) }), 'morte');
    cena.definirMascote(M.spriteMascote(estado));
    atualizarUI();
  });
}
function atualizarMascotes() {
  for (const el of document.querySelectorAll('#mascotes .pet')) {
    const id = el.dataset.pet, m = M.MASCOTES[id], p = estado.mascotes?.[id], ativo = estado.mascote === id;
    el.classList.toggle('ativo', ativo);
    const nv = p ? t('nível {n}', { n: p.nivel }) + (p.nivel >= M.MASCOTE_MAX ? t(' (máx.)') : '') : '';
    if (el.querySelector('.nv').textContent !== nv) el.querySelector('.nv').textContent = nv;
    el.querySelector('.mini').hidden = !p;
    if (p) el.querySelector('.mini > span').style.width = p.nivel >= M.MASCOTE_MAX ? '100%' : `${(100 * p.xp) / M.xpMascote(p.nivel)}%`;
    for (const bt of el.querySelectorAll('[data-pet-skin]')) {
      const skId = bt.dataset.petSkin.split(':')[1];
      bt.classList.toggle('usando', !!p && (estado.skinPet?.[id] || '') === skId);
      bt.classList.toggle('bloq', !M.temSkinPet(estado, id, skId));
    }
    el.querySelector('img').src = miniatura(estado.skinPet?.[id] ? `${m.nome}@${estado.skinPet[id]}` : m.nome);
    const rot = p ? (ativo ? t('Guardar') : t('Levar')) : m.req ? (M.mascoteLiberado(estado, id) ? t('Adotar') : '🔒') : t('Adotar {preco}', { preco: fmt(m.preco) });
    const bt = el.querySelector('.botao');
    if (bt.textContent !== rot) { bt.textContent = rot; bt.title = m.req && !p ? t(m.req.texto) : ''; }
  }
  const p = estado.mascotes?.[estado.mascote];
  cena.petRotulo = p ? t('{pet} nv {n}', { pet: t(M.MASCOTES[estado.mascote].nome), n: p.nivel }) : null;
}

function atualizarSkins() {
  for (const b of document.querySelectorAll('#skins .skin')) {
    const num = +b.dataset.skin, sk = M.skinsDe(estado).find((x) => x.num === num), tem = M.temSkin(estado, num);
    b.classList.toggle('usando', estado.skin === num);
    b.classList.toggle('bloqueada', !tem);
    const p = b.querySelector('.preco'), texto = estado.skin === num ? t('usando') : tem ? '' : `${sk.preco} 💎`;
    if (p.textContent !== texto) { p.textContent = texto; p.hidden = !texto; }
  }
  const q = `(${M.skinsVisiveis(estado).filter((sk) => M.temSkin(estado, sk.num)).length}/${M.skinsVisiveis(estado).length})`;
  if ($('#skins-qtd').textContent !== q) $('#skins-qtd').textContent = q;
}

function mostrarTarefas() {
  // o item da recompensa, com as chances (o sorteio é na entrega)
  const T = M.ITEM_TAREFA;
  const chancesTxt = (o) => { const c = M.chancesItemTarefa(o); return `<span class="cor-epico">${t('{pct} épico', { pct: pctFino(c.epico) })}</span>, <span class="cor-lendario">${t('{pct} lendário', { pct: pctFino(c.lendario) })}</span>`; };
  const itemTarefa = (o) => o.item === 'grande'
    ? `<span class="cor-basico">${t('item garantido')}</span> (${chancesTxt(o)})`
    : o.item === 'pequena' ? `<span class="cor-basico">${t('pode dar item')}</span> (${t('{chances}, senão {pct} de um básico', { chances: chancesTxt(o), pct: pctFino(T.pequena) })})`
    : o.item ? `<span class="cor-${o.item}">${t('item {raridade}', { raridade: M.NOME_RARIDADE[o.item] })}</span>` : '';
  const TIPO = { rapida: t('Rápida'), normal: t('Normal'), desafio: t('Desafio'), longa: t('Longa'), especie: t('Caça'), furioso: t('Fúria') };
  const ofertas = M.ofertasTarefa(estado), falta = Math.max(0, estado.ofertas.em + M.TROCAR_TAREFAS_MIN * 60000 - Date.now()) / 1000;
  $('#npc-troca').innerHTML = '<div class="troca-lista">' + ofertas.map((o, k) => {
    const l = M.LOCAL[o.local], min = M.minutosTarefa(o);
    const oque = o.tipo === 'especie' ? t('{qtd} {monstro} em {lugar}', { qtd: o.qtd, monstro: t(o.monstro), lugar: l.nome })
      : o.tipo === 'furioso' ? t('{qtd} monstros furiosos em {lugar}', { qtd: o.qtd, lugar: l.nome }) : t('{qtd} monstros em {lugar}', { qtd: o.qtd, lugar: l.nome });
    return o.tipo ? `<div class="troca-linha tarefa-${o.tipo}">
      <img src="${miniatura(o.monstro || l.monstros[0][0])}" alt="">
      <div class="info"><b>${oque} <span class="selo-tarefa">${TIPO[o.tipo]}</span></b>
        <small>${t('~{min} min', { min })} · ${t('{xp} de XP', { xp: fmt(o.xp) })} · ${t('{ouro} de ouro', { ouro: fmt(o.ouro) })}${o.item ? ` · ${itemTarefa(o)}` : ''}</small></div>
      <button class="botao" data-tarefa="${k}">${t('Aceitar')}</button>
    </div>` : `<div class="troca-linha">
      <img src="${miniatura(o.monstro)}" alt="">
      <div class="info"><b>${o.qtd}× ${t(o.monstro)}</b><small>${l.nome} · ${t('{ouro} de ouro', { ouro: fmt(o.ouro) })} · ${t('{xp} de XP', { xp: fmt(o.xp) })}${o.item ? ` · ${itemTarefa(o)}` : ''}</small></div>
      <button class="botao" data-tarefa="${k}">${t('Aceitar')}</button>
    </div>`;
  }).join('') + `</div><p class="fraco tarefa-trocar">${t('Nas tarefas de zona, todo monstro dela conta. A Caça pede uma espécie; a Fúria, monstros furiosos. O Desafio é na zona de cima e paga mais.')}
    <button type="button" class="link" data-trocar-tarefas ${falta > 0 ? `disabled title="${t('Novas tarefas em {tempo}', { tempo: tempoTexto(falta) })}"` : ''}>${falta > 0 ? t('Outras tarefas em {tempo}', { tempo: tempoTexto(falta) }) : t('Outras tarefas')}</button></p>`;
}
// o alvo da tarefa em texto: por zona, "monstros" (a zona vem junto); por espécie (tarefas de antes), o monstro
const alvoTarefa = (tar) => (tar.tipo === 'furioso' ? t('monstros furiosos') : tar.tipo && tar.tipo !== 'especie' ? t('monstros') : ingles ? t(tar.monstro) : tar.monstro.toLowerCase());
const nomeTarefa = (tar) => (tar.tipo === 'especie' ? t(tar.monstro) : tar.tipo === 'furioso' ? t('Monstros furiosos') : tar.tipo ? M.LOCAL[tar.local]?.nome || '' : t(tar.monstro));

// quantidade escolhida de cada poção no Lojista (pedido de jogador: depois de comprar 50, o campo voltava para 10)
const qtdPocao = {};
// os itens iguais da mochila (mesmo texto: item, refino e qualidade)
function gruposVenda() { const g = new Map(); estado.mochila.forEach((id, k) => { if (!g.has(id)) g.set(id, { id, ks: [] }); g.get(id).ks.push(k); }); return g; }
// vende as posições da mochila de trás para a frente (assim as outras não mudam de lugar); devolve { qtd, total }
function venderPosicoes(ks) { let total = 0, qtd = 0; for (const k of [...ks].sort((a, b) => b - a)) { const v = M.venderItem(estado, k); if (v) { total += v; qtd++; } } return { qtd, total }; }

// ---------- Venda no Lojista: janela própria (pedido do dono: dentro da conversa a lista ficava apertada e pouco clara) ----------
// a mochila e os espólios em ícones à esquerda; clicar separa para a cesta da direita, que mostra o total e vende tudo de uma vez
const cesta = new Map();            // grupo (texto do item, ou "esp:<id>") → quantos vão ser vendidos
let filtroVenda = 'todos';
const ORDEM_VENDA = { espolio: 0, basico: 1, epico: 2, lendario: 3 };
// refinados e os de qualidade S e SS: os atalhos não pegam (dá para separar clicando neles)
const protegidoVenda = (id) => ['S', 'SS'].includes(M.qualidadeDe(id)) || M.refinoDe(id) > 0;
function gruposCesta() {
  const g = new Map();
  for (const [id, q] of Object.entries(estado.espolios || {})) {
    const p = M.ESPOLIOS[id]; if (q > 0 && p) g.set('esp:' + id, { chave: 'esp:' + id, esp: id, n: q, cada: p.valor, raridade: 'espolio', nome: p.nome, cor: '#d8c49a' });
  }
  for (const [id, { ks }] of gruposVenda()) {
    const d = descreverItem(id), pend = M.pendente(id);
    g.set(id, { chave: id, id, ks, n: ks.length, cada: pend ? 0 : M.valorVenda(id), raridade: d.raridade, nome: d.nome, cor: d.cor, pend, prot: protegidoVenda(id) });
  }
  return g;
}
const iconeVenda = (x) => (x.esp ? `<img class="pixel" src="${iconeEspolio(x.esp, M.ESPOLIOS[x.esp].cor)}" alt="">` : `<img src="${imgItem(x.id)}" alt="">${rotuloRef(x.id)}`);
function abrirVenda() { cesta.clear(); $('#janela-venda').hidden = false; desenharVenda(); }
function desenharVenda() {
  if ($('#janela-venda').hidden) return;
  const g = gruposCesta();
  for (const [k, q] of [...cesta]) { const x = g.get(k); if (!x || x.pend || q <= 0) cesta.delete(k); else if (q > x.n) cesta.set(k, x.n); }
  const lista = [...g.values()].sort((a, b) => ORDEM_VENDA[a.raridade] - ORDEM_VENDA[b.raridade] || a.nome.localeCompare(b.nome));
  const unidades = (r) => lista.filter((x) => r === 'todos' || x.raridade === r).reduce((s, x) => s + x.n, 0);
  const filtros = [['todos', t('Todos')], ['espolio', t('Espólios')], ['basico', t('Básicos')], ['epico', t('Épicos')], ['lendario', t('Lendários')]]
    .map(([r, nome]) => `<button type="button" class="cofre-filtro r-${r}${filtroVenda === r ? ' ativo' : ''}" data-filtro-venda="${r}">${nome} <small>${unidades(r)}</small></button>`).join('');
  const visiveis = lista.filter((x) => filtroVenda === 'todos' || x.raridade === filtroVenda);
  const grade = visiveis.length ? `<div class="cofre-grade">${visiveis.map((x) => {
    const sep = cesta.get(x.chave) || 0, resta = x.n - sep;
    const dica = [x.esp ? `${x.nome}\n${t('Espólio: só serve para vender.')}` : textoItem(x.id), '',
      x.pend ? t('Sendo avaliado...') : t('Vale {valor} de ouro cada.', { valor: fmt(x.cada) }),
      x.prot ? t('Refinado ou de qualidade S/SS: os atalhos não pegam este.') : '',
      x.pend ? '' : t('Clique: separa 1 · Shift + clique: separa todos')].filter((l, i) => l || i === 1).join('\n');
    return `<button type="button" class="cofre-slot venda-slot r-${x.raridade}${resta ? '' : ' esgotado'}" data-separar="${esc(x.chave)}" data-nome="${esc(x.nome)}${x.pend ? '' : ' · ' + esc(t('{valor} de ouro cada', { valor: fmt(x.cada) }))}" data-cor="${x.cor}" title="${esc(dica)}" ${x.pend || !resta ? 'disabled' : ''}>${iconeVenda(x)}${resta > 1 ? `<i class="qtd">×${resta}</i>` : ''}${sep ? `<i class="na-cesta">✓${sep}</i>` : ''}${x.prot ? '<i class="cadeado">🔒</i>' : ''}</button>`;
  }).join('')}</div>` : `<p class="fraco cofre-vazio">${lista.length ? t('Nada desse tipo aqui.') : t('Sua mochila está vazia. Itens equipados não podem ser vendidos: guarde-os na mochila antes.')}</p>`;
  let n = 0, v = 0;
  const linhas = [...cesta].map(([k, q]) => {
    const x = g.get(k); n += q; v += x.cada * q;
    return `<div class="cesta-linha"><span class="cesta-ico r-${x.raridade}">${iconeVenda(x)}</span>
      <div class="info"><b style="color:${x.cor}">${esc(x.nome)}</b><small>${x.n > 1 ? t('{q} de {n}', { q, n: x.n }) + ' · ' : ''}${t('{valor} cada', { valor: fmt(x.cada) })}</small></div>
      <span class="ouro">${fmt(x.cada * q)}</span>
      <span class="cesta-botoes"><button type="button" class="botao" data-cesta-menos="${esc(k)}" title="${t('Tirar 1')}">−</button><button type="button" class="botao" data-cesta-mais="${esc(k)}" title="${t('Separar mais 1')}" ${q >= x.n ? 'disabled' : ''}>+</button>${x.n > 1 && q < x.n ? `<button type="button" class="botao" data-cesta-todos="${esc(k)}">${t('Todos')}</button>` : ''}<button type="button" class="botao cesta-tirar" data-cesta-tirar="${esc(k)}" title="${t('Tirar da cesta')}">×</button></span></div>`;
  });
  // atalhos: separam de uma vez o que ainda não está na cesta (sem os refinados, os S/SS e os que estão sendo avaliados)
  const cabe = (r) => lista.some((x) => !x.pend && !x.prot && (r === 'todos' || x.raridade === r) && (cesta.get(x.chave) || 0) < x.n);
  const atalhos = [['espolio', t('Espólios')], ['basico', t('Básicos')], ['epico', t('Épicos')], ['todos', t('Tudo')]]
    .map(([r, nome]) => `<button type="button" class="botao" data-separar-tipo="${r}" ${cabe(r) ? '' : 'disabled'}>+ ${nome}</button>`).join('');
  $('#venda-ouro').innerHTML = t('Seu ouro: <b class="ouro">{ouro}</b>', { ouro: fmt(estado.ouro) });
  const corpo = $('#venda-corpo'), rolagem = corpo.querySelector('.cofre-lista')?.scrollTop || 0, rolCesta = corpo.querySelector('.cesta-lista')?.scrollTop || 0;
  corpo.innerHTML = `<div class="cofre-filtros" role="group" aria-label="${t('Mostrar')}">${filtros}</div>
    <div class="venda-colunas">
      <div class="cofre-lado venda-mochila">
        <div class="cofre-topo"><h4>🎒 ${t('Mochila')} <small class="fraco">${estado.mochila.length}/${M.mochilaDe(estado.nivel)}</small></h4><small class="fraco">${t('Clique para separar')}</small></div>
        <div class="cofre-lista">${grade}</div>
        <p class="cofre-info venda-info">${t('Passe o mouse num item para ver quanto vale.')}</p>
      </div>
      <div class="cofre-lado venda-cesta">
        <div class="cofre-topo"><h4>🧺 ${t('Para vender')} <small class="fraco">${n}</small></h4>${n ? `<button type="button" class="link" data-limpar-cesta>${t('Limpar')}</button>` : ''}</div>
        <div class="cesta-lista">${linhas.length ? linhas.join('') : `<p class="cesta-vazia">${t('Clique nos itens da mochila para separar o que vai vender, ou use os botões abaixo para separar vários de uma vez.')}</p>`}</div>
        <div class="cesta-atalhos"><small>${t('Separar:')}</small>${atalhos}</div>
        <div class="cesta-rodape">
          <div class="cesta-total"><span>${t('Você recebe')}</span><b class="ouro">${fmt(v)}</b></div>
          <button type="button" class="botao principal cesta-vender" data-vender-cesta ${n ? '' : 'disabled'}>${n === 1 ? t('Vender 1 item') : n ? t('Vender {n} itens', { n: inteiro(n) }) : t('Separe o que vai vender')}</button>
        </div>
      </div>
    </div>`;
  const l1 = corpo.querySelector('.cofre-lista'), l2 = corpo.querySelector('.cesta-lista');
  if (l1) l1.scrollTop = rolagem; if (l2) l2.scrollTop = rolCesta;
}
// separa na cesta: q itens do grupo (Infinity = todos)
function separar(k, q) {
  const x = gruposCesta().get(k); if (!x || x.pend) return;
  cesta.set(k, Math.min(x.n, (cesta.get(k) || 0) + q));
}
async function venderCesta() {
  const g = gruposCesta(), ks = [], esp = [];
  let n = 0, valor = 0, lend = 0, raros = 0;
  for (const [k, q] of cesta) {
    const x = g.get(k); if (!x || !q || x.pend) continue;
    n += q; valor += x.cada * q;
    if (x.esp) { esp.push([x.esp, q]); continue; }
    ks.push(...x.ks.slice(-q));
    if (x.raridade === 'lendario') lend += q;
    if (['S', 'SS'].includes(M.qualidadeDe(x.id))) raros += q;
  }
  if (!n) return;
  // lendário ou qualidade S/SS na cesta: pergunta antes (o resto vende direto)
  if (lend || raros) {
    const texto = [n === 1 ? t('Vender 1 item por {total} de ouro?', { total: inteiro(valor) }) : t('Vender {qtd} itens por {total} de ouro?', { qtd: n, total: inteiro(valor) }),
      lend ? t('Entre eles há {n} lendário(s).', { n: lend }) : '', raros ? t('E {n} de qualidade S ou SS.', { n: raros }) : ''].filter(Boolean).join(' ');
    if (!(await confirmar(texto, { titulo: t('Vender o que está na cesta?'), ok: t('Vender'), cancelar: t('Cancelar'), perigo: true }))) return;
  }
  const r = venderPosicoes(ks);
  let total = r.total, qtd = r.qtd;
  for (const [id, q] of esp) { const v = M.venderEspolio(estado, id, q); if (v) { total += v; qtd += q; } }
  if (esp.length && obj) { obj.vendeu = true; gravarLocal(CHAVE_OBJ, obj); }
  cesta.clear();
  if (qtd) { log(t('Você vendeu {qtd} itens por {total} de ouro.', { qtd, total: fmt(total) }), 'item'); som.efeito('moeda'); }
  desenharVenda(); atualizarUI();
}
$('#janela-venda').addEventListener('click', (e) => {
  const f = e.target.closest('[data-filtro-venda]');
  if (f) { filtroVenda = f.dataset.filtroVenda; desenharVenda(); return; }
  const s = e.target.closest('[data-separar]');
  if (s) { separar(s.dataset.separar, e.shiftKey ? Infinity : 1); desenharVenda(); return; }
  const tp = e.target.closest('[data-separar-tipo]');
  if (tp) {
    const r = tp.dataset.separarTipo;
    for (const x of gruposCesta().values()) if (!x.pend && !x.prot && (r === 'todos' || x.raridade === r)) cesta.set(x.chave, x.n);
    desenharVenda(); return;
  }
  const b = e.target.closest('[data-cesta-menos],[data-cesta-mais],[data-cesta-todos],[data-cesta-tirar]');
  if (b) {
    const d = b.dataset, k = d.cestaMenos ?? d.cestaMais ?? d.cestaTodos ?? d.cestaTirar;
    if (d.cestaMenos != null) { const q = (cesta.get(k) || 0) - 1; if (q > 0) cesta.set(k, q); else cesta.delete(k); }
    else if (d.cestaMais != null) separar(k, 1);
    else if (d.cestaTodos != null) separar(k, Infinity);
    else cesta.delete(k);
    desenharVenda(); return;
  }
  if (e.target.closest('[data-limpar-cesta]')) { cesta.clear(); desenharVenda(); return; }
  if (e.target.closest('[data-vender-cesta]')) venderCesta();
});
// passar o mouse num item mostra o nome e quanto vale embaixo da grade (na cor da raridade)
$('#janela-venda').addEventListener('mouseover', (e) => {
  const s = e.target.closest('.venda-slot'); if (!s) return;
  const info = $('#janela-venda .venda-info'); if (!info) return;
  info.textContent = s.dataset.nome; info.style.color = s.dataset.cor;
});
function mostrarTroca(modo) {
  const el = $('#npc-troca');
  const antes = el.querySelector('.troca-lista[data-lista]'), rolagem = antes?.dataset.lista === modo ? antes.scrollTop : 0;      // vender um item não volta a lista para o topo
  if (modo === 'comprar') {
    el.innerHTML = `<p class="fraco">${t('Seu ouro: <b class="ouro">{ouro}</b>', { ouro: fmt(estado.ouro) })}</p><div class="troca-lista">` + Object.entries(M.POCOES).map(([k, p]) => `
      <div class="troca-linha">
        <img src="${frasco(ICONE_POCAO[k])}" alt="">
        <div class="info"><b>${p.nome}</b><small>${t('Recupera {cura} de {tipo}', { cura: p.cura, tipo: t(p.tipo) })} · ${t('{ouro} de ouro', { ouro: p.preco })}${p.nivel > 1 ? ' · ' + t('nível {n}+', { n: p.nivel }) : ''} · ${t('você tem {n}', { n: estado.pocoes[k] })}</small></div>
        <input type="number" min="1" value="${qtdPocao[k] || 10}" data-qtd="${k}">
        <button class="botao" data-comprar="${k}" ${estado.nivel < p.nivel ? 'disabled' : ''}>${t('Comprar')}</button>
      </div>`).join('') + '</div>';
  }
  const lista = el.querySelector('.troca-lista');
  if (lista) { lista.dataset.lista = modo; lista.scrollTop = rolagem; }
}
$('#npc-troca').addEventListener('click', async (e) => {
  if (e.target.closest('[data-abrir-venda]')) { abrirVenda(); return; }
  const fc = e.target.closest('[data-filtro-cofre]');
  if (fc) { filtroCofre = fc.dataset.filtroCofre; mostrarCofre(); return; }
  const cf = e.target.closest('[data-cofre]');
  if (cf) {              // cofre da Tesoureira: tudo passa pelo servidor
    const acao = cf.dataset.cofre;
    if (acao === 'ampliarOuro' || acao === 'ampliarDiamante') {
      const ouroP = acao === 'ampliarOuro', D = M.COFRE.diamantes;
      const pergunta = ouroP ? t('Comprar +{n} espaços no cofre deste personagem por {p} de ouro?', { n: M.COFRE.ouro.espacos, p: inteiro(M.precoCofreOuro(estado)) })
        : t('Comprar +{n} espaços no cofre deste personagem por {p} diamantes?', { n: D.espacos, p: D.preco });
      if (!ouroP && rp < D.preco) { avisar(t('Você precisa de {n} diamantes.', { n: D.preco })); return; }
      if (!(await confirmar(pergunta, { titulo: t('Ampliar o cofre'), ok: t('Comprar') }))) return;
      const r = await operarServidor('/api/cofre', { acao });
      if (r) { som.efeito('fanfarra'); log(t('O cofre agora tem {n} espaços.', { n: M.espacosCofre(estado) }), 'raro'); cena.aviso(t('Cofre ampliado: {n} espaços', { n: M.espacosCofre(estado) }), '#d8b050'); }
      mostrarCofre(); atualizarUI(); return;
    }
    let n = 0;
    if (acao === 'depositar' || acao === 'sacar') {
      n = cf.dataset.tudo ? (acao === 'depositar' ? Math.floor(estado.ouro) : estado.cofre?.ouro || 0) : Math.floor(+($('#cofre-valor')?.value || 0));
      if (!(n > 0)) { $('#cofre-valor')?.focus(); return; }
    }
    cf.disabled = true;
    const id = acao === 'guardar' ? estado.mochila[+cf.dataset.k] : acao === 'retirar' ? estado.cofre?.itens?.[+cf.dataset.k] : null;
    const r = await operarServidor('/api/cofre', { acao, k: +cf.dataset.k, n });
    if (r) {
      som.efeito('moeda');
      if (acao === 'guardar') log(t('{item} foi para o cofre.', { item: descreverItem(id).nome }), 'npc');
      else if (acao === 'retirar') log(t('{item} voltou para a mochila.', { item: descreverItem(id).nome }), 'npc');
      else if (acao === 'guardarTudo') log(t('{n} itens foram para o cofre.', { n: r.quantos }), 'npc');
      else if (acao === 'retirarTudo') log(t('{n} itens voltaram para a mochila.', { n: r.quantos }), 'npc');
      else if (acao === 'depositar') log(t('Você guardou {n} de ouro no cofre.', { n: fmt(n) }), 'npc');
      else log(t('Você retirou {n} de ouro do cofre.', { n: fmt(n) }), 'npc');
    }
    mostrarCofre(); atualizarUI(); return;
  }
  const fm = e.target.closest('[data-filtro-montar]');
  if (fm) { filtroMontar = fm.dataset.filtroMontar; mostrarMontagem(); return; }
  const rc = e.target.closest('[data-receita]');
  if (rc) { escolherReceita(rc.dataset.receita); return; }
  if (e.target.closest('[data-receitas]')) { montarSel = null; mostrarMontagem(); return; }
  const ts = e.target.closest('[data-tirar-slot]');
  if (ts && montarSel) { montarSel.slots[+ts.dataset.tirarSlot].pos = null; mostrarMontagem(); return; }
  if (montarSel && matchMedia('(pointer: coarse)').matches) { const p = e.target.closest('[data-pegar]'); if (p) { porNoSlot(p.dataset.pegar, null); return; } }
  // escolher a gema das próximas tentativas (forja ou montagem)
  const ug = e.target.closest('[data-usar-gema]');
  if (ug && !ug.disabled) {
    const para = ug.closest('[data-gemas-para]').dataset.gemasPara, g = ug.dataset.usarGema || null;
    if (para === 'forja') { gemaForja = g; mostrarForja(); } else { gemaMontar = g; mostrarMontagem(); }
    return;
  }
  const mt = e.target.closest('[data-montar]');
  if (mt && !mt.disabled) {
    const id = mt.dataset.montar;
    conferirBancada();
    if (!montarSel || montarSel.id !== id || !montarSel.slots.every((sl) => sl.pos)) { mostrarMontagem(); return; }
    const usar = montarSel.slots.map((sl) => ({ onde: sl.pos.onde, k: sl.pos.k }));
    const a = M.analisarMontagem(estado, id, usar);
    if (a.faltam.length) { mostrarMontagem(); return; }
    const refinados = a.usa.map((u) => estado[u.onde][u.k]).filter((x) => M.refinoDe(x) > 0);
    if (refinados.length && !(await confirmar(t('Os componentes refinados ({pecas}) perdem o refino ao virar {item}.', { pecas: refinados.map((x) => descreverItem(x).nome).join(', '), item: M.ITENS[id].nome }), { titulo: t('Montar mesmo assim?'), ok: t('Montar'), perigo: true }))) return;
    mt.disabled = true;
    const gemaUsada = gemaMontar;
    const r = await operarServidor('/api/ornn/montar', { item: id, vezes: +mt.dataset.vezes || 1, usar, gema: gemaUsada });
    if (r?.gemas) log(t('Runas usadas: {n}× {gema}.', { n: r.gemas, gema: M.nomeGema(gemaUsada) }), 'npc');
    const tent = r && r.tentativas > 1 ? t(' em {n} tentativas', { n: fmt(r.tentativas) }) : '';
    if (!r) { mostrarMontagem(); erroOrnn($('#mercado-erro').textContent || t('Não foi possível processar o pedido.')); atualizarUI(); return; }
    {          // a animação do resultado (estilo Grand Chase)
      const falhas = M.falhasMontar(estado, id), bonus = Math.round(M.bonusFalhas(falhas) * 100);
      await animarOrnn({ img: imgItem(id), nome: M.ITENS[id].nome, sucesso: !!r.sucesso, cor: descreverItem(id).cor,
        detalhe: r.sucesso ? (r.tentativas > 1 ? t('em {n} tentativas', { n: fmt(r.tentativas) }) : '') : bonus ? t('A próxima tentativa ficou um pouco mais fácil (+{p}% da chance).', { p: bonus }) : t('As peças continuam com você.') });
    }
    if (r?.sucesso) {
      log(t('Ornn montou {item}{tent}! (−{gasto} de ouro)', { item: r.item ? descreverItem(r.item).nome : M.ITENS[id].nome, tent, gasto: fmt(r.gasto) }), 'raro');
      if (r.item && ['A', 'S', 'SS'].includes(M.qualidadeDe(r.item))) avisoSaque({ img: imgItem(id), nome: `${M.ITENS[id].nome} ${M.qualidadeDe(r.item)}`, cor: M.QUALIDADES[M.qualidadeDe(r.item)].cor, tipo: t('Qualidade {q}!', { q: M.qualidadeDe(r.item) }), classe: 'qual-' + M.qualidadeDe(r.item) });
      montarSel = { id, slots: M.ITENS[id].de.map((c) => ({ c, pos: null })) };      // as peças foram usadas: a bancada esvazia
      som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040'); cena.aviso(M.ITENS[id].nome + '!', '#ffd040');
    } else if (r) log(t('A montagem de {item} não deu certo{tent}... as peças continuam com você. (−{gasto} de ouro)', { item: M.ITENS[id].nome, tent, gasto: fmt(r.gasto) }) + (r.parou ? ' ' + t('O ouro acabou.') : ''), 'morte');
    mostrarMontagem(); atualizarUI(); return;
  }
  if (e.target.closest('[data-tirar]')) { forjaSel = null; mostrarForja(); return; }
  const pg = e.target.closest('[data-pegar]');
  if (pg && matchMedia('(pointer: coarse)').matches) { porNaBigorna(pg.dataset.pegar); return; }
  const fj = e.target.closest('[data-forjar]');
  if (fj) {
    // só forja o item que está na bigorna, e só se ele ainda é o mesmo
    const sel = itemNaBigorna();
    if (!sel) { mostrarForja(); return; }
    const { onde, k } = sel;
    const vezes = +(fj.dataset.vezes || 1);
    const atual = estado[onde][+k];
    if (atual !== sel.id) { mostrarForja(); return; }
    if (vezes > 1 && M.REGRESSAO_REFINO[M.refinoDe(atual)] && !(await confirmar(t('Cada falha tem {pct} de chance de o item voltar um nível; se isso acontecer, as tentativas param.', { pct: pctFino(M.REGRESSAO_REFINO[M.refinoDe(atual)]) }), { titulo: t('Forjar {item} até {n} vezes?', { item: descreverItem(atual).nome, n: vezes }), ok: t('Forjar ×{n}', { n: vezes }), perigo: true }))) return;
    fj.disabled = true;
    const gemaUsada = gemaForja;
    const resp = await operarServidor('/api/ornn/forjar', { onde, k: +k, vezes, gema: gemaUsada });
    const r = resp?.resultado;
    if (!resp) { mostrarForja(); erroOrnn($('#mercado-erro').textContent || t('Não foi possível processar o pedido.')); atualizarUI(); return; }
    if (r) {
      // a animação do resultado (estilo Grand Chase): o item na bigorna, as marteladas e o SUCESSO! ou FALHOU
      const novo = M.refinoDe(r.item), alvoRef = r.sucesso ? novo : M.refinoDe(r.antes) + 1, bonus = Math.round(M.bonusFalhas(M.falhasForja(estado, alvoRef, r.item)) * 100);
      const CORES_REF = ['#ffd84a', '#7ae08a', '#5ad8ff', '#c890ff', '#ff9a3a', '#ff5a5a'];
      await animarOrnn({ img: imgItem(r.item), nome: descreverItem(r.item).nome, sucesso: !!r.sucesso, cor: CORES_REF[novo] || '#ffd84a', falhaGrave: !!r.regrediu,
        detalhe: r.sucesso ? (r.tentativas > 1 ? t('em {n} tentativas', { n: fmt(r.tentativas) }) : '')
          : r.regrediu ? t('O item voltou para +{n}.', { n: novo })
          : r.protegeu ? t('A Runa de Proteção segurou o item no nível.')
          : bonus ? t('A próxima tentativa ficou um pouco mais fácil (+{p}% da chance).', { p: bonus }) : '' });
      const d = descreverItem(r.item), tent = r.tentativas > 1 ? t(' em {n} tentativas', { n: fmt(r.tentativas) }) : '', custo = r.gasto ? t(' (−{gasto} de ouro)', { gasto: fmt(r.gasto) }) : '';
      if (forjaSel) forjaSel.id = estado[onde][+k];          // o item na bigorna agora é o novo (+1 ou regredido)
      if (r.sucesso) {
        log(t('Ornn forjou seu item{tent}: {item}!', { tent, item: d.nome }) + custo, 'raro');
        som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040'); cena.aviso(d.nome + '!', '#ffd040');
      } else if (r.regrediu) {
        log(t('A forja falhou{tent} e o item regrediu: {antes} virou {item}.', { tent, antes: descreverItem(r.antes).nome, item: d.nome }) + custo, 'morte');
        cena.aviso(t('O item regrediu!'), '#ff5050');
      } else log(t('A forja não deu certo{tent}... {item} continua igual.', { tent, item: d.nome }) + custo + (r.parou ? ' ' + t('O ouro acabou.') : ''), 'morte');
      if (r.gemas) log(t('Runas usadas: {n}× {gema}.', { n: r.gemas, gema: M.nomeGema(gemaUsada) }), 'npc');
      if (r.protegeu) log(t('A Runa de Proteção segurou o item no nível {n} vez(es).', { n: r.protegeu }), 'raro');
    }
    mostrarForja(); atualizarUI();
    // deu certo: explosão de luz na bigorna, na cor do novo nível de refino
    if (r?.sucesso) { const b = document.querySelector('[data-bigorna]'); if (b) { b.dataset.nivelForja = M.refinoDe(r.item); b.classList.add('forja-sucesso'); setTimeout(() => b.classList.remove('forja-sucesso'), 1300); } }
    return;
  }
  if (e.target.closest('[data-trocar-tarefas]')) { M.trocarOfertas(estado); mostrarTarefas(); return; }      // Outras tarefas (de 10 em 10 min)
  const bDiaria = e.target.closest('[data-aceitar-diaria]');
  if (bDiaria) {
    const k = bDiaria.dataset.aceitarDiaria === 'rift' ? 'rift' : 'runeterra', qtd = inteiro(M.DIARIAS[k].regra.qtd);
    if (M.aceitarDiaria(estado, k)) {
      log(k === 'rift' ? t("Missão diária: abata {qtd} monstros caçando no Summoner's Rift (do seu nível ou até 5 abaixo).", { qtd })
        : t('Missão diária: abata {qtd} monstros em Runeterra (do seu nível ou até 5 abaixo).', { qtd }), 'chefe');
      mostrarDiaria();
    }
    atualizarUI(); return;
  }
  const tf = e.target.closest('[data-tarefa]');
  if (tf) {
    if (M.aceitarTarefa(estado, +tf.dataset.tarefa)) {
      const tar = estado.tarefa;
      log(t('Nova tarefa: abater {qtd} {monstro} ({lugar}).', { qtd: tar.qtd, monstro: alvoTarefa(tar), lugar: M.LOCAL[tar.local].nome }), 'chefe');
      $('#npc-troca').innerHTML = '';
      dizer('tchau');
    }
    atualizarUI(); return;
  }
  const c = e.target.closest('[data-comprar]');
  if (c) {
    const k = c.dataset.comprar, qtd = Math.max(1, Math.floor(+$(`[data-qtd="${k}"]`).value || 1));
    qtdPocao[k] = qtd;
    const n = M.comprarPocao(estado, k, qtd);
    if (n) som.efeito('compra');
    log(n ? t('Você comprou {n}× {pocao} por {preco} de ouro.', { n, pocao: M.POCOES[k].nome, preco: n * M.POCOES[k].preco }) : t('Ouro insuficiente.'), n ? 'item' : 'morte');
    // o ouro não deu para todas: avisa na tela (antes comprava menos sem dizer)
    if (n && n < qtd) { const msg = t('Seu ouro deu para {n} de {qtd}.', { n, qtd }); log(msg, 'morte'); cena.aviso(msg, '#ffb060'); }
    mostrarTroca('comprar');
  }
  atualizarUI();
});

// dica de uma habilidade: o que faz agora e o que muda no próximo rank
function dicaHab(hk) {
  const h = HABS[hk], r = estado.ranks[hk] || 0, lim = M.rankMaximoNoNivel(estado, hk);
  const linhas = (l) => l.map(([k, v]) => `  ${k}: ${v}`).join('\n');
  let s = `${h.nome}${h.passiva ? t(' (passiva)') : ''} — ${t('rank {r}/{max}', { r, max: h.max })}\n${h.desc}`;
  if (r) s += `\n\n${t('Agora (rank {r}):', { r })}\n${linhas(M.efeitosRank(hk, r, estado))}`;
  if (r < h.max) {
    const atual = Object.fromEntries(M.efeitosRank(hk, r, estado));
    s += `\n\n${t('Próximo rank ({r}):', { r: r + 1 })}\n` + M.efeitosRank(hk, r + 1, estado).map(([k, v]) => `  ${k}: ${atual[k] && atual[k] !== v ? atual[k] + ' → ' : ''}${v}`).join('\n');
  }
  if (r >= h.max) s += '\n\n' + t('Rank máximo.');
  else if (estado.nivel < h.nivel) s += '\n\n' + t('Libera no nível {n}.', { n: h.nivel });
  else if (r >= lim) s += '\n\n' + t('Seu nível permite até o rank {lim}. Suba de nível para fortalecer mais.', { lim });
  else if (estado.pontos <= 0) s += '\n\n' + t('Sem pontos livres: ganhe 1 por nível, ou compre o Reset de habilidades na Loja (aba Mercado).');
  return s;
}

// ---------- painéis ----------
// a descrição de uma habilidade (aba Habilidades e barra de baixo; no celular aparece segurando o dedo)
function descricaoHab(hk) {
    const h = HABS[hk];
    if (hk === 'P') return `${KIT.dados.habilidades.P.nome}${t(' (passiva)')} — ${KIT.dados.habilidades.P.descricao}`;
    return `${h.nome}${h.passiva ? t(' (passiva)') : ''} — ${h.desc}${h.custo ? '\n' + t('Custo: {min}–{max} de mana', { min: h.custo[0], max: h.custo[h.custo.length - 1] }) : ''}${h.recarga ? ' · ' + t('recarga {min}–{max}s', { min: h.recarga[h.recarga.length - 1], max: h.recarga[0] }) : ''}\n${t('Libera no nível {n}.', { n: h.nivel })}`.replace(/"/g, '&quot;');
}
function montarPaineis() {
  const descHab = descricaoHab;
  const passiva = (hk) => hk === 'P' || HABS[hk]?.passiva;
  const cartaoHab = (hk) => `
    <div class="hab${hk === 'P' || HABS[hk]?.passiva ? ' passiva' : ''}" data-t="${hk}" title="${descHab(hk)}">
      <div class="icone"><img src="${iconeHab(hk)}" alt="${hk}"><div class="recarga"></div>${hk === 'P' ? '' : '<span class="trava"></span>'}</div>
      ${hk === 'P' ? '' : '<div class="rank"><i></i><span></span></div><button class="mais">+</button>'}
    </div>`;
  $('#hab-ativas').innerHTML = M.ORDEM_HAB.filter((hk) => !passiva(hk)).map(cartaoHab).join('');
  $('#hab-passivas').innerHTML = ['P', ...M.ORDEM_HAB.filter((hk) => passiva(hk))].map(cartaoHab).join('');
  $('#habilidades').addEventListener('click', (e) => {
    const h = e.target.closest('.hab'); if (!h || h.dataset.t === 'P') return;
    const hk = h.dataset.t;
    if (dgVendo) { cena.aviso(t('Durante a luta da Dungeon as habilidades ficam como estavam no começo. Troque depois da luta.'), '#ffb070'); return; }      // a luta usa a cópia do começo (p728)
    if (e.target.closest('.mais')) { M.subirHabilidade(estado, hk); atualizarUI(); return; }
    if (HABS[hk].passiva) { log(t('{hab} é passiva: funciona sozinha, não precisa estar na barra.', { hab: HABS[hk].nome }), 'npc'); return; }
    if (!estado.ranks[hk]) { log(t('Aprenda {hab} primeiro (botão + , a partir do nível {n}).', { hab: HABS[hk].nome, n: HABS[hk].nivel }), 'morte'); return; }
    if (M.alternarBarra(estado, hk)) { trocando = null; log(estado.barra.includes(hk) ? t('{hab} foi para a barra.', { hab: HABS[hk].nome }) : t('{hab} saiu da barra.', { hab: HABS[hk].nome }), 'item'); }
    else {
      // barra cheia: escolhe qual habilidade da barra vai sair
      trocando = trocando === hk ? null : hk;
      if (trocando) log(t('Agora clique na habilidade da barra que {hab} vai substituir.', { hab: HABS[hk].nome }), 'npc');
    }
    atualizarUI();
  });
  $('#barra').addEventListener('click', (e) => {
    const h = e.target.closest('.hab[data-t]'); if (!h) return;
    if (dgVendo) { cena.aviso(t('Durante a luta da Dungeon as habilidades ficam como estavam no começo. Troque depois da luta.'), '#ffb070'); return; }      // (p728)
    const k = [...$('#barra').children].indexOf(h), sai = h.dataset.t;
    if (trocando && M.trocarNaBarra(estado, k, trocando)) log(t('{hab} entrou na barra no lugar de {sai}.', { hab: HABS[trocando].nome, sai: HABS[sai].nome }), 'item');
    else { M.alternarBarra(estado, sai); log(t('{hab} saiu da barra.', { hab: HABS[sai].nome }), 'item'); }
    trocando = null; barraDesenhada = null; atualizarUI();
  });

  $('#atributos').innerHTML = Object.entries(M.atributosDe(estado)).map(([k, at]) => `
    <div class="atrib" title="${at.nome}\n${at.serve}\n${t('Cada ponto: {efeito}.', { efeito: at.efeito })}\n\n${t('Shift + clique coloca 10 pontos.')}">
      <span class="atrib-nome">${at.nome}</span><b data-valor="${k}"></b><button data-atrib="${k}" aria-label="${t('Colocar 1 ponto em {atributo}', { atributo: at.nome })}">+</button>
      <small class="atrib-total" data-total="${k}"></small>
    </div>`).join('');
  $('#atributos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-atrib]'); if (!b) return;
    M.subirAtributo(estado, b.dataset.atrib, e.shiftKey ? 10 : 1); atualizarUI();
  });
  // atributos e habilidades: o jogador escolhe (o automático saiu em out/2026, a pedido do dono)
  estado.modelo = ''; estado.autoHab = false;
  // não pegar itens básicos (pedido dos jogadores: a mochila enche menos)
  $('#ignorar-basicos').checked = !!estado.ignorarBasicos;
  $('#ignorar-basicos').addEventListener('change', (e) => {
    estado.ignorarBasicos = e.target.checked;
    log(e.target.checked ? t('Itens básicos agora ficam no chão: só épicos, lendários, espólios e runas vão para a mochila.') : t('Itens básicos voltam a ir para a mochila.'), 'item');
  });

  $('#pocoes').innerHTML = Object.entries(M.POCOES).map(([k, p], i) =>
    `<button class="pocao" data-pocao="${k}" title="${t('{pocao}: recupera {cura} de {tipo}', { pocao: p.nome, cura: p.cura, tipo: t(p.tipo) })}${p.nivel > 1 ? t(' (nível {n}+)', { n: p.nivel }) : ''}\n${t('Tecla {n}', { n: nomeTecla(teclas.pocao[i]) })}"><img src="${frasco(ICONE_POCAO[k])}" alt=""><b></b><span class="tecla-pocao">${nomeTecla(teclas.pocao[i])}</span></button>`).join('');
  $('#pocoes').addEventListener('click', (e) => { const b = e.target.closest('[data-pocao]'); if (b) usarPocaoJogador(b.dataset.pocao); });
  $('#hud-pocoes').innerHTML = Object.entries(M.POCOES).map(([k, p], i) =>
    `<button type="button" class="hud-pocao" data-pocao="${k}" title="${t('{pocao}: recupera {cura} de {tipo}', { pocao: p.nome, cura: p.cura, tipo: t(p.tipo) })}${p.nivel > 1 ? t(' (nível {n}+)', { n: p.nivel }) : ''}\n${t('Tecla {n}', { n: nomeTecla(teclas.pocao[i]) })}"><img src="${frasco(ICONE_POCAO[k])}" alt=""><b></b><span>${nomeTecla(teclas.pocao[i])}</span></button>`).join('');
  $('#hud-pocoes').addEventListener('click', (e) => { const b = e.target.closest('[data-pocao]'); if (b) { usarPocaoJogador(b.dataset.pocao); b.blur(); } });
  // habilidades da barra de baixo: em Runeterra, clicar solta a habilidade (como a tecla)
  $('#hud-habs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { apertarHabilidade(b.dataset.t); b.blur(); } });
  $('#rastreio-vilemaw').addEventListener('click', (e) => { e.currentTarget.blur(); if (vmInfo?.ativo && !localAtual().arena) $('#ir-runeterra').click(); });
  for (const k of ['rift', 'runeterra']) $(k === 'rift' ? '#rastreio-diaria-rift' : '#rastreio-diaria').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (M.diariaPronta(estado, k)) receberDiaria(k);
    else if (estado[M.DIARIAS[k].campo] && !M.DIARIAS[k].aqui(estado)) $(k === 'rift' ? '#abrir-mapa' : '#ir-runeterra').click();      // fora do lugar: leva para lá
  });
  $('#rastreio-tarefa').addEventListener('click', (e) => { e.currentTarget.blur(); if (estado.tarefa && M.tarefaPronta(estado) && M.naBase(estado)) falarCom('Capitão da Legião'); });

  const ligar = (sel, campo, conv = (x) => x) => $(sel).addEventListener('input', (e) => {
    estado.auto[campo] = conv(e.target.type === 'checkbox' ? e.target.checked : +e.target.value); atualizarUI();
  });
  ligar('#auto-vida', 'vida'); ligar('#auto-mana', 'mana');
  ligar('#lim-vida', 'limiarVida', (v) => v / 100); ligar('#lim-mana', 'limiarMana', (v) => v / 100);
  $('#auto-vida').checked = estado.auto.vida; $('#auto-mana').checked = estado.auto.mana;
  $('#lim-vida').value = Math.round(estado.auto.limiarVida * 100); $('#lim-mana').value = Math.round(estado.auto.limiarMana * 100);
  for (const [sel, campo] of [['#auto-qual-vida', 'pocaoVida'], ['#auto-qual-mana', 'pocaoMana']]) {      // qual poção o automático usa (p695)
    const el = $(sel); el.value = Object.hasOwn(M.POCOES, estado.auto[campo] || '') ? estado.auto[campo] : '';
    el.addEventListener('change', () => { estado.auto[campo] = Object.hasOwn(M.POCOES, el.value) ? el.value : ''; atualizarUI(); });
  }

  const r = estado.rotina;
  $('#rot-mochila').checked = r.mochila; $('#rot-pocoes').checked = r.pocoes;
  $('#rot-mochila').addEventListener('change', (e) => (r.mochila = e.target.checked));
  $('#rot-pocoes').addEventListener('change', (e) => (r.pocoes = e.target.checked));

  // uma linha: o primeiro espaço é só da bota, os outros 4 para os demais itens
  $('#equip').innerHTML = '<button class="slot bota-slot"></button>' + '<button class="slot"></button>'.repeat(M.ESPACOS_ITENS);
  $('#equip').addEventListener('click', (e) => {
    const s = e.target.closest('.slot'); if (!s) return;
    const id = equipNaOrdem()[[...s.parentElement.children].indexOf(s)];
    if (id) guardarEquipado(id);
  });
  $('#mochila').innerHTML = '<button class="slot"></button>'.repeat(M.MOCHILA);
  $('#mochila').addEventListener('click', (e) => {
    const s = e.target.closest('.slot'); if (!s) return;
    equiparDaMochila([...s.parentElement.children].indexOf(s));
  });
}
function guardarEquipado(id) {
  if (M.desequipar(estado, estado.itens.indexOf(id))) log(t('Você guardou {item} na mochila.', { item: descreverItem(id).nome }), 'item');
  else log(t('Sua mochila está cheia.'), 'morte');
  atualizarUI();
}
function equiparDaMochila(k) {
  const id = estado.mochila[k];
  if (!id) return;
  const antes = M.espacoDe(id) === 'botas' ? estado.itens.find((x) => M.espacoDe(x) === 'botas') : null;      // bota troca com bota
  if (M.equipar(estado, k)) log(antes ? t('Você equipou {item} no lugar de {antigo}, que foi para a mochila.', { item: descreverItem(id).nome, antigo: descreverItem(antes).nome }) : t('Você equipou {item}.', { item: descreverItem(id).nome }), 'item');
  else log(!M.temAtributo(id) ? t('{item} não dá atributos: serve só para montar outros itens no Ornn.', { item: descreverItem(id).nome }) : estado.itens.filter((x) => !M.ehBota(x)).length >= M.ESPACOS_ITENS ? t('Seus 4 espaços de itens estão ocupados (o 5º é só para bota). Clique num item equipado para guardá-lo.') : t('Você já tem esse item lendário equipado.'), 'morte');
  atualizarUI();
}

const miniaturas = new Map();
function miniatura(nome) {
  if (miniaturas.has(nome)) return miniaturas.get(nome);
  const s = sprite(nome, DIR.S, 0), c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, 32, 32);
  const url = c.toDataURL(); miniaturas.set(nome, url); return url;
}
const corVida = (f) => (f > 0.92 ? '#00c000' : f > 0.6 ? '#60c060' : f > 0.3 ? '#c0c000' : f > 0.1 ? '#c03030' : '#c00000');

// pilhas de espólios como entradas da mochila: "esp:pele-lobo:37"
function pilhasEspolios() {
  const r = [];
  for (const [id, q] of Object.entries(estado.espolios || {})) for (let resto = q; resto > 0; resto -= M.PILHA) r.push(`esp:${id}:${Math.min(M.PILHA, resto)}`);
  return r;
}
const slotEspolio = (chave) => {
  const [, id, q] = chave.split(':'), p = M.ESPOLIOS[id];
  return { html: `<img class="pixel" src="${iconeEspolio(id, p.cor)}" alt=""><span class="qtd">${q}</span>`,
    titulo: `${p.nome} ×${q}\n${t('Espólio: o Lojista compra por {valor} de ouro cada ({total} esta pilha).', { valor: fmt(p.valor), total: fmt(p.valor * q) })}\n${t('Empilha até {n} por espaço.', { n: M.PILHA })}` };
};
// o equipamento na ordem da tela: a bota primeiro (ou um espaço vazio), depois os outros itens
const equipNaOrdem = () => [estado.itens.find(M.ehBota) || '', ...estado.itens.filter((x) => !M.ehBota(x))];
function preencherSlots(sel, lista, semDica = false, comparar = false) {
  const equipado = comparar ? estado.itens.join(',') : '';
  document.querySelectorAll(`${sel} .slot`).forEach((s, k) => {
    const id = lista[k];
    // com a comparação, a dica muda também quando o equipamento muda
    if ((s.dataset.id || '') === (id || '') && (!comparar || s.dataset.cmp === equipado)) return;
    s.dataset.id = id || ''; s.dataset.cmp = equipado;
    if (id?.startsWith('esp:')) { const e = slotEspolio(id); s.className = 'slot espolio-slot'; s.innerHTML = e.html; s.title = e.titulo; return; }
    if (id?.startsWith('tranca:')) { const n = id.slice(7); s.className = 'slot trancado'; s.innerHTML = `<span aria-hidden="true">🔒</span><small>${t('Nv {n}', { n })}</small>`; s.title = t('Espaço da mochila que libera no nível {n}', { n }); return; }
    s.className = 'slot' + (id ? ' ' + M.raridade(M.infoItem(id)) : '');
    s.innerHTML = id ? `<img src="${imgItem(id)}" alt="">${rotuloRef(id)}` : '';
    s.title = id && !semDica ? textoItem(id) + (comparar ? textoComparacao(id) : '') : '';
  });
}
// a comparação com o equipado, em texto (dica da mochila na aba Itens): a diferença de cada atributo e o Poder
function textoComparacao(id) {
  if (!M.temAtributo(id) || M.pendente(id)) return '';
  const i = M.infoItem(id), alvo = alvoDaComparacao(id), ia = alvo ? M.infoItem(alvo) : null;
  const difs = ATRIB_COMP.map(([k, nome, f]) => { const dif = (i[k] || 0) - (ia?.[k] || 0); return Math.abs(dif) < 1e-9 ? null : `${dif > 0 ? '+' : '−'}${numComp(Math.abs(dif), f)} ${t(nome)}`; }).filter(Boolean);
  const depois = alvo ? estado.itens.map((x) => (x === alvo ? id : x)) : [...estado.itens, id];
  const pa = M.poder(estado), pd = M.poder({ nivel: estado.nivel, itens: depois });
  return '\n\n' + (alvo ? t('Comparado com o equipado: {item}', { item: descreverItem(alvo).nome }) : t('Você tem um espaço livre para ele.'))
    + (difs.length ? '\n' + difs.join('\n') : '') + '\n' + t('Poder: {a} → {b}', { a: inteiro(pa), b: inteiro(pd) });
}

// ---------- janela de itens (pedido de jogador): equipados em cima, a mochila embaixo e a comparação ao lado ----------
// abre pelos itens da barra de baixo, pelo botão da mochila ou pela tecla I. Clicar num item da mochila equipa; com os 4
// espaços cheios, troca pelo equipado que está sendo comparado. Clicar num equipado guarda na mochila.
let bolsaAlvo = null;         // o equipado escolhido para comparar (o último com o mouse em cima)
const poderItem = (x) => Math.round((M.ITENS[M.baseId(x)]?.preco || 0) * (1 + M.BONUS_REFINO * M.refinoDe(x)) * (M.QUALIDADES[M.qualidadeDe(x)]?.mult || 1) / 10);
const ATRIB_COMP = [
  ['ad', 'Dano de Ataque', 1], ['ap', 'Poder de Habilidade', 1], ['vida', 'Vida', 0], ['mana', 'Mana', 0], ['armadura', 'Armadura', 1], ['rm', 'Resistência Mágica', 1],
  ['va', 'Velocidade de Ataque', '%'], ['critico', 'Chance de Crítico', '%'], ['rv', 'Roubo de Vida', '%'], ['regen', 'Vida por segundo', 1], ['cdr', 'Redução de recarga', '%'],
];
const numComp = (v, f) => (f === '%' ? `${Math.round(v * 100)}%` : f ? String(+v.toFixed(1)).replace('.', ingles ? '.' : ',') : inteiro(v));
// com quem um item da mochila seria comparado (e trocado, se os espaços estiverem cheios)
function alvoDaComparacao(id) {
  if (M.ehBota(id)) return estado.itens.find(M.ehBota) || null;
  const outros = estado.itens.filter((x) => !M.ehBota(x));
  const igual = M.ITENS[M.baseId(id)]?.lendario && outros.find((x) => M.baseId(x) === M.baseId(id));
  if (igual) return igual;                                       // o mesmo lendário só pode uma vez: compara com ele
  if (outros.length < M.ESPACOS_ITENS) return null;              // tem espaço livre
  return outros.includes(bolsaAlvo) ? bolsaAlvo : [...outros].sort((a, b) => poderItem(a) - poderItem(b))[0];
}
function abrirBolsa() {
  dicaDeToque('mochila');
  const j = $('#janela-bolsa');
  if (!j.hidden) { j.hidden = true; return; }
  if (!$('#bolsa-equip').children.length) {
    $('#bolsa-equip').innerHTML = '<button class="slot bota-slot"></button>' + '<button class="slot"></button>'.repeat(M.ESPACOS_ITENS);
    $('#bolsa-mochila').innerHTML = '<button class="slot"></button>'.repeat(M.MOCHILA);
  }
  bolsaAlvo = null;
  j.hidden = false;
  atualizarBolsa();
  detalheBolsa(null);
}
function atualizarBolsa() {
  if ($('#janela-bolsa').hidden) return;
  preencherSlots('#bolsa-equip', equipNaOrdem(), true);
  const bota = $('#bolsa-equip .bota-slot');
  if (bota && !bota.dataset.id) { bota.innerHTML = `<svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><path d="M3 1h4v6h3v1h1v3H3V8H2V7h1z"/></svg><small>${t('Botas')}</small>`; }
  const cap = M.mochilaDe(estado.nivel), lista = [...estado.mochila, ...pilhasEspolios()];
  for (let k = cap; k < M.MOCHILA; k++) lista[k] = 'tranca:' + M.nivelDoEspaco(k);
  preencherSlots('#bolsa-mochila', lista, true);
  document.querySelectorAll('#bolsa-mochila .slot').forEach((b, k) => { b.hidden = k >= cap + M.MOCHILA_GANHO.espacos; });
  document.querySelectorAll('#bolsa-equip .slot').forEach((b) => b.classList.toggle('alvo-comp', !!b.dataset.id && b.dataset.id === bolsaAlvo));
  const usados = cap - M.espacosLivres(estado), poder = inteiro(M.poder(estado));
  const resumo = t('Mochila {usados}/{total} · Poder {poder}', { usados, total: cap, poder });
  if ($('#bolsa-qtd').textContent !== resumo) $('#bolsa-qtd').textContent = resumo;
}
// o painel da direita: o item com o mouse em cima, comparado com o equipado (na mochila) e o que o clique faz
function detalheBolsa(slot) {
  const el = $('#bolsa-detalhe'), id = slot?.dataset.id || '';
  if (!id) { el.innerHTML = `<p class="fraco">${t('Passe o mouse num item para ver os atributos. Num item da mochila, aparece a comparação com o equipado.')}</p>`; return; }
  if (id.startsWith('esp:') || id.startsWith('tranca:')) { el.innerHTML = `<p class="fraco">${(id.startsWith('esp:') ? slotEspolio(id).titulo : t('Espaço da mochila que libera no nível {n}', { n: id.slice(7) })).replace(/\n/g, '<br>')}</p>`; return; }
  const naMochila = !!slot.closest('#bolsa-mochila');
  if (!naMochila && !M.ehBota(id)) { bolsaAlvo = id; document.querySelectorAll('#bolsa-equip .slot').forEach((b) => b.classList.toggle('alvo-comp', b.dataset.id === id)); }
  const i = M.infoItem(id), d = descreverItem(id), alvo = naMochila ? alvoDaComparacao(id) : null, ia = alvo ? M.infoItem(alvo) : null;
  const linhas = ATRIB_COMP.filter(([k]) => i[k] || ia?.[k]).map(([k, nome, f]) => {
    const v = i[k] || 0, w = ia ? ia[k] || 0 : 0, dif = v - w, sinal = Math.abs(dif) < 1e-9 ? '' : dif > 0 ? 'mais' : 'menos';
    return `<tr><th>${t(nome)}</th><td>${v ? numComp(v, f) : '—'}</td>${naMochila ? `<td>${w ? numComp(w, f) : '—'}</td><td class="${sinal}">${sinal ? (dif > 0 ? '+' : '−') + numComp(Math.abs(dif), f) : '='}</td>` : ''}</tr>`;
  }).join('');
  let acao = '', poderTxt = '';
  if (!naMochila) acao = t('Clique para guardar na mochila.');
  else if (M.pendente(id)) acao = t('O servidor ainda está avaliando a qualidade deste item.');
  else if (!M.temAtributo(id)) acao = t('Não dá atributos: serve só para montar outros itens no Ornn.');
  else {
    const depois = alvo ? estado.itens.map((x) => (x === alvo ? id : x)) : [...estado.itens, id];
    const pa = M.poder(estado), pd = M.poder({ nivel: estado.nivel, itens: depois });
    poderTxt = `<p class="bolsa-poder">${t('Poder')}: ${inteiro(pa)} → <b class="${pd > pa ? 'mais' : pd < pa ? 'menos' : ''}">${inteiro(pd)}</b> (${pd >= pa ? '+' : '−'}${inteiro(Math.abs(pd - pa))})</p>`;
    acao = alvo ? t('Clique para equipar no lugar de {item}.', { item: descreverItem(alvo).nome }) : t('Clique para equipar.');
  }
  const efeito = (x, nome) => x.efeito ? `<p class="bolsa-efeito"><b>${nome}</b> ${x.efeito}</p>` : '';
  el.innerHTML = `<div class="bolsa-topo"><span class="slot ${d.raridade}"><img src="${imgItem(id)}" alt="">${rotuloRef(id)}</span>
      <div><b class="cor-${d.raridade}">${d.nome}</b><small>${M.NOME_RARIDADE[d.raridade]}${i.espaco === 'botas' ? ' · ' + t('Botas') : ''} · ${t('{valor} de ouro no Lojista', { valor: inteiro(M.valorVenda(id)) })}</small></div></div>
    ${naMochila ? `<p class="bolsa-vs">${alvo ? t('Comparando com o equipado: {item}', { item: `<b class="cor-${descreverItem(alvo).raridade}">${descreverItem(alvo).nome}</b>` }) : t('Você tem um espaço livre para ele.')}</p>` : ''}
    ${linhas ? `<table class="bolsa-comp"><thead><tr><th></th><th>${naMochila ? t('Este') : t('Atributo')}</th>${naMochila ? `<th>${t('Equipado')}</th><th>${t('Diferença')}</th>` : ''}</tr></thead><tbody>${linhas}</tbody></table>` : ''}
    ${efeito(i, d.nome)}${ia ? efeito(ia, descreverItem(alvo).nome) : ''}${poderTxt}
    <p class="bolsa-acao">${acao}</p>
    ${naMochila && !M.ehBota(id) && alvo && estado.itens.filter((x) => !M.ehBota(x)).length >= M.ESPACOS_ITENS ? `<p class="fraco bolsa-dica">${t('Para comparar com outro, passe o mouse no equipado que quer trocar.')}</p>` : ''}`;
}
$('#janela-bolsa').addEventListener('mouseover', (e) => { const s = e.target.closest('#bolsa-equip .slot, #bolsa-mochila .slot'); if (s && s !== detalheBolsa.ultimo) { detalheBolsa.ultimo = s; detalheBolsa(s); } });
$('#janela-bolsa').addEventListener('click', (e) => {
  const s = e.target.closest('#bolsa-equip .slot, #bolsa-mochila .slot'); if (!s) return;
  const naMochila = !!s.closest('#bolsa-mochila'), k = [...s.parentElement.children].indexOf(s);
  if (!naMochila) { const id = equipNaOrdem()[k]; if (id) { guardarEquipado(id); if (bolsaAlvo === id) bolsaAlvo = null; } }
  else {
    const id = estado.mochila[k], alvo = id && M.temAtributo(id) && !M.pendente(id) ? alvoDaComparacao(id) : null;
    // espaços cheios (ou o mesmo lendário): troca pelo equipado comparado
    if (alvo && !M.ehBota(id) && M.trocarItem(estado, k, estado.itens.indexOf(alvo))) {
      log(t('Você equipou {item} no lugar de {antigo}, que foi para a mochila.', { item: descreverItem(id).nome, antigo: descreverItem(alvo).nome }), 'item');
      if (bolsaAlvo === alvo) bolsaAlvo = id;
      atualizarUI();
    } else equiparDaMochila(k);
  }
  detalheBolsa(s);
});
$('#hud-equip').addEventListener('click', abrirBolsa);
$('#hud-bolsa').addEventListener('click', abrirBolsa);
$('#hud-mapa').addEventListener('click', () => $('#abrir-mapa').click());
$('#hud-voltar').addEventListener('click', () => $('#voltar-base').click());
// os itens equipados em miniatura na barra de baixo
let hudEquipDesenhado = null;
function atualizarHudItens() {
  const lista = equipNaOrdem(), chave = lista.join('|');
  if (chave !== hudEquipDesenhado) {
    hudEquipDesenhado = chave;
    $('#hud-equip').innerHTML = lista.concat(Array(M.ESPACOS - lista.length).fill('')).slice(0, M.ESPACOS)
      .map((x, k) => (x ? `<i class="${M.raridade(M.infoItem(x))}"><img src="${imgItem(x)}" alt="">${M.refinoDe(x) ? `<b>+${M.refinoDe(x)}</b>` : ''}</i>` : `<i class="vazio${k === 0 ? ' bota' : ''}"></i>`)).join('');
  }
  const cap = M.mochilaDe(estado.nivel), usados = cap - M.espacosLivres(estado), n = `${usados}/${cap}`;
  if ($('#hud-bolsa-n').textContent !== n) $('#hud-bolsa-n').textContent = n;
  $('#hud-bolsa').classList.toggle('cheia', usados >= cap);
  $('#hud-voltar').disabled = $('#voltar-base').disabled;
  $('#hud-mapa').disabled = $('#abrir-mapa').disabled;
}

let barraDesenhada = '';
let trocando = null;          // habilidade escolhida para entrar na barra cheia
// a tecla de cada espaço da barra (em Runeterra o 2º espaço é o Espaço)
function teclaDe(t) {
  const k = estado.barra.indexOf(t);
  return k < 0 ? '' : ROTULO_ESPACO[k];      // em qualquer lugar, a tecla escolhida nas Configurações (p724; antes só em Runeterra)
}
function desenharBarra() {
  const chave = estado.barra.join(',') + (localAtual().arena ? ':arena' : '');
  if (chave !== barraDesenhada && localAtual().arena) ajustarTela();      // reposiciona PK/Alcance embaixo do minimapa
  $('#bt-alcance').hidden = !localAtual().arena;
  $('#bt-campeoes').hidden = !localAtual().arena;
  $('#bt-pk').hidden = !localAtual().arena;
  $('#mini-zoom').hidden = !localAtual().arena;
  $('#bt-grupo').hidden = !localAtual().arena;
  $('#bt-montaria').hidden = !localAtual().arena;
  if (!localAtual().arena) { $('#grupo-hud').hidden = true; $('#grupo-painel').hidden = true; $('#grupo-convite').hidden = true; }
  if (chave === barraDesenhada) return;
  barraDesenhada = chave;
  $('#barra').innerHTML = Array.from({ length: M.BARRA }, (_, k) => {
    const hk = estado.barra[k];
    const tk = hk && teclaDe(hk);
    return hk ? `<div class="hab" data-t="${hk}" title="${HABS[hk].nome} — ${t('clique para tirar da barra')}"><div class="icone"><img src="${iconeHab(hk)}" alt=""><div class="recarga"></div>${tk ? `<span class="tecla-hab">${tk}</span>` : ''}</div></div>`
      : '<div class="vaga"><div class="icone"></div></div>';
  }).join('');
  $('#hud-habs').innerHTML = Array.from({ length: M.BARRA }, (_, k) => {
    const hk = estado.barra[k], tk = hk && teclaDe(hk);
    return hk ? `<button type="button" class="hud-hab" data-t="${hk}" title="${descricaoHab(hk)}"><img src="${iconeHab(hk)}" alt=""><i class="hud-cd"></i><em></em>${tk ? `<span>${tk}</span>` : ''}<b></b></button>`
      : '<span class="hud-hab vazia"></span>';
  }).join('');
}

// ---------- efeitos ativos: as habilidades com duração (e os acúmulos) em cima da barra de baixo, como no LoL ----------
// [tecla, quanto tempo ainda falta, acúmulos]; o que não é do campeão fica sempre em 0 e não aparece
const BUFFS = [
  ['P', (d) => d.poder], ['G', (d) => d.grito], ['F', (d) => Math.max(d.furiaS || 0, d.banho || 0)], ['B', (d) => d.estandarte], ['N', (d) => d.dominio?.t],      // Darius (e o G da Lux)
  ['P', (d) => d.forca, (d) => d.forcaAcum], ['G', (d) => d.arrogancia], ['F', (d) => d.sobrecarga], ['N', (d) => d.apogeu],                                  // Ezreal
  ['B', (d) => d.farol],                                                                                                                                      // Lux
  ['G', (d) => d.ventania], ['W', (d) => d.vento], ['F', (d) => d.fantasma], ['R', (d) => d.suspiro], ['D', (d) => d.inquieta, (d) => d.inquietaAcum], ['N', (d) => d.danca?.t],      // Yasuo
  ['G', (d) => d.sede], ['F', (d) => d.veneno], ['B', (d) => d.sombraPronta], ['D', (d) => d.sinistra, (d) => d.sinistraAcum],                                // Katarina
  ['P', (d) => (CAMP === 'taric' && d.bravata > 0 ? d.bravataT : 0), (d) => d.bravata], ['G', (d) => d.diamante],                                          // Taric
  ['R', (d) => (CAMP === 'taric' ? d.invulneravel || d.radiancia?.t : 0)],
  ['G', (d) => (CAMP === 'zac' ? d.membrana : 0)], ['D', (d) => (CAMP === 'zac' ? d.absorcao : 0), (d) => d.absorcaoAcum], ['R', (d) => (CAMP === 'zac' ? d.quique?.t : 0)],      // Zac
  ['M', (d) => (CAMP === 'zac' ? d.mitose?.t : 0)], ['B', (d) => (CAMP === 'zac' ? d.regenZ?.t : 0)], ['P', (d) => (CAMP === 'zac' ? d.timers?.divisao : 0)],
  ['R', (d, A) => d.lotus?.t || (A?.lotus ? A.lotus.ate - A.tempo : 0)], ['N', (d, A) => d.tempestade?.t || (A?.tempestadeAte > A?.tempo ? A.tempestadeAte - A.tempo : 0)],
];
const duracaoBuff = {};       // o maior tempo visto desde que o efeito começou (para o círculo que vai fechando)
let buffsDesenhados = '';
function atualizarBuffs(d) {
  const A = M.LOCAL[estado.local]?.arena ? combate.arena : null, ativos = new Map();
  for (const [k, resta, acum] of BUFFS) {
    if (!HABS[k] || !(estado.ranks[k] > 0 || k === 'P')) continue;
    const r = Number(resta(d, A)) || 0;
    if (r <= 0.05) continue;
    const atual = ativos.get(k);
    if (!atual || r > atual.r) ativos.set(k, { r, n: acum ? acum(d) || 0 : 0 });
  }
  for (const k of Object.keys(duracaoBuff)) if (!ativos.has(k)) delete duracaoBuff[k];
  const chave = [...ativos.keys()].join('');
  const caixa = $('#hud-buffs');
  if (chave !== buffsDesenhados) {
    buffsDesenhados = chave;
    caixa.innerHTML = [...ativos.keys()].map((k) => `<span class="hud-buff" data-t="${k}" title="${HABS[k].nome}"><img src="${iconeHab(k)}" alt=""><i class="hud-cd"></i><em></em><b></b></span>`).join('');
  }
  for (const el of caixa.children) {
    const k = el.dataset.t, b = ativos.get(k); if (!b) continue;
    if (!duracaoBuff[k] || b.r > duracaoBuff[k] + 0.25) duracaoBuff[k] = b.r;        // começou de novo (ou foi renovado)
    el.style.setProperty('--cd', Math.min(1, Math.max(0, 1 - b.r / duracaoBuff[k])).toFixed(3));
    const seg = b.r >= 1 ? String(Math.ceil(b.r)) : '', n = b.n > 1 ? String(b.n) : '';
    const em = el.querySelector('em'), bb = el.querySelector('b');
    if (em.textContent !== seg) em.textContent = seg;
    if (bb.textContent !== n) bb.textContent = n;
  }
}
// ---------- barra de baixo (HUD), experiência e quadro de missões ----------
// itens com recarga (o relógio em combate.darius.timers e quanto ela dura): o círculo e os segundos na barra de baixo
const RECARGA_ITEM = { 3157: ['zhonya', 120], 3053: ['sterak', 90], 3026: ['anjo', 300], 3102: ['banshee', 40], 6655: ['luden', 6], 3742: ['couraca', 4], 6631: ['quebra', 5] };
function atualizarRecargaItens(d) {
  const caixa = $('#hud-equip'); if (!caixa || !d?.timers) return;
  const lista = equipNaOrdem();
  caixa.querySelectorAll(':scope > i').forEach((el, k) => {
    const r = lista[k] && RECARGA_ITEM[M.baseId(lista[k])], falta = r ? Math.max(0, d.timers[r[0]] || 0) : 0;
    let cd = el.querySelector(':scope > .hud-cd');
    if (falta < 0.05) { if (cd) { cd.remove(); el.querySelector(':scope > em')?.remove(); el.classList.remove('em-recarga'); } return; }
    if (!cd) { cd = Object.assign(document.createElement('span'), { className: 'hud-cd' }); el.append(cd, document.createElement('em')); el.classList.add('em-recarga'); }
    cd.style.setProperty('--cd', Math.min(1, falta / r[1]).toFixed(3));
    const txt = falta >= 60 ? Math.ceil(falta / 60) + 'm' : String(Math.ceil(falta));
    const em = el.querySelector(':scope > em'); if (em.textContent !== txt) em.textContent = txt;
  });
}
function atualizarHud(a, d, xpMax, fracRecarga) {
  atualizarHudArena();
  atualizarBuffs(d);
  atualizarRecargaItens(d);
  const txt = (sel, v) => { const el = $(sel); if (el.textContent !== v) el.textContent = v; };
  const eDg = dgVendo && dgEu ? dgEu : null;      // assistindo a dungeon: a vida e a mana da luta, não as do personagem parado na Fonte (p715)
  const vidaH = eDg ? eDg.vida : estado.vida, vidaMaxH = eDg ? Math.max(1, eDg.vidaMax) : a.vida, manaH = eDg ? eDg.mana : estado.mana, manaMaxH = eDg ? eDg.manaMax : a.mana;
  const fv = Math.max(0, vidaH / vidaMaxH), fm = manaMaxH ? Math.max(0, manaH / manaMaxH) : 0;      // a Katarina não tem mana
  $('#hud-vida').style.width = `${fv * 100}%`; $('#hud-mana').style.width = `${fm * 100}%`;
  $('#hud-vida').parentNode.classList.toggle('baixa', fv < 0.3);
  txt('#hud-vida-txt', `${fmt(Math.max(0, vidaH))} / ${fmt(vidaMaxH)}${d.escudo > 0 ? ` (+${fmt(d.escudo)})` : ''}`);
  // Yasuo: no lugar da mana, o Fluxo (enche lutando e andando; cheio, vira escudo)
  const fluxo = !!M.kit(estado).fluxo, barraMana = $('#hud-mana').parentElement;
  if (barraMana.classList.contains('fluxo') !== fluxo) { barraMana.classList.toggle('fluxo', fluxo); barraMana.title = fluxo ? t('Fluxo: enche lutando e andando; cheio, o próximo golpe que o Yasuo levar vira um escudo de vento') : t('Mana'); }
  barraMana.classList.toggle('cheio', fluxo && manaH >= manaMaxH - 0.5);
  barraMana.classList.toggle('sem', !!M.kit(estado).semMana);          // Katarina: não usa recurso nenhum
  txt('#hud-mana-txt', fluxo ? (manaH >= manaMaxH - 0.5 ? t('Fluxo cheio') : t('Fluxo {p}%', { p: Math.floor(manaH) })) : `${fmt(Math.max(0, manaH))} / ${fmt(manaMaxH)}`);
  txt('#hud-nivel', String(estado.nivel));
  const ret = $('#hud-retrato'), qual = `${CAMP}:${estado.skin || 0}`;
  if (ret.dataset.qual !== qual) {      // a cabeça do sprite do campeão (recorte de 16×16 do topo do sprite de 32), ampliada sem borrar
    ret.dataset.qual = qual;
    const cv = $('#hud-cabeca'), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(sprite(spriteCampeao(CAMP, estado.skin || 0), DIR.S, 0), 7, CAMP === 'zac' ? 4 : 0, 16, 16, 0, 2, 48, 48);
  }
  const max = estado.nivel >= M.NIVEL_MAX, pct = max ? 100 : Math.floor((100 * estado.xp) / xpMax);
  $('#hud-xp-barra').style.width = max ? '100%' : `${(100 * estado.xp) / xpMax}%`;
  ret.style.setProperty('--xp', (max ? 1 : Math.min(1, estado.xp / xpMax)).toFixed(4));
  const xpTxt = max ? t('nível máximo') : t('Nível {n}: {xp} / {total} XP ({pct}%) para o {prox}', { n: estado.nivel, xp: inteiro(estado.xp), total: inteiro(xpMax), pct, prox: estado.nivel + 1 });
  $('#hud-xpb-barra').style.width = max ? '100%' : `${Math.min(100, (100 * estado.xp) / xpMax)}%`;
  txt('#hud-xpb-txt', max ? t('nível máximo') : t('{xp} / {total} XP', { xp: inteiro(estado.xp), total: inteiro(xpMax) }));
  if ($('#hud-xpb').dataset.dica !== xpTxt) $('#hud-xpb').title = xpTxt;      // o dicas.js passa o title para data-dica
  txt('#hud-xp-txt', xpTxt); if (ret.dataset.dica !== xpTxt) ret.title = xpTxt;
  for (const el of document.querySelectorAll('#hud-habs .hud-hab[data-t]')) {
    const hk = el.dataset.t, f = fracRecarga(hk), seg = f > 0 && d.recargas[hk] >= 1 ? String(Math.ceil(d.recargas[hk])) : '';
    el.style.setProperty('--cd', f.toFixed(3));
    el.classList.toggle('recarga', f > 0);
    const em = el.querySelector('em'); if (em.textContent !== seg) em.textContent = seg;
    const r = estado.ranks[hk], custo = r ? HABS[hk].custo?.[r - 1] || 0 : 0;
    el.classList.toggle('sem-mana', estado.mana < custo);
    const cvz = r ? M.custoVidaHab(estado, hk) : 0;      // Zac: o custo em vida (parte da vida atual)
    const cb = el.querySelector('b'), ct = cvz > 0 ? Math.round(cvz * 100) + '%' : custo > 0 && !M.kit(estado).fluxo ? String(custo) : '';      // o custo de mana (o Yasuo e a Katarina não usam)
    if (cb && cb.classList.contains('vida') !== cvz > 0) { cb.classList.toggle('vida', cvz > 0); cb.style.color = cvz > 0 ? '#ff8a8a' : ''; }
    if (cb && cb.textContent !== ct) cb.textContent = ct;
    el.classList.toggle('aprimorada', hk === 'Q' && (d.qCarga || 0) >= 2);      // Yasuo: o próximo Q é o tornado
  }
  for (const b of document.querySelectorAll('#hud-pocoes .hud-pocao')) {
    const k = b.dataset.pocao, n = String(estado.pocoes[k]), q = b.querySelector('b');
    if (q.textContent !== n) q.textContent = n;
    b.classList.toggle('zero', estado.pocoes[k] <= 0);
    b.classList.toggle('bloq', estado.nivel < M.POCOES[k].nivel);
  }
  atualizarRastreio();
}
// quadro de missões: a tarefa do Capitão (com o progresso) e as chaves das fortalezas (com o tempo que falta)
function atualizarRastreio() {
  // a linha do medidor da caçada (aparece depois do primeiro abate)
  const ba = $('#rastreio-analise');
  ba.hidden = !analise.abates;
  if (analise.abates) {
    const c = contasAnalise(), html = `<b>📊 ${t('Caçada')}</b><small>${t('{xp} XP/h · {ouro} ouro/h', { xp: fmt(Math.round(c.xpH)), ouro: fmt(Math.round(c.ouroH)) })}</small>`;
    if (ba.dataset.html !== html) { ba.dataset.html = html; ba.innerHTML = html; }
  }
  const bl = $('#rastreio-login'), pl = loginInfo === undefined ? null : M.proximoLogin(loginInfo);
  bl.hidden = !pl || pl.pegouHoje;
  if (pl && !pl.pegouHoje) {
    const html = `<b>🎁 ${t('Prêmio diário: Dia {n}', { n: pl.diaCiclo })}</b><small>${pl.seq > 1 ? t('{n} dias seguidos · clique para pegar', { n: pl.seq - 1 }) : t('Clique para pegar')}</small>`;
    if (bl.dataset.html !== html) { bl.dataset.html = html; bl.innerHTML = html; }
    bl.classList.add('pronta');
  }
  const tar = estado.tarefa, bt = $('#rastreio-tarefa');
  bt.hidden = !tar;
  if (tar) {
    const pronta = M.tarefaPronta(estado);
    const html = pronta
      ? `<b>${t('Tarefa pronta!')}</b><small>${M.naBase(estado) ? t('Clique aqui para falar com o Capitão.') : t('Volte à Fonte (tecla B) e fale com o Capitão.')}</small>`
      : `<b>${t('Tarefa: {monstro}', { monstro: nomeTarefa(tar) })}</b><span class="rastreio-barra"><i style="width:${Math.min(100, (100 * tar.feitos) / tar.qtd)}%"></i></span><small>${tar.feitos}/${tar.qtd} · ${M.LOCAL[tar.local]?.nome || ''}</small>`;
    if (bt.dataset.html !== html) { bt.dataset.html = html; bt.innerHTML = html; }
    bt.classList.toggle('pronta', pronta);
  }
  for (const k of ['rift', 'runeterra']) {      // as missões diárias
    const D = M.DIARIAS[k], di = estado[D.campo], bd = $(k === 'rift' ? '#rastreio-diaria-rift' : '#rastreio-diaria');
    bd.hidden = !di;
    if (!di) continue;
    const pronta = M.diariaPronta(estado, k), fora = !pronta && !D.aqui(estado);
    const dica = k === 'rift' ? t("só conta caçando no Summoner's Rift, clique para abrir o mapa") : t('só conta em Runeterra, clique para ir');
    const html = pronta ? `<b>${t('Missão diária completa!')}</b><small>${t('Clique aqui para receber o prêmio.')}</small>`
      : `<b>${k === 'rift' ? t('Diária do Rift') : t('Diária de Runeterra')}</b><span class="rastreio-barra"><i style="width:${Math.min(100, (100 * di.feitos) / di.qtd)}%"></i></span><small>${inteiro(di.feitos)}/${inteiro(di.qtd)} · ${fora ? `<em>${dica}</em>` : t('do seu nível ou até 5 abaixo')}</small>`;
    if (bd.dataset.html !== html) { bd.dataset.html = html; bd.innerHTML = html; }
    bd.classList.toggle('pronta', pronta);
    bd.classList.toggle('fora', fora);
  }
  const bc = $('#rastreio-caveira'), rvr = localAtual().arena ? vermelhaResta() : 0, cvr = localAtual().arena && !rvr ? caveiraResta() : 0;      // a Caveira do PvP e a Vermelha
  const nfr = localAtual().arena ? fragsAtivos() : 0, prox = nfr ? proximoFragSome() : 0, LV = M.CAVEIRA_VERMELHA.limites[0];
  bc.hidden = !cvr && !rvr && !nfr;
  bc.classList.toggle('vermelha', !!rvr);
  if (cvr || rvr || nfr) {
    // os frags: quantos há na janela e quando o próximo some (cada um some sozinho; não há reset de uma vez)
    const linhaFrags = nfr ? `<b class="fr">☠ ${t('Frags: {d}/{n}', { d: nfr, n: LV.n })}${prox ? ' · ' + t('o próximo some em {tempo}', { tempo: tempoTexto(Math.ceil(prox / 1000)) }) : ''}</b>`
      + (rvr ? '' : `<small>${t('Cada frag some {h} h depois de feito. Com {n} frags em {h} h você ganha a Caveira Vermelha por {d} h.', { h: horasRegra(LV.ms), n: LV.n, d: horasRegra(LV.dura) })}</small>`) : '';
    const html = (rvr ? `<b class="rv">☠ ${t('Caveira Vermelha')} · ${tempoLongo(Math.ceil(rvr / 1000))}</b><small>${t('Qualquer um pode te atacar fora das cidades; morrendo em Runeterra, cai metade dos seus itens.')}</small>` : '')
      + linhaFrags
      + (cvr ? `<b>☠ ${t('Caveira')} · ${tempoTexto(Math.ceil(cvr / 1000))}</b><small>${t('Sem cidades e sem sair de Runeterra; qualquer um pode te atacar. O tempo só passa fora das cidades.')}</small>` : '');
    if (bc.dataset.html !== html) { bc.dataset.html = html; bc.innerHTML = html; }
  }
  const bv = $('#rastreio-vilemaw');      // a Vilemaw: quando acorda e, acordada, onde está (a partir do nível 10)
  bv.hidden = estado.nivel < 10;
  if (!bv.hidden) {
    const ag = Date.now(), ativa = !!vmInfo?.ativo && vmInfo.fim > ag;
    const prox = !ativa && vmInfo?.proximo > ag ? vmInfo.proximo : proximaVilemaw(ag);
    const quanto = (ms) => { const sg = Math.max(0, ms) / 1000, h = Math.floor(sg / 3600), m = Math.floor((sg % 3600) / 60); return h ? t('{h} h {m} min', { h, m }) : m ? t('{m} min', { m }) : t('menos de 1 min'); };
    const hora = new Date(prox).toLocaleTimeString(ingles ? 'en-US' : 'pt-BR', { hour: '2-digit', minute: '2-digit' });
    const html = ativa
      ? `<b>🕷 ${t('A Vilemaw acordou!')}</b><small>${t(R.NOME_ZONA[vmInfo.zona] || '')} · ${t('vai embora em {tempo}', { tempo: quanto(vmInfo.fim - ag) })}${localAtual().arena ? '' : ' · ' + t('clique para ir')}</small>`
      : `<b>🕷 ${t('Vilemaw')}</b><small>${t('acorda às {hora} · em {tempo}', { hora, tempo: quanto(prox - ag) })}</small>`;
    if (bv.dataset.html !== html) { bv.dataset.html = html; bv.innerHTML = html; }
    bv.classList.toggle('ativa', ativa);
  }
  desenharSorteio();
  const agora = Date.now(), ch = minhasChaves.filter((q) => q.ate > agora), box = $('#rastreio-chaves');
  box.hidden = !ch.length;
  if (ch.length) {
    const html = ch.map((q) => {
      const z = R.mundoLogico().fortalezas[q.fortaleza]?.zona, resta = q.ate - agora, mm = Math.floor(resta / 60000), ss = Math.floor((resta % 60000) / 1000);
      return `<div class="rastreio-chave${resta < 60000 ? ' acabando' : ''}"><img src="${iconeChaveUrl(z)}" alt=""><span>${t(NOME_CHAVE[z] || 'Chave da Fortaleza')}<small>${t(R.NOME_ZONA[z] || '')}</small></span><b>${mm}:${String(ss).padStart(2, '0')}</b></div>`;
    }).join('');
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }
  etiquetaMissoes();
}
// quadro de missões recolhível (sugestão de jogador: tomava muito da tela): a etiqueta em cima mostra quantas são e,
// recolhido, avisa quando uma tarefa ou diária fica pronta ou a Vilemaw acorda
// duas abas (pedido do dono): Missões e Eventos (EVENTOS_RASTREIO e abaRastreio ficam lá em cima, junto do missoesMin)
function etiquetaMissoes() {
  const q = $('#rastreador'), abas = $('#rastreio-abas'), topo = $('#rastreio-topo'), ev = $('#rastreio-ev');
  const itens = [...q.children].filter((c) => c !== abas && !c.hidden);
  const fr = $('#rastreio-fr'), frs = itens.filter((c) => FRAGS_RASTREIO.has(c.id));
  const evs = itens.filter((c) => EVENTOS_RASTREIO.has(c.id)), mis = itens.filter((c) => !EVENTOS_RASTREIO.has(c.id) && !FRAGS_RASTREIO.has(c.id));
  abas.hidden = !itens.length; topo.hidden = !mis.length; ev.hidden = !evs.length; fr.hidden = !frs.length;
  // a aba escolhida sem nada cai para outra (Missões, Eventos, Frags)
  const tem = { missoes: mis.length, eventos: evs.length, frags: frs.length };
  const aba = tem[abaRastreio] ? abaRastreio : ['missoes', 'eventos', 'frags'].find((k) => tem[k]) || 'missoes';
  q.classList.toggle('aba-eventos', aba === 'eventos');
  q.classList.toggle('aba-frags', aba === 'frags');
  const fechadaF = missoesMin || aba !== 'frags', verm = frs.some((c) => c.classList.contains('vermelha'));
  const txtF = verm ? t('Vermelha') : `(${fragsAtivos()}/${M.CAVEIRA_VERMELHA.limites[0].n})`;
  const nf = $('#rastreio-fr-n'); if (nf.textContent !== txtF) nf.textContent = txtF;
  fr.classList.toggle('ativa', !fechadaF); fr.classList.toggle('alerta', fechadaF && verm);
  const sf = fechadaF ? '▸' : '▾'; if ($('#rastreio-fr-seta').textContent !== sf) $('#rastreio-fr-seta').textContent = sf;
  fr.setAttribute('aria-expanded', String(!fechadaF));
  q.classList.toggle('minimizado', missoesMin && itens.length > 0);
  const prontas = mis.filter((c) => c.classList.contains('pronta')).length, vm = evs.some((c) => c.id === 'rastreio-vilemaw' && c.classList.contains('ativa')), sort = evs.some((c) => c.id === 'rastreio-sorteio');
  const fechadaM = missoesMin || aba !== 'missoes', fechadaE = missoesMin || aba !== 'eventos';
  const txtM = fechadaM && prontas ? (prontas === 1 ? t('1 pronta!') : t('{n} prontas!', { n: prontas })) : `(${mis.length})`;
  const txtE = fechadaE && vm ? t('Vilemaw acordou!') : fechadaE && sort ? t('Sorteio ao vivo!') : `(${evs.length})`;
  const n = $('#rastreio-n'); if (n.textContent !== txtM) n.textContent = txtM;
  const ne = $('#rastreio-ev-n'); if (ne.textContent !== txtE) ne.textContent = txtE;
  topo.classList.toggle('alerta', fechadaM && prontas > 0); ev.classList.toggle('alerta', fechadaE && (vm || sort));
  topo.classList.toggle('ativa', !fechadaM); ev.classList.toggle('ativa', !fechadaE);
  const sm = fechadaM ? '▸' : '▾', se = fechadaE ? '▸' : '▾';
  if ($('#rastreio-seta').textContent !== sm) $('#rastreio-seta').textContent = sm;
  if ($('#rastreio-ev-seta').textContent !== se) $('#rastreio-ev-seta').textContent = se;
  topo.setAttribute('aria-expanded', String(!fechadaM)); ev.setAttribute('aria-expanded', String(!fechadaE));
}
// a aba aberta recolhe o quadro; a outra troca de aba (e abre)
function clicarAbaRastreio(qual) {
  const q = $('#rastreador'), atual = q.classList.contains('aba-frags') ? 'frags' : q.classList.contains('aba-eventos') ? 'eventos' : 'missoes';
  const aberta = !missoesMin && atual === qual;
  if (aberta) missoesMin = true; else { missoesMin = false; abaRastreio = qual; gravarLocal('lolidle-rastreio-aba', qual); }
  gravarLocal('lolidle-missoes-min', missoesMin); etiquetaMissoes();
}
$('#rastreio-topo').addEventListener('click', (e) => { e.currentTarget.blur(); clicarAbaRastreio('missoes'); });
$('#rastreio-ev').addEventListener('click', (e) => { e.currentTarget.blur(); clicarAbaRastreio('eventos'); });
$('#rastreio-fr').addEventListener('click', (e) => { e.currentTarget.blur(); clicarAbaRastreio('frags'); });
// avisos de saque: aparecem à direita da tela e somem sozinhos (lendário fica mais tempo)
let avisouMochila = 0;
function avisoSaque({ img, nome, cor, tipo, classe = '' }) {
  const caixa = $('#avisos-saque'), el = document.createElement('div');
  el.className = 'saque ' + classe;
  el.style.setProperty('--cor', cor);
  el.innerHTML = `${img ? `<img src="${img}" alt="">` : '<span class="saque-ico">!</span>'}<div><b></b><small></small></div>`;
  el.querySelector('b').textContent = nome; el.querySelector('small').textContent = tipo;
  caixa.prepend(el);
  while (caixa.children.length > 3) caixa.lastChild.remove();
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 400); }, classe === 'lendario' ? 7000 : 4000);
}
function avisarSaque(ev) {
  const TIPO = { lendario: t('Item lendário'), epico: t('Item épico'), basico: t('Item') };
  // o item que cai ainda vai ter a qualidade sorteada pelo servidor (na mochila ele está como "~?"): o aviso não mostra qualidade
  for (const id0 of ev.itens || []) {
    const id = String(id0).includes('~') ? id0 : M.comItem(M.baseId(id0), M.refinoDe(id0), '?'), it = descreverItem(id);
    avisoSaque({ img: imgItem(id), nome: it.nome, cor: it.cor, tipo: (TIPO[it.raridade] || TIPO.basico) + (M.pendente(id) ? ' · ' + t('avaliando a qualidade…') : ''), classe: it.raridade });
    if (it.raridade === 'lendario') alertaLendario(M.ITENS[M.baseId(id)]?.nome || it.nome, imgItem(id));
  }
  for (const g of ev.gemas || []) avisoSaque({ img: iconeGema(g), nome: M.nomeGema(g), cor: M.GEMAS[g]?.cor || '#fff', tipo: t('Runa'), classe: 'gema' });
  if (ev.perdidos?.length && Date.now() - avisouMochila > 20000) {
    avisouMochila = Date.now();
    avisoSaque({ nome: t('Mochila cheia!'), cor: '#ff6a5a', tipo: t('O saque está ficando no chão. Volte à Fonte e venda.'), classe: 'alerta' });
  }
}

// ouro no cartão do jogador: quando muda, o número conta até o valor novo, pulsa e solta um +X (ou −X, em vermelho)
let ouroVisto = null, ouroTela = 0, ouroAnim = 0;
function mostrarOuro() {
  const alvo = estado.ouro, b = $('#st-ouro');
  if (ouroVisto === null || document.hidden) { ouroVisto = ouroTela = alvo; b.textContent = fmt(alvo); return; }
  if (alvo === ouroVisto) return;
  const dif = alvo - ouroVisto; ouroVisto = alvo;
  const caixa = $('.ficha-ouro'), chip = document.createElement('span');
  chip.className = 'ouro-ganho' + (dif < 0 ? ' perde' : '');
  chip.textContent = (dif > 0 ? '+' : '−') + fmt(Math.abs(dif));
  caixa.querySelectorAll('.ouro-ganho').forEach((c, k, l) => { if (k < l.length - 2) c.remove(); });
  caixa.append(chip); setTimeout(() => chip.remove(), 1500);
  b.classList.remove('pulsa', 'perde'); void b.offsetWidth; b.classList.add(dif < 0 ? 'perde' : 'pulsa');
  const de = ouroTela, t0 = performance.now();
  cancelAnimationFrame(ouroAnim);
  const passo = (agora) => {
    const k = Math.min(1, (agora - t0) / 650);
    ouroTela = Math.round(de + (alvo - de) * (1 - (1 - k) ** 3));
    b.textContent = fmt(ouroTela);
    if (k < 1) ouroAnim = requestAnimationFrame(passo);
  };
  ouroAnim = requestAnimationFrame(passo);
}

let eraNoite = null;
function mostrarPoder() {
  const p = M.poder(estado), txtP = fmt(p);
  if ($('#st-poder').textContent !== txtP) $('#st-poder').textContent = txtP;
  const base = (estado.nivel || 1) * 40, itens = p - base;
  if ($('#equip-poder-n').textContent !== txtP) {
    $('#equip-poder-n').textContent = txtP; $('#equip-poder-d').textContent = `${fmt(base)} + ${fmt(itens)}`;
    $('#equip-poder-d').title = t('{n} do nível + {i} dos itens', { n: fmt(base), i: fmt(itens) });
  }
}
function atualizarUI() {
  document.body.classList.toggle('na-aram', naAram());
  const a = M.atributos(estado), d = dgVendo && dgD ? { ...combate.darius, ...dgD, recargas: { ...combate.darius.recargas, ...(dgD.recargas || {}) } } : combate.darius, l = localAtual();
  const txt = (s, v) => { const el = $(s); if (el.textContent !== v) el.textContent = v; };
  txt('#st-nivel', String(estado.nivel));
  const xpMax = M.xpParaNivel(estado.nivel);
  $('#st-xp').style.width = estado.nivel >= M.NIVEL_MAX ? '100%' : `${(100 * estado.xp) / xpMax}%`;
  txt('#st-xp-txt', estado.nivel >= M.NIVEL_MAX ? t('nível máximo') : `XP ${fmt(estado.xp)} / ${fmt(xpMax)}`);
  txt('#st-xp-pct', estado.nivel >= M.NIVEL_MAX ? t('máximo') : t('{pct}% para o {n}', { pct: Math.floor((100 * estado.xp) / xpMax), n: estado.nivel + 1 }));
  $('#st-vida').style.width = `${Math.max(0, (100 * estado.vida) / a.vida)}%`;
  txt('#st-vida-txt', `${fmt(Math.max(0, estado.vida))} / ${fmt(a.vida)}${d.escudo > 0 ? ` (+${fmt(d.escudo)})` : ''}`);
  $('#st-mana').style.width = `${a.mana ? Math.max(0, (100 * estado.mana) / a.mana) : 0}%`;
  txt('#st-mana-txt', `${fmt(Math.max(0, estado.mana))} / ${fmt(a.mana)}`);
  mostrarOuro();
  mostrarPoder();
  const bb = estado.buffBarao || 0;
  $('#buff-barao').hidden = bb <= 0;
  // Disciplina da Legião / Ritmo de Aventura: acúmulos ganhos nesta caçada
  const disc = combate.darius.disciplina || 0;
  $('#buff-disciplina').hidden = !estado.ranks.D;
  if (estado.ranks.D && HABS.D.acumulos) { txt('#buff-disciplina-n', HABS.D.nome); txt('#buff-disciplina-t', `+${disc}% / ${HABS.D.acumulos[estado.ranks.D - 1]}%`); }
  else if (estado.ranks.D && HABS.D.vontade) { txt('#buff-disciplina-n', HABS.D.nome); txt('#buff-disciplina-t', `+${Math.round(HABS.D.vontade[estado.ranks.D - 1] * Math.max(0, 1 - estado.vida / a.vida) * 100)}%`); }
  else if (estado.ranks.D && HABS.D.longe) { txt('#buff-disciplina-n', HABS.D.nome); txt('#buff-disciplina-t', combate.darius.pressa > 0 ? t('pressa!') : t('até +{p}%', { p: Math.round(HABS.D.longe[estado.ranks.D - 1] * 100) })); }
  else if (estado.ranks.D && HABS.D.prisma) { txt('#buff-disciplina-n', HABS.D.nome); txt('#buff-disciplina-t', `${combate.darius.prismaCont || 0} / ${HABS.D.cada}`); }
  if (bb > 0) txt('#buff-barao-t', `${Math.floor(bb / 60)}:${String(Math.floor(bb % 60)).padStart(2, '0')}`);
  cena.barao = bb > 0;
  txt('#st-ad', fmt(a.ad));
  txt('#st-arm', fmt(a.armadura));
  txt('#st-rm', fmt(a.rm));
  // Poder de Habilidade e mana: só para quem usa magia ou tem item de mago
  const comPoder = M.classeDe(estado) === 'ap' || a.ap > 0;
  for (const el of document.querySelectorAll('.st-poder')) el.hidden = !comPoder || (el.querySelector('#st-manamax') && !a.mana);      // a Katarina não tem mana
  if (comPoder) { txt('#st-ap', fmt(a.ap || 0)); txt('#st-manamax', fmt(a.mana)); }
  txt('#st-va', a.velAtaque.toFixed(2));
  txt('#st-esq', `${(a.esquiva * 100).toFixed(1)}%`);
  txt('#st-crit', `${Math.round(a.critico * 100)}%`);
  txt('#st-critx', `×${a.danoCritico.toFixed(2).replace('.', ingles ? '.' : ',')}`);
  txt('#st-cdr', `−${Math.round(a.reducaoRecarga * 100)}%`);
  txt('#st-abates', fmt(estado.totais.abates));
  txt('#st-mortes', fmt(estado.totais.mortes));

  // local
  if (!(l.arena && combate.arena?.mundo) || l.aram) txt('#hud-local', l.nome);
  // relógio: mostra quanto falta para a próxima virada
  const noite = M.ehNoite(estado);
  txt('#hud-hora', `${noite ? '☾' : '☀'} ${M.horaDoRelogio(estado.relogio || 0)}`);
  if (noite !== eraNoite) {
    if (eraNoite !== null) {
      if (noite) { log(t('A noite caiu. Monstros noturnos (☾) estão à solta: mais fortes, mas dão mais XP, ouro e itens.'), 'chefe'); cena.aviso(t('A noite caiu...'), '#a890ff'); }
      else { log(t('O dia amanheceu.'), 'chefe'); cena.aviso(t('Amanheceu!'), '#ffe080'); }
    }
    eraNoite = noite;
  }
  const pk = !!(l.arena && combate.arena?.pvp), bpk = $('#bt-pk');
  if (bpk.classList.contains('ligado') !== pk) {
    bpk.classList.toggle('ligado', pk); bpk.setAttribute('aria-pressed', String(pk));
    bpk.title = pk ? t('PK ligado: você pode atacar outros jogadores, e eles podem atacar você (tecla P)') : t('PK desligado: você não ataca outros jogadores (tecla P)');
  }
  cena.pk = pk;
  const A = combate.arena, noMundo = !!(l.arena && A?.mundo && !l.aram);
  const cid = noMundo && A.cidade ? R.CIDADE[A.cidade] : null, zona = noMundo && !cid && A.zona ? M.LOCAL[A.zona] : null;
  let faixaTxt = l.faixa ? t('Nível ideal {min}–{max}', { min: l.faixa[0], max: l.faixa[1] }) : t('Zona segura'), nomeLocal = l.faixa ? `${l.nome} <small style="color:${corFaixa(l)}">${t('nível {min}–{max}', { min: l.faixa[0], max: l.faixa[1] })}</small>` : l.nome, descLocal = l.descricao;
  if (noMundo) {
    txt('#hud-local', cid ? cid.nome : zona ? t(R.NOME_ZONA[zona.id]) : 'Runeterra');
    faixaTxt = cid ? t('Cidade (zona segura)') : zona ? t('Nível {min}–{max} · +{bonus}% XP e drop', { min: zona.faixa[0], max: zona.faixa[1], bonus: Math.round((M.ARENA.bonus - 1) * 100) }) : '';
    nomeLocal = cid ? `Runeterra <small style="color:${cid.cor}">${cid.nome}</small>` : zona ? `Runeterra <small style="color:${corFaixa(zona)}">${t(R.NOME_ZONA[zona.id])} · ${t('nível {min}–{max}', { min: zona.faixa[0], max: zona.faixa[1] })}</small>` : 'Runeterra';
    descLocal = cid ? t('Cidade segura: sem monstros e sem PvP, e a vida e a mana voltam rápido. A Soraka e o Lojista atendem na praça.')
      : zona ? t('Monstros: {monstros}', { monstros: zona.monstros.map(([n]) => t(n)).join(', ') }) + (zona.chefe ? t('. Às vezes aparece o {chefe}', { chefe: t(zona.chefe[0]) }) : '') + '.' : l.descricao;
  }
  if (l.base) descLocal = l.descricao + ' ' + t('Botão direito no chão para andar; clique num NPC para conversar.');
  if (l.aram) faixaTxt = t('PvP 1 contra 1');
  if (dgVendo) { txt('#hud-local', t('Covil de Braum')); faixaTxt = t('Dungeon do Braum'); }      // p670
  txt('#hud-faixa', faixaTxt);
  $('#hud-dir').style.visibility = noMundo && ($('#moldura').classList.contains('hud-baixa') || $('#moldura').classList.contains('hud-mini')) ? 'hidden' : '';
  $('#hud-redes').style.display = noMundo ? 'none' : '';      // em Runeterra o minimapa fica embaixo da faixa: os ícones o cobririam      // celular deitado: o + do zoom do minimapa cobria o texto (some sem tirar o lugar do relógio)
  // o que se perde ao morrer (pedido do dono): no Rift só o XP; em Runeterra também os itens equipados podem cair
  $('#aviso-morte').hidden = !!l.base || !!l.arena;
  $('#aviso-morte-mundo').hidden = !l.arena || !!l.aram;
  if (l.arena && !l.aram && !avisouMorteMundo) {
    avisouMorteMundo = true;
    setTimeout(() => { cena.aviso(t('Cuidado: em Runeterra, morrer pode fazer seus itens equipados caírem.'), '#ff8a6a'); log(t('Em Runeterra, morrer custa 10% do XP do nível e pode derrubar seus itens num saco no chão: morto por outro jogador, 30% de chance de cair 1 item equipado; por monstro, 10% por item; com a Caveira Vermelha, metade de tudo que você carrega. A Bênção Protetora (Loja) segura os itens.'), 'morte'); }, 1500);
  }
  if ($('#local-nome').innerHTML !== nomeLocal) $('#local-nome').innerHTML = nomeLocal;
  // a descrição do lugar saiu (o dono achou desnecessária); fica só o aviso de morto ou voltando para a base
  { const aviso = d.morto > 0 ? t('Você está morto...') : d.recall > 0 ? t('Voltando para a base... {s}s (Esc cancela)', { s: d.recall.toFixed(1) }) : ''; txt('#local-desc', aviso); $('#local-desc').hidden = !aviso; }
  $('#voltar-base').disabled = !!l.base || d.recall > 0 || d.morto > 0;
  $('#npcs').hidden = true;          // nas cidades e na Fonte, clica-se no NPC na tela
  const brt = $('#ir-runeterra');
  brt.disabled = !!l.arena || d.morto > 0 || d.recall > 0;
  txt('#ir-runeterra .rot', l.arena ? t('Você está em Runeterra') : t('Ir para Runeterra'));
  const tar = estado.tarefa;
  $('#tarefa').hidden = !tar;
  if (tar) {
    const pronta = M.tarefaPronta(estado);
    $('#tarefa').classList.toggle('pronta', pronta);
    txt('#tarefa-txt', pronta ? t('Tarefa pronta! Fale com o Capitão') : t('Tarefa: {monstro}', { monstro: nomeTarefa(tar) }));
    txt('#tarefa-num', `${tar.feitos}/${tar.qtd}`);
    $('#tarefa-barra').style.width = `${(100 * tar.feitos) / tar.qtd}%`;
  }
  // avisos nas abas: pontos para gastar e itens na mochila
  txt('#badge-hab', estado.pontos > 0 ? String(estado.pontos) : '');
  // botão dourado em cima da barra de baixo: pontos para usar (abre a aba certa)
  const bp = $('#hud-pontos'), temPontos = estado.pontos > 0 || estado.pontosAtrib > 0;
  if (bp.hidden === temPontos) bp.hidden = !temPontos;
  if (temPontos) {
    const rot = [estado.pontos > 0 ? t('{n} de habilidade', { n: estado.pontos }) : '', estado.pontosAtrib > 0 ? t('{n} de atributo', { n: estado.pontosAtrib }) : ''].filter(Boolean).join(' · ');
    txt('#hud-pontos-txt', rot);
  }
  txt('#badge-atrib', estado.pontosAtrib > 0 ? String(estado.pontosAtrib) : '');
  txt('#badge-itens', estado.mochila.length ? String(estado.mochila.length) : '');
  $('#badge-itens').classList.toggle('cheia', M.espacosLivres(estado) <= 0);

  // batalha
  let vivos = combate.inimigos.filter((i) => !i.morto && i.hp > 0);
  if (noMundo) {
    const dA = (i) => Math.hypot(i.x - A.x, i.y - A.y);
    vivos = vivos.filter((i) => i.aggro || i.id === A.alvo || dA(i) < 6).sort((x, y) => (y.id === A.alvo) - (x.id === A.alvo) || dA(x) - dA(y)).slice(0, 5);
  }
  const alvo = noMundo ? vivos.find((i) => i.id === A.alvo) : vivos.find((i) => i.chegada <= 0);
  // quadro do alvo no topo da tela (os chefes já têm a barra grande deles)
  {
    const box = $('#hud-alvo'), mostra = alvo && !alvo.chefe && alvo.guardiao == null;
    box.hidden = !mostra;
    if (mostra) {
      const f = Math.max(0, alvo.hp / alvo.hpMax);
      const html = `<img src="${miniatura(alvo.nome)}" alt=""><div><b style="color:${corVida(f)}">${t(alvo.nome)}</b> <small>${t('nv {n}', { n: alvo.nivel })}</small>${alvo.magico ? ` <span class="tag-magico">✦ ${t('mágico')}</span>` : ''}${alvo.noturno ? ` <span class="tag-noturno">☾ ${t('noturno')}</span>` : ''}${alvo.furioso ? ` <span class="tag-furioso" title="${t('Mais forte e deixa os outros do grupo mais bravos, mas rende como vários monstros')}">✹ ${t('furioso')}</span>` : ''}<span class="alvo-vida"><i style="width:${f * 100}%;background:${corVida(f)}"></i></span></div>`;
      if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
    }
  }
  if (false) $('#batalha').innerHTML = vivos.length ? vivos.map((i) => {
    const f = Math.max(0, i.hp / i.hpMax);
    return `<div class="criatura${i === alvo ? ' alvo' : ''}"><img src="${miniatura(i.nome)}" width="32" height="32" style="image-rendering:pixelated;background:#1e1c1b;border:1px solid ${i === alvo ? '#e03030' : '#0a0908'}">
      <div class="info"><div class="nome" style="color:${corVida(f)}">${t(i.nome)} <small style="color:#8a847a">${t('nv {n}', { n: i.nivel })}</small>${i.magico ? ` <span class="tag-magico">✦ ${t('mágico')}</span>` : ''}${i.noturno ? ` <span class="tag-noturno">☾ ${t('noturno')}</span>` : ''}</div><div class="mini"><i style="width:${f * 100}%;background:${corVida(f)}"></i></div></div></div>`;
  }).join('') : `<div class="vazio">${l.base || cid ? t('Zona segura.') : t('Nenhuma criatura por perto.')}</div>`;

  // poções
  document.querySelectorAll('#pocoes .pocao').forEach((b) => {
    const k = b.dataset.pocao, n = String(estado.pocoes[k]);
    const q = b.querySelector('b');
    if (q.textContent !== n) q.textContent = n;
    b.classList.toggle('zero', estado.pocoes[k] <= 0);
    b.classList.toggle('bloq', estado.nivel < M.POCOES[k].nivel);
  });
  txt('#lim-vida-txt', `${Math.round(estado.auto.limiarVida * 100)}%`);
  $('#rotina').classList.toggle('ativa', M.rotinaAtiva(estado));
  { const liga = M.ehVip(estado) && ['#auto-vida', '#auto-mana', '#rot-pocoes', '#rot-mochila'].some((sel) => $(sel)?.checked);     // aceso só com alguma opção marcada
    $('[data-aba="auto"]').classList.toggle('ligado', liga);
    txt('#auto-estado', !M.ehVip(estado) ? t('exclusivo VIP') : liga ? t('ligado') : t('desligado'));
    $('#auto-estado').className = !M.ehVip(estado) ? 'vip' : liga ? 'on' : 'off';
    // as poções do jogador, com a quantidade (na aba Auto)
    const html = Object.entries(M.POCOES).map(([k, p]) => `<div class="auto-pocao${estado.pocoes[k] <= 0 ? ' zero' : ''}${estado.nivel < p.nivel ? ' bloq' : ''}"><img src="${frasco(ICONE_POCAO[k])}" alt=""><span>${p.nome}<small>${t('recupera {cura} de {tipo}', { cura: p.cura, tipo: t(p.tipo) })}</small></span><b>${estado.pocoes[k]}</b></div>`).join('');
    if ($('#auto-pocoes').dataset.html !== html) { $('#auto-pocoes').dataset.html = html; $('#auto-pocoes').innerHTML = html; } }
  txt('#lim-mana-txt', `${Math.round(estado.auto.limiarMana * 100)}%`);

  // habilidades
  const fracRecarga = (hk) => { const r = estado.ranks[hk]; return r && HABS[hk].recarga ? Math.min(1, d.recargas[hk] / (HABS[hk].recarga[r - 1] * (1 - a.reducaoRecarga))) : 0; };
  for (const el of document.querySelectorAll('#habilidades .hab')) {
    const hk = el.dataset.t; if (hk === 'P') continue;
    const r = estado.ranks[hk], h = HABS[hk];
    // rank atual/máximo e a dica comparando o rank atual com o próximo (só refaz quando muda)
    const chaveDica = `${r}|${estado.nivel}`;
    if (el.dataset.dicaChave !== chaveDica) {
      // o texto vai direto para a nossa caixa de dica (data-dica): com "title" o navegador mostrava a dele por cima
      el.dataset.dicaChave = chaveDica; el.dataset.dica = dicaHab(hk); el.removeAttribute('title');
      el.querySelector('.rank span').textContent = `${r}/${h.max}`;
      el.querySelector('.rank i').style.width = `${(100 * r) / h.max}%`;
      el.classList.toggle('maximo', r >= h.max);
    }
    el.querySelector('.mais').classList.toggle('pode', M.podeSubir(estado, hk));
    el.classList.toggle('na-barra', estado.barra.includes(hk));
    const trava = el.querySelector('.trava'), textoTrava = estado.nivel < h.nivel ? t('Nv {n}', { n: h.nivel }) : !r ? t('novo') : '';
    if (trava.textContent !== textoTrava) trava.textContent = textoTrava;
    trava.style.display = textoTrava ? '' : 'none';
    el.querySelector('.recarga').style.height = `${fracRecarga(hk) * 100}%`;
  }
  desenharBarra();
  $('#barra').classList.toggle('trocando', !!trocando);
  for (const el of document.querySelectorAll('#habilidades .hab')) el.classList.toggle('escolhida', el.dataset.t === trocando);
  for (const el of document.querySelectorAll('#barra .hab')) el.querySelector('.recarga').style.height = `${fracRecarga(el.dataset.t) * 100}%`;
  atualizarHud(a, d, xpMax, fracRecarga);
  const usados = Object.values(estado.ranks).reduce((soma, x) => soma + x, 0);
  txt('#hab-pontos', `${estado.pontos} ${estado.pontos === 1 ? t('ponto livre') : t('pontos livres')} · ${t('{usados}/{total} ranks', { usados, total: M.RANKS_TOTAIS })}`);
  // atributos
  txt('#atrib-pontos', estado.pontosAtrib > 0 ? t('({n} pontos · shift+clique = 10)', { n: estado.pontosAtrib }) : '');
  for (const [k, at] of Object.entries(M.atributosDe(estado))) {
    const v = estado.atrib[k] || 0;
    txt(`[data-valor="${k}"]`, String(v));
    txt(`[data-total="${k}"]`, v ? at.total(v) : t('{efeito} por ponto', { efeito: at.curto }));
  }
  document.querySelectorAll('#atributos button').forEach((b) => (b.disabled = estado.pontosAtrib <= 0));
  atualizarSkins();
  atualizarConquistas();
  atualizarMascotes();
  atualizarMontaria();
  preencherSlots('#equip', equipNaOrdem());
  const bota = $('#equip .bota-slot');
  if (bota && !bota.dataset.id) { bota.innerHTML = `<svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><path d="M3 1h4v6h3v1h1v3H3V8H2V7h1z"/></svg><small>${t('Botas')}</small>`; bota.title = t('Espaço da bota: clique numa bota da mochila para equipar.'); }
  {
    const cap = M.mochilaDe(estado.nivel), lista = [...estado.mochila, ...pilhasEspolios()];
    for (let k = cap; k < M.MOCHILA; k++) lista[k] = 'tranca:' + M.nivelDoEspaco(k);
    preencherSlots('#mochila', lista, false, true);
    document.querySelectorAll('#mochila .slot').forEach((b, k) => { b.hidden = k >= cap + M.MOCHILA_GANHO.espacos; });
  }
  atualizarBolsa(); atualizarHudItens();
  const htmlGemas = M.ORDEM_GEMAS.map((g) => `<div class="gema-bolsa${estado.gemas?.[g] ? '' : ' zero'}" title="${textoGema(g).replace(/"/g, '&quot;')}"><img src="${iconeGema(g)}" alt=""><b>${estado.gemas?.[g] || 0}</b><span>${M.nomeGema(g)}</span></div>`).join('');
  if ($('#gemas').dataset.html !== htmlGemas) { $('#gemas').dataset.html = htmlGemas; $('#gemas').innerHTML = htmlGemas; }
  expirarChaves(); desenharChaves();
  txt('#mochila-qtd', `(${M.mochilaDe(estado.nivel) - M.espacosLivres(estado)}/${M.mochilaDe(estado.nivel)})`);
}

// ---------- início ----------
montarPaineis();
montarSkins();
montarConquistas();
montarMascotes();
if (novoJogo) {
  log(t('Bem-vindo, {nome}! Você está na Fonte.', { nome: NOME }), 'chefe');
  log(t('Abra o Mapa (tecla M) e escolha onde caçar. A Rota Inferior é ideal para o nível 1–10.'), 'npc');
  log(t('O Lojista compra os itens que você dropar e vende poções. A Soraka cura vida e mana. Clique neles na tela.'), 'npc');
  if (M.ehVip(estado)) {
    log(t('Presente de boas-vindas: você ganhou {n} dias de VIP! Mais experiência e drop, e o automático de poções (aba ⚙ Auto) já está ligado.', { n: M.VIP.boasVindas }), 'raro');
    setTimeout(() => cena.aviso(t('Presente: {n} dias de VIP!', { n: M.VIP.boasVindas }), '#ffd84a'), 2500);
  }
} else log(t('Bem-vindo de volta, {nome}. Você está em {lugar}.', { nome: NOME, lugar: localAtual().nome }), 'chefe');
// caça offline: o servidor já somou no save o que o personagem ganhou com o jogo fechado (metade da média dele, até 5 h)

// ---------- evento de XP (servidor/evento.js): o servidor manda { id, mult, fim } no GET /api/eu e em cada save ----------
let eventoXp = null, eventoVisto = null;
function aplicarEvento(ev) {
  eventoXp = ev && ev.fim > Date.now() && ev.mult > 1 ? ev : null;
  M.usarEventoXp(eventoXp ? eventoXp.mult : 1);
  if (eventoXp && eventoVisto !== eventoXp.id) {
    eventoVisto = eventoXp.id;
    log(t(eventoXp.mult === 2 ? 'Evento de XP em dobro ativo: todo monstro dá o dobro de experiência até as {hora}.' : 'Evento de XP ativo: todo monstro dá {mult}x de experiência até as {hora}.', { mult: eventoXp.mult, hora: new Date(eventoXp.fim).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) }), 'raro');
  }
  desenharEvento();
}
function desenharEvento() {
  const el = $('#evento-xp');
  if (eventoXp && Date.now() >= eventoXp.fim) { eventoXp = null; M.usarEventoXp(1); log(t('O evento de XP acabou.'), 'npc'); }
  el.hidden = !eventoXp; cena.eventoNoTopo = !!eventoXp;      // com a faixa do evento no topo, a barra da Vilemaw desce
  if (!eventoXp) return;
  const falta = Math.max(0, eventoXp.fim - Date.now()) / 1000, h = Math.floor(falta / 3600), m = Math.floor((falta % 3600) / 60), s = Math.floor(falta % 60);
  const tempo = h ? t('{h} h {m} min', { h, m }) : m ? t('{m} min {s} s', { m, s }) : t('{s} s', { s });
  const txt = `<b>⚡ ${eventoXp.mult === 2 ? t('XP em dobro') : t('XP x{mult}', { mult: eventoXp.mult })}</b> <span>${t('termina em {tempo}', { tempo })}</span>`;
  if (el.innerHTML !== txt) el.innerHTML = txt;
  el.title = t('Evento: todo monstro dá {mult}x de experiência até {hora}. Ouro e itens não mudam.', { mult: eventoXp.mult, hora: new Date(eventoXp.fim).toLocaleString(LOCALE, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) });
}
setInterval(desenharEvento, 1000);
aplicarEvento(sessao.evento);
if (sessao.vm) vmInfo = sessao.vm;

// ---------- Aviso de reinício: o servidor vai atualizar (a hora vem no GET /api/eu e em cada save) ----------
let reinicioAte = 0, reinicioAvisado = 0;
function aplicarReinicio(em) { reinicioAte = Number(em) || 0; desenharReinicio(); }
function desenharReinicio() {
  const el = $('#aviso-reinicio');
  el.hidden = !reinicioAte;
  if (!reinicioAte) return;
  const falta = Math.max(0, Math.ceil((reinicioAte - Date.now()) / 1000)), m = Math.floor(falta / 60), s = falta % 60;
  const txt = falta > 0 ? `<b>⚠ ${t('O servidor reinicia em {tempo}', { tempo: `${m}:${String(s).padStart(2, '0')}` })}</b> <span>${t('para uma atualização. O seu progresso fica salvo.')}</span>`
    : `<b>⚠ ${t('Atualizando...')}</b> <span>${t('o jogo volta sozinho em alguns segundos.')}</span>`;
  if (el.innerHTML !== txt) el.innerHTML = txt;
  el.classList.toggle('urgente', falta <= 60);
  if (falta <= 60 && falta > 0 && reinicioAvisado !== reinicioAte) {
    reinicioAvisado = reinicioAte;
    som.efeito('alerta'); cena.aviso(t('O servidor reinicia em 1 minuto'), '#ff9a5a');
    log(t('O servidor reinicia em 1 minuto para uma atualização. O seu progresso fica salvo.'), 'morte');
  }
}
setInterval(desenharReinicio, 1000);
aplicarReinicio(sessao.reinicio);
aplicarDonos(sessao.donos);

// ---------- Prêmio diário por entrar: sequência de dias (pedido do dono) ----------
loginInfo = sessao.login || null;
const ICONE_OURO = '🪙';
function htmlPremioLogin(pr, grande) {
  const partes = [];
  if (pr.ouro) partes.push(`<span class="lg-ouro">${ICONE_OURO} <b>${fmt(pr.ouro)}</b></span>`);
  for (const [g, q] of Object.entries(pr.runas || {})) partes.push(`<span class="lg-runa" title="${esc(M.nomeGema(g))}"><img src="${iconeGema(g)}" alt=""><b>×${q}</b></span>`);
  if (pr.item) partes.push(`<span class="lg-item">🎁 <b>${t('Épico')}</b></span>`);
  return partes.join(grande ? '' : '');
}
function textoPremioLogin(pr, item) {
  const l = [];
  if (pr.ouro) l.push(t('{n} de ouro', { n: fmt(pr.ouro) }));
  for (const [g, q] of Object.entries(pr.runas || {})) l.push(`${q}× ${M.nomeGema(g)}`);
  if (item) l.push(descreverItem(item).nome);
  return l.join(', ');
}
function desenharLogin() {
  const p = M.proximoLogin(loginInfo), N = M.PREMIO_LOGIN.length;
  const cartoes = M.PREMIO_LOGIN.map((_, k) => {
    const dia = k + 1, pr = M.premioLoginDe(estado.nivel, dia);
    const feito = dia < p.diaCiclo || (p.pegouHoje && dia === p.diaCiclo), hoje = !p.pegouHoje && dia === p.diaCiclo;
    const amanha = p.pegouHoje && dia === (p.diaCiclo % N) + 1;
    return `<div class="lg-dia${feito ? ' feito' : ''}${hoje ? ' hoje' : ''}${amanha ? ' amanha' : ''}${dia === N ? ' ultimo' : ''}">
      <small>${t('Dia {n}', { n: dia })}</small><div class="lg-premio">${htmlPremioLogin(pr)}</div>${feito ? '<i class="lg-ok">✓</i>' : hoje ? `<i class="lg-selo">${t('Hoje')}</i>` : amanha ? `<i class="lg-selo amanha">${t('Amanhã')}</i>` : ''}</div>`;
  }).join('');
  const meia = Date.parse(M.diaHoje() + 'T00:00:00-03:00') + 86400000, falta = Math.max(0, meia - Date.now()), h = Math.floor(falta / 3600000), mi = Math.floor((falta % 3600000) / 60000);
  const seq = p.pegouHoje ? p.seq : p.seq - 1;
  const fogo = seq > 0 ? `<p class="lg-seq">🔥 ${seq === 1 ? t('1 dia seguido') : t('{n} dias seguidos', { n: seq })}</p>` : '';
  const perdeu = p.perdeu ? `<p class="lg-perdeu">${t('Você ficou um dia sem pegar o prêmio: a sequência recomeçou do Dia 1.')}</p>` : '';
  const temAr = !!estado.mascotes?.aranha, feitos = Math.min(seq, M.ARANHA_DIAS), faltam = M.ARANHA_DIAS - feitos;
  const aranha = `<div class="lg-marco${temAr ? ' feito' : ''}"><img src="${miniatura('Aranhinha')}" alt=""><div><b>${temAr ? t('Dia {n}: Aranhinha ✓', { n: M.ARANHA_DIAS }) : t('Dia {n} seguido: a Aranhinha é sua, garantida!', { n: M.ARANHA_DIAS })}</b><small>${temAr ? t('Você já tem a Aranhinha, o filhote da Vilemaw.') : t('O mascote filhote da Vilemaw: morde os monstros junto com você e acha um pouco mais de itens. Vale para todos os seus personagens.')}</small>${temAr ? '' : `<span class="lg-marco-barra"><i style="width:${(100 * feitos) / M.ARANHA_DIAS}%"></i></span><small class="lg-marco-conta">${!p.pegouHoje && p.seq >= M.ARANHA_DIAS ? t('Pegue o prêmio de hoje para ganhar!') : t('{a} de {n} dias seguidos · faltam {f}', { a: feitos, n: M.ARANHA_DIAS, f: faltam })}</small>`}</div></div>`;
  $('#login-corpo').innerHTML = `${fogo}${perdeu}<div class="lg-dias">${cartoes}</div>${aranha}
    <p class="lg-explica">${t('Entre todo dia para subir a sequência; o Dia 7 dá um item épico. Se passar um dia sem pegar, ela volta para o Dia 1. É um prêmio por conta por dia, e vai para o personagem que pegar.')}</p>
    <p class="alerta lg-erro" hidden></p>
    ${p.pegouHoje ? `<button type="button" class="botao lg-pegar" disabled>${t('Volte amanhã: o próximo prêmio sai em {h} h {m} min', { h, m: mi })}</button>`
      : `<button type="button" class="botao principal lg-pegar" data-pegar-login>${t('Pegar o prêmio do Dia {n}', { n: p.diaCiclo })}</button>`}`;
}
function abrirLogin() { desenharLogin(); $('#janela-login').hidden = false; }
// abre sozinho quando o prêmio de hoje ainda não foi pego (espera o tutorial, os tours e as outras janelas)
function oferecerLogin() {
  if (loginInfo === undefined || M.proximoLogin(loginInfo).pegouHoje || !$('#janela-login').hidden) return;
  if (tutorial || tour || tourRt || naAram() || document.querySelector('.dialogo-fundo') || [...document.querySelectorAll('.janela')].some((j) => !j.hidden)) { setTimeout(oferecerLogin, 5000); return; }
  abrirLogin();
}
setTimeout(oferecerLogin, 3000);
$('#janela-login').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-pegar-login]');
  if (!b) return;
  b.disabled = true;
  const r = await operarServidor('/api/login-diario');
  if (!r) { const er = $('#login-corpo .lg-erro'); er.hidden = false; er.textContent = $('#mercado-erro')?.textContent || t('Não deu certo. Tente de novo.'); b.disabled = false; return; }
  loginInfo = r.login;
  som.efeito('raro'); cena.efeito('brilho', cena.darius, 1.6, '#ffd040');
  log(t('Prêmio diário (Dia {d}, {s} seguidos): {lista}.', { d: r.premio.dia, s: r.premio.seq, lista: textoPremioLogin(r.premio, r.premio.item) }), 'raro');
  if (r.premio.item) avisoSaque({ img: imgItem(r.premio.item), nome: descreverItem(r.premio.item).nome, cor: descreverItem(r.premio.item).cor, tipo: t('Prêmio diário') });
  if (r.premio.mascote) ganhouAranha(t('{n} dias seguidos de prêmio diário!', { n: r.premio.seq }));
  desenharLogin(); atualizarUI();
});
$('#rastreio-login').addEventListener('click', (e) => { e.currentTarget.blur(); abrirLogin(); });
$('#rastreio-analise').addEventListener('click', (e) => { e.currentTarget.blur(); abrirAnalise(); });
aplicarGuilda(sessao.guilda);
if (sessao.vilemaw) setTimeout(abrirBauVilemaw, 4000);        // ajudou a vencer a Vilemaw e não abriu o baú
if (sessao.offline) {
  const o = sessao.offline, h = Math.floor(o.seg / 3600), min = Math.round((o.seg % 3600) / 60);
  const tempo = h ? t('{h} h {m} min', { h, m: min }) : t('{m} min', { m: min });
  log(t('Enquanto você estava fora ({tempo}), {nome} caçou: +{xp} de experiência e +{ouro} de ouro.', { tempo, nome: NOME, xp: fmt(o.xp), ouro: fmt(o.ouro) }), 'raro');
  setTimeout(() => {
    som.efeito('raro');
    avisar(t('Enquanto você estava fora ({tempo}), seu campeão continuou caçando:', { tempo }) + '\n\n'
      + t('+{xp} de experiência', { xp: fmt(o.xp) }) + (o.nivel > o.nivelAntes ? ' · ' + t('subiu para o nível {n}!', { n: o.nivel }) : '') + '\n'
      + t('+{ouro} de ouro', { ouro: fmt(o.ouro) }) + '\n\n'
      + t('Com o jogo fechado ele rende metade da sua média de caça, por até {h} horas. Itens e runas só caem com o jogo aberto.', { h: 5 }),
    { titulo: t('Caça offline') });
  }, 2500);
}
// sorteio da indicação: quem ganhou o VIP vê o aviso uma vez
for (const p of sessao.premios || []) {
  setTimeout(() => {
    som.efeito('raro'); cena.efeito('brilho', cena.darius, 2, '#ffd040'); cena.aviso(t('🎉 Você ganhou {dias} dias de VIP!', { dias: GANHOS.sorteio.diasVip }), '#ffd84a');
    avisar(t('Você chegou pelo link de {nome} e foi sorteado entre {n} amigos: ganhou {dias} dias de VIP! Aproveite: mais experiência, mais drop e o automático de poções.', { nome: p.indicador, n: GANHOS.sorteio.aCada, dias: GANHOS.sorteio.diasVip }), { titulo: t('🎁 Sorteio de VIP') });
    rede.premioVisto(p.id).catch(() => {});
  }, 4000);
}
// equipamento por espaço (out/2026): o servidor tirou do equipamento o que não cabia (só um item por espaço) e avisa uma vez
if (estado.avisoEquip?.length) {
  const movidos = estado.avisoEquip; delete estado.avisoEquip;
  const nome = (m) => '• ' + descreverItem(m.item).nome;
  const guardados = movidos.filter((m) => m.para !== 'kit').map((m) => nome(m) + ' → ' + (m.para === 'cofre' ? t('cofre da Tesoureira') : t('mochila'))).join('\n');
  const kit = movidos.filter((m) => m.para === 'kit').map(nome).join('\n');
  setTimeout(() => avisar(t('O equipamento agora tem 5 espaços: 1 só para bota e 4 para os outros itens (cada lendário uma vez). Ficaram equipados os que valem mais. Estes foram guardados:\n{lista}', { lista: guardados })
    + (kit ? '\n\n' + t('Para os espaços que ficaram vazios, você ganhou estes itens, já equipados e com o refino dos que saíram:\n{kit}', { kit }) : ''), { titulo: t('Equipamento novo') }), 3000);
}
// o jogo está em inglês, mas o navegador é em português: avisa (em português) onde troca, já que o tradutor do navegador fica desligado no jogo
if (ingles && /^pt/i.test(navigator.language || '')) log('O jogo está em inglês. Para jogar em português, clique em PT no cartão do jogador (ao lado do seu nome).', 'sistema');
// ---------- Próximo passo: objetivos do começo ----------
// Um quadro no canto do jogo guia quem está começando, um objetivo por vez. Cada objetivo se completa sozinho
// pelo estado do jogo; o botão "Como?" explica e aponta onde fazer. Fica no navegador (CHAVE_OBJ).
const naFonte = () => M.naBase(estado);
const npcOuVoltar = (nome) => (naFonte() ? alvoNpc(nome) : null) || $('#voltar-base');
const OBJETIVOS = [
  { texto: t('Mande o campeão caçar: abra o Mapa e escolha a Rota Inferior.'), feito: () => estado.totais.abates > 0,
    dica: () => t('Clique em Mapa (tecla M), depois na Rota Inferior e em Viajar para cá. A viagem leva 3 segundos.'), alvo: () => $('#abrir-mapa') },
  { texto: t('Deixe ele caçar até o nível 3. Não precisa clicar em nada.'), feito: () => estado.nivel >= 3, conta: () => [estado.nivel, 3],
    dica: () => t('O campeão anda, ataca e usa as habilidades sozinho. A barra de experiência mostra quanto falta para o próximo nível.'), alvo: () => $('#hud-baixo') },
  { texto: t('Use seus pontos: aprenda ou melhore uma habilidade e suba um atributo.'),
    feito: () => Object.values(estado.ranks).reduce((s, v) => s + v, 0) >= 2 && Object.values(estado.atrib || {}).reduce((s, v) => s + v, 0) > 0,
    dica: () => t('Clique no botão dourado "Pontos para usar", em cima da barra de baixo. Na aba Habilidades, o + aprende ou melhora uma habilidade; na aba Atributos, o + sobe Força, Vitalidade e os outros.'),
    alvo: () => $v('#hud-pontos') || $('[data-aba="habilidades"]') },
  { texto: t('Equipe um item: abra a aba Itens e clique num item da mochila.'), feito: () => estado.itens.length > 0,
    dica: () => (estado.mochila.length ? t('Na aba Itens, clique no item da mochila para equipar. Ele fica mais forte na hora.') : t('Ainda não caiu nenhum item. Continue caçando: os itens aparecem na mochila, na aba Itens.')),
    alvo: () => { abrirAba('itens'); return $('[data-painel="itens"]'); } },
  { texto: t('Volte para a Fonte e venda o saque para o Lojista.'), feito: () => (estado.totais.vendidos || 0) > 0 || !!obj?.vendeu,
    dica: () => (naFonte() ? t('Clique no Lojista e venda os espólios e os itens que você não vai usar.') : t('Clique em Voltar (tecla B). Na Fonte, clique no Lojista e venda o que trouxe.')),
    alvo: () => npcOuVoltar('Lojista') },
  { texto: t('Pegue uma tarefa com o Capitão da Legião.'), feito: () => !!estado.tarefa || (estado.totais.tarefas || 0) > 0,
    dica: () => (naFonte() ? t('Clique no Capitão da Legião e em "Quero uma tarefa". Cace os monstros pedidos e volte para receber.') : t('Volte para a Fonte (tecla B) e clique no Capitão da Legião.')),
    alvo: () => npcOuVoltar('Capitão da Legião') },
  { texto: t('Forje um item até +1 no Ornn.'), feito: () => [...estado.itens, ...estado.mochila].some((x) => M.refinoDe(x) > 0),
    dica: () => (naFonte() ? t('Clique no Ornn, escolha "Forjar um item" e coloque um item na bigorna. O +1 nunca dá errado de vez: cada falha conta.') : t('Volte para a Fonte (tecla B) e clique no Ornn.')),
    alvo: () => npcOuVoltar('Ornn') },
  { texto: t('Chegue ao nível 10.'), feito: () => estado.nivel >= 10, conta: () => [estado.nivel, 10],
    dica: () => t('Quando a Rota Inferior ficar fácil, troque de área: o Mapa mostra o nível ideal de cada lugar.'), alvo: () => $('#abrir-mapa') },
  { texto: t('Visite Runeterra, o mundo aberto.'), feito: () => !!obj?.runeterra || (!!localAtual().arena && !localAtual().aram),
    dica: () => t('Clique em Ir para Runeterra e espere 5 segundos (a viagem). Lá você anda com o botão direito do mouse e usa as habilidades com Q, W, E e R.'), alvo: () => $('#ir-runeterra') },
  { texto: t('Em Runeterra, monte no Burrinho: tecla Z.'), feito: () => !!lerLocal('lolidle-montou', 0),
    dica: () => (localAtual().arena ? t('Aperte Z ou clique no botão Montar, embaixo do minimapa. Leva 1 segundo e dá para montar andando. Montado você anda bem mais rápido, os monstros não vêm atrás de você e o Burrinho sobe de nível enquanto você anda.') : t('Primeiro vá para Runeterra. Lá, aperte Z (ou o botão Montar, embaixo do minimapa).')),
    alvo: () => $v('#bt-montaria') || $('#ir-runeterra') },
];
$('#rastreio-abas').insertAdjacentHTML('afterend', `<section id="objetivo" hidden aria-live="polite">
  <header><b>${t('Próximo passo')}</b><small></small><button type="button" class="obj-fechar" title="${t('Esconder')}" aria-label="${t('Esconder')}">×</button></header>
  <p class="obj-texto"></p><div class="obj-barra" hidden><i></i></div><p class="obj-dica" hidden></p>
  <button type="button" class="obj-como">${t('Como?')}</button></section>`);
obj = lerLocal(CHAVE_OBJ, null);
if (!obj || typeof obj !== 'object') obj = { i: novoJogo || estado.nivel < 10 ? 0 : 'fim' };
let objMostrado = -1;
function desenharObjetivo() {
  const caixa = $('#objetivo');
  if (obj.i === 'fim') { caixa.hidden = true; return; }
  const o = OBJETIVOS[obj.i];
  caixa.hidden = false;
  caixa.querySelector('small').textContent = `${obj.i + 1}/${OBJETIVOS.length}`;
  caixa.querySelector('.obj-texto').textContent = o.texto;
  const c = o.conta?.(), barra = caixa.querySelector('.obj-barra');
  barra.hidden = !c;
  if (c) barra.firstChild.style.width = `${Math.min(100, (100 * c[0]) / c[1])}%`;
  if (objMostrado !== obj.i) { objMostrado = obj.i; caixa.querySelector('.obj-dica').hidden = true; }
}
// abre a dica e aponta onde fazer (forcar: mostra o quadro de novo mesmo escondido)
function mostrarObjetivo(forcar = false) {
  if (forcar && obj.i === 'fim') { obj.i = OBJETIVOS.findIndex((o) => !o.feito()); if (obj.i < 0) obj.i = 'fim'; gravarLocal(CHAVE_OBJ, obj); }
  desenharObjetivo();
}
function comoFazer() {
  if (obj.i === 'fim') return;
  const o = OBJETIVOS[obj.i], dica = $('#objetivo .obj-dica');
  dica.textContent = o.dica(); dica.hidden = false;
  const el = o.alvo?.();
  if (el) {
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    el.classList.remove('obj-aponta'); void el.offsetWidth; el.classList.add('obj-aponta');
    setTimeout(() => el.classList.remove('obj-aponta'), 4200);
  }
}
$('#objetivo .obj-como').addEventListener('click', comoFazer);
$('#objetivo .obj-fechar').addEventListener('click', () => {
  obj.i = 'fim'; gravarLocal(CHAVE_OBJ, obj); desenharObjetivo();
  log(t('Quadro de objetivos escondido. Se precisar de ajuda, escreva "como joga" no chat.'), 'npc');
});
setInterval(() => {
  if (obj.i === 'fim') return;
  if (localAtual().arena && !localAtual().aram && !obj.runeterra) obj.runeterra = true;
  let avancou = false;
  while (obj.i !== 'fim' && OBJETIVOS[obj.i].feito()) { obj.i++; avancou = true; funil('objetivo:' + (obj.i === 'fim' ? OBJETIVOS.length : obj.i)); if (obj.i >= OBJETIVOS.length) obj.i = 'fim'; }
  if (avancou) {
    gravarLocal(CHAVE_OBJ, obj);
    som.efeito('raro');
    if (obj.i === 'fim') { log(t('Você já sabe o básico. Agora é caçar, forjar e subir no ranking. Bom jogo!'), 'raro'); cena.aviso(t('Objetivos completos!'), '#ffd84a'); }
    else { log(t('Próximo passo: {texto}', { texto: OBJETIVOS[obj.i].texto }), 'raro'); const c = $('#objetivo'); c.classList.remove('novo'); void c.offsetWidth; c.classList.add('novo'); }
  }
  desenharObjetivo();
}, 1000);
desenharObjetivo();
// ---------- tutorial (personagem novo; dá para rever pelo botão ? no canto da tela) ----------
const CHAVE_TUTORIAL = `lolidle-tutorial:${NOME}`;
const $v = (s) => { const el = $(s); return el && !el.closest('[hidden]') ? el : null; };
const mapaAberto = () => !$('#janela-mapa').hidden;
let abatesAntes = 0, tutorial = null;
let tutDesde = 0;
const PASSOS_TUTORIAL = [
  { titulo: t('Bem-vindo, {nome}!', { nome: NOME }),
    texto: t('Aqui o seu campeão caça sozinho. Você escolhe onde ele caça e cuida dele entre uma caçada e outra. Vou te mostrar em 30 segundos.'),
    botao: t('Mostrar') },
  { alvo: () => $('#abrir-mapa'), titulo: t('Escolha onde caçar'), texto: t('Abra o mapa. Também dá para usar a tecla M.'),
    espera: t('Clique em Mapa.'), ate: mapaAberto },
  { alvo: () => $v('#marcadores .marcador[data-local="rota-inf"]'), titulo: t('Rota Inferior'),
    texto: t('O número embaixo de cada lugar é o nível indicado. Comece pela Rota Inferior, do nível 1 ao 10. Clique nela.'),
    espera: t('Clique na Rota Inferior.'), ate: () => !!$v('#marcadores .marcador.escolhido[data-local="rota-inf"]') || estado.local === 'rota-inf',
    volta: { se: () => !mapaAberto(), para: 1 } },
  { alvo: () => $v('#mapa-info [data-ir="rota-inf"]'), titulo: t('Viajar'),
    texto: t('Aqui aparecem a experiência e o ouro de cada monstro e os itens que caem. Clique em Viajar para cá: a viagem leva 3 segundos.'),
    espera: t('Clique em Viajar para cá e espere a barra encher.'), ate: () => estado.local === 'rota-inf',
    volta: { se: () => !mapaAberto() && !viagem && estado.local !== 'rota-inf', para: 1 } },
  // a mensagem principal do jogo: fica pelo menos 6 s na tela, mesmo que o primeiro monstro caia antes
  { alvo: () => $('#moldura'), titulo: t('Agora é com ele'),
    texto: t('O campeão anda, ataca e usa as habilidades sozinho. Você não precisa clicar em nada: é só deixar o jogo aberto.'),
    espera: t('Veja o primeiro monstro cair.'), antes: () => { abatesAntes = estado.totais.abates; tutDesde = Date.now(); },
    ate: () => (estado.totais.abates > abatesAntes || estado.local === 'fonte') && Date.now() - tutDesde > 6000 },
  { alvo: () => $('#hud-baixo'), titulo: t('Experiência e ouro'),
    texto: t('Cada abate dá experiência e ouro. A cada nível você ganha pontos de habilidade e de atributo: quando tiver pontos para usar, aparece um botão dourado em cima desta barra.') },
  { alvo: () => $('#hud-baixo'), titulo: t('Fique de olho na vida'),
    texto: t('Se a vida ficar baixa, clique numa poção. Se o campeão morrer, ele acorda na Fonte e perde um pouco de experiência.') },
  { alvo: () => $v('#objetivo') || $('#moldura'), antes: () => mostrarObjetivo(), titulo: t('Siga o Próximo passo'),
    texto: t('Este quadro mostra o que fazer em seguida: equipar itens, vender o saque, pegar tarefas, forjar. Em dúvida, clique em Como? que eu aponto onde fica. Para rever o tutorial, use o botão ? no canto da tela.'),
    botao: t('Começar a jogar') },
];
function comecarTutorial(inicio = 0) {
  tutorial?.parar();
  tutorial = iniciarTutorial(PASSOS_TUTORIAL, { chave: CHAVE_TUTORIAL, inicio, aoPasso: (i) => funil('tutorial:' + (i + 1)),
    aoFim: (pulou) => { tutorial = null; funil(pulou ? 'tutorial:pulou' : 'tutorial:fim'); } });
}
// ---------- tutorial, parte 2: o tour da Fonte (tarefas, forja, montagem, gemas, Lojista e mercado) ----------
// começa sozinho na primeira vez que o jogador está na Fonte depois de ter caçado um pouco
const CHAVE_TOUR = `lolidle-tour-fonte:${NOME}`;
const conversaCom = (nome) => !$('#janela-npc').hidden && npcAtual === nome;
const fecharConversa = () => { $('#janela-npc').hidden = true; };
const PASSOS_TOUR = [
  { titulo: t('De volta à Fonte'),
    texto: t('Agora que você já caçou, vale conhecer o que dá para fazer aqui: tarefas, a forja do Ornn e as runas. Na Fonte, o botão direito no chão anda e o clique num NPC abre a conversa. Leva um minuto.'), botao: t('Mostrar') },
  { alvo: () => alvoNpc('Capitão da Legião'), titulo: t('Tarefas do Capitão'),
    texto: t('O Capitão da Legião pede para você abater um número de monstros de um lugar. Na entrega você ganha ouro, experiência e às vezes um item. Clique nele.'),
    espera: t('Clique no Capitão.'), ate: () => conversaCom('Capitão da Legião') },
  { alvo: () => $('#janela-npc .painel'), titulo: t('Pegando uma tarefa'),
    texto: t('Em "Quero uma tarefa" ele mostra três opções. Escolha uma, cace, e volte aqui para entregar. Dá para ter uma tarefa por vez.') },
  { alvo: () => alvoNpc('Ornn'), antes: fecharConversa, titulo: t('Ornn, o ferreiro'),
    texto: t('Ornn deixa seus itens mais fortes e monta itens melhores juntando componentes. Clique nele.'),
    espera: t('Clique no Ornn.'), ate: () => conversaCom('Ornn') },
  { alvo: () => $('#janela-npc .painel'), titulo: t('Forja: de +1 a +5'),
    texto: t('Em "Forjar um item", arraste um item até a bigorna. Cada nível dá +12% nos bônus dele. O +1 e o +2 saem fácil e nunca dão errado. Do +3 em diante a chance cai, mas cada falha enche a barra de Persistência até o acerto ficar garantido.') },
  { alvo: () => $('#janela-npc .painel'), titulo: t('Montagem'),
    texto: t('Em "Montar itens" você escolhe uma receita e arrasta os componentes que caíram dos monstros. É assim que se chega aos lendários, os melhores itens do jogo. Se a tentativa falhar, as peças continuam com você.') },
  { alvo: () => $('#gemas'), antes: () => { fecharConversa(); abrirAba('itens'); }, titulo: t('Runas'),
    texto: t('De vez em quando um monstro deixa uma runa. Elas ficam aqui. No Ornn, escolha uma antes de tentar: a da Sorte dá +25% de chance, a Arcana dobra a chance e a de Proteção impede o item de voltar de nível.') },
  { alvo: () => alvoNpc('Lojista'), titulo: t('Lojista'),
    texto: t('O Lojista vende poções e compra o que você trouxe da caçada: peles, escamas e itens que você não vai usar. É daí que sai o ouro para a forja.') },
  { alvo: () => alvoNpc('Tesoureira de Piltover'), titulo: t('Tesoureira: o cofre'),
    texto: t('A Tesoureira de Piltover (ou o Burrinho de Carga, do lado dela) guarda itens e o seu ouro fora da mochila: 40 espaços, e dá para comprar mais. Bom para a mochila não encher e para separar o que você quer forjar depois.') },
  { alvo: () => $('#abrir-mercado'), titulo: t('Mercado'),
    texto: t('No Mercado (tecla J) você compra e vende itens e runas com outros jogadores, por ouro ou Gemas.') },
  { alvo: () => $('#abrir-arena'), titulo: t('Arena'),
    texto: t('PvP 1 contra 1, em melhor de 3 rodadas. A partir do nível 10 dá para jogar a ranqueada e subir de elo; o desafio, chamando alguém pelo nome, vale em qualquer nível. Morrer na Arena não custa nada.') },      // (p722)
  { alvo: () => $('#abrir-dungeon'), titulo: t('Dungeon do Braum'),
    texto: t('A partir do nível 20, você e até 4 amigos sobem a montanha de Freljord até o Braum. A luta é automática. Monte o grupo ou clique em Procurar grupo para o jogo juntar jogadores de nível parecido. Dá para entrar a cada 30 minutos.') },
  { titulo: t('Bom jogo!'),
    texto: t('Um bom ritmo é: pegar uma tarefa, caçar, voltar, entregar, vender o que sobrou e forjar. No nível 10, conheça Runeterra, o mundo aberto, e a Arena; no 20, a Dungeon. Para rever este tour, clique no ? quando estiver na Fonte.') },
];
// ---------- tutorial, parte 3: o tour de Runeterra (na primeira vez lá; o ? em Runeterra mostra de novo) ----------
const CHAVE_TOUR_RT = `lolidle-tour-runeterra:${NOME}`;
const PASSOS_RUNETERRA = [
  { titulo: t('Bem-vindo a Runeterra'),
    texto: t('Aqui quem controla o campeão é você. Botão direito no chão (ou as setas do teclado) anda, botão direito num monstro ataca, e Q, W, E e R usam as habilidades da barra, mirando no mouse. Os monstros daqui dão mais experiência e mais drop.'), botao: t('Mostrar') },
  { alvo: () => $v('#bt-montaria'), titulo: t('Seu Burrinho'),
    texto: t('O mundo é grande: monte no Burrinho com a tecla Z (ou neste botão), até andando. Montado você anda bem mais rápido, os monstros não vêm atrás de você e ele sobe de nível enquanto você anda. Atacar ou usar habilidade desmonta. Segure o botão direito para andar seguindo o mouse.'),
    espera: t('Aperte Z ou clique em Montar.'), ate: () => !!combate.arena?.montado || combate.arena?.montando > 0 },
  { alvo: () => $('#abrir-mapa'), titulo: t('Zonas e cidades'),
    texto: t('Quanto mais longe de Demacia, mais fortes os monstros. No Mapa (tecla M) você vê o nível de cada zona e viaja entre as cidades que já descobriu. A viagem leva 5 segundos e não funciona em combate.') },
  { alvo: () => $v('#bt-pk'), titulo: t('PK e Zonas de Guerra'),
    texto: t('A caveira (tecla P) liga o PK para lutar com outros jogadores. Nas Zonas de Guerra o PK fica sempre ligado e a experiência rende +40%: nas vermelhas qualquer nível luta, nas laranjas só quem está até 7 níveis de você. Nas cidades ninguém luta.') },
  { alvo: () => $v('#bt-grupo'), titulo: t('Grupo'),
    texto: t('Cace junto: cada amigo do grupo por perto dá +15% de experiência, e vocês podem bater no mesmo monstro.') },
  { titulo: t('Fortalezas'),
    texto: t('Cada zona tem uma fortaleza num planalto, com um guardião forte. Os golpes dele marcam o chão em vermelho antes de acertar: saia da marca! Vencido, ele larga uma chave que abre o baú lá de cima.') },
  { alvo: () => $('#voltar-base'), titulo: t('Voltar para a Fonte'),
    texto: t('B volta para a Fonte em 4 segundos, mas só fora de combate: levar dano cancela. Em luta, saia de perto dos inimigos primeiro. Para rever este tour, clique no ? aqui em Runeterra.'), botao: t('Bom jogo!') },
];
let tourRt = null;
function comecarTourRuneterra(inicio = 0) {
  tourRt?.parar(); tour?.parar(); tutorial?.parar();
  tourRt = iniciarTutorial(PASSOS_RUNETERRA, { chave: CHAVE_TOUR_RT, inicio, aoFim: () => { tourRt = null; } });
}
let rtDesde = 0;
setInterval(() => {
  if (!naArena() || naAram()) { rtDesde = 0; return; }      // a ponte da Arena não é Runeterra
  rtDesde ||= Date.now();
  if (tutorial || tour || tourRt || Date.now() - rtDesde < 2500 || M.emCombate(combate) || document.querySelector('.janela:not([hidden]), .dialogo-fundo, .novidades-fundo')) return;
  let feito = null; try { feito = localStorage.getItem(CHAVE_TOUR_RT); } catch { return; }
  if (feito === 'fim') return;
  comecarTourRuneterra(Number(feito) || 0);
}, 1000);
let tour = null;
function comecarTour(inicio = 0) {
  tour?.parar(); tutorial?.parar();
  tour = iniciarTutorial(PASSOS_TOUR, { chave: CHAVE_TOUR, inicio, aoFim: () => { tour = null; } });
}
setInterval(() => {
  if (tutorial || tour || !M.naBase(estado) || (estado.totais?.abates || 0) < 10 || document.querySelector('.janela:not([hidden]), .dialogo-fundo, .novidades-fundo')) return;
  let feito = null, principal = null;
  try { feito = localStorage.getItem(CHAVE_TOUR); principal = localStorage.getItem(CHAVE_TUTORIAL); } catch { return; }
  if (feito === 'fim' || (principal !== null && principal !== 'fim')) return;
  comecarTour(Number(feito) || 0);
}, 3000);
$('#controle-som').insertAdjacentHTML('beforeend', `<button type="button" id="bt-tutorial" title="${t('Tutorial')}">?</button>`);
// a wiki (monstros, itens, zonas e habilidades) numa aba nova; da janela do mapa abre direto na zona
$('#controle-som').insertAdjacentHTML('beforeend', `<a id="bt-wiki" href="/wiki" target="_blank" rel="noopener" title="${t('Wiki: vida dos monstros, itens e o que cai em cada zona')}" aria-label="Wiki">📖</a>`);
// o ? na Fonte mostra o tour da Fonte; em Runeterra, o tour de Runeterra; no Rift, o tutorial do começo
$('#bt-tutorial').addEventListener('click', (e) => { e.currentTarget.blur(); if (tutorial || tour || tourRt) return; if (naArena() && !naAram()) comecarTourRuneterra(0); else if (M.naBase(estado) && (estado.totais?.abates || 0) >= 10) comecarTour(0); else comecarTutorial(0); });
{
  let salvoTut = null; try { salvoTut = localStorage.getItem(CHAVE_TUTORIAL); } catch {}
  if (ABRIR_SALVAR) {}
  else if (novoJogo && salvoTut === null) comecarTutorial(0);
  else if (salvoTut !== null && salvoTut !== 'fim' && !localAtual().arena) comecarTutorial(Number(salvoTut) || 0);
}
if (importouLocal) log(t('O progresso que estava salvo neste navegador foi trazido para este personagem.'), 'raro');
if (migrou) log(t('Novidades: atributos (seus pontos foram distribuídos no modelo Equilibrado; troque para Manual no painel Atributos), 8 habilidades novas e a barra de combate. O Mestre da Legião, na Fonte, redistribui seus atributos.'), 'raro');
atualizarUI();
salvar();          // personagem novo já aparece no ranking
requestAnimationFrame(quadro);

// ---------- Novidades: janela com o que mudou nas atualizações ----------
function abrirNovidades() {
  if (document.querySelector('.novidades-fundo')) return;
  const fundo = document.createElement('div');
  fundo.className = 'novidades-fundo';
  const lista = NOVIDADES.slice(0, 4).map((n) => `<article class="novidade"><h3>${t(n.titulo)}</h3><small>${n.data}</small>
    <ul>${n.itens.map(([icone, texto]) => `<li><span>${icone}</span><p>${t(texto)}</p></li>`).join('')}</ul></article>`).join('');
  fundo.innerHTML = `<section class="painel novidades" role="dialog" aria-modal="true" aria-labelledby="novidades-titulo">
    <header id="novidades-titulo">✨ ${t('Novidades')} <button class="fechar" type="button" aria-label="${t('Fechar')}">×</button></header>
    <div class="corpo">${lista}</div><footer><button type="button" class="botao novidades-ok">${t('Bora jogar!')}</button></footer></section>`;
  const fechar = () => { fundo.remove(); removeEventListener('keydown', teclas, true); gravarLocal(CHAVE_NOVIDADE, NOVIDADES[0]?.id); $('#abrir-novidades').classList.remove('nova'); };
  const teclas = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); fechar(); } };
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  fundo.querySelector('.fechar').addEventListener('click', fechar);
  fundo.querySelector('.novidades-ok').addEventListener('click', fechar);
  addEventListener('keydown', teclas, true);
  document.body.append(fundo);
  fundo.querySelector('.novidades-ok').focus();
}
$('#abrir-novidades').addEventListener('click', abrirNovidades);
if (NOVIDADES[0] && lerLocal(CHAVE_NOVIDADE, null) !== NOVIDADES[0].id) {
  $('#abrir-novidades').classList.add('nova');
  // abre sozinha uma vez (espera o tutorial de quem está começando terminar)
  const tentar = () => { if (naAram() || document.querySelector('.tut-cartao, .dialogo-fundo')) setTimeout(tentar, 3000); else abrirNovidades(); };
  if (!novoJogo) setTimeout(tentar, 2500);
}

// ---------- Alerta de item lendário (pedido de jogador: deixar caçando e ser avisado) ----------
// som próprio (js/som.js), o título da aba piscando com o jogo em outra aba e a notificação do computador (se permitida)
const NOTIF_LENDARIO = 'lolidle-notif-lendario';
let tituloPisca = null;
function alertaLendario(nome, img) {
  if (!som.alertaLendarioLigado()) return;
  som.alertaLendario();
  if (!document.hidden) return;
  if (!tituloPisca) {
    const original = document.title; let k = 0;
    tituloPisca = setInterval(() => { document.title = k++ % 2 ? original : `✨ ${t('LENDÁRIO!')} ${nome}`; }, 900);
    const parar = () => { if (document.hidden) return; clearInterval(tituloPisca); tituloPisca = null; document.title = original; removeEventListener('visibilitychange', parar); };
    addEventListener('visibilitychange', parar);
  }
  try { if (lerLocal(NOTIF_LENDARIO, false) && 'Notification' in window && Notification.permission === 'granted') new Notification(t('Item lendário!'), { body: nome, icon: img, tag: 'lolidle-lendario' }); } catch {}
}
$('#alerta-lendario').checked = som.alertaLendarioLigado();
$('#alerta-lendario').addEventListener('change', async (e) => {
  som.definirAlertaLendario(e.target.checked);
  if (!e.target.checked) { log(t('Alerta de lendário desligado.'), 'npc'); return; }
  som.alertaLendario();      // para ouvir como é
  log(t('Alerta de lendário ligado: quando cair um lendário, toca este som (mesmo com os efeitos desligados).'), 'npc');
  // a notificação do computador, para quando o jogo está em outra aba (o navegador pergunta uma vez)
  try {
    if ('Notification' in window && Notification.permission !== 'denied') {
      const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      gravarLocal(NOTIF_LENDARIO, p === 'granted');
    }
  } catch {}
});
