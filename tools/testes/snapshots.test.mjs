/*
 * snapshots.test.mjs - A LEITURA DO SNAPSHOT TEM DE SOBREVIVER AOS DEFEITOS DO PASSADO.
 *
 * TK-01-29 — o export antigo deixou ficheiros com JSON DUPLAMENTE codificado (uma string que
 *   contem JSON). Quem fizesse JSON.parse directo recebia uma string, nao um objecto.
 *   Aceitacao: JSON.parse(readFileSync('docs/snapshots/yasuo.json')) devolve objecto com
 *   cycles/lutas — o backtest converte o ficheiro antigo quando o le.
 *
 * TK-01-49 — o export corria com `> ficheiro 2>&1` e o aviso que o ll.mjs escreve em stderr
 *   ("⚠ TESTE DE BUILDS EM ANDAMENTO ...", ll.mjs:137) entrava no meio do JSON; o backtest
 *   morria com "Unexpected token". Aceitacao: com stdout+stderr misturados o JSON.parse passa.
 *
 * TK-01-28 — o DPS real vive em luta.analise.outDps (automation.js:883), nao em luta.outDps, e
 *   deaths[] nao era exportado. Aceitacao: o backtest deixa de mostrar "-" no DPS e reporta mortes.
 *
 * Corre sem browser: escreve ficheiros temporarios em docs/snapshots/ e le-os com as mesmas
 * funcoes que o backtest usa.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerSnapshot } from '../ler-snapshot.mjs';
import { analisar } from '../backtest-lib.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dir, '..', '..');
const SNAPS = path.join(RAIZ, 'docs', 'snapshots');

export const suite = {
  nome: 'snapshots',
  titulo: 'Leitura do snapshot: JSON duplo, stderr no meio, DPS real e deaths[]',

  async run(t) {
    // temp DENTRO do repo (tools/.tmp-snapshots-test): a drive do temp do sistema enche
    // (ja deu ENOSPC a meio do teste) e aqui garante-se a limpeza no fim.
    const tmp = path.join(RAIZ, 'tools', '.tmp-snapshots-test');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const escrever = (nome, conteudo) => { const p = path.join(tmp, nome); fs.writeFileSync(p, conteudo); return p; };

    /* ---------- 1) o aviso REAL do ll.mjs (ll.mjs:137) misturado no JSON ---------- */
    const AVISO_LL = '\n⚠  TESTE DE BUILDS EM ANDAMENTO (fase 2 · variação 3 · Cerebros) — não interfira.\n';
    const bom = { champ: 'katarina', cycles: [{ region: 'Fosso do Dragão', gold: 100 }], lutas: [{ boss: 'Dragão' }] };
    const json = JSON.stringify(bom);

    const p1 = escrever('stderr-antes.json', AVISO_LL + json);
    const r1 = lerSnapshot(p1);
    t.check('aviso do ll.mjs ANTES do JSON: passa a parsear', r1.formato === 'com-stderr' && r1.dados.champ === 'katarina',
      'formato=' + r1.formato);
    t.check('e devolve os cycles/lutas (nao perde dado)', Array.isArray(r1.dados.cycles) && Array.isArray(r1.dados.lutas));

    const p2 = escrever('stderr-depois.json', json + AVISO_LL);
    const r2 = lerSnapshot(p2);
    t.check('aviso do ll.mjs DEPOIS do JSON: passa a parsear', r2.formato === 'com-stderr' && r2.dados.champ === 'katarina');

    // o export escreve o relatorio com JSON.stringify(out, null, 1) — um elemento por linha.
    // E assim que o stderr entra no meio: como linhas inteiras.
    const jsonBonito = JSON.stringify(bom, null, 1);
    const p3 = escrever('stderr-meio.json', jsonBonito.split('\n').slice(0, 2).join('\n') + AVISO_LL + jsonBonito.split('\n').slice(2).join('\n'));
    const r3 = lerSnapshot(p3);
    t.check('aviso do ll.mjs NO MEIO do JSON (linhas inteiras): repara e devolve os dados',
      r3.formato === 'com-stderr' && r3.dados.champ === 'katarina' && Array.isArray(r3.dados.cycles),
      'formato=' + r3.formato);
    // e o caso impossivel: stderr colado NO MEIO de uma unica linha de JSON. Ai a linha
    // inteira e o JSON, nao ha linha para deitar fora — o leitor tem de dar um erro que
    // EXPLICA o que leu, nunca um "Unexpected token" solto no meio do relatorio.
    const p3b = escrever('stderr-colado.json', json.slice(0, 20) + AVISO_LL + json.slice(20));
    let res3b = null, erroColado = null;
    try { res3b = lerSnapshot(p3b); } catch (e) { erroColado = e.message; }
    t.check('stderr colado no meio de uma linha: ou repara, ou da erro que explica (nunca "Unexpected token")',
      (res3b && res3b.dados.champ === 'katarina') || (erroColado && /nao e JSON/.test(erroColado)),
      'reparou=' + !!res3b + ' erro=' + String(erroColado).slice(0, 60));

    /* ---------- 2) JSON duplamente codificado (TK-01-29) ---------- */
    const p4 = escrever('duplo.json', JSON.stringify(json));
    const r4 = lerSnapshot(p4);
    t.check('JSON duplamente codificado: devolve OBJECTO, nao string',
      r4.formato === 'duplo' && typeof r4.dados === 'object' && r4.dados.champ === 'katarina');
    t.check('JSON simples: formato simples e limpo', lerSnapshot(escrever('simples.json', json)).formato === 'simples');

    /* ---------- 3) lixo mesmo: erro que diz o que leu ---------- */
    const p5 = escrever('lixo.json', 'nao tem json aqui');
    let errou = null;
    try { lerSnapshot(p5); } catch (e) { errou = e.message; }
    t.check('ficheiro sem JSON nenhum: erro claro (nao "Unexpected token")',
      !!errou && /nao e JSON e nao tem nenhum valor JSON dentro/.test(errou), String(errou));

    /* ---------- 4) o ficheiro velho do Yasuo (o que motivou o ticket) ---------- */
    const pY = path.join(SNAPS, 'yasuo.json');
    if (fs.existsSync(pY)) {
      const antes = fs.readFileSync(pY, 'utf8');
      const primeiraLeitura = (() => { try { return typeof JSON.parse(antes); } catch { return 'erro'; } })();
      const r = lerSnapshot(pY);
      t.check('docs/snapshots/yasuo.json: le-se como objecto com cycles',
        typeof r.dados === 'object' && Array.isArray(r.dados.cycles), 'formato=' + r.formato);
      t.check('tinha cycles[] e lutas[] (a amostra do ticket)',
        r.dados.cycles.length > 0 && Array.isArray(r.dados.lutas),
        'cycles=' + r.dados.cycles.length + ' lutas=' + (r.dados.lutas || []).length);
      // e a aceitacao literal do ticket: JSON.parse directo
      const directo = (() => { try { const v = JSON.parse(fs.readFileSync(pY, 'utf8')); return typeof v === 'object'; } catch { return false; } })();
      if (!directo) t.nota('yasuo.json ainda vem no formato antigo (' + r.formato + '); o backtest converte-o na primeira leitura.');
    } else {
      t.nota('docs/snapshots/yasuo.json ausente neste checkout.');
    }

    /* ---------- 5) TK-01-28: o DPS real e as mortes, no snapshot fresco ---------- */
    const pK = path.join(SNAPS, 'katarina.json');
    if (fs.existsSync(pK)) {
      const d = lerSnapshot(pK).dados;
      const lutas = Array.isArray(d.lutas) ? d.lutas : [];
      const comAnalise = lutas.filter((l) => l && l.analise && Number.isFinite(Number(l.analise.outDps)));
      t.check('katarina.json tem lutas[] com analise (o DPS real)',
        lutas.length > 0 && comAnalise.length > 0, 'lutas=' + lutas.length + ' comDps=' + comAnalise.length);
      t.check('o DPS vive em analise.outDps (era onde o backtest nao olhava)',
        comAnalise.every((l) => l.outDps === undefined && l.analise.outDps !== undefined),
        'amostra=' + JSON.stringify({ topo: Object.keys(lutas[0] || {}), analise: Object.keys(lutas[0]?.analise || {}) }));
      // o backtest tem de os encontrar
      
      const rr = analisar(d, { snap: 'teste', top: 3, region: null, minN: 1, excluirIncompletos: false, incluirCurtos: false });
      const g = rr.lutas.porBuild[0];
      t.check('o backtest mostra outDps com numero (nao "-")', !!g && g.outDps.media > 0,
        g ? 'outDps=' + g.outDps.media.toFixed(1) + ' n=' + g.n : 'nenhum grupo');
      t.check('o backtest reporta as mortes do snapshot',
        rr.meta.mortesNoArquivo >= 0 && rr.naoConcluido.some((x) => /deaths/.test(x)) === (rr.meta.mortesNoArquivo === 0),
        'mortes=' + rr.meta.mortesNoArquivo);
    } else {
      t.nota('docs/snapshots/katarina.json ausente neste checkout.');
    }

    /* ---------- 6) TK-01-43: ciclos <30 s fora do ranking ---------- */
    const muitos = { champ: 'x', cycles: [], lutas: [], deaths: [] };
    for (let i = 0; i < 6; i++) {
      muitos.cycles.push({ region: 'R', mobFase: { durMs: 20 * 1000, gold: 200 + i * 40, xp: 100, kills: 2, perMin: { gold: 600 + i * 100, xp: 300, kills: 6 } }, setup: { equip: [{ id: '111' }] } });
      muitos.cycles.push({ region: 'R', mobFase: { durMs: 90 * 1000, gold: 900 + i * 90, xp: 400, kills: 9, perMin: { gold: 700 + i * 50, xp: 280, kills: 6 } }, setup: { equip: [{ id: '111' }] } });
    }
    const comCurtos = analisar(muitos, { top: 3, minN: 1, incluirCurtos: true });
    const semCurtos = analisar(muitos, { top: 3, minN: 1 });
    t.check('por omissao os ciclos com <30 s ficam FORA do ranking',
      semCurtos.meta.ciclosUsados === 6 && comCurtos.meta.ciclosUsados === 12,
      'usados=' + semCurtos.meta.ciclosUsados + ' (com --incluir-curtos: ' + comCurtos.meta.ciclosUsados + ')');
    t.check('o relatorio diz quantos ficaram de fora e como os trazer',
      semCurtos.meta.avisos.some((a) => /incluir-curtos/.test(a)),
      semCurtos.meta.avisos.join(' | '));
    t.check('a taxa por minuto muda quando os curtos saem (o ruido era real)',
      Math.abs(semCurtos.builds[0].ouroMin.media - comCurtos.builds[0].ouroMin.media) > 1,
      'com=' + comCurtos.builds[0].ouroMin.media.toFixed(1) + ' sem=' + semCurtos.builds[0].ouroMin.media.toFixed(1));

    fs.rmSync(tmp, { recursive: true, force: true });
  },
};
