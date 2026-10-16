import fs from 'node:fs';
const guarda = fs.readFileSync('I:/!lolidle.com/tools/_guarda.js', 'utf8');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p, sid) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify(sid ? { id: i, method: m, params: p||{}, sessionId: sid } : { id: i, method: m, params: p||{} })); setTimeout(() => r({ __t: true }), 18000); });
const nt = await send('Target.createTarget', { url: 'about:blank' });
const tid = nt.result && nt.result.targetId;
const s = (await send('Target.attachToTarget', { targetId: tid, flatten: true })).result?.sessionId;
console.log('aba: ' + (s ? 'ok' : 'FALHOU'));
if (!s) process.exit(0);
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
const r1 = await send('Page.addScriptToEvaluateOnNewDocument', { source: guarda }, s);
console.log('guarda instalada: ' + (r1.result ? 'ok' : JSON.stringify(r1.error).slice(0,70)));
await send('Page.navigate', { url: 'https://lolidle.com/jogar' }, s);
let vivas = 0, mudas = 0;
for (let i = 1; i <= 12; i++) {
  await new Promise(r => setTimeout(r, 2500));
  const e = await send('Runtime.evaluate', { expression: "JSON.stringify({ rs: document.readyState, login: /Bem-vindo de volta|Senha/i.test(document.body ? document.body.innerText : ''), local: (document.querySelector('#local-nome')||{}).textContent||null, vida: (document.querySelector('#hud-vida-txt')||{}).textContent||null, guarda: !!(window.__guardaReadback) })", returnByValue: true }, s);
  if (e.__t) { mudas++; console.log('t=' + (i*2.5) + 's -> *** SEM RESPOSTA ***'); } else { vivas++; console.log('t=' + (i*2.5) + 's -> ' + String(e.result?.result?.value).slice(0, 180)); }
}
console.log('=== RESULTADO: ' + vivas + ' vivas / ' + mudas + ' mudas (30 s) ===');
ws.close(); process.exit(0);