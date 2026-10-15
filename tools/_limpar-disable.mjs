import fs from 'node:fs';
const base = 'C:/Temp/ll-full/Default/Secure Preferences';
const j = JSON.parse(fs.readFileSync(base, 'utf8'));
const id = 'pbdlekcgmpippamdkgbaphcppjafobjo';
const v = j.extensions.settings[id];
v.state = 1;
v.disable_reasons = [];
delete v.disable_reasons;
v.location = 4;
v.path = 'I:\\!lolidle.com\\extension';
fs.writeFileSync(base, JSON.stringify(j));
console.log('entrada: state=' + v.state + ' disable_reasons=' + JSON.stringify(v.disable_reasons));
// e limpar o registo de bloqueio no Preferences (nao-Secure)
try { const p2 = 'C:/Temp/ll-full/Default/Preferences'; const k = JSON.parse(fs.readFileSync(p2, 'utf8')); if (k.extensions && k.extensions.settings && k.extensions.settings[id]) { delete k.extensions.settings[id].disable_reasons; k.extensions.settings[id].state = 1; fs.writeFileSync(p2, JSON.stringify(k)); console.log('Preferences tambem limpo'); } else console.log('Preferences: sem entrada'); } catch (e) { console.log('Preferences: ' + e.message.slice(0, 60)); }