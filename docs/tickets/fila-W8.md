# FILA W8 — Observação (inject/content) e documentos

**WORKTREE**: I:/wt/w8-obs   **BRANCH**: w8-obs

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em extension/inject.js, extension/content.js e docs/ (markdown). NÃO mexas em automation.js, gui.js nem tools/.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w8-obs -b w8-obs`
2. `cd I:/wt/w8-obs` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w8-obs: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (7)
### TK-02-09 | P1 | `inject.js` congela a CURVA à mão (números copiados, não lidos)
- **Ficheiro(s)**: extension/inject.js
- **Evidencia**: AGENTS.md REGRA Nº 3 — `inject.js:133 meta.curva = { hp: [150,100,1], ... }`, `inject.js:138 meta.grupoSpawn = { base: 2, rand: 3 }`, `inject.js:139 meta.respawn = { clear: 1.5, local: 1.2 }` — *"cópia à mão, congelada"*; AGENTS.md: *"a região do Barão foi buffada, o script não soube, e o dono morreu"*
- **Fazer**: avaliar a `CURVA` do jogo por nível dentro do mundo MAIN e mandar os números por `postMessage`, em vez de os copiar; manter as chaves actuais como fallback só quando a avaliação falhar, com motivo no log.
- **Aceitacao**: teste/Hook a mostrar que um buff na CURVA aparece no `meta` sem mexer no código (duas execuções com curvas diferentes dão `meta.curva` diferentes); `bun tools/testes/run.mjs` rc=0.
- **Evidencia extra (medido ao vivo, parte-02.md:2642 e 2670)**: `curvaHp: [150, 100, 1]` — **exactamente o fallback escrito à mão**, confirmado como o valor que o motor está a usar; correcção pedida em parte-02.md:2685-2693 (`meta.curvaPorNivel = { 29: {hp: CURVA.hp(29), ...} }`, mais ler `grupoSpawn` e `respawn`, que também estão inline no motor)
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1114 (a CURVA e LIDA do motor (fallback declarado)). **Grep nao e prova semantica**: a suite que cobre esta verde no banco 25/25; falta a verificacao ticket-a-ticket com teste dedicado

### TK-02-30 | P2 | Documentos entregues com marcas NAO VERIFICADO por falta de dados do jogo no repo
- **Ficheiro(s)**: docs/game-src/ (adicionar o que falta) e docs/drops-e-prioridades.md, docs/yasuo-build.md, docs/filtro-basicos.md
- **Evidencia**: parte-02.md:1307-1308 e 1369 — *“NAO VERIFICADO: dados-yasuo.js ausente (hp/armadura/RM/AS por nível); texto visível do checkbox e painel onde vive; se o servidor persiste `ignorarBasicos`; preços do mercado de jogadores”*; *“o motor do jogo não é importável aqui (faltam `docs/game-src/dados-ezreal.js` & cia, `motor.js:3-8`, e `i18n/en.js`)”*
- **Fazer**: trazer para `docs/game-src/` os ficheiros de dados que faltam (dados-<campeao>.js, i18n) a partir do fonte do jogo, para que o motor seja importável e as marcas NAO VERIFICADO possam ser verificadas; as que ficarem impossíveis no repo ficam explicitamente marcadas.
- **Aceitacao**: `docs/game-src/` passa a conter os ficheiros referenciados por `motor.js:3-8`; cada marca NAO VERIFICADO passa a verificada com `file:linha` ou fica marcada como impossível no repo.
- **Estado**: pendente

---

### TK-02-36 | P1 | Cópia do jogo em `docs/game-src/` pode estar desactualizada (regra dos “4 níveis” do chefe não existe lá)
- **Ficheiro(s)**: docs/game-src/ (re-exportar) — sem escrever em extension/
- **Evidencia**: parte-02.md:1618 — *“é pra levar em conta a nova atualizacao do jogo sobre chefes serem no maximo 4 leveis acima de voce … nao sei o limite disso e nao sei as condicoes”*; e parte-02.md:1643-1654 e 1670-1678 — a única regra encontrada é `motor.js:1121  Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador))` (Baron 40–50 com boneco nível 1 → chefe 42); *“a regra dos 4 níveis acima não aparece em lado nenhum … a cópia do jogo que temos pode estar desactualizada. Não vou inventar o limite; fica registado como lacuna a re-exportar.”*
- **Fazer**: re-exportar `docs/game-src/` a partir do jogo actual e procurar a regra dos 4 níveis (limite e condições); se existir, modelá-la com `file:linha`; se não existir no código, dizer que é regra do servidor e registar a lacuna.
- **Aceitacao**: `docs/game-src/` com data/hash de exportação no relatório; a regra dos 4 níveis encontrada com `file:linha` ou declarada como não existente no código — nunca inventada.
- **Estado**: ABERTO — 'a copia do jogo em docs/game-src/ pode estar desactualizada'. Verificavel por DADO: comparar o ficheiro local com o que o servidor serve. Proximo passo: `curl https://lolidle.com/js/motor.js` e comparar o hash com `docs/game-src/motor.js`

### TK-01-33 | P3 | motor-map.md §4.4 (drops por tier) nao reproduz o codigo nos tiers 0-2
- **Ficheiro(s)**: docs/motor-map.md
- **Evidencia**: parte-01.md L931: "motor-map §4.4 (drops por tier) nao reproduz o codigo atual nos tiers 0-2 (tier 0: codigo 0,0104%/0,130%/3,12% vs doc 0,0112%/0,140%/3,3549%); tiers 3-7 batem. Usei o codigo"
- **Fazer**: corrigir a tabela §4.4 com os valores do codigo (motor.js:1142-1149) e citar file:line.
- **Aceitacao**: tabela confere com avaliacao das funcoes reais (como fez a missoes-lane); nota da correccao no topo da secao.
- **Estado**: pendente

### TK-01-34 | P3 | lolidle-internals.md atribui o papel do Zac a Katarina
- **Ficheiro(s)**: docs/lolidle-internals.md
- **Evidencia**: parte-01.md L377: "Doc corrigida: docs/lolidle-internals.md:113-114 atribui a Katarina o papel do ZAC (dano 1.37→1.425, recebido 0.66); motor.js:884-885 diz Katarina {dano:1.2, recebido:0.75} e 0.66 e do Zac (motor.js:892-893)"
- **Fazer**: corrigir as linhas 113-114 com os valores de motor.js:884-885 (Katarina) e separar o papel do Zac (892-893).
- **Aceitacao**: leitura das linhas corrigidas confere com motor.js:884-885/892-893.
- **Estado**: pendente

### TK-02-15 | P3 | `docs/build-mob-chefe.md` nunca foi escrito
- **Ficheiro(s)**: docs/build-mob-chefe.md
- **Evidencia**: parte-02.md:582 e 629 — *"docs/build-mob-chefe.md: AINDA NAO ESCREVI"*; o agente principal recusou autorizar o autor a fechar o relatório enquanto o código ia mudar (parte-02.md:627-629)
- **Fazer**: escrever o documento **depois** de o bloco da GUI e o motor estabilizarem (senão nasce velho), descrevendo `buildParaMob`/`buildParaChefe`, `faseAtual()`, peças reservadas e as quatro fontes de itens, com `file:linha`.
- **Aceitacao**: ficheiro existe, cada afirmação tem `file:linha`, e nenhuma linha descreve comportamento que o código já não tem.
- **Estado**: pendente

### TK-01-48 | P3 | docs/build-yasuo.md descreve Ornn como loja (18k-118k) — e uma lotaria de 1,2%/tentativa
- **Ficheiro(s)**: docs/build-yasuo.md
- **Evidencia**: parte-01.md L2678-2680: "In §9.5q I described Ornn epic costs 18k-118k as if it were a shop price. It is not — it is a lottery with a per-attempt cost... 2250/0.012 ~ 187.500 gold per success"; L3509-3517 tabela de custo esperado (Tiamat 124.500)
- **Fazer**: corrigir a seccao de economia do doc: chance 1,2%/tentativa (2,4% com Runa Arcana), custo por tentativa, custo esperado = custo x 83 (numero publicado pelo jogo), lotes 1/10/100/1000, componentes consumidos so no sucesso.
- **Aceitacao**: seccao reescrita com os numeros medidos (L3509-3517) e citacao do tooltip do jogo; nenhuma mencao a preco de loja para o Ornn.
- **Estado**: pendente
