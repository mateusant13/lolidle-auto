# TK-05 — O aviso “Tarefa pronta!” tem de ser acarretado (não só mostrado)

**Ficheiro:** `extension/automation.js` (o mesmo writer do TK-01 — anexado a esse worker para não haver dois escritores).
**Prioridade:** P1 (bug reportado ao vivo pelo dono em 2026-10-19, com screenshot).
**Origem:** screenshot do dono: `Tarefa pronta! Clique aqui para falar com o Capitão.` visível no jogo.

## Evidência (fonte)
- `docs/game-src/jogo.js:6774-6783` — `#rastreio-tarefa` fica visível quando há tarefa; recebe a classe
  `pronta` e o HTML “Tarefa pronta!” / “Clique aqui para falar com o Capitão.”.
- `docs/game-src/jogo.js:6407` — o clique no aviso só fala com o Capitão **se `M.naBase(estado)`**.
- `extension/automation.js:4169-4173` — `tarefaEstado()` já lê `hidden` e `.pronta`.
- `extension/automation.js:3818` — `n.tarefa = !!st.pronta || ...` já devia mandar o boneco à Fonte.
- `extension/automation.js:4227-4241` — `entregarTarefa()` só entrega se `naBase()` e abre o NPC.

## Acção
- `clicarTarefaPronta()`: se `#rastreio-tarefa` visível e `.pronta` e `naBase()` → `click()` no próprio
  aviso (o jogo abre o Capitão) e devolver `{ok:true, abriu:true}`; fora da base → `{ok:false, motivo:'fora da base'}`
  **sem clicar**, para o `n.tarefa` continuar a pagar a viagem.
- Ligar ao passo `tarefa` da base: primeiro tentar o aviso; se o diálogo abrir, entregar; senão seguir
  `entregarTarefa()` actual (não duplicar a lógica de NPC).
- Não clicar no aviso quando não está pronto (é um rastreador de progresso, não uma acção).
- Exportar para prova manual.

## Critérios de aceitação
1. Teste DOM: visível+pronta+na base → click no `#rastreio-tarefa`; visível+pronta+fora da base → **sem**
   click e `n.tarefa=true`; visível sem `pronta` → **sem** click; `hidden` → sem click.
2. `node tools/testes/run.mjs` rc 0; `node --check extension/automation.js`.
3. Prova ao vivo (Lead, depois do merge): com uma tarefa pronta, o aviso é clicado e a entrega acontece.
4. Commit no ramo do TK-01 (`fix(auto): ...`). Sem push.
