try {
  const v = await (await fetch('http://127.0.0.1:9224/json/version')).json();
  console.log('relay: ' + v.Browser);
} catch { console.log('relay OFF (esperado)'); }
process.exit(0);