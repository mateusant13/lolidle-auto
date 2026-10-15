(function(){
  var a=window.__lolidleAuto, m=a.getMeta()||{};
  return JSON.stringify({
    retrato: (document.querySelector('#hud-retrato')||{dataset:{}}).dataset.qual||null,
    champAtual: m.champAtual?{id:m.champAtual.id,magia:m.champAtual.magia}:null,
    champMotor: m.champ?{id:m.champ.id,magia:m.champ.magia}:null,
    classe: a.classeCampeao(),
    ident: a.identidadeCampeao().champ.id,
    temGarantir: typeof a.tickAutoplay,
    kits: m.kits?Object.keys(m.kits):null
  });
})()