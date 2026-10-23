# A BUILD IDEAL — como o código a decide, o que lê do motor e onde ela erra

> Escrito em 2026-10-23. Fonte primária: `docs/game-src/motor.js` (o que o jogo **faz**) e
> `extension/automation.js` (o que a extensão **decide**). Todo o número aqui tem `ficheiro:linha`.
> Este documento existe porque o dono suspeitou — com razão — que a "build ideal" da conta dele
> estava errada, e a resposta a essa suspeita não é uma opinião: é a lista de inputs, a fórmula,
> e a lista honesta do que o modelo NÃO vê.

---

## 1. O critério do dono (a régua, não o DPS)

Verbatim, e é a régua de tudo o que segue:

> *"a build nao e so dps nao, meu filho. e tornar possivel enfrentar um boss ou nao, e em quantos
> segundos. (...) as pocoes ficam caras por ser muito uso, a build ideal muda de novo pra roubo de vida."*

Logo o comparador final não é "maior número": é
**(1) sobrevive com poção? → (2) mata em menos segundos? → (3) gasta menos ouro em poções?**
Implementado em `automation.js:9832-9841` (`ganha`), dentro do ramo de escolha final
(`automation.js:9791-9801`, o comentário cita o dono e o número medido).

---

## 2. O caminho de decisão, do pedido até a lista de itens

```
buildIdeal(fase)                        automation.js:9606
 └ montarBuildDe(campeão, fase)         automation.js:9643
    ├ cache por fingerprint             automation.js:9652-9657 (`fingerprintBuild`)
    ├ alvoDeReferencia(fase)            automation.js:7943-7990
    ├ classe = c.magia ? 'ap' : 'ad'    automation.js:9664
    └ montarBuildDePorScore(...)        automation.js:9699
       ├ pool = classeItem(id) neutro|classe    automation.js:9707
       ├ resto/botas separados                   automation.js:9708-9709
       ├ beam search (K=12, N=40)                automation.js:9697-9747
       ├ polimento local (troca 1 item ×2)       automation.js:9752-9790
       └ escolha final pelo critério do dono     automation.js:9791-9846
```

`scoreSet` (`automation.js:11139-11213`) é o **preço de poda** (barato, usado milhares de vezes).
`estimarSet`/`sobrevivenciaSet` são o **modelo de luta** (caro, usado só nos candidatos que
sobrevivem à poda). O comentário em `automation.js:9792-9800` regista a medição que obrigou a esta
separação: o `scoreSet` preferia a build sem CDR (2504 vs 2343) e o harness matava em 42,75 s
contra 38,95 s da build com CDR.

---

## 3. O que o motor aplica (e a extensão tem de ler, não copiar)

### 3.1 Qualidade e refino — multiplicam o item

- `QUALIDADES` (`motor.js:180-186`): C ×0,90 · B ×1,00 · A ×1,15 · S ×1,35 · SS ×1,70.
  Pesos: C 49,9495% · B 35% · A 15% · S 0,05% · SS 0,0005%.
- `BONUS_REFINO = 0,12` (`motor.js:56`): **+12% por nível de refino**, teto 5 (`motor.js:55`).
- `infoItem` (`motor.js:278-283`) aplica `m = (1 + 0,12·ref) × QUALIDADES[qual].mult` a
  **`ad, ap, mana, vida, armadura, rm, va, rv, critico, regen, cdr`** — e **NÃO** ao `penMag`
  (`motor.js:281-282` não lista pen). Isto já foi um bug medido neste repo (pen da bota A é 15%,
  não 17,25%) e está modelado em `automation.js:6632-6636`.

### 3.2 Mitigação e penetração

- `mitigar = dano × 100/(100 + armadura)` (`motor.js:1268`).
- Físico: `arm = armadura × (1 − reducaoArmadura) × (1 − penArmadura)` (`motor.js:1305`).
- Mágico contra monstro: `armadura × RM_MONSTRO × (1 − penMagica)`, com `RM_MONSTRO = 0,6`
  (`motor.js:1282`, aplicado em `motor.js:1305`).
- `penArmadura` encadeia kit e item: `1 − (1 − penE) × (tem('3036') ? 0,7 : 1)`
  (`motor.js:580`; `penE` do kit em `motor.js:551`); `penMagica` tem teto 0,6 (`motor.js:570`).
- O `3036` ainda dá **+15% de dano contra chefe** (`motor.js:1317`).

### 3.3 Crítico, CDR, roubo de vida

- Crítico: chance soma (`motor.js:534/582`), multiplicador base **1,75** e `3031` soma +0,4
  (`motor.js:550`, aplicado em `motor.js:1316`). **Só o auto-ataque critica.**
- CDR: a recarga é que encolhe. `motor.js:578` limita a `reducaoRecarga` a **0,4** (inclui
  `0,004 × foco` e os itens); a aplicação é `d.recargas[t] = recarga × (1 − a.reducaoRecarga)`
  (`motor.js:1694`). O dano do golpe não muda (`motor.js:1314`). Por isso o score aplica CDR
  **só à fracção de habilidades**: `fatorCdr = fracHabs/(1−cdr) + (1−fracHabs)`
  (`automation.js:11165-11167`).
- Roubo de vida: `cura = dano × rouboVida` **só quando `fonte === 'ataque'`**
  (`motor.js:1332-1334`). O score usa `dpsAuto × rv` (`automation.js:11208-11211`) — e declara
  o peso: 1 cura/s vale 1 dano/s (política, não regra do jogo; `automation.js:11206-11207`).

### 3.4 Espaços e equipamento

- `ESPACOS = 5`, `ESPACOS_ITENS = 4` (`motor.js:29-30`): **1 bota + 4 não-bota**.
  O beam só expande conjuntos válidos (`cabe`, `automation.js:9725-9728`; `cabeIds`,
  `automation.js:9758-9768`), porque o jogo manda o 5.º não-bota para a mochila
  (`motor.js:3176-3187`, citado em `automation.js:9692-9696`).

### 3.5 Passivas

`statsSet` lê passivas do **texto** do item (`passivasDoItem`, usado em `automation.js:6615`), não
por `if (id === ...)`: Lich/Sheen, Chama (`execute`), Liandry (`burnPct`), `%vida`/`%AD`/`%AP`,
Eco, Runaan, cleave, dano a chefe, revive, stasis, escudo, etc. (`automation.js:6655-6693`).
O que não é reconhecido é **guardado** em `naoReconhecidos` (mesmo bloco) — e vale **zero** no
score. É o primeiro sítio a olhar quando um item parece "invisível" para a build.

---

## 4. Os inputs do score, um a um

| input | de onde vem | onde entra |
|---|---|---|
| `pj` (dano, va, crit, vida…) | `player()` — painel do jogo | `automation.js:11126` |
| `fracHabs`, `fracAuto`, `habRate` | `fracoesDeDano()` a partir de `dpsPorHabilidade()` e da barra | `automation.js:11069-11087`, consumidos em `11165-11180` |
| stats do candidato | `statsSet(ids)` — catálogo + qualidade/refino | `automation.js:6592-6721` |
| alvo (hp, armadura, chefe, nível) | `alvoDeReferencia(fase)` | `automation.js:7943-7990` |
| classe do item | `classeItem` (`motor.js:23`) | `automation.js:9707` |
| kit do campeão (`magia`, pen E, passivas) | `META.champAtual` / `garantirCampeao()` | `automation.js:9606`, `6709` |
| qualidade assumida | `multTier()` = **mediana** da qualidade/refino do que está equipado | `automation.js:6582-6590`, aplicada em `6613` |

`multTier()` é o input mais subestimado do modelo: quando o catálogo é pontuado, os candidatos
levam a **mediana do tier atual**, não a qualidade que o item terá quando cair. Conta nova (B/C)
avalia tudo como B/C — o ranking relativo quase não muda (é multiplicativo), mas o **número**
mostrado e a comparação com o equipado mudam.

---

## 5. A fórmula do score, em uma linha por termo

```
base    = campeão mágico ? APtotalSet : (dano do painel + AD dos itens + %vida→AD)
mit     = 100 / (100 + armadura efetiva do alvo)        // pen do ramo certo
fatorCdr= fracHabs/(1-cdr) + (1-fracHabs)               // CDR só nas habilidades
fCrit   = 1 + fracAuto · critChance · (critMult - 1)    // crítico só nos autos
d       = base · mit · fatorCdr · fCrit
          + Lich/Sheen · base · taxaProc · mit
          + execute / danoChefe / burnPct / currentHpPct (com teto 3×CURVA.hp)
          + areaProc / periodic · nº de alvos
          + cleave / cleaveHp / runaan (só em mobs)
          + dpsAuto · rouboVida                        // cura/s
```

`automation.js:11156-11213`. Números que o motor impõe e o score já respeita:
teto do `%vida` em `3 × CURVA.hp` (`motor.js:1291-1294` → `automation.js:11185-11188`), teto de
pen mágica 0,6 e de CDR (`automation.js:6695`), e `3036` +15% só contra chefe
(`automation.js:11184`).

---

## 6. O que o modelo NÃO vê (lista honesta, com o efeito)

1. **Sobrevivência fora da fase de chefe.** `comFaseChefe = (fase === 'chefe' || fase == null)`
   (`automation.js:9806`). Na fase de **mobs**, a escolha final é DPS/tempo por `estimarSet`, sem
   `sobrevivenciaSet`. Vida/armadura/resistência só pesam se o score de dano as valorizar
   indirectamente. **Efeito:** uma build "vidro" pode ganhar o farm e morrer para o chefe —
   mitigado porque a build de chefe é recalculada por fase (`cfg.buildPorFase`), mas não eliminado.
2. **Um alvo, não o grupo.** `alvoDeReferencia` escolhe **um** monstro (o mais pesado da região) e
   `alvos` vem do peso de spawn (`automation.js:7946`, `7962`). O AoE é aproximado por
   `areaProc.alvos`/`periodic.alvos`; posicionamento e sobreposição não existem no modelo.
3. **`fracHabs` depende da barra viva.** Sem arsenal medido, `fracHabs = 0` e **CDR deixa de
   pontuar** (`automation.js:11127`, `11165`). O mesmo para `fracAuto` e o crítico. Uma build
   avaliada antes de haver uma luta medida pode sair sem CDR.
4. **Qualidade mediana (ver §4).** O catálogo não é pontuado com a qualidade real de cada peça; o
   `montarBuildDe` devolve **ids-base** e quem equipa preserva a peça que tem.
5. **Passivas por texto.** Um item com passiva que o parser não conhece contribui com os stats
   numéricos e **nada mais** (`naoReconhecidos`). Silencioso por desenho — é a primeira coisa a
   inspeccionar (`infoBeam()`, §7).
6. **Orçamento do beam.** `BEAM_ORCAMENTO` pode cortar (`cortou = true`); o resultado é
   determinístico mas não é o óptimo global. O polimento local de 2 voltas recupera parte
   (`automation.js:9752-9790`).
7. **Peso do roubo de vida é política.** 1 cura/s = 1 dano/s (`automation.js:11206-11207`) — é a
   escolha que faz a build virar para RV quando as poções ficam caras, e é declarada, não "medida".
8. **`poderItem` só é fallback.** Se o catálogo vier vazio ou o `scoreSet` não existir,
   `montarBuildDe` cai em `montarBuildDePesos` (`automation.js:9645`) — um modelo antigo, por
   pesos, que **não** é o critério do dono. Um catálogo vazio na página produz build plausível e
   errada; o sintoma é `infoBeam().best` vazio.

---

## 7. Como se audita isto (receita, não opinião)

```
node tools/harness.mjs                        # mede o tempo de abate de uma build
node tools/testes/run.mjs --filter score      # score/estimarSet
node tools/testes/run.mjs --filter build-beam # restrições de slot e determinismo
node tools/testes/run.mjs --filter passivas   # parser de texto
node tools/testes/run.mjs --filter build-equipada
```

Ao vivo, no mundo da extensão (Regra Nº 4 do `AGENTS.md`), os marcadores discriminantes são
`infoBeam()` (estados, `cortou`, `best`, `bestScore`, `luta`) e `buildIdeal(fase)` — comparar o
`bestScore` com o `scoreSet(idsEquipados())` diz, em uma conta, se o que está vestido é pior do
que o recomendado **e por quanto**.

**Regra de leitura:** se o número vem de um resumo da extensão (`scoreSet`, `multTier`,
`passivasDoItem`), é suspeito até ser confirmado no `motor.js`. O resumo pode estar errado; a
fonte não. É a Regra Nº 1 deste repo, e esta área é onde ela mais custa.
