(function(){
  var m = window.__lolidleAuto.getMeta()||{};
  var out = (m.locais||[]).filter(function(l){return !l.arena;}).map(function(l){
    return { id:l.id, nome:(l.nome||'').replace(/ nível.*/,''), nm:l.nm||l.faixa||null, chefe:l.chefe||null, monstros:(l.monstros||[]).length };
  });
  return JSON.stringify({regioes:out, grupoSpawn:m.grupoSpawn||null, furioso:m.furioso||null, noturno:m.noturno||null});
})()