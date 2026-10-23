// _prova-gui-abas.mjs — prova AO VIVO da GUI por aba, attach-only (nao cria nem fecha abas).
//
// Porque existe (2026-10-23): a GUI so desenha a aba ACTIVA (REGRA Nº 4 deste repo) e um probe
// feito com o painel FECHADO mede tudo a 0x0 e parece "layout partido". Duas vezes perdemos tempo
// com isso. Este script faz a sequencia certa, sempre:
//
//   1. liga-se ao alvo do jogo que JA existe (nunca abre janela, nunca imprime /json/list);
//   2. guarda se o painel estava aberto e ABRE-o se for preciso (o dono pode te-lo fechado);
//   3. clica a aba pedida (o handler e' delegado no `#ap-tabs`);
//   4. mede o que interessa: altura/largura das linhas de itens, linhas por `.frames`, chips sem icone;
//   5. DEVOLVE o painel ao estado em que estava.
//
// Uso:  node tools/_prova-gui-abas.mjs itens
//       node tools/_prova-gui-abas.mjs farm
//       node tools/_prova-gui-abas.mjs painel
//
// Saida: uma linha JSON. `ok:true` significa que a aba desenhou e as metricas sao legitimas.

const ABA = (process.argv[2] || 'painel').replace(/[^a-z0-9-]/gi, '');
const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
await new Promise((r, j) => {
  ws.addEventListener('open', r, { once: true });
  ws.addEventListener('error', j, { once: true });
});
let id = 0;
const pend = new Map();
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const i = ++id;
  pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});
ws.addEventListener('message', (e) => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id); pend.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
});

const { targetInfos } = await send('Target.getTargets');
const alvo = targetInfos.find((x) => x.type === 'page' && /(^|\.)lolidle\.com/i.test(String(x.url || '').replace(/^https?:\/\//, '')));
if (!alvo) { console.log(JSON.stringify({ ok: false, erro: 'sem aba do jogo' })); process.exit(2); }
const { sessionId } = await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);

const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    return 'ERRO ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text);
  }
  return r.result.value;
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const alturaPainel = () => ev(`(()=>{const p=document.querySelector('#lolidle-ap');return p?Math.round(p.getBoundingClientRect().height):-1;})()`);
const antes = await alturaPainel();
const eraFechado = antes === 0;
if (eraFechado) {
  await ev(`(()=>{const l=document.querySelector('#lolidle-ap-launch');if(l)l.click();})()`);
  await espera(1200);
}
await ev(`(()=>{const b=document.querySelector('#lolidle-ap [data-tab="${ABA}"]');if(b)b.click();})()`);
await espera(2500);

const medidas = await ev(`JSON.stringify((()=>{
  const qa=(s)=>[...document.querySelectorAll('#lolidle-ap '+s)];
  const pane=document.querySelector('#lolidle-ap #ap-t-${ABA}');
  const linhas=qa('.frames').map((f)=>({
    h: Math.round(f.getBoundingClientRect().height),
    w: Math.round(f.getBoundingClientRect().width),
    itens: f.children.length,
    linhas: new Set([...f.children].map((c)=>Math.round(c.getBoundingClientRect().top))).size,
  }));
  const chips=qa('#ap-it-mochila .chip');
  return {
    aba: '${ABA}',
    desenhou: !!pane && Math.round(pane.getBoundingClientRect().height) > 0,
    pane: pane ? Math.round(pane.getBoundingClientRect().height) : -1,
    linhasDeItens: linhas,
    itensEmpilhados: linhas.filter((l)=>l.linhas > 1).length,
    chipsMochila: chips.length,
    chipsSemIcone: chips.filter((c)=>!c.querySelector('img')).length,
    imgsQuebradas: qa('.frames img').filter((i)=>i.complete && i.naturalWidth===0).length,
    fraseTarefa: /Sem tarefa ativa/.test(document.documentElement.innerHTML),
    pin: !!document.querySelector('#lolidle-ap #ap-pin'),
  };
})())`);

if (eraFechado) {
  await ev(`(()=>{const b=document.querySelector('#lolidle-ap #ap-close');if(b)b.click();})()`);
  await espera(500);
}
const depois = await alturaPainel();
console.log(JSON.stringify({ ok: typeof medidas === 'string' && medidas.startsWith('{'), painelRestaurado: depois === antes, medidas: typeof medidas === 'string' ? JSON.parse(medidas) : medidas }));
process.exit(0);
