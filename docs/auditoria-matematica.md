# Auditoria da matemática da build — I:\!lolidle.com

**Pedido do dono (verbatim):** *"faz full audit dessas merdas de matematica e corrige tudo levando em conta todas as passivas, todos os numeros do jogo, todos os cenarios de enfrentar as regioes, e quando uma build ideal muda com base no level do personagem e status."*

**Critério do dono para "build ideal" (verbatim):** *"a build nao e so dps nao, meu filho. e tornar possivel enfrentar um boss ou nao, e em quantos segundos. (...) as pocoes ficam caras por ser muito uso, a build ideal muda de novo pra roubo de vida."*
→ o critério é: **(sobrevive?, mata em quantos segundos?, quantas poções e quanto custam em ouro?)**

**Requisito arquitectural do Lead (verbatim do dono):** *"tu entende que isso e pra usar numeros variaveis, que vao nerfar ou serem buffados no jogo, e que os numeros devem serem pegos automaticamente, agora ou daqui 10 anos nesse jogo, certo?"*
→ todo o número que existe no jogo tem de ser **LIDO**, nunca copiado.

---

## Revisões auditadas (o `automation.js` está a ser editado em paralelo)

| ficheiro | revisão | nota |
|---|---|---|
| `extension/automation.js` | auditado a 6 617 linhas (sha256 `0deeee8411b46ce6771275afcc959ab5b05d4f9b2fdd51dc5b4c5c7aff4c32e0`) · **re-verificado a 6 642 linhas (sha256 `e20dc878642719b0d161b8a147d792fa6429b707f4168b5fb22365e5c5debc6f`)** com os mesmos resultados (46/9 passivas, 38/0 constantes) | mudou 4× durante a auditoria (6 317 → 6 606 → 6 617 → 6 642). **As linhas citadas são as da revisão auditada**; o token está sempre citado para reconferir |
| `docs/game-src/motor.js` | 3 792 linhas | fonte da verdade do jogo |
| `docs/game-src/itens.js` | 108 itens | catálogo CRU |
| `extension/inject.js` | 210 linhas | a ponte mundo-MAIN → mundo-isolado |

Ferramenta desta auditoria: **`tools/audit-math.mjs`** (novo, só leitura). Corre com `bun tools/audit-math.mjs tudo` e imprime todas as secções com `file:linha`. Não toca em browser, CDP, portas ou jogo.

---

## 0. Resposta directa à pergunta do dono (duas linhas)

**Hoje o script LÊ 26 blocos de números do jogo** (por `inject.js` → `window.postMessage`: MONSTROS, LOCAIS, POCOES, EXAUSTAO, POCAO_PVP, NOTURNO, FURIOSO, GEMAS, RECALL, GRUPO, NIVEL_MAX, ESPACOS, RODIZIO_CHEFE, MECANICAS, MOCHILA, CICLO, FUSO, NIVEL_DIF, HAB_CHEFE, MODELOS, DICA_ATRIBUTOS, KITS de todos os campeões, BALANCO, ITENS_DADOS, ONDE_ITEM, bonusTwitch/Evento) **e ESCREVE 259 números à mão** (`docs/hardcodes-build.md`) — dos quais **38 constantes verificadas uma a uma nesta auditoria** batem com o motor **hoje** mas nada as mantém sincronizadas, e **6 delas JÁ estão erradas** (o catálogo que o `inject.js:161` manda é o cru, sem os remendos que o motor faz em `motor.js:16-26`).

**Se o jogo buffar a CURVA (vida/dano/armadura por nível) em +20% amanhã**, a extensão continua a usar os coeficientes congelados em `inject.js:133` → subestima a vida e o dano de **todos** os monstros em **16,7%**, prevê o abate 16,7% mais curto, prevê o dano recebido 16,7% mais baixo, compra 16,7% menos poções e pode inverter a decisão "sobrevive?". Medido na tabela §1.5 (Barão nv42: toma 539/s real, a extensão acha 449/s).

---

## 1. A REGRA (Lead): LER vs COPIAR

### 1.1 O que a extensão LÊ do jogo hoje (26 blocos, `inject.js:101-162`)

`monstros` `locais` `balanco` `itens` `ondeItem` `pocoes` `exaustao` `pocaoPvp` `noturno` `furioso` `gemas` `recall` `grupo` `nivelMax` `espacos` `curva`(coeficientes!) `kit` `champ` `rodizio` `mecanicas` `kits`(todos os campeões, com `adBase/adNivel/magia/semMana/adagas/distancia/papel/giroSrc`) `mochila` `ciclo` `fuso` `nivelDif` `habChefe` `modelos` `dicaAtributos` `bonusTwitch` `bonusEvento`.

Além disso a extensão **parseia o TEXTO da passiva** de cada item (`it.efeito`, `valorPassiva`, `automation.js:4074-4142`) — isso é leitura do jogo, mas com **peso nosso** em cima (classe (d), §1.3).

### 1.2 O que a extensão COPIA hoje (38 constantes verificadas com `file:linha`)

`bun tools/audit-math.mjs hardcodes` compara, uma a uma, o valor copiado com o valor vivo do motor:

| constante | extensão | motor | onde (extensão) | onde (motor) |
|---|---|---|---|---|
| Q_MULT C/B/A/S/SS | 0,9/1/1,15/1,35/1,7 | 0,9/1/1,15/1,35/1,7 | `automation.js:3772` | `motor.js:173-179` |
| BONUS_REFINO | 0,12 | 0,12 | `automation.js:1036` | `motor.js:55` |
| cap CDR | 0,4 | 0,4 | `automation.js:1353` | `motor.js:537` |
| cap pen mágica | 0,6 | 0,6 | `automation.js:1353` | `motor.js:529` |
| BARRA_SLOTS | 4 | 4 | `automation.js:64` | `motor.js:900` |
| RAR_IDX.lendario | 2 | 2 | `automation.js:61` | `motor.js:47` |
| POCAO_FB cura/preço | 300/40 · 900/110 · 2200/260 | iguais | `automation.js:886` | `motor.js:262-264` |
| MECANICA (9 multiplicadores) | 3,5 · 2,2 · 2,6 · 2,2 · 1,8 · 0 · 0 · 1,2 · 2,6 | iguais | `automation.js:1529-1539` | `motor.js:3102-3109` |
| VA_BASE_MOTOR | 0,697 | 0,697 | `automation.js:1457` | `motor.js:2056` |
| NIVEL_DIF livre/dano/cap | 4 · 0,15 · 3 | iguais | `automation.js:1547` | `motor.js:1184` |
| RM_MONSTRO (fallback) | 0,6 | 0,6 | `automation.js:1019` | `motor.js:1179` |
| KAT_FB Q rec0/base0/ratio0 | 10 · 80 · 0,45 | iguais | `automation.js:1225` | `motor.js:738` |
| _giro base/nivel/ap/ad | 30 · 19 · 1 · 0,4 | iguais | `automation.js:1238` | `motor.js:737` |
| **inject curva.hp/ad/armadura** | 150 · 9 · 5 | iguais | **`inject.js:133`** | `motor.js:274-276` |
| **inject grupoSpawn base/rand** | 2 · 3 | iguais | **`inject.js:138`** | `motor.js:1124` |
| **inject respawn clear/local** | 1,5 · 1,2 | iguais | **`inject.js:139`** | `motor.js:1625`, `motor.js:3046` |

**Resultado: 38/38 batem hoje, 0 divergem.** É exactamente o problema: *batem por sorte, ninguém os sincroniza*. A única razão pela qual isto não está vermelho é que o jogo não mexeu nestes números desde que foram copiados.

### 1.3 Re-classificação dos 259 hardcodes de `docs/hardcodes-build.md` (critério NOVO: a/b/c/d)

| classe | o que é | quantos | grupos de onde saem |
|---|---|---|---|
| **(a) REGRA DO DONO** — política, não muda com buffs | decisões que o motor não tem | **7** | G21 (5: `refinoMax`, `qIdx<'A'` ×2, gate do refino), G14 (1: `MULT_DESBLOQUEIO` 1,5), G4 (1: `multRar` 0,30 = "épico é melhor que básico") |
| **(b) LIDO DO JOGO** — o número existe no motor, TEM de passar a ser lido | cópias sincronizadas hoje | **103** | G7-ids (34), G8-nomes de campo (6), G9 (2), G10 (5), G11-refino (1), G15 `KAT_FB` (11), G16 `_giro` (4), G17 (2), G18-parcial (6), G20 (30), G23-parcial (2) |
| **(c) CÓPIA MORTA** — subclasse de (b), **JÁ errada hoje** | ver lista abaixo | **8** | catálogo remendado (6) + `tierDe` (1) + regex do rv (1) |
| **(d) HEURÍSTICA NOSSA** — não existe no jogo, não acompanha buff nenhum | precisa de regra do dono | **~141** | G1 (55), G2 (4), G3 (6), G4-resto (3), G5 (41), G6 (28), G12 `tierDe` valor, G13 (1), G18-resto (2), G19 (1), G23-resto (3) |
| | | **259** | (o próprio `docs/hardcodes-build.md` soma **261** nos totais por grupo — §9.1) |

**A lista dos (c) — os urgentes, os que JÁ estão errados:**

| # | o que está errado | onde | prova |
|---|---|---|---|
| 1-6 | O `inject.js:161` manda `I.ITENS_DADOS` (catálogo CRU). O motor REMENDA 6 itens em memória (`motor.js:16-26`) e a extensão nunca vê os remendos. | `inject.js:161` vs `motor.js:16-26` | 2022 `cdr 0.05` AUSENTE · 1006 `regen 3` AUSENTE · 3057 `efeito` AUSENTE · 3108 `cdr 0.05` AUSENTE · 3802 `cdr 0.05` AUSENTE · 4629 `cdr 0.15` AUSENTE |
| 7 | `tierDe` = `qIdx × 10 + refino` — um degrau de qualidade vale 10 refinos. No motor (`motor.js:252`) 1 refino = +12% e 1 degrau B→A = +15% → **1 degrau ≈ 1,25 refinos**. É este número que decide `entraEmDegrade` e `porMelhorBase`. | `automation.js` `tierDe` | `motor.js:252`, `motor.js:55`, `motor.js:173-179` |
| 8 | A regex do roubo de vida do `valorPassiva` era **código morto**: `/([\d,]+)%\s*de roubo de vida/i` — o jogo escreve "Roubo de vida de 12%" (ordem inversa). 0 acertos em 108 itens. **JÁ REMOVIDA pelo outro agente** (`automation.js:4125-4127`, revisão 6 642) | `automation.js:4092` (revisão 6 617) | medido: 0 acertos |

### 1.4 O ponto EXACTO onde o requisito está quebrado: a CURVA

```js
// extension/inject.js:132-133  (mundo MAIN, PODE chamar o motor)
// CURVA são funções (não passam por postMessage) → mando os coeficientes
meta.curva = { hp: [150, 100, 1], ad: [9, 4.8, 0.13], armadura: [5, 1.5], xp: [30, 7], ouro: [8, 3.5] };
```

**Verificado:** `M.CURVA` **É exportada** por `motor.js:273` (`export const CURVA = {`), com `hp` em `motor.js:274`, `ad` em `motor.js:275`, `armadura` em `motor.js:276`, `xp` em `motor.js:277`, `ouro` em `motor.js:278`. `M.NIVEL_MAX` também é exportada (`motor.js:27`, valor 50). O `inject.js` já faz `import('https://lolidle.com/js/motor.js')` na linha 125 e usa `M.MONSTROS`, `M.POCOES`, etc. — **logo `M.CURVA.hp(30)` é chamável hoje, sem expor nada de novo**.

**A correcção estrutural (não implementar aqui — o ficheiro é de outro agente):**
```js
meta.curvaPorNivel = {};
for (let n = 1; n <= M.NIVEL_MAX; n++) meta.curvaPorNivel[n] = {
  hp: M.CURVA.hp(n), ad: M.CURVA.ad(n), armadura: M.CURVA.armadura(n), xp: M.CURVA.xp(n), ouro: M.CURVA.ouro(n),
};
```
e a extensão passa a ler `curvaPorNivel[nivel]` em vez de reconstruir o polinómio (`automation.js` `curva()`).

**O que NÃO está exportado e não se resolve por `M.*`:**
- `grupoSpawn`: `const qtd = 2 + Math.floor(r() * 3)` é **inline** em `motor.js:1124` — não é constante. Ou se expõe no motor, ou o `inject.js` lê por texto, ou fica como regra declarada (é o caso do `inject.js:138`).
- `respawn`: `c.respawn = 1.5` é **inline** em `motor.js:1625` (onda limpa) e `c.respawn = 1.2` em `motor.js:3046` (troca de local). Idem.

### 1.5 O que acontece se o jogo buffar a CURVA em +20% amanhã (medido)

`bun tools/audit-math.mjs curva` — a extensão acha que vê estes números, o jogo tem estes:

| alvo | hp real | hp visto | ad real | ad visto | toma/s real | acha/s | erro |
|---|---|---|---|---|---|---|---|
| Rota Inferior (Tropa Corpo a Corpo) | 590 | 491 | 28 | 23 | 6 | 5 | 17% |
| Rota Superior (Tropa Corpo a Corpo) | 1 441 | 1 201 | 74 | 62 | 17 | 14 | 17% |
| Toca dos Lobos (Lobo Gigante) | 2 376 | 1 980 | 142 | 118 | 33 | 28 | 17% |
| Campo Azul (Krug Anciã) | 4 469 | 3 724 | 151 | 125 | 26 | 22 | 17% |
| Campo Vermelho (Brambleback) | 8 215 | 6 846 | 368 | 307 | 59 | 49 | 17% |
| Rio (Arraia do Rio) | 5 837 | 4 864 | 206 | 172 | 30 | 25 | 17% |
| Fosso do Dragão (filhote) | 6 480 | 5 400 | 351 | 293 | 61 | 51 | 17% |
| Covil do Barão (Criatura do Vazio) | 7 475 | 6 229 | 532 | 443 | 249 | 207 | 17% |
| Arauto do Vale (nv33) | 45 390 | 37 825 | 772 | 644 | 135 | 112 | 17% |
| Dragão Infernal (nv33) | 54 468 | 45 390 | 927 | 772 | 166 | 139 | 17% |
| Barão Nashor (nv42) | 97 824 | 81 520 | 1 408 | 1 173 | 539 | 449 | 17% |

O erro é **uniforme em 16,7%** (`1 − 1/1,2`) porque o coeficiente entra linearmente. Não há zona que safe: **todas as 11 entradas acima passam a mentir na mesma direcção**.

---

## 2. (A) INVENTÁRIO DAS PASSIVAS DOS 108 ITENS

`bun tools/audit-math.mjs inventario`. Contagem sobre o catálogo REAL (`docs/game-src/itens.js`, 108 itens):

| | quantos |
|---|---|
| itens com passiva (texto `efeito` **ou** campo de passiva) | **55** |
| · só com texto `efeito` | 49 |
| · só com campo de passiva, sem texto (1054 `regen` · 3801 `regen` · 3158 `cdr` · 3024 `cdr` · 3009 `regen` · 3020 `penMag`) | 6 |
| itens sem passiva nenhuma (só stats brutos) | 53 |
| itens que o MOTOR lê PELO ID (`tem('id')` / `tem?.('id')`) | **33** |
| entradas escritas à mão em `ITENS_ESPECIAIS` | 34 |
| campos em `CAMPOS_MULT` | 6 |

**Modeladas / não modeladas (46 × 9):**
- **46 itens** têm pelo menos um termo de passiva (texto lido, mapa especial ou multiplicador de fase).
- **9 itens** não têm termo nenhum. Destes, **5 são pontuados pelo stat bruto do campo** (`(it.cdr||0)*w.cdr` em `valorDeFase:4235`, `(it.penMag||0)*w.penMag`, `(it.regen||0)*w.regen`) — portanto NÃO são invisíveis: 3158 (cdr 0,08×300 = 24 pts), 3024 (cdr 0,05×300 = 15), 3171 (cdr 0,15×300 = 45), 3020 (penMag 0,08×700 = 56), 3083 (regen 15×0,6 = 9).
- **4 são genuinamente invisíveis:** 3116 Cetro de Rylai (Geada/lentidão — nada), 1054 Escudo de Doran e 3801 Braçadeira e 3009 Botas da Rapidez (regen com peso 0,6 — 1 a 2 pontos contra os 315 do Rabadon).
- **E há 6 itens que a extensão recebe INCOMPLETOS** porque o `inject.js:161` manda o catálogo cru e o motor remenda em memória (`motor.js:16-26`): **2022** (cdr 0,05), **1006** (regen 3), **3057** (o `efeito` da Lâmina Encantada), **3108** (cdr 0,05), **3802** (cdr 0,05), **4629** (cdr 0,15). Sem o campo, o `valorPassiva` do 4629 cai no termo do texto (15×6 = 90) e o CDR não leva o multiplicador de qualidade/refino; o 2022/3108/3802 valem **zero** de CDR; o 3057 só existe no mapa especial.

### 2.1 Tabela completa (55 itens com passiva) — `vpK`/`vpY` = valor que o `valorPassiva` devolve para Katarina/Yasuo

| id | nome | rar | efeito | vpK | vpY | especial | fase mobs | fase chefe | motor.js | campos |
|---|---|---|---|---|---|---|---|---|---|---|
| 1054 | Escudo de Doran | básico | – | 0 | 0 | – | – | – | – | regen |
| 3801 | Braçadeira Cristalina | épico | – | 0 | 0 | – | – | – | – | regen |
| 3158 | Botas Ionianas da Lucidez | épico | – | 0 | 0 | – | – | – | – | cdr |
| 3024 | Broquel Glacial | épico | – | 0 | 0 | – | – | – | – | cdr |
| 3009 | Botas da Rapidez | épico | – | 0 | 0 | – | – | – | – | regen |
| 3020 | Sapatos do Feiticeiro | épico | – | 0 | 0 | – | – | – | – | penMag |
| 3057 | Fulgor | épico | (remendo do motor) | 0 | 0 | ad | – | – | 1672 | – |
| 3075 | Armadura de Espinhos | lendário | Espinhos | 6 | 6 | tanque | – | – | 1735 | – |
| 3116 | Cetro de Cristal de Rylai | lendário | Geada | 0 | 0 | – | – | – | 1208 | – |
| 3046 | Dançarina Fantasma | lendário | Valsa Espectral | 12 | 36 | ad | 1,6 | – | 1707 | – |
| 3085 | Furacão de Runaan | lendário | Fúria do Vento | 0 | 0 | ad | 1,9 | – | 1718 | – |
| 3065 | Semblante Espiritual | lendário | Vitalidade Ilimitada | 38 | 38 | tanque | – | 1,2 | 1286 | – |
| 6655 | Eco de Luden | lendário | Eco | 0 | 0 | ap | 1,9 | – | 1945 | – |
| 3170 | Marcha Célere | lendário | Passo Ligeiro | 15 | 15 | tanque | – | – | – | esquiva |
| 3171 | Lucidez Escarlate | lendário | Lucidez | 0 | 0 | – | – | – | – | cdr |
| 3173 | Esmagadores Acorrentados | lendário | Correntes | 8 | 8 | – | – | – | – | rmPct |
| 3174 | Mobilização Blindada | lendário | Blindagem | 8 | 8 | – | – | – | – | armPct |
| 3165 | Morellonomicon | lendário | Aflição | 72 | 24 | – | – | – | 1206 | – |
| 3003 | Cajado do Arcanjo | lendário | Pavor | 9 | 9 | ap | – | – | 521 | – |
| 3068 | Égide de Fogo Solar | lendário | Fogo Solar | 6 | 6 | tanque | – | – | 1633 | armPct |
| 3100 | Perdição de Lich | lendário | Lâmina Encantada | 165 | 90 | ap | – | – | 1688/1944 | – |
| 3143 | Presságio de Randuin | lendário | Presságio | 5 | 5 | tanque | – | – | – | armPct |
| 3152 | Explocinturão Hextec | lendário | Explosão Hextec | 45 | 45 | – | – | – | – | apPct |
| 3168 | Caminho Imortal | lendário | Caminho Imortal | 10 | 10 | – | – | – | – | vidaPct |
| 3175 | Sapatos Enfeitiçados | lendário | Feitiço Penetrante | 105 | 15 | – | – | – | – | penMag |
| 3190 | Medalhão dos Solari | lendário | Medalhão | 12 | 12 | – | – | – | – | vidaPct |
| 3742 | Couraça do Defunto | lendário | Rolo Compressor | 0 | 0 | ad | 1,2 | – | 1698 | – |
| 8020 | Máscara Abissal | lendário | Abismo | 16 | 16 | tanque | – | – | – | vidaPct |
| 3071 | Cutelo Negro | lendário | Talhar | 6 | 24 | ad | – | 1,5 | 1705 | – |
| 3102 | Véu da Banshee | lendário | Escudo de Feitiço | 0 | 0 | ap | – | – | 2698 | – |
| 3135 | Cajado do Vazio | lendário | Dissolver | 280 | 40 | ap | – | 1,35 | 529 | – |
| 3172 | Grevas Bélicas | lendário | Ritmo de Guerra | 6 | 54 | ad | – | – | – | adPct |
| 4629 | Ímpeto Cósmico | lendário | Ímpeto | 90 | 90 | – | – | – | – | (cdr no motor) |
| 6653 | Tormento de Liandry | lendário | Tormento | 140 | 20 | – | – | 1,4 | 1207 | – |
| 3083 | Armadura de Warmog | lendário | Coração de Warmog | 0 | 0 | – | – | – | – | regen |
| 3156 | Mandíbula de Malmortius | lendário | Linha da Vida | 5 | 45 | – | – | – | – | adPct |
| 4633 | Criafendas | lendário | Fenda | 45 | 45 | – | – | – | – | apPct |
| 6610 | Céu Dividido | lendário | Choque de Luz | 0 | 0 | ad | 1,35 | – | 1699 | – |
| 6673 | Arco-escudo Imortal | lendário | Salva-vidas | 12 | 12 | ad | – | – | – | vidaPct |
| 663056 | Coroa do Rei Demoníaco | lendário | Coroa Demoníaca | 4 | 36 | – | – | – | – | adPct |
| 664644 | Coroa da Rainha Despedaçada | lendário | Coroa Despedaçada | 54 | 54 | – | – | – | – | apPct |
| 3026 | Anjo Guardião | lendário | Renascimento | 0 | 0 | ad | – | 1,3 | 2729/3737 | – |
| 3053 | Sinal de Sterak | lendário | Pele de Aço | 60 | 300 | ad | – | 1,25 | 2725 | – |
| 3153 | Espada do Rei Destruído | lendário | Gume da Névoa | 15 | 25 | ad | – | 1,45 | 1702 | – |
| 4645 | Chama Sombria | lendário | Chama Feroz | 90 | 15 | – | – | – | 1205 | – |
| 3157 | Ampulheta de Zhonya | lendário | Stasis | 0 | 0 | ap | – | 1,2 | 2722 | – |
| 2501 | Armadura Sangrenta do Suserano | lendário | Tirania | 2 | 10 | tanque | – | – | 514 | – |
| 3036 | Lembranças do Lorde Dominik | lendário | Mata-Gigantes | 60 | 210 | ad | – | 2,2 | 539/1214 | – |
| 3074 | Hidra Raivosa | lendário | Cleave | 80 | 240 | ad | 1,7 | – | 1720 | – |
| 3748 | Hidra Titânica | lendário | Cleave Titânico | 3 | 3 | tanque | 1,5 | – | 1721 | – |
| 6333 | Dança da Morte | lendário | Ignorar a Dor | 0 | 0 | ad | – | 1,25 | 1790/2701 | – |
| 6631 | Quebrapassos | lendário | Golpe Pesado | 176 | 96 | ad | 1,8 | – | 1719 | – |
| 3078 | Força da Trindade | lendário | Lâmina Encantada | 0 | 0 | ad | – | – | 1672 | – |
| 3072 | Sedenta por Sangue | lendário | Escudo Sanguíneo | 0 | 0 | ad | – | – | 1229 | – |
| 3031 | Gume do Infinito | lendário | Golpe Infinito | 120 | 480 | ad | – | 1,7 | 515 | – |
| 3089 | Capuz da Morte de Rabadon | lendário | Obra-Prima Mágica | 315 | 315 | ap | – | – | 522 | – |

### 2.2 Modeladas MAL (o número existe, o peso é que não vem do jogo)

Todos os 46 acima com `vp > 0` são **classe (d)**: o número é lido do TEXTO do jogo (bom), mas multiplicado por um peso nosso (ruim para o critério do dono). Os piores casos medidos:

| item | termo do texto | peso nosso | valor | o que o motor diz |
|---|---|---|---|---|
| 3100 Perdição de Lich | "próximo ataque causa +75%" | ×2,2 (AP) | 165 | o proc **não é 1 por habilidade**: `motor.js:1944` arma, `motor.js:1688` gasta no **próximo ataque básico** → procs/s = min(habilidades/s, ataques/s). O `sim-build.mjs` mede 152 dps na Katarina com a barra real (=1,00× o modelo) e **250 dps** com a barra top-4 (=1,54×). Num campeão que lance mais depressa do que ataca, o 2,2 exagera |
| 3135 Cajado do Vazio | "40% de penetração mágica" | ×7 | 280 | o pen vale o **DPS que ele destrava** contra a armadura do alvo, não um multiplicador fixo. `sim-build` mede o par 3175+4629 vs 3158+4645: +184 a +228 dps em TODA a faixa 0→400 de armadura |
| 3089 Rabadon | "+35% AP total" | ×9 | 315 | +35% de AP é `motor.js:522`; o ×9 não sai de lado nenhum |
| 3031 Gume do Infinito | "críticos +40%" | ×12 (AD) | 480 | `motor.js:515` `danoCritico += 0.4`; o ×12 é nosso. Nota: 480 > 315 do Rabadon **no mesmo campeão** — o Gume vale 1,5× o Rabadon na escala, e num Yasuo com 100% de crítico isso é plausível, mas o número não foi derivado |
| 6631 Quebrapassos | "+80% do AD a todos" | ×6 (AD) + fase 1,8 | 176 → 317 | `motor.js:1719` (a cada 5 s). O valor depende de quantos inimigos alcançados |
| 3065 Semblante | "+25% em toda cura" | ×1,5 | 38 | `motor.js:1286`; 25×1,5 = 37,5 — a cura vale o que salva em poções, não um número de stat |

---

## 3. (B) OS NÚMEROS DO JOGO QUE A EXTENSÃO REESCREVE À MÃO

Os **103 deriváveis** de `docs/hardcodes-build.md`, agora com o ponto EXACTO de onde cada um devia sair (e se o símbolo está exportado):

| # | o que a extensão escreve à mão | onde (extensão) | de onde DEVE sair | símbolo exportado? |
|---|---|---|---|---|
| 1 | `KAT_FB` (Q/W/E/R/G/A/D/F/T/B/M com `rec`, `base`, `ratio`) | `automation.js:1224-1236` | `motor.js:735-771` `HAB_KATARINA` | **NÃO** — `HAB_KATARINA` é `const` local (`motor.js:735`), mas o `KITS` (`motor.js:864-896`) É exportado e o `inject.js:147` já serializa `M.KITS[id].hab` → **o caminho já existe, o fallback é que é uma cópia velha** |
| 2 | `_giro` (30/19/1/0,4) | `automation.js:1238` | `motor.js:737` `P.giro` | **NÃO** exportado, mas o `inject.js:147` manda `giroSrc` (o texto da função) e a extensão já faz regex (`automation.js:1296-1298`) → só os *defaults* são cópia |
| 3 | `Q_MULT` (C/B/A/S/SS) | `automation.js:3772` | `motor.js:173-179` `QUALIDADES[q].mult` | **SIM** (`export const QUALIDADES`) — falta o `inject.js` mandar |
| 4 | `BONUS_REFINO` 0,12 | `automation.js:1036` | `motor.js:55` | **SIM** |
| 5 | cap CDR 0,4 · cap pen 0,6 | `automation.js:1353`, `3234`, `5138` | `motor.js:537` · `motor.js:529` | **SIM** (`reducaoRecarga`/`penMagica` são campos de `atributos()`, mas os caps são literais) |
| 6 | `MECANICA` (9 multiplicadores) | `automation.js:1529-1539` | `motor.js:3102-3109` | **NÃO** — inline em `mecanicaChefe`; `M.HAB_CHEFE` (`motor.js:3069`) É exportado e já vai no meta (`inject.js:137`), mas o **multiplicador** não |
| 7 | `NIVEL_DIF` fallback | `automation.js:1547`, `1652-1653` | `motor.js:1184` `NIVEL_DIF` | **SIM** — e já vai no meta (`inject.js:136`) |
| 8 | `VA_BASE_MOTOR` 0,697 | `automation.js:1457` | `motor.js:2056` `recargaQYasuo` | **SIM** (`export const recargaQYasuo`) |
| 9 | `POCAO_FB` 300/40 · 900/110 · 2200/260 | `automation.js:886` | `motor.js:261-267` `POCOES` | **SIM** — e já vai no meta (`inject.js:128`) |
| 10 | `EXAUSTAO` fallback 1 | `automation.js:894` | `motor.js:41` | **SIM** — já vai no meta |
| 11 | `BARRA_SLOTS` 4 | `automation.js:64` | `motor.js:900` `BARRA` | **SIM** |
| 12 | `RARITY`/`RAR_IDX` (básico/épico/lendário) | `automation.js:22`, `61` | `motor.js:47-48` `raridade`/`NOME_RARIDADE` | **SIM** |
| 13 | `QUAL` `['C','B','A','S','SS']` | `automation.js:23` | `motor.js:180` `ORDEM_QUAL` | **SIM** |
| 14 | `RABADON` `'3089'` | `automation.js:25` | `motor.js:522` | id literal — derivável por `grep tem('...')` |
| 15 | `PRIORIDADE_EXTREMA` (2 ids) | `automation.js:47-50` | `motor.js:515` (3031) e `motor.js:522` (3089) | derivável: são os 2 únicos `tem()` que **multiplicam** |
| 16 | `ITENS_ESPECIAIS` (34 ids) | `automation.js:3994-4032` | bloco `tem()` de `motor.js:504-541` + campos `pct` (`motor.js:501`) | derivável por grep; o **`papel`** é heurística |
| 17 | `CAMPOS_MULT` (6 nomes de campo) | `automation.js:4051` | `motor.js:501` `const pct = { adPct, apPct, vidaPct, armPct, rmPct, esquiva, penMag }` | **SIM** (é literal no `atributos()`) — e **`penMag` já foi acrescentado** (correcção confirmada) |
| 18 | `curva` (coeficientes) | **`inject.js:133`** | `motor.js:273-279` `CURVA` | **SIM** (`export const CURVA`) — ver §1.4 |
| 19 | `grupoSpawn` 2/3 | **`inject.js:138`** | `motor.js:1124` | **NÃO** — inline |
| 20 | `respawn` 1,5/1,2 | **`inject.js:139`** | `motor.js:1625` · `motor.js:3046` | **NÃO** — inline |
| 21 | `tierDe` (escala qualidade×refino) | `automation.js` | `motor.js:252` `(1 + 0.12*ref) * QUALIDADES[qual].mult` | derivável |
| 22 | `procLich` 1 proc/habilidade | `automation.js:1393` | `motor.js:1944` (arma) + `motor.js:1688` (gasta no ataque) | derivável |
| 23 | `statsSet`: `apPct += 0.35` (Rabadon), `lich += 0.75`, `chama`, `liandry` | `automation.js:3229-3232` | `motor.js:522`, `motor.js:1688`, `motor.js:1205`, `motor.js:1207` | derivável |
| 24 | `estimarSet`/`scoreSet`: teto 3× curva + 1,5%/s | `automation.js:3276`, `5390` | `motor.js:1190-1191` + `motor.js:1207` | derivável |
| 25 | `mit` sem `RM_MONSTRO` em 4 sítios | `automation.js` `armMagicaEfetiva` | `motor.js:1179` + `motor.js:1202` | **já corrigido** (confirmado: `automation.js:1019-1021`) |

**Ordem por impacto** (o que dói mais primeiro):
1. **`inject.js:133` curva** — um buff da CURVA afecta **todos** os monstros, chefes e regiões ao mesmo tempo (§1.5: 16,7% de erro uniforme).
2. **O catálogo remendado (`motor.js:16-26`)** — 6 itens que a extensão recebe incompletos (§1.3, classe (c)).
3. **`KAT_FB`** — o fallback do kit inteiro; se o jogo mexer no balanceamento da Katarina, todas as decisões de skill ficam erradas.
4. **`MECANICA`** — 9 multiplicadores que decidem a previsão de morte no chefe; o Barão tem `tentaculos 2,6` e `acido 1,2`.
5. **`Q_MULT` + caps + `POCAO_FB` + `BARRA_SLOTS`** — pequenos, mas todos já têm caminho de meta aberto.
6. **`ITENS_ESPECIAIS`/`CAMPOS_MULT`/`PRIORIDADE_EXTREMA`** — deriváveis por grep, hoje mantidos à mão.

---

## 4. (C) OS 8 CENÁRIOS DE REGIÃO — personagem do snapshot

**Personagem (medido):** `docs/snapshots/player.json` → nível 29, vida 4 476, armadura 164, RM 134, dano 161, poder 1 104, VA 1,16. `docs/snapshots/status.json` → poções vida 405, vidaF 5 328, **vidaS 0** (a Suprema só existe no nível 30, `motor.js:264`). Build vestida: `3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A`.

**Atributos (medidos no painel, NÃO deduzidos):** Força 81 · Vitalidade 3 · Resistência 0 · Agilidade 0 · Foco 0. Os 23,46% de CDR vêm **todos** do Ímpeto 4629+3~A (`0,15 × 1,15 qualidade A × 1,36 refino+3`, `motor.js:255`); o Foco contribui 0 (`motor.js:537`).

**Modelo de stats vs medição** (`tools/sim-chefes.mjs` calibrado): hp 4 536 vs 4 476 (+1,3%) · ad 153 vs 161 (−5,0%) · ap 1 051 vs 1 104 (−4,8%) · arm 158 vs 164 · rm 130 vs 134 · va 1,16 ✓ · cdr 23,46% ✓. **Os dados base de hp/armadura/RM/VA da Katarina NÃO estão em `docs/game-src`** (`motor.js:6` importa `dados-katarina.js`, ausente) — são calibrados com 1 ponto medido (ver §F).

**Regras da luta:** onda = `qtd = 2 + floor(rand×3)` (`motor.js:1124`, média 3), monstros sorteados por peso da região, nível `clamp(nm, nívelJogador−2 … +1)` (`motor.js:1119`), chegada `1,2 + k×0,25 s` (`motor.js:1126`). Chefe: `max(nm₀+2, min(nm₁+2, nível+4))` (`motor.js:1121`). Poção: 1 por segundo (`EXAUSTAO = 1`, `motor.js:41`).

| região | motor.js | nm | onda esperada (3 mobs) | hp total | toma/s | dps no grupo | **MATA em** | poções | **ouro** | hpMin |
|---|---|---|---|---|---|---|---|---|---|---|
| Rota Inferior | 357 | [1,6] | 2× Tropa C.a.C + 1× Tropa Mago nv6 | 1 592 | 20/s | 4 423 | **2,0 s** | 0 | **0** | 4 532 |
| Rota Superior | 359 | [5,13] | 2× Tropa C.a.C + 1× Tropa Mago nv13 | 3 890 | 54/s | 4 343 | **2,8 s** | 0 | **0** | 4 497 |
| Toca dos Lobos | 361 | [10,18] | 3× Lobo Gigante nv18 | 7 129 | 99/s | 4 213 | **4,1 s** | 0 | **0** | 4 384 |
| Campo Azul | 363 | [15,23] | 2× Krug Anciã + 1× Sentinela Azul nv23 | 15 491 | 88/s | 3 860 | **8,0 s** | 0 | **0** | 4 194 |
| Campo Vermelho | 365 | [20,28] | Brambleback + Lobo + Krug nv28 | 17 923 | 156/s | 3 887 | **8,7 s** | 0 | **0** | 3 887 |
| Rio | 367 | [25,33] | 2× Arraia + 1× Larva nv29 | 15 953 | 130/s | 3 693 | **8,3 s** | 0 | **0** | 4 032 |
| Fosso do Dragão | 369 | [30,38] | 2× Dragão filhote + 1× Larva nv30 | 17 415 | 196/s | 3 853 | **8,4 s** | 0 | **0** | 3 638 |
| Covil do Barão | 371 | [40,48] | 2× Criatura do Vazio + 1× Dragão filhote nv40 | 24 150 | 688/s | 1 941 | **22,4 s** | 14×300 + 3×900 | **890** | 2 858 |

**Sobrevive?** Sim em todas as ondas — a pior é o Covil do Barão (hpMin 2 858 de 4 536 = 63%), e mesmo aí não morre. **Nenhuma onda das 8 exige poção** excepto o Barão (17 poções, 890 de ouro).

### 4.1 Os 3 chefes (chance 1,5% por grupo, `motor.js:367/369/371`)

| chefe | nv (regra `motor.js:1121`) | hp | ad | armadura | com a build do snapshot | sem poção |
|---|---|---|---|---|---|---|
| Arauto do Vale | 33 | 45 390 | 772 | 81,8 | **MATA em 26,0 s** com 7 poções (420 ouro) | morre aos 24,4 s |
| Dragão Infernal | 33 | 54 468 | 927 | 87,2 | **MATA em 31,6 s** com 14 poções (700 ouro) | morre aos 18,7 s |
| Barão Nashor | 42 | 97 824 | 1 408 | 122,4 | **MORRE aos 7,95 s** (não mata) | morre aos 7,95 s |

**Contra-prova independente:** `bun tools/sim-chefes.mjs` (ferramenta pré-existente) dá *"katarina ATUAL nv29 → MORRE aos 55,35 s · sobrevive sem poção? não (7,95 s)"* e *"sem poção: morre aos 7,95 s"* — o **7,95 s** bate exactamente. A minha luta discreta e a do `sim-chefes` concordam no essencial.

**O Dragão bate com a medição real:** `docs/snapshots/katarina.json` tem uma luta medida de **35,6 s** com outDps 1 360 e **0 poções**; o modelo dá **31,6 s** (11% curto — o modelo assume "em recarga, sempre", é teto). O dano por golpe do Dragão medido (296) e o modelo (297) batem.

### 4.2 A MELHOR BUILD por região — são DIFERENTES?

4 candidatas, todas medidas com o mesmo modelo de onda:
- **A** = build de MOBS do `montarBuildDe` → `3175,3089,3135,3100,6655` (Luden em vez de Liandry)
- **B** = build de CHEFE do `montarBuildDe` → `3175,3153,3135,3089,6653` (Rei Destruído entra, Lich sai)
- **C** = a build vestida no snapshot → `3175~A,3089+2~B,3100+3~A,3135~A,4629+3~A`
- **D** = a mesma lista do C mas tudo a refino 0/qualidade B (`3175,3089,3135,3100,4629`) — para separar "escolha de item" de "instância melhor"

| região | A mobs | B chefe | C snapshot | D tudo ~B | melhor |
|---|---|---|---|---|---|
| Rota Inferior | 2,2 s / 0 g | 2,35 s / 0 g | 2,0 s / 0 g | 2,1 s / 0 g | C |
| Rota Superior | 3,4 s / 0 g | 3,65 s / 0 g | 2,8 s / 0 g | 3,2 s / 0 g | C |
| Toca dos Lobos | 5,25 s / 0 g | 5,55 s / 0 g | 4,1 s / 0 g | 4,85 s / 0 g | C |
| Campo Azul | 10,85 s / 0 g | 11,05 s / 0 g | 8,0 s / 0 g | 9,8 s / 0 g | C |
| Campo Vermelho | 11,8 s / 0 g | 11,65 s / 0 g | 8,65 s / 0 g | 10,65 s / 0 g | C |
| Rio | 11,3 s / 0 g | 11,2 s / 0 g | 8,3 s / 0 g | 10,2 s / 0 g | C |
| Fosso do Dragão | 11,4 s / 80 g | 11,05 s / 40 g | 8,35 s / 0 g | 10,3 s / 40 g | C |
| Covil do Barão | 31,5 s / 1 340 g | 28,05 s / 1 150 g | 22,4 s / 890 g | 28,2 s / 1 150 g | C |

**Resposta: a melhor build NÃO muda por região na minha medição — a lista que o dono já tem (`3175,3089,3135,3100,4629`) ganha nas 8.** E ganha também contra D (mesma lista, tudo ~B): logo a vantagem do C vem em parte do **`4629+3~A` (refino +3 e qualidade A)**, que o motor escala em TODOS os campos (`motor.js:255`) — a extensão decide a build a refino 0/B, mas o dono tem a peça a +3/A. **Isto é um erro de decisão da extensão: ela compara instâncias desiguais.**

**A build de CHEFE do modelo (B) só é melhor que a de MOBS (A) no Barão** (28,05 s vs 31,5 s) — e em 5 das 8 regiões a A é pior que a B. O multiplicador de fase está a mexer em pouco.

---

## 5. (D) A BUILD IDEAL POR NÍVEL (1 a 50)

### 5.1 O achado principal: o modelo NÃO lê o nível

`montarBuildDe(c, fase)` (`automation.js:4740-4798`) recebe o campeão e a fase — **nunca o nível**. Medido:

```
build do modelo (montarBuildDe) em nv1:  3175,3089,3135,3100,6655   (mobs) / 3175,3153,3135,3089,6653 (chefe)
build do modelo (montarBuildDe) em nv50: IGUAL
```

→ **a build ideal nunca muda com o nível hoje.** O que muda é só o resultado da luta. É exactamente a queixa do dono ("a build ideal muda com base no level").

### 5.2 O que muda de facto: sobrevive / mata em quantos segundos / poções / ouro

**Katarina, build do modelo (AP), contra o Barão** (`bun tools/audit-math.mjs niveis`):

| nv | Barão nv | dps | mata? | poções | ouro em poções | hpMin |
|---|---|---|---|---|---|---|
| 25 | 42 | 286 | não (dps baixo: 342 s > 300) | 0 | 0 | 100% |
| 26 | 42 | 290 | não | 0 | 0 | 100% |
| 27 | 42 | 298 | não | 0 | 0 | 100% |
| 28 | 42 | 364 | não | 1 | 110 | 14,7% |
| 29 | 42 | 462 | não | 1 | 110 | 1,4% |
| 30 | 42 | 559 | não | 111 | **21 210** | 3,8% |
| 31 | 42 | 668 | 146,4 s | 134 | **25 060** | 0,2% |
| 32 | 42 | 772 | 126,7 s | 112 | 18 520 | 14,9% |
| 33 | 42 | 881 | 111,0 s | 96 | 13 860 | 18,0% |
| 35 | 42 | 1 123 | 87,1 s | 73 | 7 870 | 33,0% |
| 38 | 42 | 1 402 | 69,8 s | 53 | 3 810 | 46,7% |
| 40 | 44 | 1 439 | 72,1 s | 53 | 4 090 | 48,0% |
| 45 | 49 | 1 526 | 78,1 s | 63 | 5 140 | 45,7% |
| 50 | 50 | 1 417 | 86,4 s | 68 | 5 830 | 47,1% |

**Yasuo, build do modelo (AD), contra o Barão:**

| nv | Barão nv | dps | mata? | poções | ouro | hpMin |
|---|---|---|---|---|---|---|
| 25 | 42 | 417 | não | 2 | 220 | 3,1% |
| 29 | 42 | 695 | não | 1 | 110 | 20% |
| 30 | 42 | 848 | não | 40 | 5 670 | 5,7% |
| 31 | 42 | 1 005 | não | 71 | 10 320 | 3,3% |
| 32 | 42 | 1 172 | **83,4 s** | 67 | 8 090 | 17,5% |
| 34 | 42 | 1 525 | 64,2 s | 37 | 3 710 | 25,8% |
| 36 | 42 | 1 923 | 50,9 s | 15 | 1 240 | 55,2% |
| 37 | 42 | 2 124 | 46,1 s | 7 | 490 | 64,1% |
| **38** | 42 | 2 337 | **41,9 s** | **0** | **0** | 70,2% |
| 40 | 44 | 2 399 | 43,3 s | 0 | 0 | 66,0% |
| 45 | 49 | 2 550 | 46,7 s | 2 | 150 | 66,3% |
| 50 | 50 | 2 782 | 44,0 s | 0 | 0 | 77,9% |

**Os pontos de viragem medidos:**
1. **Katarina nv30–31**: o Barão passa a ser matável (146 s, 134 poções, **25 060 de ouro**) — o pior custo de toda a curva. O pico de poções acontece exactamente **antes** da build ficar boa.
2. **Katarina nv38**: melhor relação (69,8 s, 53 poções, 3 810) e depois **piora** (nv39+ o Barão sobe de nível mais depressa do que ela).
3. **Yasuo nv32**: primeira vitória (83,4 s, 67 poções).
4. **Yasuo nv38**: **0 poções**. Daqui para cima o roubo de vida (18% entre 3074+3172) cura mais do que o Barão faz (§6.2).
5. **Yasuo nv48+**: continua a 0 poções; a build já não precisa de sustento.

**A conclusão que o dono quer:** a build ideal muda **muito** com o nível — mas não pela lista de itens (o modelo não a muda) e sim pelo **eixo sobrevivência/poções**, que é o critério dele. Entre nv30 e nv38 a Katarina queima **21 000 a 25 000 de ouro** por luta em poções; o Yasuo, com 18% de roubo de vida, chega a **0**.

---

## 6. Os quatro pontos que o dono marcou como em falta

### 6.1 A VORACIDADE DA KATARINA (motor.js:733/736/1789) — CONFIRMADO e quantificado

```
motor.js:733  // todos em volta (Voracidade). Cada abate reduz a recarga da Q, W e E.
motor.js:736  P: { voracidade: 1.5, voracidadeChefe: 5, curaBase: 0.05, ... }
motor.js:1789 if (HPk?.voracidade) for (const t of ['Q','W','E']) d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));
```

**A extensão NÃO tem um único termo de abate em lado nenhum.** O CDR entra só como `cd = cdBase × (1 − cdr)` (`automation.js:1396`, `1435`).

**Recargas do rank 10 com o kit do motor e o CDR medido do dono (23,46%):**

| skill | recarga base | com CDR 23,46% | depois de 1 abate (−1,5 s) | depois de 3 abates (−4,5 s) | depois de 1 abate de CHEFE (−5 s) |
|---|---|---|---|---|---|
| Q (`motor.js:738` `serie(10, −0,35)`) | 6,85 s | 5,24 s | 3,74 s | **0,74 s** | 0,24 s |
| W (`motor.js:741` `serie(14, −0,4)`) | 10,4 s | 7,96 s | 6,46 s | 3,46 s | 2,96 s |
| E (`motor.js:743` `serie(10, −0,4)`) | 6,4 s | 4,90 s | 3,40 s | 0,40 s | 0 s |

**CDR-médio equivalente da Voracidade = cortes totais ÷ duração da luta:**

| cenário | abates | corte total | duração | CDR-médio da Voracidade | CDR de ITEM (4629+3~A) | quem manda |
|---|---|---|---|---|---|---|
| onda do Covil do Barão (medida) | 3 | 4,5 s | 22,4 s | **20,1%** | 23,46% | equiparáveis |
| onda da Rota Inferior | 3 | 4,5 s | 2,0 s | **225%** | 23,46% | **a Voracidade** |
| farm contínuo a 20 abates/min | 20 | 30 s | 60 s | **50,0%** | 23,46% | **a Voracidade (2,1×)** |
| **Barão Nashor** (luta de 100 s) | 1 chefe + **~6 larvas** | 5 s + 6×1,5 s | 100 s | **13,8%** | 23,46% | **o CDR de item** |
| **Barão Nashor** (luta de 30 s) | 1 chefe + ~2 larvas | 5 s + 2×1,5 s | 30 s | **25,4%** | 23,46% | **equiparáveis** |
| **Barão Nashor** (a luta medida, 22,4 s) | 1 chefe + ~1 larva | 5 s + 1,5 s | 22,4 s | **29,0%** | 23,46% | **a Voracidade** |
| Dragão Infernal (luta de 31,6 s) | 1 chefe | 5 s | 31,6 s | **15,8%** | 23,46% | o CDR de item |
| Arauto do Vale (luta de 26 s) | 1 chefe | 5 s | 26 s | **19,2%** | 23,46% | o CDR de item |

**CONFIRMADO, exactamente como o dono disse:** o CDR de item **vale MENOS contra mobs** (dezenas de abates fazem o corte de 1,5 s dominar — 50% contra 23,46%) e **vale MAIS contra o chefe** — com uma correcção importante que a primeira leitura desta auditoria errou:

> **CORRECÇÃO (apanhada pela regra do `AGENTS.md`: *"Ler a LISTA, não o valor"*):** o Barão Nashor **invoca 2 larvas a cada ciclo** (`RODIZIO_CHEFE['Barão Nashor'] = ['invocar','tentaculos','acido']`, `motor.js:3080`; ciclo = `(0+14) + (1,3+9) + (1+9) = 34,3 s`, o mesmo 34,3 s que o `tools/sim-chefes.mjs:1108` já usa para a queimadura). As larvas são `criarMonstro('Larva do Vazio', …, { invocado: true })` (`motor.js:3118`) e o corte da Voracidade (`motor.js:1789`) **NÃO tem guarda `i.invocado`** — só a tarefa (`motor.js:1786`) e a diária o têm. Logo **cada larva abatida também corta 1,5 s da Q/W/E**, para além dos 5 s do abate do chefe.
> Consequência medida: contra o **Barão** a Voracidade vale **13,8% a 29,0%** de CDR-médio (conforme a duração da luta), e **não 5%** como a primeira leitura dizia. Contra o **Dragão** e o **Arauto** (rodízios sem `invocar`) vale **15,8%** e **19,2%**. **A conclusão do dono mantém-se** (o CDR de item vale menos no farm), mas o "vale mais contra o chefe" é **falso para o Barão** — é o chefe onde a Voracidade mais rende, por causa das larvas.

**Impacto numérico no modelo da extensão:** na Q da Katarina, a recarga efectiva na onda de 3 abates é **0,74 s** contra os **5,24 s** que a extensão calcula → o `dpsPorHabilidade` (`automation.js:1367-1405`) subestima a taxa de lançamento da Q em **7,1×**, e o mesmo para o **giro da adaga** que a extensão soma em `giroDps += giro / cd` (`automation.js:1399`).

**NÃO CONFIRMADO (importante):** o dono falou em *"o R reinicia em 2 s"*. **O motor não faz isso.** `motor.js:733` diz literalmente *"Cada abate reduz a recarga da Q, W e E. A R é um canal de 2,5 s que um atordoamento interrompe"* e `motor.js:1789` corta **só** `['Q','W','E']`. Não há nenhum corte da R por abate em `motor.js` (grep `recargas.R` → 0 resultados). Se o dono viu esse número no jogo, é o **texto da passiva** a divergir do código — ver §F.

### 6.2 O ROUBO DE VIDA (rv) — CONFIRMADO: vale 0,038% na pontuação, e o motor usa-o a sério

**Os 3 factos, medidos (na revisão auditada, 6 617 linhas):**
1. **A regex era código morto.** `automation.js:4092` `n(/([\d,]+)%\s*de roubo de vida/i) * 4` → **0 acertos em 108 itens**. O jogo escreve *"Roubo de vida de 12%"* (3074) — ordem inversa. Verificado item a item.
   → **JÁ CORRIGIDO pelo outro agente durante esta auditoria** (revisão 6 642 linhas, `automation.js:4125-4127`): a linha foi **removida**, com o comentário *"REGEX REMOVIDA (auditoria do catalogo REAL, 108 itens): `% de roubo de vida` no TEXTO tem ZERO acertos — era codigo morto"*.
2. **O `readStats` não lia o rv do painel.** `automation.js:1206` casava `^(Dano|Armadura|Vel. ataque|Res. mágica|Poder|Mana|Crítico|Esquiva)(.*)# Auditoria da matemática da build — I:\!lolidle.com
   → **CORRIGIDO PELA METADE** (revisão 6 642, `automation.js:1225`): a lista passou a incluir `|Roubo de vida`, mas **o `player()` continua a não devolver `rv`** (`automation.js:1239` devolve só `nivel, vida, armadura, rm, dano, poder, va`). Ou seja: o valor é **lido do painel e deitado fora**. **FALTA**: acrescentar `rv: (s['Roubo de vida'] || 0) / 100` ao retorno do `player()` e usar esse `rv` (o real, com refino/qualidade) em vez do `rv` do catálogo.
3. **O campo `rv` do catálogo É somado, com peso 1 (mago) / 3 (dano, atirador, tanque)** — `automation.js:3785/3788`, aplicado em `valorDeFase:4268`, `poderItem`, `montarBuildDe:4817`.

**O que o motor faz com o mesmo rv** (`motor.js:1226-1230`): `cura = dano × rv` **só em fonte `ataque`**, ×1,25 com o 3065 (`motor.js:1286`), ×0,65 em PvP (`motor.js:1284`).

| campeão (build do modelo) | cura por rv medida | % da vida por segundo | poções do Barão | ouro em poções |
|---|---|---|---|---|
| Katarina nv20 (rv 0%) | 3/s | 0,09% | **340** | **37 400** |
| Katarina nv32 (rv 0%) | 11/s | 0,22% | 24 | 6 240 |
| Katarina nv38 (rv 0%) | 20/s | 0,35% | 6 | 1 560 |
| Yasuo nv20 (rv 18%) | 47/s | 1,64% | 266 | 29 260 |
| Yasuo nv32 (rv 18%) | 165/s | 3,84% | 12 | 3 120 |
| **Yasuo nv38 (rv 18%)** | **334/s** | **6,65%** | **0** | **0** |
| **Yasuo nv50 (rv 18%)** | **404/s** | **5,71%** | **0** | **0** |

**A troca que o dono descreve, medida:** para a Katarina o melhor item de rv é sempre o **3153** (que junta rv 10% + 5% da vida actual do alvo, `motor.js:1702`):

| nv | build do modelo (rv 0%) | troca | poções | ouro | ganho |
|---|---|---|---|---|---|
| 20 | 3175,3089,3135,3100,6653 · 340 poções · 37 400 g | + 3153 | 253 | 27 830 | **−87 poções, −9 570 g, −93,6 s** |
| 30 | 39 poções · 10 140 g | + 3153 | 28 | 7 280 | −11 poções, −2 860 g, −41,6 s |
| 38 | 6 poções · 1 560 g | + 3153 | 3 | 780 | −3 poções, −780 g, −17,9 s |
| 50 | 9 poções · 2 340 g | + 3153 | 3 | 780 | −6 poções, −1 560 g, −29,8 s |

**O ponto de viragem do roubo de vida, medido:**
- **Yasuo nv38** — a cura (334/s) passa a exceder o dano recebido (229/s): **0 poções para sempre**. Abaixo do nv38 a cura não chega e as poções custam de 3 120 a 29 260 de ouro por luta.
- **Katarina** — com a build AP a cura é sempre 3 a 22/s contra 200 a 800/s de dano recebido: **o rv nunca resolve sozinho**. O que resolve é o 3153 (rv + % de vida), que corta 87 poções no nv20.
- **A "volta" que o dono previu** ("as poções ficam caras por ser muito uso, a build ideal muda de novo pra roubo de vida"): acontece **entre o nv28 e o nv32**, quando o custo em poções passa de 10 000–37 000 de ouro por luta para 3 000–6 000. É aí que um slot de dano deixa de compensar contra um slot de sustento.

**PRECISA DE REGRA DO DONO:** qual é a **taxa de troca entre SEGUNDOS e OURO** — quantos segundos a mais o dono aceita pagar para poupar X de ouro em poções? Sem essa taxa o "ponto de viragem" não tem um número único (nos dados acima, o 3153 ganha em **ambos** os eixos, mas para outros itens há troca: +12,5 s por −6 230 de ouro no nv32 da Katarina).
**PRECISA DE REGRA DO DONO:** a extensão **não compara em lado nenhum** o gasto em poções com o ganho da zona (`CURVA.ouro × MONSTROS.ouro`, `motor.js:278` e `motor.js:280-298`). Qual é a fracção do ouro ganho que pode ir para poções?

### 6.3 AS 13 PASSIVAS DE ESTADO — o que a extensão faz com cada uma

`bun tools/audit-math.mjs estados`. **Todas as 13 têm número no motor; nenhuma tem peso no motor — o peso é decisão do dono.**

| id | nome | o motor faz | a extensão faz |
|---|---|---|---|
| 3057 | Fulgor | Lâmina Encantada: +100% do AD base no ataque depois de uma habilidade (`motor.js:18`, `motor.js:1672`) | só o flag `especial(ad)` ×1,25; o AD base não entra em conta nenhuma |
| 3116 | Cetro de Rylai | Geada: a habilidade deixa o alvo lento 1,5 s (`motor.js:1208`) e a lentidão corta o ataque do monstro para 60% (`motor.js:1726`) | **NADA** — nem termo, nem flag, nem fase |
| 3085 | Furacão de Runaan | +2 inimigos por ataque com 55% do dano (15% a distância, `motor.js:1718`) | flag + fase mobs 1,9 |
| 6655 | Eco de Luden | a cada 6 s a próxima habilidade bate em até 3 por 100 + 10% AP (`motor.js:1945-1949`) | flag + fase mobs 1,9 |
| 3742 | Couraça do Defunto | +40 de dano no próximo ataque a cada 4 s (`motor.js:1698`) | flag + fase mobs 1,2 |
| 3102 | Véu da Banshee | bloqueia UM golpe de monstro a cada 40 s (`motor.js:2698`) | flag só |
| 3083 | Armadura de Warmog | 15 de vida por segundo (campo `regen`) | pontua pelo `regen` com peso 0,6 → **9 pontos** contra 315 do Rabadon |
| 6610 | Céu Dividido | o primeiro ataque em cada inimigo é crítico e cura 6% da vida perdida (`motor.js:1699-1704`) | flag + fase mobs 1,35 |
| 3026 | Anjo Guardião | Renascimento: volta com 50% da vida (`motor.js:2729`) | flag + fase chefe 1,3; **o reviver não entra em nenhuma conta de sobrevivência** |
| 3157 | Ampulheta de Zhonya | Stasis: invulnerável 2,5 s abaixo de 25% de vida (`motor.js:2722`) | flag + fase chefe 1,2; a invulnerabilidade não entra |
| 6333 | Dança da Morte | 30% do dano vira sangramento; abater limpa e cura 15% (`motor.js:2701-2704`, `motor.js:1790`) | flag + fase chefe 1,25 |
| 3078 | Força da Trindade | Lâmina Encantada ×2: +200% do AD base (`motor.js:1672`, `motor.js:1697`) | flag só |
| 3072 | Sedenta por Sangue | a cura do rv que passa da vida máxima vira escudo até 25% (`motor.js:1229`) | flag só |

### 6.3.1 O valor MEDIDO de cada uma — nas unidades do critério do dono (dano recebido por segundo)

Pela regra do `AGENTS.md` (*"dado do jogo modela-se; política pergunta-se"*), **todas as 13 têm número no motor e foram reduzidas a `HP/s` de dano recebido evitado ou a `dano/s` extra** — não a um peso inventado. Referência: **Barão nv42** contra a Katarina do snapshot — básico **539/s** (1 golpe de 1 078 a cada 2 s), pior mecânica 2 500, vida 4 536, luta de 22,4 s.

| id | item | efeito (motor.js) | valor MEDIDO | como |
|---|---|---|---|---|
| 3116 | Rylai | lento 1,5 s por habilidade (`motor.js:1208`) → ataque do monstro a 60% (`motor.js:1726`) | **−129 HP/s** (−24% de todo o dano recebido) | 0,4 habilidades/s × 1,5 s = uptime 0,6; 539 × 0,4 × 0,6 |
| 3102 | Banshee | bloqueia 1 golpe a cada 40 s (`motor.js:2698`) | **−27 HP/s** (−5,0%) | 1 078 por golpe ÷ 40 s |
| 3157 | Zhonya | 2,5 s invulnerável a cada 120 s (`motor.js:2722`) | **−11,2 HP/s** (−2,08%) | 539 × 2,5/120 |
| 3026 | Anjo | 50% da vida a cada 300 s (`motor.js:2729`) | **−7,6 HP/s** | 0,5 × 4 536 ÷ 300 |
| 3083 | Warmog | 15 HP/s contínuos (campo `regen`) | **−15 HP/s** (−2,8%) | direto |
| 3053 | Sterak | escudo de 60% da vida **bónus** abaixo de 30%, a cada 90 s (`motor.js:2725`) | **−0,6 × vidaBónus / 90 s** | o escudo não é dano evitado, é dano adiado — vale 0 se a luta acabar antes |
| 6333 | Dança da Morte | 30% do dano vira sangramento (`motor.js:2701`) + cura 15% da vida perdida por abate (`motor.js:1790`) | **−0 HP/s de pico, +0,15 × vidaPerdida por abate** | adia 30%; a cura por abate é o valor real, e só em farm |
| 6610 | Céu Dividido | 1.º ataque em cada inimigo é crítico + cura 6% da vida perdida (`motor.js:1699-1704`) | **+0,06 × vidaPerdida por inimigo novo** | em farm contínuo é cura real; contra 1 chefe é 1 vez |
| 3072 | Sedenta | a cura do rv que passa da vida máxima vira escudo até 25% (`motor.js:1229`) | **0 até a cura exceder a vida máxima** | com 18% de rv no Yasuo nv50 (404 HP/s) é raro bater no teto |
| 3057 | Fulgor | +100% do AD base no ataque seguinte a uma habilidade (`motor.js:18`, `motor.js:1672`) | **+1,0 × ADbase × min(1, skills/s ÷ ataques/s)** por segundo | é o termo `lamina` do `sim-chefes.mjs:558-559` |
| 3078 | Trindade | +200% do AD base (`motor.js:1672`, `motor.js:1697`) | **+2,0 × ADbase × min(1, skills/s ÷ ataques/s)** | idem, o dobro |
| 3085 | Runaan | +2 inimigos por ataque com 55% (15% a distância) (`motor.js:1718`) | **+1,1 × dano do ataque por ataque** em 3 alvos | em alvo único vale **0** |
| 6655 | Luden | 100 + 10% AP em até 3, a cada 6 s (`motor.js:1945-1949`) | **(100 + 0,1×AP) × alvos / 6 s** | na Katarina nv29 (AP 1 051): 205 × 3 / 6 = **102 dps** em 3 alvos, **34 dps** em 1 |
| 3742 | Couraça | +40 no próximo ataque a cada 4 s (`motor.js:1698`) | **+10 dps** | 40 ÷ 4 |

**Consequência prática:** com estes valores, o **3116 Rylai (−129 HP/s)** é o item defensivo mais forte do catálogo contra um chefe — mais que o Banshee (−27), o Zhonya (−11) e o Anjo (−7,6) **somados** — e a extensão dá-lhe **0**. E o **6655 Luden** rende **102 dps** em 3 alvos contra **34 dps** em 1 alvo: o multiplicador fixo de fase (`1,9`) não distingue estes dois casos.

**PRECISA DE REGRA DO DONO (só isto é política, o resto modela-se):** a **taxa de troca entre SEGUNDOS e OURO** — quantos segundos a mais o dono aceita para poupar X de ouro em poções. Com essa taxa, tudo acima vira uma decisão automática; sem ela, não há um número único.

### 6.4 (3d) AS TRÊS DIVERGÊNCIAS — `montarBuildDe` × `scoreSet` × simulador

Medido com `bun tools/audit-math.mjs divergencia` (Barão, atributos do snapshot).

**Katarina nv29 vs Barão nv42** (hp 97 824, armadura 122,4):

| modelo | build | dps medido pelo simulador | mata? |
|---|---|---|---|
| (1) `montarBuildDe` fase null | `3175,3089,3135,3100,6653` | **484** | não |
| (1b) `montarBuildDe` fase mobs | `3175,3089,3135,3100,6655` | — | — |
| (1c) `montarBuildDe` fase chefe | `3175,3153,3135,3089,6653` | — | — |
| (2) `valorPassiva` top-6 | 3089=315 · 3135=280 · 6631=176 · 3100=165 · 6653=140 · 3031=120 | — | — |
| (3) simulador (`melhoresBuilds`) | `3172,3153,3031,3036,3046` | **1 196** | — |

**divergência 1: (1) vs (3) = ×2,47 de DPS.** As duas listas **não partilham um único item**. O simulador troca todo o núcleo AP (`3175,3089,3135,3100,6653`) por um núcleo **AD/crítico** (`3172 Grevas, 3153 Rei Destruído, 3031 Gume, 3036 Dominik, 3046 Dançarina`).
**Quem está certo: o simulador.** Prova: contra o Dragão Infernal a luta real medida (`docs/snapshots/katarina.json`) dá outDps 1 360, e o simulador prevê 1 340–1 600 para a build vestida — enquanto a lista do modelo (1) dá 484 dps contra o Barão e **não mata**. A razão é estrutural: os ataques básicos da Katarina usam `adEfetivo.ad` (`motor.js:1676`) e o `va` dos itens (`motor.js:534`), e o AD/crítico multiplica isso; o AP só move as habilidades, que têm recargas longas (Q 6,85 s, `motor.js:738`).

**Yasuo nv45 vs Barão nv49** (hp 119 216, armadura 141,3):

| modelo | build | dps | luta |
|---|---|---|---|
| (1) `montarBuildDe` | `3172,3031,3046,3036,3074` | **2 102** | MATA em 56,7 s, 15 poções, 1 170 ouro |
| (1b) fase mobs | `3172,3046,3031,3085,3074` | — | — |
| (1c) fase chefe | `3172,3153,3031,3036,3046` | — | — |
| (3) simulador | `3172,3153,3078,3031,3036` | **6 269** | MATA em 19,0 s, **0 poções**, **0 ouro** |

**divergência 2: (1) vs (3) = ×2,98 de DPS e 37,7 s / 1 170 de ouro de diferença.** A diferença são 2 peças: **sai `3046` Dançarina + `3074` Hidra; entra `3153` Rei Destruído + `3078` Trindade**.
**Quem está certo: o simulador**, e a razão é o `valorPassiva` a valorizar o `3074` (Cleave, "ataques causam 40% do Dano de Ataque", ×6 para AD = 240 pontos) **quando o alvo é único** — o Cleave só bate nos *outros* inimigos (`motor.js:1720`), e contra um chefe não há outros. O `3153` (5% da vida actual do alvo, `motor.js:1702`) e o `3078` (Lâmina Encantada, `motor.js:1672/1697`) rendem contra alvo único e a extensão dá-lhes 25 e 0 pontos.

**divergência 3: `scoreSet`/`melhorSet` vs os outros dois.** `scoreSet` (`automation.js:5360-5394`) usa `base × mit × fatorCdr` com `base = S.ap` para magos e `dano + S.ad` para AD, e o `melhorSet` (`automation.js:5396-5438`) faz uma subida gulosa de 5 passos. Ele **nem sabe o que é um ataque básico**: `statsSet` (`automation.js:3211-3236`) não soma `ad` no ramo mágico nem `va` em ramo nenhum. Comparado com o simulador, o `scoreSet` é o mais pobre dos três: não vê o AD, não vê o `va`, não vê o crítico, não vê o dano por ataque.
**Quem está certo: o simulador.** O `scoreSet` deve ser substituído pela função de DPS (é o que o `tools/sim-build.mjs`/`sim-chefes.mjs` já têm).

**Nota de fidelidade do port:** `tools/sim-chefes.mjs` tem um port do `valorPassiva` (`sim-chefes.mjs:768-803`) que **divergiu da extensão** num ponto: o `sim-chefes` remenda `ITENS['4629'].cdr = 0.15` antes de portar (linha 278), e como o port mantém o `if (it.cdr == null)`, o Ímpeto vale **0** lá e **90** na extensão real. Os pesos (`pesosItem`) batem nos 4 perfis.

---

## 7. (E) AS CORRECÇÕES A FAZER NO MOTOR DA EXTENSÃO — por ordem de impacto

> **NÃO implementadas** (o `extension/` é de outro agente). Cada uma traz o número que a justifica e o `file:linha`.

| # | correcção | impacto medido | onde |
|---|---|---|---|
| **1** | **Ler a CURVA do jogo por nível** em vez de mandar coeficientes copiados: `meta.curvaPorNivel[n] = { hp: M.CURVA.hp(n), ad: M.CURVA.ad(n), armadura: M.CURVA.armadura(n), xp: M.CURVA.xp(n), ouro: M.CURVA.ouro(n) }` para `n = 1..M.NIVEL_MAX`. **`M.CURVA` está exportada e é chamável** (`motor.js:273-279`), `M.NIVEL_MAX` também (`motor.js:27`). | um buff de +20% na CURVA faz a extensão **subestimar vida e dano de TODOS os monstros em 16,7%** (§1.5: Barão nv42 — toma 539/s real, a extensão acha 449/s) e comprar 16,7% menos poções | `inject.js:133` → `motor.js:273-279` |
| **2** | **Mandar o catálogo do MOTOR, não o cru**: `meta.itens = Object.values(M.ITENS)` em vez de `I.ITENS_DADOS`. | 6 itens chegam incompletos à extensão: 2022/3108/3802 valem **0** de CDR, 1006 vale **0** de regen, 3057 não tem o `efeito` (só o flag), 4629 não leva qualidade/refino no CDR | `inject.js:161` → `motor.js:16-26` |
| **3** | **Modelar a Voracidade**: somar o corte de `1,5 s × abates` (e `5 s × abates de chefe`) às recargas de Q/W/E. | a Q com 3 abates tem recarga efectiva **0,74 s** contra os **5,24 s** que a extensão calcula → o DPS do giro e da Q na onda está subestimado até **7,1×**; o CDR de item passa a valer 23,46% contra os **50%** que a Voracidade dá no farm (§6.1) | `automation.js:1396`, `1435`, `1399` ← `motor.js:736`, `motor.js:1789` |
| **4** | **Ler o rv** — (a) `Roubo de vida` no regex do `readStats` **feito**; (c) a regex morta do `valorPassiva` **removida**; **FALTA (b) devolver `rv` no `player()`** (`automation.js:1239` lê-o do painel e não o devolve) e **(d) subir o peso**. | o rv vale hoje **0,038%** do valor do Rabadon (0,12 contra 315) e a regex tem **0 acertos em 108 itens**; o mesmo rv, no motor, vale **87 poções e 9 570 de ouro** no nv20 (§6.2) | `automation.js:1206`, `1213-1221`, `4092`, `3785/3788` ← `motor.js:538`, `motor.js:1226-1230` |
| **5** | **Modelar a Geada do 3116 Rylai**: a lentidão de 1,5 s por habilidade corta o ataque do monstro para 60% (`motor.js:1726`). | é a **única passiva com valor 0 na extensão que muda o dano RECEBIDO**: com 0,4 habilidades/s o uptime é ~0,6 → **−24% de dano recebido** | `automation.js` (não existe) ← `motor.js:1208`, `motor.js:1726` |
| **6** | **Pôr a cura no cálculo de sobrevivência**: a extensão **nunca** soma cura contínua. O giro da Katarina cura `(0,05 + D.curaGiro) × dano do giro` (`motor.js:2169-2170`) e a Sede cura 30% (`motor.js:1685`). | Katarina: cura medida de **3 a 22 HP/s** (0,09%–0,35% da vida/s) — pequena mas real. Yasuo com rv 18%: **47 a 404 HP/s**; no **nv38** a cura (334/s) excede o dano recebido (229/s) → **0 poções** em vez das 19 do nv38 sem cura (§6.2) | `automation.js` `avaliar`/`estimarLuta` ← `motor.js:1226`, `motor.js:2169` |
| **7** | **Substituir o `montarBuildDe` aditivo por DPS medido** (a função já existe no `tools/sim-build.mjs`/`sim-chefes.mjs`). | **(1) vs (3): ×2,47 de DPS na Katarina nv29** (484 → 1 196) e **×2,98 no Yasuo nv45** (2 102 → 6 269); no Yasuo são **37,7 s e 1 170 de ouro** de diferença na mesma luta (§6.4) | `automation.js:4740-4798` |
| **8** | **Corrigir a escala `tierDe`**: `qIdx × 10 + refino` diz que 1 degrau de qualidade = 10 refinos. O motor diz `(1 + 0,12×ref) × QUALIDADES[qual].mult` (`motor.js:252`) → 1 degrau B→A (15%) ≈ **1,25 refinos**. | é este número que decide `entraEmDegrade` e `porMelhorBase` — está **10× maior do que o motor** e é o **item (c) nº 7** da lista dos já errados | `automation.js` `tierDe` ← `motor.js:252`, `motor.js:55`, `motor.js:173-179` |
| **9** | **Dar AD/VA/crítico ao `scoreSet`/`statsSet`** (ou substituí-los). `statsSet` (`automation.js:3211-3236`) soma `ap` e `cdr` e `pen`, mas **nunca `ad`, `va` nem `critico`**; `scoreSet` faz `base = S.ap` no ramo mágico. | a lista que o `melhorSet` recomenda é cega ao ataque básico — que na Katarina nv29 é `auto 197 dps` de 2 140 no single-target (9%) e no Yasuo é a maior parte do DPS | `automation.js:3211-3236`, `5360-5394` |
| **10** | **Comparar instâncias justas**: a extensão decide a build a refino 0/qualidade B, mas o dono tem `4629+3~A` (o motor escala **todos** os campos por `(1 + 0,12×ref) × QUALIDADES[qual].mult`, `motor.js:255`). Medido: a mesma lista a ~B faz o Barão em 28,2 s / 1 150 g; com o `4629+3~A` faz **22,4 s / 890 g** (§4.2). | a extensão subestima o próprio equipamento que já tem e pode propor trocas que são downgrades | `automation.js:4756-4766` (o `poder` não lê qualidade/refino) ← `motor.js:255` |
| **11** | **Fazer a build depender do NÍVEL**: `montarBuildDe(c, fase)` nunca recebe o nível. Medido: a lista é **idêntica do nv1 ao nv50**. | o critério do dono é sobrevive/segundos/poções, e esses mudam **muito** com o nível: a Katarina queima **21 210 de ouro** em poções no nv30 e **3 810** no nv38; o Yasuo chega a 0 no nv38 (§5.2) | `automation.js:4740`, `4720` |
| **12** | **Ler do META os 5 blocos que já têm caminho aberto**: `Q_MULT` ← `QUALIDADES`; `MECANICA` ← multiplicadores de `mecanicaChefe` (exige expor no motor ou mandar `HAB_CHEFE` completo); `KAT_FB` ← `M.KITS[id].hab` (já vai no meta; o fallback é que é cópia); caps 0,4/0,6; `POCAO_FB`. | todos batem hoje (38/38 verificados) mas **nada os sincroniza**; o `KAT_FB` é o kit inteiro da Katarina | `automation.js:3772`, `1529-1539`, `1224-1236`, `1353`, `886` |

---

## 8. (F) O QUE NÃO CONSEGUI VERIFICAR

1. **Os stats base da Katarina e do Yasuo NÃO estão no repositório.** `motor.js:4` importa `dados-yasuo.js` e `motor.js:6` importa `dados-katarina.js`; **nenhum dos dois existe em `docs/game-src/`** (também falta `dados-ezreal.js`, `dados-lux.js`, `dados-taric.js`, `dados-zac.js` — é por isso que o motor não é importável). Os valores usados (`tools/sim-chefes.mjs:339-344`) são **CALIBRADOS**: o Yasuo com 6 setups medidos (erro ≤ 0,5 em hp/armadura/RM e ≤ 1,0 em AD) e a **Katarina com 1 único ponto medido (nv29)**, com erro de **−4,8% em AP e −5,0% em AD**. Todas as conclusões que dependem do DPS absoluto da Katarina herdam esse erro.
2. **O "R reinicia em 2 s" que o dono citou NÃO EXISTE no motor.** `motor.js:1789` corta só Q/W/E e `motor.js:733` escreve-o por extenso. Não sei se o texto da passiva no jogo diz outra coisa, nem se o dono viu isso no jogo. **Preciso que o dono confirme**: se o jogo realmente reinicia a R em 2 s por abate, é uma **divergência entre o texto e o código do jogo** e tem de ser reportada ao dono do jogo, não modelada na extensão.
3. **A composição da onda é aleatória** (`qtd = 2 + floor(rand×3)`, `motor.js:1124`; tipo sorteado por peso, `motor.js:1123`). Usei a **média 3** com repartição proporcional aos pesos. Os cenários com 2 ou 4 mobs não foram corridos, nem a variante **noturna** (`NOTURNO`, `motor.js:1096`, +40% hp e +25% ad) nem a **furiosa** (`FURIOSO`, `motor.js:1106`, hp ×4, ad ×1,5, as ×1,15).
4. **O `lutarChefe` do `tools/sim-chefes.mjs` NÃO aplica o `healS` ao hp** — passa-o à estratégia mas nunca faz `hp += healS*dt`. Por isso os números de cura da §6.2 saem do **modelo contínuo** que escrevi em `tools/audit-math.mjs` (`lutaContinua`), não do simulador discreto. Os dois concordam no essencial (o "morre aos 7,95 s" do Barão bate exactamente), mas a contagem de poções com cura é do meu modelo.
5. **Não consegui correr o `automation.js` ao vivo** dentro do stub de DOM (`tools/testes/dom-stub.mjs` existe e funciona, mas ligar o `META` real — catálogo + kits + locais — e chamar as funções internas não caberia no tempo desta auditoria). O `montarBuildDe` que usei é uma **réplica** (`tools/audit-math.mjs` `montarBuildDeReplica`) validada contra os pesos lidos do ficheiro (batem nos 4 perfis) e contra o `valorPassiva` (port linha a linha). Os multiplicadores de fase foram lidos do `PESO_FASE` por regex. **Se algum deles tiver sido editado enquanto a auditoria corria, a réplica está desactualizada** — reconferir com o token.
6. **A contagem do `docs/hardcodes-build.md` não fecha**: os totais por grupo somam **261**, não os **259** do cabeçalho. A diferença de 2 está nos grupos G6 (`valorPassiva`, 28) e G23 (`scoreSet`, 5) — o G6 lista 26 linhas + um `PLACEHOLDER_REGRAS_AP`, e o G23 lista 6 valores com o cabeçalho a dizer 5. Não recontei item a item para não inventar.
7. **PvP, Arena e Runeterra ficaram de fora.** `CURA_PVP = 0,65` (`motor.js:1284`), `POCAO_PVP = { cura: 0,3, exaustao: 6 }` (`motor.js:43`), `ARENA.bonus = 1,3` (`motor.js:412`), `papel.recebidoArena` (`motor.js:2697`) — nada disto foi analisado.
8. **O inventário real do dono não foi lido** (mochila/cofre/mercado): só a build equipada no snapshot. As conclusões de "melhor build" assumem que ele **consegue obter** a peça — o `sim-chefes.mjs` também assume isso.
9. **O refino/qualidade exactos de cada peça da build medida** só são conhecidos para as 5 equipadas (`3175~A`, `3089+2~B`, `3100+3~A`, `3135~A`, `4629+3~A`).
10. **A hipótese do Lead de que o `M.CURVA` não seria chamável foi REFUTADA** — é chamável (§1.4). O que **não** é chamável nem exportado é o `grupoSpawn` (`motor.js:1124`) e o `respawn` (`motor.js:1625`, `motor.js:3046`), ambos inline.

---

## 9. Como reconferir tudo

```bash
bun tools/audit-math.mjs tudo          # todas as secções
bun tools/audit-math.mjs inventario    # §2 (passivas)
bun tools/audit-math.mjs rv            # §6.2
bun tools/audit-math.mjs voracidade    # §6.1
bun tools/audit-math.mjs estados       # §6.3
bun tools/audit-math.mjs divergencia   # §6.4
bun tools/audit-math.mjs regioes       # §4
bun tools/audit-math.mjs niveis        # §5
bun tools/audit-math.mjs rvponto       # §6.2 (ponto de viragem)
bun tools/audit-math.mjs hardcodes     # §1.2/§1.3
bun tools/audit-math.mjs curva         # §1.5

bun tools/sim-build.mjs                # simulador de DPS (pré-existente)
bun tools/sim-chefes.mjs               # simulador de chefes (pré-existente)
node tools/testes/run.mjs              # banco de regressão (sem browser/CDP)
```

**Limitações da ferramenta, declaradas:** `tools/audit-math.mjs` é **só leitura**; não toca em browser, CDP, portas 9224/9233 nem no jogo. A réplica do `montarBuildDe` é uma cópia — se o `automation.js` mudar, a réplica tem de ser reconferida contra o token citado em cada linha. Todas as secções citam o `sha256` da revisão auditada no cabeçalho da saída.

---

## 10. Resumo de uma página

| pergunta do dono | resposta medida |
|---|---|
| **Quantas passivas dos 108 itens estão modeladas?** | **46 com termo**, 9 sem termo (5 delas pontuadas pelo stat bruto, **4 invisíveis**: 3116 Rylai, 1054, 3801, 3009) — mais **6 itens que chegam incompletos** à extensão. 55 dos 108 itens têm passiva. |
| **Quantos números o script lê do jogo?** | **26 blocos** por `postMessage` (`inject.js:101-162`) + o texto da passiva de cada item. |
| **Quantos escreve à mão?** | **259** (`docs/hardcodes-build.md`); **38 constantes** verificadas uma a uma nesta auditoria — todas batem **hoje**, **7 já estão erradas** (6 itens do catálogo remendado + `tierDe`); a 8.ª (a regex morta do rv) foi removida pelo outro agente durante a auditoria. |
| **Se o jogo buffar a CURVA +20%?** | a extensão subestima vida e dano de **todos** os monstros em **16,7%**, prevê abates 16,7% mais curtos, compra 16,7% menos poções. **Não se safa nenhuma zona.** |
| **Sobrevive às 8 regiões?** | **sim a todas as ondas** (a pior, o Covil do Barão, sai com 63% da vida e 890 de ouro em 17 poções). Os chefes: Arauto em 26,0 s / 7 poções; Dragão em 31,6 s / 14 poções; **Barão: morre aos 7,95 s**. |
| **A melhor build muda por região?** | **não na minha medição** — a lista que o dono já tem ganha nas 8 (mas a comparação é injusta: ele tem o `4629+3~A`, a extensão decide a ~B). |
| **A melhor build muda por nível?** | **o modelo nunca a muda** (lista idêntica do nv1 ao nv50). O que muda é sobrevive/segundos/poções: a Katarina queima **21 210 de ouro** no nv30 e **3 810** no nv38; o Yasuo chega a **0 poções** no nv38. |
| **O CDR de item vale menos contra mobs?** | **SIM.** CDR-médio da Voracidade: **50%** no farm (20 abates/min) contra **23,46%** do item. Contra o chefe: **15,8%** (Dragão, 31,6 s) · **19,2%** (Arauto, 26 s) · **13,8%–29,0%** (Barão, que invoca larvas que também cortam 1,5 s cada). |
| **O roubo de vida é essencial?** | **SIM.** Vale **0,038%** da pontuação hoje; no motor vale **87 poções / 9 570 de ouro** no nv20 e é o que leva o Yasuo a **0 poções** a partir do nv38. |
