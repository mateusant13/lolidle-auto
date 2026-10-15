/*
 * LoL Idle — Auto Poção · content.js  (world: ISOLATED)
 *
 * Lê o HUD, mede DPS recebido / cura por segundo / DPS causado, detecta chefe
 * e clica na poção certa. A decisão é por **HP PERDIDO** (percentual do HP máx
 * ou HP flat), conforme a pessoa escolhe na GUI (gui.js).
 *
 * Métrica primária = a CONTAGEM das poções (o HP sobe pela cura natural também;
 * por isso o HP é secundário). O uso é confirmado pelo decremento da contagem.
 *
 * Mecânica do jogo: ver docs/lolidle-internals.md.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'lolidleAutoPotion';
  const STATUS_KEY = STORAGE_KEY + ':status';

  // Cada poção: enabled | mode ('pct' do HP máx perdido | 'lost' HP flat perdido) | value
  const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'bands',            // 'bands' (faixas) | 'strongest'
    potions: {
      vidaS: { enabled: true, mode: 'pct', value: 60 },  // perdeu 60% -> Suprema (2200)
      vidaF: { enabled: true, mode: 'pct', value: 43 },  // perdeu 43% -> Forte (900)
      vida:  { enabled: true, mode: 'pct', value: 21 },  // perdeu 21% -> Normal (300)
    },
    // ATENCAO (2026-10-14): depois do pedido do dono ("usar pocoes em sequencia e burro. deixa a
    // unica opcao sendo a smart"), isto sobrevive APENAS para o ramo PvP (mode === 'strongest',
    // content.js:291) - que o dono mandou manter IGUAL. O modo smart (o unico que resta na GUI)
    // NUNCA encadeia normal+forte. Ja nao ha toggle na interface para isto.
    combine: true,            // SO PvP: alterna normal+forte em vez da suprema
    panicPct: 0.15,           // HP abaixo disto = pânico
    emergencySeconds: 2.5,    // HP/DPS_recebido abaixo disto = emergência
    bossEmergencySeconds: 4,
    bossMarginPct: 0.12,      // dispara 12% mais cedo durante chefe
    cooldownMs: 1100,         // EXAUSTAO do jogo = 1s (folga)
    pollMs: 300,
    windowMs: 5000,
    onlyInCombat: false,
    debug: false,
  };

  const META = {
    vidaS: { heal: 2200, label: 'Suprema' },
    vidaF: { heal: 900,  label: 'Forte' },
    vida:  { heal: 300,  label: 'Normal' },
  };
  const ORDER = ['vidaS', 'vidaF', 'vida']; // mais forte -> mais fraca

  // ============ AUTOPLAY SÓ NO YASUO (regra do dono, 2026-10-14) ============
// O `content.js` NÃO tinha UMA ÚNICA referência a campeão, e `DEFAULT_CONFIG.enabled = true`:
// a auto-poção corria em QUALQUER campeão — incluindo a Katarina, onde o dono proibiu.
// O campeão lê-se do retrato do HUD: `#hud-retrato[data-qual]` = "<champ>:<skin>" (ex.: 'yasuo:0').
// Sem leitura do retrato NÃO bloqueia (fail-open): um seletor que mude não pode desligar tudo.
const CHAMP_ALVO = 'yasuo';
function campeaoAtual() {
  try {
    const q = (document.querySelector('#hud-retrato') || {}).dataset?.qual || '';
    return String(q).split(':')[0].trim().toLowerCase();
  } catch { return ''; }
}
const campeaoCerto = () => { const c = campeaoAtual(); return !c || c === CHAMP_ALVO; };

let config = structuredClone(DEFAULT_CONFIG);
  let lastClickAt = 0;
  let lastAction = null;
  let lastChain = null;
  let pendingClick = null;                  // { k, countBefore, at, consumed }
  const countsPrev = {};
  const countHist = { vidaS: [], vidaF: [], vida: [] };

  const log = (...a) => { if (config.debug) console.log('[auto-poção]', ...a); };
  // Sufixo que o `fmt` do JOGO mete nos números do HUD:
  //   fmt = n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e4 ? (n/1e3).toFixed(1)+'k' : Math.round(n)
  // (docs/game-src/cena.js:225) — e é esse `fmt` que escreve `#hud-vida-txt`
  // (`${fmt(vida)} / ${fmt(a.vida)}`, docs/game-src/jogo.js:6203) e `#st-vida-txt` (:6438).
  // O parser antigo (`replace(/[^\d]/g,'')`) APAGAVA o sufixo: "12.3k" virava 123 e "1.2M"
  // virava 12 — e a regex do readHP, sem o sufixo nos grupos, ou não casava
  // ("12.3k / 20.4k" → sem par cur/max) ou cortava o máximo para 123 ("9.876 / 12.3k",
  // o "k" ficava fora do grupo). Nos dois casos o gatilho da poção morria acima de
  // 10 000 de HP — que é exactamente a fonte do gatilho em tempo real (content.js:467-478).
  const SUFIXO = { k: 1e3, K: 1e3, m: 1e6, M: 1e6 };   // cena.js:225: k = x1000, M = x1000000
  /**
   * Número do HUD como o jogo o escreve.
   * @param {string} raw campo numérico (sem o sufixo)
   * @param {string} [suf] 'k'/'m' que vinha imediatamente a seguir ao campo
   */
  const parseNum = (raw, suf) => {
    const s = String(raw ?? '').replace(/[\s\u00a0\u202f]/g, '');
    if (!s) return NaN;
    const d = s.replace(/[^\d.,]/g, '');                       // "12.3" | "4.188" | "1.234.567"
    if (!d) return NaN;
    // "4.188" (grupo de 3) é MILHAR em pt-BR; "12.3" é decimal (o `fmt` dá 1 casa, cena.js:225).
    const v = /^\d{1,3}([.,]\d{3})+$/.test(d) ? Number(d.replace(/[.,]/g, ''))
      : /^\d+[.,]\d+$/.test(d) ? Number(d.replace(',', '.'))
        : Number(d.replace(/[.,]/g, ''));
    const mult = SUFIXO[String(suf ?? '').trim()] || 1;
    return Number.isFinite(v) ? v * mult : NaN;
  };
  const sum = (list) => list.reduce((s, e) => s + e.v, 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // --------------------------------------------------------------- leitura DOM
  function readHP() {
    const txt = document.querySelector('#hud-vida-txt')?.textContent
      || document.querySelector('#st-vida-txt')?.textContent || '';
    // O `fmt` mete "k"/"M" acima de 10 000/1 000 000 (cena.js:225), logo o sufixo TEM de entrar
    // nos grupos: sem ele "12.3k / 20.4k" não casava nada e "9.876 / 12.3k" dava max = 123.
    const m = txt.match(/([\d.,]+)\s*([kKmM])?\s*\/\s*([\d.,]+)\s*([kKmM])?/);
    if (m) {
      const cur = parseNum(m[1], m[2]), max = parseNum(m[3], m[4]);
      if (Number.isFinite(cur) && Number.isFinite(max) && max > 0) return { cur, max };
    }
    const w = document.querySelector('#hud-vida')?.style?.width;
    const pct = w && w.match(/([\d.]+)%/);
    return pct ? { cur: NaN, max: NaN, pct: Number(pct[1]) / 100 } : null;
  }

  function readTarget() {
    const el = document.querySelector('#hud-alvo');
    if (!el || !el.textContent.trim()) return null;
    const name = el.querySelector('b')?.textContent?.trim() || '';
    const lvl = parseNum(el.querySelector('small')?.textContent);
    return { name, level: Number.isFinite(lvl) ? lvl : null, boss: /👑/.test(el.textContent) };
  }

  function potionButton(k) {
    return document.querySelector(`#hud-pocoes [data-pocao="${k}"]`)
      || document.querySelector(`#pocoes [data-pocao="${k}"]`);
  }
  function potionState(k) {
    const btn = potionButton(k);
    if (!btn) return null;
    const count = parseNum(btn.querySelector('b')?.textContent);
    const blocked = btn.classList.contains('zero') || btn.classList.contains('bloq');
    return { btn, count: Number.isFinite(count) ? count : 0, blocked };
  }
  const available = (k) => { const s = potionState(k); return !!s && !s.blocked && s.count > 0; };

  // --------------------------------------------------------------- medição
  const ev = { hp: [], heal: [], shield: [], dmg: [], combate: [] };
  // histórico compacto do combate (p/ REPLAY da morte): hit/heal/pot/carga/golpe
  const hist = [];
  const hpush = (e) => { if (e.at == null) e.at = Date.now(); hist.push(e); if (hist.length > 400) hist.shift(); };
  // -------- log detalhado da run (dano/morte/wave) — compartilhado com automation.js --------
  const runLog = (window.__lolidleRunLog = window.__lolidleRunLog || []);
  const rlog = (e) => { if (e.at == null) e.at = Date.now(); runLog.push(e); if (runLog.length > 5000) runLog.splice(0, runLog.length - 5000); };
  window.__lolidleRlog = rlog;
  // cores do canvas: separa MEU dano (out) do dano TOMADO (in) — cena.js (2026-10-13)
  const COR_OUT = new Set(['#ff3030', '#ff7a30', '#ff9a5a', '#e8c840', '#d8a050', '#ffd040', '#ffae00', '#c07cff', '#b01010', '#ff5a3a']);
  const COR_IN = new Set(['#ff6a3a', '#c070ff', '#ffffff']);
  const dirDano = (cor) => { cor = String(cor || '').toLowerCase(); return COR_IN.has(cor) ? 'in' : 'out'; };   // default out (a maioria é nosso)
  let alvoAtual = '';
  const lerAlvo = () => { const el = document.querySelector('#hud-alvo'); return el && !el.hidden ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  const checarAlvo = () => {
    const t = lerAlvo();
    if (t === alvoAtual) return;
    const nome = t ? t.replace(/\s*nv\b.*$/i, '').replace(/[✦✹★].*$/, '').trim() : '';
    if (nome && !alvoAtual) rlog({ t: 'wave', nome });
    else if (!nome && alvoAtual) rlog({ t: 'waveFim' });
    else if (nome && alvoAtual && nome !== alvoAtual.replace(/\s*nv\b.*$/i, '').replace(/[✦✹★].*$/, '').trim()) rlog({ t: 'alvo', nome });
    alvoAtual = t;
  };
  // AUTO-LIMPEZA: se o content.js JÁ rodou (reinjeção), cancela os timers antigos (senão empilha loops)
  const _CT = (window.__lolidleContentTimers = window.__lolidleContentTimers || []);
  for (const t of _CT) { try { clearInterval(t); clearTimeout(t); } catch { /* ignore */ } }
  _CT.length = 0;
  const every = (ms, fn) => { const id = setInterval(fn, ms); _CT.push(id); return id; };

  const hudEl = document.querySelector('#hud') || document.body;
  // SEM MutationObserver no HUD: ele muda TODO FRAME (HP/cooldown) e o observer disparava
  // centenas de vezes por segundo — era isso que derrubava o FPS. O intervalo de 250 ms basta.
  every(250, checarAlvo);
  const BOSS_TIMEOUT_MS = 180000;
  let bossState = { active: false, name: null, since: 0, lastKey: '' };
  let lastPotionAt = 0;

  function push(list, t, v) {
    list.push({ t, v });
    const cut = t - config.windowMs;
    while (list.length && list[0].t < cut) list.shift();
  }

  let cargaAtual = null;   // mecânica carregada do chefe (aviso do cena.js, via inject.js)
  let bossHp = null;       // HP do chefe (fração 0..1) — fonte da verdade (inject: chefeBarra)
  let dmgOutTotal = 0, dmgInTotal = 0;                  // dano REAL acumulado (eventos do jogo)
  const dmgFonteTotal = {};                             // dano REAL por fonte (Q/W/E/R/ataque/queima/item...)
  const danoHist = [];                                  // amostras {at,out,in,porSkill} p/ o DPS por luta

  // ---- Rugido do Dragão: AS ×1,5 por 5 s. O ESTADO EXACTO é `i.furiaT` do chefe no motor:
  //   motor.js:3107  `else if (tipo === 'rugido') { i.as *= 1.5; i.furiaT = 5; }`
  //   motor.js:3085  `if (i.furiaT > 0) { i.furiaT -= dt; if (i.furiaT <= 0) i.as /= 1.5; }`  (acaba)
  // O código antigo INVENTAVA o tempo: `furiaAte = Date.now() + 5000` no golpe (observabilidade.md D7,
  // content.js:166). Agora lê-se o relógio do motor quando o inject.js o publica; o palpite de 5 s
  // fica só como FALLBACK para quando não é publicado (inject.js ainda não publica — ver abaixo).
  const RUGIDO_S = 5;                                   // motor.js:3107: i.furiaT = 5
  let furiaT = null;        // segundos EXACTOS restantes, lidos de i.furiaT (motor.js:3107)
  let furiaTEm = 0;         // em que ms é que esse valor foi lido (decai com o relógio local)
  let furiaAte = 0;         // fallback local (golpe + 5 s), usado só sem estado real
  /** Segundos de rugido restantes pelo relógio do MOTOR (decai desde a leitura); null = sem estado real. */
  function furiaRestante() {
    if (furiaT == null) return null;
    return furiaT - (Date.now() - furiaTEm) / 1000;
  }
  function furiaAtiva() {
    const r = furiaRestante();
    return r != null ? r > 0 : Date.now() < furiaAte;
  }
  /**
   * Estado do chefe publicado pelo inject.js (mundo MAIN, que tem a instância da Cena e o
   * `combate` vivo — observabilidade.md §2.1/P0-1). Contrato REAL, como o inject.js:379/435
   * o publica (wrap de Cena.prototype.sincronizar, cena.js:671, a cada tick):
   *   postMessage({ __lolidleAuto: 'estado', inimigos: [ { ..., mec, tMec, carrega, furiaT } ] })
   * O `furiaT` vive no MONSTRO (motor.js:3107/3085) — o Rugido do Dragão acelera o chefe —,
   * por isso vem dentro de cada inimigo; o `combate.darius` não o tem.
   *   `furiaT` é NÚMERO em segundos — o mesmo campo do motor (motor.js:3107), não booleano.
   * Também aceitamos `furiaT` no topo da mensagem (ex.: 'combate') e o booleano `furia`,
   * que só serve para armar o fallback.
   * @returns segundos restantes (>= 0) ou null se a mensagem não traz o estado do motor
   */
  function lerFuriaT(d) {
    if (!d || typeof d !== 'object') return null;
    const topo = Number(d.furiaT);
    if (Number.isFinite(topo) && topo >= 0) return topo;              // campo no topo da mensagem
    const ini = d.inimigos;
    if (!Array.isArray(ini)) return null;
    // A lista de inimigos é AUTORITATIVA: se ela veio, o motor acabou de a desenhar, e um
    // `furiaT: 0` em todos significa que o Rugido ACABOU (motor.js:3085). Tratar "0 em todos"
    // como "sem dado" deixaria o palpite de 5 s ligado até 5 s depois do fim — o defeito D7
    // de volta, pela porta da lista vazia de furias.
    let m = 0;
    for (const i of ini) {                                            // o maior furiaT entre os inimigos
      const v = Number(i && i.furiaT);
      if (Number.isFinite(v) && v >= 0) m = Math.max(m, v);
    }
    return m;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.__lolidleAuto) {
      const ft = lerFuriaT(e.data);
      if (ft != null) {                                   // estado EXACTO do motor: manda ele
        furiaT = ft; furiaTEm = Date.now();
        furiaAte = ft > 0 ? Date.now() + ft * 1000 : 0;   // fallback alinhado ao que o motor diz
        // SÓ a mensagem própria do estado sai daqui. Se o `furiaT` vier colado noutra
        // mensagem (ex.: 'combate'), a leitura NÃO pode descartar o resto do payload —
        // o dano continuaria a ser contado. ('estado' é a do inject.js:435.)
        if (e.data.__lolidleAuto === 'chefe-estado' || e.data.__lolidleAuto === 'estado') return;
      } else {
        // sem número, um booleano só arma o FALLBACK (não há tempo restante para ler)
        if (e.data.furia === true) furiaAte = Date.now() + RUGIDO_S * 1000;
        if (e.data.__lolidleAuto === 'chefe-estado' || e.data.__lolidleAuto === 'estado') return;
      }
    }
    if (e.data.__lolidleAuto === 'carga') { cargaAtual = { mec: e.data.mec, dur: e.data.dur, at: Date.now() }; hpush({ t: 'carga', mec: e.data.mec }); return; }
    if (e.data.__lolidleAuto === 'golpe') {
      // fallback (motor.js:3107): 5 s a contar do golpe — só vale enquanto o inject não publicar
      // o i.furiaT exacto; a partir daí `furiaT != null` e `furiaAtiva()` usa o relógio do motor.
      if (e.data.mec === 'rugido') furiaAte = Date.now() + RUGIDO_S * 1000;
      hpush({ t: 'golpe', mec: e.data.mec }); cargaAtual = null; return;
    }
    if (e.data.__lolidleAuto === 'combate') { const o = e.data.out || {}, tm = e.data.tomou || 0; push(ev.combate, Date.now(), { out: o, tomou: tm }); for (const f in o) { dmgOutTotal += o[f]; dmgFonteTotal[f] = (dmgFonteTotal[f] || 0) + o[f]; } dmgInTotal += tm; return; }
    if (e.data.__lolidleAuto === 'chefe-hp') { bossHp = { nome: e.data.nome, vida: e.data.vida, at: Date.now() }; return; }
    if (!e.data.__lolidle) return;
    const now = Date.now();
    const v = Number(e.data.value);
    if (!Number.isFinite(v) || v <= 0) return;
    if (e.data.__lolidle === 'heal') { push(ev.heal, now, v); rlog({ at: now, t: 'heal', v }); hpush({ at: now, t: 'heal', v }); }
    else if (e.data.__lolidle === 'shield') { push(ev.shield, now, v); rlog({ at: now, t: 'shield', v }); hpush({ at: now, t: 'shield', v }); }
    else if (e.data.__lolidle === 'dmg') { push(ev.dmg, now, v); rlog({ at: now, t: 'dmg', v, dir: dirDano(e.data.color), cor: e.data.color, x: e.data.x, y: e.data.y }); hpush({ at: now, t: 'dmg', v, dir: dirDano(e.data.color) }); }
  });

  function readBoss() {
    const now = Date.now();
    const logEl = document.querySelector('#log');
    if (logEl) {
      for (const el of [...logEl.children].slice(-40)) {
        const t = (el.textContent || '').trim();
        const key = t.slice(0, 24);
        if (/chefe/i.test(t) && /apareceu/i.test(t)) {
          if (key !== bossState.lastKey) bossState = { active: true, name: t, since: now, lastKey: key };
        } else if (/derrotado/i.test(t) && /arauto|dragão|barão|vilemaw|chefe/i.test(t)) {
          if (bossState.active) bossState = { active: false, name: null, since: 0, lastKey: bossState.lastKey };
        }
      }
    }
    const alvo = readTarget();
    if (alvo?.boss) { bossState.active = true; if (!bossState.since) bossState.since = now; }
    if (bossState.active && now - bossState.since > BOSS_TIMEOUT_MS) bossState.active = false;
    return bossState.active;
  }

  // A CONTAGEM da poção é a fonte de verdade de "usei poção".
  function trackCounts(now) {
    for (const k of ORDER) {
      const st = potionState(k);
      if (!st) continue;
      const prev = countsPrev[k];
      if (typeof prev === 'number' && st.count < prev) {
        push(countHist[k], now, prev - st.count);
        if (pendingClick && pendingClick.k === k) pendingClick.consumed = true;
      }
      countsPrev[k] = st.count;
    }
    if (pendingClick && !pendingClick.consumed && now - pendingClick.at > 700) {
      if (lastAction && lastAction.at === pendingClick.at) lastAction.consumed = false;
      pendingClick = null;
    }
  }

  function rates() {
    // FONTE DA VERDADE = BARRA DE HP (não os números do canvas, que se repetem/erram).
    // A barra é universal: toda cura e todo dano passam por ela. Os números coloridos
    // do canvas servem só p/ ATRIBUIR (cor/poção), nunca p/ decidir.
    const pts = ev.hp;                       // [{t, v: cur}] — preenchido no tick a partir da barra
    let w = config.windowMs / 1000;
    if (pts.length >= 2) { const span = (pts[pts.length - 1].t - pts[0].t) / 1000; if (span > 0.5) w = span; }
    let quedas = 0, subidas = 0;
    // TETO da barra: um rise que termina no HP máximo só mostra o "restinho" — conta como o nominal (maior rise NÃO-capado).
    const hpm = readHP();
    const maxHp = hpm && Number.isFinite(hpm.max) ? hpm.max : null;
    let maxNaoCap = 0;
    for (let i = 1; i < pts.length; i++) { const d = pts[i].v - pts[i - 1].v; if (d > 0) { const capado = maxHp != null && pts[i].v >= maxHp - 1; if (!capado) maxNaoCap = Math.max(maxNaoCap, d); } }
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].v - pts[i - 1].v;
      if (d < 0) quedas += -d; else if (d > 0) { const capado = maxHp != null && pts[i].v >= maxHp - 1; subidas += (capado && maxNaoCap > d) ? maxNaoCap : d; }
    }
    const dmgRate = quedas / w;
    const healRateBar = subidas / w;                          // TODA cura medida NA BARRA (poção + skill)
    const potionHeal = ORDER.reduce((s, k) => s + sum(countHist[k]) * META[k].heal, 0);
    const potionRate = potionHeal / w;
    // DPS REAL = eventos de combate do JOGO (Cena.evento 'dano'/'recebido'), não o canvas.
    let cOut = 0, cIn = 0; const porSkill = {};
    for (const c of ev.combate) { const p = c.v; if (!p) continue; for (const f in p.out) { cOut += p.out[f]; porSkill[f] = (porSkill[f] || 0) + p.out[f]; } cIn += p.tomou || 0; }
    const spanC = ev.combate.length >= 2 ? Math.max(0.5, (ev.combate[ev.combate.length - 1].t - ev.combate[0].t) / 1000) : w;
    const dpsFonte = {}; for (const f in porSkill) dpsFonte[f] = Math.round(porSkill[f] / spanC);
    return {
      dmgRate,
      healRate: healRateBar,
      healSkillRate: Math.max(0, healRateBar - potionRate),   // cura das SKILLS = subidas da barra − poções
      myDps: Math.round(cOut / spanC),                        // DPS REAL (eventos do jogo)
      dpsOut: Math.round(cOut / spanC),
      dpsIn: Math.round(cIn / spanC),
      porSkill, dpsFonte,
      potionRate: ORDER.reduce((s, k) => s + sum(countHist[k]), 0) / w,
      shieldRate: sum(ev.shield) / w,
    };
  }

  // --------------------------------------------------------------- decisão (HP perdido)
  function lostOf(k, max, boss) {
    const c = config.potions[k];
    let lost = c.mode === 'pct' ? (c.value / 100) * max : c.value;
    if (boss) lost *= (1 - config.bossMarginPct); // chefe: dispara mais cedo
    return clamp(lost, 0, max);
  }
  const triggerHp = (k, max, boss) => max - lostOf(k, max, boss);

  function strongest(ctx) { for (const k of ORDER) if (config.potions[k]?.enabled && available(k)) return k; return null; }

  function choosePotion(hp, max, ctx) {
    if (max - hp < 1) return null; // nada a curar
    const panic = max * config.panicPct;
    const ttd = ctx.dmgRate > 0.5 ? hp / ctx.dmgRate : Infinity;
    const emergSec = ctx.boss ? config.bossEmergencySeconds : config.emergencySeconds;

    // REDE DE SEGURANÇA (SEMPRE, antes de tudo): HP no chão ou morrendo rápido → a mais forte.
    if (ttd <= emergSec || hp <= panic) {
      const k = strongest(ctx);
      if (k) return { k, reason: `emergência (ttd ${ttd === Infinity ? '∞' : ttd.toFixed(1)}s)` };
    }

    // SMART (padrão): cobre o dano real. Se não conseguir decidir (sem medição), cai pro normal.
    if (config.smart !== false) {
      let d = null;
      try { d = window.__lolidleAuto && window.__lolidleAuto.decidirPocao && window.__lolidleAuto.decidirPocao(); } catch { d = null; }
      if (d) {
        if (d.k && available(d.k)) return { k: d.k, reason: d.reason };
        if (!d.k) return null;                       // decidiu: cura das skills cobre → sem poção
      }
      // d === null → não decidiu (sem HP medido) → cai pro normal (segurança)
    }

    // Normal (aba PvP): por HP perdido
    if (config.mode === 'strongest') {
      for (const k of ORDER) {
        if (!config.potions[k]?.enabled) continue;
        if (hp <= triggerHp(k, max, ctx.boss) && available(k)) return { k, reason: `mais forte (HP ≤ ${Math.round(triggerHp(k, max, ctx.boss))})` };
      }
      if (config.combine && available('vida') && available('vidaF') && hp <= triggerHp('vidaS', max, ctx.boss)) {
        return { k: chainNext(), reason: 'combina normal+forte (suprema bloqueada)' };
      }
      return null;
    }

    // faixas: da mais forte (HP mais baixo) para a mais fraca
    for (const k of ORDER) {
      if (!config.potions[k]?.enabled) continue;
      const thr = triggerHp(k, max, ctx.boss);
      if (hp > thr) continue;
      if (k === 'vidaS') {
        if (available('vidaS')) return { k: 'vidaS', reason: `suprema (HP ≤ ${Math.round(thr)})` };
        // PEDIDO DO DONO (2026-10-14, verbatim): "usar pocoes em sequencia e burro. deixa a unica
        // opcao de usar pocoes sendo a smart, a mais avancada." -> o modo SMART nunca encadeia
        // normal+forte. O encadeamento sobrevive SO no ramo PvP (mode === 'strongest', acima),
        // que o dono mandou manter IGUAL.
        const s = strongest(ctx); return s ? { k: s, reason: 'topo (fallback)' } : null;
      }
      if (available(k)) return { k, reason: `${META[k].label} (HP ≤ ${Math.round(thr)})` };
      const s = strongest(ctx);
      return s ? { k: s, reason: `fallback (${k} indisponível)` } : null;
    }
    return null;
  }

  function chainNext() {
    const next = lastChain === 'vida' ? 'vidaF' : 'vida';
    if (available(next)) return next;
    const other = next === 'vida' ? 'vidaF' : 'vida';
    return available(other) ? other : next;
  }

  // --------------------------------------------------------------- status
  let lastStatusAt = 0;
  function publishStatus(extra) {
    const now = Date.now();
    if (!extra && now - lastStatusAt < 800) return;
    lastStatusAt = now;
    const hp = readHP();
    const max = hp && Number.isFinite(hp.max) ? hp.max : null;
    const potions = {};
    for (const k of Object.keys(META)) {
      const s = potionState(k);
      potions[k] = s ? { count: s.count, blocked: s.blocked, lost: max ? lostOf(k, max, bossState.active) : null, trigger: max ? triggerHp(k, max, bossState.active) : null } : null;
    }
    const r = rates();
    const status = {
      at: now,
      hp: hp && Number.isFinite(hp.cur) ? { cur: hp.cur, max: hp.max, lost: hp.max - hp.cur, pct: hp.max ? hp.cur / hp.max : hp.pct } : null,
      target: readTarget(),
      boss: bossState.active,
      furia: furiaAtiva(),                                 // motor.js:3107/3085 (i.furiaT), não palpite
      furiaT: furiaRestante() != null ? Math.round(furiaRestante() * 100) / 100 : null,
      carga: cargaAtual && (Date.now() - cargaAtual.at < 4000) ? cargaAtual : null,
      hit: { mob: hitInfo(hitsMob), boss: hitInfo(hitsBoss) },
      hitLog: { boss: hitLog(hitsBoss), mob: hitLog(hitsMob) },
      hist: hist.slice(-150),
      rates: r,
      dps: { out: r.dpsOut || 0, in: r.dpsIn || 0, porSkill: r.porSkill || {}, porFonte: r.dpsFonte || {} },
      bossHp: bossHp && (Date.now() - bossHp.at < 2500) ? { nome: bossHp.nome, pct: Math.round(bossHp.vida * 100) } : null,
      danoTotal: { out: Math.round(dmgOutTotal), in: Math.round(dmgInTotal), porSkill: { ...dmgFonteTotal } },
      danoHist: danoHist.slice(-900),
      potions,
      enabled: config.enabled,
      mode: config.mode,
      lastAction,
      consuming: pendingClick ? { k: pendingClick.k, at: pendingClick.at } : null,
      config,
      ...extra,
    };
    try { chrome.storage.local.set({ [STATUS_KEY]: status }); } catch { /* recarregando */ }
    try { danoHist.push({ at: Date.now(), out: dmgOutTotal, in: dmgInTotal, porSkill: { ...dmgFonteTotal } }); if (danoHist.length > 900) danoHist.shift(); } catch { /* ignore */ }
    window.__lolidleLive = status;
    try {
      document.documentElement.dataset.lolidleAuto = JSON.stringify({
        ver: '0.4', on: config.enabled, hp: status.hp?.cur ?? null, max: status.hp?.max ?? null,
        dmg: Math.round(r.dmgRate), heal: Math.round(r.healRate), mydps: Math.round(r.myDps),
        boss: status.boss, k: lastAction?.k ?? null, reason: lastAction?.reason ?? null, at: lastAction?.at ?? null, hit: status.hit, hitLog: status.hitLog,
      });
    } catch { /* ignore */ }
  }

  // --------------------------------------------------------------- laço
  // Janela de golpes medida pelos degraus do HP (cada queda = um golpe).
  // Serve pra descobrir o intervalo real entre golpes do chefe/mobs.
  const hitsMob = [], hitsBoss = [];
  let lastHpHit = null;
  function trackHits(now, cur, boss) {
    if (lastHpHit != null && cur < lastHpHit) {
      const drop = lastHpHit - cur;
      if (drop >= 15) {
        const arr = boss ? hitsBoss : hitsMob;
        const last = arr[arr.length - 1];
        if (last && now - last.at < 250) { last.drop += drop; last.at = now; } // mesmo golpe em ticks
        else arr.push({ at: now, drop });
        hpush({ at: now, t: 'hit', drop: Math.round(drop), hp: cur });
        if (arr.length > 400) arr.shift();
      }
    }
    lastHpHit = cur;
  }
  function hitInfo(arr) {
    if (arr.length < 2) return null;
    const gaps = [], drops = arr.map((h) => h.drop);
    for (let i = 1; i < arr.length; i++) { const g = arr[i].at - arr[i - 1].at; if (g > 250) gaps.push(g); }
    if (!gaps.length) return null;
    gaps.sort((a, b) => a - b); drops.sort((a, b) => a - b);
    const q = (p) => drops[Math.min(drops.length - 1, Math.floor(drops.length * p))];
    return {
      ms: gaps[Math.floor(gaps.length / 2)],
      drop: q(0.5),          // mediana (golpe típico)
      p75: q(0.75),
      p90: q(0.9),           // golpe carregado (é o que importa p/ sobreviver)
      max: drops[drops.length - 1],
      n: arr.length,
    };
  }
  /** Últimos golpes crus: queda + intervalo desde o anterior (pra ver normal × carregado). */
  function hitLog(arr, n = 400) {
    const a = arr.slice(-n);
    return a.map((h, i) => ({ drop: Math.round(h.drop), gapMs: i ? h.at - a[i - 1].at : null }));
  }

  /** Decisão de poção — chamada pelo `tick` E, em TEMPO REAL, quando a barra de HP muda. */
  function tentarPocao(now, hp) {
    // Poção = REDE DE SEGURANÇA: SEMPRE ativa, mesmo com a automação desligada.
    // O switch on/off só para a COMPRA/recall e a rotação de skills/itens — NUNCA a cura em combate.
    if (!hp || !Number.isFinite(hp.cur) || hp.cur <= 0) return;
    if (config.onlyInCombat && !readTarget()) return;
    // SAÍDA BARATA: HP quase cheio e sem chefe não precisa de poção (evita `rates()` a cada frame)
    const rel = hp.cur / (hp.max || 1);
    if (rel > 0.95 && !bossState.active) return;

    const r = rates();
    const ctx = { boss: bossState.active, dmgRate: r.dmgRate };
    const pick = choosePotion(hp.cur, hp.max, ctx);
    if (!pick) return;
    if (now - lastClickAt < config.cooldownMs) return;

    const st = potionState(pick.k);
    if (!st || st.blocked || st.count <= 0) return;

    try {
      st.btn.click();
      lastClickAt = now;
      lastPotionAt = now;
      lastChain = pick.k === 'vida' || pick.k === 'vidaF' ? pick.k : lastChain;
      pendingClick = { k: pick.k, countBefore: st.count, at: now, consumed: false };
      lastAction = {
        k: pick.k, label: META[pick.k].label, reason: pick.reason,
        hpBefore: hp.cur, hpMax: hp.max, at: now, boss: bossState.active, consumed: null,
      };
      hpush({ at: now, t: 'pot', k: pick.k, hp: hp.cur, motivo: pick.reason });
      log('usou', pick.k, pick.reason, `${hp.cur}/${hp.max}`);
      publishStatus({ force: true });
    } catch (e) { log('falha ao clicar', e); }
  }

  function tick() {
    // GATE DE CAMPEÃO: nada de poção fora do Yasuo (regra do dono).
    if (!campeaoCerto()) return;
    const now = Date.now();
    const hp = readHP();
    if (hp && Number.isFinite(hp.cur)) { push(ev.hp, now, hp.cur); trackHits(now, hp.cur, bossState.active); }
    readBoss();
    trackCounts(now);
    tentarPocao(now, hp);
  }

  // ---- HP em TEMPO REAL: observer CIRÚRGICO (só a barra e o texto), sem o custo do HUD inteiro.
  // A barra de HP é a FONTE DA VERDADE: cada mudança dispara a leitura + o smart da poção na hora.
  let _hpObsAt = 0, _hpObsVal = null;
  const onHpChange = () => {
    const now = Date.now();
    if (now - _hpObsAt < 100) return;                 // throttle 10 Hz (o cooldown da poção é 1 s — sobra)
    _hpObsAt = now;
    const hp = readHP();
    if (!hp || !Number.isFinite(hp.cur)) return;
    if (hp.cur === _hpObsVal) return;                // nada mudou de verdade
    _hpObsVal = hp.cur;
    push(ev.hp, now, hp.cur);
    trackHits(now, hp.cur, bossState.active);
    tentarPocao(now, hp);
  };
  const ligarHpObs = () => {
    try {
      if (window.__lolidleHpObs) { window.__lolidleHpObs.disconnect(); window.__lolidleHpObs = null; }
      const hv = document.getElementById('hud-vida');
      const ht = document.getElementById('hud-vida-txt');
      if (!hv && !ht) return false;
      const o = new MutationObserver(onHpChange);
      if (hv) o.observe(hv, { attributes: true, attributeFilter: ['style'] });
      if (ht) o.observe(ht, { childList: true, characterData: true, subtree: true });
      window.__lolidleHpObs = o;
      return true;
    } catch { return false; }
  };
  if (!ligarHpObs()) { let tr = 0; const t0 = setInterval(() => { if (ligarHpObs() || ++tr > 40) clearInterval(t0); }, 500); }

  // --------------------------------------------------------------- boot
  function merge(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const out = { ...DEFAULT_CONFIG, ...s, potions: {} };
    for (const k of ORDER) out.potions[k] = { ...DEFAULT_CONFIG.potions[k], ...(s.potions?.[k] || {}) };
    return out;
  }

  function loadConfig() {
    try {
      chrome.storage.local.get(STORAGE_KEY, (res) => { if (res?.[STORAGE_KEY]) config = merge(res[STORAGE_KEY]); });
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'local' && ch[STORAGE_KEY]) { config = merge(ch[STORAGE_KEY].newValue); log('config atualizada', config); }
      });
    } catch (e) { log('storage indisponível', e); }
  }

  // Cura das poções vem do MOTOR (o automation guarda o meta em storage) — sem hardcode.
  function loadMetaPocoes() {
    const aplicar = (m) => { const p = m && m.pocoes; if (p) for (const k of ORDER) if (p[k] && p[k].cura) META[k].heal = p[k].cura; };
    try {
      chrome.storage.local.get('lolidleAutoPotion:meta', (res) => aplicar(res && res['lolidleAutoPotion:meta']));
      chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch['lolidleAutoPotion:meta']) aplicar(ch['lolidleAutoPotion:meta'].newValue); });
    } catch { /* ignore */ }
  }

  try { document.documentElement.dataset.lolidleAutoPotion = 'on'; } catch { /* ignore */ }
  loadConfig();
  loadMetaPocoes();
  every(Math.max(100, DEFAULT_CONFIG.pollMs), tick);
  every(1000, () => publishStatus());
  log('iniciado');
})();
