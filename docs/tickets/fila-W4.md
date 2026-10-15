# FILA W4 — Manutenção, fuga e viagens

**WORKTREE**: I:/wt/w4-fuga   **BRANCH**: w4-fuga

## LIMITES DE ESCRITA (frontal, não negociável)
Só podes mexer em: fuga/fugir, _regiaoAntesDaBase, supervisarBase, viajarPara, pausar/retomar, acumular, proximoGiro, trava de poção. NÃO mexas em build, região, barra, mercado nem GUI.

## ORDEM DE TRABALHO
1. Cria o worktree: `cd I:\!lolidle.com; git worktree add I:/wt/w4-fuga -b w4-fuga`
2. `cd I:/wt/w4-fuga` e trabalha SÓ aí.
3. Faz os tickets pela ordem de prioridade que está neles (P0 primeiro).
4. Para cada ticket: LÊ a fonte (motor.js / jogo.js / o ficheiro da extensão) antes de alterar — Regra Nº 1. Muitos tickets podem já estar corrigidos por escritas anteriores: VERIFICA antes, e se já estiver feito, diz-o e passa ao seguinte (fecha o ticket como "já estava corrigido em <ficheiro:linha>").
5. Corre `bun tools/testes/run.mjs` antes de commitar. Se um teste codificar comportamento antigo, actualiza-o e diz qual mudaste (Regra Nº 6).
6. `git add -A; git commit -m "w4-fuga: <uma linha do que fizeste>"`.
7. Reporta no formato fixo do protocolo.

## OS TEUS TICKETS (8)
### TK-02-33 | P0 | Fuga: hoje não foge de mob que mata e está no ramo do auto-play (dono: “NÃO É PRA MORRER, NUNCA”)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1618 — *“1,5. e é pra fugir de qualquer coisa que mata, pra qualquer boneco, em qualquer situacao … ARRUMA ESSA PORRA de fugir de chefe que mata, por que NAO É PRA MORRER, NUNCA, COM ESSE SCRIPT”*; e parte-02.md:1660-1668 — *“A fuga passa para `manutencao` … interruptor próprio `fugir` (default ligado) … hoje a função sai cedo com `if (!c || !c.boss) return;`, logo morrer para um mob não conta. Isso sai … Mantém-se a tua regra: se as poções cobrem a luta, não foge — termina o chefe”*
- **Fazer**: mover a fuga para o ramo `manutencao` (sobrevivência, não farmar), criar interruptor próprio `fugir` ligado por defeito, remover o `if (!c || !c.boss) return;` para fugir de **qualquer coisa que mata** (mob incluído), em qualquer campeão e qualquer situação, mantendo a excepção do dono (se as poções cobrem a luta, termina o chefe).
- **Aceitacao**: ao vivo, na Katarina com o auto-play desligado, o motor foge de um mob/chefe que a mata (marcador discriminante no log); com `fugir` desligado, não foge; `bun tools/testes/run.mjs` rc=0 com casos novos (mob que mata foge; luta coberta por poções não foge).
- **Estado**: codigo CORRIGIDO — evidencia automation.js:7511 (fuga de quem mata (regiaoSegura fail-closed)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-02-40 | P0 | “Voltar para onde estava” (`_regiaoAntesDaBase`) não valida segurança nem tem gate de `cfg.enabled` — manda-a de volta ao Barão
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-02.md:1956-1963 — `const reg = _regiaoAntesDaBase || regiaoIdeal(); if (reg) { logEvent(base, { voltarPara: reg, ... }); viajarPara(reg); }` (linha ~5731); *“A lógica ‘voltar para onde estava’ … não valida a segurança da região. Se ela passou pelo Covil do Barão, _regiaoAntesDaBase = barao e a rotina da base manda-a de volta para lá. E essa linha não tem gate de cfg.enabled, logo corre com a manutenção ligada”*; confirmado em parte-02.md:2037 (*“O meu: a regra ‘voltar para onde estava’ … sem validação de segurança e sem gate de cfg.enabled”*)
- **Fazer**: validar a região de retorno pelo mesmo critério de segurança (fail-closed, ver TK-02-39) antes de `viajarPara`, e respeitar a hierarquia de interruptores em vez de perguntar directamente a `cfg.enabled` (o padrão que já apareceu 3 vezes — parte-02.md:489-491).
- **Aceitacao**: no banco, um caso com `_regiaoAntesDaBase` = região insegura **não** viaja (e diz porque); um caso com região segura viaja; auto-play desligado não dispara a viagem; `bun tools/testes/run.mjs` rc=0.
- **Código da correcção (encaminhada em `eda6303f`, parte-02.md:2559-2565)**: `const mem = _regiaoAntesDaBase; const memOk = mem && (function(){ try { const e = estimarRegiao(mem); return !!(e && e.morte === false); } catch { return false; } })(); const reg = memOk ? mem : regiaoIdeal();` — fail-closed (`morte` ausente ou `true` → descarta a memória), **não gravar** regiões letais na memória e pôr o `viajarPara` da base sob a hierarquia.
- **Prova exigida (parte-02.md:2567-2570)**: memória em `barao` com nível 29 → escolher `dragao`; **controlo**: memória em `dragao` (segura) → usar `dragao` (a regra "voltar para onde estava" tem de continuar a funcionar quando é segura).
- **Estado**: codigo CORRIGIDO — evidencia automation.js:7640 (memoria da base VALIDADA por regiaoSegura). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket

### TK-01-12 | P2 | viajarPara() sem verificacao/retry; supervisarBase marca ativa ANTES de viajar
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L370-371 (F-7): "viajarPara (:1339-1347) sem verificacao/retry: 2 cliques com if silencioso e timings 700/400ms; todos os chamadores assumem sucesso (supervisarBase :3346 marca marcarAtiva ANTES de viajar → re-tenta so em 3 min)"
- **Fazer**: viajarPara devolve resultado verificado (local lido depois da viagem) com retry e backoff; marcarAtiva so depois da confirmacao; logar falha de viagem.
- **Aceitacao**: teste com viagem falhada (stub) → retry acontece e marcarAtiva nao e chamada antes do exito; teste de controle com viagem ok.
- **Estado**: pendente

### TK-01-13 | P2 | regiaoIdeal() null e silencioso — sintoma "parado na base" sem pista
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L373-374 (F-8): "regiaoIdeal() null e silencioso (:3268, :3343-3344): se META.locais/monstros nao chega, nunca sai da base e nao loga nada — sintoma exato do 'parado na Fonte'"; ll.mjs:67 passa local atual → previaSet acha {mob:null,...} em silencio (F-13, L378)
- **Fazer**: logar explicitamente quando regiaoIideal devolve null e porquê (qual campo falta); ll.mjs passa a aceitar --regiao.
- **Aceitacao**: teste: com META vazio aparece evento de log com motivo; ll.mjs dps --regiao dragao corre sem depender da localizacao atual.
- **Estado**: pendente

### TK-01-46 | P2 | pausar() em memoria faz a automacao ficar parada em silencio (3a vez do mesmo padrao)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L4415-4449: "gold 77.100 -> 63.800 (falling) | nivel 13 -> 14 (rising) | pausado: true... pausar() is in-memory state: if the next step fails, times out, or stays pending... the pause sticks, and the auto-play stops silently"; L4449: "A pausarPor(ms) — pause with automatic expiry... The structural correction; not yet implemented" (implementado e verificado em L4482-4488 — confirmar deploy)
- **Fazer**: usar pausarPor(ms) em TODAS as operacoes de base (Ornn/mercado/forja) para a pausa nunca ficar presa; rever pontos que ainda chamam pausar() sem expiracao.
- **Aceitacao**: grep: nenhuma operacao de base usa pausar() sem pausarPor; teste ao vivo: operacao abortada a meio -> automacao retoma sozinha em <= ms.
- **Estado**: pendente

### TK-01-14 | P2 | trava de 15min de pocao gravada antes do recall dar certo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L372: "trava de 15min de poco antes do recall dar certo (:3298-3302)"
- **Fazer**: mover a gravacao da trava para depois do recall confirmado (ou anular em falha); nenhuma trava sobrevive a um recall falhado.
- **Aceitacao**: teste: recall falhado nao deixa trava; recall com exito deixa trava com ts do exito.
- **Estado**: pendente

### TK-01-16 | P2 | acumular: fallback de poco escrito na variavel errada (curaPocao)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L375 (LOW): "acumular:1173 escreve fallback na variavel errada (curaPocao)"
- **Fazer**: escrever o fallback na variavel certa e cobrir com teste numerico (valor da poco = curaPocao esperada).
- **Aceitacao**: teste: acumular() sem cura conhecida usa o fallback correto (nao zero, nao undefined).
- **Estado**: pendente

### TK-01-17 | P2 | proximoGiro em loop infinito se o texto nao for exatamente 'Fonte'
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L375 (LOW): "proximoGiro loop infinito se texto != 'Fonte' exato (:3014)"
- **Fazer**: comparacao por localId normalizado (nao string exata) + limite de iteracoes com log de saida.
- **Aceitacao**: teste: local 'Fonte (nucleo)'/'fonte com acento' nao entra em loop; ha contador de seguranca.
- **Estado**: pendente


## TICKETS NOVOS (P0, acrescentados pelo Lead às 21:50)
### TK-01-52 | P0 | ciclo de viagem: verificar AO VIVO que morreu (ouro a subir, sem recalls) + rotina de base completa
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7544-7577 (subagent: P0 do ciclo RESOLVIDO — minimoPocoesAgora, reporPocoes reporta, backoff 45min, tecto de 3 recalls + farm forcado, n.vender so com mochila quase cheia); L8008-8020: "Vou verificar ao vivo - o ciclo tem de ter morto e o ouro tem de subir" (verificacao NAO feita no historico); L7135-7172 sintoma (viaja -> mata 1 mob -> volta, ouro congelado)
- **Fazer**: recarregar a extensao no browser do Yasuo e verificar por estado: log com {ir:base:vender, venda:{itens,valor}, custoIda:{ouro,seg}, falta:[]}, zero recalls em 10 min, ouro a subir; se o ciclo voltar, registar o motivo exacto.
- **Aceitacao**: janela de 10 min ao vivo sem recall (ou maximo 1 com fecho de necessidade) + delta de ouro positivo + log com falta:[] em cada ida a base.
- **Estado**: codigo CORRIGIDO — evidencia automation.js:7581 (ciclo de viagem (backoff/teito)). **Grep nao e prova semantica**: a suite que cobre o defeito esta verde no banco 0/25; falta a verificacao ticket-a-ticket
