
import fs from 'node:fs';
const base = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';
const j = JSON.parse(fs.readFileSync(base + '\\Default\\Secure Preferences', 'utf8'));
const s = j.extensions.settings;
const arr = Object.entries(s).map(([id, v]) => ({ id, nome: (v.manifest && v.manifest.name) || '(sem nome)', estado: v.state, loc: v.location, disable: v.disable_reasons }));
console.log('total: ' + arr.length);
const ativas = arr.filter(x => x.estado === 1);
console.log('ATIVAS (state=1): ' + ativas.length);
for (const a of ativas) console.log('  ' + a.nome + '  [' + a.id + '] loc=' + a.loc);
console.log('--- estados distintos: ' + [...new Set(arr.map(x => x.estado))].join(','));
const sus = arr.find(x => x.id.startsWith('majdfhpai'));
console.log('--- SUSPEITA majdfhpai...: ' + (sus ? sus.nome + ' estado=' + sus.estado : 'NAO ESTA NA LISTA'));
console.log('--- nao-activas com nome:');
for (const a of arr.filter(x => x.estado !== 1 && x.nome !== '(sem nome)').slice(0, 20)) console.log('  ' + a.nome + ' [' + a.id + '] estado=' + a.estado);
