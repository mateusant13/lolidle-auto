# Yasuo e roubo de vida — a build está a contar com isso?

**Pergunta do dono (verbatim):** "e a build do yasuo ta levando em conta itens com roubo de vida?"

**Revisão ancorada.** Todas as linhas deste documento pertencem à revisão abaixo. O `extension/automation.js` está a ser editado em paralelo — **mudou de 6 447 → 6 529 → 6 555 linhas durante esta análise**. As linhas abaixo são do último instantâneo (6 555). Cada afirmação traz o token para reconfirmar com `grep -n`.

| ficheiro | sha256 | linhas |
|---|---|---|
| `extension/automation.js` | `0ef252888a3e159de57ab90a1020b1ed20ee27e357c016f8a7ae4f29f1f4d011` | 6555 |
| `docs/game-src/itens.js` | `902757451ffd515718916198fa8dd76932666f04791622bbd31c6f186a8a2494` | 2584 |
| `docs/game-src/motor.js` | lido como texto (não é importável: `motor.js:3-8` importa `dados-ezreal.js`, `dados-yasuo.js`, … que não existem nesta pasta) | — |

**Método.** As funções REAIS do `automation.js` (`valorPassiva`, `pesosItem`, `pesosItemFase`, `classeItem`, `perfilDe`, `bonusItemFase`, `valorPctVida`) foram extraídas do ficheiro e corridas em Node contra o catálogo real (`docs/game-src/itens.js`, 108 itens), reproduzindo a fórmula de `montarBuildDe` (automation.js:4717, soma em automation.js:4730). **A reprodução devolveu exactamente a build medida ao vivo pelo Lead (`3172,3031,3046,3036,3074`)** — é essa a validação do método. Não se correu a extensão nem o jogo.

---

## Resposta curta

| pergunta | resposta |
|---|---|
| A build do Yasuo tem roubo de vida? | **SIM** — 2 dos 5 itens: `3172` (6%) e `3074` (12%) = **18%** |
| A extensão escolheu-os PELO roubo de vida? | **NÃO** — com `rv = 0` nos 108 itens a build sai **idêntica** |
| O scoring pontua o `rv`? | **SIM** — peso 3 no perfil do Yasuo (automation.js:3770) |
| Quanto vale esse peso na prática? | **0,18 a 0,36 pontos** por item, num total de **2 689,94** (0,02%) |
| A regex de roubo de vida do `valorPassiva` dispara? | **NÃO** — 0 acertos em 108 itens (código morto) |
| O motor do jogo usa o `rv`? | **SIM** — motor.js:1226-1230 |

---

## 1. Itens do catálogo com roubo de vida

### 1.a Campo `rv` > 0 — 7 itens (de 108)

| id | nome | `rv` | raridade | espaço | itens.js (id · rv · efeito) |
|---|---|---|---|---|---|
| 1053 | Cetro Vampírico | **0,07** | épico | arma | 618 · 634 · 638 |
| 3008 | Grevas Vorazes | **0,07** | épico | botas | 784 · 800 · 804 |
| 3168 | Caminho Imortal | **0,12** | lendário | botas | 1764 · 1781 · 1785 |
| 3172 | Grevas Bélicas | **0,06** | lendário | botas | 1963 · 1980 · 1984 |
| 3153 | Espada do Rei Destruído | **0,10** | lendário | arma | 2263 · 2281 · 2285 |
| 3074 | Hidra Raivosa | **0,12** | lendário | arma | 2384 · 2402 · 2406 |
| 3072 | Sedenta por Sangue | **0,15** | lendário | arma | 2509 · 2527 · 2531 |

Todos os outros 101 itens têm `"rv": 0` (108 entradas no total — `itens.js`).

### 1.b Passiva de roubo de vida no texto `efeito` — 2 itens

| id | item | texto (`efeito`) |
|---|---|---|
| 3074 | Hidra Raivosa | "Cleave: ataques causam 40% do Dano de Ataque nos outros inimigos que você alcança. **Roubo de vida de 12%.**" — itens.js:2406 |
| 3072 | Sedenta por Sangue | "Escudo Sanguíneo: **a cura do roubo de vida** que passar da Vida máxima vira escudo (até 25% da Vida máxima)." — itens.js:2531 (resumo: "Concede Dano de Ataque, Roubo de Vida. O Roubo de Vida pode sobrecurar" — itens.js:2521) |

Notas (para não haver dúvida sobre o que conta como "roubo de vida"):
- **1053 Cetro Vampírico** tem roubo de vida (0,07) mas **não no `efeito`**: o `efeito` é `null` (itens.js:638) e a frase aparece no `resumo` — "Ataques básicos restauram Vida" (itens.js:628). Como `valorPassiva` sai logo quando não há `efeito` (automation.js:4059), este item pontua 0 de passiva.
- Há itens que **curam** sem ter `rv`: 6610 Céu Dividido ("…cura 6% da Vida perdida"), 6333 Dança da Morte ("…cura 15% da Vida perdida") e 3065 Semblante Espiritual ("+25% em toda cura recebida") — todos com `rv: 0`. Não são roubo de vida e nenhum deles entra na build.

---

## 2. Os 5 itens da build medida ao vivo (`3172,3031,3046,3036,3074`)

| # | id | nome | `rv` | itens.js | tem roubo de vida? |
|---|---|---|---|---|---|
| 1 | 3172 | Grevas Bélicas | **0,06** | rv em 1980 | **SIM** (6%) |
| 2 | 3031 | Gume do Infinito | 0 | rv em 2552 | NÃO |
| 3 | 3046 | Dançarina Fantasma | 0 | rv em 1433 | NÃO |
| 4 | 3036 | Lembranças do Lorde Dominik | 0 | rv em 2377 | NÃO |
| 5 | 3074 | Hidra Raivosa | **0,12** | rv em 2402 | **SIM** (12%) |

**Resposta directa:** **2 dos 5 itens têm roubo de vida** — 6% + 12% = **18%**. Não é verdade que nenhum tenha. O que não existe é a extensão tê-los escolhido por isso (ver secção 5).

---

## 3. O scoring da extensão pontua o `rv`? (SIM/NÃO, com file:linha)

| pergunta | resposta | onde |
|---|---|---|
| `pesosItem` tem a chave `rv`? | **SIM**, em TODOS os 5 perfis | tanque `rv: 1` (automation.js:3766) · mago `rv: 1` (:3767) · suporte `rv: 2` (:3768) · atirador `rv: 3` (:3769) · **dano `rv: 3` (:3770)** |
| O Yasuo cai em que perfil? | **'dano'** → peso `rv: 3` | `perfilDe` automation.js:3742; o ramo final tem o comentário `// yasuo` (:3750) |
| `pesosItemFase` mexe no peso do `rv`? | **SIM** — ×1 em mobs, ×1,2 em chefe | automation.js:3836 (mobs) · :3856 (chefe) · multiplicação em :3933 |
| `valorPassiva` tem regex que lê roubo de vida do texto? | **SIM, existe — mas NUNCA dispara** | automation.js:4074 — `v += n(/([\d,]+)%\s*de roubo de vida/i) * 4;` · **MEDIDO: 0 acertos nos 108 itens** |
| `efeitosEquipados` soma `rv`? | **NÃO** | automation.js:1336-1364: acumula só `cdr`, `penMag`, `apPct`, `lich`, `ap` (:1361); o objeto devolvido não tem `rv` |
| `statsSet` soma `rv`? | **NÃO** | automation.js:3198-3217: acumula só `apItem`, `adItem`, `cdr`, `pen` (:3210); o `return` (:3217) não tem `rv` |
| A extensão lê o "Roubo de Vida" do painel do jogo? | **NÃO** | `readStats` automation.js:1202-1209 — a regex aceita só `Dano|Armadura|Vel. ataque|Res. mágica|Poder|Mana|Crítico|Esquiva` (:1206); `player()` (:1220) devolve só nivel/vida/armadura/rm/dano/poder/va |
| O `(it.rv||0) * w.rv` entra na conta da build? | **SIM**, nos 3 sítios de pontuação | `valorDeFase` automation.js:4215 · `poderItem` :4430 · **`montarBuildDe` :4730** (é este que faz a build: automation.js:4700) |
| `classeItem` conta o `rv` como classe AD? | **SIM** | automation.js:3776 — `const ad = it.ad || it.critico || it.va || it.rv;` (espelha motor.js:22) |

### Tokens para reconfirmar (o ficheiro está a mexer)

Cada linha desta secção pode ser reconfirmada por conteúdo, sem depender do número da linha:

| o que | token (`grep -n`) |
|---|---|
| peso do `rv` no perfil dano | `rv: 3, vida: 0.03, armadura: 0.15, rm: 0.15, cdr: 180` |
| perfis | `if (perfil === 'tanque') return` · `if (perfil === 'mago') return` · `if (perfil === 'suporte') return` · `if (perfil === 'atirador') return` |
| peso por fase | `stat: { va: 1.4, critico: 1.1, cdr: 1.15` (mobs) · `stat: { va: 1, critico: 1.15, cdr: 1, ad: 1.05` (chefe) |
| regex de roubo de vida | `de roubo de vida/i) * 4` |
| soma do `rv` na pontuação | `const v = (i.ad || 0) * pesos.ad` (montarBuildDe) · `const v = (it.ad || 0) * w.ad` (poderItem) · `const stats = (it.ad || 0) * w.ad` (valorDeFase) |
| classe do item | `const ad = it.ad || it.critico || it.va || it.rv;` |
| efeitos equipados | `cdr += s.cdr || 0; penMag += s.penMag || 0;` |
| statsSet | `apItem += (it.ap || 0) * qm; adItem += (it.ad || it.dano || 0) * qm` |
| painel do jogo | `const m = t.match(/^(Dano|Armadura|Vel\. ataque` |
| alvo de referência (3153) | `const PASSIVA_POR_ALVO = [` · `+ valorPctVida(i.id, alvoRef, c);` |

### Porque é que a regex de roubo de vida não dispara (medido)

Padrão exigido: `([\d,]+)%` **antes** de `de roubo de vida`.
- 3074 escreve **"Roubo de vida de 12%."** (itens.js:2406) — o número vem **depois** da frase → não casa.
- 3072 escreve **"a cura do roubo de vida que passar…"** (itens.js:2531) — não há número antes → não casa.
- Resultado medido: **0 de 108** itens casam o padrão. O termo `* 4` é código morto.

Isto não é contradito pela auditoria do próprio ficheiro: automation.js:4137 afirma, sobre o campo `rv`, que «nenhum item repete o campo `rv` no texto» — o que é verdade (não há contagem dupla), mas não cobre o caso de a regex **nunca** casar.

---

## 4. O motor do jogo usa o `rv`? (SIM)

**Acumulação** — `atributos()` (motor.js:492):
- motor.js:496 `let rm = b.spellblock + 3.5 * g, va = 0, rv = 0;`
- motor.js:507 `… va += i.va; rv += i.rv; …` (por item equipado)
- motor.js:538 `rouboVida: rv,` (sai nos atributos do campeão)
- motor.js:254 `rv: i.rv * m,` — o `m` é o multiplicador de qualidade/refino do item — motor.js:252 `m = (1 + BONUS_REFINO * ref) * (QUALIDADES[qual]?.mult || 1)` — ou seja o roubo de vida **escala com a qualidade/refino** (tal como o AD, o AP, a vida…).

**Fórmula da cura** — `golpear()` (motor.js:1192), no fim de cada golpe (motor.js:1226-1230):

```js
if (a.rouboVida && fonte === 'ataque') {
  const cura = dano * a.rouboVida, falta = a.vida - estado.vida;
  curar(estado, c, a, cura);
  if (a.tem('3072') && cura > falta) d.escudo = Math.min(a.vida * 0.25, (d.escudo || 0) + (cura - falta));
}
```

- **cura = dano_final_do_golpe × rouboVida**, e **só em ataques básicos** (`fonte === 'ataque'`) — habilidades **não** curam por roubo de vida.
- `curar()` (motor.js:1285-1290): `vida += valor × mult`, com `mult = (a.tem('3065') ? 1.25 : 1) × (PvP ? 0.65 : 1)` (motor.js:1286); `CURA_PVP = 0.65` (motor.js:1284).
- **3072 Sedenta por Sangue**: a cura que passar da vida máxima vira escudo, até 25% da vida máxima (motor.js:1229).
- **PvP**: no golpe confirmado pelo servidor, motor.js:3773 `if (tecla === 'ataque' && a.rouboVida) cura += valor * a.rouboVida;`
- Não confundir: a **Sede de Sangue** (habilidade G, motor.js:572 `roubo: serie(0.12, 0.03)`) é outra fonte de cura, aplicada em motor.js:1231 — não vem de itens.
- O painel do jogo mostra o stat: `['rv', 'Roubo de Vida', '%']` (jogo.js:5999).

---

## 5. Conclusão — o número que decide

**A build do Yasuo TEM roubo de vida (18%), mas a extensão não o está a considerar na decisão.** A prova mais limpa é um teste contrafactual: pusemos `rv = 0` nos 108 itens e recalculámos a build com as funções reais da extensão:

| variante | com o catálogo real | com `rv = 0` em todo o catálogo |
|---|---|---|
| build ideal (`fase = null`) | `3172,3031,3046,3036,3074` | `3172,3031,3046,3036,3074` (**igual**) |
| build de mobs | `3172,3046,3031,3085,3074` | `3172,3046,3031,3085,3074` (**igual**) |
| build de chefe | `3172,3031,3036,3046,3074` | `3172,3031,3036,3046,3074` (**igual**) |

**O campo `rv` não muda a build do Yasuo em nenhuma fase.** Os itens com roubo de vida entram por outros motivos:

| item da build | pontuação total | parcela do `rv` | % do item | o que o põe lá |
|---|---|---|---|---|
| 3074 Hidra Raivosa | **447,34** | `0,12 × 3` = **0,36** | 0,08% | AD 65 (91 pts) + passiva Cleave (240 pts) |
| 3172 Grevas Bélicas | **342,47** | `0,06 × 3` = **0,18** | 0,05% | vel. ataque 0,45 (157,5 pts) + AD 30 (42 pts) + passiva Ritmo de Guerra (54 pts) |
| 3031 Gume do Infinito | 924,75 | 0 | — | crítico + Golpe Infinito |
| 3046 Dançarina Fantasma | 490,73 | 0 | — | vel. ataque + crítico |
| 3036 Lembranças do Lorde Dominik | 484,65 | 0 | — | crítico + Mata-Gigantes |
| **total dos 5** | **2 689,94** | **0,54** | **0,020%** | |

**Os números que decidem:**
1. O peso do `rv` no perfil do Yasuo é **3 por unidade** (automation.js:3770) — por unidade é até maior que o do AD (**1,4**). O problema é a **ordem de grandeza do catálogo**: o `rv` vale 0,06–0,15, o AD vale 15–80. No mesmo item (3074): **AD 65 → 91 pontos** contra **rv 0,12 → 0,36 pontos** — o AD vale **253× mais**.
2. Soma de todo o roubo de vida da build: **0,54 pontos em 2 689,94 = 0,02%**.
3. A regex que lê roubo de vida do texto (automation.js:4074) vale **0** para todos os itens — nunca dispara.

**E os itens com `rv` que ficaram de fora?**

| item | `rv` | posição no ranking | pontuação | porquê |
|---|---|---|---|---|
| 3074 Hidra Raivosa | 0,12 | 4.º | 447,34 | entrou (pelo Cleave, não pelo rv) |
| 3172 Grevas Bélicas | 0,06 | 5.º (1.ª bota) | 342,47 | entrou (pela vel. ataque, não pelo rv) |
| 3153 Espada do Rei Destruído | 0,10 | 9.º | 227,88 | perde por pontuação — ver cenário abaixo |
| 3072 Sedenta por Sangue | 0,15 | 12.º | 151,81 | a passiva (`Escudo Sanguíneo`) pontua **0** — não há regra em `valorPassiva` para ela; só tem AD |
| 3168 Caminho Imortal | 0,12 | 23.º | 99,71 | é bota e perde para a 3172 |
| 1053 Cetro Vampírico | 0,07 | 37.º | 24,39 | épico, AD 15, sem passiva pontuável (`efeito` = null) |
| 3008 Grevas Vorazes | 0,07 | 38.º | 24,39 | épico, AD 15, sem passiva |

**Cenário que muda a build (e é o único caminho por onde um item de roubo de vida entra por decisão):** o `montarBuildDe` soma também `valorPctVida` (automation.js:4733) — uma regra que só existe para o **3153** (tabela em automation.js:3884, função em :3914) e que depende de haver um **alvo de referência** (chefe) resolvido. Com um chefe de nível 30:

| alvo | `valorPctVida(3153)` | pontuação do 3153 | build resultante |
|---|---|---|---|
| sem alvo resolvido | 0 | 227,88 | `3172,3031,3046,3036,3074` (= a medida ao vivo) |
| Arauto do Vale (10× curva) | 2 835 | 4 055,13 | `3172,3153,3031,3046,3036` |
| Dragão Infernal (12× curva) | 3 402 | 4 820,58 | `3172,3153,3031,3046,3036` |
| Barão Nashor (16× curva) | 4 536 | 6 351,48 | `3172,3153,3031,3046,3036` |

Ou seja: **se o alvo de referência estiver resolvido, o 3153 (rv 0,10) entra na build e o 3074 sai** — mas entra pelo "5% da Vida atual do alvo", não pelo roubo de vida. A build que o Lead mediu ao vivo é exactamente a que sai com `alvoRef = null`, o que indica que naquele momento não havia alvo resolvido. **NAO VERIFICADO** ao vivo qual dos dois casos aconteceu.

**Resposta final ao dono:** sim, a build que está a sair tem roubo de vida (18%, no 3172 e no 3074) — mas **por acidente**: o motor da extensão soma o `rv` com peso 3 e esse peso não pesa nada (0,54 pontos em 2 689,94); a regex que lê "roubo de vida" do texto nunca dispara; e o `efeitosEquipados`/`statsSet` nem sequer somam o `rv`. Se o dono quiser que roubo de vida seja um critério, é preciso dar-lhe escala (o `rv` teria de valer ~500× mais para competir com o AD, ou o modelo de sustain teria de existir — hoje a extensão mede DPS, não sobrevivência).

---

## Anexo — o que NÃO ficou verificado

1. **Não se correu a extensão nem o jogo** (proibido nesta tarefa: sem CDP, sem browser, sem jogar). Todos os números vêm da leitura dos ficheiros + execução offline das funções reais do `automation.js`.
2. A build `3172,3031,3046,3036,3074` foi **dada pelo Lead** (medição ao vivo) e **não foi re-medida** aqui. O que se fez foi reproduzi-la pela fórmula — e a reprodução deu exactamente esse resultado.
3. **NAO VERIFICADO** se `alvoDeReferencia` (automation.js:3894) resolve um chefe na sessão ao vivo — depende de `META.locais`/`META.monstros` e do local lido do DOM. O cenário da secção 5 mostra as duas consequências.
4. **NAO VERIFICADO** que o catálogo que a extensão recebe em execução seja byte-a-byte o `docs/game-src/itens.js`: a extensão importa `https://lolidle.com/js/itens.js` (extension/inject.js:161) e guarda em `META.itens` (automation.js:975); a cópia local é o mesmo gerador (itens.js:1), com os mesmos 108 itens — mas não se comparou com o site (sem rede/browser nesta tarefa).
5. As linhas são da revisão da tabela do topo (sha256 `0ef252888a3e…`, 6 555 linhas). O ficheiro está a ser editado em paralelo (6 447 → 6 529 → 6 555 linhas em ~20 minutos): para reconfirmar qualquer linha, procure o token na secção 3 — os números de linha podem ter deslizado.
