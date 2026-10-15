const t0 = Date.now();
for (const f of ["ator.test.mjs","atributos.test.mjs","barra.test.mjs","barrafase.test.mjs","chefe.test.mjs","cofre.test.mjs","equip.test.mjs","fuga.test.mjs","hud.test.mjs","integracao.test.mjs","interruptores.test.mjs","motor-tabelas.test.mjs","numeros.test.mjs","objetivo.test.mjs","passivas.test.mjs","planejar.test.mjs","pontos.test.mjs","refinar.test.mjs","regiao.test.mjs","regras-motor.test.mjs","regras.test.mjs","score.test.mjs","snapshots.test.mjs","w10.test.mjs","w2-audita-tk02-06.test.mjs","w2-audita-tk02-101.test.mjs","w2-audita-tk02-35.test.mjs","w5-itens.test.mjs"]) {
  const a = Date.now();
  try { await import('./' + f); } catch (e) { console.log('ERRO ' + f + ': ' + String(e.message).slice(0, 60)); }
  console.log(f + ' -> ' + (Date.now() - a) + 'ms');
}
console.log('TOTAL ' + (Date.now() - t0) + 'ms');
