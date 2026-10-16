import fs from 'node:fs';
const LOG = 'I:/!lolidle.com/tools/_bat2.log';
try { fs.unlinkSync(LOG); } catch {}
Bun.serve({ port: 8899, fetch(req) {
  const u = new URL(req.url);
  if (u.pathname === '/beat') fs.appendFileSync(LOG, u.searchParams.get('t') + ' ' + (u.searchParams.get('v') || '-') + '\n');
  return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
} });
console.log('servidor 8899');
setInterval(function(){}, 60000);