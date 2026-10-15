# GUI do auto-play — inventário, problemas e especificação

> **Âmbito**: `extension/gui.js` (painel in-page) e `extension/popup.*` (popup da extensão).
> **Contrato**: a GUI **só lê** o motor (`window.__lolidleAuto`) e **só chama funções que existem**.
> Nada aqui inventa funções do motor; o que falta está em [PRECISA-DO-MOTOR](#precisa-do-motor).
>
> **Nota sobre as citações**: as referências `gui.js:NNN` do inventário apontam para a **revisão
> anterior** do ficheiro (1133 linhas), que foi substituída nesta entrega. O ficheiro actual
> (`gui.js` reescrito) tem outra numeração; as citações servem para localizar o código antigo no
> histórico (git) e continuam válidas como diagnóstico.

---

## 1. Inventário do que existia

### 1.1 `extension/gui.js` — revisão anterior (1133 linhas, IIFE ISOLATED)

**Estrutura**

| Bloco | Linhas | O que faz |
|---|---|---|
| Constantes e ajudantes | 13–31 | chaves de storage, nomes/cura das poções, `fmt`, `$`, `q1`, `qa`, `esc`, `potIcon` |
| CSS monolítico | 34–174 | estilos do painel, do modal de itens e do modal de testes |
| `injectCss()` | 176–183 | reinjecta o `<style>` (já actualizava em vez de duplicar) |
| `build()` | 186–341 | HTML do painel: cabeçalho, 7 abas, 7 `<section class="tabpane">` |
| `buildTestes()` | 343–369 | modal "Testar conjuntos" |
| `poolItens()` | 371–388 | itens da mochila+equipados para os `<select>` do teste |
| `renderTestes()` | 389–457 | lista de conjuntos + agregação das rodadas guardadas |
| `buildModal()` | 459–487 | modal "Escolher itens" |
| `buildRows()` | 489–504 | 3 linhas de poção (aba PvP) |
| `renderConfig()` / `renderTranslation()` | 509–536 | espelha a config e traduz o gatilho de cada poção |
| `renderPlan()` | 538–548 | ouro/local/plano de poções (do `PLAN_KEY`) |
| `renderRegioes()` | 554–575 | tabela de regiões medidas + recomendação |
| `renderFarm()` | 577–609 | ciclo actual + últimos ciclos |
| `renderRank()` | 611–624 | ranking teórico de regiões |
| `renderLutas()` | 626–639 | lutas de chefe (previsto × real) |
| `renderBag()` | 641–665 | plano da mochila (acções do motor) |
| `renderItens()` / `renderItemGrid()` / `renderSelChips()` | 668–713 | equipado, mochila, grelha de itens, chips escolhidos |
| `renderHabs()` | 715–734 | barra de combate + DPS por habilidade |
| `renderStatus()` | 736–771 | vida, poções, última morte |
| `renderLive()` / `renderItemDps()` | 773–814 | painel ao vivo (`window.__lolidleLive`) e DPS por item |
| `save`/`setTab`/`renderLog` | 827–857 | gravação e aba Log |
| `bind()` | 860–1045 | todos os handlers |
| hover / `merge()` / `MACRO` / `renderPlano` / `renderMacro` / `boot()` | 1047–1129 | abertura por hover, defaults, texto do macro, arranque |

**Controlos existentes** (id → handler → função do motor)

| Controlo (id) | Onde | Função do motor |
|---|---|---|
| `ap-on` (ligar/desligar) | 198, 862 | só escreve `enabled` no storage |
| `ap-pause` (pausar/retomar) | 197, 863–877 | `estaPausado`, `pausar`, `despausar` |
| `ap-farm-go` (farmar agora) | 224, 1027–1034 | `regiaoIdeal`, `viajarPara` |
| `ap-scan` (escanear bolsa) | 225, 878 | `scanBag` |
| `ap-base` (rotina de base) | 226, 906–912 | `acaoBase` |
| `ap-tarefa` / `ap-entregar` / `ap-diaria` | 227–229, 888–899 | `aceitarTarefa`, `entregarTarefa`, `aceitarDiarias` |
| `ap-cal` (calibrar k) | 230, 913–918 | `calibrar` |
| `ap-giro` (girar regiões) | 231, 919–925 | `iniciarGiro`, `pararGiro`, `giroAtivo` |
| `ap-mercado` (minhas ofertas) | 232, 926–934 | `salvarOfertas`, `fecharMercado` |
| `ap-mkt-plan` / `ap-mkt-go` | 233–234, 977–995 | `planejarMercado`, `executarMercado` |
| `ap-export` | 235, 879–887 | `exportar` |
| `ap-cfg-autoEquip`/`autoAtrib`/`autoRefino` | 238–240, 900–905 | `getConfig`, `setConfig` |
| `ap-obj` / `ap-troca-itens` | 242–245, 1035–1044 | escreve `config.automation` no storage |
| `ap-pick` / `ap-plan-go` | 297–298, 936–963 | `getMeta`, `planejar`, `viajarPara` |
| `ap-testes` + `ap-tx-*` | 299, 998–1025 | `iniciarTeste`, `pararTeste`, `estado`, `rankRegioes` |
| `ap-save` | 333, 996 | gravação no storage |
| poções `data-on`/`data-val`/`data-unit` | 493–503, 964–976 | escreve `config.potions` (lido por `content.js`) |

### 1.2 `extension/popup.*` — revisão anterior

| Ficheiro | O que existia |
|---|---|
| `popup.html` (43 linhas) | título, interruptor `#enabled`, vida, 4 taxas, 3 chips de poção, última acção, dica de hover |
| `popup.css` (70 linhas) | estilos + CSS morto (`details.config`, `#save`, `.saved` — nenhum desses elementos existe no HTML) |
| `popup.js` (57 linhas) | lê `STATUS_KEY` e escreve `enabled` (linhas 43–46) |

---

## 2. Problemas encontrados (com `ficheiro:linha` da revisão anterior)

### 2.1 Código morto / silencioso

| # | Onde | Problema |
|---|---|---|
| 1 | `gui.js:824` | `renderEquipInfo() { /* reservado */ }` — função vazia, nunca chamada com efeito |
| 2 | `gui.js:608` | `if (f2?.issues?.length && $('ap-log')) { /* mostrado na aba Log */ }` — no-op |
| 3 | `gui.js:676` | `if (ob && est.mochila) ob.textContent = '';` — limpa um rótulo para nada |
| 4 | `popup.css:64–70` | `details.config`, `#save`, `.saved` sem elementos correspondentes |

### 2.2 Botões que não dizem nada quando falham

| # | Onde | Problema |
|---|---|---|
| 5 | `gui.js:952` | se `planejar()` devolve `[]` (item sem destino), o clique **não escreve nada** |
| 6 | `gui.js:1030` | `auto.regiaoIdeal?.()` dentro de `try{}` vazio → erro engolido, sem mensagem |
| 7 | `gui.js:888–934`, `977–995` | **12+ botões escrevem no mesmo `#ap-base-out`** (linha 246): a resposta de um apaga a do outro e fica longe do botão clicado |

### 2.3 Estados inexistentes ou enganadores

| # | Onde | Problema |
|---|---|---|
| 8 | `gui.js:758` | o ponto de estado usa `status.enabled` (auto-poção) e não `cfg.enabled` (auto-play): pode ficar **verde com o auto-play desligado** |
| 9 | `gui.js:197–333` | nenhum botão tem estado (a correr / indisponível / bloqueado); nada de `disabled` |
| 10 | `gui.js:585, 573` | números sem unidade explícita ("kills 12", "golpe 900") |
| 11 | — | **não existe botão de PÂNICO** (só `ap-pause`, que não desliga o auto-play) |

### 2.4 Acções destrutivas sem confirmação

| # | Onde | Acção |
|---|---|---|
| 12 | `gui.js:906` | `ap-base` → vende itens ao lojista, sem confirmar nem listar o que vende |
| 13 | `gui.js:988` | `ap-mkt-go` → cancela e reanuncia ofertas no mercado |
| 14 | `gui.js:919` | `ap-giro` → tira o personagem da região durante minutos |
| 15 | `gui.js:946–963` | `ap-plan-go` → **liga o script e fixa a região** sem avisar |

### 2.5 Desempenho

| # | Onde | Problema |
|---|---|---|
| 16 | `gui.js:1125` | `renderPlano()` a cada 6 s: `planoTodos()` recalcula a **build ideal de TODOS os campeões** mesmo com a aba Macro fechada |
| 17 | `gui.js:558` + `1125` | `renderRegioes()` sem argumento chama `agregar()` no motor a cada 6 s |
| 18 | `gui.js:1127` | intervalo de 1,5 s a tentar desenhar a grelha de itens (até 40 tentativas = 60 s) |
| 19 | `gui.js:19` | `nomeItem()` chama `getMeta()` em cada uso, dentro de `.map()` (linhas 658, 675, 680) |

### 2.6 Gates que podem nunca passar

| # | Onde | Problema |
|---|---|---|
| 20 | `gui.js:1124` | o hover em `#st-nome` só é tentado durante 30 s (60×500 ms); se o nome aparecer depois, o painel fica **inalcançável** (não havia alternativa: nem botão, nem atalho) |
| 21 | `gui.js:965–966` | `q1('[data-on=…]')` sem guarda de `null` |
| 22 | `popup.js:35` | `chip.querySelector('b').textContent` sem guarda de `null` |
| 23 | `popup.js:17–19` | escrita directa em `#hp-txt`/`#hp-fill` sem guarda |

### 2.7 Legibilidade

| # | Onde | Problema |
|---|---|---|
| 24 | `gui.js:319–321` | aba "PvP" com o título técnico *"Auto-poção «normal» (PvP) … Só vale com a smart desligada"* |
| 25 | `gui.js:242–245` | "objetivo de farm", "trocar itens por contexto (mob × chefe)" — jargão sem tradução |
| 26 | `gui.js:668` | `rarDe()` com o id `'1058'` *hardcoded* como épico (frágil) |
| 27 | `gui.js:1074–1081` | a explicação da ordem do motor (`MACRO`) só existia na aba "Macro", sem glossário |

---

## 3. O que um utilizador quereria (e foi implementado)

| Eixo pedido | Onde vive agora | Como aparece |
|---|---|---|
| **Estado** (nível, ouro, HP, local, região ideal, fase actual) | aba **Agora** + cabeçalho | mini-cartões no topo + cartão "Estado do personagem" + "O que o auto-play está a fazer AGORA" |
| **Auto-play** (ligar/desligar, objetivo, região, pânico) | aba **Auto-play** + cabeçalho | interruptor mestre, `⛔ PARAR TUDO` / `▶ RETOMAR TUDO`, objetivo XP/ouro/runas, região automática ou fixa com lista medida |
| **Itens** (build actual vs ideal + GAP, mochila, vendas e porquê, blindados) | aba **Itens** | frames do equipado vs ideal, lista do que falta, "Blindados — nunca são vendidos", plano da mochila com motivo por item |
| **Skills** (barra com ultimate, ordem de unlock/subida, pontos) | aba **Habilidades** | barra com marca de ULTIMATE, pontos livres, tabela de ordem de subida (mesma regra do motor), DPS por habilidade |
| **Atributos** (distribuição actual e pontos livres) | aba **Atributos** | tabela lida de `#atributos [data-valor]`, pontos livres, modelo, sugestão do campeão, stats de combate |
| **Farm** (ouro/xp por minuto, histórico por região, previsor real vs teórico) | aba **Farm & ganhos** | "Ganhos AGORA", previsão (MEDIDO vs TEORIA, com n), regiões medidas, ranking teórico, últimos ciclos |
| **Mercado/Ornn** (ofertas, receitas, custo esperado, o que está a ser montado) | aba **Mercado & Ornn** | ofertas lidas, plano de reajuste, receitas do Ornn com chance/tentativas/custo esperado, decisão de compra |
| **Histórico** (mortes, lutas de chefe, ciclos) | aba **Histórico** | mortes com recursos perdidos, lutas previsto × real, eventos traduzidos, problemas detectados |

### 3.1 Regras de legibilidade aplicadas

* **Nomes de utilizador**, nunca nomes de função: `escanear bolsa` → *"Ler a mochila agora"*; `calibrar k` → *"Calibrar previsões"*; `rotacaoSkills` → *"Repor a rotação na barra"*.
* **Uma linha de explicação por controlo** (visível, não só `title`): o componente `acao(id, texto, ajuda)` imprime o botão **e** a explicação por baixo.
* **Unidades explícitas**: `ouro/min`, `xp/min`, `poções/min`, `abates/min`, `dano/s`, `%`, `s`, `min`.
* **Estados visíveis**: `verde = ligado/a correr` · `cinza = desligado` · `amarelo = à espera/pausado` (pílula de estado, ponto, avisos `ok/warn/err`).
* **Glossário** no botão `?`: 20 termos (mob, chefe, ciclo, tier, blindado, espólio, cofre, Ornn, DPS, calibração, …).
* **Tradução das travas internas** do motor (`TRADUZ_TRAVA`): `enabled=false` → *"o auto-play está DESLIGADO (liga no interruptor aqui em cima)"*.

### 3.2 Regras de UX aplicadas

* **Feedback imediato e único**: todas as acções passam por `executar()`, que (1) pede confirmação quando é destrutiva, (2) marca o botão como ocupado, (3) escreve `a correr…` no rodapé, (4) termina com `✔ feito` ou `✖ motivo`.
* **Nada de botões mortos**: se o motor não tem a função, o botão responde *"esta versão do motor não tem a função X (nada foi feito)"*; se o motor não carregou, *"recarrega com F5"*.
* **Confirmação** em: rotina de base (vende), vender ao lojista, anunciar no mercado, aplicar reajuste, refinar no Ornn (pode descer), montar no Ornn (aposta), gastar pontos de habilidade, distribuir atributos, girar regiões, planear caminho (liga o script e fixa a região).
* **Descoberta**: o painel abre por **hover no nome**, por **botão flutuante `⚙ Auto-play`**, por **F8** e fecha com **Esc**; **📌 fixa aberto** (antes fechava sempre 2,5 s depois de sair).
* **Valores por omissão sensatos**: os defaults do motor não são reescritos pela GUI; a GUI só escreve o que o utilizador muda.
* **Custo controlado**: cada aba tem a sua cadência (Agora 1 s · Habilidades 2,5 s · Auto-play 3 s · Atributos/Mercado 5 s · Itens/Farm/Histórico 8 s) e **nada é recalculado com o painel fechado**. As leituras caras (`agregar`, `preverBuild`, `rankRegioes`, `buildIdeal`) estão em cache (5–30 s) e só correm na aba que as mostra. Ler a mochila (`scanBag`) só acontece ao abrir a aba Itens ou a pedido.

---

## 4. Funções do motor usadas pela GUI (verificadas)

Extraídas de `window.__lolidleAuto` (`automation.js`, objecto exportado) e conferidas uma a uma.
**75 funções, todas existentes** — nenhuma inventada. (O motor cresceu de 146 para 179 funções durante esta entrega, por trabalho de outro agente; a lista foi reconferida no fim.)

```
abrirCofreTesoureira  acaoBase              aceitarDiarias        aceitarTarefa
agregar               anunciarLendarios     barraIdeal            buildIdeal
calibrar              comprarNoMercado      curarBase             despausar
diagnosticoBase       distribuirAtributos   dpsItens              dpsPorHabilidade
ehUltimate            entregarTarefa        estaPausado           estado
executarMercado       exportar              faltandoNaBase        fecharMercado
getConfig             getFarm               getMeta               giroAtivo
guardarNoCofre        identidadeCampeao     iniciarGiro           iniciarTeste
lendariosDaClasse     lerCofreSlots         lerMinhasOfertas      localId
melhorCompra          mercadoSaturado       modeloAtribDe         montarMelhorReceita
necessidadesBase      pararGiro             pararTeste            pausar
pegarPresentes        planBag               planPotions           planejar
planejarMercado       player                preverBuild           pularTutorial
rankRegioes           readEquip             readGold              readLocation
readPotions           readSkills            readStats             receitasOrnn
recomendar            refinarMelhores       regiaoIdeal           reporPocoes
retirarDoCofre        rotacaoSkills         saudeAutoplay         scanBag
setConfig             subirHabilidades      tarefaEstado          testeEstado
trocarSkills          venderBase            viajarPara
```

**Integrações com funções novas do motor** (acrescentadas quando apareceram, sempre por `ler()` — se o
motor deixar de as ter, a GUI simplesmente não mostra a linha, nunca rebenta):

| Função | Onde aparece na GUI |
|---|---|
| `necessidadesBase()` + `faltandoNaBase()` | cartão **"O que falta fazer na base"** (aba Auto-play) e cartão de diagnóstico (aba Agora): lista viva com ✔/⏳ por necessidade |
| `barraIdeal()` | cartão **"Barra ideal"** (aba Habilidades): as 4 skills que o motor usaria e se a barra actual já é igual |
| `modeloAtribDe()` | aba **Atributos**: modelo sugerido para o campeão (pré-seleccionado quando o utilizador não escolheu nenhum) |

**Leituras directas ao DOM do jogo** (documentadas e sem alternativa no motor):
`#atributos .atrib [data-valor]` / `[data-total]` / `[data-atrib]` para a distribuição de atributos
(`docs/ideal-vs-atual.md:433` manda ler exactamente isto). Tudo o resto passa pelo motor.

**Chaves de `chrome.storage.local`** usadas: `lolidleAutoPotion` (config), `:status` (leitura do jogo),
`:farm`, `:agregado`, `:plan`, `:meta`, `:testes` (só leitura dos resultados).

---

## 5. PRECISA-DO-MOTOR

O que a GUI **não pode** fazer hoje sem uma função nova no motor (nada disto foi inventado na GUI):

1. **`PRECISA-DO-MOTOR: pausa comandada por storage`** — o **popup** não tem acesso a `window.__lolidleAuto`,
   logo não consegue chamar `pausar()`/`despausar()`. Hoje o `⛔ PARAR TUDO` do popup desliga
   `enabled` (o motor deixa de agir) mas **não pausa** o motor. Sugestão: o motor observar uma chave
   (`lolidleAutoPotion:pausa` = `{on:true, at}`) e chamar `pausar()`/`despausar()` quando ela mudar.
2. **`PRECISA-DO-MOTOR: nivel no PLAN_KEY`** — o `loop()` publica `gold`, `location`, `potions`, `region`,
   `skills` e `equip` a cada 3 s, mas **não o nível**. O popup mostra o nível do início do ciclo
   (`farm.current.setup.player.nivel`) e diz isso mesmo. Incluir `nivel: player().nivel` no plano
   tornaria o popup exacto.
3. **`PRECISA-DO-MOTOR: atributosAtuais()`** — leitor da distribuição de atributos
   (`{forca, vitalidade, resistencia, agilidade, foco}` com pontos e totais). A GUI lê o DOM
   `#atributos [data-valor]` directamente (funciona, e é o que `docs/ideal-vs-atual.md:433` manda
   fazer), mas o motor já tem os pesos em `META.modelos` e seria a fonte natural.
4. **`PRECISA-DO-MOTOR: progressoBase()`** — `necessidadesBase()`/`faltandoNaBase()` (que o motor
   ganhou durante esta entrega) já dizem **o que** falta; falta saber **em que passo vai** uma rotina
   de base a correr (`_baseBusy`/`baseLock` dizem apenas que está a correr). Sem isso a GUI mostra
   "a correr…" em vez de uma barra de progresso.
5. **`PRECISA-DO-MOTOR: limparResultadosTeste()`** — apagar as rodadas guardadas em
   `lolidleAutoPotion:testes` (a GUI não escreve no domínio do motor; hoje só mostra e agrega).

## 6. Como a GUI nova está organizada

```
gui.js
  0. CONSTANTES E AJUDANTES ....... fmt/esc/fmtDur + traduções de jargão (TRADUZ_TRAVA, ACAO_ITEM, EVENTO_NOME)
  1. PONTE COM O MOTOR ............ chamar()/chamarA()/ler() — nunca rebenta, devolve {ok, v|erro}
  2. KIT DE INTERFACE ............. card, kv, linha, acao, tg, tabela, aviso, fb(), confirmar(), executar()
  3. CSS .......................... estilos do painel + modais (uma string única)
  4. ESTRUTURA (DOM) .............. painel, modais (itens, testes, confirmação, ajuda)
  5. DESENHADORES (render) ........ renderCabecalho/Agora/Auto/Itens/Skills/Atrib/Farm/Mercado/Hist + ajuda
  6. AÇÕES ........................ ACOES[] (por id de botão) + MUDANCAS[] (por id de controlo) + delegação
  7. ARRANQUE ..................... boot(), cadências, F8/Esc, auto-limpeza de timers, window.__lolidleGui
```

* **Delegação de eventos**: um único `click`/`change` no painel resolve o handler pelo `id` do elemento.
  Isto permite redesenhar cartões sem voltar a ligar listeners (e sem perder o foco dos campos).
* **`executar(btn, rotulo, trabalho, opt)`**: o único caminho de uma acção — confirmação, estado
  ocupado, mensagem de progresso, resultado ou motivo da falha.
* **`setHtml(id, html)`**: só escreve no DOM quando o HTML mudou (evita re-layout a cada segundo).
* **Auto-limpeza**: `window.__lolidleGuiTimers` cancela os temporizadores da injecção anterior
  (uma reinjecção do content script não empilha `setInterval`).
* **Acesso programático** (para testes/manutenção, sem tocar no jogo): `window.__lolidleGui = { abrir, fechar, setTab, versao }`.

---

## 7. Verificação feita (sem browser, sem jogo, sem CDP)

* `node --check extension/gui.js` → **rc=0** · `node --check extension/popup.js` → **rc=0**.
* **75/75 funções do motor usadas existem** no objecto `window.__lolidleAuto` (verificação automática
  contra `automation.js`, reexecutada **três vezes** — o motor foi alterado por outro agente durante
  esta entrega, de 146 para 179 funções; a GUI usa 75 e nenhuma desapareceu).
* **Ensaio funcional em Node** (`vm` + DOM universal falso + motor falso com as **formas reais** de
  retorno, copiadas do `automation.js`): arranque, abertura, **as 8 abas**, **47 acções** (dos 54
  handlers existentes) e **18 controlos de mudança** executados → **0 excepções**,
  0 `undefined`/`NaN`/`[object Object]` no HTML gerado.
* **Ensaio no modo degradado** (sem motor e sem leitura do jogo): as 8 abas desenham, todas as acções
  respondem *"o motor do auto-play ainda não carregou nesta página — recarrega com F5"* e **nada rebenta**.
* Esse ensaio apanhou 3 bugs reais antes da entrega: `tabela()` a receber string em vez de array
  (partia a aba Habilidades), o helper de remoção de chips ligado a um contentor que **só nasce
  depois** do `bind()` (o × nunca funcionava), e o `closest('[data-rem]')` sem guarda.
* **Não tocado**: `automation.js`, `content.js`, `tools/`, `TODO.md`, `HANDOFF.md` — nem o browser/jogo/CDP.
