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


## ADENDA (07:40) — segunda causa de pendura encontrada e o estado final
O `checarChefeFatal` **não tem ciclos** (lido: 39 linhas, zero `while`/`for`). O que ele faz é
chamar `viajarPara(id)` por `setTimeout`. E o `viajarPara` (w4) tinha:

```js
if (!naBase()) {
  if (_viagemTent >= 3) { ...; _viagemTent = 0; return; }
  _viagemTent++;
  press('b');
  setTimeout(() => viajarPara(id), esperaRecallMs());   // ~9-10 s
  return;
}
_viagemTent = 0;          // <-- repunha o contador A CADA passagem
press('m');
```

No banco de testes os `setTimeout` resolvem-se como **microtask**: a recursão dispara imediatamente,
o contador repõe-se a cada volta e cria-se uma **cadeia infinita de timers** — o banco nunca termina.
Corrigi (repôr o contador só quando a viagem é de facto lançada, no clique do marcador) mas **o banco
continuou a pendurar**, logo há uma segunda cadeia (o `viajarPara` não é o único a reagendar-se por
`setTimeout` a partir de um caminho chamado pelos testes).

**Estado final desta ronda (commitado, `f1b0393`, medido com o método rígido):**
- **O banco TERMINA**: 59 falhas · 14/25 suites verdes · 10 988 B.
- Os 13 exports estão no sítio (`checarChefeFatal` NÃO está — é ele que faz pendurar).
- As 59 falhas são **asserções reais** (já não são "is not a function"): é o comportamento dos ramos a
  divergir do que os testes esperam. É o terreno certo para atacar a seguir, suite a suite.
- **Armadilha nova:** matar o processo `pwsh` **não mata o `bun` filho** — ele fica a correr e segura
  o ficheiro. Matar sempre `Get-Process bun | Kill` depois de cada medição.


## ADENDA 08:05 — a cadeia NÃO é a viagem
Experimento decisivo: **desliguei a única `setTimeout` que o `checarChefeFatal` agenda**
(`automation.js:2703`, `setTimeout(() => { _viagemAgendada = false; viajarPara(idReg); }, 8000)`) e
exportei o detector → **o banco CONTINUA a pendurar**.

Logo o ciclo está no **caminho síncrono do próprio `checarChefeFatal`**, antes do agendamento:
`podeFazer('fugir')`, `agregar()`, `localId()`, `estimarLuta(idReg)`, `readPotions()`,
`curaPocaoMax()` ou os getters `HEALVAL` (→ `pocaoInfo`). Suspeito principal: **`estimarLuta`**
(→ `avaliar` → `estimarSet` → `dpsPorHabilidade` → `freqSkills`), que só é exercido por este caminho.

**Próximo passo (barato e decisivo):** dentro do `checarChefeFatal`, pôr `logEvent('dbg:N')` entre
cada chamada (N = 1..7) e ver qual é o último N impresso antes do pendura. 2 minutos de trabalho,
sem adivinhar.

Nota: as minhas 3 tentativas anteriores falharam por **strings que não casavam** (a linha real tem o
`_viagemAgendada = false` dentro). Lição: **procurar a linha por regex e imprimi-la antes de editar** —
foi o que destravou este experimento.


## ADENDA 08:10 — nem antes do `estimarLuta` o pendura passa
Cortei o `checarChefeFatal` com `if (true) return;` **antes** da linha do `estimarLuta` e exportei →
**o banco continua a pendurar**. Logo o ciclo (se for ciclo) está nas primeiras linhas:
`podeFazer('fugir')` (hierarquia de interruptores, `while (n && INTERRUPTORES[n] && guarda++ < 16)`),
`readLocation()`, `localId()`, `agregar()` — ou **não é ciclo nenhum** e é outra coisa (ex.: o teste
`fuga` a fazer `await new Promise(setTimeout)` contra um stub cujo `setTimeout` é síncrono, ou uma
excepção engolida que deixa a promise pendurada).

**Próximo passo recomendado (muda de estratégia):** em vez de cortar o código, instrumentar o
**stub** — `dom-stub.mjs:393` já apanha excepções em `estado.erros`; pôr lá um contador de chamadas
ao `setTimeout` e um `throw` acima de 2000, para o pendura virar **erro com stack**. Se o erro
apontar para o teste (e não para o `automation.js`), o problema é do harness, não da extensão.

**Lição de método (3 tentativas perdidas):** editar por string exacta falha quando o ficheiro tem a
versão com guarda; **procurar a linha por regex, imprimir, e só depois editar**.


## ADENDA 08:15 — GUARDA NO STUB: o pendura virou erro (e a stack acusa o STUB)
Instrumentei o `setTimeout` do stub (`dom-stub.mjs:386-394`) com contador + `throw` acima de 3000:
```js
let __TO_N = 0;
const setTimeoutStub = (fn, ms) => { if (++__TO_N > 3000) throw new Error('STUB GUARD: >3000 setTimeout; stack=' + ...); … }
```
Resultado: **o banco TERMINA** (não pendura) e a stack do disparo é:
```
at setTimeoutStub (dom-stub.mjs:387)
at <anonymous> (dom-stub.mjs:394)
```
**A stack acusa o PRÓPRIO STUB** (linha 394 = o `fn()` dentro do `setTimeoutStub`), não uma linha do
`automation.js`. Ou seja: a cadeia que estoura é interna ao harness — o stub chama os callbacks
**sincronamente**, e o callback volta a agendar, tudo dentro da mesma pilha. **Isto aponta para o
harness, não para a extensão.**

**Ganho imediato:** com a guarda, um pendura (inútil para CI) passa a ser uma **falha com stack**
(acionável). Fica no repo.

**Próximo passo:** aumentar as frames da stack (`slice(1, 20)`) e imprimir o `String(fn)` completo no
erro — isso dá o nome da função do `automation.js` que está a reagendar, sem cortar código nenhum.
