
import fs from 'node:fs';
const base = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';
for (const f of ['Default\\Preferences', 'Default\\Secure Preferences']) {
  try {
    const j = JSON.parse(fs.readFileSync(base + '\\' + f, 'utf8'));
    const s = j.extensions && j.extensions.settings;
    if (!s) { console.log(f + ': sem extensions.settings'); continue; }
    const arr = Object.entries(s).map(([id, v]) => ({ id, nome: (v.manifest && v.manifest.name) || '?', estado: v.state, loc: v.location }));
    console.log('=== ' + f + ' (' + arr.length + ' extensões) ===');
    for (const a of arr.filter(x => x.estado === 1)) console.log('  ATIVA: ' + a.nome + '  [' + a.id + ']');
    for (const a of arr.filter(x => x.estado !== 1)) console.log('  off  : ' + a.nome + '  [' + a.id + ']');
  } catch (e) { console.log(f + ': ERRO ' + e.message.slice(0, 60)); }
}
