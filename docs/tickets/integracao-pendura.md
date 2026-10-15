# O PENDURA DO BANCO — causa isolada (2026-10-15 07:30)

## Experimento
Adicionei os 16 exports em falta ao `window.__lolidleAuto` (as funções já existem no ficheiro) e
corri o banco com **limite rígido** (`Start-Process` + `Kill` aos 80 s, a única medição fiável —
stdout por pipe é promovido a job e perde-se).

| Export adicionado | Resultado |
|---|---|
| 16 exports (todos) | **PENDURA** — 0 linhas em 80 s (nem a 1.ª suite imprime) |
| 14 "seguros" (sem `farmarItemPasso`, `recomendarAtributos`, `estimarRegiao`, `mediaWaveDe`) | **PENDURA igual** — 0 linhas em 80 s |

## Conclusão
O pendura **não** está nas funções que mexem em timers/recursão que eu suspeitava. Está nos
**exports do consumidor de eventos**: `consumirEvento` / `estadoVivo` / `eventosVivos` /
`eventosContadores` (do ramo **w3-barra**). Enquanto não estavam exportados, os handlers de
`estado`/`evento` do `carregarMeta` **rebentavam** (ReferenceError) e o banco seguia; agora que
existem, o consumidor **corre e entra em ciclo** no mundo do stub (o stub não tem o
`Cena.prototype.evento`/`sincronizar` reais que o inject.js envolve).

## Próximo passo exacto
1. Ler `consumirEvento` (w3-barra, ~46 linhas) e o handler `estado`/`evento` do `carregarMeta`.
2. Procurar o ciclo: provavelmente um `for/while` sobre `_eventosVivos`/`_eventosCont` ou uma
   re-emissão de evento que se realimenta (no jogo real o `inject.js` é quem emite; no stub nada
   emite — logo um ciclo aí é código a assumir que há sempre eventos novos).
3. Guardar com um tecto (ex.: `_eventosVivos.length = Math.min(200, ...)`) e voltar a exportar.
4. Medir SEMPRE com o limite rígido + ficheiro (`tools/_b.txt`), nunca por stdout.
