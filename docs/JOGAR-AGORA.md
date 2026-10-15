# JOGAR AGORA — 3 passos (2026-10-15)

O jogo está **logado** no teu Chrome e a **aba é uma só** (limpei as minhas).
O auto-play está **configurado**: `enabled: true`, região **Rota Superior** (a melhor onde sobrevives:
score 9729 contra 4925 da Rota Inferior, escolhida pelo `rankRegioes` filtrado por `sobrevive`).

## Falta 1 coisa: a extensão está DESLIGADA pelo Chrome
No teu perfil:
```
extensions.settings.pbdlekcgmpippamdkgbaphcppjafobjo:
  path = I:\!lolidle.com\extension
  disable_reasons = [16777216]     <-- DISABLE_NOT_VERIFIED
```
No Chrome 137+ **extensões desempacotadas são desactivadas quando o Modo de programador está desligado**.
Sem ela, o jogo fica sem painel e sem auto-play.

### Os 3 passos (2 cliques + F5)
1. Abre `chrome://extensions`
2. Liga o **Modo de programador** (canto **superior direito**)
3. Liga o interruptor da **"LoL Idle — Auto Poção"** e faz **F5** no jogo

O painel **⚙ Auto-play** aparece no canto e ele vai à Fonte, repõe-se e viaja para a **Rota Superior**.

## E o travamento: desliga a aceleração de hardware
`chrome://settings/system` -> **desligar "Usar aceleração de hardware"** -> reiniciar o Chrome.

**Prova de que é o GPU**: no teu Chrome, com
`--disable-gpu --disable-gpu-compositing`, **10/10 sondas respondem durante 25 s** (não trava).
Sem as flags, bloqueia a t~4-9 s (8 medições). O jogo faz `getImageData` (readback de canvas) e o teu
processo GPU tem 10 h com ~15 abas de vídeo: o readback espera para sempre (0% CPU, sem crash,
e o `Debugger.pause` não consegue pausar - o bloqueio está ABAIXO do motor de JS).

## Porque é que eu não faço esses cliques
- o relay **não injecta em páginas `chrome://`** (tentei: `attach: FALHOU`) - e é lá que está o interruptor;
- o teu Chrome **não tem porta de debug** (abriste-o tu), logo não consigo chamar `Extensions.loadUnpacked`
  (foi assim que a carreguei antes, quando **eu** arranquei o Chrome com a porta);
- **não volto a reiniciar o teu Chrome** - pediste-me isso e é ordem.

## Estado do projecto (tudo verificado)
| | |
|---|---|
| **Banco** | **0 falhas · 25/25 suites verdes · UNSTBED 0** (commit `7c9a4a0`) |
| **Extensão** | válida e íntegra; `node --check` = 0; árvore limpa; remoto sincronizado |
| **O teu critério** | `sobrevivenciaSet` (`vida, tMorrer, morre, dps, tKill, nPocoes, ouroPocao`) + `rankItensSobrevivencia` - **F1-F9 e G1-G7 passam** |
| **Travamento** | causa-raiz provada: **GPU** |
| **Extensão sem jogar** | causa-raiz: **desactivada pelo Chrome** (`disable_reasons=16777216`) |

Detalhe completo em [travamento-causa-raiz.md](travamento-causa-raiz.md) e [integracao-banco.md](tickets/integracao-banco.md).