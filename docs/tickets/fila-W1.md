# FILA W1 — Regiões, avaliação de luta e ritmo

**WORKTREE**: I:/wt/w1-regioes   **BRANCH**: w1-regioes

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: regiaoIdeal, estimarRegiao, rankRegioes, agregar, avaliar, ritmoMobs, fatorDano*, nivelChefe/nível do chefe, rankBuildsTestadas, parse/regex do #log e das taxas ouro/xp. NÃO mexas em build de itens, barra, fuga, mercado nem GUI. Se um ticket precisar de algo fora daqui, para e reporta.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w1-regioes -b w1-regioes`
2. `cd I:/wt/w1-regioes` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w1-regioes: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (11)
### TK-02-39 | P0 | Filtro de morte em `regiaoIdeal` é no-op: região sem `morte` passa como segura (dono MORREU no Barão)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1977-1988 e 2003-2008 — `estimarRegiao(barao) → { goldMin: 5428, xpMin: 15765 }` **sem** `morte` e sem `dps`; `.filter((x) => x.e && !x.e.morte)` — se `morte` não vem, `!undefined === true` e a região passa como segura; `aggBarao: []` (zero dados medidos); medido em parte-02.md:2015: `rankRegioes() → Covil do Barão 15765 (#1) > Fosso do Dragão 13641`, com o boneco a nível 29 (parte-02.md:1898-1906)
- **Fazer**: 1) `estimarRegiao` passa a devolver o risco (`morte`, dps tomado) para **todas** as regiões, usando a avaliação de luta que já existe e os stats dos monstros do META; 2) o filtro passa a **fail-closed**: `morte` ausente = **NÃO segura**; 3) o ranking não pode apresentar taxa teórica de região onde o boneco morre.
- **Aceitacao**: com o boneco a nível 29, `estimarRegiao(barao).morte === true` e o Barão **sai do #1** do ranking (prova pedida em parte-02.md:2032); região sem dados dá `morte: true` (fail-closed), nunca `undefined`; `bun tools/testes/run.mjs` rc=0 com caso novo.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1405 (fail-closed implementado). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-01-01 | P0 | filtro `.morte` inexistente deixa regiaoIgal mandar nv 27 ao Dragao
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L366-367 (auditor-friccao F-3): "F-3 automation.js:3264/3274 — .filter(x => !x.e.morte) e rankRegioes().morte: 'morte' nao existe em estimarRegiao. Sem esse filtro, regiaoIdeal manda o nv 27 para o Dragao (nm[0]=30 <= nv+6) → chefe nv 40 → as mortes do TODOS.md:135-139"
- **Fazer**: implementar o campo `morte` em estimarRegiao() (probabilidade de morte na regiao) e mante-lo no filtro de rankRegioes(), OU remover o filtro morto; escolher por dado e documentar. Garantir que nv<=27 nunca ranqueia regiao com nm[0] > nv+6 enquanto o risco de chefe fatal nao for zero.
- **Aceitacao**: caso novo em tools/testes/ (regras ou teste proprio) que corre rankRegioes()/regiaoIdeal() para nv 27 e falha se devolver 'dragao'; `node tools/testes/run.mjs` rc=0 com o caso novo Verde.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:1405 (fail-closed implementado (mesmo filtro)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-01-02 | P1 | agregar() calcula nivel do chefe ~2,8x otimista (faixa[0]+2 em vez de nm[1]+2)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L364 (F-1): "agregar() usa nivelChefe = faixa[0]+2 (Rio: 27) em vez de nm[1]+2 (35); Dragao 32 vs 40 → risco ~2,8x otimista → checarChefeFatal nao foge e recomendar() diz 'sobrevive'"
- **Fazer**: unificar nivelChefe para nm[1]+2 ( convencao de motor.js:1121 clamp(jog+4, n1+2) ); rever todos os consumidores (checarChefeFatal, recomendar, dpsCenarios) e os testes que codifiquem o valor antigo.
- **Aceitacao**: teste em tools/testes/ assertando nivelChefe(35/40) para Rio/Dragao; regressao completa rc=0; relatorio diz quais testes mudaram.
- **Estado**: pendente

### TK-01-04 | P1 | fatorDanoJogador (motor.js:1221) calculado e nunca consumido — tKill ate 2,7x otimista
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L368 (F-5): "estimarLuta nao aplica fatorDanoJogador (motor.js:1221): fJ e calculado em :1114, devolvido em :1138 e NUNCA consumido; meuDpsBoss (:3149) = meDps*mitBoss. Dragao dif=9 → fJ=0.37 → tKill ~2,7x otimista → ganha=true"
- **Fazer**: consumir fJ em estimarLuta/meuDpsBoss e em tudo que derivar tKill/ganha; para O DONO nao levar numero ao vivo sem o fator. Conferir tambem fatorDanoMonstro nos dois sentidos.
- **Aceitacao**: teste numerico: Dragao dif=9 → tKill multiplicado por 1/fJ (0.37) face a versao sem fator; regressao rc=0.
- **Estado**: pendente

### TK-01-05 | P1 | avaliar() ignora papel.recebido — dano recebido 33% inflado (Katarina=0.75)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L369 (F-6): "avaliar() ignora papel.recebido (motor.js:2697); Katarina = 0.75 (motor.js:885) → dpsTomado/danoGolpe/piorMec 33% inflados → foge de luta ganhavel + rotacaoSkills usa ultimate em mobs"
- **Fazer**: aplicar papel.recebido lido de META.kits (motor.js:884-885) em avaliar() e herdar em rotacaoSkills; alinhar docs/lolidle-internals.md:113-114 (ver TK-01-34).
- **Aceitacao**: teste: avaliar() com Katarina dá dpsTomado 0.75x do valor sem papel; rotacaoSkills nao gasta ultimate em cenário de mobs.
- **Estado**: pendente

### TK-01-06 | P1 | cinco convencoes de nivel para o mesmo mob/chefe no automation.js
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L370 (F-4): "cinco convenções de nível no mesmo ficheiro (768 ok, 1168 errado, 1226 errado, 2104/2118/2960 errados nm[1], 3135 ok) — a #2 muda o ranking de builds do previaSet/dpsCenarios"
- **Fazer**: criar uma funcao unica nivelAlvo(local, papel) usada por todos os pontos; remover as cinco calculadoras locais; documentar a convencao escolhida com file:line do motor.js.
- **Aceitacao**: grep prova uma unica definicao; teste de paridade entre os 6 pontos de chamada antigos e a funcao nova; regressao rc=0.
- **Estado**: pendente

### TK-01-08 | P1 | ritmoMobs usa grupoSpawn.base=2 em vez da media 3 → valeUlt errado
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L373: "ritmoMobs usa grupoSpawn.base=2 em vez da media 3 (:376) → seg3 33% baixo → valeUlt"; media da wave confirmada em motor.js:1124 (2..4 mobs)
- **Fazer**: usar a media real da distribuicao da wave (motor.js:1118-1126) em vez de base=2; se o tamanho varia, usar valor esperado e documentar.
- **Aceitacao**: teste numerico de ritmoMobs confrontado com motor.js:1124; valor deixe de ser 33% baixo.
- **Estado**: resolvido 2026-10-15 — `ritmoMobs` usa `mediaWaveDe(META.grupoSpawn)` (a MEDIA, nao a base); provado pela suite `w1-regioes` B2 verde

### TK-02-41 | P1 | `estimarRegiao` calcula taxa teórica e não avalia a luta (não cruza os stats da wiki com a sobrevivência)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1968 — *“por que o script nao ta cruzando com a wiki o status de TUDO, e da regiao, pra calcular tudo?”*; resposta em parte-02.md:1992-1994 — *“O estimarRegiao calcula as taxas pelas curvas teóricas e não avalia a luta. O agregar() (dados medidos) está vazio para o Barão — logo não há nada a corrigir a teoria”*; e parte-02.md:2025 (*“a wiki (o META, que está fresco — 3 minutos) tem os stats dos monstros; o que falta é usá-los para avaliar a sobrevivência”*)
- **Fazer**: usar os stats dos monstros da região (META/wiki) para avaliar a luta — dps recebido, hp mínimo, sobrevive ou não — e incorporar isso na decisão de região e no ranking, em vez de só curvas de ouro/xp.
- **Aceitacao**: `estimarRegiao` devolve, por região, ouro/xp por minuto **e** risco avaliado (morte/dps) com `file:linha` da mecânica de dano do motor; ao vivo, nível 29 no Barão dá morte e o Fosso do Dragão fica à frente.
- **Estado**: pendente

### TK-01-41 | P1 | rankBuildsTestadas(null) agrega regioes — ranking enganoso (confundiu o agente 2 vezes)
- **Ficheiro(s)**: extension/automation.js; tools/backtest.mjs
- **Evidencia**: parte-01.md L2304: "rankBuildsTestadas(null) aggregates all regions — that 1264 may just be a different map"; L2425: "That was wrong. The controlled test... gives 754 gold/min for the same 4-item build. The 1264 did not reproduce."
- **Fazer**: rankBuildsTestadas/backtest devem segmentar por regiao (regiao obrigatoria ou agrupada com n e aviso) e recusar comparar celulas de regioes diferentes; cada amostra guarda regiao + timestamp.
- **Aceitacao**: teste: ranking com celulas de 2 regioes diferentes vem marcado/separado (nunca uma tabela unica ordenada); ferramenta recusa declarar vencedor cross-regiao.
- **Estado**: pendente

### TK-01-42 | P1 | numeros absolutos de gold/min nao comparaveis entre janelas (834 vs 1581, mesma build/regiao)
- **Ficheiro(s)**: extension/automation.js; tools/backtest.mjs
- **Evidencia**: parte-01.md L2528-2551: "the same build, same region, n=8, measured 834 in one round and 1581 in the next... not level... not the night modifier. Therefore: Absolute numbers are not comparable across rounds. Only comparisons within the same measurement window are valid"
- **Fazer**: todo ranking/backtest passa a ordenar por comparacao DENTRO da mesma janela (run id) e a exibir o id da janela; taxas absolutas levam aviso de nao-comparabilidade entre janelas.
- **Aceitacao**: snapshot/ranking traz campo janela/run em cada amostra; documento/ferramenta declina ranquear amostras de janelas diferentes sem teste conjunto.
- **Estado**: resolvido 2026-10-15 — `rankBuildsTestadas` ACUMULA as janelas da mesma assinatura e o `avisoJanela` sai; provado pela suite `w1-regioes` D verde

### TK-01-07 | P1 | regexes do #log nao aceitam "12.3k" — perde ouro E o abate; cacao offline injeta XP sem abate
- **Ficheiro(s)**: extension/automation.js; extension/inject.js
- **Evidencia**: parte-01.md L373: "regexes do #log nao aceitam fmt do jogo '12.3k' (cena.js:225) → perde ouro E o abate (:481-482, kills so contados if(g) em :489) e a linha de caca offline (jogo.js:6767) injeta XP sem abate"
- **Fazer**: parser de numero que aceita k/m (12.3k → 12300); contar kills independentemente do grupo de ouro; detectar a linha de caca offline e nao injetar XP dela sem abate correspondente.
- **Aceitacao**: testes com linhas reais do formato do jogo (cena.js:225) incluindo '12.3k' e a linha jogo.js:6767; ouro E kills contados corretos em cada uma.
- **Estado**: pendente
