/*
 * LoL Idle — Auto Poção · inject.js  (world: MAIN)
 *
 * Este script corre no MUNDO DA PÁGINA e é o único ponto onde a extensão consegue
 * ler o motor. Publica por window.postMessage; o content.js (mundo isolado) escuta
 * e entrega ao automation.js.
 *
 * -------------------------------------------------------------------------
 * O QUE PUBLICA (três canais; os defeitos observados estão em docs/observabilidade.md)
 * -------------------------------------------------------------------------
 * 1. CANVAS — hook de fillText (cena.js desenha dano/cura/escudo/mana no #tela,
 *    não no DOM). Mensagem: __lolidle {value, color, x, y} com tipo dmg|heal|mana|shield.
 *
 * 2. EVENTOS — wrap de Cena.prototype.evento (o motor entrega o evento em
 *    jogo.js:660). São 71 tipos no motor (motor.js:1169) e só 2 passavam
 *    (observabilidade P0-2). Agora: "dano"/"recebido" continuam no agregado
 *    (combate, 400 ms), os tipos que DECIDEM são reencaminhados inteiros
 *    (evento) e todos os outros são contados por tipo no mesmo combate.
 *
 * 3. ESTADO VIVO — wrap de Cena.prototype.sincronizar e sincronizarArena
 *    (cena.js:671 e :732). jogo.js:668-669 entrega o combate INTEIRO (motor.js:1053)
 *    a cada tick do motor (20 Hz — DT=0.05 em jogo.js:30, jogo.js:1564). É a única
 *    fonte dos números EXACTOS do motor antes de qualquer arredondamento de UI
 *    (observabilidade P0-1, P1-6, §4.1 e §4.2). Publica "estado" com a cadência
 *    explicada no bloco CADÊNCIA mais abaixo.
 *
 * 4. META — tabelas do próprio motor (motor.js, balanco.js, itens.js, wiki-dados.js),
 *    importadas do módulo (o automation.js não pode usar eval por CSP). Inclui a
 *    CURVA AVALIADA por nível (motor.js:273-279 são funções, não passam por
 *    postMessage) e as constantes que o motor guarda como LITERAIS inline, que
 *    são MEDIDAS no estado vivo em vez de copiadas (REGRA Nº 3 do AGENTS.md).
 */
(() => {
  'use strict';

  const HEAL = '#40e060';
  const MANA = '#5aa8ff';
  // Escudos usam vários tons de verde/azul claro (#c8ff8a, #ffe8f8, #bfe8ff,
  // #d8f0ff, #c8f8ff, #ffe27a, #a6f06a). Tudo que começa com '+' e não é cura
  // nem mana conta como escudo.
  const SHIELD = new Set(['#c8ff8a', '#ffe8f8', '#bfe8ff', '#d8f0ff', '#c8f8ff', '#ffe27a', '#a6f06a']);

  /** '#40e060' ou 'rgb(64,224,96)' -> '#40e060' */
  function norm(color) {
    const c = String(color || '').trim().toLowerCase();
    if (c.startsWith('#')) return c;
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return c;
    const h = (n) => Number(n).toString(16).padStart(2, '0');
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }

  /** '1.234' / '1,234' / '1 234' -> 1234 */
  function toNum(s) {
    const digits = String(s).replace(/[^\d]/g, '');
    return digits ? Number(digits) : NaN;
  }

  const NUM = /^\d[\d.,\s]*$/;
  const HEAL_TXT = /^\+\s*\d[\d.,\s]*$/;

  // O jogo REDESENHA o mesmo número flutuante (mesmo dano/cura) várias vezes por
  // segundo no canvas. Sem dedupe, cada número conta 3-4× e INFLA a taxa de cura —
  // foi isso que fez o smart achar que estava "seguro" e não usar poção (morte no Dragão).
  const _vistos = [];
  function repetido(key) {
    const now = Date.now();
    while (_vistos.length && now - _vistos[0].t > 120) _vistos.shift();   // janela de 120 ms
    for (const r of _vistos) if (r.key === key) return true;
    _vistos.push({ t: now, key });
    if (_vistos.length > 240) _vistos.shift();
    return false;
  }

  // Só o canvas do mundo (#tela) tem números de combate. Assim o dano é pego
  // mesmo quando a skin tinge a cor.
  function report(text, color, canvas, x, y) {
    const t = String(text == null ? '' : text).trim();
    if (!t || t.length > 12) return;
    if (canvas && canvas.id && canvas.id !== 'tela') return;
    const col = norm(color);
    let tipo = null;
    if (HEAL_TXT.test(t)) tipo = col === HEAL ? 'heal' : col === MANA ? 'mana' : 'shield';
    else if (NUM.test(t)) tipo = 'dmg';
    else return;
    const v = toNum(t);
    if (!Number.isFinite(v) || v <= 0) return;
    // dedupe: mesmo tipo+valor na mesma posição (quantizada) em <120 ms = mesmo número
    const key = tipo + '|' + v + '|' + Math.round((x || 0) / 12) + '|' + Math.round((y || 0) / 12);
    if (repetido(key)) return;
    window.postMessage({ __lolidle: tipo, value: v, color: col, x, y }, '*');
  }

  function hook(proto, method, styleProp) {
    if (!proto || typeof proto[method] !== 'function' || proto[method].__lolidle) return;
    const orig = proto[method];
    const wrapped = function (text, x, y, ...rest) {
      try { report(text, this[styleProp], this.canvas, x, y); } catch { /* nunca quebra o jogo */ }
      return orig.call(this, text, x, y, ...rest);
    };
    wrapped.__lolidle = true;
    proto[method] = wrapped;
  }

  // Só fillText: o jogo desenha cada número com strokeText (contorno) + fillText
  // (preenchimento). Hookar os dois contaria cada número duas vezes.
  hook(CanvasRenderingContext2D.prototype, 'fillText', 'fillStyle');
  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
    hook(OffscreenCanvasRenderingContext2D.prototype, 'fillText', 'fillStyle');
  }
  // ---- meta do jogo (monstros/locais/balanço) para a camada de dados ----
  // O automation.js (mundo isolado) não pode usar eval (CSP), então importamos
  // os próprios módulos do jogo aqui (mundo MAIN) e mandamos por postMessage.
  const meta = { monstros: null, locais: null, balanco: null, itens: null, ondeItem: null,
    pocoes: null, exaustao: null, pocaoPvp: null, noturno: null, furioso: null, gemas: null,
    recall: null, grupo: null, nivelMax: null, espacos: null, curva: null, kit: null, champ: null,
    rodizio: null, mecanicas: null, chefeHook: null, chefeHookErro: null, combateHook: null,
    kits: null, mochila: null, ciclo: null, fuso: null, grupoSpawn: null };
  // Kit do campeão: só os campos serializáveis (funções não passam por postMessage).
  const serialKit = (K) => {
    if (!K) return null;
    const out = {};
    for (const t of Object.keys(K)) {
      const h = K[t]; if (!h || typeof h !== 'object') continue;
      const o = {};
      for (const c of ['nivel', 'max', 'base', 'ratio', 'recarga', 'adRatio', 'mult', 'alvos', 'duracao', 'golpes',
        'venenoBase', 'venenoRatio', 'venenoT', 'vaAdaga', 'acumMax', 'duracaoSinistra', 'curaGiro',
        'adaga', 'auto', 'dot', 'passiva', 'util']) {
        const v = h[c];
        if (v == null || typeof v === 'function') continue;
        o[c] = Array.isArray(v) ? v.slice() : v;
      }
      out[t] = o;
    }
    return out;
  };
  const enviarMeta = () => window.postMessage({ __lolidleAuto: 'meta', ...meta }, '*');
  import('https://lolidle.com/js/motor.js').then((M) => {
    meta.monstros = M.MONSTROS; meta.locais = M.LOCAIS;
    // dados de combate/poção direto do motor (sem hardcode!)
    meta.pocoes = M.POCOES; meta.exaustao = M.EXAUSTAO; meta.pocaoPvp = M.POCAO_PVP;
    meta.noturno = M.NOTURNO; meta.furioso = M.FURIOSO; meta.gemas = M.GEMAS;
    meta.recall = M.RECALL; meta.grupo = M.GRUPO; meta.nivelMax = M.NIVEL_MAX; meta.espacos = M.ESPACOS;
    meta.rodizio = M.RODIZIO_CHEFE || null; meta.mecanicas = M.MECANICAS || null;
    // CURVA são funções (não passam por postMessage) → mando os coeficientes
    meta.curva = { hp: [150, 100, 1], ad: [9, 4.8, 0.13], armadura: [5, 1.5], xp: [30, 7], ouro: [8, 3.5] };
    meta.mochila = { inicio: M.MOCHILA_INICIO, niveis: M.MOCHILA_GANHO.niveis, espacos: M.MOCHILA_GANHO.espacos };
    meta.ciclo = M.CICLO; meta.fuso = M.FUSO;
    meta.nivelDif = M.NIVEL_DIF || null;        // fator de nível (livre/+dano/cap/piso) — direto do motor
    meta.habChefe = M.HAB_CHEFE || null;         // carrega/espera de cada mecânica do chefe
    meta.grupoSpawn = { base: 2, rand: 3 };   // qtd = 2 + floor(rand*3) (inline no motor)
    meta.respawn = { clear: 1.5, local: 1.2 };   // motor.js: respawn=1.5 (wave limpa) e 1.2 (troca de local)
    meta.modelos = M.MODELOS || null;            // pesos de distribuição de atributos (tanque/equilibrado/dano/conjurador)
    meta.dicaAtributos = M.DICA_ATRIBUTOS || null;   // modelo sugerido por campeão
    // TODOS os campeões (kit serializado + stats). O atual é detectado pelo ícone da skill.
    meta.kits = {};
    if (M.KITS) for (const id of Object.keys(M.KITS)) {
      const K = M.KITS[id];
      if (!K || !K.hab) continue;
      meta.kits[id] = { kit: serialKit(K.hab), adBase: K.adBase, adNivel: K.adNivel, magia: !!K.magia, semMana: !!K.semMana, adagas: !!K.adagas, distancia: !!K.distancia, papel: K.papel || null, giroSrc: K.hab.P && K.hab.P.giro ? String(K.hab.P.giro) : null, ordem: K.ordem || null };
    }
    // kit do campeão (Katarina): base/ratio/recarga + stats base
    const K = M.KITS && M.KITS.katarina;
    if (K) {
      meta.kit = serialKit(K.hab);
      meta.champ = { id: K.id, adBase: K.adBase, adNivel: K.adNivel, magia: !!K.magia, semMana: !!K.semMana, adagas: !!K.adagas, distancia: !!K.distancia, papel: K.papel || null, ordem: K.ordem || null };
      meta.ordemHab = K.ordem || null;   // ordem OFICIAL de subir habilidade deste campeão (motor)
    }
    meta.bonusTwitch = M.bonusTwitchAtual ? M.bonusTwitchAtual() : null;
    meta.bonusEvento = M.eventoXpAtual ? M.eventoXpAtual() : null;
    enviarMeta();
  }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));
  import('https://lolidle.com/js/balanco.js').then((B) => { meta.balanco = B.BALANCO; enviarMeta(); }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));
  import('https://lolidle.com/js/itens.js').then((I) => { meta.itens = I.ITENS_DADOS; enviarMeta(); }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));
  import('https://lolidle.com/js/wiki-dados.js').then((W) => { meta.ondeItem = W.ONDE_ITEM; enviarMeta(); }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));

  // ---- chefe: intercepta o AVISO de carga e o GOLPE (métodos da Cena) ----
  // O balão é desenhado via rotulo() com cache, então hookar fillText pega só a 1ª
  // vez de cada texto. Dar wrap no método da classe é robusto e pega toda carga.
  import('https://lolidle.com/js/cena.js').then(({ Cena }) => {
    const P = Cena && Cena.prototype;
    if (!P) { meta.chefeHook = false; meta.chefeHookErro = 'sem Cena.prototype'; enviarMeta(); return; }
    if (P.__lolidleChefe) { meta.chefeHook = true; enviarMeta(); return; }
    const wrap = (metodo, tipo) => {
      const orig = P[metodo];
      if (typeof orig !== 'function') { meta.chefeHook = false; meta.chefeHookErro = 'sem metodo ' + metodo; enviarMeta(); return; }
      P[metodo] = function (v, d, mec, extra) {
        try { window.postMessage({ __lolidleAuto: tipo, mec, dur: typeof extra === 'number' ? extra : null }, '*'); } catch { /* ignore */ }
        return orig.apply(this, arguments);
      };
    };
    wrap('chefeCarregaRift', 'carga');   // o chefe começou a carregar (mec, dur)
    wrap('chefeGolpeRift', 'golpe');     // o golpe do chefe saiu (mec)
    // ---- EVENTOS DE COMBATE do jogo = FONTE DA VERDADE do dano ----
    // Cena.evento(ev): ev.tipo 'dano' (NOSSO dano, com ev.fonte = Q/W/E/R/A/T/M/ataque/queima/item)
    // e 'recebido' (dano que tomamos). Nada de canvas: é o dano realmente aplicado.
    try {
      const ac = { out: {}, tomou: 0, since: Date.now() };
      let cenaLive = null;
      const flush = () => { const t = Date.now(), dt = t - ac.since; if (dt >= 400) { try { window.postMessage({ __lolidleAuto: 'combate', out: ac.out, tomou: ac.tomou, dt, at: t }, '*'); } catch { /* ignore */ } ac.out = {}; ac.tomou = 0; ac.since = t; } };
      setInterval(flush, 400);
      const origEv = P.evento;
      if (typeof origEv === 'function' && !origEv.__lolidleEv) {
        P.evento = function (ev, combate) {
          try {
            cenaLive = this;
            if (ev && ev.tipo === 'dano' && Number.isFinite(ev.valor)) { const f = ev.fonte || 'outro'; ac.out[f] = (ac.out[f] || 0) + ev.valor; }
            else if (ev && ev.tipo === 'recebido' && Number.isFinite(ev.valor)) ac.tomou += ev.valor;
          } catch { /* ignore */ }
          return origEv.apply(this, arguments);
        };
        P.evento.__lolidleEv = true;
      }
      // barra de vida do CHEFE (fração 0..1) — fonte da verdade do HP do chefe
      setInterval(() => { try { const cb = cenaLive && cenaLive.chefeBarra; if (cb && Number.isFinite(cb.vida)) window.postMessage({ __lolidleAuto: 'chefe-hp', nome: cb.nome || 'chefe', vida: cb.vida, at: Date.now() }, '*'); } catch { /* ignore */ } }, 300);
      meta.combateHook = true;
    } catch (e) { meta.combateHook = false; }
    P.__lolidleChefe = true;
    meta.chefeHook = true; enviarMeta();
  }).catch((e) => { meta.chefeHook = false; meta.chefeHookErro = String(e); enviarMeta(); });
  window.addEventListener('message', (e) => { if (e.data && e.data.__lolidleAuto === 'pedir-meta') enviarMeta(); });
})();
