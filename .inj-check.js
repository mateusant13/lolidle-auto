// ../wt/w8-obs/extension/inject.js
(() => {
  const HEAL = "#40e060";
  const MANA = "#5aa8ff";
  const SHIELD = new Set(["#c8ff8a", "#ffe8f8", "#bfe8ff", "#d8f0ff", "#c8f8ff", "#ffe27a", "#a6f06a"]);
  function norm(color) {
    const c = String(color || "").trim().toLowerCase();
    if (c.startsWith("#"))
      return c;
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m)
      return c;
    const h = (n) => Number(n).toString(16).padStart(2, "0");
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  }
  const SUFIXO = { k: 1000, m: 1e6 };
  function toNum(s) {
    const m = String(s == null ? "" : s).replace(/\s/g, "").match(/^(\d[\d.,]*)([kKmM]?)$/);
    if (!m)
      return NaN;
    const n = m[2] ? parseFloat(m[1].replace(",", ".")) : Number(m[1].replace(/[.,]/g, ""));
    return Number.isFinite(n) ? n * (SUFIXO[m[2].toLowerCase()] || 1) : NaN;
  }
  const NUM = /^\d[\d.,\s]*[kKmM]?$/;
  const HEAL_TXT = /^\+\s*\d[\d.,\s]*[kKmM]?$/;
  const _vistos = [];
  function repetido(key) {
    const now = Date.now();
    while (_vistos.length && now - _vistos[0].t > 120)
      _vistos.shift();
    for (const r of _vistos)
      if (r.key === key)
        return true;
    _vistos.push({ t: now, key });
    if (_vistos.length > 240)
      _vistos.shift();
    return false;
  }
  function report(text, color, canvas, x, y) {
    const t = String(text == null ? "" : text).trim();
    if (!t || t.length > 12)
      return;
    if (canvas && canvas.id && canvas.id !== "tela")
      return;
    const col = norm(color);
    let tipo = null;
    if (HEAL_TXT.test(t))
      tipo = col === HEAL ? "heal" : col === MANA ? "mana" : "shield";
    else if (NUM.test(t))
      tipo = "dmg";
    else
      return;
    const v = toNum(t);
    if (!Number.isFinite(v) || v <= 0)
      return;
    const key = tipo + "|" + v + "|" + Math.round((x || 0) / 12) + "|" + Math.round((y || 0) / 12);
    if (repetido(key))
      return;
    window.postMessage({ __lolidle: tipo, value: v, color: col, x, y }, "*");
  }
  function hook(proto, method, styleProp) {
    if (!proto || typeof proto[method] !== "function" || proto[method].__lolidle)
      return;
    const orig = proto[method];
    const wrapped = function(text, x, y, ...rest) {
      try {
        report(text, this[styleProp], this.canvas, x, y);
      } catch {}
      return orig.call(this, text, x, y, ...rest);
    };
    wrapped.__lolidle = true;
    proto[method] = wrapped;
  }
  hook(CanvasRenderingContext2D.prototype, "fillText", "fillStyle");
  if (typeof OffscreenCanvasRenderingContext2D !== "undefined") {
    hook(OffscreenCanvasRenderingContext2D.prototype, "fillText", "fillStyle");
  }
  const meta = {
    monstros: null,
    locais: null,
    balanco: null,
    itens: null,
    ondeItem: null,
    pocoes: null,
    exaustao: null,
    pocaoPvp: null,
    noturno: null,
    furioso: null,
    gemas: null,
    recall: null,
    grupo: null,
    nivelMax: null,
    espacos: null,
    curva: null,
    curvaPorNivel: null,
    curvaErro: null,
    rmMonstro: null,
    kit: null,
    champ: null,
    rodizio: null,
    mecanicas: null,
    chefeHook: null,
    chefeHookErro: null,
    combateHook: null,
    kits: null,
    mochila: null,
    ciclo: null,
    fuso: null,
    grupoSpawn: null,
    respawn: null,
    spawnHook: null,
    spawnHookErro: null
  };
  const serialKit = (K) => {
    if (!K)
      return null;
    const out = {};
    for (const t of Object.keys(K)) {
      const h = K[t];
      if (!h || typeof h !== "object")
        continue;
      const o = {};
      for (const c of [
        "nivel",
        "max",
        "base",
        "ratio",
        "recarga",
        "adRatio",
        "mult",
        "alvos",
        "duracao",
        "golpes",
        "venenoBase",
        "venenoRatio",
        "venenoT",
        "vaAdaga",
        "acumMax",
        "duracaoSinistra",
        "curaGiro",
        "adaga",
        "auto",
        "dot",
        "passiva",
        "util"
      ]) {
        const v = h[c];
        if (v == null || typeof v === "function")
          continue;
        o[c] = Array.isArray(v) ? v.slice() : v;
      }
      out[t] = o;
    }
    return out;
  };
  const CURVA_FALLBACK = { hp: [150, 100, 1], ad: [9, 4.8, 0.13], armadura: [5, 1.5], xp: [30, 7], ouro: [8, 3.5] };
  const STATS_CURVA = ["hp", "ad", "armadura", "xp", "ouro"];
  const AJUSTE_DE = { hp: "vida", ad: "dano", armadura: null, xp: "xp", ouro: "ouro" };
  function avaliarCurva(M) {
    try {
      const C = M && M.CURVA;
      if (!C || typeof C.hp !== "function")
        return { erro: "motor sem CURVA.hp" };
      const max = Math.max(1, Math.min(60, Number(M.NIVEL_MAX) || 1));
      const tabela = {};
      for (let n = 1;n <= max; n++) {
        const f = typeof M.ajuste === "function" ? M.ajuste(n) : null;
        const e = {};
        for (const s of STATS_CURVA)
          e[s] = +C[s](n).toFixed(2);
        if (f)
          e.ajuste = { de: f.de, ate: f.ate, vida: f.vida, dano: f.dano, xp: f.xp, ouro: f.ouro };
        tabela[n] = e;
      }
      return { tabela };
    } catch (e) {
      return { erro: String(e && e.message || e) };
    }
  }
  function resolverSistema(A, b) {
    const n = b.length, m = A.map((r, i) => r.concat(b[i]));
    for (let c = 0;c < n; c++) {
      let p = c;
      for (let r = c + 1;r < n; r++)
        if (Math.abs(m[r][c]) > Math.abs(m[p][c]))
          p = r;
      if (!m[p][c])
        return null;
      const t = m[c];
      m[c] = m[p];
      m[p] = t;
      for (let r = 0;r < n; r++)
        if (r !== c) {
          const f = m[r][c] / m[c][c];
          for (let k = c;k <= n; k++)
            m[r][k] -= f * m[c][k];
        }
    }
    return m.map((r, i) => r[n] / r[i]);
  }
  function coeficientes(M, fn, mult) {
    const val = (n) => fn(n) / (mult ? mult(n) : 1);
    const max = Math.max(1, Math.min(60, Number(M.NIVEL_MAX) || 1));
    for (const grau of [2, 3]) {
      const ns = [];
      for (let i = 0;i <= grau; i++)
        ns.push(1 + i);
      const A = ns.map((n) => {
        const r = [];
        for (let k = 0;k <= grau; k++)
          r.push(Math.pow(n, k));
        return r;
      });
      const co = resolverSistema(A, ns.map(val));
      if (!co)
        continue;
      let ok = true;
      for (let n = 1;n <= max && ok; n++) {
        let aprox = 0;
        for (let k = 0;k <= grau; k++)
          aprox += co[k] * Math.pow(n, k);
        const exato = val(n);
        if (Math.abs(aprox - exato) > Math.max(0.000001, Math.abs(exato) * 0.000000001))
          ok = false;
      }
      if (ok)
        return co.map((c) => Math.round(c * 1e9) / 1e9);
    }
    return null;
  }
  const enviarMeta = () => window.postMessage({ __lolidleAuto: "meta", ...meta }, "*");
  import("https://lolidle.com/js/motor.js").then((M) => {
    meta.monstros = M.MONSTROS;
    meta.locais = M.LOCAIS;
    meta.pocoes = M.POCOES;
    meta.exaustao = M.EXAUSTAO;
    meta.pocaoPvp = M.POCAO_PVP;
    meta.noturno = M.NOTURNO;
    meta.furioso = M.FURIOSO;
    meta.gemas = M.GEMAS;
    meta.recall = M.RECALL;
    meta.grupo = M.GRUPO;
    meta.nivelMax = M.NIVEL_MAX;
    meta.espacos = M.ESPACOS;
    meta.rodizio = M.RODIZIO_CHEFE || null;
    meta.mecanicas = M.MECANICAS || null;
    const av = avaliarCurva(M);
    if (av && !av.erro) {
      meta.curvaPorNivel = av.tabela;
      const co = {};
      let faltou = null;
      for (const s of STATS_CURVA) {
        const chave = AJUSTE_DE[s];
        const c = coeficientes(M, (n) => M.CURVA[s](n), chave ? (n) => M.ajuste(n)[chave] : null);
        if (!c) {
          faltou = s;
          break;
        }
        co[s] = c;
      }
      meta.curva = faltou ? CURVA_FALLBACK : co;
      meta.curvaErro = faltou ? "coeficiente de " + faltou + " nao reproduz o motor (a forma da curva mudou?) — fallback congelado" : null;
    } else {
      meta.curvaPorNivel = null;
      meta.curva = CURVA_FALLBACK;
      meta.curvaErro = "CURVA nao avaliada: " + (av && av.erro || "motor indisponivel") + " — fallback congelado";
    }
    meta.mochila = { inicio: M.MOCHILA_INICIO, niveis: M.MOCHILA_GANHO.niveis, espacos: M.MOCHILA_GANHO.espacos };
    meta.ciclo = M.CICLO;
    meta.fuso = M.FUSO;
    meta.nivelDif = M.NIVEL_DIF || null;
    meta.rmMonstro = M.RM_MONSTRO != null ? M.RM_MONSTRO : null;
    meta.habChefe = M.HAB_CHEFE || null;
    meta.grupoSpawn = null;
    meta.respawn = null;
    meta.modelos = M.MODELOS || null;
    meta.dicaAtributos = M.DICA_ATRIBUTOS || null;
    meta.kits = {};
    if (M.KITS)
      for (const id of Object.keys(M.KITS)) {
        const K = M.KITS[id];
        if (!K || !K.hab)
          continue;
        meta.kits[id] = { kit: serialKit(K.hab), adBase: K.adBase, adNivel: K.adNivel, magia: !!K.magia, semMana: !!K.semMana, adagas: !!K.adagas, distancia: !!K.distancia, papel: K.papel || null, giroSrc: K.hab.P && K.hab.P.giro ? String(K.hab.P.giro) : null, ordem: K.ordem || null };
      }
    const K = M.KITS && M.KITS.katarina;
    if (K) {
      meta.kit = serialKit(K.hab);
      meta.champ = { id: K.id, adBase: K.adBase, adNivel: K.adNivel, magia: !!K.magia, semMana: !!K.semMana, adagas: !!K.adagas, distancia: !!K.distancia, papel: K.papel || null, ordem: K.ordem || null };
      meta.ordemHab = K.ordem || null;
    }
    meta.bonusTwitch = M.bonusTwitchAtual ? M.bonusTwitchAtual() : null;
    meta.bonusEvento = M.eventoXpAtual ? M.eventoXpAtual() : null;
    enviarMeta();
  }).catch((e) => window.postMessage({ __lolidleAuto: "meta-erro", erro: String(e) }, "*"));
  import("https://lolidle.com/js/balanco.js").then((B) => {
    meta.balanco = B.BALANCO;
    enviarMeta();
  }).catch((e) => window.postMessage({ __lolidleAuto: "meta-erro", erro: String(e) }, "*"));
  import("https://lolidle.com/js/itens.js").then((I) => {
    meta.itens = I.ITENS_DADOS;
    enviarMeta();
  }).catch((e) => window.postMessage({ __lolidleAuto: "meta-erro", erro: String(e) }, "*"));
  import("https://lolidle.com/js/wiki-dados.js").then((W) => {
    meta.ondeItem = W.ONDE_ITEM;
    enviarMeta();
  }).catch((e) => window.postMessage({ __lolidleAuto: "meta-erro", erro: String(e) }, "*"));
  import("https://lolidle.com/js/cena.js").then(({ Cena }) => {
    const P = Cena && Cena.prototype;
    if (!P) {
      meta.chefeHook = false;
      meta.chefeHookErro = "sem Cena.prototype";
      enviarMeta();
      return;
    }
    if (P.__lolidleChefe) {
      meta.chefeHook = true;
      enviarMeta();
      return;
    }
    const wrap = (metodo, tipo) => {
      const orig = P[metodo];
      if (typeof orig !== "function") {
        meta.chefeHook = false;
        meta.chefeHookErro = "sem metodo " + metodo;
        enviarMeta();
        return;
      }
      P[metodo] = function(v, d, mec, extra) {
        try {
          window.postMessage({ __lolidleAuto: tipo, mec, dur: typeof extra === "number" ? extra : null }, "*");
        } catch {}
        return orig.apply(this, arguments);
      };
    };
    wrap("chefeCarregaRift", "carga");
    wrap("chefeGolpeRift", "golpe");
    try {
      const ac = { out: {}, tomou: 0, since: Date.now() };
      let cenaLive = null;
      const flush = () => {
        const t = Date.now(), dt = t - ac.since;
        if (dt >= 400) {
          try {
            window.postMessage({ __lolidleAuto: "combate", out: ac.out, tomou: ac.tomou, dt, at: t }, "*");
          } catch {}
          ac.out = {};
          ac.tomou = 0;
          ac.since = t;
        }
      };
      setInterval(flush, 400);
      const origEv = P.evento;
      if (typeof origEv === "function" && !origEv.__lolidleEv) {
        P.evento = function(ev, combate) {
          try {
            cenaLive = this;
            if (ev && ev.tipo === "dano" && Number.isFinite(ev.valor)) {
              const f = ev.fonte || "outro";
              ac.out[f] = (ac.out[f] || 0) + ev.valor;
            } else if (ev && ev.tipo === "recebido" && Number.isFinite(ev.valor))
              ac.tomou += ev.valor;
          } catch {}
          return origEv.apply(this, arguments);
        };
        P.evento.__lolidleEv = true;
      }
      setInterval(() => {
        try {
          const cb = cenaLive && cenaLive.chefeBarra;
          if (cb && Number.isFinite(cb.vida))
            window.postMessage({ __lolidleAuto: "chefe-hp", nome: cb.nome || "chefe", vida: cb.vida, at: Date.now() }, "*");
        } catch {}
      }, 300);
      meta.combateHook = true;
    } catch (e) {
      meta.combateHook = false;
    }
    const med = {
      claro: null,
      local: null,
      min: null,
      max: null,
      n: 0,
      vazioDesde: null,
      troca: false,
      localAntes: null,
      antes: -1
    };
    function medirSpawn(combate, localId) {
      const n = combate.inimigos ? combate.inimigos.length : 0, t = Number(combate.tempo) || 0;
      let trocou = false;
      if (med.localAntes == null)
        med.localAntes = localId;
      else if (localId !== med.localAntes) {
        trocou = true;
        med.localAntes = localId;
        if (med.vazioDesde != null) {
          med.vazioDesde = t;
          med.troca = true;
        }
      }
      if (n > 0) {
        if (med.vazioDesde != null) {
          const dur = t - med.vazioDesde;
          if (dur > 0 && dur < 20) {
            if (med.troca) {
              if (med.local == null || dur > med.local)
                med.local = dur;
            } else if (med.claro == null || dur > med.claro)
              med.claro = dur;
          }
          med.vazioDesde = null;
          med.troca = false;
        }
        if (med.antes === 0 && !combate.inimigos.some((i) => i.chefe)) {
          med.min = med.min == null ? n : Math.min(med.min, n);
          med.max = med.max == null ? n : Math.max(med.max, n);
          med.n++;
        }
      } else if (med.vazioDesde == null && (med.antes > 0 || trocou)) {
        med.vazioDesde = t;
        med.troca = trocou;
        if (!trocou && combate.respawn != null)
          med.claro = combate.respawn;
      }
      med.antes = n;
    }
    function publicarMedidas() {
      if (med.n >= 20 && med.min != null) {
        const gs = { base: med.min, rand: med.max - med.min + 1, min: med.min, max: med.max, n: med.n };
        if (!meta.grupoSpawn || meta.grupoSpawn.base !== gs.base || meta.grupoSpawn.rand !== gs.rand) {
          meta.grupoSpawn = gs;
          try {
            enviarMeta();
          } catch {}
        }
      }
      if (med.claro != null && med.local != null) {
        const rp = { clear: +med.claro.toFixed(2), local: +med.local.toFixed(2) };
        if (!meta.respawn || meta.respawn.clear !== rp.clear || meta.respawn.local !== rp.local) {
          meta.respawn = rp;
          try {
            enviarMeta();
          } catch {}
        }
      }
    }
    const origSinc = P.sincronizar;
    if (typeof origSinc === "function" && !origSinc.__lolidleSpawn) {
      P.sincronizar = function(combate, vida, mana) {
        try {
          if (combate && combate.inimigos && !this.arena) {
            medirSpawn(combate, this.local && this.local.id);
            publicarMedidas();
          }
        } catch {}
        return origSinc.apply(this, arguments);
      };
      P.sincronizar.__lolidleSpawn = true;
      meta.spawnHook = true;
    } else {
      meta.spawnHook = false;
      meta.spawnHookErro = "sem metodo sincronizar";
    }
    P.__lolidleChefe = true;
    meta.chefeHook = true;
    enviarMeta();
  }).catch((e) => {
    meta.chefeHook = false;
    meta.chefeHookErro = String(e);
    enviarMeta();
  });
  window.addEventListener("message", (e) => {
    if (e.data && e.data.__lolidleAuto === "pedir-meta")
      enviarMeta();
  });
})();
