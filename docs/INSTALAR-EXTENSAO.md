# INSTALAR A EXTENSÃO NO CHROME DO DONO — procedimento exacto (verificado 2026-10-16)

**Extensão**: `LoL Idle — Auto Poção` · id `pbdlekcgmpippamdkgbaphcppjafobjo`
**Código**: `I:\!lolidle.com\extension` (manifest v3, versão 0.4.0)

## O que o perfil dele JÁ tem (verificado)
```
Secure Preferences -> extensions.settings.pbdlekcgmpippamdkgbaphcppjafobjo:
    path     = I:\!lolidle.com\extension
    location = 4            (desempacotada)
    state    = (ausente)
Preferences -> extensions.ui = {}      <-- MODO DE PROGRAMADOR DESLIGADO
```
**Consequência medida:** com o Modo de programador desligado, o Chrome **desactiva** extensões
desempacotadas -> os content scripts **não correm** -> o jogo fica sem painel e sem auto-play.

---

## MÉTODO A — 1 clique (recomendado, permanente)
1. Abrir `chrome://extensions`
2. Ligar **"Modo de programador"** (canto superior direito)
3. Ligar o interruptor da **"LoL Idle — Auto Poção"**
4. `F5` no jogo

Fica instalada para sempre e sobrevive a reinícios.

---

## MÉTODO B — automático por CDP (sem cliques, mas exige porta de debug)
**Pré-requisito:** o Chrome tem de ter sido arrancado com `--remote-debugging-port=9224`.
O CDP **do relay** não serve (não tem o domínio `Extensions`).
```powershell
# 1) arrancar o Chrome com porta de debug (UMA vez)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data" `
  --remote-debugging-port=9224 --no-first-run --restore-last-session
# 2) carregar a extensão (devolve o id; foi assim que a pus a correr no Chrome dele)
bun tools/instalar-extensao.mjs
```
O script faz: `Extensions.loadUnpacked {path}` -> confirma o id -> **recarrega a aba** -> verifica que
apareceu um contexto `chrome-extension://pbdlekcgmpippamdkgbaphcppjafobjo` -> liga o auto-play
(`setConfig({enabled:true, regionDefault:'rota-sup'})`).
**Verificado**: `loadUnpacked` devolveu `{"id":"pbdlekcgmpippamdkgbaphcppjafobjo"}` e o contexto da
extensão apareceu (`__lolidleAuto` = object).
**Limite honesto**: `--load-extension` sozinho (sem debug port) **não** injecta no Chrome 155 —
testado e falhou. O caminho automático é o `loadUnpacked` com a porta aberta.

---

## MÉTODO C — escrever o perfil com o Chrome fechado (persistente, sem cliques)
1. Fechar o Chrome.
2. Em `Secure Preferences`, na entrada do id: `state = 1` e **remover** `disable_reasons`.
3. Em `Preferences`: `extensions.ui.developer_mode = true`.
4. Arrancar o Chrome.
**Aviso medido**: o `Secure Preferences` é protegido por HMAC (chave no `Local State`). Edições
inconsistentes fazem o Chrome **ignorar/repor** a entrada — foi o que aconteceu quando tentei na
cópia (`C:\Temp\ll-full`). Por isso o Método A é o mais fiável.

---

## Verificar que ficou instalada (sem cliques)
```powershell
bun tools/instalar-extensao.mjs --verificar
```
Mostra: o id carregado, se existe contexto `chrome-extension://`, e o estado do auto-play
(`enabled`, região escolhida e as regiões onde sobrevive).

## Auto-play: o que fica configurado
- `enabled: true`
- `regionDefault: 'rota-sup'` (**Rota Superior** — a melhor onde sobrevive: score 9725 vs 4925)
- objetivo `ouro+xp`
A escolha vem do `rankRegioes()` filtrado por `sobrevive` (fail-closed: só onde ele **prova** que
sobrevive).

## Depois de instalada
O painel **⚙ Auto-play** aparece no jogo. Ele vai à Fonte, repõe-se e viaja para a Rota Superior.
