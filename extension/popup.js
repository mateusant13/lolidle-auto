/* LoL Idle — Auto-play · popup.js
 * -----------------------------------------------------------------------------
 * O popup do botão da extensão. Faz TRÊS coisas e diz sempre o que fez:
 *   1. MOSTRA o estado: o que o auto-play está a fazer, vida, ouro, nível, local,
 *      poções e a última decisão da auto-poção.
 *   2. LIGA/DESLIGA o auto-play e a auto-poção (um só interruptor para os dois).
 *   3. CONFIGURAÇÃO RÁPIDA: o que queres ganhar (xp/ouro/runas) e a região.
 *
 * NÃO tem botões que não funcionem: só escreve chaves que o motor lê do storage
 *   • enabled ............... auto-play + auto-poção (lido por automation.js e content.js)
 *   • automation.objetivo ... critério da região ideal
 *   • automation.regionDefault  região fixa (null = automática)
 * As acções que precisam do motor a correr (pausar, farmar agora, rotina de base)
 * vivem no painel dentro do jogo — o popup diz onde, em vez de fingir que faz.
 * -----------------------------------------------------------------------------
 */
'use strict';

const STORAGE_KEY = 'lolidleAutoPotion';
const STATUS_KEY = STORAGE_KEY + ':status';
const FARM_KEY = STORAGE_KEY + ':farm';
const PLAN_KEY = STORAGE_KEY + ':plan';
const META_KEY = STORAGE_KEY + ':meta';
const POCAO_NOME = { vidaS: 'Suprema', vidaF: 'Forte', vida: 'Normal' };
const ORDER = ['vidaS', 'vidaF', 'vida'];

const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('pt-BR') : '—');
const esc = (s) => String(s == null ? '' : s);
const fmtDur = (ms) => {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  return m < 60 ? m + 'min' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min';
};
const limparNivel = (s) => String(s || '?').replace(/\s*n[íi]vel.*$/i, '').trim();

let config = { enabled: true };
let status = null, farm = null, meta = null, plan = null;

// ---------------------------------------------------------------- desenho
function desenharEstado() {
  const idadeMs = status && status.at ? Date.now() - status.at : null;
  const semJogo = idadeMs == null || idadeMs > 30000;
  const ligado = !!config.enabled;
  const pill = $('pill'), txt = $('pill-txt');
  if (semJogo) { pill.className = 'pill err'; txt.textContent = 'sem dados do jogo'; }
  else if (!ligado) { pill.className = 'pill off'; txt.textContent = 'desligado'; }
  else { pill.className = 'pill on'; txt.textContent = 'ligado'; }

  // o que está a fazer
  const cur = farm && farm.current;
  let fase;
  if (semJogo) fase = 'A página do jogo não está aberta (ou ainda não carregou). Abre o lolidle.com para o auto-play funcionar.';
  else if (!ligado) fase = 'Desligado — modo observação: o motor lê o jogo mas não clica em nada.';
  else if (cur) {
    const quem = cur.fase === 'boss' ? 'a lutar com o chefe ' + limparNivel(cur.boss) : 'a farmar mobs';
    fase = 'A correr: ' + quem + ' em ' + limparNivel(cur.region) + ' (há ' + fmtDur(Date.now() - (cur.startedAt || Date.now())) + ').';
  } else fase = 'Ligado, mas sem ciclo de farm ativo — o motor conta ciclos enquanto estás no mapa.';
  $('fase').textContent = fase;

  // vida / nível / ouro / local
  const hp = status && status.hp && Number.isFinite(status.hp.cur) ? status.hp : null;
  if (hp) {
    $('hp-txt').textContent = fmt(hp.cur) + ' / ' + fmt(hp.max);
    const p = hp.max ? hp.cur / hp.max : 0;
    $('hp-pct').textContent = (p * 100).toFixed(1) + '%';
    const f = $('hp-fill');
    f.style.width = (p * 100).toFixed(1) + '%';
    f.className = p < 0.25 ? 'crit' : p < 0.5 ? 'low' : '';
  } else { $('hp-txt').textContent = '— / —'; $('hp-pct').textContent = ''; }
  // nível: o motor só o regista no arranque de cada ciclo (é o nível de então)
  const nivelCiclo = (cur && cur.setup && cur.setup.player && cur.setup.player.nivel)
    || (farm && farm.cycles && farm.cycles[0] && farm.cycles[0].setup && farm.cycles[0].setup.player && farm.cycles[0].setup.player.nivel)
    || null;
  const miniNivel = $('mini-nivel');
  miniNivel.textContent = nivelCiclo == null ? '—' : String(nivelCiclo);
  miniNivel.title = nivelCiclo == null ? 'O motor ainda não registou o nível' : 'Nível no início do ciclo actual (o valor exacto está no painel do jogo)';
  $('mini-ouro').textContent = fmt((plan && plan.gold) != null ? plan.gold : (status && status.ouro));
  $('mini-local').textContent = (plan && plan.location && plan.location.text) || (status && status.local) || '—';

  // combate
  const r = (status && status.rates) || {};
  const d = (status && status.dps) || {};
  $('combate').textContent = semJogo ? '—' : ('fazes ' + fmt(d.out || r.myDps || 0) + '/s · recebes ' + fmt(d.in || r.dmgRate || 0) + '/s · curas ' + fmt(r.healRate || 0) + '/s');
  const t = status && status.target;
  $('alvo').textContent = t ? ('alvo: ' + esc(t.name || '?') + (t.level ? ' nv ' + t.level : '') + (t.boss ? ' 👑 chefe' : '')) : 'sem alvo';

  // poções
  const min = (config.automation && config.automation.minPotion) || (config.minPotion) || { vida: 200, vidaF: 100, vidaS: 30 };
  const contagens = (plan && plan.potions) || {};
  for (const k of ORDER) {
    const el = document.querySelector('.pot[data-k="' + k + '"]');
    if (!el) continue;
    const ps = status && status.potions && status.potions[k];
    const n = ps ? ps.count : (contagens[k] != null ? Number(contagens[k]) : null);
    el.querySelector('b').textContent = n == null ? '—' : fmt(n);
    el.classList.toggle('baixo', n == null || n < (min[k] || 0));
    el.title = POCAO_NOME[k] + ' — mínimo ' + (min[k] || 0);
  }
  const a = status && status.lastAction;
  const planoPoc = plan && plan.potionPlan;
  const comprar = planoPoc && planoPoc.comprar ? ORDER.filter((k) => planoPoc.comprar[k] > 0).map((k) => POCAO_NOME[k] + ' ×' + fmt(planoPoc.comprar[k])).join(' · ') : '';
  $('ultima').textContent = (a ? ('última decisão: usou ' + (POCAO_NOME[a.k] || a.k) + ' — ' + (a.reason || '')) : 'sem acção ainda')
    + (comprar ? ' · em falta, vai comprar: ' + comprar : '');
  $('ultima').title = 'A auto-poção decide pelo golpe que o monstro acabou de dar, não por médias.';

  // avisos de ligação
  const aviso = $('rodape-aviso');
  if (semJogo) { aviso.className = 'aviso err'; aviso.textContent = 'Sem leitura do jogo' + (idadeMs != null ? ' (última há ' + fmtDur(idadeMs) + ')' : '') + '.'; }
  else { aviso.className = 'aviso'; aviso.textContent = 'Última leitura do jogo há ' + fmtDur(idadeMs) + '.'; }
}

function desenharControlos() {
  const ligado = !!config.enabled;
  $('on').checked = ligado;
  $('on-txt').textContent = ligado ? 'ligado' : 'desligado';
  const b = $('panic');
  b.textContent = ligado ? '⛔ PARAR TUDO' : '▶ RETOMAR TUDO';
  b.className = 'btn ' + (ligado ? 'danger' : 'ok');
  $('panic-ajuda').textContent = ligado
    ? 'Desliga o auto-play e a auto-poção imediatamente. O motor fica só a observar — nada é clicado no jogo.'
    : 'Volta a ligar o auto-play e a auto-poção. (A pausa do motor faz-se no painel dentro do jogo.)';
  $('obj').value = (config.automation && config.automation.objetivo) || 'xp';
  const fixa = !!(config.automation && config.automation.regionDefault);
  $('reg-modo').value = fixa ? 'fixa' : 'auto';
  $('reg-campo').classList.toggle('escondido', !fixa);
}

function desenharRegioes() {
  const sel = $('reg-id');
  if (sel.options.length) return;
  const locais = (meta && meta.locais) || [];
  const atual = (config.automation && config.automation.regionDefault) || null;
  sel.innerHTML = locais.map((l) => '<option value="' + l.id + '"' + (l.id === atual ? ' selected' : '') + '>' + limparNivel(l.nome) + '</option>').join('')
    || '<option value="">(o motor ainda não leu as regiões do jogo)</option>';
}

// ---------------------------------------------------------------- escrita
function gravarTopo(patch) {
  chrome.storage.local.get(STORAGE_KEY, (res) => {
    const cur = (res && res[STORAGE_KEY]) || {};
    const novo = Object.assign({}, cur, patch);
    chrome.storage.local.set({ [STORAGE_KEY]: novo }, () => {
      config = novo;
      desenharControlos();
      desenharEstado();
    });
  });
}
function gravarAutomation(patch) {
  const atual = (config.automation) || {};
  gravarTopo({ automation: Object.assign({}, atual, patch) });
}

// ---------------------------------------------------------------- eventos
$('on').addEventListener('change', (e) => {
  gravarTopo({ enabled: !!e.target.checked });
});
$('panic').addEventListener('click', () => {
  gravarTopo({ enabled: !config.enabled });
});
$('obj').addEventListener('change', (e) => {
  gravarAutomation({ objetivo: e.target.value });
});
$('reg-modo').addEventListener('change', (e) => {
  if (e.target.value === 'auto') gravarAutomation({ regionDefault: null });
  else {
    desenharRegioes();
    const sel = $('reg-id');
    gravarAutomation({ regionDefault: sel && sel.value ? sel.value : null });
  }
});
$('reg-id').addEventListener('change', (e) => {
  if ($('reg-modo').value === 'fixa') gravarAutomation({ regionDefault: e.target.value });
});

// ---------------------------------------------------------------- arranque
function lerTudo() {
  chrome.storage.local.get([STORAGE_KEY, STATUS_KEY, FARM_KEY, META_KEY, PLAN_KEY], (res) => {
    config = Object.assign({ enabled: true }, (res && res[STORAGE_KEY]) || {});
    status = (res && res[STATUS_KEY]) || null;
    farm = (res && res[FARM_KEY]) || null;
    meta = (res && res[META_KEY]) || null;
    plan = (res && res[PLAN_KEY]) || null;
    desenharRegioes();
    desenharControlos();
    desenharEstado();
  });
}
lerTudo();
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch[STORAGE_KEY]) { config = ch[STORAGE_KEY].newValue || {}; desenharControlos(); desenharEstado(); }
  if (ch[STATUS_KEY]) { status = ch[STATUS_KEY].newValue; desenharEstado(); }
  if (ch[FARM_KEY]) { farm = ch[FARM_KEY].newValue; desenharEstado(); }
  if (ch[META_KEY]) { meta = ch[META_KEY].newValue; desenharRegioes(); }
  if (ch[PLAN_KEY]) { plan = ch[PLAN_KEY].newValue; desenharEstado(); }
});
setInterval(desenharEstado, 1000);
