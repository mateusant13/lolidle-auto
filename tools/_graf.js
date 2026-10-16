(function(){
  try { window.requestAnimationFrame = function(){ return 0; }; window.cancelAnimationFrame = function(){}; } catch(e) {}
  try { var n = 0; setInterval(function(){ try { n++; localStorage.setItem('__beat2', JSON.stringify({n:n,t:Date.now()})); } catch(e){} }, 1000); } catch(e) {}
})();