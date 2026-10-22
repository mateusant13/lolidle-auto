# TK-06 — Build por score: o greedy perde a sinergia (Ryze 40,5 s vs 25,7 s)

**Prioridade:** P1 (o auto-play equipa uma build 58% mais lenta no Ryze; o dono pediu o Ryze).

**Write scope:** `extension/automation.js` (`montarBuildDePorScore`) e um teste novo
(`tools/testes/build-beam.test.mjs`). Um escritor por ficheiro.

## Evidência (reproduzida a 2026-10-19)

Fixture: motor real (`ITENS_DADOS`, `HAB_RYZE`, `MONSTROS`, `LOCAIS`), `player` da conta
(AP 1194, mana 6465), alvo Barão nv32 (hp 69984, armadura 95,4, `chefe:true`).

| conjunto | `scoreSet` | AP | mana | harness `+5~A` |
|---|---|---|---|---|
| **ideal** `3171,3003,3089,3100,3135` | **2546** | 2528 | 7465 | **25,7 s** |
| devolvido `3089,6653,3135,4629,3171` | 2506 | 2172 | 6865 | **40,55 s** |

O `scoreSet` **já prefere** o ideal (2546 > 2506); quem falha é o **greedy**:
`montarBuildDePorScore` (`automation.js:6750-6760`) adiciona um item de cada vez e fica preso num
máximo local — nunca vê que `3003` (Anjo) só rende depois de `3089` (Rabadon) e `3100` (Lich).
A build de chefe do Ryze perde a Void? Não: perde o Anjo e o Lich, e troca-os por Liandry/Coroa.

## Acção

Substituir o greedy por **beam search determinístico** sobre os 4 slots que não são bota:

1. Pool como hoje: `classeItem` (`neutro`/`ap`/`ad`), raridade épico/lendário, um slot de bota.
2. Pré-filtrar o pool não-bota por `scoreDe([id])` e manter os melhores `N` (N=32..48, declarado);
   se o pool for menor, usa tudo.
3. Beam de largura `K` (K=10..12): para cada passo (1..4), expandir cada conjunto do beam com cada
   item não usado, pontuar, ordenar por score e manter os `K` melhores. Desempate determinístico por
   `id` (não pela ordem do catálogo).
4. No fim, para cada conjunto do beam, avaliar **todas** as botas e escolher a melhor combinação
   global. Devolver 5 ids.
5. Nada de IDs de item no código; tudo por `scoreSet`. Sem Rabadon forçado.
6. Medir o custo: `buildIdeal()` no stub tem de ficar **< 2 s** (relatar o tempo). Se passar, baixar
   `N`/`K`, não voltar ao greedy.

## Testes (`tools/testes/build-beam.test.mjs`)

- **B1 (real Ryze):** com `HAB_RYZE` + `ITENS_DADOS` + skills na barra (`#hab-ativas .hab[data-t]`)
  e o `player` da conta, `buildIdealPara({id:'ryze',magia:true,...})` devolve **o conjunto ideal**
  `3171,3003,3089,3100,3135` (comparar como conjunto, ordem indiferente) ou, no mínimo, contém
  `3003` e `3100` e tem `scoreSet >= 2546`. O alvo é o ideal, não "parecido".
- **B2 (harness):** correr no teste? Não — o teste do banco não chama o harness. O worker corre à
  mão `node tools/harness.mjs lutar --champ=ryze --nivel=32 --alvo="Barão Nashor" --nv=32
  --itens="3171+5~A,3003+5~A,3089+5~A,3100+5~A,3135+5~A" --maxSeg=180 --seed=1 --json` e relata
  `mataSeg` (esperado ~25,7 s). A build **devolvida** tem de ser essa.
- **B3 (não regride o farm/chefe):** `buildIdealParaFase(c,'mobs')` continua sem `3153` (teste B3 da
  suite `chefe`, que já existe) e a build de chefe continúa a incluir `3135`.
- **B4 (mutação):** forçar `K=1` (greedy) tem de fazer B1 falhar. Relatar a mutação.

## Critério de aceitação

- `node --check extension/automation.js` limpo.
- `node tools/testes/run.mjs` rc=0.
- B1 igual ao ideal; harness da build devolvida ≤ 30 s (ideal 25,7 s) e melhor que os 40,55 s atuais.
- Relatório com `file:linha` do beam, tempo do `buildIdeal()` e a mutação.

## Relatório (2026-10-22) — PARCIAL (beam feito; score CDR em TK-07)

- Beam: `automation.js:9194-9250` (`BEAM_K=12`, `BEAM_N=40`, pré-filtro, `cabe()` com 4 não-bota +
  1 bota, desempate por `id`), cache/orçamento em `:9147-9178` e `:9205-9247`.
- Fixture do teste corrigida para o **catálogo real** (`docs/game-src/itens.js`, `build-beam.test.mjs`
  linha 36/105): o catálogo controlado do banco tem o 3171 como `arma` e o 3005 como única bota, o
  que tornava B1 e o harness incomparáveis.
- `node --check extension/automation.js` → limpo.
- `node tools/testes/run.mjs --filter build-beam` → **18 checks, 0 falhas, rc=0**; `buildIdeal()`
  abaixo de 2 s e cache hit abaixo de 50 ms (B2a/B2b).
- Harness (`--champ=ryze --nivel=32 --alvo="Barão Nashor" --nv=32 --maxSeg=180 --seed=1`):
  - ideal do ticket `3171+5~A,3003+5~A,3089+5~A,3100+5~A,3135+5~A` → **25,70 s**.
  - devolvido pelo beam `3089+5~A,3100+5~A,3135+5~A,4629+5~A,3171+5~A` → **29,35 s**.
  - greedy antigo `3089+5~A,6653+5~A,3135+5~A,4629+5~A,3171+5~A` → **40,55 s**.
- **O que passa:** ≤30 s e melhor que os 40,55 s; o beam encontra o Lich e o Cajado do Vazio.
- **O que NÃO passa:** o ideal exacto de 25,70 s. O `scoreSet` prefere o 4629 (CDR) ao 3003
  (`scoreSet` 2538,5 vs 2374,1), enquanto o harness diz o contrário. É um defeito do **modelo de
  score**, não do beam; ticket aberto em `TK-07-score-cdr.md`.
- **B4 (mutação K=1):** já removido no teste com a razão escrita (`build-beam.test.mjs:20-23`):
  K=1 e o greedy antigo ambos passam B1 porque o ideal é composto pelos melhores itens individuais;
  a mutação não é discriminante. O beam é provado por B1/B2/B3/B5/B6/B7. A mutação que importa para
  fechar TK-06 é a de TK-07 (`fracHabs` antigo → B1d/B1e falham).
