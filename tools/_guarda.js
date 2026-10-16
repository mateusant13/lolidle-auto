(function(){
  // GUARDA anti-bloqueio: o jogo faz readback de canvas (getImageData) num canvas GPU-backed.
  // Com o GPU saturado (varias abas de video) essa chamada SINCRONIZA e a thread principal espera
  // para sempre: 0% CPU, sem crash, sem dialogo. Aqui envolvemos o getImageData para (a) limitar a
  // frequencia e (b) devolver dados vazios em vez de bloquear quando a chamada demora.
  try {
    const C = HTMLCanvasElement.prototype;
    const orig = C.getImageData;
    let ultimo = 0, chamadas = 0;
    C.getImageData = function(){
      chamadas++;
      const agora = Date.now();
      if (agora - ultimo < 250) {
        // devolve um buffer vazio do tamanho pedido, em vez de sincronizar com o GPU
        const a = arguments[0]|0, b = arguments[1]|0, w = Math.max(1, arguments[2]|0), h = Math.max(1, arguments[3]|0);
        try { return new ImageData(w, h); } catch(e){ return orig.apply(this, arguments); }
      }
      ultimo = agora;
      return orig.apply(this, arguments);
    };
    window.__guardaReadback = { instalada: true };
  } catch (e) { window.__guardaReadback = { erro: String(e) }; }
})();