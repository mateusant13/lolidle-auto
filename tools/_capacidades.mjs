const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 12000); });
// testar as capacidades que interessam para isolar o jogo sem tocar no Chrome do dono
for (const [m, p] of [['Target.createBrowserContext',{}], ['Browser.getVersion',{}], ['Extensions.loadUnpacked',{path:'I:\\!lolidle.com\\extension'}], ['Target.getTargets',{}]]) {
  const r = await send(m, p);
  console.log(m + ' -> ' + (r.__t ? 'SEM SUPORTE' : JSON.stringify(r.result || r.error).slice(0, 140)));
}
ws.close(); process.exit(0);