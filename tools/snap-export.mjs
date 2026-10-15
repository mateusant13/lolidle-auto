#!/usr/bin/env bun
// snap-export.mjs — reescreve docs/snapshots/*.json a partir do MOTOR AO VIVO (relay).
// Nao joga o jogo: so LE o que o motor ja mediu. Resolve o "snapshot podre".
import fs from 'node:fs';
const CDP = process.env.RELAY_CDP || 'ws://127.0.0.1:9224/cdp';
const TARGET = process.argv[2];
const DIR = process.argv[3] || 'I:/!lolidle.com/docs/snapshots';
let ws, id = 0; const pend = new Map();
function send(m, p, sid) {
  const i = ++id;
  ws.send(JSON.stringify(sid ? { id: i, method: m, params: p, sessionId: sid } : { id: i, method: m, params: p }));
  return new Promise((res, rej) => { const t = setTimeout(() => { pend.delete(i); rej(new Error('timeout ' + m)); }, 40000); pend.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } }); });
}
ws = new WebSocket(CDP);
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id !== undefined && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay timeout')), 6000); ws.addEventListener('open', () => { clearTimeout(t); res(); }, { once: true }); ws.addEventListener('error', () => { clearTimeout(t); rej(new Error('relay offline')); }, { once: true }); });
const sess = (await send('Target.attachToTarget', { targetId: TARGET, flatten: true })).sessionId;
// O MOTOR vive no MUNDO ISOLADO da extensao, nao no MAIN. Sem escolher o contextId certo,
// `window.__lolidleAuto` e undefined e TUDO falha com 'Uncaught' (foi o meu primeiro erro aqui).
const ctxs = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.executionContextCreated') ctxs.push(m.params.context); });
await send('Runtime.enable', {}, sess);
await new Promise((r) => setTimeout(r, 1200));
const EXT = 'chrome-extension://';
const ctxExt = ctxs.filter((c) => String(c.origin || '').startsWith(EXT)).sort((a, b) => b.id - a.id);
let ctxId = null;
for (const c of ctxExt) {
  const t = await send('Runtime.evaluate', { expression: "typeof window.__lolidleAuto", returnByValue: true, contextId: c.id }, sess).catch(() => null);
  if (t && t.result && t.result.value === 'object') { ctxId = c.id; break; }
}
if (ctxId == null) throw new Error('motor nao encontrado em nenhum mundo isolado da extensao');
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true, contextId: ctxId }, sess); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result && r.result.value; };
const EXP = {
  player: "JSON.stringify(A.player())",
  bag: "JSON.stringify(A.scanBag(true))",
  skills: "JSON.stringify(A.readSkills())",
  potions: "JSON.stringify(A.readPotions())",
  market: "JSON.stringify({ofertas: A.lerMinhasOfertas ? A.lerMinhasOfertas() : null, saturado: A.mercadoSaturado()})",
  bosses: "JSON.stringify({monstros: A.getMeta().monstros, locais: A.getMeta().locais})",
  // O BACKTEST consome `cycles[]` com region/gold/xp/setup — e isso vive em `getFarm().cycles`,
  // NAO em `getRunLog()` (que e o registo de POCOES, 200 entradas, sem regiao nem ouro).
  // MEDIDO: getFarm().cycles tem 30 ciclos com `mobFase.perMin` ja calculado.
  dps: "JSON.stringify(A.getRunLog ? A.getRunLog() : null)",
  farm: "JSON.stringify(A.getFarm ? A.getFarm() : null)",
  status: "JSON.stringify(A.snapshotEstado ? A.snapshotEstado() : null)",
  cofre: "JSON.stringify(A.cofreInfo())",
};
const wrap = "var A=window.__lolidleAuto; if(!A) throw new Error('motor ausente'); ";
fs.mkdirSync(DIR, { recursive: true });
const out = {};
for (const [nome, expr] of Object.entries(EXP)) {
  try { const v = await ev(wrap + "(" + expr + ")"); const s = typeof v === 'string' ? v : JSON.stringify(v); fs.writeFileSync(DIR + '/' + nome + '.json', s); out[nome] = s.length; }
  catch (e) { out[nome] = 'ERRO: ' + String(e.message).slice(0, 60); }
}
// SNAPSHOT DO BACKTEST: `{ cycles, lutas }` — a forma que tools/backtest.mjs le.
// Nome do ficheiro = campeao actual (o backtest usa-o para agrupar).
try {
  // TK-01-28: o snapshot do backtest levava cycles[] e lutas[] mas NAO deaths[] — o
  // backtest nao tinha uma unica morte para treinar a fuga e o deaths.json ficava com 6 B.
  // As mortes vivem em farm.deaths (automation.js:791) e por ciclo em farm.cycles[].deaths.
  const dados = await ev(wrap + "(function(){var f=A.getFarm()||{};return JSON.stringify({champ:((A.getMeta().champAtual||{}).id||'champ'),conta:((A.getMeta().conta)||null),cycles:f.cycles||[],lutas:f.lutas||[],deaths:f.deaths||[],geradoEm:Date.now()})})()");
  const j = JSON.parse(dados);
  const nome = String(j.champ).toLowerCase() + '.json';
  fs.writeFileSync(DIR + '/' + nome, dados);
  out.snapshot = nome + ' (' + j.cycles.length + ' ciclos, ' + j.lutas.length + ' lutas, ' + (j.deaths || []).length + ' mortes)';
} catch (e) { out.snapshot = 'ERRO: ' + String(e.message).slice(0, 60); }
// TK-01-49: o relatorio saia em JSON no STDOUT, e correr com `> ficheiro 2>&1` metia o
// aviso que o ll.mjs escreve em stderr no meio do JSON — o backtest morria com
// "Unexpected token". Agora o relatorio completo vai para docs/snapshots/_export.json e o
// stdout leva UMA linha de texto (nunca JSON). Redireccionar com 2>&1 nao pode corromper nada.
const REL = DIR + '/_export.json';
try { fs.writeFileSync(REL, JSON.stringify({ geradoEm: new Date().toISOString(), dir: DIR, ficheiros: out }, null, 1)); } catch (e) { out._relatorio = 'ERRO: ' + e.message; }
const ok = Object.entries(out).filter(([, v]) => typeof v === 'number').length;
console.log('snap-export: ' + ok + ' ficheiro(s) escrito(s) em ' + DIR + ' — relatorio em _export.json');
for (const [k, v] of Object.entries(out)) if (typeof v !== 'number') console.log('  ' + k + ': ' + v);
if (process.argv.includes('--stdout-json')) console.log(JSON.stringify(out, null, 1));
try { await send('Target.detachFromTarget', { sessionId: sess }); } catch {}
ws.close();
