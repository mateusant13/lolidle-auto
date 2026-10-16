(function(){
  // O jogo chama getContext('2d') sem o hint 'willReadFrequently' (pixel.js:38/92/106/2942/3061).
  // Um canvas 2D SEM esse hint e GPU-backed: o getImageData tem de SINCRONIZAR com o processo GPU
  // e, com o GPU saturado, a thread principal espera para sempre. Forcar o hint faz o Chrome
  // manter o canvas em memoria de CPU -> o readback passa a ser local e NAO bloqueia.
  try {
    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(tipo, opts){
      if (String(tipo).toLowerCase() === '2d') {
        opts = Object.assign({}, opts || {}, { willReadFrequently: true });
      }
      return origGet.call(this, tipo, opts);
    };
    window.__guardaContexto = { instalada: true };
  } catch (e) { window.__guardaContexto = { erro: String(e) }; }
})();