# TODO — extensão Auto Poção (LoL Idle)

## PLANO MESTRE (pedido 2026-10-13, fim da sessão) — ORDEM DE EXECUÇÃO

### Fase 0 — TERMINAR o script atual (antes de qualquer coisa grandiosa)
- [x] **"Espaço em branco" da GUI**: painel com `max-height` (não altura fixa) + `align-content:start`; a altura segue o conteúdo. Verificado: painel 515px (antes fixo 780), `main` sem sobra (scroll=client=420).
- [x] **`estimarLuta` × `motor.js`**: agora PREFERE o empírico (`agregar().bossMs` + `potChefe`) à teoria; expõe `fonte`/`tKillRealS`/`potReal`. Verificado no Dragão: `fonte=empirico, tKillS=54.2, potTotal=26` (reais).
- [x] **Cura ao vivo com teto**: `content.js rates()` — rise que termina no HP máx conta como o nominal (maior rise não-capado). Feito e verificado ao vivo (healSkill 138/s com HP cheio).
- [x] **DPS do Lich separado** do DPS da skill: cada skill expõe `dpsDireto`/`dpsAdaga`/`dpsLich`; linha própria **Perdição de Lich (proc)**. GUI: `dps skill | dps adaga | dps Lich | dps | cd`. Verificado: Lâmina Saltitante 221+313+152=687.
- [x] **Hardcode removido**: `respawnS` vem de `META.respawn` (motor: live 1.5 + local 1.2); `mobHpMinRel` e `fugirMs` são `cfg` (0.15 / 30000). Verificado ao vivo.

### Fase 1 — QUESTS (Capitão da Legião) — **FAZER AGORA, pro uso do dono**
- [x] `aceitarTarefa()`: Fonte → Capitão → `[data-palavra="tarefa"]` → `#npc-troca .troca-linha [data-tarefa=k]`. Escolhe melhor `(xp+2·ouro)/min + item`, penaliza `desafio`. Botão **Aceitar tarefa (Capitão)**.
- [x] Diárias: `aceitarDiarias()` (Fonte → Capitão → `[data-palavra="diaria"]` → premia prontas + clica `[data-aceitar-diaria=k]`). Botão **Missões diárias**.
- [x] Entregar tarefa pronta: `entregarTarefa()` lê `#rastreio-tarefa.pronta` → Capitão → `[data-palavra="entregar"]` → `sim`. Botão **Entregar tarefa pronta** + **automático na `acaoBase`** (entrega → se não tem, aceita diárias + melhor). Verificado: lê a tarefa real do dono.

### Fase 2 — Generalizar para QUALQUER personagem ("conhecer o jogo inteiro")
- [ ] Mapear **tudo** do jogo (`motor.js`/`balanco.js`/`itens.js`/`wiki-dados.js`).
- [ ] **Build ideal por campeão**, melhor→pior, com variações — **com matemática** + previsor empírico.
- [ ] **Melhor farm por campeão**: melhor balanço XP/ouro/item por minuto.
- [ ] **Escala com atributos distribuídos** + **auto-distribuir atributos** (toggle).
- [ ] **Auto refine** (Ornn): refino **só tier A+**; `+2` seguro, do `+2` adiante há chance de dropar. Toggle.
- [ ] **Ignorar o mapa de Runeterra** (manual).

### Fase 3 — Conta nova / Auto Play
- [ ] Rodar do **nível 1, 0 itens**: farmar, build, poções, refino — sozinho.
- [ ] Aba **"Auto play"** com toggles (auto-refino, auto-atributos...).
- [ ] Conta **guest** na guia anônima.

### Fase 4 — Qualidade
- [ ] **Humanizar TUDO**.
- [ ] **Full audit de bugs**.
- [ ] **TESTES FIRST** para toda implementação.

## Sessão atual — CDR cap · previsor empírico · teste Ímpeto × bota (2026-10-13)

### Descoberta crítica: cap de CDR
- **Fórmula do motor** (`motor.js:536`): `reducaoRecarga = min(0.40, min(0.30, 0.004·foco) + cdrItens)`.
- CDR **dos itens com refino**: 3171 Lucidez +2 → 0,186 · 4629 Ímpeto +3 → 0,204 → **≈0,39 só de itens**.
- ⇒ **Ímpeto Cósmico (4629) + bota de CDR (3171) juntos ESTOURAM o cap de 0,40 e desperdiçam CDR.**
- **A bota de CDR nunca foi testada sem o Ímpeto** — meu teste anterior errou.

### Correção do teste (o certo) — SÓ o Rabadon é fixo
- Varia **Ímpeto × bota**, mantendo o set padrão (Lich 3100, Cajado 3135):
  - A: `3089,3171,4629,3100,3135` (CDR + Ímpar)
  - B: `3089,3171,6653,3100,3135` (CDR, sem Ímpar → Liandry)
  - C: `3089,3175,4629,3100,3135` (PEN + Ímpar)
  - D: `3089,3175,6653,3100,3135` (PEN, sem Ímpar → Liandry)
- **Erro anterior (NÃO repetir):** trocar Cajado (3135) por Chama (4645) — mudei item errado.

### Previsor empírico (usa o histórico REAL)
- [x] `previsorHistorico(ids, regiao)` — aprende de `farm.cycles` (`setup.equip` + `mobFase.perMin`:
      ouro/xp/kills/dano por min) e de `farm.lutas` (`build` + `outDps`/`inDps`/`durS`), por **assinatura de build**.
- [x] `preverBuild(ids, regiao)` — **histórico** quando existe (n≥1); senão o **teórico**. Exposto.
- [x] `rankBuildsTestadas(regiao)` — ranking empírico (ouro/min no mob, outDps real no chefe).
- [x] **Motivo:** a DPS teórica é péssima p/ farm — chega a **inverter** o ranking
      (Chama: menor estimativa e melhor farm real). Farm = AoE/clear, não DPS single-target.
- [ ] Usar o previsor empírico na **escolha de build** (mob e chefe) e no `melhorSet`.

### Bugs corrigidos
- [x] **Mob não gravado** em build sem chefe: `mobFase.perMin` só existe no `fechaFase`.
      → `perMinLive()` calcula a taxa ao vivo. Todas as 8 builds passaram a gravar mob.
- [x] `readEquip()` devolvia itemcom `base:""` → filtra.
- [x] `dpsCenarios()` — estimativa em **refino-0 / tier-A (×1,15) / atual** (`(1+0,12·ref)·multQual`).
      CLI: `bun tools/ll.mjs dps`.

### Números medidos (referência)
- **Mob 60s** (ouro/min): Chama 4519 · pen bota 4424 · 5-Chama+2CDR 4280 · Liandry 4273 …
- **Chefe DPS real**: pen bota 938 (72s) · Liandry 887 (77s) · Chama+2CDR 788 · Chama 651. **0 mortes.**
- **Real ÷ est. atual (chefe)**: Chama 2,13× · pen 1,80× · Chama+2CDR 1,45× · Liandry 1,17× (subestima).

### RESULTADO do 2×2 (previsor empírico, região Dragão, recência)

| build | bota | Ímpar | mob (ouro/min) | n | chefe DPS | n |
|---|---|---|---|---|---|---|
| A | CDR 3171 | ✅ 4629 | 4307 | 8 | 1033 | 1 |
| B | CDR 3171 | ❌ Liandry | **4518** | 4 | 612 (teór) | 0 |
| C | PEN 3175 | ✅ 4629 | **4602** | 5 | **923** | 5 |
| D | PEN 3175 | ❌ Liandry | 4276 | 2 | 597 (teór) | 0 |

- **Melhor mob: C (PEN + Ímpar) ≈ 4602 ouro/min.**
- **Melhor chefe: C (923 dps, n=5)** — A deu 1033 mas com **1 só** amostra.
- **PEN × CDR só faz sentido junto do Ímpar:** com Ímpar, PEN ganha (C>A); **CDR+Ímpar (A) ESTOURA o cap** →
  trocar Ímpar por Liandry na bota de CDR melhora (B 4518 > A 4307).
- **Ímpar sem desperdício = bota de PEN** (0,15 CDR de item só → longe do cap).
- ⚠ Amostras pequenas e ruidosas (60s). Rodar mais janelas p/ confirmar chefe de B/D.

### Pendente
- [x] Rodar o 2×2 (A/B/C/D) e decidir **pen × CDR** e **Ímpar sim/não**.
- [ ] Medir o **foco base** (quanto o Ímpar/CDR desperdiça).
- [ ] GUI: mostrar previsor histórico (real vs teórico) e o cap de CDR.
- [ ] Rodar B/D até aparecer chefe (firmar o DPS de chefe sem Ímpar).
- [x] Previsor empírico lendo **ciclos + rodadas de teste**, priorizando o mais **recente**.

## Guard anti-alucinação (pi) — global

- [x] **guard global** em `~/.pi/agent/extensions/hallucination-guard.ts`. Pega:
      (1) **loop de repetição** (n-grama repetido — ex.: "Let me run." repetido),
      (2) **alegação sem ferramenta** ("pronto/feito/corrigido" sem executar nada),
      (3) **thrash de ferramenta** (mesma chamada Nx / N erros seguidos).
- [x] Ações: **steer** (interrompe ao vivo via `message_update`→`abort()` + injeta
      correção + `continue`), **clean** (`context_edit` remove a msg degenerada),
      **fork** (`/guard fork` cria sessão nova de ANTES da msg ruim).
- [x] Comandos: `/guard`, `/guard on|off`, `/guard mode steer|clean|fork|both`,
      `/guard why`, `/guard fork`, `/guard reset`.
- [x] Self-test 7/7 PASS (loop ao vivo, turn_end, texto normal, claim s/ ferramenta,
      claim c/ bash ok, thrash 3x). Ativação: reiniciar o pi ou `/reload`.

## DPS & GUI em tempo real (feito nesta sessão)

- [x] **DPS = FONTE DA VERDADE**: `inject.js` hooka `Cena.prototype.evento` e lê os eventos
      `'dano'` (nosso, com `ev.fonte` = Q/W/E/R/A/T/M/ataque/queima/item/P) e `'recebido'` (tomado).
      É o dano **realmente aplicado** pelo jogo — não o canvas. (`live.dps.out` = 4173/s vs 85 do canvas.)
- [x] **DPS por skill** (com NOME, nunca letra) e **DPS recebido** no painel ao vivo.
- [x] **DPS por passiva de item** (real): `fonte='item'` → Lich (3100); `fonte='queima'` → Liandry (6653);
      Chama (4645) é multiplicador → estimativa `0,066×DPS`.
- [x] **DPS por item** (contribuição marginal) e **por item combinado** (total do set):
      `dpsItens(ids, região)` = `estimarSet(set) − estimarSet(set sem o item)`. Exposto na GUI.
- [x] **GUI ao vivo (~2 Hz)**: `ap-live-dps`, `ap-live-skills`, `ap-live-pass`, `ap-live-itemdps`, `ap-live-boss`.
- [x] **HP da barra do chefe** (`chefeBarra.vida`) exposto em `live.bossHp`.
- [x] `analisarLutaBoss` usa `live.danoHist` (amostras cumulativas) → `outDps`/`inDps` reais por luta.
- [x] `live.hp.max` clampado no HP do personagem (`player().vida`); `dmgRate`/`healSkill` da BARRA.
- [ ] **Humanização completa** e **menu de itens na GUI** (próximos grandes).

## Sessão atual (retomada)

- [x] **Switch único `enabled`** consolidado: GUI grava no topo do objeto
      `lolidleAutoPotion`; `content.js` lê `config.enabled`; `automation.loadConfig`
      lê `s.enabled ?? s.automation.enabled`; CLI `ll.mjs enable on|off` grava o topo.
      **Cura em combate SEMPRE ativa** (o switch só para compra/recall + rotação/itens).
- [x] `checarPocoes`: só poções **compraveis** (`pode(k)`, respeita nível do motor) +
      trava de **15 min** entre reposições (fim do loop que torrou ouro).
- [x] `reporPocoes`: compra **só o que falta**, ajustando o box de quantidade e
      clicando **uma vez** (o painel re-renderiza e resetava p/ 10).
- [x] **Matriz de builds (8)**: iniciada pela via correta (`iniciarTeste`, 8 sets) e **PARADA**
      após 6 variações com **mortes**. Raiz (replay em `G:/Temp/morte.json`): no **Dragão nv 30–40**
      o golpe é **2039** e a maior poção disponível é a **Forte (900)** — a **Suprema (2200) está
      travada no nv 30** e o char é nv 27 → **nenhuma poção cobre o golpe** (16 poções, dano in 19.5k,
      cura 7.7k). Além disso o `piso` usava `max` defasado (4469 vs 3619 real).
- [x] **Smart: `live.fatal` → fugir.** Quando o maior golpe (ou CARGA+seguinte) ≥ HP + melhor poção,
      o smart marca `live.fatal` e `checarChefeFatal` faz **B** (e **não volta** pra região letal).
- [x] **Guarda de teste**: `iniciarTeste` **recusa** região letal (`estimarRegiao().risco.mortal||morre`)
      no nível atual; `{forcar:true}` (ou `cfg.testeForcar`) ignora. Evita repetir a matança.
- [x] `areaDificil()` data-driven (tempo de kill real, `killLentoMs`) além do burst×HP.
- [x] `statsSet()` única (AP/CDR/pen/passivas) usada por `estimarSet` **e** `scoreSet` (agora com Lich/Chama/Liandry).
- [x] `abrirCofreTesoureira()` + CLI `cofre-abrir`: **a Tesoureira É NPC da Fonte** (cena/lista/diálogo
      no código) → clique `#npcs [data-npc="Tesoureira de Piltover"]` → `#janela-npc [data-palavra="cofre"]`
      → grade `.cofre-slot`. Na cidade, idem pelo **Burrinho de Carga** (motor `podeCofre` = base OU cidade).
- [x] **Melhor instância do mesmo item**: `equiparItem`/`aplicarItens` agora escolhem **maior
      QUALIDADE, depois maior REFINO** (`melhorSlot`, `parseSlotId`) — nada de equipar um Cajado do
      Vazio B se existe A/S/SS. `aplicarItens` ainda **troca** se a equipada for pior que a da mochila.
      `obterItem` traz do **cofre** a melhor instância (quando o cofre está aberto) e prefere a melhor.
      Testado ao vivo: `SS>A+3>A+2>B` e refino `A+5>A+2>A+1`.
- [x] **FONTE DA VERDADE = barra de HP** (`content.js rates()`): `dmgRate`/`healRate` saem das
      **subidas/quedas da barra**, não dos números do canvas. `healSkill = subidas da barra − poção`.
- [x] **Fato da poção = delta do contador** (`trackCounts`: `prev - count` quando o `×N` cai) ×
      cura do **motor** — nunca o número verde da tela.
- [x] **4× do canvas corrigido na raiz**: `inject.js` deduplica (mesmo tipo+valor+posição em <120 ms
      conta 1×). Os números do canvas agora só servem p/ replay/diagnóstico.
- [x] **Piso é PISO**: `decidirPocao` nunca devolve "seguro" se `hp < piso` (a cura ruidosa não cancela).
- [x] `max` clampado no HP do personagem equipado (`player().vida`) — nunca maior que o real.
- [x] Reload aplicado (Fonte, sem chefe): nova `automation.js`/`content.js`/`inject.js` ativas.
- [ ] **Reiniciar o pi / `/reload`** p/ carregar o guard e as correções no jogo (não recarregar com chefe ativo).
- [ ] Re-rodar a matriz **numa região sobrevivível** (ou só após o nv 30, com a Suprema).
- [ ] Alinhar `live.hp.max` do `decidirPocao` com o HP máx real do `player()` (o `piso` já está clampado em `max`,
      mas o `max` medido ficou defasado entre builds).

## Feito

- [x] Levantamento do jogo (DOM, fórmulas, cores do canvas, atributos) —
      `docs/lolidle-internals.md`.
- [x] Extensão MV3 instalada (id `pbdlekcgmpippamdkgbaphcppjafobjo`) pelo driver
      UIA do VOD.RIP, sem roubar foco.
- [x] Medição de HP, DPS recebido, cura/s (números verdes) e contagem de poções.
- [x] **GUI in-page** (`gui.js`): invisível por padrão, aparece no hover
      (**área ampliada**: nome + header 370×35 + painel de status, com
      pseudo-elemento `::before` estendendo ~14–20px); limite por **% do HP máx
      perdido** ou **HP flat perdido**, com tradução ao vivo; on/off.
- [x] Decisão por HP PERDIDO (faixas) + emergência por `HP/DPS` + chefe.
- [x] **Spec completa** da automação em `docs/automation-spec.md` (contrato;
      dono decide em caso de dúvida).
- [x] **Motor em modo observação** (`automation.js`, `enabled:false`): lê ouro
      (`#st-ouro`), local (`#local-nome`), poções e bolsa (`#mochila`), e publica
      o **plano** na GUI (guardar/proteger/vender lojista/anunciar mercado, repor
      poção, região). Keybind helper (`press`, keydown sintético) validado p/
      `I`/`M`/`J`. **Não age ainda** — dono valida o plano primeiro.
- [x] **Métricas de farm** (aba **Servidor** = `#log.canal`): lê `Loot de X: N
      de ouro. +M de experiência.`, acumula por ciclo (entrar na região → chefe
      morto), guarda os últimos 30 ciclos e mostra no painel.
- [x] **Atualizar = re-rodar o install com `-Force`** (o Chrome recarrega a
      extensão). Verificado 2026-10-13. Ver `docs/lolidle-internals.md` §10.

## Feito — 2026-10-13 (4) · combate local + smart de poção (matou o Dragão)

- [x] **Simulador de combate LOCAL** (`tools/sim-combate.mjs`): replica a sequência
      **REAL** de golpes do Dragão (`tools/dragao-hits.json` — 94 golpes, cada um
      com **dano + intervalo**). Mede sobrevivência, hp mínimo e custo de cada
      estratégia. Rodar: `node tools/sim-combate.mjs --busca` e
      `node tools/verifica-smart.mjs`.
- [x] **Achado que explicou a morte:** a smart velha decidia pela **média/s**
      (`danoRate − healRate`). Com golpes 953+953+2098 em ~5 s a média dava ~800/s
      e ela concluía que 900 de cura “cobria” — mas o golpe cai inteiro: **2.098**.
      A poção P2 (900) nunca cobre 2.098. O HP descia um golpe por vez até morrer.
- [x] **Smart corrigida** (`decidirPocao`, `automation.js`): agora decide pelo
      **último golpe REAL que acabou de acontecer** (não média, não mediana, não
      pior), pelo **HP atual** e pela **cura das skills SEM poção** (novo
      `healSkillRate` no `content.js`, = cura da tela − cura atribuída às poções).
      Soma um **piso de segurança** (`cfg.pocaoPisoPct = 0.75` do HP máx) pra
      aguentar o **golpe carregado** (2.100–2.826) — sem ele, a regra “só o
      último golpe” morre no burst.
- [x] **Sweet spot** (a pedido do dono: sem otimizar custo ao extremo): piso
      **75 %** + margem **1.1×** do último golpe. Testado na sequência real:
      **sobrevive em cura 0–300/s, com e sem P3**, hpMin ≥ 378. Custo ~6.840
      (PvP ~7.180; oráculo teórico com futuro conhecido 5.760).
- [x] **Regra de ouro do teste:** o log do Dragão inclui o trecho em que o
      boneco **morreu** (build sem Lich/CDR da matriz). O simulador reproduz
      isso; a smart nova passa.

## Auditoria de dados do motor — "usar TUDO do jogo" (2026-10-13)

> Regra: **nada** de constante do jogo hardcoded quando `motor.js`/`balanco.js`/
> `itens.js`/`wiki-dados.js` já expõe. O `inject.js` importa e manda por
> `postMessage`; o `automation.js` usa com fallback (se o meta não carregou).

### Agora vem do motor (novo em `inject.js`)
- `POCOES` (cura/preço/nível), `EXAUSTAO` (cooldown de poção), `POCAO_PVP`.
- `NOTURNO` (hp/ad/xp/ouro), `FURIOSO` (hp/ad/as/xp/ouro/saque/aura), `GEMAS`
  (chance comum/chefe).
- `CURVA` (coeficientes hp/ad/armadura/xp/ouro), `RECALL`, `GRUPO`, `NIVEL_MAX`,
  `ESPACOS`.
- `KITS.katarina` → kit serializado (base/ratio/recarga por rank) + `champ`
  (adBase/adNivel/papel/magia/semMana/adagas).

### Corrigido (hardcode → motor)
- [x] Cura/preço das poções (era 300/900/2200 e 40/110/260) → `META.pocoes`
      (no automation **e** no content, via storage).
- [x] Cooldown de poção (era 1 s fixo) → `META.exaustao`.
- [x] Curva de nível (hp/ad/armadura/xp/ouro) → `META.curva`.
- [x] Noturno/furioso (faltavam `hp`/`ad`/`as`) → `META.noturno/furioso`.
- [x] Runas (chance/chefe) → `META.gemas`.
- [x] Kit da Katarina (base/ratio/recarga) → `META.kit`; `adBase` do giro →
      `META.champ.adBase`.
- [x] `curaPocaoMax`, `POTS`, `melhorMix`, `healPotion`, `estimarLuta` → motor.
- [x] **`decidirPocao` agora usa o `danoGolpe` da WIKI** (ad × fator de nível ×
      mitigação) do **alvo atual** (`#hud-alvo`), além do último golpe medido e do
      piso. Ou seja: o dano por golpe é previsto ANTES de acontecer, não só
      reagido depois.

### Ainda hardcoded — resolvido (2026-10-13)
- [x] Fórmula do giro da Voracidade → coeficientes lidos do **fonte** de `HAB.P.giro`
      (o `inject.js` manda `giroSrc`; o automation faz o parse). Testado: giro 1668.
- [x] `mobsPerWave` → `META.grupoSpawn` (média de `2 + floor(rand*3)` = 3).
- [x] Capacidade da mochila → `META.mochila` (inicio/niveis/espacos) → `mochilaCap(nivel)`.
- [x] `CICLO`/`FUSO` do dia/noite → `META.ciclo`/`META.fuso`.
- [x] Detectar o **campeão atual** → pelo caminho do ícone da skill em `#hud-habs`
      (`/habilidades/<id>/`); o `inject.js` manda **todos** os `KITS`.
- [x] Esperas de recall → `(META.recall)*1000 + folga`.
- [ ] Efeitos de item: mantido o parse do **tooltip** (já traz refino + qualidade,
      que é o valor REAL equipado). Cruzar com `ITENS_DADOS` fica como melhoria.

## Auto-pot por CARGA do chefe — TODOS os chefes (2026-10-13)

- [x] **Detecção da carga**: o `inject.js` dá **wrap em `Cena.prototype.chefeCarregaRift`
      / `chefeGolpeRift`** (métodos do motor) e manda a mecânica + duração por
      `postMessage`. (O balão é desenhado por `rotulo()` com cache, então hookar
      `fillText` só pegaria a 1ª vez de cada texto — por isso o wrap na classe.)
- [x] **Mapa de TODOS os chefes** (`MECANICA` + `META.rodizio` do motor):
      **Arauto** investida 3,5× fis / pancada 2,2× fis / olho 2,6× mág;
      **Dragão** sopro 2,2× mág / chuva 1,8× mág / rugido (buff);
      **Barão** invocar / tentáculos 2,6× fis / ácido 1,2× mág.
      (carrega/espera vêm de `HAB_CHEFE`; o multiplicador é inline no motor.)
- [x] **Decisão**: `alvo = max(piso, último golpe, golpe da wiki, CARGA × margem)`.
      A margem agora só entra na **previsão da carga** (não no golpe comum).
- [x] **Carga FATAL**: se o dano previsto ≥ HP máx, o smart devolve `fatal:true`;
      o `checarChefeFatal` já sai da região (B → Fonte) via `risco.morre`.
- [x] **Simulador de chefes** (`tools/sim-chefes.mjs`): modela o básico (`1/as`) +
      as mecânicas carregadas (`RODIZIO_CHEFE`/`HAB_CHEFE`) do motor.

### Resultado (personagem nv 27, 4188 HP, 154 arm, 127 RM)

| chefe | básico | pior mecânica | veredito |
|---|---|---|---|
| Arauto do Vale (35) | 530 | Investida 1853 | **passa** (com carga ~6130g) |
| Dragão Infernal (40) | 1270 | Sopro 2795 | **passa** (com carga ~12380g) |
| Barão Nashor (50) | 2427 | Tentáculos **5641** | **insta-kill** com 154 arm |

**Barão:** os Tentáculos (físico 2,6×) batem **5641 > 4188 de HP** → **nenhuma
poção salva**. Precisa de **armadura ≥ ~250** (cai pra < 4188) **ou não lutar**
(a automação detecta o fatal e sai). É o mesmo que o dono viu: morreu pro Barão.

## Bugs / a verificar

- [x] **Consumo de poção agressivo / morte no Dragão** — resolvido pelo smart
      novo (último golpe + piso). A smart velha ainda deve ser removida do fluxo
      normal? Não: ela **é** a padrão (`config.smart !== false`).
- [x] **Meu DPS**: agora mede o dano REAL do jogo (`Cena.evento`), não o canvas.
      **supercontar** quando há vários monstros/AoE. Conferir com o número real
      por habilidade (usuário disse 1000+). Calibrar.
- [ ] Confirmar que `consumed` (contagem caiu) marca certo quando o jogo recusa
      o clique no cooldown.
- [x] `dmgRate` é queda de HP; cura das skills = subidas da barra − poções (canvas só p/ replay).

## Gestão por chefe (o mais importante)

- [x] Detectar chefe (`#log` "apareceu"/"derrotado"; `👑` em `#hud-alvo`) — já lê o log.
- [x] **Dano do chefe ANTES de enfrentar**: `estimarLuta`/`avaliar` (wiki: ad × fator
      × mitigação) + **pior mecânica carregada** (`piorMec`/`mortal`).
- [x] **Dano iminente real**: `decidirPocao` usa o **último golpe**, o golpe da
      **wiki** e a **carga** do chefe (`chefeCarregaRift`), com piso de segurança.
- [x] Prever tempo-para-morrer (`tMorrer`) e chefe fatal (`morre`/`mortal`) → o
      `checarChefeFatal` sai da região (B → Fonte).
- [x] **Combinar normal+forte vs poção única**: o simulador mostrou que **picar
      com 2×P1 é mais arriscado** (a 2ª chega 1 s depois e o chefe bate no meio).
      Padrão: **UMA poção que cubra o buraco** (o mais barata que cobre). O mix
      segue disponível em `melhorMix` (usado no `avaliar`).

## Pendências maiores (features) — status 2026-10-13 (5)

- [x] **Issue antigo** (`unsafe-eval` do parser removido) — filtrado do log no load; `issues: 0`.
- [x] **`planPotions`**: preços das poções do motor (antes 40/110/260 fixos).
- [x] **Última morte + recursos** (§8/§11): a morte agora guarda um `snapshotEstado()`
      (ouro, HP, nível, poções, mochila, local) e aparece **na aba Auto** e destacado no **Log**.
- [x] **Hover do nome** (§11): área ampliada (`inset:-7px -14px`, cursor pointer).
- [x] **Humanização** (§10, primeira passada): pausas humanas entre vender → curar →
      repor na rotina de base (`humano(250–1000)`).
- [x] **GUI já tem**: botão **Testar conjuntos** (`ap-testes`), **escolher itens**
      (`ap-pick`), **exportar dados** (JSON), **planejar/executar caminho**; resultados de
      teste persistidos (`…:testes`).
- [x] **Métricas** (§8b/§12.4): a tabela de regiões e a lista de ciclos já separam
      **mobs × chefe** (ouro/xp/poções por minuto, tempo de chefe, risco).
- [ ] **Motor de decisão da mochila** — `planBag` implementado; falta **validar ao vivo**
      (dry-run) o descarte na ordem da spec §2.
- [ ] **Mercado/Lojista** — `executarMercado`/`anunciarItemPorBase`/`reporPocoes` implementados;
      falta **validar ao vivo** o preço 90% + escala por qualidade (§4) e a saturação.
- [ ] **Matriz de builds** (`docs/teste-builds.md`) — rodar com a smart de carga +
      aborto por HP (não rodar sem rede de segurança).
- [ ] **Humanização completa** (última): varrer todas as ações (mercado, cofre, itens)
      com jitter/ordem/pausas.
- [ ] Acumular dados e **detectar mudança na wiki** e reavaliar builds sozinho.

## Infra

- [ ] Service worker (`background.js`) já permite self-reload via
      `chrome.runtime.sendMessage({type:'lolidle:reload'})` / storage key
      `lolidleAutoPotion:reload` — mas o caminho normal agora é re-rodar o
      install com `-Force`.
- [ ] Ícones da extensão (opcional em MV3).
- [ ] Mover a extensão para um repo próprio depois (hoje em `I:/!lolidle.com`).

## Itens / mochila / mercado / rotina — SPEC COMPLETA

> A especificação detalhada (entrevista de 2026-10-13) vive em
> **`docs/automation-spec.md`**. Ela é o contrato. Resumo dos pontos-chave:

- Automação **do loop inteiro**: caçar → loot → mochila → Fonte → vender/
  anunciar → repor poção → voltar a caçar.
- Mochila **30**; espólio **empilha** (1.000/pilha), itens **não** empilham.
- Descarte: épico **< A** → Lojista; épico **A** guardado; se encher de épicos A
  e duplicar lendários, remover épicos A; se encher de lendários, remover os de
  **menor qualidade** pro **Mercado**; se o mercado saturar, vender lendários
  **< A** ao Lojista.
- **Lendário A/S/SS: NUNCA** destruir/anunciar/vender (nem na GUI). **Rabadon**
  (`3089`): nunca encostar.
- Mercado: 10 anúncios, reajustar ao voltar à base; **90% do mais barato do
  mesmo item**; qualidade escala o preço (C→B = 2×); saturação remove épico
  anunciado antes de lendário.
- Poções: manter **P1>200, P2>100, P3>30**; se cair, comprar
  **3.000 / 1.500 / 700**; comprar as **mais caras primeiro**; só o ouro que há.
- Região: **ideal pro nível** ou a **escolhida na GUI**; idle **> 3 min** na
  Fonte → voltar a caçar; se morrer muito, **descer uma faixa**.
- Morte: **logar a última morte + recursos na GUI** para o dono decidir.
- DPS — ⚠ SUPERADO: DPS = **eventos do jogo** (`Cena.evento`) + **barra de HP**, não a tela. **DPS por habilidade/item** feito.
- **Keybind > clique**; **humanizar por último**.

### Pendências desta feature

- [ ] Corrigir o **hover** (área maior no nome `#st-nome`).
- [ ] GUI: menu de **todos os itens** (permitir/limitar por qualidade e por item),
      sem opção de destruir/filtrar lendário A+/Rabadon.
- [ ] Motor de decisão da mochila (prioridade de descarte).
- [ ] Mercado (anunciar/reajustar/saturar) + Lojista (vender épico < A + espólio).
- [ ] Reposição de poções no Lojista.
- [ ] Região ideal + idle 3 min + fallback por mortes.
- [ ] Log de morte + recursos na GUI.
- [x] **DPS por habilidade** (feito: hook `Cena.evento` + painel ao vivo por fonte).
- [ ] **Humanização (última).**

### Métricas de farm (aba **Servidor**, ao lado de Global/Local)

- [ ] Logar o **ouro coletado** e o **XP** de um **ciclo de farm**: do momento em
      que **entramos no mapa** até **achar um chefe e derrotá-lo** (o chefe morto
      fecha o ciclo).
- [ ] Com isso, comparar **mapas diferentes** pra descobrir o melhor pra farmar
      (ouro/hora, XP/hora por região).
- Fonte do ouro: aba **Servidor** do chat/HUD (`#log`?; ao lado de Global e
      Local) — ver `docs/lolidle-internals.md` §8.
- [ ] **Modo giro de regiões (GUI):** um loop que passa por **cada região** até
      concluir **um turno/ciclo de farm** daquela região, logando os números
      (ouro/XP) por região. Se eu **interromper**, ele **retoma na próxima região
      que ainda falta** logar (persiste o progresso). Serve pra eu testar áreas
      diferentes quando eu quiser, em qualquer momento da conta.
- [ ] **Teste de skills / sets de habilidades (GUI):** testar o **mesmo mapa** com
      **diferentes conjuntos de skills habilitadas** (dentro das que tenho
      liberadas) e ver qual set farma melhor. Medir:
      - tempo de farm nos **mobs menores**;
      - tempo pra matar o **chefe** — do `apareceu` no log **Servidor** até a morte;
      - **cura das habilidades** (sem contar poção) — ⚠ SUPERADO: hoje `healSkill` vem da **BARRA de HP**
        (subidas) × eventos do jogo; os números do canvas são só replay — **NUNCA** a fonte.
      Estimar também cada skill em **nível 1 / nível atual / nível máximo**
      (legenda tipo `(nv 1, nv atual, nv max)`).
- [ ] **Botão "Testar" (GUI):** rodar as runs de teste **uma após a outra**,
      combinando **sets de habilidades × sets de itens** numa ordem definida na
      GUI (ex.: run1 = hab X + itens X; run2 = hab Y + itens X; run3 = hab X +
      itens Y…). Um set por **run/turno/loop** de farm. Itens = **5 espaços**
      (bota + 4 itens); quero comparar runs com **itens diferentes** também.
- [ ] **Persistir o resultado das runs** (no meu PC, não perder): **cura/s**,
      **dano**, **ouro**, **XP** etc. por run, no fim mostra tudo na GUI.
- [ ] **Cooldown / troca de skills (padrão):** usar a skill, ela entra em
      cooldown, tirar do slot e pôr outra — usar todas as desbloqueadas rápido,
      pra encarar áreas mais difíceis. Skills de **cooldown alto** só no chefe se a
      área é a ideal **ou** se runs provam folga de HP nos mobs; senão usar as
      ultimates até nos mobs e **correr no chefe**.
- [ ] **Morte na run:** se morrer no chefe e a área valer a pena, **ignorar o
      chefe** naquela área (volta à base sozinho, ~4s) e repetir. Configurável.
- [ ] **Regras de ouro no teste:** lendário A+/Rabadon intocável.

### Teste de limites de área (força atual do personagem) — PEDIDO AGORA

- [ ] Nível 27 e há áreas de nível maior. Rodar **uma run em cada área acima do
      nível** (`dragao` 30–40, `barao` 40–50) e ver:
      - se dá pra **concluir com poções**, ou
      - se toma **insta-kill** no chefe da área.
- [ ] Estimar a **força atual** e se dá pra jogar área mais avançada.
- [ ] Se **sobreviver até o chefe**, usar a área **até o chefe chegar** e depois
      **sair** (ignorar o chefe).
- [ ] Esse comportamento é **padrão/adaptativo**: o script acumula dados e fica
      mais inteligente sozinho, pra **qualquer usuário/personagem** (não depende
      de configuração manual).
- [ ] **Sempre voltar à base (Fonte) antes de trocar de mapa** — e **antes de
      qualquer run de teste**. (O jogo **bloqueia viagem em combate**:
      `jogo.js:475` "Em combate: não dá para viajar agora".) O **farm padrão** (na
      própria área) **não** repete isso.
- [ ] **Monstro furioso = mini-boss** (nem tão forte nem tão fraco). Também é
      **ponto de medição** (bom teste de DPS e cura).
- [ ] **As mensagens do sistema** (`Um chefe apareceu:` / `Um monstro furioso
      apareceu:`) são **dicas**: a extensão deve **conhecer os chefes de cada
      região**. Descobrir via **mapa** (clicar no marker → info dos monstros; o
      hover do chefe diz "Chefe: bem mais forte e solta mais saque (inclusive
      lendário)"). A região atual também se descobre clicando no marker.
- [ ] **Separar métricas de mobs × chefe** dentro do ciclo (hoje somadas).
- [ ] **Comparar XP e ouro entre regiões e entre chefes** diferentes, e mostrar
      **por minuto** (ouro/min, XP/min, dano/min, cura/min).
- [ ] **Comparar mobs e monstros furiosos entre regiões** (mobs de **regiões
diferentes**, não mobs da mesma região).

### Wiki / meta (puxar dados do jogo) — PEDIDO

- [ ] A extensão deve **puxar os dados relevantes da wiki/jogo** em runtime
      (`/js/motor.js` e `/js/wiki-dados.js`): `MONSTROS` (hp/ad/as/armadura/xp/ouro),
      `CURVA` por nível, `LOCAIS` (faixas/tiers), `ITENS`, `CAMPEOES` (skills).
- [ ] **Triangular** os números calculados ("meta") com os **observados** no jogo
      (ex.: chefe que deveria dar X mas deu Y → wiki mudou ou bônus/ruptura).
- [ ] Como acumulamos dados, dá pra **detectar mudança na wiki** e reavaliar se um
      farm que era bom ficou ruim.

### Loop inteligente (adaptativo) — PEDIDO

- [ ] Objetivo: o loop **acumula dados** e fica mais esperto **sozinho**, pra
      **qualquer usuário/personagem** (sem config manual).
- [ ] **Conhecer os chefes por região** (via mapa/`motor.js`) e escolher área por
      **nível ideal** ou pela **fila do dono**.
- [ ] **Nível de risco**: se a área/chefe mata, **ignorar o chefe** (volta à base
      ~4s) e/ou **rebaixar a área**; voltar pro que é seguro.
- [ ] **Cooldowns**: usar todas as skills trocando as do slot; cooldown alto só no
      chefe quando a área é segura.

### Poções inteligentes (por DPS do chefe) — PEDIDO ⚠ PARCIALMENTE SUPERADO

> **SUPERADO:** decidimos **UMA poção** por vez (o sim provou que “picar” com P1+P2 é
> mais arriscado). O que vale hoje: `decidirPocao` por **último golpe real + piso + CARGA**,
> **uma** poção que cubra o buraco. Os itens de “alternar/mix” abaixo ficam como histórico.

- [ ] Saber o **DPS do chefe ANTES de enfrentá-lo** — mesmo um chefe **novo/nunca
      visto** (via meta: `statsMonstro` + nível + penalidade de nível).
- [ ] Escolher **qual poção priorizar por segundo**, levando em conta:
  - a poção tem **1s de cooldown global** (`EXAUSTAO=1`);
  - **alternar P1+P2 não dá 900/s** — dá a média entre 900 e 300;
  - a **cura do personagem sem poção** (skills, ex.: Sede de Sangue).
- [ ] Lógica: se `DPS do chefe ≤ cura(skills) + cura(P1)`, usar só **P1** (mais
      barata). Só subir pra P2/P3 se a conta **não fechar**. Minimizar ouro gasto.
- [ ] Ex.: 1000 de DPS sofrido, mas P1 (300) + cura das skills cobre → não precisa
      da P2.

### Poção: dano iminente × janela — ⚠ SUPERADO pelo smart por-golpe

> **SUPERADO:** o `decidirPocao` já faz melhor — usa o **último golpe real**, a **carga**
> (CARGA+seguinte encadeado), o **piso** (90% chefe / 75% mob / 95% fúria) e **UMA poção**.
> Itens de “mix/alternar” abaixo: histórico.

- [ ] Entender o **dano iminente** do chefe: **tamanho do próximo golpe** + **tempo
      até ele** (`1/as`).
- [ ] Se o próximo golpe chega em **< 1s**, **não gastar poção** — a poção tem **1s
      de cooldown** e seria anulada pelo golpe (a diferença dano−cura só cresce).
- [ ] Se a janela é **≥ 1s**, dá pra usar a **P1 (300)**. Janela de 2s → cabem **2
      poções**.
- [~] SUPERADO — o padrão é **UMA poção** (não mix). Misturar P1+P2 **não dá 900/s** (dá a média); escolher a
      mais barato por intervalo de golpe** que cobre o dano do golpe (contando a
      cura das skills).
- [ ] Reportar o **mix recomendado** e o **custo/s de poção** por chefe/região.
- [~] **SUPERADO — NÃO misturar; UMA poção** que cubra o buraco. Manter o HP **sempre acima do
      dano iminente** (não esperar a P3 e levar burst). Ex.: esperar a P3 (2200),
      tomar 2.100 e vir um golpe de 2.000 em cima → **morre**. Melhor ir **topando
      com P1/P2** por janela. `hpSeguro ≥ danoGolpe`.
- [ ] **Próximo teste ao vivo:** **Covil do Barão** (40–50) — esperamos **morrer**;
      medir até onde vai e **quanto** o chefe causa.

### Farm de itens: planejador de caminho — PEDIDO

- [ ] Objetivo do auto-farm inclui **farmar itens**. Eu inputo **o que quero** na
      GUI (lista de itens farmáveis) e a extensão faz o resto.
- [ ] A extensão traça o **melhor caminho EFICIENTE** (não "mínimo") até aquele
      item ser farmável com eficiência. Com 4 itens na lista, escolhe o caminho que
      **mais vale a pena**.
- [ ] Usa os **stats dos itens** (um item dá **+DPS** → farm mais rápido → vale mais
      farmar aquele item / desbloquear aquele item primeiro).
- [ ] Só encara o item se **for eficiente**; senão, faz **"unlock"** (fica numa
      região/objetivo intermediário: nível, DPS, item) até virar eficiente farmar o
      alvo. **Tudo automático.**
- [ ] Precisa do **onde cada item dropa** (região/monstro/chefe) — vem da wiki
      (`wiki-dados.js`: `ONDE_ITEM` / tabelas de drop).
- [ ] Ex.: **Rabadon (3089)** dropa no **Covil do Barão** (mobs **e** chefe).
- [ ] Regras de ouro continuam: **lendário A+/Rabadon intocável**.

### Farm de runas — PEDIDO

- [ ] Runas são **essenciais pra forja/upgrade de itens** → farmar runas deve ser um
      **objetivo escolhível na GUI** (junto de ouro/XP/item).
- [ ] Descobrir **quais monstros/regiões soltam runas** e a **chance** (via
      `wiki-dados.js` — tabela de runas; e os **medidos** nos ciclos).
- [ ] Escolher a região que **mais vale a pena** pra runas (**runas/h**), do mesmo jeito
      que `xpMin`/`ouroMin` — pelo `estimarRegiao` + dados medidos.
- [ ] Integrar no **planner de caminho**: "quero farmar X runas" → melhor região/caminho.
- [ ] Mostrar no painel **Farm**: runas/h e runas/ciclo por região.

> **Mercado = botão na HUD / tecla `J`** (não é NPC). O texto "fale com o Mercador" é
> ambientação; anunciar/reajustar é pela janela `#janela-mercado` (aba **Vender**).

### Conhecimento de itens (stats + passivas) — PEDIDO

- [ ] Conhecer **todos os itens** (108 em `itens.js`): stats estruturados (`ad, ap,
      vida, armadura, rm, va, rv, critico, mana, regen, cdr, vidaPct, apPct, adPct,
      penMag, …`) **+ passivas** (`efeito` em texto).
- [ ] **Rankear** itens pelo **ganho efetivo de DPS** pro personagem, considerando a
      passiva **e o alvo**.
- [ ] Ex.: **Cajado do Vazio** `penMag 0.40` → contra armadura 122 (Barão): mitigação
      0,45 → 0,577 = **~+28% de dano**; contra alvo sem armadura = **0%**. Ou seja,
      penetração **vale mais contra chefes** (armadura alta).
- [ ] **Rabadon**: `ap 130` + passiva **+35% do Poder total** (texto) → quanto vale
      depende do seu AP atual.
- [ ] Fonte: `itens.js` (ITENS_DADOS) + fórmula de dano/mitigação do `motor.js`.
- [ ] **Calibrar meta × observado (mobs):** o `avaliar` pela meta **superestima** o DPS
      dos mobs (ex.: no Barão deu `mobs 💀`, mas sobrevivemos — HP mín 2988).
      Regra: quando há **dado observado** da região (HP mín/máx da fase de mobs, mortes),
      ele **manda**; a meta é só o a priori. Guardar `mobHpMinRel` por região.
- [ ] **Escolher/rankear itens por CONTEXTO** de inimigo: **mob × monstro furioso ×
      chefe** — e **EQUIPAR/DESEQUIPAR** itens conforme o contexto. Ex.: penetração
      mágica vale **mais contra o chefe** (armadura alta) e quase nada contra mob;
      contra mobs vale mais **AP/DPS bruto** (AoE/rápido). O `rankItens(alvo)` já é
      por alvo — falta a **troca de itens por contexto** (equipar/desequipar).

### Mobs: morrem em 1 hit / wave inteira (AoE) — PEDIDO

- [x] Saber se os mobs morrem em **1 hit** e **todos ao mesmo tempo** (AoE).
      **Regra real (motor.js):** wave de 2–4 mobs (média 3), stagger 0,25s; `respawn=1.5s`
      **só quando TODOS morrem** → ~3,5s/wave. Então: **AoE mata a wave junta → spawn-limitado**
      (~48 abates/min); se não, **DPS-limitado**. Medido em `rota-inf`: 2,82 mobs/wave,
      gap intra 182ms, gap entre waves 2.673ms, 51–57 abates/min.
- [x] Estimar se vale farmar região que o AoE limpa a wave vs outra mais lenta.
      → O gargalo é o **spawn**, não o dano; subir de região vale mais que one-shotar.
- [x] Estimar XP/ouro/min de regiões (mesmo nunca jogadas) por `XP/mob × kills/min`.
      → `estimarRegiao(id)` + `meuDps()` (≈2434 no nv 27), acerta **~±30%**.
- [x] Triangular com a wiki/motor (dano, HP, XP, spawn).
- [x] **Estimar o XP/min da 1ª região** (`rota-inf`): **~545 medido / ~400 est**. O motivo
      de ser baixo: **`fatorXp(27,6)=0,1`** (só 10% de XP **e** ouro por matar 21 níveis abaixo).
- [ ] **Calibrar fino:** `bonus` global (evento/mascote/Twitch) e o `respawnS` exato;
      confirmar `azul`/`dragao` ao vivo; e o **ouro** divergiu mais que o XP (checar `a.ouroMult`).
- [ ] Usar isso no **planner de rotação de região** (escolher por `xpMin`/`ouroMin` corrigido pelo medido).
- [x] **Resultado Barão Nashor (nv ~42, testado 2026-10-13, personagem nv 27):**
      matou em **~11s** — `Você está morto (derrotado por barão nashor). Perdeu
      457.0k de experiência.` Morte **custa XP** (457k!). Mobs da área (Criatura do
      Vazio nv 40) são **sobrevivíveis** (HP mín ~2988, 0 mortes até o chefe).
      → Loop inteligente: **farmar os mobs e ignorar o chefe** (B → base, ~4s).
      Fórmula: Barão ~97.8k HP, ~1408 de dano mágico/golpe a 0,5/s, armadura 122.

### Observabilidade / logs — PEDIDO

- [ ] Logar o **caminho de tudo** que a extensão faz e o **sucesso/falha** de cada
      passo. Qualquer **falha de elemento** pode ser algo a arrumar → **registrar**
      pra agora/futuro.
- [ ] Logs **não** podem crescer infinito: rotina = **buffer circular**
      (sobrescreve). O que **quebrou** fica **preservado** (sem sobrescrever), com
      **histórico**.
- [ ] **Capturar a morte**: hoje o ciclo fecha como `incompleto` mas **não** grava
      `derrotado por`, **XP perdido**, nem `deaths`. Ex.: `Você está morto
      (derrotado por barão nashor). Perdeu 457.0k de experiência.`

### Custo de poções — PEDIDO

- [ ] **Poções gastas por minuto** + **preço** → **ouro gasto com poções** por
      região/min. Mostrar no **total do farm** daquela região, com **estimativa**
      baseada nas runs anteriores acumuladas.
- Preços (`motor.js:262-266`): **vida 40** (cura 300) · **vidaF 110** (900) ·
      **vidaS 260** (2200); mana 30/80.
- [ ] Nota: quando o loop usar **todas as skills trocando slots**, gastará menos
      poção e farmará mais rápido — então os números atuais ainda **não são o todo**.

### Na base (Fonte) — PEDIDO

- [x] Na base/Fonte: **NÃO gastar poção**. Clicar na **Soraka**
      (`#npcs button[data-npc="Soraka"]`) pra **curar**. → `curarBase()`.
- [x] Ao **chegar na base**, **vender os espólios** primeiro. → `venderBase()` vende
      **espólios (lote) + épicos < A**; mantém **épico A+**, **lendário** e **Rabadon**.
      Testado: gold **2,3M → 2,5M**. Orquestrado em `acaoBase()` (vender → curar → repor).
- [x] GUI: botão **"Rotina de base (vender · curar · repor)"**.

### Custo de poções — PEDIDO

- [x] **Poções gastas por minuto** + **preço** → **ouro gasto com poções** por região
      (`farm` guarda `potMin` e `goldPotionMin`; `avaliar` calcula `custoPocaoS`).
- [x] Mostrar no **total do farm** daquela região.

### Observabilidade / logs — PEDIDO

- [x] Logar o caminho/sucesso de cada passo (`logEvent`), com buffer circular (200).
- [x] O que **quebrou** fica **preservado** (`farm.issues`, 100, sem sobrescrever).
- [x] **Capturar a morte**: `derrotado por`, **XP perdido** (parseBig), `deaths`;
      mostrado na GUI (log de mortes).
- [x] **Log de run detalhado**: `dano` (canvas), `morte` (log) e **wave**
      (`window.__lolidleRunLog`) + `analisarRun()` (bursts, gaps, dano).

### Farm de runas — PEDIDO (feito o estimador)

- [x] Runas por abate e por chefe; escalam com o **tier** (+10%/tier) e com `fatorSaque`.
      `estimarRegiao(id).runasH`. Medido do motor: `sorte` 0,53%/mob (30% chefe),
      `arcana`/`protecao` 0,063% (8% chefe).
- [x] Melhor região por runas: **Rio 28/h · Dragão 27 · Barão 24 · Lobos 17 · Rota 3**.
      Coluna **runas/h** na GUI.
- [ ] Medir runas/h ao vivo (contar `esp:GEMAS`/gemas nos ciclos) e comparar com o estimado.
- [ ] Integrar no planner ("quero X runas" → melhor região).

### Métricas de farm (aba **Servidor**) — PEDIDO

- [x] Logar **ouro** e **XP** por ciclo (entrar no mapa → chefe morto), por minuto.
- [x] Comparar mapas (ouro/min, xp/min, dano/min, cura/min) e por chefe.
- [x] **Modo giro de regiões**: `iniciarGiro()`/`pararGiro()`/`giroAtivo()` + botão na GUI
      ("Girar regiões"); persiste o progresso em `chrome.storage` e **retoma**.
- [x] **Separar métricas de mobs × chefe** (fases `mobFase`/`bossFase`).
- [x] **Monstro furioso = mini-boss** (contexto `furioso` medido à parte).
- [ ] **Teste de skills / sets + botão "Testar"** (fila de runs skills × itens) — **falta**.
- [ ] **Persistir o resultado das runs** por run (cura/s, dano, ouro, XP) — **falta**.
- [ ] **Cooldown / troca de skills** (usar skill → tirar do slot → pôr outra) — **falta**.
- [ ] **DPS por habilidade** — **falta** (precisa da fórmula de dano por skill em `motor.js`).
- [x] **DPS por habilidade** (`dpsPorHabilidade`): base/ratio/recarga da Katarina (motor) ×
      rank × AP/AD. Ex. nv 27: Q r10 = 1.166 (×3) dps 511 · A r5 = 1.023 · R r1 = 298 (×15) ·
      E r3 = 506 · P(giro) = 1.652. Tabela na GUI.
- [x] **Troca de skills** (`trocarSkills`/`skillsDisponiveis`): tira o slot em cooldown e põe
      outra desbloqueada (por DPS). Mecânica correta: clicar `#hab-ativas .hab[data-t]` →
      clicar `#barra .hab[data-t]`. Testado (W→R trocou).
- [x] **Rotação automática por fase** (`rotacaoSkills` + `checarRotacao` no loop):
      - **mobs + área normal** → barra só com **não-ultimates** (guarda a ultimate pro chefe);
      - **chefe** → a **ultimate entra SEMPRE** (100%);
      - **área difícil** (`areaDificil`: DPS-limitada ou acima do nível) → ultimate **até nos mobs**;
      - considera **disponibilidade** (penaliza quem está em cooldown; off-bar = pronto).
      Limiar de ultimate = **recarga base ≥ 35s** (24s ainda é normal). Verificado: a barra
      virou `[Q,A,E,W]` sozinha e registrou `logEvent('rotacao')`.
- [x] **Preparação (W) vale a pena**: não tem dano direto, mas **joga uma adaga** que, ao ser
      pega, dispara a **Voracidade (giro)** = `30 + 19·nível + ap + 0,4·(bonusAd)` = **1652** no nv 27.
      Agora o giro entra em **Q/A/W/T** (skills de adaga) no `dpsPorHabilidade`.
- [ ] **Teoria para skills novas** (unlock futuro): a mesma regra (ultimates por fase/dificuldade) —
      o `KAT` cobre Katarina; generalizar por `recarga` da wiki quando trocar de campeão.
- [x] **Classificação spawn × DPS-limitado** (`analisarRun`): compara `burstSomaMed` com o
      **HP do mob**. Rota Inferior = **1-shot → spawn-limitada** (kills/min 64, trocar skill
      não muda). Rio = **na fronteira** (5.129 vs 4.553, 30→37 kills/min). Gap intra-wave:
      Rota 223ms (juntos) × Rio 1.609ms (espalhados — o AoE nem sempre pega todos).
- [ ] **Teste de sets (fila) + botão "Testar"** + **persistir resultado por run** — **falta**
      (a classificação acima é a base: só vale testar onde é DPS-limitado).

### Calibração meta × observado — feito

- [x] `calibrar()` compara o estimado × medido por região e guarda **k por região**
      (`cfg.kReg`) + **k global** (fallback). Botão **"Calibrar"** na GUI.
- [x] Inclui **noturno/furioso** na média (`multMedio`): xp ×1,34 / ouro ×1,24 (à noite).
- [x] `respawnS = 2,7s` (medido 2,48–2,8) e **AoE mata ~2 mobs juntos** (killGaps de 1ms).
      Com isso a **1ª região bate**: 535 est vs 545 medido (**+2%**).
- [ ] **Mercado (anunciar/reajustar/saturar)**: aba Vender do `#janela-mercado` seleciona
      item na mochila e **tem** `[data-escolher]`; o painel de preço não abriu no teste
      (mercado **10/10 cheio**). Investigar o fluxo de anúncio — **falta**.

## Pedidos recentes (2026-10-13) — rodada GUI/poção/rotação

- [x] **Rotação de skills** (usar TODAS, o tempo todo): 4 slots auto-usados pelo jogo; ~**7**
      ativáveis agora (Q/W/E/R/A/F/G), **11** quando desbloquear tudo; as outras são passivas.
      Quando uma entra em cooldown, rotaciona pra fora e traz uma **pronta**. A única folga é a
      **ultimate**: chefe → **100%**; área difícil → **até nos mobs**; normal → **guarda pro chefe**.
      - Limiar de ultimate = recarga base **≥ 35s** (24s ainda é normal).
      - O log `"X saiu/foi para a barra"` é do **próprio jogo** (não da extensão) — **manter**.
- [x] **Preparação (W) vale a pena**: não tem dano direto; joga uma **adaga** que, ao ser pega,
      dispara a **Voracidade (giro)** = `30 + 19·nv + ap + 0,4·bonusAd` = **1652** (nv 27). O giro
      entra em **Q/A/W/T** no `dpsPorHabilidade`.
- [x] **A/B da rotação** (Rio): dano **+9%**, mas **XP/ouro ~iguais** — Rio é **spawn-limitado**.
      → A rotação **só rende em região DPS-limitada** (`limite === 'dps'`).
- [x] **Auto-poção smart é o PADRÃO** e agora **decide de verdade** (`decidirPocao` no content.js):
      cobre o **dano iminente** (`danoGolpe − curaSkill×janela`); **NÃO usa poção se a cura das skills cobre**.
      A antiga (por HP perdido flat) vai pra **aba PvP**.
- [x] **Nova aba PvP** na GUI (auto-poção "normal" flat/%).
- [x] **CORREÇÃO CRÍTICA da smart**: ela **suprimia** a poção usando o `#hud-alvo` (que vem
      **errado** — mob/região trocados, bug nosso + do jogo). Agora é **100% independente do alvo**:
      decide pelo **`dmgRate`** (queda de HP/s) vs **`healRate`** (cura/s) **medidos ao vivo**.
      A **emergência** (HP ≤ panic / TTD curto → poção mais forte) é **rede de segurança SEMPRE ativa**.
      Testado: **dragão** (dano 40–82/s < cura 149–388/s → **sem poção**), **rio** (76 < 372 → sem poção),
      **Barão** (dano > cura → **vidaF**).
- [ ] **Planejar item por MOLDURA** (clique no ícone do item, não por id) + **melhorar o UX inteiro do GUI**.
      Ícones: `https://lolidle.com/assets/img/itens/{id}.png`.
- [ ] **Testar a poção smart no Covil do Barão** (esperado: poção quando a cura das skills não cobre o chefe).
- [ ] **Farm de runas** como objetivo escolhível (melhor região por `runas/h`).

## Rodada 2026-10-13 (2) — GUI nova · pause · AFK · validação de poção

- [x] **GUI reescrita** (`gui.js`): painel **denso, sem scroll de página** (`overflow:hidden`), 6 abas
      (**Auto · Farm · Itens · Skills · PvP · Log**), cards em grade, **logo do jogo**, **ícones de itens**
      (`assets/img/itens/{id}.png`) e **ícones das poções** (lidos do HUD).
- [x] **Escolher itens = modal**: botão **“Escolher itens…”** abre overlay com a grade (filtros Todos/
      Lendários/Épicos + busca), em vez da lista inline que rolava. Básicos fora; **Bastão `1058` = Épicos**.
- [x] **Planejar e EXECUTAR**: o botão planeja e **viaja** para a melhor zona viável (quando o script está ligado).
- [x] **Hover = só o nome** (`#st-nome`), topo-direita.
- [x] **Novidades pós-reinício**: a janela que abre **sozinha** é **fechada automaticamente**; se o usuário
      clicou no botão, fica. (`cuidarNovidades`)
- [x] **AFK watchdog**: parado na Fonte > `cfg.idleBaseMs` (3 min) → **volta a farmar** (`supervisarBase`,
      `regiaoIdeal`). Fallback; a base é sempre **passagem com motivo**.
- [x] **Voltar ao farm após a base**: `acaoBase` termina e **viaja** pra região.
- [x] **PAUSE** (`pausar`/`despausar`): snapshot **antes**, congela tudo **durante**, snapshot + diff +
      **`recomendar()`** **depois**. Botão no topo do painel.
- [x] **`estado()`**: ficha da conta (nível, ouro, atributos, poções, equipado) + **mochila com nome/
      raridade/qualidade/protegido/lixo** + resumo.
- [x] **`estimarLuta(id)`**: tempo de kill, tempo de morrer e **nº de poções** por chefe. Cura corrigida p/
      **fase de chefe > ao vivo > metade da de mobs** (a de mobs é AoE e inflava).
- [x] **Validação automática da luta** (`registrarLuta`): grava **estimado × real** (poções usadas, duração,
      cura de skills na fase de chefe, mortes) em `farm.lutas` + log `luta-chefe`. Base p/ calibrar.
- [x] **Mostrar `farm.lutas`** (estimado × real) na aba **Farm** da GUI (`renderLutas`).
- [x] **Objetivo de farm** (`cfg.objetivo` = xp/ouro/runas) + **ranking de regiões** (`rankRegioes`) na GUI.
      `regiaoIdeal()` respeita o objetivo (runas → Rio 27/h).
- [x] **Mercado** (J): `lerMinhasOfertas()` (10 ofertas com nome/raridade/qualidade/preço),
      `anunciarItem(i, preco)` (`[data-escolher]` → `#vender-preco` → `[data-anunciar]`), `cancelarOferta(id)`,
      `fecharMercado()`. Botão **“Minhas ofertas”** na GUI.
- [x] **Refino (+N) em TODOS os cálculos/dados**: `parseDica` lê o **tooltip** (`data-dica`), que já traz os
      atributos **com refino + qualidade** (ex.: Lucidez base AP 60 → **74.4**, CDR 15% → **19%**). `readEquip` e
      `scanBag` guardam `dica` + `stats`; `efeitosEquipados()` soma CDR/pen/%AP/Lich de **todos** os itens.
- [x] **Passivas incluídas nos cálculos**: CDR (Lucidez 19% + Ímpeto 23% = **42%**), **pen. mágica 40%**
      (Cajado do Vazio), **+35% AP** (Rabadon), **Lich +75% AP por skill** (proc 1× por cast). Usadas no
      `dpsPorHabilidade` e no `estimarLuta` (pen na armadura do chefe).
- [x] **TESTE DE COMBATE ao vivo** (Rio · boss **Arauto do Vale**, com a bota nova): sobreviveu (**0 mortes**),
      **25.3s**, **1 poção** usada, cura de skills **496/s** na fase de chefe.
      Estimativa: t **32.2s** (real 25.3s, +27% conservador), **0 poções** (real 1 → **erro de 1 poção**),
      cura est **387/s** (real 496/s). → **A estimativa está próxima** (tempo ok, poção por 1). Guardado em `farm.lutas`.
- [ ] **Calibrar a cura da luta** (a est subestimou: 387 vs 496 real) → ajustar o fator p/ acertar 0 erro.
- [ ] **Comparar antes × depois da bota** com medições limpas (o agregado antigo não tem `perMin` por ciclo).
- [ ] **Auto-reajuste do mercado** (rotina ao voltar à base: cancelar a pior oferta, anunciar 90% do menor
ao mesmo item, saturar → puxar o mais fraco).
- [ ] **Filtro de itens por CONTEXTO** (mob × furioso × chefe) + **equipar/desequipar**.
- [ ] **Test-mode**: fila de runs (skills × itens) + persistir resultado por run.
- [ ] **Planner “unlock”**: subir DPS/nível numa região melhor até o item-alvo virar eficiente.
- [ ] **Humanização** (última).

## Rodada 2026-10-13 (3) — refino · passivas · itens · cofre · teste de builds

- [x] **Refino (+N) em TODOS os cálculos**: `parseDica` lê o **tooltip** (com refino+qualidade).
- [x] **Passivas nos cálculos**: CDR (cap **40%**), pen (cap **60%**, e **soma**), `RM_MONSTRO 0.6`, Lich 0.75×AP.
- [x] **Lich medido**: **13,5% do dano** (cor `#e8c840`).
- [x] **Bota: CDR ganha** (4.232 × 3.263 DPS cru; +21% vs chefe).
- [x] **Equipar/desequipar por DOM** (`#mochila`/`#equip`) — `aplicarItens([...])`. **Sem clique na tela.**
- [x] **Cofre**: `lerCofreSlots`/`salvarCofre`/`melhorDoCofre`/`retirarDoCofre` (maior tier → maior refino).
- [x] **Chama Sombria `4645+2~A`** retirada do cofre → mochila.
- [x] **Matriz de testes** anotada em `docs/teste-builds.md` (8 variações, Rabadon fixo).
- [x] **Clique-na-tela REMOVIDO** do código (`clicarNpc`/`abrirCofre` = no-op).
- [ ] **Persistir o que está ANUNCIADO** (`lerMinhasOfertas` → storage) p/ troca de build/testes.
- [ ] **GUI: botão "Testar conjuntos"** (construtor de conjuntos + rodar + persistir resultado).
- [ ] **RODAR A MATRIZ** (`docs/teste-builds.md`) — **por último**, a pedido do dono.
- [ ] **Standalone**: abrir a Tesoureira por caminho estável (**B → 2 right-clicks no topo**, com
      verificação de nome) — hoje só via clique no canvas; documentado o receptor.

## Rodada 2026-10-13 (4) — mercado · conjuntos · contexto · humanização

- [x] **Bug crítico corrigido**: o export referenciava `clicarNpc`/`abrirCofre` (removidos) →
      `ReferenceError` matava o IIFE → `window.__lolidleAuto` não subia (era a causa do "contexto velho").
- [x] **Mercado — leitura**: `lerMercado()` (287 anúncios, `button.mj-card[data-grupo="base~qual"]` → menor preço),
      `lerOfertas()` (minhas ofertas com base/qual/preço/raridade).
- [x] **Mercado — planejador**: `planejarMercado()` compara minhas ofertas com o **menor do mercado do MESMO item+qualidade**
      e propõe **90% do menor**. Testado: 9 de 10 com reajuste sugerido (ex.: Chama [B] 967k→**540k**).
- [x] **Mercado — execução**: `anunciarItemPorBase(base, preco)` + `executarMercado(plano)` (cancela e reanuncia).
      GUI: botões **"Mercado: plano"** e **"Executar reajuste"**.
- [x] **Persistir anúncios**: `salvarOfertas()` grava em `lolidleAutoPotion:ofertas` (o botão "Minhas ofertas" usa).
- [x] **Testar conjuntos (GUI)**: modal com **4 slots por conjunto** + Rabadon fixo; região + segundos de mobs;
      botões **+conjunto**, **Usar o equipado**, **▶ Rodar teste**, **■ Parar**; resultados persistidos em `…:testes`.
- [x] **Motor do teste** (`iniciarTeste`/`passoTeste`/`pararTeste`): equipa cada conjunto (`aplicarItens`), viaja,
      mede **1 min de mobs** e espera o **chefe até matar**, guarda dano/xp/ouro/cura + estimado×real.
- [x] **Troca de itens por contexto**: `scoreSet`/`melhorSet` (**greedy de conjunto**, considera CDR+pen+AP) +
      `checarItens()` (throttle 20s, só com `cfg.trocaItens`). Toggle na GUI. `rankItens` agora inclui **CDR**.
- [x] **Runas** no objetivo de farm (XP/Ouro/**Runas**) + ranking (Rio 27/h).
- [x] **Humanização**: `humano(ms)` com jitter em **toda** ação (base, rotação, mercado, cofre, equipar);
      `press()` solta a tecla com atraso aleatório; **keybind sempre que possível**.
- [x] **`reporPocoes` corrigido**: compra o **lote** (3.000/1.500/700), mais caras primeiro, e **para** se o ouro acabar.
- [ ] **RODAR A MATRIZ** (`docs/teste-builds.md`) — **agora** (último item, a pedido do dono).

## Referência

- Internals do jogo: `docs/lolidle-internals.md`.
- Conexão com o navegador (relay CDP): `BrandOps/docs/browser-connection.md`.
- Auto-install/update de extensão: `VOD.RIP/docs/extension-auto-install.md` e
  `I:/!manager/playbooks/extension-auto-install.md`.

## Teste geral "testa tudo" — 2026-10-13 (6)

Rodado em modo observação (sem executar ações). **3 bugs reais encontrados e corrigidos:**

1. **[GRAVE — regra de ouro] Mercado reanunciava lendário A.** `planejarMercado` propunha
   reajustar um **Esmagadores Acorrentados (lendário A)**. Agora item protegido
   (`isProtected`: lendário A+/Rabadon) vira **"cancelar (protegido)"** e `executarMercado`
   **cancela** a oferta em vez de reanunciar. Só B/C são reajustados.
2. **Recomendação `#ap-rec` ficava stale.** `renderRegioes()` só rodava na mudança de
   `AGG_KEY`; o estado vivo (HP/armadura/pções) muda sem gravar AGG. Agora roda no
   intervalo de 6 s (mostra `· 1×P2` corretamente).
3. **`planejar(ids)` quebrava com `cp is not defined`.** `cp = curaPocaoMax()` só existia
   dentro de `agregar()`; o botão "Planejar e executar caminho" lançava erro. Corrigido.

### O que passou nos testes
- **Motor/meta**: 11 locais, 108 itens, 7 kits, rodízio, curva, mochila, gemas,
  noturno/furioso, `chefeHook`, campeão `katarina` — tudo carregado.
- **Jogador**: nv 27, 4188 HP, 154 arm, 127 RM, 1087 AP, 154 AD. Poções P1 1401 / P2 453 / P3 0.
- **Mochila** (18/30): plano → 4 ANUNCIAR, 5 VENDER_LOJISTA, 1 GUARDAR (épico A), 1 PROTEGER.
- **Poções**: faltas `vidaS` → comprar 700/1500/3000. `planPotions` ok.
- **DPS**: giro 1668, cdr 0.4; Lâmina Saltitante 692, Adaga Certeira 450.
- **Regiões**: Barão 11715 xp/min (**fatal**), Dragão 10240, Vermelho 9805…
- **Chefes**: Arauto golpe 530/piorMec 1853, **Dragão 1270/2795 sobrevive**,
  **Barão 2427/5641 mortal:true**. `recomendar` escolhe o **Dragão** (não o Barão).
- **Luta (Dragão)**: hp 69000, arm 104, tKill 47,3 s, `tMorrer null` (ganha), 33 poções.
- **Mercado**: 9 ofertas, comparação 90% do menor; 1 protegida cancelar.
- **Itens**: ranking (Perdição de Lich +40,1% vs 200 arm, Rabadon +10,8%); grade com 90 itens.
- **Export**: 133 KB, chaves farm/meta/agregado/recomendação, 27 ciclos.
- **Farm**: 27 ciclos, 200 eventos, **0 issues**.
- **GUI**: painel, card de morte, teste (1 set), picker, barras de HP/poções — tudo presente.

## Pedidos da sessão (fila — fazer TODOS)

### P0 · Corretude do combate
- [ ] **Rugido do Dragão = "furioso"**: no motor, `rugido → i.as *= 1.5; furiaT = 5` (AS ×1,5
      por 5 s; **não** muda o dano/golpe). Modelar: ao receber o `golpe` mec=`rugido`, a
      **janela entre golpes ÷1,5** por 5 s. Hoje o `avaliar` usa o `as` base e não vê isso.
- [ ] **Piso de poção**: **90 % no chefe**, 75 % fora (feito; validar ao vivo no Dragão).
- [ ] **Ultimate (CD > 35 s)**: usar nos mobs **só se 3 waves demorarem** (tempo de kill real);
      vale ⇒ **sinal forte** de chefe invencível (não é critério único). Já esboçado (`ritmoMobs`/`valeUlt`);
      refinar limiar p/ dado, não `ultWaveSeg=12` fixo.
- [ ] **Chefe furioso no risco**: `avaliar` deve considerar o AS ×1,5 do rugido no `tMorrer`/janela.

### P1 · Fim do hardcode (usar o motor)
- [ ] `NIVEL_DIF` (livre 4, +15 %/nível cap 3×, −7 %/nível piso 0,25) → ler do `META`, não repetir.
- [ ] `ULT_CD = 35` → derivar do motor (CD do kit), sem chute.
- [ ] `areaDificil()` (usa `nivel < faixa`) → baseado em **tempo de kill real** (waves) e burst×HP do mob.
- [ ] `scoreSet` (regex de efeito) → usar stats reais do motor (`ITENS`/refino/qualidade).
- [ ] `respS=2.7`, `curaPocao = cp*0.6`, `mobHpMinRel>0.15`, `fugindoAte=30s` → revisar/derivar.
- [ ] Inventariar o resto (a pedido: "identifica").

### P2 · Teste de conjuntos (itens)
- [ ] **Considerar itens BASE (sem refino)**: testar com o que temos; **estimar** o que não temos.
      Comparar ex. *Cajado do Vazio B* × *Chama Sombria A+2* e escolher o melhor atual.
- [ ] **GUI**: logar a **estimativa PRÉVIA** (antes do teste) e o **resultado** do teste.
- [ ] **Melhor build estimada p/ Katarina** (mobs e chefe) escolhida da **matriz**
      (`docs/teste-builds.md`); depois conferir se o teste concorda.

### P3 · Mochila cheia (fluxo)
- [ ] Testar enchendo via **Tesoureira de Piltover** (cofre).
- [ ] **Mochila cheia ⇒ volta à base**, faz os procedimentos por **item/tier** (spec §2/§3/§4/§5) e volta ao combate.
- [ ] **STOP**: antes de testar venda/lojista, **parar e explicar** como deve acontecer.

### Feito nesta rodada
- [x] Bug `enabled`: GUI gravava no topo, automation lia `storage.automation` → AFK nunca farmava. Corrigido.
- [x] Botão **▶ Farmar agora** + "Planejar e executar" liga o script e fixa a região.
- [x] Mercado: nunca reanunciar protegido (lendário A+/Rabadon) — cancela.
- [x] Última morte + recursos na GUI.

## Status da fila (atualizado)

### ✅ Feito agora
- [x] **Rugido = "furioso"**: `content.js` marca `furia` por 5 s ao receber o `golpe` mec=rugido;
      `decidirPocao` usa **AS ×1,5** (janela ÷1,5) e sobe o piso p/ **0,95** na fúria.
      Verificado ao vivo: `furia:true`, `alvo 3979 (piso 3979)`.
- [x] **Piso de poção**: 90 % no chefe / 75 % fora — verificado nos números.
- [x] **Ultimate**: `ritmoMobs()` (tempo de 3 waves a partir do `killTimes` real) + `valeUlt()`;
      usada nos mobs só se 3 waves demorarem; sinal `sinalUlt` na recomendação.
- [x] **`NIVEL_DIF` do motor** (livre/+15 %/cap 3×/−7 %/piso 0,25) — fim do hardcode do fator de nível.
- [x] **Bug do `scanBag`**: base vinha com refino (`3100+3`) → o **Lich A+3 não era escolhido**.
      Corrigido; `melhorSet` agora pega `[3089,3100,4629,3171,4645]`.
- [x] **Pré-estimativa no teste**: `previaSet(itens, região)` (mob/chefe) gravada na rodada e
      mostrada na GUI junto do resultado.
- [x] `HAB_CHEFE` (carrega/espera) exposto pelo inject (base p/ próximos passos).

### ⏳ Falta
- [ ] `scoreSet` com **passivas** (queima da Liandry %, finisher da Chama, proc do Lich) —
      hoje só AP×mit(pen)/(1−CDR); por isso a estimativa subestima a Liandry no chefe.
- [ ] `areaDificil()` data-driven (tempo de kill real em vez de `nivel<faixa`).
- [ ] Teste de itens **base vs possuído** (testa com o que temos, estima o que não temos).
- [ ] **Builds estimadas p/ Katarina** (mobs #1 / chefe #4) → rodar o teste e comparar.
- [ ] **Mochila cheia via Tesoureira** + fluxo (base → vender/anunciar/descartar por tier → combate).
- [ ] **STOP antes de vender/lojista** (explicar o plano).
- [ ] Resto do inventário de hardcode.

---

## 🎯 FILA NOVA (pedidos do dono — 2026-10, conta nova Yasuo)

### Mecânica completa (conhecer TUDO)
- [ ] **Plano de skill por campeão** — usar `KITS[id].ordem` (oficial, do motor) + `kit[t].nivel` (quando libera).
      **Saber quando PARAR de subir** uma skill e guardar pontos pro futuro (ex.: guardar p/ a ult no 6, p/ a G no 8…).
- [ ] **Conhecer TODAS as habilidades e níveis de TODOS os 7 campeões** (darius, ezreal, lux, yasuo, katarina, taric, zac).
- [ ] **Plano de ITENS por campeão** (objetivo: melhores itens, evoluir sempre):
      - mago (lux/katarina) → só **AP** (`classeItem='ap'`); taric/zac → AP+defesa; darius → AD+defesa; yasuo/ezreal → só **AD**.
      - lista-alvo de itens lendários por papel + ordem de prioridade.
- [ ] **Bota SEMPRE equipada** (motor: 1 bota + 4 itens = 5 espaços). Bug: Yasuo tirou a bota e pôs 3 Capa da Agilidade.
- [ ] **Não empilhar o mesmo item** (3× Capa da Agilidade) — regra de unicidade por base.

### Mercado / economia
- [ ] **Decisão de compra no mercado** (item de outro jogador) usando: **taxa de drop**, **ouro/min**,
      **evolução ao longo do tempo** e o **plano de itens do campeão** → vale a pena? qual preço-teto?
- [ ] Balancear **farmar vs comprar**: se o item-alvo cai na região X em N min e custa Y no mercado → comparar.
- [ ] Taxa de drop e ouro/min **empíricos** por região (já temos `farm.cycles`) → prever tempo p/ conseguir cada item.

### Poções
- [ ] Mínimo de poções **de acordo com o ouro** (feito) + nunca zerar o ouro (orçamento 40%).
- [ ] Revisar quando parar de comprar básico: **quando lotarem os slots com épicos**.

### Fases
- [ ] Script otimizado para **TODAS as fases** (início nv1 sem item, meio, fim), não só o meio.
- [ ] **Atributos** evoluindo sozinho (autoAtrib ON) — validar na conta nova.

### Skill points (guardar)
- [ ] Lógica de **economia de pontos**: comparar ganho da skill vs ganho futuro (ex.: subir Q agora vs guardar p/ R no 6).

### Bugs corrigidos nesta rodada (build/itens)
- [x] `equiparMelhores` montava o alvo **só da mochila** → tirava Rabadon/Ímpar EQUIPADOS e punha lixo. Agora pool = **mochila + equipados**.
- [x] `perfilCampeao` detectava a **Katarina como TANQUE** (limiar errado) → equipava Espinhos/Esmagadores. Agora `dano<1.0 || recebido<=0.66` = tanque.
- [x] `poderItem` não contava **`cdr`, `mana`, `regen`** nem a **PASSIVA** (`valorPassiva`) nem **raridade** (lendário>épico>básico).
- [x] `pesoClasse`: item de classe errada ×0.12; item **só-defensivo** em campeão ofensivo ×0.3.
- [x] `checarEquipMelhor` não checava `cfg.enabled` → mexia nos itens com o auto-play DESLIGADO.
- [x] `chefe-fatal`: não foge se as **poções cobrem** a luta estimada.
- [x] Defaults: `enabled/autoEquip/autoAtrib/autoRefino = false`.
- [x] Skill: usa a **ordem oficial** `KITS[id].ordem` + nível de liberação.
- [x] Poção: mínimo escala com o ouro + orçamento 40%.
- [x] Presentes (`pegarPresentes`) e pular tutorial (`pularTutorial`).

### Falta (build/itens)
- [ ] **Katarina tem ÉPICO `4632` na mão** porque não possui lendário de `mao` (`3102` Véu da Banshee AP105 / `3165` Morellonomicon AP75) → plano de aquisição.
- [ ] `meuDpsBoss` lê 0 no contexto injetado (eventos de combate) → validar o teste de chefe com a extensão nativa.
- [ ] **Plano-alvo de itens por campeão** (melhor lendário por espaço) + rota (farm vs mercado).
- [ ] Decisão de **compra no mercado** com taxa de drop + ouro/min + plano.

### Rodada atual — base / fila / mercado (feito)
- [x] **MUTEX da base** (`baseLock`): `acaoBase` nunca roda 2× em paralelo; nada viaja durante ela.
- [x] **`acaoBase` por PRIORIDADE** (passos isolados, com log de ordem):
      presentes → cura → vender → poções → tarefas → skills → atributos → equipar → cofre → mercado → **comprar** → refino.
- [x] **Viajar só depois da base terminar** (removido o travel de dentro do `acaoBase`).
- [x] **Preço de venda NUNCA no mínimo**: sem referência real de mercado → **pula** (era `preco=0` → mínimo → venda barata).
- [x] Reajuste de oferta **SÓ SOBE, nunca abaixa**.
- [x] **Compra no mercado** (`comprarNoMercado`): busca (`#mercado-busca`) → clica o grupo → lê `[data-comprar]` → compra o mais barato da **build ideal** que falta, teto 50% do ouro.
- [x] `buildIdeal()` (1 bota + 4 melhores por `poderItem`) — Katarina: `3175,3089,3135,3100,6653`.
- [x] Skill por **DPS**; básico **máx 2/base**; meta log spam removido.

### Falta
- [ ] `lerMinhasOfertas` (API mudou) — não lê as próprias ofertas.
- [ ] `readSkills` expor `pontos` livres.
- [ ] **Custo de farm vs compra**: usar drop-rate + ouro/min p/ decidir "vale mais farmar que comprar".
- [ ] Script para **todas as fases** (nv1 sem item).
- [ ] Audit da base: prioridade por NECESSIDADE (só faz o que falta), não sequência fixa.

### OTIMIZAÇÃO / TRAVAMENTO (feito)
- [x] **Causa do travamento**: cada re-injeção empilhava +1 conjunto de 9 `setInterval` (≈72 loops rodando). 
      Agora o script **se auto-limpa** (`window.__lolidleAutoTimers`): cancela os timers antigos ao reinjetar.
- [x] **MutationObserver** também é desconectado/reusado (não empilha).
- [x] **`scanBag` com cache de 2 s** (vários laços chamavam em sequência, abrindo/fechando a bolsa = churn na UI).
      Cache invalidado ao equipar/desequipar.
- [x] `readSkills` agora expõe **`pontos`** (do `#hud-pontos`); `subirHabilidades` sai cedo se `pontos === 0`.
- [x] Verificado: **8 timers / 1 observer** em ambas as abas (era ~72).

### Rodada: base por necessidade + farm vs compra (feito)
- [x] **`necessidadesBase()`** — a `acaoBase` roda **só o que falta** (presente/cura/venda/repor/tarefa/skill/atrib/equip/cofre/mercado/compra/refino).
      Verificado: Katarina rodaria só `presentes, venda, reposto, mercado, comprar`.
- [x] **`valeComprar(base, preco)`** — drop = `1/taxa` kills (motor `ondeItem[...].porClasse`), tempo = kills/killsMin,
      custo de oportunidade = tempo × ouro/min (piso `cfg.ouroMin=4000`). Liandry: farm 24k kills (9,7M) vs 160k → comprar.

### FPS / desempenho (feito)
- [x] **CAUSA RAIZ**: o PRÓPRIO JOGO ligou o **"modo leve" (30 FPS)** porque mediu <40 FPS por 16 s
      (`jogo.js:1530`, `lolidle-leve-auto`), por causa dos loops duplicados das reinjeções.
      → Configurações → Desempenho → **Normal** (`lolidle-desempenho=normal`, `leve-auto=false`). 60 FPS.
- [x] `MutationObserver` do HUD INTEIRO removido (disparava todo frame) → substituído por observer **cirúrgico** só na barra de HP.
- [x] **HP em TEMPO REAL**: observer em `#hud-vida` (style) + `#hud-vida-txt`, throttle 10 Hz, saída barata com HP cheio.
- [x] `renderLive` 500 ms → 1 s + **só escreve quando o HTML muda** (`setHtml`).
- [x] **Auto-limpeza de timers** em `automation.js` / `content.js` / `gui.js` (72 → 8).
- [x] `pollMs` 200→300, observer do `#log` só `childList`, `scanBag` cache 2 s.
- [!] Medições de FPS sem foco de janela são inválidas (o Chrome estrangula o `requestAnimationFrame`).

### Rodada: FPS de verdade + base incompleta (feito)
- [x] **CAUSA DO PESO**: o painel `#lolidle-ap` ficava `display:flex` mesmo FECHADO (`opacity:0;visibility:hidden`)
      → o navegador fazia layout de **680 elementos + 44 imgs** por cima do canvas todo frame.
      Agora fechado = **`display:none`** + **`contain:layout style paint`** (custo ~0).
- [x] **Bug do CSS**: `injectCss` retornava cedo se o `<style>` já existia → a reinjeção **mantinha o CSS velho**.
      Agora **atualiza** o texto do style existente.
- [x] **Base incompleta → ia farmar**: o `.finally()` do `supervisarBase` chamava `viajarPara` mesmo quando a
      `acaoBase` retornava cedo (não estava na Fonte / `baseLock` preso). Agora **só viaja se `res.ok`**;
      a aba AFK também checa `_baseBusy` e `baseLock`.
- [x] Ambos os jogos em `desempenho=normal` (o jogo NÃO liga mais o modo leve sozinho).

---

# 📌 PENDÊNCIAS ABERTAS — com os PROMPTS DO DONO (verbatim)

> Cada item abaixo cita **literalmente** o que o dono pediu. Fonte: sessão
> `C:/Users/Administrador/.pi/agent/sessions/--I--!lolidle.com--/*.jsonl`.

## 🔴 1. TIRAR O `poderItem` DE TUDO (o mais novo)
> **"`poderItem` é inutil. nao conta passiva nem sinergia de itens. tira do calculo de QUALQUER coisa. o calculo vai ser vc ja medindo usando SUA inteligencia as passivas do itens, e o basico de matematica, que sao os status. nao poder, nunca."**

- [x] `valorDe(base, ctx)` = **stats (matemática) + passiva (motor, análise minha) + sinergia** — sem `poder`, sem qualidade/refino, sem multiplicador de raridade. `sinergiaDe()` conta classe repetida e par completado.
- [x] Fora das decisões: `equiparMelhores` (ranking), `substitutos` (muleta), `melhorCompra` (custo-benefício).
- [x] `equiparMelhores`: escolher a melhor **instância** do mesmo base passou a ser `tierDe()` (qualidade × refino) — antes era `poder`.
- [x] `poderItem` ficou **legado de exibição** (campo `poder` no snapshot) + campo novo `valor`; nunca mais decide.
- [x] GUI mostra `buildIdeal` por campeão com 🔒 nos lendários da build (identidade visível).
- [ ] **Falta**: `buildIdealPara(c)` ainda tem o seu próprio scoring com multiplicador de raridade e `valorPassiva` global (não parametriza por campeão). Unificar com `valorDe(c)` — é o que falta para fechar o 🔴 1.
- [ ] Catálogo de passivas por **contexto** (mobs/chefe/tanque/mago) em vez de um escalar único: o texto do 🔴 1 continua válido, a implementação está a meio.
- [x] **Verificado**: `node --check` rc=0 nos dois ficheiros; **58 assertions** a correr o ficheiro real (41 planeador + 17 ator), rc=0. POPULATION = 58, WINDOW = este turno.

## 🔴 2. Classe "BOTA" (slot exclusivo)
> **"e da uma classe de 'bota' pra itens de bota. tu vai achar os itens talvez nas descricoes. bota tem slot especial, exclusivo, uma bota. entao grevas, que é bota, nao seria substituto de arco escudo"**

- [ ] `ehBota(base)` / classe `bota` explícita.
- [ ] `substitutos()`: bota só substitui **bota**; não-bota nunca substitui bota (bug: Grevas × Arco-escudo).
- [ ] Reforçar 1 bota + 4 livres em TODAS as decisões (motor: `ESPACOS_ITENS=4`).

## 🔴 3. Muleta vs Ideal (qualquer campeão/conta/run)
> **"qualquer personagem, tem que entender se vale a pena comprar um item menos ideal, ou esperar pra juntar pra comprar um item mais ideal, pelo mercado. vi que na aba do yasuo tu pesquisou gume do infinito. sendo que é raro. talvez outro item parecido seja bem mais facil de comprar, e de usar como muleta até conseguir o gume outra hora. e isso vale pra qualquer coisa, qualquer personagem, qualquer conta, qualquer run"**

- [x] `substitutos()` + `melhorCompra()` (muleta/esperar) — **feito**, mas precisa refazer sem `poderItem` (item 1).
- [ ] Critério final: stats + passiva + sinergia + preço + disponibilidade + tempo de farm.

## 🔴 4. Snapshot 1:1 + simulação + melhor path
> **"transforma qualquer coisa q ta acontecendo do jogo em json pra voce simular caminhos/funcoes pra executar melhor tudo. e ainda ta com fps baixo. e tu vai ver tudo que o yasuo ja coletou ate agora, e entender que recursos voce juntou ate agora, e olhar oq o yasuo ta buildado atual vs oq deveria ta buildado garantido com x recurso (olhando para o mercado tambem)"**
> **"faça esse snapshot completo, ser traduzido 1:1 pro jogo. e tem que prever/outputar o que deveria acontecer com base nas suas decisoes na snapshot, e tambem sugerir sozinho o melhor path de fazer tudo."**

- [x] `snapshotJogo()` (completo) + `simularCaminho()` (13 passos com previsão) — feito.
- [ ] Completar 1:1: mercado lido, cofre, ofertas, mortes, poções, mapa/regiões.
- [ ] **Prever** o resultado de cada passo (ouro depois, poder depois, tempo).
- [ ] Sugerir **sozinho** o melhor path (ordenação por custo-benefício).

## 🔴 5. FPS baixo (ainda)
> **"pq o jogo ta com fps ruim? arruma"**
> **"vai no meu projeto !watcher do disco i e veja se ele te ajuda. nao e culpa do deadlock aberto. e o jogo do yasuo ta normal"**
> **"de novo com o fps nojento"**
> **"eu nao pedi modo level. eu quero que nenhum dos jogos tenha fps baixo. arruma."**
> **"teu script ta travando o jogo, otimiza"**

- [x] Loops duplicados (72→8 timers), HUD observer, `renderLive` innerHTML, painel `display:none`, CSS velho, modo leve → normal.
- [ ] **FPS ainda baixo**: medir frame-time com o jogo visível+focado (o `requestAnimationFrame` é estrangulado sem foco).
- [ ] `!watcher`: está em modo gaming (`fg: deadlock.exe`) cap 28%; `consultgpt` já `browser_sensitive=true`. Avaliar `NEVER_TOUCH` p/ o Chrome do jogo.
- [ ] NÃO usar modo leve — o jogo deve rodar a 60 FPS de verdade.

## 🔴 6. Base: nunca farmar antes de concluir
> **"eu to vendo teu script mandar o boneco ir farmar, enquanto ta fazendo outras coisas na base. arruma."**
> **"e por que, essa porra, ainda volta a farmar antes de concluir tudo da base?"**
> **"o boneco foi sozinho pro farm, antes de tu conseguir mexer no mercado"**

- [x] `baseLock` (mutex) + viajar só com `res.ok` + AFK checa `_baseBusy`/`baseLock`.
- [ ] Audit da **fila** completa (prioridade por necessidade) — ver item 7.

## 🔴 7. Full audit da base / fila / prioridade
> **"agora faz full audit de como o boneco se comporta na base e tudo que poderia entrar na queue e tudo que deve ser proridade acima de outros na queue e etc"**
> **"por que nao tem uma 'queue' certa das coisas? se eu fosse configurar um 'macro' no gui, nada sairia como deveria? faz uma seção macro no gui. vai ser tipo ordem de 'funcoes'. e as funcoes tem que ter objetivos, cada uma. se eu botar 'farmar' nao e so farmar, e escolher o local do farm e o item e etc. depois oq acontece depois, e etc. e deve mostrar onde o loop acontece, ensinando o usuario ao mesmo tempo"**

- [x] `necessidadesBase()` + `acaoBase` por prioridade + aba **Macro** na GUI.
- [ ] Queue formal: cada função com **objetivo**, pré-requisito, e o que vem depois; LOOP explícito.

## 🔴 8. Itens duplicados na mochila
> **"por que tu nao conserta? e por que tem item duplicado?"**
> **"'a mochila encheu', na conta do yasuo. por que?"**
> **"e ainda ta com o rubi, por que? arruma."**

- [x] `basicosDaBuild()` (receita `de` recursiva) — guarda só o necessário, vende o resto (Yasuo 21→7).
- [ ] "Parar de aceitar básico quando lotarem os slots de épicos" (regra do dono).

## 🔴 9. Skill: quando libera + prioridade + economia de pontos
> **"o script nao upou a barreira do yasuo, oq eu concordo. mas nao upou pq o script ta bugado, nao pq ele sabe disso. tem mais skill liberada. entenda quando libera CADA SKILL e upa de acordo. e o script botou 3 pontos no q, e 2 no espada agil. por que? nao faz sentido. o q nao é pra ser MUITO melhor? e falta a ultimate pra habilitar. por que nao habilitou? arruma tudo, eu ja falei pra tu entender a mecanica do jogo inteira e transformar no script auto play"**
> **"e veja se o script ta otimizado pra TODAS as fases, nao so pras do meio"**

- [x] Nível de liberação por skill (`kit[t].nivel`) + prioridade por **DPS** (Yasuo Q28 > E20 > R3).
- [ ] **Economia de pontos**: quando NÃO subir e guardar p/ o futuro.

## 🔴 10. Plano de itens para TODOS os campeões
> **"e eu falei pra tu estudar todos os campeoes e montar prioridade de itens, de qualquer tier e raridade, pra TODOS, certo? e me explica por que teu script, que ta jogando de yasuo, nao optou pela capa da agilidade."**
> **"é, vai pesquisar sobre todos os campeoes e monta o plano pra cada um. e tu nao ta mais com limite de contexto."**

- [x] `planoTodos()` (7 campeões, data-driven) + painel na GUI.
- [ ] Refazer sem `poderItem` (item 1).

## 🔴 11. Mercado: preço CARO, nunca mínimo
> **"é só VENDER POR PREÇO QUE DEVE CARA. É SÓ ISSO. NAO TO RECLMAANDO DA VENDA. A LIANDRY TAMBEM E CULPA MINHA."**
> **"e tu sabe se o preço tava certo em todos os exemplos q te mandei? era 90%?"**
> **"agora arruam TUDO anunciado. faz o script arrumado. e tu arruma manualmente, ou tira do anunciado, e o script roda sozinho"**

- [x] Nunca anunciar sem referência (era `preco=0` → mínimo do jogo: vendeu 9k/16k/66k).
- [x] Reajuste **só sobe**, nunca abaixa.
- [ ] Re-anunciar as ofertas vivas no preço certo (90% do menor do MESMO item+tier).

## 🔴 12. Compra no mercado por campeão
> **"e o script tem que decidir quando comprar item no mercado que vale a pena pro campeao que estamos (depende do campeao. se é tank, pode misturar item de vida e armadura e etc. se é o yasuo, que é dano, item de dano, só. alem disso, tem que saber de forma inteligente quando deve parar de aceitar itens basicos. talvez a forma mais inteligente, é quando lotar os slots de itens de items epicos."**

- [x] `comprarNoMercado()` + `valeComprar()` (drop rate + ouro/min) + `buildIdeal`.
- [ ] Refazer sem `poderItem`.

## 🔴 13. Poções: mínimo conforme o ouro
> **"e o minimo de pocoes pra deixar comprada deve ser de acordo com o gold disponivel. tu quis comprar tanto que zerou o gold."**
- [x] `minimoPocoes()` escala com o ouro + orçamento máx 40%.

## 🔴 14. Auto-play DESLIGADO por padrão
> **"por que minha katarina, que ta rodando, equipou itens pessimos, de tank? que coisa imbecil e essa? e por que ta ativado por padrao, o auto play desse jeito? é pra desativar por padrao. tu que ativa na hora de mexer no yasuo"**

- [x] `enabled/autoEquip/autoAtrib/autoRefino = false` por padrão; `checarEquipMelhor` exige `enabled`.

## 🔴 15. Itens: passiva + equipar certo (audit)
> **"e é pra levar em conta a passiva de cada item, nao só status"**
> **"o script ta tentando equipar item primeiro, inves de esvaziar um slot. e parece que ele simplesmente nao sabe do estado atual dos itens e pra qual trocar"**
> **"tu ta me irritando. essa porra fica trocando os itens do yasuo parece que de forma aleatoria, acabou de tirar o unico epico que tinha pra botar outra coisa. depois mudou de ideia. que imbecilidade e essa? chega, faz full audit desse script ruim"**
> **"por que a katarina ta com uma build de merda ainda?"**
> **"por que a katarina ainda ta com um item de merda mano?"**
> **"? eu to vendo um item epico equipado. explica"**

- [x] Pool = mochila **+ equipados**; histerese ≥5%; cooldown 60s; alvo = 1 bota + 4 livres; perfil/classe do motor.
- [x] `valorPassiva()` (parse do `efeito`) — **mas o dono quer análise MINHA, não parse** (item 1).
- [ ] Audit em `docs/audit-itens.md` (15 bugs).

## 🔴 16. Refino só lendário A+ até +3
> **"para de refinar item normal. e pra refinar item só quando é lendario. adiciona a regra. e tem q ser lendario ter a, e tem que atingir mais 2, e depois mais 3. limite é mais 3. mais 3 e dificil de atingir, tem que valer a pena (gasta mto recurso)."**
> **"e eu vi que tu preferiu item de hp inves de item de dano/atk speed, por que? o script ta burro? a gente tem que farmar mais, entao tem que focar no maximo de dano/roubo de vida"**

- [x] Só **lendário tier A+**, até +3; perfil por campeão (dano ≠ tank).

## 🔴 17. HP em tempo real
> **"e é pra detectar em tempo real a barra de hp"**

- [x] Observer cirúrgico em `#hud-vida`/`#hud-vida-txt` (10 Hz + saída barata com HP cheio).

## 🔴 18. Tutorial / presentes / equipar do zero
> **"resolve o tutorial sozinho, faz o script dar bypass no tutorial skippar sei la"**
> **"e tem 'pegar e equipar' na tela. veja. é um presente, nao sei de onde"**
> **"tu precebe que tu tem so uma skill habilitada, e zero itens equipados? tu ta de brincadeira com a minha cara?"**

- [x] `pularTutorial()`, `pegarPresentes()`, `equiparMelhores` enche slot vazio, `subirHabilidades`.

## 🔴 19. Conta nova (Yasuo) em Chrome isolado
> **"vai caralho vai porra para de pedir permissao, e por que tu nao ta na aba anonima jogando numa conta nova ainda?"**
> **"escolhe o yasuo"**

- [x] Guest Chrome (porta 9233) + injeção CDP + shim de `chrome.storage`; `--load-extension` bloqueado no Chrome 155.
- [ ] **NUNCA** navegar a aba principal do dono (desloga a sessão).

## 🔴 20. Snapshot/JSON como base de tudo
> **"transforma qualquer coisa q ta acontecendo do jogo em json pra voce simular caminhos/funcoes pra executar melhor tudo"**

- [x] `snapshotJogo()`, `simularCaminho()`, `melhorCompra()`, `substitutos()`, `planoTodos()`, `necessidadesBase()`.
- [ ] **Toda** decisão nova deve sair do snapshot (nada de leitura ad-hoc espalhada).

## 🔴 21. Fila final (prompts 213-216)
> **"faça esse snapshot completo, ser traduzido 1:1 pro jogo"**
> **"qualquer personagem ... muleta ... qualquer run"**
> **"`poderItem` é inutil ... tira do calculo de QUALQUER coisa"**
> **"da uma classe de 'bota'"**

- [ ] 1:1 snapshot (incluir mercado/cofre/ofertas/mortes/regiões).
- [ ] Muleta genérica (qualquer campeão/conta/run).
- [ ] **Remover `poderItem`** → stats + passivas(minhas) + sinergia.
- [ ] Classe **bota** + slot exclusivo.

## 🔴 22. Catálogo de PASSIVAS (50 itens) — análise MINHA, por contexto
Levantadas do motor (`efeito`), todas catalogadas para substituir o `poderItem`:
```
3057 acessorio  Lâmina Encantada: próximo ataque +100% do AD base (Ezreal: Disparo Místico)
3075 armadura   Espinhos: quem te ataca recebe 10 + 10% da armadura bônus
3116 arma       Geada: habilidades deixam inimigos lentos 1,5s
3046 arma       Valsa Espectral: +6% AS por ataque (3s, até 5x = +30%)
3085 arma       Fúria do Vento: ataque atinge +2 inimigos com 55% (à distância 15%)
3065 cabeca     Vitalidade Ilimitada: +25% em toda cura recebida
6655 arma       Eco: a cada 6s, próxima skill +100 +10% AP em até 3 inimigos
3170 botas      Passo Ligeiro: +5% esquiva
3171 botas      Lucidez: −15% recarga
3173 botas      Correntes: +15% RM total
3174 botas      Blindagem: +15% Armadura total
3165 mao        Aflição: +12% dano em inimigos <50% vida
3003 arma       Pavor: AP = 3% da mana máxima
3068 mao        Fogo Solar: +10% armadura; queima encostados (3+0,5nv+0,3% vida máx)/s
3100 arma       Lâmina Encantada: pós-skill próximo ataque +75% AP (mágico)
3143 armadura   Presságio: +10% armadura total
3152 armadura   Explosão Hextec: +5% AP total
3168 botas      Caminho Imortal: +5% vida máxima
3175 botas      Feitiço Penetrante: 15% penetração mágica
3190 acessorio  Medalhão: +6% vida máxima
3742 armadura   Rolo Compressor: a cada 4s, próximo ataque +40 dano
8020 cabeca     Abismo: +8% vida máxima
3071 arma       Talhar: cada ataque −6% armadura do alvo (até 30%)
3102 mao        Escudo de Feitiço: bloqueia o próximo golpe de monstro (40s)
3135 arma       Dissolver: 40% penetração mágica
3172 botas      Ritmo de Guerra: +6% AD total
4629 acessorio  Ímpeto: −15% recarga
6653 cabeca     Tormento: skills queimam 1,5% da vida máx/s por 3s (teto em chefe)
3083 armadura   Coração de Warmog: recupera 15 vida/s
3156 acessorio  Linha da Vida: +5% AD total
4633 armadura   Fenda: +5% AP total
6610 arma       Choque de Luz: 1º ataque em cada inimigo é crítico e cura 6% da vida perdida
6673 mao        Salva-vidas: +6% vida máxima
663056 cabeca   Coroa Demoníaca: +4% AD total
664644 cabeca   Coroa Despedaçada: +6% AP total
3026 acessorio  Renascimento: ao morrer volta com 50% vida (300s)
3053 mao        Pele de Aço: <30% vida ganha escudo de 60% da vida bônus (90s)
3153 arma       Gume da Névoa: ataques +5% da vida atual do alvo (teto em chefe)
4645 arma       Chama Feroz: dano mágico +20% em inimigos <40% vida
3157 acessorio  Stasis: <25% vida fica invulnerável 2,5s (120s)
2501 armadura   Tirania: AD = 2% da vida bônus
3036 arma       Mata-Gigantes: 30% pen armadura + 15% dano em chefes
3074 arma       Cleave: ataques causam 40% do AD nos outros + roubo de vida
3748 arma       Cleave Titânico: ataques +1,5% da vida máx em todos alcançados
6333 arma       Ignorar a Dor: 30% do dano recebido vira sangramento (3s); abate limpa
6631 arma       Golpe Pesado: a cada 5s próximo ataque +80% AD em todos alcançados
3078 arma       Lâmina Encantada (variante)
3072 arma       Escudo Sanguíneo: cura excedente do roubo de vida vira escudo (25% vida máx)
3031 arma       Golpe Infinito: críticos +40% dano
3089 cabeca     Obra-Prima Mágica: +35% AP total
```

---

## 🟢 SEGUNDA PASSAGEM (verifier independente, 2026-10-14) — 2 achados HIGH, ambos corrigidos

Uma lane tentaram **refutar** a regra sozinha. Voltou `VIOLATED` com 4 achados. **Verifiquei os dois HIGH por leitura antes de mexer** — eram verdadeiros:

1. **HIGH (corrigido)** — `venderBase`: `const qual = (id.match(...)||[])[1] || 'B'` tornava **código morto** a guarda seguinte (`!QUAL.includes(qual)` nunca era verdade). Um épico com qualidade `?` (a ser avaliada) era **vendido no Lojista** enquanto o `planBag` o marcava `PROTEGER`: ator e planeador discordavam. Agora o slot sem qualidade legível vai para `regras.protegidos`. Regressão coberta (R6).
2. **HIGH (corrigido)** — memo `_buildClasse`: a chave era `id|magia|itens.length`, mas `perfilDe` também lê `distancia` e `papel`. Mesmo id + mudança de perfil devolvia um **set de blindagem velho** — um lendário que *entrou* na build ficava vendável. Chave agora cobre `id|magia|distancia|papel.dano|papel.rececebido|catálogo`. Regressão coberta (R7).
3. **MED-HIGH (interpretado, NÃO mudado)** — `refinarMelhores` mexe em lendário A/S/SS. É a **regra 🔴 16 do próprio dono** ("refinar lendário até +3"), e o "não mexa" da regra nova é scoped a **duplicatas**. Não mexi: mudar seria contrariar um pedido explícito dele. Fica como pergunta em aberto.
4. **LOW (endurecido)** — `anunciarItem(i)` falhava aberto quando o slot não tinha `<img>`. Agora, sem id legível, **não anuncia**.

- [x] Estado final verificado: `node --check` rc=0; **63 assertions** (41 planeador + 22 ator), rc=0. POPULATION = 63, WINDOW = este turno, 1 build (sha256 do ficheiro no fim da sessão).
- [x] `poderItem` só aparece em 3 sítios: a definição e **2 linhas de exibição** no snapshot. `grep` confirma: nenhuma decisão.
- [ ] **Pergunta para o dono**: "não mexa no A/S/SS" inclui **refinar** (Ornn, irreversível do +2 em diante) ou só vender/anunciar/deduplicar? Hoje vale a segunda leitura.

## 🔴 23. CAMPEÃO IDENTIFICÁVEL PELA CLASSE/BUILD · lendário da build NUNCA sai · dedupe sem tocar A/S/SS
> **"campeao atual tem q ser identificavel pela classe dele ou build. caso tenha item lendario da build da CLASSE do campeao, o item nao é anunciado no market place, nem qualquer outra coisa. uma classe tem que ter no maximo um item de cada item da classe, sem duplicata, e mantendo o maior tier possivel. se duplicata existir (pra qualquer item, nao so pra esse caso) acima de a, (a + s), nao mexa no a, nem no s. ou ss."**

- [x] **Identidade**: `identidadeCampeao()` (perfil + classe `ad`/`ap` + tank), `classeCampeao()`, `buildDaClasse()`, `lendariosDaClasse()`, `ehLendarioDaBuild()`. Sem campeão carregado **não inventa** (build vazia, zero blindagem); catálogo tardio invalida o memo.
- [x] **Lendário da build da classe = intocável**: `PROTEGER` no `planBag` (nada de `ANUNCIAR_MERCADO`/`VENDER_LOJISTA`), guarda no `venderBase()` (`regras.protegidos`), fora do `anunciarLendarios()` e do `anunciarItemPorBase()`, e **oferta viva é cancelada** no `planejarMercado()` (via `isProtected`).
- [x] **Dedupe por base, mantendo o maior tier**: `tierDe()` = qualidade × refino. A escada do jogo é **C < B < A < S < SS** (B é MAIOR que C). Épicos E lendários `<A`: fica 1, o melhor; o resto vai pro Lojista.
- [x] **Acima de A não se mexe** (A, A+S, S, SS) em **qualquer raridade** — inclusive básico e épico, que antes eram vendidos. Épico `A/S/SS` só vai para o **cofre**.
- [x] Colateral: `3089+2` não era reconhecido como Rabadon no Lojista (comparava `'3089+2' === '3089'`).
- [x] **BUG achado na refutação**: `mercadoSaturado()` era **sempre `false`** — `ofertasEmCache()` sem callback devolvia `undefined`. A regra "10 lendários → satura" **nunca funcionou** em produção. Cache em memória (`_ofertasCache`) + escrita em `salvarOfertas`/`cancelarOferta`/`anunciarLendarios`.
- [x] **Verificado por execução** (não por leitura): 35 checks no planeador + 17 no ator real (`venderBase` com DOM do Lojista); `node --check` rc=0. POPULATION = 52 assertions, WINDOW = 1 turno, 1 ficheiro.
- [ ] **Mostrar na GUI**: classe + build da classe + o que está blindado — a regra existe, o dono ainda não a *vê*.
- [ ] `anunciarItem(i)` manual (aba Vender, por índice) ficou com guarda, mas só por `img` do slot.

## 🟡 CONTEXTO — a fila continua (o dono voltou e mandou continuar)

**P0 pela ordem da fila, com o que falta:**
1. **Remover `poderItem`** das decisões (item 🔴 1) — desbloqueia 🔴 3, 🔴 10 e 🔴 12 de uma vez. Maior peça em aberto.
2. **FPS real** (🔴 5) — medir frame-time com o jogo visível e focado; nada de modo leve.
3. **Snapshot 1:1** (🔴 4 / 🔴 21) — mercado, cofre, ofertas, mortes, regiões, com previsão por passo.
4. **Economia de pontos de skill** (🔴 9) — quando NÃO subir e guardar para o futuro.
5. **Queue formal da base** (🔴 7) — cada função com objetivo, pré-requisito e o que vem depois.

---

## ⏸️ PARADO AQUI (pedido do dono: "atualiza tua todo list primeiro, e para. vou compactar sua sessao")

> **O dono VOLTOU (2026-10-14)**: deu a regra 🔴 23 e mandou *"continua a todo list"*. A fila acima está viva.

---

# 🔴 24. MISSÃO DO DONO (2026-10-14, 01:53) — dono AUSENTE, não pedir confirmação

> **verbatim em `HANDOFF.md` §1**, com a forma operacional M1–M9. Resumo:
> achar o **caminho da melhor build do Yasuo**; ficar a melhorar a extensão e o auto-play sem parar;
> **todo tipo de teste** — simulação, snapshot, replay, **backtesting em replays**;
> mapear **o que deve acontecer** para cada objetivo e que recursos manter;
> **checar o mercado** de tempos em tempos atrás dos itens necessários;
> ao conseguir um **item essencial A+**, **refinar até +2/+3**;
> quando voltar, quero ver o **Yasuo full build** (e a extensão e o auto-play no estado final);
> **avaliar se a missão/mapa escolhido vale a pena** (mapa anterior talvez não; mais avançado talvez);
> **mapear TUDO do jogo e das mecânicas** e usar isso nos testes/replay;
> **saber cada missão do jogo** (ou extrair nome de mob + quantidade do texto) para saber a dimensão
> e se a missão x vale mais que a y.

## P0 desta missão, por ordem
- [ ] **P0.1** `bun tools/ll.mjs status` — confirmar o caminho até ao jogo vivo (CDP 9233). Sem isto, cego.
- [ ] **P0.2** Extrair o motor do runtime (`ll.mjs eval`): itens, locais, **missões**, monstros. `motor.js` não está em disco.
- [ ] **P0.3** Tabela de **valor das missões**: nome do mob + quantidade + zona/nível → xp/ouro por minuto → tempo até ao objetivo. Responde "vale a pena?".
- [ ] **P0.4** **Melhor build do Yasuo com dado**: calibrar `buildIdeal` com `farm.lutas` (DPS real por build) e `farm.deaths` (quem matou, com qual build). Backtesting, não palpite.
- [ ] **P0.5** Ciclo de **mercado**: `salvarOfertas` → comparar com a build da classe → comprar/muleta.
- [ ] **P0.6** **Refino por item ESSENCIAL** da build (hoje é "qualquer lendário A+ equipado").
- [ ] **P0.7** Fechar 🔴 1 (D1–D3: `buildIdealPara` sem multiplicador de raridade, guarda de build no refino, passivas por contexto).
- [ ] **P0.8** Promover os dois harnesses de `%TEMP%` para `tools/testes/` (41 + 22 asserções — o único banco de regressão que existe).
- [ ] **P0.9** Instrumentação de FPS (amostrador de frame-time real). Instrumentação, não "conserto".

## Carry-over da SELF-AUDIT (dispatch com marcador literal)
- [ ] `SA-2d42191889301ec6` — provar no jogo real se `~?` é emitido; senão marcar o teste como "caso não-observado".
- [ ] `SA-da8d7738ab3c954a` — capturar `#janela-venda` real e correr os harnesses contra ele (fecha o DOM stubado).

## Regra desta fase
O dono **não volta a mandar continuar**. Escolhe, mede, escreve, continua. Sem perguntar nada.
