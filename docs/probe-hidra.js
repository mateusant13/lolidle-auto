window.__lolidleAuto.receitasOrnn('Hidra').receitas.map(function(r){
  return r.id + ' ' + r.nome + ' | ouro ' + r.ouro + ' | tent ' + r.tentativasMedias + ' | ' +
    r.comps.map(function(c){ return c.nome + (c.tem ? '(tem)' : '(FALTA)'); }).join(' + ') +
    ' | pode=' + r.pode;
}).join(' ;; ')