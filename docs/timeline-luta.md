# A linha do tempo da luta — LoL Idle (Katarina nv 29, os 3 chefes)

Gerado por `bun tools/sim-timeline.mjs` — passo de **0.05 s**, o do próprio jogo (DT = 0.05, jogo.js:30; M.passo(...) a cada quadro, jogo.js:1564).
Ordem das operações dentro do passo: motor.js:1334-1626. Todos os números do jogo são **lidos** de docs/game-src/motor.js (nunca copiados).
Semente do PRNG: **20261014** (mesmo comando = mesma linha do tempo). Barra: W,Q,R,A. Poções: piso 0.75 da vida, margem 1.1 do último golpe. Teto de tempo: 300 s.

## 0) CONFERÊNCIA DO MODELO CONTRA O MEDIDO

**[1] Painel do dono** (docs/snapshots/player.json): nv 29, 4476 HP, 161 AD, 1104 Poder, 164 armadura, 134 RM, 1.16 ataques/s.

| atributos usados | vida | AD | Poder | armadura | RM | ataques/s |
|---|---:|---:|---:|---:|---:|---:|
| painel do dono (81/3/0/0/0) | 4536 (+1.3%) | 153 (-4.8%) | 1051 (-4.8%) | 158 (-3.7%) | 130 (-3.0%) | 1.163 (+0.2%) |
| calibragem (84/0/4/0/0) | 4476 (+0.0%) | 153 (-4.8%) | 1060 (-4.0%) | 164 (+0.0%) | 134 (+0.0%) | 1.163 (+0.2%) |

A base do campeão (hp/hpperlevel/armor/attackspeed...) **não existe no repositório**: motor.js:6 importa dados-katarina.js, que está ausente.
É a de tools/sim-chefes.mjs — **CALIBRADO NÃO VERIFICADO** (1 ponto medido, nv29). Por isso a linha da calibragem acerta e a do painel desvia.

**[2] Eventos MEDIDOS numa luta REAL contra o Dragão** (docs/snapshots/katarina.json: lutas[].hist — 70 eventos, durS 35.6, poções 0)

| evento medido | medido no snapshot | modelo (atributos do dono) | desvio | fonte do modelo |
|---|---:|---:|---:|---|
| auto-ataque do chefe | 296 | 302 | 2.1% | motor.js:1725-1737, 1167, 2697 |
| golpe do Sopro (x2,2) | 673 | 665 | -1.2% | motor.js:3105, 3101 |
| queimadura por 247 ms | 32 | 34 | 5.0% | motor.js:3105 (3% da vida máxima por segundo) |

Dano do jogador no chefe, valores distintos MEDIDOS (hist.t = dmg, dir out) e o que o modelo prevê:

| medido | vezes | modelo mais próximo | desvio |
|---|---:|---:|---:|
| 1156 | 3 | Q (rank 10) = 1119 | 3.2% |
| 103 | 2 | auto = 98 | 4.7% |
| 804 | 2 | Lich (75% do Poder) = 766 | 4.7% |
| 1017 | 2 | A (rank 5) = 979 | 3.7% |
| 1640 | 2 | giro da adaga = 1586 | 3.3% |
| 389 | 1 | leva do R = 373 | 4.1% |

Leitura: os eventos do chefe (auto, sopro, queimadura) batem no modelo **sem ajuste nenhum** — é o nível do chefe (motor.js:1121),
a mitigação (motor.js:1167) e o papel da Katarina (motor.js:885) a fazerem a conta. Os números do jogador dependem da base do campeão,
que **não está no repositório** (dados-katarina.js ausente): por isso ficam alguns por cento abaixo do medido.


---

## Arauto do Vale (local rio, nm = [25, 33] [motor.js:354])


### Arauto do Vale — nv 33  (nível = max(nm0+2, min(nm1+2, nv+4)) [motor.js:1121])

| grandeza | valor | fonte |
|---|---|---|
| vida máxima | 45 390 | CURVA.hp(33) x 10 [motor.js:273, 280] |
| dano de ataque | 772 | CURVA.ad(33) x 2.5 [motor.js:273] |
| velocidade de ataque | 0.6/s | [motor.js:280] |
| armadura | 81.8 | CURVA.armadura(33) x 1.5 [motor.js:273] |
| tipo de dano | físico (bate na armadura) | [motor.js:280] |
| rodízio de mecânicas | investida -> pancada -> olho | [motor.js:3080] |
| 1.a mecânica | investida | [motor.js:3066] |
| fator de nível (dano do monstro) | x1.00 | [motor.js:1184] |
| fator de nível (dano do jogador) | x1.00 | [motor.js:1184] |

Jogador: **4536 HP**, 153 AD, 1051 Poder, 158 armadura, 130 RM, 1.163 ataques/s, 23.46% de recarga, 55% de pen. mágica, 0% de roubo de vida.

Barra (4 espaços, motor.js:900): **W, Q, R, A** — ranks: Q 10, W 1, E 3, R 3, G 1, A 5, F 1.

Build: 3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A — procs LIGADOS: 
  - Lich: próximo auto após habilidade = 75% do Poder [motor.js:1688]
  - Rabadon: +35% do Poder total [motor.js:522]
  - Cajado do Vazio: 40% de penetração mágica [motor.js:529]
  - Ímpeto Cósmico: +15% de recarga (escalado por refino e qualidade) [motor.js:24,255]

| t (s) | evento | dano | vida do chefe | vida do jogador | poções |
|---|---|---:|---:|---:|---:|
| 1.75 | CHEFE CHEGOU (nv 33) |  | 45 390 | 4536 | 0 |
| 1.75 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 45 390 | 4536 | 0 |
| 1.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 44 258 | 4536 | 0 |
| 1.75 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 44 258 | 4536 | 0 |
| 1.80 | Lótus da Morte: leva 1/15 em 1 alvo(s) | 377 | 43 880 | 4536 | 0 |
| 2.00 | Lótus da Morte: leva 2/15 em 1 alvo(s) | 377 | 43 503 | 4536 | 0 |
| 2.15 | Lótus da Morte: leva 3/15 em 1 alvo(s) | 377 | 43 125 | 4536 | 0 |
| 2.30 | Lótus da Morte: leva 4/15 em 1 alvo(s) | 377 | 42 748 | 4536 | 0 |
| 2.50 | Lótus da Morte: leva 5/15 em 1 alvo(s) | 377 | 42 370 | 4536 | 0 |
| 2.65 | Lótus da Morte: leva 6/15 em 1 alvo(s) | 377 | 41 993 | 4536 | 0 |
| 2.80 | Lótus da Morte: leva 7/15 em 1 alvo(s) | 377 | 41 616 | 4536 | 0 |
| 2.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 40 011 | 4536 | 0 |
| 3.00 | Lótus da Morte: leva 8/15 em 1 alvo(s) | 377 | 39 633 | 4536 | 0 |
| 3.15 | Lótus da Morte: leva 9/15 em 1 alvo(s) | 377 | 39 256 | 4536 | 0 |
| 3.25 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 1605 | 37 651 | 4536 | 0 |
| 3.30 | Lótus da Morte: leva 10/15 em 1 alvo(s) | 377 | 37 274 | 4536 | 0 |
| 3.40 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 37 274 | 4312 | 0 |
| 3.50 | Lótus da Morte: leva 11/15 em 1 alvo(s) | 377 | 36 896 | 4312 | 0 |
| 3.65 | Lótus da Morte: leva 12/15 em 1 alvo(s) | 377 | 36 519 | 4312 | 0 |
| 3.80 | Lótus da Morte: leva 13/15 em 1 alvo(s) | 377 | 36 142 | 4312 | 0 |
| 4.00 | Lótus da Morte: leva 14/15 em 1 alvo(s) | 377 | 35 764 | 4312 | 0 |
| 4.15 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 377 | 35 387 | 4312 | 0 |
| 4.15 | Lótus da Morte terminou [motor.js:2194] |  | 35 387 | 4312 | 0 |
| 4.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 34 612 | 4312 | 0 |
| 4.15 | Auto-ataque — sem roubo de vida na build | 101 | 34 510 | 4312 | 0 |
| 5.05 | Auto-ataque — sem roubo de vida na build | 101 | 34 409 | 4312 | 0 |
| 5.10 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 34 409 | 4088 | 0 |
| 5.95 | Auto-ataque — sem roubo de vida na build | 101 | 34 308 | 4088 | 0 |
| 6.75 | CHEFE CARREGA Investida (investida) — aviso de 1.5s [motor.js:3123] |  | 34 308 | 4088 | 0 |
| 6.80 | A Adaga Certeira em Arauto do Vale (atordoa 1s) — recarga que entra 7.65s | 991 | 33 317 | 4088 | 0 |
| 6.80 | CHEFE INTERROMPIDO (investida) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 33 317 | 4088 | 0 |
| 6.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 32 542 | 4088 | 0 |
| 6.85 | Auto-ataque — sem roubo de vida na build | 101 | 32 441 | 4088 | 0 |
| 7.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 31 308 | 4088 | 0 |
| 7.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 30 533 | 4089 | 0 |
| 7.75 | Auto-ataque — sem roubo de vida na build | 101 | 30 432 | 4089 | 0 |
| 7.80 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1605 | 28 827 | 4169 | 0 |
| 7.85 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 28 827 | 3944 | 0 |
| 8.20 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 27 223 | 4025 | 0 |
| 8.65 | Auto-ataque — sem roubo de vida na build | 101 | 27 122 | 4025 | 0 |
| 9.55 | Auto-ataque — sem roubo de vida na build | 101 | 27 020 | 4025 | 0 |
| 9.55 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 27 020 | 3801 | 0 |
| 10.45 | Auto-ataque — sem roubo de vida na build | 101 | 26 919 | 3801 | 0 |
| 11.25 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 26 919 | 3577 | 0 |
| 11.35 | Auto-ataque — sem roubo de vida na build | 101 | 26 818 | 3577 | 0 |
| 12.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 25 686 | 3577 | 0 |
| 12.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 24 910 | 3577 | 0 |
| 12.25 | Auto-ataque — sem roubo de vida na build | 101 | 24 809 | 3577 | 0 |
| 12.50 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 24 809 | 3577 | 0 |
| 12.85 | CHEFE CARREGA Pancada Sísmica (pancada) — aviso de 1.2s [motor.js:3123] |  | 24 809 | 3577 | 0 |
| 13.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 24 034 | 3577 | 0 |
| 13.15 | Auto-ataque — sem roubo de vida na build | 101 | 23 933 | 3577 | 0 |
| 13.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 22 328 | 3657 | 0 |
| 13.75 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 1605 | 20 724 | 3738 | 0 |
| 14.05 | Auto-ataque — sem roubo de vida na build | 101 | 20 622 | 3738 | 0 |
| 14.05 | GOLPE Pancada Sísmica (pancada, x2.2) | -494 | 20 622 | 3244 | 0 |
| 14.10 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 20 622 | 4144 | 1 |
| 14.15 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 20 622 | 3919 | 1 |
| 14.95 | Auto-ataque — sem roubo de vida na build | 101 | 20 521 | 3920 | 1 |
| 15.85 | Auto-ataque — sem roubo de vida na build | 101 | 20 420 | 3920 | 1 |
| 15.85 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 20 420 | 3695 | 1 |
| 16.75 | Auto-ataque — sem roubo de vida na build | 101 | 20 319 | 3696 | 1 |
| 17.50 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 19 187 | 3696 | 1 |
| 17.55 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 19 187 | 3471 | 1 |
| 17.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 18 411 | 3471 | 1 |
| 17.65 | Auto-ataque — sem roubo de vida na build | 101 | 18 310 | 3471 | 1 |
| 18.55 | Auto-ataque — sem roubo de vida na build | 101 | 18 209 | 3472 | 1 |
| 18.60 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 16 604 | 3552 | 1 |
| 19.25 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 16 604 | 3327 | 1 |
| 19.30 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 16 604 | 4227 | 2 |
| 19.45 | Auto-ataque — sem roubo de vida na build | 101 | 16 503 | 4228 | 2 |
| 20.35 | Auto-ataque — sem roubo de vida na build | 101 | 16 402 | 4228 | 2 |
| 20.95 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 16 402 | 4003 | 2 |
| 21.10 | CHEFE CARREGA Olho do Arauto (olho) — aviso de 1.3s [motor.js:3123] |  | 16 402 | 4003 | 2 |
| 21.15 | A Adaga Certeira em Arauto do Vale (atordoa 1s) — recarga que entra 7.65s | 991 | 15 411 | 4003 | 2 |
| 21.15 | CHEFE INTERROMPIDO (olho) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 15 411 | 4003 | 2 |
| 21.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 14 636 | 4004 | 2 |
| 21.25 | Auto-ataque — sem roubo de vida na build | 101 | 14 535 | 4004 | 2 |
| 22.15 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1605 | 12 930 | 4084 | 2 |
| 22.15 | Auto-ataque — sem roubo de vida na build | 101 | 12 829 | 4084 | 2 |
| 22.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 11 696 | 4084 | 2 |
| 23.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 10 921 | 4084 | 2 |
| 23.05 | Auto-ataque — sem roubo de vida na build | 101 | 10 820 | 4084 | 2 |
| 23.25 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 10 820 | 4084 | 2 |
| 23.70 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 10 820 | 3860 | 2 |
| 23.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 9215 | 3940 | 2 |
| 23.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 8440 | 3940 | 2 |
| 23.95 | Auto-ataque — sem roubo de vida na build | 101 | 8339 | 3940 | 2 |
| 24.50 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 1605 | 6734 | 4021 | 2 |
| 24.85 | Auto-ataque — sem roubo de vida na build | 101 | 6633 | 4021 | 2 |
| 25.40 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 6633 | 3796 | 2 |
| 25.75 | Auto-ataque — sem roubo de vida na build | 101 | 6532 | 3796 | 2 |
| 26.65 | Auto-ataque — sem roubo de vida na build | 101 | 6431 | 3797 | 2 |
| 27.10 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 6431 | 3572 | 2 |
| 27.20 | CHEFE CARREGA Investida (investida) — aviso de 1.5s [motor.js:3123] |  | 6431 | 3572 | 2 |
| 27.55 | Auto-ataque — sem roubo de vida na build | 101 | 6330 | 3572 | 2 |
| 28.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 5197 | 3573 | 2 |
| 28.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 4422 | 3573 | 2 |
| 28.45 | Auto-ataque — sem roubo de vida na build | 101 | 4321 | 3573 | 2 |
| 28.70 | GOLPE Investida (investida, x3.5) | -786 | 4321 | 2787 | 2 |
| 28.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 4321 | 3087 | 3 |
| 29.10 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 2716 | 3167 | 3 |
| 29.35 | Auto-ataque — sem roubo de vida na build | 101 | 2615 | 3167 | 3 |
| 29.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 2615 | 4067 | 4 |
| 30.25 | Auto-ataque — sem roubo de vida na build | 101 | 2514 | 4068 | 4 |
| 30.30 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 2514 | 3843 | 4 |
| 31.15 | Auto-ataque — sem roubo de vida na build | 101 | 2413 | 3843 | 4 |
| 32.00 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 2413 | 3619 | 4 |
| 32.05 | Auto-ataque — sem roubo de vida na build | 101 | 2312 | 3619 | 4 |
| 32.95 | Auto-ataque — sem roubo de vida na build | 101 | 2211 | 3619 | 4 |
| 33.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1132 | 1078 | 3619 | 4 |
| 33.70 | Auto-ataque do chefe (fisico, 772 AD, as 0.60) | -225 | 1078 | 3395 | 4 |
| 33.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 1078 | 4295 | 5 |
| 33.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 775 | 303 | 4295 | 5 |
| 33.85 | Auto-ataque — sem roubo de vida na build | 101 | 202 | 4295 | 5 |
| 34.00 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 202 | 4295 | 5 |
| 34.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1605 | 0 | 4375 | 5 |
| 34.35 | ABATE DO CHEFE Arauto do Vale -> Voracidade corta 5s de Q/W/E (cortou 9.14s) [voracidadeChefe, motor.js:736] [motor.js:1789] |  | 0 | 4375 | 5 |

**RESUMO — Arauto do Vale**

| grandeza | valor |
|---|---|
| resultado | MATOU em 34.35 s |
| duração | 34.35 s |
| vida do jogador | min **2787** / 4536 (61.4%) |
| poções | **5** (P1 1, P2 4, P3 0) = **480 g** |
| abates | larvas **0**, chefes **1** |
| recarga cortada pela Voracidade | **5.0 s** em Q/W/E (0 x 1.5 + 1 x 5) [motor.js:1789] |
| dano causado | 46 793 (auto + skills + itens + queima) |
| dano recebido | 4873 |
| cura | roubo de vida 0 + giro 802 + poções 3900 + regeneração 9 |
| procs | Lich 11 (8527 de dano), Liandry 0 (0), Rei 3153 0 (0 de bónus), Luden 0 (0) |
| habilidades lançadas | R x1, Q x7, W x4, A x2 |
| ouro dos abates | 1046 g (sem multiplicadores de VIP/rotina) |
| eventos na linha do tempo | 118 (AUTO 34, CHEFE_BASICO 16, HAB 15, HAB_TICK 15, GIRO 12, PROC 11, CHEFE 9, POCAO 5, ABATE 1) |


---

## Dragão Infernal (local dragao, nm = [30, 38] [motor.js:354])


### Dragão Infernal — nv 33  (nível = max(nm0+2, min(nm1+2, nv+4)) [motor.js:1121])

| grandeza | valor | fonte |
|---|---|---|
| vida máxima | 54 468 | CURVA.hp(33) x 12 [motor.js:273, 280] |
| dano de ataque | 927 | CURVA.ad(33) x 3 [motor.js:273] |
| velocidade de ataque | 0.55/s | [motor.js:280] |
| armadura | 87.2 | CURVA.armadura(33) x 1.6 [motor.js:273] |
| tipo de dano | mágico (bate na RM) | [motor.js:280] |
| rodízio de mecânicas | sopro -> chuva -> rugido | [motor.js:3080] |
| 1.a mecânica | sopro | [motor.js:3066] |
| fator de nível (dano do monstro) | x1.00 | [motor.js:1184] |
| fator de nível (dano do jogador) | x1.00 | [motor.js:1184] |

Jogador: **4536 HP**, 153 AD, 1051 Poder, 158 armadura, 130 RM, 1.163 ataques/s, 23.46% de recarga, 55% de pen. mágica, 0% de roubo de vida.

Barra (4 espaços, motor.js:900): **W, Q, R, A** — ranks: Q 10, W 1, E 3, R 3, G 1, A 5, F 1.

Build: 3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A — procs LIGADOS: 
  - Lich: próximo auto após habilidade = 75% do Poder [motor.js:1688]
  - Rabadon: +35% do Poder total [motor.js:522]
  - Cajado do Vazio: 40% de penetração mágica [motor.js:529]
  - Ímpeto Cósmico: +15% de recarga (escalado por refino e qualidade) [motor.js:24,255]

| t (s) | evento | dano | vida do chefe | vida do jogador | poções |
|---|---|---:|---:|---:|---:|
| 1.75 | CHEFE CHEGOU (nv 33) |  | 54 468 | 4536 | 0 |
| 1.75 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 54 468 | 4536 | 0 |
| 1.75 | A Adaga Certeira em Dragão Infernal (atordoa 1s) — recarga que entra 7.65s | 979 | 53 489 | 4536 | 0 |
| 1.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 52 370 | 4536 | 0 |
| 1.75 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 52 370 | 4536 | 0 |
| 1.80 | Lótus da Morte: leva 1/15 em 1 alvo(s) | 373 | 51 997 | 4536 | 0 |
| 2.00 | Lótus da Morte: leva 2/15 em 1 alvo(s) | 373 | 51 624 | 4536 | 0 |
| 2.15 | Lótus da Morte: leva 3/15 em 1 alvo(s) | 373 | 51 251 | 4536 | 0 |
| 2.30 | Lótus da Morte: leva 4/15 em 1 alvo(s) | 373 | 50 878 | 4536 | 0 |
| 2.50 | Lótus da Morte: leva 5/15 em 1 alvo(s) | 373 | 50 505 | 4536 | 0 |
| 2.65 | Lótus da Morte: leva 6/15 em 1 alvo(s) | 373 | 50 132 | 4536 | 0 |
| 2.75 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1586 | 48 547 | 4536 | 0 |
| 2.80 | Lótus da Morte: leva 7/15 em 1 alvo(s) | 373 | 48 174 | 4536 | 0 |
| 3.00 | Lótus da Morte: leva 8/15 em 1 alvo(s) | 373 | 47 801 | 4536 | 0 |
| 3.15 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 46 215 | 4536 | 0 |
| 3.15 | Lótus da Morte: leva 9/15 em 1 alvo(s) | 373 | 45 842 | 4536 | 0 |
| 3.30 | Lótus da Morte: leva 10/15 em 1 alvo(s) | 373 | 45 469 | 4536 | 0 |
| 3.50 | Lótus da Morte: leva 11/15 em 1 alvo(s) | 373 | 45 097 | 4536 | 0 |
| 3.55 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 1586 | 43 511 | 4536 | 0 |
| 3.65 | Lótus da Morte: leva 12/15 em 1 alvo(s) | 373 | 43 138 | 4536 | 0 |
| 3.80 | Lótus da Morte: leva 13/15 em 1 alvo(s) | 373 | 42 765 | 4536 | 0 |
| 4.00 | Lótus da Morte: leva 14/15 em 1 alvo(s) | 373 | 42 392 | 4536 | 0 |
| 4.15 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 373 | 42 019 | 4536 | 0 |
| 4.15 | Lótus da Morte terminou [motor.js:2194] |  | 42 019 | 4536 | 0 |
| 4.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 41 253 | 4536 | 0 |
| 4.15 | Auto-ataque — sem roubo de vida na build | 98 | 41 155 | 4536 | 0 |
| 4.55 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 41 155 | 4234 | 0 |
| 5.05 | Auto-ataque — sem roubo de vida na build | 98 | 41 057 | 4234 | 0 |
| 5.95 | Auto-ataque — sem roubo de vida na build | 98 | 40 959 | 4235 | 0 |
| 6.40 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 40 959 | 3932 | 0 |
| 6.75 | CHEFE CARREGA Sopro de Fogo (sopro) — aviso de 1s [motor.js:3123] |  | 40 959 | 3933 | 0 |
| 6.85 | Auto-ataque — sem roubo de vida na build | 98 | 40 860 | 3933 | 0 |
| 7.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 39 741 | 3933 | 0 |
| 7.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 38 976 | 3933 | 0 |
| 7.75 | Auto-ataque — sem roubo de vida na build | 98 | 38 877 | 3933 | 0 |
| 7.75 | GOLPE Sopro de Fogo (sopro, x2.2) + queimadura 3%/s por 4s | -665 | 38 877 | 3268 | 0 |
| 7.80 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 38 877 | 4161 | 1 |
| 8.10 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 37 292 | 4200 | 1 |
| 8.25 | Queimadura do chefe (136/s, resta 3.50s) [motor.js:3105-3108] | -68 | 37 292 | 4179 | 1 |
| 8.65 | Auto-ataque — sem roubo de vida na build | 98 | 37 194 | 4125 | 1 |
| 8.75 | Queimadura do chefe (136/s, resta 3.00s) [motor.js:3105-3108] | -68 | 37 194 | 4111 | 1 |
| 9.25 | Queimadura do chefe (136/s, resta 2.50s) [motor.js:3105-3108] | -68 | 37 194 | 4043 | 1 |
| 9.25 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 37 194 | 3741 | 1 |
| 9.45 | A Adaga Certeira em Dragão Infernal (atordoa 1s) — recarga que entra 7.65s | 979 | 36 214 | 3714 | 1 |
| 9.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 35 448 | 3700 | 1 |
| 9.55 | Auto-ataque — sem roubo de vida na build | 98 | 35 350 | 3700 | 1 |
| 9.75 | Queimadura do chefe (136/s, resta 2.00s) [motor.js:3105-3108] | -68 | 35 350 | 3673 | 1 |
| 10.25 | Queimadura do chefe (136/s, resta 1.50s) [motor.js:3105-3108] | -68 | 35 350 | 3605 | 1 |
| 10.45 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1586 | 33 765 | 3658 | 1 |
| 10.45 | Auto-ataque — sem roubo de vida na build | 98 | 33 666 | 3658 | 1 |
| 10.75 | Queimadura do chefe (136/s, resta 1.00s) [motor.js:3105-3108] | -68 | 33 666 | 3617 | 1 |
| 11.25 | Queimadura do chefe (136/s, resta 0.50s) [motor.js:3105-3108] | -68 | 33 666 | 3549 | 1 |
| 11.35 | Auto-ataque — sem roubo de vida na build | 98 | 33 568 | 3535 | 1 |
| 11.75 | Queimadura do chefe (136/s, resta 0.00s) [motor.js:3105-3108] | -68 | 33 568 | 3481 | 1 |
| 12.10 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 33 568 | 3172 | 1 |
| 12.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 33 568 | 4072 | 2 |
| 12.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 32 449 | 4072 | 2 |
| 12.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 31 683 | 4072 | 2 |
| 12.25 | Auto-ataque — sem roubo de vida na build | 98 | 31 585 | 4072 | 2 |
| 12.50 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 31 585 | 4072 | 2 |
| 13.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 30 819 | 4072 | 2 |
| 13.15 | Auto-ataque — sem roubo de vida na build | 98 | 30 721 | 4072 | 2 |
| 13.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 29 135 | 4152 | 2 |
| 13.75 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 1586 | 27 550 | 4231 | 2 |
| 13.95 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 27 550 | 3929 | 2 |
| 14.05 | Auto-ataque — sem roubo de vida na build | 98 | 27 452 | 3929 | 2 |
| 14.95 | Auto-ataque — sem roubo de vida na build | 98 | 27 353 | 3929 | 2 |
| 15.80 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 27 353 | 3627 | 2 |
| 15.85 | Auto-ataque — sem roubo de vida na build | 98 | 27 255 | 3627 | 2 |
| 16.75 | Auto-ataque — sem roubo de vida na build | 98 | 27 157 | 3628 | 2 |
| 16.80 | CHEFE CARREGA Chuva de Fogo (chuva) — aviso de 1.1s [motor.js:3123] |  | 27 157 | 3628 | 2 |
| 17.15 | A Adaga Certeira em Dragão Infernal (atordoa 1s) — recarga que entra 7.65s | 979 | 26 178 | 3628 | 2 |
| 17.15 | CHEFE INTERROMPIDO (chuva) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 26 178 | 3628 | 2 |
| 17.50 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 25 059 | 3628 | 2 |
| 17.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 24 293 | 3628 | 2 |
| 17.65 | Auto-ataque — sem roubo de vida na build | 98 | 24 195 | 3628 | 2 |
| 18.15 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1586 | 22 609 | 3707 | 2 |
| 18.55 | Auto-ataque — sem roubo de vida na build | 98 | 22 511 | 3707 | 2 |
| 18.60 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 20 925 | 3787 | 2 |
| 19.00 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 20 925 | 3485 | 2 |
| 19.45 | Auto-ataque — sem roubo de vida na build | 98 | 20 827 | 3485 | 2 |
| 20.35 | Auto-ataque — sem roubo de vida na build | 98 | 20 729 | 3485 | 2 |
| 20.85 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 20 729 | 3183 | 2 |
| 20.90 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 20 729 | 4083 | 3 |
| 21.25 | Auto-ataque — sem roubo de vida na build | 98 | 20 631 | 4083 | 3 |
| 22.15 | Auto-ataque — sem roubo de vida na build | 98 | 20 532 | 4083 | 3 |
| 22.70 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 20 532 | 3781 | 3 |
| 22.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 19 414 | 3781 | 3 |
| 23.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 18 648 | 3781 | 3 |
| 23.05 | Auto-ataque — sem roubo de vida na build | 98 | 18 549 | 3781 | 3 |
| 23.20 | CHEFE CARREGA Rugido do Dragão (rugido) — aviso de 0.8s [motor.js:3123] |  | 18 549 | 3781 | 3 |
| 23.25 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 18 549 | 3781 | 3 |
| 23.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 16 964 | 3861 | 3 |
| 23.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 16 198 | 3861 | 3 |
| 23.95 | Auto-ataque — sem roubo de vida na build | 98 | 16 100 | 3861 | 3 |
| 24.00 | GOLPE Rugido do Dragão (rugido, x0) (as x1,5 por 5s) |  | 16 100 | 3861 | 3 |
| 24.50 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 1586 | 14 514 | 3940 | 3 |
| 24.85 | A Adaga Certeira em Dragão Infernal (atordoa 1s) — recarga que entra 7.65s | 979 | 13 535 | 3940 | 3 |
| 24.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 12 769 | 3940 | 3 |
| 24.85 | Auto-ataque — sem roubo de vida na build | 98 | 12 671 | 3940 | 3 |
| 25.75 | Auto-ataque — sem roubo de vida na build | 98 | 12 573 | 3941 | 3 |
| 25.85 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1586 | 10 987 | 4020 | 3 |
| 26.35 | Auto-ataque do chefe (magico, 927 AD, as 0.83) | -302 | 10 987 | 3718 | 3 |
| 26.65 | Auto-ataque — sem roubo de vida na build | 98 | 10 889 | 3718 | 3 |
| 27.55 | Auto-ataque — sem roubo de vida na build | 98 | 10 791 | 3718 | 3 |
| 27.60 | Auto-ataque do chefe (magico, 927 AD, as 0.83) | -302 | 10 791 | 3416 | 3 |
| 28.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 9672 | 3416 | 3 |
| 28.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 8906 | 3416 | 3 |
| 28.45 | Auto-ataque — sem roubo de vida na build | 98 | 8807 | 3416 | 3 |
| 28.85 | Auto-ataque do chefe (magico, 927 AD, as 0.83) | -302 | 8807 | 3114 | 3 |
| 28.90 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 8807 | 3414 | 4 |
| 29.10 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 7222 | 3493 | 4 |
| 29.35 | Auto-ataque — sem roubo de vida na build | 98 | 7124 | 3493 | 4 |
| 30.10 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 7124 | 3191 | 4 |
| 30.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 7124 | 4091 | 5 |
| 30.25 | Auto-ataque — sem roubo de vida na build | 98 | 7025 | 4091 | 5 |
| 31.05 | CHEFE CARREGA Sopro de Fogo (sopro) — aviso de 1s [motor.js:3123] |  | 7025 | 4092 | 5 |
| 31.15 | Auto-ataque — sem roubo de vida na build | 98 | 6927 | 4092 | 5 |
| 32.05 | Auto-ataque — sem roubo de vida na build | 98 | 6829 | 4092 | 5 |
| 32.05 | GOLPE Sopro de Fogo (sopro, x2.2) + queimadura 3%/s por 4s | -665 | 6829 | 3427 | 5 |
| 32.25 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 6829 | 4300 | 6 |
| 32.50 | Queimadura do chefe (136/s, resta 3.55s) [motor.js:3105-3108] | -68 | 6829 | 4266 | 6 |
| 32.55 | A Adaga Certeira em Dragão Infernal (atordoa 1s) — recarga que entra 7.65s | 979 | 5850 | 4259 | 6 |
| 32.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 5084 | 4205 | 6 |
| 32.95 | Auto-ataque — sem roubo de vida na build | 98 | 4986 | 4205 | 6 |
| 33.00 | Queimadura do chefe (136/s, resta 3.05s) [motor.js:3105-3108] | -68 | 4986 | 4198 | 6 |
| 33.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 1119 | 3867 | 4164 | 6 |
| 33.50 | Queimadura do chefe (136/s, resta 2.55s) [motor.js:3105-3108] | -68 | 3867 | 4130 | 6 |
| 33.55 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 1586 | 2281 | 4203 | 6 |
| 33.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 766 | 1515 | 4162 | 6 |
| 33.85 | Auto-ataque — sem roubo de vida na build | 98 | 1417 | 4162 | 6 |
| 33.95 | Auto-ataque do chefe (magico, 927 AD, as 0.55) | -302 | 1417 | 3846 | 6 |
| 34.00 | Queimadura do chefe (136/s, resta 2.05s) [motor.js:3105-3108] | -68 | 1417 | 3839 | 6 |
| 34.00 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 1417 | 3839 | 6 |
| 34.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 1586 | 0 | 3871 | 6 |
| 34.35 | ABATE DO CHEFE Dragão Infernal -> Voracidade corta 5s de Q/W/E (cortou 9.14s) [voracidadeChefe, motor.js:736] [motor.js:1789] |  | 0 | 3871 | 6 |

**RESUMO — Dragão Infernal**

| grandeza | valor |
|---|---|
| resultado | MATOU em 34.35 s |
| duração | 34.35 s |
| vida do jogador | min **3114** / 4536 (68.6%) |
| poções | **6** (P1 1, P2 5, P3 0) = **590 g** |
| abates | larvas **0**, chefes **1** |
| recarga cortada pela Voracidade | **5.0 s** em Q/W/E (0 x 1.5 + 1 x 5) [motor.js:1789] |
| dano causado | 54 637 (auto + skills + itens + queima) |
| dano recebido | 6426 |
| cura | roubo de vida 0 + giro 951 + poções 4800 + regeneração 9 |
| procs | Lich 12 (9191 de dano), Liandry 0 (0), Rei 3153 0 (0 de bónus), Luden 0 (0) |
| habilidades lançadas | R x1, A x5, Q x7, W x4 |
| ouro dos abates | 1650 g (sem multiplicadores de VIP/rotina) |
| eventos na linha do tempo | 136 (AUTO 34, HAB 18, HAB_TICK 15, GIRO 15, CHEFE_BASICO 14, PROC 12, QUEIMA 12, CHEFE 9, POCAO 6, ABATE 1) |


---

## Barão Nashor (local barao, nm = [40, 48] [motor.js:354])


### Barão Nashor — nv 42  (nível = max(nm0+2, min(nm1+2, nv+4)) [motor.js:1121])

| grandeza | valor | fonte |
|---|---|---|
| vida máxima | 97 824 | CURVA.hp(42) x 16 [motor.js:273, 280] |
| dano de ataque | 1408 | CURVA.ad(42) x 3.2 [motor.js:273] |
| velocidade de ataque | 0.5/s | [motor.js:280] |
| armadura | 122.4 | CURVA.armadura(42) x 1.8 [motor.js:273] |
| tipo de dano | mágico (bate na RM) | [motor.js:280] |
| rodízio de mecânicas | invocar -> tentaculos -> acido | [motor.js:3080] |
| 1.a mecânica | invocar | [motor.js:3066] |
| fator de nível (dano do monstro) | x2.35 | [motor.js:1184] |
| fator de nível (dano do jogador) | x0.37 | [motor.js:1184] |

Jogador: **4536 HP**, 153 AD, 1051 Poder, 158 armadura, 130 RM, 1.163 ataques/s, 23.46% de recarga, 55% de pen. mágica, 0% de roubo de vida.

Barra (4 espaços, motor.js:900): **W, Q, R, A** — ranks: Q 10, W 1, E 3, R 3, G 1, A 5, F 1.

Build: 3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A — procs LIGADOS: 
  - Lich: próximo auto após habilidade = 75% do Poder [motor.js:1688]
  - Rabadon: +35% do Poder total [motor.js:522]
  - Cajado do Vazio: 40% de penetração mágica [motor.js:529]
  - Ímpeto Cósmico: +15% de recarga (escalado por refino e qualidade) [motor.js:24,255]

| t (s) | evento | dano | vida do chefe | vida do jogador | poções |
|---|---|---:|---:|---:|---:|
| 1.75 | CHEFE CHEGOU (nv 42) |  | 97 824 | 4536 | 0 |
| 1.75 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 97 824 | 4536 | 0 |
| 1.75 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 97 488 | 4536 | 0 |
| 1.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 97 103 | 4536 | 0 |
| 1.75 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 97 103 | 4536 | 0 |
| 1.80 | Lótus da Morte: leva 1/15 em 1 alvo(s) | 128 | 96 975 | 4536 | 0 |
| 2.00 | Lótus da Morte: leva 2/15 em 1 alvo(s) | 128 | 96 847 | 4536 | 0 |
| 2.15 | Lótus da Morte: leva 3/15 em 1 alvo(s) | 128 | 96 719 | 4536 | 0 |
| 2.30 | Lótus da Morte: leva 4/15 em 1 alvo(s) | 128 | 96 591 | 4536 | 0 |
| 2.50 | Lótus da Morte: leva 5/15 em 1 alvo(s) | 128 | 96 463 | 4536 | 0 |
| 2.65 | Lótus da Morte: leva 6/15 em 1 alvo(s) | 128 | 96 334 | 4536 | 0 |
| 2.75 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 95 790 | 4536 | 0 |
| 2.80 | Lótus da Morte: leva 7/15 em 1 alvo(s) | 128 | 95 662 | 4536 | 0 |
| 3.00 | Lótus da Morte: leva 8/15 em 1 alvo(s) | 128 | 95 533 | 4536 | 0 |
| 3.15 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 94 989 | 4536 | 0 |
| 3.15 | Lótus da Morte: leva 9/15 em 1 alvo(s) | 128 | 94 860 | 4536 | 0 |
| 3.30 | Lótus da Morte: leva 10/15 em 1 alvo(s) | 128 | 94 732 | 4536 | 0 |
| 3.50 | Lótus da Morte: leva 11/15 em 1 alvo(s) | 128 | 94 604 | 4536 | 0 |
| 3.55 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 94 059 | 4536 | 0 |
| 3.65 | Lótus da Morte: leva 12/15 em 1 alvo(s) | 128 | 93 931 | 4536 | 0 |
| 3.80 | Lótus da Morte: leva 13/15 em 1 alvo(s) | 128 | 93 803 | 4536 | 0 |
| 4.00 | Lótus da Morte: leva 14/15 em 1 alvo(s) | 128 | 93 675 | 4536 | 0 |
| 4.15 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 128 | 93 547 | 4536 | 0 |
| 4.15 | Lótus da Morte terminou [motor.js:2194] |  | 93 547 | 4536 | 0 |
| 4.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 93 284 | 4536 | 0 |
| 4.15 | Auto-ataque — sem roubo de vida na build | 31 | 93 253 | 4536 | 0 |
| 4.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 93 253 | 3458 | 0 |
| 5.05 | Auto-ataque — sem roubo de vida na build | 31 | 93 223 | 3458 | 0 |
| 5.95 | Auto-ataque — sem roubo de vida na build | 31 | 93 192 | 3458 | 0 |
| 6.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 93 192 | 2379 | 0 |
| 6.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 93 192 | 3279 | 1 |
| 6.75 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.0s [motor.js:3118] |  | 93 192 | 3279 | 1 |
| 6.75 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.3s [motor.js:3118] |  | 93 192 | 3279 | 1 |
| 6.75 | CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120] |  | 93 192 | 3279 | 1 |
| 6.85 | Auto-ataque — sem roubo de vida na build | 31 | 93 161 | 3280 | 1 |
| 7.00 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 92 777 | 3280 | 1 |
| 7.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 92 777 | 4180 | 2 |
| 7.75 | LARVA CHEGOU (nv 36) |  | 92 777 | 4180 | 2 |
| 7.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 92 514 | 4180 | 2 |
| 7.75 | Auto-ataque — sem roubo de vida na build | 31 | 92 483 | 4180 | 2 |
| 8.05 | LARVA CHEGOU (nv 36) |  | 92 483 | 4180 | 2 |
| 8.10 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 91 939 | 4341 | 2 |
| 8.30 | Auto-ataque da larva (368 AD magico) | -174 | 91 939 | 4167 | 2 |
| 8.65 | Auto-ataque — sem roubo de vida na build | 31 | 91 908 | 4167 | 2 |
| 8.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 91 908 | 3088 | 2 |
| 8.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 91 908 | 3388 | 3 |
| 8.80 | Auto-ataque da larva (368 AD magico) | -174 | 91 908 | 3214 | 3 |
| 9.45 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 91 572 | 3214 | 3 |
| 9.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 91 308 | 3214 | 3 |
| 9.55 | Auto-ataque — sem roubo de vida na build | 31 | 91 278 | 3214 | 3 |
| 9.55 | Auto-ataque da larva (368 AD magico) | -174 | 91 278 | 3041 | 3 |
| 9.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 91 278 | 3341 | 4 |
| 10.05 | Auto-ataque da larva (368 AD magico) | -174 | 91 278 | 3167 | 4 |
| 10.45 | Voracidade: giro da adaga (A) em 3 alvo(s) — cura 5% do dano | 3215 | 90 733 | 3328 | 4 |
| 10.45 | Auto-ataque — sem roubo de vida na build | 31 | 90 702 | 3328 | 4 |
| 10.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 90 702 | 4228 | 5 |
| 10.80 | Auto-ataque da larva (368 AD magico) | -174 | 90 702 | 4054 | 5 |
| 11.30 | Auto-ataque da larva (368 AD magico) | -174 | 90 702 | 3880 | 5 |
| 11.35 | Auto-ataque — sem roubo de vida na build | 31 | 90 672 | 3880 | 5 |
| 11.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 90 672 | 2801 | 5 |
| 11.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 90 672 | 3102 | 6 |
| 12.05 | Auto-ataque da larva (368 AD magico) | -174 | 90 672 | 2928 | 6 |
| 12.25 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 90 287 | 2928 | 6 |
| 12.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 90 024 | 2928 | 6 |
| 12.25 | Auto-ataque — sem roubo de vida na build | 31 | 89 994 | 2928 | 6 |
| 12.50 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 89 994 | 2928 | 6 |
| 12.55 | Auto-ataque da larva (368 AD magico) | -174 | 89 994 | 2754 | 6 |
| 12.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 89 994 | 3054 | 7 |
| 13.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 89 731 | 3054 | 7 |
| 13.15 | Auto-ataque — sem roubo de vida na build | 31 | 89 700 | 3054 | 7 |
| 13.30 | Auto-ataque da larva (368 AD magico) | -174 | 89 700 | 2880 | 7 |
| 13.35 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 89 155 | 3041 | 7 |
| 13.35 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 89 155 | 3041 | 7 |
| 13.35 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 89 155 | 3041 | 7 |
| 13.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 89 155 | 1962 | 7 |
| 13.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 89 155 | 2862 | 8 |
| 13.75 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 88 610 | 2890 | 8 |
| 14.05 | Auto-ataque — sem roubo de vida na build | 31 | 88 580 | 2890 | 8 |
| 14.50 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 88 195 | 2890 | 8 |
| 14.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 88 195 | 3190 | 9 |
| 14.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 87 932 | 3190 | 9 |
| 14.95 | Auto-ataque — sem roubo de vida na build | 31 | 87 902 | 3190 | 9 |
| 15.60 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 87 357 | 3217 | 9 |
| 15.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 87 357 | 2139 | 9 |
| 15.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 87 357 | 3039 | 10 |
| 15.85 | Auto-ataque — sem roubo de vida na build | 31 | 87 326 | 3039 | 10 |
| 16.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 87 326 | 3339 | 11 |
| 16.75 | Auto-ataque — sem roubo de vida na build | 31 | 87 296 | 3339 | 11 |
| 17.15 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 86 959 | 3339 | 11 |
| 17.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 86 696 | 3339 | 11 |
| 17.65 | Auto-ataque — sem roubo de vida na build | 31 | 86 666 | 3339 | 11 |
| 17.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 86 666 | 4239 | 12 |
| 18.15 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 86 121 | 4267 | 12 |
| 18.55 | Auto-ataque — sem roubo de vida na build | 31 | 86 090 | 4267 | 12 |
| 18.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 86 090 | 3188 | 12 |
| 18.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 86 090 | 4088 | 13 |
| 19.45 | Auto-ataque — sem roubo de vida na build | 31 | 86 060 | 4088 | 13 |
| 19.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 85 675 | 4088 | 13 |
| 20.25 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 85 675 | 4089 | 13 |
| 20.35 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 85 412 | 4089 | 13 |
| 20.35 | Auto-ataque — sem roubo de vida na build | 31 | 85 381 | 4089 | 13 |
| 20.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 85 381 | 3010 | 13 |
| 20.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 85 381 | 3310 | 14 |
| 20.75 | CHEFE CARREGA Tentáculos do Vazio (tentaculos) — aviso de 1.3s [motor.js:3123] |  | 85 381 | 3310 | 14 |
| 20.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 84 837 | 3337 | 14 |
| 21.25 | Auto-ataque — sem roubo de vida na build | 31 | 84 806 | 3337 | 14 |
| 21.50 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 84 261 | 3365 | 14 |
| 21.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 84 261 | 4265 | 15 |
| 22.05 | GOLPE Tentáculos do Vazio (tentaculos, x2.6) | -2500 | 84 261 | 1764 | 15 |
| 22.15 | Auto-ataque — sem roubo de vida na build | 31 | 84 231 | 1764 | 15 |
| 22.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 84 231 | 2665 | 16 |
| 23.05 | Auto-ataque — sem roubo de vida na build | 31 | 84 200 | 2665 | 16 |
| 23.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 84 200 | 2965 | 17 |
| 23.95 | Auto-ataque — sem roubo de vida na build | 31 | 84 170 | 2965 | 17 |
| 24.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 84 170 | 1886 | 17 |
| 24.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 84 170 | 2786 | 18 |
| 24.85 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 83 833 | 2786 | 18 |
| 24.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 83 570 | 2786 | 18 |
| 24.85 | Auto-ataque — sem roubo de vida na build | 31 | 83 539 | 2786 | 18 |
| 25.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 83 155 | 2787 | 18 |
| 25.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 83 155 | 3087 | 19 |
| 25.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 82 892 | 3087 | 19 |
| 25.75 | Auto-ataque — sem roubo de vida na build | 31 | 82 861 | 3087 | 19 |
| 25.85 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 82 317 | 3114 | 19 |
| 26.25 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 81 772 | 3141 | 19 |
| 26.65 | Auto-ataque — sem roubo de vida na build | 31 | 81 741 | 3141 | 19 |
| 26.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 81 741 | 3442 | 20 |
| 27.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 81 741 | 2363 | 20 |
| 27.55 | Auto-ataque — sem roubo de vida na build | 31 | 81 711 | 2363 | 20 |
| 27.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 81 711 | 3263 | 21 |
| 28.45 | Auto-ataque — sem roubo de vida na build | 31 | 81 680 | 3263 | 21 |
| 28.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 81 680 | 4163 | 22 |
| 29.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 81 680 | 3085 | 22 |
| 29.35 | Auto-ataque — sem roubo de vida na build | 31 | 81 649 | 3085 | 22 |
| 29.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 81 649 | 3385 | 23 |
| 30.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 81 265 | 3385 | 23 |
| 30.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 81 002 | 3385 | 23 |
| 30.25 | Auto-ataque — sem roubo de vida na build | 31 | 80 971 | 3385 | 23 |
| 30.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 80 971 | 4285 | 24 |
| 31.00 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 80 971 | 4285 | 24 |
| 31.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 80 971 | 3207 | 24 |
| 31.10 | CHEFE CARREGA Ácido Corrosivo (acido) — aviso de 1s [motor.js:3123] |  | 80 971 | 3207 | 24 |
| 31.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 80 708 | 3207 | 24 |
| 31.15 | Auto-ataque — sem roubo de vida na build | 31 | 80 677 | 3207 | 24 |
| 31.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 80 133 | 3234 | 24 |
| 31.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 80 133 | 4134 | 25 |
| 32.05 | Auto-ataque — sem roubo de vida na build | 31 | 80 102 | 4134 | 25 |
| 32.10 | GOLPE Ácido Corrosivo (acido, x1.2) + queimadura 2,8%/s por 5s | -1295 | 80 102 | 2840 | 25 |
| 32.25 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 79 557 | 2848 | 25 |
| 32.55 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 79 221 | 2810 | 25 |
| 32.60 | Queimadura do chefe (127/s, resta 4.50s) [motor.js:3105-3108] | -64 | 79 221 | 2803 | 25 |
| 32.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 79 221 | 3084 | 26 |
| 32.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 78 958 | 3059 | 26 |
| 32.95 | Auto-ataque — sem roubo de vida na build | 31 | 78 927 | 3059 | 26 |
| 33.10 | Queimadura do chefe (127/s, resta 4.00s) [motor.js:3105-3108] | -64 | 78 927 | 3040 | 26 |
| 33.55 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 78 382 | 3010 | 26 |
| 33.60 | Queimadura do chefe (127/s, resta 3.50s) [motor.js:3105-3108] | -64 | 78 382 | 3004 | 26 |
| 33.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 78 382 | 3285 | 27 |
| 33.85 | Auto-ataque — sem roubo de vida na build | 31 | 78 352 | 3272 | 27 |
| 34.10 | Queimadura do chefe (127/s, resta 3.00s) [motor.js:3105-3108] | -64 | 78 352 | 3241 | 27 |
| 34.60 | Queimadura do chefe (127/s, resta 2.50s) [motor.js:3105-3108] | -64 | 78 352 | 3177 | 27 |
| 34.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 78 352 | 4058 | 28 |
| 34.75 | Auto-ataque — sem roubo de vida na build | 31 | 78 321 | 4058 | 28 |
| 35.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 78 321 | 2948 | 28 |
| 35.10 | Queimadura do chefe (127/s, resta 2.00s) [motor.js:3105-3108] | -64 | 78 321 | 2935 | 28 |
| 35.50 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 77 937 | 2884 | 28 |
| 35.60 | Queimadura do chefe (127/s, resta 1.50s) [motor.js:3105-3108] | -64 | 77 937 | 2872 | 28 |
| 35.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 77 674 | 2865 | 28 |
| 35.65 | Auto-ataque — sem roubo de vida na build | 31 | 77 643 | 2865 | 28 |
| 35.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 77 643 | 3153 | 29 |
| 36.10 | Queimadura do chefe (127/s, resta 1.00s) [motor.js:3105-3108] | -64 | 77 643 | 3108 | 29 |
| 36.55 | Auto-ataque — sem roubo de vida na build | 31 | 77 613 | 3051 | 29 |
| 36.60 | Queimadura do chefe (127/s, resta 0.50s) [motor.js:3105-3108] | -64 | 77 613 | 3045 | 29 |
| 36.60 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 77 068 | 3072 | 29 |
| 36.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 77 068 | 3353 | 30 |
| 37.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 77 068 | 2243 | 30 |
| 37.10 | Queimadura do chefe (127/s, resta 0.00s) [motor.js:3105-3108] | -64 | 77 068 | 2230 | 30 |
| 37.45 | Auto-ataque — sem roubo de vida na build | 31 | 77 037 | 2224 | 30 |
| 37.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 77 037 | 3124 | 31 |
| 38.35 | Auto-ataque — sem roubo de vida na build | 31 | 77 007 | 3124 | 31 |
| 38.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 77 007 | 3424 | 32 |
| 39.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 77 007 | 2346 | 32 |
| 39.25 | Auto-ataque — sem roubo de vida na build | 31 | 76 976 | 2346 | 32 |
| 39.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 76 976 | 3246 | 33 |
| 40.15 | Auto-ataque — sem roubo de vida na build | 31 | 76 945 | 3246 | 33 |
| 40.25 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 76 609 | 3246 | 33 |
| 40.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 76 609 | 4146 | 34 |
| 40.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 76 225 | 4146 | 34 |
| 41.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 75 961 | 4146 | 34 |
| 41.05 | Auto-ataque — sem roubo de vida na build | 31 | 75 931 | 4146 | 34 |
| 41.15 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.0s [motor.js:3118] |  | 75 931 | 4146 | 34 |
| 41.15 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.3s [motor.js:3118] |  | 75 931 | 4146 | 34 |
| 41.15 | CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120] |  | 75 931 | 4146 | 34 |
| 41.25 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 75 386 | 4174 | 34 |
| 41.75 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 75 386 | 4174 | 34 |
| 41.85 | Voracidade: giro da adaga (Q) em 2 alvo(s) — cura 5% do dano | 1880 | 74 841 | 4268 | 34 |
| 41.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 74 578 | 4268 | 34 |
| 41.95 | Auto-ataque — sem roubo de vida na build | 31 | 74 548 | 4268 | 34 |
| 42.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 74 548 | 3189 | 34 |
| 42.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 74 548 | 4089 | 35 |
| 42.15 | LARVA CHEGOU (nv 36) |  | 74 548 | 4089 | 35 |
| 42.45 | LARVA CHEGOU (nv 36) |  | 74 548 | 4089 | 35 |
| 42.80 | Auto-ataque da larva (368 AD magico) | -174 | 74 548 | 3915 | 35 |
| 42.85 | Auto-ataque — sem roubo de vida na build | 31 | 74 517 | 3915 | 35 |
| 43.00 | Voracidade: giro da adaga (W) em 3 alvo(s) — cura 5% do dano | 3215 | 73 972 | 4076 | 35 |
| 43.25 | Auto-ataque da larva (368 AD magico) | -174 | 73 972 | 3902 | 35 |
| 43.75 | Auto-ataque — sem roubo de vida na build | 31 | 73 942 | 3902 | 35 |
| 43.85 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 73 942 | 3902 | 35 |
| 43.90 | Lótus da Morte: leva 1/15 em 3 alvo(s) | 756 | 73 814 | 3902 | 35 |
| 44.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 73 814 | 2824 | 35 |
| 44.05 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 73 814 | 3124 | 36 |
| 44.05 | Auto-ataque da larva (368 AD magico) | -174 | 73 814 | 2950 | 36 |
| 44.10 | Lótus da Morte: leva 2/15 em 3 alvo(s) | 756 | 73 685 | 2950 | 36 |
| 44.25 | Lótus da Morte: leva 3/15 em 3 alvo(s) | 756 | 73 557 | 2950 | 36 |
| 44.40 | Lótus da Morte: leva 4/15 em 3 alvo(s) | 756 | 73 429 | 2950 | 36 |
| 44.50 | Auto-ataque da larva (368 AD magico) | -174 | 73 429 | 2776 | 36 |
| 44.60 | Lótus da Morte: leva 5/15 em 3 alvo(s) | 756 | 73 301 | 2776 | 36 |
| 44.75 | Lótus da Morte: leva 6/15 em 3 alvo(s) | 756 | 73 173 | 2776 | 36 |
| 44.90 | Lótus da Morte: leva 7/15 em 3 alvo(s) | 756 | 73 045 | 2776 | 36 |
| 45.05 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 73 045 | 3076 | 37 |
| 45.10 | Lótus da Morte: leva 8/15 em 3 alvo(s) | 756 | 72 917 | 3076 | 37 |
| 45.25 | Lótus da Morte: leva 9/15 em 3 alvo(s) | 756 | 72 789 | 3076 | 37 |
| 45.30 | Auto-ataque da larva (368 AD magico) | -174 | 72 789 | 2902 | 37 |
| 45.40 | Lótus da Morte: leva 10/15 em 3 alvo(s) | 756 | 72 660 | 2902 | 37 |
| 45.40 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 2.09s) [motor.js:1789] |  | 72 660 | 2902 | 37 |
| 45.60 | Lótus da Morte: leva 11/15 em 2 alvo(s) | 442 | 72 532 | 2903 | 37 |
| 45.75 | Lótus da Morte: leva 12/15 em 2 alvo(s) | 442 | 72 404 | 2903 | 37 |
| 45.90 | Lótus da Morte: leva 13/15 em 2 alvo(s) | 442 | 72 276 | 2903 | 37 |
| 46.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 72 276 | 1824 | 37 |
| 46.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 72 276 | 2724 | 38 |
| 46.10 | Lótus da Morte: leva 14/15 em 2 alvo(s) | 442 | 72 148 | 2724 | 38 |
| 46.10 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 1.50s) [motor.js:1789] |  | 72 148 | 2724 | 38 |
| 46.25 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 128 | 72 020 | 2724 | 38 |
| 46.25 | Lótus da Morte terminou [motor.js:2194] |  | 72 020 | 2724 | 38 |
| 46.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 71 635 | 2724 | 38 |
| 47.05 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 71 635 | 3024 | 39 |
| 47.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 71 372 | 3024 | 39 |
| 47.05 | Auto-ataque — sem roubo de vida na build | 31 | 71 342 | 3024 | 39 |
| 47.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 70 797 | 3052 | 39 |
| 47.95 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 70 460 | 3052 | 39 |
| 47.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 70 197 | 3052 | 39 |
| 47.95 | Auto-ataque — sem roubo de vida na build | 31 | 70 167 | 3052 | 39 |
| 48.05 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 70 167 | 3352 | 40 |
| 48.85 | Auto-ataque — sem roubo de vida na build | 31 | 70 136 | 3352 | 40 |
| 48.95 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 69 591 | 3379 | 40 |
| 49.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 69 591 | 2300 | 40 |
| 49.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 69 591 | 3201 | 41 |
| 49.50 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 69 591 | 3201 | 41 |
| 49.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 69 328 | 3201 | 41 |
| 49.75 | Auto-ataque — sem roubo de vida na build | 31 | 69 298 | 3201 | 41 |
| 50.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 69 298 | 4101 | 42 |
| 50.65 | Auto-ataque — sem roubo de vida na build | 31 | 69 267 | 4101 | 42 |
| 50.75 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 68 722 | 4128 | 42 |
| 51.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 68 722 | 3050 | 42 |
| 51.05 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 68 722 | 3350 | 43 |
| 51.50 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 68 338 | 3350 | 43 |
| 51.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 68 075 | 3350 | 43 |
| 51.55 | Auto-ataque — sem roubo de vida na build | 31 | 68 044 | 3350 | 43 |
| 52.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 68 044 | 4250 | 44 |
| 52.45 | Auto-ataque — sem roubo de vida na build | 31 | 68 013 | 4250 | 44 |
| 52.60 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 67 469 | 4277 | 44 |
| 53.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 67 469 | 3199 | 44 |
| 53.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 67 469 | 4099 | 45 |
| 53.35 | Auto-ataque — sem roubo de vida na build | 31 | 67 438 | 4099 | 45 |
| 54.25 | Auto-ataque — sem roubo de vida na build | 31 | 67 408 | 4099 | 45 |
| 55.00 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 67 408 | 3020 | 45 |
| 55.05 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 67 408 | 3320 | 46 |
| 55.15 | Auto-ataque — sem roubo de vida na build | 31 | 67 377 | 3321 | 46 |
| 55.15 | CHEFE CARREGA Tentáculos do Vazio (tentaculos) — aviso de 1.3s [motor.js:3123] |  | 67 377 | 3321 | 46 |
| 55.65 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 67 041 | 3321 | 46 |
| 55.65 | CHEFE INTERROMPIDO (tentaculos) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 67 041 | 3321 | 46 |
| 56.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 67 041 | 4221 | 47 |
| 56.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 66 777 | 4221 | 47 |
| 56.05 | Auto-ataque — sem roubo de vida na build | 31 | 66 747 | 4221 | 47 |
| 56.65 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 66 202 | 4248 | 47 |
| 56.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 65 818 | 4248 | 47 |
| 56.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 65 554 | 4248 | 47 |
| 56.95 | Auto-ataque — sem roubo de vida na build | 31 | 65 524 | 4248 | 47 |
| 57.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 64 979 | 4276 | 47 |
| 57.85 | Auto-ataque — sem roubo de vida na build | 31 | 64 948 | 4276 | 47 |
| 58.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 64 948 | 3197 | 47 |
| 58.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 64 948 | 4097 | 48 |
| 58.75 | Auto-ataque — sem roubo de vida na build | 31 | 64 918 | 4097 | 48 |
| 59.65 | Auto-ataque — sem roubo de vida na build | 31 | 64 887 | 4098 | 48 |
| 60.25 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 64 887 | 4098 | 48 |
| 60.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 64 887 | 3019 | 48 |
| 60.55 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 64 887 | 3319 | 49 |
| 60.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 64 624 | 3319 | 49 |
| 60.55 | Auto-ataque — sem roubo de vida na build | 31 | 64 594 | 3319 | 49 |
| 61.45 | Auto-ataque — sem roubo de vida na build | 31 | 64 563 | 3319 | 49 |
| 61.50 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 64 018 | 3347 | 49 |
| 61.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 64 018 | 4247 | 50 |
| 61.70 | CHEFE CARREGA Ácido Corrosivo (acido) — aviso de 1s [motor.js:3123] |  | 64 018 | 4247 | 50 |
| 62.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 63 634 | 4247 | 50 |
| 62.35 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 63 371 | 4247 | 50 |
| 62.35 | Auto-ataque — sem roubo de vida na build | 31 | 63 340 | 4247 | 50 |
| 62.70 | GOLPE Ácido Corrosivo (acido, x1.2) + queimadura 2,8%/s por 5s | -1295 | 63 340 | 2952 | 50 |
| 62.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 63 340 | 3246 | 51 |
| 63.10 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 62 795 | 3229 | 51 |
| 63.15 | Queimadura do chefe (127/s, resta 4.55s) [motor.js:3105-3108] | -64 | 62 795 | 3223 | 51 |
| 63.25 | Auto-ataque — sem roubo de vida na build | 31 | 62 765 | 3210 | 51 |
| 63.35 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 62 428 | 3197 | 51 |
| 63.65 | Queimadura do chefe (127/s, resta 4.05s) [motor.js:3105-3108] | -64 | 62 428 | 3159 | 51 |
| 63.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 62 428 | 3447 | 52 |
| 64.15 | Queimadura do chefe (127/s, resta 3.55s) [motor.js:3105-3108] | -64 | 62 428 | 3396 | 52 |
| 64.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 62 165 | 3396 | 52 |
| 64.15 | Auto-ataque — sem roubo de vida na build | 31 | 62 135 | 3396 | 52 |
| 64.35 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 61 590 | 3398 | 52 |
| 64.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 61 590 | 2300 | 52 |
| 64.65 | Queimadura do chefe (127/s, resta 3.05s) [motor.js:3105-3108] | -64 | 61 590 | 2281 | 52 |
| 64.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 61 590 | 3168 | 53 |
| 65.05 | Auto-ataque — sem roubo de vida na build | 31 | 61 559 | 3130 | 53 |
| 65.15 | Queimadura do chefe (127/s, resta 2.55s) [motor.js:3105-3108] | -64 | 61 559 | 3118 | 53 |
| 65.65 | Queimadura do chefe (127/s, resta 2.05s) [motor.js:3105-3108] | -64 | 61 559 | 3054 | 53 |
| 65.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 61 559 | 3342 | 54 |
| 65.95 | Auto-ataque — sem roubo de vida na build | 31 | 61 529 | 3316 | 54 |
| 66.15 | Queimadura do chefe (127/s, resta 1.55s) [motor.js:3105-3108] | -64 | 61 529 | 3291 | 54 |
| 66.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 61 529 | 2168 | 54 |
| 66.65 | Queimadura do chefe (127/s, resta 1.05s) [motor.js:3105-3108] | -64 | 61 529 | 2149 | 54 |
| 66.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 61 529 | 3036 | 55 |
| 66.85 | Auto-ataque — sem roubo de vida na build | 31 | 61 498 | 3024 | 55 |
| 67.15 | Queimadura do chefe (127/s, resta 0.55s) [motor.js:3105-3108] | -64 | 61 498 | 2986 | 55 |
| 67.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 61 114 | 2973 | 55 |
| 67.65 | Queimadura do chefe (127/s, resta 0.05s) [motor.js:3105-3108] | -64 | 61 114 | 2922 | 55 |
| 67.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 61 114 | 3209 | 56 |
| 67.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 60 850 | 3209 | 56 |
| 67.75 | Auto-ataque — sem roubo de vida na build | 31 | 60 820 | 3209 | 56 |
| 68.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 60 275 | 3237 | 56 |
| 68.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 60 275 | 2158 | 56 |
| 68.65 | Auto-ataque — sem roubo de vida na build | 31 | 60 245 | 2158 | 56 |
| 68.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 60 245 | 3058 | 57 |
| 69.55 | Auto-ataque — sem roubo de vida na build | 31 | 60 214 | 3059 | 57 |
| 69.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 60 214 | 3359 | 58 |
| 70.45 | Auto-ataque — sem roubo de vida na build | 31 | 60 183 | 3359 | 58 |
| 70.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 60 183 | 2280 | 58 |
| 70.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 60 183 | 3180 | 59 |
| 71.00 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 60 183 | 3180 | 59 |
| 71.05 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 59 847 | 3180 | 59 |
| 71.35 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 59 584 | 3180 | 59 |
| 71.35 | Auto-ataque — sem roubo de vida na build | 31 | 59 553 | 3180 | 59 |
| 71.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 59 553 | 4080 | 60 |
| 71.75 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.0s [motor.js:3118] |  | 59 553 | 4080 | 60 |
| 71.75 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.3s [motor.js:3118] |  | 59 553 | 4080 | 60 |
| 71.75 | CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120] |  | 59 553 | 4080 | 60 |
| 72.05 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 59 008 | 4108 | 60 |
| 72.25 | Auto-ataque — sem roubo de vida na build | 31 | 58 978 | 4108 | 60 |
| 72.45 | Voracidade: giro da adaga (W) em 2 alvo(s) — cura 5% do dano | 1880 | 58 433 | 4202 | 60 |
| 72.50 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 58 049 | 4202 | 60 |
| 72.75 | LARVA CHEGOU (nv 36) |  | 58 049 | 4202 | 60 |
| 72.75 | Auto-ataque da larva (368 AD magico) | -174 | 58 049 | 4028 | 60 |
| 73.05 | LARVA CHEGOU (nv 36) |  | 58 049 | 4028 | 60 |
| 73.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 57 785 | 4028 | 60 |
| 73.15 | Auto-ataque — sem roubo de vida na build | 31 | 57 755 | 4028 | 60 |
| 73.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 57 755 | 2949 | 60 |
| 73.55 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 57 755 | 3250 | 61 |
| 73.60 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 57 210 | 3410 | 61 |
| 73.80 | Auto-ataque da larva (368 AD magico) | -174 | 57 210 | 3236 | 61 |
| 74.00 | Auto-ataque da larva (368 AD magico) | -174 | 57 210 | 3063 | 61 |
| 74.05 | Auto-ataque — sem roubo de vida na build | 31 | 57 180 | 3063 | 61 |
| 74.55 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 57 180 | 3363 | 62 |
| 74.95 | Auto-ataque — sem roubo de vida na build | 31 | 57 149 | 3363 | 62 |
| 75.05 | Auto-ataque da larva (368 AD magico) | -174 | 57 149 | 3189 | 62 |
| 75.25 | Auto-ataque da larva (368 AD magico) | -174 | 57 149 | 3015 | 62 |
| 75.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 57 149 | 1936 | 62 |
| 75.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 57 149 | 2836 | 63 |
| 75.85 | Auto-ataque — sem roubo de vida na build | 31 | 57 118 | 2837 | 63 |
| 76.30 | Auto-ataque da larva (368 AD magico) | -174 | 57 118 | 2663 | 63 |
| 76.50 | Auto-ataque da larva (368 AD magico) | -174 | 57 118 | 2489 | 63 |
| 76.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 57 118 | 3389 | 64 |
| 76.75 | Auto-ataque — sem roubo de vida na build | 31 | 57 088 | 3389 | 64 |
| 77.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 57 088 | 2310 | 64 |
| 77.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 57 088 | 3211 | 65 |
| 77.55 | Auto-ataque da larva (368 AD magico) | -174 | 57 088 | 3037 | 65 |
| 77.65 | Auto-ataque — sem roubo de vida na build | 31 | 57 057 | 3037 | 65 |
| 77.75 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 56 673 | 3037 | 65 |
| 77.75 | Auto-ataque da larva (368 AD magico) | -174 | 56 673 | 2863 | 65 |
| 78.55 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 56 673 | 3163 | 66 |
| 78.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 56 410 | 3163 | 66 |
| 78.55 | Auto-ataque — sem roubo de vida na build | 31 | 56 379 | 3163 | 66 |
| 78.75 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 56 043 | 3163 | 66 |
| 78.80 | Auto-ataque da larva (368 AD magico) | -174 | 56 043 | 2989 | 66 |
| 78.85 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 55 498 | 3150 | 66 |
| 78.85 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 55 498 | 3150 | 66 |
| 79.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 55 235 | 3150 | 66 |
| 79.45 | Auto-ataque — sem roubo de vida na build | 31 | 55 204 | 3150 | 66 |
| 79.55 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 55 204 | 3450 | 67 |
| 79.75 | Voracidade: giro da adaga (A) em 2 alvo(s) — cura 5% do dano | 1880 | 54 659 | 3544 | 67 |
| 79.75 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 1.97s) [motor.js:1789] |  | 54 659 | 3544 | 67 |
| 79.80 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 54 659 | 3544 | 67 |
| 80.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 54 275 | 3544 | 67 |
| 80.35 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 54 012 | 3544 | 67 |
| 80.35 | Auto-ataque — sem roubo de vida na build | 31 | 53 981 | 3544 | 67 |
| 80.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 53 981 | 2466 | 67 |
| 80.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 53 981 | 3366 | 68 |
| 81.05 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 53 436 | 3393 | 68 |
| 81.25 | Auto-ataque — sem roubo de vida na build | 31 | 53 406 | 3393 | 68 |
| 81.45 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 52 861 | 3420 | 68 |
| 82.15 | Auto-ataque — sem roubo de vida na build | 31 | 52 830 | 3421 | 68 |
| 82.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 52 830 | 2342 | 68 |
| 82.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 52 830 | 3242 | 69 |
| 83.05 | Auto-ataque — sem roubo de vida na build | 31 | 52 800 | 3242 | 69 |
| 83.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 52 800 | 4142 | 70 |
| 83.95 | Auto-ataque — sem roubo de vida na build | 31 | 52 769 | 4142 | 70 |
| 84.50 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 52 769 | 3064 | 70 |
| 84.55 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 52 769 | 3364 | 71 |
| 84.85 | Auto-ataque — sem roubo de vida na build | 31 | 52 739 | 3364 | 71 |
| 85.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 52 354 | 3364 | 71 |
| 85.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 52 354 | 4264 | 72 |
| 85.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 52 091 | 4264 | 72 |
| 85.75 | Auto-ataque — sem roubo de vida na build | 31 | 52 061 | 4264 | 72 |
| 85.75 | CHEFE CARREGA Tentáculos do Vazio (tentaculos) — aviso de 1.3s [motor.js:3123] |  | 52 061 | 4264 | 72 |
| 85.95 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 52 061 | 4264 | 72 |
| 86.00 | Lótus da Morte: leva 1/15 em 1 alvo(s) | 128 | 51 932 | 4264 | 72 |
| 86.20 | Lótus da Morte: leva 2/15 em 1 alvo(s) | 128 | 51 804 | 4264 | 72 |
| 86.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 51 260 | 4292 | 72 |
| 86.35 | Lótus da Morte: leva 3/15 em 1 alvo(s) | 128 | 51 131 | 4292 | 72 |
| 86.50 | Lótus da Morte: leva 4/15 em 1 alvo(s) | 128 | 51 003 | 4292 | 72 |
| 86.70 | Lótus da Morte: leva 5/15 em 1 alvo(s) | 128 | 50 875 | 4292 | 72 |
| 86.85 | Lótus da Morte: leva 6/15 em 1 alvo(s) | 128 | 50 747 | 4292 | 72 |
| 87.00 | Lótus da Morte: leva 7/15 em 1 alvo(s) | 128 | 50 619 | 4292 | 72 |
| 87.05 | GOLPE Tentáculos do Vazio (tentaculos, x2.6) | -2500 | 50 619 | 1791 | 72 |
| 87.10 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 50 619 | 2691 | 73 |
| 87.20 | Lótus da Morte: leva 8/15 em 1 alvo(s) | 128 | 50 491 | 2691 | 73 |
| 87.35 | Lótus da Morte: leva 9/15 em 1 alvo(s) | 128 | 50 363 | 2691 | 73 |
| 87.50 | Lótus da Morte: leva 10/15 em 1 alvo(s) | 128 | 50 235 | 2692 | 73 |
| 87.70 | Lótus da Morte: leva 11/15 em 1 alvo(s) | 128 | 50 106 | 2692 | 73 |
| 87.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 50 106 | 1613 | 73 |
| 87.85 | Lótus da Morte: leva 12/15 em 1 alvo(s) | 128 | 49 978 | 1613 | 73 |
| 88.00 | Lótus da Morte: leva 13/15 em 1 alvo(s) | 128 | 49 850 | 1613 | 73 |
| 88.10 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 49 850 | 2513 | 74 |
| 88.20 | Lótus da Morte: leva 14/15 em 1 alvo(s) | 128 | 49 722 | 2513 | 74 |
| 88.35 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 128 | 49 594 | 2513 | 74 |
| 88.35 | Lótus da Morte terminou [motor.js:2194] |  | 49 594 | 2513 | 74 |
| 88.35 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 49 257 | 2513 | 74 |
| 89.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 48 994 | 2513 | 74 |
| 89.05 | Auto-ataque — sem roubo de vida na build | 31 | 48 964 | 2513 | 74 |
| 89.10 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 48 964 | 3413 | 75 |
| 89.35 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 48 419 | 3441 | 75 |
| 89.95 | Auto-ataque — sem roubo de vida na build | 31 | 48 388 | 3441 | 75 |
| 90.50 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 48 004 | 3441 | 75 |
| 90.55 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 48 004 | 3441 | 75 |
| 90.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 48 004 | 2362 | 75 |
| 90.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 48 004 | 3262 | 76 |
| 90.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 47 741 | 3262 | 76 |
| 90.85 | Auto-ataque — sem roubo de vida na build | 31 | 47 710 | 3262 | 76 |
| 91.60 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 47 165 | 3290 | 76 |
| 91.75 | Auto-ataque — sem roubo de vida na build | 31 | 47 135 | 3290 | 76 |
| 91.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 47 135 | 4190 | 77 |
| 92.00 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 46 590 | 4217 | 77 |
| 92.65 | Auto-ataque — sem roubo de vida na build | 31 | 46 560 | 4217 | 77 |
| 92.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 46 560 | 3139 | 77 |
| 92.85 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 46 560 | 3439 | 78 |
| 93.55 | Auto-ataque — sem roubo de vida na build | 31 | 46 529 | 3439 | 78 |
| 94.45 | Auto-ataque — sem roubo de vida na build | 31 | 46 498 | 3439 | 78 |
| 94.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 46 498 | 2360 | 78 |
| 94.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 46 498 | 3260 | 79 |
| 95.35 | Auto-ataque — sem roubo de vida na build | 31 | 46 468 | 3261 | 79 |
| 95.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 46 083 | 3261 | 79 |
| 95.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 46 083 | 4161 | 80 |
| 96.05 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 45 747 | 4161 | 80 |
| 96.10 | CHEFE CARREGA Ácido Corrosivo (acido) — aviso de 1s [motor.js:3123] |  | 45 747 | 4161 | 80 |
| 96.15 | CHEFE INTERROMPIDO (acido) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 45 747 | 4161 | 80 |
| 96.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 45 484 | 4161 | 80 |
| 96.25 | Auto-ataque — sem roubo de vida na build | 31 | 45 453 | 4161 | 80 |
| 96.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 44 908 | 4188 | 80 |
| 97.15 | Auto-ataque — sem roubo de vida na build | 31 | 44 878 | 4188 | 80 |
| 97.25 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 44 333 | 4216 | 80 |
| 97.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 44 333 | 3137 | 80 |
| 97.85 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 44 333 | 3437 | 81 |
| 98.05 | Auto-ataque — sem roubo de vida na build | 31 | 44 302 | 3437 | 81 |
| 98.95 | Auto-ataque — sem roubo de vida na build | 31 | 44 272 | 3437 | 81 |
| 99.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 44 272 | 2359 | 81 |
| 99.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 44 272 | 3259 | 82 |
| 99.85 | Auto-ataque — sem roubo de vida na build | 31 | 44 241 | 3259 | 82 |
| 100.75 | Auto-ataque — sem roubo de vida na build | 31 | 44 211 | 3259 | 82 |
| 100.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 44 211 | 4159 | 83 |
| 101.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 43 826 | 4159 | 83 |
| 101.30 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 43 826 | 4159 | 83 |
| 101.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 43 563 | 4159 | 83 |
| 101.65 | Auto-ataque — sem roubo de vida na build | 31 | 43 533 | 4159 | 83 |
| 101.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 43 533 | 3081 | 83 |
| 101.85 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 43 533 | 3381 | 84 |
| 102.10 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 42 988 | 3408 | 84 |
| 102.20 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.0s [motor.js:3118] |  | 42 988 | 3408 | 84 |
| 102.20 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.3s [motor.js:3118] |  | 42 988 | 3408 | 84 |
| 102.20 | CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120] |  | 42 988 | 3408 | 84 |
| 102.55 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 42 443 | 3435 | 84 |
| 102.55 | Auto-ataque — sem roubo de vida na build | 31 | 42 412 | 3435 | 84 |
| 103.20 | LARVA CHEGOU (nv 36) |  | 42 412 | 3436 | 84 |
| 103.45 | Auto-ataque — sem roubo de vida na build | 31 | 42 382 | 3436 | 84 |
| 103.50 | LARVA CHEGOU (nv 36) |  | 42 382 | 3436 | 84 |
| 103.75 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 42 045 | 3436 | 84 |
| 103.75 | Auto-ataque da larva (368 AD magico) | -174 | 42 045 | 3262 | 84 |
| 103.80 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 42 045 | 4162 | 85 |
| 103.80 | Auto-ataque da larva (368 AD magico) | -174 | 42 045 | 3988 | 85 |
| 104.35 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 41 782 | 3988 | 85 |
| 104.35 | Auto-ataque — sem roubo de vida na build | 31 | 41 752 | 3988 | 85 |
| 104.75 | Voracidade: giro da adaga (A) em 3 alvo(s) — cura 5% do dano | 3215 | 41 207 | 4149 | 85 |
| 104.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 41 207 | 3070 | 85 |
| 104.85 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 41 207 | 3370 | 86 |
| 105.00 | Auto-ataque da larva (368 AD magico) | -174 | 41 207 | 3196 | 86 |
| 105.05 | Auto-ataque da larva (368 AD magico) | -174 | 41 207 | 3023 | 86 |
| 105.25 | Auto-ataque — sem roubo de vida na build | 31 | 41 176 | 3023 | 86 |
| 105.85 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 41 176 | 3323 | 87 |
| 106.15 | Auto-ataque — sem roubo de vida na build | 31 | 41 146 | 3323 | 87 |
| 106.25 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 40 761 | 3323 | 87 |
| 106.25 | Auto-ataque da larva (368 AD magico) | -174 | 40 761 | 3149 | 87 |
| 106.30 | Auto-ataque da larva (368 AD magico) | -174 | 40 761 | 2975 | 87 |
| 106.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 40 761 | 1896 | 87 |
| 106.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 40 761 | 2796 | 88 |
| 107.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 40 498 | 2797 | 88 |
| 107.05 | Auto-ataque — sem roubo de vida na build | 31 | 40 468 | 2797 | 88 |
| 107.35 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 39 923 | 2957 | 88 |
| 107.50 | Auto-ataque da larva (368 AD magico) | -174 | 39 923 | 2783 | 88 |
| 107.55 | Auto-ataque da larva (368 AD magico) | -174 | 39 923 | 2610 | 88 |
| 107.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 39 923 | 3510 | 89 |
| 107.95 | Auto-ataque — sem roubo de vida na build | 31 | 39 892 | 3510 | 89 |
| 108.75 | Auto-ataque da larva (368 AD magico) | -174 | 39 892 | 3336 | 89 |
| 108.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 39 892 | 2257 | 89 |
| 108.80 | Auto-ataque da larva (368 AD magico) | -174 | 39 892 | 2083 | 89 |
| 108.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 39 892 | 2983 | 90 |
| 108.85 | Auto-ataque — sem roubo de vida na build | 31 | 39 862 | 2983 | 90 |
| 109.75 | Auto-ataque — sem roubo de vida na build | 31 | 39 831 | 2984 | 90 |
| 109.85 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 39 831 | 3284 | 91 |
| 110.00 | Auto-ataque da larva (368 AD magico) | -174 | 39 831 | 3110 | 91 |
| 110.05 | Auto-ataque da larva (368 AD magico) | -174 | 39 831 | 2936 | 91 |
| 110.65 | Auto-ataque — sem roubo de vida na build | 31 | 39 800 | 2936 | 91 |
| 110.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 39 800 | 1857 | 91 |
| 110.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 39 800 | 2757 | 92 |
| 111.25 | Auto-ataque da larva (368 AD magico) | -174 | 39 800 | 2584 | 92 |
| 111.30 | Auto-ataque da larva (368 AD magico) | -174 | 39 800 | 2410 | 92 |
| 111.45 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 39 464 | 2410 | 92 |
| 111.50 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 39 080 | 2410 | 92 |
| 111.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 38 816 | 2410 | 92 |
| 111.55 | Auto-ataque — sem roubo de vida na build | 31 | 38 786 | 2410 | 92 |
| 111.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 38 786 | 3310 | 93 |
| 112.05 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 38 786 | 3310 | 93 |
| 112.45 | Voracidade: giro da adaga (A) em 3 alvo(s) — cura 5% do dano | 3215 | 38 241 | 3471 | 93 |
| 112.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 37 978 | 3471 | 93 |
| 112.45 | Auto-ataque — sem roubo de vida na build | 31 | 37 947 | 3471 | 93 |
| 112.45 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 37 947 | 3471 | 93 |
| 112.45 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 37 947 | 3471 | 93 |
| 112.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 37 403 | 3498 | 93 |
| 113.30 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 36 858 | 3526 | 93 |
| 113.35 | Auto-ataque — sem roubo de vida na build | 31 | 36 827 | 3526 | 93 |
| 113.75 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 36 443 | 3526 | 93 |
| 113.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 36 443 | 2447 | 93 |
| 113.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 36 443 | 3347 | 94 |
| 114.25 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 36 180 | 3347 | 94 |
| 114.25 | Auto-ataque — sem roubo de vida na build | 31 | 36 149 | 3347 | 94 |
| 114.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 36 149 | 4247 | 95 |
| 114.85 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 35 604 | 4275 | 95 |
| 115.15 | Auto-ataque — sem roubo de vida na build | 31 | 35 574 | 4275 | 95 |
| 115.80 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 35 574 | 3196 | 95 |
| 115.85 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 35 574 | 4096 | 96 |
| 116.05 | Auto-ataque — sem roubo de vida na build | 31 | 35 543 | 4096 | 96 |
| 116.20 | CHEFE CARREGA Tentáculos do Vazio (tentaculos) — aviso de 1.3s [motor.js:3123] |  | 35 543 | 4096 | 96 |
| 116.95 | Auto-ataque — sem roubo de vida na build | 31 | 35 513 | 4096 | 96 |
| 117.50 | GOLPE Tentáculos do Vazio (tentaculos, x2.6) | -2500 | 35 513 | 1596 | 96 |
| 117.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 35 513 | 2496 | 97 |
| 117.85 | Auto-ataque — sem roubo de vida na build | 31 | 35 482 | 2496 | 97 |
| 118.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 35 482 | 3397 | 98 |
| 118.75 | Auto-ataque — sem roubo de vida na build | 31 | 35 451 | 3397 | 98 |
| 119.00 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 35 067 | 3397 | 98 |
| 119.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 35 067 | 2318 | 98 |
| 119.15 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 34 731 | 2318 | 98 |
| 119.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 34 731 | 3218 | 99 |
| 119.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 34 467 | 3218 | 99 |
| 119.65 | Auto-ataque — sem roubo de vida na build | 31 | 34 437 | 3218 | 99 |
| 119.80 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 34 437 | 3218 | 99 |
| 120.10 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 33 892 | 3245 | 99 |
| 120.50 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 33 347 | 3273 | 99 |
| 120.55 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 33 347 | 4173 | 100 |
| 120.55 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 33 084 | 4173 | 100 |
| 120.55 | Auto-ataque — sem roubo de vida na build | 31 | 33 054 | 4173 | 100 |
| 121.05 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 32 509 | 4200 | 100 |
| 121.45 | Auto-ataque — sem roubo de vida na build | 31 | 32 478 | 4200 | 100 |
| 122.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 32 478 | 3122 | 100 |
| 122.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 32 478 | 3422 | 101 |
| 122.35 | Auto-ataque — sem roubo de vida na build | 31 | 32 448 | 3422 | 101 |
| 123.25 | Auto-ataque — sem roubo de vida na build | 31 | 32 417 | 3422 | 101 |
| 124.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 32 417 | 2344 | 101 |
| 124.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 32 417 | 3244 | 102 |
| 124.15 | Auto-ataque — sem roubo de vida na build | 31 | 32 386 | 3244 | 102 |
| 124.25 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 32 002 | 3244 | 102 |
| 125.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 31 739 | 3244 | 102 |
| 125.05 | Auto-ataque — sem roubo de vida na build | 31 | 31 708 | 3244 | 102 |
| 125.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 31 708 | 4144 | 103 |
| 125.35 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 31 164 | 4171 | 103 |
| 125.95 | Auto-ataque — sem roubo de vida na build | 31 | 31 133 | 4171 | 103 |
| 126.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 31 133 | 3093 | 103 |
| 126.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 31 133 | 3393 | 104 |
| 126.55 | CHEFE CARREGA Ácido Corrosivo (acido) — aviso de 1s [motor.js:3123] |  | 31 133 | 3393 | 104 |
| 126.85 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 30 797 | 3393 | 104 |
| 126.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 30 533 | 3393 | 104 |
| 126.85 | Auto-ataque — sem roubo de vida na build | 31 | 30 503 | 3393 | 104 |
| 126.85 | CHEFE INTERROMPIDO (acido) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 30 503 | 3393 | 104 |
| 127.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 30 503 | 4293 | 105 |
| 127.75 | Auto-ataque — sem roubo de vida na build | 31 | 30 472 | 4293 | 105 |
| 127.85 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 29 927 | 4320 | 105 |
| 128.05 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 29 927 | 4321 | 105 |
| 128.10 | Lótus da Morte: leva 1/15 em 1 alvo(s) | 128 | 29 799 | 4321 | 105 |
| 128.30 | Lótus da Morte: leva 2/15 em 1 alvo(s) | 128 | 29 671 | 4321 | 105 |
| 128.45 | Lótus da Morte: leva 3/15 em 1 alvo(s) | 128 | 29 543 | 4321 | 105 |
| 128.60 | Lótus da Morte: leva 4/15 em 1 alvo(s) | 128 | 29 415 | 4321 | 105 |
| 128.80 | Lótus da Morte: leva 5/15 em 1 alvo(s) | 128 | 29 287 | 4321 | 105 |
| 128.95 | Lótus da Morte: leva 6/15 em 1 alvo(s) | 128 | 29 159 | 4321 | 105 |
| 129.10 | Lótus da Morte: leva 7/15 em 1 alvo(s) | 128 | 29 031 | 4321 | 105 |
| 129.30 | Lótus da Morte: leva 8/15 em 1 alvo(s) | 128 | 28 902 | 4321 | 105 |
| 129.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 28 902 | 3242 | 105 |
| 129.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 28 902 | 4142 | 106 |
| 129.45 | Lótus da Morte: leva 9/15 em 1 alvo(s) | 128 | 28 774 | 4142 | 106 |
| 129.60 | Lótus da Morte: leva 10/15 em 1 alvo(s) | 128 | 28 646 | 4142 | 106 |
| 129.80 | Lótus da Morte: leva 11/15 em 1 alvo(s) | 128 | 28 518 | 4142 | 106 |
| 129.95 | Lótus da Morte: leva 12/15 em 1 alvo(s) | 128 | 28 390 | 4142 | 106 |
| 130.10 | Lótus da Morte: leva 13/15 em 1 alvo(s) | 128 | 28 262 | 4142 | 106 |
| 130.30 | Lótus da Morte: leva 14/15 em 1 alvo(s) | 128 | 28 134 | 4142 | 106 |
| 130.45 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 128 | 28 006 | 4142 | 106 |
| 130.45 | Lótus da Morte terminou [motor.js:2194] |  | 28 006 | 4142 | 106 |
| 130.45 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 27 621 | 4142 | 106 |
| 130.55 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 27 621 | 4143 | 106 |
| 131.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 27 358 | 4143 | 106 |
| 131.05 | Auto-ataque — sem roubo de vida na build | 31 | 27 327 | 4143 | 106 |
| 131.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 27 327 | 3064 | 106 |
| 131.45 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 27 327 | 3364 | 107 |
| 131.55 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 26 783 | 3391 | 107 |
| 131.95 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 26 238 | 3419 | 107 |
| 131.95 | Auto-ataque — sem roubo de vida na build | 31 | 26 207 | 3419 | 107 |
| 132.85 | Auto-ataque — sem roubo de vida na build | 31 | 26 177 | 3419 | 107 |
| 132.90 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.0s [motor.js:3118] |  | 26 177 | 3419 | 107 |
| 132.90 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.3s [motor.js:3118] |  | 26 177 | 3419 | 107 |
| 132.90 | CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120] |  | 26 177 | 3419 | 107 |
| 133.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 26 177 | 2340 | 107 |
| 133.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 26 177 | 3240 | 108 |
| 133.75 | Auto-ataque — sem roubo de vida na build | 31 | 26 146 | 3240 | 108 |
| 133.90 | LARVA CHEGOU (nv 36) |  | 26 146 | 3240 | 108 |
| 134.20 | LARVA CHEGOU (nv 36) |  | 26 146 | 3241 | 108 |
| 134.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 26 146 | 4141 | 109 |
| 134.55 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 25 810 | 4141 | 109 |
| 134.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 25 547 | 4141 | 109 |
| 134.65 | Auto-ataque — sem roubo de vida na build | 31 | 25 516 | 4141 | 109 |
| 134.75 | Auto-ataque da larva (368 AD magico) | -174 | 25 516 | 3967 | 109 |
| 134.75 | Auto-ataque da larva (368 AD magico) | -174 | 25 516 | 3793 | 109 |
| 135.55 | Voracidade: giro da adaga (A) em 3 alvo(s) — cura 5% do dano | 3215 | 24 971 | 3954 | 109 |
| 135.55 | Auto-ataque — sem roubo de vida na build | 31 | 24 941 | 3954 | 109 |
| 135.70 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 24 556 | 3954 | 109 |
| 136.00 | Auto-ataque da larva (368 AD magico) | -174 | 24 556 | 3780 | 109 |
| 136.00 | Auto-ataque da larva (368 AD magico) | -174 | 24 556 | 3606 | 109 |
| 136.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 24 556 | 2528 | 109 |
| 136.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 24 556 | 3428 | 110 |
| 136.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 24 293 | 3428 | 110 |
| 136.45 | Auto-ataque — sem roubo de vida na build | 31 | 24 262 | 3428 | 110 |
| 136.80 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 23 718 | 3588 | 110 |
| 137.25 | Auto-ataque da larva (368 AD magico) | -174 | 23 718 | 3415 | 110 |
| 137.25 | Auto-ataque da larva (368 AD magico) | -174 | 23 718 | 3241 | 110 |
| 137.35 | Auto-ataque — sem roubo de vida na build | 31 | 23 687 | 3241 | 110 |
| 137.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 23 687 | 4141 | 111 |
| 138.25 | Auto-ataque — sem roubo de vida na build | 31 | 23 656 | 4141 | 111 |
| 138.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 23 656 | 3062 | 111 |
| 138.45 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 23 656 | 3362 | 112 |
| 138.50 | Auto-ataque da larva (368 AD magico) | -174 | 23 656 | 3188 | 112 |
| 138.50 | Auto-ataque da larva (368 AD magico) | -174 | 23 656 | 3015 | 112 |
| 139.15 | Auto-ataque — sem roubo de vida na build | 31 | 23 626 | 3015 | 112 |
| 139.45 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 23 626 | 3315 | 113 |
| 139.75 | Auto-ataque da larva (368 AD magico) | -174 | 23 626 | 3141 | 113 |
| 139.75 | Auto-ataque da larva (368 AD magico) | -174 | 23 626 | 2967 | 113 |
| 140.05 | Auto-ataque — sem roubo de vida na build | 31 | 23 595 | 2967 | 113 |
| 140.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 23 595 | 1889 | 113 |
| 140.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 23 595 | 2789 | 114 |
| 140.95 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 23 211 | 2789 | 114 |
| 140.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 22 948 | 2789 | 114 |
| 140.95 | Auto-ataque — sem roubo de vida na build | 31 | 22 917 | 2789 | 114 |
| 141.00 | Auto-ataque da larva (368 AD magico) | -174 | 22 917 | 2615 | 114 |
| 141.00 | Auto-ataque da larva (368 AD magico) | -174 | 22 917 | 2441 | 114 |
| 141.30 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 22 917 | 2441 | 114 |
| 141.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 22 917 | 3341 | 115 |
| 141.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 22 654 | 3341 | 115 |
| 141.85 | Auto-ataque — sem roubo de vida na build | 31 | 22 623 | 3341 | 115 |
| 142.05 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 22 079 | 3502 | 115 |
| 142.05 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 22 079 | 3502 | 115 |
| 142.05 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 3.00s) [motor.js:1789] |  | 22 079 | 3502 | 115 |
| 142.25 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 21 742 | 3502 | 115 |
| 142.55 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 21 197 | 3529 | 115 |
| 142.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 20 934 | 3529 | 115 |
| 142.75 | Auto-ataque — sem roubo de vida na build | 31 | 20 904 | 3529 | 115 |
| 143.20 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 20 519 | 3530 | 115 |
| 143.25 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 19 975 | 3557 | 115 |
| 143.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 19 975 | 2478 | 115 |
| 143.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 19 975 | 3378 | 116 |
| 143.65 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 19 711 | 3378 | 116 |
| 143.65 | Auto-ataque — sem roubo de vida na build | 31 | 19 681 | 3378 | 116 |
| 144.30 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 19 136 | 3406 | 116 |
| 144.55 | Auto-ataque — sem roubo de vida na build | 31 | 19 105 | 3406 | 116 |
| 145.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 19 105 | 2327 | 116 |
| 145.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 19 105 | 3227 | 117 |
| 145.45 | Auto-ataque — sem roubo de vida na build | 31 | 19 075 | 3227 | 117 |
| 146.35 | Auto-ataque — sem roubo de vida na build | 31 | 19 044 | 3227 | 117 |
| 146.45 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 19 044 | 4127 | 118 |
| 146.90 | CHEFE CARREGA Tentáculos do Vazio (tentaculos) — aviso de 1.3s [motor.js:3123] |  | 19 044 | 4128 | 118 |
| 147.25 | Auto-ataque — sem roubo de vida na build | 31 | 19 014 | 4128 | 118 |
| 148.15 | Auto-ataque — sem roubo de vida na build | 31 | 18 983 | 4128 | 118 |
| 148.20 | GOLPE Tentáculos do Vazio (tentaculos, x2.6) | -2500 | 18 983 | 1628 | 118 |
| 148.25 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 18 983 | 2528 | 119 |
| 148.45 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 18 599 | 2528 | 119 |
| 148.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 18 599 | 1449 | 119 |
| 149.05 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 18 599 | 1449 | 119 |
| 149.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 18 335 | 1449 | 119 |
| 149.05 | Auto-ataque — sem roubo de vida na build | 31 | 18 305 | 1449 | 119 |
| 149.25 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 18 305 | 2349 | 120 |
| 149.55 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 17 760 | 2377 | 120 |
| 149.95 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 17 424 | 2377 | 120 |
| 149.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 17 161 | 2377 | 120 |
| 149.95 | Auto-ataque — sem roubo de vida na build | 31 | 17 130 | 2377 | 120 |
| 150.25 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 17 130 | 3277 | 121 |
| 150.30 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 16 585 | 3304 | 121 |
| 150.85 | Auto-ataque — sem roubo de vida na build | 31 | 16 555 | 3304 | 121 |
| 150.95 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 16 010 | 3331 | 121 |
| 151.25 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 16 010 | 4232 | 122 |
| 151.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 16 010 | 3153 | 122 |
| 151.75 | Auto-ataque — sem roubo de vida na build | 31 | 15 979 | 3153 | 122 |
| 152.25 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 15 979 | 4053 | 123 |
| 152.65 | Auto-ataque — sem roubo de vida na build | 31 | 15 949 | 4053 | 123 |
| 153.55 | Auto-ataque — sem roubo de vida na build | 31 | 15 918 | 4053 | 123 |
| 153.70 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 15 534 | 4053 | 123 |
| 153.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 15 534 | 2975 | 123 |
| 153.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 15 534 | 3275 | 124 |
| 154.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 15 271 | 3275 | 124 |
| 154.45 | Auto-ataque — sem roubo de vida na build | 31 | 15 240 | 3275 | 124 |
| 154.75 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 15 240 | 4175 | 125 |
| 154.80 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 14 695 | 4202 | 125 |
| 155.35 | Auto-ataque — sem roubo de vida na build | 31 | 14 665 | 4202 | 125 |
| 155.70 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 14 665 | 3124 | 125 |
| 155.75 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 14 665 | 3424 | 126 |
| 156.25 | Auto-ataque — sem roubo de vida na build | 31 | 14 634 | 3424 | 126 |
| 157.15 | Auto-ataque — sem roubo de vida na build | 31 | 14 603 | 3424 | 126 |
| 157.25 | CHEFE CARREGA Ácido Corrosivo (acido) — aviso de 1s [motor.js:3123] |  | 14 603 | 3424 | 126 |
| 157.65 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 14 267 | 3424 | 126 |
| 157.65 | CHEFE INTERROMPIDO (acido) pelo atordoamento — tMec volta a 6s [motor.js:3089] |  | 14 267 | 3424 | 126 |
| 158.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 14 004 | 3424 | 126 |
| 158.05 | Auto-ataque — sem roubo de vida na build | 31 | 13 973 | 3424 | 126 |
| 158.65 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 13 429 | 3452 | 126 |
| 158.95 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 13 044 | 3452 | 126 |
| 158.95 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 12 781 | 3452 | 126 |
| 158.95 | Auto-ataque — sem roubo de vida na build | 31 | 12 750 | 3452 | 126 |
| 159.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 12 750 | 2373 | 126 |
| 159.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 12 750 | 3273 | 127 |
| 159.80 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 12 750 | 3274 | 127 |
| 159.85 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 12 487 | 3274 | 127 |
| 159.85 | Auto-ataque — sem roubo de vida na build | 31 | 12 457 | 3274 | 127 |
| 160.05 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 11 912 | 3301 | 127 |
| 160.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 11 912 | 4201 | 128 |
| 160.75 | Auto-ataque — sem roubo de vida na build | 31 | 11 881 | 4201 | 128 |
| 161.05 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 11 336 | 4228 | 128 |
| 161.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 11 336 | 3150 | 128 |
| 161.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 11 336 | 3450 | 129 |
| 161.65 | Auto-ataque — sem roubo de vida na build | 31 | 11 306 | 3450 | 129 |
| 162.55 | Auto-ataque — sem roubo de vida na build | 31 | 11 275 | 3450 | 129 |
| 163.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 11 275 | 2371 | 129 |
| 163.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 11 275 | 3271 | 130 |
| 163.45 | Auto-ataque — sem roubo de vida na build | 31 | 11 245 | 3272 | 130 |
| 163.70 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.0s [motor.js:3118] |  | 11 245 | 3272 | 130 |
| 163.70 | LARVA NASCE (nv 36, 5551 HP, 368 AD magico, as 0.8, armadura 59.0) — chega em 1.3s [motor.js:3118] |  | 11 245 | 3272 | 130 |
| 163.70 | CHEFE INVOCA 2 larvas do Vazio [motor.js:3117-3120] |  | 11 245 | 3272 | 130 |
| 164.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 11 245 | 4172 | 131 |
| 164.20 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 10 860 | 4172 | 131 |
| 164.35 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 10 597 | 4172 | 131 |
| 164.35 | Auto-ataque — sem roubo de vida na build | 31 | 10 567 | 4172 | 131 |
| 164.70 | LARVA CHEGOU (nv 36) |  | 10 567 | 4172 | 131 |
| 165.00 | LARVA CHEGOU (nv 36) |  | 10 567 | 4172 | 131 |
| 165.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 10 567 | 3093 | 131 |
| 165.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 10 567 | 3393 | 132 |
| 165.15 | Auto-ataque da larva (368 AD magico) | -174 | 10 567 | 3219 | 132 |
| 165.25 | Auto-ataque — sem roubo de vida na build | 31 | 10 536 | 3219 | 132 |
| 165.30 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 9991 | 3380 | 132 |
| 165.30 | Auto-ataque da larva (368 AD magico) | -174 | 9991 | 3206 | 132 |
| 165.35 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 9655 | 3206 | 132 |
| 166.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 9655 | 4107 | 133 |
| 166.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 9392 | 4107 | 133 |
| 166.15 | Auto-ataque — sem roubo de vida na build | 31 | 9361 | 4107 | 133 |
| 166.35 | Voracidade: giro da adaga (A) em 3 alvo(s) — cura 5% do dano | 3215 | 8816 | 4267 | 133 |
| 166.40 | Auto-ataque da larva (368 AD magico) | -174 | 8816 | 4093 | 133 |
| 166.55 | Auto-ataque da larva (368 AD magico) | -174 | 8816 | 3920 | 133 |
| 167.05 | Auto-ataque — sem roubo de vida na build | 31 | 8786 | 3920 | 133 |
| 167.65 | Auto-ataque da larva (368 AD magico) | -174 | 8786 | 3746 | 133 |
| 167.80 | Auto-ataque da larva (368 AD magico) | -174 | 8786 | 3572 | 133 |
| 167.95 | Auto-ataque — sem roubo de vida na build | 31 | 8755 | 3572 | 133 |
| 168.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 8755 | 2493 | 133 |
| 168.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 8755 | 3393 | 134 |
| 168.85 | Auto-ataque — sem roubo de vida na build | 31 | 8725 | 3394 | 134 |
| 168.90 | Auto-ataque da larva (368 AD magico) | -174 | 8725 | 3220 | 134 |
| 169.05 | Auto-ataque da larva (368 AD magico) | -174 | 8725 | 3046 | 134 |
| 169.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 8725 | 3346 | 135 |
| 169.45 | Q Lâmina Saltitante em 3 alvo(s) — recarga que entra 5.24s | 2269 | 8340 | 3346 | 135 |
| 169.75 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 8077 | 3346 | 135 |
| 169.75 | Auto-ataque — sem roubo de vida na build | 31 | 8046 | 3346 | 135 |
| 170.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 8046 | 2267 | 135 |
| 170.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 8046 | 3168 | 136 |
| 170.15 | R Lótus da Morte — canal 2.5s, 15 levas; recarga que entra 42.10s |  | 8046 | 3168 | 136 |
| 170.15 | Auto-ataque da larva (368 AD magico) | -174 | 8046 | 2994 | 136 |
| 170.20 | Lótus da Morte: leva 1/15 em 3 alvo(s) | 756 | 7918 | 2994 | 136 |
| 170.30 | Auto-ataque da larva (368 AD magico) | -174 | 7918 | 2820 | 136 |
| 170.40 | Lótus da Morte: leva 2/15 em 3 alvo(s) | 756 | 7790 | 2820 | 136 |
| 170.55 | Voracidade: giro da adaga (Q) em 3 alvo(s) — cura 5% do dano | 3215 | 7245 | 2981 | 136 |
| 170.55 | Lótus da Morte: leva 3/15 em 1 alvo(s) | 128 | 7117 | 2981 | 136 |
| 170.55 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 1.50s) [motor.js:1789] |  | 7117 | 2981 | 136 |
| 170.55 | ABATE da larva -> Voracidade corta 1.5s de Q/W/E (cortou 1.50s) [motor.js:1789] |  | 7117 | 2981 | 136 |
| 170.70 | Lótus da Morte: leva 4/15 em 1 alvo(s) | 128 | 6989 | 2981 | 136 |
| 170.90 | Lótus da Morte: leva 5/15 em 1 alvo(s) | 128 | 6861 | 2981 | 136 |
| 171.05 | Lótus da Morte: leva 6/15 em 1 alvo(s) | 128 | 6733 | 2981 | 136 |
| 171.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 6733 | 3281 | 137 |
| 171.20 | Lótus da Morte: leva 7/15 em 1 alvo(s) | 128 | 6605 | 3281 | 137 |
| 171.40 | Lótus da Morte: leva 8/15 em 1 alvo(s) | 128 | 6477 | 3281 | 137 |
| 171.55 | Lótus da Morte: leva 9/15 em 1 alvo(s) | 128 | 6348 | 3281 | 137 |
| 171.70 | Lótus da Morte: leva 10/15 em 1 alvo(s) | 128 | 6220 | 3281 | 137 |
| 171.90 | Lótus da Morte: leva 11/15 em 1 alvo(s) | 128 | 6092 | 3281 | 137 |
| 172.05 | Lótus da Morte: leva 12/15 em 1 alvo(s) | 128 | 5964 | 3281 | 137 |
| 172.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 5964 | 2202 | 137 |
| 172.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 5964 | 3102 | 138 |
| 172.20 | Lótus da Morte: leva 13/15 em 1 alvo(s) | 128 | 5836 | 3102 | 138 |
| 172.40 | Lótus da Morte: leva 14/15 em 1 alvo(s) | 128 | 5708 | 3102 | 138 |
| 172.55 | Lótus da Morte: leva 15/15 em 1 alvo(s) | 128 | 5580 | 3102 | 138 |
| 172.55 | Lótus da Morte terminou [motor.js:2194] |  | 5580 | 3102 | 138 |
| 172.55 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 5195 | 3102 | 138 |
| 172.55 | W Preparação (adaga cai em 1.25s) — recarga que entra 10.72s |  | 5195 | 3102 | 138 |
| 173.05 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 4859 | 3103 | 138 |
| 173.05 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 4596 | 3103 | 138 |
| 173.05 | Auto-ataque — sem roubo de vida na build | 31 | 4565 | 3103 | 138 |
| 173.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 4565 | 3403 | 139 |
| 173.65 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 4020 | 3430 | 139 |
| 173.95 | Auto-ataque — sem roubo de vida na build | 31 | 3990 | 3430 | 139 |
| 174.05 | Voracidade: giro da adaga (W) em 1 alvo(s) — cura 5% do dano | 545 | 3445 | 3457 | 139 |
| 174.45 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 2900 | 3485 | 139 |
| 174.85 | Auto-ataque — sem roubo de vida na build | 31 | 2870 | 3485 | 139 |
| 175.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 2870 | 2406 | 139 |
| 175.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 2870 | 3306 | 140 |
| 175.75 | Auto-ataque — sem roubo de vida na build | 31 | 2839 | 3306 | 140 |
| 176.15 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 2839 | 4206 | 141 |
| 176.65 | Auto-ataque — sem roubo de vida na build | 31 | 2808 | 4207 | 141 |
| 177.10 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 2808 | 3128 | 141 |
| 177.15 | Poção Poção de Vida (vida): +300 HP por 40 g (exaustão 1s) [motor.js:262-264,1301] |  | 2808 | 3428 | 142 |
| 177.55 | Auto-ataque — sem roubo de vida na build | 31 | 2778 | 3428 | 142 |
| 177.70 | CHEFE CARREGA Tentáculos do Vazio (tentaculos) — aviso de 1.3s [motor.js:3123] |  | 2778 | 3428 | 142 |
| 177.80 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 2393 | 3428 | 142 |
| 178.45 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 2130 | 3428 | 142 |
| 178.45 | Auto-ataque — sem roubo de vida na build | 31 | 2100 | 3428 | 142 |
| 178.90 | Voracidade: giro da adaga (Q) em 1 alvo(s) — cura 5% do dano | 545 | 1555 | 3456 | 142 |
| 179.00 | GOLPE Tentáculos do Vazio (tentaculos, x2.6) | -2500 | 1555 | 955 | 142 |
| 179.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 1555 | 1855 | 143 |
| 179.35 | Auto-ataque — sem roubo de vida na build | 31 | 1524 | 1855 | 143 |
| 180.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 1524 | 2756 | 144 |
| 180.25 | Auto-ataque — sem roubo de vida na build | 31 | 1494 | 2756 | 144 |
| 180.40 | Auto-ataque do chefe (magico, 1408 AD, as 0.50) | -1079 | 1494 | 1677 | 144 |
| 180.75 | A Adaga Certeira em Barão Nashor (atordoa 1s) — recarga que entra 7.65s | 336 | 1157 | 1677 | 144 |
| 181.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 1157 | 2577 | 145 |
| 181.15 | Lich (3100): Perdição no auto = 75% do Poder [motor.js:1688] | 263 | 894 | 2577 | 145 |
| 181.15 | Auto-ataque — sem roubo de vida na build | 31 | 864 | 2577 | 145 |
| 181.75 | Voracidade: giro da adaga (A) em 1 alvo(s) — cura 5% do dano | 545 | 319 | 2605 | 145 |
| 182.05 | Poção Poção de Vida Forte (vidaF): +900 HP por 110 g (exaustão 1s) [motor.js:262-264,1301] |  | 319 | 3505 | 146 |
| 182.05 | Auto-ataque — sem roubo de vida na build | 31 | 288 | 3505 | 146 |
| 182.95 | Auto-ataque — sem roubo de vida na build | 31 | 258 | 3505 | 146 |
| 183.05 | Q Lâmina Saltitante em 1 alvo(s) — recarga que entra 5.24s | 384 | 0 | 3505 | 146 |
| 183.05 | ABATE DO CHEFE Barão Nashor -> Voracidade corta 5s de Q/W/E (cortou 5.22s) [voracidadeChefe, motor.js:736] [motor.js:1789] |  | 0 | 3505 | 146 |

**RESUMO — Barão Nashor**

| grandeza | valor |
|---|---|
| resultado | MATOU em 183.05 s |
| duração | 183.05 s |
| vida do jogador | min **955** / 4536 (21.1%) |
| poções | **146** (P1 52, P2 94, P3 0) = **12 420 g** |
| abates | larvas **12**, chefes **1** |
| recarga cortada pela Voracidade | **23.0 s** em Q/W/E (12 x 1.5 + 1 x 5) [motor.js:1789] |
| dano causado | 169 634 (auto + skills + itens + queima) |
| dano recebido | 105 557 |
| cura | roubo de vida 0 + giro 4273 + poções 100 200 + regeneração 54 |
| procs | Lich 64 (16 842 de dano), Liandry 0 (0), Rei 3153 0 (0 de bónus), Luden 0 (0) |
| habilidades lançadas | R x5, A x24, Q x38, W x18 |
| ouro dos abates | 2835 g (sem multiplicadores de VIP/rotina) |
| eventos na linha do tempo | 862 (AUTO 189, POCAO 146, HAB 90, GIRO 79, HAB_TICK 75, CHEFE_BASICO 73, PROC 64, LARVA_ATAQUE 60, CHEFE 29, LARVA 24, QUEIMA 20, ABATE 13) |


---

## Resumo dos 3 chefes

| chefe | nv | resultado | duração | poções | ouro em poções | hpMin | larvas abatidas | recarga cortada (Voracidade) | dano causado | dano recebido |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Arauto do Vale | 33 | MATOU 34.35 s | 34.35 s | 5 | 480 g | 2787 (61%) | 0 | 5.0 s | 46 793 | 4873 |
| Dragão Infernal | 33 | MATOU 34.35 s | 34.35 s | 6 | 590 g | 3114 (69%) | 0 | 5.0 s | 54 637 | 6426 |
| Barão Nashor | 42 | MATOU 183.05 s | 183.05 s | 146 | 12 420 g | 955 (21%) | 12 | 23.0 s | 169 634 | 105 557 |

### O que este simulador NÃO modela (para não haver surpresa escondida)

- O **rank da passiva D (Lâmina Sinistra)** não aparece no DOM (docs/snapshots/skills.json só lista Q,W,E,R,G,A,F,T,B,M,N) e o snapshot diz pontos: 0
  com 24 ranks gastos — no nv29 o motor dá 28 pontos (motor.js:2798-2801). Os 4 pontos em falta podem estar na D ou na T.
  Por omissão usa-se **D = 0** (sem curaGiro): com D = 4 o giro passaria a curar mais 11% do dano dele (motor.js:755-756). Usa --rankD 4 para ver.
- A barra é a MEDIDA no snapshot (W, Q, R, A). A extensão reordena a barra a cada 2 s (barraPorDisponibilidade, automation.js:5654) — isso é política da extensão, não do motor.
- O crítico e o relógio inicial dos ataques são aleatórios no motor (motor.js:1072, 1700); aqui são semeados e a semente sai impressa.
- Ouro/XP de abate usam o ouro/xp do monstro sem os multiplicadores de VIP, rotina e eventos (motor.js:1758-1766).
- Loot, mochila, refino e qualidade NÃO entram na luta (só a qualidade/refino dos itens JÁ equipados, via infoItem, motor.js:251-256).
- Nada disto foi medido a jogar: sem browser, sem CDP, sem partida — só o motor lido como texto e os snapshots já gravados.


## O ABATE e A ULTIMATE — o que o motor faz de facto

motor.js:1789 — em TODOS os campeões, cada abate corta a recarga de **Q, W e E**:

| campeão | corte por abate comum | corte por abate de CHEFE | a ULTIMATE reinicia? |
|---|---:|---:|---|
| Katarina (motor.js:736) | 1.5 s | 5 s | **NÃO** — Q/W/E só; a R fica com a recarga inteira (motor.js:1789) |
| Darius (motor.js:1853) | - | - | **SIM** — o abate reinicia a Guilhotina em 2 s, também nos chefes (usar('R',{},2)) |

Ou seja: o reset da ultimate que se le em motor.js:1853 e do DARIUS. A Katarina não o tem — o abate só corta Q/W/E.
Na luta simulada isto aparece em cada ABATE: o giro da adaga volta mais vezes (Q/W mais curtos), mas a Lótus da Morte continua a esperar os 42.10 s da recarga cheia.

## 6) A luta SIMULADA contra o Dragão vs as 38 lutas MEDIDAS no snapshot

| grandeza | medido (docs/snapshots/katarina.json) | simulado (esta execução) |
|---|---|---|
| duração | mediana 28.5 s (4.5-35.6) | 34.35 s |
| poções | mediana 1 (0-6) | 6 |
| vida mínima do jogador | 2784 a 3888 | 3114 |
| mecânicas vistas | sopro, chuva, rugido | sopro, rugido |
| cura das habilidades por segundo | mediana 0/s | 27.7/s |

A duração, o número de poções, a vida mínima e a cura por segundo caem DENTRO do intervalo medido. O que não bate é o DPS do jogador, porque a base do campeão não existe no repositório (ver [1]).

