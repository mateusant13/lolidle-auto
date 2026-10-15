# 05 — O JOGO (`jogo.js`) e a CENA (`cena.js`)

> Bloco 5 da especificação viva do I:\!lolidle.com. Escto por um agente LEITOR (Regra Nº 8 do AGENTS.md):
> lê a fonte em etapas e grava. **Nada aqui é cópia de comentário**: todos os números foram LIDOS no
> código e vêm com `ficheiro:linha`. O que não está no repo está na secção 7 (NAO VERIFICADO).

## 0. Método e alcance

* Fontes lidas **inteiras**, em etapas com `offset`/`limit`, nunca recomeçadas:
  * `docs/game-src/jogo.js` — 7.073 linhas, 564.543 bytes.
  * `docs/game-src/motor.js` — apenas o que os dois chamam (`viajar`, `voltarBase`, `emCombate`, `comItem`, `ofertaGema`…).
* `docs/game-src/cena.js` (5.904 linhas) é lida e documentada nas secções 1.6, 2.2 e 8 deste mesmo ficheiro.
* `jogar.html` **não está no repo** (ver secção 7): por isso, "onde o id nasce" é, para cada id, a
  **primeira linha de `jogo.js`/`cena.js` que o escreve ou lê** — não a linha do HTML que cria o elemento.
* Convenção de papéis de um id: **escreve** = nessa linha há atribuição a `innerHTML`/`textContent`/
  `style`/`classList`/`dataset`/`value`/`checked`/`hidden`/`disabled`/`title`/`append`/`insertAdjacentHTML`;
  **só lê** = só é usado como valor (ex.: `if ($('#x').hidden)`).

---

## 1. O loop do jogo

### 1.1 Constantes do passo

| Nome | Valor | Onde |
|---|---|---|
| `DT` (passo fixo do motor) | `0.05` s (20 passos/s) | `jogo.js:30` |
| `intervaloQuadro` (normal) | `1000/60` | `jogo.js:1515` |
| `intervaloQuadro` (modo leve) | `1000/30` | `jogo.js:1531` |
| tecto de `dt` visível / escondido | `0.25` s / `1` s | `jogo.js:1556` |
| `acum` máximo implícito | 1 `dt` por quadro (ver 1.3) | `jogo.js:1564` |

### 1.2 `quadro(t)` — o quadro do `requestAnimationFrame` (`jogo.js:1516-1525`)

Ordem exata:

1. `requestAnimationFrame(quadro)` **antes** de tudo — "um erro num quadro não congela o jogo" (`jogo.js:1517`).
2. `if (document.hidden) { medIni = 0; return; }` — aba escondida **não desenha** (`jogo.js:1518`).
3. `const passou = t - ultimoQuadro` (`jogo.js:1520`).
4. `if (passou < intervaloQuadro - 1) return;` — salta quadros curtos demais (`jogo.js:1521`).
5. `ultimoQuadro = passou > 250 ? t : t - (passou % intervaloQuadro)` — o ritmo médio fica em 60 (ou 30)
   em qualquer ecrã; com `ultimoQuadro = t` um ecrã de 75 Hz caía para 37 (`jogo.js:1522`).
6. `avancar(true)` (`jogo.js:1523`) e `medirDesempenho(t)` (`jogo.js:1524`).

Arranque: `requestAnimationFrame(quadro)` em `jogo.js:7013`.

**Aba escondida:** o relógio em segundo plano é um `Worker` — `const pulso = new Worker('js/pulso.js')`
(`jogo.js:1551`) e `pulso.onmessage = () => { if (document.hidden) avancar(false); }` (`jogo.js:1552`).
Ou seja: **com a aba escondida o jogo continua a avançar, sem desenhar**; fechar o navegador para tudo
("não existe progresso offline" pelo navegador — o progresso offline é somado pelo **servidor**, `jogo.js:6651-6776`).

### 1.3 `avancar(desenhar)` — a ordem por quadro (`jogo.js:1553-1573`)

| # | linha | o que faz |
|---|---|---|
| 1 | `jogo.js:1554-1556` | `agora = performance.now()`; `dt = Math.min(desenhar ? 0.25 : 1, (agora - ultimo)/1000)` |
| 2 | `jogo.js:1557` | `ultimo = agora` |
| 3 | `jogo.js:1558` | `acum += dt` |
| 4 | `jogo.js:1559` | `estado.relogio = M.relogioMundial(agoraMundo())` — dia/noite iguais para todos |
| 5 | `jogo.js:1560` | `andarPelasSetas()` |
| 6 | `jogo.js:1561` | `moverCameraLivre(dt)` |
| 7 | `jogo.js:1562` | `andarSegurando()` (botão direito segurado) |
| 8 | `jogo.js:1563` | `lerControles()` — mira do mouse → `A.entrada.mira`, indicadores de alcance |
| 9 | `jogo.js:1564` | **`while (acum >= DT) { M.passo(estado, combate, DT); processarEventos(); acum -= DT; }`** |
| 10 | `jogo.js:1565` | `enviarTempoReal(dt)` (~10×/s, ver 1.4) |
| 11 | `jogo.js:1566` | `passoViagem(dt)` — barra da viagem |
| 12 | `jogo.js:1567-1569` | `cena.luz`, `cena.atualizar(dt)` e `if (desenhar) cena.desenhar()` |
| 13 | `jogo.js:1570` | `if ((uiT += dt) > 0.2) { uiT = 0; som.trilha(trilhaAtual()); atualizarUI(); }` → **UI 5×/s** |
| 14 | `jogo.js:1571` | `if ((saveT += dt) > 15) { saveT = 0; salvar(); }` → **save a cada 15 s** |
| 15 | `jogo.js:1572` | `atualizarPresenca(dt)` (Fonte; 1,5 s entre envios, `jogo.js:3705`) |

Nota de leitura: o `while (acum >= DT)` consome **no máximo um `dt` de 0,25 s por quadro** (tecto do
passo 1), por isso um quadro não recupera mais de 5 passos de motor; com a aba escondida o tecto é 1 s.

### 1.4 Frequências fixas (fora do quadro)

| O quê | Período | Onde |
|---|---|---|
| save | 15 s (acumulado por `dt`) | `jogo.js:1571` |
| UI (`atualizarUI`) | 0,2 s | `jogo.js:1570` |
| tempo real (pos/vida/monstros) | 0,1 s | `jogo.js:1186` |
| chat (`buscarChat`) | 2 s | `jogo.js:2951` |
| jogadores online | 20 s | `jogo.js:251` |
| mercado (caixa / janela) | 30 s | `jogo.js:2836` |
| guilda | 60 s (aba visível) | `jogo.js:3691` |
| arena (consulta HTTP) | 1 s / 2 s / 15 s segundo o estado | `jogo.js:4547` |
| Twitch/Kick com janela aberta | 30 s | `jogo.js:1902`, `jogo.js:2029` |
| botão VIP | 60 s | `jogo.js:2355` |
| baús e sacos (Runeterra) | 30 s | `jogo.js:704` |
| detecção de tela preta | 4 s | `jogo.js:1614` |
| relógio do evento de XP / aviso de reinício | 1 s | `jogo.js:6675`, `jogo.js:6697` |

### 1.5 Desempenho automático (`jogo.js:1528-1550`)

* `modoLeve()` = `desempenho === 'leve' || (desempenho === 'auto' && leveAuto)` (`jogo.js:1528`).
* `aplicarDesempenho()` (`jogo.js:1529-1534`): `intervaloQuadro = 1000/(leve ? 30 : 60)`;
  `cena.panoPasso = leve ? 1/15 : 1/30`; classe `modo-leve` no `body`.
* `medirDesempenho(ts)` (`jogo.js:1538-1550`): só em `auto`; janelas de 8 s; ignorado antes de
  `performance.now() < 20000` (`jogo.js:1544`); `medRuins = fps < 40 ? medRuins+1 : 0` e com **2**
  seguidas liga o modo leve (`jogo.js:1545-1547`).

### 1.6 O que a cena faz por quadro (ponte para a secção 2.2)

`jogo.js` só conhece a cena por `cena.atualizar(dt)` (`jogo.js:1568`), `cena.desenhar()` (`jogo.js:1569`),
`cena.sincronizar(combate, fracVida, fracMana)` / `cena.sincronizarArena` (`jogo.js:668-669`) e
`cena.luz = M.luzDoDia(...)` (`jogo.js:1567`). A cena é dona do `canvas` `#tela`, do minimapa e da
câmara; os ids que ela escreve estão na tabela 2.2.

---

## 2. Todos os ids de DOM

### 2.1 `jogo.js` — 327 ids

Resumo da varredura: **240** ids são escritos em alguma linha, **67** são **criados pelo próprio
`jogo.js` (em `innerHTML`/`insertAdjacentHTML`, não no HTML), o resto é só lido. A tabela está por ordem
alfabética; a coluna "linhas" dá as **primeiras** ocorrências (a lista completa obtém-se procurando o id
no ficheiro).

| `#abas-console` | `2870`, `2881`, `2954`, … (4 linhas) | escreve + lê |
| `#abrir-amigos` | `3506` | escreve |
| `#abrir-arena` | `4842` | só lê |
| `#abrir-discord` | `1743`, `1780` | escreve + lê |
| `#abrir-ganhos` | `1738` | só lê |
| `#abrir-guilda` | `3614` | só lê |
| `#abrir-kick` | `1926`, `1943`, `1954`, … (4 linhas) | escreve + lê |
| `#abrir-loja-dia` | `2833` | só lê |
| `#abrir-mapa` | `4506`, `6087`, `6102`, … (7 linhas) | escreve + lê |
| `#abrir-mercado` | `2832`, `6948` | só lê |
| `#abrir-novidades` | `7025`, `7034`, `7036` | escreve + lê |
| `#abrir-orbs` | `2128` | só lê |
| `#abrir-personagens` | `3227` | só lê |
| `#abrir-ranking` | `3334` | só lê |
| `#abrir-salvar` | `1709`, `1761`, `1835`, … (7 linhas) | criado em jogo.js · só lê |
| `#abrir-twitch` | `1813`, `1821`, `1877` | escreve + lê |
| `#abrir-vip` | `1651`, `1681` | só lê |
| `#alerta-lendario` | `7058`, `7059` | escreve + lê |
| `#alvo-npc` | `420`, `421` | criado em jogo.js · escreve + lê |
| `#am-erro` | `3491` | criado em jogo.js · só lê |
| `#am-nome` | `3490`, `3512` | criado em jogo.js · escreve + lê |
| `#am-pedir` | `3490`, `3507` | criado em jogo.js · escreve + lê |
| `#amigos` | `3477`, `3507`, `3508` | só lê |
| `#analise-corpo` | `546`, `567` | escreve + lê |
| `#ar-fila-t` | `4782`, `4841` | criado em jogo.js · escreve + lê |
| `#ar-nome` | `4779`, `4788`, `4812`, … (4 linhas) | criado em jogo.js · só lê |
| `#arena` | `4779` | só lê |
| `#arena-achada` | `4602`, `4647` | escreve + lê |
| `#arena-aviso` | `4659`, `4733` | escreve + lê |
| `#arena-convite` | `4615`, `4627`, `4647` | escreve + lê |
| `#arena-fim-corpo` | `4712` | escreve |
| `#arena-hud` | `4659`, `4733` | escreve + lê |
| `#arena-preparo` | `4542`, `4572`, `4584`, … (5 linhas) | escreve + lê |
| `#arena-preparo-s` | `4576`, `4582` | criado em jogo.js · escreve + lê |
| `#arena-status` | `4761`, `4765`, `4844` | só lê |
| `#atributos` | `5870`, `5875`, `6616` | escreve + lê |
| `#auto-estado` | `6575` | escreve |
| `#auto-mana` | `5909` | escreve |
| `#auto-pocoes` | `6578` | escreve |
| `#auto-vida` | `5909` | escreve |
| `#aviso-convidado` | `2976` | criado em jogo.js · escreve |
| `#aviso-morte` | `6503` | escreve |
| `#aviso-morte-mundo` | `6504` | escreve |
| `#aviso-reinicio` | `6683` | só lê |
| `#avisos-saque` | `6370` | só lê |
| `#badge-itens` | `6537` | escreve |
| `#barra` | `5862`, `5864`, `6124`, … (5 linhas) | escreve + lê |
| `#batalha` | `6556` | escreve |
| `#bolsa-detalhe` | `6040` | só lê |
| `#bolsa-equip` | `6015`, `6016`, `6033`, … (6 linhas) | escreve + lê |
| `#bolsa-mochila` | `6017`, `6032`, `6043`, … (6 linhas) | escreve + lê |
| `#bolsa-qtd` | `6036` | escreve |
| `#bt-alcance` | `1280`, `1285`, `6115` | escreve + lê |
| `#bt-campeoes` | `1292`, `1297`, `6116` | escreve + lê |
| `#bt-config` | `890` | escreve |
| `#bt-efeitos` | `895` | escreve |
| `#bt-gaveta` | `387`, `389` | escreve |
| `#bt-grupo` | `1021`, `6119` | escreve |
| `#bt-montaria` | `1217`, `1234`, `6120` | escreve + lê |
| `#bt-musica` | `895` | escreve |
| `#bt-pk` | `1210`, `6117`, `6481` | escreve + lê |
| `#bt-tutorial` | `6998`, `7002` | criado em jogo.js · escreve |
| `#bt-wiki` | `7000` | criado em jogo.js · escreve |
| `#buff-barao` | `6444` | escreve |
| `#buff-disciplina` | `6447` | escreve |
| `#buff-guilda` | `1914` | escreve |
| `#buff-guilda-t` | `1915` | escreve |
| `#buff-kick` | `1929`, `2008` | escreve + lê |
| `#buff-kick-t` | `1930`, `1950` | escreve |
| `#buff-twitch` | `1816`, `1878` | escreve + lê |
| `#buff-twitch-t` | `1817` | escreve |
| `#chat-fonte` | `2849` | só lê |
| `#chat-form` | `2875`, `3089`, `3123` | escreve + lê |
| `#chat-global` | `2849` | só lê |
| `#chat-guilda` | `2849` | só lê |
| `#chat-min` | `2954`, `2957`, `2963` | criado em jogo.js · escreve + lê |
| `#chat-privado` | `2849` | só lê |
| `#chat-texto` | `1639`, `2857`, `2864`, … (11 linhas) | escreve + lê |
| `#chaves` | `773` | escreve |
| `#cliente` | `347`, `361` | escreve |
| `#cofre-valor` | `5106`, `5674`, `5675` | criado em jogo.js · escreve + lê |
| `#compra-livre` | `2224`, `2256` | criado em jogo.js · escreve + lê |
| `#config-corpo` | `864`, `891`, `900`, … (4 linhas) | escreve + lê |
| `#conq-qtd` | `5402` | escreve |
| `#conquistas` | `5369`, `5385` | escreve + lê |
| `#console` | `2956`, `2964`, `3125` | escreve + lê |
| `#controle-som` | `35`, `6998`, `7000` | escreve |
| `#dia-saldo` | `2371` | escreve |
| `#diamantes` | `2370` | escreve |
| `#direita` | `1214`, `1215`, `4591`, … (4 linhas) | escreve + lê |
| `#discord-corpo` | `1758`, `1769` | escreve |
| `#env-enviar` | `3436`, `3442`, `3447` | criado em jogo.js · escreve + lê |
| `#env-nota` | `3434`, `3443`, `3454` | criado em jogo.js · escreve + lê |
| `#env-para` | `3432`, `3439`, `3443`, … (4 linhas) | criado em jogo.js · escreve + lê |
| `#env-qtd` | `3433`, `3439`, `3443`, … (5 linhas) | criado em jogo.js · escreve + lê |
| `#enviar-corpo` | `3422`, `3423`, `3430` | escreve |
| `#equip` | `5918`, `5919` | escreve + lê |
| `#equip-poder-d` | `6424`, `6425` | escreve |
| `#equip-poder-n` | `6423`, `6424` | escreve + lê |
| `#evento-xp` | `6665` | só lê |
| `#ganhos-corpo` | `1703`, `1718` | escreve |
| `#gaveta-fundo` | `391` | só lê |
| `#gd-chamar-grupo` | `3585` | criado em jogo.js · só lê |
| `#gd-convidar` | `3589` | criado em jogo.js · só lê |
| `#gd-convidar-nome` | `3589`, `3674` | criado em jogo.js · só lê |
| `#gd-criar` | `3558` | criado em jogo.js · só lê |
| `#gd-doar` | `3603` | criado em jogo.js · só lê |
| `#gd-doar-valor` | `3603`, `3651` | criado em jogo.js · só lê |
| `#gd-erro` | `3560`, `3595`, `3613` | criado em jogo.js · escreve + lê |
| `#gd-nome` | `3552`, `3622`, `3628` | criado em jogo.js · escreve + lê |
| `#gd-novo-nome` | `3592`, `3636` | criado em jogo.js · só lê |
| `#gd-previa-nome` | `3551`, `3616`, `3622` | criado em jogo.js · escreve + lê |
| `#gd-renomear` | `3592` | criado em jogo.js · só lê |
| `#gd-sair` | `3596` | criado em jogo.js · só lê |
| `#gd-vaga` | `3586` | criado em jogo.js · só lê |
| `#gemas` | `6632`, `6942` | escreve + lê |
| `#gn-chave` | `1713`, `2045` | criado em jogo.js · só lê |
| `#gn-copiar` | `1727` | criado em jogo.js · só lê |
| `#gn-erro` | `1716`, `2043`, `2048` | criado em jogo.js · escreve + lê |
| `#gn-link` | `1727`, `2034` | criado em jogo.js · só lê |
| `#gn-nome` | `1712`, `2045` | criado em jogo.js · só lê |
| `#gn-saque` | `1711` | criado em jogo.js · só lê |
| `#gp-auto-guilda` | `1008` | criado em jogo.js · só lê |
| `#gp-convidar` | `1006` | criado em jogo.js · só lê |
| `#gp-guilda` | `1007` | criado em jogo.js · só lê |
| `#gp-nome` | `1006`, `1026` | criado em jogo.js · escreve + lê |
| `#gp-sair` | `1009` | criado em jogo.js · só lê |
| `#grupo-conteudo` | `1010` | só lê |
| `#grupo-convite` | `1014`, `1020`, `6121` | escreve + lê |
| `#grupo-hud` | `929`, `6121` | escreve + lê |
| `#grupo-painel` | `937`, `1019`, `1021`, … (5 linhas) | escreve + lê |
| `#guilda` | `3564`, `3616`, `3617`, … (4 linhas) | escreve + lê |
| `#hab-ativas` | `5846` | escreve |
| `#hab-passivas` | `5847` | escreve |
| `#habilidades` | `5848`, `6583`, `6604` | escreve + lê |
| `#hud-alvo` | `220`, `6548` | escreve + lê |
| `#hud-baixo` | `6805`, `6909`, `6911` | só lê |
| `#hud-bolsa` | `6086`, `6100` | escreve + lê |
| `#hud-bolsa-n` | `6099` | escreve |
| `#hud-buffs` | `6164` | só lê |
| `#hud-cabeca` | `6214` | só lê |
| `#hud-dir` | `6500` | escreve |
| `#hud-equip` | `6085`, `6095`, `6183` | escreve + lê |
| `#hud-habs` | `5895`, `6130`, `6226` | escreve + lê |
| `#hud-mana` | `6201`, `6205` | escreve + lê |
| `#hud-mapa` | `6087`, `6102` | escreve + lê |
| `#hud-painel` | `390` | escreve |
| `#hud-pocoes` | `5891`, `5893`, `6239` | escreve + lê |
| `#hud-pontos` | `641`, `1211`, `6529` | escreve + lê |
| `#hud-redes` | `6501` | escreve |
| `#hud-retrato` | `6211` | só lê |
| `#hud-vida` | `6201`, `6202` | escreve |
| `#hud-voltar` | `6088`, `6101` | escreve + lê |
| `#hud-xp-barra` | `6219` | escreve |
| `#hud-xpb` | `6224` | escreve |
| `#hud-xpb-barra` | `6222` | escreve |
| `#ignorar-basicos` | `5882`, `5883` | escreve + lê |
| `#ir-runeterra` | `3929`, `5896`, `6514`, … (5 linhas) | escreve + lê |
| `#janela-amigos` | `1643`, `3497`, `3517` | escreve |
| `#janela-analise` | `564`, `565` | escreve + lê |
| `#janela-arena` | `4547`, `4548`, `4768`, … (5 linhas) | escreve + lê |
| `#janela-arena-fim` | `4659`, `4708`, `4725` | escreve + lê |
| `#janela-bolsa` | `1645`, `6013`, `6025`, … (5 linhas) | escreve + lê |
| `#janela-config` | `889` | escreve |
| `#janela-discord` | `1754`, `1775`, `1781`, … (4 linhas) | escreve + lê |
| `#janela-enviar` | `3421`, `3441` | escreve + lê |
| `#janela-ganhos` | `1701`, `2032`, `2038`, … (4 linhas) | escreve + lê |
| `#janela-guilda` | `1642`, `3609`, `3625`, … (4 linhas) | escreve + lê |
| `#janela-kick` | `1949`, `1957`, `2003`, … (6 linhas) | escreve + lê |
| `#janela-login` | `6739`, `6742`, `6747` | escreve + lê |
| `#janela-mapa` | `1640`, `3877`, `3889`, … (6 linhas) | escreve + lê |
| `#janela-mercado` | `1633`, `2440`, `2445`, … (10 linhas) | escreve + lê |
| `#janela-npc` | `2665`, `5016`, `5031`, … (5 linhas) | escreve + lê |
| `#janela-orbs` | `2061`, `2129`, `2130`, … (5 linhas) | escreve + lê |
| `#janela-perfil` | `3184`, `3338`, `3365`, … (6 linhas) | escreve + lê |
| `#janela-personagens` | `3192`, `3228`, `3245`, … (5 linhas) | escreve + lê |
| `#janela-presente` | `3040`, `3051`, `3053`, … (4 linhas) | escreve + lê |
| `#janela-ranking` | `1641`, `3319`, `3371` | escreve |
| `#janela-salvar` | `2984` | escreve |
| `#janela-twitch` | `1824`, `1873`, `1879`, … (5 linhas) | escreve + lê |
| `#janela-venda` | `5528`, `5530`, `5611`, … (4 linhas) | escreve + lê |
| `#janela-vip` | `1660`, `2282`, `2287` | escreve + lê |
| `#kick-corpo` | `1961`, `1977` | escreve |
| `#lateral` | `361`, `852` | escreve + lê |
| `#legenda-mundo` | `3916` | escreve |
| `#legenda-rift` | `3915` | escreve |
| `#lim-mana` | `5910` | escreve |
| `#lim-vida` | `5910` | escreve |
| `#local-desc` | `6511` | escreve |
| `#local-nome` | `6509` | escreve |
| `#log` | `153`, `2849` | só lê |
| `#login-corpo` | `6733` | escreve |
| `#mapa-area` | `3915`, `4474` | escreve + lê |
| `#mapa-bt-cheia` | `3879`, `3884` | escreve + lê |
| `#mapa-bt-info` | `3879`, `3883` | escreve + lê |
| `#mapa-dica` | `3841`, `3858` | escreve |
| `#mapa-info` | `3846`, `3860`, `3861`, … (5 linhas) | escreve + lê |
| `#mapa-lol` | `3719` | só lê |
| `#mapa-lol-anim` | `4474` | só lê |
| `#mapa-mundo` | `4281`, `4285`, `4294`, … (16 linhas) | escreve + lê |
| `#marcadores` | `3831`, `3850`, `3853`, … (5 linhas) | escreve + lê |
| `#mascotes` | `5408`, `5415`, `5438` | escreve + lê |
| `#mercado-busca` | `2477` | só lê |
| `#mercado-caixa` | `2459`, `2466` | escreve |
| `#mercado-classe` | `2477` | só lê |
| `#mercado-erro` | `3058`, `3632`, `3640`, … (8 linhas) | escreve + lê |
| `#mercado-filtros` | `2830` | só lê |
| `#mercado-fora` | `2451` | escreve |
| `#mercado-lista` | `2447` | só lê |
| `#mercado-loja` | `2639`, `3453` | escreve + lê |
| `#mercado-moeda` | `2477` | só lê |
| `#mercado-ordem` | `2477` | só lê |
| `#mercado-qual` | `2495` | só lê |
| `#mini-zoom` | `273`, `274`, `365`, … (5 linhas) | escreve |
| `#mj-detalhe` | `2447`, `2750` | escreve + lê |
| `#mj-minimo` | `2550`, `2590` | criado em jogo.js · só lê |
| `#mj-n-minhas` | `2456` | escreve |
| `#mj-saldo` | `2450` | escreve |
| `#mochila` | `5924`, `5925`, `6628` | escreve + lê |
| `#moldura` | `220`, `366`, `367`, … (11 linhas) | escreve + lê |
| `#montaria` | `1241` | só lê |
| `#mundo-area` | `3892`, `3916`, `4475` | escreve + lê |
| `#mundo-dica` | `3924`, `4468` | escreve |
| `#mundo-zoom` | `4300`, `4457` | escreve + lê |
| `#novidades-titulo` | `7023` | criado em jogo.js · só lê |
| `#npc-conversa` | `5014`, `5020` | escreve + lê |
| `#npc-nome` | `5009` | escreve |
| `#npc-palavras` | `5030`, `5039`, `5042` | escreve + lê |
| `#npc-papel` | `5011` | escreve |
| `#npc-retrato` | `5012` | escreve |
| `#npc-titulo` | `5010` | escreve |
| `#npc-troca` | `2666`, `2667`, `4903`, … (22 linhas) | escreve + lê |
| `#npcs` | `5043`, `6513` | escreve + lê |
| `#ob-aceite` | `2099`, `2169` | criado em jogo.js · só lê |
| `#ob-carteira` | `2097`, `2164` | criado em jogo.js · só lê |
| `#ob-carteira-erro` | `2098`, `2134` | criado em jogo.js · escreve + lê |
| `#ob-end` | `2086` | criado em jogo.js · só lê |
| `#ob-erro` | `2102`, `2165` | criado em jogo.js · escreve + lê |
| `#ob-gemas` | `2082`, `2132` | criado em jogo.js · escreve + lê |
| `#ob-memo` | `2088` | criado em jogo.js · só lê |
| `#ob-qtd` | `2095`, `2164` | criado em jogo.js · só lê |
| `#ob-saque` | `2094` | criado em jogo.js · só lê |
| `#ob-usdt` | `2080` | criado em jogo.js · só lê |
| `#ob-usdt-saque` | `2096`, `2133` | criado em jogo.js · escreve + lê |
| `#objetivo` | `6830`, `6838`, `6879` | criado em jogo.js · escreve + lê |
| `#opcoes-mundo` | `364` | escreve |
| `#orbs-corpo` | `2063`, `2125` | escreve |
| `#orbs-saldo` | `2054` | escreve |
| `#pagamento` | `2277`, `2278`, `2293`, … (4 linhas) | escreve + lê |
| `#perfil-corpo` | `3338` | só lê |
| `#perfil-titulo` | `3184`, `3339` | escreve |
| `#pers-conf` | `3207`, `3219`, `3241` | criado em jogo.js · escreve + lê |
| `#pers-nome` | `3213`, `3247` | criado em jogo.js · só lê |
| `#personagens-corpo` | `3193`, `3194`, `3216`, … (4 linhas) | escreve + lê |
| `#pix-codigo` | `2309`, `2318` | criado em jogo.js · só lê |
| `#pocoes` | `5888`, `5890`, `6563` | escreve + lê |
| `#presente-corpo` | `3045` | escreve |
| `#rank-vm` | `225` | só lê |
| `#ranking` | `3294`, `3336` | só lê |
| `#ranking-filtros` | `3286`, `3324`, `3329`, … (4 linhas) | escreve + lê |
| `#rastreador` | `6327`, `6359` | escreve + lê |
| `#rastreio-abas` | `6327`, `6830` | escreve + lê |
| `#rastreio-analise` | `6250`, `6761` | escreve + lê |
| `#rastreio-caveira` | `6285` | só lê |
| `#rastreio-chaves` | `6312` | só lê |
| `#rastreio-ev` | `6327`, `6365` | escreve + lê |
| `#rastreio-ev-n` | `6349` | escreve |
| `#rastreio-ev-seta` | `6354` | escreve |
| `#rastreio-fr` | `6329`, `6366` | escreve + lê |
| `#rastreio-fr-n` | `6339` | escreve |
| `#rastreio-fr-seta` | `6341` | escreve |
| `#rastreio-login` | `6256`, `6760` | escreve + lê |
| `#rastreio-n` | `6348` | escreve |
| `#rastreio-seta` | `6353` | escreve |
| `#rastreio-sorteio` | `3398`, `3408` | só lê |
| `#rastreio-tarefa` | `5902`, `6263` | escreve + lê |
| `#rastreio-topo` | `6327`, `6364` | escreve + lê |
| `#rastreio-vilemaw` | `5896`, `6298` | escreve + lê |
| `#rk-busca` | `3289` | criado em jogo.js · só lê |
| `#rk-guilda` | `3290` | criado em jogo.js · só lê |
| `#rot-mochila` | `5913`, `5914` | escreve + lê |
| `#rot-pocoes` | `5913`, `5915` | escreve + lê |
| `#rotina` | `1656`, `1657`, `2339`, … (4 linhas) | escreve + lê |
| `#rotina-vip` | `2337`, `2339` | só lê |
| `#sair` | `3260`, `3264` | escreve + lê |
| `#salvar-codigo` | `2990`, `3004` | escreve |
| `#salvar-codigo-campo` | `2991`, `3005`, `3010` | escreve + lê |
| `#salvar-codigo-email` | `3004` | escreve |
| `#salvar-corrigir` | `2990` | escreve |
| `#salvar-dados` | `2990`, `3004` | escreve |
| `#salvar-email` | `2994` | só lê |
| `#salvar-enviar` | `2990`, `2995` | escreve + lê |
| `#salvar-erro` | `2984`, `2995` | escreve + lê |
| `#salvar-form` | `2992` | só lê |
| `#salvar-nome` | `2986`, `2994` | escreve + lê |
| `#salvar-senha` | `2994` | só lê |
| `#salvar-senha2` | `2998` | escreve |
| `#skins` | `5352`, `5356`, `5460` | escreve + lê |
| `#skins-qtd` | `5468` | escreve |
| `#st-guilda` | `3539`, `3615` | só lê |
| `#st-mana` | `6439` | escreve |
| `#st-manamax` | `6459` | escreve |
| `#st-nome` | `240` | escreve |
| `#st-online` | `246`, `247` | escreve |
| `#st-ouro` | `6397` | só lê |
| `#st-poder` | `6421` | escreve |
| `#st-vida` | `6437` | escreve |
| `#st-xp` | `6434` | escreve |
| `#tarefa` | `6518`, `6521` | escreve |
| `#tarefa-barra` | `6524` | escreve |
| `#tela` | `214`, `220`, `359`, … (22 linhas) | escreve + lê |
| `#titulo` | `5375`, `5398`, `5399` | escreve + lê |
| `#twitch-corpo` | `1828`, `1847` | escreve |
| `#venda-corpo` | `5559` | só lê |
| `#venda-ouro` | `5558` | escreve |
| `#vender-liquido` | `2615`, `2628` | criado em jogo.js · escreve + lê |
| `#vender-moeda` | `2613`, `2626`, `2763`, … (4 linhas) | criado em jogo.js · escreve + lê |
| `#vender-para` | `2617`, `2770` | criado em jogo.js · só lê |
| `#vender-preco` | `2553`, `2594`, `2614`, … (7 linhas) | criado em jogo.js · escreve + lê |
| `#vender-qtd` | `2540`, `2547`, `2774`, … (4 linhas) | criado em jogo.js · só lê |
| `#vender-unidade` | `2614`, `2627` | criado em jogo.js · escreve + lê |
| `#vip-ativar` | `1674`, `2282`, `2350`, … (5 linhas) | escreve + lê |
| `#vip-beneficios` | `1662` | escreve |
| `#vip-erro` | `1660`, `2348` | escreve |
| `#vip-pacotes` | `2200`, `2205`, `2209`, … (7 linhas) | escreve + lê |
| `#vip-status` | `1672`, `1678`, `2282` | escreve |
| `#voltar-base` | `1644`, `3866`, `4507`, … (8 linhas) | escreve + lê |
