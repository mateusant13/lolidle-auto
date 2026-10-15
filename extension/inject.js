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
  // Campos MEDIDOS em combate (grupoSpawn/respawn), a CURVA avaliada por nível
  // (curvaPorNivel) e o RM_MONSTRO: tudo sai do motor, nunca de uma cópia à mão
  // (REGRA Nº 3 do AGENTS.md — ver tambem docs/auditoria-do-jogo.md P2-21).
  const meta = { monstros: null, locais: null, balanco: null, itens: null, ondeItem: null,
    pocoes: null, exaustao: null, pocaoPvp: null, noturno: null, furioso: null, gemas: null,
    recall: null, grupo: null, nivelMax: null, espacos: null, curva: null, curvaPorNivel: null,
    rmMonstro: null, kit: null, champ: null,
    rodizio: null, mecanicas: null, chefeHook: null, chefeHookErro: null, combateHook: null,
    kits: null, mochila: null, ciclo: null, fuso: null, grupoSpawn: null, respawn: null,
    eventosHook: null, eventoHookErro: null, syncHook: null, syncHookErro: null };
  // So o que passa limpo num postMessage: primitivo ou array de primitivos.
  // Um OBJECTO no meio de um campo desconhecido deitaria o postMessage abaixo
  // (DataCloneError) e o meta inteiro nunca chegava — daí o filtro de tipo.
  const prim = (v) => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
  const simples = (v) => v == null ? false : prim(v) || (Array.isArray(v) && v.every((e) => prim(e) || e == null));

  // Kit do campeao: so os campos serializaveis (funcoes nao passam por postMessage).
  // AUDITADO em docs/auditoria-do-jogo.md:263-269: este filtro descartava 34 campos
  // do kit, entre eles o `pen` do E do Darius (20%->45%, motor.js:560) que o MOTOR
  // aplica (motor.js:516 -> 539 -> 1202), o `ratioVida` do Zac (motor.js:825) e a
  // `voracidade` da Katarina (motor.js:736 -> 1789). Agora passam TODOS os campos
  // primitivos; funcoes e objectos continuam de fora.
  const serialKit = (K) => {
    if (!K) return null;
    const out = {};
    for (const t of Object.keys(K)) {
      const h = K[t]; if (!h || typeof h !== 'object') continue;
      const o = {};
      for (const c of Object.keys(h)) {
        const v = h[c];
        if (typeof v === 'function' || v == null) continue;   // funcao nao passa; null nao diz nada
        if (simples(v)) o[c] = Array.isArray(v) ? v.slice() : v;
        else if (typeof v !== 'object') o[c] = v;
      }
      out[t] = o;
    }
    return out;
  };
  // CURVA são FUNÇÕES (motor.js:273-279) e não passam por postMessage: avalio por
  // nível e mando os NÚMEROS. Assim um buff/nerf na curva chega sozinho (REGRA Nº 3).
  // Diferente da cópia de coeficientes que havia aqui, o `ajuste` da planilha
  // (motor.js:272, balanco) já entra DENTRO de cada valor — a curva real do jogo.
  const avaliarCurva = (M) => {
    try {
      const C = M.CURVA, max = Number(M.NIVEL_MAX) || 1, out = {};
      for (let n = 1; n <= max; n++) {
        const f = typeof M.ajuste === 'function' ? M.ajuste(n) : null;
        out[n] = {
          hp: +C.hp(n).toFixed(2), ad: +C.ad(n).toFixed(2), armadura: +C.armadura(n).toFixed(2),
          xp: +C.xp(n).toFixed(2), ouro: +C.ouro(n).toFixed(2),
          ajuste: f ? { de: f.de, ate: f.ate, vida: f.vida, dano: f.dano, xp: f.xp, ouro: f.ouro } : null,
        };
      }
      return out;
    } catch { return null; }   // sem curva: quem consome fica com o seu fallback
  };
  const enviarMeta = () => window.postMessage({ __lolidleAuto: 'meta', ...meta }, '*');
  import('https://lolidle.com/js/motor.js').then((M) => {
    meta.monstros = M.MONSTROS; meta.locais = M.LOCAIS;
    // dados de combate/poção direto do motor (sem hardcode!)
    meta.pocoes = M.POCOES; meta.exaustao = M.EXAUSTAO; meta.pocaoPvp = M.POCAO_PVP;
    meta.noturno = M.NOTURNO; meta.furioso = M.FURIOSO; meta.gemas = M.GEMAS;
    meta.recall = M.RECALL; meta.grupo = M.GRUPO; meta.nivelMax = M.NIVEL_MAX; meta.espacos = M.ESPACOS;
    meta.rodizio = M.RODIZIO_CHEFE || null; meta.mecanicas = M.MECANICAS || null;
    // CURVA: avaliada por nível em vez de coeficientes copiados à mão (inject.js:133)
    meta.curvaPorNivel = avaliarCurva(M);
    meta.rmMonstro = M.RM_MONSTRO;               // motor.js:1179 — RM dos monstros = 60% da armadura
    meta.mochila = { inicio: M.MOCHILA_INICIO, niveis: M.MOCHILA_GANHO.niveis, espacos: M.MOCHILA_GANHO.espacos };
    meta.ciclo = M.CICLO; meta.fuso = M.FUSO;
    meta.nivelDif = M.NIVEL_DIF || null;        // fator de nível (livre/+dano/cap/piso) — direto do motor
    meta.habChefe = M.HAB_CHEFE || null;         // carrega/espera de cada mecânica do chefe
    // grupoSpawn e respawn são LITERAIS INLINE no motor (motor.js:1124, :1625, :3046)
    // e não são exportados: a única forma de os LER (e não copiar) é MEDIR no estado
    // vivo. O wrap de `sincronizar` recebe o `combate` a cada tick e mede os dois;
    // quando mede, reenvia o meta. Até lá ficam null (quem consome usa o fallback).
    meta.grupoSpawn = null; meta.respawn = null;
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

  // ---- eventos do motor que DECIDEM (motor.js:1169: 71 tipos) ----
  // jogo.js:660 entrega a `Cena.evento()` tudo o que sobra do if-chain de processarEventos.
  // Os tipos desta lista são reencaminhados INTEIROS (tipo + payload) porque mudam
  // decisões: ouro/xp/itens de um abate (motor.js:1785), as larvas do Barão (motor.js:3119),
  // os procs de item (motor.js:2699-2730), morte (2785), nível (2806), poção (1305),
  // recall (3062) e a Mão do Barão (1784).
  // NÃO entram aqui porque jogo.js consome-os antes: 'tarefaPronta' (jogo.js:657),
  // 'chegouBase' (:651), 'renasceu' (:610) e os da Arena (:578-608) — só por DOM.
  const EV_DECIDEM = new Set(['abate', 'abateRoubado', 'buffBarao', 'bravata', 'chefeCarrega', 'chefeGolpe',
    'chefeInterrompido', 'chefeInvoca', 'divisao', 'fluxo', 'grupo', 'habilidade', 'item', 'kite', 'luden',
    'morreu', 'nivel', 'pocao', 'semPocao', 'recall', 'recallCancelado']);

  // ---- chefe: intercepta o AVISO de carga e o GOLPE (métodos da Cena) ----
  // O balão é desenhado via rotulo() com cache, então hookar fillText pega só a 1ª
  // vez de cada texto. Dar wrap no método da classe é robusto e pega toda carga.
  import('https://lolidle.com/js/cena.js').then(({ Cena }) => {
    const P = Cena && Cena.prototype;
    if (!P) { meta.chefeHook = false; meta.chefeHookErro = 'sem Cena.prototype'; enviarMeta(); return; }
    if (P.__lolidleChefe) {
      // re-injeção (o instalador é idempotente): os wraps do outro inject já estão postos.
      meta.chefeHook = true; meta.combateHook = true; meta.eventosHook = true; meta.syncHook = true; enviarMeta(); return;
    }
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
    // O `emitir` do motor espalha `dados` dentro do evento (motor.js:1169), por isso o
    // payload já vem todo no `ev`.
    try {
      const ac = { out: {}, tomou: 0, tipos: {}, since: Date.now() };
      let cenaLive = null;
      const flush = () => { const t = Date.now(), dt = t - ac.since; if (dt >= 400) { try { window.postMessage({ __lolidleAuto: 'combate', out: ac.out, tomou: ac.tomou, tipos: ac.tipos, dt, at: t }, '*'); } catch { /* ignore */ } ac.out = {}; ac.tomou = 0; ac.tipos = {}; ac.since = t; } };
      setInterval(flush, 400);
      const origEv = P.evento;
      if (typeof origEv === 'function' && !origEv.__lolidleEv) {
        P.evento = function (ev, combate) {
          try {
            cenaLive = this;
            const tipo = ev && ev.tipo;
            if (tipo === 'dano' && Number.isFinite(ev.valor)) { const f = ev.fonte || 'outro'; ac.out[f] = (ac.out[f] || 0) + ev.valor; }
            else if (tipo === 'recebido' && Number.isFinite(ev.valor)) ac.tomou += ev.valor;
            else if (tipo && EV_DECIDEM.has(tipo)) {
              // tipo que DECIDE: vai inteiro, na hora (não há agregado que perca o payload)
              const p = { __lolidleAuto: 'evento', tipo, t: ev.t, at: Date.now() };
              for (const k in ev) {
                if (k === 'tipo') continue;
                const v = ev[k];
                if (simples(v)) p[k] = Array.isArray(v) ? v.slice() : v;   // objectos ficam de fora (ver `simples`)
              }
              window.postMessage(p, '*');
            }
            if (tipo) ac.tipos[tipo] = (ac.tipos[tipo] || 0) + 1;   // e assim NENHUM dos 71 tipos se perde
          } catch { /* ignore */ }
          return origEv.apply(this, arguments);
        };
        P.evento.__lolidleEv = true;
        meta.eventosHook = true;
      } else { meta.eventosHook = false; meta.eventoHookErro = 'Cena.evento indisponivel'; }

      // barra de vida do CHEFE (fração 0..1) — fonte da verdade do HP do chefe
      setInterval(() => { try { const cb = cenaLive && cenaLive.chefeBarra; if (cb && Number.isFinite(cb.vida)) window.postMessage({ __lolidleAuto: 'chefe-hp', nome: cb.nome || 'chefe', vida: cb.vida, at: Date.now() }, '*'); } catch { /* ignore */ } }, 300);
      meta.combateHook = true;
    } catch (e) { meta.combateHook = false; }

    // ---- ESTADO VIVO DO COMBATE (motor.js:1053) ----
    // jogo.js:668-669 chama sincronizar/sincronizarArena com o `combate` INTEIRO a cada
    // tick do motor. É o ÚNICO canal que dá os números exactos do motor antes de
    // qualquer arredondamento de UI: a lista de inimigos com HP, acumulos, atordoado,
    // noAr, marca, noturno, elite, furioso, guardiao e o flag INVOCADO (motor.js:3118),
    // as recargas exactas (motor.js:1055), os timers de item (motor.js:2698-2730), o proc
    // do Lich (motor.js:1944/1688), a queima do jogador (motor.js:3105-3108) e o fôlego
    // do kite (motor.js:2680-2690). Nada disto existe no DOM nem no canvas —
    // observabilidade P0-1, P1-6, §4.1 e §4.2 de docs/observabilidade.md.
    try {
      const n1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
      const n0 = (v) => (Number.isFinite(v) ? Math.round(v) : null);

      // ---------- MEDIÇÃO das constantes que o motor tem como LITERAIS inline ----------
      // O respawn depois de limpar a wave (motor.js:1625 = 1,5) e ao trocar de local
      // (motor.js:3046 = 1,2) e o tamanho do grupo (motor.js:1124 = 2 + floor(r()*3)) NÃO
      // são exportados. A única forma de os LER — em vez de os copiar à mão, que é o que
      // fazia o inject.js:138-139 e o que a REGRA Nº 3 do AGENTS.md proíbe — é MEDIR no
      // estado vivo que já recebemos a cada tick. O relógio é o do próprio motor
      // (combate.tempo, motor.js:1337), não o do rAF: a medida não depende de quantos
      // quadros o navegador deu. Só no RIFT: em Runeterra/Arena (sincronizarArena) o
      // respawn tem outra semântica e medir ali daria lixo.
      const med = { clear: null, local: null, min: null, max: null, n: 0,
        vazioDesde: null, troca: false, localAntes: null, antes: -1 };
      function medirSpawn(combate, localId) {
        const n = combate.inimigos ? combate.inimigos.length : 0, t = combate.tempo;
        let trocou = false;
        if (med.localAntes == null) med.localAntes = localId;                       // 1º tick: só registar onde estamos
        else if (localId !== med.localAntes) {                                     // viajar(): motor.js:3046
          trocou = true; med.localAntes = localId;
          if (med.vazioDesde != null) { med.vazioDesde = t; med.troca = true; }     // o respawn reiniciou a 1,2
        }
        if (n > 0) {
          if (med.vazioDesde != null) {                                            // o grupo acabou de nascer (motor.js:1421)
            const dur = t - med.vazioDesde;
            if (dur > 0 && dur < 20) {
              if (med.troca) { if (med.local == null || dur > med.local) med.local = dur; }
              else if (med.clear == null || dur > med.clear) med.clear = dur;
            }
            med.vazioDesde = null; med.troca = false;
          }
          // um grupo NOVO é o salto 0 -> N. A onda de CHEFE tem 1 inimigo (motor.js:1121)
          // e não conta: se contasse, o "rand" medido sairia 0 em vez de 3.
          if (med.antes === 0 && !combate.inimigos.some((i) => i.chefe)) {
            med.min = med.min == null ? n : Math.min(med.min, n);
            med.max = med.max == null ? n : Math.max(med.max, n);
            med.n++;
          }
        } else if (med.vazioDesde == null && (med.antes > 0 || trocou)) {
          med.vazioDesde = t; med.troca = trocou;
          if (!trocou) med.clear = combate.respawn;          // valor EXACTO no tick da limpeza (motor.js:1625)
        }
        med.antes = n;
      }
      // Quando a medida está estável entra no META pelo caminho que o automation.js já
      // lê (META.grupoSpawn / META.respawn) — sem ninguém ter de copiar o número.
      function publicarMedidas() {
        // 20 grupos vistos: um grupo 2..4 que em 20 ondas ainda não mostrou os dois
        // extremos tem menos de 0,1% de hipótese. Antes disso a medida daria um "rand"
        // curto a mais e quem a usasse subestimaria os mobs por onda.
        if (med.n >= 20 && med.min != null) {
          const gs = { base: med.min, rand: (med.max - med.min + 1), min: med.min, max: med.max, n: med.n };
          if (!meta.grupoSpawn || meta.grupoSpawn.base !== gs.base || meta.grupoSpawn.rand !== gs.rand) {
            meta.grupoSpawn = gs; try { enviarMeta(); } catch { /* ignore */ }
          }
        }
        if (med.clear != null && med.local != null) {
          const rp = { clear: +med.clear.toFixed(2), local: +med.local.toFixed(2) };
          if (!meta.respawn || meta.respawn.clear !== rp.clear || meta.respawn.local !== rp.local) {
            meta.respawn = rp; try { enviarMeta(); } catch { /* ignore */ }
          }
        }
      }

      // ---------- snapshot ----------
      function snapshot(combate, cena, vida, mana) {
        const d = combate.darius || {};
        const inimigos = [];
        for (const i of combate.inimigos || []) {
          if (i.morto) continue;                          // o motor guarda o morto até limpar (motor.js:1755)
          inimigos.push({
            id: i.id, nome: i.nome, nivel: i.nivel,
            chefe: !!i.chefe, magico: !!i.magico,
            hp: n1(i.hp), hpMax: n0(i.hpMax), ad: n1(i.ad), as: n1(i.as), armadura: n1(i.armadura),
            ouro: n1(i.ouro), xp: n1(i.xp),
            acumulos: i.acumulos || 0, atordoado: n1(i.atordoado || 0), noAr: n1(i.noAr || 0),
            marca: n1(i.marca || 0), lento: n1(i.lento || 0),
            noturno: !!i.noturno, furioso: !!i.furioso, elite: !!i.elite,
            guardiao: i.guardiao != null, invocado: !!i.invocado,       // larvas do Barão: motor.js:3118
            distancia: i.distancia || 0, chegada: n1(i.chegada || 0),   // chegada<=0 = está encostado
            x: n1(i.x), y: n1(i.y),
            queimaT: n1((i.queima && i.queima.t) || 0), queimaDps: n1((i.queima && i.queima.dps) || 0),
            mec: i.mecAtual || null, tMec: n1(i.tMec || 0), carrega: n1(i.carregando || 0), furiaT: n1(i.furiaT || 0),
          });
        }
        const timers = {}, recargas = {};
        for (const k in (d.timers || {})) timers[k] = n1(d.timers[k]);        // zhonya/sterak/anjo/banshee/luden/couraca/quebra/pocao
        for (const k in (d.recargas || {})) recargas[k] = n1(d.recargas[k]);  // segundos EXACTOS de cada habilidade (motor.js:1055)
        return {
          v: 1, at: Date.now(), t: n1(combate.tempo),
          local: (cena && cena.local && cena.local.id) || null, arena: !!(cena && cena.arena),
          vida: Number.isFinite(vida) ? +Number(vida).toFixed(4) : null,
          mana: Number.isFinite(mana) ? +Number(mana).toFixed(4) : null,
          respawn: n1(combate.respawn),
          inimigos,
          darius: {
            recargas, timers,
            escudo: n0(d.escudo || 0), queimando: n1(d.queimando || 0), queimaDano: n0(d.queimaDano || 0),
            lich: !!d.lich, folego: n1(d.folego), invulneravel: n1(d.invulneravel || 0),
            morto: n1(d.morto || 0), recall: n1(d.recall || 0), ataque: n1(d.ataque || 0),
            poder: d.poder || 0, disciplina: d.disciplina || 0,
            grito: !!d.grito, furiaS: !!d.furiaS, estandarte: !!d.estandarte, wPronto: !!d.wPronto,
            solarT: n1(d.solarT || 0), kiteCd: n1(d.kiteCd || 0),
          },
          spawn: { clear: med.clear, local: med.local, min: med.min, max: med.max, n: med.n },
        };
      }

      // ---------- CADÊNCIA ----------
      // O motor chama estes dois métodos em TODOS os ticks (20 Hz, jogo.js:30/1564).
      // Mandar o combate inteiro 20 vezes por segundo seriam 20 mensagens/s a repetir
      // listas. Regra adoptada: publicar IMEDIATAMENTE quando a ESTRUTURA do combate
      // muda (um inimigo nasce ou morre, fica atordoado ou no ar, é invocado, o chefe
      // troca de mecânica, o campeão morre ou entra em recall) e, nos ticks em que nada
      // muda estruturalmente, a cada 250 ms como batimento para refrescar o HP e as
      // recargas (que andam sempre). Porquê 250 ms e não os 400 ms do agregado de dano:
      // aquele só conta dano agregado; este é o estado todo e quem consome decide a
      // 2-10 Hz — a janela de decisão que importa (skill a <1 s de recarga,
      // observabilidade P0-3) precisa de um estado fresco. 4 msg/s com listas de <=10
      // inimigos é desprezível ao lado das 20 chamadas que já recebemos por segundo.
      const CAD = 250;
      const sinc = { ultimo: 0, assin: '', med: med };
      function assinatura(combate, cena) {
        const d = combate.darius || {};
        let s = '';
        for (const i of combate.inimigos || []) {
          if (i.morto) continue;
          s += i.id + (i.chefe ? 'C' : '') + (i.invocado ? 'I' : '') + (i.furioso ? 'F' : '') + (i.noturno ? 'N' : '')
            + (i.elite ? 'E' : '') + (i.guardiao != null ? 'G' : '') + (i.atordoado > 0 ? 'A' : '') + (i.noAr > 0 ? 'R' : '')
            + (i.chegada <= 0 ? 'P' : '') + (i.mecAtual || '') + (i.carregando > 0 ? 'c' : '') + ',';
        }
        return s + '|' + (d.morto > 0 ? 1 : 0) + (d.recall > 0 ? 1 : 0) + (cena && cena.local && cena.local.id);
      }
      function publicarEstado(combate, cena, vida, mana, arena) {
        if (!arena) medirSpawn(combate, cena && cena.local && cena.local.id);   // as medidas são do Rift
        const agora = Date.now(), a = assinatura(combate, cena);
        if (a !== sinc.assin || agora - sinc.ultimo >= CAD) {
          sinc.assin = a; sinc.ultimo = agora;
          try { window.postMessage(Object.assign({ __lolidleAuto: 'estado' }, snapshot(combate, cena, vida, mana)), '*'); } catch { /* ignore */ }
        }
        if (!arena) publicarMedidas();
      }

      const wrapSync = (metodo, arena) => {
        const orig = P[metodo];
        if (typeof orig !== 'function') { meta.syncHook = false; meta.syncHookErro = 'sem metodo ' + metodo; return; }
        P[metodo] = function (combate, vida, mana) {
          try { if (combate && combate.inimigos) publicarEstado(combate, this, vida, mana, arena); } catch { /* nunca quebra o jogo */ }
          return orig.apply(this, arguments);
        };
        meta.syncHook = true;
      };
      wrapSync('sincronizar', false);        // Rift
      wrapSync('sincronizarArena', true);    // Runeterra e Arena
    } catch (e) { meta.syncHook = false; meta.syncHookErro = String(e); }

    P.__lolidleChefe = true;
    meta.chefeHook = true; enviarMeta();
  }).catch((e) => { meta.chefeHook = false; meta.chefeHookErro = String(e); enviarMeta(); });

  window.addEventListener('message', (e) => { if (e.data && e.data.__lolidleAuto === 'pedir-meta') enviarMeta(); });
})();
