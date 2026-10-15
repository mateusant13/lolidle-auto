import fs from 'node:fs';
const base = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';
const j = JSON.parse(fs.readFileSync(base + '\\Default\\Secure Preferences', 'utf8'));
const id = 'pbdlekcgmpippamdkgbaphcppjafobjo';
const v = j.extensions && j.extensions.settings && j.extensions.settings[id];
if (!v) { console.log('NAO esta no teu perfil'); } else {
  console.log('TEU PERFIL -> path=' + v.path + ' | location=' + v.location + ' | state=' + v.state + ' | disable_reasons=' + JSON.stringify(v.disable_reasons));
}
const p2 = JSON.parse(fs.readFileSync(base + '\\Default\\Preferences', 'utf8'));
const v2 = p2.extensions && p2.extensions.settings && p2.extensions.settings[id];
console.log('Preferences (nao-secure): ' + (v2 ? 'state=' + v2.state + ' disable_reasons=' + JSON.stringify(v2.disable_reasons) : 'sem entrada'));