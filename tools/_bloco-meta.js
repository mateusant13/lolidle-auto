  function carregarMeta() {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d) return;
      if (d.__lolidleAuto === 'meta-erro') { META.erro = d.erro; logIssue('meta-falha', { erro: d.erro }); return; }
      if (d.__lolidleAuto === 'chefe-hook') { META.chefeHook = !!d.ok; META.chefeHookErro = d.erro || null; return; }
      // TK-INT-01 — os DOIS canais que o inject.js já publica e que morriam aqui:
      //   'estado' = o `combate` INTEIRO a cada mudança estrutural / 250 ms (inject.js:430-438);
      //   'evento' = os tipos do motor que DECIDEM (inject.js:222-224, motor.js:1182 `emitir`).
      // Ambos ficam disponíveis por `estadoVivo()`/`eventosVivos()` e são consumidos por
      // `consumirEvento` (abaixo) — sem isto o motor era lido pela UI e por mais ninguém.
      if (d.__lolidleAuto === 'estado') { _estadoVivo = d; return; }
      if (d.__lolidleAuto === 'evento') { consumirEvento(d); return; }
      if (d.__lolidleAuto !== 'meta') return;
      if (d.chefeHook != null) META.chefeHook = d.chefeHook;
      if (d.chefeHookErro) META.chefeHookErro = d.chefeHookErro;
      if (d.monstros) META.monstros = d.monstros;
      if (d.locais) META.locais = d.locais;
      if (d.balanco) META.balanco = d.balanco;
      if (d.itens) META.itens = d.itens;
      if (d.ondeItem) META.ondeItem = d.ondeItem;
      // `curvaPorNivel`/`rmMonstro` (TK-INT-01): curva REAL avaliada por nível e o RM dos
      // monstros, ambos LIDOS do motor pelo inject.js — quem consome é o `curva()`/`rmMonstro()`.
      for (const k of ['pocoes', 'exaustao', 'pocaoPvp', 'noturno', 'furioso', 'gemas', 'recall', 'grupo', 'nivelMax', 'espacos', 'curva', 'curvaPorNivel', 'rmMonstro', 'kit', 'champ', 'rodizio', 'mecanicas', 'kits', 'mochila', 'ciclo', 'fuso', 'grupoSpawn', 'respawn', 'modelos', 'dicaAtributos', 'nivelDif', 'habChefe']) if (d[k] != null) META[k] = d[k];
      if (d.kit || d.kits) aplicarKit();
      if (META.monstros && META.locais && META.balanco) {
        META.at = Date.now(); META.erro = null;
        try { chrome.storage.local.set({ [META_KEY]: { at: META.at, monstros: META.monstros, locais: META.locais, balanco: META.balanco, itens: META.itens, ondeItem: META.ondeItem } }); } catch { /* ignore */ }
        // (sem logEvent de meta: a re-injeção dispara várias e inunda o log)
      }
    });
    try { window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*'); } catch { /* ignore */ }
  }