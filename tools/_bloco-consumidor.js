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

  // ---------- ESTADO VIVO e EVENTOS do motor (TK-INT-01) ----------
  // O inject.js (mundo MAIN) reencaminha DOIS canais que o automation.js ignorava — a mensagem
  // morria no `!== 'meta'` do `carregarMeta`:
  //   'estado' — o `combate` INTEIRO do motor a cada mudança estrutural e a cada 250 ms
  //     (inject.js:430-438): inimigos com hp/ad/armadura/ouro/xp, atordoado/noAr/marca, INVOCADO
  //     (as larvas do Barão, motor.js:3141-3142), mec/tMec/carrega/furiaT (a mecânica do chefe),
  //     e as RECARGAS EXACTAS em segundos de cada habilidade (motor.js:1055). Não está no DOM.
  //   'evento' — os tipos que DECIDEM (motor.js:1169 tem 71; o inject reencaminha os 21 de
  //     EV_DECIDEM, inject.js:222-224): abate com ouro/xp/itens (motor.js:1807), chefeInvoca,
  //     chefeCarrega/Golpe/Interrompido, buffBarao, item, morreu, nivel, pocao, recall...
  // CONSUMO: `consumirEvento` conta por tipo, guarda um buffer limitado e dobra no ciclo o que o
  // log do ecrã NÃO apanha (invocações do chefe, buff do Barão, itens, poção, nível, morte).
  // O ouro/xp do abate NÃO são somados ao ciclo — quem os conta é o `handleLog` (a frase do
  // ecrã); somar aqui seria contar duas vezes. O evento fica como PROVA e CONTRA-PROVA.
  let _estadoVivo = null;
  const _eventosVivos = [];      // últimos 100 eventos (o storage não leva isto: é batimento alto)
  const _eventosCont = {};       // contagem por tipo desde o arranque
  /** Último snapshot do combate publicada pelo inject.js (null antes da primeira). */
  function estadoVivo() { return _estadoVivo; }
  /** Buffer dos últimos eventos do motor (cada um: { tipo, t, at, ...payload }). */
  function eventosVivos() { return _eventosVivos.slice(); }
  /** Contagem por tipo desde o arranque ({ abate: 12, chefeInvoca: 1, ... }). */
  function eventosContadores() { return Object.assign({}, _eventosCont); }
  function consumirEvento(d) {
    try {
      const tipo = String((d && d.tipo) || '').trim();
      if (!tipo) return;
      _eventosCont[tipo] = (_eventosCont[tipo] || 0) + 1;
      _eventosVivos.unshift({ tipo, t: d.t != null ? d.t : null, at: d.at || Date.now(), payload: d });
      if (_eventosVivos.length > 100) _eventosVivos.pop();
      const c = farm && farm.current;
      if (tipo === 'abate') {
        // motor.js:1807 — ouro/xp/itens EXACTOS do abate (a UI arredonda; o evento não).
        const ouro = Number(d.ouro), xp = Number(d.xp);
        if (c) {
          c.abatesEvento = (c.abatesEvento || 0) + 1;
          c.ouroEvento = (c.ouroEvento || 0) + (Number.isFinite(ouro) ? ouro : 0);
          c.xpEvento = (c.xpEvento || 0) + (Number.isFinite(xp) ? xp : 0);
          const fase = c.fase === 'boss' ? c.bossFase : c.mobFase;
          if (fase) { fase.abatesEvento = (fase.abatesEvento || 0) + 1; }
        }
        logEvent('evento:abate', { nome: d.nome || null, ouro: Number.isFinite(ouro) ? ouro : null, xp: Number.isFinite(xp) ? xp : null, chefe: !!d.chefe, furioso: !!d.furioso, itens: (d.itens || []).length, gemas: (d.gemas || []).length });
        return;
      }
      if (tipo === 'chefeInvoca') {           // motor.js:3142 — as 2 larvas do Barão
        if (c) { c.chefeInvoca = (c.chefeInvoca || 0) + 1; }
        logEvent('evento:chefeInvoca', { alvo: d.alvo != null ? d.alvo : null, chefe: c && c.boss ? c.boss : null });
        return;
      }
      if (tipo === 'chefeCarrega' || tipo === 'chefeGolpe' || tipo === 'chefeInterrompido') {
        if (c) { c[tipo] = (c[tipo] || 0) + 1; }
        logEvent('evento:' + tipo, { alvo: d.alvo != null ? d.alvo : null, mec: d.mec || null, dur: d.dur != null ? d.dur : null, bloqueado: !!d.bloqueado });
        return;
      }
      if (tipo === 'buffBarao') { if (c) { c.buffBarao = (c.buffBarao || 0) + 1; } logEvent('evento:buffBarao', {}); return; }
      if (tipo === 'nivel') { logEvent('evento:nivel', { nivel: d.nivel != null ? d.nivel : null }); return; }
      if (tipo === 'morreu') {
        if (c) { c.deaths = (c.deaths || 0) + 1; }
        logEvent('evento:morreu', { por: d.por || d.alvo || null });
        return;
      }
      if (tipo === 'item') { if (c) { c.itensEvento = (c.itensEvento || 0) + 1; } logEvent('evento:item', { id: d.id || null }); return; }
      if (tipo === 'pocao') { logEvent('evento:pocao', { tipo: d.pocao || d.tipo2 || null }); return; }
      if (tipo === 'semPocao') { logEvent('evento:semPocao', {}); return; }
      // os restantes (recall, grupo, kite, fluxo, luden, bravata, divisao, abateRoubado,
      // recallCancelado...) ficam nos contadores + buffer: já não morrem silenciosamente.
      logEvent('evento:' + tipo, { resumo: Object.keys(d).filter((k) => k !== '__lolidleAuto' && k !== 'tipo').slice(0, 6) });
    } catch { /* um evento nunca pode derrubar o motor */ }
  }