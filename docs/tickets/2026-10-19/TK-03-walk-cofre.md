# TK-03 — automation.js: caminhada humanizada na Fonte e venda do lixo do cofre

**Ficheiro (write scope):** `extension/automation.js` + teste novo.
**Prioridade:** P1 (pedidos explícitos do dono).
**Depende de:** TK-01 (o mesmo ficheiro; **só começar depois do merge do TK-01**).
**Origem:** `docs/todo-2026-10-19.md` §7, §8.

## 1. Caminhada humanizada (TODO §7)

Evidência:
- `automation.js:3288-3314` `andarParaCima()`: o 1.º clique é **sempre** no centro exacto (`jx=0`), os seguintes variam só ±0,35 tile em x; y é sempre 1 tile acima.
- `automation.js:3320-3325` `subirNaFonte()` liga `humanoTile:true`.

Acção:
- Cada passo (incluindo o 1.º) escolhe um destino dentro do tile com:
  - x alternado: `lado` começa em ±1 e troca a cada passo; `jx = lado * (0.2..0.42) * pxTile`;
  - y variável: `1 tile` ± `0.12 tile`, nunca 0 (tem de subir);
  - pausa variável: `humano(420..640)` em vez de `humano(500)` fixo;
  - deriva limitada: a soma de `jx` não pode sair do tile central (limitar a ±0.45 tile do centro), para não passar ao lado da Tesoureira.
- Manter `opts.ate` (parar quando o NPC aparece) e `opts.humanoTile` (só na Fonte) — o teste `cofre.test.mjs` mede o 1.º clique exacto? **Ler o teste.** Se medir, actualizar o teste para a nova regra (Regra Nº 6) e dizer qual.
- Prova: teste de DOM que dispara `mousedown` e regista `clientX/clientY`; verificar (a) 1.º clique não é o centro, (b) x alterna de lado, (c) y > centro - 1.5 tile e < centro - 0.5 tile, (d) todos os cliques caem dentro do tile alvo.

## 2. Lixo do cofre → Lojista (TODO §8)

Evidência:
- `automation.js:4052-4062` `lerCofreSlots()` (slots com `k`, `base`, `qual`, `refino`, `qtd`, `acao`).
- `automation.js:4082-4088` `guardarNoCofre()`; `:4260-4268` `retirarDoCofre()` (clica no slot).
- `automation.js:3359+` `venderBase()` (regras de protecção: build, componentes, especiais, duplicados).
- `automation.js:3611` `NECESSIDADES_PRIMARIAS` e `:3899-3916` `PASSOS_BASE`.

Acção:
- `lixoDoCofreLista()`: a partir de `cofreConhecido()` (ou slots abertos), devolver slots que:
  - raridade `basico` ou `epico` com `qIdx(qual) < qIdx('S')`;
  - **não** são base/componente de `buildIdeal()` (usar `componentesDaBuild()`/`basicosDaBuild`);
  - **não** são especiais (`ehEspecialMeu`/`mapaEspecial`), **não** são reservados (`planoEquipar`/`planBag`);
  - duplicados: manter a **melhor** cópia (qualidade, depois refino) e marcar as restantes;
  - **lendário NUNCA é lixo**.
- `sacarSlotDoCofre(k)`: abre o cofre se preciso, clica no slot `data-k===k` com `data-cofre` de retirada, espera, confirma que o item entrou na mochila (`scanBag`), devolve `{ok,base}`.
- `venderLixoDoCofre()`: máximo **8** por passagem; abre cofre, saca os escolhidos, fecha, chama `venderBase()` (as regras de venda voltam a validar), regista `logEvent('cofre', {vendidos:...})`. Cadência 10 min (`cfg.cofreCadenciaMin`) para não repetir.
- Ligar a `necessidadesBase()`: `n.venderLixoCofre = podeFazer('cofre').pode && lixoDoCofreLista().length > 0 && cadência passou`; adicionar a `PASSOS_BASE` (depois de `lerCofre`, antes de `cofre`).
- Exportar `lixoDoCofreLista`, `sacarSlotDoCofre`, `venderLixoDoCofre` em `window.__lolidleAuto` para prova manual.

## Critérios de aceitação

1. `node --check extension/automation.js` → rc 0; `node tools/testes/run.mjs` → rc 0 (dizer que testes mudaste).
2. Teste novo de `lixoDoCofreLista()` com catálogo stub: básico C → lixo; épico S → não; lendário → nunca; item da build/componente → não; duplicado B+ e C → só o C é lixo; especial → não.
3. Teste novo da caminhada (coordenadas) como acima.
4. Prova manual (se o browser estiver disponível): `node tools/_prova-live.mjs` ou `cdp-eval` a chamar `lixoDoCofreLista()` e devolver a lista; colar o JSON. Se não for possível, dizê-lo (Regra Nº 6).
5. Commit `feat(auto): ...`; **não fazer push**.

## Notas
- Um escritor neste ficheiro. Reler antes de escrever.
- Não tocar em `gui.js`.
- Números do motor: ler `docs/game-src/motor.js`; não copiar.
