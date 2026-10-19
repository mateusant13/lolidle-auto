# O HARNESS DO JOGO — entender o jogo (e o que se passa) SEM VISÃO

> Criado em 2026-10-18, a pedido do dono: *"monta um harness que te ajuda a entender o jogo 100% e
> o que ta acontecendo. de preferencia, sem visao."* Ficheiro: `tools/harness.mjs`.

## A ideia, em uma frase

**O `docs/game-src/motor.js` IMPORTE-SE directamente em Node.** Não se copia nada (REGRA N.º 3): o
harness lê a MESMA função que o jogo aplica e corre-a offline, de forma determinística, sem browser,
sem screenshot, sem CDP. Se o jogo mudar — hoje ou daqui a 10 anos — o harness acompanha sozinho.

Prova de que o motor importa em Node:

```
node --input-type=module -e "import('./docs/game-src/motor.js').then(m=>console.log(Object.keys(m).length))"
# -> 319 exportações
```

## Comandos

```
node tools/harness.mjs                       # ajuda + estado das fontes
node tools/harness.mjs fontes                # ficheiros-fonte do jogo (+bytes/sha256)
node tools/harness.mjs curva [campo] [nv]    # CURVA do motor (hp/ad/armadura/xp/ouro)
node tools/harness.mjs monstro <nome> <nv>   # stats de um monstro num nível
node tools/harness.mjs item <id|ref>         # um item do jogo (stats, valor, refino)
node tools/harness.mjs kit <campeao>         # o kit do campeão (do motor)
node tools/harness.mjs chefe <nome> <nv>     # mecânicas do chefe (aviso, rodízio)
node tools/harness.mjs pocoes                # as poções do jogo (cura/preço/nível)
node tools/harness.mjs atributos <champ> <nv> [--modelo=] [--itens=a,b]
node tools/harness.mjs banco [--filter x]    # banco de regressão (tools/testes/run.mjs)
node tools/harness.mjs vivo  [args]          # estado AO VIVO (delega em tools/cdp-eval.mjs)
node tools/harness.mjs sonda <target> [s]    # liveness/stack (delega em tools/_sonda-alvo.mjs)
node tools/harness.mjs verificar             # AUTOTESTE: lutas reais (rc!=0 se falhar)
```

Acrescenta `--json` a qualquer comando para saída estruturada (para scripts).

## A LUTA REAL (`lutar`) — o critério do dono

O dono definiu o critério de "build ideal" (não é DPS):

```
(sobrevive? , mata em quantos segundos? , quantas poções e quanto custam em ouro?)
```

`harness lutar` corre a luta REAL, passo a passo, com `passo(estado, combate, dt)` do motor
(`motor.js:1353`, `dt = 0.05` = o `DT` do jogo) e devolve exactamente essas três coisas:

```
node tools/harness.mjs lutar --champ=katarina --nivel=30 --alvo="Barão Nashor" --nv=36 --seed=1 --maxSeg=90
```

Opções:

| opção | sentido |
|---|---|
| `--champ` / `--nivel` | campeão e nível do jogador |
| `--alvo` / `--nv` / `--qtd` | monstro/chefe e o nível, quantos em simultâneo |
| `--itens=a,b,c` | peças equipadas (ids do catálogo; `~A`/`+3` como no jogo) |
| `--barra=Q,R,E,A` | força a barra (por defeito o `subirAutomatico` do motor decide) |
| `--pocoes=vida,vidaF,vidaS` / `=none` | stock de poções disponível |
| `--limiar=0.5` | limiar de auto-poção (como a extensão clica) |
| `--maxSeg` / `--seed` | tecto de tempo e semente determinística |

Devolve: `resultado` (matou/morreu/tempo), `mataSeg`, `morreuSeg`, `pocoes`, `custoPocaoOuro`,
`ouroGanho`, `danoRecebido`, `danoPorFonte`, `mecanica` (carregou/interrompeu/golpeou) e os
atributos efectivos.

**A auto-poção do motor** só dispara com VIP ou `c.pocaoAuto` — o harness liga-o porque a **extensão
clica as poções**; assim a simulação reflecte o que a extensão faz, não o que o jogo faria sozinho.

## O autoteste (`verificar`) — REGRA N.º 6

`node tools/harness.mjs verificar` corre lutas determinísticas e verifica que a MECÂNICA do jogo
acontece como a fonte diz. Hoje prova, com números medidos:

- luta fraca mata;
- contra o **Arauto do Vale**, COM o atordoamento na barra o motor **interrompe** a investida
  (`carregou 3, interrompeu 2, golpeou 1`); SEM ele, **não** (`carregou 2, interrompeu 0, golpeou 2`);
- interromper **reduz o dano recebido** (1086 < 1564) — é a prova que fundamenta o TK-X2.

`rc!=0` se algum check falhar.

## Porque isto respeita as regras do repo

- **REGRA N.º 1** (a fonte manda): lê `motor.js`, nunca um resumo.
- **REGRA N.º 3** (números lidos, nunca copiados): importa as funções do jogo; não transcreve tabelas.
- **REGRA N.º 6** (verde não é prova): tem autoteste próprio e mede efeitos, não só valores.
- **Sem visão**: nenhum comando tira screenshot; a leitura ao vivo (`vivo`/`sonda`) é opcional e
  usa os canais já sancionados (relay CDP / `_sonda-alvo.mjs`), nunca `Target.createTarget`.

## O que NÃO faz

- Não substitui o banco (`banco` delega em `tools/testes/run.mjs`).
- Não conduz o browser: `vivo`/`sonda` são attach-only e delegam nos helpers existentes.
- A luta é do MOTOR (auto-casts + auto-poção); não modela a latência da extensão. Para medir a
  extensão ao vivo, `vivo`/`sonda`.
