# Estado da sessao — LoL Idle (fecho 2026-10-14)

Status: ativo. Escrito para nao se perder contexto entre rondas. Tudo aqui e MEDIDO;
onde nao e, esta dito que nao e.

## 1. BLOQUEIO DE TOPO (precisa de decisao do dono)

**Entregavel (d) — "full build do Yasuo equipada e verificada no jogo real" — NAO feito.**

Conflito directo entre duas instrucoes do dono:
- a regra inviolavel diz "AUTO-PLAY SO NO YASUO";
- a instrucao de 2026-10-14 diz "nao e pra usar o yasuo. so a katarina".

Nao abro o browser do Yasuo por iniciativa propria. Persiste desde a ronda 94.

## 2. LICAO DE DEPLOYMENT (a mais importante da sessao)

O instalador UIA e **idempotente por caminho**: com a extensao ja instalada em
`I:\!lolidle.com\extension` devolve `{ok:true,installed:true}` **sem recarregar**, e o Chrome
continua a servir o script antigo. Aconteceu de verdade: passei ~3 rondas a medir contra codigo
velho sem saber.

**Correcao:** forcar o reload por dentro da propria extensao —
`chrome.runtime.sendMessage({type:'lolidle:reload'})` (tratado em `background.js:16-22`) — e
depois recarregar a pagina.

**E OBRIGATORIO PROVAR A VERSAO antes de afirmar "verificado ao vivo":** usar um marcador
DISCRIMINANTE, i.e. um texto que so exista no codigo novo:

```js
A.valorPassiva.toString().includes('Golpe Infinito')   // so no codigo novo
A.necessidadesBase.toString().includes('podeFazer')
```

Um marcador NAO discriminante engana: `includes('Armadura total')` deu `true` com o codigo
VELHO, porque a linha antiga tambem continha esse texto. Quase me fez acusar uma regex que
estava certa.

## 3. O QUE ESTA VERIFICADO (com prova)

- **Passivas: 9 -> 37 de 50** modeladas (em falta 13) = **74%**. Medido ao vivo com marcador
  em QUATRO vagas: (1) ordem das palavras; (2) AD% total, Vida maxima, cura recebida, critico
  (incl. `3031` Golpe Infinito, o equivalente AD do Rabadon, que valia 0); (3) penetracao de
  armadura, reducao de armadura do alvo, dano pela vida atual; (4) Cleave, Cleave Titanico,
  Aflição, Pavor, Tirania.
  As 13 restantes (`3057 3116 3085 6655 3742 3102 3083 6610 3026 3157 6333 3078 3072`) sao
  TODAS de ESTADO/COMBATE (lentidao, temporizadas, gatilho por vida, primeiro ataque) — nao ha
  mais nenhuma parseavel por texto. Forca-las produziria valores inventados.
  Causa era ordem de palavras: o codigo exigia `"Armadura total EM X%"` e o jogo escreve
  `"+15% DE Armadura total"`. E `3031 Golpe Infinito` (+40% critico, o equivalente AD do
  Rabadon) nao estava modelado — assimetria que empurrava a build AD para longe dele.
- **A build derivada MUDOU** com isso: `[3175,3089,3135,3100,6653]` -> `[3171,3089,3135,3100,4629]`.
  **Nao medido se a nova e melhor** (ver §4).
- **`scanBag` le a mochila SEM abrir nada.** O `press('i')`->le->`press('i')` era desnecessario:
  `jogo.js:6627` preenche `#mochila` dentro do `atualizarUI()` sem gate de visibilidade.
  Verificado: 25 itens lidos, bolsa fechada antes e depois.
- **`viajarPara` recorda a base primeiro.** A viagem e cancelada por dano (log do dono:
  "Viagem cancelada: voce levou dano"); a regra passou para dentro da funcao, para valer a
  todos os chamadores. Limite de 3 tentativas.
- **Hierarquia de interruptores** (tabela `INTERRUPTORES` + `podeFazer`), CONSUMIDA em 10 sitios
  do `necessidadesBase()`. Excepcoes: `vender`/`cofre`/`anunciar` sao SKIPPADOS em Runeterra.
- **Regra do campeao impossivel de violar:** o mestre `autoplay` tem
  `excecao: () => !ehCampeaoAlvo()` com `cfg.champAlvo='yasuo'`. Provado: com `enabled=true`
  forcado na Katarina, `podeFazer('autoplay')=false` e necessidades activas `[]`.
- **Cofre recolhido sozinho** (M2) + `cofreInfo()` (M3) + chave do slot (M1). GUI vista no ecra:
  estado vazio honesto, sem erro, a explicar que o motor recolhe sozinho.
- **Banco: 134 -> 229 assercoes**, 8 suites, `rc=0`, `UNSTUBBED 0`.

## 4. O QUE NAO ESTA MEDIDO (nao fingir)

- **Se a build nova e melhor que a antiga.** Tentei com `tools/backtest.mjs` (corre offline):
  o snapshot `docs/snapshots/yasuo.json` tem 30 ciclos de nivel 1-15 com builds de COMPONENTES
  (Botas/Capa/Espada Longa/Fago/Martelo) — **nenhuma contem os lendarios re-pontuados**. Alem
  disso 30/30 marcados `incompleto:true` e 13 com <30s de farm. Nao ha dado para responder.
- **A primeira leitura real do cofre** (M2): `cofreAt=null`, `cofreItens=0` — ela nao passou pela
  Fonte desde a mudanca.
- **O campo `k`** (chave do slot): `lerCofreSlots()` devolve `[]` com o cofre fechado.
- **Nada da GUI no ecra excepto o bloco do cofre** (que vi). Layout da tabela, selectores reais
  de NPC, preservacao do `<select>` entre renders: sem prova visual.

## 5. FRICCAO CORRIGIDA (a lista que valeu mais que features)

1. Extensao velha servida pelo Chrome (ver §2).
2. **Katarina com `enabled=true` sozinha** e 5 necessidades activas — o auto-play a agir contra
   a regra. Apanhado ao RE-VERIFICAR, nao ao assumir.
3. **`n.lerCofre` era necessidade ETERNA** — nao passava por `podeFazer` nem era desligada sem
   primaria. Com o auto-play desligado continuava `true` e era a unica aberta: recall a base a
   cada 10 min, para sempre, escondido atras de um interruptor desligado.
4. `mercadoSaturado()` devolve objecto e a GUI fazia `sat ? 'sim' : 'não'` — dizia SEMPRE "sim".
5. Chips da build por fase mostravam so o tier + "equipado"; o nome do item vivia apenas no
   `title`. O dono via `Aequipado` sem saber que peca era.
6. Modo de pocao "em sequencia" removido; so smart. Ramo PvP (`mode==='strongest'`) intacto.

## 6. PROXIMOS PASSOS (por ordem de valor)

1. **Decisao do dono sobre o Yasuo** — destrava (d), os ciclos novos e o refresh do snapshot.
2. **Ciclos novos com a build nova** -> medir a mudanca de passivas.
3. **Refrescar o snapshot** — esta de nivel 1-15 e truncado.
4. **13 passivas de estado** (Geada, Furia do Vento, Eco, Stalker, Stasis, Renascimento,
   Lâmina Encantada x2, Choque de Luz, Escudo de Feitico, Ignorar a Dor, Escudo Sanguineo,
   Coracao de Warmog): nao sao texto, exigem regra propria e varias dependem de combate
   (tempo decorrido, nº de inimigos, se e o primeiro ataque).
5. **Cofre: confirmar a primeira leitura** quando ela passar pela Fonte.

---

## 7. FECHO DA SESSAO (2026-10-14 17:30)

### Verificado no ecra (GUI) — 6 blocos, nenhum com valores quebrados

| separador | elemento | o que confirma |
|---|---|---|
| Itens | bloco Cofre | estado vazio honesto: "Ainda nao ha leitura do cofre" + explica que o motor recolhe sozinho. Nunca um erro |
| Mercado | `ap-mk-ofertas` | **bug corrigido**: `mercado cheio? nao 0/10 lendarios` (antes dizia SEMPRE "sim", por `mercadoSaturado()` devolver objecto e a GUI fazer `sat ? ...`) |
| Auto-play | `ap-t-auto`, `ap-auto-mestre`, `ap-auto-obj` | interruptor-mestre com 3 semanticas (Ligar / Desligar-observar / Parar tudo) + objectivo de farm |
| Historico | `ap-t-hist`, `ap-hi-lutas`, `ap-hi-mortes` | renderiza |
| Habilidades | `ap-sk-acoes` | renderiza |
| Farm & ganhos | `ap-fm-ciclos` | renderiza (tabela de ciclos) |

Inconclusivo: separador **Atributos** (a heuristica nao encontrou elemento visivel com >40 chars).
NAO afirmo se renderiza bem ou mal.

### Em curso quando a sessao fechou

Subagent `e64b1900` — desenhar a ARVORE DE INTERRUPTORES na GUI (ligar `arvoreInterruptores()`
e `podeFazer()` ao ecra). `gui.js` ainda sem referencias a essas funcoes (0 refs) na altura do fecho.
Requisito central do brief: distinguir VISIVELMENTE **"desligado pelo dono"** de **"bloqueado pelo
pai"** de **"skippado por excepcao"** — e o ponto todo da hierarquia.

### Friccao de metodo (para nao repetir)

- A expressao CDP atravessa o PowerShell: **barras invertidas dentro de regex literais sao
  destruidas** (`\[object` -> "Invalid regular expression") e literais entre aspas perdem-se.
  O que funciona: `indexOf` em vez de regex, e indices numericos (`tabs[3]`) em vez de nomes.
- O `renderTudo()` da GUI so desenha o separador ACTIVO. Um bloco noutro separador parece
  "ausente" se o testarmos sem clicar primeiro. Custa a descobrir.
- O banco (`tools/testes/run.mjs`) NAO valida `gui.js` — carrega so o `automation.js`. Verde no
  banco nao diz nada sobre a GUI.

### Numeros finais

```
banco        229 assercoes, 8 suites, rc=0, UNSTUBBED 0   (era 134 no inicio da sessao)
passivas     37 de 50 modeladas (74%)                    (era 9)
build ideal  [3171,3089,3135,3100,4629]                  (era [3175,3089,3135,3100,6653])
Katarina     enabled=false, alvo=false, necessidades activas []
```
