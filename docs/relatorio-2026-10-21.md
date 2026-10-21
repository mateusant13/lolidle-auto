# Relatório da sessão de 2026-10-21

Tudo abaixo foi medido ao vivo no perfil de laboratório (Chrome 9222, perfil `C:\ChromeDebugProfile`,
extensão `pbdlekcgmpippamdkgbaphcppjafobjo`, marcador `BUILD 2026-10-21f`). Nada foi medido no Chrome
do dono.

## 1. A build "retardada": o que estava errado

Números do próprio jogo (`previaSet`, fórmulas do `motor.js`), no Fosso do Dragão, nível 33:

| conjunto | dano/s mobs | score mobs | dano/s chefe | score chefe | AP | CDR | penetração |
|---|---|---|---|---|---|---|---|
| o que ele veste (Rabadon +2, Lich, Ímpeto +3, Cajado do Vazio +4, Sapatos +4) | 838 | **986** | 798 | **939** | 935 | 0,15 | **0,55** |
| o "ideal" que a GUI mostrava (sem fase: Liandry, Cajado do Vazio, Lucidez) | 904 | 907 | 963 | 853 | 908 | 0,15 | 0,40 |
| a build da fase mobs (Ímpeto, Eco de Luden, Lucidez) | **936** | **1016** | 800 | 937 | 928 | 0,30 | 0,00 |

O que estava errado, por ordem de gravidade:

1. **A mesma aba mostrava duas builds diferentes.** "Sua build explicada" vinha de `planoBuildFase`
   (Ímpeto + Eco de Luden) e o "ideal" vinha de `buildIdeal()` **sem fase**, que é uma referência de
   chefe (Liandry + Cajado do Vazio). Discordavam em 2 dos 5 itens.
2. **O "ideal" era pior do que o que ele já vestia**: 907 contra 986 nos mobs e 853 contra 939 no
   chefe. Estava rotulado de ideal na mesma.
3. **As duas sugeriam Perdição de Lich (3100)**, que ele mandou não comprar.
4. **A build da fase ganha só nos mobs** (+3% score, +12% dano/s) mas **perde toda a penetração**
   (0,55 para 0,00) e empata no chefe (937 contra 939). Trocar Sapatos +4 e Cajado do Vazio +4 por
   Lucidez e Eco de Luden é um empate técnico que custa cerca de 100k.

O que foi feito:

- A GUI passou a usar `buildIdealAgora()` = a build da **fase atual**, a mesma que a automação veste.
  Prova ao vivo: `buildIdealAgora() == planoBuildFase('mobs')` = Rabadon, Lich, Ímpeto, Eco de Luden,
  Lucidez. Logo há **uma** sugestão.
- `cfg.naoComprar = ['3100']` (Perdição de Lich): a build pode usá-la se já a tiver, mas **nenhum**
  caminho de compra a compra (busca no mercado, `melhorCompra`, `comprarNoMercado`, necessidade de ir
  à base).
- Não se força a troca da build equipada. O que o jogo mede manda; se o Eco de Luden cair, a build da
  fase passa a ser montável. Se ele quiser manter o que tem, não há perda de score no chefe.

## 2. Cartas e baús (mecânica lida no jogo vivo, não nos docs)

Fonte: `jogo.js` (live) 7389-8010 e `motor.js` (live) 143-215.

- **Carta misteriosa** cai dos monstros (`estado.cartasNovas`). Abre **em qualquer sítio**, 50 por
  clique (o botão da bolsa). O servidor sorteia o tipo e a raridade na hora de abrir.
- **1 carta por item.** Encaixar no Ornn é **grátis**. Tirar custa 10.000 / 100.000 / 1.000.000. O
  Lojista paga 1.500 / 30.000 / 300.000.
- **O bónus é percentagem do atributo TOTAL** (`motor.js:622 somaCartas`): básica +2%, rara +5%,
  lendária +10% (crítico e roubo de vida em pontos). **O tipo importa, o item escolhido não.**
- **Baús**: o jogo abre sozinho quando o personagem passa a menos de 1,6 tiles (`verBaus`/`abrirBau`).
  Não há nada para a extensão clicar; o farm na região já passa por cima deles.

Automação nova:

- `cartasAbrir` (switch, ligado por omissão): abre as misteriosas, fecha a janela do Ornn 220 ms
  depois (o clique abre-a) e dispensa o pacote.
- `cartasEncaixar` (switch, ligado por omissão): na Fonte, abre a bancada do Ornn e encaixa a melhor
  carta em cada item sem carta.
- `melhorCartaDisponivel` = raridade × peso do tipo. O peso vem dos stats lidos: poder/ataque pelo
  atributo dominante, recarga se CDR < 40%, vida/armadura/rm fixos, crítico/roubo escalados pelo AD.
- `readEquip` passou a ler a carta: a chave do jogo é `<base>+<refino>#<carta>~<qual>`, e antes um
  item com carta dava `refino: NaN` e perdia a carta. Prova ao vivo: `3089#ataque1+2` lê base 3089,
  carta ataque1, refino 2.

Provas ao vivo:

- 42 misteriosas abriram e ficaram 0, com 10 tipos lidos do DOM do jogo (nomes desenhados pelo jogo,
  nada copiado).
- A melhor carta para a Katarina veio **Carta de Poder de Habilidade Básica**, coerente com AP 1.173
  contra AD 179.
- `encaixarCartas` fora da Fonte recusa com "so na Fonte" (provado). O encaixe em si ainda **não** foi
  provado ao vivo porque o boneco estava a farmar no dragão.

## 3. Rota de farm (itens e cartas)

- `planejarRota(alvos)` monta os passos: itens vêm de `planejar()` (tabelas de drop do jogo, drops/h)
  e a paragem de cartas é a região com **mais abates/min medidos** onde o chefe não é fatal.
- `iniciarRota` grava `cfg.rotaFarm` (alvos, passos, índice, desde) e viaja para o 1.º passo.
- `rotaPasso()` corre no tick: avança quando todos os itens do passo estão na mochila/equipados ou
  quando o tempo da paragem de cartas termina. `pararRota()` pára.
- GUI: aba Macro, "Rota de farm": lista os passos, "Montar e seguir", "Parar a rota".
- Nada é fixo no código. A lista de alvos é a que o dono escolhe no Painel.

## 4. GUI

- **srdog** fora (3 textos e a mensagem de erro). Nenhum nome hardcoded.
- **Ranking por objetivo** ordenado pelos números. Covil do Barão passou a #1 (22.116 xp/min) com a
  coluna de risco a dizer "o chefe mata você". A escolha de onde farmar continua a recusar regiões
  onde ele morre.
- **Histórico**: um só `RUIDO_HIST` (habilidade, grupo, golpes do chefe, rotação, skills, barra,
  ofertas, regiões), as entradas antigas de `mercado: watch` filtradas, e repetições seguidas
  colapsadas em ×N.
- **HP dos inimigos**: `observabilidade.js` apagado. A lista de inimigos é desenhada dentro de
  "Combate ao vivo", a cada render, sem o texto estático nem jargão. Prova ao vivo: 1 inimigo listado,
  `#lolidle-hp-inimigos` já não existe.
- **Aba Personagem**: de 10 cartões para 5. Saíram barra ideal, ordem de subida, DPS por habilidade e
  a lista de pontos. Os nomes das habilidades ficaram curtos (a descrição vai no tooltip).
  Corrigido o "[object Object]" da sugestão de atributos.
- **Pausar tudo** substitui "Desligar todos os switches". O Pausar/Retomar do cartão mestre foi
  removido (fazia o mesmo) e o cartão ficou com uma frase.
- **Auto farm** no topo da primeira aba (modalidade, objetivo e alvos) e como switch (Auto farm
  viajar e farmar).
- **Aba Macro** nova: rota de farm, cartas, resumo da watch, ações de base e build por fase. Cada
  switch relevante tem um ⚙ na árvore que abre a aba Macro no bloco daquele switch (ou a aba do
  assunto: Personagem, Poção).
- **Watch**: cada item escolhido tem o seu limite de ouro ("até X"). O limite é aplicado na compra
  (`limiteItemWatch`), por base do item.
- **Sem ids de build** no texto (saiu a "Assinatura da build" e os 3031/3089 do texto de blindados).
  As citações `[motor.js:…]` que vinham dentro dos motivos são removidas no `esc`.
- Intros das abas: uma frase cada.

## 5. Lista dos pedidos das últimas 48 h e estado

| # | pedido | estado |
|---|---|---|
| 1 | tirar o hardcode do srdog e o texto sobre | feito |
| 2 | comprar por item, "item x até x de gold" | feito (limite por item na watch) |
| 3 | aba Personagem bloated: reduzir ou remover | feito (10 para 5 cartões) |
| 4 | ranking por experiência com o Covil do Barão em último | feito (ordena pelo objetivo, coluna de risco) |
| 5 | entender baú e carta e implementar algo decente | feito (abrir e encaixar automáticos; baús abrem sozinhos no jogo) |
| 6 | caminho de farm de itens e cartas, inputado e salvo | feito (rota em `cfg.rotaFarm`; não exercitada ao vivo) |
| 7 | melhor build que se consegue farmar ou comprar, com drop ou carta | parcial: build do catálogo, cartas encaixadas automaticamente, rota diz onde farmar |
| 8 | não tentar comprar Lichbane | feito (`cfg.naoComprar`) |
| 9 | parar de falar id de build na GUI | feito |
| 10 | auto farm na primeira aba e como switch | feito |
| 11 | cada switch pode configurar os detalhes | feito (⚙ e aba Macro) |
| 12 | histórico com eventos inúteis ("habilidade") | feito |
| 13 | listar e concluir os prompts das 48 h | este documento |
| 14 | explicar a build "retardada" | secção 1 |
| 15 | "Pausar tudo" e juntar o botão de pausar | feito |
| 16 | uma frase por coisa | feito nas intros e nos cartões principais |
| 17 | parar de dizer "motor" na GUI | feito no texto visível (0 ocorrências) |
| 18 | parar de explicar categorias em detalhe | parcial (as descrições de habilidade exigidas pelo jogo continuam, agora recolhidas) |
| 19 | bloco de HP dos inimigos estático | feito (lista viva) |
| 20 | sessão macro nos switches, com ícone e detalhes editáveis | feito |

## 6. O que não está provado ou ficou por fazer

- **Encaixe de cartas ao vivo**: o código recusa fora da Fonte (provado) e os seletores foram lidos da
  janela real do Ornn, mas o encaixe completo não correu porque o boneco estava a farmar. A rotina de
  base já leva o boneco à Fonte quando há carta para encaixar.
- **Rota**: montada e guardada, não seguida ao vivo.
- A suíte (`rc=0`) não cobre cartas nem a rota; cobre o vocabulário de seletores.
- O cartão "Habilidades, o que a automação sobe sozinho" ainda mostra um bloco vazio de manutenção
  manual.
- O select "Modelo" em Personagem não pré-seleciona o modelo guardado.
