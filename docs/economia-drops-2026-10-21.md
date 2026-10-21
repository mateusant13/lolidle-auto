# Economia de básicos/épicos: vale voltar à base para vender?

> Escrito em 2026-10-21 a pedido do dono: *"faz a conta e me fala se vale a pena voltar a base em
> alguma condicao pra vender tudo basico e epico"* + *"se é uma conta level 1, vender item basico a
> rodo ou epico seria imbecil, no minimo tem que garantir os itens pro personagem"*.
>
> **Regra de evidência:** cada número do jogo tem `file:linha`. A tabela foi calculada por script a
> partir das tabelas do motor (`itens.js` + `balanco.js` + `LOCAIS`/`DROPS`/`MONSTROS`), não copiada à
> mão. O cenário usa **30 abates/min** (a extensão mede o real em `ritmoMobs().killsMin`) e **17 s**
> por ida (`esperaRecallMs` = 9 s + 8 s de volta, `automation.js:4072`).

## 1. As fontes (nada inventado)

| o que | onde |
|---|---|
| preço de venda no Lojista = `preço × 0,5 × qualidade.venda` | `motor.js:284` |
| qualidade média de venda ≈ **0,976** | `motor.js:180-186` (`QUALIDADES` ponderado) |
| chance de básico/épico por abate, por tier | `motor.js:1241` (`BRUTO`) + `motor.js:1247-1251` (`chancesDrop`) |
| chefe: **40% básico / 5% épico / 0,1% lendário** | `motor.js:1243` (`DROP_CHEFE`) |
| espólio: valor e pilha de 1.000 | `motor.js:330-381`, `motor.js:372`, `motor.js:381` |
| mochila: **20 slots no nível 1**, +2 a cada 5 níveis (40 no 50) | `motor.js:36-37` |
| filtro "Sem básicos" descarta ANTES de entrar na mochila | `motor.js:1887`, `motor.js:3738`; UI `jogo.js:6387-6389` |
| custo da ida = ouro/min × 17 s | `automation.js:4063-4073` |
| portão da venda (valor real ≥ custo) | `automation.js:4589-4602` |

## 2. A tabela (cenário: 30 abates/min, personagem AD)

| região (nv) | básico/abate | épico/abate | venda média básico | venda média épico | ouro de loot/abate | ouro de monstro/abate | custo da ida (17 s) | básicos p/ pagar | épicos p/ pagar | 20 slots enchem em |
|---|---|---|---|---|---|---|---|---|---|---|
| Rota Inferior (5) | 3,12% | 0,130% | 160 g | 524 g | 5,67 g | 34,3 g | 291 g | 2 | 1 | ~21 min |
| Rota Superior (10) | 2,53% | 0,143% | 203 g | 492 g | 5,83 g | 61,5 g | 523 g | 3 | 2 | ~25 min |
| Lobos (15) | 1,76% | 0,128% | 227 g | 512 g | 4,64 g | 69,6 g | 591 g | 3 | 2 | ~35 min |
| Azul (20) | 1,26% | 0,114% | 175 g | 472 g | 2,74 g | 125,6 g | 1.067 g | 7 | 3 | ~49 min |
| Vermelho (25) | 1,00% | 0,110% | 329 g | 595 g | 3,94 g | 140,1 g | 1.191 g | 4 | 3 | ~60 min |
| Rio (30) | 0,95% | 0,125% | 299 g | 455 g | 3,40 g | 118,7 g | 1.009 g | 4 | 3 | ~62 min |
| Dragão (35) | 0,90% | 0,140% | 324 g | 508 g | 3,62 g | 165,3 g | 1.405 g | 5 | 3 | ~64 min |
| Barão (45) | 0,85% | 0,155% | 393 g | 573 g | 4,22 g | 220,7 g | 1.876 g | 5 | 4 | ~66 min |

**A conta que interessa:** uma mochila de 20 slots cheia (proporção medida ≈ 19 básicos + 1 épico)
vale **3.564 g** na Rota Inferior, **4.825 g** nos Lobos, **6.664 g** no Dragão e **8.040 g** no Barão.
O custo da ida é **291 g**, **591 g**, **1.405 g** e **1.876 g**. Ou seja: **a mochila cheia paga a
ida 4 a 12 vezes**, em qualquer faixa de nível.

## 3. A resposta, em uma frase

**Sim, vale — mas o gatilho é ESPAÇO, não o dinheiro.** Enquanto a mochila tem espaço, ficar no campo
rende mais (o ouro do Lojista é ~5-20% do ouro dos monstros por abate). Quando a mochila enche, cada
slot ocupado por um básico de 160-393 g está a **bloquear loot novo** (inclusive épico/lendário); aí a
ida de 17 s é sempre lucrativa. Por isso a regra certa é:

1. **Já estou na base por outro motivo?** Vende tudo o que o plano marcou (básico/épico/duplicado) +
   **todos os espólios**. Custo marginal zero. (É o que o código passou a fazer.)
2. **Estou no campo com a mochila quase cheia?** Volta e vende. Paga 4-12× o custo.
3. **Estou no campo, mochila com espaço e só há 1-2 básicos?** Não volta. Um lote de 6 básicos só paga
   a ida se o valor real cobrir o custo — e isso agora é verificado com o **valor medido**, não com
   uma contagem cega (`automation.js:4589-4602`).

## 4. O nível 1 e "garantir os itens pro personagem"

Vender básico à toa numa conta nova é errado **porque a build ainda não está feita** — não porque o
básico não valha ouro. A extensão passou a:

- **guardar as folhas da receita até ao tecto que a build pede**, mesmo com a montagem desligada
  (`buildIncompleta`, `automation.js:587`; `planBag`, `automation.js:624` e `:740`);
- vender só o **excedente acima do tecto** (`automation.js:737`) e o básico que **não serve** à build;
- **desligar o filtro "Sem básicos" quando a build volta a precisar de folhas** — senão o básico era
  descartado antes de entrar (`motor.js:1887`) e a build nunca se completava.

**Quando a build fica completa** (as 5 peças existem no equipamento ou na mochila) e a montagem está
desligada, o básico deixa de ter uso: o B do filtro vai a 0 e a extensão liga o **"Sem básicos"** do
próprio jogo. A partir daí não há básico para vender nem para encher a mochila — que é o estado
"desenvolvido" que o dono quer.

## 5. O espólio (a queixa "não vende na base")

O espólio é **outra coisa**: empilha até 1.000 por slot (`motor.js:372`), quase nunca enche a mochila,
e o próprio motor diz que rende *"na casa dos 30% a mais de ouro por abate"* (`motor.js:330`). O
defeito era outro: o `planBag` devolvia os espólios à parte e o `n.vender` só olhava para os **actos de
item**; logo o espólio nunca era uma necessidade e a rotina da base não executava a venda.

Correção (provada no banco, com mutação):
- o valor é **lido do título do slot que o jogo desenha** (`jogo.js:6470-6472`), não de tabela copiada;
- `n.vender` passa a ser verdadeiro **quando há espólio e já se está na base** (ou com a mochila
  quase cheia) — `automation.js:4360`;
- uma viagem **só** por espólio continua proibida sem pressão de espaço (o ouro do Lojista não entra
  na decisão, R1 — o gatilho é espaço).

## 6. O que foi provado

- `node tools/testes/run.mjs` → **rc=0**, todas as suites verdes (POPULATION 1.629), `UNSTUBBED 0`.
- Suite `fix-2026-10-21`: 44 checks, incluindo E1/E2/E3 (espólio/valor), B1/B2/B3 (básicos da build),
  C1 (cartas opt-in) e a conta valor ≥ custo.
- **Mutação** (4 alterações, cada uma apanha a falha):
  - cartas `=== true` removido → C1 falha;
  - espólio fora do `n.vender` → E1 falha;
  - proteção de básico sem `faltaBuild` → B1/B3 falham;
  - portão de viagem sem valor → E3 falha.
- **Ao vivo em perfil de LABORATÓRIO** (nunca o do dono): `BUILD 2026-10-21i`, `buildIncompleta:
  function`, `cartasAbrir:false`, `cartasEncaixar:false`, `compraMinTier:A`, `PCT_CARTA {1:0.02,
  2:0.05, 3:0.10}` (`tools/_prova-lab-20261021.mjs`).

**O que falta:** o dono tem de premir **F5** na aba do jogo para o Chrome largar o content script
velho. Sem F5, o comportamento antigo continua e nenhuma destas correções aparece.
