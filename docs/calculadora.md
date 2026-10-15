# A CALCULADORA DO JOGO — tudo calculável a partir do motor

> **Ficheiro:** `tools/calc-jogo.mjs` (novo). **Corre-se com** `bun tools/calc-jogo.mjs`.
> **O que é:** uma biblioteca que LÊ `docs/game-src/motor.js` como TEXTO, extrai todas as
> declarações (funções e constantes) e avalia-as num sandbox com as dependências reais
> (`itens.js`, `balanco.js`, `dados.js`). Cada valor que sai carrega o `file:linha` de onde veio.
> **Não escreve nada.** Não toca em browser/CDP/jogo. Só lê ficheiros e imprime.

Objectivo do dono: *«agora faz TUDO ser observável, TUDO ser calculável, e NADA ser surpresa»*.
Este ficheiro é a base disso: **deixa de haver número que não se consiga dizer de onde veio.**

---

## 1. Como se corre

```
bun tools/calc-jogo.mjs              relatório completo: inventário, valores, validação, divergências
bun tools/calc-jogo.mjs --json       o mesmo em JSON (para outras ferramentas)
bun tools/calc-jogo.mjs --api        índice anotado: nome -> motor.js:linha (427 declarações)
bun tools/calc-jogo.mjs --expr "…"   calcula UMA expressão com todas as fórmulas no escopo
bun tools/calc-jogo.mjs --testes     15 auto-verificações (a biblioteca prova-se a si mesma)
bun tools/calc-jogo.mjs --prova      PROVA DE QUE É LIDO, NÃO COPIADO (muta o texto do motor em memória)
```

Exemplos:

```
$ bun tools/calc-jogo.mjs --expr "infoItem('4629+3~A')"
{ id: '4629', nome: 'Ímpeto Cósmico +3', …, cdr: 0.23459999999999998, … }

$ bun tools/calc-jogo.mjs --expr "CURVA.hp(40) * MONSTROS['Dragão Infernal'].hp"
69000
```

### A biblioteca, dentro de outra ferramenta

```js
import { carregar } from './calc-jogo.mjs';
const C = carregar();

C.valor('CURVA').hp(30);                          // 4050   (motor.js:274)
C.linhaDeChave('CURVA', 'hp');                    // 274
C.linhaDeChave('MONSTROS', 'Dragão Infernal');    // 296
C.call('infoItem')('4629+3~A').cdr;               // 0.2346 (motor.js:252-255)
C.fonte('criarMonstro');                          // docs/game-src/motor.js:1066-1075
C.avaliar('mitigar(1000, 100)');                  // 500    (motor.js:1167)
```

| campo | o que é |
|---|---|
| `C.valor(nome)` | o valor de qualquer declaração do motor (const, função, tabela) |
| `C.call(nome)` | o mesmo, mas exige função (erro claro se não for) |
| `C.fonte(nome)` | `docs/game-src/motor.js:251-256` |
| `C.L`, `C.linhaTexto(n)` | o motor linha a linha (1-based) |
| `C.linhaDeChave(decl, chave)` | a linha de `CURVA.hp`, de `MONSTROS['Dragão Infernal']`, de `QUALIDADES.S` |
| `C.info(nome)` | `{ nome, tipo, ini, fim, fonte, texto, estado, erro }` |
| `C.remendos` | os `Object.assign` de `motor.js:16-26` (o motor REMENDA 6 itens em memória) |
| `C.statements` | os statements de topo (19) — a §3 explica porque importam |
| `C.imports` | os 10 `import` de `motor.js:2-11`, com os que existem e os que faltam |
| `C.avaliar(expr)` / `C.trecho(expr, nomes)` | avalia no escopo do motor / compila um TRECHO literal |

---

## 2. Porque é que o motor não é importável — e como se contorna

`motor.js:2-11` importa **10 ficheiros**. Em `docs/game-src/` existem 4:

| import | ficheiro | existe? |
|---|---|---|
| `motor.js:2` `./dados.js` | `docs/game-src/dados.js` | sim (só o Darius) |
| `motor.js:9` `./itens.js` | `docs/game-src/itens.js` | sim (108 itens) |
| `motor.js:11` `./balanco.js` | `docs/game-src/balanco.js` | sim (11 faixas) |
| `motor.js:10` `./i18n.js` | — | **não** (só `i18n-dados.js`; injecta-se `t = x => x`, `ingles = false`) |
| `motor.js:3-8` `dados-ezreal/yasuo/lux/katarina/taric/zac.js` | — | **NÃO EXISTEM** |

Sem esses 6 ficheiros **não há coeficientes de jogador** (hp/armadura/mp por nível —
`motor.js:495-496` e `motor.js:520`). A calculadora injecta um proxy inerte para os 6 em falta: os
objetos literais (nomes, descrições) constroem-se na mesma, e qualquer uso **aritmético** lança
erro claro, em vez de devolver `NaN` calado.

**Consequência honesta:** `atributos()` / `novoEstado()` só correm para o **Darius**. Para os outros
6 campeões a função está extraída e pronta, mas chamá-la aponta para `motor.js:495-496`. Para medir o
jogo de verdade faltam esses 6 ficheiros (§6).

---

## 3. O que foi extraído (e o que quase escapou)

```
427 declarações de topo   (310 exportadas · 117 privadas)  ->  0 falhas
 19 statements de topo    <- os que uma leitura por declaração perde
 10 imports               (4 existem, 6 faltam)
  6 remendos do catálogo  (motor.js:16,17,18,24,25,26)
```

**Os 19 statements de topo não são detalhe.** Sem eles a calculadora mentiria:

| linha | statement | o que faz |
|---|---|---|
| `motor.js:50` | `for (const i of ITENS_DADOS) POR_RARIDADE[raridade(i)].push(i.id)` | enche o pool de loot |
| `motor.js:408` | `for (const i of ITENS_DADOS) { … POR_CLASSE.ad/ap … }` | separa o que é de AD e o que é de AP |
| `motor.js:407` | `for (const l of LOCAIS) { l.drops = DROPS[l.id]; l.dropsAp = DROPS_AP[l.id] }` | prende os drops em cada zona |
| `motor.js:670/772/815/857` | `HAB_LUX/KATARINA/TARIC/ZAC[t].escalaPoder = true` | marca as habilidades que escalam com Poder de Habilidade |
| `motor.js:147` | `VIP.salvarConvidado = 1` | +1 dia de VIP ao convidado que salva a conta |

Só o `motor.js:407` explica algo que parecia inexplicável: `LOCAIS` **não tem** `drops` no literal
(`motor.js:354-379`), mas o `bosses.json` (medido) tem. A ligação é `DROPS` (`motor.js:383-392`) +
`DROPS_AP` (`motor.js:397-406`) + o `for` do `407`. Uma leitura que só apanhe declarações
concluiria *o motor não tem drops por zona* — e estaria errada.

**Os 6 remendos** (`motor.js:16-26`) alteram o catálogo **em memória** e não estão no `itens.js`:
`2022` cdr 0,05 · `1006` regen 3 · `3057` efeito · **`4629` cdr 0,15** · `3108` cdr 0,05 ·
`3802` cdr 0,05. Sem os correr, `infoItem('4629~B').cdr` daria **0** em vez de 0,15 — e a dica
medida *−23% recarga* do `4629+3~A` pareceria impossível.


---

## 4. As fórmulas pedidas: onde estão e quanto dão

| pedido | onde está | valor verificado |
|---|---|---|
| CURVA | `motor.js:273-279` (+ `ajuste` `motor.js:272`, da planilha) | `hp(30)=4050` · `ad(33)=309` · `armadura(40)=65` · `xp(40)=310` · `ouro(40)=148` |
| MONSTROS | `motor.js:280-298` | 15 espécies × 8 campos |
| criarMonstro | `motor.js:1066-1075` | `Dragão Infernal nv40`: hp 69000, ad 1227, armadura 104 |
| mitigar | `motor.js:1167` | `mitigar(1000,100)=500` · `mitigar(1000,0)=1000` |
| RM_MONSTRO | `motor.js:1179` | 0,6 → dano mágico usa `armadura × 0,6 × (1−penMag)` |
| pen do golpe | `motor.js:1202` | físico pen 0,3 → arm 70; mágico pen 0,55 → arm 27 |
| crítico | `motor.js:499` / `515` / `541` / `1213` | base 1,75; Gume (3031) +0,4; aplicado em `dano *= a.danoCritico` |
| `tem('id')` | `motor.js:513-540` | `tem = (id) => estado.itens.some(x => baseId(x) === id)` |
| TETO_VIDA_ITEM | `motor.js:1190` | 3 |
| vidaRefItem | `motor.js:1191` | `Dragão nv33`: hpMax 54468 → **13617** (mordido pelo tecto) |
| Voracidade | `motor.js:736` + uso `motor.js:1789` | 1,5 s (monstro) / 5 s (chefe) de Q/W/E por abate |
| mecânicas de chefe | `motor.js:3066-3125` | rodízios, `carrega`, `espera` e multiplicadores inline |
| respawn/grupo | `motor.js:1116-1130` (+ `1421`, `1625`, `3046`) | qtd 2..4; respawn 1 s |
| poções | `motor.js:41` / `43` / `261-267` / `1293-1298` | cura 300/900/2200 (vida) e 100/280 (mana); preços 40/110/260/30/80 |
| refino | `motor.js:54-62` / `258` | BONUS 0,12; chances 30/12/2/0,8/0,3 %; regressão 0/0/4/1,5/0,6 % |
| qualidade | `motor.js:173-179` | C 49,9495 % ×0,9 · B 35 % ×1 · A 15 % ×1,15 · S 0,05 % ×1,35 · SS 0,0005 % ×1,7 |
| infoItem | `motor.js:251-256` | escala `ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr` — **não** `penMag` |
| valorEquip | `motor.js:2898` | `preco × (1+0,12×refino) × mult` |
| valorVenda | `motor.js:257` | `floor(preco × 0,5 × (1+0,5×refino) × venda)` |

### O detalhe que muda tudo (Regra Nº 1: ler a LISTA, não o valor)

`infoItem` (`motor.js:251-256`) escala **11 campos** — `ad, ap, mana, vida, armadura, rm, va, rv,
`critico, regen, cdr` — por `(1 + 0,12 × refino) × mult` e **não escala `penMag`** (o campo entra
por `{...i}` sem tocar em `m`). Duas provas medidas:

| item | a dica diz | a calculadora dá | |
|---|---|---|---|
| `4629+3~A` | *−23% recarga* · *+109.5 poder* · *+547 vida* | `cdr 0,2346` (= 23,46 %) · `ap 109,48` · `vida 547,4` | OK |
| `3175~A` | *15% de penetração mágica* | `penMag 0,15` — **cru**: `3175+5~SS` também dá 0,15 | OK |

Ou seja: um lendário `+5` de qualidade SS não tem mais penetração que um A normal. Está no
`motor.js:254`, é assim que o jogo joga, e agora está escrito.

---

## 5. Validação contra o que foi medido (`docs/snapshots/`)

| # | validação | resultado |
|---|---|---|
| 3.1 | `MONSTROS` × `bosses.json` | **101 campos / 15 espécies, iguais** |
| 3.2 | `LOCAIS` × `bosses.json` | **128 campos / 11 locais, iguais** (inclui `drops`/`dropsAp`, depois do statement `motor.js:407`) |
| 3.3 | `infoItem`/`valorVenda` × `bag.json` + `farm.json` | 196 campos comparados, **191 iguais**, 5 divergências (§5.1) |
| 3.4 | `poder()` × dicas do `bag.json` | **12/12 exactos** (§5.2) |
| 3.5 | `POCOES` × `potions.json`/`status.json` | OK — a Suprema está a 0 porque o nível 29 < `motor.js:264` (nível 30) |
| 3.6 | `Dragão Infernal` | nível, folha de stats e dano — **bate com a medição** (§5.3) |
| 3.7 | `Barão Nashor` | idem (§5.4) |
| 3.8 | ouro/xp por abate × `farm.json` | modelo 369,6 xp / 121,4 ouro vs medido 396,2 / 136,5 → razão **1,07× / 1,12×** |
| 3.9 | consistência interna + distribuições | OK (§5.5) |

### 5.1 As 5 divergências (todas do lado de quem escreveu o snapshot)

1. **`stats.armadura` × 10 (4 casos)** — `3075~C` medido **675**, motor **67,5**; `3075~A` medido
   **863**, motor **86,25**. A **dica do mesmo item** diz *+67.5 armadura*, igual ao motor
   (`motor.js:251-256`, base em `itens.js`). Quem gravou o `bag.json` é que multiplicou por 10.
2. **`stats.penMag` de `3135~A` (1 caso)** — o `farm.json` grava **0,4**. O motor **não tem**
   `penMag` no catálogo para o 3135: esse 40 % entra pelo caso especial `motor.js:529`
   (`(tem('3135') ? 0.4 : 0) + pct.penMag`, com tecto 0,6). É o **único** sítio em que a extensão
   mostra um número que o motor só calcula em combate.

### 5.2 `poder()` — 12/12

`poder(29, [3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A]) = 3195` e a dica diz *Poder: 3.195*.
Com a troca de cada item da mochila, o modelo acerta **todas** as segundas metades:

```
3173~A  -> 3184   3075~C -> 3071   3108~A -> 2948   3075~A -> 3132
4645+2~A -> 3307  664644~A -> 3207 3075~B -> 3095  3157~C -> 3143   3171+2~B -> 3209
```

(O alvo da comparação vem da própria dica — *Comparado com o equipado: Cajado do Vazio [A]* —
que é o que a extensão usou. Adivinhar por «mesmo espaço» dava valores diferentes e 4 falsos
divergentes.)

### 5.3 `Dragão Infernal` (zona `dragao`, `nm=[30,38]`, jogador nível 29)

- **Nível: sempre 33.** `gerarGrupo` com `nivelJogador = 29` dá `max(30+2, min(38+2, 29+4)) = 33`
  (`motor.js:1121`; único chamador `motor.js:1421`, que passa `estado.nivel`). Em 4000 grupos
  amostrados: mobs **sempre nível 30**, chefe em **1,48 %** dos grupos (a chance é 1,5 %,
  `motor.js:370`).
- **Folha `nv33`**: hpMax **54468** · ad **926,91** · armadura **87,2** · as 0,55 · xp 3654.
- **Ataque básico medido pelo motor** (`inimigoAtaca` `motor.js:1725-1737` → `receberDano`
  `motor.js:2693-2735`), com o jogador medido (vida 4476, armadura 164, **rm 134** — o Dragão é
  mágico, `motor.js:296`): **297,09**. A medição tem **296 ×95, 297 ×45, 295 ×18, 298 ×14,
  288 ×21** (`katarina.json`, 50 lutas). Erro **0,4 %**.
- **Mecânicas** (40 s de luta, rodízio real): `sopro` **653,59** (`motor.js:3105`) · `chuva`
  **534,76** (`motor.js:3106`) · `rugido` sem dano (`motor.js:3107`). Medido: 653-680 e **534** ×4.
  A queimadura por golpe é lida das próprias linhas (`motor.js:3105-3108`): sopro 3 % = 134,3/s · chuva 2,5 % = 111,9/s · ácido 2,8 % = 125,3/s com 4476 de vida — e a medição
  tem **32** a cada ~250 ms (≈128/s).
- **Dano do jogador**: Q rank 10 da Katarina = `(395 + 0,72 × 1104) = 1189,9` bruto →
  `penMagica 0,55` (`motor.js:529`, cap 0,6, pelas botas 3175 + o cajado 3135) → armadura eficaz
  **23,54** (`87,2 × 0,6 × 0,45`, `motor.js:1202`) → **1155,7** de dano. Medido: **1156**.
- **Cadência do rodízio: 27,9 s por mecânica** — `(1,0+9) + (1,1+9) + (0,8+7) = 27,9`
  (`HAB_CHEFE` `motor.js:3069-3079` + `mecanicaChefe` `motor.js:3081-3125`). O campo `espera`
  **não** é o intervalo do rodízio.

### 5.4 `Barão Nashor` (zona `barao`, `nm=[40,48]`, jogador nível 29)

Nível **42** (`max(40+2, min(48+2, 33))`). Folha: hpMax **97824** · ad **1407,74** · armadura **122,4**.
Ataque básico **1060,32** — mata o jogador medido (4476) em **5 golpes**. Mecânicas:
`tentáculos` **2443,56** (`motor.js:3109`) · `ácido` **1272,38** (`motor.js:3108`, queimadura 2,8 %/s).
Rodízio real: **invocar → tentáculos → ácido, 34,3 s cada** — `(0+14) + (1,3+9) + (1+9) = 34,3`,
o mesmo 34,3 s de `docs/troca-em-combate.md` (medido ali por simulação passo a passo:
invocações em t = 6,82 / 41,12 / 75,42 / 109,72 s). O `invocar` (`motor.js:3117-3121`) cria **2
larvas do Vazio a nível 42−6 = 36** — e as larvas dão xp/ouro/itens: a mecânica não é só dano.

### 5.5 Consistência interna e distribuições (o que era «sorte»)

- `sortearQualidade(0)` em 200 000 sorteios: C 49,89 % · B 35,12 % · A 14,94 % · S 0,051 % ·
  SS 0,001 % — contra os pesos de `motor.js:174-178`.
- `chancesQualidade(4)` (montar com peças SS): A **34,58 %** · S 0,131 % · SS 0,002 % — o bónus de
  montagem (`motor.js:182-187`) é grande e quase ninguém o usa.
- `chancesDrop(dragao)`: lendário **0,0328 %** · épico 0,14 % · básico 0,8984 %; `DROP_CHEFE` dá
  lendário 0,1 % / épico 5 % / básico 40 % por abate de chefe (`motor.js:1145`).
- Furiosos: **1,599 %** dos monstros nos grupos do `dragao` (chance 5 % por grupo, `motor.js:1106`).
- `REFINO_MAX` 5 = `CHANCE_REFINO`.length = `REGRESSAO_REFINO`.length; `PERSISTENCIA.forja` com as 5
  chaves; pesos de qualidade a somar 100 %; todos os `chefe`/`monstros`/`de`/`espólios` resolvem.

---

## 6. O que NÃO é extraível ou avaliável (sem reescrever nada à mão)

**Nenhuma declaração falhou.** O que não se pode avaliar, e porquê:

1. **`atributos()`/`novoEstado()` de ezreal, lux, yasuo, katarina, taric e zac** — faltam os 6
   `dados-<campeao>.js` (`motor.js:3-8`). A função está extraída; chamar com um desses campeões dá
   erro claro a apontar para `motor.js:495-496`. **Para medir o jogo a sério, é esse o ficheiro
   que falta.** (Darius funciona: `dados.js` existe — é assim que as auto-verificações correm.)
2. **`i18n.js`** (`motor.js:10`) — falta; o motor só usa `t()` e `ingles`. Injecta-se `t = x => x`,
   `ingles = false`. Nenhum número depende disso.
3. **Estado mutável de módulo** — `proximoId`, `bonusTwitchXp`, `bonusEventoXp`, `motorArena`,
   `cidadeAtual`, `cofreLiberado` vivem no escopo do sandbox: as escritas propagam-se pelo registo
   partilhado, por isso quem chamar `usarBonusTwitch(1.5)` e depois `bonusTwitchAtual()` vê 1,5.
4. **`passo()`/`acoesComuns()`/as ações de cada kit** — são funções de estado completo; precisam de
   um `criarCombate()` + cena montados. As peças isoladas (`golpear`, `inimigoAtaca`,
   `mecanicaChefe`, `receberDano`) correm sozinhas — é assim que as validações acima foram feitas.
5. **O que é decidido no servidor** — qualidade `~?`, mercado, VIP, prémios, bónus de Twitch/evento:
   o motor só consome. Por isso o modelo de xp/ouro por abate dá **1,07×/1,12×** abaixo do medido:
   esses multiplicadores são de estado e não estão no save.

### Sobre o `armadura 104 / 69 000 de vida` que aparece em `docs/hardcodes-build.md:299`

Aquilo descreve um `Dragão Infernal` de **nível 40** (`CURVA.armadura(40)×1,6 = 104`,
`CURVA.hp(40)×12 = 69000`), que é `n1 + 2`. Mas o motor só dá `n1 + 2` quando `gerarGrupo` é
chamado **sem** `nivelJogador` (`motor.js:1121`) — e o único chamador (`motor.js:1421`) passa
`estado.nivel`. Para um jogador de nível 29 o motor dá **sempre 33** (armadura 87,2, hp 54468), e é
esse nível que bate com os golpes medidos (296 ≈ 297,09). A âncora de nível 40 usa outra
convenção de nível — a mesma família das «cinco convenções» de `docs/auditoria-friccao.md:61`.
**O valor do motor é o que se deve usar; a divergência fica escrita aqui.**

---

## 7. Prova de que os números são lidos, não copiados

`bun tools/calc-jogo.mjs --prova` muda o **texto** do motor em memória (não escreve ficheiro
nenhum) e mostra que a calculadora muda com ele:

```
MUDOU CURVA.hp     motor.js:274   150 + 100*n -> 250 + 100*n: 4050 -> 4150
MUDOU CURVA.ad     motor.js:275   0.13*n^2 -> 0.26*n^2: 270 -> 387
MUDOU BONUS_REFINO motor.js:55    0.12 -> 0.20: cdr 0.2346 -> 0.276
MUDOU CHANCE_REFINO motor.js:60   0.30 -> 0.60: 0.3 -> 0.6
MUDOU MONSTROS     motor.js:298   Dragão Infernal hp 12 -> 20: 12 -> 20
MUDOU DROP_CHEFE   motor.js:1145  lendário 0.001 -> 0.05
MUDOU PERSISTENCIA motor.js:69    max do +3 120 -> 20
MUDOU TETO_VIDA    motor.js:1190  3 -> 1
MUDOU QUALIDADES   motor.js:177   peso do S 0.05 -> 5
9/9 mutações mudaram a calculadora.
```

Se o jogo buffar ou nerfar amanhã, a saída muda no mesmo dia **sem ninguém tocar neste
ficheiro** — que é a regra de arquitectura do dono, verbatim. (É exactamente o que o
`tools/sim-chefes.mjs:24-43` e o `inject.js:133-139` não fazem: têm a CURVA e o spawn copiados à
mão. Aqui não há número copiado.)

---

## 8. As 15 auto-verificações (`--testes`)

```
infoItem escala cdr com refino e qualidade      0.15 -> 0.186 (x1.24)
infoItem NAO escala penMag                      0.15 -> 0.15 (3175+5~SS igual a 3175~B)
remendos do catálogo aplicados                  2022=0.05 4629=0.15 3108=0.05 3802=0.05
mitigar é simétrica em armadura 0               mitigar(1000,0)=1000
vidaRefItem aplica o tecto                      122400 -> 22950 (3x CURVA.hp(50))
diferença de nível livre                        29 x 33 -> fator 1/1
qualidades somam 100%                          OK
monstros batem com bosses.json                  15/15 iguais
infoItem de 4629+3~A (dica medida)              ap 109.48 vida 547.4 cdr 0.2346
valorVenda de 3173~A (medido 2100)              2100
poder do equipamento medido                     3195 (dica 3.195)
mecânica do chefe corre de verdade              ataque básico 297.1 (medido 296-297)
Q da Katarina pelo golpear do motor             penMagica 0.55, bruto 1189.9, dano 1155.7 (medido 1156)
xpParaNivel cresce                              1:762 2:984 10:46200 29:6660000 50:309000000
gerarGrupo em dragao (nível 29)                 mobs nível 30, chefe nível 33
15/15 verificações passaram
```

---

## 9. O que falta para «nada ser surpresa» de facto

1. **Os 6 `dados-<campeao>.js`** (`ezreal`, `yasuo`, `lux`, `katarina`, `taric`, `zac`). Sem eles não
   há `atributos()` — e portanto vida/armadura/AD/AP reais dos 6 campeões. Com eles, a calculadora
   valida `player.json` (nível 29, vida 4476, armadura 164, rm 134, AD 161, AP 1104, VA 1,16) contra
   o modelo, em vez de os injectar como entrada medida (como hoje).
2. **`i18n.js`**, se algum dia um número passar a depender de texto.
3. **Uma medição do servidor** para os multiplicadores de estado (VIP, evento, Twitch, conquistas,
   mascote), que hoje deixam a razão de 1,07×/1,12× em aberto.

Nada disto é regra do dono: é dado do jogo que está fora de `docs/game-src/`. Não há nenhuma
decisão do dono pendente nesta frente — todos os números que o motor aplica estão modelados.

---

## 10. Ficha

- escreve: **nada** (só lê e imprime). Não corre browser, não abre portas, não toca no jogo.
- corre com `bun tools/calc-jogo.mjs` (testado em bun 1.4.2); também corre em Node 24.
- fontes: `docs/game-src/motor.js` (3792 linhas, sha256 `2418f4a2a3a9736a…`),
  `docs/game-src/itens.js` (108 itens, sha256 `902757451ffd5157…`),
  `docs/game-src/balanco.js` (11 faixas), `docs/game-src/dados.js`.
- medições: `docs/snapshots/{player,status,bag,bosses,potions,katarina,farm}.json`.
- aleatoriedade: semente fixa (`--seed`, omissão 20261014) para o relatório ser reprodutível;
  `--expr` sem semente usa o `Math.random` real.
- resultado actual: **427 declarações extraídas, 0 falhas, 5 divergências medidas e explicadas**,
  **15/15 auto-verificações**, **9/9 provas de leitura**.
