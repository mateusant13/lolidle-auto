# Auditoria dos hardcodes da matemática de build e de equipar itens

**Ficheiro auditado:** `extension/automation.js`
**Revisão:** sha256 `9486253a81ff519d368e9c224b823004cdd40f6b9d0ab97f0baab5b1a224249e` (6317 linhas)
**Data:** 2026-10-14
**Fonte da verdade do jogo:** `docs/game-src/motor.js` e `docs/game-src/itens.js` (lidos como texto; o motor **não é importável** porque `motor.js:3-8` importa `dados-ezreal.js`, `dados-yasuo.js`, `dados-lux.js`, `dados-katarina.js`, `dados-taric.js` e `dados-zac.js`, e nenhum desses ficheiros existe em `docs/game-src/`).
**Medições reais usadas:** `docs/snapshots/player.json`, `docs/snapshots/katarina.json`, `docs/snapshots/skills.json`.

> **AVISO (importante):** o `automation.js` está a ser reescrito por outro subagent ENQUANTO esta auditoria é lida — durante a auditoria passou por 6 165, 6 255, 6 309 e 6 317 linhas. Cada linha da tabela tem o **token** para reconfirmar (`grep -n`); o número é um instantâneo da revisão acima.
>
> O `automation.js` está a ser editado em paralelo (mudou de 6 165 para 6 317 linhas durante a auditoria). **As linhas abaixo são da revisão acima.** Para reconfirmar qualquer uma, procure o token indicado na coluna "token" (`grep -n "<token>" extension/automation.js`).

---

## 1. O número que o dono pediu

**259 hardcodes** na matemática de build e de equipar itens (1 hardcode = 1 número ou 1 entrada de tabela escrita à mão, não cada dígito):

| Classe | Quantos | % | O que é |
|---|---|---|---|
| **(a) NECESSÁRIO** | **5** | 2% | Regra do dono (não há como derivar do jogo) |
| **(b) DERIVÁVEL** | **103** | 40% | O jogo TEM o número; está re-escrito à mão na extensão e pode divergir em silêncio |
| **(c) HEURÍSTICA MINHA** | **151** | 58% | Invenção nossa; o motor não tem esse número em lado nenhum |
| **Total** | **259** | 100% | |

A leitura honesta: **a maior parte (58%) da matemática da build não é matemática do jogo, é gosto meu convertido em número.** Os 40% deriváveis são pior que os heurísticos: parecem "do jogo" mas são cópias que ninguém sincroniza (o `KAT_FB`, o `MECANICA`, a `POCAO_FB`, os caps 0,4/0,6, o `Q_MULT`…).

E há um problema de desenho que a contagem não mostra: **a mesma passiva é valorizada três vezes por três mecanismos diferentes** (`valorPassiva` pelo texto, `PESO_FASE.itens` por fase e `multEsp` por ser "especial") — ver §4.

---

## 2. Tabela completa, por grupo

Legenda da coluna "deveria ser": **(a)** não há fonte no jogo · **(b)** sai do motor (file:linha indicado) · **(c)** é gosto meu, assumido.

### G1 — Pesos de stat por perfil — `pesosItem` — **55 valores** — (c) HEURÍSTICA

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3623 | `perfil === 'tanque'` | ad 0,2 · ap 0,3 · va 50 · critico 0 · rv 1 · vida 0,7 · armadura 3 · rm 3 · cdr 200 · mana 0,01 · regen 0,5 | (c) não existe no motor: o motor não tem "pesos"; converte stat→dano em `atributos()` (motor.js:492-544) e `golpear()` (motor.js:1192-1234). O derivável seria **dano por ponto de stat** (ex.: 1 de AP vale `ratio/recarga` do kit), não um peso fixo |
| 3624 | `perfil === 'mago'` | ad 0 · ap 1,2 · va 80 · critico 0 · rv 1 · vida 0,15 · armadura 0,3 · rm 0,3 · cdr 300 · mana 0,03 · regen 0,6 | idem |
| 3625 | `perfil === 'suporte'` | ad 0,4 · ap 0,8 · va 60 · critico 0 · rv 2 · vida 0,4 · armadura 1,2 · rm 1,2 · cdr 300 · mana 0,02 · regen 0,6 | idem (e note-se: **nenhum campeão do motor cai neste perfil** — `perfilDe` nunca devolve 'suporte', ver G2) |
| 3626 | `perfil === 'atirador'` | ad 1,3 · ap 0 · va 400 · critico 500 · rv 3 · vida 0,03 · armadura 0,15 · rm 0,15 · cdr 120 · mana 0,01 · regen 0,2 | idem |
| 3619 | `// dano` (default) | ad 1,4 · ap 0,9 · va 350 · critico 400 · rv 3 · vida 0,03 · armadura 0,15 · rm 0,15 · cdr 180 · mana 0,01 · regen 0,2 | idem |

### G2 — Classificação de perfil — `perfilDe` — **4 valores** — (c) HEURÍSTICA

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3604 | `c.magia` | `dano < 1.0` OR `receb <= 0.66` → tanque | (c) o motor TEM os números (`papel.dano`/`papel.recebido` por campeão, motor.js:870-894) mas o **corte** (1,0 / 0,66) é meu. O derivável é usar `papel` direto na conta de dano (o motor já o faz em motor.js:1212) em vez de classificar em 4 caixas |
| 3604 | `c.magia` | 0,66 | idem |
| 3605 | `receb <= 0.62` | 0,62 → tanque | idem |
| 3604 | `dano < 1.0` | 1,0 | idem |

### G3 — Peso de classe do item — `pesoClasse` / `valorDeFase` / `montarBuildDe` — **6 valores** — (c)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3643 | `ofensivo === 0` | item só-defensivo num ofensivo vale **0,3** | (c) invenção. O motor não desvaloriza defesa de mago |
| 3646 | `cl === (c.magia ? 'ap' : 'ad')` | item da classe errada vale **0,12** | (c) invenção. O derivável: o item da classe errada vale **o que ele soma de dano** — num mago, 75 de AD valem `0,4 × ad` na E da Katarina (motor.js:744) e ~0 em magias; não é uma constante, é 0 a 0,4 conforme o kit |
| 4025 | `const multClasse` | 0,12 (2.ª cópia) | idem — **duplicado** |
| 4531 | `const multClasse` | 0,12 (3.ª cópia) | idem — **duplicado** |
| 4023 | `const multDef` | 0,3 (2.ª cópia) | idem — **duplicado** |
| 4533 | `const multDef` | 0,3 (3.ª cópia) | idem — **duplicado** |

### G4 — Multiplicadores de decisão — `valorDeFase` — **4 valores** — (c)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 4033 | `const multRar` | `1 + 0,30 × degrau` (0,30) | (c) invenção. O motor NÃO tem multiplicador de raridade nos stats: a raridade só muda a **tabela de drops** (motor.js:1143-1163) e o preço de venda (motor.js:257). O degrau do dono ("épico é melhor que básico") é regra, mas o **0,30** é meu |
| 4036 | `const multEsp` | especial da minha classe **1,25** | (c) invenção (e é o 3.º mecanismo a valorizar a mesma passiva — §4) |
| 4036 | `const multEsp` | especial da classe errada **0,10** | (c) invenção |
| 4000 | `s += 45` | dois itens da mesma classe de dano **+45** | (c) invenção pura (o comentário no código diz "análise minha, não número do motor") |

### G5 — Peso de fase — `PESO_FASE` — **41 valores** — (c) HEURÍSTICA

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3685 | `mobs:` `stat:` | 11 multiplicadores (va 1,4 · critico 1,1 · cdr 1,15 · ad 1 · ap 1 · rv 1 · vida 0,9 · armadura 0,85 · rm 0,85 · mana 1 · regen 1) | (c) invenção. O que o motor TEM: `MONSTROS` (motor.js:280-298: mobs hp 0,6-2,2× e armadura 0,3-1,6×; chefes hp 10-16× e armadura 1,5-1,8×). O derivável é usar o multiplicador do monstro no cálculo do alvo, não o peso do stat |
| 3705 | `chefe:` `stat:` | 11 multiplicadores (va 1 · critico 1,15 · cdr 1 · ad 1,05 · ap 1,05 · rv 1,2 · vida 1,3 · armadura 1,25 · rm 1,25 · mana 1 · regen 1,1) | idem |
| 3687-3701 | `itens:` (mobs) | 8 multiplicadores: 3085→1,9 · 6631→1,8 · 3074→1,7 · 3748→1,5 · 3046→1,6 · 6610→1,35 · 6655→1,9 · 3742→1,2 | (b/c) **derivável em parte**: o motor TEM o número do efeito (motor.js:1698-1721), e a simulação `tools/sim-build.mjs` calcula o dano real de cada um. O multiplicador escrito à mão é uma **calibração** (o próprio comentário em 3684 admite: "O multiplicador é a minha CALIBRAÇÃO") |
| 3707-3717 | `itens:` (chefe) | 11 multiplicadores: 3036→2,2 · 3031→1,7 · 3071→1,5 · 3153→1,45 · 6653→1,4 · 3135→1,35 · 3065→1,2 · 6333→1,25 · 3026→1,3 · 3053→1,25 · 3157→1,2 | idem |

### G6 — Valor da passiva — `valorPassiva` — **28 multiplicadores** — (c) HEURÍSTICA

A função está em `valorPassiva` (linhas 3852-3919 nesta revisão) e cada linha parseia um número do **texto do motor** (`it.efeito`) — isso é bom e é derivável — mas multiplica por um peso meu. São 28 termos:

| linha | token (trecho do regex) | peso | comentário |
|---|---|---|---|
| 3892 | `Poder de Habilidade(?!\s*total em)` | ×9 | |
| 3873 | `de penetração mágica` | ap?7:1 | |
| 3874 | `queimam o alvo` | +140/+20 | Liandry |
| 3875 | `menos de 40% de Vida` | +90/+15 | Chama Sombria |
| 3876 | `próximo ataque causa` | ap?2.2:1.2 | **Lich: o 2,2 é o multiplicador fixo que o dono questionou** |
| 3877 | `Dano de Ataque total em` | ap?1:9 | |
| 3878 | `de roubo de vida` | ×4 | |
| 3879 | `de Velocidade de Ataque` | ap?2:6 | |
| 3880 | `quem te ataca recebe` | tank?70:6 | Espinhos |
| 3881 | `Resistência Mágica total em` | tank?3:0.5 | |
| 3882 | `Armadura total em` | tank?3:0.5 | |
| 3890 | `de Armadura total` | tank?3:0.5 | ordem alternativa do texto |
| 3891 | `Resist[êe]ncia M[áa]gica total` | tank?3:0.5 | idem |
| PLACEHOLDER_REGRAS_AP |
| 3879 | `na recarga` (só se `it.cdr == null`) | ×6 | |
| 3901 | `de esquiva` | ×3 | |
| 3903 | `Dano de Ataque total` | ap?1:9 | |
| 3908 | `Vida m[áa]xima` | tank?6:2 | |
| 3905 | `em toda cura recebida` | ×1,5 | |
| 3914 | `acertos cr[íi]ticos causam` | ap?3:12 | Gume do Infinito |
| 3918 | `penetra[çc][ãa]o de armadura` | ap?2:7 | |
| 3919 | `reduz a Armadura do alvo em` | ap?1:4 | |
| 3920 | `da Vida atual do alvo` | ap?3:5 | |
| 3922 | `ataques causam` | ap?2:6 | |
| 3923 | `da sua Vida m[áa]xima` | tank?5:2 | |
| 3924 | `habilidades causam` | ap?6:2 | |
| 3925 | `da sua Mana m[áa]xima` | ×3 | |
| 3926 | `da Vida b[ôo]nus` | ap?1:5 | |

**O que deveria ser (b):** o valor da passiva em **dano por segundo**, calculado como o motor o calcula — é exactamente o que `tools/sim-build.mjs` já faz para o Lich, o Luden, a Liandry, a Chama Sombria, o Morellonomicon, o Gume do Infinito, o Rabadon, a pen mágica e a pen de armadura. Exemplo medido na Katarina: o Lich vale **152 dps** (barra real W/Q/R/A) e não um "165 de valor" — e o mesmo 165 é atribuído à Lux como se ela lançasse tão depressa como a Katarina.

### G7 — Tabela de itens especiais — `ITENS_ESPECIAIS` — **34 entradas** — (b) DERIVÁVEL + (c) no rótulo

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3780-3818 | `const ITENS_ESPECIAIS = [` | 34 linhas `{ id, papel, tipo, motivo, fonte }` | **(b) o id é 100% derivável**: são os itens que o motor lê PELO ID — `grep "tem('[0-9]+')" motor.js` devolve a lista, e cada linha já cita a fonte. O **`papel`** (`ad`/`ap`/`tanque`/`neutro`) é (c) invenção e é ele que decide `meu` → prioridade de slot (×1,25 em `multEsp`) |

Nota: 6 das 34 entradas (3068, 3143, 8020, 6673, 3170, 3172) nem precisavam estar aqui — o motor marca-as pelo **campo do catálogo** (`armPct`/`rmPct`/`vidaPct`/`apPct`/`adPct`/`esquiva`), e o `mapaEspecial()` (3806-3823) acrescenta-as sozinho a partir de `CAMPOS_MULT`. Estão escritas à mão **e** derivadas: risco de divergência.

### G8 — Campos multiplicativos — `CAMPOS_MULT` — **6 entradas** — (b) + (c)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3822 | `const CAMPOS_MULT` | `[['adPct','ad'],['apPct','ap'],['vidaPct','neutro'],['armPct','tanque'],['rmPct','tanque'],['esquiva','tanque']]` | **(b) os nomes dos campos são os do motor** (motor.js:501: `const pct = { adPct, apPct, vidaPct, armPct, rmPct, esquiva, penMag }`). Falta o `penMag`! O 3175 (Sapatos Enfeitiçados, 15% de pen mágica) e o 3020 (8%) só entram no mapa especial porque estão escritos à mão em ITENS_ESPECIAIS — se fossem só por CAMPOS_MULT, ficavam de fora. O **papel** de cada campo é (c) |

### G9 — Prioridade extrema — `PRIORIDADE_EXTREMA` — **2 entradas** — (b) DERIVÁVEL

| linha | token | valor | deveria ser |
|---|---|---|---|
| 48 | `id: '3031'` | Gume do Infinito | (b) motor.js:515 `if (tem('3031')) danoCritico += 0.4` — os dois ÚNICOS multiplicadores de classe do bloco `tem()` |
| 49 | `id: '3089'` | Rabadon | (b) motor.js:522 `if (tem('3089')) ap *= 1.35` |

### G10 — Tabela de qualidade — `Q_MULT` — **5 valores** — (b) DERIVÁVEL

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3596 | `const Q_MULT` | C 0,9 · B 1 · A 1,15 · S 1,35 · SS 1,7 | (b) motor.js:173-179 `QUALIDADES[q].mult` — os valores **coincidem hoje**; é cópia, não derivação. Se o jogo mexer nas qualidades, a extensão decide com o número velho |

### G11 — Poder de exibição — `poderItem` — **4 valores** — (c) + (b)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 4237 | `const RAR` | básico 1 · épico 1,15 · lendário 1,35 | (c) invenção — o motor não tem multiplicador de raridade |
| 4238 | `1 + 0.12 * (refino` | 0,12 por nível de refino | (b) motor.js:55 `BONUS_REFINO = 0.12` — cópia (valor correcto) |

### G12 — Tier qualidade×refino — `tierDe` — **2 valores** — (c) HEURÍSTICA (e contradiz o motor)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 333 | `const tierDe = (i) =>` | `qIdx(qual) * 10 + refino` | (c) escala **inventada**: cada degrau de qualidade vale **10 níveis de refino**. No motor a escala é multiplicativa — motor.js:252 `m = (1 + 0.12*ref) * QUALIDADES[qual].mult` → **1 refino = +12%**, **1 degrau B→A = +15%**. Ou seja: no motor um degrau de qualidade vale ~1,25 refinos; aqui vale 10. É este `tierDe` que decide `entraEmDegrade` (4152-4155) e `porMelhorBase` (4092) |

### G13 — Histerese do equipador — `equipHisterese` — **1 valor** — (c)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 173 / 4172 | `equipHisterese: 1.05` | troca lateral só com ganho ≥ 5% | (c) invenção (o código diz que veio de `docs/itens-ideal.md` D10). O motor não tem histerese nenhuma: ele equipa o que o jogador manda (motor.js:2870-2881). O derivável: a histerese certa é a **variação de ruído da própria medida** — que só existe se a medida for o DPS simulado, não o `valorDe` |

### G14 — Desbloqueio de skill — `MULT_DESBLOQUEIO` — **1 valor** — (c)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 70 | `const MULT_DESBLOQUEIO = 1.5` | +50% no valor de um rank 0→1 | (c) invenção com base numa frase do dono. O motor TEM a regra (`podeSubir`/barra, motor.js:913-916 e 2817) mas não tem "1,5" |

### G15 — Kit da Katarina duplicado — `KAT_FB` — **11 entradas** — (b) DERIVÁVEL

| linha | token | valor | deveria ser |
|---|---|---|---|
| 1160-1172 | `const KAT_FB = {` | Q/W/E/R/G/A/D/F/T/B/M com `rec`, `base`, `ratio` re-escritos | (b) **tudo isto está no motor**: motor.js:735-771 (`HAB_KATARINA`), com `serie()` (motor.js:550). O normal é vir por `META.kits`, mas quando não vem o fallback é uma **cópia velha do balanceamento**. Ex.: a Q da cópia é `rec: 10 - 0.35*(r-1)` = 6,85s no rank 10 — bate com o motor **hoje**; se o jogo mudar a série, o fallback mente |

### G16 — Coeficientes da Voracidade — `_giro` — **4 valores** — (b) DERIVÁVEL

| linha | token | valor | deveria ser |
|---|---|---|---|
| 1174 | `let _giro = { base: 30` | 30 · 19 · 1 · 0,4 | (b) motor.js:737 `giro: (nivel,a) => 30 + 19*nivel + 1*apDe(a) + 0.4*max(0, ad-baseAd)`. Já existe o caminho derivado (`giroSrc` + regex em 1219-1222), mas com **estes defaults** por baixo |

### G17 — Efeitos somados dos equipados — `efeitosEquipados` — **2 valores** — (b) DERIVÁVEL

| linha | token | valor | deveria ser |
|---|---|---|---|
| 1269 | `Math.min(0.4, cdr)` | cap de 40% de CDR | (b) motor.js:537 `reducaoRecarga: Math.min(0.4, ...)` |
| 1269 | `Math.min(0.6, penMag)` | cap de 60% de pen mágica | (b) motor.js:529 `Math.min(0.6, ...)` |

### G18 — Estimativa de conjunto — `statsSet` + `estimarSet` — **8 valores** — (b) + (c) + **1 ERRO**

| linha | token | valor | deveria ser |
|---|---|---|---|
| 3070 | `id === RABADON` | `apPct += 0.35` | (b) motor.js:522 |
| 3071 | `id === '3100'` | `lich += 0.75` | (b) motor.js:1688 |
| 3075 | `Math.min(0.4, cdr)` | caps 0,4 / 0,6 | (b) motor.js:537 / 529 |
| 3075 | `Math.min(0.6, pen)` | idem | idem |
| 3115-3116 | `const cap = 3 *` | teto 3× a curva de vida + 1,5%/s | (b) motor.js:1190-1191 e 1207 |
| 3111 | `alvo?.chefe ? 0.066 : 0.033` | **2 valores** (6,6% / 3,3%) | (c) invenção assumida no comentário ("~1/3 (chefe) / ~1/6 (mob) da luta abaixo de 40%"). O motor só diz `f < 0.4` (motor.js:1205); a fracção da luta é que é arbitrária |
| 3109 | `const mit = 100 / (100 + (alvo?.armadura || 0) * (1 - pen))` | **ERRO**: usa a armadura CHEIA para dano mágico | (b) o motor usa `alvo.armadura * RM_MONSTRO * (1 - penMagica)` com `RM_MONSTRO = 0.6` (motor.js:1202 e 1179). Sem o 0,6 a extensão **subestima o dano mágico** em alvos de armadura alta (a 104 de armadura: mit verdadeiro 0,781 vs 0,490 da extensão — 1,6× de erro) |

### G19 — Lich na conta do DPS — `dpsPorHabilidade` — **1 valor** — (c) com base (b)

| linha | token | valor | deveria ser |
|---|---|---|---|
| 1300 | `const procLich = lich ? lich * ap : 0` | **1 proc por habilidade** | (b) o motor arma no uso da habilidade (motor.js:1944) mas **gasta no próximo ATAQUE BÁSICO** (motor.js:1688): `procs/s = min(habilidades/s, ataques/s)`. Medido na Katarina (ataques/s 1,16 > habilidades/s 0,33-0,54): o modelo da extensão **acerta** (1,00×). Num campeão que lance mais depressa do que ataca, a extensão exagera na razão `habilidades/s ÷ ataques/s` |

### G20 — Tabelas copiadas do motor — **30 valores** — (b) DERIVÁVEL

| linha | token | valor | deveria ser |
|---|---|---|---|
| 1430-1440 | `const MECANICA = {` | 9 multiplicadores de mecânica de chefe: investida 3,5 · pancada 2,2 · olho 2,6 · sopro 2,2 · chuva 1,8 · rugido 0 · invocar 0 · ácido 1,2 · tentáculos 2,6 | (b) **motor.js:3102-3109** (literalmente as mesmas constantes). O próprio comentário admite que é fallback porque a função `mecanicaChefe` não é exportada |
| 1448 | `META.nivelDif` | fallback `{ livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3 }` | (b) motor.js:1184 `NIVEL_DIF` |
| 1364 | `const VA_BASE_MOTOR = 0.697` | 0,697 | (b) motor.js:2056 `recargaQYasuo` (o comentário já cita a linha — está correcto) |
| 870 | `const POCAO_FB` | 3 poções (cura/preço/nível): 300/40/1 · 900/110/15 · 2200/260/30 | (b) motor.js:261-264 `POCOES` |
| 878 | `META.exaustao` | fallback 1 | (b) motor.js:41 `EXAUSTAO = 1` |
| 64 | `const BARRA_SLOTS = 4` | 4 | (b) motor.js:900 `export const BARRA = 4` |
| 22 | `const RARITY` | básico 0 · épico 1 · lendário 2 | (b) motor.js:47-48 |
| 61 | `const RAR_IDX` | básico 0 · épico 1 · lendário 2 | (b) idem — **duplicado** do anterior no mesmo ficheiro |
| 23 | `const QUAL = ['C','B','A','S','SS']` | 5 valores | (b) motor.js:180 `ORDEM_QUAL` |
| 25 | `const RABADON = '3089'` | id | (b) motor.js:522 |

### G21 — Regras do dono com número — **5 valores** — (a) NECESSÁRIO

| linha | token | valor | deveria ser |
|---|---|---|---|
| 4275 | `cfg.refinoMax != null ? cfg.refinoMax : 2` | parar no +2 | (a) regra do dono ("até mais 2 ou mais 3"); o motor tem as chances de refino (motor.js:60-62) e poderia derivar-se o ponto ótimo — mas a decisão de risco é do dono |
| 327/328 | `qIdx(it.qual) < qIdx('A')` | "A+ não se mexe" (2 sítios) | (a) regra do dono, verbatim no código |
| 4276 | `qIdx(e.qual) < qIdx('A')` | idem, no gate do refino | (a) idem |

### G22 — Duplicatas que a extensão proíbe e o jogo permite — **2 valores** — (c) desvio

| linha | token | valor | deveria ser |
|---|---|---|---|
| 4099-4103 | `function escolherConjunto` | `usados.has(i.base)` → **nunca** repete uma base | (b/c) o motor só proíbe **lendário repetido** (motor.js:2879, 2886, 2891: "cada lendário uma vez"); **épicos e básicos podem repetir**. A extensão é mais restritiva que o jogo — e é ela que decide o alvo do equipamento |
| 4562 | `usados.has(String(i.id))` | idem no `montarBuildDe` | idem |


### G23 — Score do conjunto — `scoreSet` — **5 valores** — (c) + (b) + o mesmo ERRO

| linha | token | valor | deveria ser |
|---|---|---|---|
| 5138 | `S.lich * 0.15` | "Lich ≈ +15% no dano total" | (c) invenção: converte o proc de 75% AP num **+15% de dano total** fixo. O sim mostra que o Lich vale 15,9% na Katarina com a barra real e 26,8% na Lux — a constante 0,15 acerta por sorte num caso e erra no outro |
| 5138 | `/ (1 - S.cdr)` | dano total ÷ (1−CDR) | (c) simplificação: o CDR acelera **só** as habilidades; no motor a passiva da Katarina (giro) e os ataques não têm recarga (motor.js:2162 só corta o Shunpo). Dividir o dano TODO por (1−CDR) exagera o CDR |
| 5139 | `alvo?.chefe ? 0.066 : 0.033` | 2 valores | (c) igual ao estimarSet (3098) — **duplicado** |
| 5134-5135 | `const cap = 3 *` + `* 0.015` | 2 valores | (b) motor.js:1190-1191 e 1207 |
| 5131 | `const mit = 100 / (100 + (alvo?.armadura || 0) * (1 - S.pen))` | **ERRO** (2.ª cópia) | (b) falta `RM_MONSTRO = 0.6` (motor.js:1179, 1202) |

---

## 3. Para os DERIVÁVEIS: de onde sairia o número

| O que a extensão escreve à mão | Onde está no jogo | Como derivar |
|---|---|---|
| Kit da Katarina (`KAT_FB`, 1160-1172) | `motor.js:735-771` (`HAB_KATARINA`) | ler `META.kits` (já existe) e **apagar o fallback**, ou derivá-lo do motor |
| Coeficientes da Voracidade (`_giro`, 1174) | `motor.js:737` | a regex já existe (`giroSrc`, 1232-1235); faltam os defaults |
| Caps de CDR/pen (1269, 3075) | `motor.js:537` e `motor.js:529` | ler do motor por mensagem (o `inject.js` já reencaminha vários campos) |
| `Q_MULT` (3596) | `motor.js:173-179` | reencaminhar `QUALIDADES` no META |
| `BONUS_REFINO` 0,12 (4238) | `motor.js:55` | idem |
| `RARITY`/`RAR_IDX`/`QUAL` (22, 61, 23) | `motor.js:47-48` e `motor.js:180` | idem |
| `POCAO_FB` (870) e `EXAUSTAO` (878) | `motor.js:261-264` e `motor.js:41` | já vêm em `META.pocoes`/`META.exaustao`; o fallback é a cópia |
| `MECANICA` (1430-1439) | `motor.js:3102-3109` | exportar `HAB_CHEFE`/`mecanicaChefe` no motor, ou mandar os multiplicadores no META |
| `NIVEL_DIF` fallback (1448) | `motor.js:1184` | idem |
| `VA_BASE_MOTOR` 0,697 (1364) | `motor.js:2056` | idem |
| `BARRA_SLOTS` (64) | `motor.js:900` | idem |
| `PRIORIDADE_EXTREMA` (47-50) | `motor.js:515` e `motor.js:522` | `grep "tem('[0-9]+')" motor.js` + filtrar os que MULTIPLICAM |
| `ITENS_ESPECIAIS` (3780-3818) | o bloco `tem('id')` de `motor.js:504-541` + os campos `pct` do catálogo | derivar a lista; só o `papel` é decisão nossa |
| `CAMPOS_MULT` (3822) | `motor.js:501` `const pct = { adPct, apPct, vidaPct, armPct, rmPct, esquiva, penMag }` | derivar as chaves do objeto (incluindo **`penMag`**, que falta) |
| `RAR` do `poderItem` (4237) | — | não existe no jogo: é (c) |
| `multRar` 0,30 (4033) | — | não existe no jogo: é (c) |
| `tierDe` (333) | `motor.js:252` `(1 + 0.12*ref) * QUALIDADES[qual].mult` | usar a escala multiplicativa do motor em vez de `qIdx*10 + ref` |
| `procLich` 1×/skill (1300) | `motor.js:1944` (arma) + `motor.js:1688` (gasta no ataque) | `min(habilidades/s, ataques/s)`; a conta está feita em `tools/sim-build.mjs` |
| `mit` sem `RM_MONSTRO` (3109) | `motor.js:1202` + `motor.js:1179` | multiplicar a armadura por 0,6 no dano mágico |
| `lich`/`chama`/`liandry`/`Rabadon` (3070-3073) | `motor.js:1688`, `1205`, `1207`, `522` | ler do motor (id → regra) em vez de re-escrever |

---

## 4. O problema que a contagem não mostra: a mesma passiva vale 3× (ou 4×)

Um item que o motor lê pelo ID entra na conta **três vezes**, por três mecanismos independentes:

| Mecanismo | Onde | Exemplo (Cajado do Vazio 3135, na Katarina) |
|---|---|---|
| 1. `valorPassiva` pelo texto | 3865 (`de penetração mágica`) | 40 × 7 = **+280** de valor |
| 2. `multEsp` por ser "especial" | 4028 | **×1,25** |
| 3. `PESO_FASE.itens` por fase | 3712 (chefe) | **×1,35** |
| 4. (e o stat bruto) | 4011 | 95 de AP × peso do perfil |

Somando: 280 × 1,25 × 1,35 = **+472 de "valor" só de mecanismos heurísticos**, mais o AP. O Rabadon (3851: 35 × 9 = 315) leva o mesmo tratamento: 315 × 1,25 (especial) = 394. O Lich (3855: 75 × 2,2 = 165) × 1,25 = 206.

Nada disto é "o dano que o item faz": são **três palpites multiplicados**. Quando um deles estiver errado, os outros dois amplificam o erro. O simulador (`tools/sim-build.mjs`) mede o item em dps — uma fonte só.

---

## 5. O que o simulador respondeu (números reais, `bun tools/sim-build.mjs`)

Personagem calibrado com a medição real (`docs/snapshots/player.json`: nível 29, AD 161, AP 1104, VA 1,16, vida 4476) com a build da luta registada (`3175~A, 3089+2~B, 3100+3~A, 3135~A, 4629+3~A`), e alvo chefe medido (Dragão Infernal, armadura 104, 69 000 de vida).

**Q1 — Bota de CDR + outro item de dano vs Bota de pen + Ímpeto Cósmico:**
- A) `3089,3135,3100,3158,4645` → AP 859 · cdr 8% · pen 40% → **1775 dps** (armadura 0) / 1238 (armadura 104)
- B) `3089,3135,3100,3175,4629` → AP 899 · cdr 15% · pen 55% → **1960 dps** (armadura 0) / 1465 (armadura 104)
- **B ganha em TODA a faixa 0→400 de armadura** (+184 a +228 dps). Não há inversão: a bota de pen (3175) é lendária e traz 70 de AP **e** 15% de pen, enquanto a de CDR (3158) é épica e só traz 8% de CDR.
- A inversão existe noutro par: **bota de pen épica (3020) + Ímpeto vs bota de CDR (3158) + Ímpeto** → a CDR ganha até **armadura ≈ 206** e a pen épica ganha acima disso (1090 vs 1090 no cruzamento).

**Q2 — Dois Cajados do Vazio + bota de CDR, um cajado no lugar do Ímpeto:** **NÃO FUNCIONA.** O motor recusa um 2.º lendário igual (`motor.js:2879` no `equipar`, `motor.js:2891` no `cabeNoEquip`) e a pen não empilharia de qualquer forma (`motor.js:529` usa `tem('3135') ? 0.4 : 0`, booleano, com teto 0,6). Se fosse permitido: ΔAP +33,8 · ΔCDR **−15 pontos** · Δpen 0 → **−178 dps (−12,7%)**.

**Q3 — Lich em função da frequência de skills:** `procs/s = min(habilidades/s, ataques/s)` (`motor.js:1944` arma, `motor.js:1688` gasta no ataque).
- Katarina, barra real (W/Q/R/A): 0,33 habilidades/s, 1,16 ataques/s → **152 dps de Lich** (15,9% do total); o modelo da extensão dá o mesmo (1,00×).
- Katarina, barra top-4 (Q/A/E/T): 0,54 habilidades/s → **250 dps** (22,8%).
- Lux (recargas de `motor.js:633-668`): 0,75 habilidades/s → **462 dps** (26,8%).
- Tecto: acima de 1,16 habilidades/s o Lich satura nos **ataques** (539 dps) — "usar muita skill" não eleva o Lich acima do ritmo de recarga real. O multiplicador fixo **2,2** (`automation.js:3868`) achata esta diferença de ~2,3× entre campeões.
- **Ranking do 5.º espaço na Katarina** (mesma build e alvo): Perdição de Lich **1099 dps** > Liandry 1075 > Chama Sombria 856 > Criafendas 853 > Coroa da Rainha 848 > Morellonomicon 828 > Cajado do Arcanjo 824 > Rylai 820. **Sim, o Lich deve entrar** — mas por ser o melhor item medido, não por causa do 2,2.

**Q4 — Dois Rabadons:** `motor.js:522` é `if (tem('3089')) ap *= 1.35` — booleano, aplica **uma vez**. Um 2.º Rabadon (a deslocar o Cajado do Vazio, 95→130 AP) dá ΔAP +47,3 e **−136 dps (−11%)**: é só o AP flat, não 1,35² = 1,82×. E nem pode ser equipado (`motor.js:2879`/2891).

---

## 6. Recomendação (curta)

1. **Apagar os 103 deriváveis** e mandá-los no META (o `inject.js` já reencaminha vários) — sobretudo `KAT_FB`, `MECANICA`, `POCAO_FB`, `Q_MULT`, os caps e o `_giro`.
2. **Substituir os 151 heurísticos por uma função de dano** (o simulador já a tem): peso de stat = dps por ponto de stat; valor de passiva = dps do proc; bota/CDR/pen = comparação de dps contra a armadura do alvo. Aí o 0,12, o 1,25, o 2,2, o 45 e o `tierDe` desaparecem por construção.
3. **Corrigir o `mit` (3109 e 5123 — duas cópias do mesmo erro)**: falta `RM_MONSTRO = 0.6` no dano mágico.
4. **Escolher uma escala só para qualidade×refino** (`tierDe` vs `infoItem`).
5. **Parar de valorizar a mesma passiva 3×** (§4).

## 7. Como reconferir

- `bun tools/sim-build.mjs` — imprime todas as constantes com `file:linha`, as quatro respostas e o ranking do 5.º espaço.
- `grep -n "<token>" extension/automation.js` — cada linha da tabela acima traz o token para reconfirmar na revisão em que estiver.


---

## 8. RE-AUDITORIA W9 (2026-10-14, worker W9) — o que MUDOU e o que FALTA

> A tabela G1..G23 acima e o retrato da revisao 6 317 linhas. Esta seccao e o DELTA medido depois
> das correccoes dos tickets da fila W9 (`scoreSet`, `tierDe`, `CAMPOS_MULT`, `infoItem`,
> `mit`/`pen`, `nome` do item). Cada linha traz o teste que a prende, na suite `score`
> (`tools/testes/score.test.mjs`, 58 assercoes novas).

### 8.1 O que passou a ser LIDO do motor (derivaveis fechados)

| Grupo | Antes | Agora | Teste |
|---|---|---|---|
| G12 `tierDe` | `qIdx(qual)*10 + refino` (c) — "1 qualidade = 10 refinos" | `(1 + BONUS_REFINO*ref) * QUALIDADES[qual].mult` (motor.js:252, 55, 174-178) | `T64a-g` |
| G8 `CAMPOS_MULT` | 6 entradas, SEM `penMag` | 7: `['penMag','ap']` (motor.js:501/514 `pct`) — o 3175 e o 3020 entram pelo CAMPO, sem lista manual | `T66a-e` |
| G18/G23 `mit` (ramo fisico) | `alvo.armadura * (1 - S.pen)` — usava a pen MAGICA | `(1 - S.penArmadura)` no fisico, `armMagicaEfetiva(arm, pen)` no magico (motor.js:529 vs 539) | `T150a-b`, `T134a-c` |
| G17 caps | `Math.min(0.7, soma)` na pen de armadura — tecto que o motor NAO aplica | limite fisico [0,1]; a composicao do motor da ate 0,835 | `T134b` |
| G6 `valorPassiva` (pen) | o texto somava a pen mesmo com o campo `penMag` presente (3175: 0,15x700 + 15x7) | o texto so conta quando `it.penMag == null` (3135 continua a contar: nao tem campo) | `T31c-h` |
| (novo) `infoItem` | `stats: it.stats || null` — campo que o catalogo nao tem: **devolvia SEMPRE null** | `statsDePeca()`: os 11 campos do motor (motor.js:252-255) para QUALQUER item; resolve a melhor instancia conhecida (equipado/mochila) | `T79a-h`, `T109a-f` |
| (novo) `player().rv` | lido do painel e DEITADO FORA | devolvido em fraccao (motor.js:538); a regex aceita "Roubo de Vida" (jogo.js:5999) | `T142a-c` |
| G20 `rmMonstro` | `META.rmMonstro` nunca chegava (chave fora da whitelist do `carregarMeta`) | a chave passou a ser honrada; **falta o `inject.js` enviar** (ticket `extra-W9-62.md`) | `T62c` (0,5 -> 52) |

### 8.2 O que AUMENTOU (dito, nao escondido)

- **`scoreSet` ganhou um termo de cura** (`cura/s = dano de auto-ataque/s x rv`, motor.js:1226-1228) com um **peso heuristico NOVO e declarado**: 1 cura/s conta como 1 de dano/s. E classe **(c)** — se o dono quiser que a cura valha mais ou menos que o dano, e decisao dele (critério "as poções ficam caras").

### 8.3 Contagem (delta, nao re-auditoria dos 23 grupos)

| Classe | Antes | Delta | Agora |
|---|---|---|---|
| (a) NECESSARIO | 5 | 0 | **5** |
| (b) DERIVAVEL | 103 | +16 | **119** |
| (c) HEURISTICA MINHA | 151 | -1 (eco do pen do 3175) +1 (peso da cura) = 0 | **151** |
| **Total** | 259 | +16 | **275** |

O total SOBE porque a contagem original nao contava os 11 campos de stats por item do `infoItem` nem o termo de cura — a comparacao item a item exige re-auditar os 23 grupos, o que nao foi feito.

### 8.4 O que FALTA (fora do write scope da fila W9 — tickets criados)

| Ticket | O que fica de pe | Ficheiro |
|---|---|---|
| `extra-W9-51.md` | a build ideal continua a escolher item a item, nao a COMBINACAO | `montarBuildDe`/`buildIdeal*` |
| `extra-W9-63.md` | a passiva ainda vale texto x multEsp x PESO_FASE (3135: 280 -> 1 061) | `valorDeFase`/`montarBuildDe` |
| `extra-W9-87.md` | o simulador NAO CORRE contra o motor vivo (o "conflito" do TK-02-87) | `tools/sim-build.mjs:65` |
| `extra-W9-62.md` | o `inject.js` nao envia o `RM_MONSTRO` | `extension/inject.js` |
| `extra-W9-127.md` | o termo de cura nao chegou ao `montarBuildDe`; `pesosItem('mago').ad = 0` | `valorDeFase`/`pesosItem` |
| `extra-W9-150.md` | os escudos ficam fora da vida efectiva do `avaliar` | `avaliar` |
| `extra-W9-parsenum.md` | `parseNum`/`parseBig` corrompem `k`/`M` e milhares (ouro/xp/precos) | leitura de numeros |

**Os 151 heuristicos da classe (c)** continuam a ser a lista de decisao do dono (§2, G1..G23): nao foram inventados nem apagados por este worker.
