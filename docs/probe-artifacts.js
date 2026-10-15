JSON.stringify({
  apIds: Array.from(document.querySelectorAll('[id^="ap-"],[id^="lolidle"],[class*="lolidle"]')).slice(0,12).map(e=>e.id||e.className),
  fillTextPatched: String(CanvasRenderingContext2D.prototype.fillText).indexOf('[native code]') === -1,
  temLiveGlobal: typeof window.__lolidleLive,
  temAutoGlobal: typeof window.__lolidleAuto,
  champ: (document.querySelector('#hud-retrato')||{dataset:{}}).dataset.qual || null,
  loc: (document.querySelector('#local-nome')||{}).textContent || null,
  hp: (document.querySelector('#hud-vida-txt')||{}).textContent || null,
  nivel: (document.querySelector('#hud-nivel')||{}).textContent || null
})