// rede-jogo.mjs — captura a rede durante o arranque do jogo (acha o pedido que nunca responde)
const CDP='ws://127.0.0.1:9224/cdp';let ws,id=0;const p=new Map();const ev=[];
const send=(m,pr,s,ms)=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify(s?{id:i,method:m,params:pr||{},sessionId:s}:{id:i,method:m,params:pr||{}}));setTimeout(()=>{if(p.has(i)){p.delete(i);r({__t:true})}},ms||6000)});
ws=new WebSocket(CDP);
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id!==undefined&&p.has(m.id)){const f=p.get(m.id);p.delete(m.id);f(m)}else if(m.method)ev.push(m)});
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
const tg=await send('Target.getTargets');
for(const t of (tg.result.targetInfos||[])) if(t.type==='page'&&/lolidle/.test(t.url)) await send('Target.closeTarget',{targetId:t.targetId});
await new Promise(r=>setTimeout(r,1200));
const nt=await send('Target.createTarget',{url:'about:blank'});
const tid=nt.result&&nt.result.targetId;
const s=(await send('Target.attachToTarget',{targetId:tid,flatten:true})).result.sessionId;
await send('Network.enable',{},s,8000);
await send('Page.navigate',{url:'https://lolidle.com/jogar'},s,8000);
await new Promise(r=>setTimeout(r,14000));
const pedidos=new Map(), respostas=new Set(), falhas=new Map();
for(const m of ev){
  if(m.method==='Network.requestWillBeSent'){const q=m.params.request;pedidos.set(m.params.requestId,{url:q.url.slice(0,110),tipo:m.params.type,t:Date.now()})}
  if(m.method==='Network.responseReceived')respostas.add(m.params.requestId);
  if(m.method==='Network.loadingFailed')falhas.set(m.params.requestId,String(m.params.errorText).slice(0,60));
}
const semResp=[...pedidos.entries()].filter(([k])=>!respostas.has(k)).map(([k,v])=>v.url+(falhas.has(k)?' [FALHOU: '+falhas.get(k)+']':' [SEM RESPOSTA]'));
console.log('total pedidos: '+pedidos.size+' | respondidos: '+respostas.size+' | falhados: '+falhas.size);
console.log('--- ultimos 8 pedidos:');
[...pedidos.values()].slice(-8).forEach(v=>console.log('  '+v.tipo+' '+v.url));
console.log('--- SEM RESPOSTA ('+semResp.length+'):');
semResp.slice(0,10).forEach(u=>console.log('  '+u));
ws.close();process.exit(0);