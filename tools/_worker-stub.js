(function(){
  try {
    window.__workerStub = [];
    window.Worker = function(url) {
      var self = this;
      window.__workerStub.push(String(url));
      self.onmessage = null; self.onerror = null;
      self.postMessage = function(){};
      self.terminate = function(){};
      self.addEventListener = function(){};
      self.removeEventListener = function(){};
      setInterval(function(){ try { if (self.onmessage) self.onmessage({ data: 0 }); } catch(e){} }, 250);
    };
  } catch(e) { window.__workerStubErro = String(e); }
})();