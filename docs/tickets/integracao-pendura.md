# PENDURA DO BANCO — CULPADO ISOLADO: `checarChefeFatal` (2026-10-15 07:35)

## Bissect completo (medição rígida: Start-Process + Kill aos 75 s + ler ficheiro)

| Estado | Resultado |
|---|---|
| HEAD (sem exports) | **termina** — 48 falhas, 14/25 suites verdes, 10 245 B |
| + 16 exports (todos) | **pendura** — 0 B em 80 s |
| + 14 "seguros" (sem funções de timers) | **pendura** — 0 B em 80 s |
| **+ 13 exports (sem `checarChefeFatal`)** | **termina** — 59 falhas, 14/25 suites verdes, 10 989 B |

**Conclusão:** o pendura é `checarChefeFatal` (ramo **w4-fuga**), que a suite `fuga` chama
(`auto.checarChefeFatal()`). Sozinho, ele trava o banco; sem ele o banco corre até ao fim.

## O que os exports revelaram (e é bom saber)
Com os 13 exports, o banco **corre** e passa de 48 para **59 falhas** — porque as suites deixam de
rebentar com "is not a function" (1 falha cada) e passam a **correr de verdade**, expondo as
divergências reais de comportamento entre o que os ramos implementaram e o que os testes esperam.
Ou seja: **a dívida de integração não era só exports** — era exports + comportamento. O número subir
é o sintoma de estar finalmente a medir o que interessa.

## Próximos passos (por ordem)
1. `checarChefeFatal` (w4): ler a função e achar o ciclo (provavelmente um `while` de tentativas sem
   tecto quando o stub não tem estado de chefe). Meter tecto → exportar → o banco volta a terminar.
2. Com os 14 exports no sítio, atacar as 59 falhas **por suite** (são asserções reais agora).
3. Medir SEMPRE com o método rígido + ficheiro (stdout por pipe perde-se).
