# Backtesting de builds (dado real)

Ferramenta: `tools/backtest.mjs` — le um snapshot do idle e ranqueia builds
por ouro/xp/abates **por minuto**, com n e intervalo de confianca.

Nao abre browser e nao toca no jogo: so le o JSON exportado. Quem exporta o snapshot e a
lane do jogo vivo.

---

## Como correr

```bash
node tools/backtest.mjs                        # snapshot default, saida legivel
node tools/backtest.mjs --json                 # saida JSON pura (para outra ferramenta)
node tools/backtest.mjs docs/snapshots/yasuo.json
node tools/backtest.mjs --top 5 --region lobos
node tools/backtest.mjs --min-n 3              # esconde builds com n < 3
node tools/backtest.mjs --excluir-incompletos  # ignora ciclos truncados
node tools/backtest.mjs --help
```

Sem dependencias (so Node/bun). Default do snapshot: `docs/snapshots/yasuo.json`,
resolvido do cwd e, se nao existir, da raiz do repo.

---

## O que o snapshot contem

Arquivo de exemplo: `docs/snapshots/yasuo.json` (conta `yasuo`, champ `yasuo:0`).

| Campo | O que e | Uso aqui |
|---|---|---|
| `cycles[]` | cada ida a uma zona de caca | **fonte principal do ranking** |
| `cycles[].region` | nome da regiao (ex.: "Rota Superior nivel 5-15") | agrupamento |
| `cycles[].setup.equip[]` | itens equipados (id, base, nome, qual, refino, stats) | **assinatura de build** |
| `cycles[].mobFase.perMin` | {gold, xp, kills, potions, goldPotion...} ja por minuto | taxa de cada ciclo |
| `cycles[].mobFase` | totais brutos (gold, xp, kills, potions) e `durMs` | taxa "agregada" e minutos |
| `cycles[].fim` / `incompleto` | como o ciclo terminou | aviso de truncamento |
| `lutas[]` | lutas com `build`, `outDps`, `inDps`, `durS` | **DPS real por build** |
| `deaths[]` | mortes registradas | contagem |
| `agregado[]` | medias por regiao ja prontas no export | conferencia cruzada |
| `locais[]` | mapa: faixa de nivel, monstros, drops | contexto (nao usado no ranking) |
| `monstros{}` | hp/ad/xp/ouro relativos por monstro | contexto (nao usado no ranking) |

**Atencao:** o export atual esta com **JSON duplamente codificado** (uma string contendo
JSON). O script detecta e le os dois formatos; a saida avisa quando isso acontece.

### Assinatura de build

A build e identificada pela **lista de itens equipados, ordenada**: cada item vira
`id` (que ja inclui a qualidade, ex. `3044~A`) mais `#rN` se houver refino.
Itens iguais em ordem diferente contam como a mesma build. A saida mostra o rotulo legivel
(ex. "Botas C + Capa da Agilidade B + Espada Longa A + Adaga C + Fago A") e a assinatura crua.

---

## Como ler os rankings

Para cada build (e cada build x regiao) saem quatro numeros por metrica:

- **media** — media simples das taxas por ciclo. E a coluna do ranking.
- **agregado** — total bruto / total de minutos (pool por tempo). Diferente da media quando
  os ciclos tem duracoes diferentes: um ciclo longo pesa mais. Os dois aparecem porque
  discordam justamente quando a amostra e desigual.
- **desvio** — desvio-padrao amostral (n-1); `-` quando n < 2.
- **IC95** — intervalo de confianca de 95% da media (t de Student; z=1,96 para n>30).
  Com n < 2 fica **indisponivel**; com n = 2 fica enorme (e o retrato honesto do ruido).

**Rotulo de amostra** (`amostra`):

| n | rotulo | leitura |
|---|---|---|
| 1-2 | `insuficiente` | nao conclui nada; numero e anedota |
| 3-4 | `limitada` | indicacao fraca, IC largo |
| >= 5 | `ok` | ainda sujeito a vies de regiao/nivel |

**`sem-dados`** aparece quando a build nunca foi testada naquela regiao. Nunca e
inventado um numero, nem 0.

Secoes da saida legivel: proveniencia -> avisos -> matriz build x regiao -> ranking por
regiao -> ranking global -> DPS das lutas -> "o que nao da para concluir" -> limitacoes.

### Exemplo de leitura (dado real, snapshot de 2026-10-14)

```
ciclos: 4 | builds: 1 | lutas: 0
Rota Superior nivel 5-15   : 641,8 ouro/min (n=2, insuficiente)  IC95 [-1365,4 .. 2649,1]
Toca dos Lobos nivel 10-20 : 568,8 ouro/min (n=1, insuficiente)  IC95 indisponivel
Campo Azul nivel 15-25     : 306,2 ouro/min (n=1, insuficiente)  IC95 indisponivel
global                     : 539,7 ouro/min (media, n=4, limitada) | agregado 569,5
```

Leitura correta: **existe uma unica build medida**, entao nao ha ranking de builds —
ha so a taxa dessa build em tres regioes. O IC95 de [-1365 .. 2649] em Rota Superior
mostra que n=2 nao distingue nada. O DPS das lutas e `sem-dados`.

---

## Limitacoes (leia antes de decidir build)

1. **Amostra minuscula.** Com n=1-2 por regiao, o IC95 domina qualquer diferenca entre
   builds. Empate estatistico e o resultado mais comum.
2. **Regiao e nivel andam juntos.** Rota Superior (nivel 5-15) e Campo Azul (15-25) tem
   monstros e nivel diferentes: a diferenca de ouro/min mistura efeito da build, da regiao
   e do nivel do campeao. Comparacao entre regioes nao isola build.
3. **Ciclos incompletos.** No snapshot atual os 4 ciclos estao `incompleto:true` com
   `fim:"viagem"`: o farm foi interrompido, entao a taxa pode estar truncada (pior: se o
   trecho curto pegou uma parte boa, ele infla a media).
4. **Ciclos curtos sao ruidosos.** Abaixo de 30 s, um ou dois abates mudam muito a taxa.
5. **`lutas[]` vazio => zero informacao de DPS.** Nenhuma conclusao de dano,
   sobrevivencia ou troca de itens em combate.
6. **Media vs agregado.** Se os dois discordam muito, a amostra e desigual em duracao —
   nao escolha o numero que agrada.
7. **`perMin` vem do export.** Quando falta, o script deriva de `total * 60000 / durMs`
   (mesma formula, nada inventado), e isso fica registrado no JSON.
8. **Sem controle de confundidores.** Nao ha randomizacao: horario, furioso
   (`furiosoNome`), pocoes usadas e sorte de drop nao sao balanceados entre ciclos.
9. **Build com `sem-itens`.** Ciclo sem `setup.equip` cai num grupo proprio; nao e
   "build vazia" medida, e dado faltando.

### O que faria uma conclusao ser possivel

- >= 5 ciclos **por build x regiao**, alternando as builds na mesma regiao e no mesmo nivel.
- Registrar mortes (`deaths[]`) e DPS (`lutas[]`) para cruzar ganho de ouro com risco e dano.
- Deixar ciclos terminarem naturalmente (sem `incompleto:true`).

---

## Saida JSON

`--json` imprime **somente** o JSON (nada de texto antes/depois), com:

- `meta` — fonte, conta/champ, ciclos usados, regioes, filtros aplicados, avisos.
- `builds[]` — por build: assinatura, itens, n, minutos, totais brutos,
  `ouroMin`/`xpMin`/`abatesMin`/`pocoesMin` (cada um com `media`, `ic95`, `desvio`,
  `min`, `max`, `agregado`, `amostra`) e `porRegiao` (com `sem-dados` onde nao ha ciclo).
- `rankingGlobal[]` e `rankingRegioes[]` — rankings ja ordenados.
- `matriz[]` — build x regiao com `sem-dados` explicito.
- `lutas` — `disponivel` + outDps/inDps/durS por build.
- `naoConcluido[]` e `limitacoes[]` — o que nao deu para afirmar.

Codigos de saida: `0` ok, `2` snapshot ausente/invalido (mensagem no stderr).
