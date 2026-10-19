# TK-01 — automation.js: build genérica, mercado só-leitura, região auto e hierarquia do auto-play

**Ficheiro (write scope):** `extension/automation.js`
**Prioridade:** P0 (mercado abre sozinho) / P1 (build com pesos à mão, hierarquia)
**Origem:** `docs/todo-2026-10-19.md` §1, §2, §3, §4, §5, §9 + decisões do dono no checkpoint.
**Regra AGENTS:** Nº 1 (ler `docs/game-src/motor.js` antes de números), Nº 3 (números lidos, nunca copiados), Nº 6 (verde não é prova; provar).

## 1. Mercado NUNCA abre para LER

Evidência:
- `extension/automation.js:5040` — `obterItem()` chama `lerOfertas()` (DOM).
- `extension/automation.js:5174-5187` — `lerOfertas()` faz `mercadoEl(true)` + `press('j')` → abre `#janela-mercado`.
- `extension/automation.js:7378-7389` — `lerMercadoServidor()` já existe e lê `GET /api/mercado` (sem UI).

Acção:
- Trocar a leitura de `obterItem()` por `lerMercadoServidor()`; filtrar `o.minha === true` e `String(baseDoItemMercado(o.item)) === String(base)`.
- Se a oferta for minha, aí sim abrir a UI (`mercadoEl(true)`) só para `cancelarOferta(o.id)` e fechar em `finally`.
- Auditar `mercadoEl(true)`/`press('j')`: leitura = API; UI só com acção concreta (comprar/vender/anunciar/cancelar).
- `planejarMercado()` também lê `lerMinhasOfertas()` por DOM; se der para ler minhas ofertas do servidor (`o.minha`), usar. Se não, deixar claro no código que a UI é necessária para CANCELAR, não para ler.
- Prova: em Node, stub de `fetch` → `obterItem` não pode tocar em `press('j')`/`mercadoEl`. Adicionar teste à suite (ver critérios).

## 2. Região automática vs fixa

Evidência:
- `automation.js:8448-8460` — `regiaoIdeal()` devolve `cfg.regionDefault` ou a melhor por score.
- `gui.js:1707-1713` — o select já tenta mostrar `c.regionDefault || regiaoIdeal`.
- `gui.js:3576-3582` — “Forçar viagem” já usa `$('ap-reg-id').value`.

Acção:
- Garantir que `estado()` expõe `regiaoIdeal` **mesmo quando `regionDefault` está definido** (hoje devolve a fixa; para o preview auto precisa da recomendada, não da fixa). Acrescentar `regiaoRecomendada` (sempre a auto) ao `snapshotEstado`/`estado()`.
- `gui.js` (outro ticket) usa `regiaoRecomendada` quando modo = auto.
- Nenhuma viagem automática pode usar uma região fixa antiga quando `regionDefault` for null.

## 3. Build ideal sem pesos à mão

Evidência:
- `automation.js:6649+` — `montarBuildDe()` usa `PESO_FASE` (multiplicadores calibrados à mão).
- `automation.js:5432+` — `PESO_FASE`; `:5655+` `valorPassiva`; `:7667+` `melhorSet` força Rabadon.
- `automation.js:4500+` `passivasDoItem()`, `:4717+` `apDoSet()`, `:4754+` `estimarSet()`, `scoreSet()` — já genéricos.

Acção:
- `montarBuildDe(c, fase)` passa a escolher os 5 ids por **score medido** (`scoreSet`) sobre o catálogo, não por `PESO_FASE`.
- Remover o “Rabadon sempre dentro” e o `objetivoItem` forçado como primeiro item; o Rabadon entra se o score o escolher.
- Se `scoreSet` não estiver disponível (sem DOM/catálogo), manter o caminho antigo como **fallback declarado** — não apagar a função antiga sem rede.
- Respeitar slots/limites do motor (`espaco`, botas, lendário) e itens possuídos quando for build “alcançável”.
- Prova no harness: para Ryze nv32, a build devolvida deve incluir 3100 (Lich) e bater a build dos top players em `mataSeg` no Barão (ver TK-04); para Katarina, não pode voltar a meter Rabadon numa build AD.

## 4. Hierarquia do auto-play (contrato com TK-02)

Evidência:
- `automation.js:3629-3684` `INTERRUPTORES`: `manutencao` é raiz independente; `autoplay` tem `excecao: () => !ehCampeaoAlvo()`.
- `:3667` `hab` sem cfg; `:3648` `irBase` sem cfg; `:3649` `vender` sem cfg; `:3650` `repor` sem cfg; `:3659` `cofre` sem cfg; `:3668` `anunciar` sem cfg.
- GUI mostra “ligado (implícito)” para esses (`gui.js:1485,1498`).

Contrato (TK-02 depende disto):
- `autoplay` = **único mestre**: `pai:null, cfg:'enabled'`, **sem excepção de campeão** (remover `excecao`/`excecaoTxt`).
- `manutencao: { pai:'autoplay', cfg:'manutencao' }` (desligar o mestre desliga tudo).
- `irBase: { pai:'manutencao', cfg:'autoIrBase' }`
- `vender: { pai:'irBase', cfg:'autoVender', excecao Runeterra }`
- `repor: { pai:'irBase', cfg:'autoRepor' }`
- `cofre: { pai:'irBase', cfg:'autoCofre', excecao Runeterra }`
- `hab: { pai:'manutencao', cfg:'autoHab' }`
- `anunciar: { pai:'manutencao', cfg:'autoAnunciar', excecao Runeterra }`
- Manter `equip/atrib/comprar/refino/montar/fugir/buildPorFase/skillsPorFase/rotacao/vigiarMercado` com os cfg actuais.
- `DEFAULT`: acrescentar `autoIrBase:true, autoVender:true, autoRepor:true, autoCofre:true, autoAnunciar:true, autoHab:false`. **`autoAtrib` passa a `false`** (decisão do dono: não quer pontos por agora) — mantém-se o switch.
- Nenhum interruptor pode ficar com `cfg:null` (fim do “implícito”). `arvoreInterruptores()` passa a devolver todos com cfg.
- `podeFazer('autoplay')` não pode bloquear por campeão. `champAlvo` pode continuar a existir como **preferência visual**, mas não como bloqueio.

## 5. Ultimate não é interruptor
- Já removida de `DEFAULT` e da GUI. Confirmar que não há `cfg.ultEmMobs` em `automation.js` (só comentários históricos). A regra é `usarUlt = ehChefe || faseDificil` (`:7937`).

## Critérios de aceitação (todos com prova)

1. `node --check extension/automation.js` → rc 0.
2. `node tools/testes/run.mjs` → rc 0; colar o resumo final. Se mudaste um teste, diz qual e porquê (Regra Nº 6).
3. Teste novo (no mínimo): `lerOfertas`/`obterItem` **não** abre mercado quando a oferta vem do servidor; com `fetch` stub devolve `minha:true` e o item base → `press('j')` nunca é chamado; sem oferta → `ok:false`.
4. Teste novo: `INTERRUPTORES` não tem nenhum `cfg:null`; `podeFazer('vender')` falso com `enabled:false`, verdadeiro com `enabled:true, autoVender:true` (sem campeão).
5. `node tools/harness.mjs atributos ryze 32 --itens=...` para a build que `montarBuildDe` devolver; colar `mataSeg` no Barão nv32 vs build top-player (TK-04). A build tem de ser explicável pelo `scoreSet`, não por `PESO_FASE`.
6. Commit no worktree com mensagem `fix(auto): ...`; **não fazer push**.

## Notas de execução
- Trabalhar **só** em `extension/automation.js` e nos testes (se necessário). `gui.js` é do TK-02.
- Reler o ficheiro antes de escrever; acrescentar no fim quando possível (Regra Nº 5).
- Se um número do jogo for necessário, ler `docs/game-src/motor.js` e citar `file:linha` no comentário.
