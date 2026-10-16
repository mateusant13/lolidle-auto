# RELATÓRIO PARA OS DEVELOPERS DO LOLIDLE — travamento ao entrar no jogo com uma conta específica

**Data:** 2026-10-16 · **Reportado por:** dono da conta `Scriptingkata` · **Reproduzível:** sim

## Sintoma
Ao abrir `https://lolidle.com/jogar` **com sessão iniciada**, o jogo carrega (o HUD aparece) e
**congela ~2 s depois**. A aba deixa de responder a qualquer execução de JavaScript; o separador
fecha lentamente. Sem erro na consola, sem diálogo, sem crash.

**Deslogado, o jogo corre normalmente** (mostra o menu: Mapa, Fonte, Status, VIP, Discord).

## Prova (A/B limpo, mesma máquina, mesmo Chrome 155.0.8059.80, mesmo GPU)
```
COM o token de sessão (lol-idle-token):  congela (0/9 sondas respondem)
SEM o token (localStorage.removeItem):  8/8 sondas respondem; o jogo renderiza o menu
```
Repetido em duas cópias independentes do perfil (uma delas **sem nenhuma extensão de VPN**),
sempre com o mesmo resultado. **O travamento não depende do navegador, do GPU nem das extensões.**

## Como reproduzir
1. Copiar o perfil do utilizador afectado para uma pasta nova.
2. Arrancar o Chrome com `--user-data-dir=<cópia> --remote-debugging-port=9222`.
3. Abrir `https://lolidle.com/jogar` numa aba nova e ligar `Network` + `Runtime` por CDP.
4. Observar: a página responde durante ~2 s e depois deixa de responder a `Runtime.evaluate`.
5. Contraste: `localStorage.removeItem('lol-idle-token')` + recarregar → a página responde sempre.

## Evidência de rede (captura CDP, aba nova, 30 s)
```
pedidos: 152 | concluídos: 151 | falhados: 2
ÚNICO pedido por concluir no instante do congelamento:  +1.8 s  [Script]  https://lolidle.com/js/pulso.js
```
O servidor serve esse ficheiro correctamente quando pedido directamente: **HTTP 200, 326 B,
`Content-Type: text/javascript; charset=utf-8`** (verificado 6×). O pedido fica **PENDENTE**, não falhado —
ou seja, o renderer parou com ele em voo; **não** é um bloqueio de extensão (isso falharia com
`ERR_BLOCKED_BY_CLIENT`). Noutra execução (sem a VPN instalada) o `pulso.js` **nem chegou a ser pedido** e
a página congelou na mesma — logo ele é o **local** onde o jogo parou, não a causa.

## Pontos no código a investigar (ficheiros servidos pelo vosso servidor)
| Ficheiro:linha | O que faz | Porque suspeito |
|---|---|---|
| `jogo.js:40` | `const sessao = await conectar()` | primeiro ponto dependente da conta |
| `jogo.js:65-82` | `carregar()` + `M.migrar(e)` | migração do estado da conta no arranque |
| `jogo.js:3001` | `fetch('/api/mercado?leve=1', { Authorization: Bearer })` | carrega o mercado/inventário da conta |
| `jogo.js:1611` | `new Worker('js/pulso.js')` | o Worker cujo pedido fica pendente |
| **`jogo.js:1613-1624`** | **`avancar()`**: `acum += dt` e **`while (acum >= DT) { M.passo(...); processarEventos(); acum -= DT; }`** | **laço de recuperação de passos: se `M.passo` for lento com um estado grande, `acum` cresce e o laço corre cada vez mais passos por quadro — a thread nunca devolve** |

**Hipótese principal:** o custo de `M.passo(estado, combate, DT)` com o estado desta conta é alto o
suficiente para o jogo não acompanhar 60 quadros/s; o laço de recuperação de `jogo.js:1624` entra em
espiral e bloqueia a thread principal. A conta tem muito progresso acumulado (itens, mochila, mercado).

## O que foi DESCARTADO por medição (para não repetirem)
GPU / aceleração de hardware · canvas 2D e `willReadFrequently` (implementado e refutado) · readback de
canvas · nº de abas e de renderers (testado com 28) · extensões (incluindo VPN, AdBlock, Privacy Badger —
testado **sem** elas) · reiniciar o Chrome (GPU novo, `crash=0`, sem dumps novos — travou igual) ·
versão do Chrome (.40 e .80) · perfil em si (uma cópia limpa reproduz) · espaço em disco · políticas.

## Pedido
1. Confirmar se `M.passo`/`processarEventos` têm custo proporcional ao tamanho do estado da conta.
2. Considerar um **tecto no laço de recuperação** de `jogo.js:1624` (ex.: máximo de passos por quadro) —
   hoje ele pode correr indefinidamente e bloquear a thread.
3. Se for esse o caso, a conta do utilizador ficou num estado que torna o passo caro: valerá a pena
   instrumentar o tempo de `M.passo` por conta.

## Contacto / dados disponíveis
Podemos fornecer: cópia do perfil (para reprodução), captura HAR/network completa, gravação de CPU
profile da aba antes do bloqueio, e a lista de extensões instaladas. Basta pedir.