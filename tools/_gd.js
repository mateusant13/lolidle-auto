(function(){
  window.__t0 = Date.now();
  try {
    var og = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(t, o){
      if (String(t).toLowerCase() === '2d') { o = Object.assign({}, o || {}, { willReadFrequently: true }); }
      return og.call(this, t, o);
    };
  } catch(e) {}
  try {
    var n = 0;
    setInterval(function(){ try { n++; localStorage.setItem('__beat', JSON.stringify({n:n,t:Date.now()})); } catch(e){} }, 1000);
  } catch(e) {}
})();