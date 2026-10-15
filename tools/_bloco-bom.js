      const hist = live?.hist ? live.hist.slice(-120) : null;   // REPLAY: hits/heals/poções/cargas até a morte
      const build = readEquip().map((e) => e.base + (e.refino ? '+' + e.refino : '') + (e.qual ? '~' + e.qual : ''));
      const morte = { at: Date.now(), by, xpLost: lost, region: loc.text, body: String(entry.body || '').slice(0, 220), pocoes: readPotions(), build, recursos, hist };
      farm.deaths = [morte, ...(farm.deaths || [])].slice(0, 50);
      logEvent('morte', { by, xpLost: lost, region: loc.text, recursos, build });
      if (farm.current) { farm.current.deaths = (farm.current.deaths || 0) + 1; farm.current.deathBy = by; farm.current.xpLost = (farm.current.xpLost || 0) + (lost || 0); }
    }
    if (entry.chefe && /foi derrotado/i.test(entry.body)) {
      const c = farm.current;
      if (c) {
        fechaFase(c.bossFase || c.mobFase, Date.now());
        c.bossDurMs = c.bossStart ? Date.now() - c.bossStart : null;
        c.fim = 'chefe';
        c.endedAt = Date.now(); c.durMs = c.endedAt - c.startedAt;
        farm.cycles.unshift(c);
        farm.cycles = farm.cycles.slice(0, 30);
        farm.current = null;
        registrarLuta(c);
        console.log('[LolidleAuto] ciclo', JSON.stringify({ regiao: c.region, chefe: c.boss, ouro: c.gold, xp: c.xp, mobOuroMin: Math.round(c.mobFase?.perMin?.gold || 0), mobXpMin: Math.round(c.mobFase?.perMin?.xp || 0), bossS: c.bossDurMs ? Math.round(c.bossDurMs / 1000) : null }));
        publishFarm();
      }
    }
    if (farm.current) publishFarm();
  }

  function scanLog() {
    const log = document.querySelector('#log');
    if (!log) return;
    for (const p of log.querySelectorAll('p')) {
      if (seenLog.has(p)) continue;
      seenLog.add(p);
      const t = (p.textContent || '').replace(/\s+/g, ' ').trim();
      handleLog({ body: t.replace(/^\d{1,2}:\d{2}\s*/, ''), chefe: p.classList.contains('chefe'), cls: String(p.className) });
    }
  }