# Tickets — parte-01 (fonte: docs/historico/parte-01.md)

> Gerado por agente LEITOR. Um ticket por item PENDENTE do histórico. Itens já corrigidos e provados
> dentro do próprio histórico NÃO geram ticket. Decisões do dono ficam na secção final.
> Marcador deste lote: <!-- lote-1: linhas 1-1350 -->

### TK-01-01 | P0 | filtro `.morte` inexistente deixa regiaoIgal mandar nv 27 ao Dragao
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L366-367 (auditor-friccao F-3): "F-3 automation.js:3264/3274 — .filter(x => !x.e.morte) e rankRegioes().morte: 'morte' nao existe em estimarRegiao. Sem esse filtro, regiaoIdeal manda o nv 27 para o Dragao (nm[0]=30 <= nv+6) → chefe nv 40 → as mortes do TODOS.md:135-139"
- **Fazer**: implementar o campo `morte` em estimarRegiao() (probabilidade de morte na regiao) e mante-lo no filtro de rankRegioes(), OU remover o filtro morto; escolher por dado e documentar. Garantir que nv<=27 nunca ranqueia regiao com nm[0] > nv+6 enquanto o risco de chefe fatal nao for zero.
- **Aceitacao**: caso novo em tools/testes/ (regras ou teste proprio) que corre rankRegioes()/regiaoIdeal() para nv 27 e falha se devolver 'dragao'; `node tools/testes/run.mjs` rc=0 com o caso novo Verde.
- **Estado**: pendente

### TK-01-02 | P1 | agregar() calcula nivel do chefe ~2,8x otimista (faixa[0]+2 em vez de nm[1]+2)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L364 (F-1): "agregar() usa nivelChefe = faixa[0]+2 (Rio: 27) em vez de nm[1]+2 (35); Dragao 32 vs 40 → risco ~2,8x otimista → checarChefeFatal nao foge e recomendar() diz 'sobrevive'"
- **Fazer**: unificar nivelChefe para nm[1]+2 ( convencao de motor.js:1121 clamp(jog+4, n1+2) ); rever todos os consumidores (checarChefeFatal, recomendar, dpsCenarios) e os testes que codifiquem o valor antigo.
- **Aceitacao**: teste em tools/testes/ assertando nivelChefe(35/40) para Rio/Dragao; regressao completa rc=0; relatorio diz quais testes mudaram.
- **Estado**: pendente

### TK-01-03 | P1 | guarda "regiao letal" do iniciarTeste e codigo morto (falso-verde na TODOS.md:142)
- **Ficheiro(s)**: extension/automation.js; TODOS.md
- **Evidencia**: parte-01.md L365 (F-2): "a guarda 'regiao letal' do iniciarTeste e CODIGO MORTO: estimarRegiao() nao devolve .risco (retorno em :798). TODOS.md:142 marca como implementada → falso verde"
- **Fazer**: fazer estimarRegiao() devolver `risco` (ou substituir a guarda por `morte` do TK-01-01) e ligar a guarda do iniciarTeste; corrigir TODOS.md:142 para Refletir o estado real.
- **Aceitacao**: teste que prova a guarda disparar (regiao letal → iniciarTeste nao arranca) e pelo um caso de controle (regiao segura arranca); TODOS.md:142 atualizado.
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

### TK-01-07 | P1 | regexes do #log nao aceitam "12.3k" — perde ouro E o abate; cacao offline injeta XP sem abate
- **Ficheiro(s)**: extension/automation.js; extension/inject.js
- **Evidencia**: parte-01.md L373: "regexes do #log nao aceitam fmt do jogo '12.3k' (cena.js:225) → perde ouro E o abate (:481-482, kills so contados if(g) em :489) e a linha de caca offline (jogo.js:6767) injeta XP sem abate"
- **Fazer**: parser de numero que aceita k/m (12.3k → 12300); contar kills independentemente do grupo de ouro; detectar a linha de caca offline e nao injetar XP dela sem abate correspondente.
- **Aceitacao**: testes com linhas reais do formato do jogo (cena.js:225) incluindo '12.3k' e a linha jogo.js:6767; ouro E kills contados corretos em cada uma.
- **Estado**: pendente

### TK-01-08 | P1 | ritmoMobs usa grupoSpawn.base=2 em vez da media 3 → valeUlt errado
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L373: "ritmoMobs usa grupoSpawn.base=2 em vez da media 3 (:376) → seg3 33% baixo → valeUlt"; media da wave confirmada em motor.js:1124 (2..4 mobs)
- **Fazer**: usar a media real da distribuicao da wave (motor.js:1118-1126) em vez de base=2; se o tamanho varia, usar valor esperado e documentar.
- **Aceitacao**: teste numerico de ritmoMobs confrontado com motor.js:1124; valor deixe de ser 33% baixo.
- **Estado**: pendente

### TK-01-09 | P1 | salvarTestes grava a MESMA rodada N vezes → previsorHistorico saturado
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L372: "salvarTestes grava a MESMA rodada N vezes (:2293-2300) → previsorHistorico saturado"
- **Fazer**: deduplicar por (regiao, variacao, janela) antes de gravar; uma rodada = um registo.
- **Aceitacao**: teste: correr salvarTestes N vezes com o mesmo resultado → hist com 1 entrada; previsorHistorico deixa de saturar.
- **Estado**: pendente

### TK-01-10 | P1 | player().vida fallback hardcoded 4188 (numero copiado, Regra Nº 3)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L372: "player().vida fallback hardcoded 4188 (:844)"
- **Fazer**: remover o 4188; em falta de dado, devolver null/unknown explicito e fazer os consumidores tratarem a ausencia (nunca inventar vida).
- **Aceitacao**: grep sem 4188 em automation.js; teste: player().vida sem DOM → null e consumidores degradam semnumero fabricado.
- **Estado**: pendente

### TK-01-11 | P1 | bonusTwitch/bonusEvento enviados por inject.js:156-157 e ignorados em automation.js:692
- **Ficheiro(s)**: extension/inject.js; extension/automation.js
- **Evidencia**: parte-01.md L372: "bonusTwitch/bonusEvento do inject.js:156-157 ignorados por automation.js:692"; multiplicadores existem em motor.js:1765 (twitch<=1.5, evento<=3)
- **Fazer**: consumir bonusTwitch/bonusEvento nas estimativas de xp/ouro (e onde mais o motor os aplica) e testar com valores de extremo (1.5x / 3x).
- **Aceitacao**: teste: com bonusEvento=3 a estimativa de xp/h triplica face a bonusEvento=1 (linear, como motor.js:1765).
- **Estado**: pendente

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

### TK-01-14 | P2 | trava de 15min de pocao gravada antes do recall dar certo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L372: "trava de 15min de poco antes do recall dar certo (:3298-3302)"
- **Fazer**: mover a gravacao da trava para depois do recall confirmado (ou anular em falha); nenhuma trava sobrevive a um recall falhado.
- **Aceitacao**: teste: recall falhado nao deixa trava; recall com exito deixa trava com ts do exito.
- **Estado**: pendente

### TK-01-15 | P2 | valeComprar compara x.region === zona.nome e nunca casa
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L372: "valeComprar compara x.region === zona.nome e nunca casa (:2883-2884, cai em ag[0] ou killsMin=10)"
- **Fazer**: corrigir a comparacao para o identificador correto de regiao (mesmo dominio de localId/regiao usada no ranking) e remover o fallback killsMin=10 hardcoded.
- **Aceitacao**: teste: anuncio na regiao certa é reconhecido (nao cai no fallback); anuncio de outra regiao nao conta.
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

### TK-01-18 | P2 | config morta ultEmMobs/keepEpicA, readLocation().tier sempre null, accumulate 0 sem medicao
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L374-375 (LOW): "config morta ultEmMobs/keepEpicA + readLocation().tier sempre null" e "accumulate silenciosamente 0 sem medicao"
- **Fazer**: ligar as configs ao comportamento ou remove-las; fazer readLocation() devolver tier real (META.locais) e accumulate logar quando ficar 0.
- **Aceitacao**: teste: tier correto para 3 locais; accumulate com 0 gera log de aviso.
- **Estado**: pendente

### TK-01-19 | P2 | getRunLog() le window.__lolidleRunLog nunca escrito — diagnostico as cegas
- **Ficheiro(s)**: extension/automation.js; tools/ll.mjs
- **Evidencia**: parte-01.md L522: "getRunLog() reads window.__lolidleRunLog — a variable that is never written. logEvent() writes to farm.log. So the log always reads empty (my diagnostics were blind)"
- **Fazer**: unificar a leitura do log na fonte real (farm.log) ou escrever tambem em __lolidleRunLog; garantir que qualquer diagnostico de sessao ve o mesmo log.
- **Aceitacao**: teste: depois de N logEvent(), getRunLog() devolve os N eventos (ou o consumidor le farm.log com o mesmo resultado).
- **Estado**: pendente

### TK-01-20 | P2 | SA-2d42191889301ec6: nada prova que ~? e emitido pelo jogo
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L65-66: "SA-2d42191889301ec6 (nada prova que ~? e emitido pelo jogo — a guarda pode proteger caso impossivel)"
- **Fazer**: verificar no motor/jogo ao vivo se o padrao ~? e emitido; se nao for, remover a guarda morta e dizer no relatorio.
- **Aceitacao**: evidencia ao vivo (captura do log/DOM mostrando o padrao, ou sua ausencia) + guarda removida ou provada necessaria; recibo escrito conforme pedido do dono.
- **Estado**: pendente

### TK-01-21 | P2 | SA-da8d7738ab3c954a: correr os harnesses contra #janela-venda real
- **Ficheiro(s)**: tools/testes/; extension/automation.js
- **Evidencia**: parte-01.md L67-68: "SA-da8d7738ab3c954a (capturar #janela-venda real e correr os harnesses contra ele, fechando o DOM stubado)"
- **Fazer**: capturar o DOM real de #janela-venda (e #janela-npc) e correr ator.test.mjs contra ele; fechar a diferen stub→real no vocabulario do dom-stub.
- **Aceitacao**: relatorio com captura real + run.mjs rc=0 contra o DOM real (ou diferenca explicitamente listada e coberta).
- **Estado**: pendente

### TK-01-22 | P2 | divida handoff: unificar buildIdealPara com valorDe
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L36-37: "Ficaram por executar: unificar buildIdealPara com valorDe, guarda de build no refino, passivas por contexto, FPS e snapshot 1:1 — e toda a missao M1-M9"
- **Fazer**: uma unica fonte de valor de item (valorDe) usada por buildIdealPara e pelos consumidores; remover pontuacoes duplicadas.
- **Aceitacao**: teste de paridade: buildIdealPara(x) consistente com valorDe para os itens do catalogo (spot-check 10 itens, 3 classes).
- **Estado**: pendente

### TK-01-23 | P2 | divida handoff: guarda de build no refino
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L36-37 (mesmo trecho: "guarda de build no refino")
- **Fazer**: nunca refinar item que sai da build ideal; a guarda corre antes de gastar ouro/pedra e loga o bloqueio.
- **Aceitacao**: teste: refino de item fora da build e recusado com log; item da build passa.
- **Estado**: pendente

### TK-01-24 | P2 | divida handoff: passivas por contexto
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L36-37 ("passivas por contexto")
- **Fazer**: escolher passivas conforme o contexto (regiao/alvo/modo) com base nos kits de motor.js em vez de lista fixa.
- **Aceitacao**: teste: 3 contextos diferentes dao escolhas de passiva diferentes e justificadas por campo do kit.
- **Estado**: pendente

### TK-01-25 | P2 | divida handoff: FPS e snapshot 1:1
- **Ficheiro(s)**: extension/automation.js; extension/inject.js; tools/snap-export.mjs
- **Evidencia**: parte-01.md L36-37 ("FPS e snapshot 1:1")
- **Fazer**: medir FPS real e garantir que o snapshot exportado espelha 1:1 o estado do jogo (mesmos campos, mesmos valores).
- **Aceitacao**: snapshot exportado confrontado campo a campo com leitura ao vivo do mesmo instante (script de comparacao); FPS medido e Registrado.
- **Estado**: pendente

### TK-01-26 | P2 | M5: ciclo de mercado por implementar (poll/compra/venda)
- **Ficheiro(s)**: extension/automation.js; tools/ll.mjs
- **Evidencia**: parte-01.md L998: "M5/M6 (market cycle, refine-by-essential-item) haven't been touched"; datas snapshot docs/snapshots/market.json (58 B = vazio)
- **Fazer**: O CICLO JA FUNCIONA (L1748-1749 verificou comprarNoMercado na base lendo precos reais 3172=350.000/3085=180.000; L2076-2077 reserva corrigida para base medida; L2196-2200 o mercado so abre no Mercador da Fonte). Falta: (a) garantir que corre SOZINHO a cada visita a base (throttle 10 min, L1745); (b) registar no log quando nao ha ofertas para os itens da build (L2200) em vez de devolver compras:[] sem explicacao; (c) o produto comprado tem de cair para a build/componentes (proteccao em venderBase — historico L4310-4321, componentesDaBuild()).
- **Aceitacao**: 3 visitas a base consecutivas com o ciclo a correr sem intervencao; log com motivo explicito quando compras:[]; compra real registada quando houver oferta.
- **Estado**: pendente

### TK-01-27 | P2 | M6: refino por item essencial
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L998: "M5/M6 ... haven't been touched"; ordem do dono: "refinar item essencial A+ ate +2/+3" (L10-11)
- **Fazer**: escolher o item essencial da build ativa e refinar primeiro esse (A+ → +2/+3), com a guarda do TK-01-23 e limites de risco definidos.
- **Aceitacao**: teste: com 3 itens refinaveis, o essencial da build e escolhido; refinamento para quando o risco de rebaixar e inaceitavel.
- **Estado**: pendente

### TK-01-28 | P1 | M1: lutas[] e deaths[] vazios — sem DPS real, sem mortes para backtest
- **Ficheiro(s)**: tools/snap-export.mjs; extension/automation.js; tools/backtest.mjs
- **Evidencia**: parte-01.md L855-858: "DPS real: lutas[] esta VAZIO (0 lutas) -> 'sem-dados'... deaths[] vazio"; L1171: "lutas[] is still empty so no real DPS"
- **Fazer**: NOTA do historico (L1917-1942): as 5 regioes que o Yasuo (nv 12-14) pode farmar NAO tem chefe (chefe so em rio/dragao/barao, nv+13..+36) — lutas:0 de chefe e o resultado CORRETO, nao bug. Entao: (a) gravar lutas de MOB (dano por golpe, curas) e deaths no export; (b) manter tools/sim-chefes.mjs como via de backtesting de chefe (ja parametrizado em L3015-3022) e confronta-lo com a realidade quando o nivel chegar a rio (~25+).
- **Aceitacao**: lutas[] com >=1 luta de mob apos N minutos de farm; deaths[] com registo quando houver morte (docs/snapshots/deaths.json hoje tem 6 B = vazio); `node tools/backtest.mjs` deixa de mostrar 'sem-dados' para pelo menos 1 regiao.
- **Estado**: pendente

### TK-01-29 | P2 | export do snapshot em JSON duplamente codificado
- **Ficheiro(s)**: tools/snap-export.mjs
- **Evidencia**: parte-01.md L861: "O export esta com JSON DUPLAMENTE codificado (string contendo JSON). O script le os dois formatos e avisa na saida; se alguem for consumir o arquivo direto, precisa de 2x JSON.parse"
- **Fazer**: gravar o snapshot como JSON unico (objeto, nao string) e manter compatibilidade de leitura com os ficheiros antigos.
- **Aceitacao**: `node -e "JSON.parse(require('fs').readFileSync('docs/snapshots/yasuo.json','utf8'))` devolve objeto com cycles/lutas; backtest.mjs corre sem aviso de dupla codificacao.
- **Estado**: pendente

### TK-01-30 | P2 | dados-yasuo.js ausente (motor.js:4 importa) — AS base indecidivel sem jogo
- **Ficheiro(s)**: docs/game-src/; docs/build-yasuo.md
- **Evidencia**: parte-01.md L1079: "I1 AS base/AS-nivel (dados-yasuo.js ausente — motor.js:4 importa e o ficheiro nao existe) → teste T1: ler #st-va com e sem 1 Adaga"
- **Fazer**: trazer dados-yasuo.js (e dados*.js dos outros campeoes) para docs/game-src ou correr o teste T1 ao vivo (#st-va com/sem Adaga) e registar AS base/nivel do Yasuo.
- **Aceitacao**: ficheiro em docs/game-src OU medic documentado com os dois numeros; build-yasuo.md atualizado.
- **Estado**: pendente

### TK-01-31 | P2 | preco de compra no mercado impossivel de saber (market.json = anuncios da propria conta)
- **Ficheiro(s)**: extension/automation.js; tools/ll.mjs
- **Evidencia**: parte-01.md L1080: "I2 preco de compra no mercado (market.json sao anuncios DA PROPRIA CONTA, com 'Cancelar' — nao e preco de compra) → T8"
- **Fazer**: capturar o painel de compra do mercado ao vivo (T8) e alimentar o ciclo M5/TK-01-26 com preco real de compra por item.
- **Aceitacao**: tabela de precos observada ao vivo para >=5 itens da build; M5 usa esses precos nas contas de espera.
- **Estado**: pendente

### TK-01-32 | P2 | buildIdeal() x docs/build-yasuo.md discordam — decidir por backtest, nao por palpite
- **Ficheiro(s)**: tools/backtest.mjs; extension/automation.js
- **Evidencia**: parte-01.md L1258: "buildIdeal() (extension) says 3172, 3046, 6631, 3085, 3031; docs/build-yasuo.md (math over motor.js) says 3172, 3085, 3031, 3078, 3074... can only be settled by testing in-game"
- **Fazer**: a build MEDIDA (1001+1036+3044+1018+3133, toda A, rota-sup) ganhou nos dois caminhos (L1540-1652). A build TEORICA lendaria (3172+3085+3031+3078+3074 de docs/build-yasuo.md) nunca foi testada porque precisa de ouro/itens. Correr teste controlado MESMA regiao/janela quando a build lendaria estiver montada (depende de TK-01-39/TK-01-50).
- **Aceitacao**: ranking com n>=8 por build na mesma janela; vencedor declarado so com dado, nunca por palpite (regra do dono).
- **Estado**: pendente

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

### TK-01-35 | P2 | causa dos setInterval da extensao morrerem (aba oculta) nunca investigada
- **Ficheiro(s)**: extension/automation.js; tools/guest-chrome.mjs; tools/autoplay-up.mjs
- **Evidencia**: parte-01.md L640-642: "8 ids registered, plan 101s without advancing, zero log — yet a fresh interval fired 6x/6s and calling the function by hand worked instantly. The registered timers are dead. Rather than keep chasing why, let me make the auto-play guaranteed to run via an external tick driver"
- **Fazer**: descobrir porque os timers registados morrem (page freezing por occlusion vs outro) e garantir os dois: (a) flags/visibilidade que os mantenha vivos; (b) tick externo + heartbeat auto-cripturante como rede. Provar ao vivo com marcador.
- **Aceitacao**: sessao de 10 minutos ao vivo com timersLen estavel e log a avancar, ou documento com a causa provada e a mitigacao aplicada.
- **Estado**: pendente

### TK-01-36 | P1 | autoEquip off: itens A na mochila nunca sao equipados (objetivo exige full build equipada)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1264: "autoEquip is still off so the bag's A-quality items aren't being worn"; objetivo do goal (L756): "full build equipada e verificada no jogo real"
- **Fazer**: NOTA: autoEquip=off e regra do dono (regra14) — ver DECISOES DO DONO D-01. Este ticket cobre o OUTRO lado: a build ideal (medida/teorica) tem de ser EQUIPADA por accao explicita e mantida, com verificacao ao vivo dos 5 slots (o agente ja equipou 1001+1036+3044+1018+3133 em L2579; falta manter e avancar para a build lendaria — TK-01-50).
- **Aceitacao**: leitura ao vivo dos equipados = assinatura da build vencedora do momento; nenhum item fora da build equipado; log do jogo confirma.
- **Estado**: pendente

### TK-01-37 | P2 | pontos de atributo: Vitalidade/Resistencia nao dao dano (Forca +2,64%, Agilidade +1,96%)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1076 (D2): "10 pontos em Vitalidade/Resistencia = +0,00% de dano; Forca = +2,64%; Agilidade = +1,96%. ACREDITO NA MATEMATICA (e no dono, TODOS.md:1148)"
- **Fazer**: recomendar/distribuir pontos pelo valor medido de dano por ponto (por classe), com a ressalva de sobrevivencia quando o dono quiser; nao inventar numero — confirmar em motor.js a formula de cada atributo.
- **Aceitacao**: teste: recomendacao de pontos Yasuo prioriza Forca/Agilidade sobre Vitalidade/Resistencia no cenario de dano; fórmula citada com file:line.
- **Estado**: pendente

### TK-01-38 | P2 | medicoes pendentes do build-lane: T6 (abates/min outras zonas), T12 (R na rotacao), E acumula x1,5 em alvo unico, qualidade/refino do drop
- **Ficheiro(s)**: docs/build-yasuo.md; extension/automation.js
- **Evidencia**: parte-01.md L1081-1083: "I3 se o R entra na rotacao (snapshot: onBar false) → T12; I4 abates/min fora de rota-sup/lobos/azul → T6; I5 qualidade/refino do drop (sorteio e do servidor); I6 se o E acumula x1,5 em alvo unico"
- **Fazer**: correr os testes T6/T12/I5/I6 na lane serializada de CDP (um de cada vez, nunca em paralelo) e registar os numeros em docs/build-yasuo.md.
- **Aceitacao**: cada teste com numero previsto vs medido escrito no doc; itens que ficarem indecidiveis declarados com o motivo.
- **Estado**: pendente


<!-- lote-2: linhas 1351-4500 -->

### TK-01-39 | P1 | montarItem (Ornn) funciona mas NAO esta ligado ao auto-play — build lendaria nao sai do sitio
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3465: "receitasOrnn() -> filter the pode: true recipes serving the decided build -> write montarItem(id)... The reading half is done; execution is the next piece"; L4063-4071 montarItem executou ao vivo (10x, 16.500 ouro, log {type:ornn, acao:montar, ok:true}); L4107 "the complete chain is proven end-to-end... The next step is simply more attempts"
- **Fazer**: ligar a montagem ao auto-play: na visita a base (com pausarPor — TK-01-46) correr receitasOrnn() -> escolher receita pode:true que sirva a build (Tiamat primeiro, L3519-3520) -> montarItem(id, 100, arcana) contando tentativas/sucessos e ouro; respeitar teto de reserva e parar em falha.
- **Aceitacao**: ciclo completo ao vivo sem intervencao: escolha -> montar -> contagem no log ({vezesUsadas, ouroGasto, temAgora}) e >=1 item montado em sessao; regressao POPULATION rc=0.
- **Estado**: pendente

### TK-01-40 | P1 | full build lendaria equipada e verificada (entregavel 1b do goal — NAO cumprido)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3386: "your deliverable #1 explicitly requires full build equipada e verificada no jogo real. He is wearing five basic/epic items, not legendaries. That is the gap."; L2606: "Ornn epic crafting (18k-118k gold)... he now has 197.600, so he can start forging"
- **Fazer**: executar a escada lendaria ate os 5 slots da build ideal estarem equipados com itens lendarios (ou a melhor versao encontrada por dado), e verificar ao vivo via ll.mjs (equip + player).
- **Aceitacao**: leitura ao vivo dos 5 slots mostra itens da build final; player stats registadas; nenhum lendario vendido pelo caminho (proteccao componentesDaBuild activa, L4361-4379).
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
- **Estado**: pendente

### TK-01-43 | P2 | Ciclos de farm: cap 30, fecho so por mudanca de regiao, ciclos <30s — taxas truncadas/ruidosas
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L1486: "30/30 cycles carry incompleto:true / fim:viagem (cycles close on region change, not naturally -> rates may be truncated), 16 cycles are under 30s (noisy per-minute rates)"; L1565: cap 30
- **Fazer**: aumentar/gerir o cap (ou arquivar em ficheiro), fechar ciclo tambem por tempo/slot cheio e marcar explicitamente taxa truncada; filtrar do ranking ciclos <30s.
- **Aceitacao**: snapshot novo mostra taxa com marcador de truncada quando fim=viagem; ciclos <30s excluidos do ranking por predefinicao.
- **Estado**: pendente

### TK-01-44 | P2 | build otima e dependente da regiao — regiaoIdeal() tem de escolher o SET por regiao
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3330-3337: "Boots help in Rota Superior and hurt in Campo Azul... regiaoIdeal() already picks the region from measured data — it would now also need to pick the set per region"; L3393: "the region-dependent build finding implies regiaoIdeal() should choose the set per region, not just the region"
- **Fazer**: manter tabela regiao->melhor set medida (com n minimo) e equipar/trocar o set conforme a regiao escolhida; sem dado suficiente para a regiao, usar o set global e dizer.
- **Aceitacao**: teste: para rota-sup e azul os sets escolhidos diferem conforme o medido; troca de regiao provoca troca de set com log.
- **Estado**: pendente

### TK-01-45 | P2 | Ornn: receita escolhida por dado (custo esperado + componentes na mochila) e nao ao acaso
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L3486-3519: "receitasOrnn() works — 40 recipes read at zero cost... tentativasMedias: 83"; L3523: "Assembly can now be chosen by data: which recipes serve the build, which have components, and what each costs on average"
- **Fazer**: ranking de receitas por (serve a build) x (custo esperado = ouro/tentativa x tentativasMedias) x (tem componentes), com teto de ouro da reserva; escolher a mais barata que sirva a build.
- **Aceitacao**: teste: com 3 receitas serve-build e custos diferentes, a escolhida e a de menor custo esperado com componentes; log mostra o porque.
- **Estado**: pendente

### TK-01-46 | P2 | pausar() em memoria faz a automacao ficar parada em silencio (3a vez do mesmo padrao)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L4415-4449: "gold 77.100 -> 63.800 (falling) | nivel 13 -> 14 (rising) | pausado: true... pausar() is in-memory state: if the next step fails, times out, or stays pending... the pause sticks, and the auto-play stops silently"; L4449: "A pausarPor(ms) — pause with automatic expiry... The structural correction; not yet implemented" (implementado e verificado em L4482-4488 — confirmar deploy)
- **Fazer**: usar pausarPor(ms) em TODAS as operacoes de base (Ornn/mercado/forja) para a pausa nunca ficar presa; rever pontos que ainda chamam pausar() sem expiracao.
- **Aceitacao**: grep: nenhuma operacao de base usa pausar() sem pausarPor; teste ao vivo: operacao abortada a meio -> automacao retoma sozinha em <= ms.
- **Estado**: pendente

### TK-01-47 | P2 | teste de build pode parar por caminhos nao cobertos pelo auto-resume
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L2860-2866: persistencia em chrome.storage lolidleAutoPotion:testes:ativo + auto-resume verificados (L2846-2852); L2748-2749: "the build test has stopped again and he is sitting at Fonte. Let me restart it" (3a vez)
- **Fazer**: cobrir os caminhos que AINDA podem parar o teste sem registar (fim de variacoes, erro em passoTeste, ciclo fechado) e garantir rearme automatico em todos eles.
- **Aceitacao**: cenario de teste: parar o teste por cada caminho possivel -> rearme sozinho sem intervencao; log com retomado:true.
- **Estado**: pendente

### TK-01-48 | P3 | docs/build-yasuo.md descreve Ornn como loja (18k-118k) — e uma lotaria de 1,2%/tentativa
- **Ficheiro(s)**: docs/build-yasuo.md
- **Evidencia**: parte-01.md L2678-2680: "In §9.5q I described Ornn epic costs 18k-118k as if it were a shop price. It is not — it is a lottery with a per-attempt cost... 2250/0.012 ~ 187.500 gold per success"; L3509-3517 tabela de custo esperado (Tiamat 124.500)
- **Fazer**: corrigir a seccao de economia do doc: chance 1,2%/tentativa (2,4% com Runa Arcana), custo por tentativa, custo esperado = custo x 83 (numero publicado pelo jogo), lotes 1/10/100/1000, componentes consumidos so no sucesso.
- **Aceitacao**: seccao reescrita com os numeros medidos (L3509-3517) e citacao do tooltip do jogo; nenhuma mencao a preco de loja para o Ornn.
- **Estado**: pendente

### TK-01-49 | P2 | export do snapshot corrompido quando se corre com 2>&1 (stderr do ll.mjs entra no JSON)
- **Ficheiro(s)**: tools/snap-export.mjs; tools/ll.mjs
- **Evidencia**: parte-01.md L1490: "Exporting the snapshot with 2>&1 mixes ll.mjs stderr warning into the JSON, and the backtest then dies with Unexpected token. Use 2>$null. Recorded in the handoff"; L1661: "Always export the snapshot with 2>$null"
- **Fazer**: tornar o export imune (descartar stderr no proprio exportador ou le-lo de forma segura) e documentar; ou mudar o aviso do ll.mjs para nao corromper.
- **Aceitacao**: export com stdout+stderr misturados produz JSON valido (JSON.parse passa); backtest.mjs corre sem erro de parse.
- **Estado**: pendente

### TK-01-50 | P2 | Katarina (regra do dono): jornada separada do Yasuo, completa e funcional
- **Ficheiro(s)**: extension/automation.js; extension/gui.js
- **Evidencia**: parte-01.md L193: "tem a katarina: tambem faca tudo q queremos dela funcionar. mas ela nao deve estar na mesma jornada de auto play do yasuo. apenas o yasuo."; L733: ll.mjs agora aceita --conta katarina|yasuo
- **Fazer**: auditar dependencias cruzadas: champion fix, build test, autoEquip, mercado, Ornn e tick pump tem de ser por-conta sem estado partilhado; deixar a jornada da Katarina completa e separada (activacao por decisao do dono).
- **Aceitacao**: lista de verificacao por funcionalidade mostrando separacao por conta; Katarina funcional sem tocar na jornada do Yasuo.
- **Estado**: pendente

<!-- lote-2 fim -->



<!-- lote-3: linhas 4500-8100 -->

### TK-01-51 | P0 | venderBase/planBag vendem BASICOS que sao componentes de receita (zero Adagas -> nenhuma receita Ornn arranca)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7728-7735: "componentesDaBuild() = [3006, 1001, 1042, 3086, 1018, 3077, 1036, 3044, 1028, 3144, 1038, 1037]... a excepcao componentesDaBuild() so a pus para EPICOS, nao para basicos. Logo ele esta a vender os componentes que a build precisa"; L7828: "a minha regra de venda nao poupa os basicos que sao componente de receita (1042 Adaga...) — e por isso que ele tem zero Adagas"; gargalo confirmado em L6576/L6882/L6938
- **Fazer**: estender a excepcao de venda (componentesDaBuild) aos BASICOS tambem; nenhum item que seja componente de receita da build pode ser vendido. Atencao a nao recriar o ciclo de viagem: o planner tem de concordar com o actor (regra do comentario l.275-282).
- **Aceitacao**: teste no banco: basico 1042 (Adaga) com componentesDaBuild() a contê-lo -> planBag NAO marca VENDER_LOJISTA e venderBase protege; lixo nunca fica preso por isso; mochila do Yasuo passa a acumular Adagas ao vivo.
- **Estado**: pendente

### TK-01-52 | P0 | ciclo de viagem: verificar AO VIVO que morreu (ouro a subir, sem recalls) + rotina de base completa
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7544-7577 (subagent: P0 do ciclo RESOLVIDO — minimoPocoesAgora, reporPocoes reporta, backoff 45min, tecto de 3 recalls + farm forcado, n.vender so com mochila quase cheia); L8008-8020: "Vou verificar ao vivo - o ciclo tem de ter morto e o ouro tem de subir" (verificacao NAO feita no historico); L7135-7172 sintoma (viaja -> mata 1 mob -> volta, ouro congelado)
- **Fazer**: recarregar a extensao no browser do Yasuo e verificar por estado: log com {ir:base:vender, venda:{itens,valor}, custoIda:{ouro,seg}, falta:[]}, zero recalls em 10 min, ouro a subir; se o ciclo voltar, registar o motivo exacto.
- **Aceitacao**: janela de 10 min ao vivo sem recall (ou maximo 1 com fecho de necessidade) + delta de ouro positivo + log com falta:[] em cada ida a base.
- **Estado**: pendente

### TK-01-53 | P0 | KILL SWITCH na GUI + distinguir PAUSAR de DESLIGAR (portao em cada accao, nao so no loop)
- **Ficheiro(s)**: extension/gui.js; extension/automation.js; extension/content.js
- **Evidencia**: parte-01.md L8026-8029 (dono, 2x): "bota kill switch na gui do script. ou faz o pausar ou o desligar e ligar fazer o trabalho dele... e diferencia o pausar do desligar por que os dois nao fazem oq devia"; L8078-8090: "o enabled so trava o tickAutoplay, mas as accoes de equipar, atributos e skills correm fora desse portao - por isso desligar nao desliga nada"
- **Fazer**: KILL SWITCH que para tudo imediatamente (tick, equipar, atributos, skills, pocoes, base, viagens), persistido; PAUSAR para accoes mas mantem observacao/medicao; DESLIGAR limpa estado activo (pausas, throttles, farm forcado, testes). O portao tem de estar no ponto de execucao de CADA accao.
- **Aceitacao**: teste ao vivo: kill switch -> nada mexe em 60 s (zero eventos de accao no log); pausar -> medicao continua, accoes param; desligar/religar -> estado limpo. Persistencia provada com reload.
- **Estado**: pendente

### TK-01-54 | P0 | Katarina corre versao ANTIGA da extensao (nunca recarregada) -> desequipa itens bons
- **Ficheiro(s)**: extension/ (recarregar); relay 9224
- **Evidencia**: parte-01.md L8050-8065: "a Katarina esta a correr uma versao ANTIGA da extensao... valorDe sem termo de raridade, planBag antigo, sem a excepcao dos componentes. E exactamente isso que faz um basico ganhar de um epico e desequipar coisas boas"; L8023 (dono): "por que a katarina ta desequipando itens e botando itens NOJENTOS DE RUINS?"
- **Fazer**: recarregar a extensao na aba da Katarina (relay 9224, conta Scriptingkata) com a revisao actual e verificar por marcador discriminante; so depois avaliar se o comportamento de itens muda. Manter enabled=false na jornada dela.
- **Aceitacao**: marcador discriminante do codigo novo visivel na pagina dela; itens dela deixam de ser trocados por basicos (ou teste isola a causa como sendo o VIP do jogo - ver TK-01-65).
- **Estado**: pendente

### TK-01-55 | P1 | GUI reescrita (2228 linhas) nunca foi vista a correr no jogo real
- **Ficheiro(s)**: extension/gui.js; extension/popup.html; extension/popup.css; extension/popup.js
- **Evidencia**: parte-01.md L7590-7657 (entrega: node --check rc=0, 75/75 funcoes existem, ensaio em vm 0 excepcoes) — mas zero verificacao ao vivo no browser; L7440: "subagent da GUI (ja entregou o gui.js sem erro de sintaxe)"
- **Fazer**: abrir a GUI no jogo do Yasuo (F8 / botao / hover) e verificar: 8 abas renderizam sem undefined/NaN, botao de panico funciona, checklist da base mostra dados reais, mercado/Ornn mostra custo esperado; degradar com motor ausento nao rebenta.
- **Aceitacao**: screenshot/log de cada aba com dados reais; nenhuma excepcao na consola; botoes destrutivos pedem confirmacao.
- **Estado**: pendente

### TK-01-56 | P1 | PRECISA-DO-MOTOR: 5 funcoes que a GUI precisa e o motor ainda nao expoe
- **Ficheiro(s)**: extension/automation.js; extension/gui.js
- **Evidencia**: parte-01.md L7630-7635: "PRECISA-DO-MOTOR: 1 pausa comandada por storage (o POPUP nao tem acesso a window.__lolidleAuto)... 2 nivel no PLAN_KEY... 3 atributosAtuais()... 4 progressoBase()... 5 limparResultadosTeste()"
- **Fazer**: implementar/expor as 5 funcoes em window.__lolidleAuto (ou justificar cada uma) e liga-las na GUI; a de pausa por storage e a que faz o kill switch do popup funcionar.
- **Aceitacao**: cada uma existe por grep em automation.js e a GUI deixa de a usar com fallback; teste no banco cobre as novas funcoes.
- **Estado**: pendente

### TK-01-57 | P1 | player().vida le o MAXIMO do HUD (hp[2]), nao o actual -> n.cura nunca verdadeiro
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7990-7991: "I5 n.cura NUNCA e verdadeiro: player().vida le o MAXIMO do HUD (hp[2]), nao o actual. Nao e do meu scope (leitura de estado), mas fica registado. Teste: HUD com vida parcial."
- **Fazer**: ler hp actual e maximo do HUD; todas as decisoes de cura/recall passam a usar o actual; manter fallback honesto (null) quando o HUD nao estiver pronto.
- **Aceitacao**: teste: HUD com vida parcial -> n.cura true e recall dispara; HUD cheio -> false; sem HUD -> null (nunca inventado).
- **Estado**: pendente

### TK-01-58 | P1 | barraIdeal/aplicarBarra: provar AO VIVO que a ultimate fica e nao oscila
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7888-7898 (subagent: barraIgal deterministica, aplicarBarra converge <=3 passagens, CANCELA trocando, TIRA antes dePOE, MEDIDO arsenal -> barraIdeal()=["R","Q","E","W"]); L7700-7707: verificado 90 s a mao (R manteve-se) — falta verificacao com o codigo novo
- **Fazer**: recarregar e verificar ao vivo por estado (DOM da #barra): 4/4 cheia, R dentro, e ESTAVEL durante 5+ minutos; se oscilar, registar o ciclo.
- **Aceitacao**: barraDOM com R e sem vaga em 3 leituras separadas por >=2 min; zero cliques repetidos no log.
- **Estado**: pendente

### TK-01-59 | P1 | dpsPorHabilidade/dpsRank: provar AO VIVO que a ordem de skills desbloqueia G/A antes de subir W
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7943-7961 (subagent: escala magia?ap:ad correcta, valorDoPonto com MULT_DESBLOQUEIO=1.5, ordem do Yasuo: desbloquear G->R->A depois subir Q->E->R->W; MEDIDO barraIdeal); L6870-6871 (plano: G0->1 +44,0 dps, W2->7 = 0 dps)
- **Fazer**: correr subirHabilidades ao vivo com pontos disponiveis e verificar que gasta em desbloqueio (G/A) primeiro; conferir a soma de ranks lida do DOM apos (anti-loop).
- **Aceitacao**: pontos de skill a 0 e ranks novos presentes (G>=1 quando o nivel permitir); nenhum ponto em W antes de G/A.
- **Estado**: pendente

### TK-01-60 | P1 | atributos: autoAtrib ligado + modeloAtrib dano — provar distribuicao automatica sem intervencao
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7964-7971 (subagent: modeloAtribDe derivado de motor.js:474-487, YASUO -> dano = {forca:3, agilidade:2, vitalidade:1}); L7467-7476 (config aplicada ao vivo: modeloAtrib null -> dano; autoEquip/autoAtrib true); L5838-5840 (15 pontos foram distribuidos a MAO)
- **Fazer**: deixar pontos de atributo livres e verificar que distribuicaoAutomatica os gasta sozinha pela ordem Forca->Agilidade->Vitalidade, com anti-loop por soma lida do DOM.
- **Aceitacao**: pontos livres passam a 0 sem intervencao; distribuicao observada confere com o modelo dano.
- **Estado**: pendente

### TK-01-61 | P1 | alvoEquip/cmpEquip/ITENS_ESPECIAIS: provar AO VIVO que o script equipa Tiamat/botas sem ser a mao
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7918-7941 (subagent: alvoEquip unica fonte da verdade, cmpEquip com restricao dura basico<epico, valorDe com termo de raridade x1,30, histerese ignorada em troca de raridade, accao EQUIPAR no planBag antes das vendas); L7481: hoje "equiparMelhores() -> trocas: []" porque o equipamento JA e o alvo (foi posto a mao)
- **Fazer**: teste ao vivo controlado: com um basico no slot e um epico melhor na mochila, o script equipa o epico sozinho (sem montarItem/manual) e registra no log a troca + ganho; incluir o caso Rabadon em campeao AD (nao pode entrar no alvo).
- **Aceitacao**: log mostra {acao:equipar, entram:[...], trocaRaridade:true} e o DOM dos equipados confere; caso basico-equipado+epico-mochila resolvido sem intervencao.
- **Estado**: pendente

### TK-01-62 | P2 | inject.js serialKit nao reencaminha penSuspiro/duracaoPen/va/bonus do kit (valorBuff com fallback de texto)
- **Ficheiro(s)**: extension/inject.js; extension/automation.js
- **Evidencia**: parte-01.md L7985-7987: "I2 penSuspiro/duracaoPen/va/bonus do kit: o serialKit do inject.js:107-123 NAO os reencaminha (inject.js esta FORA do meu scope). Uso o TEXTO da habilidade como fallback. Teste: acrescentar esses campos a lista do serialKit e comparar valorBuff campo-a-campo"
- **Fazer**: acrescentar os campos a lista do serialKit e passar ausa los em valorBuff em vez do texto; comparar campo-a-campo.
- **Aceitacao**: valorBuff com os campos do kit === valorBuff derivado do texto para pelo menos Q/E/R do Yasuo.
- **Estado**: pendente

### TK-01-63 | P2 | equipHisterese: ao vivo 0,005 vs ficheiro 1,05 — defaults divergentes
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7992-7993: "I6 equipHisterese: tu baixaste para 0,005 AO VIVO pela API; o ficheiro mantem 1,05. Com o equipamento ja no alvo o alvoEquip().mexe e false de qualquer forma"; L7472
- **Fazer**: alinhar o default do ficheiro ao comportamento desejado (a histerese ja e ignorada em troca de raridade pelo cmpEquip — decidir o valor certo e um so) e documentar.
- **Aceitacao**: um unico valor de histerese no codigo, com teste para o caso de troca de raridade e o caso de ganho marginal.
- **Estado**: pendente

### TK-01-64 | P2 | GUI: select de objectivo nao oferece ouro+xp (default do motor)
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-01.md L8001-8002: "o select de objectivo da GUI (gui.js:512) ainda so oferece xp/ouro/runas; o default ouro+xp funciona na mesma (objDe aceita-o) e a GUI nao o sobrescreve ate o utilizador mexer"
- **Fazer**: acrescentar ouro+xp ao select (ou esconder objectivo enquanto o default e o combinado)sem deixar a GUI sobrescrever o default.
- **Aceitacao**: select mostra o valor corriente real; mudar e voltar atras nao altera o comportamento.
- **Estado**: pendente

### TK-01-65 | P2 | Katarina: extensao vs automatico VIP do jogo — testar qual mexe nos itens
- **Ficheiro(s)**: extension/ (apos recarregar, TK-01-54)
- **Evidencia**: parte-01.md L8067-8096: "O jogo tem a automacao VIP LIGADA nela... Sao duas camadas a competir na mesma conta: a extensao velha e o automatico do jogo... O teste honesto e desligar o automatico VIP do jogo e ver se os itens continuam a mudar: se continuarem, e a extensao; se pararem, era o jogo."
- **Fazer**: correr o teste: desligar o VIP do jogo na conta da Katarina e observar se os itens continuam a mudar; registar a conclusao com evidencia.
- **Aceitacao**: conclusao registada com observacao (itens param de mudar -> era o jogo; continuam -> era a extensao) e accao correspondente.
- **Estado**: pendente

### TK-01-66 | P2 | objectivo ouro+xp: taxa de troca 2,2 derivada da CURVA — faltam A/B de 30 min
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L7973-7979 (subagent: score = xp/min + ouro/min x taxa, taxa derivada de CURVA.xp/ouro motor.js:277-278, nv15 = 2,2); L7984: "I1 Peso ouro-vs-xp no objectivo combinado -> teste: 30 min em 2 regioes com ouro+xp vs ouro"
- **Fazer**: correr o teste A/B na lane serializada e confirmar (ou corrigir) a taxa; registar no doc.
- **Aceitacao**: 2 janelas de 30 min medidas com os dois objectivos; taxa mantida ou corrigida com o dado.
- **Estado**: pendente

### TK-01-67 | P1 | pocoes: precos (40/110/260) e lotes (3000/1500/700) hardcoded — ler do jogo (Regra Nº 3)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L4751-4752: "reporPocoes buys the full lot of 3000 vida potions (120.000 gold)... unit prices are 40 / 110 / 260"; L2075-2077 (reserva derivada de cfg.buyPotion/cfg.minPotion x PRECO_POCAO); motor.js:261-267 tem POCOES com nivel
- **Fazer**: ler precos/niveis das pocoes da LOJA/META ao vivo (com fallback memoizado) em vez de PRECO_POCAO fixo; assim um rebalanceamento do jogo entra sozinho.
- **Aceitacao**: grep: nenhum preco de poco hardcoded em automation.js ( fora de fallback documentado); teste: preco lido altera a reserva e o teto de compra.
- **Estado**: pendente

<!-- lote-3 fim -->



<!-- lote-4: linhas 8100-9081 -->

### TK-01-68 | P0 | n.equip/n.comprar presos em true para sempre (4.a necessidade que nunca fecha)
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L8433-8460: "n.equip e o n.comprar comparam contra o buildIdeal() — a build de fim de jogo [3172,3046,6631,3085,3031]... Ele nao tem NENHUM dos cinco, e nao pode compra-los (sao lendarios de milhoes). Logo comprar = true para sempre / equip = true para sempre... E a terceira vez nesta sessao que aparece a mesma classe de bug"; confirmado pendente em L8990 e L9008
- **Fazer**: n.equip so true se houver na MOCHILA ou no COFRE item melhor que o equipado no slot; n.comprar so true se o item estiver ao alcance do ouro actual E o custo da viagem se pagar. Ambos passam pelo backoff como as outras necessidades.
- **Aceitacao**: teste: sem item melhor disponivel e sem ouro para a build ideal -> n.equip=false e n.comprar=false; com item melhor na mochila -> true; faltandoNaBase() fica [].
- **Estado**: pendente

### TK-01-69 | P0 | Katarina: extensao NAO esta carregada na pagina dela (nao ha versao nenhuma)
- **Ficheiro(s)**: extension/; relay omp 9224
- **Evidencia**: parte-01.md L8489-8497: "auto: undefined / gui: undefined / lsExt: [] ... A extensao NAO esta carregada na pagina da Katarina. Nao e uma versao velha — nao ha versao nenhuma"; L8503: "As chaves lolidle-* que eu vi antes sao do proprio jogo... Confundi-as com as da extensao e disse-te que ela estava carregada numa versao antiga. Estava errado."; L9080: o relay consegue criar abas no Chrome do dono — caminho para a Katarina
- **Fazer**: carregar a extensao na aba da Katarina pelo caminho que o dono autorizou (relay omp do manager / ext-reload-cdp.mjs --context-origin; NAO abrir Chrome novo) e verificar com marcador discriminante que window.__lolidleAuto existe no mundo isolado dela.
- **Aceitacao**: ext-reload-cdp.mjs --list-contexts mostra o mundo chrome-extension://<id> na aba da Katarina; marcador discriminante visivel; enabled=false mantido (auto-play so no Yasuo).
- **Estado**: pendente

### TK-01-70 | P0 | Katarina: VIP do jogo re-afirma-se (auto-vida volta a ON sozinho) — desligar persistente
- **Ficheiro(s)**: extension/automation.js (re-afirmar a cada tick); investigacao de storage
- **Evidencia**: parte-01.md L8261: "O VIP voltou a ligar-se sozinho (auto-vida: ON depois de eu desligar) — o jogo re-afirma o estado dele"; L8304: "desliguei #auto-vida, #auto-mana e #rot-pocoes e 4 segundos depois estavam ON outra vez"; L8920 (pendente): "Game VIP must be disabled persistently on Katarina"; dono L8210: "entao desativa o vip"
- **Fazer**: ou encontrar a chave persistente do VIP (nao esta em localStorage) e fixa-la, ou a extensao desligar o VIP a cada tick (re-afirmacao, o padrao que ja funciona para outras invariantes). Nao pode ser clique unico.
- **Aceitacao**: VIP off mantido por >=10 min ao vivo com verificacao por estado; itens/pocoes da Katarina param de ser revertidos.
- **Estado**: pendente

### TK-01-71 | P1 | feature build MOB vs build CHEFE (equipado+mochila+mercado+cofre, alternancia auto, ligada por defeito, bloco no topo da GUI)
- **Ficheiro(s)**: extension/automation.js; extension/gui.js
- **Evidencia**: parte-01.md L8213 (dono): "tem q saber melhor build pra enfrentar mob e melhor build pra enfrentar chefe, que tem atual, tanto na mochila, quando no que ta anunciado do mercado, quanto que ta no cofre. e vai alternar entre o melhor pra mob e o melhor pra chefe SOZINHO. e isso e desativavel. mas ativado por padrao. e bota tudo no gui que e ativado por padrao la no comeco da pagina do gui"; L8340: subagent 721c3a0e lancado; L8568: ainda a correr (gui.js mexido as 13:56); L8342 regra critica: o que sai da build de chefe fica reservado e NUNCA e vendido
- **Fazer**: derivar as duas builds do motor (pesos por fase), considerar equipado+mochila+anuncios do mercado+cofre, alternar sozinho por fase, desligavel mas ligado por defeito, bloco no TOPO da GUI ligado por defeito; o que sai da build de chefe nunca e vendido.
- **Aceitacao**: ao vivo: em fase mob equipa a build mob, em fase chefe troca sozinho e volta; nada vendido no caminho; bloco no topo da GUI visivel e desligavel; banco verde.
- **Estado**: pendente

### TK-01-72 | P1 | GUI: bloco de escolha de build de chefe preso em TODAS as abas
- **Ficheiro(s)**: extension/gui.js
- **Evidencia**: parte-01.md L8544 (dono): "quero que a gui desbugue pq mostra o negocio de escolher build de chefe fixado em todas as abas e nao some de nenhuma"
- **Fazer**: encontrar porque o bloco da build de chefe renderiza em todas as abas (partilhado entre tabs em vez de ser do dono da aba) e confina-lo; testar cada aba.
- **Aceitacao**: bloco so aparece onde deve (topo da aba propria) e nas outras abas nao; verificacao aba a aba ao vivo.
- **Estado**: pendente

### TK-01-73 | P1 | Katarina: saber se ela foge do Barao sozinha
- **Ficheiro(s)**: extension/automation.js
- **Evidencia**: parte-01.md L8544 (dono): "e quero saber se ela foge do baron sozinha"; ligado a F-1/F-2/F-3 da auditoria de friccao (L364-367: checarChefeFatal nao foge, guarda de regiao letal e codigo morto)
- **Fazer**: medir ao vivo (ou por teste com os dados do kit dela) se checarChefeFatal/regiaoIdeal a impedem de entrar em regiao com chefe que a mata; se nao fugir, corrigir (depende de TK-01-01/02/03).
- **Aceitacao**: teste/cenario mostrando fuga (ou entrada recusada) quando o chefe e fatal; log do evento.
- **Estado**: pendente

### TK-01-74 | P1 | Katarina: escolher o local de farm (regiao) — funcional e visivel na GUI
- **Ficheiro(s)**: extension/automation.js; extension/gui.js
- **Evidencia**: parte-01.md L8544 (dono): "quero a build solved, quero escolher o local de farm"
- **Fazer**: garantir que a escolha de regiao de farm funciona para a conta da Katarina (regiaoIdeal com dados medidos ou fixacao pela GUI) e aparece na GUI dela.
- **Aceitacao**: ao vivo na aba dela: regiao escolhida/medida visivel e viajar para ela funciona; enabled=false nao bloqueia a escolha manual.
- **Estado**: pendente

### TK-01-75 | P1 | infra: browser do Yasuo (guest 9233) morreu no restart do PC — religar tudo e verificar
- **Ficheiro(s)**: tools/autoplay-up.mjs; tools/tick.mjs
- **Evidencia**: parte-01.md L9069: "Only one Chrome root exists (PID 660, default profile) — the Yasuo guest browser is dead, and no lolidle tab exists anywhere"; L9077: "Yasuo guest browser is dead. Let me relaunch it"
- **Fazer**: bun tools/autoplay-up.mjs (chrome+extensao+tick) e verificar com marcador discriminante que a extensao injectou e o auto-play corre; registar estado (ouro/nivel/local) no HANDOFF.
- **Aceitacao**: vis:visible, rafTicks>0, __lolidleAuto presente no mundo isolado, farm a acumular (ouro a subir), tick vivo.
- **Estado**: pendente

### TK-01-76 | P1 | infra: relay omp 9224 em cima mas sem aba do lolidle alcancavel; Chrome do dono 9222 bloqueado (Chrome 155)
- **Ficheiro(s)**: tools/ll.mjs; tools/ext-reload-cdp.mjs
- **Evidencia**: parte-01.md L9057-9069: "Relay is up but only shows 2 tabs (Twitch + DSH GUI)... no lolidle tab"; L9066: "9222 refuses (000) — Chrome 155 still blocks the default profile"; L8871: Chrome 136+ recusa --remote-debugging-port no perfil default; L9080: o relay consegue criar abas no Chrome do dono
- **Fazer**: usar o relay omp (criar/abrir aba lolidle no Chrome do dono) como caminho unico para a Katarina; documentar a receita no repo com o comando exacto; nao depender de 9222.
- **Aceitacao**: aba do lolidle alcancavel pelo relay com a extensao carregada (--list-contexts); receita escrita no repo.
- **Estado**: pendente

### TK-01-77 | P2 | kill switch implementado — falta teste ao vivo ponta-a-ponta
- **Ficheiro(s)**: extension/automation.js; extension/gui.js
- **Evidencia**: parte-01.md L8336: "GUI + kill switch: pausar (congela accoes, continua a medir) != desligar (para tudo e limpa estado) != kill persistido"; L8917 (pendente): "Kill switch implemented but not yet live-tested end-to-end"
- **Fazer**: testar ao vivo: kill -> nada mexe em 60 s (zero accoes no log) incluindo equipar/atributos/skills/pocoes/base/viagens; pausar -> medicao continua; desligar/religar -> estado limpo; persistencia com reload.
- **Aceitacao**: 3 cenarios medidos ao vivo com log; persistencia provada.
- **Estado**: pendente

## DECISOES DO DONO

- **D-01 — lendario abaixo de A: mercado ou Lojista?** O codigo hoje ANUNCIA lendarios <A no mercado (automation.js:283/311, herdado do desenho original) e o dono nunca autorizou mercado — a regra dele e basico/epico/duplicado -> Lojista, e lendario nao esta na lista. Perguntado 2x no historico (L5986, L6161) sem resposta.
- **D-02 — a frase nao mexe no A/S/SS inclui REFINAR?** O agente interpretou que a frase esta presa ao duplicado e que refinar e instrucao anterior (L40-42). Consequencia: lendario A+ pode rebaixar no Ornn a partir do +3. Confirmar.
- **D-03 — Katarina: como carregar a extensao.** O dono proibiu abrir Chrome novo (L8610-8613: usa as ferramentas q tu tem pra controlar meu browser). O caminho e o relay omp (9224), que ja criou abas no Chrome dele. Confirmar que pode carregar/recarregar por ai sem lhe estragar abas.
- **D-04 — Katarina: VIP do jogo.** O dono mandou desativar (L8210) mas o jogo re-afirma o estado. Escolher a via: cacar a chave persistente, ou re-afirmar a cada tick pela extensao.
- **D-05 — autoEquip: a regra14 antiga (off) vs a regra nova do goal (Equipar SEMPRE o melhor item disponivel em cada slot, inviolavel).** O motor passou o default a true. Confirmar que a nova manda (e que o auto-play pode trocar itens sozinho).
- **D-06 — Runeterra: continua deliberadamente manual?** Decisao anterior do dono (L5670): a extensao salta-o. Confirmar se mantem.
