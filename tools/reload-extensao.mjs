// recarrega a NOSSA extensao no chrome://extensions (shadow DOM) via relay
const CDP='ws://127.0.0.1:9224/cdp';let ws,id=0;const p=new Map();
const send=(m,pr,s,ms)=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify(s?{id:i,method:m,params:pr||{},sessionId:s}:{id:i,method:m,params:pr||{}}));setTimeout(()=>{if(p.has(i)){p.delete(i);r({__t:true})}},ms||8000)});
ws=new WebSocket(CDP);ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id!==undefined&&p.has(m.id)){const f=p.get(m.id);p.delete(m.id);f(m)}});
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
const nt=await send('Target.createTarget',{url:'chrome://extensions/'});
const tid=nt.result&&nt.result.targetId;
await new Promise(r=>setTimeout(r,3500));
const s=(await send('Target.attachToTarget',{targetId:tid,flatten:true})).result.sessionId;
const EXPR = `(() => {
  const walk = (root, acc) => { for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) { acc.push(el.shadowRoot); walk(el.shadowRoot, acc); } } return acc; };
  const roots = walk(document, []);
  const nomes = [];
  let alvo = null;
  for (const r of roots) {
    for (const item of r.querySelectorAll('extensions-item')) {
      const nome = (item.shadowRoot && item.shadowRoot.querySelector('#name')) ? item.shadowRoot.querySelector('#name').textContent.trim() : '';
      nomes.push(nome);
      if (/LoL Idle/i.test(nome)) alvo = item;
    }
  }
  if (!alvo) return JSON.stringify({ achou: false, nomes: nomes.slice(0, 12), raizes: roots.length });
  const btn = alvo.shadowRoot.querySelector('#dev-reload-button') || alvo.shadowRoot.querySelector('#reload-button');
  if (!btn) return JSON.stringify({ achou: true, nome: 'ok', botao: false });
  btn.click();
  return JSON.stringify({ achou: true, botao: true, clicou: true });
})()`;
const e=await send('Runtime.evaluate',{expression:EXPR,returnByValue:true},s,10000);
console.log('RELOAD EXT: ' + (e.__t ? 'TIMEOUT' : String(e.result && e.result.result && e.result.result.value)));
await send('Target.closeTarget',{targetId:tid});
ws.close();process.exit(0);