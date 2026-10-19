# TK-02 — gui.js: mestre óbvio, switches reais, Painel em 2 colunas e região automática visível

**Ficheiro (write scope):** `extension/gui.js`
**Prioridade:** P1 (UX pedida explicitamente pelo dono)
**Origem:** `docs/todo-2026-10-19.md` §2, §3, §4, §5, §6.

## Contexto
O TK-01 define o contrato do motor. A GUI **não** inventa chaves: lê `arvoreInterruptores()` e escreve por `definirCfg`. As chaves novas são:
`autoIrBase, autoVender, autoRepor, autoCofre, autoAnunciar, autoHab, autoAtrib (default false)`.
O mestre é `autoplay` (`cfg.enabled`) e `manutencao` passa a ser filho dele.

Evidência actual:
- `gui.js:1481-1498` — estado “ligado (implícito)” e `<span class="arv-cfg">implícito</span>`.
- `gui.js:1501-1510` — o nó do mestre é só mais um; não há controlo grande.
- `gui.js:1555-1563` — o cartão “Switches” tem 3 parágrafos de hint e a árvore.
- `gui.js:1704-1713` — o select de região mostra fixa/ideal, mas precisa usar `regiaoRecomendada` quando modo = auto (TK-01 expõe).
- `gui.js:351+` — CSS do painel já foi para 1320px/altura do ecrã; o Painel ainda não tem 2 colunas nem reset de scroll.

## Acções

### 1. Mestre óbvio (TODO §5)
- No topo do painel/aba Auto-play, um único cartão grande: **AUTO-PLAY** com estado `LIGADO` / `DESLIGADO` / `PAUSADO`, e o motivo quando bloqueado.
- Um só controlo mestre (switch). Remover qualquer botão duplicado “DESLIGAR” que faça a mesma coisa.
- Texto do estado e do porquê visíveis **sem abrir a aba** (cabeçalho do painel).

### 2. Fim dos “implícitos” (TODO §4)
- Para cada nó da árvore, mostrar switch real (já existe `temCfg`), estado verde/cinza e motivo.
- Remover o fallback `'ligado (implícito)'` e o `<span class="arv-cfg">implícito</span>`; se algum nó vier sem `cfg` do motor, mostrar **erro visível** (“motor antigo: recarregue”), não um badge enganador.
- O cartão “Automatismos do motor” (`renderAuto`) deve incluir também os switches de base que hoje só existem na árvore: vender, repor, cofre, anunciar, subir habilidades, ir à base. Todos com handler `definirCfg({chave: checked})`.

### 3. Painel em 2 colunas e sem corte (TODO §6)
- `#ap-t-painel.on` com `display:grid; grid-template-columns:1fr 1fr; align-items:start;` e gap; cartões não podem partir entre colunas (`break-inside:avoid`).
- Em ecrãs estreitos (`@media (max-width:900px)`) volta a 1 coluna.
- Ao abrir o painel e ao trocar de aba, `main.scrollTop = 0` (corrige o cartão cortado no topo).
- Aumentar o painel para `height:calc(100vh - 20px)` já feito; confirmar que `overflow:hidden` no container e `overflow:auto` no main não corta cartões.

### 4. Região automática visível (TODO §2)
- Com modo `auto`: o select `#ap-reg-id` mostra `regiaoRecomendada` (nova do TK-01) e fica marcado como “automática”; o texto “Região em uso” diz o nome recomendado.
- Escolher uma região na lista → modo `fixa`, `regionDefault=id` (já existe handler).
- Voltar a `auto` → `regionDefault:null` e o select volta a mostrar a recomendada no próximo render.
- “Forçar viagem” continua a usar o valor mostrado.

### 5. Ultimate
- Confirmar que não existe nenhum controlo `ultEmMobs`/“Ultimate nas lutas de mobs” na GUI. Se existir, remover.

## Critérios de aceitação

1. `node --check extension/gui.js` → rc 0.
2. `node tools/testes/run.mjs` → rc 0 (ou explicar cada falha que não seja da GUI).
3. Prova estática: `rg -n "implícito|ultEmMobs|Ultimate nas lutas" extension/gui.js` → **0 resultados** (excepto comentário histórico que diga que foi removido; se ficar, que não seja renderizado).
4. Prova de DOM (stub ou navegador): com um nó `cfg:null` a GUI mostra erro, não “implícito”; com `cfg.autoVender=false` o switch aparece desligado e o handler chama `definirCfg`.
5. Prova visual: screenshot do Painel em 2 colunas (arquivo em `G:\Temp\opencode\`), com scroll no topo.
6. Commit no worktree `feat(gui): ...`; **não fazer push**.

## Notas
- Só `extension/gui.js`. Se precisares de uma função nova do motor, **pede no relatório** em vez de editar `automation.js` (é do TK-01).
- Não apagar tabs nem funcionalidades; o objectivo é reorganizar e tornar os switches reais.
- Reler antes de escrever. Um escritor neste ficheiro.
