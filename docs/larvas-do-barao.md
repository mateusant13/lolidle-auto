# As larvas do Barão e o efeito na matemática

> **Frente:** AS LARVAS DO BARAO E O SEU EFEITO NA MATEMATICA
> **Ficheiro de escrita:** só este (docs/larvas-do-barao.md). Nada em extension/ nem em tools/testes/.
> **Fontes (leitura):** docs/game-src/motor.js (mecânica), docs/game-src/cena.js (posição),
> docs/game-src/itens.js (catálogo), docs/game-src/balanco.js (planilha).
> **Regra de evidência:** todo o número tem file:linha. O que não está no repositório está marcado **NAO VERIFICADO**.
> **Nada aqui foi medido a jogar** (sem browser, sem CDP, sem partida): tudo é lido do fonte ou corrido num
> simulador determinista que reproduz o motor.js.

---

## 0. A RESPOSTA CURTA

| pergunta | resposta |
|---|---|
| quando nascem | **1.ª aos 6,8 s**; depois **a cada 34,3 s** (analítico: 14+1,3+9+1,0+9). Na grelha de dt = 0,05 s do jogo cai em 6,75 / 41,15 / 75,55... (motor.js:3084, 3076, 3131, 3123) |
| quantas | **2 por invocação** (motor.js:3117-3118) |
| onde | **4 a 6 tiles de distância** (Chebyshev), a caminhar até encostar no jogador (cena.js:629-632, 619) |
| com que stats | larva **nv36**: 5 550,6 HP · 367,8 AD · AS 0,8 · 59 armadura · **mágica** (motor.js:1070-1071, 273-279, 290) |
| quanto tempo vivem | **não expiram**: vivem até alguém as matar, ou até o jogador morrer/sair (motor.js:1625, 1346, 3046). Medido: **~18 s** na build IDEAL, **~4-9 s** na build AP |
| o jogador ataca-as automaticamente? | **NÃO**. O básico vai sempre ao Barão (motor.js:1446 + 884 + 1121 + 3118). Medido: dano de básico nas larvas = **0**. Só o dano em ÁREA as apanha |
| recarga de graça | **1,5 s na Q, na W e na E por larva** (motor.js:1789). 4 larvas = **12 s brutos / 8,64 s usados** = ~**+1 cast de Q** |
| ouro / XP | **67-134 ouro e 310 XP por larva**; 4 larvas = 372 ouro (medido) e 1 241 XP = **0,015% de um nível 30** |
| dano no jogador | **153 por golpe / 122,6 por segundo por larva** (nv30, RM 134). +8 383 dano por luta (+26,3%) |
| **o CDR de item vale menos ou mais?** | **vale o MESMO** — perde 3,7%, não mais. **0,236 s por 1% de CDR com larvas vs 0,245 s sem** (§3) |

### A correcção ao que está escrito em AGENTS.md (prova nº 3)

Lá diz "o Barão invoca 2 larvas a cada 14s". O **14 é outra coisa**: é o espera do invocar, o tempo até ao
**próximo** golpe do rodízio (motor.js:3076). O ciclo completo é
14 (espera do invocar) + 1,3 (carrega tentáculos) + 9 (espera) + 1,0 (carrega ácido) + 9 (espera) = **34,3 s**
(motor.js:3076, 3110, 3131). **São 2 larvas a cada 34,3 s, e não a cada 14 s.**
(Não posso editar o AGENTS.md — esta frente só escreve neste ficheiro. A correcção já ficou registada lá na
adenda de 2026-10-14 21:15, com a mesma conta; este documento usa o mesmo número e acrescenta a medição na
grelha de 0,05 s e o que a Katarina faz à cadência — §1.8.)

---

## 1. A MECÂNICA COMPLETA

### 1.1 Onde está e o que faz

    motor.js:3066  export const MECANICAS = { 'Arauto do Vale': 'investida', 'Dragão Infernal': 'sopro', 'Barão Nashor': 'invocar' };
    motor.js:3080  export const RODIZIO_CHEFE = { ..., 'Barão Nashor': ['invocar', 'tentaculos', 'acido'] };
    motor.js:3076  invocar: { carrega: 0, espera: 14, nome: 'Invocar Larvas' }

    motor.js:3117-3121
    if (tipo === 'invocar') {
      for (let k = 0; k < 2; k++)
        c.inimigos.push(criarMonstro('Larva do Vazio', Math.max(1, i.nivel - 6), { chegada: 1 + k * 0.3, invocado: true }));
      emitir(c, 'chefeInvoca', { alvo: i.id });
      i.tMec = HAB_CHEFE.invocar.espera;
      return;
    }

**Só no Rift.** O RODIZIO_CHEFE só é consultado em motor.js:3082, dentro de mecanicaChefe, que só corre a partir do
motor.js:1612, dentro do passo() do mundo. Em **Runeterra** o motor devolve o controlo à arena
(motor.js:1415: if (local.arena) { motorArena?.(...); return; }) e o Barão usa outra lista, **sem** invocar:
GOLPES_GUARDIAO = { 'Barão Nashor': ['pisao', 'tentaculos', 'acido'] } (arena.js:1659-1663).
**Conclusão: as larvas não existem em Runeterra. Só no Covil do Barão.**

### 1.2 O grupo do Barão é o Barão SOZINHO

    motor.js:1121  if (local.chefe && r() < local.chefe[1])
                   return [criarMonstro(local.chefe[0], Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4)), { chegada: 1.8 })];

    motor.js:371   { id: 'barao', nm: [40,48], ..., chefe: ['Barão Nashor', 0.015], ... }

Quando o grupo é de chefe, o array tem **um único elemento**. Os monstros que o dono vê "ao redor" no Barão são
**exactamente e só** as larvas invocadas — mais nada. (E o chefe aparece em 1,5% dos grupos da zona, motor.js:371.)

### 1.3 Quando nascem (a cadência exacta)

- **Início do relógio:** i.tMec ??= 5; i.mecK ??= 0; (motor.js:3084), e no MESMO tick já corre i.tMec -= dt
  (motor.js:3113) — por isso a 1.ª selecção é a 5 − dt, e não a 5. O mecanicaChefe só é chamado para monstros em
  prontos (motor.js:1612, com prontos = vivos.filter(i => i.chegada <= 0), motor.js:1444) e o Barão nasce com
  chegada: 1.8 (motor.js:1121). Relógio a arrancar a t = 1,8 s → 1.ª mecânica a **6,8 s** (analítico) ou **6,75 s**
  na grelha de dt = 0,05 (jogo.js:30). Medido: 6,75 s.
- **A 1.ª é sempre o invocar**, porque é o primeiro do rodízio (motor.js:3080) e mecK começa em 0 (motor.js:3084).
- **O ciclo:** 14 (espera do invocar, motor.js:3076) → tentaculos (carrega 1,3) → golpe → espera 9 (motor.js:3110) →
  acido (carrega 1,0) → golpe → espera 9 → invocar. Total analítico **34,3 s** (motor.js:3076, 3110, 3131).
  Na grelha de dt = 0,05 s do jogo (jogo.js:30) os cruzamentos caem em múltiplos de 0,05 e o intervalo medido sai
  **34,4 s** — é o mesmo 34,3 arredondado à grelha, não um valor diferente.
  Nota: nos golpes com carrega, o tMec só é reiniciado **no momento do golpe** (motor.js:3110), e só depois do aviso
  (motor.js:3123) — daí o 1,3 e o 1,0 contarem para o ciclo.

**Medido** (8 corridas, 2 builds):

| cenário | invocações (s) | intervalo |
|---|---|---|
| Katarina IDEAL nv30 | 6,75 · 41,15 | **34,4 s** (grelha; 34,3 analítico) |
| Katarina AP+Liandry nv32 | 6,75 · 33,45 · 59,65 · 94,05 | 26,7 / 26,2 / 34,4 s |

A cadência **encurta** quando a Katarina atordoa o Barão a meio do aviso — ver §1.8.

### 1.4 Quantas, em que nível, com que stats

criarMonstro('Larva do Vazio', max(1, i.nivel - 6), ...) (motor.js:3118) e criarMonstro (motor.js:1070-1071):

    hpMax    = CURVA.hp(n) * 1.1         ad = CURVA.ad(n) * 1.05      as = 0.8
    armadura = CURVA.armadura(n) * 1     xp = CURVA.xp(n) * 1.1       ouro = CURVA.ouro(n) * 1 * (0.5 + rand*0.5)
    magico   = true

Nível do Barão = max(42, min(50, nvJogador + 4)) (motor.js:1121, com nm [40,48] em motor.js:371) → **42 até ao nv38**;
larva = 42 − 6 = **nv36**. Com CURVA (motor.js:273-279) e ajuste(36) = 1 (balanco.js:2, faixa 21-60):

| estado | valor |
|---|---|
| HP | 5 550,6 (CURVA.hp(36) = 5 046 × 1,1) |
| AD | 367,79 (CURVA.ad(36) = 350,28 × 1,05) |
| AS | 0,8 (motor.js:290) → 1 golpe a cada **1,25 s** |
| armadura | 59 (CURVA.armadura(36)) |
| tipo | **mágica** (motor.js:290) → o dano dela é mitigado pela **resistência mágica**, não pela armadura |
| ouro | 67 a 134 (CURVA.ouro(36) = 134 × 0,5..1,0) |
| XP | 310,2 (CURVA.xp(36) = 282 × 1,1) |

**Por nível do jogador** (larva = nível do Barão − 6):

| jogador | Barão | larva | HP | AD | armadura | ouro (min-máx) | XP | golpe no jogador (RM 134) | dano/s por larva |
|---|---|---|---|---|---|---|---|---|---|
| nv25 | 42 | 36 | 5 551 | 368 | 59 | 67-134 | 310 | **242** | 193 |
| nv30 | 42 | 36 | 5 551 | 368 | 59 | 67-134 | 310 | **153** | 123 |
| nv32+ | 42 | 36 | 5 551 | 368 | 59 | 67-134 | 310 | 118-153 | 94-123 |
| nv40 | 44 | 38 | 5 933 | 398 | 62 | 71-141 | 326 | 128 | 102 |
| nv44 | 48 | 42 | 6 725 | 462 | 68 | 78-155 | 356 | 148 | 118 |
| nv46+ | 50 | 44 | 7 135 | 495 | 71 | 81-162 | 372 | 159 | 127 |

Nota de nível: a larva está **2 níveis acima** do jogador nv30, logo o jogador faz 86% do dano nela
(fatorDanoJogador, motor.js:1187: 1 − 0,07 × 2), enquanto no Barão (8 níveis acima) faz **44%** (motor.js:1187:
1 − 0,07 × 8, com piso 0,25 em motor.js:1184). É por isso que as larvas morrem muito mais depressa do que a curva de
vida sugere — e é a mesma assimetria que faz o dano DELAS nascer com factor 1,3 (motor.js:1186).

### 1.5 Em que posição

Só há posição no **Rift** (mundo). cena.js:615-647 (surgir), chamado do sincronizar (cena.js:687-688):

- cena.js:630-632: nasce num tile livre a distância de Chebyshev
  dist >= Math.max(4, v.distancia + 2) && dist <= Math.max(6, v.distancia + 3) → para a larva (distancia: 0,
  motor.js:1073) isto é **4 a 6 tiles** do jogador, escolhido ao acaso entre os candidatos livres.
- cena.js:619: o destino é um **vizinho** do jogador (vizinhos(alvo)), porque a larva é corpo a corpo.
- cena.js:639-640: caminha por caminho() a vel = clamp(inimigo.chegada / passos.length, 0,12, 0,5).
- chegada: 1 + k*0.3 (motor.js:3118): a 1.ª chega em **1,0 s**, a 2.ª em **1,3 s**.
- Em Runeterra as posições vêm do motor directamente (cena.js:747-756) — mas lá não há larvas (§1.1).

**Aviso visual:** motor.js:3119 emite chefeInvoca → cena.js:1532-1533
this.efeito('portal', v, 1); this.aviso(t('O Barão invoca larvas do Vazio!'), '#c070ff');
Ou seja: **é observável** — há um portal no Barão e um aviso no ecrã, 34,3 s antes de cada onda (e 1,0-1,3 s antes de
cada larva encostar).

### 1.6 Quanto tempo vivem

**Se ninguém as mata, vivem a luta inteira.** Não há relógio de expiração:

- o grupo só fecha quando **todos** morrem: motor.js:1625
  if (c.inimigos.length && c.inimigos.every((i) => i.morto)) { c.inimigos = []; c.respawn = 1.5; };
- só a morte do jogador (motor.js:1346 estado.local = 'fonte'; c.inimigos = []) ou a viagem
  (motor.js:3046 c.inimigos = []; c.respawn = 1.2) as faz desaparecer.

**Quantos golpes de área matam uma larva** (bruto do giro, motor.js:737, mitigado pela armadura mágica efetiva da
larva, motor.js:1202):

| build | dano do giro na larva | giros para matar 5 550 HP | dano do giro no Barão |
|---|---|---|---|
| IDEAL nv30 (AP 70, penMag 0) | 572 | **9,7** | 228 |
| AP nv32 (AP 714, penMag 0,55) | 1 400 | **4,0** | 707 |

**Na prática, com a Katarina a dar-lhes, morrem a:** (medido)

| build | ondas (nascem em) | morrem em | vida |
|---|---|---|---|
| IDEAL nv30 | 6,75 · 41,15 | 26,45 · 59,3 | **~18 s** cada |
| AP+Liandry nv32 | 6,75 · 33,45 · 59,65 · 94,05 | 14,55 · 38,05 · 66,75 · 105 | **~4-9 s** cada |

### 1.7 Quem lhes bate — e quem NÃO lhes bate

**O jogador NÃO as ataca automaticamente.** Prova, por ordem:

1. motor.js:884: a Katarina tem distancia: false → motor.js:1446 alvo = prontos[0] (não é "o mais perto dos vivos",
   é o primeiro da lista que já chegou).
2. O Barão é criado **primeiro** e sozinho no grupo (motor.js:1121); as larvas são **empurradas para o fim**
   (c.inimigos.push, motor.js:3118).
3. Logo, enquanto o Barão estiver vivo e chegado, prontos[0] === barão, e o ataque básico
   (motor.js:1608 golpeBasico(ctx, alvo)) vai todo para o Barão.

**Medido no simulador** (dano nas larvas por fonte, IDEAL nv30):

| fonte | dano nas larvas | o que é |
|---|---|---|
| **P** (giro da Voracidade) | 14 681 (**65%**) | giroAdaga, todos em volta (motor.js:2159-2171) |
| **Q** (Lâmina Saltitante) | 5 449 (24%) | até 3 alvos (motor.js:2275-2277) |
| **R** (Lótus da Morte) | 2 344 (10%) | os 3 mais perto (motor.js:2190) |
| **E** (Shunpo) | 271 (1%) | o que está a chegar (motor.js:2247) |
| **ataque básico** | **0** | vai ao Barão (§ acima) |
| A (Adaga Certeira) | 0 | acerta o que está a chegar; quando já chegaram, acerta o Barão |

Ou seja: **as larvas são um alvo de graça para as habilidades de área** — não desviam um único ataque básico do Barão.

### 1.8 A Katarina atordoa o Barão e isso muda a cadência das larvas

acoesKatarina.A() (motor.js:2254-2262) atordoa o alvo por 1 s (motor.js:752, atordoa: 1). Quando não há larvas a
caminhar, o alvo é o Barão — e mecanicaChefe corta o aviso:

    motor.js:3089  if (i.atordoado > 0 && tipo !== 'rugido') { i.carregando = 0; i.tMec = 6; emitir(c, 'chefeInterrompido', ...); return; }

Em vez de carrega + espera (1,3 + 9 = 10,3 s para os tentáculos; 1,0 + 9 = 10 s para o ácido) passa a custar **6 s**.
Se os dois forem interrompidos num ciclo, o ciclo cai de 34,3 s para **~26,4 s** e **nascem mais larvas**.

**Medido** (Katarina AP nv32, lutas de ~106 s):

| | invocações | larvas na luta |
|---|---|---|
| com A a atordoar | 6,75 · 33,45 · 59,65 · 94,05 | **8** |
| sem A | 6,75 · 41,15 · 75,55 · 109,95 | **6** |

(A build IDEAL nv30 não teve nenhuma interrupção nos 8 testes — é uma questão de fase entre os 8 s do cooldown do A e
as janelas de aviso, não de build. **Depende da temporização**, e é por isso que vale a pena medir, não assumir.)

### 1.9 Larvas por luta, em função da duração

    ondas  = 1 + floor((T − 6,75) / ciclo)        (ciclo 34,3 s, ou ~26,4 s se o A interromper)
    larvas = 2 × ondas

| duração T | ciclo 34,3 s | ciclo 26,4 s |
|---|---|---|
| 60 s | 4 larvas | 6 |
| 68 s (docs/sim-baron.md §5) | 4 | 6 |
| 106 s | 6 | 8 |
| 127 s | 8 | 8 |

---

## 2. O EFEITO NA MATEMÁTICA

### 2.1 A Voracidade — quanto vale, e quanto vale um item ao lado

    motor.js:736   P: { voracidade: 1.5, voracidadeChefe: 5, ... }
    motor.js:1789  if (HPk?.voracidade) for (const t of ['Q', 'W', 'E'])
                     d.recargas[t] = Math.max(0, d.recargas[t] - (i.chefe ? HPk.voracidadeChefe : HPk.voracidade));

**Por larva:** 1,5 s de recarga a sair da **Q, da W e da E** = 4,5 "segundos-habilidade". Na barra R/Q/A/E (a das duas
builds medidas, docs/sim-baron.md §5) a W nem está lá, por isso o que conta é **3 s por larva** (Q e E).

| larvas | bruto (Q+E) | medido a valer |
|---|---|---|
| 4 (IDEAL nv30) | 12,0 s | **8,64 s** |
| 8 (AP nv32) | 24,0 s | **17,99 s** |

(A diferença é o Math.max(0, ...) de motor.js:1789: quando a habilidade já está pronta, o abate não guarda nada.)

**Em casts** (média de 8 corridas, IDEAL nv30):

| | Q | E | giros |
|---|---|---|---|
| sem larvas | 9,13 | 13,00 | 17,0 |
| com larvas | 10,17 | 13,33 | 18,0 |
| **diferença** | **+1,04** | **+0,33** | +1,0 |

**A comparação com um ITEM** (o item é uma percentagem da recarga — motor.js:537 reducaoRecarga, aplicada em
motor.js:1581):

| fonte | CDR | Q extra (medido) |
|---|---|---|
| **4 larvas** | ~1,5 s absolutos × 4 | **+1,04** |
| **3024 Broquel Glacial** | 5% (itens.js:781) | — |
| **3158 Botas Ionianas da Lucidez** | 8% (itens.js:732) | **+0,87** |
| **3171 Lucidez Escarlate** | 15% (itens.js:1559) | **+1,55** |

Só existem **3 itens com CDR** em todo o catálogo de 108 (itens.js:732, 781, 1559), e o maior é a 3171 com 15%
(itens.js:1558-1559). A outra fonte de CDR é o atributo **Foco**: 0,004 por ponto com tecto de 30% (motor.js:537), e
o total tem tecto de **40%** (motor.js:537).

**Número:** as larvas de uma luta valem ~1,2× a bota de 8% (3158) e ~0,65× a melhor peça de CDR do jogo (3171).

### 2.2 O dano em área e a queima do Liandry

O giro bate **todos** os monstros em volta (perto() = chegada <= 0.5, motor.js:2179; giroAdaga corre um golpear por
alvo, motor.js:2165), mas o dano por alvo é **fixo** (HP.giro(nivel, adEfetivo) = 30 + 19·nivel + AP + 0,4·(AD −
ADbase), motor.js:737) — as larvas **não** aumentam o dano que o Barão leva. O que elas multiplicam é a **cura** do
giro:

    motor.js:2169-2170  const cura = (HP.curaBase || 0) + (HD?.curaGiro && rD ? HD.curaGiro[rD-1] : 0);
                       if (total > 0 && cura > 0) curar(estado, c, a, total * cura);

total é o **somatório** do dano em todos os alvos → com Barão + 4 larvas, a cura por giro é **5×** maior.

| build | cura do giro, sem larvas | com larvas | razão |
|---|---|---|---|
| IDEAL nv30 | 929 | **4 182** | ×4,5 |
| AP+Liandry nv32 | 5 640 | **13 170** | ×2,3 |

**Liandry (6653 Tormento de Liandry).** A queima é aplicada **por alvo**, em cada habilidade de PODER
(motor.js:1201 força poder = true; motor.js:1207):

    motor.js:1207  if (a.tem?.('6653')) alvo.queima = { dps: vidaRefItem(alvo) * 0.015, t: 3 };
    motor.js:1191  vidaRefItem(alvo) = Math.min(vida, 3 × CURVA.hp(alvo.nivel || 1))

Medido na build AP+Liandry nv32 (8 larvas):

| alvo | dano de queima |
|---|---|
| larvas | **3 591** (7% do dano total que lhes é dado) |
| Barão | 27 004 |

**Resposta honesta à pergunta do dono:** não, a queima do Liandry não vale mais por causa das larvas. A queima nas
larvas é 3 591 de dano — 13% do total de queima da luta — e é quase tudo **desperdiçado**: a larva morre ao giro
(5 550 HP em ~7 s) e 3 591 / 50 911 = 7% do dano que lhe dás. A queima no Barão até **desce** com as larvas
(28 376 → 27 004), porque a luta fica mais curta. O ganho real é **indirecto**, e são os abates: §2.1.

### 2.3 O dano que elas dão ao jogador — e as poções

inimigoAtaca (motor.js:1725-1737):

    i.ataque = 1 / i.as;                                       // 1 / 0,8 = 1,25 s
    const defesa = (i.magico ? a.rm : a.armadura) * (...);     // larva é mágica → RM
    receberDano(estado, c, a, mitigar(i.ad, defesa), false, i.magico, i);

receberDano aplica fatorDanoMonstro (motor.js:2696) e o papel do campeão (motor.js:2697; Katarina recebido: 0,75,
motor.js:885). Conta feita (jogador nv30, RM 134):

    mit(367,79 ; 134) = 157,2  ×  fatorDanoMonstro(30 ; 36) = 1,3  ×  0,75  =  153,2 por golpe
    × 0,8 golpes/s = 122,6 de dano por segundo, por larva viva

**Medido por luta** (média de 8 corridas; "dano das larvas" é o que elas causaram):

| build | duração | larvas | dano recebido sem → com | Δ | poções sem → com | Δ ouro em poções | ouro das larvas | **líquido** |
|---|---|---|---|---|---|---|---|---|
| **IDEAL nv30** | 60,8 → 60,0 s | 4 | 31 905 → 40 288 | **+8 383 (+26,3%)** | 21,3 → 25,7 | +705,5 | 372 | **−333,5** |
| **AP nv32** | 107,6 → 106,1 s | 8 | 41 154 → 45 806 | **+4 652 (+11,3%)** | 43,0 → 40,9 | **−285** | 841 | **+1 126** |

Variando a smart de poção (piso de 50/65/80/95% da vida; média de 8 corridas):

| IDEAL nv30 | poções sem → com | mortes sem → com |
|---|---|---|
| piso 50% | 20,4 → 24,0 | 1/8 → 3/8 |
| piso 65% | 21,3 → 25,7 | 0/8 → 1/8 |
| piso 80% | 28,5 → 31,3 | 0/8 → 0/8 |
| piso 95% | 28,6 → 38,1 | 0/8 → 0/8 |

**A build AP ganha poções com as larvas; a build AD perde.** A razão é a cura do giro (§2.2): na build AP o giro dá
**1 400 por alvo** (giro bruto 1 352 = 30 + 19·32 + 714, motor.js:737; mitigado por 15,9 de armadura mágica efetiva =
59 × 0,6 × (1 − 0,55 de penetração mágica), motor.js:1202), e a cura sobe ×2,3. Na IDEAL o giro dá **572 por alvo**
(bruto 750; fator de nível 0,86, motor.js:1187), a cura sobe ×4,5, mas o dano que as larvas trazem sobe mais.
(A smart de poção desta simulação é caseira — beber abaixo de X% da vida, 1 poção/s, motor.js:41. A contagem absoluta
de poções é, por isso, menos fiável do que a **diferença** entre os dois cenários, que é medida com o mesmo modelo.)

### 2.4 Ouro e XP — sim, dão; mas não contam para mais nada

Confirmado no processarAbates (motor.js:1751-1791):

| grandeza | dá? | onde |
|---|---|---|
| ouro | **SIM** | motor.js:1758-1759 (ouro = i.ouro * a.ouroMult * fs) |
| XP | **SIM** | motor.js:1765-1767 (xp = i.xp * fatorXp(...)) |
| itens | **NÃO** | motor.js:1770: itens = i.invocado ? [] : [...] |
| espólios | **NÃO** | motor.js:1776: i.invocado ? [] : [...] |
| gemas | **NÃO** | motor.js:1781: i.invocado ? [] : [...] |
| tarefa | **NÃO** | motor.js:1786 if (!i.invocado) contarTarefa(...) — "as larvas que o Barão invoca não contam (como na diária)" |
| diária | **NÃO** | motor.js:3403 if (i.invocado) return; em contarDiaria |
| totais.abates | **SIM** | motor.js:1759 → conquistas Primeiro Sangue / Centurião (1 000) / Carniceiro de Noxus (10 000), motor.js:3479-3481 |
| conquista de espécie | n/a | as únicas são Arauto/Dragão/Barão (motor.js:3485-3487) — nenhuma é Larva do Vazio |

Números (jogador nv30, fatorSaque = 1 porque a larva está acima do jogador, motor.js:421 e 424):

- **ouro por larva:** CURVA.ouro(36) × 1 × (0,5 + rand×0,5) = 67 a 134 (média 100,5) — motor.js:1071.
  Medido: **372 por luta** (4 larvas).
- **XP por larva:** CURVA.xp(36) × 1,1 = 310,2 — motor.js:1071. Medido: **1 241 por luta**.
- **Quanto é 1 241 XP:** xpParaNivel(30) = 8 040 000 (motor.js:427-429) → **0,015% do nível 30→31**.

**Nota:** fs = fatorSaque(estado.nivel, i.nome) (motor.js:1758 e 1765). Quando o jogador passa 5 níveis acima da larva
(a partir de nv41+), o saque começa a cair 10% por nível até um piso de 10% (motor.js:421) — ao nv44 a larva já dá 70%
do ouro.

---

## 3. A CONCLUSÃO — o CDR de item vale menos ou mais?

### 3.1 O que foi medido

Varredura de CDR sobre a build IDEAL nv30 (3172, 3153, 3031, 3036, 3046), 8 corridas cada, **só a contar as corridas
que mataram o Barão** (reducaoRecarga forçado directamente, que é exactamente o que motor.js:1581 lê):

| CDR | **sem larvas** t (s) | DPS | poções | **com larvas** t (s) | DPS | poções | larvas | Voracidade usada |
|---|---|---|---|---|---|---|---|---|
| 0% | 64,03 | 1 529,7 | 23,25 | 63,23 | 1 549,0 | 30,33 | 4 | 8,64 s |
| 8% | 63,04 | 1 553,9 | 21,88 | 61,81 | 1 586,2 | 26,17 | 4 | 8,41 s |
| 15% | 61,25 | 1 599,7 | 20,88 | 59,93 | 1 634,6 | 26,00 | 4 | 7,52 s |
| 20% | 59,98 | 1 633,6 | 18,88 | 58,46 | 1 675,9 | 22,88 | 4 | 7,00 s |
| 23% | 59,87 | 1 636,1 | 16,38 | 58,53 | 1 674,6 | 20,50 | 4,75 | 8,03 s |
| 30% | 57,86 | 1 692,9 | 16,13 | 57,02 | 1 717,5 | 22,75 | 4 | 10,04 s |
| 40% | 54,22 | 1 805,9 | 13,00 | 53,79 | 1 820,9 | 16,63 | 4 | 8,37 s |

### 3.2 O número

| | sem larvas | com larvas |
|---|---|---|
| 0 % → 40 % de CDR | **−9,81 s** | **−9,44 s** |
| por 1 % de CDR | **0,245 s** | **0,236 s** |
| DPS ganho | +276,4 | +271,9 |

# O CDR de item vale o MESMO com as larvas dentro: 0,236 s por ponto percentual, contra 0,245 sem. Perde 3,7%, não mais.

### 3.3 Porque não vale MENOS (a razão matemática)

A intuição "as larvas dão recarga de graça, portanto o CDR de item vale menos" está **certa em metade** e errada na
conclusão. As duas grandezas **não se substituem, multiplicam-se**:

- a Voracidade tira **segundos absolutos**: 1,5 s (motor.js:1789), independentemente da recarga;
- o CDR de item tira uma **fração** da recarga: d.recargas[t] = recarga × (1 − reducaoRecarga) (motor.js:1581).

Número de casts ≈ (T + V) / (C × (1 − c)), em que T é a duração, V os segundos de Voracidade usados e C a recarga
base. As larvas aumentam o **numerador**; o CDR multiplica **tudo** por 1/(1−c). Por isso as larvas aumentam o número
de casts — e **cada um desses casts também fica mais rápido com o CDR**. O valor relativo do CDR (não o absoluto) é
invariável: passar de c1 a c2 multiplica os casts por (1−c1)/(1−c2), aconteça V o que acontecer.

Foi exactamente isso que a varredura mostrou: 9,81 s vs 9,44 s — dentro do ruído de 8 corridas, e a fraca
desvantagem vem de dois efeitos secundários (não do mecanismo):

1. **parte da Voracidade é desperdiçada** (Math.max(0, ...), motor.js:1789): dos 12 s brutos de Q+E, só 8,64 s
   serviram — quanto mais CDR tens, menos a Voracidade vale, e portanto mais o CDR parece "já pago";
2. **as larvas consomem dano de área** que de outra forma iria para o Barão (medido: 43% do dano total da build AP
   em larvas) — o que se reflecte mais em DPS do que em tempo.

### 3.4 O que as larvas realmente mudam na decisão

| alavanca | efeito medido |
|---|---|
| **sobrevive?** | +26,3% de dano recebido na build AD. A margem da luta do Barão já é de ~1 poção (docs/sim-baron.md §7); com larvas, a smart caseira a 65% morreu em 1 de 8 corridas (0 de 8 sem larvas) |
| **mata em quantos segundos?** | −0,8 s (IDEAL nv30: 60,8 → 60,0) e −1,5 s (AP nv32: 107,6 → 106,1) — **ligeiramente mais depressa**, apesar de 19-43% do dano ir para as larvas |
| **poções / ouro** | IDEAL nv30: **+705 ouro** em poções, 372 de volta → **−333 por luta**. AP nv32: **−285 ouro**, 841 de volta → **+1 126 por luta** |
| **ouro/XP extra** | 372-841 ouro; 1 241-2 482 XP = 0,015% de um nível 30 |
| **CDR de item** | 0,236 s por 1%, contra 0,245 sem → **−3,7%** |

### 3.5 A conclusão do dono, corrigida

(Ele tinha concluído "CDR vale mais contra o chefe" e depois viu que as larvas dão abates de graça.)

- **"CDR vale mais contra o chefe"** — certo, e por uma razão que não eram as larvas: o **próprio abate do chefe**
  tira **5 s** da Q, da W e da E (motor.js:736 voracidadeChefe: 5, aplicado em motor.js:1789), contra 1,5 s por
  larva. Numa luta com 1 abate de chefe e 4 larvas, o chefe dá 5 s e as larvas 8,64 s — as larvas são **maiores**,
  mas nenhuma das duas substitui o CDR (§3.3).
- **"as larvas dão abates de graça"** — certo no valor (**≈8% de CDR, ~1,2× a Bota Ionianas 3158**), errado na
  consequência: não reduzem o valor do CDR de item, **somam-se-lhe**.
- **O número que faltava:** 0,236 s por 1% de CDR com larvas vs 0,245 sem → **o CDR de item não vale menos; vale 96%
  do que valia.** A decisão de item entre CDR e outra coisa **não deve mudar** por causa das larvas.
- O que **deve** mudar por causa das larvas é a **build de sobrevivência**: +26,3% de dano recebido na build AD,
  +705 ouro de poções, e uma morte a mais em 8. Quem luta o Barão com uma build de básico/AD leva as larvas como
  **custo líquido**; quem luta com a build AP (giro grande) leva-as como **lucro**.

---

## 4. MÉTODO, VALIDAÇÃO E LIMITES

### 4.1 O que foi corrido

Um simulador determinista escrito **inline** (nenhum ficheiro novo para além deste), com o motor reproduzido linha a
linha a partir de docs/game-src/motor.js: criarMonstro (1066-1075), CURVA/ajuste (273-279), mecanicaChefe
(3081-3125), inimigoAtaca (1725-1737), receberDano (2693-2697), golpear (1192-1233), acoesKatarina (2212-2287),
katarinaPasso (2173-2209), giroAdaga (2159-2172), processarAbates (1751-1791), prólogo do passo (1353-1363),
dt = 0,05 (jogo.js:30). O catálogo de 108 itens (itens.js:3) e a planilha de balanço (balanco.js:2) são os REAIS.
Stats do campeão e atributos: reutilizados do simulador existente tools/sim-chefes.mjs (statsJogador,
distribuirAtributos).

### 4.2 Validação contra o que já existia

| grandeza | simulador existente (tools/sim-chefes.mjs, lutarBarao) | este simulador |
|---|---|---|
| DPS no Barão (Katarina IDEAL nv30) | **1 430,7** | **1 610** |
| tempo a matar | **68,35 s** | **60,8 s** |
| dano recebido | 76 832 | 31 905 |

**A diferença tem causa conhecida e está do lado do existente, não do meu:** o dpsTeorico existente aproxima o bónus
do 3153 pelo **HP médio da luta** (16 620, sim-chefes.mjs:560-562), enquanto o meu usa o **HP actual** do alvo
(motor.js:1702: 0.05 * vidaRefItem(alvo, alvo.hp)), que ao longo de quase toda a luta está no tecto de
3 × CURVA.hp(42) = 18 342 (motor.js:1191) → ~917 em vez de ~831 por auto. O dano recebido difere porque o modelo
existente **nunca mata as larvas** (sim-chefes.mjs:736-740 ataca sempre, sem nunca as ferir), pelo que o dano delas
acumula a luta inteira.

**O que esta validação garante:** as duas correntes medem a mesma ordem de grandeza (DPS 1 430 vs 1 610, ~13%) e, o
que é o ponto, **todas as comparações deste documento são feitas dentro do MESMO modelo** (com larvas vs sem larvas
na mesma build, mesmo nível, mesmos seeds) — o viés do 3153 cancela nos dois lados.

### 4.3 Limites e o que NÃO foi verificado

1. **dados-katarina.js não existe no repositório** (motor.js:6 importa-o; confirmado pelo glob de docs/game-src/).
   hp / hpperlevel / armor / armorperlevel / spellblock / attackspeed / attackspeedperlevel são **NAO VERIFICADO** —
   vêm da calibração contra 1 ponto medido em docs/snapshots/katarina.json (ver docs/sim-baron.md §1). A RM e a
   armadura usadas nos números das larvas vêm daí.
2. **A smart de poção é caseira** (beber abaixo de 65/80/95% da vida, 1 poção/s). As contagens absolutas de poções são
   menos fiáveis do que a **diferença** entre cenários. docs/sim-baron.md §7 diz que a margem é ~1 poção.
3. **Nada foi medido a jogar** — sem browser, sem CDP, sem partida. Tudo é leitura do fonte ou simulação
   determinista. A extensão não foi tocada.
4. **A cadência de 34,3 s assume que ninguém interrompe o Barão.** (Medido na grelha de 0,05 s: 34,4 s.
   Outra medição independente, a 1/60 s, deu 34,3 s e invocações em 6,82 / 41,12 / 75,42 / 109,72 — registada na
   adenda do AGENTS.md. Os dois batem com o valor analítico; a diferença é só a grelha do tick.) Com a Katarina a atordoar (motor.js:3089) o ciclo
   desce a ~26,4 s e nascem mais larvas (§1.8). O número de interrupções depende da fase entre o cooldown do A e as
   janelas de aviso — foi 4 na build AP nv32 e 0 na IDEAL nv30.
5. **Não modela o kite** (K.kite, motor.js:1615) nem a regeneração natural (a.regen, motor.js:1356, que precisa dos
   ficheiros ausentes) — ambos conservadores ou neutros para a comparação.
6. **O número de larvas depende da duração da luta**: builds mais fracas (ex.: a do bot, 126,7 s —
   docs/sim-baron.md §5) apanham 8 larvas, não 4. Todos os "4 larvas" deste documento são da build IDEAL nv30.

### 4.4 Reproduzir

Não há ficheiro de simulador novo (esta frente só escreve este documento). Os números saem de um simulador inline,
com: dt = 0,05, 8 seeds (1..8), mulberry32; build ['3172','3153','3031','3036','3046'] nv30 / 
['3175','3089','3135','3100','6653'] nv32; barra R/Q/A/E e R/A/Q/E; ranks {Q10, E7/E8, R4, A9/A10, D9/D10}; Barão nv42
(motor.js:1121); larva nv36 (motor.js:3118).
