# Missões — tabela de valor (M8)

> **Pergunta do dono:** "a missão X vale mais a pena que a Y?" e "uma missão num mapa anterior vale a pena?"
> **Fontes:** `docs/motor-map.md` §4–§6 · `docs/game-src/motor.js` · `docs/game-src/jogo.js` · `docs/game-src/balanco.js` · `docs/game-src/i18n.js`.
> **Método:** nenhum número deste documento foi copiado de doc — as fórmulas foram **executadas a partir do próprio texto de `motor.js`** (os trechos de `motor.js:272-279, 280-298, 354-407, 412-430, 1106, 1138-1149, 3244-3298, 3356-3393, 3478-3495` foram avaliados literalmente, com `balanco.js` importado de verdade). Conferência: as contas batem com os valores derivados de `motor-map.md` §5.3 (Arauto nv35 = 48.750 hp / 840,6 ad / 3.300 xp / 1.566 ouro; Barão nv50 = 122.400 hp / 1.836,8 ad / 7.600 xp / 3.660 ouro).
> **Sem browser:** nada aqui foi lido do jogo rodando; só código-fonte.

---

## 0. Resposta curta

1. **Missão de mapa ANTERIOR não existe como oferta.** O gerador (`criarOfertas`, `motor.js:3310-3327`) só usa `zonaIdeal(nivel)` (`motor.js:3267`) e `zonaAcima(zonaIdeal)` (`motor.js:3268`). E as ofertas são regeradas quando a zona ideal muda (`motor.js:3427`). Só existe missão "para trás" se você **aceitou e não entregou** antes de subir de nível, ou se é tarefa antiga de save (formato sem `tipo`, `motor.js:3284-3287`).
2. **Se você tem uma aberta:** a recompensa é **fixa pela zona** e **imune à penalidade de nível** — quem sofre a penalidade são só os abates. Começar do zero num mapa anterior **não compensa** (precisa matar ~1,6× a ~3,9× mais rápido que o ritmo nominal da zona, e o ciclo de spawn limita isso a ~1,5×). Se já está **>45%–74% feita**, terminar compensa.
3. **Entre tipos, no mesmo mapa, a diferença é pequena e conhecida:** Rápida 42% / Normal 43% / Longa 42% / Caça 42% / Fúria 42% da XP da caça por minuto; Desafio 44% da XP mas 50% do ouro (`motor.js:3244-3248`). O que decide de verdade é **em qual zona** a missão cai.
4. **A missão "do mapa à frente" (Desafio) é o caso espelhado:** paga mais por minuto no papel (×1,0 a ×1,4), mas você enfrenta mob com 1,3× a 3,4× mais vida. Só fica líquido-positivo a partir do nível ~30 (tabela §4.5).
5. **A recompensa da missão é imune a tudo que multiplica a caça** (VIP, noite, furioso, grupo, bônus de Runeterra, evento, Twitch). Logo: quanto melhor a sua caça, **pior** a missão em termos relativos — e vice-versa.

---

## 1. Quem gera cada missão (com `file:line`)

### 1.1 Tarefas do Capitão da Legião

Tipos em `TAREFA_TIPOS` (`motor.js:3244-3248`). `min` = minutos no ritmo típico da zona; `xp`/`ouro` = **fração** da XP/ouro daqueles abates que vem de prêmio:

| tipo | chave | min | xp | ouro | selo exibido (`jogo.js:5479`) |
|---|---|---|---|---|---|
| Rápida | `rapida` | 7 | 0,42 | 0,55 | Rápida |
| Normal | `normal` | 15 | 0,43 | 0,55 | Normal |
| Desafio | `desafio` | 15 | 0,44 | 0,50 | Desafio |
| Longa | `longa` | 25 | 0,42 | 0,55 | Longa |
| Caça | `especie` | 12 | 0,42 | 0,55 | Caça |
| Fúria | `furioso` | 16 | 0,42 | 0,55 | Fúria |

Geração (`criarOfertas`, `motor.js:3310-3327`) — **sempre 3 ofertas**:

| oferta | o que é | regra | linha |
|---|---|---|---|
| 1ª | 50% Rápida **na zona ideal**; 50% Caça (uma espécie da zona) | `r() < 0.5 ? zona('rapida', z) : especie(z)` | `motor.js:3322` |
| 2ª | sorteio uniforme entre: Normal (60%) ou Longa (40%); **Fúria**; e **Caça** (excluindo a espécie da 1ª, e só se a zona tiver ≥2 espécies) | `opcoes` + `splice` | `motor.js:3323-3324` |
| 3ª | **Desafio na zona de cima**; se não houver zona acima (nível ≥40, Barão), outra das opções restantes | `cima ? zona('desafio', cima) : opcoes[...]` | `motor.js:3325` |

- Quantidade por zona: `max(20, round(min × ritmoZona(id) × var / 10) × 10)`, `var = 0,8 + rand×0,4` (**±20%**) — `motor.js:3311, 3313`.
- Quantidade da Caça: `max(10, round(min × ritmoZona × fraçãoDaEspécie × var / 5) × 5)` — `motor.js:3318`.
- Fúria: **3 (60%) ou 4 (40%)** monstros furiosos — `motor.js:3321`.
- `ritmoZona(id) = ABATES_MIN_ZONA[id] × 1,5` (`motor.js:3253-3254`), com `ABATES_MIN_ZONA = {'rota-inf':18,'rota-sup':13,lobos:11,azul:6.5,vermelho:7,rio:7.5,dragao:7,barao:7.5}` (`motor.js:3266`).
- As ofertas trocam sozinhas a cada `TROCAR_TAREFAS_MIN = 10` min, ou pelo botão (`motor.js:3424, 3431-3437`); `TAREFA_VERSAO = 2` invalida ofertas antigas (`motor.js:3255, 3427`).
- **Aceitar** exige estar na base e não ter tarefa ativa (`motor.js:3441`); **entregar** exige estar na base e a tarefa completa (`motor.js:3458`); `naBase` = `LOCAL[local].base` = Fonte (`motor.js:2920, 355`).
- Progresso: `contarTarefa` (`motor.js:3446-3454`) conta abates **no local da tarefa**; tarefa de zona conta **qualquer monstro do local**; Caça exige o nome exato; Fúria exige `i.furioso`; monstros `invocado` não contam (`motor.js:1786`). **Não há exigência de nível do monstro para a tarefa do Capitão.**
- **Cancelar é de graça** (`cancelarTarefa`, `motor.js:3470-3473`).

### 1.2 Missões diárias (uma de cada por dia)

| missão | regra | onde conta | linha |
|---|---|---|---|
| Diária do Rift | `DIARIA_RIFT = {qtd:1000, xp:0.5, ouro:0.5, lendario:0.13, lendarioMax:0.04, abaixo:5}` | **qualquer zona do Rift** (`l.faixa && !l.arena`) | `motor.js:3357, 3359` |
| Diária de Runeterra | `DIARIA = {qtd:1000, xp:0.75, ouro:0.66, lendario:0.27, lendarioMax:0.08, abaixo:5}` | Runeterra (`arena && !aram`) | `motor.js:3356, 3360` |

- Contagem: `contarDiaria` (`motor.js:3402-3408`) — **exige monstro de nível ≥ `estado.nivel − 5`** (`abaixo:5`) e nunca `invocado`.
- Recompensa (`recompensaDiaria`, `motor.js:3389-3393`): `xp = round(1000 × xpMedioZona(zonaIdeal) × (Runeterra ? 1,3 : 1) × Rg.xp)`, `ouro = round(1000 × ouroMedio × Rg.ouro)`.
- **Entrega é só no servidor** (`/api/diaria`, `motor.js:3354, 3410`); o item é **épico garantido** e vira lendário com a chance `lendario` (`motor.js:3414`).
- Uma de cada por dia de Brasília (`diaHoje`, `motor.js:3362`).

### 1.3 Conquistas / títulos (bônus permanentes)

`CONQUISTAS` (`motor.js:3478-3495`) — 17 conquistas; 9 dão bônus permanente (`ad`, `vida`, `armadura`, `rm`, `ouro`) aplicados em `atributos()` (`motor.js:517, 524`). As que mexem em **ouro** (multiplicam `a.ouroMult`, `motor.js:526`): `soldado` (10 tarefas, +5%), `mercador` (100 vendas, +5%), `rico` (1.000.000 de ouro, +5%). Não são "missões" com recompensa pontual — são metas de longo prazo.

### 1.4 (relacionado) prêmio de login

`PREMIO_LOGIN` (`motor.js:3367-3381`): ciclo de 7 dias; o ouro é pago em **minutos de caça na zona ideal** (`ouroPorMinuto`, `motor.js:3376`). Derivado: nível 1 → dia 7 = 34.200 ouro; nível 45 → dia 7 = 109.400 ouro.

---

## 2. Templates de texto exatos (para a extensão parsear)

`t(pt, v)` troca `{chave}` por valor (`i18n.js:21-23`). Em inglês procura a frase no dicionário `js/i18n/en.js` — **esse arquivo não está nas fontes fornecidas** (ver Riscos §5).

| onde aparece | template exato (PT) | fonte |
|---|---|---|
| Cartão de oferta — **Caça** | `'{qtd} {monstro} em {lugar}'` — `monstro = t(o.monstro)`, `lugar = LOCAL[local].nome` | `jogo.js:5483` |
| Cartão de oferta — **Fúria** | `'{qtd} monstros furiosos em {lugar}'` | `jogo.js:5484` |
| Cartão de oferta — **zona** (Rápida/Normal/Longa/Desafio) | `'{qtd} monstros em {lugar}'` | `jogo.js:5484` |
| Selo do tipo no cartão | `{rapida:'Rápida', normal:'Normal', desafio:'Desafio', longa:'Longa', especie:'Caça', furioso:'Fúria'}` | `jogo.js:5479` |
| Linha de números do cartão | `'~{min} min'` · `'{xp} de XP'` · `'{ouro} de ouro'` (+ item) | `jogo.js:5488` |
| Item do cartão | `'item garantido'` / `'pode dar item'` / `'{chances}, senão {pct} de um básico'` | `jogo.js:5475-5478` |
| Log ao aceitar (Capitão) | `'Nova tarefa: abater {qtd} {monstro} ({lugar}).'` | `jogo.js:5794` |
| Fala do Capitão — pronta | `'Você abateu {qtd} {monstro}! Venha {entregar} a tarefa e receber sua recompensa.'` | `jogo.js:4886` |
| Fala do Capitão — em andamento | `'Sua tarefa: {monstro} ({feitos}/{qtd}), em {lugar}. Volte quando terminar, ou posso {cancelar} a tarefa.'` | `jogo.js:4887` |
| **HUD** (rastreador) — nome | `'Tarefa: {monstro}'` em `<b>` | `jogo.js:6269` |
| **HUD** — progresso | `'{feitos}/{qtd} · {lugar}'` em `<small>` | `jogo.js:6269` |
| Aceitar diária (log) | `"Missão diária: abata {qtd} monstros caçando no Summoner's Rift (do seu nível ou até 5 abaixo)."` / `'Missão diária: abata {qtd} monstros em Runeterra (do seu nível ou até 5 abaixo).'` | `jogo.js:5784-5785` |
| Painel da diária | `"{qtd} monstros no Summoner's Rift"` / `'{qtd} monstros em Runeterra'` + `'Diária'` / `'Diária manual'` | `jogo.js:4970` |
| HUD da diária | `'Diária do Rift'` / `'Diária de Runeterra'` + `'{feitos}/{qtd} · do seu nível ou até 5 abaixo'` | `jogo.js:6280` |
| Log do prêmio da diária | `'Missão diária ({lugar}) cumprida: +{xp} de experiência, +{ouro} de ouro e {item}.'` | `jogo.js:4985` |

**Como o `{monstro}` é montado** (importante para o parser distinguir os tipos):

- `nomeTarefa(tar)` (`jogo.js:5500`) → usado no **HUD** (`jogo.js:6269`): Caça → `t(tar.monstro)`; Fúria → `t('Monstros furiosos')`; tarefa de zona → **o nome da ZONA** (`M.LOCAL[tar.local].nome`); tarefa antiga → `t(tar.monstro)`.
- `alvoTarefa(tar)` (`jogo.js:5499`) → usado no **log** e na **fala do Capitão**: Fúria → `t('monstros furiosos')`; zona → `t('monstros')`; Caça/antiga → `ingles ? t(nome) : nome.toLowerCase()` (em PT, **minúsculas**).
- Ou seja, no HUD: se `<b>` traz o **nome de uma zona** → tarefa de zona (qualquer mob do local conta, `motor.js:3449-3450`); se traz `"Monstros furiosos"` → Fúria; senão → Caça.
- O nome da zona **não é traduzido** (`lugar: l.nome`, `jogo.js:5483-5484`); o nome do monstro **é** (`t(o.monstro)`, `jogo.js:5483`).

**Onde ler no DOM:**

| seletor | conteúdo | fonte |
|---|---|---|
| `#npc-troca` | cartões das 3 ofertas + as 2 diárias; cada cartão de tarefa tem `<button data-tarefa="k">` (`k` = índice em `estado.ofertas.lista`) | `jogo.js:5481-5496`, `5489` |
| `#rastreio-tarefa` | tarefa aceita: `<b>` nome + `<small>` `feitos/qtd · lugar`; `hidden` quando não há tarefa | `jogo.js:6263-6272` |
| `#rastreio-diaria` / `#rastreio-diaria-rift` | progresso das diárias | `jogo.js:6273-6284` |

> **Atalho:** o cartão já traz **XP, ouro e minutos** calculados (`o.xp`, `o.ouro`, `M.minutosTarefa(o)` — `motor.js:3312, 3265`, exibidos em `jogo.js:5488`). A extensão não precisa recalcular recompensa: basta ler o cartão. Para decidir **entre zonas** é que precisa da tabela abaixo.
> O cartão só existe **com a janela do Capitão aberta** (`mostrarTarefas` é chamada na fala `tarefa`, `jogo.js:4889-4893`). Fora dela, o DOM só tem a tarefa **já aceita** (`#rastreio-tarefa`).

---

## 3. Valor

### 3.1 A fórmula (toda em `motor.js`)

```
recompensaTarefa(t)   motor.js:3276-3288
  zona/Caça/Fúria:  xp   = round( eq × z.xp   × T.xp  )
                    ouro = round( eq × z.ouro × T.ouro )
                    eq   = abatesEquivalentes(t)        motor.js:3259-3264
                           zona  -> qtd
                           Caça  -> qtd / fraçãoDaEspécieNaZona
                           Fúria -> qtd × (3 / FURIOSO.chance) = qtd × 60
  tarefa antiga (sem tipo): xp = round(qtd × CURVA.xp(nm) × m.xp × 0,6)
                            ouro = round(qtd × CURVA.ouro(nm) × m.ouro × 0,75)

z.xp / z.ouro = porAbateZona(l)   motor.js:3270-3275
  nm = (l.nm[0] + l.nm[1]) / 2     <- nível do MEIO da faixa de monstros da zona
  z.xp = Σ (peso_espécie/total) × CURVA.xp(nm) × MONSTROS[esp].xp

tempo estimado = minutosTarefa(t) = max(1, round(eq / ritmoZona(l.id)))   motor.js:3265
ritmoZona(id)  = ABATES_MIN_ZONA[id] × 1,5                                motor.js:3253-3254

CURVA.xp(n)   = (30 + 7n)  × ajuste(n).xp     motor.js:277
CURVA.ouro(n) = (8 + 3,5n) × ajuste(n).ouro   motor.js:278
ajuste(n)     = faixa de balanco.js:2 (xp 1,0 sempre; ouro 1,5 → 1,0)
```

**Identidade que responde "qual tipo vale mais":** como `eq` multiplica a recompensa e divide o tempo,

```
valor/min ≈ z.xp(zona) × T.xp × ritmoZona(zona)      (idem para ouro, com T.ouro)
```

isto é, **a taxa por minuto não depende da quantidade sorteada** (o ±20% cancela) nem do seu nível: depende só de **(zona, tipo)**. Só o arredondamento da quantidade (múltiplos de 10/5) e o `round` dos minutos mexem nos últimos dígitos.

> O `tempo estimado` **não inclui o custo fixo de base**: aceitar e entregar exigem estar na Fonte (`naBase`, `motor.js:3441, 3458`), o recall leva 4 s (`RECALL = 4`, `motor.js:40`) e a viagem tem 3 s de canal (`TEMPO_VIAGEM.rift = 3`, `jogo.js:460`). São ~15–25 s por missão (ida + volta + falar com o Capitão): ~4% de uma Rápida de 6 min e ~2% de uma Longa de 20 min — as missões curtas rendem um pouco menos do que a taxa nominal sugere.

**Onde entra a penalidade de nível** (`fatorXp`, `motor.js:421`):

```
fatorXp(nivelJogador, nivelMonstro) = dif > 5 ? max(0,1 ; 1 − 0,1×(dif−5)) : 1     dif = nivelJogador − nivelMonstro
fatorSaque = fatorXp  (itens, ouro, runas e espólios)                              motor.js:424
```

Ela multiplica **o abate** (`motor.js:1758, 1765`), **nunca a recompensa da missão**: `entregarTarefa` faz `estado.ouro += t.ouro` e `ganharXp(estado, c, t.xp)` direto (`motor.js:3464-3465`), e `ganharXp` não aplica penalidade nenhuma (`motor.js:2795-2810`). O mesmo vale para a diária (`motor.js:3418-3419`).

### 3.2 Tabela mestra por zona (nominal, sem bônus, mob no nível do meio da faixa)

| zona (id) | nome | faixa jogador | nm monstros | tier | ritmoZona (abates/min) | XP/abate | ouro/abate | caça pura: XP/min | caça pura: ouro/min |
|---|---|---|---|---|---|---|---|---|---|
| `rota-inf` | Rota Inferior | 1–10 | 1–6 | 0 | 27,00 | 52,32 | 28,19 | 1.413 | 761 |
| `rota-sup` | Rota Superior | 5–15 | 5–13 | 1 | 19,50 | 99,20 | 56,49 | 1.934 | 1.101 |
| `lobos` | Toca dos Lobos | 10–20 | 10–18 | 2 | 16,50 | 140,80 | 68,40 | 2.323 | 1.129 |
| `azul` | Campo Azul | 15–25 | 15–23 | 3 | 9,75 | 239,07 | 119,95 | 2.331 | 1.169 |
| `vermelho` | Campo Vermelho | 20–30 | 20–28 | 4 | 10,50 | 283,80 | 134,93 | 2.980 | 1.417 |
| `rio` | Rio | 25–35 | 25–33 | 5 | 11,25 | 267,95 | 114,98 | 3.014 | 1.293 |
| `dragao` | Fosso do Dragão | 30–40 | 30–38 | 6 | 10,50 | 366,27 | 160,87 | 3.846 | 1.689 |
| `barao` | Covil do Barão | 40–50 | 40–48 | 7 | 11,25 | 484,47 | 216,00 | 5.450 | 2.430 |

Derivado de `porAbateZona` + `ritmoZona` (código executado). "Caça pura" = matar sem missão nenhuma.

### 3.3 Tarefas do Capitão — tabela completa (quantidade mínima sorteada)

| zona | tipo | qtd sorteada (var 0,8–1,2) | abates equiv. | min estimado | XP da tarefa | ouro da tarefa | XP/min | ouro/min |
|---|---|---|---|---|---|---|---|---|
| Rota Inferior | Rápida | 150–230 | 150 | ~6 | 3.296 | 2.326 | 549 | 388 |
| Rota Inferior | Normal | 320–490 | 320 | ~12 | 7.199 | 4.961 | 600 | 413 |
| Rota Inferior | Longa | 540–810 | 540 | ~20 | 11.866 | 8.372 | 593 | 419 |
| Rota Superior | Rápida | 110–160 | 110 | ~6 | 4.583 | 3.417 | 764 | 570 |
| Rota Superior | Normal | 230–350 | 230 | ~12 | 9.811 | 7.145 | 818 | 595 |
| Rota Superior | Longa | 390–590 | 390 | ~20 | 16.249 | 12.116 | 812 | 606 |
| Toca dos Lobos | Rápida | 90–140 | 90 | ~5 | 5.322 | 3.386 | 1.064 | 677 |
| Toca dos Lobos | Normal | 200–300 | 200 | ~12 | 12.109 | 7.524 | 1.009 | 627 |
| Toca dos Lobos | Longa | 330–500 | 330 | ~20 | 19.515 | 12.415 | 976 | 621 |
| Campo Azul | Rápida | 50–80 | 50 | ~5 | 5.020 | 3.298 | 1.004 | 660 |
| Campo Azul | Normal | 120–180 | 120 | ~12 | 12.336 | 7.916 | 1.028 | 660 |
| Campo Azul | Longa | 200–290 | 200 | ~21 | 20.082 | 13.194 | 956 | 628 |
| Campo Vermelho | Rápida | 60–90 | 60 | ~6 | 7.152 | 4.453 | 1.192 | 742 |
| Campo Vermelho | Normal | 130–190 | 130 | ~12 | 15.864 | 9.648 | 1.322 | 804 |
| Campo Vermelho | Longa | 210–320 | 210 | ~20 | 25.031 | 15.585 | 1.252 | 779 |
| Rio | Rápida | 60–90 | 60 | ~5 | 6.752 | 3.794 | 1.350 | 759 |
| Rio | Normal | 140–200 | 140 | ~12 | 16.131 | 8.853 | 1.344 | 738 |
| Rio | Longa | 230–340 | 230 | ~20 | 25.884 | 14.544 | 1.294 | 727 |
| Fosso do Dragão | Rápida | 60–90 | 60 | ~6 | 9.230 | 5.309 | 1.538 | 885 |
| Fosso do Dragão | Normal | 130–190 | 130 | ~12 | 20.474 | 11.502 | 1.706 | 959 |
| Fosso do Dragão | Longa | 210–320 | 210 | ~20 | 32.305 | 18.580 | 1.615 | 929 |
| Covil do Barão | Rápida | 60–90 | 60 | ~5 | 12.209 | 7.128 | 2.442 | 1.426 |
| Covil do Barão | Normal | 140–200 | 140 | ~12 | 29.165 | 16.632 | 2.430 | 1.386 |
| Covil do Barão | Longa | 230–340 | 230 | ~20 | 46.799 | 27.324 | 2.340 | 1.366 |

`qtd` é o menor sorteio (`var = 0,8`); com `var = 1,2` a quantidade (e a recompensa) sobem juntas e o **XP/min fica igual**.

**Desafio (a 3ª oferta, na zona de cima):**

| nível | zona ideal | desafio em | qtd sorteada | abates equiv. | min estimado | XP | ouro | XP/min | vs. mesmo tipo na zona ideal |
|---|---|---|---|---|---|---|---|---|---|
| 1+ | Rota Inferior | Rota Superior | 230–350 | 230 | ~12 | 10.039 | 6.496 | 837 | ×1,35 |
| 5+ | Rota Superior | Toca dos Lobos | 200–300 | 200 | ~12 | 12.390 | 6.840 | 1.033 | ×1,21 |
| 10+ | Toca dos Lobos | Campo Azul | 120–180 | 120 | ~12 | 12.623 | 7.197 | 1.052 | ×1,03 |
| 15+ | Campo Azul | Campo Vermelho | 130–190 | 130 | ~12 | 16.233 | 8.771 | 1.353 | ×1,32 |
| 20+ | Campo Vermelho | Rio | 140–200 | 140 | ~12 | 16.506 | 8.048 | 1.376 | ×1,05 |
| 25+ | Rio | Fosso do Dragão | 130–190 | 130 | ~12 | 20.950 | 10.456 | 1.746 | ×1,32 |
| 30+ | Fosso do Dragão | Covil do Barão | 140–200 | 140 | ~12 | 29.843 | 15.120 | 2.487 | ×1,47 |

A coluna "min estimado" usa o `ritmoZona` **da zona de cima** — que é o ritmo de um jogador *do nível daquela zona*. Como o Desafio é feito por um jogador **abaixo** da faixa, o tempo real é maior (ver §4.5).

### 3.4 Caça (uma espécie)

| zona | espécie (peso) | fração | qtd sorteada | abates equiv. | min estimado | XP | ouro | XP/min |
|---|---|---|---|---|---|---|---|---|
| Rota Inferior | Tropa Corpo a Corpo (3) | 60,0% | 155–235 | 258 | ~10 | 5.677 | 4.005 | 568 |
| Rota Inferior | Tropa Mago (2) | 40,0% | 105–155 | 263 | ~10 | 5.768 | 4.070 | 577 |
| Rota Superior | Tropa Corpo a Corpo (3) | 50,0% | 95–140 | 190 | ~10 | 7.916 | 5.903 | 792 |
| Rota Superior | Tropa Mago (2) | 33,3% | 60–95 | 180 | ~9 | 7.500 | 5.592 | 833 |
| Rota Superior | Tropa de Cerco (1) | 16,7% | 30–45 | 180 | ~9 | 7.500 | 5.592 | 833 |
| Toca dos Lobos | Lobo Gigante (1) | 100,0% | 160–240 | 160 | ~10 | 9.462 | 6.019 | 946 |
| Campo Azul | Krug Anciã (2) | 66,7% | 60–95 | 90 | ~9 | 9.037 | 5.937 | 1.004 |
| Campo Azul | Sentinela Azul (1) | 33,3% | 30–45 | 90 | ~9 | 9.037 | 5.937 | 1.004 |
| Campo Vermelho | Brambleback Vermelho (1) | 33,3% | 35–50 | 105 | ~10 | 12.516 | 7.792 | 1.252 |
| Campo Vermelho | Lobo Gigante (1) | 33,3% | 35–50 | 105 | ~10 | 12.516 | 7.792 | 1.252 |
| Campo Vermelho | Krug Anciã (1) | 33,3% | 35–50 | 105 | ~10 | 12.516 | 7.792 | 1.252 |
| Rio | Arraia do Rio (2) | 50,0% | 55–80 | 110 | ~10 | 12.379 | 6.956 | 1.238 |
| Rio | Larva do Vazio (2) | 50,0% | 55–80 | 110 | ~10 | 12.379 | 6.956 | 1.238 |
| Fosso do Dragão | Dragão Ancião (filhote) (2) | 66,7% | 65–100 | 98 | ~9 | 14.999 | 8.626 | 1.667 |
| Fosso do Dragão | Larva do Vazio (1) | 33,3% | 35–50 | 105 | ~10 | 16.152 | 9.290 | 1.615 |
| Covil do Barão | Criatura do Vazio (2) | 66,7% | 70–110 | 105 | ~9 | 21.365 | 12.474 | 2.374 |
| Covil do Barão | Dragão Ancião (filhote) (1) | 33,3% | 35–55 | 105 | ~9 | 21.365 | 12.474 | 2.374 |

Repare: a **recompensa é a mesma para todas as espécies da zona** (a recompensa usa `eq`, não `qtd`); o que muda é a quantidade que o cartão pede. Caçar a espécie rara (Tropa de Cerco, Sentinela Azul) pede **menos abates** pelo mesmo prêmio — mais fácil de completar, e é a melhor Caça da zona.

### 3.5 Fúria

| zona | qtd | abates equiv. | min estimado | XP | ouro | XP/min | ouro/min |
|---|---|---|---|---|---|---|---|
| Rota Inferior | 3 | 180 | ~7 | 3.955 | 2.791 | 565 | 399 |
| Rota Inferior | 4 | 240 | ~9 | 5.274 | 3.721 | 586 | 413 |
| Rota Superior | 3 | 180 | ~9 | 7.500 | 5.592 | 833 | 621 |
| Rota Superior | 4 | 240 | ~12 | 9.999 | 7.456 | 833 | 621 |
| Toca dos Lobos | 3 | 180 | ~11 | 10.644 | 6.772 | 968 | 616 |
| Toca dos Lobos | 4 | 240 | ~15 | 14.193 | 9.029 | 946 | 602 |
| Campo Azul | 3 | 180 | ~18 | 18.073 | 11.875 | 1.004 | 660 |
| Campo Azul | 4 | 240 | ~25 | 24.098 | 15.833 | 964 | 633 |
| Campo Vermelho | 3 | 180 | ~17 | 21.455 | 13.358 | 1.262 | 786 |
| Campo Vermelho | 4 | 240 | ~23 | 28.607 | 17.811 | 1.244 | 774 |
| Rio | 3 | 180 | ~16 | 20.257 | 11.383 | 1.266 | 711 |
| Rio | 4 | 240 | ~21 | 27.009 | 15.177 | 1.286 | 723 |
| Fosso do Dragão | 3 | 180 | ~17 | 27.690 | 15.926 | 1.629 | 937 |
| Fosso do Dragão | 4 | 240 | ~23 | 36.920 | 21.234 | 1.605 | 923 |
| Covil do Barão | 3 | 180 | ~16 | 36.626 | 21.384 | 2.289 | 1.337 |
| Covil do Barão | 4 | 240 | ~21 | 48.834 | 28.512 | 2.325 | 1.358 |

`eq = qtd × 60` porque 1 monstro furioso aparece a cada ~1/(0,05/3) = 60 abates (`motor.js:3258-3262`; `FURIOSO.chance = 0.05` e ~3 monstros por grupo, `motor.js:1106, 1124`).

### 3.6 Diárias

| nível | zona ideal | RIFT: XP | RIFT: ouro | RIFT: lendário | RIFT: min (1000 abates) | RIFT: XP/min | RUNETERRA: XP | RUNETERRA: ouro | RUNETERRA: lendário | RUNETERRA: XP/min |
|---|---|---|---|---|---|---|---|---|---|---|
| 1+ | Rota Inferior | 26.160 | 14.094 | 1,352% | ~37 | 706 | 51.012 | 18.604 | 2,808% | 1.377 |
| 5+ | Rota Superior | 49.600 | 28.243 | 1,395% | ~51 | 967 | 96.720 | 37.280 | 2,896% | 1.886 |
| 10+ | Toca dos Lobos | 70.400 | 34.200 | 1,731% | ~61 | 1.162 | 137.280 | 45.144 | 3,595% | 2.265 |
| 15+ | Campo Azul | 119.533 | 59.973 | 3,052% | ~103 | 1.165 | 233.090 | 79.164 | 6,339% | 2.273 |
| 20+ | Campo Vermelho | 141.900 | 67.467 | 3,215% | ~95 | 1.490 | 276.705 | 89.056 | 6,678% | 2.905 |
| 25+ | Rio | 133.975 | 57.488 | 3,499% | ~89 | 1.507 | 261.251 | 75.884 | 7,268% | 2.939 |
| 30+ | Fosso do Dragão | 183.133 | 80.433 | 4,000% | ~95 | 1.923 | 357.110 | 106.172 | 8,000% | 3.750 |
| 40+ | Covil do Barão | 242.233 | 108.000 | 4,000% | ~89 | 2.725 | 472.355 | 142.560 | 8,000% | 5.314 |

O prêmio é calculado com a **zona ideal do nível** (`zonaIdeal`, `motor.js:3267, 3390`), mas a **contagem** da diária do Rift aceita qualquer zona do Rift com monstro ≥ nível−5 (`motor.js:3359, 3406`). Ver §4.6.

### 3.7 Item da tarefa (`chancesItemTarefa`, `motor.js:3295-3298`)

`lendario = min(5%, q × ch.lendario × f)`, `epico = min(50%, q × ch.epico × f)`, com `q = abatesEquivalentes` e `f = ITEM_TAREFA.fatorZona = 0,3` (`motor.js:3294`). Tarefa "grande" (Desafio/Longa/Fúria) **garante** um item básico se não sair épico/lendário; "pequena" tem 30% (`ITEM_TAREFA.pequena = 0,3`, `motor.js:3294, 3300-3305`). O sorteio acontece **na entrega** (`motor.js:3462`).

| zona | Rápida/Normal (pequena) | Longa/Desafio/Fúria (grande) | Caça (pequena) |
|---|---|---|---|
| Rota Inferior | 12,48% épico / 1,00% lendário | 21,06% épico / 1,68% lendário | 10,07% épico / 0,81% lendário |
| Rota Superior | 9,87% épico / 0,74% lendário | 16,73% épico / 1,26% lendário | 8,15% épico / 0,61% lendário |
| Toca dos Lobos | 7,68% épico / 0,80% lendário | 12,67% épico / 1,32% lendário | 6,14% épico / 0,64% lendário |
| Campo Azul | 4,10% épico / 0,85% lendário | 6,84% épico / 1,41% lendário | 3,08% épico / 0,63% lendário |
| Campo Vermelho | 4,29% épico / 0,96% lendário | 6,93% épico / 1,56% lendário | 3,46% épico / 0,78% lendário |
| Rio | 5,25% épico / 1,13% lendário | 8,62% épico / 1,86% lendário | 4,12% épico / 0,89% lendário |
| Fosso do Dragão | 5,46% épico / 1,28% lendário | 8,82% épico / 2,07% lendário | 4,09% épico / 0,96% lendário |
| Covil do Barão | 6,51% épico / 1,55% lendário | 10,69% épico / 2,54% lendário | 4,88% épico / 1,16% lendário |

(colunas = quantidade mínima sorteada; a qualidade do item é sorteada pelo servidor, `motor.js:170-171`)

### 3.8 O que isso representa em nível e em risco

| nível | zona ideal | xpParaNivel(n) | XP de 1 tarefa Normal + os abates dela | tempo | tarefas p/ subir 1 nível | custo de 1 morte (10%) |
|---|---|---|---|---|---|---|
| 1+ | Rota Inferior | 762 | 7.199 + 16.742 = 23.941 | ~12 min | 0,0 | 76 (0,0 tarefas) |
| 5+ | Rota Superior | 4.050 | 9.811 + 22.816 = 32.627 | ~12 min | 0,1 | 405 (0,0 tarefas) |
| 10+ | Toca dos Lobos | 46.200 | 12.109 + 28.160 = 40.269 | ~12 min | 1,1 | 4.620 (0,1 tarefas) |
| 15+ | Campo Azul | 305.000 | 12.336 + 28.688 = 41.024 | ~12 min | 7,4 | 30.500 (0,7 tarefas) |
| 20+ | Campo Vermelho | 1.070.000 | 15.864 + 36.894 = 52.758 | ~12 min | 20,3 | 107.000 (2,0 tarefas) |
| 25+ | Rio | 3.120.000 | 16.131 + 37.513 = 53.644 | ~12 min | 58,2 | 312.000 (5,8 tarefas) |
| 30+ | Fosso do Dragão | 8.040.000 | 20.474 + 47.615 = 68.089 | ~12 min | 118,1 | 804.000 (11,8 tarefas) |
| 40+ | Covil do Barão | 51.000.000 | 29.165 + 67.825 = 96.990 | ~12 min | 525,8 | 5.100.000 (52,6 tarefas) |

`xpParaNivel` (`motor.js:427-429`): nv1 = 762 · nv5 = 4.050 · nv10 = 46.200 · nv11 = 95.200 · nv20 = 1.070.000 · nv25 = 3.120.000 · nv30 = 8.040.000 · nv40 = 51.000.000 · nv50 = 309.000.000; **total 1→50 ≈ 1,56 × 10⁹ XP**.
Morte custa `10% de xpParaNivel(nivel)` (`motor.js:430, 2763-2768`) — no nível 40+ **uma morte vale de 43 a 53 tarefas Normais** (43 no sorteio do meio, 53 na menor quantidade; a tabela acima usa a menor). Isso muda a decisão em zona perigosa (o Desafio na zona de cima, §4.5).

---

## 4. Regra de decisão

### 4.1 "Uma missão num mapa anterior vale a pena?" — a oferta não existe

`criarOfertas` (`motor.js:3310-3327`) monta as 3 ofertas só com:

- `z = zonaIdeal(estado.nivel)` = **a última zona cuja `faixa[0] ≤ nível`** (`motor.js:3267`) → nv 1–4 Rota Inferior · 5–9 Rota Superior · 10–14 Lobos · 15–19 Azul · 20–24 Vermelho · 25–29 Rio · 30–39 Dragão · 40+ Barão;
- `cima = zonaAcima(z)` = a zona imediatamente acima (`motor.js:3268`), **só** para o Desafio.

E `ofertasTarefa` regera a lista se `estado.ofertas.zona !== zonaIdeal(nivel)` (`motor.js:3427`) — ou seja, subir de nível **troca as ofertas na hora**.

Logo, uma missão "para trás" só existe em 3 casos: (a) você **aceitou** e não entregou antes de subir; (b) save antigo com tarefa no formato sem `tipo` (`motor.js:3284-3287`, gerador morto `criarOfertasAntigas`, `motor.js:3328-3345`, **nunca chamado**); (c) as diárias, que contam em qualquer zona que passe no teste de nível.

### 4.2 Se você tem uma tarefa antiga aberta: a recompensa é fixa e imune

- `recompensaTarefa` usa `porAbateZona(l)`, que usa `nm` da **zona** — **o seu nível não entra na conta** (`motor.js:3270-3275`).
- `entregarTarefa` paga `t.xp`/`t.ouro` **sem** `fatorXp`/`fatorSaque` (`motor.js:3464-3465`).
- Mas os **abates** que a tarefa exige são penalizados normalmente (`motor.js:1758, 1765`): em zona muito abaixo, o mob clampa em `nm[1]` (`motor.js:1119`) e `fator = max(0,1; 1 − 0,1×(nível − nm[1] − 5))` → **piso de 10%**.

Ou seja: **num mapa anterior a missão é a única renda que não é cortada** — mas ela é pequena em termos absolutos.

### 4.3 Quanto é preciso matar mais rápido para compensar (break-even)

Para a missão antiga empatar com a missão da zona ideal, a velocidade real na zona antiga tem de ser:

```
s ≥ [ z.xp(ideal) × ritmoZona(ideal) ] / [ z.xp(antiga) × ritmoZona(antiga) ]
```

| nível | zona ideal | zona antiga | taxa da missão (XP/min) | break-even de velocidade | penalidade nos abates (fator) | XP/abate real | ouro/abate real |
|---|---|---|---|---|---|---|---|
| 12 | Toca dos Lobos | Rota Inferior | 607 | ×1,64 | 90% | 47,09 | 25,37 |
| 12 | Toca dos Lobos | Rota Superior | 832 | ×1,20 | 100% | 99,20 | 56,49 |
| 20 | Campo Vermelho | Rota Inferior | 607 | ×2,11 | 10% | 5,23 | 2,82 |
| 20 | Campo Vermelho | Rota Superior | 832 | ×1,54 | 80% | 79,36 | 45,19 |
| 20 | Campo Vermelho | Toca dos Lobos | 999 | ×1,28 | 100% | 140,80 | 68,40 |
| 20 | Campo Vermelho | Campo Azul | 1.002 | ×1,28 | 100% | 239,07 | 119,95 |
| 30 | Fosso do Dragão | Rota Inferior | 607 | ×2,72 | 10% | 5,23 | 2,82 |
| 30 | Fosso do Dragão | Rota Superior | 832 | ×1,99 | 10% | 9,92 | 5,65 |
| 30 | Fosso do Dragão | Toca dos Lobos | 999 | ×1,66 | 30% | 42,24 | 20,52 |
| 30 | Fosso do Dragão | Campo Azul | 1.002 | ×1,65 | 80% | 191,25 | 95,96 |
| 30 | Fosso do Dragão | Campo Vermelho | 1.281 | ×1,29 | 100% | 283,80 | 134,93 |
| 30 | Fosso do Dragão | Rio | 1.296 | ×1,28 | 100% | 267,95 | 114,98 |
| 45 | Covil do Barão | Rota Inferior | 607 | ×3,86 | 10% | 5,23 | 2,82 |
| 45 | Covil do Barão | Rota Superior | 832 | ×2,82 | 10% | 9,92 | 5,65 |
| 45 | Covil do Barão | Toca dos Lobos | 999 | ×2,35 | 10% | 14,08 | 6,84 |
| 45 | Covil do Barão | Campo Azul | 1.002 | ×2,34 | 10% | 23,91 | 11,99 |
| 45 | Covil do Barão | Campo Vermelho | 1.281 | ×1,83 | 10% | 28,38 | 13,49 |
| 45 | Covil do Barão | Rio | 1.296 | ×1,81 | 30% | 80,38 | 34,49 |
| 45 | Covil do Barão | Fosso do Dragão | 1.654 | ×1,42 | 80% | 293,01 | 128,69 |

Exemplo (nível 45, Barão × Rota Inferior, tarefa Normal): `484,47 × 11,25 / (52,32 × 27) = 5.450 / 1.413 = **×3,86**` → seria preciso matar **~105 abates/min** na Rota Inferior.

**O teto de spawn impede isso.** No Rift a wave é de `2 + floor(rand×3)` = 2–4 monstros (`motor.js:1124`), o respawn depois de limpar é **1,5 s** (`motor.js:1625`) e cada monstro chega em `1,2 + k×0,25` s (`motor.js:1126`). Corpo a corpo **só acerta quem já chegou** (`motor.js:1446`), então o ciclo mínimo é `última chegada + 1,5 + 1,2`:

| wave | ciclo mínimo | teto |
|---|---|---|
| 2 monstros | 4,15 s | 28,9 abates/min |
| 3 monstros | 4,40 s | 40,9 abates/min |
| 4 monstros | 4,65 s | 51,6 abates/min |
| média (2–4 uniforme) | 4,40 s | **~41 abates/min** |

Ritmo nominal da Rota Inferior: 27/min. **Ganho máximo voltando para lá: ~×1,5** — muito abaixo do ×3,86 necessário. (Atiradores — Ezreal/Lux — podem acertar quem ainda está chegando (`motor.js:1446`, `chegadaExtra = 1,2` em `motor.js:1423`), então o teto deles é a própria cadência; ainda assim o limite duro do respawn é 3 monstros/1,5 s = 120/min, e atingi-lo exige one-shot em toda wave.)

**Conclusão:** começar uma missão de mapa anterior **nunca compensa**; a penalidade de nível derruba XP **e** ouro do abate (mesmo fator, `motor.js:424`) e a velocidade não escala o suficiente para pagar a diferença.

### 4.4 Terminar ou cancelar (a decisão que existe de verdade)

Se a tarefa antiga já está em andamento, o que importa é quanto **falta**. Com `f` = fração já feita, terminar compensa quando:

```
(1 − f) ≤ [ z.xp(antiga) × ritmoZona(antiga) ] / [ z.xp(ideal) × ritmoZona(ideal) ]
```

| nível | zona ideal | fração mínima já feita para valer terminar (por zona antiga) |
|---|---|---|
| 12 | Toca dos Lobos | Rota Inferior: **39%** · Rota Superior: **17%** |
| 20 | Campo Vermelho | Rota Inferior: **53%** · Rota Superior: **35%** · Toca dos Lobos: **22%** · Campo Azul: **22%** |
| 30 | Fosso do Dragão | Rota Inferior: **63%** · Rota Superior: **50%** · Toca dos Lobos: **40%** · Campo Azul: **39%** · Campo Vermelho: **23%** · Rio: **22%** |
| 45 | Covil do Barão | Rota Inferior: **74%** · Rota Superior: **65%** · Toca dos Lobos: **57%** · Campo Azul: **57%** · Campo Vermelho: **45%** · Rio: **45%** · Fosso do Dragão: **29%** |

(conta só com a recompensa da missão; somando a XP dos abates — mesmo a 10% — o limiar fica um pouco mais folgado)

### 4.5 O caso espelhado: o Desafio (mapa À FRENTE)

O Desafio é gerado **na zona acima** (`motor.js:3325`) e paga `T.xp = 0,44` / `T.ouro = 0,50`. A taxa nominal sobe, mas o mob enfrentado é mais duro (você está abaixo da `faixa` da zona, e o mob clampa em `nm[0]`, `motor.js:1119`):

| nível | zona ideal | desafio em | taxa nominal (XP/min): ideal → desafio | HP médio do mob: ideal → desafio | ganho líquido estimado |
|---|---|---|---|---|---|
| 1+ | Rota Inferior | Rota Superior | 1.413 → 1.934 (×1,37) | 155 → 523 (×3,38) | **×0,40** |
| 5+ | Rota Superior | Toca dos Lobos | 1.934 → 2.323 (×1,20) | 523 → 1.141 (×2,18) | **×0,55** |
| 10+ | Toca dos Lobos | Campo Azul | 2.323 → 2.331 (×1,00) | 1.141 → 2.990 (×2,62) | **×0,38** |
| 15+ | Campo Azul | Campo Vermelho | 2.331 → 2.980 (×1,28) | 2.990 → 3.998 (×1,34) | **×0,96** |
| 20+ | Campo Vermelho | Rio | 2.980 → 3.014 (×1,01) | 3.998 → 4.258 (×1,06) | **×0,95** |
| 25+ | Rio | Fosso do Dragão | 3.014 → 3.846 (×1,28) | 4.258 → 5.805 (×1,36) | **×0,94** |
| 30+ | Fosso do Dragão | Covil do Barão | 3.846 → 5.450 (×1,42) | 5.805 → 8.050 (×1,39) | **×1,02** |

"Ganho líquido estimado" = (taxa nominal) ÷ (vida média do mob) — **estimativa de primeira ordem** (HP é proxy; armadura, dano recebido e perfil do campeão não entram).

- **Níveis 1–10: armadilha** (×0,38–×0,55). O mob da zona de cima tem 2,2× a 3,4× a vida, e o prêmio não paga.
- **Níveis 15–29: empata** (×0,94–×0,96) — só vale se o seu dano "sobra" (one-shot/AoE limpa a wave mesmo com a vida maior).
- **Nível 30+: compensa um pouco** (×1,02) e é o único caso em que o Desafio é estritamente melhor.
- **Risco:** no nível 40+ a morte custa 5.100.000 XP = **43 a 53 tarefas Normais do Barão** (`motor.js:430`, §3.8). Em zona onde você apanha mais, a morte come o ganho.
- Em nível 40+ **não existe zona acima** → a 3ª oferta deixa de ser Desafio e vira outra opção da zona ideal (`motor.js:3325, 3268`).

### 4.6 Diária do Rift: onde caçar (o prêmio não depende da zona)

O prêmio é fixado pela **zona ideal** (`recompensaDiaria`, `motor.js:3390`), mas a contagem aceita **qualquer zona do Rift** com monstro ≥ nível−5 (`motor.js:3359, 3406`). Então dá para caçar onde o mob cai mais rápido:

| nível | zona ideal (define o prêmio) | zonas do Rift que ainda contam (nm[1] ≥ nível−5) | mob mais fraco disponível vs. o da zona ideal |
|---|---|---|---|
| 15 | Campo Azul | Rota Superior, Toca dos Lobos, Campo Azul, Campo Vermelho, Rio, Fosso do Dragão, Covil do Barão | Rota Superior: 1.489 hp vs 2.990 hp (×0,50) |
| 20 | Campo Vermelho | Toca dos Lobos, Campo Azul, Campo Vermelho, Rio, Fosso do Dragão, Covil do Barão | Toca dos Lobos: 2.376 hp vs 3.998 hp (×0,59) |
| 25 | Rio | Campo Azul, Campo Vermelho, Rio, Fosso do Dragão, Covil do Barão | Campo Azul: 5.164 hp vs 4.258 hp (×1,21) |
| 30 | Fosso do Dragão | Campo Vermelho, Rio, Fosso do Dragão, Covil do Barão | Campo Vermelho: 5.974 hp vs 5.805 hp (×1,03) |
| 35 | Fosso do Dragão | Rio, Fosso do Dragão, Covil do Barão | Rio: 5.901 hp vs 6.866 hp (×0,86) |
| 40 | Covil do Barão | Fosso do Dragão, Covil do Barão | Fosso do Dragão: 7.731 hp vs 8.050 hp (×0,96) |
| 45 | Covil do Barão | Covil do Barão | — |

- Nível 15: a diária pode ser feita na **Rota Superior** (mob com metade da vida do Campo Azul) — mesmo prêmio do Campo Azul.
- Nível 35: o **Rio** ainda conta e tem 14% menos vida que o Dragão.
- Nível 45: só o **Barão** passa no teste de nível (Dragão tem nm[1]=38 < 40).
- A mesma ideia vale para a diária de Runeterra (o prêmio vem de `zonaIdeal`, mas o bônus ×1,3 de Runeterra é aplicado, `motor.js:3391`).

### 4.7 O que muda o veredito (a missão ignora)

| multiplicador | afeta a caça? | afeta a recompensa da missão? | fonte |
|---|---|---|---|
| Penalidade de nível (`fatorXp`/`fatorSaque`) | sim (piso 10%) | **não** | `motor.js:421, 424, 1758, 1765, 3464` |
| VIP (`xp 1,2` / `drop 1,2`) | sim | **não** | `motor.js:145, 1764-1765` |
| Noturno (`xp×1,8`, `ouro×1,5`) | sim | **não** | `motor.js:1096-1101` |
| Furioso (`xp×5`, `ouro×5`) | sim | **não** | `motor.js:1106-1111` |
| Grupo de Runeterra (`1 + 0,15×3`) | sim | **não** | `motor.js:143, 1765` |
| Runeterra (`bonus 1,3`) | sim | só na diária de Runeterra | `motor.js:412, 3391` |
| Twitch (1–1,5) e evento de XP (1–3) | sim | **não** | `motor.js:1741-1747, 1765` |

**Regra:** a missão é um pagamento **fixo**. Quanto maior o seu ganho por abate, **pior** a missão relativamente; quanto menor (zona abaixo do nível, sem VIP, de dia), **melhor** a missão relativamente — e, no extremo (piso de 10%), a missão vira a única parte não penalizada.

---

## 5. Riscos e o que NÃO dá para saber só pelas fontes

1. **A velocidade real de abate é o termo dominante e não está no código.** `ABATES_MIN_ZONA` (`motor.js:3266`) é uma **medição** de bots, e `RITMO_REAL = 1,5` (`motor.js:3253`) é um multiplicador global "quem joga mata 1,5× mais rápido" (comentário em `motor.js:3251-3252`). Todo "por minuto" deste documento é **nominal**. Se o seu ritmo real for 2× o nominal, a missão continua pagando a mesma fração (42–44% da XP), mas o tempo cai e o **XP/min sobe** na mesma proporção — o que **não** muda a comparação entre zonas (o erro cancela), e sim a comparação com o tempo de viajar/entregar.
2. **O teto de spawn (~41 abates/min corpo a corpo)** é derivado de `respawn = 1.5` (`motor.js:1625`) + `chegada = 1.2 + k×0.25` (`motor.js:1126`) + alvo só "pronto" (`motor.js:1446`). Assume que a wave é limpa assim que o último chega; habilidades de área, kiting (`motor.js:2680-2691`) e o atraso do atirador (`chegadaExtra`, `motor.js:1423`) mudam o número. Vale como **ordem de grandeza**, não como medida.
3. **Servidor.** A diária é entregue só no servidor (`motor.js:3354`) e a rota `/api/diaria` **não está nas fontes** — não dá para confirmar o pagamento real, o anti-cheat, nem se há limite. O mesmo para `bonusXp` de grupo, `vipAte`, `bonusTwitch` e `bonusEvento`: o cliente só obedece (`motor.js:1741-1747`).
4. **Arquivos ausentes nas fontes:** `js/i18n/en.js` (dicionário EN — `i18n.js:5`), `runeterra.js` (zonas/cidades do mundo aberto), `dados-ezreal.js`, `dados-yasuo.js`, `dados-lux.js`, `dados-katarina.js`, `dados-taric.js`, `dados-zac.js`. Consequência: **em inglês os templates de §2 podem estar traduzidos** e a extensão precisa de um segundo conjunto de regex (em PT, os nomes de monstro aparecem em minúsculas no log e na fala do Capitão via `alvoTarefa`, `jogo.js:5499`; no HUD quem manda é `nomeTarefa`, `jogo.js:5500`).
5. **A versão que está no ar pode diferir de `docs/game-src`.** Não foi possível (nem era o escopo) conferir contra a página: o parse depende de `jogo.js:5479-5496, 6263-6284`, e qualquer mudança de template quebra a extensão. Um teste de fumaça contra o DOM real é obrigatório antes de confiar.
6. **Mochila cheia bloqueia a entrega** se a tarefa tiver item (`motor.js:3459`; `mochilaCheia` `motor.js:347`), e o item vai para a mochila como `~?` (qualidade revelada pelo servidor, `motor.js:3463`). Missão "grande" com mochila cheia = recompensa **presa**, não perdida.
7. **Recompensa de tarefa aceita antes de um rebalanceamento é limitada ao máximo recalculado** (`motor.js:3460-3461`): ela pode **cair**, nunca subir. Tarefa antiga guardada num save pode valer menos do que o cartão dizia.
8. **Não dá para saber do lado do cliente** quantos abates o jogador realmente faz por minuto, qual a DPS do campeão, nem o resultado do sorteio de item/qualidade (servidor). Toda a coluna "XP/min" é **nominal e determinística**; o resultado real depende do ritmo (§1) e dos multiplicadores de §4.7.
9. **Contradição conhecida:** a tabela de `motor-map.md` §4.4 (chances de drop por tier) **não reproduz** o código atual para os tiers 0–2. Com `BRUTO` (`motor.js:1143`) e `NIVEL_DO_TIER` = meio da **faixa** (`motor.js:1138`), o tier 0 dá lendário 0,0104% / épico 0,130% / básico 3,12% (doc: 0,0112% / 0,140% / 3,3549%); tier 2 dá 0,0133% / 0,128% / 1,76% (doc: 0,01498% / 0,144% / 1,9769%). Os tiers 3–7 batem exatamente. Os números de §3.7 usam **o código**, não o doc.

---

## Anexo — contas derivadas (para conferência)

- `z.xp` Rota Inferior = `CURVA.xp(3,5) × [(3/5)×1 + (2/5)×0,9]` = `(30+7×3,5) × 0,96` = `54,5 × 0,96 = 52,32` (`motor.js:277, 281-283, 3271-3273`).
- `z.ouro` Rota Inferior = `(8+3,5×3,5) × 1,45 × 0,96` = `20,25 × 1,45 × 0,96 = 28,19` (`balanco.js:2`, faixa 3–4 → `ouro 1,45`).
- Barão: `CURVA.xp(44) × [(2/3)×1,4 + (1/3)×1,5]` = `338 × 1,4333 = 484,47`; `z.ouro = (8+154) × 1,4333 = 216,00`.
- Break-even nível 45 Rota Inferior → Barão: `(484,47 × 11,25) / (52,32 × 27) = 5.450 / 1.413 = 3,86`.
- Teto de spawn: `3 / (1,7 + 1,5 + 1,2) = 3/4,4 = 0,682/s = 40,9/min`.
- `eq` da Fúria = `qtd × 3 / 0,05 = qtd × 60` (`motor.js:3262`).
- `xpParaNivel`: nv1 = 762 · nv10 = 46.200 · nv20 = 1.070.000 · nv30 = 8.040.000 · nv45 = 126.000.000 (`motor.js:427-429`).
