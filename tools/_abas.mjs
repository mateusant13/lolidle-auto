const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const pgs = list.filter(t => t.type === 'page');
console.log('abas abertas: ' + pgs.length);
for (const t of pgs) console.log('  ' + t.id.slice(0,22) + '  ' + t.url.slice(0, 55));
process.exit(0);