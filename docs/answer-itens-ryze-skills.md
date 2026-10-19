# Resposta: Luden, Ryze ideal vs ranking e as melhores 4 skills

**Data:** 2026-10-19. **Fonte:** `docs/game-src/motor.js` + `tools/harness.mjs` (seed=1).
**Método:** `node tools/harness.mjs lutar --champ=... --nivel=32 --alvo="Barão Nashor" --nv=32 --barra=... --itens=... --maxSeg=120 --seed=1 --json`.

> **Qualidade importa.** Todos os números abaixo usam qualidade/refino explícitos (`+5~A`, `+4~B`, …).
> O harness, sem sufixo, usa o padrão e os tempos sobem muito: a mesma build ideal do Ryze faz
> **25,7 s com `+5~A`** e **54,2 s sem sufixo**. Comparar sempre na mesma qualidade.

---

## 1. O Eco de Luden (6655) é o melhor 4.º item?

**Resposta: NÃO — contra chefe de alvo único, a Perdição de Lich (3100) ganha por muito.**

**Porquê (motor):** Lich arma em cada habilidade (`motor.js:2064`) e dispara no ataque seguinte,
`0,75 × AP` (`motor.js:1803`). Luden dispara **1×/6 s** em até 3 alvos, `100 + 0,1 × AP`
(`motor.js:2065-2069`). Katarina e Ryze spammam habilidades: Lich dispara muitas vezes, Luden
quase sempre uma vez por 6 s contra um chefe.

### Katarina (conta, Barão nv32, barra Q,A,W,E, seed=1)

| Build (5 itens) | mataSeg | AP | penMag | poções |
|---|---|---|---|---|
| conta: 3175+4~B, 3089+2~B, 4629+3~B, 3135+4~B, **664644+0~B** | 59,1 | 816,53 | 0,55 | 3 |
| Luden no lugar da Coroa: **6655+0~B** | 58,3 | 810,81 | 0,55 | 3 |
| **Lich no lugar da Coroa: 3100+0~B** | **47,3** | 810,81 | 0,55 | 2 |

Comando: `node tools/harness.mjs lutar --champ=katarina --nivel=32 --alvo="Barão Nashor" --nv=32 --barra="Q,A,W,E" --itens="3175+4~B,3089+2~B,4629+3~B,3135+4~B,3100+0~B" --maxSeg=120 --seed=1 --json`

O Luden é **0,8 s melhor que a Coroa** e **11,8 s pior que o Lich**. Não é o melhor 4.º.

### Ryze (Barão nv32, barra Q,R,W,E, seed=1)

| Build (5 itens, todos `+5~A`) | mataSeg | AP | penMag | poções |
|---|---|---|---|---|
| **Ideal: 3171 + 3003 + 3089 + 3100 + 3135** | **25,7** | 1715,65 | 0,40 | 0 |
| Lich + Coroa (sem Anjo): 3100 + 3135 + 664644 + 3089 + 3171 | 28,55 | 1541,04 | 0,40 | 0 |
| Luden no lugar do Lich: 3171 + 3003 + 3089 + **6655** + 3135 | 36,75 | 1916,85 | 0,40 | 0 |
| Top-1 do ranking: 3175 + 3003 + 664644 + 3089 + 3135 | 48,25 | 1837,02 | 0,55 | 0 |

Comando da ideal: `node tools/harness.mjs lutar --champ=ryze --nivel=32 --alvo="Barão Nashor" --nv=32 --itens="3171+5~A,3003+5~A,3089+5~A,3100+5~A,3135+5~A" --maxSeg=120 --seed=1 --json`

**Quando o Luden ganha:** em farm multi-alvo (3 alvos), porque o proc bate nos 3. O harness luta
**1 alvo** (`qtd:1`); contra o Barão o Luden é 11 s mais lento que o Lich. Para chefe, Luden não é
o 4.º item — é item de farm.

---

## 2. Ryze: build ideal vs os top-6 do ranking

**Resposta: a ideal (Lich, 25,7 s) é 12–22 s mais rápida que todas as top-6 (38–48,25 s).**

### Top-6 do ranking (`perfis-ryze.json`), a nv32, Barão, seed=1, `+5~A`

| # | Jogador (nv) | Itens | mataSeg | AP | penMag |
|---|---|---|---|---|---|
| 1 | Vëry High (32) | 3175, 3003, 664644, 3089, 3135 | 48,25 | 1837,02 | 0,55 |
| 2 | Shiizuy (33) | 664644, 3171, 3003, 3089, 6655 | 38,0 | 2179,31 | 0 |
| 3 | ryze da gabi (33) | 3089, 3003, 3171, 664644, 6655 | 38,0 | 2179,31 | 0 |
| 4 | Endorsiring (31) | 6655, 664644, 3089, 3171, 3003 | 38,0 | 2179,31 | 0 |
| 5 | H0ly WratH (31) | 3171, 664644, 3135, 3003, 3089 | 38,55 | 1869,07 | 0,40 |
| 6 | RYZE (30) | 3089, 664644, 3003, 3171, 6655 | 39,9 | 2098,92 | 0 |
| — | **IDEAL** | **3171, 3003, 3089, 3100, 3135** | **25,7** | **1715,65** | **0,40** |

### Atributos da ideal (`atributos ryze 32`)

| AP | Mana | CDR (`reducaoRecarga`) | penMag | Vida |
|---|---|---|---|---|
| 1715,65 | 6465 | 0,276 | 0,40 | 4464 |

**Porque a ideal ganha com AP menor:** o Ryze usa habilidades sem parar (37 usos na luta de 28,6 s),
logo o Lich rende um proc de `0,75 × AP` por uso; a Void (3135) dá 40% de penetração mágica
(`motor.js`, item 3135) e o Anjo (3003) dá mana → AP pela passiva dele. O ranking mede **poder**
(AP 2179), não **segundos até matar** — por isso nenhum top-6 usa Lich.

**Custo:** a ideal não usou poção (0 de ouro) e recebeu **0** de dano na simulação; a top-1
(48,25 s) recebeu 754 e também não usou poção. A ideal é mais rápida e mais barata em desgaste.

---

## 3. Katarina: as melhores 4 skills desbloqueadas

**Resposta curta:** com a build actual (sem Lich) e farm a ~25 abates/min: **Q, T, W, A**.
Com o Lich equipado (build ideal) e o mesmo ritmo: **Q, E, W, T** — o Shunpo entra por causa do Lich.
A R fica de fora em mobs fáceis; no chefe a regra do motor permite a R, mas ela continua com o pior DPS.

### DPS por habilidade — conta, ranks Q10/W4/E10/R3/A1/T1, AP 810,81, km=25

| Skill | Rank | Dano | CD (s) | DPS sem Lich | DPS com Lich |
|---|---|---|---|---|---|
| Q (Lâmina Bumerangue) | 10 | 2480 | 3,36 | **739** | **921** |
| T (Chuva de Adagas) | 1 | 4878 | 19,1 | 255 | 287 |
| W (Preparação) | 4 | 1497 | 6,27 | 239 | 336 |
| A (Adaga) | 1 | 2077 | 9,55 | 217 | 281 |
| E (Shunpo) | 10 | 677 | 3,14 | 216 | **410** |
| R (Lótus da Morte) | 3 | 4667 | 43,78 | 107 | 121 |

Fonte: `G:\Temp\opencode\kat-dps.mjs` (replica `dpsPorHabilidade`, `automation.js:2254`, com a
Voracidade `motor.js:777`/`:1909`). A coluna “com Lich” soma `0,75 × 810,81 = 608` por uso, dividido
pela recarga — a mesma conta de `automation.js:2297-2303`.

### Porque o Shunpo entra com Lich

O Lich dá **608 de dano por uso**. O E usa a cada **3,14 s** (194 DPS só de Lich); o T usa a cada
**19,1 s** (32 DPS de Lich). Sem Lich o E é o 5.º (216); com Lich sobe a 2.º (410) e tira o lugar ao
T/A. É exactamente o caso que o dono descreveu: *“Lich Bane proccando mais com o Shunpo”*.

### Porque a R fica de fora

R rank 3 tem recarga base **55 s** (`motor.js:787`, `recarga: [75, 65, 55, 48, 42]`); 15 golpes em
3 alvos = 4667 de dano, ou **107 DPS** (121 com Lich). É o pior das habilidades de dano. Em mobs
fáceis a `barraIdeal` filtra a R (`automation.js:7939`: só entra em chefe ou fase difícil); no chefe
ela é permitida, mas continua atrás de Q/T/W/A/E.

### O ranking muda com o ritmo de abates (Voracidade)

A Voracidade corta a recarga de Q/W/E a cada abate (`motor.js:1789`). Com **km=5** (chefe, poucos
abates) o W cai de 239 para 165 e o E de 216 para 150; a ordem sem Lich passa a **Q, T, A, W/E**.
A `barraIdeal` usa o `killsMinAoVivo` real, por isso a lista certa é a que ela calcula no momento —
não uma lista fixa.

---

## Limitações

- **Ranks da conta ao vivo não lidos** (REGRA Nº 16: sem browser/relay/CDP). Os ranks vêm do
  `subirAutomatico` do motor; R=3 do ticket. Se os ranks reais forem outros, os números mudam.
- **Qualidade da conta** usada na Katarina é `+4~B/+2~B/+3~B/+0~B` (a do probe), não
  necessariamente a da conta neste instante.
- **Multi-alvo do Luden não é medido** no harness (luta 1 alvo); a vantagem de 3 alvos é lida no
  motor (`motor.js:2067`), não simulada.
- **`montarBuildDe`/`scoreSet`** não correm no harness (precisam de DOM/META); a build ideal foi
  medida por `mataSeg` (menor tempo), não imposta por uma heurística.
