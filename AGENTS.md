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
- **Ler a LISTA, não o valor.** Um campo escalado a mais ou a menos muda tudo: `motor.js:254-255` escala
  `ad/ap/mana/vida/armadura/rm/va/rv/critico/regen/cdr` e **não** o `penMag`. Ler "a fórmula" não chega —
  ler **quais campos** ela toca.

---

## As sete provas (2026-10-14)

Todas do mesmo tipo. Todas apanhadas pelo dono, não pelo agente.

| # | O que eu disse | O que o motor dizia |
|---|---|---|
| 1 | "O Ímpeto dá 15% de CDR" | `0,15 × 1,15 × 1,36 = 23,46%` — qualidade e refino **escalam** |
| 2 | "O pen da bota A é 17,25%" | `motor.js:254-255` **não escala** o `penMag` — é 15% |
| 3 | "CDR vale mais contra o chefe (1 abate)" | `motor.js:3080` — o Barão invoca 2 larvas **a cada 34,3 s**, não 14 (ver adenda abaixo) |
| 4 | "O Rei Destruído dá 4.600 por auto no Barão" | `motor.js:1190-1191` — **tecto de 3×CURVA.hp** → 863 |
| 5 | "O roubo de vida vale 0,02%, é quase nada" | `motor.js:1226-1228` — cura `dano × rv`; vale **269 cura/s** numa base AD |
| 6 | "O `multClasse = 0.12` bloqueia a build AD" | Não bloqueia. O bloqueio é `pesosItem('mago').ad = 0` |
| 7 | "A Katarina não tem cura própria" | O kit dela tem **`curaGiro`** (`motor.js:755-756`) — **cura no giro** |

**Nenhum era erro de matemática. Todos eram o motor a não ler o jogo que tem à frente.**

> **Adenda (2026-10-14, 21:15) — a prova #3 corrigida pelo próprio erro que ela denuncia.** A tabela
> dizia "2 larvas a cada 14s". O 14 é o campo `espera` do invocar (`motor.js:3076`) e o invocar é
> **1 de 3** mecânicas do rodízio (`motor.js:3080`): `(0+14)+(1,3+9)+(1+9) = 34,3 s`. Simulado passo
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