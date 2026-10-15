# Objetivo de item (cfg.objetivoItem) — Rabadon

Status: ativo. Medido a 2026-10-14 no motor a correr (Katarina, relay 9224), nunca por palpite.

## Porque este campo existe

Ate 2026-10-14 a build ideal era 100% EMERGENTE: `montarBuildDe()` (automation.js:3922) soma
stats ponderados x multiplicador de classe (`cl === classe ? 1 : 0.12`). Nao havia forma de
dizer "quero ESTE item". Num campeao AD o Rabadon (AP) levava 0.12x e era **inalcancavel por
construcao**.

`cfg.objetivoItem` fixa um item como ALVO, logo a seguir as botas, sem passar pelo
multiplicador de classe. Valores: `null` | `'rabadon'` | id numerico (`'3089'`).

## Prova (leitura pura, sem acao no jogo)

`buildIdealPara({magia:false})` — campeao AD:

| objetivo | build ideal | Rabadon? |
|---|---|---|
| `null` | 3172, 3046, 6631, 3085, **3031** | **NAO** |
| `'rabadon'` | 3172, **3089**, 3046, 6631, 3085 | **SIM** (slot 2) |

`buildIdealPara({magia:true})` — campeao AP (Katarina): 3175, **3089**, 3135, 3100, 6653.
Nesse caso o Rabadon entra **por merito proprio** — logo a presenca dele na build da Katarina
NAO prova o pin. O unico teste valido e num campeao AD.

Custo explicito da troca no AD: a build perde o **3031 Gume do Infinito**, que e o equivalente
AD do Rabadon (`danoCritico += 0.4`, motor.js:515; o Rabadon faz `ap *= 1.35`, motor.js:522).

## Guarda de equipamento

`alvoEquip` trocava o item-alvo por outro de maior `poderItem` — MEDIDO: com o Rabadon (3089,
`cabeca`, tier B) equipado, queria troca-lo pela Coroa da Rainha Despedacada (664644, tambem
`cabeca`, tier A). Ou seja, desfazia o objetivo recem-definido.

`planoEquipar` (automation.js:3638) passa a pinar: se o item-alvo esta equipado, sai de `saem`
e nenhum item do mesmo `espaco` entra em `entram`.

| | antes | depois |
|---|---|---|
| `mexe` | true | **false** |
| `entram` | [664644] | **[]** |
| `n.equip` | true | **false** |

## Receita do Rabadon (motor)

`3089` preco 3500, custo 1100, `de: ["1058","1058"]`, espaco `cabeca`, +130 AP.
`basicosDaBuild` usa CONTADOR (`nec[id]++`), nao Set — as 2x `1058` contam certo (era aqui que
a build podia ficar impossivel de montar).

## Onde os alvos dropam (motor x stats dela, nivel 29)

| item | zona | chance | drops/h | sobrevive mobs | chefe fatal |
|---|---|---|---|---|---|
| 6653 Liandry | Toca dos Lobos [10,20] | 0,0033% | 0 | sim | - |
| 6653 Liandry | Campo Vermelho [20,30] | 0,0041% | 0 | sim | - |
| 3089 Rabadon | Covil do Barao [40,50] | 0,0061% | 0 | **NAO** | **SIM** |
| 1058 Basta | Fosso do Dragao [30,40] | **0,180%** | **3** | sim | sim |

**Conclusao:** o Rabadon NAO e farmavel — a unica zona que o dropa mata-a. E compravel
(3500) e ela tem 9,6M. O componente `1058` dropa exactamente onde ela ja farma.

## Friccao / armadilhas

1. `planejar(ids)` devolve **array** e exige `ids`. Sem argumento devolve `[]` — nao e
   "planeador vazio", e a funcao errada.
2. `planoEquipar().ids` e um **Set**, nao array.
3. `JSON.stringify(undefined)` devolve `undefined`, nao string.
4. **Escrever a config com `chrome.storage.local.set` cru NAO chega — e desfeito.**
   O content script tem a config em MEMORIA; escrever so no storage deixa a copia em memoria
   velha, e a proxima gravacao do script repoe-a por cima. MEDIDO: `objetivoItem` escrito a cru
   voltou a `null`; escrito pelo `setConfig()` do motor **sobreviveu a um reinstall completo**
   (lido de volta: `{"objetivoItem":"rabadon","enabled":false}`).
   Regra: escrever SEMPRE pelo `setConfig()`.

   > Corrige uma afirmacao anterior minha: cheguei a atribuir o apagao ao reinstall. **Errado** —
   > o reinstall nao apaga o `chrome.storage`; a causa era a copia em memoria.
5. `--context-origin` escolhe o contexto isolado MAIS NOVO, e ha varios da mesma extensao sem
   `window.__lolidleAuto` — da falso `noEngine`. E preciso varrer `--list-contexts`.

## Necessidades (medido ao vivo)

`falta = ["vender","equip","lerCofre","mercado","montar","comprar"]`.
As antigas necessidades eternas estao corrigidas e observaveis: `presente:false` com
`rlEscondido:true` (exige visibilidade), `tarefa` com throttle de 5 min, `equip` real
(`planoEquipar(bag).mexe`).