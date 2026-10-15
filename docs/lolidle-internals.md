# LoL Idle — internals do jogo (para a extensão de auto-poção)

Status: ativo. Este é o mapa do que já foi **medido ao vivo** no jogo
`https://lolidle.com/jogar` (conta `Scriptingkata`, campeã **Katarina**), para a
extensão não precisar redescobrir o DOM, as fórmulas e os seletores.

> Medições de 2026-10-13. O jogo muda; se um seletor não bater, **remeça** pelo
> caminho em §1 e corrija aqui.

## 1. Como inspecionar o jogo (CDP pelo relay do dono)

O canal é o relay CDP do manager (`ws://127.0.0.1:9224/cdp`), nunca
`--remote-debugging-port` (morto no perfil real). Driver pronto, que anexa a
**um** target por id e desanexa no fim:

```bash
# 1) achar o target do jogo (sem vazar as outras abas)
node -e 'fetch("http://127.0.0.1:9224/json/list").then(r=>r.json()).then(a=>{const g=a.filter(t=>/lolidle/.test(t.url||""));console.log(g.map(t=>t.id+" "+t.url).join("\n"))})'

# 2) avaliar JS no jogo (uma linha JSON na saída)
bun "I:/!manager/tools/ext-reload-cdp.mjs" --target "<TARGET_ID>" --expr 'JSON.stringify({hp:document.querySelector("#hud-vida-txt")?.textContent})'

# com getEventListeners / APIs de console:
bun "I:/!manager/tools/ext-reload-cdp.mjs" --target "<TARGET_ID>" --call Runtime.evaluate \
  --params '{"expression":"...","includeCommandLineAPI":true,"returnByValue":true}'
```

O `TARGET_ID` é **efêmero** (muda a cada reload da aba). Sempre re-listar.
Referências: `I:/!manager/playbooks/attach.md`,
`I:/!manager/playbooks/browser-disconnect-protocol.md`,
`docs/browser-connection.md` do BrandOps (receita consolidada do relay).

## 2. O jogo por dentro (arquivos)

O jogo é um app JS em `https://lolidle.com/js/`. Arquivos que importam:

| arquivo | papel |
|---|---|
| `motor.js` (7048 linhas) | regras: atributos, poções, dano, monstros, loot, nível |
| `arena.js` | Runeterra (controle): habilidades, curas, spawn |
| `cena.js` | renderização no canvas `#tela` (números de dano/cura) |
| `jogo.js` | UI, HUD, teclado, painéis, log |

O estado (`estado`) vive no closure do módulo e **não** é global nem vai para
`localStorage` (só settings). Dá para ler tudo pelo DOM + canvas hook.

## 3. Seletores do DOM (medidos)

| o quê | seletor | conteúdo |
|---|---|---|
| HP atual/máx | `#hud-vida-txt` (fallback `#st-vida-txt`) | `"4112 / 4188"` |
| barra de HP (largura) | `#hud-vida` | `style="width: 98.18%"` |
| botões de poção no HUD | `#hud-pocoes [data-pocao="<k>"]` | `<b>` = quantidade |
| poções (painel inventário) | `#pocoes [data-pocao="<k>"]` | idem |
| poções (aba Auto, só leitura) | `#auto-pocoes .auto-pocao` | sem `data-pocao` |
| alvo atual | `#hud-alvo` | `Arraia do Rio nv 25 ☾ noturno` |
| nome do alvo | `#hud-alvo b` | `Arraia do Rio` |
| nível do alvo | `#hud-alvo small` | `nv 25` |
| barra de vida do alvo | `.alvo-vida` | — |
| log de combate | `#log` (`.canal`) | `<p class="loot|chefe|...">` |
| nível do jogador | `#hud-nivel`, `#st-nivel` | `27` |
| local de caça | `#local-nome` | `Rio nível 25–35` |
| atributos alocados | `.atrib-nome` (Força/Vitalidade/…) | `Força78` |
| stats derivados | painel `.corpo` (aba Atributos) | `Dano154 Armadura154 …` |
| campeão | `#hud-retrato[data-qual]` | `katarina:0` |

**Classes de estado do botão de poção:** `zero` = quantidade 0; `bloq` =
nível abaixo do exigido. Um botão sem essas classes está disponível.

## 4. Poções (motor.js:261-267)

```js
POCOES = {
  vida:  { nome: 'Poção de Vida',         cura: 300,  nivel: 1  },
  vidaF: { nome: 'Poção de Vida Forte',   cura: 900,  nivel: 15 },
  vidaS: { nome: 'Poção de Vida Suprema', cura: 2200, nivel: 30 },
  mana:  { cura: 100, nivel: 1 }, manaF: { cura: 280, nivel: 15 },
}
```

`usarPocao(estado, combate, chave)` (motor.js:1291): devolve `false` se sem
poção, `d.timers.pocao > 0`, morto, ou nível < `p.nivel`. Cura `p.cura` (PvP:
50%). **Cooldown `EXAUSTAO = 1s`** (PvP `POCAO_PVP.exaustao = 3s`).

O clique real: o jogo escuta `#hud-pocoes` e chama `M.usarPocao` — a extensão
só precisa de `botao.click()`. Teclas `1..5` também usam poção (motor via
`jogo.js:1248-1251`).

## 5. Fórmulas de combate (motor.js)

```js
mitigar      = (dano, arm) => dano * (100 / (100 + Math.max(0, arm)))   // :1160
CURVA.hp(n)  = (150 + 100n + 1.0n²) * ajuste(n).vida
CURVA.ad(n)  = (9 + 4.8n + 0.13n²) * ajuste(n).dano
CURVA.armadura(n) = 5 + 1.5n
ajuste(n)    = BALANCO.find(f => n>=f.de && n<=f.ate)   // balanco.js
NIVEL_DIF    = { livre: 4, danoMonstro: 0.15, maxDanoMonstro: 3 }        // :1177
difNivel(estado,m)         = max(0, m.nivel - estado.nivel - 4)
fatorDanoMonstro(estado,m) = min(3, 1 + 0.15 * difNivel)
```

Ataque do monstro no jogador (motor.js:1714-1715):

```
defesa  = (m.magico ? a.rm : a.armadura) * (1 + 0.01*d.disciplina + …)
dano    = mitigar(m.ad, defesa) * fatorDanoMonstro(estado, m)
receberDano(...) ainda multiplica pelo papel do campeão: papel.recebido
```

**Chefes** (motor.js:295-297): `Arauto do Vale { hp:10, ad:2.5, as:0.6, armadura:1.5 }`,
`Dragão Infernal { hp:12, ad:3, as:0.55, magico }`, `Barão Nashor { hp:16, ad:3.2, as:0.5, magico }`.
Spawn: `criarMonstro(local.chefe[0], n1 + 2)` com chance 1.5% (`motor.js:1114`),
onde `n1` é o teto da faixa do local. **Katarina `papel = { dano:1.37,
recebido:0.66, recebidoArena:0.7, pvp:0.5, pvpRecebido:0.69 }`** (motor.js:892).

## 6. Atributos do jogador (medidos 2026-10-13)

`Scriptingkata`, **Katarina**, nível **27**, VIP, HP máx **4188**.
Painel de atributos: `Dano 154 · Armadura 154 · Vel. ataque 1.13 ·
Res. mágica 123 · Poder 1050 · Crítico 0% (×1,75) · Recarga −23%`.
Alocados: `Força 78` (todo o resto 0). Local de caça: **Rio, nível 25–35**.

Dano recebido do Arauto (exemplo, nível do boss ≈ teto da faixa + 2 = 37):
`difNivel = 37-27-4 = 6` → `fator = min(3, 1+0.9) = 1.9`; `CURVA.ad(37)` ×
`m.ad(2.5)` mitigado por armadura 154 → `×100/254` → `×1.9` → `×0.66 (papel)`.
A extensão prefere **medir** o DPS real (ver §8) em vez de depender disso.

## 7. Cura e números flutuantes (canvas `cena.js`)

Números são desenhados no canvas `#tela` (não há DOM de texto flutuante):

| número | cor (`fillStyle`) | onde |
|---|---|---|
| cura (poção/habilidade) | `#40e060` | cena.js:1503, 2518, 3945 |
| escudo | `#c8ff8a` | cena.js:2448 |
| mana | `#5aa8ff` | cena.js:1503 |
| dano físico | `#ff6a3a` | cena.js:921 |
| dano mágico | `#c070ff` | cena.js:921 |
| dano verdadeiro | `#ffffff` | cena.js:921 |

Cura por habilidade (Katarina): passiva **Voracidade** (`motor.js:735`),
**Sede de Sangue** (`curaSede: 0.3`, motor.js:748), `curar()` em motor.js:1277.
A captura é feita por hook de canvas em `world: "MAIN"` (ver §9).

## 8. Chefe / ondas

- O log (`#log`) recebe `<p class="chefe">`:
  `"05:22 Um chefe apareceu: Arauto do Vale!"` e `"… foi derrotado!"`.
- Há um indicador `👑 <nome>` e a barra de chefe no canvas.
- **Antes do chefe**: ondas de monstros que morrem rápido → qualquer medida
  "por segundo" tem buracos (o alvo some entre ondas). Medir DPS só com alvo
  presente (`#hud-alvo` não vazio).
- **Chefe**: esponja de dano → o que importa é DPS meu, DPS recebido e cura/s
  para decidir poção.

## 9. Arquitetura da extensão (`extension/`)

```
extension/
  manifest.json   MV3; content scripts MAIN (inject) + ISOLATED (content, gui);
                  permissão storage; service worker background.js
  inject.js       world:MAIN — hook de CanvasRenderingContext2D.fillText no
                  canvas #tela; posta {__lolidle:'heal'|'shield'|'dmg', value}
  content.js      ISOLATED — lê HP/alvo/poções, mede DPS/cura/poções por
                  segundo, detecta chefe, decide e clica; grava status
  gui.js          ISOLATED — painel in-page (hover no nome #st-nome), invisível
                  por padrão; limite por % perdido ou HP flat perdido
  background.js   service worker — self-reload via mensagem/storage (fallback)
  popup.html/.css/.js — status + ligar/desligar (a config vive na GUI)
  install/ (fora de extension/) — reload-extension.ps1 (UIA), dump-ext.ps1
```

**Fluxo:** `inject.js` (MAIN) captura os números do canvas → `postMessage` →
`content.js` (ISOLATED) acumula DPS/cura → a cada tick lê `#hud-vida-txt`,
`#hud-alvo`, `#hud-pocoes` → decide → `botao.click()` → grava status em
`chrome.storage.local` → `popup.js` lê o status.

**Política (v0.3, configurável na GUI):**
- Cada poção tem um limite por **HP perdido**: `mode:'pct'` (% do HP máx
  perdido) ou `mode:'lost'` (HP flat perdido). O gatilho é
  `HP ≤ máx − perdido`. Padrões: P1 21%, P2 43%, P3 60% (≈ 900/1800/2500 no
  máx 4188).
- Faixas da mais forte (HP mais baixo) para a mais fraca: HP ≤ gatilho(P3) →
  P3 (ou **combina P1+P2** se a Suprema estiver bloqueada); senão HP ≤
  gatilho(P2) → P2; senão HP ≤ gatilho(P1) → P1. Alterna P1/P2 no cooldown (1s).
- **Emergência**: se `HP / DPS_recebido < segundos_de_emergência` (padrão 2,5s;
  4s com chefe) → usa a poção mais forte disponível.
- **Chefe**: os limites disparam 12% mais cedo (`bossMarginPct`).
- Nunca clica com HP cheio; confirma o uso pelo **decremento da contagem**;
  o HP sobe pela cura natural também, então o HP é secundário.

## 10. Auto-install da extensão (mecanismo VOD.RIP)

A extensão é unpacked; o install silencioso reusa o driver do VOD.RIP
(`backend/scripts/cookie_extension_auto_install.ps1`, UIA + janela alpha-0,
zero foco). Ele é **genérico**: deriva o nome do cartão do `manifest.json` do
`-ExtensionDir`. Receita e armadilhas em
`C:/Users/Administrador/Desktop/Nova pasta (3)/TESTE/VOD.RIP/docs/extension-auto-install.md`.

Comando (verificado 2026-10-13; id `pbdlekcgmpippamdkgbaphcppjafobjo`):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<VOD.RIP>\backend\scripts\cookie_extension_auto_install.ps1" `
  -ExtensionDir "I:\!lolidle.com\extension" -Browser chrome
```
Verificação: `Secure Preferences` → `extensions.settings[].path` == pasta.

**Atualizar = rodar o MESMO comando de novo, com `-Force`** — o Chrome relê a
pasta e **recarrega** a extensão já instalada (testado com mudança só no
`content.js`, sem tocar no manifest). Não precisa de `chrome://extensions`.
Fallback: o service worker aceita `chrome.runtime.sendMessage({type:'lolidle:reload'})`
ou a chave de storage `lolidleAutoPotion:reload`.

## 11. Projetos de referência

- **BrandOps** (`I:/!produtos202608/BrandOps`): conexão com o navegador do dono.
  Ver `docs/browser-connection.md` (relay `:9224`, `bg-window.py`, detach).
- **VOD.RIP** (`C:/Users/Administrador/Desktop/Nova pasta (3)/TESTE/VOD.RIP`):
  auto-install/update de extensão unpacked. Ver
  `docs/extension-auto-install.md` e `AGENTS.md` → "Browser Extensions".
- **Manager** (`I:/!manager`): playbooks `attach.md`,
  `browser-disconnect-protocol.md`, `focus-safe-open.md`,
  `extension-auto-install.md`; driver `tools/ext-reload-cdp.mjs`.

## 12. Aberto / a decidir

- Confirmar a **política de faixas** (qual poção em cada faixa de HP) — é a
  interpretação mais consistente dos limites 900/1800/2500 dados pelo dono.
- Capturar o número verde de cura no `inject.js` (hook) e validar a cor.
- Medir o DPS real do chefe ao vivo e calibrar `segundos_de_emergência`.
- Ícones da extensão (opcional em MV3).

## 13. Spawn de mobs, waves e penalidade de nível (medido + motor.js)

Extraído do `motor.js` e confirmado ao vivo (rota-inf, 2026-10):

- **Nível do mob = `clamp(nivelJogador - 2 + rand(0..3), n0, n1)`**
  (`gerarGrupo`, motor.js:1110). O mob nasce **perto do jogador** (P−2 a P+1),
  **limitado à faixa da região** (`nm`). Ex.: você nv 27 em `rota-inf` (nm 1–6)
  → mob nasce **nv 6**; no `rio` (nm 25–33) → **nv 25–28**.
- **Wave = `2 + rand(0..2)`** = 2 a 4 mobs (média 3). Cada um com
  `chegada = 1.2 + k·0.25` → **stagger de 0,25s** (medido ~182ms).
- **`respawn = 1.5s` só quando TODOS os mobs morrem** (motor.js:1617), mais a
  chegada (~1.2s) → **~3,5s por wave, independente da região**.
  → Se o **AoE mata a wave junta**, o abate é **spawn-limitado** (~48 abates/min).
  → Se não, é **DPS-limitado**: `kills/min = mobsPerWave / (mobHp/DPS + 3.5) · 60`.
- **Chefe**: substitui a wave com chance `local.chefe[1]` (1,5% no Barão/Arauto),
  no nível `n1 + 2`.
- **Furioso**: 5% (`FURIOSO.chance`), 1 mob da wave; **noturno**: 35%.

**Penalidade de XP/ouro (motor.js:420):**
```js
fatorXp( P, M ) = dif = P - M;  return dif > 5 ? max(0.1, 1 - 0.1*(dif-5)) : 1;
fatorSaque = fatorXp;   // o ouro tem a MESMA penalidade
```
Diferença de 6 níveis → 0,9; 10 → 0,5; 14+ → **0,1** (piso). Ou seja, matar mob
**6+ níveis abaixo** derruba XP **e** ouro. **A faixa ideal é `mobLevel ≈ seu nível`**
(fator 1). Ex.: nv 27 em `rota-inf` (mob 6, dif 21) → **10%**. Por isso a 1ª região
rende ~545 XP/min (medido) e o Rio ~8.300 — não é o dano, é a penalidade.

**Fórmulas do abate (motor.js:1739-1746):**
```js
xp   = CURVA.xp(M) * m.xp * fatorXp(P,M) * (vip?1.2:1) * bonus * bonusXp * bonusTwitch * bonusEvento;
ouro = CURVA.ouro(M) * m.ouro * (0.5+rand*0.5) * (1+bc.ouro+bm.ouro) * fatorSaque(P,M);
```
`statsMonstro()`/`estimarRegiao()` em `automation.js` reproduzem isso; o `meuDps()`
(≈2434 no nv 27) é derivado do **medido** (região DPS-limitada).

**Regiões (mapa):** `rota-inf` `nm[1,6]` · `rota-sup` · `lobos` · `azul` ·
`vermelho` · `rio` `nm[25,33]` · `dragao` · `barao`.
