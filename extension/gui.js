/*
 * LoL Idle - Auto Poção · gui.js  (world: ISOLATED)
 * =============================================================================
 * PAINEL DO USUÁRIO do auto-play.
 *
 * COMO ABRIR (o caminho REAL - é este que as verificações e os prints têm de usar):
 *   • hover no SEU NOME (canto superior direito do jogo)  • botão flutuante ⚙  • tecla F8
 *   • ou por código: window.__lolidleGui.abrir()  (fecha com fechar(); troca de aba: setTab())
 * `classList.add('on')` NÃO é o caminho real: só mostra o painel - quem pinta o conteúdo é o
 * `abrir()` interno. Quem abrir por classe vai ver o painel vazio e achar que é bug.
 *
 * COMO ESTE ARQUIVO ESTÁ ORGANIZADO (procura pelos números):
 *   0. CONSTANTES E AJUDANTES ....... formatação (fmt/esc/…) e ícones do jogo
 *   1. PONTE COM O MOTOR ............ só chama funções que EXISTEM em window.__lolidleAuto
 *   2. KIT DE INTERFACE ............. cartões, linhas, botões, barra de estado, confirmação
 *   3. CSS .......................... estilos do painel e dos modais
 *   4. ESTRUTURA (DOM) .............. o HTML do painel e dos 3 modais
 *   5. DESENHADORES (render) ........ um por aba; lêem a automação e escrevem no DOM
 *   6. AÇÕES (bind) ................. cada botão com confirmação, estado "rodando" e resposta
 *   7. ARRANQUE ..................... liga tudo, agenda os redesenhos, auto-limpeza de timers
 *
 * REGRAS QUE ESTE PAINEL CUMPRE:
 *   • Nomes de USUÁRIO, não nomes de função da automação. Jargão tem tradução (botão "?").
 *   • Cada controle tem UMA LINHA de explicação e diz o que faz ao ser clicado.
 *   • Estados visíveis: verde = ligado/rodando · cinza = desligado · amarelo = à espera/pausado.
 *   • Nada de botões mortos: se a automação não tem a função, o botão fica desativado e DIZ POR QUÊ.
 *   • Ações destrutivas pedem confirmação (vender, reanunciar, gastar pontos, apostar no Ornn).
 *   • A automação nunca é modificado daqui: só se lê estado e se chamam funções existentes.
 * =============================================================================
 */
(() => {
  'use strict';

  // ============================================================ 0. CONSTANTES
  const STORAGE_KEY = 'lolidleAutoPotion';
  const STATUS_KEY = STORAGE_KEY + ':status';
  const PLAN_KEY = STORAGE_KEY + ':plan';
  const FARM_KEY = STORAGE_KEY + ':farm';
  const AGG_KEY = STORAGE_KEY + ':agregado';
  const TESTES_KEY = STORAGE_KEY + ':testes';
  // Chaves que o MOTOR grava (automation.js: salvarCofre/salvarOfertas). A GUI lê-as para
  // MOSTRAR o que já foi recolhido, sem obrigar o usuário carregando em botões.
  const COFRE_KEY = STORAGE_KEY + ':cofre';       // { at, itens }, conteúdo do cofre
  const OFERTAS_KEY = STORAGE_KEY + ':ofertas';   // { at, ofertas }, minhas ofertas
  // ESTADO COMPLETO do jogo (automation.js: `estadoCompleto`, gravado a cada 20 s). A GUI lê-o
  // para mostrar inventário/cofre/habilidades/mobs/bosses SEM varrer o DOM nem custar nada.
  const ESTADO_KEY = STORAGE_KEY + ':estado';     // { at, campeao, inventario, cofre, ... }
  // Preferências SÓ da GUI (não são config da automação: `setConfig` escreve no objeto que o
  // motor lê e um campo desconhecido lá dentro seria lixo na config dele). Guarda aqui o
  // minimizar do bloco da build por fase e dos cartões de farm, e a modalidade de farm escolhida.
  const GUI_KEY = STORAGE_KEY + ':gui';

  const ORDER = ['vidaS', 'vidaF', 'vida'];
  const POCAO_NOME = { vidaS: 'Suprema', vidaF: 'Forte', vida: 'Normal' };
  const RABADON = '3089';
  const LOGO = 'https://lolidle.com/assets/img/logo.png';
  // ---- ícones de item --------------------------------------------------------
  // O jogo guarda a arte do item REFINADO em `assets/img/itens/ref/<base>-<N>.png` e a base
  // em `assets/img/itens/<base>.png` (jogo.js:167). `BASE_ID` tira o "+N" e o "~..." de ids
  // completos como `3071+2~S`; `ITEM_IMG(id, refino)` escolhe o caminho certo SEM copiar número
  // (REGRA N.º 3). Sem base, devolve '' e o chamador mostra o marcador neutro.
  const BASE_ID = (id) => {
    const s = String(id == null ? '' : id).trim();
    if (!s) return '';
    const m = /^([^+~]+)/.exec(s);
    return (m ? m[1] : s).replace(/\.png$/i, '').replace(/\s+$/, '');
  };
  const REF_DE = (id) => {
    const m = /\+(\d+)/.exec(String(id == null ? '' : id));
    return m ? Number(m[1]) : 0;
  };
  const ITEM_IMG_BASE = (id) => 'https://lolidle.com/assets/img/itens/' + BASE_ID(id) + '.png';
  const ITEM_IMG = (id, refino) => {
    const base = BASE_ID(id);
    if (!base) return '';
    const n = Number(refino) || REF_DE(id);
    return n > 0 ? 'https://lolidle.com/assets/img/itens/ref/' + base + '-' + n + '.png' : ITEM_IMG_BASE(id);
  };
  // Marcador neutro quando nem a arte base existe: nunca uma imagem partida.
  const IMG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  /** `<img>` de item com FALLBACK: arte refinada -> arte base -> marcador neutro. */
  const itemImgTag = (id, refino, titulo, cls) => {
    const base = BASE_ID(id);
    const n = Number(refino) || REF_DE(id);
    const src = ITEM_IMG(id, n);
    const tit = String(titulo == null ? '' : titulo);
    if (!src) return '<span class="item-na" title="' + tit + '">?</span>';
    const err = n > 0 ? ('this.onerror=null;this.src=\'' + ITEM_IMG_BASE(id) + '\'')
      : ('this.onerror=null;this.src=\'' + IMG_1PX + '\'');
    return '<img class="' + String(cls || '') + '" src="' + src + '" alt="" loading="lazy" title="' + tit + '" onerror="' + err + '">';
  };

  // Nomes de usuário para as ações que a automação dá em MAIÚSCULAS técnicas.
  const ACAO_ITEM = {
    PROTEGER: { txt: 'Protegido, não sai da mochila', cls: 'proteg' },
    GUARDAR: { txt: 'Fica guardado na mochila', cls: 'guard' },
    GUARDAR_COFRE: { txt: 'Vai para o cofre', cls: 'guard' },
    ANUNCIAR_MERCADO: { txt: 'Vai para o mercado (venda a jogadores)', cls: 'mkt' },
    VENDER_LOJISTA: { txt: 'Vai ser VENDIDO ao lojista', cls: 'loj' },
  };
  // Tradução das "travas" internas da automação (diagnosticoBase) para português de gente.
  const TRADUZ_TRAVA = [
    [/^enabled=false$/, 'o auto-play está DESLIGADO (liga no switch aqui em cima)'],
    [/^pausado$/, 'está PAUSADO (botão ⏸)'],
    [/^nao-esta-na-base$/, 'você já não está na Fonte'],
    [/^ocupado/, 'há uma janela do jogo aberta (mercado/loja), a automação espera que você feche'],
    [/^_baseBusy/, 'a rotina da base está rodando neste momento'],
    [/^baseLock/, 'a rotina da base ficou presa (destranca sozinha em segundos)'],
    [/^idle (\d+)s < (\d+)s$/, 'só sai da Fonte depois de estar parado tempo suficiente'],
    [/^sem regiao ideal$/, 'não encontrou nenhuma região boa para o seu nível'],
  ];
  const traduzTrava = (t) => {
    for (const [re, txt] of TRADUZ_TRAVA) if (re.test(String(t))) return txt + (re.source.includes('idle') ? ' (' + t + ')' : '');
    return String(t);
  };
  // TRAVA real = o que impede a automação de agir. "idle ...s < ...s" e "nao-esta-na-base" NÃO são
  // travas: são esperas naturais (a automação só sai da Fonte depois de parado, e estar fora da
  // Fonte não bloqueia nada). A automação passa a mandá-las em `espera` (automation.js:
  // `diagnosticoBase`); até lá, filtram-se aqui para a GUI nunca chamar "trava" ao que é só espera.
  const TRAVA_ESPERA = [/^nao-esta-na-base$/, /^idle \d+s < \d+s$/];
  const travaReal = (dg) => {
    const t = (dg && dg.trava) ? dg.trava : [];
    return t.filter((x) => !TRAVA_ESPERA.some((re) => re.test(String(x))));
  };
  const esperaReal = (dg) => {
    const e = (dg && dg.espera) ? dg.espera : null;
    return Array.isArray(e) ? e.filter((x) => String(x || '').trim()) : [];
  };
  // Nomes de usuário para os eventos da automação (aba Histórico).
  const EVENTO_NOME = {
    pause: 'pausa', morte: 'morte', tarefa: 'tarefa', diaria: 'missão diária', campeao: 'campeão detectado',
    teste: 'teste de conjuntos', 'giro-ir': 'viajando para região', 'giro-fim': 'giro terminado', ornn: 'Ornn',
    montagem: 'montagem no Ornn', base: 'rotina de base', cofre: 'cofre', 'chefe-fatal': 'chefe perigoso',
    novidades: 'novidades do jogo', habilidades: 'subir habilidades', atributos: 'atributos',
    runeterra: 'Runeterra (manual)', mercado: 'mercado', compra: 'compra', refino: 'refino',
    ciclo: 'ciclo', wave: 'onda', alvo: 'alvo', loot: 'loot', chefe: 'chefe', xp: 'experiência', ouro: 'ouro',
switches: 'interruptores',
    'build-fase': 'troca de build (mobs ↔ chefe)',
  };

  /** Eventos de ROTINA que não dizem nada ao jogador (subir habilidade, repor a barra, golpe a
   *  golpe do chefe, resumo de grupo). O histórico é do bolso e da vida, não da automação. */
  const RUIDO_HIST = new Set([
    'habilidades', 'rotacao', 'skills', 'barra', 'ofertas', 'regioes',
    'evento:habilidade', 'evento:grupo', 'evento:efeito',
    'evento:chefeGolpe', 'evento:chefeCarrega', 'evento:chefeInterrompido',
  ]);

  let config = null;      // espelho de chrome.storage.local[STORAGE_KEY]
  let status = null;      // espelho de STATUS_KEY (content.js: HP, poções, última ação)
  let farmStore = null;   // espelho de FARM_KEY
  let aggStore = null;    // espelho de AGG_KEY
  let cofreStore = null;  // espelho de COFRE_KEY: { at, itens }, última leitura GRAVADA do cofre
  let ofertasStore = null;// espelho de OFERTAS_KEY: { at, ofertas }, última leitura do mercado
  let estadoStore = null; // espelho de ESTADO_KEY: estado COMPLETO do jogo (motor grava a cada 20 s)
  let aberto = false, saveTimer = null, tabAtiva = 'painel', ultimoRender = 0, cacheAgora = { at: 0, v: null };
  // Espelho de GUI_KEY (preferências da GUI, não da automação). `bfAberto`: o bloco da build por
  // fase está aberto? `farmModo`: 'sozinho' (a automação escolhe a região) ou 'item' (escolhe-se
  // o que dropar). Lido no boot e reescrito a cada clique - sobrevive ao F5.
  let guiPrefs = { bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false };

  // ============================================================ 0b. AJUDANTES
  const $ = (id) => document.getElementById(id);
  const q1 = (s) => document.querySelector(s);
  const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  // Toda a gente que lê a GUI é jogador, não programador: as citações `[motor.js:123]` que os
  // motivos trazem para dentro do código saem AQUI, no único sítio que desenha texto.
  const semFonte = (s) => String(s == null ? '' : s).replace(/\s*\[(?:motor|jogo|inject|cena|dialogo)\.js[^\]]*\]/g, '');
  const esc = (s) => semFonte(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const fmt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('pt-BR') : '-');
  const fmt1 = (n) => (Number.isFinite(Number(n)) ? (Math.round(Number(n) * 10) / 10).toLocaleString('pt-BR') : '-');
  const pct = (n) => (Number.isFinite(Number(n)) ? (Math.round(Number(n) * 1000) / 10).toFixed(1) + '%' : '-');
  const fmtDur = (ms) => {
    const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'min ' + String(s % 60).padStart(2, '0') + 's';
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min';
  };
  const hora = (t) => (t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-');
  const limparNivel = (s) => String(s || '?').replace(/\s*n[íi]vel.*$/i, '').replace(/\s*\(.*?\)\s*$/, '').trim();
  const capNome = (id) => { const s = String(id == null ? '' : id).trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
  const potIcon = (k) => (q1('#hud-pocoes [data-pocao="' + k + '"] img') || {}).src || '';
  // Número como o JOGO o escreve. O `fmt` do jogo (docs/game-src/cena.js:225) mete sufixo
  // acima de 10.000 ("12.3k") e acima de 1.000.000 ("1.2M") - e é esse texto que vive no DOM
  // (#hud-vida-txt, jogo.js:6203; #st-vida-txt, jogo.js:6438). O parser antigo apagava o sufixo
  // e corrompia a leitura EM SILÊNCIO ("12.3k" virava 123). REGRA (a mesma provada no
  // content.js): grupo de 3 casas ("4.188") é MILHAR; com sufixo ("12.3k") é decimal;
  // k = x1.000, M = x1.000.000. Com inteiros, o comportamento é idêntico ao de antes.
  const SUFIXO_NUM = { k: 1e3, K: 1e3, m: 1e6, M: 1e6 };
  const num = (s) => {
    const txt = String(s == null ? '' : s).replace(/[\s\u00a0\u202f]/g, '');
    const m = /([\d.,]+)\s*([kKmM])?/.exec(txt);
    const d = m ? m[1] : '';
    if (!d) return 0;
    const v = /^\d{1,3}([.,]\d{3})+$/.test(d) ? Number(d.replace(/[.,]/g, ''))
      : /^\d+[.,]\d+$/.test(d) ? Number(d.replace(',', '.'))
        : Number(d.replace(/[.,]/g, ''));
    const mult = SUFIXO_NUM[(m && m[2]) || ''] || 1;
    return Number.isFinite(v) ? v * mult : 0;
  };
  const porMin = (v, ms) => (v || 0) / Math.max(0.05, (Number(ms) || 1) / 60000);

  // ============================================================ 1. PONTE COM O MOTOR
  const MOTOR = () => window.__lolidleAuto || null;
  /** Chama uma função da automação SEM nunca rebentar a GUI. Devolve {ok, v} ou {ok:false, erro}. */
  function chamar(nome) {
    const m = MOTOR();
    if (!m) return { ok: false, erro: 'sem-motor' };
    const f = m[nome];
    if (typeof f !== 'function') return { ok: false, erro: 'sem-funcao' };
    try { return { ok: true, v: f.apply(m, Array.prototype.slice.call(arguments, 1)) }; }
    catch (e) { return { ok: false, erro: String((e && e.message) || e) }; }
  }
  async function chamarA(nome) {
    const m = MOTOR();
    if (!m) return { ok: false, erro: 'sem-motor' };
    const f = m[nome];
    if (typeof f !== 'function') return { ok: false, erro: 'sem-funcao' };
    try { return { ok: true, v: await f.apply(m, Array.prototype.slice.call(arguments, 1)) }; }
    catch (e) { return { ok: false, erro: String((e && e.message) || e) }; }
  }
  /** Atalho de LEITURA: devolve o valor ou um valor de recurso.
   *  Regra da ponte: TODOS os argumentos a partir do 3.º são repassados à automação. Sem isso,
   *  `ler('planBag', null, bag)` chamava `planBag()` sem a mochila e a automação rebentava com
   *  "Cannot read properties of undefined (reading 'items')" - e na GUI isso aparecia como
   *  "não foi possível calcular o plano da mochila": um erro NOSSO mostrado como falha da automação.
   *  O mesmo vale para `rankRegioes(obj)`, `dpsItens(ids, regiao)`, `preverBuild(ids, regiao)`,
   *  `ehUltimate(t)`, `localId(txt)`, `planPotions(pot)` e `faltandoNaBase(n)`. */
  function ler(nome, rec) {
    const extra = Array.prototype.slice.call(arguments, 2);
    const r = extra.length ? chamar.apply(null, [nome].concat(extra)) : chamar(nome);
    return r.ok && r.v != null ? r.v : (rec === undefined ? null : rec);
  }
  const erroLegivel = (erro, nome) => {
    if (erro === 'sem-motor') return 'o auto-play ainda não carregou nesta página, recarrega com F5';
    if (erro === 'sem-funcao') return 'esta versão da automação não tem a função "' + nome + '" (nada foi feito)';
    return String(erro);
  };
  /** Nome legível de um item (do catálogo da automação). */
  const nomeItem = (base) => {
    const meta = ler('getMeta', {}) || {};
    const it = (meta.itens || []).find((x) => String(x.id) === String(base));
    return it ? (it.nome || String(base)) : String(base);
  };
  /** Ordem de apresentação das listas de itens (pedido do dono, 2026-10-20): primeiro os
   *  LENDÁRIOS, depois épicos e básicos; dentro de cada raridade, maior TIER (qualidade) e
   *  maior REFINO primeiro. Raridade vem do catálogo da automação (`getMeta`), não de uma cópia. */
  const RAR_ORDEM_GUI = { lendario: 0, epico: 1, basico: 2 };
  const raridadeDoItem = (x) => {
    if (x && x.raridade) return String(x.raridade).toLowerCase();
    const base = BASE_ID((x && (x.base || x.id)) || x || '');
    const nome = String((x && (x.nome || x.item)) || '').trim().toLowerCase();
    const mapa = cache('gui-raridade-itens', 30000, () => {
      const m = { porBase: new Map(), porNome: new Map() };
      for (const it of metaItens()) {
        if (!it || it.id == null) continue;
        const r = String(it.raridade || (it.lendario ? 'lendario' : 'basico')).toLowerCase();
        m.porBase.set(String(it.id), r);
        if (it.nome) m.porNome.set(String(it.nome).trim().toLowerCase(), r);
      }
      return m;
    });
    return (base && mapa.porBase.get(String(base))) || (nome && mapa.porNome.get(nome)) || 'basico';
  };
  const ordemItemGui = (a, b) => {
    const ra = RAR_ORDEM_GUI[raridadeDoItem(a)];
    const rb = RAR_ORDEM_GUI[raridadeDoItem(b)];
    const da = ra == null ? 9 : ra, db = rb == null ? 9 : rb;
    if (da !== db) return da - db;
    const qa = qOrd(a && a.qual), qb = qOrd(b && b.qual);
    if (qa !== qb) return qb - qa;
    const fa = Number((a && a.refino) || 0), fb = Number((b && b.refino) || 0);
    if (fa !== fb) return fb - fa;
    return String((a && (a.nome || a.item || a.base)) || '').localeCompare(String((b && (b.nome || b.item || b.base)) || ''));
  };
  /** Cópia ordenada (não mexe no array da automação): lendários → maior tier → maior refino. */
  const ordenarItens = (arr) => (Array.isArray(arr) ? arr.slice().sort(ordemItemGui) : []);
  /** Itens da BUILD IDEAL do campeão (e os componentes dela). Lidos do motor, nada escrito à mão. */
  const ideaisDoCampeao = () => cache('gui-ideais', 20000, () => {
    const s = new Set();
    try { for (const b of (buildIdeal() || [])) s.add(BASE_ID(String(b))); } catch { /* sem motor */ }
    try {
      const c = ler('componentesDaBuild', null);
      if (c) { if (typeof c.forEach === 'function') c.forEach((b) => s.add(BASE_ID(String(b)))); }
    } catch { /* ignore */ }
    return s;
  });
  /** MERCADO: os itens IDEIAS vêm SEMPRE primeiro (ordem do dono, 2026-10-23, verbatim: "qualquer
   *  item do mercado tem que vir primeiro os itens ideais do campeao"). Depois disso, a ordem
   *  normal (raridade -> qualidade -> refino). */
  const ordemMercado = (a, b) => {
    const s = ideaisDoCampeao();
    const base = (x) => BASE_ID(String((x && (x.base || x.id || x.item)) || ''));
    const ia = s.has(base(a)) ? 0 : 1;
    const ib = s.has(base(b)) ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return ordemItemGui(a, b);
  };
  const ordenarMercado = (arr) => (Array.isArray(arr) ? arr.slice().sort(ordemMercado) : []);
  const ehIdeal = (x) => {
    try { return ideaisDoCampeao().has(BASE_ID(String((x && (x.base || x.id || x.item)) || ''))); } catch { return false; }
  };
  const locais = () => (ler('getMeta', {}) || {}).locais || [];
  const nomeRegiao = (id) => { const l = locais().find((x) => x.id === id); return l ? limparNivel(l.nome) : String(id || '-'); };
  const idRegiaoDe = (txt) => ler('localId', null, txt) || null;

  // ============================================================ 2. KIT DE INTERFACE
  // TEXTO CORTO (ordem do dono, 2026-10-21): o subtítulo de ajuda saiu do cabeçalho. O título
  // diz o que é; o resto era explicação do óbvio.
  const card = (titulo, ajuda, corpo, id) =>
    '<section class="card"' + (id ? ' id="' + id + '"' : '') + '><h3>' + titulo +
    '</h3><div class="corpo">' + corpo + '</div></section>';
  /** Cartão com botão de MINIMIZAR no cabeçalho (o mesmo padrão do bloco da build por fase).
   *  `min` = true mostra só o título; o estado vive nas preferências da GUI e sobrevive ao F5. */
  const cardMin = (id, titulo, ajuda, corpo, min, btnId, aberto) =>
    '<section class="card' + (min ? ' min' : '') + '"' + (id ? ' id="' + id + '"' : '') + '><h3>' + titulo +
    '<button class="ic bf-min" id="' + btnId + '" title="' +
    (aberto ? 'Minimizar: deixa só o título (o mesmo botão volta abrindo)' : 'Abrir este bloco') + '">' +
    (aberto ? '▾' : '▸') + '</button></h3><div class="corpo">' + corpo + '</div></section>';
  const kv = (rotulo, valor, ajuda) =>
    '<div class="kv2"><span>' + rotulo + '</span><b>' + valor + '</b></div>';
  const linha = (rotulo, ajuda, ctrl) =>
    '<div class="ctl"><div class="ctl-l"><b>' + rotulo + '</b></div><div class="ctl-c">' + ctrl + '</div></div>';
  // `off` (opcional): botão que NÃO pode ser usado agora - fica desativado.
  const acao = (id, texto, ajuda, cls, off) =>
    '<div class="acao"><button id="' + id + '" class="btn ' + (cls || '') + '"' + (off ? ' disabled' : '') + '>' + texto + '</button></div>';
  /** Bloco de AÇÕES MANUAIS - sempre despromovido e no fim do cartão.
   *  A GUI mostra o que acontece SOZINHO (estado, switches, o que a automação vai fazer e o que
   *  está bloqueado); o clique manual fica aqui, rotulado como manutenção manual, para não
   *  parecer o caminho normal. Nada foi apagado: os mesmos handlers continuam ligados aos
   *  mesmos ids. */
  const diag = (titulo, corpo) => '<p class="diag-t">' + titulo + '</p>' + (corpo || '');
  const acaoD = (id, texto, ajuda, off) =>
    '<div class="acao"><button id="' + id + '" class="btn sec"' + (off ? ' disabled' : '') + '>' + texto
    + '<small class="tagd">manual</small></button></div>';
  const tg = (id, rotulo, ajuda, marcado) =>
    '<label class="tg"><input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + '><span class="sw"></span>' +
    '<span class="tg-t"><b>' + rotulo + '</b></span></label>';
  /** Igual ao `tg`, mas com a CHAVE da automação em `data-cfg`. O handler genérico lê-a e escreve por
   *  `definirCfg` - é assim que a GUI nunca escreve o nome da chave à mão (lê-o da automação). */
  const tgCfg = (id, cfgKey, rotulo, ajuda, marcado) =>
    '<label class="tg"><input type="checkbox" id="' + id + '" data-cfg="' + esc(cfgKey) + '"' + (marcado ? ' checked' : '') + '><span class="sw"></span>' +
    '<span class="tg-t"><b>' + rotulo + '</b></span></label>';
  const itemFrame = (base, qual, refino, raridade, titulo) =>
    '<span class="iframe ' + esc(raridade || '') + '" title="' + esc(titulo || '') + '">' +
    // O REFINO muda a ARTE (jogo.js:167): usa-se a pasta `ref/<base>-<N>.png` quando há refino.
    '<img src="' + ITEM_IMG(base, refino) + '" alt="" loading="lazy" onerror="this.style.opacity=.2">' +
    (qual ? '<b class="q">' + esc(qual) + (refino ? '+' + esc(refino) : '') + '</b>' : '') + '</span>';
  const tabela = (colunas, linhas, vazio) => {
    const corpo = Array.isArray(linhas) ? linhas.join('') : String(linhas == null ? '' : linhas);
    if (!corpo) return '<p class="vazio">' + (vazio || 'sem dados ainda') + '</p>';
    return '<div class="scroll"><table class="tbl"><thead><tr>' + colunas.map((c) => '<th>' + c + '</th>').join('') +
      '</tr></thead><tbody>' + corpo + '</tbody></table></div>';
  };

  /** Faixa de resposta do rodapé - TODAS as ações escrevem aqui. */
  function fb(tipo, txt) {
    const el = $('ap-fb');
    if (!el) return;
    el.className = 'fb ' + (tipo || 'info');
    el.innerHTML = (tipo === 'run' ? '<i class="spin"></i>' : tipo === 'ok' ? '✔ ' : tipo === 'err' ? '✖ ' : tipo === 'warn' ? '⚠ ' : '') + esc(txt);
  }
  const fbOk = (t) => fb('ok', t);
  const fbErro = (t) => fb('err', t);
  const fbAviso = (t) => fb('warn', t);
  const fbCorrer = (t) => fb('run', t);

  /** Botão ocupado enquanto a ação corre (feedback imediato a cada clique). */
  function ocupar(btn, ocupado) {
    if (!btn) return;
    btn.disabled = !!ocupado;
    btn.classList.toggle('busy', !!ocupado);
  }

  // ---- confirmação para ações destrutivas ------------------------------------
  let confirmarResolve = null;
  function confirmar(titulo, linhas, textoOk, perigo) {
    return new Promise((resolve) => {
      const m = $('lolidle-ap-confirma');
      if (!m) { resolve(true); return; }
      $('ap-cf-titulo').textContent = titulo;
      $('ap-cf-corpo').innerHTML = (linhas || []).map((l) => '<li>' + l + '</li>').join('');
      const ok = $('ap-cf-ok');
      ok.textContent = textoOk || 'Confirmar';
      ok.className = 'btn ' + (perigo ? 'danger' : '');
      confirmarResolve = resolve;
      m.hidden = false; m.classList.add('on');
    });
  }
  function fecharConfirmar(resposta) {
    const m = $('lolidle-ap-confirma');
    if (m) { m.hidden = true; m.classList.remove('on'); }
    const r = confirmarResolve; confirmarResolve = null;
    if (r) r(!!resposta);
  }

  /** Envelope de TODAS as ações: confirmação → "rodando" → resultado ou motivo da falha. */
  async function executar(btn, rotulo, trabalho, opt) {
    opt = opt || {};
    if (opt.confirma) {
      const sim = await confirmar(opt.confirma.titulo, opt.confirma.linhas, opt.confirma.ok, opt.confirma.perigo);
      if (!sim) { fbAviso('Cancelado, nada foi feito.'); return null; }
    }
    ocupar(btn, true);
    fbCorrer(rotulo + '…');
    let res;
    try { res = await trabalho(); }
    catch (e) { res = { ok: false, motivo: 'erro inesperado: ' + String((e && e.message) || e) }; }
    ocupar(btn, false);
    if (res === undefined || res === null) { fbOk(rotulo + ': feito.'); res = { ok: true }; }
    else if (res.ok === false) fbErro(rotulo + ': ' + (res.motivo || res.erro || 'não foi possível (a automação não disse porquê)'));
    else if (res.erro) fbErro(rotulo + ': ' + erroLegivel(res.erro, res.funcao));
    else fbOk(rotulo + ': ' + (res.msg || 'feito.'));
    if (typeof res === 'object' && res) res.__rotulo = rotulo;
    return res;
  }
  /** Resultado de uma chamada à automação, já traduzido para o envelope acima. */
  const resMotor = (r, funcao, msgOk) => {
    if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, funcao), erro: r.erro, funcao };
    const v = r.v;
    if (v && typeof v === 'object' && v.ok === false) return { ok: false, motivo: v.motivo || 'a automação recusou', v };
    return { ok: true, msg: typeof msgOk === 'function' ? msgOk(v) : (msgOk || 'feito'), v };
  };

  // ============================================================ 3. CSS
  // SISTEMA DE DESIGN v3 (revamp completo, ordem do dono 2026-10-22: "gui ta overwhelming,
  // design pessimo, complete overhaul"). O tema antigo era sépia com DOURADO EM TUDO (título de
  // cartão, botão, interruptor, borda) e caixas dentro de caixas - por isso "tudo parecia igual"
  // e a vista não tinha onde descansar. Aqui a hierarquia vem de ESPAÇO e TAMANHO, não de cor:
  // cinza-grafite neutro, UM acento (dourado) só no que está activo, títulos de cartão em
  // maiúsculas pequenas e discretas, e um rail de navegação à esquerda em vez de 9 separadores
  // a competir com o conteúdo.
  const CSS = [
    '#lolidle-ap{--bg:#0a0c10;--pnl:#101318;--pnl2:#151922;--pnl3:#1b2029;--lin:#29303c;--lin2:#1d232c;--txt:#eef2f8;--dim:#a7b2c3;--mut:#7c8798;--ouro:#f0c24e;--verde:#3fd97f;--ambar:#ffab2e;--verm:#ff6b5b;--azul:#6fa8ff;',
    'position:fixed;top:14px;right:14px;z-index:2147483647;width:min(1200px,95vw);height:auto;max-height:calc(100vh - 28px);display:none;flex-direction:column;overflow:hidden;',
    'background:var(--bg);color:var(--txt);border:1px solid var(--lin);border-radius:16px;box-shadow:0 28px 90px #000e,0 1px 0 #ffffff0d inset;',
    'font:13px/1.55 "Inter","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;opacity:0;visibility:hidden;transform:translateY(-8px);transition:opacity .14s,transform .14s}',
    '#lolidle-ap.on{opacity:1;visibility:visible;display:flex;transform:none}',
    '#lolidle-ap *{box-sizing:border-box;min-width:0}',
    '#lolidle-ap ::-webkit-scrollbar{width:10px;height:10px}',
    '#lolidle-ap ::-webkit-scrollbar-track{background:transparent}',
    '#lolidle-ap ::-webkit-scrollbar-thumb{background:#2b333f;border-radius:8px;border:3px solid transparent;background-clip:content-box}',
    '#lolidle-ap ::-webkit-scrollbar-thumb:hover{background:#3a4553;background-clip:content-box}',
    '#lolidle-ap .sp{flex:1}',
    // ---- CABEÇALHO: marca + estado + números numa só faixa; o MOTIVO numa linha própria ----
    '#lolidle-ap header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px 14px;padding:12px 16px 10px;background:#0d1015;border-bottom:1px solid var(--lin2)}',
    '#lolidle-ap .brand{display:flex;align-items:center;gap:9px}',
    '#lolidle-ap .logo{height:20px;width:auto;filter:saturate(.9)}',
    '#lolidle-ap .tit{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}',
    '#lolidle-ap .hstats{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
    '#lolidle-ap .hacts{display:flex;align-items:center;gap:4px}',
    '#lolidle-ap .mini{display:flex;align-items:baseline;gap:5px;background:#ffffff05;border:1px solid #ffffff0a;border-radius:999px;padding:3px 9px;max-width:220px}',
    '#lolidle-ap .mini b{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap .mini small{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);white-space:nowrap}',
    '#lolidle-ap .mini.wide{max-width:260px}',
    '#lolidle-ap .fase{grid-column:1/-1;display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--dim);padding:7px 2px 0;border-top:1px solid #ffffff08;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#lolidle-ap .fase::before{content:"";flex:none;width:5px;height:5px;border-radius:50%;background:var(--ouro)}',
    // ---- PÍLULA DE ESTADO (liga/desliga/pausado) ----
    '#lolidle-ap .pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px 3px 8px;font-size:10px;font-weight:800;letter-spacing:.08em;border:1px solid var(--lin);white-space:nowrap}',
    '#lolidle-ap .pill i{width:6px;height:6px;border-radius:50%;background:#525c6b;flex:none}',
    '#lolidle-ap .pill.on{color:#8cf0b4;border-color:#1f5c3a;background:#0f2a1c}#lolidle-ap .pill.on i{background:var(--verde);box-shadow:0 0 8px #3fd97faa}',
    '#lolidle-ap .pill.off{color:var(--dim)}#lolidle-ap .pill.off i{background:#525c6b}',
    '#lolidle-ap .pill.run{color:#ffd79a;border-color:#6b4a14;background:#2a1d08}#lolidle-ap .pill.run i{background:var(--ambar);box-shadow:0 0 8px #ffab2eaa}',
    '#lolidle-ap .pill.err{color:#ffb3aa;border-color:#6d2a20;background:#2a1210}#lolidle-ap .pill.err i{background:var(--verm)}',
    '#lolidle-ap .ic{width:28px;height:26px;display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--dim);border:1px solid transparent;border-radius:8px;cursor:pointer;font:inherit;font-size:13px;line-height:1;padding:0}',
    '#lolidle-ap .ic:hover{background:#ffffff0a;color:var(--txt);border-color:var(--lin2)}',
    '#lolidle-ap .ic.ativo{color:var(--ouro);background:#f0c24e14;border-color:#4a3b10}',
    // ---- INTERRUPTOR (um só desenho, tamanhos diferentes) ----
    '#lolidle-ap .sw{position:relative;width:40px;height:22px;flex:none;display:inline-block}',
    '#lolidle-ap .sw::before{content:"";position:absolute;inset:0;background:#2a313c;border-radius:999px;transition:.16s}',
    '#lolidle-ap .sw::after{content:"";position:absolute;width:16px;height:16px;left:3px;top:3px;background:#8b95a5;border-radius:50%;transition:.16s}',
    '#lolidle-ap input:checked+.sw::before{background:#17492e}',
    '#lolidle-ap input:checked+.sw::after{transform:translateX(18px);background:var(--verde)}',
    '#lolidle-ap .tg input,#lolidle-ap .arv-tg input,#lolidle-ap .mestre-tg input{display:none}',
    // ---- RAIL DE NAVEGAÇÃO (esquerda) + CONTEÚDO ----
    '#lolidle-ap .shell{display:flex;flex:1;min-height:0}',
    '#lolidle-ap nav{width:190px;flex:none;display:flex;flex-direction:column;gap:1px;padding:10px 10px 14px;background:#0b0e12;border-right:1px solid var(--lin2);overflow:auto}',
    '#lolidle-ap .nav-sec{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#606b7b;padding:14px 10px 5px}',
    '#lolidle-ap .tab{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:var(--dim);font:inherit;font-size:12.5px;font-weight:600;text-align:left;cursor:pointer;position:relative;transition:background .1s,color .1s}',
    '#lolidle-ap .tab i{font-style:normal;font-size:12px;width:15px;text-align:center;opacity:.65}',
    '#lolidle-ap .tab:hover{background:#ffffff07;color:var(--txt)}',
    '#lolidle-ap .tab.ativa{background:#f0c24e0f;color:var(--ouro)}',
    '#lolidle-ap .tab.ativa i{opacity:1}',
    '#lolidle-ap .tab.ativa::before{content:"";position:absolute;left:-10px;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--ouro)}',
    // `justify-content` reposto: o `main` GLOBAL do jogo tem `justify-content:center` e vazava
    // para dentro do painel, centrando o conteúdo alto e pondo o topo em y negativo (causa
    // medida do "painel truncado", TK-02 §3). O rail não muda isso - a regra fica.
    '#lolidle-ap main{flex:1;overflow:auto;padding:14px 16px 20px;display:flex;flex-direction:column;gap:10px;justify-content:flex-start;align-items:stretch;scrollbar-gutter:stable}',
    '#lolidle-ap .pane{display:none;flex-direction:column;gap:10px}',
    '#lolidle-ap .pane.on{display:flex}',
    '@media (max-width:860px){#lolidle-ap nav{width:56px;padding:10px 6px}#lolidle-ap .nav-sec,#lolidle-ap .tab span{display:none}#lolidle-ap .tab{justify-content:center;padding:9px 0}#lolidle-ap .tab i{width:auto;font-size:15px}}',
    // ---- CARTÃO: o único contentor. Sem moldura dentro de moldura ----
    '#lolidle-ap .card{background:var(--pnl);border:1px solid var(--lin2);border-radius:14px;padding:14px 16px}',
    '#lolidle-ap .card>h3{margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a95a6;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '#lolidle-ap .card>h3 .obs{font-size:11px;font-weight:500;letter-spacing:.01em;text-transform:none;color:var(--mut);margin-left:auto}',
    '#lolidle-ap .card .corpo{display:flex;flex-direction:column;gap:8px}',
    '#lolidle-ap .card.min{padding:10px 14px}',
    '#lolidle-ap .card.min .corpo{display:none}',
    '#lolidle-ap .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#lolidle-ap .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
    '@media (max-width:900px){#lolidle-ap .grid2,#lolidle-ap .grid3{grid-template-columns:1fr}}',
    // ---- CARTÃO MESTRE (o interruptor do auto-play) ----
    '#lolidle-ap .card.mestre{border-color:#26303d;background:linear-gradient(180deg,#141922,#0f1319)}',
    '#lolidle-ap .card.mestre.on{border-color:#1f5c3a;background:linear-gradient(180deg,#10231a,#0d1512)}',
    '#lolidle-ap .card.mestre.run{border-color:#6b4a14;background:linear-gradient(180deg,#231a0a,#12100c)}',
    '#lolidle-ap .card.mestre.err{border-color:#6d2a20;background:linear-gradient(180deg,#241110,#131010)}',
    '#lolidle-ap .mestre-l{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '#lolidle-ap .mestre-tg{display:flex;align-items:center;gap:12px;background:#0000003d;border:1px solid var(--lin);border-radius:12px;padding:8px 14px;cursor:pointer}',
    '#lolidle-ap .mestre-tg .sw{width:54px;height:30px}',
    '#lolidle-ap .mestre-tg .sw::after{width:22px;height:22px;left:4px;top:4px}',
    '#lolidle-ap .mestre-tg input:checked+.sw::after{transform:translateX(24px)}',
    '#lolidle-ap .mestre-est{font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}',
    '#lolidle-ap .mestre-est.on{color:var(--verde)}#lolidle-ap .mestre-est.off{color:var(--dim)}',
    '#lolidle-ap .mestre-est.run{color:var(--ambar)}#lolidle-ap .mestre-est.err{color:var(--verm)}',
    '#lolidle-ap .mestre-txt{color:var(--mut);font-size:11.5px;flex:1;min-width:200px}',
    '#lolidle-ap .mestre-arvore{margin-top:12px;padding-top:12px;border-top:1px solid var(--lin2)}',
    '#lolidle-ap .mestre-sub{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 8px}',
    '#lolidle-ap .mestre-sub b{font-size:12px;color:var(--txt)}',
    '#lolidle-ap .mestre-sub span{font-size:11px;color:var(--mut)}',
    // ---- ÁRVORE DE INTERRUPTORES ----
    '#lolidle-ap .arv{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:6px 14px;align-items:start}',
    '#lolidle-ap .arv-filhos{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:5px 12px;margin:4px 0 0 8px;padding-left:10px;border-left:1px solid var(--lin)}',
    '#lolidle-ap .arv-item{display:flex;flex-direction:column;gap:3px;min-width:0}',
    '#lolidle-ap .arv-no{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--pnl2);border:1px solid var(--lin2);border-radius:9px;padding:5px 9px}',
    '#lolidle-ap .arv-no>b{font-size:12px;font-weight:600}',
    '#lolidle-ap .arv-no .arv-dot{width:7px;height:7px;border-radius:50%;background:#5a6474;flex:none}',
    '#lolidle-ap .arv-no .arv-est{font-size:10.5px;color:var(--mut)}',
    '#lolidle-ap .arv-no.on .arv-dot{background:var(--verde);box-shadow:0 0 6px #3fd97f99}',
    '#lolidle-ap .arv-no.on .arv-est{color:#8cf0b4}',
    '#lolidle-ap .arv-no.bloq{opacity:.72}',
    '#lolidle-ap .arv-no.bloq .arv-est{color:var(--mut)}',
    '#lolidle-ap .arv-no.skip{border-color:#6b4a14}',
    '#lolidle-ap .arv-no.skip .arv-dot{background:var(--ambar);box-shadow:0 0 6px #ffab2e99}',
    '#lolidle-ap .arv-no .arv-motivo{font-size:10.5px;color:var(--ambar)}',
    '#lolidle-ap .arv-no .arv-motivo b{color:var(--txt)}',
    '#lolidle-ap .arv-no .arv-motivo.err{color:#ffb3aa}',
    '#lolidle-ap .arv-no .arv-cfg,#lolidle-ap .arv-cfg{font-size:10px;color:var(--dim);background:#0c0f14;border:1px solid var(--lin2);border-radius:6px;padding:1px 6px;white-space:nowrap;cursor:pointer}',
    '#lolidle-ap .arv-cfg:hover{color:var(--ouro);border-color:#4a3b10}',
    '#lolidle-ap .arv-no .arv-exc{border-color:#6b4a14;color:var(--ambar);background:#241c0d}',
    '#lolidle-ap .arv-no.mestre{border-color:#3a4a5f;background:#141a23}',
    '#lolidle-ap .arv-no.mestre>b{color:var(--txt)}',
    '#lolidle-ap .arv-no.erro{border-color:#6d2a20;background:#1d1210}',
    '#lolidle-ap .arv-no.erro .arv-dot{background:var(--verm)}',
    '#lolidle-ap .arv-no.erro .arv-est{color:var(--verm)}',
    '#lolidle-ap .arv-erro{font-size:9.5px;color:#ffb3aa;background:#241310;border:1px solid #6d2a20;border-radius:5px;padding:1px 6px;white-space:nowrap}',
    '#lolidle-ap .arv-cobre{margin:0 0 2px;font-size:10.5px;line-height:1.45;padding:1px 9px;border-left:1px solid var(--lin2);color:var(--mut)}',
    '#lolidle-ap .arv-cobre.on{color:#8cf0b4}',
    '#lolidle-ap .arv-cobre.off{color:#ff9a8a}',
    '#lolidle-ap .arv-tg{display:flex;align-items:center;flex:none;cursor:pointer}',
    '#lolidle-ap .arv-tg .sw{width:32px;height:18px}',
    '#lolidle-ap .arv-tg .sw::after{width:12px;height:12px;left:3px;top:3px}',
    '#lolidle-ap .arv-tg input:checked+.sw::after{transform:translateX(14px)}',
    // ---- MÉTRICAS / LISTAS DE ESTADO ----
    '#lolidle-ap .kvs{display:flex;flex-wrap:wrap;gap:6px}',
    '#lolidle-ap .kv2{display:flex;flex-direction:column;background:var(--pnl2);border:1px solid var(--lin2);border-radius:10px;padding:6px 10px;min-width:92px;flex:1}',
    '#lolidle-ap .kv2 span{color:var(--mut);font-size:10px;letter-spacing:.05em;text-transform:uppercase}',
    '#lolidle-ap .kv2 b{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}',
    '#lolidle-ap .kv2 small{color:var(--mut);font-size:10px}',
    '#lolidle-ap .est{margin:0;font-size:11.5px;padding:8px 10px;border-radius:10px;border:1px solid var(--lin2);background:var(--pnl2)}',
    '#lolidle-ap .est b{font-size:12.5px}',
    '#lolidle-ap .est.on{color:#bdf0c8;border-color:#1f5c3a;background:#0f2318}',
    '#lolidle-ap .est.off{color:var(--dim);border-color:var(--lin);background:#101318}',
    '#lolidle-ap .est.run{color:#ffdca8;border-color:#6b4a14;background:#22190b}',
    '#lolidle-ap .est.err{color:#ffc6ba;border-color:#6d2a20;background:#241310}',
    '#lolidle-ap .inimigos{display:flex;flex-direction:column;gap:4px;margin-top:2px}',
    '#lolidle-ap .inimigos .ini{display:flex;align-items:center;gap:8px;font-size:11px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:8px;padding:4px 8px}',
    '#lolidle-ap .inimigos .ini.nome{flex:1;min-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#lolidle-ap .inimigos .ini i{display:block;height:4px;border-radius:3px;flex:0 0 64px;background:#252c37;position:relative;overflow:hidden}',
    '#lolidle-ap .inimigos .ini i b{position:absolute;inset:0 auto 0 0;display:block;border-radius:3px}',
    '#lolidle-ap .inimigos .ini em{font-style:normal;color:var(--mut);font-variant-numeric:tabular-nums;white-space:nowrap}',
    // ---- CONTROLES (linha rótulo + controlo) ----
    '#lolidle-ap .ctl{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid #ffffff06}',
    '#lolidle-ap .ctl:last-child{border-bottom:0}',
    '#lolidle-ap .ctl-l{display:flex;flex-direction:column;flex:1;min-width:200px}',
    '#lolidle-ap .ctl-l b{font-size:12px;font-weight:600}',
    '#lolidle-ap .ctl-l small{color:var(--mut);font-size:10.5px}',
    '#lolidle-ap .ctl-c{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '#lolidle-ap .tg{display:flex;align-items:flex-start;gap:10px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:10px;padding:8px 10px;cursor:pointer}',
    '#lolidle-ap .tg:hover{border-color:var(--lin)}',
    '#lolidle-ap .tg-t{display:flex;flex-direction:column}',
    '#lolidle-ap .tg-t b{font-size:12px;font-weight:600}',
    '#lolidle-ap .tg-t small{color:var(--mut);font-size:10.5px}',
    // ---- BOTÕES ----
    '#lolidle-ap .btn{background:var(--pnl3);color:var(--txt);border:1px solid var(--lin);border-radius:9px;padding:7px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background .1s,border-color .1s}',
    '#lolidle-ap .btn:hover{background:#222b37;border-color:#3a4658}',
    '#lolidle-ap .btn.sec{background:transparent;color:var(--dim)}',
    '#lolidle-ap .btn.sec:hover{color:var(--txt);background:#ffffff08}',
    '#lolidle-ap .btn.warn{background:#2a1d08;color:var(--ambar);border-color:#6b4a14}',
    '#lolidle-ap .btn.danger{background:#3a1512;color:#ffbcb3;border-color:#7a2a22}',
    '#lolidle-ap .btn.big{padding:9px 16px;font-size:13px}',
    '#lolidle-ap .btn:disabled{opacity:.42;cursor:not-allowed}',
    '#lolidle-ap .btn.busy{opacity:.8;cursor:progress}',
    '#lolidle-ap .acoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}',
    '#lolidle-ap .acao{display:flex;flex-direction:column;gap:4px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:10px;padding:8px}',
    '#lolidle-ap .acao small{color:var(--mut);font-size:10.5px;line-height:1.45}',
    '#lolidle-ap .sec-acoes{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '#lolidle-ap .diag-t{margin:8px 0 5px;padding-top:8px;border-top:1px dashed var(--lin);font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.1em}',
    '#lolidle-ap .diag-t + .acoes .acao{background:transparent;border-style:dashed}',
    '#lolidle-ap .diag-t + .acoes .btn{font-size:11px;padding:5px 9px;font-weight:600}',
    '#lolidle-ap .tagd{display:inline-block;font-size:9px;color:var(--mut);border:1px solid var(--lin2);border-radius:5px;padding:0 4px;margin-left:6px;letter-spacing:.06em;text-transform:uppercase}',
    '#lolidle-ap input[type=number],#lolidle-ap input[type=text],#lolidle-ap input[type=search],#lolidle-ap select{background:#0b0e13;color:var(--txt);border:1px solid var(--lin);border-radius:8px;padding:5px 8px;font:inherit;font-size:12px}',
    '#lolidle-ap input[type=number]{width:76px}',
    '#lolidle-ap input:focus,#lolidle-ap select:focus{outline:none;border-color:#4a5a72;box-shadow:0 0 0 2px #4a5a7233}',
    '#lolidle-ap select.auto{border-color:#2c4a6b;background:#0d1620;color:#a9cdff}',
    // ---- TABELAS E LISTAS ----
    '#lolidle-ap .scroll{max-height:260px;overflow:auto;border:1px solid var(--lin2);border-radius:10px}',
    '#lolidle-ap table.tbl{width:100%;border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums}',
    '#lolidle-ap table.tbl th{color:var(--mut);font-weight:600;font-size:10px;letter-spacing:.07em;text-transform:uppercase;text-align:right;padding:6px 8px;border-bottom:1px solid var(--lin);position:sticky;top:0;background:var(--pnl);white-space:nowrap}',
    '#lolidle-ap table.tbl th:first-child,#lolidle-ap table.tbl td:first-child{text-align:left}',
    '#lolidle-ap table.tbl td:first-child{white-space:normal;min-width:90px}',
    '#lolidle-ap table.tbl td{padding:5px 8px;text-align:right;border-bottom:1px solid #ffffff06;color:#d8dfea;white-space:nowrap}',
    '#lolidle-ap table.tbl tr:last-child td{border-bottom:0}',
    '#lolidle-ap table.tbl tbody tr:hover td{background:#ffffff04}',
    '#lolidle-ap table.tbl td:first-child{color:var(--txt)}',
    '#lolidle-ap table.tbl tr.melhor td{background:#12241a}',
    '#lolidle-ap table.tbl td img{width:16px;height:16px;image-rendering:pixelated;vertical-align:-3px;margin-right:5px}',
    '#lolidle-ap .lista{display:flex;flex-direction:column;gap:1px}',
    '#lolidle-ap .ln{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:5px 8px;border-bottom:1px solid #ffffff06;flex-wrap:wrap}',
    '#lolidle-ap .ln:last-child{border-bottom:0}',
    '#lolidle-ap .ln time{color:var(--mut);flex:none;font-variant-numeric:tabular-nums}',
    '#lolidle-ap .ln b{color:var(--txt);font-weight:600}',
    '#lolidle-ap .ln .d{color:var(--dim);flex:1;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap .ln.proteg{border-left:2px solid var(--ouro)}',
    '#lolidle-ap .ln.guard{border-left:2px solid #5a6474}',
    '#lolidle-ap .ln.mkt{border-left:2px solid var(--azul)}',
    '#lolidle-ap .ln.loj{border-left:2px solid var(--verm)}',
    '#lolidle-ap .vazio{color:var(--mut);font-size:11.5px;margin:4px 0}',
    '#lolidle-ap .aviso{margin:2px 0;font-size:11.5px;padding:7px 10px;border-radius:9px;border:1px solid var(--lin2);background:var(--pnl2)}',
    '#lolidle-ap .aviso.ok{color:#bdf0c8;border-color:#1f5c3a;background:#0f2318}',
    '#lolidle-ap .aviso.warn{color:#ffdca8;border-color:#6b4a14;background:#22190b}',
    '#lolidle-ap .aviso.err{color:#ffc6ba;border-color:#6d2a20;background:#241310}',
    '#lolidle-ap .grp{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:8px 0 3px}',
    '#lolidle-ap .grp small{font-weight:600;letter-spacing:0;color:var(--mut)}',
    // ---- ITENS (chips, frames, build) ----
    // FILA HORIZONTAL, não pilha (queixa do dono, 2026-10-22: "os ícones estão horríveis, verticais").
    // A build rola na horizontal e cada peça é um bloco deitado: ícone à esquerda, nome à direita.
    '#lolidle-ap .frames{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}',
    '#lolidle-ap .iframe{position:relative;width:46px;height:46px;background:#0b0e13;border:1px solid var(--lin);border-radius:9px;overflow:hidden;display:inline-block}',
    '#lolidle-ap .iframe img{width:100%;height:100%;object-fit:cover;display:block}',
    '#lolidle-ap .iframe .q{position:absolute;right:2px;bottom:1px;font-size:9px;font-weight:700;background:#000c;border-radius:4px;padding:0 3px;color:#fff}',
    '#lolidle-ap .iframe.lendario{border-color:#b07a20}#lolidle-ap .iframe.epico{border-color:#7a4fbf}',
    '#lolidle-ap .iframe.falta{border-style:dashed;opacity:.7;filter:grayscale(.65)}',
    '#lolidle-ap .chips{display:flex;flex-wrap:wrap;gap:5px}',
    '#lolidle-ap .chip{display:inline-flex;align-items:center;gap:6px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:8px;padding:3px 8px;font-size:11.5px}',
    '#lolidle-ap .chip img{width:18px;height:18px;image-rendering:pixelated}',
    '#lolidle-ap .chip.lendario{border-color:#5a4315}#lolidle-ap .chip.epico{border-color:#3f2f66}',
    '#lolidle-ap .chip small{color:var(--mut)}',
    '#lolidle-ap .chip .wlim{width:80px;padding:1px 4px;font-size:10px;background:#0b0e13;border:1px solid var(--lin2);border-radius:5px;color:var(--txt)}',
    '#lolidle-ap .bf>h3{align-items:center}',
    '#lolidle-ap .bf-min{flex:none;width:26px;height:22px;font-size:11px}',
    '#lolidle-ap .bf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '@media (max-width:900px){#lolidle-ap .bf-grid{grid-template-columns:1fr}}',
    '#lolidle-ap .bf-col{background:var(--pnl2);border:1px solid var(--lin2);border-radius:10px;padding:8px 10px}',
    '#lolidle-ap .bf-col.em-uso{border-color:#4a3b10;box-shadow:inset 0 0 0 1px #4a3b10}',
    '#lolidle-ap .bf-col h4{margin:0 0 4px;font-size:12px;color:var(--txt);display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '#lolidle-ap .bf-col h4 .tag{font-size:9px;background:#2a2110;color:var(--ouro);border:1px solid #4a3b10;border-radius:999px;padding:0 7px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}',
    '#lolidle-ap .bf-col h4 .tag.ok{background:#0f2318;color:var(--verde);border-color:#1f5c3a}',
    '#lolidle-ap .bf-dica{margin:0 0 6px;color:var(--mut);font-size:10px}',
    '#lolidle-ap .bf-itens{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}',
    '#lolidle-ap .bf-item{position:relative;width:auto;height:46px;border:2px solid var(--lin2);border-radius:9px;background:#0b0e13;display:inline-flex;align-items:center;gap:6px;overflow:hidden;padding-right:8px;flex:0 0 auto}',
    '#lolidle-ap .bf-item img{width:42px;height:42px;object-fit:cover;display:block;flex:0 0 auto}',
    '#lolidle-ap .bf-item .q{position:absolute;top:0;right:2px;font-size:9px;font-weight:700;color:var(--ouro);text-shadow:0 0 3px #000}',
    '#lolidle-ap .bf-item small{position:static;font-size:11px;text-align:left;background:none;color:#dbe3ee;line-height:1.3;white-space:nowrap}',
    '#lolidle-ap .bf-item small .bf-nome{font-weight:700;color:#f2f6fb}',
    '#lolidle-ap .bf-item.equipado{border-color:var(--verde)}',
    '#lolidle-ap .bf-item.cofre{border-color:var(--azul)}',
    '#lolidle-ap .bf-item.mercado{border-color:var(--ouro)}',
    '#lolidle-ap .bf-item.falta{border-color:#6d2a20;opacity:.65}',
    '#lolidle-ap .bf-item.falta small{color:#ffb0a0}',
    // ---- BARRAS E POÇÕES ----
    '#lolidle-ap .bar{height:14px;border-radius:7px;background:#242b36;overflow:hidden;position:relative;border:1px solid var(--lin2)}',
    '#lolidle-ap .bar>i{display:block;height:100%;background:linear-gradient(90deg,#1f7a45,#3fd97f);transition:width .25s}',
    '#lolidle-ap .bar>i.low{background:linear-gradient(90deg,#7a4a10,#ffab2e)}',
    '#lolidle-ap .bar>i.crit{background:linear-gradient(90deg,#7a1a12,#ff6b5b)}',
    '#lolidle-ap .bar>u{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:#fff;text-shadow:0 1px 2px #000;text-decoration:none}',
    '#lolidle-ap .pots{display:flex;gap:8px;flex-wrap:wrap}',
    '#lolidle-ap .pot{flex:1;min-width:130px;display:flex;align-items:center;gap:8px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:10px;padding:6px 9px}',
    '#lolidle-ap .pot img{width:24px;height:24px;image-rendering:pixelated}',
    '#lolidle-ap .pot .q{font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:var(--verde)}',
    '#lolidle-ap .pot small{color:var(--mut);font-size:10.5px;display:block}',
    '#lolidle-ap .pot.baixo{border-color:#6b4a14;background:#1c1408}#lolidle-ap .pot.baixo .q{color:var(--ambar)}',
    // ---- DUAS MODALIDADES DE FARM ----
    '#lolidle-ap .modos{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '#lolidle-ap .modo{display:flex;flex-direction:column;gap:2px;text-align:left;background:var(--pnl2);border:1px solid var(--lin2);border-radius:10px;padding:9px 11px;color:var(--txt);cursor:pointer;font:inherit}',
    '#lolidle-ap .modo:hover{border-color:var(--lin)}',
    '#lolidle-ap .modo b{font-size:12px}',
    '#lolidle-ap .modo small{color:var(--mut);font-size:10.5px;line-height:1.45}',
    '#lolidle-ap .modo.ativa{border-color:#4a3b10;background:#1c1708;box-shadow:inset 0 0 0 1px #4a3b10}',
    '#lolidle-ap .modo.ativa b{color:var(--ouro)}',
    // ---- VIGIA DO MERCADO ----
    '#lolidle-ap .watch-picker{border:1px solid var(--lin);border-radius:10px;padding:8px;margin:5px 0;background:var(--pnl2)}',
    '#lolidle-ap .watch-picker[hidden]{display:none}',
    '#lolidle-ap .wrow{display:flex;align-items:center;gap:7px;width:100%;background:none;border:1px solid var(--lin2);border-radius:7px;padding:4px 7px;color:var(--txt);font-size:11px;cursor:pointer;text-align:left;margin:1px 0}',
    '#lolidle-ap .wrow:hover{background:#ffffff07}',
    '#lolidle-ap .wrow.sel{border-color:var(--ouro);background:#221a0c}',
    '#lolidle-ap .wrow img{width:20px;height:20px;image-rendering:pixelated}',
    '#lolidle-ap .wrow span{flex:1}',
    '#lolidle-ap .campo{display:flex;flex-direction:column;gap:2px;margin:5px 0;font-size:10.5px;color:var(--mut)}',
    '#lolidle-ap .campo input{margin-top:1px}',
    '#lolidle-ap .item-na{display:inline-block;width:18px;height:18px;line-height:18px;text-align:center;background:#1b2029;border:1px solid var(--lin2);border-radius:5px;color:var(--mut);font-size:10px}',
    '#lolidle-ap .tag{display:inline-block;background:#0e1a28;border:1px solid #24405c;color:#a9cdff;border-radius:6px;padding:1px 7px;font-size:10px;margin:1px 2px 1px 0}',
    // ---- LINHAS VISUAIS (Personagem): barra + número, em vez de tabela de texto ----
    '#lolidle-ap .skrow{display:grid;grid-template-columns:minmax(90px,1fr) 96px 64px auto;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid #ffffff06}',
    '#lolidle-ap .skrow.prox{background:#f0c24e0d;border-left:2px solid var(--ouro)}',
    '#lolidle-ap .skrow .nm,#lolidle-ap .atrow .nm{font-size:11.5px;font-weight:600;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#lolidle-ap .skrow .vl,#lolidle-ap .atrow .vl{font-size:10.5px;color:var(--dim);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '#lolidle-ap .atrow{display:grid;grid-template-columns:88px 52px minmax(70px,1fr);gap:8px;align-items:center;padding:4px 2px}',
    // ---- RODAPÉ ----
    '#lolidle-ap footer{display:flex;align-items:center;gap:12px;padding:8px 16px;background:#0b0e12;border-top:1px solid var(--lin2);font-size:11px;color:var(--mut)}',
    '#lolidle-ap .fb{flex:1;min-width:0;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#lolidle-ap .fb.ok{color:var(--verde)}#lolidle-ap .fb.err{color:var(--verm)}#lolidle-ap .fb.warn{color:var(--ambar)}#lolidle-ap .fb.run{color:var(--azul)}',
    '#lolidle-ap .spin{display:inline-block;width:9px;height:9px;border:2px solid var(--azul);border-top-color:transparent;border-radius:50%;animation:lolidle-spin .7s linear infinite;vertical-align:-1px;margin-right:6px}',
    '@keyframes lolidle-spin{to{transform:rotate(360deg)}}',
    // ---- TEXTO: o "hint" é a nota de rodapé de um bloco, não um parágrafo explicativo ----
    '#lolidle-ap .muted{color:var(--mut)}',
    '#lolidle-ap .hint{color:var(--mut);font-size:11px;line-height:1.5;margin:2px 0}',
    '#lolidle-ap .hint.tira{display:none}',
    '#lolidle-ap .pend{color:var(--verm)}',
    '#lolidle-ap .erro-motor{background:#241310;border:1px solid #6d2a20;border-radius:9px;padding:8px 10px;font-size:11px;color:#ffc6ba}',
    '#lolidle-ap .erro-motor b{color:var(--txt)}',
    // ---- DUAS COLUNAS NA ABA PAINEL (cartões largos ocupam as duas) ----
    '#lolidle-ap #ap-t-painel.on{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}',
    '#lolidle-ap #ap-t-painel.on>.grid2,#lolidle-ap #ap-t-painel.on>#ap-painel-estado,#lolidle-ap #ap-t-painel.on>#ap-fm-itens,#lolidle-ap #ap-t-painel.on>#ap-now-combate,#lolidle-ap #ap-t-painel.on>#ap-now-parado,#lolidle-ap #ap-t-painel.on>#ap-auto-champ,#lolidle-ap #ap-t-painel.on>#ap-now-jogo{grid-column:1/-1}',
    '@media (max-width:900px){#lolidle-ap #ap-t-painel.on{grid-template-columns:1fr}}',
    // ---- BOTÃO FLUTUANTE ----
    '#lolidle-ap-launch{position:fixed;right:10px;bottom:10px;z-index:2147483646;background:#11151c;color:var(--ouro);border:1px solid #2a3341;border-radius:10px;padding:6px 11px;font:800 10px/1.2 "Inter","Segoe UI",system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;opacity:.4;transition:.15s}',
    '#lolidle-ap-launch:hover{opacity:1;border-color:#4a3b10}',
    // ---- HOVER NO NOME DO JOGADOR ----
    '#st-nome{position:relative;cursor:pointer}',
    '#st-nome::before{content:"";position:absolute;inset:-7px -14px;border-radius:7px}',
    '#st-nome:hover::before{background:rgba(240,194,78,.12)}',
    // ===================== MODAIS (fora de #lolidle-ap) =====================
    '#lolidle-ap-modal,#lolidle-ap-testes,#lolidle-ap-confirma,#lolidle-ap-ajuda,#lolidle-ap-macro{position:fixed;inset:0;z-index:2147483647;background:#04060ab8;backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;font:13px/1.5 "Inter","Segoe UI",system-ui,sans-serif;color:#eef2f8}',
    '#lolidle-ap-modal.on,#lolidle-ap-testes.on,#lolidle-ap-confirma.on,#lolidle-ap-ajuda.on,#lolidle-ap-macro.on{display:flex}',
    '#lolidle-ap-modal .box,#lolidle-ap-testes .box,#lolidle-ap-ajuda .box,#lolidle-ap-macro .box{background:#0c0f14;border:1px solid #29303c;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 28px 90px #000e}',
    '#lolidle-ap-modal .box{width:min(880px,94vw);height:min(700px,90vh)}',
    '#lolidle-ap-macro .box{width:min(820px,94vw);height:auto;max-height:min(84vh,760px)}',
    '#lolidle-ap-macro .corpo{padding:12px 14px 16px;overflow:auto}',
    '#lolidle-ap-macro .corpo>.card{margin:0}',
    '#lolidle-ap-testes .box{width:min(980px,94vw);height:min(720px,90vh)}',
    '#lolidle-ap-ajuda .box{width:min(820px,94vw);height:min(700px,90vh)}',
    '.lolidle-box header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#11151c;border-bottom:1px solid #29303c;flex-wrap:wrap}',
    '.lolidle-box header b{font-size:13px;font-weight:700;color:#eef2f8}',
    '.lolidle-box .corpo{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px}',
    '.lolidle-box footer{display:flex;align-items:center;gap:8px;padding:10px 16px;background:#0a0d11;border-top:1px solid #29303c;flex-wrap:wrap}',
    '.lolidle-box button{background:#1b2029;color:#eef2f8;border:1px solid #29303c;border-radius:9px;padding:7px 13px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
    '.lolidle-box button:hover{background:#222b37;border-color:#3a4658}',
    '.lolidle-box button.sec{background:transparent;color:#a7b2c3}',
    '.lolidle-box button.danger{background:#3a1512;color:#ffbcb3;border-color:#7a2a22}',
    '.lolidle-box input,.lolidle-box select{background:#0a0d11;color:#eef2f8;border:1px solid #29303c;border-radius:8px;padding:5px 8px;font:inherit;font-size:12px}',
    '.lolidle-box .muted{color:#7c8798;font-size:10.5px}',
    '#lolidle-ap-modal .filtros{display:flex;align-items:center;gap:6px;padding:9px 16px;border-bottom:1px solid #1d232c;flex-wrap:wrap}',
    '#lolidle-ap-modal .grade{flex:1;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:8px;align-content:start}',
    '#lolidle-ap-modal .frame{position:relative;aspect-ratio:1;background:#11151c;border:2px solid #29303c;border-radius:9px;cursor:pointer;overflow:hidden;padding:0}',
    '#lolidle-ap-modal .frame img{width:100%;height:100%;object-fit:cover;display:block}',
    '#lolidle-ap-modal .frame span{position:absolute;left:0;right:0;bottom:0;font-size:8px;background:#000c;padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap-modal .frame.epico{border-color:#7a4fbf}#lolidle-ap-modal .frame.lendario{border-color:#b07a20}',
    '#lolidle-ap-modal .frame.sel{border-color:#f0c24e;box-shadow:0 0 0 1px #f0c24e,0 0 14px #f0c24e66}',
    '#lolidle-ap-modal .if{background:transparent;color:#a7b2c3;border:1px solid #29303c;border-radius:8px;padding:4px 11px;font:inherit;font-size:11px;cursor:pointer}',
    '#lolidle-ap-modal .if.ativa{background:#221a0c;color:#f0c24e;border-color:#4a3b10}',
    '#lolidle-ap-testes .set{display:grid;grid-template-columns:150px repeat(4,1fr) 120px 28px;gap:6px;align-items:center;background:#11151c;border:1px solid #1d232c;border-radius:9px;padding:6px 9px}',
    '#lolidle-ap-testes .fixo{color:#7c8798;font-size:10px;display:flex;align-items:center;gap:4px}',
    '#lolidle-ap-testes .res{font-size:10.5px;color:#a7b2c3;border-top:1px solid #1d232c;padding-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '#lolidle-ap-testes .res b{color:#f0c24e}',
    '#lolidle-ap-confirma .box{width:min(540px,92vw);background:#0c0f14;border:1px solid #29303c;border-radius:16px;padding:18px 20px;box-shadow:0 28px 90px #000e}',
    '#lolidle-ap-confirma h3{margin:0 0 10px;font-size:15px;color:#eef2f8}',
    '#lolidle-ap-confirma ul{margin:0 0 14px;padding-left:20px;color:#a7b2c3;font-size:12px}',
    '#lolidle-ap-confirma li{margin:4px 0}',
    '#lolidle-ap-confirma .botoes{display:flex;gap:8px;justify-content:flex-end}',
    '#lolidle-ap-confirma .botoes button{background:#1b2029;color:#eef2f8;border:1px solid #29303c;border-radius:9px;padding:8px 15px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
    '#lolidle-ap-confirma .botoes button#ap-cf-ok{background:#2a2110;color:#f0c24e;border-color:#4a3b10}',
    '#lolidle-ap-confirma .botoes button#ap-cf-ok.danger{background:#3a1512;color:#ffbcb3;border-color:#7a2a22}',
    '#lolidle-ap-ajuda h4{margin:12px 0 4px;color:#f0c24e;font-size:12px}',
    '#lolidle-ap-ajuda p,#lolidle-ap-ajuda li{color:#a7b2c3;font-size:12px;margin:4px 0}',
    '#lolidle-ap-ajuda dl{margin:0}#lolidle-ap-ajuda dt{color:#eef2f8;font-weight:700;font-size:12px;margin-top:8px}',
    '#lolidle-ap-ajuda dd{margin:2px 0 0;color:#a7b2c3;font-size:11.5px}',
    '#lolidle-ap-ajuda .macro{background:#11151c;border-left:2px solid #24405c;border-radius:0 9px 9px 0;padding:8px 11px;margin:5px 0}',
    '#lolidle-ap-ajuda .macro b{color:#f0c24e}',
  ].join('\n');
  function injectCss() {
    const velho = $('lolidle-ap-style');
    if (velho && velho.textContent === CSS) return;
    const s = velho || document.createElement('style');
    s.id = 'lolidle-ap-style';
    s.textContent = CSS;
    if (!velho) (document.head || document.documentElement).appendChild(s);
  }

  // ============================================================ 4. ESTRUTURA (DOM)
  // A CASCA mudou por completo (revamp 2026-10-22): rail de navegação à esquerda com os nove
  // destinos agrupados por ASSUNTO (Operar / Ajustar / Acompanhar / Sistema), cabeçalho de uma
  // faixa e conteúdo num só cartão por assunto. Os IDS dos contentores NÃO mudaram - os
  // desenhadores e os handlers continuam a encontrar tudo; o que mudou foi o desenho à volta.
  function build() {
    if ($('lolidle-ap')) return;
    const p = document.createElement('div');
    p.id = 'lolidle-ap';
    p.innerHTML = ''
      + '<header>'
      + '  <div class="brand">'
      + '    <img class="logo" src="' + LOGO + '" alt="LoL Idle">'
      + '    <span class="tit">Auto-play</span>'
      + '    <span class="pill off" id="ap-estado"><i></i><b>, </b></span>'
      + '  </div>'
      + '  <div class="hstats">'
      + '    <span class="mini"><b id="ap-h-nivel">, </b><small>nível</small></span>'
      + '    <span class="mini"><b id="ap-h-ouro">, </b><small>ouro</small></span>'
      + '    <span class="mini"><b id="ap-h-hp">, </b><small>vida</small></span>'
      + '    <span class="mini wide"><b id="ap-h-local">, </b><small>onde</small></span>'
      + '    <span class="mini wide"><b id="ap-h-regiao">, </b><small>melhor região</small></span>'
      + '  </div>'
      + '  <div class="hacts">'
      + '    <button class="ic" id="ap-help" title="Ajuda e glossário">?</button>'
      + '    <button class="ic" id="ap-close" title="Fechar (Esc)">✕</button>'
      + '  </div>'
      + '  <div class="fase" id="ap-fase">carregando…</div>'
      + '</header>'
      + '<div class="shell">'
      + '<nav id="ap-tabs">'
      + '  <span class="nav-sec">Operar</span>'
      + '  <button class="tab ativa" data-tab="painel"><i>◈</i><span>Auto-play</span></button>'
      + '  <button class="tab" data-tab="farm"><i>◎</i><span>Farm</span></button>'
      + '  <button class="tab" data-tab="itens"><i>▤</i><span>Itens</span></button>'
      + '  <button class="tab" data-tab="mercado"><i>⇄</i><span>Mercado</span></button>'
      + '  <span class="nav-sec">Ajustar</span>'
      + '  <button class="tab" data-tab="personagem"><i>✦</i><span>Personagem</span></button>'
      + '  <button class="tab" data-tab="macro"><i>⚙</i><span>Macro</span></button>'
      + '  <span class="nav-sec">Acompanhar</span>'
      + '  <button class="tab" data-tab="ganhos"><i>▲</i><span>Ganhos</span></button>'
      + '  <span class="nav-sec">Sistema</span>'
      + '  <button class="tab" data-tab="pocao"><i>✚</i><span>Poção</span></button>'
      + '  <button class="tab" data-tab="manual"><i>⌘</i><span>Manual</span></button>'
      + '</nav>'
      + '<main>'
      // ---------------- AUTO-PLAY: o primeiro ecrã é o que ele faz sozinho ----------------
      + '  <section class="pane on" id="ap-t-painel">'
      // 1) O MESTRE e os switches (é o que se liga/desliga).
      + '    <div id="ap-painel-estado"></div>'
      // 2) O QUE ESTÁ A ACONTECER AGORA.
      + '    <div class="grid2"><div id="ap-now-estado"></div><div id="ap-now-fase"></div></div>'
      + '    <div id="ap-now-combate"></div>'
      // 3) A MISSÃO (sempre em missão) e a região em uso.
      + '    <div class="grid2"><div id="ap-auto-regiao"></div><div id="ap-auto-tarefa"></div></div>'
      + '    <div id="ap-auto-champ"></div>'
      + '  </section>'
      // ---------------- FARM: modalidade, objetivo, itens, regiões e ciclos ----------------
      + '  <section class="pane" id="ap-t-farm">'
      + '    <div class="grid2"><div id="ap-fm-modo"></div><div id="ap-fm-objetivo"></div></div>'
      + '    <div id="ap-fm-itens"></div>'
      + '    <div id="ap-fm-previsor"></div>'
      + '    <div id="ap-fm-regioes"></div>'
      + '    <div id="ap-fm-rank"></div>'
      + '    <div id="ap-fm-ciclos"></div>'
      + '  </section>'
      // ---------------- MACRO: configuração de cada rotina ----------------
      + '  <section class="pane" id="ap-t-macro">'
      + '    <div class="grid2"><div id="ap-macro-loop"></div><div id="ap-macro-params"></div></div>'
      + '    <div id="ap-macro-farm"></div>'
      + '    <div id="ap-macro-cartas"></div>'
      + '    <div id="ap-macro-mercado"></div>'
      + '    <div id="ap-auto-base"></div>'
      + '    <div id="ap-cfg-base"></div>'
      + '    <div id="ap-cfg-repor"></div>'
      + '    <div id="ap-cfg-anunciar"></div>'
      + '    <div id="ap-cfg-comprar"></div>'
      + '    <div id="ap-build-fase"></div>'
      + '  </section>'
      // ---------------- ITENS: mochila, build, DPS e cofre ----------------
      + '  <section class="pane" id="ap-t-itens">'
      + '    <div id="ap-it-build"></div>'
      + '    <div id="ap-painel-build"></div>'
      + '    <div id="ap-it-proteg"></div>'
      + '    <div id="ap-it-mochila"></div>'
      + '    <div id="ap-it-plano"></div>'
      + '    <div id="ap-it-dps"></div>'
      + '    <div id="ap-it-cofre"></div>'
      + '  </section>'
      // ---------------- MERCADO ----------------
      + '  <section class="pane" id="ap-t-mercado">'
      + '    <div id="ap-mk-watch"></div>'
      + '    <div id="ap-mk-ofertas"></div>'
      + '    <div id="ap-mk-plano"></div>'
      + '    <div id="ap-mk-ornn"></div>'
      + '    <div id="ap-mk-compra"></div>'
      + '  </section>'
      // ---------------- PERSONAGEM ----------------
      + '  <section class="pane" id="ap-t-personagem">'
      + '    <div class="grid2"><div id="ap-sk-barra"></div><div id="ap-sk-pontos"></div></div>'
      // `ap-sk-ideal` e `ap-sk-dps` ja' eram ESCRITOS pelo renderSkills mas nao tinham contentor:
      // `setHtml` num id ausente e' um no-op silencioso (o cartao da barra ideal e o dano por
      // habilidade simplesmente nao apareciam). Encontrado ao vivo 2026-10-23.
      + '    <div class="grid2"><div id="ap-sk-ideal"></div><div id="ap-sk-dps"></div></div>'
      + '    <div id="ap-sk-ordem"></div>'
      + '    <div id="ap-sk-acoes"></div>'
      + '    <div class="grid2"><div id="ap-at-pontos"></div><div id="ap-at-lista"></div></div>'
      + '    <div id="ap-at-stats"></div>'
      + '    <div id="ap-at-acoes"></div>'
      + '  </section>'
      // ---------------- GANHOS: chefes, corridas e HISTÓRICO (uma só aba, ordem do dono) ------
      + '  <section class="pane" id="ap-t-ganhos">'
      + '    <div id="ap-fm-agora"></div>'
      + '    <div id="ap-fm-chefes"></div>'
      + '    <div id="ap-hi-48h-resumo"></div>'
      + '    <div id="ap-hi-mortes"></div>'
      + '    <div id="ap-hi-lutas"></div>'
      + '    <div id="ap-hi-eventos"></div>'
      + '    <div id="ap-hi-48h"></div>'
      + '    <div id="ap-hi-problemas"></div>'
      + '  </section>'
      // ---------------- POÇÃO ----------------
      + '  <section class="pane" id="ap-t-pocao">'
      + '    <div id="ap-pc-resumo"></div>'
      + '    <div id="ap-now-pocoes"></div>'
      + '  </section>'
      // ---------------- MANUAL: o que é descartável (base pendente, bloqueios, ajuda) ----------------
      + '  <section class="pane" id="ap-t-manual">'
      + '    <div class="grid2"><div id="ap-auto-falta"></div><div id="ap-now-parado"></div></div>'
      + '    <div id="ap-manual-info"></div>'
      + '    <div id="ap-manual-dinamicas"></div>'
      + '    <div id="ap-now-jogo"></div>'
      + '    <div id="ap-auto-acoes"></div>'
      + '  </section>'
      + '</main>'
      + '</div>'
      + '<footer><span class="fb" id="ap-fb">Pronto.</span>'
      + '<span class="muted">F8 abre · Esc fecha</span></footer>';
    (document.body || document.documentElement).appendChild(p);
    buildModais();
    bind();
  }
  function buildModais() {
    const corpo = document.body || document.documentElement;
    // ---- escolher itens -------------------------------------------------------
    if (!$('lolidle-ap-modal')) {
      const m = document.createElement('div');
      m.id = 'lolidle-ap-modal'; m.hidden = true;
      m.innerHTML = '<div class="box lolidle-box">'
        + '<header><b>Escolher itens para farmar</b><span class="muted">o auto-play leva você à região de cada um</span><span class="sp"></span>'
        + '<input id="ap-item-busca" type="search" placeholder="procurar item…"><button id="ap-modal-x" class="sec">Fechar</button></header>'
        // 108 itens no catálogo (19 básicos, 40 épicos, 49 lendários). Qualquer um deles pode
        // ser escolhido, por isso os básicos (peças) têm filtro próprio em vez de ficarem
        // escondidos pelo código.
        + '<div class="filtros"><button class="if ativa" data-if="todos">Todos</button><button class="if" data-if="lendario">Lendários</button><button class="if" data-if="epico">Épicos</button><button class="if" data-if="basico">Básicos (peças)</button>'
        + '<span class="muted" id="ap-item-nota"></span></div>'
        + '<div class="grade" id="ap-item-grade"></div>'
        + '<footer><span class="muted" id="ap-modal-sel">0 escolhido(s)</span><button id="ap-modal-limpar" class="sec">Limpar</button><span class="sp"></span><button id="ap-modal-ok">OK</button></footer>'
        + '</div>';
      corpo.appendChild(m);
    }
    // ---- testar conjuntos ----------------------------------------------------
    if (!$('lolidle-ap-testes')) {
      const m = document.createElement('div');
      m.id = 'lolidle-ap-testes'; m.hidden = true;
      m.innerHTML = '<div class="box lolidle-box">'
        + '<header><b>Testar conjuntos</b><span class="muted">até 4 conjuntos, medidos em mobs e chefe</span>'
        + '<span class="sp"></span><button id="ap-tx-x" class="sec">Fechar</button></header>'
        + '<div class="corpo" id="ap-tx-lista"></div>'
        + '<footer><button id="ap-tx-add" class="sec">+ conjunto</button><button id="ap-tx-base" class="sec">Usar o que está equipado</button>'
        + '<span class="muted">região</span><select id="ap-tx-reg"></select>'
        + '<span class="muted">segundos de mobs</span><input id="ap-tx-seg" type="number" min="10" max="600" value="20" style="width:64px">'
        + '<button id="ap-tx-run">▶ Rodar teste</button><button id="ap-tx-stop" class="sec">■ Parar</button>'
        + '<span class="muted" id="ap-tx-msg"></span></footer>'
        + '<div class="corpo" id="ap-tx-res" style="max-height:180px;flex:none"></div>'
        + '</div>';
      corpo.appendChild(m);
    }
    // ---- confirmação ---------------------------------------------------------
    if (!$('lolidle-ap-confirma')) {
      const m = document.createElement('div');
      m.id = 'lolidle-ap-confirma'; m.hidden = true;
      m.innerHTML = '<div class="box"><h3 id="ap-cf-titulo">Confirmar</h3><ul id="ap-cf-corpo"></ul>'
        + '<div class="botoes"><button id="ap-cf-não" class="sec">Cancelar</button><button id="ap-cf-ok">Confirmar</button></div></div>';
      corpo.appendChild(m);
    }
    // ---- ajuda ---------------------------------------------------------------
    if (!$('lolidle-ap-ajuda')) {
      const m = document.createElement('div');
      m.id = 'lolidle-ap-ajuda'; m.hidden = true;
      m.innerHTML = '<div class="box lolidle-box"><header><b>Ajuda, como usar e o que querem dizer as palavras</b><span class="sp"></span>'
        + '<button id="ap-aj-x" class="sec">Fechar</button></header>'
        + '<div class="corpo" id="ap-aj-corpo"></div></div>';
      corpo.appendChild(m);
    }
  }

  // ============================================================ 4b. ABRIR/FECHAR
  /** Volta o scroll do corpo do painel ao topo (TK-02 §3): abrir e trocar de aba deixava o
   *  PRIMEIRO cartão cortado fora do ecrã (o `main` guardava a posição anterior). O `main` é o
   *  contentor com `overflow:auto` - é ele que rola, não o painel. */
  function resetScroll() { const m = q1('#lolidle-ap main'); if (m) m.scrollTop = 0; }
  function abrir() { aberto = true; $('lolidle-ap').classList.add('on'); ultimoRender = 0; renderTudo(); resetScroll(); }
  function fechar() { aberto = false; const p = $('lolidle-ap'); if (p) p.classList.remove('on'); }
  function nomeEl() { return q1('#st-nome') || q1('#painel-status') || q1('#hud-nome'); }
  function attachHover() {
    const el = nomeEl();
    if (!el) return false;
    if (!el.dataset.lolidleApBound) {
      el.dataset.lolidleApBound = '1';
      el.addEventListener('mouseenter', () => abrir());
    }
    return true;
  }
  function buildLaunch() {
    if ($('lolidle-ap-launch')) return;
    const b = document.createElement('button');
    b.id = 'lolidle-ap-launch';
    b.textContent = 'Auto-play';
    b.title = 'Abrir/fechar o painel do auto-play (F8)';
    b.addEventListener('click', () => (aberto ? fechar() : abrir()));
    (document.body || document.documentElement).appendChild(b);
  }

  /** Nomes das abas ANTIGAS -> as de agora. Um chamador antigo (script de manutenção, teste)
   *  não pode ficar com o painel em branco: o alias leva à aba certa. `mercado` deixou de ser
   *  alias de `itens`: passou a ser aba própria (pedido do dono). */
  const TAB_ALIAS = { agora: 'painel', auto: 'painel', skills: 'personagem', atrib: 'personagem', farm: 'farm', hist: 'ganhos', historico: 'ganhos', ganhos: 'ganhos', pocao: 'pocao', poções: 'pocao', pocoes: 'pocao', manual: 'manual' };
  function setTab(nome) {
    tabAtiva = TAB_ALIAS[nome] || nome;
    // BUG MEDIDO (2026-10-19): o alias era aplicado ao `tabAtiva` mas a classe usava o nome
    // ANTIGO (`hist`), que não existe em `data-tab` - o painel ficava em branco. A fonte é a
    // `tabAtiva`, a mesma que o `renderTudo` consulta.
    qa('#lolidle-ap .tab').forEach((x) => x.classList.toggle('ativa', x.dataset.tab === tabAtiva));
    qa('#lolidle-ap .pane').forEach((x) => x.classList.toggle('on', x.id === 'ap-t-' + tabAtiva));
    ultimoRender = 0;
    renderTudo();
    resetScroll();
  }

  // ============================================================ 5. DESENHADORES
  // Caches: evitam recalcular coisas caras da automação a cada segundo.
  const caches = {};
  function cache(key, ms, fn) {
    const c = caches[key];
    if (c && Date.now() - c.at < ms) return c.v;
    let v = null;
    try { v = fn(); } catch (e) { v = null; }
    caches[key] = { at: Date.now(), v };
    return v;
  }
  /** Esquece uma cache (ou todas) - usado quando uma ação muda o que ela guarda. */
  function cacheLimpar(key) { if (key) delete caches[key]; else for (const k of Object.keys(caches)) delete caches[k]; }
  const _ultimoHtml = new Map();
  function setHtml(id, html) {
    const el = $(id);
    if (!el) return;
    if (_ultimoHtml.get(id) === html) return;
    _ultimoHtml.set(id, html);
    el.innerHTML = html;
    // Nada de texto cortado sem poder ser lido: o que tem ellipsis (`.ln .d`) ganha `title`
    // com o texto inteiro.
    try {
      const ds = el.querySelectorAll('.ln .d');
      for (let i = 0; i < ds.length; i++) { const tx = ds[i].textContent; if (tx) ds[i].title = tx; }
    } catch (e) { /* DOM mínimo */ }
  }

  const cfg = () => ler('getConfig', {}) || {};
  /** Farm: da automação quando existe; senão do último estado publicado no storage. */
  const farm = () => (MOTOR() ? (ler('getFarm', {}) || {}) : (farmStore || {}));
  /** Regiões medidas: da automação quando devolve algo; senão do último agregado guardado. */
  const agregado = () => { const a = MOTOR() ? ler('agregar', null) : null; return (a && a.length) ? a : (aggStore || a || []); };
  const live = () => window.__lolidleLive || null;
  function hpAgora() {
    const L = live();
    if (L && L.hp && Number.isFinite(L.hp.cur)) return L.hp;
    if (status && status.hp && Number.isFinite(status.hp.cur)) return status.hp;
    return null;
  }
  const pausado = () => ler('estaPausado', false) === true;
  const ligado = () => !!cfg().enabled;
  const naBase = () => /fonte/i.test(String((ler('readLocation', {}) || {}).text || ''));

  /** Leitura da base (porque a automação está parado) - cache de 10 s. */
  const diagBase = () => cache('diag', 10000, () => ler('diagnosticoBase', null));
  /** O QUE FALTA FAZER NA BASE (necessidades reais, da automação) - mesma cache. */
  const faltasBase = () => cache('faltas', 10000, () => {
    const n = ler('necessidadesBase', null);
    if (!n) return null;
    const faltam = ler('faltandoNaBase', [], n);
    return { n, faltam: Array.isArray(faltam) ? faltam : [] };
  });
  /** Nome de usuário de cada necessidade da base (chaves da automação). */
  const NECESSIDADE_NOME = {
    presente: 'Pegar presentes e prêmio diário',
    cura: 'Curar na Soraka',
    vender: 'Vender o lixo ao lojista',
    repor: 'Repor poções no Lojista',
    tarefa: 'Tarefa e missões diárias (Capitão)',
    hab: 'Subir habilidades',
    atrib: 'Distribuir pontos de atributo',
    equip: 'Equipar a melhor peça de cada slot',
    cofre: 'Guardar no cofre',
    mercado: 'Anunciar lendários no mercado',
    comprar: 'Comprar item da build no mercado',
    refino: 'Refinar no Ornn',
    montar: 'Montar item no Ornn',
  };
  /** Melhor região agora - cache de 15 s (percorre todas as regiões). */
  const recomendacao = () => cache('rec', 15000, () => ler('recomendar', null));
  /** REGIÃO RECOMENDADA pela automação (`estado().regiaoRecomendada`, TK-01): a recomendação
   *  AUTOMÁTICA - a automação diz sempre qual escolheria, mesmo com uma região FIXA definida. É esta
   *  que o select mostra em modo automático (com `regiaoIdeal` como recurso, para versão antiga).
   *  Cache de 15 s porque o `estado()` lê a mochila e o equipamento. */
  const regiaoRecomendada = () => cache('regRec', 15000, () => {
    const r = chamar('estado');
    if (!r.ok || !r.v) return null;
    const rec = r.v.regiaoRecomendada;
    if (!rec) return null;
    return typeof rec === 'string' ? rec : (rec.id || rec.regiao || null);
  });
  /** Identidade do campeão - cache de 30 s. */
  const identidade = () => cache('ident', 30000, () => ler('identidadeCampeao', null));
  /** Build ideal - cache de 30 s. */
  const buildIdeal = () => cache('ideal', 30000, () => ler('buildIdealAgora', []) || ler('buildIdeal', []) || []);

  // ============================ OS 4 ESTADOS DO AUTO-PLAY (controles)
  // O MOTOR tem TRÊS controles com semânticas DIFERENTES (automation.js:5363-5398):
  //   cfg.enabled=false -> modo OBSERVAÇÃO: o portão `podeAgir` fecha e nada é clicado;
  //   pausar()          -> congela as AÇÕES mas continua OBSERVANDO (a medição acumula) e
  //                        `despausar()` retoma do mesmo ponto;
  //   desligarTudo()    -> para tudo, LIMPA o estado ativo (prazos, throttles, farm forçado,
  //                        backoff, testes) e PERSISTE em localStorage; `religarTudo()` volta.
  // A GUI mostra-os como 4 estados distintos - antes havia um rótulo de estado e um botão que
  // fazia o inverso, sem dizer qual era "onde você está" e qual era "o que acontece se clicar".
  const DESLIGADO_KEY = 'lolidleAuto:desligado';   // chave da automação (automation.js:5371)
  /** O kill da automação vive no localStorage (mesma origem desta página) e a automação não expõe nenhum
   *  getter para ele: `saudeAutoplay()` devolve só enabled/pausado/timers. */
  function estaDesligado() { try { return localStorage.getItem(DESLIGADO_KEY) === '1'; } catch (e) { return false; } }
  function estadoAuto() {
    if (estaDesligado()) return 'desligado';
    if (pausado()) return 'pausado';
    return cfg().enabled ? 'ligado' : 'observacao';
  }
  /** O que cada estado QUER DIZER, numa linha. O dono pediu TRÊS palavras claras -
   *  LIGADO / DESLIGADO / PAUSADO - e o motivo por baixo. */
  const EST_AUTO = {
    observacao: { cls: 'off', titulo: 'DESLIGADO', txt: 'só lê o jogo, não clica em nada' },
    ligado: { cls: 'on', titulo: 'LIGADO', txt: 'farmando e decidindo sozinho' },
    pausado: { cls: 'run', titulo: 'PAUSADO', txt: 'parou de agir, continua medindo' },
    desligado: { cls: 'err', titulo: 'DESLIGADO', txt: 'parou tudo; ao religar começa limpo' },
  };
  /** O CARTÃO MESTRE (topo do Painel): UM interruptor + o estado + o motivo. Não há um segundo
   *  botão "DESLIGAR": o interruptor é o único liga/desliga do auto-play. Pausar/Retomar e Parar
   *  tudo ficam como ações SECUNDÁRIAS porque são outras coisas (a pausa é da automação e o kill é
   *  persistente no navegador) - não são um "desligar" repetido. */
  function renderPainelEstado() {
    const el = $('ap-painel-estado');
    if (!el) return;
    const a = estadoAgora();
    const e = a.estado || 'observacao';
    const info = EST_AUTO[e] || EST_AUTO.observacao;
    const ligadoAgora = !!cfg().enabled;                 // o switch mostra o que o auto-play tem
    setHtml('ap-painel-estado',
      '<section class="card mestre ' + info.cls + '">'
      + '<h3>AUTO-PLAY</h3>'
      + '<div class="mestre-l">'
      + '<label class="mestre-tg" title="Liga ou desliga o auto-play. Desligado, só observa e mede.">'
      + '<input type="checkbox" id="ap-mestre"' + (ligadoAgora ? ' checked' : '') + '><span class="sw"></span>'
      + '<b class="mestre-est ' + info.cls + '">' + esc(info.titulo) + '</b>'
      + '</label>'
      + '<small class="mestre-txt">' + esc(info.txt) + '</small>'
      + '</div>'
      + '<p class="hint">' + esc(a.fase) + '</p>'
      + '<div id="ap-auto-arvore" class="mestre-arvore"></div>'
      + '</section>');
  }
  /** Estado resumido do cabeçalho - cache de 2 s. */
  function estadoAgora() {
    const t = Date.now();
    if (cacheAgora.v && t - cacheAgora.at < 2000) return cacheAgora.v;
    const m = MOTOR();
    const c = cfg();
    const pau = pausado();
    const on = !!c.enabled;
    const loc = ler('readLocation', {}) || {};
    const pl = ler('player', {}) || {};
    const hp = hpAgora();
    const f = farm();
    const cur = f.current || null;
    const est = estadoAuto();
    let pill, fase;
    if (!m) {
      pill = { cls: 'err', txt: 'sem auto-play' };
      fase = 'O auto-play não carregou nesta página, recarregue com F5.';
    } else if (est === 'desligado') {
      pill = { cls: 'err', txt: 'DESLIGADO' };
      fase = 'DESLIGADO, parou tudo e a decisão ficou gravada no navegador. Ao religar, a automação começa limpo.';
    } else if (est === 'pausado') {
      pill = { cls: 'run', txt: 'PAUSADO' };
      fase = 'PAUSADO, parou de agir, mas continua medindo. Retomar devolve tudo do mesmo ponto.';
    } else if (est === 'observacao') {
      pill = { cls: 'off', txt: 'DESLIGADO' };
      fase = 'OBSERVAÇÃO, a automação só lê o jogo, não clica em nada.';
    } else {
      pill = { cls: 'on', txt: 'LIGADO' };
      const dg = diagBase();
      if (dg && dg.naBase) {
        const esp = esperaReal(dg);
        fase = 'Na Fonte. ' + (dg.motivo ? 'Motivo para estar aqui: ' + dg.motivo + '.' : 'Sem nada urgente para fazer na base.')
          + (esp.length ? ' Aguardando: ' + esp.map(traduzTrava).join(' · ') + '.' : '');
      } else if (cur) {
        const quem = cur.fase === 'boss' ? 'lutando com o chefe ' + limparNivel(cur.boss) : 'farmando mobs';
        fase = 'Rodando: ' + quem + ' em ' + limparNivel(cur.region) + ' (há ' + fmtDur(Date.now() - (cur.startedAt || Date.now())) + ').';
      } else {
        fase = 'Ligado, mas sem ciclo de farm ativo, a automação só conta ciclos enquanto você está no mapa.';
      }
    }
    const rec = recomendacao();
    const v = {
      pill, fase, estado: est, ligado: on, pausado: pau,
      nivel: pl.nivel || null,
      ouro: ler('readGold', null),
      hp,
      local: String(loc.text || '-'),
      regiao: rec ? limparNivel(rec.regiao) : null,
      regiaoInfo: rec,
      farm: f, cur,
      campeao: (identidade() || {}).nome || null,
      classe: String(((identidade() || {}).classe) || '').toUpperCase() || null,
    };
    cacheAgora = { at: t, v };
    return v;
  }

  function renderCabecalho() {
    const a = estadoAgora();
    const el = $('ap-estado');
    if (el) { el.className = 'pill ' + a.pill.cls; const b = el.querySelector('b'); if (b) b.textContent = a.pill.txt; }
    const fe = $('ap-fase'); if (fe && fe.textContent !== a.fase) fe.textContent = a.fase; if (fe) fe.title = a.fase;
    // Valores que podem ficar cortados (`.mini b` e `.fase` têm ellipsis) ganham `title`
    // com o texto inteiro - nada fica ilegível por omissão.
    const set = (id, txt) => { const e = $(id); if (e && e.textContent !== txt) e.textContent = txt; if (e) e.title = txt; };
    set('ap-h-nivel', a.nivel ? String(a.nivel) : '-');
    set('ap-h-ouro', fmt(a.ouro));
    set('ap-h-hp', a.hp ? fmt(a.hp.cur) + ' / ' + fmt(a.hp.max) : '-');
    set('ap-h-local', a.local);
    set('ap-h-regiao', a.regiao || '-');
  }


  // ------------------------------------------------- BUILD POR FASE
  // O bloco grande vive na aba Itens; na primeira aba fica o resumo de uma linha.
  /** Nome de usuário de cada FONTE de uma peça. */
  const FONTE_NOME = { equipado: 'equipado', mochila: 'na mochila', mercado: 'no mercado', cofre: 'no cofre', falta: 'falta' };
  const FONTE_AJUDA = {
    equipado: 'está vestido neste momento',
    mochila: 'está na sua mochila, pronto a vestir',
    mercado: 'está anunciado por você no mercado (a automação cancela a oferta e volta a vesti-lo)',
    cofre: 'está guardado no cofre (a automação vai buscá-lo quando for à Fonte)',
    falta: 'não está em lado nenhum, só farmando ou comprando a outro jogador',
  };
  /** Plano de uma fase (mobs/chefe), da automação - cache de 6 s. */
  const planoFase = (f) => cache('bf-' + f, 6000, () => { const r = chamar('planoBuildFase', f); return r.ok && r.v ? r.v : null; });
  /** Uma peça da build: ícone + qualidade + DE ONDE VEM. */
  function bfItem(i) {
    const fonte = FONTE_NOME[i.fonte] ? i.fonte : 'falta';
    const titulo = i.nome + ', ' + (FONTE_NOME[fonte] || fonte) + (i.porque ? ' · ' + i.porque : '') + ' · ' + (FONTE_AJUDA[fonte] || '');
    // O chip mostra o NOME do item além do selo de qualidade e da fonte (o `i.nome` sempre
    // existiu nos dados; faltava renderizá-lo).
    const nome = i.nome || i.base || '?';
    return '<span class="bf-item ' + esc(fonte) + '" title="' + esc(titulo) + '">'
      + '<img src="' + ITEM_IMG(i.base) + '" alt="" loading="lazy" onerror="this.style.opacity=.25">'
      + (i.qual ? '<b class="q">' + esc(i.qual) + (i.refino ? '+' + esc(i.refino) : '') + '</b>' : '')
      + '<small><span class="bf-nome">' + esc(nome) + '</span> · ' + esc(FONTE_NOME[fonte] || fonte) + '</small></span>';
  }
  /** Uma COLUNA (a build de mobs ou a de chefe). */
  function bfColuna(p, fase, eqAgora) {
    const titulo = fase === 'mobs' ? 'Build de MOBS' : 'Build de CHEFE';
    const dica = fase === 'mobs'
      ? 'para limpar grupos: dano em área e velocidade de ataque valem mais'
      : 'para um alvo só e com armadura: penetração, crítico e aguentar valem mais';
    if (!p || !(p.itens || []).length) {
      return '<div class="bf-col"><h4>' + titulo + '</h4><p class="vazio">a automação ainda não sabe qual é o seu campeão (o HUD do jogo tem que carregar)</p></div>';
    }
    const emUso = !!p.ativa && p.on !== false;
    const faltam = (p.faltam || []);
    const buscar = (p.buscar || []);
    // IDEAL vs ATUAL (pedido do dono, 2026-10-23): a coluna mostra a build IDEAL (a que a
    // automação escolhe) e, logo abaixo, o que está VESTIDO agora. Sem esta linha, uma peça
    // "em falta" parecia igual a uma equipada.
    const atuais = (eqAgora || []).map((e) => '<span class="bf-item equipado" title="' + esc((infoItem(e.base) || {}).nome || e.base) + '">'
      + '<img src="' + ITEM_IMG(e.base) + '" alt="" loading="lazy" onerror="this.style.opacity=.25">'
      + (e.qual ? '<b class="q">' + esc(e.qual) + '</b>' : '') + '</span>').join('');
    return '<div class="bf-col' + (emUso ? ' em-uso' : '') + '">'
      + '<h4>' + titulo
      + (emUso ? '<span class="tag">em uso agora</span>' : (p.equipadaAgora ? '<span class="tag ok">equipada</span>' : ''))
      + '</h4>'
      + '<p class="bf-dica">' + dica + '</p>'
      + '<p class="bf-dica"><b>ideal</b></p>'
      + '<div class="bf-itens">' + ordenarItens(p.itens || []).map(bfItem).join('') + '</div>'
      + (atuais ? '<p class="bf-dica"><b>vestido agora</b></p><div class="bf-itens">' + atuais + '</div>' : '')
      + (faltam.length
        ? '<p class="hint">Falta: ' + faltam.map((i) => '<b>' + esc(i.nome) + '</b>').join(', ') + ', farmar ou comprar no mercado.</p>'
        : '<p class="hint">Você tem as ' + (p.itens || []).length + ' peças desta build.</p>')
      + (buscar.length
        ? '<p class="hint">Ir buscar: ' + buscar.map((i) => esc(i.nome) + ' (' + (FONTE_NOME[i.fonte] || i.fonte) + ')').join(', ') + '</p>'
        : '')
      + '</div>';
  }
  /** Desenha o bloco da build por fase - que agora vive na aba ITENS - com um botão de
   *  MINIMIZAR no cabeçalho.
   *  Regras deste bloco: (1) vive na aba Itens - fora de um `.pane` ele aparece por cima de
   *  TODAS as abas, porque o CSS dos separadores só esconde `.pane`; (2) minimiza a sério, com o
   *  estado guardado em GUI_KEY (sobrevive ao F5 e à troca de aba). */
  function renderBuildFase() {
    const el = $('ap-build-fase');
    if (!el) return;
    const c = cfg();
    const on = c.buildPorFase !== false;                 // LIGADO por padrão
    const abertoBf = guiPrefs.bfAberto !== false;
    const temMotor = !!MOTOR();
    const pMob = temMotor ? planoFase('mobs') : null;
    const pChefe = temMotor ? planoFase('chefe') : null;
    const ident = identidade() || {};
    // O que está VESTIDO agora (para a coluna dizer "ideal" vs "atual"). Lido do equipamento.
    const eqAgora = (() => { try { return ler('readEquip', []) || []; } catch { return []; } })();
    const estado = !temMotor ? 'a automação ainda não carregou nesta página (F5)'
      : !on ? 'desligado: uma build só, como antes'
        : !pMob ? 'à espera do campeão (o HUD ainda não carregou)'
          : (pMob.ativa ? 'em mobs agora, veste a build de limpeza'
            : (pChefe && pChefe.ativa ? 'no chefe agora, veste a build de alvo único' : 'fora de um ciclo de farm'));
    const corpo = tg('ap-cfg-buildPorFase', 'Trocar a build sozinho quando a luta muda',
      'Em mobs veste a build de limpeza; quando o chefe aparece veste a de alvo único. O que sai fica na mochila e nunca é vendido.', on)
      + (on ? '' : '<p class="aviso warn">Desligado: a automação volta usando uma build só e deixa de reservar as peças da outra.</p>')
      + '<div class="bf-grid">' + bfColuna(pMob, 'mobs', eqAgora) + bfColuna(pChefe, 'chefe', eqAgora) + '</div>'
      + '<p class="hint tira">Campeão: <b>' + esc(ident.nome || '-') + '</b>. Cada peça diz DE ONDE vem: <b>equipado</b>, <b>na mochila</b>, <b>no mercado</b> (oferta sua) ou <b>no cofre</b>. "Falta" = não existe em lado nenhum.</p>';
    // Cabeçalho próprio (não usa card()) porque leva o botão de minimizar ao lado do estado.
    setHtml('ap-build-fase',
      '<section class="card bf' + (abertoBf ? '' : ' min') + '">'
      + '<h3><span>Build por fase, mobs ↔ chefe</span><span class="obs">' + esc(estado) + '</span>'
      + '<button class="ic bf-min" id="ap-bf-min" title="'
      + (abertoBf ? 'Minimizar: deixa só o título (o mesmo botão volta abrindo)' : 'Abrir o bloco da build por fase') + '">'
      + (abertoBf ? '▾' : '▸') + '</button></h3>'
      + '<div class="corpo">' + corpo + '</div></section>');
  }
  /** RESUMO DE UMA LINHA do mesmo bloco, para a 1.ª aba: a primeira aba é um PAINEL DE
   *  CONTROLE, não um relatório - o bloco grande mudou para Itens e aqui fica só o
   *  estado (o que está em uso e quantas peças faltam), para não se perder a leitura.
   *  CUSTO: `planoFase` tem cache de 6 s (`cache('bf-'+fase, 6000, …)`), logo isto são no máximo
   *  2 chamadas aa automação a cada 6 s - e partilha a MESMA cache com o bloco grande. */
  function renderBuildResumo() {
    const el = $('ap-painel-build');
    if (!el) return;
    // SEM `''`: um contentor vazio faz o cartao APARECER depois (o dono pediu GUI estavel).
    if (!MOTOR()) { setHtml('ap-painel-build', '<p class="hint">Build por fase (mobs ↔ chefe): <b>à espera da automação</b>, o HUD do jogo ainda não carregou.</p>'); return; }
    const c = cfg();
    if (c.buildPorFase === false) {
      setHtml('ap-painel-build', '<p class="hint">Build por fase (mobs ↔ chefe): <b>desligada</b>, a automação usa uma build só. Liga-a em <b>Itens</b> ▸ Build por fase.</p>');
      return;
    }
    const pMob = planoFase('mobs'), pChefe = planoFase('chefe');
    const fase = pMob && pMob.ativa ? 'mobs' : (pChefe && pChefe.ativa ? 'chefe' : null);
    const p = (fase === 'chefe' ? pChefe : pMob) || null;
    const pecas = p ? (p.itens || []).length : 0;
    const faltam = p ? (p.faltam || []).length : 0;
    const quem = fase === 'chefe' ? 'no chefe (build de alvo único)' : fase === 'mobs' ? 'em mobs (build de limpeza)' : 'fora de um ciclo de farm';
    setHtml('ap-painel-build', '<p class="hint">Build por fase (mobs ↔ chefe): <b>' + esc(quem) + '</b>'
      + (p ? ' · ' + pecas + ' peça(s)' + (faltam ? ' · <b>' + faltam + '</b> em falta' : ' · você tem todas')
        : ' · à espera do campeão (o HUD do jogo ainda não carregou)')
      + '. O bloco completo está na aba <b>Itens</b>.</p>');
  }

  // ---------------------------------------------------------------- ABA AGORA
  function renderAgora() {
    const a = estadoAgora();
    const c = cfg();
    // 1) estado do personagem
    const barra = (() => {
      if (!a.hp) return '<p class="vazio">vida não lida ainda</p>';
      const p = a.hp.max ? a.hp.cur / a.hp.max : 0;
      const cls = p < 0.25 ? 'crit' : p < 0.5 ? 'low' : '';
      return '<div class="bar"><i class="' + cls + '" style="width:' + (p * 100).toFixed(1) + '%"></i><u>' + fmt(a.hp.cur) + ' / ' + fmt(a.hp.max) + ' (' + pct(p) + ')</u></div>';
    })();
    setHtml('ap-now-estado', card('Estado do personagem', 'lido do HUD do jogo',
      '<div class="kvs">'
      + kv('nível', a.nivel ? String(a.nivel) : '-')
      + kv('ouro', fmt(a.ouro))
      + kv('campeão', esc(a.campeao || '-') + (a.classe ? ' <small>' + esc(a.classe) + '</small>' : ''))
      + kv('onde você está', esc(a.local))
      + '</div>'
      + barra
      + '<p class="hint tira">A vida vem da barra do jogo (é a verdade). O ouro vem do contador do HUD.</p>'));

    // 2) o que o auto-play está fazendo
    const cur = a.cur;
    let corpoFase = '';
    if (cur) {
      const fase = cur.fase === 'boss' ? cur.bossFase : cur.mobFase;
      const ms = Date.now() - ((fase && fase.startedAt) || cur.startedAt || Date.now());
      const g = porMin(fase && fase.gold, ms), x = porMin(fase && fase.xp, ms), p = porMin(fase && fase.potions, ms), k = porMin(fase && fase.kills, ms);
      corpoFase = '<div class="kvs">'
        + kv('está fazendo', cur.fase === 'boss' ? 'LUTAR COM O CHEFE' : 'farmar mobs')
        + kv('região', esc(limparNivel(cur.region)))
        + kv('nesta fase', fmtDur(ms))
        + '</div>'
        + '<div class="kvs">'
        + kv('ouro/min', fmt(g)) + kv('xp/min', fmt(x)) + kv('poções/min', fmt1(p)) + kv('abates/min', fmt(k))
        + '</div>';
      if (cur.fase === 'boss' && cur.mobFase && cur.mobFase.perMin) {
        const m = cur.mobFase.perMin;
        corpoFase += '<p class="hint">Fase de mobs (antes do chefe): ' + fmt(m.gold) + ' ouro/min · ' + fmt(m.xp) + ' xp/min · ' + fmt1(m.potions) + ' poções/min</p>';
      }
      if (fase && fase.ctx) {
        const cs = Object.keys(fase.ctx).filter((kk) => fase.ctx[kk].t > 0.5)
          .map((kk) => esc(kk) + ' ' + fmt((fase.ctx[kk].heal - (fase.ctx[kk].potion || 0)) / fase.ctx[kk].t) + '/s').join(' · ');
        if (cs) corpoFase += '<p class="hint">cura das habilidades por contexto: ' + cs + '</p>';
      }
    } else {
      corpoFase = '<p class="vazio">Sem ciclo ativo. A automação abre um ciclo quando você está no mapa farmando.</p>';
    }
    setHtml('ap-now-fase', card('O que o auto-play está fazendo AGORA', 'medido neste ciclo',
      '<p class="aviso ' + (a.ligado && !a.pausado ? 'ok' : 'warn') + '">' + esc(a.fase) + '</p>' + corpoFase));

    // 3) PORQUE está parado (ou a correr). UM cartão estável, que NUNCA desaparece: a GUI não
    // pode mudar de estrutura (queixa do dono, 2026-10-20). Sem métricas internas: "último
    // batimento", "temporizadores" e "catálogo lido há X" não dizem nada a quem joga.
    const dg = diagBase();
    let bloqueio;
    if (!a.ligado || a.pausado) {
      bloqueio = '<p class="aviso warn">' + (a.pausado ? 'A automação está <b>pausado</b>.' : 'O auto-play está <b>desligado</b> (só observa).') + '</p>'
        + '<div class="acoes">' + acao('ap-retomar', '▶ Retomar', 'Volta a agir do ponto onde parou.') + '</div>';
    } else if (dg && dg.naBase) {
      const fb2 = faltasBase();
      const lista = fb2 && fb2.faltam && fb2.faltam.length
        ? '<ul style="margin:2px 0 0;padding-left:18px">' + fb2.faltam.map((k) => '<li>' + esc(NECESSIDADE_NOME[k] || k) + '</li>').join('') + '</ul>'
        : '<p class="aviso ok">A base está completa: nada falta fazer aqui.</p>';
      bloqueio = (dg.motivo ? '<p class="aviso warn">Motivo mais urgente: <b>' + esc(dg.motivo) + '</b></p>' : '')
        + lista
        + '<p class="hint tira">Quando esta lista fica vazia, a automação viaja para ' + esc(a.regiao || 'a melhor região') + '.</p>'
        + diag('Forçar agora (manutenção manual)',
          '<div class="acoes">' + acaoD('ap-base-go-agora', '🏠 Rodar a rotina de base agora', 'Executa todos os passos pendentes de uma vez. A automação faz isto sozinho quando decide voltar à Fonte.') + '</div>');
    } else if (dg && travaReal(dg).length) {
      const esp = esperaReal(dg);
      bloqueio = '<ul style="margin:2px 0 0;padding-left:18px">' + travaReal(dg).map((t) => '<li>' + esc(traduzTrava(t)) + '</li>').join('') + '</ul>'
        + (esp.length ? '<p class="aviso warn">Aguardando: ' + esc(esp.map(traduzTrava).join(' · ')) + '</p>' : '')
        + '<p class="hint tira">Quando nenhuma destas travas estiver ativa, a automação viaja sozinho para ' + esc(a.regiao || 'a melhor região') + '.</p>';
    } else {
      bloqueio = '<p class="aviso ok">Sem impedimentos: a automação está a jogar.</p>';
    }
    setHtml('ap-now-parado', card('O que a impede agora', 'em português, o que a impede de agir', bloqueio));

    // 4) combate ao vivo
    const L = live();
    if (!L) {
      setHtml('ap-now-combate', card('Combate ao vivo', 'sem leitura do jogo',
        '<p class="vazio">O script de leitura (content.js) ainda não publicou dados. Espere alguns segundos ou recarregue a página.</p>'));
    } else {
      const d = L.dps || {}, r = L.rates || {};
      const nomeF = (f) => (f === 'ataque' ? 'ataque normal' : f === 'item' ? 'passiva de item' : f === 'queima' ? 'queimadura' : f === 'P' ? 'passiva' : f === 'sangue' ? 'sangue' : f);
      const pf = d.porFonte || {};
      const fontes = Object.keys(pf).map((k2) => [k2, pf[k2]]).filter((x) => x[1] > 0).sort((x, y) => y[1] - x[1]);
      const cv = ler('estadoVivo', null) || {};
      const inimigos = (Array.isArray(cv.inimigos) ? cv.inimigos : [])
        .filter((i) => i && Number(i.hp) > 0)
        .sort((a, b) => (Number(!!b.chefe) - Number(!!a.chefe)) || (Number(a.chefia || 0) - Number(b.chefia || 0)) || (Number(a.hp) / Math.max(1, Number(a.hpMax)) - Number(b.hp) / Math.max(1, Number(b.hpMax))))
        .slice(0, 6);
      const tagIni = (i) => [i.chefe ? 'CHEFE' : '', i.guardiao ? 'guardião' : '', i.furioso ? 'furioso' : '', i.elite ? 'elite' : '', i.noturno ? 'noturno' : '', Number(i.chegada) > 0 ? 'chegando' : ''].filter(Boolean).join(' · ');
      const listaIni = inimigos.length
        ? '<div class="inimigos">' + inimigos.map((i) => {
          const p2 = Math.max(0, Math.min(100, (Number(i.hp) / Math.max(1, Number(i.hpMax))) * 100));
          const cor = p2 > 50 ? '#40e060' : p2 > 25 ? '#ffd84a' : '#ff5050';
          const t2 = tagIni(i);
          return '<div class="ini"><span class="nome">' + esc(i.nome || '?') + (i.nivel ? ' nv ' + esc(i.nivel) : '') + (t2 ? ' <span class="tag">' + esc(t2) + '</span>' : '')
            + '</span><i><b style="width:' + p2.toFixed(1) + '%;background:' + cor + '"></b></i><em>' + fmt(Math.round(Number(i.hp))) + ' / ' + fmt(Math.round(Number(i.hpMax))) + '</em></div>';
        }).join('') + '</div>'
        : '';
      const t = L.target;
      setHtml('ap-now-combate', card('Combate ao vivo', 'medido pelo dano que aparece na tela',
        '<div class="kvs">'
        + kv('dano que você faz', fmt(d.out || r.myDps || 0), '/s')
        + kv('dano que recebes', fmt(d.in || 0), '/s')
        + kv('cura total', fmt(r.healRate || 0), '/s')
        + kv('cura das habilidades', fmt(r.healSkillRate || 0), '/s')
        + kv('poções usadas', fmt(r.potionRate || 0), '/min')
        + '</div>'
        + (t ? '<p class="aviso">Alvo: <b>' + esc(t.name || '?') + '</b>' + (t.level ? ' nível ' + esc(t.level) : '') + (t.boss ? ' 👑 CHEFE' : '') + '</p>' : '<p class="vazio">sem alvo neste momento</p>')
        + (L.bossHp ? '<p class="aviso warn">Chefe <b>' + esc(L.bossHp.nome || '') + '</b> com ' + esc(L.bossHp.pct) + '% de vida</p>' : '')
        + (L.carga ? '<p class="aviso err">⚠ Golpe especial carregado: <b>' + esc(L.carga.mec) + '</b>, a poção mais forte dispara antes do golpe.</p>' : '')
        + (L.furia ? '<p class="aviso warn">O chefe está FURIOSO: ataca 1,5× mais rápido durante alguns segundos.</p>' : '')
        + listaIni
        + (fontes.length ? '<div class="chips">' + fontes.map((x) => '<span class="tag">' + esc(nomeF(x[0])) + ' ' + fmt(x[1]) + '/s</span>').join('') + '</div>' : '<p class="hint">ainda sem dano medido por fonte</p>')));
    }

    // 5) poções
    const pot = (status && status.potions) || null;
    const counts = ler('readPotions', {}) || {};
    const min = c.minPotion || { vida: 200, vidaF: 100, vidaS: 30 };
    // CURA e PREÇO LIDOS do catálogo do jogo (`META.pocoes`, motor.js:288-294) pelo `pocaoInfo`.
    // Estavam escritos à mão aqui (300/900/2200) - REGRA Nº 3.
    const infoP = (k) => { try { return ler('pocaoInfo', {}, k) || {}; } catch { return {}; } };
    // GASTO MEDIDO em poções (ouro/min) na região onde o boneco está: vem do `agregar()` (ciclos
    // observados), nunca de uma conta nova. `null` = ainda sem medida.
    let gastoPotMin = null;
    try {
      const loc = String(ler('readLocation') || '');
      const rows = ler('agregar') || [];
      const r = loc ? rows.find((x) => loc.indexOf(String(x.region || '').split(' nível')[0]) >= 0) : null;
      gastoPotMin = r ? Number(r.goldPotionMin) : (rows[0] ? Number(rows[0].goldPotionMin) : null);
    } catch { gastoPotMin = null; }
    const valorStock = ORDER.reduce((s, k) => s + (Number(counts[k] || 0) * (Number(infoP(k).preco) || 0)), 0);
    const ultima = status && status.lastAction;
    const cartoes = ORDER.map((k) => {
      const n = Number(counts[k] || 0);
      const baixo = n < Number(min[k] || 0);
      const ip = infoP(k);
      const cura = Number(ip.cura) || 0;
      const preco = Number(ip.preco) || 0;
      const custo = n * preco;
      // A COLUNA DO DONO (2026-10-23): QUANTIDADE **e** OURO. Antes só aparecia a contagem - ele
      // perguntou quanto custava. Agora: quantidade, ouro por unidade e o valor do stock.
      return '<div class="pot ' + (baixo ? 'baixo' : '') + '">' + (potIcon(k) ? '<img src="' + potIcon(k) + '" alt="">' : '')
        + '<div><span class="q">' + fmt(n) + '</span><small>' + POCAO_NOME[k]
        + (cura ? ' · cura ' + fmt(cura) : '') + ' · mínimo ' + fmt(min[k])
        + (preco ? ' · ' + fmt(preco) + ' ouro cada' : '')
        + (preco ? ' · stock ' + fmt(custo) + ' ouro' : '') + '</small></div></div>';
    }).join('');
    const planoPocao = ler('planPotions', null, counts);
    setHtml('ap-now-pocoes', card('Poções', 'a auto-poção usa a mais fraca que for suficiente',
      '<div class="pots">' + cartoes + '</div>'
      + '<p class="hint tira">A auto-poção decide pelo <b>golpe que o monstro acabou de dar</b> (não por médias) e conta a cura das suas habilidades. Se a cura chegar, não gasta poção.</p>'
      // O DINHEIRO, à vista: quanto vale o stock que está na mochila e quanto se gasta por minuto.
      + (valorStock
        ? '<p class="aviso ok">Stock de poções: <b>' + fmt(valorStock) + '</b> ouro para repor tudo'
          + (gastoPotMin != null ? ' · gasto medido: <b>' + fmt(gastoPotMin) + '</b> ouro/min' : '') + '</p>'
        : '')
      + (ultima ? '<p class="aviso ok">Última decisão: usou <b>' + esc(POCAO_NOME[ultima.k] || ultima.k) + '</b>, ' + esc(ultima.reason || '') + '</p>' : '<p class="vazio">ainda não usou nenhuma poção</p>')
      + (planoPocao ? '<p class="aviso warn">Em falta: ' + esc((planoPocao.faltas || []).map((k) => POCAO_NOME[k]).join(', ')) + '. Vai comprar: '
        + esc(ORDER.filter((k) => planoPocao.comprar[k] > 0).map((k) => POCAO_NOME[k] + ' ×' + fmt(planoPocao.comprar[k])).join(' · ') || 'nada (sem ouro)') + '</p>'
        : '<p class="hint">Poções acima do mínimo, nada comprando.</p>')));

    // 6) ESTADO COMPLETO DO JOGO - inventário, equipamento, habilidades, cofre, mobs/bosses e o
    // próximo passo. É o retrato que o MOTOR mantém atualizado (automation.js: `estadoCompleto`,
    // gravado a cada 20 s em ESTADO_KEY), não uma segunda leitura do DOM feita aqui. Se ainda não
    // houver retrato (a primeira gravação corre ~2,5 s depois de a automação arrancar), não se inventa.
    const est = estadoStore;
    if (!est || !est.at) {
      setHtml('ap-now-jogo', card('Estado completo do jogo', 'a automação mantém isto atualizado sozinho (a cada 20 s)',
        '<p class="vazio">A primeira leitura do estado do jogo ainda não chegou.</p>'
        + '<p class="hint tira">O retrato completo é gravado cerca de 2,5 s depois de a automação arrancar e volta a ser gravado a cada 20 s.</p>'));
    } else {
      const nomeDe = (b) => nomeItem(b);
      const inv = est.inventario;
      const itensInv = inv && inv.itens ? inv.itens : [];
      const invRes = itensInv.slice(0, 10).map((i) => i.espolio
        ? '<span class="tag">' + esc(i.espolio) + ' ×' + fmt(i.qtd) + '</span>'
        : '<span class="tag">' + esc(nomeDe(i.nome || i.id)) + (i.qual && i.qual !== 'C' ? ' <b>' + esc(i.qual) + '</b>' : '') + (i.refino ? ' +' + i.refino : '') + '</span>').join('');
      const eq = est.equipado || [];
      const eqRes = eq.length ? eq.map((e) => '<span class="tag">' + esc(nomeDe(e.nome || e.base)) + (e.qual && e.qual !== 'C' ? ' <b>' + esc(e.qual) + '</b>' : '') + (e.refino ? ' +' + e.refino : '') + '</span>').join('') : '<span class="vazio">nada equipado lido</span>';
      const hab = est.habilidades || {};
      const barra = (hab.barra || []).map((t) => (hab.prontas || []).indexOf(t) >= 0 ? '<b>' + esc(t) + '</b>' : esc(t)).join(' · ');
      const cofre = est.cofre || [];
      const chefe = est.chefe;
      const alvo = est.mobs && est.mobs.alvo;
      const pot = est.pocoes || {};
      const prox = est.proximoPasso;
      setHtml('ap-now-jogo', card('Estado completo do jogo', 'a automação mantém isto atualizado sozinho (a cada 20 s)',
        '<div class="kvs">'
        + kv('campeão', esc(est.campeao || '-') + (est.alvo && est.alvo.length ? ' <small>alvo: ' + esc(est.alvo.join(', ')) + '</small>' : ''))
        + kv('nível', est.nivel == null ? '-' : String(est.nivel))
        + kv('ouro', fmt(est.ouro))
        + kv('onde', esc(est.local || '-'))
        + kv('atualizado', 'há ' + fmtDur(Date.now() - est.at))
        + '</div>'
        + '<p class="diag-t">Mochila, ' + (inv ? fmt(inv.used) + '/' + fmt(inv.cap) + ' espaços' : 'não lida') + '</p>'
        + '<div class="chips">' + (invRes || '<span class="vazio">vazia</span>') + (itensInv.length > 10 ? '<span class="tag">+ ' + (itensInv.length - 10) + '</span>' : '') + '</div>'
        + '<p class="diag-t">Equipado</p>'
        + '<div class="chips">' + eqRes + '</div>'
        + '<p class="diag-t">Habilidades</p>'
        + '<div class="kvs">'
        + kv('na barra', barra || '-', hab.prontas && hab.prontas.length ? '(a bold = pronta)' : '')
        + kv('pontos por gastar', hab.pontos == null ? '-' : String(hab.pontos))
        + kv('ranks', esc((hab.ranks || []).join(' · ') || '-'))
        + '</div>'
        + '<p class="diag-t">Cofre, ' + fmt(cofre.length) + ' peças conhecidas</p>'
        + '<div class="chips">' + (cofre.slice(0, 10).map((c) => '<span class="tag">' + esc(nomeDe(c.nome || c.base)) + (c.qual && c.qual !== 'C' ? ' <b>' + esc(c.qual) + '</b>' : '') + '</span>').join('') || '<span class="vazio">nada guardado lido</span>') + '</div>'
        + '<p class="diag-t">Mobs e bosses</p>'
        + '<div class="kvs">'
        + kv('alvo agora', alvo ? esc(alvo.name || '?') + (alvo.boss ? ' 👑' : '') : '-')
        + kv('chefe', chefe ? esc(chefe.nome || chefe) + (chefe.pct != null ? ', ' + esc(chefe.pct) + '% de vida' : '') : '-')
        + kv('poções', ORDER.map((k) => POCAO_NOME[k] + ' ' + fmt(pot[k] || 0)).join(' · '))
        + '</div>'
        + '<p class="hint">' + (prox && prox.sobrevive === true
          ? 'Próximo passo por omissão: farmar <b>' + esc(limparNivel(prox.regiao)) + '</b>, '
            + (prox.ouroLiquidoMin != null ? fmt(prox.ouroLiquidoMin) + ' ouro limpo/min' : 'ouro limpo sem medição')
            + ' · ' + fmt(prox.xpMin) + ' xp/min.'
          : 'Nenhuma região com segurança provada ainda, a automação decide após medir as regiões.') + '</p>'));
    }
  }

  // ------------------------------------- ÁRVORE DE INTERRUPTORES (hierarquia da automação)
  // A automação JÁ tem a tabela (`INTERRUPTORES`) e o resolvedor (`podeFazer`) e expõe
  // os dois por `arvoreInterruptores()` -> [{nome, pai, cfg, temExcecao, pode, porque}].
  // AQUI SÓ SE DESENHA ESSA VERDADE: pais e filhos indentados. Nada é decidido nesta GUI - se o
  // motor mudar a tabela (um switch novo é UMA linha lá), a árvore muda sozinha.
  const ARV_NOME = {
    manutencao: 'Manutenção (recurso base)',
    autoplay: 'Tudo (auto-play)',
    irBase: 'Ir à base (Fonte)',
    vender: 'Vender o lixo ao lojista',
    repor: 'Repor poções',
    comprar: 'Comprar no mercado (build e vigia)',
    refino: 'Refinar no Ornn',
    montar: 'Montar item no Ornn',
    cofre: 'Cofre (guardar e retirar)',
    fugir: 'Fugir do que mata',
    equip: 'Equipar a melhor peça de cada slot',
    atrib: 'Distribuir pontos de atributo',
    hab: 'Subir habilidades',
    anunciar: 'Anunciar lendários no mercado',
    buildPorFase: 'Trocar a build conforme a luta',
    skillsPorFase: 'Trocar as habilidades conforme a luta',
    rotacao: 'Repor a rotação na barra',
    farm: 'Auto farm (viajar e farmar)',
    cartasAbrir: 'Abrir cartas misteriosas',
    cartasEncaixar: 'Encaixar cartas nos itens (Ornn)',
    tarefa: 'Equipar a melhor peça de cada slot',
  };
  /** Switch -> bloco da aba MACRO onde os detalhes daquele switch se configuram. O ⚙ da
   *  árvore leva lá (pedido do dono 2026-10-21). Chave = `cfg` do switch. */
  const MACRO_ALVO = {
    autoFarm: 'ap-macro-farm',
    // Os detalhes de cada interruptor são PÁGINAS DE CONFIGURAÇÃO (ordem do dono, 2026-10-23:
    // "o pop up de cada switch... tem que ser a mesma pagina de configuracao daquele switch.
    // nao só uma info"). Antes, vender/repor/cofre/equipar/tarefa caíam todos em `ap-auto-base`,
    // que era um parágrafo a dizer "não há nada para clicar aqui" - vazio por desenho.
    autoVender: 'ap-cfg-base',
    autoRepor: 'ap-cfg-repor',
    autoCofre: 'ap-cfg-base',
    autoComprar: 'ap-cfg-comprar',
    autoRefino: 'ap-cfg-base',
    autoMontar: 'ap-cfg-base',
    autoAnunciar: 'ap-cfg-anunciar',
    cartasAbrir: 'ap-macro-cartas',
    cartasEncaixar: 'ap-macro-cartas',
    buildPorFase: 'ap-build-fase',
    skillsPorFase: 'ap-build-fase',
    rotacaoSkills: 'ap-build-fase',
    autoHab: 'ap-t-personagem',
    autoAtrib: 'ap-cfg-base',
    pocaoSmart: 'ap-t-pocao',
    autoEquip: 'ap-cfg-base',
    autoTarefa: 'ap-cfg-base',
  };
  const ARV_AJUDA = {
    manutencao: 'recurso base (vender, equipar, mercado, pontos, cofre), funciona em qualquer campeão',
    autoplay: 'o switch mestre: desligado, a automação só observa (não clica em nada)',
    irBase: 'voltar à Fonte para tratar de tudo o que é da base',
    vender: 'vende ao lojista só o que o plano da mochila diz que é lixo',
    repor: 'compra poções no Lojista até o mínimo que você escolheu',
    comprar: 'compra no mercado o item da build ideal que falta E as ofertas da sua vigia (itens e jogadores)',
    refino: 'gasta ouro refinando seus lendários tier A+ até o teto',
    montar: 'tenta montar no Ornn a receita mais barata que serve a build (é uma aposta)',
    cofre: 'guarda no cofre e vai buscar o que está lá',
    fugir: 'foge da região (tecla B) quando o golpe passa da cura possível, quando a região mata ou quando a luta está perdida sem poções que cheguem, e volta sozinho à região quando a fuga não foi por morte certa',
    equip: 'troca sempre que aparecer uma peça melhor para o slot',
    atrib: 'gasta sozinho os pontos de atributo livres',
    hab: 'sobe as habilidades quando há pontos',
    anunciar: 'põe à venda os lendários abaixo de tier A a ~90% do preço mais baixo',
    buildPorFase: 'em mobs veste a build de limpeza; no chefe a de alvo único',
    skillsPorFase: 'em mobs prefere as habilidades de área; no chefe as de alvo único',
    rotacao: 'põe na barra as 4 habilidades prontas que dão mais dano',
  };
  /** O QUE CADA SWITCH COBRE - é a linha colorida ao lado dele: VERDE quando está ligado (o que
   *  passa a acontecer) e VERMELHA quando está desligado (o que deixa de acontecer). O texto fala
   *  do efeito no jogo, não do nome técnico da chave.
   *  Fonte: a tabela INTERRUPTORES da automação (automation.js:2460) e as funções que cada switch
   *  comanda (venderBase, autoEquip, reporPocoes, refinarMelhores, montarMelhorReceita, cofre,
   *  distribuirAtributos, subirHabilidades, anunciarLendarios, trocarBuildDaFase, rotacaoSkills,
   *  checarChefeFatal). */
  const ARV_COBRE = {
    manutencao: { on: 'Vende, equipa, gasta pontos e mexe no cofre quando vale a pena, em qualquer campeão.', off: 'Nada de manutenção: a mochila enche, os pontos ficam parados e o cofre não é lido.' },
    autoplay: { on: 'Farma, viaja e escolhe a região sozinho.', off: 'Não farma nem viaja: só observa e mede.' },
    irBase: { on: 'Volta à Fonte quando alguma pendência paga a viagem.', off: 'Não volta à Fonte: nenhuma ação de base acontece.' },
    vender: { on: 'Vende no Lojista o básico, o épico e o duplicado (tier S+ nunca).', off: 'Nada é vendido, a mochila enche e você perde loot.' },
    repor: { on: 'Compra poções no Lojista até o mínimo que você escolheu.', off: 'As poções acabam e faltam curas no meio da luta.' },
    comprar: { on: 'Compra no mercado o item da build ideal que falta e as ofertas da vigia (itens e jogadores).', off: 'Nenhuma compra: a build só completa com o que cair no chão e a vigia não compra.' },
    refino: { on: 'Refina no Ornn os lendários tier A+ até o teto.', off: 'Os itens ficam no refino em que estão.' },
    montar: { on: 'Tenta montar no Ornn a receita mais barata que serve a build.', off: 'Nenhuma tentativa de montagem: nenhum item novo sai das peças.' },
    cofre: { on: 'Lê o cofre na Fonte e guarda o que deve ficar guardado.', off: 'O cofre nunca é lido, o painel fica sem saber o que está guardado.' },
    fugir: { on: 'Foge para a Fonte quando algo mata você, e volta sozinho à região quando a fuga não foi por morte certa.', off: 'Nada foge: se o golpe ou a região mata, você morre.' },
    equip: { on: 'Equipa sempre a melhor peça de cada slot.', off: 'O que está vestido fica como está, mesmo com peça melhor na mochila.' },
    atrib: { on: 'Gasta os pontos de atributo pelo modelo escolhido.', off: 'Os pontos de atributo ficam parados.' },
    hab: { on: 'Sobe as habilidades quando há pontos.', off: 'Os pontos de habilidade ficam parados.' },
    anunciar: { on: 'Anuncia no mercado os lendários abaixo de A, a ~90% do menor preço.', off: 'Nada é anunciado: os lendários ficam ocupando espaço na mochila.' },
    buildPorFase: { on: 'Troca a build entre mobs e chefe conforme a luta.', off: 'Uma build só: as peças da outra fase não são reservadas.' },
    skillsPorFase: { on: 'Prefere habilidades de área em mobs e de alvo único no chefe.', off: 'A barra não muda com o contexto da luta.' },
    rotacao: { on: 'Mantém na barra as melhores habilidades, com a ultimate.', off: 'A barra fica como está, pode ficar sem a ultimate.' },
  };
  /** Marca dos switches com EXCEÇÃO. A automação já manda o texto (`excecaoTxt` em
   *  `arvoreInterruptores()`, automation.js:2293); este mapa é só o recurso para um versão antiga. */
  const ARV_EXCECAO = {
    vender: 'skippado em Runeterra',
    cofre: 'skippado em Runeterra',
    anunciar: 'skippado em Runeterra',
  };
  const arvExc = (nome, s) => (s && s.excecaoTxt) || ARV_EXCECAO[nome] || 'pode ser skippado por uma exceção';
  /** Traduz o `porque` da automação ("vender: desligado pelo dono") em {quem, motivo}. O motor
   *  escreve SEMPRE "<nome do switch que falhou>: <motivo>" - é isso que permite separar
   *  "desligado por você" (quem === este) de "bloqueado pelo pai" (quem === um ancestral). */
  function arvQuemBloqueia(txt) {
    const m = /^\s*([^:]+):\s*(.+?)\s*$/.exec(String(txt == null ? '' : txt));
    return m ? { quem: m[1], motivo: m[2] } : { quem: null, motivo: '' };
  }
  /** UM switch: estado PRÓPRIO + o que ele cobre (linha verde/vermelha) + os filhos indentados.
   *  INDEPENDÊNCIA: o switch do filho mostra o que ELE diz - se está ligado e o
   *  pai o bloqueia, fica "ligado, mas inerte" e diz por quem, em vez de parecer desligado. */
  function arvNo(s, ramos, nivel) {
    if (nivel > 8) return '';                       // guarda contra um pai cíclico: nunca recursa sem fim
    const c = cfg();
    const nome = String(s.nome || '?');
    // `cfg` FALTA = MOTOR ANTIGO. O contrato (TK-01) diz que TODO o switch tem chave própria; um
    // nó sem `cfg` é um motor que ainda não foi actualizado. Mostra-se o ERRO, nunca um badge
    // "implícito" que fingia que o switch existia (pedido do dono, TK-02 §2).
    const semChave = !s.cfg;
    const temCfg = !semChave;
    const proprio = temCfg ? c[s.cfg] !== false : true;
    const z = arvQuemBloqueia(s.porque);
    // ---------------- ESTADO de cada switch (do MOTOR)
    // O TEXTO do estado NÃO se repete no motivo: antes o cartão mostrava "desligado por você"
    // duas vezes na mesma linha (queixa do dono, 2026-10-20). O motivo só aparece quando
    // acrescenta informação (pai que bloqueia, exceção, versão antiga).
    const bloqueado = s.pode === false;
    const porExcecao = !semChave && bloqueado && /excep/i.test(z.motivo);
    const porPai = !semChave && bloqueado && !porExcecao && !!z.quem && z.quem !== nome;
    const inerte = !semChave && bloqueado && !porExcecao && proprio;     // o switch está LIGADO; o pai é que fecha
    let cls, est;
    if (s.ignorarCfg) { cls = 'on'; est = 'sempre ligado'; }             // sem toggle por desenho
    else if (semChave) { cls = 'erro'; est = 'sem chave na automação'; }
    else if (porExcecao) { cls = 'skip'; est = 'ligado, mas skippado'; }
    else if (inerte) { cls = 'bloq'; est = 'ligado, mas inerte'; }
    else if (bloqueado) { cls = 'bloq'; est = 'desligado por você'; }
    else { cls = 'on'; est = c[s.cfg] === undefined ? 'ligado (padrão)' : 'ligado e agindo'; }
    let motivo = '';
    if (semChave) motivo = '<span class="arv-motivo err">⚠ versão antiga: recarregue a página (F5), este switch não tem chave própria na automação.</span>';
    else if (porExcecao) motivo = '<span class="arv-motivo">⚠ a automação pula este agora: ' + esc(arvExc(nome, s)) + '</span>';
    else if (porPai) motivo = '<span class="arv-motivo">' + (inerte ? 'não age enquanto ' : 'bloqueado por ')
      + '<b>' + esc(ARV_NOME[z.quem] || z.quem) + '</b>' + (inerte ? ' estiver desligado' : ' (está desligado)') + '</span>';
    // TEXTO CORTO (ordem do dono, 2026-10-21): a frase do que o switch "cobre" saiu da lista.
    // O nome do switch já diz o que é; a explicação ficou no tooltip (`ARV_AJUDA`).
    const linha = '';
    const ctrl = s.ignorarCfg
      ? '<span class="tag" title="este switch não tem liga/desliga: a vigia trabalha sempre, mesmo com os switches desligados">sempre</span>'
      : temCfg
      ? '<label class="arv-tg" title="' + esc((ARV_AJUDA[nome] || '') + ' (nome técnico na automação: ' + s.cfg + ')') + '"><input type="checkbox" id="ap-arv-' + esc(nome)
        + '" data-arv="' + esc(nome) + '" data-cfg="' + esc(s.cfg) + '"' + (proprio ? ' checked' : '')
        + '><span class="sw"></span></label>'
      : '<span class="arv-erro" title="este switch não tem chave na automação desta página, recarregue (F5) para a versão nova">versão antiga: recarregue</span>';
    const meus = ramos[nome] || [];
    // BOTÃO ⚙ -> aba MACRO, no bloco de detalhes DESTE switch (pedido do dono 2026-10-21).
    // Só aparece nos switches que têm detalhes configuráveis (`MACRO_ALVO`).
    const alvoMacro = MACRO_ALVO[s.cfg];
    const engr = alvoMacro
      ? '<button type="button" class="arv-cfg" data-macro="' + esc(alvoMacro) + '" title="Configurar os detalhes">⚙</button>'
      : '';
    // SWITCH À ESQUERDA: o interruptor vem antes do nome, não no fim da linha.
    // `.arv-item` agrupa o nó + a linha do que ele cobre + os filhos. Sem este invólucro o
    // `grid` da árvore colocava a descrição numa coluna e o nó noutra.
    return '<div class="arv-item" data-item="' + esc(nome) + '">'
      + '<div class="arv-no ' + cls + (nome === 'autoplay' ? ' mestre' : '') + '" data-no="' + esc(nome) + '">'
      + '<i class="arv-dot"></i>'
      + ctrl
      + '<b>' + esc(ARV_NOME[nome] || nome) + '</b>'
      + engr
      + '<small class="arv-est">' + esc(est) + '</small>'
      + motivo
      + (s.temExcecao ? '<span class="tag arv-exc" title="a automação pula este switch em certas condições">⚠ ' + esc(arvExc(nome, s)) + '</span>' : '')
      + '</div>'
      + linha
      + (meus.length ? '<div class="arv-filhos">' + meus.map((f) => arvNo(f, ramos, nivel + 1)).join('') + '</div>' : '')
      + '</div>';
  }
  /** Desenha a lista de switches. ESTADO VAZIO HONESTO: sem auto-play (ou sem a função) diz-se isso,
   *  em vez de desenhar uma lista vazia que pareceria "não há switches". */
  function renderArvore() {
    // O mestre recria o container quando o texto do estado muda; a cache da árvore não sabe
    // disso e deixaria o espaço vazio. Container vazio = escrever de novo, sem confiar na cache.
    const alvoArv = $('ap-auto-arvore');
    if (alvoArv && !alvoArv.childNodes.length) _ultimoHtml.delete('ap-auto-arvore');
    const r = chamar('arvoreInterruptores');
    if (!r.ok || !Array.isArray(r.v) || !r.v.length) {
      const semMotor = !MOTOR();
      setHtml('ap-auto-arvore',
        '<div class="mestre-sub"><b>O que o mestre liga e desliga</b><span>lista de funções</span></div>'
        + '<p class="vazio">' + (semMotor
          ? 'O auto-play ainda não carregou nesta página, não há switches para mostrar.'
          : r.erro === 'sem-funcao'
            ? 'Esta versão da automação ainda não expõe a lista de switches (falta <b>arvoreInterruptores</b>).'
            : 'A automação respondeu, mas não declarou nenhum switch.') + '</p>'
        + '<p class="hint tira">Este bloco não inventa nada: mostra exatamente os switches que a automação declara'
        + (semMotor ? ', recarregue a página com <b>F5</b>.' : '.') + '</p>');
      return;
    }
    const lista = r.v.filter((x) => x && x.nome);
    const porNome = {};
    for (const x of lista) porNome[x.nome] = x;
    const ramos = {}, raizes = [];
    for (const x of lista) {
      const pai = x.pai && porNome[x.pai] ? x.pai : null;      // pai desconhecido = raiz (nunca se perde um nó)
      if (pai) (ramos[pai] = ramos[pai] || []).push(x);
      else raizes.push(x);
    }
    // O switch MESTRE primeiro; a manutenção é o outro ramo independente (recurso base).
    const ordem = { autoplay: 0, manutencao: 1 };
    raizes.sort((a, b) => (ordem[a.nome] == null ? 9 : ordem[a.nome]) - (ordem[b.nome] == null ? 9 : ordem[b.nome]));
    const c = cfg();
    const bloq = lista.filter((x) => x.pode === false);
    const porPai = bloq.filter((x) => { const z = arvQuemBloqueia(x.porque); return !/excep/i.test(z.motivo) && !!z.quem && z.quem !== x.nome; });
    const skip = bloq.filter((x) => /excep/i.test(arvQuemBloqueia(x.porque).motivo));
    // Nós SEM chave = versão antiga (o contrato diz que todo o switch tem `cfg`). Não se finge um
    // switch: mostra-se o erro e um aviso no topo do cartão.
    const semChave = lista.filter((x) => !x.cfg);
    // "Ligado, mas inerte": o switch do próprio está ligado e a automação não age porque o pai fecha.
    const inerte = bloq.filter((x) => { const z = arvQuemBloqueia(x.porque); return !/excep/i.test(z.motivo) && !!x.cfg && c[x.cfg] !== false; });
    const desligados = bloq.length - inerte.length - skip.length;
    // Nós SEM chave não contam como "agindo": a automação desta página não os pode desligar nem ligar,
    // por isso somá-los aqui faria a contagem mentir (eles têm o seu próprio alerta no topo).
    const agindo = lista.length - bloq.length - semChave.length;
    const mestre = porNome.autoplay;
    // O CASO A DESTACAR: ligado no switch e mesmo assim sem agir. O auto-play NÃO tem mais
    // excepção de campeão (TK-01): a mensagem não cita "alvo".
    const alerta = (mestre && mestre.pode === false && c.enabled !== false)
      ? '<p class="aviso warn">O switch mestre está <b>LIGADO</b> mas <b>skippado</b> agora: ' + esc(arvExc('autoplay', mestre))
        + '. Enquanto for assim, nenhum switch abaixo age - nem vender, nem equipar.</p>'
      : '';
    const alertaMotor = semChave.length
      ? '<p class="aviso err">⚠ <b>' + String(semChave.length) + ' switch(es) sem chave própria na automação</b> ('
        + esc(semChave.map((x) => ARV_NOME[x.nome] || x.nome).join(', '))
        + '). A automação desta página é ANTIGO: recarregue (F5) para os interruptores reais aparecerem.</p>'
      : '';
    // AGRUPAMENTO POR CONVENIÊNCIA (ordem do dono, 2026-10-22): dois grupos planos, em vez da
    // árvore de pais/filhos. "No dia a dia" começa no vender/repor/poção e acaba no anunciar;
    // "Gastos e extras" leva o que ele só mexe de vez em quando (habilidades, atributos, Ornn,
    // cartas). A ordem E o grupo vêm do motor (`arvoreInterruptores`), a GUI só desenha.
    const temGrupo = lista.some((x) => x && x.grupo);
    let corpoArv;
    if (temGrupo) {
      const g = { jogo: [], gastos: [] };
      for (const x of lista) {
        if (x.nome === 'autoplay') continue;                    // o mestre já está no cartão acima
        (g[x.grupo === 'gastos' ? 'gastos' : 'jogo']).push(x);
      }
      for (const k of Object.keys(g)) g[k].sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
      const bloco = (titulo, arr) => (arr.length
        ? '<div class="mestre-sub"><b>' + esc(titulo) + '</b><span>' + String(arr.length) + '</span></div>'
          + '<div class="arv">' + arr.map((x) => arvNo(x, {}, 0)).join('') + '</div>'
        : '');
      corpoArv = bloco('No dia a dia', g.jogo) + bloco('Gastos e extras', g.gastos);
    } else {
      const bases = [];
      for (const x of (ramos.autoplay || [])) bases.push(x);
      for (const x of raizes) if (x.nome !== 'autoplay') bases.push(x);
      if (!bases.length) bases.push(...raizes);
      corpoArv = '<div class="arv">' + bases.map((x) => arvNo(x, ramos, 0)).join('') + '</div>';
    }
    // BOTÃO "DESLIGAR TUDO" (ordem de 2026-10-20): um clique desliga todos os switches
    // filhos; o mesmo botão, agora "Religar o que estava", devolve o conjunto que o dono
    // tinha escolhido. O retrato é do MOTOR (`estadoSwitches`), não da GUI.
    const es = chamar('estadoSwitches');
    const todos = (es.ok && es.v) || { todosOff: false, guardados: null };
    const btnTudo = '<div class="acoes"><button class="btn ' + (todos.todosOff ? 'ok' : 'sec') + '" id="ap-sw-todos">'
      + (todos.todosOff
        ? 'Religar o que estava ligado' + (todos.guardados != null ? ' (' + String(todos.guardados) + ')' : '')
        : 'Pausar tudo')
      + '</button></div>';
    setHtml('ap-auto-arvore',
      '<div class="mestre-sub"><b>O que o auto-play faz</b><span>' + String(lista.length) + ' funções</span></div>'
      + alertaMotor
      + alerta
      + btnTudo
      + '<p class="hint"><b>' + String(agindo) + ' ligadas</b> · ' + String(desligados) + ' desligadas · '
      + String(inerte.length) + ' inertes (o pai está desligado).</p>'
      + corpoArv);
  }


  // O cartão "Automatismos da automação" foi REMOVIDO: era uma cópia da árvore de switches que já
  // vive dentro do cartão AUTO-PLAY (queixa do dono, 2026-10-20). O switch da barra por
  // disponibilidade passou para a aba Personagem; o "trocaItens" antigo saiu (o buildPorFase
  // faz o mesmo e é o caminho da automação).

  // ---------------------------------------------------------------- ABA AUTO-PLAY
  /** Sincroniza os campos de poção com a config, sem reconstruir o HTML (perderia o foco). */
  function sincronizarPocao() {
    const maxVida = (hpAgora() && hpAgora().max) || (ler('player', {}) || {}).vida || 4188;
    for (const k of ORDER) {
      const v = Object.assign({ enabled: true, mode: 'pct', value: k === 'vidaS' ? 60 : k === 'vidaF' ? 43 : 21 }, (config && config.potions && config.potions[k]) || {});
      const on = $('ap-pc-on-' + k); if (on && on.checked !== !!v.enabled) on.checked = !!v.enabled;
      const vi = $('ap-pc-v-' + k); if (vi && String(vi.value) !== String(v.value)) vi.value = v.value;
      const mo = $('ap-pc-m-' + k); if (mo && mo.value !== v.mode) mo.value = v.mode;
      const tx = $('ap-pc-t-' + k);
      if (tx) {
        const val = Number(v.value) || 0;
        const perdido = v.mode === 'pct' ? (val / 100) * maxVida : val;
        const gatilho = Math.max(0, maxVida - perdido);
        const hp = hpAgora();
        const agora = hp && hp.cur <= gatilho ? ' · <b>AGORA!</b>' : '';
        tx.innerHTML = 'usa quando você perder <b>' + fmt(perdido) + ' de vida</b> (' + (v.mode === 'pct' ? val + '%' : 'valor fixo') + '), com vida abaixo de <b>' + fmt(gatilho) + '</b>' + agora;
      }
    }
    const minP2 = cfg().minPotion || { vida: 200, vidaF: 100, vidaS: 30 };
    for (const k of ORDER) { const e = $('ap-min-' + k); if (e && String(e.value) !== String(minP2[k])) e.value = minP2[k]; }
  }
  let autoConstruido = false;
  function renderAuto() {
    const a = estadoAgora();
    const c = cfg();
    // Se a lista de regiões ficou vazia (a automação ainda não tinha lido o catálogo), refaz quando chegar.
    if (autoConstruido) {
      const sel0 = $('ap-reg-id');
      if (sel0 && !sel0.options.length) {
        const r0 = ler('rankRegioes', []);
        if (r0 && r0.length) { autoConstruido = false; _ultimoHtml.clear(); }
      }
    }
    if (!autoConstruido) {
      autoConstruido = true;
      // O antigo cartão "O switch mestre" saiu: o interruptor mestre é UM só e vive no cartão
      // AUTO-PLAY (topo do Painel, `renderPainelEstado`) - aqui seria um segundo bloco a
      // explicar o mesmo controlo.

      const regioes = (ler('rankRegioes', []) || []).slice(0, 40);
      // O OBJETIVO DO FARM vive na aba GANHOS (junto do que ele decide): antes estava no
      // Painel e a aba de ganhos não tinha como escolher (queixa do dono, 2026-10-20).
      setHtml('ap-auto-regiao', card('Onde farmar', 'automático ou escolhido por você',
        linha('Região', 'automático = a automação escolhe a melhor para o seu nível',
          '<select id="ap-reg-modo"><option value="auto">Automática (recomendada)</option><option value="fixa">Fixa (escolho eu)</option></select>')
        + linha('Região fixa', 'escolher uma região aqui passa a região para FIXA (o automático desliga e você vê isso no aviso abaixo)',
          '<select id="ap-reg-id">' + regioes.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.nome) + ', ' + fmt(r.xpMin) + ' xp/min · ' + fmt(r.goldMin) + ' ouro/min</option>').join('') + '</select>')
        + diag('Forçar viagem (manutenção manual)',
          '<div class="acoes">' + acaoD('ap-ir-agora', '🧭 Ir agora para a região escolhida', 'Viaja já para a região selecionada. A automação viaja sozinho quando está ligado e a região é a melhor para o seu nível.') + '</div>')
        + '<div id="ap-reg-info"></div>'));

      // A lista de switches vive DENTRO do cartão AUTO-PLAY (uma só, `renderArvore`). Não há
      // segundo cartão "Automatismos da automação": era a mesma lista duas vezes.

      // POÇÃO: tudo o que é poção vive na ABA POÇÃO. O Painel não repete estes controlos
      // (eram um cartão duplicado, queixa do dono em 2026-10-20).

      // TODAS as ações manuais (o que você pode fazer no jogo com um clique) ficam AQUI, no
      // fim do Painel, tracejadas e rotuladas como manutenção manual. O que aparece em cima é o
      // que acontece sozinho: estado, switches, o que a automação vai fazer e o que está bloqueado.
      setHtml('ap-auto-acoes', card('Manutenção manual, forçar e medir', 'a automação faz isto sozinho quando o switch está ligado; use só para forçar ou medir',
        diag('Forçar agora (o automático deveria estar fazendo)',
          '<div class="acoes">'
          + acaoD('ap-farm-go', '▶ Ir agora para a melhor região', 'Liga o auto-play e viaja agora. A automação escolhe e viaja sozinho com o switch Tudo (auto-play) ligado.')
          + acaoD('ap-base-go', '🏠 Rodar a rotina de base agora', 'Na Fonte: cura, vende, repõe poções, tarefas, cofre, mercado e atributos, só o que é preciso.')
          + acaoD('ap-curar', '❤ Curar (Soraka)', 'Fala com a Soraka e cura o personagem a 100%.')
          + acaoD('ap-repor', '🧪 Repor poções', 'Compra poções no Lojista até o mínimo que você escolheu (mais caras primeiro).')
          + acaoD('ap-vender', '💰 Vender o que não presta', 'Vende ao Lojista só o que o plano da mochila diz que é lixo. Os protegidos nunca são tocados.')
          + acaoD('ap-cofre-guardar', '📦 Guardar no cofre', 'Guarda no cofre os épicos tier S/SS que não devem ficar na mochila.')
          + acaoD('ap-anunciar', '🏪 Anunciar lendários no mercado', 'Põe à venda os lendários abaixo de tier A, a ~90% do preço mais baixo. Nunca anuncia Rabadon nem tier A+.')
          + acaoD('ap-comprar', '🛒 Comprar item ideal no mercado', 'Compra o item da sua build ideal que falta, pelo menor preço, sem zerar o ouro.')
          + acaoD('ap-refinar', '⚒ Refinar lendários A+', 'Gasta ouro a refinar os seus lendários A+ no Ornn até +3.')
          + acaoD('ap-montar', '🔨 Montar no Ornn', 'Tenta montar o item mais barato que a sua build precisa. É uma APOSTA (≈1,2% por tentativa).')
          + acaoD('ap-tarefa', '📜 Aceitar a melhor tarefa', 'Fala com o Capitão e aceita a tarefa mais vantajosa que você consegue fazer.')
          + acaoD('ap-entregar', '✅ Entregar tarefa pronta', 'Se a tarefa está completa, entrega e recebe a recompensa.')
          + acaoD('ap-diaria', '🗓 Missões diárias', 'Recebe as diárias prontas e aceita as disponíveis de hoje.')
          + acaoD('ap-pular-tutorial', '⏭ Pular tutorial', 'Se o botão "Pular tutorial" estiver na tela, clica nele.')
          + acaoD('ap-presentes', '🎁 Pegar presentes e prêmio diário', 'Pega o "Pegar e equipar" e o prêmio de login, se estiverem disponíveis.')
          + '</div>'
          + '<p class="hint" id="ap-base-nota"></p>')
        + diag('Medir e calibrar (não clica no jogo por si só)',
          '<div class="acoes">'
          + acaoD('ap-cal', '🎯 Calibrar previsões', 'Compara o que a automação previu com o que mediu e corrige o erro (deixa as previsões mais certas).')
          + acaoD('ap-giro', '🔄 Medir várias regiões', 'Viaja por todas as regiões durante alguns minutos cada, para medir ganhos reais.')
          + acaoD('ap-testes', '🧪 Medir conjuntos de itens', 'Monta conjuntos e a automação roda cada um medindo ouro, xp e dano reais.')
          + acaoD('ap-scan-painel', '🎒 Forçar leitura da mochila', 'Lê a mochila no jogo (a aba Itens usa esta leitura).')
          + acaoD('ap-export', '💾 Exportar dados medidos', 'Baixa um arquivo JSON com tudo o que a automação aprendeu (backup ou análise).')
          + acaoD('ap-reload', '🔃 Recarregar a extensão', 'Recarrega os scripts da extensão (útil depois de uma atualização).')
          + '</div>')));

      // ESTADO, não ação: quem decide é o switch. Os botões para forçar cada passo vivem no
      // cartão de manutenção manual, no fim do Painel - a GUI é para o que é automático.
      // O cartão "Ações de base, quem decide" era um parágrafo a dizer "não há nada para clicar
      // aqui" (queixa do dono, 2026-10-23: o popup do switch tem de ser a página de configuração,
      // não uma info). Substituído pelos cartões reais: ap-cfg-base/repor/anunciar/comprar.
      setHtml('ap-auto-base', '');

      setHtml('ap-auto-tarefa', card('Equipar a melhor peça de cada slot', 'a missão do Capitão, na Fonte',
        '<div id="ap-tarefa-estado"></div>'
        + '<p class="hint tira">Aceitar a missão, cumpri-la e entregá-la é feito sozinho na rotina de base. A missão pede equipar a melhor peça em cada slot: quem equipa é o switch <b>Equipar a melhor peça de cada slot</b>, na rotina de base.</p>'));

    }
    // A ÁRVORE DE INTERRUPTORES redesenha SEMPRE (o estado dela muda com a config, com o campeão
    // e com o local) - não faz parte do bloco "constrói uma vez" acima.
    renderArvore();
    // ---- ALVOS DO AUTO-PLAY: em que campeões a automação pode jogar (pedido do dono, 2026-10-18) --
    // A LISTA de campeões do jogo é a mesma que a automação lê do KITS (nunca escrita à mão - REGRA
    // N.º 3); a automação ainda não a pode ter quando este render corre, e por isso este cartão
    // redesenha SEMPRE (fora do "constrói uma vez"). Sem alvos (null/vazio) = qualquer campeão.
    {
      // TK-01: o auto-play NÃO tem mais lista de campeões. A excepção `champAlvo` foi removida
      // da automação; manter aqui "katarina alvo: yasuo, ryze" era uma mentira visual (o dono
      // reportou exactamente isso). Este cartão passa a ser só informação do campeão actual.
      const ident = identidade() || {};
      const nomeAtual = ident.nome || capNome(ident.id) || '-';
      setHtml('ap-auto-champ', card('Campeão actual', 'o auto-play corre em qualquer campeão',
        '<p class="aviso ' + (ident.id ? 'ok' : 'warn') + '">Campeão actual: <b>' + esc(nomeAtual) + '</b>'
        + (ident.id ? '' : ', a automação ainda não identificou o campeão (F5 se demorar).') + '</p>'
        + '<p class="hint tira">Não há lista de alvos: a automação joga com o campeão que estiver na conta. '
        + 'Trocar de campeão não exige mudar nenhum switch. Isto <b>não</b> liga o auto-play, quem liga é o switch mestre.</p>'));
    }
    // valores dinâmicos
    const obj = $('ap-obj'); if (obj && obj.value !== (c.objetivo || 'ouro+xp')) obj.value = c.objetivo || 'ouro+xp';
    const automatica = !c.regionDefault;
    const modo = $('ap-reg-modo');
    if (modo) { const v = automatica ? 'auto' : 'fixa'; if (modo.value !== v) modo.value = v; }
    // DROPDOWN DA REGIÃO: em modo AUTOMÁTICO o select MOSTRA a região recomendada
    // (`estado().regiaoRecomendada`, com `regiaoIdeal` como recurso) e fica marcado como
    // "automática" - nunca parece que manda, mas mostra o que a automação está a usar. Escolher uma
    // região aqui passa a FIXA (handler `ap-reg-id`); voltar a "auto" limpa `regionDefault`.
    const rid = $('ap-reg-id');
    const idIdeal = ler('regiaoIdeal', null);
    const regRec = regiaoRecomendada();
    const autoId = regRec || idIdeal || null;
    if (rid) {
      const alvo = c.regionDefault || autoId;
      if (alvo && rid.value !== alvo && qa('#ap-reg-id option').some((o) => o.value === alvo)) rid.value = alvo;
      rid.classList.toggle('auto', automatica);
      rid.classList.remove('ignorada');
      rid.title = automatica
        ? 'AUTOMÁTICA: mostra a região recomendada. Escolher uma aqui passa a região para FIXA.'
        : 'FIXA: a automação fica nesta região até você voltar para "Automática".';
    }
    const setChk = (id, v) => { const e = $(id); if (e && e.checked !== !!v) e.checked = !!v; };
    setChk('ap-cfg-autoEquip', c.autoEquip); setChk('ap-cfg-trocaItens', c.trocaItens);
    setChk('ap-cfg-autoAtrib', c.autoAtrib); setChk('ap-cfg-autoRefino', c.autoRefino);
    setChk('ap-cfg-barraDisp', c.barraPorDisponibilidade !== false);
    // o que falta fazer na base (checklist viva) - vive na aba MANUAL (é descartável)
    const fb3 = faltasBase();
    if (fb3) {
      // UM SWITCH DESLIGADO NÃO É "FEITO". Era a queixa do dono: ele desligava coisas e a lista
      // aparecia com ✔ como se estivessem concluídas. Aqui cada necessidade sabe se o switch dela
      // está desligado e diz isso, em vez de mentir um ✔.
      const arv = ler('arvoreInterruptores', []) || [];
      const porNome = new Map(arv.map((x) => [x.nome, x]));
      const chaves = Object.keys(fb3.n).filter((k) => NECESSIDADE_NOME[k]);
      const chip = (k) => {
        const sw = porNome.get(k);
        const desligado = sw && sw.cfg != null && sw.pode === false && cfg()[sw.cfg] === false;
        if (desligado) return '<span class="chip" style="border-color:#3a3f4a;color:#8b93a3">· ' + esc(NECESSIDADE_NOME[k]) + ' (desligado)</span>';
        if (fb3.n[k]) return '<span class="chip" style="border-color:#7a5f2a">⏳ ' + esc(NECESSIDADE_NOME[k]) + '</span>';
        return '<span class="chip" style="border-color:#2b5c33">✔ ' + esc(NECESSIDADE_NOME[k]) + '</span>';
      };
      const pend = chaves.filter((k) => fb3.n[k]);
      setHtml('ap-auto-falta', card('O que falta fazer na base', 'só o que a automação vai fazer',
        '<div class="chips">' + chaves.map(chip).join('') + '</div>'
        + '<p class="hint">' + (pend.length
          ? 'Pendente agora: <b>' + esc(pend.map((k) => NECESSIDADE_NOME[k] || k).join(' · ')) + '</b>.'
          : 'Nada pendente: a base está completa.') + '</p>'
        + (naBase() ? '' : '<p class="hint">Você não está na Fonte, esta lista só se executa lá.</p>')));
    } else {
      setHtml('ap-auto-falta', card('O que falta fazer na base', 'lista da automação, só o que é preciso',
        '<p class="vazio">Ainda sem a lista da base.</p>'
        + '<p class="hint tira">A automação preenche isto quando lê o estado do jogo.</p>'));
    }
    // auto-poção: valores actuais (sem reconstruir o cartão, para não perder o foco)
    sincronizarPocao();
    const rec = recomendacao();
    // REGIÃO EM USO, dita por palavras. Nunca fica ambíguo: ou é automática (com o nome que o
    // motor escolheu), ou é fixa (com o nome que você escolheu).
    const emUso = c.regionDefault
      ? 'FIXA (você escolheu: <b>' + esc(nomeRegiao(c.regionDefault)) + '</b>)'
      : 'automática (a automação recomenda: <b>' + esc(regRec ? nomeRegiao(regRec) : (rec ? limparNivel(rec.regiao) : (idIdeal ? nomeRegiao(idIdeal) : '-'))) + '</b>)';
    const autoEscolha = regRec ? nomeRegiao(regRec) : (rec ? limparNivel(rec.regiao) : (idIdeal ? nomeRegiao(idIdeal) : null));
    setHtml('ap-reg-info', '<p class="aviso ' + (c.regionDefault ? 'warn' : 'ok') + '">Região em uso: ' + emUso + '.'
      + (c.regionDefault ? ' Enquanto estiver fixa, a automação <b>não</b> escolhe sozinho, mude para <b>Automática</b> para ele voltar a decidir.' : ' A automação muda de região sozinho quando compensa.') + '</p>'
      + '<p class="hint">No automático, a automação escolheria: <b>' + esc(autoEscolha || '-') + '</b>' + (rec ? ' · ' + fmt(rec.ouroLiquidoMin) + ' ouro limpo/min · ' + fmt(rec.xpMin) + ' xp/min' : '') + '.</p>'
      + (rec && rec.sobrevive === false ? '<p class="aviso warn">⚠ Nessa região o chefe mata você: no automático a automação ficaria só nos mobs.</p>' : '')
      + (rec && rec.sinalUlt ? '<p class="hint">⚠ mobs lentos: a ultimate passa a valer a pena.</p>' : ''));
    const nota = $('ap-base-nota');
    if (nota) nota.innerHTML = naBase() ? '✔ Você está na <b>Fonte</b>: todas as ações de base funcionam.'
      : '⚠ Você não está na Fonte (está em <b>' + esc(String((ler('readLocation', {}) || {}).text || '?')) + '</b>). As ações de base só funcionam lá. Quando você voltar, a automação faz a rotina sozinho (switch <b>Manutenção</b> ligado).';
    const te = $('ap-tarefa-estado');
    if (te) {
      const st = ler('tarefaEstado', {}) || {};
      te.innerHTML = st.tem
        ? '<p class="aviso ' + (st.pronta ? 'ok' : '') + '">Missão: ' + esc(st.texto || '-') + (st.pronta ? ', <b>PRONTA para entregar</b>' : '') + '</p>'
        // A frase antiga mandava o dono falar com o Capitão - e a automação é que tem de ir lá.
        // Com a necessidade `tarefa` sempre ligada (automation.js `necessidadesBase`), o estado
        // honesto é "a rotina de base vai buscar uma", não "não há nada".
        : '<p class="aviso warn">Sem missão agora: a rotina de base aceita uma na próxima ida à Fonte.</p>'
        + '<p class="hint tira">O switch <b>Manutenção</b> é quem manda nisto. Com ele desligado, ninguém vai ao Capitão.</p>';
    }
    // leitura do que trava
    const dg = diagBase();
    const meta = ler('getMeta', {}) || {};
    const travas = travaReal(dg);
    const esperas = esperaReal(dg);
  }

  // ------------------------------------- COFRE + MERCADO (leituras GRAVADAS pela automação)
  // REGRA DESTE BLOCO: o que está GUARDADO é sempre visível (é o que a automação já gravou em
  // chrome.storage: `salvarCofre`/`salvarOfertas`); ABRIR/RETIRAR são ações secundárias e
  // só ficam ativas quando o jogo as permite. Nunca se mostra o erro cru como se fosse bug.
  const QL = ['C', 'B', 'A', 'S', 'SS'];
  const qOrd = (q) => Math.max(0, QL.indexOf(String(q || 'C').toUpperCase()));
  const localTexto = () => String((ler('readLocation', {}) || {}).text || '');
  /** O cofre abre na Fonte (Tesoureira de Piltover) e nas cidades (Burrinho de Carga).
   *  Pergunta-se ao JOGO em vez de adivinhar pelo nome do sítio: se o NPC estiver no DOM, o
   *  motor consegue abri-lo (é a MESMA condição do `clickNPC` da automação). */
  function podeCofre() {
    try {
      if (q1('.cofre-slot[data-k]')) return true;                                 // já está aberto
      if (q1('#npcs button[data-npc*="Tesoureira"]') || q1('#npcs button[data-npc*="Burrinho"]')) return true;
    } catch (e) { /* sem DOM do jogo */ }
    return /fonte|cidade/i.test(localTexto());
  }
  /** Relê do storage uma chave que o MOTOR grava ({ at, ... }) e atualiza o espelho da GUI. */
  const lerGravado = (chave, set) => new Promise((resolve) => {
    try { chrome.storage.local.get(chave, (r) => { const v = (r && r[chave]) || null; set(v); resolve(v); }); }
    catch (e) { resolve(null); }
  });
  const lerCofreGravado = () => lerGravado(COFRE_KEY, (v) => { cofreStore = v; });
  const lerOfertasGravadas = () => lerGravado(OFERTAS_KEY, (v) => { ofertasStore = v; });
  /** Cofre ABERTO agora no jogo (verdade viva, lida pela automação) - vazio se estiver fechado. */
  const cofreAberto = () => cache('cofreLive', 3000, () =>
    (ler('lerCofreSlots', []) || []).filter((i) => i.acao === 'retirar' || i.acao === 'sacar')) || [];
  /** O que a automação tem em memória (slots abertos agora ou a última leitura que ele gravou). */
  const cofreItens = () => { const v = ler('cofreConhecido', null); return Array.isArray(v) ? v : []; };
  /** Última leitura GRAVADA pela automação: { at, itens } - o `at` diz QUANDO foi lido. */
  const cofreGravado = () => (cofreStore && Array.isArray(cofreStore.itens) ? cofreStore : { at: 0, itens: [] });
  /** O que se sabe que está guardado: cofre aberto -> memória da automação -> última gravação. */
  function cofreSabido() {
    const live = cofreAberto();
    if (live.length) return live;
    const c = cofreItens();
    if (c.length) return c;
    return cofreGravado().itens || [];
  }
  const porQualidade = (a, b) => (qOrd(b.qual) - qOrd(a.qual)) || ((b.refino || 0) - (a.refino || 0));
  /** Melhor instância conhecida (maior qualidade, depois maior refino) - regra da automação. */
  function melhorConhecido() {
    const l = cofreSabido().slice();
    if (!l.length) return null;
    l.sort(porQualidade);
    return l[0];
  }
  /** Slot do item. A automação ainda NÃO passa a chave do slot em `lerCofreSlots`, por isso cai-se
   *  na posição na grade; quando ele passar (`k`/`slot`) passa a aparecer sozinho. */
  const cofreSlot = (i, n) => String((i && (i.k || i.slot || i.slotId)) || ('#' + (n + 1)));
  const nomeCofre = (i) => (i && (i.nome || i.base)) || '?';
  const tagCofre = (i) => (i && i.qual ? '[' + i.qual + ']' : '') + (i && i.refino ? (i.qual ? ' +' : '+') + i.refino : '');
  /** Motivos do cofre traduzidos - a automação fala em seletores, a GUI fala em sítios. */
  function motivoCofre(m) {
    const t = String(m || '');
    if (/sem Tesoureira\/Burrinho|sem cofre aqui/i.test(t)) return 'o cofre só abre na Fonte ou na cidade (Tesoureira de Piltover / Burrinho de Carga). Você está em ' + (localTexto() || '?') + '.';
    if (/sem opcao cofre/i.test(t)) return 'o NPC respondeu, mas não apareceu a opção "cofre", tenta outra vez na Fonte ou na cidade.';
    if (/^sem .* no cofre$|slot nao achado/i.test(t)) return 'esse item já não está no cofre (a leitura pode estar desatualizada), use "Forçar leitura do cofre agora" (manutenção manual).';
    if (/sem slot guardar/i.test(t)) return 'não encontrei esse item no cofre para o guardar, abre o cofre na Fonte ou na cidade.';
    return t || 'não foi possível (a automação não disse porquê)';
  }
  /** Cartão do cofre: PRIMEIRO o que está guardado; as ações ficam em baixo e só quando dão. */
  function renderCofre() {
    const live = cofreAberto();
    const grav = cofreGravado();
    const itens = ordenarItens(cofreSabido());
    const abertoAgora = live.length > 0;
    const at = abertoAgora ? 0 : (Number(grav.at) || 0);
    const pode = podeCofre();
    const local = localTexto() || '?';
    const melhor = melhorConhecido();
    // O HTML tem de ser ESTÁVEL (nada de horas lá dentro): se mudasse a cada segundo, o
    // setHtml reconstruía o cartão e apagava a escolha feita no "item a retirar". A hora vai
    // para o <span> do cabeçalho e é escrita depois, com textContent.
    const lista = itens.length
      ? tabela(['item', 'qualidade', 'refino', 'quantidade'], itens.map((i, n) => '<tr><td>'
        + (i.base ? itemImgTag(i.base, i.refino, nomeCofre(i)) : '') + esc(nomeCofre(i))
        + '</td><td>' + esc(i.qual || 'C') + '</td><td>' + (i.refino ? '+' + esc(i.refino) : '-') + '</td><td>' + (i.qtd == null ? '-' : '×' + fmt(i.qtd)) + '</td></tr>').join(''))
      : '<p class="vazio">Ainda não há leitura do cofre, não sei o que está guardado.</p>'
        + '<p class="hint tira">A automação lê o cofre sozinho quando passa pela Fonte e <b>grava</b> o que lá está. A partir daí esta lista aparece aqui sempre que você quiser, onde você estiver.</p>';
    const corpo = lista
      // POLÍTICA DO COFRE (ordem do dono, 2026-10-22), numa linha e escondida pelo modo "texto
      // curto" (`.hint.tira`): quem quiser o detalhe vê, quem não quiser não tem mais um bloco.
      + '<p class="hint tira">Mochila perto de encher: lendário <b>A</b> vai para o cofre. Cofre cheio: os <b>C/B</b> saem para dar lugar a um A (troca na mesma passagem).</p>'
      + (pode ? '' : '<p class="hint">O cofre só abre na Fonte ou na cidade (Tesoureira de Piltover / Burrinho de Carga), você está em <b>' + esc(local) + '</b>. A lista acima é a última leitura gravada.</p>')
      + diag('Cofre: forçar leitura e ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-cofre-ler', '👀 Forçar leitura do cofre agora',
        pode ? 'Fala com a Tesoureira (Fonte) ou o Burrinho (cidade), lê o que está guardado e <b>grava</b>, esta lista passa a ser a verdade.'
          : 'Só funciona na Fonte ou na cidade. Você está em <b>' + esc(local) + '</b>.', !pode)
      + acaoD('ap-cofre-melhor', '⬆ Retirar o melhor item',
        melhor ? 'Tira <b>' + esc(nomeCofre(melhor)) + '</b> ' + esc(tagCofre(melhor)) + ', maior qualidade e, depois, maior refino. Abre o cofre sozinho se for preciso.'
          : 'Ainda não há leitura do cofre: use "Forçar leitura do cofre agora" (manutenção manual) para a automação saber o que lá está.', !pode || !melhor)
      + acaoD('ap-cofre-lixo', '🧹 Vender o lixo do cofre',
        'Percorre o cofre, retira só o que a regra da automação marca como lixo (épico/básico abaixo de S, sem ser peça da build, componente, reservado ou especial) e vende ao Lojista. É a mesma rotina que o auto-play corre a cada 10 min; aqui é sob demanda.', !pode)
      + '</div>'
      + (itens.length
        ? linha('Retirar um item específico', 'a lista é o que a automação sabe que está guardado no cofre',
          '<select id="ap-cofre-alvo">' + itens.map((i) => '<option value="' + esc(i.base || '') + '">' + esc(nomeCofre(i)) + ' ' + esc(tagCofre(i)) + '</option>').join('') + '</select>'
          + '<button id="ap-cofre-tirar" class="btn sec"' + (pode ? '' : ' disabled') + '>⬆ Retirar<small class="tagd">manual</small></button>')
        : '');
    setHtml('ap-it-cofre', card('Cofre, o que está guardado', '<span id="ap-cofre-quando">, </span>', corpo));
    const q = $('ap-cofre-quando');
    if (q) q.textContent = abertoAgora ? 'cofre aberto agora, leitura viva do jogo'
      : (at ? 'lido há ' + fmtDur(Date.now() - at) + ' · às ' + hora(at) + (itens.length ? ' · ' + itens.length + ' item(ns)' : '')
        : (itens.length ? itens.length + ' item(ns) guardados' : 'sem leitura gravada'));
  }

  // ---------------------------------------------------------------- ABA ITENS
  let bagLida = null, bagLidaEm = 0, bagAuto = false;   // bagAuto: leitura passiva (sem clique)
  const protegidos = () => cache('proteg', 30000, () => {
    const mapa = new Map();
    mapa.set(RABADON, 'Rabadon, nunca é vendido nem anunciado, nem duplicado');
    const m = MOTOR();
    // PRIORIDADE EXTREMA: a tabela é do MOTOR (automation.js:47, exposta em window.__lolidleAuto
    // junto do resto) - nada desta lista foi escrito à mão. O critério é o item ser multiplicador
    // de classe e vale em QUALQUER campeão: 3031 dá +40% no dano do acerto crítico e 3089 dá
    // +35% em todo o Poder de Habilidade (motor vivo, confirmado por conteúdo). O duplicado
    // também fica protegido: a decisão sobre ele é do jogador.
    const prio = (m && Array.isArray(m.PRIORIDADE_EXTREMA)) ? m.PRIORIDADE_EXTREMA : [];
    for (const p of prio) {
      if (!p || p.id == null) continue;
      const chave = String(p.id);
      if (mapa.has(chave)) continue;                    // o rótulo do Rabadon já está no mapa
      mapa.set(chave, (p.motivo || 'multiplicador de classe')
        + (p.classe ? ' · protege em qualquer campeão (item de ' + String(p.classe).toUpperCase() + ')' : ''));
    }
    const lc = ler('lendariosDaClasse', null);
    if (lc && typeof lc.forEach === 'function') lc.forEach((b) => mapa.set(String(b), 'lendário da build do seu campeão'));
    for (const e of (ler('readEquip', []) || [])) {
      const q = String(e.qual || '').toUpperCase();
      if (q === 'S' || q === 'SS') mapa.set(String(e.base), 'está equipado e é qualidade ' + q + ' (tier alto)');
    }
    // TRATAMENTO ESPECIAL da minha classe e PEÇAS RESERVADAS das duas builds (mobs/chefe): a
    // lista e a decisão de quais contam para ESTE campeão vem da automação (ehEspecialMeu,
    // basesReservadas, fasesDoItem) - a GUI só desenha.
    const esp = (m && Array.isArray(m.ITENS_ESPECIAIS)) ? m.ITENS_ESPECIAIS : [];
    for (const e of esp) {
      if (!e || e.id == null) continue;
      const chaveE = String(e.id);
      if (mapa.has(chaveE)) continue;
      if (chamar('ehEspecialMeu', chaveE).v !== true) continue;      // a automação diz se é MEU
      mapa.set(chaveE, (e.motivo || 'item especial da sua classe') + ' · tratamento especial do seu campeão');
    }
    const res = chamar('basesReservadas');
    if (res.ok && res.v && typeof res.v.forEach === 'function') {
      res.v.forEach((b) => {
        const chaveR = String(b);
        if (mapa.has(chaveR)) return;
        const f = chamar('fasesDoItem', chaveR);
        const fases = (f.ok && Array.isArray(f.v) && f.v.length) ? f.v.join(' + ') : 'fase';
        mapa.set(chaveR, 'peça da build de ' + fases + ', fica reservada para a troca por fase');
      });
    }
    return mapa;
  });

  /** CARD da BUILD HUMANA (buildHumana da automação). Se a automação ainda não expõe a função, diz-se
   *  isso em vez de ficar vazio - e a lista técnica antiga continua visível em <details>. */
  function renderBuildHumana() {
    const el = $('ap-it-build'); if (!el) return;
    const bh = ler('buildHumana', null);
    const ideal = buildIdeal();
    const eq = ler('readEquip', []) || [];
    const ident = identidade() || {};
    const tecnica = '<details><summary>Ver a lista técnica (DPS por item e a build ideal crua)</summary>'
      + '<div class="kvs">' + kv('campeão', esc(ident.nome || '-')) + kv('classe', esc(String(ident.classe || '').toUpperCase() || '-')) + kv('perfil', esc(ident.perfil || '-')) + '</div>'
      + '<p class="hint">Equipado agora (' + eq.length + '):</p>'
      + '<div class="frames">' + ordenarItens(eq).map((e) => itemFrame(String(e.base), e.qual || '', e.refino || '', e.raridade || '', nomeItem(e.base))).join('') + '</div>'
      + '<p class="hint">Build ideal (' + ideal.length + '):</p>'
      + '<div class="frames">' + ordenarItens(ideal).map((b) => itemFrame(String(b), '', '', '', nomeItem(b))).join('') + '</div>'
      + '</details>';
    if (!bh || typeof bh !== 'object') {
      setHtml('ap-it-build', card('Sua build explicada', 'como a automação monta os itens para o seu campeão',
        '<p class="aviso warn">Esta versão da automação ainda não expõe a função <b>buildHumana</b>, não há explicação humana para mostrar.</p>'
        + tecnica));
      return;
    }
    const itens = ordenarItens(Array.isArray(bh.build) ? bh.build : []);
    const sets = (Array.isArray(bh.skills) ? bh.skills : []).slice();
    // Se o 1.º conjunto precisa de uma habilidade bloqueada, põe a melhor VIÁVEL à frente.
    if (sets.length && sets[0] && sets[0].viavel !== true) {
      const i = sets.findIndex((s) => s && s.viavel === true);
      if (i > 0) { const [v] = sets.splice(i, 1); sets.unshift(v); }
    }
    const chipsHab = (conjunto, tipos) => {
      const arr = Array.isArray(conjunto) ? conjunto : String(conjunto == null ? '' : conjunto).split(/[,;/]/).map((s) => String(s).trim()).filter(Boolean);
      const tp = Array.isArray(tipos) ? tipos : [];
      return arr.map((s, i) => '<span class="tag">' + esc(tp[i] || ['Q', 'W', 'E', 'R'][i] || '') + ' ' + esc(s) + '</span>').join(' ') || '<span class="vazio">, </span>';
    };
    const listaItens = itens.length ? '<div class="frames">' + itens.map((i) => {
      const nome = i.nome || nomeItem(i.base);
      const ref = i.refino ? '+' + i.refino : '';
      const titulo = nome + (i.qual ? ' [' + i.qual + ']' : '') + (i.refino ? ' refino +' + i.refino : '') + (i.espaco ? ' · ' + (ESPACO_NOME[i.espaco] || i.espaco) : '')
        + (i.dano != null ? ' · +' + fmt(i.dano) + ' dano/s no conjunto' : '') + (i.porque ? ', ' + i.porque : '');
      return '<span class="bf-item" title="' + esc(titulo) + '">' + itemImgTag(i.base, i.refino)
        + '<b class="q">' + esc(i.qual || '') + ref + '</b>'
        + '<small><span class="bf-nome">' + esc(nome) + '</span>' + (i.espaco ? ' · ' + esc(ESPACO_NOME[i.espaco] || i.espaco) : '')
        + (i.dano != null ? ' · +' + fmt(i.dano) + '/s' : '') + '</small></span>';
    }).join('') + '</div>' : '<p class="vazio">A automação ainda não calculou os itens da build.</p>';
    const hab = sets.length ? sets.map((s, i) => {
      const falt = (Array.isArray(s.faltando) ? s.faltando : []).filter(Boolean);
      return '<div class="ln ' + (s.viavel === true ? 'proteg' : 'loj') + '"><b>' + (i === 0 ? 'Melhor variação' : 'Alternativa ' + i) + '</b>'
        + '<span class="d">' + chipsHab(s.conjunto, s.tipos) + '</span>'
        + '<span class="d">' + esc(s.porque || '') + '</span>'
        + (falt.length ? '<span class="d">faltam: ' + esc(falt.join(', ')) + '</span>' : '')
        + '<span class="d">' + (s.viavel === true ? '✔ viável agora' : '✖ precisa de habilidade bloqueada') + '</span></div>';
    }).join('') : '<p class="vazio">A automação ainda não sugeriu variações de habilidades.</p>';
    setHtml('ap-it-build', card('Sua build explicada', 'por que cada item está aqui, na língua do jogo',
      '<div class="kvs">'
      + kv('campeão', esc(bh.campeao || ident.nome || '-'))
      + kv('classe', esc(String(bh.classe || ident.classe || '').toUpperCase() || '-'))
      + kv('nível', bh.nivel == null ? '-' : String(bh.nivel))
      + '</div>'
      + '<p class="hint"><b>Os itens desta build</b> (' + itens.length + '):</p>'
      + listaItens
      + (bh.aviso ? '<p class="aviso warn">' + esc(bh.aviso) + '</p>' : '')
      + '<details><summary>As 4 habilidades que mais rendem com esta build</summary><div class="lista">' + hab + '</div></details>'
      + tecnica));
  }

  function renderItens() {
    const eq = ler('readEquip', []) || [];
    const ideal = buildIdeal();
    const prot = protegidos();
    const eqBases = eq.map((e) => String(e.base));
    const faltam = ideal.filter((b) => eqBases.indexOf(String(b)) < 0);
    const linhaItens = (ids, extra) => '<div class="frames">' + ordenarItens(ids.map((b) => ({ base: b }))).map(({ base: b }) => {
      const e = eq.find((x) => String(x.base) === String(b));
      const pr = prot.has(String(b));
      return itemFrame(b, e ? e.qual : '', e ? e.refino : '', e ? e.raridade : (extra ? 'falta' : ''),
        nomeItem(b) + (pr ? ' 🔒 ' + prot.get(String(b)) : '') + (e ? '' : ' (falta)'));
    }).join('') + '</div>';
    renderBuildHumana();
    const ident = identidade() || {};
    setHtml('ap-it-proteg', card('Blindados, nunca são vendidos', 'o mesmo critério que a automação aplica',
      '<div class="chips" data-blindados="motor">' + Array.from(prot.entries()).sort((x, y) => ordemItemGui({ base: x[0] }, { base: y[0] })).map(([b, motivo]) =>
        '<span class="chip ' + (String(b) === RABADON ? 'lendario' : '') + '" title="' + esc(motivo) + '">' + (ITEM_IMG(b) ? '<img src="' + ITEM_IMG(b) + '" alt="">' : '') + esc(nomeItem(b)) + ' <small>🔒</small></span>').join('') + '</div>'
      + '<p class="hint tira">O que não se vende: itens de classe, especiais do campeão, lendários da build, peças da outra fase, o que está equipado em S ou SS e itens ainda em avaliação.</p>'));

    // mochila: a automação lê o `#mochila` DIRECTAMENTE (o jogo mantém-no atual, aberto ou não -
    // jogo.js:6621), logo tenta-se uma leitura passiva antes de pedir um clique ao usuário.
    if (!bagLida) lerMochila(false, true);
    if (!bagLida) {
      setHtml('ap-it-mochila', card('Mochila', 'ainda não legível nesta página',
        '<p class="vazio">A mochila ainda não está legível.</p>'
        + '<p class="hint tira">Se você ainda não abriu a bolsa desde que a página carregou, abra uma vez no jogo (tecla I). A partir daí a automação lê-a sozinho, sem voltando abrindo.</p>'
        + diag('Leitura da mochila (manutenção manual)')
      + '<div class="acoes">' + acaoD('ap-scan', '🎒 Forçar leitura da mochila', 'Lê o conteúdo da mochila, não abre nem fecha nada no jogo.') + '</div>'));
      setHtml('ap-it-plano', card('O que vai acontecer a cada item', 'plano da automação',
        '<p class="vazio">Ainda sem plano: a mochila ainda não foi lida.</p>'));
    } else {
      const b = bagLida;
      setHtml('ap-it-mochila', card('Mochila', bagAuto ? 'lida diretamente do jogo' : 'lida há ' + fmtDur(Date.now() - bagLidaEm),
        '<div class="kvs">' + kv('ocupação', fmt(b.used) + ' / ' + fmt(b.cap)) + kv('espólio', String(b.espacosEspolio)) + kv('ouro', fmt(ler('readGold', null))) + '</div>'
        // SÓ ITENS COM ÍCONE (ordem do dono, 2026-10-22): o espólio (`📦 ×N`) e qualquer item sem
        // imagem não são desenhados. Um cartão de texto no meio dos ícones era o "lixo visual".
        + '<div class="chips">' + (((b.items || []).filter((i) => i.kind !== 'espolio' && ITEM_IMG(i.base))
          .slice().sort(ordemItemGui)).map((i) =>
          '<span class="chip ' + esc(i.raridade || '') + '" title="' + esc(nomeItem(i.base) + ' · qualidade ' + i.qual + (i.refino ? ' · refino +' + i.refino : '')) + '">'
            + itemImgTag(i.base, i.refino, nomeItem(i.base)) + esc(nomeItem(i.base)) + ' <small>' + esc(i.qual || '') + (i.refino ? '+' + i.refino : '') + '</small></span>').join('') || '<span class="vazio">mochila vazia</span>')
        + '</div>'
        + diag('Leitura da mochila (manutenção manual)')
        + '<div class="acoes">' + acaoD('ap-scan', '🔄 Forçar leitura da mochila', 'Lê a mochila de novo. A automação lê sozinho quando a mochila muda.') + '</div>'));

      // A automação exige a mochila: `planBag(bag, marketCount, marketCap)` (automation.js:338).
      // Sem ela rebenta - e o erro é NOSSO (falta de argumento), não da automação.
      const rp = chamar('planBag', b);
      const plano = rp.ok ? rp.v : null;
      if (plano && plano.acts) {
        const grupos = {};
        for (const a2 of plano.acts) (grupos[a2.action] = grupos[a2.action] || []).push(a2);
        const ordem = ['PROTEGER', 'GUARDAR', 'GUARDAR_COFRE', 'ANUNCIAR_MERCADO', 'VENDER_LOJISTA'];
        const vendidos = (grupos.VENDER_LOJISTA || []).length;
        setHtml('ap-it-plano', card('O que vai acontecer a cada item', 'plano da automação, com o motivo',
          (vendidos ? '<p class="aviso warn">' + vendidos + ' item(ns) vão ser <b>vendidos ao lojista</b> na próxima rotina de base.</p>' : '<p class="aviso ok">Nada será vendido ao lojista.</p>')
          + ordem.map((act) => {
            const lista = grupos[act] || [];
            if (!lista.length) return '';
            const info = ACAO_ITEM[act] || { txt: act, cls: '' };
            return '<p class="hint"><b>' + esc(info.txt) + '</b> (' + lista.length + ')</p><div class="lista">' + lista.slice().sort((x, y) => ordemItemGui(x.it, y.it)).map((x) =>
              '<div class="ln ' + info.cls + '">' + itemImgTag(x.it.base, x.it.refino, nomeItem(x.it.base) + ' ' + (x.it.qual || '') + (x.it.refino ? ' +' + x.it.refino : '')) + '<b>' + esc(nomeItem(x.it.base)) + '</b> ' + esc(x.it.qual || '') + (x.it.refino ? '+' + x.it.refino : '')
              + '<span class="d">' + esc(x.why || '') + '</span></div>').join('') + '</div>';
          }).join('')
          + '<p class="hint tira">Os motivos são escritos pela automação; esta lista é o que a rotina de base vai executar.</p>'));
      } else {
        setHtml('ap-it-plano', card('O que vai acontecer a cada item', 'plano da automação',
          '<p class="aviso err">Não foi possível calcular o plano da mochila: '
          + esc(rp.ok ? 'a automação não devolveu um plano' : String(rp.erro)) + '.</p>'
          + '<p class="hint">A mochila FOI lida (' + fmt(b.used) + '/' + fmt(b.cap) + ' espaços usados); o plano é a automação que calcula a partir dela.</p>'));
      }
    }

    // contribuição de cada item
    const dps = ler('dpsItens', null, eqBases, idRegiaoDe((ler('readLocation', {}) || {}).text));
    if (dps) {
      const linhaD = (t, titulo) => t ? '<p class="hint">' + titulo + ': ' + t.porItem.map((x) => esc(x.nome) + ' <b>' + fmt(x.dps) + '</b>').join(' · ') + ' → total <b>' + fmt(t.total) + '</b>/s</p>' : '';
      setHtml('ap-it-dps', card('Quanto cada item dá de dano para você', 'estimativa da automação para esta região',
        (linhaD(dps.chefe, 'Contra o chefe') || '') + (linhaD(dps.mob, 'Contra mobs') || '')
        + '<p class="hint tira">Serve para ver se vale trocar uma peça: o número é o dano por segundo que aquele item acrescenta ao conjunto.</p>'));
    } else setHtml('ap-it-dps', card('Quanto cada item dá de dano para você', 'estimativa da automação para esta região',
      '<p class="vazio">Ainda sem estimativa de dano por item.</p>'
      + '<p class="hint tira">A automação calcula isto quando lê o equipamento e a região.</p>'));

    // O antigo cartão "Farmar itens específicos" MUDOU-SE para a aba Ganhos, onde passou a ser a
    // modalidade "Auto farm pra item" (renderFarmItens, seção 5). O div `ap-it-farmar` deixou de
    // existir no DOM - não há nada para desenhar aqui.
    // COFRE: primeiro o que está GUARDADO (última leitura que a automação gravou); abrir/retirar
    // ficam em baixo e só aparecem ativos quando o jogo os permite.
    renderCofre();
  }

  // ---------------------------------------------------------------- ABA HABILIDADES
  // ---------------------------------------------------------------- ABA PERSONAGEM
  /** Barra visual com o valor escrito por cima. Uma linha de código, muitos cartões usam. */
  const barraDe = (v, max, txt, cls) => {
    const p = max > 0 ? Math.max(0, Math.min(1, Number(v) / Number(max))) : 0;
    return '<span class="bar"><i class="' + (cls || '') + '" style="width:' + (p * 100).toFixed(1) + '%"></i><u>' + esc(txt) + '</u></span>';
  };
  function renderSkills() {
    const sk = ler('readSkills', null);
    const dps = ler('dpsPorHabilidade', null);
    if (!sk) {
      // GUI ESTÁVEL (queixa do dono, 2026-10-20): os cartões ficam TODOS com o mesmo cabeçalho
      // e uma linha de espera, em vez de desaparecerem e voltarem quando a leitura chega.
      const espera = '<p class="vazio">Ainda sem leitura das habilidades.</p>'
        + '<p class="hint tira">A automação lê isto do jogo; se demorar, recarrega a página (F5).</p>';
      setHtml('ap-sk-barra', card('Barra de combate', 'as habilidades que o jogo usa sozinho', espera));
      setHtml('ap-sk-pontos', card('Pontos para gastar', 'lido do HUD dourado do jogo', espera));
      setHtml('ap-sk-ideal', card('Barra ideal (recomendada)', 'as 4 habilidades que mais rendem agora', espera));
      setHtml('ap-sk-ordem', card('Ordem de subida', 'a mesma regra que a automação usa no botão de subir', espera));
      setHtml('ap-sk-dps', card('Dano de cada habilidade', 'estimativa da automação com os seus stats', espera));
      setHtml('ap-sk-acoes', card('Habilidades, o que a automação sobe sozinho', 'o switch "Subir habilidades" faz isto; os botões abaixo são manutenção manual', espera));
      return;
    }
    const barra = (sk.bar || []).map((h) => {
      const ult = ler('ehUltimate', false, h.t);
      // O NOME na barra do jogo vem com a DESCRIÇÃO toda colada. Mostra-se só o nome (antes do
      // travessão) e o texto inteiro fica no `title`.
      const cheio = String(h.nome || h.t || '');
      const curto = cheio.split(/\s+[-–-]\s+/)[0].slice(0, 34);
      return '<span class="chip" title="' + esc(cheio) + '">' + esc(curto) + ' <small>' + (h.ready ? 'pronto' : (h.cd != null ? h.cd + 's' : 'em recarga')) + (ult ? ' · ULTIMATE' : '') + '</small></span>';
    }).join('') || '<span class="vazio">nenhuma habilidade na barra</span>';
    setHtml('ap-sk-barra', card('Barra de combate', 'as habilidades que o jogo usa sozinho',
      '<div class="chips">' + barra + '</div>'
      + '<p class="hint tira">A ultimate só é usada contra chefes ou em áreas muito difíceis.</p>'));

    const pontos = sk.pontos || 0, pontosAtrib = sk.pontosAtrib || 0;
    setHtml('ap-sk-pontos', card('Pontos para gastar', 'lido do HUD dourado do jogo',
      '<div class="kvs">' + kv('habilidades', String(pontos)) + kv('atributos', String(pontosAtrib)) + '</div>'
      + '<p class="hint">' + (sk.hudTexto ? 'O jogo diz: "' + esc(sk.hudTexto) + '"' : 'O HUD não está mostrando pontos.') + '</p>'
      + '<p class="hint tira">Habilidades e atributos ficam na mesma aba, <b>Personagem</b>: aqui sobem-se as habilidades; os pontos de atributo estão logo abaixo.</p>'));

    // ordem de subida (a MESMA regra da automação: rank 0 primeiro, depois maior dano)
    const arsenal = (sk.arsenal || []).slice();
    const dpsDe = {};
    if (dps && dps.habs) for (const h of dps.habs) dpsDe[h.t] = h.dps || 0;
    arsenal.sort((x, y) => {
      const ux = (x.rank || 0) === 0 ? 0 : 1, uy = (y.rank || 0) === 0 ? 0 : 1;
      if (ux !== uy) return ux - uy;
      return (dpsDe[y.t] || 0) - (dpsDe[x.t] || 0);
    });
    // A recomendação respeita o REQUISITO DE NÍVEL: uma habilidade bloqueada pelo nível NÃO
    // pode ser o "próximo ponto".
    const nivelAtual = Number((ler('player') || {}).nivel || 0) || 0;
    const liberada = (h) => (Number(h.nivel) || 1) <= (nivelAtual || 999);
    const podeSubir = (h) => (h.rank || 0) < (h.maxRank || 0) && !h.max && liberada(h);
    const proximo = arsenal.find(podeSubir);
    // VISUAL, NÃO TABELA (queixa do dono, 2026-10-23: "muito texto e pouco visual"): cada
    // habilidade é uma linha com barra de RANK e o dano em número. A tabela de 6 colunas saiu.
    const linhasOrdem = arsenal.map((h) => {
      const r = Number(h.rank) || 0, max = Number(h.maxRank) || 4;
      const ult = ler('ehUltimate', false, h.t);
      const lib = liberada(h);
      const stt = h.max ? 'máximo' : (!lib ? 'nível ' + (h.nivel || '?') : (r === 0 ? 'abrir' : 'subir'));
      return '<div class="skrow' + (proximo && proximo.t === h.t ? ' prox' : '') + '">'
        + '<span class="nm" title="' + esc(h.name || h.t) + '">' + esc(h.name || h.t) + (ult ? ' 👑' : '') + (h.onBar ? ' ⚔' : '') + '</span>'
        + '<span>' + barraDe(r, max, r + '/' + max, h.max ? '' : (lib ? '' : 'low')) + '</span>'
        + '<span class="vl">' + (dpsDe[h.t] ? fmt(dpsDe[h.t]) + '/s' : '-') + '</span>'
        + '<span class="vl">' + stt + '</span></div>';
    }).join('');
    setHtml('ap-sk-ordem', card('Ordem de subida', 'a mesma regra que a automação usa no botão de subir',
      '<div>' + (linhasOrdem || '<p class="vazio">sem habilidades lidas</p>') + '</div>'
      + (proximo ? '<p class="aviso ok">Próximo ponto: <b>' + esc(proximo.name || proximo.t) + '</b>' + ((proximo.rank || 0) === 0 ? ' (desbloquear)' : ' (mais dano)') + '</p>'
        : '<p class="aviso">Nada para subir agora.</p>')
      + '<p class="hint tira">⚔ = está na barra de combate · 👑 = ultimate.</p>'));

    const habsDps = (dps ? (dps.habs || []) : []).filter((h) => h.dano || h.passiva).slice(0, 12);
    const maxDps = Math.max(1, ...habsDps.map((h) => Number(h.dps) || 0));
    setHtml('ap-sk-dps', card('Dano de cada habilidade', 'estimativa da automação com os seus stats',
      dps ? '<div class="kvs">' + kv('AP', fmt(dps.ap)) + kv('AD', fmt(dps.ad)) + kv('nível', String(dps.nivel)) + '</div>'
        + '<div>' + habsDps.map((h) => '<div class="skrow">'
          + '<span class="nm" title="' + esc(h.nome || h.t) + '">' + esc(h.nome || h.t) + (h.naBarra ? ' ⚔' : '') + (h.adaga ? ' 🗡' : '') + '</span>'
          + '<span>' + barraDe(h.dps || 0, maxDps, (h.dps != null ? fmt(h.dps) : '-') + '/s') + '</span>'
          + '<span class="vl">r' + (h.rank == null ? '-' : h.rank) + '</span>'
          + '<span class="vl">' + (h.cd != null ? h.cd + 's' : '-') + '</span></div>').join('') + '</div>'
        + '<p class="hint tira">⚔ = na barra · 🗡 = deixa adaga (Voracidade).</p>'
        : '<p class="aviso err">A automação não conseguiu calcular o dano das habilidades.</p>'));

    // A fase vem do farm para a GUI mostrar o MESMO ideal do runtime; `preview` impede
    // que este render mexa no anti-churn da barra (bug da aba aberta, 2026-10-20).
    const faseGui = (((farm() || {}).current || {}).fase === 'boss') ? 'chefe' : 'mobs';
    const idealBarra = ler('barraIdeal', null, null, faseGui, null, { preview: true });
    if (idealBarra && idealBarra.length) {
      const naBarra = (sk.bar || []).map((h) => h.t);
      const igual = idealBarra.length === naBarra.length && idealBarra.every((t) => naBarra.indexOf(t) >= 0);
      const nomeDe = (t) => { const h = (sk.arsenal || []).find((x) => x.t === t); return (h && (h.name || h.t)) || t; };
      setHtml('ap-sk-ideal', card('Barra ideal (recomendada)', 'as 4 habilidades que mais rendem agora',
        '<div class="chips">' + idealBarra.map((t) => '<span class="tag">' + esc(nomeDe(t)) + (ler('ehUltimate', false, t) ? ' 👑' : '') + '</span>').join('') + '</div>'
        // A lista é ESTÁVEL (o preview não ordena por recarga). Se o switch de disponibilidade
        // estiver ligado, a barra em jogo roda de propósito e isso NÃO é erro.
        + '<p class="aviso ' + (igual ? 'ok' : '') + '">' + (igual
          ? 'A sua barra já está igual à ideal.'
          : (cfg().barraPorDisponibilidade !== false
            ? 'Em jogo a barra troca pelas habilidades prontas; esta é a que mais rende.'
            : 'A sua barra está diferente da ideal: o switch "Repor a rotação na barra" corrige isto sozinho.')) + '</p>'
        + tg('ap-cfg-barraDisp', 'Barra pelas habilidades prontas', 'Põe na barra as habilidades disponíveis e as que ficam prontas mais cedo. Desligado, a barra fica presa às 4 de maior dano.', cfg().barraPorDisponibilidade !== false)));
    } else setHtml('ap-sk-ideal', card('Barra ideal (recomendada)', 'as 4 habilidades que mais rendem agora',
      '<p class="vazio">Ainda sem a barra ideal: a automação está a ler o arsenal.</p>'));
    setHtml('ap-sk-acoes', card('Habilidades, o que a automação sobe sozinho', 'o switch "Subir habilidades" faz isto; os botões abaixo são manutenção manual',
      diag('Habilidades: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-subir-habs', '⬆ Subir habilidades (' + fmt(pontos) + ' ponto(s))', 'Gasta todos os pontos livres: primeiro desbloqueia, depois sobe a que dá mais dano.', pontos ? '' : 'sec')
      + acaoD('ap-rotacao', '🔁 Repor a rotação na barra', 'Põe na barra as 4 habilidades prontas que dão mais dano (mantém sempre as melhores disponíveis).')
      + acaoD('ap-trocar-skills', '🔄 Trocar só as que estão em recarga', 'Substitui as habilidades em recarga por outras já desbloqueadas e prontas.')
      + '</div>'
      + '<p class="hint tira">A ultimate nunca é trocada para fora da barra pela automação.</p>'));
  }

  // ---------------------------------------------------------------- ABA ATRIBUTOS
  function lerAtributos() {
    const out = [];
    try {
      const nos = qa('#atributos .atrib');
      for (const n of nos) {
        const nome = (n.querySelector('.atrib-nome') || {}).textContent || '';
        const b = n.querySelector('[data-valor]');
        const t = n.querySelector('[data-total]');
        const btn = n.querySelector('[data-atrib]');
        out.push({
          nome: String(nome).trim(),
          valor: b ? num(b.textContent) : null,
          total: t ? num(t.textContent) : null,
          chave: btn ? btn.dataset.atrib : null,
          pode: btn ? !btn.disabled : false,
        });
      }
    } catch (e) { /* painel fechado */ }
    return out;
  }
  function renderAtrib() {
    const sk = ler('readSkills', null) || {};
    const atrs = lerAtributos();
    const meta = ler('getMeta', {}) || {};
    const cfgv = cfg();
    setHtml('ap-at-pontos', card('Pontos livres', 'ganhas 3 por nível',
      '<div class="kvs">' + kv('pontos por gastar', String(sk.pontosAtrib || 0)) + '</div>'
      + '<p class="hint">' + (sk.hudTexto ? 'O jogo diz: "' + esc(sk.hudTexto) + '"' : 'O HUD não está mostrando pontos de atributo.') + '</p>'
      + '<p class="hint tira">Se a lista ao lado estiver vazia, abra a aba <b>Atributos</b> no jogo uma vez para o painel existir na página.</p>'));

    setHtml('ap-at-lista', card('Distribuição atual', 'lida do painel do jogo',
      atrs.length
        ? (() => {
          const maxA = Math.max(1, ...atrs.map((a) => Number(a.valor) || 0));
          return '<div>' + atrs.map((a) => '<div class="atrow">'
            + '<span class="nm">' + esc(a.nome) + '</span>'
            + '<span class="vl">' + (a.valor == null ? '-' : a.valor) + '</span>'
            + '<span>' + barraDe(a.valor || 0, maxA, a.total != null ? 'total ' + a.total : '') + '</span></div>').join('') + '</div>'
            + '<p class="hint tira">A barra é a proporção dos pontos; o número por cima é o total com equipamento.</p>';
        })()
        : '<p class="vazio">O painel de atributos do jogo ainda não está na página. Abra a aba "Atributos" no jogo e volte aqui.</p>'));

    const modelos = meta.modelos || null;
    // `DICA_ATRIBUTOS` do jogo é um MAPA campeão -> frase (inject.js:464), não uma frase. Sem
    // isto a GUI mostrava "[object Object]" (visto ao vivo 2026-10-21).
    const dicaMapa = meta.dicaAtributos || null;
    const nomeCh = String((identidade() || {}).nome || '').toLowerCase();
    const dica = !dicaMapa ? null
      : (typeof dicaMapa === 'string' ? dicaMapa
        : (dicaMapa[nomeCh] || dicaMapa[Object.keys(dicaMapa).find((k) => nomeCh.includes(String(k).toLowerCase()))] || null));
    const blocoModelo = '<p class="hint">' + (modelos ? 'Modelo do jogo: ' + Object.keys(modelos).map((k) => '<b>' + esc(modelos[k].nome || k) + '</b>').join(' · ') : 'Modelo equilibrado.') + '</p>';

    const st = ler('readStats', {}) || {};
    setHtml('ap-at-stats', card('Stats de combate', 'lidos da ficha do jogo',
      '<div class="kvs">'
      + Object.keys(st).map((k) => kv(k, fmt1(st[k]))).join('')
      + '</div>'));

    setHtml('ap-at-acoes', card('Distribuir pontos', 'o switch "Distribuir pontos" faz isto sozinho',
      linha('Modelo', 'só é usado quando distribuis',
        '<select id="ap-at-modelo-sel">' + (modelos
          ? Object.keys(modelos).map((k) => '<option value="' + esc(k) + '">' + esc(modelos[k].nome || k) + '</option>').join('')
          : '<option value="equilibrado">Equilibrado</option>') + '</select>')
      + '<p class="hint" id="ap-at-sugestao"></p>'
      + (dica ? '<p class="aviso">Sugestão: ' + esc(dica) + '</p>' : '')
      + blocoModelo
      + '<div class="acoes">'
      + acaoD('ap-distribuir', '➕ Distribuir ' + fmt(sk.pontosAtrib || 0) + ' ponto(s)', 'Gasta todos os pontos livres pelo modelo escolhido. Não há como desfazer.', (sk.pontosAtrib || 0) > 0 ? '' : 'sec')
      + '</div>'));
    const sel = $('ap-at-modelo-sel');
    const sugerido = ler('modeloAtribDe', null);
    if (sel) {
      const v = cfgv.modeloAtrib || sugerido || 'equilibrado';
      if (sel.value !== v) sel.value = v;
    }
    const nota = $('ap-at-sugestao');
    if (nota) nota.innerHTML = sugerido
      ? 'Modelo sugerido pela automação para este campeão: <b>' + esc(sugerido) + '</b>' + (cfgv.modeloAtrib && cfgv.modeloAtrib !== sugerido ? ' (você escolheu <b>' + esc(cfgv.modeloAtrib) + '</b>)' : '') + '.'
      : '';
  }

  // ---------------------------------------------------------------- ABA FARM
  // POR ABATE x POR MINUTO (regra da automação):
  //   bossFase: { durMs: 35616, gold: 1526, xp: 3654, kills: 1, perMin: { gold: 2570.75, xp: 6155.66 } }
  //   O `bossFase` mede UM chefe (kills: 1) e o `perMin` é `loot / (durMs/60)` - uma TAXA sobre a
  //   janela. O xp/min sobe quando o chefe morre mais rápido (artefato de denominador: o xp do
  //   chefe é ~fixo) e o ouro/min não acompanha porque o LOOT VARIA (1526 / 1615 / 1149 nos três
  //   chefes medidos, ~40%). Comparar chefes por `perMin` premia quem morre rápido.
  //   A automação já tem o dado certo na mesma estrutura: `perKill = { gold: gold/kills, xp: xp/kills }`
  //   (automation.js:646, só quando kills > 0). A GUI mostra `perKill` para o CHEFE e mantém
  //   `perMin` para os MOBS (aí são muitos abates numa janela longa e a taxa faz sentido).
  /** Loot POR ABATE de uma fase: `perKill` da automação; sem ele, `loot / kills`; sem kills, null. */
  const porAbate = (fase) => {
    if (!fase) return null;
    if (fase.perKill) return fase.perKill;
    if ((fase.kills || 0) > 0) return { gold: (fase.gold || 0) / fase.kills, xp: (fase.xp || 0) / fase.kills };
    return null;
  };
  /** Poções de uma fase. Regra: `potions: 0` numa fase COM abates não é medição do combate -
   *  é a automação sem agir (modo observação). Quando a fase tem abates e nenhuma poção, mostra-se
   *  "-" em vez de 0. */
  const potTxt = (fase, porMinuto) => {
    const v = porMinuto != null ? porMinuto : (fase ? (fase.potions || 0) : null);
    if (v == null) return '-';
    if (!v && fase && (fase.kills || 0) > 0) return '-';
    return fmt1(v);
  };
  function renderFarmObjetivo() {
    // OBJETIVO DO FARM: só faz sentido no "Auto farm sozinho" (é ele que escolhe a região pelo
    // objetivo). No "Auto farm pra item" a região vem do DROP, logo o objetivo não manda nada;
    // mostrar o cartão ali era ruído (queixa do dono, 2026-10-23).
    if (farmModo() !== 'sozinho') { setHtml('ap-fm-objetivo', ''); return; }
    const c0 = cfg();
    const objAtual = String(c0.objetivo || 'xp');
    setHtml('ap-fm-objetivo', card('O que você quer ganhar', 'o objetivo muda a região escolhida',
      linha('Objetivo', 'a região ideal passa a ser escolhida por isto',
        '<select id="ap-obj">'
        + '<option value="ouro+xp"' + (objAtual === 'ouro+xp' ? ' selected' : '') + '>Ouro e experiência (o melhor dos dois)</option>'
        + '<option value="xp"' + (objAtual === 'xp' ? ' selected' : '') + '>Experiência (subir de nível)</option>'
        + '<option value="ouro"' + (objAtual === 'ouro' ? ' selected' : '') + '>Ouro (comprar itens)</option>'
        + '<option value="runas"' + (objAtual === 'runas' ? ' selected' : '') + '>Runas</option>'
        + '</select>')));
  }
  function renderFarm() {
    const f = farm();

    // previsor: real vs teórico para a build equipada
    const eqBases = (ler('readEquip', []) || []).map((e) => String(e.base));
    const regId = idRegiaoDe((ler('readLocation', {}) || {}).text);
    const prev = eqBases.length ? ler('preverBuild', null, eqBases, regId) : null;
    if (prev) {
      const bloco = (nome, x, teorico) => {
        if (!x) return '<p class="hint">' + nome + ': sem previsão.</p>';
        const detalhe = (x.fonte === 'historico' ? 'medido no jogo' : 'estimativa') + (x.n != null ? ' · amostra n=' + x.n : '');
        const val = x.goldMin != null ? fmt(x.goldMin) + ' ouro/min · ' + fmt(x.xpMin) + ' xp/min'
          : (x.dps != null ? fmt(x.dps) + ' dano/s' : '-');
        return '<p class="aviso ' + (x.fonte === 'historico' ? 'ok' : '') + '">' + nome + ', ' + val + ' <b>(' + detalhe + ')</b></p>';
      };
      setHtml('ap-fm-previsor', card('Previsão para a sua build de agora', 'medido quando existe; teoria quando não',
        bloco('Mobs', prev.mob, prev.teorico && prev.teorico.mob)
        + bloco('Chefe', prev.chefe, prev.teorico && prev.teorico.chefe)
        + '<p class="hint tira">O que foi medido manda; a estimativa só preenche o que falta.</p>'
        + diag('Medição (manutenção manual)')
        + '<div class="acoes">' + acaoD('ap-fm-testes', '🧪 Medir conjuntos de itens', 'O teste mede cada conjunto no jogo e alimenta esta previsão.') + '</div>'));
    } else setHtml('ap-fm-previsor', card('Previsão para a sua build de agora', 'medido quando existe; teoria quando não',
      '<p class="vazio">Ainda sem previsão para esta build.</p>'));

    // regiões (medido × meta)
    const agg = agregado();
    const rec = recomendacao();
    setHtml('ap-fm-regioes', card('Regiões, o que foi medido', 'ouro/xp reais por minuto, com mobs e chefe separados',
      agg.length
        ? tabela(['região', 'chefe', 'ouro/min', 'xp/min', 'abates/min', 'mortes', 'mobs', 'chefe', 'poções/min · ouro/min'],
          agg.map((r) => {
            const z = r.risco;
            const melhor = rec && rec.regiao === r.region;
            // MOBS e CHEFE são riscos DIFERENTES (ordem do dono, 2026-10-23): "por que nao sabe
            // que eu sobrevivo aos MOBS e morro pro chefe, e baseia o xp e ouro nisso?".
            // `r.risco` é a luta contra o CHEFE (agregar); a vida mínima dos mobs é medida.
            const mobs = r.mobHpMinRel != null
              ? (Number(r.mobHpMinRel) < 0.15 ? '💀 mobs' : '✔ ' + Math.round(Number(r.mobHpMinRel) * 100) + '% vida')
              : '-';
            const chefe = z ? (z.mortal ? '💀 mata' : (z.morre ? '⚠ ' + fmt1(z.tMorrer) + 's' : '✔ sobrevive')) : '-';
            return '<tr class="' + (melhor ? 'melhor' : '') + '"><td>' + (melhor ? '⭐ ' : '') + esc(limparNivel(r.region)) + '</td><td>' + esc(limparNivel(r.boss || '-'))
              + '</td><td>' + fmt(r.goldMin) + '</td><td>' + fmt(r.xpMin) + '</td><td>' + fmt1(r.killsMin) + '</td><td>' + (r.deaths || 0)
              + '</td><td>' + mobs + '</td><td>' + chefe + '</td><td>' + fmt1(r.potMin) + ' · ' + fmt(r.goldPotionMin) + '</td></tr>';
          }), 'Ainda não há ciclos medidos')
        : '<p class="vazio">Ainda não há ciclos medidos. Farmar um pouco numa região já cria histórico.</p>'
        + (rec ? '<p class="aviso ok">Recomendação agora: <b>' + esc(limparNivel(rec.regiao)) + '</b>, ' + fmt(rec.ouroLiquidoMin) + ' ouro limpo/min (' + (rec.sobrevive ? 'você sobrevive ao chefe' : 'só mobs: o chefe mata') + ').</p>' : '')));

    // ranking teórico
    const obj = cfg().objetivo || 'xp';
    const rank = ler('rankRegioes', [], obj) || [];
    const riscoDe = (x) => {
      if (!x) return '-';
      // Risco de MOBS e de CHEFE são coisas diferentes (dono, 2026-10-23): a região pode ser
      // segura nos mobs e letal no chefe (Covil do Barão). Mostrar um veredicto só escondia isso.
      const mobs = x.mobsMatam === true ? '💀 mobs' : (x.mobsMatam === false ? '✔ mobs' : '- mobs');
      // D14 (2026-10-23): o campo que `rankRegioes` devolve e `chefeFatal` (automation.js:13240).
      // A GUI testava `chefeMatam`, que NAO existe nesta linha: a coluna mostrava sempre "- chefe".
      const chefe = x.chefeFatal === true ? '💀 chefe' : (x.chefeFatal === false ? '✔ chefe' : '- chefe');
      return mobs + ' · ' + chefe;
    };
    setHtml('ap-fm-rank', card('Ranking por ' + (obj === 'ouro' ? 'ouro' : obj === 'runas' ? 'runas' : 'experiência'), 'estimativa para o seu nível',
      rank.length
        ? tabela(['#', 'região', 'chefe', 'xp/min', 'ouro/min', 'runas/hora', 'risco'],
          rank.slice(0, 20).map((x, i) => '<tr class="' + (i === 0 ? 'melhor' : '') + '"><td>' + (i + 1) + '</td><td>' + (i === 0 ? '⭐ ' : '') + esc(x.nome)
            + '</td><td>' + esc(x.chefe || '-') + '</td><td>' + fmt(x.xpMin) + '</td><td>' + fmt(x.goldMin) + '</td><td>' + fmt(x.runasH) + '</td><td>' + riscoDe(x) + '</td></tr>'),
          'sem dados do catálogo')
        : '<p class="vazio">O jogo ainda não entregou o catálogo.</p>'
        + '<p class="hint tira">Esta tabela é a comparação crua do objetivo; a de cima é o que foi medido e manda na escolha.</p>'));

    // últimos ciclos: MOBS por minuto, CHEFE por abate (ver a nota no topo desta seção)
    const ciclos = (f.cycles || []).slice(0, 30);
    setHtml('ap-fm-ciclos', card('Últimos ciclos', 'um ciclo = farmar até matar o chefe',
      tabela(['#', 'hora', 'região / chefe', 'mob ouro/min', 'mob xp/min', 'mob poções/min', 'chefe ouro/abate', 'chefe xp/abate', 'luta do chefe (s)'],
        ciclos.map((c2, i) => {
          const mm = (c2.mobFase && c2.mobFase.perMin) || {};
          const pk = porAbate(c2.bossFase);
          const fim = c2.fim === 'chefe' ? ' ✅' : c2.fim === 'viagem' ? ' ↩' : c2.fim === 'morte' ? ' 💀' : (c2.incompleto ? ' ⚠' : '');
          return '<tr><td>' + (i + 1) + '</td><td>' + hora(c2.endedAt || c2.startedAt) + '</td><td>' + esc(limparNivel(c2.region)) + (c2.boss ? ' / ' + esc(limparNivel(c2.boss)) : '') + fim
            + '</td><td>' + fmt(mm.gold) + '</td><td>' + fmt(mm.xp) + '</td><td>' + potTxt(c2.mobFase, mm.potions) + '</td>'
            + '<td>' + (c2.boss ? (pk ? fmt(pk.gold) : '-') : '-') + '</td><td>' + (c2.boss ? (pk ? fmt(pk.xp) : '-') : '-')
            + '</td><td>' + (c2.bossDurMs ? fmtDur(c2.bossDurMs) : '-') + '</td></tr>';
        }), 'sem ciclos registados')
      + '<p class="hint tira">Nas colunas do <b>chefe</b> o número é <b>por abate</b> (loot ÷ abates), não por minuto: comparar chefes pela taxa da janela premia quem morre rápido. '
      + 'Nas colunas de <b>mobs</b> a taxa é <b>por minuto</b>, que é o que faz sentido com muitos abates.</p>'
      + '<p class="hint tira">Poções aparece como <b>, </b> quando a fase teve abates e nenhuma poção foi usada: 0/min não é medição de combate, é a automação sem agir (modo observação) ou sem precisar de poção.</p>'));
  }

  /* ============================== GANHOS: SÓ CHEFES E CORRIDAS ==============================
   * Ordem do dono (2026-10-22): o painel de ganhos NÃO mostra ganho de mob. Ganho de mob é
   * ruído: com o boneco a tomar um tapa e morrer, "xp/min de mobs" enchia o ecrã com números que
   * ele nunca via. O que interessa é (a) a corrida/farm session em curso, em TOTAIS, e (b) os
   * chefes, por abate. As taxas de mob continuam medidas e visíveis na aba FARM, que é onde se
   * decide onde farmar. */
  function renderChefes() {
    const f = farm();
    const cur = f.current;
    if (cur) {
      const boss = cur.fase === 'boss';
      const fase = boss ? cur.bossFase : cur.mobFase;
      const ms = Date.now() - (cur.startedAt || Date.now());
      const pk = boss ? porAbate(fase) : null;
      const tot = (v) => fmt(v || 0);
      const corpo = boss
        ? '<div class="kvs">'
          + kv('ouro por chefe', pk ? fmt(pk.gold) : '-')
          + kv('xp por chefe', pk ? fmt(pk.xp) : '-')
          + kv('tempo do chefe', fmtDur(Date.now() - ((fase && fase.startedAt) || Date.now())))
          + kv('poções nesta luta', fmt((fase && fase.potions) || 0))
          + '</div>'
        : '<div class="kvs">'
          + kv('ouro na corrida', tot(fase && fase.gold))
          + kv('xp na corrida', tot(fase && fase.xp))
          + kv('abates', tot(fase && fase.kills))
          + kv('poções usadas', tot(fase && fase.potions))
          + '</div>';
      setHtml('ap-fm-agora', card(boss ? 'Chefe agora' : 'Corrida agora',
        esc(limparNivel(cur.region)) + ' · há ' + fmtDur(ms) + (cur.deaths ? ' · mortes: ' + cur.deaths : ''),
        corpo
        + '<p class="hint">Totais da corrida, não taxas por minuto.</p>'));
    } else {
      setHtml('ap-fm-agora', card('Corrida agora', '',
        '<p class="vazio">Sem corrida ativa. Os números se enchem sozinhos quando você estiver no mapa.</p>'));
    }

    // CHEFES: um por abate (loot ÷ abates). Sem colunas de mob.
    const ciclos = (f.cycles || []).filter((c2) => c2 && c2.boss).slice(0, 30);
    setHtml('ap-fm-chefes', card('Chefes abatidos', 'loot por abate; a coluna de tempo é a DURAÇÃO DA LUTA, não a corrida',
      tabela(['hora', 'região', 'chefe', 'ouro/abate', 'xp/abate', 'luta (s)', 'poções'], ciclos.map((c2) => {
        const pk2 = porAbate(c2.bossFase);
        return '<tr><td>' + hora(c2.endedAt || c2.startedAt) + '</td><td>' + esc(limparNivel(c2.region))
          + '</td><td>' + esc(limparNivel(c2.boss)) + '</td><td>' + (pk2 ? fmt(pk2.gold) : '-')
          + '</td><td>' + (pk2 ? fmt(pk2.xp) : '-') + '</td><td>' + (c2.bossDurMs ? fmtDur(c2.bossDurMs) : '-')
          + '</td><td>' + fmt((c2.bossFase && c2.bossFase.potions) || 0) + '</td></tr>';
      }), 'ainda sem chefes abatidos')
      + '<p class="hint tira">“luta (s)” é o tempo do <b>combate com o chefe</b>, não é uma corrida nem inclui viagem ou base. '
      + 'O ciclo completo (chegar, farmar mobs, matar o chefe, voltar) aparece em <b>Últimos ciclos</b>, na aba Farm.</p>'
      + '<p class="hint tira">Dividir o loot do chefe pelo tempo premia quem morre rápido; por abate é a comparação honesta.</p>'));
  }


  // ------------------------------------- FARM: DUAS MODALIDADES (aba Ganhos)
  // Duas modalidades de farm:
  //   (a) SOZINHO  - a automação escolhe a região.
  //   (b) POR ITEM - o usuário marca itens e a automação diz onde cada um dropa. A resposta vem da
  //       função `planejar(ids)` da automação (automation.js:1537), que devolve por item e por zona:
  //       { item, nome, zona, zonaNome, faixa, mobs, chefe, chance, sobreviveMob, chefeFatal,
  //         dropsH }. A GUI só desenha essa resposta - nenhum número é inventado aqui.
  const RAR_NOME = { lendario: 'Lendários', epico: 'Épicos', basico: 'Básicos (peças)' };
  const ORDEM_RAR = ['lendario', 'epico', 'basico'];
  /** Rótulo do ESPAÇO do item. Os valores são os do jogo (motor.js: `NOME_ESPACO`:
   *  arma, armadura, cabeca, mao, botas, acessorio). */
  const ESPACO_NOME = { arma: 'Arma', armadura: 'Armadura', cabeca: 'Cabeça', mao: 'Mão esquerda', botas: 'Botas', acessorio: 'Acessório' };
  const ORDEM_ESPACO = ['arma', 'armadura', 'cabeca', 'mao', 'botas', 'acessorio'];
  const espacoDeItem = (i) => (i && ESPACO_NOME[i.espaco] ? i.espaco : 'outros');
  const espacoNome = (k) => ESPACO_NOME[k] || 'Outros';
  /** Modalidade de farm escolhida (preferência da GUI, não da automação). */
  const farmModo = () => (guiPrefs.farmModo === 'item' ? 'item' : 'sozinho');
  /** Grava uma preferência da GUI (GUI_KEY) e mantém o espelho local em sincronia. */
  function salvarPrefs(patch) {
    guiPrefs = Object.assign({ bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false }, guiPrefs, patch);
    try { chrome.storage.local.set({ [GUI_KEY]: guiPrefs }); } catch (e) { /* sem storage */ }
  }
  const metaItens = () => (ler('getMeta', {}) || {}).itens || [];
  /** Mapa de drops da automação (`getMeta().ondeItem`: id -> zonas). `null` = a automação ainda não leu o
   *  catálogo; nesse caso NÃO se pode dizer "não dropa em lugar nenhum", só que ainda não se sabe. */
  const ondeItemMapa = () => { const m = ler('getMeta', {}); return m && m.ondeItem && typeof m.ondeItem === 'object' ? m.ondeItem : null; };
  /** Plano de drop dos itens escolhidos, do MOTOR (`planejar`). Cache de 15 s por assinatura da
   *  escolha: `planejar` chama `agregar()` por dentro (percorre o histórico de ciclos), então não
   *  pode ser chamado a cada desenho. Devolve `null` quando a automação não respondeu - que NÃO é o
   *  mesmo que "não dropa em zona nenhuma". */
  let planoItensCache = { sig: null, at: 0, v: null, erro: null };
  function planoItens() {
    const ids = Array.from(selItens);
    const sig = ids.join(',');
    if (planoItensCache.sig === sig && Date.now() - planoItensCache.at < 15000) return planoItensCache.v;
    let v = [], erro = null;
    if (ids.length) {
      const r = chamar('planejar', ids);
      if (r.ok && Array.isArray(r.v)) v = r.v; else { v = null; erro = r.erro || 'resposta-invalida'; }
    }
    planoItensCache = { sig: sig, at: Date.now(), v: v, erro: erro };
    return v;
  }
  /** Plano de drop desenhado: uma linha por (item, zona); a 1.ª linha de cada item (maior
   *  drops/hora) vem marcada. Itens que a automação não devolve no plano são ditos por palavras -
   *  `planejar` os pula (`if (!o) continue`) e sem isto eles sumiriam sem explicação. */
  function renderPlanoItens() {
    const ids = Array.from(selItens);
    if (!ids.length) {
      setHtml('ap-plan-out', '<p class="vazio">Nenhum item escolhido ainda, o plano aparece aqui assim que você marcar.</p>');
      return;
    }
    const plano = planoItens();
    if (plano === null) {
      setHtml('ap-plan-out', '<p class="aviso err">A automação não respondeu ao plano de drop (' + esc(erroLegivel(planoItensCache.erro, 'planejar')) + '). Nada foi inventado.</p>');
      return;
    }
    if (!plano.length) {
      const oi = ondeItemMapa();
      setHtml('ap-plan-out', '<p class="aviso warn">' + (oi
        ? 'A automação não conhece nenhuma zona que drope estes itens.'
        : 'A automação ainda não leu o catálogo do jogo (o mapa de drops está vazio), recarregue a página com F5.') + '</p>');
      return;
    }
    const porItem = new Map();
    for (const x of plano) { const k = String(x.item); if (!porItem.has(k)) porItem.set(k, []); porItem.get(k).push(x); }
    const linhas = [];
    const semZona = [];
    for (const id of ids) {
      const lista = (porItem.get(String(id)) || []).slice().sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0));
      if (!lista.length) { semZona.push(id); continue; }
      lista.forEach((x, i) => {
        linhas.push('<tr class="' + (i === 0 ? 'melhor' : '') + '">'
          + '<td>' + (i === 0 ? '<img src="' + ITEM_IMG(id) + '" alt="" loading="lazy" onerror="this.style.opacity=.2">' : '↳ ') + esc(x.nome || nomeItem(id)) + '</td>'
          + '<td>' + esc(limparNivel(x.zonaNome || x.zona)) + '</td>'
          + '<td>' + (x.faixa ? esc(String(x.faixa[0]) + '–' + String(x.faixa[1])) : '-') + '</td>'
          + '<td>' + (x.chance ? (x.chance * 100).toFixed(4) + '%' : '-') + '</td>'
          + '<td>' + (x.dropsH == null ? '-' : fmt1(x.dropsH)) + '</td>'
          + '<td>' + (x.sobreviveMob === false ? '💀 morre' : x.sobreviveMob === true ? '✔ ok' : '-') + '</td>'
          + '<td>' + (x.chefeFatal === true ? '💀 mata você' : x.chefeFatal === false ? '✔ ok' : '-') + '</td>'
          + '</tr>');
      });
    }
    const viaveis = plano.filter((x) => x.chefeFatal !== true);
    const alvo = (viaveis.length ? viaveis : plano).slice().sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0))[0] || null;
    setHtml('ap-plan-out',
      tabela(['item', 'onde dropa', 'faixa', 'chance por abate', 'drops/hora', 'mobs', 'chefe'], linhas, 'sem dados de drop')
      + (semZona.length
        ? '<p class="aviso warn"><b>' + semZona.length + '</b> item(ns) escolhido(s) <b>não dropam em zona nenhuma</b> (a automação não os tem no mapa de drops): '
          + semZona.map((b) => esc(nomeItem(b))).join(', ') + '.</p>'
        : '')
      + (alvo
        ? '<p class="aviso ok">Melhor destino para a sua escolha: <b>' + esc(limparNivel(alvo.zonaNome || alvo.zona)) + '</b>'
          + (alvo.dropsH != null ? ' · ' + fmt1(alvo.dropsH) + ' drops/hora de ' + esc(alvo.nome) : '')
          + (alvo.chefeFatal === true ? ' · ⚠ o chefe dessa zona mata você (a automação fica só nos mobs)' : '') + '.</p>'
        : '')
      + '<p class="hint tira">A primeira linha de cada item é a melhor zona dele. <b>Chance por abate</b> e <b>drops/hora</b> são contas da automação (catálogo do jogo × abates medidos na região); ", " = a automação não tem esse número.</p>');
  }
  /** Chips dos itens escolhidos (com o × para tirar). Vive no cartão do auto farm pra item. */
  function renderChips() {
    setHtml('ap-fm-chips', ordenarItens(Array.from(selItens)).map((id) => '<span class="chip"><img src="' + ITEM_IMG(id) + '" alt="">' + esc(nomeItem(id))
      + ' <b data-rem="' + esc(id) + '" style="cursor:pointer;color:#ff9a6a">×</b></span>').join('')
      || '<p class="vazio">nenhum item escolhido</p>');
    const n = $('ap-sel-n'); if (n) n.textContent = String(selItens.size);
  }
  /** A escolha de itens mudou (marcar, tirar, limpar): esquece o plano em cache e redesenha o que
   *  depende dela (a grade do modal, os chips e o cartão do auto farm pra item). */
  function mudouEscolha() {
    planoItensCache = { sig: null, at: 0, v: null, erro: null };
    renderItemGrade();
    renderFarmItens();
  }
  /** As duas modalidades de farm, lado a lado; o corpo mostra a que está escolhida. */
  function renderFarmModo() {
    const modo = farmModo();
    const c = cfg();
    const rec = recomendacao();
    const fixa = c.regionDefault || null;
    const objTxt = ({ xp: 'experiência', ouro: 'ouro', runas: 'runas' }[c.objetivo] || c.objetivo || 'experiência');
    const corpoSozinho = '<div class="kvs">'
      + kv('objetivo', esc(objTxt))
      + kv('região em uso', fixa ? 'FIXA (você escolheu)' : 'automática (a automação escolhe)')
      + kv(fixa ? 'região fixa' : 'a automação escolheu', esc(fixa ? nomeRegiao(fixa) : (rec ? limparNivel(rec.regiao) : '-')))
      + '</div>'
      + (fixa ? '<p class="aviso warn">A região está <b>FIXA</b> em <b>' + esc(nomeRegiao(fixa)) + '</b> (você escolheu). Enquanto for assim, o auto farm sozinho <b>não</b> escolhe a melhor região, volta ao automático no botão abaixo ou na aba Painel.</p>' : '')
      + '<div class="acoes">'
      + acao('ap-fm-auto', '🎯 Voltar a escolher a região sozinho', fixa ? 'Limpa a região fixa: a automação volta a escolher a melhor região para o seu nível.' : 'Já está automática: a automação escolhe a região sozinho.', '', !fixa)
      + '</div>'
      + diag('Forçar viagem (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-fm-go', '▶ Ir agora para a melhor região', 'Liga o auto-play e viaja já para a melhor região para o seu nível. Um clique.')
      + '</div>'
      + '<p class="hint tira">A automação escolhe a região sozinho e muda quando compensa. Para mudar o objetivo, use a aba <b>Painel</b>.</p>';
    const corpoItem = '<p class="hint tira">Marque abaixo os itens que você quer dropar: a automação diz em que região cada um cai, com a chance e os drops/hora, e leva você até lá.</p>';
    const minModo = guiPrefs.fmModoMin === true;
    setHtml('ap-fm-modo', cardMin(null, 'Como você quer farmar', 'duas modalidades, escolha uma',
      '<div class="modos">'
      + '<button class="modo' + (modo === 'sozinho' ? ' ativa' : '') + '" id="ap-fm-modo-sozinho"><b>Auto farm sozinho</b></button>'
      + '<button class="modo' + (modo === 'item' ? ' ativa' : '') + '" id="ap-fm-modo-item"><b>Auto farm pra item</b></button>'
      + '</div>'
      + (modo === 'item' ? corpoItem : corpoSozinho), minModo, 'ap-fm-min-modo', !minModo));
  }
  /** O cartão do "auto farm pra item": escolha, plano de drop e o botão que executa. */
  function renderFarmItens() {
    if (farmModo() !== 'item') { setHtml('ap-fm-itens', ''); return; }
    const n = selItens.size;
    const total = metaItens().length;
    const minItens = guiPrefs.fmItensMin === true;
    setHtml('ap-fm-itens', cardMin(null, 'Auto farm pra item, o que quero dropar', n ? n + ' item(ns) escolhido(s)' : 'nenhum item escolhido',
      '<div class="chips" id="ap-fm-chips"></div>'
      + (n ? '' : '<p class="vazio">Nenhum item escolhido ainda.</p>'
        + '<p class="hint tira">Clique em <b>Escolher itens</b> e marque o que você quer. A lista mostra os itens do jogo agrupados por raridade e por espaço (arma, armadura, cabeça, mão, botas, acessório)'
        + (total ? ', ' + total + ' itens no catálogo' : '') + '.</p>')
      + '<div class="acoes">'
      + acao('ap-pick', '🔍 Escolher itens (<b id="ap-sel-n">' + n + '</b>)', 'Abre a lista de itens do jogo para você marcar o que quer dropar.')
      + acao('ap-plan-go', '🧭 Farmar estes itens', n ? 'Confirma o destino e leva você até lá: liga o auto-play, fixa a região e viaja.' : 'Escolha primeiro os itens que você quer dropar.', n ? '' : 'sec', !n)
      + acao('ap-plan-limpar', '✖ Limpar escolha', 'Tira todos os itens da escolha (não mexe em nada no jogo).', 'sec', !n)
      + '</div>'
      + '<div id="ap-plan-out"></div>'
      + '<p class="hint tira">A automação não tem (ainda) um modo "farmar até cair": a região fica <b>fixa</b> e ele continua lá até você mudar, não para sozinho quando o item cai.</p>', minItens, 'ap-fm-min-itens', !minItens));
    renderPlanoItens();
    renderChips();
  }

  // ---------------------------------------------------------------- ABA MERCADO
  let ofertasCache = null, ornnCache = null, compraCache = null;  function renderMercado() {
    // `mercadoSaturado()` devolve { sat, lend, total } - um
    // OBJETO, logo era sempre verdadeiro e o cartão dizia "mercado cheio? sim" mesmo vazio.
    const sat = ler('mercadoSaturado', null);
    const cheio = sat && typeof sat === 'object' ? !!sat.sat : (sat === true);
    const lend = (sat && typeof sat === 'object' && sat.lend != null) ? sat.lend : null;
    // As ofertas que o MOTOR já leu ficam gravadas (OFERTAS_KEY): mostram-se sem pedir nada.
    const ofertas = ofertasCache || (ofertasStore && ofertasStore.ofertas) || ler('minhasOfertas', []) || [];
    const ofAt = (ofertasStore && Number(ofertasStore.at)) || 0;
    setHtml('ap-mk-ofertas', card('As minhas ofertas no mercado', '<span id="ap-mk-quando">, </span>',
      '<div class="kvs">'
      + kv('ofertas', String(ofertas.length))
      + kv('mercado cheio?', sat == null ? '-' : (cheio ? 'sim' : 'não') + (lend == null ? '' : ' <small>' + fmt(lend) + '/10 lendários</small>'))
      + '</div>'
      + (ofertas.length
        ? tabela(['item', 'raridade', 'qualidade', 'preço'], ordenarMercado(ofertas).map((o) => '<tr><td>' + (ehIdeal(o) ? '⭐ ' : '') + esc(o.nome || o.base || '?') + '</td><td>' + esc(o.raridade || '-')
          + '</td><td>' + esc(o.qual || '-') + '</td><td>' + fmt(o.preco) + '</td></tr>'))
        : '<p class="vazio">Ainda não há leitura das suas ofertas.</p>'
          + '<p class="hint tira">A automação lê-as quando passa pelo mercado e grava a lista, a partir daí aparece aqui, sem precisar clicar em nada. O botão abaixo força uma leitura nova.</p>')
      + '<p class="hint tira">⭐ = item da sua build ideal (ou componente dela). Esses vêm sempre no topo.</p>'
      + diag('Mercado: leitura e ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-mk-ler', '📖 Forçar leitura das minhas ofertas', 'Abre o mercado, lê a aba "Minhas ofertas", grava e fecha. Não muda nada.')
      + acaoD('ap-mk-anunciar', '🏪 Anunciar lendários abaixo de A', 'Põe à venda os lendários abaixo de tier A a ~90% do preço mais baixo. Nunca Rabadon nem tier A+.')
      + '</div>'));
    const q = $('ap-mk-quando');
    if (q) q.textContent = ofAt ? 'lidas há ' + fmtDur(Date.now() - ofAt) + ' · às ' + hora(ofAt) : (ofertas.length ? 'lidas nesta sessão' : 'sem leitura');

    setHtml('ap-mk-plano', card('Reajuste de preços', 'baixa o preço do que está caro em relação ao mercado',
      '<div id="ap-mk-plano-out"></div>'
      + diag('Reajuste de preços: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-mkt-plan', '🔍 Calcular reajuste', 'Compara cada oferta sua com o menor preço do mercado para o mesmo item e qualidade.')
      + acaoD('ap-mkt-go', '💱 Aplicar reajuste', 'Cancela e reanuncia cada oferta no preço calculado (~90% do menor).')
      + '</div>'));

    setHtml('ap-mk-ornn', card('Bancada do Ornn', 'montar itens com peças é uma APOSTA',
      '<div id="ap-mk-ornn-out"></div>'
      + diag('Bancada do Ornn: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-ornn-ler', '📜 Forçar leitura das receitas do Ornn', 'Fala com o Ornn na Fonte e lista tudo o que ele pode montar, com o custo e as peças que você tem.')
      + acaoD('ap-mk-montar', '🔨 Montar a melhor receita', 'Escolhe a receita mais barata que serve a sua build e tenta montar. Gasta ouro por tentativa.')
      + '</div>'
      + '<p class="hint tira">Cada tentativa custa ouro e tem ~1,2% de chance (2,4% com a Runa Arcana). As peças só são consumidas quando dá certo.</p>'));

    setHtml('ap-mk-compra', card('Vale a pena comprar agora?', 'decisão da automação com base no seu ouro',
      '<div id="ap-mk-compra-out">' + (compraCache ? esc(compraCache.texto || '') : '<p class="vazio">Ainda não calculei. Use o botão abaixo.</p>') + '</div>'
      + diag('Compra: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-melhor-compra', '🤔 Calcular melhor compra', 'Compara comprar o item ideal, comprar um substituto mais barato, ou esperar.')
      + acaoD('ap-mk-comprar', '🛒 Comprar o ideal no mercado', 'Compra o que falta da build ideal pelo menor preço, sem zerar o ouro.')
      + '</div>'));

    // ---- WATCH DO MERCADO (pedido do dono, 2026-10-18): itens e nomes de jogador -----------
    const w = ler('mercadoWatchEstado', null) || {};
    // A CONFIG é a fonte dos campos editáveis (o estado pode estar um render atrasado).
    // O estado serve para `achados`, `at` e `ultimaCompra`.
    const cfgWatch = (cfg() && cfg().mercadoWatch) || {};
    const wVend = (cfgWatch.vendedores || w.vendedores || []).join(', ');
    const wPreco = cfgWatch.precoMax == null ? 0 : Number(cfgWatch.precoMax);
    const wTeto = cfgWatch.tetoCompra == null ? 0 : Number(cfgWatch.tetoCompra);
    const wCad = Math.max(2, Math.round((Number(cfgWatch.cadenciaMs != null ? cfgWatch.cadenciaMs : w.cadenciaMs) || 2000) / 1000));
    const wPct = cfgWatch.percentualOuro == null ? 90 : Math.max(0, Math.min(100, Number(cfgWatch.percentualOuro) || 0));
    const wRefMin = Math.max(0, Math.min(5, Number(cfgWatch.refinoMin) || 0));
    const wTierMin = String(cfgWatch.tierMin || '').toUpperCase();
    const wPrio = String(cfgWatch.prioridade || 'tier');
    const wAch = (w.achados || []);
    const faltaDe = (o) => {
      const t = Number(o && o.libera);
      return Number.isFinite(t) && t > 0 ? Math.max(0, t - Date.now()) : 0;
    };
    const wOut = !w.at ? '<p class="vazio">Ainda não vigiou. A automação vigia sozinho a cada ' + wCad + ' s; o botão abaixo força agora.</p>'
      : wAch.length
        ? tabela(['vendedor', 'item', 'preço', 'estado'], ordenarMercado(wAch).map((o) => {
          const falta = faltaDe(o);
          return '<tr><td>' + esc(o.vendedor || '?') + '</td><td>' + esc(o.item || '?')
            + '</td><td>' + fmt(o.preco) + (o.moeda && o.moeda !== 'ouro' ? ' ' + esc(o.moeda) : '')
            + '</td><td>' + (falta > 0 ? '⏳ ' + fmtDur(falta) : 'pronto') + '</td></tr>';
        }))
        : '<p class="vazio">A última vigia (há ' + fmtDur(Date.now() - w.at) + ') não achou nada que casasse.</p>';
    const wUlt = w.ultimaCompra;
    // Chips dos itens escolhidos, cada um com o SEU limite em ouro (pedido do dono 2026-10-21:
    // "item x até x de gold, item y até y"). Vazio/0 = vale o teto global.
    const wItens = Array.isArray(cfgWatch.itens) ? cfgWatch.itens : [];
    const limWatch = (cfgWatch && cfgWatch.limites) || {};
    const chipsItens = wItens.length
      ? '<div class="chips" id="ap-watch-chips">' + ordenarItens(wItens).map((b) => '<span class="chip" title="' + esc(b) + '">' + itemImgTag(b) + esc(nomeItem(b))
        + ' <input class="wlim" data-wlim="' + esc(b) + '" type="number" min="0" step="1000" title="limite de ouro para este item (0 = teto global)" value="' + (Number(limWatch[b]) > 0 ? Number(limWatch[b]) : '') + '" placeholder="limite">'
        + ' <b data-wrem="' + esc(b) + '" style="cursor:pointer;color:#ff9a6a">×</b></span>').join('') + '</div>'
      : '<p class="vazio" id="ap-watch-chips">Nenhum item escolhido, marque nos ícones abaixo (ou vigie só um jogador).</p>';
    const vendedoresWatch = cfgWatch.vendedores || w.vendedores || [];
    const chipsVendedores = vendedoresWatch.length
      ? '<div class="chips" id="ap-watch-vendedores-chips">' + vendedoresWatch.map((v) => '<span class="chip">' + esc(v)
        + ' <b data-wvend="' + esc(v) + '" style="cursor:pointer;color:#ff9a6a" title="remover">×</b></span>').join('') + '</div>'
      : '<p class="vazio" id="ap-watch-vendedores-chips">Nenhum jogador escolhido, escreva o nome abaixo e clique em Adicionar.</p>';
    setHtml('ap-mk-watch', card('Watch do mercado, itens e jogadores', 'detecta em tempo real e compra sozinho',
      '<p class="hint tira">Vigia o mercado dos jogadores pelo SERVIDOR (todas as ofertas, com vendedor) e, quando algo casa, compra pelo próprio mercado do jogo. <b>Só gasta ouro</b> (nunca Gemas/diamantes) e nunca abaixo da reserva de poções. Para comprar sozinho tem de estar no <b>Mercador</b> (base), a deteção corre em qualquer sítio.</p>'
      + '<p class="hint tira">A vigia não tem liga/desliga: se há itens ou jogadores na lista, ela está ativa e compra sozinha. Lista vazia = não vigia nada.</p>'
      + '<p class="hint">Itens que você quer (escolha nos ícones abaixo):</p>'
      + chipsItens
      // A GRADE DE ÍCONES FICA SEMPRE À VISTA (pedido do dono 2026-10-20: "make a item
      // watch ... choose items from their icons"). Antes estava escondida atrás de
      // "Adicionar itens" e o painel parecia uma watch vazia. A busca filtra por nome; o
      // clique no ícone marca/desmarca. O id só existe por baixo (é o que o servidor devolve).
      + '<div class="watch-picker" id="ap-watch-picker">'
      +   '<p class="hint tira">Clique nos ícones para escolher os itens que quer comprar. Lista vazia não vigia item nenhum.</p>'
      +   '<input id="ap-watch-busca" type="search" placeholder="procurar item por nome…" autocomplete="off">'
      +   '<div class="scroll" id="ap-watch-grade" style="max-height:240px"></div>'
      +   '<div class="acoes"><button id="ap-watch-ok" class="btn sec">Salvar itens escolhidos</button></div>'
      + '</div>'
      // CONFIG DIRETA: os campos de dinheiro são livres (o select antigo só oferecia
      // 100k/500k). O jogador entra por texto + botão (Enter também funciona) e sai pelo ×.
      + '<p class="hint">Jogadores que você acompanha:</p>'
      + chipsVendedores
      + '<label class="campo">Adicionar jogador<input id="ap-watch-vendedor-add" type="text" autocomplete="off" spellcheck="false" placeholder="nome do jogador"></label>'
      // PEDIDO DO DONO 2026-10-20: o default passa a ser ESTRITO; esta opcao deixa escolher
      // conscientemente a uniao.
      + '<label class="campo">Comprar de<select id="ap-watch-filtro">'
      +   '<option value="so"' + (String(cfgWatch.filtroVendedores || 'so') === 'so' ? ' selected' : '') + '>Só destes jogadores</option>'
      +   '<option value="qualquer"' + (String(cfgWatch.filtroVendedores || 'so') === 'qualquer' ? ' selected' : '') + '>Qualquer jogador (itens da lista)</option>'
      + '</select></label>'
      + '<p class="hint tira"><b>Só destes jogadores</b>: se a lista tem nomes, nenhuma oferta de outro jogador é comprada. Se também escolheu itens, só compra esses itens deles.</p>'
      + '<div class="acoes">' + acao('ap-watch-vendedor-ok', '＋ Adicionar jogador', 'Adiciona o nome escrito à lista de jogadores vigiados.', 'sec') + '</div>'
      + '<label class="campo">Preço máximo por oferta (ouro)<input id="ap-watch-preco" type="number" min="0" step="1000" value="' + (wPreco || 0) + '" placeholder="0 = sem limite"></label>'
      + '<label class="campo">Limite de gasto por compra (ouro)<input id="ap-watch-teto" type="number" min="0" step="1000" value="' + (wTeto || 0) + '" placeholder="0 = sem limite"></label>'
      + '<p class="hint tira">0 = sem limite. A deteção é no servidor; a compra só acontece no <b>Mercador</b> (Fonte).</p>'
      + '<div class="acoes">' + acao('ap-watch-30k', '30.000 nos dois', 'Preenche preço máximo e limite de gasto com 30.000 ouro.', 'sec') + '</div>'
      // PERCENTAGEM DO OURO ATUAL: escala com o ouro. 90 = pode gastar até 90% de AGORA.
      + '<label class="campo">Gastar até (% do ouro atual)<input id="ap-watch-pct" type="number" min="0" max="100" step="5" value="' + wPct + '"></label>'
      // PRIORIDADE e FILTROS: escolhidos pelo dono, aplicados em `casarOfertas`/ordenação.
      + '<label class="campo">Priorizar<select id="ap-watch-prioridade">'
      +   '<option value="tier"' + (wPrio === 'tier' ? ' selected' : '') + '>Qualidade/tier (melhor primeiro)</option>'
      +   '<option value="refino"' + (wPrio === 'refino' ? ' selected' : '') + '>Refino (mais alto primeiro)</option>'
      +   '<option value="preco"' + (wPrio === 'preco' ? ' selected' : '') + '>Preço (mais barato primeiro)</option>'
      + '</select></label>'
      + '<label class="campo">Qualidade mínima<select id="ap-watch-tier">'
      +   '<option value=""' + (!wTierMin ? ' selected' : '') + '>Qualquer</option>'
      +   ['C','B','A','S','SS'].map((q) => '<option value="' + q + '"' + (wTierMin === q ? ' selected' : '') + '>' + q + '</option>').join('')
      + '</select></label>'
      + '<label class="campo">Refino mínimo<select id="ap-watch-refino">'
      +   [0,1,2,3,4,5].map((r) => '<option value="' + r + '"' + (wRefMin === r ? ' selected' : '') + '>' + (r ? '+' + r : 'Qualquer') + '</option>').join('')
      + '</select></label>'
      + '<label class="campo">Procurar<select id="ap-watch-cad">' + (function () {
        const cads = [2, 3, 5, 10, 30, 60];
        if (cads.indexOf(wCad) < 0) cads.push(wCad);
        return cads.sort((a, b) => a - b).map((v) => '<option value="' + v + '"' + (v === wCad ? ' selected' : '') + '>a cada ' + v + ' s</option>').join('');
      })() + '</select></label>'
      + '<div id="ap-watch-out">' + wOut
        + (wUlt ? '<p class="hint">Última compra: ' + (wUlt.ok ? 'COMPROU ' + esc(wUlt.vendedor || '') + ' por ' + fmt(wUlt.preco) + ' ouro' : 'falhou, ' + esc(wUlt.motivo || '?')) + '.</p>' : '')
      + '</div>'
      + diag('Watch do mercado: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-watch-agora', '👁 Vigiar agora', 'Lê o mercado do servidor neste instante, mostra o que casa e (no Mercador) compra.')
      + '</div>'));
    renderWatchGrade();
  }

  // ---------------------------------------------------------------- ABA HISTÓRICO
  // Estado do picker de itens da watch (Set de ids-base). Inicializado a partir da config.
  let watchItens = null;
  function renderWatchGrade() {
    const g = $('ap-watch-grade'); if (!g) return;
    if (!watchItens) {
      const cfgItens = (cfg().mercadoWatch || {}).itens;
      watchItens = new Set(Array.isArray(cfgItens) ? cfgItens.map(String) : []);
    }
    const busca = (($('ap-watch-busca') || {}).value || '').toLowerCase();
    const itens = ordenarItens(metaItens().filter((i) => i && i.id && (!busca || String(i.nome || '').toLowerCase().indexOf(busca) >= 0)));
    g.innerHTML = itens.length ? itens.map((i) => {
      const on = watchItens.has(String(i.base || i.id));
      return '<button class="wrow' + (on ? ' sel' : '') + '" data-witem="' + esc(i.base || i.id) + '">'
        + itemImgTag(i.base || i.id) + '<span>' + esc(i.nome) + '</span>' + (on ? '<b>✔</b>' : '') + '</button>';
    }).join('') : '<p class="vazio">nada encontrado</p>';
  }
  function renderHist() {
    const f = farm();
    const mortes = (f.deaths || []).slice(0, 12);
    setHtml('ap-hi-mortes', card('Mortes', 'quem matou você e o que você perdeu',
      mortes.length
        ? '<div class="lista">' + mortes.map((m) => '<div class="ln loj"><time>' + hora(m.at) + '</time><b>💀 ' + esc(m.by || '?') + '</b>'
          + '<span class="d">em ' + esc(limparNivel(m.region || '?')) + ' · perdeu ' + fmt(m.xpLost) + ' XP'
          + (m.recursos ? ' · ouro ' + fmt(m.recursos.ouro) + ' · nível ' + esc(m.recursos.nivel) + ' · poções ' + esc(m.recursos.pocoes ? ORDER.map((k) => POCAO_NOME[k] + ' ' + fmt(m.recursos.pocoes[k])).join('/') : '-') : '') + '</span></div>').join('') + '</div>'
        : '<p class="vazio">Sem mortes registadas. (Só conta morte de verdade, a automação filtra avisos de NPC.)</p>'));

    const lutas = (f.lutas || []).filter((l) => l.est && l.potUsadas != null).slice(0, 20);
    setHtml('ap-hi-lutas', card('Lutas de chefe, previsto vs. real', 'valida se a previsão de poções está certa',
      lutas.length
        ? tabela(['hora', 'chefe', 'resultado', 'poções previstas', 'poções usadas', 'erro', 'tempo previsto', 'tempo real', 'seu dano/s', 'dano recebido/s'],
          lutas.map((l) => {
            const e = l.est || {};
            const erro = (l.potUsadas != null && e.potTotal != null) ? (l.potUsadas - e.potTotal) : null;
            const mau = erro != null && Math.abs(erro) > Math.max(2, (e.potTotal || 0) * 0.5);
            return '<tr><td>' + hora(l.at) + '</td><td>' + esc(limparNivel(l.boss || '?')) + '</td><td>' + (l.mortes ? '💀 você morreu' : '✅ você ganhou')
              + '</td><td>' + (e.potTotal == null ? '-' : e.potTotal) + '</td><td>' + (l.potUsadas == null ? '-' : l.potUsadas) + '</td><td class="' + (mau ? 'pend' : '') + '">' + (erro == null ? '-' : (erro > 0 ? '+' : '') + erro)
              + '</td><td>' + (e.tKillS == null ? '-' : e.tKillS + 's') + '</td><td>' + (l.durS == null ? '-' : l.durS + 's')
              + '</td><td>' + ((l.analise && l.analise.outDps) || '-') + '</td><td>' + ((l.analise && l.analise.inDps) || '-') + '</td></tr>';
          }), 'sem lutas registadas')
        : '<p class="vazio">Ainda não há lutas de chefe registadas com poções. Precisa de matar um chefe com o auto-play ligado.</p>'));

    // HISTÓRICO = o que importa ao jogador: dinheiro, loot, mortes, chefes, problemas.
    const log = (f.log || []).filter((e) => !RUIDO_HIST.has(e && e.type)).slice(0, 60);
    setHtml('ap-hi-eventos', card('Últimos acontecimentos', 'o que a automação fez, por ordem',
      log.length
        ? '<div class="lista">' + log.map((e) => {
          const resto = Object.keys(e).filter((k) => k !== 'at' && k !== 'type' && k !== 'estado' && k !== 'hist' && k !== 'recursos' && k !== 'previa' && k !== 'setup' && k !== 'build')
            .slice(0, 5).map((k) => k + ': ' + JSON.stringify(e[k])).join(' · ');
          return '<div class="ln"><time>' + hora(e.at) + '</time><b>' + esc(EVENTO_NOME[e.type] || e.type) + '</b><span class="d">' + esc(String(resto).slice(0, 200)) + '</span></div>';
        }).join('') + '</div>'
        : '<p class="vazio">sem eventos ainda</p>'));

    const iss = (f.issues || []).slice(0, 20);
    setHtml('ap-hi-problemas', card('Problemas detectados', 'erros que a automação apanhou sozinho',
      iss.length
        ? '<div class="lista">' + iss.map((e) => '<div class="ln loj"><time>' + hora(e.at) + '</time><b>' + esc(e.type || '') + '</b><span class="d">'
          + esc(typeof e === 'string' ? e : Object.keys(e).filter((k) => k !== 'at' && k !== 'type').map((k) => k + ': ' + String(e[k])).join(' · ')).slice(0, 200) + '</span></div>').join('') + '</div>'
        : '<p class="aviso ok">Nenhum problema detectado.</p>'
        + '<p class="hint tira">Aqui aparecem falhas da automação (um passo da base que deu erro, um selector que mudou no jogo, etc.).</p>'));
  }

  // ---------------------------------------------------------------- HISTÓRICO 48 h
  /** Uma linha humana para um evento da automação. Números LIDOS do evento, nunca inventados. */
  function eventoDesc(e) {
    const d = e || {};
    const t = String(d.type || '');
    const f = (x) => (Number.isFinite(Number(x)) ? fmt(x) : '-');
    if (t === 'evento:abate') return 'matou ' + (d.nome || '?') + (d.chefe ? ' 👑' : '') + (d.furioso ? ' (furioso)' : '')
      + ' · +' + f(d.ouro) + ' ouro · +' + f(d.xp) + ' xp' + (d.itens ? ' · ' + d.itens + ' item(ns)' : '') + (d.gemas ? ' · ' + d.gemas + ' gema(s)' : '');
    if (t === 'evento:item') return 'caiu item: ' + (d.id || '?');
    if (t === 'evento:nivel') return 'subiu para o nível ' + (d.nivel != null ? d.nivel : '?');
    if (t === 'evento:morreu') return 'morreu para ' + (d.por || d.alvo || '?');
    if (t === 'evento:chefeInvoca') return 'o chefe invocou ' + (d.alvo || 'algo');
    if (t === 'evento:pocao') return 'usou poção ' + (d.tipo || '?');
    if (t === 'evento:semPocao') return 'ficou sem poção';
    if (t === 'mercado') {
      if (d.acao === 'anunciar') return 'anunciou ' + (d.base || d.item || 'item') + (d.preco ? ' por ' + f(d.preco) + ' ouro' : '');
      if (d.acao === 'anunciar-lendarios') return 'anunciou ' + (d.anunciados || 0) + ' lendário(s)' + (d.cancelados ? ' · cancelou ' + d.cancelados : '');
      if (d.acao === 'watch-comprar') return 'comprou ' + (d.item || 'item') + (d.vendedor ? ' de ' + d.vendedor : '') + (d.preco ? ' por ' + f(d.preco) + ' ouro' : '');
      if (d.acao === 'comprar') return 'comprou ' + (Array.isArray(d.compras) ? d.compras.length : (d.compras || 0)) + ' peça(s) da build';
      if (d.acao === 'cancelar') return 'cancelou a oferta ' + (d.id || '?');
      if (d.acao === 'plano') return 'reajustou ' + (d.reajustar || 0) + ' oferta(s)';
      if (d.acao === 'executar') return 'aplicou ' + (d.reajustados || 0) + ' reajuste(s)';
      return 'mercado: ' + (d.acao || '?');
    }
    if (t === 'cofre') {
      if (d.guardou) return 'guardou no cofre: ' + d.guardou;
      if (d.retirou) return 'retirou do cofre: ' + d.retirou + (d.qual ? ' [' + d.qual + ']' : '');
      if (d.itens != null) return 'leu o cofre: ' + d.itens + ' item(ns)';
      if (d.abriu != null) return 'abriu o cofre' + (d.slots != null ? ' · ' + d.slots + ' slot(s)' : '');
      return 'cofre';
    }
    if (t === 'equip') return 'equipou ' + (Array.isArray(d.trocas) ? d.trocas.length : 0) + ' peça(s)' + (d.ganhoPct ? ' · +' + Math.round(d.ganhoPct * 100) / 100 + '% de dano' : '');
    if (t === 'tarefa') return d.entregou ? 'entregou a tarefa' : 'aceitou tarefa: ' + (d.tipo || '?') + (d.lugar ? ' em ' + d.lugar : '') + (d.min ? ' · ' + d.min + ' min' : '');
    if (t === 'diaria') return 'aceitou ' + (Array.isArray(d.aceitou) ? d.aceitou.length : 0) + ' missão(ões) diária(s)';
    if (t === 'refino') return 'refinou ' + (d.feitos || 0) + ' item(ns)';
    if (t === 'montagem') return 'tentou montar ' + (d.nome || d.alvo || 'item') + (d.custoPrevisto ? ' · custo ' + f(d.custoPrevisto) : '');
    if (t === 'ornn') return d.acao === 'montar' ? 'montou no Ornn: ' + (d.ok ? 'deu certo' : 'não deu') : 'leu as receitas do Ornn';
    if (t === 'rotacao') return 'repôs a rotação' + (d.aplicado && d.aplicado.ok === false ? ' · NÃO convergiu' : ' · ok');
    if (t === 'base') return d.indisponivel ? 'base indisponível: ' + d.indisponivel : (d.mutex ? 'mutex da base expirado' : 'rotina de base');
    if (t === 'viagem') return d.recall ? 'voltou à Fonte para viajar' : 'viajou para ' + (d.destino || '?');
    if (t === 'morte') return 'morreu para ' + (d.by || '?') + (d.xpLost ? ' · perdeu ' + f(d.xpLost) + ' xp' : '');
    if (t === 'farm-item') return d.ligou ? 'ligou o farm do item ' + d.ligou : 'parou o farm de item' + (d.motivo ? ': ' + d.motivo : '');
    if (t === 'build-fase') return 'trocou a build da fase ' + (d.fase || '?') + (d.trocou ? '' : ' (sem peças)');
    if (t === 'luta-chefe') return 'lutou contra o chefe' + (d.mortes ? ' e morreu' : '');
    if (t === 'kill') return d.acao === 'desligar' ? 'desligou tudo' : 'religou tudo';
    if (t === 'pause') return d.acao === 'pausar' ? 'pausou' : 'despausou';
    if (t === 'campeao') return 'campeão ' + (d.id || '?') + (d.corrigido ? ' (corrigido)' : '');
    if (t === 'habilidades') return d.desbloqueio ? 'desbloqueou ' + d.desbloqueio : 'subiu habilidades' + (d.gastos ? ' · ' + d.gastos + ' ponto(s)' : '');
    if (t === 'atributos') return 'distribuiu ' + (d.gastos || 0) + ' ponto(s) de atributo';
    if (t === 'filtro-basicos') return 'filtro de básicos ' + (d.ligou ? 'ligado' : 'desligado');
    if (t === 'teste') return 'teste de conjuntos: ' + (d.conjunto || d.fim || d.inicio || '?');
    if (t === 'giro' || t === 'giro-ir' || t === 'giro-fim') return 'giro de medição' + (d.regiao ? ': ' + d.regiao : '');
    if (t === 'ofertas') return 'leu ' + (d.n || 0) + ' oferta(s) do mercado';
    if (t === 'presentes') return 'pegou presente(s)';
    if (t === 'tutorial') return 'pulou o tutorial';
    if (t === 'simulacao') return 'simulou ' + (d.passos || 0) + ' passo(s)';
    if (t === 'melhor-compra') return 'calculou a melhor compra (' + (d.n || 0) + ' opção(ões))';
    if (t === 'itens') return 'trocou itens para ' + (d.contexto || '?');
    if (t === 'chefe-fatal') return 'chefe fatal: ' + (d.decisao || d.adiado || '?');
    if (t === 'runeterra') return 'Runeterra: ' + (d.bloqueado || 'bloqueado');
    if (t === 'repor') return d.adiado ? 'adiou a reposição de poções (' + d.adiado + ')' : ('repor poções' + (d.motivo ? ': ' + d.motivo : '') + (d.falta ? ' · falta ' + (Array.isArray(d.falta) ? d.falta.join(', ') : d.falta) : ''));
    if (t === 'regiao') return 'regiões: ' + (d.motivo || '?');
    if (t === 'caca-offline') return 'caça offline: +' + f(d.ouro) + ' ouro · +' + f(d.xp) + ' xp';
    return t.replace(/^evento:/, 'evento: ') + (d.acao ? ' · ' + d.acao : '');
  }
  const eventoLocal = (e) => String((e && (e.region || e.lugar || e.regiao || e.onde || e.destino || e.local)) || '').trim();

  function renderHistorico() {
    let h = ler('historico48h', []) || [];
    let fonte = '48 h';
    if (!h.length) { h = farm().log || []; fonte = 'sessão atual'; }
    // Ruído de rotina não entra no histórico: o jogador quer ver o que mexeu no bolso ou na vida.
    h = h.filter((e) => !RUIDO_HIST.has(e && e.type));
    // A vigia do mercado gravava cada passagem (2 s antes da correcção de 2026-10-21) e o
    // historico ficou com milhares de "mercado: watch". Nao se mostra o que nao mudou nada.
    h = h.filter((e) => !(e && e.type === 'mercado' && (e.acao === 'watch' || e.acao === 'watch-travada')));
    const abates = h.filter((e) => e.type === 'evento:abate');
    const ouro = abates.reduce((s, e) => s + (Number(e.ouro) || 0), 0);
    const xp = abates.reduce((s, e) => s + (Number(e.xp) || 0), 0);
    const itens = h.filter((e) => e.type === 'evento:item' || (e.type === 'evento:abate' && e.itens));
    // A LISTA não mostra abate de MOB (ordem do dono, 2026-10-23): "matou larva" e afins são
    // ruído. Só ficam chefes, itens e tudo o que mexe no bolso, na vida ou na decisão. As TAXAS
    // de mob continuam medidas na aba Farm, que é onde se compara região.
    h = h.filter((e) => !(e && e.type === 'evento:abate' && !e.chefe && !e.itens));
    const vendas = h.filter((e) => e.type === 'mercado' && (e.acao === 'anunciar' || e.acao === 'anunciar-lendarios'));
    const compras = h.filter((e) => e.type === 'mercado' && (e.acao === 'watch-comprar' || e.acao === 'comprar'));
    const gasto = compras.reduce((s, e) => s + (Number(e.preco) || 0), 0);
    const mortes = h.filter((e) => e.type === 'morte' || e.type === 'evento:morreu');
    setHtml('ap-hi-48h-resumo', card('Resumo das últimas 48 horas', 'tudo o que a automação registou e ficou gravado',
      '<div class="kvs">'
      + kv('abates', fmt(abates.length))
      + kv('ouro ganho', fmt(ouro))
      + kv('xp ganho', fmt(xp))
      + kv('itens que caíram', fmt(itens.length))
      + kv('anúncios no mercado', fmt(vendas.length))
      + kv('compras no mercado', fmt(compras.length))
      + kv('ouro gasto em compras', fmt(gasto))
      + kv('mortes', fmt(mortes.length))
      + '</div>'
      + (mortes.length ? '<p class="aviso warn">Última morte: ' + esc(eventoDesc(mortes[0])) + (eventoLocal(mortes[0]) ? ' · em ' + esc(eventoLocal(mortes[0])) : '') + '</p>' : '')
      + '<p class="hint">Fonte: ' + fonte + '</p>'));
    // Repetições seguidas do MESMO evento ("rotina de base" 3× no mesmo minuto) ficam numa
    // linha só com ×N: o jogador quer o que aconteceu, não quantas vezes a rotina passou.
    const seq = [];
    for (const e of h) {
      const k = String(e.type) + '|' + eventoDesc(e);
      const ult = seq[seq.length - 1];
      if (ult && ult.k === k) { ult.n += 1; continue; }
      seq.push({ k, e, n: 1 });
    }
    const lista = seq.slice(0, 300).map((g) => {
      const e = g.e;
      return '<div class="ln ' + (e.type === 'morte' || e.type === 'evento:morreu' ? 'loj' : '') + '">'
        + '<time>' + hora(e.at) + '</time><b>' + esc(EVENTO_NOME[e.type] || String(e.type || '').replace(/^evento:/, '')) + '</b>'
        + '<span class="d" title="' + esc(eventoDesc(e)) + '">' + esc(eventoDesc(e)) + (eventoLocal(e) ? ' · ' + esc(eventoLocal(e)) : '') + (g.n > 1 ? ' ×' + g.n : '') + '</span></div>';
    }).join('');
    setHtml('ap-hi-48h', card('O que aconteceu, por ordem', h.length ? h.length + ' evento(s), ' + fonte : 'sem eventos',
      h.length ? '<div class="lista">' + lista + '</div>' : '<p class="vazio">Ainda não há eventos. Farme um pouco com o auto-play ligado.</p>'));
    renderHist();
  }

  // ---------------------------------------------------------------- POÇÃO
  function renderPocao() {
    renderAgora();
    renderAuto();
    // O MODO EFETIVO vem do MOTOR (`modoPocao`): a GUI não adivinha pelo nome do mapa.
    const mp = ler('modoPocao', null) || {};
    const modo = String(mp.modo || 'inteligente');
    const smart = mp.smart !== false;
    const inteligente = modo === 'inteligente';
    const motivo = String(mp.motivo || '');
    const pot = (status && status.potions) || null;
    const ultima = status && status.lastAction;
    const minP = (config && config.minPotion) || { vida: 200, vidaF: 100, vidaS: 30 };
    setHtml('ap-pc-resumo', card('Como a auto-poção decide', 'inteligente no PvE do mapa, limiar de vida fora dele',
      tgCfg('ap-pc-smart', 'pocaoSmart', 'Decisão inteligente de poção',
        'Ligada, usa o golpe que o monstro acabou de dar e conta a cura das suas habilidades. Desligada, usa o limiar de vida. Só vale no PvE do mapa.', smart)
      + '<p class="hint tira">No <b>PvE do mapa</b> ela olha o <b>golpe que o monstro acabou de dar</b> (não a média) e conta a cura das suas habilidades. Se a cura das skills chegar, não gasta poção.</p>'
      + '<p class="aviso ' + (inteligente ? 'ok' : 'warn') + '"><b>Agora: ' + esc(motivo || modo) + '.</b> '
      + (inteligente
        ? 'A decisão inteligente está a mandar.'
        : 'Fora do PvE do mapa a poção é por <b>limiar de vida</b>: no PvP a cura é 30% e a exaustão é 6 s, e nas dungeons e na Arena a cura das habilidades cai.') + '</p>'
      + '<div class="kvs">'
      + kv('modo efetivo', inteligente ? 'inteligente (PvE)' : 'limiar de vida')
      + kv('última ação', ultima ? esc(ultima.reason || ultima.k || '-') : '-')
      + kv('poções agora', ORDER.map((k) => POCAO_NOME[k] + ' ' + fmt((pot && pot[k]) || 0)).join(' · '))
      + '</div>'
      + '<p class="diag-t">Gatilho de cada poção (regra simples, por vida perdida)</p>'
      + ORDER.map((k) => '<div class="ctl"><div class="ctl-l"><b>' + POCAO_NOME[k] + ' (cura ' + fmt(((function () { try { return (ler('pocaoInfo', {}, k) || {}).cura || 0; } catch (e) { return 0; } })())) + ')</b><small id="ap-pc-t-' + k + '">-</small></div>'
        + '<div class="ctl-c"><label class="tg" style="padding:3px 7px"><input type="checkbox" id="ap-pc-on-' + k + '"><span class="sw"></span></label>'
        + '<input type="number" id="ap-pc-v-' + k + '" min="0" step="1">'
        + '<select id="ap-pc-m-' + k + '"><option value="pct">% da vida perdida</option><option value="lost">vida perdida (valor)</option></select></div></div>').join('')
      + linha('Mínimo na mochila (repor na base)', 'quando desce abaixo disto, a automação volta à Fonte para comprar',
        ORDER.map((k) => '<span class="hint">' + POCAO_NOME[k] + '</span><input type="number" id="ap-min-' + k + '" min="0" style="width:64px" value="' + esc(minP[k]) + '">').join(' '))));
    sincronizarPocao();
  }

  // ---------------------------------------------------------------- MANUAL
  function renderManual() {
    renderAuto();
    setHtml('ap-manual-info', card('Atalhos para as ações manuais', 'o que fica em cada aba',
      '<p class="hint tira">Estas ações <b>não</b> são necessárias para o auto-play. Use só para forçar, medir ou corrigir.</p>'
      + '<div class="acoes">'
      + '<button class="btn sec" id="ap-goto-itens">🧰 Itens e cofre</button>'
      + '<button class="btn sec" id="ap-goto-mercado">💰 Mercado e Ornn</button>'
      + '<button class="btn sec" id="ap-goto-personagem">🧠 Habilidades e atributos</button>'
      + '</div>'
      + '<p class="hint tira">A lista completa de forçar/medir está logo abaixo.</p>'));
  }

  // ---------------------------------------------------------------- AJUDA
  let ajudaConstruida = false;
  function renderAjuda() {
    if (ajudaConstruida) return;
    ajudaConstruida = true;
    const macro = [
      ['1. Ler o estado', 'saber onde você está e como você está', 'Lê a vida (a barra é a verdade), o local, as poções, as habilidades, a mochila e o ouro.', 'a cada 1 s'],
      ['2. Combate', 'matar sem morrer', 'Use a habilidade pronta de maior dano e a poção certa para o GOLPE que o monstro acabou de dar (nunca por média).', 'em luta'],
      ['3. Farmar mobs', 'ganhar ouro e xp', 'Escolhe a região com melhor ganho real e o conjunto de itens de FARM (medido, não teórico).', 'sem chefe'],
      ['4. Chefe', 'matar o chefe da região', 'Use o conjunto de CHEFE; se a luta é impossível, foge (tecla B) em vez de morrer.', 'quando o chefe nasce'],
      ['5. Decidir base', 'só voltar quando compensa', 'Volta à Fonte se a mochila encheu, há tarefa pronta, há lixo para vender, você ficou sem tarefa há 5 min ou as poções estão baixas.', 'a cada 5 s'],
      ['6. Rotina de base', 'limpar, repor, organizar', 'Lojista (vende o lixo) → Mercado (reanuncia) → curar → repor poções → cofre → tarefas/diárias → atributos → melhor item.', 'ao chegar à Fonte'],
      ['7. Voltar ao farm', 'escolher o melhor lugar', 'Calcula a melhor região outra vez e viaja para lá.', 'depois da base'],
    ];
    const glossario = [
      ['Auto-play', 'A automação que joga por você: escolhe a região, luta, usa poções, volta à base e organiza o inventário.'],
      ['Auto-poção', 'Só a parte das poções: usa a mais fraca que chega para você sobreviver, em vez de gastar sempre a Suprema.'],
      ['Switch pai (hierarquia)', 'Os switches estão em ÁRVORE: o auto-play é o mestre e cada um depende de outro. Desligar um pai fecha tudo o que está por baixo dele, a aba Painel mostra quem manda em quem, indentado.'],
      ['Skippado (exceção)', 'O switch está ligado mas a automação não age naquele sítio. Exemplo: no mapa de Runeterra a automação não vende nem mexe no cofre.'],
      ['Mob', 'Monstro comum do mapa.'],
      ['Chefe', 'Monstro forte da região; ao ser derrotado fecha o ciclo.'],
      ['Ciclo', 'Uma passagem completa: farmar mobs na região até matar o chefe.'],
      ['Região ideal', 'A que dá mais ganho para o seu nível, considerando se sobrevives ao chefe.'],
      ['Build ideal', 'Os 5 melhores itens para o seu campeão, calculados pela automação a partir dos stats e das passivas.'],
      ['Qualidade (C, B, A, S, SS)', 'Quanto melhor o item é. C é o mais fraco, SS o melhor. A partir de A a automação não vende nem desmancha.'],
      ['Refino (+1, +2, +3)', 'Melhoria no Ornn que aumenta os stats do item. Acima de +2 pode descer se falhar.'],
      ['Tier / "abaixo de A"', 'Qualidade inferior a A, são estes os itens que a automação vende ou anuncia.'],
      ['Blindado / protegido', 'Item que a automação NUNCA vende: Rabadon, os lendários da sua build ideal e o que está equipado em S/SS.'],
      ['Espólio', 'Material que cai dos monstros e que se vende ou se usa em receitas.'],
      ['Cofre', 'Arca da Tesoureira (Fonte) ou do Burrinho (cidade) para guardar itens sem gastar espaço na mochila. Só abre nesses sítios, mas o painel mostra sempre a última leitura que a automação gravou, mesmo que estejas farmando longe.'],
      ['Mercado', 'Venda a outros jogadores. A automação anuncia a ~90% do preço mais baixo.'],
      ['Ornn', 'NPC que monta itens a partir de peças. É uma aposta: ~1,2% por tentativa.'],
      ['Poção Suprema / Forte / Normal', 'As três poções de vida: curam 2200, 900 e 300.'],
      ['DPS', 'Dano por segundo.'],
      ['Calibrar', 'Corrigir as previsões da automação comparando com o que realmente aconteceu.'],
      ['Previsão teórica vs. medida', 'Teórica = calculada com fórmulas. Medida = o que o jogo realmente deu. A medida manda.'],
      ['Giro', 'Testar várias regiões seguidas, alguns minutos em cada, para medir ganhos reais.'],
      ['Pausado x Desligado', 'Pausar congela as ações e continua medindo: Retomar volta do mesmo ponto. Desligar (ou Parar tudo) limpa o estado ativo, prazos, testes, farm forçado, e ao religar a automação começa do zero.'],
      ['Switch mestre x capacidade', 'O switch Tudo (auto-play) faz a automação jogar. As capacidades (vender, equipar, cofre, rotação…) são switches independentes: ligar uma não liga o mestre, e com o mestre desligado elas ficam inertes (ligadas, sem agir).'],
    ];
    const corpo = $('ap-aj-corpo');
    if (!corpo) return;
    corpo.innerHTML = ''
      + '<h4>Como usar (3 passos)</h4>'
      + '<p>1. Passe o mouse sobre o <b>seu nome</b> no canto superior direito do jogo (ou aperte <b>F8</b>, ou o botão <b>⚙ Auto-play</b>).</p>'
      + '<p>2. Ligue o switch <b>Tudo (auto-play)</b> no topo. A automação começa a farmar sozinho; os switches de baixo dizem o que ele pode fazer, cada um por si.</p>'
      + '<p>3. Se algo parecer estranho, abra a aba <b>Painel</b>: está lá escrito, em português, o que a automação está fazendo e o que está travando.</p>'
      + '<h4>Ordem do auto-play (o ciclo)</h4>'
      + macro.map((m) => '<div class="macro"><b>' + m[0] + '</b> <span class="muted">· ' + m[1] + '</span><br>' + m[2] + '<br><span class="muted">quando: ' + m[3] + '</span></div>').join('')
      + '<p>O passo <b>7</b> volta ao <b>1</b>: é um ciclo. Nenhum passo existe sozinho.</p>'
      + '<h4>Glossário, o que querem dizer as palavras</h4>'
      + '<dl>' + glossario.map((g) => '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>').join('') + '</dl>'
      + '<h4>O que a GUI é (e o que não é)</h4>'
      + '<p>Esta janela é para <b>coisas automáticas</b>: o que está acontecendo, o que a automação vai fazer, o que está bloqueado e os <b>switches</b> que ligam e desligam cada capacidade. O que você mesmo faz no jogo com um clique (vender, curar, comprar, subir habilidade) fica no fim do Painel, em <b>Manutenção manual</b>, serve para forçar ou medir, não é o caminho normal.</p>'
      + '<h4>Botões de segurança</h4>'
      + '<p><b>O botão grande</b> (topo) faz sempre o próximo passo a partir do estado de agora: <b>▶ Ligar auto-play</b> (observação → ligado), <b>⏸ Desligar</b> (ligado → observação), <b>▶ Retomar</b> (pausado → ligado) ou <b>▶ Religar</b> (desligado → ligado). O rótulo diz o que vai mudar.</p>'
      + '<p><b>⏸ Pausar</b> congela as ações e continua medindo; <b>⛔ Parar tudo</b> limpa o estado ativo e fica gravado no navegador até você religar.</p>'
      + '<p><b>📌</b> fixa o painel aberto (sem isso ele fica aberto até você fechar). <b>Esc</b> ou <b>✕</b> fecha.</p>';
  }

  // ---------------------------------------------------------------- DISPATCH DE REDESENHO
  /** REGRA DO DONO (2026-10-20): as acções de JOGO manuais (as que têm o selo `manual`, criadas
   *  por `acaoD`) existem SÓ na aba Manual. Cada aba desenha-as no seu cartão; aqui são movidas
   *  para `#ap-manual-dinamicas`, agrupadas pelo título do cartão de origem. Os handlers são
   *  delegados por id, logo mover o nó não quebra o clique. A ação nova substitui a cópia velha
   *  do mesmo id (evita duplicados quando a aba de origem volta a desenhar). */
  function recolherAcoesManuais() {
    const alvo = $('ap-manual-dinamicas'); if (!alvo) return;
    const panes = Array.from(document.querySelectorAll('#lolidle-ap .pane')).filter((p) => p.id !== 'ap-t-manual');
    for (const p of panes) {
      for (const a of Array.from(p.querySelectorAll('.acao'))) {
        if (!a.querySelector('.tagd')) continue;                 // só as manuais de JOGO
        const btn = a.querySelector('button');
        const id = btn && btn.id;
        if (id) {
          const velho = Array.from(alvo.querySelectorAll('button')).find((b) => b.id === id);
          if (velho) {
            const ga = velho.closest('.acao'); if (ga) ga.remove();
          }
        }
        const cardEl = a.closest('.card');
        const h3 = cardEl && cardEl.querySelector('h3');
        const titulo = h3 ? String((h3.childNodes[0] && h3.childNodes[0].textContent) || h3.textContent || '').trim() : (p.id || 'Ações');
        let grupo = Array.from(alvo.children).find((g) => g.dataset.titulo === titulo);
        if (!grupo) {
          grupo = document.createElement('div');
          grupo.className = 'mgrupo'; grupo.dataset.titulo = titulo;
          grupo.innerHTML = '<p class="diag-t">' + esc(titulo) + '</p><div class="acoes"></div>';
          alvo.appendChild(grupo);
        }
        const grade = grupo.querySelector('.acoes');
        if (grade) grade.appendChild(a); else grupo.appendChild(a);
      }
    }
    Array.from(alvo.children).forEach((g) => { if (!g.querySelector('.acao')) g.remove(); });
  }
  // ---------------------------------------------------------------- ABA MACRO
  /** Detalhes de cada rotina. Tudo o que se configura vive aqui; a árvore de switches
   *  tem um ⚙ que leva ao bloco certo. Nada nesta aba é ação manual do jogo. */
  function renderMacro() {
    const c = cfg();
    const rota = c.rotaFarm || null;
    // ---------- O LOOP (o que se repete, e em que passo está) ----------
    const fAtual = (farm() || {}).current || {};
    const ciclos = ((farm() || {}).cycles || []).length;
    setHtml('ap-macro-loop', card('O loop do macro', 'as rotinas repetem enquanto o switch estiver ligado',
      '<div class="kvs">'
      + kv('fase agora', esc(fAtual.fase || 'fora do farm'))
      + kv('região', esc(limparNivel(fAtual.region || '-') || '-'))
      + kv('ciclos medidos', fmt(ciclos))
      + kv('auto-play', c.enabled ? 'ligado' : 'desligado')
      + '</div>'
      + '<div class="lista">'
      + '<div class="ln"><b>1</b><span class="d">escolhe a região (rota, região fixa, ou a melhor para o objetivo)</span></div>'
      + '<div class="ln"><b>2</b><span class="d">viaja e farma; a barra de skills e a build alternam por fase</span></div>'
      + '<div class="ln"><b>3</b><span class="d">chefe detetado e perigoso: volta à Fonte antes de morrer</span></div>'
      + '<div class="ln"><b>4</b><span class="d">na base trata o que falta (vender, repor, cofre, tarefa, mercado)</span></div>'
      + '<div class="ln"><b>5</b><span class="d">sem nada pendente, volta a farmar (ou à região ideal, no modo auto)</span></div>'
      + '</div>'
      + '<p class="hint tira">O loop não para: cada passo só corre quando a sua condição aparece. A POÇÃO é a excepção, corre a cada segundo.</p>'));

    // ---------- PARÂMETROS: valor ACTUAL ao lado do RECOMENDADO ----------
    const rec = { idleBaseMs: 20000, curaAbaixo: 45, margemChefe: 70, mobHpMinRel: 15, barraCadenciaMs: 2, fugirMs: 30 };
    const campoNum = (id, rot, val, recom, passo, min, max, nota) => '<label class="campo">' + esc(rot)
      + '<input id="' + id + '" type="number" step="' + passo + '" min="' + min + '" max="' + max + '" value="' + esc(val) + '" placeholder="' + esc(recom) + '">'
      + '<small class="hint">atual ' + esc(val) + ' · recomendado ' + esc(recom) + (nota ? ' · ' + esc(nota) : '') + '</small></label>';
    setHtml('ap-macro-params', card('Parâmetros do loop', 'o valor em uso e o recomendado; edite e grave',
      '<div class="grid2">'
      + campoNum('ap-mp-fuga', 'Fuga: espera entre fugas (s)', Math.round(Number(c.fugirMs || 30000) / 1000), rec.fugirMs, 5, 5, 600, 'evita ping-pong')
      + campoNum('ap-mp-idle', 'Paragem na Fonte sem nada a fazer (s)', Math.round(Number(c.idleBaseMs || 20000) / 1000), rec.idleBaseMs / 1000, 5, 5, 600, 'só para fechar janelas')
      + campoNum('ap-mp-cura', 'Curar na Fonte abaixo de (% vida)', Math.round(Number(c.curaAbaixo != null ? c.curaAbaixo : 0.45) * 100), rec.curaAbaixo, 5, 5, 95, 'acima disto a poção trata')
      + campoNum('ap-mp-margem', 'Margem da luta de chefe (% vida)', Math.round(Number(c.margemChefe != null ? c.margemChefe : 0.70) * 100), rec.margemChefe, 5, 10, 100, 'abaixo disto o chefe mata')
      + campoNum('ap-mp-mobs', 'Vida mínima dos mobs (% vida)', Math.round(Number(c.mobHpMinRel != null ? c.mobHpMinRel : 0.15) * 100), rec.mobHpMinRel, 5, 0, 100, 'abaixo disto os mobs matam')
      + campoNum('ap-mp-barra', 'Reavaliar a barra de skills (s)', Math.round(Number(c.barraCadenciaMs || 2000) / 1000), rec.barraCadenciaMs, 1, 1, 60, 'não clica se o alvo não mudar')
      + '</div>'
      + '<div class="acoes">'
      + acao('ap-macro-salvar', 'Gravar parâmetros', 'Aplica os seis valores. Vazio = fica o recomendado.')
      + acao('ap-macro-recomendado', 'Voltar ao recomendado', 'Repõe os seis valores recomendados (sem mexer nos switches).', 'sec')
      + '</div>'
      + '<p class="hint tira">Valores de política, não do jogo: o recomendado é o que a automação usou nas medições. Mudar a margem do chefe muda o que conta como "mata você".</p>'));
    // ---------- FARM: objetivo, alvos e ROTA ----------
    const alvos = Array.from(selItens || []);
    // SÓ REGIÕES DE FARM DO RIFT na rota (ordem do dono): a mesma função do motor, sem cópia.
    const validaRota = (id) => {
      try {
        const l = (locais() || []).find((x) => String(x.id) === String(id));
        return !!(l && ler('ehRegiaoDeFarm', null, l));
      } catch { return false; }
    };
    const passosRota = (rota && Array.isArray(rota.passos)) ? rota.passos : [];
    const passosOk = passosRota.filter((p) => validaRota(p.regiao));
    const invalidos = passosRota.filter((p) => !validaRota(p.regiao));
    const rotaHtml = passosOk.length
      ? '<div class="lista">' + passosOk.map((p, i) => '<div class="ln ' + (rota.ativa && i === (Number(rota.indice) || 0) ? 'proteg' : '') + '">'
        + '<b>' + (i + 1) + '. ' + esc(limparNivel(p.nome || p.regiao)) + '</b><span class="d">' + esc(p.motivo || '')
        + (p.tipo === 'cartas' ? ' · ' + (p.minutos || 30) + ' min' : '')
        + (p.alvos && p.alvos.length ? ' · ' + esc(p.alvos.map((x) => nomeItem(x.item) + (x.dropsH ? ' (' + fmt1(x.dropsH) + '/h)' : '')).join(', ')) : '') + '</span></div>').join('') + '</div>'
        + '<p class="hint">' + (rota.ativa ? 'A seguir o passo ' + ((Number(rota.indice) || 0) + 1) + '.' : 'Rota parada' + (rota.parou ? ': ' + esc(rota.parou) : '') + '.') + '</p>'
      : '<p class="vazio">Ainda sem rota.</p>';
    const invalidosHtml = invalidos.length
      ? '<p class="aviso warn">Rota guardada tem ' + invalidos.length + ' passo(s) fora das regiões de farm do Rift ('
        + esc(invalidos.map((p) => limparNivel(p.nome || p.regiao)).join(', ')) + '). Esses passos são ignorados.</p>'
      : '';
    const ideais = buildIdeal();
    const sugestao = ideais.length
      ? '<p class="hint tira">Sugestão (build ideal): ' + esc(ideais.map((b) => nomeItem(b)).join(', ')) + '. Use <b>Escolher itens</b> na aba Farm para marcar outros.</p>'
      : '<p class="hint tira">Sem campeão carregado: a build ideal aparece quando o jogo entregar o campeão. Pode marcar itens à mão na aba Farm.</p>';
    setHtml('ap-macro-farm', card('Rota de farm (itens e cartas)', 'calculada com os drops do jogo e guardada',
      rotaHtml
      + invalidosHtml
      + '<div class="kvs">'
      + kv('alvos marcados', alvos.length ? esc(alvos.map((b) => nomeItem(b)).join(', ')) : 'nenhum')
      + kv('itens ideais', ideais.length ? esc(ideais.length + ' (build do campeão)') : '-')
      + '</div>'
      + sugestao
      + '<label class="campo" style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="ap-rota-cartas"> incluir uma paragem para cartas</label>'
      + '<div class="acoes">'
      + acao('ap-rota-montar', 'Montar e seguir', alvos.length ? 'Usa os itens marcados (aba Farm) mais a paragem de cartas e viaja para o 1.º passo.' : 'Sem itens marcados usa a BUILD IDEAL do campeão: a rota vai às regiões que dropam esses itens.')
      + acao('ap-rota-parar', 'Parar a rota', 'Pára a rota e volta a escolher a região sozinha.', 'sec', !(rota && rota.ativa))
      + acao('ap-rota-limpar', 'Limpar rota guardada', 'Apaga a rota guardada (incluindo passos velhos de outra versão). A automação volta ao modo automático.', 'sec', !passosRota.length)
      + '</div>'
      + '<p class="hint tira">Uma rota é uma lista de regiões: cada passo é a região que mais dropa o item pedido (chance × abates/hora). A missão do Capitão é trocada para a área da rota quando há uma oferta lá.</p>'));

    // ---------- CARTAS ----------
    const cb = ler('cartasNaBolsa', null) || { novas: 0, lista: [] };
    const eq = ler('readEquip', []) || [];
    const livres = eq.filter((e) => !e.carta).length;
    const melhor = (() => { try { const m = ler('melhorCartaDisponivel', null, cb.lista); return m; } catch { return null; } })();
    setHtml('ap-macro-cartas', card('Cartas', 'abrir as misteriosas e encaixar a melhor',
      '<div class="kvs">'
      + kv('misteriosas', fmt(cb.novas))
      + kv('na bolsa', fmt(cb.lista.reduce((s, x) => s + (Number(x.qtd) || 0), 0)))
      + kv('itens sem carta', fmt(livres))
      + '</div>'
      + (cb.lista.length ? '<div class="chips">' + cb.lista.slice(0, 12).map((x) => '<span class="chip">' + esc(x.nome || x.id) + ' <small>×' + fmt(x.qtd) + '</small></span>').join('') + '</div>' : '<p class="vazio">Nenhuma carta revelada.</p>')
      + '<p class="hint">A melhor para o seu campeão agora: <b>' + esc(melhor ? (melhor.nome || melhor.id) : 'nenhuma') + '</b></p>'
      + '<div class="acoes">'
      + acao('ap-cartas-abrir', 'Abrir cartas misteriosas', 'Abre todas. Dá em qualquer sítio e é grátis.', 'sec', cb.novas < 1)
      + acao('ap-cartas-encaixar', 'Encaixar no Ornn', 'Encaixa uma carta em cada item equipado sem carta. Só na Fonte.', 'sec', !livres || !cb.lista.length)
      + '</div>'));

    // ---------- MERCADO: resumo dos detalhes (o editor completo está na aba Mercado) ----------
    const w = (c.mercadoWatch || {});
    const itens = Array.isArray(w.itens) ? w.itens : [];
    const lim = w.limites || {};
    setHtml('ap-macro-mercado', card('Watch do mercado', 'itens, limites e jogadores',
      (itens.length ? '<div class="chips">' + itens.map((b) => '<span class="chip">' + esc(nomeItem(b)) + ' <small>' + (Number(lim[b]) > 0 ? 'até ' + fmt(lim[b]) : 'teto global') + '</small></span>').join('') + '</div>' : '<p class="vazio">Nenhum item vigiado.</p>')
      + '<p class="hint">Comprar de: <b>' + (String(w.filtroVendedores || 'so') === 'qualquer' ? 'qualquer jogador' : 'só dos jogadores listados') + '</b>'
      + (Array.isArray(w.vendedores) && w.vendedores.length ? ' (' + esc(w.vendedores.join(', ')) + ')' : '') + '.</p>'
      + '<div class="acoes">' + acao('ap-goto-mercado', 'Abrir o Mercado', 'Editar itens, limites, jogadores e a compra da build.') + '</div>'));

    // ---------- CONFIGURAÇÃO REAL DE CADA SWITCH (ordem do dono, 2026-10-23) ----------
    // Queixa, verbatim: *"o pop up de cada switch ao clicar no botao dele tem que ser a mesma
    // pagina de configuracao daquele switch. nao só uma info."* Os cartões abaixo são páginas de
    // CONFIGURAÇÃO (escrevem `cfg` pela automação), não resumos. O ⚙ da árvore abre-os no popup.
    renderCfgBase();
    renderCfgRepor();
    renderCfgAnunciar();
    renderCfgComprar();
  }

  /** Entrada numérica compacta para os cartões de configuração. */
  const inpNum = (id, valor, passo) =>
    '<input class="num" type="number" id="' + id + '" value="' + esc(valor == null ? '' : valor) + '" min="0" step="' + (passo || 1) + '">';
  const inpSel = (id, opcoes, valor) =>
    '<select id="' + id + '">' + opcoes.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(valor) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';

  /** ROTINA DE BASE: os interruptores que a rotina usa + os dois limiares que ela lê. */
  function renderCfgBase() {
    const c = cfg();
    setHtml('ap-cfg-base', card('Rotina de base', 'o que a automação faz sozinho quando vai à Fonte',
      tgCfg('ap-cbase-equip', 'autoEquip', 'Equipar a melhor peça de cada slot', '', c.autoEquip !== false)
      + tgCfg('ap-cbase-refino', 'autoRefino', 'Refinar no Ornn', '', !!c.autoRefino)
      + tgCfg('ap-cbase-montar', 'autoMontar', 'Montar item no Ornn', '', !!c.autoMontar)
      + tgCfg('ap-cbase-atrib', 'autoAtrib', 'Distribuir pontos de atributo', '', !!c.autoAtrib)
      + linha('vender ao lojista até ao nível', '', inpNum('ap-cbase-inicio', c.inicioJogoAteNivel, 1))
      + linha('voltar à Fonte para curar abaixo de', '', inpSel('ap-cbase-cura', [['0.35', '35%'], ['0.45', '45%'], ['0.6', '60%'], ['0.75', '75%']], String(c.curaAbaixo == null ? 0.45 : c.curaAbaixo)))
      + '<p class="hint">Acima do nível de venda o Lojista só serve para DESPEJO (lixo), não é receita. A cura na Soraka só vale a viagem abaixo deste limiar.</p>'));
  }

  /** REPOR POÇÕES: mínimo por tipo e quanto comprar. As duas chaves já existiam na automação
   *  (`minPotion`/`buyPotion`) e a GUI não as escrevia por um cartão próprio - o dono não tinha onde. */
  function renderCfgRepor() {
    const c = cfg(); const mp = c.minPotion || {}; const bp = c.buyPotion || {};
    setHtml('ap-cfg-repor', card('Repor poções', 'quantas manter na mochila e quanto comprar no Lojista',
      '<p class="hint tira"><b>Mínimo</b> = quando a base vai repor. <b>Comprar até</b> = quanto fica na mochila depois de repor.</p>'
      + linha('mínimo · vida', '', inpNum('ap-min-vida', mp.vida, 50))
      + linha('mínimo · forte', '', inpNum('ap-min-vidaF', mp.vidaF, 50))
      + linha('mínimo · suprema', '', inpNum('ap-min-vidaS', mp.vidaS, 10))
      + linha('comprar até · vida', '', inpNum('ap-buy-vida', bp.vida, 50))
      + linha('comprar até · forte', '', inpNum('ap-buy-vidaF', bp.vidaF, 50))
      + linha('comprar até · suprema', '', inpNum('ap-buy-vidaS', bp.vidaS, 10))
      + '<p class="hint">A poção de mana não se repõe: não há poção de mana no Lojista.</p>'));
  }

  /** ANUNCIAR NO MERCADO: o desconto e o teto de qualidade passam a ser escolha do dono
   *  (eram um 0,90 e um `'A'` cravados no código). */
  function renderCfgAnunciar() {
    const c = cfg();
    setHtml('ap-cfg-anunciar', card('Anunciar no mercado', 'o que vai à venda e por quanto',
      linha('desconto sobre o menor preço', '', inpSel('ap-anun-desc', [['0.80', '80%'], ['0.85', '85%'], ['0.90', '90%'], ['0.95', '95%']], String(c.anuncioDesconto == null ? 0.90 : c.anuncioDesconto)))
      + linha('anunciar qualidade abaixo de', '', inpSel('ap-anun-qual', [['B', 'B (só C)'], ['A', 'A (B e C)'], ['S', 'S (A, B e C)'], ['SS', 'SS (todos menos SS)']], String(c.anuncioQualMax || 'A')))
      + linha('preço sem comparável (tier A)', '', inpNum('ap-anun-piso', c.precoSemComparavel, 100000))
      + linha('piso do Gume do Infinito', '', inpNum('ap-anun-gume', (c.precoSemComparavelPorBase || {})['3031'], 100000))
      + '<p class="hint">Tier S+ e os lendários da build NUNCA são anunciados, nem duplicados. O preço compara sempre com a MESMA qualidade primeiro.</p>'));
  }

  /** COMPRAR NO MERCADO = um switch só (build + vigia). Aqui ficam os limites de gasto, que é o
   *  que o dono configurava à mão no JSON. */
  function renderCfgComprar() {
    const c = cfg(); const w = c.mercadoWatch || {};
    setHtml('ap-cfg-comprar', card('Comprar no mercado', 'build e vigia: um switch e os limites de gasto',
      linha('qualidade mínima da build', '', inpSel('ap-cbuy-tier', [['A', 'A (ou melhor)'], ['S', 'S (ou melhor)']], String(c.compraMinTier || 'A')))
      + linha('qualidade mínima da vigia', '', inpSel('ap-cbuy-wtier', [['A', 'A (ou melhor)'], ['S', 'S (ou melhor)'], ['SS', 'só SS']], String(w.tierMin || 'A')))
      + linha('gastar até (% do ouro)', '', inpNum('ap-cbuy-pct', w.percentualOuro, 5))
      + linha('teto por oferta (ouro)', '', inpNum('ap-cbuy-max', w.precoMax, 10000))
      + '<p class="hint">Itens e jogadores da vigia configuram-se na aba <b>Mercado</b>. O Gume do Infinito e o que você marcou como "nunca comprar" ficam de fora.</p>'));
  }

  function renderTudo() {
    // O render NÃO depende de o painel estar aberto: ele corre no arranque e nos segundos
    // seguintes (ver o arranque). Um portão de cadência aqui deixaria os blocos no placeholder
    // inicial até alguém abrir o painel. O gate de cadência vive só no `tick()` (que continua
    // a não fazer nada com o painel fechado).
    renderCabecalho();
    renderAgora();                                       // "agora" alimenta Painel e Manual
    if (tabAtiva === 'painel') renderPainel();
    else if (tabAtiva === 'farm') { renderFarmModo(); renderFarmItens(); renderFarmObjetivo(); renderFarm(); }
    // A ABA MACRO TEM DE DESENHAR OS SEUS BLOCOS (defeito medido 2026-10-23 pela prova por aba:
    // `ap-auto-base` e `ap-build-fase` vivem no painel da Macroe so eram escritos quando as abas
    // Painel/Itens estavam activas; na Macro apareciam VAZIOS.
    else if (tabAtiva === 'macro') { renderMacro(); renderAuto(); renderBuildFase(); }
    else if (tabAtiva === 'itens') { renderBuildFase(); renderBuildResumo(); renderItens(); }
    else if (tabAtiva === 'mercado') renderMercado();
    else if (tabAtiva === 'personagem') { renderSkills(); renderAtrib(); }
    else if (tabAtiva === 'ganhos') { renderFarm(); renderChefes(); renderHistorico(); }
    else if (tabAtiva === 'pocao') renderPocao();
    else if (tabAtiva === 'manual') renderManual();
    recolherAcoesManuais();
  }
  /** A aba 1 é um PAINEL DE CONTROLE: junta o "agora" (o que está acontecendo) com os switches.
   *  São dois desenhadores que escrevem em ids diferentes - juntam-se aqui em vez de reescrever
   *  código que já funciona. O bloco grande da build por fase NÃO entra: ele vive na aba Itens
   *  e aqui fica só o resumo de uma linha (renderBuildResumo). */
  function renderPainel() { renderPainelEstado(); renderAuto(); }
  // Cadência por aba: a do Painel acompanha o HUD (o content.js publica a vida a cada 1 s e
  // `estadoAgora()` tem cache de 2 s; o resto do painel lê caches de 10 s/15 s da automação). As abas
  // de relatório são mais lentas porque recalculam listas grandes.
  const CADENCIA = { painel: 1500, farm: 6000, macro: 5000, itens: 8000, mercado: 5000, personagem: 3000, ganhos: 8000, pocao: 3000, manual: 15000 };
  function tick() {
    if (!aberto) return;
    renderCabecalho();                                   // o cabeçalho é sempre o primeiro a saber
    const ms = CADENCIA[tabAtiva] || 5000;
    if (Date.now() - ultimoRender >= ms) { ultimoRender = Date.now(); renderTudo(); }
  }

  // ============================================================ 6. AÇÕES
  // Todas as ações passam por executar(): confirmação (quando destrutivas) → "rodando" → resposta.
  // Nenhuma ação falha em silêncio: o motivo aparece sempre no rodapé.

  const selItens = new Set();
  let itemFiltro = 'todos';

  // ---- config: ligar/desligar, toggles, objetivo, região ---------------------
  function definirLigado(on) {
    const r = chamar('setConfig', { enabled: !!on });
    if (!r.ok) salvarTopo({ enabled: !!on });     // motor ausente: escreve na mesma (a automação lê do storage)
    cacheAgora = { at: 0, v: null };
    renderCabecalho();
    renderPainelEstado();                        // o estado mudou: o cartão de controle sabe já
    if (tabAtiva === 'painel') renderArvore();   // o mestre manda na árvore
    return r.ok;
  }
  function salvarTopo(patch) {
    try {
      chrome.storage.local.get(STORAGE_KEY, (res) => {
        const cur = (res && res[STORAGE_KEY]) || {};
        chrome.storage.local.set({ [STORAGE_KEY]: Object.assign({}, cur, patch) });
      });
    } catch (e) { /* sem storage */ }
  }
  const definirCfg = (patch) => {
    const r = chamar('setConfig', patch);
    cacheAgora = { at: 0, v: null };
    if (r.ok && tabAtiva === 'painel') renderArvore(); // a árvore mostra a config: não pode ficar velha
    return r.ok;
  };

  /** Liga/desliga UM switch da ÁRVORE. Escreve SEMPRE pela automação (`setConfig`), com a chave
   *  que o própria automação declarou (`cfg`) - a GUI não conhece nem inventa chaves de configuração. */
  function alternarInterruptor(nome, chave, ligado) {
    const legivel = ARV_NOME[nome] || nome;
    // Sem chave = versão antiga: NÃO se escreve nada (não há chave para escrever) e diz-se o erro.
    if (!chave) { fbAviso(legivel + ' não tem chave própria na automação desta página, nada foi mudado. Recarregue (F5).'); return; }
    const patch = {}; patch[chave] = !!ligado;
    const r = chamar('setConfig', patch);
    if (!r.ok) {
      // Nada foi escrito na automação: obriga a redesenhar para o clique NÃO ficar "preso" na tela
      // (o setHtml não volta escrevendo um HTML igual, e o checkbox ficaria mentiroso).
      _ultimoHtml.delete('ap-auto-arvore');
      renderArvore();
      fbErro(legivel + ': ' + erroLegivel(r.erro, 'setConfig') + ', nada foi mudado.');
      return;
    }
    cacheAgora = { at: 0, v: null };
    cacheLimpar();
    ultimoRender = 0;
    renderCabecalho();
    renderArvore();
    fb(ligado ? 'ok' : 'info', legivel + ': ' + (ligado ? 'LIGADO.' : 'DESLIGADO, o que está por baixo dele deixa de agir.'));
  }

  /** LIGAR (de OBSERVAÇÃO para LIGADO). Não mexe nas capacidades: o que estava desligado nelas
   *  continua desligado - o mestre não liga nem desliga os filhos. */
  async function ligarAuto(btn) {
    await executar(btn, 'Ligar auto-play', async () => {
      if (estaDesligado()) chamar('religarTudo');
      definirLigado(true);
      return { ok: true, msg: 'LIGADO, farma, viaja e decide sozinho. As capacidades que você desligou continuam desligadas.' };
    });
  }
  /** DESLIGAR (de LIGADO para OBSERVAÇÃO): para as ações e LIMPA o estado ativo. */
  async function desligarAuto(btn) {
    await executar(btn, 'Desligar', async () => {
      definirLigado(false);
      chamar('limparEstadoAtivo');          // prazos, throttles, farm forçado, backoff, testes
      return { ok: true, msg: 'OBSERVAÇÃO, a automação só lê o jogo. O estado ativo foi limpo: ao religar, começa do zero.' };
    });
  }
  /** PAUSAR (só com o auto-play LIGADO): congela as ações e continua medindo. */
  async function pausarAuto(btn) {
    await executar(btn, 'Pausar', async () => {
      const r = chamar('pausar');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'pausar') };
      return { ok: true, msg: 'PAUSADO, parou de agir, mas continua medindo. Retomar devolve tudo do mesmo ponto.' };
    });
  }
  /** RETOMAR (de PAUSADO para LIGADO): volta do mesmo ponto, sem perder a medição. */
  async function retomarAuto(btn) {
    await executar(btn, 'Retomar', async () => {
      const r = chamar('despausar');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'despausar') };
      return { ok: true, msg: 'LIGADO de novo, do ponto onde parou.' + diffTexto(r.v && r.v.diff) };
    });
  }
  /** PARAR TUDO (kill): para tudo, limpa o estado ativo e PERSISTE - sobrevive ao F5. */
  async function pararTudo(btn) {
    await executar(btn, 'Parar tudo', async () => {
      definirLigado(false);
      chamar('desligarTudo', 'gui');
      return { ok: true, msg: 'DESLIGADO de vez e gravado no navegador: nem com F5 a automação volta sozinho. Use ▶ Religar.' };
    });
  }
  /** RELIGAR (de DESLIGADO para LIGADO). */
  async function religarAuto(btn) {
    await executar(btn, 'Religar', async () => {
      const r = chamar('religarTudo');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'religarTudo') };
      definirLigado(true);
      return { ok: true, msg: 'RELIGADO, a automação volta a agir (o estado ativo foi limpo quando você parou tudo).' };
    });
  }
  /** "Retomar tudo": usado pelo aviso "porque nada está acontecendo" - religa, liga e despausa. */
  async function retomarTudo(btn) {
    await executar(btn, 'Retomar tudo', async () => {
      if (estaDesligado()) chamar('religarTudo');
      definirLigado(true);
      const r = chamar('despausar');
      return { ok: true, msg: 'LIGADO de novo.' + diffTexto(r.ok && r.v && r.v.diff) };
    });
  }
  /** O que mudou no jogo enquanto a automação esteve parado (a automação devolve `diff` no `despausar`). */
  function diffTexto(d) {
    if (!d) return '';
    const bits = [];
    if (d.ouro) bits.push('ouro ' + (d.ouro > 0 ? '+' : '') + fmt(d.ouro));
    if (d.nivel) bits.push('nível ' + d.nivel);
    if (d.local) bits.push('local ' + d.local);
    if (d.segundos) bits.push('parado ' + fmtDur(d.segundos * 1000));
    return bits.length ? ' Enquanto esteve parado: ' + bits.join(' · ') + '.' : '';
  }
  /** O botão principal faz SEMPRE "o próximo passo" a partir do estado de agora. */
  function agirAuto(btn) {
    const e = estadoAuto();
    if (e === 'observacao') return ligarAuto(btn);
    if (e === 'ligado') return desligarAuto(btn);
    if (e === 'pausado') return retomarAuto(btn);
    return religarAuto(btn);
  }
  async function farmarAgora(btn) {
    await executar(btn, 'Farmar agora', async () => {
      definirLigado(true);
      // ORDEM DE SEGURANÇA (pedido do dono): a recomendação da automação já exclui região onde o
      // chefe mata. O `regiaoIdeal` é o plano de fundo; só se usa se a recomendação não existir.
      const rec = ler('recomendar', null) || {};
      const reg = (rec && rec.regiao) || ler('regiaoIdeal', null)
        || ((ler('rankRegioes', []) || []).find((r) => r && r.sobrevive === true) || {}).id || null;
      if (!reg) return { ok: false, motivo: 'a automação ainda não tem uma região com segurança provada para o seu nível. Ele precisa medir algumas regiões primeiro, deixe o auto-play ligado por um ciclo.' };
      chamar('viajarPara', reg);
      const seguro = rec && rec.sobrevive === true;
      return { ok: true, msg: 'ligado e viajando para ' + nomeRegiao(reg) + (seguro ? ' (região onde você sobrevive ao chefe).' : '.') };
    });
  }
  async function rotinaBase(btn) {
    const dg = diagBase();
    const linhas = ['Vender ao lojista o que o plano diz que é lixo (os blindados nunca são tocados).',
      'Repor poções até o mínimo, curar na Soraka e falar com o Capitão (tarefas/diárias).',
      'Guardar no cofre, anunciar lendários abaixo de A, distribuir atributos e subir habilidades.'];
    if (dg && dg.motivo) linhas.unshift('Motivo mais urgente agora: <b>' + esc(dg.motivo) + '</b>.');
    await executar(btn, 'Rotina de base', async () => {
      const r = await chamarA('acaoBase');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'acaoBase') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'a automação recusou' };
      const passos = (v.ordem || []).join(' → ') || 'nada fazendo';
      return { ok: true, msg: 'passos executados: ' + passos };
    }, { confirma: { titulo: 'Rotina de base completa', linhas: linhas, ok: 'Executar agora', perigo: false } });
  }
  const acaoSimples = (rotulo, nome, msg, conf) => async (btn) => {
    await executar(btn, rotulo, async () => resMotor(await chamarA(nome), nome, msg), conf ? { confirma: conf } : undefined);
  };

  // ---- mochila ---------------------------------------------------------------
  /** Lê a mochila. `auto` = leitura passiva (a automação lê o DOM sem abrir a bolsa): nesse caso o
   *  cartão não diz "lida há Xs", porque não houve uma leitura pedida pelo usuário. */
  function lerMochila(forcar, auto) {
    const r = chamar('scanBag', !!forcar);
    if (!r.ok) { bagLida = null; return null; }
    if (r.v) { bagLida = r.v; bagLidaEm = Date.now(); bagAuto = !!auto; }
    return bagLida;
  }

  // ---- mercados / ornn -------------------------------------------------------
  async function lerOfertas(btn) {
    await executar(btn, 'Ler as minhas ofertas', async () => {
      // `salvarOfertas` = ler + GRAVAR no storage (é o que faz a lista sobreviver ao F5 e
      // aparecer sozinha no cartão). Sem essa função (versão antiga), lê-se só para memória.
      let r = await chamarA('salvarOfertas');
      if (!r.ok && r.erro === 'sem-funcao') r = await chamarA('lerMinhasOfertas');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'salvarOfertas') };
      if (r.v == null) return { ok: false, motivo: 'o mercado não abriu, as ofertas só se lêem com o mercado acessível.' };
      ofertasCache = r.v || [];
      chamar('fecharMercado');
      await lerOfertasGravadas();
      renderMercado();
      return { ok: true, msg: ofertasCache.length ? ofertasCache.length + ' oferta(s) lidas e gravadas.' : 'você não tem ofertas no mercado.' };
    });
  }
  async function planoMercado(btn) {
    await executar(btn, 'Calcular reajuste', async () => {
      const r = await chamarA('planejarMercado');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'planejarMercado') };
      const p = r.v || {};
      window.__lolidlePlanoMercado = p;
      chamar('fecharMercado');
      const re = (p.acoes || []).filter((a) => String(a.acao || '').indexOf('reanunciar') === 0);
      setHtml('ap-mk-plano-out', re.length
        ? '<p class="aviso warn">' + re.length + ' oferta(s) para baixar de preço (mercado: ' + fmt(p.mercado) + ' · suas: ' + fmt(p.minhas) + (p.saturado ? ' · mercado cheio' : '') + ')</p>'
          + '<div class="lista">' + re.slice(0, 8).map((a) => '<div class="ln mkt"><b>' + esc(a.nome || '?') + '</b><span class="d">' + fmt(a.de) + ' → <b>' + fmt(a.para) + '</b> ouro</span></div>').join('') + '</div>'
        : '<p class="aviso ok">Nenhum reajuste necessário, os seus preços já são competitivos.</p>');
      return { ok: true, msg: re.length ? re.length + ' oferta(s) para reajustar. Veja a lista na aba.' : 'nada a reajustar.' };
    });
  }
  async function aplicarMercado(btn) {
    const p = window.__lolidlePlanoMercado;
    if (!p || !(p.acoes || []).length) { fbAviso('Calcula o reajuste primeiro (botão "Calcular reajuste").'); return; }
    const re = (p.acoes || []).filter((a) => String(a.acao || '').indexOf('reanunciar') === 0);
    await executar(btn, 'Aplicar reajuste', async () => {
      const r = await chamarA('executarMercado', p);
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'executarMercado') };
      chamar('fecharMercado');
      const v = r.v || {};
      const falhas = (v.exec || []).filter((x) => !x.feito && x.motivo);
      return { ok: true, msg: (v.reajustados || 0) + ' de ' + ((v.exec || []).length || re.length) + ' reajustadas' + (falhas.length ? ' · falhas: ' + falhas.slice(0, 2).map((x) => x.nome + ' (' + x.motivo + ')').join(', ') : '') };
    }, { confirma: { titulo: 'Aplicar reajuste de preços', linhas: re.slice(0, 8).map((a) => esc(a.nome || '?') + ': ' + fmt(a.de) + ' → <b>' + fmt(a.para) + '</b> ouro'), ok: 'Cancelar e reanunciar', perigo: true } });
  }
  async function lerOrnn(btn) {
    await executar(btn, 'Ler receitas do Ornn', async () => {
      const r = await chamarA('receitasOrnn');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'receitasOrnn') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'o Ornn não respondeu' };
      ornnCache = v.receitas || [];
      const num2 = (s) => parseInt(String(s || '').replace(/\D/g, ''), 10) || 0;
      setHtml('ap-mk-ornn-out', ornnCache.length
        ? tabela(['item', 'chance', 'tentativas em média', 'custo por tentativa', 'custo esperado', 'peças'],
          ordenarItens(ornnCache).map((x) => '<tr><td>' + esc(x.nome || x.id) + '</td><td>' + esc(x.chance || '-') + '</td><td>' + (x.tentativasMedias || '-')
            + '</td><td>' + fmt(num2(x.ouro)) + '</td><td>' + fmt(num2(x.ouro) * (x.tentativasMedias || 83)) + '</td><td>'
            + (x.pode ? '✔ você tem todas' : (x.comps || []).filter((c) => !c.tem).length + ' em falta') + '</td></tr>').join(''))
        : '<p class="aviso">O Ornn não tem receitas disponíveis agora.</p>');
      return { ok: true, msg: ornnCache.length + ' receita(s) · ' + ornnCache.filter((x) => x.pode).length + ' que você já pode montar.' };
    });
  }
  async function melhorCompra(btn) {
    await executar(btn, 'Calcular melhor compra', async () => {
      const r = await chamarA('melhorCompra');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'melhorCompra') };
      const v = r.v || {};
      const dec = v.decisao || [];
      const txt = v.resumo ? ('Decisão: <b>' + esc(v.resumo) + '</b>')
        : (v.ok === false ? esc(v.motivo || 'a automação não conseguiu ler o mercado') : 'Nada decidindo.');
      compraCache = { texto: txt };
      setHtml('ap-mk-compra-out', '<p class="aviso ok">' + txt + '</p>'
        + (dec.length ? tabela(['item', 'preço no mercado', 'o que fazer', 'espera'],
          ordenarItens(dec).map((x) => '<tr><td>' + esc(x.item || x.id) + '</td><td>' + (x.ofertaIdeal ? fmt(x.ofertaIdeal.menor) : 'sem oferta')
            + '</td><td>' + esc(x.acao || '-') + '</td><td>' + (x.esperaMin == null ? '-' : x.esperaMin + ' min') + '</td></tr>')) : '')
        + '<p class="hint tira">A automação compara comprar já, comprar um substituto mais barato, ou continuar farmando. O ouro/min usado é o que você mediu, não um valor inventado.</p>');
      return { ok: true, msg: v.resumo ? String(v.resumo) : (v.motivo || 'calculado (veja a resposta na aba).') };
    });
  }
  async function guardarCofre(btn) {
    await executar(btn, 'Guardar no cofre', async () => {
      const b = bagLida || lerMochila(false);
      if (!b) return { ok: false, motivo: 'não consegui ler a mochila (abre a bolsa no jogo uma vez e tenta outra vez)' };
      const p = ler('planBag', null, b);
      const lista = p ? (p.acts || []).filter((a2) => a2.action === 'GUARDAR_COFRE') : [];
      if (!lista.length) return { ok: true, msg: 'nada para guardar no cofre.' };
      const abriu = await chamarA('abrirCofreTesoureira');
      if (!abriu.ok) return { ok: false, motivo: erroLegivel(abriu.erro, 'abrirCofreTesoureira') };
      if (abriu.v && abriu.v.ok === false) return { ok: false, motivo: motivoCofre(abriu.v.motivo) };
      let n = 0;
      for (const a2 of lista) { const r = await chamarA('guardarNoCofre', a2.it.id); if (r.ok && r.v && r.v.ok) n++; }
      // O cofre mudou: regrava o que está lá agora - SÓ com o cofre ainda aberto, para uma
      // leitura boa nunca ser apagada por uma lista vazia.
      cacheLimpar('cofreLive');
      if (n && cofreAberto().length) chamar('salvarCofre');
      await lerCofreGravado();
      chamar('fecharMercado');
      lerMochila(true);
      return { ok: true, msg: n + ' de ' + lista.length + ' item(ns) guardado(s) no cofre.' };
    });
  }
  async function lerCofre(btn) {
    await executar(btn, 'Ler o cofre', async () => {
      // A automação já tem o fluxo completo (abre -> lê -> GRAVA -> fecha): usa-se esse, para a
      // leitura ficar gravada e o cartão continuar a mostrá-la depois de sair da base.
      let r = await chamarA('lerCofreBase');
      if (!r.ok && r.erro === 'sem-funcao') {                 // versão antiga: passo a passo
        const abriu = await chamarA('abrirCofreTesoureira');
        if (!abriu.ok) return { ok: false, motivo: erroLegivel(abriu.erro, 'abrirCofreTesoureira') };
        if (abriu.v && abriu.v.ok === false) return { ok: false, motivo: motivoCofre(abriu.v.motivo) };
        cacheLimpar('cofreLive');
        chamar('salvarCofre');
        r = { ok: true, v: { ok: true } };
      }
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'lerCofreBase') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: motivoCofre(v.motivo) };
      cacheLimpar('cofreLive');
      await lerCofreGravado();
      renderCofre();
      const n = cofreSabido().length;
      return { ok: true, msg: n ? n + ' item(ns) no cofre, a lista está no cartão.' : 'o cofre está vazio (nada guardado).' };
    });
  }
  /** Retira do cofre: `alvo` = base do item, ou null para o MELHOR que a automação conhece. */
  async function retirarCofre(btn, alvo) {
    const escolhido = alvo ? { base: alvo, nome: nomeItem(alvo) } : melhorConhecido();
    if (!escolhido) { fbAviso('Ainda não há leitura do cofre, use "Forçar leitura do cofre agora" (manutenção manual) para a automação saber o que lá está.'); return; }
    await executar(btn, 'Retirar do cofre', async () => {
      if (!cofreAberto().length) {                        // a automação só retira com o cofre ABERTO
        const abriu = await chamarA('abrirCofreTesoureira');
        if (!abriu.ok) return { ok: false, motivo: erroLegivel(abriu.erro, 'abrirCofreTesoureira') };
        if (abriu.v && abriu.v.ok === false) return { ok: false, motivo: motivoCofre(abriu.v.motivo) };
        cacheLimpar('cofreLive');
      }
      const r = await chamarA('retirarDoCofre', escolhido.base);
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'retirarDoCofre') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: motivoCofre(v.motivo) };
      // O que saiu já não está no cofre: regrava a leitura (mesma guarda do guardar).
      cacheLimpar('cofreLive');
      if (cofreAberto().length) chamar('salvarCofre');
      await lerCofreGravado();
      renderCofre();
      return { ok: true, msg: 'tirei ' + (v.nome || escolhido.nome || escolhido.base) + (v.qual ? ' [' + v.qual + (v.refino ? ' +' + v.refino : '') + ']' : '') + ' do cofre.' };
    });
  }

  // ---- habilidades / atributos ----------------------------------------------
  async function subirHabilidades(btn) {
    const sk = ler('readSkills', {}) || {};
    const n = sk.pontos || 0;
    if (!n) { fbAviso('Não há pontos de habilidade para gastar (o HUD do jogo não mostra pontos).'); return; }
    await executar(btn, 'Subir habilidades', async () => {
      const r = await chamarA('subirHabilidades');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'subirHabilidades') };
      const v = r.v || {};
      return { ok: true, msg: (v.gastos || 0) + ' ponto(s) gasto(s)' + (v.motivo ? ' (' + v.motivo + ')' : '') + '.' };
    }, { confirma: { titulo: 'Gastar ' + n + ' ponto(s) de habilidade', linhas: ['A automação desbloqueia primeiro as habilidades que faltam e depois sobe a que dá mais dano.', 'Esta ação não tem como ser desfeita.'], ok: 'Gastar pontos' } });
  }
  async function distribuirAtributos(btn) {
    const sk = ler('readSkills', {}) || {};
    const n = sk.pontosAtrib || 0;
    if (!n) { fbAviso('Não há pontos de atributo para gastar (o HUD do jogo não mostra pontos).'); return; }
    const sel = $('ap-at-modelo-sel');
    const modelo = sel ? sel.value : 'equilibrado';
    await executar(btn, 'Distribuir atributos', async () => {
      const r = await chamarA('distribuirAtributos', modelo);
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'distribuirAtributos') };
      const v = r.v || {};
      if (v.ok === false && !v.gastos) return { ok: false, motivo: 'a automação não conseguiu gastar nenhum ponto (o painel de atributos do jogo está aberto?)' };
      return { ok: true, msg: (v.gastos || 0) + ' ponto(s) distribuídos pelo modelo ' + modelo + '.' };
    }, { confirma: { titulo: 'Gastar ' + n + ' ponto(s) de atributo', linhas: ['Modelo escolhido: <b>' + esc(modelo) + '</b>.', 'Os pontos são distribuídos pelo atributo mais atrasado em relação ao peso do modelo.', 'Esta ação não tem como ser desfeita.'], ok: 'Distribuir pontos' } });
  }

  // ---- itens: escolher e planear --------------------------------------------
  const rarDe = (i) => (i && i.raridade) || 'basico';
  /** Itens do catálogo que passam no filtro e na busca. Os BÁSICOS (peças/componentes) também
  /** entram: o catálogo tem 108 itens (19 básicos, 40 épicos, 49 lendários) e qualquer um deles
  /** pode ser escolhido - quem decide é o filtro, não o código. */
  function itensFiltrados() {
    const busca = (($('ap-item-busca') || {}).value || '').toLowerCase();
    return metaItens().filter((i) => {
      if (!i || !i.id) return false;
      const rar = rarDe(i);
      if (itemFiltro !== 'todos' && rar !== itemFiltro) return false;
      if (busca && String(i.nome || '').toLowerCase().indexOf(busca) < 0) return false;
      return true;
    });
  }
  /** Grelha do modal, AGRUPADA por raridade e, dentro dela, por ESPAÇO (arma, armadura, cabeça,
   *  mão, botas, acessório). 108 itens numa lista crua são inutilizáveis; com grupos, busca e
   *  filtro de raridade encontra-se o item em segundos.
   *  Marca os itens que NÃO dropam em zona nenhuma (fora do `ondeItem` da automação): sem isso o
   *  usuário escolheria um item e não entenderia porque o plano veio vazio. */
  function renderItemGrade() {
    const itens = itensFiltrados();
    const oi = ondeItemMapa();
    const grupos = new Map();
    for (const i of itens) { const k = rarDe(i) + '|' + espacoDeItem(i); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(i); }
    const chaves = Array.from(grupos.keys()).sort((a, b) => {
      const pa = a.split('|'), pb = b.split('|');
      const dr = ORDEM_RAR.indexOf(pa[0]) - ORDEM_RAR.indexOf(pb[0]);
      return dr || (ORDEM_ESPACO.indexOf(pa[1]) - ORDEM_ESPACO.indexOf(pb[1]));
    });
    const html = chaves.map((k) => {
      const p = k.split('|'), rar = p[0], esp = p[1];
      const lista = grupos.get(k).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
      return '<div class="grp">' + esc(RAR_NOME[rar] || rar) + ' · ' + esc(espacoNome(esp)) + ' <small>(' + lista.length + ')</small></div>'
        + lista.map((i) => {
          const sem = oi ? !oi[String(i.id)] : false;
          const sel = selItens.has(String(i.id));
          const titulo = String(i.nome) + ', ' + espacoNome(esp) + (sem ? ' · NÃO dropa em zona nenhuma' : '') + (sel ? ' · escolhido' : '');
          return '<button class="frame ' + esc(rar) + (sel ? ' sel' : '') + (sem ? ' sem-drop' : '') + '" data-item="' + esc(i.id) + '" title="' + esc(titulo) + '">'
            + '<img src="' + ITEM_IMG(i.id) + '" alt="" loading="lazy" onerror="this.style.opacity=.2">'
            + (sem ? '<i class="nd">sem drop</i>' : '') + '<span>' + esc(i.nome) + '</span></button>';
        }).join('');
    }).join('');
    setHtml('ap-item-grade', html || '<p class="vazio">nada encontrado com este filtro/busca</p>');
    const s = $('ap-modal-sel'); if (s) s.textContent = selItens.size + ' escolhido(s)';
    const nota = $('ap-item-nota');
    if (nota) {
      const total = metaItens().length;
      const semN = oi ? metaItens().filter((i) => i && i.id && !oi[String(i.id)]).length : null;
      nota.textContent = total
        ? (total + ' itens no catálogo' + (semN == null ? ' · drops ainda não lidos pela automação' : ' · ' + semN + ' não dropam em zona nenhuma'))
        : 'a automação ainda não leu o catálogo do jogo';
    }
    renderChips();
  }
  /** "Farmar estes itens" (modalidade B): o plano já está à vista (renderPlanoItens); aqui só se
   *  EXECUTA - confirma, liga o auto-play, fixa a região do melhor destino e viaja. */
  async function planearItens(btn) {
    const ids = Array.from(selItens);
    if (!ids.length) { fbAviso('Escolha primeiro os itens que você quer farmar (botão "Escolher itens").'); return; }
    await executar(btn, 'Farmar estes itens', async () => {
      const plano = planoItens();
      if (plano === null) return { ok: false, motivo: erroLegivel(planoItensCache.erro, 'planejar') };
      if (!plano.length) return { ok: false, motivo: 'a automação não sabe onde estes itens dropam (catálogo incompleto?)' };
      const viaveis = plano.filter((x) => x.chefeFatal !== true);
      const alvo = (viaveis.length ? viaveis : plano).slice().sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0))[0];
      if (!alvo) return { ok: false, motivo: 'nenhum destino calculado' };
      const sim = await confirmar('Ir farmar estes itens', [
        'Destino escolhido: <b>' + esc(limparNivel(alvo.zonaNome || alvo.zona)) + '</b> para <b>' + esc(alvo.nome) + '</b>.',
        'Isto liga o auto-play e viaja já para lá.',
        viaveis.length ? '' : '⚠ Nenhuma região é segura para você: o chefe dessa zona mata, e a automação vai ficar só nos mobs.',
      ].filter(Boolean), 'Ligar e viajar');
      if (!sim) { fbAviso('Cancelado, o plano está calculado, mas não viajei.'); return { ok: true, msg: 'plano calculado (não viajei).' }; }
      definirLigado(true);
      definirCfg({ regionDefault: alvo.zona });
      chamar('viajarPara', alvo.zona);
      return { ok: true, msg: 'auto-play ligado, região fixada em ' + limparNivel(alvo.zonaNome || alvo.zona) + ' e viajando.' };
    });
  }

  // ---- teste de conjuntos ----------------------------------------------------
  let sets = [{ nome: 'atual', itens: [] }];
  function poolItens() {
    const mapa = new Map();
    const QI = (q) => ['C', 'B', 'A', 'S', 'SS'].indexOf(String(q || 'C').toUpperCase());
    const add = (id, nome, qual, refino) => {
      id = String(id || ''); if (!id) return;
      const e = mapa.get(id) || { id, nome: nome || id };
      if (qual && (!e.qual || QI(qual) > QI(e.qual))) { e.qual = qual; e.refino = refino || 0; }
      mapa.set(id, e);
    };
    const est = ler('estado', null);
    if (est) {
      for (const i of (est.itens || [])) if (i.kind === 'item') add(i.base, i.nome, i.qual, i.refino);
      for (const e of (est.equipado || [])) add(e.base, e.nome, e.qual, e.refino);
    }
    return Array.from(mapa.values()).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }
  function renderTestes() {
    const el = $('ap-tx-lista'); if (!el) return;
    const pool = poolItens();
    const fixo = pool.find((p) => p.id === RABADON);
    el.innerHTML = sets.map((s, i) => '<div class="set">'
      + '<input data-set-nome="' + i + '" value="' + esc(s.nome) + '" placeholder="nome do conjunto">'
      + [0, 1, 2, 3].map((k) => '<select data-set-slot="' + i + ':' + k + '"><option value="">, vazio, </option>'
        + pool.map((p) => '<option value="' + esc(p.id) + '"' + (String(s.itens[k]) === String(p.id) ? ' selected' : '') + '>' + esc(p.nome) + (p.qual ? ' [' + p.qual + ']' : '') + (p.refino ? '+' + p.refino : '') + '</option>').join('') + '</select>').join('')
      + '<span class="fixo">🔒 Rabadon' + (fixo ? ' [' + (fixo.qual || '?') + ']' : '') + '</span>'
      + '<button class="danger" data-set-del="' + i + '" style="padding:4px 7px">×</button></div>').join('') || '<p class="vazio">nenhum conjunto</p>';
    const reg = $('ap-tx-reg');
    if (reg && !reg.options.length) {
      const rank = ler('rankRegioes', [], 'xp') || [];
      reg.innerHTML = rank.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.nome) + '</option>').join('');
      const ideal = ler('regiaoIdeal', null); if (ideal) reg.value = ideal;
    }
    try {
      chrome.storage.local.get(TESTES_KEY, (r) => {
        const rodadas = (r && r[TESTES_KEY] && r[TESTES_KEY].rodadas) || [];
        const porC = new Map();
        for (const x of rodadas) for (const z of (x.resultados || [])) {
          const k = z.conjunto;
          if (!porC.has(k)) porC.set(k, { nome: k, equipar: z.equipar || z.itens || [], mob: [], xp: [], boss: [], dur: [] });
          const o = porC.get(k);
          if (z.mob && isFinite(z.mob.goldMin)) { o.mob.push(z.mob.goldMin); o.xp.push(z.mob.xpMin); }
          if (z.luta && isFinite(z.luta.outDps)) { o.boss.push(z.luta.outDps); o.dur.push(z.boss && z.boss.durS); }
        }
        const media = (a) => { const v = (a || []).filter((x) => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
        const lista = Array.from(porC.values()).sort((a, b) => (media(b.mob) || 0) - (media(a.mob) || 0));
        const baseDe = (x) => String(x || '').replace(/\+.*$/, '').replace(/~.*$/, '');
        setHtml('ap-tx-res', lista.length
          ? '<p class="muted">Resultados medidos (média de todas as rodadas):</p>'
            + lista.map((o) => '<div class="res"><span>' + (o.equipar || []).slice(0, 5).map((b) => '<img src="' + ITEM_IMG(baseDe(b)) + '" style="width:20px;height:20px;vertical-align:middle" alt="">').join('')
              + '</span><b>' + esc(o.nome) + '</b><span>mob <b>' + fmt(media(o.mob)) + '</b> ouro/min · <b>' + fmt(media(o.xp)) + '</b> xp/min (n=' + o.mob.length + ')'
              + '</span><span>chefe <b>' + fmt(media(o.boss)) + '</b> dano/s (n=' + o.boss.length + (o.boss.length ? ' · ' + fmt1(media(o.dur)) + 's' : '') + ')</span></div>').join('')
          : '<p class="vazio">Sem resultados ainda. Roda um teste para medir.</p>');
      });
    } catch (e) { /* sem storage */ }
    const est = ler('testeEstado', null);
    const msg = $('ap-tx-msg');
    if (msg && est) msg.textContent = 'testando "' + (est.nome || '') + '" (' + (est.i + 1) + '/' + est.total + ') em ' + limparNivel(est.regiao) + (est.matandoChefe ? ' · a matar o chefe' : ' · mobs ' + (est.mobSeg || 0) + '/' + est.mobAlvo + 's');
  }

  // ============================================================ 6b. MAPA DE AÇÕES
  const ACOES = {
    'ap-close': () => fechar(),
    'ap-goto-itens': () => setTab('itens'),
    'ap-goto-mercado': () => setTab('mercado'),
    'ap-goto-personagem': () => setTab('personagem'),
    'ap-help': () => { renderAjuda(); const m = $('lolidle-ap-ajuda'); m.hidden = false; m.classList.add('on'); },
    'ap-macro-pop-x': () => fecharMacroPopup(),
    'ap-aj-x': () => { const m = $('lolidle-ap-ajuda'); m.hidden = true; m.classList.remove('on'); },
    // CONTROLES DO AUTO-PLAY (4 estados). `ap-panic` é o botão principal: o handler decide pelo
    // estado de agora e o rótulo (renderCabecalho) diz o que vai mudar.
    'ap-panic': (b) => agirAuto(b),
    'ap-panic2': (b) => pararTudo(b),          // o kill: grava no navegador
    'ap-retomar': (b) => retomarTudo(b),
    'ap-auto-ligar': (b) => ligarAuto(b),
    'ap-auto-desligar': (b) => desligarAuto(b),
    'ap-painel-ligar': (b) => ligarAuto(b),
    'ap-painel-desligar': (b) => desligarAuto(b),
    'ap-painel-retomar': (b) => retomarAuto(b),
    'ap-painel-religar': (b) => religarAuto(b),
    'ap-painel-pausar': (b) => pausarAuto(b),
    'ap-painel-kill': (b) => pararTudo(b),
    'ap-farm-go': (b) => farmarAgora(b),
    'ap-goto-macro': () => setTab('macro'),
    'ap-rota-montar': (b) => executar(b, 'Montar a rota', async () => {
      let alvos = Array.from(selItens || []);
      // SEM itens marcados, a rota usa a BUILD IDEAL do campeão (ordem do dono: "dá opção
      // decente pra usar"). Assim o botão nunca é um beco sem saída.
      if (!alvos.length) alvos = (buildIdeal() || []).map(String);
      const cartas = !!(document.getElementById('ap-rota-cartas') || {}).checked;
      if (cartas) alvos.push('cartas');
      if (!alvos.length) return { ok: false, motivo: 'escolha pelo menos um item (ou inclua cartas) na aba Farm.' };
      const r = await chamarA('iniciarRota', alvos);
      if (!r.ok || !r.v || !r.v.ok) return { ok: false, motivo: (r.v && r.v.motivo) || r.erro || 'não consegui montar a rota.' };
      ultimoRender = 0;
      return { ok: true, msg: 'Rota montada com ' + (r.v.rota.passos.length) + ' passo(s). A seguir.' };
    }),
    'ap-rota-limpar': (b) => executar(b, 'Limpar a rota', async () => {
      let ok = true;
      try { await chamarA('pararRota', 'limpar'); } catch { ok = false; }
      const r = await chamarA('setConfig', { rotaFarm: null });
      if (!r.ok) return { ok: false, motivo: r.erro || 'não consegui limpar.' };
      ultimoRender = 0; return { ok: true, msg: 'Rota apagada. A automação volta a escolher a região sozinha.' };
    }),
    'ap-rota-parar': (b) => executar(b, 'Parar a rota', async () => {
      const r = await chamarA('pararRota', 'pedido');
      if (!r.ok) return { ok: false, motivo: r.erro || 'não consegui parar.' };
      ultimoRender = 0; return { ok: true, msg: 'Rota parada.' };
    }),
    // PARÂMETROS DO LOOP: a GUI não guarda nada por si. Os campos são convertidos para as
    // unidades da automação (ms, fração) e gravados pelo `setConfig`, que é o único escritor.
    'ap-macro-salvar': (b) => executar(b, 'Gravar parâmetros', async () => {
      const num = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const t = String(el.value == null ? '' : el.value).trim();
        if (!t) return null;
        const v = Number(t.replace(',', '.'));
        return Number.isFinite(v) ? v : null;
      };
      const patch = {};
      const fuga = num('ap-mp-fuga'); if (fuga != null) patch.fugirMs = Math.round(fuga * 1000);
      const idle = num('ap-mp-idle'); if (idle != null) patch.idleBaseMs = Math.round(idle * 1000);
      const cura = num('ap-mp-cura'); if (cura != null) patch.curaAbaixo = cura / 100;
      const marg = num('ap-mp-margem'); if (marg != null) patch.margemChefe = marg / 100;
      const mobs = num('ap-mp-mobs'); if (mobs != null) patch.mobHpMinRel = mobs / 100;
      const barra = num('ap-mp-barra'); if (barra != null) patch.barraCadenciaMs = Math.round(barra * 1000);
      if (!Object.keys(patch).length) return { ok: false, motivo: 'nada para gravar: os campos estão vazios.' };
      const r = await chamarA('setConfig', patch);
      if (!r.ok) return { ok: false, motivo: r.erro || 'a automação recusou os valores.' };
      ultimoRender = 0;
      return { ok: true, msg: 'Parâmetros gravados (' + Object.keys(patch).length + ').' };
    }),
    'ap-macro-recomendado': (b) => executar(b, 'Repor o recomendado', async () => {
      const r = await chamarA('setConfig', { fugirMs: 30000, idleBaseMs: 20000, curaAbaixo: 0.45, margemChefe: 0.70, mobHpMinRel: 0.15, barraCadenciaMs: 2000 });
      if (!r.ok) return { ok: false, motivo: r.erro || 'a automação recusou os valores.' };
      ultimoRender = 0; return { ok: true, msg: 'Valores recomendados repostos.' };
    }),
    'ap-cartas-abrir': (b) => executar(b, 'Abrir cartas', async () => {
      const r = await chamarA('abrirCartasMisteriosas');
      if (!r.ok) return { ok: false, motivo: (r.v && r.v.motivo) || r.erro || 'não consegui abrir.' };
      const v = r.v || {};
      ultimoRender = 0;
      return { ok: true, msg: v.depois === 0 ? 'Abri ' + fmt(v.antes) + ' carta(s).' : 'Abri ' + fmt((v.antes || 0) - (v.depois || 0)) + ', faltam ' + fmt(v.depois) + '.' };
    }),
    'ap-cartas-encaixar': (b) => executar(b, 'Encaixar cartas', async () => {
      const r = await chamarA('encaixarCartas');
      if (!r.ok) return { ok: false, motivo: (r.v && r.v.motivo) || r.erro || 'não consegui encaixar.' };
      const v = r.v || {};
      ultimoRender = 0;
      return { ok: !!v.ok, msg: v.ok ? 'Encaixei ' + fmt((v.feitas || []).length) + ' carta(s).' : (v.motivo || 'nada encaixado.') };
    }),
    'ap-base-go': (b) => rotinaBase(b),
    'ap-cal': (b) => executar(b, 'Calibrar previsões', async () => {
      const r = chamar('calibrar');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'calibrar') };
      const v = r.v || {};
      return { ok: true, msg: 'correcção aplicada com ' + (v.n || 0) + ' região(ões): xp ×' + fmt1(v.kXp) + ' · ouro ×' + fmt1(v.kOuro) + '.' };
    }),
    'ap-giro': (b) => executar(b, 'Girar regiões', async () => {
      if (ler('giroAtivo', false)) { chamar('pararGiro'); return { ok: true, msg: 'giro parado.' }; }
      const r = chamar('iniciarGiro');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'iniciarGiro') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não foi possível iniciar' };
      return { ok: true, msg: 'testando ' + (v.lista || []).length + ' região(ões), alguns minutos em cada.' };
    }, { confirma: { titulo: 'Testar várias regiões', linhas: ['A automação vai viajar por todas as regiões, medindo ganhos em cada uma.', 'Enquanto isto corre você não vai estar sempre no melhor sítio.'], ok: 'Começar o giro' } }),
    'ap-testes': () => { renderTestes(); const m = $('lolidle-ap-testes'); m.hidden = false; m.classList.add('on'); },
    'ap-export': (b) => executar(b, 'Exportar dados', async () => {
      const r = chamar('exportar');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'exportar') };
      const blob = new Blob([JSON.stringify(r.v, null, 1)], { type: 'application/json' });
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blob);
      a2.download = 'lolidle-dados-' + new Date().toISOString().slice(0, 10) + '.json';
      a2.click();
      setTimeout(() => URL.revokeObjectURL(a2.href), 5000);
      return { ok: true, msg: 'arquivo baixado (ciclos, mortes, catálogo e recomendações).' };
    }),
    'ap-scan': (b) => executar(b, 'Ler mochila', async () => { const v = lerMochila(true); if (!v) return { ok: false, motivo: 'não consegui ler a mochila (a bolsa está acessível?)' }; return { ok: true, msg: v.used + '/' + v.cap + ' espaços usados.' }; }),
    'ap-curar': (b) => acaoSimples('Curar', 'curarBase', 'curado na Soraka.')(b),
    'ap-repor': (b) => executar(b, 'Repor poções', async () => {
      const r = await chamarA('reporPocoes');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'reporPocoes') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não consegui comprar (você está no Lojista?)' };
      if (v.nada) return { ok: true, msg: 'já tinhas poções acima do mínimo, nada comprado.' };
      const f = v.feitos || {};
      return { ok: true, msg: 'comprado: ' + ORDER.filter((k) => f[k] > 0).map((k) => POCAO_NOME[k] + ' ×' + fmt(f[k])).join(' · ') + '.' };
    }),
    'ap-vender': (b) => executar(b, 'Vender ao lojista', async () => {
      const r = await chamarA('venderBase');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'venderBase') };
      const v = r.v || {};
      const n = (v.epicosVendidos || []).length;
      return { ok: true, msg: n + ' item(ns) vendido(s)' + (v.protegidos && v.protegidos.length ? ' · ' + v.protegidos.length + ' protegido(s) ignorado(s)' : '') + '.' };
    }, { confirma: { titulo: 'Vender ao lojista', linhas: ['Vende só o que o plano da mochila diz que é lixo.', 'Os itens blindados (Rabadon, lendários da build, S/SS equipados) nunca são vendidos.'], ok: 'Vender agora', perigo: true } }),
    'ap-cofre-guardar': (b) => guardarCofre(b),
    'ap-cofre-ler': (b) => lerCofre(b),
    'ap-cofre-melhor': (b) => retirarCofre(b, null),
    'ap-cofre-tirar': (b) => retirarCofre(b, (($('ap-cofre-alvo') || {}).value || '').trim() || null),
    'ap-cofre-lixo': (b) => executar(b, 'Vender lixo do cofre', async () => {
      const r = await chamarA('venderLixoDoCofre');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'venderLixoDoCofre') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: motivoCofre(v.motivo) };
      const n = (v.vendidos || []).length;
      if (!n) return { ok: true, msg: 'o cofre não tem lixo pela regra atual (épico/básico abaixo de S, fora da build/componentes/reservados/especiais).' };
      const venda = v.venda || {};
      const pagos = (venda.epicosVendidos || []).length;
      return { ok: true, msg: n + ' item(ns) retirado(s) do cofre' + (pagos ? ' · ' + pagos + ' vendido(s) ao Lojista' : ' · ficaram na mochila (o plano não os vendeu)') + '.' };
    }, { confirma: { titulo: 'Vender o lixo do cofre', linhas: ['Abre o cofre na Fonte/cidade, retira só o lixo que a automação identifica e passa pelo Lojista.', 'Peças da build, componentes, reservados, especiais, lendários e S/SS nunca são tocados.'], ok: 'Vender o lixo', perigo: true } }),
    'ap-anunciar': (b) => executar(b, 'Anunciar lendários', async () => {
      const r = await chamarA('anunciarLendarios');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'anunciarLendarios') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'nada anunciado' };
      const an = v.anunciados || [];
      const pulados = an.filter((x) => x.pulado).length;
      return { ok: true, msg: an.length + ' anúncio(s)' + (v.cancelados ? ' · ' + v.cancelados + ' cancelado(s) para abrir vaga' : '') + (pulados ? ' · ' + pulados + ' sem referência de preço' : '') + '.' };
    }, { confirma: { titulo: 'Anunciar lendários abaixo de A', linhas: ['Anuncia a ~90% do preço mais baixo do mercado.', 'Rabadon e os lendários tier A ou melhor NUNCA são anunciados.'], ok: 'Anunciar', perigo: true } }),
    'ap-comprar': (b) => executar(b, 'Comprar no mercado', async () => {
      const r = await chamarA('comprarNoMercado');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'comprarNoMercado') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não consegui comprar' };
      const c = v.compras || [];
      const feitas = c.filter((x) => x.comprou);
      if (feitas.length) return { ok: true, msg: 'comprei ' + feitas.map((x) => x.nome + ' por ' + fmt(x.preco)).join(', ') + '.' };
      const recusadas = c.filter((x) => !x.comprou);
      return { ok: true, msg: recusadas.length ? 'nada comprado: ' + recusadas.map((x) => x.motivo).join(' · ') + '.' : 'nada valia a pena comprar agora.' };
    }),
    'ap-refinar': (b) => executar(b, 'Refinar no Ornn', async () => {
      const r = await chamarA('refinarMelhores');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'refinarMelhores') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não refinou' };
      const n = (v.refinados || []).length;
      return { ok: true, msg: n + ' item(ns) refinado(s)' + (v.motivo ? ' · ' + v.motivo : '') + (v.fonteEssenciais ? ' · alvos vieram do ' + v.fonteEssenciais : '') + '.' };
    }, { confirma: { titulo: 'Refinar lendários tier A+', linhas: ['Refina os seus lendários equipados de qualidade A ou melhor.', 'Do +2 para cima há chance de o refino DESCER.', 'Gasta ouro em cada tentativa.'], ok: 'Refinar', perigo: true } }),
    'ap-montar': (b) => executar(b, 'Montar no Ornn', async () => {
      const r = await chamarA('montarMelhorReceita');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'montarMelhorReceita') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não montou' };
      return { ok: true, msg: 'tentou montar ' + (v.nome || v.alvo || '') + ' (' + (v.vezes || 0) + ' tentativas, custo previsto ' + fmt(v.custoPrevisto) + ' ouro).' };
    }, { confirma: { titulo: 'Montar item no Ornn', linhas: ['É uma APOSTA: ~1,2% de chance por tentativa (2,4% com Runa Arcana).', 'A automação usa o lote de tentativas mais próximo do necessário.', 'As peças só são consumidas quando dá certo, mas o ouro é gasto em cada tentativa.'], ok: 'Tentar montar', perigo: true } }),
    'ap-tarefa': (b) => executar(b, 'Aceitar tarefa', async () => {
      const r = await chamarA('aceitarTarefa');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'aceitarTarefa') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não deu' };
      return { ok: true, msg: 'tarefa aceite: ' + (v.tipo || '-') + (v.min ? ' · ~' + v.min + ' min' : '') + (v.xp ? ' · ' + fmt(v.xp) + ' xp' : '') + (v.ouro ? ' · ' + fmt(v.ouro) + ' ouro' : '') + (v.item ? ' · item ' + v.item : '') + '.' };
    }),
    'ap-entregar': (b) => executar(b, 'Entregar tarefa', async () => {
      const r = await chamarA('entregarTarefa');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'entregarTarefa') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não deu' };
      return { ok: true, msg: 'tarefa entregue e recompensa recebida.' };
    }),
    'ap-diaria': (b) => executar(b, 'Missões diárias', async () => {
      const r = await chamarA('aceitarDiarias');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'aceitarDiarias') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não deu' };
      return { ok: true, msg: v.quantas ? 'aceitou: ' + (v.aceitou || []).join(', ') + '.' : 'nenhuma diária disponível (todas feitas hoje).' };
    }),
    'ap-pular-tutorial': (b) => executar(b, 'Pular tutorial', async () => { const r = chamar('pularTutorial'); if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'pularTutorial') }; return { ok: true, msg: 'verificado.' }; }),
    'ap-presentes': (b) => executar(b, 'Pegar presentes', async () => {
      const r = await chamarA('pegarPresentes');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'pegarPresentes') };
      const v = r.v || {};
      const pegos = v.pegos || [];
      return { ok: true, msg: pegos.length ? 'peguei: ' + pegos.join(', ') + '.' : 'nada para pegar agora.' };
    }),
    'ap-reload': (b) => executar(b, 'Recarregar extensão', async () => {
      try { chrome.runtime.sendMessage({ type: 'lolidle:reload' }); } catch (e) { return { ok: false, motivo: 'não consegui falar com a extensão: ' + String(e) }; }
      return { ok: true, msg: 'extensão a recarregar, actualiza a página (F5) para os scripts novos entrarem.' };
    }),
    'ap-ir-agora': (b) => executar(b, 'Viajar', async () => {
      const sel = $('ap-reg-id');
      const id = sel ? sel.value : null;
      if (!id) return { ok: false, motivo: 'escolhe primeiro uma região na lista.' };
      chamar('viajarPara', id);
      return { ok: true, msg: 'viajando para ' + nomeRegiao(id) + '.' };
    }),
    'ap-subir-habs': (b) => subirHabilidades(b),
    'ap-rotacao': (b) => executar(b, 'Repor rotação', async () => {
      const r = await chamarA('rotacaoSkills', false);
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'rotacaoSkills') };
      const v = r.v || {};
      const antes = (v.antes || []).join(' ');
      const desejadas = (v.desejadas || []).join(' ');
      if (!v.mudou) return { ok: true, msg: 'A barra já estava correta (' + (desejadas || '-') + '), nada mudou.' };
      const ap = v.aplicado;
      if (!ap || ap.ok === false) {
        return { ok: false, motivo: 'não consegui pôr a barra nova (' + (ap && ap.motivo ? ap.motivo : 'a automação não disse porquê') + '). Tentei: ' + (desejadas || '-') + '.' };
      }
      return { ok: true, msg: 'Barra atualizada: ' + (desejadas || '-') + (antes && antes !== desejadas ? ' (antes: ' + antes + ')' : '') + '.' };
    }),
    'ap-trocar-skills': (b) => executar(b, 'Trocar skills em recarga', async () => { const r = await chamarA('trocarSkills', false); if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'trocarSkills') }; return { ok: true, msg: 'troca feita.' }; }),
    'ap-distribuir': (b) => distribuirAtributos(b),
    'ap-pick': () => { renderItemGrade(); const m = $('lolidle-ap-modal'); m.hidden = false; m.classList.add('on'); },
    'ap-plan-go': (b) => planearItens(b),
    'ap-plan-limpar': () => { if (!selItens.size) { fbAviso('Não há nada escolhido para limpar.'); return; } selItens.clear(); mudouEscolha(); fb('ok', 'Escolha limpa, nenhum item marcado.'); },
    // MODALIDADES DE FARM (aba Ganhos): a escolha é uma preferência da GUI (GUI_KEY), não da automação.
    'ap-fm-modo-sozinho': () => {
      // A modalidade "pra item" fixa a região (`regionDefault`). Escolher o modo sozinho LIMPA
      // o fixo, senão os dois modos ficavam misturados (o sozinho usaria a região fixa em vez de
      // `regiaoIdeal()`).
      salvarPrefs({ farmModo: 'sozinho' });
      const tinha = cfg().regionDefault || null;
      if (tinha) { definirCfg({ regionDefault: null }); fb('ok', 'AUTO FARM SOZINHO, a região fixa (' + nomeRegiao(tinha) + ') foi limpa: a automação volta a escolher sozinho.'); }
      else fb('ok', 'Modalidade: AUTO FARM SOZINHO, a automação escolhe a região.');
      ultimoRender = 0; renderFarmModo(); renderFarmItens(); renderAuto();
    },
    // Voltar ao automático a partir da aba Ganhos (sem ter de ir ao Painel).
    'ap-fm-auto': () => {
      if (!cfg().regionDefault) { fbAviso('A região já está automática.'); return; }
      definirCfg({ regionDefault: null });
      ultimoRender = 0; renderFarmModo(); renderFarmItens(); renderAuto();
      fb('ok', 'Região AUTOMÁTICA de novo: a automação escolhe a melhor para o seu nível.');
    },
    'ap-fm-modo-item': () => { salvarPrefs({ farmModo: 'item' }); ultimoRender = 0; renderFarmModo(); renderFarmItens(); fb('ok', 'Modalidade: AUTO FARM PRA ITEM, escolha os itens e a automação leva você à região que os dropa.'); },
    'ap-fm-go': (b) => farmarAgora(b),
    // MINIMIZAR do bloco da build por fase (aba Itens). O estado fica em GUI_KEY e sobrevive ao F5.
    'ap-bf-min': () => {
      const abrir = guiPrefs.bfAberto === false;          // clicar fecha quando está aberta
      salvarPrefs({ bfAberto: abrir });
      _ultimoHtml.delete('ap-build-fase');                // o HTML muda (classe min + seta): força o redesenho
      renderBuildFase();
      fb('info', abrir ? 'Build por fase: aberta.' : 'Build por fase: minimizada, fica só o título.');
    },
    // MINIMIZAR dos cartões de farm (aba Ganhos): o estado vive em GUI_KEY e sobrevive ao F5.
    'ap-fm-min-modo': () => {
      const abrir = guiPrefs.fmModoMin === true;
      salvarPrefs({ fmModoMin: !abrir });
      _ultimoHtml.delete('ap-fm-modo');
      renderFarmModo();
      fb('info', abrir ? 'Como você quer farmar: aberto.' : 'Como você quer farmar: minimizado, fica só o título.');
    },
    'ap-fm-min-itens': () => {
      const abrir = guiPrefs.fmItensMin === true;
      salvarPrefs({ fmItensMin: !abrir });
      _ultimoHtml.delete('ap-fm-itens');
      renderFarmItens();
      fb('info', abrir ? 'Auto farm pra item: aberto.' : 'Auto farm pra item: minimizado, fica só o título.');
    },
    // O botão da aba Painel tem id próprio porque o da mochila (aba Itens) também é `ap-scan`.
    'ap-scan-painel': (b) => ACOES['ap-scan'](b),
    // Ids próprios para os botões que existem em DOIS sítios (Painel e Itens/Mercado/Ganhos):
    // dois elementos com o mesmo id são DOM inválido e `getElementById` devolve só o primeiro.
    'ap-mk-anunciar': (b) => ACOES['ap-anunciar'](b),
    'ap-mk-montar': (b) => ACOES['ap-montar'](b),
    'ap-mk-comprar': (b) => ACOES['ap-comprar'](b),
    'ap-fm-testes': () => { renderTestes(); const m = $('lolidle-ap-testes'); m.hidden = false; m.classList.add('on'); },
    'ap-base-go-agora': (b) => rotinaBase(b),
    'ap-modal-x': () => { const m = $('lolidle-ap-modal'); m.hidden = true; m.classList.remove('on'); },
    'ap-modal-ok': () => { const m = $('lolidle-ap-modal'); m.hidden = true; m.classList.remove('on'); renderItemGrade(); fb('ok', selItens.size + ' item(ns) escolhido(s). Agora use "Farmar estes itens".'); },
    'ap-modal-limpar': () => { selItens.clear(); mudouEscolha(); },
    'ap-mk-ler': (b) => lerOfertas(b),
    'ap-mkt-plan': (b) => planoMercado(b),
    'ap-mkt-go': (b) => aplicarMercado(b),
    'ap-ornn-ler': (b) => lerOrnn(b),
    'ap-melhor-compra': (b) => melhorCompra(b),
    // ---- WATCH DO MERCADO (2026-10-18): força uma vigia agora e reporta no rodapé ----
    'ap-watch-agora': (b) => executar(b, 'Vigia do mercado', async () => {
      const r = await chamarA('vigiarMercadoPasso');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'vigiarMercadoPasso') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'nada a fazer' };
      const n = (v.achados || []).length;
      if (!n) return { ok: true, msg: 'Nada casou agora' + (v.n != null ? ' (o mercado tem ' + v.n + ' ofertas).' : '.') };
      const c = v.comprou;
      return { ok: true, msg: n + ' oferta(s) casam.' + (c && c.ok ? ' COMPROU ' + (c.vendedor || '?') + ' por ' + fmt(c.preco) + ' ouro.' : (c && c.motivo ? ' Não comprou: ' + c.motivo : (v.motivo ? ' ' + v.motivo : ''))) };
    }),
    'ap-tx-x': () => { const m = $('lolidle-ap-testes'); m.hidden = true; m.classList.remove('on'); },
    'ap-tx-add': () => { if (sets.length >= 6) { fbAviso('Máximo de 6 conjuntos.'); return; } sets.push({ nome: 'conjunto ' + (sets.length + 1), itens: [] }); renderTestes(); },
    'ap-tx-base': () => { sets[0] = { nome: 'atual', itens: (ler('readEquip', []) || []).map((e) => String(e.base)).filter((b) => b !== RABADON) }; renderTestes(); },
    'ap-tx-run': (b) => executar(b, 'Rodar teste', async () => {
      const reg = ($('ap-tx-reg') || {}).value || null;
      const seg = Number(($('ap-tx-seg') || {}).value || 20);
      const lista = sets.map((s) => ({ nome: s.nome, itens: [RABADON].concat((s.itens || []).filter(Boolean)) }));
      const r = chamar('iniciarTeste', lista, { regiao: reg, mobSeg: seg });
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'iniciarTeste') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não começou' };
      return { ok: true, msg: 'testando ' + v.sets + ' conjunto(s) em ' + nomeRegiao(reg) + '. Você pode fechar esta janela.' };
    }),
    'ap-tx-stop': (b) => executar(b, 'Parar teste', async () => { const r = chamar('pararTeste'); if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'pararTeste') }; return { ok: true, msg: 'teste parado.' }; }),
    'ap-cf-ok': () => fecharConfirmar(true),
    'ap-cf-não': () => fecharConfirmar(false),
    // WATCH picker: abrir/fechar e salvar
    'ap-watch-add': () => { const pk = $('ap-watch-picker'); if (pk) { pk.hidden = false; if (pk.scrollIntoView) pk.scrollIntoView({ block: 'nearest' }); } renderWatchGrade(); },
    'ap-watch-ok': () => {
      const l = Array.from(watchItens || new Set());
      definirCfg({ mercadoWatch: novoWatch({ itens: l }) });
      fb('ok', 'Watch de itens: ' + (l.length ? l.map((b) => nomeItem(b)).join(', ') : 'vazia') + '.');
      ultimoRender = 0; renderMercado();
    },
    'ap-watch-30k': () => {
      definirCfg({ mercadoWatch: novoWatch({ precoMax: 30000, tetoCompra: 30000 }) });
      const a = $('ap-watch-preco'), b = $('ap-watch-teto');
      if (a) a.value = '30000'; if (b) b.value = '30000';
      fb('ok', 'Teto do teste: 30.000 ouro por oferta e por compra.');
    },
    'ap-watch-vendedor-ok': () => {
      const inp = $('ap-watch-vendedor-add');
      const nome = String((inp && inp.value) || '').trim();
      if (!nome) { fbAviso('Escreve o nome do jogador.'); return; }
      const atuais = ((cfg().mercadoWatch || {}).vendedores || []).slice();
      if (atuais.indexOf(nome) < 0) atuais.push(nome);
      definirCfg({ mercadoWatch: novoWatch({ vendedores: atuais }) });
      if (inp) inp.value = '';
      fb('ok', 'Jogador adicionado à watch: ' + nome + '.');
      ultimoRender = 0; renderMercado();
    },
  };

  function guardarMin(k, valor) {
    const cur = (cfg().minPotion) || { vida: 200, vidaF: 100, vidaS: 30 };
    const novo = Object.assign({}, cur); novo[k] = Math.max(0, Number(valor) || 0);
    definirCfg({ minPotion: novo });
    fb('ok', 'Mínimo de ' + POCAO_NOME[k] + ' para repor: ' + novo[k] + '.');
  }
  function guardarBuy(k, valor) {
    const cur = (cfg().buyPotion) || { vida: 3000, vidaF: 1500, vidaS: 700 };
    const novo = Object.assign({}, cur); novo[k] = Math.max(0, Number(valor) || 0);
    definirCfg({ buyPotion: novo });
    fb('ok', 'Comprar até ' + novo[k] + ' de ' + POCAO_NOME[k] + '.');
  }
  function guardarPocao(k, patch) {
    const cur = (config && config.potions) || {};
    const atual = Object.assign({ enabled: true, mode: 'pct', value: k === 'vidaS' ? 60 : k === 'vidaF' ? 43 : 21 }, cur[k] || {});
    const novo = Object.assign({}, cur); novo[k] = Object.assign({}, atual, patch);
    salvarTopo({ potions: novo });
  }

  // WATCH DO MERCADO (2026-10-18): a GUI nao conhece a chave - escreve sempre pela automação
  // (`setConfig`), e passa o objeto mercadoWatch INTEIRO porque o setConfig faz Object.assign
  // raso (automation.js:8279). Estes dois atalhos leem e fundem o objeto actual.
  const listaWatch = (s) => String(s == null ? '' : s).split(',').map((x) => x.trim()).filter(Boolean);
  const novoWatch = (patch) => Object.assign({}, (cfg() || {}).mercadoWatch || {}, patch);
  const MUDANCAS = {
    // O ÚNICO INTERRUPTOR MESTRE (cartão AUTO-PLAY, topo do Painel). Ligar/desligar = `enabled`.
    // Sair de DESLIGADO (kill persistente no navegador) religa tudo primeiro; desligar limpa o
    // estado ativo (prazos, testes, farm forçado) - ao religar começa do zero.
    'ap-mestre': (el) => {
      const on = !!el.checked;
      if (on) {
        if (estaDesligado()) chamar('religarTudo');
        definirLigado(true);
        fb('ok', 'AUTO-PLAY LIGADO: a automação farma, viaja e decide sozinho. As capacidades que você desligou continuam desligadas.');
      } else {
        definirLigado(false);
        chamar('limparEstadoAtivo');
        fb('info', 'AUTO-PLAY DESLIGADO: os switches voltaram ao que você tinha escolhido e a automação só observa (não clica em nada).');
      }
      ultimoRender = 0;
    },
    'ap-obj': (el) => { definirCfg({ objetivo: el.value }); fb('ok', 'Objetivo: ' + ({ 'ouro+xp': 'ouro e experiência', xp: 'experiência', ouro: 'ouro', runas: 'runas' }[el.value] || el.value) + '. A região ideal passa a ser escolhida por isto.'); ultimoRender = 0; },
    'ap-reg-modo': (el) => {
      if (el.value === 'auto') { definirCfg({ regionDefault: null }); fb('ok', 'Região AUTOMÁTICA: a automação escolhe sempre a melhor para o seu nível (a região fixa foi limpa).'); }
      else { const sel = $('ap-reg-id'); const id = sel ? sel.value : null; definirCfg({ regionDefault: id }); fb('ok', 'Região FIXA: ' + nomeRegiao(id) + '. A automação fica aqui até você voltar para "Automática".'); }
      ultimoRender = 0;
    },
    // ESCOLHER UMA REGIÃO NA LISTA PASSA A REGIÃO PARA FIXA (com o modo em "Automática" o
    // clique era ignorado e nada mudava). O controle de modo muda no mesmo instante, para nunca
    // haver dois controles a apontar para sítios diferentes.
    'ap-reg-id': (el) => {
      if (!el.value) return;
      definirCfg({ regionDefault: el.value });
      const modo = $('ap-reg-modo'); if (modo && modo.value !== 'fixa') modo.value = 'fixa';
      fb('ok', 'Região FIXA: ' + nomeRegiao(el.value) + '. A automação fica aqui até você escolher "Automática".');
      ultimoRender = 0;
    },
    'ap-cfg-autoEquip': (el) => { definirCfg({ autoEquip: el.checked }); fb('ok', 'Trocar por peça melhor: ' + (el.checked ? 'ligado' : 'desligado') + '.'); },
    'ap-cfg-trocaItens': (el) => { definirCfg({ trocaItens: el.checked }); fb('ok', 'Troca de itens conforme a luta: ' + (el.checked ? 'ligada' : 'desligada') + '.'); },
    'ap-cfg-buildPorFase': (el) => {
      definirCfg({ buildPorFase: !!el.checked });
      cacheLimpar('bf-mobs'); cacheLimpar('bf-chefe');
      fb('ok', el.checked
        ? 'Build por fase LIGADA: em mobs veste a de limpeza, no chefe a de alvo único, e as peças da outra ficam reservadas na mochila.'
        : 'Build por fase DESLIGADA: volta a uma build só e as peças deixam de ser reservadas.');
      ultimoRender = 0;
    },
    'ap-cfg-autoAtrib': (el) => { definirCfg({ autoAtrib: el.checked }); fb('ok', 'Distribuir pontos de atributo automaticamente: ' + (el.checked ? 'ligado' : 'desligado') + '.'); },
    'ap-cfg-autoRefino': (el) => { definirCfg({ autoRefino: el.checked }); fb('ok', 'Refinar no Ornn automaticamente: ' + (el.checked ? 'ligado' : 'desligado') + '.'); },
    // DEFEITO CORRIGIDO (2026-10-19): `ap-cfg-barraDisp` era desenhado mas NÃO tinha handler -
    // o interruptor não fazia nada. Agora escreve a chave da automação.
    'ap-cfg-barraDisp': (el) => { definirCfg({ barraPorDisponibilidade: !!el.checked }); fb('ok', 'Barra pelas PRONTAS: ' + (el.checked ? 'ligada (usa tudo disponível, reavalia a cada 2 s)' : 'desligada (fixa nas 4 de maior dano)') + '.'); ultimoRender = 0; },
    // A ULTIMATE NÃO É INTERRUPTOR (dono, 2026-10-19, verbatim: "ultimate nas lutas dos mobs
    // nao e pra ser opcional"). A regra vive na `barraIdeal`: entra em fase DIFÍCIL ou no CHEFE,
    // e só. O toggle e a chave `ultEmMobs` foram removidos da UI - não há handler.
    // Sem handlers de smart/strongest: os toggles foram removidos (decisão sempre inteligente;
    // PvP por detecção de Runeterra). Um clique antigo não existe mais no DOM.
    'ap-min-vida': (el) => guardarMin('vida', el.value),
    'ap-min-vidaF': (el) => guardarMin('vidaF', el.value),
    'ap-min-vidaS': (el) => guardarMin('vidaS', el.value),
    'ap-at-modelo-sel': (el) => { definirCfg({ modeloAtrib: el.value }); fb('ok', 'Modelo de atributos: ' + el.value + '.'); },
    // ---- WATCH DO MERCADO (2026-10-18): itens, jogadores, limites e cadência ----
    'ap-watch-itens': (el) => { const l = listaWatch(el.value); definirCfg({ mercadoWatch: novoWatch({ itens: l }) }); fb('ok', 'Watch de itens: ' + (l.length ? l.join(', ') : 'vazia') + '.'); ultimoRender = 0; },
    'ap-watch-vendedores': (el) => {
      // <select multiple>: `el.value` só devolve a primeira opção. A lista completa está em
      // `selectedOptions`.
      const l = el.multiple ? Array.from(el.selectedOptions || []).map((o) => o.value).filter(Boolean) : listaWatch(el.value);
      definirCfg({ mercadoWatch: novoWatch({ vendedores: l }) });
      fb('ok', 'Watch de jogadores: ' + (l.length ? l.join(', ') : 'vazia') + '.');
      ultimoRender = 0;
    },
    'ap-watch-filtro': (el) => { const v = String(el.value) === 'qualquer' ? 'qualquer' : 'so'; definirCfg({ mercadoWatch: novoWatch({ filtroVendedores: v }) }); fb('ok', v === 'so' ? 'A vigia só compra dos jogadores da lista.' : 'A vigia compra os itens da lista de qualquer jogador, além dos jogadores listados.'); ultimoRender = 0; },
    'ap-watch-preco': (el) => { const v = Math.max(0, Number(el.value) || 0); definirCfg({ mercadoWatch: novoWatch({ precoMax: v > 0 ? v : null }) }); fb('ok', v > 0 ? 'Preço máximo por oferta: ' + fmt(v) + ' ouro.' : 'Sem limite de preço próprio (fica só a reserva de ouro).'); },
    'ap-watch-teto': (el) => { const v = Math.max(0, Number(el.value) || 0); definirCfg({ mercadoWatch: novoWatch({ tetoCompra: v > 0 ? v : null }) }); fb('ok', 'Limite de gasto por passagem: ' + (v > 0 ? fmt(v) + ' ouro' : 'sem limite') + '.'); },
    'ap-watch-pct': (el) => {
      const v = Math.max(0, Math.min(100, Number(el.value) || 0));
      definirCfg({ mercadoWatch: novoWatch({ percentualOuro: v }) });
      fb('ok', v > 0 ? 'Tecto de compra: até ' + v + '% do ouro ATUAL (escala com o ouro).' : 'Sem teto por percentagem do ouro.');
    },
    'ap-watch-prioridade': (el) => {
      const v = ['tier', 'refino', 'preco'].indexOf(String(el.value)) >= 0 ? String(el.value) : 'tier';
      definirCfg({ mercadoWatch: novoWatch({ prioridade: v }) });
      fb('ok', 'Prioridade da watch: ' + ({ tier: 'qualidade/tier', refino: 'refino mais alto', preco: 'mais barato' }[v]) + '.');
    },
    'ap-watch-tier': (el) => {
      const v = String(el.value || '').toUpperCase();
      definirCfg({ mercadoWatch: novoWatch({ tierMin: ['C', 'B', 'A', 'S', 'SS'].indexOf(v) >= 0 ? v : null }) });
      fb('ok', v ? 'Qualidade mínima: ' + v + '.' : 'Qualidade mínima: qualquer.');
    },
    'ap-watch-refino': (el) => {
      const v = Math.max(0, Math.min(5, Number(el.value) || 0));
      definirCfg({ mercadoWatch: novoWatch({ refinoMin: v }) });
      fb('ok', v ? 'Refino mínimo: +' + v + '.' : 'Refino mínimo: qualquer.');
    },
    'ap-watch-cad': (el) => { const s = Math.max(2, Number(el.value) || 5); definirCfg({ mercadoWatch: novoWatch({ cadenciaMs: s * 1000 }) }); fb('ok', 'Cadência da vigia: ' + s + ' s.'); },

    // ---------- CARTÕES DE CONFIGURAÇÃO DOS SWITCHES (2026-10-23) ----------
    'ap-cbase-inicio': (el) => { definirCfg({ inicioJogoAteNivel: Math.max(1, Number(el.value) || 1) }); fb('ok', 'Venda ao Lojista como receita até ao nível ' + (Number(el.value) || 1) + ': acima disso é só despejo.'); },
    'ap-cbase-cura': (el) => { definirCfg({ curaAbaixo: Number(el.value) }); fb('ok', 'Voltar à Fonte para curar abaixo de ' + Math.round(Number(el.value) * 100) + '% da vida.'); },
    'ap-min-vida': (el) => guardarMin('vida', el.value),
    'ap-min-vidaF': (el) => guardarMin('vidaF', el.value),
    'ap-min-vidaS': (el) => guardarMin('vidaS', el.value),
    'ap-buy-vida': (el) => guardarBuy('vida', el.value),
    'ap-buy-vidaF': (el) => guardarBuy('vidaF', el.value),
    'ap-buy-vidaS': (el) => guardarBuy('vidaS', el.value),
    'ap-anun-desc': (el) => { definirCfg({ anuncioDesconto: Number(el.value) }); fb('ok', 'Anúncio a ' + Math.round(Number(el.value) * 100) + '% do menor preço da mesma qualidade.'); },
    'ap-anun-qual': (el) => { definirCfg({ anuncioQualMax: String(el.value).toUpperCase() }); fb('ok', 'Só se anuncia abaixo de ' + String(el.value).toUpperCase() + '.'); },
    'ap-anun-piso': (el) => { definirCfg({ precoSemComparavel: Math.max(0, Number(el.value) || 0) }); fb('ok', 'Preço sem comparável (tier A): ' + fmt(Number(el.value) || 0) + '.'); },
    'ap-anun-gume': (el) => {
      const cur = Object.assign({}, (cfg().precoSemComparavelPorBase || {}));
      cur['3031'] = Math.max(0, Number(el.value) || 0);
      definirCfg({ precoSemComparavelPorBase: cur });
      fb('ok', 'Piso do Gume do Infinito: ' + fmt(Number(el.value) || 0) + '.');
    },
    'ap-cbuy-tier': (el) => { definirCfg({ compraMinTier: String(el.value).toUpperCase() }); fb('ok', 'A build só gasta ouro em ' + String(el.value).toUpperCase() + ' ou melhor.'); },
    'ap-cbuy-wtier': (el) => { definirCfg({ mercadoWatch: novoWatch({ tierMin: String(el.value).toUpperCase() }) }); fb('ok', 'A vigia só compra ' + String(el.value).toUpperCase() + ' ou melhor.'); },
    'ap-cbuy-pct': (el) => { const v = Math.max(1, Math.min(100, Number(el.value) || 90)); definirCfg({ mercadoWatch: novoWatch({ percentualOuro: v }) }); fb('ok', 'A compra pode gastar até ' + v + '% do ouro.'); },
    'ap-cbuy-max': (el) => { const v = Math.max(0, Number(el.value) || 0); definirCfg({ mercadoWatch: novoWatch({ precoMax: v || null }) }); fb('ok', v ? 'Tecto por oferta: ' + fmt(v) + '.' : 'Sem teto absoluto por oferta.'); },
  };

  // ============================================================ 6c. POPUP DOS DETALHES (⚙)
  // O ⚙ de um switch ABRE o bloco de detalhes num popup, sem trocar de aba. O bloco é o
  // MESMO nó do DOM: move-se para o popup e devolve-se ao lugar no fecho. Clonar quebraria
  // os `id` (dois elementos com o mesmo id) e os handlers que os procuram no documento.
  const MACRO_POP_TITULO = {
    'ap-macro-farm': 'Rota de farm',
    'ap-macro-cartas': 'Cartas',
    'ap-macro-mercado': 'Mercado e watch',
    'ap-cfg-base': 'Rotina de base',
    'ap-cfg-repor': 'Repor poções',
    'ap-cfg-anunciar': 'Anunciar no mercado',
    'ap-cfg-comprar': 'Comprar no mercado',
    'ap-build-fase': 'Build por fase',
  };
  let _macroPop = null, _macroPopVoltar = null;
  function garantirMacroPopup() {
    if (_macroPop && document.body.contains(_macroPop)) return _macroPop;
    const host = document.getElementById('lolidle-ap') || document.body || document.documentElement;
    const m = document.createElement('div');
    m.id = 'lolidle-ap-macro'; m.hidden = true;
    m.innerHTML = '<div class="box lolidle-box">'
      + '<header><b id="ap-macro-pop-tit">Configurar</b><span class="sp"></span>'
      + '<button id="ap-macro-pop-x" class="sec" type="button">Fechar</button></header>'
      + '<div class="corpo" id="ap-macro-pop-corpo"></div>'
      + '</div>';
    // clique no fundo escuro ou no Fechar; os controlos lá dentro continuam a subir para o
    // `painel` (o popup é filho dele), portanto a delegação existente apanha-os.
    m.addEventListener('click', (ev) => {
      const x = ev.target && ev.target.closest ? ev.target.closest('#ap-macro-pop-x') : null;
      if (x || ev.target === m) fecharMacroPopup();
    });
    host.appendChild(m);
    _macroPop = m;
    return m;
  }
  function abrirMacroPopup(alvo) {
    if (!alvo) return false;
    try {
      if (alvo.indexOf('ap-macro-') === 0) renderMacro();
      else if (alvo === 'ap-build-fase') renderBuildFase();
      else if (alvo === 'ap-cfg-base') renderCfgBase();
      else if (alvo === 'ap-cfg-repor') renderCfgRepor();
      else if (alvo === 'ap-cfg-anunciar') renderCfgAnunciar();
      else if (alvo === 'ap-cfg-comprar') renderCfgComprar();
    } catch { /* sem dados ainda: o bloco mostra o placeholder */ }
    const el = document.getElementById(alvo);
    if (!el) { fbErro('Este bloco de detalhes ainda não existe nesta versão. Recarregue (F5).'); return false; }
    fecharMacroPopup();                       // devolve um popup anterior antes de abrir outro
    const m = garantirMacroPopup();
    const corpo = m.querySelector('#ap-macro-pop-corpo');
    _macroPopVoltar = { el, pai: el.parentNode, prox: el.nextSibling };
    if (corpo) corpo.appendChild(el);
    const t = m.querySelector('#ap-macro-pop-tit');
    if (t) t.textContent = MACRO_POP_TITULO[alvo] || 'Configurar';
    m.hidden = false; m.classList.add('on');
    return true;
  }
  function fecharMacroPopup() {
    if (!_macroPop || _macroPop.hidden) return false;
    if (_macroPopVoltar && _macroPopVoltar.el) {
      const { el, pai, prox } = _macroPopVoltar;
      if (pai) pai.insertBefore(el, prox && prox.parentNode === pai ? prox : null);
    }
    _macroPopVoltar = null;
    _macroPop.hidden = true; _macroPop.classList.remove('on');
    return true;
  }

  function bind() {
    const painel = $('lolidle-ap');
    if (!painel) return;
    painel.addEventListener('click', (e) => {
      // BOTÃO "DESLIGAR TUDO" dos switches filhos (o mesmo botão religa o conjunto anterior).
      const swTudo = e.target.closest ? e.target.closest('#ap-sw-todos') : null;
      if (swTudo && painel.contains(swTudo)) {
        const r = chamar('alternarTodosSwitches');
        _ultimoHtml.delete('ap-auto-arvore');
        cacheAgora = { at: 0, v: null };
        cacheLimpar();
        ultimoRender = 0;
        renderCabecalho();
        renderArvore();
        if (!r.ok) fbErro('Não consegui mudar os switches: ' + erroLegivel(r.erro, 'alternarTodosSwitches'));
        else fb('ok', (r.v && r.v.todosOff)
          ? 'Todos os switches DESLIGADOS. Este mesmo botão religa o conjunto que você tinha escolhido.'
          : 'Switches religados como você tinha escolhido antes.');
        return;
      }
      // ⚙ de um switch -> POPUP com os detalhes (pedido do dono 2026-10-21: "pode abrir um
      // popup invés de sair da página"). Antes isto fazia `setTab('macro')` e o dono perdia a
      // aba em que estava. O bloco é MOVIDO para o popup e devolvido no fecho - assim os
      // controlos continuam a ser os mesmos (IDs e delegação de eventos intactos).
      const cfgBtn = e.target.closest ? e.target.closest('[data-macro]') : null;
      if (cfgBtn && painel.contains(cfgBtn)) {
        abrirMacroPopup(String(cfgBtn.dataset.macro || ''));
        return;
      }
      // remover um item escolhido (delegação: o contentor dos chips nasce só quando a aba Ganhos desenha)
      const rem = e.target.closest ? e.target.closest('[data-rem]') : null;
      if (rem && rem.dataset && painel.contains(rem)) { selItens.delete(String(rem.dataset.rem)); mudouEscolha(); return; }
      // WATCH picker: remover um chip (×) de ITEM ou de JOGADOR, ou marcar/desmarcar um item na grade
      const wvend = e.target.closest ? e.target.closest('[data-wvend]') : null;
      if (wvend && painel.contains(wvend)) {
        const nome = String(wvend.dataset.wvend);
        const atuais = ((cfg().mercadoWatch || {}).vendedores || []).filter((v) => v !== nome);
        definirCfg({ mercadoWatch: novoWatch({ vendedores: atuais }) });
        fb('ok', 'Jogador removido da watch: ' + nome + '.');
        ultimoRender = 0; renderMercado();
        return;
      }
      const wrem = e.target.closest ? e.target.closest('[data-wrem]') : null;
      if (wrem && painel.contains(wrem)) {
        const b = String(wrem.dataset.wrem);
        if (watchItens) watchItens.delete(b);
        const l = Array.from(watchItens || new Set());
        definirCfg({ mercadoWatch: novoWatch({ itens: l }) });
        fb('ok', 'Watch de itens: ' + (l.length ? l.map((x) => nomeItem(x)).join(', ') : 'vazia') + '.');
        ultimoRender = 0; renderMercado();
        return;
      }
      const witem = e.target.closest ? e.target.closest('[data-witem]') : null;
      if (witem && painel.contains(witem)) {
        const b = String(witem.dataset.witem);
        if (!watchItens) watchItens = new Set();
        if (watchItens.has(b)) watchItens.delete(b); else watchItens.add(b);
        renderWatchGrade();
        return;
      }
      const b = e.target.closest ? e.target.closest('button[id]') : null;
      if (!b) return;
      // BOTÕES FORA DO `painel` (o FECHAR do popup da macro vive em `#lolidle-ap`, ao lado do
      // painel): antes caíam em "este botão ainda não faz nada", que o dono viu com o id
      // `ap-macro-pop-x`. Se o id tem handler declarado, é para executar.
      const f = ACOES[b.id];
      if (!painel.contains(b) && !f) return;
      if (!f) { fbAviso('Este botão ainda não faz nada (reporta: ' + b.id + ').'); return; }
      try { f(b); } catch (err) { fbErro('Erro inesperado em ' + b.id + ': ' + String((err && err.message) || err)); }
    });
    painel.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'ap-watch-busca') renderWatchGrade();
    });
    // ADICIONAR JOGADOR À WATCH (o dropdown só lista os nomes já conhecidos; aqui entra um novo).
    painel.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target || e.target.id !== 'ap-watch-vendedor-add') return;
      e.preventDefault();
      const nome = String(e.target.value || '').trim();
      if (!nome) return;
      const atuais = ((cfg().mercadoWatch || {}).vendedores || []).slice();
      if (atuais.indexOf(nome) < 0) atuais.push(nome);
      definirCfg({ mercadoWatch: novoWatch({ vendedores: atuais }) });
      e.target.value = '';
      fb('ok', 'Jogador adicionado à watch: ' + nome + '.');
      ultimoRender = 0; renderMercado();
    });
    painel.addEventListener('change', (e) => {
      const el = e.target;
      // LIMITE POR ITEM da watch (input dentro do chip): guarda em mercadoWatch.limites[base].
      if (el && el.dataset && el.dataset.wlim) {
        const base = String(el.dataset.wlim);
        const v = Math.max(0, Number(el.value) || 0);
        const atuais = Object.assign({}, (cfg().mercadoWatch || {}).limites || {});
        if (v > 0) atuais[base] = v; else delete atuais[base];
        definirCfg({ mercadoWatch: novoWatch({ limites: atuais }) });
        fb('ok', v > 0 ? nomeItem(base) + ': compra até ' + fmt(v) + ' ouro.' : nomeItem(base) + ': volta ao teto global.');
        return;
      }
      if (!el || !el.id) return;
      // INTERRUPTOR DA ÁRVORE (hierarquia): id ap-arv-<nome>, chave da automação em data-cfg
      if (el.dataset && el.dataset.arv) {
        try { alternarInterruptor(el.dataset.arv, el.dataset.cfg, el.checked); }
        catch (err) { fbErro('Erro ao mudar o switch: ' + String((err && err.message) || err)); }
        return;
      }
      const f = MUDANCAS[el.id];
      if (f) { try { f(el); } catch (err) { fbErro('Erro ao guardar: ' + String((err && err.message) || err)); } return; }
      // SWITCH DE CAPACIDADE DO MOTOR (cartão "Automatismos da automação"): a CHAVE vem em `data-cfg`,
      // lida de `arvoreInterruptores()`. Cobre os interruptores sem handler próprio - vender,
      // repor, cofre, anunciar, subir habilidades e ir à base - e a GUI não escreve o nome da
      // chave à mão (só a automação a declara).
      if (el.dataset && el.dataset.cfg) {
        try {
          const ok = definirCfg({ [el.dataset.cfg]: !!el.checked });
          ultimoRender = 0;
          if (ok) fb(el.checked ? 'ok' : 'info', 'Interruptor ' + (el.checked ? 'LIGADO.' : 'DESLIGADO.'));
          else fbErro('Não consegui mudar o interruptor, a automação não aceitou a escrita.');
        } catch (err) { fbErro('Erro ao mudar o switch: ' + String((err && err.message) || err)); }
        return;
      }
      // poções: ids compostos ap-pc-<campo>-<poção>
      const m = /^ap-pc-(on|v|m)-(.+)$/.exec(el.id);
      if (m) {
        const k = m[2];
        try {
          if (m[1] === 'on') { guardarPocao(k, { enabled: !!el.checked }); fb('ok', POCAO_NOME[k] + ': ' + (el.checked ? 'ligada' : 'desligada') + '.'); }
          else if (m[1] === 'v') { guardarPocao(k, { value: Math.max(0, Number(el.value) || 0) }); fb('ok', POCAO_NOME[k] + ': gatilho guardado.'); }
          else { guardarPocao(k, { mode: el.value }); fb('ok', POCAO_NOME[k] + ': unidade mudada para ' + (el.value === 'pct' ? '% da vida perdida' : 'vida perdida') + '.'); }
          ultimoRender = 0;
        } catch (err) { fbErro('Erro ao guardar poção: ' + String((err && err.message) || err)); }
      }
    });
    qa('#lolidle-ap .tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    // ---- modais ----
    const modal = $('lolidle-ap-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        const b = e.target.closest ? e.target.closest('button[id]') : null;
        if (b && ACOES[b.id]) { ACOES[b.id](b); return; }
        const fr = e.target.closest ? e.target.closest('.frame') : null;
        if (fr) { const id = String(fr.dataset.item); if (selItens.has(id)) selItens.delete(id); else selItens.add(id); mudouEscolha(); return; }
        const f = e.target.closest ? e.target.closest('.if') : null;
        if (f) { itemFiltro = f.dataset.if; qa('#lolidle-ap-modal .if').forEach((x) => x.classList.toggle('ativa', x === f)); renderItemGrade(); }
        if (e.target === modal) { modal.hidden = true; modal.classList.remove('on'); }
      });
      modal.addEventListener('input', (e) => { if (e.target && e.target.id === 'ap-item-busca') renderItemGrade(); });
    }
    const testes = $('lolidle-ap-testes');
    if (testes) {
      testes.addEventListener('click', (e) => {
        const b = e.target.closest ? e.target.closest('button[id]') : null;
        if (b && ACOES[b.id]) { ACOES[b.id](b); return; }
        const d = e.target.closest ? e.target.closest('[data-set-del]') : null;
        if (d) { sets.splice(Number(d.dataset.setDel), 1); if (!sets.length) sets.push({ nome: 'atual', itens: [] }); renderTestes(); return; }
        if (e.target === testes) { testes.hidden = true; testes.classList.remove('on'); }
      });
      const edit = (e) => {
        const t = e.target;
        if (!t || !t.dataset) return;
        if (t.dataset.setNome != null) { const i = Number(t.dataset.setNome); if (sets[i]) sets[i].nome = t.value; return; }
        if (t.dataset.setSlot != null) { const p = t.dataset.setSlot.split(':'); const i = Number(p[0]), k = Number(p[1]); if (sets[i]) sets[i].itens[k] = t.value || undefined; }
      };
      testes.addEventListener('input', edit);
      testes.addEventListener('change', edit);
    }
    const conf = $('lolidle-ap-confirma');
    if (conf) conf.addEventListener('click', (e) => { const b = e.target.closest ? e.target.closest('button[id]') : null; if (b && ACOES[b.id]) ACOES[b.id](b); });
    const aj = $('lolidle-ap-ajuda');
    if (aj) { aj.addEventListener('click', (e) => { const b = e.target.closest ? e.target.closest('button[id]') : null; if (b && ACOES[b.id]) ACOES[b.id](b); if (e.target === aj) { aj.hidden = true; aj.classList.remove('on'); } }); }
    // ---- teclado ----
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F8') { e.preventDefault(); e.stopPropagation(); (aberto ? fechar() : abrir()); return; }
      if (e.key === 'Escape' && aberto) {
        const m = qa('#lolidle-ap-modal.on,#lolidle-ap-testes.on,#lolidle-ap-ajuda.on,#lolidle-ap-confirma.on,#lolidle-ap-macro.on')[0];
        if (m) {
          if (m.id === 'lolidle-ap-confirma') fecharConfirmar(false);
          else if (m.id === 'lolidle-ap-macro') fecharMacroPopup();   // devolve o bloco à aba
          else { m.hidden = true; m.classList.remove('on'); }
        }
        else fechar();
      }
    }, true);
  }

  // ============================================================ 7. ARRANQUE
  function boot() {
    injectCss();
    build();
    buildLaunch();
    try {
      chrome.storage.local.get([STORAGE_KEY, STATUS_KEY, FARM_KEY, AGG_KEY, COFRE_KEY, OFERTAS_KEY, GUI_KEY, ESTADO_KEY], (res) => {
        config = (res && res[STORAGE_KEY]) || null;
        status = (res && res[STATUS_KEY]) || null;
        farmStore = (res && res[FARM_KEY]) || null;
        aggStore = (res && res[AGG_KEY]) || null;
        cofreStore = (res && res[COFRE_KEY]) || null;        // o que a automação gravou do cofre
        ofertasStore = (res && res[OFERTAS_KEY]) || null;    // o que a automação gravou do mercado
        estadoStore = (res && res[ESTADO_KEY]) || null;      // estado COMPLETO do jogo (motor grava a cada 20 s)
        // Preferências da GUI (minimizar da build por fase, modalidade de farm): não são config
        // da automação, por isso vivem em GUI_KEY e não em STORAGE_KEY.
        guiPrefs = Object.assign({ bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false }, (res && res[GUI_KEY]) || {});
        ultimoRender = 0;
        // O render corre no arranque e nos segundos seguintes, com o painel fechado ou aberto.
        // Se dependesse de alguém abrir o painel (hover, F8), os blocos ficavam no placeholder
        // inicial (#ap-fase="carregando…", #ap-h-*="-", #ap-build-fase=""). Renderiza uma
        // vez no arranque, sempre.
        renderTudo();
        // O arranque do content script corre ANTES de o HUD do jogo estar pintado
        // (medido: a 1.ª render deixava #ap-h-nivel e #ap-h-ouro a "-" enquanto a
        // fase e o build já saíam certos). Como o `tick()` não corre com o painel
        // fechado, esses dois campos ficavam a "-" para sempre. Re-renderiza nos
        // primeiros segundos até o HUD existir.
        for (const t of [1500, 4000, 9000, 16000]) setTimeout(() => { try { renderTudo(); } catch { /* ignore */ } }, t);
      });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area !== 'local') return;
        if (ch[STATUS_KEY]) status = ch[STATUS_KEY].newValue;
        if (ch[FARM_KEY]) farmStore = ch[FARM_KEY].newValue;
        if (ch[AGG_KEY]) aggStore = ch[AGG_KEY].newValue;
        // O MOTOR grava aqui o que leu (cofre/mercado): a GUI passa a mostrá-lo sem ninguém pedir.
        if (ch[COFRE_KEY]) { cofreStore = ch[COFRE_KEY].newValue; cacheLimpar('cofreLive'); if (aberto && tabAtiva === 'itens') renderCofre(); }
        if (ch[OFERTAS_KEY]) { ofertasStore = ch[OFERTAS_KEY].newValue; if (aberto && tabAtiva === 'mercado') renderMercado(); }
        // ESTADO COMPLETO: a automação grava-o a cada 20 s; a GUI redesenha o retrato quando chega.
        if (ch[ESTADO_KEY]) { estadoStore = ch[ESTADO_KEY].newValue; if (aberto && tabAtiva === 'painel') renderAgora(); }
        if (ch[STORAGE_KEY]) config = ch[STORAGE_KEY].newValue;
        // Preferências da GUI: mudam o que se vê (bloco minimizado, modalidade de farm).
        if (ch[GUI_KEY]) {
          guiPrefs = Object.assign({ bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false }, ch[GUI_KEY].newValue || {});
          if (aberto) { _ultimoHtml.delete('ap-build-fase'); renderTudo(); }
        }
        if (ch[STATUS_KEY] || ch[FARM_KEY]) { cacheAgora = { at: 0, v: null }; if (aberto && tabAtiva === 'painel') renderAgora(); }
      });
    } catch (e) { /* sem storage */ }
    // AUTO-LIMPEZA: reinjecções do script não podem empilhar temporizadores.
    const _GT = (window.__lolidleGuiTimers = window.__lolidleGuiTimers || []);
    for (const t of _GT) { try { clearInterval(t); clearTimeout(t); } catch (e) { /* ignore */ } }
    _GT.length = 0;
    const every = (ms, fn) => { const id = setInterval(fn, ms); _GT.push(id); return id; };
    every(1000, tick);
    // o nome do jogador pode aparecer depois do arranque: tenta por 2 minutos.
    let tentativas = 0;
    const t2 = setInterval(() => { if (attachHover() || ++tentativas > 240) clearInterval(t2); }, 500);
    attachHover();
    // Exposto para quem quiser abrir o painel por código (testes/manutenção).
    // `setTab` aceita os nomes antigos das 8 abas (TAB_ALIAS) e leva-os às 4 de agora.
    window.__lolidleGui = { abrir, fechar, setTab, versao: '2.1' };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();


})();
