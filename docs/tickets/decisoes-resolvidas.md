# DECISÕES DO DONO — RESOLVIDAS COM A PALAVRA DELE (sem perguntar)

> Os leitores acharam 9 pontos marcados "DECISÃO DO DONO". Antes de perguntar, o Lead foi procurar a
> resposta no histórico (Regra Nº 2: se está escrito, modela-se — não se pergunta). **Estava escrito nas
> nove.** Ficam aqui as resoluções com a evidência, para nenhum worker inventar outra coisa.

| # | A decisão | A resolução | A evidência (palavra do dono) |
|---|---|---|---|
| D-01 | Lendário abaixo de A: mercado ou Lojista? | **Lendário NUNCA vai ao Lojista. Lendário da classe do dono -> GUARDAR. Lendário repetido -> MERCADO (anunciar). Sem lugar -> guardar na mochila até abrir lugar.** | Correcção de 22:40: a resposta anterior do Lead estava errada. A palavra mais recente e mais específica do dono: "lendarios sao desejados pelos jogadores, entao nunca se vende lendario pelo lojista, so pelo mercado" (parte-02.md:5011/5039-5041) e "lendario UNICO, que e pro meu personagem da classe dele (ap), deve ser guardado... se eu tenho outra liandry a, (duas), anuncia uma delas no mercado" (parte-01.md:12672); sem lugar: "guardar na mochila ate abrir lugar no mercado" (opcao 1, escolhida pelo dono). |
| D-02 | "Não mexe no A/S/SS" inclui REFINAR? | **Refinar está autorizado e é instrutor.** | "quando conseguir um dos itens essenciais, tier a ou mais, pode refinar até mais 2 ou mais 3" — autorização expressa de refino. |
| D-03 | Como carregar a extensão na Katarina? | **Pelo relay omp (9224), sem abrir Chrome novo.** | "usa as ferramentas q tu tem pra controlar meu browser". Provado hoje: a extensão responde ao vivo nesse caminho. |
| D-04 | VIP do jogo na Katarina (ele mandou desativar) | **Re-afirmar por tick pela extensão** (não caçar chave persistida). | O jogo re-afirma o estado sozinho; só uma afirmação por quadro vence. É implementação, não política. |
| D-05 | autoEquip: regra antiga (off) vs nova (sempre equipar) | **autoEquip = true.** | Objetivo: "Equipar SEMPRE o melhor item disponível em cada slot, inviolável"; o motor passou o default a true. |
| D-06 | Runeterra continua manual? | **Sim, saltar.** | Decisão anterior dele: a extensão salta-o. Mantém-se. |
| D-07 | Fuga de chefe fatal passa para `manutencao`? | **Fugir, sempre. Implementar nos dois ramos.** | "NÃO É PRA MORRER, NUNCA". A arquitectura (onde vive a fuga) é nossa; a obrigação de fugir é dele. |
| D-08 | Preço sem comparável: 1,5M ou 2M? | **1,5M.** | Ele disse 1,5M no histórico; o ticket é implementar, não re-perguntar. |
| D-09 | Destino de item com mercado/mochila cheia; lendário duplicado | **Lojista só recebe básico/épico. Lendário: mercado ou mochila.** | "nunca se vende lendario pelo lojista" (palavra do dono). Básico/épico/duplicado-de-básico -> Lojista; duplicado de lendário -> mercado; sem lugar -> mochila. |

**Nenhuma pergunta foi feita ao dono** — e a correcção de 22:40 (D-01/D-09) também não: foi o worker W5 que apanhou o Lead a contradizer a palavra do dono e perguntou antes de implementar. É assim que o pipeline deve funcionar. Se alguma resolução estiver errada, é uma linha a mudar — mas
nenhuma foi inventada: todas têm a palavra dele atrás.
