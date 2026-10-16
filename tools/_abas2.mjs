const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pgs = list.filter(t => t.type === 'page');
console.log('abas totais: ' + pgs.length);
for (const t of pgs) console.log('  ' + (t.id || '?').slice(0, 24) + '  ' + (t.url || '').slice(0, 55) + (t.discarded ? '  [DISCARDED]' : '') + (t.active ? '  [ATIVA]' : ''));
process.exit(0);