(async () => {
  const ouvintes = [];
  const escuta = (e) => { if (e.data && e.data.__lolidleAuto === 'meta') ouvintes.push(Object.keys(e.data).sort().join(',')); };
  window.addEventListener('message', escuta);
  window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*');
  await new Promise(r => setTimeout(r, 1200));
  window.removeEventListener('message', escuta);
  return JSON.stringify({ metaChaves: ouvintes[0] || '(sem resposta)', temRmMonstro: ouvintes[0] ? ouvintes[0].includes('rmMonstro') : null, temCurvaPorNivel: ouvintes[0] ? ouvintes[0].includes('curvaPorNivel') : null });
})()