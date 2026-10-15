(async () => {
  const m = await import('https://lolidle.com/js/motor.js');
  const k = m.KITS.katarina;
  return JSON.stringify({ versao: (m.BALANCO && m.BALANCO.versao) || null, kit: k }, null, 1);
})()