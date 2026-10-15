(function(){ if (window.chrome && window.chrome.storage) return;
  const K='__shim_store'; const ler=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return{}}};
  const gravar=(o)=>{try{localStorage.setItem(K,JSON.stringify(o))}catch(e){}};
  const subs=[];
  window.chrome = window.chrome || {};
  window.chrome.storage = { local: {
    get: (keys, cb) => { const s=ler(); let out={}; if (keys==null) out=s; else if (typeof keys==='string') out[keys]=s[keys]; else if (Array.isArray(keys)) for(const k of keys) out[k]=s[k]; else for(const k of Object.keys(keys)) out[k]=(s[k]!==undefined?s[k]:keys[k]); setTimeout(()=>{try{cb&&cb(out)}catch(e){}},0); },
    set: (obj, cb) => { const s=ler(); Object.assign(s,obj); gravar(s); for(const f of subs) { try{ f({}, 'local') }catch(e){} } setTimeout(()=>{try{cb&&cb()}catch(e){}},0); },
    remove: (k, cb) => { const s=ler(); (Array.isArray(k)?k:[k]).forEach(x=>delete s[x]); gravar(s); setTimeout(()=>{try{cb&&cb()}catch(e){}},0); },
    clear: (cb) => { gravar({}); setTimeout(()=>{try{cb&&cb()}catch(e){}},0); } },
    onChanged: { addListener: (f)=>subs.push(f), removeListener: (f)=>{const i=subs.indexOf(f); if(i>=0)subs.splice(i,1);} } };
  window.chrome.runtime = window.chrome.runtime || { id:'shim', getURL:(p)=>p, sendMessage:()=>{}, onMessage:{addListener:()=>{}} };
})();