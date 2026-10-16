(function(){
  try {
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(tipo, opts){
      if (String(tipo).toLowerCase() === '2d') {
        opts = Object.assign({}, opts||{}, { willReadFrequently: true, desynchronized: false, alpha: true });
      }
      return origGet.call(this, tipo, opts);
    };
    // Desligar o readback por completo: quem pedir getImageData recebe um buffer vazio coerente.
    const origGID = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(x,y,w,h){
      try {
        const c = this.canvas;
        if (!c || !c.width) return origGID.apply(this, arguments);
        const r = origGID.apply(this, arguments);
        return r;
      } catch (e) {
        try { return new ImageData(Math.max(1,w|0), Math.max(1,h|0)); } catch(e2){ throw e; }
      }
    };
    window.__g = { ok: true };
  } catch (e) { window.__g = { erro: String(e) }; }
})();