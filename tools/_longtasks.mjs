const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 10000); });
const nt = await send('Target.createTarget', { url: 'about:blank' });
const s = (await send('Target.attachToTarget', { targetId: nt.result.targetId, flatten: true })).result.sessionId;
await send('Page.enable', {}, s);
await send('Runtime.enable', {}, s);
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__LT = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LT.push({ t: Math.round(e.startTime), d: Math.round(e.duration), nome: e.name, attr: (e.attribution||[]).map(a=>a.name+'/'+a.containerType).join(',') }); }).observe({ entryTypes: ['longtask'] }); } catch (err) { window.__LT = [{ erro: String(err) }]; }
  window.__MARCA = { nav: performance.now() };
` }, s);
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s);
await new Promise(r => setTimeout(r, 15000));
const e = await send('Runtime.evaluate', { expression: "JSON.stringify({lt: (window.__LT||[]).slice(0,10), agora: Math.round(performance.now())})", returnByValue: true }, s);
console.log('LONG TASKS: ' + (e.__t ? 'SEM RESPOSTA (a thread esta bloqueada AGORA)' : String(e.result?.result?.value).slice(0, 900)));
ws.close(); process.exit(0);