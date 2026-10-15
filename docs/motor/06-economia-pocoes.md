# 06 — Economia, poções e progressão

> **Fonte única deste documento:** `docs/game-src/motor.js` (3.791 linhas), **lido por inteiro** em
> 2026-10-14. Todos os números têm `motor.js:linha`. O que não consegui verificar no motor está marcado
> **NÃO VERIFICADO**. O que é decisão do dono e não está no código está marcado **PRECISA DE REGRA DO DONO**.
> **Nada aqui foi copiado de outro documento nem de memória.**
>
> Este é o bloco **economia, poções e progressão** da base que vai sustentar a função de decisão
> `(campeão, nível, inventário, região) → (build, barra, poções, resultado esperado)`.
> Quem ler isto tem de conseguir **recalcular** ouro, XP, custo de poção, custo de refino/montagem,
> recompensa de tarefa e progressão **sem voltar a ler o motor**.
>
> Convenção: `CURVA`, `ajuste`, `infoItem`, `atributos` são funções do motor; `f(x)` é fórmula.
> As tabelas marcadas **DERIVADO** foram calculadas por mim a partir das fórmulas do motor (método
> indicado em cada uma); as restantes são valores literais do motor.

---

## 0. Mapa rápido: onde está cada mecânica no motor

| Mecânica | Linhas |
|---|---|
| Poções (tabela, cura, preço, nível) | 260–267 |
| Exaustão das poções / PvP | 41, 43 |
| Escolha e uso da poção | 1292–1323 |
| Cura (habilidades, roubo de vida) | 1284–1290 |
| Curva de XP/ouro por nível | 272–279 |
| XP para subir de nível | 419–430 |
| Ouro e XP por abate | 1066–1075, 1751–1794 |
| Espólios (partes de monstro) | 300–350 |
| Lojista (vender/comprar) | 2919–2956 |
| Valor de venda / preço de refino | 257–258 |
| Qualidade dos itens | 169–205 |
| Refino (Ornn) | 54–102, 134–136, 3127–3233 |
| Montagem (Ornn) | 3127–3197 |
| Gemas | 103–133 |
| Nível, pontos de habilidade | 27, 483, 899–915, 2795–2844 |
| Atributos (pontos, modelos) | 432–544, 2846–2865 |
| Mochila | 34–39, 339–350 |
| Cofre da Tesoureira | 2958–3040 |
| Tarefas (Capitão) | 3235–3473 |
| Diárias e prémio de login | 3347–3423, 3363–3388 |
| Conquistas (bónus permanentes) | 3475–3513 |
| Mascotes | 3515–3571 |
| Loja (diamantes), VIP | 139–156, 3654–3713 |
| Montaria | 3621–3652 |
| Morte: perda de XP e de itens | 2737–2786 |

---

## 1. Poções

### 1.1 A tabela (valores literais, `motor.js:261–267`)

| chave | nome | tipo | cura | preço (ouro) | nível mínimo |
|---|---|---|---|---|---|
| `vida` | Poção de Vida | vida | 300 | 40 | 1 |
| `vidaF` | Poção de Vida Forte | vida | 900 | 110 | 15 |
| `vidaS` | Poção de Vida Suprema | vida | 2.200 | 260 | 30 |
| `mana` | Poção de Mana | mana | 100 | 30 | 1 |
| `manaF` | Poção de Mana Forte | mana | 280 | 80 | 15 |

- Não há poção de mana suprema: `POCOES` só tem estas cinco (`motor.js:261–267`).
- O estado inicial traz **10 de vida, 5 de mana** e **150 de ouro** (`motor.js:1006, 1011`).

### 1.2 Exaustão (o relógio da poção)

- `EXAUSTAO = 1` segundo: intervalo mínimo entre poções **em PvE** (`motor.js:41`).
- O relógio é **um só** para os dois tipos: `d.timers.pocao` é escrito em `usarPocao` para qualquer
  poção (`motor.js:1304`) e é ele que bloqueia o uso seguinte (`motor.js:1301`). Ou seja:
  **usar uma poção de mana gasta a mesma janela de 1 s da poção de vida.**
- Em luta contra jogador: `POCAO_PVP = { cura: 0.3, exaustao: 6 }` — a poção **cura 30%** do valor e
  só pode ser usada **a cada 6 s** (`motor.js:43, 1302–1305`).
- O tipo de luta é `c.arena?.combatePvp > 0` (`motor.js:1302`), não o local.

### 1.3 Fórmulas do uso da poção (`usarPocao`, `motor.js:1299–1309`)

```
podeUsar = POCOES[chave] existe
        E estado.pocoes[chave] > 0
        E d.timers.pocao <= 0            (não está em exaustão)
        E d.morto <= 0                   (não está morto)
        E estado.nivel >= p.nivel        (nível mínimo da poção)

se p.tipo == 'vida':
    estado.vida = min(vidaMax, estado.vida + p.cura × (pvp ? 0.3 : 1))
senão (mana):
    estado.mana = min(manaMax, estado.mana + p.cura)      // SEM redução de PvP

d.timers.pocao = pvp ? 6 : 1
estado.pocoes[chave] -= 1        // gasta a poção mesmo que o excedente se perca
```

Consequências que importam à decisão:

- A cura é **cortada no teto de vida** (`motor.js:1305`): o que passa do máximo perde-se, mas a poção é
  gasta à mesma. Usar uma Suprema com 100 de vida em falta desperdiça 2.100 de cura.
- **A poção de mana não é reduzida no PvP** (`motor.js:1306`); só a de vida é.
- As curas de **habilidades, roubo de vida e Sede de Sangue** passam por `curar()` e têm outra regra:
  ×1,25 com o item 3065 (Espírito Visage) e **×0,65 em PvP** (`CURA_PVP`, `motor.js:1284–1290`).
  São dois redutores diferentes: poção = 0,3 (`motor.js:43`); cura de habilidade = 0,65 (`motor.js:1284`).
- `curar()` só emite evento se curar **mais de 1** ponto (`motor.js:1289`).

### 1.4 Escolha automática da poção (`escolherPocao`, `motor.js:1293–1298`)

```
disponíveis = POCOES onde (tipo == tipo) E (estado.pocoes[k] > 0) E (nivel >= p.nivel)
ordenadas por cura DECRESCENTE
escolhe a PRIMEIRA cuja cura <= falta × 1.2      // falta = vidaMax − vida (ou manaMax − mana)
se nenhuma serve: escolhe a ÚLTIMA da lista (a MENOR)
```

- Ou seja: **não é "a mais barata por ponto de vida", é "a mais pequena que não desperdiça mais de 20%"**.
  Com 300 de vida em falta, ao nível 30, escolhe a `vida` de 40 de ouro (300 de cura) em vez da Suprema.
  Isto **piora a eficiência de ouro** (ver 1.5) sempre que o campeão apanha pouco dano.
- `temPocao(estado, tipo)` responde se existe **alguma** poção utilizável daquele tipo
  (`motor.js:1310`).

### 1.5 Eficiência de ouro (DERIVADO de `motor.js:261–267`)

| poção | cura | preço | **ouro por ponto de vida/mana** | uso máx. por segundo (PvE) | cura máx. por segundo | ouro gasto por segundo (PvE) |
|---|---|---|---|---|---|---|
| vida | 300 | 40 | 0,13333 | 1/s | 300 | 40 |
| vidaF | 900 | 110 | 0,12222 | 1/s | 900 | 110 |
| vidaS | 2.200 | 260 | 0,11818 | 1/s | 2.200 | 260 |
| mana | 100 | 30 | 0,30000 | 1/s | 100 | 30 |
| manaF | 280 | 80 | 0,28571 | 1/s | 280 | 80 |

- A Suprema é a **mais eficiente por ponto curado** (0,11818) e a Forte a segunda (0,12222); a pequena é
  **13% mais caro por ponto** que a Suprema.
- Em PvP: a Suprema cura 660 por uso (2.200 × 0,3) a cada 6 s = **110 de cura por segundo**, ao custo de
  260 de ouro por uso (`motor.js:43, 1304–1305`).
- Exemplo de conversão para ouro de caça (DERIVADO das tabelas de 2.5): ao nível 30 (Fosso do Dragão,
  ~120,6 de ouro por abate em média) **uma Suprema custa ~2,2 abates**; a Forte ~0,9 abate.

### 1.6 Quem usa poção automaticamente

- `usarPocoesAuto` (`motor.js:1311–1323`) só corre se **VIP** (`ehVip`) **ou** se o chamador passar
  `c.pocaoAuto` (`motor.js:1312`); `rotinaAtiva = ehVip` (`motor.js:156`).
- Limiares do automático (estado inicial, `motor.js:1013`):
  `{ vida: true, limiarVida: 0.5, mana: true, limiarMana: 0.3, voltar: true }`.
  Usa poção de vida quando `vida < 50% da máxima`; de mana quando `mana < 30% da máxima`
  (`motor.js:1315, 1319`).
- A poção de mana automática **não corre** para quem usa Fluxo (Yasuo) nem para quem não tem mana
  (Katarina, Zac) — `kit(estado).fluxo` / `kit(estado).semMana` (`motor.js:1319`).
- Se a de vida for usada, a função **retorna** e não tenta a de mana naquele instante (`motor.js:1317`).

### 1.7 A rotina VIP de voltar à base

- Com VIP e `estado.rotina.pocoes` ligado: **sem poção de vida utilizável** → `voltarBase`
  (`motor.js:1407–1409`). Com `estado.rotina.mochila` ligado e mochila cheia → `voltarBase`
  (`motor.js:1411–1413`). A rotina padrão é `{ mochila: true, pocoes: true }` (`motor.js:3718`).
- `estado.rotina` **não** é criado por `novoEstado` (`motor.js:998–1022`) nem por `migrar`
  (`motor.js:1025–1050`); é criado pelo jogo (`jogo.js:94`). O motor lê-o diretamente em
  `motor.js:1407, 1411` — se o chamador não o criar, isso rebenta. (Nota de integração, não é
  política.)
- `melhorPocao(estado, tipo)` devolve a **chave** da melhor poção que o nível permite, por cura
  (`motor.js:3720`).

### 1.8 Comprar poções (`comprarPocao`, `motor.js:2951–2956`)

```
n = min(qtd, floor(estado.ouro / p.preco))
estado.ouro -= n × p.preco
estado.pocoes[chave] += n
```

- Só funciona em `atendeAqui` = Fonte **ou** cidade de Runeterra (`motor.js:2920–2924, 2953`).
- **As poções são a ÚNICA coisa que se compra com ouro no motor.** Não existe loja de itens por ouro:
  itens só entram por saque, tarefa, diária, presente ou montagem no Ornn (ver §2, §4, §7, §8).

---

## 2. Ouro e XP por abate

### 2.1 A curva base (`CURVA`, `motor.js:273–279`)

```
ajuste(n)      = BALANCO.find(f => n >= f.de && n <= f.ate) || último   (motor.js:272)
CURVA.hp(n)        = (150 + 100·n + 1,0·n²) × ajuste(n).vida
CURVA.ad(n)        = (9 + 4,8·n + 0,13·n²) × ajuste(n).dano
CURVA.armadura(n)  = 5 + 1,5·n                    // NÃO tem ajuste
CURVA.xp(n)        = (30 + 7·n) × ajuste(n).xp
CURVA.ouro(n)      = (8 + 3,5·n) × ajuste(n).ouro
```

A tabela `BALANCO` é gerada da planilha `balanco.csv` (`balanco.js:1–2`) e **tem de ser lida**, não
copiada para código (`AGENTS.md`, regra nº 3). Valores atuais (`balanco.js:2`):

| níveis | xpUpar | xp | ouro | vida | dano | drop |
|---|---|---|---|---|---|---|
| 1–2 | 0,04 | 1 | 1,5 | 0,70 | 0,65 | 3 |
| 3–4 | 0,05 | 1 | 1,45 | 0,72 | 0,68 | 2,8 |
| 5–6 | 0,08 | 1 | 1,4 | 0,75 | 0,72 | 2,6 |
| 7–8 | 0,15 | 1 | 1,35 | 0,79 | 0,76 | 2,4 |
| 9–10 | 0,30 | 1 | 1,3 | 0,83 | 0,80 | 2,2 |
| 11–12 | 0,50 | 1 | 1,25 | 0,86 | 0,84 | 2,0 |
| 13–14 | 0,60 | 1 | 1,2 | 0,89 | 0,88 | 1,8 |
| 15–16 | 0,70 | 1 | 1,15 | 0,92 | 0,91 | 1,6 |
| 17–18 | 0,80 | 1 | 1,1 | 0,95 | 0,94 | 1,4 |
| 19–20 | 0,90 | 1 | 1,05 | 0,98 | 0,97 | 1,2 |
| 21–60 | 1,00 | 1 | 1,0 | 1,00 | 1,00 | 1 |

### 2.2 O monstro (`criarMonstro`, `motor.js:1066–1075`)

```
hpMax = hp = CURVA.hp(n) × MONSTROS[nome].hp
ad         = CURVA.ad(n) × MONSTROS[nome].ad
armadura   = CURVA.armadura(n) × MONSTROS[nome].armadura
xp         = CURVA.xp(n) × MONSTROS[nome].xp                     // sem sorteio
ouro       = CURVA.ouro(n) × MONSTROS[nome].ouro × (0,5 + rand×0,5)   // média = 0,75×
as         = MONSTROS[nome].as
```

- **O ouro do abate é sorteado entre 50% e 100% do nominal** (`motor.js:1071`); em média 75%.
  O XP **não** tem esse sorteio.
- `MONSTROS` (`motor.js:280–298`) — multiplicadores por espécie:

| espécie | hp | ad | as | armadura | xp | ouro | notas |
|---|---|---|---|---|---|---|---|
| Tropa Corpo a Corpo | 1 | 0,9 | 0,8 | 0,6 | 1 | 1 | |
| Tropa Mago | 0,7 | 1,15 | 0,65 | 0,3 | 0,9 | 0,9 | mágico, distância 3 |
| Tropa de Cerco | 1,8 | 1,5 | 0,5 | 1,2 | 1,6 | 1,8 | distância 4 |
| Lobo Gigante | 1,1 | 1,1 | 0,8 | 0,8 | 1,1 | 1 | |
| Krug Anciã | 1,5 | 0,8 | 0,6 | 1,5 | 1,2 | 1,2 | |
| Sentinela Azul | 2,2 | 1,05 | 0,55 | 1,2 | 2 | 2,2 | mágico |
| Brambleback Vermelho | 2,2 | 1,5 | 0,55 | 1,2 | 2 | 2,2 | |
| Arraia do Rio | 1,5 | 0,8 | 0,5 | 1,6 | 1,2 | 1,1 | |
| Larva do Vazio | 1,1 | 1,05 | 0,8 | 1 | 1,1 | 1 | mágico |
| Cria de Vilemaw | 0,6 | 0,8 | 1 | 0,7 | 0,3 | 0,2 | nasce dos ovos da Vilemaw |
| Dragão Ancião (filhote) | 1,6 | 1,3 | 0,6 | 1,2 | 1,5 | 1,4 | |
| Criatura do Vazio | 1,3 | 1,3 | 0,7 | 1 | 1,4 | 1,3 | mágico |
| Arauto do Vale | 10 | 2,5 | 0,6 | 1,5 | 12 | 12 | chefe |
| Dragão Infernal | 12 | 3 | 0,55 | 1,6 | 14 | 14 | chefe, mágico |
| Barão Nashor | 16 | 3,2 | 0,5 | 1,8 | 20 | 20 | chefe, mágico |

- **RM dos monstros = 60% da armadura** (`RM_MONSTRO = 0.6`, `motor.js:1179`).
- Diferença de nível (`NIVEL_DIF`, `motor.js:1184–1187`): um monstro mais de **4 níveis acima** do
  jogador bate **+15% por nível a mais** (teto 3×) e leva **−7% por nível a mais** (piso 0,25×).

### 2.3 Modificadores de spawn que mexem no ouro/XP

- **Grupo**: `qtd = 2 + floor(rand×3)` → 2 a 4 monstros por grupo (`motor.js:1124`). O nível de cada
  monstro, no Rift, é `max(n0, min(n1, nivelJogador − 2 + floor(rand×4)))` — ou seja
  **do nível do jogador −2 até +1**, dentro da faixa da zona (`motor.js:1118–1119`). Chefe: aparece com
  `local.chefe[1]` de chance por grupo e no nível `max(n0+2, min(n1+2, nivelJogador+4))`
  (`motor.js:1121`); as chances por zona estão em `motor.js:368, 370, 372` (0,015 = 1,5% no Rio, no
  Dragão e no Barão).
- **Noturno** (`NOTURNO`, `motor.js:1096–1101`): 35% de chance por monstro **de noite**; ×1,8 XP,
  ×1,5 ouro, ×1,4 vida, ×1,25 dano. O dia/noite vem do relógio do mundo (`motor.js:1083–1095`).
- **Furioso** (`FURIOSO`, `motor.js:1106–1111`): 5% de chance por grupo (`motor.js:1124`); ×5 XP,
  ×5 ouro, ×4 vida, ×1,5 dano, ×1,15 velocidade; o saque é sorteado **3×** e as runas/espólios **2×**
  (`motor.js:1113, 1770, 1776, 1781`). Enquanto vive dá aura aos outros do grupo (+25% dano, +20%
  velocidade, `motor.js:1729–1730`). **Nunca é noturno ao mesmo tempo** (`motor.js:1127–1128`).
- **Respawn**: 1,5 s depois de limpar o grupo (`motor.js:1625`); viajar para outra zona põe 1,2 s
  (`motor.js:3046`).

### 2.4 A conta final do abate (`processarAbates`, `motor.js:1751–1794`)

```
fs   = fatorSaque(nivelJogador, nivelMonstro) = fatorXp                 (motor.js:421–424)
       = (nivelJogador − nivelMonstro > 5) ? max(0,1, 1 − 0,1×(dif−5)) : 1

OURO = i.ouro × a.ouroMult × fs                                          (motor.js:1758)
       a.ouroMult = 1 + bónusConquistas.ouro + bónusMascote.ouro         (motor.js:526, 3497–3501, 3536–3539)

XP   = i.xp × fatorXp × (VIP ? 1,2 : 1) × bonus × bonusXp
             × bonusTwitch × bonusEvento                                (motor.js:1765)
       bonus      = 1 no Rift; 1,3 em Runeterra (ARENA.bonus, motor.js:412)
       bonusXp    = bónus de grupo de Runeterra (motor.js:143, 1750–1751)
       VIP.xp     = 1,2                                                  (motor.js:145)
       bonusTwitch ∈ [1, 1,5] (motor.js:1741–1743)
       bonusEventoXp ∈ [1, 3] (motor.js:1745–1747)
```

- **VIP não aumenta ouro** — só XP (×1,2), chance de saque (×1,2) e refino (×1,2) (`motor.js:145, 1764–1765`).
- **Grupo**: até 4 jogadores; cada outro membro vivo a até 15 tiles dá **+15% de XP**
  (`GRUPO`, `motor.js:143`).
- O XP do **mascote** é 10% do XP do abate (`motor.js:1767`).
- Quando o monstro é **invocado** (as larvas do Barão), não dá item, espólio nem gema
  (`motor.js:1770, 1776, 1781`) — mas dá ouro e XP.

### 2.5 Tabela por zona (DERIVADO das fórmulas de 2.1–2.4)

`porAbateZona(l)` (`motor.js:3270–3275`) usa o **nível do meio** da zona (`nm`) e a mistura de
monstros da zona; é esta a conta que as tarefas e as diárias usam.

| zona | faixa ideal | nm | tier | monstros | xp/abate | ouro/abate (nominal) | ouro/abate (média real, ×0,75) | abates/min | ouro/min (média real) |
|---|---|---|---|---|---|---|---|---|---|
| rota-inf | 1–10 | 3,5 | 0 | Tropa CaC 3, Mago 2 | 52,32 | 28,19 | 21,14 | 27,0 | 571 |
| rota-sup | 5–15 | 9 | 1 | CaC 3, Mago 2, Cerco 1 | 99,20 | 56,48 | 42,36 | 19,5 | 826 |
| lobos | 10–20 | 14 | 2 | Lobo 1 | 140,80 | 68,40 | 51,30 | 16,5 | 846 |
| azul | 15–25 | 19 | 3 | Krug 2, Sentinela 1 | 239,07 | 119,95 | 89,96 | 9,75 | 877 |
| vermelho | 20–30 | 24 | 4 | Brambleback 1, Lobo 1, Krug 1 | 283,80 | 134,93 | 101,20 | 10,5 | 1.063 |
| rio | 25–35 | 29 | 5 | Arraia 2, Larva 2 | 267,95 | 114,97 | 86,23 | 11,25 | 970 |
| dragao | 30–40 | 34 | 6 | Filhote 2, Larva 1 | 366,27 | 160,87 | 120,65 | 10,5 | 1.267 |
| barao | 40–50 | 44 | 7 | Criatura 2, Filhote 1 | 484,47 | 216,00 | 162,00 | 11,25 | 1.823 |

- `ABATES_MIN_ZONA = { 'rota-inf': 18, 'rota-sup': 13, lobos: 11, azul: 6.5, vermelho: 7, rio: 7.5,
  dragao: 7, barao: 7.5 }` (`motor.js:3266`) e `RITMO_REAL = 1.5` (`motor.js:3253`):
  `ritmoZona = ABATES_MIN_ZONA × 1,5` (`motor.js:3254`).
- Os espólios rendem, na média, **~30% de ouro a mais por abate** (comentário do motor,
  `motor.js:302–303`) — não somado na tabela acima.
- `zonaIdeal(n)` = a zona de maior `faixa[0]` que o nível já alcançou, ignorando as zonas de arena
  (`motor.js:3267`). Ex.: nível 30 → `dragao`; nível 50 → `barao`.

### 2.6 XP para subir de nível (`motor.js:419–430`)

```
RITMO_XP(n)   = 43000 + 4345·(n−1) + 17,9·(n−1)²                       (motor.js:427)
tres(v)       = arredonda v a 3 algarismos significativos             (motor.js:428)
xpParaNivel(n)= tres( RITMO_XP(n) × 0,4433 × 1,1715^(n−1) × ajuste(n).xpUpar )   (motor.js:429)
```

**Tabela completa (DERIVADO da fórmula; são os XP necessários para passar DO nível n para n+1):**

| n | XP | n | XP | n | XP | n | XP | n | XP |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 762 | 11 | 95.200 | 21 | 1.440.000 | 31 | 9.690.000 | 41 | 61.100.000 |
| 2 | 984 | 12 | 118.000 | 22 | 1.750.000 | 32 | 11.700.000 | 42 | 73.300.000 |
| 3 | 1.570 | 13 | 174.000 | 23 | 2.120.000 | 33 | 14.100.000 | 43 | 87.900.000 |
| 4 | 2.000 | 14 | 213.000 | 24 | 2.570.000 | 34 | 16.900.000 | 44 | 105.000.000 |
| 5 | 4.050 | 15 | 305.000 | 25 | 3.120.000 | 35 | 20.400.000 | 45 | 126.000.000 |
| 6 | 5.100 | 16 | 374.000 | 26 | 3.780.000 | 36 | 24.500.000 | 46 | 151.000.000 |
| 7 | 12.000 | 17 | 523.000 | 27 | 4.570.000 | 37 | 29.400.000 | 47 | 181.000.000 |
| 8 | 15.000 | 18 | 638.000 | 28 | 5.520.000 | 38 | 35.400.000 | 48 | 216.000.000 |
| 9 | 37.200 | 19 | 875.000 | 29 | 6.660.000 | 39 | 42.500.000 | 49 | 259.000.000 |
| 10 | 46.200 | 20 | 1.070.000 | 30 | 8.040.000 | 40 | 51.000.000 | 50 | 309.000.000 |

- **XP total do nível 1 ao 50 = 1.559.970.066** (soma dos valores de 1 a 49; o 50 não se sobe,
  `NIVEL_MAX = 50`, `motor.js:27`).
- O nível 50 usa o valor 309.000.000 em `migrar` e em `perdaPorMorte` (`motor.js:429–430, 1040`).
- **Perda por morte** = `round(xpParaNivel(nivel) × 0,1)` (`motor.js:430`) — 10% do XP **do nível
  atual**, limitada ao XP que se tem (`penalidadeMorte`, `motor.js:2763–2768`). Na Arena não custa nada
  (`motor.js:2782`).

---

## 3. Espólios (partes de monstro — só para vender)

- `valorEsp(nivelRef, mult) = round(0,6 × CURVA.ouro(nivelRef) × mult)` (`motor.js:304`).
- Cada pilha ocupa **1 espaço** da mochila, até **1.000 por pilha** (`PILHA = 1000`, `motor.js:341`;
  `espacosEspolios`, `motor.js:345`). Só cabe se a pilha não estiver cheia ou se houver espaço livre
  (`cabeEspolio`, `motor.js:349`).
- **Valores (DERIVADO de `motor.js:304–325`):**

| espólio | valor | espólio | valor |
|---|---|---|---|
| Escudo Quebrado | 21 | Escama de Dragão | 76 |
| Pó Arcano | 21 | Garra de Dragão | 229 |
| Engrenagem de Cerco | 31 | Olho do Vazio | 97 |
| Pele de Lobo | 41 | Chifre do Arauto | 1.958 |
| Presa de Lobo | 123 | Coração de Dragão | 2.220 |
| Pedra de Krug | 47 | Presa do Barão | 2.745 |
| Cristal Azul | 61 | Seda de Vilemaw | 397 |
| Espinho de Brambleback | 72 | Presa de Vilemaw | 3.294 |
| Escama de Arraia | 66 | | |
| Quitina do Vazio | 66 | | |

- Chances de saque por monstro (`ESPOLIO_MONSTRO`, `motor.js:327–333`): comuns 30%–35%; presas/garra
  6%; **chefes 100%** (Arauto → Chifre; Dragão → Coração; Barão → Presa). O monstro noturno sorteia
  duas vezes e o furioso `FURIOSO.extras = 2` vezes (`motor.js:1113, 1776`).
- `valorEspolios(estado)` soma tudo (`motor.js:350`); `venderEspolio` (parcial, `motor.js:2937–2943`)
  e `venderEspolios` (tudo, `motor.js:2945–2950`) vendem **ao preço da tabela, sem qualidade e sem
  refino** — espólio não tem qualidade nem refino.

---

## 4. Lojista: vender e comprar

- Só atende em `atendeAqui(estado)` = `naBase` (Fonte) **ou** `naCidade` (cidade de Runeterra)
  (`motor.js:2919–2924`). A cidade atual é posta pelo motor de Runeterra (`definirCidade`,
  `motor.js:2921–2923`).
- **Vender item** (`venderItem`, `motor.js:2930–2935`): recusa itens ainda **pendentes** de qualidade
  (`pendente(id)` = sufixo `~?`, `motor.js:164, 2932`) e paga:

```
valorVenda(x) = floor( ITENS[baseId(x)].preco × 0,5 × (1 + 0,5×refinoDe(x)) × QUALIDADES[q].venda )
                                                                        (motor.js:257)
```

- **Vender espólio**: ver §3.
- **Comprar poção**: ver §1.8.
- Não há no motor nenhuma compra de item com ouro, nem revenda de item equipado (só da mochila:
  `estado.mochila[k]`, `motor.js:2931`).

### 4.1 Qualidade do item (`QUALIDADES`, `motor.js:173–179`)

| qualidade | peso (chance %) | mult. de atributos | mult. de venda | cor |
|---|---|---|---|---|
| C | 49,9495 | 0,9 | 0,8 | #a8a8a8 |
| B | 35 | 1,0 | 1,0 | #e8e4d8 |
| A | 15 | 1,15 | 1,5 | #5adc6a |
| S | 0,05 | 1,35 | 3 | #ffc840 |
| SS | 0,0005 | 1,7 | 8 | #ff5a8a |

- Os pesos somam 100 e são usados por `sortearQualidade` (`motor.js:188–192`); sem bónus são estes
  (`chancesQualidade(0)`, `motor.js:182–187`).
- Na montagem, peças de qualidade alta melhoram as chances: com bónus `b`, A ×(1+0,5b), S ×(1+0,6b),
  SS ×(1+0,8b), renormalizado (`motor.js:182–187`). O bónus é a média das peças
  (C 0, B 1, A 2, S 3, SS 4) acima de B (`bonusMontagem`, `motor.js:194`).
- Item que cai entra na mochila como **`~?`** (pendente) e só o servidor sorteia a qualidade
  (`motor.js:1773, 206–244`; `AVALIADOS.ms = 10 min`, `motor.js:205`).
- **A qualidade multiplica `ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr`**
  (`infoItem`, `motor.js:251–256`) — e **não** o `penMag` nem os campos `*Pct`/esquiva, que são lidos
  crus em `atributos` (`motor.js:501, 509`). É a mesma armadilha do relatório `AGENTS.md` (prova nº 2).

#### 4.1.1 Os itens com bónus percentual NÃO escalam (achado)

`infoItem` (`motor.js:251–256`) devolve `{ ...i, chave, ref, qual, nomeRef, ad, ap, mana, vida,
armadura, rm, va, rv, critico, regen, cdr }`: o `...i` copia os campos percentuais **crus** e nenhuma
linha seguinte os substitui. Em `atributos`, o ciclo `for (const p in pct) pct[p] += i[p] || 0`
(`motor.js:509`) soma-os **sem** qualidade nem refino (o teto do `penMagica` é 0,6, `motor.js:529`).
São **17 itens** hoje (lidos de `itens.js`), e todos perdem o efeito de qualidade/refino só nesse campo:

| item | id | raridade | campo | valor fixo |
|---|---|---|---|---|
| Sapatos do Feiticeiro | 3020 | épico | penMag | 8% |
| Marcha Célere | 3170 | lendário | esquiva | 5% |
| Esmagadores Acorrentados | 3173 | lendário | rmPct | 15% |
| Mobilização Blindada | 3174 | lendário | armPct | 15% |
| Égide de Fogo Solar | 3068 | lendário | armPct | 10% |
| Presságio de Randuin | 3143 | lendário | armPct | 10% |
| Explocinturão Hextec | 3152 | lendário | apPct | 5% |
| Caminho Imortal | 3168 | lendário | vidaPct | 5% |
| Sapatos Enfeitiçados | 3175 | lendário | penMag | 15% |
| Medalhão dos Solari de Ferro | 3190 | lendário | vidaPct | 6% |
| Máscara Abissal | 8020 | lendário | vidaPct | 8% |
| Grevas Bélicas | 3172 | lendário | adPct | 6% |
| Mandíbula de Malmortius | 3156 | lendário | adPct | 5% |
| Criafendas | 4633 | lendário | apPct | 5% |
| Arco-escudo Imortal | 6673 | lendário | vidaPct | 6% |
| Coroa do Rei Demoníaco | 663056 | lendário | adPct | 4% |
| Coroa da Rainha Despedaçada | 664644 | lendário | apPct | 6% |

- Consequência para a decisão: um destes itens de qualidade **SS e +5** vale exactamente o mesmo (nesse
  campo) que um C +0 — mas o `valorVenda` dele escala na mesma (usa `preco × qualidade`).

### 4.2 Exemplos de valor de venda (DERIVADO de `motor.js:257`)

Item de preço base 400 (um básico típico), por refino e qualidade:

| refino | C | B | A | S | SS |
|---|---|---|---|---|---|
| +0 | 160 | 200 | 300 | 600 | 1.600 |
| +1 | 240 | 300 | 450 | 900 | 2.400 |
| +2 | 320 | 400 | 600 | 1.200 | 3.200 |
| +3 | 400 | 500 | 750 | 1.500 | 4.000 |
| +4 | 480 | 600 | 900 | 1.800 | 4.800 |
| +5 | 560 | 700 | 1.050 | 2.100 | 5.600 |

- O `preco` do item é o do `itens.js` (`itens.js:1–2`); a qualidade multiplica a venda por
  `QUALIDADES[q].venda` (`motor.js:173–179`).

---

## 5. Mercado entre jogadores

- No `motor.js` **só existe isto**: um lote de gemas é codificado como o texto
  `"gema:<id>:<quantidade>"` (`ofertaGema`, `motor.js:121`) e o nome mostrado é
  `"<q>× <nome da runa>"` (`nomeOferta`, `motor.js:122`).
- O mercado em si (anúncio, preço, moeda, taxa, reserva) **não está no motor**. Vi referências no jogo
  (`jogo.js:2478, 2519, 2786`) a ofertas com preço em **ouro, orbs ou diamante** — **NÃO VERIFICADO**
  (não li esses blocos por inteiro nesta tarefa). Quem confere e guarda é o servidor.
- As gemas **não têm valor no Lojista** (não estão na mochila nem em `ESPOLIOS`): só se vendem no
  mercado (`motor.js:106, 120–122`).
- **PRECISA DE REGRA DO DONO** (ou do servidor): taxa do mercado, limite de ofertas, preço mínimo,
  e o que fazer quando não há lugar/oferta (exemplo dado pelo próprio `AGENTS.md`).

---

## 6. Gemas

- `GEMAS` (`motor.js:107–114`): ficam numa bolsa à parte (`estado.gemas`, não ocupam mochila,
  `motor.js:106, 1010, 1782–1783`).

| gema | mult. da chance | protege | forja | montagem | chance por monstro comum | chance de chefe |
|---|---|---|---|---|---|---|
| Runa da Sorte | ×1,25 | não | sim | sim | 0,0053 | 0,3 |
| Runa Arcana | ×2 | não | sim | sim | 0,00063 | 0,08 |
| Runa de Proteção | — | sim | sim | não | 0,00063 | 0,08 |

- Chance por monstro comum: `GEMAS[id].chance × (1 + tier×0,1) × mult` (`chancesGema`,
  `motor.js:123–126`), com teto em 1. O tier da zona é `local.tier` (`motor.js:357–372`).
- Chefe: usa `GEMAS[id].chefe` direto (`sortearGemas`, `motor.js:127–133`).
- Uso: gasta 1 por tentativa de forja/montagem; a de Sorte/Arcana multiplica a chance; a de Proteção
  impede a regressão do refino (`podeUsarGema`, `motor.js:118`; `gastarGema`, `motor.js:119`;
  `forjar`, `motor.js:3208–3217`; `montarItem`, `motor.js:3184–3186`).
- O noturno sorteia duas vezes e o furioso mais 2 vezes (`motor.js:1780–1781`).

---

## 7. Refino no Ornn (forja)

### 7.1 Tetos e bónus

- `REFINO_MAX = 5` (`motor.js:54`).
- `BONUS_REFINO = 0,12`: **+12% em todos os bónus do item por nível de refino** (`motor.js:55`).
  O multiplicador aplicado por `infoItem` é `(1 + 0,12×ref) × QUALIDADES[q].mult` (`motor.js:252`).
  Um item +5 de qualidade SS fica com **×(1+0,6)×1,7 = 2,72** nos campos escalados.

### 7.2 Custo de cada tentativa (`precoRefino`, `motor.js:258`)

```
precoRefino(x) = round( preco(baseId(x)) × (0,5 + 0,5×ref) × (ref >= 2 ? 2 : 1) )
```

| ref atual | fator `(0,5+0,5·ref)` | dobra? | custo para item de preço 400 | custo para item de preço 3.000 |
|---|---|---|---|---|
| 0 (tentar +1) | 0,5 | não | 200 | 1.500 |
| 1 (tentar +2) | 1,0 | não | 400 | 3.000 |
| 2 (tentar +3) | 1,5 | **×2** | 1.200 | 9.000 |
| 3 (tentar +4) | 2,0 | **×2** | 1.600 | 12.000 |
| 4 (tentar +5) | 2,5 | **×2** | 2.000 | 15.000 |

- `PRECO_REFINO_ALTO = 2` (`motor.js:61`): do +3 em diante **cada tentativa custa o dobro**
  (comentário `motor.js:58–59`).
- **A qualidade do item não entra no custo do refino** (só o `preco` da base). Refinar um S custa o
  mesmo que refinar um C.
- `forjar` (`motor.js:3200–3221`) cobra o preço **antes** do sorteio e só falha se não houver ouro
  (`motor.js:3206`). O ouro é **gasto mesmo quando falha**.

### 7.3 Chance e risco

```
chanceRefino(e, ref)   = VIP ? min(0,5, CHANCE_REFINO[ref] × 1,2) : CHANCE_REFINO[ref]   (motor.js:153)
CHANCE_REFINO = [0.30, 0.12, 0.02, 0.008, 0.003]                                        (motor.js:60)
REGRESSAO_REFINO = [0, 0, 0.04, 0.015, 0.006]                                           (motor.js:62)

chanceForjaAgora(e, ref, x) = comPersistencia( chanceRefino(e, ref),
                                               falhasForja(e, ref+1, x),
                                               PERSISTENCIA.forja[ref+1] )              (motor.js:136)
```

| tentativa | chance base | VIP (+20%, teto 0,5) | risco de regressão (se falhar) |
|---|---|---|---|
| +1 | 30% | 36% | 0% |
| +2 | 12% | 14,4% | 0% |
| +3 | 2% | 2,4% | 4% |
| +4 | 0,8% | 0,96% | 1,5% |
| +5 | 0,3% | 0,36% | 0,6% |

- Na falha com regressão o item **perde 1 nível** (`motor.js:3215–3217`); a Runa de Proteção impede
  (`motor.js:3216`).
- **VIP dá +20% na chance de forja E na de montagem** (`VIP.refino = 1.2`, `motor.js:145, 153, 3161`).

### 7.4 Persistência (proteção contra azar)

```
bonusFalhas(f) = min(0,5; 0,01×f)                                        (motor.js:72–74)
comPersistencia(base, f, regra):
    b = min(1, base × (1 + bonusFalhas(f)))
    se !regra ou !regra.subir ou f < regra.subir:  devolve b
    devolve min(1, b + (1−b)×(f − regra.subir + 1)/(regra.max − regra.subir))    (motor.js:75–80)

PERSISTENCIA.forja = { 1:{}, 2:{}, 3:{subir:80, max:120}, 4:{subir:200, max:300},
                       5:{subir:530, max:800} }                          (motor.js:68–71)
PERSISTENCIA.montar = { epico:{subir:108, max:150}, lendario:{subir:1125, max:1500} }
```

- As falhas contam-se por **`"<nível alvo>:<raridade do item>"`** (`chaveForja`, `motor.js:83`;
  `faixaForja`, `motor.js:82`). Ou seja, as falhas de +3 num item **básico barato** ajudam a forjar +3
  num básico caro — mas **não** ajudam o +5 (contadores separados por alvo) nem um lendário.
- A chance sobe **+1% por falha até +50%** (`PERSISTENCIA_PASSO/TETO`, `motor.js:72`), e a partir de
  `subir` cresce até **garantir** em `max − 1` falhas (verificado na tabela abaixo: com 119 falhas o +3
  é 100%, com 299 o +4, com 799 o +5). O +1 e o +2 **nunca regridem** e não têm rampa
  (`REGRESSAO_REFINO[0..1] = 0`, `motor.js:62; PERSISTENCIA.forja[1..2] = {}`, `motor.js:69`).
- Ao dar certo, zera **só** o contador daquela faixa (`anotarFalha`, `motor.js:99–102, 3212`).

**Tabela de chance por falhas (DERIVADO de `comPersistencia`):**

| falhas | +1 | +2 | +3 | +4 | +5 |
|---|---|---|---|---|---|
| 0 | 30% | 12% | 2% | 0,8% | 0,3% |
| 10 | 33% | 13,2% | 2,2% | 0,88% | 0,33% |
| 50 | 45% | 18% | 3% | 1,2% | 0,45% |
| 100 | 45% | 18% | 53,93% | 1,2% | 0,45% |
| 200 | 45% | 18% | — | 2,19% | 0,45% |
| 300 | 45% | 18% | — | 100% | 0,45% |
| 530 | 45% | 18% | — | — | 0,82% |
| 600 | 45% | 18% | — | — | 26,63% |
| 700 | 45% | 18% | — | — | 63,50% |
| 799 | 45% | 18% | — | — | **100%** |

### 7.5 Custo esperado (DERIVADO por simulação de 200.000 corridas do processo de `motor.js:3200–3221`)

| objetivo | tentativas médias | ouro médio (× preço do item) | ingénuo (1/p) |
|---|---|---|---|
| +1 | 3,27 | ×1,634 | 3,33 |
| +2 | 11,07 | ×9,438 | 11,67 |
| +3 | 58,65 | ×129,97 | 61,67 |
| +4 | 200,77 | ×612,32 | 186,67 |
| +5 | 590,81 | ×2.274,92 | 520,00 |

Exemplos: um item de preço 3.000 → **+5 custa ~6,82 milhões de ouro** (2.274,92 × 3.000); um de
preço 400 → ~910 mil. A regressão a partir do +3 faz o custo real **subir acima** do ingénuo no +4/+5.

---

## 8. Montagem no Ornn (juntar componentes)

### 8.1 Receita e custo (`motor.js:3127–3136`)

```
receitaDe(id) = ITENS[id].de?.length ? { de: ITENS[id].de, custo: custoMontar(ITENS[id]) } : null
custoMontar(i) = (raridade(i) == 'lendario')
                 ? round( (i.preco × 4,8) / 50 ) × 50
                 : (i.custo || 0) × (MULT_CUSTO_MONTAR[raridade(i)] || 1)
MULT_CUSTO_MONTAR = { epico: 3, lendario: 45 }        // o 45 não é usado: lendário usa o preço
CUSTO_LENDARIO_POR_PRECO = 4,8
```

- `preco` e `custo` vêm de `docs/game-src/itens.js` (gerado do Data Dragon; `itens.js:1–2`).
- **Preços atuais (DERIVADO do ficheiro `itens.js`):** básicos de 250 a 1.300 (mediana 400); épicos de
  600 a 1.600 (mediana 1.100); lendários de 2.450 a 3.500 (mediana 3.000). Todos os épicos e lendários
  têm receita (`de`), com 1 a 3 componentes.
- **Custo de montagem (DERIVADO):** épico de 150 a 2.700 (mediana 1.200); lendário de 11.750 a 16.800
  (mediana 14.400) — os lendários são ancorados no preço (`motor.js:3132–3134`).

### 8.2 Chance e persistência

```
CHANCE_MONTAR = { epico: 0.01, lendario: 0.001 }                          (motor.js:3160)
chanceMontar(e, id)      = min(0,5, CHANCE_MONTAR[raridade] × (VIP ? 1,2 : 1))   (motor.js:3161)
chanceMontarAgora(e,id)  = comPersistencia( chanceMontar, falhasMontar(e,id),
                                            PERSISTENCIA.montar[raridade] )       (motor.js:3162)
```

- As falhas da montagem contam-se **por item (receita)** (`falhasMontar`, `motor.js:98`), não por
  raridade. Ao dar certo, o contador do item é apagado (`motor.js:3187`).
- **Tentativas médias (DERIVADO; esperança exata da cadeia `comPersistencia`):**

| raridade | chance base | tentativas médias (sem VIP) | com VIP | ingénuo (1/p) |
|---|---|---|---|---|
| épico | 1% | **60,6** | 54,5 | 100 |
| lendário | 0,1% | **554,6** | 492,7 | 1.000 |

- Para um lendário de custo mediano (14.400) isso dá **~7,99 milhões de ouro** — bate com o comentário
  do motor ("~550 tentativas e ~8 milhões de ouro", `motor.js:3157–3159`).
- As **peças só saem quando dá certo** (`motor.js:3191`); na falha perde-se o ouro e mantêm-se os
  componentes (`motor.js:3186`).
- Ao montar, a qualidade do item é sorteada com bónus pelas peças (`motor.js:3189`, `bonusMontagem`).
- Precisa de **espaço na mochila** (descontando os componentes que saem da mochila) (`motor.js:3182`).
- Só na Fonte: `naBase` (`motor.js:3176`).

---

## 9. Nível, pontos de habilidade e atributos

### 9.1 Subir de nível (`ganharXp`, `motor.js:2795–2810`)

```
se nivel >= 50: não faz nada (e no fim põe xp = 0)
xp += ganho
enquanto nivel < 50 e xp >= xpParaNivel(nivel):
    xp -= xpParaNivel(nivel)
    nivel += 1
    pontos += 1                              // 1 ponto de HABILIDADE por nível (motor.js:2801)
    pontosAtrib += 3                         // PONTOS_POR_NIVEL (motor.js:2802)
    se c (contexto de combate): vida += (vidaMax − vida) × 0,3    // cura 30% do que falta (motor.js:2805)
```

- `NIVEL_MAX = 50` (`motor.js:27`), `PONTOS_POR_NIVEL = 3` (`motor.js:483`).
- **Total de pontos de atributo no nível N = 3×(N−1)** (nível 1 = 0; nível 50 = 147). É este o teto
  imposto por `migrar` (`motor.js:1034–1037`): `pontosAtrib <= 3×(nivel−1) − gastos`.
- **Total de pontos de habilidade = 1 por nível subido (49 até ao 50)**, mais o rank 1 da Q que o estado
  inicial já traz (`motor.js:1003`). O total de ranks existentes é `RANKS_TOTAIS = 110`
  (`motor.js:899–901`): 10 habilidades com máximo 10 (Q, W, E, G, A, D, F, T, B, M) + R e N com
  máximo 5.
- `subirAutomatico` (`motor.js:2821–2832`) gasta os pontos por esta ordem: **N, R**, as recém-liberadas,
  **Q, E**, o que está na barra, **D**, depois tudo.

### 9.2 Limites por nível de habilidade (`motor.js:899–915`)

- Barra de combate: **4 habilidades** (`BARRA = 4`, `motor.js:900`); R libera no 6, 11, 16, 25, 35
  (`nivelMinimoR`, `motor.js:902`); N no 45, 46, 47, 48, 50 (`nivelMinimoN`, `motor.js:903`).
- Q/W/E: `min(max, ceil(nivel/2))` (`motor.js:910`). As outras (G/A/D/F/T/B/M): só a partir do
  `h.nivel` e depois `min(max, 1 + floor((nivel − h.nivel)/2))` (`motor.js:911`).
- Cada habilidade tem o seu nível de liberação: G 8, A 13, D 18, F 23, T 28, B 33, M 38, N 45
  (D é passiva, `motor.js:565–582`).

### 9.3 O que cada ponto de atributo dá (`ATRIBUTOS`, `motor.js:441–452`)

| atributo | efeito por ponto | tetos |
|---|---|---|
| Força | +1,2 de dano de ataque — **nos campeões de magia vira +2 de Poder de Habilidade** (`FORCA_MAGO`, `motor.js:454`) | — |
| Vitalidade | +20 de vida máxima e +0,1 de regeneração/s | — |
| Resistência | +1,5 de armadura e +1 de resistência mágica | — |
| Agilidade | +0,8% de velocidade de ataque e +0,25% de esquiva | esquiva máx. **25%** (`motor.js:536`) |
| Foco | +8 de mana, +0,06 de regeneração de mana e −0,4% de recarga | recarga máx. **30%** (por Foco) (`motor.js:537`) |

- Nos campeões **sem mana** (Yasuo, Katarina) e no **Zac**, a parte da mana do Foco vira outra coisa
  (`FOCO_SEM_MANA`, `motor.js:457–468`): Katarina e Zac +0,2% de dano de habilidade por ponto
  (`FOCO_DANO_HAB = 0,002`); Yasuo +1% de Fluxo (`FOCO_FLUXO = 0,01`).
- A recarga total é `min(0,4; min(0,3; 0,004×Foco) + cdrItens)` (`motor.js:537`) — o teto global é 40%.
- Velocidade de ataque: `min(3,0; ...)` (`VEL_ATAQUE_MAX = 3`, `motor.js:344, 534`).
- Crítico: `min(1, ...)` (`motor.js:541`).
- `atributosDe(estado)` escolhe a tabela certa por campeão (`motor.js:469–472`).

### 9.4 Modelos e distribuição automática (`motor.js:484–489, 2846–2865`)

| modelo | pesos |
|---|---|
| Tanque | vitalidade 2, resistência 2, força 1 |
| Equilibrado | força 2, vitalidade 2, resistência 1, agilidade 1, foco 1 |
| Dano | força 3, agilidade 2, vitalidade 1 |
| Habilidades | foco 2, força 2, vitalidade 1 |

```
subirAtributo(estado, chave, qtd):
    n = min(qtd, pontosAtrib); se ATRIBUTOS[chave] não existe ou n <= 0: devolve 0
    estado.atrib[chave] += n; estado.pontosAtrib -= n

distribuirAtributos(estado):                    // motor.js:2853–2865
    m = MODELOS[estado.modelo]; se não existe, devolve 0
    total = soma dos pesos
    enquanto pontosAtrib > 0:
        soma = (soma de todos os pontos já gastos) + 1
        escolhe o atributo com o MENOR  (atributo_gasto − soma × peso/total)
        subirAtributo(estado, escolhido)
```

- Ou seja: dá o próximo ponto ao atributo **mais atrasado em relação à proporção do modelo**.
- `subirAtributo` não olha ao modelo; o modelo só serve para `distribuirAtributos`.
- **Reset**: `LOJA.resetAtrib` (150 diamantes) devolve tudo a zero (`motor.js:3660, 3687–3690`); o
  Mestre da Legião também reseta por ouro: `RESET_OURO = 25.000`,
  `precoResetOuro(nivel) = 25.000 × max(1, nivel)` (`motor.js:3674–3675`) — o servidor cobra e aplica.
- `atrib` no estado inicial: tudo a zero, `pontosAtrib: 0`, `modelo: ''` (`motor.js:1005`).

---

## 10. Mochila e cofre

### 10.1 Mochila

```
MOCHILA_INICIO = 20 ; MOCHILA_GANHO = { niveis: 5, espacos: 2 }          (motor.js:35)
mochilaDe(nivel) = 20 + 2 × floor( min(50, max(1,nivel)) / 5 )           (motor.js:36)
MOCHILA = mochilaDe(50) = 40                                             (motor.js:37)
nivelDoEspaco(k) = k < 20 ? 1 : 5 × ceil( (k+1−20) / 2 )                 (motor.js:39)
espacosEspolios(e) = soma de ceil(q / 1000) por espólio                  (motor.js:341, 345)
espacosLivres(e)   = mochilaDe(e.nivel) − e.mochila.length − espacosEspolios(e)   (motor.js:346)
mochilaCheia(e)    = espacosLivres(e) <= 0                               (motor.js:347)
```

| nível | espaços | nível | espaços | nível | espaços |
|---|---|---|---|---|---|
| 1–4 | 20 | 20–24 | 28 | 40–44 | 36 |
| 5–9 | 22 | 25–29 | 30 | 45–49 | 38 |
| 10–14 | 24 | 30–34 | 32 | 50 | 40 |
| 15–19 | 26 | 35–39 | 34 | | |

- **Espólios dividem a mochila com os itens** (pilhas de 1.000; `motor.js:345–349`).
- **Gemas não ocupam mochila** (bolsa à parte, `motor.js:1010`).
- Quando a mochila está cheia, o item que caía **perde-se** (`perdidos`, `motor.js:1770–1775`) — e o
  espólio também (`motor.js:1779`). O filtro `estado.ignorarBasicos` descarta os básicos no abate
  (`motor.js:1772`; ligado/desligado em `jogo.js:5882–5884`).
- Equipamento: `ESPACOS = 5` (1 bota + 4 outros), `ESPACOS_ITENS = 4` (`motor.js:28–29`). Cada
  **lendário só uma vez** (`motor.js:2879`); bota nova troca com a bota equipada (`motor.js:2873–2876`).
  `arrumarEquipamento` (servidor) tira o que não cabe para a mochila e, sem lugar, para o cofre
  (`motor.js:2901–2912`).

### 10.2 Cofre da Tesoureira (`motor.js:2958–3040`)

```
COFRE = { espacos: 40,
          ouro:     { espacos: 20, precos: [150000, 500000, 1500000] },   // 3 ampliações
          diamantes:{ espacos: 10, preco: 100, vezes: 5 } }               // 5 ampliações
espacosCofre(e) = 40 + 20×compOuro + 10×compDia                            (motor.js:2974)
COFRE_MAX       = 40 + 20×3 + 10×5 = 150                                   (motor.js:2975)
```

- Abre na **Fonte** e nas **cidades** (com o Burrinho de Carga) — `podeCofre` (`motor.js:2962`);
  o servidor pode liberar por rota com `comCofreLiberado` (`motor.js:2961`).
- Guarda/retira **itens** (1 a 1 ou tudo) e **ouro** (`guardarNoCofre`, `retirarDoCofre`,
  `guardarTudoNoCofre`, `retirarTudoDoCofre`, `depositarOuro`, `sacarOuro`, `motor.js:2994–3040`).
- Preço das ampliações com ouro: **150.000 / 500.000 / 1.500.000** (`motor.js:2965`); a parte dos
  diamantes o motor só confere e soma (quem desconta é o servidor, `motor.js:2986–2993`).
- O cofre **não** guarda espólios nem gemas (só `c.itens` e `c.ouro`).

---

## 11. Tarefas do Capitão da Legião

### 11.1 Tipos e frações de recompensa (`TAREFA_TIPOS`, `motor.js:3244–3248`)

| tipo | minutos nominais | fração de XP dos abates | fração de ouro dos abates |
|---|---|---|---|
| rápida | 7 | 0,42 | 0,55 |
| normal | 15 | 0,43 | 0,55 |
| desafio | 15 | 0,44 | 0,50 |
| longa | 25 | 0,42 | 0,55 |
| espécie (Caça) | 12 | 0,42 | 0,55 |
| furioso (Fúria) | 16 | 0,42 | 0,55 |

- O motor mede **abates por minuto** por zona: `ritmoZona(id) = ABATES_MIN_ZONA[id] × 1,5`
  (`motor.js:3253–3254, 3266`). Ver a tabela de 2.5.
- `TROCAR_TAREFAS_MIN = 10` minutos entre ofertas (`motor.js:3424`); `TAREFA_VERSAO = 2`
  (`motor.js:3255`).

### 11.2 Quantos abates a tarefa vale (`abatesEquivalentes`, `motor.js:3259–3264`)

```
se tipo == 'especie':  qtd / fração da espécie na zona
se tipo == 'furioso':  qtd × (3 / FURIOSO.chance) = qtd × 60
senão:                 qtd
minutosTarefa(t) = max(1, round( abatesEquivalentes(t) / ritmoZona(t.local) ))   (motor.js:3265)
```

### 11.3 Recompensa (`recompensaTarefa`, `motor.js:3276–3288`)

```
porAbateZona(l):                       // média dos monstros da zona, no nível do meio
    nm  = (l.nm[0] + l.nm[1]) / 2 ;  tot = soma dos pesos dos monstros
    xp  = Σ (peso/tot) × CURVA.xp(nm)  × MONSTROS[m].xp
    ouro= Σ (peso/tot) × CURVA.ouro(nm) × MONSTROS[m].ouro

tarefa por zona:
    z = porAbateZona(l) ; eq = abatesEquivalentes(t)
    XP   = round( eq × z.xp   × TAREFA_TIPOS[t.tipo].xp   )
    OURO = round( eq × z.ouro × TAREFA_TIPOS[t.tipo].ouro )

tarefa antiga (sem tipo):
    nm = (l.nm[0]+l.nm[1])/2
    XP   = round( qtd × CURVA.xp(nm)   × MONSTROS[m].xp   × 0,6 )
    OURO = round( qtd × CURVA.ouro(nm) × MONSTROS[m].ouro × 0,75 )
```

- Limites de `qtd` (`motor.js:3280`): espécie 5–500; furioso 1–5; os outros 10–1.000.
- A tarefa antiga usava `QTDS = [80, 100, 120, 150, 200]` (`motor.js:3237`) e a raridade vinha do
  tamanho (`qtd >= 150` → grande, `motor.js:3343`).
- **A recompensa em ouro/XP é fixada quando a oferta é criada** e a entrega **limita ao valor recalculado
  agora** (`motor.js:3460–3461`) — é o anticheat da tarefa.
- **Exemplo (DERIVADO):** nível 30 (Dragão, `ritmoZona = 10,5`), tarefa "normal" com `qtd = 160`:
  XP = round(160 × 366,27 × 0,43) = **25.199**; ouro = round(160 × 160,87 × 0,55) = **14.157** —
  ~43% da XP que os próprios 160 abates dariam.

### 11.4 Recompensa em item (`motor.js:3289–3306`)

```
chancesItemTarefa(t):                        // t.tipo → fator 0,3 ; tarefa antiga → fator 0,5
    ch = chancesDrop(local)                  // ver §11.5
    q  = abatesEquivalentes(t) ou t.qtd
    lendario = min(0,05;  q × ch.lendario × fator)
    epico    = min(0,5;   q × ch.epico    × fator)
raridadeTarefa(t):
    se t.item não é 'grande'/'pequena': devolve t.item (tarefa antiga)
    sorteia: lendario → epico → senão 'basico' se for grande OU 30% se for pequena
ITEM_TAREFA = { fator: 0.5, fatorZona: 0.3, pequena: 0.3 }
```

- **Tarefa grande** (desafio/longa/fúria) garante um item (básico se não sair épico/lendário); **pequena**
  tem 30% de chance de um básico (`motor.js:3305, 3294`).
- A entrega exige **espaço na mochila** se houver item (`motor.js:3459`) e acontece na Fonte
  (`motor.js:3458`).
- **Exemplos (DERIVADO):** no Barão (tier 7), uma tarefa de 200 abates equivalentes tem **2,21%** de
  lendário e **9,30%** de épico; no Rota Inferior (tier 0), 200 abates dão **0,62%** e **7,80%**.

### 11.5 Chances de saque por zona (`chancesDrop`, `motor.js:1138–1149`) — DERIVADO

```
BRUTO(t):  k = ajuste(NIVEL_DO_TIER[t]).drop
           lendario = 4e-5 × 4^(t/7) × k × LENDARIO_TIER[t]
           epico    = (0,0005 + 0,00015×t) × k
           basico   = (0,012 − 0,0005×t) × k
chancesDrop(t) = { lendario: l ; epico: (1−l)×e ; basico: (1−l)(1−e)×b }   // uma raridade por abate
```

| tier (zona) | lendário | épico | básico | 1 lendário a cada N abates |
|---|---|---|---|---|
| 0 (Rota Inf.) | 0,0104% | 0,1300% | 3,116% | ~9.615 |
| 1 (Rota Sup.) | 0,0107% | 0,1430% | 2,526% | ~9.322 |
| 2 (Lobos) | 0,0150% | 0,1440% | 1,977% | ~6.676 |
| 3 (Azul) | 0,0235% | 0,1140% | 1,258% | ~4.260 |
| 4 (Vermelho) | 0,0247% | 0,1100% | 0,999% | ~4.043 |
| 5 (Rio) | 0,0269% | 0,1250% | 0,949% | ~3.715 |
| 6 (Dragão) | 0,0328% | 0,1400% | 0,898% | ~3.048 |
| 7 (Barão) | 0,0368% | 0,1549% | 0,848% | ~2.717 |

- `NIVEL_DO_TIER` = 5, 9, 14, 19, 24, 29, 34, 44 (`motor.js:1138`); `LENDARIO_TIER` =
  [1, 1, 1,4, 2,7, 2,8, 2,5, 2,5, 2,3] (`motor.js:1142`).
- **Chefe**: 0,1% lendário, 5% épico, 40% básico (`DROP_CHEFE`, `motor.js:1145`) — cada um sorteado à
  parte (`sortearLoot`, `motor.js:1156–1158`).
- O saque é multiplicado por `VIP.drop = 1,2` e pelo `fatorSaque` (`motor.js:1764, 1770`).
- A caça de um monstro **mais de 5 níveis abaixo** também reduz o saque (`fatorSaque = fatorXp`,
  `motor.js:421–424`).

---

## 12. Diárias e prémio de login

### 12.1 Missões diárias (`motor.js:3347–3423`)

```
DIARIA      = { qtd: 1000, xp: 0.75, ouro: 0.66, lendario: 0.27, lendarioMax: 0.08, abaixo: 5 }
DIARIA_RIFT = { qtd: 1000, xp: 0.5,  ouro: 0.5,  lendario: 0.13, lendarioMax: 0.04, abaixo: 5 }

recompensaDiaria(nivel, tipo):
    z = porAbateZona(zonaIdeal(nivel)) ; ch = chancesDrop(zonaIdeal(nivel))
    XP   = round( 1000 × z.xp × (tipo == 'runeterra' ? 1,3 : 1) × Rg.xp )
    OURO = round( 1000 × z.ouro × Rg.ouro )
    chance de lendário = min( Rg.lendarioMax, 1000 × ch.lendario × Rg.lendario )
```

- A de **Runeterra** é caçando à mão; a do **Rift** conta no automático (`DIARIAS`, `motor.js:3358–3361`).
- Conta abates de monstros com `nivel >= nivelJogador − 5` e **nunca invocados** (`contarDiaria`,
  `motor.js:3402–3408`); cada abate conta só na diária do lugar onde foi (`D.aqui`).
- O item é **sempre épico** e vira lendário se o sorteio passar a chance; a qualidade é sorteada
  (`motor.js:3414–3415`). Exige espaço na mochila (`motor.js:3413`).
- **Exemplos (DERIVADO):** nível 30 (Dragão) → XP 357.110, ouro 106.172, 8,00% de lendário;
  nível 50 (Barão) → XP 472.355, ouro 142.560, 8,00% de lendário (a chance bate no teto
  `lendarioMax = 0,08` já no tier 6).
- Aceitação/entrega são do servidor (rota `/api/diaria`, `motor.js:3354–3355`); o dia é o de Brasília
  (`diaHoje`, `motor.js:3362`).

### 12.2 Prémio diário por entrar (`PREMIO_LOGIN`, `motor.js:3363–3388`)

| dia do ciclo | ouro (em minutos de caça) | runas | item |
|---|---|---|---|
| 1 | 10 min | — | — |
| 2 | — | 2× Sorte | — |
| 3 | 20 min | — | — |
| 4 | — | 2× Sorte, 1× Proteção | — |
| 5 | 30 min | — | — |
| 6 | — | 2× Sorte, 1× Arcana | — |
| 7 | 45 min | — | 1 épico |

```
ouroPorMinuto(nivel) = porAbateZona(zonaIdeal(nivel)).ouro × ritmoZona(zonaIdeal(nivel).id)
premioLoginDe(nivel, dia) = { ouro: max(100, round(p.ouro × ouroPorMinuto(nivel) / 100) × 100),
                              runas: p.runas || null, item: p.item || null }     (motor.js:3378–3381)
```

- A sequência sobe enquanto se pega **em dias seguidos**; falhar um dia inteiro volta ao dia 1
  (`proximoLogin`, `motor.js:3383–3388`).
- **Exemplos (DERIVADO):** nível 30 → dia 1 = 16.900 de ouro, dia 7 = 76.000 + 1 épico;
  nível 50 → dia 1 = 24.300, dia 7 = 109.400 + 1 épico.
- 30 dias seguidos dão a **Aranhinha** (`ARANHA_DIAS = 30`, `motor.js:3523, 3528`).

---

## 13. Conquistas (bónus permanentes) e mascotes

- `bonusConquistas` soma `ad, vida, armadura, rm, ouro` das conquistas já feitas
  (`motor.js:3497–3501`); entra em `atributos` (`motor.js:524`) e no `ouroMult` do abate
  (`motor.js:526, 1758`).
- Conquistas que mexem na economia (`motor.js:3478–3495`):
  `centuriao` (1.000 abates) +2% ad; `carniceiro` (10.000) +3% ad; `veterano` (nível 25) +2% vida;
  `mao` (nível 50) +3% ad e +3% vida; `imortal` (nível 30 sem morrer) +3% armadura; `arauto` +2% vida;
  `dragao` +3% rm; `barao` +3% ad; `soldado` (10 tarefas) **+5% ouro**; `mercador` (100 vendas)
  **+5% ouro**; `ferreiro` (um item +5) +2% armadura; `rico` (1.000.000 de ouro ganho) **+5% ouro**.
  `sortudo`, `vilemaw`, `colecionador`, `sangue` não dão bónus (só título).
- `verificarConquistas` marca as novas (`motor.js:3503–3508`); `escolherTitulo`/`tituloAtual`
  (`motor.js:3509–3513`).

### Mascotes (`motor.js:3515–3571`)

| mascote | preço | bónus por nível | requisito |
|---|---|---|---|
| Poro | 2.000 de ouro | +1% de ouro | — |
| Krugzinho | 8.000 de ouro | +1% de armadura e rm | — |
| Dragãozinho | — | ataca (25% + 3%/nível do AD) | derrotar o Dragão Infernal |
| Aranhinha | especial | ataca (22% + 2,5%/nível) e +0,25% de itens | Baú da Vilemaw ou 30 dias de login |

- `MASCOTE_MAX = 20` (`motor.js:3516`); `xpMascote(n) = round(150 × n^1,7)` (`motor.js:3533`).
- O mascote recebe **10% do XP de cada abate** (`motor.js:1767`).
- Em campeões de magia o ataque do mascote soma metade do Poder (`PET_AP = 0,5`, `motor.js:3529–3532`).

---

## 14. Loja (diamantes), VIP, presente de nível, montaria

### 14.1 Loja (`LOJA`, `motor.js:3658–3670`)

| produto | preço (diamantes) | o que faz |
|---|---|---|
| Reset de habilidades | 150 | devolve todos os pontos de habilidade (`motor.js:3684–3686`) |
| Reset de atributos | 150 | devolve todos os pontos de atributo (`motor.js:3687–3690`) |
| Skin de campeão | o preço da skin (500 ou 900) | `precoLoja` (`motor.js:3677–3678`); 2 de 900 com efeitos visuais (`motor.js:3574–3585`) |
| Skin de mascote | 300 | `motor.js:3662` |
| Skin de montaria | 600 | `motor.js:3663, 3625` |
| Bênção Protetora | 300 | protege a **próxima morte em Runeterra** (nenhum item cai); uma por vez (`BENCAO_MAX = 1`, `motor.js:3664–3671, 3703–3705`) |
| Trocar o nome | 200 | rota própria (`motor.js:3668–3669`) |

- Quem cobra e aplica é o servidor (`motor.js:3655–3656, 3682–3713`).
- Skins à venda: 3 por campeão (2 de 900 com efeitos, 1 de 500); o Zac tem 2
  (`SKINS_A_VENDA`, `motor.js:3577–3585`).

### 14.2 VIP (`motor.js:139–156`)

```
VIP = { boasVindas: 2 dias, xp: 1.2, drop: 1.2, refino: 1.2, refinoMax: 0.5, preco: 200 💎, dias: 30 }
VIP.salvarConvidado = 1 dia extra
ehVip(estado) = estado.vipAte > Date.now()
```

- **200 diamantes = 30 dias**; a referência de preço é **R$ 1 = 50 diamantes** (`motor.js:145`).
- Toda conta nova ganha **2 dias** de VIP; convidado que salva a conta ganha +1 (`motor.js:144–147`).
- Efeitos: **+20% XP**, **+20% chance de saque**, **+20% chance de refino e de montagem** (teto 0,5) e a
  **rotina automática** (`motor.js:145, 153, 156, 1764–1765, 3161`).
- O servidor é quem diz até quando vale (`motor.js:141`).

### 14.3 Presente de nível (`PRESENTE_NIVEL`, `motor.js:148–151`)

- No **nível 3**, uma vez por conta, um **épico de qualidade A** da classe do campeão
  (ad → 3044; ap → 3145), oferecido até ao nível 9 (`motor.js:150–151`). Entregue pelo servidor.

### 14.4 Montaria (`motor.js:3621–3652`)

- Todo o jogador tem o Burrinho; montar leva 1 s; velocidade `0,3 + 0,05×(nível−1)` até ao nível 10
  (`MONTARIA`, `motor.js:3624, 3633`).
- XP da montaria = `250 + 250×n` tiles andados montado (`motor.js:3626`).
- Skin de montaria: 600 diamantes (`motor.js:3625`).

---

## 15. Morte: o que custa em ouro/XP/itens

- **XP**: 10% do XP do nível atual (`perdaPorMorte`, `motor.js:430, 2763–2768`). Na Arena, zero
  (`motor.js:2782`).
- **Itens**: no Rift **não cai nada** (comentário `motor.js:2738`). Em Runeterra, **10% de chance por
  item equipado** (`CHANCE_PERDER_ITEM = 0.1`, `motor.js:2739–2740`); morto por outro jogador, **30% de
  cair 1 item equipado** sorteado (`CHANCE_PERDER_PVP = 0.3`, `motor.js:2742–2743`).
- **Caveira Vermelha** (`CAVEIRA_VERMELHA`, `motor.js:2744–2761`): 3 frags em 14 h dão 14 h de
  Vermelha; com ela, morrendo em Runeterra cai **metade** de tudo o que carrega (equipados + mochila,
  sorteados) — `metadeDosItens` (`motor.js:2757–2761`).
- A **Bênção Protetora** (300 diamantes) impede a queda na próxima morte em Runeterra
  (`motor.js:3664–3667`).
- `morrer` põe `d.morto = 3` s no Rift (na Arena fica caído até à próxima rodada) e zera os efeitos
  (`motor.js:2776–2786`). Ao renascer: Fonte, **10% da vida** e **0 de mana** (`motor.js:1345–1348`).

---

## 16. Fórmulas-resumo para a função de decisão

```
OURO/HORA(zona, nível) ≈ ritmoZona(zona) × 60 × 0,75 × CURVA.ouro(nm_zona)
                          × Σ(peso/tot × MONSTROS[m].ouro) × ouroMult × fatorSaque
                        + espólios (~+30% do ouro dos abates, comentário motor.js:302–303)

CUSTO DE POÇÃO (PvE)   = Σ usos × preço_da_poção_escolhida
                         escolhida por escolherPocao: a menor que cobre falta×1,2 (motor.js:1293–1298)
CURA MÁXIMA POR SEGUNDO = p.cura / 1 s (PvE)   |  p.cura×0,3 / 6 s (PvP)  (motor.js:41, 43)

CUSTO DE UM +k NO ORNN = preco × Σ_ref f(ref)  com f = {0:0,5  1:1  2:3  3:4  4:5}
                          e ~3,3/11,1/58,7/200,8/590,8 tentativas médias até +1/+2/+3/+4/+5 (§7.5)

CUSTO DE UMA MONTAGEM = custoMontar(item) × E[tentativas]
                          E ≈ 60,6 (épico) e 554,6 (lendário) sem VIP (§8.2)

XP PARA O PRÓXIMO NÍVEL = tres( (43000 + 4345(n−1) + 17,9(n−1)²) × 0,4433 × 1,1715^(n−1) × ajuste(n).xpUpar )
PONTOS POR NÍVEL        = 1 de habilidade + 3 de atributo (motor.js:2801–2802)
TETO DE ATRIBUTOS       = 3 × (nível − 1) (motor.js:1034–1037)

RECOMPENSA DE TAREFA (por zona) = abatesEquivalentes × porAbateZona × {xp, ouro} do tipo
DIÁRIA (Runeterra)              = 1.000 abates equivalentes × 0,75 da XP (×1,3) e 0,66 do ouro
```

### O que a decisão precisa de perguntar ao motor (e onde)

| Pergunta | Fonte |
|---|---|
| Quanto ouro/hora nesta zona e nível? | `porAbateZona` (3270) + `ritmoZona` (3254) + `CURVA.ouro` (278) |
| Quantas poções e quanto custam? | `POCOES` (261) + `escolherPocao` (1293) + `EXAUSTAO` (41) |
| Quanto custa refinar/montar até +k? | `precoRefino` (258) + `chanceForjaAgora` (136) + `chanceMontarAgora` (3162) |
| Quanto vale o que está na mochila? | `valorVenda` (257) + `valorEspolios` (350) |
| Quanto XP falta para o próximo nível? | `xpParaNivel` (429) |
| Que item a tarefa/diária dá? | `chancesItemTarefa` (3295) + `chancesDrop` (1146) |
| Cabe mais saque? | `espacosLivres` (346) + `mochilaCheia` (347) |
| Vale ir à Fonte vender/comprar? | `atendeAqui` (2924) + `venderItem` (2930) + `comprarPocao` (2951) + `RECALL` (40) |

---

## 17. O que NÃO está no motor (NÃO VERIFICADO) e o que precisa do dono

**NÃO VERIFICADO (não está no `motor.js` lido por inteiro):**

1. **O mercado entre jogadores**: preço, moeda, taxa, limites, reserva. No motor só existe a codificação
   `"gema:<id>:<q>"` (`motor.js:120–122`). Vi no jogo (`jogo.js:2478, 2519, 2786`) ofertas com preço
   em ouro/orbs/diamante, mas **não li esses blocos por inteiro** nesta tarefa.
2. **O que o servidor faz com o cofre, as diárias, o prémio de login, as tarefas e a loja**: o motor
   define as regras e os limites, mas quem guarda o dia, desconta diamantes e valida é o servidor
   (`motor.js:2963, 3354–3355, 3655–3656`).
3. **A Vilemaw e o Baú** (chefe global): referidos no motor (`motor.js:291, 322–324, 3491, 3523`), mas o
   ficheiro da Vilemaw está fora do `motor.js` (`docs/game-src/vilemaw.js`, não lido nesta tarefa).
4. **A Arena/Runeterra** (`arena.js`, `arena-pvp.js`): o motor declara `ARENA.bonus = 1,3`
   (`motor.js:412`) e `GRUPO` (`motor.js:143`), mas a aplicação por abate é feita pelo motor de lá
   (`processarAbates(estado, c, a, local, bonus, bonusXp)`, `motor.js:1751`) — **NÃO VERIFICADO** quais
   valores exatos o arena.js passa.

**PRECISA DE REGRA DO DONO** (não é dado do jogo):

- Taxa/limites do mercado entre jogadores e o destino de um lendário duplicado com o mercado/mochila
  cheios (o `AGENTS.md` já dá estes como exemplos legítimos de pergunta).
- Qualquer preço de item sem comparável no `itens.js` (o `AGENTS.md` cita o exemplo de 1,5M).

**Notas de integração que encontrei (não são bugs do motor, mas o chamador tem de as cumprir):**

- `estado.rotina` é lido em `motor.js:1407, 1411` mas **não** é criado por `novoEstado`
  (`motor.js:998–1022`) nem por `migrar` (`motor.js:1025–1050`) — é o jogo que o cria
  (`jogo.js:94`). Se outro chamador usar o motor sem o criar, rebenta.
- O motor tem **dois redutores de cura em PvP** (poção 0,3 em `motor.js:43`; habilidades/roubo 0,65 em
  `motor.js:1284`) — quem somar cura tem de escolher o caminho certo.
- `QUALIDADES` e o refino **não escalam** `penMag` nem os campos `*Pct`/esquiva (`motor.js:252–255`
  vs. `motor.js:501, 509`) — é a mesma família de armadilha da prova nº 2 do `AGENTS.md`.

---

## 18. Como recalcular isto sem o motor (passo a passo)

1. Lê `BALANCO` de `balanco.js:2` e usa `ajuste(n)`.
2. Aplica `CURVA.xp/ouro` (2.1) para obter o nominal do monstro.
3. Multiplica pelos `MONSTROS` (2.2) e pelo sorteio de ouro 0,5–1,0 (média 0,75).
4. Aplica noturno/furioso e `fatorSaque` (2.3–2.4).
5. Soma espólios (§3), tarefas (§11), diárias (§12) e login (§12.2).
6. Subtrai poções (§1), refino (§7) e montagem (§8) — as três torneiras de ouro do jogo.
7. Para a progressão, usa `xpParaNivel` (2.6) e os pontos por nível (§9).

*Fim. Documento escrito a partir da leitura integral de `docs/game-src/motor.js` (3.791 linhas).*
