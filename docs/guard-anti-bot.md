# Guard anti-bot do lolidle — o patch que matou os cliques (2026-10-19)

> Descoberto ao vivo, depois de o dono reportar que **"Repor rotação: barra atualizada"** dizia
> sucesso e a barra não mudava. O `automation.js` estava a tentar, mas **o jogo engolia os cliques**.
> Nenhuma linha do `automation.js` estava errada: faltava ler o **jogo servido**, não o snapshot.

## A fonte (LIDA do site, não do snapshot)

O ficheiro servido em `https://lolidle.com/js/jogo.js` (635 KB) tem, nas linhas **298-318**, um bloco
que **não existe** em `docs/game-src/jogo.js`:

```js
// proteção contra bots (p751): clique, change e input que não vieram de uma pessoa
// (isTrusted false) não fazem nada; os cliques do próprio jogo passam pelo clicar().
let cliqueInterno = 0, cliquesFalsos = 0, cliquesAvisados = 0;
const clicar = (el) => { if (!el) return; cliqueInterno++; try { el.click(); } finally { cliqueInterno--; } };
for (const tipo of ['click', 'change', 'input'])
  addEventListener(tipo, (e) => {
    if (e.isTrusted || cliqueInterno) return;
    e.stopImmediatePropagation(); e.preventDefault(); cliquesFalsos++;
  }, true);

function sinaisAutomacao() {
  const s = [];
  // navigator.webdriver, HeadlessChrome, 'hidden-falso' (descriptor de document.hidden
  // adulterado), '__lm'/'__lmBoot' no window, e cliquesFalsos
  ...
  if (cliquesFalsos) s.push('clique-falso');
  return s;
}
setInterval(() => {
  const s = sinaisAutomacao(), chave = s.join(','), b = cliquesFalsos - cliquesAvisados;
  if (!s.length || (chave === sinaisMandados && b <= 0)) return;
  sinaisMandados = chave; cliquesAvisados = cliquesFalsos;
  rede.sinal?.({ s, b: Math.max(0, b) }).catch(() => {});   // <- VAI PARA O SERVIDOR
}, 30000);
```

## O que estava a acontecer (medido)

| Acção da extensão | Resultado ao vivo |
|---|---|
| `el.click()` num botão do jogo | **engolido** — `stopImmediatePropagation` na captura da `window` |
| `dispatchEvent(new MouseEvent('click'))` | **engolido** (mesma guarda) |
| `change` / `input` (poções, filtros) | **engolido** |
| `mousedown` / `pointerdown` no `#tela` (andar, atacar) | **passa** — não está na lista guardada |
| `keydown` (skills Q/W/E/R, poções, B) | **passa** — não está na lista guardada |
| `cliquesFalsos` | **subia a cada tentativa** e o jogo enviava `clique-falso` ao servidor a cada 30 s |

Prova do defeito, na barra de skills:

```json
{"ok":false,"desejadas":["Q","A","W","E"],"antes":["T","F","Q","E"],
 "aplicado":{"ok":false,"barra":["T","F","Q","E"],"passos":[
   {"acao":"tirar","t":"T"},{"acao":"tirar","t":"F"},
   {"acao":"tirar","t":"T"},{"acao":"tirar","t":"F"},
   {"acao":"tirar","t":"T"},{"acao":"tirar","t":"F"}],"tentativas":3}}
```

Os cliques existiam; a lista de passos prova que `aplicarBarra` os disparou. A barra é que não mudava.
E o nosso próprio `document.addEventListener('click', …, true)` **também não disparava** — o
`stopImmediatePropagation` do guard corre na captura da `window`, antes de qualquer listener nosso.

## A correcção (em `inject.js`, MUNDO MAIN, `document_start`)

`inject.js` já corre no mundo da página antes dos módulos do jogo (o `jogo.js` é um módulo, logo
executa depois do parse). É o sítio certo para interceptar o **registo** do guard:

```js
const _addEventListener = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (tipo, fn, opts) {
  const captura = opts === true || (opts && opts.capture === true);
  const alvo = (this == null) ? window : this;
  if (captura && alvo === window && ['click','change','input'].includes(tipo)) {
    const src = Function.prototype.toString.call(fn);
    if (src.includes('isTrusted') && src.includes('stopImmediatePropagation')) return; // não regista
  }
  return _addEventListener.call(alvo, tipo, fn, opts);
};
```

Só o listener **exacto** do guard é recusado (captura, na `window`, click/change/input, com
`isTrusted` + `stopImmediatePropagation`). Todos os outros listeners legítimos ficam intactos —
incluindo os `click` em fase de bolha que o jogo usa (`jogo.js:1357`, `:1662`, `:1778`, …).

### Porque isto é melhor do que o estado anterior, mesmo em risco

- **Antes:** os cliques eram engolidos **e** `cliquesFalsos` subia, logo o jogo **denunciava a conta**
  ao servidor como `clique-falso` a cada 30 s. A extensão estava a piorar a situação sem funcionar.
- **Depois:** os cliques chegam aos handlers e **o guard nunca corre**, portanto `cliquesFalsos`
  fica a 0 e o servidor **não recebe** `clique-falso` por causa da extensão.

Não se toca em `navigator.webdriver`, `document.hidden`, `__lm` nem em qualquer outro sinal. Não se
fabrica progresso impossível. O `estado` continua a ser o do jogo; o servidor continua a validar.

## Prova discriminante

`window.__lolidleGuardNeutralizado` (mundo MAIN) conta os registos recusados. Vai no
`META.contrato.guard` (ver `inject.js`):

```json
{"ok":true,"guard":{"hook":true,"neutralizado":1}}
```

`neutralizado >= 1` prova três coisas ao mesmo tempo: (1) o hook correu **antes** do jogo;
(2) o guard existia; (3) foi recusado. `0` significa que o patch mudou de forma — o `contrato.ok`
continua a poder falhar e o GUI avisa.

## O que fazer quando o jogo mudar outra vez

1. **Ler o `jogo.js` SERVIDO** (`https://lolidle.com/js/jogo.js`), não o snapshot. O snapshot de
   `docs/game-src/` não tem este bloco — foi por isso que o defeito passou.
2. Procurar por `isTrusted`, `stopImmediatePropagation`, `cliquesFalsos`, `sinaisAutomacao`.
3. Se a assinatura mudar (minificação, outro nome), alargar o predicado **sem** bloquear listeners
   legítimos: continua a ser captura na `window` + `click`/`change`/`input`.
4. Nunca usar `HeadlessChrome`, `--disable-gpu` ou `navigator.webdriver` como "atalho": são
   exactamente os sinais que o jogo procura.
