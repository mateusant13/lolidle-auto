# PROVA — TK-02-09: a CURVA do inject.js deixou de ser copiada à mão

> Ticket: TK-02-09 (P1) · branch w8-obs · data: 2026-10-14
> Regra N.o 3 do AGENTS.md: *numero que existe no jogo e LIDO, nunca copiado*.

## O que estava mal (antes)

`extension/inject.js` (no commit ff273f0) copiava à mão três blocos de números que o motor
aplica: a CURVA (coeficientes `hp: [150,100,1]` etc.) e as constantes inline de spawn
(`grupoSpawn = { base: 2, rand: 3 }`, `respawn = { clear: 1.5, local: 1.2 }`). Se o jogo
buffasse a curva, a extensão não sabia — foi assim que o dono morreu na região do Barão
(AGENTS.md). A cópia também ignorava o `ajuste` da planilha (`motor.js:281`, balanco.js),
que o motor multiplica dentro da CURVA (`motor.js:282-288`).

## O que ficou (depois) — extension/inject.js

| O quê | Linha | O que faz |
|---|---|---|
| `toNum` com sufixo k/M | :57 | `'12.3k' -> 12300`, `'1.2M' -> 1200000`, grupo de 3 casas = milhar; inteiros iguais (sem regressão). Sufixo do `fmt()` do jogo: `cena.js:225` |
| `avaliarCurva` | :161 | avalia `M.CURVA` (motor.js:282-288) nível a nível, 1..`NIVEL_MAX` (motor.js:34), com o `ajuste` (motor.js:281) já dentro |
| `resolverSistema`/`coeficientes` | :176-207 | deriva os coeficientes CRUS do polinómio do motor (grau 2, tenta 3) e VERIFICA em todos os 50 níveis; se a forma mudar, não força a barra |
| `CURVA_FALLBACK` | :157 | as chaves antigas, usadas SÓ quando a avaliação falha, com o motivo em `curvaErro` |
| `meta.curvaPorNivel` | :220 | a tabela avaliada (números LIDOS) |
| `meta.rmMonstro` | :238 | `M.RM_MONSTRO` (motor.js:1194) — o consumidor automation.js:1036 tinha 0,6 escrito à mão |
| `meta.grupoSpawn/respawn = null` | :245 | até serem MEDIDOS no estado vivo (quem consome tem o fallback dele) |
| `medirSpawn`/`publicarMedidas` | :324-371 | mede o tamanho do grupo (motor.js:1137), o respawn de wave limpa (motor.js:1646) e o de troca de local (motor.js:3069) no `combate` que o `sincronizar` (jogo.js:669) recebe a cada tick, DEPOIS do `passo` |
| wrap `P.sincronizar` | :373 | instala a medição; `spawnHook`/`spawnHookErro` dizem se pegou |

Formato escolhido para `meta.curva`: coeficientes crus derivados do motor — é o formato que o
consumidor actual consome (`automation.js:1005-1012` reaplica o `ajuste` a partir do
`META.balanco`). Um buff na CURVA muda estes coeficientes sozinho. `meta.curvaPorNivel`
acrescenta a tabela exacta por nível, já com o `ajuste` dentro.

## A prova (hook a correr o inject.js REAL)

O probe corre o `inject.js` real (só as URLs `https://lolidle.com/js/` reescritas para a
cópia local do jogo) duas vezes: **A** com o motor como está e **B** com a CURVA buffada
(base do hp 150 -> 160). Um buff no motor tem de aparecer no `meta` sem mexer no código.
Corre também a medição de spawn com um `combate` simulado tick a tick e os sufixos k/M do
canvas. Saída completa (rc=0):

```
DEBUG mensagens A: meta,meta,meta,meta,meta
DEBUG meta-erro A: []
DEBUG keys do ultimo meta: __lolidleAuto,monstros,locais,balanco,itens,ondeItem,pocoes,exaustao,pocaoPvp,noturno,furioso,gemas,recall,grupo,nivelMax,espacos,curva,curvaPorNivel,curvaErro,rmMonstro,kit,champ,rodizio,mecanicas,chefeHook,chefeHookErro,combateHook,kits,mochila,ciclo,fuso,grupoSpawn,respawn,spawnHook,spawnHookErro,nivelDif,habChefe,modelos,dicaAtributos,ordemHab,bonusTwitch,bonusEvento
=== A. meta.curva / curvaPorNivel: numeros LIDOS do motor ===
PASSA A: curvaPorNivel tem 50 niveis :: n=50
PASSA A: curvaPorNivel[29].hp = CURVA.hp(29) :: 3891 vs 3891
PASSA A: curvaPorNivel[29].ouro com ajuste dentro :: 109.5
PASSA A: curvaErro null :: null
PASSA A: rmMonstro lido do motor :: 0.6
=== B. BUFF na CURVA (hp 150 -> 160) aparece no meta sem mexer no codigo ===
PASSA B: meta.curva DIFERENTE de A (coeficientes derivados) :: [150,100,1] vs [160,100,1]
PASSA B: curvaPorNivel[29].hp DIFERENTE de A :: 3891 vs 3901
PASSA B: curvaPorNivel[29].hp = motor B exacto :: 3901 vs 3901
PASSA B: coeficiente hp[0] = 160 (base buffada) :: 160,100,1
=== C. coeficientes derivados reproduzem o motor pelo consumidor actual ===
PASSA C: poly(co,n)*ajuste == CURVA do motor (erro max 0.000000000)
=== D. sufixos k/M do fmt() (cena.js:225) ===
PASSA D: "12.3k" -> 12300 :: leu 12300 (dmg)
PASSA D: "1.2M" -> 1200000 :: leu 1200000 (dmg)
PASSA D: "4.188" -> 4188 :: leu 4188 (dmg)
PASSA D: "9876" -> 9876 :: leu 9876 (dmg)
DEBUG HEAL_TXT("+12.3k")=true fillStyle=#40e060 canvas={"id":"tela"}
PASSA D: "+12.3k" -> heal 12300 :: leu 12300
=== E. medidas de spawn (grupoSpawn/respawn) medidas no estado vivo ===
PASSA E: grupoSpawn = {base:2, rand:3} (motor.js:1137) :: {"base":2,"rand":3,"min":2,"max":4,"n":20}
PASSA E: onda de chefe nao entrou na medida (base ficou 2) :: base=2
PASSA E: respawn = {clear:1.5, local:1.2} (motor.js:1646/:3069) :: {"clear":1.5,"local":1.2}
PASSA E: medidas com n>=20 grupos vistos :: n=20
RESULTADO: TODAS PASSAM (28 linhas)
```

Leituras que a prova fecha:
- `meta.curva` e `meta.curvaPorNivel` MUDAM entre as duas execuções (aceitação do ticket:
  *duas execuções com curvas diferentes dão meta.curva diferentes*).
- Os coeficientes derivados reproduzem o motor EXACTOS pelo caminho do consumidor actual
  (`poly(coeficientes, n) × ajuste == CURVA(n)`, erro máx 0,000000000).
- `'12.3k' -> 12300`, `'1.2M' -> 1200000`, `'+12.3k' -> heal 12300` (antes: o heal era lido
  como 123 e o dmg com sufixo era DESCARTADO em silêncio).
- `grupoSpawn = {base: 2, rand: 3}` e `respawn = {clear: 1.5, local: 1.2}` MEDIDOS no estado
  vivo; a onda de chefe (1 inimigo, motor.js:1134) não entra na conta; antes da medição os
  dois campos ficam `null` (nada copiado).

## Limites conhecidos (declarados, não escondidos)

1. **`respawn.local` pode ler 1 tick a menos** (~1,15 em vez de 1,2): o `viajar()`
   (motor.js:3069) dispara no `passoViagem` (jogo.js:1566), DEPOIS do `sincronizar`
   (jogo.js:669) desse quadro — o primeiro `sincronizar` que vê o local novo já levou um
   decremento. A medida continua a ACOMPANHAR o jogo (se o literal mudar, a medida muda); o
   `respawn.clear` (wipe, motor.js:1646) é exacto, porque a limpeza acontece dentro do
   `passo`, antes do `sincronizar`.
2. O probe usa um `cena.js` stub mínimo (a classe basta para agarrar o `sincronizar`) e o
   `motor.js` real. Prova ao vivo no browser (marcador discriminante) é da lane do Lead.
3. `bun tools/testes/run.mjs` rc=0 antes e depois (o banco corre o automation.js, que este
   ticket não touca); nenhum teste codificava o comportamento antigo.

## Fonte do probe

```js
import node from 'node:fs';

// PROVA TK-02-09 — corre o inject.js REAL contra o motor REAL (A) e contra uma
// variante com a CURVA buffada (B). Um buff no motor tem de aparecer no meta.
const linhas = [];
const say = (s) => { linhas.push(s); console.log(s); };
let falhas = 0;
const ok = (rot, cond, extra) => { if (!cond) falhas++; say((cond ? 'PASSA ' : 'FALHA ') + rot + (extra ? ' :: ' + extra : '')); };

async function correr(v) {
  const msgs = [];
  const Stub = class { fillText() {} };
  const janela = { postMessage: (d) => msgs.push(d), addEventListener: () => {} };
  const fn = new Function('window', 'document', 'CanvasRenderingContext2D', 'OffscreenCanvasRenderingContext2D',
    'setInterval', 'clearInterval', 'console',
    node.readFileSync('I:/w8-probe-tmp/' + v + '/inject.js', 'utf8'));
  fn(janela, {}, Stub, Stub, () => 0, () => {}, console);
  await new Promise((r) => setTimeout(r, 600));
  const metas = msgs.filter((m) => m.__lolidleAuto === 'meta');
  return { msgs, meta: metas[metas.length - 1] || {}, metas, Stub, janela };
}

(async () => {
  const { Cena } = await import('file:///I:/w8-probe-tmp/a/cena.js');
  const A = await correr('a');
  say('DEBUG mensagens A: ' + A.msgs.map((m) => m.__lolidleAuto || m.__lolidle || '?').join(','));
  say('DEBUG meta-erro A: ' + JSON.stringify(A.msgs.filter((m) => m.__lolidleAuto === 'meta-erro')));
  say('DEBUG keys do ultimo meta: ' + Object.keys(A.meta).join(','));
  const B = await correr('b');
  const MA = A.meta, MB = B.meta;
  const CURVA_A = await import('file:///I:/w8-probe-tmp/a/motor.js');
  const CURVA_B = await import('file:///I:/w8-probe-tmp/b/motor.js');
  const { BALANCO } = await import('file:///I:/w8-probe-tmp/a/balanco.js');
  const ajusteDe = (n) => BALANCO.find((b) => n >= b.de && n <= b.ate) || BALANCO[BALANCO.length - 1];

  say('=== A. meta.curva / curvaPorNivel: numeros LIDOS do motor ===');
  ok('A: curvaPorNivel tem 50 niveis', MA.curvaPorNivel && Object.keys(MA.curvaPorNivel).length === 50, 'n=' + (MA.curvaPorNivel ? Object.keys(MA.curvaPorNivel).length : 0));
  ok('A: curvaPorNivel[29].hp = CURVA.hp(29)', MA.curvaPorNivel && MA.curvaPorNivel[29] && MA.curvaPorNivel[29].hp === +CURVA_A.CURVA.hp(29).toFixed(2), MA.curvaPorNivel && MA.curvaPorNivel[29] ? MA.curvaPorNivel[29].hp + ' vs ' + CURVA_A.CURVA.hp(29) : 'sem tabela');
  ok('A: curvaPorNivel[29].ouro com ajuste dentro', MA.curvaPorNivel && MA.curvaPorNivel[29] && MA.curvaPorNivel[29].ouro === +CURVA_A.CURVA.ouro(29).toFixed(2), String(MA.curvaPorNivel && MA.curvaPorNivel[29] && MA.curvaPorNivel[29].ouro));
  ok('A: curvaErro null', MA.curvaErro === null, String(MA.curvaErro));
  ok('A: rmMonstro lido do motor', MA.rmMonstro === 0.6, String(MA.rmMonstro));

  say('=== B. BUFF na CURVA (hp 150 -> 160) aparece no meta sem mexer no codigo ===');
  ok('B: meta.curva DIFERENTE de A (coeficientes derivados)', JSON.stringify(MA.curva) !== JSON.stringify(MB.curva), JSON.stringify(MA.curva && MA.curva.hp) + ' vs ' + JSON.stringify(MB.curva && MB.curva.hp));
  ok('B: curvaPorNivel[29].hp DIFERENTE de A', MA.curvaPorNivel[29].hp !== MB.curvaPorNivel[29].hp, MA.curvaPorNivel[29].hp + ' vs ' + MB.curvaPorNivel[29].hp);
  ok('B: curvaPorNivel[29].hp = motor B exacto', MB.curvaPorNivel[29].hp === +CURVA_B.CURVA.hp(29).toFixed(2), String(MB.curvaPorNivel[29].hp) + ' vs ' + CURVA_B.CURVA.hp(29));
  ok('B: coeficiente hp[0] = 160 (base buffada)', MB.curva.hp[0] === 160, String(MB.curva.hp));

  say('=== C. coeficientes derivados reproduzem o motor pelo consumidor actual ===');
  const poly = (co, n) => co.reduce((s, k, i) => s + k * Math.pow(n, i), 0);
  let maxErr = 0;
  for (const n of [1, 12, 29, 50]) {
    maxErr = Math.max(maxErr,
      Math.abs(poly(MA.curva.hp, n) * ajusteDe(n).vida - CURVA_A.CURVA.hp(n)),
      Math.abs(poly(MA.curva.ad, n) * ajusteDe(n).dano - CURVA_A.CURVA.ad(n)),
      Math.abs(poly(MA.curva.armadura, n) - CURVA_A.CURVA.armadura(n)),
      Math.abs(poly(MA.curva.xp, n) * ajusteDe(n).xp - CURVA_A.CURVA.xp(n)),
      Math.abs(poly(MA.curva.ouro, n) * ajusteDe(n).ouro - CURVA_A.CURVA.ouro(n)));
  }
  ok('C: poly(co,n)*ajuste == CURVA do motor (erro max ' + maxErr.toFixed(9) + ')', maxErr < 0.01);

  say('=== D. sufixos k/M do fmt() (cena.js:225) ===');
  const ctx = Object.create(A.Stub.prototype);
  ctx.canvas = { id: 'tela' }; ctx.fillStyle = '#ffffff';
  const caso = (txt, esperado) => {
    const antes = A.msgs.length;
    ctx.fillText(txt, 10, 20);
    const m = A.msgs.slice(antes).find((x) => x.__lolidle === 'dmg' || x.__lolidle === 'heal');
    ok('D: ' + JSON.stringify(txt) + ' -> ' + esperado, !!m && m.value === esperado, m ? 'leu ' + m.value + ' (' + m.__lolidle + ')' : 'DESCARTADO');
  };
  caso('12.3k', 12300); caso('1.2M', 1200000); caso('4.188', 4188); caso('9876', 9876);
  ctx.fillStyle = '#40e060';
  say('DEBUG HEAL_TXT("+12.3k")=' + /^\+\s*\d[\d.,\s]*[kKmM]?$/.test('+12.3k') + ' fillStyle=' + ctx.fillStyle + ' canvas=' + JSON.stringify(ctx.canvas));
  const antesH = A.msgs.length;
  ctx.fillText('+12.3k', 10, 20);
  const mH = A.msgs.slice(antesH).find((x) => x.__lolidle === 'heal');
  ok('D: "+12.3k" -> heal 12300', !!mH && mH.value === 12300, mH ? 'leu ' + mH.value : 'DESCARTADO');

  say('=== E. medidas de spawn (grupoSpawn/respawn) medidas no estado vivo ===');
  const cena = new Cena();
  const tick = (t, inimigos, respawn, localId) => { cena.local = { id: localId }; Cena.prototype.sincronizar.call(cena, { tempo: t, inimigos, respawn }, 1, 1); };
  const VIVO = 40, VAZIO = 29;   // 29 ticks vazios = 1,45 s; o grupo nasce no tick 30 (t+1,50) — motor.js:1418-1421
  let t = 0;
  const grupo = (sz, chefe) => Array.from({ length: sz }, (_, i) => ({ id: 'g' + t + ':' + i, chefe: !!chefe }));
  // 1.o grupo (nao contado: e a primeira coisa que se ve) + limpeza
  for (let k = 0; k < VIVO; k++) { t += 0.05; tick(t, grupo(3), 1.5, 'rio'); }
  t += 0.05; tick(t, [], 1.5, 'rio');
  for (let k = 0; k < VAZIO; k++) { t += 0.05; tick(t, [], Math.max(0, 1.5 - (k + 1) * 0.05), 'rio'); }
  // onda de CHEFE (1 inimigo): se contasse, o "base" medido sairia 1 — motor.js:1134
  t += 0.05; tick(t, grupo(1, true), 1.5, 'rio');
  for (let k = 0; k < 10; k++) { t += 0.05; tick(t, grupo(1, true), 1.5, 'rio'); }
  t += 0.05; tick(t, [], 1.5, 'rio');
  for (let k = 0; k < VAZIO; k++) { t += 0.05; tick(t, [], Math.max(0, 1.5 - (k + 1) * 0.05), 'rio'); }
  // 22 grupos com tamanhos 2..4 ciclados
  const sizes = [2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2, 4, 3, 2];
  for (const sz of sizes) {
    for (let k = 0; k < VIVO; k++) { t += 0.05; tick(t, grupo(sz), 1.5, 'rio'); }
    t += 0.05; tick(t, [], 1.5, 'rio');
    for (let k = 0; k < VAZIO; k++) { t += 0.05; tick(t, [], Math.max(0, 1.5 - (k + 1) * 0.05), 'rio'); }
  }
  // troca de local durante o vazio: respawn 1,2 (motor.js:3069)
  t += 0.05; tick(t, grupo(3), 1.5, 'rio');
  for (let k = 0; k < 5; k++) { t += 0.05; tick(t, grupo(3), 1.5, 'rio'); }
  t += 0.05; tick(t, [], 1.2, 'fosso');
  for (let k = 0; k < 23; k++) { t += 0.05; tick(t, [], Math.max(0, 1.2 - (k + 1) * 0.05), 'fosso'); }
  t += 0.05; tick(t, grupo(3), 1.5, 'fosso');
  const ultimo = A.msgs.filter((m) => m.__lolidleAuto === 'meta').pop() || {};
  ok('E: grupoSpawn = {base:2, rand:3} (motor.js:1137)', ultimo.grupoSpawn && ultimo.grupoSpawn.base === 2 && ultimo.grupoSpawn.rand === 3, JSON.stringify(ultimo.grupoSpawn));
  ok('E: onda de chefe nao entrou na medida (base ficou 2)', ultimo.grupoSpawn && ultimo.grupoSpawn.base === 2, 'base=' + (ultimo.grupoSpawn && ultimo.grupoSpawn.base));
  ok('E: respawn = {clear:1.5, local:1.2} (motor.js:1646/:3069)', ultimo.respawn && ultimo.respawn.clear === 1.5 && ultimo.respawn.local === 1.2, JSON.stringify(ultimo.respawn));
  ok('E: medidas com n>=20 grupos vistos', ultimo.grupoSpawn && ultimo.grupoSpawn.n >= 20, 'n=' + (ultimo.grupoSpawn && ultimo.grupoSpawn.n));

  say(falhas === 0 ? 'RESULTADO: TODAS PASSAM (' + linhas.length + ' linhas)' : 'RESULTADO: ' + falhas + ' FALHAS');
  node.writeFileSync('I:/w8-probe-tmp/prova.log', linhas.join('\n'));
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.log('ERRO', e); process.exit(2); });
```
