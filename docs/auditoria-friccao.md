# Auditoria de fricção — `extension/automation.js` + `extension/gui.js`

**Autor:** auditor-friccao (lane read-only) · **Data:** 2026-10-14
**Escopo:** `extension/automation.js` (3437 linhas), `extension/gui.js`, com confronto contra
`docs/game-src/motor.js`, `docs/game-src/jogo.js`, `docs/game-src/cena.js`, `docs/game-src/wiki-dados.js`,
`docs/lolidle-internals.md` e `TODO.md`.
**Método:** só leitura (grep + leitura de regiões + verificação offline de regex/mapping em Node).
**Nenhum acesso ao browser/jogo** — nada de `ll.mjs`, CDP ou Chrome. Nenhum ficheiro do alvo foi editado.

---

## 0. Verificação pedida: "Fosso do Dragão nível 30–40" resolve para a região `fonte`?

**REFUTADO.** O `localId()` está correto para o Dragão. Verificação offline (replicando a função
com a lista `LOCAIS` do motor, `motor.js:355-378`):

```
localId("Fosso do Dragão nível 30–40") = dragao
localId("Rio nível 25–35")             = rio
localId("Fonte")                       = fonte
localId("Covil do Barão nível 40–50")  = barao
localId("Runeterra Cidade de Noxus · nível 30–40") = arena
```

Evidência do código: `automation.js:1297-1300` faz `find(x => regionTxt.startsWith(x.nome))`;
`motor.js:369` define `{ id: 'dragao', nome: 'Fosso do Dragão', faixa: [30,40], nm: [30,38] ... }`;
`jogo.js:6489` monta o `#local-nome` como `${l.nome} <small>nível {min}–{max}</small>`, ou seja o
`textContent` é exatamente `"Fosso do Dragão nível 30–40"`. Nenhum nome de `LOCAIS` é prefixo de
outro, então o `find` não tem colisão.

**Qual é a causa real do `dps` nulo então?** O comando do CLI passa a **localização ATUAL**:

```js
// tools/ll.mjs:67
dps: () => J(`${A}.dpsCenarios(${A}.readEquip().map(e=>e.base), ${A}.localId(${A}.readLocation().text))`),
```

Se o boneco estiver **na Fonte** quando o `ll.mjs dps` roda, `localId('Fonte')` = `'fonte'` e
`previaSet(ids,'fonte')` (`automation.js:2100-2109`) acha `L = fonte` mas `L.monstros` é `undefined`:

```js
// automation.js:2104-2105
if (L?.monstros?.[0]) { ... alvos.mob = ... }
if (L?.chefe) { ... alvos.chefe = ... }
// → alvos = {} → est(a) devolve null → { mob: null, chefe: null, regiao: 'fonte', itens: [...] }
```

Ou seja o `regiao: "fonte"` que apareceu na saída era **a base onde o comando foi rodado**, não um
mapeamento errado do Dragão. O que É um defeito é o silêncio: ver **F-13** (DPS nulo sem motivo; o fix
inclui aceitar `dps [regiaoId]` no CLI em vez de usar a localização atual).

---

## Resumo

| # | Severidade | Achado | Ficheiro:linha |
|---|---|---|---|
| F-1 | HIGH | Nível do chefe em `agregar()` = `faixa[0]+2` (deveria ser `nm[1]+2`) → risco subestima o chefe ~2–3× | automation.js:1167-1168 |
| F-2 | HIGH | Guarda "região letal" de `iniciarTeste` é código morto (`estimarRegiao` não devolve `risco`) | automation.js:2152-2155 |
| F-3 | HIGH | `regiaoIdeal()` filtra `!x.e.morte` e `rankRegioes` expõe `morte` — campo que nunca existe | automation.js:3264, 3274 |
| F-4 | HIGH | Cinco convenções diferentes de nível de mob/chefe no mesmo ficheiro | 768, 1168, 1226, 2104, 2960, 3135 |
| F-5 | HIGH | `estimarLuta` não aplica `fatorDanoJogador` (motor.js:1221) — `fJ` é calculado e jogado fora | automation.js:1114, 1138, 3149 |
| F-6 | HIGH | `avaliar()` ignora `papel.recebido` (motor.js:2697) — dano recebido 33% inflado p/ Katarina | automation.js:1120-1121 |
| F-7 | HIGH | `viajarPara()` não verifica nada: se o mapa não abrir, o clique some e o boneco fica parado | automation.js:1339-1347 |
| F-8 | HIGH | `regiaoIdeal()` devolver `null` é silencioso → nunca sai da base e nada é logado | automation.js:3268, 3343-3344 |
| F-9 | MED | `supervisarBase`: `res.ok` + `marcarAtiva()` dentro de `acaoBase()` = livelock na base | automation.js:1543, 3327-3337 |
| F-10 | MED | `checarPocoes` grava a trava de 15 min ANTES do recall dar certo (sem retry) | automation.js:3298-3302 |
| F-11 | MED | Regex de ouro/XP não aceitam o `fmt` do jogo (`12.3k`) → linha inteira ignorada, abate não contado | automation.js:481-482 vs cena.js:225 |
| F-12 | MED | `valeComprar`: `x.region === zona.nome` nunca casa (região tem " nível X–Y") → usa região errada | automation.js:2883-2884 |
| F-13 | MED | `previaSet`/`dpsItens`/`melhorSet` devolvem DPS `null` em silêncio (base/Runeterra/Arena) | automation.js:2100-2128, 2954-2962 |
| F-14 | MED | `ritmoMobs` usa `grupoSpawn.base` (2) em vez da média da wave (3) → `seg3` 33% baixo | automation.js:376 |
| F-15 | MED | `salvarTestes` grava a MESMA rodada N vezes (duplicatas no storage e no previsor) | automation.js:2293-2300 |
| F-16 | MED | `melhorSet` enfia o Rabadon no alvo mesmo sem ter o item → re-equip a cada 20 s | automation.js:2963-2964, 2998-3002 |
| F-17 | MED | `player().vida` cai para o HP hardcoded **4188** quando o parse falha | automation.js:844 |
| F-18 | MED | `inject.js` manda `bonusTwitch`/`bonusEvento`; a automação nunca lê (subestima XP/ouro) | inject.js:156-157 vs automation.js:692 |
| F-19 | LOW | `accumulate` lê o dataset do content.js; parse falho → dano/cura = 0 em silêncio | automation.js:1266-1273 |
| F-20 | LOW | `agregar` escreve o fallback da poção na variável errada (`curaPocao` em vez de `curaPocaoChefe`) | automation.js:1173-1174 |
| F-21 | LOW | `proximoGiro` exige texto exato `'Fonte'` e re-tenta `press('b')` a cada 9 s para sempre | automation.js:3014 |
| F-22 | LOW | Config morta: `ultEmMobs`, `keepEpicA`; `readLocation().tier` sempre `null` | automation.js:31, 41, 75 |

---

## F-1 HIGH — Nível do chefe em `agregar()` sai da faixa exibida, não do `nm` do motor

**Ficheiro:** `extension/automation.js:1167-1168` (consumido em 1174, 1184, 1313, 3215, gui.js:569)

```js
const rm = (r.region || '').match(/(\d+)\s*[–-]\s*(\d+)/);
const nivelChefe = rm ? +rm[1] + 2 : null;
const risco = r.boss && nivelChefe ? avaliar(r.boss, nivelChefe, pl, { skill: curaSkillChefe, pocao: ... }) : null;
```

`r.region` é o texto do HUD (`"Rio nível 25–35"`, de `handleLog` → `novoCiclo(loc.text)`), então
`rm[1]` é o **piso da FAIXA IDEAL**, não o teto do `nm` (faixa de spawn). Para o Rio: `faixa[25,35]`,
`nm[25,33]` (`motor.js:367`) → este código usa **27**, enquanto o correto é `nm[1]+2 = 35`.
O `estimarLuta` do mesmo ficheiro usa o critério certo (`automation.js:3135`:
`const nivel = (loc.nm ? loc.nm[1] : loc.faixa[1]) + 2;`), e a wiki também
(`wiki-dados.js:20`: `n0: z.nm[1] + 2`).

**Impacto (muda decisão):** `avaliar()` deriva `dif`, `fM` e `statsMonstro(boss, nivel)` desse nível.
Para o Dragão (faixa 30–40, nm 30–38) o código usa **32** em vez de **40**: `CURVA.ad(32)·fM(1,15)` ≈ 340
vs `CURVA.ad(40)·fM(2,35)` ≈ 961 — **~2,8× de dano recebido a menos**. Como `risco.morre` alimenta:
`checarChefeFatal` (a regra morte-zero do dono — não foge porque "não morre"), `recomendar()`
(`viaveis = agg.filter(r => r.risco && !r.risco.morre)`) e a coluna "resultado" da GUI (`gui.js:569`),
o efeito prático é **não fugir de chefe fatal** e **recomendar região letal**.

**Fix:** uma função única `nivelChefeDe(loc)` usada por `agregar`/`estimarLuta`/`planejar`:
`(loc.nm ? loc.nm[1] : loc.faixa[1]) + 2`. Como `agregar` só tem o texto, guardar o id da região no
ciclo (`farm.current.regionId`, já disponível via `localId`) e resolver o `loc` a partir dele.

---

## F-2 HIGH — A guarda de "região letal" do `iniciarTeste` nunca dispara (falso verde)

**Ficheiro:** `extension/automation.js:2152-2155`

```js
try {
  const rr = estimarRegiao(regiao);
  const letal = rr && rr.risco && (rr.risco.mortal || rr.risco.morre);
  if (letal && !opts.forcar && !cfg.testeForcar) return { ok: false, motivo: `regiao ${regiao} LETAL ...` };
} catch { /* ignore */ }
```

`estimarRegiao()` **não devolve `risco`** — o objeto retornado (`automation.js:798`) tem
`{ id, nome, faixa, tier, mobLevel, fatorXp, noite, multXp, multOuro, mobHp, mobsPerWave, minhaDps,
modo, kXp, kOuro, xpKill, goldKill, killsMin, xpMin, goldMin, runasKill, runasMin, runasChefe, runasH }`.
Logo `rr.risco` é `undefined`, `letal === false` **sempre**, e o `return` de recusa é inalcançável.
O `TODO.md:142` marca esta guarda como implementada ("**Guarda de teste**: `iniciarTeste` recusa
região letal ... Evita repetir a matança") — é falso verde: a matança no Dragão pode repetir.

**Fix:** usar a fonte que realmente tem o risco: `estimarLuta(regiao)` (devolve `mortal`, `morre`,
`ganha`, `piorMec` em `automation.js:3169`) e/ou
`agregar().find(r => r.region.startsWith(loc.nome))?.risco`. Se nenhum dos dois tiver dado, a guarda
deve **recusar por falta de medição** (fail-closed), não passar.

---

## F-3 HIGH — `morte` em `estimarRegiao`: filtro e campo que não existem

**Ficheiro:** `extension/automation.js:3264` e `3274`

```js
const cand = (META.locais || []).filter((l) => !ehRuneterra(l)).map((l) => ({ l, e: estimarRegiao(l.id) })).filter((x) => x.e && !x.e.morte);
...
return ... { id: l.id, ..., xpMin: e.xpMin, goldMin: e.goldMin, runasH: e.runasH, morte: e.morte, chefe: l.chefe ? l.chefe[0] : null } ...
```

`estimarRegiao` não tem `morte` no retorno (ver F-2). Então `!x.e.morte` é **sempre verdadeiro**
(nenhuma região letal é descartada) e `rankRegioes().morte` é **sempre `undefined`**.

**Impacto (explica mortes documentadas):** `regiaoIdeal()` (3260-3269) só filtra por
`(l.nm ? l.nm[0] : 99) <= p.nivel + 6`. Para o dono **nv 27**: `nm[0]` do Dragão é **30** ≤ 33 →
o Dragão **entra** na lista, e é o de maior `xpMin` → é escolhido. O chefe do Dragão é `nm[1]+2 = 40`
contra um boneco 27. É exatamente o cenário do `TODO.md:135-139` ("no **Dragão nv 30–40** o golpe é
2039 ... 6 variações com mortes"). O filtro que existia para impedir isso está morto.

**Fix:** `regiaoIdeal`/`rankRegioes` devem usar `estimarLuta(l.id)` (`mortal || morre`) ou o
`risco` medido de `agregar()`; e `rankRegioes` deve devolver `morte: !!(est && (est.mortal || est.morre))`.
Enquanto não houver medição, a região com `nm[0] > p.nivel` deve ter penalidade explícita.

---

## F-4 HIGH — Cinco convenções de nível de mob/chefe no mesmo ficheiro

| # | Onde | Fórmula | Correto? |
|---|---|---|---|
| 1 | `estimarRegiao` `automation.js:768` | `Math.max(n0, Math.min(n1, p.nivel - 0.5))` | ✅ (internals §13) |
| 2 | `previaSet` `2104` / `dpsItens` `2118` / `melhorSet` `2960` | `L.nm[1]` (teto da faixa) | ❌ mob que nunca nasce |
| 3 | `planejar` `1226` | `Math.round((nm[0]+nm[1])/2)` e chefe `+2` | ❌ |
| 4 | `estimarLuta` `3135` | `(loc.nm ? loc.nm[1] : loc.faixa[1]) + 2` | ✅ |
| 5 | `agregar` `1168` | `faixa[0] + 2` | ❌ (F-1) |

**Impacto:** o mesmo chefe é avaliado com níveis diferentes conforme o caminho. O caso 2 muda o
**ranking de builds** (`previaSet`/`dpsCenarios`/`rankNormalizado` são o que a GUI e o teste usam
para comparar conjuntos): contra um alvo de nível 33–38 (`nm[1]`) a armadura do alvo é muito maior do
que a do mob que realmente nasce (`clamp(P-0.5)`), e a penetração/CDR passam a valer mais do que valem
no jogo — exatamente o tipo de inversão de ranking que o `TODO.md:2017` ("a teoria inverte o ranking
de farm") já reconhece noutro contexto.

**Fix:** dois helpers e mais nada:
`nivelMobDe(loc, nivelJogador) = Math.max(loc.nm[0], Math.min(loc.nm[1], nivelJogador - 0.5))` e
`nivelChefeDe(loc) = (loc.nm ? loc.nm[1] : loc.faixa[1]) + 2`. Substituir as 5 fórmulas.

---

## F-5 HIGH — `estimarLuta` não aplica `fatorDanoJogador` (o `fJ` é calculado e descartado)

**Ficheiro:** `extension/automation.js:1114` (cálculo), `1138` (retorno), `3149-3150` (uso que falta)

```js
// automation.js:1114
const fJ = dif ? Math.max(ND.minDanoJogador ?? 0.25, 1 - ND.danoJogador * dif) : 1;
// automation.js:3149-3150 — nenhum fJ aqui:
const meuDpsBoss = meDps * mitBoss;
const tKill = meuDpsBoss > 0 ? s.hp / meuDpsBoss : Infinity;
```

O motor aplica o fator em TODO dano do jogador (`motor.js:1221`:
`dano *= fatorDanoJogador(estado, alvo); // monstro bem acima do seu nível aguenta mais`, com
`NIVEL_DIF = { livre: 4, danoJogador: 0.07, minDanoJogador: 0.25 }` em `motor.js:1184`). Um grep de
`\.fJ`/`fJ` em `automation.js` mostra que o campo só aparece na definição (1114) e no `return` (1138):
**ninguém consome**.

**Impacto:** contra o Dragão (chefe 40, jogador 27) `dif = 9` → `fJ = 0.37`: o `tKill` está
subestimado em ~2,7×, e `ganha = tKill <= tMorrer` (`3158`) tende a `true` → a automação decide
**lutar** e `checarChefeFatal` não foge. No Rio (chefe 35) o erro é ~1,4×.
**Ressalva honesta:** o único confronto estimado×real registado (`TODO.md:761-764`, Arauto, real
25,3 s vs estimado 32,2 s) mostra a estimativa **conservadora** — ou seja, o `meuDps()` medido por
abate de mobs subestima o DPS de burst mais do que o `fJ` erra. As duas coisas são verdade; o `fJ`
em falta é um desvio de fórmula comprovado contra o motor, mas o efeito líquido depende da região.

**Fix:** `const meuDpsBoss = meDps * mitBoss * (av.fJ || 1);` (o `av` já está na mão na linha 3144).
Vale também usar `av.fJ` no `dpsTomado` de `agregar` quando o alvo for de nível diferente.

---

## F-6 HIGH — `avaliar()` ignora o papel do campeão no dano recebido

**Ficheiro:** `extension/automation.js:1120-1121` vs `docs/game-src/motor.js:2693-2697`

```js
// automation.js
const dpsTomado = s.ad * fM * as * mit;
const danoGolpe = s.ad * fM * mit;
```
```js
// motor.js:2693-2697
function receberDano(estado, c, a, dano, doSangramento, magico = false, origem = null) {
  ...
  if (!doSangramento) { const pp = kit(estado).papel; dano *= (... pp.recebidoArena ... : pp?.recebido) ?? 1; }
```

Katarina tem `papel: { dano: 1.2, recebido: 0.75, ... }` (`motor.js:885`) — o motor multiplica **todo**
dano não-sangramento por 0,75. A extensão usa `papel.recebido` só para **classificar perfil**
(`automation.js:2445`, `perfilDe`), nunca como multiplicador de dano. O mesmo vale para
`danoMecanica` (`1010`) e para `piorMec` (`1127`).

**Impacto:** `dpsTomado`, `danoGolpe`, `piorMec`, `mortal`, `morre` e `tMorrer` estão ~33% pessimistas
para a Katarina. Decisões afetadas: `checarChefeFatal` (foge de luta ganhável),
`recomendar()` (região viável vira inviável), `iniciarTeste` (quando F-2 for corrigido) e
`rotacaoSkills` `automation.js:3104-3105`:
`chefeInvencivel = !!(el && (el.mortal || el.ganha === false))` → `usarUlt` em mobs, contra a regra
do dono ("NUNCA usar a ultimate em mobs").

**Fix:** `const receb = (META.champAtual?.papel?.recebido) ?? 1;` e multiplicar `dpsTomado`,
`danoGolpe` e `piorMec` por `receb` (em Runeterra, `recebidoArena`). Documentar no `return` de
`avaliar`.

**Nota de documentação:** `docs/lolidle-internals.md:113-114` atribui à Katarina o papel
`{ dano:1.37→1.425, recebido:0.66 }` — esses números são do **Zac** (`motor.js:892-893`); a Katarina
está em `motor.js:884-885` com `{ dano: 1.2, recebido: 0.75 }`. Quem for corrigir o código pela doc
vai usar o número errado.

---

## F-7 HIGH — `viajarPara()` não verifica nem repete nada

**Ficheiro:** `extension/automation.js:1339-1347`

```js
function viajarPara(id) {
  if (/runeterra/i.test(semAcento(String(id || '')))) { logEvent('runeterra', { bloqueado: id }); return; }
  press('m');
  setTimeout(() => {
    const b = document.querySelector(`#marcadores .marcador[data-local="${id}"]`);
    if (b) b.click();
    setTimeout(() => { const ir = document.querySelector(`#mapa-info [data-ir="${id}"]`); if (ir) ir.click(); }, 400);
  }, 700);
}
```

Dois `if` silenciosos (marcador e botão "ir"), sem retry, sem confirmação e sem `logIssue` quando o
clique não acontece. Timings fixos de 700 ms + 400 ms. Se o mapa não abrir (outra janela aberta,
`press('m')` engolido) ou o id não existir, a função termina "com sucesso" e o boneco fica onde estava.

**Impacto:** é o mecanismo mais provável do "parado na Fonte sem fazer nada". Os chamadores confiam
no sucesso: `supervisarBase` `3346-3347` (marca `marcarAtiva()` **antes** de viajar → o watchdog AFK
só re-tenta em 3 min), `checarChefeFatal` `1332`, `supervisarBase` `3335`, `passoTeste` `2235`
(que segue para a fase `mobs` mesmo sem ter viajado — medindo a região errada), `proximoGiro` `3017`,
`gui.js:962`.

**Fix:** `viajarPara` assíncrona que (1) confirma que o mapa abriu (`#marcadores`), (2) confirma o
marcador e o `[data-ir]`, (3) espera ~3 s e confere `readLocation()`, (4) repete até 3× e devolve
`{ok:false, motivo}` + `logIssue('viagem', ...)`. Os chamadores devem tratar o falho (não marcar
`marcarAtiva()` antes de viajar, e `passoTeste` não deve entrar em `mobs` sem confirmar a região).

---

## F-8 HIGH — `regiaoIdeal()` devolver `null` é um beco sem saída silencioso

**Ficheiro:** `extension/automation.js:3260-3269` e `3343-3344`

```js
function regiaoIdeal() {
  if (cfg.regionDefault) return cfg.regionDefault;
  ...
  const cand = (META.locais || []).filter((l) => !ehRuneterra(l)).map((l) => ({ l, e: estimarRegiao(l.id) })).filter((x) => x.e && !x.e.morte);
  ...
  return (doNivel[0] || cand[0])?.l.id || null;
}
// supervisarBase:
const reg = regiaoIdeal();
if (!reg) return;          // ← sem log, sem fallback, sem aviso
```

`cand` fica vazio se `META.locais` não chegou **ou** se `estimarRegiao` devolve `null` para todas
(isso acontece quando `META.monstros` está `null`: `statsMonstro` → `null` → `wsum === 0` →
`return null` em `automation.js:777`). Sem META, **a automação nunca sai da base e não registra nada**:
nem `logIssue`, nem `logEvent`. O `carregarMeta` só loga em `meta-erro` (`682`), e o
`import('https://lolidle.com/js/motor.js')` do `inject.js:125` pode simplesmente nunca resolver (rede,
CSP) sem erro nenhum.

**Impacto:** sintoma exato do dono ("personagem parado na Fonte sem fazer nada") e nenhuma pista na
GUI/Log. Também afeta `iniciarTeste` (`2149` usa `regiaoIdeal()` como default) e `gui.js:923`
(`iniciarGiro` sem lista).

**Fix:** `if (!reg) { logIssue('regiao-ideal', { motivo: 'sem META/estimativa', metaAt: META.at, erro: META.erro }); return; }`
com throttle (1×/min); e um fallback explícito para a última região conhecida (`cfg.kReg`/
`farm.cycles[0].regionId`) antes de desistir. Melhor ainda: `regiaoIdeal` devolver
`{ id, motivo }` para o chamador distinguir "sem dados" de "sem região".

---

## F-9 MED — Livelock na base: `res.ok` + `marcarAtiva()` dentro de `acaoBase()`

**Ficheiro:** `extension/automation.js:1543`/`1577` (dentro de `acaoBase`) e `3327-3337` (supervisor)

```js
// acaoBase:
if ((readLocation().text || '') !== 'Fonte') return { ok: false, motivo: 'nao esta na base' };   // 1539 — igualdade EXATA
...
baseLock = true;
marcarAtiva();                                                                                  // 1543 — reseta o watchdog
...
// supervisarBase:
if (naBase()) {                                                                                  // 3254 — regex /fonte/i
  if (motivo && !_baseBusy && Date.now() - _ultimaBase > 20000) {
    ...
    acaoBase().then((r) => { res = r; })...finally(() => {
      if (res && res.ok && cfg.enabled && !ocupado && !pausado && !baseLock) { const reg = regiaoIdeal(); if (reg) viajarPara(reg); }
      else logEvent('base', { farmar: 'NAO (base incompleta)', ... });
    });
    return;
  }
  ...
  if (Date.now() - ativaEm < (cfg.idleBaseMs || 180000)) return;                                  // 3342 — só sai daqui a 3 min
```

Se `acaoBase()` devolver `ok:false` (texto do HUD diferente de `'Fonte'` — as duas checagens usam
critérios diferentes — ou `baseLock`), então: (a) não viaja, (b) `marcarAtiva()` já zerou o relógio do
AFK, (c) o `motivo` persiste (ex.: "mochila cheia" com itens protegidos), (d) 20 s depois repete. O
boneco fica **na base para sempre** e o único rasto é `logEvent('base', {farmar:'NAO ...'})`.

**Fix:** (1) usar o MESMO teste de base (`naBase()`) nas duas pontas; (2) não chamar `marcarAtiva()`
quando a rotina não conclui — mover para o fim, condicionado a `res.ok`; (3) contador de falhas
consecutivas → após 2, viajar mesmo assim (a base é passagem, não destino).

---

## F-10 MED — A trava de 15 min de poção é gravada antes do recall dar certo

**Ficheiro:** `extension/automation.js:3298-3302`

```js
reporAte = Date.now() + 15 * 60000;   // trava: no MÁX 1 reposição a cada 15 min (evita loop/gasto)
logEvent('repor', { motivo: 'poção baixa', falta, atual: p });
if (naBase()) { acaoBase().catch(() => {}); return; }
press('b');
setTimeout(() => { try { if (naBase()) acaoBase().catch(() => {}); } catch {} }, esperaRecallMs());
```

O recall é um `setTimeout` de tiro único: se em `esperaRecallMs()` (`>= 9 s`, `1336`) o boneco não
estiver na base (recall cancelado por dano, `press('b')` engolido, morte), **nada acontece** — e a
trava de 15 min já está gravada. Resultado: 15 min farmando sem poção, sem nova tentativa.

**Fix:** gravar `reporAte` só **depois** de `acaoBase()` retornar `ok`, ou usar um deadline curto
(`reporAte = Date.now() + 60000`) enquanto o recall não se confirmar; e repetir o recall
(`setInterval`/contador) em vez de `setTimeout` único.

---

## F-11 MED — As regexes do `#log` não aceitam o formatador do jogo (`12.3k`)

**Ficheiro:** `extension/automation.js:481-482` vs `docs/game-src/cena.js:225` e `cena.js:1570`

```js
// automation.js
const g = entry.body.match(/(?:Loot|recebeu)[^:]*:\s*(\d[\d.]*)\s*de ouro/i);
const x = entry.body.match(/\+\s*(\d[\d.]*)\s*de experi/i);
```
```js
// cena.js:225
export const fmt = (n) => (n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e4 ? (n/1e3).toFixed(1)+'k' : Math.round(n).toString());
// cena.js:1570
this.log(t('Loot de {nome}: {ouro} de ouro{itens}. +{xp} de experiência.', ...), ...);
```

Verificação offline (replicando as regexes e o `fmt`):

```
"Loot de tropa corpo a corpo: 820 de ouro. +430 de experiência."      → g=820, x=430      ✅
"Loot de dragão ancião (filhote): 12.3k de ouro, ... +8400 de ..."    → g=null, x=8400    ❌ ouro e ABATE perdidos
"Enquanto você estava fora (2h), ... caçou: +9500 de experiência ..." → g=null, x=9500    ❌ XP offline entra no ciclo
```

Como `fase.kills += 1` só roda `if (g)` (`489`), uma linha de loot ≥ 10 000 deixa de contar **o
abate** (kills/min, gold/min e `mobHp × killsMin` do `meuDps()` ficam errados), mas o XP da mesma
linha entra. E a linha de caça offline (`jogo.js:6767`) casa na regex de XP e injeta XP no ciclo
atual, sem abate — inflando o xp/min medido. Nada disso é logado.

**Fix:** `(\d[\d.,]*\s*[kKmM]?)` + `parseBig()` nas duas regexes; exigir que a linha de XP venha
**depois** de "Loot de" (ou `/^Loot de/`), e ignorar explicitamente `/Enquanto você estava fora/`.
Adicionar `logIssue('log-parse', ...)` quando uma linha com "de ouro" não casar.

---

## F-12 MED — `valeComprar` compara texto de HUD com nome de zona (nunca casa)

**Ficheiro:** `extension/automation.js:2883-2884`

```js
const cyc = ag.find((x) => x.region === (melhor.zona && melhor.zona.nome)) || ag[0] || null;
const killsMin = (cyc && cyc.killsMin) || 10;
```

`ag[].region` é o texto do HUD (`"Fosso do Dragão nível 30–40"`), `melhor.zona.nome` é
`"Fosso do Dragão"` (`wiki-dados.js:54` guarda o objeto `z` do motor). A igualdade **nunca** é
verdadeira, então cai sempre em `ag[0]` (a região de maior ouro/min, possivelmente outra) e, se
`ag` estiver vazio, em `killsMin = 10` (hardcode). Todo o cálculo `tempoMin`/`custoFarm` que decide
"comprar vs farmar" (`2886-2889`) sai de números inventados. Note que o resto do ficheiro usa
`startsWith` exatamente para isso (`749`, `807`, `1227`).

**Fix:** `ag.find(x => melhor.zona && x.region.startsWith(melhor.zona.nome))` e, quando não houver
medição, devolver `{ ok: true, motivo: 'sem kills/min medido nesta zona' }` em vez de `10`.

---

## F-13 MED — DPS `null` silencioso em `previaSet`/`dpsItens` (o caso do `ll.mjs dps`)

**Ficheiro:** `extension/automation.js:2100-2128` (e `2954-2962` em `melhorSet`)

```js
function previaSet(ids, regiaoId, opt) {
  const L = (META.locais || []).find((x) => x.id === regiaoId);
  const alvos = {};
  try {
    if (L?.monstros?.[0]) { ... }
    if (L?.chefe) { ... }
  } catch { /* ignore */ }
  const est = (a) => { if (!a) return null; ... };
  return { mob: est(alvos.mob), chefe: est(alvos.chefe), regiao: regiaoId, itens: ids.slice() };
}
```

Com `regiaoId = 'fonte'` (ou `null`, ou `arena`/`aram`) o retorno é `{ mob: null, chefe: null,
regiao: 'fonte' }` **sem nenhuma indicação de que faltou região de caça** — foi isso que produziu o
`dps` nulo no CLI (`tools/ll.mjs:67`). O mesmo vale para `melhorSet` (`2959-2962`: `monstro = null`
→ `alvo = null` → o score teórico ignora armadura/HP do alvo).

**Fix:** devolver um campo de diagnóstico:
`{ mob: null, chefe: null, motivo: !L ? 'regiao desconhecida: ' + regiaoId : !L.monstros ? 'regiao sem monstros (base/Runeterra/Arena)' : null }`.
No CLI, aceitar `dps [regiaoId]` e, sem argumento, usar `cfg.regionDefault`/`regiaoIdeal()` em vez
da localização atual.

---

## F-14 MED — `ritmoMobs` usa o BASE da wave (2), não a média (3)

**Ficheiro:** `extension/automation.js:373-381`

```js
const perWave = (META.grupoSpawn && META.grupoSpawn.base) || aw.perWave || 3;   // mobs/wave vem do MOTOR (média 3)
const gapS = aw.medGapMs ? aw.medGapMs / 1000 : (aw.killsMin ? (perWave / aw.killsMin) * 60 : null);
const segPorWave = +(perWave * gapS).toFixed(1);
return { ..., seg3: +(segPorWave * 3).toFixed(1), ... };
```

`META.grupoSpawn = { base: 2, rand: 3 }` (`inject.js:138`) e a média real é
`base + floor((rand-1)/2) = 3` — a própria extensão calcula assim em `estimarRegiao`
(`automation.js:780`: `gs.base + Math.floor((gs.rand - 1) / 2)`). Aqui usa `base` = 2 e **descarta a
medição `aw.perWave`** (só usada se `grupoSpawn` faltar).

**Impacto:** `seg3` (o critério do `valeUlt`, `cfg.ultWaveSeg` = 12 s, `automation.js:387`) sai 33%
menor do que o real → `valeUlt()` falso com mais frequência → o sinal "chefe provavelmente invencível"
(`gui.js:561`, `recomendar().sinalUlt`) desaparece. É exatamente a métrica que o dono usa para a
ultimate nos mobs.

**Fix:** `const perWave = aw.perWave || (gs.base + Math.floor((gs.rand - 1) / 2));` (medido primeiro,
motor como fallback).

---

## F-15 MED — `salvarTestes` duplica a MESMA rodada a cada build testada

**Ficheiro:** `extension/automation.js:2293-2300` (chamado em `2274`, `2287`, `2213`, `2179`)

```js
function salvarTestes() {
  if (!teste) return;
  chrome.storage.local.get(TESTE_KEY, (r) => {
    const ant = r?.[TESTE_KEY]?.rodadas || [];
    const rodada = { at: teste.inicio, regiao: teste.regiao, mobSeg: teste.mobSeg, previa: ..., resultados: teste.resultados };
    testesSalvos = [rodada, ...testesSalvos].slice(0, 20);
    chrome.storage.local.set({ [TESTE_KEY]: { rodadas: [rodada, ...ant].slice(0, 20) } });
  });
}
```

`rodada.at = teste.inicio` é **fixo durante toda a rodada**, mas a função roda a cada variação
(`proxima()` → `salvarTestes()`, `2287`). Ou seja: N variações ⇒ N cópias da mesma rodada no storage
(`ll.mjs testes` mostra-as) e em `testesSalvos` (carregado uma única vez em `2025` e nunca relido do
storage). O `previsorHistorico` (`2043-2050`) percorre `testesSalvos` e conta cada medição N vezes:
`recentes(mobs, 8)` (`2052`) fica saturado com as cópias de uma só rodada, empurrando para fora as
outras builds, e `confianca.n` fica inflado.

**Fix:** upsert por `at`: substituir a rodada com o mesmo `at` em vez de inserir outra
(`rodadas = [rodada, ...ant.filter(x => x.at !== rodada.at)]`), e no fim da rodada (`!set`, `2213`)
gravar uma última vez. Reler `testesSalvos` do storage em `salvarTestes`.

---

## F-16 MED — `melhorSet` assume o Rabadon mesmo sem o item → re-equip a cada 20 s

**Ficheiro:** `extension/automation.js:2963-2964` e `2998-3002`

```js
const pool = (META.itens || []).filter((it) => String(it.id) === RABADON || itemDisponivel(String(it.id)));
const set = [RABADON];
```
```js
const atual = readEquip().map((e) => baseDe(e.id)).sort().join(',');
const alvo = set.itens.slice().sort().join(',');
if (atual === alvo) { ultimoCtxItens = ctx; return; }
itensBusy = true; itensAt = Date.now();
try { await aplicarItens(set.itens); ... }
```

`RABADON` entra no pool **por id**, sem `itemDisponivel()`. Se o dono não tiver Rabadon, o `alvo`
sempre contém `3089`; `aplicarItens` não consegue equipá-lo (`equiparItem` devolve
`{ok:false, motivo:'sem 3089 na mochila'}` em `1811` — ignorado) e `atual !== alvo` **para sempre** →
com `cfg.trocaItens` ligado, a cada 20 s (`2994`) a rotina desequipa/equipa 4 itens para nada, e o
boneco pode ficar com 4 itens em vez de 5.

**Fix:** `const temRab = itemDisponivel(RABADON); const pool = ... (temRab ? (it.id === RABADON || ...) : itemDisponivel(...)); const set = temRab ? [RABADON] : [];`
e logar `logIssue('itens', ...)` quando `aplicarItens` não conseguiu pôr um item do alvo.

---

## F-17 MED — HP máximo `4188` hardcoded como fallback do `player()`

**Ficheiro:** `extension/automation.js:840-845`

```js
const hp = (document.querySelector('#hud-vida-txt')?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
return { nivel, vida: hp ? +hp[2] : 4188, armadura: ..., rm: ..., dano: ..., poder: ... };
```

`4188` é o HP máximo medido do dono (nv 27, VIP) em `docs/lolidle-internals.md:118` — um número da
conta dele gravado no código. Se o `#hud-vida-txt` não casar (outro layout, `/^` com espaço,
HUD minimizado), toda a sobrevivência passa a usar 4188 em silêncio: `tMorrer = p.vida / liquido`
(`1154`), `temos >= precisa` em `checarChefeFatal` (`1320`) e `checarPocoes` (`3294`),
`hpMinPct` das lutas (`606`) e `c.healSkill` (`1290`).

**Fix:** devolver `vida: hp ? +hp[2] : null` e tratar `null` como "desconhecido" nos consumidores
(não decidir fuga/poção com HP inventado); alternativa: usar `#hud-vida` (`style.width: 98%`) × o
último máximo conhecido e marcar a estimativa como tal.

---

## F-18 MED — `bonusTwitch`/`bonusEvento` chegam do jogo e são descartados

**Ficheiro:** `extension/inject.js:156-157` vs `extension/automation.js:692`

```js
// inject.js
meta.bonusTwitch = M.bonusTwitchAtual ? M.bonusTwitchAtual() : null;
meta.bonusEvento = M.eventoXpAtual ? M.eventoXpAtual() : null;
```
```js
// automation.js:692 — a lista NÃO inclui bonusTwitch/bonusEvento
for (const k of ['pocoes','exaustao','pocaoPvp','noturno','furioso','gemas','recall','grupo','nivelMax','espacos','curva','kit','champ','rodizio','mecanicas','kits','mochila','ciclo','fuso','grupoSpawn','respawn','modelos','dicaAtributos','nivelDif','habChefe']) if (d[k] != null) META[k] = d[k];
```

A fórmula de XP/ouro do motor (`internals.md:262-263`) é
`xp = CURVA.xp(M) * m.xp * fatorXp * (vip?1.2:1) * bonus * bonusXp * bonusTwitch * bonusEvento` e
`ouro = CURVA.ouro(M) * m.ouro * (0.5+rand*0.5) * (1+bc.ouro+bm.ouro) * fatorSaque` (`motor.js:517-526`).
`estimarRegiao` (`773-774`) aplica só `vip` e `bonus` — ignora Twitch, evento, conquistas e mascote.
Parte do erro é absorvida pelo `calibrar()` (`kXp`/`kOuro` globais, `818`), mas o `kReg` por região
fica contaminado justamente quando o evento muda (o fator vira 1 só depois da recalibração manual).

**Fix:** incluir os dois campos na lista de `692` e multiplicá-los em `estimarRegiao`
(`xpK *= (META.bonusTwitch || 1) * (META.bonusEvento || 1)`), ou remover os campos do `inject.js`
para não dar a impressão de que são usados.

---

## F-19 LOW — `accumulate` engole a ausência de medição (dano/cura = 0)

**Ficheiro:** `extension/automation.js:1266-1273`

```js
let st = {};
try { st = JSON.parse(document.documentElement.dataset.lolidleAuto || '{}'); } catch { /* ignore */ }
const pot = readPotions();
if (farm.current) {
  const c = farm.current;
  const fase = ...;
  fase.dmg = (fase.dmg || 0) + (st.mydps || 0) * dt;
  fase.heal = (fase.heal || 0) + (st.heal || 0) * dt;
```

Se o `content.js` não estiver publicando (`dataset.lolidleAuto` ausente/stale), `st = {}` e a fase
acumula **zero** de dano e cura — sem nenhum sinal. `healSkillS` medido vira 0, o que em
`estimarLuta` (`3141-3143`) cai no fallback "metade da cura de mobs" e, pior, alimenta
`agregar().healSkillChefeS` como se fosse medição.

**Fix:** validar `st.at` (existe e `Date.now() - st.at < 2000`) e, quando faltar, **não** acumular a
fase: marcar `fase.semMedicao = true` + `logIssue('medicao', ...)` (com throttle) para que a luta
seja descartada em vez de virar "0 medido".

---

## F-20 LOW — Fallback da poção do chefe escrito na variável errada

**Ficheiro:** `extension/automation.js:1171-1174`

```js
let curaPocao = (r.hp / d) / 60;    // cura/s EFETIVA das poções (mobs)
const curaPocaoChefe = r.chpn ? r.chp / r.chpn : curaPocao;
if (!curaPocaoChefe) curaPocao = cp * 0.6; // região nova: estimativa conservadora   ← escreve na de MOBS
const risco = ... avaliar(r.boss, nivelChefe, pl, { skill: curaSkillChefe, pocao: curaPocaoChefe || cp * 0.6 }) ...
```

O `|| cp * 0.6` na linha 1174 salva o `avaliar` (o fallback é reaplicado), então a linha 1173 é
**código morto que corrompe outro campo**: `healPotionS` passa a ser `cp * 0.6` (ex.: 1320/s com a
Suprema) em vez do medido, e é o que `planejar` usa (`1228`: `reg.healPotionS || cp * 0.6`).

**Fix:** `if (!curaPocaoChefe) curaPocaoChefe = cp * 0.6;` (variável certa) e remover o `||` da
linha 1174.

---

## F-21 LOW — `proximoGiro` fica em loop infinito se o texto não for exatamente `'Fonte'`

**Ficheiro:** `extension/automation.js:3012-3021`

```js
function proximoGiro() {
  if (!giro || giro.i >= giro.lista.length) { ... giro = null; ... return; }
  if ((readLocation().text || '') !== 'Fonte') { press('b'); return setTimeout(proximoGiro, 9000); }
  ...
}
```

Mesma igualdade exata de `1539`. Num local que não seja a Fonte (ex.: cidade de Runeterra, onde
`press('b')` não faz recall), o giro re-agenda-se a cada 9 s **para sempre**, sem contador de
tentativas nem saída. `giro` é persistido no storage (`3010`), então sobrevive a reload.

**Fix:** `if (!naBase()) { press('b'); if (++giro.tentativas > 5) { logIssue('giro', { parado: giro.tentativas }); giro = null; salvarGiro(); return; } return setTimeout(proximoGiro, 9000); }`
e usar `naBase()` (regex) para consistência.

---

## F-22 LOW — Config morta e campos que nunca existem

- `automation.js:41` `ultEmMobs: false` — **nunca lido** (grep: só a definição). A regra real está em
  `3105` (`usarUlt = fase === 'chefe' || chefeInvencivel`), que pode usar a ultimate nos mobs quando
  `chefeInvencivel` for verdadeiro (e esse cálculo está enviesado por F-5/F-6). O comentário do
  default ("o dono pediu N vezes") não é o que o código faz.
- `automation.js:31` `keepEpicA: true` — **nunca lido** (a proteção de épico A+ está hardcoded em
  `isProtected`/`acimaDeA`, `191-201`).
- `automation.js:75` `return { text: t.trim(), tier: null, range: ... }` — `tier` é `null` literal e
  nenhum consumidor usa `loc.tier` (o `tier` que importa vem de `META.locais`).
- `automation.js:3167` `ouroPocao: ... * 110` — preço de poção hardcoded (os reais vêm de
  `META.pocoes`/`PRECO_POCAO`, `337`) e o campo não é consumido em nenhum lugar.
- `automation.js:3163/3165` `tKillRealS`/`potReal` — devolvidos e não consumidos (a GUI usa
  `tKillS`/`potTotal`).
- `automation.js:3044` `trocarSkills` + `3035` `skillsDisponiveis` — só alcançáveis pelo console
  (`window.__lolidleAuto`); `checarRotacao` (`3120`) usa `rotacaoSkills`/`aplicarBarra`. Duas
  implementações da mesma ideia (trocar skills da barra) convivendo.
- `automation.js:1403` `if (now - lastAt < 3000) return;` somado a `every(loop, 3000)` (`3411`) —
  throttle duplo: quando o timer dispara em 2999 ms o tick é perdido e o `loop` passa a rodar a cada
  ~6 s (afeta a latência de `checarChefeFatal`/`checarEquipMelhor`).
- `automation.js:648` `pontos = ... (Number(...) || 1)` — o `#hud-pontos-txt` do jogo mostra
  `"N de habilidade · N de atributo"` (`jogo.js:6529-6533`); com **só** pontos de atributo livres, o
  `match(/\d+/)` devolve o número de atributo e `subirHabilidades` roda à toa (`1354`), e
  `necessidadesBase().hab` (`1528`) fica verdadeiro sem haver o que subir.
- `gui.js:795` `Chama ~${fmt(Math.round((d.out||0)*0.066))}/s (est.)` — 6,6% hardcoded no painel
  (o valor real é ~1/3 da luta abaixo de 40% de HP, por isso o "est.").
- `automation.js:2003` `((String(rid).match(/~([A-Za-z]+)/) || [])[1] || 'B').toUpperCase()` — item sem
  sufixo de qualidade assume **B** (mult 1,0); e `Q[q] || 1` transforma qualidade desconhecida em
  1,0 (nem penaliza nem avisa).

---

## Não é bug, só esquisito (verificado contra o motor, mantido por decisão)

1. `MECANICA` (`automation.js:988-998`) duplica os multiplicadores inline do motor
   (`motor.js:3102-3109`: investida 3.5, pancada 2.2, olho 2.6, sopro 2.2, chuva 1.8, rugido AS×1.5,
   ácido 1.2, tentáculos 2.6) — **hoje estão todos corretos**; é risco de deriva, não erro.
2. `inject.js:133` duplica os coeficientes de `CURVA` (`hp [150,100,1]`, `ad [9,4.8,0.13]`,
   `armadura [5,1.5]`, `xp [30,7]`, `ouro [8,3.5]`) — idênticos a `motor.js:273-279`.
3. `inject.js:138-139` `grupoSpawn {base:2, rand:3}` e `respawn {clear:1.5, local:1.2}` — os valores
   do motor estão inline lá (comentário do próprio ficheiro), então a cópia é o único caminho.
4. `_giro` (`automation.js:886-888`) faz regex sobre o **texto-fonte** da função do motor
   (`motor.js:737`: `giro: (nivel, a) => 30 + 19*nivel + 1*apDe(a) + 0.4*Math.max(0, a.ad - a.baseAd)`)
   e cai em defaults (30/19/1/0.4) se o formato mudar — funciona hoje, sem aviso se quebrar.
5. `POCAO_FB` (`624`) e `KAT_FB` (`848-860`) duplicam dados do motor como fallback: mantêm a
   extensão "a funcionar" mesmo com o META quebrado — é o que esconde falhas (liga-se a F-8).
6. `estimarSet` (`1971-1996`) soma só o AP dos itens: ignora o AP base do campeão (nível/atributos)
   e o `papel.dano` (1.2 da Katarina, `motor.js:1212`). São fatores ~constantes para o mesmo
   campeão, então servem para *comparar* conjuntos — mas não são DPS real (e a GUI mostra-os como
   "DPS por item"). O próprio ficheiro já sabe disso (`2017`).
7. `reporPocoes` compra lotes fixos 3000/1500/700 (`1484`) e `minimoPocoes` escala com o ouro
   (`300-305`) — política do dono, não fórmula do jogo.
8. `planBag` marca `a.evicted = true` e reescreve `a.action` no fim (`282-295`) — o ramo
   `ANUNCIAR_MERCADO` da linha 292 é no-op (o valor é reatribuído a si mesmo); inofensivo.
9. `checarItens` só roda com `cfg.trocaItens` (default `false`, `35`) e `checarEquipMelhor` a cada
   60 s (`1918`) — a "oscilação" está contida por histerese de 5% (`1881`).
10. `readMap()` (`442-459`) e `localId` aceitam os dois traços (`[–-]`) — cobre o en dash do jogo.

---

## O que não consegui decidir sem correr o jogo

1. **Texto ao vivo do `#local-nome`.** Verifiquei o formato no fonte do jogo (`jogo.js:6489`) e a lista
   `LOCAIS` (`motor.js:355-378`), mas não posso garantir que a build servida hoje em
   `lolidle.com/jogar` seja idêntica a `docs/game-src/`. Se o nome do Dragão mudou, o `localId` cai
   para `null` (não para `fonte`).
2. **Se o META chega ao vivo.** Não sei se o `import('https://lolidle.com/js/motor.js')` do
   `inject.js:125` resolve na sessão do dono. Se não resolver, F-8 é o sintoma ativo ("parado na
   Fonte") — e o único rasto seria `META.erro`/`logIssue('meta-falha')`.
3. **Se o texto de loot alguma vez chega a `≥ 10 000`** na região atual (para o F-11 deixar de ser
   latente e passar a descartar abates ao vivo). Depende do nível/região/bônus do momento.
4. **O efeito líquido de F-5/F-6** (fJ + papel.recebido ausentes vs `meuDps` subestimado). O único
   ponto medido (`TODO.md:761-764`) tem a estimativa conservadora; um confronto estimado×real na
   região letal (Dragão) é o que fecha a conta.
5. **Se o `#hud-vida-txt` falha alguma vez** na conta do dono (para F-17 sair do teórico): bastava ver
   `player().vida === 4188` com HP diferente na barra.
6. **Quem realmente deixa o boneco parado na Fonte** entre F-7 (viagem sem confirmação), F-8
   (região nula) e F-9 (livelock do `res.ok`): os três terminam no mesmo sintoma e a diferença está
   no `farm.log` (`afk-farmar`, `base:{farmar:'NAO ...'}`, `viagem`/`regiao-ideal` ausentes).
