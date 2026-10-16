import { execSync } from 'node:child_process';
const out = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\'\\" | Where-Object { $_.CommandLine -match \'--type=gpu\' } | Select-Object -ExpandProperty ProcessId"', { encoding: 'utf8' });
const pids = String(out).split(/\s+/).map(s => s.trim()).filter(Boolean);
console.log('PIDs do processo GPU: ' + JSON.stringify(pids));
for (const pid of pids) {
  try { const info = execSync('powershell -NoProfile -Command "$p = Get-Process -Id ' + pid + ' -ErrorAction SilentlyContinue; if ($p) { \'\' + [math]::Round($p.CPU,1) + \'|\' + [math]::Round($p.WorkingSet64/1MB,0) + \'|\' + $p.StartTime.ToString(\'HH:mm:ss\') }"', { encoding: 'utf8' }).trim();
    console.log('  PID ' + pid + ' -> CPU|MB|inicio = ' + info); } catch (e) { console.log('  PID ' + pid + ' -> erro'); }
}
process.exit(0);