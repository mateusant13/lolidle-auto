import fs from 'node:fs';
const LOG = 'I:/!lolidle.com/tools/_batimentos.log';
try { fs.unlinkSync(LOG); } catch {}
const s = Bun.serve({ port: 8899, fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === '/beat') { fs.appendFileSync(LOG, u.searchParams.get('t') + ' ' + u.searchParams.get('v') + '\n'); }
  return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
} });
console.log('servidor de batimentos em 8899');
setInterval(() => {}, 1000);