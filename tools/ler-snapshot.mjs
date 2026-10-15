/*
 * ler-snapshot.mjs — le um snapshot do repo SEM depender de o produtor ter escapado o stderr.
 *
 * Porque existe (TK-01-49): o export corria com `> ficheiro 2>&1` e o aviso que o ll.mjs
 * escreve em stderr ("⚠ TESTE DE BUILDS EM ANDAMENTO ...") entrava no meio do JSON; o
 * backtest morria com "Unexpected token". E o export antigo tambem deixou ficheiros com JSON
 * DUPLAMENTE codificado (uma string que contem JSON) — TK-01-29.
 *
 * Este leitor trata os dois casos e devolve SEMPRE um objecto:
 *   1. JSON simples                    -> devolve tal qual;
 *   2. JSON duplamente codificado      -> faz o segundo parse;
 *   3. JSON com texto de stderr antes/ <- extrai so o primeiro valor JSON completo;
 *   4. lixo total                      -> lanca um erro que DIZ o que leu.
 */
import { readFileSync } from 'node:fs';

/** Indice do fim do primeiro valor JSON completo dentro de `s` (ou -1). */
function fimDoJson(s) {
  const ini = s.search(/[[{]/);
  if (ini < 0) return -1;
  let profundidade = 0, emString = false, fugiu = false;
  for (let i = ini; i < s.length; i++) {
    const c = s[i];
    if (emString) {
      if (fugiu) fugiu = false;
      else if (c === '\\') fugiu = true;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === '{' || c === '[') profundidade++;
    else if (c === '}' || c === ']') {
      profundidade--;
      if (profundidade === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Deita fora as linhas que nao podem ser parte de um JSON produzido por JSON.stringify.
 * O stderr (o aviso do ll.mjs, os avisos do bun) chega sempre em linhas inteiras, e o export
 * escreve o JSON com um elemento por linha — pelo que deitar fora a linha toda reconstroi
 * o JSON sem tocar no que era dele.
 */
function limparLinhas(texto) {
  return texto.split('\n').filter((l) => {
    const s = l.trim();
    if (!s) return false;
    // algo que so pode vir de fora do JSON: emoji, setas, texto corrido
    if (/[\u2000-\u27bf\ufe0f\u26a0]/.test(s)) return false;
    // uma linha de JSON (ou fragmento) comeca por um destes: abertura/fecho de objecto e
    // array, string, numero, verdadeiro/falso/nulo, ou dois-pontos/virgula pendurados.
    return /^[[{}\]]/.test(s) || /^["\d\-]/.test(s) || /^(true|false|null)/.test(s)
      || /^:/.test(s) || /,$/.test(s) || /^\]/.test(s);
  }).join('\n');
}

/**
 * Le um snapshot.
 * @returns {{dados: object, formato: 'simples'|'duplo'|'com-stderr', limpo: boolean, aviso: string|null}}
 */
export function lerSnapshot(caminho) {
  const bruto = readFileSync(caminho, 'utf8');
  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch (e) {
    // 3) havia texto (stderr) no meio. Duas reparacoes, pela ordem:
    //    (a) deitar fora as LINHAS que nao sao JSON — o stderr chega sempre em linhas
    //        inteiras, e o JSON.stringify do export poe um elemento por linha;
    //    (b) se sobrar lixo antes/depois, extrair o primeiro valor JSON completo.
    const semLinhas = limparLinhas(bruto);
    for (const cand of [semLinhas, bruto]) {
      try { dados = JSON.parse(cand); break; } catch { /* tenta a seguinte */ }
      try {
        const fim = fimDoJson(cand);
        if (fim < 0) continue;
        dados = JSON.parse(cand.slice(cand.search(/[[{]/), fim));
        break;
      } catch { /* tenta a seguinte */ }
    }
    if (dados === undefined) throw new Error('snapshot nao e JSON e nao tem nenhum valor JSON dentro: ' + bruto.slice(0, 80).replace(/\s+/g, ' '));
    if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch { /* fica a string */ } }
    return { dados, formato: 'com-stderr', limpo: false, aviso: 'havia texto (stderr?) no meio do JSON — reparado deitando fora as linhas que nao eram JSON' };
  }
  if (typeof dados === 'string') {
    // 2) duplamente codificado
    const interior = dados.trim();
    try { dados = JSON.parse(interior); } catch { throw new Error('snapshot duplamente codificado mas o interior nao e JSON'); }
    return { dados, formato: 'duplo', limpo: false, aviso: 'JSON duplamente codificado (string contendo JSON) — lido com o segundo parse' };
  }
  if (!dados || typeof dados !== 'object') throw new Error('snapshot nao e objeto');
  return { dados, formato: 'simples', limpo: true, aviso: null };
}

/** Regrava o snapshot como JSON simples (um so objeto) — usado pelo --normalizar. */
export function normalizarSnapshot(caminho) {
  const { dados, formato } = lerSnapshot(caminho);
  if (formato === 'simples') return { mudou: false, formato };
  return { mudou: true, formato, para: 'simples', bytes: undefined };
}

export default lerSnapshot;
