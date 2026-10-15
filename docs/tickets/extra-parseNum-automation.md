# EXTRA — parseNum do automation.js corrompe sufixos k/M (ouro/poções ≥ 10.000)
**Ficheiro**: extension/automation.js (parseNum, ~linha 201) — FORA do write-scope da fila W2 (não é um dos: planejar/buildIdeal/.../objetivoItem).
**Prioridade**: P1 (leitura errada EM SILÊNCIO).
**Evidencia (fonte lida, Regra Nº 1)**: `const parseNum = (s) => { const d = String(s ?? '').replace(/[^\d]/g, ''); return d ? Number(d) : NaN; };` — apaga o sufixo k/M do `fmt` do jogo (cena.js:225): "12.3k" -> 123. `readGold` (212-217) já trata M/k por regex, mas `readPotions` (linha ~226) e `parseDica` usam o `parseNum` cru.
**Regra a usar (já provada no content.js, commit 4cbd9c5)**: SUFIXO {k:1e3, m:1e6}; o sufixo entra nos GRUPOS da regex; grupo de 3 casas ("4.188") = MILHAR; com sufixo ("12.3k") = decimal. Inteiros: comportamento idêntico (sem regressão).
**Casos pedidos pelo Lead**: "12.3k"/"20.4k" -> {cur:12300, max:20400}; "9.876"/"12.3k" -> max 12300 (antes 123); "1.2M" -> 1200000.
**Aceitacao**: correcção em parseNum + testes dos casos acima; `bun tools/testes/run.mjs` rc=0.
**Nota**: quem toca em leituras de número do automation.js aplica esta regra ( Lead, 22:01 ). Quem atribuir a frente W2 não fecha sem isto.
