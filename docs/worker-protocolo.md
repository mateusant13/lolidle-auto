# PROTOCOLO DO WORKER — lê este ficheiro PRIMEIRO, antes do teu ticket

> Este ficheiro e o AGENTS.md são lidos por TODOS os workers, na MESMA ordem, antes do ticket.
> Não os leias pela metade, não os leias noutra ordem: o prefixo do pedido tem de ser idêntico em
> todos os workers (é assim que o cache do harness acerta e o dono não paga duas vezes pelo mesmo
> contexto). Só o ticket difere.

## 1. Quem manda e o que é "pronto"

- O dono fala pt-BR e o objectivo é um só: **extensão e autoplay do lolidle.com prontos e provados ao
  vivo, hoje**. Uma frente fecha quando o defeito está corrigido E provado — não quando o relatório
  sobre ele está escrito.
- O critério de "build ideal" **não é DPS**, é: **(sobrevive? , mata em quantos segundos? , quantas
  poções e isso custa quanto em ouro?)**.
- Conta a Katarina (nv29) via relay 9224. **O browser do Yasuo NUNCA é aberto.**

## 2. O que há no repo

- `extension/` — a extensão: `automation.js` (motor de decisão, ~6,6k linhas), `inject.js`
  (camada de observação, corre no mundo MAIN da página), `content.js` (ponte), `background.js`,
  `gui.js`.
- `docs/game-src/` — o código do jogo. **`motor.js` é a especificação viva.** O que o jogo FAZ está
  lá; o que a extensão acha está em `automation.js`. Quando divergem, a extensão está errada.
- `tools/` — simulações e relay: `sim-build.mjs`, `sim-troca.mjs`, `relay-eval.mjs`,
  `backtest.mjs`, `audit-math.mjs`, etc. Corre com `bun` (H:\bun\bin\bun.exe) ou `node`.
- `docs/` — auditorias e relatórios já escritos. São pistas, não fonte.

## 3. As regras do repo que queimam (o Completo está no AGENTS.md — lê-o já a seguir)

1. **REGRA 1** — Antes de afirmar como o jogo funciona, **abrir e ler** `motor.js`. Número que existe
   no jogo é **lido, nunca copiado à mão** (REGRA 3): se o jogo nerfar amanhã, o código acompanha
   sozinho.
2. **REGRA 2** — Está no `motor.js`? **Modela.** É escolha do dono (preço, destino de lendário,
   política de automação)? **Pergunta — uma vez, em lote, no fim do relatório.**
3. **REGRA 5** — Um ficheiro, um escritor. O teu write scope é o que o ticket diz. Ficheiro fora do
   escopo = ticket novo, não edição.
4. **REGRA 6** — Verde não é prova. Corre os testes que existem; se um teste codificar o comportamento
   **antigo**, actualiza-o à regra nova **e diz qual mudaste**.
5. **REGRA 7** — Encontraste defeito no caminho e está no teu escopo? **Arruma-o.** Fora do escopo?
   Ticket novo em `docs/tickets/extra-<TICKET-ID>.md`.

## 4. Armadilhas do ambiente (todas já morderam alguém)

- O instalador da extensão é **idempotente por caminho**: devolve `ok` sem recarregar. Prova ao vivo
  = `chrome.runtime.sendMessage({type:'lolidle:reload'})` + reload + **MARCADOR discriminante**.
- **CDP 9224/9233 é UMA lane serializada. Os workers NÃO tocam no browser.** Só o Lead prova ao vivo.
- O motor do jogo vive no **mundo isolado** da extensão; `relay-eval.mjs` lê o DOM.
- Números do jogo com `k`/`M` passam por `fmt()`: um `parseNum` que não lida com sufixos corrompe
  leituras em silêncio.
- A GUI só desenha a aba activa: clicar na aba antes de verificar.

## 5. Worktree (obrigatório)

```pwsh
cd I:\!lolidle.com
git worktree add I:/wt/<TICKET-ID> -b <TICKET-ID>
cd I:/wt/<TICKET-ID>
```

- Trabalhas **só** dentro do worktree. Não faças checkout, merge, rebase ou `git add` no main.
- Quando terminares: `git add -A; git commit -m "<TICKET-ID>: <uma linha do que fizeste>"`.
- O Lead mergeia ramo a ramo. Tu **não** fazes merge.

## 6. Relatório final (formato fixo, nada de história)

```
TK: <id>
FICHEIROS: <lista exacta dos que tocaste>
TESTES: <comando + rc + o que provou>
MUDEI O TESTE: <qual e porquê, ou "nenhum">
COMMIT: <hash>
RISCO: <o que pode ter partido e não testaste>
REGRA DO DONO: <só política; senão "nada">
```

Se não conseguiste fazer algo, **diz** — com o diagnóstico exacto. Relatar um bug próprio vale mais
que o resultado da tarefa (REGRA 6).
