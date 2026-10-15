import fs from 'node:fs';
const base = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';
const j = JSON.parse(fs.readFileSync(base + '\\Default\\Secure Preferences', 'utf8'));
const s = j.extensions.settings;
for (const id of ['d167b952-4eba-45b1-b43d-8a556a0db156', '09bc4ccc-08d8-4dc3-8393-4e427e8cdb7a', 'pbdlekcgmpippamdkgbaphcppjafobjo']) {
  const v = s[id];
  if (!v) { console.log(id + ' -> NAO esta nas preferencias'); continue; }
  const m = v.manifest || {};
  console.log(id + ' -> nome=' + (m.name || '(sem nome)') + ' | versao=' + (m.version||'?') + ' | path=' + (v.path || '?') + ' | state=' + v.state);
}
console.log('--- extensoes com permissao de reescrever headers (declarativeNetRequest/webRequest):');
for (const [id, v] of Object.entries(s)) {
  const m = v.manifest || {};
  const perms = [].concat(m.permissions || [], m.optional_permissions || []);
  if (perms.some(p => /declarativeNetRequest|webRequest/.test(p))) {
    const hosts = JSON.stringify(m.host_permissions || []).slice(0, 60);
    console.log('  ' + (m.name || id).slice(0, 40) + ' [' + id + '] perms=' + perms.filter(p=>/declarativeNetRequest|webRequest/.test(p)).join(',') + ' hosts=' + hosts);
  }
}