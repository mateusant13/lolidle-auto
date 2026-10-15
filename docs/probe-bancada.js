(async function(){
  var a=window.__lolidleAuto;
  a.pausar(); a.viajarPara('fonte');
  await new Promise(function(r){setTimeout(r,15000);});
  a.clickNPC('Ornn');
  await new Promise(function(r){setTimeout(r,1500);});
  var w=document.querySelector('#janela-npc');
  var mb=w.querySelector('[data-palavra=montar]'); if(mb) mb.click();
  await new Promise(function(r){setTimeout(r,1200);});
  var rb=document.querySelector('#janela-npc button[data-receita="3077"]'); if(rb) rb.click();
  await new Promise(function(r){setTimeout(r,1200);});
  var slots=document.querySelectorAll('#npc-troca [data-slot]').length;
  function ler(){ return Array.from(document.querySelectorAll('#janela-npc SPAN.forja-pegar')).map(function(s){return s.dataset.pegar+'|'+s.className;}).filter(function(x){return x.indexOf('nao-serve')<0;}); }
  var antes=ler();
  var s1=[...document.querySelectorAll('#janela-npc SPAN.forja-pegar')].filter(function(x){return !x.classList.contains('nao-serve')&&!x.classList.contains('na-bigorna');})[0];
  var ref1=s1?s1.dataset.pegar:null;
  if(s1){ s1.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); }
  await new Promise(function(r){setTimeout(r,900);});
  var depois1=ler();
  var cheios1=document.querySelectorAll('#npc-troca .montar-slot.cheio').length;
  var s2=[...document.querySelectorAll('#janela-npc SPAN.forja-pegar')].filter(function(x){return !x.classList.contains('nao-serve')&&!x.classList.contains('na-bigorna');})[0];
  var ref2=s2?s2.dataset.pegar:null;
  if(s2){ s2.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); }
  await new Promise(function(r){setTimeout(r,900);});
  var cheios2=document.querySelectorAll('#npc-troca .montar-slot.cheio').length;
  var btn=document.querySelector('#janela-npc [data-montar="3077"]');
  return JSON.stringify({slots:slots,servemAntes:antes.length,ref1:ref1,cheios1:cheios1,servemDepois1:depois1,ref2:ref2,cheios2:cheios2,btnDisabled:btn?btn.disabled:null});
})()