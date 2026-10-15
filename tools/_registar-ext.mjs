import fs from 'node:fs';
const base = 'C:/Temp/ll-full/Default/Secure Preferences';
const j = JSON.parse(fs.readFileSync(base, 'utf8'));
const id = 'pbdlekcgmpippamdkgbaphcppjafobjo';
const v = j.extensions && j.extensions.settings && j.extensions.settings[id];
if (!v) { console.log('NAO registada na copia -> vou criar a entrada'); } else { console.log('registada: path=' + v.path + ' location=' + v.location + ' state=' + v.state + ' disable_reasons=' + JSON.stringify(v.disable_reasons)); }
j.extensions = j.extensions || {}; j.extensions.settings = j.extensions.settings || {};
const novo = {
  path: 'I:\\!lolidle.com\\extension',
  location: 4,
  state: 1,
  was_installed_by_default: false,
  was_installed_by_oem: false,
  from_webstore: false,
  manifest: { name: 'LoL Idle — Auto Poção', version: '0.4.0', manifest_version: 3 },
  creation_flags: 38
};
j.extensions.settings[id] = Object.assign({}, v || {}, novo);
fs.writeFileSync(base, JSON.stringify(j));
console.log('entrada gravada: state=1, path=' + j.extensions.settings[id].path);