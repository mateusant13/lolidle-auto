/*
 * LoL Idle — Auto Poção · gui.js  (world: ISOLATED)
 * =============================================================================
 * PAINEL DO USUÁRIO do auto-play.
 *
 * COMO ABRIR (o caminho REAL — é este que as verificações e os prints têm de usar):
 *   • hover no SEU NOME (canto superior direito do jogo)  • botão flutuante ⚙  • tecla F8
 *   • ou por código: window.__lolidleGui.abrir()  (fecha com fechar(); troca de aba: setTab())
 * `classList.add('on')` NÃO é o caminho real: só mostra o painel — quem pinta o conteúdo é o
 * `abrir()` interno. Quem abrir por classe vai ver o painel vazio e achar que é bug.
 *
 * COMO ESTE ARQUIVO ESTÁ ORGANIZADO (procura pelos números):
 *   0. CONSTANTES E AJUDANTES ....... formatação (fmt/esc/…) e ícones do jogo
 *   1. PONTE COM O MOTOR ............ só chama funções que EXISTEM em window.__lolidleAuto
 *   2. KIT DE INTERFACE ............. cartões, linhas, botões, barra de estado, confirmação
 *   3. CSS .......................... estilos do painel e dos modais
 *   4. ESTRUTURA (DOM) .............. o HTML do painel e dos 3 modais
 *   5. DESENHADORES (render) ........ um por aba; lêem o motor e escrevem no DOM
 *   6. AÇÕES (bind) ................. cada botão com confirmação, estado "rodando" e resposta
 *   7. ARRANQUE ..................... liga tudo, agenda os redesenhos, auto-limpeza de timers
 *
 * REGRAS QUE ESTE PAINEL CUMPRE:
 *   • Nomes de USUÁRIO, não nomes de função do motor. Jargão tem tradução (botão "?").
 *   • Cada controle tem UMA LINHA de explicação e diz o que faz ao ser clicado.
 *   • Estados visíveis: verde = ligado/rodando · cinza = desligado · amarelo = à espera/pausado.
 *   • Nada de botões mortos: se o motor não tem a função, o botão fica desativado e DIZ POR QUÊ.
 *   • Ações destrutivas pedem confirmação (vender, reanunciar, gastar pontos, apostar no Ornn).
 *   • O motor nunca é modificado daqui: só se lê estado e se chamam funções existentes.
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
  const COFRE_KEY = STORAGE_KEY + ':cofre';       // { at, itens }   — conteúdo do cofre
  const OFERTAS_KEY = STORAGE_KEY + ':ofertas';   // { at, ofertas } — minhas ofertas
  // ESTADO COMPLETO do jogo (automation.js: `estadoCompleto`, gravado a cada 20 s). A GUI lê-o
  // para mostrar inventário/cofre/habilidades/mobs/bosses SEM varrer o DOM nem custar nada.
  const ESTADO_KEY = STORAGE_KEY + ':estado';     // { at, campeao, inventario, cofre, ... }
  // Preferências SÓ da GUI (não são config do motor: `setConfig` escreve no objeto que o
  // motor lê e um campo desconhecido lá dentro seria lixo na config dele). Guarda aqui o
  // minimizar do bloco da build por fase e dos cartões de farm, e a modalidade de farm escolhida.
  const GUI_KEY = STORAGE_KEY + ':gui';

  const ORDER = ['vidaS', 'vidaF', 'vida'];
  const POCAO_NOME = { vidaS: 'Suprema', vidaF: 'Forte', vida: 'Normal' };
  const POCAO_CURA = { vidaS: 2200, vidaF: 900, vida: 300 };
  const RABADON = '3089';
  const LOGO = 'https://lolidle.com/assets/img/logo.png';
  const ITEM_IMG = (id) => 'https://lolidle.com/assets/img/itens/' + id + '.png';

  // Nomes de usuário para as ações que o motor dá em MAIÚSCULAS técnicas.
  const ACAO_ITEM = {
    PROTEGER: { txt: 'Protegido — não sai da mochila', cls: 'proteg' },
    GUARDAR: { txt: 'Fica guardado na mochila', cls: 'guard' },
    GUARDAR_COFRE: { txt: 'Vai para o cofre', cls: 'guard' },
    ANUNCIAR_MERCADO: { txt: 'Vai para o mercado (venda a jogadores)', cls: 'mkt' },
    VENDER_LOJISTA: { txt: 'Vai ser VENDIDO ao lojista', cls: 'loj' },
  };
  // Tradução das "travas" internas do motor (diagnosticoBase) para português de gente.
  const TRADUZ_TRAVA = [
    [/^enabled=false$/, 'o auto-play está DESLIGADO (liga no switch aqui em cima)'],
    [/^pausado$/, 'está PAUSADO (botão ⏸)'],
    [/^nao-esta-na-base$/, 'você já não está na Fonte'],
    [/^ocupado/, 'há uma janela do jogo aberta (mercado/loja) — o motor espera que você feche'],
    [/^_baseBusy/, 'a rotina da base está rodando neste momento'],
    [/^baseLock/, 'a rotina da base ficou presa (destranca sozinha em segundos)'],
    [/^idle (\d+)s < (\d+)s$/, 'só sai da Fonte depois de estar parado tempo suficiente'],
    [/^sem regiao ideal$/, 'não encontrou nenhuma região boa para o seu nível'],
  ];
  const traduzTrava = (t) => {
    for (const [re, txt] of TRADUZ_TRAVA) if (re.test(String(t))) return txt + (re.source.includes('idle') ? ' (' + t + ')' : '');
    return String(t);
  };
  // Nomes de usuário para os eventos do motor (aba Histórico).
  const EVENTO_NOME = {
    pause: 'pausa', morte: 'morte', tarefa: 'tarefa', diaria: 'missão diária', campeao: 'campeão detectado',
    teste: 'teste de conjuntos', 'giro-ir': 'viajando para região', 'giro-fim': 'giro terminado', ornn: 'Ornn',
    montagem: 'montagem no Ornn', base: 'rotina de base', cofre: 'cofre', 'chefe-fatal': 'chefe perigoso',
    novidades: 'novidades do jogo', habilidades: 'subir habilidades', atributos: 'atributos',
    runeterra: 'Runeterra (manual)', mercado: 'mercado', compra: 'compra', refino: 'refino',
    ciclo: 'ciclo', wave: 'onda', alvo: 'alvo', loot: 'loot', chefe: 'chefe', xp: 'experiência', ouro: 'ouro',
    'build-fase': 'troca de build (mobs ↔ chefe)',
  };

  let config = null;      // espelho de chrome.storage.local[STORAGE_KEY]
  let status = null;      // espelho de STATUS_KEY (content.js: HP, poções, última ação)
  let farmStore = null;   // espelho de FARM_KEY
  let aggStore = null;    // espelho de AGG_KEY
  let cofreStore = null;  // espelho de COFRE_KEY: { at, itens } — última leitura GRAVADA do cofre
  let ofertasStore = null;// espelho de OFERTAS_KEY: { at, ofertas } — última leitura do mercado
  let estadoStore = null; // espelho de ESTADO_KEY: estado COMPLETO do jogo (motor grava a cada 20 s)
  let aberto = false, fixado = false, saveTimer = null, tabAtiva = 'painel', ultimoRender = 0, cacheAgora = { at: 0, v: null };
  // Espelho de GUI_KEY (preferências da GUI, não do motor). `bfAberto`: o bloco da build por
  // fase está aberto? `farmModo`: 'sozinho' (o motor escolhe a região) ou 'item' (escolhe-se
  // o que dropar). Lido no boot e reescrito a cada clique — sobrevive ao F5.
  let guiPrefs = { bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false };

  // ============================================================ 0b. AJUDANTES
  const $ = (id) => document.getElementById(id);
  const q1 = (s) => document.querySelector(s);
  const qa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const fmt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('pt-BR') : '—');
  const fmt1 = (n) => (Number.isFinite(Number(n)) ? (Math.round(Number(n) * 10) / 10).toLocaleString('pt-BR') : '—');
  const pct = (n) => (Number.isFinite(Number(n)) ? (Math.round(Number(n) * 1000) / 10).toFixed(1) + '%' : '—');
  const fmtDur = (ms) => {
    const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'min ' + String(s % 60).padStart(2, '0') + 's';
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min';
  };
  const hora = (t) => (t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
  const limparNivel = (s) => String(s || '?').replace(/\s*n[íi]vel.*$/i, '').replace(/\s*\(.*?\)\s*$/, '').trim();
  const potIcon = (k) => (q1('#hud-pocoes [data-pocao="' + k + '"] img') || {}).src || '';
  // Número como o JOGO o escreve. O `fmt` do jogo (docs/game-src/cena.js:225) mete sufixo
  // acima de 10.000 ("12.3k") e acima de 1.000.000 ("1.2M") — e é esse texto que vive no DOM
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
  /** Chama uma função do motor SEM nunca rebentar a GUI. Devolve {ok, v} ou {ok:false, erro}. */
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
   *  Regra da ponte: TODOS os argumentos a partir do 3.º são repassados ao motor. Sem isso,
   *  `ler('planBag', null, bag)` chamava `planBag()` sem a mochila e o motor rebentava com
   *  "Cannot read properties of undefined (reading 'items')" — e na GUI isso aparecia como
   *  "não foi possível calcular o plano da mochila": um erro NOSSO mostrado como falha do motor.
   *  O mesmo vale para `rankRegioes(obj)`, `dpsItens(ids, regiao)`, `preverBuild(ids, regiao)`,
   *  `ehUltimate(t)`, `localId(txt)`, `planPotions(pot)` e `faltandoNaBase(n)`. */
  function ler(nome, rec) {
    const extra = Array.prototype.slice.call(arguments, 2);
    const r = extra.length ? chamar.apply(null, [nome].concat(extra)) : chamar(nome);
    return r.ok && r.v != null ? r.v : (rec === undefined ? null : rec);
  }
  const erroLegivel = (erro, nome) => {
    if (erro === 'sem-motor') return 'o motor do auto-play ainda não carregou nesta página — recarrega com F5';
    if (erro === 'sem-funcao') return 'esta versão do motor não tem a função "' + nome + '" (nada foi feito)';
    return String(erro);
  };
  /** Nome legível de um item (do catálogo do motor). */
  const nomeItem = (base) => {
    const meta = ler('getMeta', {}) || {};
    const it = (meta.itens || []).find((x) => String(x.id) === String(base));
    return it ? (it.nome || String(base)) : String(base);
  };
  const locais = () => (ler('getMeta', {}) || {}).locais || [];
  const nomeRegiao = (id) => { const l = locais().find((x) => x.id === id); return l ? limparNivel(l.nome) : String(id || '—'); };
  const idRegiaoDe = (txt) => ler('localId', null, txt) || null;

  // ============================================================ 2. KIT DE INTERFACE
  const card = (titulo, ajuda, corpo, id) =>
    '<section class="card"' + (id ? ' id="' + id + '"' : '') + '><h3>' + titulo +
    (ajuda ? '<span class="obs">' + ajuda + '</span>' : '') + '</h3><div class="corpo">' + corpo + '</div></section>';
  /** Cartão com botão de MINIMIZAR no cabeçalho (o mesmo padrão do bloco da build por fase).
   *  `min` = true mostra só o título; o estado vive nas preferências da GUI e sobrevive ao F5. */
  const cardMin = (id, titulo, ajuda, corpo, min, btnId, aberto) =>
    '<section class="card' + (min ? ' min' : '') + '"' + (id ? ' id="' + id + '"' : '') + '><h3>' + titulo +
    (ajuda ? '<span class="obs">' + ajuda + '</span>' : '') +
    '<button class="ic bf-min" id="' + btnId + '" title="' +
    (aberto ? 'Minimizar: deixa só o título (o mesmo botão volta abrindo)' : 'Abrir este bloco') + '">' +
    (aberto ? '▾' : '▸') + '</button></h3><div class="corpo">' + corpo + '</div></section>';
  const kv = (rotulo, valor, ajuda) =>
    '<div class="kv2"><span>' + rotulo + '</span><b>' + valor + '</b>' + (ajuda ? '<small>' + ajuda + '</small>' : '') + '</div>';
  const linha = (rotulo, ajuda, ctrl) =>
    '<div class="ctl"><div class="ctl-l"><b>' + rotulo + '</b>' + (ajuda ? '<small>' + ajuda + '</small>' : '') + '</div><div class="ctl-c">' + ctrl + '</div></div>';
  // `off` (opcional): botão que NÃO pode ser usado agora — fica desativado e a ajuda diz por quê.
  const acao = (id, texto, ajuda, cls, off) =>
    '<div class="acao"><button id="' + id + '" class="btn ' + (cls || '') + '"' + (off ? ' disabled' : '') + '>' + texto + '</button><small>' + ajuda + '</small></div>';
  /** Bloco de AÇÕES MANUAIS — sempre despromovido e no fim do cartão.
   *  A GUI mostra o que acontece SOZINHO (estado, switches, o que o motor vai fazer e o que
   *  está bloqueado); o clique manual fica aqui, rotulado como manutenção manual, para não
   *  parecer o caminho normal. Nada foi apagado: os mesmos handlers continuam ligados aos
   *  mesmos ids. */
  const diag = (titulo, corpo) => '<p class="diag-t">' + titulo + '</p>' + (corpo || '');
  const acaoD = (id, texto, ajuda, off) =>
    '<div class="acao"><button id="' + id + '" class="btn sec"' + (off ? ' disabled' : '') + '>' + texto
    + '<small class="tagd">manual</small></button><small>' + ajuda + '</small></div>';
  const tg = (id, rotulo, ajuda, marcado) =>
    '<label class="tg"><input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + '><span class="sw"></span>' +
    '<span class="tg-t"><b>' + rotulo + '</b><small>' + ajuda + '</small></span></label>';
  const itemFrame = (base, qual, refino, raridade, titulo) =>
    '<span class="iframe ' + esc(raridade || '') + '" title="' + esc(titulo || '') + '">' +
    '<img src="' + ITEM_IMG(base) + '" alt="" loading="lazy" onerror="this.style.opacity=.2">' +
    (qual ? '<b class="q">' + esc(qual) + (refino ? '+' + esc(refino) : '') + '</b>' : '') + '</span>';
  const tabela = (colunas, linhas, vazio) => {
    const corpo = Array.isArray(linhas) ? linhas.join('') : String(linhas == null ? '' : linhas);
    if (!corpo) return '<p class="vazio">' + (vazio || 'sem dados ainda') + '</p>';
    return '<div class="scroll"><table class="tbl"><thead><tr>' + colunas.map((c) => '<th>' + c + '</th>').join('') +
      '</tr></thead><tbody>' + corpo + '</tbody></table></div>';
  };

  /** Faixa de resposta do rodapé — TODAS as ações escrevem aqui. */
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
      if (!sim) { fbAviso('Cancelado — nada foi feito.'); return null; }
    }
    ocupar(btn, true);
    fbCorrer(rotulo + '…');
    let res;
    try { res = await trabalho(); }
    catch (e) { res = { ok: false, motivo: 'erro inesperado: ' + String((e && e.message) || e) }; }
    ocupar(btn, false);
    if (res === undefined || res === null) { fbOk(rotulo + ': feito.'); res = { ok: true }; }
    else if (res.ok === false) fbErro(rotulo + ': ' + (res.motivo || res.erro || 'não foi possível (o motor não disse porquê)'));
    else if (res.erro) fbErro(rotulo + ': ' + erroLegivel(res.erro, res.funcao));
    else fbOk(rotulo + ': ' + (res.msg || 'feito.'));
    if (typeof res === 'object' && res) res.__rotulo = rotulo;
    return res;
  }
  /** Resultado de uma chamada ao motor, já traduzido para o envelope acima. */
  const resMotor = (r, funcao, msgOk) => {
    if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, funcao), erro: r.erro, funcao };
    const v = r.v;
    if (v && typeof v === 'object' && v.ok === false) return { ok: false, motivo: v.motivo || 'o motor recusou', v };
    return { ok: true, msg: typeof msgOk === 'function' ? msgOk(v) : (msgOk || 'feito'), v };
  };

  // ============================================================ 3. CSS
  const CSS = [
    '#lolidle-ap{--bg:#100e0c;--pnl:#191614;--pnl2:#141110;--lin:#332c24;--lin2:#231e19;--txt:#e9e0cf;--dim:#9d9280;--ouro:#ffd070;--verde:#4ce06a;--ambar:#ffb020;--verm:#ff6a4a;--azul:#7cc4ff;',
    'position:fixed;top:36px;right:8px;z-index:2147483647;width:min(1020px,80vw);max-height:min(820px,92vh);display:none;flex-direction:column;overflow:hidden;',
    'background:var(--bg);color:var(--txt);border:1px solid var(--lin);border-radius:12px;box-shadow:0 16px 60px #000c;font:12px/1.45 system-ui,"Segoe UI",Roboto,sans-serif;opacity:0;visibility:hidden;transform:translateY(-6px);transition:.12s}',
    '#lolidle-ap.on{opacity:1;visibility:visible;display:flex;transform:none}',
    '#lolidle-ap *{box-sizing:border-box;min-width:0}',
    '#lolidle-ap .sp{flex:1}',
    '#lolidle-ap header{background:linear-gradient(180deg,#1e1a17,#151211);border-bottom:1px solid var(--lin);padding:7px 10px;display:flex;flex-direction:column;gap:6px}',
    '#lolidle-ap .hrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '#lolidle-ap .logo{height:20px;width:auto}',
    '#lolidle-ap .tit{font-weight:800;font-size:13px;letter-spacing:.2px}',
    '#lolidle-ap .fase{color:var(--dim);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:58%}',
    '#lolidle-ap .pill{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:2px 9px;font-size:10.5px;font-weight:700;border:1px solid var(--lin)}',
    '#lolidle-ap .pill i{width:8px;height:8px;border-radius:50%;background:#5a5145;display:block}',
    '#lolidle-ap .pill.on{color:var(--verde);border-color:#2b5c33}#lolidle-ap .pill.on i{background:var(--verde);box-shadow:0 0 7px #4ce06a99}',
    '#lolidle-ap .pill.off{color:var(--dim)}#lolidle-ap .pill.off i{background:#5a5145}',
    '#lolidle-ap .pill.run{color:var(--ambar);border-color:#6d5520}#lolidle-ap .pill.run i{background:var(--ambar);box-shadow:0 0 7px #ffb02099}',
    '#lolidle-ap .pill.err{color:var(--verm);border-color:#6d2a20}#lolidle-ap .pill.err i{background:var(--verm)}',
    '#lolidle-ap .ic{background:#221d19;color:var(--txt);border:1px solid var(--lin);border-radius:6px;width:24px;height:22px;line-height:1;cursor:pointer;font-size:12px;padding:0}',
    '#lolidle-ap .ic:hover{background:#2c2620}',
    '#lolidle-ap .ic.ativo{background:#3a2f1e;border-color:#7a5f2a;color:var(--ouro)}',
    '#lolidle-ap .mini{display:flex;flex-direction:column;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:3px 8px;min-width:70px}',
    '#lolidle-ap .mini b{font-size:12.5px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap .mini small{color:var(--dim);font-size:9.5px}',
    '#lolidle-ap .mini.wide{min-width:150px;max-width:270px}',
    '#lolidle-ap .ligar{display:flex;align-items:center;gap:7px;background:#1a1512;border:1px solid var(--lin);border-radius:8px;padding:4px 9px;cursor:pointer}',
    '#lolidle-ap .ligar b{font-size:11px}',
    '#lolidle-ap .sw{position:relative;width:38px;height:20px;flex:none;display:inline-block}',
    '#lolidle-ap .sw::before{content:"";position:absolute;inset:0;background:#3a332a;border-radius:20px;transition:.15s}',
    '#lolidle-ap .sw::after{content:"";position:absolute;width:14px;height:14px;left:3px;top:3px;background:#8a7f6c;border-radius:50%;transition:.15s}',
    '#lolidle-ap input:checked+.sw::before{background:#245c2c}',
    '#lolidle-ap input:checked+.sw::after{transform:translateX(18px);background:var(--verde)}',
    '#lolidle-ap .sw input{display:none}',
    '#lolidle-ap nav{display:flex;gap:2px;padding:5px 8px 0;background:#151211;border-bottom:1px solid var(--lin);flex-wrap:wrap}',
    '#lolidle-ap .tab{background:#1c1916;color:#c8bda8;border:1px solid var(--lin);border-bottom:0;border-radius:7px 7px 0 0;padding:6px 11px;font-size:11.5px;font-weight:700;cursor:pointer}',
    '#lolidle-ap .tab:hover{color:var(--txt)}',
    '#lolidle-ap .tab.ativa{background:#2b2117;color:var(--ouro);border-color:#7a5f2a}',
    '#lolidle-ap main{flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:7px}',
    '#lolidle-ap .pane{display:none;flex-direction:column;gap:7px}',
    '#lolidle-ap .pane.on{display:flex}',
    '#lolidle-ap .intro{color:var(--dim);font-size:11px;background:#151211;border:1px solid var(--lin2);border-left:3px solid #33505f;border-radius:0 7px 7px 0;padding:5px 9px}',
    // ---- ÁRVORE DE INTERRUPTORES (aba Auto-play): pais e filhos INDENTADOS ----
    '#lolidle-ap .arv{display:flex;flex-direction:column;gap:4px}',
    '#lolidle-ap .arv-filhos{display:flex;flex-direction:column;gap:4px;margin:1px 0 0 8px;padding-left:9px;border-left:2px solid #2a241d}',
    '#lolidle-ap .arv-no{display:flex;align-items:center;gap:7px;flex-wrap:wrap;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:4px 8px}',
    '#lolidle-ap .arv-no>b{font-size:11.5px}',
    '#lolidle-ap .arv-no .arv-dot{width:9px;height:9px;border-radius:50%;background:#5a5145;flex:none}',
    '#lolidle-ap .arv-no .arv-est{font-size:10px;color:var(--dim)}',
    '#lolidle-ap .arv-no.on{border-color:#2b5c33}',
    '#lolidle-ap .arv-no.on .arv-dot{background:var(--verde);box-shadow:0 0 6px #4ce06a99}',
    '#lolidle-ap .arv-no.on .arv-est{color:var(--verde)}',
    '#lolidle-ap .arv-no.bloq{opacity:.55;border-style:dashed}',
    '#lolidle-ap .arv-no.bloq .arv-est{color:#8a7f6c}',
    '#lolidle-ap .arv-no.skip{border-color:#7a5f2a;background:#1d1710}',
    '#lolidle-ap .arv-no.skip .arv-dot{background:var(--ambar);box-shadow:0 0 6px #ffb02099}',
    '#lolidle-ap .arv-no .arv-motivo{font-size:10px;color:var(--ambar)}',
    '#lolidle-ap .arv-no .arv-motivo b{color:var(--txt)}',
    '#lolidle-ap .arv-no .arv-cfg{font-size:9px;color:#6a6256;background:#0d0b0a;border:1px solid var(--lin2);border-radius:4px;padding:0 4px;white-space:nowrap}',
    '#lolidle-ap .arv-no .arv-exc{border-color:#7a5f2a;color:var(--ambar);background:#241c0d}',
    '#lolidle-ap .arv-no.mestre{border-color:#7a5f2a;background:#1d1710}',
    '#lolidle-ap .arv-no.mestre>b{font-size:12.5px;color:var(--ouro)}',
    // linha do que cada switch COBRE: verde = ligado, vermelho = desligado
    '#lolidle-ap .arv-cobre{margin:0 0 2px;font-size:10px;padding:2px 8px;border-left:2px solid #2a241d}',
    '#lolidle-ap .arv-cobre.on{color:#8fe6a4}',
    '#lolidle-ap .arv-cobre.off{color:#ff9a8a}',
    // ---- switch da árvore (pequeno, sem a moldura do .tg) ----
    '#lolidle-ap .arv-tg{display:flex;align-items:center;flex:none;cursor:pointer;margin-right:1px}',
    '#lolidle-ap .arv-tg input{display:none}',
    '#lolidle-ap .arv-tg .sw{width:32px;height:18px}',
    '#lolidle-ap .arv-tg .sw::after{width:12px;height:12px;left:3px;top:3px}',
    '#lolidle-ap .arv-tg input:checked+.sw::after{transform:translateX(14px)}',
    // ---- BUILD POR FASE (mobs x chefe) — agora DENTRO da aba Itens ----
    // Este bloco vive DENTRO da aba Itens. Fora de todos os `.pane` ele aparecia por cima de
    // TODAS as abas (o CSS dos separadores só esconde `.pane`) e nada o escondia. Agora tem
    // botão de minimizar a sério.
    '#lolidle-ap #ap-build-fase{flex:none}',
    '#lolidle-ap .bf>h3{align-items:center}',
    '#lolidle-ap .bf-min{flex:none;width:26px;height:22px;font-size:11px}',
    '#lolidle-ap .card.min{padding:6px 10px}',
    '#lolidle-ap .card.min .corpo{display:none}',
    // ---- ESTADO DO AUTO-PLAY (aba Painel) ----
    '#lolidle-ap .est{margin:0;font-size:11.5px;padding:6px 9px;border-radius:7px;border:1px solid var(--lin2);background:var(--pnl2)}',
    '#lolidle-ap .est b{font-size:12.5px}',
    '#lolidle-ap .est.on{color:#bdf0c8;border-color:#2b5c33;background:#152218}',
    '#lolidle-ap .est.off{color:#c8bda8;border-color:var(--lin);background:#151211}',
    '#lolidle-ap .est.run{color:#ffdca8;border-color:#6d5520;background:#241c0d}',
    '#lolidle-ap .est.err{color:#ffc6ba;border-color:#6d2a20;background:#251310}',
    '#lolidle-ap .sec-acoes{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    // ---- ACOES MANUAIS: bloco despromovido (diagnostico) ----
    // O clique manual continua a existir (nada foi apagado do motor), mas sempre no fim do
    // cartao, tracejado e rotulado como manutencao manual.
    '#lolidle-ap .diag-t{margin:7px 0 4px;padding-top:6px;border-top:1px dashed var(--lin2);font-size:10px;color:#8a7f6c;text-transform:uppercase;letter-spacing:.4px}',
    '#lolidle-ap .diag-t + .acoes .acao{background:#121010;border-style:dashed}',
    '#lolidle-ap .diag-t + .acoes .btn{font-size:10.5px;padding:4px 8px;font-weight:600}',
    '#lolidle-ap .tagd{display:inline-block;font-size:8.5px;color:#8a7f6c;border:1px solid var(--lin2);border-radius:4px;padding:0 3px;margin-left:5px}',
    // ---- DUAS MODALIDADES DE FARM (aba Ganhos) ----
    '#lolidle-ap .modos{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    '#lolidle-ap .modo{display:flex;flex-direction:column;gap:2px;text-align:left;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:7px 9px;color:var(--txt);cursor:pointer;font:inherit}',
    '#lolidle-ap .modo:hover{border-color:#4a4030}',
    '#lolidle-ap .modo b{font-size:11.5px}',
    '#lolidle-ap .modo small{color:var(--dim);font-size:9.5px;line-height:1.35}',
    '#lolidle-ap .modo.ativa{border-color:#7a5f2a;background:#241c0d;box-shadow:inset 0 0 0 1px #7a5f2a}',
    '#lolidle-ap .modo.ativa b{color:var(--ouro)}',
    '#lolidle-ap .bf-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    '#lolidle-ap .bf-col{background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:6px 8px}',
    '#lolidle-ap .bf-col.em-uso{border-color:#7a5f2a;box-shadow:inset 0 0 0 1px #7a5f2a}',
    '#lolidle-ap .bf-col h4{margin:0 0 3px;font-size:11.5px;color:var(--ouro);display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '#lolidle-ap .bf-col h4 .tag{font-size:9.5px;background:#3a2f1e;color:var(--ouro);border:1px solid #7a5f2a;border-radius:20px;padding:0 6px;font-weight:700}',
    '#lolidle-ap .bf-col h4 .tag.ok{background:#1d3a24;color:var(--verde);border-color:#2b5c33}',
    '#lolidle-ap .bf-dica{margin:0 0 4px;color:var(--dim);font-size:10px}',
    '#lolidle-ap .bf-itens{display:flex;gap:5px;flex-wrap:wrap}',
    // O chip tem 82px de largura para o NOME do item: sem espaço só se via a qualidade
    // ("A +2 equipado"), sem saber que peça era.
    '#lolidle-ap .bf-item{position:relative;width:82px;height:54px;border:2px solid #332c24;border-radius:6px;background:#191614;display:block;overflow:hidden}',
    '#lolidle-ap .bf-item img{width:100%;height:100%;object-fit:cover;display:block}',
    '#lolidle-ap .bf-item .q{position:absolute;top:0;right:1px;font-size:9px;color:var(--ouro);text-shadow:0 0 3px #000}',
    '#lolidle-ap .bf-item small{position:absolute;left:0;right:0;bottom:0;font-size:8.5px;text-align:center;background:#000c;color:#c8bda8;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap .bf-item small .bf-nome{font-weight:700;color:#e8dcc4}',
    '#lolidle-ap .bf-item.equipado{border-color:#4ce06a}',
    '#lolidle-ap .bf-item.cofre{border-color:#7cc4ff}',
    '#lolidle-ap .bf-item.mercado{border-color:#ffd070}',
    '#lolidle-ap .bf-item.falta{border-color:#7a1f14;opacity:.6}',
    '#lolidle-ap .bf-item.falta small{color:#ffb0a0}',
    '#lolidle-ap .card{background:var(--pnl);border:1px solid var(--lin2);border-radius:8px;padding:8px 10px}',
    '#lolidle-ap .card>h3{margin:0 0 6px;font-size:12px;font-weight:800;color:var(--ouro);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
    '#lolidle-ap .card>h3 .obs{color:var(--dim);font-weight:400;font-size:10px;margin-left:auto}',
    '#lolidle-ap .card .corpo{display:flex;flex-direction:column;gap:5px}',
    '#lolidle-ap .grid2{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
    '#lolidle-ap .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}',
    '#lolidle-ap .kvs{display:flex;flex-wrap:wrap;gap:5px}',
    '#lolidle-ap .kv2{display:flex;flex-direction:column;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:3px 8px;min-width:88px;flex:1}',
    '#lolidle-ap .kv2 span{color:var(--dim);font-size:9.5px}',
    '#lolidle-ap .kv2 b{font-size:13px;font-variant-numeric:tabular-nums}',
    '#lolidle-ap .kv2 small{color:var(--dim);font-size:9px}',
    '#lolidle-ap .ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:4px 0;border-bottom:1px solid #1e1a16}',
    '#lolidle-ap .ctl:last-child{border-bottom:0}',
    '#lolidle-ap .ctl-l{display:flex;flex-direction:column;flex:1;min-width:200px}',
    '#lolidle-ap .ctl-l b{font-size:11.5px}',
    '#lolidle-ap .ctl-l small{color:var(--dim);font-size:10px}',
    '#lolidle-ap .ctl-c{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '#lolidle-ap .acoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:7px}',
    '#lolidle-ap .acao{display:flex;flex-direction:column;gap:3px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:6px 7px}',
    '#lolidle-ap .acao small{color:var(--dim);font-size:9.5px;line-height:1.35}',
    '#lolidle-ap .btn{background:#2f6b38;color:#eafff0;border:0;border-radius:6px;padding:6px 9px;font-weight:700;cursor:pointer;font-size:11.5px;font-family:inherit}',
    '#lolidle-ap .btn:hover{filter:brightness(1.15)}',
    '#lolidle-ap .btn.sec{background:#22303a;color:#cfe8ff;border:1px solid #33505f}',
    '#lolidle-ap .btn.warn{background:#4a3410;color:var(--ouro);border:1px solid #7a5f2a}',
    '#lolidle-ap .btn.danger{background:#7a1f14;color:#ffd9d2;border:1px solid #a33a28}',
    '#lolidle-ap .btn.big{padding:7px 13px;font-size:12.5px}',
    '#lolidle-ap .btn:disabled{opacity:.45;cursor:not-allowed}',
    '#lolidle-ap .btn.busy{opacity:.8;cursor:progress}',
    '#lolidle-ap input[type=number],#lolidle-ap input[type=text],#lolidle-ap input[type=search],#lolidle-ap select{background:#0d0b0a;color:var(--txt);border:1px solid var(--lin);border-radius:6px;padding:4px 6px;font:inherit}',
    '#lolidle-ap input[type=number]{width:72px}',
    '#lolidle-ap .tg{display:flex;align-items:flex-start;gap:8px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:6px 8px;cursor:pointer}',
    '#lolidle-ap .tg input{display:none}',
    '#lolidle-ap .tg-t{display:flex;flex-direction:column}',
    '#lolidle-ap .tg-t b{font-size:11.5px}',
    '#lolidle-ap .tg-t small{color:var(--dim);font-size:9.5px}',
    '#lolidle-ap .scroll{max-height:250px;overflow:auto;border:1px solid var(--lin2);border-radius:7px}',
    '#lolidle-ap table.tbl{width:100%;border-collapse:collapse;font-size:10.5px;font-variant-numeric:tabular-nums}',
    '#lolidle-ap table.tbl th{color:var(--dim);font-weight:600;text-align:right;padding:3px 5px;border-bottom:1px solid var(--lin);position:sticky;top:0;background:var(--pnl);white-space:nowrap}',
    '#lolidle-ap table.tbl th:first-child,#lolidle-ap table.tbl td:first-child{text-align:left}',
    '#lolidle-ap table.tbl td:first-child{white-space:normal;min-width:90px}',
    '#lolidle-ap table.tbl td{padding:3px 5px;text-align:right;border-bottom:1px solid #1c1815;color:#c8bda8;white-space:nowrap}',
    '#lolidle-ap table.tbl td:first-child{color:var(--txt)}',
    '#lolidle-ap table.tbl tr.melhor td{background:#1d2417}',
    '#lolidle-ap table.tbl td img{width:16px;height:16px;image-rendering:pixelated;vertical-align:-3px;margin-right:4px}',
    '#lolidle-ap .vazio{color:var(--dim);font-size:10.5px;margin:2px 0}',
    '#lolidle-ap .aviso{margin:3px 0;font-size:10.5px;padding:5px 8px;border-radius:6px;border:1px solid var(--lin2);background:var(--pnl2)}',
    '#lolidle-ap .aviso.ok{color:#bdf0c8;border-color:#2b5c33;background:#152218}',
    '#lolidle-ap .aviso.warn{color:#ffdca8;border-color:#6d5520;background:#241c0d}',
    '#lolidle-ap .aviso.err{color:#ffc6ba;border-color:#6d2a20;background:#251310}',
    '#lolidle-ap .lista{display:flex;flex-direction:column;gap:2px}',
    '#lolidle-ap .ln{display:flex;align-items:center;gap:7px;font-size:10.5px;padding:3px 6px;border-bottom:1px solid #1c1815;flex-wrap:wrap}',
    '#lolidle-ap .ln:last-child{border-bottom:0}',
    '#lolidle-ap .ln time{color:#6a6256;flex:none;font-variant-numeric:tabular-nums}',
    '#lolidle-ap .ln b{color:var(--txt)}',
    '#lolidle-ap .ln .d{color:var(--dim);flex:1;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap .ln.proteg{border-left:3px solid var(--ouro)}',
    '#lolidle-ap .ln.guard{border-left:3px solid #6a6256}',
    '#lolidle-ap .ln.mkt{border-left:3px solid var(--azul)}',
    '#lolidle-ap .ln.loj{border-left:3px solid var(--verm)}',
    '#lolidle-ap .frames{display:flex;gap:5px;flex-wrap:wrap}',
    '#lolidle-ap .iframe{position:relative;width:44px;height:44px;background:#0d0b0a;border:2px solid var(--lin);border-radius:6px;overflow:hidden;display:inline-block}',
    '#lolidle-ap .iframe img{width:100%;height:100%;object-fit:cover;display:block}',
    '#lolidle-ap .iframe .q{position:absolute;right:1px;bottom:1px;font-size:8px;background:#000c;border-radius:3px;padding:0 3px;color:#fff}',
    '#lolidle-ap .iframe.lendario{border-color:#b07a20}#lolidle-ap .iframe.epico{border-color:#7a4fbf}',
    '#lolidle-ap .iframe.falta{border-style:dashed;opacity:.75;filter:grayscale(.6)}',
    '#lolidle-ap .chips{display:flex;flex-wrap:wrap;gap:4px}',
    '#lolidle-ap .chip{display:inline-flex;align-items:center;gap:5px;background:var(--pnl2);border:1px solid var(--lin);border-radius:6px;padding:2px 6px;font-size:10.5px}',
    '#lolidle-ap .chip img{width:18px;height:18px;image-rendering:pixelated}',
    '#lolidle-ap .chip.lendario{border-color:#b07a20}#lolidle-ap .chip.epico{border-color:#7a4fbf}',
    '#lolidle-ap .chip small{color:var(--dim)}',
    '#lolidle-ap .bar{height:14px;border-radius:7px;background:#241f19;overflow:hidden;position:relative;border:1px solid var(--lin)}',
    '#lolidle-ap .bar>i{display:block;height:100%;background:linear-gradient(90deg,#2f6b38,#4ce06a);transition:width .25s}',
    '#lolidle-ap .bar>i.low{background:linear-gradient(90deg,#7a3a10,#ff9a5a)}',
    '#lolidle-ap .bar>i.crit{background:linear-gradient(90deg,#7a1010,#ff4040)}',
    '#lolidle-ap .bar>u{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:#fff;text-shadow:0 1px 2px #000;text-decoration:none}',
    '#lolidle-ap .pots{display:flex;gap:6px;flex-wrap:wrap}',
    '#lolidle-ap .pot{flex:1;min-width:120px;display:flex;align-items:center;gap:6px;background:var(--pnl2);border:1px solid var(--lin2);border-radius:7px;padding:4px 7px}',
    '#lolidle-ap .pot img{width:24px;height:24px;image-rendering:pixelated}',
    '#lolidle-ap .pot .q{font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:var(--verde)}',
    '#lolidle-ap .pot small{color:var(--dim);font-size:9.5px;display:block}',
    '#lolidle-ap .pot.baixo{border-color:#7a3a10;background:#1c1108}#lolidle-ap .pot.baixo .q{color:#ff9a5a}',
    '#lolidle-ap .tag{display:inline-block;background:#1d2733;border:1px solid #33505f;color:#cfe8ff;border-radius:5px;padding:1px 6px;font-size:10px;margin:1px 2px 1px 0}',
    '#lolidle-ap footer{display:flex;align-items:center;gap:9px;padding:6px 10px;background:#151211;border-top:1px solid var(--lin)}',
    '#lolidle-ap .fb{font-size:11px;color:var(--dim);flex:1;min-width:0}',
    '#lolidle-ap .fb.ok{color:var(--verde)}#lolidle-ap .fb.err{color:var(--verm)}#lolidle-ap .fb.warn{color:var(--ambar)}#lolidle-ap .fb.run{color:var(--azul)}',
    '#lolidle-ap .spin{display:inline-block;width:9px;height:9px;border:2px solid #7cc4ff;border-top-color:transparent;border-radius:50%;animation:lolidle-spin .7s linear infinite;vertical-align:-1px;margin-right:5px}',
    '@keyframes lolidle-spin{to{transform:rotate(360deg)}}',
    '#lolidle-ap .muted{color:var(--dim)}',
    '#lolidle-ap .hint{color:var(--dim);font-size:9.5px}',
    '#lolidle-ap .pend{color:var(--verm)}',
    /* botão flutuante para abrir o painel */
    '#lolidle-ap-launch{position:fixed;right:8px;bottom:8px;z-index:2147483646;background:#1b1815;color:#ffd070;border:1px solid #3a3126;border-radius:8px;padding:5px 9px;font:700 11px/1.2 system-ui,sans-serif;cursor:pointer;opacity:.45;transition:.15s}',
    '#lolidle-ap-launch:hover{opacity:1}',
    /* hover no nome do jogador */
    '#st-nome{position:relative;cursor:pointer}',
    '#st-nome::before{content:"";position:absolute;inset:-7px -14px;border-radius:6px}',
    '#st-nome:hover::before{background:rgba(216,180,90,.12)}',
    /* modais */
    '#lolidle-ap-modal,#lolidle-ap-testes,#lolidle-ap-confirma,#lolidle-ap-ajuda{position:fixed;inset:0;z-index:2147483647;background:#000b;display:none;align-items:center;justify-content:center;font:12px/1.45 system-ui,"Segoe UI",sans-serif;color:#e9e0cf}',
    '#lolidle-ap-modal.on,#lolidle-ap-testes.on,#lolidle-ap-confirma.on,#lolidle-ap-ajuda.on{display:flex}',
    '#lolidle-ap-modal .box,#lolidle-ap-testes .box,#lolidle-ap-ajuda .box{background:#100e0c;border:1px solid #3a3126;border-radius:11px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 16px 60px #000c}',
    '#lolidle-ap-modal .box{width:min(880px,94vw);height:min(700px,90vh)}',
    '#lolidle-ap-testes .box{width:min(960px,94vw);height:min(720px,90vh)}',
    '#lolidle-ap-ajuda .box{width:min(780px,94vw);height:min(700px,90vh)}',
    '.lolidle-box header{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#1c1916;border-bottom:1px solid #332c24;flex-wrap:wrap}',
    '.lolidle-box header b{font-size:13px;color:#ffd070}',
    '.lolidle-box .corpo{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:7px}',
    '.lolidle-box footer{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#141210;border-top:1px solid #332c24;flex-wrap:wrap}',
    '.lolidle-box button{background:#2f6b38;color:#eafff0;border:0;border-radius:6px;padding:6px 11px;font-weight:700;cursor:pointer;font:inherit;font-weight:700}',
    '.lolidle-box button.sec{background:#22303a;color:#cfe8ff;border:1px solid #33505f}',
    '.lolidle-box button.danger{background:#7a1f14;color:#ffd9d2;border:1px solid #a33a28}',
    '.lolidle-box input,.lolidle-box select{background:#0d0b0a;color:#e9e0cf;border:1px solid #3a3126;border-radius:6px;padding:4px 6px;font:inherit}',
    '.lolidle-box .muted{color:#9d9280;font-size:10.5px}',
    '#lolidle-ap-modal .filtros{display:flex;align-items:center;gap:6px;padding:7px 12px;border-bottom:1px solid #231e19;flex-wrap:wrap}',
    '#lolidle-ap-modal .grade{flex:1;overflow:auto;padding:9px;display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:7px;align-content:start}',
    '#lolidle-ap-modal .frame{position:relative;aspect-ratio:1;background:#191614;border:2px solid #332c24;border-radius:7px;cursor:pointer;overflow:hidden;padding:0}',
    '#lolidle-ap-modal .frame img{width:100%;height:100%;object-fit:cover;display:block}',
    '#lolidle-ap-modal .frame span{position:absolute;left:0;right:0;bottom:0;font-size:8px;background:#000c;padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#lolidle-ap-modal .frame.epico{border-color:#7a4fbf}#lolidle-ap-modal .frame.lendario{border-color:#b07a20}',
    '#lolidle-ap-modal .frame.sel{border-color:#ffd070;box-shadow:0 0 0 1px #ffd070,0 0 12px #ffd07070}',
    '#lolidle-ap-modal .if{background:#1c1916;color:#c8bda8;border:1px solid #332c24;border-radius:6px;padding:3px 10px;font-size:10.5px;cursor:pointer;font:inherit}',
    '#lolidle-ap-modal .if.ativa{background:#3a2f1e;color:#ffd070;border-color:#7a5f2a}',
    '#lolidle-ap-testes .set{display:grid;grid-template-columns:150px repeat(4,1fr) 120px 28px;gap:5px;align-items:center;background:#191614;border:1px solid #231e19;border-radius:7px;padding:5px 7px}',
    '#lolidle-ap-testes .fixo{color:#9d9280;font-size:10px;display:flex;align-items:center;gap:4px}',
    '#lolidle-ap-testes .res{font-size:10.5px;color:#c8bda8;border-top:1px solid #231e19;padding-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '#lolidle-ap-testes .res b{color:#ffd070}',
    '#lolidle-ap-confirma .box{width:min(520px,92vw);background:#100e0c;border:1px solid #3a3126;border-radius:11px;padding:14px 16px;box-shadow:0 16px 60px #000c}',
    '#lolidle-ap-confirma h3{margin:0 0 8px;font-size:14px;color:#ffd070}',
    '#lolidle-ap-confirma ul{margin:0 0 12px;padding-left:18px;color:#c8bda8;font-size:11.5px}',
    '#lolidle-ap-confirma li{margin:3px 0}',
    '#lolidle-ap-confirma .botoes{display:flex;gap:8px;justify-content:flex-end}',
    '#lolidle-ap-ajuda h4{margin:8px 0 3px;color:#ffd070;font-size:12px}',
    '#lolidle-ap-ajuda p,#lolidle-ap-ajuda li{color:#c8bda8;font-size:11.5px;margin:3px 0}',
    '#lolidle-ap-ajuda dl{margin:0}#lolidle-ap-ajuda dt{color:#ffd070;font-weight:700;font-size:11.5px;margin-top:6px}',
    '#lolidle-ap-ajuda dd{margin:1px 0 0;color:#c8bda8;font-size:11px}',
    '#lolidle-ap-ajuda .macro{background:#191614;border-left:3px solid #33505f;border-radius:0 7px 7px 0;padding:6px 9px;margin:4px 0}',
    '#lolidle-ap-ajuda .macro b{color:#ffd070}',
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
  function build() {
    if ($('lolidle-ap')) return;
    const p = document.createElement('div');
    p.id = 'lolidle-ap';
    p.innerHTML = ''
      + '<header>'
      + '  <div class="hrow">'
      + '    <img class="logo" src="' + LOGO + '" alt="LoL Idle">'
      + '    <span class="tit">Auto-play</span>'
      + '    <span class="pill off" id="ap-estado"><i></i><b>—</b></span>'
      + '    <span class="fase" id="ap-fase">carregando…</span>'
      + '    <span class="sp"></span>'
      + '    <button class="ic" id="ap-pin" title="Fixar aberto (não fecha quando tiras o rato)">📌</button>'
      + '    <button class="ic" id="ap-help" title="Ajuda: como usar, glossário e a ordem do auto-play">?</button>'
      + '    <button class="ic" id="ap-close" title="Fechar (Esc)">✕</button>'
      + '  </div>'
      + '  <div class="hrow">'
      + '    <span class="mini"><b id="ap-h-nivel">—</b><small>nível</small></span>'
      + '    <span class="mini"><b id="ap-h-ouro">—</b><small>ouro</small></span>'
      + '    <span class="mini"><b id="ap-h-hp">—</b><small>vida</small></span>'
      + '    <span class="mini wide"><b id="ap-h-local">—</b><small>onde você está</small></span>'
      + '    <span class="mini wide"><b id="ap-h-regiao">—</b><small>melhor região agora</small></span>'
      + '    <span class="sp"></span>'
      + '    <label class="ligar" title="Liga/desliga o auto-play E a auto-poção">'
      + '      <input type="checkbox" id="ap-on"><span class="sw"></span><b id="ap-on-txt">desligado</b></label>'
      + '    <button id="ap-panic" class="btn danger big" title="Para tudo imediatamente: desliga o auto-play e a auto-poção e pausa o motor">⛔ PARAR TUDO</button>'
      + '  </div>'
      + '</header>'
      // 8 ABAS → 4, agrupadas por ASSUNTO: Painel = estado + switches (controle); Itens = mochila +
      // build por fase + cofre + mercado/Ornn; Personagem = habilidades + atributos;
      // Ganhos = farm/ganhos + histórico. Os ids dos elementos NÃO mudaram (os handlers
      // continuam a encontrar tudo); só mudou a `<section class="pane">` onde cada um vive.
      + '<nav id="ap-tabs">'
      + '  <button class="tab ativa" data-tab="painel">Painel</button>'
      + '  <button class="tab" data-tab="itens">Itens</button>'
      + '  <button class="tab" data-tab="personagem">Personagem</button>'
      + '  <button class="tab" data-tab="ganhos">Ganhos</button>'
      + '</nav>'
      + '<main>'
      + '  <section class="pane on" id="ap-t-painel">'
      // ESTADO + CONTROLE primeiro: é a primeira aba. Um indicador de estado e UM botão
      // principal cujo rótulo diz o que muda; pausar/parar tudo ficam secundários.
      + '    <div id="ap-painel-estado"></div>'
      + '    <p class="intro">PAINEL DE CONTROLE: o que está acontecendo agora, o que o motor vai fazer, o que está bloqueado e os switches que mandam no auto-play. É aqui que se liga e desliga — as ações manuais ficam no fim, em Manutenção manual.</p>'
      + '    <div class="grid2">'
      + '      <div id="ap-now-estado"></div>'
      + '      <div id="ap-now-fase"></div>'
      + '    </div>'
      + '    <div id="ap-now-combate"></div>'
      // RESUMO DE 1 LINHA da build por fase: o bloco grande mudou para a aba Itens (era ele
      // que aparecia preso em todas as abas). Aqui fica só o estado, para não perder a leitura.
      + '    <div id="ap-painel-build"></div>'
      + '    <div id="ap-now-parado"></div>'
      + '    <div id="ap-auto-mestre"></div>'
      // ÁRVORE DE INTERRUPTORES: logo ABAIXO do bloco mestre (o mestre é a raiz da árvore).
      + '    <div id="ap-auto-arvore"></div>'
      + '    <div id="ap-auto-champ"></div>'
      + '    <div class="grid2"><div id="ap-auto-obj"></div><div id="ap-auto-regiao"></div></div>'
      + '    <div id="ap-auto-extras"></div>'
      + '    <div id="ap-auto-falta"></div>'
      + '    <div id="ap-now-pocoes"></div>'
      + '    <div id="ap-now-jogo"></div>'
      + '    <div id="ap-auto-pocoes"></div>'
      + '    <div id="ap-auto-tarefa"></div>'
      + '    <div id="ap-auto-base"></div>'
      + '    <div id="ap-auto-ferramentas"></div>'
      + '    <div id="ap-auto-diag"></div>'
      // AÇÕES MANUAIS no FIM: é o último cartão do painel, despromovido — o caminho normal é
      // o que acontece sozinho.
      + '    <div id="ap-auto-acoes"></div>'
      + '  </section>'
      + '  <section class="pane" id="ap-t-itens">'
      + '    <p class="intro">Tudo o que é ITEM: a build por fase (mobs ↔ chefe), a build de agora contra a ideal, o que está blindado, a mochila, o cofre e o mercado/Ornn.</p>'
      // O BLOCO GRANDE DA BUILD POR FASE (com minimizar) passa a viver aqui, e não antes das abas.
      + '    <div id="ap-build-fase"></div>'
      + '    <div id="ap-it-build"></div>'
      + '    <div id="ap-it-proteg"></div>'
      + '    <div id="ap-it-mochila"></div>'
      + '    <div id="ap-it-plano"></div>'
      + '    <div id="ap-it-dps"></div>'
      + '    <div id="ap-it-cofre"></div>'
      + '    <div id="ap-mk-ofertas"></div>'
      + '    <div id="ap-mk-plano"></div>'
      + '    <div id="ap-mk-ornn"></div>'
      + '    <div id="ap-mk-compra"></div>'
      + '    <div id="ap-mk-watch"></div>'
      + '  </section>'
      + '  <section class="pane" id="ap-t-personagem">'
      + '    <p class="intro">O seu campeão: as HABILIDADES (barra, pontos e ordem de subida) e os ATRIBUTOS (pontos livres e modelo de distribuição).</p>'
      + '    <div class="grid2"><div id="ap-sk-barra"></div><div id="ap-sk-pontos"></div></div>'
      + '    <div id="ap-sk-ideal"></div>'
      + '    <div id="ap-sk-ordem"></div>'
      + '    <div id="ap-sk-dps"></div>'
      + '    <div id="ap-sk-acoes"></div>'
      + '    <div class="grid2"><div id="ap-at-pontos"></div><div id="ap-at-stats"></div></div>'
      + '    <div id="ap-at-lista"></div>'
      + '    <div id="ap-at-modelo"></div>'
      + '    <div id="ap-at-acoes"></div>'
      + '  </section>'
      + '  <section class="pane" id="ap-t-ganhos">'
      + '    <p class="intro">FARM e GANHOS: as duas modalidades (o motor escolhe a região, ou você escolhe os itens que quer dropar), o que você está ganhando por minuto, o histórico por região e o que já aconteceu (mortes, chefes, eventos).</p>'
      + '    <div id="ap-fm-modo"></div>'
      + '    <div id="ap-fm-itens"></div>'
      + '    <div id="ap-fm-agora"></div>'
      + '    <div id="ap-fm-previsor"></div>'
      + '    <div id="ap-fm-regioes"></div>'
      + '    <div id="ap-fm-rank"></div>'
      + '    <div id="ap-fm-ciclos"></div>'
      + '    <div id="ap-hi-mortes"></div>'
      + '    <div id="ap-hi-lutas"></div>'
      + '    <div id="ap-hi-eventos"></div>'
      + '    <div id="ap-hi-problemas"></div>'
      + '  </section>'
      + '</main>'
      + '<footer><span class="fb" id="ap-fb">Pronto. Passa o rato sobre cada botão para ver o que faz.</span>'
      + '<span class="hint" id="ap-hint">F8 ou o seu nome abre · 📌 fixa aberto · Esc fecha</span></footer>';
    (document.body || document.documentElement).appendChild(p);
    p.addEventListener('mouseenter', aoEntrar);
    p.addEventListener('mouseleave', aoSair);
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
        + '<header><b>Escolher itens para farmar</b><span class="muted">o auto-play calcula em que região cada item dropa e leva você até lá</span><span class="sp"></span>'
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
        + '<header><b>Testar conjuntos de itens</b><span class="muted">monte até 4 conjuntos e o motor roda cada um (mobs + chefe) e mede ouro/xp/dano reais. Rabadon é fixo em todos.</span>'
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
      m.innerHTML = '<div class="box lolidle-box"><header><b>Ajuda — como usar e o que querem dizer as palavras</b><span class="sp"></span>'
        + '<button id="ap-aj-x" class="sec">Fechar</button></header>'
        + '<div class="corpo" id="ap-aj-corpo"></div></div>';
      corpo.appendChild(m);
    }
  }

  // ============================================================ 4b. ABRIR/FECHAR
  function abrir() { aberto = true; $('lolidle-ap').classList.add('on'); ultimoRender = 0; renderTudo(); }
  function fechar() { aberto = false; const p = $('lolidle-ap'); if (p) p.classList.remove('on'); }
  function aoEntrar() { clearTimeout(fecharTimer); }
  function aoSair() { if (fixado) return; clearTimeout(fecharTimer); fecharTimer = setTimeout(() => { if (!fixado) fechar(); }, 2500); }
  let fecharTimer = null;
  function nomeEl() { return q1('#st-nome') || q1('#painel-status') || q1('#hud-nome'); }
  function attachHover() {
    const el = nomeEl();
    if (!el) return false;
    if (!el.dataset.lolidleApBound) {
      el.dataset.lolidleApBound = '1';
      el.addEventListener('mouseenter', () => { clearTimeout(fecharTimer); abrir(); });
      el.addEventListener('mouseleave', aoSair);
    }
    return true;
  }
  function buildLaunch() {
    if ($('lolidle-ap-launch')) return;
    const b = document.createElement('button');
    b.id = 'lolidle-ap-launch';
    b.textContent = '⚙ Auto-play';
    b.title = 'Abrir/fechar o painel do auto-play (F8)';
    b.addEventListener('click', () => (aberto ? fechar() : abrir()));
    (document.body || document.documentElement).appendChild(b);
  }

  /** Nomes das 8 abas ANTIGAS -> as 4 de agora. Um chamador antigo (script de manutenção, teste)
   *  não pode ficar com o painel em branco: o alias leva à aba certa. */
  const TAB_ALIAS = { agora: 'painel', auto: 'painel', mercado: 'itens', skills: 'personagem', atrib: 'personagem', farm: 'ganhos', hist: 'ganhos' };
  function setTab(nome) {
    tabAtiva = TAB_ALIAS[nome] || nome;
    qa('#lolidle-ap .tab').forEach((x) => x.classList.toggle('ativa', x.dataset.tab === nome));
    qa('#lolidle-ap .pane').forEach((x) => x.classList.toggle('on', x.id === 'ap-t-' + nome));
    ultimoRender = 0;
    renderTudo();
  }

  // ============================================================ 5. DESENHADORES
  // Caches: evitam recalcular coisas caras do motor a cada segundo.
  const caches = {};
  function cache(key, ms, fn) {
    const c = caches[key];
    if (c && Date.now() - c.at < ms) return c.v;
    let v = null;
    try { v = fn(); } catch (e) { v = null; }
    caches[key] = { at: Date.now(), v };
    return v;
  }
  /** Esquece uma cache (ou todas) — usado quando uma ação muda o que ela guarda. */
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
  /** Farm: do motor quando existe; senão do último estado publicado no storage. */
  const farm = () => (MOTOR() ? (ler('getFarm', {}) || {}) : (farmStore || {}));
  /** Regiões medidas: do motor quando devolve algo; senão do último agregado guardado. */
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

  /** Leitura da base (porque o motor está parado) — cache de 10 s. */
  const diagBase = () => cache('diag', 10000, () => ler('diagnosticoBase', null));
  /** O QUE FALTA FAZER NA BASE (necessidades reais, do motor) — mesma cache. */
  const faltasBase = () => cache('faltas', 10000, () => {
    const n = ler('necessidadesBase', null);
    if (!n) return null;
    const faltam = ler('faltandoNaBase', [], n);
    return { n, faltam: Array.isArray(faltam) ? faltam : [] };
  });
  /** Nome de usuário de cada necessidade da base (chaves do motor). */
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
  /** Melhor região agora — cache de 15 s (percorre todas as regiões). */
  const recomendacao = () => cache('rec', 15000, () => ler('recomendar', null));
  /** Identidade do campeão — cache de 30 s. */
  const identidade = () => cache('ident', 30000, () => ler('identidadeCampeao', null));
  /** Build ideal — cache de 30 s. */
  const buildIdeal = () => cache('ideal', 30000, () => ler('buildIdeal', []) || []);

  // ============================ OS 4 ESTADOS DO AUTO-PLAY (controles)
  // O MOTOR tem TRÊS controles com semânticas DIFERENTES (automation.js:5363-5398):
  //   cfg.enabled=false -> modo OBSERVAÇÃO: o portão `podeAgir` fecha e nada é clicado;
  //   pausar()          -> congela as AÇÕES mas continua OBSERVANDO (a medição acumula) e
  //                        `despausar()` retoma do mesmo ponto;
  //   desligarTudo()    -> para tudo, LIMPA o estado ativo (prazos, throttles, farm forçado,
  //                        backoff, testes) e PERSISTE em localStorage; `religarTudo()` volta.
  // A GUI mostra-os como 4 estados distintos — antes havia um rótulo de estado e um botão que
  // fazia o inverso, sem dizer qual era "onde você está" e qual era "o que acontece se clicar".
  const DESLIGADO_KEY = 'lolidleAuto:desligado';   // chave do motor (automation.js:5371)
  /** O kill do motor vive no localStorage (mesma origem desta página) e o motor não expõe nenhum
   *  getter para ele: `saudeAutoplay()` devolve só enabled/pausado/timers. */
  function estaDesligado() { try { return localStorage.getItem(DESLIGADO_KEY) === '1'; } catch (e) { return false; } }
  function estadoAuto() {
    if (estaDesligado()) return 'desligado';
    if (pausado()) return 'pausado';
    return cfg().enabled ? 'ligado' : 'observacao';
  }
  /** O que cada estado QUER DIZER, numa linha. */
  const EST_AUTO = {
    observacao: { cls: 'off', titulo: 'OBSERVAÇÃO', txt: 'só lê o jogo, não clica em nada' },
    ligado: { cls: 'on', titulo: 'LIGADO', txt: 'farmando e decidindo sozinho' },
    pausado: { cls: 'run', titulo: 'PAUSADO', txt: 'parou de agir, continua medindo' },
    desligado: { cls: 'err', titulo: 'DESLIGADO', txt: 'parou tudo; ao religar começa limpo' },
  };
  /** O botão principal de cada estado: o rótulo diz o que VAI MUDAR (não o que o botão "faz"). */
  const BTN_AUTO = {
    observacao: { id: 'ap-painel-ligar', txt: '▶ Ligar auto-play', txtCurto: '▶ LIGAR AUTO-PLAY', ajuda: 'Muda de OBSERVAÇÃO para LIGADO: o motor passa a farmar, viajar e decidir sozinho.' },
    ligado: { id: 'ap-painel-desligar', txt: '⏸ Desligar', txtCurto: '⏸ DESLIGAR', ajuda: 'Muda de LIGADO para OBSERVAÇÃO e limpa o estado ativo (prazos, testes, farm forçado): ao religar, começa do zero.' },
    pausado: { id: 'ap-painel-retomar', txt: '▶ Retomar', txtCurto: '▶ RETOMAR', ajuda: 'Muda de PAUSADO para LIGADO: volta a agir do ponto onde parou — a medição acumulada não se perde.' },
    desligado: { id: 'ap-painel-religar', txt: '▶ Religar', txtCurto: '▶ RELIGAR', ajuda: 'Sai de DESLIGADO e volta a agir (o estado ativo foi limpo quando você parou tudo).' },
  };
  /** ESTADO + o botão principal + as ações secundárias. */
  function renderPainelEstado() {
    const el = $('ap-painel-estado');
    if (!el) return;
    const a = estadoAgora();
    const e = a.estado || 'observacao';
    const info = EST_AUTO[e] || EST_AUTO.observacao;
    const b = BTN_AUTO[e] || BTN_AUTO.observacao;
    setHtml('ap-painel-estado', card('Auto-play — estado e controle', 'um switch decide; cada capacidade tem o seu',
      '<p class="est ' + info.cls + '"><b>' + esc(info.titulo) + '</b> — ' + esc(info.txt) + '</p>'
      + '<div class="acoes">' + acao(b.id, b.txt, b.ajuda, e === 'ligado' ? 'warn' : (e === 'desligado' ? 'danger' : '')) + '</div>'
      + '<div class="sec-acoes">'
      + acao('ap-painel-pausar', '⏸ Pausar', e === 'ligado'
        ? 'Congela as ações agora e continua medindo; Retomar devolve tudo do mesmo ponto.'
        : 'Só faz sentido com o auto-play LIGADO (agora: ' + esc(info.titulo.toLowerCase()) + ').', 'sec', e !== 'ligado')
      + acao('ap-painel-kill', '⛔ Parar tudo', 'Para tudo e grava a decisão no navegador: nem recarregando a página (F5) o motor volta sozinho.', 'danger')
      + '</div>'
      + '<p class="hint"><b>Pausar</b> congela as ações e continua medindo; <b>Parar tudo</b> limpa o estado ativo e fica gravado até você religar. O switch <b>Tudo (auto-play)</b>, na lista abaixo, é o mesmo liga/desliga em forma de switch.</p>'));
  }
  /** Estado resumido do cabeçalho — cache de 2 s. */
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
      pill = { cls: 'err', txt: 'sem motor' };
      fase = 'O motor do auto-play não carregou nesta página — recarregue com F5.';
    } else if (est === 'desligado') {
      pill = { cls: 'err', txt: 'desligado' };
      fase = 'DESLIGADO — parou tudo e a decisão ficou gravada no navegador. Ao religar, o motor começa limpo.';
    } else if (est === 'pausado') {
      pill = { cls: 'run', txt: 'pausado' };
      fase = 'PAUSADO — parou de agir, mas continua medindo. Retomar devolve tudo do mesmo ponto.';
    } else if (est === 'observacao') {
      pill = { cls: 'off', txt: 'observação' };
      fase = 'OBSERVAÇÃO — o motor só lê o jogo, não clica em nada.';
    } else {
      pill = { cls: 'on', txt: 'ligado' };
      const dg = diagBase();
      if (dg && dg.naBase) {
        const trava = (dg.trava || []).filter((x) => x !== 'idle ' + Math.round(dg.idleMs / 1000) + 's < ' + Math.round(dg.idleBaseMs / 1000) + 's');
        fase = 'Na Fonte. ' + (dg.motivo ? 'Motivo para estar aqui: ' + dg.motivo + '.' : 'Sem nada urgente para fazer na base.')
          + (trava.length ? ' À espera de: ' + traduzTrava(trava[0]) + '.' : '');
      } else if (cur) {
        const quem = cur.fase === 'boss' ? 'lutando com o chefe ' + limparNivel(cur.boss) : 'farmando mobs';
        fase = 'Rodando: ' + quem + ' em ' + limparNivel(cur.region) + ' (há ' + fmtDur(Date.now() - (cur.startedAt || Date.now())) + ').';
      } else {
        fase = 'Ligado, mas sem ciclo de farm ativo — o motor só conta ciclos enquanto você está no mapa.';
      }
    }
    const rec = recomendacao();
    const v = {
      pill, fase, estado: est, ligado: on, pausado: pau,
      nivel: pl.nivel || null,
      ouro: ler('readGold', null),
      hp,
      local: String(loc.text || '—'),
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
    // com o texto inteiro — nada fica ilegível por omissão.
    const set = (id, txt) => { const e = $(id); if (e && e.textContent !== txt) e.textContent = txt; if (e) e.title = txt; };
    set('ap-h-nivel', a.nivel ? String(a.nivel) : '—');
    set('ap-h-ouro', fmt(a.ouro));
    set('ap-h-hp', a.hp ? fmt(a.hp.cur) + ' / ' + fmt(a.hp.max) : '—');
    set('ap-h-local', a.local);
    set('ap-h-regiao', a.regiao || '—');
    const on = $('ap-on'); if (on && on.checked !== a.ligado) on.checked = a.ligado;
    set('ap-on-txt', a.ligado ? 'ligado' : 'desligado');
    // O botão grande do cabeçalho é o MESMO botão principal do painel: o rótulo diz o que muda
    // a partir do estado de agora — nunca dois controles a parecer a mesma coisa.
    const pb = $('ap-panic');
    if (pb) {
      const b = BTN_AUTO[a.estado] || BTN_AUTO.observacao;
      if (pb.textContent !== b.txtCurto) pb.textContent = b.txtCurto;
      const cls = 'btn big ' + (a.estado === 'ligado' ? 'warn' : (a.estado === 'desligado' ? 'danger' : ''));
      if (pb.className !== cls) pb.className = cls;
      pb.title = b.ajuda;
    }
    const pin = $('ap-pin'); if (pin) pin.classList.toggle('ativo', fixado);
  }


  // ------------------------------------------------- BUILD POR FASE
  // O bloco grande vive na aba Itens; na primeira aba fica o resumo de uma linha.
  /** Nome de usuário de cada FONTE de uma peça. */
  const FONTE_NOME = { equipado: 'equipado', mochila: 'na mochila', mercado: 'no mercado', cofre: 'no cofre', falta: 'falta' };
  const FONTE_AJUDA = {
    equipado: 'está vestido neste momento',
    mochila: 'está na sua mochila, pronto a vestir',
    mercado: 'está anunciado por você no mercado (o motor cancela a oferta e volta a vesti-lo)',
    cofre: 'está guardado no cofre (o motor vai buscá-lo quando for à Fonte)',
    falta: 'não está em lado nenhum — só farmando ou comprando a outro jogador',
  };
  /** Plano de uma fase (mobs/chefe), do motor — cache de 6 s. */
  const planoFase = (f) => cache('bf-' + f, 6000, () => { const r = chamar('planoBuildFase', f); return r.ok && r.v ? r.v : null; });
  /** Uma peça da build: ícone + qualidade + DE ONDE VEM. */
  function bfItem(i) {
    const fonte = FONTE_NOME[i.fonte] ? i.fonte : 'falta';
    const titulo = i.nome + ' — ' + (FONTE_NOME[fonte] || fonte) + (i.porque ? ' · ' + i.porque : '') + ' · ' + (FONTE_AJUDA[fonte] || '');
    // O chip mostra o NOME do item além do selo de qualidade e da fonte (o `i.nome` sempre
    // existiu nos dados; faltava renderizá-lo).
    const nome = i.nome || i.base || '?';
    return '<span class="bf-item ' + esc(fonte) + '" title="' + esc(titulo) + '">'
      + '<img src="' + ITEM_IMG(i.base) + '" alt="" loading="lazy" onerror="this.style.opacity=.25">'
      + (i.qual ? '<b class="q">' + esc(i.qual) + (i.refino ? '+' + esc(i.refino) : '') + '</b>' : '')
      + '<small><span class="bf-nome">' + esc(nome) + '</span> · ' + esc(FONTE_NOME[fonte] || fonte) + '</small></span>';
  }
  /** Uma COLUNA (a build de mobs ou a de chefe). */
  function bfColuna(p, fase) {
    const titulo = fase === 'mobs' ? 'Build de MOBS' : 'Build de CHEFE';
    const dica = fase === 'mobs'
      ? 'para limpar grupos: dano em área e velocidade de ataque valem mais'
      : 'para um alvo só e com armadura: penetração, crítico e aguentar valem mais';
    if (!p || !(p.itens || []).length) {
      return '<div class="bf-col"><h4>' + titulo + '</h4><p class="vazio">o motor ainda não sabe qual é o seu campeão (o HUD do jogo tem que carregar)</p></div>';
    }
    const emUso = !!p.ativa && p.on !== false;
    const faltam = (p.faltam || []);
    const buscar = (p.buscar || []);
    return '<div class="bf-col' + (emUso ? ' em-uso' : '') + '">'
      + '<h4>' + titulo
      + (emUso ? '<span class="tag">em uso agora</span>' : (p.equipadaAgora ? '<span class="tag ok">equipada</span>' : ''))
      + '</h4>'
      + '<p class="bf-dica">' + dica + '</p>'
      + '<div class="bf-itens">' + (p.itens || []).map(bfItem).join('') + '</div>'
      + (faltam.length
        ? '<p class="hint">Falta: ' + faltam.map((i) => '<b>' + esc(i.nome) + '</b>').join(', ') + ' — farmar ou comprar no mercado.</p>'
        : '<p class="hint">Você tem as ' + (p.itens || []).length + ' peças desta build.</p>')
      + (buscar.length
        ? '<p class="hint">Ir buscar: ' + buscar.map((i) => esc(i.nome) + ' (' + (FONTE_NOME[i.fonte] || i.fonte) + ')').join(', ') + '</p>'
        : '')
      + '</div>';
  }
  /** Desenha o bloco da build por fase — que agora vive na aba ITENS — com um botão de
   *  MINIMIZAR no cabeçalho.
   *  Regras deste bloco: (1) vive na aba Itens — fora de um `.pane` ele aparece por cima de
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
    const estado = !temMotor ? 'o motor ainda não carregou nesta página (F5)'
      : !on ? 'desligado: uma build só, como antes'
        : !pMob ? 'à espera do campeão (o HUD ainda não carregou)'
          : (pMob.ativa ? 'em mobs agora — veste a build de limpeza'
            : (pChefe && pChefe.ativa ? 'no chefe agora — veste a build de alvo único' : 'fora de um ciclo de farm'));
    const corpo = tg('ap-cfg-buildPorFase', 'Trocar a build sozinho quando a luta muda',
      'Em mobs veste a build de limpeza; quando o chefe aparece veste a de alvo único. O que sai fica na mochila e nunca é vendido.', on)
      + (on ? '' : '<p class="aviso warn">Desligado: o motor volta usando uma build só e deixa de reservar as peças da outra.</p>')
      + '<div class="bf-grid">' + bfColuna(pMob, 'mobs') + bfColuna(pChefe, 'chefe') + '</div>'
      + '<p class="hint">Campeão: <b>' + esc(ident.nome || '—') + '</b>. Cada peça diz DE ONDE vem: <b>equipado</b>, <b>na mochila</b>, <b>no mercado</b> (oferta sua) ou <b>no cofre</b>. "Falta" = não existe em lado nenhum.</p>';
    // Cabeçalho próprio (não usa card()) porque leva o botão de minimizar ao lado do estado.
    setHtml('ap-build-fase',
      '<section class="card bf' + (abertoBf ? '' : ' min') + '">'
      + '<h3><span>Build por fase — mobs ↔ chefe</span><span class="obs">' + esc(estado) + '</span>'
      + '<button class="ic bf-min" id="ap-bf-min" title="'
      + (abertoBf ? 'Minimizar: deixa só o título (o mesmo botão volta abrindo)' : 'Abrir o bloco da build por fase') + '">'
      + (abertoBf ? '▾' : '▸') + '</button></h3>'
      + '<div class="corpo">' + corpo + '</div></section>');
  }
  /** RESUMO DE UMA LINHA do mesmo bloco, para a 1.ª aba: a primeira aba é um PAINEL DE
   *  CONTROLE, não um relatório — o bloco grande mudou para Itens e aqui fica só o
   *  estado (o que está em uso e quantas peças faltam), para não se perder a leitura.
   *  CUSTO: `planoFase` tem cache de 6 s (`cache('bf-'+fase, 6000, …)`), logo isto são no máximo
   *  2 chamadas ao motor a cada 6 s — e partilha a MESMA cache com o bloco grande. */
  function renderBuildResumo() {
    const el = $('ap-painel-build');
    if (!el) return;
    if (!MOTOR()) { setHtml('ap-painel-build', ''); return; }
    const c = cfg();
    if (c.buildPorFase === false) {
      setHtml('ap-painel-build', '<p class="hint">Build por fase (mobs ↔ chefe): <b>desligada</b> — o motor usa uma build só. Liga-a em <b>Itens</b> ▸ Build por fase.</p>');
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
      + kv('nível', a.nivel ? String(a.nivel) : '—')
      + kv('ouro', fmt(a.ouro))
      + kv('campeão', esc(a.campeao || '—') + (a.classe ? ' <small>' + esc(a.classe) + '</small>' : ''))
      + kv('onde você está', esc(a.local))
      + '</div>'
      + barra
      + '<p class="hint">A vida vem da barra do jogo (é a verdade). O ouro vem do contador do HUD.</p>'));

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
      corpoFase = '<p class="vazio">Sem ciclo ativo. O motor abre um ciclo quando você está no mapa farmando.</p>';
    }
    setHtml('ap-now-fase', card('O que o auto-play está fazendo AGORA', 'medido neste ciclo',
      '<p class="aviso ' + (a.ligado && !a.pausado ? 'ok' : 'warn') + '">' + esc(a.fase) + '</p>' + corpoFase));

    // 3) porque está parado (leitura completa)
    const dg = diagBase();
    if (!a.ligado || a.pausado) {
      const saude = ler('saudeAutoplay', null) || {};
      setHtml('ap-now-parado', card('Por que NADA está acontecendo', 'leitura do motor',
        '<p class="aviso warn">' + (a.pausado ? 'O motor está <b>pausado</b>.' : 'O auto-play está <b>desligado</b> (modo observação).') + '</p>'
        + '<p class="hint">Último "batimento" do motor: ' + (saude.ultimoTickHaMs == null ? 'nunca' : 'há ' + fmtDur(saude.ultimoTickHaMs)) + ' · temporizadores ativos: ' + (saude.timers == null ? '—' : saude.timers) + '</p>'
        + '<div class="acoes">' + acao('ap-retomar', '▶ Retomar tudo', 'Liga o auto-play e a auto-poção e despausa o motor.') + '</div>'));
    } else if (dg && dg.naBase) {
      const fb2 = faltasBase();
      const lista = fb2 && fb2.faltam && fb2.faltam.length
        ? '<ul style="margin:2px 0 0;padding-left:18px">' + fb2.faltam.map((k) => '<li>' + esc(NECESSIDADE_NOME[k] || k) + '</li>').join('') + '</ul>'
        : '<p class="aviso ok">A base está completa — nada falta fazer aqui.</p>';
      setHtml('ap-now-parado', card('O que falta fazer na base', 'necessidades reais, lidas pelo motor',
        (dg.motivo ? '<p class="aviso warn">Motivo mais urgente: <b>' + esc(dg.motivo) + '</b></p>' : '')
        + lista
        + '<p class="hint">Quando esta lista fica vazia, o motor viaja para ' + esc(a.regiao || 'a melhor região') + '.</p>'
        + diag('Forçar agora (manutenção manual)',
          '<div class="acoes">' + acaoD('ap-base-go-agora', '🏠 Rodar a rotina de base agora', 'Executa todos os passos pendentes de uma vez (com confirmação). O motor faz isto sozinho quando decide voltar à Fonte.') + '</div>')));
    } else if (dg && dg.trava && dg.trava.length) {
      setHtml('ap-now-parado', card('Por que o motor ainda não saiu da Fonte', 'leitura direta das travas do motor',
        '<ul style="margin:2px 0 0;padding-left:18px">' + dg.trava.map((t) => '<li>' + esc(traduzTrava(t)) + '</li>').join('') + '</ul>'
        + '<p class="hint">Quando nenhuma destas travas estiver ativa, o motor viaja sozinho para ' + esc(a.regiao || 'a melhor região') + '.</p>'));
    } else {
      setHtml('ap-now-parado', '');
    }

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
        + (L.carga ? '<p class="aviso err">⚠ Golpe especial carregado: <b>' + esc(L.carga.mec) + '</b> — a poção mais forte dispara antes do golpe.</p>' : '')
        + (L.furia ? '<p class="aviso warn">O chefe está FURIOSO: ataca 1,5× mais rápido durante alguns segundos.</p>' : '')
        + (fontes.length ? '<div class="chips">' + fontes.map((x) => '<span class="tag">' + esc(nomeF(x[0])) + ' ' + fmt(x[1]) + '/s</span>').join('') + '</div>' : '<p class="hint">ainda sem dano medido por fonte</p>')));
    }

    // 5) poções
    const pot = (status && status.potions) || null;
    const counts = ler('readPotions', {}) || {};
    const min = c.minPotion || { vida: 200, vidaF: 100, vidaS: 30 };
    const ultima = status && status.lastAction;
    const cartoes = ORDER.map((k) => {
      const n = Number(counts[k] || 0);
      const baixo = n < Number(min[k] || 0);
      return '<div class="pot ' + (baixo ? 'baixo' : '') + '">' + (potIcon(k) ? '<img src="' + potIcon(k) + '" alt="">' : '')
        + '<div><span class="q">' + fmt(n) + '</span><small>' + POCAO_NOME[k] + ' · cura ' + fmt(POCAO_CURA[k]) + ' · mínimo ' + fmt(min[k]) + '</small></div></div>';
    }).join('');
    const planoPocao = ler('planPotions', null, counts);
    setHtml('ap-now-pocoes', card('Poções', 'a auto-poção usa a mais fraca que for suficiente',
      '<div class="pots">' + cartoes + '</div>'
      + '<p class="hint">A auto-poção decide pelo <b>golpe que o monstro acabou de dar</b> (não por médias) e conta a cura das suas habilidades. Se a cura chegar, não gasta poção.</p>'
      + (ultima ? '<p class="aviso ok">Última decisão: usou <b>' + esc(POCAO_NOME[ultima.k] || ultima.k) + '</b> — ' + esc(ultima.reason || '') + '</p>' : '<p class="vazio">ainda não usou nenhuma poção</p>')
      + (planoPocao ? '<p class="aviso warn">Em falta: ' + esc((planoPocao.faltas || []).map((k) => POCAO_NOME[k]).join(', ')) + '. Vai comprar: '
        + esc(ORDER.filter((k) => planoPocao.comprar[k] > 0).map((k) => POCAO_NOME[k] + ' ×' + fmt(planoPocao.comprar[k])).join(' · ') || 'nada (sem ouro)') + '</p>'
        : '<p class="hint">Poções acima do mínimo — nada comprando.</p>')));

    // 6) ESTADO COMPLETO DO JOGO — inventário, equipamento, habilidades, cofre, mobs/bosses e o
    // próximo passo. É o retrato que o MOTOR mantém atualizado (automation.js: `estadoCompleto`,
    // gravado a cada 20 s em ESTADO_KEY), não uma segunda leitura do DOM feita aqui. Se ainda não
    // houver retrato (a primeira gravação corre ~2,5 s depois de o motor arrancar), não se inventa.
    const est = estadoStore;
    if (!est || !est.at) {
      setHtml('ap-now-jogo', '');
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
      setHtml('ap-now-jogo', card('Estado completo do jogo', 'o motor mantém isto atualizado sozinho (a cada 20 s)',
        '<div class="kvs">'
        + kv('campeão', esc(est.campeao || '—') + (est.alvo && est.alvo.length ? ' <small>alvo: ' + esc(est.alvo.join(', ')) + '</small>' : ''))
        + kv('nível', est.nivel == null ? '—' : String(est.nivel))
        + kv('ouro', fmt(est.ouro))
        + kv('onde', esc(est.local || '—'))
        + kv('atualizado', 'há ' + fmtDur(Date.now() - est.at))
        + '</div>'
        + '<p class="diag-t">Mochila — ' + (inv ? fmt(inv.used) + '/' + fmt(inv.cap) + ' espaços' : 'não lida') + '</p>'
        + '<div class="chips">' + (invRes || '<span class="vazio">vazia</span>') + (itensInv.length > 10 ? '<span class="tag">+ ' + (itensInv.length - 10) + '</span>' : '') + '</div>'
        + '<p class="diag-t">Equipado</p>'
        + '<div class="chips">' + eqRes + '</div>'
        + '<p class="diag-t">Habilidades</p>'
        + '<div class="kvs">'
        + kv('na barra', barra || '—', hab.prontas && hab.prontas.length ? '(a bold = pronta)' : '')
        + kv('pontos por gastar', hab.pontos == null ? '—' : String(hab.pontos))
        + kv('ranks', esc((hab.ranks || []).join(' · ') || '—'))
        + '</div>'
        + '<p class="diag-t">Cofre — ' + fmt(cofre.length) + ' peças conhecidas</p>'
        + '<div class="chips">' + (cofre.slice(0, 10).map((c) => '<span class="tag">' + esc(nomeDe(c.nome || c.base)) + (c.qual && c.qual !== 'C' ? ' <b>' + esc(c.qual) + '</b>' : '') + '</span>').join('') || '<span class="vazio">nada guardado lido</span>') + '</div>'
        + '<p class="diag-t">Mobs e bosses</p>'
        + '<div class="kvs">'
        + kv('alvo agora', alvo ? esc(alvo.name || '?') + (alvo.boss ? ' 👑' : '') : '—')
        + kv('chefe', chefe ? esc(chefe.nome || chefe) + (chefe.pct != null ? ' — ' + esc(chefe.pct) + '% de vida' : '') : '—')
        + kv('poções', ORDER.map((k) => POCAO_NOME[k] + ' ' + fmt(pot[k] || 0)).join(' · '))
        + '</div>'
        + '<p class="hint">' + (prox
          ? 'Próximo passo por omissão: farmar <b>' + esc(limparNivel(prox.regiao)) + '</b> — ' + fmt(prox.ouroLiquidoMin) + ' ouro limpo/min · ' + fmt(prox.xpMin) + ' xp/min' + (prox.sobrevive ? '' : ' · ⚠ o chefe mata você') + '.'
          : 'Próximo passo: sem dados suficientes ainda — o motor decide após medir as regiões.') + '</p>'));
    }
  }

  // ------------------------------------- ÁRVORE DE INTERRUPTORES (hierarquia do motor)
  // O motor JÁ tem a tabela (`INTERRUPTORES`) e o resolvedor (`podeFazer`) e expõe
  // os dois por `arvoreInterruptores()` -> [{nome, pai, cfg, temExcecao, pode, porque}].
  // AQUI SÓ SE DESENHA ESSA VERDADE: pais e filhos indentados. Nada é decidido nesta GUI — se o
  // motor mudar a tabela (um switch novo é UMA linha lá), a árvore muda sozinha.
  const ARV_NOME = {
    manutencao: 'Manutenção (recurso base)',
    autoplay: 'Tudo (auto-play)',
    irBase: 'Ir à base (Fonte)',
    vender: 'Vender o lixo ao lojista',
    repor: 'Repor poções',
    comprar: 'Comprar item no mercado',
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
    vigiarMercado: 'Vigiar o mercado (itens e jogadores) e comprar',
  };
  const ARV_AJUDA = {
    manutencao: 'recurso base (vender, equipar, mercado, pontos, cofre) — funciona em qualquer campeão',
    autoplay: 'o switch mestre: desligado, o motor só observa (não clica em nada)',
    irBase: 'voltar à Fonte para tratar de tudo o que é da base',
    vender: 'vende ao lojista só o que o plano da mochila diz que é lixo',
    repor: 'compra poções no Lojista até o mínimo que você escolheu',
    comprar: 'compra no mercado o item da build ideal que falta',
    refino: 'gasta ouro refinando seus lendários tier A+ até o teto',
    montar: 'tenta montar no Ornn a receita mais barata que serve a build (é uma aposta)',
    cofre: 'guarda no cofre e vai buscar o que está lá',
    fugir: 'foge da região (tecla B) quando o golpe passa da cura possível, quando a região mata ou quando a luta está perdida sem poções que cheguem — e volta sozinho à região quando a fuga não foi por morte certa',
    equip: 'troca sempre que aparecer uma peça melhor para o slot',
    atrib: 'gasta sozinho os pontos de atributo livres',
    hab: 'sobe as habilidades quando há pontos',
    anunciar: 'põe à venda os lendários abaixo de tier A a 90% do preço mais baixo',
    buildPorFase: 'em mobs veste a build de limpeza; no chefe a de alvo único',
    skillsPorFase: 'em mobs prefere as habilidades de área; no chefe as de alvo único',
    rotacao: 'põe na barra as 4 habilidades prontas que dão mais dano',
    vigiarMercado: 'lê o mercado dos jogadores em tempo real e compra as ofertas que casam com a sua watch (itens e/ou nomes de jogador) — só gasta ouro e nunca abaixo da reserva',
  };
  /** O QUE CADA SWITCH COBRE — é a linha colorida ao lado dele: VERDE quando está ligado (o que
   *  passa a acontecer) e VERMELHA quando está desligado (o que deixa de acontecer). O texto fala
   *  do efeito no jogo, não do nome técnico da chave.
   *  Fonte: a tabela INTERRUPTORES do motor (automation.js:2460) e as funções que cada switch
   *  comanda (venderBase, autoEquip, reporPocoes, refinarMelhores, montarMelhorReceita, cofre,
   *  distribuirAtributos, subirHabilidades, anunciarLendarios, trocarBuildDaFase, rotacaoSkills,
   *  checarChefeFatal). */
  const ARV_COBRE = {
    manutencao: { on: 'Vende, equipa, gasta pontos e mexe no cofre quando vale a pena — em qualquer campeão.', off: 'Nada de manutenção: a mochila enche, os pontos ficam parados e o cofre não é lido.' },
    autoplay: { on: 'Farma, viaja e escolhe a região sozinho.', off: 'Não farma nem viaja: só observa e mede.' },
    irBase: { on: 'Volta à Fonte quando alguma pendência paga a viagem.', off: 'Não volta à Fonte: nenhuma ação de base acontece.' },
    vender: { on: 'Vende no Lojista o básico, o épico e o duplicado (tier S+ nunca).', off: 'Nada é vendido — a mochila enche e você perde loot.' },
    repor: { on: 'Compra poções no Lojista até o mínimo que você escolheu.', off: 'As poções acabam e faltam curas no meio da luta.' },
    comprar: { on: 'Compra no mercado o item da build ideal que falta.', off: 'A build só completa com o que cair no chão.' },
    refino: { on: 'Refina no Ornn os lendários tier A+ até o teto.', off: 'Os itens ficam no refino em que estão.' },
    montar: { on: 'Tenta montar no Ornn a receita mais barata que serve a build.', off: 'Nenhuma tentativa de montagem: nenhum item novo sai das peças.' },
    cofre: { on: 'Lê o cofre na Fonte e guarda o que deve ficar guardado.', off: 'O cofre nunca é lido — o painel fica sem saber o que está guardado.' },
    fugir: { on: 'Foge para a Fonte quando algo mata você — e volta sozinho à região quando a fuga não foi por morte certa.', off: 'Nada foge: se o golpe ou a região mata, você morre.' },
    equip: { on: 'Equipa sempre a melhor peça de cada slot.', off: 'O que está vestido fica como está, mesmo com peça melhor na mochila.' },
    atrib: { on: 'Gasta os pontos de atributo pelo modelo escolhido.', off: 'Os pontos de atributo ficam parados.' },
    hab: { on: 'Sobe as habilidades quando há pontos.', off: 'Os pontos de habilidade ficam parados.' },
    anunciar: { on: 'Anuncia no mercado os lendários abaixo de A, a 90% do menor preço.', off: 'Nada é anunciado: os lendários ficam ocupando espaço na mochila.' },
    buildPorFase: { on: 'Troca a build entre mobs e chefe conforme a luta.', off: 'Uma build só: as peças da outra fase não são reservadas.' },
    skillsPorFase: { on: 'Prefere habilidades de área em mobs e de alvo único no chefe.', off: 'A barra não muda com o contexto da luta.' },
    rotacao: { on: 'Mantém na barra as melhores habilidades, com a ultimate.', off: 'A barra fica como está — pode ficar sem a ultimate.' },
    vigiarMercado: { on: 'Deteta em tempo real as ofertas dos itens que você vigia e dos jogadores da lista, e compra-as sozinho pelo mercado (no Mercador).', off: 'O mercado deixa de ser vigiado: nenhuma oferta da watch é comprada.' },
  };
  /** Marca dos switches com EXCEÇÃO. O motor já manda o texto (`excecaoTxt` em
   *  `arvoreInterruptores()`, automation.js:2293); este mapa é só o recurso para um motor antigo. */
  const ARV_EXCECAO = {
    autoplay: 'só corre no campeão alvo',
    vender: 'skippado em Runeterra',
    cofre: 'skippado em Runeterra',
    anunciar: 'skippado em Runeterra',
  };
  const arvExc = (nome, s) => (s && s.excecaoTxt) || ARV_EXCECAO[nome] || 'pode ser skippado por uma exceção';
  /** Traduz o `porque` do motor ("vender: desligado pelo dono") em {quem, motivo}. O motor
   *  escreve SEMPRE "<nome do switch que falhou>: <motivo>" — é isso que permite separar
   *  "desligado por você" (quem === este) de "bloqueado pelo pai" (quem === um ancestral). */
  function arvQuemBloqueia(txt) {
    const m = /^\s*([^:]+):\s*(.+?)\s*$/.exec(String(txt == null ? '' : txt));
    return m ? { quem: m[1], motivo: m[2] } : { quem: null, motivo: '' };
  }
  /** UM switch: estado PRÓPRIO + o que ele cobre (linha verde/vermelha) + os filhos indentados.
   *  INDEPENDÊNCIA: o switch do filho mostra o que ELE diz — se está ligado e o
   *  pai o bloqueia, fica "ligado, mas inerte" e diz por quem, em vez de parecer desligado. */
  function arvNo(s, ramos, nivel) {
    if (nivel > 8) return '';                       // guarda contra um pai cíclico: nunca recursa sem fim
    const c = cfg();
    const nome = String(s.nome || '?');
    const temCfg = !!s.cfg;
    const proprio = temCfg ? c[s.cfg] !== false : true;
    const z = arvQuemBloqueia(s.porque);
    const bloqueado = s.pode === false;
    const porExcecao = bloqueado && /excep/i.test(z.motivo);
    const porPai = bloqueado && !porExcecao && !!z.quem && z.quem !== nome;
    const inerte = bloqueado && !porExcecao && proprio;     // o switch está LIGADO; o pai é que fecha
    let cls, est;
    if (porExcecao) { cls = 'skip'; est = 'ligado, mas skippado'; }
    else if (inerte) { cls = 'bloq'; est = 'ligado, mas inerte'; }
    else if (bloqueado) { cls = 'bloq'; est = 'desligado por você'; }
    else { cls = 'on'; est = temCfg ? (c[s.cfg] === undefined ? 'ligado (padrão)' : 'ligado e agindo') : 'ligado (implícito)'; }
    let motivo = '';
    if (porExcecao) motivo = '<span class="arv-motivo">⚠ o motor pula este agora — ' + esc(arvExc(nome, s)) + '</span>';
    else if (porPai) motivo = '<span class="arv-motivo">' + (inerte ? 'não age enquanto ' : 'bloqueado por ')
      + '<b>' + esc(ARV_NOME[z.quem] || z.quem) + '</b>' + (inerte ? ' estiver desligado' : ' (está desligado)') + '</span>';
    else if (bloqueado) motivo = '<span class="arv-motivo">' + (!z.quem ? 'desligado (o motor não disse por quem)'
      : temCfg ? 'desligado por você' : 'desligado pelo motor') + '</span>';
    const cobre = ARV_COBRE[nome] || null;
    const linha = cobre ? '<p class="arv-cobre ' + (bloqueado ? 'off' : 'on') + '">' + esc(bloqueado ? cobre.off : cobre.on) + '</p>' : '';
    const ctrl = temCfg
      ? '<label class="arv-tg" title="' + esc((ARV_AJUDA[nome] || '') + ' (nome técnico no motor: ' + s.cfg + ')') + '"><input type="checkbox" id="ap-arv-' + esc(nome)
        + '" data-arv="' + esc(nome) + '" data-cfg="' + esc(s.cfg) + '"' + (proprio ? ' checked' : '')
        + '><span class="sw"></span></label>'
      : '<span class="arv-cfg" title="não tem switch próprio: liga e desliga com o pai">implícito</span>';
    const meus = ramos[nome] || [];
    // SWITCH À ESQUERDA: o interruptor vem antes do nome, não no fim da linha.
    return '<div class="arv-no ' + cls + (nome === 'autoplay' ? ' mestre' : '') + '" data-no="' + esc(nome) + '">'
      + '<i class="arv-dot"></i>'
      + ctrl
      + '<b>' + esc(ARV_NOME[nome] || nome) + '</b>'
      + '<small class="arv-est">' + esc(est) + '</small>'
      + motivo
      + (s.temExcecao ? '<span class="tag arv-exc" title="o motor pula este switch em certas condições">⚠ ' + esc(arvExc(nome, s)) + '</span>' : '')
      + '</div>'
      + linha
      + (meus.length ? '<div class="arv-filhos">' + meus.map((f) => arvNo(f, ramos, nivel + 1)).join('') + '</div>' : '');
  }
  /** Desenha a lista de switches. ESTADO VAZIO HONESTO: sem motor (ou sem a função) diz-se isso,
   *  em vez de desenhar uma lista vazia que pareceria "não há switches". */
  function renderArvore() {
    const r = chamar('arvoreInterruptores');
    if (!r.ok || !Array.isArray(r.v) || !r.v.length) {
      const semMotor = !MOTOR();
      setHtml('ap-auto-arvore', card('Switches — o que o motor faz sozinho', 'lista declarada pelo motor',
        '<p class="vazio">' + (semMotor
          ? 'O motor do auto-play ainda não carregou nesta página — não há switches para mostrar.'
          : r.erro === 'sem-funcao'
            ? 'Esta versão do motor ainda não expõe a lista de switches (falta <b>arvoreInterruptores</b>).'
            : 'O motor respondeu, mas não declarou nenhum switch.') + '</p>'
        + '<p class="hint">Este bloco não inventa nada: mostra exatamente os switches que o motor declara'
        + (semMotor ? ' — recarregue a página com <b>F5</b>.' : '.') + '</p>'));
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
    // "Ligado, mas inerte": o switch do próprio está ligado e o motor não age porque o pai fecha.
    const inerte = bloq.filter((x) => { const z = arvQuemBloqueia(x.porque); return !/excep/i.test(z.motivo) && !!x.cfg && c[x.cfg] !== false; });
    const desligados = bloq.length - inerte.length - skip.length;
    const agindo = lista.length - bloq.length;
    const mestre = porNome.autoplay;
    const alvo = c.champAlvo === undefined ? 'yasuo' : (c.champAlvo || 'qualquer campeão');
    // O CASO A DESTACAR: ligado no switch e mesmo assim sem agir.
    const alerta = (mestre && mestre.pode === false && c.enabled !== false)
      ? '<p class="aviso warn">O switch mestre está <b>LIGADO</b> mas <b>skippado</b> agora: ' + esc(arvExc('autoplay', mestre))
        + ' (alvo: <b>' + esc(alvo) + '</b>). Enquanto for assim, nenhum switch abaixo age — nem vender, nem equipar.</p>'
      : '';
    setHtml('ap-auto-arvore', card('Switches — o que o motor faz sozinho', 'lista e hierarquia declaradas pelo motor',
      alerta
      + '<p class="hint">' + String(lista.length) + ' switches · <b>' + String(agindo) + ' ligados e agindo</b> · '
      + String(desligados) + ' desligados por você · ' + String(inerte.length) + ' ligados mas <b>inertes</b> (o pai está desligado) · '
      + String(skip.length) + ' skippados por exceção.</p>'
      + '<p class="hint"><b>Tudo (auto-play)</b> é o switch que faz o motor jogar. <b>Manutenção</b> é o recurso base (vender, equipar, mercado, pontos, cofre) e funciona em qualquer campeão — são dois ramos independentes, como o motor os declara.</p>'
      + '<div class="arv">' + raizes.map((x) => arvNo(x, ramos, 0)).join('') + '</div>'
      + '<p class="hint">Ligar uma capacidade <b>não</b> liga o switch mestre, e o mestre desligado <b>não</b> desliga os filhos: eles ficam <b>inertes</b> (ligados, sem agir). '
      + 'A linha verde diz o que o switch cobre; a vermelha, o que deixa de acontecer com ele desligado.</p>'));
  }


  // ---------------------------------------------------------------- ABA AUTO-PLAY
  let autoConstruido = false;
  function renderAuto() {
    const a = estadoAgora();
    const c = cfg();
    // Se a lista de regiões ficou vazia (o motor ainda não tinha lido o catálogo), refaz quando chegar.
    if (autoConstruido) {
      const sel0 = $('ap-reg-id');
      if (sel0 && !sel0.options.length) {
        const r0 = ler('rankRegioes', []);
        if (r0 && r0.length) { autoConstruido = false; _ultimoHtml.clear(); }
      }
    }
    if (!autoConstruido) {
      autoConstruido = true;
      setHtml('ap-auto-mestre', card('O switch mestre', 'o resto depende dele, mas ele não liga o resto',
        '<p class="hint">O switch <b>Tudo (auto-play)</b> (no topo do painel e na lista abaixo) é o único que faz o motor <b>jogar</b>: farmar, viajar e decidir. O mesmo switch comanda a auto-poção.</p>'
        + '<p class="hint">Ligar uma capacidade <b>não</b> liga o mestre. Com o mestre desligado as capacidades podem ficar ligadas — elas aparecem como <b>inertes</b>, porque ninguém age.</p>'
        + '<p class="hint">Para ligar ou desligar use o <b>switch</b> aqui em cima, no cabeçalho, ou o botão do cartão de estado (o rótulo diz o que vai mudar).</p>'));

      const regioes = (ler('rankRegioes', []) || []).slice(0, 40);
      setHtml('ap-auto-obj', card('O que você quer ganhar', 'critério da região escolhida',
        linha('Objetivo do farm', 'muda a região que o motor escolhe',
          '<select id="ap-obj"><option value="xp">Experiência (subir de nível)</option><option value="ouro">Ouro (comprar itens)</option><option value="runas">Runas</option></select>')));
      setHtml('ap-auto-regiao', card('Onde farmar', 'automático ou escolhido por você',
        linha('Região', 'automático = o motor escolhe a melhor para o seu nível',
          '<select id="ap-reg-modo"><option value="auto">Automática (recomendada)</option><option value="fixa">Fixa (escolho eu)</option></select>')
        + linha('Região fixa', 'escolher uma região aqui passa a região para FIXA (o automático desliga e você vê isso no aviso abaixo)',
          '<select id="ap-reg-id">' + regioes.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.nome) + ' — ' + fmt(r.xpMin) + ' xp/min · ' + fmt(r.goldMin) + ' ouro/min</option>').join('') + '</select>')
        + diag('Forçar viagem (manutenção manual)',
          '<div class="acoes">' + acaoD('ap-ir-agora', '🧭 Ir agora para a região escolhida', 'Viaja já para a região selecionada. O motor viaja sozinho quando está ligado e a região é a melhor para o seu nível.') + '</div>')
        + '<div id="ap-reg-info"></div>'));

      setHtml('ap-auto-extras', card('Automatismos do motor', 'cada um faz uma coisa concreta',
        '<div class="grid2">'
        + tg('ap-cfg-autoEquip', 'Trocar por peça melhor', 'Troca sempre que aparecer uma peça melhor para o slot.', !!c.autoEquip)
        + tg('ap-cfg-trocaItens', 'Trocar itens conforme a luta', 'Use o conjunto de FARM contra mobs e o conjunto de CHEFE contra chefes.', !!c.trocaItens)
        + tg('ap-cfg-autoAtrib', 'Distribuir pontos de atributo', 'Gasta sozinho os pontos de atributo livres pelo modelo escolhido na aba Personagem.', !!c.autoAtrib)
        + tg('ap-cfg-autoRefino', 'Refinar no Ornn', 'Refina os seus LENDÁRIOS já tier A ou melhor até +3 (acima de +2 pode descer).', !!c.autoRefino)
        + tg('ap-cfg-barraDisp', 'Barra pelas habilidades PRONTAS', 'Põe na barra as habilidades DISPONÍVEIS e as que ficam prontas mais cedo (o dono: "usava tudo disponivel ... o tempo inteiro"). Desligado, a barra fica presa às 4 de maior dano.', c.barraPorDisponibilidade !== false)
        + '</div>'));

      const pc = (k) => Object.assign({ enabled: true, mode: 'pct', value: k === 'vidaS' ? 60 : k === 'vidaF' ? 43 : 21 }, (config && config.potions && config.potions[k]) || {});
      const minP = (config && config.automation && config.automation.minPotion) || (c.minPotion) || { vida: 200, vidaF: 100, vidaS: 30 };
      setHtml('ap-auto-pocoes', card('Auto-poção — quando usar cada uma', 'usa a mais fraca que for suficiente para você sobreviver',
        ORDER.map((k) => '<div class="ctl"><div class="ctl-l"><b>' + POCAO_NOME[k] + ' — cura ' + fmt(POCAO_CURA[k]) + '</b><small id="ap-pc-t-' + k + '">—</small></div>'
          + '<div class="ctl-c"><label class="tg" style="padding:3px 7px"><input type="checkbox" id="ap-pc-on-' + k + '"><span class="sw"></span></label>'
          + '<input type="number" id="ap-pc-v-' + k + '" min="0" step="1">'
          + '<select id="ap-pc-m-' + k + '"><option value="pct">% da vida perdida</option><option value="lost">vida perdida (valor)</option></select></div></div>').join('')
        + '<div class="grid2">'
        + tg('ap-pc-strongest', 'Usar sempre a mais forte que você tiver', 'Muda a regra: ignora as faixas de vida e usa logo a poção mais forte disponível.', !!(config && config.mode === 'strongest'))
        + tg('ap-pc-smart', 'Decisão inteligente (recomendado)', 'Decide pelo GOLPE que o monstro acabou de dar e conta a cura das suas habilidades. É o que gasta menos poções.', !(config && config.smart === false))
        + '</div>'
        + linha('Mínimo na mochila (repor na base)', 'quando desce abaixo disto, o motor volta à Fonte para comprar',
          ORDER.map((k) => '<span class="hint">' + POCAO_NOME[k] + '</span><input type="number" id="ap-min-' + k + '" min="0" style="width:64px" value="' + esc(minP[k]) + '">').join(' '))
        + '<p class="hint">As faixas acima são a regra simples (por vida perdida). Com a "decisão inteligente" ligada, o motor sobrepõe-se a elas quando sabe exatamente quanto vai doer o próximo golpe.</p>'));

      // TODAS as ações manuais (o que você pode fazer no jogo com um clique) ficam AQUI, no
      // fim do Painel, tracejadas e rotuladas como manutenção manual. O que aparece em cima é o
      // que acontece sozinho: estado, switches, o que o motor vai fazer e o que está bloqueado.
      setHtml('ap-auto-acoes', card('Manutenção manual — forçar e medir', 'o motor faz isto sozinho quando o switch está ligado; use só para forçar ou medir',
        diag('Forçar agora (o automático deveria estar fazendo)',
          '<div class="acoes">'
          + acaoD('ap-farm-go', '▶ Ir agora para a melhor região', 'Liga o auto-play e viaja agora. O motor escolhe e viaja sozinho com o switch Tudo (auto-play) ligado.')
          + acaoD('ap-base-go', '🏠 Rodar a rotina de base agora', 'Na Fonte: cura, vende, repõe poções, tarefas, cofre, mercado e atributos — só o que é preciso.')
          + acaoD('ap-curar', '❤ Curar (Soraka)', 'Fala com a Soraka e cura o personagem a 100%.')
          + acaoD('ap-repor', '🧪 Repor poções', 'Compra poções no Lojista até o mínimo que você escolheu (mais caras primeiro).')
          + acaoD('ap-vender', '💰 Vender o que não presta', 'Vende ao Lojista só o que o plano da mochila diz que é lixo. Os protegidos nunca são tocados.')
          + acaoD('ap-cofre-guardar', '📦 Guardar no cofre', 'Guarda no cofre os épicos tier S/SS que não devem ficar na mochila.')
          + acaoD('ap-anunciar', '🏪 Anunciar lendários no mercado', 'Põe à venda os lendários abaixo de tier A, a 90% do preço mais baixo. Nunca anuncia Rabadon nem tier A+.')
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
          + acaoD('ap-cal', '🎯 Calibrar previsões', 'Compara o que o motor previu com o que mediu e corrige o erro (deixa as previsões mais certas).')
          + acaoD('ap-giro', '🔄 Medir várias regiões', 'Viaja por todas as regiões durante alguns minutos cada, para medir ganhos reais.')
          + acaoD('ap-testes', '🧪 Medir conjuntos de itens', 'Monta conjuntos e o motor roda cada um medindo ouro, xp e dano reais.')
          + acaoD('ap-scan-painel', '🎒 Forçar leitura da mochila', 'Lê a mochila no jogo (a aba Itens usa esta leitura).')
          + acaoD('ap-export', '💾 Exportar dados medidos', 'Baixa um arquivo JSON com tudo o que o motor aprendeu (backup ou análise).')
          + acaoD('ap-reload', '🔃 Recarregar a extensão', 'Recarrega os scripts da extensão (útil depois de uma atualização).')
          + '</div>')));

      // ESTADO, não ação: quem decide é o switch. Os botões para forçar cada passo vivem no
      // cartão de manutenção manual, no fim do Painel — a GUI é para o que é automático.
      setHtml('ap-auto-base', card('Ações de base — quem decide', 'o motor executa sozinho quando vai à Fonte',
        '<p class="hint">Ir à Fonte, vender, repor poções, cofre, mercado, atributos e tarefas são decididos pelos <b>switches</b> da lista acima. Quando o switch está ligado e alguma pendência paga a viagem, o motor vai e faz — não há nada para clicar aqui.</p>'
        + '<p class="hint">Para forçar um passo agora, use <b>Manutenção manual</b>, no fim deste painel.</p>'));

      setHtml('ap-auto-tarefa', card('Tarefas e recompensas', 'Capitão da Legião, na Fonte',
        '<div id="ap-tarefa-estado"></div>'
        + '<p class="hint">Aceitar a tarefa, entregar quando fica pronta e pegar as diárias são feitos sozinhos na rotina de base (com o switch <b>Manutenção</b> ligado).</p>'));

      // Os botões desta antiga "Ferramentas" passaram para o cartão de manutenção manual (fim do Painel).
      setHtml('ap-auto-ferramentas', '');
    }
    // A ÁRVORE DE INTERRUPTORES redesenha SEMPRE (o estado dela muda com a config, com o campeão
    // e com o local) — não faz parte do bloco "constrói uma vez" acima.
    renderArvore();
    // ---- ALVOS DO AUTO-PLAY: em que campeões o motor pode jogar (pedido do dono, 2026-10-18) --
    // A LISTA de campeões do jogo é a mesma que o motor lê do KITS (nunca escrita à mão — REGRA
    // N.º 3); o motor ainda não a pode ter quando este render corre, e por isso este cartão
    // redesenha SEMPRE (fora do "constrói uma vez"). Sem alvos (null/vazio) = qualquer campeão.
    {
      const alvos = (() => { const v = ler('campeoesAlvo', []); return Array.isArray(v) ? v : []; })();
      const lista = (() => { const v = ler('campeoesDoJogo', []); return Array.isArray(v) ? v : []; })();
      const qualquer = !alvos.length;
      const nomeC = (id) => String(id || '').charAt(0).toUpperCase() + String(id || '').slice(1);
      setHtml('ap-auto-champ', card('Em que campeões jogar', 'fora desta lista o motor só observa — não joga',
        (lista.length
          ? '<div class="grid2">'
            + tg('ap-champ-any', 'Qualquer campeão', 'Corre em qualquer campeão (desliga a restrição de alvos).', qualquer)
            + lista.map((ch) => tg('ap-champ-' + ch.id, ch.nome || nomeC(ch.id), 'Joga sozinho com ' + (ch.nome || ch.id) + '.', !qualquer && alvos.indexOf(ch.id) >= 0)).join('')
            + '</div>'
          : '<p class="vazio">O motor ainda não leu a lista de campeões do jogo. Ela chega com o catálogo (F5 se demorar).</p>')
        + '<p class="hint">' + (qualquer
          ? 'Sem restrição: o auto-play corre em <b>qualquer campeão</b>.'
          : 'O motor só joga com <b>' + esc(alvos.map(nomeC).join(', ') || '—') + '</b>; nos outros fica só a observar.')
        + ' Isto <b>não</b> liga o auto-play — quem liga é o switch mestre.</p>'));
    }
    // valores dinâmicos
    const obj = $('ap-obj'); if (obj && obj.value !== (c.objetivo || 'xp')) obj.value = c.objetivo || 'xp';
    const automatica = !c.regionDefault;
    const modo = $('ap-reg-modo');
    if (modo) { const v = automatica ? 'auto' : 'fixa'; if (modo.value !== v) modo.value = v; }
    // DROPDOWN DA REGIÃO: com a região automática o dropdown não pode parecer que manda. Fica
    // marcado como ignorado e aponta para a região que o MOTOR está a usar (nunca para uma
    // região diferente da que está em uso).
    const rid = $('ap-reg-id');
    const idIdeal = ler('regiaoIdeal', null);
    if (rid) {
      const alvo = c.regionDefault || idIdeal || null;
      if (alvo && rid.value !== alvo && qa('#ap-reg-id option').some((o) => o.value === alvo)) rid.value = alvo;
      rid.classList.toggle('ignorada', automatica);
    }
    const setChk = (id, v) => { const e = $(id); if (e && e.checked !== !!v) e.checked = !!v; };
    setChk('ap-cfg-autoEquip', c.autoEquip); setChk('ap-cfg-trocaItens', c.trocaItens);
    setChk('ap-cfg-autoAtrib', c.autoAtrib); setChk('ap-cfg-autoRefino', c.autoRefino);
    // o que falta fazer na base (checklist viva)
    const fb3 = faltasBase();
    if (fb3) {
      const chaves = Object.keys(fb3.n).filter((k) => NECESSIDADE_NOME[k]);
      setHtml('ap-auto-falta', card('O que falta fazer na base', 'lista do motor — só o que é preciso',
        '<div class="chips">' + chaves.map((k) => '<span class="chip" style="border-color:' + (fb3.n[k] ? '#7a5f2a' : '#2b5c33') + '">'
          + (fb3.n[k] ? '⏳ ' : '✔ ') + esc(NECESSIDADE_NOME[k]) + '</span>').join('') + '</div>'
        + '<p class="hint">' + (fb3.faltam.length
          ? 'Pendente agora: <b>' + esc(fb3.faltam.map((k) => NECESSIDADE_NOME[k] || k).join(' · ')) + '</b>.'
          : 'Nada pendente: a base está completa.') + '</p>'
        + (naBase() ? '' : '<p class="hint">Você não está na Fonte — esta lista só se executa lá.</p>')));
    } else {
      setHtml('ap-auto-falta', '');
    }
    // auto-poção: valores actuais (sem reconstruir o cartão, para não perder o foco)
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
        const agora = hp && hp.cur <= gatilho ? ' — <b>AGORA!</b>' : '';
        tx.innerHTML = 'usa quando você perder <b>' + fmt(perdido) + ' de vida</b> (' + (v.mode === 'pct' ? val + '%' : 'valor fixo') + ') → com vida abaixo de <b>' + fmt(gatilho) + '</b>' + agora;
      }
    }
    const setChk2 = (id, val) => { const e = $(id); if (e && e.checked !== !!val) e.checked = !!val; };
    setChk2('ap-pc-strongest', config ? config.mode === 'strongest' : false);
    setChk2('ap-pc-smart', config ? config.smart !== false : true);
    const minP2 = c.minPotion || { vida: 200, vidaF: 100, vidaS: 30 };
    for (const k of ORDER) { const e = $('ap-min-' + k); if (e && String(e.value) !== String(minP2[k])) e.value = minP2[k]; }
    const rec = recomendacao();
    // REGIÃO EM USO, dita por palavras. Nunca fica ambíguo: ou é automática (com o nome que o
    // motor escolheu), ou é fixa (com o nome que você escolheu).
    const emUso = c.regionDefault
      ? 'FIXA (você escolheu: <b>' + esc(nomeRegiao(c.regionDefault)) + '</b>)'
      : 'automática (o motor escolheu: <b>' + esc(rec ? limparNivel(rec.regiao) : (idIdeal ? nomeRegiao(idIdeal) : '—')) + '</b>)';
    setHtml('ap-reg-info', '<p class="aviso ' + (c.regionDefault ? 'warn' : 'ok') + '">Região em uso: ' + emUso + '.'
      + (c.regionDefault ? ' Enquanto estiver fixa, o motor <b>não</b> escolhe sozinho — mude para <b>Automática</b> para ele voltar a decidir.' : ' O motor muda de região sozinho quando compensa.') + '</p>'
      + (rec ? '<p class="hint">Melhor para o seu nível agora: <b>' + esc(limparNivel(rec.regiao)) + '</b> · ' + fmt(rec.ouroLiquidoMin) + ' ouro limpo/min · ' + fmt(rec.xpMin) + ' xp/min' + (rec.sobrevive ? '' : ' · ⚠ o chefe dessa região mata você, o motor fica só nos mobs') + (rec.sinalUlt ? ' · ⚠ mobs lentos: a ultimate passa a valer a pena' : '') + '</p>' : ''));
    const nota = $('ap-base-nota');
    if (nota) nota.innerHTML = naBase() ? '✔ Você está na <b>Fonte</b>: todas as ações de base funcionam.'
      : '⚠ Você não está na Fonte (está em <b>' + esc(String((ler('readLocation', {}) || {}).text || '?')) + '</b>). As ações de base só funcionam lá. Quando você voltar, o motor faz a rotina sozinho (switch <b>Manutenção</b> ligado).';
    const te = $('ap-tarefa-estado');
    if (te) {
      const st = ler('tarefaEstado', {}) || {};
      te.innerHTML = st.tem
        ? '<p class="aviso ' + (st.pronta ? 'ok' : '') + '">Tarefa atual: ' + esc(st.texto || '—') + (st.pronta ? ' — <b>PRONTA para entregar</b>' : '') + '</p>'
        : '<p class="vazio">Sem tarefa ativa. Fala com o Capitão da Legião na Fonte.</p>';
    }
    // leitura do que trava
    const dg = diagBase();
    const saude = ler('saudeAutoplay', null) || {};
    const meta = ler('getMeta', {}) || {};
    const travas = (dg && dg.trava) ? dg.trava : [];
    setHtml('ap-auto-diag', card('O que está travando', 'leitura direta do motor',
      '<div class="kvs">'
      + kv('auto-play', a.ligado ? 'ligado' : 'desligado')
      + kv('pausa', a.pausado ? 'pausado' : 'livre')
      + kv('na Fonte', dg ? (dg.naBase ? 'sim' : 'não') : '—')
      + kv('último batimento', saude.ultimoTickHaMs == null ? '—' : 'há ' + fmtDur(saude.ultimoTickHaMs))
      + kv('temporizadores', saude.timers == null ? '—' : String(saude.timers))
      + kv('catálogo do jogo', meta.at ? 'lido há ' + fmtDur(Date.now() - meta.at) : 'não lido')
      + '</div>'
      + (meta.erro ? '<p class="aviso err">O motor não conseguiu ler o catálogo do jogo: ' + esc(meta.erro) + '</p>' : '')
      + (travas.length ? '<p class="aviso warn">Travando agora: ' + esc(travas.map(traduzTrava).join(' · ')) + '</p>' : '<p class="aviso ok">Nada está travando o motor.</p>')
      + '<p class="hint">Se "último batimento" passar de 10 s com o auto-play ligado, algo travou o motor: recarrega a página (F5).</p>'));
  }

  // ------------------------------------- COFRE + MERCADO (leituras GRAVADAS pelo motor)
  // REGRA DESTE BLOCO: o que está GUARDADO é sempre visível (é o que o motor já gravou em
  // chrome.storage: `salvarCofre`/`salvarOfertas`); ABRIR/RETIRAR são ações secundárias e
  // só ficam ativas quando o jogo as permite. Nunca se mostra o erro cru como se fosse bug.
  const QL = ['C', 'B', 'A', 'S', 'SS'];
  const qOrd = (q) => Math.max(0, QL.indexOf(String(q || 'C').toUpperCase()));
  const localTexto = () => String((ler('readLocation', {}) || {}).text || '');
  /** O cofre abre na Fonte (Tesoureira de Piltover) e nas cidades (Burrinho de Carga).
   *  Pergunta-se ao JOGO em vez de adivinhar pelo nome do sítio: se o NPC estiver no DOM, o
   *  motor consegue abri-lo (é a MESMA condição do `clickNPC` do motor). */
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
  /** Cofre ABERTO agora no jogo (verdade viva, lida pelo motor) — vazio se estiver fechado. */
  const cofreAberto = () => cache('cofreLive', 3000, () =>
    (ler('lerCofreSlots', []) || []).filter((i) => i.acao === 'retirar' || i.acao === 'sacar')) || [];
  /** O que o motor tem em memória (slots abertos agora ou a última leitura que ele gravou). */
  const cofreItens = () => { const v = ler('cofreConhecido', null); return Array.isArray(v) ? v : []; };
  /** Última leitura GRAVADA pelo motor: { at, itens } — o `at` diz QUANDO foi lido. */
  const cofreGravado = () => (cofreStore && Array.isArray(cofreStore.itens) ? cofreStore : { at: 0, itens: [] });
  /** O que se sabe que está guardado: cofre aberto -> memória do motor -> última gravação. */
  function cofreSabido() {
    const live = cofreAberto();
    if (live.length) return live;
    const c = cofreItens();
    if (c.length) return c;
    return cofreGravado().itens || [];
  }
  const porQualidade = (a, b) => (qOrd(b.qual) - qOrd(a.qual)) || ((b.refino || 0) - (a.refino || 0));
  /** Melhor instância conhecida (maior qualidade, depois maior refino) — regra do motor. */
  function melhorConhecido() {
    const l = cofreSabido().slice();
    if (!l.length) return null;
    l.sort(porQualidade);
    return l[0];
  }
  /** Slot do item. O motor ainda NÃO passa a chave do slot em `lerCofreSlots`, por isso cai-se
   *  na posição na grade; quando ele passar (`k`/`slot`) passa a aparecer sozinho. */
  const cofreSlot = (i, n) => String((i && (i.k || i.slot || i.slotId)) || ('#' + (n + 1)));
  const nomeCofre = (i) => (i && (i.nome || i.base)) || '?';
  const tagCofre = (i) => (i && i.qual ? '[' + i.qual + ']' : '') + (i && i.refino ? (i.qual ? ' +' : '+') + i.refino : '');
  /** Motivos do cofre traduzidos — o motor fala em seletores, a GUI fala em sítios. */
  function motivoCofre(m) {
    const t = String(m || '');
    if (/sem Tesoureira\/Burrinho|sem cofre aqui/i.test(t)) return 'o cofre só abre na Fonte ou na cidade (Tesoureira de Piltover / Burrinho de Carga). Você está em ' + (localTexto() || '?') + '.';
    if (/sem opcao cofre/i.test(t)) return 'o NPC respondeu, mas não apareceu a opção "cofre" — tenta outra vez na Fonte ou na cidade.';
    if (/^sem .* no cofre$|slot nao achado/i.test(t)) return 'esse item já não está no cofre (a leitura pode estar desatualizada) — use "Forçar leitura do cofre agora" (manutenção manual).';
    if (/sem slot guardar/i.test(t)) return 'não encontrei esse item no cofre para o guardar — abre o cofre na Fonte ou na cidade.';
    return t || 'não foi possível (o motor não disse porquê)';
  }
  /** Cartão do cofre: PRIMEIRO o que está guardado; as ações ficam em baixo e só quando dão. */
  function renderCofre() {
    const live = cofreAberto();
    const grav = cofreGravado();
    const itens = cofreSabido().slice().sort(porQualidade);
    const abertoAgora = live.length > 0;
    const at = abertoAgora ? 0 : (Number(grav.at) || 0);
    const pode = podeCofre();
    const local = localTexto() || '?';
    const melhor = melhorConhecido();
    // O HTML tem de ser ESTÁVEL (nada de horas lá dentro): se mudasse a cada segundo, o
    // setHtml reconstruía o cartão e apagava a escolha feita no "item a retirar". A hora vai
    // para o <span> do cabeçalho e é escrita depois, com textContent.
    const lista = itens.length
      ? tabela(['slot', 'item', 'qualidade', 'refino', 'quantidade'], itens.map((i, n) => '<tr><td>' + esc(cofreSlot(i, n)) + '</td><td>'
        + (i.base ? '<img src="' + ITEM_IMG(i.base) + '" alt="" loading="lazy" onerror="this.style.opacity=.2">' : '') + esc(nomeCofre(i))
        + '</td><td>' + esc(i.qual || 'C') + '</td><td>' + (i.refino ? '+' + esc(i.refino) : '—') + '</td><td>' + (i.qtd == null ? '—' : '×' + fmt(i.qtd)) + '</td></tr>').join(''))
      : '<p class="vazio">Ainda não há leitura do cofre — não sei o que está guardado.</p>'
        + '<p class="hint">O motor lê o cofre sozinho quando passa pela Fonte e <b>grava</b> o que lá está. A partir daí esta lista aparece aqui sempre que você quiser, onde você estiver.</p>';
    const corpo = lista
      + (pode ? '' : '<p class="hint">O cofre só abre na Fonte ou na cidade (Tesoureira de Piltover / Burrinho de Carga) — você está em <b>' + esc(local) + '</b>. A lista acima é a última leitura gravada.</p>')
      + diag('Cofre: forçar leitura e ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-cofre-ler', '👀 Forçar leitura do cofre agora',
        pode ? 'Fala com a Tesoureira (Fonte) ou o Burrinho (cidade), lê o que está guardado e <b>grava</b> — esta lista passa a ser a verdade.'
          : 'Só funciona na Fonte ou na cidade. Você está em <b>' + esc(local) + '</b>.', !pode)
      + acaoD('ap-cofre-melhor', '⬆ Retirar o melhor item',
        melhor ? 'Tira <b>' + esc(nomeCofre(melhor)) + '</b> ' + esc(tagCofre(melhor)) + ' — maior qualidade e, depois, maior refino. Abre o cofre sozinho se for preciso.'
          : 'Ainda não há leitura do cofre: use "Forçar leitura do cofre agora" (manutenção manual) para o motor saber o que lá está.', !pode || !melhor)
      + '</div>'
      + (itens.length
        ? linha('Retirar um item específico', 'a lista é o que o motor sabe que está guardado no cofre',
          '<select id="ap-cofre-alvo">' + itens.map((i) => '<option value="' + esc(i.base || '') + '">' + esc(nomeCofre(i)) + ' ' + esc(tagCofre(i)) + '</option>').join('') + '</select>'
          + '<button id="ap-cofre-tirar" class="btn sec"' + (pode ? '' : ' disabled') + '>⬆ Retirar<small class="tagd">manual</small></button>')
        : '');
    setHtml('ap-it-cofre', card('Cofre — o que está guardado', '<span id="ap-cofre-quando">—</span>', corpo));
    const q = $('ap-cofre-quando');
    if (q) q.textContent = abertoAgora ? 'cofre aberto agora — leitura viva do jogo'
      : (at ? 'lido há ' + fmtDur(Date.now() - at) + ' · às ' + hora(at) + (itens.length ? ' · ' + itens.length + ' item(ns)' : '')
        : (itens.length ? itens.length + ' item(ns) guardados' : 'sem leitura gravada'));
  }

  // ---------------------------------------------------------------- ABA ITENS
  let bagLida = null, bagLidaEm = 0, bagAuto = false;   // bagAuto: leitura passiva (sem clique)
  const protegidos = () => cache('proteg', 30000, () => {
    const mapa = new Map();
    mapa.set(RABADON, 'Rabadon — nunca é vendido nem anunciado, nem duplicado');
    const m = MOTOR();
    // PRIORIDADE EXTREMA: a tabela é do MOTOR (automation.js:47, exposta em window.__lolidleAuto
    // junto do resto) — nada desta lista foi escrito à mão. O critério é o item ser multiplicador
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
    // lista e a decisão de quais contam para ESTE campeão vem do motor (ehEspecialMeu,
    // basesReservadas, fasesDoItem) — a GUI só desenha.
    const esp = (m && Array.isArray(m.ITENS_ESPECIAIS)) ? m.ITENS_ESPECIAIS : [];
    for (const e of esp) {
      if (!e || e.id == null) continue;
      const chaveE = String(e.id);
      if (mapa.has(chaveE)) continue;
      if (chamar('ehEspecialMeu', chaveE).v !== true) continue;      // o motor diz se é MEU
      mapa.set(chaveE, (e.motivo || 'item especial da sua classe') + ' · tratamento especial do seu campeão');
    }
    const res = chamar('basesReservadas');
    if (res.ok && res.v && typeof res.v.forEach === 'function') {
      res.v.forEach((b) => {
        const chaveR = String(b);
        if (mapa.has(chaveR)) return;
        const f = chamar('fasesDoItem', chaveR);
        const fases = (f.ok && Array.isArray(f.v) && f.v.length) ? f.v.join(' + ') : 'fase';
        mapa.set(chaveR, 'peça da build de ' + fases + ' — fica reservada para a troca por fase');
      });
    }
    return mapa;
  });

  function renderItens() {
    const eq = ler('readEquip', []) || [];
    const ideal = buildIdeal();
    const prot = protegidos();
    const eqBases = eq.map((e) => String(e.base));
    const faltam = ideal.filter((b) => eqBases.indexOf(String(b)) < 0);
    const linhaItens = (ids, extra) => '<div class="frames">' + ids.map((b) => {
      const e = eq.find((x) => String(x.base) === String(b));
      const pr = prot.has(String(b));
      return itemFrame(b, e ? e.qual : '', e ? e.refino : '', e ? e.raridade : (extra ? 'falta' : ''),
        nomeItem(b) + (pr ? ' 🔒 ' + prot.get(String(b)) : '') + (e ? '' : ' (falta)'));
    }).join('') + '</div>';
    const ident = identidade() || {};
    setHtml('ap-it-build', card('Build de agora vs. build ideal', 'o motor calcula a melhor build para o seu campeão',
      '<div class="kvs">' + kv('campeão', esc(ident.nome || '—')) + kv('classe', esc(String(ident.classe || '').toUpperCase() || '—')) + kv('perfil', esc(ident.perfil || '—')) + '</div>'
      + '<p class="hint">Equipado agora (' + eq.length + '):</p>' + linhaItens(eqBases)
      + '<p class="hint">Build ideal (' + ideal.length + '):</p>' + linhaItens(ideal, true)
      + (faltam.length
        ? '<p class="aviso warn">Falta: ' + faltam.map((b) => '<b>' + esc(nomeItem(b)) + '</b>').join(', ') + ' — veja onde cada um dropa em <b>Ganhos</b> ▸ Auto farm pra item.</p>'
        : '<p class="aviso ok">Você tem a build ideal completa. 🎉</p>')
      + (ideal.length === 0 ? '<p class="aviso err">O motor ainda não sabe qual é o seu campeão (o HUD ainda não carregou). Sem isso não há build ideal nem protecções.</p>' : '')));

    setHtml('ap-it-proteg', card('Blindados — nunca são vendidos', 'o mesmo critério que o motor aplica',
      '<div class="chips" data-blindados="motor">' + Array.from(prot.entries()).map(([b, motivo]) =>
        '<span class="chip ' + (String(b) === RABADON ? 'lendario' : '') + '" title="' + esc(motivo) + '">' + (ITEM_IMG(b) ? '<img src="' + ITEM_IMG(b) + '" alt="">' : '') + esc(nomeItem(b)) + ' <small>🔒</small></span>').join('') + '</div>'
      + '<p class="hint">A lista sai do <b>motor</b>: multiplicadores de classe (o Gume do Infinito <b>3031</b> e o Rabadon <b>3089</b> ficam protegidos em qualquer campeão, duplicados incluídos), itens de tratamento especial do seu campeão, lendários da build, peças reservadas das builds de mobs e de chefe e o que está equipado em qualidade S ou SS. Um item que ainda está a ser avaliado (qualidade "?") também não é tocado.</p>'));

    // mochila: o motor lê o `#mochila` DIRECTAMENTE (o jogo mantém-no atual, aberto ou não —
    // jogo.js:6621), logo tenta-se uma leitura passiva antes de pedir um clique ao usuário.
    if (!bagLida) lerMochila(false, true);
    if (!bagLida) {
      setHtml('ap-it-mochila', card('Mochila', 'ainda não legível nesta página',
        '<p class="vazio">A mochila ainda não está legível.</p>'
        + '<p class="hint">Se você ainda não abriu a bolsa desde que a página carregou, abra uma vez no jogo (tecla I). A partir daí o motor lê-a sozinho, sem voltando abrindo.</p>'
        + diag('Leitura da mochila (manutenção manual)')
      + '<div class="acoes">' + acaoD('ap-scan', '🎒 Forçar leitura da mochila', 'Lê o conteúdo da mochila — não abre nem fecha nada no jogo.') + '</div>'));
      setHtml('ap-it-plano', '');
    } else {
      const b = bagLida;
      setHtml('ap-it-mochila', card('Mochila', bagAuto ? 'lida diretamente do jogo' : 'lida há ' + fmtDur(Date.now() - bagLidaEm),
        '<div class="kvs">' + kv('ocupação', fmt(b.used) + ' / ' + fmt(b.cap)) + kv('espólio', String(b.espacosEspolio)) + kv('ouro', fmt(ler('readGold', null))) + '</div>'
        + '<div class="chips">' + ((b.items || []).map((i) => i.kind === 'espolio'
          ? '<span class="chip" title="espólio ×' + esc(i.qty) + '">📦 ×' + fmt(i.qty) + '</span>'
          : '<span class="chip ' + esc(i.raridade || '') + '" title="' + esc(nomeItem(i.base) + ' · qualidade ' + i.qual + (i.refino ? ' · refino +' + i.refino : '')) + '">'
            + '<img src="' + ITEM_IMG(i.base) + '" alt="">' + esc(nomeItem(i.base)) + ' <small>' + esc(i.qual || '') + (i.refino ? '+' + i.refino : '') + '</small></span>').join('') || '<span class="vazio">mochila vazia</span>')
        + '</div>'
        + diag('Leitura da mochila (manutenção manual)')
        + '<div class="acoes">' + acaoD('ap-scan', '🔄 Forçar leitura da mochila', 'Lê a mochila de novo. O motor lê sozinho quando a mochila muda.') + '</div>'));

      // O motor exige a mochila: `planBag(bag, marketCount, marketCap)` (automation.js:338).
      // Sem ela rebenta — e o erro é NOSSO (falta de argumento), não do motor.
      const rp = chamar('planBag', b);
      const plano = rp.ok ? rp.v : null;
      if (plano && plano.acts) {
        const grupos = {};
        for (const a2 of plano.acts) (grupos[a2.action] = grupos[a2.action] || []).push(a2);
        const ordem = ['PROTEGER', 'GUARDAR', 'GUARDAR_COFRE', 'ANUNCIAR_MERCADO', 'VENDER_LOJISTA'];
        const vendidos = (grupos.VENDER_LOJISTA || []).length;
        setHtml('ap-it-plano', card('O que vai acontecer a cada item', 'plano do motor, com o motivo',
          (vendidos ? '<p class="aviso warn">' + vendidos + ' item(ns) vão ser <b>vendidos ao lojista</b> na próxima rotina de base.</p>' : '<p class="aviso ok">Nada será vendido ao lojista.</p>')
          + ordem.map((act) => {
            const lista = grupos[act] || [];
            if (!lista.length) return '';
            const info = ACAO_ITEM[act] || { txt: act, cls: '' };
            return '<p class="hint"><b>' + esc(info.txt) + '</b> (' + lista.length + ')</p><div class="lista">' + lista.map((x) =>
              '<div class="ln ' + info.cls + '"><b>' + esc(nomeItem(x.it.base)) + '</b> ' + esc(x.it.qual || '') + (x.it.refino ? '+' + x.it.refino : '')
              + '<span class="d">' + esc(x.why || '') + '</span></div>').join('') + '</div>';
          }).join('')
          + '<p class="hint">Os motivos são escritos pelo motor; esta lista é o que a rotina de base vai executar.</p>'));
      } else {
        setHtml('ap-it-plano', card('O que vai acontecer a cada item', 'plano do motor',
          '<p class="aviso err">Não foi possível calcular o plano da mochila: '
          + esc(rp.ok ? 'o motor não devolveu um plano' : String(rp.erro)) + '.</p>'
          + '<p class="hint">A mochila FOI lida (' + fmt(b.used) + '/' + fmt(b.cap) + ' espaços usados); o plano é o motor que calcula a partir dela.</p>'));
      }
    }

    // contribuição de cada item
    const dps = ler('dpsItens', null, eqBases, idRegiaoDe((ler('readLocation', {}) || {}).text));
    if (dps) {
      const linhaD = (t, titulo) => t ? '<p class="hint">' + titulo + ': ' + t.porItem.map((x) => esc(x.nome) + ' <b>' + fmt(x.dps) + '</b>').join(' · ') + ' → total <b>' + fmt(t.total) + '</b>/s</p>' : '';
      setHtml('ap-it-dps', card('Quanto cada item dá de dano para você', 'estimativa do motor para esta região',
        (linhaD(dps.chefe, 'Contra o chefe') || '') + (linhaD(dps.mob, 'Contra mobs') || '')
        + '<p class="hint">Serve para ver se vale trocar uma peça: o número é o dano por segundo que aquele item acrescenta ao conjunto.</p>'));
    } else setHtml('ap-it-dps', '');

    // O antigo cartão "Farmar itens específicos" MUDOU-SE para a aba Ganhos, onde passou a ser a
    // modalidade "Auto farm pra item" (renderFarmItens, seção 5). O div `ap-it-farmar` deixou de
    // existir no DOM — não há nada para desenhar aqui.
    // COFRE: primeiro o que está GUARDADO (última leitura que o motor gravou); abrir/retirar
    // ficam em baixo e só aparecem ativos quando o jogo os permite.
    renderCofre();
  }

  // ---------------------------------------------------------------- ABA HABILIDADES
  function renderSkills() {
    const sk = ler('readSkills', null);
    const dps = ler('dpsPorHabilidade', null);
    if (!sk) { setHtml('ap-sk-barra', card('Barra de combate', '', '<p class="aviso err">O motor não conseguiu ler as habilidades. Recarrega a página.</p>')); setHtml('ap-sk-pontos', ''); setHtml('ap-sk-ordem', ''); setHtml('ap-sk-dps', ''); setHtml('ap-sk-acoes', ''); return; }
    const barra = (sk.bar || []).map((h) => {
      const ult = ler('ehUltimate', false, h.t);
      return '<span class="chip ' + (h.ready ? '' : '') + '" title="' + esc(h.nome || h.t) + '">' + esc(h.nome || h.t) + ' <small>' + (h.ready ? 'pronto' : (h.cd != null ? h.cd + 's' : 'em recarga')) + (ult ? ' · ULTIMATE' : '') + '</small></span>';
    }).join('') || '<span class="vazio">nenhuma habilidade na barra</span>';
    setHtml('ap-sk-barra', card('Barra de combate', 'as habilidades que o jogo usa sozinho',
      '<div class="chips">' + barra + '</div>'
      + '<p class="hint">A <b>ultimate</b> só é usada contra chefes (ou em áreas muito difíceis) — em mobs normais o motor guarda-a.</p>'));

    const pontos = sk.pontos || 0, pontosAtrib = sk.pontosAtrib || 0;
    setHtml('ap-sk-pontos', card('Pontos para gastar', 'lido do HUD dourado do jogo',
      '<div class="kvs">' + kv('habilidades', String(pontos)) + kv('atributos', String(pontosAtrib)) + '</div>'
      + '<p class="hint">' + (sk.hudTexto ? 'O jogo diz: "' + esc(sk.hudTexto) + '"' : 'O HUD não está mostrando pontos.') + '</p>'
      + '<p class="hint">Habilidades e atributos ficam na mesma aba, <b>Personagem</b>: aqui sobem-se as habilidades; os pontos de atributo estão logo abaixo.</p>'));

    // ordem de subida (a MESMA regra do motor: rank 0 primeiro, depois maior dano)
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
    setHtml('ap-sk-ordem', card('Ordem de subida', 'a mesma regra que o motor usa no botão de subir',
      tabela(['#', 'habilidade', 'rank', 'dano/s', 'na barra', 'situação'],
        arsenal.map((h, i) => '<tr class="' + (proximo && proximo.t === h.t ? 'melhor' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(h.name || h.t)
          + (ler('ehUltimate', false, h.t) ? ' 👑' : '') + '</td><td>' + (h.rank == null ? '—' : h.rank + '/' + (h.maxRank || '?')) + '</td><td>' + fmt(dpsDe[h.t] || 0)
          + '</td><td>' + (h.onBar ? 'sim' : 'não') + '</td><td>' + (h.max ? 'no máximo' : (!liberada(h) ? ('bloqueada (nível ' + (h.nivel || '?') + ')') : (h.rank === 0 ? 'por desbloquear' : 'pode subir'))) + '</td></tr>').join(''),
        'sem habilidades lidas')
      + (proximo ? '<p class="aviso ok">O próximo ponto vai para <b>' + esc(proximo.name || proximo.t) + '</b>' + ((proximo.rank || 0) === 0 ? ' (desbloquear — ao desbloquear entra sozinha na barra)' : ' (a que dá mais dano)') + '.</p>'
        : '<p class="aviso">Nada para subir agora (tudo no máximo ou sem pontos).</p>')));

    setHtml('ap-sk-dps', card('Dano de cada habilidade', 'estimativa do motor com os seus stats',
      dps ? '<div class="kvs">' + kv('poder de habilidade', fmt(dps.ap)) + kv('dano de ataque', fmt(dps.ad)) + kv('nível', String(dps.nivel)) + '</div>'
        + tabela(['habilidade', 'rank', 'dano direto/s', 'adaga/s', 'Lich/s', 'total/s', 'recarga'],
          (dps.habs || []).filter((h) => h.dano || h.passiva).slice(0, 16).map((h) => '<tr><td>' + esc(h.nome || h.t) + (h.naBarra ? ' *' : '') + (h.adaga ? ' 🗡' : '') + '</td><td>' + (h.rank == null ? '—' : h.rank)
            + '</td><td>' + (h.dpsDireto ? fmt(h.dpsDireto) : '—') + '</td><td>' + (h.dpsAdaga ? fmt(h.dpsAdaga) : '—') + '</td><td>' + (h.dpsLich ? fmt(h.dpsLich) : '—')
            + '</td><td><b>' + (h.dps != null ? fmt(h.dps) : '—') + '</b></td><td>' + (h.cd != null ? h.cd + 's' : '—') + '</td></tr>').join(''), 'sem dados')
        + '<p class="hint">* = está na barra de combate · 🗡 = deixa adaga (dispara a Voracidade)</p>'
        : '<p class="aviso err">O motor não conseguiu calcular o dano das habilidades.</p>'));

    const idealBarra = ler('barraIdeal', null);
    if (idealBarra && idealBarra.length) {
      const naBarra = (sk.bar || []).map((h) => h.t);
      const igual = idealBarra.length === naBarra.length && idealBarra.every((t) => naBarra.indexOf(t) >= 0);
      const nomeDe = (t) => { const h = (sk.arsenal || []).find((x) => x.t === t); return (h && (h.name || h.t)) || t; };
      setHtml('ap-sk-ideal', card('Barra ideal (segundo o motor)', 'as 4 habilidades que dão mais dano',
        '<div class="chips">' + idealBarra.map((t) => '<span class="tag">' + esc(nomeDe(t)) + (ler('ehUltimate', false, t) ? ' 👑' : '') + '</span>').join('') + '</div>'
        + '<p class="aviso ' + (igual ? 'ok' : 'warn') + '">' + (igual ? 'A sua barra já está igual à ideal.' : 'A sua barra está diferente da ideal — o switch "Repor a rotação na barra" corrige isto sozinho.') + '</p>'));
    } else setHtml('ap-sk-ideal', '');
    setHtml('ap-sk-acoes', card('Habilidades — o que o motor sobe sozinho', 'o switch "Subir habilidades" faz isto; os botões abaixo são manutenção manual',
      diag('Habilidades: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-subir-habs', '⬆ Subir habilidades (' + fmt(pontos) + ' ponto(s))', 'Gasta todos os pontos livres: primeiro desbloqueia, depois sobe a que dá mais dano.', pontos ? '' : 'sec')
      + acaoD('ap-rotacao', '🔁 Repor a rotação na barra', 'Põe na barra as 4 habilidades prontas que dão mais dano (mantém sempre as melhores disponíveis).')
      + acaoD('ap-trocar-skills', '🔄 Trocar só as que estão em recarga', 'Substitui as habilidades em recarga por outras já desbloqueadas e prontas.')
      + '</div>'
      + '<p class="hint">A ultimate nunca é trocada para fora da barra pelo motor.</p>'));
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
      + '<p class="hint">Se a lista ao lado estiver vazia, abra a aba <b>Atributos</b> no jogo uma vez para o painel existir na página.</p>'));

    setHtml('ap-at-lista', card('Distribuição atual', 'lida do painel do jogo',
      atrs.length
        ? tabela(['atributo', 'pontos', 'total com equipamento'],
          atrs.map((a) => '<tr><td>' + esc(a.nome) + '</td><td><b>' + (a.valor == null ? '—' : a.valor) + '</b></td><td>' + (a.total == null ? '—' : a.total) + '</td></tr>'))
        : '<p class="vazio">O painel de atributos do jogo ainda não está na página. Abra a aba "Atributos" no jogo e volte aqui.</p>'));

    const modelos = meta.modelos || null;
    const dica = meta.dicaAtributos || null;
    setHtml('ap-at-modelo', card('Modelo de distribuição', 'como os pontos são repartidos',
      linha('Modelo', 'só é usado quando distribuis (à mão ou no automático)',
        '<select id="ap-at-modelo-sel">' + (modelos
          ? Object.keys(modelos).map((k) => '<option value="' + esc(k) + '">' + esc(modelos[k].nome || k) + '</option>').join('')
          : '<option value="equilibrado">Equilibrado</option>') + '</select>')
      + '<p class="hint" id="ap-at-sugestao"></p>'
      + (dica ? '<p class="aviso">Sugestão para este campeão: ' + esc(dica) + '</p>' : '')
      + '<p class="hint">' + (modelos ? Object.keys(modelos).map((k) => '<b>' + esc(modelos[k].nome || k) + '</b>: ' + esc(Object.keys(modelos[k].pesos || {}).map((p) => p + ' ' + modelos[k].pesos[p]).join(', '))).join(' · ') : 'O motor não tem modelos; usa o equilibrado.') + '</p>'));

    const st = ler('readStats', {}) || {};
    setHtml('ap-at-stats', card('Stats de combate', 'lidos da sua ficha no jogo',
      '<div class="kvs">'
      + Object.keys(st).map((k) => kv(k, fmt1(st[k]))).join('')
      + '</div>'));

    setHtml('ap-at-acoes', card('Atributos — o que o motor gasta sozinho', 'o switch "Distribuir pontos de atributo" faz isto; o botão abaixo é manutenção manual',
      diag('Atributos: ação manual (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-distribuir', '➕ Distribuir ' + fmt(sk.pontosAtrib || 0) + ' ponto(s)', 'Gasta todos os pontos livres pelo modelo escolhido. Não há como desfazer.', (sk.pontosAtrib || 0) > 0 ? '' : 'sec')
      + '</div>'
      + '<p class="hint">Regra do motor: cada ponto vai ao atributo que está mais atrasado em relação ao peso do modelo — o resultado fica equilibrado, não todo no mesmo.</p>'));
    const sel = $('ap-at-modelo-sel');
    const sugerido = ler('modeloAtribDe', null);
    if (sel) {
      const v = cfgv.modeloAtrib || sugerido || 'equilibrado';
      if (sel.value !== v) sel.value = v;
    }
    const nota = $('ap-at-sugestao');
    if (nota) nota.innerHTML = sugerido
      ? 'Modelo sugerido pelo motor para este campeão: <b>' + esc(sugerido) + '</b>' + (cfgv.modeloAtrib && cfgv.modeloAtrib !== sugerido ? ' (você escolheu <b>' + esc(cfgv.modeloAtrib) + '</b>)' : '') + '.'
      : '';
  }

  // ---------------------------------------------------------------- ABA FARM
  // POR ABATE x POR MINUTO (regra do motor):
  //   bossFase: { durMs: 35616, gold: 1526, xp: 3654, kills: 1, perMin: { gold: 2570.75, xp: 6155.66 } }
  //   O `bossFase` mede UM chefe (kills: 1) e o `perMin` é `loot / (durMs/60)` — uma TAXA sobre a
  //   janela. O xp/min sobe quando o chefe morre mais rápido (artefato de denominador: o xp do
  //   chefe é ~fixo) e o ouro/min não acompanha porque o LOOT VARIA (1526 / 1615 / 1149 nos três
  //   chefes medidos, ~40%). Comparar chefes por `perMin` premia quem morre rápido.
  //   O motor já tem o dado certo na mesma estrutura: `perKill = { gold: gold/kills, xp: xp/kills }`
  //   (automation.js:646, só quando kills > 0). A GUI mostra `perKill` para o CHEFE e mantém
  //   `perMin` para os MOBS (aí são muitos abates numa janela longa e a taxa faz sentido).
  /** Loot POR ABATE de uma fase: `perKill` do motor; sem ele, `loot / kills`; sem kills, null. */
  const porAbate = (fase) => {
    if (!fase) return null;
    if (fase.perKill) return fase.perKill;
    if ((fase.kills || 0) > 0) return { gold: (fase.gold || 0) / fase.kills, xp: (fase.xp || 0) / fase.kills };
    return null;
  };
  /** Poções de uma fase. Regra: `potions: 0` numa fase COM abates não é medição do combate —
   *  é o motor sem agir (modo observação). Quando a fase tem abates e nenhuma poção, mostra-se
   *  "—" em vez de 0. */
  const potTxt = (fase, porMinuto) => {
    const v = porMinuto != null ? porMinuto : (fase ? (fase.potions || 0) : null);
    if (v == null) return '—';
    if (!v && fase && (fase.kills || 0) > 0) return '—';
    return fmt1(v);
  };
  function renderFarm() {
    const f = farm();
    const cur = f.current;
    if (cur) {
      const fase = cur.fase === 'boss' ? cur.bossFase : cur.mobFase;
      const ms = Date.now() - ((fase && fase.startedAt) || cur.startedAt || Date.now());
      const pm = (v) => porMin(v, ms);
      const boss = cur.fase === 'boss';
      const pk = boss ? porAbate(fase) : null;
      const kvs = boss
        ? '<div class="kvs">'
          + kv('ouro por chefe', pk ? fmt(pk.gold) : '—') + kv('xp por chefe', pk ? fmt(pk.xp) : '—')
          + kv('tempo do chefe', fmtDur(ms)) + kv('poções usadas', potTxt(fase, pm(fase && fase.potions)))
          + '</div>'
          + '<p class="hint">A fase do chefe mede <b>um</b> chefe, então os números são <b>por chefe</b> (loot ÷ abates), com o tempo ao lado como custo. '
          + 'Por minuto aqui não compara chefes: o xp do chefe é quase fixo e o loot varia — dividir pelo tempo só premia quem morre rápido.</p>'
        : '<div class="kvs">'
          + kv('ouro/min', fmt(pm(fase && fase.gold))) + kv('xp/min', fmt(pm(fase && fase.xp)))
          + kv('poções/min', potTxt(fase, pm(fase && fase.potions))) + kv('abates/min', fmt(pm(fase && fase.kills)))
          + kv('dano/min', fmt(pm(fase && fase.dmg))) + kv('cura/min', fmt(pm(fase && fase.heal)))
          + '</div>'
          + '<p class="hint">Fase de mobs: muitos abates numa janela longa, então aqui a taxa <b>por minuto</b> é a leitura certa.</p>';
      setHtml('ap-fm-agora', card('Ganhos AGORA', 'medido neste ciclo (' + (boss ? 'fase do chefe' : 'fase de mobs') + ')',
        kvs
        + '<p class="hint">Região: <b>' + esc(limparNivel(cur.region)) + '</b> · ciclo começou há ' + fmtDur(Date.now() - (cur.startedAt || Date.now())) + (cur.deaths ? ' · mortes neste ciclo: ' + cur.deaths : '') + '</p>'));
    } else {
      setHtml('ap-fm-agora', card('Ganhos AGORA', '', '<p class="vazio">Sem ciclo ativo. Os números se enchem sozinhos quando você estiver no mapa.</p>'));
    }

    // previsor: real vs teórico para a build equipada
    const eqBases = (ler('readEquip', []) || []).map((e) => String(e.base));
    const regId = idRegiaoDe((ler('readLocation', {}) || {}).text);
    const prev = eqBases.length ? ler('preverBuild', null, eqBases, regId) : null;
    if (prev) {
      const bloco = (nome, x, teorico) => {
        if (!x) return '<p class="hint">' + nome + ': sem previsão.</p>';
        const fonte = x.fonte === 'historico' ? 'MEDIDO no jogo' : 'TEORIA (ainda não há medições)';
        const val = x.goldMin != null ? fmt(x.goldMin) + ' ouro/min · ' + fmt(x.xpMin) + ' xp/min'
          : (x.dps != null ? fmt(x.dps) + ' dano/s' : '—');
        return '<p class="aviso ' + (x.fonte === 'historico' ? 'ok' : '') + '">' + nome + ' — ' + val + ' <b>(' + fonte + (x.n ? ', n=' + x.n : '') + ')</b></p>';
      };
      setHtml('ap-fm-previsor', card('Previsão para a sua build de agora', 'medido quando existe; teoria quando não',
        bloco('Mobs', prev.mob, prev.teorico && prev.teorico.mob)
        + bloco('Chefe', prev.chefe, prev.teorico && prev.teorico.chefe)
        + '<p class="hint">Assinatura da build: ' + esc(prev.assinatura || '—') + '. O motor prefere sempre o que foi <b>medido</b>; a teoria serve só para começar.</p>'
        + diag('Medição (manutenção manual)')
        + '<div class="acoes">' + acaoD('ap-fm-testes', '🧪 Medir conjuntos de itens', 'O teste mede cada conjunto no jogo e alimenta esta previsão.') + '</div>'));
    } else setHtml('ap-fm-previsor', '');

    // regiões (medido × meta)
    const agg = agregado();
    const rec = recomendacao();
    setHtml('ap-fm-regioes', card('Regiões — o que foi medido', 'ouro/xp reais por minuto, com o risco calculado',
      agg.length
        ? tabela(['região', 'chefe', 'ouro/min', 'xp/min', 'abates/min', 'mortes', 'chefe mata?', 'poção (ouro/min)'],
          agg.map((r) => {
            const z = r.risco;
            const melhor = rec && rec.regiao === r.region;
            const risco = z ? (z.morte ? '💀 o golpe do chefe mata você' : (z.morre ? '⚠ você morre em ' + fmt1(z.tMorrer) + 's' : '✔ você sobrevive')) : '—';
            return '<tr class="' + (melhor ? 'melhor' : '') + '"><td>' + (melhor ? '⭐ ' : '') + esc(limparNivel(r.region)) + '</td><td>' + esc(limparNivel(r.boss || '—'))
              + '</td><td>' + fmt(r.goldMin) + '</td><td>' + fmt(r.xpMin) + '</td><td>' + fmt1(r.killsMin) + '</td><td>' + (r.deaths || 0)
              + '</td><td>' + risco + '</td><td>' + fmt(r.goldPotionMin) + '</td></tr>';
          }), 'Ainda não há ciclos medidos')
        : '<p class="vazio">Ainda não há ciclos medidos. Farmar um pouco numa região já cria histórico.</p>'
        + (rec ? '<p class="aviso ok">Recomendação agora: <b>' + esc(limparNivel(rec.regiao)) + '</b> — ' + fmt(rec.ouroLiquidoMin) + ' ouro limpo/min (' + (rec.sobrevive ? 'você sobrevive ao chefe' : 'só mobs: o chefe mata') + ').</p>' : '')));

    // ranking teórico
    const obj = cfg().objetivo || 'xp';
    const rank = ler('rankRegioes', [], obj) || [];
    setHtml('ap-fm-rank', card('Ranking por ' + (obj === 'ouro' ? 'ouro' : obj === 'runas' ? 'runas' : 'experiência'), 'estimativa do motor para o seu nível (teoria)',
      rank.length
        ? tabela(['#', 'região', 'chefe', 'xp/min', 'ouro/min', 'runas/hora'],
          rank.slice(0, 20).map((x, i) => '<tr class="' + (i === 0 ? 'melhor' : '') + '"><td>' + (i + 1) + '</td><td>' + (i === 0 ? '⭐ ' : '') + esc(x.nome)
            + '</td><td>' + esc(x.chefe || '—') + '</td><td>' + fmt(x.xpMin) + '</td><td>' + fmt(x.goldMin) + '</td><td>' + fmt(x.runasH) + '</td></tr>'),
          'sem dados do catálogo')
        : '<p class="vazio">O motor ainda não leu o catálogo do jogo.</p>'
        + '<p class="hint">Esta tabela é <b>teoria</b> (calculada). A tabela de cima é o que foi <b>medido</b> — vale mais.</p>'));

    // últimos ciclos: MOBS por minuto, CHEFE por abate (ver a nota no topo desta seção)
    const ciclos = (f.cycles || []).slice(0, 30);
    setHtml('ap-fm-ciclos', card('Últimos ciclos', 'um ciclo = farmar até matar o chefe',
      tabela(['#', 'hora', 'região / chefe', 'mob ouro/min', 'mob xp/min', 'mob poções/min', 'chefe ouro/abate', 'chefe xp/abate', 'tempo do chefe'],
        ciclos.map((c2, i) => {
          const mm = (c2.mobFase && c2.mobFase.perMin) || {};
          const pk = porAbate(c2.bossFase);
          const fim = c2.fim === 'chefe' ? ' ✅' : c2.fim === 'viagem' ? ' ↩' : c2.fim === 'morte' ? ' 💀' : (c2.incompleto ? ' ⚠' : '');
          return '<tr><td>' + (i + 1) + '</td><td>' + hora(c2.endedAt || c2.startedAt) + '</td><td>' + esc(limparNivel(c2.region)) + (c2.boss ? ' / ' + esc(limparNivel(c2.boss)) : '') + fim
            + '</td><td>' + fmt(mm.gold) + '</td><td>' + fmt(mm.xp) + '</td><td>' + potTxt(c2.mobFase, mm.potions) + '</td>'
            + '<td>' + (c2.boss ? (pk ? fmt(pk.gold) : '—') : '—') + '</td><td>' + (c2.boss ? (pk ? fmt(pk.xp) : '—') : '—')
            + '</td><td>' + (c2.bossDurMs ? fmtDur(c2.bossDurMs) : '—') + '</td></tr>';
        }), 'sem ciclos registados')
      + '<p class="hint">Nas colunas do <b>chefe</b> o número é <b>por abate</b> (loot ÷ abates), não por minuto: comparar chefes pela taxa da janela premia quem morre rápido. '
      + 'Nas colunas de <b>mobs</b> a taxa é <b>por minuto</b>, que é o que faz sentido com muitos abates.</p>'
      + '<p class="hint">Poções aparece como <b>—</b> quando a fase teve abates e nenhuma poção foi usada: 0/min não é medição de combate — é o motor sem agir (modo observação) ou sem precisar de poção.</p>'));
  }


  // ------------------------------------- FARM: DUAS MODALIDADES (aba Ganhos)
  // Duas modalidades de farm:
  //   (a) SOZINHO  — o motor escolhe a região.
  //   (b) POR ITEM — o usuário marca itens e o motor diz onde cada um dropa. A resposta vem da
  //       função `planejar(ids)` do motor (automation.js:1537), que devolve por item e por zona:
  //       { item, nome, zona, zonaNome, faixa, mobs, chefe, chance, sobreviveMob, chefeFatal,
  //         dropsH }. A GUI só desenha essa resposta — nenhum número é inventado aqui.
  const RAR_NOME = { lendario: 'Lendários', epico: 'Épicos', basico: 'Básicos (peças)' };
  const ORDEM_RAR = ['lendario', 'epico', 'basico'];
  /** Rótulo do ESPAÇO do item. Os valores são os do jogo (motor.js: `NOME_ESPACO`:
   *  arma, armadura, cabeca, mao, botas, acessorio). */
  const ESPACO_NOME = { arma: 'Arma', armadura: 'Armadura', cabeca: 'Cabeça', mao: 'Mão esquerda', botas: 'Botas', acessorio: 'Acessório' };
  const ORDEM_ESPACO = ['arma', 'armadura', 'cabeca', 'mao', 'botas', 'acessorio'];
  const espacoDeItem = (i) => (i && ESPACO_NOME[i.espaco] ? i.espaco : 'outros');
  const espacoNome = (k) => ESPACO_NOME[k] || 'Outros';
  /** Modalidade de farm escolhida (preferência da GUI, não do motor). */
  const farmModo = () => (guiPrefs.farmModo === 'item' ? 'item' : 'sozinho');
  /** Grava uma preferência da GUI (GUI_KEY) e mantém o espelho local em sincronia. */
  function salvarPrefs(patch) {
    guiPrefs = Object.assign({ bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false }, guiPrefs, patch);
    try { chrome.storage.local.set({ [GUI_KEY]: guiPrefs }); } catch (e) { /* sem storage */ }
  }
  const metaItens = () => (ler('getMeta', {}) || {}).itens || [];
  /** Mapa de drops do motor (`getMeta().ondeItem`: id -> zonas). `null` = o motor ainda não leu o
   *  catálogo; nesse caso NÃO se pode dizer "não dropa em lugar nenhum", só que ainda não se sabe. */
  const ondeItemMapa = () => { const m = ler('getMeta', {}); return m && m.ondeItem && typeof m.ondeItem === 'object' ? m.ondeItem : null; };
  /** Plano de drop dos itens escolhidos, do MOTOR (`planejar`). Cache de 15 s por assinatura da
   *  escolha: `planejar` chama `agregar()` por dentro (percorre o histórico de ciclos), então não
   *  pode ser chamado a cada desenho. Devolve `null` quando o motor não respondeu — que NÃO é o
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
   *  drops/hora) vem marcada. Itens que o motor não devolve no plano são ditos por palavras —
   *  `planejar` os pula (`if (!o) continue`) e sem isto eles sumiriam sem explicação. */
  function renderPlanoItens() {
    const ids = Array.from(selItens);
    if (!ids.length) {
      setHtml('ap-plan-out', '<p class="vazio">Nenhum item escolhido ainda — o plano aparece aqui assim que você marcar.</p>');
      return;
    }
    const plano = planoItens();
    if (plano === null) {
      setHtml('ap-plan-out', '<p class="aviso err">O motor não respondeu ao plano de drop (' + esc(erroLegivel(planoItensCache.erro, 'planejar')) + '). Nada foi inventado.</p>');
      return;
    }
    if (!plano.length) {
      const oi = ondeItemMapa();
      setHtml('ap-plan-out', '<p class="aviso warn">' + (oi
        ? 'O motor não conhece nenhuma zona que drope estes itens.'
        : 'O motor ainda não leu o catálogo do jogo (o mapa de drops está vazio) — recarregue a página com F5.') + '</p>');
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
          + '<td>' + (x.faixa ? esc(String(x.faixa[0]) + '–' + String(x.faixa[1])) : '—') + '</td>'
          + '<td>' + (x.chance ? (x.chance * 100).toFixed(4) + '%' : '—') + '</td>'
          + '<td>' + (x.dropsH == null ? '—' : fmt1(x.dropsH)) + '</td>'
          + '<td>' + (x.sobreviveMob === false ? '💀 morre' : x.sobreviveMob === true ? '✔ ok' : '—') + '</td>'
          + '<td>' + (x.chefeFatal === true ? '💀 mata você' : x.chefeFatal === false ? '✔ ok' : '—') + '</td>'
          + '</tr>');
      });
    }
    const viaveis = plano.filter((x) => x.chefeFatal !== true);
    const alvo = (viaveis.length ? viaveis : plano).slice().sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0))[0] || null;
    setHtml('ap-plan-out',
      tabela(['item', 'onde dropa', 'faixa', 'chance por abate', 'drops/hora', 'mobs', 'chefe'], linhas, 'sem dados de drop')
      + (semZona.length
        ? '<p class="aviso warn"><b>' + semZona.length + '</b> item(ns) escolhido(s) <b>não dropam em zona nenhuma</b> (o motor não os tem no mapa de drops): '
          + semZona.map((b) => esc(nomeItem(b))).join(', ') + '.</p>'
        : '')
      + (alvo
        ? '<p class="aviso ok">Melhor destino para a sua escolha: <b>' + esc(limparNivel(alvo.zonaNome || alvo.zona)) + '</b>'
          + (alvo.dropsH != null ? ' · ' + fmt1(alvo.dropsH) + ' drops/hora de ' + esc(alvo.nome) : '')
          + (alvo.chefeFatal === true ? ' · ⚠ o chefe dessa zona mata você (o motor fica só nos mobs)' : '') + '.</p>'
        : '')
      + '<p class="hint">A primeira linha de cada item é a melhor zona dele. <b>Chance por abate</b> e <b>drops/hora</b> são contas do motor (catálogo do jogo × abates medidos na região); "—" = o motor não tem esse número.</p>');
  }
  /** Chips dos itens escolhidos (com o × para tirar). Vive no cartão do auto farm pra item. */
  function renderChips() {
    setHtml('ap-fm-chips', Array.from(selItens).map((id) => '<span class="chip"><img src="' + ITEM_IMG(id) + '" alt="">' + esc(nomeItem(id))
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
      + kv('região em uso', fixa ? 'FIXA (você escolheu)' : 'automática (o motor escolhe)')
      + kv(fixa ? 'região fixa' : 'o motor escolheu', esc(fixa ? nomeRegiao(fixa) : (rec ? limparNivel(rec.regiao) : '—')))
      + '</div>'
      + (fixa ? '<p class="aviso warn">A região está <b>FIXA</b> em <b>' + esc(nomeRegiao(fixa)) + '</b> (você escolheu). Enquanto for assim, o auto farm sozinho <b>não</b> escolhe a melhor região — volta ao automático no botão abaixo ou na aba Painel.</p>' : '')
      + '<div class="acoes">'
      + acao('ap-fm-auto', '🎯 Voltar a escolher a região sozinho', fixa ? 'Limpa a região fixa: o motor volta a escolher a melhor região para o seu nível.' : 'Já está automática: o motor escolhe a região sozinho.', '', !fixa)
      + '</div>'
      + diag('Forçar viagem (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-fm-go', '▶ Ir agora para a melhor região', 'Liga o auto-play e viaja já para a melhor região para o seu nível. Um clique.')
      + '</div>'
      + '<p class="hint">O motor escolhe a região sozinho e muda quando compensa. Para mudar o objetivo, use a aba <b>Painel</b>.</p>';
    const corpoItem = '<p class="hint">Marque abaixo os itens que você quer dropar: o motor diz em que região cada um cai, com a chance e os drops/hora, e leva você até lá.</p>';
    const minModo = guiPrefs.fmModoMin === true;
    setHtml('ap-fm-modo', cardMin(null, 'Como você quer farmar', 'duas modalidades — escolha uma',
      '<div class="modos">'
      + '<button class="modo' + (modo === 'sozinho' ? ' ativa' : '') + '" id="ap-fm-modo-sozinho"><b>🤖 Auto farm sozinho</b><small>o motor escolhe a região, muda quando compensa e não pergunta nada</small></button>'
      + '<button class="modo' + (modo === 'item' ? ' ativa' : '') + '" id="ap-fm-modo-item"><b>🎯 Auto farm pra item</b><small>você escolhe os itens que quer dropar e o motor vai à região que os dropa</small></button>'
      + '</div>'
      + (modo === 'item' ? corpoItem : corpoSozinho), minModo, 'ap-fm-min-modo', !minModo));
  }
  /** O cartão do "auto farm pra item": escolha, plano de drop e o botão que executa. */
  function renderFarmItens() {
    if (farmModo() !== 'item') { setHtml('ap-fm-itens', ''); return; }
    const n = selItens.size;
    const total = metaItens().length;
    const minItens = guiPrefs.fmItensMin === true;
    setHtml('ap-fm-itens', cardMin(null, 'Auto farm pra item — o que quero dropar', n ? n + ' item(ns) escolhido(s)' : 'nenhum item escolhido',
      '<div class="chips" id="ap-fm-chips"></div>'
      + (n ? '' : '<p class="vazio">Nenhum item escolhido ainda.</p>'
        + '<p class="hint">Clique em <b>Escolher itens</b> e marque o que você quer. A lista mostra os itens do jogo agrupados por raridade e por espaço (arma, armadura, cabeça, mão, botas, acessório)'
        + (total ? ' — ' + total + ' itens no catálogo' : '') + '.</p>')
      + '<div class="acoes">'
      + acao('ap-pick', '🔍 Escolher itens (<b id="ap-sel-n">' + n + '</b>)', 'Abre a lista de itens do jogo para você marcar o que quer dropar.')
      + acao('ap-plan-go', '🧭 Farmar estes itens', n ? 'Confirma o destino e leva você até lá: liga o auto-play, fixa a região e viaja.' : 'Escolha primeiro os itens que você quer dropar.', n ? '' : 'sec', !n)
      + acao('ap-plan-limpar', '✖ Limpar escolha', 'Tira todos os itens da escolha (não mexe em nada no jogo).', 'sec', !n)
      + '</div>'
      + '<div id="ap-plan-out"></div>'
      + '<p class="hint">O motor não tem (ainda) um modo "farmar até cair": a região fica <b>fixa</b> e ele continua lá até você mudar — não para sozinho quando o item cai.</p>', minItens, 'ap-fm-min-itens', !minItens));
    renderPlanoItens();
    renderChips();
  }

  // ---------------------------------------------------------------- ABA MERCADO
  let ofertasCache = null, ornnCache = null, compraCache = null;  function renderMercado() {
    // `mercadoSaturado()` devolve { sat, lend, total } — um
    // OBJETO, logo era sempre verdadeiro e o cartão dizia "mercado cheio? sim" mesmo vazio.
    const sat = ler('mercadoSaturado', null);
    const cheio = sat && typeof sat === 'object' ? !!sat.sat : (sat === true);
    const lend = (sat && typeof sat === 'object' && sat.lend != null) ? sat.lend : null;
    // As ofertas que o MOTOR já leu ficam gravadas (OFERTAS_KEY): mostram-se sem pedir nada.
    const ofertas = ofertasCache || (ofertasStore && ofertasStore.ofertas) || ler('minhasOfertas', []) || [];
    const ofAt = (ofertasStore && Number(ofertasStore.at)) || 0;
    setHtml('ap-mk-ofertas', card('As minhas ofertas no mercado', '<span id="ap-mk-quando">—</span>',
      '<div class="kvs">'
      + kv('ofertas', String(ofertas.length))
      + kv('mercado cheio?', sat == null ? '—' : (cheio ? 'sim' : 'não') + (lend == null ? '' : ' <small>' + fmt(lend) + '/10 lendários</small>'))
      + '</div>'
      + (ofertas.length
        ? tabela(['item', 'raridade', 'qualidade', 'preço'], ofertas.map((o) => '<tr><td>' + esc(o.nome || o.base || '?') + '</td><td>' + esc(o.raridade || '—')
          + '</td><td>' + esc(o.qual || '—') + '</td><td>' + fmt(o.preco) + '</td></tr>'))
        : '<p class="vazio">Ainda não há leitura das suas ofertas.</p>'
          + '<p class="hint">O motor lê-as quando passa pelo mercado e grava a lista — a partir daí aparece aqui, sem precisar clicar em nada. O botão abaixo força uma leitura nova.</p>')
      + diag('Mercado: leitura e ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-mk-ler', '📖 Forçar leitura das minhas ofertas', 'Abre o mercado, lê a aba "Minhas ofertas", grava e fecha. Não muda nada.')
      + acaoD('ap-mk-anunciar', '🏪 Anunciar lendários abaixo de A', 'Põe à venda os lendários abaixo de tier A a 90% do preço mais baixo. Nunca Rabadon nem tier A+.')
      + '</div>'));
    const q = $('ap-mk-quando');
    if (q) q.textContent = ofAt ? 'lidas há ' + fmtDur(Date.now() - ofAt) + ' · às ' + hora(ofAt) : (ofertas.length ? 'lidas nesta sessão' : 'sem leitura');

    setHtml('ap-mk-plano', card('Reajuste de preços', 'baixa o preço do que está caro em relação ao mercado',
      '<div id="ap-mk-plano-out"></div>'
      + diag('Reajuste de preços: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-mkt-plan', '🔍 Calcular reajuste', 'Compara cada oferta sua com o menor preço do mercado para o mesmo item e qualidade.')
      + acaoD('ap-mkt-go', '💱 Aplicar reajuste', 'Cancela e reanuncia cada oferta no preço calculado (90% do menor).')
      + '</div>'));

    setHtml('ap-mk-ornn', card('Bancada do Ornn', 'montar itens com peças é uma APOSTA',
      '<div id="ap-mk-ornn-out"></div>'
      + diag('Bancada do Ornn: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-ornn-ler', '📜 Forçar leitura das receitas do Ornn', 'Fala com o Ornn na Fonte e lista tudo o que ele pode montar, com o custo e as peças que você tem.')
      + acaoD('ap-mk-montar', '🔨 Montar a melhor receita', 'Escolhe a receita mais barata que serve a sua build e tenta montar. Gasta ouro por tentativa.')
      + '</div>'
      + '<p class="hint">Cada tentativa custa ouro e tem ~1,2% de chance (2,4% com a Runa Arcana). As peças só são consumidas quando dá certo.</p>'));

    setHtml('ap-mk-compra', card('Vale a pena comprar agora?', 'decisão do motor com base no seu ouro',
      '<div id="ap-mk-compra-out">' + (compraCache ? esc(compraCache.texto || '') : '<p class="vazio">Ainda não calculei. Use o botão abaixo.</p>') + '</div>'
      + diag('Compra: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-melhor-compra', '🤔 Calcular melhor compra', 'Compara comprar o item ideal, comprar um substituto mais barato, ou esperar.')
      + acaoD('ap-mk-comprar', '🛒 Comprar o ideal no mercado', 'Compra o que falta da build ideal pelo menor preço, sem zerar o ouro.')
      + '</div>'));

    // ---- WATCH DO MERCADO (pedido do dono, 2026-10-18): itens e nomes de jogador -----------
    const w = ler('mercadoWatchEstado', null) || {};
    const wItens = (w.itens || []).join(', ');
    const wVend = (w.vendedores || []).join(', ');
    const wPreco = w.precoMax == null ? 0 : Number(w.precoMax);
    const wTeto = w.tetoCompra == null ? 500000 : Number(w.tetoCompra);
    const wCad = Math.max(2, Math.round((Number(w.cadenciaMs) || 5000) / 1000));
    const wAch = (w.achados || []);
    const wOut = !w.at ? '<p class="vazio">Ainda não vigiou. O motor vigia sozinho a cada ' + wCad + ' s; o botão abaixo força agora.</p>'
      : wAch.length
        ? tabela(['id', 'vendedor', 'item', 'preço'], wAch.map((o) => '<tr><td>' + esc(o.id) + '</td><td>' + esc(o.vendedor || '?') + '</td><td>' + esc(o.item || '?')
          + '</td><td>' + fmt(o.preco) + (o.moeda && o.moeda !== 'ouro' ? ' ' + esc(o.moeda) : '') + '</td></tr>'))
        : '<p class="vazio">A última vigia (há ' + fmtDur(Date.now() - w.at) + ') não achou nada que casasse.</p>';
    const wUlt = w.ultimaCompra;
    setHtml('ap-mk-watch', card('Watch do mercado — itens e jogadores', 'deteta em tempo real e compra sozinho',
      '<p class="hint">Vigia o mercado dos jogadores pelo SERVIDOR (todas as ofertas, com vendedor) e, quando algo casa, compra pelo próprio mercado do jogo. <b>Só gasta ouro</b> (nunca Gemas/diamantes) e nunca abaixo da reserva de poções. Para comprar sozinho tem de estar no <b>Mercador</b> (base) — a deteção corre em qualquer sítio.</p>'
      + tg('ap-watch-ligado', 'Ligar a vigia', 'A deteção corre sempre que há itens ou jogadores na lista; desligar isto para tudo.', !!w.ligado)
      + '<label class="campo">Itens (id-base, id completo ou nome — separados por vírgula)<input id="ap-watch-itens" type="text" autocomplete="off" spellcheck="false" value="' + esc(wItens) + '" placeholder="3031, Gume do Infinito, 3071+2~S"></label>'
      + '<label class="campo">Jogadores (nomes, separados por vírgula)<input id="ap-watch-vendedores" type="text" autocomplete="off" spellcheck="false" value="' + esc(wVend) + '" placeholder="srdog"></label>'
      + '<label class="campo">Preço máximo por oferta em ouro (0 = sem tecto próprio)<input id="ap-watch-preco" type="number" min="0" step="1" value="' + wPreco + '"></label>'
      + '<label class="campo">Tecto de gasto por passagem em ouro (0 = sem tecto)<input id="ap-watch-teto" type="number" min="0" step="1" value="' + wTeto + '"></label>'
      + '<label class="campo">Cadência da vigia em segundos (mínimo 2)<input id="ap-watch-cad" type="number" min="2" max="120" step="1" value="' + wCad + '"></label>'
      + '<div id="ap-watch-out">' + wOut
        + (wUlt ? '<p class="hint">Última compra: ' + (wUlt.ok ? 'COMPROU ' + esc(wUlt.vendedor || '') + ' por ' + fmt(wUlt.preco) + ' ouro' : 'falhou — ' + esc(wUlt.motivo || '?')) + '.</p>' : '')
      + '</div>'
      + diag('Watch do mercado: ações manuais (manutenção manual)')
      + '<div class="acoes">'
      + acaoD('ap-watch-agora', '👁 Vigiar agora', 'Lê o mercado do servidor neste instante, mostra o que casa e (no Mercador) compra.')
      + '</div>'));
  }

  // ---------------------------------------------------------------- ABA HISTÓRICO
  function renderHist() {
    const f = farm();
    const mortes = (f.deaths || []).slice(0, 12);
    setHtml('ap-hi-mortes', card('Mortes', 'quem matou você e o que você perdeu',
      mortes.length
        ? '<div class="lista">' + mortes.map((m) => '<div class="ln loj"><time>' + hora(m.at) + '</time><b>💀 ' + esc(m.by || '?') + '</b>'
          + '<span class="d">em ' + esc(limparNivel(m.region || '?')) + ' · perdeu ' + fmt(m.xpLost) + ' XP'
          + (m.recursos ? ' · ouro ' + fmt(m.recursos.ouro) + ' · nível ' + esc(m.recursos.nivel) + ' · poções ' + esc(m.recursos.pocoes ? ORDER.map((k) => POCAO_NOME[k] + ' ' + fmt(m.recursos.pocoes[k])).join('/') : '—') : '') + '</span></div>').join('') + '</div>'
        : '<p class="vazio">Sem mortes registadas. (Só conta morte de verdade — o motor filtra avisos de NPC.)</p>'));

    const lutas = (f.lutas || []).filter((l) => l.est && l.potUsadas != null).slice(0, 20);
    setHtml('ap-hi-lutas', card('Lutas de chefe — previsto vs. real', 'valida se a previsão de poções está certa',
      lutas.length
        ? tabela(['hora', 'chefe', 'resultado', 'poções previstas', 'poções usadas', 'erro', 'tempo previsto', 'tempo real', 'seu dano/s', 'dano recebido/s'],
          lutas.map((l) => {
            const e = l.est || {};
            const erro = (l.potUsadas != null && e.potTotal != null) ? (l.potUsadas - e.potTotal) : null;
            const mau = erro != null && Math.abs(erro) > Math.max(2, (e.potTotal || 0) * 0.5);
            return '<tr><td>' + hora(l.at) + '</td><td>' + esc(limparNivel(l.boss || '?')) + '</td><td>' + (l.mortes ? '💀 você morreu' : '✅ você ganhou')
              + '</td><td>' + (e.potTotal == null ? '—' : e.potTotal) + '</td><td>' + (l.potUsadas == null ? '—' : l.potUsadas) + '</td><td class="' + (mau ? 'pend' : '') + '">' + (erro == null ? '—' : (erro > 0 ? '+' : '') + erro)
              + '</td><td>' + (e.tKillS == null ? '—' : e.tKillS + 's') + '</td><td>' + (l.durS == null ? '—' : l.durS + 's')
              + '</td><td>' + ((l.analise && l.analise.outDps) || '—') + '</td><td>' + ((l.analise && l.analise.inDps) || '—') + '</td></tr>';
          }), 'sem lutas registadas')
        : '<p class="vazio">Ainda não há lutas de chefe registadas com poções. Precisa de matar um chefe com o auto-play ligado.</p>'));

    const log = (f.log || []).slice(0, 60);
    setHtml('ap-hi-eventos', card('Últimos acontecimentos', 'o que o motor fez, por ordem',
      log.length
        ? '<div class="lista">' + log.map((e) => {
          const resto = Object.keys(e).filter((k) => k !== 'at' && k !== 'type' && k !== 'estado' && k !== 'hist' && k !== 'recursos' && k !== 'previa' && k !== 'setup' && k !== 'build')
            .slice(0, 5).map((k) => k + ': ' + JSON.stringify(e[k])).join(' · ');
          return '<div class="ln"><time>' + hora(e.at) + '</time><b>' + esc(EVENTO_NOME[e.type] || e.type) + '</b><span class="d">' + esc(String(resto).slice(0, 200)) + '</span></div>';
        }).join('') + '</div>'
        : '<p class="vazio">sem eventos ainda</p>'));

    const iss = (f.issues || []).slice(0, 20);
    setHtml('ap-hi-problemas', card('Problemas detectados', 'erros que o motor apanhou sozinho',
      iss.length
        ? '<div class="lista">' + iss.map((e) => '<div class="ln loj"><time>' + hora(e.at) + '</time><b>' + esc(e.type || '') + '</b><span class="d">'
          + esc(typeof e === 'string' ? e : Object.keys(e).filter((k) => k !== 'at' && k !== 'type').map((k) => k + ': ' + String(e[k])).join(' · ')).slice(0, 200) + '</span></div>').join('') + '</div>'
        : '<p class="aviso ok">Nenhum problema detectado.</p>'
        + '<p class="hint">Aqui aparecem falhas do motor (um passo da base que deu erro, um selector que mudou no jogo, etc.).</p>'));
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
      ['Auto-play', 'O motor que joga por você: escolhe a região, luta, usa poções, volta à base e organiza o inventário.'],
      ['Auto-poção', 'Só a parte das poções: usa a mais fraca que chega para você sobreviver, em vez de gastar sempre a Suprema.'],
      ['Switch pai (hierarquia)', 'Os switches estão em ÁRVORE: o auto-play é o mestre e cada um depende de outro. Desligar um pai fecha tudo o que está por baixo dele — a aba Painel mostra quem manda em quem, indentado.'],
      ['Skippado (exceção)', 'O switch está ligado mas o motor não age naquele sítio. Exemplo: no mapa de Runeterra o motor não vende nem mexe no cofre; fora do campeão alvo o auto-play inteiro não age.'],
      ['Mob', 'Monstro comum do mapa.'],
      ['Chefe', 'Monstro forte da região; ao ser derrotado fecha o ciclo.'],
      ['Ciclo', 'Uma passagem completa: farmar mobs na região até matar o chefe.'],
      ['Região ideal', 'A que dá mais ganho para o seu nível, considerando se sobrevives ao chefe.'],
      ['Build ideal', 'Os 5 melhores itens para o seu campeão, calculados pelo motor a partir dos stats e das passivas.'],
      ['Qualidade (C, B, A, S, SS)', 'Quanto melhor o item é. C é o mais fraco, SS o melhor. A partir de A o motor não vende nem desmancha.'],
      ['Refino (+1, +2, +3)', 'Melhoria no Ornn que aumenta os stats do item. Acima de +2 pode descer se falhar.'],
      ['Tier / "abaixo de A"', 'Qualidade inferior a A — são estes os itens que o motor vende ou anuncia.'],
      ['Blindado / protegido', 'Item que o motor NUNCA vende: Rabadon, os lendários da sua build ideal e o que está equipado em S/SS.'],
      ['Espólio', 'Material que cai dos monstros e que se vende ou se usa em receitas.'],
      ['Cofre', 'Arca da Tesoureira (Fonte) ou do Burrinho (cidade) para guardar itens sem gastar espaço na mochila. Só abre nesses sítios — mas o painel mostra sempre a última leitura que o motor gravou, mesmo que estejas farmando longe.'],
      ['Mercado', 'Venda a outros jogadores. O motor anuncia a 90% do preço mais baixo.'],
      ['Ornn', 'NPC que monta itens a partir de peças. É uma aposta: ~1,2% por tentativa.'],
      ['Poção Suprema / Forte / Normal', 'As três poções de vida: curam 2200, 900 e 300.'],
      ['DPS', 'Dano por segundo.'],
      ['Calibrar', 'Corrigir as previsões do motor comparando com o que realmente aconteceu.'],
      ['Previsão teórica vs. medida', 'Teórica = calculada com fórmulas. Medida = o que o jogo realmente deu. A medida manda.'],
      ['Giro', 'Testar várias regiões seguidas, alguns minutos em cada, para medir ganhos reais.'],
      ['Pausado x Desligado', 'Pausar congela as ações e continua medindo: Retomar volta do mesmo ponto. Desligar (ou Parar tudo) limpa o estado ativo — prazos, testes, farm forçado — e ao religar o motor começa do zero.'],
      ['Switch mestre x capacidade', 'O switch Tudo (auto-play) faz o motor jogar. As capacidades (vender, equipar, cofre, rotação…) são switches independentes: ligar uma não liga o mestre, e com o mestre desligado elas ficam inertes (ligadas, sem agir).'],
    ];
    const corpo = $('ap-aj-corpo');
    if (!corpo) return;
    corpo.innerHTML = ''
      + '<h4>Como usar (3 passos)</h4>'
      + '<p>1. Passe o mouse sobre o <b>seu nome</b> no canto superior direito do jogo (ou aperte <b>F8</b>, ou o botão <b>⚙ Auto-play</b>).</p>'
      + '<p>2. Ligue o switch <b>Tudo (auto-play)</b> no topo. O motor começa a farmar sozinho; os switches de baixo dizem o que ele pode fazer, cada um por si.</p>'
      + '<p>3. Se algo parecer estranho, abra a aba <b>Painel</b>: está lá escrito, em português, o que o motor está fazendo e o que está travando.</p>'
      + '<h4>Ordem do auto-play (o ciclo)</h4>'
      + macro.map((m) => '<div class="macro"><b>' + m[0] + '</b> <span class="muted">· ' + m[1] + '</span><br>' + m[2] + '<br><span class="muted">quando: ' + m[3] + '</span></div>').join('')
      + '<p>O passo <b>7</b> volta ao <b>1</b>: é um ciclo. Nenhum passo existe sozinho.</p>'
      + '<h4>Glossário — o que querem dizer as palavras</h4>'
      + '<dl>' + glossario.map((g) => '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>').join('') + '</dl>'
      + '<h4>O que a GUI é (e o que não é)</h4>'
      + '<p>Esta janela é para <b>coisas automáticas</b>: o que está acontecendo, o que o motor vai fazer, o que está bloqueado e os <b>switches</b> que ligam e desligam cada capacidade. O que você mesmo faz no jogo com um clique (vender, curar, comprar, subir habilidade) fica no fim do Painel, em <b>Manutenção manual</b> — serve para forçar ou medir, não é o caminho normal.</p>'
      + '<h4>Botões de segurança</h4>'
      + '<p><b>O botão grande</b> (topo) faz sempre o próximo passo a partir do estado de agora: <b>▶ Ligar auto-play</b> (observação → ligado), <b>⏸ Desligar</b> (ligado → observação), <b>▶ Retomar</b> (pausado → ligado) ou <b>▶ Religar</b> (desligado → ligado). O rótulo diz o que vai mudar.</p>'
      + '<p><b>⏸ Pausar</b> congela as ações e continua medindo; <b>⛔ Parar tudo</b> limpa o estado ativo e fica gravado no navegador até você religar.</p>'
      + '<p><b>📌</b> fixa o painel aberto (sem isso ele fecha 2,5 s depois de tirar o mouse). <b>Esc</b> fecha.</p>';
  }

  // ---------------------------------------------------------------- DISPATCH DE REDESENHO
  function renderTudo() {
    // O render NÃO depende de o painel estar aberto: ele corre no arranque e nos segundos
    // seguintes (ver o arranque). Um portão de cadência aqui deixaria os blocos no placeholder
    // inicial até alguém abrir o painel. O gate de cadência vive só no `tick()` (que continua
    // a não fazer nada com o painel fechado).
    renderCabecalho();
    if (tabAtiva === 'painel') renderPainel();
    else if (tabAtiva === 'itens') { renderBuildFase(); renderItens(); renderMercado(); }
    else if (tabAtiva === 'personagem') { renderSkills(); renderAtrib(); }
    else if (tabAtiva === 'ganhos') { renderFarm(); renderFarmModo(); renderFarmItens(); renderHist(); }
  }
  /** A aba 1 é um PAINEL DE CONTROLE: junta o "agora" (o que está acontecendo) com os switches.
   *  São dois desenhadores que escrevem em ids diferentes — juntam-se aqui em vez de reescrever
   *  código que já funciona. O bloco grande da build por fase NÃO entra: ele vive na aba Itens
   *  e aqui fica só o resumo de uma linha (renderBuildResumo). */
  function renderPainel() { renderPainelEstado(); renderAgora(); renderAuto(); renderBuildResumo(); }
  // Cadência por aba: a do Painel acompanha o HUD (o content.js publica a vida a cada 1 s e
  // `estadoAgora()` tem cache de 2 s; o resto do painel lê caches de 10 s/15 s do motor). As abas
  // de relatório são mais lentas porque recalculam listas grandes.
  const CADENCIA = { painel: 1500, itens: 8000, personagem: 3000, ganhos: 8000 };
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
    if (!r.ok) salvarTopo({ enabled: !!on });     // motor ausente: escreve na mesma (o motor lê do storage)
    cacheAgora = { at: 0, v: null };
    renderCabecalho();
    renderPainelEstado();                        // o estado mudou: o cartão de controle sabe já
    if (tabAtiva === 'painel') renderArvore();   // o mestre é a RAIZ da árvore: ela muda com ele
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

  /** Liga/desliga UM switch da ÁRVORE. Escreve SEMPRE pelo motor (`setConfig`), com a chave
   *  que o próprio motor declarou (`cfg`) — a GUI não conhece nem inventa chaves de configuração. */
  function alternarInterruptor(nome, chave, ligado) {
    const legivel = ARV_NOME[nome] || nome;
    if (!chave) { fbAviso(legivel + ' é implícito: liga e desliga com o switch pai.'); return; }
    const patch = {}; patch[chave] = !!ligado;
    const r = chamar('setConfig', patch);
    if (!r.ok) {
      // Nada foi escrito no motor: obriga a redesenhar para o clique NÃO ficar "preso" na tela
      // (o setHtml não volta escrevendo um HTML igual, e o checkbox ficaria mentiroso).
      _ultimoHtml.delete('ap-auto-arvore');
      renderArvore();
      fbErro(legivel + ': ' + erroLegivel(r.erro, 'setConfig') + ' — nada foi mudado.');
      return;
    }
    cacheAgora = { at: 0, v: null };
    cacheLimpar();
    ultimoRender = 0;
    renderCabecalho();
    renderArvore();
    fb(ligado ? 'ok' : 'info', legivel + ': ' + (ligado ? 'LIGADO.' : 'DESLIGADO — o que está por baixo dele deixa de agir.'));
  }

  /** LIGAR (de OBSERVAÇÃO para LIGADO). Não mexe nas capacidades: o que estava desligado nelas
   *  continua desligado — o mestre não liga nem desliga os filhos. */
  async function ligarAuto(btn) {
    await executar(btn, 'Ligar auto-play', async () => {
      if (estaDesligado()) chamar('religarTudo');
      definirLigado(true);
      return { ok: true, msg: 'LIGADO — farma, viaja e decide sozinho. As capacidades que você desligou continuam desligadas.' };
    });
  }
  /** DESLIGAR (de LIGADO para OBSERVAÇÃO): para as ações e LIMPA o estado ativo. */
  async function desligarAuto(btn) {
    await executar(btn, 'Desligar', async () => {
      definirLigado(false);
      chamar('limparEstadoAtivo');          // prazos, throttles, farm forçado, backoff, testes
      return { ok: true, msg: 'OBSERVAÇÃO — o motor só lê o jogo. O estado ativo foi limpo: ao religar, começa do zero.' };
    });
  }
  /** PAUSAR (só com o auto-play LIGADO): congela as ações e continua medindo. */
  async function pausarAuto(btn) {
    await executar(btn, 'Pausar', async () => {
      const r = chamar('pausar');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'pausar') };
      return { ok: true, msg: 'PAUSADO — parou de agir, mas continua medindo. Retomar devolve tudo do mesmo ponto.' };
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
  /** PARAR TUDO (kill): para tudo, limpa o estado ativo e PERSISTE — sobrevive ao F5. */
  async function pararTudo(btn) {
    await executar(btn, 'Parar tudo', async () => {
      definirLigado(false);
      chamar('desligarTudo', 'gui');
      return { ok: true, msg: 'DESLIGADO de vez e gravado no navegador: nem com F5 o motor volta sozinho. Use ▶ Religar.' };
    });
  }
  /** RELIGAR (de DESLIGADO para LIGADO). */
  async function religarAuto(btn) {
    await executar(btn, 'Religar', async () => {
      const r = chamar('religarTudo');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'religarTudo') };
      definirLigado(true);
      return { ok: true, msg: 'RELIGADO — o motor volta a agir (o estado ativo foi limpo quando você parou tudo).' };
    });
  }
  /** "Retomar tudo": usado pelo aviso "porque nada está acontecendo" — religa, liga e despausa. */
  async function retomarTudo(btn) {
    await executar(btn, 'Retomar tudo', async () => {
      if (estaDesligado()) chamar('religarTudo');
      definirLigado(true);
      const r = chamar('despausar');
      return { ok: true, msg: 'LIGADO de novo.' + diffTexto(r.ok && r.v && r.v.diff) };
    });
  }
  /** O que mudou no jogo enquanto o motor esteve parado (o motor devolve `diff` no `despausar`). */
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
      const reg = ler('regiaoIdeal', null);
      if (!reg) return { ok: false, motivo: 'o motor não encontrou nenhuma região boa para o seu nível (catálogo ainda carregando?)' };
      chamar('viajarPara', reg);
      return { ok: true, msg: 'ligado e viajando para ' + nomeRegiao(reg) + '.' };
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
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'o motor recusou' };
      const passos = (v.ordem || []).join(' → ') || 'nada fazendo';
      return { ok: true, msg: 'passos executados: ' + passos };
    }, { confirma: { titulo: 'Rotina de base completa', linhas: linhas, ok: 'Executar agora', perigo: false } });
  }
  const acaoSimples = (rotulo, nome, msg, conf) => async (btn) => {
    await executar(btn, rotulo, async () => resMotor(await chamarA(nome), nome, msg), conf ? { confirma: conf } : undefined);
  };

  // ---- mochila ---------------------------------------------------------------
  /** Lê a mochila. `auto` = leitura passiva (o motor lê o DOM sem abrir a bolsa): nesse caso o
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
      // aparecer sozinha no cartão). Sem essa função (motor antigo), lê-se só para memória.
      let r = await chamarA('salvarOfertas');
      if (!r.ok && r.erro === 'sem-funcao') r = await chamarA('lerMinhasOfertas');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'salvarOfertas') };
      if (r.v == null) return { ok: false, motivo: 'o mercado não abriu — as ofertas só se lêem com o mercado acessível.' };
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
        : '<p class="aviso ok">Nenhum reajuste necessário — os seus preços já são competitivos.</p>');
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
          ornnCache.map((x) => '<tr><td>' + esc(x.nome || x.id) + '</td><td>' + esc(x.chance || '—') + '</td><td>' + (x.tentativasMedias || '—')
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
        : (v.ok === false ? esc(v.motivo || 'o motor não conseguiu ler o mercado') : 'Nada decidindo.');
      compraCache = { texto: txt };
      setHtml('ap-mk-compra-out', '<p class="aviso ok">' + txt + '</p>'
        + (dec.length ? tabela(['item', 'preço no mercado', 'o que fazer', 'espera'],
          dec.map((x) => '<tr><td>' + esc(x.item || x.id) + '</td><td>' + (x.ofertaIdeal ? fmt(x.ofertaIdeal.menor) : 'sem oferta')
            + '</td><td>' + esc(x.acao || '—') + '</td><td>' + (x.esperaMin == null ? '—' : x.esperaMin + ' min') + '</td></tr>')) : '')
        + '<p class="hint">O motor compara comprar já, comprar um substituto mais barato, ou continuar farmando. O ouro/min usado é o que você mediu, não um valor inventado.</p>');
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
      // O cofre mudou: regrava o que está lá agora — SÓ com o cofre ainda aberto, para uma
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
      // O motor já tem o fluxo completo (abre -> lê -> GRAVA -> fecha): usa-se esse, para a
      // leitura ficar gravada e o cartão continuar a mostrá-la depois de sair da base.
      let r = await chamarA('lerCofreBase');
      if (!r.ok && r.erro === 'sem-funcao') {                 // motor antigo: passo a passo
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
      return { ok: true, msg: n ? n + ' item(ns) no cofre — a lista está no cartão.' : 'o cofre está vazio (nada guardado).' };
    });
  }
  /** Retira do cofre: `alvo` = base do item, ou null para o MELHOR que o motor conhece. */
  async function retirarCofre(btn, alvo) {
    const escolhido = alvo ? { base: alvo, nome: nomeItem(alvo) } : melhorConhecido();
    if (!escolhido) { fbAviso('Ainda não há leitura do cofre — use "Forçar leitura do cofre agora" (manutenção manual) para o motor saber o que lá está.'); return; }
    await executar(btn, 'Retirar do cofre', async () => {
      if (!cofreAberto().length) {                        // o motor só retira com o cofre ABERTO
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
    }, { confirma: { titulo: 'Gastar ' + n + ' ponto(s) de habilidade', linhas: ['O motor desbloqueia primeiro as habilidades que faltam e depois sobe a que dá mais dano.', 'Esta ação não tem como ser desfeita.'], ok: 'Gastar pontos' } });
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
      if (v.ok === false && !v.gastos) return { ok: false, motivo: 'o motor não conseguiu gastar nenhum ponto (o painel de atributos do jogo está aberto?)' };
      return { ok: true, msg: (v.gastos || 0) + ' ponto(s) distribuídos pelo modelo ' + modelo + '.' };
    }, { confirma: { titulo: 'Gastar ' + n + ' ponto(s) de atributo', linhas: ['Modelo escolhido: <b>' + esc(modelo) + '</b>.', 'Os pontos são distribuídos pelo atributo mais atrasado em relação ao peso do modelo.', 'Esta ação não tem como ser desfeita.'], ok: 'Distribuir pontos' } });
  }

  // ---- itens: escolher e planear --------------------------------------------
  const rarDe = (i) => (i && i.raridade) || 'basico';
  /** Itens do catálogo que passam no filtro e na busca. Os BÁSICOS (peças/componentes) também
  /** entram: o catálogo tem 108 itens (19 básicos, 40 épicos, 49 lendários) e qualquer um deles
  /** pode ser escolhido — quem decide é o filtro, não o código. */
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
   *  Marca os itens que NÃO dropam em zona nenhuma (fora do `ondeItem` do motor): sem isso o
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
          const titulo = String(i.nome) + ' — ' + espacoNome(esp) + (sem ? ' · NÃO dropa em zona nenhuma' : '') + (sel ? ' · escolhido' : '');
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
        ? (total + ' itens no catálogo' + (semN == null ? ' · drops ainda não lidos pelo motor' : ' · ' + semN + ' não dropam em zona nenhuma'))
        : 'o motor ainda não leu o catálogo do jogo';
    }
    renderChips();
  }
  /** "Farmar estes itens" (modalidade B): o plano já está à vista (renderPlanoItens); aqui só se
   *  EXECUTA — confirma, liga o auto-play, fixa a região do melhor destino e viaja. */
  async function planearItens(btn) {
    const ids = Array.from(selItens);
    if (!ids.length) { fbAviso('Escolha primeiro os itens que você quer farmar (botão "Escolher itens").'); return; }
    await executar(btn, 'Farmar estes itens', async () => {
      const plano = planoItens();
      if (plano === null) return { ok: false, motivo: erroLegivel(planoItensCache.erro, 'planejar') };
      if (!plano.length) return { ok: false, motivo: 'o motor não sabe onde estes itens dropam (catálogo incompleto?)' };
      const viaveis = plano.filter((x) => x.chefeFatal !== true);
      const alvo = (viaveis.length ? viaveis : plano).slice().sort((a, b) => (b.dropsH || 0) - (a.dropsH || 0))[0];
      if (!alvo) return { ok: false, motivo: 'nenhum destino calculado' };
      const sim = await confirmar('Ir farmar estes itens', [
        'Destino escolhido: <b>' + esc(limparNivel(alvo.zonaNome || alvo.zona)) + '</b> para <b>' + esc(alvo.nome) + '</b>.',
        'Isto liga o auto-play e viaja já para lá.',
        viaveis.length ? '' : '⚠ Nenhuma região é segura para você: o chefe dessa zona mata, e o motor vai ficar só nos mobs.',
      ].filter(Boolean), 'Ligar e viajar');
      if (!sim) { fbAviso('Cancelado — o plano está calculado, mas não viajei.'); return { ok: true, msg: 'plano calculado (não viajei).' }; }
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
      + [0, 1, 2, 3].map((k) => '<select data-set-slot="' + i + ':' + k + '"><option value="">— vazio —</option>'
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
    'ap-pin': (btn) => { fixado = !fixado; btn.classList.toggle('ativo', fixado); fb('info', fixado ? 'Painel FIXO: só fecha com o ✕ ou Esc.' : 'Painel solto: fecha 2,5 s depois de tirares o rato.'); },
    'ap-help': () => { renderAjuda(); const m = $('lolidle-ap-ajuda'); m.hidden = false; m.classList.add('on'); },
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
    }, { confirma: { titulo: 'Testar várias regiões', linhas: ['O motor vai viajar por todas as regiões, medindo ganhos em cada uma.', 'Enquanto isto corre você não vai estar sempre no melhor sítio.'], ok: 'Começar o giro' } }),
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
      if (v.nada) return { ok: true, msg: 'já tinhas poções acima do mínimo — nada comprado.' };
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
    'ap-anunciar': (b) => executar(b, 'Anunciar lendários', async () => {
      const r = await chamarA('anunciarLendarios');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'anunciarLendarios') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'nada anunciado' };
      const an = v.anunciados || [];
      const pulados = an.filter((x) => x.pulado).length;
      return { ok: true, msg: an.length + ' anúncio(s)' + (v.cancelados ? ' · ' + v.cancelados + ' cancelado(s) para abrir vaga' : '') + (pulados ? ' · ' + pulados + ' sem referência de preço' : '') + '.' };
    }, { confirma: { titulo: 'Anunciar lendários abaixo de A', linhas: ['Anuncia a 90% do preço mais baixo do mercado.', 'Rabadon e os lendários tier A ou melhor NUNCA são anunciados.'], ok: 'Anunciar', perigo: true } }),
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
    }, { confirma: { titulo: 'Montar item no Ornn', linhas: ['É uma APOSTA: ~1,2% de chance por tentativa (2,4% com Runa Arcana).', 'O motor usa o lote de tentativas mais próximo do necessário.', 'As peças só são consumidas quando dá certo, mas o ouro é gasto em cada tentativa.'], ok: 'Tentar montar', perigo: true } }),
    'ap-tarefa': (b) => executar(b, 'Aceitar tarefa', async () => {
      const r = await chamarA('aceitarTarefa');
      if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'aceitarTarefa') };
      const v = r.v || {};
      if (v.ok === false) return { ok: false, motivo: v.motivo || 'não deu' };
      return { ok: true, msg: 'tarefa aceite: ' + (v.tipo || '—') + (v.min ? ' · ~' + v.min + ' min' : '') + (v.xp ? ' · ' + fmt(v.xp) + ' xp' : '') + (v.ouro ? ' · ' + fmt(v.ouro) + ' ouro' : '') + (v.item ? ' · item ' + v.item : '') + '.' };
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
      return { ok: true, msg: 'extensão a recarregar — actualiza a página (F5) para os scripts novos entrarem.' };
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
      return { ok: true, msg: v.mudou ? 'barra actualizada com as 4 melhores prontas.' : 'a barra já estava com as melhores disponíveis.' };
    }),
    'ap-trocar-skills': (b) => executar(b, 'Trocar skills em recarga', async () => { const r = await chamarA('trocarSkills', false); if (!r.ok) return { ok: false, motivo: erroLegivel(r.erro, 'trocarSkills') }; return { ok: true, msg: 'troca feita.' }; }),
    'ap-distribuir': (b) => distribuirAtributos(b),
    'ap-pick': () => { renderItemGrade(); const m = $('lolidle-ap-modal'); m.hidden = false; m.classList.add('on'); },
    'ap-plan-go': (b) => planearItens(b),
    'ap-plan-limpar': () => { if (!selItens.size) { fbAviso('Não há nada escolhido para limpar.'); return; } selItens.clear(); mudouEscolha(); fb('ok', 'Escolha limpa — nenhum item marcado.'); },
    // MODALIDADES DE FARM (aba Ganhos): a escolha é uma preferência da GUI (GUI_KEY), não do motor.
    'ap-fm-modo-sozinho': () => {
      // A modalidade "pra item" fixa a região (`regionDefault`). Escolher o modo sozinho LIMPA
      // o fixo, senão os dois modos ficavam misturados (o sozinho usaria a região fixa em vez de
      // `regiaoIdeal()`).
      salvarPrefs({ farmModo: 'sozinho' });
      const tinha = cfg().regionDefault || null;
      if (tinha) { definirCfg({ regionDefault: null }); fb('ok', 'AUTO FARM SOZINHO — a região fixa (' + nomeRegiao(tinha) + ') foi limpa: o motor volta a escolher sozinho.'); }
      else fb('ok', 'Modalidade: AUTO FARM SOZINHO — o motor escolhe a região.');
      ultimoRender = 0; renderFarmModo(); renderFarmItens(); renderAuto();
    },
    // Voltar ao automático a partir da aba Ganhos (sem ter de ir ao Painel).
    'ap-fm-auto': () => {
      if (!cfg().regionDefault) { fbAviso('A região já está automática.'); return; }
      definirCfg({ regionDefault: null });
      ultimoRender = 0; renderFarmModo(); renderFarmItens(); renderAuto();
      fb('ok', 'Região AUTOMÁTICA de novo: o motor escolhe a melhor para o seu nível.');
    },
    'ap-fm-modo-item': () => { salvarPrefs({ farmModo: 'item' }); ultimoRender = 0; renderFarmModo(); renderFarmItens(); fb('ok', 'Modalidade: AUTO FARM PRA ITEM — escolha os itens e o motor leva você à região que os dropa.'); },
    'ap-fm-go': (b) => farmarAgora(b),
    // MINIMIZAR do bloco da build por fase (aba Itens). O estado fica em GUI_KEY e sobrevive ao F5.
    'ap-bf-min': () => {
      const abrir = guiPrefs.bfAberto === false;          // clicar fecha quando está aberta
      salvarPrefs({ bfAberto: abrir });
      _ultimoHtml.delete('ap-build-fase');                // o HTML muda (classe min + seta): força o redesenho
      renderBuildFase();
      fb('info', abrir ? 'Build por fase: aberta.' : 'Build por fase: minimizada — fica só o título.');
    },
    // MINIMIZAR dos cartões de farm (aba Ganhos): o estado vive em GUI_KEY e sobrevive ao F5.
    'ap-fm-min-modo': () => {
      const abrir = guiPrefs.fmModoMin === true;
      salvarPrefs({ fmModoMin: !abrir });
      _ultimoHtml.delete('ap-fm-modo');
      renderFarmModo();
      fb('info', abrir ? 'Como você quer farmar: aberto.' : 'Como você quer farmar: minimizado — fica só o título.');
    },
    'ap-fm-min-itens': () => {
      const abrir = guiPrefs.fmItensMin === true;
      salvarPrefs({ fmItensMin: !abrir });
      _ultimoHtml.delete('ap-fm-itens');
      renderFarmItens();
      fb('info', abrir ? 'Auto farm pra item: aberto.' : 'Auto farm pra item: minimizado — fica só o título.');
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
  };

  function guardarMin(k, valor) {
    const cur = (cfg().minPotion) || { vida: 200, vidaF: 100, vidaS: 30 };
    const novo = Object.assign({}, cur); novo[k] = Math.max(0, Number(valor) || 0);
    definirCfg({ minPotion: novo });
    fb('ok', 'Mínimo de ' + POCAO_NOME[k] + ' para repor: ' + novo[k] + '.');
  }
  function guardarPocao(k, patch) {
    const cur = (config && config.potions) || {};
    const atual = Object.assign({ enabled: true, mode: 'pct', value: k === 'vidaS' ? 60 : k === 'vidaF' ? 43 : 21 }, cur[k] || {});
    const novo = Object.assign({}, cur); novo[k] = Object.assign({}, atual, patch);
    salvarTopo({ potions: novo });
  }

  // WATCH DO MERCADO (2026-10-18): a GUI nao conhece a chave — escreve sempre pelo motor
  // (`setConfig`), e passa o objeto mercadoWatch INTEIRO porque o setConfig faz Object.assign
  // raso (automation.js:8279). Estes dois atalhos leem e fundem o objeto actual.
  const listaWatch = (s) => String(s == null ? '' : s).split(',').map((x) => x.trim()).filter(Boolean);
  const novoWatch = (patch) => Object.assign({}, (cfg() || {}).mercadoWatch || {}, patch);
  const MUDANCAS = {
    'ap-on': (el) => executar(null, el.checked ? 'Ligar' : 'Desligar', async () => { definirLigado(el.checked); return { ok: true, msg: el.checked ? 'auto-play e auto-poção LIGADOS.' : 'auto-play DESLIGADO — o motor só observa.' }; }),
    'ap-obj': (el) => { definirCfg({ objetivo: el.value }); fb('ok', 'Objetivo: ' + ({ xp: 'experiência', ouro: 'ouro', runas: 'runas' }[el.value] || el.value) + '. A região ideal passa a ser escolhida por isto.'); ultimoRender = 0; },
    'ap-reg-modo': (el) => {
      if (el.value === 'auto') { definirCfg({ regionDefault: null }); fb('ok', 'Região AUTOMÁTICA: o motor escolhe sempre a melhor para o seu nível (a região fixa foi limpa).'); }
      else { const sel = $('ap-reg-id'); const id = sel ? sel.value : null; definirCfg({ regionDefault: id }); fb('ok', 'Região FIXA: ' + nomeRegiao(id) + '. O motor fica aqui até você voltar para "Automática".'); }
      ultimoRender = 0;
    },
    // ESCOLHER UMA REGIÃO NA LISTA PASSA A REGIÃO PARA FIXA (com o modo em "Automática" o
    // clique era ignorado e nada mudava). O controle de modo muda no mesmo instante, para nunca
    // haver dois controles a apontar para sítios diferentes.
    'ap-reg-id': (el) => {
      if (!el.value) return;
      definirCfg({ regionDefault: el.value });
      const modo = $('ap-reg-modo'); if (modo && modo.value !== 'fixa') modo.value = 'fixa';
      fb('ok', 'Região FIXA: ' + nomeRegiao(el.value) + '. O motor fica aqui até você escolher "Automática".');
      ultimoRender = 0;
    },
    'ap-cfg-autoEquip': (el) => { definirCfg({ autoEquip: el.checked }); fb('ok', 'Trocar por peça melhor: ' + (el.checked ? 'ligado' : 'desligado') + '.'); },
    'ap-cfg-trocaItens': (el) => { definirCfg({ trocaItens: el.checked }); fb('ok', 'Troca de itens conforme a luta: ' + (el.checked ? 'ligada' : 'desligada') + '.'); },
    'ap-cfg-buildPorFase': (el) => {
      definirCfg({ buildPorFase: !!el.checked });
      cacheLimpar('bf-mobs'); cacheLimpar('bf-chefe');
      fb('ok', el.checked
        ? 'Build por fase LIGADA: em mobs veste a de limpeza, no chefe a de alvo único — e as peças da outra ficam reservadas na mochila.'
        : 'Build por fase DESLIGADA: volta a uma build só e as peças deixam de ser reservadas.');
      ultimoRender = 0;
    },
    'ap-cfg-autoAtrib': (el) => { definirCfg({ autoAtrib: el.checked }); fb('ok', 'Distribuir pontos de atributo automaticamente: ' + (el.checked ? 'ligado' : 'desligado') + '.'); },
    'ap-cfg-autoRefino': (el) => { definirCfg({ autoRefino: el.checked }); fb('ok', 'Refinar no Ornn automaticamente: ' + (el.checked ? 'ligado' : 'desligado') + '.'); },
    'ap-pc-strongest': (el) => { salvarTopo({ mode: el.checked ? 'strongest' : 'bands' }); fb('ok', 'Regra das poções: ' + (el.checked ? 'usa sempre a mais forte disponível' : 'faixas por vida perdida') + '.'); },
    'ap-pc-smart': (el) => { salvarTopo({ smart: !!el.checked }); fb('ok', 'Decisão inteligente: ' + (el.checked ? 'ligada (gasta menos poções)' : 'desligada (usa só as faixas)') + '.'); },
    'ap-min-vida': (el) => guardarMin('vida', el.value),
    'ap-min-vidaF': (el) => guardarMin('vidaF', el.value),
    'ap-min-vidaS': (el) => guardarMin('vidaS', el.value),
    'ap-at-modelo-sel': (el) => { definirCfg({ modeloAtrib: el.value }); fb('ok', 'Modelo de atributos: ' + el.value + '.'); },
    // ---- WATCH DO MERCADO (2026-10-18): itens, jogadores, tectos e cadencia ----
    'ap-watch-ligado': (el) => { definirCfg({ autoVigiarMercado: !!el.checked }); fb('ok', 'Vigia do mercado: ' + (el.checked ? 'LIGADA.' : 'desligada — nenhuma oferta da watch é comprada.')); ultimoRender = 0; },
    'ap-watch-itens': (el) => { const l = listaWatch(el.value); definirCfg({ mercadoWatch: novoWatch({ itens: l }) }); fb('ok', 'Watch de itens: ' + (l.length ? l.join(', ') : 'vazia') + '.'); ultimoRender = 0; },
    'ap-watch-vendedores': (el) => { const l = listaWatch(el.value); definirCfg({ mercadoWatch: novoWatch({ vendedores: l }) }); fb('ok', 'Watch de jogadores: ' + (l.length ? l.join(', ') : 'vazia') + '.'); ultimoRender = 0; },
    'ap-watch-preco': (el) => { const v = Math.max(0, Number(el.value) || 0); definirCfg({ mercadoWatch: novoWatch({ precoMax: v > 0 ? v : null }) }); fb('ok', v > 0 ? 'Preço máximo por oferta: ' + fmt(v) + ' ouro.' : 'Sem tecto de preço próprio (fica só a reserva de ouro).'); },
    'ap-watch-teto': (el) => { const v = Math.max(0, Number(el.value) || 0); definirCfg({ mercadoWatch: novoWatch({ tetoCompra: v > 0 ? v : null }) }); fb('ok', 'Tecto de gasto por passagem: ' + (v > 0 ? fmt(v) + ' ouro' : 'sem tecto') + '.'); },
    'ap-watch-cad': (el) => { const s = Math.max(2, Number(el.value) || 5); definirCfg({ mercadoWatch: novoWatch({ cadenciaMs: s * 1000 }) }); fb('ok', 'Cadência da vigia: ' + s + ' s.'); },
    // ---- ALVOS DO AUTO-PLAY (2026-10-18): "qualquer campeão" vs lista. Vazio = qualquer. ----
    'ap-champ-any': (el) => {
      definirCfg({ champAlvo: el.checked ? null : ['yasuo', 'ryze'] });
      fb('ok', el.checked ? 'Alvos: QUALQUER campeão (o auto-play corre em todos).' : 'Alvos: lista restrita — escolha os campeões abaixo.');
      _ultimoHtml.delete('ap-auto-champ');
      if (tabAtiva === 'painel') { renderAuto(); }
    },
  };

  function bind() {
    const painel = $('lolidle-ap');
    if (!painel) return;
    painel.addEventListener('click', (e) => {
      // remover um item escolhido (delegação: o contentor dos chips nasce só quando a aba Ganhos desenha)
      const rem = e.target.closest ? e.target.closest('[data-rem]') : null;
      if (rem && rem.dataset && painel.contains(rem)) { selItens.delete(String(rem.dataset.rem)); mudouEscolha(); return; }
      const b = e.target.closest ? e.target.closest('button[id]') : null;
      if (!b || !painel.contains(b)) return;
      const f = ACOES[b.id];
      if (!f) { fbAviso('Este botão ainda não faz nada (reporta: ' + b.id + ').'); return; }
      try { f(b); } catch (err) { fbErro('Erro inesperado em ' + b.id + ': ' + String((err && err.message) || err)); }
    });
    painel.addEventListener('change', (e) => {
      const el = e.target;
      if (!el || !el.id) return;
      // INTERRUPTOR DA ÁRVORE (hierarquia): id ap-arv-<nome>, chave do motor em data-cfg
      if (el.dataset && el.dataset.arv) {
        try { alternarInterruptor(el.dataset.arv, el.dataset.cfg, el.checked); }
        catch (err) { fbErro('Erro ao mudar o switch: ' + String((err && err.message) || err)); }
        return;
      }
      const f = MUDANCAS[el.id];
      if (f) { try { f(el); } catch (err) { fbErro('Erro ao guardar: ' + String((err && err.message) || err)); } return; }
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
      // ALVOS DO AUTO-PLAY: ids compostos ap-champ-<id-do-campeao>. A lista vazia = qualquer
      // campeão (o motor trata null/vazio como "sem restrição") — coerente com o "Qualquer campeão".
      const mc = /^ap-champ-(.+)$/.exec(el.id);
      if (mc) {
        const id = mc[1];
        try {
          const atuais = (ler('campeoesAlvo', []) || []).slice();
          const i = atuais.indexOf(id);
          if (el.checked && i < 0) atuais.push(id);
          if (!el.checked && i >= 0) atuais.splice(i, 1);
          definirCfg({ champAlvo: atuais.length ? atuais : null });
          fb('ok', atuais.length
            ? 'Alvos: ' + atuais.join(', ') + '.'
            : 'Nenhum campeão selecionado: o motor volta a jogar em QUALQUER um.');
          _ultimoHtml.delete('ap-auto-champ');
          if (tabAtiva === 'painel') renderAuto();
        } catch (err) { fbErro('Erro ao guardar alvos: ' + String((err && err.message) || err)); }
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
        const m = qa('#lolidle-ap-modal.on,#lolidle-ap-testes.on,#lolidle-ap-ajuda.on,#lolidle-ap-confirma.on')[0];
        if (m) { if (m.id === 'lolidle-ap-confirma') fecharConfirmar(false); else { m.hidden = true; m.classList.remove('on'); } }
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
        cofreStore = (res && res[COFRE_KEY]) || null;        // o que o motor gravou do cofre
        ofertasStore = (res && res[OFERTAS_KEY]) || null;    // o que o motor gravou do mercado
        estadoStore = (res && res[ESTADO_KEY]) || null;      // estado COMPLETO do jogo (motor grava a cada 20 s)
        // Preferências da GUI (minimizar da build por fase, modalidade de farm): não são config
        // do motor, por isso vivem em GUI_KEY e não em STORAGE_KEY.
        guiPrefs = Object.assign({ bfAberto: true, farmModo: 'sozinho', fmModoMin: false, fmItensMin: false }, (res && res[GUI_KEY]) || {});
        ultimoRender = 0;
        // O render corre no arranque e nos segundos seguintes, com o painel fechado ou aberto.
        // Se dependesse de alguém abrir o painel (hover, F8), os blocos ficavam no placeholder
        // inicial (#ap-fase="carregando…", #ap-h-*="—", #ap-build-fase=""). Renderiza uma
        // vez no arranque, sempre.
        renderTudo();
        // O arranque do content script corre ANTES de o HUD do jogo estar pintado
        // (medido: a 1.ª render deixava #ap-h-nivel e #ap-h-ouro a "—" enquanto a
        // fase e o build já saíam certos). Como o `tick()` não corre com o painel
        // fechado, esses dois campos ficavam a "—" para sempre. Re-renderiza nos
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
        if (ch[OFERTAS_KEY]) { ofertasStore = ch[OFERTAS_KEY].newValue; if (aberto && tabAtiva === 'itens') renderMercado(); }
        // ESTADO COMPLETO: o motor grava-o a cada 20 s; a GUI redesenha o retrato quando chega.
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
