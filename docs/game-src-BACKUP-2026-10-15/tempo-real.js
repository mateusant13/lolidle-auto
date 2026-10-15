// Conexão em tempo real de Runeterra (WebSocket): manda a posição ~10x por segundo e recebe a dos outros
// jogadores, as habilidades que eles usam e o PvP. Cai e volta sozinha se a rede piscar.
import { tokenAtual } from './rede.js';

export function criarConexao({ aoMsg, aoMudar }) {
  let ws = null, ativo = false, tentativa = 0, timer = null;
  function agendar() {
    if (!ativo) return;
    clearTimeout(timer);
    timer = setTimeout(abrir, Math.min(10000, 1000 * 2 ** tentativa++));
  }
  function abrir() {
    if (!ativo || ws) return;
    try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); } catch { ws = null; return agendar(); }
    const este = ws;
    este.onopen = () => { tentativa = 0; este.send(JSON.stringify({ t: 'oi', token: tokenAtual() })); };
    este.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'ok') aoMudar?.(true);
      aoMsg(m);
    };
    este.onclose = () => { if (ws === este) { ws = null; aoMudar?.(false); agendar(); } };
    este.onerror = () => {};
  }
  return {
    ligar() { if (ativo) return; ativo = true; abrir(); },
    desligar() {
      if (!ativo) return;
      ativo = false; clearTimeout(timer);
      const velho = ws; ws = null;
      if (velho) { try { if (velho.readyState === 1) velho.send(JSON.stringify({ t: 'sair' })); velho.close(); } catch {} }
      aoMudar?.(false);
    },
    enviar(obj) { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); },
  };
}

