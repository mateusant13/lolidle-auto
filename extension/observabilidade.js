/*
 * LoL Idle — observabilidade dos inimigos (HP REAL do motor)
 *
 * Porque existe: o painel já mostrava o alvo e o `%` do chefe, mas não o HP de
 * cada monstro. O `inject.js:498-501` publica a lista completa (`hp`, `hpMax`,
 * `chefe`, `furioso`, `elite`, `noturno`, `chegada`...) e o `automation.js:1181`
 * guarda-a em `estadoVivo()`. Aqui só se DESENHA — não se decide nada, não se
 * clica em nada, não se altera o jogo.
 *
 * Regra do AGENTS: número lido, nunca copiado. Tudo vem de `estadoVivo()`.
 */
(() => {
  'use strict';
  if (window.__lolidleObsInimigos) return;
  window.__lolidleObsInimigos = true;

  const CSS = ''
    + '#lolidle-hp-inimigos .lolidle-lista{display:flex;flex-direction:column;gap:4px;margin-top:4px}'
    + '#lolidle-hp-inimigos .lolidle-ini{padding:5px 7px;border:1px solid rgba(255,255,255,.12);border-radius:6px}'
    + '#lolidle-hp-inimigos .lolidle-ini-topo{display:flex;justify-content:space-between;gap:8px;font-size:12px;line-height:1.35}'
    + '#lolidle-hp-inimigos .lolidle-ini-topo small{opacity:.7}'
    + '#lolidle-hp-inimigos .lolidle-tags b{font-size:9px;letter-spacing:.4px;padding:1px 4px;border-radius:3px;background:rgba(255,120,80,.18);color:#ffb080;margin-left:3px}'
    + '#lolidle-hp-inimigos .lolidle-ini-num{white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '#lolidle-hp-inimigos .lolidle-barra{height:5px;background:rgba(0,0,0,.45);border-radius:3px;overflow:hidden;margin-top:4px}'
    + '#lolidle-hp-inimigos .lolidle-barra i{display:block;height:100%;border-radius:3px;transition:width .12s linear}';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const num = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return Math.round(v).toLocaleString('pt-BR');
  };

  const pct = (hp, max) => {
    const a = Number(hp), b = Number(max);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
    return Math.max(0, Math.min(100, (a / b) * 100));
  };

  // cor da barra: mesma leitura do jogo (verde > 50%, amarelo > 25%, vermelho)
  const cor = (p) => (p > 50 ? '#40e060' : p > 25 ? '#ffd84a' : '#ff5050');

  const tagsDe = (i) => {
    const tags = [];
    if (i.chefe) tags.push('CHEFE');
    if (i.guardiao) tags.push('guardião');
    if (i.furioso) tags.push('furioso');
    if (i.elite) tags.push('elite');
    if (i.noturno) tags.push('noturno');
    if (i.invocado) tags.push('invocado');
    if (Number(i.chegada) > 0) tags.push('chegando');
    return tags;
  };

  function linha(i) {
    const p = pct(i.hp, i.hpMax);
    const tags = tagsDe(i);
    const nome = esc(i.nome || '?');
    const nv = Number.isFinite(Number(i.nivel)) ? ' <small>nv ' + esc(i.nivel) + '</small>' : '';
    const tagHtml = tags.length
      ? ' <span class="lolidle-tags">' + tags.map((t) => '<b>' + esc(t) + '</b>').join(' ') + '</span>'
      : '';
    return '<div class="lolidle-ini">'
      + '<div class="lolidle-ini-topo"><span>' + nome + nv + tagHtml + '</span>'
      + '<span class="lolidle-ini-num">' + num(i.hp) + ' / ' + num(i.hpMax) + ' <b>(' + p.toFixed(0) + '%)</b></span></div>'
      + '<div class="lolidle-barra"><i style="width:' + p.toFixed(1) + '%;background:' + cor(p) + '"></i></div>'
      + '</div>';
  }

  function avisoContrato() {
    const auto = window.__lolidleAuto;
    let m = null;
    try { m = auto && typeof auto.getMeta === 'function' ? auto.getMeta() : null; } catch { m = null; }
    const c = m && m.contrato;
    if (!c || c.ok !== false) return '';
    const falta = Array.isArray(c.faltando) && c.faltando.length
      ? ' Faltando: <b>' + c.faltando.map(esc).join(', ') + '</b>.'
      : '';
    return '<p class="aviso err">⚠ Patch do jogo: o contrato mudou.' + falta + ' O auto-play usa os fallbacks declarados; confirme os números antes de confiar.</p>';
  }

  function corpo() {
    const auto = window.__lolidleAuto;
    if (!auto || typeof auto.estadoVivo !== 'function') {
      return '<p class="vazio">O motor ainda não publicou o estado vivo.</p>';
    }
    let e = null;
    try { e = auto.estadoVivo(); } catch { e = null; }
    if (!e || !Array.isArray(e.inimigos)) {
      return '<p class="vazio">Sem leitura do motor (o `inject.js` ainda não correu ou a página está a carregar).</p>';
    }
    const fresco = Number.isFinite(Number(e.at)) && (Date.now() - Number(e.at) < 4000);
    const lista = e.inimigos
      .filter((i) => i && Number(i.hp) > 0)
      .sort((a, b) => (Number(!!b.chefe) - Number(!!a.chefe))
        || (Number(!!b.guardiao) - Number(!!a.guardiao))
        || (Number(a.chegada || 0) - Number(b.chegada || 0))
        || (Number(a.hp) / Math.max(1, Number(a.hpMax)) - Number(b.hp) / Math.max(1, Number(b.hpMax))));

    const vivo = window.__lolidleLive || null;
    const chefeBarra = vivo && vivo.bossHp && (Date.now() - Number(vivo.at || 0) < 3500) ? vivo.bossHp : null;

    if (!lista.length) {
      const respawn = Number(e.respawn);
      const espera = Number.isFinite(respawn) && respawn > 0
        ? ' O próximo grupo chega em <b>' + respawn.toFixed(1) + ' s</b>.'
        : '';
      return avisoContrato()
        + '<p class="vazio">Nenhum inimigo vivo agora.' + espera + '</p>'
        + (chefeBarra ? '<p class="aviso warn">Chefe <b>' + esc(chefeBarra.nome || '') + '</b> com <b>' + esc(chefeBarra.pct) + '%</b> de vida.</p>' : '');
    }

    return avisoContrato()
      + (fresco ? '' : '<p class="aviso warn">Leitura antiga (o motor parou de publicar há mais de 4 s).</p>')
      + '<div class="lolidle-lista">' + lista.map(linha).join('') + '</div>'
      + (chefeBarra && !lista.some((i) => i.chefe)
        ? '<p class="aviso warn">Chefe <b>' + esc(chefeBarra.nome || '') + '</b> com <b>' + esc(chefeBarra.pct) + '%</b> de vida.</p>'
        : '')
      + '<p class="hint">HP e vida máxima lidos do motor (`inject.js:498-501`); a barra do jogo só desenha a fração.</p>';
  }

  function criarBox(alvo) {
    const box = document.createElement('div');
    box.id = 'lolidle-hp-inimigos';
    const st = document.createElement('style');
    st.id = 'lolidle-hp-inimigos-estilo';
    st.textContent = CSS;
    const card = document.createElement('div');
    card.id = 'lolidle-hp-inimigos-card';
    box.appendChild(st);
    box.appendChild(card);
    alvo.insertAdjacentElement('afterend', box);
    return card;
  }

  function montar() {
    const alvo = document.getElementById('ap-now-combate');
    if (!alvo) return false;
    let box = document.getElementById('lolidle-hp-inimigos');
    if (!box) {
      criarBox(alvo);
      box = document.getElementById('lolidle-hp-inimigos');
    }
    let card = document.getElementById('lolidle-hp-inimigos-card');
    if (!card || !box.contains(card)) {
      box.innerHTML = '';
      const st = document.createElement('style');
      st.id = 'lolidle-hp-inimigos-estilo';
      st.textContent = CSS;
      card = document.createElement('div');
      card.id = 'lolidle-hp-inimigos-card';
      box.appendChild(st);
      box.appendChild(card);
    }
    const html = '<section class="card"><h3>HP dos inimigos <span class="obs">lido do motor, não da barra desenhada</span></h3><div class="corpo">'
      + corpo() + '</div></section>';
    if (card.dataset.html !== html) {
      card.dataset.html = html;
      card.innerHTML = html;
    }
    return true;
  }

  function tick() {
    try { montar(); } catch { /* a GUI mandou; nunca derrubar a página */ }
  }

  // o painel pode ser montado depois (GUI carrega no document_idle); tenta até existir
  let tentativas = 0;
  const timer = setInterval(() => {
    tick();
    if (++tentativas > 120 && document.getElementById('lolidle-hp-inimigos')) clearInterval(timer);
  }, 500);
  if (document.readyState !== 'loading') tick();

  // re-monta se a GUI reconstruir o painel (ex.: troca de aba que recria o card)
  try {
    const mo = new MutationObserver(() => { if (!document.getElementById('lolidle-hp-inimigos')) tick(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch { /* ignore */ }
})();
