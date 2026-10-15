// estado-ext.mjs — estado REAL da extensao no Chrome do dono (relay 9224), sem abrir browser novo.
const CDP = 'ws://127.0.0.1:9224/cdp';
const EXT_ID = 'pbdlekcgmpippamdkgbaphcppjafobjo';
let ws, id = 0; const pend = new Map();
const send = (method, params, sid) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify(sid ? { id: i, method, params: params || {}, sessionId: sid } : { id: i, method, params: params || {} })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); res({ __t: true }); } }, 12000); });
(async () => {
  ws = new WebSocket(CDP);
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); p(m); } });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay offline')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); });
  const nt = await send('Target.createTarget', { url: 'chrome://extensions-internals/' });
  const tid = nt.result?.targetId;
  await new Promise(r => setTimeout(r, 3000));
  const sess = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
  const r = await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true }, sess);
  const txt = r.result?.result?.value || '';
  await send('Target.closeTarget', { targetId: tid });
  let data = null; try { data = JSON.parse(txt); } catch {}
  const list = Array.isArray(data) ? data : (data && data.extensions) || [];
  const ours = list.find(e => e.id === EXT_ID);
  console.log(JSON.stringify({ total: list.length, nossa: ours ? { state: ours.state, path: ours.path, erros: (ours.runtime_errors || ours.manifest_errors || []).length } : null, todas: list.map(e => e.id + ':' + (e.manifest?.name || e.name || '?').slice(0, 24)) }, null, 1));
  ws.close(); process.exit(0);
})().catch(e => { console.log(JSON.stringify({ erro: e.message })); process.exit(1); });