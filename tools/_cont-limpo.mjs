const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url));
if (!pg) { console.log('LIMPO: SEM ABA DO JOGO'); process.exit(0); }
let ws = null, s = null;
if (pg.webSocketDebuggerUrl) { ws = new WebSocket(pg.webSocketDebuggerUrl); }
else { ws = new WebSocket('ws://127.0.0.1:9337/cdp'); }
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 10000); });
if (!pg.webSocketDebuggerUrl) { s = (await send('Target.attachToTarget', { targetId: pg.targetId, flatten: true })).result?.sessionId; if (!s) { console.log('LIMPO: sem sessao'); process.exit(0); } }
const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }, s);
const a = await ev("(() => { const t = document.body ? document.body.innerText : ''; const els = [...document.querySelectorAll('button, .botao, [role=button], a, div')]; const b = els.find(x => /continuar aqui|jogar aqui|continuar neste|jogar neste/i.test((x.textContent||'').trim())); return JSON.stringify({ temPrompt: !!b, texto: b ? (b.textContent||'').trim().slice(0,40) : null, corpo: t.slice(0, 160).replace(/\n/g, ' | ') }); })()");
console.log('LIMPO: ' + (a.__t ? '*** SEM RESPOSTA ***' : String(a.result?.result?.value).slice(0, 400)));
if (!a.__t && /"temPrompt":true/.test(String(a.result?.result?.value))) {
  const c = await ev("(() => { const els = [...document.querySelectorAll('button, .botao, [role=button], a, div')]; const b = els.find(x => /continuar aqui|jogar aqui|continuar neste|jogar neste/i.test((x.textContent||'').trim())); if (!b) return 'sem botao'; b.click(); return 'CLIQUEI'; })()");
  console.log('LIMPO: ' + (c.__t ? 'sem resposta' : String(c.result?.result?.value)));
  await new Promise(r2 => setTimeout(r2, 4000));
  const d = await ev("JSON.stringify({ vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, local: (document.querySelector('#local-nome')||{}).textContent||null })");
  console.log('LIMPO DEPOIS: ' + (d.__t ? 'ainda sem resposta' : String(d.result?.result?.value)));
}
ws.close(); process.exit(0);