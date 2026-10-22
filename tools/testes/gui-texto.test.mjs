/*
 * gui-texto.test.mjs - A GUI: TEXTO FORA, CONTRASTE ALTO, POPUP DA MACRO E O REVAMP (2026-10-22).
 *
 * QUEIXAS DO DONO (verbatim):
 *   "a gui ta com MUITO DETALHE E MUITA EXPLICACAO. TEM COISAS Q SAO AUTO EXPLICATIVAS.
 *    TIRA TEXTO DA GUI."                              (2026-10-21)
 *   "ta uma merda de ler texto da gui. faz contraste melhor."   (2026-10-21)
 *   "o botao nos switches que levam a pagina de macro, pode abrir um pop up inves de sair
 *    da pagina."                                      (2026-10-21)
 *   "gui ta overwhelming. design pessimo. arruma tudo. nao é pra tu usar o design atual,
 *    é um complete overhaul. revamp."                 (2026-10-22)
 *
 * Este banco e ESTATICO de proposito: a GUI corre no mundo ISOLADO da extensao e o banco
 * de regressao carrega o `automation.js`, nao o `gui.js`. O que se prova aqui e o MARKER
 * DISCRIMINANTE no ficheiro que o Chrome serve (Regra No 4): o texto explicativo saiu, o
 * contraste subiu, o popup da macro existe, e a CASCA e a NOVA (rail + cartao + acento unico)
 * — cada asserção T7 falha no desenho ANTIGO, nao no novo. Sem isso, "revamp" nao passava de
 * uma afirmacao: os marcadores antigos (`--bg:#100e0c`, `width:min(1180px,94vw)`, o `.tab`
 * castanho) estao proibidos, e os novos (grafite + rail de 190 px + um dourado) sao exigidos.
 *
 * CONTRATO: t.check(rotulo, condicao) so passa com condicao === true.
 */

import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './dom-stub.mjs';

const GUI = path.join(RAIZ, 'extension', 'gui.js');

export const suite = {
  nome: 'gui-texto',
  titulo: 'GUI: texto fora, contraste alto, popup da macro e a casca do revamp (rail + cartao)',

  async run(t) {
    const src = fs.readFileSync(GUI, 'utf8');

    /* ================= T1 - texto auto-explicativo fora ================= */
    t.check('T1: nenhum <p class="intro"> sobrou no painel', !src.includes('<p class="intro">'));
    t.check('T1b: o rodape nao manda "passa o mouse" (texto auto-explicativo)',
      !src.includes('Passa o mouse sobre cada bot'));
    t.check('T1c: o rodape e curto ("Pronto.")', src.includes('id="ap-fb">Pronto.</span>'));

    /* ================= T2 - contraste (a queixa do texto ilegivel) ================= */
    t.check('T2: o texto do painel subiu para #eef2f8 (contraste alto)',
      src.includes('--txt:#eef2f8'));
    t.check('T2b: o --dim subiu para #a7b2c3 (legivel sobre o fundo)',
      src.includes('--dim:#a7b2c3'));
    t.check('T2c: os dois cinzas ANTIGOS ja nao sao o --dim',
      !src.includes('--dim:#c9bfa9') && !src.includes('--dim:#9d9280'));
    t.check('T2d: o mecanismo de "texto curto" continua a esconder hints',
      src.includes('.hint.tira{display:none}'));

    /* ================= T3 - popup da macro ================= */
    t.check('T3: o overlay #lolidle-ap-macro existe', src.includes('#lolidle-ap-macro'));
    t.check('T3b: o overlay arranca escondido e liga com .on',
      src.includes('#lolidle-ap-macro.on{display:flex}'));
    t.check('T3c: abrirMacroPopup() move o bloco para o popup (sem navegar)',
      src.includes('function abrirMacroPopup(alvo)') && src.includes("m.classList.add('on')"));
    t.check('T3d: o ? de cada switch chama abrirMacroPopup',
      src.includes('abrirMacroPopup(String(cfgBtn.dataset.macro'));
    t.check('T3e: fechar devolve o bloco a aba Macro (sem perder o no)',
      src.includes('function fecharMacroPopup()') && src.includes('renderMacro()'));

    /* ================= T4 - compra por ITEM (2026-10-21) ================= */
    t.check('T4: cada item da watch tem o SEU limite em ouro (data-wlim)',
      src.includes('data-wlim=') && src.includes('class="wlim"'));
    t.check('T4b: o teto por compra e editavel na GUI', src.includes('id="ap-watch-teto"'));
    t.check('T4c: nao ha "srdog" hardcoded na GUI (o dono escolhe os jogadores)',
      !src.includes('srdog'));

    /* ================= T5 - abas e tecto de 30k ================= */
    t.check('T5: a aba MERCADO existe na GUI', src.includes('data-tab="mercado"') && src.includes('id="ap-t-mercado"'));
    t.check('T5b: o botao "30.000 nos dois" existe e preenche os dois tectos',
      src.includes('ap-watch-30k') && src.includes('precoMax: 30000, tetoCompra: 30000'));

    /* ================= T6 - painel nao truncado / nao gigante ================= */
    t.check('T6: o painel nao passa da altura do ecra (max-height)',
      src.includes('max-height:calc(100vh - 28px)'));
    t.check('T6b: o painel cresce com o conteudo (height:auto), nao fica um bloco vazio',
      src.includes('width:min(1200px,95vw);height:auto'));
    t.check('T6c: o main repoe justify-content (a causa medida do painel truncado)',
      src.includes('justify-content:flex-start'));

    /* ================= T7 - O REVAMP: casca nova, desenho antigo PROIBIDO ================= */
    // O desenho antigo (castanho, abas em cima, caixas dentro de caixas) tem de ter SAIDO
    // por inteiro. Cada marcador abaixo existia em `HEAD` e nao existe mais.
    t.check('T7: o fundo castanho antigo (--bg:#100e0c) saiu', !src.includes('--bg:#100e0c'));
    t.check('T7b: a largura antiga (min(1180px,94vw)) saiu', !src.includes('width:min(1180px,94vw)'));
    t.check('T7c: o tecto antigo (100vh - 20px) saiu', !src.includes('max-height:calc(100vh - 20px)'));
    t.check('T7d: a aba antiga (fundo #1c1916, texto #c8bda8) saiu',
      !src.includes('background:#1c1916') && !src.includes('color:#c8bda8'));
    // A casca nova: grafite neutro, rail de navegacao a esquerda, cartao como unico contentor,
    // titulos em maiusculas pequenas e UM acento (dourado) so no que esta activo.
    t.check('T7e: o fundo grafite novo (--bg:#0a0c10) esta la', src.includes('--bg:#0a0c10'));
    t.check('T7f: ha um rail de navegacao a esquerda (nav de 190px + shell flex)',
      src.includes('#lolidle-ap nav{width:190px') && src.includes('#lolidle-ap .shell{display:flex'));
    t.check('T7g: a aba activa e marcada por acento unico (dourado), nao por fundo castanho',
      src.includes('.tab.ativa{background:#f0c24e0f;color:var(--ouro)}'));
    t.check('T7h: os destinos estao agrupados por assunto (4 grupos no rail)',
      src.includes('nav-sec') && ['Operar', 'Ajustar', 'Acompanhar', 'Sistema'].every((g) => src.includes('>' + g + '</span>')));
    t.check('T7i: o cartao e o unico contentor e o titulo e maiusculas pequenas',
      src.includes('#lolidle-ap .card{background:var(--pnl)') && src.includes('text-transform:uppercase'));

    /* ================= T8 - NENHUMA aba/ID se perdeu no revamp ================= */
    // A casca foi reescrita; os contentores NAO podem ter mudado, ou os desenhadores
    // (`renderTudo`) e os handlers (`ACOES`) deixam de encontrar o que desenham.
    const abas = ['painel', 'itens', 'mercado', 'macro', 'personagem', 'ganhos', 'historico', 'pocao', 'manual'];
    t.check('T8: as nove abas existem (botao do rail + painel)',
      abas.every((a) => src.includes('data-tab="' + a + '"') && src.includes('id="ap-t-' + a + '"')));
    t.check('T8b: o cabecalho mantem os IDs que o renderCabecalho escreve',
      ['ap-estado', 'ap-h-nivel', 'ap-h-ouro', 'ap-h-hp', 'ap-h-local', 'ap-h-regiao'].every((i) => src.includes('id="' + i + '"')));
    t.check('T8c: os contentores que os desenhadores procuram continuam la',
      ['ap-painel-estado', 'ap-it-cofre', 'ap-mk-watch', 'ap-fb'].every((i) => src.includes('id="' + i + '"')));

    /* ================= T9 - a política do cofre aparece na GUI (1 linha, sem palestra) ================= */
    t.check('T9: o cartão do cofre diz a política nova numa linha (A -> cofre; C/B -> troca)',
      src.includes('Mochila perto de encher: lendário <b>A</b> vai para o cofre') &&
      src.includes('os <b>C/B</b> saem para dar lugar a um A'));
    t.check('T9b: a linha da política respeita o modo "texto curto" (hint tira)',
      /class="hint tira">Mochila perto de encher/.test(src));

    /* ================= T10 - PT-BR e SEM MDASH (ordem do dono, 2026-10-20/21) =================
     * "retira qualquer mdash da gui. ... tira. tudo." e "nao e pra usar pt pt. e pt br".
     * O mdash (U+2014) e o "tecto" (pt-PT) sao marcadores discriminantes: o ficheiro servido
     * pelo Chrome nao pode voltar a te-los. */
    t.check('T10: nenhum em-dash (U+2014) no ficheiro servido da GUI', !src.includes('\u2014'));
    t.check('T10b: "tecto" (pt-PT) saiu; o texto usa "teto"', !src.includes('tecto') && src.includes('teto'));
    t.check('T10c: numeros/datas em pt-BR (toLocaleString pt-BR)', src.includes("toLocaleString('pt-BR')"));
  },
};
