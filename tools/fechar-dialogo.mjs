const CDP='ws://127.0.0.1:9224/cdp';let ws,id=0;const p=new Map();const ev=[];
const send=(m,pr,s,ms)=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify(s?{id:i,method:m,params:pr||{},sessionId:s}:{id:i,method:m,params:pr||{}}));setTimeout(()=>{if(p.has(i)){p.delete(i);r({__t:true})}},ms||8000)});
ws=new WebSocket(CDP);
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id!==undefined&&p.has(m.id)){const f=p.get(m.id);p.delete(m.id);f(m)}else if(m.method)ev.push(m)});
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
const tg=await send('Target.getTargets');
const a=(tg.result.targetInfos||[]).filter(t=>t.type==='page'&&/lolidle/.test(t.url))[0];
if(!a){console.log('sem aba do jogo');process.exit(0)}
const s=(await send('Target.attachToTarget',{targetId:a.targetId,flatten:true})).result.sessionId;
await send('Page.enable',{},s,8000);
const h=await send('Page.handleJavaScriptDialog',{accept:true},s,8000);
console.log('handleDialog -> '+(h.__t?'TIMEOUT':JSON.stringify(h.result||h.error||'ok')));
await new Promise(r=>setTimeout(r,2000));
const e=await send('Runtime.evaluate',{expression:"document.readyState+'|'+(document.querySelector('#hud-vida-txt')||{}).textContent",returnByValue:true},s,6000);
console.log('EVAL -> '+(e.__t?'TIMEOUT':String(e.result&&e.result.result&&e.result.result.value)));
console.log('eventos Page: '+ev.filter(x=>/Dialog/.test(x.method)).length);
ws.close();process.exit(0);