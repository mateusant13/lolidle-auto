# 05 — O JOGO (`jogo.js`) e a CENA (`cena.js`)

> Bloco 5 da especificação viva do I:\!lolidle.com. Escrito por um agente LEITOR (Regra Nº 8 do AGENTS.md):
> lê a fonte em etapas e grava. **Nada aqui é cópia de comentário**: todos os números foram LIDOS no
> código e vêm com `ficheiro:linha`. O que não está no repo está na secção 7 (NAO VERIFICADO).

## 0. Método e alcance

* Fontes lidas **inteiras**, em etapas com `offset`/`limit`, nunca recomeçadas:
  * `docs/game-src/jogo.js` — 7.073 linhas, 564.543 bytes.
  * `docs/game-src/motor.js` — apenas o que os dois chamam (`viajar`, `voltarBase`, `emCombate`, `comItem`, `ofertaGema`…).
* `docs/game-src/cena.js` (5.904 linhas) foi lido inteiro, em etapas, e é documentado nas secções 1.6, 2.2, 2.3, 5.2 (barra da viagem) e 8 deste mesmo ficheiro.
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
câmara; os ids que ela escreve estão na secção 2.2 (resumindo: nenhum).

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

### 2.2 `cena.js` — **zero** ids de DOM

Varredura de `$('#…')`, `querySelector(All)('#…')`, `closest('#…')` e `getElementById` nas 5.904 linhas de
`docs/game-src/cena.js`: **0 ocorrências**. A cena é 100% `canvas`:

* o `canvas` chega pelo construtor — `new Cena($('#tela'), falas, descreverItem)` (`jogo.js:214`) →
  `this.cv = canvas` (`cena.js:322`); `canvas.width = VIS_L * T * ESCALA; canvas.height = VIS_A * T * ESCALA`
  (`cena.js:325`) e `definirLargura(tiles)` reescreve a largura (`cena.js:483-486`).
  **Quem manda no tamanho do `<canvas>` é a cena, não o jogo.**
* a cena cria canvases **fora do DOM** (rótulos `cena.js:204`, tintas `cena.js:239`, sombra da noite
  `cena.js:4426`, sprites `cena.js:249`/`cena.js:264`); nunca escreve em `document.body`.
* o que a cena escreve no DOM do jogo é por **callbacks que o jogo lhe pendura**:
  `cena.aoBarraChefe` (`jogo.js:217-221`, move o `top` de `#hud-alvo`), `cena.mostrarRankingVm`
  (`jogo.js:224-233`, escreve `#rank-vm`), `cena.log` (`jogo.js:234`, aponta para `log()` → `#log`),
  `cena.nomeEspolio`/`ehEspolio`/`nomeGema`/`corGema` (`jogo.js:235-238`).
* consequência para a extensão: **o estado do jogo não está no `canvas`**. A única informação legível no
  `#tela` é `width`/`height` e as classes `cursor-lol`/`cursor-ataque` (`jogo.js:1507`). Tudo o mais vem dos
  ids da tabela 2.1.

### 2.3 A API da `Cena` que o `jogo.js` realmente usa

Métodos/propriedades de `cena` referidos em `jogo.js` (a varredura deu 89, mas um deles é o `js` de
`from './cena.js'` (`jogo.js:11`); ficam **88** membros reais (a classe tem 227)):

| membro | 1ª linha em jogo.js | o que é |
|---|---|---|
| `atualizar` / `desenhar` | `jogo.js:1568`, `jogo.js:1569` | o par de quadros da cena |
| `sincronizar` / `sincronizarArena` | `jogo.js:669`, `jogo.js:668` | copia o motor para a tela (Rift / Runeterra) |
| `entrarLocal` / `definirCampeao` / `definirSkin` / `definirMascote` / `definirLargura` | `jogo.js:328`, `336`, `337`, `338`, `354` | troca de lugar/campeão |
| `clicar` / `jogadorEm` / `andarPara` / `irAte` | `jogo.js:403`, `405`, `413`, `4940` | rato/toque na tela |
| `posicoesArena` / `monstrosDeOutros` / `paredesDeOutros` / `redeArena` | `jogo.js:1182`, `1183`, `1184`, `1097` | o que o servidor vê de você |
| `mapa` / `npcs` / `bausAbertos` / `sacos` / `darius` / `cam` / `miniRet` | `jogo.js:314`, `418`, `323`, `709`, `116`, `425`, `1221` | estado lido do mapa |
| `evento` / `efeito` / `texto` / `aviso` / `balao` / `falar` / `tremor` / `luz` / `viagem` / `zoomMini` | `jogo.js:624`, `116`, `788`, `485`, `647`, `2940`, `816`, `1567`, `471`, `270` | visual e avisos |
| `morto` / `panoPasso` / `leve` / `fx` / `camLivre` / `camNoCampeao` / `miraArena` / `indicador` / `alcanceBasico` / `miraSobreAlvo` | `jogo.js:1387`, `1532`, `1532`, `1532`, `1305`, `1305`, `1494`, `1496`, `1497`, `1495` | controle e mira |

Também saem de `cena.js` e são usados pelo jogo: `VIS_L` (`cena.js:32`, **mutável** — `definirLargura`
escreve nela), `VIS_A` (`cena.js:33`) e `fmt` (`cena.js:225`), que **arredonda**: `>= 1e6` → `1.2M`,
`>= 1e4` → `12.3k`, senão inteiro. (O jogo tem o seu próprio `inteiro()` com separador de milhar,
`jogo.js:5367`, e o `fmt` do mercado é o da cena — duas formatações diferentes no mesmo ecrã.)

---

## 3. O save, o formato e quem decide o quê

### 3.1 Entrada e carregamento

| passo | linha | detalhe |
|---|---|---|
| `sessao = await conectar()` | `jogo.js:39` | o jogo **só começa** depois de entrar/criar personagem |
| `NOME = sessao.nome` | `jogo.js:40` | |
| `carregar()` | `jogo.js:64-81` | devolve `{ estado, autoHab }` |
| importação única do save antigo | `jogo.js:67-73` | `localStorage['darius-idle-v2']` → `estado`, marcada com `-importado` |
| migração de versão | `jogo.js:74-78` | `e.versao === 2` → `migrou = true`; `M.migrar(e)`; `versao 3` também |
| personagem novo | `jogo.js:79-80` | `M.novoEstado(sessao.campeao \|\| 'darius')` |
| campos vindos da **conta**, não do save | `jogo.js:84-95` | `nome`, `campeao`, `vipAte = sessao.vipAte`, `rp`, `orbs`, `relogio`, `rotina` |
| chaves da rotina antiga apagadas | `jogo.js:95` | `ativa, vida, mana, vender, voltarPara, mochilaTravada` |
| `combate = M.criarCombate()` | `jogo.js:96` | |

### 3.2 O que vai para o servidor e quando

* `prepararSave()` (`jogo.js:122`): `estado.salvoEm = Date.now(); estado.autoHab = false` — corre antes de
  **todo** o envio.
* `salvar()` (`jogo.js:124-139`): **não envia enquanto `operando`** (`jogo.js:125`); marca `revEnviado = estado.rev || 0`
  (`jogo.js:127`); `rede.salvarNoServidor(estado)` (`jogo.js:128`).
* gatilhos: a cada 15 s (`jogo.js:1571`), ao esconder a aba (`jogo.js:1575`), ao fechar
  (`jogo.js:1576`, `rede.salvarAoFechar`), ao sair (`jogo.js:3266`), ao trocar de personagem
  (`jogo.js:3224`), ao atualizar a versão (`jogo.js:1584`), na tela preta (`jogo.js:1609`), antes de
  entrar na Arena (`jogo.js:4642`) e ao abrir o ranking (`jogo.js:3321`).
* `operarServidor(rota, dados)` (`jogo.js:2670-2693`): a via única para tudo o que mexe em ouro,
  mochila, gemas, diamantes e rev. `operando = true` (`jogo.js:2671`), fotografa `ouro0`, `qtd0`,
  `gemas0` (`jogo.js:2673`) e, na resposta, **soma** o que mudou durante o pedido:
  `estado.ouro = r.ouro + (estado.ouro - ouro0)` (`jogo.js:2677`),
  `estado.mochila = [...r.mochila, ...novos].slice(0, M.MOCHILA)` (`jogo.js:2676-2678`),
  `estado.rev = r.rev` (`jogo.js:2677`), `r.mudou` (`jogo.js:2681-2682`).

### 3.3 O que o servidor decide (e o navegador não)

| campo | onde se vê | quem decide |
|---|---|---|
| qualidade dos itens (`~?` → `~S` etc.) | `jogo.js:98-121`, resposta `r.revelados` (`jogo.js:128`) | **servidor** (`aplicarRevelados`) |
| lendários descartados | `jogo.js:100-106`, `r.descartados` | **servidor** |
| `rev` e conflitos | `jogo.js:127`, `131`, `2688` | **servidor** (`desatualizado` → `location.reload()`) |
| progresso "impossível" (console) | `jogo.js:133-135` | **servidor** (`e.recusado`) |
| ouro, mochila, gemas após qualquer operação | `jogo.js:2677-2682` | **servidor** |
`diamantes`/`orbs` | `jogo.js:2683-2684`, `2375` | **servidor** |
| `vipAte` | `jogo.js:88`, `1671` | **servidor** ("o que o navegador mandar é ignorado", `motor.js:150`) |
| evento de XP | `jogo.js:6655-6676`, `sessao.evento` | **servidor** |
| aviso de reinício | `jogo.js:6681-6698` | **servidor** |
| donos dos rankings | `jogo.js:3284`, `6699` | **servidor** |
| guilda / amigos / arena / Vilemaw / sorteios / diamantes recebidos | `jogo.js:128` (todos no `.then` do save) | **servidor** |
| caixas de fortaleza e sacos | `jogo.js:712-730`, `796-819` | **servidor** |
| o que caiu ao morrer em Runeterra | `jogo.js:712-730` (`/api/morte`) | **servidor** |
| presença/online | `jogo.js:242-251`, `3696-3716` | **servidor** |
| caça offline (XP/ouro com o jogo fechado) | `jogo.js:6651-6776` | **servidor** (já somado no save) |

### 3.4 O que o navegador decide (e guarda)

* **Toda a simulação**: `M.passo(estado, combate, DT)` corre localmente (`jogo.js:1564`); dano, drops, XP,
  ouro e movimento são calculados no navegador e **enviados** — o servidor apenas valida (`rev`,
  `recusado`).
* `localStorage` — só preferências e estado de interface (nunca progresso de personagem):

| chave | linha | o que é |
|---|---|---|
| `lolidle-funil:<nome>` | `jogo.js:43` | etapas do funil já mandadas |
| `lolidle-conta:<nome>` | `jogo.js:56` | data de criação (invalida o resto se mudar) |
| `lolidle-mundo4-<nome>` | `jogo.js:259` | posição em Runeterra |
| `lolidle-cidades-<nome>` | `jogo.js:260` | cidades descobertas |
| `lolidle-chaves-<nome>` | `jogo.js:303` | chaves de fortaleza (com `ate`) |
| `lolidle-guardioes-<nome>` | `jogo.js:318` | guardiões mortos e até quando |
| `lolidle-objetivos:<nome>` | `jogo.js:300` | quadro "Próximo passo" |
| `lolidle-tutorial:<nome>` / `-tour-fonte:` / `-tour-runeterra:` | `jogo.js:6885`, `6924`, `6954` | passo atual dos tutoriais |
| `lolidle-novidades-vistas` | `jogo.js:298` | última novidade vista |
| `lolidle-layout` | `jogo.js:849` | ordem dos blocos da coluna |
| `lolidle-hud-tam`, `lolidle-lat-tam`, `lolidle-desempenho`, `lolidle-leve-auto` | `jogo.js:283-285` | tamanhos e modo leve |
| `lolidle-rastreio-aba`, `lolidle-missoes-min`, `lolidle-chat-min` | `jogo.js:286`, `277`, `2953` | quadro de missões e chat |
| `lolidle-mini-zoom` | `jogo.js:272` | zoom do minimapa |
| `lolidle-alcance`, `lolidle-so-campeoes` | `jogo.js:1276`, `1288` | "mostrar alcance" e "só campeões" |
| `lolidle-montou` | `jogo.js:1236` | já montou no Burrinho |
| `lolidle-mapa-dica`, `lolidle-mundo-dica`, `lolidle-dica-toque` | `jogo.js:3840`, `3923`, `262` | dicas já vistas |
| `lolidle-bloqueados` | `jogo.js:353` | quem você bloqueou no chat |
| `lolidle-grupo-guilda` | `jogo.js:995` | entrar sozinho no grupo da guilda |
| `lolidle-gemas-tutorial`, `lolidle-notif-lendario`, `lolidle-mapa-sem-info`, `lolidle-mapa-cheia` | `jogo.js:2122`, `7044`, `3877`, `3877` | misc |
| `lol-idle-aba` | `jogo.js:5049` | última aba da coluna |
| `lol-idle-token` | `jogo.js:2587`, `2839` | **token** usado no `Authorization: Bearer` de dois `fetch` diretos |
| `sessionStorage['lolidle-tela-preta']` | `jogo.js:1595` | recarregamentos por tela preta |
| `sessionStorage['lol-idle-saiu']` | `jogo.js:3269` | |

### 3.5 Formato do save (o que está dentro de `estado`)

Não há serializador próprio: **o save é o objeto `estado` do motor, tal qual** (`jogo.js:128`,
`jogo.js:2675`). Campos que o jogo escreve diretamente nele: `nome` (`jogo.js:84`), `campeao`
(`jogo.js:86`), `vipAte` (`jogo.js:88`), `relogio` (`jogo.js:93`, `1559`), `rotina` (`jogo.js:94`),
`rev` (`jogo.js:2677`), `salvoEm`/`autoHab` (`jogo.js:122`), `ignorarBasicos` (`jogo.js:5884`),
`modelo`/`autoHab` (**mortos**: `jogo.js:5880`), `totais.*` (`jogo.js:1155`, `1077`), `mascote`,
`mascotes`, `skin`, `skinPet`, `titulo`, `conquistas`, `bencoes`, `gemas`, `espolios`, `pocoes`,
`barra`, `ranks`, `atrib`, `pontos`, `pontosAtrib`, `tarefa`/`ofertas`, `cofre`, `ouro`, `xp`,
`nivel`, `vida`, `mana`, `itens`, `mochila`, `local`, `buffBarao`, `diarias`.
Os itens são **texto**: `"<baseId>[+N][~Q]"`, com `~?` enquanto o servidor não sorteou
(`motor.js:166-175`).

---

## 4. O mercado entre jogadores

### 4.1 Onde e como abre

* janela `#janela-mercado` (`jogo.js:1633`: tecla **J**; `jogo.js:2440`), ou pelo NPC **Mercador**
  (`jogo.js:5007`: `abrirMercadoJogadores('comprar')`), ou pelo botão `#abrir-mercado` (`jogo.js:2832`).
* `abrirMercadoJogadores(aba)` (`jogo.js:2438-2443`) → `desenharMercadoJog()` + `carregarMercado()`.
* `carregarMercado()` (`jogo.js:2374-2379`): `dadosMercado = await rede.mercado()` — traz `ofertas`, `caixa`,
  `limite`, `taxa`, `diamantes`, `orbs`.
* `desenharMercadoJog()` (`jogo.js:2444-2579`) **sai imediatamente se a janela está escondida**
  (`jogo.js:2445-2446`) — a extensão não pode ler o mercado pela janela fechada.

### 4.2 Como as ofertas são agrupadas (comprar)

* `chaveGrupo(item)` (`jogo.js:2406`): `gema ? 'gema:' + id : item` — o texto do item já embute refino e
  qualidade, por isso "mesmo item, refino e qualidade" caem no mesmo grupo.
* `gruposMercado(ofertas)` (`jogo.js:2407-2417`): `un = gema ? preco/g.q : preco` (preço **por unidade**,
  `jogo.js:2410`); `min[moeda]` = menor preço por moeda (`jogo.js:2413`); `qtd` somada (`jogo.js:2412`);
  `novo` = maior `id` de oferta do grupo (`jogo.js:2412`).
* filtros: `#mercado-busca`, `#mercado-classe`, `#mercado-moeda`, `#mercado-ordem`, `#mercado-qual`
  (`jogo.js:2477`, `2488-2496`).
* ordenações (`jogo.js:2501-2504`): `caro`, `novo`, `ofertas`, `melhor` (raridade → qualidade → refino,
  `TIER_RAR` `jogo.js:2498`) e a padrão (mais barato, desempate por Gemas).
* `precoMin(gr, moeda)` (`jogo.js:2422`): "a partir de …" com `Math.ceil`.

### 4.3 Comprar, vender, cancelar, receber

| ação | linha | rota/efeito |
|---|---|---|
| comprar | `jogo.js:2794-2801` | confirma (`jogo.js:2797`) → `operarServidor('comprar', { id })` → `POST /api/mercado/comprar` |
| anunciar item | `jogo.js:2789-2792` | `operarServidor('vender', { indice, preco, moeda, ...para })` |
| anunciar lote de runas | `jogo.js:2782-2788` | `operarServidor('vender', { gema, qtd, preco, moeda, ...para })` |
| cancelar | `jogo.js:2802-2805` | `operarServidor('cancelar', { id })` → item volta à mochila (ou à caixa) |
| recolher vendas | `jogo.js:2807-2817` | `operarServidor('receber')` → `r.recebido` = `{ ouro, diamantes, orbs, itens, ficaram }` |

Regras escritas na interface (`jogo.js:2552` e `2576`, texto lido do servidor):
**"Ofertas: {ativas}/{limite} · duram 48 h · taxa: {taxa}% em ouro, de 13% a 7,5% em Gemas"** —
`dm.limite` e `dm.taxa` (ouro) vêm do servidor (`jogo.js:2552`); a taxa das Gemas é
`ORBS.faixasTaxa = [[1000, 0.13], [10000, 0.1], [Infinity, 0.075]]` (`orbs.js:13`), aplicada por
`taxaOrbs(preco)` (`orbs.js:46`), e `vendedorRecebe(preco) = floor(preco * (1 - taxaOrbs(preco)))`
(`orbs.js:47`). `atualizarLiquido()` (`jogo.js:2623-2631`) mostra o líquido: em ouro
`floor(p * (1 - dadosMercado.taxa))` (`jogo.js:2630`); em Gemas `vendedorRecebe(p)` + aproximação em
USDT (`jogo.js:2628-2629`).

### 4.4 Preço mínimo e referência (servidor)

* `pedirReferencia(item, moeda)` (`jogo.js:2582-2598`): `fetch('/api/mercado/referencia?item=…&moeda=…')`
  com `Authorization: Bearer <lol-idle-token>` (`jogo.js:2587`); cache de **60 s** (`jogo.js:2585-2586`).
* `refsMercado` guarda `{ valor, minimo, aviso }`; o texto é
  `"Os jogadores pagam em torno de {ref} · preço mínimo: {min}"` (`jogo.js:2601`).
* ao anunciar: abaixo de `rf.minimo` **trava** e corrige o campo (`jogo.js:2776-2780`); abaixo de
  `rf.aviso` **pergunta** (`jogo.js:2781`).
* o mesmo mínimo é aplicado à sugestão de preço da aba Vender (`jogo.js:2537`, `2553`, `2593-2596`).

### 4.5 Codificação: gema, mascote e item

| coisa | formato | onde |
|---|---|---|
| lote de runas (Gemas do Ornn) | `"gema:<id>:<quantidade>"` — `ofertaGema` (`motor.js:128`) | `jogo.js:197`, `2406`, `2547`, `2786` |
| lote de mascote | `"mascote:<id>"`, só dos negociáveis — `ofertaMascote` (`motor.js:130`) | `motor.js:130-131` |
| item | `"<baseId>[+refino][~qualidade]"`, ex. `"3071+2~S"` (`motor.js:166-175`) | `jogo.js:164`, `192` |
| nome de uma oferta | `nomeOferta(item)` (`motor.js:131`) | `jogo.js:198`, `388` |

Preços: `fmtPreco(preco, moeda)` (`jogo.js:2368`) → `orbs` = `"N 💠"`, `diamante` = `"N 💎"`, senão
`"N ouro"`. A troca de moeda é `#vender-moeda` (`jogo.js:2613`, `2763-2765`).

### 4.6 Reserva ("vender só para")

* `RESERVA_NIVEL = 20` (`jogo.js:2360`): os dois precisam de nível ≥ 20 (e conta com 3 dias, diz o texto
  `jogo.js:2618`); o servidor confere.
* `reservaPara` (`jogo.js:2359`) persiste enquanto a aba Vender está aberta; o botão muda para
  "Reservar para {nome}" (`jogo.js:2620`, `2825`).
* comprar uma oferta reservada exige `estado.nivel >= 20` (`jogo.js:2481`) e `o.paraMim` (`jogo.js:2480`).
* não dá para reservar para si (`jogo.js:2772`).

### 4.7 O que o jogo nunca faz no mercado

* não há tolerância de preço no cliente: o mínimo é do servidor (`jogo.js:2776`).
* `operando` (`jogo.js:123`, `2671`) **bloqueia o save** durante a operação — a extensão que ler
  `estado` pela consola durante uma compra vê um save pela metade.
* a sondagem da caixa é a cada 30 s (`jogo.js:2836-2846`); com a janela aberta usa `rede.mercado()`,
  com ela fechada usa `/api/mercado?leve=1` (`jogo.js:2839`).
* histórico: `lerHistoricoMercado()` (`jogo.js:2363-2367`) → `rede.historicoMercado()`, "as suas últimas
  60 compras e vendas" (`jogo.js:2568`), anotado desde 10/10/2026 (`jogo.js:2563`).

---

## 5. Viagens, recall, mapa, Arena e os travões de `emCombate`

### 5.1 A regra que se repete

Três travões, sempre os mesmos, nesta ordem:

1. **morto** — `combate.darius.morto > 0` (`jogo.js:465`, `491`, `823`, `831`, `863`, `3867`, `4508`, `4639`, `4644`).
2. **Caveira** — `bloqueioCaveira()` (`jogo.js:990-994`: com Caveira e fora de Runeterra não entra em
   cidades nem sai; com a Vermelha ativa não bloqueia, `jogo.js:991`);
   usado em `jogo.js:465`, `4509`, `4633`.
3. **em combate** — `emCombateAqui()` (`jogo.js:462` = `localAtual().arena && M.emCombate(combate)`);
   usado em `jogo.js:467`, `826`, `3869`, `4510`, `4634`.

`M.emCombate(c)` (`motor.js:3079`): `arena?.mundo` **e** (`combatePvp > 0` **ou** `apanhou > 0` **ou**
algum inimigo `aggro` vivo). `EM_COMBATE_MUNDO = 6` s (`motor.js:3074`) é o tempo que `apanhou` fica
acima de zero depois de levar dano (`motor.js:3075-3077`) — e **levar dano cancela o recall**
(`motor.js:3077`, `emite 'recallCancelado'`).

### 5.2 Viagem (barra no ecrã)

* `TEMPO_VIAGEM = { runeterra: 5, cidade: 5, rift: 3 }` (`jogo.js:460`) — **segundos**.
* `comecarViagem(nome, dur, fazer)` (`jogo.js:463-478`): recusa na Arena/ponte (`jogo.js:464`), morto ou
  Caveira (`jogo.js:465`), troca de destino (`jogo.js:466`), em combate (`jogo.js:467`); limpa
  `A.destino/caminho/alvoAtaque` (`jogo.js:468-469`); guarda `{nome, dur, t, fazer, vida, local, x, y}`
  (`jogo.js:470`); `cena.viagem = { nome, k: 0 }` (`jogo.js:471`) — a barra é desenhada pela cena
  (`cena.js:1713-1732`).
* `passoViagem(dt)` (`jogo.js:488-497`) **cancela** se: morrer ou mudar de local (`jogo.js:491`); levar
  dano — `estado.vida < viagem.vida - 0.5` (`jogo.js:492`); andar mais de 0,3 tiles, atacar alguém ou
  entrar na fila (`jogo.js:493`). Completa em `viagem.t >= viagem.dur` (`jogo.js:496`).
* `cancelarViagem(motivo)` (`jogo.js:479-483`); **Esc** cancela (`jogo.js:1634`).
* `irPara(id)` (`jogo.js:498-514`): `M.viajar(estado, combate, id)` (`jogo.js:500`) — o motor recusa
  local inexistente, morto, ou destino igual ao atual (`motor.js:3067`) e limpa inimigos, `respawn` e
  `recall` (`motor.js:3069`).

### 5.3 Recall (voltar à Fonte)

* `#voltar-base` (`jogo.js:4507-4512`) e tecla **B** (`jogo.js:1644`): recusa na ponte (`jogo.js:4508`),
  com Caveira (`jogo.js:4509`), em combate fora da base (`jogo.js:4510`); `M.voltarBase` (`jogo.js:4511`).
* `M.voltarBase` (`motor.js:3082-3086`): recusa se já na base, morto ou em recall; em Runeterra recusa
  se `emCombate`; `recall = buffBarao > 0 ? BARAO.recall : RECALL` — `RECALL = 4` s
  (`motor.js:47`), `BARAO.recall = 2` s (`motor.js:3090`).
* `#local-desc` mostra `"Voltando para a base... {s}s (Esc cancela)"` (`jogo.js:6511`); **Esc** chama
  `M.cancelarRecall` (`jogo.js:1635`, `motor.js:3081`).
* a Fonte **não é viagem**: clicar em "fonte" no mapa faz o recall de sempre, "senão daria para fugir de
  uma luta na hora" (`jogo.js:3865-3866`).

### 5.4 Mapa

* tecla **M** (`jogo.js:1640`), `#abrir-mapa` (`jogo.js:4506`), `#hud-mapa` (`jogo.js:6087`).
* duas abas: `rift` e `mundo` (`jogo.js:3912-3927`, `#mapa-area`/`#mundo-area`, `#legenda-rift`/`#legenda-mundo`).
* `montarMarcadores()` (`jogo.js:3830-3842`): um botão por `M.LOCAIS` sem `arena`, posicionado por
  `l.pos` (fração da tela) e colorido por `corFaixa(l)` (`jogo.js:3720-3728`).
* `infoLocal(l, zonaMundo)` (`jogo.js:3792-3829`) escreve `#mapa-info`: monstros e pesos
  (`jogo.js:3772-3779`), espólios (`3753-3761`), chances de drop por raridade e qualidade
  (`3810-3819`: `M.chancesDrop(l, vip ? M.VIP.drop : 1)` e `M.chancesQualidade(0)`), runas
  (`3826`, `M.chancesGema`).
* clique em `[data-ir]` (`jogo.js:3860-3874`): fonte → recall (`3866`); morto → nada (`3867`); em
  combate → `avisoCombate()` (`3869`); `comecarViagem` com `TEMPO_VIAGEM.runeterra` se envolve arena,
  senão `TEMPO_VIAGEM.rift` (`3873`).
* `viajarCidade(id)` (`jogo.js:821-828`): cidade não descoberta → aviso (`824`); fora de Runeterra faz
  a viagem de 5 s e entra em Runeterra (`825`); em Runeterra, viagem de 5 s até a praça (`827`) e
  `tempoReal.enviar({ t:'cidade', id })` (`833`).
* `#ir-runeterra` (`jogo.js:3929-3933`): viagem de 5 s; desactivado se `l.arena`, morto ou em recall
  (`jogo.js:6515`).

### 5.5 Arena (PvP 1×1 na ponte)

* constante de ponte: `INFO_ARAM = { larg: ARENA_PVP.mapa.larg, pontos: [], …, aram: true }`
  (`jogo.js:255`); `naAram()` (`jogo.js:256`, `1272`).
* fila/desafio por HTTP: `consultarArena()` (`jogo.js:4529-4533`, `rede.arena()`), `aplicarArena`
  (`jogo.js:4534-4550`); períodos 1 s / 2 s / 15 s (`jogo.js:4547`).
* partida por tempo real: `arenaMsg(m)` (`jogo.js:4669-4706`) — `rodada` (`4674`), `luta` (`4682`),
  `fimRodada` (`4686`), `fim` (`4693`), `cancelada` (`4697`), `estado` (`4700`), `posicao` (`4701`).
* `entrarNaArena()` (`jogo.js:4638-4655`): **salva antes** (`jogo.js:4642`), guarda `arenaSaida` e
  `arenaVidaAntes` (`jogo.js:4645`), `M.viajar(estado, combate, 'aram')` (`jogo.js:4649`).
* `sairDaArena()` (`jogo.js:4656-4666`): `M.renascerArena`, devolve a vida/mano de antes
  (`jogo.js:4662`), volta para `arenaSaida` ou `fonte`.
* `Arena.entrar(combate, cena.mapa.livre, posEntrada(), info)` (`jogo.js:330`);
  `combate.arena.congelado = arenaPartida?.estado !== 'luta'` (`jogo.js:331`) — na ponte só se anda na
  hora da luta.
* `podeIrParaArena()` (`jogo.js:4632-4636`) repete os três travões (Caveira, em combate).
* desistir = derrota (`jogo.js:4756-4757`); sair da ponte no fim (`jogo.js:4723`, 15 s).

### 5.6 Runeterra: o que mais tem travão

* PK: `alternarPvp()` (`jogo.js:1200-1209`) — recusa na ponte (`1202`) e em `A.zonaPk` (`1203`);
  tecla **P** (`jogo.js:1338`), `#bt-pk` (`jogo.js:1210`).
* `atacarMaisPerto()` (`jogo.js:1402-1414`): raio de 8 tiles (`jogo.js:1412`), respeita `soCampeoes` e
  `Arena.podeAtacarJog` (`jogo.js:1410`).
* `sobMouse(p, soJogadores)` (`jogo.js:1415-1427`): jogador (1 tile, `y-0.6`, `jogo.js:1417`), monstro
  (`y-0.45`, chefe `y-0.9` e raio 1,3, `jogo.js:1420-1421`), monstro de outro (`jogo.js:1424`).
* `comandoDoMouse(e)` (`jogo.js:1433-1446`): botão direito — monstro/jogador ataca, chão anda
  (`Arena.mandarAndar`, `cena.marcarDestino`).
* segurar o botão direito: `andarSegurando()` (`jogo.js:1476-1483`) — novo destino a cada **0,15 s**
  (`jogo.js:1479`) e só se estiver a mais de 0,6 tiles (`jogo.js:1482`).
* teclado: `TECLA_ESPACO = { q:0, w:1, e:2, r:3 }` (`jogo.js:1270`), `ROTULO_ESPACO = ['Q','W','E','R']`
  (`jogo.js:1271`); `apertarHabilidade(hk)` empurra para `combate.arena.entrada.fila` (`jogo.js:1320`);
  setas andam (`jogo.js:1364-1392`); **S** para tudo (`jogo.js:1354-1357`); **Y** solta a câmara
  (`jogo.js:1303-1318`, só em Runeterra); **Z** monta (`jogo.js:1339`, `1217`).
* mira: `A.entrada.mira` vem do rato (`jogo.js:1490-1493`) ou automática no toque
  (`miraAutomatica()`, `jogo.js:1324-1333`: alvo a < 10 tiles, senão 3 tiles à frente).
* `enviarTempoReal(dt)` (`jogo.js:1176-1199`): ~10×/s (`jogo.js:1186`), manda `tj, x, y, dx, dy, anda,
  atk, vida, skin, pvp, fl, parado, morto, mt, mons[≤6], ad[≤6], gz[≤8]`.

---

## 6. A análise que o jogo **já** publica

### 6.1 Onde nasce e o que conta

* `novaAnalise()` (`jogo.js:523`) — os campos, lidos:
  `ini` (Data de início), `xp`, `ouro`, `abates`, `chefes`, `dano`, `maior`, `janela`, `itens`
  (`{ basico, epico, lendario }`), `espolios`, `runas`, `mortes`.
* `analise = novaAnalise()` (`jogo.js:524`) — **por sessão**: nasce quando o jogo abre e nunca é salvo.
* `contarAnalise(ev)` (`jogo.js:525-537`), chamado para **cada** evento de `combate.eventos`
  (`jogo.js:571`):
  * `abate`: `abates++`, `chefes++` se `ev.chefe`, `xp += ev.xp`, `ouro += ev.ouro`, itens por
    raridade via `M.raridade`, `espolios += (ev.espolios\|\|[]).length`,
    `runas += (ev.gemas\|\|[]).length` (`jogo.js:527-531`).
  * `dano`: **só monstros** — `!String(ev.alvo).startsWith('j:')` (`jogo.js:532`); `maior` ignora as
    fontes `queima` e `sangue` (`jogo.js:533`); `janela` guarda `[agora, valor]` e deixa só os
    últimos 60 s (`jogo.js:534-535`).
  * `morreu`: `mortes++` (`jogo.js:536`).

### 6.2 As contas

`contasAnalise()` (`jogo.js:538-542`):

| campo | fórmula (lida) | linha |
|---|---|---|
| `seg` | `(Date.now() - A.ini) / 1000` | `jogo.js:541` |
| `h` (usado internamente) | `seg / 3600` com `seg = Math.max(60, …)` | `jogo.js:539` |
| `xpH` | `A.xp / h` | `jogo.js:541` |
| `ouroH` | `A.ouro / h` | `jogo.js:541` |
| `abatesH` | `A.abates / h` | `jogo.js:541` |
| `dps` | `ultimo / jan`, com `jan = max(10, min(60, idade da amostra mais antiga))` e `60` se vazia | `jogo.js:540-541` |
| `dpsMedio` | `A.dano / seg` | `jogo.js:541` |

### 6.3 Onde é mostrado

* `desenharAnalise()` (`jogo.js:544-561`) escreve `#analise-corpo`: "Desde que você abriu o jogo ·
  {tempo}" (`tempoCacada`, `jogo.js:543`), quatro cartões — **XP por hora**, **Ouro por hora**,
  **Abates por hora** (com totais e `{n} chefes`), **Dano por segundo** ("último minuto · maior golpe
  {n}") — e as linhas **Básicos / Épicos / Lendários / Espólios / Runas / Mortes** (`jogo.js:546-560`).
* `abrirAnalise()` (`jogo.js:563-566`): `#janela-analise` e um `setInterval` de **1 s** que redesenha
  enquanto a janela está aberta (`jogo.js:565`).
* `#rastreio-analise` — **sempre visível** no quadro de missões quando há abates
  (`jogo.js:6250-6255`): `hidden = !analise.abates` (`jogo.js:6251`) e o texto
  `"📊 Caçada" / "{xp} XP/h · {ouro} ouro/h"` (`jogo.js:6253`). Clicar abre a janela (`jogo.js:6761`).
* `data-zerar-analise` (`jogo.js:560`, `567`): `analise = novaAnalise()`.
* nota escrita pelo próprio jogo: "Conta só a caçada (monstros que você derrotou). Tarefas, baús e
  prêmios ficam de fora." (`jogo.js:559`).

### 6.4 O que a extensão deve tirar daqui

O jogo **já mede** XP/h, ouro/h, abates/h, chefes, DPS do último minuto, maior golpe, dano médio,
itens por raridade, espólios, runas e mortes — e expõe os dois primeiros **sempre visíveis** em
`#rastreio-analise` e os outros todos em `#janela-analise`/`#analise-corpo`. Nada disso está no save
(nasce e morre com a sessão, `jogo.js:524`), por isso tem de ser lido do DOM enquanto o jogo corre.

---

## 7. NAO VERIFICADO (fora do repo ou fora do alcance deste leitor)

### 7.1 Ficheiros que faltam no repo

| ficheiro | para que serve | consequência |
|---|---|---|
| **`jogar.html`** (ou equivalente) | cria **todos** os elementos da tabela 2.1 | os ids existem, mas o seu tipo, conteúdo inicial e atributos (aria, `data-*`) **não** foram lidos; "onde nasce" nesta especificação é a 1ª linha de `jogo.js`/`cena.js` que o usa |
| **`js/rede.js`** | todos os `fetch` (save, mercado, cofre, guilda, arena, chat, orbs, pagamentos) | rotas, cabeçalhos, `ErroSessao`, `salvarAoFechar`, `sairDaFonteAoFechar`, `funil` — só conhecidos pelos nomes chamados |
| **`js/pulso.js`** | o `Worker` do relógio em segundo plano (`jogo.js:1551`) | **o período do tique é desconhecido** → a que ritmo o jogo avança com a aba escondida não é verificável aqui |
| **`js/entrada.js`** | `conectar`, `captchaEm`, `escolherCampeao` | o formato de `sessao` (`criado`, `campeao`, `vipAte`, `agora`, `rp`, `orbs`, `recebidos`, `evento`, `reinicio`, `login`, `guilda`, `vm`, `offline`, `premios`, `donos`, `sorteios`) é inferido do uso |
| **`js/som.js`, `js/dialogo.js`, `js/dicas.js`, `js/tutorial.js`, `js/novidades.js`, `js/ornn-anim.js`** | som, `confirmar`/`avisar`/`pedirTexto`, dicas, tutorial, novidades, animação do Ornn | comportamento das promessas (resolvem `true`/`false`?) e o formato do `sessao.*` destes módulos |
| **`css/*`** | `modo-leve`, `gaveta`, `hud-mini`, `modo-leve`… | as classes que o jogo liga (`jogo.js:366-370`, `1533`, `4345`) e o que elas escondem |
| **servidor** (`servidor/*`) | tudo o que é `/api/...` | ver 7.2 |

### 7.2 O que só o servidor sabe (e o jogo apenas mostra)

* `dm.limite` e `dm.taxa` do mercado (`jogo.js:2552`, `2576`) — quantas ofertas por jogador e a taxa
  em ouro.
* `ARENA_PVP.*` importado de `arena-pvp.js` (está no repo, **não lido** por este leitor): `aceitarSeg`,
  `rodadaSeg`, `vitorias`, `intervaloSeg`, `quedaSeg`, `calibracao`, `mesmoParDia`, `fila.*`, `mapa.larg`,
  `inicio` — usados em `jogo.js:4607`, `4610`, `4736`, `4691`, `4798`, `4807`, `4797`, `4783`, `255`, `4667`.
* `M.*` do `motor.js` — os números do motor foram lidos **apenas** onde o jogo os usa neste bloco
  (`viajar`, `voltarBase`, `emCombate`, `RECALL`, `BARAO`, `emCombate` mundo, codificação de itens,
  `QUALIDADES`, `VIP`, `GRUPO`, `TRANSFERIR`, `POCOES`, `MOCHILA*`). O resto do motor (curvas, dano,
  kits) está nos blocos 01-04.
* `orbs.js`: `ORBS.compra/saque/saqueMin/faixasTaxa/precoMax` (`orbs.js:7-18`), `enderecoValido`
  (`orbs.js:40`), `usd` (`orbs.js:44`), `taxaOrbs`/`vendedorRecebe` (`orbs.js:46-47`) — **lidos**, mas
  `referenciaDe`/`contaDaReferencia` (`orbs.js:22-34`) não.
* `campeoes.js`, `pixel.js`, `mapa.js`, `mundo.js`, `runeterra.js`, `fx.js`, `arena.js`,
  `chefe-global.js`, `vilemaw.js`, `itens.js`, `ganhos.js`, `guilda.js`, `i18n*.js`,
  `tempo-real.js`, `balanco.js`, `wiki-dados.js` — estão no repo mas **foram só utilizados** pelo
  jogo, não lidos por este leitor.
* rotas HTTP chamadas pelo jogo (nome e argumentos lidos; resposta **não** verificada):
  `/api/eu`, save, `/api/mercado` (`?leve=1`), `/api/mercado/referencia`, `/api/morte`,
  `/api/saco/pegar`, `/api/bau`, `/api/vilemaw/bau`, `/api/loja/comprar`, `/api/mestre/reset`,
  `/api/cofre`, `/api/ornn/montar`, `/api/ornn/forjar`, `/api/diaria`, `/api/login-diario`,
  `/api/presente-nivel`, `/api/guilda/*`, `/api/arena`, chat, `/api/orbs`, pagamentos.

### 7.3 O que não foi feito neste bloco (Regra Nº 6)

* não foi corrido nenhum browser, nenhum CDP, nenhuma página do jogo (proibido pelo pedido).
* não foi lido `motor.js` inteiro — só o que `jogo.js`/`cena.js` chamam.
* `cena.js` foi lido inteiro, mas as secções 1.700-3.900 e 4.400-5.900 (desenho por campeão,
  sprites, Zacs e Tarics) foram lidas de forma sistemática apenas nos pontos que o jogo usa
  (`evento`, `atualizar`, `desenhar`, `posicoesArena`, `sobMouse`, `desenharNome`, minimapa, noite,
  viagem); os números ali dentro são de animação e não de regra.
* os 327 ids da tabela 2.1 foram classificados **escreve/só lê** por expressão regular sobre a linha;
  um id que só aparece dentro de um `innerHTML` de outro módulo pode não aparecer aqui.

---

## 8. Armadilhas de leitura (erros que este bloco cometeu ou quase cometeu)

1. **Os números do cartão do jogador são strings arredondadas.** `#st-ouro`, `#st-poder`, `#st-ad`,
   `#st-arm`, `#st-rm`, `#st-ap`, `#st-abates`, `#st-mortes` e `#st-vida-txt` passam por
   `fmt` (`cena.js:225`): `>= 1e6` → `"1.2M"`, `>= 1e4` → `"12.3k"`, senão inteiro. Ler
   `#st-ouro` como número dá `NaN` a partir de 10.000. Os que são seguros: `#st-va`
   (`toFixed(2)`, `jogo.js:6461`), `#st-esq` (`toFixed(1)` + `%`, `6462`), `#st-crit`
   (`Math.round` + `%`, `6463`), `#st-critx` (`×` + `toFixed(2)`, `6464`), `#st-cdr`
   (`−` + `Math.round` + `%`, `6465`), `#st-nivel` (`String`, `6432`), `#hud-nivel` (`6210`).
2. **`#log` é o chat "servidor".** `caixas = { servidor: $('#log'), global: …, fonte: …, guilda: …,
   privado: … }` (`jogo.js:2849`); `trocarCanal('servidor')` esconde **todas** as caixas de chat
   (`jogo.js:2874`) e esconde `#chat-form` (`2875`). Quem procurar as mensagens do sistema nas abas
   do chat não as encontra: estão em `#log`.
3. **`#log` e o chat só guardam 150 linhas** (`jogo.js:158`, `2889`). Um scrape atrasado perde
   histórico; não há nada em memória acessível.
4. **dois relógios diferentes.** `log()` marca a hora com `new Date()` **local** (`jogo.js:154`),
   enquanto o mundo usa `agoraMundo() = Date.now() + desvioRelogio` com `desvioRelogio` vindo do
   servidor (`jogo.js:91-92`, `1559`, `6473`). Num PC com o relógio errado, a hora do `#log` não
   bate com `#hud-hora`.
5. **`cena.aviso` guarda só um aviso.** `aviso(txt, cor) { this.avisos = [{ txt, cor, t: 0 }]; }`
   (`cena.js:1616`) — dois avisos seguidos substituem-se; o primeiro pode desaparecer antes de 3 s
   (a lista envelhece em `cena.js:4044`). Não é fonte fiável de eventos sequenciais.
6. **`#batalha` é código morto.** `if (false) $('#batalha').innerHTML = … : …` (`jogo.js:6556`) — a
   lista de criaturas debaixo do ecrã nunca é desenhada; o quadro do alvo é `#hud-alvo`
   (`jogo.js:6548-6555`).
7. **`#npcs` está sempre escondido.** `$('#npcs').hidden = true` em cada `atualizarUI`
   (`jogo.js:6513`) — a lista de NPCs da coluna não é usada; o clique é no `canvas` (`jogo.js:401-406`).
8. **A janela do mercado não desenha escondida.** `desenharMercadoJog()` sai logo se
   `#janela-mercado` está `hidden` (`jogo.js:2445-2446`); o mesmo padrão em `desenharVenda`
   (`jogo.js:5530`), `atualizarBolsa` (`jogo.js:6025`) e `desenharMercado`… Ler o HTML dessas
   janelas fechadas devolve lixo velho.
9. **`operando` bloqueia o save.** `salvar()` sai sem enviar enquanto uma operação de mercado corre
   (`jogo.js:125`, `2671-2672`); o `estado` que a extensão venha a fotear nessa altura é
   intermediário (ouro/mochila a meio da operação).
10. **`estado.modelo` e `estado.autoHab` são campos mortos**, repostos a `''`/`false` em cada
    arranque (`jogo.js:5880`): "o automático saiu em out/2026". Qualquer extensão que os leia como
    configuração está a ler nada.
11. **As opções antigas da rotina são apagadas no arranque** — `ativa, vida, mana, vender, voltarPara,
    mochilaTravada` (`jogo.js:95`) — e `#rotina input` fica `disabled` sem VIP (`jogo.js:1657`), com
    `#rot-vip` a abrir a Loja (`jogo.js:2337`).
12. **`#hud-alvo` muda de sítio conforme a barra do chefe.** `cena.aoBarraChefe` (`jogo.js:217-221`)
    só mexe o `top` quando `!#moldura.hud-mini`; as classes `hud-compacto (<800)`, `hud-mini (<600)`,
    `hud-sem-equip (<920)` e `hud-baixa` (`jogo.js:366-370`) mudam o que existe no ecrã.
13. **Um modal aberto esconde o jogo.** O teste que o jogo usa é
    `document.querySelector('.janela:not([hidden]), .dialogo-fundo')` (`jogo.js:1260`, `1337`,
    `1636`, `3042`, `6743`, `6981`, `6992`) — a extensão tem de usar o mesmo, senão pensa que uma
    tecla vale quando não vale.
14. **`#st-online b` assume um filho `<b>`** (`jogo.js:245`): se o HTML mudar, o jogo rebenta.
15. **A análise mistura coisas.** `dps` inclui dano de queima e de sangramento (`jogo.js:532` só
    filtra o alvo jogador); `maior` é que os exclui (`jogo.js:533`). E `jan` é `60` quando não há
    amostras (`jogo.js:540`), o que faz o DPS do primeiro minuto parecer menor.
16. **`#rastreio-analise` só aparece depois do primeiro abate** (`jogo.js:6251`) . O quadro de missões pode ser recolhido
    (`etiquetaMissoes`, `jogo.js:6326-6356`), mas a linha continua dentro de `#rastreador`.
17. **Três mostradores de dinheiro diferentes**: `#st-ouro` (`jogo.js:6397`, `fmt`, animado
    `jogo.js:6394-6416`), `#diamantes` (`jogo.js:2369-2371`, `fmt`) e `#dia-saldo` (`jogo.js:2371`),
    mais `#mj-saldo` (`jogo.js:2449-2450`, ouro + Gemas) e `#orbs-saldo` (`jogo.js:2054`). O valor
    durante a animação de contagem não é o valor real.
18. **`#tela` tem dois donos.** `ajustarTela` (`jogo.js:341-373`) mete `style.width/height` em
    `px` e a cena mete `canvas.width/height` (`cena.js:325`, `485`); a escala é `largCss /
    (VIS_L * T)` em cada conversão de coordenadas (`jogo.js:1429`, `cena.js:496`).
19. **`fmt` da cena vs `inteiro` do jogo**: `fmtPreco` do mercado usa `fmt` (`jogo.js:2368`,
    arredonda) mas `precoCheio` usa `inteiro` (`jogo.js:2600`) — o mesmo preço aparece das duas
    formas na mesma janela.
20. **Trocar de personagem ou de nome limpa o `localStorage`**: a data de criação muda e tudo o que
    acaba em `':' + NOME` ou `'-' + NOME` é apagado (`jogo.js:56-60`), e o nome novo é propagado
    (`jogo.js:2719-2726`). Estado que a extensão tenha guardado por nome desaparece.
21. **A morte em Runeterra mexe em itens pelo servidor** (`/api/morte`, `jogo.js:714`) — a mochila que
    a extensão viu antes pode já não existir; `soltarSaco` só corre com `operando === false` e
    tenta até 25 vezes, uma a cada 400 ms (`jogo.js:713`).
22. **`#avisos-saque` guarda 3 e apaga-se sozinho** (7 s para lendário, 4 s para o resto,
    `jogo.js:6376-6377`) — a fonte certa de "caiu um lendário" é o evento, não este painel.
