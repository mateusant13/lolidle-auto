#!/usr/bin/env bun
/**
 * replay-morte.mjs — reconstrói o combate que levou à morte a partir do `hist`
 * capturado pelo content.js (hit/heal/pot/carga/golpe/dmg).
 *
 * Uso:
 *   bun tools/ll.mjs eval 'JSON.stringify(window.__lolidleAuto.getFarm().deaths[0])' > /tmp/morte.json
 *   bun tools/replay-morte.mjs /tmp/morte.json
 *
 * Também aceita um JSON sintético {hpMax, hist:[...]}.
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('uso: bun tools/replay-morte.mjs <death.json>'); process.exit(2); }
const d = JSON.parse(readFileSync(file, 'utf8'));
const h = d.hist || [];
const max = d.recursos?.hp?.max || d.hpMax || 4188;
if (!h.length) { console.log('⚠ sem hist — morte capturada antes do log de replay existir.'); process.exit(0); }

const t0 = h[0].at;
const s = (ms) => ((ms - t0) / 1000).toFixed(1) + 's';
const bar = (hp) => { const n = Math.round((hp / max) * 24); return '█'.repeat(Math.max(0, n)).padEnd(24, '·') + ` ${Math.round(hp)}/${max} (${Math.round((hp / max) * 100)}%)`; };

// HP inicial: o 1º hit traz o hp DEPOIS da queda
let hp = null;
for (const e of h) if (e.t === 'hit' && e.hp != null) { hp = e.hp + e.drop; break; }
if (hp == null) hp = max;

console.log(`\n💀 REPLAY DA MORTE — ${d.by || '?'} em ${d.region || '?'} · build ${(d.build || []).join(',')} · poções ${JSON.stringify(d.pocoes || {})}`);
console.log(`   hp máx ${max}\n`);
console.log('   t      evento                 hp');
let potCount = 0, dmgIn = 0, dmgOut = 0, heals = 0, hits = 0, fatal = null;
for (const e of h) {
  if (e.t === 'hit') { hp = Math.max(0, hp - e.drop); dmgIn += e.drop; hits++; if (hp <= 0 && !fatal) fatal = e; console.log(`  ${s(e.at).padStart(6)}  ↓ golpe ${String(Math.round(e.drop)).padStart(5)}      ${bar(hp)}`); }
  else if (e.t === 'heal') { hp = Math.min(max, hp + e.v); heals += e.v; }
  else if (e.t === 'shield') { hp = Math.min(max, hp + e.v); }
  else if (e.t === 'pot') { potCount++; console.log(`  ${s(e.at).padStart(6)}  💊 ${e.k.padEnd(6)} hp ${Math.round(e.hp)}  → ${e.motivo || ''}`); }
  else if (e.t === 'carga') { console.log(`  ${s(e.at).padStart(6)}  ⚠ CARREGA ${e.mec}`); }
  else if (e.t === 'golpe') { console.log(`  ${s(e.at).padStart(6)}  ⚔ golpe ${e.mec}`); }
  else if (e.t === 'dmg') { if (e.dir === 'in') dmgIn += e.v; else dmgOut += e.v; }
}
console.log(`\n   resumo: ${hits} golpes tomados · dano in ${Math.round(dmgIn)} · cura ${Math.round(heals)} · ${potCount} poções`);
if (fatal) {
  const idx = h.indexOf(fatal);
  const antes = h.slice(Math.max(0, idx - 5), idx);
  console.log(`   FATAL em ${s(fatal.at)} (golpe ${Math.round(fatal.drop)})`);
  console.log(`   sequência: ${antes.map((e) => e.t === 'hit' ? `↓${Math.round(e.drop)}` : e.t === 'pot' ? `💊${e.k}` : e.t === 'carga' ? `⚠${e.mec}` : e.t).join(' ')} ↓${Math.round(fatal.drop)}`);
} else console.log('   (sem golpe fatal no hist — hp não chegou a 0 na amostra)');
