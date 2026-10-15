JSON.stringify({
  auto: typeof window.__lolidleAuto,
  temGetConfig: !!(window.__lolidleAuto && window.__lolidleAuto.getConfig),
  cfg: (window.__lolidleAuto && window.__lolidleAuto.getConfig) ? window.__lolidleAuto.getConfig() : null,
  teste: (window.__lolidleAuto && window.__lolidleAuto.testeAtivo) ? window.__lolidleAuto.testeAtivo() : null,
  live: window.__lolidleLive ? {hp: window.__lolidleLive.hp, boss: window.__lolidleLive.boss, alvo: window.__lolidleLive.alvo} : null
})