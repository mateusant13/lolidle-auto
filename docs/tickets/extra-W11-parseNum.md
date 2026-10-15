# TICKET EXTRA (W11) — parseNum (automation.js:201) apaga o sufixo k/M do `fmt()` do jogo

**Prioridade**: P0 (leitura errada EM SILENCIO de ouro, pocoes e loot acima de 10.000)
**Ficheiro**: extension/automation.js (linha 201; funcao `parseNum`)
**Escopo do W11**: NAO MEU. O W11 so pode mexer em "decisao de enfrentar chefes (limiares,
tolerancia de nivel), criterio de sobrevivencia no ranking de itens para o 5. espaco e banco de
testes". Leitura de numeros (ouro/pocoes/loot) e a lane da venda/economia. **Ticket novo, nao
edicao** - Regra N.o 5.
**Quem encontrou**: Lead (mensagem 22:01), confirmado pelo W11 ao ler o codigo.

## Evidencia

```js
// extension/automation.js:201
const parseNum = (s) => { const d = String(s ?? '').replace(/[^\d]/g, ''); return d ? Number(d) : NaN; };
```

O jogo escreve os numeros com sufixo (`fmt()`, cena.js:225): "12.3k" para 12.300 e "1.2M" para
1.200.000. O `replace(/[^\d]/g,'')` apaga o `.` E o sufixo, e devolve so os digitos:
"12.3k" -> **123** (deveria ser 12.300; 100x menos).

## Onde isso corrompe (lista completa dos consumidores)

| funcao | linha | o que le |
|---|---|---|
| `readGold()` | 216 (fallback) | ouro - para cima de 10.000 da "12.3k" em vez de 12.300 |
| `readPotions()` | 226 | **contagem de pocoes** - o minimo/reposicao passa a achar que nao ha pocoes |
| `scanBag()` | 265, 276 | qtd de espolio e o `vendaLojista` da dica |
| `handleLog()` | 761, 765, 766 | ouro e xp de cada abate - envenena o `agregar()` e o previsor empirico |

Ou seja: corrompe ouro, pocoes, loot e XP **em silencio**, e o `agregar()` (que alimenta o
previsor empirico e o ranking de regioes) herda o erro.

## A regra a usar (ja provada no content.js pelo proprio Lead)

`SUFIXO = { k: 1e3, m: 1e6 }`; o sufixo tem de entrar nos GRUPOS da regex; grupo de 3 casas
("4.188") = MILHAR; com sufixo ("12.3k") = decimal. Com inteiros, comportamento identico.

Casos de prova exigidos:

| entrada | saida certa | saida de hoje |
|---|---|---|
| "12.3k" | 12300 | **123** |
| "20.4k" | 20400 | **204** |
| "9.876" | 9876 | 9876 |
| "4.188" | 4188 | 4188 |
| "1.2M" | 1200000 | **12** |
| "12.3k / 20.4k" | {cur:12300, max:20400} | {cur:123, max:204} |
| "9.876 / 12.3k" | max 12300 | **max 123** |

## Aceitacao

`bun tools/testes/run.mjs` rc=0 com assercoes novas para os 7 casos acima (a suite nova pode
ir no mesmo banco), e `readGold()`/`readPotions()` com os valores certos ao vivo.

## Nota do W11

NAO toquei: a minha fila da o write scope por funcao ("decisao de enfrentar chefes, tolerancia
de nivel, criterio de sobrevivencia no ranking de itens para o 5. espaco, banco de testes") e
leitura de numeros nao esta la. Quem tiver a lane da economia pode fechar isto sozinho.
