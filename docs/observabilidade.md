# Observabilidade — o que o motor da extensão DEVE ver vs. o que vê HOJE

> **Frente:** OBSERVABILIDADE. **Escritor único deste ficheiro:** esta frente. Não se alterou
> `extension/` nem `tools/testes/` (proibido nesta frente).
>
> **Objectivo do dono (verbatim):** *"NADA, LITERALMENTE NADA, ERA PRA SER SURPRESA OU INESPERADO,
> JA QUE TU PODE VER O CODIGO DO JOGO TU MESMO, E CALCULAR AS COISAS TU MESMO. agora faz TUDO ser
> observavel, TUDO ser calculavel, e NADA ser surpresa."*
>
> **Método:** cada afirmação tem `file:linha`. Nada foi inferido de resumo. Onde a fonte não está no
> repositório (`index.html` da página — **não existe** em `docs/game-src/`; `glob **/*.html` só devolve
> `extension/popup.html`) diz-se explicitamente. Onde falta decisão do dono escreve-se
> **PRECISA DE REGRA DO DONO**.

---

## 0. O facto que decide tudo: o estado do jogo NÃO é global

| facto | prova |
|---|---|
| O estado vivo é uma variável de módulo, não um global | `docs/game-src/jogo.js:83` — `let estado = salvo.estado;` |
| O combate vivo também é de módulo | `docs/game-src/jogo.js:96` — `let combate = M.criarCombate();` |
| O analisador do jogo também | `docs/game-src/jogo.js:524` — `let analise = novaAnalise();` |
| Não há `window.estado` / `globalThis.estado` em lado nenhum | `grep "window\." jogo.js` → só `visualViewport` (`jogo.js:398`), `mouseup`/`blur` (`1456-1457`), `open()` (`1786,1891,2019,3412`), `pointermove/up` (`4443,4452`). `grep globalThis` → só `mapa.js:267` e `arena-pvp.js:13` (devicePixelRatio / process.env) |
| `estado`/`combate`/`analise` **não são exportados** por `jogo.js` | `grep "^export"` em `jogo.js` não devolve `estado`, `combate` nem `analise` |
| `motor.js` exporta as REGRAS (`CURVA`, `MONSTROS`, `KITS`, `novoEstado`…), **não o estado vivo** | `docs/game-src/motor.js:998` (`novoEstado`), `:1053` (`criarCombate`), `:1066` (`criarMonstro`) |

**Consequência:** a extensão só pode observar por **três canais**:

1. **DOM** (o que `jogo.js` escreve: `atualizarUI`/`atualizarHud`/`log`).
2. **Canvas** (`inject.js` hooka `fillText`, `extension/inject.js:94-97`).
3. **Wrap de métodos públicos de classe** — o único canal que chega ao estado vivo. `inject.js` já o
   usa em `Cena.prototype` (`extension/inject.js:171-180`, `:189-200`). **É este canal que está
   sub-aproveitado: 3 métodos envolvidos de uma superfície muito maior.**

O canal 3 é o único que dá o **estado do motor** (números exactos, antes de qualquer arredondamento de
UI). Os canais 1 e 2 dão **derivados já formatados** — e é daí que vêm os defeitos da §5.

---

## 1. INVENTÁRIO — o que a extensão LÊ hoje

Todos os caminhos estão em `extension/automation.js` salvo indicação.

| # | leitor | fonte (selector / hook) | file:linha | devolve |
|---|---|---|---|---|
| A1 | `readGold()` | `#st-ouro` textContent | `automation.js:201-206` | ouro (com sufixo k/M) |
| A2 | `readLocation()` | `#local-nome` | `automation.js:207-211` | `{text, tier:null, range}` — `tier` é **sempre null** |
| A3 | `readPotions()` | `#hud-pocoes [data-pocao] > b` | `automation.js:212-218` | `{vida, vidaF, vidaS, mana…}` |
| A4 | `mochilaCap()` | `META.mochila` (motor) | `automation.js:221-225` | capacidade teórica |
| A5 | `scanBag(force)` | `#janela-bolsa`, `#mochila > *` (`data-id`, `data-dica`, `class`), `#mochila-qtd` | `automation.js:240-274` (cache 2 s em `:241`) | `{cap, used, espacosEspolio, items[]}` |
| A6 | `parseDica()` | texto de `data-dica` | `automation.js:1324` | stats do item por regex |
| A7 | `readMap()` | `#janela-mapa` + `#marcadores .marcador[data-local]` + `.mk-nome` + classes `ideal/atual/escolhido` | `automation.js:701-719` | marcadores; **abre o mapa** com `press('m')` se vazio (`:705`) |
| A8 | `readSkills()` | `#hud-habs .hud-hab` (`data-t`, `data-dica`, `em`, classe `recarga`) + `#hab-ativas .hab[data-t]` + `#hud-pontos` | `automation.js:903-941` | `{bar[{t,nome,cd,ready}], arsenal[], pontos, pontosAtrib, hudTexto}` |
| A9 | `readEquip()` | `#equip > button.slot[data-id]` + `data-dica` + `class` | `automation.js:943-955` | equipados `{id, base, refino, qual, stats, raridade}` |
| A10 | `readStats()` | `.st` — casa pelo **RÓTULO de texto** `/^(Dano|Armadura|Vel\. ataque|Res\. mágica|Poder|Mana|Crítico|Esquiva|Roubo de vida)(.*)$/` | `automation.js:1208-1218` | 9 stats |
| A11 | `player()` | `readStats` + `#hud-nivel`/`#st-nivel` + `#hud-vida-txt` `/(\d+)\s*\/\s*(\d+)/` | `automation.js:1221-1229` | `{nivel, vida, armadura, rm, dano, poder, va}` |
| A12 | `detectarCampeao()` | `#hud-retrato[data-qual]` (`champ:skin`) + `#hud-habs img` | `automation.js:1259-1279` | campeão/skin |
| A13 | `scanLog()` | `#log > p` (MutationObserver) | `automation.js:813-822`; observer em `:6611-6612` | `{body, chefe, cls}` |
| A14 | `handleLog()` | regex sobre o texto do log | `automation.js:732-800` | ouro/xp por abate (`:757-758`), "chefe apareceu" (`:769`), furioso (`:778-780`), morte |
| A15 | `tarefaEstado()` | `#rastreio-tarefa` (+ `.pronta`) | `automation.js:2915-2920` | `{tem, pronta, texto}` |
| A16 | `lerCofreSlots()` | `.cofre-slot[data-k]` | `automation.js:2844-2855` | itens do cofre |
| A17 | `lerMinhasOfertas()` / `anunciarItem()` | `#janela-mercado [data-cancelar]`, `[data-escolher]`, `#vender-preco`, `[data-anunciar]` | `automation.js:2805-2838` | ofertas / anúncio |
| A18 | venda/lojista | `#janela-venda .cofre-slot[data-separar]`, `#janela-npc [data-palavra="vender"]` | `automation.js:2208-2234` | separadores de venda |
| A19 | Ornn | `#janela-npc .troca-linha.montagem`, `[data-montar]`, `[data-usarGema]`, `[data-receita]`, `#npc-troca [data-slot]`, `.montar-slot.cheio` | `automation.js:4593-4670` | bancada |
| A20 | barra de combate | `#barra .hab[data-t]` | `automation.js:5617-5620` | `{tipos, n, vagas}` |
| A21 | tarefas/ofertas | `#npc-troca .troca-linha [data-tarefa=k]` | `automation.js:2883-2909` | ofertas do Capitão |
| A22 | `live` (ponte) | `window.__lolidleLive` | lido em `automation.js:787, 830, 1576, 1892, 3585, 5791`; escrito em `extension/content.js:367` | `hp, target, boss, carga, furia, hit, hitLog, hist, rates, dps, danoHist, potions` |
| A23 | canvas (números) | hook `CanvasRenderingContext2D.fillText` | `extension/inject.js:64-97` | `dmg / heal / shield / mana` com cor e posição |
| A24 | eventos de combate | wrap `Cena.prototype.evento` — **só 2 de 71 tipos** | `extension/inject.js:189-200` | agregado `{out:{fonte:valor}, tomou}` a cada 400 ms (`:187-188`) |
| A25 | aviso do chefe | wrap `chefeCarregaRift` / `chefeGolpeRift` | `extension/inject.js:171-180` | `{mec, dur}` |
| A26 | HP do chefe | poll `cenaLive.chefeBarra.vida` (300 ms) | `extension/inject.js:202` | `{nome, vida 0..1}` |
| A27 | meta estática | `import()` de `motor.js`, `balanco.js`, `itens.js`, `wiki-dados.js` | `extension/inject.js:125-162` | tabelas + kit do campeão |
| A28 | HP (content) | `#hud-vida-txt`, `#st-vida-txt`, `#hud-vida` style.width | `extension/content.js:79-90` | `{cur, max}` ou `{pct}` |
| A29 | alvo (content) | `#hud-alvo` `b` + `small` | `extension/content.js:92-98` | `{name, level, boss}` |
| A30 | poções (content) | `#hud-pocoes [data-pocao]` + classes `zero`/`bloq` | `extension/content.js:100-110` | `{count, blocked}` |
| A31 | chefe (content) | `#log` (regex "apareceu"/"derrotado") | `extension/content.js:178-196` | `bossState` |
| A32 | gatilho de HP | MutationObserver em `#hud-vida` (style) e `#hud-vida-txt` | `extension/content.js:479-492` | dispara a leitura a 10 Hz |

**Resumo do inventário:** 32 caminhos de leitura. **24 são DOM**, 2 canvas, **3 são wrap de método**
(`evento`, `chefeCarregaRift`, `chefeGolpeRift`) e 1 é poll de um campo de instância (`chefeBarra`).

---

## 2. INVENTÁRIO — o que o JOGO expõe e a extensão NÃO lê

### 2.1 Canal 3 — o estado vivo do motor (o mais rico, e o mais desperdiçado)

| estado do jogo | onde vive no motor | prova | legível pela extensão? | a extensão lê? |
|---|---|---|---|---|
| **`combate` INTEIRO** (inimigos + darius) entregue à cena a cada frame | `Cena.prototype.sincronizar(combate, vidaFrac, manaFrac)` | `cena.js:671`; chamado em `jogo.js:669` | **SIM** — wrap do método (o `this` e o 1.º argumento são o estado vivo) | **NÃO** |
| **idem em Runeterra** | `Cena.prototype.sincronizarArena(combate, vidaFrac, manaFrac)` | `cena.js:732`; chamado em `jogo.js:668` | **SIM** | **NÃO** |
| cada inimigo: `nome, nivel, chefe, magico, hpMax, hp, ad, as, armadura, ouro, xp, acumulos, chegada, id, distancia, x, y` | `criarMonstro()` | `motor.js:1066-1075` | SIM (dentro do `combate`) | NÃO |
| flag **`invocado`** (larvas do Barão / Crias da Vilemaw) | `criarMonstro(..., {invocado:true})` | `motor.js:3118` (Barão), `arena.js:1771` (Vilemaw) | SIM (dentro do `combate`) | NÃO |
| estado da mecânica do chefe: `mecK, mecAtual, tMec, carregando, furiaT, as` | `mecanicaChefe()` | `motor.js:3084, 3086-3111, 3117-3124` | SIM | NÃO (só recebe o aviso `chefeCarrega`) |
| recargas exactas: `combate.darius.recargas[t]` (segundos) | `criarCombate()` / decremento | `motor.js:1055`, `motor.js:1363` (decremento), `motor.js:1581` (set) | SIM | NÃO |
| timers de item: `d.timers.{zhonya,sterak,anjo,banshee,luden,couraca,quebra,pocao}` | `criarCombate()` + consumo | `motor.js:1056`, `:1688-1698`, `:2698-2730` | SIM | NÃO |
| proc do Lich Bane: `d.lich` | set `motor.js:1944`, consumido `motor.js:1688` | idem | SIM | NÃO (e **não há** no DOM) |
| queima do jogador (chefe): `d.queimando`, `d.queimaDano` | set `motor.js:3105-3108`, decremento `motor.js:1358-1359` | idem | SIM | NÃO (e **não há** no DOM) |
| queima do monstro (Liandry/veneno): `i.queima.{t,dps}` | `motor.js:1652-1654` | idem | SIM | NÃO |
| Égide Solar: `d.solarT` | `motor.js:1634` | idem | SIM | NÃO |
| Mão do Barão: `estado.buffBarao` (180 s, +25% dano, +50% regen, recall 2 s) | `motor.js:3067`; `motor.js:1784` | idem | SIM + DOM (`#buff-barao`) | NÃO |
| escudo activo: `d.escudo` | `motor.js:2718`, `:1229`, `:2726` | idem | SIM + DOM (`(+N)`) | NÃO |
| vida/mana fraccionárias entregues à cena | argumentos de `sincronizar` | `jogo.js:668-669` | SIM | parcial (usa `__lolidleLive`) |
| espólios/gemas: `estado.espolios`, `estado.gemas` | `motor.js:1009-1010`; ganhos `motor.js:1779-1783` | idem | SIM (via evento `abate`) | NÃO |
| persistência da forja (falhas): `estado.persistencia` | `motor.js:68-75` (regras), lido em `motor.js:98`, `:3160-3162` | idem | SIM (se `estado` fosse alcançável) | NÃO |
| cofre: `estado.cofre`, `estado.ouroCofre` | `motor.js:2965-2974` | idem | SIM (se alcançável) | NÃO |

### 2.2 Canal 3 (b) — os 71 tipos de evento do motor

`emitir(c, tipo, dados)` empilha em `c.eventos` (`motor.js:1169`); `jogo.js` consome-os em
`jogo.js:570-664` e entrega-os a `cena.evento(ev, combate)` (`jogo.js:660`).
O wrap em `extension/inject.js:189-200` **só reencaminha `dano` e `recebido`** (`inject.js:194-195`).

Tipos existentes no motor (todos com `file:linha`), ordenados alfabeticamente:

`abate`(`:1785`) · `abateRoubado`(`:1757`) · `acertoMonstro`(`:1198`) · `adagaGiro`(`:2163`) ·
`adagaSome`(`:2178`) · `arcanaExplode`(`:1256`) · `arcanaMarca`(`:1259`) · `barragem`(`:2580`) ·
`bravata`(`:1695,3761`) · `buffBarao`(`:1784`) · `centelha`(`:1958`) · `chefeCarrega`(`:3124`) ·
`chefeGolpe`(`:3094,3098`) · `chefeInterrompido`(`:3089`) · `chefeInvoca`(`:3119`) ·
`chegouBase`(`:1399`) · `cloneGolpe`(`:2478`) · `convergencia`(`:1502`) · `corteFantasma`(`:1715`) ·
`cura`(`:1289`) · `dancaCorte`(`:1493`) · `dano`(`:1224,1648,1654,1805,1806,1852,2240`) ·
`deslumbrar`(`:2308`) · `divisao`(`:2433,3751`) · `dominioCresce`(`:1483`) · `esquiva`(`:1731`) ·
`facetado`(`:2297`) · `fluxo`(`:2716,3729`) · `gosma`(`:2408`) · `gosmaPega`(`:2421`) ·
`gosmaSome`(`:2447`) · `grupo`(`:1424`) · `habilidade`(`:1582`) · `iluminacao`(`:1918`) ·
`iscaSome`(`:1539`) · `iscaTiro`(`:1537`) · `item`(`:2699,2723,2726,2730,3785`) · `kite`(`:2690`) ·
`lotusFim`(`:2194,2211`) · `lotusLeva`(`:2192`) · `luden`(`:1949`) · `mascoteAtaque`(`:1602`) ·
`mascoteNivel`(`:3568`) · `mitoseFim`(`:2480`) · `morreu`(`:2785`) · `nivel`(`:2806`) ·
`pocaFim`(`:2470`) · `pocao`(`:1305,1306`) · `poder`(`:1280`) · `portalAtravessa`(`:1522`) ·
`portalFecha`(`:1529`) · `prisma`(`:1939`) · `quique`(`:2458`) · `quiqueFim`(`:2461`) ·
`rastro`(`:1265`) · `recall`(`:3062`) · `recallCancelado`(`:3054,3058`) · `recebido`(`:2721,3734`) ·
`renasceu`(`:1348`) · `resplendor`(`:2314`) · `ressonancia`(`:1267`) · `reuniu`(`:2439`) ·
`ricochete`(`:1555`) · `ricocheteExplode`(`:1560`) · `rotinaVolta`(`:1408,1412`) ·
`semPocao`(`:1307`) · `sombraGolpe`(`:1220`) · `tarefaPronta`(`:3453`) · `tempestadeFim`(`:2206`) ·
`varinhaVolta`(`:1512`) · `ventoBloqueia`(`:2707`)

**71 tipos; 2 observados. 69 perdidos.**

Payloads que valem ouro (o `emitir` espalha `dados` no objecto do evento, `motor.js:1169`):

| evento | payload real | prova |
|---|---|---|
| `abate` | `{alvo, nome, ouro, xp, chefe, furioso, itens[], perdidos[], espolios[], gemas[]}` | `motor.js:1785` |
| `dano` | `{alvo, valor, fonte, critico, magico}` | `motor.js:1224` |
| `recebido` | `{valor, magico, origem, frac}` | `motor.js:2721` |
| `chefeCarrega` | `{alvo, mec, dur}` | `motor.js:3124` |
| `chefeGolpe` | `{alvo, mec, bloqueado?}` | `motor.js:3094,3098` |
| `chefeInvoca` | `{alvo}` | `motor.js:3119` |
| `item` | `{nome}` (Banshee/Stasis/Pele de Aço/Renascimento) | `motor.js:2699,2723,2726,2730` |
| `luden` | `{alvos[]}` | `motor.js:1949` |
| `kite` | `{recuo, folego, alvos[]}` | `motor.js:2690` |
| `bravata` | `{alvo, resta}` | `motor.js:1695` |
| `fluxo` | `{escudo}` | `motor.js:2716` |
| `morreu` | `{}` (e `morrer()` faz a penalidade) | `motor.js:2785`, `:2763` |
| `nivel` | `{nivel}` | `motor.js:2806` |
| `recall` | `{dur}` | `motor.js:3062` |

### 2.3 Canal 1 — DOM escrito pelo jogo e NUNCA lido pela extensão

Todos confirmados com `grep` na pasta `extension/` = **0 ocorrências**.

| elemento | conteúdo real | escrito em | a extensão lê? |
|---|---|---|---|
| `#hud-buffs` | um `<span class="hud-buff" data-t="K"><em>segundos</em><b>acúmulos</b></span>` por efeito activo | `jogo.js:6164-6177` (tabela `BUFFS` em `6139-6150`) | **NÃO** (grep `hud-buffs` = 0) |
| `#hud-equip > i > .hud-cd` + `<em>` | recarga de ITEM: `--cd` = falta/duração, `em` = s ou "Nm" | `jogo.js:6181-6193` (`RECARGA_ITEM` em `6181`) | **NÃO** (grep `hud-equip`/`hud-cd` = 0) |
| `#hud-habs .hud-hab` `--cd` | **fracção EXACTA** da recarga (3 decimais) | `jogo.js:6228` | **NÃO** (grep `--cd`/`getComputedStyle` = 0) |
| `#barra .hab .recarga` `style.height` | fracção da recarga em % | `jogo.js:6605` | NÃO |
| `#habilidades .hab .recarga` `style.height` | fracção da recarga em % | `jogo.js:6600` | NÃO |
| `#hud-habs .hud-hab.sem-mana` | mana insuficiente para a skill | `jogo.js:6232` | NÃO |
| `#hud-habs .hud-hab.aprimorada` | Yasuo: o próximo Q é o tornado | `jogo.js:6237` | NÃO |
| `#hud-habs .hud-hab > b` | custo (mana ou % de vida, ex. Zac) | `jogo.js:6234-6236` | NÃO |
| `#hud-mana` + `#hud-mana-txt` (+ classes `fluxo`/`cheio`/`sem`) | mana / Fluxo do Yasuo | `jogo.js:6201, 6205-6209` | **NÃO** (grep `hud-mana` = 0) |
| `#hud-vida-txt` com `(+N)` | **escudo activo** | `jogo.js:6203` | parcial — a regex de `player()` (`automation.js:1224`) descarta o `(+N)` |
| `#hud-vida.baixa` (classe no parent) | HP < 30% | `jogo.js:6202` | NÃO |
| `#hud-xp-barra`, `#hud-xpb-barra`, `#hud-xpb-txt`, `#hud-xp-txt`, `#hud-retrato[--xp]` | XP e % para o próximo nível | `jogo.js:6218-6225` | **NÃO** (grep `hud-xp`/`hud-xpb` = 0) |
| `#hud-hora` | `☀ 14:32` / `☾ 03:10` — **dia ou noite** | `jogo.js:6473` | **NÃO** (grep `hud-hora` = 0) |
| `#hud-local` | local/zona/cidade actual | `jogo.js:6470, 6491` | NÃO (lê `#local-nome`) |
| `#local-desc` | "Voltando para a base… Xs" / "Você está morto…" | `jogo.js:6511` | NÃO |
| `#hud-alvo .alvo-vida > i` `style.width` | **HP % do alvo actual** | `jogo.js:6552` | **NÃO** (grep `alvo-vida` = 0; está documentado em `docs/lolidle-internals.md:59`) |
| `#hud-alvo b` `style.color` | faixa de vida do alvo (`corVida` em 5 degraus) | `jogo.js:5952`, `6552` | NÃO |
| `#hud-alvo` tags `☾ noturno`, `✹ furioso`, `✦ mágico` | multiplicadores do monstro | `jogo.js:6552` | NÃO (content.js:92-98 lê só `b`/`small`) |
| `#hud-bolsa-n`, `#hud-bolsa.cheia`, `#badge-itens`(+ `.cheia`), `#badge-hab`, `#badge-atrib` | ocupação da mochila e avisos | `jogo.js:6099-6100, 6527, 6535-6537` | **NÃO** (grep `badge-`/`hud-bolsa` = 0) |
| `#buff-barao` + `#buff-barao-t` | **Mão do Barão** em mm:ss | `jogo.js:6443-6444, 6452` | **NÃO** (grep `buff-barao` = 0) |
| `#buff-disciplina` + `-n` + `-t` | acúmulos da passiva D | `jogo.js:6446-6451` | **NÃO** |
| `#tarefa-txt`, `#tarefa-num`, `#tarefa-barra`, `#tarefa.pronta` | tarefa do Capitão com progresso e % | `jogo.js:6517-6525` | NÃO (só `#rastreio-tarefa`) |
| `#rastreio-login`, `#rastreio-diaria`, `#rastreio-diaria-rift` | prêmio diário e diárias | `jogo.js:6256-6262, 6273+` | parcial (`#rastreio-login` em `automation.js:2039`) |
| `#rastreio-analise` | **XP/h e ouro/h medidos pelo JOGO** | `jogo.js:6250-6255` | **NÃO** (grep `rastreio-analise` = 0) |
| `#janela-analise #analise-corpo` | XP/h, ouro/h, abates/h, DPS, maior golpe, loot por raridade, espólios, runas, mortes | `jogo.js:546-560` (`desenharAnalise`), `563-566` (`abrirAnalise`) | **NÃO** |
| `#st-cdr` | redução de recarga (`−N%`) | `jogo.js:6465` | **NÃO** (grep `st-cdr` = 0; a regex de `readStats` `automation.js:1214` não tem rótulo de CDR) |
| `#st-critx`, `#st-manamax`, `#st-abates`, `#st-mortes`, `#st-xp-txt`, `#st-xp-pct` | dano crítico, mana máx, totais | `jogo.js:6464, 6460, 6466-6467, 6435-6436` | **NÃO** |
| `#st-ouro.pulsa` / `.perde` + chips `.ouro-ganho` | ganho/perda de ouro com o valor | `jogo.js:6401-6406` | **NÃO** |
| `#hud-equip > i` (miniatura + `+N`) | os itens equipados na barra de baixo | `jogo.js:6091-6097` | NÃO |
| `#log > p` (todas as linhas) | chat completo do jogo | `jogo.js:152-160` | parcial (`automation.js:757-780` lê 4 padrões) |

### 2.4 Canal 2 — a instância `Cena` (já alcançada, quase não usada)

`inject.js` já guarda a instância viva em `cenaLive` (`extension/inject.js:186, 193`) e usa **um**
campo (`chefeBarra`, `inject.js:202`). A instância expõe:

| campo | conteúdo | prova |
|---|---|---|
| `criaturas` (Map id→criatura) | `{id, nome, x, y, vida (frac), chefe, distancia, elite, guardiao, miniChefe, noturno, marca, acumulos, atordoado, surgindo, noAr, spriteNome}` | `cena.js:316-317`, preenchido em `cena.js:690-692` (Rift) e `757-759` (Runeterra) |
| `darius` | vida frac, mana, recall, queimando, folego, forcaAcum, poder, grito, furiaS, estandarte, wPronto | `cena.js:673-678`, `735-739` |
| `adagas`, `gosmas`, `paredes`, `sacos` | entidades de habilidade no chão | `cena.js:680-681`, `:2090`, `:734` (jogo.js) |
| `chefeBarra` | `{nome, vida}` do chefe/guardião/Vilemaw | `cena.js:691, 758, 1104` |
| `estadoArena` | o objecto `combate.arena` inteiro | `cena.js:734` |
| `alvoPvp`, `minhaCaveira`, `meuGrupo`, `barao`, `pk` | estado social/PvP | `jogo.js:1185, 953, 1097, 6453, 6486` |
| `tempo`, `morto` | relógio da cena e estado de morte | `cena.js:332, 353` |

---

## 3. LACUNAS ORDENADAS POR IMPACTO

Formato: **O QUE FALTA** → **COMO LER** → **IMPACTO** (o que o motor não consegue decidir).

### P0-1 — O `combate` inteiro (inimigos + darius) nunca chega à extensão

- **Falta:** a lista de inimigos vivos, o HP de cada um, os seus estados (`acumulos, atordoado, noAr,
  marca, noturno, elite, furioso, guardiao, invocado, surgindo, chegada`), as posições, e todo o
  `combate.darius` (recargas, timers, escudo, queimando, lich, folego…).
- **Como ler:** envolver `Cena.prototype.sincronizar` (`cena.js:671`) e
  `Cena.prototype.sincronizarArena` (`cena.js:732`) no mesmo padrão de `inject.js:171-180` e publicar
  um resumo por `postMessage`. O 1.º argumento é o `combate` vivo (`jogo.js:668-669`).
- **Impacto:** sem isto o motor decide **por estimativa** tudo o que é combate de grupo: quantos
  inimigos estão encostados (dano em área: `motor.js:1718-1721`), se vale a pena a habilidade de área
  (`barraIdeal`, `automation.js:5644-5645`), quanto dano falta para matar, se o alvo está atordoado ou
  no ar (`motor.js:1656-1657`), e quanto tempo de chefe falta. **Uma linha de wrap = todo o estado do
  combate.** É o item de maior impacto do relatório.

### P0-2 — 69 de 71 eventos do motor são descartados

- **Falta:** tudo menos `dano`/`recebido` — em especial `abate` (que traz `ouro`, `xp`, `itens[]`,
  `perdidos[]`, `espolios[]`, `gemas[]`, `chefe`, `furioso` — `motor.js:1785`), `chefeInvoca`,
  `item`, `morreu`, `nivel`, `pocao`, `recall`, `buffBarao`, `tarefaPronta`, `chegouBase`.
- **Como ler:** alargar o wrap de `Cena.prototype.evento` (`extension/inject.js:189-200`) para
  reencaminhar o evento inteiro (tipo + campos), em vez de agregar só 2 tipos. O `ev` já chega lá.
- **Impacto:** hoje o abate é inferido **por regex do chat** (`automation.js:757-758`) e o ouro/xp por
  abate vem de texto formatado. Com `abate` o motor tem o número exacto, a raridade dos drops
  (`motor.js:1785`) e a distinção `invocado` (larvas não contam tarefa: `motor.js:1786`).

### P0-3 — A recarga restante de cada habilidade é lida de forma degradada

- **O que o jogo tem:** `combate.darius.recargas[t]` em segundos exactos (`motor.js:1055`, `1581`,
  decremento `1363`).
- **O que o DOM dá:** `--cd` = **fracção exacta** (`jogo.js:6228`) e `<em>` = `Math.ceil(recargas)`
  **apenas se `recargas >= 1`** (`jogo.js:6227`).
- **O que a extensão lê:** só o `<em>` (`automation.js:906`), e devolve `cd: null` quando o `em` está
  vazio (`automation.js:909`); `cdDe()` converte `null` em **0 = pronta** (`automation.js:5658`).
- **Impacto MEDIDO no código:** `barraIdeal()` ordena a barra por "quem está mais perto de ficar
  disponível" (`automation.js:5664-5668`). Com `cd=0` para toda a skill abaixo de 1 s, a ordenação
  perde resolução exactamente na janela de decisão (skills a <1 s). Não é estimativa: é um `null`
  lido como "pronta".
- **Como ler (barato, sem tocar no jogo):** `getComputedStyle(el).getPropertyValue('--cd')` × recarga
  base (`KAT[t].recarga[rank-1] × (1 - CDR)`), ou a altura de `#barra .hab .recarga`
  (`jogo.js:6605`).

### P0-4 — Procs e buffs de habilidade: `#hud-buffs` ignorado

- **Falta:** todos os efeitos activos com **tempo restante** e **acúmulos**.
- **Como ler:** `#hud-buffs .hud-buff[data-t]` → `<em>` = segundos, `<b>` = acúmulos, `--cd` = fracção
  (`jogo.js:6164-6177`). A tabela `BUFFS` (`jogo.js:6139-6150`) diz o que cada `data-t` significa por
  campeão.
- **Impacto:** sem isto o motor não sabe se o próximo golpe vai procar (Sede de Sangue, Sombra Pronta,
  Lich), nem quanto tempo dura o `poder` (5 acúmulos de Hemorragia, `jogo.js:6140`), o `estandarte`,
  o `vento`/`ventania` do Yasuo, o `lotus`/`tempestade` da Katarina. Tudo o que decide "esperar 2 s
  ou gastar agora" está aqui e é invisível.

### P0-5 — Recarga de ITEM: `#hud-equip .hud-cd` ignorado

- **Falta:** o cooldown de 7 itens que o próprio jogo desenha com círculo e segundos.
- **Como ler:** `#hud-equip > i` (na ordem `equipNaOrdem()`) → `.hud-cd` (`--cd` = falta/duração) e
  `<em>` (segundos ou "Nm"). Mapa em `jogo.js:6181`:
  `3157 zhonya 120`, `3053 sterak 90`, `3026 anjo 300`, `3102 banshee 40`, `6655 luden 6`,
  `3742 couraça 4`, `6631 quebra 5`.
- **Impacto:** o motor sabe o multiplicador de dano destes itens (ex. Luden `automation.js:3897`,
  `automation.js:4046` cita `motor.js:1945`) mas **não sabe se o proc está pronto**. Em `montar`/
  `escolher build` o valor de um item desses depende de estar fora de recarga; hoje é assumido sempre
  pronto.

### P1-6 — As LARVAS do Barão: nem contagem, nem vida, nem o flag

Ver §4.1 em detalhe.

### P1-7 — O jogo JÁ mede XP/h, ouro/h, DPS e loot — a extensão re-estima

- **O jogo tem** um analisador: `analise` (`jogo.js:523`), `contarAnalise(ev)` (`jogo.js:525-537`),
  `contasAnalise()` (`jogo.js:538-542`) que devolve `{xpH, ouroH, abatesH, dps (último minuto),
  dpsMedio}`, mais `itens {basico, epico, lendario}`, `espolios`, `runas`, `mortes`, `maior` golpe.
- **Onde aparece:** `#janela-analise #analise-corpo` (`jogo.js:546-560`) e `#rastreio-analise` sempre
  visível (`jogo.js:6250-6255`).
- **Como ler:** `#rastreio-analise` (texto `{xp} XP/h · {ouro} ouro/h`) ou abrir `#janela-analise` e ler
  `#analise-corpo .an-cartao b`. Nota: `analise` **não é exportado** (`jogo.js:524`), logo não é
  alcançável por `import()` — só por DOM.
- **Impacto:** a extensão mantém o seu próprio estimador empírico (`kXp`/`kOuro`, `automation.js:1195-1204`)
  e o seu próprio DPS (`automation.js:830-845`). Passa a haver **duas medidas** para a mesma coisa, e a
  do jogo é a que o dono vê no ecrã. Divergirem é uma surpresa garantida.

### P1-8 — `#hud-alvo`: HP % do alvo, cor de vida e tags

- **Falta:** `alvo.hp / alvo.hpMax` (só existe a fracção no DOM), a faixa de vida pela cor, e as tags
  `☾ noturno` / `✹ furioso` / `✦ mágico`.
- **Como ler:** `#hud-alvo .alvo-vida > i` `style.width` (`jogo.js:6552`), a cor do `b`
  (`corVida`, `jogo.js:5952`), e as tags no `textContent`.
- **Impacto:** o "matar em quantos segundos" (critério do dono, `AGENTS.md`) e o dano previsto da
  mecânica (`automation.js:1554-1565`) são calculados sem saber quanto HP falta ao alvo. E o
  `noturno` muda hp ×1,4 / ad ×1,25 / xp ×1,8 / ouro ×1,5 (`motor.js:1096`) — o motor pode estar a
  lutar contra um monstro 40% mais forte sem saber.

### P1-9 — Dia/noite: `#hud-hora` ignorado

- **Falta:** se é noite. O motor define `NOTURNO` (`motor.js:1096`) e `ehNoite` (`motor.js:1093`).
- **Como ler:** `#hud-hora` começa por `☾` à noite e `☀` de dia (`jogo.js:6473`).
- **Impacto:** o alvo pode ser noturno (hp ×1,4) e o motor não sabe. `META.noturno` já foi enviado
  (`inject.js:129`) mas não serve para nada sem o estado dia/noite.

### P1-10 — Mana / Fluxo, escudo e CDR

- **Falta:** `#hud-mana` + `#hud-mana-txt` (`jogo.js:6201, 6209`), a classe `cheio` (Fluxo do Yasuo,
  `jogo.js:6207`), o escudo `(+N)` em `#hud-vida-txt` (`jogo.js:6203`) e `#st-cdr` (`jogo.js:6465`).
- **Como ler:** os selectores acima.
- **Impacto:** `player()` (`automation.js:1221-1229`) não tem mana nem CDR. Sem CDR o motor não
  calcula a recarga efectiva; sem escudo não sabe quanto dano ainda aguenta; sem mana não sabe se a
  skill vai sair (`pode()` em `motor.js:1578` exige `estado.mana >= HK[t].custo`).

### P1-11 — Mochila cheia / avisos: `#hud-bolsa-n`, `#badge-itens.cheia`

- **Falta:** a ocupação da mochila tal como o JOGO a conta (inclui espólios: `espacosLivres`,
  `motor.js:346`) e a classe `.cheia`.
- **Como ler:** `#hud-bolsa-n` (`jogo.js:6099`) e `#badge-itens.cheia` (`jogo.js:6537`).
- **Impacto:** `scanBag()` conta itens do DOM (`automation.js:240-274`) e usa `#mochila-qtd`; o badge é
  a mesma conta feita pelo motor (`M.espacosLivres`). Divergência = a extensão acha que cabe e o jogo
  recusa o drop (`cabeEspolio`, `motor.js:1779`).

### P1-12 — Mão do Barão e Disciplina

- **Falta:** `#buff-barao` + `#buff-barao-t` (mm:ss) e `#buff-disciplina-t` (`jogo.js:6443-6452`).
- **Impacto:** com a Mão do Barão o campeão tem **+25% de dano, +50% de regeneração e recall de 2 s**
  (`motor.js:3067` `BARAO = {duracao:180, dano:0.25, regen:0.5, recall:2}`). Sem ler isto, o motor
  subestima o próprio dano e a própria cura durante 3 minutos, e não sabe que o recall é instantâneo
  (`motor.js:3062`).

### P1-13 — META incompleto: Vilemaw, MUNDO, guardiões de Runeterra

- **Falta no `inject.js`:** `VILEMAW` / `GOLPES_VILEMAW` / `RODIZIO_VILEMAW` / `PREMIO_VILEMAW`
  (`chefe-global.js:9, 34, 43, 51`), `MUNDO` (`arena.js:26`: `{ativo:15, some:20, aggro:5, leash:12,
  respawn:[20,35], regenCidade:0.05, surgir:1.5}`), e os golpes dos guardiões (`golpeAviso`/`pisao`,
  `cena.js:1527`, `arena.js:1662`).
- **Prova de que falta:** `grep -i vilemaw extension/` = **1** ocorrência, e é um regex de log
  (`content.js:187`). `grep VILEMAW` = 0.
- **Impacto:** a Vilemaw aparece em **horários fixos** (13 h e 21 h, `chefe-global.js:15`), com **10 min
  de aviso** (`:16`), dura 60 min (`:17`), tem **ponto fraco a cada 35-50 s durante 8 s com 1,5× de
  dano** (`:26`) e morde quem fica colado a 1,3 tiles a cada 2,2 s (`:29`). Nada disto existe na
  extensão. Um chefe global que aparece a hora marcada é exactamente o que "não pode ser surpresa".

### P2-14 — `readGold()` lê o ouro ANIMADO

- **O jogo anima** o número do ouro durante 650 ms com easing (`jogo.js:6407-6415`) e formata com
  `fmt` (k/M, 1 decimal — `cena.js:225`). `readGold()` (`automation.js:201-206`) lê o valor
  intermédio.
- **Impacto:** `readGold()` é usado para decidir compra (`automation.js:4548, 4609, 4663`), montagem
  (`2651`) e saturação. Entre frames devolve um valor que o jogo **não** tem. O delta exacto está nos
  chips `.ouro-ganho` (`jogo.js:6401-6405`).

### P2-15 — `player().vida` cai no fallback 4188 acima de 10 000 HP

- **Cadeia:** `#hud-vida-txt` = `fmt(vida) / fmt(vidaMax)` (`jogo.js:6203`); `fmt` usa k a partir de
  1e4 (`cena.js:225`); a regex de `player()` é `/(\d+)\s*\/\s*(\d+)/` (`automation.js:1224`), que **não
  casa** com `"12.3k / 20.4k"`; logo `hp` é `null` e `vida` recebe o literal `4188`
  (`automation.js:1228`).
- **Impacto:** acima de 10 000 de HP o motor avalia risco com um HP inventado. O mesmo problema existe
  em `readStats` para `Dano`/`Poder` (parseFloat de `"12.3k"` = 12.3, `automation.js:1215`).
- **Como ler:** `#hud-vida` `style.width` (fracção, `jogo.js:6201`) × o máximo, ou a barra do alvo
  `.alvo-vida > i`.

### P2-16 — `readLocation().tier` é sempre `null`

- `automation.js:210` devolve `tier: null` fixo. O tier existe em `LOCAIS[].tier` (`motor.js:357-372`).
- **Impacto:** baixo (é derivável de `META.locais` por id), mas é um campo morto a fingir de leitura.

### P2-17 — `parseNum` do `content.js` quebra números com sufixo

- `extension/content.js:74`: `String(s).replace(/[^\d]/g,'') ` → `"12.3k"` vira `123`.
- **Impacto:** `readHP()` (`content.js:79-90`) e `potionState()` (`:104-110`) corrompem valores acima de
  10 000 (HP) — o `readHP` é a fonte do gatilho de poção em tempo real (`content.js:467-478`).

### P2-18 — Janelas de cofre/venda só são lidas com a janela aberta

- `.cofre-slot[data-k]` (`automation.js:2845`) e `#janela-venda .cofre-slot[data-separar]`
  (`automation.js:2208`) exigem a janela. O estado real está em `estado.cofre` (`motor.js:2965-2974`),
  inalcançável hoje.

### P2-19 — `#tarefa-*` ignorados

- `#tarefa-txt`, `#tarefa-num`, `#tarefa-barra` (`jogo.js:6522-6524`) dão o progresso da tarefa em
  número; a extensão usa só `#rastreio-tarefa` (`automation.js:2917`) e extrai do texto.

### P2-20 — Classes de estado das habilidades ignoradas

- `sem-mana` (`jogo.js:6232`) e `aprimorada` (Yasuo, `jogo.js:6237`) não são lidas por
  `readSkills()` (`automation.js:903-941`). A `aprimorada` é a única forma de saber que o próximo Q do
  Yasuo é o tornado — um multiplicador real.

### P2-21 — Números copiados à mão no `inject.js` (violação da REGRA Nº3 do `AGENTS.md`)

- `inject.js:133` `meta.curva = { hp: [150,100,1], ad: [9,4.8,0.13], armadura: [5,1.5], xp: [30,7], ouro: [8,3.5] }`
  → duplica `motor.js:273-279` (que ainda multiplica por `ajuste(n)`).
- `inject.js:138` `meta.grupoSpawn = { base: 2, rand: 3 }` → duplica `motor.js:1124`
  (`const qtd = 2 + Math.floor(r() * 3)`).
- `inject.js:139` `meta.respawn = { clear: 1.5, local: 1.2 }` → duplica `motor.js:1625` e `motor.js:3046`.
- **Impacto:** um buff na CURVA passa em claro (é a prova citada no `AGENTS.md`). O `inject.js` corre no
  mundo MAIN e **pode chamar as funções** — o que falta é avaliar e enviar, não adivinhar.

---

## 4. OS TRÊS CASOS PEDIDOS

### 4.1 As LARVAS do Barão — a extensão consegue ver que existem?

**Não. Nem que existem, nem quantas, nem a vida delas.**

O que o motor faz (`motor.js:3117-3121`):

```js
if (tipo === 'invocar') {
  for (let k = 0; k < 2; k++) c.inimigos.push(criarMonstro('Larva do Vazio', Math.max(1, i.nivel - 6), { chegada: 1 + k * 0.3, invocado: true }));
  emitir(c, 'chefeInvoca', { alvo: i.id });
  i.tMec = HAB_CHEFE.invocar.espera;      // 14 s (motor.js:3076)
  return;
}
```

- O Barão é o chefe da zona `barao` (`motor.js:372`, `chefe: ['Barão Nashor', 0.015]`) e a mecânica
  dele é `invocar` (`motor.js:3066`, rodízio em `motor.js:3080`).
- As larvas nascem **2 de cada vez**, com `invocado: true` (`motor.js:3118`) — o que as torna
  **não contáveis para tarefas** (`motor.js:1786`) e **sem saque** (`motor.js:1776, 1781`).
- **A cada quanto:** o `14 s` de `HAB_CHEFE.invocar.espera` (`motor.js:3076`) é só a espera **depois**
  da invocação — a mecânica seguinte sorteada é `tentaculos`, não `invocar` (o índice do rodízio
  `i.mecK++` já avançou, `motor.js:3115`; rodízio `['invocar','tentaculos','acido']`, `motor.js:3080`).
  O ciclo completo é 14 + (1,3 + 9) + (1 + 9) = **34,3 s**, e só aí entra a invocação seguinte
  → **2 larvas por cada 34,3 s** (~3,5/min). (Corrigido em 2026-10-14: antes estava "a cada 14 s".)
- `Larva do Vazio` é também um monstro **normal** do Rio (2 por onda, `motor.js:368`) e do Fosso do
  Dragão (1, `motor.js:370`). Ou seja: **filtrar por nome confunde as larvas do Barão com as selvagens.**
  O único discriminante é `invocado`.

**O que a extensão tem hoje:**

1. `automation.js:1549` conhece o NOME da mecânica (`invocar: {mult: 0, magico: true, nome: 'Invocar Larvas'}`)
   porque `META.habChefe`/`META.mecanicas` vêm do motor (`inject.js:131, 137`).
2. `inject.js:179` recebe `chefeCarrega` — mas **`HAB_CHEFE.invocar.carrega = 0`** (`motor.js:3076`),
   logo para `invocar` **não há aviso de carga nenhum**.
3. `chefeInvoca` é emitido (`motor.js:3119`) mas o wrap de `evento` (`inject.js:194-195`) só passa
   `dano`/`recebido` → **descartado**.
4. A cena reage com um `aviso` **no canvas** (`cena.js:1532-1533`: "O Barão invoca larvas do Vazio!"),
   não no DOM — e o hook de `fillText` filtra por `/^\d/ ` ou `/^\+\d/` (`inject.js:46-47, 70-72`),
   logo esse texto não passa.
5. No DOM, o alvo único `#hud-alvo` só mostra UMA criatura de cada vez, e só se
   `!alvo.chefe && alvo.guardiao == null` (`jogo.js:6548`) — a larva pode aparecer ali, mas nunca as
   duas ao mesmo tempo nem com HP absoluto.
6. `cenaLive.criaturas` (`cena.js:316-317, 690-692`) **contém** as larvas (nome + `vida` frac), mas
   **não contém o flag `invocado`** (a cópia em `cena.js:690-692` não o copia) e a referência
   `cenaLive` não é publicada.

**O que falta, exactamente:**

| falta | como obter |
|---|---|
| saber que o Barão invocou | `chefeInvoca` (`motor.js:3119`) — alargar o wrap de `Cena.prototype.evento` (`inject.js:189-200`) |
| quantas são e a vida de cada | `combate.inimigos.filter(i => i.invocado)` — wrap de `Cena.prototype.sincronizar` (`cena.js:671`) |
| distinguir das larvas selvagens | só o campo `invocado` (`motor.js:3118`); não existe no DOM nem em `criaturas` |
| quanto falta para a próxima invocação | `i.tMec` + `i.mecK` (`motor.js:3084, 3113-3120`) |

**Impacto:** as larvas do Barão batem (ad de um Barão de nível−6, `motor.js:3118` + `criarMonstro`,
`motor.js:1066-1075`) e a extensão não as vê chegar. O dono já foi mordido por esta cegueira: a
prova nº3 do `AGENTS.md` é precisamente *"o Barão invoca 2 larvas a cada 14 s"*.

### 4.2 Os PROCS (Lich, queima, 3153, …)

| proc | estado no motor | prova | no DOM? | a extensão lê? |
|---|---|---|---|---|
| **Lich Bane (3100)** — próximo golpe de habilidade: +0,75×AP | `d.lich` set / consumido | `motor.js:1944` / `motor.js:1688` | **NÃO** (não está em `BUFFS` `jogo.js:6139-6150` nem em `RECARGA_ITEM` `jogo.js:6181`) | NÃO |
| **Liandry / veneno** — queima por segundo | `i.queima.{t,dps}` por monstro | `motor.js:1652-1654` | **NÃO** | parcial (só o dano agregado, `fonte:'queima'`, `inject.js:194`) |
| **Égide de Fogo Solar (3068)** — queima em área a cada 1 s | `d.solarT` | `motor.js:1633-1639` | **NÃO** | parcial (dano `fonte:'item'`) |
| **Espada do Rei Destruído (3153)** — +5% da vida actual no auto | sem estado (passivo por golpe) | `motor.js:1702` (tecto em `motor.js:1190-1191`) | — | — (não há estado a ler) |
| **Eco de Luden (6655)** — a cada 6 s, habilidade bate em 3 | `d.timers.luden` | `motor.js:1945-1949` | **SIM**: `#hud-equip .hud-cd` (`jogo.js:6181`) | **NÃO** |
| **Véu da Banshee (3102)** | `d.timers.banshee` (40 s) | `motor.js:2698-2699` | SIM (`jogo.js:6181`) | NÃO |
| **Zhonya (3157)** | `d.invulneravel`, `d.timers.zhonya` (120 s) | `motor.js:2722-2723` | SIM (`jogo.js:6181`) | NÃO |
| **Pele de Aço / Sterak (3053)** | `d.escudo`, `d.timers.sterak` (90 s) | `motor.js:2725-2726` | SIM (`jogo.js:6181`) | NÃO |
| **Renascimento / Anjo (3026)** | `d.timers.anjo` (300 s) | `motor.js:2729-2730` | SIM (`jogo.js:6181`) | NÃO |
| **Couraça (3742)** / **Quebra (6631)** | `d.timers.couraca` (4 s) / `quebra` (5 s) | `motor.js:1698` / `motor.js:1719` | SIM (`jogo.js:6181`) | NÃO |
| **queima do jogador** (sopro/chuva/ácido do chefe) | `d.queimando`, `d.queimaDano` | `motor.js:3105-3108`; decremento `motor.js:1358-1359` | **NÃO** (não está em `BUFFS`) | NÃO |
| **Rugido do Dragão** (AS ×1,5 por 5 s) | `i.furiaT`, `i.as` | `motor.js:3107`, `:3085` | **NÃO** | **falso**: `content.js:166` inventa um timer de 5 s local |
| **buffs de habilidade** (poder, grito, estandarte, vento, lotus, tempestade, sede, veneno, sombra, sinistra, fúria…) | `combate.darius.*` | tabela `BUFFS` `jogo.js:6139-6150` | **SIM**: `#hud-buffs` com `<em>` segundos e `<b>` acúmulos (`jogo.js:6164-6177`) | **NÃO** |

**Conclusão dos procs:** há **duas famílias** com respostas opostas:
- os que o jogo desenha no HUD (**itens com timer** e **buffs de habilidade**) → **observáveis hoje, sem
  tocar no jogo**, e não são lidos;
- os que o motor guarda só em memória (**`d.lich`**, **`d.queimando`**, **`i.queima`**, **`i.furiaT`**) →
  só pelo wrap de `sincronizar` (`cena.js:671`), e o `content.js:166` já está a **substituí-los por um
  palpite**.

### 4.3 A RECARGA restante de cada habilidade

| fonte | valor | prova |
|---|---|---|
| motor | `combate.darius.recargas[t]` — segundos exactos | `motor.js:1055`, set `motor.js:1581`, decremento `motor.js:1363` |
| DOM (`--cd`) | fracção 0..1 com 3 decimais | `jogo.js:6228` |
| DOM (`<em>`) | `String(Math.ceil(recargas))` **só se `recargas >= 1`** | `jogo.js:6227` |
| DOM (classe) | `recarga` ligada quando `f > 0` | `jogo.js:6229` |
| DOM (barra) | `#barra .hab .recarga` `height = f*100%` | `jogo.js:6605` |
| DOM (aba) | `#habilidades .hab .recarga` `height = f*100%` | `jogo.js:6600` |
| leitura da extensão | `cd: recarga ? seg : 0` onde `seg` é `null` se o `<em>` estiver vazio | `automation.js:906-909` |
| uso da extensão | `cdDe(t)` → `b.cd > 0 ? b.cd : 0` (logo `null` → **0 = pronta**) | `automation.js:5658` |

**Resposta directa:** a extensão **não** sabe a recarga restante com precisão. Sabe:
- "está em recarga" (classe `recarga`, `automation.js:907`);
- os segundos **inteiros arredondados para cima**, e **só a partir de 1 s** (`automation.js:906`);
- **nada** abaixo de 1 s — e trata esse caso como **0 (pronta)** (`automation.js:5658`).

A fracção exacta está no DOM em `--cd` (`jogo.js:6228`) e a base da recarga está no kit que a extensão
já recebe (`inject.js:113-115` serializa `recarga`; `automation.js:1232-1244` tem o fallback). A
recarga efectiva = `recarga[rank] × (1 − reducaoRecarga)` — e o CDR é `#st-cdr` (`jogo.js:6465`),
**nunca lido** (§P1-10).

---

## 5. DEFEITOS DE LEITURA JÁ MEDIDOS (não são lacunas: são leituras erradas)

| # | defeito | prova | consequência |
|---|---|---|---|
| D1 | `player().vida` = literal `4188` quando o HP ≥ 10 000 (o `fmt` escreve "12.3k") | `automation.js:1224, 1228` + `cena.js:225` + `jogo.js:6203` | avaliação de risco com HP inventado |
| D2 | `readStats` devolve `12.3` em vez de 12300 para `Dano`/`Poder` acima de 10 000 | `automation.js:1215` + `jogo.js:6454, 6460` + `cena.js:225` | DPS estimado subestimado ~1000× |
| D3 | `content.js` `parseNum` apaga o sufixo: `"12.3k"→123` | `content.js:74`, usado em `content.js:84-85, 96, 107` | o gatilho de poção em tempo real lê HP errado |
| D4 | recarga <1 s lida como **pronta** | `automation.js:906-909, 5658` + `jogo.js:6227` | ordenação da barra perde resolução na janela de decisão |
| D5 | `readGold()` lê o ouro animado (650 ms de easing) e arredondado por `fmt` | `automation.js:201-206` + `jogo.js:6407-6415` + `cena.js:225` | decisões de compra/montagem com valor que o jogo não tem |
| D6 | escudo `(+N)` de `#hud-vida-txt` descartado pela regex | `automation.js:1224` + `jogo.js:6203` | o motor não sabe que tem escudo |
| D7 | `content.js:166` inventa `furiaAte = Date.now() + 5000` em vez de ler `i.furiaT` (5 s, `motor.js:3107`) | `content.js:162-166` | palpite onde havia estado exacto |
| D8 | `readLocation().tier` é `null` fixo | `automation.js:210` | campo morto |
| D9 | `scanBag()` conta itens do DOM, mas quem conta espaços é o motor (inclui espólios empilhados) | `automation.js:240-274` + `motor.js:345-346` | divergência "cabe/não cabe" |

---

## 6. LIMITAÇÕES DESTE RELATÓRIO (o que NÃO consegui verificar)

1. **`index.html` da página não existe no repositório** (`glob **/*.html` → só `extension/popup.html`).
   Todos os ids/classes citados vêm de quem os **escreve** (`jogo.js`/`cena.js`), não do markup. Não
   consigo confirmar, por exemplo, qual o RÓTULO de texto de `#st-cdr` — só que `jogo.js:6465` escreve
   `−N%` nesse id. A afirmação "o CDR não é lido" assenta em: (a) o id nunca aparece em `extension/`;
   (b) a regex de rótulos em `automation.js:1214` não inclui nenhum rótulo de CDR.
2. **Não corri o jogo** (proibido nesta frente: sem CDP, sem browsers, sem jogar). Nada aqui foi
   verificado ao vivo; tudo é leitura de fonte.
3. **Não alterei `extension/` nem `tools/testes/`.** Todas as propostas de leitura são para outra
   frente executar. Em particular, P0-1/P0-2/P1-6 exigem mexer em `extension/inject.js` (mundo MAIN).
4. **`cenaLive` não é publicada** (`inject.js:186` é uma variável local do `import().then()`); hoje só o
   campo `chefeBarra` sai dela (`inject.js:202`). Toda a §2.4 é acessível em potência, não em acto.

## 7. PRECISA DE REGRA DO DONO

1. **Frequência e volume da telemetria nova.** O wrap de `sincronizar` (`cena.js:671`) corre a cada
   frame (`jogo.js:669`). Enviar o `combate` inteiro por `postMessage` a cada frame é inviável; é
   preciso decidir a cadência (o `flush` de combate actual é 400 ms, `inject.js:187-188`) e o que vai
   no resumo. **Isto é política de custo/benefício, não está no motor.**
2. **O que fazer com a informação nova.** Saber que as larvas existem, que o Luden está pronto ou que
   o CDR é 30% só muda decisões se o dono definir o comportamento (ex.: recuar das larvas? gastar o
   proc do Lich na habilidade mais forte?). O motor diz **o que é**; o que fazer com isso é escolha.
3. **Vilemaw.** A extensão hoje ignora-a por completo (`content.js:187` só procura a palavra no log).
   Ir ao encontro dela às 13 h/21 h (`chefe-global.js:15`) é decisão do dono — não é regra do motor.
4. **Duas medidas para a mesma coisa (P1-7).** O jogo já mede XP/h e ouro/h (`jogo.js:538-542`); a
   extensão mede os seus (`automation.js:1195-1204`). Qual é a autoridade quando divergirem?
