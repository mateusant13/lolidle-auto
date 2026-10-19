// _relay-lolidle.mjs — attach-only ao relay OMP, SEM imprimir as abas do dono.
// Regra 11.1.5: nunca imprimir /json/list. Aqui só sai o alvo que casa com lolidle.com.
//
// Uso:
//   node tools/_relay-lolidle.mjs            # lista só as abas do jogo e prova liveness
//   node tools/_relay-lolidle.mjs --ctx      # lista os contextos da extensão e avalia marcadores
//
// Não cria, não fecha e não navega em nada.
const BASE = 'http://127.0.0.1:9224';
const QUER_CTX = process.argv.includes('--ctx');
const QUER_INFO = process.argv.includes('--info');
const QUER_STATE = process.argv.includes('--state');

const ws = new WebSocket('ws://127.0.0.1:9224/cdp');
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let id = 0;
const pend = new Map();
const ctxs = [];
ws.addEventListener('message', (ev) => {
  let m; try { m = JSON.parse(ev.data); } catch { return; }
  if (m.method === 'Runtime.executionContextCreated' && m.params?.context) ctxs.push(m.params.context);
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id); pend.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
});
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, { res, rej });
  ws.send(JSON.stringify(sid ? { id: i, method, params, sessionId: sid } : { id: i, method, params }));
});

const { targetInfos } = await send('Target.getTargets');
const jogos = targetInfos.filter((x) => x.type === 'page' && /(^|\.)lolidle\.com/i.test((x.url || '').replace(/^https?:\/\//, '')));
// só o alvo do jogo: nada das outras abas do dono é impresso
console.log('ABAS_LOLIDLE=' + jogos.length);
for (const t of jogos) console.log('ALVO ' + t.targetId + ' | ' + t.url);
if (!jogos.length) { ws.close(); process.exit(2); }

const alvo = jogos[0];
const { sessionId } = await send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);

const evalMain = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false }, sessionId);
  return r?.result?.value;
};
const t0 = Date.now();
const main = await evalMain('JSON.stringify({url:location.href,titulo:document.title,hidden:document.hidden,tela:!!document.querySelector("#tela"),pulso:window.__lolidlePulsoFix||null})');
console.log('LIVENESS_MS=' + (Date.now() - t0));
console.log('MAIN=' + main);

if (QUER_INFO) {
  // Estado do JOGO (não do perfil): só o que precisamos para saber onde estamos.
  const info = await evalMain(`JSON.stringify({
    hash: location.hash,
    local: (document.querySelector('#local-nome')?.textContent || '').trim().slice(0,80),
    npcs: document.querySelectorAll('#npcs button[data-npc]').length,
    tela: document.querySelector('#tela')?.getBoundingClientRect().width || 0,
    entrar: [...document.querySelectorAll('button,a')].filter(e => /jogar|entrar|continuar/i.test(e.textContent || '')).slice(0,6).map(e => (e.textContent || '').trim().slice(0,40)),
    log: [...document.querySelectorAll('#log > *')].slice(-4).map(e => (e.textContent || '').trim().slice(0,90)),
    body: (document.body.className || '').slice(0,80)
  })`);
  console.log('INFO=' + info);
}

if (QUER_CTX) {
  // contextos isolados da extensão (o motor vive aqui; não é a página da extensão)
  const ext = ctxs.filter((c) => /^chrome-extension:\/\//i.test(c.origin || ''));
  console.log('CTX_EXT=' + ext.length);
  for (const c of ext) {
    const r = await send('Runtime.evaluate', {
      expression: 'JSON.stringify({auto:typeof window.__lolidleAuto,pulso:window.__lolidlePulsoFix||null,painel:!!document.querySelector("#lolidle-painel"),hpCard:!!document.querySelector("#lolidle-hp-inimigos"),pocaoV2:window.__lolidlePocaoV2||null})',
      returnByValue: true, contextId: c.id,
    }, sessionId);
    console.log('CTX ' + c.id + ' ' + (c.origin || '') + ' => ' + (r?.result?.value || ''));
    if (QUER_STATE && String(r?.result?.value || '').includes('"auto":"object"')) {
      const s = await send('Runtime.evaluate', {
        expression: `(() => {
          const A = window.__lolidleAuto; if (!A) return '{}';
          const c = (A.getConfig && A.getConfig()) || {};
          const m = (A.getMeta && A.getMeta()) || {};
          const e = A.estadoVivo && A.estadoVivo();
          const l = window.__lolidleLive || null;
          const pots = l && l.potions ? Object.fromEntries(Object.entries(l.potions).map(([k, v]) => [k, v && v.count])) : null;
          return JSON.stringify({
            cfg: { enabled: c.enabled, auto: c.auto, smart: c.smart, mode: c.mode, campeoes: c.campeoesAlvo || c.campeaoAlvo || null, autoPocao: c.autoPocao, mercado: c.autoVigiarMercado, base: c.autoBase },
            meta: { contrato: m.contrato || null, curvaErro: m.curvaErro || null, at: m.at || null },
            estado: e ? { local: e.local, inimigos: (e.inimigos || []).length, respawn: e.respawn } : null,
            live: l ? { hp: l.hp, target: l.target ? { nome: l.target.name, nivel: l.target.level, boss: l.target.boss } : null, boss: l.boss, mode: l.mode, bossHp: l.bossHp, potions: pots } : null
          });
        })()`,
        returnByValue: true, contextId: c.id,
      }, sessionId);
      console.log('STATE=' + (s?.result?.value || ''));
    }
  }
}
ws.close();
