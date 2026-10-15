# !lolidle.com — Auto Poção para o LoL Idle

Extensão de navegador (Chrome/Edge, MV3) que usa **poções de vida** sozinha no
jogo `https://lolidle.com/jogar`, mantendo a barra de HP longe de esvaziar.

O jogo tem um auto-poção nativo, mas ele não funciona bem (escolhe a poção só
pelo buraco de HP e ignora o DPS recebido). Esta extensão lê o HP, **mede o DPS
recebido e a cura/s**, detecta chefe e decide a poção — combinando **normal +
forte** em vez de queimar a suprema.

## GUI (a forma de configurar)

O painel fica **invisível** e aparece quando você passa o mouse no **seu nome**
(canto superior direito, `#st-nome`). Nele você escolhe, por poção:
- **% do HP máximo perdido** (ex.: perdeu 21%) ou **HP flat perdido** (ex.: 879);
- vê o HP atual, o quanto já perdeu, e a tradução ao vivo
  (`perdeu 879 HP (21.0%) → usa com HP ≤ 3.309`);
- liga/desliga a extensão.

O popup (ícone da extensão) mostra o status e serve de liga/desliga reserva.

## O que a extensão faz

- Lê o HP do HUD (`#hud-vida-txt`), o alvo (`#hud-alvo`) e as poções do HUD
  (`#hud-pocoes [data-pocao]`).
- Mede o **DPS recebido** (queda de HP) e a **cura/s** (números verdes do
  canvas + subidas de HP), e o **DPS causado** (números de dano no canvas).
- Detecta **chefe** pelo log (`#log p.chefe`) e pela barra de chefe.
- Decide e clica no botão de poção de verdade (respeita cooldown de 1s, nível e
  quantidade do jogo).
- Faixas padrão: HP ≤ 900 → normal; ≤ 1800 → forte; ≤ 2500 → **combina**
  normal+forte (a suprema está bloqueada). Emergência usa a mais forte.

## Estrutura

```
extension/
  manifest.json   extensão MV3 (content scripts MAIN + ISOLATED)
  inject.js       hook do canvas (números de cura/dano) — world MAIN
  content.js      lógica: HP, DPS, cura, chefe, decisão e clique
  popup.html/.css/.js  UI (ligar/desligar, limites, stats ao vivo)
docs/
  lolidle-internals.md   TUDO medido do jogo: seletores, fórmulas, cores, mapa
```

## Instalar (manual)

1. Chrome/Edge → `chrome://extensions`.
2. Liga o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → seleciona a pasta `extension/`.

## Instalar (automático, silencioso)

Reusa o driver UIA do VOD.RIP (janela alpha-0, zero roubo de foco):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Administrador\Desktop\Nova pasta (3)\TESTE\VOD.RIP\backend\scripts\cookie_extension_auto_install.ps1" `
  -ExtensionDir "I:\!lolidle.com\extension" -Browser chrome
```

**Atualizar** = rodar o **mesmo** comando de novo, com `-Force`: o Chrome relê a
pasta e recarrega a extensão. Sem `chrome://extensions`, sem roubar foco.

Detalhes e armadilhas: `VOD.RIP/docs/extension-auto-install.md`.

## Documentação profunda

- **`docs/lolidle-internals.md`** — o mapa completo: como inspecionar o jogo via
  CDP (relay `:9224`), seletores, poções, fórmulas de dano, atributos do
  personagem, cores dos números no canvas, arquitetura da extensão, auto-install
  e projetos de referência (BrandOps / VOD.RIP / manager).

## Status

- [x] Levantamento do jogo (DOM, fórmulas, cores, atributos) — em `docs/`.
- [x] `inject.js` (hook do canvas), `content.js` (DPS/cura/chefe/combinação),
      `gui.js` (painel no hover do nome), `popup` (status), `background.js`.
- [x] Auto-install (driver VOD.RIP) + update por reinstall `-Force`.
- [ ] Calibrar o "meu DPS" e os limites padrão (hoje agressivos).
- [ ] Ver `TODO.md`.
