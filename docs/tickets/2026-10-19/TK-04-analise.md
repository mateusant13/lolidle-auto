# TK-04 — Resposta com números: Luden como 4.º item, Ryze ideal vs ranking e as melhores 4 skills

**Write scope:** apenas `docs/answer-itens-ryze-skills.md` (documento novo). **NÃO alterar código.**
**Prioridade:** P1 (pergunta directa do dono).
**Origem:** `docs/todo-2026-10-19.md` §9 + checkpoint (Ryze, Luden, skills).

## Objectivo
Produzir uma resposta curta e defensável, com números **medidos no motor real** (`tools/harness.mjs`) e no catálogo ao vivo (`G:\Temp\opencode\itens-live.json`, `ranking-ryze.json`, `perfis-ryze.json`). Sem opinião.

## Perguntas a responder

1. **“O Eco de Luden é o melhor 4.º item?”**
   - Para a **Katarina** (conta actual, nv 32, AP 1194, CDR 0.23): comparar Luden (6655) com os candidatos reais no slot 4/5 (Lich 3100, Void 3135, Rabadon 3089, Crown 664644, etc.) usando `scoreSet`/`estimarSet` ou o harness.
   - Para o **Ryze**: idem, com o kit real (`P.maestria`, `fluxoBonus`), no Barão nv32.
   - Conclusão explícita: **sim/não**, e em que condição (farm multi-alvo vs chefe alvo único) ele ganha.

2. **Ryze: build ideal vs a build dos top-6 do ranking**
   - Builds já recolhidas (`G:\Temp\opencode\perfis-ryze.json`): 3175/3003/664644/3089/3135; 664644/3171/3003/3089/6655; 3089/3003/3171/664644/6655; etc.
   - Correr `node tools/harness.mjs lutar --champ=ryze --nivel=32 --alvo="Barão Nashor" --nv=32 --itens=... --maxSeg=120 --json` para cada uma **e** para a build ideal que o motor recomenda (`montarBuildDe`/`scoreSet`).
   - Tabela: build, AP, mana, CDR, pen, `mataSeg`, `danoRecebido`, `pocoesTotal`, `custoPocaoOuro`.
   - Explicar a diferença com a mecânica: por que Lich Bane (3100) ganha no Ryze (Q/W/E spam → proc a cada habilidade) e por que os top players não a usam (o ranking mede poder, não segundos até matar).
   - Confirmar com o harness números como: core sem Lich ~36,75 s; com Lich ~26,65 s; com Lich+Void ~25,7 s (repetir, não copiar; os valores podem mudar com o motor).

3. **Katarina: melhores 4 skills desbloqueadas**
   - Nível 32, barra actual Q/W/E/A, R rank 3 fora da barra.
   - Usar `barraIdeal` com a regra da ultimate (só chefe/fase difícil) e `dpsPorHabilidade` com `golpes/ticks/adagas` reais.
   - Responder: **Q/A/W/E** (ou o que o cálculo der), com o DPS de cada uma e por que a R fica de fora em mobs fáceis (recarga base > 35 s; `motor.js`).
   - Explicar o caso “removi uma skill e entrou o Shunpo”: é o 4.º por `dps × alvos`; a matemática escolhe, não a ordem da barra.

## Provas obrigatórias (colar no documento)
- Comandos `harness` corridos e a saída relevante (pode ser tabela resumida, mas com os números).
- `file:linha` do motor para cada mecânica citada (Lich, Luden, `P.maestria`, `adagas`, recarga da R).
- Uma nota final: “estes números foram lidos do motor em <data>; se o jogo mudar, o harness acompanha”.

## Critérios de aceitação
1. Documento `docs/answer-itens-ryze-skills.md` criado, em português, curto (máx. ~150 linhas), com tabelas.
2. Todos os números têm comando ou `file:linha`.
3. Nenhuma alteração a `extension/*` (prova: `git status --short` só mostra o doc).
4. Commit `docs: resposta Luden/Ryze/skills com números do motor`; **não fazer push**.
