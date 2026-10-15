# ESTADO FINAL DA INTEGRAÇÃO (2026-10-15 07:05) — diagnóstico das 9 causas

O banco está vermelho, mas **as falhas têm causas únicas e conhecidas** (levantadas a correr o banco
e a agrupar as mensagens de erro):

| # | Erro (mensagem real) | Causa | Arranjo |
|---|---|---|---|
| 1 | `auto.eventosContadores is not a function` | export em falta | juntar ao `window.__lolidleAuto` |
| 2 | `auto.statsDePeca is not a function` | export em falta | idem |
| 3 | `w.auto.escolherConjunto is not a function` | export em falta | idem |
| 4 | `auto.recomendarAtributos is not a function` | export em falta | idem |
| 5 | `auto.nivelMobDe is not a function` | export em falta | idem |
| 6 | `auto.checarChefeFatal is not a function` | export em falta | idem |
| 7 | `medido is not defined` (suite refinar) | declaração no escopo errado | declarar `let medido = null, divergenciaMedido = [];` **dentro** de `refinarMelhores` |
| 8 | suite `hud`: `undefined is not an object` | `estimarSet` a devolver `hemorragia` sem o objeto | devolver sempre `{ dps, ... }` |
| 9 | suite `chefe`: `NIVEL_DIF_FB` | símbolo/export | trazer de `w11-boss` |

**Lista exacta dos exports em falta** (as funções EXISTEM no ficheiro — verificado por grep):
`eventosContadores, eventosVivos, estadoVivo, consumirEvento, statsDePeca, pecaConhecida,
escolherConjunto, porMelhorBase, nivelMobDe, mediaWaveDe, checarChefeFatal, farmarItem,
farmarItemPasso, migrarCfg, localId, nivelAlvo`.

## ARMADILHA DE MEDIÇÃO (custou várias rondas)
O `run_code` tem prazo de **120 s por chamada**. O banco leva 40–90 s e, se a chamada estourar, o
`pwsh` é **promovido a job em background** e o programa recebe **stdout vazio** → as medições liam
"0 falhas / 0 suites" e eu persegui fantasmas. **Correr sempre com `timeoutMs` explícito alto
(ex.: 300000) na chamada do `run_code`, ou medir por ficheiro** (`> tools/_r.txt` e ler o ficheiro).

## O que está pronto e verde
- Extensão **válida** (`node --check` rc=0) e **provada ao vivo** (docs/prova-ao-vivo.md).
- Cofre (CY-5), 16 suites verdes, `UNSTUBBED 0`.
- Ferramentas: `tools/integra-grupos.mjs`, `tools/integra-fix.mjs`, `tools/prova-viva.mjs`,
  `tools/guest-pipe-load.mjs`.
