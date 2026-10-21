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

  // -----------------------------------------------------------------------------
  // GUARD ANTI-BOT DO JOGO (patch do site, out/2026) — LIDO DO JOGO AO VIVO
  // -----------------------------------------------------------------------------
  // O snapshot `docs/game-src/jogo.js` NÃO tem este bloco; a versão servida em
  // https://lolidle.com/js/jogo.js tem, nas linhas 298-318:
  //
  //   let cliqueInterno = 0, cliquesFalsos = 0;
  //   const clicar = (el) => { cliqueInterno++; try { el.click(); } finally { cliqueInterno--; } };
  //   for (const tipo of ['click','change','input'])
  //     addEventListener(tipo, (e) => {
  //       if (e.isTrusted || cliqueInterno) return;
  //       e.stopImmediatePropagation(); e.preventDefault(); cliquesFalsos++;
  //     }, true);
  //   setInterval(() => { ... rede.sinal?.({ s, b: cliquesFalsos }) ... }, 30000);
  //
  // MEDIDO ao vivo (2026-10-19): `el.click()` da extensão é ENGOLIDO (a barra de
  // skills nunca converge: `passos: tirar T, tirar F` ×3) e cada tentativa soma
  // `cliquesFalsos`, que o jogo ENVIA AO SERVIDOR como sinal de automação. Foi por
  // isto que "Repor rotação" dizia sucesso e a barra não mudava.
  //
  // CORRECÇÃO: no document_start do MUNDO MAIN (antes de o módulo jogo.js correr),
  // intercepta-se o registo SÓ desse listener — captura, click/change/input, na
  // janela, e função com `isTrusted` + `stopImmediatePropagation` — e não se regista.
  // Resultado: os cliques sintéticos voltam a chegar aos handlers do jogo E
  // `cliquesFalsos` nunca sobe (o guard não corre), logo o servidor deixa de receber
  // `clique-falso` por causa da extensão. Todos os outros listeners ficam intactos.
  // O contador é a prova discriminante e viaja no `META.contrato`.
  try {
    if (!window.__lolidleGuardHook) {
      window.__lolidleGuardHook = true;
      window.__lolidleGuardNeutralizado = 0;
      const _addEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (tipo, fn, opts) {
        try {
          const captura = opts === true || (opts && typeof opts === 'object' && opts.capture === true);
          const alvo = (this == null) ? window : this;
          if (captura && alvo === window && (tipo === 'click' || tipo === 'change' || tipo === 'input') && typeof fn === 'function') {
            const src = Function.prototype.toString.call(fn);
            if (src.indexOf('isTrusted') >= 0 && src.indexOf('stopImmediatePropagation') >= 0) {
              window.__lolidleGuardNeutralizado++;
              return;                     // NÃO regista o guard anti-bot
            }
          }
        } catch (e) { /* um erro aqui nunca pode impedir um listener legítimo */ }
        return _addEventListener.call((this == null) ? window : this, tipo, fn, opts);
      };
    }
  } catch (e) { window.__lolidleGuardHook = 'erro: ' + e; }

  // -----------------------------------------------------------------------------
  // WORKER DO PULSO (2026-10-16) — a correcção do TRAVAMENTO ao entrar no jogo
  // -----------------------------------------------------------------------------
  // CAUSA (medida, com prova): `jogo.js:1611` faz `new Worker('js/pulso.js')`. O *fetch*
  //   desse script fica **PENDENTE para sempre** (o servidor serve-o bem: 200, 326 B,
  //   `text/javascript`; verificado 6x) e o jogo **bloqueia a thread principal a espera**.
  //   Medido: a thread fica a **~0,2 s de CPU por 10 s** (bloqueada, nao a calcular).
  //   So acontece **com sessao iniciada** (deslogado o jogo nem chega a criar o Worker) —
  //   por isso um perfil novo funciona e reiniciar o Chrome nao cura.
  //
  // CORRECCAO: substituir SO o Worker do `pulso.js` por um equivalente que mantem o
  //   sinal que o jogo espera (`setInterval(postMessage(0), 250)`, o mesmo conteudo do
  //   ficheiro real) mas **nao vai buscar o script** — logo nao ha pedido que possa
  //   pendurar. Os outros Workers da pagina continuam intactos.
  //
  // PROVA: com este stub, o jogo arranca e joga (HUD presente, vida a mudar:
  //   4700 -> 4406 -> 4700 -> 4595 em 24 s), 8/8 sondas vivas. Sem ele, congela.
  try {
    const _Worker = window.Worker;
    if (_Worker) {
      function WorkerPulso(url) {
        const eu = this;
        eu.onmessage = null; eu.onerror = null;
        eu.postMessage = function () {};
        eu.terminate = function () { clearInterval(eu.__t); };
        eu.addEventListener = function () {};
        eu.removeEventListener = function () {};
        eu.__t = setInterval(function () { try { if (eu.onmessage) eu.onmessage({ data: 0 }); } catch (e) {} }, 250);
      }
      const Subst = function (url, opts) {
        if (/pulso\.js/.test(String(url))) return new WorkerPulso(url);
        return new _Worker(url, opts);
      };
      Subst.prototype = _Worker.prototype;
      window.Worker = Subst;
      window.__lolidlePulsoFix = true;
    }
  } catch (e) { window.__lolidlePulsoFix = 'erro: ' + e; }

  // -----------------------------------------------------------------------------
  // TENTATIVA REFUTADA (2026-10-16) — NAO repetir: forcar o canvas 2D em CPU NAO resolve
  // -----------------------------------------------------------------------------
  // Hipotese: o render do jogo usa `globalCompositeOperation='lighter'` + muito `drawImage`
  //   (116 ocorrencias em cena.js) num canvas 2D GPU-backed; a sincronizacao com o GPU prenderia
  //   a thread principal. Implementou-se `willReadFrequently:true` no `getContext('2d')`.
  // MEDICAO (no Chrome do dono, com o hook ACTIVO e confirmado `fix=true`):
  //   o batimento no localStorage parou em **n=3** — a pagina congelou exactamente como antes.
  //   => **REFUTADO.** O `willReadFrequently` muda o *backing store* do canvas, NAO o
  //      **compositor** — e e o compositor que o `--disable-gpu` desliga. Logo o bloqueio
  //      esta no caminho do compositor, nao no canvas.
  // O codigo foi removido (seria regressao de desempenho sem beneficio). Fica a nota para
  //   o proximo agente nao gastar tempo no mesmo caminho.
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

  // Sufixos do fmt() do jogo (cena.js:225): '12.3k' = 12300, '1.2M' = 1200000.
  // Sem sufixo, grupo de 3 casas ('4.188') = milhar; com sufixo, o ponto/virgula
  // e decimal ('12.3k' = 12300). Inteiros ficam IDENTICOS (sem regressao); o que
  // muda e o que antes era DESCARTADO pela regex e passava a ser lido.
  const SUFIXO = { k: 1e3, m: 1e6 };
  /** '1.234' / '1,234' / '1 234' -> 1234; '12.3k' -> 12300; '1.2M' -> 1200000 */
  function toNum(s) {
    const m = String(s == null ? '' : s).replace(/[\s+]/g, '').match(/^(\d[\d.,]*)([kKmM]?)$/);
    if (!m) return NaN;
    const n = m[2] ? parseFloat(m[1].replace(',', '.')) : Number(m[1].replace(/[.,]/g, ''));
    return Number.isFinite(n) ? n * (SUFIXO[m[2].toLowerCase()] || 1) : NaN;
  }

  const NUM = /^\d[\d.,\s]*[kKmM]?$/;
  const HEAL_TXT = /^\+\s*\d[\d.,\s]*[kKmM]?$/;

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
    eventosHook: null, eventoHookErro: null, syncHook: null, syncHookErro: null,
    contrato: null };
  // So o que passa limpo num postMessage: primitivo ou array de primitivos.
  // Um OBJECTO no meio de um campo desconhecido deitaria o postMessage abaixo
  // (DataCloneError) e o meta inteiro nunca chegava — daí o filtro de tipo.
  const prim = (v) => typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
  // Objecto SIMPLES (prototipo Object/null) de primitivos, ate 2 niveis. O `P.maestria` do
  // Ryze (motor.js:912) e um objecto e era DESCARTADO aqui - a Maestria Arcana (mana->AP)
  // nunca chegava a extensao. Funcoes/ciclos/prototipos estranhos continuam de fora para nao
  // haver DataCloneError no postMessage.
  const clonavel = (v, d = 0) => {
    if (v == null) return true;
    if (prim(v)) return true;
    if (Array.isArray(v)) return v.every((e) => prim(e) || e == null);
    if (typeof v !== 'object' || d >= 2) return false;
    try {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) return false;
      return Object.keys(v).every((k) => typeof v[k] !== 'function' && clonavel(v[k], d + 1));
    } catch { return false; }
  };
  const simples = (v) => v == null ? false : clonavel(v);

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
  // ---- CURVA: numeros LIDOS do motor, nunca copiados a mao (REGRA N.o 3) ----
  // A CURVA sao FUNCOES (motor.js:282-288) e nao passam por postMessage. Avalio por
  // nivel e mando os NUMEROS: um buff/nerf na curva do jogo chega sozinho ao meta,
  // sem ninguem tocar no codigo (a regiao do Barao foi buffada, o script nao soube,
  // e o dono morreu — AGENTS.md). Duas saidas da mesma avaliacao:
  //   curvaPorNivel — o valor EXACTO de cada nivel, com o `ajuste` da planilha
  //     (motor.js:281, balanco.js) ja dentro: e a curva real do jogo, nivel a nivel.
  //   curva — os coeficientes CRUS (sem ajuste) do mesmo polinomio, que e o formato
  //     que o automation.js consome (ele reaplica o ajuste a partir do balanco).
  // Se a avaliacao falhar, ficam as chaves actuais como fallback e o motivo em
  // `curvaErro` — nunca um numero inventado.
  const CURVA_FALLBACK = { hp: [150, 100, 1], ad: [9, 4.8, 0.13], armadura: [5, 1.5], xp: [30, 7], ouro: [8, 3.5] };
  const STATS_CURVA = ['hp', 'ad', 'armadura', 'xp', 'ouro'];
  // que multiplicador do `ajuste` (motor.js:281) entra em cada campo da CURVA
  const AJUSTE_DE = { hp: 'vida', ad: 'dano', armadura: null, xp: 'xp', ouro: 'ouro' };
  function avaliarCurva(M) {
    try {
      const C = M && M.CURVA;
      if (!C || typeof C.hp !== 'function') return { erro: 'motor sem CURVA.hp' };
      const max = Math.max(1, Math.min(60, Number(M.NIVEL_MAX) || 1));
      const tabela = {};
      for (let n = 1; n <= max; n++) {
        const f = typeof M.ajuste === 'function' ? M.ajuste(n) : null;
        const e = {};
        for (const s of STATS_CURVA) e[s] = +C[s](n).toFixed(2);
        if (f) e.ajuste = { de: f.de, ate: f.ate, vida: f.vida, dano: f.dano, xp: f.xp, ouro: f.ouro };
        tabela[n] = e;
      }
      return { tabela };
    } catch (e) { return { erro: String((e && e.message) || e) }; }
  }
  // Resolve Ax = b (Gauss, n <= 4). Null se singular.
  function resolverSistema(A, b) {
    const n = b.length, m = A.map((r, i) => r.concat(b[i]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      if (!m[p][c]) return null;
      const t = m[c]; m[c] = m[p]; m[p] = t;
      for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
    }
    return m.map((r, i) => r[n] / r[i]);
  }
  // Coeficientes do polinomio (grau 2, ou 3 se o 2 nao reproduzir) que passa por
  // fn(n)/mult(n) em TODOS os niveis. Null = a forma mudou: nao forca a barra.
  function coeficientes(M, fn, mult) {
    const val = (n) => fn(n) / (mult ? mult(n) : 1);
    const max = Math.max(1, Math.min(60, Number(M.NIVEL_MAX) || 1));
    for (const grau of [2, 3]) {
      const ns = []; for (let i = 0; i <= grau; i++) ns.push(1 + i);
      const A = ns.map((n) => { const r = []; for (let k = 0; k <= grau; k++) r.push(Math.pow(n, k)); return r; });
      const co = resolverSistema(A, ns.map(val));
      if (!co) continue;
      let ok = true;
      for (let n = 1; n <= max && ok; n++) {
        let aprox = 0; for (let k = 0; k <= grau; k++) aprox += co[k] * Math.pow(n, k);
        const exato = val(n);
        if (Math.abs(aprox - exato) > Math.max(1e-6, Math.abs(exato) * 1e-9)) ok = false;
      }
      if (ok) return co.map((c) => Math.round(c * 1e9) / 1e9);
    }
    return null;
  }
  // ---- SENTINELA DE PATCH (2026-10-19) -------------------------------------
  // O jogo pode ser atualizado amanhã (ou daqui a 10 anos) e o motor continuar
  // a existir com outra forma. A extensão não pode "achar" que sabe: mede o
  // CONTRATO no arranque e publica o que falta/ Mudou. O `automation.js` já usa
  // fallbacks declarados; isto dá-lhe o motivo — e à GUI, um aviso visível.
  //
  // Assinatura = hash do `Function.prototype.toString()` de cada função-chave.
  // Não prova que o comportamento é igual, mas prova que o CÓDIGO mudou: um
  // patch que altere a curva/rotação aparece aqui, mesmo que os nomes fiquem.
  const hashTexto = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  };
  const assinatura = (fn) => {
    try { return typeof fn === 'function' ? hashTexto(String(fn)) : null; } catch { return null; }
  };
  const contrato = { motor: null, cena: null, dom: null, ok: null, faltando: [], assinaturas: {} };
  const exigir = (nome, ok) => { if (!ok && !contrato.faltando.includes(nome)) contrato.faltando.push(nome); };
  function publicarContrato() {
    // O guard anti-bot do site é neutralizado no topo deste ficheiro. `neutralizado`
    // é o número de listeners do guard que NÃO foram registados: >= 1 prova que o
    // hook correu ANTES do jogo; 0 significa que o patch do site não foi encontrado
    // (ou mudou de forma) — o GUI mostra o aviso de contrato.
    const guardHook = window.__lolidleGuardHook;
    if (guardHook && guardHook !== true) exigir('guard-hook: ' + guardHook);
    contrato.ok = contrato.motor === true && contrato.cena === true && contrato.faltando.length === 0;
    // clone plain: o postMessage não leva funções; este objecto só tem primitivos/arrays
    meta.contrato = {
      ok: contrato.ok,
      motor: contrato.motor,
      cena: contrato.cena,
      dom: contrato.dom,
      faltando: contrato.faltando.slice(),
      assinaturas: { ...contrato.assinaturas },
      guard: { hook: guardHook === true, neutralizado: Number(window.__lolidleGuardNeutralizado || 0) },
      lidoEm: Date.now(),
    };
    enviarMeta();
  }
  function contratoMotor(M) {
    contrato.motor = !!(M && typeof M === 'object');
    exigir('motor.js', contrato.motor);
    exigir('CURVA.hp', M && M.CURVA && typeof M.CURVA.hp === 'function');
    exigir('CURVA.ad', M && M.CURVA && typeof M.CURVA.ad === 'function');
    exigir('MONSTROS', M && M.MONSTROS && typeof M.MONSTROS === 'object');
    exigir('LOCAIS', M && Array.isArray(M.LOCAIS));
    exigir('POCOES', M && M.POCOES && typeof M.POCOES === 'object');
    exigir('kit()', M && typeof M.kit === 'function');
    exigir('passo()', M && typeof M.passo === 'function');
    if (M) {
      contrato.assinaturas['CURVA.hp'] = assinatura(M.CURVA && M.CURVA.hp);
      contrato.assinaturas['CURVA.ad'] = assinatura(M.CURVA && M.CURVA.ad);
      contrato.assinaturas['kit'] = assinatura(M.kit);
      contrato.assinaturas['passo'] = assinatura(M.passo);
    }
    publicarContrato();
  }
  function contratoCena(Cena) {
    const P = Cena && Cena.prototype;
    contrato.cena = !!P;
    exigir('cena.js', contrato.cena);
    exigir('Cena.sincronizar', P && typeof P.sincronizar === 'function');
    exigir('Cena.evento', P && typeof P.evento === 'function');
    if (P) {
      contrato.assinaturas['Cena.sincronizar'] = assinatura(P.sincronizar);
      contrato.assinaturas['Cena.evento'] = assinatura(P.evento);
    }
    publicarContrato();
  }
  function contratoDom() {
    try {
      const precisos = ['#tela', '#log', '#local-nome'];
      const falta = precisos.filter((s) => !document.querySelector(s));
      contrato.dom = falta.length === 0;
      if (falta.length) exigir('dom: ' + falta.join(', '));
      publicarContrato();
    } catch { contrato.dom = false; publicarContrato(); }
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', contratoDom, { once: true });
    else contratoDom();
  }
  // O guard anti-bot regista-se quando o módulo `jogo.js` corre — que pode ser DEPOIS
  // do DOMContentLoaded e das importações dinâmicas. Sem estes repúblicos, o contrato
  // mostrava `guard.neutralizado: 0` mesmo com o hook já a ter recusado os 3 listeners
  // (medido: o valor real era 3). É a prova discriminante; tem de chegar ao GUI.
  setTimeout(() => { try { publicarContrato(); } catch { /* ignore */ } }, 3000);
  setTimeout(() => { try { publicarContrato(); } catch { /* ignore */ } }, 8000);

  function enviarMeta() { window.postMessage({ __lolidleAuto: 'meta', ...meta }, '*'); }
  import('https://lolidle.com/js/motor.js').then((M) => {
    meta.monstros = M.MONSTROS;
    // LOCAIS = mapa do Summoner's Rift; LOCAIS_FRELJORD = zonas do 2.º mundo (motor.js:577-590,
    // `LOCAL` = os dois). Mandar só `LOCAIS` deixava a extensão CEGA às zonas novas do Freljord.
    // Dedupe por id: `LOCAL` no motor é exactamente esta concatenação (motor.js:591).
    const locais = Array.isArray(M.LOCAIS) ? M.LOCAIS.slice() : [];
    if (Array.isArray(M.LOCAIS_FRELJORD)) {
      const vistos = new Set(locais.map((l) => String(l && l.id)));
      for (const l of M.LOCAIS_FRELJORD) if (l && !vistos.has(String(l.id))) { locais.push(l); vistos.add(String(l.id)); }
    }
    meta.locais = locais;
    // dados de combate/poção direto do motor (sem hardcode!)
    meta.pocoes = M.POCOES; meta.exaustao = M.EXAUSTAO; meta.pocaoPvp = M.POCAO_PVP;
    meta.noturno = M.NOTURNO; meta.furioso = M.FURIOSO; meta.gemas = M.GEMAS;
    meta.recall = M.RECALL; meta.grupo = M.GRUPO; meta.nivelMax = M.NIVEL_MAX; meta.espacos = M.ESPACOS;
    meta.rodizio = M.RODIZIO_CHEFE || null; meta.mecanicas = M.MECANICAS || null;
    // CURVA: avaliada por nivel — numeros LIDOS, nao copiados (REGRA N.o 3)
    const av = avaliarCurva(M);
    if (av && !av.erro) {
      meta.curvaPorNivel = av.tabela;
      const co = {}; let faltou = null;
      for (const s of STATS_CURVA) {
        const chave = AJUSTE_DE[s];
        const c = coeficientes(M, (n) => M.CURVA[s](n), chave ? (n) => M.ajuste(n)[chave] : null);
        if (!c) { faltou = s; break; }
        co[s] = c;
      }
      meta.curva = faltou ? CURVA_FALLBACK : co;
      meta.curvaErro = faltou ? 'coeficiente de ' + faltou + ' nao reproduz o motor (a forma da curva mudou?), fallback congelado' : null;
    } else {
      meta.curvaPorNivel = null;
      meta.curva = CURVA_FALLBACK;   // chaves actuais como fallback, com o motivo no log
      meta.curvaErro = 'CURVA nao avaliada: ' + ((av && av.erro) || 'motor indisponivel') + ', fallback congelado';
    }    meta.mochila = { inicio: M.MOCHILA_INICIO, niveis: M.MOCHILA_GANHO.niveis, espacos: M.MOCHILA_GANHO.espacos };
    meta.ciclo = M.CICLO; meta.fuso = M.FUSO;
    meta.nivelDif = M.NIVEL_DIF || null;        // fator de nível (livre/+dano/cap/piso), direto do motor
    meta.rmMonstro = M.RM_MONSTRO != null ? M.RM_MONSTRO : null;   // motor.js:1194, RM dos monstros = 60% da armadura (lido, nao copiado)
    meta.habChefe = M.HAB_CHEFE || null;         // carrega/espera de cada mecânica do chefe
    // grupoSpawn (motor.js:1137) e respawn (motor.js:1646 wave limpa / :3069 troca de
    // local) sao LITERAIS INLINE no motor e nao sao exportados: a unica forma de os
    // LER — em vez de os copiar a mao, o que fazia este ficheiro e o que a REGRA N.o 3
    // proibe — e MEDIR no estado vivo (wrap de `sincronizar`, mais abaixo). Ate la
    // ficam null: quem consome usa o fallback dele. Nada inventado.    meta.grupoSpawn = null; meta.respawn = null;
    meta.modelos = M.MODELOS || null;            // pesos de distribuição de atributos (tanque/equilibrado/dano/conjurador)
    meta.dicaAtributos = M.DICA_ATRIBUTOS || null;   // modelo sugerido por campeão
    // TODOS os campeões (kit serializado + stats). O atual é detectado pelo ícone da skill.
    meta.kits = {};
    if (M.KITS) for (const id of Object.keys(M.KITS)) {
      const K = M.KITS[id];
      if (!K || !K.hab) continue;
      meta.kits[id] = { kit: serialKit(K.hab), stats: K.stats || null, adBase: K.adBase, adNivel: K.adNivel, magia: !!K.magia, semMana: !!K.semMana, fluxo: !!K.fluxo, adagas: !!K.adagas, distancia: !!K.distancia, papel: K.papel || null, giroSrc: K.hab.P && K.hab.P.giro ? String(K.hab.P.giro) : null, ordem: K.ordem || null, hemorragia: !!K.hemorragia };
    }
    // kit do campeão (Katarina): base/ratio/recarga + stats base
    const K = M.KITS && M.KITS.katarina;
    if (K) {
      meta.kit = serialKit(K.hab);
      meta.champ = { id: K.id, stats: K.stats || null, adBase: K.adBase, adNivel: K.adNivel, magia: !!K.magia, semMana: !!K.semMana, fluxo: !!K.fluxo, adagas: !!K.adagas, distancia: !!K.distancia, papel: K.papel || null, ordem: K.ordem || null, hemorragia: !!K.hemorragia };
      meta.ordemHab = K.ordem || null;   // ordem OFICIAL de subir habilidade deste campeão (motor)
    }
    meta.bonusTwitch = M.bonusTwitchAtual ? M.bonusTwitchAtual() : null;
    meta.bonusEvento = M.eventoXpAtual ? M.eventoXpAtual() : null;
    contratoMotor(M);
    enviarMeta();
  }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));
  import('https://lolidle.com/js/balanco.js').then((B) => { meta.balanco = B.BALANCO; enviarMeta(); }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));
  // CATALOGO DE ITENS: o cru (js/itens.js) NAO e o que o jogo usa — o MOTOR remenda 6 itens
  // que o gerador nao trouxe (motor.js:16-33):
  //   2022 (dr 0,05) 1006 (regen 3) 3057 (efeito) 4629 (dr 0,15) 3108 (dr 0,05) 3802 (dr 0,05)
  // Mandar o cru faz a extensao receber cdr/regen/efeito AUSENTES nesses 6 (TK-02-147).
  // O motor exporta o catalogo ja remendado: `ITENS` (motor.js:20 e os `Object.assign`).
  // REGRA N.o 3: o numero e LIDO do motor, nao copiado — ha um unico sitio.
  import('https://lolidle.com/js/motor.js').then((M) => {
    const cat = (M && M.ITENS) ? Object.values(M.ITENS) : null;
    if (cat && cat.length) { meta.itens = cat; }
    enviarMeta();
  }).catch((e) => {
    // sem o motor: cai no cru (melhor que nada) e REGISTA que falta o remendo.
    return import('https://lolidle.com/js/itens.js').then((I) => { meta.itens = I.ITENS_DADOS; enviarMeta(); });
  }).catch((e) => window.postMessage({ __lolidleAuto: 'meta-erro', erro: String(e) }, '*'));
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
    contratoCena(Cena);
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
          // PvP REAL e dungeon: o motor só trata a poção como PvP quando
          // `arena.combatePvp > 0` (motor.js:1410), e a cura das skills cai a 65%
          // (motor.js:1390). Sem estes dois campos a extensão adivinhava "PvP" só por
          // estar em Runeterra (o mapa aberto), o que não é a mesma coisa.
          combatePvp: n1((combate.arena && combate.arena.combatePvp) || 0),
          dg: !!combate.dg,
          // POSIÇÃO REAL (mundo MAIN) para a extensão não andar às cegas na Fonte: o
          // `darius` é o boneco do jogador e `npcs` são os NPCs do mapa (mundo.js). Sem
          // isto, `abrirCofreTesoureira` subia 8 tiles a partir de uma posição SUPOSTA
          // (24,22) e falhava sempre que o servidor restaurava outra posição (medido:
          // boneco em (29,11), Tesoureira em (23,13) - 6 tiles ao lado).
          pos: cena && cena.darius ? { x: n1(cena.darius.x), y: n1(cena.darius.y) } : null,
          cam: cena && cena.cam ? { x: n1(cena.cam.x), y: n1(cena.cam.y) } : null,
          npcs: (cena && Array.isArray(cena.npcs) ? cena.npcs : []).map((n) => ({ nome: n.nome, x: n1(n.x), y: n1(n.y) })),
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
