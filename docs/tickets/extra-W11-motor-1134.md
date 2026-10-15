# TICKET EXTRA (W11) — a regra dos "4 niveis acima" do chefe EXISTE no motor vivo (TK-02-36 / TK-01-06)

**Prioridade**: P1 (muda o nivel de todos os calculos de chefe)
**Ficheiros**: docs/game-src/motor.js (leitura) + quem corrige os documentos (W8) e as
convencoes de nivel (W1)
**Quem encontrou**: worker W11, ao relocalizar por CONTEUDO a formula do nivel do chefe
(Lead, 22:06: "os motor.js:NNN dos tickets podem estar desviados em dezenas").

## Evidencia (motor.js VIVO, 3846 linhas)

```
motor.js:1129-1134
function gerarGrupo(local, noite = false, nivelJogador = null) {
  const [n0, n1] = local.nm, r = Math.random;
  const nivel = nivelJogador == null ? () => n0 + Math.floor(r() * (n1 - n0 + 1))
    : () => Math.max(n0, Math.min(n1, nivelJogador - 2 + Math.floor(r() * 4)));
  // furioso conta como chefe no automatico (p632); o chefe nasce no nivel do jogador + 4,
  // entre o comeco da zona + 2 e o topo + 2
  if (local.chefe && r() < local.chefe[1]) return [criarMonstro(local.chefe[0],
    nivelJogador == null ? n1 + 2 : Math.max(n0 + 2, Math.min(n1 + 2, nivelJogador + 4)),
    { chegada: 1.8 })];
```

Ou seja: **sim, ha um limite de 4 niveis acima do jogador para o chefe** - e a formula exacta e
`max(n0+2, min(n1+2, jogador+4))`.

## O que estava dito (e estava errado)

- `automation.js:1884-1887` (comentario do `checarChefeFatal`): *"o motor faz
  `Math.max(n0+2, Math.min(n1+2, nivelJogador))` (motor.js:1121). O dono falou de uma
  actualizacao do jogo que limita o chefe a 4 niveis acima do jogador, mas essa regra NAO esta
  em docs/game-src/ - fica a FORMULA DO CODIGO e a duvida registada (nada inventado)"*.
  A regra ESTA no motor, vivo. A formula citada (sem o `+4`) esta errada.
- `fila-W8.md` TK-02-36: *"Copia do jogo em docs/game-src/ pode estar desactualizada (regra
  dos '4 niveis' do chefe nao existe la)"* - a regra existe, em motor.js:1134.
- `fila-W1.md` TK-01-06: *"cinco convencoes de nivel para o mesmo mob/chefe"* - uma delas
  (`nm[1]+2`) e a que o `estimarLuta` usava; ja corrigida pelo W11 para a formula do motor.

## Consequencia medida (a que o W11 provou no banco)

Para o Covil do Barao (`nm: [40,48]`, motor.js:384-385): o chefe fica **PRESO em 42** ate o
jogador chegar ao nivel 38. A `estimarLuta` media contra o nivel 50 (`nm[1]+2`), ou seja
contra um chefe com **16xCURVA(50) = 122.400 de vida** em vez de **16xCURVA(42) = 97.824** -
a luta era estimada contra um inimigo que nao existe (25% mais vida).

## Fazer

1. W8: confirmar que a copia em `docs/game-src/` e a VIVA (o W11 mediu: o ficheiro actual tem
   3846 linhas e contem a formula) e fechar o TK-02-36.
2. W1: unificar as convencoes de nivel (TK-01-06) pela formula de motor.js:1134 - o W11 ja
   deixou `nivelDoChefe(local, nivelJogador)` exposto em `window.__lolidleAuto` com essa
   formula, que pode ser reutilizada.
3. Corrigir o comentario `automation.js:1884-1887` (a formula la escrita nao tem o `+4`).

## Aceitacao

Os documentos dizem a formula de motor.js:1134; `estimarLuta` e os seus consumidores usam uma
convencao so; o comentario do `checarChefeFatal` deixa de registar uma duvida que ja esta
resolvida no fonte.
