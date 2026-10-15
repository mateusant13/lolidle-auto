
import fs from 'node:fs';
const base = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';
const j = JSON.parse(fs.readFileSync(base + '\\Default\\Secure Preferences', 'utf8'));
const v = j.extensions.settings['pbdlekcgmpippamdkgbaphcppjafobjo'];
if (!v) { console.log('nao esta nas preferencias'); process.exit(0); }
console.log('instalada: path=' + v.path + ' | location=' + v.location + ' | state=' + v.state);
console.log('manifest: ' + JSON.stringify(v.manifest).slice(0, 220));
if (v.path) {
  const f = v.path + '\\automation.js';
  try { const st = fs.statSync(f); console.log('automation.js INSTALADO: ' + st.size + ' B | ' + st.mtime.toISOString()); } catch (e) { console.log('automation.js nao encontrado em ' + f); }
  try { const mm = JSON.parse(fs.readFileSync(v.path + '\\manifest.json', 'utf8')); console.log('manifest INSTALADO: versao ' + mm.version); } catch (e) { console.log('manifest instalado nao lido'); }
}
const src = fs.statSync('I:\\!lolidle.com\\extension\\automation.js');
console.log('automation.js FONTE:    ' + src.size + ' B | ' + src.mtime.toISOString());
