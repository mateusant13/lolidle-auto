# TK-07 — `scoreSet` sobrevaloriza CDR: o beam devolve 29,35 s em vez do ideal 25,7 s

**Prioridade:** P1 (o auto-play equipa uma build mensuravelmente mais lenta; o beam está certo, o
score que ele usa está errado).

**Write scope:** `extension/automation.js` (`contextoScore`, `scoreSet`, `fracAuto`) e
`tools/testes/build-beam.test.mjs`. Um escritor por ficheiro.

## Evidência (medida a 2026-10-22, motor real)

Fixture do TK-06: `HAB_RYZE` + `ITENS_DADOS` reais, `player` AP 1194 / mana 6465, alvo Barão nv32.

| conjunto | `scoreSet` | harness `+5~A` |
|---|---|---|
| ideal do ticket `3171,3003,3089,3100,3135` | **2374,1** | **25,70 s** |
| devolvido pelo beam `3089,3100,3135,4629,3171` | **2538,5** | **29,35 s** |
| greedy antigo `3089,6653,3135,4629,3171` | 2428,9 | 40,55 s |

O beam **não** é o problema: com `K=12`/`N=40` ele avalia o ideal e o devolvido; escolhe o devolvido
porque o `scoreSet` lhe dá 164,4 pontos a mais. O harness diz o contrário (25,70 < 29,35).

### Onde está a distorção (ler a fonte, REGRA Nº 1)

- `automation.js:10482-10486` — `fracHabs` é a fracção das **habilidades** no `dpsPorHabilidade`.
  Esse `dpsPorHabilidade` (`:2609-2674`) só lista habilidades; o auto-ataque não entra. Num mago sem
  `A` na barra, `fracHabs = 1` sempre.
- `automation.js:10520` — `fatorCdr = fracHabs / (1 - S.cdr) + (1 - fracHabs)`. Com `fracHabs = 1`,
  cada 15% de CDR vale **+17,6% em TODO o dano** — inclusive nos autos e nos procs, que o CDR não
  acelera da mesma forma.
- `automation.js:10527` — `d = (base * mit) * fatorCdr * ...`; o CDR entra como multiplicador global.
- `automation.js:10448-10460` — já existe `fracAuto()` que soma `p.dano * p.va` ao denominador. O
  `contextoScore` calcula `fracAutoV` (`:10488`) mas **não o usa** para o `fatorCdr`; usa-o só no
  crítico (`:10525-10526`).

O harness simula a luta com cast time/autos/mana; o `scoreSet` não. Enquanto o CDR for um
multiplicador global, o 4629 (15% CDR) ganha ao 3003 (3% da mana em AP) mesmo quando o motor diz que
o 3003 mata 3,65 s mais rápido.

## Acção

1. `contextoScore()`: calcular `fracHabs` a partir da **mesma** repartição que `fracAuto()` usa —
   `dh` (habilidades directas) contra `daH + p.dano*p.va` (autos/procs/passivas) — em vez de
   `dh/(dh+daH)` com `daH = 0` quando não há `A` na barra. Não chamar `dpsPorHabilidade()` duas vezes:
   reutilizar a lista já lida.
2. `scoreSet()`: o `fatorCdr` continua a ser `fracHabs/(1-cdr) + (1-fracHabs)`, mas com a fracção
   corrigida. O objectivo é o ideal do ticket ficar **acima** do 4629 no `scoreSet`, como já está no
   harness.
3. Não copiar números do harness para o código: a fracção vem do DOM/kit, o CDR do item, o resto do
   motor. Nada de `if (id === '3003')`.
4. Testes (`build-beam.test.mjs`):
   - B1d: `scoreSet(ideal) > scoreSet(devolvido)` (ideal do ticket vs `3089,3100,3135,4629,3171`).
   - B1e: `buildIdealPara(c)` devolve o conjunto ideal do ticket (ordem indiferente).
   - Manter B1a/B1b/B1c e B2–B7.
5. Mutação obrigatória: voltar a `fracHabs = dh/(dh+daH)` (a linha antiga) tem de fazer B1d/B1e
   falharem. Dizer no relatório que a mutação foi corrida.

## Critério de aceitação

- `node --check extension/automation.js` limpo.
- `node tools/testes/run.mjs --filter build-beam` rc=0 com B1d/B1e.
- Harness da build devolvida: `3171+5~A,3003+5~A,3089+5~A,3100+5~A,3135+5~A` → **25,70 s**
  (`--champ=ryze --nivel=32 --alvo="Barão Nashor" --nv=32 --maxSeg=180 --seed=1`).
- Relatório com `file:linha` e o resultado da mutação.

## Tentativa falhada (2026-10-22) — não repetir sem ler isto

Tentou-se a correcção mínima do ponto 1: `contextoScore()` passou a calcular
`fracHabs = dh / (dh + daH + p.dano*p.va)` e o fixture ganhou `Dano 157` / `Vel. ataque 1.09` e um
equipamento com Lich (tooltip sintetizado). Resultado medido:

- ideal devolvido: `3003,3089,6653,3135,3171` (troca o 3100 pelo 6653);
- harness desse conjunto: **37,30 s** (pior que os 29,35 s anteriores e que os 25,70 s do ticket);
- B2a: **2028 ms** > 2000 ms (o beam passou do orçamento de tempo do teste);
- B1b/B1c falham.

Revertido. **Conclusão:** incluir o auto na fracção do CDR não chega. O problema é o CDR ser aplicado
como `1/(1-cdr)` a TODA a habilidade, sem cast time nem limite de rotação; o 4629/6653 continuam a
ganhar. A correcção tem de modelar a taxa real de conjuração (cast time/GCD) ou usar uma medida de
luta, não apenas mudar o denominador de `fracHabs`.
