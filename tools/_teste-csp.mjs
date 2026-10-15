const CSP_DONO = "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:* chrome-extension://d167b952-4eba-45b1-b43d-8a556a0db156/";
const html = await (await fetch('https://lolidle.com/jogar')).text();
console.log('corpo obtido: ' + html.length + ' B');
const list = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const pg = list.find(t => t.type === 'page' && /lolidle/.test(t.url)) || list.find(t => t.type === 'page');
const ws = new WebSocket(pg.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); let interceptados = 0;
ws.addEventListener('message', async e => {
  const m = JSON.parse(e.data);
  if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Fetch.requestPaused') {
    interceptados++;
    const r = { id: ++id, method: 'Fetch.fulfillRequest', params: { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Content-Security-Policy', value: CSP_DONO }], body: Buffer.from(html, 'utf8').toString('base64') } };
    ws.send(JSON.stringify(r));
  }
});
await new Promise(r => ws.addEventListener('open', r, { once: true }));
const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 10000); });
await send('Fetch.enable', { patterns: [{ urlPattern: '*lolidle.com/jogar*', requestStage: 'Response' }] });
await send('Page.enable');
await send('Page.navigate', { url: 'https://lolidle.com/jogar?csptest=1' });
for (let i = 1; i <= 7; i++) { await new Promise(r => setTimeout(r, 2500)); const e = await send('Runtime.evaluate', { expression: "JSON.stringify({rs:document.readyState, vida:(document.querySelector('#hud-vida-txt')||{}).textContent||null})", returnByValue: true }); console.log('t=' + (i*2.5) + 's -> ' + (e.__t ? 'TRAVADO' : String(e.result?.result?.value))); }
console.log('interceptados: ' + interceptados);
ws.close(); process.exit(0);