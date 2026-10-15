/*
 * APLICAR-W4.mjs - re-aplica as correccoes da fila W4 (w4-fuga) sobre o automation.js do master.
 *
 * Existe porque o master andou a mexer ENQUANTO eu trabalhava: precisei de re-sincronizar o
 * worktree com o master e voltar a aplicar as correccoes sem as perder. Cada bloco e
 * identificado por um fragmento EXACTO do codigo do master, e falha ALTO se o fragmento nao
 * existir (nunca aplica as cegas).
 *
 *   node tools/aplicar-w4.mjs [--verificar]
 *
 * Tickets cobertos: TK-02-33, TK-02-40, TK-01-12, TK-01-13, TK-01-14, TK-01-16, TK-01-17, TK-01-46.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALVO = path.join(RAIZ, 'extension', 'automation.js');

let linhas = fs.readFileSync(ALVO, 'utf8').split('\n');
const CRLF = linhas.some((l) => l.endsWith('\r'));
const LIMPO = (i) => String(linhas[i] ?? '').replace(/\r$/, '');
const FEITOS = [];
/** substitui a linha que contem `frag` por `novo` (string ou array de linhas). */
function lin(frag, novo, etq) {
  const idx = [];
  for (let k = 0; k < linhas.length; k++) if (LIMPO(k).includes(frag)) idx.push(k);
  if (idx.length !== 1) throw new Error('[' + etq + '] fragmento achado ' + idx.length + 'x: ' + frag.slice(0, 70));
  const arr = Array.isArray(novo) ? novo : [novo];
  linhas.splice(idx[0], 1, ...arr.map((t) => t + (CRLF ? '\r' : '')));
  FEITOS.push(etq + '@' + (idx[0] + 1));
}
/** substitui o bloco [inicioFrag .. fimFrag] (linhas exactas) por `novo`. */
function bloco(inicioFrag, fimFrag, novo, etq) {
  const i0 = linhas.findIndex((l, k) => LIMPO(k) === inicioFrag);
  if (i0 < 0) throw new Error('[' + etq + '] inicio nao achado');
  let i1 = -1;
  for (let k = i0 + 1; k < linhas.length; k++) if (LIMPO(k) === fimFrag) { i1 = k; break; }
  if (i1 < 0) throw new Error('[' + etq + '] fim nao achado');
  const arr = Array.isArray(novo) ? novo : [novo];
  linhas.splice(i0, i1 - i0 + 1, ...arr.map((t) => t + (CRLF ? '\r' : '')));
  FEITOS.push(etq + '@' + (i0 + 1) + '-' + (i1 + 1));
}
const B = String.fromCharCode(96), D = String.fromCharCode(34);

/* ============================ TK-01-17a: localId normalizado ============================ */
lin("const l = (META.locais || []).find((x) => regionTxt && regionTxt.startsWith(x.nome));", [
  "    // TK-01-17: a comparacao era EXACTA e sensivel a caixa/acento. O nome do local no HUD e o",
  "    // que o jogo escreve e pode vir com sufixo (\"Fonte (nucleo)\"), minusculo ou acentuado:",
  "    // comparar pelo texto EXACTO era o que deixava o giro preso. Normalizam-se os DOIS lados",
  "    // (o `semAcento` ja existe no ficheiro).",
  "    const txt = semAcento(regionTxt);",
  "    const l = (META.locais || []).find((x) => { const n = semAcento(x && x.nome); return txt && n && txt.startsWith(n); });",
], 'TK-01-17/localId');

/* ============================ TK-01-16: fallback na variavel certa ====================== */
lin("const curaPocaoChefe = r.chpn ? r.chp / r.chpn : curaPocao;", [
  "      // TK-01-16: o fallback era escrito na variavel ERRADA (`curaPocao` = cura MEDIDA dos",
  "      // mobs), pelo que nao fazia NADA ao risco do chefe — e ainda corrompia o campo",
  "      // `healPotionS` (cura dos mobs) que a GUI e o previsor leem. Escreve-se na certa.",
  "      let curaPocaoChefe = r.chpn ? r.chp / r.chpn : curaPocao;",
], 'TK-01-16/decl');
lin("if (!curaPocaoChefe) curaPocao = cp * 0.6; // região nova: estimativa conservadora",
  "      if (!curaPocaoChefe) curaPocaoChefe = cp * 0.6;   // regiao nova: estimativa conservadora", 'TK-01-16/fallback');

/* ============================ TK-02-33: fugir de QUALQUER coisa que mata ================ */
lin("    const morre = !!(r && r.risco && r.risco.morre);          // risco de morte MEDIDO naquela região", [
  "    const morre = !!(r && r.risco && r.risco.morre);          // risco de morte MEDIDO naquela regiao",
  "    // TK-02-33: fugir de QUALQUER coisa que mata, MOB incluido. O `agregar()` so calcula",
  "    // `risco` para regioes COM CHEFE (`r.boss && nivelChefe`), pelo que uma regiao de MOBS",
  "    // que mata nunca punha `morre` a true — exactamente a queixa do dono (\"morrer para um",
  "    // mob nunca contava\"). A `estimarRegiao` avalia MONSTRO a monstro e declara `morte===true`.",
  "    let estReg = null; try { estReg = idReg ? estimarRegiao(idReg) : null; } catch { /* ignore */ }",
  "    const regiaoMata = !!(estReg && estReg.morte === true);   // PROVADO: um mob da regiao mata",
], 'TK-02-33/medicao');
lin("    if (!fatalVivo && est && est.ganha && est.potTotal != null) {",
  "    if (!fatalVivo && !morre && !regiaoMata && est && est.ganha && est.potTotal != null) {", 'TK-02-33/cobrem');
lin("    const foge = fatalVivo || morre || (perde && !cobrem);", [
  "    // QUEM MANDA FUGIR: golpe injogavel OU regiao que mata (MOB incluido) OU luta perdida",
  "    // sem pocoes que cheguem.",
  "    const foge = fatalVivo || morre || regiaoMata || (perde && !cobrem);",
], 'TK-02-33/foge');
lin("    if (!fatalVivo && cobrem) { logEvent('chefe-fatal', { adiado: 'poções cobrem', regiao: regiaoTxt, perde, morre }); return; }",
  "    if (!fatalVivo && !morre && !regiaoMata && cobrem) { logEvent('chefe-fatal', { adiado: 'pocoes cobrem', regiao: regiaoTxt, perde, morre }); return; }", 'TK-02-33/adiado');
lin("      dps: r && r.risco ? Math.round(r.risco.dps) : null, tMorrer: r && r.risco ? r.risco.tMorrer : null, acao: 'fugir (B → base)' };", [
  "      dps: r && r.risco ? Math.round(r.risco.dps) : null, tMorrer: r && r.risco ? r.risco.tMorrer : null,",
  "      regiaoMata, riscoMob: estReg ? estReg.riscoMob : null,",
  "      acao: 'fugir (B → base)' };",
], 'TK-02-33/decisao');
lin("    if (idReg && !fatalVivo && !perde) setTimeout(() => viajarPara(idReg), 8000);", [
  "    // VOLTAR A REGIAO? So quando a fuga NAO foi por derrota prevista, golpe injogavel nem",
  "    // regiao que MATA (provado) — voltar a uma regiao que mata era o ciclo morte→fuga→morte.",
  "    if (idReg && !fatalVivo && !perde && !regiaoMata) setTimeout(() => viajarPara(idReg), 8000);",
], 'TK-02-33/voltar');

/* ============================ TK-01-12: viajarPara verificado + retry =================== */
bloco("  let _viagemTent = 0;", "  }", [
  "  // TK-01-12: contadores de tentativa da VIAGEM (recall antes de viajar + clique no mapa).",
  "  let _viagemTent = 0;        // tentativas de RECALL antes de desistir",
  "  let _viagemMapaTent = 0;    // tentativas de clique no mapa (retry com backoff)",
  "  const VIAGEM_MAX_TENT = 3;  // tecto de recalls",
  "  const VIAGEM_MAPA_MAX = 3;  // tecto de cliques no mapa",
  "  const VIAGEM_CONFIRMA_MS = 2500;   // espera pela leitura do local depois do clique",
  "",
  "  /** O local ONDE o boneco esta, pelo MESMO `localId` normalizado do resto do ficheiro.",
  "   *  E a VERIFICACAO da viagem: nao basta o clique, o local tem de dizer que chegou. */",
  "  function localAtual() { return localId(readLocation().text); }",
  "",
  "  async function viajarPara(id) {",
  "    const alvo = String(id || '');",
  "    if (/runeterra/i.test(semAcento(alvo))) { logEvent('runeterra', { bloqueado: id }); return { ok: false, motivo: 'runeterra-manual' }; }",
  "    // Nao esta na base? RECALL primeiro e so depois viaja. Sem isto a viagem e cancelada.",
  "    if (!naBase()) {",
  "      if (_viagemTent >= VIAGEM_MAX_TENT) { logEvent('viagem', { desistiu: id, tentativas: _viagemTent }); _viagemTent = 0; return { ok: false, motivo: 'sem-base' }; }",
  "      _viagemTent++;",
  "      logEvent('viagem', { recall: 'para a base antes de viajar', destino: id, tentativa: _viagemTent });",
  "      press('b');",
  "      await esperar(esperaRecallMs());",
  "      return viajarPara(alvo);          // RETRY (a recursao tem tecto: VIAGEM_MAX_TENT)",
  "    }",
  "    _viagemTent = 0;",
  "    // TETO de cliques no mapa: se o marcador/o botao nao estiverem la, insiste com backoff.",
  "    if (_viagemMapaTent >= VIAGEM_MAPA_MAX) {",
  "      logEvent('viagem', { falhou: id, motivo: 'sem-confirmacao', tentativas: _viagemMapaTent });",
  "      _viagemMapaTent = 0;",
  "      return { ok: false, motivo: 'sem-confirmacao', destino: alvo };",
  "    }",
  "    _viagemMapaTent++;",
  "    press('m');",
  "    await esperar(700);",
  "    const b = document.querySelector(" + B + "#marcadores .marcador[data-local=" + D + "${alvo}" + D + "]" + B + ");",
  "    if (b) b.click();",
  "    await esperar(400);",
  "    const ir = document.querySelector(" + B + "#mapa-info [data-ir=" + D + "${alvo}" + D + "]" + B + ");",
  "    if (ir) ir.click();",
  "    // VERIFICACAO: le o local DEPOIS da viagem. So conta se o local lido for o destino.",
  "    await esperar(VIAGEM_CONFIRMA_MS);",
  "    if (localAtual() === alvo) {",
  "      _viagemMapaTent = 0;",
  "      logEvent('viagem', { ok: true, destino: alvo });",
  "      return { ok: true, destino: alvo, local: readLocation().text };",
  "    }",
  "    // BACKOFF antes de tentar de novo (o dobro da espera de confirmacao).",
  "    logEvent('viagem', { retry: alvo, localLido: readLocation().text, tentativa: _viagemMapaTent });",
  "    await esperar(VIAGEM_CONFIRMA_MS * 2);",
  "    return viajarPara(alvo);",
  "  }",
], 'TK-01-12/viajarPara');

/* ============================ TK-01-14: trava so depois do recall confirmado ============ */
bloco("    reporAte = Date.now() + 15 * 60000;   // trava: no MÁX 1 reposição a cada 15 min (evita loop/gasto)", "    setTimeout(() => { try { if (naBase()) acaoBase().catch(() => { /* ignore */ }); } catch { /* ignore */ } }, esperaRecallMs());", [
  "    // TK-01-14: a trava de 15 min era gravada ANTES de o recall dar certo. Se a viagem falhasse",
  "    // (a VIAGEM e cancelada por dano — jogo.js:492 \"Viagem cancelada: voce levou dano\" — e o",
  "    // recall por Esc, jogo.js:1635), a trava ficava 15 min a bloquear QUALQUER reposicao sem",
  "    // nada ter sido reposto. Agora a trava so e armada quando a BASE esta confirmada; recall",
  "    // falhado desarma-a e diz-o no log.",
  "    const armarTravaRepor = () => { reporAte = Date.now() + 15 * 60000; };   // no MAX 1 reposicao/15 min",
  "    const desarmarTravaRepor = (motivo) => {",
  "      if (reporAte) { reporAte = 0; logEvent('repor', { trava: 'desarmada', motivo }); }",
  "    };",
  "    logEvent('repor', { motivo: 'pocao baixa', falta, atual: p });",
  "    if (naBase()) { armarTravaRepor(); acaoBase().catch(() => { /* ignore */ }); return; }",
  "    press('b');",
  "    setTimeout(() => {",
  "      try {",
  "        if (naBase()) { armarTravaRepor(); acaoBase().catch(() => { /* ignore */ }); }",
  "        else desarmarTravaRepor('recall nao chegou a base');",
  "      } catch { /* ignore */ }",
  "    }, esperaRecallMs());",
], 'TK-01-14/trava');

/* ============================ TK-01-13: regiaoIdeal() null deixa de ser silencioso ======= */
{
  const iFun = linhas.findIndex((l, k) => LIMPO(k).includes("function regiaoIdeal() {"));
  const frag = "    if (!cand.length) return null;";
  const i = linhas.findIndex((l, k) => k > iFun && LIMPO(k) === frag);
  if (i < 0) throw new Error('[TK-01-13] ramo do cand nao encontrado');
  linhas.splice(i, 1, ...[
    "    if (!cand.length) {",
    "      // TK-01-13: `regiaoIdeal()` devolvia null EM SILENCIO — o sintoma exacto do \"parado na",
    "      // base\" sem uma linha de log que explicasse porque. Agora diz QUAL campo falta: sem meta,",
    "      // sem monstros, ou nenhuma regiao que PROVE que ele sobrevive (o filtro e fail-closed).",
    "      const motivo = !(META.locais || []).length ? 'META.locais vazio (a meta do jogo nao chegou)'",
    "        : (META.locais || []).every((l) => !l.monstros) ? 'META.locais sem monstros (meta incompleta)'",
    "          : 'nenhuma regiao provou morte===false (fail-closed: nao sei = nao vou)';",
    "      logEvent('regiao', { ideal: null, motivo, nivel: p.nivel, locais: (META.locais || []).length, comMonstros: (META.locais || []).filter((l) => l.monstros).length });",
    "      return null;",
    "    }",
  ].map((t) => t + (CRLF ? '\r' : '')));
  FEITOS.push('TK-01-13/null@' + (i + 1));
}
lin("    return (doNivel[0] || base[0])?.l.id || null;", [
  "    // TK-01-13: tambem a saida por falta de candidatos depois do filtro de nivel era silenciosa.",
  "    const escolhido = (doNivel[0] || base[0])?.l.id || null;",
  "    if (!escolhido) logEvent('regiao', { ideal: null, motivo: 'escolha vazia depois dos filtros', nivel: p.nivel });",
  "    return escolhido;",
], 'TK-01-13/escolha');

/* ============================ TK-01-17b: proximoGiro por localId + tecto ================= */
lin("  function proximoGiro() {", [
  "  // TK-01-17: contador de tentativas de chegar a Fonte (tecto de seguranca do giro).",
  "  let _giroTent = 0;",
  "  function proximoGiro() {",
], 'TK-01-17/contador');
lin("    if ((readLocation().text || '') !== 'Fonte') { press('b'); return setTimeout(proximoGiro, 9000); }", [
  "    // TK-01-17: a comparacao era pelo TEXTO EXACTO ('Fonte'). O HUD escreve o local como o jogo",
  "    // o escreve — \"Fonte (nucleo)\", minuscula, com acento — e a comparacao nunca passava: o giro",
  "    // re-agendava-se a cada 9 s e NUNCA saia da Fonte (loop infinito, sem uma linha de log).",
  "    // Agora: localId NORMALIZADO e um TETO de tentativas que DESISTE com log.",
  "    if (localId(readLocation().text) !== 'fonte') {",
  "      _giroTent++;",
  "      if (_giroTent > 4) {",
  "        logEvent('giro', { desistiu: 'nao chegou a Fonte', local: readLocation().text, tentativas: _giroTent, i: giro.i, total: giro.lista.length });",
  "        giro = null; salvarGiro();",
  "        return;",
  "      }",
  "      press('b');",
  "      logEvent('giro', { esperaFonte: true, local: readLocation().text, tentativas: _giroTent });",
  "      return setTimeout(proximoGiro, 9000);",
  "    }",
  "    _giroTent = 0;",
], 'TK-01-17/giro');

/* ============================ TK-01-12b: marcarAtiva SO depois de confirmada ============= */
{
  const re = /marcarAtiva\(\); viajarPara\(([A-Za-z_$][\w$]*)\);/g;
  let n = 0;
  for (let k = 0; k < linhas.length; k++) {
    const t = LIMPO(k);
    if (!re.test(t)) continue;
    linhas[k] = t.replace(re, (_m, reg) => 'viajarPara(' + reg + ').then((r) => { if (r && r.ok) marcarAtiva(); });') + (CRLF ? '\r' : '');
    n++;
  }
  if (n) FEITOS.push('TK-01-12/marcarAtiva (' + n + ' sitios)');
  const par = ["      marcarAtiva();", "      viajarPara(reg);"];
  const iPar = linhas.findIndex((l, k) => LIMPO(k) === par[0] && LIMPO(k + 1) === par[1]);
  if (iPar >= 0) {
    linhas.splice(iPar, 2, ...[
      "      // TK-01-12: `marcarAtiva()` so DEPOIS de a viagem estar CONFIRMADA — antes marcava",
      "      // activo e a viagem falhava em silencio, deixando o boneco parado com o AFK enganado.",
      "      viajarPara(reg).then((r) => { if (r && r.ok) marcarAtiva(); });",
    ].map((t) => t + (CRLF ? '\r' : '')));
    FEITOS.push('TK-01-12/afk@' + (iPar + 1));
  }
}

/* ============================ exports + ativaHaMs (TK-01-12) =========================== */
lin("  function saudeAutoplay() { return { ultimoTickHaMs: _ultimoTick ? Date.now() - _ultimoTick : null, timers: (window.__lolidleAutoTimers || []).length, enabled: cfg.enabled, pausado }; }", [
  "  function saudeAutoplay() { return { ultimoTickHaMs: _ultimoTick ? Date.now() - _ultimoTick : null, timers: (window.__lolidleAutoTimers || []).length, enabled: cfg.enabled, pausado,",
  "    // TK-01-12: ha quanto tempo o boneco foi marcado activo. E o que prova que o `marcarAtiva`",
  "    // passou a correr SO depois de a viagem ser CONFIRMADA (antes marcava antes de viajar).",
  "    ativaHaMs: ativaEm ? Date.now() - ativaEm : null }; }",
], 'TK-01-12/saude');
{
  // TK-01-12: exports novos para o banco poder chamar directly. INSERE dentro da linha
  // (nunca a substitui: a linha original traz dezenas de exports).
  const i = linhas.findIndex((l, k) => LIMPO(k).includes("podeFazer, arvoreInterruptores, INTERRUPTORES,"));
  if (i < 0) throw new Error('[exports] linha de exports nao encontrada');
  linhas[i] = LIMPO(i).replace("podeFazer, arvoreInterruptores,", "podeFazer, arvoreInterruptores, checarPocoes, checarChefeFatal, localAtual,") + (CRLF ? '\r' : '');
  FEITOS.push('exports@' + (i + 1));
}

fs.writeFileSync(ALVO, linhas.join('\n'));
console.log('APLICADO (' + FEITOS.length + ' blocos):');
for (const f of FEITOS) console.log('  ' + f);
