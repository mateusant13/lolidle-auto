# Mapa do motor — RE estático de `docs/game-src/*.js`

> **Método**: leitura estática de ficheiros com `grep`/`read`. **Nenhum browser, nenhum CDP, nenhum `bun tools/ll.mjs`, nenhum processo do jogo foi executado.** Todas as afirmações citam `ficheiro:linha`.
>
> **Legenda de ficheiros** (todos em `docs/game-src/`): `motor.js` (3791 l., motor de regras), `arena.js` (1789 l., Runeterra/mundo aberto), `jogo.js` (7072 l., UI/HUD), `cena.js` (5903 l., canvas), `itens.js` (2583 l., catálogo Data Dragon 16.19.1), `balanco.js` (3 l., planilha), `wiki-dados.js` (147 l., números derivados).
>
> **Ficheiros AUSENTES** (importados mas não fornecidos) — ver §9: `runeterra.js`, `chefe-global.js`, `mundo.js`, `i18n.js`, `dados.js`, `dados-ezreal.js`, `dados-yasuo.js`, `dados-lux.js`, `dados-katarina.js`, `dados-taric.js`, `dados-zac.js`, `arena-pvp.js`, `campeoes.js`, `mapa.js`, `pixel.js`, `fx.js`, `guiilda.js`/`guilda.js`, `som.js`, `rede.js`, `tempo-real.js`, `ganhos.js`, `orbs.js`, `entrada.js`, `dialogo.js`, `tutorial.js`, `novidades.js`, `ornn-anim.js`, `dicas.js`, `vilemaw.js`.
>
> Números marcados **(derivado)** foram calculados reimplementando as fórmulas citadas (aritmética pura), não foram lidos de nenhum save nem do jogo.

---

## 1. Spawn e waves

### 1.1 Onde a wave é criada (Summoner's Rift)

- O loop de combate é `passo(estado, c, dt)` (`motor.js:1334`). Sem inimigos vivos, ele conta `c.respawn` e, quando chega a 0, chama `gerarGrupo` (`motor.js:1418-1425`).
- `c.respawn` inicial = **1 s** (`criarCombate`, `motor.js:1061`); depois de limpar um grupo inteiro = **1,5 s** (`motor.js:1625`); ao viajar para outro local = **1,2 s** (`viajar`, `motor.js:3046`). Nesse intervalo o `passo` faz `return` na linha `1420` — a regeneração natural e os temporizadores de efeito **já correram** antes (`motor.js:1354-1394`), o que é saltado é só o combate (spawn, alvos, ataques, abates).
- **`gerarGrupo(local, noite, nivelJogador)`** (`motor.js:1116-1130`) é a única fonte de grupos do Rift. Passo a passo:
  1. **Chefe primeiro** (`motor.js:1121`): se `local.chefe` existe e `Math.random() < local.chefe[1]` (`0.015` = **1,5 %** em rio/dragão/barão, `motor.js:368,370,372`), o grupo é **substituído por 1 chefe** — não há wave de tropas junto. Nível do chefe: sem nível de jogador `n1+2`; com jogador `Math.max(n0+2, Math.min(n1+2, nivelJogador+4))` (`motor.js:1121`). `chegada: 1.8` s.
  2. **Tamanho da wave**: `const qtd = 2 + Math.floor(r() * 3)` → **2, 3 ou 4 monstros**, uniforme (`motor.js:1124`). Máximo de monstros simultâneos no Rift = 4 (o tamanho máximo da wave); não existe cap separado no motor.
  3. **Espécies**: sorteio ponderado pelos pesos de `local.monstros` (`motor.js:1122-1123`); a soma dos pesos é o total (`total`), logo a probabilidade de cada espécie é `peso/total`.
  4. **Nível de cada monstro** (`motor.js:1118-1119`):
     - bot/sem nível conhecido: `n0 + floor(rand*(n1-n0+1))` (uniforme na faixa da zona);
     - com nível do jogador: `Math.max(n0, Math.min(n1, nivelJogador - 2 + floor(rand*4)))` → **jogador−2, −1, 0, +1** (uniforme), truncado à faixa `nm` da zona.
  5. **Atraso de chegada** (`motor.js:1126`): `chegada = 1.2 + k*0.25` com `k` = índice do monstro na wave → **1,20 / 1,45 / 1,70 / 1,95 s**. Ao atirador (Ezreal/Lux) soma-se `kit(estado).chegadaExtra = 1.2` (`motor.js:1423`, `KITS` `motor.js:872,877`) → 2,40–3,15 s.
  6. **Furioso** (`motor.js:1124,1127`): `furioso = r() < FURIOSO.chance (0.05) ? floor(r()*qtd) : -1` → **5 % por grupo**, e um monstro aleatório da wave (`floor(rand*qtd)`) vira furioso. O chefe nunca é furioso (o ramo do chefe retorna antes, `motor.js:1121`).
  7. **Noturno** (`motor.js:1128`): só se `noite` e apenas nos monstros que **não** ficaram furiosos: `r() < NOTURNO.chance (0.35)` → **35 % por monstro** (esperado ~1,05 noturno por wave de 3). `noite` vem de `ehNoite(estado) = luzDoDia(relogio) < 0.6` (`motor.js:1093`), com ciclo de 24 h reais (dia 6h30–17h30 = luz 1; 17h30–18h30 desce a 0,28; 5h30–6h30 sobe; resto 0,28 — `motor.js:1083-1089`), fuso −3 (`motor.js:1090-1095`).
- **Onde nascem no espaço (Rift)**: o motor **não tem coordenadas** para o Rift — o único descritor espacial é `chegada` (segundos até encostar). Quem dá posição é a camada de desenho: `Cena.surgir` coloca cada criatura em tiles livres a **4–6 tiles** do campeão (`cena.js:627-643`), com `v.vel = max(0.12, min(0.5, inimigo.chegada / passos.length))` (`cena.js:640`); monstros de distância (`distancia > 1`) nascem num **anel** a `distancia` tiles (`cena.js:619`, `cena.js:650-655`). Posições absolutas de zona do Rift existem só no mapa decorativo `LOCAIS[].pos` (§5) e no minimapa (`jogo.js:3830-3838`).

### 1.2 Modificadores (valores exatos)

| Modificador | Quando | Efeitos | Fonte |
|---|---|---|---|
| Noturno | 35 %/monstro, só à noite, nunca com furioso | `hp×1.4`, `ad×1.25`, `xp×1.8`, `ouro×1.5` + **1 sorteio extra** de loot, espólio e gema | `motor.js:1096-1101`, `1113` |
| Furioso | 5 %/grupo, 1 monstro | `hp×4`, `ad×1.5`, `as×1.15`, `xp×5`, `ouro×5`, **3 sorteios** de loot (`saque:3`), **2 extras** de espólio/gema (`extras:2`); aura enquanto vivo: outros do grupo `ad×1.25`, `as×1.2` | `motor.js:1106-1111`, `1113`, `1729-1730` |
| Chefe | 1,5 %/grupo nas 3 zonas com chefe | substitui a wave inteira; `chegada 1.8`; loot próprio (`DROP_CHEFE`) | `motor.js:1121`, `1145` |
| Elites/guardas (só Runeterra) | pontos `p.guardiao` | elite: `hp×15`, `ad×1.7`, `armadura×1.6`; guardião-chefe: `hp×3`, `ad×1.1`, `armadura×1.3` | `arena.js:250-254`; `wiki-dados.js:13` |

`aMais(i, n, f)` (`motor.js:1113`) é o que implementa os sorteios extra: furioso → `n-1` = 2; noturno → 1; normal → 0.

### 1.3 Runeterra (mundo aberto, `arena.js`)

- **Duas mecânicas diferentes** coexistem:
  - **Mundo aberto** (`A.pontos` existe, `arena.js:64`): cada ponto fixo guarda um monstro (`nascerNoPonto`, `arena.js:231-258`; `gerirPontos`, `arena.js:259-287`).
  - **Arena sem pontos** (a ponte da Arena/`aram`, `motor.js:377`): spawn contínuo estilo Rift: `AR.vivosMax = 3`, `AR.intervalo = 1.4 s`, `AR.inicio = 1.2 s` (`arena.js:20`), spawn a **7–10 tiles** do campeão (`AR.surgir = [7,10]`, `arena.js:21`, `arena.js:217`), limites do mapa `x∈[2,46]`, `y∈[2,34]` (`arena.js:219`).
- **Pontos do mundo** (`gerirPontos`, `arena.js:259-287`):
  - ponto ativo se `|p.x−A.x| ≤ MUNDO.ativo (15)` e `|p.y−A.y| ≤ 15` (`arena.js:280`); nasce se `dist(p,A) < 15` e `> 3.5` (`> 1.2` para guardião) e fora do covil da Vilemaw (`arena.js:282-284`);
  - monstro comum morto → `p.t = 0` → **renasce assim que o campeão se afasta** (`arena.js:273`); monstro não-aggro a mais de `MUNDO.some = 20` tiles **desaparece** e o ponto é liberado (`arena.js:276`);
  - guardião morto → `p.t = 10` s, larga a chave do baú (validade 10 min) e só volta quando o baú esvaziar (`arena.js:267-272`, `281`);
  - `MUNDO.respawn = [20,35]` (`arena.js:26`) **não é usado em nenhum ponto do código fornecido** — ver §9 (contradição C4).
- **Nível nos pontos** (`arena.js:232-245`): normal `clamp(nj−1+floor(rand*4), nm)` → jogador−1..+2; chefe de zona `clamp(nj+2, nm[0], nm[1]+2)` com chance `l.chefe[1]/3` (**1,5 %/3 = 0,5 %** por ponto, `arena.js:236`, `wiki-dados.js:11`); guardião `clamp(max(nj+3, nm[1]), nm[0], nm[1]+4)` (`arena.js:235`). XP/ouro de monstro acima de `nj+2` são **cortados ao valor de `nj+2`** (`arena.js:245`).
- **Noturno em Runeterra**: só em não-chefes, `r() < NOTURNO.chance` (`arena.js:222,247`). **Não existe furioso em Runeterra** (nenhuma referência a `FURIOSO` em `arena.js`).

---

## 2. Comportamento dos monstros

### 2.1 Rift (abstrato por tempo, sem pathfinding)

- Cada monstro tem `chegada` (segundos) que decresce `dt` a cada frame (`motor.js:1443`). "Já chegou" = `chegada ≤ 0` (`prontos`, `motor.js:1444`).
- **Alvo do jogador**: corpo-a-corpo mira `prontos[0]`; atiradores (`K.distancia`) miram o mais próximo por `chegada`, mesmo a caminho (`motor.js:1445-1446`). Habilidades de área/execução usam `alcancaveis = K.distancia ? vivos : prontos` (`motor.js:1587`).
- **Ataque**: só quem tem `chegada ≤ 0` ataca, e não se estiver `atordoado`, `carregando` (`motor.js:1618-1621`). Cadência: `i.ataque -= dt * (i.lento > 0 ? 0.6 : 1)`; ao zerar, `i.ataque = 1 / (i.as * aura.as)` (`motor.js:1726-1730`) — `i.as` vem da tabela `MONSTROS` (ataques/s) e nunca da velocidade de ataque do campeão. **Primeiro golpe** de cada monstro sai em `rand()/m.as` segundos (`motor.js:1072`).
- **Alcance**: corpo-a-corpo "encosta" (o `chegada` chega a 0); os de longe param a `distancia` quadrados e atiram: Tropa Mago 3, Tropa de Cerco 4 (`motor.js:283-284`); em Runeterra `+0.5` tile (`arena.js:221,246`). Dano mágico deles usa `a.rm` (`motor.js:1733-1734`).
- **Aggro/leash no Rift**: **não existem**. Não há noção de casa, distância ou desistência: o grupo fica até ser morto, o jogador viajar ou morrer (`motor.js:1618-1625`, `3046`, `1346`). O único "recuo" é o **kite** dos atiradores: `kitar` (`motor.js:2680-2691`) empurra `chegada` de todos os colados (`recuo = k.recuo*(0.4+0.6*folego)*(colados>=3 ? 0.5 : 1)`, chefes ×0.5, lentos ×1.5) gastando fôlego (`kite: {recarga:1.6, recuo:0.6, gasto:0.25, recupera:0.15, pausa:0.2}`, Ezreal `motor.js:874`; Lux `motor.js:878`).
- **Se o jogador fugir**: não há fuga parcial; `viajar()` limpa `c.inimigos = []` (`motor.js:3046`) e `voltarBase()` idem ao terminar o recall (`motor.js:1399`). O recall leva `RECALL = 4` s (`motor.js:40`), ou 2 s com buff do Barão (`motor.js:3067`).
- **Se o jogador morrer**: `morrer` põe `d.morto = 3` s (Rift; `1e9` na Arena, `motor.js:2779`); ao expirar, teleporta para a Fonte com **10 % da vida e 0 de mana**, limpa inimigos (`motor.js:1342-1351`). Custa **10 % do XP do nível** (`penalidadeMorte`, `motor.js:2763-2768`; `perdaPorMorte = 10 %` de `xpParaNivel`, `motor.js:430`). **No Rift nenhum item cai** (`motor.js:2738`).

### 2.2 Runeterra (movimento real em tiles)

- `cerebroMundo` (`arena.js:290-313`) por monstro e por frame:
  - velocidade `AR.velMonstro = 2.3` tiles/s, `×0.55` se lento (`arena.js:22, 291`);
  - **aggro**: `dist(i,A) < MUNDO.aggro (5)` — ou se o monstro apanhou (`i.hp < i.hpMax`) — e só se o campeão não está morto, não está em cidade, e não está montado (montado não chama aggro parado) (`arena.js:301-303`);
  - **vagar**: sem aggro, escolhe um ponto até 2,2 tiles da casa a cada 2–6 s e anda a 35 % da velocidade (`arena.js:305-307`);
  - **leash**: se `dist(i, casa) > MUNDO.leash (12)` (ou campeão morto/em cidade) → `aggro=false`, `voltando=true` (`arena.js:311`);
  - **volta para casa**: anda a 130 % da velocidade, regenera **25 % da vida máxima por segundo**, e ao chegar (<0,3 tile) ou após **6 s** preso reseta a vida cheia e os acúmulos de hemorragia (`arena.js:293-298`);
  - **ataque**: quando `dist(i, foco) ≤ (i.distancia || 0.9) + raioDe(i)*0.5`, chama `inimigoAtaca` (`arena.js:328-332`); quem atira de longe emite `tiroMonstro` (`arena.js:332`);
  - **colisão**: monstros não se sobrepõem nem ficam em cima do campeão (separação por raio, `arena.js:336-344`); não entram em cidade (`arena.js:78-82`);
  - `i.surgindo` (1,5 s) não é mais atribuído no spawn (`arena.js:249` diz que foi desligado), mas o motor ainda respeita: monstro surgindo **não leva dano** (`motor.js:1194`) e não ataca (`arena.js:332`).
- **Chefes de zona (Rift) com mecânica própria** — `mecanicaChefe` (`motor.js:3081-3125`): rodízio a cada `espera` (7–14 s, `HAB_CHEFE` `motor.js:3069-3079`), aviso `carrega` (0,8–1,5 s) e golpe: investida ×3.5 do AD, pancada ×2.2 + aproxima o grupo, olho 2.6 mágico, sopro 2.2 mágico + queimadura 3 %/s por 4 s, chuva 1.8 mágico + 2,5 %/s por 3 s, rugido (+50 % de velocidade de ataque por 5 s), ácido 1.2 mágico + 2,8 %/s por 5 s, tentáculos 2.6 físico; `invocar` cria 2 `Larva do Vazio` no nível do chefe−6 marcadas `invocado` (não contam para tarefas/diárias, `motor.js:3117-3121`, `1786`). Atordoamento interrompe qualquer golpe excepto `rugido` (`motor.js:3089`); a Parede de Vento do Yasuo bloqueia `GOLPES_DE_LONGE = {sopro, olho, acido}` (`motor.js:2053`, `3093`).
- **Guardiões de fortaleza** (`pisaoGuardiao`, `arena.js:1667-1737`): golpe a cada 4,5–6,5 s (`2.4+rand` se enfurecido) quando o campeão está a <7 tiles; abaixo de **30 % da vida** enfurece: `as×1.6`, `ad×1.1` (`arena.js:1669`); rodízio `pisao/investida/anel` (chefes) ou `pisao/anel` (elites) (`arena.js:1659-1663`, `1717`); dano ×2 (pisão/anel), ×3 (investida), ×2.4 (tentáculos), ×2.4 mágico (sopro), ×1.6 mágico por ponto (chuva), ×1.0 mágico (ácido, deixa poça de 3 %/s por 4,5 s) (`arena.js:1682-1709`).

---

## 3. Dano nos dois sentidos

### 3.1 Mitigação (base comum)

`const mitigar = (dano, armadura) => dano * (100 / (100 + Math.max(0, armadura)))` — `motor.js:1167`. Vale para os dois sentidos.

### 3.2 Jogador → monstro (`golpear`, `motor.js:1192-1234`)

1. Armadura efetiva (`motor.js:1202`):
   - físico: `alvo.armadura × (1 − reducaoArmadura) × (1 − a.penArmadura)`;
   - mágico com `poder`: `alvo.armadura × RM_MONSTRO (0.6) × (1 − a.penMagica)` — monstros não têm RM própria (`motor.js:1177-1179`).
2. `dano = mitigar(bruto, arm)`.
3. Multiplicadores (`motor.js:1211-1221`): `× (1 + gritoBonus + 0.01×disciplina + buffBarao(0.25))`; `× papel.dano` e, em Runeterra, `× papel.arena` (`KITS`, `motor.js:870-894`); `× danoCritico` se crítico; `× 1.15` contra chefe com `3036`; `× (1 + dominioAmp)`; Ezreal: `× bonusEzreal` (até `1+longe[r]`, escala 2→7 tiles, `motor.js:1237-1248`); Katarina: `× (1+danoHab)`; Zac: `× (1+absorcaoBonus×acumulos)`; `× (1+sombraBonus)`; por fim `× fatorDanoJogador(estado, alvo)` (`motor.js:1221`).
4. `critico`: chance `a.critico` (cap 1), dano base **1,75** (`motor.js:499`), `+0.4` com Gume do Infinito `3031` (`motor.js:515`), modificado pelo kit Yasuo (`critMult`, `critDano`, `motor.js:541`).
5. Roubo de vida: `cura = dano × a.rouboVida` só em `fonte === 'ataque'`; com `3072` o excedente vira escudo até 25 % da vida máxima (`motor.js:1226-1230`).
6. Hemorragia (Darius): 1 acúmulo por golpe (5 se `poder`), DoT `(13 + 0.3×bonusAd + 4×nível)/5` por acúmulo por segundo, mitigado pela armadura (`motor.js:1274-1282`, `1631`, `1643-1650`).
7. Itens com lógica no motor (não no catálogo): `3031`, `2501`, `3003`, `3089`, `3135`, `3036`, `4645`, `3165`, `6653`, `3116`, `3072`, `3065`, `3068`, `3100`, `3742`, `6610`, `3153`, `3071`, `3044`, `3046`, `3085`, `6631`, `3074`, `3748`, `3075`, `6333`, `6655`, `3102`, `3157`, `3053`, `3026` — linhas exatas em §7.3.

### 3.3 Monstro → jogador (`inimigoAtaca` `motor.js:1725-1737` + `receberDano` `motor.js:2693-2735`)

1. `i.ataque` zera → **esquiva** do campeão: `Math.random() < a.esquiva` (cap 25 %, `motor.js:536`) cancela o golpe (`motor.js:1731`).
2. Defesa: `(i.magico ? a.rm : a.armadura) × (1 + 0.01×disciplina + estandarteDef + diamanteDef + membranaDef)` (`motor.js:1733`).
3. `receberDano(mitigar(i.ad × aura.ad, defesa), ...)` (`motor.js:1734`).
4. Em `receberDano`: invulnerável (Zhonya) → 0; `× fatorDanoMonstro` se a origem tem nível (`motor.js:2696`); `× papel.recebido` (ou `recebidoArena`) (`motor.js:2697`); Véu da Banshee bloqueia 1 golpe/40 s (`motor.js:2698-2700`); Dança da Morte guarda 30 % como sangramento em 3 s (`motor.js:2701-2704`, `1431-1438`); Parede de Vento bloqueia tiros à distância (`motor.js:2705-2709`); reduções de Zac (`quique`, `mitose`, `motor.js:2710-2711`); Pele de Diamante reflete (`motor.js:2712`); Fluxo do Yasuo cheio vira escudo (`motor.js:2713-2717`); escudo absorve (`motor.js:2718`).
5. Gatilhos por vida: Zhonya <25 % (2,5 s invulnerável, 120 s), Sterak <30 % (escudo 60 % da vida bônus, 90 s), Anjo Guardião na morte (volta com 50 %, 300 s), Divisão Celular do Zac (`motor.js:2722-2733`).
6. **Nível acima do jogador** (`NIVEL_DIF`, `motor.js:1184-1187`): `difNivel = max(0, nivelMonstro − nivelJogador − 4)`;
   - monstro: `fatorDanoMonstro = min(3, 1 + 0.15×dif)` (até **×3**);
   - jogador: `fatorDanoJogador = max(0.25, 1 − 0.07×dif)` (piso **×0.25**).
   Vale no Rift e em Runeterra, chefes e guardiões incluídos; **não vale** na Vilemaw nem no PvP (`motor.js:1182`).
7. **Teto de itens de % de vida** (`TETO_VIDA_ITEM = 3`, `motor.js:1190-1191`): `vidaRefItem = min(vida, 3×CURVA.hp(nivel))` — usado por Liandry (1,5 %/s), Rei Destruído (5 % da vida atual), Matéria Instável do Zac.

### 3.4 Caps e limites

| Limite | Valor | Fonte |
|---|---|---|
| Velocidade de ataque | 3,0 | `motor.js:344`, aplicado em `534` |
| Esquiva | 25 % | `motor.js:536` |
| Redução de recarga | 40 % (atributo Foco contribui no máx. 30 %) | `motor.js:537` |
| Penetração mágica | 60 % | `motor.js:529` |
| Penetração de armadura | multiplicativa: `1−(1−penE)×(1−0.30 se 3036)` | `motor.js:539` |
| Redução de armadura do alvo (3071) | 30 % | `motor.js:1705` |
| Dano de monstro acima do nível | ×3 | `motor.js:1186` |
| Dano do jogador contra monstro acima do nível | ×0.25 (piso) | `motor.js:1187` |
| Crit chance | 1,0 | `motor.js:541` |
| Duração/efeitos por item | ver `motor.js:1055-1057` (`timers`) | — |

### 3.5 PvP (fora do escopo, mas relevante)

Dano entre jogadores é **calculado no servidor**: o motor só emite `acertoPvp`/`acertoMonstro` e aplica efeitos locais (`motor.js:1195-1199`, `1939`, `arena.js:187-191`); `danoPvp` existe mas quem decide é o servidor (`motor.js:3723-3741`). Curas em PvP valem `CURA_PVP = 0.65` (`motor.js:1284-1286`) e a poção `POCAO_PVP = {cura:0.3, exaustao:6}` (`motor.js:43`).

---

## 4. XP / ouro / loot

### 4.1 Curvas base (`motor.js:272-279`)

`ajuste(n)` escolhe a faixa de `balanco.js:2` (de 1–2 até 21–60) e multiplica as curvas:

- `CURVA.hp(n) = (150 + 100n + 1.0n²) × ajuste.vida`
- `CURVA.ad(n) = (9 + 4.8n + 0.13n²) × ajuste.dano`
- `CURVA.armadura(n) = 5 + 1.5n` (**não** sofre ajuste)
- `CURVA.xp(n) = (30 + 7n) × ajuste.xp`
- `CURVA.ouro(n) = (8 + 3.5n) × ajuste.ouro`

`balanco.js:2` traz `{de, ate, xpUpar, xp, ouro, vida, dano, drop}` para 11 faixas; vida vai de 0,7 (nv 1–2) a 1,0 (nv 21+), dano de 0,65 a 1,0, ouro de 1,5 a 1,0, drop de 3,0 a 1,0.

### 4.2 XP

- Por abate (`processarAbates`, `motor.js:1765`):
  `xp = i.xp × fatorXp(nivelJogador, nivelMonstro) × (VIP ? 1.2 : 1) × bonus(Runeterra 1.3) × bonusXp(grupo) × bonusTwitch × bonusEvento`.
- `i.xp = CURVA.xp(n) × MONSTROS[nome].xp` (`motor.js:1071`).
- **Penalidade de nível**: `fatorXp(a,b) = dif>5 ? max(0.1, 1 − 0.1×(dif−5)) : 1` com `dif = nivelJogador − nivelMonstro` → monstro 6 níveis abaixo = 0,9; **piso 10 %** (`motor.js:421`). O mesmo fator vale para **todo o saque** (itens, ouro, runas, espólios): `fatorSaque = fatorXp` (`motor.js:424`).
- `i.xp` é multiplicado pelos modificadores de spawn **antes**: noturno ×1.8, furioso ×5 (`motor.js:1099`, `1109`).
- Grupo (Runeterra): `GRUPO = {max:4, raio:15, porMembro:0.15}` (`motor.js:143`); o servidor manda `bonusXp` limitado a `1 + 0.15×3 = 1.45` (`arena.js:1650`).
- Twitch (live oficial): `1 a 1,5`, dito pelo servidor (`motor.js:1741-1743`); evento de XP do servidor: `1 a 3` (`motor.js:1745-1747`).
- Mascote recebe **10 %** do XP do abate (`motor.js:1767`); XP de mascote para subir: `150×n^1.7` (`motor.js:3533`).
- Subir de nível: `ganharXp` (`motor.js:2795-2810`) acumula e, ao passar `xpParaNivel(n)`, sobe 1 nível, dá **1 ponto de habilidade** e **3 pontos de atributo** (`motor.js:2801-2802`, `PONTOS_POR_NIVEL = 3` `motor.js:483`), e cura 30 % da vida que falta (`motor.js:2805`). `NIVEL_MAX = 50` (`motor.js:27`).
- `xpParaNivel(n) = tres(RITMO_XP(n) × 0.4433 × 1.1715^(n−1) × ajuste(n).xpUpar)`, `RITMO_XP(n) = 43000 + 4345(n−1) + 17.9(n−1)²`, `tres` arredonda a 3 algarismos (`motor.js:427-429`). **(derivado)** nv1 = 762; nv5 = 4.050; nv10 = 46.200; nv11 = 95.200; nv20 = 1.070.000; nv25 = 3.120.000; nv30 = 8.040.000; nv40 = 51.000.000; nv50 = 309.000.000; **total 1→50 ≈ 1,56 × 10⁹ XP**.
- Morte: −10 % de `xpParaNivel(nivel)` (`motor.js:430`, `2763-2768`).

### 4.3 Ouro

- Por abate (`motor.js:1758-1759`): `ouro = i.ouro × a.ouroMult × fatorSaque`; `i.ouro = CURVA.ouro(n) × m.ouro × (0.5 + rand×0.5)` (`motor.js:1071`) → **50 % a 100 %** do valor nominal (média 75 %, `wiki-dados.js:28`).
- `a.ouroMult = 1 + bonusConquistas.ouro + bonusMascote.ouro` (`motor.js:526`); Poro dá +1 %/nível (`motor.js:3518`).
- **VIP**: `VIP.drop = 1.2` multiplica a chance de loot; o ouro em si **não** tem multiplicador VIP (`motor.js:1764-1765`).
- Espólios (só venda, bolsa separada): `valor = round(0.6 × CURVA.ouro(nivelRef) × mult)` (`motor.js:304`, tabela `305-325`). **(derivado)** valores: escudo-quebrado 21, pó-arcano 21, engrenagem 31, pele-lobo 41, presa-lobo 123, pedra-krug 47, cristal-azul 61, espinho 72, escama-arraia 66, quitina 66, escama-dragão 76, garra-dragão 229, olho-vazio 97, chifre-arauto 1.958, coração-dragão 2.220, presa-barão 2.745, seda-vilemaw 397, presa-vilemaw 3.294.
- Venda de item: `floor(preco × 0.5 × (1 + 0.5×refino) × QUALIDADES[q].venda)` (`motor.js:257`).

### 4.4 Loot — raridade e item

- Chance **por abate de monstro comum**, por raridade (`BRUTO`, `motor.js:1143`; `chancesDrop`, `1146-1149`):
  `lendario = 4e-5 × 4^(tier/7) × ajuste(drop) × LENDARIO_TIER[tier]`; `epico = (0.0005 + 0.00015×tier) × ajuste(drop)`; `basico = (0.012 − 0.0005×tier) × ajuste(drop)`; depois `epico ×= (1−lendario)` e `basico ×= (1−lendario)(1−epico)` (exclusão mútua, 1 item por abate).
- `LENDARIO_TIER = [1, 1, 1.4, 2.7, 2.8, 2.5, 2.5, 2.3]` (`motor.js:1142`); `NIVEL_DO_TIER` = meio da faixa de cada zona (`motor.js:1138`).
- **Chefe** (`DROP_CHEFE`, `motor.js:1145`): lendário 0,1 %, épico 5 %, básico 40 % — **sorteios independentes** (pode sair mais de um item) (`motor.js:1156-1158`).
- Item dentro da raridade: **uniforme** na lista `local.drops[rar]` (ad) ou `local.dropsAp[rar]` (ap), conforme `classeDe(estado)` (`motor.js:1151-1155`).
- Ordem de sorteio no abate comum: lendário → senão épico → senão básico (`motor.js:1160-1164`).
- Multiplicador `mult = (VIP ? 1.2 : 1) × bonus(Runeterra 1.3) × fatorSaque × petIt` (`motor.js:1764,1768,1770`), onde `petIt = 1 + 0.0025×nível` da Aranhinha (`motor.js:3525`). Noturno sorteia 1 vez a mais; furioso, 2 (`motor.js:1113`, `1770`).
- **(derivado) chance por abate e por zona (sem VIP)**:

| zona (tier) | lendário | épico | básico | ~1 lendário a cada |
|---|---|---|---|---|
| rota-inf (0) | 0,01120 % | 0,1400 % | 3,3549 % | 8.929 abates |
| rota-sup (1) | 0,01073 % | 0,1430 % | 2,5261 % | 9.322 |
| lobos (2) | 0,01498 % | 0,1440 % | 1,9769 % | 6.676 |
| azul (3) | 0,02348 % | 0,1140 % | 1,2583 % | 4.260 |
| vermelho (4) | 0,02473 % | 0,1100 % | 0,9987 % | 4.043 |
| rio (5) | 0,02692 % | 0,1250 % | 0,9486 % | 3.715 |
| dragao (6) | 0,03281 % | 0,1400 % | 0,8984 % | 3.048 |
| barao (7) | 0,03680 % | 0,1549 % | 0,8484 % | 2.717 |

- **(derivado) chance por item** = chance da raridade ÷ nº de itens da lista daquela classe/raridade. Exemplos (ad): rota-inf básico 0,4793 % cada (7 itens), épico 0,0350 % cada (4), lendário 0,0037 % cada (3); barão básico 0,2121 % (4), épico 0,0258 % (6), lendário 0,0061 % (6). Listas completas de ids por zona/raridade/classe em `motor.js:383-406` (transcritas em §5.2).

### 4.5 Runas (gemas)

- `GEMAS` (`motor.js:107-114`): **sorte** (×1,25 na chance de forja/montagem, `chance 0.0053`), **arcana** (×2, `0.00063`), **proteção** (falha na forja não baixa o refino, `0.00063`).
- `chancesGema(local) = GEMAS[id].chance × (1 + tier×0.1)` (`motor.js:123-126`); chefe usa `chefe`: 30 % / 8 % / 8 % (`motor.js:108-113`, `127-132`). **(derivado)** por zona: rota-inf 0,530 % / 0,0630 % / 0,0630 % → barão 0,901 % / 0,1071 % / 0,1071 %.
- Noturno/furioso sorteiam gemas de novo (`motor.js:1781`); não ocupam mochila (`motor.js:106`).

### 4.6 Espólios

- Tabela `ESPOLIO_MONSTRO` (`motor.js:327-333`): cada entrada é sorteada **independentemente** (`sortearEspolios`, `motor.js:334-338`): tropas 30–35 %, lobo 30 %+6 % presa, krug 30 %, sentinela 35 %, brambleback 35 %, arraia 30 %, larva 30 %, filhote 30 %+6 % garra, criatura 30 %; **chefes 100 %** (chifre/coração/presa). `Cria de Vilemaw` não tem espólio.
- Empilham 1.000 por espaço de mochila (`PILHA = 1000`, `motor.js:341`; `espacosEspolios`, `345`); quando a mochila enche, o que não cabe é **perdido** (`motor.js:1779`).

### 4.7 Qualidade e refino

- `QUALIDADES` (`motor.js:173-179`): C 49,9495 % (×0,9 atributos, ×0,8 venda), B 35 % (×1, ×1), A 15 % (×1,15, ×1,5), S 0,05 % (×1,35, ×3), SS 0,0005 % (×1,7, ×8). Sorteio em `sortearQualidade` (`motor.js:188-192`), com bônus de montagem (`chancesQualidade`, `182-187`).
- **O sorteio da qualidade é do SERVIDOR** (`motor.js:170-171`, `195-243`); o jogo recebe `~?` e o servidor revela (`revelarPendentes`, `motor.js:206-243`), com regras anti-reroll: revelação guardada vale 10 min (`AVALIADOS = {ms: 10*60e3, max: 50}`, `motor.js:205`) e, se um item sumiu e apareceu outro `~?` da mesma base, fica com a **pior** entre o que sumiu e o novo sorteio (`motor.js:234-236`).
- Item vendido/sendo avaliado: `venderItem` recusa `pendente(id)` (`motor.js:2932`).
- **Refino** (Ornn): `REFINO_MAX = 5`, `BONUS_REFINO = 0.12` (+12 % de todos os bônus por nível), `CHANCE_REFINO = [0.30, 0.12, 0.02, 0.008, 0.003]`, `PRECO_REFINO_ALTO = 2` a partir do +2, `REGRESSAO_REFINO = [0,0,0.04,0.015,0.006]` (`motor.js:54-62`); VIP multiplica por 1,2 com teto 0,5 (`motor.js:153`); falhas acumulam persistência de +1 % até 50 % (`motor.js:72-74`, `136`); preço do refino `round(preco × (0.5 + 0.5×refino) × (refino ≥ 2 ? 2 : 1))` (`motor.js:258`).
- **Montagem** (Ornn): `MULT_CUSTO_MONTAR = {epico:3, lendario:45}`, mas lendário usa `round(preco × 4.8 / 50) × 50` (`motor.js:3131-3136`); `CHANCE_MONTAR = {epico: 0.01, lendario: 0.001}` (VIP ×1,2, teto 50 %) (`motor.js:3160-3162`); o sorteio em jogo é do servidor (`motor.js:3174`).

---

## 5. Localidades

### 5.1 Tabela mestra (`motor.js:354-379`)

| id | nome | faixa (jogador) | nm (monstros) | tier | bioma | semente | pos (mapa 0–1) | chefe (chance/grupo) |
|---|---|---|---|---|---|---|---|---|
| fonte | Fonte | base | — | — | base | — | [0.09, 0.91] | — |
| rota-inf | Rota Inferior | 1–10 | 1–6 | 0 | rota | 1 | [0.52, 0.93] | — |
| rota-sup | Rota Superior | 5–15 | 5–13 | 1 | rota | 2 | [0.07, 0.45] | — |
| lobos | Toca dos Lobos | 10–20 | 10–18 | 2 | selva | 1 | [0.27, 0.56] | — |
| azul | Campo Azul | 15–25 | 15–23 | 3 | selva | 2 | [0.24, 0.42] | — |
| vermelho | Campo Vermelho | 20–30 | 20–28 | 4 | selva | 3 | [0.53, 0.74] | — |
| rio | Rio | 25–35 | 25–33 | 5 | rio | 1 | [0.45, 0.45] | Arauto do Vale 1,5 % |
| dragao | Fosso do Dragão | 30–40 | 30–38 | 6 | rio | 2 | [0.67, 0.70] | Dragão Infernal 1,5 % |
| barao | Covil do Barão | 40–50 | 40–48 | 7 | barao | 1 | [0.33, 0.29] | Barão Nashor 1,5 % |
| arena | Runeterra | mundo aberto | por zona | — | mundo | 1 | [0.77, 0.42] | (por zona, 1/3 da chance) |
| aram | Arena (1v1) | PvP | — | — | abismo | 1 | (sem pos) | — |

`pos` é a posição no mapa do LoL (0–1, base azul em baixo à esquerda, `motor.js:353`), usada no minimapa (`jogo.js:3830-3838`). **Estas são as únicas coordenadas do Rift no código fornecido** — não são coordenadas de spawn.

### 5.2 Monstros e drops por localidade

Pesos de espécie (`motor.js:357-372`) e listas de drop (`DROPS` `motor.js:383-392`, `DROPS_AP` `397-406`; aplicadas em `407`):

| zona | monstros (peso) | drops ad (básico/épico/lendário) | drops ap |
|---|---|---|---|
| rota-inf | Tropa Corpo a Corpo 3, Tropa Mago 2 | 1036,1028,1042,1029,2022,1001,1054 / 3077,3144,3047,3140 / 6631,3078,3174 | 1052,1027,1028,1029,2022,1001,1056 / 3916,3108,3020,3140 / 6655,3116,3174 |
| rota-sup | Tropa Corpo a Corpo 3, Tropa Mago 2, Tropa de Cerco 1 | 1036,1028,1033,1006,1018,1120 / 3044,3057,1053,3133,3006 / 3078,3074,3172 | 1052,1027,1028,1033,1006,1120,1054 / 3802,3113,3145,3158 / 3116,3003,3171 |
| lobos | Lobo Gigante 1 | 1042,1037,1018,1029,1001 / 3051,3086,1043,2019,3009,3105 / 3046,6333,3170 | 1052,3070,1029,1028,1001 / 3108,4630,3147,2508,3009,3105 / 3100,6653,3170,3190 |
| azul | Krug Anciã 2, Sentinela Azul 1 | 1033,1006,2022,1028,1120 / 3067,3211,3066,1011,3111,3801 / 3065,3071,8020,3190,3174 | 1033,1006,2022,1028,1027,1056 / 3802,3067,3113,1011,3111,3801 / 3003,3165,3065,8020,3190,3171 |
| vermelho | Brambleback Vermelho 1, Lobo Gigante 1, Krug Anciã 1 | 1036,1037,1038,1028,1054 / 2021,3077,3035,6670,3008 / 3748,2501,3072,3168 | 1026,1052,1028,1120 / 2508,3145,2420,3147,3020 / 4645,6653,3102,3152,3175,3143 |
| rio | Arraia do Rio 2, Larva do Vazio 2 | 1042,1018,1038,1001 / 3086,6670,3144,1043,3158,3024 / 3085,3153,3036,3156,3173 | 1026,1052,3070,1001 / 4630,3916,4632,3113,3158,3024 / 3135,4629,3157,3175,3173,8020 |
| dragao | Dragão Ancião (filhote) 2, Larva do Vazio 1 | 1037,1038,1029,1028,1120 / 1031,3076,2019,3133,3047,3140 / 3075,3742,6610,3068,3143,663056,3172 | 1026,1058,1029,1028,1120 / 2420,3145,4632,3108,3047,3140 / 3157,4645,3075,3068,664644,3175 |
| barao | Criatura do Vazio 2, Dragão Ancião (filhote) 1 | 1038,1037,1018,1054 / 3035,6670,3133,1011,3006,3111 / 3031,3026,3053,6673,3083,3168 | 1058,1026,1052,1054 / 4630,3802,2420,1011,3020,3111 / 3089,3135,3157,4633,3083,3171 |

Todos os 108 itens do catálogo aparecem em pelo menos uma lista de drop (`motor.js:383-406`; verificação exaustiva feita contra `itens.js`).

### 5.3 Chefe de cada zona (1,5 %/grupo; nível)

| zona | chefe | nível (Rift, com jogador) | hp/ad/armadura do chefe no nível nominal **(derivado)** |
|---|---|---|---|
| rio | Arauto do Vale | `clamp(jogador+4, 27, 35)` | nv35: 48.750 hp, 840,6 ad, 86,3 arm, 3.300 xp, 1.566 ouro |
| dragao | Dragão Infernal | `clamp(jogador+4, 32, 40)` | nv40: 69.000 hp, 1.227 ad, 104 arm, 4.340 xp, 2.072 ouro |
| barao | Barão Nashor | `clamp(jogador+4, 42, 50)` | nv50: 122.400 hp, 1.836,8 ad, 144 arm, 7.600 xp, 3.660 ouro |

Nível do chefe no Rift = `max(n0+2, min(n1+2, jogador+4))` (`motor.js:1121`); em Runeterra = `clamp(jogador+2, nm[0], nm[1]+2)` (`arena.js:236`).

### 5.4 Custo de viajar/desbloquear

- `viajar(estado, c, id)` (`motor.js:3043-3048`): **grátis**, sem custo de ouro nem requisito de nível; recusa se morto ou já no local; limpa inimigos e põe `respawn = 1.2`.
- Na UI, viajar tem **tempo de espera** (`jogo.js:460`): `TEMPO_VIAGEM = {runeterra: 5, cidade: 5, rift: 3}` segundos; cancelado por morte, dano (`estado.vida < viagem.vida − 0.5`) ou andar/atacar (`jogo.js:488-497`).
- **Em Runeterra não se viaja em combate** (`EM_COMBATE_MUNDO = 6` s depois de levar dano, `motor.js:3051-3056`; `voltarBase` bloqueado, `motor.js:3059-3062`).
- **Cidades de Runeterra** (dados em `runeterra.js`, ausente): descobrir andando uma vez; depois viaja-se direto (`jogo.js:681`, `jogo.js:821-827`); `cidadeDeVolta` exige `estado.nivel >= c.faixa[0]` (`jogo.js:309`); a cidade sugerida para uma zona é a da faixa de nível dela, senão Demacia (`jogo.js:3781-3785`). **Nenhum custo em ouro**.
- Zonas do Rift: nenhuma trava por nível no código — só a UI mostra a faixa ideal (`jogo.js:3792-3828`).

---

## 6. Missões / quests

### 6.1 Tarefas do Capitão da Legião — tipos e geração

- `TAREFA_TIPOS` (`motor.js:3244-3248`): `rapida {min:7, xp:0.42, ouro:0.55}`, `normal {15, 0.43, 0.55}`, `desafio {15, 0.44, 0.5}`, `longa {25, 0.42, 0.55}`, `especie {12, 0.42, 0.55}`, `furioso {16, 0.42, 0.55}` (`min` = minutos no ritmo típico da zona).
- `criarOfertas(estado)` (`motor.js:3310-3327`) gera **3 ofertas**:
  - zona ideal = `zonaIdeal(nivel)` = a última zona (não-arena) cuja `faixa[0] ≤ nível` (`motor.js:3267`); zona de cima = `zonaAcima` (`3268`);
  - 1ª: 50 % `rapida` na zona ideal, 50 % `especie` (uma espécie da zona, nunca uma que não exista) (`3322`, `3314-3320`);
  - 2ª: `normal` (60 %) ou `longa` (40 %), `furioso`, ou `especie` (se houver ≥2 espécies) (`3323-3324`);
  - 3ª: `desafio` na zona de cima; sem zona acima, outra das opções restantes (`3325`);
  - quantidades: `max(20, round(min × ritmoZona(l.id) × var / 10) × 10)` para zona; `max(10, round(min × ritmo × fracaoEspecie × var / 5) × 5)` para Caça; `furioso`: 3 (60 %) ou 4 (40 %) (`3313`, `3318`, `3321`); `var = 0.8 + rand×0.4` (**±20 %**) (`3311`);
  - `ritmoZona(id) = ABATES_MIN_ZONA[id] × RITMO_REAL (1.5)` (`motor.js:3253-3254`); `ABATES_MIN_ZONA = {'rota-inf':18,'rota-sup':13,lobos:11,azul:6.5,vermelho:7,rio:7.5,dragao:7,barao:7.5}` (`motor.js:3266`).
- **Recompensa** (`recompensaTarefa`, `motor.js:3276-3288`): `xp = round(abatesEquivalentes × xpMedioDaZona × T.xp)`, `ouro = round(eq × ouroMedioDaZona × T.ouro)`, onde `porAbateZona` usa o nível do **meio da faixa** e os pesos das espécies (`3270-3275`); `abatesEquivalentes` corrige Caça (`qtd / fração da espécie`) e Fúria (`qtd × 3/0.05 = qtd×60`) (`3259-3264`).
- Limites de sanidade: `especie` 5–500; `furioso` 1–5; outras 10–1000 (`motor.js:3280`).
- **Item da tarefa** (`chancesItemTarefa`, `motor.js:3295-3297`): `lendario = min(0.05, q × ch.lendario × f)`, `epico = min(0.5, q × ch.epico × f)`, com `f = ITEM_TAREFA.fatorZona (0.3)` para tarefas por zona e `fator (0.5)` para as antigas (`motor.js:3294`). `raridadeTarefa` (`3300-3305`): lendário → épico → senão `grande` garante básico, `pequena` tem 30 % de básico (`ITEM_TAREFA.pequena = 0.3`).
- Ofertas trocam sozinhas a cada `TROCAR_TAREFAS_MIN = 10` min, ou por botão (`motor.js:3424-3437`); a versão `TAREFA_VERSAO = 2` invalida ofertas antigas (`3255`).
- **Progresso** (`contarTarefa`, `motor.js:3446-3454`): conta abates **no local da tarefa**; `especie` exige o nome exato; `furioso` exige `i.furioso`. Chamada em `processarAbates` (`motor.js:1786`), e monstros `invocado` (larvas do Barão) **não contam**.
- **Entrega** (`entregarTarefa`, `motor.js:3456-3469`): exige estar na base (`naBase`); recompensa é **limitada ao máximo recalculado** (`motor.js:3460-3461`, anti-cheat); sorteia o item e aplica.

### 6.2 De onde vem o TEXTO da missão (para a extensão parsear "matar N de X")

O motor **não** gera texto de missão: guarda `{tipo, local, monstro?, qtd, xp, ouro, item, feitos}` em `estado.tarefa` (`motor.js:3442`) e nas ofertas (`estado.ofertas.lista`, `motor.js:3427`). O texto é montado em `jogo.js` (i18n `t()`):

| Onde aparece | Template exato | Fonte |
|---|---|---|
| Cartão de oferta (Caça) | `'{qtd} {monstro} em {lugar}'` | `jogo.js:5483` |
| Cartão de oferta (Fúria) | `'{qtd} monstros furiosos em {lugar}'` | `jogo.js:5484` |
| Cartão de oferta (zona) | `'{qtd} monstros em {lugar}'` | `jogo.js:5484` |
| Selo do tipo | `{rapida:'Rápida', normal:'Normal', desafio:'Desafio', longa:'Longa', especie:'Caça', furioso:'Fúria'}` | `jogo.js:5479` |
| Log ao aceitar | `'Nova tarefa: abater {qtd} {monstro} ({lugar}).'` | `jogo.js:5794` |
| Fala do Capitão (em andamento) | `'Sua tarefa: {monstro} ({feitos}/{qtd}), em {lugar}. Volte quando terminar, ou posso {cancelar} a tarefa.'` | `jogo.js:4886-4887` |
| Rastreador (HUD) | `'Tarefa: {monstro}'` + barra + `'{feitos}/{qtd} · {lugar}'` | `jogo.js:6269` |
| Nome do alvo | `alvoTarefa`: `'monstros furiosos'` / `'monstros'` / nome do monstro em minúsculas | `jogo.js:5499` |
| Nome curto | `nomeTarefa`: espécie → nome do monstro; fúria → "Monstros furiosos"; zona → nome do local | `jogo.js:5500` |
| Onde ler no DOM | `#npc-troca` (cartões com `data-tarefa`), `#rastreio-tarefa` (progresso) | `jogo.js:5481-5496`, `6263-6272` |

Ou seja: para "matar N de X" a extensão deve ler `#rastreio-tarefa small` (`feitos/qtd · Local`) e o `<b>` (`Tarefa: {monstro}`), ou o cartão em `#npc-troca` com `data-tarefa="k"` (o índice na lista de ofertas). O texto do cartão é `{qtd} {monstro} em {lugar}` (ou `{qtd} monstros em {lugar}` para zona, onde **qualquer monstro do local conta** — `motor.js:3449-3450`).

### 6.3 Missões diárias

- `DIARIA` (Runeterra) `{qtd:1000, xp:0.75, ouro:0.66, lendario:0.27, lendarioMax:0.08, abaixo:5}`; `DIARIA_RIFT` `{qtd:1000, xp:0.5, ouro:0.5, lendario:0.13, lendarioMax:0.04, abaixo:5}` (`motor.js:3356-3357`); uma de cada por dia de Brasília (`diaHoje`, `3362`), contando monstros de nível ≥ `nível − 5` **no local certo** e nunca invocados (`contarDiaria`, `3402-3408`; `DIARIAS`, `3358-3361`).
- Recompensa (`recompensaDiaria`, `3389-3393`): `xp = round(1000 × xpMedioZona × (Runeterra ? 1.3 : 1) × Rg.xp)`, `ouro = round(1000 × ouroMedio × Rg.ouro)`, `lendario = min(lendarioMax, 1000 × ch.lendario × Rg.lendario)`; item é **épico garantido** (vira lendário no sorteio) (`entregarDiaria`, `3410-3423`). **Entrega só no servidor** (`motor.js:3354`).
- Textos: `jogo.js:4970` (`'{qtd} monstros no Summoner's Rift'` / `'{qtd} monstros em Runeterra'`), `jogo.js:5784-5785` (log ao aceitar), `jogo.js:6280` (rastreador `#rastreio-diaria` e `#rastreio-diaria-rift` com `{feitos}/{qtd}`), `jogo.js:4985` (prêmio).
- Prêmio de login (`PREMIO_LOGIN`, `motor.js:3367-3381`): ciclo de 7 dias; ouro = minutos de caça na zona ideal (`ouroPorMinuto`, `3376`); dia 7 dá épico.

### 6.4 Conquistas/títulos (bônus permanentes)

`CONQUISTAS` (`motor.js:3478-3495`): sangue (+0 %), centurião 1.000 abates (`ad +2 %`), carniceiro 10.000 (`ad +3 %`), veterano nv25 (`vida +2 %`), mão de Noxus nv50 (`ad+3 %, vida+3 %`), imortal nv30 sem mortes (`armadura +3 %`), arauto (`vida +2 %`), dragão (`rm +3 %`) etc.; aplicados em `atributos()` (`motor.js:517`, `524`).

---

## 7. Itens

### 7.1 Regras gerais

- Catálogo = `ITENS_DADOS` (`itens.js:3`), indexado por id em `ITENS` (`motor.js:13`). Campos: `id, nome, preco, custo, de[], raridade, lendario, espaco, resumo, ad, vida, armadura, rm, va, rv, critico, ap, mana, efeito` (+ `regen, cdr, penMag, esquiva, adPct, apPct, vidaPct, armPct, rmPct` em alguns).
- Espaços: `ESPACOS_EQUIP = ['arma','armadura','cabeca','mao','botas','acessorio']` (`motor.js:31`); equipados = **1 bota + 4 outros** (`ESPACOS = 5`, `ESPACOS_ITENS = 4`, `motor.js:28-29`); mochila = `20 + 2×floor(nível/5)` (`MOCHILA_INICIO = 20`, `MOCHILA_GANHO = {niveis:5, espacos:2}`, `motor.js:35-36`).
- Bônus efetivo do item = atributo × `(1 + 0.12×refino) × QUALIDADES[qual].mult` (`infoItem`, `motor.js:251-255`); raridade efetiva `i.raridade || (lendario ? 'lendario' : 'basico')` (`motor.js:47`).
- Custo de montagem: épico `custo×3`; lendário `round(preco×4.8/50)×50` (`motor.js:3131-3136`). Chances: épico 1 %, lendário 0,1 % (VIP ×1,2) (`motor.js:3160-3162`).

### 7.2 Catálogo completo (108 itens, legível por máquina)

Formato: `id | nome | espaco | raridade | preco | custo | de | atributos | efeito`.

| id | nome | espaco | raridade | preco | custo | de | atributos | efeito |
|---|---|---|---|---|---|---|---|---|
| 2022 | Partícula Brilhante | acessorio | basico | 250 | 250 | — | — |  |
| 1042 | Adaga | mao | basico | 250 | 250 | — | va0.1 |  |
| 1027 | Cristal de Safira | acessorio | basico | 300 | 300 | — | mp300 |  |
| 1029 | Couraça de Pano | armadura | basico | 300 | 300 | — | arm15 |  |
| 1006 | Pérola do Rejuvenescimento | acessorio | basico | 300 | 300 | — | — |  |
| 1001 | Botas | botas | basico | 300 | 300 | — | hp80 arm5 |  |
| 1036 | Espada Longa | arma | basico | 350 | 350 | — | ad10 |  |
| 1028 | Cristal de Rubi | acessorio | basico | 400 | 400 | — | hp150 |  |
| 3070 | Lágrima da Deusa | acessorio | basico | 400 | 400 | — | mp240 |  |
| 1052 | Tomo Amplificador | mao | basico | 400 | 400 | — | ap20 |  |
| 1033 | Manto Anula-Magia | armadura | basico | 400 | 400 | — | rm20 |  |
| 1056 | Anel de Doran | acessorio | basico | 400 | 400 | — | ap18 hp90 |  |
| 1120 | Elmo de Doran | cabeca | basico | 450 | 450 | — | hp150 arm8 rm8 |  |
| 1054 | Escudo de Doran | mao | basico | 450 | 450 | — | hp110 regen1 |  |
| 1018 | Capa da Agilidade | armadura | basico | 600 | 600 | — | crit0.15 |  |
| 1026 | Varinha Explosiva | arma | basico | 850 | 850 | — | ap45 |  |
| 1037 | Picareta | arma | basico | 875 | 875 | — | ad25 |  |
| 1058 | Bastão Desnecessariamente Grande | arma | basico | 1200 | 1200 | — | ap65 |  |
| 1038 | Espada G. p. C. | arma | basico | 1300 | 1300 | — | ad40 |  |
| 3144 | Estilingue do Patrulheiro | arma | epico | 600 | 100 | 1042+1042 | va0.2 |  |
| 1043 | Arco Recurvo | arma | epico | 700 | 450 | 1042 | va0.15 |  |
| 3067 | Gema Ardente | acessorio | epico | 800 | 150 | 1028+2022 | hp200 |  |
| 1031 | Cota de Malha | armadura | epico | 800 | 500 | 1029 | arm40 |  |
| 3076 | Colete Espinhoso | armadura | epico | 800 | 200 | 1029+1029 | arm30 |  |
| 3801 | Braçadeira Cristalina | acessorio | epico | 800 | 100 | 1028+1006 | hp200 regen2 |  |
| 3916 | Orbe do Oblívio | mao | epico | 800 | 400 | 1052 | ap25 |  |
| 3066 | Couraça Lunar Alada | armadura | epico | 800 | 400 | 1028 | hp200 |  |
| 3108 | Códex Demoníaco | mao | epico | 850 | 200 | 1052+2022 | ap25 |  |
| 1053 | Cetro Vampírico | arma | epico | 900 | 550 | 1036 | ad15 rv0.07 |  |
| 3057 | Fulgor | acessorio | epico | 900 | 650 | 2022 | — |  |
| 1011 | Cinto do Gigante | armadura | epico | 900 | 500 | 1028 | hp350 |  |
| 3113 | Cintilação Etérea | acessorio | epico | 900 | 500 | 1052 | ap30 |  |
| 3158 | Botas Ionianas da Lucidez | botas | epico | 900 | 350 | 1001+2022 | mp150 cdr0.08 |  |
| 2508 | Cinzas do Destino | arma | epico | 900 | 500 | 1052 | ap30 |  |
| 3024 | Broquel Glacial | mao | epico | 900 | 50 | 1029+1027+2022 | arm25 mp300 cdr0.05 |  |
| 3008 | Grevas Vorazes | botas | epico | 1000 | 700 | 1001 | ad15 rv0.07 |  |
| 3009 | Botas da Rapidez | botas | epico | 1000 | 700 | 1001 | hp200 regen2 |  |
| 3133 | Martelo de Guerra de Caulfield | arma | epico | 1050 | 100 | 1036+2022+1036 | ad20 |  |
| 2019 | Sigilo de Aço | mao | epico | 1100 | 150 | 1029+1036+1029 | ad15 arm30 |  |
| 3105 | Égide da Legião | mao | epico | 1100 | 400 | 1033+1029 | arm25 rm25 |  |
| 3044 | Fago | arma | epico | 1100 | 350 | 1028+1036 | ad15 hp200 |  |
| 4630 | Joia da Ruína | acessorio | epico | 1100 | 700 | 1052 | ap25 |  |
| 3145 | Alternador Hextec | arma | epico | 1100 | 300 | 1052+1052 | ap45 |  |
| 3006 | Grevas do Berserker | botas | epico | 1100 | 300 | 1001+1042+1042 | ad10 va0.3 |  |
| 3020 | Sapatos do Feiticeiro | botas | epico | 1100 | 800 | 1001 | ap35 penMag0.08 |  |
| 2021 | Tunelizador | arma | epico | 1150 | 400 | 1036+1028 | ad15 hp250 |  |
| 3802 | Capítulo Perdido | mao | epico | 1200 | 250 | 1052+1027+2022 | ap40 mp300 |  |
| 3086 | Zelo | acessorio | epico | 1200 | 350 | 1018+1042 | va0.15 crit0.15 |  |
| 3077 | Tiamat | arma | epico | 1200 | 500 | 1036+1036 | ad25 |  |
| 3051 | Machado Termestre | arma | epico | 1200 | 250 | 1036+1042+1036 | ad20 va0.2 |  |
| 3047 | Botas Galvanizadas de Aço | botas | epico | 1200 | 600 | 1001+1029 | hp100 arm30 |  |
| 3211 | Capuz do Espectro | cabeca | epico | 1250 | 150 | 1028+1033+1006 | hp200 rm35 |  |
| 3111 | Passos de Mercúrio | botas | epico | 1250 | 550 | 1001+1033 | hp100 rm30 |  |
| 6670 | Aljava Vespertina | mao | epico | 1300 | 350 | 1036+1018 | ad15 crit0.2 |  |
| 3140 | Bandana de Mercúrio | cabeca | epico | 1300 | 900 | 1033 | hp120 rm30 |  |
| 3147 | Máscara Assustadora | cabeca | epico | 1300 | 500 | 1052+1028 | ap30 hp200 |  |
| 3035 | Último Sussurro | arma | epico | 1450 | 750 | 1036+1036 | ad20 |  |
| 4632 | Barreira Verdejante | mao | epico | 1600 | 400 | 1052+1033+1052 | ap40 rm25 |  |
| 2420 | Armaguarda da Caçadora | armadura | epico | 1600 | 500 | 1052+1029+1052 | ap40 arm25 |  |
| 3075 | Armadura de Espinhos | armadura | lendario | 2450 | 450 | 3076+1031+1028 | hp150 arm75 | Espinhos: quem te ataca recebe 10 + 10% da sua Armadura bônus como dano. |
| 3116 | Cetro de Cristal de Rylai | arma | lendario | 2600 | 450 | 1026+1011+1052 | ap65 hp400 | Geada: habilidades deixam os inimigos lentos por 1,5s. |
| 3046 | Dançarina Fantasma | arma | lendario | 2650 | 950 | 1042+3086+1042 | va0.65 crit0.25 | Valsa Espectral: cada ataque dá +6% de Velocidade de Ataque por 3s, acumulando até 5 vezes. |
| 3085 | Furacão de Runaan | arma | lendario | 2650 | 850 | 3086+3144 | va0.4 crit0.25 | Fúria do Vento: cada ataque dispara em mais 2 inimigos que você alcança, com 55% do dano (campeões que atacam de longe: 15%, sem crítico). |
| 3065 | Semblante Espiritual | cabeca | lendario | 2700 | 650 | 3211+3067 | hp400 rm50 | Vitalidade Ilimitada: +25% em toda cura recebida. |
| 6655 | Eco de Luden | arma | lendario | 2750 | 450 | 3802+3145 | ap100 mp600 | Eco: a cada 6s, a próxima habilidade causa mais 100 + 10% do Poder de Habilidade em até 3 inimigos. |
| 3170 | Marcha Célere | botas | lendario | 2800 | 0 | 3009+1031 | hp350 arm35 rm35 esquiva0.05 | Passo Ligeiro: +5% de esquiva. |
| 3171 | Lucidez Escarlate | botas | lendario | 2800 | 0 | 3158+3802 | ap60 mp400 cdr0.15 | Lucidez: −15% na recarga das habilidades. |
| 3173 | Esmagadores Acorrentados | botas | lendario | 2800 | 0 | 3111+3211 | hp350 rm60 rm%0.15 | Correntes: +15% de Resistência Mágica total. |
| 3174 | Mobilização Blindada | botas | lendario | 2800 | 0 | 3047+3076 | hp350 arm60 arm%0.15 | Blindagem: +15% de Armadura total. |
| 3165 | Morellonomicon | mao | lendario | 2850 | 400 | 3916+1026+3067 | ap75 hp350 | Aflição: habilidades causam +12% de dano em inimigos com menos de 50% de Vida. |
| 3003 | Cajado do Arcanjo | arma | lendario | 2900 | 450 | 3070+3802+3108 | ap70 mp600 | Pavor: ganha Poder de Habilidade igual a 3% da sua Mana máxima. |
| 3068 | Égide de Fogo Solar | mao | lendario | 2900 | 700 | 3105+1031+1028 | hp450 arm50 arm%0.1 | Fogo Solar: +10% de Armadura total. A cada segundo, queima os monstros encostados em você (3 + 0,5 × nível + 0,3% da sua vida máxima). |
| 3100 | Perdição de Lich | arma | lendario | 2900 | 250 | 3057+3113+1026 | ap100 | Lâmina Encantada: depois de usar uma habilidade, o próximo ataque causa +75% do Poder de Habilidade como dano mágico. |
| 3143 | Presságio de Randuin | armadura | lendario | 2900 | 800 | 1031+1011 | hp350 arm75 arm%0.1 | Presságio: +10% de Armadura total. |
| 3152 | Explocinturão Hextec | armadura | lendario | 2900 | 350 | 3145+3067+1028 | ap70 hp350 ap%0.05 | Explosão Hextec: +5% de Poder de Habilidade total. |
| 3168 | Caminho Imortal | botas | lendario | 2900 | 0 | 3008+1053 | ad40 hp250 rv0.12 hp%0.05 | Caminho Imortal: +5% de Vida máxima. |
| 3175 | Sapatos Enfeitiçados | botas | lendario | 2900 | 0 | 3020+4630 | ap70 penMag0.15 | Feitiço Penetrante: 15% de penetração mágica. |
| 3190 | Medalhão dos Solari de Ferro | acessorio | lendario | 2900 | 700 | 3067+1029+1033 | hp300 arm35 rm35 hp%0.06 | Medalhão: +6% de Vida máxima. |
| 3742 | Couraça do Defunto | armadura | lendario | 2900 | 900 | 3066+1028+1031 | hp350 arm55 | Rolo Compressor: a cada 4s, o próximo ataque causa +40 de dano. |
| 8020 | Máscara Abissal | cabeca | lendario | 2900 | 1000 | 3140+3067 | hp450 rm55 hp%0.08 | Abismo: +8% de Vida máxima. |
| 3071 | Cutelo Negro | arma | lendario | 3000 | 225 | 3044+3067+1037 | ad45 hp400 | Talhar: cada ataque reduz a Armadura do alvo em 6%, acumulando até 30%. |
| 3102 | Véu da Banshee | mao | lendario | 3000 | 200 | 1058+4632 | ap105 rm40 | Escudo de Feitiço: bloqueia o próximo golpe de monstro (a cada 40s). |
| 3135 | Cajado do Vazio | arma | lendario | 3000 | 1050 | 4630+1026 | ap95 | Dissolver: 40% de penetração mágica. |
| 3172 | Grevas Bélicas | botas | lendario | 3000 | 0 | 3006+3086 | ad30 va0.45 rv0.06 ad%0.06 | Ritmo de Guerra: +6% de Dano de Ataque total. |
| 4629 | Ímpeto Cósmico | acessorio | lendario | 3000 | 450 | 3067+3113+3108 | ap70 hp350 | Ímpeto: −15% na recarga das habilidades. |
| 6653 | Tormento de Liandry | cabeca | lendario | 3000 | 800 | 3147+2508 | ap60 hp300 | Tormento: habilidades queimam o alvo, causando 1,5% da Vida máxima dele por segundo durante 3s. Em chefes e monstros de muita vida, a porcentagem tem um teto. |
| 3083 | Armadura de Warmog | armadura | lendario | 3100 | 500 | 1011+1011+3801 | hp1000 regen15 | Coração de Warmog: recupera 15 de Vida por segundo. |
| 3156 | Mandíbula de Malmortius | acessorio | lendario | 3100 | 750 | 3140+3133 | ad60 rm40 ad%0.05 | Linha da Vida: +5% de Dano de Ataque total. |
| 4633 | Criafendas | armadura | lendario | 3100 | 950 | 3147+3108 | ap80 hp350 ap%0.05 | Fenda: +5% de Poder de Habilidade total. |
| 6610 | Céu Dividido | arma | lendario | 3100 | 900 | 2021+3133 | ad40 hp400 | Choque de Luz: o primeiro ataque em cada inimigo é crítico e cura 6% da Vida perdida. |
| 6673 | Arco-escudo Imortal | mao | lendario | 3100 | 825 | 1037+6670 | ad55 crit0.25 hp%0.06 | Salva-vidas: +6% de Vida máxima. |
| 663056 | Coroa do Rei Demoníaco | cabeca | lendario | 3100 | 2500 | 1120+3133+1028 | ad40 hp350 arm25 ad%0.04 | Coroa Demoníaca: +4% de Dano de Ataque total. |
| 664644 | Coroa da Rainha Despedaçada | cabeca | lendario | 3100 | 2500 | 1120+3802+1026 | ap70 hp250 mp600 ap%0.06 | Coroa Despedaçada: +6% de Poder de Habilidade total. |
| 3026 | Anjo Guardião | acessorio | lendario | 3200 | 800 | 2019+1038 | ad55 arm45 | Renascimento: ao morrer, volta com 50% da Vida (a cada 300s). |
| 3053 | Sinal de Sterak | mao | lendario | 3200 | 775 | 1037+2021+1028 | hp400 | Pele de Aço: com menos de 30% de Vida, ganha um escudo de 60% da Vida bônus (a cada 90s). |
| 3153 | Espada do Rei Destruído | arma | lendario | 3200 | 725 | 1053+1043+1037 | ad40 va0.25 rv0.1 | Gume da Névoa: ataques causam 5% da Vida atual do alvo como dano extra. Em chefes e monstros de muita vida, a porcentagem tem um teto. |
| 4645 | Chama Sombria | arma | lendario | 3200 | 900 | 3145+1058 | ap110 | Chama Feroz: o dano mágico causa +20% em inimigos com menos de 40% de Vida. |
| 3157 | Ampulheta de Zhonya | acessorio | lendario | 3250 | 450 | 1058+2420 | ap105 arm50 | Stasis: com menos de 25% de Vida, fica invulnerável por 2,5s (a cada 120s). |
| 2501 | Armadura Sangrenta do Suserano | armadura | lendario | 3300 | 1000 | 2021+2021 | ad30 hp550 | Tirania: ganha Dano de Ataque igual a 2% da Vida bônus. |
| 3036 | Lembranças do Lorde Dominik | arma | lendario | 3300 | 550 | 3035+6670 | ad35 crit0.25 | Mata-Gigantes: 30% de penetração de armadura e +15% de dano contra chefes. |
| 3074 | Hidra Raivosa | arma | lendario | 3300 | 150 | 3077+1053+3133 | ad65 rv0.12 | Cleave: ataques causam 40% do Dano de Ataque nos outros inimigos que você alcança. Roubo de vida de 12%. |
| 3748 | Hidra Titânica | arma | lendario | 3300 | 50 | 3077+2021+1011 | ad40 hp600 | Cleave Titânico: ataques causam +1,5% da sua Vida máxima em todos os inimigos que você alcança. |
| 6333 | Dança da Morte | arma | lendario | 3300 | 275 | 2019+1037+3133 | ad60 arm50 | Ignorar a Dor: 30% do dano recebido vira sangramento ao longo de 3s. Ao abater, limpa o sangramento e cura 15% da Vida perdida. |
| 6631 | Quebrapassos | arma | lendario | 3300 | 750 | 3077+3044+1042 | ad40 hp450 va0.25 | Golpe Pesado: a cada 5s, o próximo ataque causa +80% do Dano de Ataque em todos os inimigos que você alcança. |
| 3078 | Força da Trindade | arma | lendario | 3333 | 133 | 3057+3044+3051 | ad36 hp333 va0.3 | Lâmina Encantada: depois de usar uma habilidade, o próximo ataque (ou o Disparo Místico do Ezreal) causa +200% do Dano de Ataque base. |
| 3072 | Sedenta por Sangue | arma | lendario | 3400 | 325 | 1038+1037+1053 | ad80 rv0.15 | Escudo Sanguíneo: a cura do roubo de vida que passar da Vida máxima vira escudo (até 25% da Vida máxima). |
| 3031 | Gume do Infinito | arma | lendario | 3500 | 725 | 1038+1037+1018 | ad75 crit0.25 | Golpe Infinito: seus acertos críticos causam +40% de dano. |
| 3089 | Capuz da Morte de Rabadon | cabeca | lendario | 3500 | 1100 | 1058+1058 | ap130 | Obra-Prima Mágica: aumenta seu Poder de Habilidade total em 35%. |

### 7.3 Efeitos NÃO descritos no catálogo (lógica dura no motor)

O campo `efeito` de `itens.js` é texto de UI/wiki; o comportamento real está codificado por id em `motor.js`. Diferenças relevantes entre o texto e o código:

- **3085 Furacão de Runaan**: o catálogo diz 55 %/15 %; o motor usa `longe ? 0.15 : 0.55` (`motor.js:1718`) — consistente.
- **3075 Armadura de Espinhos**: texto "10 + 10 % da armadura bônus"; motor `i.hp -= 10 + 0.1×bonusArmadura` (`motor.js:1735`) — consistente (dano fixo, sem mitigação).
- **6610 Céu Dividido**: primeiro ataque em cada inimigo é crítico (`motor.js:1699`), cura 6 % da vida perdida (`1704`).
- **6631 Quebrapassos**: +80 % do AD em área a cada 5 s (`motor.js:1719`).
- **3748 Hidra Titânica**: 1,5 % da vida máxima em todos ao alcance (`motor.js:1721`).
- **3074 Hidra Raivosa**: 40 % do AD nos outros (`motor.js:1720`).
- **3072 Sedenta**: excedente da cura vira escudo até 25 % da vida máx. (`motor.js:1229`).
- **3065 Semblante**: cura ×1,25 (`motor.js:1286`).
- **6653 Liandry**: queima 1,5 %/s por 3 s com teto `vidaRefItem` (`motor.js:1207`, `1190-1191`, `1652-1655`).
- **3153 Rei Destruído**: 5 % da vida **atual** com teto (`motor.js:1702`).
- **3071 Cutelo Negro**: −6 % de armadura por ataque, até 30 % (`motor.js:1705`).
- **2501 Suserano**: `ad += 0.02×(vida − vida base)` (`motor.js:514`).
- **3003 Arcanjo**: `ap += 0.03×manaMáx` (`motor.js:521`); **3089 Rabadon**: `ap ×1.35` (`522`); **3135 Vazio**: 40 % pen. mágica (`529`); **3036 Dominik**: 30 % pen. de armadura + 15 % vs chefe (`539`, `1214`).
- **3068 Égide Solar**: `3 + 0.5×nível + 0.003×vida` por segundo em raio 2,2 (`motor.js:1629`, `1633-1639`).
- **3100 Lich**: próximo ataque +75 % do AP mágico (`motor.js:1688`, `1944`); **6655 Luden**: eco a cada 6 s (`1945`).
- **3026/3053/3157/3102/6333**: gatilhos de morte/vida em `receberDano` (`motor.js:2698-2733`) e `morrer` (`motor.js:2729`).
- **3170/3173/3174/3190/8020/3152/4633/3168/6673/3172/3156/663056/664644**: só % totais (`pct`, `motor.js:501`, `509-524`).

---

## 8. Atributos e habilidades

### 8.1 Atributos (3 pontos por nível)

- `ATRIBUTOS` (`motor.js:441-452`): **Força** +1,2 de AD por ponto (nos campeões de magia vira **+2 de Poder**, `FORCA_MAGO` `motor.js:454`); **Vitalidade** +20 de vida e +0,1 de regen/s; **Resistência** +1,5 armadura e +1 RM; **Agilidade** +0,8 % de vel. de ataque e +0,25 % de esquiva (cap 25 %); **Foco** +8 mana, +0,06 regen de mana e −0,4 % de recarga (cap 30 %).
- Quem não usa mana (Yasuo, Katarina, Zac): `FOCO_SEM_MANA` (`motor.js:457-468`): Katarina/Zac −0,4 % recarga e **+0,2 % de dano das habilidades** (`FOCO_DANO_HAB = 0.002`); Yasuo +1 % de Fluxo (`FOCO_FLUXO = 0.01`).
- `PONTOS_POR_NIVEL = 3` (`motor.js:483`); modelos automáticos `MODELOS` (`motor.js:484-489`); `distribuirAtributos` coloca o ponto no atributo mais "atrasado" em relação ao peso (`motor.js:2853-2865`).
- `atributos(estado)` (`motor.js:492-544`) monta tudo: crescimento `(n−1)(0.7025 + 0.0175(n−1)) + max(0, n−18)` até o 18 e linear depois (`motor.js:434-437`); AD base do kit `adBase + adNivel×g` (`KITS`, `motor.js:870-894`); itens somam e aplicam percentuais (`504-524`); `velAtaque = min(3, attackspeed×(1 + aspd%/100×g + va))` (`534`); `regen = hpregen/5 + 0,1×vitalidade + itens` (`535`); `esquiva`, `reducaoRecarga`, `critico`, `danoCritico`, `penArmadura`, `penMagica`, `ouroMult` (`525-543`).
- Vida/mana iniciais e poções: `novoEstado` (`motor.js:998-1022`): nível 1, 150 de ouro, 10 poções de vida e 5 de mana, Q rank 1, local `fonte`.

### 8.2 Habilidades

- `ORDEM_HAB = ['Q','W','E','R','G','A','D','F','T','B','M','N']` (`motor.js:899`); barra de combate = **4 slots** (`BARRA = 4`, `motor.js:900`); 12 habilidades por kit, Q/W/E até rank 10, R até 5, as extras do MMORPG até 10 (`motor.js:551-552`); total `RANKS_TOTAIS` calculado em `motor.js:901`.
- **Ranks por nível** (`rankMaximoNoNivel`, `motor.js:905-912`): R nos níveis 6/11/16/25/35 (`nivelMinimoR`, `902`); N em 45/46/47/48/50 (`903`); Q/W/E = `ceil(nível/2)`; as outras = `1 + floor((nível − nívelMin)/2)`.
- Ganho de rank: `subirHabilidade` gasta 1 ponto, entra na barra se houver espaço (`motor.js:2813-2819`); `subirAutomatico` prioriza N, R, habilidades novas, Q, E, barra, D (`2821-2832`); `alternarBarra`/`trocarNaBarra` (`2834-2844`).
- Custo/recarga em combate: `pode(t) = barra.includes(t) && ranks[t] && recargas[t] <= 0 && mana >= HK[t].custo[r-1]` (`motor.js:1578`); ao usar: `recargas[t] = recarga × (1 − reducaoRecarga)` (`1581`). Mana: `gastarMana` (`1171-1174`); Yasuo usa **Fluxo** (100, enche lutando/andando, `motor.js:693`, `2031`, `1442`, `arena.js:1526`); Katarina não usa recurso (`manaMax = 0`, `motor.js:520`); Zac e Banho de Sangue pagam com vida (`custoVida`, `motor.js:861-863`, `2395-2400`).
- Tabelas de dano por rank: cada kit tem `base`/`ratio`/`mult` como séries de 10 (`serie`, `motor.js:550`) — ex. Darius Q `base = 50 + 30/rank`, `ratio = 1 + 0.05/rank`, recarga `9 − 0.5/rank` (`motor.js:554-556`); W `mult = 1.4 + 0.05/rank` (`557-559`); E penetração 20 %→45 % (`560-561`); R `base = 125 + 125/rank` + 75 % do AD bônus, ×(1 + 20 % por acúmulo) (`562-563`, `wiki-dados.js:68`).
- `efeitosRank` traduz cada campo numérico em texto para a UI (`motor.js:918-993`) — é a lista canónica de campos que uma habilidade pode ter.

### 8.3 Outros sistemas ligados a atributos

- Poder do Darius (5 acúmulos de hemorragia): `bonusPoder(nível) = 30 + 200×(min(nível,18)−1)/17 + 4×max(0, nível−18)` (`motor.js:1332`, ativação `1274-1282`).
- Mascotes: Poro/Krug/Dragãozinho/Aranhinha (`motor.js:3517-3532`), dano do pet = `basePet × ataque(nível)` (`1595-1604`, `arena.js:1617-1628`), onde `basePet = ad + (magia ? 0.5×ap : 0)` (`3532`).
- Montaria (Runeterra): `MONTARIA = {max:10, montar:1, base:0.3, porNivel:0.05}` (`motor.js:3624`), +30 %→+75 % de velocidade (`3633`); XP `250 + 250n` por nível (`3626`).
- Conquistas: bônus permanentes de AD/vida/armadura/RM (`motor.js:3478-3495`, aplicados `517-524`).
- Poções: `POCOES` (`motor.js:261-267`) — vida 300/900/2200 (níveis 1/15/30), mana 100/280 (1/15); exaustão 1 s (`EXAUSTAO`, `40`), 6 s em PvP com 30 % de cura (`POCAO_PVP`, `43`); uso automático só para VIP (`motor.js:1311-1312`).

---

## 9. Questões abertas / limites deste RE

1. **`runeterra.js` ausente — é o ficheiro que tem TODAS as coordenadas de Runeterra.** É importado por `wiki-dados.js:4` (`ZONAS`, `GUARDIOES`), `arena.js:11` (`zonaPkEm`, `PK_BONUS`) e `cena.js:8` (`zonaEm`, `cidadeEm`, `mundoLogico`, `ZONAS_PK`), `jogo.js:14` (`R.*`). Dele vêm: `R.LARG_M`/`R.ALT_M` (dimensões do mundo), `R.ZONAS` (lista das zonas = ids dos `LOCAIS` do Rift), `R.CIDADES`/`R.CIDADE` (`{x, y, r, faixa, nome}`), `R.ZONAS_PK`, `R.chegadaCidade(id)`, `R.mundoLogico().pontos` (os **pontos de nascimento** com `{x, y, zona, guardiao, fortaleza}`), `mundoLogico().fortalezas`, `NOME_ZONA`, `GUARDIOES`. Sem ele, **não é possível dizer onde, em coordenadas, cada zona/cidade/ponto de spawn fica** — só se sabe que o mundo usa tiles inteiros (`jogo.js:3980-3989`), que o campeão anda em tiles (`arena.js:4`) e que o spawn de monstro é limitado a `x∈[2,46], y∈[2,34]` (`arena.js:219`). **Ação**: pedir `docs/game-src/runeterra.js`.
2. **`chefe-global.js` ausente** (Vilemaw): importado por `arena.js:12` e `jogo.js:15`; define `VILEMAW` (`semMonstros` usado em `arena.js:283`, `1743`), `GOLPES_VILEMAW`, `danoVilemaw`, `proximaVilemaw`. Os golpes da Vilemaw são resolvidos localmente (`arena.js:1747-1786`) mas o **dano vem pronto do servidor** (`arena.js:1749`), e os ovos viram `Cria de Vilemaw` (`motor.js:291`). Nada disso é reproduzível sem o ficheiro.
3. **`mundo.js` ausente**: `gerarMapa(bioma, semente)`, `gerarMundo()`, `gerarAbismo()`, `caminho()`, `vizinhos()` (`cena.js:6`, usados em `cena.js:346`, `610`, `637`, `665`). Portanto a **geometria do Rift** (onde ficam paredes/tiles livres) não é conhecida — só a posição decorativa no minimapa (`LOCAIS[].pos`).
4. **`dados*.js` ausentes**: os atributos-base de cada campeão (`stats` com `hp, hpperlevel, armor, spellblock, attackspeed, mpregen, mp, …`) vêm de `DADOS`/`DADOS_EZREAL`/… (`motor.js:2-8`, `KITS` `motor.js:864-895`). `adBase`/`adNivel` estão no motor (ex. Darius 64/3,9 — `motor.js:870`), mas vida/armadura/RM/mana/vel. de ataque base **não**. Também vêm de lá os nomes das habilidades (Q/W/E/R) e as skins.
5. **Cálculos que são do SERVIDOR** (declarados no código, não reproduzíveis aqui):
   - **dano de PvP** entre jogadores e monstros de outros jogadores (`motor.js:1195-1199`, `1939`, `arena.js:1594-1613`);
   - **sorteio da qualidade** de todo item (`motor.js:170-171`, `195-243`, `3415`);
   - **entrega de tarefa/diária/prêmio de login**, presente de nível, loja, cofre, morte (queda de itens), reset de atributos (`motor.js:3238`, `3354`, `3409-3423`, `3655`, `2963`, `2738`);
   - **VIP** (`vipAte`) e bônus de Twitch/evento/grupo (`motor.js:141`, `1742`, `1746`, `1750`, `arena.js:1650`);
   - **anti-speedhack**: `estado.tempoJogo` é comparado com o relógio do servidor (`motor.js:1339`);
   - **habilidades em PvP**: o motor só manda o "lance" (tecla/índice) e o servidor confere teto (`motor.js:1196-1198`).
6. **`arena-pvp.js` ausente**: regras da Arena 1v1 (`ARENA_PVP.mapa`, `intervaloSeg`, `centro`; `cena.js:7`, `jogo.js:7`, `4691`) — não há monstros lá (`motor.js:377-378`).
7. **`i18n.js`/`i18n-dados.js` ausentes**: todo o texto visível passa por `t()` (`motor.js:10`); os templates estão citados em §6.2, mas a tradução EN vive nos ficheiros ausentes.
8. **Nada foi validado em execução**: não houve browser/CDP/jogo. Todos os valores são leitura estática; tabelas "(derivado)" são reimplementação aritmética das fórmulas citadas.

### Contradições encontradas

- **C1** — `wiki-dados.js:4` importa `'./runeterra.js'` e `wiki-dados.js:10` fala de `js/arena.js` para a chance de chefe; o ficheiro fornecido chama-se `arena.js` mas o módulo `runeterra.js` é **outro** (importado por `arena.js:11`). Nomes de módulos em comentários do motor (`js/runeterra.js` em `motor.js:373`, `js/arena.js` em `motor.js:415`) referem-se a ficheiros que não estão no conjunto.
- **C2** — `arena.js:250` (comentário) diz "elite (3x a vida)" mas `arena.js:252` multiplica por **15**; `arena.js:251` corrige na linha seguinte ("elite: 15x a vida; chefe: 3x") e `wiki-dados.js:13` confirma 15/3. Comentário morto.
- **C3** — `arena.js:249` diz que "o monstro surgindo do p577 foi desligado no p579", mas `MUNDO.surgir = 1.5` continua em `arena.js:26` e `i.surgindo` continua a ser respeitado (`motor.js:1194`, `arena.js:332`). Nenhum spawn atribui `surgindo` no código fornecido → constante morta (ou atribuída em ficheiro ausente).
- **C4** — `MUNDO.respawn = [20,35]` (`arena.js:26`) não é lido em nenhum ficheiro fornecido: em `gerirPontos` o respawn é `p.t = 0` (comum) ou `p.t = 10` (guardião) (`arena.js:269-273`). Ou é usado em `runeterra.js`/`cena.js` não coberto, ou é configuração órfã.
- **C5** — `motor.js:1120` (comentário) diz "furioso conta como chefe no automático (p632)", mas no código o chefe retorna antes do sorteio de furioso (`motor.js:1121` vs `1124-1127`), logo uma wave de chefe nunca tem furioso; o comentário refere-se ao modo automático do bot, não a este ramo.
- **C6** — Duas noções diferentes de "surgir": `AR.surgir = [7,10]` = distância de spawn em tiles na Arena sem pontos (`arena.js:21,217`); `MUNDO.surgir = 1.5` = segundos "surgindo" do mundo aberto (`arena.js:26`) — este último sem uso (ver C3).
- **C7** — `motor.js:344` fixa `VEL_ATAQUE_MAX = 3` com o comentário "era 2,5, o do LoL" — ou seja, o cap **não** segue o LoL; e o teto vale para o campeão (`motor.js:534`), não para monstros (que usam `i.as` direto, `motor.js:1730`).
- **C8** — `itens.js` é gerado do Data Dragon 16.19.1 (`itens.js:1`) e traz `efeito` textual; o motor **não lê esse campo** para a mecânica (só `temAtributo`, `motor.js:20`) — a mecânica está hardcoded por id (§7.3). Um mesmo item pode ter texto e comportamento ligeiramente diferentes (ex. Furacão: 55 %/15 % no texto e no código).
- **C9** — `motor.js:1772` permite ignorar básicos (`estado.ignorarBasicos`), mas nenhuma rota de UI fornecida escreve esse campo; e `processarAbates` marca itens perdidos quando a mochila enche (`motor.js:1774`) sem os devolver ao chão no Rift (só em Runeterra, via servidor).

---

## Anexo A — Estimativas por wave (para o Lead)

Fórmulas prontas para estimar cura/dano/ouro/xp por wave no Rift, com as fontes:

- **Tamanho da wave**: 2, 3 ou 4 (uniforme) — `motor.js:1124`. Média 3.
- **Tempo de ciclo por wave** (aproximado): `chegada` do 1º = 1,2 s (`motor.js:1126`; +1,2 s para atiradores, `1423`) + tempo de matar + `1,5 s` de respawn (`1625`). O motor não impõe tempo mínimo de combate; o DPS do campeão decide.
- **XP por wave** = Σ `CURVA.xp(n) × m.xp × fatorXp(nível, n)` × multiplicadores (`motor.js:1765`, `421`). Com nível = nível do monstro, `fatorXp = 1`.
- **Ouro por wave** = Σ `CURVA.ouro(n) × m.ouro × U(0.5,1)` × `a.ouroMult` (`motor.js:1071`, `1758`).
- **Dano recebido por wave** (bruto, antes de mitigação) = Σ `i.ad × (aura ? 1.25 : 1)` por golpe, com `1/as` segundos entre golpes (`motor.js:1730`, `1734`); multiplicar por `fatorDanoMonstro` (`1186`) e `papel.recebido` (`2697`).
- **Cura necessária** = dano recebido − regen natural (`motor.js:535`, `1356`) − poções (`1305`).
- **(derivado) valores por abate no nível do meio de cada zona** (sem bônus, `fatorXp = 1`): rota-inf 49–55 xp / 20–22 ouro; rota-sup 84–149 xp / 35–69; lobos 141/51; azul 196–326 xp / 70–129; vermelho 218–396 xp / 69–152; rio 256–280 xp / 82–90; dragão 295–402 xp / 95–133; barão 473–507 xp / 158–170. Chefes: 3.300/1.566 (Arauto 35), 4.340/2.072 (Dragão 40), 7.600/3.660 (Barão 50).
- **Runeterra** multiplica XP **e chance de drop** por `ARENA.bonus = 1.3` (`motor.js:412`, `arena.js:1650`), mais o bônus de grupo até `×1.45` só em XP (`arena.js:1650`); a cadência lá é limitada por `MUNDO.ativo/aggro/leash` (§1.3, §2.2), não por waves.

## Anexo B — Eventos do motor (para hooks da extensão)

`passo`/`passoArena` empilham eventos em `c.eventos` via `emitir(c, tipo, dados)` (`motor.js:1169`). Tipos emitidos em `motor.js`: `grupo`, `dano`, `abate`, `abateRoubado`, `recebido`, `cura`, `pocao`, `semPocao`, `esquiva`, `morreu`, `renasceu`, `nivel`, `chegouBase`, `recall`, `recallCancelado`, `rotinaVolta`, `tarefaPronta`, `habilidade`, `item`, `buffBarao`, `chefeCarrega`, `chefeGolpe`, `chefeInterrompido`, `chefeInvoca`, `kite`, `mascoteAtaque`, `mascoteNivel`, `fluxo`, `ventoBloqueia`, `poder`, `sombraGolpe`, `arcanaMarca`, `arcanaExplode`, `rastro`, `ressonancia`, `dominioCresce`, `dancaCorte`, `convergencia`, `varinhaVolta`, `portalAtravessa`, `portalFecha`, `iscaTiro`, `iscaSome`, `ricochete`, `ricocheteExplode`, `corteFantasma`, `bravata`, `acertoMonstro`, `iluminacao`, `prisma`, `luden`, `centelha`, `adagaGiro`, `adagaSome`, `lotusLeva`, `lotusFim`, `tempestadeFim`, `facetado`, `deslumbrar`, `resplendor`, `gosma`, `gosmaPega`, `gosmaSome`, `divisao`, `reuniu`, `quique`, `quiqueFim`, `pocaFim`, `cloneGolpe`, `mitoseFim`, `barragem` (cada `emitir` tem a linha exata no ficheiro; `grep "emitir(c, '" motor.js`). Em `arena.js`: `zona`, `zonaPk`, `arenaPausa`, `arenaVolta`, `montando`, `montou`, `desmontou`, `montariaCancelada`, `montariaNivel`, `acertoPvp`, `ataquePvp`, `acertoMonstro`, `ataqueMonstroOutro`, `tiroMonstro`, `golpeAviso`, `pisaoAviso`, `pisao`, `golpeGuardiao`, `guardiaoFuria`, `guardiaoVencido`, `chavePega`, `limparCovil`, `arenaFalhou`, `lotusFim`, `adagaSome`, `zacCargaFim`, `iscaTiro`, `iscaSome`, `golpeGuardiao`.
