// _gui-prova.mjs — prova AO VIVO da GUI nova, sem tocar no perfil além do attach.
// Attach-only ao relay OMP (nunca imprime /json/list). Avalia no mundo ISOLADO da extensão:
//  - marcadores discriminantes das funções novas (buildHumana, historico48h)
//  - abre o painel por código, troca por CADA aba e confirma que o pane certo ficou visível
//  - enumera os botões de cada aba (blast radius), SEM clicar em nada que gaste.
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0;
const pend = new Map();
const ctxs = [];
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.method === 'Runtime.executionContextCreated' && m.params?.context) ctxs.push(m.params.context);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
});
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});

const { targetInfos } = await send('Target.getTargets');
const jogos = targetInfos.filter((x) => x.type === 'page' && /(^|\.)lolidle\.com/i.test((x.url || '').replace(/^https?:\/\//, '')));
if (!jogos.length) { console.log('SEM JOGO'); ws.close(); process.exit(2); }
const { sessionId } = await send('Target.attachToTarget', { targetId: jogos[0].targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await new Promise((r) => setTimeout(r, 400));

const evalCtx = async (expression, contextId) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, contextId }, sessionId);
  if (r.exceptionDetails) return { excecao: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
  return r?.result?.value;
};

const alvo = ctxs.filter((c) => /^chrome-extension:\/\//i.test(c.origin || ''));
let escolhido = null;
for (const c of alvo) {
  const t = await evalCtx('typeof window.__lolidleAuto', c.id);
  if (t === 'object') { escolhido = c; break; }
}
if (!escolhido) { console.log('SEM MUNDO __lolidleAuto'); ws.close(); process.exit(3); }
console.log('CTX_MOTOR=' + escolhido.id);

const marca = await evalCtx(`JSON.stringify({
  auto: typeof window.__lolidleAuto,
  gui: typeof window.__lolidleGui,
  buildHumana: typeof (window.__lolidleAuto||{}).buildHumana,
  historico48h: typeof (window.__lolidleAuto||{}).historico48h,
  painel: !!document.querySelector('#lolidle-ap'),
  hpCard: !!document.querySelector('#lolidle-hp-inimigos'),
  pocaoV2: window.__lolidlePocaoV2||null
})`, escolhido.id);
console.log('MARCAS=' + marca);

if (typeof (JSON.parse(marca || '{}')).gui === 'string' && (JSON.parse(marca || '{}')).gui === 'object') {
  const res = await evalCtx(`(() => {
    const G = window.__lolidleGui; const out = {};
    try { G.abrir(); } catch (e) { out.abrir = String(e); }
    const abas = [...document.querySelectorAll('#lolidle-ap .tab')].map((b) => b.dataset.tab);
    out.abas = abas;
    out.porAba = {};
    for (const a of abas) {
      try {
        G.setTab(a);
        const pane = document.querySelector('#lolidle-ap .pane.on');
        const botoes = pane ? [...pane.querySelectorAll('button[id]')].map((b) => b.id) : [];
        out.porAba[a] = { pane: pane ? pane.id : null, botoes };
      } catch (e) { out.porAba[a] = { erro: String(e) }; }
    }
    try { G.fechar(); } catch (e) { out.fechar = String(e); }
    return JSON.stringify(out);
  })()`, escolhido.id);
  console.log('GUI=' + res);
}

// buildHumana e historico48h — forma real do retorno (não inventada)
const bh = await evalCtx(`(() => { try { const b = window.__lolidleAuto.buildHumana(); return JSON.stringify({ regiao: b.regiao, campeao: b.campeao, classe: b.classe, itens: (b.build||[]).length, skills: (b.skills||[]).map(s => ({ conjunto: s.conjunto, tipos: s.tipos, viavel: s.viavel, faltando: s.faltando })), wave: b.waveMedia }); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
console.log('BUILD=' + bh);
const hist = await evalCtx(`(() => { try { const h = window.__lolidleAuto.historico48h(); return JSON.stringify({ n: h.length, tipos: [...new Set(h.map(e => e.type))].slice(0, 12) }); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
console.log('HIST=' + hist);

// Rotação em DRY-RUN (não aplica nada) + recomendação (o default seguro do "farmar agora")
const rot = await evalCtx(`(async () => { try { const r = await window.__lolidleAuto.rotacaoSkills(true); return JSON.stringify({ ok: r.ok, mudou: r.mudou, antes: r.antes, desejadas: r.desejadas, fase: r.fase, dificil: r.dificil, usarUlt: r.usarUlt, vagas: r.vagas }); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
console.log('ROT=' + rot);
const rec = await evalCtx(`(() => { try { const r = window.__lolidleAuto.recomendar(); return JSON.stringify(r ? { regiao: r.regiao, sobrevive: r.sobrevive, ouroLiquidoMin: r.ouroLiquidoMin } : null); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
console.log('REC=' + rec);
const saude = await evalCtx(`(() => { const A = window.__lolidleAuto; try { return JSON.stringify({ saude: A.saudeAutoplay && A.saudeAutoplay(), pausado: A.estaPausado && A.estaPausado(), podeAgir: A.podeAgir && A.podeAgir(), cmd: A.cmdEstado || null }); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
console.log('SAUDE=' + saude);
if (process.argv.includes('--aplicar')) {
  const ap = await evalCtx(`(async () => { try { const r = await window.__lolidleAuto.rotacaoSkills(false); return JSON.stringify({ ok: r.ok, mudou: r.mudou, aplicado: r.aplicado, antes: r.antes, desejadas: r.desejadas }); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
  console.log('APLICAR=' + ap);
  const bar = await evalCtx(`(() => { try { return JSON.stringify(window.__lolidleAuto.lerBarra()); } catch (e) { return 'ERRO ' + e; } })()`, escolhido.id);
  console.log('BARRA_DEPOIS=' + bar);
}
const obs = await evalCtx(`(() => { const c = document.querySelector('#lolidle-hp-inimigos'); return JSON.stringify({ alguem: !!c, texto: c ? (c.textContent||'').trim().slice(0,120) : null }); })()`, escolhido.id);
console.log('OBS=' + obs);

ws.close();
