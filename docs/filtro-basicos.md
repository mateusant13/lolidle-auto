# Filtro de itens básicos — QUANDO clicar no botão do jogo

> **Método:** leitura estática de `docs/game-src/`. Nenhum browser, nenhum CDP, nenhum jogo.
> Cada afirmação tem `file:linha`; onde não se prova, está escrito **NAO VERIFICADO**.

## 1. O botão existe — e é este

**CÓDIGO** — `jogo.js:5881-5886`, dentro do bloco de UI que também desenha `#atributos` (`5870`) e
`#pocoes` (`5888`):

```js
// não pegar itens básicos (pedido dos jogadores: a mochila enche menos)   jogo.js:5881
$('#ignorar-basicos').checked = !!estado.ignorarBasicos;                   jogo.js:5882
$('#ignorar-basicos').addEventListener('change', (e) => {                  jogo.js:5883
  estado.ignorarBasicos = e.target.checked;                                jogo.js:5884
  log(e.target.checked ? t('Itens básicos agora ficam no chão: só épicos, lendários, espólios e runas vão para a mochila.') : t('Itens básicos voltam a ir para a mochila.'), 'item');   jogo.js:5885
});
```

| campo | valor | prova |
|---|---|---|
| **ID** | `ignorar-basicos` | `jogo.js:5882-5884` |
| **Seletor** | `#ignorar-basicos` | `jogo.js:5882` (`$` = `document.querySelector`, `jogo.js:28`) |
| **Tipo** | `<input type="checkbox">` | **LIDO**: `<input type="checkbox" id="ignorar-basicos">` em `docs/game-src/jogar.html:289` (página do jogo trazida do vivo); usa `.checked` e o evento `change` com `e.target.checked` (`jogo.js:5882-5884`) |
| **Campo de estado** | `estado.ignorarBasicos` (booleano) | `jogo.js:5884` (escreve) · `motor.js:1794` (lê) |
| **Texto visível** | **"Sem básicos"** | **LIDO** em `docs/game-src/jogar.html:289` (a página do jogo, trazida do vivo a 2026-10-14): `<label class="mochila-filtro" title="Os itens básicos que caírem ficam no chão. Épicos, lendários, espólios e runas continuam vindo."><input type="checkbox" id="ignorar-basicos"> Sem básicos</label>`. O tooltip do rótulo also está lá. O `jogo.js:5882` não correria sem o elemento existir — e ele existe |
| **Texto do log (ao marcar)** | *"Itens básicos agora ficam no chão: só épicos, lendários, espólios e runas vão para a mochila."* | `jogo.js:5885` |
| **Texto do log (ao desmarcar)** | *"Itens básicos voltam a ir para a mochila."* | `jogo.js:5885` |
| **Estado inicial** | **desligado** | **LIDO**: o `<input type="checkbox" id="ignorar-basicos">` vem **sem** o atributo `checked` em `docs/game-src/jogar.html:289`. Confirmado no código: `novoEstado` (`motor.js:1011-1037`) e `migrar` (`motor.js:1038-1065`) não criam o campo; `motor.js:1794` testa-o como *truthy*, logo `undefined` = não filtra |

> **Contradição a registar:** `docs/motor-map.md:530` (C9) diz que *"nenhuma rota de UI fornecida
> escreve esse campo"*. Está **desatualizado**: `jogo.js:5882-5884` escreve-o. O que falta no
> repositório é só o **HTML** do checkbox.

## 2. O que ele faz ao drop — exatamente

**CÓDIGO** — `motor.js:1792-1797`, dentro de `processarAbates` (a função que corre a cada abate,
chamada em `motor.js:1645`, no Rift **e** em Runeterra):

```js
const itens = i.invocado ? [] : [...sortearLoot(lugar, i.chefe, mult * petIt, cl), ...];   // 1792
for (const id of itens) {
  if (estado.ignorarBasicos && raridade(infoItem(id)) === 'basico') continue;              // 1794  <-- O FILTRO
  if (espacosLivres(estado) > 0) { estado.mochila.push(...); guardados.push(id); ... }     // 1795
  else perdidos.push(id);                                                                   // 1796
}
```

**A ordem importa:** o sorteio (`sortearLoot`, `motor.js:1166-1178`) acontece **antes** do filtro. O
filtro não é um "reroll": o item já saiu; ele é simplesmente **descartado** (`continue` → não entra em
`guardados` nem em `perdidos`).

O que ele **faz**:

- item básico (raridade `basico` — `motor.js:54`) que saiu do sorteio **não entra na mochila**;
- não conta para `estado.totais.drops` (`motor.js:1795`);
- não aparece no evento `abate` (`motor.js:1807`) — nem como perdido.

O que ele **NÃO faz** (e é o erro de leitura mais fácil de cometer):

| não faz | prova |
|---|---|
| **não aumenta** a chance de épico/lendário | o sorteio é o mesmo ramo `if/else if/else if` — `motor.js:1160-1163`; o filtro só corre depois, em `1772` |
| não mexe em **espólios** | `motor.js:1776-1779` |
| não mexe em **gemas/runas** | `motor.js:1781-1783` |
| não mexe em **ouro** nem **XP** | `motor.js:1758, 1765` |
| não impede o drop de básico de **chefe** | o chefe tem `basico: 0,4` (`DROP_CHEFE`, `motor.js:1145`): com o filtro ligado **perdes esse básico** também (o `continue` é o mesmo) |
| não se aplica a monstro **invocado** | `i.invocado` → `itens = []` (`motor.js:1770`) |
| **não** protege a mochila de encher com épicos/lendários | `motor.js:1773-1774`: quem não couber continua a ser **perdido** |

## 3. O CRITÉRIO — quando é que um básico deixa de entrar na build

### 3.1 Um básico só serve para duas coisas

1. **Ser folha de uma receita** (`de`, `itens.js`; lido em `receitaDe`, `motor.js:3136`).
2. **Ser vendido no Lojista** — `valorVenda(x) = floor(preço × 0,5 × (1+0,5×refino) × venda_da_qualidade)`
   (`motor.js:257`).

Não há uma terceira. Equipar um básico é possível (`equipar`, `motor.js:2870-2881` aceita qualquer item
com atributo — `temAtributo`, `motor.js:20`), mas o básico não tem espaço próprio: são 1 bota + 4 itens
(`ESPACOS_ITENS = 4`, `motor.js:29`).

**Logo: "um básico entra na build" ⇔ "esse básico é folha de uma receita que ainda vou montar".**

### 3.2 O orçamento de básicos de uma build (o número que decide)

Expandir os `de` até às folhas (recursivo). Para a build de §4 de `docs/yasuo-build.md`
(Grevas Bélicas + Runaan + IE + Trindade + Hidra Raivosa) — DERIVADO:

| item | folhas (básicos) |
|---|---|
| `3172` Grevas Bélicas (`itens.js:1963`) | 1001 Botas ×1, 1042 Adaga ×3, 1018 Capa da Agilidade ×1 |
| `3085` Runaan (`itens.js:1440`) | 1018 ×1, 1042 ×3 |
| `3031` Gume do Infinito (`itens.js:2534`) | 1038 Espada G. p. C. ×1, 1037 Picareta ×1, 1018 ×1 |
| `3078` Trindade (`itens.js:2484`) | 1028 Rubi ×1, 1036 Espada Longa ×3, 1042 ×1, 2022 Partícula ×1 |
| `3074` Hidra Raivosa (`itens.js:2384`) | 1036 ×5, 2022 ×1 |
| **TOTAL** | **24 unidades**: 1036×8, 1042×7, 1018×3, 2022×2, 1001×1, 1028×1, 1037×1, 1038×1 |

### 3.3 Porque é que esse orçamento **não se acumula** (o argumento decisivo)

- A mochila tem `20 + 2×floor(nível/5)` espaços: **20 no nível 1, 24 no nível 10, 40 no nível 50**
  (`mochilaDe`, `motor.js:35-36`).
- O orçamento da build completa é **24 unidades** (§3.2) — **não cabe** na mochila nos níveis 1–9
  (20 a 22 espaços) e no nível 10 ocupa-a **exatamente** (24 de 24): zero lugares para um épico ou um
  lendário.
- Quem não couber é **perdido** (`motor.js:1773-1774`) — e um épico/lendário perdido custa ~20.000
  abates (§3.5).

**Conclusão: guardar o orçamento inteiro de básicos é a forma mais garantida de perder o drop que
interessa.** Guarda-se, no máximo, o que falta para a **próxima** receita.

### 3.4 A montagem no Ornn não é um caminho (a conta)

`montarItem` (`motor.js:3175-3196`): cada tentativa gasta o **ouro** (`motor.js:3186`) e as peças
**só são consumidas quando dá certo** (`motor.js:3191`). O custo por tentativa é
(`motor.js:3131-3135`):

- épico: `custo_da_receita × 3` — e a chance é `CHANCE_MONTAR.epico = 0,01` (**1%**) (`motor.js:3160`);
- lendário: `round(preço × 4,8 / 50) × 50` — e a chance é `0,001` (**0,1%**) (`motor.js:3134,3160`).

Com a persistência do Ornn (`comPersistencia`, `motor.js:75-80`, `3162`), o número esperado de
tentativas (simulei o próprio código — DERIVADO, e bate com o comentário do motor em `motor.js:3158`):

| raridade | tentativas esperadas | comentário do motor |
|---|---|---|
| épico | **60,9** | "~60 tentativas" (`motor.js:3158`) |
| lendário | **557,3** | "~550" (`motor.js:3158`) |

Preço, em ouro, de **montar a build inteira** (5 lendários):

| item | custo por tentativa | × 557,3 tentativas |
|---|---|---|
| 3172 Grevas Bélicas | 14.400 | 8,03 M |
| 3085 Runaan | 12.700 | 7,08 M |
| 3031 Gume do Infinito | 16.800 | 9,36 M |
| 3078 Trindade | 16.000 | 8,92 M |
| 3074 Hidra Raivosa | 15.850 | 8,83 M |
| **total** | 75.750 | **≈ 42,2 milhões de ouro** |

As **24 peças** que essa montagem consome valem, no Lojista, **4.736 de ouro** (esperança da qualidade:
`E[venda] = 0,976`, calculado de `QUALIDADES`, `motor.js:173-179` + `motor.js:257`). A relação é de
**~8.900 para 1**. Montar é uma loteria, não um plano.

### 3.5 A taxa de drop e o que se perde ao ligar o filtro

`BRUTO` (`motor.js:1143`) × `ajuste(n).drop` (`balanco.js:2`, por nível médio da zona — `NIVEL_DO_TIER`,
`motor.js:1138`). DERIVADO:

| zona | básico por abate | épico | lendário | ouro do abate | básicos = % do ouro |
|---|---|---|---|---|---|
| Rota Inferior | **3,12%** | 0,130% | 0,0104% | 32 | **15,7%** |
| Rota Superior | 2,53% | 0,143% | 0,0107% | 51 | 10,0% |
| Lobos | 1,76% | 0,128% | 0,0133% | 68 | 5,8% |
| Campo Azul | 1,26% | 0,114% | 0,0235% | 78 | 2,8% |
| Campo Vermelho | 1,00% | 0,110% | 0,0247% | 92 | 3,6% |
| Rio | 0,95% | 0,125% | 0,0269% | 110 | 2,6% |
| Dragão | 0,90% | 0,140% | 0,0328% | 127 | 2,3% |
| Barão | **0,85%** | 0,155% | 0,0368% | 162 | **2,1%** |

Ou seja: os básicos valem **15,7% do ouro no início** e caem para **~2%** no fim. O que se perde ao
ligar o filtro é isso — e o que se ganha é **não ocupar a mochila** com o que já não serve.

Abates necessários para juntar as **24 unidades** do orçamento (DERIVADO):

| zona | abates para 24 básicos | abates de ouro para pagar a montagem (42,2 M) |
|---|---|---|
| Rota Inferior | **769** | 1.323.354 |
| Rota Superior | 949 | 822.103 |
| Lobos | 1.364 | 617.178 |
| Campo Azul | 1.905 | 539.661 |
| Campo Vermelho | 2.400 | 458.859 |
| Rio | 2.526 | 385.525 |
| Dragão | 2.667 | 332.402 |
| Barão | 2.824 | 260.586 |

**Os básicos enchem em ~800–2.800 abates; o ouro para os montar precisa de 260 mil a 1,3 milhões de
abates — 150 a 1.700 vezes mais.** A janela em que um básico é matéria-prima útil é, na prática, o
começo do jogo.

## 4. O MOMENTO — regra de decisão

**Regra (a única que sai da matemática):**

> Calcula `B` = as folhas (básicos) das receitas dos itens que **ainda vais montar**.
> Enquanto `B > 0`, o filtro fica **desligado** (precisas das peças).
> Quando `B = 0`, clica: **nenhum básico volta a entrar na build**.

Aplicada aos dois planos possíveis:

| plano | quando `B = 0` | quando clicar |
|---|---|---|
| **Comprar pronto** (mercado de jogadores / drops de épico e lendário) — é a regra do dono registada em `extension/automation.js:404-408` | desde o primeiro abate: nunca se monta, logo nenhum básico é folha de nada | **clicar já, ao criar o personagem** (o básico só renderia 2%–16% de ouro extra, §3.5) |
| **Montar no Ornn** | quando as 24 unidades do orçamento (§3.2) estiverem na mochila — ou quando o item seguinte já não tiver receita em falta | ao fechar o orçamento da **próxima** receita (nunca o das cinco: não cabe na mochila, §3.3) |

**Número de referência para o plano "montar":** ~**770 abates** na Rota Inferior (ou ~**950** na Rota
Superior, ~**2.500** no Rio/Barão) é quando o orçamento de 24 básicos está completo. A partir daí,
cada básico que cai é (a) um espaço da mochila a menos e (b) um épico/lendário a menos, porque quem não
couber é perdido (`motor.js:1773-1774`).

**Número de referência para o plano "comprar pronto":** zero. Não há espera nenhuma.

## 5. Como acionar (sem inventar)

- O elemento é `#ignorar-basicos` (`jogo.js:5882`).
- **Clicar de verdade** (um clique sintético que dispare `change`), e **não** escrever `.checked = true`
  diretamente: o estado do jogo só é atualizado pelo *listener* de `change` (`jogo.js:5883-5885`);
  mudar a propriedade sem evento deixa o `estado.ignorarBasicos` a `false` e a mochila a encher na
  mesma. (CÓDIGO + INFERIDO — o listener é a única escrita do campo.)
- Para **verificar** se está ligado, lê-se `document.querySelector('#ignorar-basicos').checked` — o
  jogo sincroniza-o no arranque a partir do save (`jogo.js:5882`).
- Não há tecla de atalho nem outra rota para este campo: `grep` por `ignorarBasicos`/
  `ignorar-basicos` em todo o repositório dá **só** `motor.js:1794` e `jogo.js:5882-5884`.

## 6. O que ficou NAO VERIFICADO (lista honesta, 2026-10-14)

> Itens 1 e 2 foram **fechados** com a página do jogo (`docs/game-src/jogar.html`, trazida do
> vivo): texto "Sem básicos" e painel da Mochila, ambos na linha 289. Ficam 3 e 4 — as duas
> precisam do **servidor**, que não está no repositório. Item 5 depende de observação ao vivo
> (lane do Lead).

1. **O texto visível** do checkbox — **RESPONDIDO**: "Sem básicos", com o tooltip *"Os itens básicos que
   caírem ficam no chão. Épicos, lendários, espólios e runas continuam vindo."* —
   `docs/game-src/jogar.html:289` (página do jogo trazida do vivo; o repo já não depende do
   `index.html`).
2. **Em que painel/aba** ele vive — **RESPONDIDO**: no cabeçalho do painel **Mochila**, dentro de
   `#mochila`/`#janela-bolsa` (`docs/game-src/jogar.html:289`): `<header class="mochila-topo">…<span class="mochila-opcoes">`.
   Ao lado dele vive o outro filtro da mochila, `#alerta-lendario` ("🔔 Lendário"). A ordem de
   inicialização em `jogo.js:5870-5893` NÃO indica proximidade no DOM — eram painéis diferentes.
3. Se o **servidor persiste** `estado.ignorarBasicos`: o save envia o objeto `estado` inteiro
   (`jogo.js:128`, `rede.salvarNoServidor(estado)`), mas o que o servidor guarda não está no
   repositório. Se não persistir, o checkbox volta a `false` a cada recarga de página.
4. O **preço de mercado** dos itens (vem do servidor, `jogo.js:2580-2587`) — é a única alternativa
   verificável à montagem e não dá para calcular daqui.
5. Nada foi observado em execução: nenhum clique real foi feito no jogo.
