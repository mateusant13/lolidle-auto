/* w2-audita-tk02-06.test.mjs - AUDITORIA (W2b) de TK-02-06: refinarMelhores.
 * Prova que a MUELTA foi removida: o TEÓRICO (buildIdeal) manda; o medido (n>=3) só valida.
 * Corre directo: bun tools/testes/w2-audita-tk02-06.test.mjs  (nao depende do run.mjs). */
import { criarMundo, carregarAutomation, alimentarCatalogo, definirCampeao } from './dom-stub.mjs';
let falhas = 0, n = 0;
const ck = (l, c) => { n++; console.log((c === true ? 'ok: ' : 'FALHOU: ') + l); if (c !== true) falhas++; };
const m = criarMundo(); const auto = carregarAutomation(m); alimentarCatalogo(m); definirCampeao(m, 'aptest');
m.montar('#local-nome', [m.el({ tag: 'div', textContent: 'Fonte' })]);   // naBase() true
const teorico = (auto.buildIdeal() || []).map(String);
const ciclo = (b) => ({ startedAt: 1, endedAt: 2, region: 'Campo Azul', setup: { equip: b.map((x) => ({ base: x })) }, mobFase: { perMin: { gold: 9999, xp: 500, kills: 30, dmg: 100 } } });
auto.importar({ farm: { cycles: [...Array(4)].map(() => ciclo(['2007', '2001', '2004', '2005', '2006'])), log: [], issues: [] } });   // medido DIVERGENTE, n=4
const r = await auto.refinarMelhores();
console.log('  teorico=', teorico.join(','), '| essenciais=', (r.essenciais || []).join(','), '| fonte=', r.fonteEssenciais);
ck('R1: fonteEssenciais continua "teorico" (o medido NÃO vira "medido(n=..)")', r.fonteEssenciais === 'teorico');
ck('R2: essenciais === buildIdeal() TEORICO (a antiga muleta devolveria a build MEDIDA)', JSON.stringify((r.essenciais || []).map(String)) === JSON.stringify(teorico));
ck('R3: medido fica registado como VALIDAÇÃO (n>=3), não aplicado', !!(r.medido && r.medido.n >= 3));
ck('R4: divergenciaMedido lista o que o medido tem a mais (informativo)', Array.isArray(r.divergenciaMedido) && r.divergenciaMedido.length > 0);
console.log('AUDITA TK-02-06: ' + (n - falhas) + '/' + n + ' ok');
process.exit(falhas ? 1 : 0);
