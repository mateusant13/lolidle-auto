# Instalar e verificar a extensão (resumo operacional)

Este doc é o **resumo curto** para um agente. O detalhe do mecanismo está em
`docs/instalar-extensao-uia.md` (copiado do VOD.RIP, a fonte) e a regra no `AGENTS.md` (REGRA Nº 10).

## Instalar / recarregar no perfil real (sem porta de debug)

```
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File install\instalar-extensao-uia.ps1 \
  -ExtensionDir "I:\!lolidle.com\extension" -Browser chrome
```

- Sai **uma linha JSON** no stdout: `{"ok":true,"installed":true,"extension_id":"..."}`.
- `-KeepWindow` deixa a janela alpha-0 aberta para inspecção quando falha.
- Verifica pelo `Secure Preferences` do perfil (`path` == a pasta), não pela página.
- Serve para **qualquer** extensão unpacked: o prelude do relay instala-se igual
  (`-ExtensionDir "C:\Users\<user>\.omp\browser-relay\extension"`).

## Verificar ao vivo (sem tocar no perfil do dono)

```
# 1. Chrome de laboratório: dir próprio + porta própria (por isso o CDP funciona)
#    --user-data-dir=C:\Temp\ll-prova --remote-debugging-port=9333
# 2. Extensions.loadUnpacked { path: "I:\\!lolidle.com\\extension" }
# 3. Abrir a página, ler o marcador discriminante no mundo isolado da extensão
node tools/_prova-lab.mjs
```

Marcador usado em 2026-10-18: `folhasDeReceitaFaltando` e `clicarIgnorarBasicos` (só existem no código
novo) → `function` no contexto isolado da extensão.

## O relay: liga o browser do dono, mas congela o jogo

```
omp config set browser.relay true
omp browser-relay serve -p 9224 --no-group     # HTTP/CDP em http://127.0.0.1:9224
```

- É a **causa medida** do travamento do jogo (bisecção no `JOGAR-SEM-RELAY.cmd`; reconfirmado 2026-10-18).
- **Matar o relay antes de carregar o jogo**; o jogo destrava com aba nova e o relay morto.
- Sem o prelude instalado, `/json` em 9224 devolve 503.
- Não há forma de ter o relay de pé **e** o jogo a correr: escolher um.

## O que NÃO fazer

- Não usar `--remote-debugging-port` no perfil real: o Chrome 136+ ignora-o por desenho (404/timeout).
- Não criar README nem descrição no GitHub (ordem do dono).
