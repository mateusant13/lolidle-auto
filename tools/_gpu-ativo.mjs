for (const porta of [9351, 9350]) {
  try {
    const list = await (await fetch('http://127.0.0.1:' + porta + '/json/list')).json();
    const pg = list.find(t => t.type === 'page');
    if (!pg || !pg.webSocketDebuggerUrl) { console.log(porta + ': sem aba com ws'); continue; }
    const ws = new WebSocket(pg.webSocketDebuggerUrl);
    let id = 0; const pend = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id !== undefined && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); setTimeout(() => r({ __t: true }), 12000); });
    const expr = "(function(){ try { var c = document.createElement('canvas'); var g = c.getContext('webgl'); if (!g) return 'sem webgl'; var d = g.getExtension('WEBGL_debug_renderer_info'); return JSON.stringify({ renderer: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) }); } catch(e) { return 'erro: ' + e; } })()";
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    console.log('porta ' + porta + ' -> ' + (r.__t ? 'sem resposta' : String(r.result?.result?.value).slice(0, 220)));
    ws.close();
  } catch (e) { console.log(porta + ': offline'); }
}
process.exit(0);