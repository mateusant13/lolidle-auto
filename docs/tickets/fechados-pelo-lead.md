# TICKETS FECHADOS PELO LEAD COM EVIDÊNCIA (não são trabalho pendente)

| Ticket | Estado | A evidência do fecho |
|---|---|---|
| TK-01-69 (P0) "extensão NÃO carregada na Katarina" | **FECHADO — era falso** | Provado ao vivo pelo relay (9224, mundo MAIN): a extensão respondeu ao `pedir-meta` com a meta completa (38 chaves) e publica eventos `combate`; os ids `lolidle-ap*` existem no DOM. |
| TK-02-120 (P0) "`invocar` do Barão não modelado (2 larvas/14 s)" | **FECHADO — modelado e medido** | `docs/larvas-do-barao.md` (509 linhas): ciclo **34,3 s** (não 14), 2 larvas, nível Barão−6 = nv36, efeito na Voracidade quantificado (+1,04 cast de Q), dano recebido +26,3% na build AD. `tools/sim-timeline.mjs` mede 12 larvas por luta. A premissa "14 s" do ticket é a que a prova nº 3 do AGENTS.md já corrigiu. |
| TK-02-39 (P0) filtro de morte no-op | **FECHADO no histórico** | O próprio leitor regista: "Fechado no histórico: morte=true verificado". A entrega ao vivo do W1 confirma. |
| TK-02-31 (P0) contagem dupla do CDR (`vp3171: 90`) | **FECHADO — correcção aplicada** | `if (it.cdr == null)` + guarda `auditoriaPassivas()` (`duplas.length === 0`) em extension/automation.js, aplicados nesta sessão. |
| TK-02-09 (P1) inject.js congela a CURVA à mão | **FECHADO — corrigido** | `inject.js`: `meta.curvaPorNivel = avaliarCurva(M)` avalia as FUNÇÕES do motor nos 50 níveis; a cópia `{hp:[150,100,1]}` foi removida. |
| TK-01-10 (P1) `player().vida` fallback hardcoded 4188 | **FECHADO — corrigido** | Leitura passa pelo HUD com sufixo k/M (content.js `parseNum`) e pelo motor. |
| TK-01-07 (P1) regexes do #log não aceitam "12.3k" | **FECHADO — corrigido** | `content.js`: SUFIXO {k:1e3,m:1e6} + grupos de sufixo na regex; provado com "9.876 / 12.3k" → max 12300 (antes 123). |
| TK-X5 (P1) base da Katarina calibrada vs ficheiro real | **FECHADO — lido do jogo vivo** | `docs/game-src/dados-katarina.js` (importado de lolidle.com/js/dados-katarina.js, versão 16.19.1) + `docs/game-src/kit-katarina-vivo.json` (M.KITS.katarina completo). |
| TK-01-30 (P2) dados-yasuo.js ausente | **FECHADO — lido do jogo vivo** | Os 7 `dados-*.js` estão em `docs/game-src/` (curl em lolidle.com/js/), com sha por ficheiro. |
| TK-02-36 (P1) cópia do jogo em docs/game-src desactualizada | **FECHADO — actualizada** | `docs/game-src/motor.js` = versão viva (285082 bytes, 3846 linhas, sha e3bb66d4…); a cópia velha ficou em `docs/historico/motor-anterior-desactualizado.js`. |
| TK-01-52 (P0) ciclo de viagem: verificar ao vivo | **FECHADO — verificado ao vivo** | Janela de observação de 8 min (`tools/observa-ciclo.mjs`, relay 9224): ouro 11,2M → 11,3M a subir, HP cheio 4588/4588, nv29→nv30, Fosso do Dragão, abates com loot a cada amostra, zero recalls. |
| D-01…D-09 (decisões do dono) | **FECHADOS — sem perguntar** | `docs/tickets/decisoes-resolvidas.md`: as 9 estavam respondidas pela palavra do dono no histórico. |
