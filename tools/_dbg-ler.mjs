
import { lerSnapshot } from './ler-snapshot.mjs';
import fs from 'node:fs';
const AVISO = '\n⚠  TESTE DE BUILDS EM ANDAMENTO (fase 2 · variação 3 · Cerebros) — não interfira.\n';
const json = JSON.stringify({ champ: 'katarina', cycles: [{ region: 'Fosso' }], lutas: [{ boss: 'X' }] });
fs.writeFileSync('tools/.tmp-dbg.json', AVISO + json);
try { const r = lerSnapshot('tools/.tmp-dbg.json'); console.log('OK formato=' + r.formato + ' champ=' + r.dados.champ); }
catch (e) { console.log('ERRO: ' + e.message); }
console.log('conteudo primeiros 80:', JSON.stringify(fs.readFileSync('tools/.tmp-dbg.json','utf8').slice(0,80)));
fs.rmSync('tools/.tmp-dbg.json');
