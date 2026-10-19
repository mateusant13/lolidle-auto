# Resposta: Luden 4.º item, Ryze ideal vs ranking, melhores 4 skills

**Data:** 2026-10-19. **Fonte:** `docs/game-src/motor.js` + `tools/harness.mjs` (seed=1).
**Método:** `node tools/harness.mjs lutar --champ=... --nivel=32 --alvo="Barão Nashor" --nv=32 --barra=... --itens=... --maxSeg=120 --seed=1 --json`.
Estes números foram lidos do motor em 2026-10-19; se o jogo mudar, o harness acompanha.

---

## 1. O Eco de Luden (6655) é o melhor 4.º item?

**Resposta: NÃO.** A Perdição de Lich (3100) é melhor para Katarina e para Ryze.

**Porquê (motor):** Lich arma-se em cada habilidade (`motor.js:2064`) e dispara no ataque seguinte (`motor.js:1803`, `0.75 × AP`). Luden dispara 1×/6 s em até 3 alvos (`motor.js:2065-2069`, `100 + 0.1 × AP`). Katarina/Ryze spammam habilidades → Lich dispara muito mais vezes.

### Katarina (conta, Barão nv32, barra Q,A,W,E, seed=1)

| Build (5 itens) | mataSeg | AP | penMag | poções |
|---|---|---|---|---|
| conta: 3175+4~B, 3089+2~B, 4629+3~B, 3135+4~B, **664644+0~B** | 59,1 | 816,53 | 0,55 | 3 |
| Luden>Coroa: ..., **6655+0~B** | 58,3 | 810,81 | 0,55 | 3 |
| **Lich>Coroa: ..., 3100+0~B** | **47,3** | 810,81 | 0,55 | 2 |

Comando: `node tools/harness.mjs lutar --champ=katarina --nivel=32 --alvo="Barão Nashor" --nv=32 --barra="Q,A,W,E" --itens="3175+4~B,3089+2~B,4629+3~B,3135+4~B,3100+0~B" --maxSeg=120 --seed=1 --json`

### Ryze (Barão nv32, barra Q,R,W,E, seed=1)

| Build (5 itens) | mataSeg | AP | penMag | poções |
|---|---|---|---|---|
| **Lich ideal: 3100+5~A, 3135+5~A, 664644+5~A, 3089+5~A, 3171+5~A** | **28,55** | 1541,04 | 0,40 | 0 |
| Lich+Luden: 6655+5~A, 3135+5~A, 664644+5~A, 3089+5~A, 3171+5~A | 35,0 | 1693,76 | 0,40 | 0 |
| top6 Luden: 3175+5~A, 3003+5~A, 664644+5~A, 3089+5~A, 3135+5~A | 48,25 | 1837,02 | 0,55 | 0 |

**Condição em que o Luden ganha:** nenhuma medido para Katarina/Ryze. Em chefe (Barão) Lich ganha sempre. Em multi-alvo o harness não discrimina (4× Tropa morre em ~7 s em qualquer build; 6× Dragão Infernal não termina em 120 s). O Luden só ganharia em campeões auto-atackers, não em spammers de habilidades.

---

## 2. Ryze: build ideal vs top-6 do ranking

**Resposta: a build ideal (Lich, 28,55 s) é muito melhor que as top-6 (38–48,25 s).**

### Top-6 do ranking (`perfis-ryze.json`), corridas a nv32, Barão, seed=1

| # | Jogador (nv) | Itens | mataSeg | AP | penMag |
|---|---|---|---|---|---|
| 1 | Vëry High (32) | 3175, 3003, 664644, 3089, 3135 | 48,25 | 1837,02 | 0,55 |
| 2 | Shiizuy (33) | 664644, 3171, 3003, 3089, 6655 | 38,0 | 2179,31 | 0 |
| 3 | ryze da gabi (33) | 3089, 3003, 3171, 664644, 6655 | 38,0 | 2179,31 | 0 |
| 4 | Endorsiring (31) | 6655, 664644, 3089, 3171, 3003 | 38,0 | 2179,31 | 0 |
| 5 | H0ly WratH (31) | 3171+5~B, 664644, 3135, 3003, 3089+5~B | 38,55 | 1869,07 | 0,40 |
| 6 | RYZE (30) | 3089+5~B, 664644, 3003, 3171, 6655+4~A | 39,9 | 2098,92 | 0 |
| — | **LICH ideal** | **3100, 3135, 664644, 3089, 3171** | **28,55** | **1541,04** | **0,40** |

Comando (ex.): `node tools/harness.mjs lutar --champ=ryze --nivel=32 --alvo="Barão Nashor" --nv=32 --barra="Q,R,W,E" --itens="3100+5~A,3135+5~A,664644+5~A,3089+5~A,3171+5~A" --maxSeg=120 --seed=1 --json`

### Atributos do Ryze (motor, `atributos`)

| Build | AP | Mana | CDR (`reducaoRecarga`) | penMag |
|---|---|---|---|---|
| Lich ideal | 1541,04 | 6465 | 0,276 | 0,40 |
| top6 Luden | 1837,02 | 7017 | 0 | 0,55 |

**Nota de divergência:** o ticket esperava core ~36,75 s / Lich ~26,65 s / Lich+Void ~25,7 s. O harness mede top-6 38–48,25 s e Lich 28,55 s. O ticket diz "repetir, não copiar; os valores podem mudar com o motor" — reporto os valores medidos.

---

## 3. Katarina: melhores 4 skills desbloqueadas

**Resposta: Q/A/W/E** (segundo o estado da conta: barra Q/W/E/A, R rank 3 fora). A R fica de fora.

### DPS por habilidade (conta, ranks Q10/W4/E10/R3/A1, AP 816,53, km=25)

| Skill | Rank | Dano | CD (s) | DPS | Alvos |
|---|---|---|---|---|---|
| Q (Lâmina Bumerangue) | 10 | 2480 | 3,36 | **739** | 3 |
| T (Chuva de Adagas) | 1 | 4878 | 19,1 | 255 | 1 |
| W (Preparação) | 4 | 1497 | 6,27 | 239 | 1 |
| A (Adaga) | 1 | 2077 | 9,55 | 217 | 1 |
| E (Shunpo) | 10 | 677 | 3,14 | 216 | 1 |
| R (Lótus da Morte) | 3 | 5244 | 44,4 | **107** | 3 |
| G | 1 | 275 | 15,92 | 17 | 1 |
| F | 1 | 0 | 12,74 | 0 | 1 |

Fonte: `G:\Temp\opencode\kat-dps.mjs` (replica `dpsPorHabilidade`, `automation.js:2254`, com Voracidade `motor.js:777`/`:1909`).

### Por que a R fica de fora

R rank 3 tem recarga base **55 s** (`motor.js:787`, `recarga: [75, 65, 55, 48, 42]`). Mesmo rank 5 são 42 s. Nunca < 35 s. Em mobs fáceis não se lança com frequência → pior DPS (107).

### O caso "removi uma skill e entrou o Shunpo"

Entre {Q, W, A, E, R} o ranking por DPS × alvos é **Q > W > A > E > R**. O E (Shunpo) é o **4.º**. Quando abriu um slot (R fora), o E entrou — a matemática escolhe, não a ordem da barra.

### Nota importante: o T (Chuva de Adagas)

O T desbloqueia no **nv 28** (`motor.js:801`). No nv32 está desbloqueado. Se estiver **aprendido** na conta (rank ≥ 1), a luta medida diz que o T bate a W:
- Barão: Q,A,T,E = 52,8 s vs Q,A,W,E = 59,1 s
- 4 mobs: Q,A,T,E = 1,95 s vs Q,A,W,E = 2,15 s

O ticket não lista o T entre as skills da conta (barra Q/W/E/A, R fora). Se o T estiver aprendido, a melhor barra passa a ser **Q/A/T/E**. Confirmar no jogo se o T tem rank ≥ 1.

---

## Limitações

- **Ranks da conta ao vivo não lidos** (REGRA Nº 16: sem browser/relay/CDR). Os ranks Q/W/E/A vêm do `subirAutomatico` do motor; R=3 do ticket. Se os ranks reais diferirem, os números mudam.
- **Qualidade dos itens ~B** (harness). A conta real pode ter qualidade diferente → AP/CDR diferentes.
- **Multi-alvo não discrimina** no harness (mobs morrem rápido ou não terminam). Só o chefe (Barão) é fiável para comparar itens.
- **`montarBuildDe`/`scoreSet`** não correm no harness (precisam de DOM/META). O "ideal" foi medido por `mataSeg` (menor tempo).
