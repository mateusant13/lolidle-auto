# Spec da automação — Auto Poção / rotina (LoL Idle)

Fonte: entrevista do dono em 2026-10-13. **Isto é o contrato**; o TODO aponta
para cá. Em dúvida, o dono decide.

## 0. Escopo

**Automatizar o loop inteiro**, sem intervenção:
caçar no mapa → loot → gerir a mochila → voltar à Fonte (B) → vender/anunciar →
repor poções → voltar a caçar. A rotina VIP do jogo deve ser considerada
(pode estar ligada; a extensão não deve brigar com ela).

## 1. Modelo da mochila

- Capacidade **30** (hoje 7 ocupados, sendo **3 de espólio**).
- **Espólio empilha** (até 1.000 por pilha); cada pilha ocupa 1 espaço. Em
  geral são ~3 espaços.
- **Itens NÃO empilham**: dois itens iguais ocupam **2** espaços.
- Cada item dropado = +1 espaço.
- Básico tem filtro automático no jogo — ignorar.

## 2. Prioridade de descarte (ordem)

1. **Épicos abaixo de A** = lixo → **vender no Lojista** (junto com espólio,
   ver §5).
2. Mochila enchendo de **épicos**: guardar épicos **A** "por garantia".
3. Se a mochila **encher de épicos A** e começarem a **duplicar lendários** →
   começar a remover os **épicos A** (para abrir espaço pros lendários).
4. Mochila enchendo de **lendários** → remover os lendários de **menor
   qualidade (tier)** pro **Mercado**.
5. Se o **Mercado saturar** (10 ofertas, ver §4) → vender ao **Lojista** os
   lendários de menor tier (**abaixo de A**).

## 3. Regras de ouro (invioláveis)

- **Lendário qualidade A, S ou SS**: **NUNCA** destruir, **NUNCA** anunciar,
  **NUNCA** vender ao lojista. Sempre preservado; o dono decide manualmente.
- **Rabadon** (`3089`): **nunca encostar** — manter de qualquer qualidade.
- A GUI **nunca** deve oferecer opção de destruir/filtrar lendário A ou melhor.
  Um misclick do dono **não pode** remover um lendário bom.

## 4. Mercado (tecla J)

- Limite **10 anúncios**.
- Ao **voltar à base (B)**, o script **reajusta os 10 anúncios** com base no
  preço do que já existe no mercado.
- Preço: **90% do mais barato do mesmo item** no mercado.
- **Qualidade escala o preço**: se um lendário **C** vale 200k, um **B** meu
  vale **400k** (dobra). A ideia: preço = base(90% do mais barato do mesmo item
  no **mesmo tier**) e, para tier acima, multiplicar pela razão de valor da
  qualidade. (Calibrar o fator exato: C→B = 2×; conferir com `QUALIDADES[].venda`
  — C 0.8, B 1.0, A 1.5, S 3, SS 8.)
- **Saturação**: se as 10 ofertas forem **lendárias**, tirar a de **menor
  preço** e pôr o novo lendário. Se **nem todas** as 10 forem lendárias, remover
  primeiro um **épico** anunciado.
- **Lendário A+ nunca anunciado.**

## 5. Lojista (Fonte)

- O Lojista compra **espólio** e **épicos abaixo de A**.
- **Espólio só é vendido quando formos vender um épico no Lojista** (vender
  junto). Lojista é quase lixo: valor pouquíssimo.
- **Lendário A+ nunca** ao lojista.

## 6. Poções (Lojista vende; tem campo de quantidade)

- Manter sempre: **P1 > 200**, **P2 > 100**, **P3 > 30**.
- Se **qualquer** cair abaixo → voltar à base (B) e comprar de uma vez
  **3.000 P1 + 1.500 P2 + 700 P3**.
- **Prefira comprar as mais caras primeiro** (valem mais a pena por uso).
- Limite de ouro: **só o que houver disponível**.

## 7. Região / caça

- **Região ideal** = melhor faixa para o nível; o dono pode escolher uma padrão
  na GUI (prioridade sobre a ideal).
- **Idle > 3 min na Fonte** → ir pro mapa (**M**) e entrar na região padrão.
- **Qualquer** caminho que volte a uma região do mapa usa a região padrão
  (ideal ou escolhida).
- Se estiver **morrendo na região**, pode **abaixar uma faixa**.
- "Dungeon" = conceito; o nome real é **Summoner's Rift / mapa**.

## 8. Morte

- Ao morrer: **entender os recursos disponíveis** naquele momento e **logar na
  GUI a última morte e os recursos**. O dono decide o que deu errado e ajusta
  pela GUI (ou pede mudança na extensão depois).

## 8b. Métricas de farm (aba Servidor)

- Na HUD há as abas **Global / Local / Servidor**; a **Servidor** mostra o **ouro
  coletado**.
- Logar **ouro + XP** de um **ciclo de farm**: de **entrar no mapa** até
  **achar e derrotar um chefe** (o chefe morto fecha o ciclo).
- Objetivo: comparar **mapas** e achar o melhor pra farmar (ouro/hora, XP/hora
  por região).

## 9. Medição (DPS)

- **DPS** = soma dos **números de dano que aparecem na tela** por segundo.
- Além disso, **DPS por habilidade** (por tecla Q/W/E/R/A) seria muito bom.

## 10. Interação (humanização)

- **Preferir keybind a clique.** Ex.: `B` = voltar, `M` = mapa, `J` = mercado,
  `K` = ranking, `G` = guilda, `1–5` poções, `Q/W/E/R` habilidades.
  Clique deve ser o **menos humano**, usado só onde não há keybind (ex.: Lojista).
- **ÚLTIMA tarefa: humanizar tudo** — atrasos, ordem, pausas, variação — mantendo
  a qualidade das tarefas e funções. Primeiro faz funcionar "cru", depois humaniza.

## 11. GUI

- Painel no hover do **nome** (`#st-nome`), **área maior** (o hover atual está ruim).
- Config por poção (% do HP máx perdido ou HP flat perdido) — **feito**.
- Menu de **todos os itens do jogo** para permitir/limitar:
  - por **qualidade** (C/B/A/S/SS): nenhum / 1 / mais;
  - por **item** (épicos e lendários): permitir encher a mochila ou não.
- Mostrar HP atual, perdas, taxas (dano/s, cura/s, poções/s), último uso de poção.
- Mostrar **última morte + recursos**.
- **Nunca** oferecer destruir/filtrar lendário A+ nem Rabadon.

## 12. Teste de builds (habilidades × itens) — decisões do dono

### 12.1 Set de habilidades (o dono monta na GUI)
- Um set = **apenas quais skills ficam na barra de combate** (4 slots
  `#hud-habs`). **NÃO** mexer em rank nem usar Reset de habilidades.
- Gesto real (hoje manual): abrir a **aba Habilidades**, clicar numa skill **da
  barra** (sai) e clicar numa skill do **arsenal liberado** (entra no vago).
- **O jogo usa as skills sozinho**; a extensão só decide o que está na barra.
- Arsenal: `#hab-ativas .hab[data-t=Q/W/E/R/G/A]` (rank no texto "10/10",
  `na-barra` = está na barra, `data-dica` = fórmula do rank atual e do próximo).
  Barra: `#hud-habs .hud-hab` (4).

### 12.2 Set de itens (o dono monta na GUI)
- 5 slots: bota + 4 itens (`#equip`, `#hud-equip`, `#bolsa-equip`).
- Equipar = **mesmo gesto de clique** das skills; provavelmente exige a Fonte.

### 12.3 Montagem, ordem e duração
- **O dono** monta a fila na GUI: cada run = 1 set de habilidades + 1 set de
  itens + 1 **mapa** escolhido.
- **1 ciclo por run.** A run dura **até o chefe aparecer e morrer** (spawn do
  chefe é aleatório — não é culpa da build).
- Entre runs: **volta à Fonte**, aplica o set da fila, **volta ao mapa escolhido**.

### 12.4 Métricas por run
- Mobs e chefe medidos **independentes** e **somados no total** (mostrar os dois).
- Tempo nos mobs menores **não serve** (aleatório). Alternativa válida: **tempo
  entre mobs**.
- **Waves**: 2/3/4 mobs (e o furioso, raro), morrem rápido; agrupar mortes
  próximas em waves.
- **Cura das habilidades**: ignorar a poção — se o número de cura coincide com o
  instante do uso da poção, descarta. **Sede de Sangue** = só **cura/s** (métrica
  confiável: no chefe).
- Estimar cada skill em **nv 1 / nv atual / nv máx** via `data-dica` (validar na
  wiki `lolidle.com/wiki#campeao-katarina`). Personagem novo: a extensão aprende
  a evolução com o que o jogo dá.

### 12.5 Cooldowns / troca de skills (POR PADRÃO)
- 4 slots, mas dá pra **usar a skill, ela entrar em cooldown, tirar do slot e pôr
  outra** — usar **todas** as desbloqueadas rápido (permite áreas mais difíceis).
  **Implementar por padrão.**
- Skills de **cooldown alto**: usar **só no chefe** se a área é a ideal do nível
  **ou** se runs anteriores provam folga de HP nos mobs. Senão, usar as ultimates
  **até nos mobs fracos** e **correr no chefe**.

### 12.6 Morte na run
- Poção já é gasta sozinha (automático).
- Morte **no chefe** e área valendo a pena: **ignorar o chefe** naquela área
  (volta à base sozinho, ~4s) e **repetir a área**. Configurável; padrão assim.

### 12.7 Persistência e modo
- Resultado em **`chrome.storage.local`** (fica no Chrome do dono). Botão
  **Exportar** (JSON/CSV) — TODO.
- **Dry-run primeiro** (observa e loga, sem agir); conferir o que não bate e
  arrumar antes de soltar as ações.
- Regras de ouro valem no teste: **lendário A+/Rabadon intocável**.
