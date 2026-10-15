#!/usr/bin/env bun
/**
 * ll.mjs — CLI ÚNICA para operar a extensão LoL Idle via CDP.
 * Nada de reescrever seletor: cada comando chama window.__lolidleAuto.*.
 *
 * Uso:  bun tools/ll.mjs <cmd> [args...]
 *
 *   status                 estado (local, cfg, hp, poções, teste)
 *   player                 atributos do personagem
 *   bag                    mochila (itens + espólio)
 *   potions                contagem de poções
 *   skills                 barra + arsenal (nomes)
 *   deaths                 mortes persistidas (com replay)
 *   bosses                 lutas de chefe persistidas
 *   market                 minhas ofertas no mercado
 *   get <base>             TRAZ o item (mochila → cofre → cancela anúncio); ex.: get 6653
 *   travel <localId>       viaja (dragao, barao, rio, vermelho, azul, lobos, ...)
 *   recall                 volta pra Fonte (B)
 *   base                   rotina de base (vender · curar · repor)
 *   sell                   vender no lojista
 *   equip <id,id,...>      equipa o conjunto (Rabadon etc.)
 *   cofre                  lê o cofre aberto
 *   cancel <id>            cancela uma oferta (precisa estar na Fonte)
 *   test <json>            inicia teste de conjuntos: '[{"nome":"x","itens":["3089"]}]'
 *   stop-test              para o teste
 *   enable on|off          liga/desliga a automação
 *   eval '<js>'            avalia JS cru no mundo isolado
 */
import { spawnSync } from 'node:child_process';

const RELAY = process.env.EXT_RELOAD_CDP || 'ws://127.0.0.1:9224/cdp';
const ORIGIN = process.env.LL_ORIGIN || 'chrome-extension://pbdlekcgmpippamdkgbaphcppjafobjo';
const DRIVER = process.env.LL_DRIVER || 'I:/!manager/tools/ext-reload-cdp.mjs';
const A = 'window.__lolidleAuto';
const j = (o) => JSON.stringify(o);

const [cmd, ...rest] = process.argv.slice(2);
// --conta katarina|yasuo : cada conta vive no SEU navegador (ver CONTAS abaixo).
let CONTA = process.env.LL_CONTA || 'katarina';
{
  const i = rest.indexOf('--conta');
  if (i >= 0) { CONTA = rest[i + 1]; rest.splice(i, 2); }
}
const arg = rest.join(' ');
if (!cmd) { console.error('uso: bun tools/ll.mjs <cmd> [args] [--conta katarina|yasuo]'); process.exit(2); }

// Envelope único {v:valor, e:erro, t:teste} — evita uma SEGUNDA chamada CDP por comando (era o dobro do tempo).
const WRAP = (fn) => `(function(){var __r=null,__e=null;try{__r=${fn};}catch(e){__e=String(e);}var __t=null;try{var a=window.__lolidleAuto;if(a&&a.testeAtivo&&a.testeAtivo()){var s=a.testeEstado&&a.testeEstado();__t={fase:s&&s.fase,i:s&&s.i,nome:s&&s.nome};}}catch(_){}return JSON.stringify({v:__r,e:__e,t:__t});})()`;
const J = (fn) => WRAP(fn);
const JA = (fn) => `(async function(){var __r=null,__e=null;try{__r=await (${fn});}catch(e){__e=String(e);}var __t=null;try{var a=window.__lolidleAuto;if(a&&a.testeAtivo&&a.testeAtivo()){var s=a.testeEstado&&a.testeEstado();__t={fase:s&&s.fase,i:s&&s.i,nome:s&&s.nome};}}catch(_){}return JSON.stringify({v:__r,e:__e,t:__t});})()`;

const CMDS = {
  status: () => J(`(()=>{const a=${A};const l=window.__lolidleLive||{};return{loc:(document.querySelector('#local-nome')||{}).textContent,cfg:a.getConfig(),hp:l.hp,pot:a.readPotions(),teste:a.testeAtivo()};})()`),
  player: () => J(`${A}.player()`),
  bag: () => J(`(()=>{const b=${A}.scanBag();return{used:b.used,cap:b.cap,itens:b.items.filter(i=>i.kind==='item').map(i=>({base:i.base,qual:i.qual,refino:i.refino,raridade:i.raridade})),espolios:b.items.filter(i=>i.kind==='espolio').length};})()`),
  potions: () => J(`${A}.readPotions()`),
  skills: () => J(`(()=>{const s=${A}.readSkills();return{barra:s.bar,arsenal:(s.arsenal||[]).map(h=>({t:h.t,nome:h.name,rank:h.rank,naBarra:h.onBar}))};})()`),
  deaths: () => J(`(()=>{const f=${A}.getFarm();return(f.deaths||[]).map(m=>({at:m.at,by:m.by,region:m.region,xpLost:m.xpLost,pocoes:m.pocoes,build:m.build,histN:(m.hist||[]).length}));})()`),
  bosses: () => J(`(()=>{const f=${A}.getFarm();return(f.lutas||[]).map(l=>({at:l.at,boss:l.boss,region:l.region,durS:l.durS,mortes:l.mortes,hpMinPct:l.hpMinPct,xpPerdido:l.xpPerdido,potUsadas:l.potUsadas,realHealS:l.healSkillS,outDps:l.analise&&l.analise.outDps,inDps:l.analise&&l.analise.inDps,build:l.build,skills:l.skills}));})()`),
  luta: () => J(`(()=>{const f=${A}.getFarm();return(f.lutas||[])[${Number(rest[0]) || 0}]||null;})()`),
  bossstats: () => J(`(()=>{const f=${A}.getFarm();const arr=f.lutas||[];const g={};
    const add=(k,l)=>{const o=g[k]=g[k]||{n:0,mortes:0,hpMin:100,pot:0,dur:0,inDps:0,outDps:0,healS:0};o.n++;if(l.mortes>0)o.mortes++;o.hpMin=Math.min(o.hpMin,l.hpMinPct!=null?l.hpMinPct:100);o.pot+=l.potUsadas||0;o.dur+=l.durS||0;o.inDps+=(l.analise&&l.analise.inDps)||0;o.outDps+=(l.analise&&l.analise.outDps)||0;o.healS+=l.healSkillS||0;};
    for(const l of arr){add('build: '+(l.build||[]).join(','),l);add('skill: '+(l.skills||[]).join('/'),l);add('build+skill: '+(l.build||[]).join(',')+' | '+(l.skills||[]).join('/'),l);}
    const fin=(o)=>({n:o.n,mortes:o.mortes,hpMin:o.hpMin,potMed:+(o.pot/o.n).toFixed(1),durMed:+(o.dur/o.n).toFixed(1),inDps:Math.round(o.inDps/o.n),outDps:Math.round(o.outDps/o.n),healS:Math.round(o.healS/o.n)});
    const res={};for(const k in g)res[k]=fin(g[k]);return res;})()`),
  market: () => JA(`${A}.lerMinhasOfertas()`),
  get: () => JA(`${A}.obterItem(${j(String(rest[0] || ''))})`),
  travel: () => J(`(()=>{${A}.viajarPara(${j(String(rest[0] || ''))});return{ok:true,indo:${j(String(rest[0] || ''))}};})()`),
  recall: () => J(`(()=>{${A}.press('b');return{ok:true};})()`),
  base: () => JA(`${A}.acaoBase()`),
  sell: () => JA(`${A}.venderBase()`),
  equip: () => JA(`${A}.aplicarItens(${j((rest[0] || '').split(',').map((x) => x.trim()).filter(Boolean))})`),
  // dps [regiao] : sem argumento usa a localizacao ATUAL. Passar a regiao evita
  // o falso "regiao fonte / mob null" que aparece por correr o comando na base.
  dps: () => J(`${A}.dpsCenarios(${A}.readEquip().map(e=>e.base), ${rest[0] ? j(String(rest[0])) : `${A}.localId(${A}.readLocation().text)`})`),
  cofre: () => J(`${A}.lerCofreSlots()`),
  'cofre-abrir': () => JA(`${A}.abrirCofreTesoureira()`),
  cancel: () => J(`(()=>{const r=${A}.cancelarOferta(${j(String(rest[0] || ''))});return{ok:r,id:${j(String(rest[0] || ''))}};})()`),
  'stop-test': () => J(`${A}.pararTeste()`),
  testes: () => JA(`new Promise(res=>{chrome.storage.local.get('lolidleAutoPotion:testes',r=>res(((r['lolidleAutoPotion:testes']||{}).rodadas)||[]))})`),
  progresso: () => J(`(()=>{const a=${A};const f=a.getFarm();const c=f.current||{};const t=(a.testeEstado&&a.testeEstado())||null;return{teste:a.testeAtivo(),fase:t&&t.fase,nome:t&&t.nome,i:t&&t.i,total:t&&t.total,feitos:t&&t.feitos,mobSeg:t&&t.mobSeg,mobAlvo:t&&t.mobAlvo,chefeEspera:t&&t.chefeEspera,matandoChefe:t&&t.matandoChefe,farmFase:c.fase||null,boss:c.boss||null,region:c.region||null,deaths:c.deaths||0,hp:(window.__lolidleLive||{}).hp||null};})()`),
  // FIX: faltava a INVOCACAO () no fim — devolvia a propria funcao e o envelope
  // virava JSON.stringify(funcao) = undefined. O comando parecia "sem dados".
  farm: () => J(`(()=>{const f=${A}.getFarm();return{cycles:(f.cycles||[]).slice(0,12).map(c=>({at:c.at,region:c.region,boss:c.boss,fim:c.fim,deaths:c.deaths||0,bossS:c.bossDurMs?Math.round(c.bossDurMs/1000):null,mob:c.mobFase&&c.mobFase.perMin?{gold:Math.round(c.mobFase.perMin.gold),xp:Math.round(c.mobFase.perMin.xp),kills:+(c.mobFase.perMin.kills||0).toFixed(1)}:null})),lutas:(f.lutas||[]).length,deaths:(f.deaths||[]).length};})()`),
  eval: () => WRAP(`(${arg})`),
  // aeval: eval ASSINCRONO (await na promessa). Sem isto, avaliar uma funcao async
  // devolvia {} porque o WRAP e sincrono.
  aeval: () => JA(`(${arg})`),
};

// enable: precisa gravar no storage de forma async
if (cmd === 'enable') {
  const on = /^(on|true|1)$/i.test(String(rest[0] || 'on'));
  CMDS.enable = () => JA(`new Promise(res=>{chrome.storage.local.get('lolidleAutoPotion',r=>{const c=r['lolidleAutoPotion']||{};c.enabled=${on};chrome.storage.local.set({'lolidleAutoPotion':c},()=>res({ok:true,enabled:${on}}));});})`);
}
if (cmd === 'test') {
  const sets = arg || '[]';
  CMDS.test = () => J(`${A}.iniciarTeste(${sets}, { regiao: 'dragao', mobSeg: 60 })`);
}

if (!CMDS[cmd]) { console.error('comando desconhecido: ' + cmd + '\ndisponíveis: ' + Object.keys(CMDS).join(', ')); process.exit(2); }

// ---- contas: cada uma tem o SEU navegador e a SUA lista de alvos ----
//   katarina -> Chrome do dono (Scriptingkata), via relay do manager
//   yasuo    -> Chrome convidado (perfil C:/Temp/llguest, porta 9233), CDP direto
const CONTAS = {
  katarina: { list: 'http://127.0.0.1:9224/json/list', cdp: 'ws://127.0.0.1:9224/cdp' },
  yasuo: { list: 'http://127.0.0.1:9233/json/list', port: 9233, cdp: null },
};
const CFG = CONTAS[CONTA];
if (!CFG) { console.error('conta desconhecida: ' + CONTA + ' (katarina|yasuo)'); process.exit(2); }

// ---- descobre o alvo (aba do jogo) ----
let list;
try { list = await (await fetch(CFG.list)).json(); }
catch (e) { console.error('sem CDP para a conta ' + CONTA + ' (' + CFG.list + '): ' + e.message); process.exit(1); }
const game = list.filter((t) => /lolidle/.test(t.url || '') && /jogar/.test(t.url || ''));
if (!game.length) { console.error('sem aba do jogo aberta em lolidle.com/jogar (conta ' + CONTA + ')'); process.exit(1); }
const target = game[0].id;

// ---- resolve o endpoint CDP da conta ----
let cdp = CFG.cdp;
if (!cdp) {
  try { cdp = (await (await fetch('http://127.0.0.1:' + CFG.port + '/json/version')).json()).webSocketDebuggerUrl; }
  catch (e) { console.error('sem /json/version na porta ' + CFG.port + ': ' + e.message); process.exit(1); }
}

// ---- roda a expressão pelo driver ----
const expr = CMDS[cmd]();
const r = spawnSync('bun', [DRIVER, '--target', target, '--context-origin', ORIGIN, '--expr', expr, '--await'], { encoding: 'utf8', env: { ...process.env, EXT_RELOAD_CDP: cdp } });
if (r.error) { console.error('falha ao chamar o driver:', r.error.message); process.exit(1); }

const line = (r.stdout || '').trim().split('\n').pop() || '';
try {
  const env = JSON.parse(line);              // envelope do driver {ok, value, ctx}
  const payload = JSON.parse(env.value);     // nosso envelope {v, e, t}
  if (payload.t && cmd !== 'status') console.error(`\n⚠  TESTE DE BUILDS EM ANDAMENTO (fase ${payload.t.fase || '?'}${payload.t.i != null ? ' · variação ' + (payload.t.i + 1) : ''}${payload.t.nome ? ' · ' + payload.t.nome : ''}) — não interfira.\n`);
  if (payload.e) console.error('erro no eval:', payload.e);
  console.log(JSON.stringify(payload.e && payload.v == null ? { erro: payload.e } : payload.v, null, 2));
} catch {
  try { console.log(JSON.stringify(JSON.parse(line), null, 2)); } catch { console.log(line || r.stderr); }
}
