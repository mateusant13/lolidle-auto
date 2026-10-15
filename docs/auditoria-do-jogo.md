# Auditoria do jogo — o que o motor faz, o que a extensão modela, e o que deve mudar

> Pedido do dono (verbatim): *"faz um novo audit. o subagent vai olhar pra todas as matemáticas,
> pensando no GAME, nao so matematica por matematica. ele vai entender tudo sobre as mecanicas do
> jogo de forma extensiva, e depois reportar o que deve mudar na matematica e por que"*.
>
> Data: 2026-10-14. Fontes lidas: `docs/game-src/motor.js` **inteiro** (3791 linhas), `itens.js`
> (108 itens), `balanco.js`, `campeoes.js`, `dados.js`, `jogo.js` (pontos citados), `inject.js`,
> `extension/automation.js` (6616 linhas) e os dois simuladores. Contas próprias em
> [tools/audit-game.mjs](../tools/audit-game.mjs) (`node tools/audit-game.mjs`).
>
> Regra seguida: **dado do jogo = modela; política = pergunta**. Onde a correcção precisa de uma
> escolha do dono está escrito **PRECISA DE REGRA DO DONO**.
>
> Correções feitas hoje (docs/hardcodes-build.md e comentários do automation.js) **não** são
> reportadas como novas — mas no fim há a lista das que ficaram mal feitas.

---

# PARTE A — COMO O JOGO FUNCIONA (a base)

## A1. O combate: quem bate, quando e em quem

**O combate é automático e roda em `passo(estado, c, dt)` (motor.js:1334)**. O jogador não escolhe
alvos: o motor escolhe.

- **Grupo de monstros**: quando não há inimigos vivos, `c.respawn` conta até 0 e chama
  `gerarGrupo` (motor.js:1418-1425). Depois de limpar a wave, `c.respawn = 1.5` (motor.js:1625);
  ao trocar de local, `c.respawn = 1.2` (motor.js:3046).
- **Quantos**: `qtd = 2 + Math.floor(r()*3)` → **2, 3 ou 4 monstros** (motor.js:1124).
- **Quem o campeão ataca**: corpo a corpo só bate em quem **já chegou** (`prontos`); à distância
  bate no **mais próximo, mesmo que ainda esteja a caminho** (motor.js:1446).
- **Chegada**: cada monstro tem um relógio `chegada` (1.2 s + 0.25 s por posição na fila,
  motor.js:1126); os atiradores somam `chegadaExtra = 1.2` (motor.js:872, 877, 1423).
- **Cadência do auto-ataque**: `d.ataque = 1/a.velAtaque` (motor.js:1675) e o relógio desce em
  `avancarAtaque` com os bónus de velocidade (motor.js:1663-1668): Fúria do Fago (+8%, motor.js:1706),
  passiva do Ezreal (até 5 acúmulos, +10% cada, motor.js:1909), Dançarina Fantasma (+6% por acúmulo,
  até 5, motor.js:1707), Respiração do Vento, Lâmina Sinistra, Sede de Sangue, Bravata do Taric.
- **Cadência do monstro**: `i.ataque = 1/(i.as * aura.as)` e o relógio desce 40% mais devagar se o
  monstro está lento (`i.lento`, motor.js:1726-1730).
- **Ordem das habilidades**: `for (const t of K.ordem) acoes[t]?.()` (motor.js:1593) — cada campeão
  tem a sua ordem fixa (`ordem`, motor.js:871-894). **Só as habilidades na barra são usadas**:
  `pode(t) = estado.barra.includes(t) && ranks[t] && recargas[t] <= 0 && mana >= custo`
  (motor.js:1578). A barra tem **4 lugares** (`BARRA = 4`, motor.js:900).
- **Canal (channel)**: o R do Ezreal carrega **1 s parado** (`CANAL_R = 1`, motor.js:2575) e o da
  Lux 0,6 s (`CANAL_LUX`, motor.js:2576); durante o canal não há auto-ataque (motor.js:1590-1592,
  1608).
- **Esquiva**: `Math.random() < a.esquiva` — anula o golpe inteiro (motor.js:1731). Tecto 25%
  (motor.js:536).

## A2. Habilidades: ranks, custo, recarga, CDR

- **Rank máximo por nível** (`rankMaximoNoNivel`, motor.js:905-912): Q/W/E sobem a cada 2 níveis
  (`ceil(nivel/2)`, tecto 10); R nos níveis 6/11/16/25/35; N nos 45/46/47/48/50; as extras (G/A/D/F/T/B/M)
  a cada 2 níveis depois de liberarem. São **110 ranks para 50 pontos** (motor.js:551).
- **Custo de mana**: cada habilidade tem `custo[rank]` (ex.: Lux Q 50→68, motor.js:635); `gastarMana`
  recusa a habilidade sem mana (motor.js:1171-1174). Sem mana → sem habilidade (só auto-ataque).
- **Recarga**: `d.recargas[t] = recarga[rank] * (1 - a.reducaoRecarga)` (motor.js:1581).
- **CDR (redução de recarga)** — `reducaoRecarga = Math.min(0.4, Math.min(0.3, 0.004*Foco) + cdrItens)`
  (motor.js:537). **O CDR só encolhe a recarga**: nunca aumenta o dano de um golpe (motor.js:1211
  não depende dele). O atributo **Foco** sozinho vale até 30% (75 pontos).
- **Buffs de rank que não são dano**: Grito de Guerra (+15%→+42% de dano por 8 s, motor.js:565),
  Respiração do Vento (+25%→+52% de velocidade de ataque, motor.js:709), Arrogância do Explorador
  (+20%→+42,5% de dano de habilidade, motor.js:602), Sede de Sangue (+20%→+38% AS, motor.js:749),
  Ventania, Farol de Demacia (+10%→+28% de AP, motor.js:660), Estandarte de Noxus (+20%→+56% de
  armadura e RM, motor.js:680), Pele de Diamante (+30%→+57% e devolve 20%→42% do golpe, motor.js:794),
  Vontade do General (+15%→+42% de AD com a vida no fim, motor.js:675).

## A3. O dano: a fórmula completa

`golpear()` (motor.js:1192-1234) é a **única** porta de dano:

1. **Mitigação** `mitigar(dano, arm) = dano * 100/(100 + max(0, arm))` (motor.js:1167).
2. **Que armadura entra** (motor.js:1202):
   - **físico**: `alvo.armadura * (1 - alvo.reducaoArmadura) * (1 - a.penArmadura)`;
   - **mágico de habilidade de campeão de magia** (`poder`): `alvo.armadura * RM_MONSTRO * (1 - a.penMagica)`,
     com `RM_MONSTRO = 0.6` (motor.js:1179) — *"os monstros não têm resistência mágica: é 60% da armadura"*;
   - **mágico que NÃO é de magia** (ex.: a E do Yasuo, `magico:true` sem `poder`): `arm = 0` —
     **ignora resistência por completo**.
3. **Multiplicadores** (motor.js:1211-1221): Grito (+bónus), Disciplina (+1%/abate), buff do Barão (+25%),
   **papel do campeão** (`papel.dano`, motor.js:870-894) e, em Runeterra, `papel.arena`;
   crítico (`a.danoCritico`); **3036 +15% contra chefes** (motor.js:1214); Domínio (+amp);
   Mira do Explorador; Foco da Katarina; Absorção do Zac; Passo das Sombras; e por fim
   `fatorDanoJogador` (monstro acima do nível).
4. **Pós-dano**: roubo de vida **só em auto-ataque** (motor.js:1226), Fúria Sanguinária (cura % de
   todo o dano, motor.js:1231), Hemorragia (motor.js:1232).

**Crítico**: `if (critico) dano *= a.danoCritico` (motor.js:1213). `danoCritico` base **1.75**
(motor.js:499) +0.4 com Gume do Infinito (motor.js:515); o Yasuo multiplica por 0.8 (motor.js:541) e
**dobra a chance** (motor.js:697, 541).

**Dano verdadeiro**: existe e ignora tudo — R do Darius (motor.js:1851-1852), N de execução
(motor.js:1805-1806), execução da Katarina (motor.js:2240).

**Hemorragia (DOT do Darius)**: `danoSangue = (13 + 0.3*bonusAd + 4*nivel)/5` **por acúmulo e por
segundo** (motor.js:1631), até **5 acúmulos** (motor.js:1276), 5 s de duração, mitigado pela armadura
com o pen de armadura do jogador (motor.js:1645). Ao chegar a 5 acúmulos o Darius ganha
`d.poder = 5` (motor.js:1278-1281) e, enquanto durar, o **AD efetivo** é
`(ad + bonusPoder(nivel)) * (1 + vontade)` (motor.js:1329) com
`bonusPoder(n) = 30 + 200*(min(n,18)-1)/17 + 4*max(0,n-18)` (motor.js:1332) → **+358 de AD no nível 50**.

**Procs de item** (todos dentro de `golpeBasico`, motor.js:1673-1722): Lâmina Encantada 3078/3057
(`lamina`, motor.js:1672), Couraça do Defunto 3742 (+40 a cada 4 s), Céu Dividido 6610 (1.º ataque em
cada inimigo é crítico), Rei Destruído 3153 (5% da vida **atual** do alvo com **tecto**
`min(vida, 3*CURVA.hp(nivel))`, motor.js:1190-1191 e 1702), Cutelo Negro 3071 (−6% de armadura do
alvo por ataque, até 30%), Fúria do Fago 3044, Dançarina Fantasma 3046, Furacão de Runaan 3085
(15% para atiradores / 55% para corpo a corpo, motor.js:1718), Quebrapassos 6631, Hidra Raivosa 3074,
Hidra Titânica 3748 (1,5% da vida **máxima** em todos os alcançados). Nas habilidades: Luden 6655
(100 + 10% do AP em até 3, a cada 6 s), Lich 3100 (75% do AP no próximo ataque), Liandry 6653
(queima 1,5% do `vidaRefItem` por segundo, motor.js:1207), Chama Sombria 4645 (+20% abaixo de 40% de
vida), Morellonomicon 3165 (+12% abaixo de 50%), Rylai 3116 (lentidão).

**Escudos e anti-morte** (motor.js:2718-2734): escudo absorve antes da vida; Zhonya 3157 (stasis
2,5 s abaixo de 25%), Sterak 3053 (escudo de 60% da vida bónus abaixo de 30%), Anjo 3026 (volta com
50%), Véu da Banshee 3102 (bloqueia um golpe a cada 40 s), Dança da Morte 6333 (30% do dano vira
sangramento ao longo do tempo; **abater cura 15%**, motor.js:1790), Semblante 3065 (+25% em toda a
cura recebida, motor.js:1286), Égide de Fogo Solar 3068 (queima 3 + 0,5*nível + 0,3% da vida por
segundo em quem está encostado, motor.js:1629, 1633-1638).

## A4. As passivas dos campeões (o que cada kit faz de especial)

| Campeão | Passiva | Onde | Números |
|---|---|---|---|
| Darius | **Hemorragia** | motor.js:1631, 1276-1281 | DOT de 5 acúmulos + **+bonusPoder de AD** (até +358 no nível 50) |
| Darius | Vontade do General (D) | motor.js:675, 1328 | até **+42% de AD** com a vida no fim; tenacidade abaixo de 35% |
| Darius | E Apreender | motor.js:560, 516, 539 | **pen de armadura 20%→45%** (passiva, sempre activa) |
| Ezreal | Feitiço Crescente (P) | motor.js:1906-1910 | até **+50% de velocidade de ataque** (5 acúmulos, 6 s) |
| Ezreal | Q | motor.js:589, 2670 | **−1,5 s nas outras recargas** a cada acerto |
| Ezreal | W | motor.js:592, 1922 | orbe detona com dano + devolve 40→94 de mana |
| Lux | Iluminação (P) | motor.js:634, 1917 | **20 + 10*nível + 0,2*AP** por detonação (auto-ataque) |
| Lux | D Faísca | motor.js:652, 1933-1941 | a cada 3 habilidades, 3 raios |
| Yasuo | Estilo do Errante (P) | motor.js:697, 541 | **chance de crítico x2**, dano crítico x0.8; Fluxo cheio = **escudo 80+28*nível** (motor.js:2713-2717) |
| Yasuo | Q | motor.js:698, 2056 | recarga cai com a velocidade de ataque, **mínimo 1,5 s**; 2 acertos = tornado |
| Yasuo | R | motor.js:706 | **ignora 30% da armadura por 15 s** |
| Katarina | Voracidade (P) | motor.js:736-737, 1789 | giro = 30+19*nível+1*AP+0,4*AD bónus; **cada abate tira 1,5 s de Q/W/E** (5 s se for chefe); 5% do dano do giro volta como cura |
| Katarina | Adagas | motor.js:2144-2183 | Q/A/T deixam adaga; pegar → giro; **cada adaga corta o Shunpo pela metade** |
| Taric | Bravata (P) | motor.js:779-780, 1690-1696 | cada habilidade carrega **2 ataques** com dano mágico = 30+12*nível+0,15*AP+**0,4*armadura bónus**; cada um tira **1 s de TODAS as recargas** |
| Taric | W | motor.js:785, 512 | **+6%→+13,2% de armadura** passiva |
| Zac | Divisão Celular (P) | motor.js:827-829, 2426-2440 | gosmas curam **5%→2% da vida máxima + 12%→3% da que falta**; ao morrer divide-se e volta com 20%→45% (1x/5 min) |
| Zac | custo de vida | motor.js:830-854, 2395-2399 | cada habilidade custa **2%→8% da vida ATUAL**; o dano escala com a vida máxima (`ratioVida`, motor.js:825) |

## A5. Itens: stats, escalas, tectos e casos especiais

- **108 itens** (19 básicos, 40 épicos, 49 lendários) com `ad, vida, armadura, rm, va, rv, critico,
  ap, mana` + `efeito` (texto) e, em alguns, `cdr, regen, penMag, adPct, apPct, vidaPct, armPct,
  rmPct, esquiva`.
- **O que a qualidade/refino escala** — `infoItem` (motor.js:251-255):
  `m = (1 + 0.12*refino) * QUALIDADES[qual].mult` aplica-se a **ad, ap, mana, vida, armadura, rm, va,
  rv, critico, regen e cdr**. **NÃO** se aplica a `penMag, adPct, apPct, vidaPct, armPct, rmPct,
  esquiva` (esses vêm do espalhamento `...i`, motor.js:253). `BONUS_REFINO = 0.12` (motor.js:55).
- **Qualidades** (motor.js:173-179): C 0,9/0,8 (venda), B 1/1, A 1,15/1,5, S 1,35/3, SS 1,7/8.
- **Tetos**: CDR 40% (motor.js:537), pen mágica 60% (motor.js:529), velocidade de ataque **3,0**
  (motor.js:344, 534), esquiva 25% (motor.js:536), chance de crítico 100% (motor.js:541).
- **Lendário repetido é recusado** (motor.js:2879, 2891); 1 bota + 4 espaços (motor.js:28-29).
- **A `tem('id')` do motor** (motor.js:513-524, 529, 539) lê 32 itens pelo id; os que mudam a
  *régua* do boneco são só dois: **3031** (+40% no dano crítico) e **3089** (+35% em todo o AP).
  Os outros somam ou dão penetração: 2501 (+2% da vida bónus em AD), 3003 (+3% da mana em AP),
  3036 (30% de pen de armadura), 3135 (40% de pen mágica).

## A6. As regiões: níveis, spawn, respawn, tolerância e noite

- **9 locais** (motor.js:354-379) com `faixa` (nível ideal), `nm` (nível dos monstros) e `tier`:
  Rota Inferior 1-6, Rota Superior 5-13, Lobos 10-18, Campo Azul 15-23, Campo Vermelho 20-28,
  Rio 25-33, Dragão 30-38, Barão 40-48, Runeterra (aberto) e Arena (PvP).
- **A CURVA** (motor.js:272-279) — *"todo monstro segue a mesma curva por nível"*:
  `hp = (150 + 100n + n²) * ajuste(n).vida`, `ad = (9 + 4,8n + 0,13n²) * ajuste(n).dano`,
  `armadura = 5 + 1,5n`, `xp = (30 + 7n)`, `ouro = (8 + 3,5n)`; o `ajuste` vem de `balanco.js`
  (multiplicadores por faixa de nível: dano 0,65 no nível 1 até 1,0 do 21 em diante).
- **Cada espécie multiplica a curva** (`MONSTROS`, motor.js:280-298): o Barão tem **hp x16, ad x3,2,
  armadura x1,8**; a Tropa Corpo a Corpo x1/0,9/0,6.
- **Nível do monstro**: `max(n0, min(n1, nivelJogador - 2 + floor(rand*4)))` (motor.js:1118-1119) →
  **média = nível do jogador − 0,5**, sempre dentro da faixa da zona.
- **Nível do CHEFE**: `max(n0+2, min(n1+2, nivelJogador+4))` (motor.js:1121) — depende do jogador.
- **NIVEL_DIF** (motor.js:1184-1187): monstro mais de **4 níveis** acima do jogador **bate até 3x
  mais forte** (+15% por nível) e **recebe até 75% menos dano** (−7% por nível, piso 25%).
- **Noite** (motor.js:1083-1096): o mundo segue a **hora de Brasília**; noite = luz < 0,6.
  Monstro noturno (35% de chance): **hp x1,4, ad x1,25, xp x1,8, ouro x1,5**.
- **Furioso** (motor.js:1106-1111): 5% por **grupo** (um monstro do grupo): hp x4, ad x1,5, as x1,15,
  **xp x5, ouro x5**, saque sorteado 3x, espólios/runas 2x; enquanto vivo dá aura (+25% ad, +20% as)
  aos outros.
- **Fator de saque/XP por nível** (motor.js:421-424): monstro mais de 5 níveis abaixo rende −10% por
  nível, mínimo 10%.

## A7. Os chefes

- **Rodízio** (`RODIZIO_CHEFE`, motor.js:3080): Arauto = investida → pancada → olho; Dragão = sopro →
  chuva → rugido; Barão = invocar → tentáculos → ácido. Cada mecânica tem **aviso (carrega)** e
  **espera** (motor.js:3069-3079).
- **Multiplicadores** (`mecanicaChefe`, motor.js:3102-3109): investida 3,5x AD (físico), pancada 2,2x
  (físico), olho 2,6x (mágico), sopro 2,2x (mágico) **+ queimadura de 3% da vida por segundo por 4 s**,
  chuva 1,8x + 2,5%/s por 3 s, ácido 1,2x + 2,8%/s por 5 s, **rugido 0 de dano mas +50% de velocidade
  de ataque por 5 s** (motor.js:3107), tentáculos 2,6x (físico), **invocar 2 Larvas do Vazio** (motor.js:3117-3118).
- **Atordoar interrompe a carga** (excepto o rugido) e o chefe volta a esperar 6 s (motor.js:3089).
- **Barão**: ao morrer dá o **buff de 180 s** — +25% de dano, +50% de regeneração e recall em 2 s
  (motor.js:3067, 1211, 1355, 1784).

## A8. Poções

`POCOES` (motor.js:261-267): Vida 300/40 (nível 1), Vida Forte 900/110 (15), Vida Suprema 2200/260 (30),
Mana 100/30, Mana Forte 280/80. **A exaustão é GLOBAL e de 1 s** — `d.timers.pocao` é um só
(motor.js:41, 1301-1304): *"intervalo mínimo entre poções, como no Tibia"*. A escolha automática usa a
**maior poção que caiba na falta** (`escolherPocao`, motor.js:1293-1298). Em PvP: cura **x0,3** e
exaustão **6 s** (motor.js:43); curas de habilidade x0,65 (motor.js:1284).

## A9. A economia

- **Ouro por abate** = `CURVA.ouro(n) * multiplicador da espécie * (0,5 + rand*0,5) * fatorSaque *
  ouroMult` (motor.js:1071, 1758) — **média 0,75 do valor da curva**.
- **Venda no Lojista** = `floor(preco * 0,5 * (1 + 0,5*refino) * QUALIDADES[qual].venda)` (motor.js:257).
- **Valor de equipamento** (para decidir o que fica) = `preco * (1 + 0,12*refino) * mult` (motor.js:2898).
- **Refino**: `precoRefino = preco * (0,5 + 0,5*refino) * (refino >= 2 ? 2 : 1)` (motor.js:258);
  chances `[30%, 12%, 2%, 0,8%, 0,3%]` e regressão `[0, 0, 4%, 1,5%, 0,6%]` (motor.js:60-62);
  persistência por falhas (motor.js:68-80). Chegar a +5 num item de 3000 custa **~6,98 M de ouro**
  em ~520 tentativas (contas em tools/audit-game.mjs).
- **Montagem (Ornn)**: épico 1% e lendário 0,1% por tentativa (motor.js:3160), custo
  `preco * 4,8` arredondado a 50 no lendário (motor.js:3134-3135).
- **Drop**: por monstro comum, lendário de 0,004% a 0,016% conforme o tier, épico 0,05%→0,155%,
  básico 1,2%→0,85% (motor.js:1143); de **chefe**: lendário 0,1%, épico 5%, básico 40% (motor.js:1145).

## A10. Os 7 campeões (o que os distingue)

| Campeão | Papel (motor.js:870-894) | Traço mecânico |
|---|---|---|
| Darius | dano 1,1 / recebido 0,55 | DOT + execução; **pen do E**; Vontade |
| Ezreal | dano 1,12 / recebido 1,05 / vel 1,08 | atirador com **kiting** (recuo 0,6 s, fôlego, motor.js:874) |
| Lux | **dano 1,59** / recebido 1,05 | tudo mágico + passiva de detonação |
| Yasuo | dano 1,15 / recebido 0,85 / arena 1,5 | crítico dobrado + Fluxo + Parede de Vento |
| Katarina | dano 1,2 / recebido 0,75 / arena 1,75 | adagas + **Voracidade por abate** |
| Taric | dano 0,9 / recebido 0,75 / arena 0,78 | **bravata** (dano com armadura + recargas) |
| Zac | dano 1,425 / recebido 0,66 / arena 0,7 | paga com vida, **escala com a vida máxima** |

---

# PARTE B — A TABELA (ordenada por IMPACTO)

| # | MECÂNICA DO JOGO | A EXTENSÃO MODELA? | ONDE | IMPACTO | O QUE DEVE MUDAR |
|---|---|---|---|---|---|
| 1 | **Hemorragia do Darius**: DOT de 5 acúmulos (motor.js:1631) **e** o buff de AD ao chegar a 5 (`bonusPoder`, motor.js:1276-1281, 1329, 1332) | **NÃO** (zero referências) | motor.js:1631, 1278-1281, 1329, 1332 · automation.js: sem sítio | **ALTO** | O AD efetivo do Darius em luta é `(ad + bonusPoder(nível))*(1+vontade)`; somar o DOT `(13+0,3*bAd+4n)/s` a 5 acúmulos. Sem isto, o boneco predefinido do jogo é avaliado ~2x abaixo |
| 2 | **Pen de armadura do KIT** (Darius E 20%→45%, motor.js:560) | **NÃO** — `inject.js:113-115` descarta o campo `pen`; `buffDoTexto` (automation.js:1454) só lê `/ignoram X% da armadura/` e a E do Darius diz *"Dá penetração de armadura (passiva)"* (motor.js:561) | motor.js:516, 539, 560 · inject.js:113 · automation.js:1454, 1478 | **ALTO** | Passar `pen` no `serialKit` e usá-lo em `penArmadura = 1-(1-penE)*(1-0,7 se 3036)` (motor.js:539). Vale +36% de dano contra o Barão |
| 3 | **Pen de ARMADURA é um stat diferente de pen MÁGICA** (motor.js:1202) | **AO CONTRÁRIO** — para campeão AD a mitigação usa `S.pen`, que é o campo `penMag` do item (automation.js:3235, 3243) | automation.js:3285, 5398 (e 1740) · motor.js:1202, 529, 539 | **ALTO** | O dano físico tem de usar a pen de armadura (3036 + pen do kit); a pen mágica só entra no ramo mágico. Hoje um Yasuo ganha "pen de armadura" por equipar a bota de pen mágica |
| 4 | **Voracidade por abate** (Katarina): −1,5 s em Q/W/E por abate, −5 s por abate de chefe (motor.js:1789) | **NÃO** | motor.js:736, 1789 · automation.js:1403, 3280 (usa o `cd` cru) | **ALTO** (Katarina) | A recarga efectiva num farm de 25 abates/min é `cd/(1+1,5/T)` = **63% mais rápida**; a Voracidade também **cura 5% do giro** (motor.js:736, 2169) |
| 5 | **Escudos** (Yasuo P/B, Taric W/F, Zac G, itens 3053/3157/3026) | **NÃO** — `avaliar` só usa `player.vida` (automation.js:1657-1679) | motor.js:697, 721, 785, 801, 840, 2718-2734 · automation.js:1657-1679 | **ALTO** | A pergunta do dono é *"sobrevive?"*: somar a vida efectiva. Só o Fluxo do Yasuo vale 1.480 no nível 50 (+37% de vida) |
| 6 | **Escalas de kit por vida/armadura** (Zac `ratioVida` motor.js:825; Taric `0,4*armadura` na bravata motor.js:780) | **NÃO** — `serialKit` descarta `ratioVida`; a bravata é função, não campo | motor.js:780, 825 · inject.js:113-115 | **ALTO** (Zac/Taric) | Para o Zac, vida é **dano** (+2%→+10% da vida máxima por habilidade); para o Taric, armadura é **dano** (+0,4 por ponto). A régua actual (pesos de stat) trata-os como defesa pura |
| 7 | **Crítico** (chance e multiplicador): motor.js:499, 515, 541, 1213, 1700 | **NÃO** — `readStats` lê "Crítico" (automation.js:1212) e `player()` descarta-o (1226); o 3031 só entra como peso (4143) | automation.js:1212 vs 1226, 4143 · motor.js:499, 515, 541 | **ALTO** (Yasuo/AD) | O sim-chefes mede a build AD/crítico a **2,5x–2,8x** a de AP contra o Barão (tools/sim-chefes.mjs, parte [2]) e a extensão não tem o crítico em nenhuma conta de dano |
| 8 | **Roubo de vida** (motor.js:1226-1230: cura = dano do auto × rv; 3065 +25%) | **NÃO** na sobrevivência (só peso ×4 em automation.js:4107) | motor.js:1226-1230, 1286 · automation.js:1672-1674 | **ALTO** | O sim-chefes mostra que trocar o 3153 por um item de rv muda a tupla em **44 s e 49 poções** (tools/sim-chefes.mjs parte 3). `avaliar` nunca soma rv a `curaTotal` |
| 9 | **Nível do chefe** `max(n0+2, min(n1+2, nível+4))` (motor.js:1121) | **AO CONTRÁRIO (parcial)** — a extensão usa `nm[1]+2` (automation.js:3933, 5761) | motor.js:1121 · automation.js:3933, 5761 | **MÉDIO-ALTO** | Um jogador 25 no Rio enfrenta o Arauto **nv 29**, não nv 35 (o modelo dá HP x1,25 e AD x1,31 a mais). Muda a decisão de "já dá para o chefe?" |
| 10 | **NIVEL_DIF** (motor.js:1184-1187) | **SIM** em `avaliar`/`danoMecanica` (automation.js:1652-1655, 1547-1549) **mas NÃO** em `estimarSet`/`scoreSet` (3285, 5398) | motor.js:1184-1187 · automation.js:3285, 5398 | **MÉDIO** | A pontuação de build contra um alvo acima do nível ignora que o jogador faz até 25% do dano; a build "ideal" para conteúdo acima do nível sai optimista |
| 11 | **CDR dos itens 2022 / 3108 / 3802** (o motor injecta 5% em motor.js:16, 25, 26; o catálogo `itens.js` não tem o campo) | **NÃO** no `statsSet` (o inject manda o catálogo cru, inject.js:161) | motor.js:16, 25, 26 · inject.js:161 · automation.js:3235-3243 | **MÉDIO** | Ler o `cdr` do motor (ou repor o patch) — hoje esses 3 itens valem 0 de CDR na simulação de builds |
| 12 | **Queima dos chefes** (sopro 3%/s por 4 s, chuva 2,5%/s, ácido 2,8%/s — motor.js:3105-3108) | **NÃO** — `MECANICA` (automation.js:1530-1538) só tem o multiplicador do golpe | motor.js:3105-3108 · automation.js:1530-1538, 1551 | **MÉDIO** | O sopro do Dragão = 12% da vida máxima do jogador **além** do golpe; é dano que a poção tem de cobrir |
| 13 | **Rugido do Dragão** (+50% de velocidade de ataque por 5 s, motor.js:3107) | **NÃO** — `rugido: {mult: 0}` e o código salta `mult == 0` (automation.js:1667) | motor.js:3107 · automation.js:1535, 1667, 1577 | **MÉDIO** | É uma mecânica de **aceleração**, não de dano: entra como factor no DPS tomado, não no pior golpe |
| 14 | **Bravata do Taric reduz 1 s de TODAS as recargas** por golpe (motor.js:1693) | **NÃO** (`reduz`/`reduzQ` descartados) | motor.js:779, 1690-1696 · inject.js:113-115 | **MÉDIO** (Taric) | É o motor de DPS do Taric: 2 golpes por habilidade × 1 s de recarga em tudo |
| 15 | **Q do Ezreal reduz 1,5 s das outras recargas** (motor.js:2670) | **NÃO** (`reduz` descartado) | motor.js:589, 2670 · inject.js:113-115 | **MÉDIO** (Ezreal) | Mesma família do item 4: recargas que andam com o combate |
| 16 | **Passiva da Lux** (20+10*nível+0,2*AP por detonação, motor.js:634) | **NÃO** — `base` é função e o `serialKit` descarta funções | motor.js:634, 1917 · inject.js:117 | **MÉDIO** (Lux) | A cada habilidade seguida de auto-ataque há uma detonação; no nível 50 são 520 + 0,2*AP por acerto |
| 17 | **Kiting dos atiradores** (motor.js:2679-2691) | **NÃO** em `avaliar` (assume contacto permanente, automation.js:1661) | motor.js:872-878, 2679-2691 · automation.js:1661 | **MÉDIO** (conservador) | O Ezreal recua 0,6 s a cada 1,6 s enquanto tem fôlego; o dano tomado real é menor do que o modelo — a extensão recusa zonas que o boneco aguenta |
| 18 | **Teto dos itens de % da vida** `vidaRefItem` (motor.js:1190-1191) | **SIM** (já corrigido: `PASSIVA_POR_ALVO`, automation.js:3947) **mas só na fase chefe**, por regra declarada (automation.js:4793-4802) | motor.js:1190-1191, 1702 · automation.js:3947, 4802, 4832 | **MÉDIO** | A regra é do Lead (2026-10-14) e o simulador contradi-la em parte: o 3153 é a peça **#1 de 33.915 builds** contra o Barão (tools/sim-build.mjs S6) e a build IDEAL (fase `null`) não a promove. **PRECISA DE REGRA DO DONO**: a build "ideal" deve ser a de chefe? |
| 19 | **Escala por qualidade/refino**: cdr ESCALA, penMag NÃO (motor.js:254-255) | **SIM** (correcção de 2026-10-14, automation.js:3239-3243) | motor.js:254-255 · automation.js:3239-3243 | — (feito) | Está certo: `cdr += c*m`, `pen += pm` |
| 20 | **Custo de mana das habilidades** (motor.js:1578, 1171-1174) | **NÃO** (`custo` descartado; `semMana` nunca usado) | motor.js:1578 · inject.js:113 · automation.js:1285, 1300 | **BAIXO-MÉDIO** | Sem mana não há habilidade: um build de CDR sem mana vale menos do que o modelo diz |
| 21 | **Valor de venda/equip e preço do refino** (motor.js:257-258, 2898) | **SIM** (automation.js:1046-1056; conferido com o print do dono) | motor.js:257-258, 2898 · automation.js:1046-1056 | — (feito) | — |
| 22 | **Poções: cura, preço, nível mínimo, exaustão global de 1 s** (motor.js:41, 261-267, 1301) | **SIM** (automation.js:892-901, 1500-1519) | motor.js:41, 261-267 · automation.js:892-901 | — (feito) | `POCAO_PVP` é lido mas nunca usado (0 ocorrências) — só importa na Arena |

### Outras divergências menores (mesma origem: o `serialKit` só reencaminha 22 campos)

O `inject.js:113-115` reencaminha `nivel, max, base, ratio, recarga, adRatio, mult, alvos, duracao,
golpes, venenoBase, venenoRatio, venenoT, vaAdaga, acumMax, duracaoSinistra, curaGiro, adaga, auto,
dot, passiva, util`. **Verificado por script** (tools/audit-game.mjs, secção F15): são descartados
`pen, custo, custoVida, ratioVida, pctAlvo, va, bonus, bonusHab, penSuspiro, duracaoPen, voracidade,
voracidadeChefe, escudo, escudoPct, cura, curaBase, curaGosma, vontade, defesaBonus, reduz, reduzDano,
armPassiva, pulso, curaDano, bonusSangue, executa, reembolso, shunpo, curaSede, inquieta, reducao,
segura, levanta, bonusSombra`.

Consequências que **não** estão na tabela (impacto médio-baixo, mesma correcção):
Vontade do General do Darius (+42% AD), Estandarte (+56% armadura/RM), Domínio de Noxus (+30% de dano
acumulado), Fúria Sanguinária (12%→39% de roubo), Banho de Sangue, Ruptura +35% em quem sangra,
Parede de Vento (−30%→−48% de dano), Último Suspiro (30% de pen — parcialmente coberto pelo texto),
Sede de Sangue, Lâmina Sinistra, Passo das Sombras (+100%→+172% no próximo golpe), Execução Noxiana,
gosmas do Zac (cura + adiantar recargas), Membrana, Poça Ácida, Mitose, Regeneração Química,
Explosão Celular, escudo/Égide do Taric, Pele de Diamante (devolve dano), Chuva de Estrelas,
Supernova (25% do dano vira cura), Prisma Regenerador, Farol, Tornado, Apogeu (3%→7% da vida máxima
em chefes), Sobrecarga Arcana, Descarga Shurimane, Tiro do Explorador, Passagem Shurimane.

---

# PARTE C — AS PROVAS (números) E O QUE MUDA NA DECISÃO

Todos os números abaixo saem de `node tools/audit-game.mjs` (contas próprias, cada fórmula com
`file:linha`) ou de `node tools/sim-build.mjs` / `node tools/sim-chefes.mjs` (corridos nesta
auditoria; saídas em bruto descritas no Anexo).

## C1. Pen de armadura do kit do Darius (impacto ALTO)

Armadura do Barão no nível 50 = `CURVA.armadura(50) * 1,8` = `(5+75)*1,8` = **144** (motor.js:276, 297).
Com E rank 10 (`pen = 0,45`, motor.js:560):

| | mit = 100/(100+arm) | dano relativo |
|---|---|---|
| sem pen nenhuma | 0,4098 | 1,00 |
| **só o pen do kit** | **0,5580** | **+36,2%** |
| kit + 3036 (o motor, motor.js:539) | 0,5303 | +29,4% |
| **só 3036 (o que a extensão modela)** | 0,4980 | +21,5% |

A extensão fica **6,5% abaixo** do motor no Barão e **4,4% abaixo** no mob do Barão (armadura 77) —
mas o erro maior não é o número absoluto: é que **o pen do kit não depende de item nenhum**, logo
o Darius real já tem 45% de pen e o item de pen (3036) rende **muito menos** do que a extensão pensa
(multiplicativo: `1-(1-0,45)(1-0,30) = 0,615`, e não 0,30 isolado). Muda a **ordem dos itens**:
com o pen do kit, o 3036 vale ~+7,5% de dano e não os ~+20% que a régua actual sugere.

## C2. Hemorragia do Darius (impacto ALTO)

`DANO_SANGUE = (13 + 0,3*bonusAd + 4*nível)/5` por acúmulo e por segundo (motor.js:1631); a 5 acúmulos
é `13 + 0,3*bAd + 4n` por segundo:

| nível | AD de itens | DOT a 5 acúmulos (bruto) | depois de armadura 77 + pen do kit |
|---|---|---|---|
| 30 | 148 | 177/s | **125/s** |
| 40 | 188 | 229/s | **161/s** |
| 50 | 228 | 281/s | **198/s** |

E o buff de AD ao chegar a 5 acúmulos (motor.js:1278-1281, 1329, 1332):
nível 30 **+278**, nível 40 **+318**, nível 50 **+358 de AD** por 5 s. Um Darius nível 50 com 300 de AD
passa a **658 de AD (x2,19)** enquanto o buff dura. Nada disto existe na extensão (zero referências a
`hemorragia`/`bonusPoder` em automation.js).

**O que muda:** o Darius é o campeão predefinido e a extensão o avalia por auto-ataque + habilidades
sem DOT e sem buff. A decisão de "matar em quantos segundos" e a comparação entre um item de AD e um
item de vida saem desviadas exactamente na direcção que o dono mais sente (o DOT cresce com o AD e
não custa mana).

## C3. Voracidade por abate (impacto ALTO na Katarina)

Cada abate tira 1,5 s de Q/W/E (motor.js:1789). Num farm com um abate a cada `T` segundos, as
recargas andam a `1 + 1,5/T`:

| abates/min | T | recargas | DPS das habilidades |
|---|---|---|---|
| 10 | 6,0 s | x1,25 | +25% |
| 15 | 4,0 s | x1,38 | +38% |
| 20 | 3,0 s | x1,50 | +50% |
| 25 | 2,4 s | x1,63 | **+63%** |
| 30 | 2,0 s | x1,75 | +75% |

A extensão calcula `dps = total/cd` com o **cd cru** (automation.js:1403, 3280). Também falta a cura
da Voracidade (5% do dano do giro, motor.js:736, 2169-2170).

**O que muda:** a Katarina é a campeã em que o sim-chefes mede a maior diferença entre a build do bot
(AP) e a ideal (AD/crítico): **993 vs 2757 dps** contra o Barão nv 42 (tools/sim-chefes.mjs parte [2]).
Parte dessa diferença é o CDR/Voracidade que a régua do bot não vê.

## C4. Pen mágica aplicada a dano físico (impacto ALTO)

`statsSet` soma `pen += it.penMag` (automation.js:3243) e `estimarSet`/`scoreSet` usam esse valor
como `(1 - pen)` da **armadura** para campeões AD (automation.js:3285, 5398). No catálogo só o
**3020** (8%) e o **3175** (15%) têm `penMag`, e o **3135** dá 40% por código (motor.js:529).
O **3036** (30% de pen de armadura) não tem `penMag` nenhum — verificado.

**O que muda:** a bota de pen mágica (3175) aparece como "pen de armadura" no ranking de um Yasuo, e o
3036 não tem pen nenhuma na conta. É a diferença entre escolher a bota certa e a bota errada.

## C5. Nível do chefe (impacto MÉDIO-ALTO)

| zona | nm | jogador | motor (motor.js:1121) | extensão (3933) | HP | AD |
|---|---|---|---|---|---|---|
| Rota Inferior | 1-6 | 1 | 5 | 8 | x1,58 | x1,62 |
| Rota Superior | 5-13 | 5 | 9 | 15 | x1,84 | x2,00 |
| Lobos | 10-18 | 10 | 14 | 20 | x1,61 | x1,70 |
| Rio | 25-33 | 25 | 29 | 35 | x1,25 | x1,31 |
| Barão | 40-48 | 40 | 44 | 50 | x1,13 | x1,16 |

**O que muda:** quem está a subir de nível é empurrado para longe dos chefes por um modelo que
assume o topo da zona; o primeiro nível em que o Barão é enfrentável sai **mais alto** do que o real.
O sim-chefes mostra a diferença: o Barão para um jogador nv 30 é **nv 42** (não 50) — HP 97.824 em vez
de 122.400 (tools/sim-chefes.mjs parte [1]).

## C6. Escudos e vida efectiva (impacto ALTO em "sobrevive?")

| fonte | fórmula | valor no nível 50 (4.000 de vida) |
|---|---|---|
| Yasuo P (Fluxo) | 80 + 28*nível (motor.js:697) | **1.480** (+37% de vida) |
| Yasuo B | 12% + 2%/rank (motor.js:721) | 1.200 |
| Taric F | 12% + 1,5%/rank + 0,5*AP (motor.js:801) | 1.200 |
| Zac G | 8% + 0,8%/rank (motor.js:840) | 800 |
| 3053 Pele de Aço | 60% da vida bónus abaixo de 30% (motor.js:2726) | ~1.000 |
| 3157 Zhonya / 3026 Anjo | stasis 2,5 s / volta com 50% (motor.js:2722, 2729) | qualitativo |

**O que muda:** o `avaliar` decide `mortal`, `tMorrer` e `mix` (automation.js:1665-1679) com a vida
crua. Um Yasuo com o Fluxo cheio aguenta um golpe que o modelo diz que mata — e o contrário também:
o modelo manda fugir de uma zona onde o boneco aguenta.

## C7. Crítico (impacto ALTO na build AD)

`danoCritico` base **1,75** (motor.js:499), **+0,4** com 3031 (motor.js:515), **x0,8** no Yasuo
(motor.js:541 → 1,40 / 1,72), e a chance do Yasuo é **dobrada** (motor.js:697). A extensão lê
"Crítico" da ficha (automation.js:1212) e **descarta-o** (1226); o multiplicador só existe como peso
(automation.js:4143). O sim-chefes mede a build AD/crítico a **2,5x–2,8x** a build AP contra o Barão
(tools/sim-chefes.mjs, verificação S9: Katarina 3183 vs 1271; Yasuo 6155 vs 1403).

**O que muda:** com o crítico fora da conta, o 3031 e o 3046 valem o que os pesos dizem e não o que o
jogo aplica. É o caso em que a extensão erra o **item central** da build de um campeão inteiro (Yasuo).

## C8. Roubo de vida na sobrevivência (impacto ALTO na tupla)

O motor cura `dano do auto × rv` (motor.js:1226-1228), com +25% do 3065 (motor.js:1286). O sim-chefes
mede o custo de oportunidade: tirar o 3153 e pôr um item de rv (3078) muda a luta do Barão de
**35,15 s com 12 poções (760 g)** para **79,6 s com 61 poções (6.450 g)** — 44 s e 49 poções
(tools/sim-chefes.mjs parte 3). `avaliar` (automation.js:1672-1674) nunca soma rv a `curaTotal`.

**O que muda:** a decisão de trocar um item de dano por um de rv — que é o critério do dono
(*"as poções ficam caras por ser muito uso, a build ideal muda de novo pra roubo de vida"*) — não
tem hoje número no modelo de sobrevivência.

## C9. Escalas por vida/armadura do Zac e do Taric (impacto ALTO nesses dois)

- **Zac** (`danoZac`, motor.js:825): Q +2,5%, E +2%, R +1,5%, T +3%, **N +10% da vida máxima dele**.
  Com 5.000 de vida, o N ganha **+500** e o T **+150** por lançamento — e a extensão não vê
  `ratioVida` (descartado em inject.js:113-115).
- **Taric** (motor.js:780): bravata = 30 + 12*nível + 0,15*AP + **0,4*armadura bónus**; com 200 de
  armadura bónus são **+80 por golpe** e são **2 golpes por habilidade**, mais 1 s de recarga em tudo
  (motor.js:1693).

**O que muda:** para estes dois, um item de vida/armadura é **ofensivo**, não defensivo. A régua
actual (pesos de stat por perfil, automation.js:3798-3804) pontua-os como defesa.

---

# PARTE D — O QUE NÃO CONSEGUI VERIFICAR

1. **Os dados-base dos campeões** — `motor.js:3-8` importa `dados-ezreal.js`, `dados-yasuo.js`,
   `dados-lux.js`, `dados-katarina.js`, `dados-taric.js` e `dados-zac.js` e **nenhum existe em
   `docs/game-src/`** (só `dados.js`, o do Darius). Tudo o que depende de `hp/hpperlevel/armor/
   attackdamage/attackspeed` dos outros 6 não pode ser conferido a partir do repositório — os
   simuladores usam bases **calibradas por medição** (`sim-chefes.mjs` diz "CALIBRADO" para o Yasuo e
   "CALIBRADO NAO VERIFICADO" para a Katarina).
2. **O que a página real escreve no DOM.** Não posso abrir o browser (proibido). O `parseDica`
   (automation.js:1311-1329) lê o tooltip; confirmei por código que o jogo escreve a linha de CDR como
   `−{v}% recarga` (jogo.js:185), que **casa** com o regex de `parseDica` — logo a divergência de
   regex que encontrei (o texto do efeito `"−15% na recarga das habilidades"` **não** casa,
   verificado em tools/audit-game.mjs F15) **não é um bug activo** para itens que têm o campo no
   catálogo; é uma fragilidade se algum item passar a ter o CDR só no texto.
3. **Se o `inject.js` publica o `rmMonstro`.** Verifiquei que **não publica** (0 ocorrências) e que
   `META.rmMonstro` nunca é usado (1 ocorrência, a do próprio fallback em automation.js:1036) → o
   0,6 vem do fallback, que por acaso é o valor certo do motor (motor.js:1179). Não é erro hoje; é
   violação da REGRA Nº 3 (número copiado em vez de lido).
4. **A Fúria Sanguinária / Sede de Sangue / cura do giro em combate real** — a extensão mede a cura
   das skills por eventos de canvas (automation.js:839-861), mas não consegui confirmar, sem browser,
   qual a fracção de cura que o `healSkillS` medido apanha (o inject.js conta `+` de várias cores,
   inject.js:23-28).
5. **O mercado de jogadores** (preços, taxas, concorrência) — li a estrutura (automation.js:365-371,
   3663-3738) mas não validei preços reais; não há dados no repositório além de `docs/snapshots/market.json`
   (58 bytes, vazio).
6. **A Vilemaw e o chefe global** (`docs/game-src/vilemaw.js`, `chefe-global.js`) — não fazem parte do
   caminho de `lolidle.com/jogar` e não os analisei.
7. **O PvP/Arena** (`arena-pvp.js`, `POCAO_PVP`) — fora do âmbito do auto-farm; `META.pocaoPvp` é
   lido e nunca usado (0 ocorrências).
8. **A persistência do Ornn e a economia do refino a longo prazo** — calculei o custo esperado
   (~6,98 M para +5 num item de 3000, tools/audit-game.mjs F9) mas **não** modelei a persistência por
   falhas (motor.js:68-80) nem as gemas.

---

# ANEXO — o que já foi corrigido hoje e o que ficou mal feito

Correções de 2026-10-14 que **estão certas** (verificadas por leitura do código):
`RM_MONSTRO` no ramo mágico (automation.js:1025-1027, 3285); `penMag` **não** escalado por
qualidade/refino (automation.js:3239-3243, contra motor.js:254-255); CDR **só** na parcela das
habilidades (automation.js:5405-5420); `fJ` de NIVEL_DIF em `avaliar` (automation.js:1652-1655);
`PASSIVA_POR_ALVO` para o 3153 com o tecto de 3x a curva (automation.js:3917-3957, motor.js:1190-1191);
valores de venda/equip (automation.js:1046-1056, motor.js:257-258).

Correções que ficaram **mal feitas / incompletas**:

1. **`penMag` tratado como pen de armadura para campeões AD** (automation.js:3285, 5398) — o
   `statsSet` foi corrigido para *não escalar* o pen, mas o pen que ele devolve continua a ser o
   **mágico** e continua a ser aplicado à **armadura** no ramo físico. A correcção parou a meio.
2. **`PASSIVA_POR_ALVO` só entra na fase `chefe`** (automation.js:4802) — é uma **regra declarada**
   (comentário automation.js:4793-4801), não um descuido; mas a build IDEAL (fase `null`) também não
   a promove, e o sim-build mede o 3153 como a peça **#1 de 33.915** contra o Barão. A regra precisa
   de ser reconciliada com o simulador — **PRECISA DE REGRA DO DONO** (a build ideal é a de chefe?).
3. **`danoMecanica` (automation.js:1541-1552) tem o seu próprio `ND`** com fallback sem
   `danoJogador`/`minDanoJogador` (o `avaliar` tem outro, completo) — duas cópias da mesma regra.
4. **Os multiplicadores de `MECANICA` (automation.js:1530-1538) são hardcoded** enquanto
   `META.mecanicas` e `META.habChefe` são reencaminhados pelo inject (automation.js:963, 983) e
   **nunca lidos** (0 ocorrências de `META.mecanicas`, `META.habChefe`, `META.pocaoPvp`,
   `META.espacos`, `META.grupo`) — viola a REGRA Nº 3 do AGENTS.md.
5. **`inject.js:133-139`** continua a copiar à mão a `CURVA` (`{hp:[150,100,1], ...}`),
   `grupoSpawn` e `respawn` — os três exemplos que o próprio AGENTS.md aponta como quebrados.

## Simulações corridas nesta auditoria

```
node tools/audit-game.mjs      # contas desta auditoria (cada fórmula com file:linha)
node tools/sim-build.mjs       # 810 linhas, exit 0
node tools/sim-chefes.mjs      # 349 linhas, exit 0
```

Do **sim-build** (build AD/crítico, Katarina nv 29 vs o Dragão do próprio simulador):
vencer a bota de CDR + Ímpeto (2063 dps, mata em 3,65 s) contra "sem CDR nenhum" (1360 dps, 5,54 s);
no chefe 702 dps (139,27 s) contra 474 dps (206,39 s). A busca exaustiva de **33.915 builds** contra o
Barão dá `3172, 3031, 3036, 3046, 3153` com **1375 dps** e a build do bot **608 dps** (126,1% a mais);
a linha final do simulador diz: `NAO VERIFICADO: os 18,6% (bota de CDR) e 17,25% (bota de pen) do Lead
nao saem das contas do motor — ver Q8`.

Do **sim-chefes** (o critério do dono: sobrevive? mata em quantos segundos? quantas poções?):

```
yasuo | IDEAL (busca) | 3172,3153,3078,3031,3036
   nv30 (Barao nv42) | dps 2258 | mata em 43.3 s | pocoes 28 (minimo 26) | hpMin 1423 (32.4%) | ouro em pocoes 3140 | sem pocao: morre aos 9.95 s
katarina | IDEAL (busca) | 3172,3153,3031,3036,3046
   nv30 (Barao nv42) | dps 1431 | mata em 68.35 s | pocoes 52 (minimo 50) | hpMin 186 (4.3%) | ouro em pocoes 7390 | sem pocao: morre aos 9.95 s
katarina | EXTENSAO (bot) | 3175,3089,3135,3100,6653
   nv31 (Barao nv42) | dps 668 | mata em 146.4 s | pocoes 134 (minimo 134) | hpMin 10 (0.2%) | ouro em pocoes 25060 | sem pocao: morre aos 8.75 s
```

Isto é o retrato do problema desta auditoria: a build que a extensão escolhe para a Katarina mata o
Barão em **146,4 s com 134 poções (25.060 g)**; a build que o motor do jogo indica mata em
**68,35 s com 52 poções (7.390 g)** — e a diferença está nas mecânicas que a régua não lê
(crítico, % da vida do alvo, Voracidade por abate), não em DPS bruto.

## Resumo em uma linha por prioridade

1. **Darius**: DOT da Hemorragia + buff de AD + pen do E (itens 1 e 2 da tabela) — o campeão
   predefinido é o mais mal modelado.
2. **Pen de armadura ≠ pen mágica** (item 3) — muda a escolha de itens em todos os campeões AD.
3. **Crítico e roubo de vida fora das contas** (itens 7 e 8) — decide a build do Yasuo e a tupla de
   poções.
4. **Escudos, escalas por vida/armadura, Voracidade por abate** (itens 4, 5, 6) — "sobrevive?" e o DPS
   do Zac/Taric/Katarina.
5. **Nível do chefe e queima das mecânicas** (itens 9, 12, 13) — quando enfrentar o chefe e quantas
   poções levar.
