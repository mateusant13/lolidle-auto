(function(){
  var a=window.__lolidleAuto, m=a.getMeta()||{};
  var out={
    retrato: (document.querySelector('#hud-retrato')||{dataset:{}}).dataset.qual||null,
    kitsKeys: m.kits?Object.keys(m.kits):null,
    champAtual: m.champAtual?{id:m.champAtual.id,magia:m.champAtual.magia}:null,
    temYasuo: m.kits?!!m.kits.yasuo:false,
    temKatarina: m.kits?!!m.kits.katarina:false
  };
  var img=document.querySelector('#hud-habs img');
  out.imgSrc = img ? (img.getAttribute('src')||img.src||'').slice(0,120) : null;
  return JSON.stringify(out);
})()