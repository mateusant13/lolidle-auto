# TICKETS EXTRA — de relatórios de frentes paralelas (2026-10-14 ~21:25)
> Não vêm do histórico: vêm de entregas de subagents depois de os leitores terem começado.
> Formato igual. O Lead consolidou.

### TK-X1 | P1 | A R da Katarina não reinicia por abate — o modelo/extensão acha que sim?
- **Ficheiro(s)**: extension/automation.js (barra/ordem de skills) + tools/sim-build.mjs
- **Evidencia**: motor.js:1789 só corta recarga de Q/W/E (voracidade). O reset lido em motor.js:1853 é do DARIOS (usar(R,{},2)). Na luta simulada a R espera sempre 42,10 s (55 x (1-0,2346)).
- **Fazer**: procurar em automation.js/sim-build onde a R é tratada como "reinicia no abate" e corrigir o modelo; se não houver, ticket fecha como "confirmado: extensão certa".
- **Aceitacao**: teste que mostre que abate NÃO muda a recarga da R; doc com motor.js:1789 citado.
- **Estado**: pendente

### TK-X2 | P0 | O atordoamento da Adaga Certeira (A/A2?) cancela mecânica do chefe — usar de propósito
- **Ficheiro(s)**: extension/automation.js (decisão de skills em combate)
- **Evidencia**: motor.js:2259 (atordoa 1 s) -> motor.js:3089 corta a carga e mete tMec=6. Medido: 7 cargas morreram no aviso; o Dragão nunca aterrou a chuva e o Arauto nunca aterrou o olho na luta simulada.
- **Fazer**: o actor deve LANÇAR A quando o chefe está a carregar (evento de aviso), não só por rotação de DPS. Modelar o gatilho a partir do sinal observável (carga/aviso) e não do relógio.
- **Aceitacao**: teste do actor: chefe a carregar -> A lançada em < 0,3 s; luta simulada com menos golpes de mecânica recebidos.
- **Estado**: pendente

### TK-X3 | P1 | Rank da passiva D (Lâmina Sinistra) = 4 — faltam 4 pontos em todo o lado
- **Ficheiro(s)**: docs/snapshots/skills.json (dado medido) + automation.js + tools/sim-build.mjs + tools/sim-timeline.mjs
- **Evidencia**: motor.js:2798-2801 dá 28 pontos no nv29; arsenal medido tem 24 ranks e 0 pontos. motor.js:2169: cura do giro = 0,05 + curaGiro[rank]; snapshot {t:heal, v:279} com giro 1640-1760 -> 0,16x1760 = 282 (-1%). Com D=0 seria 88. Efeito medido: Barão 146 -> 125 poções; Arauto 5 -> 2.
- **Fazer**: adoptar rankD=4 em TODO o lado (snapshot + sim + extensão), ou justificar com evidência diferente.
- **Aceitacao**: mesma cura medida (279±5%) reproduzida pelo modelo com rankD=4.
- **Estado**: pendente

### TK-X4 | P2 | Poção Suprema não existe abaixo de nv30
- **Ficheiro(s)**: extension/automation.js (regra de poções)
- **Evidencia**: motor.js:264 exige nv30 para a poção suprema. Dono está nv29.
- **Fazer**: o actor nunca deve planear poção suprema abaixo de nv30 (senão planeia algo que não pode usar).
- **Aceitacao**: teste: nv29 -> plano sem suprema; nv30 -> com suprema.
- **Estado**: pendente

### TK-X5 | P1 | Base do campeão calibrada vs ficheiro real (dados-katarina.js ausente)
- **Ficheiro(s)**: tools/sim-chefes.mjs (calibração) + docs/snapshots/katarina.json
- **Evidencia**: motor.js:6 importa dados-katarina.js, que NÃO existe no repo. Calibração de 1 ponto dá +1,3% vida, -4,8% AD e Poder, -3,7% armadura.
- **Fazer**: (a) extrair a base real do jogo ao vivo via relay (mundo MAIN) e gravar docs/game-src/dados-katarina.js; (b) apontar a calibração para o ficheiro lido, nunca à mão (REGRA 3).
- **Aceitacao**: ficheiro existe, tem hash do que foi lido ao vivo, e o sim passa a bater com o painel a <1%.
- **Estado**: pendente

### TK-X6 | P1 | Barão nv42 vs Katarina nv29: factores de dano 2,35 vs 0,37
- **Ficheiro(s)**: extension/automation.js (limiar de "vale a pena lutar o chefe")
- **Evidencia**: motor.js:1186 fatorDanoMonstro=2,35; motor.js:1187 fatorDanoJogador=0,37. Básico do chefe bate 1079 (540/s); básico dela bate 31.
- **Fazer**: a decisão de enfrentar o Barão tem de usar estes factores LIDOS do motor, e o limiar de "não vá" tem de ser explícito em poções/ouro.
- **Aceitacao**: decisão impressa com os dois factores e o custo em poções antes de aceitar a luta.
- **Estado**: pendente

## DECISÕES DO DONO
- Nenhuma nova. (A política de troca de bota em combate e o rankD default já estão noutras frentes.)
