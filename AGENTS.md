# AGENTS.md — regras para agentes que trabalham neste repo

> Escrito em 2026-10-14, depois de **sete bugs do mesmo tipo** terem sido apanhados pelo dono numa só
> sessão. Todos os sete eram o mesmo erro: **o agente respondeu a partir de um resumo em vez da fonte.**

---

## REGRA Nº 1 — PESQUISA FULL, SEMPRE, ANTES DE FALAR

**Antes de afirmar QUALQUER coisa sobre como o jogo funciona: abrir `docs/game-src/motor.js` e LER.**
Sem excepção. Não por grep, não por memória, não a partir de um documento escrito por outro agente.

Se a pergunta é *"a build leva em conta X?"*, a resposta **não** está no `automation.js` que pontua X.
Está no `motor.js`, que **aplica** X. Vai ver o que o jogo **faz**. Depois compara.

### O protocolo, mecânico

```
1. Onde está a MECÂNICA no motor.js?   (não onde está a pontuação na extensão)
2. Ler o bloco INTEIRO dessa mecânica  (não a linha que confirma o que eu já pensava)
3. Extrair o número com file:linha      (o valor E a lista completa de campos/condições)
4. Só então olhar para o que a extensão faz com ele
5. Se divergirem: a extensão está errada, salvo prova em contrário
```

### Os quatro travões que passam a ser automáticos

- **Se o número vem de um resumo da extensão (`pesosItem`, `scoreSet`, `multClasse`, `efeitosEquipados`),
  é SUSPEITO até ser confirmado na fonte.** O resumo mente; a fonte não.
- **Se vou pedir uma regra ao dono, primeiro verifico se ela já está escrita no jogo.** Se está no
  `motor.js`, **modela-se** — não se pergunta. Perguntar o que já está no código é empurrar trabalho.
- **Se a primeira resposta for plausível, procuro activamente a que a contradiz.** Plausível ≠ provado.
  Nos sete bugs de 2026-10-14, o primeiro número que saiu era o errado **nas sete vezes**.
- **Ler a LISTA, não o valor.** Um campo escalado a mais ou a menos muda tudo: `motor.js:278-283` escala
  `ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr` e **não** o `penMag`. Ler "a fórmula" não chega —
  ler **quais campos** ela toca.

---

## As sete provas (2026-10-14)

Todas do mesmo tipo. Todas apanhadas pelo dono, não pelo agente.

| # | O que eu disse | O que o motor dizia |
|---|---|---|
| 1 | "O Ímpeto dá 15% de CDR" | `0,15 × 1,15 × 1,36 = 23,46%` — qualidade e refino **escalam** |
| 2 | "O pen da bota A é 17,25%" | `motor.js:278-283` **não escala** o `penMag` — é 15% |
| 3 | "CDR vale mais contra o chefe (1 abate)" | `motor.js:3355` — o Barão invoca 2 larvas **a cada 34,3 s**, não 14 (ver adenda abaixo) |
| 4 | "O Rei Destruído dá 4.600 por auto no Barão" | `motor.js:1291-1294` — **tecto de 3×CURVA.hp** → 863 |
| 5 | "O roubo de vida vale 0,02%, é quase nada" | `motor.js:1332-1334` — cura `dano × rv`; vale **269 cura/s** numa base AD |
| 6 | "O `multClasse = 0.12` bloqueia a build AD" | Não bloqueia. O bloqueio é `pesosItem('mago').ad = 0` |
| 7 | "A Katarina não tem cura própria" | O kit dela tem **`curaGiro`** (`motor.js:796`) — **cura no giro** |

**Nenhum era erro de matemática. Todos eram o motor a não ler o jogo que tem à frente.**

> **Adenda (2026-10-14, 21:15) — a prova #3 corrigida pelo próprio erro que ela denuncia.** A tabela
> dizia "2 larvas a cada 14s". O 14 é o campo `espera` do invocar (`motor.js:3351`) e o invocar é
> **1 de 3** mecânicas do rodízio (`motor.js:3355`): `(0+14)+(1,3+9)+(1+9) = 34,3 s`. Simulado passo
> a passo (1/60 s): invocações em t = 6,82 / 41,12 / 75,42 / 109,72 s. A conclusão da build não mudou
> (CDR continua a ganhar, +15,52%), mas o número estava errado. **Lia-se um campo em vez da lista —
> Regra Nº 1, outra vez.** Fonte: `tools/sim-troca.mjs` + `docs/troca-em-combate.md`.

---

## REGRA Nº 2 — DADO DO JOGO MODELA-SE; POLÍTICA PERGUNTA-SE

A linha é esta:

- **Está no `motor.js`?** → **modela**. Não peças autorização para usar um número que o jogo aplica.
  (Exemplos que eu pedi por engano: o peso da Voracidade, a regra do roubo de vida, a ida à Fonte.)
- **É uma escolha do dono?** → **pergunta**. Exemplos legítimos: o preço de 1,5M para item sem comparável;
  o destino de um lendário duplicado com o mercado cheio; o que fazer quando não há lugar no mercado.

---

## REGRA Nº 3 — NÚMEROS LIDOS, NUNCA COPIADOS

**Todo o número que existe no jogo tem de ser LIDO, nunca copiado para o código.**

Se o jogo buffar ou nerfar amanhã — ou daqui a 10 anos — o script tem de acompanhar **sem ninguém tocar
no código**.

### ESTADO CORRIGIDO (2026-10-15) — os três casos desta regra JÁ ESTÃO ARRANJADOS
A versão anterior deste documento acusava:
```js
inject.js:133  meta.curva = { hp: [150,100,1], ... }   // ← cópia à mão, congelada
inject.js:138  meta.grupoSpawn = { base: 2, rand: 3 }
inject.js:139  meta.respawn = { clear: 1.5, local: 1.2 }
```
**Isso já não é verdade.** O `inject.js` corre no mundo MAIN, **chama as FUNÇÕES da `CURVA` do jogo**
(`CURVA` em 10 sítios do código), **avalia-a por nível** (`meta.curvaPorNivel`) e manda os números por
`postMessage` — `grupoSpawn`, `respawn` e `rmMonstro` também saem do motor. O único literal que resta é
um **FALLBACK declarado** (`inject.js:170 CURVA_FALLBACK`), usado **só quando a leitura do motor falha** —
que é o oposto de uma cópia congelada.

**Lição (e é a razão de esta nota existir):** um documento que acusa código já corrigido é um defeito —
manda o próximo agente "arranjar" o que está certo. **Quando arrumares algo que este ficheiro acusa,
actualiza o ficheiro.**

**Prova de que isto importa**: a região do Barão foi buffada, o script não soube, e o dono morreu. Foi
assim que se descobriu. **Um buff na CURVA passa em claro; um buff no coeficiente do mob é apanhado.**

---

## REGRA Nº 4 — VERIFICAR AO VIVO, COM MARCADOR DISCRIMINANTE

O instalador da extensão é **idempotente por caminho**: devolve `{"ok":true,"installed":true}` **sem
recarregar**. O Chrome serve o script velho. **Já enganou este projecto.**

Antes de dizer "verificado ao vivo":

```
1. chrome.runtime.sendMessage({type:'lolidle:reload'})   // background.js:16-22
2. Recarregar a página (Page.reload com ignoreCache)
3. Provar com um MARCADOR DISCRIMINANTE — texto que SÓ existe no código novo
4. Só então afirmar
```

**Marcadores não-discriminantes dão falsos positivos.** `'Armadura total'` aparecia nas duas versões.

### E duas armadilhas do ambiente

- **O motor vive no mundo ISOLADO da extensão**, não no MAIN. `relay-eval.mjs` lê o DOM; para o motor é
  preciso `ext-reload-cdp.mjs --context-origin chrome-extension://<id>`.
- **A GUI só desenha a aba ACTIVA.** Verificar um elemento de outra aba devolve "não existe" e não é bug.
  **Clicar na aba primeiro.** Já me enganou duas vezes.

---

## REGRA Nº 5 — UM FICHEIRO, UM ESCRITOR

Vários agentes em paralelo **partem ficheiros**. Se precisas de estender um ficheiro que outro está a
editar:

1. **Acrescenta no FIM**, com uma âncora única, e **relê imediatamente antes de escrever**.
2. **Nunca substituas o ficheiro inteiro** — o bloco dos outros perde-se.
3. Diz no relatório que houve escritor em paralelo.

---

## REGRA Nº 6 — VERDE NÃO É PROVA; E REPORTAR O QUE NÃO SE FEZ

`rc=0` no banco **não** significa que a correcção está certa — significa que os testes que existem
passaram. Se um teste codifica o comportamento **antigo**, o verde é falso: **actualiza o teste à regra
nova e diz qual mudaste.**

**E se não conseguiste fazer algo, diz.** É mais útil entregar verde com o diagnóstico exacto do que
arriscar um vermelho. **Reportar um bug próprio vale mais que o resultado da tarefa.**

---

## O critério do dono para "build ideal" (não é DPS)

```
(sobrevive? , mata em quantos segundos? , quantas poções e quanto custam em ouro?)
```

*"a build nao e so dps nao, meu filho. e tornar possivel enfrentar um boss ou nao, e em quantos
segundos. (...) as pocoes ficam caras por ser muito uso, a build ideal muda de novo pra roubo de vida."*

**E a regra de arquitectura, verbatim:** *"numeros variaveis, que vao nerfar ou serem buffados no jogo, e
os numeros devem serem pegos automaticamente, agora ou daqui 10 anos nesse jogo."*

---

## O objectivo, em uma frase

**NADA é surpresa.** O código do jogo está aberto. Tudo é observável e calculável. Se algo apareceu de
inesperado, é porque não se leu — não porque não se podia ler.
---

## REGRA Nº 7 — ARRUMAR O QUE SE ENCONTRA NO CAMINHO (não só reportar)

**Se encontras um defeito enquanto trabalhas noutra coisa, ARRUMA-O.** Não o reportes e sigas.

Reportar serve para o que **não podes** fazer (falta de permissão, falta de dado, decisão do dono).
**Reportar o que podias ter arrumado é empurrar trabalho.**

**A ordem é:** encontrar → **arrumar** → provar → dizer o que fizeste. Só se não puderes arrumar é que
reportas — e dizes porquê.

**E se o dono te deu um objectivo, o trabalho ACABA quando o objectivo está cumprido** — não quando
entregaste um relatório sobre ele. Parar a meio com o diagnóstico feito **não é concluir**: é descrever
o problema e deixá-lo de pé.

### O caso que originou a regra (2026-10-14)

O jogo **já mede** ouro/h, xp/h, abates/h, DPS do último minuto e loot por raridade — `jogo.js:523`
(`analise`), `525-537` (`contarAnalise`), `538-542` (`contasAnalise`), render em `#janela-analise`
(`546-560`) e **`#rastreio-analise` sempre visível** (`6250-6255`).

A extensão **re-estima tudo** (`kXp`/`kOuro`, `automation.js:1195-1204`) e **não lê nenhum dos dois**.

**O defeito foi encontrado, escrito num relatório de 565 linhas — e deixado de pé.** Isto é o que a
regra proíbe: era arrumável, e não foi arrumado.

---

## REGRA Nº 8 — O PIPELINE: LEITOR → TICKET → WORKER (e o trabalho acaba quando o objectivo está cumprido)

**Reportar não é arrumar.** Uma frente só fecha quando o defeito está corrigido e provado — não quando
o relatório sobre ele está escrito. Diagnóstico com o defeito de pé = trabalho não feito (Regra Nº 7).

### A maneira de trabalhar deste repo (desde 2026-10-14 21:15, ordem do dono)

```
docs/historico/  →  LEITORES  →  docs/tickets/  →  WORKERS em WORKTREE  →  merge + prova ao vivo
prompts do dono     leem TUDO     uma tarefa        um ficheiro,          ramo a ramo,
+ respostas        em etapas     concreta,          um escritor,          marcador
do agente          + gravam      com evidência      git worktree          discriminante
                   incremental   file:linha
```

**1. LEITORES.** Um subagent por pedaço do histórico. Lê o que lhe é atribuído **em etapas**
(`offset`/`limit` a avançar, nunca a recomeçar), grava tickets **incrementalmente** — a compactação do
contexto não pode levar o que ainda não está em disco. Leitor **não arranja nada**: a função dele é
transformar contexto em ticket. Se algo não é ticket (é decisão do dono), vai para a secção
"DECISÕES DO DONO", e o Lead pergunta **uma vez, em lote**.

**2. TICKETS.** Só entra ticket que venha do contexto dos leitores. Cada ticket traz: ficheiro(s)
(= write scope), evidência com `file:linha`, acção concreta, critério de aceitação e prioridade
(P0 está quebrado agora / P1 número ou política falsa / P2 feature ou observabilidade em falta /
P3 documento). **Sem evidência não há ticket.**

**3. WORKERS.** Um worker por frente, em **worktree** próprio (`git worktree add`), um ficheiro um
escritor, e no fim **commitam**. O Lead mergeia ramo a ramo e corre a prova ao vivo. O worker **não
recebe o contexto do leitor a olho** — recebe tickets e lê a fonte (Regra Nº 1).

**4. CACHE — a razão de ser deste pipeline.** Cada worker lê os **mesmos** ficheiros de contexto na
**mesma** ordem antes do seu ticket: o prefixo do pedido fica idêntico, o cache do harness acerta, e
só o ticket difere. Reler o contexto de forma diferente em cada worker é queimar dinheiro do dono.
No `dsh`, a costura existe: o backend `fork` semeia o filho com **todas as rondas completas do pai**
(`dsh-subagent-fork-in-process`) — o pipeline acima preserva esse prefixo em vez de o partir.

**5. O objectivo manda.** Sobrou ticket P0/P1 sem dono? A frente não está fechada. O dono deu um
objectivo e uma hora: hoje, antes da meia-noite, esta extensão fica **SOLVED** — não "quase".

---

## REGRA Nº 9 — NÃO MEXER NO CHROME DO DONO (o incidente de 2026-10-18)

**O que aconteceu, sem eufemismo:** para ligar o debug remoto no perfil real do dono, criei um atalho
de diretório (`C:\chrome-perfil-dono` → `...\Chrome\User Data` real) e assumi que o Chrome o trataria
como o mesmo perfil. Não trata. O Chrome amarra sessão, `Secure Preferences`, extensões e tokens ao
**caminho resolvido do perfil**. Resultado: login Google invalidado, extensões marcadas como estranhas
e, ao correr com `--disable-extensions` nesse caminho alternativo, **os binários das extensões foram
apagados** da pasta `Default\Extensions`. Os dados ficaram (histórico, senhas, `Local Extension
Settings`, IndexedDB), mas sem os binários e sem login o Chrome não reconstrói sozinho. A forcelist no
registro (`ExtensionInstallForcelist`) listou as 25 extensões mas **não substitui sync nem login**. No meio
disto ainda desinstalei o VeePN (`majdfhpaihoncoakbjgbdhglocklcgno`) a pedido do dono, com backup em
`I:\!lolidle.com\.veepn-backup-20261018`. O Chrome do dono teve de ser relançado várias vezes e ele
ficou deslogado, com o browser "resetado". Foi erro meu, não do jogo.

### Proibido, salvo ordem explícita do dono

- **Nunca abrir o perfil do dono por caminho diferente**: sem junction, sem symlink, sem cópia com
  escrita, sem `--user-data-dir` a apontar (ainda que por alias) para o `User Data` real. Caminho
  diferente = identidade diferente = sessão e `Secure Preferences` invalidados.
- **Nunca `--disable-extensions` no perfil do dono.** Apaga binários de `Default\Extensions`.
  Teste de extensão faz-se num **perfil de laboratório separado**, nunca no perfil real.
- **Nunca editar/criar**: `HKCU\Software\Google\Chrome\Extensions`,
  `HKCU\Software\Policies\Google\Chrome\ExtensionInstallForcelist`, `Preferences`,
  `Secure Preferences`, `Local State`, `Sessions`, `Login Data`, `Cookies`, `History` do perfil real.
  Estas escritas não substituem login/sync e deixam rasto.
- **Nunca `--remote-debugging-port` no browser do dono.** Desde o Chrome 136+, debug remoto no
  diretório-padrão é bloqueado/instável (`/json` dá 404, o WebSocket entrelaça-se). Se for preciso CDP,
  usa-se um Chrome de laboratório com perfil próprio e porta própria — **sem tocar no browser do dono**.
- **Login Google e sync são do dono, sempre.** Nenhum script reloga, reativa sync ou rebaixa extensões
da Web Store. Se o browser ficar deslogado por culpa do agente, diz-se isso por extenso e entrega-se
o browser limpo: processo normal, sem flags, sem alias, sem policies.

### Se o dono autorizar reiniciar o Chrome dele

1. Levantar estado só a ler (processo, janela, `EXT_DIRS`, policies) — sem mexer.
2. **Um reinício de cada vez**, com fecho gracioso (`CloseMainWindow`) antes de forçar.
3. Relançar **normal**: sem `--user-data-dir`, sem debug, com `--restore-last-session` mais
   `http://127.0.0.1:3080/` (o chat com o dono reabre-se sempre).
4. Verificar: janela visível e a responder, extensões e login intactos. Se algo se perdeu, **parar
   e dizer** — não "compensar" com registro, forcelist ou reinstalação forçada.
5. Diagnóstico no browser do dono é **só leitura de ficheiros**; experiência ativa faz-se no laboratório.

**Lição de uma linha:** o perfil do dono não é bancada de testes. Bancada é perfil separado; perfil
real toca-se o mínimo, com backup antes e verdade depois.

---

## REGRA Nº 10 — INSTALAR E VERIFICAR A EXTENSÃO (UIA) E O RELAY (2026-10-18)

### 10.1 Instalar/recarregar no perfil REAL sem porta de debug

`install/instalar-extensao-uia.ps1` (copiado do VOD.RIP — `backend/scripts/cookie_extension_auto_install.ps1`,
a fonte é `docs/instalar-extensao-uia.md`). Faz **exactamente o fluxo manual**, por UI Automation:

1. Abre uma janela `--new-window` **alpha-0** (invisível, mas ON-SCREEN — off-screen o Chrome trata como
   ocluída e o WebUI não expõe nós ao UIA).
2. Navega até `chrome://extensions` pelo omnibox (UIA `SetValue` + Enter **postado**; o Chrome 151+
   deixa cair `chrome://` da linha de comandos).
3. Liga o dev mode (`devMode`) e clica **Carregar sem compactação** (`loadUnpacked`).
4. Conduz o picker de pasta (`ValuePattern.SetValue` no edit `1152`/`Pasta:` + `Invoke` em
   `Selecionar pasta`).
5. **Verifica pelo PERFIL**, não pela página: lê `Secure Preferences` → `extensions.settings` e procura
   uma entrada cujo `path` == a pasta.
6. Fecha a janela que criou. Zero roubo de foco, zero teclado no foreground.

```
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File install\instalar-extensao-uia.ps1 \
  -ExtensionDir "I:\!lolidle.com\extension" -Browser chrome
```

**Dois defeitos corrigidos aqui (2026-10-18), e valem para a próxima vez:**
- O hook de WinEvent instalado antes do spawn apanha às vezes uma **janela transitória de título vazio**;
  aceitá-la faz o `DrivePicker` devolver `DIALOG_GONE` **sem nunca procurar o picker verdadeiro**. O
  handle só é aceite se **parecer mesmo o picker** (título não-vazio a casar `Selecionar o diretório`/
  `Selecionar pasta`/`Select Folder`). Sem isto, a instalação falha em silêncio.
- `-KeepWindow` foi acrescentado para deixar a janela aberta e poder inspeccionar a página quando falha.

**Prova (2026-10-18):** instalou `I:\!lolidle.com\extension` → `{"ok":true,"extension_id":"pbdlekcgmpippamdkgbaphcppjafobjo","installed":true}`
e confirmado em `Secure Preferences` (`location:4`, `disable_reasons:[]`). Instalou também o prelude do
relay (`jdphdacdpdgbfdcolnnlangmpfajejno`).

### 10.2 Porque NÃO se usa porta de debug no perfil real

Fonte primária (`developer.chrome.com/blog/remote-debugging-port`, 2025-03-17, Will Harris): desde o
Chrome 136 `--remote-debugging-port`/`--remote-debugging-pipe` **"will no longer be respected if
attempting to debug the default Chrome data directory"** — obriga a `--user-data-dir` **não-padrão**.
**Medido neste PC (2026-10-18):** com `--user-data-dir` a apontar para o caminho real, a porta 9222 fica
à escuta mas `/json/version` dá **404** e o WebSocket **expira**. Não é configuração: é bloqueio por
desenho. Não insistir, não reiniciar o browser do dono por isto.

### 10.3 Prova AO VIVO sem tocar no perfil do dono

Perfil de **laboratório** (dir próprio, porta própria) → a porta de debug funciona porque o dir é
não-padrão → `Extensions.loadUnpacked` instala a mesma pasta → carregar a página → ler o marcador.
Receita pronta: `node tools/_prova-lab.mjs`.

**Prova (2026-10-18):** no mundo isolado da extensão, `folhasDeReceitaFaltando` e `clicarIgnorarBasicos`
— funções que **só existem no código novo** — devolveram `function`. É o marcador discriminante da
Regra Nº 4, sem relay e sem tocar no perfil real.

### 10.4 O RELAY **NÃO** ESTÁ PROVADO COMO CAUSA DO TRAVAMENTO (corrigido 2026-10-18)

**A versão anterior desta regra afirmava "O RELAY CONGELA O JOGO — e isto está medido". Não está
provado — e a única bisectação controlada que existe diz o contrário.**

O que existe, de facto:

- `JOGAR-SEM-RELAY.cmd` afirma a causalidade. É uma **conclusão escrita**, não uma medição que alguém
  tenha repetido com uma só variável.
- **Bisectação do dono (2026-10-18 16:35, sessão `dd3f7555`, seq 1215), verbatim:**
  *"desativei o relay, nao era culpa dele. ainda travava. desativei a extensao, parou de travar. mas
  usei a extensao no edge, e funcionou."*
  → **com o relay desligado o jogo continuou a travar.** Isto refuta "o relay é a causa".
- A "reconfirmação" anterior (aba a queimar um core com o relay, normal depois de o matar) mudou
  **duas variáveis ao mesmo tempo** (relay **e** aba nova). Não isola o relay.

**O que continua válido — por prudência, não por causalidade provada:**
- O relay é um processo a mais no caminho. Usar só enquanto for preciso conduzir o browser do dono e
  desligá-lo antes de jogar a sério. Se algo aquecer, é o primeiro a remover.
- O relay precisa do prelude instalado (`omp browser-relay install` escreve em
  `~/.omp/browser-relay/extension`; instalar com o script de 10.1). Sem prelude, `/json` em 9224 dá 503.
- Helpers: `tools/_reload-lolidle.mjs`, `tools/_prova-live.mjs` (falam com 9224).

**Regra que fica:** uma conclusão de causalidade só entra neste ficheiro com (a) **uma** variável
isolada e (b) o número/passos que qualquer um repete. "Está medido" sem o número é opinião.

> **E o travamento? (fechado em 2026-10-18, 23h).** Não era o relay, não era a VPN, não era "o jogo com
> esta conta". Era **a NOSSA extensão**: um **ciclo de chamadas** no `automation.js` que bloqueava o
> *main thread*. Provado com `Debugger.pause` (`tools/_sonda-stack.mjs`). **A regra e a receita de
> diagnóstico completas estão na REGRA Nº 15** — ler a pilha antes de acusar o jogo. Detalhe
> histórico: `docs/travamento-causa-raiz.md` → *CAUSA-RAIZ FINAL*.

### 10.5 Repositório: camuflado, sem README, sem descrição

**Ordem do dono (2026-10-18):** o repo público fica com **nome camuflado**, **sem README** e **sem
descrição** (*"nao precisa de descricao nem nada, nao queremos seo"*). Estado actual:
`github.com/mateusant13/web-ext-utils` (público, sem README, sem descrição, sem topics).
**Não acrescentar README nem descrição. Não fazer SEO.**

### 10.6 Recarregar a extensão no perfil REAL — o ficheiro **não** recarrega sozinho

**Chrome não relê a pasta de uma extensão unpacked quando os ficheiros mudam.** Depois de editar
`I:\!lolidle.com\extension\*.js`, o Chrome continua a servir o **script velho** até se clicar
**Recarregar** no cartão. Isto já produziu falsos "corrigi e não mudou nada" (e é a explicação para o
dono continuar a ver o erro de CSP depois de o código estar corrigido no disco).

Receita (**REGRA Nº 13** — janela invisível + UIA, **zero foco**; o antigo `recarregar-extensao-uia.ps1`
forçava `SetForegroundWindow`/`SetFocus` e está ultrapassado):

```
node tools\recarregar-extensao.mjs reload      # tambem: activar | desactivar | estado
```

A identificação é sempre pelo **PATH da pasta** (casando o `Secure Preferences`), nunca pelo nome — sem
isso o script já confirmou o **LoL Idle** quando se pedia o **relay**. Uma leitura a mentir é pior do que
um erro. (`EXT_DIR` / `EXT_NOME` sobrepõem a pasta e o nome.)

O que faz: abre `chrome --new-window about:blank` (reutiliza a instância a correr, não mata nada) → põe a
janela **on-screen** → navega a `chrome://extensions` pelo omnibox (`ValuePattern.SetValue` + Enter
**postado**; `chrome://` na linha de comandos é dropped pelo singleton) → liga o **Modo do
desenvolvedor** → filtra o cartão pela **pesquisa da própria página** → ativa-o se estiver desligado →
invoca o **`dev-reload-button`** do cartão → verifica em `Secure Preferences` com *polling* → fecha a
janela que abriu.

**Invisível ≠ inativa (2026-10-18, custou uma hora).** A janela alpha 0 tem de ser **ativada**
(`SetForegroundWindow`). Cheguei a acrescentar-lhe `SWP_NOACTIVATE` + `WS_EX_TRANSPARENT` para "não
incomodar"; sem foco o `Enter` do omnibox falha de forma **intermitente** e o script morre em
"chrome://extensions não renderizou". Default agora: janela **normal e ativada**; `-Invisivel` = alpha 0
**mas ativada**.

**Cinco armadilhas, todas apanhadas hoje:**

1. Procurar um botão com o nome "Recarregar" apanha o **recarregar da página** da barra do Chrome
   (`AutomationId=view_1003`). Só conta `AutomationId = dev-reload-button`, e o dev mode tem de estar
   **ligado** — sem ele o botão do cartão nem existe (`-Dump` mostra os nós reais).
2. **"Restaurar páginas?" é uma janela top-level à parte**, sem omnibox. Apanhá-la dá
   "omnibox nao encontrado". Filtrar por título (`-notmatch 'Restaurar|Restore'`).
3. **A WebUI só expõe ao UIA os nós VISÍVEIS.** Com 25 extensões o cartão fica abaixo da dobra e *não
   existe* para a árvore. Filtrar pela caixa de pesquisa da página resolve — o `Edit` cujo `Name` casa
   `extens` (o omnibox também é um `Edit`, e o nome dele diz "Pesquisar...").
4. **O cartão não tem `Name` fiável.** Depois do filtro sobra **um** cartão na página: se há exactamente
   um `enableToggle` e um `dev-reload-button`, são dele. Mais fiável do que subir a árvore à procura do
   nome (que devolvia `enabled:null`).
5. **O `Secure Preferences` é escrito com atraso.** Uma leitura única logo após o clique devolve o estado
   antigo — foi assim que o script disse `ok:true` com o relay ainda `disable_reasons=1`. *Polling* até
   ~10 s.

**Marcador discriminante (Regra Nº 4):** `automation.js` escreve `lolidleAutoPotion:agregado` **só**
pelo timer de 15 s. Ler (só leitura, com `FileShare.ReadWrite` porque o Chrome tem o ficheiro aberto)
`User Data\Default\Local Extension Settings\pbdlekcgmpippamdkgbaphcppjafobjo\*.log` e procurar a string:

| estado | `agregado` no LevelDB |
|---|---|
| código velho, ou reload não feito | **0** |
| reload feito + 1 carga de página lolidle | **≥1** |

**Prova (2026-10-18):** 0 → reload → `agregado` **1×**, log reescrito às 17:59:37. Antes disso o mesmo
ficheiro tinha `meta` 17× e `agregado` 0× — que é precisamente a assinatura dos timers mortos.

### 10.7 O RELAY OMP: CDP no Chrome REAL sem porta de debug (PROVADO 2026-10-18)

É a resposta certa para "porque não abres logo o Chrome com `--remote-debugging-port`?". Porque **não
funciona** no diretório padrão (ver 10.2: desde o Chrome 136 o Chrome ignora a flag aí; medido neste PC,
`/json/version` dá 404) e porque o único caminho que a faria pegar — `--user-data-dir` a apontar para o
perfil real — é o que apagou binários de extensões em 2026-10-18 (REGRA 9). **O relay não usa porta de
debug nem reinicia nada.**

**1. Ativar o prelude** (é uma extensão unpacked como outra qualquer; instala-se/ativa-se com o script da
10.6). Pasta: `C:\Users\Administrador\.omp\browser-relay\extension` — id
`jdphdacdpdgbfdcolnnlangmpfajejno`.

```
node tools\recarregar-extensao.mjs reload      # REGRA Nº 13 — janela invisivel, zero foco
```
com `EXT_NOME='OMP Browser Relay'` e `EXT_DIR='C:\Users\Administrador\.omp\browser-relay\extension'`.

**2. Subir o servidor** (processo local; mata-se quando já não é preciso):

```
omp browser-relay serve -p 9224 -v
```

**3. Provar que está vivo** — não "parece que sim":

```
curl http://127.0.0.1:9224/json/version      # 200 + "ompRelayVersion"
node tools\_relay-prova.mjs "github\.com"    # dirige uma aba existente e lê a resposta dela
```

`/json/version` sozinho **não** prova nada (com o prelude desligado dá 503). `/json/list` a devolver as
abas reais do dono e uma `Runtime.evaluate` a **responder** é que é a prova.

**Prova (2026-10-18):** `/json/version` → `{"Browser":"Chrome/155.0.0.0","ompRelayVersion":"18.6.1",
"webSocketDebuggerUrl":"ws://127.0.0.1:9224/cdp"}`; `/json/list` devolveu 10 abas reais (YouTube, GitHub,
Crystal, VOD.RIP); `_relay-prova.mjs` devolveu
`{"titulo":"GitHub - mateusant13/web-ext-utils","url":"https://github.com/...","ecra":"1735x828"}`.

**Protocolo** (não é o `/devtools/page/<id>` cru — é um único socket com sessões `flatten`):

```
ws://127.0.0.1:9224/cdp
  → Target.getTargets
  → Target.attachToTarget { targetId, flatten: true }   // devolve sessionId
  → Runtime.enable / Log.enable / Page.enable           // sempre com o sessionId
  → Runtime.evaluate { expression, returnByValue: true }
```

Helpers que já falam isto: `tools/_relay-prova.mjs` (prova mínima), `tools/_prova-live.mjs` (procura as
funções novas no mundo da extensão), `tools/_travamento-cdp.mjs` (mede travamento pela página).

**Porque a liveness por CDP é melhor que CPU:** um *main thread* bloqueado **não responde** a
`Runtime.evaluate`. Logo a medida directa é "a página respondeu em quantos ms?" e o stall é o valor. CPU
alta é indício; ausência de resposta é prova.

**Prudência:** o relay é um processo a mais no caminho e há documentação antiga a culpá-lo pelo travamento
— **não provado, e refutado** (10.4). Usar enquanto for preciso conduzir o browser e desligar depois.

---

## REGRA Nº 11 — O CHROME DO DONO: NÃO ROUBAR FOCO, NÃO DESPEJAR AS ABAS DELE, NÃO AS VAZAR (2026-10-18)

**Ordem do dono (2026-10-18), verbatim:** *"nao atrapalha mais o meu uso do chrome. mas pode usar o meu
chrome, nao e pra tu ficar abrindo novos perfis. (a nao ser q seja necessario pra algo q vc queira fazer)
(...) e de nao roubar meu foco de teclado e mouse, ou se fizer isso, devolver imediatamente o meu foco."*

Isto **já estava resolvido** em dois projectos do dono. Não se inventa — **reutiliza-se** (é a CRITICAL
RULE do manager, `I:\!manager\docs\constitution\agents-md-original.md:881-882`: procurar a solução interna
**antes** de inventar: *"faz igual o auto install do vod.rip"*).

| Fonte (ler ANTES de mexer no browser) | O que dá |
|---|---|
| `I:\!aicompanion\VOD.RIP\scripts\cookie_extension_auto_install.ps1` (68 KB) | O instalador UIA silencioso: janela ON-SCREEN alpha-0, *focus-bounce*, ZERO teclado, e o reload SEM JANELA |
| `I:\!manager\tools\focus-open.py` | O *wrapper* de arranque com *focus-bounce* (exit **0** nunca roubou / **2** roubou e devolveu / **3** ficou com o foco) |
| `I:\!manager\tools\focus-watch.py` | Observador READ-ONLY do foreground (pids/hwnds opacos, ZERO títulos) — a **prova** de "não roubei foco" |
| `I:\!manager\playbooks\focus-safe-open.md` | A doutrina + os anti-padrões (cada um já magoou nesta máquina) |
| `I:\!manager\docs\constitution\agents-md-original.md:872-966` | Browser rule, RELAY PRIVACY, enumeração dirigida, isolamento, desconexão obrigatória |

### 11.1 O que é proibido (sem excepção)

1. **Nunca abrir aba na janela dele.** Nova **JANELA** sempre (`chrome --new-window` reutiliza a instância
   a correr, não mata nada). Nunca deixar um `Target.createTarget` cair na janela activa do dono.
   (`constitution:872`; `focus-safe-open.md:13-16`)
2. **Nunca `taskkill /IM chrome.exe`.** Só `Stop-Process -Id <PID>` cirúrgico, com o PID confirmado.
   Fechar o Chrome dele é a **única A2 permanente** deste ecossistema (`constitution:875-879`).
3. **Nunca `keybd_event`/`SendKeys`/`SendInput`** para devolver foco (vai para a app em foreground do
   dono) nem `SetFocus` (activa a janela → rouba). O retorno faz-se com **`AttachThreadInput` +
   `SetForegroundWindow`** (`focus-open.py:102-113`, `VOD…ps1:714-729`).
4. **Nunca `--remote-debugging-port` no perfil real** (`focus-safe-open.md:107-108`; 10.2 e REGRA 9).
5. **Nunca imprimir/logar `/json/list`** — devolve as abas TODAS do dono. É **incidente de privacidade**
   (`constitution:887-895`). Método correcto: **diferenciar os `targetId` antes/depois** e imprimir **só**
   o alvo (é o que o `tools/bg-window.py` do manager faz).
6. **Nunca `chrome.runtime.reload()` nem reload das páginas dele sem OK** (`constitution:919`).
7. **Desconectar no MESMO turno** (`constitution:939-949`): aba criada por nós → fechar; aba adoptada →
   largar a sessão sem fechar a dele.

### 11.2 O *focus-bounce* (copiar, não inventar)

- `VOD…ps1:810` — **capturar o foreground ANTES do spawn**: `$prevFg = [ExtWin]::FgWindow()`.
  `focus-open.py:135` — `h_prev = GetForegroundWindow()` antes do `Popen`.
- Depois, a cada **15 ms**: se o foreground passou a ser **uma janela NOSSA** (HWND novo de uma imagem
  conhecida), devolver com `RestoreFg($prevFg)` e **parar** (early-exit: ~15-30 ms no total).

Duas regras que fazem a diferença:

- **Só devolver se o foreground for NOSSO.** `VOD…ps1:638-648` e `:1065-1074`: se o dono mudou de janela
  **de propósito**, não se toca. (Pisar uma escolha do dono é outro roubo.)
- **A janela é ON-SCREEN e alpha-0 — nunca off-screen nem `SW_HIDE`.** Off-screen o Chrome considera
  **ocluída**: o renderer é *throttled* e a WebUI **não expõe nós ao UIA** (39 nós, sem ids). On-screen
  alpha-0 renderiza tudo (**330** nós) e o dono não vê nada (`VOD…ps1:516-525`, `:854-869`).

O *wrapper* já existe — usa-se, não se reescreve:

```
python I:\!manager\tools\focus-open.py --label lolidle-reload --also-match chrome.exe --close-new -- `
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --new-window about:blank
```

### 11.3 O reload SEM JANELA (a forma que não rouba foco nenhum)

`VOD…ps1:43-56` resolveu isto **sem abrir janela**: o *service worker* da própria extensão consulta
`GET /api/extension/status` num alarme de 30 s e, ao ver a directiva, faz `chrome.runtime.reload()` e
confirma com `reload-done`; o chamador só faz `POST /api/extension/reload`. **Zero janelas, zero foco.**
É o desenho a copiar — aqui o gatilho natural é `chrome.storage.onChanged` no `background.js` (que
**acorda** o service worker), sem servidor novo.

Enquanto isso não existir, o caminho UIA da 10.6 é a excepção tolerada — **mas com o *bounce* da 11.2,
que hoje NÃO tem.** É a lacuna a fechar.

### 11.4 O que EU fiz mal hoje (registado para não se repetir)

| # | O que fiz | Regra violada |
|---|---|---|
| 1 | Abri abas com `Target.createTarget` a cair na **janela dele** (bissecção, marca, travamento) | 11.1.1 |
| 2 | Imprimi `/json/list` com os **títulos das abas pessoais** dele na saída das ferramentas | 11.1.5 |
| 3 | A janela UIA de reload era **ativada** (`SetForegroundWindow` forçado) — roubava o foco, e sem isso o `Enter` do omnibox falhava | 11.1.3 / 11.2 |
| 4 | Recarreguei a extensão várias vezes na bissecção, cada uma a abrir uma janela activada | 11.1.6 |
| 5 | Deixei a extensão a correr a variante `sem-conteudo` (sem poções, sem painel) por ter morto a bissecção a meio | REGRA 7 (já restaurado para `completo`) |

**Lição de uma linha:** o perfil do dono não é bancada nem ecrã de relatório — **janela nova, alpha-0,
bounce, alvo por diff, e a lista de abas dele nunca se imprime.**

---

## REGRA Nº 12 — SONDA AO BROWSER DO DONO: JANELA INVISÍVEL DO MANAGER, NUNCA `createTarget` (2026-10-18)

**O erro que originou a regra.** Para sondar o jogo, abria janelas com
`Target.createTarget {newWindow:true}`. Essa janela **aparece à frente do dono** e tira-o da aba em que
está. Ele apanhou-o e mandou ir ver como o `!manager` e o VOD.RIP já resolvem isto (*"eu ja nao mandei
tu ir la no vod rip ou !manager do disco i pra resolver isso, e entender como eles faziam?"*).
**Já resolvem. Reutiliza-se, não se inventa.**

### 12.1 O canal sancionado: `I:\!manager\tools\bg-window.py`

É o único caminho que **não rouba foco e não deixa janela visível**. Fonte lida (611 linhas); o que faz,
com a linha:

- `Popen([chrome, '--new-window', '--window-position=60,60', '--window-size=1280,800', url])`
  (`:432-434`) — reutiliza a instância viva por IPC; **não mata nada**.
- apanha o HWND novo por **diff** de `visible_top_hwnds()` antes/depois **e** pela imagem do processo
  `chrome.exe` (`:439-451`) — **nunca lê títulos** (privacidade, `:122`).
- `make_silent` → `WS_EX_LAYERED` + `SetLayeredWindowAttributes(alpha 0)` (`:281-286`); `place_on_screen`
  → `SetWindowPos(..., SWP_NOACTIVATE|SWP_FRAMECHANGED)` **on-screen** (off-screen o Chrome considera
  ocluída e faz *throttle* ao renderer) (`:316-325`).
- `ensure_silent` **confirma que o alpha voltou 0** e, se não colar, **fecha a janela** em vez de a
  devolver visível (`:305-314`, `:480-484`).
- **alvo por diff**: `match_targets` escolhe o **único** id novo; 0 ou 2+ novos → recusa adivinhar
  (`:346-352`). O `url` é deliberadamente ignorado — casar por substring podia apanhar uma aba do dono.
- *focus guard*: captura `GetForegroundWindow()` **antes** do spawn (`:425`) e devolve-o com
  `AttachThreadInput`+`SetForegroundWindow` **só se tiver mudado** (`:165-167`, `:135-147`). Zero
  `keybd_event`. `guard` só age quando o foreground é **a NOSSA janela** (`:182-230`) — nunca puxa o foco
  quando o dono mudou de aplicação de propósito.
- registo durável em `%LOCALAPPDATA%\omp\bg-window-probes.jsonl` + `reap` para varrer janelas deixadas
  vivas (`:69-85`, `:526-554`).

Saída: **uma** linha JSON. `open` → `{"ok":true,"hwnd":N,"tab":"<label>","target_id":"..."}`.

```
python I:\!manager\tools\bg-window.py open --url https://lolidle.com/jogar --label lolidle-sonda
python I:\!manager\tools\bg-window.py close --target <target_id>
python I:\!manager\tools\bg-window.py reap
```

### 12.2 A sonda é **attach-only** (`tools\_sonda-alvo.mjs`)

Liga-se a um alvo **já existente** (`Target.attachToTarget`) e **não cria nem fecha nada**:

```
node tools\_sonda-alvo.mjs <target_id> [segundos]
```

Mede liveness por `Runtime.evaluate` (um *main thread* bloqueado **não responde** — é a prova do
travamento) e lê os marcadores discriminantes (`window.__lolidlePulsoFix`, `#lolidle-ap`,
`document.hidden`). **Não fecha o alvo**: quem fecha a janela é o `bg-window.py close`.

### 12.3 Factos medidos do relay (para não voltar a tentar o que não dá)

| Tentativa | Resultado (medido 2026-10-18) |
|---|---|
| `Browser.getVersion` (nível browser) | **funciona** — `{"protocolVersion":"1.3","product":"Chrome/155.0.0.0"}` |
| `Extensions.loadUnpacked` | **não existe** — `{"code":-32601,"message":"'Extensions.loadUnpacked' wasn't found"}` |
| `Target.attachToTarget` a `chrome://…` | recusado — `Cannot attach to tab` |
| `Target.attachToTarget` a `chrome-extension://…` | recusado — `Cannot attach to tab` (não se conduz página da extensão por CDP) |
| `Target.createTarget {newWindow:true}` | **abre à frente do dono** — proibido (11.1.1) |
| página da extensão que faz `chrome.runtime.reload()` | **NÃO USAR** — deixou a extensão com `disable_reasons=[4]` e a injecção morta (`__lolidlePulsoFix` → `undefined`, `painel:false`). Recupera-se com o reload UIA da 10.6 |

### 12.4 Consequência

- **Sondar páginas**: sempre `bg-window.py open` → `_sonda-alvo.mjs` → `bg-window.py close`, no **mesmo
  turno**. Nunca `Target.createTarget`.
- **Carregar/recarregar/activar/desactivar a extensão**: `node tools/recarregar-extensao.mjs reload`
  (REGRA Nº 13) — janela invisível + UIA, **sem foco**, fechada no mesmo passo. O relay não expõe a
  extensão (`chrome://` e `chrome-extension://` recusados; sem alvo de *service worker*), e a auto-recarga
  pela própria página da extensão **desactiva-a** (`disable_reasons=[4]`).
- **Quando não se faz nada**: não abrir janela nenhuma. O browser do dono não é bancada.

---

## REGRA Nº 13 — RECARREGAR/ACTIVAR A EXTENSÃO: JANELA INVISÍVEL + UIA, ZERO FOCO (2026-10-18)

**O erro que originou a regra.** O reload da extensão (`recarregar-extensao-uia.ps1`) forçava
`SetForegroundWindow` + `SetFocus` "porque sem foco o Enter do omnibox falha". **É falso**, e é falso
desde 2026-08-13: o VOD.RIP já o tinha resolvido e está escrito na fonte
(`I:\!aicompanion\VOD.RIP\scripts\cookie_extension_auto_install.ps1:13-30`, `:870-935`):

> *"ZERO keyboard input, ZERO focus steal: navigation is omnibox SetValue + a POSTED Enter (posted keys
> cannot leak - they go to our window, not the foreground) … No SetFocus (activates the window -> focus
> steal), no keybd_event (routes to the user's foreground app)."*

O que falha sem foco é o **`SetFocus`**, não a navegação. `SetFocus`/`SetForegroundWindow` **activam** a
janela — é isso que rouba o foco. `UIA ValuePattern.SetValue` + **Enter postado** (`PostMessage`
`WM_KEYDOWN/WM_KEYUP` VK_RETURN) navegam uma janela **não-ocluída** sem lhe tocar no foco.

> **CORRECÇÃO MEDIDA (2026-10-18, ao vivo).** A frase acima está **meio certa** e custou uma sessão.
> O `SetValue` na omnibox **FOGA o controlo** — e é isso que faz o Chrome **activar** a janela. O Enter
> postado só navega se chegar **enquanto a omnibox ainda tem o foco interno**. Com o guardião a correr,
> ele devolvia o foco ao dono **antes** do Enter chegar → a omnibox perdia o foco interno → a navegação
> era um **no-op silencioso** (`tentativas:3`, título preso em `about:blank`, `ok:false`).
> **Portanto: o guardião tem de ser PAUSADO ~100 ms em volta do `SetValue`+`Enter`** — é o que
> `UiaWin.GuardarPausar()`/`GuardarRetomar()` fazem, e o `finally` retoma sempre. Não se posta o Enter
> "sem foco nenhum": posta-se sem foco **do dono**, com a janela activa por um instante controlado.
> (Medido a seguir: navegou, `foco_roubado_devolvido:0` no comando — o guardião não teve de intervir
> porque a pausa cobriu o instante — e um `nav-test` isolado deu `MODO A-posted -> 'Extensões'`.)

### 13.1 O comando

```
node tools/recarregar-extensao.mjs reload        # tambem: activar | desactivar | estado
```

Faz três passos e **fecha sempre o que abriu**:

| # | passo | ficheiro | o que garante |
|---|---|---|---|
| 1 | `bg-window.py open --url about:blank` | `I:\!manager\tools\bg-window.py` | janela alpha-0 ON-SCREEN, `SWP_NOACTIVATE`, alpha verificado, *focus guard* (12.1) |
| 2 | age em `chrome://extensions` **sobre esse hwnd** | `install/extensoes-uia.ps1` | navega por UIA SetValue + Enter postado; liga o devMode; filtra o cartão pela pesquisa da página; clica o `dev-reload-button`; confirma no **Secure Preferences** |
| 3 | `bg-window.py close --target` | idem | fecha a janela e devolve o foco |

`install/extensoes-uia.ps1` **não abre janelas** (`-Hwnd` é obrigatório) e **nunca** chama
`SetForegroundWindow` nem `SetFocus` — as duas **activam** a janela, e é isso que rouba o foco.

Duas defesas que existem porque a primeira versão ainda incomodava o dono:

1. **Guardião contínuo** (`-DonoHwnd`, obrigatório na prática). O `chrome --new-window` **activa** a
   janela, e o Chrome pode activá-la **outra vez depois** do arranque — a janela do `bg-window.py` só
   devolve o foco no `open` e no `close`, e não apanha isso. O script arma um **timer de 20 ms** que
   devolve o foco ao dono **sempre que, e só quando, o foreground é a NOSSA janela** (mesma regra do
   `bg-window.py guard`, `:182-230`: se o dono mudou de aplicação de propósito, não se toca). O wrapper
   lê a janela do dono (`bg-window.py fg`) **antes** de abrir e faz uma devolução final
   (`bg-window.py restore`) antes de fechar.
2. **Camuflagem**: `alpha-0` + `WS_EX_TRANSPARENT` + `WS_EX_TOOLWINDOW`. Uma janela alpha-0 **engole os
   cliques** do dono onde estiver e aparece na barra de tarefas/Alt-Tab; com o bit transparente os
   cliques passam ao lado (o UIA `Invoke`/`SetValue` não usa o rato) e o `TOOLWINDOW` tira-a da barra.

### 13.2 O que está e o que NÃO está verificado

**Verificado ao vivo (2026-10-18)** — reactivação de uma extensão **desactivada**
(`disable_reasons=[4]`), com a versão **anterior** do script:

```
{"ok":true,"acao":"reload","invisivel":true,"titulo":"Extensão - Google Chrome","tentativas":1,
 "devmode":"ja-ligado","enabled":"on-apos-reload","clicked":"InvokePattern",
 "disable_reasons":"","verify":"ACTIVA (disable_reasons vazio)","janela":{"fechada":true,"foco_devolvido":false}}
```

e, numa página do jogo, os marcadores discriminantes (Regra Nº 4): `__lolidlePulsoFix:true` e
`painel:true` (o painel é do `gui.js`, que só existe em `completo`).

**NÃO verificado**: o **guardião contínuo** e a camuflagem (13.1) foram escritos **depois** — o dono
mandou parar por ainda se sentir incomodado, e a correcção não voltou a correr contra o browser dele.
Só passa a "provado" quando correr uma vez com `foco_roubado_devolvido` ≥ 0 e ele confirmar que não deu
por nada.

### 13.2.1 ESTADO CORRIGIDO (2026-10-18, 23h) — o guardião e a navegação JÁ CORRERAM contra o browser dele

O parágrafo acima está **ultrapassado**. Correu-se `node tools/recarregar-extensao.mjs reload` contra o
perfil real e o resultado **é a prova**:

```
{"ok":true,"acao":"reload","invisivel":true,"titulo":"Extensões - Google Chrome","tentativas":1,
 "devmode":"ja-ligado","cartao":"por-filtro (1 cartao na pagina)","enabled":"on-apos-reload",
 "clicked":"InvokePattern","disable_reasons":"","verify":"ACTIVA (disable_reasons vazio)",
 "foco_roubado_devolvido":4, ...  "janela":{"fechada":true}}
```

- **`foco_roubado_devolvido: 4`** é o **guardião a fazer o trabalho**: houve 4 activações a apanhar
  (arranque + os `SetValue` que focam controlos) e as 4 foram devolvidas ao dono. **Sem** o guardião,
  o dono perdia o foco 4 vezes; com ele, nenhuma chegou a ficar.
- O comando fechou sempre a janela (`janela.fechada:true`) e devolveu o foco antes de fechar.

**Dois defeitos corrigidos no caminho (estavam a impedir o reload e não eram visíveis no `ok` anterior):**

1. **Navegação `no-op`** por causa do guardião (ver a caixa de correcção em 13): resolveu-se com
   `GuardarPausar()`/`GuardarRetomar()` ~100 ms em volta do `SetValue`+`Enter`.
2. **Critério de "pronto" cego**: o script esperava só pelo AutomationId `loadUnpacked`. O WebUI expõe
   os nós por partes e `devMode`/`enableToggle` podem chegar **antes** — agora aceita qualquer um
   (menos espera, sem repetir a navegação 3×). E, quando falha, `-Dump`/`Mostrar-Arvore` **despeja a
   árvore** em vez de se adivinhar o AutomationId (`Mostrar-Arvore` conta os nós: prova o que a página
   expõe).

**O que continua por confirmar:** só o dono pode dizer "não dei por nada". O número está do lado certo
(4 devoluções, nenhuma acumulada, janela fechada).

### 13.3 O que NÃO funciona (e por isso não se tenta)

- `chrome://extensions` **na linha de comandos** → é *dropped*: abre a "Nova guia" (86 nós UIA, título
  `Nova guia`). Confirmado outra vez hoje.
- `Target.attachToTarget` a `chrome://` / `chrome-extension://` → recusado.
- `Extensions.loadUnpacked` → não existe no relay.
- **Alvo de *service worker*** → o relay só expõe `page` (`Target.getTargets` → `{"page":6}`), logo não há
  caminho "zero-janela" para avaliar código no SW da extensão.
- Página da extensão que faz `chrome.runtime.reload()` → **desactiva** a extensão (12.3).

**Portanto:** a janela invisível não é preguiça — é o único canal que existe. O que deixou de existir foi o
**roubo de foco**.

### 13.4 MEDIDO (2026-10-23): com o Chrome do dono ABERTO, não há janela nenhuma para o UIA

O canal da 13.1 parte de `chrome --new-window --user-data-dir=<perfil do dono>`. Com o browser
**já a correr**, esse processo sai com código **21** (`RESULT_CODE_NORMAL_EXIT_PROCESS_NOTIFIED`):
a linha de comandos foi **entregue à instância viva** e o processo novo saiu — mas a instância
**não cria janela nova** (o *hand-off* do *singleton* leva o URL, não o `--new-window`). Consequência:
`bg-window.py open` devolve `{"ok":false,"err":"new chrome window not found"}` e
`node tools/recarregar-extensao.mjs reload` morre em `fase:"abrir-janela"` — **sem** tocar no
perfil, sem roubar foco, e sem nada para o UIA clicar.

Verificado também que a causa **não** é elevação (`explorer.exe` como lançador de nível médio dá o
mesmo 21) nem caminho errado do perfil (`Win32_Process` mostra `--user-data-dir="C:\ChromeDebugProfile"`
e esse perfil está vivo: `Local State` escrito no minuto da medição, 50 extensões).

**Portanto o reload deixa de ter caminho de janela e passa a exigir a 11.3** — `chrome.storage.onChanged`
no `background.js` (ou um alarme de 30 s, como o VOD.RIP) que faça `chrome.runtime.reload()` sozinho.
Enquanto isso não existir, um reload que falhe em `abrir-janela` **não é bug do script** e não se
"resolve" insistindo: é a arquitetura que falta.

---

## REGRA Nº 14 — A RECEITA CANÓNICA: COMO MEXER NO CHROME DO DONO SEM QUE ELE DÊ POR NADA

> Ordem do dono (2026-10-18, depois de eu ter voltado a incomodá-lo): *"documenta o jeito certo de fazer
> oq eu to reclamando."* Isto é a versão escrita da correcção. **Antes de abrir uma janela no browser
> dele, passa por esta lista.** Se falhares um ponto, ele sente.

**Reclamação, verbatim:** *"por que tu ainda ta atrapalhando meu chrome e fazendo a aba abrir na minha
frente, saindo da minha aba atual?"* — ou seja: a janela **aparecia** e **tirava-lhe o foco**.

### O erro de raiz (e o único que importa repetir)

**Abrir a janela não é o pecado. Deixá-la com o foco é.** E o foco não se rouba só no `open`: o
`chrome --new-window` **activa** a janela, e o Chrome pode activá-la **outra vez** uns instantes depois.
Uma devolução pontual (como a do `bg-window.py`, que só age no `open` e no `close`) **não apanha essa
segunda activação** — foi exactamente por aí que o foco fugia. A resposta é um **guardião contínuo**, não
mais uma devolução pontual.

### A lista, mecânica (por ordem)

**0. Antes de abrir: prefere não abrir.** Se dá para provar sem janela (relay a um alvo que já existe,
leitura de ficheiro, teste em nó), faz-se assim. Janela é excepção, não regra.

**1. Ler a janela do dono ANTES do spawn.**
```
python I:\!manager\tools\bg-window.py fg        ->  {"ok":true,"foreground":<hwnd>}
```
É este `hwnd` que o guardião há-de repor. **Lido antes**, porque depois a nossa janela já pode ser o
foreground e lê-se o valor errado.

**2. Abrir pelo canal sancionado — e só por ele.**
```
python I:\!manager\tools\bg-window.py open --url <url> --label <nome>
```
Isso já dá: reutilização da instância viva (não mata nada), `alpha-0` **ON-SCREEN**, `SWP_NOACTIVATE`,
verificação do alpha, e alvo por **diff** de hwnd (nunca por título). **Proibido** `Target.createTarget
{newWindow:true}` (aparece à frente dele) — REGRA 12.

**3. Camuflar a janela — os quatro bits, todos.**
`WS_EX_LAYERED` + `SetLayeredWindowAttributes(alpha=0)` **e verificar que colou**; `WS_EX_TRANSPARENT`
(os cliques do dono **passam ao lado** — uma janela alpha-0 sem isto engole cliques onde estiver);
`WS_EX_TOOLWINDOW` (fora da barra de tarefas e do Alt-Tab). Reaplicar **depois de cada navegação**: o
Chrome re-compõe a janela ao mudar de página e pode largar os estilos.

```
install\extensoes-uia.ps1 -Camuflar  (UiaWin.Camuflar, idempotente)
```

**4. Armar o GUARDIÃO DE 20 ms enquanto a janela viver.** Um timer que, a cada 20 ms, devolve o foco ao
`hwnd` do passo 1 **se, e só se, o foreground actual for a NOSSA janela**.
- **Só se for a nossa.** Se o dono mudou de aplicação de propósito, o foreground é outra coisa e
  **não se toca** — pisar essa escolha é outro roubo (regra do `bg-window.py guard`, `:182-230`).
- Devolver com **`AttachThreadInput` + `SetForegroundWindow`**. **Nunca** `keybd_event`/`SendKeys`/
  `SendInput` (vão para a app em foreground do dono) e **nunca** `SetFocus` (activa a janela → rouba).
- Parar o guardião no `finally`, e reportar `foco_roubado_devolvido` (quantas vezes repôs o foco). É o
  número que diz se ele deu por algo.

**5. Agir SEM teclado real e SEM foco.**
- Navegar: UIA `ValuePattern.SetValue` no omnibox + **Enter POSTADO** (`PostMessage`
  `WM_KEYDOWN`/`WM_KEYUP` de `VK_RETURN`). Chaves postadas vão para a **nossa** janela, não para a app
  em foreground. Fonte: `VOD.RIP\scripts\cookie_extension_auto_install.ps1:13-30`, `:870-935`.
- **MAS o `SetValue` foca a omnibox e o Chrome activa a janela** — e o Enter postado só navega
  enquanto a omnibox tem o foco interno. **Pausa o guardião ~100 ms em volta do `SetValue`+`Enter`**
  (`UiaWin.GuardarPausar()`/`GuardarRetomar()`, retomar no `finally`) e devolve o dono logo a seguir.
  Sem isto o guardião devolve o foco primeiro e a navegação é um **no-op silencioso** (`tentativas:3`,
  título preso em `about:blank`, `ok:false`). Isto é ~100 ms de janela activa, invisível e transparente.
- Clicar: UIA `InvokePattern.Invoke` / `TogglePattern.Toggle`. Nada de rato (o `Toggle` também foca:
  mesma pausa curta quando for preciso).
- `chrome://` **na linha de comandos é dropped** → a navegação tem de ser pelo omnibox.
- Esperar pelo estado certo antes de agir, aceitando **qualquer** marcador razoável (`loadUnpacked`
  **ou** `devMode` **ou** `enableToggle`) — o WebUI expõe os nós por partes e esperar por um só
  AutomationId faz repetir a navegação. Quando falhar, **despejar a árvore** (`Mostrar-Arvore`), não
  adivinhar.

**6. Fechar NO MESMO TURNO, sempre.**
```
python I:\!manager\tools\bg-window.py restore --foreground <hwnd-do-passo-1>   # devolução final
python I:\!manager\tools\bg-window.py close --target <target_id>              # fecha o que abrimos
python I:\!manager\tools\bg-window.py reap                                    # varre órfãos
```
**Nunca acumular janelas** (ordem do dono: *"se vai abrir a segunda janela vc fecha a primeira"*). Aba
criada por nós → fechar. Aba **adoptada** dele → largar a sessão **sem fechar** (11.1.7).

**7. Privacidade: nunca imprimir `/json/list`.** Devolve **as abas todas do dono**. Alvo por **diff**
`antes/depois` e imprimir **só** o alvo. (Foi um incidente meu — 11.4.2.)

### Teste de aceitação (o que conta como "não incomodei")

| observação | valor | significa |
|---|---|---|
| `janela.fechada` | `true` | não ficou nada aberto |
| `foco_devolvido_no_close` | `false` | o foreground no fim já era o dele |
| `devolucoes_do_guardiao` | `0` | o foco **nunca** chegou a ir para a nossa janela |
| os olhos e o teclado do dono | nada notado | a prova final é a dele |

`devolucoes_do_guardiao > 0` **não é falhanço** — é o guardião a fazer o trabalho. Mas é o sinal de que
houve uma activação para apanhar; se o número for alto, alguma coisa está a activar a janela tarde e
merece ser vista.

### O comando que já faz tudo isto

`node tools/recarregar-extensao.mjs reload|activar|desactivar|estado` — passos 1 a 6 numa só chamada
(REGRA Nº 13). Quem escrever um novo caminho que toque no browser do dono, **passa pela lista acima
antes**, ou não o escreve.

---

## REGRA Nº 15 — UMA PÁGINA MUDA NÃO DIZ QUEM A BLOQUEOU: **LÊ A PILHA** (2026-10-18)

> Esta regra existe porque o travamento do `lolidle.com` foi mal diagnosticado **três vezes** — sempre
> por **correlação**, nunca por leitura. Conclusões escritas que caíram: "é do relay" (refutado pelo A/B
> do dono, §10.4), "é a VPN a interceptar o `pulso.js`", "é do LADO DO JOGO com os dados desta conta".
> Todas as três eram plausíveis e todas as três eram **falsas**. A causa era **nossa**, e estava à
> espera de uma pilha que ninguém tinha lido.

### A regra

**Uma página que não responde é um sintoma, não uma acusação.** Antes de dizer "é o jogo", "é o
Chrome", "é o relay" ou "é a conta", **lê a pilha no instante do bloqueio**. Um `main thread` bloqueado
não responde a `Runtime.evaluate` — mas isso só diz *que* travou, nunca *quem*.

### Porque é que `Debugger.pause` funciona num loop apertado

Parece que não devia: se a thread está presa, como é que ela atende o CDP? Porque o protocolo não é
atendido pela thread de JS: o **inspector do V8** injeta uma *interrupção* que o V8 verifica nas
**arestas de ciclo** do código compilado. Logo `Debugger.pause` **entra mesmo dentro de uma recursão
infinita** e devolve `Debugger.paused` com a pilha completa. Foi assim que o ciclo apareceu — sem
adivinhação.

### A receita (2 ficheiros, já prontos)

```
python I:\!manager\tools\bg-window.py open --url <url> --label sonda   # janela invisível (REGRA 12)
node tools\_sonda-alvo.mjs   <target_id> 15     # 1. LIVENESS: 0/N bloqueios ou N/N
node tools\_sonda-stack.mjs  <target_id> 8      # 2. STACK: Debugger.pause + CPU por processo
python I:\!manager\tools\bg-window.py close --target <target_id>
```

`_sonda-stack.mjs` faz quatro coisas que a sonda simples não faz: (1) `Debugger.enable` +
`Debugger.pause` quando a thread deixa de responder → **pilha**; (2) escuta
`Page.javascriptDialogOpening` (um diálogo modal bloqueia a thread **sem** queimar CPU);
(3) escuta `Runtime.exceptionThrown` e `Inspector.targetCrashed`; (4) `SystemInfo.getProcessInfo`
(nível browser, não precisa da thread) para distinguir **loop a queimar CPU** de **thread parada**
(deadlock/diálogo/frozen). CPU baixa com a thread muda = não é loop a queimar — é pilha a rebentar ou
thread parada.

### Como se lê o resultado (o caso real)

```
t=1s BLOQUEADO (2510ms timeout Runtime.evaluate)   x17/18
Debugger.pause -> Debugger.paused
  renderTudo -> renderPainel -> renderAuto -> ler -> chamar -> regiaoIdeal
    -> estimarRegiao -> meuDps -> agregar
         -> curaGiroS -> dpsPorHabilidade -> cdVoraz -> killsMinAoVivo -> ritmoMobs -> agregar  ⟲
```

**Centenas de frames do MESMO ciclo.** É um **ciclo de chamadas**, não um `while` — um `grep` por
`while (`/`for (;;)` **não o encontra** (foi o primeiro erro: procurei loops e não havia nenhum).

### O ciclo, com `file:linha` (números lidos depois do fix, REGRA Nº 1)

| # | âncora | chamada |
|---|---|---|
| 1 | `automation.js:2654` | `agregar()` chama `curaGiroS()` (era **dentro do `.map`**, uma por região) |
| 2 | `automation.js:1890` | `curaGiroS()` chama `dpsPorHabilidade()` |
| 3 | `automation.js:2253` | `dpsPorHabilidade()` chama `cdVoraz(..., h.t)` por skill |
| 4 | `automation.js:1934` | `cdVoraz()` chama `killsMinAoVivo()` (e `:1959` no `cdVorazMotor`) |
| 5 | `automation.js:1902` | `killsMinAoVivo()` chama `ritmoMobs()` |
| 6 | `automation.js:751` | `ritmoMobs()` chama **`agregar()`** ← **FECHA O CICLO** |

E o `automation.js:2284` dá uma aresta extra (`contextoDeDano` → `killsMinAoVivo`). **O padrão a
vigiar:** uma função de **AGREGAÇÃO** (lê o histórico e produz o resumo) que chama, pelo caminho, uma
função de **MEDIÇÃO AO VIVO** — e a medição ao vivo que, para se calibrar, chama a agregação de volta.
`agregar` ↔ `killsMinAoVivo` é exactamente esse par.

### Porque é que o `try/catch` não salvou (e é o que mais engana)

O `ritmoMobs` tinha `try { ... agregar() ... } catch { /* ignore */ }` com um comentário a dizer que
assim evitava a recursão. **Evitava uma aresta e ignorava a outra.** Pior: o `catch` **engolia o
`RangeError`** do estouro da pilha e a recursão **recomeçava** em cada nível. O resultado não é um erro
visível — é um **bloqueio eterno com CPU baixa**, que se parece exactamente com "o jogo pendurou".
**Um `catch` que engole o estouro da pilha transforma um bug num mistério.**

### A correcção (o padrão a reutilizar)

**Guarda de re-entrância** na função de agregação — quem re-entra, não recomputa:

```js
let _agregarEmCurso = false, _agregarUltimo = [], _agregarReentradas = 0;
function agregar() {
  if (_agregarEmCurso) { _agregarReentradas++; return _agregarUltimo; }  // automation.js:2618-2625
  _agregarEmCurso = true;
  try { _agregarUltimo = _agregarCorpo(); return _agregarUltimo; }
  finally { _agregarEmCurso = false; }
}
```

Segunda porta em `ritmoMobs()` (`automation.js:732-741`, devolve `null` = "sem medida"). E `curaGiroS()`
**saiu de dentro do `.map`** (`:2654`) — não depende da região, calcular uma vez corta o leque.

### Como isto fica provado (e não "verde")

1. **Ao vivo, com marcador discriminante** (REGRA Nº 4): `tools/_sonda-alvo.mjs` em
   `https://lolidle.com/jogar` → **`0/25 bloqueios`** (antes: 17/18), com `painel:true` e
   `pulsoFix:true`.
2. **Banco, suíte `w1-guardas`** (`tools/testes/regiao.test.mjs`): kit **vivo** da Katarina
   (`docs/game-src/kit-katarina-vivo.json`, REGRA Nº 3) + arsenal real no DOM. **10 checks, `rc`=0.**
   Os contadores `agregarReentradas`/`ritmoReentradas` (`:8340-8341`) provam que o ciclo é
   **realmente atravessado** — sem eles, uma configuração que não formasse o ciclo passaria sem
   exercitar nada.
3. **Mutação:** desligar a guarda (`if (false && _agregarEmCurso)`) faz a suíte **não terminar em 45 s**
   — a mesma assinatura do travamento. **Verde sem mutação não é prova** (REGRA Nº 6).

### A lição, em uma linha

**Correlação diz "acontece junto"; a pilha diz "foi isto".** "Com token trava, deslogado não" era
verdade e apontava para o lado errado: a diferença real era *ter campeão com giro + Voracidade*, que é
o que fecha o ciclo. Se uma variável A/B **não nomeia o mecanismo**, o diagnóstico ainda não está feito.


---

## REGRA Nº 16 — O RELAY CONECTA SOZINHO; NINGUÉM PEDE PERMISSÃO AO DONO (2026-10-19)

**Ordem do dono, verbatim:** *"manda os subagents pararem de pedir permissao no meu chrome pra conectar
o relay ou sei la. ja era pra conectar sozinho sem eu ter q confirmar."*

O relay **já está instalado** (`C:\Users\Administrador\.omp\browser-relay\extension`, id
`jdphdacdpdgbfdcolnnlangmpfajejno`) e o servidor sobe com **um comando local**. Não há nada para o dono
confirmar no Chrome: não se abre diálogo, não se pede clique, não se usa `--remote-debugging-port`, não
se instala extensão de novo e **não se toca no perfil real** para "autorizar" nada (REGRA 9).

### Quem pode falar com o browser

- **Subagent NÃO fala com o browser.** Worker de ticket prova com `node --check`, `node tools/testes/run.mjs`
  e, quando for matemática, `node tools/harness.mjs`. Browser/relay é do **Lead**, no fecho da frente.
- Se um worker precisar de um valor ao vivo, ele **pede ao Lead** no relatório; não abre janela, não
  chama `Target.createTarget`, não usa `chrome-devtools` MCP.

### Quando o relay estiver offline (só o Lead)

```
omp browser-relay serve -p 9224 -v          # sobe o servidor; NÃO abre Chrome, NÃO pede confirmação
curl http://127.0.0.1:9224/json/version     # 200 + ompRelayVersion = vivo
node tools\_relay-prova.mjs "github\.com"   # prova real: dirige uma aba existente e lê a resposta
```

Se `/json/version` der 503, o **prelude está desligado** — reativa-se com `node tools/recarregar-extensao.mjs`
(REGRA 13) e **nenhum pedido de permissão é feito ao dono**. Se der 404/timeout, o servidor não está a
correr: sobe-se o comando acima. **Nunca** se responde "confirma no Chrome" ou "instala o relay".

### O que é proibido

1. Pedir ao dono para clicar, confirmar, instalar, ativar ou "permitir" o relay (nem em chat, nem no browser).
2. Abrir `chrome://extensions`/picker no perfil real para isto (já está instalado; usar a REGRA 13).
3. Lançar Chrome com `--remote-debugging-port`/`--user-data-dir` (REGRA 9/10.2).
4. Subagent a usar browser/relay para "provar" um ticket sem o Lead mandar.
5. Imprimir `/json/list` (privacidade — REGRA 11.1.5).

**Uma linha:** relay é infraestrutura local e idempotente — sobe-se sozinho, prova-se com
`/json/version` + uma avaliação real, e o dono nunca é interrompido.

---

## REGRA Nº 17 — A BUILD IDEAL TEM DONO E TEM DOCUMENTO (2026-10-23)

O dono suspeitou que a "build ideal" da conta dele estava errada. A suspeita procede enquanto a
decisão não for auditável: **um número que não se explica é um número em que não se confia.**

O estudo completo — inputs, fórmula, `file:linha` e **a lista honesta do que o modelo não vê** —
está em **`docs/build-ideal.md`**. Quem mexer em `buildIdeal`, `montarBuildDe`,
`montarBuildDePorScore`, `scoreSet`, `statsSet`, `estimarSet` ou `sobrevivenciaSet` lê aquele
documento ANTES, e actualiza-o depois. As três armadilhas que ele regista, em uma linha cada:

1. **A régua é o dono, não o DPS:** sobrevive com poção > mata em menos segundos > gasta menos ouro.
   `automation.js:9832-9841`. Um score que só ordena dano não é a build ideal.
2. **`scoreSet` poda; quem escolhe é o modelo de luta.** A medição que o obrigou está em
   `automation.js:9792-9800` — e um "melhor score" que mata mais devagar está errado.
3. **Número de resumo é suspeito até ser confirmado no `motor.js`** (`multTier`, `passivasDoItem`,
   `QUALIDADES`, `RM_MONSTRO`, o `3036`, o teto `3×CURVA.hp`). É a REGRA Nº 1 aplicada à build.
