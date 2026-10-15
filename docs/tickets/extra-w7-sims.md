# EXTRA — fila W7 (w7-sims): o que ficou FORA do meu write scope

Write scope da W7 (fila-W7.md, "frontal, não negociável"): **só tools/**. NADA em extension/.
Estes tickets nasceram do trabalho em tools/ e precisam de um worker de extension/ (W2/W5/W6).
Cada um traz evidência com file:linha e o critério de aceitação. **Sem evidência não há ticket.**

---

## TK-W7-EX1 | P1 | `curaGiroDe()` calcula a cura do giro da Katarina com o rank ERRADO (usa rank 1)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: `automation.js:1547` — `const cg = typeof D_.curaGiro === 'function' ? D_.curaGiro(1) : null;`
  O `1` é um **rank inventado**: o kit da Katarina nv29 tem a passiva D no **rank 5**, não no 1
  (motor.js:768 `curaGiro: serie(0.08, 0.01)` → rank 5 = 0,12).
  Prova: `motor.js:1061` (`pontos = nivel - soma(ranks)`) dá soma = 29 no nv29; o arsenal MEDIDO
  (docs/snapshots/skills.json) tem 24 ranks (Q10+W1+E3+R3+G1+A5+F1) e `pontos: 0` → D = 29-24 = **5**.
  Confirmado pela cura medida: docs/snapshots/katarina.json tem `{t: heal, v: 279}` contra um giro
  que bate 1640; `motor.js:2192` dá `cura = curaBase 0,05 + curaGiro[rank-1]` →
  **rank 5: 0,17 × 1640 = 278,8 (-0,07%)**; rank 4 daria 262,4 (-5,9%); rank 1 daria 0,13 × 1640 = 213 (-24%).
  Efeito medido pela simulação (tools/sim-timeline.mjs §7, commit w7-sims 6e2a11c): com D = 5 as
  poções caem para metade em 2 dos 3 chefes (Arauto 4→2, Dragão 8→4) e a vida mínima dobra
  (Barão 148→383).
- **Fazer**: usar o rank MEDIDO da passiva (deduzido como acima, ou lido do jogo quando o
  `serialKit` do inject.js passar a reencaminhar os ranks das passivas) em vez do `1` fixo.
  Mudar também a nota da `automation.js:1529-1532` (a LACUNA do inject já está parcialmente
  resolvida: `curaGiro` está na lista do serialKit, audit-game.mjs:260).
- **Aceitacao**: `curaGiroDe()` devolve 0,17 (e não 0,13) na Katarina nv29; teste no banco com
  esses três casos (279±5% reproduzido).
- **Prioridade**: P1 (número falsa).

---

## TK-W7-EX2 | P1 | `parseNum` (automation.js:201) apaga o sufixo k/M do jogo — ouro e poções lidos errados EM SILÊNCIO
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: `automation.js:201` — `const parseNum = (s) => { const d = String(s ?? '').replace(/[^\d]/g, ''); return d ? Number(d) : NaN; };`
  O jogo formata números com sufixo (`fmt()`, cena.js:225): "12.3k", "1.2M", "20.4k".
  `replace(/[^\d]/g,'')` apaga o `k`/`M` **e o ponto**, e "12.3k" vira **123**.
  `readGold()` (automation.js:212-217) já tem um remendo para M/k, mas `readPotions()`
  (automation.js:226) e `parseDica()` usam o `parseNum` cru → poções e dicas corrompidas acima de 10 000.
  Achado do Lead (22:01) e confirmado no código.
- **Fazer**: aplicar a mesma regra já provada no content.js: sufixo `{k:1e3, m:1e6}`; o sufixo tem de
  entrar nos GRUPOS da regex; grupo de 3 casas ("4.188") = MILHAR, com sufixo ("12.3k") = decimal.
  Com inteiros o comportamento é idêntico (sem regressão).
- **Aceitacao**: os casos do Lead passam — "12.3k / 20.4k" → {cur:12300, max:20400};
  "9.876 / 12.3k" → max 12300 (antes 123); "1.2M" → 1200000; "3.000/4.188" continua a dar a Normal.
- **Prioridade**: P0 (leitura errada em silêncio manda decisões de compra/venda).

---

## TK-W7-EX3 | P2 | Ciclos de farm: cap 30, fecho só por mudança de região, taxa truncada sem marcador
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1486 — *"30/30 cycles carry incompleto:true / fim:viagem (cycles close
  on region change, not naturally -> rates may be truncated), 16 cycles are under 30s"*; L1565: cap 30.
  A parte de **tools/** deste ticket JÁ ESTÁ FEITA (w7-sims 6a3b4bd): o backtest exclui do ranking
  os ciclos com <30 s por omissão (`--incluir-curtos` traz-os de volta) e avisa quantos ficaram de
  fora; com isso o IC95 do Fosso do Dragão fecha de [3498,6..4097,5] para [3769,1..3974,1].
  Falta a parte da extensão: o **cap 30** (a amostra deixa de acumular sozinha) e o ciclo só fechar
  por mudança de região (nunca por tempo ou slot cheio), pelo que a taxa sai truncada sem marcador.
- **Fazer**: arquivar os ciclos em ficheiro quando bater o cap (em vez de parar de acumular), fechar
  o ciclo também por tempo/slot cheio e marcar explicitamente a taxa truncada (`incompleto:true`).
- **Aceitacao**: snapshot novo mostra taxa com marcador de truncada quando fim=viagem; a amostra
  continua a crescer além dos 30 ciclos.
- **Prioridade**: P2.

---

## TK-W7-EX4 | P2 | Persistir a assinatura da build por ciclo — sem isso a comparação entre builds nunca acumula amostra
- **Ficheiro(s)**: extension/automation.js (é a TK-02-23 citada dentro da TK-02-08)
- **Evidencia**: `docs/snapshots/katarina.json` — 30 ciclos, **1 assinatura de build distinta**
  (`builds: 1 assinatura distinta`, parte-02.md:1180-1183). O backtest (tools/backtest.mjs,
  w7-sims 6a3b4bd) já agrupa e já imprime ouro/xp/min com IC95 e n por build — mas com 1 build na
  amostra não há nada para comparar. Nos 50 lutas há 7 assinaturas distintas; nos ciclos, 1.
- **Fazer**: gravar a build (itens equipados + atributos) em CADI ciclo de farm, para que a troca de
  build passe a acumular amostra sozinha. O backtest já sabe ler `setup.equip` (backtest-lib.mjs).
- **Aceitacao**: depois de trocar de build e farmar, `node tools/backtest.mjs` passa a mostrar ≥ 2
  assinaturas, cada uma com ouro/xp por minuto, IC95 e n.
- **Prioridade**: P2 (é o que faz o backtest responder à pergunta do dono).

---

## TK-W7-EX5 | P2 | A extensão re-estima ouro/xp/abates em vez de ler a análise que o jogo já publica
- **Ficheiro(s)**: extension/automation.js, extension/gui.js
- **Evidencia**: AGENTS.md REGRA Nº 7 — o jogo **já mede** ouro/h, xp/h, abates/h, DPS do último
  minuto e loot por raridade: `jogo.js:523` (`analise`), `525-537` (`contarAnalise`), `538-542`
  (`contasAnalise`), render em `#janela-analise` (`546-560`) e **`#rastreio-analise` sempre visível**
  (`6250-6255`). A extensão re-estima em `automation.js:1195-1204` (`kXp`/`kOuro`) e não lê nenhum
  dos dois.
- **Fazer**: ler `#janela-analise`/`#rastreio-analise` (ou a função `analise`) como fonte primária e
  usar `kXp`/`kOuro` só como fallback; mostrar na GUI o número do jogo, não o estimado.
- **Aceitacao**: número igual ao do `#rastreio-analise` ao vivo, provado por marcador discriminante;
  `bun tools/testes/run.mjs` rc=0.
- **Prioridade**: P2. **Nota**: a parte de tools/ já está pronta (o backtest agora imprime as taxas
  por ciclo com IC95 e n) — o que falta é a GUI usar o número do jogo.
- **REGRA DO DONO**: nada. É defeito de implementação, não política.

---

## DECISÕES DO DONO pendentes nesta fila
- **Nada.** Nenhum dos 10 tickets da W7 depende de escolha do dono. (A correcção D-01/D-09 do
  Lead — lendário nunca ao Lojista, repetido ao Mercado, sem lugar guardar na mochila — não
  intersecta esta fila: os tickets da W7 são simuladores, snapshots e banco de testes.)

---

## O que a W7 fechou sozinha (para não haver trabalho duplicado)
| ticket | estado | onde está a prova |
|---|---|---|
| TK-X3 | **feito, com o rank CORRIGIDO para 5** | tools/sim-timeline.mjs (RANKS_MEDIDOS.D=5) + tools/testes/regras-motor.test.mjs (cura 278,8 vs 279 medidos, -0,07%) |
| TK-X1 | **fechado: extensão certa** | motor.js:1811 (só Q/W/E) + motor.js:1875 (reset do DARIOS); prova em tools/testes/regras-motor.test.mjs |
| TK-02-44 | **feito** | tools/motor-vivo.mjs (tudo LIDO do motor) + tools/testes/motor-tabelas.test.mjs (54 asserções) |
| TK-02-08 (a) | **feito** | tools/backtest.mjs (default = katarina.json, o dado fresco) |
| TK-02-08 (b) | parcial — depende de TK-W7-EX4 | este ficheiro |
| TK-01-28 | **feito em tools/** | tools/snap-export.mjs (deaths[]) + tools/backtest.mjs (analise.outDps) |
| TK-01-29 | **feito** | tools/ler-snapshot.mjs + auto-normalização no backtest (fica .bak-legacy) |
| TK-01-49 | **feito** | tools/ler-snapshot.mjs + tools/snap-export.mjs (relatorio em _export.json) |
| TK-01-43 | **feito em tools/** | tools/backtest.mjs (<30 s fora do ranking; --incluir-curtos) |
| TK-02-42 | **já estava corrigido** | tools/testes/objetivo.test.mjs:35-52 (regra nova, "ACTUALIZADO 2026-10-14") |
| TK-02-14 | fora do escopo | TK-W7-EX5 |
