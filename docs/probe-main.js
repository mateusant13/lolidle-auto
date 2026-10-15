JSON.stringify({
  href: location.href,
  title: document.title,
  champ: (document.querySelector('#hud-retrato')||{dataset:{}}).dataset.qual || null,
  loc: (document.querySelector('#local-nome')||{}).textContent || null,
  hp: (document.querySelector('#hud-vida-txt')||{}).textContent || null,
  nivel: (document.querySelector('#hud-nivel')||{}).textContent || null,
  alvo: (document.querySelector('#hud-alvo')||{}).textContent || null,
  log: Array.from(document.querySelectorAll('#log p')).slice(-10).map(p=>p.textContent.trim())
})