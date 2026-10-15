# Respostas — LoL Idle Auto (extensão)

> Doc de respostas às tuas dúvidas desta sessão. Atualizado 2026-10-13.

---

## 1) Quando, no caminho NORMAL, ficaríamos parados (AFK) na base?

**Regra:** a base é sempre **passagem com motivo**. O script **nunca** deveria
"morar" na Fonte. O **idle de 3 min** é só **fallback** (se algo travar e o boneco
ficar sem fazer nada, ele volta a farmar sozinho).

### Motivos válidos de estar na base (cada um com ida e volta ao farm)

| # | Motivo | O que faz | Depois |
|---|--------|-----------|--------|
| 1 | **Mochila cheia** (ou lixo acumulado) | Lojista: vende espólio + épicos < A | volta a farmar |
| 2 | **Poção abaixo do mínimo** (P1<200 · P2<100 · P3<30) | Lojista: compra 3000/1500/700 | volta a farmar |
| 3 | **Antes de trocar de mapa/região** (o jogo bloqueia viajar em combate) | aperta **B** → Fonte → viaja | vai pra região nova |
| 4 | **Antes de qualquer run de teste** (trocar skills/itens) | Fonte → troca → volta pro mapa escolhido | roda a run |
| 5 | **Depois de morrer** | volta pra Fonte (o jogo faz isso) | reavalia e volta ao farm |
| 6 | **Chefe fatal detectado** (ex.: Barão) | **B** → Fonte (~4s) → reentra na região | farma só os mobs |

**Duração típica de cada passagem:** 5–20 s. **Nunca** 3 min de propósito.

**O watchdog de 3 min** (`supervisarBase`, `cfg.idleBaseMs = 180000`):
- só dispara se estiver na **Fonte** e **sem atividade** por 3 min;
- escolhe a região (`cfg.regionDefault` ou a melhor por xp+ouro) e **viaja**;
- é **rede de segurança**, não parte do fluxo.

Agora também: **depois de terminar a rotina de base** (`acaoBase`), o script
**volta a farmar sozinho** (não fica parado esperando).

---

## 2) PAUSE — estado antes / durante / depois

Implementado (`automation.js`): botão **⏸ Pausar** no topo do painel.

- **Ao pausar** → tira um *snapshot*: local, ouro, poções (P1/P2/P3), HP, nível,
  mochila (usados/cap), chefe fatal atual. Fica gravado no log (`pause`).
- **Durante o pause** → tudo fica **congelado**: fuga de chefe fatal, rotação de
  skills, watchdog de base e rotina de base **não agem**.
- **Ao retomar** → tira um **novo snapshot**, calcula o **diff** (o que mudou:
  local, ouro ganho/gasto, HP, poções gastas, XP/nível, mochila) e **recalcula**
  `recomendar()` (melhor região) — ou seja, ele "reaprende" o estado novo.
- O resultado aparece na aba **Auto** (card *Controles*) e no log.

Uso pensado: tu pausa, muda o que quiser (skills, itens, região), acontece o que
acontecer, e ao despausar ele **recalcula com os dados novos** em vez de continuar
com a foto velha.

---

## 3) Eu estimei CORRETAMENTE as poções dos bosses? Testei se bateu?

**Resposta honesta: NÃO — ainda não testei se o número bate.** A `estimarLuta()`
é **teórica (1ª ordem)**, um alvo a validar.

**O que a estimativa diz hoje** (personagem nv 27, na Fonte):

| região | chefe | cura skills (usada) | DPS chefe | tKill | poções |
|--------|-------|--------------------:|----------:|------:|-------:|
| Rio | Arauto do Vale | ~332/s | 318 | 41s | 0 |
| Dragão | Dragão Infernal | ~601/s | 699 | 64s | **7** |
| Barão | Barão Nashor | ~533/s | 1214 | 136s | **~103** |

**Problema conhecido (já corrigido em parte):**
- A 1ª versão usava a **cura de MOBS** (AoE, com vários alvos ao mesmo tempo) →
  **inflada**. Num chefe **sozinho** a cura cai muito.
- Correção aplicada: usa **cura da fase de CHEFE** (medida) > **cura ao vivo** >
  **metade da cura de mobs** (conservador).

**O único dado real que temos:** o **Barão matou em ~11s**. A estimativa antiga
dizia "sobrevive com ~103 poções" → estava **otimista/errada**.

**O que falta pra dizer "bateu":**
1. rodar um chefe **com o script ligado**, medindo: **poções gastas**, **duração**,
   **HP mínimo**, **morreu ou não**;
2. comparar com a `estimarLuta` e **calibrar automaticamente** (guardar o erro por
   chefe, como já fazemos com `kReg` de xp/ouro);
3. repetir até o erro ficar pequeno.

→ **Ação proposta (vou implementar):** ao fim de cada luta de chefe, gravar
`estimado × real` e ajustar o fator. Aí a resposta passa a ser "sim, bate".

---

## 4) Status dos teus pedidos (111 prompts da sessão)

### ✅ Feito e funcionando

- Extensão MV3 instalada (`pbdlekcgmpippamdkgbaphcppjafobjo`); **update por self-reload** (não rouba foco, não perde dados).
- Leitura: HP, ouro, local, poções (contagem), mochila, equipamento, atributos, skills, mapa, log da aba Servidor.
- **Auto-poção smart** (padrão): decide por **dano/s real × cura/s real** (independente do alvo, que vem bugado). Emergência (HP baixo/TTD curto) sempre ativa. Aba **PvP** tem a antiga (flat/%).
- **Rotação de skills**: usa TODAS, o tempo todo; ultimate (recarga ≥35s) só no chefe / área difícil. Verificado.
- **DPS por habilidade** (Katarina, com adaga/giro da Preparação).
- **Métricas de farm** por ciclo (mobs × chefe; ouro/xp/dano/cura/runas por min); separação de fases.
- **Regiões**: tabela medido × meta, `estimarRegiao` (xp/ouro/runas por min), calibração `kReg`, recomendação, **giro de regiões**.
- **Base**: vender (espólio + épico < A, preserva lendário A+ e Rabadon), curar (Soraka), repor poção, **e voltar a farmar**.
- **Morte-zero**: chefe fatal → B → Fonte → reentra (farma só mobs).
- **Item-farm planner** (`planejar`): zona, mobs/chefe, sobrevive/fatal, drops/h.
- **Observabilidade**: log com buffer circular, issues preservadas, captura de morte (quem matou + xp perdido).
- **Loja de itens por MOLDURA** (modal com ícones do jogo) + filtro **épicos/lendários** (Bastão `1058` entra como épico).
- **GUI nova**: densa, 6 abas (Auto/Farm/Itens/Skills/PvP/Log), sem scroll de página, com **logo + ícones de itens + ícones das poções do HUD**.
- **Hover** = só no **teu nome** (`#st-nome`), topo-direita.
- **Novidades**: janela que abre **sozinha após reinício** é **fechada automaticamente**; se **tu clicou**, ela fica.
- **AFK watchdog 3 min** + **voltar ao farm após a base**.
- **PAUSE** com recalculo (antes/durante/depois).
- **`estado()`**: ficha da conta + itens (nome, raridade, qualidade, protegido/lixo, ícones).

### 🔜 Falta (vou seguir por aqui)

- **Validar/calibrar a estimativa de poções por chefe** (item 3 acima).
- **Mercado**: anunciar/reajustar/saturar de verdade (fluxo de anúncio ainda não testado — mercado estava 10/10).
- **Troca de ITENS por contexto** (equipar/desequipar mob × furioso × chefe).
- **Test-mode**: fila de runs (skills × itens), botão "Testar", persistir o resultado por run.
- **Farm de runas** como objetivo escolhível (melhor região por `runas/h`).
- **Planner de itens**: "unlock" (subir DPS/nível numa região melhor) até o alvo virar eficiente.
- **Tutorial** "primeira caçada" (já existe um esqueleto de objetivos no jogo).
- **Humanização** (última, por pedido).

---

## 5) Perguntas rápidas

- **"To vendo que tá indo bem"** — sim: smart sem poção onde a cura cobre (dragão/rio) e com poção onde não cobre (Barão).
- **"A área do hover"** — agora é só o teu nome, nada maior.
- **"A GUI mostra scrolls"** — refeita: sem scroll de página; só tabelas longas têm uma área de rolagem própria (conteúdo denso).
- **"Escolher item tem que ser botão"** — feito: botão **"Escolher itens…"** abre um **modal** com a grade; não é mais a lista inline.
- **"Planejar tem que executar"** — feito: **"Planejar e executar caminho"** planeja **e** viaja pra melhor zona viável (quando o script está ligado).
