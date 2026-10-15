(async () => {
  const ouvintes = [];
  const escuta = (e) => { if (e.data && e.data.__lolidleAuto) ouvintes.push(Object.keys(e.data).join('+') + ':' + (e.data.tipo || e.data.__lolidleAuto)); };
  window.addEventListener('message', escuta);
  window.postMessage({ __lolidleAuto: 'pedir-meta' }, '*');
  await new Promise(r => setTimeout(r, 900));
  window.removeEventListener('message', escuta);
  const guiIds = ['__lolidle','lolidle-auto','auto-pocao','#hud-bolsa'];
  const gui = {};
  document.querySelectorAll('[id]').forEach(el => { if (/lolidle|auto-?po|katana|ext-/i.test(el.id)) gui[el.id] = 1; });
  return JSON.stringify({ respostasDoMeta: ouvintes, elementosComIdRelacionado: Object.keys(gui), titulo: document.title });
})()