#!/usr/bin/env node
/*
 * mutantes.mjs - MUTATION TESTING do banco de regressao (prova anti-falso-verde).
 *
 *   node tools/testes/mutantes.mjs
 *
 * Para cada mutacao: copia o extension/automation.js REAL para uma pasta temporaria,
 * aplica UMA alteracao cirurgica no texto-fonte (nunca no ficheiro real), corre o banco
 * contra a copia via LOLIDLE_AUTOMATION e exige que:
 *   (a) o runner saia com rc != 0, e
 *   (b) a assercao esperada apareca como FALHOU.
 *
 * Se alguma mutacao passar em verde, o banco TEM UM BURACO e este script falha.
 * O automation.js real nunca e escrito.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { RAIZ, AUTOMATION_PATH, AUTOMATION_REL } from './dom-stub.mjs';

const TMP = path.join(RAIZ, 'tools', 'testes', '.mutantes');

const MUTACOES = [
  {
    id: 'M1-protecao-build-desligada',
    o_que: 'ehLendarioDaBuild() sempre false (lendario da build deixa de ser blindado)',
    old: '    return lendariosDaClasse().has(b);',
    new: '    return false;',
    esperado: 'T2: fixture: 2001 e lendario da build do AD',
  },
  {
    id: 'M2-rabadon-vira-vendavel',
    o_que: 'ehPrioridadeExtrema() sempre false (Rabadon/Gume passam a ir ao mercado)',
    old: 'const ehPrioridadeExtrema = (base) => _PRIO_IDS.has(basePura(base));',
    new: 'const ehPrioridadeExtrema = (base) => false;',
    esperado: 'T10: Rabadon +2 abaixo de A nunca e anunciado',
  },
  {
    id: 'M3-base-com-refino-nao-parseada',
    o_que: "scanBag() deixa de tirar o '+refino' do id (3089+2 vira base '3089+2')",
    old: "        const base = String(baseRaw || '').replace(/#.*$/, '').replace(/\\+.*$/, '');",
    new: "        const base = String(baseRaw || '').replace(/#.*$/, '');",
    esperado: "T10: scanBag reconhece '3089+2~C' como base 3089",
  },
  {
    id: 'M4-mercado-saturado-sempre-falso',
    o_que: 'mercadoSaturado() volta a ser sempre false (o bug historico)',
    old: '      return { sat: lend >= 10, lend, total: of.length };',
    new: '      return { sat: false, lend, total: of.length };',
    esperado: 'T11: mercadoSaturado() com 10 ofertas lendarias -> sat = true',
  },
  {
    id: 'M5-ator-vende-tier-S',
    o_que: 'venderBase() deixa de travar S/SS (o tier intocavel)',
    old: "if (qIdx(qual) >= qIdx('S')) continue;",
    new: 'if (false) continue;',
    esperado: 'R2: nenhum item S+ foi vendido (S/SS, qualquer raridade)',
  },
  {
    id: 'M6-ator-vende-lendario-da-build',
    o_que: 'venderBase() esquece a protecao do lendario da build da classe',
    old: 'if (lend && lendaBuild.has(String(puro))) {',
    new: 'if (false && lend && lendaBuild.has(String(puro))) {',
    esperado: 'R1: o lendario DA BUILD esta em regras.protegidos com o motivo certo',
  },
  {
    id: 'M7-qualidade-ilegivel-vira-vendavel',
    o_que: "venderBase() deixa de proteger a qualidade '?'/ilegivel",
    old: 'if (!mq || !QUAL.includes(mq[1].toUpperCase())) {',
    new: 'if (!mq) {',
    esperado: 'R5: qualidade ilegivel vai para regras.protegidos com motivo de qualidade',
  },
  {
    id: 'M8-dedupe-fica-com-o-MENOR-tier',
    o_que: 'dedupe lendario ordena ao contrario (fica o MENOR tier: C em vez de B)',
    old: '      const arr = lendPorBase[base].slice().sort((a, b) => tierDe(b) - tierDe(a));',
    new: '      const arr = lendPorBase[base].slice().sort((a, b) => tierDe(a) - tierDe(b));',
    esperado: 'T3: a duplicata sai com motivo de duplicata',
  },
  {
    id: 'M9-perfil-ignora-papel',
    o_que: 'perfilDe ignora papel.recebido (o papel deixa de mudar o perfil)',
    old: 'const receb = pap.recebido != null ? pap.recebido : 1;',
    new: 'const receb = 1;',
    esperado: 'T7: papel muda o perfil (dano -> tanque)',
  },
  {
    id: 'M11-seletor-desconhecido-no-codigo',
    o_que: 'o codigo passa a procurar um seletor FORA do vocabulario do stub (buraco tem de aparecer)',
    old: "const t = document.querySelector('#st-ouro')?.textContent || '';",
    new: "const t = document.querySelector('#st-ouro')?.textContent || document.querySelector('#st-ouro-v2')?.textContent || '';",
    esperado: 'UNSTUBBED:#st-ouro-v2',
  },
  {
    id: 'M12-venda-exige-mochila-cheia-outra-vez',
    o_que: 'n.vender volta a exigir `mochilaQuaseCheia` (o bug de 2026-10-20: epicos/espolios nao sao vendidos na Fonte)',
    old: "      n.vender = podeFazer('vender').pode && (prioridade || (temEspolio && (naBase() || mochilaQuaseCheia)));",
    new: "      n.vender = podeFazer('vender').pode && prioridade && mochilaQuaseCheia;",
    esperado: 'V1: mochila NAO cheia + itens marcados -> n.vender VERDADEIRO',
  },
  {
    id: 'M13-naBase-sempre-verdadeiro',
    o_que: 'handleLog trata tudo como se estivesse na Fonte (naBase sempre true): nunca abre ciclo',
    old: 'const naBase = () => /fonte/i.test(loc.text);',
    new: 'const naBase = () => true;',
    esperado: 'U7: a frase de abate CRIA o ciclo da regiao',
  },
  {
    id: 'M14-faseAtual-sempre-mobs',
    o_que: "faseAtual() ignora `farm.current.fase === 'boss'` e devolve sempre mobs",
    old: "function faseAtual() { return farm.current?.fase === 'boss' ? 'chefe' : 'mobs'; }",
    new: "function faseAtual() { return 'mobs'; }",
    esperado: 'U9: rotacaoSkills na fase de chefe medida inclui a ULTIMATE',
  },
  {
    id: 'M15-anti-oscilacao-sempre-falso',
    o_que: 'barraIdeal deixa de bloquear uma skill que acabou de sair (volta a oscilar a cada ciclo)',
    old: "    const saidaRecente = (t) => barraCheia && _barraSaidas.has(t)",
    new: "    const saidaRecente = (t) => false && barraCheia && _barraSaidas.has(t)",
    esperado: 'B5: skill que acabou de sair NAO volta com a barra cheia',
  },
  {
    id: 'M16-trava-com-vaga-tambem',
    o_que: 'a trava de saida passa a aplicar-se mesmo com uma vaga (a barra fica em 3 slots)',
    old: 'const barraCheia = (s.bar || []).length >= BARRA_SLOTS;',
    new: 'const barraCheia = true;',
    esperado: 'B5: com uma VAGA a trava NAO se aplica e a barra enche',
  },
  {
    id: 'M17-dialogo-clica-o-primeiro-comprar',
    o_que: 'clicarDialogo volta a procurar em TODA a pagina antes do modal (clica o "Comprar" da lista e nao confirma a compra)',
    old: '    const b = noModal || [...document.querySelectorAll(\'button, .botao\')]',
    new: '    const b = [...document.querySelectorAll(\'button, .botao\')]',
    esperado: 'W10: clicarDialogo prefere o botao do MODAL ao "Comprar" da lista',
  },
  {
    id: 'M18-filtros-do-mercado-nao-limpos',
    o_que: 'prepararFiltrosMercado fica no-op (um filtro antigo esconde a ficha da oferta)',
    old: `    try { m.querySelector('[data-cat=""]')?.click(); } catch { /* ignore */ }`,
    new: `    try { /* mutado: nao limpa a categoria */ } catch { /* ignore */ }`,
    esperado: 'W11: categoria Todos e clicada',
  },
  {
    id: 'M10-perfil-ignora-distancia',
    o_que: 'perfilDe ignora distancia (atirador vira dano)',
    old: "if (c.distancia) return 'atirador';",
    new: "if (false && c.distancia) return 'atirador';",
    esperado: 'T8: distancia muda o perfil (dano -> atirador)',
  },
  {
    id: 'M13-sem-piso-do-lojista',
    o_que: 'o piso do Lojista desaparece (oferta de 64 volta a ser referencia -> um lendario cai para 58 de ouro)',
    old: '    const pisoLoj = Math.max(0, Math.round(Number(valorVenda(base, qual, refinoIt)) || 0));',
    new: '    const pisoLoj = 0;',
    esperado: 'P9: oferta de 64 (abaixo do Lojista) NAO e referencia -> sem preco (nunca 58)',
  },
  {
    id: 'M14-compra-sem-olhar-se-ja-tenho',
    o_que: 'mercadoTemDaBuild deixa de verificar se o campeao ja tem o item (volta o ciclo de voltar a base de 20 em 20 s)',
    old: '        if (casa.has(String(base))) continue;                   // JÁ TENHO em casa (equipado/mochila)',
    new: '        if (false) continue;',
    esperado: 'M9b: ... mas JA A TENHO equipada -> false (era o ciclo de 20 em 20 s)',
  },
  /* ---------------- D07/D08/D09/D18 (docs/math-graph.md) - a matematica voltar a divergir ---------------- */
  {
    id: 'M19-d07-tabela-de-nivel-congelada',
    o_que: 'fatorDanoMonstroMotor volta a usar a fotografia (0,35 / max 5) em vez da tabela do motor - o buff/nerf do jogo nunca chega a conta',
    old: '    return Math.min(Number(ND.maxDanoMonstro) || 5, 1 + (Number(ND.danoMonstro) || 0) * d);',
    new: '    return Math.min(5, 1 + 0.35 * d);   // mutado: tabela congelada',
    esperado: 'U1d: se o motor mudar a tabela, a conta muda com ela (0,5 x 4 = x3)',
  },
  {
    id: 'M20-d08-cura-da-pocao-vezes-0,6',
    o_que: 'curaPocaoS() volta a `cura * 0,6` (1.320 hp/s em vez de 2.200) - a divergencia que o D08 fechou',
    old: '    return (c > 0 ? c : 1) / (Number.isFinite(ex) && ex > 0 ? ex : 1);',
    new: '    return (c > 0 ? c : 1) * 0.6;   // mutado: D08',
    esperado: 'U2b: cura/s = cura / EXAUSTAO (motor.js:1407-1416), e NAO cura x 0,6',
  },
  {
    id: 'M21-d09-preco-da-pocao-110',
    o_que: 'precoPocaoEmUso() volta ao literal 110 (preco da FORTE) mesmo com a Suprema na mochila (260)',
    old: '    const c = Number((pocaoInfo(k) || {}).preco);',
    new: '    const c = 110;   // mutado: D09',
    esperado: 'U3: o preco vem do catalogo do jogo (META.pocoes), nunca do literal 110',
  },
  {
    id: 'M22-d18-estimar-luta-sem-dps',
    o_que: 'estimarLuta volta a chamar avaliar SEM o DPS medido -> curaRv = 0 no veredicto do chefe',
    old: '    const av = avaliar(boss, nivel, p, { skill: curaSkill, pocao: 0 }, meuDps() || 0);',
    new: '    const av = avaliar(boss, nivel, p, { skill: curaSkill, pocao: 0 });',
    esperado: 'U5c: com rv 0,15 o roubo de vida ENTRA no veredicto (>= 60 hp/s) - era 0 antes do D18',
  },
  {
    id: 'M23-d20-pocao-como-torneira',
    o_que: 'estimarLuta volta a tratar a pocao como TAXA continua (`net - curaPocaoS()`) - o Anciao devolvia "nunca morre"',
    old: '    const tMorrer = net > 0 ? (vidaPool + pm.reserva) / net : Infinity;',
    new: '    const tMorrer = (net > 0 && net - curaPocaoS() > 0) ? vidaPool / (net - curaPocaoS()) : Infinity;   // mutado: D20',
    esperado: 'U6b: 5 Supremas somam 11.000 hp ao POOL: (2.000 + 11.000) / 3.266 ~ 4,0 s',
  },
];

const original = fs.readFileSync(AUTOMATION_PATH, 'utf8');
console.log('Mutation testing do banco de regressao');
console.log('ALVO ' + AUTOMATION_REL + '  bytes=' + original.length);
console.log('');

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

let pegos = 0;
const resultados = [];
for (const m of MUTACOES) {
  const ocorrencias = original.split(m.old).length - 1;
  if (ocorrencias !== 1) {
    resultados.push({ m: m, ok: false, nota: 'mutacao NAO aplicavel: ' + ocorrencias + ' ocorrencias do trecho (a fonte mudou?)' });
    continue;
  }
  const ficheiro = path.join(TMP, m.id + '.js');
  fs.writeFileSync(ficheiro, original.replace(m.old, m.new), 'utf8');
  const r = spawnSync(process.execPath, [path.join('tools', 'testes', 'run.mjs')], {
    cwd: RAIZ,
    env: Object.assign({}, process.env, { LOLIDLE_AUTOMATION: ficheiro }),
    encoding: 'utf8',
  });
  const saida = String(r.stdout || '');
  const vermelho = r.status !== 0;
  const assercaoPega = saida.indexOf('FALHOU: ' + m.esperado) >= 0;
  const ok = vermelho && assercaoPega;
  if (ok) pegos++;
  resultados.push({
    m: m, ok: ok,
    nota: 'rc=' + r.status + ' assercaoEsperadaFalhou=' + assercaoPega
      + (vermelho ? '' : ' <-- BURACO: mutacao sobreviveu em verde!'),
  });
  fs.rmSync(ficheiro, { force: true });
}
fs.rmSync(TMP, { recursive: true, force: true });

for (const r of resultados) {
  console.log((r.ok ? 'PEGO   ' : 'FALHOU ') + r.m.id);
  console.log('  mutacao: ' + r.m.o_que);
  console.log('  esperado: FALHOU: ' + r.m.esperado);
  console.log('  ' + r.nota);
}
console.log('');
console.log('MUTACOES ' + MUTACOES.length + '  PEGAS ' + pegos + '  SOBREVIVENTES ' + (MUTACOES.length - pegos));
const rc = pegos === MUTACOES.length ? 0 : 1;
console.log('rc=' + rc);
process.exit(rc);
