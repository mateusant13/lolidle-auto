# PROVA AO VIVO DA EXTENSÃO (2026-10-15) — com marcadores discriminantes

## Onde
**Chrome LIMPO** (`C:\Temp\ll-ext-profile` = só a sessão do jogo, **sem as extensões do dono**) +
**a nossa extensão carregada por `Extensions.loadUnpacked`** (`tools/guest-pipe-load.mjs`), porta 9335.

Porque não no Chrome do dono: **o jogo trava lá por causa de OUTRA extensão** (ver
`docs/travamento-jogo.md` — no Chrome limpo o jogo corre; no do dono fica mudo a t=3s com 0% de CPU).

## Marcadores (só existem no código NOVO — AGENTS.md Regra Nº 4)
| Marcador | Valor observado | O que prova |
|---|---|---|
| mensagens `estado` e `combate` | recebidas | a camada de observação do `inject.js` (estado vivo a 4 Hz + agregado) está a publicar |
| `meta.rmMonstro` | **0.6** | a whitelist do `carregarMeta` aceita o RM do motor (TK-INT-01) — antes era cópia à mão |
| `meta.curvaPorNivel[29].hp` | **3891** | a CURVA é **LIDA do motor** (`150+100·29+29²`), não copiada (Regra Nº 3) |
| ids da GUI | `lolidle-ap-style`, `auto-estado`, `auto-vida`, `auto-mana`, `auto-qual-vida`, `auto-qual-mana` | a `gui.js` está carregada e a desenhar |
| HUD + log | `4588 / 4588`, `Fonte`, "Mercado: você vendeu um item!" | o jogo está a correr nesse browser e a extensão lê o estado real |

## Como repetir
```powershell
$env:LL_GUEST_UDD='C:/Temp/ll-ext-profile'; $env:LL_GUEST_PORT='9335'
$env:LL_EXT_DIR='I:/!lolidle.com/extension'
bun tools/guest-pipe-load.mjs          # job de fundo: mantém o pipe aberto
bun tools/prova-viva.mjs               # lê os marcadores acima
```
