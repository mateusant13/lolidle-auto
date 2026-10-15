# TK-PARSE-EXTRA | P0 | parseNum e parseBig: dois parsers de numero do ecra, ambos incompletos

> Ticket NOVO criado pelo worker W9 (2026-10-14) — defeito encontrado no caminho (Regra Nº 7) mas **fora do write scope** da fila W9 ("Só podes mexer em: scoreSet, multClasse, multEsp, PESO_FASE, tierDe, CAMPOS_MULT, ITENS_, mit/mitigar, pen, wrapper de infoItem, nome do item"). Não foi tocado: fica com o dono certo.

> Achado do escritor do `content.js`, comunicado pelo Lead (22:01) e verificado aqui no `automation.js`.

## Evidencia (automation.js, estado actual)
- `extension/automation.js:201`: `const parseNum = (s) => { const d = String(s ?? '').replace(/[^\d]/g, ''); return d ? Number(d) : NaN; };` — **apaga o sufixo k/M e o separador decimal**: `"12.3k"` -> `"123"` -> 123 (devia ser 12300); `"1.2M"` -> `"12"` -> 12 (devia ser 1200000).
- `extension/automation.js:610`: `const parseBig = (s) => ... match(/([\d.]+)\s*([kKmM]?)/) ...` — **trata o ponto como decimal sempre**: `"5.625"` (cinco mil seiscentos e vinte e cinco, o preco do Lojista no ecra do dono) -> 5.625 -> arredonda para 6.
- Usos de `parseNum`: `readPotions` (:226), quantidade de espolio (:265), **preco do Lojista** (:276), **ouro/xp por abate lidos do log** (:770, :774, :775). O `readGold` (:216) escapa por ter o teste de k/M antes, mas os outros nao.
- Usos de `parseBig`: precos do mercado (:2920, :2921, :3700, :3716, :3750, :4799).
- Regra ja PROVADA no `content.js` (palavra do Lead): `SUFIXO {k:1e3, m:1e6}`; o sufixo tem de entrar nos GRUPOS da regex; grupo de 3 casas (`"4.188"`) = MILHAR, com sufixo (`"12.3k"`) = decimal. Com inteiros o comportamento e identico (sem regressao).

## Fazer
Substituir `parseNum` e `parseBig` por UM parser so (ex.: `numEcra`), com:
1. regex com o sufixo num grupo: `/^([\d.,]+)\s*([kKmM]?)$/`;
2. `if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');` (milhar) `else s = s.replace(',', '.');` (decimal);
3. `if (/k/i.test(suf)) v *= 1e3; if (/M/i.test(suf)) v *= 1e6;`.
Casos de prova (do Lead): `"12.3k / 20.4k"` -> `{cur:12300, max:20400}`; `"9.876 / 12.3k"` -> max 12300 (antes 123); `"1.2M"` -> 1200000.

## Aceitacao
Teste com os tres casos + o caso do dono `"5.625"` -> 5625; `bun tools/testes/run.mjs` rc=0. **Ficheiro: leitura de numeros — fora do write scope da fila W9.**
