for (let i = 1; i <= 13; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const list = await (await fetch('http://127.0.0.1:9224/json/list')).json();
  const jogos = list.filter(t => t.type === 'page' && /lolidle/.test(t.url));
  const tits = jogos.map(t => (t.title || '').slice(0, 34));
  console.log('t=' + (i*3) + 's -> ' + JSON.stringify(tits));
}
process.exit(0);