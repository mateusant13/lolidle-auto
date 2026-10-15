const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
console.log('abas do jogo: ' + jogos.length);
for (const t of jogos) console.log('  campos=' + Object.keys(t).join(',') + ' | id=' + (t.id||t.targetId||'?') + ' | url=' + t.url.slice(0,40));
process.exit(0);