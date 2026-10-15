(async () => {
  const r = await fetch('https://lolidle.com/js/motor.js', { cache: 'no-store' });
  const t = await r.text();
  return btoa(unescape(encodeURIComponent(t.slice(240000, 285000))));
})()