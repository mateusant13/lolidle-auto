# Teste de builds — matriz (Rodar POR ÚLTIMO)

> Rabadon (`3089`) é **fixo** (é o multiplicador de AP; sem ele não se compara nada).
> 4 slots variáveis: **bota** · **slot-Lich** · **slot-Ímpeto** · **slot-Cajado**.
> Cada teste mexe **1 slot** (ou é "mix" declarado). Rodar no **Fosso do Dragão**.
> Por variação: **1 min de mobs** + **chefe até matar**. Medir **dano/xp/ouro/cura por min**
> e a **fatia de cor** (`#e8c840` = Lich, `#c07cff` = queima da Liandry).

## Perguntas-mestras
1. A passiva do **Lich** paga o slot?
2. O **2º item de CDR** (Ímpeto) paga o slot, ou o **cap 40%** o desperdiça?
3. **CDR × penetração** — qual multiplica melhor?
4. A **mistura** supera "só um ou outro"?
5. **Burn (Liandry) × pen (Cajado)** — quem rende em mob e em chefe?
6. O build ótimo **muda** entre mob e chefe?

## Itens
- Botas: `3171` Lucidez Escarlate (CDR) · `3175` Sapatos Enfeitiçados (pen 15%)
- `3100` Perdição de Lich (AP 156.4 +75% AP por skill) · `4645` Chama Sombria (AP 110, **+20% dmg mágico em alvo <40% HP**)
- `4629` Ímpeto Cósmico (AP 109.5, vida 547, CDR 23%) · `3135` Cajado do Vazio (AP 109.2, pen 40%)
- `6653` Tormento de Liandry (queima) · `3089` Rabadon (**fixo**, +35% AP)

## Matriz
| # | bota | slot-Lich | slot-Ímpeto | slot-Cajado | argumento (isola) |
|---|---|---|---|---|---|
| 1 | CDR | Lich | Ímpeto | Cajado | **referência** |
| 2 | **pen** | Lich | Ímpeto | Cajado | isola **bota**: CDR × pen |
| 3 | CDR | **Chama** | Ímpeto | Cajado | isola **Lich**: proc (c/ CDR) × finisher (cauda <40%) |
| 4 | CDR | Lich | Ímpeto | **Liandry** | isola **Cajado**: pen (armadura) × burn (todo alvo) |
| 5 | CDR | Lich | **Chama** | Cajado | isola **Ímpeto**: o 2º CDR paga o slot (cap 40%)? |
| 6 | CDR | Lich | **Liandry** | Cajado | isola **Ímpeto** (2ª amostra, outro ofensivo) |
| 7 | **pen** | **Chama** | **Liandry** | **Lich** | **mix ofensivo** (declarado) |
| 8 | CDR | **Chama** | **Liandry** | **Cajado** | **mix CDR+pen+burn+finisher** (declarado) |

## Como executar (DOM, sem clique na tela)
- Trocar o set: `window.__lolidleAuto.aplicarItens([...ids])` (`#mochila` equipa / `#equip` desequipa).
- Item que não está na mochila: `retirarDoCofre(alvo)` pega o **maior tier, depois maior refino** (cofre aberto).
- Cofre: `lerCofreSlots()` / `salvarCofre()` / `melhorDoCofre(alvo)`.
- Anúncios do dono: `lerMinhasOfertas()` (persistir no storage — "o que está anunciado").
- Rodar: entrar na região, cronometrar 1 min (mobs) e esperar o chefe; ler `analisarLutaBoss` + `farm.cycles`.

## GUI
- Botão **"Testar conjuntos"**: construtor onde o dono monta cada conjunto (slots), manda rodar,
  e persiste **conjunto → resultado** (pra refazer no futuro).
