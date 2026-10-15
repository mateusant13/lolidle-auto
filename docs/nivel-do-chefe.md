# O nível do chefe — a regra dos "4 níveis acima" (TK-02-36)

> Ticket: TK-02-36 (P1) · branch w8-obs · data: 2026-10-14
> Pergunta do dono (parte-02.md:1618): *"é pra levar em conta a nova atualizacao do jogo
> sobre chefes serem no maximo 4 leveis acima de voce … nao sei o limite disso e nao sei as
> condicoes"*. Resposta: **a regra existe e está no código** — abaixo, com file:linha.

## A regra (motor.js:1128-1134, verbatim)

```
1128  // os monstros nascem perto do nível do jogador (de 2 abaixo a 1 acima), sempre dentro da faixa do lugar
1129  function gerarGrupo(local, noite = false, nivelJogador = null) {
1130    const [n0, n1] = local.nm, r = Math.random;
1131    const nivel = nivelJogador == null ? () => n0 + Math.floor(r() * (n1 - n0 + 1))
1132      : () => Math.max(n0, Math.min(n1, nivelJogador - 2 + Math.floor(r() * 4)));
1133    // furioso conta como chefe no automático (p632); o chefe nasce no nível do jogador + 4, entre o começo da zona + 2 e o topo + 2
1134    if (local.chefe && r() < local.chefe[1]) return [criarMonstro(local.chefe[0], nivelJogador == null ? n1 + 2 : Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4)), { chegada: 1.8 })];
```

**O nível do chefe = `Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4))`**, onde `n0..n1` é a
faixa `nm` do lugar. Ou seja: o jogador **+ 4**, nunca abaixo do **começo da zona + 2** e
nunca acima do **topo da zona + 2**. O comentário do próprio motor (motor.js:1133) diz
exactly isso: *"o chefe nasce no nível do jogador + 4, entre o começo da zona + 2 e o topo + 2"*.

### Condições (as três, todas obrigatórias)

1. **O lugar tem de ter chefe.** Só três têm (`LOCAIS` com campo `chefe`, ver abaixo). Nos
   outros lugares jamais nasce chefe.
2. **O sorteio da onda.** `r() < local.chefe[1]` — a chance de a onda ser de chefe, em vez de
   um grupo normal. Nos três lugares é **0,015 (1,5%)** por renovação de grupo. A onda de
   chefe tem **1 inimigo** (ao contrário das 2..4 do grupo normal, motor.js:1137).
3. **Quando o grupo nasce** (motor.js:1418-1421): a onda reforma-se quando a anterior morre
   toda (motor.js:1646) e o respawn de 1,5 s passa (motor.js:1646). O nível é fixado com o
   `estado.nivel` do momento (motor.js:1441 — a única chamada, por isso o ramo
   `nivelJogador == null` do :1134 não ocorre no jogo vivo).

Detalhe: o **furioso** (motor.js:1106, 5% de chance por grupo) *conta como chefe no
automático* — mas o nível dele é o da onda normal (motor.js:1127), não esta regra.

## O que isso dá, avaliado com o motor vivo (números, não cópias)

A tabela sai de `Math.max(n0+2, Math.min(n1+2, nivelJogador+4))` aplicado aos `LOCAIS` reais:

| Lugar | faixa `nm` | chefe | roll | nv1 | nv20 | nv29 | nv35 | nv40 | nv50 |
|---|---|---|---|---|---|---|---|---|---|
| Rio | 25–33 | Arauto do Vale | 1,5% | 27 | 27 | **33** | 35 | 35 | 35 |
| Fosso do Dragão | 30–38 | Dragão Infernal | 1,5% | 32 | 32 | **33** | 39 | 40 | 40 |
| Covil do Barão | 40–48 | Barão Nashor | 1,5% | 42 | 42 | **42** | 42 | 44 | 50 |

Leituras que importam ao dono (Katarina nv29):

- No **Barão**, o chefe nasce **42** com o boneco a 29 — **13 níveis acima**, não 4. O "+4"
  só manda quando o jogador já está dentro da faixa do lugar (nv40 no Barão → 44; nv45 → 49;
  nv50 → 50, onde trava no topo + 2).
- O "no máximo 4 níveis acima" é, portanto, **metade da regra**: a outra metade é o piso
  `n0 + 2`, que às vezes põe o chefe MUITO mais acima. O que nunca acontece é o chefe nascer
  abaixo de `n0 + 2`.
- O `chegada: 1.8` (motor.js:1134) dá ao chefe 1,8 s de aproximação antes de poder bater —
  os normais levam 1,2 s + 0,25 s por companheiro de onda (motor.js:1139).

## A lacuna do leitor está fechada — e era cópia velha, não regra do servidor

O leitor (parte-02.md:1643-1654) leu `Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador))` — **sem
o `+ 4`** — na cópia do `docs/game-src/` que havia no repo, e concluiu *"a regra dos 4 níveis
acima não aparece em lado nenhum … a cópia do jogo que temos pode estar desactualizada"*. Havia
mais: a cópia velha tem 54 linhas menos que a viva. **A regra existe no jogo vivo**; a cópia
é que estava atrasada. A cópia foi re-exportada (master f3dacf5) e agora o `docs/game-src/`
deste ramo contém a versão viva com o `+ 4` em motor.js:1134.

**Não é regra do servidor**: está no cliente, em motor.js. Nada a inventar, nada a perguntar
(REGRA N.o 2: está no motor.js, modela-se).

## Proveniência da exportação (para o relatório)

- Exportado do jogo vivo em **2026-10-14** via `https://lolidle.com/js/motor.js` (curl, sem
  browser) — cabeçalho do próprio ficheiro (motor.js:1-7): *"LIDO DO JOGO VIVO em 2026-10-14"*,
  com `sha256 e3bb66d4d8c6574d77fe6736aac783ca8b3b4e404b0b2983768baf77c176b8eb` do conteúdo
  buscado (285.082 bytes · 3.846 linhas).
- O ficheiro em disco = esses 3.846 linhas + 7 linhas de cabeçalho = 3.853 linhas,
  287.565 bytes; `sha256` em disco `7a62fad19ef5bb8a27b914046d8ef7bd9f5dce8cedc13583579789352828a83d`.
- A cópia anterior (desactualizada, sem o `+ 4`) ficou em
  `docs/historico/motor-anterior-desactualizado.js` (master f3dacf5).
- Todos os 30 ficheiros de `docs/game-src/` neste ramo são a exportação viva commitada no
  master (f3dacf5) — zero divergência de conteúdo.
