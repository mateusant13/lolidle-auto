# Audit — lógica de ITENS (equipar / vender / mercado)

Data: 2026-10. Escopo: `extension/automation.js` (equipar, planBag, mercado) + `inject.js`.

## Sintoma reportado
Yasuo trocando itens **em loop** (tirou o único épico `3044` e depois voltou). Katarina
com build ruim (tank num campeão de magia) e Rabadon caindo do equipamento.

## Causas-raiz encontradas

| # | Bug | Onde | Impacto |
|---|-----|------|---------|
| 1 | **Alvo montado só da MOCHILA**, ignorando os EQUIPADOS | `equiparMelhores` | Tirava Rabadon/Ímpar EQUIPADOS e punha lixo da mochila |
| 2 | **Sem histerese**: qualquer diferença (1 ponto) dispara troca | `equiparMelhores` | Oscilação infinita entre dois sets |
| 3 | **Sem cooldown** (rodava a cada 10 s) | `checarEquipMelhor` | Trocava a cada 10 s |
| 4 | **Tie-break não determinístico** (`sort` por poder só) | `equiparMelhores` | Ordem instável quando poderes empatam |
| 5 | **Restrição "1 item por espaço"** (inventada) | `equiparMelhores` | Forçava épico ruim; o motor é **1 bota + 4 QUAISQUER** (`motor.js:2874 ESPACOS_ITENS=4`) |
| 6 | **Não checava `cfg.enabled`** | `checarEquipMelhor` | Mexia nos itens com o auto-play **DESLIGADO** (estragou a Katarina) |
| 7 | **`perfilCampeao` errado** (limiar pegava a Katarina como TANQUE) | `perfilCampeao` | Equipava Espinhos/Esmagadores numa maga |
| 8 | **`poderItem` ignorava `cdr`, `mana`, `regen`, PASSIVA e RARIDADE** | `poderItem` | Item lendário tank ganhava de item AP |
| 9 | **Item só-defensivo sem penalidade** em campeão ofensivo | `pesoClasse` | Espinhos (tank) entrava no lugar de AP |
| 10 | **`ordem` usada como prioridade de UP** — ela é a ordem de CONJURAR no combate (`motor.js:1590`) | `subirHabilidades` | Subia skill errada |
| 11 | **`planBag` mantinha TODOS os básicos** | `planBag` | Mochila enchia de tranqueira, `lixo=0`, nunca ia à base |
| 12 | **`acaoBase` mandava viajar 800 ms depois** sem esperar mercado/loja | `acaoBase` | Boneco saía no meio da operação |
| 13 | **`lerMinhasOfertas` → "cb is not a function"** | `lerMinhasOfertas` | Não lê as próprias ofertas |
| 14 | **`readSkills` não expõe `pontos`** (só `bar`/`arsenal`) | `readSkills` | Não dá pra saber se há pontos livres |
| 15 | **`chefe-fatal` fugia sem considerar as poções** | `checarChefeFatal` | Recuava no meio do dragão |

## Correções aplicadas
- Pool = **mochila + equipados**; melhor instância por base; **histerese ≥5%**; **cooldown 60 s**;
  tie-break por `base`; alvo = **1 bota + 4 quaisquer**; guard `cfg.enabled`; perfil/`pesoClasse`/
  `poderItem` data-driven do motor (stats + `valorPassiva` + raridade + `cdr`); skill por **DPS**;
  básico **máx 2/base**; viajar **só após `acaoBase` terminar**; **não fugir se as poções cobrem**.

## Validação
- Yasuo: 3× `equiparMelhores` → **0 trocas** ("alvo ≈ atual"), set estável `1001,1018,1036,3044,1042`.
- Katarina: build AP correta `3175 · 3135(pen40%) · 3089(Rabadon) · 3100(Lich) · 4645(Chama)`.

## Pendências
- [ ] `lerMinhasOfertas` (API mudou) — ler as próprias ofertas.
- [ ] `readSkills` expor `pontos` livres.
- [ ] Liandry (`6653`) da Katarina sumiu do inventário — investigar (foi anunciado? vendido?).
- [ ] Decisão de **compra no mercado** (drop rate + ouro/min + plano do campeão).
