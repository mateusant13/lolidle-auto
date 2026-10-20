#!/usr/bin/env node
/*
 * tools/prova-boss.mjs — PROVA de SOBREVIVÊNCIA contra um chefe, com a LUTA REAL do motor.
 *
 * Regra N.º 1: a mecânica vem de `docs/game-src/motor.js` (importado, nunca copiado).
 * Este script responde à pergunta do dono:
 *
 *      (sobrevive? , mata em quantos segundos? , quantas poções e quanto custam em ouro?)
 *
 * Uso:
 *   node tools/prova-boss.mjs --alvo="Barão Nashor" --nv=42 --nivel=32 \
 *      --itens="3175+4~A,3089+2~B,3100~C,4629+3~A,3135+4~A" \
 *      --atrib="forca=93" --barra="A,T,Q,W" --seg=300 --seed=1
 *
 * --atrib aceita a ALOCAÇÃO real da conta (forca, vitalidade, resistencia, agilidade, foco).
 * O total não é limitado a 3×(nível−1) porque conquistas/mascotes dão o mesmo efeito que pontos;
 * o que importa é reproduzir os números do HUD, que são a verdade do jogo.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const p = n + '='; const h = argv.find((a) => a.startsWith(p)); return h ? h.slice(p.length) : d; };

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const m = await import(pathToFileURL(path.join(RAIZ, 'docs', 'game-src', 'motor.js')).href);

function semear(seed) { let s = (seed >>> 0) || 1; Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
semear(Number(opt('--seed', 1)) || 1);

const nivel = Number(opt('--nivel', 32));
const alvoNome = opt('--alvo', 'Barão Nashor');
const nvAlvo = Number(opt('--nv', 42));
const itens = String(opt('--itens', '')).split(',').map((s) => s.trim()).filter(Boolean);
const barra = String(opt('--barra', 'A,T,Q,W')).split(',').map((s) => s.trim()).filter(Boolean);
const maxSeg = Number(opt('--seg', 300));
const dt = 0.05;

const e = m.novoEstado('katarina');
e.nivel = nivel;
e.itens = itens;
e.mochila = [];
e.local = opt('--local', 'barao');
e.barra = barra;
// ranks: os da CONTA quando dados (o HUD manda), senão a subida automática do motor
const ranksTxt = opt('--ranks', null);
if (ranksTxt) {
  for (const k of Object.keys(e.ranks)) e.ranks[k] = 0;
  for (const par of ranksTxt.split(',').filter(Boolean)) { const [k, v] = par.split('='); if (k in e.ranks) e.ranks[k] = Number(v) || 0; }
  e.pontos = 0;
} else {
  e.pontos = Math.max(0, nivel - Object.values(e.ranks).reduce((s, v) => s + (v || 0), 0));
  try { m.subirAutomatico(e); } catch { /* sem pontos livres */ }
}

// alocação de atributos (a da conta, lida do HUD)
const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0 };
for (const par of String(opt('--atrib', '')).split(',').filter(Boolean)) {
  const [k, v] = par.split('='); if (k in at) at[k] = Number(v) || 0;
}
e.atrib = at;
e.pontosAtrib = 0;

const a = m.atributos(e);
e.vida = a.vida; e.mana = a.mana;
e.pocoes = { vida: 9999, vidaF: 9999, vidaS: 9999, mana: 9999, manaF: 9999 };
// --pocao=auto  -> o motor bebe pelo limiar fixo (--limiar)
// --pocao=smart -> a POLÍTICA da extensão (`decidirPocao`, automation.js:2587): piso de 90% no
//                  chefe, margem de 10% sobre o último golpe, e a CARGA anunciada pelo chefe
//                  (`chefeCarrega`) antes de ela cair. É esta a poção que o dono paga.
// --pocao=off
const modoPocao = String(opt('--pocao', 'auto'));
e.auto = { vida: modoPocao === 'auto', limiarVida: Number(opt('--limiar', 0.5)), mana: false, limiarMana: 0.3, voltar: true };

const c = m.criarCombate();
c.pocaoAuto = modoPocao === 'auto' && opt('--pocaoAuto', '1') !== '0';
c.respawn = 1e9;
c.inimigos = [m.criarMonstro(alvoNome, nvAlvo)];

const pot = {};
const fontes = {};
// ---- política "smart" (espelho de decidirPocao) ----
const PISO_CHEFE = 0.9, MARGEM = 1.1;
const danoMec = {};                 // aprendido: dano real de cada mecânica do chefe
let ultGolpe = 0, carga = null, cargaAt = 0, sofridoNaCarga = 0, fuga = null;
function beber(falta) {
  if (c.darius.timers.pocao > 0) return null;
  const ordem = [['vida', 300], ['vidaF', 900], ['vidaS', 2200]];
  let k = null;
  for (const [x, cura] of ordem) if (e.pocoes[x] > 0 && falta <= cura) { k = x; break; }
  if (!k) k = ['vidaS', 'vidaF', 'vida'].find((x) => e.pocoes[x] > 0) || null;
  if (!k) return null;
  return m.usarPocao(e, c, k) ? k : null;
}
let hpMin = e.vida, hpMinT = 0, danoRecebido = 0, t = 0, tKill = null, tMorte = null, invoc = 0, bebeuSmart = 0;
while (t < maxSeg) {
  m.passo(e, c, dt);
  for (const ev of c.eventos) {
    if (ev.tipo === 'pocao') pot[ev.chave] = (pot[ev.chave] || 0) + 1;
    else if (ev.tipo === 'recebido') { danoRecebido += ev.valor || 0; if (carga) sofridoNaCarga += ev.valor || 0; if (ev.valor) ultGolpe = ev.valor; }
    else if (ev.tipo === 'dano') fontes[ev.fonte || '?'] = (fontes[ev.fonte || '?'] || 0) + (ev.valor || 0);
    else if (ev.tipo === 'abate' && (ev.chefe || ev.nome === alvoNome) && tKill == null) tKill = t;
    else if (ev.tipo === 'chefeCarrega') { carga = { mec: ev.mec, fim: t + (ev.dur || 0) }; cargaAt = t; sofridoNaCarga = 0; }
    else if (ev.tipo === 'chefeGolpe') { if (carga && !ev.bloqueado) danoMec[carga.mec] = Math.max(danoMec[carga.mec] || 0, sofridoNaCarga); carga = null; }
    else if (/invoc/i.test(ev.tipo || '')) invoc++;
  }
  c.eventos.length = 0;
  t += dt;
  // poção smart: antes do golpe, não depois da morte
  if (modoPocao === 'smart' && c.darius.morto <= 0 &&
      !(carga && carga.mec === 'invocar')) {
    const prevCarga = carga ? (danoMec[carga.mec] || ultGolpe * 2) * MARGEM : 0;
    const seq = carga ? (danoMec[carga.mec] || ultGolpe * 2) + ultGolpe : 0;
    const alvo = Math.min(a.vida, Math.max(a.vida * PISO_CHEFE, ultGolpe, prevCarga, seq));
    const falta = alvo - e.vida;
    if (falta > 0) {
      const golpeMax = Math.max(prevCarga, seq, ultGolpe);
      const maior = ['vidaS', 'vidaF', 'vida'].find((x) => e.pocoes[x] > 0);
      const cura = maior ? (m.POCOES[maior] || {}).cura || 0 : 0;
      if (golpeMax >= e.vida + cura && !fuga) fuga = { t: +t.toFixed(1), golpe: Math.round(golpeMax), hp: Math.round(e.vida) };
      if (beber(falta)) bebeuSmart++;
    }
  }
  if (e.vida < hpMin) { hpMin = e.vida; hpMinT = t; }
  if (c.darius.morto > 0) { tMorte = t; break; }
  if (tKill != null) break;
}

const custoPocao = Object.entries(pot).reduce((s, [k, n]) => s + n * ((m.POCOES[k] && m.POCOES[k].preco) || 0), 0);
const linha = (r) => `${String(r.nome).padEnd(26)} ${String(r.v).padStart(10)}`;
const rel = {
  alvo: `${alvoNome} nv${nvAlvo}`, nivel, itens: itens.join(','), atrib: at,
  atributos: { hp: Math.round(a.vida), ap: Math.round(a.ap), ad: Math.round(a.ad), armadura: Math.round(a.armadura),
    rm: Math.round(a.rm), cdr: +(a.reducaoRecarga || 0).toFixed(3), penMag: a.penMagica, velAtaque: +(a.velAtaque || 0).toFixed(2) },
  resultado: tMorte != null ? 'MORREU' : (tKill != null ? 'MATOU' : 'NÃO MATA (ficou vivo)'),
  tKillS: tKill != null ? +tKill.toFixed(1) : null,
  tMorteS: tMorte != null ? +tMorte.toFixed(1) : null,
  hpMin: Math.round(hpMin), hpMinPct: Math.round((100 * hpMin) / a.vida), hpMinEmS: +hpMinT.toFixed(1),
  hpMax: Math.round(a.vida),
  danoRecebido: Math.round(danoRecebido),
  danoPorFonte: Object.fromEntries(Object.entries(fontes).map(([k, v]) => [k, Math.round(v)])),
  pocoes: pot, pocoesTotal: Object.values(pot).reduce((s, v) => s + v, 0), custoPocaoOuro: custoPocao,
  modoPocao, fugaPrevista: fuga,
  mecanicaInvocacoes: invoc,
  tempoSimulado: +t.toFixed(1),
  bossHp: Math.round(c.inimigos[0] ? c.inimigos[0].hpMax : 0),
};
if (argv.includes('--json')) console.log(JSON.stringify(rel, null, 2));
else {
  console.log(`PROVA DE LUTA — ${rel.alvo}`);
  console.log(`  ${rel.resultado}${rel.tKillS ? ` em ${rel.tKillS}s` : ''}${rel.tMorteS ? ` (morreu aos ${rel.tMorteS}s)` : ''}`);
  console.log(`  hp ${rel.atributos.hp} | ap ${rel.atributos.ap} | ad ${rel.atributos.ad} | arm ${rel.atributos.armadura} | rm ${rel.atributos.rm} | cdr ${rel.atributos.cdr} | pen ${rel.atributos.penMag}`);
  console.log(`  vida mais baixa: ${rel.hpMin}/${rel.hpMax} = ${rel.hpMinPct}% (aos ${rel.hpMinEmS}s)`);
  console.log(`  dano tomado: ${rel.danoRecebido}`);
  console.log(`  poções: ${JSON.stringify(rel.pocoes)} = ${rel.pocoesTotal} (${rel.custoPocaoOuro} ouro)`);
  console.log(`  dano por fonte: ${JSON.stringify(rel.danoPorFonte)}`);
}
