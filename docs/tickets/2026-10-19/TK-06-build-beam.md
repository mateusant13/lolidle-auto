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
