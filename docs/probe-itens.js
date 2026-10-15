(function(){
  var m=window.__lolidleAuto.getMeta()||{};
  var itens=m.itens||[];
  var pick={};
  ['3089','3133','3044','1036','3078','3031'].forEach(function(id){
    var it=itens.find(function(x){return String(x.id)===id;});
    if(it){ var o={}; Object.keys(it).forEach(function(k){ if(k!=='efeito'&&k!=='dica') o[k]=it[k]; }); pick[id]=o; }
    else pick[id]='AUSENTE';
  });
  return JSON.stringify({n:itens.length, campos: itens[0]?Object.keys(itens[0]):null, pick:pick});
})()