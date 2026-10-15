# IDEAL vs ATUAL — estado do Yasuo (nível 14)

> **Data:** 2026-10-14 · **Lane:** ideal-vs-atual (subagent `ecddf2dc…`) · **Escopo de escrita:** só este ficheiro.
> **Nenhum browser/jogo/CDP foi tocado.** Tudo abaixo sai de leitura estática do código do jogo
> (`docs/game-src/`), do código da extensão (`extension/`) e de capturas reais já guardadas
> (`docs/snapshots/yasuo.json`, medições citadas do `HANDOFF.md`).
>
> **Revisão do código citada:** `extension/automation.js` — 4009 linhas / 257619 bytes / mtime 2026-10-14T15:22:48.870Z.
> O ficheiro está a ser editado em paralelo; cada âncora traz o **nome da função** além do `ficheiro:linha`,
> para continuar verificável mesmo que a linha ande.

**ATUAL** = o estado real medido que o dono reportou. **IDEAL (agora)** = o melhor **alcançável com o que já
existe na conta** (equipado + mochila + pontos livres) — não a build lendária final, que é alvo de aquisição.

## 0. Como ler (o que é prova e o que é conta)

| marca | significado | como aparece |
|---|---|---|
| **CÓDIGO** | li a linha e ela diz literalmente aquilo | `ficheiro:linha` |
| **MEDIDO** | veio de captura/medição real do jogo | `docs/snapshots/yasuo.json`, `HANDOFF.md §…` |
| **DERIVADO** | reimplementei a fórmula do código e calculei | a fórmula é citada |
| **INDECIDÍVEL** | não sai da matemática — precisa do jogo | `indecidivel-sem-jogo` (§10) |

---

## 1. Tabela mestra

| eixo | ATUAL (medido) | IDEAL (agora) | GAP | acção exacta |
|---|---|---|---|---|
| **1. Itens equipados** | `1001` Botas (básico A) · `3044` Fago (épico A) · `1018` Capa da Agilidade (básico A) · `3133` Caulfield (épico A) · `1036` Espada Longa (básico A) — **2 básicos equipados com 2 épicos na mochila** | `3047` Galvanizadas de Aço (bota, épico A) · `3077` Tiamat (épico C) · `3044` · `3133` · `1018` = **1 bota + 4, todos os épicos disponíveis dentro, zero básicos** | O alvo que o código calcula já é o certo (`[3047, 1018, 3077, 3133, 3044]` — quer as duas peças da mochila), mas **não troca nada**: `pAlvo/pAtual = 872,25/849,94 = 1,0262` = **+2,62%**, e a histerese exige **>5%** ⇒ *early return*. A bota já é escolhida certa (`3047` 2,25 > `1001` 0,94) desde a remoção do bónus de +60 de `sinergiaDe` (feita nesta revisão). Evidência histórica: em `docs/snapshots/yasuo.json` o `3047~A` **estava equipado** (nv12) — houve regressão | (a) **dominância por espaço avaliada ANTES da histerese**: mesmo espaço + raridade maior (ou refino maior) ⇒ troca imediata, sem consultar o limiar de 5% (é o que desbloqueia estas 2 trocas); (b) escolher a bota por **tier** (qualidade→refino) antes do score; (c) ligar `cfg.autoEquip = true` (hoje `false` por defeito ⇒ `checarEquipMelhor` e `necessidadesBase` nunca agem) |
| **2. Mochila** | **20/24** = `3077`(C) + `3047`(A) + `1001`(A) + `1036`(A) + **16 básicos A** | **0 slots de tranqueira.** Os dois épicos sobem para EQUIPADO; fica só a matéria-prima da receita da build ideal (`1001`×1, `1018`×4, `1028`×1, `1036`×3, `1037`×1, `1038`×1, `1042`×6) e o que for **S+** | A regra «acima de A não se mexe» foi generalizada a **todas** as raridades (`acimaDeA`) e o `planBag` saltava esses itens ⇒ básicos A **nunca** entravam no lote de venda. **MEDIDO** no lote real de nv12: 12 dos 21 básicos eram A e ficariam para sempre (5× `1028` A, 2× `1001` A, 2× `1036` A…). Isto realimenta o `lixo` do `supervisarBase` ⇒ ping-pong Fonte↔campo (o bug do §9.7a do HANDOFF) | Regra do dono já aplicada nesta revisão (`planBag` ramo próprio de básico + S+ intocável + épico-componente da build guardado, espelhando `venderBase`). **Manter a reconciliação planeador↔ator**: qualquer `VENDER_LOJISTA` do `planBag` tem de ser executável pelo `venderBase`, senão o contador de lixo nunca chega a zero |
| **3. Skills** | barra **3/4** (4.º slot **VAZIO**); Q rank 7 · E rank 4 · W rank 2; **R rank 1 FORA da barra**; o HUD diz **15** | Barra **4/4 = Q·E·W·R** (a ultimate DENTRO). Pontos de **SKILL = 0** (já estão gastos: `pontos = nível − Σranks`, e Q7+E4+W2+R1 = 14 = nível 14). Desbloquear as skills que o nível já abriu e estão a rank 0 (**G** req nv8, **A** req nv13) | Os **15 não são de skill — são de ATRIBUTO**. `readSkills` pegava o **1.º número** do `#hud-pontos`, e o `jogo.js` monta essa string com os DOIS contadores («15 de atributo» quando não há skill nenhum) ⇒ `subirHabilidades` pedia subidas que o jogo recusava, em silêncio. **Já corrigido** nesta revisão (`pontos` vs `pontosAtrib`). O que **continua aberto** é a barra: `rotacaoSkills` exclui a ultimate fora do chefe, logo o slot vazio é preenchido por A/W/G e **nunca por R** | (a) `aplicarBarra(['Q','W','E','R'])` no arranque / sempre que a barra tiver menos de 4 (já existe, é só chamar); (b) tratar a ultimate como **fixa** da barra quando a área tem chefe (ou config `cfg.ultNaBarra`); (c) armadilha medida: o clique no `R` tira-o primeiro (DOM dessincronizado) — **clicar 2×** (HANDOFF §9.16) |
| **4. Atributos** | **15 pontos LIVRES**; 5 tipos (Força, Vitalidade, Resistência, Agilidade, Foco); distribuição actual não lida nesta medição | **0 livres**, os 15 em **FORÇA** (7 → 22). Ganho **MEDIDO**: DANO 171 → 200 (**+17%**) | `cfg.autoAtrib = false` por defeito ⇒ `necessidadesBase().atrib = false` ⇒ `distribuirAtributos` **nunca corre**. E quando corresse usaria o modelo `equilibrado` (2/2/1/1/1), **não** o `dano` (3/2/1) que é o do Yasuo. O comentário do `cfg` promete «usa a sugestão do campeão (`META.dicaAtributos`)», mas `DICA_ATRIBUTOS` é **texto**, não um modelo — a promessa é inimplementável como está | (a) `cfg.autoAtrib = true`; (b) `cfg.modeloAtrib = 'dano'` (ou mapa campeão→modelo, derivado de `MODELOS`); (c) corrigir o comentário da linha do `modeloAtrib` para dizer a verdade |
| **5. Nível + região** | nv **14** · **Campo Azul** (mobs nv **15**, `fx = 1,00`) | **Rota Superior** (mob nv 13) enquanto o DPS for ≲450; **Toca dos Lobos** acima disso; **Campo Vermelho** só com DPS ≳700. **Campo Azul nunca é ótimo a nv14** — e é a única região candidata que **não dropa NADA da build** (só `1028`, básico, e basta 1) | `regiaoIdeal` filtra candidatos por `nm[0] ≤ nível+6` (teoria) e depois decide **só entre as regiões já medidas** — o que se auto-reforça: só mede onde já está. Campo Azul ganhou por **medir** melhor (1.260 ouro/min, n=8), não por ser melhor para a **build** | (a) manter a regra do medido, mas **forçar amostra** (n≥3) nas regiões nunca medidas dentro de `doNivel0` (senão nunca sai de Campo Azul); (b) desempate por **drop da build** (`META.locais[].drops` ∩ `componentesDaBuild()`); (c) migrar para Lobos/Rota Superior conforme o DPS medido |
| **6. Ouro** | **64.300 parados**; ritmo medido **~780 ouro/min** (Campo Azul nv14, HANDOFF §9.7f) | **Não é um número — é ouro GASTO.** Piso = **20.000** (reserva do próprio código). Próximo gasto executável: `3144` Estilingue do Patrulheiro (componente do `3085` Runaan) = **24.900** esperado. Alvos: **94.700** (para o `3006`), **107.150** (para o `3086` Zelo, que serve 3 itens da build), **144.500** (para o `3077` Tiamat — custo MEDIDO que bateu ao ouro, HANDOFF §9.6u) | 64.300 está **acima do gatilho** (`readGold() > 60000`) mas **abaixo do primeiro craft de valor**; e a rotina **não marca o throttle** quando não há candidato ⇒ abre a bancada do Ornn em **toda** a ida à base sem montar nada. Mais: **~4.390 de ouro presos na mochila** (valor Lojista do lote nv12: 5.891, dos quais 4.390 vendáveis) | (a) marcar `_ultimaMontagem` **também** no early return (o throttle de 30 min não cobre o caso «nada montável»); (b) vender o lixo do eixo 2 (+~4.390); (c) alvo de ouro = **custo do próximo craft + 20.000**, não uma constante; (d) se aparecer no mercado por menos que `valeComprar`, comprar |
| **7. Automação** | `enabled = false` por defeito (bom), **mas** a auto-poção do `content.js` tem `enabled: true` por defeito e **zero** referências a campeão ⇒ a poção corre em **qualquer** boneco, Katarina incluída | Autoplay (itens/skills/atributos/rotação/região) **SÓ no Yasuo**; poção idem. **Gate duro por campeão**, não por browser | **Não existe NENHUM gate por campeão** em `automation.js` (grep: 0 ocorrências). `cfg.enabled` é **global** (por browser/perfil, não por campeão) e o `content.js` nem sabe quem está em campo. Prova histórica: `docs/audit-itens.md` (bug 6) + `TODO.md:1130` — a Katarina foi estragada pelo auto-play | (a) guard no topo do `tickAutoplay` e nas 5 entradas: `if (identidadeCampeao().id !== cfg.champAutorizado) return;`; (b) propagar o id do campeão ao `content.js` (o `inject.js` já corre em MAIN e já manda o kit) e gatear a poção; (c) `cfg.champAutorizado = 'yasuo'` |

---

## 2. Eixo 1 — itens equipados (o mais caro dos gaps)

### 2.1 O que o código decide hoje (reimplementei a decisão, **DERIVADO**)

`valorDe` (CÓDIGO `automation.js:2747`) = stats×pesos + `valorPassiva` + `sinergiaDe`;
`sinergiaDe` (CÓDIGO `automation.js:2722`) dá hoje **só** +45 por cada equipado da mesma classe de dano.
Pesos do perfil `dano` (Yasuo): `ad 1.4 · va 350 · critico 400 · vida 0.03 · armadura 0.15`.

> **Nota de revisão (importante):** o bónus de **+60 ao item que já estava equipado** existia quando comecei
> este documento e **foi removido durante a escrita** (o comentário que o regista está em
> `automation.js:2729-2738`). Isso mudou o veredicto da bota — ver 2.1.1. A tabela abaixo é a da revisão
> **actual**.

| item no pool (equipado+mochila) | raridade | `valorDe` (ctx = equipado actual) |
|---|---|---|
| `1018` Capa da Agilidade | básico A | **240,00** |
| `3077` Tiamat (**na mochila**) | épico C | **215,00** |
| `3133` Caulfield | épico A | 208,00 |
| `3044` Fago | épico A | 207,00 |
| `1036` Espada Longa | básico A | 194,00 |
| `3047` Galvanizadas de Aço (**na mochila**) | épico A | **2,25** |
| `1001` Botas | básico A | **0,94** |

### 2.1.1 O que ainda bloqueia (o +60 saiu, o gap NÃO fechou)

Conclusão da minha reimplementação (revisão actual, **sem** o +60), passo a passo:

1. A **bota** agora é escolhida CERTA: `3047` (2,25) bate `1001` (0,94) — a remoção do +60 resolveu esta parte.
2. O **alvo** que o código calcula é `[3047, 1018, 3077, 3133, 3044]` — ele **quer** as duas peças da mochila.
3. Mas **continua a não trocar nada**: `pAlvo = 872,25` e `pAtual = 849,94` ⇒ `pAlvo/pAtual = 1,0262`,
   ou seja **+2,62%**, e a histerese (CÓDIGO `automation.js:2049`) exige **>5%** quando o número de itens é igual
   ⇒ *early return* e o estado fica como está. As trocas que ele queria fazer (`tira 1001,1036` / `põe 3047,3077`)
   são exactamente o IDEAL do dono.
4. Porquê tão pouco ganho? Porque o score desvaloriza as duas peças que faltam: `multDef`
   (CÓDIGO `automation.js:2757`) dá **0,3×** a itens sem dano (a bota épica vale 2,25 apesar de ser um upgrade
   estrito de 1001: 100 vida + 30 armadura contra 80 vida + 5 armadura) e o `3077` Tiamat (+25 AD, épico)
   fica em 215 contra 194 da `1036` Espada Longa (+10 AD, básico) — ganha, mas por 21 pontos num total de ~850.
5. **Conclusão: o defeito que resta é a histerese de 5% — não os pesos nem o bónus (já removido).**

### 2.2 Prova de que isto é regressão, não estado inicial

`docs/snapshots/yasuo.json` (captura real, nv12) traz em `equip[0]`:
`{"id":"3047~A","base":"3047","qual":"A","nome":"Botas Galvanizadas de Aço","raridade":"epico"}` —
a bota épica **estava equipada**. Hoje o `3047~A` está na mochila e o `1001` básico no pé.
É exactamente a acusação do dono (`TODO.md:1137`: *«essa porra fica trocando os itens do yasuo… acabou de tirar
o único épico que tinha»*).

### 2.3 Acção exacta (por ordem)

1. **Bota por tier, não por score**: em `equiparMelhores` (CÓDIGO `automation.js:2017`),
   a escolha da bota (CÓDIGO `automation.js:2036`) deve ordenar por `tierDe` (qualidade→refino)
   e só depois por `valorDe` — dentro do mesmo espaço, um épico A ganha a um básico A **sempre**.
2. **Dominância por espaço antes da histerese**: se o pool tem, no MESMO espaço, um item de raridade maior
   (ou mesmo base com refino maior) que o equipado, **trocar sem consultar o limiar de 5%**. A histerese existe
   para evitar oscilação entre conjuntos equivalentes; um épico vs básico não é equivalente.
3. **Remover o +60 do próprio slot** — **FEITO** nesta revisão (`sinergiaDe`, `automation.js:2729-2738`; o
   `if` que o dava está comentado como removido). Fica registado aqui porque era metade do defeito: sem isto a
   básica equipada ganhava sempre da épica na mochila.
4. **Ligar o auto-equipar**: `cfg.autoEquip = false` por defeito (CÓDIGO `automation.js:51`) e
   `checarEquipMelhor` (CÓDIGO `automation.js:2084`) e `necessidadesBase` (CÓDIGO
   `automation.js:1681`) exigem-no. Sem isto, o passo 1–3 nunca corre sozinho.

**Resultado esperado da acção:** equipado passa a `3047 · 3044 · 3133 · 3077 · 1018` (o mesmo conjunto que o
dono corrigiu à mão, HANDOFF §9.16) — mas **pela regra**, não por intervenção manual.

---

## 3. Eixo 2 — mochila (o que devia ter sido vendido)

### 3.1 A regra do dono vs a regra que estava no código

Palavra do dono (verbatim, HANDOFF §9.16): *«item basico, epico, duplicado: vende no lojista.
a nao ser q seja tier s mais.»*

O que estava no código: `acimaDeA` (CÓDIGO `automation.js:201`) — **A e acima, para QUALQUER
raridade, não se mexe** — e o `planBag` saltava-os expressamente (CÓDIGO `automation.js:263`).
Um básico A não é lixo (`isTrash` só apanha épico) nem excedente de receita (o teto de básicos, CÓDIGO
`automation.js:260`, só limita os **abaixo** de A) ⇒ caía no `else` final e era `GUARDAR`.
**Para sempre.**

### 3.2 Medição do desperdício (lote real do snapshot, nv12)

`docs/snapshots/yasuo.json → bag` tem 21 básicos. Cruzando com a receita da build ideal
(`basicosDaBuild`, CÓDIGO `automation.js:206`; precisa de `1001`×1, `1018`×4, `1028`×1,
`1036`×3, `1037`×1, `1038`×1, `1042`×6) e com o valor de Lojista (**MEDIDO** nos próprios tooltips do
snapshot: 1036 A vale 262 com preço 350 ⇒ **0,75 × preço**):

| | ouro |
|---|---|
| valor de Lojista do lote inteiro | **5.891** |
| do que **serve** a receita (fica) | 1.501 |
| **do que devia ter sido vendido** | **4.390** |

Item a item, o que devia ter saído: `1028` ×5, `1029` ×2, `1033` ×2, `1054` ×2, `2022` ×2, `1001` ×1, `1006` ×1, `1120` ×1.
Ficariam 4 peças (`1001`×1, `1018`×1, `1036`×2) — e as que faltam (`1037`, `1038`, `1042`) compram-se por 875/1.300/250.

### 3.3 Estado desta correcção (nesta revisão)

O `planBag` **já foi corrigido** (CÓDIGO `automation.js:230`): ramo próprio para básico
(`automation.js:302`), **S+ intocável em qualquer raridade** (`automation.js:301`)
e o **épico que é componente da build vai para `GUARDAR`, não para o Lojista** (`automation.js:308`).
O `venderBase` foi alinhado no mesmo limiar (CÓDIGO `automation.js:1588` + guard de componente em
`automation.js:1604`).

> **Alerta de reconciliação (a única coisa que pode reabrir o P0):** o `supervisarBase` conta
> `lixo = acts.filter(VENDER_LOJISTA).length` (CÓDIGO `automation.js:3795`) e o `necessidadesBase`
> usa o mesmo (CÓDIGO `automation.js:1679`/`1667`). **Qualquer** acção que o `planBag`
> marque como `VENDER_LOJISTA` e o `venderBase` recuse executar deixa o `lixo ≥ 1` para sempre ⇒ o boneco
> volta à base a cada ~20 s e nunca farma (o «ciclo de viagem», HANDOFF §9.7a). Já aconteceu nesta janela de
> trabalho com o `3077` Tiamat: o planeador mandava vender, o ator protegia-o. **Teste obrigatório antes de
> ligar o auto-play**: `planBag(scanBag()).acts.filter(a => a.action === 'VENDER_LOJISTA')` tem de bater 1:1
> com o que o `venderBase` clica.

---

## 4. Eixo 3 — skills

### 4.1 Os «15 pontos» não são de skill (é este o bug do dono)

O motor diz a regra: **1 ponto de skill por nível** (CÓDIGO `motor.js:2801`, `estado.pontos++`) e
`estado.pontos = nível − Σ ranks` (CÓDIGO `motor.js:1048`). Com nível 14 e
Q7+E4+W2+R1 = **14 ranks**, os pontos de skill são **0**.

O HUD, porém, tem **um só** elemento dourado para os dois contadores: o `jogo.js` monta
`#hud-pontos-txt` como «{n} de habilidade · {n} de atributo», **omitindo** a parte que é zero
(CÓDIGO `jogo.js:6532`, dentro do bloco de `jogo.js:6529`). Com 0 de skill e 15 de
atributo, o texto fica literalmente **«15 de atributo»** — e o `readSkills` antigo pegava no 1.º número
e chamava-lhe `pontos` de habilidade.

Consequência medida: `subirHabilidades` (CÓDIGO `automation.js:1431`) achava que havia 15 pontos,
clicava nos `+`, o jogo recusava (0 reais) e devolvia `{ok:false, gastos:0}` **sem uma linha de erro**.
Era isto que impedia a ultimate de subir.

**Já corrigido nesta revisão:** `readSkills` separa `pontos` de `pontosAtrib` pelo texto do HUD
(CÓDIGO `automation.js:671`, `696`). O leitor exacto para o futuro é
`#hab-pontos` (CÓDIGO `jogo.js:6608`), que dá «N pontos livres · usados/total ranks» —
não depende de adivinhar qual contador é.

### 4.2 O que continua aberto: a barra com 3/4 e o R fora

A barra tem **4** lugares (CÓDIGO `motor.js:900`) e o painel/ HUD são renderizados em
`jogo.js:6124` e `jogo.js:6130`. A rotação da extensão (CÓDIGO
`automation.js:3533`) monta as desejadas como as **4 primeiras** por «pronta, depois maior DPS»
(CÓDIGO `automation.js:3547`), mas **filtra a ultimate fora do chefe** (CÓDIGO
`automation.js:3539`). Em Campo Azul (sem chefe na tabela do local) isso significa:
barra = Q·E·A·W (ou G) e o **R fica de fora** — exactamente o que o dono apontou.

Nota: o desbloqueio resolve-se sozinho se os pontos forem gastos — o motor põe a skill na barra ao chegar
a rank 1 se houver espaço (CÓDIGO `motor.js:2817`). Com 0 pontos de skill, isso **não acontece**;
logo a barra tem de ser montada explicitamente.

### 4.3 Acção exacta

1. **Pôr a barra em 4/4** com `aplicarBarra(['Q','W','E','R'])` (CÓDIGO `automation.js:3518`)
   — a função existe e já sabe tirar o que sobra e pôr o que falta. Chamar no arranque e sempre que
   `readSkills().bar.length < 4`.
2. **Ultimate fixa da barra**: no `rotacaoSkills` (CÓDIGO `automation.js:3533`) a ultimate só é
   candidata em chefe. O dono quer o R **na barra** (HANDOFF §9.16) — o motor exige alvos no ar para o R
   (CÓDIGO `motor.js:706`), mas a Q **levanta** os monstros (tornado com 2 cargas, `motor.js:698`)
   e o A também (CÓDIGO `motor.js:711`), portanto há alvos no ar em rotação normal. Ou se mantém o R sempre,
   ou se cria `cfg.ultNaBarra` com default `true` e a decisão passa a ser explícita.
3. **Clicar 2×** ao meter o R: medido nesta sessão (HANDOFF §9.16) — o 1.º clique **tira-o**, porque o DOM e o
   `estado` do jogo estavam dessincronizados. `aplicarBarra` deve confirmar por `readSkills()` e repetir.
4. **Corrigir o `dpsPorHabilidade` (afecta a ORDEM de subir)** — ver §9, acção 10.

---

## 5. Eixo 4 — atributos

### 5.1 O que cada ponto vale, no Yasuo (DERIVADO das fórmulas do motor)

| atributo | efeito por ponto | fonte | 15 pontos = |
|---|---|---|---|
| **Força** | **+1,2 de Dano de Ataque** (o Yasuo não é mago) | CÓDIGO `motor.js:503` | **+18 AD** |
| **Agilidade** | +0,8% de velocidade de ataque (+0,25% de esquiva, cap 25%) | CÓDIGO `motor.js:503` / `motor.js:536` | +12% AS |
| **Vitalidade** | +20 de vida (+0,1 de regeneração) | CÓDIGO `motor.js:503` / `motor.js:535` | +300 HP |
| **Resistência** | +1,5 de armadura e +1 de resistência mágica | CÓDIGO `motor.js:503` | +22,5 arm / +15 RM |
| **Foco** | −0,4% de recarga e +1% de ganho de Fluxo | CÓDIGO `motor.js:465` | −6% CDR / +15% Fluxo |

O `build-yasuo.md` §9-D2 mede o efeito no DPS: **10 pontos em Vitalidade = +0,00%**, 10 em Resistência =
**+0,00%**, 10 em Força = **+2,64%**, 10 em Agilidade = **+1,96%**. Ordem certa: **Força > Agilidade > Vitalidade**,
e Vitalidade só se as mortes subirem. O dono já o viu ao vivo: **15 pontos em Força ⇒ DANO 171 → 200 (+17%)**
(MEDIDO, HANDOFF §9.16).

### 5.2 GAP e acção

- `cfg.autoAtrib = false` (CÓDIGO `automation.js:48`) ⇒ `necessidadesBase` devolve
  `atrib = false` (CÓDIGO `automation.js:1680`) ⇒ `distribuirAtributos` (CÓDIGO
  `automation.js:1871`) **nunca corre**. **Acção:** `cfg.autoAtrib = true` (e só com o
  auto-play ligado, como já está guardado).
- O modelo usado é `cfg.modeloAtrib || 'equilibrado'` (CÓDIGO `automation.js:1875`), e o
  `equilibrado` põe 2 em Vitalidade (peso igual ao de Força) — o que contradiz a medição. Os modelos existem
  no motor (CÓDIGO `motor.js:484`); o do Yasuo é o **`dano`** (3 Força / 2 Agilidade / 1 Vitalidade,
  CÓDIGO `motor.js:487`). **Acção:** `cfg.modeloAtrib = 'dano'`, ou um mapa campeão→modelo.
- O comentário do `cfg` (CÓDIGO `automation.js:49`) diz «null = usa a sugestão do campeão
  (`META.dicaAtributos`)». Isso **não é implementável como está**: `DICA_ATRIBUTOS` é uma frase por campeão
  (CÓDIGO `motor.js:474`), não um modelo. **Acção:** trocar o comentário por «null = `dano`» ou
  introduzir o mapa no motor.

---

## 6. Eixo 5 — nível + região

### 6.1 Como o código escolhe (CÓDIGO)

`regiaoIdeal` (CÓDIGO `automation.js:3710`):
1. candidatos = locais não-Runeterra com `estimarRegiao` (CÓDIGO `automation.js:809`) sem morte;
2. filtro de nível: `nm[0] ≤ nível + 6` (CÓDIGO `automation.js:3720`) — a nv14 dá `nm[0] ≤ 20`;
3. se **alguma** região tem amostra (n≥3), decide **só entre as medidas** (CÓDIGO `automation.js:3739`).

O nível do mob nasce `clamp(nível−2+rand(0..3), n0, n1)` (motor), logo o que conta é a **faixa** do local, não o nível.
A penalidade de XP/ouro só morde quando o **jogador** está acima do mob (`fatorXp`, motor.js:421): a nv14,
todas as regiões de `rota-sup` para cima têm `fx = 1,00`.

### 6.2 Números (DERIVADO: reimplementei `estimarRegiao` com a CURVA e os MONSTROS do motor)

Nível 14 · wave de 3 · respawn 2,7 s · **teto spawn-limitado** (assume que a wave cai junta):

| região | faixa `nm` | mob nv | `fx` | HP do mob | xp/min (teto) | ouro/min (teto) | chefe |
|---|---|---|---|---|---|---|---|
| Covil do Barão | 40–48 | 40 | 1,00 | 8.050 | 35.547 | 9.867 | Barão Nashor |
| Fosso do Dragão | 30–38 | 30 | 1,00 | 5.805 | 26.240 | 7.157 | Dragão Infernal |
| **Campo Vermelho** | 20–28 | 20 | 1,00 | 3.998 | **19.493** | 6.006 | — |
| Rio | 25–33 | 25 | 1,00 | 4.258 | 18.860 | 5.014 | Arauto do Vale |
| **Campo Azul (ATUAL)** | 15–23 | 15 | 1,00 | 2.990 | **15.840** | 5.334 | — |
| Toca dos Lobos | 10–18 | 13,5 | 1,00 | 1.647 | 10.956 | 3.315 | — |
| Rota Superior | 5–13 | 13 | 1,00 | 1.489 | 10.325 | 3.531 | — |
| Rota Inferior | 1–6 | 6 | 0,70 | 519 | 3.871 | 1.364 | — |

O teto **não** é a resposta: é o limite de quem mata a wave instantaneamente. O que decide é o **DPS**. Com
`kills/min = 3/(HP_do_mob/DPS + 2,7) × 60`, o melhor local muda assim (**DERIVADO**):

| DPS | Rota Inferior | Rota Superior | Toca dos Lobos | Campo Azul | Campo Vermelho | melhor |
|---|---|---|---|---|---|---|
| 200 | 2.820 | 2.748 | 2.705 | 2.423 | 2.319 | Rota Inferior |
| 300 | 3.371 | **3.638** | 3.612 | 3.376 | 3.284 | **Rota Superior** |
| 400 | 3.735 | **4.341** | 4.339 | 4.203 | 4.146 | **Rota Superior** |
| 500 | 3.995 | 4.910 | **4.935** | 4.927 | 4.920 | **Toca dos Lobos** |
| 700 | 4.339 | 5.775 | 5.854 | 6.135 | **6.257** | **Campo Vermelho** |
| 1.000 | 4.638 | 6.655 | 6.805 | 7.516 | **7.857** | **Campo Vermelho** |
| 2.500 | 5.135 | 8.459 | 8.807 | 10.977 | **12.242** | **Campo Vermelho** |

**(xp/min, arredondado)** — e **Campo Azul não ganha em nenhuma linha**. Só passa à frente de Rota Superior
e Lobos quando o DPS já é suficiente para Campo Vermelho (que aí ganha por mais).

### 6.3 O argumento que falta na decisão: o que a região DROPA

Cruzando `docs/snapshots/yasuo.json → locais[].drops` com os componentes da build ideal
(`componentesDaBuild`, CÓDIGO `automation.js:1537`):

| região | dropa da build |
|---|---|
| **Rota Superior** | `3172` Grevas Bélicas (**lendário — a bota da build**) · `3006` Grevas do Berserker (épico) · `3044` Fago (épico) · básicos `1036`, `1028`, `1018` |
| **Toca dos Lobos** | `3046` Dançarina Fantasma (**lendário da build**) · `3086` Zelo (épico) · básicos `1042`, `1037`, `1018`, `1001` |
| Rota Inferior | `6631` Quebrapassos (lendário) · `3077` Tiamat · `3144` Estilingue (épicos) · básicos `1036`, `1028`, `1042`, `1001` |
| Campo Vermelho | `3077` Tiamat (épico) · básicos `1036`, `1037`, `1038`, `1028` |
| Rio | `3085` Runaan (lendário) · `3086`, `3144` (épicos) |
| **Campo Azul** | **só `1028` (básico, e a receita pede 1).** Nenhum épico, nenhum lendário da build |

Ou seja: **Rota Superior + Lobos cobrem praticamente a receita inteira** (a bota lendária, a Dançarina,
o Zelo e 4 dos 7 básicos) e ambas são candidatas a nv14 (`nm[0]` 5 e 10 ≤ 20). Campo Azul é a região onde
farmar **não aproxima a build**.

### 6.4 Acção exacta

1. **Não deixar a decisão presa ao histórico**: se `_comAmostra` só tem Campo Azul, o código nunca vai medir
   outra região. Forçar uma amostra curta (n≥3) em cada região de `doNivel0` que ainda não tem amostra
   (round-robin), **antes** de voltar ao óptimo medido.
2. **Desempate por drop**: somar ao score o número de componentes da build que a região dropa
   (`locais[].drops` ∩ `componentesDaBuild()`), com peso declarado. É dado do motor, não palpite.
3. **Regra dura de nível**: nunca escolher região cujo `nm[0] > nível + 6` (já existe) e, dentro do permitido,
   preferir `nm[0] ≤ nível` quando o DPS for baixo — a nv14 isso aponta a **Rota Superior**.
4. **`cfg.objetivo`**: hoje é `xp`. Para «full build» o objectivo correcto é **`ouro`** (os lendários vêm do
   mercado/Ornn, não de XP) — ou um objectivo novo `build`, que é o que o dono quer.

---

## 7. Eixo 6 — ouro: quanto devia ter

### 7.1 A resposta curta

**O ouro não tem valor-alvo; tem piso e destino.** O piso é a reserva que o próprio código já usa:
**20.000** (CÓDIGO `automation.js:1642` na compra de poções e
`automation.js:2849` na montagem). Acima disso, ouro parado é DPS parado.

**Com 64.300, o IDEAL era já ter convertido parte em item.** O próximo gasto executável, pelos custos do
próprio motor (CÓDIGO `motor.js:3131`, `3135`, `3160`: épico = `custo × 3`
por tentativa, 1% + VIP ⇒ **83 tentativas médias**, publicitadas pelo jogo — HANDOFF §9.6f/§9.6k):

| receita (componente da build ideal) | ouro/tentativa | custo esperado (×83) | ouro alvo (= custo + 20.000) |
|---|---|---|---|
| **`3144` Estilingue do Patrulheiro** (→ `3085` Runaan) | 900 | **24.900** | **44.900** |
| `3006` Grevas do Berserker (→ `3172` Grevas Bélicas) | 900 | 74.700 | 94.700 |
| `3086` Zelo (→ `3172`, `3046` **e** `3085`) | 1.050 | 87.150 | 107.150 |
| `3044` Fago (→ `6631` Quebrapassos) | 1.050 | 87.150 | 107.150 |
| `3077` Tiamat (→ `6631` Quebrapassos) | 1.500 | **124.500** (custo MEDIDO que bateu ao ouro, HANDOFF §9.6u) | 144.500 |
| qualquer **lendário** | `preço × 4,8` | **~7,0–9,3 M** | **caminho morto** |

Leitura: **64.300 já chega para o `3144` (24.900) se os componentes existirem** (2× `1042` Adaga) e
**não chega** para o primeiro craft que muda o DPS a sério (`3006`/`3086`). O alvo honesto, agora, é
**44.900 → 107.150**, não 64.300.

### 7.2 O que está mal no caminho (CÓDIGO)

- `n.montar` só é verdadeiro com `readGold() > 60000` (CÓDIGO `automation.js:1685`) e
  `montarMelhorReceita` (CÓDIGO `automation.js:2847`) exige `disponivel ≥ 40000`
  (CÓDIGO `automation.js:2850`). Com 64.300 passa — e vai tentar.
- Quando **não há** candidato, sai em `automation.js:2861` **antes** de marcar
  `_ultimaMontagem` (CÓDIGO `automation.js:2864`). O throttle de 30 min não cobre esse
  caso ⇒ **abre a bancada do Ornn em toda a ida à base** para concluir «nada montável». Fricção pura
  (a bancada é a operação mais lenta da base). **Acção:** marcar o timestamp também nesse ramo.
- O `valeComprar` (CÓDIGO `automation.js:3277`) compara o preço pedido com o **ouro que se
  deixa de ganhar** a farmar o drop, usando o `goldMin` **medido** (não a constante `cfg.ouroMin = 4000`, que
  estava 5–13× acima — `build-yasuo.md` §9-D1). Está certo; o que falta é haver oferta (HANDOFF §9.5r:
  `compras: []` porque **não havia anúncios** desses itens, não porque a decisão falhasse).

### 7.3 O ouro que está preso na mochila

Ver §3.2: **4.390** de valor de Lojista em itens que nunca serão usados. Esse ouro devia já estar contado.
Somando: o estado correcto **hoje** seria ≈ **68.700** em caixa (64.300 + 4.390), dos quais ~24.900 já
convertidos no `3144` se os componentes existirem ⇒ ≈ **43.800 em caixa + 1 componente montado**.

---

## 8. Eixo 7 — estado da automação (autoplay SÓ no Yasuo)

### 8.1 O que existe hoje

| camada | default | gate por campeão? |
|---|---|---|
| rotina (`automation.js`) | `enabled: false` (CÓDIGO `automation.js:28`) | **NÃO** — grep por `yasuo`/`champPermitido`/`gate` em `automation.js`: **0 ocorrências** |
| auto-poção (`content.js`) | `enabled: true` (CÓDIGO `content.js:21`, dentro de `DEFAULT_CONFIG` em `content.js:20`) | **NÃO** — grep por `retrato`/`champ`/`campeao` em `content.js`: **0 ocorrências** |
| identidade do campeão | existe e é fiável (CÓDIGO `automation.js:914`, `140`, `154`) | a informação existe — **não é usada como permissão** |

Ou seja: `cfg.enabled` é **global** (vive em `chrome.storage`, por perfil de browser) e **não sabe que boneco
está em campo**. Se o dono abrir a Katarina com o auto-play ligado, a rotina age na Katarina — e a poção
age nela **sempre**, porque o default dela é `true` e não consulta o campeão.

Prova histórica de que isto já custou: `docs/audit-itens.md` (bug 6 — *«mexia nos itens com o auto-play
DESLIGADO (estragou a Katarina)»*) e `TODO.md:1130` (verbatim do dono: *«e por que ta ativado por padrao, o
auto play desse jeito? é pra desativar por padrao. tu que ativa na hora de mexer no yasuo»*).

### 8.2 Acção exacta

1. **Gate único, no topo**: `cfg.champAutorizado` (ex.: `'yasuo'`) e, no início do `tickAutoplay`
   (CÓDIGO `automation.js:3853`), `if (!campeaoAutorizado()) return;` onde
   `campeaoAutorizado()` = `identidadeCampeao().id === cfg.champAutorizado`. O tick é o **ponto de entrada
   único** (CÓDIGO `automation.js:3872`), logo uma guarda ali cobre rotação, itens, poções e base.
2. **Defesa em profundidade**: repetir a guarda nas 5 entradas (`checarEquipMelhor`, `checarRotacao`,
   `checarPocoes`, `supervisarBase`, `checarItens`) — o tick pode não ser o único chamador: há entradas
   periódicas próprias (helper `every()`, CÓDIGO `automation.js:3962`; ex.: `automation.js:3971`).
3. **Poção idem**: o `inject.js` já corre em `world: MAIN` e já envia o kit do campeão por `postMessage`.
   Basta juntar `champ` ao payload e o `content.js` recusar-se a clicar quando não for o autorizado —
   senão o auto-play fica «desligado» mas continua a gastar poções na Katarina.
4. **Estado visível**: mostrar na GUI o campeão detectado + autorizado + a razão de estar parado
   (o `diagnosticoBase` já faz isto para a base; alargar a mesma ideia ao gate).

---

## 9. As 10 acções de maior impacto, por ordem

| # | acção | onde | ganho / razão |
|---|---|---|---|
| **1** | Manter o **planeador e o ator de venda em sincronia** (básico/épico/duplicado → Lojista, S+ intocável, épico-componente da build guardado **nos dois lados**) | `planBag` (`automation.js:230`) ↔ `venderBase` (`automation.js:1558`) | **P0.** Sem isto o `lixo ≥ 1` é eterno e o boneco ping-ponga Fonte↔campo a cada ~20 s sem farmar (HANDOFF §9.7a). Já aconteceu nesta janela com o `3077` |
| **2** | **Equipar os épicos da mochila**: dominância por espaço **antes** da histerese (o +60 «já equipado» já foi removido nesta revisão) | `equiparMelhores` (`automation.js:2017`), histerese (`automation.js:2049`) | É o pedido nº 1 do dono, repetido 2×. Com o alvo já correcto (`[3047, 1018, 3077, 3133, 3044]`) e um ganho de **+2,62%**, a histerese de 5% é a **única** coisa que impede a troca — passá-la resolve `3047`+`3077` para o pé/mão |
| **3** | Ligar **`cfg.autoEquip = true`** (e `autoAtrib = true`) | `automation.js:51`, `48` | Sem isto os passos 2 e 4 **nunca correm sozinhos** — a regra existe mas está desarmada |
| **4** | Gastar os **15 pontos de atributo em Força**, com o modelo **`dano`** | `distribuirAtributos` (`automation.js:1871`), modelo (`automation.js:1875`) | **+17% de dano MEDIDO** (171 → 200) — o maior ganho por minuto de trabalho do lote |
| **5** | **Barra 4/4 com o R dentro** (`aplicarBarra(['Q','W','E','R'])`) e o R deixar de ser excluído fora do chefe | `aplicarBarra` (`automation.js:3518`), `rotacaoSkills` (`automation.js:3539`) | Fecha o 4.º slot vazio e o «fedes nas skills»; o R dá **+30% de penetração por 15 s** (motor.js:706) |
| **6** | **Vender a tranqueira** (básicos sem uso, duplicados; S+ fica) e subir os épicos a equipado | `planBag` + `venderBase` | Mochila 20/24 → ~4/24 e **+4.390 de ouro** recuperado (MEDIDO no lote nv12) |
| **7** | **Gate de campeão**: autoplay e poção só no Yasuo | `tickAutoplay` (`automation.js:3853`) + `content.js` (`content.js:21`) | Cumpre a regra explícita do dono; impede repetir o estrago da Katarina (audit-itens.md #6) |
| **8** | **Ornn sem fricção**: marcar `_ultimaMontagem` também quando não há candidato; alvo de ouro = custo do próximo craft + 20.000 | `montarMelhorReceita` (`automation.js:2861`, `2864`) | Deixa de abrir a bancada em vão; e define **quanto ouro** faz sentido ter (44.900 / 94.700 / 107.150) em vez de 64.300 parados |
| **9** | **Região com dado de drop**: forçar amostra nas regiões nunca medidas + desempate por `drops` ∩ componentes da build; objectivo `ouro`/`build` | `regiaoIdeal` (`automation.js:3710`, `3739`) | A nv14 aponta **Rota Superior** (dropa a bota lendária `3172` + `3006` + `3044`) e **Lobos** (`3046` + `3086`); Campo Azul **não dropa nada da build** |
| **10** | **Corrigir o `dpsPorHabilidade`** para escalar o `ratio` com o tipo de dano do campeão (AD para o Yasuo), como já foi feito no `estimarSet` | `automation.js:1019` (errado) vs `automation.js:2161` (certo) | O kit do Yasuo guarda a escala em `ratio` (**AD**, ex.: Q = 0,55) e **não tem** `adRatio`; a linha multiplica por `ap` = 0 num campeão AD ⇒ o dano das skills sai só da base plana. Isso alimenta a **ordem de subir skills**, a **rotação** e a GUI — é a explicação técnica da queixa `TODO.md:1097` (*«o script botou 3 pontos no q, e 2 no espada agil. por que?»*) |

### Nota de sequência

As acções **1** e **3** são pré-condições: sem a 1 o auto-play volta ao ping-pong; sem a 3 nada do eixo 1 e 4
corre. As acções **2, 4, 5, 6** são as que o dono vê (e todas feitas **à mão** em HANDOFF §9.16 — o trabalho
deste documento é provar que a **regra** ainda não as garante). As acções **8, 9, 10** são as que mudam o ritmo
de longo prazo.

---

## 10. `indecidivel-sem-jogo`

| # | pergunta | por que não fecha no papel | como fechar |
|---|---|---|---|
| I1 | **Quais são os 16 básicos A da mochila** (e portanto se há 2× `1042` para o craft do `3144`) | o relatório do estado só nomeia 4 dos 20 slots | `scanBag().items` (CÓDIGO `automation.js:96`) ou o `#mochila` |
| I2 | **Preço real de compra no mercado** | a fórmula é do servidor; o motor não a tem (`build-yasuo.md` §5.3/I2) | `comprarNoMercado` + registar o preço pago |
| I3 | **DPS real** (define a região ideal) | depende do alvo e do tempo real | `meuDps()` (CÓDIGO `automation.js:795`) deriva-o de `farm.cycles` |
| I4 | **Taxa de ouro/min actual** | varia entre janelas (1.260 medido vs ~780 na janela de HANDOFF §9.7f) | medir 5–8 min com o contador de ouro |
| I5 | **AS base e AS por nível do Yasuo** | `dados-yasuo.js` não está no repositório (`motor.js:4`; `build-yasuo.md` §0/I1) | equipar/desequipar 1 Adaga e ler `#st-va` |
| I6 | **O R entra na rotação real?** | o motor exige alvos no ar (`motor.js:706`); depende do combate | medir dano com R na barra vs fora (`build-yasuo.md` T12) |
| I7 | **Distribuição de atributos actual** (gastos, não livres) | o HUD mostra os **livres** | ler `#atributos [data-valor]` |
| I8 | **Horas de farm já corridas na conta** | só existem nos ciclos da própria conta | `farm.cycles` (`startedAt`/`endedAt`) |

---

## 11. Anexo — revisão e âncoras

Todas as linhas citadas foram resolvidas por pesquisa sobre o ficheiro no momento da escrita:
**`extension/automation.js` — 4009 linhas / 257619 bytes / mtime 2026-10-14T15:22:48.870Z**. Como o ficheiro está a ser editado em paralelo, a âncora útil
é sempre **função + linha**, nunca a linha sozinha.

Resumo das âncoras mais usadas (revisão acima):

| o quê | âncora |
|---|---|
| regras de protecção de item | `automation.js:201` (`acimaDeA`) |
| plano da mochila | `automation.js:230` (teto de básicos `260`) |
| venda no Lojista | `automation.js:1558` (limiar `1588`) |
| leitura de skills | `automation.js:671` |
| subir skills | `automation.js:1431` |
| DPS por habilidade | `automation.js:1005` (linha do defeito `1019`; versão correcta em `2161`) |
| equipar melhor | `automation.js:2017` · `sinergiaDe` `2722` (o +60 de incumbência está removido, comentário em `2729-2738`) · histerese `2049` · `valorDe` `2747` |
| atributos | `automation.js:1871` · modelo `1875` |
| região | `automation.js:3710` · filtro `3720` · medido `3739` · `estimarRegiao` `809` |
| Ornn | `automation.js:2847` (corte `2861`, throttle `2864`) · motor `motor.js:3135` |
| automação | `automation.js:3853` · poção `content.js:20` |
| motor (atributos/skills) | `motor.js:484` · `motor.js:503` · `motor.js:1048` · `motor.js:900` · `motor.js:29` |
| HUD dos pontos | `jogo.js:6529` · `jogo.js:6532` · `jogo.js:6608` |

### O que este documento **não** decide

A build lendária final (o alvo de aquisição) é matéria de `docs/build-yasuo.md` — aqui o IDEAL é sempre
**alcançável com o que existe**. As duas listas divergem de propósito: `buildIdeal()` (CÓDIGO
`automation.js:3034`) é o alvo teórico (`3172 · 3046 · 6631 · 3085 · 3031`, todos lendários),
enquanto o IDEAL-de-agora é `3047 · 3077 · 3044 · 3133 · 1018`. **Equipar o segundo não atrasa o primeiro** —
é o caminho para ele (os lendários vêm do Ornn/mercado, e o Ornn consome componentes).

---

## Eixos IDEAL vs ATUAL — Katarina nv 29 (medido 2026-10-14, relay 9224)

> Metodo: tudo lido do jogo a correr. Nada inferido. Onde o motor e a fonte, o motor e citado.

| eixo | IDEAL | ATUAL medido | GAP | accao |
|---|---|---|---|---|
| itens equipados | 3175, **3089**, 3135, 3100, **6653** | 3175, 3089, 3100, **4629**, 3135 | `4629` (acessorio) devia ser `6653` Liandry | comprar/montar `6653` (nao dropa: 0,004%/h) |
| mochila | so o que serve a build | 18 itens, **zero basicos** | 9 epicos A/B/C + 4 duplicados de `3075` | vender no Lojista (regra: epico/duplicado) |
| skills: pontos | 0 por gastar | **0** (soma dos ranks 29 = nivel) | — | nada |
| skills: barra | `[R, Q, A, W]` | `[Q, A, G, F]`, 4/4, 0 vagas | **a ULTIMATE `R` (rank 3/5) esta FORA**; `G` e `F` (rank 1/10) estao dentro | `aplicarBarra()` — mas so corre com auto-play (Katarina `enabled=false`) |
| atributos | 0 por distribuir | **0** | — | nada |
| nivel/regiao | regiao que maximiza ouro+xp/min | nv 29 em Fosso do Dragao [30,40] | zona acima do nivel (sem penalidade) | manter |
| ouro | — | 9.600.000 | suficiente p/ Rabadon (3500) | nao e o ouro que falta |
| automacao | auto-play so no Yasuo | Katarina `enabled=false`, marker `on` | — | **regra cumprida** |

### Nota sobre a barra

`barraIdeal()` devolve `[R,Q,A,W]` e o motor tem `aplicarBarra()`. A barra real nao foi corrigida
porque o auto-play esta DESLIGADO na Katarina (regra do dono) — logo o motor nao age. Nao e um
bug do motor: e o comportamento pedido. O GAP existe e sera fechado quando o auto-play correr.

**Armadilha medida:** `#hud-pontos` mostra sempre `"+ Pontos para usar "` (rotulo fixo no DOM),
mesmo com 0 pontos. Nao serve de evidencia de pontos por gastar — a verdade e `readSkills().pontos`.
