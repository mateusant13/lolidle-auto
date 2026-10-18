TK: W11 (w11-boss) — 6 tickets: TK-02-81 (P0), TK-02-83, TK-02-74, TK-02-75, TK-02-55, TK-02-52

FICHEIROS (write scope da fila respeitado; auditado hunk a hunk):
  extension/automation.js ......... +286/-24 (blocos: tolerancia de nivel motor.js:1196-1202;
     nivelDoChefe motor.js:1134; sobrevivenciaSet/rankItensSobrevivencia TK-02-75/74;
     montarBuildDe alvoRef TK-02-81; estimarLuta; exports). NAO toquei em scoreSet,
     planejar, venda nem config.
  tools/testes/chefe.test.mjs ..... NOVA (307 linhas, 71 assercoes)
  tools/testes/motor-fonte.mjs .... NOVO (le o motor como texto: NIVEL_DIF/MONSTROS/LOCAIS/
     CURVA/TETO_VIDA_ITEM/RM_MONSTRO — Regra N.o 3, nada copiado a mao)
  tools/testes/dom-stub.mjs ....... catalogo do banco +8 itens REAIS (3153, 3036, 3031, 6653,
     3171, 3100, 3135, 3168) — sem a 3153 no catalogo controlado o P0 nao teria onde se provar
  tools/testes/regras.test.mjs .... 2 assercoes de fixture actualizadas (ver MUDEI O TESTE)
  tools/testes/run.mjs ............ suite 'chefe' registada
  docs/tickets/extra-W11-*.md ..... 3 tickets novos (ver RISCOS)

TESTES: bun tools/testes/run.mjs
  rc=0 | POPULATION 331 (era 260; +71 assercoes novas) | falhas=0 em 10 suites
  | UNSTUBBED=0 (nenhum selector fora do vocabulario do stub)
  O que provei, com numeros medidos na minha maquina (banco, sem browser/CDP):
   * TK-02-81: buildIdealPara E buildIdealParaFase('chefe') levam a 3153 no Yasuo E na
     Katarina; a de 'mobs' NAO leva. Yasuo chefe = 2007,3153,3031,3036,2001;
     Katarina chefe = 3005,3153,3135,3089,6653.
   * TK-02-83: jogador nv29 -> chefe nv42 (motor.js:1134, preso em n0+2), dif=9,
     fM=4.15, fJ=0.25 (PISO), dpsTomado=1287, morre=true. CONTROLE: mob +3 -> fM=1
     (nao penaliza); mob +5 -> fM=1.35, fJ=0.88 (penaliza). nv38 -> dif=0 (tolerancia
     esgotada, que e o que explica o limite do nv29).
   * TK-02-74: 6653 Liandry vs 3171 Impeto no 5. espaco (base 3005,3089,3100,3135),
     Yasuo/Katarina medidos contra o Barao nv42:
       6653: dps=326  cdr=0%   vida=4476  tMorrer=1.5  tKill=1200  nPoc=1200  ouroPoc=132.000
       3171: dps=49   cdr=15%  vida=4826  tMorrer=1.7  tKill=7986  nPoc=7986  ouroPoc=878.350
     VENCEDOR: Liandry (tKill 6,7x menor; 132 mil de ouro em pocoes contra 878 mil).
     O Impeto da 350 de vida (+7,8%) e 15% de CDR (tecto 40% respeitado dos dois lados),
     mas contra vida alta a queima da Liandry bate no tecto de 3x a curva (motor.js:1191).
     NAO ha peso inventado: os dois numeros saem do motor. Se o alvo mudar, o vencedor
     pode mudar — e quem decide e o criterio, nao eu.
   * TK-02-75: rankItensSobrevivencia() ordena por (1) SOBREVIVE? (2) tKill (3) nPocoes
     (4) DPS — o mesmo criterio do filtro de morte (morre || mortal || morre antes de
     matar, com a margem de 50% do estimarRegiao). Provado no banco (F8): havendo um item
     que sobrevive, ele fica A FRENTE dos que matam, mesmo com menos DPS; e a ordem difere
     da do ranking de DPS puro (F9).
   * TK-02-52: cena de 4 skills (Q,R prontas; A a 3s, F a 7s) -> barra exacta
     ["R","Q","W","A"]: ultimate sempre em 1.o, prontas antes das em recarga, a skill
     disponivel FORA da barra (W) entra no lugar da mais atrasada. Anti-oscilacao
     verificada (repetir nao reordena; empate mantem quem ja esta na barra).
   * TK-02-55: 71 assercoes novas no banco para as correccoes da fila W11 (ver acima).
     POPULATION 331 > 260, como pedia a aceitacao.

MUDEI O TESTE: 2 assercoes de fixture em tools/testes/regras.test.mjs, porque o catalogo do
  banco passou a ter os itens REAIS e a composicao das builds mudou (Regra N.o 6):
   * T6: 'fixture: 2006 esta na build antes' -> 'fixture: 3031 esta na build antes'.
     Motivo: no perfil 'dano' o 3031 (Gume do Infinito, +40% no critico, motor.js:515)
     passou a ganhar o 4. espaco ao 2006. O que a assercao prova (o lendario da build fica
     blindado) esta intacto; so o item exemplo mudou.
   * T7: '2001 continua blindado' -> '3168 continua blindado'. Motivo: no perfil TANQUE a
     build passou a ser 3005,3031,3168,4002,3171 (o 3168 de 500 de vida e o 3171 de 350
     entraram no lugar do 2001).
  Nenhum teste passou a aceitar o comportamento ANTIGO: os dois continuam a exigir o
  blindamento da build; nenhuma assercao foi enfraquecida.

COMMIT: b7a3d6e (branch w11-boss, worktree I:/wt/w11-boss). NAO fiz merge.
  Historico: b7a3d6e <- 38b079b <- d02f71b <- 5f8c8a3 (salvage do Lead) <- f3dacf5.
  Arvore limpa (git status vazio).

RISCO (o que pode ter partido e nao testei):
  1. O catalogo do banco mudou -> as builds de fixture mudaram. Corri TODAS as suites
     (rc=0), mas ha 2 suites que fixam comportamento de equipamento por numero (equip,
     objetivo) e podem precisar de revisao se o Lead quiser os numeros antigos.
  2. 'montarBuildDe' com fase null passou a pontuar contra o chefe (TK-02-81). Quem chama
     buildIdeal() sem fase - GUI, planoEquipar, refinarMelhores, montarMelhorReceita,
     snapshotJogo - ve builds ligeiramente diferentes. NAO ganha vermelho no banco, mas
     muda o que e recomendado ao dono no campo.
  3. 'estimarLuta' agora usa o nivel do chefe pela formula do motor (motor.js:1134) e leva
     o fatorDanoJogador. Regioes em que o jogador esta muito abaixo do chefe passam a dar
     'ganha: false' com mais frequencia - que e o que se quer (o dono nao pode morrer), mas
     significa mais fugas. Precisa de prova ao vivo (lane do Lead).
  4. 'alvoDeReferencia' agora chama player(); num mundo sem HUD devolve o topo da faixa
     (comportamento antigo). Sem regressao.
  5. NAO toquei no browser nem no CDP 9224/9233 (lane do Lead). Nada foi provado ao vivo.

REGRA DO DONO: nada. Nenhuma politica nova foi implementada nem pedida. (A correccao de
  22:40 das decisoes D-01/D-09 - Lojista so recebe basico/epico, lendario nunca - NAO me
  afecta: os meus 6 tickets nao tocam em venda nem mercado, e o meu diff nao la vai.)

TRABALHO FORA DO ESCOPO QUE NAO PUDI ARRUMAR (tickets novos, nao edicoes):
  * extra-W11-calc-jogo.md (P1): tools/calc-jogo.mjs ESTA QUEBRADO - dois 'const exprPen'
    no mesmo escopo (linhas 488 e 489), qualquer invocacao morre com SyntaxError. E a
    ferramenta que o Lead recomenda no fila-W11.md. Arranjo: apagar a linha 488.
  * extra-W11-motor-1134.md (P1): a regra dos "4 niveis acima" do chefe EXISTE no motor
    vivo (motor.js:1129-1134) e a formula citada no comentario do checarChefeFatal
    (automation.js:1884-1887, sem o '+4') esta errada; o comentario regista uma duvida que
    ja esta resolvida no fonte. Fecha o TK-02-36 do W8 e o TK-01-06 do W1.
  * extra-W11-parseNum.md (P0): confirmado o achado do Lead - parseNum
    (automation.js:201) apaga o sufixo k/M do fmt() do jogo e corrompe ouro, pocoes, loot
    e XP EM SILENCIO acima de 10.000 ("12.3k" -> 123). NAO meu escopo (lane de
    venda/economia); os 7 casos de prova exigidos estao no ticket.
