(function(){
  try {
    var og = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(t, o){
      if (String(t).toLowerCase() === '2d') { o = Object.assign({}, o || {}, { willReadFrequently: true }); }
      return og.call(this, t, o);
    };
    window.__cpuFix = true;
  } catch(e) { window.__cpuFix = 'erro:' + e; }
  try { var n=0; setInterval(function(){ try { n++; localStorage.setItem('__cpufix', JSON.stringify({n:n,t:Date.now(),fix:window.__cpuFix===true})); } catch(e){} }, 1000); } catch(e){}
})();