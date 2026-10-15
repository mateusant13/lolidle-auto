(function(){
  var a = window.__lolidleAuto;
  var eq = a.readEquip();
  var sk = a.readSkills();
  var p = a.player();
  var b = a.scanBag();
  var m = a.getMeta() || {};
  return JSON.stringify({
    nivel: p.nivel, vida: p.vida, dano: p.dano, poder: p.poder, armadura: p.armadura, rm: p.rm,
    loc: a.readLocation().text, regiaoIdeal: a.regiaoIdeal(),
    equip: eq.map(function(e){ return { base: e.base, qual: e.qual, refino: e.refino, nome: (a.infoItem(e.base)||{}).nome, rar: (a.infoItem(e.base)||{}).raridade }; }),
    barra: sk.bar, arsenal: (sk.arsenal||[]).map(function(h){ return { t:h.t, nome:h.name, rank:h.rank, naBarra:h.onBar }; }),
    pontosSkill: sk.pontos,
    bag: b.items.filter(function(i){ return i.kind==='item'; }).map(function(i){ return { base:i.base, qual:i.qual, refino:i.refino, rar:i.raridade, nome:(a.infoItem(i.base)||{}).nome }; }),
    bagUsed: b.used, bagCap: b.cap,
    atributos: (function(){ try { return Array.from(document.querySelectorAll('.atrib-nome')).map(function(x){ return x.textContent.trim(); }); } catch(e){ return null; } })(),
    gold: a.readGold(), ident: a.identidadeCampeao().champ.id,
    componenteBuild: Array.from(a.componentesDaBuild ? a.componentesDaBuild() : []),
    buildIdeal: a.buildIdeal(),
    melhorSetMob: a.melhorSet('mob')
  });
})()