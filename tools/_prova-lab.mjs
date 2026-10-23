// _prova-lab.mjs — prova ao vivo da extensão num perfil de LABORATÓRIO (nunca o do dono).
// Perfil novo => --remote-debugging-port funciona (Chrome 136+ so bloqueia o perfil PADRAO).
// Marcador DISCRIMINANTE: folhasDeReceitaFaltando/clicarIgnorarBasicos so existem no codigo NOVO.
const PORT = Number(process.env.LAB_PORT || 9333);
const EXT = 'I:\\!lolidle.com\\extension';
const v = await (await fetch('http://127.0.0.1:' + PORT + '/json/version')).json();
console.log('chrome lab:', v.Browser);
const ws = new WebSocket(v.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const ctxs = [];
const send = (method, params, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context);
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
const loaded = await send('Extensions.loadUnpacked', { path: EXT });
console.log('loadUnpacked:', JSON.stringify(loaded));
const t = await send('Target.createTarget', { url: 'https://lolidle.com/jogar' });
const att = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
await send('Page.enable', {}, att.sessionId);
await send('Runtime.enable', {}, att.sessionId);
// A extensão é carregada DEPOIS de a página existir; um reload é o que faz o content script
// injectar (Chrome não re-injecta em separadores já abertos).
await new Promise((r) => setTimeout(r, 1200));
await send('Page.reload', { ignoreCache: true }, att.sessionId);
await new Promise((r) => setTimeout(r, 14000));
console.log('contextos:', ctxs.length, ctxs.map((c) => ((c.auxData && c.auxData.type) || '?') + '/' + (c.name || '')).join(' | '));
const probe = 'JSON.stringify({auto: typeof window.__lolidleAuto, build: (window.__lolidleAuto && window.__lolidleAuto.BUILD) || null, folhas: typeof (window.__lolidleAuto && window.__lolidleAuto.folhasDeReceitaFaltando), clicar: typeof (window.__lolidleAuto && window.__lolidleAuto.clicarIgnorarBasicos), pve: typeof (window.__lolidleAuto && window.__lolidleAuto.habilidadeAtivaNoPve), grupo: (() => { try { const a = window.__lolidleAuto.arvoreInterruptores(); return a && a[0] ? a[0].grupo : null; } catch (e) { return null; } })(), pulsoFix: window.__lolidlePulsoFix, titulo: document.title})';
let achou = false;
for (const c of ctxs) {
  try {
    const r = await send('Runtime.evaluate', { expression: probe, contextId: c.id, returnByValue: true }, att.sessionId);
    const raw = r.result && r.result.value;
    console.log('CTX', c.id, (c.auxData && c.auxData.type) || '?', raw || JSON.stringify(r).slice(0, 200));
    if (!raw) continue;
    const o = JSON.parse(raw);
    if (o.folhas === 'function' && o.clicar === 'function' && o.pve === 'function' && o.grupo === 'jogo') achou = true;
  } catch (e) { console.log('CTX', c.id, 'erro', String(e).slice(0, 140)); }
}
console.log(achou ? 'PROVA AO VIVO: BUILD + habilidadeAtivaNoPve + grupo=jogo vivas no mundo da extensao' : 'NAO PROVADO');
process.exit(achou ? 0 : 3);