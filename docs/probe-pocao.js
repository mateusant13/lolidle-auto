(function(){
  var a=window.__lolidleAuto;
  var info = a.getMeta().pocoes || {};
  var out = { preco: {}, info: {}, ouro: a.readGold() };
  ['vida','vidaF','vidaS'].forEach(function(k){
    var el = document.querySelector('#janela-npc [data-comprar="'+k+'"]');
    out.info[k] = info[k] || null;
  });
  // preços reais pelo tooltip/loja, se acessível
  try { out.pocoesInfo = JSON.stringify(info).slice(0,400); } catch(e){}
  return JSON.stringify(out);
})()